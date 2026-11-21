// =========================
// DUO 증강 원카드 — 방·소켓 (2026-11-17)
// · 일반 원카드 / 증강 원카드, 2~8인, 게스트 가능, AI 봇(쉬움·보통·어려움), 혼자 AI 대결(soloAi)
// · 관전(게임 중 입장·꽉 찬 방), 재접속(같은 아이디로 들어오면 손패 그대로), 끊긴 사람 차례는 5초 뒤 AI가 대신
// · 판정은 onecard-game.js 엔진이 전부. 화면엔 각자 자기 손패만 보냄 (관전자는 손패 없음)
// · 이벤트 prefix 'onecard:*'
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicRooms } from "./public-rooms.js";
import { OneCardGame, DEFAULT_RULES, RULE_CHOICES, COLORS, COLOR_NAME, KIND_NAME } from "./onecard-game.js";
import { META_AUGS, RARITY, KIND_LABEL, SYNERGY, MAX_AUGS, PICK_EVERY } from "./onecard-augs.js";

const rooms = new Map();
const invites = new Map();
const userRoom = new Map();

const MAX_PLAYERS = [2, 3, 4, 5, 6, 7, 8];
const DIFFS = ["easy", "normal", "hard"];
const LOBBY_DC_MS = 15_000;
const EMPTY_ROOM_MS = 90_000;
const ENDED_ROOM_MS = 10 * 60_000;
const MAX_SPECT = 30;
const MAX_NICK = 12;
const TICK_MS = 200;

const chan = (id) => `onecard:${id}`;
const now = () => Date.now();
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;

function genCode() {
  for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; }
  return String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
}
const humans = (room) => [...room.players.values()].filter(p => !p.isBot && !p.left);
const connectedHumans = (room) => humans(room).filter(p => p.connected).length + [...room.spect.values()].filter(s => s.connected).length;

function cleanRules(src, base) {
  const r = { ...base };
  for (const k of ["stack", "defense", "lastSpecial", "drawPlay"]) if (typeof src?.[k] === "boolean") r[k] = src[k];
  for (const k of ["penalty", "bankrupt", "turnSec"]) if (src?.[k] !== undefined && RULE_CHOICES[k].includes(Number(src[k]))) r[k] = Number(src[k]);
  return r;
}

// ---------------- 상태 보내기 ----------------
function publicRoom(room, viewerId) {
  const spectator = !room.players.has(viewerId) || !!room.players.get(viewerId)?.left;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status,
    opts: { mode: room.mode, maxPlayers: room.maxPlayers, rules: room.rules, isPublic: !!room.isPublic, botDiff: room.botDiff },
    soloAi: !!room.soloAi,
    seats: room.order.map(uid => { const p = room.players.get(uid); return { id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, diff: p.isBot ? p.diff : null, isGuest: p.isGuest, connected: p.isBot || p.connected, left: !!p.left }; }),
    spectators: [...room.spect.values()].map(s => ({ id: s.id, name: s.name })),
    me: viewerId, spectator,
    game: room.game ? room.game.view(viewerId, { spectator }) : null,
    serverNow: now(),
  };
}
function emitState(io, room) {
  const sent = new Set();
  for (const p of room.players.values()) { if (p.isBot || !p.sockId || p.left) continue; io.to(p.sockId).emit("onecard:state", publicRoom(room, p.id)); sent.add(p.sockId); }
  for (const s of room.spect.values()) if (s.sockId && !sent.has(s.sockId)) io.to(s.sockId).emit("onecard:state", publicRoom(room, s.id));
}
function flush(io, room) {
  const g = room.game; if (!g) return false;
  if (!g.events.length) return false;
  const evs = g.events.splice(0);
  io.to(chan(room.id)).emit("onecard:fx", evs);
  if (g.phase === "ended" && room.status !== "ended") onEnded(io, room);
  emitState(io, room);
  return true;
}
function onEnded(io, room) {
  room.status = "ended"; room.endedAt = now();
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { if (rooms.get(room.id) === room && room.status === "ended") deleteRoom(io, room, "ENDED_TTL"); }, ENDED_ROOM_MS);
}

function deleteRoom(io, room, reason) {
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  if (room.endTimer) clearTimeout(room.endTimer);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  room.status = "deleted";
  for (const uid of [...room.order, ...room.spect.keys()]) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  io.to(chan(room.id)).emit("onecard:closed", { reason });
  io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room) > 0) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && connectedHumans(room) === 0) deleteRoom(io, room, "EMPTY"); }, room.soloAi ? 30_000 : EMPTY_ROOM_MS);
}

