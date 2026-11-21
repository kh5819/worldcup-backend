// =========================
// 플듀 증강 윷놀이 — 멀티 방·턴 진행 (2026-11-15)
// · 규칙·증강 판정은 yut-engine.js (서버 권한). 여기선 방·대기실·관전·재접속·AI·시간 제한
// · 개인전 2~8인 / 팀전 2:2·3:3·4:4 (팀원이 말 4개를 같이 쓰고 번갈아 던짐), 게스트 가능, 혼자 AI 대결(soloAi)
// · 모드: classic(일반) · augment(기존 증강) · expand(증강 확장전 — 특수 윷판·진화·함정·팀 능력·보스·확장 증강, yut-expand.js)
// · 이벤트 prefix 'yut:*'
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicRooms } from "./public-rooms.js";
import { YutGame, aiChooseMove, aiChooseAug, aiChooseChoice } from "./yut-engine.js";
import { AUGS, AUG, RARITY } from "./yut-augs.js";
import { NODE_XY, EDGES, RES_LABEL } from "./yut-core.js";
import { XAUGS, XAUG, X_META, MAPS } from "./yut-expand.js";
const MODES = ["classic", "augment", "expand"];
const MAP_OPTS = ["random", ...Object.keys(MAPS)];

const rooms = new Map(), invites = new Map(), userRoom = new Map();
const TURN_SECS = [0, 30, 45, 60, 90];
const PICK_SEC = 25, DC_AUTO_MS = 6000, LOBBY_DC_MS = 15000, EMPTY_MS = 90000, ENDED_MS = 10 * 60000, MAX_SPEC = 30, MAX_NICK = 12;
const BOT_MS = [650, 1150];
const chan = (id) => `yut:${id}`;
const now = () => Date.now();
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK);
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const metaAug = (a, exp) => ({ id: a.id, rarity: a.rarity, icon: a.icon, name: a.name, kind: a.kind, charges: a.charges ?? null, cap: a.cap ?? null, target: a.target || null, cond: a.cond, effect: a.effect, duration: a.duration, desc: a.desc, fx: a.fx || null, exp: !!exp });
const META = {
  augs: [...AUGS.map(({ id }) => metaAug(AUG[id])), ...XAUGS.map(({ id }) => metaAug(XAUG[id], true))],
  rarity: RARITY, nodes: NODE_XY, edges: EDGES, resLabel: RES_LABEL, x: X_META,
};

function newMember(id, name, o = {}) { return { id, name, avatar: o.avatar || null, isBot: !!o.isBot, isGuest: !!o.isGuest, connected: !o.isBot, left: false, sockId: o.sockId || null, dcAt: 0, team: o.team ?? 0 }; }
const humans = (room) => [...room.players.values()].filter(m => !m.isBot && !m.left);
const connectedHumans = (room) => humans(room).filter(m => m.connected);
const isAuto = (m) => !m || m.isBot || m.left || !m.connected;

// ---------------- 공개 상태 ----------------
function publicRoom(room, viewer) {
  const g = room.game;
  const meM = viewer ? room.players.get(viewer) : null;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status, soloAi: !!room.soloAi,
    opts: { mode: room.mode, teamMode: room.teamMode, maxPlayers: room.maxPlayers, pieces: room.pieces, backdo: room.backdo, maxAugs: room.maxAugs, pickEvery: room.pickEvery, turnSec: room.turnSec, map: room.map, traps: room.traps },
    members: room.order.map(uid => { const m = room.players.get(uid); return { id: m.id, name: m.name, avatar: m.avatar, isBot: m.isBot, isGuest: m.isGuest, connected: m.connected, left: m.left, team: m.team }; }),
    spectators: room.spectators.size,
    me: viewer || null, spectating: !!(viewer && !meM && room.spectators.has(viewer)),
    game: g ? g.publicState(meM ? viewer : null) : null,
    turnDeadline: room.turnDeadline || null, pickDeadline: g && g.phase === "pick" ? room.pickDeadline : null,
    result: room.result || null, serverNow: now(), seq: room.seq,
  };
}
function sockets(room) {
  const out = [];
  for (const m of room.players.values()) if (!m.isBot && m.sockId) out.push([m.id, m.sockId]);
  for (const [uid, sid] of room.spectators) out.push([uid, sid]);
  return out;
}
function emitState(io, room) { for (const [uid, sid] of sockets(room)) io.to(sid).emit("yut:state", publicRoom(room, uid)); }
function emitAll(io, room, ev, data) { io.to(chan(room.id)).emit(ev, data); }

