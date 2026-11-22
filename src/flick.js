// =========================
// DUO 증강 알까기 — 방·소켓 (2026-11-17)
// · 일반/증강, 2~8인, 개인전·팀전(2·3·4팀), 게스트, AI(쉬움·보통·어려움), 혼자 AI 대결(soloAi)
// · 관전(게임 중 입장·꽉 찬 방), 재접속(같은 아이디면 자리 그대로, 재생 중이면 남은 장면부터), 끊긴 사람 차례는 4.5초 뒤 AI가 대신
// · 물리·승패는 서버(flick-game.js · flick-physics.js). 화면은 조준(알·방향·힘)만 보냄
// · 스트리머 모드(플듀 대전쟁과 같은 방식): 치지직·씨미(공식)·SOOP(별풍선, 비공식) 후원 연결,
//   방장이 정한 '정확한 금액'의 후원만 효과, 서버가 대상·적용 시점(발사와 발사 사이)을 확인. 테스트 후원 따로 표시
//   시청자 응원: 채팅 "!번호" → 응원 수 표시, (방장이 켜면) 증강 고르기 때마다 응원 1등에게 보호막
//   연결하면 admin 「📺 스트리머」 기록에 남음 (contentMode "flick")
// · 이벤트 prefix 'flick:*'
// =========================
import { createFlight } from "./create-flight.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 기록 (11-22)
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicRooms } from "./public-rooms.js";
import { FlickGame, DEFAULT_OPTS, OPT_CHOICES, MAPS, SKINS, COLORS } from "./flick-game.js";
import { META_AUGS, RARITY, KIND_LABEL, SYNERGY, MAX_AUGS, PICK_EVERY, AUG, rollOffer } from "./flick-augs.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
const MAX_PLAYERS = [2, 3, 4, 5, 6, 7, 8];
const DIFFS = ["easy", "normal", "hard"];
const LOBBY_DC_MS = 15_000, EMPTY_ROOM_MS = 90_000, ENDED_ROOM_MS = 10 * 60_000;
const MAX_SPECT = 40, MAX_NICK = 12, TICK_MS = 100;
const SOOP_BALLOON_KRW = 100;
export const STREAM_KINDS = ["shield", "quake", "revive", "giant", "randomAug"];
const STREAM_LABEL = { shield: "🛡️ 보호막 1개", quake: "🌋 판 흔들기", revive: "💫 알 부활", giant: "🔵 다음 발사 거대 알", randomAug: "🎴 랜덤 증강" };
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {};

const chan = (id) => `flick:${id}`;
const now = () => Date.now();
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const humans = (room) => [...room.players.values()].filter(p => !p.isBot && !p.left);
const connectedCount = (room) => humans(room).filter(p => p.connected).length + [...room.spect.values()].filter(s => s.connected).length;

function cleanOpts(src, base) {
  const o = { ...base };
  for (const k of ["stones", "turnSec", "teams"]) if (src?.[k] !== undefined && OPT_CHOICES[k].includes(Number(src[k]))) o[k] = Number(src[k]);
  if (MAPS.includes(src?.map)) o.map = src.map;
  return o;
}
const defaultStream = () => ({ on: false, rules: { shield: 1000, quake: 3000, revive: 5000, giant: 2000, randomAug: 10000 }, targets: { shield: "streamer", quake: "random", revive: "streamer", giant: "streamer", randomAug: "streamer" }, cheerShield: false, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], queue: [], cheer: new Map(), cheerVoters: new Map(), recent: new Map() });

