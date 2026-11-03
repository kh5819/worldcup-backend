// =========================
// 플듀 상식 레벨 진단소 — 혼자 검사 서버 (know:* 소켓 + /know/* REST)
// 문항은 한 개씩만 내줌(정답·해설·연도·참거짓 없이) → 답을 받으면 서버가 채점·시간 측정 → 그때 해설 공개
// 보기 순서는 세션마다 서버가 섞음 → 화면 코드만 봐서는 정답 위치를 알 수 없음
// 정체를 밝혀라: 단서는 요청할 때마다 하나씩 서버가 내줌(받은 단서 수 = 점수 단계, 서버 기록)
// DB: know_results (sql/know_tables.sql, RLS 켬·정책 0 = 서버 전용). 프로필은 진단소 공용(iq_profiles)
// =========================
import * as C from "./know-core.js";
import { STORE, rebuild, loadDb, bankVersion, countUse, flushStats } from "./know-store.js";
import { contentText, gramSet, jaccard } from "./know-validate.js";
import { registerKnowAdmin } from "./know-admin.js";
import { I18N, LOCAL } from "./know-bank-i18n.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, userKey, device, resultId } from "./iq.js";

// 살아 있는 참조 (관리자 수정 후 다시 만들어도 같은 이름으로)
export { STORE };
const BY_ID = { get: (id) => STORE.all.get(id), has: (id) => STORE.all.has(id) };

const SESS = new Map();
const SESS_TTL = 2 * 60 * 60 * 1000, MAX_SESS = 4, NET_SLACK = 2500;
const RECENT = new Map();            // 사람 → 최근 나온 문항 id (중복 출제 줄이기)
const RECENT_N = 250;
const DAILY_DONE = new Map();        // 사람|날짜 → 처음 시작 시각 (챌린지 미리 보고 다시 하기 방지)
const DAILY_PLAN = new Map();        // 날짜 → 그날 세트 (관리자가 문제를 고쳐도 그날 세트는 그대로 = 공정)
const REPORTED = new Map();          // 사람 → 신고 횟수(10분)
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const sweep = () => { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); if (DAILY_DONE.size > 50000) DAILY_DONE.clear(); for (const k of DAILY_PLAN.keys()) if (k !== C.dayKey()) DAILY_PLAN.delete(k); REPORTED.clear(); };

