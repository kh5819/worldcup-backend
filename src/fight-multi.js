// =========================
// 플듀 파이터 — 온라인 1:1 서버 (2.0 안정화)
// 서버는 판정을 "실시간으로" 하지 않는다. 두 사람의 버튼 입력만 서로에게 전달(롤백 넷코드는 각자 브라우저)하고,
// 대신 프레임별 입력을 모두 기록해 두었다가 경기가 끝나면 같은 엔진으로 다시 돌려(재현) 공식 승패를 정한다.
//   → 클라이언트가 보낸 승패 보고는 참고만 하고 믿지 않음 · 한 경기 결과는 한 번만 확정
// 그 밖에: 방 코드 추측·요청 남발 제한, 입력 형식·크기·순서 검증, 경기 중 끊김 → 일시정지·재접속(입력 다시 보내기)·제한시간 뒤 기권,
//          고의 이탈(나가기)과 비정상 종료(끊김) 구분 기록
// 이벤트 prefix: 'fight:*', socket room name: `fight:${roomId}`
// =========================
import { createMatch, step } from "./fight-engine/engine.js";

const rooms = new Map();        // roomId → room
const invites = new Map();      // code → roomId
const userRoom = new Map();     // userId → roomId
const queue = [];               // 빠른 대전 대기
const history = [];             // 최근 확정 결과(메모리, 7단계 랭크전에서 DB로)
const CHAR_IDS = ["hanbit", "yuna", "gangcheol", "rei"];
const STAGE_IDS = ["neon", "dojo", "roof"];
const MAX_NICK = 14, EMPTY_TTL = 30_000, RECONNECT_MS = 15_000, MAX_FRAMES = 40_000, MAX_AHEAD = 30;
const KEYS = ["u", "d", "l", "r", "lp", "hp", "lk", "hk", "sp", "pa"];
const dec = (b) => { const o = {}; KEYS.forEach((k, n) => (o[k] = (b >> n) & 1)); return o; };

// ===== 요청 제한(남발·방 코드 추측 방지) =====
const buckets = new Map();   // key → {n, t}
function limited(key, max, windowMs) {
  const now = Date.now(), b = buckets.get(key);
  if (!b || now - b.t > windowMs) { buckets.set(key, { n: 1, t: now }); return false; }
  b.n++; return b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 15 * 60_000) buckets.delete(k); }, 60_000).unref?.();

const rname = (id) => `fight:${id}`;
function genCode() {
  for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"); if (!invites.has(c)) return c; }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
const cleanNick = (n, d = "파이터") => String(n || d).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NICK) || d;

