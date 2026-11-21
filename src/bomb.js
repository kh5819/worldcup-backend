// =========================
// DUO BOMB ARENA — 방·실시간 동기화 (2026-11-16)
// · 20Hz 서버 틱, 매 틱 스냅샷(가벼운 배열)을 방 전체에 보냄. 판정은 bomb-core.js
// · 개인전 2~8 / 팀전(2팀), 게스트 가능, 혼자 AI(soloAi), 관전, 재접속(20초 넘게 끊기면 AI가 대신)
// · 이벤트 prefix 'bomb:*'
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicRooms } from "./public-rooms.js";
import { BombGame, AUGS, RARITY, THEMES, ITEMS, W, H, TICK, MATCH_SEC, SD_AT, PICK_SEC } from "./bomb-core.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
const LOBBY_DC_MS = 15000, BOT_TAKEOVER_MS = 20000, EMPTY_MS = 60000, ENDED_MS = 10 * 60000, MAX_SPEC = 30, MAX_NICK = 12;
const chan = (id) => `bomb:${id}`;
const now = () => Date.now();
const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK);
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
export const META = { augs: AUGS, rarity: RARITY, themes: THEMES, items: ITEMS, w: W, h: H, matchSec: MATCH_SEC, sdAt: SD_AT, pickSec: PICK_SEC };

function newMember(id, name, o = {}) { return { id, name, avatar: o.avatar || null, isBot: !!o.isBot, isGuest: !!o.isGuest, connected: !o.isBot, left: false, sockId: o.sockId || null, dcAt: 0, team: o.team ?? 0, botTook: false }; }
const humans = (room) => [...room.members.values()].filter(m => !m.isBot && !m.left);
const connectedHumans = (room) => humans(room).filter(m => m.connected);
const limits = (room) => (room.teamMode ? [2, 4, 6, 8] : [2, 3, 4, 5, 6, 7, 8]);

function publicRoom(room, viewer) {
  const g = room.game, me = viewer ? room.members.get(viewer) : null;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status, soloAi: !!room.soloAi,
    opts: { mode: room.mode, teamMode: room.teamMode, maxPlayers: room.maxPlayers, theme: room.theme },
    members: room.order.map(uid => { const m = room.members.get(uid); return { id: m.id, name: m.name, avatar: m.avatar, isBot: m.isBot, isGuest: m.isGuest, connected: m.connected, left: m.left, team: m.team, botTook: m.botTook }; }),
    spectators: room.spectators.size, me: viewer || null, spectating: !!(viewer && !me && room.spectators.has(viewer)),
    game: g ? { theme: g.theme, mode: g.mode, teamMode: g.teamMode, phase: g.phase, t: g.t, pickIdx: g.pickIdx, pickLeft: g.phase === "pick" ? g.pickUntil : 0,
      slots: [...g.players.values()].map(p => ({ id: p.id, slot: p.slot, name: p.name, team: p.team, color: p.color, isBot: p.isBot, picking: g.phase === "pick" && !p.picked, augs: p.augs.map(a => a.id) })),
      tiles: g.tilesStr(), tv: g.tilesVer, sp: Array.from(g.sp), items: g.itemsArr(), snap: g.snapshot(viewer), me: me ? g.meState(viewer) : null } : null,
    result: room.result || null, serverNow: now(),
  };
}
function sockets(room) { const out = []; for (const m of room.members.values()) if (!m.isBot && m.sockId && !m.left) out.push([m.id, m.sockId]); for (const [uid, sid] of room.spectators) out.push([uid, sid]); return out; }
function emitState(io, room) { for (const [uid, sid] of sockets(room)) io.to(sid).emit("bomb:state", publicRoom(room, uid)); }
function emitAll(io, room, ev, d) { io.to(chan(room.id)).emit(ev, d); }

