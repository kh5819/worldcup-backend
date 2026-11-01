// =========================
// 플듀 IQ 테스트 진단소 — 혼자 검사 서버 (iq:* 소켓 + /iq/* REST)
// 문제는 한 문항씩 서버가 내줌(정답 없는 화면 정보만) → 답을 받으면 서버가 채점·시간 측정 → 해설 공개
// DB: iq_results / iq_profiles / iq_groups (sql/iq_tables.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./iq-core.js?v=c2";
import * as G from "./iq-gen.js?v=g2";
import { SLIDE_BANK } from "./iq-bank.js";
import { bcOnBegin, bcOnFinish, bcPlay, bcPlayEnd } from "./iq-broadcast.js";

G.setSlideBank(SLIDE_BANK);

const SESS = new Map();
const SESS_TTL = 2 * 60 * 60 * 1000;
const MAX_SESS_PER_USER = 4;
const NET_SLACK = 2500;           // 제한시간 + 네트워크 여유
const ITEM_CACHE = new Map();     // seed:type:d → 생성된 문항 (같은 오늘의 챌린지 등 재사용)
const SET_STARTS = new Map();     // 사람|모드|세트 → 처음 시작한 시각 (챌린지 미리 보고 다시 시작해 순위 올리기 방지)

export const device = (d) => (d === "mobile" ? "mobile" : "pc");
export function resultId() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
export function makeItem(p) {
  const k = `${p.seed}:${p.type}:${p.d}`;
  let it = ITEM_CACHE.get(k);
  if (!it) { it = G.gen(p.type, p.d, p.seed); ITEM_CACHE.set(k, it); if (ITEM_CACHE.size > 4000) ITEM_CACHE.delete(ITEM_CACHE.keys().next().value); }
  return it;
}
// 힌트 글자 재료 (정답 그 자체는 주지 않음)
export function hintFor(it) { return { type: it.type, d: it.d, hint: it.hint }; }

/** 한 문항 채점 — 서버 시각 기준. st: {at 시작시각, act 상태, hint} */
export function judgeItem(it, ans, st, at = Date.now()) {
  const ms = Math.max(0, at - st.at);
  const timeout = ms > it.lim + NET_SLACK;
  const r = timeout || ans == null ? { ok: false, part: 0 } : G.check(it, ans, st.act || {});
  return { type: it.type, d: it.d, area: it.area, ok: !!r.ok, part: r.ok ? 1 : r.part || 0, ms: Math.min(ms, it.lim), lim: it.lim, hint: !!st.hint, timeout: timeout || ans == null };
}
export function pointsOf(res) { return Math.round(C.itemPoints(res.d, res) * 100) / 100; }

export function userKey(me) { return me.isGuest ? `g:${me.id}` : `u:${me.id}`; }
function sweep() { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); }