function newRoom(hostId) {
  const id = `ft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const room = { id, code: genCode(), hostId, status: "lobby", players: [], game: 0, match: null, emptyTimer: null, quick: false };
  rooms.set(id, room); invites.set(room.code, id);
  return room;
}
function pub(room) {
  return {
    id: room.id, code: room.code, hostId: room.hostId, status: room.status, game: room.game, quick: room.quick, paused: !!room.match?.pausedBy,
    players: room.players.map((p) => ({ id: p.id, nick: p.nick, avatar: p.avatar || null, pick: p.pick, ready: p.ready, connected: p.connected, side: p.side, wins: p.wins, isGuest: p.isGuest })),
  };
}
const broadcast = (io, room) => io.to(rname(room.id)).emit("fight:room", pub(room));

function deleteRoom(io, room, reason) {
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  if (room.match?.pauseTimer) clearTimeout(room.match.pauseTimer);
  rooms.delete(room.id); invites.delete(room.code);
  for (const p of room.players) if (userRoom.get(p.id) === room.id) userRoom.delete(p.id);
  io.to(rname(room.id)).emit("fight:closed", { reason });
  io.in(rname(room.id)).socketsLeave(rname(room.id));
}
function addPlayer(room, me, socket, nick, avatar) {
  const side = room.players.some((p) => p.side === 0) ? 1 : 0;
  room.players.push({ id: me.id, nick, avatar, socketId: socket.id, pick: null, ready: false, connected: true, side, wins: 0, isGuest: !!me.isGuest });
  room.players.sort((a, b) => a.side - b.side);
  userRoom.set(me.id, room.id);
  socket.join(rname(room.id));
}

// ===== 공식 결과: 서버 재현 =====
/** 두 사람 입력 기록으로 처음부터 다시 돌려 승패를 얻는다. 기록이 모자라면 null */
export function replayMatch(match) {
  const [l0, l1] = match.logs, n = Math.min(l0.length, l1.length);
  const m = createMatch({ p1: match.chars[0], p2: match.chars[1] });
  for (let f = 0; f < n; f++) {
    step(m, [dec(l0[f] | 0), dec(l1[f] | 0)]);
    if (m.phase === "end") return { winner: m.winner, wins: m.wins.slice(), frame: f + 1, verified: true };
  }
  return null;
}
function finalize(io, room, res) {
  const M = room.match;
  if (!M || M.done) return;   // 한 경기 결과는 한 번만
  M.done = true;
  if (M.pauseTimer) clearTimeout(M.pauseTimer);
  if (M.endTimer) clearTimeout(M.endTimer);
  const w = res.winner;
  if (w === 0 || w === 1) { const p = room.players.find((x) => x.side === w); if (p) p.wins++; }
  const rec = { room: room.id, game: M.g, chars: M.chars, players: M.ids, winner: w, wins: res.wins || null, verified: !!res.verified, reason: res.reason || "ko", frames: res.frame || null, at: Date.now(), reports: M.reports };
  history.push(rec); if (history.length > 500) history.shift();
  room.status = "lobby"; room.match = null;
  for (const p of room.players) p.ready = false;
  io.to(rname(room.id)).emit("fight:result", { g: M.g, winner: w, wins: res.wins || null, verified: !!res.verified, reason: res.reason || "ko" });
  broadcast(io, room);
}
function tryFinalize(io, room) {
  const M = room.match; if (!M || M.done) return;
  const r = replayMatch(M);
  if (r) {
    const rep = Object.values(M.reports);
    if (rep.some((x) => x !== r.winner)) console.warn(`[fight] 보고 불일치 room=${room.id} g=${M.g} 서버=${r.winner} 보고=${JSON.stringify(M.reports)}`);
    finalize(io, room, r);
  }
}
function forfeit(io, room, loserId, reason) {
  const M = room.match; if (!M || M.done) return;
  const loser = room.players.find((p) => p.id === loserId), w = loser ? 1 - loser.side : -1;
  finalize(io, room, { winner: w, reason, verified: true });
}

function leave(io, room, uid, why = "LEFT") {
  const p = room.players.find((x) => x.id === uid);
  if (!p) return;
  if (room.status === "playing" && room.match && !room.match.done) forfeit(io, room, uid, why === "LEFT" ? "left" : "disconnect");   // 고의 이탈 vs 끊김
  room.players = room.players.filter((x) => x.id !== uid);
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  if (room.players.length === 0) return deleteRoom(io, room, "EMPTY");
  if (room.hostId === uid) room.hostId = room.players[0].id;
  for (const q of room.players) q.ready = false;
  room.status = "lobby";
  io.to(rname(room.id)).emit("fight:left", { id: uid, nick: p.nick, why });
  broadcast(io, room);
}
function maybeStart(io, room) {
  if (room.status !== "lobby" || room.players.length !== 2) return;
  if (!room.players.every((p) => p.ready && p.pick && p.connected)) return;
  room.status = "playing"; room.game++;
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const stage = STAGE_IDS[seed % STAGE_IDS.length];
  const ps = [...room.players].sort((a, b) => a.side - b.side);
  room.match = { g: room.game, seed, stage, chars: ps.map((p) => p.pick), ids: ps.map((p) => p.id), logs: [[], []], pend: [new Map(), new Map()], delay: [null, null], reports: {}, done: false, pausedBy: null, pauseTimer: null, endTimer: null, startedAt: Date.now() };
  io.to(rname(room.id)).emit("fight:start", { game: room.game, seed, stage, players: ps.map((p) => ({ id: p.id, nick: p.nick, side: p.side, pick: p.pick })) });
  broadcast(io, room);
}
const startPayload = (room) => { const M = room.match; return { game: M.g, seed: M.seed, stage: M.stage, players: room.players.map((p) => ({ id: p.id, nick: p.nick, side: p.side, pick: M.chars[p.side] })), resume: true }; };

export function registerFightMulti(io) {
  function resume(room) {
    const M = room.match; if (!M || !M.pausedBy) return;
    if (!room.players.every((p) => p.connected)) return;
    M.pausedBy = null; if (M.pauseTimer) { clearTimeout(M.pauseTimer); M.pauseTimer = null; }
    io.to(rname(room.id)).emit("fight:resume", { g: M.g });
    broadcast(io, room);
  }
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); return id ? rooms.get(id) : null; };
    const leaveCurrent = () => { const r = myRoom(); if (r) { socket.leave(rname(r.id)); leave(io, r, me.id, "LEFT"); } const qi = queue.findIndex((q) => q.userId === me.id); if (qi >= 0) queue.splice(qi, 1); };
    const tooMany = (cb) => { cb?.({ ok: false, error: "RATE_LIMIT" }); return true; };

    socket.on("fight:create", (pl, cb) => {
      if (limited("c:" + me.id, 6, 60_000)) return tooMany(cb);
      try {
        leaveCurrent();
        const room = newRoom(me.id);
        addPlayer(room, me, socket, cleanNick(pl?.nick), typeof pl?.avatar === "string" ? pl.avatar.slice(0, 300) : null);
        cb?.({ ok: true, room: pub(room), me: me.id });
        broadcast(io, room);
      } catch (e) { console.error("[fight:create]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("fight:join", (pl, cb) => {
      if (limited("j:" + me.id, 12, 60_000)) return tooMany(cb);
      try {
        const code = String(pl?.code || "").replace(/\D/g, "").slice(0, 7);
        const room = rooms.get(invites.get(code));
        if (!room) {
          if (limited("bad:" + me.id, 10, 10 * 60_000)) return tooMany(cb);   // 없는 코드 반복(추측) → 10분 막음
          return cb?.({ ok: false, error: "NO_ROOM" });
        }
        const already = room.players.find((p) => p.id === me.id);
        if (already) {   // 다시 들어옴(새로고침·재접속)
          already.socketId = socket.id; already.connected = true; socket.join(rname(room.id)); userRoom.set(me.id, room.id);
          if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
          cb?.({ ok: true, room: pub(room), me: me.id });
          broadcast(io, room);
          if (room.status === "playing" && room.match && !room.match.done) { socket.emit("fight:start", startPayload(room)); resume(room); }
          return;
        }
        if (room.players.length >= 2) return cb?.({ ok: false, error: "FULL" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "PLAYING" });
        leaveCurrent();
        addPlayer(room, me, socket, cleanNick(pl?.nick), typeof pl?.avatar === "string" ? pl.avatar.slice(0, 300) : null);
        cb?.({ ok: true, room: pub(room), me: me.id });
        broadcast(io, room);
      } catch (e) { console.error("[fight:join]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("fight:quick", (pl, cb) => {
      if (limited("q:" + me.id, 8, 60_000)) return tooMany(cb);
      try {
        leaveCurrent();
        const nick = cleanNick(pl?.nick);
        while (queue.length) {
          const other = queue.shift();
          const os = io.sockets.sockets.get(other.socketId);
          if (!os || other.userId === me.id) continue;
          const room = newRoom(other.userId); room.quick = true;
          addPlayer(room, { id: other.userId, isGuest: other.isGuest }, os, other.nick, other.avatar);
          addPlayer(room, me, socket, nick, null);
          os.emit("fight:matched", { room: pub(room), me: other.userId });
          cb?.({ ok: true, matched: true, room: pub(room), me: me.id });
          broadcast(io, room);
          return;
        }
        queue.push({ userId: me.id, socketId: socket.id, nick, avatar: null, isGuest: !!me.isGuest, at: Date.now() });
        cb?.({ ok: true, matched: false, waiting: queue.length });
      } catch (e) { console.error("[fight:quick]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });
    socket.on("fight:unqueue", (_pl, cb) => { const qi = queue.findIndex((q) => q.userId === me.id); if (qi >= 0) queue.splice(qi, 1); cb?.({ ok: true }); });

    socket.on("fight:pick", (pl) => {
      const room = myRoom(); if (!room || room.status !== "lobby") return;
      const p = room.players.find((x) => x.id === me.id); if (!p || !CHAR_IDS.includes(pl?.pick)) return;
      p.pick = pl.pick; p.ready = false; broadcast(io, room);
    });
    socket.on("fight:ready", (pl) => {
      const room = myRoom(); if (!room || room.status !== "lobby") return;
      const p = room.players.find((x) => x.id === me.id); if (!p || !p.pick) return;
      p.ready = !!pl?.ready; broadcast(io, room); maybeStart(io, room);
    });

    // ===== 입력: 검증 → 기록 → 상대에게 전달 =====
    socket.on("fight:in", (pl) => {
      const room = myRoom(); const M = room?.match;
      if (!room || room.status !== "playing" || !M || M.done || pl?.g !== M.g) return;
      if (limited("in:" + socket.id, 140, 1000)) return;   // 초당 140개 넘으면 버림(정상은 60)
      if (!Array.isArray(pl.b) || pl.b.length < 1 || pl.b.length > 16 || !Number.isInteger(pl.f) || pl.f < 0 || pl.f > MAX_FRAMES) return;
      if (!pl.b.every((x) => Number.isInteger(x) && x >= 0 && x < 1024)) return;
      const p = room.players.find((x) => x.id === me.id); if (!p) return;
      const side = p.side, log = M.logs[side];
      if (M.delay[side] == null) { const d = Number.isInteger(pl.d) ? Math.max(0, Math.min(10, pl.d)) : pl.f; M.delay[side] = d; for (let f = 0; f < Math.min(d, pl.f); f++) log[f] = 0; }
      if (pl.f > M.logs[1 - side].length + 600) return;     // 상대보다 터무니없이 앞서는 입력 거부(10초)
      // 순서가 뒤바뀌어 도착한 입력은 잠깐 보관했다가 앞 프레임이 채워지면 이어 붙임(최대 120프레임)
      const pend = M.pend[side];
      if (pl.f > log.length) { if (pl.f - log.length <= 120 && pend.size < 240) pl.b.forEach((b, i) => { if (!pend.has(pl.f + i)) pend.set(pl.f + i, b); }); return; }
      const f0 = log.length;
      for (const b of pl.b.slice(log.length - pl.f)) log.push(b);   // 이미 받은 프레임(재전송)은 건너뜀
      while (pend.has(log.length)) { const k = log.length; log.push(pend.get(k)); pend.delete(k); }
      for (const k of pend.keys()) if (k < log.length) pend.delete(k);
      if (log.length === f0) return;
      const fresh = log.slice(f0);
      if (log.length > MAX_FRAMES) return;
      socket.to(rname(room.id)).emit("fight:in", { g: M.g, f: f0, b: fresh, fr: Number.isFinite(pl.fr) ? pl.fr : undefined, adv: Number.isFinite(pl.adv) ? Math.max(-999, Math.min(999, pl.adv)) : undefined, d: M.delay[side] });
      if (Object.keys(M.reports).length) tryFinalize(io, room);   // 끝 보고 뒤 남은 입력이 오면 재현 다시
    });
    socket.on("fight:hash", (pl) => { const room = myRoom(); if (room?.match && Number.isInteger(pl?.c) && Number.isInteger(pl?.h)) socket.to(rname(room.id)).emit("fight:hash", { g: pl.g, c: pl.c, h: pl.h }); });
    socket.on("fight:sync", (pl) => { const room = myRoom(); if (room?.match && typeof pl?.json === "string" && pl.json.length < 60_000) socket.to(rname(room.id)).emit("fight:sync", { g: pl.g, at: pl.at, json: pl.json }); });
    socket.on("fight:ping", (t, cb) => cb?.(t));

    // 재접속: 서버 기록에서 놓친 입력(상대 것 + 내 것 전부) 다시 보냄 → 클라이언트가 처음부터 다시 계산해 이어감
    socket.on("fight:rejoin", (pl, cb) => {
      const room = myRoom(); const M = room?.match;
      if (!room || !M || M.done || pl?.g !== M.g) return cb?.({ ok: false });
      const p = room.players.find((x) => x.id === me.id); if (!p) return cb?.({ ok: false });
      p.socketId = socket.id; p.connected = true; socket.join(rname(room.id));
      cb?.({ ok: true, side: p.side, opp: M.logs[1 - p.side].slice(), mine: M.logs[p.side].slice(), dOpp: M.delay[1 - p.side] });
      resume(room);
    });

    // 경기 끝 보고: 참고만 — 서버가 기록을 재현해서 확정
    socket.on("fight:end", (pl) => {
      const room = myRoom(); const M = room?.match;
      if (!room || !M || M.done || pl?.g !== M.g) return;
      if (M.reports[me.id] !== undefined) return;   // 같은 사람 중복 보고 무시
      M.reports[me.id] = pl.winner === 0 || pl.winner === 1 ? pl.winner : -1;
      tryFinalize(io, room);
      if (!M.done && Object.keys(M.reports).length >= 2 && !M.endTimer) M.endTimer = setTimeout(() => {
        if (M.done) return;
        const r = replayMatch(M);
        if (r) return finalize(io, room, r);
        // 기록이 끝까지 안 오면: 두 보고가 같을 때만 "미검증" 결과로(랭크전에선 무효 처리 대상)
        const rep = Object.values(M.reports);
        finalize(io, room, { winner: rep.every((x) => x === rep[0]) ? rep[0] : -1, verified: false, reason: "unverified" });
      }, 5000);
    });

    socket.on("fight:leave", (_pl, cb) => { leaveCurrent(); cb?.({ ok: true }); });
    socket.on("disconnect", () => {
      const qi = queue.findIndex((q) => q.socketId === socket.id); if (qi >= 0) queue.splice(qi, 1);
      const room = myRoom(); if (!room) return;
      const p = room.players.find((x) => x.id === me.id);
      if (!p || p.socketId !== socket.id) return;
      p.connected = false; p.ready = false;
      if (room.status === "playing" && room.match && !room.match.done) {
        // 경기 중 끊김: 일시정지 → RECONNECT_MS 안에 안 돌아오면 비정상 종료(기권패)
        const M = room.match;
        M.pausedBy = me.id;
        io.to(rname(room.id)).emit("fight:pause", { g: M.g, who: me.id, ms: RECONNECT_MS });
        M.pauseTimer = setTimeout(() => { const r = rooms.get(room.id); const q = r?.players.find((x) => x.id === me.id); if (r && q && !q.connected && r.match === M) { forfeit(io, r, me.id, "disconnect"); leave(io, r, me.id, "DISCONNECT"); } }, RECONNECT_MS);
        broadcast(io, room);
        return;
      }
      broadcast(io, room);
      if (room.players.every((x) => !x.connected) && !room.emptyTimer) room.emptyTimer = setTimeout(() => { const r = rooms.get(room.id); if (r && r.players.every((x) => !x.connected)) deleteRoom(io, r, "EMPTY"); }, EMPTY_TTL);
      else setTimeout(() => { const r = rooms.get(room.id); const q = r?.players.find((x) => x.id === me.id); if (r && q && !q.connected && r.status === "lobby") leave(io, r, me.id, "DISCONNECT"); }, 20_000);
    });
  });
}
/** 시험·관리용: 최근 확정 결과 */
export const fightHistory = () => history.slice();
/** 시험용: 진행 중 경기 요약(입력 기록 길이·대기 묶음 수) */
export const fightDebug = () => [...rooms.values()].map((r) => ({ status: r.status, players: r.players.map((p) => ({ id: p.id, side: p.side, connected: p.connected, sid: p.socketId })), match: r.match && { g: r.match.g, done: r.match.done, paused: r.match.pausedBy, logs: r.match.logs.map((l) => l.length), pend: r.match.pend.map((p) => p.size) } }));
