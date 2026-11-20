// =========================
// 플듀 붕어빵 장사 진단소 — 서버 (bb:* · bbm:* · bb:bc:* 소켓 + /bb/* REST)
// - 혼자(normal) · 오늘의 장사(daily, 모두 같은 씨앗, 첫 기록만 순위) · 방송 진단소(bc, 방송마다 같은 씨앗, IQ 방송 진단소 구조)
// - 친구 대결(multi, 2~8명 같은 거리): 매달 같은 사건 → 가격 공개 → 거리 손님을 가게 매력대로 나눔 → 각자 40초 굽기 → 정산 순위
// - 판정은 전부 서버: 손님 목록·정산·폐업. 화면은 고른 번호·계획·굽기 결과만 보냄
// - 방송 진단소를 만들면 admin 「📺 스트리머」 기록(platform "bungeo")
// DB: bb_results · bb_broadcasts · bb_bc_entries · bb_bc_predictions (sql/bb_tables_20261120.sql, RLS 켬·정책 0)
// =========================
import * as C from "./bb-core.js";
import { MENUS, BAKE_SEC } from "./bb-data.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId, userKey, device } from "./iq.js";
import { tx, trStr } from "./bb-tr.js";

const SESS = new Map(), SESS_TTL = 3 * 3600e3, MAX_SESS = 3, DAILY_STARTS = new Map();
const BC = new Map(), BC_STATS_MS = 2000, BC_GRACE = 40 * 60e3, BC_MAX_MIN = 24 * 60, BC_PLAY_TTL = 6 * 60e3;
const ROOMS = new Map(), MAX_ROOMS = 300, ROOM_TTL = 2 * 3600e3;
const PH_MS = { event: 25000, plan: 30000, bake: (BAKE_SEC + 8) * 1000, result: process.env.BB_TEST_FAST === "1" ? 400 : 9000 };
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60e3, GUEST_IP_MAX = 5;
const RL = Math.max(1, Number(process.env.BB_RL) || 1), SKEW = process.env.BB_TEST_FAST === "1" ? 60000 : 0;   // 시험 때만: 굽기 최소 시간 건너뜀
const ipMakes = new Map();
let SB = null, IO = null;
const now = () => Date.now();
const LOBBY_GRACE = Number(process.env.LOBBY_GRACE_MS) || 20000;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function sockIp(socket) { const h = socket.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const x = String(h["x-forwarded-for"] || "").split(",").map((v) => v.trim()).filter(Boolean); return x[0] || String(socket.handshake?.address || "").replace(/^::ffff:/, ""); }
const idNew = (n = 8) => { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const roomCode = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
function sweep() { const n = now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); for (const [k, r] of ROOMS) if (n - r.touched > ROOM_TTL || (r.phase === "over" && n - r.touched > 15 * 60e3)) { clearTimeout(r.timer); ROOMS.delete(k); } if (DAILY_STARTS.size > 50000) DAILY_STARTS.clear(); }

