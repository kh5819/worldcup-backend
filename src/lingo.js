// =========================
// 플듀 언어 진단소 — 혼자 검사 서버 (lingo:* 소켓 + /lingo/* REST)
// 상식 진단소(know.js) 흐름 그대로: 문항은 한 개씩만(정답 없이) → 답을 받으면 서버가 채점·시간 측정 → 그때 해설 공개
// 보기·조각 순서는 세션마다 서버가 섞음 → 화면 코드만 봐서는 정답을 알 수 없음
// 검사 언어(lang: ko/ja/en)와 난이도(normal/hard/expert)는 세션마다 고정, 랭킹도 언어 × 난이도 × 모드로 따로
// DB: lingo_results (sql/lingo_tables.sql, RLS 켬·정책 0 = 서버 전용) — 테이블이 없으면 검사는 되고 저장만 실패(SAVE_FAIL 표시)
// =========================
import * as C from "./lingo-core.js";
import { BANK } from "./lingo-bank.js";
import { validateItem, LIVE_STATUS, contentText, gramSet, jaccard } from "./lingo-validate.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, userKey, device, resultId } from "./iq.js";

// ---------- 출제 목록 (검수 상태 checked/approved + 자동 검사 오류 0) ----------
export const STORE = { all: new Map(), pool: [], invalid: [] };
for (const q of BANK) STORE.all.set(q.id, q);
(function rebuild() {
  for (const q of STORE.all.values()) { if (!LIVE_STATUS.has(q.status)) continue; const v = validateItem(q); if (v.errors.length) STORE.invalid.push({ id: q.id, errors: v.errors }); else STORE.pool.push(q); }
  if (STORE.invalid.length) console.warn(`[lingo] 형식 오류로 뺀 문항 ${STORE.invalid.length}개`, STORE.invalid.slice(0, 5));
})();
export const bankVersion = () => `${C.CORE_VERSION}.${STORE.pool.length}`;
const BY_ID = { get: (id) => STORE.all.get(id), has: (id) => STORE.all.has(id) };
export const poolOf = (lang) => STORE.pool.filter((q) => q.lang === lang);

const SESS = new Map();
const SESS_TTL = 2 * 60 * 60 * 1000, MAX_SESS = 4, NET_SLACK = 2500;
const RECENT = new Map(), RECENT_N = 200;   // 사람 → 최근 나온 문항 id (반복 플레이 때 같은 문제 줄이기)
const REPORTED = new Map();
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const sweep = () => { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); REPORTED.clear(); };

