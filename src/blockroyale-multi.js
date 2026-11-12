// =========================
// 플듀 블록로얄 — 2~50인 실시간 대전 서버 (이벤트 br:*)
// 내 판은 브라우저가 바로 움직이고(즉시 반응), 조각이 고정될 때마다 조작 기록을 서버로 보냄.
// 서버는 같은 엔진(br-core.js)으로 조작을 다시 돌려 판·줄·점수·공격을 직접 계산한다.
//  → 점수·공격·KO·순위는 클라이언트 값을 받지 않음. 어긋나면 서버 판으로 다시 맞춤(resync).
// 방별로 상태가 나뉘고, 순위·판 변경은 모아서 주기적으로 전송(50인 방 1초 / 작은 방 0.25초).
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicList } from "./public-rooms.js";
import { BRGame, encodeBoard } from "./br-core.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
export const BR = {
  modes: ["battle", "score", "team"], maxPlayers: 50, timeBattle: [0, 180, 300, 600], timeScore: [120, 180, 300], countdown: [3, 5, 10], atkMul: [0.5, 1, 1.5, 2], startLv: [1, 5, 10], teams: [2],
  emptyTtl: 30_000, grace: 20_000, lobbyGrace: 8000, afk: 40_000, tickBig: 1000, tickSmall: 250, bigAt: 9, garbageDelay: 1200, forceAck: 6000,
  lockCap: 25, lockRefill: 12, maxOps: 800, koWindow: 20_000, focusLimit: 14, maxInvalid: 25, specExtra: 30,
};
const STATUS = { active: 0, dead: 1, left: 2, spec: 3 };
const sr = (id) => `br:${id}`, srB = (id) => `br:${id}:boards`;
const isBig = (r) => r.order.length >= BR.bigAt;
const clampName = (s) => String(s || "익명").slice(0, 14);
const genCode = () => { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); };
function newPlayer(name, isGuest, avatar, socketId, idx, ip) { return { name: clampName(name), isGuest: !!isGuest, avatar_url: avatar || null, connected: true, socketId, idx, ip, ready: false, team: null, status: "active", wantSpec: false, target: "random", manual: null, curTarget: null, game: null, board: "0|", rev: 0, gseq: 0, inbox: [], kos: 0, assists: 0, recv: 0, sent: 0, maxAtk: 0, tetra: 0, tspins: 0, perfects: 0, place: 0, deadAt: 0, survived: 0, comeback: 0, hits: new Map(), bucket: BR.lockCap, bucketAt: 0, lastLock: 0, invalid: 0, resyncs: 0, dirtyRow: true, dirtyBoard: false, watch: null, watchers: 0, lastCur: 0, vis: null, dcTimer: null }; }
const pub = (u, p) => ({ playerId: u, idx: p.idx, nickname: p.name, isGuest: p.isGuest, avatar_url: p.avatar_url, connected: p.connected, ready: p.ready, team: p.team, status: p.status, wantSpec: p.wantSpec, place: p.place, kos: p.kos, assists: p.assists, sent: p.sent, score: p.game?.score || 0, lines: p.game?.lines || 0, maxCombo: p.game?.maxCombo || 0, pieces: p.game?.pieces || 0, survived: p.survived, maxAtk: p.maxAtk, tetra: p.tetra, tspins: p.tspins, perfects: p.perfects });
const pubOpts = (r) => { const { password, ...o } = r.opts; return { ...o, hasPassword: !!password }; };
const pubRoom = (r) => ({ id: r.id, inviteCode: r.inviteCode, hostUserId: r.hostUserId, status: r.status, opts: pubOpts(r), startsAt: r.startsAt, deadline: r.deadline, total: r.total, players: r.order.map((u) => pub(u, r.players.get(u))) });
const emitRoom = (io, r) => io.to(sr(r.id)).emit("br:roomState", pubRoom(r));
const actives = (r) => [...r.players.entries()].filter(([, p]) => p.status === "active");
const row = (p) => [p.idx, p.game?.score || 0, p.game?.lines || 0, p.kos, Math.max(0, p.game?.combo ?? 0), STATUS[p.status] ?? 1, p.game ? p.game.height() : 0, p.sent, p.connected ? 1 : 0, p.place, p.game?.pendingGarbage?.() || 0];