// ---------------- 상태 보내기 ----------------
function publicRoom(room, viewerId) {
  const spectator = !room.players.has(viewerId) || !!room.players.get(viewerId)?.left;
  const host = viewerId === room.hostUserId;
  const st = room.stream;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status, soloAi: !!room.soloAi,
    opts: { mode: room.mode, maxPlayers: room.maxPlayers, ...room.opts, botDiff: room.botDiff },
    seats: room.order.map(uid => { const p = room.players.get(uid); return { id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, diff: p.isBot ? p.diff : null, isGuest: p.isGuest, connected: p.isBot || p.connected, left: !!p.left, team: p.team ?? 0, skin: p.skin }; }),
    spectators: [...room.spect.values()].map(s => ({ id: s.id, name: s.name })),
    me: viewerId, spectator,
    stream: st.on ? {
      on: true, cheerShield: st.cheerShield, rules: st.rules, targets: st.targets, labels: STREAM_LABEL,
      link: host ? st.link : { status: st.link.status, platform: st.link.platform },
      log: st.log.slice(-12), queue: st.queue.length,
      cheer: Object.fromEntries(st.cheer),
    } : { on: false },
    game: room.game ? room.game.view(viewerId) : null,
    serverNow: now(),
  };
}
function emitState(io, room) {
  const sent = new Set();
  for (const p of room.players.values()) { if (p.isBot || !p.sockId || p.left) continue; io.to(p.sockId).emit("flick:state", publicRoom(room, p.id)); sent.add(p.sockId); }
  for (const s of room.spect.values()) if (s.sockId && !sent.has(s.sockId)) io.to(s.sockId).emit("flick:state", publicRoom(room, s.id));
}
function flush(io, room) {
  const g = room.game; if (!g || !g.events.length) return false;
  const evs = g.events.splice(0);
  // 발사 장면은 크니까 따로 한 번만 보냄 (상태엔 재생 중일 때만 들어감 — 재접속용)
  for (const e of evs) if (e.type === "shot") io.to(chan(room.id)).emit("flick:shot", { ...e.shot, serverNow: now() });
  io.to(chan(room.id)).emit("flick:fx", evs.filter(e => e.type !== "shot"));
  if (evs.some(e => e.type === "pick")) onPickStart(io, room);
  if (evs.some(e => e.type === "turn")) runQueue(io, room);
  if (g.phase === "ended" && room.status !== "ended") onEnded(io, room);
  emitState(io, room);
  return true;
}
function onEnded(io, room) {
  room.status = "ended"; room.endedAt = now();
  room.stream.queue = [];
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { room.endTimer = null; if (rooms.get(room.id) !== room || room.status !== "ended") return; if (connectedCount(room)) { room.status = "lobby"; room.game = null; emitState(io, room); } else deleteRoom(io, room, "ENDED_TTL"); }, ENDED_ROOM_MS);
}
function deleteRoom(io, room, reason) {
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  if (room.endTimer) clearTimeout(room.endTimer);
  try { HOOKS.unlinkChat?.("dw_fl_" + room.inviteCode); } catch {}
  rooms.delete(room.id); invites.delete(room.inviteCode); room.status = "deleted";
  for (const uid of [...room.order, ...room.spect.keys()]) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  io.to(chan(room.id)).emit("flick:closed", { reason });
  io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedCount(room) > 0) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && connectedCount(room) === 0) deleteRoom(io, room, "EMPTY"); }, room.soloAi ? 30_000 : EMPTY_ROOM_MS);
}