// ---------- 출제 ----------
export class PlanError extends Error { constructor(code, detail) { super(code); this.detail = detail; } }
const textCache = new WeakMap();
const gramCache = new WeakMap();
const gramsOf = (q) => { let g = gramCache.get(q); if (!g) { g = gramSet(textOf(q)); gramCache.set(q, g); } return g; };
const textOf = (q) => { let t = textCache.get(q); if (!t) { t = contentText(q); textCache.set(q, t); } return t; };
// 점수가 낮을수록 먼저: 난이도 목표 · 분야 균형 · 최근 본 문제 · 비슷한 문제(같은 소분류·글자 유사) · 시간의 순서는 끌어 놓기 먼저
export function buildPlan(mode, seed, { area = null, recent = null, pool = STORE.pool, ids = null } = {}) {
  const P = C.PLANS[mode] || C.EXTRA_PLANS[mode]; if (!P) throw new PlanError("BAD_MODE");
  if (!P.arcadeOk) pool = pool.filter((q) => !C.isArcade(q));   // 상식 캐치!는 공식 검사에 안 넣음
  const r = C.rng(seed);
  const n = P.n, need = { ...P.diff }, used = new Set(), out = [], areaN = {};
  const seen = recent || new Set();
  const pen = new Map();
  const areaCap = Math.ceil(n / C.AREAS.length) + 1;
  const pick = (cands) => {
    if (!cands.length) return null;
    let best = null, bs = Infinity;
    for (const q of cands) {
      let s = (need[q.d] > 0 ? 0 : 10 + Math.abs(2 - q.d)) + (seen.has(q.id) ? 6 : 0) + r() * 3;
      if (q.game === "timeline" && q.kind !== "order") s += 4;
      if (mode !== "area" && (areaN[q.area] || 0) >= areaCap) s += 7;
      s += pen.get(q.id) || 0;   // 이미 고른 문항과 같은 소분류(+4)·비슷한 내용(+20) — 고를 때마다 누적해 둠
      if (s < bs) { bs = s; best = q; }
    }
    used.add(best.id); need[best.d]--; areaN[best.area] = (areaN[best.area] || 0) + 1; out.push(best);
    const bg = gramsOf(best);
    for (const q of pool) { if (used.has(q.id)) continue; let p = 0; if (q.sub && best.sub === q.sub) p += 4; if (jaccard(gramsOf(q), bg) > 0.45) p += 20; if (p) pen.set(q.id, (pen.get(q.id) || 0) + p); }
    return best;
  };
  const avail = (f) => pool.filter((q) => !used.has(q.id) && f(q));
  if (mode === "area") {
    if (!C.AREAS.includes(area)) throw new PlanError("BAD_AREA");
    const have = pool.filter((q) => q.area === area).length;
    if (have < n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: n, have, area });
    for (let i = 0; i < n; i++) pick(avail((q) => q.area === area));
  } else {
    if (pool.length < n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: n, have: pool.length });
    for (const [g, k] of Object.entries(P.games)) for (let i = 0; i < k; i++) pick(avail((q) => q.game === g)) || pick(avail((q) => q.game !== "final"));
    if (out.length < n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: n, have: out.length });
  }
  return orderPlan(out, r, seed);
}
// 섞되 최후의 상식왕은 맨 끝(쉬운 것부터), 같은 미니게임 3연속·같은 소분류 연속 피하기
function orderPlan(out, r, seed) {
  const fin = out.filter((q) => q.game === "final"), rest = C.shuffle(out.filter((q) => q.game !== "final"), r);
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < rest.length; i++) {
    const bad = (rest[i].sub && rest[i].sub === rest[i - 1].sub) || (i >= 2 && rest[i].game === rest[i - 1].game && rest[i].game === rest[i - 2].game);
    if (!bad) continue;
    const j = rest.findIndex((q, k) => k > i && q.game !== rest[i - 1].game && (!q.sub || q.sub !== rest[i - 1].sub)); if (j > 0) [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  fin.sort((a, b) => a.d - b.d);
  return [...rest, ...fin].map((q, i) => ({ id: q.id, seed: (C.hashSeed(`${seed}:${i}:${q.id}`)) >>> 0 }));
}
// 취약 분야 연습: 미리 정하지 않고 문항마다 그때까지 정답률로 난이도를 고름 (기록·랭킹 제외)
export function adaptivePick(pool, { area, results, used, seed }) {
  const acc = results.length ? results.reduce((s, x) => s + x.part, 0) / results.length : 0.5;
  const want = Math.max(1, Math.min(4, Math.round(1 + acc * 3.2)));
  const r = C.rng(seed);
  const cands = pool.filter((q) => (!area || q.area === area) && !used.has(q.id) && q.game !== "final" && !C.isArcade(q));
  if (!cands.length) return null;
  cands.sort((a, b) => Math.abs(a.d - want) - Math.abs(b.d - want) || r() - 0.5);
  return cands[0];
}

// 문항 → 내줄 화면 정보 + 서버만 아는 정답 키. seed로 보기 순서 섞음
export function serve(q, seed) {
  const r = C.rng(seed);
  const pub = { id: q.id, game: q.game, kind: q.kind, area: q.area, d: q.d, q: q.q, lim: C.limitOf(q.game, q.d, q.kind), lab: q.lab || null, art: q.art || null };
  let key;
  switch (q.kind) {
    case "mcq": case "reveal": { const idx = C.shuffle(q.opts.map((_, i) => i), r); pub.opts = idx.map((i) => q.opts[i]); key = idx.indexOf(0); if (q.kind === "reveal") { pub.clueN = q.clues.length; } break; }
    case "map": { const idx = C.shuffle(q.codes.map((_, i) => i), r); pub.codes = idx.map((i) => q.codes[i]); key = idx.indexOf(0); break; }
    case "ox": key = !!q.ans; break;
    case "order": { const idx = C.shuffle(q.events.map((_, i) => i), r); pub.events = idx.map((i) => q.events[i][0]); const byYear = [...q.events.keys()].sort((a, b) => q.events[a][1] - q.events[b][1]); key = byYear.map((orig) => idx.indexOf(orig)); break; }
    case "pair": { const L = C.shuffle(q.pairs.map((_, i) => i), r), R = C.shuffle(q.pairs.map((_, i) => i), r); pub.left = L.map((i) => q.pairs[i][0]); pub.right = R.map((i) => q.pairs[i][1]); key = L.map((i) => R.indexOf(i)); break; }
    case "num": pub.num = { unit: q.n.unit, min: q.n.min, max: q.n.max, step: q.n.step }; key = { v: q.n.v, tol: q.n.tol, far: q.n.far, abs: !!q.n.abs }; break;
    case "fake": { const idx = C.shuffle(q.stmts.map((_, i) => i), r); pub.stmts = idx.map((i) => q.stmts[i][0]); key = pub.stmts.findIndex((_, k) => q.stmts[idx[k]][1] === false); break; }
    // ---- 6차 ----
    case "case": { const idx = C.shuffle(q.opts.map((_, i) => i), r); pub.opts = idx.map((i) => q.opts[i]); key = idx.indexOf(0); pub.clueN = q.clues.length; break; }
    case "where": { const idx = C.shuffle(q.codes.map((_, i) => i), r); pub.codes = idx.map((i) => q.codes[i]); key = idx.indexOf(0); pub.clueN = q.clues.length; break; }
    case "link": { const L = C.shuffle(q.pairs.map((_, i) => i), r), R = C.shuffle(q.pairs.map((_, i) => i), r); pub.left = L.map((i) => q.pairs[i][0]); pub.right = R.map((i) => q.pairs[i][1]); key = L.map((i) => R.indexOf(i)); break; }
    case "sort": { const idx = C.shuffle(q.items.map((_, i) => i), r); pub.bins = q.bins.slice(); pub.items = idx.map((i) => q.items[i][0]); key = idx.map((i) => q.items[i][1]); break; }
    case "catch": { const idx = C.shuffle(q.items.map((_, i) => i), r); pub.topic = q.topic; pub.items = idx.map((i) => q.items[i][0]); key = idx.map((i) => q.items[i][1]); break; }
  }
  return { pub, key, idx: null };
}

// ---------- 언어 (日本語 · English) ----------
// 번역(know-bank-i18n.js)이 있는 문항만 그 언어로 출제. 한국사·한국 전용(LOCAL) 문항은 일본어·영어에서 빠짐
// 원문을 관리자가 고치면(ver 올라감) 번역 v와 달라져 그 언어에서 자동으로 빠짐 → 다시 번역할 때까지
export const normLang = (l) => (l === "ja" || l === "en" ? l : "ko");
export function hasLang(q, L) {
  if (!q) return false; if (L === "ko") return true;
  const t = I18N[q.id]?.[L];
  return !!t && !LOCAL.has(q.id) && !(q.tags || []).includes("한국사") && (t.v ?? 1) === (q.ver ?? 1);
}
const locCache = { ja: new WeakMap(), en: new WeakMap() };
/** 문항을 그 언어 글자로 (배열 순서·정답은 원문과 같음). 번역 없으면 null */
export function localize(q, L) {
  if (!q || L === "ko") return q || null;
  if (!hasLang(q, L)) return null;
  let c = locCache[L].get(q); if (c) return c;
  const t = I18N[q.id][L];
  c = { ...q, q: t.q, exp: t.exp, fun: t.fun ?? null, sub: null,
    opts: t.opts ?? q.opts, clues: t.clues ?? q.clues, pairs: t.pairs ?? q.pairs,
    stmts: q.stmts && t.stmts ? q.stmts.map((s, i) => [t.stmts[i], s[1]]) : q.stmts,
    events: q.events && t.events ? q.events.map((e, i) => (t.yl?.[i] ? [t.events[i], e[1], t.yl[i]] : [t.events[i], e[1]])) : q.events,
    n: q.n && t.unit != null ? { ...q.n, unit: t.unit } : q.n,
    bins: t.bins ?? q.bins, topic: t.topic ?? q.topic, place: t.place ?? q.place,
    items: q.items && t.items ? q.items.map((x, i) => [t.items[i], x[1]]) : q.items };
  locCache[L].set(q, c); return c;
}
const poolCache = new Map();
/** 그 언어로 낼 수 있는 출제 문항 */
export function poolFor(L, pool = STORE.pool) {
  if (L === "ko") return pool;
  const k = `${L}:${bankVersion()}:${pool.length}`; let p = poolCache.get(k);
  if (!p || p.src !== pool) { p = pool.filter((q) => hasLang(q, L)); p.src = pool; poolCache.set(k, p); if (poolCache.size > 12) poolCache.delete(poolCache.keys().next().value); }
  return p;
}
const TXT = (p) => ({ q: p.q, opts: p.opts, events: p.events, stmts: p.stmts, left: p.left, right: p.right, unit: p.num?.unit, bins: p.bins, items: p.items, topic: p.topic });
/** 대결·퀴즈쇼: 같은 문제를 여러 언어 글자로 (pub.tr[언어]) — 정답 정보는 안 넣음 */
export function serveAll(q, seed) {
  const sv = serve(q, seed), tr = {};
  for (const L of ["ja", "en"]) { const lq = localize(q, L); if (lq) tr[L] = TXT(serve(lq, seed).pub); }
  sv.pub.tr = tr; sv.seed = seed; return sv;
}
export function revealAll(q, sv) {
  const rv = revealOf(q, sv), tr = {};
  for (const L of ["ja", "en"]) { const lq = localize(q, L); if (!lq) continue; const r2 = revealOf(lq, serve(lq, sv.seed)); tr[L] = { exp: r2.exp, clues: r2.clues, yearLabels: r2.yearLabels, place: r2.place }; }
  rv.tr = tr; return rv;
}
// 답한 뒤 공개: 정답·해설·근거
export function revealOf(q, served) {
  const out = { key: served.key, exp: q.exp, src: q.src.map((s) => ({ t: s.t, u: s.u })), checked: q.checked };
  if (q.kind === "order") { const ev = served.pub.events.map((t) => q.events.find((e) => e[0] === t)); out.years = ev.map((e) => e[1]); out.yearLabels = ev.map((e) => e[2] || null); }
  if (q.kind === "fake") out.truth = served.pub.stmts.map((t) => q.stmts.find((s) => s[0] === t)[1]);
  if (q.kind === "num") out.value = q.n.v;
  if (C.CLUE_KINDS.has(q.kind)) out.clues = q.clues;
  if (q.kind === "where") out.place = q.place;
  return out;
}
export function judgeServed(q, served, ans, st, at = Date.now()) {
  const lim = served.pub.lim, ms = Math.max(0, at - st.at);
  const timeout = ms > lim + NET_SLACK;
  const part = timeout || ans == null ? 0 : C.judge(q.kind, served.pub, ans, served.key, { stage: st.clues || 1 });
  const pub = served.pub, nOpts = (pub.bins || pub.opts || pub.codes || pub.stmts || []).length;
  return { id: q.id, game: q.game, kind: q.kind, area: q.area, d: q.d, part, c: Math.round(C.chanceOf(q.kind, nOpts) * 1000) / 1000, ms: Math.min(ms, lim), lim, timeout: timeout || ans == null, stage: C.CLUE_KINDS.has(q.kind) ? st.clues || 1 : undefined };
}
// 캐치: 서버가 기록한 「받기」 확정만 답으로 씀 (화면이 보낸 목록은 무시)
export const caughtOf = (st) => Object.entries(st.dec || {}).filter(([, v]) => v).map(([k]) => Number(k));
const sanitizeAns = (ans) => {
  if (ans == null) return null;
  if (typeof ans === "number" || typeof ans === "boolean") return ans;
  if (typeof ans === "string") return ans.slice(0, 20);
  if (Array.isArray(ans) && ans.length <= 16) return ans.map((v) => Number(v) | 0);
  return null;
};

// ---------- 결과 행 ----------
export function buildRow({ id, key, me, prof, prefs, mode, area, setKey, dev, plan, results, isPublic, avatarUrl, groupId, bcId, flagged }) {
  const diag = C.diagnose(results, { mode });
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    mode, area: area || null, set_key: setKey || null, core_ver: C.CORE_VERSION, bank_ver: bankVersion(), device: dev,
    plan: plan.map((p) => p.id), items: results, total: diag.total, lv: diag.level.lv, acc: diag.acc, correct: diag.correct, areas: diag.areas, type_id: diag.type.id, diag,
    is_public: isPublic !== false, flagged: !!flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer,
    group_id: groupId || null, bc_id: bcId || null, created_at: new Date().toISOString(),
  };
}
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, age: owner || row.show_age ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, area: row.area, setKey: row.set_key,
    coreVer: row.core_ver, bankVer: row.bank_ver, device: row.device, items: row.items, total: row.total, lv: row.lv, acc: row.acc, correct: row.correct, areas: row.areas, diag: row.diag,
    isPublic: row.is_public, flagged: row.flagged, groupId: row.group_id || null, bcId: row.bc_id || null, createdAt: row.created_at, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}