// ---------------- 진행 ----------------
function startGame(io, room) {
  for (const uid of [...room.order]) { const p = room.players.get(uid); if (!p || p.left || (!p.isBot && !p.connected)) removeSeat(room, uid); }
  room.status = "playing";
  room.game = new OneCardGame({
    players: room.order.map(uid => { const p = room.players.get(uid); return { id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, diff: p.diff }; }),
    mode: room.mode, rules: room.rules, now: now(),
  });
  for (const gp of room.game.players) gp.connected = room.players.get(gp.id).isBot || room.players.get(gp.id).connected;
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  io.to(chan(room.id)).emit("onecard:start", { mode: room.mode });
  flush(io, room) || emitState(io, room);
}
// 모든 방 공용 시계
let ticker = null;
function ensureTicker(io) {
  if (ticker) return;
  ticker = setInterval(() => {
    const t = now();
    for (const room of rooms.values()) {
      if (room.status !== "playing" || !room.game) continue;
      try { room.game.tick(t); flush(io, room); }
      catch (e) { console.error("[onecard] tick", e); }
    }
  }, TICK_MS);
  ticker.unref?.();
}

function removeSeat(room, uid) {
  room.players.delete(uid);
  const i = room.order.indexOf(uid); if (i >= 0) room.order.splice(i, 1);
  if (userRoom.get(uid) === room.id && !room.spect.has(uid)) userRoom.delete(uid);
}
function pickNewHost(room) {
  const h = room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left && p.connected)
    || room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left);
  if (h) room.hostUserId = h.id;
}
function leave(io, room, uid, why = "left") {
  const s = room.spect.get(uid);
  if (s) {
    room.spect.delete(uid);
    if (userRoom.get(uid) === room.id) userRoom.delete(uid);
    if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(room.id));
    if (humans(room).length === 0 && room.spect.size === 0) return deleteRoom(io, room, "EMPTY"); // 마지막 사람(관전자)이 나가면 바로 정리
    checkEmpty(io, room); emitState(io, room); return;
  }
  const p = room.players.get(uid);
  if (!p) return;
  const wasHost = room.hostUserId === uid;
  if (room.status === "playing") {
    p.left = true; p.connected = false;
    if (userRoom.get(uid) === room.id) userRoom.delete(uid);
    room.game?.leave(uid, now());
  } else removeSeat(room, uid);
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(room.id));
  io.to(chan(room.id)).emit("onecard:notice", { k: why, name: p.name });
  if (humans(room).length === 0 && room.spect.size === 0) return deleteRoom(io, room, "EMPTY");
  if (humans(room).length === 0 && room.status === "playing") { room.game.finish(now()); }
  if (wasHost) pickNewHost(room);
  if (!room.players.has(room.hostUserId) || room.players.get(room.hostUserId)?.left) {
    // 자리에 사람이 없으면 관전자가 방장
    const sp = [...room.spect.values()][0]; if (sp && !humans(room).length) room.hostUserId = sp.id;
  }
  flush(io, room) || emitState(io, room);
  checkEmpty(io, room);
}

async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) {
    try {
      const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
      if (data?.nickname && !typedNick(nick)) name = data.nickname;
      if (data?.avatar_url) avatar = data.avatar_url;
    } catch {}
  }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, room, rec) {
  if (rec.sockId && rec.sockId !== socket.id) {
    const old = io.sockets.sockets.get(rec.sockId);
    if (old) { old.emit("onecard:replaced", {}); old.leave(chan(room.id)); }
  }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0;
  socket.join(chan(room.id));
  userRoom.set(rec.id, room.id);
  const gp = room.game?.P(rec.id); if (gp && !rec.left) gp.connected = true;
  checkEmpty(io, room);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isBot: !!o.isBot, diff: o.diff || "normal", isGuest: !!o.isGuest, connected: !o.isBot, left: false, sockId: o.sockId || null, dcAt: 0 });