// 회원 프로필(플레이듀오 profiles) — 읽기만
const memberCache = new Map();
export async function memberProfile(sb, me) {
  if (!sb || me.isGuest) return null;
  const c = memberCache.get(me.id);
  if (c && Date.now() - c.at < 60000) return c.v;
  let v = null;
  try { const { data } = await sb.from("profiles").select("nickname, avatar_url").eq("id", me.id).maybeSingle(); if (data) v = { nickname: data.nickname || null, avatar_url: data.avatar_url || null }; } catch {}
  memberCache.set(me.id, { at: Date.now(), v }); if (memberCache.size > 5000) memberCache.clear();
  return v;
}
// IQ 접수 정보: 닉네임·캐릭터(필수), 나이(선택) — 성별은 안 받음(점수 보정 없음)
export function sanitizeProfile(p) {
  const nick = String(p?.nick ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
  if (!nick) return null;
  const age = Math.round(Number(p?.age));
  const a = p?.avatar || {};
  const pickI = (v, n) => { const k = Math.round(Number(v)); return k >= 0 && k < n ? k : 0; };
  return { nick, age: age >= 7 && age <= 99 ? age : null, avatar: { skin: pickI(a.skin, 4), hc: pickI(a.hc, 5), hs: pickI(a.hs, 10), shirt: pickI(a.shirt, 12), pants: pickI(a.pants, 7), hat: pickI(a.hat, 9) } };
}
export function sanitizePrefs(p) { return { showAge: !!p?.showAge, shareMulti: !!p?.shareMulti, streamer: !!p?.streamer, reduceMotion: !!p?.reduceMotion }; }
async function loadProfile(sb, key) {
  if (!sb) return null;
  try {
    const { data } = await sb.from("iq_profiles").select("nickname, age, avatar, prefs, updated_at").eq("owner_key", key).maybeSingle();
    if (data) return data;
    // 진단소 시리즈 공용: 에이징 커브에서 쓴 닉네임·캐릭터를 그대로 가져옴 (나이는 IQ에서 따로 고름)
    const { data: c } = await sb.from("clinic_profiles").select("nickname, avatar, updated_at").eq("owner_key", key).maybeSingle();
    return c ? { nickname: c.nickname, age: null, avatar: c.avatar, prefs: {}, fromClinic: true, updated_at: c.updated_at } : null;
  } catch { return null; }
}
async function saveProfile(sb, key, me, prof, prefs) {
  if (!sb) return false;
  try {
    const { error } = await sb.from("iq_profiles").upsert({ owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, prefs, updated_at: new Date().toISOString() }, { onConflict: "owner_key" });
    return !error;
  } catch { return false; }
}

export async function insertResults(sb, rows) { const { error } = await sb.from("iq_results").insert(rows); return { error }; }
async function prevResult(sb, key, mode) {
  if (!sb) return null;
  try { const { data } = await sb.from("iq_results").select("total, iq, created_at").eq("owner_key", key).eq("mode", mode).order("created_at", { ascending: false }).limit(1); return data?.[0] || null; } catch { return null; }
}
// 진단명·유형을 세 언어로
export function withI18n(diag, args) {
  const out = { ...diag, i18n: {} };
  for (const lang of ["ja", "en"]) { try { const d = C.diagnose({ ...args, lang }); out.i18n[lang] = { title: d.title, sub: d.sub, type: d.type.name, tier: d.tier.name }; } catch {} }
  return out;
}
// 결과 행 → 화면용 (소유 키·시드는 안 내보냄)
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  const showA = owner || row.show_age === true;
  return {
    id: row.id, nick: row.nickname, age: showA ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, setKey: row.set_key, setVer: row.set_ver, device: row.device,
    items: row.items, total: row.total, iq: row.iq, areas: row.areas, correct: row.correct, diag: row.diag,
    isPublic: row.is_public, flagged: row.flagged, groupId: row.group_id || null, rank: row.rank, of: row.rank_of, createdAt: row.created_at,
    isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}

/** 결과 행 만들기 (혼자·멀티 공용) */
export function buildRow({ id, key, me, prof, prefs, mode, setKey, dev, plan, results, seed, rank, of, prev, groupId, isPublic, avatarUrl }) {
  const dArgs = { results, seed, rank, of, prev };
  const diag = withI18n(C.diagnose(dArgs), dArgs);
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    mode, set_key: setKey || null, set_ver: C.SET_VERSION, device: dev, plan: plan.map((p) => ({ type: p.type, d: p.d, seed: p.seed })),
    items: results, total: diag.total, iq: diag.iq, areas: diag.areas, correct: diag.correct, diag,
    is_public: isPublic !== false, flagged: false, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer,
    group_id: groupId || null, rank: rank || null, rank_of: of || null, created_at: new Date().toISOString(),
  };
}