// ---------------- 진행 ----------------
function clearTimers(room) { for (const k of ["turnTimer", "pickTimer", "botTimer", "dcTimer"]) if (room[k]) { clearTimeout(room[k]); room[k] = null; } }
function deleteRoom(io, room, reason) {
  clearTimers(room); if (room.emptyTimer) clearTimeout(room.emptyTimer); if (room.endTimer) clearTimeout(room.endTimer);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  for (const uid of room.order) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  for (const uid of room.spectators.keys()) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  emitAll(io, room, "yut:closed", { reason });
  io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room).length) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && !connectedHumans(room).length) deleteRoom(io, room, "EMPTY"); }, EMPTY_MS);
}
/** 엔진 사건을 보내고, 단계에 맞게 타이머·봇을 다시 잡음 */
function sync(io, room) {
  const g = room.game; if (!g) return emitState(io, room);
  const evs = g.drain();
  room.seq++;
  if (evs.length) emitAll(io, room, "yut:ev", { seq: room.seq, evs });
  if (g.phase === "over") return finish(io, room);
  if (g.phase === "pick") {
    if (room.timerKey !== "pick" + g.pickIdx) {
      clearTimers(room); room.timerKey = "pick" + g.pickIdx; room.turnDeadline = null;
      room.pickDeadline = now() + PICK_SEC * 1000;
      room.pickTimer = setTimeout(() => { room.pickTimer = null; if (g.phase === "pick") { g.autoPickAll(); sync(io, room); } }, PICK_SEC * 1000 + 300);
      // 봇·끊긴 사람은 조금 뒤 자동 고르기
      room.botTimer = setTimeout(() => { room.botTimer = null; autoPickAutos(io, room); }, rnd(1100, 2200));
    }
  } else if (g.phase === "play" && g.cur) {
    const key = "turn" + g.turnNo;
    if (room.timerKey !== key) {
      clearTimers(room); room.timerKey = key;
      const m = room.players.get(g.cur.uid);
      if (room.turnSec > 0 && !isAuto(m)) {
        // 같은 차례에 다시 들어오면(새로고침) 남은 시간 그대로 — 단 최소 10초
        const full = now() + room.turnSec * 1000;
        room.turnDeadline = room.dlTurn === g.turnNo && room.dlAt ? Math.min(full, Math.max(room.dlAt, now() + 10000)) : full;
        room.dlTurn = g.turnNo; room.dlAt = room.turnDeadline;
        const tn = g.turnNo, ms = room.turnDeadline - now();
        room.turnTimer = setTimeout(() => { room.turnTimer = null; if (g.turnNo === tn && g.phase === "play") autoTurn(io, room, tn, true); }, ms + 300);
      } else room.turnDeadline = null;
      if (m && (m.isBot || m.left)) scheduleBot(io, room, g.turnNo);
      else if (m && !m.connected) room.dcTimer = setTimeout(() => { room.dcTimer = null; scheduleBot(io, room, g.turnNo, 0); }, DC_AUTO_MS);
    }
  }
  emitState(io, room);
}
function autoPickAutos(io, room) {
  const g = room.game; if (!g || g.phase !== "pick") return;
  for (const p of g.players.values()) { const m = room.players.get(p.id); if (!p.picked && isAuto(m) && p.offer?.length) g.pick(p.id, bestOf(p.offer), true); }
  sync(io, room);
}
function bestOf(offer) { const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }; return [...offer].sort((a, b) => ord[META.augs.find(x => x.id === b).rarity] - ord[META.augs.find(x => x.id === a).rarity])[0]; }
function scheduleBot(io, room, turnNo, delay) {
  if (room.botTimer) clearTimeout(room.botTimer);
  room.botTimer = setTimeout(() => { room.botTimer = null; botStep(io, room, turnNo); }, delay ?? rnd(...BOT_MS));
}
/** 봇(또는 대신 두기) 한 걸음 */
function botStep(io, room, turnNo, fast = false) {
  const g = room.game;
  if (!g || g.phase !== "play" || !g.cur || g.turnNo !== turnNo) return;
  const uid = g.cur.uid, m = room.players.get(uid);
  if (!fast && m && !isAuto(m)) return; // 사람이 돌아왔으면 멈춤
  const c = g.cur;
  let acted = false;
  if (m?.isBot && !fast) { const a = aiChooseAug(g); if (a && Math.random() < 0.8) { const r = a.ability ? g.x.useAbility(uid, a) : g.useAug(uid, a.id, a); acted = r.ok; } }
  if (!acted && m?.isBot && !fast && g.x) { for (const pc of g.pieces) if (pc.evoPick && pc.team === c.team) g.x.autoEvo(pc); }
  if (!acted) {
    if (c.choice) g.choose(uid, aiChooseChoice(g));
    else if (c.phase === "throw") g.throw(uid);
    else { const mv = aiChooseMove(g); if (mv) g.move(uid, mv); else return; }
  }
  sync(io, room);
  if (g.phase === "play" && g.turnNo === turnNo) { if (fast) return botStep(io, room, turnNo, true); scheduleBot(io, room, turnNo); }
}
function autoTurn(io, room, turnNo) {
  const g = room.game; const m = room.players.get(g.cur?.uid);
  emitAll(io, room, "yut:notice", { k: "timeout", name: m?.name || "?" });
  for (let i = 0; i < 60 && g.phase === "play" && g.turnNo === turnNo; i++) botStep(io, room, turnNo, true);
}
function finish(io, room) {
  clearTimers(room);
  const g = room.game;
  room.status = "ended"; room.turnDeadline = null;
  const stats = g.resultStats();
  room.result = {
    mode: g.mode, winner: g.winner, teamMode: room.teamMode,
    ranking: g.ranking.map(r => ({ ...r, members: r.members.map(uid => ({ id: uid, name: room.players.get(uid)?.name || "?", avatar: room.players.get(uid)?.avatar || null, isBot: !!room.players.get(uid)?.isBot })) })),
    players: stats.map(s => ({ ...s, name: room.players.get(s.id)?.name || "?" })),
  };
  emitAll(io, room, "yut:end", room.result);
  emitState(io, room);
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { if (rooms.get(room.id) === room && room.status === "ended") deleteRoom(io, room, "ENDED_TTL"); }, ENDED_MS);
}
function startGame(io, room) {
  clearTimers(room);
  for (const uid of [...room.order]) { const m = room.players.get(uid); if (!m || m.left || (!m.isBot && !m.connected)) removeMember(room, uid); }
  if (room.teamMode === "team") balanceTeams(room);
  else room.order.forEach((uid, i) => (room.players.get(uid).team = i));
  // 팀전 순서: 팀을 번갈아 (엔진이 팀 순서대로 돌고 팀 안에서 번갈아 던짐)
  const players = room.order.map(uid => { const m = room.players.get(uid); return { id: uid, name: m.name, team: m.team, isBot: m.isBot }; });
  room.game = new YutGame(players, { mode: room.mode, pieces: room.pieces, backdo: room.backdo, maxAugs: room.maxAugs, pickEvery: room.pickEvery, map: room.map === "random" ? null : room.map, traps: room.traps });
  room.status = "playing"; room.result = null; room.timerKey = null; room.dlTurn = 0; room.dlAt = 0;
  emitAll(io, room, "yut:start", { mode: room.mode });
  room.game.start();
  sync(io, room);
}
function balanceTeams(room) {
  // 지정한 팀을 최대한 살리되 두 팀 인원을 같게
  const ids = room.order.slice();
  const t0 = ids.filter(u => room.players.get(u).team === 0), t1 = ids.filter(u => room.players.get(u).team !== 0);
  const half = ids.length / 2;
  while (t0.length > half) t1.push(t0.pop());
  while (t1.length > half) t0.push(t1.pop());
  for (const u of t0) room.players.get(u).team = 0;
  for (const u of t1) room.players.get(u).team = 1;
}
function removeMember(room, uid) {
  room.players.delete(uid);
  const i = room.order.indexOf(uid); if (i >= 0) room.order.splice(i, 1);
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
}
function pickHost(room) { const h = room.order.map(u => room.players.get(u)).find(m => m && !m.isBot && !m.left && m.connected) || room.order.map(u => room.players.get(u)).find(m => m && !m.isBot && !m.left); if (h) room.hostUserId = h.id; }
function leave(io, room, uid, why = "left") {
  if (room.spectators.has(uid)) { room.spectators.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); emitState(io, room); return; }
  const m = room.players.get(uid); if (!m) return;
  const wasHost = room.hostUserId === uid;
  if (room.status === "playing") { m.left = true; m.connected = false; if (userRoom.get(uid) === room.id) userRoom.delete(uid); }
  else removeMember(room, uid);
  if (m.sockId) io.sockets.sockets.get(m.sockId)?.leave(chan(room.id));
  emitAll(io, room, "yut:notice", { k: why, name: m.name });
  if (!humans(room).length) return deleteRoom(io, room, "EMPTY");
  if (wasHost) pickHost(room);
  if (room.status === "playing") {
    // 나간 사람 차례·고르기는 자동으로
    room.timerKey = null;
    if (room.game.phase === "pick") autoPickAutos(io, room); else sync(io, room);
    return;
  }
  emitState(io, room);
}
async function profileOf(supa, me, nick) {
  let name = cleanNick(nick), avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = cleanNick(data.nickname); if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  if (!name || name === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; name = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name, avatar };
}
function attach(io, socket, room, m) {
  if (m.sockId && m.sockId !== socket.id) { const old = io.sockets.sockets.get(m.sockId); if (old) { old.emit("yut:replaced", {}); old.leave(chan(room.id)); } }
  m.sockId = socket.id; m.connected = true; m.dcAt = 0;
  socket.join(chan(room.id)); userRoom.set(m.id, room.id);
  checkEmpty(io, room);
}
function limits(room) { return room.teamMode === "team" ? [4, 6, 8] : [2, 3, 4, 5, 6, 7, 8]; }