// ---------------- 진행 ----------------
function startGame(io, room) {
  for (const uid of [...room.order]) { const p = room.players.get(uid); if (!p || p.left || (!p.isBot && !p.connected)) removeSeat(room, uid); }
  room.status = "playing";
  room.game = new FlickGame({ players: room.order.map(uid => { const p = room.players.get(uid); return { id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, diff: p.diff, team: p.team, skin: p.skin }; }), mode: room.mode, opts: room.opts, now: now() });
  for (const gp of room.game.players) gp.connected = room.players.get(gp.id).isBot || room.players.get(gp.id).connected;
  room.stream.queue = []; room.stream.cheer = new Map(); room.stream.cheerVoters = new Map();
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  io.to(chan(room.id)).emit("flick:start", { mode: room.mode });
  flush(io, room) || emitState(io, room);
}
let ticker = null;
function ensureTicker(io) {
  if (ticker) return;
  ticker = setInterval(() => {
    const t = now();
    for (const room of rooms.values()) {
      if (room.status !== "playing" || !room.game) continue;
      try { room.game.tick(t); flush(io, room); } catch (e) { console.error("[flick] tick", e); }
    }
  }, TICK_MS);
  ticker.unref?.();
}
function removeSeat(room, uid) { room.players.delete(uid); const i = room.order.indexOf(uid); if (i >= 0) room.order.splice(i, 1); if (userRoom.get(uid) === room.id && !room.spect.has(uid)) userRoom.delete(uid); }
function pickNewHost(room) {
  const h = room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left && p.connected) || room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left);
  if (h) room.hostUserId = h.id;
}
function leave(io, room, uid, why = "left") {
  const s = room.spect.get(uid);
  if (s) { room.spect.delete(uid); if (userRoom.get(uid) === room.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(room.id)); if (humans(room).length === 0 && room.spect.size === 0) return deleteRoom(io, room, "EMPTY"); /* 마지막 사람(관전자)이 나가면 바로 정리 */ if (room.hostUserId === uid) pickNewHost(room); checkEmpty(io, room); return emitState(io, room); }
  const p = room.players.get(uid); if (!p) return;
  const wasHost = room.hostUserId === uid;
  if (room.status === "playing") { p.left = true; p.connected = false; if (userRoom.get(uid) === room.id) userRoom.delete(uid); room.game?.leave(uid, now()); }
  else removeSeat(room, uid);
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(room.id));
  io.to(chan(room.id)).emit("flick:notice", { k: why, name: p.name });
  if (humans(room).length === 0 && room.spect.size === 0) return deleteRoom(io, room, "EMPTY");
  if (humans(room).length === 0 && room.status === "playing") room.game.finish(now(), "last");
  if (wasHost) pickNewHost(room);
  if (!humans(room).some(h => h.id === room.hostUserId)) { const sp = [...room.spect.values()][0]; if (sp) room.hostUserId = sp.id; }
  flush(io, room) || emitState(io, room);
  checkEmpty(io, room);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, room, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("flick:replaced", {}); old.leave(chan(room.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0;
  socket.join(chan(room.id)); userRoom.set(rec.id, room.id);
  const gp = room.game?.P(rec.id); if (gp && !rec.left) gp.connected = true;
  checkEmpty(io, room);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isBot: !!o.isBot, diff: o.diff || "normal", isGuest: !!o.isGuest, connected: !o.isBot, left: false, sockId: o.sockId || null, dcAt: 0, team: o.team ?? 0, skin: o.skin || null });
function balanceTeam(room) {
  const n = room.opts.teams || 2; const c = Array(n).fill(0);
  for (const uid of room.order) { const p = room.players.get(uid); c[(p.team || 0) % n]++; }
  return c.indexOf(Math.min(...c));
}

