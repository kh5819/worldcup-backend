// =========================
// DUO TERRITORY — 방·소켓 (2026-11-16) · 이벤트 prefix 'tr:*' · 2~20인 · 팀전 · 관전 · 재접속 · AI
// · 서버 20Hz 고정 틱. 클라이언트는 방향·증강 사용만 보냄 (판정·영토·점수는 서버)
// · 매 틱 바뀐 것만(tr:s), 1초마다 점수판(tr:b), 처음·재접속·체크섬 불일치 땐 전체(tr:full)
// · 끊기거나 나가면 그 캐릭터는 AI가 대신 움직임(돌아오면 다시 직접)
// · 스트리머 모드: 치지직·씨미(공식)·SOOP 별풍선(비공식) 실제 후원 연동 + 방장 테스트 후원
// =========================
import { createFlight } from "./create-flight.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 기록 (11-22)
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicRooms } from "./public-rooms.js";
import { TerritoryGame, HZ, PICK_MS } from "./territory-game.js";
import { AUGS, RARITY } from "./territory-augs.js";
import { botThink } from "./territory-ai.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
const SOOP_BALLOON_KRW = 100, STREAM_KINDS = ["buff", "debuff", "randomAug", "mapEvent"];
const DEF_RULES = { buff: 1000, debuff: 1100, randomAug: 3000, mapEvent: 5000 };
let HOOKS = {};

const rooms = new Map(), invites = new Map(), userRoom = new Map();
const LEVELS = ["easy", "normal", "hard"], DURS = [180, 240, 300, 600], MAPS = ["classic", "neon", "candy", "jungle", "ice", "lava", "space", "pixel"];
const MAX_SPEC = 60, EMPTY_MS = 90000, ENDED_MS = 10 * 60000, LOBBY_DC_MS = 20000, MAX_NICK = 12;
const chan = (id) => `tr:${id}`;
const now = () => Date.now();
const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK);
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
export const META = { augs: AUGS.map(a => ({ ...a })), rarity: RARITY, maps: MAPS, durs: DURS, levels: LEVELS, hz: HZ, pickMs: PICK_MS };
const BOT_NAMES = ["콩콩", "모찌", "뭉치", "토리", "보리", "두부", "호떡", "찹쌀", "구름", "솜솜", "까미", "단지", "만두", "꿀떡", "밤톨", "깨비", "누리", "도담", "봄이", "하루"];

function newMember(id, name, o = {}) { return { id, name, avatar: o.avatar || null, isBot: !!o.isBot, isGuest: !!o.isGuest, level: o.level || "normal", team: o.team | 0, connected: !o.isBot, sockId: o.sockId || null, dcAt: 0, left: false }; }
const humans = (room) => [...room.members.values()].filter(m => !m.isBot);
const connectedHumans = (room) => humans(room).filter(m => m.connected && !m.left);
function lobbyView(room, viewer) {
  const mem = (m) => ({ id: m.id, name: m.name, avatar: m.avatar, isBot: m.isBot, isGuest: m.isGuest, level: m.level, team: m.team, connected: m.connected, left: m.left });
  const g = room.game, idx = g ? room.order.indexOf(viewer) : -1;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status, soloAi: !!room.soloAi, isPublic: !!room.isPublic,
    opts: { ...room.opts }, members: [...room.members.values()].map(mem), maxPlayers: room.maxPlayers,
    spectators: room.spectators.size, me: viewer || null, myIdx: idx, spectating: room.spectators.has(viewer), order: room.order || [],
    serverNow: now(), result: room.result || null,
    rules: room.rules, link: room.link, donLog: viewer === room.hostUserId ? room.donLog.slice(-20) : undefined,
  };
}
function sockets(room) { const out = []; for (const m of room.members.values()) if (!m.isBot && m.sockId && !m.left) out.push([m.id, m.sockId]); for (const [uid, sid] of room.spectators) out.push([uid, sid]); return out; }
function emitLobby(io, room) { for (const [uid, sid] of sockets(room)) io.to(sid).emit("tr:room", lobbyView(room, uid)); }
function emitAll(io, room, ev, d) { io.to(chan(room.id)).emit(ev, d); }
function sendFull(io, room, uid, sid) { if (!room.game) return; const i = room.order.indexOf(uid); io.to(sid).emit("tr:full", { ...room.game.full(i), serverNow: now() }); }
function sendMe(io, room, uid) { const m = room.members.get(uid); if (!m || !m.sockId || !room.game) return; const i = room.order.indexOf(uid); if (i >= 0) io.to(m.sockId).emit("tr:me", room.game.mine(i)); }