export function registerYut(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spectators.has(me.id)) ? r : null; };
    const guard = (fn) => (pl, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[yut]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const r = fn(pl || {}, reply); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } };
    let win = 0, cnt = 0; const tooFast = () => { const t = now(); if (t - win > 1000) { win = t; cnt = 0; } return ++cnt > 15; };
    let hwin = 0, hcnt = 0; const hoverFast = () => { const t = now(); if (t - hwin > 1000) { hwin = t; hcnt = 0; } return ++hcnt > 12; }; // 미리보기는 따로 셈 (이동 버튼이 막히지 않게)

    socket.on("yut:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("yut", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `yu_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const teamMode = pl.teamMode === "team" ? "team" : "ffa";
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", soloAi: pl.soloAi === true, isPublic: false,
        mode: MODES.includes(pl.mode) ? pl.mode : "augment", teamMode, map: MAP_OPTS.includes(pl.map) ? pl.map : "random", traps: pl.traps === "hidden" ? "hidden" : "open", maxPlayers: teamMode === "team" ? 4 : 4,
        pieces: [2, 3, 4].includes(Number(pl.pieces)) ? Number(pl.pieces) : 4, backdo: pl.backdo !== false,
        maxAugs: [2, 3, 4, 5, 6].includes(Number(pl.maxAugs)) ? Number(pl.maxAugs) : 4, pickEvery: [3, 4, 5, 6].includes(Number(pl.pickEvery)) ? Number(pl.pickEvery) : 4,
        turnSec: TURN_SECS.includes(Number(pl.turnSec)) ? Number(pl.turnSec) : 60,
        players: new Map(), order: [], spectators: new Map(), game: null, seq: 0, botSeq: 0, result: null, createdAt: now(),
      };
      const mp = Number(pl.maxPlayers); if (limits(room).includes(mp)) room.maxPlayers = mp;
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0 });
      room.players.set(me.id, m); room.order.push(me.id);
      attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitState(io, room);
    }));

    socket.on("yut:joinRoom", guard(async (pl, cb) => {
      const room = rooms.get(invites.get(String(pl.code || "").trim()));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const ex = room.players.get(me.id);
      if (ex && !ex.left) {
        attach(io, socket, room, ex);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true });
        emitAll(io, room, "yut:notice", { k: "back", name: ex.name });
        if (room.game?.cur?.uid === me.id) { if (room.dcTimer) { clearTimeout(room.dcTimer); room.dcTimer = null; } if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; } room.timerKey = null; }
        return sync(io, room);
      }
      const spectate = pl.spectate === true || room.status === "playing" || (room.status === "lobby" && room.players.size >= room.maxPlayers);
      if (room.soloAi && !spectate) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (spectate) {
        if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.spectators.size >= MAX_SPEC && !room.spectators.has(me.id)) return cb({ ok: false, error: "SPEC_FULL" });
        const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
        room.spectators.set(me.id, socket.id); socket.join(chan(room.id)); userRoom.set(me.id, room.id);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectating: true });
        return emitState(io, room);
      }
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.players.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const t0 = [...room.players.values()].filter(x => x.team === 0).length;
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: room.teamMode === "team" ? (t0 > room.players.size - t0 ? 1 : 0) : room.players.size });
      room.spectators.delete(me.id); // 관전하다 빈자리로 들어온 경우
      room.players.set(me.id, m); room.order.push(me.id);
      attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitAll(io, room, "yut:notice", { k: "join", name });
      emitState(io, room);
    }));

    const hostLobby = (fn) => guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const r = fn(room, pl); cb(r); if (r.ok) emitState(io, room);
    });
    socket.on("yut:setOpts", hostLobby((room, pl) => {
      if (MODES.includes(pl.mode)) room.mode = pl.mode;
      if (MAP_OPTS.includes(pl.map)) room.map = pl.map;
      if (pl.traps === "open" || pl.traps === "hidden") room.traps = pl.traps;
      if ((pl.teamMode === "team" || pl.teamMode === "ffa") && pl.teamMode !== room.teamMode) {
        if (pl.teamMode === "ffa" && room.players.size > 8) return { ok: false, error: "FFA_MAX6" };
        room.teamMode = pl.teamMode;
        if (!limits(room).includes(room.maxPlayers)) room.maxPlayers = limits(room).find(n => n >= Math.max(room.maxPlayers, room.players.size)) || limits(room).at(-1);
        room.order.forEach((uid, i) => (room.players.get(uid).team = room.teamMode === "team" ? i % 2 : i)); // 팀전이면 번갈아 두 팀으로
      }
      if (pl.maxPlayers !== undefined) { const n = Number(pl.maxPlayers); if (!limits(room).includes(n)) return { ok: false, error: "BAD_MAX" }; if (n < room.players.size) return { ok: false, error: "BELOW_CURRENT" }; room.maxPlayers = n; }
      if ([2, 3, 4].includes(Number(pl.pieces))) room.pieces = Number(pl.pieces);
      if (typeof pl.backdo === "boolean") room.backdo = pl.backdo;
      if ([2, 3, 4, 5, 6].includes(Number(pl.maxAugs))) room.maxAugs = Number(pl.maxAugs);
      if ([3, 4, 5, 6].includes(Number(pl.pickEvery))) room.pickEvery = Number(pl.pickEvery);
      if (pl.turnSec !== undefined && TURN_SECS.includes(Number(pl.turnSec))) room.turnSec = Number(pl.turnSec);
      return { ok: true };
    }));
    socket.on("yut:addBot", hostLobby((room, pl) => {
      const want = Math.max(1, Math.min(7, Number(pl.count) || 1)); let added = 0;
      while (added < want && room.players.size < room.maxPlayers) {
        room.botSeq++; const uid = `ytb_${room.id}_${room.botSeq}`;
        const t0 = [...room.players.values()].filter(x => x.team === 0).length;
        room.players.set(uid, newMember(uid, `🤖 윷봇${room.botSeq}`, { isBot: true, team: room.teamMode === "team" ? (t0 > room.players.size - t0 ? 1 : 0) : room.players.size }));
        room.order.push(uid); added++;
      }
      return added ? { ok: true } : { ok: false, error: "ROOM_FULL" };
    }));
    socket.on("yut:kick", hostLobby((room, pl) => {
      const uid = String(pl.uid || ""); const m = room.players.get(uid);
      if (!m || uid === me.id) return { ok: false, error: "BAD_TARGET" };
      if (m.sockId) io.to(m.sockId).emit("yut:kicked", {});
      leave(io, room, uid, "kicked"); return { ok: true };
    }));
    socket.on("yut:setTeam", guard((pl, cb) => {
      const room = myRoom(); if (!room || room.status === "playing" || room.teamMode !== "team") return cb({ ok: false, error: "NOT_ALLOWED" });
      const uid = room.hostUserId === me.id && pl.uid ? String(pl.uid) : me.id; // 방장은 다른 사람(봇)도 옮길 수 있음
      const m = room.players.get(uid); if (!m) return cb({ ok: false, error: "BAD_TARGET" });
      const t = Number(pl.team) === 1 ? 1 : 0;
      const n = [...room.players.values()].filter(x => x.team === t).length;
      if (m.team !== t && n >= room.maxPlayers / 2) return cb({ ok: false, error: "TEAM_FULL" });
      m.team = t; cb({ ok: true }); emitState(io, room);
    }));
    socket.on("yut:start", guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const ready = room.order.filter(u => { const m = room.players.get(u); return m && !m.left && (m.isBot || m.connected); });
      if (ready.length < 2) return cb({ ok: false, error: "NEED_2" });
      if (room.teamMode === "team" && (ready.length % 2 || ready.length < 4)) return cb({ ok: false, error: "TEAM_EVEN" });
      cb({ ok: true }); startGame(io, room);
    }));

    // 게임 중 행동
    const act = (fn) => guard((pl, cb) => {
      if (tooFast()) return cb({ ok: false, error: "TOO_FAST" });
      const room = myRoom(); if (!room || room.status !== "playing" || !room.game) return cb({ ok: false, error: "NOT_PLAYING" });
      if (!room.players.has(me.id) || room.players.get(me.id).left) return cb({ ok: false, error: "NOT_PLAYER" });
      const r = fn(room.game, pl) || { ok: false };
      cb(r);
      if (r.ok) sync(io, room);
    });
    socket.on("yut:throw", act((g) => g.throw(me.id)));
    socket.on("yut:choose", act((g, pl) => g.choose(me.id, Number(pl.i))));
    socket.on("yut:move", act((g, pl) => g.move(me.id, { ri: Number(pl.ri), pieceId: String(pl.pieceId || ""), pathIdx: Number(pl.pathIdx) || 0 })));
    socket.on("yut:aug", act((g, pl) => g.useAug(me.id, String(pl.id || ""), { pieceId: pl.pieceId, targetId: pl.targetId, pieceId2: pl.pieceId2, node: Number(pl.node), steps: Number(pl.steps), pathIdx: Number(pl.pathIdx) || 0, ri: Number.isInteger(pl.ri) ? pl.ri : undefined, value: Number(pl.value) })));
    socket.on("yut:pick", act((g, pl) => pl.refresh ? g.refreshOffer(me.id) : g.pick(me.id, String(pl.id || ""))));
    // 확장전: 팀 능력 고르기(첫 증강 고르기 때) · 팀 능력 쓰기 · 말 진화 고르기
    socket.on("yut:teamAbility", act((g, pl) => g.x && g.phase === "pick" ? g.x.setAbility(me.id, String(pl.id || "")) : { ok: false, error: "NOT_ALLOWED" }));
    socket.on("yut:ability", act((g, pl) => g.x ? g.x.useAbility(me.id, { pieceId: pl.pieceId, targetId: pl.targetId, pieceId2: pl.pieceId2, node: Number(pl.node), ri: Number.isInteger(pl.ri) ? pl.ri : undefined }) : { ok: false, error: "NOT_ALLOWED" }));
    socket.on("yut:evo", act((g, pl) => g.x && g.phase === "play" ? g.x.chooseEvo(me.id, String(pl.pieceId || ""), String(pl.evo || "")) : { ok: false, error: "NOT_ALLOWED" }));
    // 지금 고르는 말·길 미리 보기를 다른 사람에게 (판정 없음)
    socket.on("yut:hover", (pl) => {
      if (hoverFast()) return;
      const room = myRoom(); if (!room?.game?.cur || room.game.cur.uid !== me.id) return;
      const pieceId = pl?.pieceId ? String(pl.pieceId).slice(0, 20) : null;
      const to = Number.isInteger(pl?.to) && pl.to >= -1 && pl.to <= 99 ? pl.to : null;
      const steps = Array.isArray(pl?.steps) ? pl.steps.filter(n => Number.isInteger(n) && n >= 0 && n <= 99).slice(0, 12) : [];
      socket.to(chan(room.id)).emit("yut:hover", { uid: me.id, pieceId, to, steps });
    });
    socket.on("yut:leaveRoom", guard((pl, cb) => { const room = myRoom(); if (room) { leave(io, room, me.id); socket.leave(chan(room.id)); } cb({ ok: true }); }));
    socket.on("yut:sync", guard((pl, cb) => { const room = myRoom(); cb(room ? { ok: true, state: publicRoom(room, me.id), meta: META } : { ok: false, error: "NOT_IN_ROOM", meta: META }); }));

    socket.on("disconnect", () => {
      const room = myRoom(); if (!room) return;
      if (room.spectators.get(me.id) === socket.id) { room.spectators.delete(me.id); if (userRoom.get(me.id) === room.id) userRoom.delete(me.id); return emitState(io, room); }
      const m = room.players.get(me.id); if (!m || m.sockId !== socket.id) return;
      m.connected = false; m.dcAt = now();
      emitAll(io, room, "yut:notice", { k: "dc", name: m.name });
      if (room.status !== "playing") {
        const at = m.dcAt;
        setTimeout(() => { if (rooms.get(room.id) !== room || room.status === "playing") return; const q = room.players.get(me.id); if (q && !q.connected && q.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS);
      } else {
        if (room.hostUserId === me.id) pickHost(room);
        const g = room.game;
        if (g.phase === "pick") autoPickAutos(io, room); // 고르는 중에 끊기면 자동으로 골라 줌
        else if (g.cur?.uid === me.id) { room.timerKey = null; sync(io, room); return checkEmpty(io, room); }
      }
      checkEmpty(io, room); emitState(io, room);
    });
  });
}
addPublicRooms("yut", rooms);
export const _yutTest = { rooms, invites, userRoom, META };