// ---------- 결과 저장 ----------
function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return { id: row.id, nick: row.nickname, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, setKey: row.set_key, device: row.device, months: row.months, survived: row.survived, cash: row.cash, profit: row.profit, score: row.score, cause: row.cause, typeId: row.type_id, abil: row.abil, diag: row.diag, isPublic: row.is_public, flagged: row.flagged, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer, bcId: row.bc_id || null, groupId: row.group_id || null, createdAt: row.created_at, age: owner || row.show_age ? row.age : null };
}
function buildRow({ key, me, prof, prefs, mode, setKey, dev, st, isPublic, avatarUrl, bc, groupId, flagged }) {
  const dg = C.diagnose(st);
  return { id: resultId(), owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null, mode, set_key: setKey || null, device: dev, core_ver: C.CORE_VERSION, seed: st.seed, months: dg.months, survived: dg.survived, cash: dg.cash, profit: dg.profit, score: dg.score, cause: dg.cause, type_id: dg.typeId, abil: dg.abil, diag: dg, is_public: isPublic !== false, flagged: !!flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer, bc_id: bc || null, group_id: groupId || null, created_at: new Date().toISOString() };
}
async function saveRow(row) { if (!SB) return null; const { error } = await SB.from("bb_results").insert(row); if (error) { console.error("[bb] save", error.message); return null; } return row.id; }
async function percentile(mode, setKey, score) {
  if (!SB) return null;
  try {
    let q = SB.from("bb_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false); if (setKey) q = q.eq("set_key", setKey);
    const { count: all } = await q; if (!all || all < 20) return null;
    let q2 = SB.from("bb_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false).gt("score", score); if (setKey) q2 = q2.eq("set_key", setKey);
    const { count: better } = await q2; return Math.max(1, Math.round(((better || 0) / all) * 100));
  } catch { return null; }
}

// ---------- 방송 진단소 ----------
async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("bb_broadcasts").select("*").eq("id", id).maybeSingle(); if (!row) return null;
  const { data: ents } = await SB.from("bb_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const { data: preds } = await SB.from("bb_bc_predictions").select("*").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), preds: new Map((preds || []).map((x) => [x.owner_key, x])), playing: new Map(), feed: [], live: { cust: 0, served: 0, revenue: 0, months: 0, menus: {}, prices: [] }, stats: null, dirty: true, at: 0, timer: null, starts: new Set() };
  BC.set(id, b); if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old && old[0] !== id) BC.delete(old[0]); }
  return b;
}
const bcOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const bcUntil = (b) => new Date(b.row.closes_at).getTime() + BC_GRACE;
const nameOf = (e) => (e.show_name ? e.nickname : "익명 사장님");
function bcStats(b) {
  const all = [...b.entries.values()], valid = all.filter((e) => !e.flagged && !e.is_streamer), streamer = all.find((e) => e.is_streamer) || null;
  const sorted = [...valid].sort((x, y) => y.score - x.score || new Date(x.created_at) - new Date(y.created_at));
  const causes = {}, types = {}; for (const e of valid) { if (e.cause) causes[e.cause] = (causes[e.cause] || 0) + 1; types[e.type_id] = (types[e.type_id] || 0) + 1; }
  const play = [...b.playing.values()].filter((x) => now() - x.at < BC_PLAY_TTL);
  const monthDist = {}; for (const p of play) monthDist[p.month] = (monthDist[p.month] || 0) + 1;
  const L = b.live, menus = Object.entries(L.menus).sort((a, c) => c[1] - a[1]).map(([k, n]) => ({ k, n: MENUS[k]?.n || k, ic: MENUS[k]?.ic || "", bags: n }));
  const richest = [...play].sort((x, y) => y.cash - x.cash)[0];
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, status: b.row.status, closesAt: b.row.closes_at, open: bcOpen(b),
    count: valid.length, survived: valid.filter((e) => e.survived).length, avgMonths: r1(avg(valid.map((e) => e.months))), avgProfit: valid.length ? Math.round(avg(valid.map((e) => e.profit))) : null,
    bestProfit: valid.length ? Math.max(...valid.map((e) => e.profit)) : null, worstProfit: valid.length ? Math.min(...valid.map((e) => e.profit)) : null,
    top10: sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, nick: nameOf(e), anon: !e.show_name, months: e.months, survived: e.survived, profit: e.profit, cause: e.cause, typeId: e.type_id })),
    causes: Object.entries(causes).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, n]) => ({ cause: k, n })),
    types: Object.entries(types).sort((a, c) => c[1] - a[1]).map(([k, n]) => ({ typeId: k, n, name: C.TYPES[k]?.n || k, ic: C.TYPES[k]?.ic || "" })),
    streamerRes: streamer ? { months: streamer.months, survived: streamer.survived, profit: streamer.profit, cause: streamer.cause, typeId: streamer.type_id } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.score > streamer.score).length / valid.length) * 100) : null,
    predictions: b.preds.size,
    playing: b.row.status === "final" ? 0 : play.length,
    playingList: b.row.status === "final" ? [] : [...play].sort((x, y) => y.mi - x.mi || y.cash - x.cash).slice(0, 60).map((x) => ({ nick: x.streamer || x.showName ? x.nick : "익명 사장님", month: x.month, mi: x.mi, cash: x.cash, rep: x.rep, streamer: !!x.streamer })),
    monthDist, richest: richest ? { nick: richest.streamer || richest.showName ? richest.nick : "익명 사장님", cash: richest.cash, month: richest.month } : null,
    live: { customers: L.cust, served: L.served, revenue: Math.round(L.revenue), monthsPlayed: L.months, avgPrice: L.prices.length ? Math.round(avg(L.prices) / 100) * 100 : null, menus },
    feed: b.feed.slice(-14), updatedAt: new Date().toISOString(),
  };
  if (b.row.status === "final" && s.avgMonths != null) s.predictWinners = [...b.preds.values()].map((x) => ({ nick: x.nickname, guess: x.guess, gap: r1(Math.abs(x.guess - s.avgMonths)) })).sort((x, y) => x.gap - y.gap).slice(0, 5);
  return s;
}
function bcDirty(b) { b.dirty = true; if (b.timer) return; b.timer = setTimeout(() => { b.timer = null; b.stats = bcStats(b); b.dirty = false; b.at = now(); IO?.to(`bb:bc:${b.row.id}`).emit("bb:bc:stats", b.stats); }, Math.max(0, BC_STATS_MS - (now() - b.at))); }
function bcGet(b) { if (b.row.final_stats) return b.row.final_stats; if (!b.stats || b.dirty || b.stats.open !== bcOpen(b)) { b.stats = bcStats(b); b.dirty = false; b.at = now(); } return b.stats; }
function bcPlay(b, key, info) {
  if (!b || b.row.status === "final") return;
  const cur = b.playing.get(key); const x = { since: cur?.since || now(), ...cur, ...info, at: now(), streamer: b.row.owner_key === key }; x.nick = clean(x.nick, 12) || "사장님";
  b.playing.set(key, x); if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
  bcDirty(b);
}
function bcLive(b, rep) { if (!b || !rep || rep.closed) return; const L = b.live; L.cust += rep.cust || 0; L.served += rep.served || 0; L.revenue += rep.revenue || 0; L.months++; if (rep.price) { L.prices.push(rep.price); if (L.prices.length > 5000) L.prices.shift(); } for (const [k, n] of Object.entries(rep.soldBy || {})) L.menus[k] = (L.menus[k] || 0) + n; }
async function bcFinalize(b, force = false) {
  if (b.row.status === "final" || (!force && now() < bcUntil(b))) return;
  b.row.status = "final"; const st = bcStats(b); st.status = "final"; st.open = false; st.finalAt = new Date().toISOString(); b.row.final_stats = st;
  if (SB) await SB.from("bb_broadcasts").update({ status: "final", final_stats: st, finalized_at: st.finalAt }).eq("id", b.row.id);
  IO?.to(`bb:bc:${b.row.id}`).emit("bb:bc:stats", st);
}