// 방 순위: 경기 방식마다 따로
export function rankOf(r) {
  const list = r.order.filter((u) => r.players.get(u)?.status !== "spec"), P = (u) => r.players.get(u);
  const byScore = (a, b) => (P(b).game?.score || 0) - (P(a).game?.score || 0) || (P(b).game?.lines || 0) - (P(a).game?.lines || 0) || (P(a).game?.pieces || 0) - (P(b).game?.pieces || 0) || P(b).survived - P(a).survived;
  if (r.opts.mode === "score") return list.sort(byScore);
  const surv = (a, b) => { const x = P(a), y = P(b), ax = x.status === "active", ay = y.status === "active"; if (ax !== ay) return ax ? -1 : 1; if (ax) return y.kos - x.kos || byScore(a, b); return (y.deadAt || 0) - (x.deadAt || 0) || byScore(a, b); };
  if (r.opts.mode === "team" && r.winTeam != null) return list.sort((a, b) => (P(a).team === r.winTeam ? 0 : 1) - (P(b).team === r.winTeam ? 0 : 1) || surv(a, b));
  return list.sort(surv);
}
function clearTimers(r) { for (const k of ["gameTimer", "tickTimer", "startTimer"]) if (r[k]) { clearTimeout(r[k]); clearInterval(r[k]); r[k] = null; } for (const p of r.players.values()) if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; } }
function delRoom(io, r, reason) { if (r.emptyTimer) clearTimeout(r.emptyTimer); clearTimers(r); rooms.delete(r.id); invites.delete(r.inviteCode); for (const u of r.order) if (userRoom.get(u) === r.id) userRoom.delete(u); io.to(sr(r.id)).emit("br:roomClosed", { reason }); io.in(sr(r.id)).socketsLeave(sr(r.id)); io.in(srB(r.id)).socketsLeave(srB(r.id)); }
function scheduleEmpty(io, r) { if ([...r.players.values()].some((p) => p.connected) || r.emptyTimer) return; r.emptyTimer = setTimeout(() => { r.emptyTimer = null; const x = rooms.get(r.id); if (x && ![...x.players.values()].some((p) => p.connected)) delRoom(io, x, "EMPTY"); }, BR.emptyTtl); }

// ---- 순위·판 모아 보내기
function flush(io, r) {
  if (r.status !== "playing") return; const rows = [], boards = [];
  for (const p of r.players.values()) { if (p.status === "spec") continue; if (p.dirtyRow) { rows.push(row(p)); p.dirtyRow = false; } if (p.dirtyBoard) { boards.push([p.idx, p.board]); p.dirtyBoard = false; } }
  const alive = actives(r).length;
  if (rows.length) { io.to(sr(r.id)).emit("br:tick", { a: alive, t: Date.now(), r: rows }); r.net.tick += 1; }
  if (boards.length) {
    io.to(srB(r.id)).emit("br:boards", boards);
    // 폰 등 일부만 보는 사람에게는 고른 상대 판만
    const idxSet = new Map(boards);
    for (const p of r.players.values()) { if (!p.connected || !p.vis || !p.socketId) continue; const mine = p.vis.filter((i) => idxSet.has(i)).map((i) => [i, idxSet.get(i)]); if (mine.length) io.to(p.socketId).emit("br:boards", mine); }
  }
}
function startTicks(io, r) { if (r.tickTimer) clearInterval(r.tickTimer); r.tickTimer = setInterval(() => { try { flush(io, r); afkSweep(io, r); } catch (e) { console.error("[br] tick", e); } }, isBig(r) ? BR.tickBig : BR.tickSmall); }
function afkSweep(io, r) { const t = Date.now(); if (t < r.startsAt) return; for (const [u, p] of r.players) if (p.status === "active" && p.connected && t - Math.max(p.lastLock, r.startsAt) > BR.afk) kill(io, r, u, "dead", "AFK"); }