function stopLoop(room) { if (room.loop) { clearInterval(room.loop); room.loop = null; } }
function deleteRoom(io, room, reason) {
  stopLoop(room); for (const k of ["emptyTimer", "endTimer"]) if (room[k]) clearTimeout(room[k]);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  for (const uid of [...room.members.keys(), ...room.spectators.keys()]) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  emitAll(io, room, "bomb:closed", { reason }); io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room).length) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && !connectedHumans(room).length) deleteRoom(io, room, "EMPTY"); }, EMPTY_MS);
}
/** 한 틱: 시뮬레이션 → 사건·스냅샷 보내기 */
function tickRoom(io, room) {
  const g = room.game; if (!g) return;
  const before = g.phase;
  // 끊긴 사람 20초 넘으면 AI가 대신
  if (room.tickN++ % 20 === 0) for (const m of room.members.values()) if (!m.isBot && !m.connected && !m.botTook && g.players.has(m.id) && now() - m.dcAt > BOT_TAKEOVER_MS) { m.botTook = true; g.players.get(m.id).isBot = true; emitAll(io, room, "bomb:notice", { k: "botTook", name: m.name }); }
  g.tick(TICK);
  const evs = g.drain();
  if (evs.length) emitAll(io, room, "bomb:ev", evs);
  if (g.phase === "play" || before === "play") {
    const tilesChanged = g.tilesVer !== room.sentTv, itemsKey = g.items.size + ":" + [...g.items.keys()].reduce((a, b) => a + b, 0);
    const extra = {};
    if (tilesChanged) { extra.tiles = g.tilesStr(); room.sentTv = g.tilesVer; }
    if (itemsKey !== room.sentItems) { extra.items = g.itemsArr(); room.sentItems = itemsKey; }
    // 지뢰는 주인(팀)에게만 보여서 스냅샷을 사람마다 따로
    const hasHidden = g.bombs.some(b => b.hidden);
    if (!hasHidden) { const s = { ...g.snapshot(null), ...extra }; io.to(chan(room.id)).emit("bomb:snap", s); }
    else for (const [uid, sid] of sockets(room)) io.to(sid).emit("bomb:snap", { ...g.snapshot(uid), ...extra });
    // 내 능력치는 4틱마다
    if (room.tickN % 4 === 0) for (const m of room.members.values()) if (!m.isBot && m.sockId && m.connected) io.to(m.sockId).emit("bomb:me", g.meState(m.id));
  }
  if (g.phase !== before) {
    if (g.phase === "over") return finish(io, room);
    emitState(io, room); // 고르기 시작·끝
  } else if (g.phase === "pick" && room.tickN % 10 === 0) emitState(io, room);
}
function finish(io, room) {
  stopLoop(room);
  const g = room.game; room.status = "ended";
  room.result = { ...g.result, teamMode: g.teamMode, mode: g.mode, theme: g.theme, rows: g.result.rows.map(r => ({ ...r, isBot: !!room.members.get(r.id)?.isBot, killerName: r.killer ? (room.members.get(r.killer)?.name || null) : null })) };
  // 게임 중에 나간 사람은 자리를 비워 다음 판에 다른 사람이 들어올 수 있게
  for (const uid of [...room.order]) if (room.members.get(uid)?.left) removeMember(room, uid);
  emitAll(io, room, "bomb:end", room.result);
  emitState(io, room);
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { if (rooms.get(room.id) === room && room.status === "ended") deleteRoom(io, room, "ENDED_TTL"); }, ENDED_MS);
}
function startGame(io, room) {
  stopLoop(room);
  for (const uid of [...room.order]) { const m = room.members.get(uid); if (!m || m.left || (!m.isBot && !m.connected)) removeMember(room, uid); else m.botTook = false; }
  if (room.teamMode) balanceTeams(room); else room.order.forEach((uid, i) => (room.members.get(uid).team = i));
  // 팀전은 같은 팀이 이웃 출발점에 서지 않게 번갈아 배치
  const order = room.teamMode ? interleave(room.order.map(u => room.members.get(u))) : room.order.map(u => room.members.get(u));
  const players = order.map((m, i) => ({ id: m.id, name: m.name, team: m.team, isBot: m.isBot, color: room.order.indexOf(m.id) }));
  room.game = new BombGame(players, { mode: room.mode, theme: room.theme === "random" ? null : room.theme, teamMode: room.teamMode });
  room.status = "playing"; room.result = null; room.tickN = 0; room.sentTv = -1; room.sentItems = "";
  room.game.start();
  emitAll(io, room, "bomb:start", { theme: room.game.theme });
  emitState(io, room);
  room.loop = setInterval(() => { try { tickRoom(io, room); } catch (e) { console.error("[bomb] tick", e); } }, TICK * 1000);
}
function interleave(ms) { const a = ms.filter(m => m.team === 0), b = ms.filter(m => m.team !== 0), out = []; while (a.length || b.length) { if (a.length) out.push(a.shift()); if (b.length) out.push(b.shift()); } return out; }
function balanceTeams(room) { const ids = room.order.slice(), half = ids.length / 2; const t0 = ids.filter(u => room.members.get(u).team === 0), t1 = ids.filter(u => room.members.get(u).team !== 0); while (t0.length > Math.ceil(half)) t1.push(t0.pop()); while (t1.length > Math.ceil(half)) t0.push(t1.pop()); for (const u of t0) room.members.get(u).team = 0; for (const u of t1) room.members.get(u).team = 1; }
function removeMember(room, uid) { room.members.delete(uid); const i = room.order.indexOf(uid); if (i >= 0) room.order.splice(i, 1); if (userRoom.get(uid) === room.id) userRoom.delete(uid); }
function pickHost(room) { const h = humans(room).find(m => m.connected) || humans(room)[0]; if (h) room.hostUserId = h.id; }
function leave(io, room, uid, why = "left") {
  if (room.spectators.has(uid)) { room.spectators.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); return emitState(io, room); }
  const m = room.members.get(uid); if (!m) return;
  if (m.sockId) io.sockets.sockets.get(m.sockId)?.leave(chan(room.id));
  if (room.status === "playing") { m.left = true; m.connected = false; if (userRoom.get(uid) === room.id) userRoom.delete(uid); const p = room.game?.players.get(uid); if (p) { p.isBot = true; m.botTook = true; } }
  else removeMember(room, uid);
  emitAll(io, room, "bomb:notice", { k: why, name: m.name });
  if (!humans(room).length) return deleteRoom(io, room, "EMPTY");
  if (room.hostUserId === uid) pickHost(room);
  emitState(io, room);
}
async function profileOf(supa, me, nick) {
  let name = cleanNick(nick), avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = cleanNick(data.nickname); if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  if (!name || name === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; name = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name, avatar };
}
function attach(io, socket, room, m) {
  if (m.sockId && m.sockId !== socket.id) { const old = io.sockets.sockets.get(m.sockId); if (old) { old.emit("bomb:replaced", {}); old.leave(chan(room.id)); } }
  m.sockId = socket.id; m.connected = true; m.dcAt = 0;
  if (m.botTook && room.game?.players.has(m.id) && !m.left) { m.botTook = false; const p = room.game.players.get(m.id); p.isBot = false; p.mv = 0; }
  socket.join(chan(room.id)); userRoom.set(m.id, room.id); checkEmpty(io, room);
}