// ---------------- 스트리머: 후원 ----------------
function pickTarget(room, how) {
  const g = room.game; const al = g.alivePlayers(); if (!al.length) return null;
  if (how === "streamer") { const h = g.P(room.hostUserId); if (h && !h.out) return h; }
  if (how === "leader") return al.slice().sort((a, b) => g.discsOf(b.id).length - g.discsOf(a.id).length)[0];
  if (how === "last") return al.slice().sort((a, b) => g.discsOf(a.id).length - g.discsOf(b.id).length)[0];
  return al[Math.floor(Math.random() * al.length)];
}
/** 효과 실행 — 발사와 발사 사이(차례 시작)에만. 서버가 대상·조건 확인 */
function applyStream(io, room, item) {
  const g = room.game, st = room.stream;
  const tgt = pickTarget(room, st.targets[item.kind] || "random");
  let note = null, ok = false;
  if (tgt) {
    if (item.kind === "shield") { const ds = g.discsOf(tgt.id).filter(d => d.shield < 2); const d = ds[Math.floor(Math.random() * ds.length)]; if (d) { d.shield++; ok = true; note = `${tgt.name} 알에 보호막`; } }
    if (item.kind === "revive") { const d = g.reviveOne(tgt); ok = !!d; note = d ? `${tgt.name} 알 부활` : `${tgt.name}: 떨어진 알 없음`; }
    if (item.kind === "giant") { tgt.freeGiant = true; ok = true; note = `${tgt.name} 다음 발사 거대 알`; }
    if (item.kind === "randomAug") {
      if (g.mode === "augment" && tgt.augs.length < MAX_AUGS) { const id = rollOffer(2, tgt.augs.map(a => a.id), { n: 1 })[0]; if (id) { g.grant(tgt, id, true); ok = true; note = `${tgt.name}: ${AUG[id].name}`; } }
      if (!ok) { const d = g.discsOf(tgt.id)[0]; if (d) { d.shield++; ok = true; note = `${tgt.name} 보호막 (증강 칸이 없어서)`; } }
    }
    if (item.kind === "quake") { ok = g.streamQuake(now()); note = ok ? "판 전체가 흔들려요" : "지금은 못 함"; }
  }
  const rec = item.rec; rec.status = ok ? "applied" : "skipped"; rec.note = note; rec.target = tgt?.id || null;
  g.applyStats();
  io.to(chan(room.id)).emit("flick:donation", { ...rec, label: STREAM_LABEL[item.kind] });
  flush(io, room) || emitState(io, room);
}
function runQueue(io, room) {
  const st = room.stream, g = room.game;
  if (!st.on || !st.queue.length || !g || g.phase !== "aim") return;
  if (g.turn?.resumed) return; // 판 흔들기 직후 같은 차례엔 다음 후원을 바로 이어 붙이지 않음 (차례가 계속 끊기지 않게 — 다음 차례에)
  const item = st.queue.shift();
  applyStream(io, room, item);
}
function receiveDonation(io, room, { platform, donor, amount, test }) {
  const st = room.stream;
  const kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: cleanDonor(donor), amount, kind, test: !!test, status: "received", note: null };
  if (!st.on) { rec.status = "off"; }
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (room.status !== "playing" || !room.game || room.game.phase === "ended") { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else if (st.queue.length >= 20) { rec.status = "queue_full"; rec.note = "대기열이 꽉 참"; }
  else { rec.status = "queued"; st.queue.push({ kind, rec }); }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(room.id)).emit("flick:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null });
  if (rec.status === "queued") runQueue(io, room);
  emitState(io, room);
  return rec;
}
function onPlatformDonation(io, room, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || rooms.get(room.id) !== room) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  // 치지직·씨미 후원엔 고유 번호가 없음 → 같은 내용이 3초 안에 또 오면 같은 후원 (대전쟁과 같은 방식)
  const t = now(), st = room.stream, base = [platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|");
  if (platform !== "soop") { const prev = st.recent.get(base); if (prev != null && t - prev < 3000) return; st.recent.set(base, t); if (st.recent.size > 300) for (const [k, v] of st.recent) if (t - v > 3000) st.recent.delete(k); }
  receiveDonation(io, room, { platform, donor: data.donatorNickname || "익명 후원자", amount, test: false });
}
// 시청자 응원: 채팅 "!번호" (자리 번호 1~8) — 한 사람당 마지막 응원 1개
function onViewerChat(io, room, msg) {
  const st = room.stream, g = room.game; if (!st.on || !g || g.phase === "ended") return;
  const text = String(msg?.text ?? msg?.content ?? msg?.message ?? "").trim();
  const who = String(msg?.sender ?? msg?.senderChannelId ?? msg?.uid ?? msg?.nick ?? msg?.nickname ?? "");
  const m = text.match(/^!\s*([1-8])$/); if (!m || !who) return;
  const p = g.players[Number(m[1]) - 1]; if (!p) return;
  const prev = st.cheerVoters.get(who); if (prev === p.id) return;
  if (prev) st.cheer.set(prev, Math.max(0, (st.cheer.get(prev) || 1) - 1));
  st.cheerVoters.set(who, p.id); if (st.cheerVoters.size > 20000) st.cheerVoters.delete(st.cheerVoters.keys().next().value);
  st.cheer.set(p.id, (st.cheer.get(p.id) || 0) + 1);
  room.cheerDirty = true;
}
function onPickStart(io, room) {
  const st = room.stream, g = room.game;
  if (!st.on || !st.cheerShield || g.pickIdx === 0) return;
  const top = [...st.cheer].filter(([id]) => !g.P(id)?.out).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] <= 0) return;
  const p = g.P(top[0]); const d = g.discsOf(p.id).find(x => x.shield < 2);
  if (d) { d.shield++; io.to(chan(room.id)).emit("flick:cheerBonus", { uid: p.id, name: p.name, n: top[1] }); g.addLog(`📣 시청자 응원 1등 ${p.name}: 보호막!`, p.id); }
}