export function registerIq(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;

  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 60; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };

    // 검사 시작 — mode: quick | full | daily | weekly | practice(area 하나, 5문항, 기록 저장 안 함)
    on("iq:begin", async (p, reply) => {
      let mode = p.mode, plan, setKey = null;
      if (mode === "practice") {
        const area = C.AREAS.includes(p.area) ? p.area : "logic";
        const types = Object.keys(C.TYPES).filter((t) => C.TYPES[t].area === area);
        const base = newSeed();
        plan = [1, 2, 3, 4, 5].map((d, i) => ({ type: types[i % types.length], d, seed: (base + i * 7919) >>> 0 }));
      } else if (C.PLANS[mode]) {
        if (mode === "daily") setKey = C.dayKey(); else if (mode === "weekly") setKey = C.weekKey();
        plan = C.buildPlan(mode, newSeed(), setKey);
      } else return reply({ ok: false, error: "BAD_MODE" });
      let bcId = null;
      if (p.bc && mode !== "practice") { const g = await bcOnBegin(p.bc, mode); if (!g.ok) return reply({ ok: false, error: g.error }); bcId = g.bc; }
      // 오늘의 챌린지·주간은 한 사람 한 번만 순위 (다시 하면 연습 기록)
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS_PER_USER) SESS.delete(mine.shift()[0]);
      const id = "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      // 오늘의 챌린지·주간: 같은 세트를 두 번째로 시작하면 처음부터 순위 제외 (문제를 미리 본 상태)
      let preview = false;
      if (setKey) {
        const k = `${key}|${mode}|${setKey}`;
        if (SET_STARTS.has(k)) preview = true; else SET_STARTS.set(k, Date.now());
        if (SET_STARTS.size > 50000) SET_STARTS.clear();
      }
      const s = { key, mode, setKey, device: device(p.device), createdAt: Date.now(), plan, st: {}, results: [], finished: null, bcId, preview };
      SESS.set(id, s);
      if (bcId) { s.bcNick = String(p.bcNick || "").slice(0, 12); s.bcShow = p.bcShowName !== false; bcPlay(bcId, key, { nick: s.bcNick, showName: s.bcShow, total: plan.length, round: 1, done: 0, device: s.device }); }
      reply({ ok: true, sid: id, mode, setKey, plan: plan.map((x) => ({ type: x.type, d: x.d, area: C.TYPES[x.type].area, lim: C.TYPES[x.type].lim[x.d - 1] * 1000 })), coreVersion: C.CORE_VERSION });
    });

    on("iq:resume", (p, reply) => {
      const s = mySess(p.sid);
      if (!s || s.finished || s.mode === "practice") return reply({ ok: false, error: "NO_SESSION" });
      reply({ ok: true, mode: s.mode, setKey: s.setKey, plan: s.plan.map((x) => ({ type: x.type, d: x.d, area: C.TYPES[x.type].area, lim: C.TYPES[x.type].lim[x.d - 1] * 1000 })), results: s.results.map((r) => (r ? { ok: r.ok, part: r.part, timeout: r.timeout } : null)), idx: s.results.length });
    });

    // 문항 받기: 순서대로만. 같은 문항을 다시 받으면(새로고침) 시간은 처음 받은 때부터
    on("iq:item", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (i !== s.results.length || !s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      const it = makeItem(s.plan[i]);
      const st = s.st[i] ||= { at: Date.now(), act: {}, hint: false };
      if (s.bcId) bcPlay(s.bcId, key, { nick: s.bcNick, showName: s.bcShow, total: s.plan.length, round: i + 1, done: i, device: s.device });
      reply({ ok: true, idx: i, item: G.publicItem(it), elapsed: Date.now() - st.at, hint: st.hint ? hintFor(it) : null, act: st.act.w ? { w: st.act.w } : null });
    });

    // 문항 안 행동 (저울질)
    on("iq:act", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, st = s.st[i];
      if (!st || i !== s.results.length) return reply({ ok: false, error: "BAD_IDX" });
      const it = makeItem(s.plan[i]);
      if (it.type !== "scale" || p.op !== "weigh") return reply({ ok: false, error: "BAD_ACT" });
      if (Date.now() - st.at > it.lim + NET_SLACK) return reply({ ok: false, error: "TIME_UP" });
      reply(G.scaleWeigh(it, st.act, p.L, p.R));
    });

    on("iq:hint", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, st = s.st[i];
      if (!st || i !== s.results.length) return reply({ ok: false, error: "BAD_IDX" });
      const it = makeItem(s.plan[i]);
      if (!it.hint) return reply({ ok: false, error: "NO_HINT" });
      st.hint = true;
      reply({ ok: true, hint: hintFor(it) });
    });

    // 답 제출 (시간 초과·건너뛰기 = answer null)
    on("iq:answer", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (s.results[i]) return reply({ ok: true, dup: true, res: s.results[i], pts: pointsOf(s.results[i]), reveal: G.revealOf(makeItem(s.plan[i])) });
      const st = s.st[i];
      if (!st || i !== s.results.length) return reply({ ok: false, error: "BAD_IDX" });
      const it = makeItem(s.plan[i]);
      let ans = p.answer ?? null;
      try { if (JSON.stringify(ans).length > 20000) ans = null; } catch { ans = null; }
      const res = judgeItem(it, ans, st);
      s.results[i] = res;
      if (s.bcId) bcPlay(s.bcId, key, { done: i + 1 });
      reply({ ok: true, res, pts: pointsOf(res), reveal: G.revealOf(it), your: ans });
    });

    on("iq:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.results.length < s.plan.length) return reply({ ok: false, error: "NOT_COMPLETE" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me);
      if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      if (s.mode === "practice") {
        const sc = C.scoreAll(s.results);
        s.finished = { practice: true, score: sc };
        return reply({ ok: true, ...s.finished });
      }
      const prev = await prevResult(sb, key, s.mode);
      // 오늘의 챌린지·주간 특별검사는 같은 세트 첫 기록만 순위 → 이미 있으면 비공개 연습으로
      let isPublic = p.isPublic !== false, repeat = !!s.preview;
      if ((s.mode === "daily" || s.mode === "weekly") && sb) {
        try { const { count } = await sb.from("iq_results").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("mode", s.mode).eq("set_key", s.setKey); if (count) repeat = true; } catch {}
      }
      const row = buildRow({ id: resultId(), key, me, prof, prefs, mode: s.mode, setKey: s.setKey, dev: s.device, plan: s.plan, results: s.results, seed: C.hashSeed(p.sid), prev, isPublic, avatarUrl: mp?.avatar_url });
      if (repeat) { row.flagged = true; row.diag.repeat = true; }   // 같은 세트 두 번째부터는 순위 제외
      let saved = null;
      if (sb) { const { error } = await insertResults(sb, row); if (error) console.error("[iq] save", error.message); else saved = row.id; }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prev: prev ? { total: prev.total, iq: prev.iq, at: prev.created_at } : null, repeat };
      if (s.bcId && (saved || !sb)) { try { s.finished.bc = { id: s.bcId, ...(await bcOnFinish(s.bcId, { key, me, row, sessStarted: s.createdAt, showName: p.bcShowName !== false })) }; } catch (e) { console.error("[iq bc] finish", e); } }
      if (s.bcId) bcPlayEnd(s.bcId, key);
      reply({ ok: true, ...s.finished });
    });

    on("iq:me", async (p, reply) => {
      const mp = await memberProfile(sb, me);
      const saved = await loadProfile(sb, key);
      let guestRecords = 0;
      const g = String(p.guestId || "");
      if (!me.isGuest && sb && /^guest_[a-z0-9]{6,40}$/.test(g)) { try { const { count } = await sb.from("iq_results").select("id", { count: "exact", head: true }).eq("owner_key", `g:${g}`); guestRecords = count || 0; } catch {} }
      reply({ ok: true, isGuest: !!me.isGuest, member: mp, saved, guestRecords });
    });
    on("iq:profile:save", async (p, reply) => {
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      reply({ ok: true, saved: await saveProfile(sb, key, me, prof, sanitizePrefs(p.prefs)), nick: prof.nick });
    });
    on("iq:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const g = String(p.guestId || ""); if (!/^guest_[a-z0-9]{6,40}$/.test(g)) return reply({ ok: false, error: "BAD_GUEST" });
      const mp = await memberProfile(sb, me);
      const { data: moved, error } = await sb.from("iq_results").update({ owner_key: key, user_id: me.id, ...(mp?.nickname ? { nickname: String(mp.nickname).slice(0, 12) } : {}) }).eq("owner_key", `g:${g}`).select("id");
      if (error) return reply({ ok: false, error: "UPDATE_FAIL" });
      const mineP = await loadProfile(sb, key);
      if (!mineP || mineP.fromClinic) { const { data: gp } = await sb.from("iq_profiles").select("*").eq("owner_key", `g:${g}`).maybeSingle(); if (gp) await sb.from("iq_profiles").upsert({ ...gp, owner_key: key, user_id: me.id }, { onConflict: "owner_key" }); }
      await sb.from("iq_profiles").delete().eq("owner_key", `g:${g}`);
      reply({ ok: true, moved: moved?.length || 0 });
    });
    on("iq:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("iq_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("iq:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("iq_results").select("id, mode, set_key, device, total, iq, correct, items, diag->>title, diag->titles, is_public, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(40);
      reply({ ok: true, rows: (data || []).map((r) => ({ ...r, n: Array.isArray(r.items) ? r.items.length : 0, items: undefined })) });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/iq/result/:id", async (req, res) => {
    try {
      const { data: row, error } = await sb.from("iq_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      let group = null;
      if (row.group_id) { const { data: gr } = await sb.from("iq_groups").select("id, mode, players, report, created_at").eq("id", row.group_id).maybeSingle(); group = gr || null; }
      res.json({ ok: true, result: publicRow(row, { owner: mine }), group });
    } catch (e) { console.error("[iq/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 오답 복습: 내 기록(또는 공개 기록)의 문항을 다시 만들어 정답·해설과 함께
  app.get("/iq/review/:id", async (req, res) => {
    try {
      const { data: row } = await sb.from("iq_results").select("id, owner_key, is_public, plan, items, mode, set_key, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!mine) {
        // 오늘의 챌린지·주간은 세트가 끝나기 전엔 남에게 정답을 안 보여 줌 (스포일러 방지)
        if (!row.is_public) return res.status(403).json({ ok: false, error: "PRIVATE" });
        if ((row.mode === "daily" && row.set_key === C.dayKey()) || (row.mode === "weekly" && row.set_key === C.weekKey())) return res.status(403).json({ ok: false, error: "SPOILER" });
      }
      const items = (row.plan || []).map((p, i) => { const it = G.gen(p.type, p.d, p.seed); return { ...G.publicItem(it), reveal: G.revealOf(it), res: row.items?.[i] || null }; });
      res.json({ ok: true, items, mine });
    } catch (e) { console.error("[iq/review]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/iq/group/:id", async (req, res) => {
    try {
      const { data } = await sb.from("iq_groups").select("id, mode, players, report, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      res.json({ ok: true, group: data });
    } catch { res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/iq/today", (_req, res) => res.json({ ok: true, day: C.dayKey(), week: C.weekKey(), setVer: C.SET_VERSION }));

  // 랭킹: mode=quick|full|daily|weekly (모드·세트·채점 버전이 같은 기록끼리만) · board=total|area · period=day|week|all · device=pc|mobile|all
  const rankCache = new Map();
  app.get("/iq/ranking", async (req, res) => {
    try {
      const mode = C.PLANS[req.query.mode] ? req.query.mode : "full";
      const board = ["total", "area", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const area = C.AREAS.includes(req.query.area) ? req.query.area : "logic";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const dev = ["pc", "mobile"].includes(req.query.device) ? req.query.device : "all";
      const setKey = mode === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.dayKey()) : mode === "weekly" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.weekKey()) : null;
      const ck = JSON.stringify([mode, board, area, period, dev, setKey]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("iq_results").select(`id, owner_key, user_id, nickname, avatar, avatar_url, total, iq, correct, areas, diag->>title, diag->i18n, is_streamer, created_at`)
        .eq("mode", mode).eq("set_ver", C.SET_VERSION).eq("is_public", true).eq("flagged", false);
      if (setKey) q = q.eq("set_key", setKey);
      if (dev !== "all") q = q.eq("device", dev);
      if (board === "streamer") q = q.eq("is_streamer", true);
      const since = period === "day" ? Date.now() - 864e5 : period === "week" ? Date.now() - 7 * 864e5 : null;
      if (since && !setKey) q = q.gte("created_at", new Date(since).toISOString());
      q = board === "area" ? q.order(`areas->${area}`, { ascending: false }).order("total", { ascending: false }) : q.order("total", { ascending: false }).order("created_at", { ascending: true });
      const { data, error } = await q.limit(board === "streamer" ? 2000 : 500);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) {
        if (seen.has(r.owner_key)) continue; seen.add(r.owner_key);
        rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, iq: r.iq, correct: r.correct, area: board === "area" ? r.areas?.[area] ?? null : null, title: r.title, i18n: r.i18n || null, isGuest: !r.user_id, streamer: !!r.is_streamer, at: r.created_at });
        if (rows.length >= (board === "streamer" ? 200 : 50)) break;
      }
      const body = { ok: true, mode, board, area, period, device: dev, setKey, setVer: C.SET_VERSION, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[iq/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}

export const _iqTest = { SESS, judgeItem, makeItem };
