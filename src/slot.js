// =========================
// DUO 증강 슬롯 타워 — 방·소켓 (2026-11-21)  이벤트 prefix 'st:*'
// · 혼자(바로 시작) / 1~50인 같은 씨앗 대결(각자 자기 탑을 오름, 누가 더 높이), 관전, 재접속(같은 아이디면 판 그대로), 게임 중 참가는 관전
// · 서버 권위: 화면은 "돌려/사/팔아/새로고침/다음 층"만 보냄 → 그림·점수·폭탄·상점은 slot-core.js가 정함 (화면은 받은 결과로 릴 애니메이션)
// · 끝나면 최고 기록(slot_best: best = 층×10만 + 번 코인, eats = 도달 층) 서버 값으로만
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js";
import { addPublicList } from "./public-rooms.js";
import { SlotGame } from "./slot-core.js";
import { createRank } from "./slot-rank.js";
import { createProgress } from "./slot-progress.js";
import { createDaily, daySeed, todayKst } from "./slot-daily.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { STREAM_KINDS, STREAM_DEFAULT, STREAM_LABEL, ITEM_IDS, SYNERGIES } from "./slot-data.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map(), soloIpHits = new Map();
export const ST = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 60, maxRoom: 50, boardMs: 1000, spinGap: 320, opRate: 14, times: [0, 300, 600, 900], soloPerSock: 40, soloPerIp: 150 };
const socketIp = (s) => String(s.handshake.headers["cf-connecting-ip"] || s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
const chan = (id) => `st:${id}`;
const now = () => Date.now();
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim().slice(0, 12) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const humans = (r) => [...r.players.values()].filter(p => !p.left);
const playing = (r) => r.status === "playing";
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
let RANK = createRank(null), PROG = createProgress(null), DAILY = createDaily(null), HOOKS = {};
const loadCos = (id) => Promise.race([PROG.load(id).catch(() => null), new Promise(r => setTimeout(r, 1500))]);
const SOOP_BALLOON_KRW = 100, STREAM_TARGETS = ["streamer", "random", "leader", "last"];
const defaultStream = () => ({ on: false, rules: { ...STREAM_DEFAULT }, targets: { spin: "streamer", item: "streamer", luck: "streamer", tax: "leader", bomb: "leader" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map() });
const BAD = ["씨발", "시발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "ㅈㄴ", "개새", "새끼", "느금", "니애미", "애미", "엠창", "섹스", "fuck", "shit", "bitch", "nigger", "sex", "porn"];
function safeDonor(x) { let t = cleanDonor(x); const low = t.toLowerCase(); for (const w of BAD) { let i = low.indexOf(w); while (i >= 0) { t = t.slice(0, i) + "*".repeat(w.length) + t.slice(i + w.length); i = t.toLowerCase().indexOf(w, i + w.length); } } return t.slice(0, 12); }

function pubRoom(r, viewer) {
  return { id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator: !r.players.has(viewer) || !!r.players.get(viewer)?.left, solo: !!r.solo, maxPlayers: r.maxPlayers, timeLimit: r.timeLimit, isPublic: !!r.isPublic,
    daily: r.daily || null,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left, cos: p.cos || null }; }),
    stream: r.stream?.on ? { on: true, rules: r.stream.rules, targets: r.stream.targets, labels: STREAM_LABEL, link: viewer === r.hostUserId ? r.stream.link : { status: r.stream.link.status, platform: r.stream.link.platform }, log: r.stream.log.slice(-10) } : { on: false },
    spectators: r.spect.size, startedAt: r.startedAt || 0, endsAt: r.endsAt || 0, result: r.status === "ended" ? r.result : null, serverNow: now() };
}
function emitRoom(io, r) { for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("st:room", pubRoom(r, p.id)); for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("st:room", pubRoom(r, s.id)); }
// 순위표: 높이 → 같으면 번 코인
const boardOf = (r) => r.order.map(u => r.players.get(u)).filter(p => p && p.game).map(p => { const g = p.game; return { id: p.id, name: p.name, avatar: p.avatar, cos: p.cos || null, floor: g.floor, coins: g.coins, won: g.st.won, best: g.st.best, phase: g.phase, augs: g.augs.length, left: !!p.left, dc: !p.connected }; })
  .sort((a, b) => (b.phase === "over" ? b.floor - 1 : b.floor) - (a.phase === "over" ? a.floor - 1 : a.floor) || b.floor - a.floor || b.won - a.won);
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return false;
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const sd = r.daily ? daySeed(r.daily) : seed;
  for (const u of r.order) { const p = r.players.get(u); p.game = new SlotGame(sd, { daily: !!r.daily }); p.lastSpin = 0; p.done = false; }
  r.status = "playing"; r.seed = seed; r.result = null; r.startedAt = now(); r.endsAt = r.timeLimit ? r.startedAt + r.timeLimit * 1000 : 0; r.feed = [];
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  if (r.limitTimer) clearTimeout(r.limitTimer); if (r.endsAt) r.limitTimer = setTimeout(() => finishRoom(io, r, "time"), r.timeLimit * 1000);
  io.to(chan(r.id)).emit("st:start", { seed: r.solo ? 0 : 1, endsAt: r.endsAt, serverNow: now() });
  for (const p of r.players.values()) if (p.sockId) io.to(p.sockId).emit("st:state", p.game.pub());
  emitRoom(io, r); sendBoard(io, r, true);
  return true;
}
function sendBoard(io, r, force) { const t = now(); if (!force && t - (r.boardAt || 0) < ST.boardMs) { r.boardDirty = true; return; } r.boardAt = t; r.boardDirty = false; io.to(chan(r.id)).emit("st:board", boardOf(r)); }
function finishRoom(io, r, why) {
  if (r.status !== "playing") return;
  r.status = "ended"; r.endedAt = now(); if (r.limitTimer) { clearTimeout(r.limitTimer); r.limitTimer = null; }
  const board = boardOf(r); r.result = { why, board: board.map((b, i) => ({ ...b, rank: i + 1 })), t: Math.round((now() - r.startedAt) / 1000) };
  io.to(chan(r.id)).emit("st:end", r.result); emitRoom(io, r);
  // 랭킹 (서버 값)
  try {
    const entries = r.order.map(u => r.players.get(u)).filter(p => p && p.game && !p.left).map(p => ({ key: p.id, isGuest: p.isGuest, name: p.name, best: p.game.rankScore(), eats: p.game.floor, mode: r.solo ? "solo" : "race", sockId: p.sockId }));
    if (entries.length) RANK.record(entries).then((m) => { for (const e of entries) { const o = m.get(e.key); const sid = r.players.get(e.key)?.sockId || e.sockId; if (o && sid) io.to(sid).emit("st:best", o); } }).catch(e => console.error("[slot] rank", e));
  } catch (e) { console.error("[slot] rank", e); }
  if (r.daily) for (const p of r.players.values()) if (p.game && !p.left) DAILY.record({ key: p.id, isGuest: p.isGuest, name: p.name, best: p.game.rankScore(), floor: p.game.floor }).then((o) => { if (o && p.sockId) io.to(p.sockId).emit("st:dailyBest", o); }).catch(() => {});
  recordAch(io, r);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, ST.endedTtl);
}
function recordAch(io, r) {
  try {
    const ps = r.order.map(u => r.players.get(u)).filter(p => p && p.game && !p.left), multi = ps.length >= 2, board = boardOf(r), entries = [];
    for (const p of ps) { const g = p.game; entries.push({ key: p.id, isGuest: p.isGuest, name: p.name, sockId: p.sockId, run: { floor: g.floor, best: g.st.best, jackpots: g.st.jackpots, booms: g.st.booms, curses: g.st.curses, deals: g.st.deals, items: g.st.items, syn: g.syns().length, lv2: g.st.lv2, vault: g.st.vaultMax, luck: g.st.luckMax, allin: g.st.allin, win: multi && board[0]?.id === p.id, daily: !!r.daily } }); }
    if (!entries.length) return;
    PROG.record(entries).then((m) => { for (const e of entries) { const o = m.get(e.key); if (!o) continue; const sid = r.players.get(e.key)?.sockId || e.sockId; if (sid) io.to(sid).emit("st:ach", { newly: o.newly, count: o.count, unlocked: o.unlocked, stats: o.stats }); } }).catch((e) => console.error("[slot] ach", e));
  } catch (e) { console.error("[slot] ach", e); }
}
function checkAllDone(io, r) { if (!playing(r)) return; const ps = humans(r).filter(p => p.game); if (ps.length && ps.every(p => p.game.phase === "over")) finishRoom(io, r, "all"); }
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer); if (r.limitTimer) clearTimeout(r.limitTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted";
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_st_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("st:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, ST.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  if (playing(r)) { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); } else removeSeat(r, uid);
  io.to(chan(r.id)).emit("st:notice", { k: "left", name: p.name });
  if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
  if (playing(r)) { checkAllDone(io, r); sendBoard(io, r, true); }
  emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest && supa) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("st:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, game: null, opN: 0, opWin: 0, cos: PROG.cosOf(id) });
function sendStart(r, socket, uid) { if (!playing(r)) return; socket.emit("st:start", { seed: 1, endsAt: r.endsAt, serverNow: now() }); const p = r.players.get(uid); if (p?.game) socket.emit("st:state", p.game.pub()); socket.emit("st:board", boardOf(r)); }
// 큰 사건은 방 모두에게 (대박·잭팟·폭발·탈락·보스)
function feed(io, r, p, k, v, grid) { const e = { k, name: p.name, id: p.id, v, at: now(), grid: grid || undefined }; r.feed.push(e); if (r.feed.length > 30) r.feed.shift(); if (!r.solo) io.to(chan(r.id)).emit("st:feed", e); }

// ---------- 스트리머 후원 ----------
function pickTarget(r, how) {
  const ps = r.order.map(u => r.players.get(u)).filter(p => p && p.game && !p.left && p.game.phase !== "over"); if (!ps.length) return null;
  const b = boardOf(r).filter(x => ps.some(p => p.id === x.id));
  if (how === "streamer") return r.players.get(r.hostUserId)?.game && r.players.get(r.hostUserId).game.phase !== "over" ? r.players.get(r.hostUserId) : ps[0];
  if (how === "leader") return r.players.get(b[0]?.id) || ps[0]; if (how === "last") return r.players.get(b[b.length - 1]?.id) || ps[0];
  return ps[Math.floor(Math.random() * ps.length)];
}
function applyDonation(io, r, rec) {
  const p = pickTarget(r, r.stream.targets[rec.kind] || "streamer"); if (!p) { rec.status = "skipped"; rec.note = "대상 없음"; return rec; }
  const g = p.game;
  if (rec.kind === "spin") { if (g.phase === "spin") { g.spinsLeft++; g.spinsMax++; } else g.nextMods.spin = (g.nextMods.spin || 0) + 1; }
  else if (rec.kind === "item") { if (!g.addItem(ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)])) { rec.status = "skipped"; rec.note = "가방이 꽉 찼어요"; return rec; } }
  else if (rec.kind === "luck") g.floorLuck += 5;
  else if (rec.kind === "tax") { if (g.phase === "spin") { g.mods.toll = (g.mods.toll || 1) * 1.2; g.toll = g.tollNow(); } else g.nextMods.toll = (g.nextMods.toll || 1) * 1.2; }
  else if (rec.kind === "bomb") g.fuse = Math.min(g.fuseMax() - 1, g.fuse + 2);
  rec.status = "applied"; rec.target = p.id; rec.note = p.name;
  if (p.sockId) io.to(p.sockId).emit("st:state", g.pub());
  return rec;
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream, kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: safeDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off"; else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; } else if (!playing(r)) { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else { st.lastKind = st.lastKind || {}; if (now() - (st.lastKind[kind] || 0) < 2000) { rec.status = "skipped"; rec.note = "너무 잦아요 (2초 뒤 다시)"; } else { st.lastKind[kind] = now(); applyDonation(io, r, rec); } }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("st:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null }); emitRoom(io, r); return rec;
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
export function registerSlot(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; PROG = hooks.progress || createProgress(supabaseAdmin); DAILY = hooks.daily || createDaily(supabaseAdmin);
  RANK = hooks.rank || createRank(supabaseAdmin);
  setInterval(() => { for (const r of rooms.values()) if (r.boardDirty && playing(r)) sendBoard(io, r, true); }, ST.boardMs).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[slot]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); } };
    const hostRoom = (cb, o = {}) => { const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; } if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; } if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; } return r; };
    socket.on("st:ping", guard((pl, cb) => cb({ ok: true, s: now() })));
    let rankHits = [];
    socket.on("st:rank", guard(async (pl, cb) => { const t = now(); rankHits = rankHits.filter(x => t - x < 60_000); if (rankHits.length >= 20) return cb({ ok: false, error: "TOO_FAST" }); rankHits.push(t); cb(await RANK.top(me.id)); }));
    let soloHits = [];
    socket.on("st:solo", guard(async (pl, cb) => {
      const t = now(); soloHits = soloHits.filter(x => t - x < 600_000); const ip = socketIp(socket), ipArr = (soloIpHits.get(ip) || []).filter(x => t - x < 600_000);
      if (soloHits.length >= ST.soloPerSock || ipArr.length >= ST.soloPerIp) return cb({ ok: false, error: "RATE_LIMITED" });
      soloHits.push(t); ipArr.push(t); soloIpHits.set(ip, ipArr); if (soloIpHits.size > 20000) soloIpHits.clear();
      return create({ ...pl, solo: true }, cb);
    }));
    socket.on("st:createRoom", guard((pl, cb) => create({ ...pl, solo: false }, cb)));
    socket.on("st:daily", guard(async (pl, cb) => { const t = now(); soloHits = soloHits.filter(x => t - x < 600_000); if (soloHits.length >= ST.soloPerSock) return cb({ ok: false, error: "RATE_LIMITED" }); soloHits.push(t); return create({ ...pl, solo: true, daily: todayKst() }, cb); }));
    socket.on("st:dailyRank", guard(async (pl, cb) => { const t = now(); rankHits = rankHits.filter(x => t - x < 60_000); if (rankHits.length >= 20) return cb({ ok: false, error: "TOO_FAST" }); rankHits.push(t); cb(await DAILY.top(me.id)); }));
    let progHits = []; const progLimit = () => { const t = now(); progHits = progHits.filter(x => t - x < 60_000); if (progHits.length >= 30) return true; progHits.push(t); return false; };
    socket.on("st:progress", guard(async (pl, cb) => { if (progLimit()) return cb({ ok: false, error: "TOO_FAST" }); const row = await PROG.load(me.id, { fresh: true }); if (row?.failed) return cb({ ok: false, error: "BUSY" }); cb({ ok: true, ready: PROG.isReady(), isGuest: !!me.isGuest, stats: row?.stats || {}, unlocked: row?.unlocked || [], equip: row ? { ...row.equip } : {} }); }));
    socket.on("st:equip", guard(async (pl, cb) => { if (progLimit()) return cb({ ok: false, error: "TOO_FAST" }); const res = await PROG.setEquip(me.id, !!me.isGuest, { c: pl.c, t: pl.t }); if (!res.ok) return cb(res); const r = myRoom(), p = r?.players.get(me.id); if (p && !p.left) { p.cos = res.equip.c || res.equip.t ? res.equip : null; emitRoom(io, r); } cb(res); }));
    const create = async (pl, cb) => {
      { const f = createFlight("st", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      const id = `st_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, mp = Math.round(Number(pl.maxPlayers)), tl = Number(pl.timeLimit);
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", maxPlayers: mp >= 1 && mp <= ST.maxRoom ? mp : 20, timeLimit: ST.times.includes(tl) ? tl : 600, isPublic: false, solo: !!pl.solo, daily: pl.daily || null, players: new Map(), order: [], spect: new Map(), createdAt: now(), feed: [], stream: defaultStream() };
      if (r.solo) r.timeLimit = 0;
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); emitRoom(io, r);
      if (r.solo) startGame(io, r);
    };
    socket.on("st:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, rejoined: true }); io.to(chan(r.id)).emit("st:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendStart(r, socket, me.id); return; }
      const sp = r.spect.get(me.id); if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket, me.id); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (pl.watch === true || playing(r) || r.solo || humans(r).length >= r.maxPlayers) {
        if (r.spect.size >= ST.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0 }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket, me.id); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); io.to(chan(r.id)).emit("st:notice", { k: "join", name }); emitRoom(io, r);
    }));
    socket.on("st:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (playing(r) || r.solo) return cb({ ok: false, error: "GAME_STARTED" }); if (humans(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("st:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" }); if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0 }); userRoom.set(me.id, r.id); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("st:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= ST.maxRoom)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < humans(r).length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.timeLimit !== undefined) { const t = Number(pl.timeLimit); if (!ST.times.includes(t)) return cb({ ok: false, error: "BAD_VALUE" }); r.timeLimit = t; }
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("st:kick", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; const uid = String(pl.uid || "");
      if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("st:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("st:start", guard((pl, cb) => { const r = hostRoom(cb); if (!r) return; if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" }); for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); } if (!r.order.some(u => r.players.get(u)?.connected)) return cb({ ok: false, error: "NEED_1" }); cb({ ok: true }); startGame(io, r); }));
    socket.on("st:again", guard((pl, cb) => { const r = myRoom(); if (!r || !r.solo || r.hostUserId !== me.id || r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" }); cb({ ok: true }); startGame(io, r); }));
    socket.on("st:toLobby", guard((pl, cb) => { const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" }); for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); else p.game = null; } r.status = "lobby"; r.result = null; r.solo = false; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; } cb({ ok: true }); emitRoom(io, r); }));
    // ---------- 판 조작 ----------
    const myGame = () => { const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !p.game) return null; return { r, p, g: p.game }; };
    const op = (name, fn) => socket.on("st:" + name, guard((pl, cb) => {
      const x = myGame(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" });
      const t = now(); if (t - x.p.opWin > 1000) { x.p.opWin = t; x.p.opN = 0; } if (++x.p.opN > ST.opRate) return cb({ ok: false, error: "TOO_FAST" });
      const res = fn(x, pl); if (!res.ok) return cb(res);
      cb({ ...res, state: x.g.pub() });
      if (x.g.phase === "over" && !x.p.done) { x.p.done = true; socket.emit("st:summary", x.g.summary()); feed(io, x.r, x.p, "out", x.g.floor); if (x.r.solo) finishRoom(io, x.r, "over"); else checkAllDone(io, x.r); }
      sendBoard(io, x.r);
    }));
    op("spin", ({ r, p, g }) => {
      const t = now(); if (t - p.lastSpin < ST.spinGap) return { ok: false, error: "TOO_FAST" }; p.lastSpin = t;
      const res = g.spin(); if (!res.ok) return res;
      if (res.fx.includes("jackpot") || res.fx.includes("fullscreen")) feed(io, r, p, "jackpot", res.gain, res.grid); else if (res.gain >= 300 && res.gain >= g.toll) feed(io, r, p, "big", res.gain);
      if (res.boom && res.boom.lost) feed(io, r, p, "boom", res.boom.lost);
      if (res.end?.ok && g.boss) feed(io, r, p, "boss", g.floor);
      return res;
    });
    op("buy", ({ g }, pl) => g.buy(Number(pl.i)));
    op("sell", ({ g }, pl) => g.sell(String(pl.id || "").slice(0, 4)));
    op("reroll", ({ g }) => g.reroll());
    op("free", ({ g }, pl) => g.pickFree(String(pl.id || "").slice(0, 4)));
    op("skipFree", ({ g }) => g.phase === "shop" ? g.skipFree() : { ok: false, error: "NOT_SHOP" });
    op("next", ({ g }) => g.next());
    op("deal", ({ g }, pl) => g.deal(String(pl.id || "").slice(0, 4)));
    op("deposit", ({ g }, pl) => g.deposit(pl.n));
    op("withdraw", ({ g }, pl) => g.withdraw(pl.n));
    op("use", ({ r, p, g }, pl) => { const res = g.useItem(Number(pl.i)); if (res.ok && res.id === "i9" && res.gain >= Math.max(300, g.toll)) feed(io, r, p, "big", res.gain); return res; });
    // ---------- 스트리머 (방장) ----------
    socket.on("st:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (r.solo) return cb({ ok: false, error: "BAD_VALUE" }); const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (pl.rules) { const next = { ...st.rules }; for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" }); st.rules = next; }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("st:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("st:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_st_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "slot",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("st:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_st_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    socket.on("st:peek", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false }); const p = r.players.get(String(pl.id || "")); if (!p?.game) return cb({ ok: false, error: "BAD_TARGET" }); const g = p.game; cb({ ok: true, name: p.name, state: { floor: g.floor, coins: g.coins, augs: g.augs, grid: g.grid, phase: g.phase, toll: g.toll, spinsLeft: g.spinsLeft, fuse: g.fuse, fuseMax: g.fuseMax(), event: g.event, last: g.last ? { gain: g.last.gain, wins: g.last.wins } : null } }); }));
    socket.on("st:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" }); cb({ ok: true, room: pubRoom(r, me.id) }); sendStart(r, socket, me.id); }));
    socket.on("st:emote", guard((pl, cb) => { const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false }); const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t; const e = ["👍", "🔥", "😱", "😂", "🙏", "💸"][Number(pl.e)]; if (!e) return cb({ ok: false }); io.to(chan(r.id)).emit("st:emote", { id: me.id, name: p.name, e }); cb({ ok: true }); }));
    socket.on("st:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= ST.lobbyDc - 50) leave(io, r, me.id); }, ST.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("st:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= ST.lobbyDc - 50) leave(io, r, me.id); }, ST.lobbyDc);
      else if (r.hostUserId === me.id) pickNewHost(r);
      checkEmpty(io, r); emitRoom(io, r); if (playing(r)) sendBoard(io, r);
    });
  });
}
addPublicList("slot", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.solo || r.status !== "lobby") continue; const n = humans(r).length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers, game: "race", playing: false }); } return out; });
export const _slotTest = { rooms, invites, userRoom, ST };
