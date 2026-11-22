// =========================
// DUO 증강 물고기 키우기 — 방·소켓 (2026-11-21)  이벤트 prefix 'aq:*'
// · 수조 하나에 사람 1~50 + AI 물고기 (빈자리 채우기), 개인전 / 팀전(2~5팀), 일반/증강, 5분
// · 기존 방 흐름: 게스트 가능, 초대 코드, 방장 권한, 관전, 재접속(같은 아이디), 게임 중 참가, 공개방, 스트리머 후원(치지직·씨미 공식, SOOP 비공식)
// · 서버 권위: 화면은 헤엄 방향·버튼·고른 카드만 보냄 → 위치·먹기·크기·증강·이벤트는 aq-sim.js가 확정
// · 보내기: 20Hz, 사람마다 내 화면 범위만 — 물고기·새우·먹이 변화는 바이너리. 소켓 쓰기가 밀리면 그 틱은 건너뜀
// =========================
import { createFlight } from "./create-flight.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 기록 (11-22)
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicList } from "./public-rooms.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { World } from "./aq-sim.js";
import { MAP, SKIN_IDS, BOT_LV, STREAM_KINDS, STREAM_DEFAULT, STREAM_LABEL, MAX_FISH, rOf, viewOf } from "./aq-data.js";
import { createRank } from "./aq-rank.js";
import { createProgress } from "./aq-progress.js"; // 업적·꾸미기 (2026-11-21)