// ---- 탈락 · KO (서버가 확정, 한 사람은 한 번만)
function kill(io, r, uid, status = "dead", cause = "") {
  const p = r.players.get(uid); if (!p || p.status !== "active") return; const now = Date.now();
  p.status = status; p.deadAt = now; p.survived = Math.max(0, Math.round((now - r.startsAt) / 1000)); p.place = actives(r).length + 1; p.dirtyRow = true; p.dirtyBoard = true;
  // KO: 최근 공격 기여가 가장 큰 사람에게 1, 나머지 기여자는 도움
  let by = null, best = 0; const assist = [];
  for (const [from, h] of p.hits) { if (now - h.at > BR.koWindow || from === uid) continue; if (h.n > best) { if (by) assist.push(by); by = from; best = h.n; } else assist.push(from); }
  if (r.opts.mode === "score") { by = null; assist.length = 0; }
  if (by) { const k = r.players.get(by); if (k) { k.kos++; k.dirtyRow = true; } } for (const a of assist) { const k = r.players.get(a); if (k) k.assists++; }
  io.to(sr(r.id)).emit("br:dead", { i: p.idx, place: p.place, by: by ? r.players.get(by)?.idx : null, status, cause, alive: actives(r).length, score: p.game?.score || 0 });
  for (const w of r.players.values()) if (w.manual === uid) w.manual = null;
  checkEnd(io, r);
}
function checkEnd(io, r) {
  if (r.status !== "playing") return; const al = actives(r), n = al.length;
  if (r.opts.mode === "team") { const t = new Set(al.map(([, p]) => p.team)); if (t.size <= 1) { r.winTeam = n ? al[0][1].team : lastTeam(r); finish(io, r, "TEAM_WIN"); } return; }
  if (n === 0) return finish(io, r, "ALL_DEAD");
  if (r.opts.mode === "battle" && n === 1) finish(io, r, "LAST_STANDING");
}
function lastTeam(r) { let best = null, at = -1; for (const p of r.players.values()) if (p.team != null && p.deadAt > at) { at = p.deadAt; best = p.team; } return best; }
function finish(io, r, reason) {
  if (r.status !== "playing") return; flush(io, r); r.status = "ended"; const now = Date.now(); clearTimers(r);
  for (const p of r.players.values()) if (p.status === "active") p.survived = Math.round((now - r.startsAt) / 1000);
  if (r.opts.mode === "team" && r.winTeam == null) { const st = {}; for (const p of r.players.values()) if (p.team != null) { st[p.team] = st[p.team] || { a: 0, k: 0, s: 0 }; if (p.status === "active") st[p.team].a++; st[p.team].k += p.kos; st[p.team].s += p.game?.score || 0; } r.winTeam = +Object.keys(st).sort((a, b) => st[b].a - st[a].a || st[b].k - st[a].k || st[b].s - st[a].s)[0]; }
  if (!r.players.get(r.hostUserId)?.connected) { const nx = r.order.find((u) => r.players.get(u)?.connected); if (nx) r.hostUserId = nx; }
  const order = rankOf(r); let last = null, place = 0;
  order.forEach((u, i) => { const p = r.players.get(u); const tie = r.opts.mode === "score" && last && last.game?.score === p.game?.score && last.game?.lines === p.game?.lines && last.game?.pieces === p.game?.pieces; if (!tie) place = i + 1; p.place = place; last = p; });
  const ranking = order.map((u) => pub(u, r.players.get(u)));
  const mvp = order.slice().sort((a, b) => { const x = r.players.get(a), y = r.players.get(b); return (y.kos * 3 + y.sent) - (x.kos * 3 + x.sent) || (y.game?.score || 0) - (x.game?.score || 0); })[0] || null;
  io.to(sr(r.id)).emit("br:ended", { reason, mode: r.opts.mode, winTeam: r.winTeam ?? null, total: r.total, durationSec: Math.round((now - r.startsAt) / 1000), mvp, ranking, rematch: r.opts.rematch });
  emitRoom(io, r); r.onFinish?.(r, ranking, now);
  for (const p of r.players.values()) { p.game = p.game ? { score: p.game.score, lines: p.game.lines, maxCombo: p.game.maxCombo, pieces: p.game.pieces, height: () => 0, pendingGarbage: () => 0 } : null; p.inbox = []; p.hits = new Map(); }
}
function leave(io, r, uid) {
  if (!r.players.has(uid)) return; const wasHost = r.hostUserId === uid, p = r.players.get(uid); if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; }
  if (userRoom.get(uid) === r.id) userRoom.delete(uid);
  if (r.status === "playing") { p.connected = false; p.socketId = null; if (p.status === "active") kill(io, r, uid, "left"); else if (p.status !== "spec") p.status = "left"; else { r.players.delete(uid); r.order.splice(r.order.indexOf(uid), 1); } }
  else { r.players.delete(uid); const i = r.order.indexOf(uid); if (i >= 0) r.order.splice(i, 1); }
  if (!rooms.has(r.id)) return;
  if (wasHost) { const next = r.order.find((u) => { const x = r.players.get(u); return x && x.connected; }); if (next) r.hostUserId = next; }
  if (!r.order.length) return delRoom(io, r, "ALL_LEFT");
  if (![...r.players.values()].some((x) => x.connected)) scheduleEmpty(io, r);
  emitRoom(io, r);
}
function tellWatched(io, r) { const c = new Map(); for (const p of r.players.values()) if (p.watch && p.connected) c.set(p.watch, (c.get(p.watch) || 0) + 1); for (const [u, p] of r.players) { const n = c.get(u) || 0; if (n !== p.watchers) { p.watchers = n; if (p.socketId) io.to(p.socketId).emit("br:watched", { n }); } } }
// ---- 공격: 대상 고르기 (한 사람에게 몰리지 않게 분산)
function pickTarget(r, uid, p) {
  const foes = actives(r).filter(([u, x]) => u !== uid && x.connected && (r.opts.mode !== "team" || x.team !== p.team)); if (!foes.length) return null;
  const load = ([, x]) => x.game.pendingGarbage() + x.inbox.reduce((a, b) => a + b.n, 0), calm = foes.filter((f) => load(f) < BR.focusLimit), pool = calm.length ? calm : foes;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)]; let t = null, now = Date.now();
  if (p.target === "manual" && p.manual) { const f = foes.find(([u]) => u === p.manual); if (f) return f; }
  if (p.target === "attacker") { const a = pool.filter(([u]) => { const h = p.hits.get(u); return h && now - h.at < BR.koWindow; }); t = a.length ? rnd(a) : null; }
  else if (p.target === "ko") { const m = Math.max(...pool.map(([, x]) => x.kos)); t = rnd(pool.filter(([, x]) => x.kos === m)); }
  else if (p.target === "danger") { t = pool.slice().sort((a, b) => (b[1].game.height() + load(b)) - (a[1].game.height() + load(a)))[0]; }
  return t || rnd(pool);
}
// 후반으로 갈수록 공격이 세짐 (배틀로얄·팀전만)
const stageMul = (r) => { const a = actives(r).length, t = r.total; if (t < 3) return 1; if (a <= 2) return 1.5; if (a <= 5 && t > 5) return 1.25; if (a <= 10 && t > 10) return 1.1; return 1; };
function deliver(io, r, uid, p, raw) {
  if (r.opts.mode === "score") return; p.atkFrac = (p.atkFrac || 0) + raw * r.opts.atkMul * stageMul(r); const n = Math.min(20, Math.floor(p.atkFrac)); if (n <= 0) return; p.atkFrac -= n;
  const t = pickTarget(r, uid, p); if (!t) return; const [tu, tp] = t, now = Date.now(); p.curTarget = tu; p.sent += n; p.maxAtk = Math.max(p.maxAtk, n); p.dirtyRow = true; tp.recv += n;
  const pk = { s: ++tp.gseq, n, at: now }; tp.inbox.push(pk); const h = tp.hits.get(uid) || { n: 0, at: 0 }; h.n += n; h.at = now; tp.hits.set(uid, h); tp.dirtyRow = true;
  if (tp.socketId) io.to(tp.socketId).emit("br:garbage", { s: pk.s, n, f: p.idx, d: BR.garbageDelay });
  if (p.socketId) io.to(p.socketId).emit("br:hit", { to: tp.idx, n });
}
function resync(io, p, reason) { p.rev++; p.resyncs++; const g = p.game; if (!g) return; for (const k of p.inbox) g.addGarbage(k.n, k.s, Date.now() - k.at >= BR.garbageDelay); p.inbox = []; g.takeEvents(); if (p.socketId) io.to(p.socketId).emit("br:resync", { rev: p.rev, gseq: p.gseq, state: g.save(), reason }); }
function sendBoardToWatchers(io, r, uid, p) { const g = p.game, msg = { i: p.idx, s: p.board, n: g.pieces, q: g.next(5), h: g.hold, st: [g.score, g.lines, g.level, Math.max(0, g.combo), g.b2b ? 1 : 0], c: g.cur ? [g.cur.p, g.cur.r, g.cur.x, g.cur.y, g.pieces] : null, g: g.pendingGarbage() }; for (const w of r.players.values()) if (w.watch === uid && w.connected && w.socketId) io.to(w.socketId).emit("br:watchBoard", msg); }