// 예전에 틀린 문항 (최근 30회 기록, 나중에 맞힌 건 뺌)
async function wrongIds(sb, key) {
  if (!sb) return [];
  try { const { data } = await sb.from("know_results").select("items").eq("owner_key", key).order("created_at", { ascending: false }).limit(30); const right = new Set(), wrong = []; for (const r of data || []) for (const it of r.items || []) { if (!it?.id) continue; if (it.part >= 1) right.add(it.id); else if (!wrong.includes(it.id)) wrong.push(it.id); } return wrong.filter((id) => !right.has(id)); } catch { return []; }
}
async function recentOf(sb, key) {
  let s = RECENT.get(key);
  if (!s) {
    s = [];
    if (sb) { try { const { data } = await sb.from("know_results").select("plan").eq("owner_key", key).order("created_at", { ascending: false }).limit(6); for (const r of data || []) s.push(...(r.plan || [])); } catch {} }
    RECENT.set(key, s = s.slice(0, RECENT_N)); if (RECENT.size > 20000) RECENT.delete(RECENT.keys().next().value);
  }
  return s;
}
const remember = (key, ids) => { const s = RECENT.get(key) || []; s.unshift(...ids); RECENT.set(key, s.slice(0, RECENT_N)); };

export function registerKnow(io, supabaseAdmin, app, { getOptionalUser, requireAdmin } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;
  if (sb) { loadDb(sb).then((r) => r.ok && console.log(`[know] 문제은행 DB ${r.n}개 반영, 출제 ${STORE.pool.length}문항`)); setInterval(() => flushStats(sb), 60 * 1000).unref?.(); }
  if (app && requireAdmin) registerKnowAdmin(app, sb, requireAdmin);

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.KNOW_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const planPub = (s) => s.adaptive ? Array.from({ length: s.n }, (_, i) => { const p = s.plan[i]; const q = p && BY_ID.get(p.id); return q ? { game: q.game, area: q.area, d: q.d } : { game: null, area: s.area, d: null }; }) : s.plan.map((p) => { const q = BY_ID.get(p.id); return { game: q.game, area: q.area, d: q.d }; });
    const QS = (s, i) => { const q = BY_ID.get(s.plan[i].id); return localize(q, s.lang) || q; }; // 그 세션 언어의 문항
    const servedOf = (s, i) => (s.served[i] ||= serve(QS(s, i), s.plan[i].seed));

    // mode: quick | full | area(+area) | daily | weak(+area, 난이도 조절) | retry(예전 오답)
    on("know:begin", async (p, reply) => {
      const mode = p.mode; if (!C.MODES.includes(mode)) return reply({ ok: false, error: "BAD_MODE" });
      const area = mode === "area" || mode === "weak" ? (C.AREAS.includes(p.area) ? p.area : null) : null;
      if (mode === "area" && !area) return reply({ ok: false, error: "BAD_AREA" });
      let setKey = null, seed = newSeed(), repeat = false, plan = [], adaptive = false, n = 0;
      const lang = normLang(p.lang), pool = poolFor(lang);
      if (mode === "daily") {
        setKey = C.dayKey(); seed = C.hashSeed(`daily:${setKey}:${C.CORE_VERSION}`);
        const k = `${key}|${setKey}`; if (DAILY_DONE.has(k)) repeat = true; else DAILY_DONE.set(k, Date.now());
      }
      try {
        if (mode === "weak") { adaptive = true; n = C.PRACTICE.weak.n; const have = pool.filter((q) => (!area || q.area === area) && q.game !== "final" && !C.isArcade(q)).length; if (have < n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: n, have, area }); }
        else if (mode === "arcade") {   // 상식 캐치! 아케이드: 캐치 문항만 (상식 점수와 따로 — 저장 안 함)
          const cs = pool.filter((q) => C.isArcade(q)); if (cs.length < C.PRACTICE.arcade.n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: C.PRACTICE.arcade.n, have: cs.length });
          plan = C.shuffle(cs, C.rng(seed)).slice(0, C.PRACTICE.arcade.n).map((q, i) => ({ id: q.id, seed: C.hashSeed(`${seed}:${i}:${q.id}`) }));
        } else if (mode === "retry") {
          const wrong = await wrongIds(sb, key), live = new Set(pool.map((q) => q.id));
          plan = C.shuffle(wrong.filter((id) => live.has(id)), C.rng(seed)).slice(0, C.PRACTICE.retry.n).map((id, i) => ({ id, seed: C.hashSeed(`${seed}:${i}`) }));
          if (!plan.length) throw new PlanError("NO_WRONG", { need: 1, have: 0 });
        } else if (mode === "daily") { const dk = lang === "ko" ? setKey : `${setKey}:${lang}`; plan = DAILY_PLAN.get(dk) || buildPlan("daily", seed, { pool }); DAILY_PLAN.set(dk, plan); } // 오늘의 세트는 언어마다 고정
        else plan = buildPlan(mode, seed, { area, pool, recent: new Set(await recentOf(sb, key)) });
      } catch (e) { return reply({ ok: false, error: e.message, detail: e.detail || null }); }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const id = "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const S = { key, lang, mode, area, setKey, repeat, adaptive, n: adaptive ? n : plan.length, seed, device: device(p.device), createdAt: Date.now(), plan, served: {}, st: {}, results: [], finished: null };
      SESS.set(id, S);
      if (mode !== "daily" && !adaptive) remember(key, plan.map((x) => x.id));
      reply({ ok: true, sid: id, mode, area, setKey, plan: planPub(S), coreVer: C.CORE_VERSION, bankVer: bankVersion() });
    });
    on("know:resume", (p, reply) => {
      const s = mySess(p.sid); if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" });
      reply({ ok: true, mode: s.mode, area: s.area, setKey: s.setKey, plan: planPub(s), idx: s.results.length, results: s.results.map((r) => ({ part: r.part, timeout: r.timeout })) });
    });
    // 문항 받기 — 순서대로만. 다시 받아도(새로고침) 시간은 처음 받은 때부터
    on("know:item", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (i !== s.results.length || i >= s.n) return reply({ ok: false, error: "BAD_IDX" });
      if (s.adaptive && !s.plan[i]) {
        const q0 = adaptivePick(poolFor(s.lang || "ko"), { area: s.area, results: s.results, used: new Set(s.plan.map((x) => x.id)), seed: s.seed + i * 7919 });
        if (!q0) return reply({ ok: false, error: "NOT_ENOUGH_ITEMS" });
        s.plan[i] = { id: q0.id, seed: C.hashSeed(`${s.seed}:${i}:${q0.id}`) }; remember(key, [q0.id]);
      }
      if (!s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      const sv = servedOf(s, i), q = QS(s, i);
      const st = s.st[i] ||= { at: Date.now(), clues: C.CLUE_KINDS.has(q.kind) ? 1 : 0 };
      const item = { ...sv.pub }; if (C.CLUE_KINDS.has(q.kind)) item.clues = q.clues.slice(0, st.clues);
      reply({ ok: true, idx: i, item, elapsed: Date.now() - st.at });
    });
    // 정체를 밝혀라: 다음 단서 (받을수록 점수 단계 내려감)
    on("know:clue", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, st = s.st[i], q = s.plan[i] && QS(s, i);
      if (!st || i !== s.results.length || !C.CLUE_KINDS.has(q.kind)) return reply({ ok: false, error: "BAD_IDX" });
      if (Date.now() - st.at > s.served[i].pub.lim + NET_SLACK) return reply({ ok: false, error: "TIME_UP" });
      st.clues = Math.min(q.clues.length, st.clues + 1);
      reply({ ok: true, clues: q.clues.slice(0, st.clues), stage: st.clues });
    });
    // 상식 캐치!: 떨어지는 것 하나마다 받기/놓치기를 먼저 확정 → 그다음에만 맞는지 알려 줌 (되돌릴 수 없음 = 미리 보기 불가)
    on("know:catch", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, st = s.st[i], q = s.plan[i] && QS(s, i);
      if (!st || i !== s.results.length || q.kind !== "catch") return reply({ ok: false, error: "BAD_IDX" });
      if (Date.now() - st.at > s.served[i].pub.lim + NET_SLACK) return reply({ ok: false, error: "TIME_UP" });
      const k = p.k | 0, key = s.served[i].key; if (k < 0 || k >= key.length) return reply({ ok: false, error: "BAD_IDX" });
      st.dec ||= {}; if (st.dec[k] == null) st.dec[k] = !!p.take;
      reply({ ok: true, k, take: st.dec[k], truth: key[k] });
    });
    // 답 제출 — 한 문항에 한 번만 (두 번째는 처음 결과를 그대로 돌려줌)
    on("know:answer", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (s.results[i]) { const q = QS(s, i); return reply({ ok: true, dup: true, res: s.results[i], reveal: revealOf(q, s.served[i]) }); }
      const st = s.st[i]; if (!st || i !== s.results.length) return reply({ ok: false, error: "BAD_IDX" });
      const q = QS(s, i), sv = s.served[i];
      const res = judgeServed(q, sv, q.kind === "catch" && st.dec ? caughtOf(st) : sanitizeAns(p.answer), st);
      s.results[i] = res; countUse(res);
      reply({ ok: true, res, reveal: revealOf(q, sv), streak: (() => { let c = 0; for (let k = s.results.length - 1; k >= 0 && s.results[k].part >= 1; k--) c++; return c; })() });
    });
    on("know:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.results.length < s.n) return reply({ ok: false, error: "NOT_COMPLETE" });
      if (s.mode === "arcade") {   // 아케이드 점수: 상식 레벨·랭킹·기록과 완전히 분리 (DB 저장 없음)
        const pts = s.results.reduce((a, r) => a + C.battlePoints(r.part, r.d, r.game, r.ms, r.lim), 0);
        s.finished = { id: null, arcade: { score: pts, perfect: s.results.filter((r) => r.part >= 1).length, n: s.n, items: s.results.map((r) => ({ id: r.id, part: r.part })) } };
        return reply({ ok: true, ...s.finished });
      }
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      let repeat = s.repeat;
      if (s.mode === "daily" && sb && !repeat) { try { const { count } = await sb.from("know_results").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("mode", "daily").eq("set_key", s.setKey); if (count) repeat = true; } catch {} }
      const row = buildRow({ id: resultId(), key, me, prof, prefs, mode: s.mode, area: s.area, setKey: s.setKey, dev: s.device, plan: s.plan, results: s.results, isPublic: p.isPublic !== false, avatarUrl: mp?.avatar_url, flagged: repeat || !!C.PRACTICE[s.mode] });
      if (repeat) row.diag.repeat = true;
      if (C.PRACTICE[s.mode]) { row.diag.practice = s.mode; row.mode = "weak"; }
      let saved = null;
      if (sb) { const { error } = await sb.from("know_results").insert(row); if (error) console.error("[know] save", error.message); else saved = row.id; }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), repeat };
      reply({ ok: true, ...s.finished });
    });
    on("know:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("know_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "").slice(0, 16)).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("know:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("know_results").select("id, mode, area, set_key, device, total, lv, acc, correct, areas, type_id, is_public, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
      reply({ ok: true, rows: data || [] });
    });
    // 상식 도감: 내가 푼 문항 id·정답 여부 모음 (분야별 성취도)
    on("know:dex", async (_p, reply) => {
      if (!sb) return reply({ ok: true, seen: {}, total: dexPool().length, byArea: countByArea() });
      const { data } = await sb.from("know_results").select("items").eq("owner_key", key).order("created_at", { ascending: false }).limit(200);
      const seen = {};
      for (const r of data || []) for (const it of r.items || []) if (it?.id && BY_ID.has(it.id)) seen[it.id] = Math.max(seen[it.id] ?? 0, it.part >= 1 ? 2 : 1);
      const mine = {}; for (const [id, v] of Object.entries(seen)) { const a = BY_ID.get(id).area; const m = (mine[a] ||= { seen: 0, got: 0 }); m.seen++; if (v === 2) m.got++; }
      reply({ ok: true, seen, mine, total: dexPool().length, byArea: countByArea() });
    });
    // 오류 신고: 이 사람이 실제로 받은 문항만 (아무 id나 신고 못 하게), 10분 8회
    on("know:report", async (p, reply) => {
      const qid = String(p.qid || "").slice(0, 8), reason = String(p.reason || "");
      if (!["wrong_answer", "ambiguous", "outdated", "typo", "offensive", "other"].includes(reason)) return reply({ ok: false, error: "BAD_REASON" });
      const seenIt = [...SESS.values()].some((x) => x.key === key && Object.values(x.served).some((v) => v.pub.id === qid)) || (RECENT.get(key) || []).includes(qid);
      if (!seenIt) return reply({ ok: false, error: "NOT_SEEN" });
      const c = (REPORTED.get(key) || 0) + 1; REPORTED.set(key, c); if (c > 8) return reply({ ok: false, error: "RATE_LIMITED" });
      if (!sb) return reply({ ok: true });
      const { error } = await sb.from("know_reports").insert({ question_id: qid, owner_key: key, status: "open", reason, note: p.note ? String(p.note).replace(/[<>]/g, "").slice(0, 300) : null });
      reply(error ? (String(error.code) === "23505" ? { ok: true, dup: true } : { ok: false, error: "SAVE_FAIL" }) : { ok: true });
    });
    on("know:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const gid = String(p.guestId || ""); if (!/^guest_[a-z0-9]{6,40}$/.test(gid)) return reply({ ok: false, error: "BAD_GUEST" });
      const mp = await memberProfile(sb, me);
      const { data: moved, error } = await sb.from("know_results").update({ owner_key: key, user_id: me.id, ...(mp?.nickname ? { nickname: String(mp.nickname).slice(0, 12) } : {}) }).eq("owner_key", `g:${gid}`).select("id");
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true, moved: moved?.length || 0 });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/know/result/:id", async (req, res) => {
    try {
      const { data: row, error } = await sb.from("know_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      res.json({ ok: true, result: publicRow(row, { owner: mine }) });
    } catch (e) { console.error("[know/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 오답 복습: 내 기록이거나 공개 기록. 오늘의 챌린지는 그날이 지나기 전엔 남에게 정답 안 보여 줌
  app.get("/know/review/:id", async (req, res) => {
    try {
      const { data: row } = await sb.from("know_results").select("id, owner_key, is_public, plan, items, mode, set_key").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!mine && !row.is_public) return res.status(403).json({ ok: false, error: "PRIVATE" });
      if (!mine && row.mode === "daily" && row.set_key === C.dayKey()) return res.status(403).json({ ok: false, error: "SPOILER" });
      const RL = normLang(String(req.query.lang || "")); // 복습 화면 언어 (번역 없는 문항은 한국어)
      const items = (row.plan || []).map((id, i) => { const q0 = BY_ID.get(id); if (!q0) return null; const q = localize(q0, RL) || q0; const sv = serve(q, 1); return { ...sv.pub, reveal: revealOf(q, sv), res: row.items?.[i] || null }; }).filter(Boolean);
      res.json({ ok: true, items, mine });
    } catch (e) { console.error("[know/review]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/know/info", (_req, res) => res.json({ ok: true, day: C.dayKey(), coreVer: C.CORE_VERSION, bankVer: bankVersion(), pool: STORE.pool.length, byArea: countByArea() }));

  // 랭킹: mode=quick|full|area|daily · period=day|week|all · area(분야별) · board=total|streamer
  const rankCache = new Map();
  app.get("/know/ranking", async (req, res) => {
    try {
      const mode = C.PLANS[req.query.mode] ? req.query.mode : "full";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const board = ["total", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const area = mode === "area" ? (C.AREAS.includes(req.query.area) ? req.query.area : "history") : null;
      const setKey = mode === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.dayKey()) : null;
      const ck = JSON.stringify([mode, period, board, area, setKey]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("know_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, total, lv, acc, correct, type_id, is_streamer, created_at").eq("mode", mode).eq("core_ver", C.CORE_VERSION).eq("is_public", true).eq("flagged", false);
      if (area) q = q.eq("area", area);
      if (setKey) q = q.eq("set_key", setKey);
      if (board === "streamer") q = q.eq("is_streamer", true);
      const since = period === "day" ? Date.now() - 864e5 : period === "week" ? Date.now() - 7 * 864e5 : null;
      if (since && !setKey) q = q.gte("created_at", new Date(since).toISOString());
      const { data, error } = await q.order("total", { ascending: false }).order("created_at", { ascending: true }).limit(500);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, lv: r.lv, acc: r.acc, correct: r.correct, type: C.TYPE_BY_ID[r.type_id]?.ko || null, isGuest: !r.user_id, streamer: !!r.is_streamer, at: r.created_at }); if (rows.length >= 50) break; }
      const body = { ok: true, mode, period, board, area, setKey, coreVer: C.CORE_VERSION, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[know/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
// 도감: 아케이드(상식 캐치!) 문항은 기록이 안 남으므로 도감 총수에서 뺌
const dexPool = () => STORE.pool.filter((q) => !C.isArcade(q));
function countByArea() { const o = {}; for (const q of dexPool()) o[q.area] = (o[q.area] || 0) + 1; return o; }
export const _knowTest = { SESS, BY_ID, RECENT };
