// =========================
// 플듀 증강 오셀로 — 1:1 방·관전·재접속·AI (2026-11-16)
// · 판정은 전부 othello-game.js (서버 권한) · 이벤트 prefix 'othello:*' · 게스트 가능
// · 혼자 AI(soloAi: 쉬움/보통/어려움) · 방 구조는 증강 체스(chess.js)와 같은 틀
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import { OthelloGame, PICK_MS } from "./othello-game.js";
import { AUGS, RARITY } from "./othello-augs.js";
import { decide, botPick } from "./othello-ai.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
const CLOCKS = { "1+2": [60, 2], "3+2": [180, 2], "5+3": [300, 3], "10+5": [600, 5], none: [0, 0] };
const LEVELS = ["easy", "normal", "hard"], LEVEL_NAME = { easy: "쉬움", normal: "보통", hard: "어려움" };
const LOBBY_DC_MS = 15000, ABANDON_MS = 120000, EMPTY_MS = 90000, ENDED_MS = 10 * 60000, MAX_SPEC = 40, MAX_NICK = 12;
const chan = (id) => `othello:${id}`;
const now = () => Date.now();
const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK);
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
export const META = { augs: AUGS.map(a => ({ ...a })), rarity: RARITY, clocks: Object.keys(CLOCKS), levels: LEVELS };

function newMember(id, name, o = {}) { return { id, name, avatar: o.avatar || null, isBot: !!o.isBot, isGuest: !!o.isGuest, level: o.level || null, connected: !o.isBot, sockId: o.sockId || null, dcAt: 0 }; }
const colorOf = (room, uid) => (room.seats.b === uid ? "b" : room.seats.w === uid ? "w" : null);
const humans = (room) => [...room.members.values()].filter(m => !m.isBot);
const connectedHumans = (room) => humans(room).filter(m => m.connected);
function publicRoom(room, viewer) {
  const col = colorOf(room, viewer);
  const mem = (uid) => { const m = uid && room.members.get(uid); return m ? { id: m.id, name: m.name, avatar: m.avatar, isBot: m.isBot, isGuest: m.isGuest, level: m.level, connected: m.connected } : null; };
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status, soloAi: !!room.soloAi,
    opts: { mode: room.mode, clock: room.clock, color: room.colorPref },
    seats: { b: mem(room.seats.b), w: mem(room.seats.w) }, members: [...room.members.values()].map(m => mem(m.id)),
    spectators: room.spectators.size, me: viewer || null, myColor: col, spectating: !col && room.spectators.has(viewer),
    game: room.game ? room.game.publicState(col) : null,
    rematch: [...room.rematch], replay: room.status === "ended" && room.game ? room.replayCache || (room.replayCache = room.game.replay()) : null,
    serverNow: now(), seq: room.seq,
  };
}
function sockets(room) { const out = []; for (const m of room.members.values()) if (!m.isBot && m.sockId) out.push([m.id, m.sockId]); for (const [uid, sid] of room.spectators) out.push([uid, sid]); return out; }
function emitState(io, room) { for (const [uid, sid] of sockets(room)) io.to(sid).emit("othello:state", publicRoom(room, uid)); }
function emitAll(io, room, ev, d) { io.to(chan(room.id)).emit(ev, d); }
// 상대 증강 '준비'는 숨김 (화면 사건에서 켠 증강 이름이 새지 않게)
function evFor(evs, viewerCol, room) {
  return evs.map(e => {
    void viewerCol; void room; return e; // 지금은 그대로 (켠 증강은 쓴 것으로 보아 공개)
  });
}

