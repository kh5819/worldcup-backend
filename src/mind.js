// =========================
// 플듀 심리전 능력 진단소 — 혼자 검사 서버 (mind:* 소켓 + /mind/* REST) + 플듀 종합 능력 프로필 (ability:*)
// 게임 상태·정답·AI는 서버에만 있고 공개 화면 정보만 내보냄. 시간은 서버 기준으로 잼.
// 프로필은 진단소 시리즈 공용(iq_profiles / 회원 profiles)을 그대로 씀
// DB: mind_results / mind_groups / ability_profiles (sql/mind_tables.sql, RLS 켬·정책 0)
// =========================
import * as C from "./mind-core.js";
import * as G from "./mind-games.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, userKey, device, resultId } from "./iq.js";
import { bcOnBegin, bcOnFinish, bcPlay, bcPlayEnd } from "./mind-broadcast.js";

const SESS = new Map();
const SESS_TTL = 3 * 60 * 60 * 1000;
const MAX_SESS = 4, NET_SLACK = 2500;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const sweep = () => { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); };

export function buildRow({ id, key, me, prof, prefs, mode, lv, dev, results, seed, rank, of, prev, groupId, bcId, isPublic, avatarUrl }) {
  const diag = C.diagnose({ results, seed, prev, rank, of });
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    mode, lv, set_ver: C.SET_VERSION, device: dev, items: results, total: diag.total, areas: diag.areas, wins: diag.wins, n: diag.n, diag,
    is_public: isPublic !== false, flagged: false, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer,
    group_id: groupId || null, bc_id: bcId || null, rank: rank || null, rank_of: of || null, created_at: new Date().toISOString(),
  };
}
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, age: owner || row.show_age ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, lv: row.lv, setVer: row.set_ver, device: row.device,
    items: row.items, total: row.total, areas: row.areas, wins: row.wins, n: row.n, diag: row.diag, isPublic: row.is_public, groupId: row.group_id || null, bcId: row.bc_id || null,
    rank: row.rank, of: row.rank_of, createdAt: row.created_at, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}
export const insertResults = async (sb, rows) => { const { error } = await sb.from("mind_results").insert(rows); return { error }; };
async function prevResult(sb, key, mode, lv) {
  if (!sb) return null;
  try { const { data } = await sb.from("mind_results").select("total, created_at").eq("owner_key", key).eq("mode", mode).eq("lv", lv).order("created_at", { ascending: false }).limit(1).maybeSingle(); return data; } catch { return null; }
}