export function registerBomb(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.members.has(me.id) || r.spectators.has(me.id)) ? r : null; };
    const guard = (fn) => (pl, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[bomb]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const r = fn(pl || {}, reply); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } };
    let win = 0, cnt = 0; const tooFast = (lim = 40) => { const t = now(); if (t - win > 1000) { win = t; cnt = 0; } return ++cnt > lim; };

    socket.on("bomb:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("bomb", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `bm_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", soloAi: pl.soloAi === true, isPublic: false,
        mode: pl.mode === "classic" ? "classic" : "augment", teamMode: pl.teamMode === true, maxPlayers: 4, theme: THEMES.includes(pl.theme) ? pl.theme : "random",
        members: new Map(), order: [], spectators: new Map(), game: null, botSeq: 0, result: null, tickN: 0, createdAt: now() };
      Object.defineProperty(room, "players", { get: () => room.members });
      const mp = Number(pl.maxPlayers); if (limits(room).includes(mp)) room.maxPlayers = mp;
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0 });
      room.members.set(me.id, m); room.order.push(me.id);
      attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitState(io, room);
    }));
    socket.on("bomb:joinRoom", guard(async (pl, cb) => {
      const room = rooms.get(invites.get(String(pl.code || "").trim()));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const ex = room.members.get(me.id);
      if (ex && !ex.left) { attach(io, socket, room, ex); cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true }); emitAll(io, room, "bomb:notice", { k: "back", name: ex.name }); return emitState(io, room); }
      const spectate = pl.spectate === true || room.status === "playing" || room.members.size >= room.maxPlayers;
      if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      if (spectate) {
        if (room.spectators.size >= MAX_SPEC && !room.spectators.has(me.id)) return cb({ ok: false, error: "SPEC_FULL" });
        room.spectators.set(me.id, socket.id); socket.join(chan(room.id)); userRoom.set(me.id, room.id);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectating: true }); return emitState(io, room);
      }
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      room.spectators.delete(me.id);
      const t0 = [...room.members.values()].filter(x => x.team === 0).length;
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: room.teamMode ? (t0 > room.members.size - t0 ? 1 : 0) : room.members.size });
      room.members.set(me.id, m); room.order.push(me.id);
      attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitAll(io, room, "bomb:notice", { k: "join", name }); emitState(io, room);
    }));
    // 관전하던 사람이 다음 판에 참가 (게임 중이 아닐 때·자리가 있을 때)
    socket.on("bomb:joinSeat", guard(async (pl, cb) => {
      const room = myRoom(); if (!room || !room.spectators.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.soloAi) return cb({ ok: false, error: "NOT_ALLOWED" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      if (!room.spectators.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      room.spectators.delete(me.id);
      const t0 = [...room.members.values()].filter(x => x.team === 0).length;
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: room.teamMode ? (t0 > room.members.size - t0 ? 1 : 0) : room.members.size });
      room.members.set(me.id, m); room.order.push(me.id); attach(io, socket, room, m);
      cb({ ok: true }); emitAll(io, room, "bomb:notice", { k: "join", name }); emitState(io, room);
    }));
    const hostLobby = (fn) => guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const r = fn(room, pl); cb(r); if (r.ok) emitState(io, room);
    });
    socket.on("bomb:setOpts", hostLobby((room, pl) => {
      if (pl.mode === "classic" || pl.mode === "augment") room.mode = pl.mode;
      if (typeof pl.teamMode === "boolean" && pl.teamMode !== room.teamMode) { room.teamMode = pl.teamMode; if (!limits(room).includes(room.maxPlayers)) room.maxPlayers = limits(room).find(n => n >= Math.max(room.maxPlayers, room.members.size)) || 8; room.order.forEach((u, i) => (room.members.get(u).team = room.teamMode ? i % 2 : i)); }
      if (pl.maxPlayers !== undefined) { const n = Number(pl.maxPlayers); if (!limits(room).includes(n)) return { ok: false, error: "BAD_MAX" }; if (n < room.members.size) return { ok: false, error: "BELOW_CURRENT" }; room.maxPlayers = n; }
      if (pl.theme === "random" || THEMES.includes(pl.theme)) room.theme = pl.theme;
      return { ok: true };
    }));
    socket.on("bomb:addBot", hostLobby((room, pl) => {
      const want = Math.max(1, Math.min(7, Number(pl.count) || 1)); let added = 0;
      while (added < want && room.members.size < room.maxPlayers) { room.botSeq++; const uid = `bmb_${room.id}_${room.botSeq}`; const t0 = [...room.members.values()].filter(x => x.team === 0).length; room.members.set(uid, newMember(uid, `AI ${room.botSeq}`, { isBot: true, team: room.teamMode ? (t0 > room.members.size - t0 ? 1 : 0) : room.members.size })); room.order.push(uid); added++; }
      return added ? { ok: true } : { ok: false, error: "ROOM_FULL" };
    }));
    socket.on("bomb:kick", hostLobby((room, pl) => {
      const uid = String(pl.uid || ""); const m = room.members.get(uid);
      if (!m || uid === me.id) return { ok: false, error: "BAD_TARGET" };
      if (m.sockId) io.to(m.sockId).emit("bomb:kicked", {});
      leave(io, room, uid, "kicked"); return { ok: true };
    }));
    socket.on("bomb:setTeam", guard((pl, cb) => {
      const room = myRoom(); if (!room || room.status === "playing" || !room.teamMode) return cb({ ok: false, error: "NOT_ALLOWED" });
      const uid = room.hostUserId === me.id && pl.uid ? String(pl.uid) : me.id; const m = room.members.get(uid); if (!m) return cb({ ok: false, error: "BAD_TARGET" });
      const t = Number(pl.team) === 1 ? 1 : 0; if (m.team !== t && [...room.members.values()].filter(x => x.team === t).length >= room.maxPlayers / 2) return cb({ ok: false, error: "TEAM_FULL" });
      m.team = t; cb({ ok: true }); emitState(io, room);
    }));
    socket.on("bomb:start", guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const ready = room.order.filter(u => { const m = room.members.get(u); return m && !m.left && (m.isBot || m.connected); });
      if (ready.length < 2) return cb({ ok: false, error: "NEED_2" });
      if (room.teamMode) { const t0 = ready.filter(u => room.members.get(u).team === 0).length; if (ready.length % 2 || !t0 || t0 === ready.length) return cb({ ok: false, error: "TEAM_EVEN" }); }
      cb({ ok: true }); startGame(io, room);
    }));
    // 게임 입력
    const gameOf = () => { const room = myRoom(); if (!room || room.status !== "playing" || !room.game) return null; const m = room.members.get(me.id); if (!m || m.left) return null; return room; };
    socket.on("bomb:mv", (d) => { if (tooFast(60)) return; const room = gameOf(); if (!room) return; room.game.input(me.id, Number(d?.mv) | 0); });
    socket.on("bomb:bomb", (d, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (tooFast()) return reply({ ok: false, error: "TOO_FAST" }); const room = gameOf(); if (!room) return reply({ ok: false, error: "NOT_PLAYING" }); if (Number.isInteger(d?.mv)) room.game.input(me.id, d.mv); reply(room.game.placeBomb(me.id)); });
    socket.on("bomb:act", (d, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (tooFast()) return reply({ ok: false, error: "TOO_FAST" }); const room = gameOf(); if (!room) return reply({ ok: false, error: "NOT_PLAYING" }); try { reply(room.game.action(me.id, String(d?.k || ""))); } catch (e) { console.error("[bomb] act", e); reply({ ok: false, error: "INTERNAL" }); } });
    socket.on("bomb:pick", guard((pl, cb) => { const room = gameOf(); if (!room) return cb({ ok: false, error: "NOT_PLAYING" }); const g = room.game; const r = pl.refresh ? g.refreshOffer(me.id) : g.pick(me.id, String(pl.id || "")); cb(r); if (r.ok) emitState(io, room); }));
    socket.on("bomb:leaveRoom", guard((pl, cb) => { const room = myRoom(); if (room) { leave(io, room, me.id); socket.leave(chan(room.id)); } cb({ ok: true }); }));
    socket.on("bomb:sync", guard((pl, cb) => { const room = myRoom(); cb(room ? { ok: true, state: publicRoom(room, me.id), meta: META } : { ok: false, error: "NOT_IN_ROOM", meta: META }); }));
    socket.on("bomb:ping", (d, cb) => { if (typeof cb === "function") cb({ t: now() }); });
    socket.on("disconnect", () => {
      const room = myRoom(); if (!room) return;
      if (room.spectators.get(me.id) === socket.id) { room.spectators.delete(me.id); if (userRoom.get(me.id) === room.id) userRoom.delete(me.id); return emitState(io, room); }
      const m = room.members.get(me.id); if (!m || m.sockId !== socket.id) return;
      m.connected = false; m.dcAt = now();
      const p = room.game?.players.get(me.id); if (p && !p.isBot) p.mv = 0;
      emitAll(io, room, "bomb:notice", { k: "dc", name: m.name });
      const at = m.dcAt;
      if (room.status !== "playing") setTimeout(() => { if (rooms.get(room.id) !== room || room.status === "playing") return; const q = room.members.get(me.id); if (q && !q.connected && q.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS);
      else if (room.hostUserId === me.id) pickHost(room);
      checkEmpty(io, room); emitState(io, room);
    });
  });
}
addPublicRooms("bomb", rooms);
export const _bombTest = { rooms, invites, userRoom };