const rooms = new Map(), invites = new Map(), userRoom = new Map(), soloIpHits = new Map();
const socketIp = (s) => String(s.handshake.headers["cf-connecting-ip"] || s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
export const AQ = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 40, tickMs: 50, botAfter: 4_000, inRate: 45, soloPerSock: 30, soloPerIp: 120, hudEvery: 5, backlog: 40, maxRoom: 50 };
const MODES = ["ffa", "team"];
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const SOOP_BALLOON_KRW = 100;
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {}, RANK = createRank(null), PROG = createProgress(null);
const loadCos = (id) => Promise.race([PROG.load(id).catch(() => null), new Promise(r => setTimeout(r, 1500))]); // 꾸미기 읽기 (DB 느려도 입장은 안 막음)
const chan = (id) => `aq:${id}`;
const now = () => Date.now();
const MAX_NICK = 12;
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim().slice(0, MAX_NICK) || d;
const BAD = ["씨발", "시발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "ㅈㄴ", "개새", "새끼", "느금", "니애미", "애미", "엠창", "섹스", "fuck", "shit", "bitch", "nigger", "sex", "porn"];
export function safeDonor(s) { let t = cleanDonor(s); const low = t.toLowerCase(); for (const w of BAD) { let i = low.indexOf(w); while (i >= 0) { t = t.slice(0, i) + "*".repeat(w.length) + t.slice(i + w.length); i = t.toLowerCase().indexOf(w, i + w.length); } } return t.slice(0, 12); }
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const defaultStream = () => ({ on: false, rules: { ...STREAM_DEFAULT }, targets: { gold: "streamer", grow: "streamer", shark: "leader", hook: "leader", donor: "streamer" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map() });
const humans = (r) => [...r.players.values()].filter(p => !p.left);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
const playing = (r) => r.status === "playing";
const defaultOpts = () => ({ fill: 30, botLv: "normal", teams: 2 });
function cleanOpts(o = {}, base = defaultOpts()) {
  const out = { ...base };
  if ([0, 10, 20, 30, 40, 50].includes(Number(o.fill))) out.fill = Number(o.fill);
  if (own(BOT_LV, o.botLv)) out.botLv = o.botLv;
  if ([2, 3, 4, 5].includes(Number(o.teams))) out.teams = Number(o.teams);
  return out;
}
function pubRoom(r, viewer) {
  const host = viewer === r.hostUserId, st = r.stream;
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator, solo: !!r.solo, mode: r.mode, aug: r.aug, opts: r.opts, maxPlayers: r.maxPlayers, isPublic: !!r.isPublic,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, idx: p.idx, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left, team: p.team ?? 0, skin: p.skin, cos: p.cos || null }; }),
    spectators: r.spect.size, result: r.status === "ended" ? r.result : null,
    stream: st.on ? { on: true, rules: st.rules, targets: st.targets, labels: STREAM_LABEL, link: host ? st.link : { status: st.link.status, platform: st.link.platform }, log: st.log.slice(-10) } : { on: false },
    serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("aq:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("aq:room", pubRoom(r, s.id));
}
// 한 사람이 보는 물고기·중심 (먹혔거나 관전이면 지켜볼 물고기)
function viewOf2(r, rec) {
  const W = r.world; if (!W) return null;
  const mine = r.players.has(rec.id) && !r.players.get(rec.id).left ? W.fishById(rec.id) : null;
  if (mine && mine.state === "alive") return { F: mine, me: mine, watch: null };
  if (mine && mine.state === "dead") return { F: null, me: mine, watch: null, x: mine.x, y: mine.y }; // 먹힌 자리에 그대로 (2.5초 뒤 다시 시작)
  let f = rec.focus != null ? W.F.get(rec.focus) : null;
  if (!f || f.state !== "alive") { f = W.ranking().find(F => F.state === "alive") || null; }
  return { F: f, me: null, watch: f ? f.fid : null };
}
// 물고기 목록 + 사람 물고기 꾸미기(색·칭호)
const rosterOf = (r) => r.world.roster().map(a => { if (a[5] !== 0) return a; const p = [...r.players.values()].find(q => q.idx === a[1] && !q.left); return p?.cos ? [...a, p.cos] : a; });
function sendSnaps(io, r) {
  const W = r.world, tick = r.tickN;
  if (r.rosterVer !== W.rosterVer) { r.rosterVer = W.rosterVer; io.to(chan(r.id)).emit("aq:roster", rosterOf(r)); }
  for (const rec of [...r.players.values(), ...r.spect.values()]) {
    if (!rec.sockId || !rec.connected || rec.left) continue;
    const sock = io.sockets.sockets.get(rec.sockId); if (!sock) continue;
    const wb = sock.conn?.writeBuffer?.length || 0; if (wb > AQ.backlog) { r.skipped = (r.skipped || 0) + 1; rec.known = new Set(); rec.reset = true; continue; } // 밀리면 먹이 목록 처음부터
    const v = viewOf2(r, rec); if (!v) continue;
    const cx = v.F ? v.F.x : v.x ?? MAP.w / 2, cy = v.F ? v.F.y : v.y ?? MAP.h / 2;
    const m = v.F ? v.F.m : 10, z = viewOf(m) * (v.F?.augs?.includes("a12") ? 1.18 : 1) * (v.F && v.F.b?.sonar > W.t ? 1.35 : 1);
    const base = rec.vw || { hw: 800, hh: 450 }, vw = { hw: Math.min(3400, base.hw * z + 160), hh: Math.min(2300, base.hh * z + 160) };
    if (!rec.known) rec.known = new Set();
    const { j, buf } = W.view(v.me && v.me.state === "alive" ? v.me : null, cx, cy, vw, rec.known);
    j.me = v.me ? v.me.fid : 0; j.wt = v.watch; j.z = +z.toFixed(3);
    if (rec.reset) { j.rs = 1; rec.reset = false; }
    if (v.me) j.ack = v.me.in.seq;
    sock.emit("aq:s", j, Buffer.from(buf));
    if (DEV) r.bytes = (r.bytes || 0) + buf.byteLength + JSON.stringify(j).length;
    if (v.me && tick % AQ.hudEvery === (rec.hudPhase || 0)) { const h = W.hud(v.me), s = JSON.stringify(h); if (s !== rec.lastHud) { rec.lastHud = s; sock.emit("aq:hud", h); } }
  }
}
function finishRoom(io, r) {
  if (r.status !== "playing") return;
  const W = r.world, res = W.result;
  for (const row of res.rank) if (row.human) { const p = [...r.players.values()].find(q => q.id === row.id); if (p) row.name = p.name; }
  r.result = { mode: r.mode, aug: r.aug, ...res, teams: r.mode === "team" ? r.opts.teams : 0 };
  r.status = "ended"; r.endedAt = now();
  io.to(chan(r.id)).emit("aq:end", r.result); emitRoom(io, r);
  // 최고 크기 랭킹 (서버 확정값)
  try {
    const entries = res.rank.filter(x => x.human && x.id).map(x => { const p = r.players.get(x.id); return p && !p.left ? { key: p.id, isGuest: p.isGuest, name: p.name, best: x.best, eats: x.eats, mode: r.mode, sockId: p.sockId } : null; }).filter(Boolean);
    if (entries.length) RANK.record(entries).then((m) => { for (const e of entries) { const o = m.get(e.key); const sid = r.players.get(e.key)?.sockId || e.sockId; if (o && sid) io.to(sid).emit("aq:best", o); } }).catch(e => console.error("[aq] rank", e));
  } catch (e) { console.error("[aq] rank", e); }
  recordAch(io, r, r.result);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, AQ.endedTtl);
}
// 업적: 게임 서버가 확정한 값으로만 기록 → 새로 깬 업적은 그 사람에게만 알림
function recordAch(io, r, res) {
  try {
    const humansN = res.rank.filter(x => x.human).length, botsN = res.rank.length - humansN, entries = [];
    for (const row of res.rank) {
      if (!row.human || !row.id) continue; const p = r.players.get(row.id); if (!p || p.left) continue; const st = row.st || {};
      const win = res.teams ? false : row.rank === 1 && (humansN >= 2 || botsN >= 20);
      entries.push({ key: p.id, isGuest: p.isGuest, name: p.name, sockId: p.sockId, run: { win, teamWin: res.teams ? res.winner === row.team : false, eats: row.eats, best: row.best, gold: st.gold, krill: st.krill, bossKill: st.bossKill, bossTop: st.bossTop, armor: st.armor, spine: st.spine, revenge: st.revenge, deaths: row.deaths, humans: st.humans, dodge: st.dodge, leg: row.leg, syn: row.syn } });
    }
    if (!entries.length) return;
    PROG.record(entries).then((m) => { for (const e of entries) { const o = m.get(e.key); if (!o) continue; const sid = r.players.get(e.key)?.sockId || e.sockId; if (sid) io.to(sid).emit("aq:ach", { newly: o.newly, count: o.count, unlocked: o.unlocked, stats: o.stats }); } }).catch((e) => console.error("[aq] ach", e));
  } catch (e) { console.error("[aq] ach", e); }
}
// ---------- 시작 ----------
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return false;
  r.order.forEach((u, i) => { r.players.get(u).idx = i; });
  if (r.mode === "team") r.order.forEach((u) => { const p = r.players.get(u); if (p.team >= r.opts.teams) p.team = 0; });
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const ps = r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, skin: p.skin, idx: p.idx, team: r.mode === "team" ? p.team : 0 }; });
  r.world = new World({ seed, aug: r.aug, mode: r.mode, teams: r.opts.teams, fill: r.opts.fill, botLv: r.opts.botLv, players: ps,
    out: (ev, d, to) => { const p = r.players.get(to); if (p?.sockId) io.to(p.sockId).emit("aq:" + ev, d); },
    onEnd: () => setImmediate(() => finishRoom(io, r)) });
  r.status = "playing"; r.result = null; r.tickN = 0; r.startedAt = now(); r.bytes = 0; r.skipped = 0; r.rosterVer = -1;
  for (const rec of [...r.players.values(), ...r.spect.values()]) { rec.lastHud = ""; rec.known = new Set(); rec.hudPhase = (rec.idx || 0) % AQ.hudEvery; rec.dcBot = false; }
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  r.meta = metaOf(r);
  io.to(chan(r.id)).emit("aq:start", r.meta);
  emitRoom(io, r);
  return true;
}
const metaOf = (r) => ({ map: MAP, rocks: r.world.rocks.map(o => [Math.round(o.x), Math.round(o.y), Math.round(o.r), o.k, o.floor]), weeds: r.world.weeds.map(w => [Math.round(w.x), Math.round(w.y), Math.round(w.r), w.c]), mode: r.mode, aug: r.aug, teams: r.opts.teams, len: r.world.len, botLv: r.opts.botLv, plan: r.world.evPlan.map(e => [e.at, e.k]) });