// ---- 시즌 기록 (회원만, 서버가 확정한 값만). 테이블이 없어도 게임에는 영향 없음
export const seasonKey = (t = Date.now()) => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
async function saveRecords(sa, r, ranking, now) {
  if (!sa) return; const dur = (now - r.startsAt) / 1000; if (dur < 30 || ranking.length < 2) return; const mode = r.opts.mode, seasons = [seasonKey(now), "all"]; const members = ranking.filter((x) => !x.isGuest && String(x.playerId).length >= 30); if (!members.length) return;
  try {
    const ids = members.map((m) => m.playerId), { data, error } = await sa.from("br_records").select("*").in("user_id", ids).in("season", seasons).eq("mode", mode); if (error) { if (!/does not exist|schema cache/i.test(error.message || "")) console.error("[br] records read", error.message); return; }
    const old = new Map((data || []).map((d) => [`${d.user_id}|${d.season}`, d])), rows = [];
    for (const m of members) for (const s of seasons) { const o = old.get(`${m.playerId}|${s}`) || {}, win = mode === "team" ? m.team === r.winTeam : m.place === 1; rows.push({ season: s, mode, user_id: m.playerId, nickname: m.nickname, games: (o.games || 0) + 1, wins: (o.wins || 0) + (win ? 1 : 0), top3: (o.top3 || 0) + (m.place <= 3 ? 1 : 0), kos: (o.kos || 0) + m.kos, points: (o.points || 0) + Math.max(1, Math.round((ranking.length - m.place + 1) / ranking.length * 20)) + m.kos * 3 + (win ? 15 : 0), best_score: Math.max(o.best_score || 0, m.score), best_combo: Math.max(o.best_combo || 0, m.maxCombo), best_kos: Math.max(o.best_kos || 0, m.kos), best_survival_sec: Math.max(o.best_survival_sec || 0, m.survived), best_lines: Math.max(o.best_lines || 0, m.lines), updated_at: new Date(now).toISOString() }); }
    const { error: e2 } = await sa.from("br_records").upsert(rows, { onConflict: "season,mode,user_id" }); if (e2) console.error("[br] records write", e2.message);
  } catch (e) { console.error("[br] records", e); }
}