function clearTimers(room) { for (const k of ["clockIv", "pickTimer", "aiTimer"]) if (room[k]) { clearTimeout(room[k]); clearInterval(room[k]); room[k] = null; } }
function deleteRoom(io, room, reason) {
  clearTimers(room); for (const k of ["emptyTimer", "endTimer"]) if (room[k]) clearTimeout(room[k]);
  for (const m of room.members.values()) if (m.abandonT) clearTimeout(m.abandonT);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  for (const uid of [...room.members.keys(), ...room.spectators.keys()]) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  emitAll(io, room, "othello:closed", { reason });
  io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room).length) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && !connectedHumans(room).length) deleteRoom(io, room, "EMPTY"); }, EMPTY_MS);
}
/** 엔진 사건 보내고 타이머·AI 다시 잡기 */
function sync(io, room) {
  const g = room.game; if (!g) return emitState(io, room);
  const evs = g.drain(); room.seq++;
  if (evs.length) for (const [uid, sid] of sockets(room)) io.to(sid).emit("othello:ev", { seq: room.seq, evs: evFor(evs, colorOf(room, uid), room) });
  if (g.phase === "over") return finish(io, room);
  if (g.phase === "pick") {
    if (room.pickKey !== g.pickIdx) {
      room.pickKey = g.pickIdx;
      if (room.pickTimer) clearTimeout(room.pickTimer);
      room.pickTimer = setTimeout(() => { room.pickTimer = null; if (room.game === g && g.phase === "pick") { g.autoPick(); sync(io, room); } }, PICK_MS + 300);
      for (const c of ["b", "w"]) { const m = room.members.get(room.seats[c]); if (m?.isBot) setTimeout(() => { if (room.game === g && g.phase === "pick" && !g.P[c].picked && g.P[c].offer?.length) { g.pick(c, botPick(g.P[c].offer)); sync(io, room); } }, 1000 + Math.random() * 1400); }
    }
  } else if (g.phase === "play") scheduleAi(io, room);
  emitState(io, room);
}
function scheduleAi(io, room) {
  const g = room.game, c = g.S.turn, m = room.members.get(room.seats[c]);
  if (!m?.isBot || room.aiTimer) return;
  const key = `${g.hist.length}:${c}:${g.S.moves}:${g.armed[c] || ""}:${g.freeUsed ? 1 : 0}:${g.extraLeft}`;
  if (room.aiKey === key) return;
  room.aiKey = key;
  const first = !room.aiTurn || room.aiTurn !== `${g.S.ply}:${c}`; room.aiTurn = `${g.S.ply}:${c}`;
  const wait = first ? (m.level === "easy" ? 650 : 500) + Math.random() * 400 : 450;
  room.aiTimer = setTimeout(() => {
    room.aiTimer = null;
    if (rooms.get(room.id) !== room || room.game !== g || g.phase !== "play" || g.S.turn !== c) return;
    let res = { ok: false };
    try {
      const st = decide(g, c, m.level || "normal");
      if (st.kind === "aug") res = g.action(c, st.id, st.sq ?? null);
      else if (st.kind === "pass") res = g.pass(c);
      else res = g.place(c, st.sq);
    } catch (e) { console.error("[othello-ai]", e); }
    if (!res.ok) { g._botPlan = null; const l = g.legal(c); res = l.length ? g.place(c, l[Math.floor(Math.random() * l.length)].sq) : g.pass(c); if (!res.ok && g.mustChoose) res = g.pass(c); }
    room.aiKey = null;
    sync(io, room);
  }, wait);
}
function finish(io, room) {
  clearTimers(room);
  room.status = "ended"; room.rematch = new Set(); room.replayCache = null;
  const g = room.game, r = g.result;
  const stat = (c) => ({ augs: g.P[c].augs.map(a => a.id), used: Object.keys(g.P[c].used), maxFlip: g.P[c].stat.maxFlip, corners: g.P[c].stat.corners });
  room.result = { ...r, names: { b: room.members.get(room.seats.b)?.name || "?", w: room.members.get(room.seats.w)?.name || "?" }, stats: { b: stat("b"), w: stat("w") }, mode: g.mode };
  emitAll(io, room, "othello:end", room.result);
  emitState(io, room);
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { if (rooms.get(room.id) === room && room.status === "ended") deleteRoom(io, room, "ENDED_TTL"); }, ENDED_MS);
}
function startGame(io, room) {
  clearTimers(room);
  const [base, inc] = CLOCKS[room.clock] || CLOCKS.none;
  if (room.game) { const t = room.seats.b; room.seats.b = room.seats.w; room.seats.w = t; } // 재대결은 색 바꿈
  else if (room.colorPref === "random" && Math.random() < 0.5) { const t = room.seats.b; room.seats.b = room.seats.w; room.seats.w = t; }
  room.game = new OthelloGame({ mode: room.mode, base: base * 1000, inc: inc * 1000 });
  room.status = "playing"; room.result = null; room.rematch = new Set(); room.pickKey = null; room.aiKey = null; room.aiTurn = null; room.replayCache = null;
  emitAll(io, room, "othello:start", { mode: room.mode });
  room.game.start();
  room.clockIv = setInterval(() => { const g = room.game; if (g && g.tick()) sync(io, room); }, 250);
  sync(io, room);
}
function seatFor(room, uid) {
  if (!room.seats.b && !room.seats.w) { const c = room.colorPref === "w" ? "w" : "b"; room.seats[c] = uid; return c; }
  if (!room.seats.b) { room.seats.b = uid; return "b"; }
  if (!room.seats.w) { room.seats.w = uid; return "w"; }
  return null;
}
function removeMember(room, uid) {
  const m = room.members.get(uid); if (m?.abandonT) clearTimeout(m.abandonT);
  room.members.delete(uid);
  for (const c of ["b", "w"]) if (room.seats[c] === uid) room.seats[c] = null;
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
}
function pickHost(room) { const h = humans(room).find(m => m.connected) || humans(room)[0]; if (h) room.hostUserId = h.id; }
function leave(io, room, uid) {
  if (room.spectators.has(uid)) { room.spectators.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); return emitState(io, room); }
  const m = room.members.get(uid); if (!m) return;
  const col = colorOf(room, uid);
  if (m.sockId) io.sockets.sockets.get(m.sockId)?.leave(chan(room.id));
  if (room.status === "playing" && col && room.game.phase !== "over") { room.game.resign(col); emitAll(io, room, "othello:notice", { k: "leftResign", name: m.name }); sync(io, room); }
  removeMember(room, uid);
  emitAll(io, room, "othello:notice", { k: "left", name: m.name });
  if (!humans(room).length) return deleteRoom(io, room, "EMPTY");
  if (room.hostUserId === uid) pickHost(room);
  if (room.status === "ended") room.status = "lobby";
  if (room.status === "lobby") room.game = null;
  emitState(io, room);
}
async function profileOf(supa, me, nick) {
  let name = cleanNick(nick), avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname) name = cleanNick(data.nickname); if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  if (!name || name === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; name = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name, avatar };
}
function attach(io, socket, room, m) {
  if (m.sockId && m.sockId !== socket.id) { const old = io.sockets.sockets.get(m.sockId); if (old) { old.emit("othello:replaced", {}); old.leave(chan(room.id)); } }
  m.sockId = socket.id; m.connected = true; m.dcAt = 0; if (m.abandonT) { clearTimeout(m.abandonT); m.abandonT = null; }
  socket.join(chan(room.id)); userRoom.set(m.id, room.id);
  checkEmpty(io, room);
}