// ---------- 친구 대결 (같은 거리) ----------
function roomPublic(r) {
  return {
    code: r.code, phase: r.phase, mi: r.mi, month: C.MONTHS[r.mi], months: r.months, deadline: r.deadline, host: r.hostNick, eventId: r.eventId,
    players: [...r.players.values()].map((p) => ({ nick: p.nick, avatar: p.avatar, host: p.key === r.hostKey, on: p.connected, bankrupt: !!p.st?.over?.bankrupt, stage: p.st ? p.st.up.stage : 0, cash: p.st ? Math.round(p.st.cash) : null, rep: p.st ? Math.round(p.st.rep) : null,
      done: r.phase === "event" ? p.choice != null : r.phase === "plan" ? !!p.plan : r.phase === "bake" ? !!p.baked : false,
      plan: ["bake", "result", "over"].includes(r.phase) && p.plan ? { price: p.plan.price, menus: p.plan.menus, closed: p.plan.closed } : null,
      last: p.report ? { profit: p.report.profit, soldBags: p.report.soldBags ?? 0, cust: p.report.cust ?? 0, served: p.report.served ?? 0, q: p.report.q ?? null, closed: !!p.report.closed } : null, k: p.pk })),
    ranking: r.phase === "over" ? r.ranking : null,
  };
}
function emitRoom(r) { r.touched = now(); IO?.to(`bbm:${r.code}`).emit("bbm:state", roomPublic(r)); }
function emitYou(r, p) { const sock = IO?.sockets?.sockets?.get(p.sid); if (!sock) return; const lang = p.lang || "ko"; sock.emit("bbm:you", tx({ me: p.nick, phase: r.phase, mi: r.mi, st: p.st ? C.publicState(p.st) : null, scene: r.phase === "event" && p.choice == null ? C.publicScene(p.st) : null, bake: r.phase === "bake" && !p.baked ? C.publicBake(p.st) : null, report: p.report, over: p.st ? C.overInfo(p.st) : null, result: p.result || null }, lang)); }
const active = (r) => [...r.players.values()].filter((p) => p.st && !p.st.over);
function setPhase(r, ph, ms, next) { clearTimeout(r.timer); r.phase = ph; r.deadline = ms ? now() + ms : null; if (ms) r.timer = setTimeout(() => { try { next(); } catch (e) { console.error("[bbm] phase", e); } }, ms); emitRoom(r); for (const p of r.players.values()) emitYou(r, p); }
function startMonth(r) {
  if (!active(r).length || r.mi >= r.months) return finishRoom(r);
  r.eventId = C.pickStreetEvent(r, r.mi); r.wx = C.rollWeather(r, C.MONTHS[r.mi]);
  for (const p of active(r)) { p.st.wx = r.wx.slice(); p.choice = null; p.plan = null; p.baked = false; p.report = null; p.st.mi = r.mi; p.st.phase = "event"; p.st.cur = null; C.forceEvent(p.st, r.eventId); if (!p.st.cur) p.choice = -1; }
  if (r.eventId && active(r).some((p) => p.choice == null)) setPhase(r, "event", PH_MS.event, () => endEvent(r)); else endEvent(r);
}
function maybeAdvance(r) { const a = active(r); if (r.phase === "event" && a.every((p) => p.choice != null)) endEvent(r); else if (r.phase === "plan" && a.every((p) => p.plan)) endPlan(r); else if (r.phase === "bake" && a.every((p) => p.baked || p.plan?.closed)) endBake(r); }
function endEvent(r) {
  for (const p of active(r)) if (p.st.phase === "event" && p.st.cur) { C.choose(p.st, p.st.cur.vis[0]); p.choice = p.st.cur?.vis?.[0] ?? 0; }
  for (const p of active(r)) p.st.phase = "plan";
  setPhase(r, "plan", PH_MS.plan, () => endPlan(r));
}
function endPlan(r) {
  const a = active(r);
  for (const p of a) if (!p.plan) p.plan = C.normPlan(p.st, { price: p.st.lastPrice, menus: p.st.lastSale, prep: p.st.lastPrep });
  const open = a.filter((p) => !p.plan.closed), mon = C.MONTHS[r.mi];
  const atr = new Map(open.map((p) => { let x = C.attractOf(p.st, p.plan.price, p.plan.menus) * p.st.mult; if (p.plan.menus.includes("ice") && [5, 6, 7, 8, 9].includes(mon)) x *= 1.9; return [p, x]; }));
  const sum = [...atr.values()].reduce((s, x) => s + x, 0) || 1, total = 22 * C.SEASON[mon] * C.weatherFactor(open[0]?.st || a[0].st, []) * (1 + 0.62 * Math.max(0, open.length - 1));
  for (const p of a) {
    if (p.plan.closed) { const res = C.submitPlan(p.st, { closed: true }); p.report = res.report; p.baked = true; }
    else { const dem = total * (atr.get(p) / sum) * Math.min(1.6, 0.7 + 0.3 * open.length * (atr.get(p) / sum)); C.submitPlan(p.st, p.plan, now(), dem); }
  }
  if (open.length) setPhase(r, "bake", PH_MS.bake, () => endBake(r)); else endBake(r);
}
function endBake(r) {
  for (const p of active(r)) if (!p.baked) { const res = C.submitBake(p.st, {}, now()); p.report = res.report; p.baked = true; }
  r.mi++;
  setPhase(r, "result", PH_MS.result, () => (r.mi >= r.months || !active(r).length ? finishRoom(r) : startMonth(r)));
}
async function finishRoom(r) {
  clearTimeout(r.timer);
  if (r.phase === "over") return;
  for (const p of r.players.values()) if (p.st && !p.st.over) p.st.over = { survived: true, month: C.MONTHS[Math.min(r.months, 12) - 1], mi: r.months - 1 };
  const list = [...r.players.values()].filter((p) => p.st).map((p) => ({ p, d: C.diagnose(p.st) })).sort((a, b) => b.d.score - a.d.score);
  r.ranking = list.map(({ p, d }, i) => ({ rank: i + 1, nick: p.nick, avatar: p.avatar, months: d.months, survived: d.survived, cash: d.cash, profit: d.profit, typeId: d.typeId, type: d.type.n, ic: d.type.ic, cause: d.cause }));
  r.phase = "over"; r.deadline = null;
  const groupId = `${r.code}-${r.created.toString(36)}`;
  for (const { p } of list) {
    const row = buildRow({ key: p.key, me: p.me, prof: { nick: p.nick, age: null, avatar: p.avatar }, prefs: {}, mode: "multi", setKey: groupId, dev: p.dev, st: p.st, isPublic: true, avatarUrl: p.avatarUrl, groupId });
    const id = await saveRow(row);
    p.result = { id, result: publicRow(row, { owner: true }) };
  }
  emitRoom(r); for (const p of r.players.values()) emitYou(r, p);
}