let ticker = null;
const DEV = process.env.AQ_DEV === "1";
const BOSSES_DEV = ["whale", "octo"];
function ensureTicker(io) {
  if (ticker) return;
  let next = Date.now();
  const loop = () => { next += AQ.tickMs; const late = Date.now() - next; if (late > 250) next = Date.now(); tickAll(io); ticker = setTimeout(loop, Math.max(0, next - Date.now())); ticker.unref?.(); };
  ticker = setTimeout(loop, AQ.tickMs); ticker.unref?.();
}
function tickAll(io) {
  const t = now();
  for (const r of rooms.values()) {
    if (!playing(r) || !r.world) continue;
    try {
      r.tickN++;
      for (const p of r.players.values()) { // 끊긴 사람: 4초 뒤 자동 조종 (돌아오면 해제)
        if (p.left || p.connected || p.dcBot) continue;
        if (t - p.dcAt > AQ.botAfter) { const F = r.world.fishById(p.id); if (F) { F.bot = "normal"; p.dcBot = true; } }
      }
      const t0 = process.hrtime.bigint();
      r.world.step();
      r.simNs = (r.simNs || 0) + Number(process.hrtime.bigint() - t0);
      if (r.status === "playing") sendSnaps(io, r);
    } catch (e) { console.error("[aq] tick", e); }
  }
}
// ---------- 방 관리 ----------
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted"; r.world = null;
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_aq_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("aq:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, AQ.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  if (playing(r)) { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); r.world?.removeHuman(uid); }
  else removeSeat(r, uid);
  io.to(chan(r.id)).emit("aq:notice", { k: "left", name: p.name });
  if (!humans(r).filter(q => !q.left).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
  emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("aq:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; rec.lastHud = ""; rec.known = new Set(); rec.reset = true; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
  const F = r.world?.fishById(rec.id); if (F && rec.dcBot && !rec.left) { F.bot = null; rec.dcBot = false; F.in.mx = 0; F.in.my = 0; }
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, idx: 0, team: o.team ?? 0, skin: SKIN_IDS.includes(o.skin) ? o.skin : "blue", focus: null, inN: 0, inWin: 0, cos: PROG.cosOf(id) });
function smallerTeam(r) { const n = r.opts.teams || 2, c = new Array(n).fill(0); for (const p of r.players.values()) if (!p.left && p.team < n) c[p.team]++; let b = 0; for (let i = 1; i < n; i++) if (c[i] < c[b]) b = i; return b; }
function sendStart(r, socket) { if (r.meta && playing(r)) { socket.emit("aq:start", r.meta); socket.emit("aq:roster", rosterOf(r)); } }
function freeIdx(r) { const used = new Set([...r.players.values()].map(q => q.idx)); for (let i = 0; i < 64; i++) if (!used.has(i)) return i; return 63; }

// ---------- 스트리머 ----------
function pickTarget(r, how) {
  const W = r.world; if (!W) return null;
  const list = W.ranking().filter(F => F.state === "alive"); if (!list.length) return null;
  const hum = list.filter(F => F.human);
  if (how === "streamer") return W.fishById(r.hostUserId)?.state === "alive" ? W.fishById(r.hostUserId) : hum[0] || list[0];
  if (how === "leader") return list[0]; if (how === "last") return (hum.length ? hum : list)[(hum.length ? hum : list).length - 1];
  return list[Math.floor(Math.random() * list.length)];
}
function applyDonation(io, r, rec) {
  const W = r.world; const F = pickTarget(r, r.stream.targets[rec.kind] || "streamer");
  if (!F || !W || W.status !== "play") { rec.status = "skipped"; rec.note = "대상 없음"; return rec; }
  if (rec.kind === "gold") { W.goldWarn.push({ x: F.x, y: F.y, r: 220, n: 20, at: W.t + 1.5 }); W.gev.push({ k: "event", e: "goldd", gw: [[Math.round(F.x), Math.round(F.y), 220]] }); }
  else if (rec.kind === "grow") { F.m *= 1.25; W.ev.push({ k: "grow", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); }
  else if (rec.kind === "shark") { if ([...W.F.values()].filter(Q => Q.npc).length >= 3) { rec.status = "skipped"; rec.note = "상어가 이미 많아요"; return rec; } W.spawnShark(F, 12, rec.donor); }
  else if (rec.kind === "hook") W.hooks.push({ id: 99, at: W.t, target: F, state: 0 });
  else if (rec.kind === "donor") {
    if ([...W.F.values()].filter(Q => Q.donor).length >= 3) { rec.status = "skipped"; rec.note = "후원 물고기가 이미 많아요"; return rec; }
    const D = W.newFish({ fid: W.botSeq++, name: rec.donor, skin: SKIN_IDS[Math.floor(Math.random() * SKIN_IDS.length)], bot: "hunter", donor: rec.donor, m: Math.max(150, F.m * 1.3) });
    const a = Math.random() * Math.PI * 2; D.x = Math.max(80, Math.min(MAP.w - 80, F.x + Math.cos(a) * 700)); D.y = Math.max(200, Math.min(MAP.h - 300, F.y + Math.sin(a) * 400)); D.protect = W.t + 1; D.until = W.t + 30;
    W.F.set(D.fid, D); W.rosterVer++; W.gev.push({ k: "donorfish", f: D.fid, d: rec.donor });
  }
  rec.status = "applied"; rec.target = F.fid; rec.note = F.human ? F.name : "AI";
  return rec;
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream, kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: safeDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off";
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (!playing(r) || !r.world) { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else { st.lastKind = st.lastKind || {}; const last = st.lastKind[kind] || 0; if (now() - last < 2000) { rec.status = "skipped"; rec.note = "너무 잦아요 (2초 뒤 다시)"; } else { st.lastKind[kind] = now(); applyDonation(io, r, rec); } }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("aq:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null }); emitRoom(io, r);
  return rec;
}
function onPlatformDonation(io, r, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || rooms.get(r.id) !== r) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  const t = now(), st = r.stream, base = [platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|");
  if (platform !== "soop") { const prev = st.recent.get(base); if (prev != null && t - prev < 3000) return; st.recent.set(base, t); if (st.recent.size > 300) for (const [k, v] of st.recent) if (t - v > 3000) st.recent.delete(k); }
  receiveDonation(io, r, { platform, donor: data.donatorNickname || "익명 후원자", amount, test: false });
}

// ---------- 등록 ----------
export function registerAquarium(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; ensureTicker(io); RANK = hooks.rank || createRank(supabaseAdmin); PROG = hooks.progress || createProgress(supabaseAdmin);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    let inCount = 0, inWin = 0;
    const guard = (fn, o = {}) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (o.game) { const t = now(); if (t - inWin > 1000) { inWin = t; inCount = 0; } if (++inCount > (o.rate || 12)) return reply({ ok: false, error: "TOO_FAST" }); }
      const fail = (e) => { console.error("[aq]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    socket.on("aq:ping", guard((pl, cb) => cb({ ok: true, s: now(), c: pl.c })));
    let progHits = [];
    const progLimit = () => { const t = now(); progHits = progHits.filter(x => t - x < 60_000); if (progHits.length >= 30) return true; progHits.push(t); return false; };
    socket.on("aq:progress", guard(async (pl, cb) => {
      if (progLimit()) return cb({ ok: false, error: "TOO_FAST" });
      const row = await PROG.load(me.id, { fresh: true });
      if (row?.failed) return cb({ ok: false, error: "BUSY" });
      cb({ ok: true, ready: PROG.isReady(), isGuest: !!me.isGuest, stats: row?.stats || {}, unlocked: row?.unlocked || [], equip: row ? { ...row.equip } : {} });
    }));
    socket.on("aq:equip", guard(async (pl, cb) => {
      if (progLimit()) return cb({ ok: false, error: "TOO_FAST" });
      const res = await PROG.setEquip(me.id, !!me.isGuest, { c: pl.c, t: pl.t });
      if (!res.ok) return cb(res);
      const r = myRoom(), p = r?.players.get(me.id); if (p && !p.left) { p.cos = res.equip.c || res.equip.t ? res.equip : null; emitRoom(io, r); if (r.world) r.world.rosterVer++; }
      cb(res);
    }));
    let rankHits = [];
    socket.on("aq:rank", guard(async (pl, cb) => {
      const t = now(); rankHits = rankHits.filter(x => t - x < 60_000); if (rankHits.length >= 20) return cb({ ok: false, error: "TOO_FAST" }); rankHits.push(t);
      cb(await RANK.top(me.id));
    }));
    let soloHits = [];
    socket.on("aq:solo", guard(async (pl, cb) => {
      const t = now(); soloHits = soloHits.filter(x => t - x < 600_000);
      const ip = socketIp(socket), ipArr = (soloIpHits.get(ip) || []).filter(x => t - x < 600_000);
      if (soloHits.length >= AQ.soloPerSock || ipArr.length >= AQ.soloPerIp) return cb({ ok: false, error: "RATE_LIMITED" });
      soloHits.push(t); ipArr.push(t); soloIpHits.set(ip, ipArr); if (soloIpHits.size > 20000) soloIpHits.clear();
      return create({ ...pl, solo: true, mode: "ffa" }, cb);
    }));
    socket.on("aq:createRoom", guard((pl, cb) => create({ ...pl, solo: false }, cb)));
    const create = async (pl, cb) => {
      { const f = createFlight("aq", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      const mode = MODES.includes(pl.mode) ? pl.mode : "ffa";
      const id = `aq_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const mp = Math.round(Number(pl.maxPlayers));
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", mode, aug: pl.aug !== false, maxPlayers: mp >= 1 && mp <= AQ.maxRoom ? mp : 20, opts: cleanOpts(pl.opts || {}), isPublic: false, solo: !!pl.solo, players: new Map(), order: [], spect: new Map(), stream: defaultStream(), createdAt: now(), world: null, meta: null };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0, skin: pl.skin }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); emitRoom(io, r);
      if (r.solo) startGame(io, r);
    };
    socket.on("aq:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, rejoined: true }); io.to(chan(r.id)).emit("aq:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendStart(r, socket); return; }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const n = humans(r).length;
      // 게임 중에도 빈자리에 바로 참가 (수조에 새 물고기로)
      const midJoin = playing(r) && !r.solo && n < r.maxPlayers && pl.watch !== true && r.world?.status === "play";
      if (!midJoin && (pl.watch === true || playing(r) || r.solo || n >= r.maxPlayers)) {
        if (r.spect.size >= AQ.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, focus: null }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: r.mode === "team" ? smallerTeam(r) : 0, skin: pl.skin }); p.idx = freeIdx(r); r.players.set(me.id, p); r.order.push(me.id);
      if (midJoin) r.world.addHuman({ id: p.id, name, skin: p.skin, team: p.team, idx: p.idx }, true);
      attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, midJoin }); io.to(chan(r.id)).emit("aq:notice", { k: "join", name }); emitRoom(io, r); if (midJoin) sendStart(r, socket);
    }));
    socket.on("aq:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (r.solo) return cb({ ok: false, error: "GAME_STARTED" });
      if (humans(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id);
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id, team: r.mode === "team" ? smallerTeam(r) : 0, skin: pl.skin }); p.idx = freeIdx(r); r.players.set(me.id, p); r.order.push(me.id);
      if (playing(r) && r.world?.status === "play") r.world.addHuman({ id: p.id, name: p.name, skin: p.skin, team: p.team, idx: p.idx }, true);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r); if (playing(r)) sendStart(r, socket);
    }));
    socket.on("aq:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); if (playing(r)) r.world?.removeHuman(me.id);
      removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, focus: null }); userRoom.set(me.id, r.id);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:skin", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (!SKIN_IDS.includes(pl.skin)) return cb({ ok: false, error: "BAD_VALUE" });
      p.skin = pl.skin; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (MODES.includes(pl.mode) && pl.mode !== r.mode) { r.mode = pl.mode; r.order.forEach((u, i) => { r.players.get(u).team = r.mode === "team" ? i % r.opts.teams : 0; }); }
      if (typeof pl.aug === "boolean") r.aug = pl.aug;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= AQ.maxRoom)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < humans(r).length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.opts) { const before = r.opts.teams; r.opts = cleanOpts(pl.opts, r.opts); if (r.mode === "team" && r.opts.teams !== before) r.order.forEach((u, i) => { r.players.get(u).team = i % r.opts.teams; }); }
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:team", guard((pl, cb) => {
      const r = myRoom(); if (!r || playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.mode !== "team") return cb({ ok: false, error: "NO_TEAMS" });
      const uid = pl.uid && r.hostUserId === me.id ? String(pl.uid) : me.id; const p = r.players.get(uid); if (!p) return cb({ ok: false, error: "BAD_TARGET" });
      const t = Number(pl.t); if (!(Number.isInteger(t) && t >= 0 && t < r.opts.teams)) return cb({ ok: false, error: "BAD_VALUE" });
      p.team = t; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:kick", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("aq:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("aq:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      const conn = r.order.filter(u => r.players.get(u)?.connected);
      if (!conn.length) return cb({ ok: false, error: "NEED_1" });
      cb({ ok: true }); startGame(io, r);
    }));
    socket.on("aq:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      r.status = "lobby"; r.result = null; r.world = null; r.solo = false; r.meta = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:again", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.solo || r.hostUserId !== me.id || r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      const p = r.players.get(me.id); if (SKIN_IDS.includes(pl.skin)) p.skin = pl.skin; if (typeof pl.aug === "boolean") r.aug = pl.aug; if (pl.opts) r.opts = cleanOpts(pl.opts, r.opts);
      cb({ ok: true }); startGame(io, r);
    }));
    // ---------- 경기 입력 ----------
    const inWorld = () => { const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !r.world) return null; return { r, W: r.world, p }; };
    socket.on("aq:in", (d) => {
      const x = inWorld(); if (!x || !d || typeof d !== "object") return;
      const p = x.p, t = now(); if (t - p.inWin > 1000) { p.inWin = t; p.inN = 0; } if (++p.inN > AQ.inRate) return;
      x.W.input(me.id, { s: Number(d.s) | 0, mx: Number(d.mx) / 100, my: Number(d.my) / 100, b: Number(d.b) | 0 });
    });
    socket.on("aq:view", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false }); const rec = r.players.get(me.id) || r.spect.get(me.id); const hw = Math.round(Number(pl.hw)), hh = Math.round(Number(pl.hh)); if (rec && hw > 0 && hh > 0) rec.vw = { hw: Math.max(300, Math.min(1200, hw)), hh: Math.max(240, Math.min(900, hh)) }; cb({ ok: true }); }, { game: true, rate: 6 }));
    socket.on("aq:pick", guard((pl, cb) => { const x = inWorld(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" }); cb(x.W.pick(me.id, Number(pl.n) | 0, String(pl.id || "").slice(0, 8))); }, { game: true, rate: 10 }));
    socket.on("aq:focus", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false }); const rec = r.players.get(me.id) || r.spect.get(me.id); const i = Number(pl.fid); if (rec) rec.focus = Number.isInteger(i) && i > 0 && i < 65536 ? i : null; cb({ ok: true }); }, { game: true, rate: 8 }));
    socket.on("aq:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" }); cb({ ok: true, room: pubRoom(r, me.id) }); sendStart(r, socket); const rec = r.players.get(me.id) || r.spect.get(me.id); if (rec) { rec.lastHud = ""; rec.known = new Set(); rec.reset = true; } }));
    socket.on("aq:emote", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p || !r.world) return cb({ ok: false });
      const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t;
      const e = ["👍", "🔥", "😱", "😂", "🙏", "🆘"][Number(pl.e)]; if (!e) return cb({ ok: false });
      const F = r.world.fishById(me.id); if (F) io.to(chan(r.id)).emit("aq:emote", { f: F.fid, e }); cb({ ok: true });
    }));
    // ---------- 스트리머 ----------
    socket.on("aq:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (st.on) logGameStreamer("fish", r);
      if (pl.rules) { const next = { ...st.rules }; for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" }); st.rules = next; }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("aq:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("aq:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_aq_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "fish",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("aq:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_aq_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    // ---------- 시험 전용 (운영에선 꺼짐: AQ_DEV=1 일 때만) ----------
    if (DEV) socket.on("aq:dev", guard((pl, cb) => {
      const r = myRoom(); const W = r?.world; if (!W) return cb({ ok: false });
      const F = W.fishById(me.id);
      if (Number(pl.t) > 0) { W.t = Number(pl.t); }
      if (Number(pl.m) > 0 && F) F.m = Number(pl.m);
      if (pl.aug && F) W.applyAug(F, String(pl.aug));
      if (pl.event) { W.startEvent(String(pl.event)); if (pl.near && F) { if (W.whirl) { W.whirl.x = F.x + 500; W.whirl.y = F.y; } for (const J of W.jellies) { J.x = F.x - 500 + Math.random() * 1000; J.y0 = F.y - 300 + Math.random() * 600; J.vx *= 0.3; } } }
      if (pl.boss) { W.bossDone = true; if (BOSSES_DEV.includes(pl.boss)) W.bossKind = pl.boss; W.spawnBoss(); const B = W.boss; if (B && F) { B.x = F.x + 900; B.y = F.y; B.ang = Math.PI; } }
      if (pl.god && F) F.protect = W.t + 9999;
      if (pl.god === false && F) F.protect = 0;
      if (pl.die && F) { F.lastMass = Math.round(F.m); F.state = "dead"; F.deadT = 2.5; F.killer = 0; }
      if (Number(pl.fill) >= 0 && pl.fill !== undefined) { W.fill = Math.min(MAX_FISH, Number(pl.fill)); W.balanceBots(); }
      if (pl.end) W.finish();
      cb({ ok: true, fish: W.F.size, pel: W.pel.size, t: W.t, simMs: r.tickN ? +(r.simNs / r.tickN / 1e6).toFixed(3) : 0, bytes: r.bytes, skipped: r.skipped });
    }));
    socket.on("aq:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= AQ.lobbyDc - 50) leave(io, r, me.id); }, AQ.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("aq:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= AQ.lobbyDc - 50) leave(io, r, me.id); }, AQ.lobbyDc);
      else if (r.hostUserId === me.id) pickNewHost(r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
addPublicList("fish", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.solo || r.status === "ended") continue; const n = humans(r).length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers, game: r.mode, playing: playing(r) }); } return out; });
export const _aqTest = { rooms, invites, userRoom, AQ };
