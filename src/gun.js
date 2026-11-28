// =========================
// GUN ARENA — 방·소켓 (2026-11-27)  이벤트 prefix 'gn:*'
// · 2D 플랫폼 슈팅 2~8인 실시간 개인전 / 2대2·3대3·4대4 팀전, 빈자리 AI(초급·중급·고급)
// · 서버 권위: 화면은 키 입력(비트)만 보냄 → 움직임·총알·넉백·추락·탄약·상자는 gun/gn-sim.js 가 60Hz로 확정
// · 보내기 20Hz(3틱마다) 스냅샷 + 그 사이 효과 목록. 내 캐릭터 예측용 상태(me)·마지막 처리 입력 번호(ack) 포함
// · 게스트 가능, 초대 코드(비공개 방), 공개방 목록, 관전, 재접속(같은 아이디), 방장 이전, 빠른 재경기
// · DB 안 씀 (기록 저장 없음) — 기존 게임·멀티·채팅과 독립
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js";
import { addPublicList } from "./public-rooms.js";
import { World } from "./gun/gn-sim.js";
import { MAP_IDS, BOT_LV, BOT_NAMES, MAX_PLAYERS, cleanLook, TPS } from "./gun/gn-data.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
export const GN = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 15 * 60_000, maxSpect: 30, botAfter: 3_000, inRate: 80, sendEvery: 3 };
const MODES = ["ffa", "team"];
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const chan = (id) => `gn:${id}`;
const now = () => Date.now();
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim().slice(0, 12) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const humans = (r) => [...r.players.values()].filter(p => !p.left);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
const playing = (r) => r.status === "playing";
const defaultOpts = () => ({ mode: "ffa", map: "rand", lives: 5, items: 2, max: 8, ts: 2, fill: true, botLv: "normal", pct: true });
function cleanOpts(o = {}, base = defaultOpts()) {
  const out = { ...base };
  if (MODES.includes(o.mode)) out.mode = o.mode;
  if (o.map === "rand" || MAP_IDS.includes(o.map)) out.map = o.map;
  const l = Number(o.lives); if (Number.isInteger(l) && l >= 1 && l <= 10) out.lives = l;
  const it = Number(o.items); if ([0, 1, 2, 3].includes(it)) out.items = it;
  const m = Number(o.max); if (Number.isInteger(m) && m >= 2 && m <= MAX_PLAYERS) out.max = m;
  const ts = Number(o.ts); if ([2, 3, 4].includes(ts)) out.ts = ts;
  if (typeof o.fill === "boolean") out.fill = o.fill;
  if (typeof o.pct === "boolean") out.pct = o.pct;
  if (own(BOT_LV, o.botLv)) out.botLv = o.botLv;
  return out;
}
const cap = (r) => (r.opts.mode === "team" ? r.opts.ts * 2 : r.opts.max);
const seatsUsed = (r) => humans(r).length + r.bots.length;
function pubRoom(r, viewer) {
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator, opts: r.opts, cap: cap(r), isPublic: !!r.isPublic,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, isGuest: p.isGuest, connected: p.connected, left: !!p.left, team: p.team, look: p.look }; }),
    bots: r.bots.map(b => ({ bid: b.bid, name: b.name, lv: b.lv, team: b.team, look: b.look })),
    spectators: [...r.spect.values()].map(s => ({ id: s.id, name: s.name, connected: s.connected })),
    result: r.status === "ended" ? r.result : null, serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("gn:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("gn:room", pubRoom(r, s.id));
}
// ---------- 시작 ----------
let botSeq = 1;
function randLook(R = Math.random) { return cleanLook({ s: Math.floor(R() * 5), hs: Math.floor(R() * 6), hc: Math.floor(R() * 8), b: Math.floor(R() * 9), h: Math.floor(R() * 7), e: Math.floor(R() * 3) }); }
function botName(r) { const used = new Set([...humans(r).map(p => p.name), ...r.bots.map(b => b.name)]); const pool = BOT_NAMES.filter(n => !used.has("AI " + n)); return "AI " + (pool[Math.floor(Math.random() * pool.length)] || BOT_NAMES[0]); }
function teamCounts(r) { const c = [0, 0]; for (const p of humans(r)) c[p.team & 1]++; for (const b of r.bots) c[b.team & 1]++; return c; }
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return "NEED_1";
  const team = r.opts.mode === "team";
  // 팀전: 팀 인원 맞추기 (사람이 넘치면 옮기고, 빈자리는 AI)
  if (team) {
    const ts = r.opts.ts;
    for (const u of r.order) { const p = r.players.get(u); const c = teamCounts(r); if (c[p.team & 1] > ts) p.team = (p.team & 1) ^ 1; }
    r.bots = r.bots.filter(b => teamCounts(r)[b.team & 1] <= ts);
    if (r.opts.fill) for (let t = 0; t < 2; t++) while (teamCounts(r)[t] < ts) r.bots.push({ bid: botSeq++, name: botName(r), lv: r.opts.botLv, team: t, look: randLook() });
  }
  while (seatsUsed(r) > cap(r) && r.bots.length) r.bots.pop();
  if (seatsUsed(r) < 2) { if (!r.opts.fill && !team) return "NEED_2"; r.bots.push({ bid: botSeq++, name: botName(r), lv: r.opts.botLv, team: 1, look: randLook() }); }
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const map = r.opts.map === "rand" ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)] : r.opts.map;
  const list = [...r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, team: p.team, look: p.look }; }), ...r.bots.map(b => ({ name: b.name, bot: b.lv, team: b.team, look: b.look }))];
  r.world = new World({ seed, map, mode: r.opts.mode, lives: r.opts.lives, items: r.opts.items, pct: r.opts.pct !== false, players: list });
  r.status = "playing"; r.result = null; r.startedAt = now(); r.sendN = 0; r.evBuf = [];
  for (const p of r.players.values()) { p.dcBot = false; if (!p.connected) p.dcAt = now(); }
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  r.meta = r.world.meta();
  io.to(chan(r.id)).emit("gn:start", r.meta);
  emitRoom(io, r);
  return null;
}
function finishRoom(io, r) {
  if (r.status !== "playing") return;
  const res = r.world.result;
  r.result = { ...res, rows: res.rows.map(x => ({ ...x, look: undefined })) };
  r.status = "ended"; r.endedAt = now();
  io.to(chan(r.id)).emit("gn:end", r.result); emitRoom(io, r);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, GN.endedTtl);
}
// ---------- 60Hz ----------
let ticker = null;
const DEV = process.env.GUN_DEV === "1";
function ensureTicker(io) {
  if (ticker) return;
  const ms = 1000 / TPS; let next = performance.now();
  const loop = () => {
    const t = performance.now(); let n = 0;
    while (next <= t && n < 6) { next += ms; n++; tickAll(io); }
    if (t - next > 250) next = t; // 너무 밀리면 따라잡기 포기
    ticker = setTimeout(loop, Math.max(1, next - performance.now())); ticker.unref?.();
  };
  ticker = setTimeout(loop, ms); ticker.unref?.();
}
function tickAll(io) {
  const t = now();
  for (const r of rooms.values()) {
    if (!playing(r) || !r.world) continue;
    try {
      const W = r.world;
      for (const p of r.players.values()) { // 끊긴 사람: 3초 뒤 AI가 대신 (돌아오면 해제)
        if (p.left || p.connected || p.dcBot) continue;
        if (t - p.dcAt > GN.botAfter) { const P = W.byId.get(p.id); if (P) { P.bot = "normal"; p.dcBot = true; } }
      }
      const t0 = process.hrtime.bigint();
      W.step();
      r.simNs = (r.simNs || 0) + Number(process.hrtime.bigint() - t0); r.ticks = (r.ticks || 0) + 1;
      if (W.ev.length) { r.evBuf.push(...W.ev); W.ev.length = 0; if (r.evBuf.length > 400) r.evBuf.splice(0, r.evBuf.length - 400); }
      if (W.tick % GN.sendEvery === 0 || W.status !== "play") sendSnaps(io, r);
      if (W.status !== "play") finishRoom(io, r);
    } catch (e) { console.error("[gun] tick", e); }
  }
}
function sendSnaps(io, r) {
  const W = r.world, base = W.snap(null);
  base.e = r.evBuf; r.evBuf = [];
  if (W.env.warn || W.env.wind) base.v = [W.env.warn || 0, W.env.dir];
  const evJson = null;
  for (const rec of [...r.players.values(), ...r.spect.values()]) {
    if (!rec.sockId || !rec.connected || rec.left) continue;
    const sock = io.sockets.sockets.get(rec.sockId); if (!sock) continue;
    const wb = sock.conn?.writeBuffer?.length || 0; if (wb > 30) { r.skipped = (r.skipped || 0) + 1; continue; }
    const P = r.players.has(rec.id) && !rec.left ? W.byId.get(rec.id) : null;
    sock.emit("gn:s", P ? { ...base, me: W.meArr(P) } : base);
    if (DEV) r.bytes = (r.bytes || 0) + JSON.stringify(base).length;
  }
  void evJson;
}
// ---------- 방 관리 ----------
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted"; r.world = null;
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  io.to(chan(r.id)).emit("gn:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, GN.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) { r.hostUserId = h.id; return; } const s = [...r.spect.values()].find(x => x.connected) || [...r.spect.values()][0]; if (s) r.hostUserId = s.id; }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  if (playing(r)) { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); r.world?.removeHuman(uid); }
  else removeSeat(r, uid);
  io.to(chan(r.id)).emit("gn:notice", { k: "left", name: p.name });
  if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) { pickNewHost(r); io.to(chan(r.id)).emit("gn:notice", { k: "host", name: r.players.get(r.hostUserId)?.name || r.spect.get(r.hostUserId)?.name || "" }); }
  emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick;
  if (!me.isGuest && supa) { try { const { data } = await supa.from("profiles").select("nickname").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return n;
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("gn:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
  const P = r.world?.byId.get(rec.id);
  if (P && rec.dcBot && !rec.left) { P.bot = null; P.brain = null; rec.dcBot = false; P.inq.length = 0; P.bits = 0; }
}
const newSeat = (id, name, o = {}) => ({ id, name, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, team: o.team ?? 0, look: cleanLook(o.look), inN: 0, inWin: 0 });
function smallerTeam(r) { const c = teamCounts(r); return c[1] < c[0] ? 1 : 0; }
function sendStart(r, socket) { if (r.meta && playing(r)) socket.emit("gn:start", { ...r.meta, tick: r.world.tick }); }

// ---------- 등록 ----------
export function registerGun(io, supabaseAdmin) {
  ensureTicker(io);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    let inCount = 0, inWin = 0;
    const guard = (fn, o = {}) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const t = now(); if (t - inWin > 1000) { inWin = t; inCount = 0; } if (++inCount > (o.rate || 15)) return reply({ ok: false, error: "TOO_FAST" });
      const fail = (e) => { console.error("[gun]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    socket.on("gn:ping", (pl, cb) => { if (typeof cb === "function") cb({ ok: true, s: now(), t: myRoom()?.world?.tick ?? 0 }); });
    socket.on("gn:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("gn", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const name = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `gn_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", opts: cleanOpts(pl.opts || {}), isPublic: pl.isPublic === true, players: new Map(), order: [], spect: new Map(), bots: [], createdAt: now(), world: null, meta: null, evBuf: [] };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { isGuest: me.isGuest, sockId: socket.id, team: 0, look: pl.look }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); emitRoom(io, r);
    }));
    socket.on("gn:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, rejoined: true }); io.to(chan(r.id)).emit("gn:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendStart(r, socket); return; }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const name = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      // 자리가 차면 AI 한 명을 비켜 줌 (대기실에서만)
      if (!playing(r) && pl.watch !== true && seatsUsed(r) >= cap(r) && humans(r).length < cap(r) && r.bots.length) r.bots.pop();
      if (pl.watch === true || playing(r) || seatsUsed(r) >= cap(r)) {
        if (r.spect.size >= GN.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, look: cleanLook(pl.look) }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, name, { isGuest: me.isGuest, sockId: socket.id, team: r.opts.mode === "team" ? smallerTeam(r) : 0, look: pl.look }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id }); io.to(chan(r.id)).emit("gn:notice", { k: "join", name }); emitRoom(io, r);
    }));
    socket.on("gn:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (seatsUsed(r) >= cap(r)) { if (r.bots.length && humans(r).length < cap(r)) r.bots.pop(); else return cb({ ok: false, error: "ROOM_FULL" }); }
      const s = r.spect.get(me.id); r.spect.delete(me.id);
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id, team: r.opts.mode === "team" ? smallerTeam(r) : 0, look: s.look }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, look: p.look }); userRoom.set(me.id, r.id);
      if (r.hostUserId === me.id && humans(r).length) pickNewHost(r);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:look", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id) || r?.spect.get(me.id); if (!p) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      p.look = cleanLook(pl.look); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      const before = r.opts.mode, next = cleanOpts(pl.opts || {}, r.opts);
      const capN = next.mode === "team" ? next.ts * 2 : next.max;
      if (humans(r).length > capN) return cb({ ok: false, error: "BELOW_CURRENT" });
      r.opts = next;
      if (next.mode !== before) { r.order.forEach((u, i) => { r.players.get(u).team = next.mode === "team" ? i % 2 : 0; }); r.bots.forEach((b, i) => { b.team = next.mode === "team" ? (r.order.length + i) % 2 : 1; }); }
      while (seatsUsed(r) > cap(r) && r.bots.length) r.bots.pop();
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:team", guard((pl, cb) => {
      const r = myRoom(); if (!r || playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.opts.mode !== "team") return cb({ ok: false, error: "NO_TEAMS" });
      const t = Number(pl.t); if (t !== 0 && t !== 1) return cb({ ok: false, error: "BAD_VALUE" });
      if (pl.bid != null) { if (r.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" }); const b = r.bots.find(x => x.bid === Number(pl.bid)); if (!b) return cb({ ok: false, error: "BAD_TARGET" }); b.team = t; }
      else { const uid = pl.uid && r.hostUserId === me.id ? String(pl.uid) : me.id; const p = r.players.get(uid); if (!p) return cb({ ok: false, error: "BAD_TARGET" }); p.team = t; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:addBot", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (seatsUsed(r) >= cap(r)) return cb({ ok: false, error: "ROOM_FULL" });
      const lv = own(BOT_LV, pl.lv) ? pl.lv : r.opts.botLv;
      const team = r.opts.mode === "team" ? (pl.team === 0 || pl.team === 1 ? pl.team : smallerTeam(r)) : 1;
      r.bots.push({ bid: botSeq++, name: botName(r), lv, team, look: randLook() }); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:botLv", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; const b = r.bots.find(x => x.bid === Number(pl.bid)); if (!b || !own(BOT_LV, pl.lv)) return cb({ ok: false, error: "BAD_VALUE" });
      b.lv = pl.lv; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:delBot", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; const i = r.bots.findIndex(x => x.bid === Number(pl.bid)); if (i < 0) return cb({ ok: false, error: "BAD_TARGET" });
      r.bots.splice(i, 1); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("gn:kick", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("gn:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("gn:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const err = startGame(io, r); if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
    }));
    // 빠른 재경기: 끝난 방에서 방장이 바로 다시 (같은 사람·AI·설정)
    socket.on("gn:again", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      if (pl.map === "rand" || MAP_IDS.includes(pl.map)) r.opts.map = pl.map;
      const err = startGame(io, r); if (err) return cb({ ok: false, error: err });
      cb({ ok: true });
    }));
    socket.on("gn:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      r.status = "lobby"; r.result = null; r.world = null; r.meta = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    // ---------- 경기 입력: { s: 마지막 입력 번호, b: [최근 비트 몇 개] } ----------
    socket.on("gn:in", (d) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !r.world || !d || typeof d !== "object") return;
      const t = now(); if (t - p.inWin > 1000) { p.inWin = t; p.inN = 0; } if (++p.inN > GN.inRate) return;
      const s = Number(d.s); if (!Number.isSafeInteger(s) || s < 0) return;
      if (!Array.isArray(d.b) || d.b.length < 1 || d.b.length > 8) return;
      const bits = d.b.map(x => Number(x) & 63);
      r.world.input(me.id, s, bits);
    });
    socket.on("gn:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" }); cb({ ok: true, room: pubRoom(r, me.id) }); sendStart(r, socket); }));
    if (DEV) socket.on("gn:dev", guard((pl, cb) => {
      const r = myRoom(); const W = r?.world; if (!W) return cb({ ok: false });
      const P = W.byId.get(me.id);
      if (pl.w != null && P) { P.w = Number(pl.w) | 0; P.ammo = 99; }
      if (pl.end) { for (const q of W.P) if (q !== P) { q.lives = 1; W.ko(q); } }
      if (pl.kill && P) { P.lives = Math.max(1, P.lives); W.ko(P); }
      if (pl.lag) r.lag = Number(pl.lag) | 0;
      cb({ ok: true, tick: W.tick, simMs: r.ticks ? +(r.simNs / r.ticks / 1e6).toFixed(3) : 0, bytes: r.bytes, skipped: r.skipped || 0, me: P ? { x: P.x, y: P.y, lives: P.lives, st: P.st, bot: P.bot, w: P.w } : null, players: W.P.length });
    }));
    socket.on("gn:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= GN.lobbyDc - 50) leave(io, r, me.id); }, GN.lobbyDc); if (r.hostUserId === me.id) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
      io.to(chan(r.id)).emit("gn:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= GN.lobbyDc - 50) leave(io, r, me.id); }, GN.lobbyDc);
      if (r.hostUserId === me.id) { pickNewHost(r); if (r.hostUserId !== me.id) io.to(chan(r.id)).emit("gn:notice", { k: "host", name: r.players.get(r.hostUserId)?.name || r.spect.get(r.hostUserId)?.name || "" }); }
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
addPublicList("gun", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.status === "ended") continue; const n = humans(r).length; if (n >= cap(r)) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: cap(r), game: r.opts.mode, playing: playing(r) }); } return out; });
export const _gunTest = { rooms, invites, userRoom, GN };