// ---------------- 등록 ----------------
export function registerOneCard(io, supabaseAdmin) {
  ensureTicker(io);
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const fail = (e) => { console.error("[onecard]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const r = fn(payload && typeof payload === "object" ? payload : {}, reply); if (r && typeof r.catch === "function") r.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb) => {
      const room = myRoom();
      if (!room) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (room.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (room.status === "playing") { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return room;
    };

    socket.on("onecard:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("onecard", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `oc_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby",
        mode: pl.mode === "classic" ? "classic" : "augment",
        maxPlayers: MAX_PLAYERS.includes(Number(pl.maxPlayers)) ? Number(pl.maxPlayers) : 4,
        rules: cleanRules(pl.rules, DEFAULT_RULES), botDiff: DIFFS.includes(pl.botDiff) ? pl.botDiff : "normal",
        isPublic: false, soloAi: pl.soloAi === true,
        players: new Map(), order: [], spect: new Map(), game: null, botSeq: 0, createdAt: now(),
      };
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.players.set(me.id, p); room.order.push(me.id);
      attach(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitState(io, room);
    }));

    socket.on("onecard:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim();
      const room = rooms.get(invites.get(code));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = room.players.get(me.id);
      if (seat && !seat.left) {
        attach(io, socket, room, seat);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true });
        io.to(chan(room.id)).emit("onecard:notice", { k: "back", name: seat.name });
        return emitState(io, room);
      }
      const sp = room.spect.get(me.id);
      if (sp) { attach(io, socket, room, sp); cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectator: true }); return emitState(io, room); }
      if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.players.has(me.id) && !room.players.get(me.id).left) return cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      const wantWatch = pl.watch === true;
      // 게임 중이거나 꽉 찼거나 관전을 원하면 관전자로
      if (wantWatch || room.status === "playing" || room.order.length >= room.maxPlayers || room.players.get(me.id)?.left) {
        if (room.spect.size >= MAX_SPECT) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0 };
        room.spect.set(me.id, s);
        attach(io, socket, room, s);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectator: true });
        io.to(chan(room.id)).emit("onecard:notice", { k: "watch", name });
        return emitState(io, room);
      }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.players.set(me.id, p); room.order.push(me.id);
      attach(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      io.to(chan(room.id)).emit("onecard:notice", { k: "join", name });
      emitState(io, room);
    }));

    // 관전자 → 빈자리 앉기 (대기실·결과 화면)
    socket.on("onecard:sit", guard((pl, cb) => {
      const room = myRoom();
      if (!room || !room.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.order.length >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = room.spect.get(me.id); room.spect.delete(me.id);
      room.players.delete(me.id); // 예전에 나갔던 자리 기록 정리
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id });
      room.players.set(me.id, p); room.order.push(me.id);
      if (!humans(room).some(h => h.id === room.hostUserId)) room.hostUserId = me.id;
      attach(io, socket, room, p);
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("onecard:watch", guard((pl, cb) => {
      const room = myRoom();
      if (!room || !room.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = room.players.get(me.id); removeSeat(room, me.id);
      const s = { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0 };
      room.spect.set(me.id, s); userRoom.set(me.id, room.id);
      cb({ ok: true }); emitState(io, room);
    }));

    socket.on("onecard:setOpts", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      if (pl.mode === "classic" || pl.mode === "augment") room.mode = pl.mode;
      if (pl.maxPlayers !== undefined) {
        const n = Number(pl.maxPlayers);
        if (!MAX_PLAYERS.includes(n)) return cb({ ok: false, error: "BAD_VALUE" });
        if (n < room.order.length) return cb({ ok: false, error: "BELOW_CURRENT" });
        room.maxPlayers = n;
      }
      if (pl.rules) room.rules = cleanRules(pl.rules, room.rules);
      if (DIFFS.includes(pl.botDiff)) { room.botDiff = pl.botDiff; }
      if (typeof pl.isPublic === "boolean" && !room.soloAi) room.isPublic = pl.isPublic;
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("onecard:addBot", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const want = Math.max(1, Math.min(7, Number(pl.count) || 1));
      const diff = DIFFS.includes(pl.diff) ? pl.diff : room.botDiff;
      let added = 0;
      while (added < want && room.order.length < room.maxPlayers) {
        room.botSeq++;
        const uid = `ocbot_${room.id}_${room.botSeq}`;
        room.players.set(uid, newSeat(uid, `🤖 카드봇${room.botSeq}`, { isBot: true, diff }));
        room.order.push(uid); added++;
      }
      if (!added) return cb({ ok: false, error: "ROOM_FULL" });
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("onecard:setBotDiff", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const b = room.players.get(String(pl.uid || ""));
      if (!b?.isBot || !DIFFS.includes(pl.diff)) return cb({ ok: false, error: "BAD_TARGET" });
      b.diff = pl.diff; cb({ ok: true }); emitState(io, room);
    }));
    socket.on("onecard:kick", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const uid = String(pl.uid || "");
      if (uid === me.id || (!room.players.has(uid) && !room.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = room.players.get(uid) || room.spect.get(uid);
      if (p.sockId) io.to(p.sockId).emit("onecard:kicked", {});
      leave(io, room, uid, "kicked");
      cb({ ok: true });
    }));
    socket.on("onecard:start", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const ready = room.order.filter(uid => { const p = room.players.get(uid); return p && !p.left && (p.isBot || p.connected); });
      if (ready.length < 2) return cb({ ok: false, error: "NEED_2" });
      cb({ ok: true });
      startGame(io, room);
    }));
    // 결과 화면에서 대기실로 (방장)
    socket.on("onecard:toLobby", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      if (room.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const uid of [...room.order]) { const p = room.players.get(uid); if (!p || p.left) removeSeat(room, uid); }
      room.status = "lobby"; room.game = null;
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      cb({ ok: true }); emitState(io, room);
    }));

    // ---------- 게임 중 행동 ----------
    let winT = 0, winN = 0;
    const tooFast = () => { const t = now(); if (t - winT > 1000) { winT = t; winN = 0; } return ++winN > 12; };
    const act = (fn) => guard((pl, cb) => {
      if (tooFast()) return cb({ ok: false, error: "TOO_FAST" });
      const room = myRoom();
      // 같은 요청 재전송이면 (게임이 그새 끝났어도) 처음 응답을 그대로 돌려줌
      if (room && pl.nonce && room.nonces?.has(me.id + ":" + pl.nonce)) return cb(room.nonces.get(me.id + ":" + pl.nonce));
      if (!room || room.status !== "playing" || !room.game) return cb({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p || p.left) return cb({ ok: false, error: "SPECTATOR" });
      // 같은 행동이 두 번 오면(끊겼다 다시 보내기) 한 번만
      if (pl.nonce) { room.nonces = room.nonces || new Map(); const k = me.id + ":" + pl.nonce; if (room.nonces.has(k)) return cb(room.nonces.get(k)); }
      const r = fn(room.game, pl, now()) || { ok: false, error: "INTERNAL" };
      if (pl.nonce) { room.nonces.set(me.id + ":" + pl.nonce, r); if (room.nonces.size > 400) room.nonces.delete(room.nonces.keys().next().value); }
      cb(r);
      flush(io, room) || (r.ok && emitState(io, room));
    });
    socket.on("onecard:play", act((g, pl, t) => g.play(me.id, String(pl.card || ""), pl.color, t)));
    socket.on("onecard:draw", act((g, pl, t) => g.draw(me.id, t)));
    socket.on("onecard:pass", act((g, pl, t) => g.pass(me.id, t)));
    socket.on("onecard:take", act((g, pl, t) => g.takeAttack(me.id, pl.react ? String(pl.react) : null, t)));
    socket.on("onecard:declare", act((g, pl, t) => g.declare(me.id, t)));
    socket.on("onecard:catch", act((g, pl, t) => g.catchOne(me.id, String(pl.uid || ""), t)));
    socket.on("onecard:aug", act((g, pl, t) => g.useAug(me.id, pl, t)));
    socket.on("onecard:pick", act((g, pl, t) => pl.refresh ? g.refreshOffer(me.id) : g.pick(me.id, String(pl.id || ""), t)));

    socket.on("onecard:leaveRoom", guard((pl, cb) => {
      const room = myRoom();
      if (room) leave(io, room, me.id);
      cb({ ok: true });
    }));
    socket.on("onecard:sync", guard((pl, cb) => {
      const room = myRoom();
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META });
      cb({ ok: true, state: publicRoom(room, me.id), meta: META });
    }));

    socket.on("disconnect", () => {
      const room = myRoom();
      if (!room) return;
      const rec = room.players.get(me.id) || room.spect.get(me.id);
      if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (room.spect.has(me.id)) {
        setTimeout(() => { const s = room.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= LOBBY_DC_MS - 50) leave(io, room, me.id); }, LOBBY_DC_MS);
        checkEmpty(io, room); return;
      }
      io.to(chan(room.id)).emit("onecard:notice", { k: "dc", name: rec.name });
      if (room.status === "playing" && room.game) {
        const gp = room.game.P(me.id); if (gp) gp.connected = false;
        if (room.game.turn?.uid === me.id) room.game.turn.botAt = Math.max(room.game.turn.botAt, now() + 5000);
        if (room.hostUserId === me.id) pickNewHost(room);
      } else {
        setTimeout(() => {
          if (rooms.get(room.id) !== room || room.status === "playing") return;
          const q = room.players.get(me.id);
          if (q && !q.connected && q.dcAt && now() - q.dcAt >= LOBBY_DC_MS - 50) leave(io, room, me.id);
        }, LOBBY_DC_MS);
      }
      checkEmpty(io, room);
      emitState(io, room);
    });
  });
}

const META = {
  augs: META_AUGS, rarity: RARITY, kindLabel: KIND_LABEL, synergy: SYNERGY, maxAugs: MAX_AUGS, pickEvery: PICK_EVERY,
  colors: COLORS, colorName: COLOR_NAME, kindName: KIND_NAME, ruleChoices: RULE_CHOICES, defaultRules: DEFAULT_RULES,
};

addPublicRooms("onecard", rooms);
export const _onecardTest = { rooms, invites, userRoom };
