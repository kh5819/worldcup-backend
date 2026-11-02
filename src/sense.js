// =========================
// 플듀 게임 센스 진단소 — 혼자 검사 서버 (sense:* 소켓 + /sense/* REST)
// 화면은 입력 기록만 보냄 → 서버가 sense-core.js(화면과 같은 파일)로 다시 채점. 클라 점수는 안 믿음
// 시간: 서버가 검사 시작 시각을 재고, 기록 길이가 그보다 길면 조작으로 보고 40점 상한 + 랭킹 제외
// 프로필은 진단소 시리즈 공용(iq_profiles / 회원 profiles)을 그대로 씀
// DB: sense_results / sense_groups (sql/sense_tables.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./sense-core.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, userKey, device, resultId } from "./iq.js";

const SESS = new Map();
const SESS_TTL = 3 * 60 * 60 * 1000;
const MAX_SESS = 4, LOG_MAX_BYTES = 60000, TIME_SLACK = 2500;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const sweep = () => { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); };
let hooks = { begin: null, play: null, finish: null, end: null };   // 방송 연동 (sense-broadcast가 채움)
export function setSenseHooks(h) { hooks = { ...hooks, ...h }; }

// 기록 안의 가장 늦은 시각(ms) — 실시간 게임은 시각 최댓값, 라운드 게임은 고민 시간 합
export function logSpan(tid, log) {
  const mx = (a, f) => (Array.isArray(a) ? a : []).reduce((m, v) => { const x = Number(f(v)); return Number.isFinite(x) && x > m ? x : m; }, 0);
  const sum = (a, k) => (Array.isArray(a) ? a : []).reduce((s, v) => { const x = Number(v?.[k]); return s + (Number.isFinite(x) && x > 0 ? x : 0); }, 0);
  try {
    switch (tid) {
      case "minimap": case "multitask": case "overload": return mx(log.a, (v) => v?.[0]);
      case "cooldown": return mx(log.k, (v) => v?.[0]);
      case "boss": return mx(log.z, (v) => v?.[0]);
      case "final": return Math.max(mx(log.z, (v) => v?.[0]), mx(log.k, (v) => v?.[0]));
      case "fake": return mx(log.b, (v) => v);
      case "engage": case "path": case "comeback": case "resource": return sum(log.c, 2);
      case "target": return sum(log.o, 2);
      case "vision": return sum(log.r, 2);
      case "team": return sum(log.c, 2);
      case "teamfight": return 0;   // 라운드마다 장면 시간 안 → 채점에서 범위 검사
    }
  } catch {}
  return 0;
}
// 제출 하나 채점 + 시간 검증 (멀티·방송도 재사용)
export function judgeSubmit(tid, seed, log, elapsedMs) {
  let bytes = 0;
  try { bytes = JSON.stringify(log ?? {}).length; } catch { bytes = LOG_MAX_BYTES + 1; }
  if (bytes > LOG_MAX_BYTES) return { id: tid, score: 0, m: {}, flags: ["LOG_TOO_BIG"] };
  const r = C.scoreTest(tid, C.genSpec(tid, seed), log || {});
  if (process.env.SENSE_DEV_TIME === "1") return r;   // 시험 서버 전용(8배속 브라우저 시험). 운영에선 설정 안 함
  if (Number.isFinite(elapsedMs) && logSpan(tid, log || {}) > elapsedMs + TIME_SLACK) { r.flags = [...r.flags, "TIME"]; r.score = Math.min(r.score, 40); }
  if (Number.isFinite(elapsedMs) && elapsedMs < Math.min(8000, C.TESTS[tid].dur * 0.15)) { r.flags = [...r.flags, "TOO_QUICK"]; r.score = Math.min(r.score, 40); }
  return r;
}

export function buildRow({ id, key, me, prof, prefs, mode, dev, plan, results, prev, rank, of, groupId, bcId, isPublic, avatarUrl }) {
  const scores = {}, metrics = {};
  plan.forEach((it, i) => { const r = results[i]; scores[it.id] = r.score; metrics[it.id] = { m: r.m, flags: r.flags }; });
  const flagged = plan.some((_, i) => results[i].flags.length);
  const diag = C.diagnose({ scores, prev, rank, of });
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    mode, set_ver: C.SET_VERSION, device: dev, scores, metrics, total: diag.total, areas: diag.areas, tier: diag.tier.id, style: diag.style.id, diag,
    is_public: isPublic !== false, flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer,
    group_id: groupId || null, bc_id: bcId || null, rank: rank || null, rank_of: of || null, created_at: new Date().toISOString(),
  };
}
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, age: owner || row.show_age ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, setVer: row.set_ver, device: row.device,
    scores: row.scores, metrics: row.metrics, total: row.total, areas: row.areas, tier: row.tier, style: row.style, diag: row.diag, isPublic: row.is_public, flagged: row.flagged,
    groupId: row.group_id || null, bcId: row.bc_id || null, rank: row.rank, of: row.rank_of, createdAt: row.created_at, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}