function stopLoop(room) { if (room.loop) { clearInterval(room.loop); room.loop = null; } if (room.pickTimer) { clearTimeout(room.pickTimer); room.pickTimer = null; } }
function deleteRoom(io, room, reason) {
  stopLoop(room); try { HOOKS.unlinkChat?.("dw_tr_" + room.inviteCode); } catch {} for (const k of ["emptyTimer", "endTimer"]) if (room[k]) clearTimeout(room[k]);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  for (const uid of [...room.members.keys(), ...room.spectators.keys()]) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  emitAll(io, room, "tr:closed", { reason }); io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room).length || room.spectators.size) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && !connectedHumans(room).length && !room.spectators.size) deleteRoom(io, room, "EMPTY"); }, EMPTY_MS);
}
function pickHost(room) { const h = humans(room).find(m => m.connected && !m.left); if (h) room.hostUserId = h.id; }

// ---------------- 경기 ----------------
function startGame(io, room) {
  stopLoop(room);
  for (const [uid, m] of room.members) if (m.left) room.members.delete(uid);
  const list = [...room.members.values()];
  if (room.opts.team) { // 팀 인원 맞추기: 많은 쪽에서 적은 쪽으로
    const t0 = list.filter(m => m.team === 0), t1 = list.filter(m => m.team === 1);
    while (Math.abs(t0.length - t1.length) > 1) { const from = t0.length > t1.length ? t0 : t1, to = from === t0 ? t1 : t0; const mv = from.pop(); mv.team = from === t0 ? 1 : 0; to.push(mv); }
  }
  room.order = list.map(m => m.id);
  room.game = new TerritoryGame({ mode: room.opts.mode, teamMode: room.opts.team, teamShare: room.opts.share, durationSec: room.opts.dur, respawn: room.opts.respawn, map: room.opts.map, players: list.map(m => ({ id: m.id, name: m.name, team: m.team, isBot: m.isBot, level: m.level })) });
  room.status = "playing"; room.result = null; room.pickKey = null;
  room.game.start();
  emitAll(io, room, "tr:start", {});
  emitLobby(io, room); // 방 정보(내 번호) 먼저 → 그다음 전체 상태
  for (const [uid, sid] of sockets(room)) sendFull(io, room, uid, sid);
  let lastBoard = 0, lastMe = 0;
  // 고정 틱: 타이머가 50ms를 정확히 못 지켜도(Windows 15.6ms 단위·서버 부하) 시간을 재서 밀린 틱을 따라잡음
  // → 게임 시간이 실제 시간과 같게 흐르고, 묶음 시각(sn)도 틱 예정 시각이라 간격이 고름
  const STEP = 1000 / HZ; let due = now();
  room.loop = setInterval(() => {
    const g = room.game; if (!g || rooms.get(room.id) !== room) return stopLoop(room);
    try {
      let n = 0;
      while (now() >= due && n < 4) {
        due += STEP; n++;
        if (g.phase !== "play") continue;
        g.order = room.order;
        for (const p of g.P) { const m = room.members.get(p.id); if (p.isBot || !m || !m.connected || m.left) botThink(g, p); }
        g.tick();
        const pkt = g.packet(); pkt.sn = Math.round(due - STEP);
        emitAll(io, room, "tr:s", pkt);
        if (g.phase !== "play") break;
      }
      if (now() - due > 500) due = now(); // 너무 밀리면(서버 멈춤 등) 따라잡지 않고 새로 시작
      const evs = g.drain(); if (evs.length) emitAll(io, room, "tr:ev", evs);
      if (g.phase === "pick" && room.pickKey !== g.pickIdx) onPick(io, room);
      const t = now();
      if (t - lastBoard > 1000) { lastBoard = t; emitAll(io, room, "tr:b", g.board()); }
      if (t - lastMe > 1000) { lastMe = t; for (const id of room.order) sendMe(io, room, id); }
      if (g.phase === "over") finish(io, room);
    } catch (e) { console.error("[territory] tick", e); }
  }, 8);
}
function onPick(io, room) {
  const g = room.game; room.pickKey = g.pickIdx;
  if (room.pickTimer) clearTimeout(room.pickTimer);
  room.pickTimer = setTimeout(() => { room.pickTimer = null; if (room.game === g && g.phase === "pick") { g.autoPick(); for (const id of room.order) sendMe(io, room, id); emitAll(io, room, "tr:phase", { phase: g.phase }); } }, PICK_MS + 300);
  // AI·자리 비운 사람은 조금 뒤 자동
  for (const p of g.P) { const m = room.members.get(p.id); if (p.isBot || !m?.connected || m.left) setTimeout(() => { if (room.game === g && g.phase === "pick" && !p.picked && p.offer?.length) { const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }; g.pick(p.i, [...p.offer].sort((a, b) => ord[AUGS.find(x => x.id === b).rarity] - ord[AUGS.find(x => x.id === a).rarity] || Math.random() - 0.5)[0]); emitAll(io, room, "tr:phase", { phase: g.phase, picking: g.P.filter(q => !q.picked).length }); } }, 700 + Math.random() * 1500); }
  emitAll(io, room, "tr:phase", { phase: "pick", idx: g.pickIdx, deadline: g.pickDeadline, serverNow: now() });
  for (const id of room.order) sendMe(io, room, id);
}
function finish(io, room) {
  stopLoop(room);
  const g = room.game; room.status = "ended";
  room.result = { ...g.result, names: g.P.map(p => p.name), teams: g.result.teams, mode: g.mode, total: g.total };
  emitAll(io, room, "tr:end", room.result);
  emitLobby(io, room);
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { room.endTimer = null; if (rooms.get(room.id) !== room || room.status !== "ended") return; // 10분 뒤: 사람이 남아 있으면 대기실로(방 유지), 없으면 닫기
    if (connectedHumans(room).length) { room.status = "lobby"; room.result = null; emitLobby(io, room); } else deleteRoom(io, room, "ENDED_TTL"); }, ENDED_MS);
}
/** 후원 1건 처리: 정확한 금액이 규칙과 같으면 효과 (경기 중일 때만) */
function receiveDonation(io, room, { platform, donor, amount, test }) {
  const kind = STREAM_KINDS.find(k => room.rules[k] === amount) || null;
  let target = null, applied = false;
  if (kind && room.status === "playing" && room.game?.phase === "play") { target = room.game.streamEvent(kind, -1); applied = target !== null; }
  const entry = { at: now(), platform, donor: cleanDonor(donor), amount, kind, applied, test: !!test };
  room.donLog.push(entry); if (room.donLog.length > 100) room.donLog.shift();
  emitAll(io, room, "tr:donation", { ...entry, target: target ?? -1 });
  return entry;
}
function onPlatformDonation(io, room, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || rooms.get(room.id) !== room) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  // 치지직·씨미 후원엔 고유 번호가 없음 → 같은 내용이 3초 안에 또 오면 같은 후원으로 봄 (대전쟁과 같은 방식)
  const t = now(), base = [platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|");
  if (platform !== "soop") { const prev = room.recent.get(base); if (prev != null && t - prev < 3000) return; room.recent.set(base, t); if (room.recent.size > 300) for (const [k, v] of room.recent) if (t - v > 3000) room.recent.delete(k); }
  receiveDonation(io, room, { platform, donor: data.donatorNickname || "익명 후원자", amount, test: false });
  sendLobbyHost(io, room);
}
function sendLobbyHost(io, room) { const h = room.members.get(room.hostUserId); if (h?.sockId) io.to(h.sockId).emit("tr:room", lobbyView(room, h.id)); }
function addBots(room, n, level) {
  for (let k = 0; k < n && room.members.size < room.maxPlayers; k++) {
    room.botSeq = (room.botSeq || 0) + 1; const bid = `trb_${room.id}_${room.botSeq}`;
    const t0 = [...room.members.values()].filter(m => m.team === 0).length;
    room.members.set(bid, newMember(bid, `🤖 ${BOT_NAMES[(room.botSeq - 1) % BOT_NAMES.length]}`, { isBot: true, level, team: t0 > room.members.size - t0 ? 1 : 0 }));
  }
}
async function profileOf(supa, me, nick) {
  let name = cleanNick(nick), avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = cleanNick(data.nickname); if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  if (!name || name === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; name = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name, avatar };
}
function attach(io, socket, room, m) {
  if (m.sockId && m.sockId !== socket.id) { const old = io.sockets.sockets.get(m.sockId); if (old) { old.emit("tr:replaced", {}); old.leave(chan(room.id)); } }
  m.sockId = socket.id; m.connected = true; m.left = false; m.dcAt = 0;
  socket.join(chan(room.id)); userRoom.set(m.id, room.id); checkEmpty(io, room);
}
function leave(io, room, uid) {
  if (room.spectators.has(uid)) { room.spectators.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); checkEmpty(io, room); return emitLobby(io, room); }
  const m = room.members.get(uid); if (!m) return;
  if (m.sockId) io.sockets.sockets.get(m.sockId)?.leave(chan(room.id));
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  if (room.status === "playing") { m.left = true; m.connected = false; emitAll(io, room, "tr:notice", { k: "leftAi", name: m.name }); }
  else { room.members.delete(uid); emitAll(io, room, "tr:notice", { k: "left", name: m.name }); }
  if (!connectedHumans(room).length && !room.spectators.size) return deleteRoom(io, room, "EMPTY");
  if (room.hostUserId === uid) pickHost(room);
  emitLobby(io, room);
}