// ---------- 등록 ----------
export function registerBungeo(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  SB = supabaseAdmin; IO = io;
  setInterval(sweep, 5 * 60e3).unref?.();
  setInterval(() => { for (const b of BC.values()) { bcFinalize(b).catch(() => {}); let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= BC_PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) bcDirty(b); } }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = now(), cnt = 0;
    const on = (ev, fn, lim = 60) => socket.on(ev, async (p, cb) => {
      const lang = p && (p.lang === "ja" || p.lang === "en") ? p.lang : "ko";
      const reply = typeof cb === "function" ? (o) => cb(tx(o, lang)) : () => {};
      const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > lim * RL) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply, lang); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const live = (s, rep) => { if (!s.bc) return; const b = BC.get(s.bc); bcPlay(b, key, { nick: s.bcNick, showName: s.bcShow, month: C.MONTHS[Math.min(s.st.mi, 11)], mi: s.st.mi, cash: Math.round(s.st.cash), rep: Math.round(s.st.rep) }); if (rep) { const soldBy = {}; bcLive(b, { ...rep, soldBy: s.lastSoldBy || {} }); } };
    const afterStep = (s, r) => {
      live(s, r.report);
      if (r.over && s.bc) { const b = BC.get(s.bc); if (b && b.row.status !== "final") { b.feed.push({ nick: s.bcShow || b.row.owner_key === key ? s.bcNick || "사장님" : "익명 사장님", months: C.monthsDone(s.st), survived: !!r.over.survived, profit: Math.round(s.st.cash - 2000000), cause: r.over.cause || null, at: now() }); if (b.feed.length > 40) b.feed.shift(); b.playing.delete(key); bcDirty(b); } }
    };

    // ----- 혼자·오늘·방송 -----
    on("bb:begin", async (p, reply) => {
      let mode = p.mode === "daily" ? "daily" : "normal", seed = newSeed(), setKey = null, bc = null, preview = false;
      if (p.bc) { const b = await loadBc(p.bc); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" }); mode = "bc"; seed = Number(b.row.seed) >>> 0; setKey = b.row.id; bc = b.row.id; if (b.starts.has(key)) preview = true; else b.starts.add(key); }
      else if (mode === "daily") { setKey = C.dayKey(); seed = C.hashSeed("bb-daily-" + setKey); const k = `${key}|${setKey}`; if (DAILY_STARTS.has(k)) preview = true; else DAILY_STARTS.set(k, now()); }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt); while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const st = C.newRun(seed); C.nextScene(st);
      const sid = "b" + now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode, setKey, bc, preview, device: device(p.device), createdAt: now(), st, finished: null, bcNick: clean(p.bcNick, 12), bcShow: p.bcShowName !== false };
      SESS.set(sid, s); live(s);
      reply({ ok: true, sid, mode, setKey, phase: st.phase, scene: C.publicScene(st), st: C.publicState(st), core: C.CORE_VERSION });
    });
    on("bb:resume", (p, reply) => { const s = mySess(p.sid); if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" }); reply({ ok: true, mode: s.mode, bc: s.bc, phase: s.st.over ? "over" : s.st.phase, scene: C.publicScene(s.st), bake: C.publicBake(s.st), st: C.publicState(s.st), over: C.overInfo(s.st) }); });
    on("bb:choose", (p, reply) => { const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" }); const r = C.choose(s.st, p.ci); reply(r); });
    on("bb:plan", (p, reply) => { const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" }); const r = C.submitPlan(s.st, p.plan || {}); if (r.ok) { if (r.report) afterStep(s, r); } reply(r); });
    on("bb:bake", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      let res = p.res; try { if (JSON.stringify(res ?? {}).length > 6000) res = {}; } catch { res = {}; }
      const before = { ...s.st.met.sold }, r = C.submitBake(s.st, res, now() + SKEW);
      if (r.ok) { const soldBy = {}; for (const [k, n] of Object.entries(s.st.met.sold)) if (n - (before[k] || 0) > 0) soldBy[k] = n - (before[k] || 0); s.lastSoldBy = soldBy; afterStep(s, r); }   // 서버가 실제로 인정한 판매만
      reply(r);
    });
    on("bb:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (!s.st.over) return reply({ ok: false, error: "NOT_OVER" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      let repeat = !!s.preview;
      if (s.mode === "daily" && SB) { try { const { count } = await SB.from("bb_results").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("mode", "daily").eq("set_key", s.setKey); if (count) repeat = true; } catch {} }
      const row = buildRow({ key, me, prof, prefs, mode: s.mode, setKey: s.setKey, dev: s.device, st: s.st, isPublic: p.isPublic, avatarUrl: mp?.avatar_url, bc: s.bc, flagged: repeat });
      if (repeat) row.diag.repeat = true;
      const saved = await saveRow(row);
      const pct = repeat ? null : await percentile(s.mode === "bc" ? "normal" : s.mode, s.mode === "daily" ? s.setKey : null, row.score);
      s.finished = { id: saved, result: publicRow(row, { owner: true }), pct, repeat };
      if (s.bc) {
        const b = await loadBc(s.bc);
        if (b && b.row.status !== "final" && s.createdAt <= new Date(b.row.closes_at).getTime() && now() <= bcUntil(b) && !b.entries.has(key)) {
          const isStreamer = b.row.owner_key === key;
          const e = { bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: saved, nickname: s.bcNick || prof.nick, show_name: s.bcShow || isStreamer, is_member: !me.isGuest, is_streamer: isStreamer, device: s.device, months: row.months, survived: row.survived, profit: row.profit, score: row.score, cause: row.cause, type_id: row.type_id, flagged: !!s.preview, created_at: new Date().toISOString() };
          b.entries.set(key, e); let ok = true;
          if (SB) { const { error } = await SB.from("bb_bc_entries").insert(e); if (error && String(error.code) !== "23505") { b.entries.delete(key); ok = false; console.error("[bb bc] entry", error.message); } }
          b.playing.delete(key); bcDirty(b);
          s.finished.bc = { id: b.row.id, counted: ok && !isStreamer && !s.preview, streamer: isStreamer, preview: !!s.preview };
        } else s.finished.bc = { id: s.bc, counted: false };
      }
      reply({ ok: true, ...s.finished });
    });
    on("bb:buy", (p, reply) => { const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" }); reply(C.buy(s.st, p.id)); }, 30);
    on("bb:history", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("bb_results").select("id, mode, months, survived, cash, profit, score, cause, type_id, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(30); reply({ ok: true, rows: data || [] }); });
    // 도감·업적: 내 기록 전체(최대 300판)의 수집 목록을 합침
    on("bb:codex", async (_p, reply) => {
      const got = { menus: new Set(), events: new Set(), kinds: new Set(), wx: new Set(), endings: {}, achs: {} }; let runs = 0;
      if (SB) { const { data } = await SB.from("bb_results").select("diag->codex, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(300);
        for (const r of data || []) { const c = r.codex ?? r.diag?.codex; if (!c) continue; runs++; (c.menus || []).forEach((x) => got.menus.add(x)); (c.events || []).forEach((x) => got.events.add(x)); (c.kinds || []).forEach((x) => got.kinds.add(x)); (c.wx || []).forEach((x) => got.wx.add(x)); if (c.ending) got.endings[c.ending] = (got.endings[c.ending] || 0) + 1; for (const a of c.achs || []) got.achs[a] = (got.achs[a] || 0) + 1; } }
      reply({ ok: true, runs, catalog: C.catalog(), got: { menus: [...got.menus], events: [...got.events], kinds: [...got.kinds], wx: [...got.wx], endings: got.endings, achs: got.achs } });
    }, 20);
    on("bb:tr", (p, reply) => { const L = p.lang === "ja" || p.lang === "en" ? p.lang : "ko"; reply({ ok: true, list: (Array.isArray(p.list) ? p.list : []).slice(0, 60).map((x) => trStr(String(x ?? "").slice(0, 300), L)) }); }, 30);

    // ----- 친구 대결 -----
    // 새 소켓(재연결)이면 내가 들어 있던 진행 중 방을 찾아 자동으로 다시 붙임 — 답이 NO_ROOM으로 버려지지 않게
    const myRoom = () => { const r = ROOMS.get(socket.data.bbRoom || ""); if (r && r.players.has(key)) return r;
      let best = null; for (const x of ROOMS.values()) if (x.phase !== "over" && x.phase !== "lobby" && x.players.has(key) && (!best || x.touched > best.touched)) best = x;
      if (!best) return null; const pl = best.players.get(key); pl.sid = socket.id; pl.connected = true; socket.join(`bbm:${best.code}`); socket.data.bbRoom = best.code; return best; };
    const joinRoom = (r, p, lang) => { const pl = r.players.get(key); pl.sid = socket.id; pl.connected = true; pl.lang = lang; socket.join(`bbm:${r.code}`); socket.data.bbRoom = r.code; emitRoom(r); emitYou(r, pl); };
    on("bbm:create", async (p, reply, lang) => {
      if (ROOMS.size >= MAX_ROOMS) return reply({ ok: false, error: "TOO_MANY_ROOMS" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      let code; do code = roomCode(); while (ROOMS.has(code));
      const r = { code, hostKey: key, hostNick: prof.nick, months: [6, 12].includes(Number(p.months)) ? Number(p.months) : 6, rs: newSeed(), seed: 0, phase: "lobby", mi: 0, players: new Map(), timer: null, deadline: null, created: now(), touched: now(), eventId: null, ranking: null };
      r.seed = r.rs;
      r.players.set(key, { key, me, nick: prof.nick, avatar: prof.avatar, avatarUrl: mp?.avatar_url || null, dev: device(p.device), st: null, pk: 0 });
      ROOMS.set(code, r); joinRoom(r, p, lang);
      reply({ ok: true, code });
    }, 20);
    on("bbm:join", async (p, reply, lang) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase().slice(0, 8)); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (!r.players.has(key)) {
        if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
        if (r.players.size >= 8) return reply({ ok: false, error: "ROOM_FULL" });
        const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
        const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
        let nick = prof.nick; const used = new Set([...r.players.values()].map((x) => x.nick)); for (let i = 2; used.has(nick); i++) nick = `${prof.nick.slice(0, 10)}${i}`;
        r.players.set(key, { key, me, nick, avatar: prof.avatar, avatarUrl: mp?.avatar_url || null, dev: device(p.device), st: null, pk: r.players.size });
      }
      joinRoom(r, p, lang); reply({ ok: true, code: r.code });
    }, 20);
    on("bbm:start", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (r.hostKey !== key) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.players.size < 2) return reply({ ok: false, error: "NEED_2" });
      for (const pl of r.players.values()) pl.st = C.newRun(r.seed ^ C.hashSeed(pl.key), { months: r.months });
      reply({ ok: true }); startMonth(r);
    }, 20);
    on("bbm:choose", (p, reply) => { const r = myRoom(); const pl = r?.players.get(key); if (!r || r.phase !== "event" || !pl?.st || pl.choice != null) return reply({ ok: false, error: "BAD_PHASE" }); const res = C.choose(pl.st, p.ci); if (!res.ok) return reply(res); pl.choice = Number(p.ci); reply(res); emitRoom(r); maybeAdvance(r); });
    on("bbm:plan", (p, reply) => { const r = myRoom(); const pl = r?.players.get(key); if (!r || r.phase !== "plan" || !pl?.st || pl.st.over) return reply({ ok: false, error: "BAD_PHASE" }); pl.plan = C.normPlan(pl.st, p.plan || {}); reply({ ok: true, plan: pl.plan }); emitRoom(r); maybeAdvance(r); });
    on("bbm:bake", (p, reply) => {
      const r = myRoom(); const pl = r?.players.get(key); if (!r || r.phase !== "bake" || !pl?.st || pl.baked) return reply({ ok: false, error: "BAD_PHASE" });
      let res = p.res; try { if (JSON.stringify(res ?? {}).length > 6000) res = {}; } catch { res = {}; }
      const out = C.submitBake(pl.st, res, now() + SKEW); if (!out.ok) return reply(out);
      pl.report = out.report; pl.baked = true; reply({ ok: true, report: out.report, over: out.over }); emitRoom(r); maybeAdvance(r);
    });
    on("bbm:buy", (p, reply) => { const r = myRoom(); const pl = r?.players.get(key); if (!r || r.phase !== "plan" || !pl?.st || pl.plan) return reply({ ok: false, error: "BAD_PHASE" }); reply(C.buy(pl.st, p.id)); emitRoom(r); }, 30);
    on("bbm:leave", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(`bbm:${r.code}`); socket.data.bbRoom = null; if (r.phase === "lobby") { r.players.delete(key); if (r.hostKey === key) { const nx = r.players.values().next().value; if (nx) { r.hostKey = nx.key; r.hostNick = nx.nick; } else { ROOMS.delete(r.code); return reply({ ok: true }); } } } else { const pl = r.players.get(key); if (pl) pl.connected = false; } emitRoom(r); reply({ ok: true }); });
    socket.on("disconnect", () => { const r = ROOMS.get(socket.data.bbRoom || ""); const pl = r?.players.get(key); if (pl && pl.sid === socket.id) { pl.connected = false; if (r.phase === "lobby") { const sid0 = socket.id; setTimeout(() => { const cur = r.players.get(key); if (!cur || cur.connected || cur.sid !== sid0 || r.phase !== "lobby" || ROOMS.get(r.code) !== r) return; r.players.delete(key); if (r.hostKey === key) { const nx = r.players.values().next().value; if (nx) { r.hostKey = nx.key; r.hostNick = nx.nick; } else { ROOMS.delete(r.code); return; } } emitRoom(r); }, LOBBY_GRACE).unref?.(); } emitRoom(r); } });   // 대기실에서 잠깐 끊긴 건 20초 기다려 줌 (예전엔 바로 빠져서 혼자 있던 방장의 방이 사라졌음)

    // ----- 방송 진단소 -----
    on("bb:bc:create", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) { if (!clean(p.streamerNick, 16)) return reply({ ok: false, error: "NEED_NICK" }); const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < GUEST_IP_WIN); if (arr.length >= GUEST_IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" }); ipMakes.set(ip, arr); }
      const mins = Math.min(BC_MAX_MIN, Math.max(5, Math.round(Number(p.minutes) || 40)));
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const nick = clean(p.streamerNick, 16) || clean(mp?.nickname, 16) || "스트리머", title = clean(p.title, 40) || `${nick} 방송 붕어빵 거리`;
      const { count } = await SB.from("bb_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN" });
      const row = { id: idNew(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, seed: newSeed(), core_ver: C.CORE_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), created_at: new Date().toISOString() };
      const { error } = await SB.from("bb_broadcasts").insert(row);
      if (error) { console.error("[bb bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      SB.from("streamer_chat_log").insert({ platform: "bungeo", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null) }).then(({ error: le }) => { if (le) console.error("[bb bc] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), preds: new Map(), playing: new Map(), feed: [], live: { cust: 0, served: 0, revenue: 0, months: 0, menus: {}, prices: [] }, stats: null, dirty: true, at: 0, timer: null, starts: new Set() });
      reply({ ok: true, bc: { id: row.id, title, streamer_nick: nick, closes_at: row.closes_at } });
    }, 20);
    on("bb:bc:mine", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("bb_broadcasts").select("id, title, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20); reply({ ok: true, rows: data || [] }); });
    on("bb:bc:watch", async (p, reply) => { const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); await bcFinalize(b); socket.join(`bb:bc:${b.row.id}`); const pred = b.preds.get(key) || null; reply({ ok: true, stats: bcGet(b), owner: b.row.owner_key === key, myGuess: pred ? pred.guess : null }); });
    on("bb:bc:predict", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" }); if (b.preds.has(key)) return reply({ ok: false, error: "ALREADY" });
      const guess = Math.round(Number(p.guess) * 10) / 10; if (!(guess >= 1 && guess <= 12)) return reply({ ok: false, error: "BAD_GUESS" });
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const x = { bc_id: b.row.id, owner_key: key, nickname: clean(mp?.nickname || p.nick, 12) || "시청자", guess, created_at: new Date().toISOString() };
      b.preds.set(key, x); if (SB) { const { error } = await SB.from("bb_bc_predictions").insert(x); if (error && String(error.code) !== "23505") { b.preds.delete(key); return reply({ ok: false, error: "SAVE_FAIL" }); } }
      bcDirty(b); reply({ ok: true, guess });
    }, 20);
    on("bb:bc:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" }); if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") { const mins = Math.min(BC_MAX_MIN, Math.max(1, Math.round(Number(p.minutes) || 10))); b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString(); if (SB) await SB.from("bb_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "close") { b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString(); if (SB) await SB.from("bb_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "finalize") { if (bcOpen(b)) return reply({ ok: false, error: "STILL_OPEN" }); await bcFinalize(b, true); }
      else return reply({ ok: false, error: "BAD_ACTION" });
      bcDirty(b); reply({ ok: true, stats: bcGet(b) });
    }, 20);
  });

  if (!app) return;
  const isMine = async (req, row) => { const user = getOptionalUser ? await getOptionalUser(req) : null; const g = String(req.headers["x-bb-guest"] || ""); return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`); };
  app.get("/bb/result/:id", async (req, res) => {
    try { if (!SB) return res.status(503).json({ ok: false, error: "NO_DB" }); const { data: row, error } = await SB.from("bb_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle(); if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" }); if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" }); const mine = await isMine(req, row); if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" }); res.json(tx({ ok: true, result: publicRow(row, { owner: mine }) }, req.query.lang)); }
    catch (e) { console.error("[bb/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  const rankCache = new Map();
  app.get("/bb/ranking", async (req, res) => {
    try {
      if (!SB) return res.json({ ok: true, rows: [] });
      const mode = ["daily", "multi"].includes(req.query.mode) ? req.query.mode : "normal", board = req.query.board === "streamer" ? "streamer" : "all";
      const setKey = mode === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.dayKey()) : null;
      const ck = JSON.stringify([mode, board, setKey]); const hit = rankCache.get(ck); if (hit && now() - hit.at < 30000) return res.json(tx(hit.body, req.query.lang));
      let q = SB.from("bb_results").select("id, owner_key, user_id, nickname, avatar, months, survived, cash, profit, score, cause, type_id, is_streamer").eq("mode", mode).eq("is_public", true).eq("flagged", false);
      if (setKey) q = q.eq("set_key", setKey); if (board === "streamer") q = q.eq("is_streamer", true);
      const { data, error } = await q.order("score", { ascending: false }).limit(500); if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = []; for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, months: r.months, survived: r.survived, cash: r.cash, profit: r.profit, cause: r.cause, typeId: r.type_id, type: C.TYPES[r.type_id]?.n || "", ic: C.TYPES[r.type_id]?.ic || "", isGuest: !r.user_id, streamer: !!r.is_streamer }); if (rows.length >= 50) break; }
      const body = { ok: true, mode, board, setKey, rows }; rankCache.set(ck, { at: now(), body }); if (rankCache.size > 100) rankCache.clear(); res.json(tx(body, req.query.lang));
    } catch (e) { console.error("[bb/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/bb/bc/:id", async (req, res) => { try { const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); await bcFinalize(b); res.json({ ok: true, stats: bcGet(b) }); } catch (e) { res.status(500).json({ ok: false, error: "INTERNAL" }); } });
  app.get("/bb/bc/:id/rank", async (req, res) => {
    try { const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); const from = Math.max(0, Math.min(1000, parseInt(req.query.from, 10) || 0)), n = Math.max(1, Math.min(50, parseInt(req.query.n, 10) || 50));
      const list = [...b.entries.values()].filter((e) => !e.flagged && !e.is_streamer).sort((x, y) => y.score - x.score); const end = Math.min(list.length, from + n, 1000), rows = [];
      for (let i = from; i < end; i++) { const e = list[i]; rows.push({ rank: i + 1, nick: nameOf(e), months: e.months, survived: e.survived, profit: e.profit, cause: e.cause }); } res.json({ ok: true, total: list.length, from, rows, more: end < Math.min(list.length, 1000) }); }
    catch (e) { res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _bbTest = { SESS, BC, ROOMS };