export const insertResults = async (sb, rows) => { const { error } = await sb.from("sense_results").insert(rows); return { error }; };
async function prevResult(sb, key, mode) {
  if (!sb) return null;
  try { const { data } = await sb.from("sense_results").select("total, tier, created_at").eq("owner_key", key).eq("mode", mode).order("created_at", { ascending: false }).limit(1).maybeSingle(); return data; } catch { return null; }
}
// 같은 모드에서 내 점수보다 높은 사람 수 → 순위 (사람당 최고 기록 기준은 랭킹 화면에서)
async function rankOf(sb, mode, total) {
  if (!sb) return { rank: null, of: null };
  try {
    const base = () => sb.from("sense_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("set_ver", C.SET_VERSION).eq("flagged", false);
    const [{ count: of }, { count: above }] = await Promise.all([base(), base().gt("total", total)]);
    return { rank: (above || 0) + 1, of: (of || 0) + 1 };
  } catch { return { rank: null, of: null }; }
}

export function registerSense(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.SENSE_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const resPub = (r) => (r ? { id: r.id, score: r.score, m: r.m, flags: r.flags } : null);

    // mode: quick | full | practice(test 하나 · 저장·랭킹 없음)
    on("sense:begin", async (p, reply) => {
      let tests;
      if (p.mode === "practice") { if (!C.TESTS[p.test]) return reply({ ok: false, error: "BAD_TEST" }); tests = [p.test]; }
      else if (C.MODES[p.mode]) tests = C.MODES[p.mode].tests;
      else return reply({ ok: false, error: "BAD_MODE" });
      let bcId = null;
      if (p.bc && p.mode !== "practice" && hooks.begin) { const g = await hooks.begin(p.bc, p.mode); if (!g.ok) return reply({ ok: false, error: g.error }); bcId = g.bc; }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode: p.mode, device: device(p.device), createdAt: Date.now(), plan: tests.map((t) => ({ id: t, seed: newSeed() })), started: {}, results: {}, finished: null, bcId };
      SESS.set(id, s);
      if (bcId) { s.bcNick = String(p.bcNick || "").slice(0, 12); s.bcShow = p.bcShowName !== false; hooks.play?.(bcId, key, { nick: s.bcNick, showName: s.bcShow, total: s.plan.length, round: 1, done: 0, device: s.device }); }
      reply({ ok: true, sid: id, mode: s.mode, plan: s.plan, device: s.device, setVer: C.SET_VERSION });
    });
    // 새로고침 후 이어하기: 진행 중이던 검사는 같은 문제로 처음부터 (시간은 새로 잼)
    on("sense:resume", (p, reply) => {
      const s = mySess(p.sid);
      if (!s || s.finished || s.mode === "practice") return reply({ ok: false, error: "NO_SESSION" });
      const results = s.plan.map((_, i) => resPub(s.results[i]));
      const idx = results.findIndex((x) => !x);
      reply({ ok: true, mode: s.mode, plan: s.plan, results, idx: idx < 0 ? s.plan.length : idx });
    });
    on("sense:testStart", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (!s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: false, error: "ALREADY_DONE" });
      if (s.plan.slice(0, i).some((_, j) => !s.results[j])) return reply({ ok: false, error: "BAD_ORDER" });
      s.started[i] = Date.now();
      if (s.bcId) hooks.play?.(s.bcId, key, { nick: s.bcNick, showName: s.bcShow, total: s.plan.length, round: i + 1, done: i, device: s.device });
      reply({ ok: true });
    });
    on("sense:submit", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, item = s.plan[i];
      if (!item) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: true, result: resPub(s.results[i]), dup: true });   // 중복 제출 = 처음 결과 그대로
      if (!s.started[i]) return reply({ ok: false, error: "NOT_STARTED" });
      const r = judgeSubmit(item.id, item.seed, p.log, Date.now() - s.started[i]);
      s.results[i] = r;
      if (s.bcId) hooks.play?.(s.bcId, key, { done: i + 1, round: i + 2 });
      reply({ ok: true, result: resPub(r), allDone: s.plan.every((_, j) => s.results[j]) });
    });
    on("sense:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.plan.some((_, i) => !s.results[i])) return reply({ ok: false, error: "NOT_COMPLETE" });
      if (s.mode === "practice") { const r = s.results[0]; s.finished = { practice: true, result: resPub(r) }; return reply({ ok: true, ...s.finished }); }
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs), prev = await prevResult(sb, key, s.mode);
      const tmp = buildRow({ id: "", key, me, prof, prefs, mode: s.mode, dev: s.device, plan: s.plan, results: s.results, prev });
      const rk = tmp.flagged ? { rank: null, of: null } : await rankOf(sb, s.mode, tmp.total);
      const row = buildRow({ id: resultId(), key, me, prof, prefs, mode: s.mode, dev: s.device, plan: s.plan, results: s.results, prev, ...rk, bcId: s.bcId, isPublic: p.isPublic !== false, avatarUrl: mp?.avatar_url });
      let saved = null;
      if (sb) { const { error } = await insertResults(sb, row); if (error) console.error("[sense] save", error.message); else saved = row.id; }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prev: prev ? { total: prev.total, tier: prev.tier, at: prev.created_at } : null };
      if (s.bcId && (saved || !sb) && hooks.finish) { try { s.finished.bc = { id: s.bcId, ...(await hooks.finish(s.bcId, { key, me, row, sessStarted: s.createdAt, showName: p.bcShowName !== false })) }; } catch (e) { console.error("[sense bc]", e); s.finished.bc = { id: s.bcId, counted: false, reason: "BC_ERROR" }; } }
      if (s.bcId) hooks.end?.(s.bcId, key);
      reply({ ok: true, ...s.finished });
    });
    on("sense:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("sense_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("sense:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("sense_results").select("id, mode, device, total, tier, style, areas, is_public, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
      reply({ ok: true, rows: data || [] });
    });
    on("sense:me", async (p, reply) => {
      let guestRecords = 0; const gid = String(p.guestId || "");
      if (!me.isGuest && sb && /^guest_[a-z0-9]{6,40}$/.test(gid)) { try { const { count } = await sb.from("sense_results").select("id", { count: "exact", head: true }).eq("owner_key", `g:${gid}`); guestRecords = count || 0; } catch {} }
      reply({ ok: true, guestRecords });
    });
    on("sense:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const gid = String(p.guestId || ""); if (!/^guest_[a-z0-9]{6,40}$/.test(gid)) return reply({ ok: false, error: "BAD_GUEST" });
      const mp = await memberProfile(sb, me);
      const { data: moved, error } = await sb.from("sense_results").update({ owner_key: key, user_id: me.id, ...(mp?.nickname ? { nickname: String(mp.nickname).slice(0, 12) } : {}) }).eq("owner_key", `g:${gid}`).select("id");
      if (error) return reply({ ok: false, error: "UPDATE_FAIL" });
      reply({ ok: true, moved: moved?.length || 0 });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/sense/result/:id", async (req, res) => {
    try {
      const { data: row, error } = await sb.from("sense_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      let group = null;
      if (row.group_id) { const { data: gr } = await sb.from("sense_groups").select("id, mode, players, report, created_at").eq("id", row.group_id).maybeSingle(); group = gr || null; }
      res.json({ ok: true, result: publicRow(row, { owner: mine }), group });
    } catch (e) { console.error("[sense/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/sense/group/:id", async (req, res) => {
    try {
      const { data } = await sb.from("sense_groups").select("id, mode, players, report, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      res.json({ ok: true, group: data });
    } catch { res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 랭킹: 빠른·정밀은 따로, 채점 버전 같은 기록끼리만, 의심 기록 제외, 사람당 최고 1개
  const rankCache = new Map();
  app.get("/sense/ranking", async (req, res) => {
    try {
      const mode = ["quick", "full"].includes(req.query.mode) ? req.query.mode : "full";
      const board = ["total", "area", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const area = C.AREAS.includes(req.query.area) ? req.query.area : "situ";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const dev = ["pc", "mobile"].includes(req.query.device) ? req.query.device : null;
      const ck = JSON.stringify([mode, board, area, period, dev]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("sense_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, total, tier, style, areas, device, is_streamer, created_at").eq("mode", mode).eq("set_ver", C.SET_VERSION).eq("is_public", true).eq("flagged", false);
      if (board === "streamer") q = q.eq("is_streamer", true);
      if (dev) q = q.eq("device", dev);
      const since = period === "day" ? Date.now() - 864e5 : period === "week" ? Date.now() - 7 * 864e5 : null;
      if (since) q = q.gte("created_at", new Date(since).toISOString());
      q = board === "area" ? q.order(`areas->${area}`, { ascending: false }).order("total", { ascending: false }) : q.order("total", { ascending: false }).order("created_at", { ascending: true });
      const { data, error } = await q.limit(800);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, tier: r.tier, style: r.style, area: board === "area" ? r.areas?.[area] ?? null : null, device: r.device, isGuest: !r.user_id, isStreamer: !!r.is_streamer, at: r.created_at }); if (rows.length >= 100) break; }
      const body = { ok: true, mode, board, area, period, device: dev, setVer: C.SET_VERSION, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[sense/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 티어 분포 (랭킹 화면 막대): 정밀·빠른 따로, 1분 캐시
  let distCache = { at: 0, body: null, mode: null };
  app.get("/sense/dist", async (req, res) => {
    try {
      const mode = req.query.mode === "quick" ? "quick" : "full";
      if (distCache.body && distCache.mode === mode && Date.now() - distCache.at < 60000) return res.json(distCache.body);
      const out = {};
      await Promise.all(C.TIERS.map(async (t) => { const { count } = await sb.from("sense_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("set_ver", C.SET_VERSION).eq("flagged", false).eq("tier", t.id); out[t.id] = count || 0; }));
      const body = { ok: true, mode, dist: out };
      distCache = { at: Date.now(), body, mode }; res.json(body);
    } catch { res.status(500).json({ ok: false }); }
  });
}
export const _senseTest = { SESS };