// ---------------- 등록 ----------------
export function registerFlick(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks;
  ensureTicker(io);
  // 응원 수가 바뀌면 1초에 한 번만 알림
  setInterval(() => { for (const room of rooms.values()) if (room.cheerDirty) { room.cheerDirty = false; io.to(chan(room.id)).emit("flick:cheer", Object.fromEntries(room.stream.cheer)); } }, 1000).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const fail = (e) => { console.error("[flick]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const r = fn(payload && typeof payload === "object" ? payload : {}, reply); if (r && typeof r.catch === "function") r.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, { allowPlaying = false } = {}) => {
      const room = myRoom();
      if (!room) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (room.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!allowPlaying && room.status === "playing") { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return room;
    };

    socket.on("flick:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("flick", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `fl_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby",
        mode: pl.mode === "classic" ? "classic" : "augment",
        maxPlayers: MAX_PLAYERS.includes(Number(pl.maxPlayers)) ? Number(pl.maxPlayers) : 4,
        opts: cleanOpts(pl.opts, DEFAULT_OPTS), botDiff: DIFFS.includes(pl.botDiff) ? pl.botDiff : "normal",
        isPublic: false, soloAi: pl.soloAi === true,
        players: new Map(), order: [], spect: new Map(), game: null, botSeq: 0, stream: defaultStream(), createdAt: now(),
      };
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, skin: SKINS.includes(pl.skin) ? pl.skin : null });
      room.players.set(me.id, p); room.order.push(me.id);
      attach(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitState(io, room);
    }));
    socket.on("flick:joinRoom", guard(async (pl, cb) => {
      const room = rooms.get(invites.get(String(pl.code || "").trim()));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = room.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, room, seat); cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true }); io.to(chan(room.id)).emit("flick:notice", { k: "back", name: seat.name }); return emitState(io, room); }
      const sp = room.spect.get(me.id);
      if (sp) { attach(io, socket, room, sp); cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectator: true }); return emitState(io, room); }
      if (room.soloAi && !pl.watch) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(room.id) !== room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.soloAi || pl.watch === true || room.status === "playing" || room.order.length >= room.maxPlayers || room.players.get(me.id)?.left) {
        if (room.spect.size >= MAX_SPECT) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0 };
        room.spect.set(me.id, s); attach(io, socket, room, s);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, spectator: true });
        io.to(chan(room.id)).emit("flick:notice", { k: "watch", name });
        return emitState(io, room);
      }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: balanceTeam(room), skin: SKINS.includes(pl.skin) ? pl.skin : null });
      room.players.set(me.id, p); room.order.push(me.id);
      attach(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      io.to(chan(room.id)).emit("flick:notice", { k: "join", name });
      emitState(io, room);
    }));
    socket.on("flick:sit", guard((pl, cb) => {
      const room = myRoom();
      if (!room || !room.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.soloAi) return cb({ ok: false, error: "SOLO_ROOM" });
      if (room.order.length >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = room.spect.get(me.id); room.spect.delete(me.id); room.players.delete(me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id, team: balanceTeam(room) });
      room.players.set(me.id, p); room.order.push(me.id);
      if (!humans(room).some(h => h.id === room.hostUserId)) room.hostUserId = me.id;
      attach(io, socket, room, p); cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:watch", guard((pl, cb) => {
      const room = myRoom();
      if (!room || !room.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = room.players.get(me.id); removeSeat(room, me.id);
      room.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0 }); userRoom.set(me.id, room.id);
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:setOpts", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      if (pl.mode === "classic" || pl.mode === "augment") room.mode = pl.mode;
      if (pl.maxPlayers !== undefined) { const n = Number(pl.maxPlayers); if (!MAX_PLAYERS.includes(n)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < room.order.length) return cb({ ok: false, error: "BELOW_CURRENT" }); room.maxPlayers = n; }
      if (pl.opts) { const prevTeams = room.opts.teams; room.opts = cleanOpts(pl.opts, room.opts); if (room.opts.teams !== prevTeams) room.order.forEach((uid, i) => { room.players.get(uid).team = room.opts.teams ? i % room.opts.teams : 0; }); }
      if (DIFFS.includes(pl.botDiff)) room.botDiff = pl.botDiff;
      if (typeof pl.isPublic === "boolean" && !room.soloAi) room.isPublic = pl.isPublic;
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:setMe", guard((pl, cb) => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!p) return cb({ ok: false, error: "NOT_IN_ROOM" }); if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (SKINS.includes(pl.skin)) p.skin = pl.skin;
      if (pl.team !== undefined && room.opts.teams) { const t = Number(pl.team); if (!(t >= 0 && t < room.opts.teams)) return cb({ ok: false, error: "BAD_VALUE" }); p.team = t; }
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:addBot", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const want = Math.max(1, Math.min(7, Number(pl.count) || 1)); const diff = DIFFS.includes(pl.diff) ? pl.diff : room.botDiff;
      let added = 0;
      while (added < want && room.order.length < room.maxPlayers) {
        room.botSeq++; const uid = `flbot_${room.id}_${room.botSeq}`;
        room.players.set(uid, newSeat(uid, `🤖 알봇${room.botSeq}`, { isBot: true, diff, team: balanceTeam(room) }));
        room.order.push(uid); added++;
      }
      if (!added) return cb({ ok: false, error: "ROOM_FULL" });
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:setBot", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const b = room.players.get(String(pl.uid || "")); if (!b?.isBot) return cb({ ok: false, error: "BAD_TARGET" });
      if (DIFFS.includes(pl.diff)) b.diff = pl.diff;
      if (pl.team !== undefined && room.opts.teams) { const t = Number(pl.team); if (t >= 0 && t < room.opts.teams) b.team = t; }
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:kick", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const uid = String(pl.uid || "");
      if (uid === me.id || (!room.players.has(uid) && !room.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = room.players.get(uid) || room.spect.get(uid);
      if (p.sockId) io.to(p.sockId).emit("flick:kicked", {});
      leave(io, room, uid, "kicked"); cb({ ok: true });
    }));
    socket.on("flick:start", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      const ready = room.order.filter(uid => { const p = room.players.get(uid); return p && !p.left && (p.isBot || p.connected); });
      if (ready.length < 2) return cb({ ok: false, error: "NEED_2" });
      if (room.opts.teams) { const used = new Set(ready.map(uid => room.players.get(uid).team)); if (used.size < 2) return cb({ ok: false, error: "NEED_2_TEAMS" }); }
      cb({ ok: true }); startGame(io, room);
    }));
    socket.on("flick:toLobby", guard((pl, cb) => {
      const room = hostRoom(cb); if (!room) return;
      if (room.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const uid of [...room.order]) { const p = room.players.get(uid); if (!p || p.left) removeSeat(room, uid); }
      room.status = "lobby"; room.game = null; if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      cb({ ok: true }); emitState(io, room);
    }));

    // ---------- 게임 중 ----------
    let winT = 0, winN = 0;
    const tooFast = () => { const t = now(); if (t - winT > 1000) { winT = t; winN = 0; } return ++winN > 10; };
    const act = (fn) => guard((pl, cb) => {
      if (tooFast()) return cb({ ok: false, error: "TOO_FAST" });
      const room = myRoom();
      // 같은 요청 재전송이면 (게임이 그새 끝났어도) 처음 응답을 그대로 돌려줌
      if (room && pl.nonce && room.nonces?.has(me.id + ":" + pl.nonce)) return cb(room.nonces.get(me.id + ":" + pl.nonce));
      if (!room || room.status !== "playing" || !room.game) return cb({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id); if (!p || p.left) return cb({ ok: false, error: "SPECTATOR" });
      if (pl.nonce) { room.nonces = room.nonces || new Map(); const k = me.id + ":" + pl.nonce; if (room.nonces.has(k)) return cb(room.nonces.get(k)); }
      const r = fn(room.game, pl, now()) || { ok: false, error: "INTERNAL" };
      if (pl.nonce) { room.nonces.set(me.id + ":" + pl.nonce, r); if (room.nonces.size > 400) room.nonces.delete(room.nonces.keys().next().value); }
      cb(r); flush(io, room) || (r.ok && emitState(io, room));
    });
    socket.on("flick:shoot", act((g, pl, t) => g.shoot(me.id, { disc: String(pl.disc || ""), angle: pl.angle, power: pl.power, curve: pl.curve, aug: pl.aug && typeof pl.aug === "object" ? { id: String(pl.aug.id || ""), x: pl.aug.x, y: pl.aug.y } : null }, t)));
    socket.on("flick:aug", act((g, pl, t) => g.useAug(me.id, { id: String(pl.id || ""), disc: pl.disc ? String(pl.disc) : null, target: pl.target ? String(pl.target) : null, x: pl.x, y: pl.y }, t)));
    socket.on("flick:pass", act((g, pl, t) => g.pass(me.id, t)));
    socket.on("flick:pick", act((g, pl, t) => pl.refresh ? g.refreshOffer(me.id) : g.pick(me.id, String(pl.id || ""), t)));
    // 조준 미리보기 (관전·다른 사람 화면에 조준선) — 0.1초에 1번, 서버는 그대로 전달만
    let aimAt = 0;
    socket.on("flick:aim", (pl) => {
      const t = now(); if (t - aimAt < 90) return; aimAt = t;
      const room = myRoom(); const g = room?.game; if (!g || g.phase !== "aim" || g.turn?.uid !== me.id) return;
      const a = Number(pl?.angle), p = Number(pl?.power); if (!Number.isFinite(a) || !Number.isFinite(p)) return;
      socket.to(chan(room.id)).emit("flick:aim", { uid: me.id, disc: String(pl.disc || "").slice(0, 20), angle: Math.round(a * 1000) / 1000, power: Math.max(0, Math.min(1, Math.round(p * 100) / 100)) });
    });

    // ---------- 스트리머 모드 (방장) ----------
    socket.on("flick:stream", guard((pl, cb) => {
      const room = hostRoom(cb, { allowPlaying: true }); if (!room) return;
      if (room.soloAi) return cb({ ok: false, error: "SOLO_ROOM" });
      const st = room.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (st.on) logGameStreamer("flick", room);
      if (typeof pl.cheerShield === "boolean") st.cheerShield = pl.cheerShield;
      if (pl.rules) {
        const next = { ...st.rules };
        for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; }
        if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" });
        st.rules = next;
      }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitState(io, room);
    }));
    socket.on("flick:testDonation", guard((pl, cb) => {
      const room = hostRoom(cb, { allowPlaying: true }); if (!room) return;
      if (!room.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (room.lastTest && now() - room.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); room.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, room, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("flick:testCheer", guard((pl, cb) => {
      const room = hostRoom(cb, { allowPlaying: true }); if (!room) return;
      onViewerChat(io, room, { text: "!" + (Number(pl.n) || 1), sender: "test_" + Math.random().toString(36).slice(2, 8) }); cb({ ok: true });
    }));
    socket.on("flick:streamLink", guard(async (pl, cb) => {
      const room = hostRoom(cb, { allowPlaying: true }); if (!room) return;
      if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = room.stream;
      const platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (room.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      room.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitState(io, room);
      const key = "dw_fl_" + room.inviteCode; // 대전쟁과 같은 보호(dw_ 시작 → 공개 주소로 못 끊음·동시 연결 제한)
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: room.inviteCode, contentMode: "flick",
          onDonation: (d) => onPlatformDonation(io, room, platform, d), onChat: (m) => { if (rooms.get(room.id) === room) onViewerChat(io, room, m); },
          onClose: () => { if (rooms.get(room.id) !== room) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitState(io, room); } });
        if (rooms.get(room.id) !== room) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitState(io, room); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("flick:streamUnlink", guard((pl, cb) => { const room = hostRoom(cb, { allowPlaying: true }); if (!room) return; try { HOOKS.unlinkChat?.("dw_fl_" + room.inviteCode); } catch {} room.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitState(io, room); cb({ ok: true }); }));

    socket.on("flick:leaveRoom", guard((pl, cb) => { const room = myRoom(); if (room) leave(io, room, me.id); cb({ ok: true }); }));
    socket.on("flick:sync", guard((pl, cb) => { const room = myRoom(); if (!room) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META }); cb({ ok: true, state: publicRoom(room, me.id), meta: META }); }));
    socket.on("disconnect", () => {
      const room = myRoom(); if (!room) return;
      const rec = room.players.get(me.id) || room.spect.get(me.id);
      if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now(); const at = rec.dcAt;
      if (room.spect.has(me.id)) { setTimeout(() => { const s = room.spect.get(me.id); if (s && !s.connected && s.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS); checkEmpty(io, room); return; }
      io.to(chan(room.id)).emit("flick:notice", { k: "dc", name: rec.name });
      if (room.status === "playing" && room.game) {
        const gp = room.game.P(me.id); if (gp) gp.connected = false;
        if (room.game.turn?.uid === me.id) room.game.turn.botAt = Math.max(room.game.turn.botAt, now() + 4500);
        if (room.hostUserId === me.id) pickNewHost(room);
      } else setTimeout(() => { if (rooms.get(room.id) !== room || room.status === "playing") return; const q = room.players.get(me.id); if (q && !q.connected && q.dcAt === at) leave(io, room, me.id); }, LOBBY_DC_MS);
      checkEmpty(io, room); emitState(io, room);
    });
  });
}

const META = { augs: META_AUGS, rarity: RARITY, kindLabel: KIND_LABEL, synergy: SYNERGY, maxAugs: MAX_AUGS, pickEvery: PICK_EVERY, maps: MAPS, skins: SKINS, colors: COLORS, optChoices: OPT_CHOICES, defaultOpts: DEFAULT_OPTS, streamKinds: STREAM_KINDS, streamLabel: STREAM_LABEL, streamTargets: STREAM_TARGETS };
addPublicRooms("flick", rooms);
export const _flickTest = { rooms, invites, userRoom, receiveDonation, onPlatformDonation, onViewerChat };