// ---------- 출제 ----------
export class PlanError extends Error { constructor(code, detail) { super(code); this.detail = detail; } }
const gramCache = new WeakMap();
const gramsOf = (q) => { let g = gramCache.get(q); if (!g) { g = gramSet(contentText(q)); gramCache.set(q, g); } return g; };
// 점수가 낮을수록 먼저: 난이도 대역(밖이면 큰 벌점) · 최근 본 문제 · 비슷한 문제
export function buildPlan(mode, seed, { area = null, diff = "normal", lang = "ko", recent = null, pool = poolOf(lang) } = {}) {
  const P = C.PLANS[mode] || C.PRACTICE[mode]; if (!P) throw new PlanError("BAD_MODE");
  const r = C.rng(seed), n = C.planN(mode, area), need = C.diffNeed(diff, n), used = new Set(), out = [];
  const seen = recent || new Set(), pen = new Map();
  const pick = (cands) => {
    if (!cands.length) return null;
    let best = null, bs = Infinity;
    for (const q of cands) {
      const inB = C.inBand(diff, q.d);
      let s = (inB ? (need[q.d] > 0 ? 0 : 3) : 14 + Math.abs(q.d - (diff === "normal" ? 1.5 : diff === "hard" ? 2.5 : 3.5)) * 4) + (seen.has(q.id) ? 6 : 0) + r() * 3 + (pen.get(q.id) || 0);
      if (s < bs) { bs = s; best = q; }
    }
    used.add(best.id); if (need[best.d] > 0) need[best.d]--; out.push(best);
    const bg = gramsOf(best);
    for (const q of pool) { if (used.has(q.id)) continue; if (jaccard(gramsOf(q), bg) > 0.5) pen.set(q.id, (pen.get(q.id) || 0) + 20); }
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
    for (const [g, k] of Object.entries(P.games)) for (let i = 0; i < k; i++) pick(avail((q) => q.area === g)) || pick(avail((q) => q.area !== "typing"));
    if (out.length < n) throw new PlanError("NOT_ENOUGH_ITEMS", { need: n, have: out.length });
  }
  // 섞되 같은 검사 3연속 피하고 타자는 끝 쪽에
  const typ = out.filter((q) => q.area === "typing"), rest = C.shuffle(out.filter((q) => q.area !== "typing"), r);
  for (let pass = 0; pass < 3; pass++) for (let i = 2; i < rest.length; i++) {
    if (!(rest[i].area === rest[i - 1].area && rest[i].area === rest[i - 2].area)) continue;
    const j = rest.findIndex((q, k) => k > i && q.area !== rest[i].area); if (j > 0) [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...rest, ...typ].map((q, i) => ({ id: q.id, seed: C.hashSeed(`${seed}:${i}:${q.id}`) >>> 0 }));
}

// 문항 → 내줄 화면 정보 + 서버만 아는 정답 키. seed로 보기·조각 순서 섞음. limK: 스피드 진단은 제한시간을 줄임
export function serve(q, seed, limK = 1) {
  const r = C.rng(seed);
  const pub = { id: q.id, game: q.area, kind: q.kind, area: q.area, d: q.d, q: q.q, lang: q.lang, lim: Math.round(C.limitOf(q.area, q.d, q.kind) * limK) };
  let key;
  switch (q.kind) {
    case "mcq": case "reveal": { const idx = C.shuffle(q.opts.map((_, i) => i), r); pub.opts = idx.map((i) => q.opts[i]); key = idx.indexOf(0); if (q.kind === "reveal") pub.clueN = q.clues.length; break; }
    case "ox": key = !!q.ans; break;
    case "order": { const idx = C.shuffle(q.parts.map((_, i) => i), r); if (idx.every((v, i) => v === i)) idx.reverse(); pub.parts = idx.map((i) => q.parts[i]); key = q.parts.map((_, orig) => idx.indexOf(orig)); break; }
    case "spot": pub.tokens = q.tokens.slice(); key = q.wrong; break;
    case "type": pub.text = q.text; key = { text: q.text, lang: q.lang }; break;
    case "link": { const L = C.shuffle(q.pairs.map((_, i) => i), r), R = C.shuffle(q.pairs.map((_, i) => i), r); pub.left = L.map((i) => q.pairs[i][0]); pub.right = R.map((i) => q.pairs[i][1]); key = L.map((i) => R.indexOf(i)); break; }
    case "sort": { const idx = C.shuffle(q.items.map((_, i) => i), r); pub.bins = q.bins.slice(); pub.items = idx.map((i) => q.items[i][0]); key = idx.map((i) => q.items[i][1]); break; }
    case "catch": { const idx = C.shuffle(q.items.map((_, i) => i), r); pub.topic = q.topic; pub.items = idx.map((i) => q.items[i][0]); key = idx.map((i) => q.items[i][1]); break; }
  }
  return { pub, key };
}
// 답한 뒤 공개: 정답·해설·근거 (+ 오류 찾기 고친 말, 타자 측정값)
export function revealOf(q, served) {
  const out = { key: served.key, exp: q.exp, src: q.src.map((s) => ({ t: s.t, u: s.u })), checked: q.checked, expert: !!q.expert, asOf: q.asOf || null };
  if (q.kind === "spot") out.fix = q.fix;
  if (q.kind === "order") out.sentence = q.parts.join(" ");
  if (q.kind === "type") out.key = null;
  if (C.CLUE_KINDS.has(q.kind)) out.clues = q.clues;
  return out;
}
export function judgeServed(q, served, ans, st, at = Date.now()) {
  const lim = served.pub.lim, ms = Math.max(0, at - st.at);
  const timeout = ms > lim + NET_SLACK;
  let part = 0, ty = null;
  if (!timeout && ans != null) {
    if (q.kind === "type") { ty = C.typeScore(q.text, typeof ans === "string" ? ans : "", ms, q.lang); part = ty.part; }
    else part = C.judge(q.kind, served.pub, ans, served.key, { stage: st.clues || 1, ms });
  }
  const pub = served.pub, nOpts = (pub.bins || pub.opts || pub.tokens || []).length;
  const res = { id: q.id, game: q.area, kind: q.kind, area: q.area, d: q.d, part, c: Math.round(C.chanceOf(q.kind, nOpts) * 1000) / 1000, ms: Math.min(ms, lim), lim, timeout: timeout || ans == null };
  if (ty) { res.cpm = ty.cpm; res.tacc = ty.acc; if (ty.bot) res.bot = true; }
  return res;
}
const sanitizeAns = (ans, kind) => {
  if (ans == null) return null;
  if (kind === "type") return typeof ans === "string" ? ans.normalize("NFC").slice(0, 200) : null;
  if (typeof ans === "number" || typeof ans === "boolean") return ans;
  if (typeof ans === "string") return ans.slice(0, 20);
  if (Array.isArray(ans) && ans.length <= 16) return ans.map((v) => Number(v) | 0);
  return null;
};

// ---------- 결과 행 ----------
export function buildRow({ id, key, me, prof, prefs, s, isPublic, avatarUrl, flagged }) {
  const diag = C.diagnose(s.results, { mode: s.mode, diff: s.diff, lang: s.lang });
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    lang: s.lang, diff: s.diff, mode: s.mode, area: s.area || null, core_ver: C.CORE_VERSION, bank_ver: bankVersion(), device: s.device, challenge_of: s.challengeOf || null,
    plan: s.plan.map((p) => p.id), items: s.results, total: diag.total, grade: diag.grade.id, acc: diag.acc, correct: diag.correct, areas: diag.areas, type_id: diag.type.id, diag,
    is_public: isPublic !== false, flagged: !!flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer, created_at: new Date().toISOString(),
  };
}
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, age: owner || row.show_age ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null,
    lang: row.lang, diff: row.diff, mode: row.mode, area: row.area, coreVer: row.core_ver, bankVer: row.bank_ver, device: row.device, challengeOf: row.challenge_of || null,
    items: row.items, total: row.total, grade: row.grade, acc: row.acc, correct: row.correct, areas: row.areas, diag: row.diag,
    isPublic: row.is_public, flagged: row.flagged, createdAt: row.created_at, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}