export function registerBlockRoyale(io, supabaseAdmin, app) {
  const profile = async (me) => { if (me.isGuest || !supabaseAdmin) return {}; try { const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); return data || {}; } catch { return {}; } };
  // 시즌 랭킹 (1분 캐시)
  if (app) { const cache = new Map(); app.get("/blockroyale/ranking", async (req, res) => {
    try { const mode = BR.modes.includes(req.query.mode) ? req.query.mode : "battle", season = /^(all|\d{4}-\d{2})$/.test(String(req.query.season || "")) ? String(req.query.season) : seasonKey(), sort = ["points", "wins", "kos", "best_score", "best_survival_sec", "best_combo"].includes(req.query.sort) ? req.query.sort : "points", k = `${mode}|${season}|${sort}`, c = cache.get(k); if (c && Date.now() - c.at < 60_000) return res.json(c.body);
      const { data, error } = await supabaseAdmin.from("br_records").select("nickname,games,wins,top3,kos,points,best_score,best_combo,best_kos,best_survival_sec,best_lines").eq("mode", mode).eq("season", season).order(sort, { ascending: false }).limit(100);
      const body = error ? { ok: true, season, rows: [], notReady: true } : { ok: true, season, rows: data || [] }; cache.set(k, { at: Date.now(), body }); res.json(body);
    } catch (e) { console.error("[br] ranking", e); res.status(500).json({ ok: false }); } }); }

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); return id ? rooms.get(id) : null; };
    const hostRoom = (cb) => { const r = myRoom(); if (!r) { cb?.({ ok: false, error: "NOT_IN_ROOM" }); return null; } if (r.hostUserId !== me.id) { cb?.({ ok: false, error: "NOT_HOST" }); return null; } return r; };
    const fn = (cb) => (typeof cb === "function" ? cb : () => {});
    const attachSocket = (r, p) => { if (p.socketId && p.socketId !== socket.id) { const old = io.sockets.sockets.get(p.socketId); if (old) { old.emit("br:replaced", {}); old.leave(sr(r.id)); old.leave(srB(r.id)); } } p.socketId = socket.id; p.connected = true; socket.join(sr(r.id)); if (!p.vis) socket.join(srB(r.id)); userRoom.set(me.id, r.id); if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } };
    const allBoards = (r) => [...r.players.values()].filter((p) => p.status !== "spec").map((p) => [p.idx, p.board]);

    socket.on("br:createRoom", async (payload, cb) => {
      { const f = createFlight("br", me?.id, fn(cb)); if (!f) return; cb = f; }
      try {
        // (2026-11-12) 게스트도 방 만들기 가능 — 도배는 index.js 소켓 가드가 막음
        const old = myRoom(); if (old) leave(io, old, me.id);
        const id = `br_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, inviteCode = genCode();
        const r = { id, inviteCode, hostUserId: me.id, status: "lobby", opts: { mode: "battle", maxPlayers: 50, isPublic: false, password: "", allowSpectate: true, countdown: 5, atkMul: 1, startLevel: 1, gameTimeSec: 0, teamCount: 2, rematch: true }, startsAt: null, deadline: null, total: 0, nextIdx: 0, players: new Map(), order: [], emptyTimer: null, gameTimer: null, tickTimer: null, net: { tick: 0 }, onFinish: (rr, rk, now) => saveRecords(supabaseAdmin, rr, rk, now) };
        rooms.set(id, r); invites.set(inviteCode, id);
        const d = await profile(me); r.players.set(me.id, newPlayer(d.nickname || payload?.nickname || "방장", false, d.avatar_url, socket.id, r.nextIdx++)); r.players.get(me.id).ready = true; r.order.push(me.id); attachSocket(r, r.players.get(me.id));
        cb({ ok: true, roomId: id, inviteCode, playerId: me.id, room: pubRoom(r) }); emitRoom(io, r);
      } catch (e) { console.error("[br:createRoom]", e); cb({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("br:joinRoom", async (payload, cb) => {
      cb = fn(cb);
      const reJoinFresh = () => socket.listeners("br:joinRoom")[0](payload, cb);
      try {
        const r = rooms.get(invites.get(String(payload?.inviteCode || "").trim())); if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
        // 재접속: 같은 사람이면 경기 상태 그대로 복구, 예전 창은 끊음
        if (r.players.has(me.id)) {
          const p = r.players.get(me.id); if (p.status === "left" && r.status === "playing") return cb({ ok: false, error: "GAME_ALREADY_STARTED" });
          if (p.status === "left") { r.players.delete(me.id); r.order.splice(r.order.indexOf(me.id), 1); return reJoinFresh(); }
          if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; } attachSocket(r, p); const resume = r.status === "playing" && p.game ? { rev: ++p.rev, gseq: p.gseq, state: (() => { for (const k of p.inbox) p.game.addGarbage(k.n, k.s, Date.now() - k.at >= BR.garbageDelay); p.inbox = []; return p.game.save(); })(), boards: allBoards(r), rows: [...r.players.values()].filter((x) => x.status !== "spec").map(row), alive: actives(r).length, serverNow: Date.now() } : null;
          if (r.status === "playing" && p.status !== "active" && !resume) { /* 관전 복귀 */ }
          p.dirtyRow = true; cb({ ok: true, roomId: r.id, inviteCode: r.inviteCode, playerId: me.id, room: pubRoom(r), rejoined: true, resume, spectate: r.status === "playing" && p.status !== "active" ? { boards: allBoards(r), rows: [...r.players.values()].filter((x) => x.status !== "spec").map(row), alive: actives(r).length, serverNow: Date.now() } : null }); emitRoom(io, r); return;
        }
        if (r.opts.password && String(payload?.password || "") !== r.opts.password) return cb({ ok: false, error: payload?.password ? "BAD_PASSWORD" : "NEED_PASSWORD" });
        const playing = r.status === "playing";
        if (playing && !r.opts.allowSpectate) return cb({ ok: false, error: "GAME_ALREADY_STARTED" });
        const specs = [...r.players.values()].filter((p) => p.status === "spec").length, seats = [...r.players.values()].filter((p) => p.status !== "spec").length;
        if (playing ? specs >= BR.specExtra : seats >= r.opts.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
        const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
        const d = await profile(me); if (!rooms.has(r.id)) return cb({ ok: false, error: "ROOM_NOT_FOUND" }); if (!playing && [...r.players.values()].filter((p) => p.status !== "spec").length >= r.opts.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" }); if (r.players.has(me.id)) return reJoinFresh(); // 두 번 눌러 동시에 온 입장은 재입장으로
        const p = newPlayer(d.nickname || payload?.nickname || (me.isGuest ? "게스트" : "유저"), me.isGuest, d.avatar_url, socket.id, r.nextIdx++); if (playing) p.status = "spec"; r.players.set(me.id, p); r.order.push(me.id); attachSocket(r, p);
        cb({ ok: true, roomId: r.id, inviteCode: r.inviteCode, playerId: me.id, room: pubRoom(r), spectate: playing ? { boards: allBoards(r), rows: [...r.players.values()].filter((x) => x.status !== "spec").map(row), alive: actives(r).length, serverNow: Date.now() } : null }); emitRoom(io, r);
      } catch (e) { console.error("[br:joinRoom]", e); cb({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("br:listRooms", (_p, cb) => { cb = fn(cb); const list = [...rooms.values()].filter((r) => r.opts.isPublic && r.status !== "ended").slice(0, 30).map((r) => ({ code: r.inviteCode, mode: r.opts.mode, n: r.order.length, max: r.opts.maxPlayers, status: r.status, spectate: r.opts.allowSpectate, locked: !!r.opts.password, host: r.players.get(r.hostUserId)?.name || "" })); cb({ ok: true, list }); });

    socket.on("br:setOptions", (o, cb) => {
      cb = fn(cb); const r = hostRoom(cb); if (!r) return; if (r.status === "playing") return cb({ ok: false, error: "NOT_LOBBY" }); const q = r.opts;
      if (o?.maxPlayers !== undefined) { const n = Math.round(+o.maxPlayers); if (!(n >= 2 && n <= BR.maxPlayers)) return cb({ ok: false, error: "INVALID_MAX" }); if (n < r.order.length) return cb({ ok: false, error: "BELOW_CURRENT" }); q.maxPlayers = n; }
      if (BR.modes.includes(o?.mode) && q.mode !== o.mode) { q.mode = o.mode; q.gameTimeSec = o.mode === "score" ? 120 : 0; for (const p of r.players.values()) p.team = null; }
      if (o?.gameTimeSec !== undefined && (q.mode === "score" ? BR.timeScore : BR.timeBattle).includes(+o.gameTimeSec)) q.gameTimeSec = +o.gameTimeSec;
      if (BR.countdown.includes(+o?.countdown)) q.countdown = +o.countdown; if (BR.atkMul.includes(+o?.atkMul)) q.atkMul = +o.atkMul; if (BR.startLv.includes(+o?.startLevel)) q.startLevel = +o.startLevel;
      for (const k of ["isPublic", "allowSpectate", "rematch"]) if (typeof o?.[k] === "boolean") q[k] = o[k];
      if (typeof o?.password === "string") q.password = o.password.slice(0, 20);
      emitRoom(io, r); cb({ ok: true });
    });
    socket.on("br:setReady", (d, cb) => { cb = fn(cb); const r = myRoom(); if (!r || r.status === "playing") return cb({ ok: false }); const p = r.players.get(me.id); if (!p) return cb({ ok: false }); p.ready = !!d?.ready; p.wantSpec = !!d?.spectate && r.hostUserId !== me.id; emitRoom(io, r); cb({ ok: true }); });
    socket.on("br:setTeam", (d, cb) => { cb = fn(cb); const r = myRoom(); if (!r || r.status === "playing" || r.opts.mode !== "team") return cb({ ok: false }); const t = +d?.team, target = d?.userId && r.hostUserId === me.id ? r.players.get(String(d.userId)) : r.players.get(me.id); if (!target || !(t === 0 || t === 1)) return cb({ ok: false }); target.team = t; emitRoom(io, r); cb({ ok: true }); });
    socket.on("br:autoTeams", (_d, cb) => { cb = fn(cb); const r = hostRoom(cb); if (!r || r.status === "playing") return; const us = r.order.slice().sort(() => Math.random() - 0.5); us.forEach((u, i) => { r.players.get(u).team = i % r.opts.teamCount; }); emitRoom(io, r); cb({ ok: true }); });

    socket.on("br:startGame", (_p, cb) => {
      cb = fn(cb); const r = hostRoom(cb); if (!r) return; if (r.status === "playing") return cb({ ok: false, error: "ALREADY_PLAYING" }); if (r.status === "ended" && !r.opts.rematch) return cb({ ok: false, error: "REMATCH_OFF" });
      for (const [u, p] of [...r.players]) if (u !== me.id && (p.status === "left" || !p.connected)) { r.players.delete(u); r.order.splice(r.order.indexOf(u), 1); if (userRoom.get(u) === r.id) userRoom.delete(u); }
      if (!r.players.has(r.hostUserId)) r.hostUserId = r.order[0];
      const entries = r.order.filter((u) => !r.players.get(u).wantSpec); if (entries.length < 2) return cb({ ok: false, error: "NEED_AT_LEAST_2" }); if (entries.length > r.opts.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      if (r.opts.mode === "team") { const c = [0, 0]; for (const u of entries) { const p = r.players.get(u); if (p.team == null) { p.team = c[0] <= c[1] ? 0 : 1; } c[p.team]++; } if (!c[0] || !c[1]) return cb({ ok: false, error: "NEED_TWO_TEAMS" }); }
      clearTimers(r); r.status = "playing"; r.winTeam = null; r.total = entries.length; r.startsAt = Date.now() + r.opts.countdown * 1000; r.deadline = r.opts.gameTimeSec ? r.startsAt + r.opts.gameTimeSec * 1000 : null;
      const shared = (Math.random() * 0xffffffff) >>> 0;
      for (const u of r.order) { const p = r.players.get(u), spec = p.wantSpec; Object.assign(p, { status: spec ? "spec" : "active", place: 0, deadAt: 0, survived: 0, kos: 0, assists: 0, recv: 0, sent: 0, maxAtk: 0, tetra: 0, tspins: 0, perfects: 0, hits: new Map(), inbox: [], gseq: 0, rev: 0, atkFrac: 0, invalid: 0, resyncs: 0, bucket: BR.lockCap, bucketAt: r.startsAt, lastLock: 0, watch: null, watchers: 0, manual: null, curTarget: null, dirtyRow: true, dirtyBoard: true, board: "0|" });
        const seed = r.opts.mode === "score" ? shared : (Math.random() * 0xffffffff) >>> 0; p.game = spec ? null : new BRGame({ seed, startLevel: r.opts.startLevel }); p.game?.takeEvents();
        if (p.socketId) io.to(p.socketId).emit("br:start", { room: pubRoom(r), seed: spec ? null : seed, serverNow: Date.now() }); }
      startTicks(io, r);
      if (r.opts.gameTimeSec) r.gameTimer = setTimeout(() => { const x = rooms.get(r.id); if (x && x.status === "playing") finish(io, x, "TIME_UP"); }, r.opts.countdown * 1000 + r.opts.gameTimeSec * 1000);
      cb({ ok: true });
    });

    // 조각 하나 고정: { o: 조작 기록, n: 조각 번호, k: 받은 공격 번호, m: 도착한 공격 번호, h: 판 지문, v: 동기화 번호 }
    socket.on("br:lock", (d) => {
      const r = myRoom(); if (!r || r.status !== "playing") return; const p = r.players.get(me.id); if (!p || p.status !== "active" || !p.game || p.socketId !== socket.id) return; const now = Date.now(), g = p.game;
      if (now < r.startsAt - 500 || typeof d !== "object" || !d) return; if (d.v !== p.rev) return; // 재동기화 전 보낸 오래된 묶음
      p.bucket = Math.min(BR.lockCap, p.bucket + ((now - p.bucketAt) / 1000) * BR.lockRefill); p.bucketAt = now; if (p.bucket < 1) { if (now - (p.lastRate || 0) > 1000) { p.lastRate = now; resync(io, p, "RATE"); } return; } p.bucket -= 1;
      if (typeof d.o !== "string" || d.o.length > BR.maxOps) { p.invalid++; return resync(io, p, "BAD"); }
      if (d.n !== g.pieces + 1) { if (d.n <= g.pieces) return; p.invalid++; return resync(io, p, "SEQ"); } // 중복 입력은 무시
      const k = Math.min(+d.k || 0, p.gseq), m = Math.min(+d.m || 0, k);
      for (let i = 0; i < p.inbox.length;) { const x = p.inbox[i]; if (x.s <= k || now - x.at > BR.forceAck) { g.addGarbage(x.n, x.s, false); p.inbox.splice(i, 1); } else i++; }
      g.matureUpTo(m); for (const x of g.garbage) if (now - (x.at0 ??= now) > BR.forceAck) x.m = true;
      const snap = g.save(), okRun = g.replay(d.o); p.lastLock = now;
      // 잘못된 조작이면 도중에 움직인 것까지 전부 되돌림
      if (!okRun) { p.game = BRGame.load(snap); p.invalid++; if (p.invalid >= BR.maxInvalid) { console.warn("[br] 잘못된 조작 반복", me.id); return kill(io, r, me.id, "dead", "INVALID"); } return resync(io, p, "INVALID"); }
      let atk = 0; for (const e of g.takeEvents()) { if (e.t === "attack") atk += e.n; else if (e.t === "clear") { if (e.n === 4) p.tetra++; if (e.ts || e.spin) p.tspins++; if (e.perfect) p.perfects++; } }
      p.board = encodeBoard(g.visible()); p.dirtyRow = true; p.dirtyBoard = true; if (p.watchers) sendBoardToWatchers(io, r, me.id, p);
      if (atk) deliver(io, r, me.id, p, atk);
      if (g.dead) return kill(io, r, me.id);
      if (d.h && d.h !== g.hash()) resync(io, p, "HASH");
    });
    // 내 브라우저 판에서 탈락 (보관하다 막힌 경우 등). 스스로 포기하는 건 언제든 가능
    socket.on("br:dead", () => { const r = myRoom(); if (!r || r.status !== "playing" || r.players.get(me.id)?.socketId !== socket.id) return; kill(io, r, me.id); });
    // 관전 대상이 있을 때만 떨어지는 조각 위치 전달 (초당 최대 12번)
    socket.on("br:cur", (d) => { const r = myRoom(); if (!r || r.status !== "playing") return; const p = r.players.get(me.id); if (!p || p.status !== "active" || !p.watchers) return; const t = Date.now(); if (t - p.lastCur < 70) return; p.lastCur = t; if (!Array.isArray(d) || d.length !== 5 || !d.every(Number.isFinite)) return; const msg = { i: p.idx, c: d }; for (const w of r.players.values()) if (w.watch === me.id && w.connected && w.socketId) io.to(w.socketId).emit("br:watchCur", msg); });
    socket.on("br:target", (d) => { const r = myRoom(); if (!r) return; const p = r.players.get(me.id); if (!p) return; if (["random", "attacker", "ko", "danger", "manual"].includes(d?.mode)) p.target = d.mode; if (d?.idx != null) { const f = [...r.players.entries()].find(([, x]) => x.idx === +d.idx); p.manual = f ? f[0] : null; if (f) p.target = "manual"; } });
    socket.on("br:watch", (d) => { const r = myRoom(); if (!r) return; const p = r.players.get(me.id); if (!p) return; const f = d?.idx != null ? [...r.players.entries()].find(([, x]) => x.idx === +d.idx) : null; p.watch = f && f[0] !== me.id ? f[0] : null; tellWatched(io, r); if (p.watch && f[1].game?.cur) { const before = f[1].watchers; const g = f[1].game; socket.emit("br:watchBoard", { i: f[1].idx, s: f[1].board, n: g.pieces, q: g.next?.(5) || [], h: g.hold || 0, st: [g.score, g.lines, g.level || 1, Math.max(0, g.combo || 0), g.b2b ? 1 : 0], c: g.cur ? [g.cur.p, g.cur.r, g.cur.x, g.cur.y, g.pieces] : null, g: g.pendingGarbage?.() || 0 }); void before; } });
    // 어떤 상대 판을 받을지 (전부 / 고른 사람만) — 폰은 일부만 받아 데이터 절약
    socket.on("br:vis", (d) => { const r = myRoom(); if (!r) return; const p = r.players.get(me.id); if (!p) return; if (Array.isArray(d?.list)) { p.vis = d.list.slice(0, 16).map(Number).filter(Number.isFinite); socket.leave(srB(r.id)); const m = []; for (const x of r.players.values()) if (p.vis.includes(x.idx)) m.push([x.idx, x.board]); if (m.length) socket.emit("br:boards", m); } else { p.vis = null; socket.join(srB(r.id)); } });
    socket.on("br:kick", (d, cb) => { cb = fn(cb); const r = hostRoom(cb); if (!r) return; if (r.status === "playing") return cb({ ok: false, error: "NOT_LOBBY" }); const id = String(d?.targetUserId || ""); if (!id || id === me.id || !r.players.has(id)) return cb({ ok: false, error: "INVALID_TARGET" }); const t = r.players.get(id); if (t?.socketId) io.to(t.socketId).emit("br:kicked", {}); const s = t?.socketId && io.sockets.sockets.get(t.socketId); leave(io, r, id); s?.leave(sr(r.id)); s?.leave(srB(r.id)); cb({ ok: true }); });
    socket.on("br:leaveRoom", (_p, cb) => { const r = myRoom(); if (r && r.players.get(me.id)?.socketId === socket.id) { leave(io, r, me.id); socket.leave(sr(r.id)); socket.leave(srB(r.id)); } fn(cb)({ ok: true }); });
    socket.on("br:requestState", (_p, cb) => { const r = myRoom(); fn(cb)(r ? { ok: true, room: pubRoom(r) } : { ok: false, error: "NOT_IN_ROOM" }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return; const p = r.players.get(me.id); if (!p || p.socketId !== socket.id) return; p.connected = false; p.dirtyRow = true;
      // 대기실·결과 화면: 새로고침·잠깐 끊김이면 자리와 방장을 지켜 줌 (8초)
      if (r.status !== "playing") { emitRoom(io, r); p.dcTimer = setTimeout(() => { p.dcTimer = null; const x = rooms.get(r.id); if (x && !p.connected && x.status !== "playing") { leave(io, x, me.id); } }, BR.lobbyGrace); return; }
      tellWatched(io, r); emitRoom(io, r);
      // 정책: 끊기면 내 판은 멈춘 채 20초 기다림(방해 줄은 쌓임). 그 안에 돌아오면 이어서, 넘으면 탈락
      if (p.status === "active") p.dcTimer = setTimeout(() => { p.dcTimer = null; const x = rooms.get(r.id); if (x && x.status === "playing" && !p.connected) kill(io, x, me.id, "dead", "DISCONNECT"); }, BR.grace);
      scheduleEmpty(io, r);
    });
  });
}
export const _brTest = { rooms, invites, userRoom };
// 게임천국 공개 방 모아보기용: 대기 중(자리 있음) + 경기 중(관전 허용)
export const publicBlockRoyaleRooms = () => [...rooms.values()].filter((r) => r.opts.isPublic && (r.status === "playing" ? r.opts.allowSpectate : r.status === "lobby" && r.order.length < r.opts.maxPlayers)).slice(0, 30).map((r) => ({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n: [...r.players.values()].filter((p) => p.status !== "spec" && !p.wantSpec).length, max: r.opts.maxPlayers, playing: r.status === "playing", locked: !!r.opts.password }));
addPublicList("blockroyale", publicBlockRoyaleRooms);