export function registerTerritory(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks || {};
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.members.has(me.id) || r.spectators.has(me.id)) ? r : null; };
    const guard = (fn) => (pl, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[territory]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const r = fn(pl || {}, reply); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } };
    let win = 0, cnt = 0; const tooFast = (lim) => { const t = now(); if (t - win > 1000) { win = t; cnt = 0; } return ++cnt > lim; };

    socket.on("tr:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("territory", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `tr_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const solo = pl.soloAi === true;
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", soloAi: solo, isPublic: false,
        opts: { mode: pl.mode === "classic" ? "classic" : "augment", team: !!pl.team, share: pl.share !== false, dur: DURS.includes(+pl.dur) ? +pl.dur : 240, respawn: !!pl.respawn, map: MAPS.includes(pl.map) ? pl.map : "classic", stream: false },
        maxPlayers: Math.min(20, Math.max(2, +pl.maxPlayers || 8)), members: new Map(), spectators: new Map(), game: null, order: [], createdAt: now(),
        rules: { ...DEF_RULES }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, donLog: [], recent: new Map(),
      };
      Object.defineProperty(room, "players", { get: () => room.members });
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0 }); room.members.set(me.id, m); attach(io, socket, room, m);
      if (solo) { room.maxPlayers = Math.min(20, Math.max(2, (+pl.bots || 3) + 1)); addBots(room, room.maxPlayers - 1, LEVELS.includes(pl.level) ? pl.level : "normal"); }
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      if (solo && pl.autoStart) startGame(io, room); else emitLobby(io, room);
    }));
    socket.on("tr:joinRoom", guard(async (pl, cb) => {
      const room = rooms.get(invites.get(String(pl.code || "").trim()));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const ex = room.members.get(me.id);
      if (ex) { attach(io, socket, room, ex); cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true }); emitAll(io, room, "tr:notice", { k: "back", name: ex.name }); emitLobby(io, room); return setTimeout(() => sendFull(io, room, me.id, socket.id), 30); }
      if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const full = room.members.size >= room.maxPlayers;
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      if (pl.spectate === true || room.status === "playing" || full) {
        if (room.spectators.size >= MAX_SPEC) return cb({ ok: false, error: "SPEC_FULL" });
        room.spectators.set(me.id, socket.id); socket.join(chan(room.id)); userRoom.set(me.id, room.id); checkEmpty(io, room);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectating: true }); emitLobby(io, room); return sendFull(io, room, me.id, socket.id);
      }
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing" || room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const t0 = [...room.members.values()].filter(m => m.team === 0).length;
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: t0 > room.members.size - t0 ? 1 : 0 }); room.members.set(me.id, m); attach(io, socket, room, m);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META }); emitAll(io, room, "tr:notice", { k: "join", name }); emitLobby(io, room);
    }));
    socket.on("tr:joinSeat", guard(async (pl, cb) => {
      const room = myRoom(); if (!room || !room.spectators.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room || room.status === "playing" || room.members.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      room.spectators.delete(me.id);
      const t0 = [...room.members.values()].filter(m => m.team === 0).length;
      const m = newMember(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: t0 > room.members.size - t0 ? 1 : 0 }); room.members.set(me.id, m); attach(io, socket, room, m);
      cb({ ok: true }); emitAll(io, room, "tr:notice", { k: "join", name }); emitLobby(io, room);
    }));
    const hostOnly = (fn) => guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const r = fn(room, pl); cb(r); if (r.ok) emitLobby(io, room);
    });
    socket.on("tr:setOpts", hostOnly((room, pl) => {
      const o = room.opts;
      if (pl.mode === "classic" || pl.mode === "augment") o.mode = pl.mode;
      if (typeof pl.team === "boolean") o.team = pl.team;
      if (typeof pl.share === "boolean") o.share = pl.share;
      if (typeof pl.respawn === "boolean") o.respawn = pl.respawn;
      if (typeof pl.stream === "boolean") o.stream = pl.stream;
      if (o.stream) logGameStreamer("territory", room);
      if (DURS.includes(+pl.dur)) o.dur = +pl.dur;
      if (MAPS.includes(pl.map)) o.map = pl.map;
      if (pl.maxPlayers !== undefined) { const v = Math.min(20, Math.max(2, +pl.maxPlayers | 0)); if (v < room.members.size) return { ok: false, error: "BELOW_CURRENT" }; room.maxPlayers = v; }
      if (typeof pl.isPublic === "boolean") room.isPublic = pl.isPublic;
      return { ok: true };
    }));
    socket.on("tr:addBot", hostOnly((room, pl) => { if (room.members.size >= room.maxPlayers) return { ok: false, error: "ROOM_FULL" }; addBots(room, pl.fill ? room.maxPlayers - room.members.size : 1, LEVELS.includes(pl.level) ? pl.level : "normal"); if (room.status === "ended") room.status = "lobby"; return { ok: true }; }));
    socket.on("tr:kick", hostOnly((room, pl) => {
      const uid = String(pl.uid || ""), m = room.members.get(uid); if (!m || uid === me.id) return { ok: false, error: "BAD_TARGET" };
      if (m.sockId) { io.to(m.sockId).emit("tr:kicked", {}); io.sockets.sockets.get(m.sockId)?.leave(chan(room.id)); }
      room.members.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); emitAll(io, room, "tr:notice", { k: "kicked", name: m.name }); return { ok: true };
    }));
    socket.on("tr:team", guard((pl, cb) => {
      const room = myRoom(); if (!room || room.status === "playing" || !room.opts.team) return cb({ ok: false, error: "NOT_NOW" });
      const target = pl.uid && room.hostUserId === me.id ? String(pl.uid) : me.id; const m = room.members.get(target); if (!m) return cb({ ok: false, error: "BAD_TARGET" });
      m.team = m.team ? 0 : 1; cb({ ok: true }); emitLobby(io, room);
    }));
    socket.on("tr:start", guard((pl, cb) => {
      const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      for (const [uid, m] of room.members) if (m.left) room.members.delete(uid);
      if (room.members.size < 2) return cb({ ok: false, error: "NEED_2" });
      if (room.opts.team) { const t0 = [...room.members.values()].filter(m => m.team === 0).length, t1 = room.members.size - t0; if (Math.abs(t0 - t1) > 1 || !t0 || !t1) return cb({ ok: false, error: "TEAM_UNEVEN" }); }
      cb({ ok: true }); startGame(io, room);
    }));
    // ---- 경기 입력 ----
    const inGame = () => { const room = myRoom(); if (!room || room.status !== "playing" || !room.game) return null; const i = room.order.indexOf(me.id); if (i < 0) return null; const m = room.members.get(me.id); if (!m || m.left) return null; return { room, i }; };
    socket.on("tr:dir", (pl) => { try { if (tooFast(40)) return; const x = inGame(); if (!x) return; const d = pl?.d; if (Number.isInteger(d)) x.room.game.setDir(x.i, d); } catch (e) { console.error("[territory] dir", e); } });
    socket.on("tr:use", guard((pl, cb) => { if (tooFast(40)) return cb({ ok: false, error: "TOO_FAST" }); const x = inGame(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" }); const r = x.room.game.use(x.i, String(pl.id || "")); cb(r); if (r.ok) sendMe(io, x.room, me.id); }));
    socket.on("tr:pick", guard((pl, cb) => {
      const x = inGame(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" });
      const g = x.room.game, r = pl.refresh ? g.refreshOffer(x.i) : g.pick(x.i, String(pl.id || ""));
      cb(r); if (r.ok) { sendMe(io, x.room, me.id); emitAll(io, x.room, "tr:phase", { phase: g.phase, picking: g.P.filter(q => !q.picked).length }); }
    }));
    let heavyAt = 0; const heavy = () => { const t = now(); if (t - heavyAt < 400) return true; heavyAt = t; return false; }; // 전체 상태 보내기는 무거움 → 0.4초에 1번
    socket.on("tr:ping", (pl, cb) => { if (tooFast(40)) return; if (typeof cb === "function") cb(1); }); // 핑 재기 (화면 예측용)
    socket.on("tr:resync", guard((pl, cb) => { const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" }); if (heavy()) return cb({ ok: false, error: "TOO_FAST" }); sendFull(io, room, me.id, socket.id); cb({ ok: true }); }));
    socket.on("tr:stream", guard((pl, cb) => {
      const room = myRoom(); if (!room || room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (!room.opts.stream || room.status !== "playing") return cb({ ok: false, error: "NOT_NOW" });
      if (room.lastStream && now() - room.lastStream < 1500) return cb({ ok: false, error: "TOO_FAST" });
      room.lastStream = now();
      const k = ["buff", "debuff", "randomAug", "mapEvent"].includes(pl.kind) ? pl.kind : null; if (!k) return cb({ ok: false, error: "BAD" });
      const target = Number.isInteger(pl.target) ? pl.target : -1;
      const r = room.game.streamEvent(k, target); cb({ ok: r !== null, target: r });
    }));
    const hostRoom = (cb) => { const room = myRoom(); if (!room || room.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; } if (room.soloAi) { cb({ ok: false, error: "NOT_NOW" }); return null; } return room; };
    socket.on("tr:streamRules", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const next = { ...room.rules };
      for (const k of STREAM_KINDS) if (pl[k] !== undefined) { const v = parseAmount(Number(pl[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; }
      if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" });
      room.rules = next; cb({ ok: true }); emitLobby(io, room);
    }));
    socket.on("tr:testDonation", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return; if (!room.opts.stream) return cb({ ok: false, error: "NOT_NOW" });
      if (room.lastTest && now() - room.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); room.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      const e = receiveDonation(io, room, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }); cb({ ok: true, entry: e }); sendLobbyHost(io, room);
    }));
    socket.on("tr:streamLink", guard(async (pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (room.link.status === "connecting" && now() - (room.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      room.linkAt = now(); room.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitLobby(io, room);
      const key = "dw_tr_" + room.inviteCode; // dw_ 로 시작 → 시청자가 공개 주소로 못 끊게 막는 기존 보호·동시 연결 제한을 그대로 받음
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: room.inviteCode, contentMode: "territory",
          onDonation: (d) => onPlatformDonation(io, room, platform, d), onChat: () => {}, onClose: () => { if (rooms.get(room.id) !== room) return; room.link = { ...room.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitLobby(io, room); } });
        if (rooms.get(room.id) !== room) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        room.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { room.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitLobby(io, room); cb({ ok: room.link.status === "connected", link: room.link });
    }));
    socket.on("tr:streamUnlink", guard((pl, cb) => { const room = hostRoom(cb); if (!room) return; try { HOOKS.unlinkChat?.("dw_tr_" + room.inviteCode); } catch {} room.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitLobby(io, room); cb({ ok: true }); }));
    socket.on("tr:leaveRoom", guard((pl, cb) => { const room = myRoom(); if (room) { leave(io, room, me.id); socket.leave(chan(room.id)); } cb({ ok: true }); }));
    socket.on("tr:sync", guard((pl, cb) => { const room = myRoom(); cb(room ? { ok: true, room: lobbyView(room, me.id), meta: META } : { ok: false, error: "NOT_IN_ROOM", meta: META }); if (room && !heavy()) sendFull(io, room, me.id, socket.id); }));
    socket.on("disconnect", () => {
      const room = myRoom(); if (!room) return;
      if (room.spectators.get(me.id) === socket.id) { room.spectators.delete(me.id); if (userRoom.get(me.id) === room.id) userRoom.delete(me.id); checkEmpty(io, room); return emitLobby(io, room); }
      const m = room.members.get(me.id); if (!m || m.sockId !== socket.id) return;
      m.connected = false; m.dcAt = now(); const at = m.dcAt;
      emitAll(io, room, "tr:notice", { k: room.status === "playing" ? "dcAi" : "dc", name: m.name });
      if (room.status !== "playing") setTimeout(() => { if (rooms.get(room.id) !== room || room.status === "playing") return; const q = room.members.get(me.id); if (q && !q.connected && q.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS);
      if (room.hostUserId === me.id) pickHost(room);
      checkEmpty(io, room); emitLobby(io, room);
    });
  });
}
addPublicRooms("territory", rooms);
export const _trTest = { rooms, invites, userRoom, onPlatformDonation, receiveDonation };