export function registerMind(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.MIND_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const planPub = (s) => s.plan.map((g) => ({ g, name: C.GAMES[g].name }));
    function current(s) {
      if (!s.game) {
        const g = s.plan[s.idx];
        const profile = g === "final" ? G.profileFrom(s.done) : null;
        s.game = G.createGame(g, { seed: (s.seed + s.idx * 7919) >>> 0, lv: s.lv, short: s.mode === "practice", profile });
        s.stepAt = 0;
      }
      return s.game;
    }

    // mode: quick | full | practice(game 하나, 짧게, 기록 안 남음)
    on("mind:begin", async (p, reply) => {
      const mode = p.mode; let plan;
      if (mode === "practice") { if (!C.PLANS.full.includes(p.game)) return reply({ ok: false, error: "BAD_GAME" }); plan = [p.game]; }
      else if (C.PLANS[mode]) plan = C.PLANS[mode]; else return reply({ ok: false, error: "BAD_MODE" });
      let lv = Math.min(3, Math.max(1, (p.lv ?? 1) | 0)), bcId = null;
      if (p.bc && mode !== "practice") { const g = await bcOnBegin(p.bc, mode); if (!g.ok) return reply({ ok: false, error: g.error }); bcId = g.bc; lv = g.lv; }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode, lv, seed: newSeed(), plan, idx: 0, game: null, done: [], results: [], createdAt: Date.now(), device: device(p.device), finished: null, bcId };
      SESS.set(id, s);
      if (bcId) { s.bcNick = String(p.bcNick || "").slice(0, 12); s.bcShow = p.bcShowName !== false; bcPlay(bcId, key, { nick: s.bcNick, showName: s.bcShow, total: plan.length, round: 1, done: 0, device: s.device }); }
      reply({ ok: true, sid: id, mode, lv, plan: planPub(s), setVer: C.SET_VERSION });
    });
    on("mind:resume", (p, reply) => {
      const s = mySess(p.sid);
      if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" });
      reply({ ok: true, mode: s.mode, lv: s.lv, plan: planPub(s), idx: s.idx, results: s.results.map((r) => ({ g: r.g, win: r.win, score: C.gameScore(r.g, r.perf, r.win, r.lv), detail: r.detail })) });
    });
    // 지금 화면: 게임이 없으면 이때 시작 (튜토리얼 보는 동안 시간 안 감). 새로고침해도 시간은 이어짐
    on("mind:view", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.idx >= s.plan.length) return reply({ ok: false, error: "ALL_DONE" });
      const g = current(s), view = G.viewOf(g);
      if (!s.stepAt) s.stepAt = Date.now();
      if (s.bcId) bcPlay(s.bcId, key, { nick: s.bcNick, showName: s.bcShow, total: s.plan.length, round: s.idx + 1, done: s.idx, device: s.device });
      reply({ ok: true, idx: s.idx, g: g.g, view, seq: g.acts, elapsed: Date.now() - s.stepAt, done: s.results.map((r) => ({ g: r.g, win: r.win })) });
    });
    // 행동: seq로 중복·재전송 방지, 시간 넘기면 서버가 시간 초과 처리
    on("mind:act", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const g = s.game;
      if (!g || (p.idx | 0) !== s.idx) return reply({ ok: false, error: "BAD_IDX" });
      const seq = g.acts;
      if ((p.seq | 0) !== seq) return reply({ ok: true, dup: true, seq });
      const view0 = G.viewOf(g);
      let action = p.action ?? null;
      try { if (JSON.stringify(action)?.length > 2000) action = null; } catch { action = null; }
      if (s.pausedAt) return reply({ ok: false, error: "PAUSED" });
      const late = !!s.stepAt && Date.now() - s.stepAt > (view0.lim * 1000 + NET_SLACK);
      const r = G.applyAction(g, late ? null : action);
      if (r.error) return reply({ ok: false, error: r.error });
      if (!r.stay) s.stepAt = 0;
      const out = { ok: true, fb: r.fb, late, seq: g.acts, stay: !!r.stay, view: r.stay ? G.viewOf(g) : null };
      if (g.done) {
        const res = G.resultOf(g); s.results.push(res); s.done.push(g); s.game = null; s.idx++;
        out.gameDone = true; out.result = { g: res.g, win: res.win, detail: res.detail, perf: res.perf, score: C.gameScore(res.g, res.perf, res.win, res.lv), timeouts: res.timeouts };
        out.allDone = s.idx >= s.plan.length;
        if (s.bcId) bcPlay(s.bcId, key, { done: s.idx, round: s.idx + 1 });
      }
      reply(out);
    });
    // 일시정지: 화면은 가리고 시간만 멈춤. 문제를 보며 시간을 버는 일을 막으려 게임당 3회
    on("mind:pause", (p, reply) => {
      const s = mySess(p.sid); if (!s || !s.game) return reply({ ok: false, error: "NO_SESSION" });
      if (s.pausedAt) return reply({ ok: true, dup: true });
      s.pauses = s.pauseG === s.idx ? (s.pauses || 0) + 1 : 1; s.pauseG = s.idx;
      if (s.pauses > 3) return reply({ ok: false, error: "PAUSE_LIMIT" });
      s.pausedAt = Date.now(); reply({ ok: true, left: 3 - s.pauses });
    });
    on("mind:unpause", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.pausedAt && s.stepAt) s.stepAt += Date.now() - s.pausedAt;
      s.pausedAt = 0; reply({ ok: true, elapsed: s.stepAt ? Date.now() - s.stepAt : 0 });
    });
    on("mind:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.idx < s.plan.length) return reply({ ok: false, error: "NOT_COMPLETE" });
      if (s.mode === "practice") { s.finished = { practice: true, score: C.scoreAll(s.results) }; return reply({ ok: true, ...s.finished }); }
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs), prev = await prevResult(sb, key, s.mode, s.lv);
      const row = buildRow({ id: resultId(), key, me, prof, prefs, mode: s.mode, lv: s.lv, dev: s.device, results: s.results, seed: C.hashSeed(p.sid), prev, bcId: s.bcId, isPublic: p.isPublic !== false, avatarUrl: mp?.avatar_url });
      let saved = null;
      if (sb) { const { error } = await insertResults(sb, row); if (error) console.error("[mind] save", error.message); else saved = row.id; }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prev: prev ? { total: prev.total, at: prev.created_at } : null };
      if (s.bcId && (saved || !sb)) { try { s.finished.bc = { id: s.bcId, ...(await bcOnFinish(s.bcId, { key, me, row, sessStarted: s.createdAt, showName: p.bcShowName !== false })) }; } catch (e) { console.error("[mind bc]", e); s.finished.bc = { id: s.bcId, counted: false, reason: "BC_ERROR" }; } }
      if (s.bcId) bcPlayEnd(s.bcId, key);
      reply({ ok: true, ...s.finished });
    });
    on("mind:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("mind_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("mind:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("mind_results").select("id, mode, lv, device, total, wins, n, diag->type, diag->titles, is_public, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
      reply({ ok: true, rows: data || [] });
    });
    on("mind:me", async (p, reply) => {
      let guestRecords = 0; const gid = String(p.guestId || "");
      if (!me.isGuest && sb && /^guest_[a-z0-9]{6,40}$/.test(gid)) { try { const { count } = await sb.from("mind_results").select("id", { count: "exact", head: true }).eq("owner_key", `g:${gid}`); guestRecords = count || 0; } catch {} }
      reply({ ok: true, guestRecords });
    });
    on("mind:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const gid = String(p.guestId || ""); if (!/^guest_[a-z0-9]{6,40}$/.test(gid)) return reply({ ok: false, error: "BAD_GUEST" });
      const mp = await memberProfile(sb, me);
      const { data: moved, error } = await sb.from("mind_results").update({ owner_key: key, user_id: me.id, ...(mp?.nickname ? { nickname: String(mp.nickname).slice(0, 12) } : {}) }).eq("owner_key", `g:${gid}`).select("id");
      if (error) return reply({ ok: false, error: "UPDATE_FAIL" });
      reply({ ok: true, moved: moved?.length || 0 });
    });

    // ---------- 플듀 종합 능력 프로필: 세 진단소 결과를 내 것만 모아서 ----------
    on("ability:overview", async (_p, reply) => {
      const out = { ok: true, isGuest: !!me.isGuest, clinic: null, iq: null, mind: null, sense: null, rep: null, titles: [] };
      if (!sb) return reply(out);
      const mp = await memberProfile(sb, me); out.member = mp;
      try { const { data } = await sb.from("clinic_results").select("id, mode, total, phys, diag, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const best = [...data].sort((a, b) => b.total - a.total)[0]; out.clinic = { count: data.length, latest: { id: data[0].id, mode: data[0].mode, total: data[0].total, phys: data[0].phys, title: data[0].diag?.title || null, at: data[0].created_at }, best: { id: best.id, total: best.total, phys: best.phys, mode: best.mode, title: best.diag?.title || null, at: best.created_at } }; } } catch (e) { console.warn("[ability] clinic", e?.message); }
      try { const { data } = await sb.from("iq_results").select("id, mode, total, iq, areas, diag, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const best = [...data].sort((a, b) => b.iq - a.iq)[0]; out.iq = { count: data.length, latest: { id: data[0].id, mode: data[0].mode, iq: data[0].iq, total: data[0].total, title: data[0].diag?.title || null, at: data[0].created_at }, best: { id: best.id, iq: best.iq, total: best.total, mode: best.mode, title: best.diag?.title || null, at: best.created_at } }; for (const r of data) for (const t of r.diag?.titles || []) if (t?.name && !out.titles.some((x) => x.name === t.name)) out.titles.push({ name: t.name, from: "iq" }); } } catch (e) { console.warn("[ability] iq", e?.message); }
      try { const { data } = await sb.from("mind_results").select("id, mode, lv, total, areas, diag, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const best = [...data].sort((a, b) => b.total - a.total)[0]; const pub = (r) => ({ id: r.id, mode: r.mode, lv: r.lv, total: r.total, areas: r.areas, type: r.diag?.type?.name || null, typeId: r.diag?.type?.id || null, at: r.created_at }); out.mind = { count: data.length, latest: pub(data[0]), best: pub(best) }; for (const r of data) for (const t of r.diag?.titles || []) if (t?.name && !out.titles.some((x) => x.name === t.name)) out.titles.push({ name: t.name, from: "mind" }); } } catch (e) { console.warn("[ability] mind", e?.message); }
      // 게임 센스: 공식 최고는 의심 기록 제외. 빠른·정밀 점수 척도는 같지만 정밀이 더 정확하다는 표시를 붙임
      try { const { data } = await sb.from("sense_results").select("id, mode, total, tier, style, areas, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const ok = data.filter((r) => !r.flagged), best = [...(ok.length ? ok : data)].sort((a, b) => b.total - a.total)[0]; const pub = (r) => ({ id: r.id, mode: r.mode, total: r.total, tier: r.tier, style: r.style, areas: r.areas, flagged: !!r.flagged, at: r.created_at }); out.sense = { count: data.length, latest: pub(data[0]), best: pub(best) };
          const TN = { iron: "아이언", bronze: "브론즈", silver: "실버", gold: "골드", platinum: "플래티넘", emerald: "에메랄드", diamond: "다이아몬드", master: "마스터", grandmaster: "그랜드마스터", challenger: "챌린저" }; if (ok.length && TN[best.tier]) out.titles.push({ name: `게임 센스 ${TN[best.tier]}`, from: "sense" }); } } catch (e) { console.warn("[ability] sense", e?.message); }
      try { const { data } = await sb.from("ability_profiles").select("rep_kind, rep_id, rep_title").eq("owner_key", key).maybeSingle(); out.rep = data || null; } catch {}
      out.titles = out.titles.slice(0, 40);
      reply(out);
    });
    // 대표 진단서·대표 칭호: 내 기록만 지정 가능
    on("ability:setRep", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const kind = ["clinic", "iq", "mind", "sense"].includes(p.kind) ? p.kind : null, id = kind ? String(p.id || "").slice(0, 16) : null;
      if (kind) { const { data } = await sb.from(`${kind}_results`).select("id").eq("id", id).eq("owner_key", key).maybeSingle(); if (!data) return reply({ ok: false, error: "NOT_MINE" }); }
      const row = { owner_key: key, user_id: me.isGuest ? null : me.id, rep_kind: kind, rep_id: id, rep_title: p.title ? String(p.title).replace(/[<>]/g, "").slice(0, 30) : null, updated_at: new Date().toISOString() };
      const { error } = await sb.from("ability_profiles").upsert(row, { onConflict: "owner_key" });
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/mind/result/:id", async (req, res) => {
    try {
      const { data: row, error } = await sb.from("mind_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      let group = null;
      if (row.group_id) { const { data: gr } = await sb.from("mind_groups").select("id, mode, lv, players, report, created_at").eq("id", row.group_id).maybeSingle(); group = gr || null; }
      res.json({ ok: true, result: publicRow(row, { owner: mine }), group });
    } catch (e) { console.error("[mind/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/mind/group/:id", async (req, res) => {
    try {
      const { data } = await sb.from("mind_groups").select("id, mode, lv, players, report, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (!data) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      res.json({ ok: true, group: data });
    } catch { res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 랭킹: 검사 길이·난이도·채점 버전이 같은 기록끼리만 — 섞지 않음
  const rankCache = new Map();
  app.get("/mind/ranking", async (req, res) => {
    try {
      const modes = ["quick", "full", "m5", "m10", "m12"];
      const mode = modes.includes(req.query.mode) ? req.query.mode : "full";
      const lv = [1, 2, 3].includes(Number(req.query.lv)) ? Number(req.query.lv) : 1;
      const board = ["total", "area", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const area = C.AREAS.includes(req.query.area) ? req.query.area : "predict";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const ck = JSON.stringify([mode, lv, board, area, period]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("mind_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, total, wins, n, areas, diag->type, diag->titles, is_streamer, created_at").eq("mode", mode).eq("lv", lv).eq("set_ver", C.SET_VERSION).eq("is_public", true).eq("flagged", false);
      if (board === "streamer") q = q.eq("is_streamer", true);
      const since = period === "day" ? Date.now() - 864e5 : period === "week" ? Date.now() - 7 * 864e5 : null;
      if (since) q = q.gte("created_at", new Date(since).toISOString());
      q = board === "area" ? q.order(`areas->${area}`, { ascending: false }).order("total", { ascending: false }) : q.order("total", { ascending: false }).order("created_at", { ascending: true });
      const { data, error } = await q.limit(500);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, area: board === "area" ? r.areas?.[area] ?? null : null, type: r.type?.name || null, typeId: r.type?.id || null, title: r.titles?.[0]?.name || null, wins: r.wins, n: r.n, isGuest: !r.user_id, isStreamer: !!r.is_streamer, at: r.created_at }); if (rows.length >= 50) break; }
      const body = { ok: true, mode, lv, board, area, period, setVer: C.SET_VERSION, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[mind/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _mindTest = { SESS };