async function wrongIds(sb, key, lang) {
  if (!sb) return [];
  try { const { data } = await sb.from("lingo_results").select("items").eq("owner_key", key).eq("lang", lang).order("created_at", { ascending: false }).limit(30); const right = new Set(), wrong = []; for (const r of data || []) for (const it of r.items || []) { if (!it?.id) continue; if (it.part >= 1) right.add(it.id); else if (!wrong.includes(it.id)) wrong.push(it.id); } return wrong.filter((id) => !right.has(id)); } catch { return []; }
}
async function recentOf(sb, key) {
  let s = RECENT.get(key);
  if (!s) {
    s = [];
    if (sb) { try { const { data } = await sb.from("lingo_results").select("plan").eq("owner_key", key).order("created_at", { ascending: false }).limit(6); for (const r of data || []) s.push(...(r.plan || [])); } catch {} }
    RECENT.set(key, s = s.slice(0, RECENT_N)); if (RECENT.size > 20000) RECENT.delete(RECENT.keys().next().value);
  }
  return s;
}
const remember = (key, ids) => { const s = RECENT.get(key) || []; s.unshift(...ids); RECENT.set(key, s.slice(0, RECENT_N)); };

export function registerLingo(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;
  console.log(`[lingo] 언어 진단소 출제 ${STORE.pool.length}문항 (${C.LANGS.map((l) => `${l} ${poolOf(l).length}`).join(" · ")})`);

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.LINGO_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const planPub = (s) => s.plan.map((p) => { const q = BY_ID.get(p.id); return { game: q.area, area: q.area, d: q.d }; });
    const servedOf = (s, i) => (s.served[i] ||= serve(BY_ID.get(s.plan[i].id), s.plan[i].seed, s.limK));

    // mode: full | speed | area(+area) | mix | retry · lang: ko/ja/en · diff: normal/hard/expert · challenge: 친구 기록 id(같은 문제로 도전)
    on("lingo:begin", async (p, reply) => {
      const mode = p.mode; if (!C.MODES.includes(mode)) return reply({ ok: false, error: "BAD_MODE" });
      const lang = C.normQLang(p.lang), diff = C.normDiff(p.diff);
      const area = mode === "area" ? (C.AREAS.includes(p.area) ? p.area : null) : null;
      if (mode === "area" && !area) return reply({ ok: false, error: "BAD_AREA" });
      let seed = newSeed(), plan = [], challengeOf = null;
      try {
        if (p.challenge && sb) {   // 친구 기록 도전: 그 기록과 같은 문항·같은 순서 (언어·난이도·모드도 그대로)
          const { data: row } = await sb.from("lingo_results").select("id, plan, lang, diff, mode, area, is_public").eq("id", String(p.challenge).slice(0, 16)).maybeSingle();
          if (!row || !row.is_public) throw new PlanError("NO_CHALLENGE");
          plan = (row.plan || []).filter((id) => BY_ID.has(id) && STORE.pool.includes(BY_ID.get(id))).map((id, i) => ({ id, seed: C.hashSeed(`ch:${row.id}:${i}`) }));
          if (plan.length < Math.min(5, (row.plan || []).length)) throw new PlanError("NO_CHALLENGE");
          challengeOf = row.id; Object.assign(p, { lang: row.lang, diff: row.diff });
          return start({ mode: row.mode, lang: row.lang, diff: row.diff, area: row.area, plan, challengeOf });
        }
        if (mode === "retry") {
          const wrong = await wrongIds(sb, key, lang), live = new Set(poolOf(lang).map((q) => q.id));
          plan = C.shuffle(wrong.filter((id) => live.has(id)), C.rng(seed)).slice(0, C.PRACTICE.retry.n).map((id, i) => ({ id, seed: C.hashSeed(`${seed}:${i}`) }));
          if (!plan.length) throw new PlanError("NO_WRONG", { need: 1, have: 0 });
        } else plan = buildPlan(mode, seed, { area, diff, lang, recent: new Set(await recentOf(sb, key)) });
      } catch (e) { return reply({ ok: false, error: e.message, detail: e.detail || null }); }
      return start({ mode, lang, diff, area, plan, challengeOf });

      function start({ mode, lang, diff, area, plan, challengeOf }) {
        const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
        while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
        const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const S = { key, lang, diff, mode, area, challengeOf, limK: C.PLANS[mode]?.limK || 1, n: plan.length, device: device(p.device), createdAt: Date.now(), plan, served: {}, st: {}, results: [], finished: null };
        SESS.set(id, S); remember(key, plan.map((x) => x.id));
        reply({ ok: true, sid: id, mode, lang, diff, area, challengeOf, plan: planPub(S), coreVer: C.CORE_VERSION, bankVer: bankVersion() });
      }
    });
    // 문항 받기 — 순서대로만. 다시 받아도(새로고침) 시간은 처음 받은 때부터
    on("lingo:item", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (i !== s.results.length || i >= s.n || !s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      const sv = servedOf(s, i), q = BY_ID.get(s.plan[i].id);
      const st = s.st[i] ||= { at: Date.now(), clues: C.CLUE_KINDS.has(q.kind) ? 1 : 0 };
      const item = { ...sv.pub }; if (C.CLUE_KINDS.has(q.kind)) item.clues = q.clues.slice(0, st.clues);
      reply({ ok: true, idx: i, item, elapsed: Date.now() - st.at });
    });
    on("lingo:clue", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, st = s.st[i], q = s.plan[i] && BY_ID.get(s.plan[i].id);
      if (!st || i !== s.results.length || !C.CLUE_KINDS.has(q.kind)) return reply({ ok: false, error: "BAD_IDX" });
      if (Date.now() - st.at > s.served[i].pub.lim + NET_SLACK) return reply({ ok: false, error: "TIME_UP" });
      st.clues = Math.min(q.clues.length, st.clues + 1);
      reply({ ok: true, clues: q.clues.slice(0, st.clues), stage: st.clues });
    });
    // 답 제출 — 한 문항에 한 번만 (두 번째는 처음 결과를 그대로 돌려줌 = 중복 제출 무시)
    on("lingo:answer", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (s.results[i]) { const q = BY_ID.get(s.plan[i].id); return reply({ ok: true, dup: true, res: s.results[i], reveal: revealOf(q, s.served[i]) }); }
      const st = s.st[i]; if (!st || i !== s.results.length) return reply({ ok: false, error: "BAD_IDX" });
      const q = BY_ID.get(s.plan[i].id), sv = s.served[i];
      const res = judgeServed(q, sv, sanitizeAns(p.answer, q.kind), st);
      s.results[i] = res;
      reply({ ok: true, res, reveal: revealOf(q, sv) });
    });
    on("lingo:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.results.length < s.n) return reply({ ok: false, error: "NOT_COMPLETE" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      const row = buildRow({ id: resultId(), key, me, prof, prefs, s, isPublic: p.isPublic !== false, avatarUrl: mp?.avatar_url, flagged: !!C.PRACTICE[s.mode] || !!s.challengeOf });
      if (C.PRACTICE[s.mode]) row.diag.practice = s.mode;
      // 친구 기록 도전은 공개 기록과 같은 문제(다시 보기로 정답을 볼 수 있음) → 공식 랭킹 제외, 친구와 비교만
      if (s.challengeOf) row.diag.unranked = "challenge";
      let saved = null, saveError = null;
      if (sb) { const { error } = await sb.from("lingo_results").insert(row); if (error) { console.error("[lingo] save", error.message); saveError = "SAVE_FAIL"; } else { saved = row.id; rankCache.clear(); } }   // 방금 기록이 랭킹에 바로 보이게
      // 스트리머가 쓴 기록 → admin 📺 스트리머 탭에 "언어"로 (접수에서 '📺 스트리머예요' 체크한 경우만, 저장된 결과 1건당 1줄)
      if (saved && prefs.streamer && sb) {
        const title = `언어 진단소 · ${C.LANG[s.lang].lab} · ${C.modeName(s.mode)}${s.mode === "area" && s.area ? ` · ${C.GAMES[s.area].ko}` : ""} · ${C.DIFFS[s.diff].ko} · ${row.total}점 ${row.grade}`;
        sb.from("streamer_chat_log").insert({ platform: "lingo", channel_id: saved, nickname: prof.nick, content_id: null, content_title: title, content_mode: s.mode, room_code: saved, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error: le }) => { if (le) console.error("[lingo] streamer log", le.message); }, () => {});
      }
      // 이전 결과와 비교 (같은 언어·난이도·모드의 내 최고 점수)
      let prevBest = null;
      if (sb && saved) { try {
        let q0 = sb.from("lingo_results").select("total").eq("owner_key", key).eq("lang", s.lang).eq("diff", s.diff).eq("mode", s.mode).eq("flagged", false).neq("id", saved);
        if (s.mode === "area") q0 = q0.eq("area", s.area);   // 개별 검사는 같은 검사끼리만 비교
        const { data } = await q0.order("total", { ascending: false }).limit(1); prevBest = data?.[0]?.total ?? null;
      } catch {} }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prevBest, saveError };
      reply({ ok: true, ...s.finished });
    });
    on("lingo:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("lingo_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "").slice(0, 16)).eq("owner_key", key);
      if (!error) rankCache.clear();
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("lingo:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("lingo_results").select("id, lang, diff, mode, area, total, grade, acc, correct, areas, type_id, is_public, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(60);
      reply({ ok: true, rows: data || [] });
    });
    // 오류 신고: 이 사람이 실제로 받은 문항만, 10분 8회
    on("lingo:report", async (p, reply) => {
      const qid = String(p.qid || "").slice(0, 8), reason = String(p.reason || "");
      if (!["wrong_answer", "ambiguous", "outdated", "typo", "unnatural", "other"].includes(reason)) return reply({ ok: false, error: "BAD_REASON" });
      const seenIt = [...SESS.values()].some((x) => x.key === key && Object.values(x.served).some((v) => v.pub.id === qid)) || (RECENT.get(key) || []).includes(qid);
      if (!seenIt) return reply({ ok: false, error: "NOT_SEEN" });
      const c = (REPORTED.get(key) || 0) + 1; REPORTED.set(key, c); if (c > 8) return reply({ ok: false, error: "RATE_LIMITED" });
      if (!sb) return reply({ ok: true });
      const { error } = await sb.from("lingo_reports").insert({ question_id: qid, owner_key: key, status: "open", reason, note: p.note ? String(p.note).replace(/[<>]/g, "").slice(0, 300) : null });
      reply(error ? (String(error.code) === "23505" ? { ok: true, dup: true } : { ok: false, error: "SAVE_FAIL" }) : { ok: true });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/lingo/result/:id", async (req, res) => {
    try {
      if (!sb) return res.status(503).json({ ok: false, error: "NO_DB" });
      const { data: row, error } = await sb.from("lingo_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      res.json({ ok: true, result: publicRow(row, { owner: mine }) });
    } catch (e) { console.error("[lingo/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 복습: 내 기록이거나 공개 기록
  app.get("/lingo/review/:id", async (req, res) => {
    try {
      if (!sb) return res.status(503).json({ ok: false, error: "NO_DB" });
      const { data: row } = await sb.from("lingo_results").select("id, owner_key, is_public, plan, items").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!mine && !row.is_public) return res.status(403).json({ ok: false, error: "PRIVATE" });
      const items = (row.plan || []).map((id, i) => { const q = BY_ID.get(id); if (!q) return null; const sv = serve(q, 1); return { ...sv.pub, reveal: { ...revealOf(q, sv), key: sv.key?.text ? null : sv.key }, res: row.items?.[i] || null }; }).filter(Boolean);
      res.json({ ok: true, items, mine });
    } catch (e) { console.error("[lingo/review]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/lingo/info", (_req, res) => {
    const by = {}; for (const l of C.LANGS) { const p = poolOf(l); by[l] = { n: p.length, areas: Object.fromEntries(C.AREAS.map((a) => [a, p.filter((q) => q.area === a).length])) }; }
    res.json({ ok: true, coreVer: C.CORE_VERSION, bankVer: bankVersion(), langs: by });
  });
  // 랭킹: 언어 × 난이도 × 모드(full|speed|area|mix) · area(개별 검사) · period=day|week|all · board=total|streamer
  const rankCache = new Map();
  app.get("/lingo/ranking", async (req, res) => {
    try {
      if (!sb) return res.json({ ok: true, rows: [] });
      const lang = C.normQLang(req.query.lang), diff = C.normDiff(req.query.diff);
      const mode = C.PLANS[req.query.mode] ? req.query.mode : "full";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const board = ["total", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const area = mode === "area" ? (C.AREAS.includes(req.query.area) ? req.query.area : "spell") : null;
      const ck = JSON.stringify([lang, diff, mode, period, board, area]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("lingo_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, total, grade, acc, correct, type_id, is_streamer, created_at").eq("lang", lang).eq("diff", diff).eq("mode", mode).eq("is_public", true).eq("flagged", false);
      if (area) q = q.eq("area", area);
      if (board === "streamer") q = q.eq("is_streamer", true);
      const since = period === "day" ? Date.now() - 864e5 : period === "week" ? Date.now() - 7 * 864e5 : null;
      if (since) q = q.gte("created_at", new Date(since).toISOString());
      const { data, error } = await q.order("total", { ascending: false }).order("created_at", { ascending: true }).limit(1000);   // 한 사람이 여러 번 해도 1인 1줄(아래 owner_key 중복 제거)
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, grade: r.grade, acc: r.acc, correct: r.correct, type: C.TYPE_BY_ID[r.type_id]?.ko || null, isGuest: !r.user_id, streamer: !!r.is_streamer, at: r.created_at }); if (rows.length >= 50) break; }
      const body = { ok: true, lang, diff, mode, period, board, area, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[lingo/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _lingoTest = { SESS, BY_ID, RECENT, STORE };