export function registerOthello(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.members.has(me.id) || r.spectators.has(me.id)) ? r : null; };
    const guard = (fn) => (pl, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[othello]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const r = fn(pl || {}, reply); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } };
    let win = 0, cnt = 0; const tooFast = () => { const t = now(); if (t - win > 1000) { win = t; cnt = 0; } return ++cnt > 12; };

    socket.on("othello:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("othello", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `ot_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", soloAi: pl.soloAi === true, isPublic: false,
        mode: pl.mode === "classic" ? "classic" : "augment", clock: CLOCKS[pl.clock] ? pl.clock : "5+3", colorPref: ["b", "w", "random"].includes(pl.color) ? pl.color : "random",
        maxPlayers: 2, members: new Map(), seats: { b: null, w: null }, spectators: new Map(), game: null, seq: 0, rematch: new Set(), createdAt: now(),
      };
      Object.defineProperty(room, "players", { get: () => room.members });
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.members.set(me.id, m);
      room.seats[room.colorPref === "w" ? "w" : "b"] = me.id;
      attach(io, socket, room, m);
      if (room.soloAi) {
        const lv = LEVELS.includes(pl.level) ? pl.level : "normal";
        const bid = `otb_${id}`; room.members.set(bid, newMember(bid, `🤖 AI (${LEVEL_NAME[lv]})`, { isBot: true, level: lv }));
        seatFor(room, bid);
      }
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      if (room.soloAi && pl.autoStart) startGame(io, room); else emitState(io, room);
    }));

    socket.on("othello:joinRoom", guard(async (pl, cb) => {
      const room = rooms.get(invites.get(String(pl.code || "").trim()));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const ex = room.members.get(me.id);
      if (ex) {
        attach(io, socket, room, ex);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true });
        emitAll(io, room, "othello:notice", { k: "back", name: ex.name });
        return emitState(io, room);
      }
      if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const full = !!room.seats.b && !!room.seats.w;
      const spectate = pl.spectate === true || room.status === "playing" || full;
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      if (spectate) {
        if (room.spectators.size >= MAX_SPEC && !room.spectators.has(me.id)) return cb({ ok: false, error: "SPEC_FULL" });
        room.spectators.set(me.id, socket.id); socket.join(chan(room.id)); userRoom.set(me.id, room.id);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectating: true });
        return emitState(io, room);
      }
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing" || (room.seats.b && room.seats.w)) return cb({ ok: false, error: "ROOM_FULL" });
      if (room.status === "ended") { room.status = "lobby"; room.game = null; }
      room.spectators.delete(me.id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.members.set(me.id, m); seatFor(room, me.id);
      attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitAll(io, room, "othello:notice", { k: "join", name });
      emitState(io, room);
    }));
    socket.on("othello:joinSeat", guard(async (pl, cb) => {
      const room = myRoom(); if (!room || !room.spectators.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.soloAi || room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.seats.b && room.seats.w) return cb({ ok: false, error: "ROOM_FULL" });
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing" || (room.seats.b && room.seats.w) || !room.spectators.has(me.id)) return cb({ ok: false, error: "ROOM_FULL" });
      if (room.status === "ended") { room.status = "lobby"; room.game = null; }
      room.spectators.delete(me.id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.members.set(me.id, m); seatFor(room, me.id); attach(io, socket, room, m);
      cb({ ok: true }); emitAll(io, room, "othello:notice", { k: "join", name }); emitState(io, room);
    }));
    const hostLobby = (fn) => guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const r = fn(room, pl); cb(r); if (r.ok) emitState(io, room);
    });
    socket.on("othello:setOpts", hostLobby((room, pl) => {
      if (pl.mode === "classic" || pl.mode === "augment") room.mode = pl.mode;
      if (pl.clock && CLOCKS[pl.clock]) room.clock = pl.clock;
      if (["b", "w", "random"].includes(pl.color)) {
        room.colorPref = pl.color;
        const hc = colorOf(room, room.hostUserId);
        if ((pl.color === "b" || pl.color === "w") && hc && hc !== pl.color) { const t = room.seats.b; room.seats.b = room.seats.w; room.seats.w = t; }
      }
      return { ok: true };
    }));
    socket.on("othello:addBot", hostLobby((room, pl) => {
      if (room.seats.b && room.seats.w) return { ok: false, error: "ROOM_FULL" };
      const lv = LEVELS.includes(pl.level) ? pl.level : "normal";
      const bid = `otb_${room.id}_${now().toString(36)}`;
      room.members.set(bid, newMember(bid, `🤖 AI (${LEVEL_NAME[lv]})`, { isBot: true, level: lv })); seatFor(room, bid);
      if (room.status === "ended") { room.status = "lobby"; room.game = null; }
      return { ok: true };
    }));
    socket.on("othello:kick", hostLobby((room, pl) => {
      const uid = String(pl.uid || ""); const m = room.members.get(uid);
      if (!m || uid === me.id) return { ok: false, error: "BAD_TARGET" };
      if (m.sockId) { io.to(m.sockId).emit("othello:kicked", {}); io.sockets.sockets.get(m.sockId)?.leave(chan(room.id)); }
      removeMember(room, uid); if (room.status === "ended") { room.status = "lobby"; room.game = null; }
      emitAll(io, room, "othello:notice", { k: "kicked", name: m.name });
      return { ok: true };
    }));
    socket.on("othello:start", guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (!room.seats.b || !room.seats.w) return cb({ ok: false, error: "NEED_2" });
      cb({ ok: true }); startGame(io, room);
    }));
    socket.on("othello:rematch", guard((pl, cb) => {
      const room = myRoom(); if (!room || room.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      const col = colorOf(room, me.id); if (!col) return cb({ ok: false, error: "NOT_PLAYER" });
      if (!room.seats.b || !room.seats.w) return cb({ ok: false, error: "NEED_2" });
      if (pl.mode === "classic" || pl.mode === "augment") { if (room.mode !== pl.mode) room.rematch.clear(); room.mode = pl.mode; }
      room.rematch.add(me.id);
      cb({ ok: true });
      const both = [room.seats.b, room.seats.w].every(u => u && (room.rematch.has(u) || room.members.get(u)?.isBot));
      if (both) startGame(io, room); else { emitAll(io, room, "othello:notice", { k: "rematch", name: room.members.get(me.id)?.name }); emitState(io, room); }
    }));

    const act = (fn) => guard((pl, cb) => {
      if (tooFast()) return cb({ ok: false, error: "TOO_FAST" });
      const room = myRoom(); if (!room || room.status !== "playing" || !room.game) return cb({ ok: false, error: "NOT_PLAYING" });
      const col = colorOf(room, me.id); if (!col) return cb({ ok: false, error: "NOT_PLAYER" });
      const r = fn(room.game, col, pl) || { ok: false };
      cb(r); if (r.ok) sync(io, room);
    });
    const sq = (v) => (Number.isInteger(v) && v >= 0 && v < 64 ? v : -1);
    socket.on("othello:place", act((g, c, pl) => g.place(c, sq(pl.sq))));
    socket.on("othello:aug", act((g, c, pl) => g.action(c, String(pl.id || ""), pl.sq === undefined || pl.sq === null ? null : sq(pl.sq))));
    socket.on("othello:pass", act((g, c) => g.pass(c)));
    socket.on("othello:pick", act((g, c, pl) => (pl.refresh ? g.refreshOffer(c) : g.pick(c, String(pl.id || "")))));
    socket.on("othello:resign", act((g, c) => g.resign(c)));
    socket.on("othello:leaveRoom", guard((pl, cb) => { const room = myRoom(); if (room) { leave(io, room, me.id); socket.leave(chan(room.id)); } cb({ ok: true }); }));
    socket.on("othello:sync", guard((pl, cb) => { const room = myRoom(); cb(room ? { ok: true, state: publicRoom(room, me.id), meta: META } : { ok: false, error: "NOT_IN_ROOM", meta: META }); }));

    socket.on("disconnect", () => {
      const room = myRoom(); if (!room) return;
      if (room.spectators.get(me.id) === socket.id) { room.spectators.delete(me.id); if (userRoom.get(me.id) === room.id) userRoom.delete(me.id); return emitState(io, room); }
      const m = room.members.get(me.id); if (!m || m.sockId !== socket.id) return;
      m.connected = false; m.dcAt = now();
      emitAll(io, room, "othello:notice", { k: "dc", name: m.name });
      const at = m.dcAt;
      if (room.status !== "playing") {
        setTimeout(() => { if (rooms.get(room.id) !== room || room.status === "playing") return; const q = room.members.get(me.id); if (q && !q.connected && q.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS);
      } else {
        m.abandonT = setTimeout(() => { m.abandonT = null; const q = room.members.get(me.id); if (rooms.get(room.id) !== room || room.status !== "playing" || !q || q.connected) return; const col = colorOf(room, me.id); if (col && room.game.phase !== "over") { room.game.finish(col === "b" ? "w" : "b", "abandon"); sync(io, room); } }, ABANDON_MS);
        if (room.hostUserId === me.id) pickHost(room);
      }
      checkEmpty(io, room); emitState(io, room);
    });
  });
}
addPublicRooms("othello", rooms);
export const _othelloTest = { rooms, invites, userRoom };
