// =========================
// 플듀 끝말잇기 — 방·소켓 (2026-11-21)  이벤트 prefix 'wd:*'
// · 혼자(나 + AI 1~3) / 2~8인 멀티(빈자리 AI로 채우기 가능), 관전, 재접속(같은 아이디면 자리 그대로)
// · 서버 권위: 화면은 단어(글자)만 보냄 → 사전·두음법칙·중복·시간은 wd-core.js가 판정
// · 스트리머: 방장이 켜면 "📺 시청자" 자리가 생김 → 그 차례엔 방송 채팅으로 먼저 맞는 단어를 친 시청자가 냄
// · 끝나면 최고 점수(wd_best) 서버 값으로만
// · 2026-11-22 2차: 오늘의 도전(혼자 잇기, wd_daily) · 업적·꾸미기(wd_progress, 기차 색·칭호) · 단어 뜻(우리말샘) · 판 끝 요약
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js";
import { addPublicList } from "./public-rooms.js";
import { getDict } from "./wd-dict.js";
import { WordGame, aiPick, aiDelay, cleanWord, WD, isAiLevel, summary } from "./wd-core.js";
import { createRank } from "./wd-rank.js";
import { createProgress } from "./wd-progress.js";
import { createDaily, todayKst, daySeed, seededRng, dailyRules } from "./wd-daily.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map(), soloIpHits = new Map();
export const WDS = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 60, maxRoom: 8, tickMs: 100, sayRate: 8, typeGap: 70, soloPerSock: 60, soloPerIp: 200, viewerGap: 700 };
const socketIp = (s) => String(s.handshake.headers["cf-connecting-ip"] || s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
const chan = (id) => `wd:${id}`;
const now = () => Date.now();
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim().slice(0, 12) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const AI_NAMES = ["사전봇", "글자요정", "말꼬리", "단어도사", "끝판왕", "국어쌤", "받아쓰기", "말잇기로봇"];
const VIEWER_ID = "viewer";
const humans = (r) => [...r.players.values()].filter(p => !p.left && !p.ai && !p.viewer);
const seatsOf = (r) => r.order.map(u => r.players.get(u)).filter(p => p && !p.left);
const playing = (r) => r.status === "playing";
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
let RANK = createRank(null), PROG = createProgress(null), DAILY = createDaily(null), HOOKS = {}, DICT = null;
const loadCos = (id) => Promise.race([PROG.load(id).catch(() => null), new Promise(r => setTimeout(r, 1500))]);
const defOf = (w) => { try { return dict().def(w) || ""; } catch { return ""; } };
const dict = () => DICT || (DICT = getDict());

function pubRoom(r, viewer) {
  return { id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator: !r.players.has(viewer) || !!r.players.get(viewer)?.left, solo: !!r.solo, daily: r.daily ? { day: r.daily, rules: dailyRules(r.daily) } : null, maxPlayers: r.maxPlayers, isPublic: !!r.isPublic, opts: r.opts,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.ai || p.viewer ? true : p.connected, left: !!p.left, ai: p.ai || null, viewer: !!p.viewer, cos: p.cos || null }; }),
    stream: { on: !!r.stream.on, link: viewer === r.hostUserId ? r.stream.link : { status: r.stream.link.status, platform: r.stream.link.platform } },
    dict: { source: dict().source, size: dict().size, defs: !!dict().hasDefs }, spectators: r.spect.size, result: r.status === "ended" ? r.result : null, serverNow: now() };
}
function emitRoom(io, r) { for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("wd:room", pubRoom(r, p.id)); for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("wd:room", pubRoom(r, s.id)); }
const sendState = (io, r) => { if (r.game) io.to(chan(r.id)).emit("wd:state", { ...r.game.pub(now()), serverNow: now() }); };

function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || (!p.ai && !p.viewer && !p.connected)) removeSeat(r, u); }
  const seats = seatsOf(r); if (seats.length < 1 || (!r.solo && seats.length < 2)) return false;
  if (r.daily) { r.daily = todayKst(); r.opts = { hearts: 3, ...dailyRules(r.daily) }; } // 날짜가 바뀌었으면 새 도전
  r.game = new WordGame(dict(), seats.map(p => ({ id: p.id, name: p.name, ai: p.ai, viewer: p.viewer })), r.opts, r.daily ? seededRng(daySeed(r.daily)) : Math.random);
  r.status = "playing"; r.result = null; r.startedAt = now(); r.viewerTries = new Map();
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  r.game.beginTurn(now() + 2500); // 3초 준비
  io.to(chan(r.id)).emit("wd:start", { serverNow: now(), at: now() + 2500 });
  emitRoom(io, r); sendState(io, r); scheduleAi(io, r);
  return true;
}
/** 차례가 바뀔 때마다: AI 차례면 생각 시간 뒤 단어 */
function scheduleAi(io, r) {
  if (r.aiTimer) { clearTimeout(r.aiTimer); r.aiTimer = null; }
  const g = r.game; if (!g || g.phase !== "play") return; const p = g.curP(); if (!p?.ai) return;
  const turnId = g.turnAt, wait = Math.max(0, g.turnAt - now()) + aiDelay(p.ai, g.turnMs());
  r.aiTimer = setTimeout(() => {
    r.aiTimer = null; if (rooms.get(r.id) !== r || r.game !== g || g.phase !== "play" || g.turnAt !== turnId || g.curP().id !== p.id) return;
    const w = aiPick(g, p.ai); if (!w) return; // 못 찾으면 시간 초과로
    // 치는 모습 (글자 하나씩)
    let k = 0; const typeT = setInterval(() => { k++; io.to(chan(r.id)).emit("wd:typing", { id: p.id, t: w.slice(0, k) }); if (k >= w.length) clearInterval(typeT); }, 90);
    setTimeout(() => { clearInterval(typeT); if (rooms.get(r.id) === r && r.game === g && g.turnAt === turnId) say(io, r, p.id, w); }, w.length * 90 + 150);
  }, wait);
}
function say(io, r, pid, word, by) {
  const g = r.game, t = now(); if (t < g.turnAt) return { ok: false, error: "NOT_YET" };
  const res = g.submit(pid, word, t, by);
  if (!res.ok) { if (res.error !== "NOT_YOUR_TURN" && res.error !== "NOT_PLAYING") io.to(chan(r.id)).emit("wd:fail", { id: pid, w: cleanWord(word).slice(0, 15), error: res.error, by: by || null }); return res; }
  const d = defOf(res.e.w);
  io.to(chan(r.id)).emit("wd:said", d ? { ...res.e, d } : res.e); sendState(io, r); scheduleAi(io, r);
  return res;
}
function onMiss(io, r, e) {
  if (!e) return; io.to(chan(r.id)).emit("wd:miss", e);
  if (e.end) return finishRoom(io, r, "over");
  sendState(io, r); scheduleAi(io, r);
}
function finishRoom(io, r, why) {
  if (r.status !== "playing") return;
  const g = r.game; if (g.phase !== "over") g.end(now());
  r.status = "ended"; r.endedAt = now(); if (r.aiTimer) { clearTimeout(r.aiTimer); r.aiTimer = null; }
  const ranking = g.ranking();
  const defs = []; if (dict().hasDefs) { const seen = new Set(); for (let i = g.hist.length - 1; i >= 0 && defs.length < 40; i--) { const w = g.hist[i].w; if (seen.has(w)) continue; seen.add(w); const d = defOf(w); if (d) defs.push({ w, d }); } defs.reverse(); }
  r.result = { why, ranking, maxChain: g.maxChain, words: g.hist.length, t: Math.round((now() - r.startedAt) / 1000), winner: g.winner, hist: g.hist.slice(-60), sum: summary(g), defs, daily: r.daily || null };
  io.to(chan(r.id)).emit("wd:end", r.result); emitRoom(io, r);
  try {
    const ai = g.ps.some(p => p.ai);
    const entries = g.ps.filter(p => !p.ai && !p.viewer).map(p => ({ p, seat: r.players.get(p.id) })).filter(x => x.seat && !x.seat.left)
      .map(({ p, seat }) => ({ key: p.id, isGuest: seat.isGuest, name: seat.name, best: p.score, eats: p.words, mode: r.solo ? "solo" : ai ? "mixed" : "multi", sockId: seat.sockId }));
    const hard = g.ps.some(p => p.ai === "hard"), multi = g.ps.length >= 2;
    const runs = g.ps.filter(p => !p.ai && !p.viewer).map(p => ({ p, seat: r.players.get(p.id) })).filter(x => x.seat && !x.seat.left)
      .map(({ p, seat }) => ({ key: p.id, isGuest: seat.isGuest, name: seat.name, sockId: seat.sockId, run: { words: p.words, kills: p.kills, win: multi && ranking[0]?.id === p.id, hard, fast: p.fast, dueum: p.dueum, long6: p.long6, miss: p.miss, len: p.longest.length, chain: p.bestChain, score: p.score, daily: !!r.daily } }));
    if (runs.length) PROG.record(runs).then((m) => { for (const e of runs) { const o = m.get(e.key); if (!o) continue; const sid = r.players.get(e.key)?.sockId || e.sockId; if (sid) io.to(sid).emit("wd:ach", { newly: o.newly, count: o.count, unlocked: o.unlocked, stats: o.stats }); } }).catch((e) => console.error("[wd] ach", e));
    if (r.daily) { for (const e of entries) DAILY.record({ key: e.key, isGuest: e.isGuest, name: e.name, best: e.best, words: e.eats, day: r.daily }).then((o) => { const sid = r.players.get(e.key)?.sockId || e.sockId; if (o && sid) io.to(sid).emit("wd:dailyBest", o); }).catch(() => {}); }
    else if (entries.length) RANK.record(entries).then((m) => { for (const e of entries) { const o = m.get(e.key); const sid = r.players.get(e.key)?.sockId || e.sockId; if (o && sid) io.to(sid).emit("wd:best", o); } }).catch(e => console.error("[wd] rank", e));
  } catch (e) { console.error("[wd] rank", e); }
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, WDS.endedTtl);
}
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer); if (r.aiTimer) clearTimeout(r.aiTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted";
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_wd_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("wd:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, WDS.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  if (playing(r)) {
    p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid);
    // 게임 중에 나가면 그 자리는 탈락 처리 (하트 0)
    const g = r.game, gp = g?.ps.find(x => x.id === uid);
    if (gp && gp.alive) { if (g.curP().id === uid) { gp.hearts = 1; onMiss(io, r, g.miss(uid, now(), "left")); } else { gp.hearts = 0; gp.alive = false; gp.out = g.outOrder.length + 1; g.outOrder.push(uid); if (g.alive().length <= 1 && g.ps.length > 1) { g.end(now()); finishRoom(io, r, "over"); } else sendState(io, r); } }
  } else removeSeat(r, uid);
  io.to(chan(r.id)).emit("wd:notice", { k: "left", name: p.name });
  if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
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
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("wd:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, ai: o.ai || null, viewer: !!o.viewer, sayN: 0, sayWin: 0, typeAt: 0, cos: o.ai || o.viewer ? null : PROG.cosOf(id) });
function addAi(r, level) {
  if (seatsOf(r).length >= r.maxPlayers) return false;
  const used = new Set(seatsOf(r).map(p => p.name)); const name = AI_NAMES.find(n => !used.has("🤖 " + n)) || "봇";
  const id = "ai_" + Math.random().toString(36).slice(2, 8); r.players.set(id, newSeat(id, "🤖 " + name, { ai: isAiLevel(level) ? level : "normal" })); r.order.push(id); return true;
}
function sendStart(r, socket) { if (!playing(r)) return; socket.emit("wd:start", { serverNow: now(), at: r.game.turnAt }); socket.emit("wd:state", { ...r.game.pub(now()), serverNow: now() }); }
const defaultOpts = () => ({ hearts: 3, turn: 15, noKill: false, minLen: 2 });
function readOpts(o, pl) {
  const n = { ...o };
  if (pl.hearts !== undefined) { const v = Number(pl.hearts); if (!WD.hearts.includes(v)) return null; n.hearts = v; }
  if (pl.turn !== undefined) { const v = Number(pl.turn); if (!WD.turns.includes(v)) return null; n.turn = v; }
  if (pl.minLen !== undefined) { const v = Number(pl.minLen); if (!WD.minLens.includes(v)) return null; n.minLen = v; }
  if (pl.noKill !== undefined) n.noKill = !!pl.noKill;
  return n;
}

// ---------- 시청자 채팅 ----------
function onViewerChat(io, r, msg) {
  if (!r.stream.on || !playing(r)) return; const g = r.game; if (g.phase !== "play" || g.curP()?.id !== VIEWER_ID || now() < g.turnAt) return;
  const text = String(msg?.content ?? msg?.message ?? msg?.text ?? "").trim(); if (!text || text.length > 20) return;
  let prof = msg?.profile; if (typeof prof === "string") { try { prof = JSON.parse(prof); } catch { prof = null; } }
  const who = String(msg?.senderChannelId ?? msg?.uid ?? prof?.nickname ?? ""), nick = String(prof?.nickname ?? msg?.nickname ?? msg?.nick ?? "시청자").slice(0, 14);
  if (!who) return; const t = now(), last = r.viewerTries.get(who) || 0; if (t - last < WDS.viewerGap) return; r.viewerTries.set(who, t); if (r.viewerTries.size > 5000) r.viewerTries.clear();
  const w = cleanWord(text.replace(/^!/, "")); if (!g.needs().includes(w[0])) return; // 시작 글자가 맞는 것만 시도로 봄 (일반 채팅은 무시)
  say(io, r, VIEWER_ID, w, nick);
}

export function registerWordChain(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; RANK = hooks.rank || createRank(supabaseAdmin); PROG = hooks.progress || createProgress(supabaseAdmin); DAILY = hooks.daily || createDaily(supabaseAdmin); if (hooks.dict) DICT = hooks.dict;
  setInterval(() => { const t = now(); for (const r of rooms.values()) { if (!playing(r) || !r.game || r.game.phase !== "play") continue; try { const e = r.game.tick(t); if (e) onMiss(io, r, e); } catch (err) { console.error("[wd] tick", err); } } }, WDS.tickMs).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const fail = (e) => { console.error("[wd]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} }; try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); } };
    const hostRoom = (cb, o = {}) => { const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; } if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; } if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; } return r; };
    socket.on("wd:ping", guard((pl, cb) => cb({ ok: true, s: now() })));
    let rankHits = [];
    socket.on("wd:rank", guard(async (pl, cb) => { const t = now(); rankHits = rankHits.filter(x => t - x < 60_000); if (rankHits.length >= 20) return cb({ ok: false, error: "TOO_FAST" }); rankHits.push(t); cb(await RANK.top(me.id)); }));
    let checkHits = [];
    socket.on("wd:check", guard((pl, cb) => { const t = now(); checkHits = checkHits.filter(x => t - x < 10_000); if (checkHits.length >= 30) return cb({ ok: false, error: "TOO_FAST" }); checkHits.push(t); const w = cleanWord(pl.w), has = w.length >= 2 && dict().has(w); cb({ ok: true, w, has, d: has ? defOf(w) : "", source: dict().source }); }));
    // ---------- 업적·꾸미기 · 오늘의 도전 ----------
    let progHits = []; const progLimit = () => { const t = now(); progHits = progHits.filter(x => t - x < 60_000); if (progHits.length >= 30) return true; progHits.push(t); return false; };
    socket.on("wd:progress", guard(async (pl, cb) => { if (progLimit()) return cb({ ok: false, error: "TOO_FAST" }); const row = await PROG.load(me.id, { fresh: true }); if (row?.failed) return cb({ ok: false, error: "BUSY" }); cb({ ok: true, ready: PROG.isReady(), isGuest: !!me.isGuest, stats: row?.stats || {}, unlocked: row?.unlocked || [], equip: row ? { ...row.equip } : {} }); }));
    socket.on("wd:equip", guard(async (pl, cb) => { if (progLimit()) return cb({ ok: false, error: "TOO_FAST" }); const res = await PROG.setEquip(me.id, !!me.isGuest, { c: pl.c, t: pl.t }); if (!res.ok) return cb(res); const r = myRoom(), p = r?.players.get(me.id); if (p && !p.left) { p.cos = res.equip.c || res.equip.t ? res.equip : null; emitRoom(io, r); } cb(res); }));
    socket.on("wd:dailyRank", guard(async (pl, cb) => { const t = now(); rankHits = rankHits.filter(x => t - x < 60_000); if (rankHits.length >= 20) return cb({ ok: false, error: "TOO_FAST" }); rankHits.push(t); cb(await DAILY.top(me.id)); }));
    let soloHits = [];
    socket.on("wd:solo", guard(async (pl, cb) => {
      const t = now(); soloHits = soloHits.filter(x => t - x < 600_000); const ip = socketIp(socket), ipArr = (soloIpHits.get(ip) || []).filter(x => t - x < 600_000);
      if (soloHits.length >= WDS.soloPerSock || ipArr.length >= WDS.soloPerIp) return cb({ ok: false, error: "RATE_LIMITED" });
      soloHits.push(t); ipArr.push(t); soloIpHits.set(ip, ipArr); if (soloIpHits.size > 20000) soloIpHits.clear();
      return create({ ...pl, solo: true, daily: pl.daily === true ? todayKst() : null }, cb);
    }));
    socket.on("wd:createRoom", guard((pl, cb) => create({ ...pl, solo: false }, cb)));
    const create = async (pl, cb) => {
      { const f = createFlight("wd", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      const id = `wd_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, mp = Math.round(Number(pl.maxPlayers));
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", maxPlayers: mp >= 2 && mp <= WDS.maxRoom ? mp : 8, isPublic: false, solo: !!pl.solo, daily: pl.solo && pl.daily ? pl.daily : null, opts: readOpts(defaultOpts(), pl) || defaultOpts(),
        players: new Map(), order: [], spect: new Map(), createdAt: now(), stream: { on: false, link: { status: "off", platform: null, nickname: null, error: null } } };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id });
      if (r.daily) { r.maxPlayers = 1; emitRoom(io, r); startGame(io, r); }
      else if (r.solo) { const n = Math.min(3, Math.max(1, Math.round(Number(pl.ai)) || 1)), lv = isAiLevel(pl.level) ? pl.level : "normal"; r.maxPlayers = n + 1; for (let k = 0; k < n; k++) addAi(r, lv); emitRoom(io, r); startGame(io, r); }
      else emitRoom(io, r);
    };
    socket.on("wd:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, rejoined: true }); io.to(chan(r.id)).emit("wd:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendStart(r, socket); return; }
      const sp = r.spect.get(me.id); if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (pl.watch === true || playing(r) || r.solo || seatsOf(r).length >= r.maxPlayers) {
        if (r.spect.size >= WDS.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0 }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); io.to(chan(r.id)).emit("wd:notice", { k: "join", name }); emitRoom(io, r);
    }));
    socket.on("wd:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (playing(r) || r.solo) return cb({ ok: false, error: "GAME_STARTED" }); if (seatsOf(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); if (r.players.get(me.id)?.left) removeSeat(r, me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("wd:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" }); if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0 }); userRoom.set(me.id, r.id); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("wd:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 2 && n <= WDS.maxRoom)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < seatsOf(r).length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      const o = readOpts(r.opts, pl); if (!o) return cb({ ok: false, error: "BAD_VALUE" }); r.opts = o;
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("wd:addAi", guard((pl, cb) => { const r = hostRoom(cb); if (!r) return; if (r.solo) return cb({ ok: false, error: "BAD_VALUE" }); if (!addAi(r, pl.level)) return cb({ ok: false, error: "ROOM_FULL" }); cb({ ok: true }); emitRoom(io, r); }));
    socket.on("wd:kick", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: false }); if (!r) return; const uid = String(pl.uid || "");
      const q = r.players.get(uid); if (q && (q.ai || q.viewer)) { if (q.viewer) r.stream.on = false; removeSeat(r, uid); cb({ ok: true }); return emitRoom(io, r); }
      if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("wd:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("wd:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      if (seatsOf(r).length < 2) return cb({ ok: false, error: "NEED_2" }); cb({ ok: true }); startGame(io, r);
    }));
    socket.on("wd:again", guard((pl, cb) => { const r = myRoom(); if (!r || !r.solo || r.hostUserId !== me.id || r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" }); cb({ ok: true }); startGame(io, r); }));
    socket.on("wd:toLobby", guard((pl, cb) => { const r = hostRoom(cb); if (!r) return; if (r.solo) return cb({ ok: false, error: "BAD_VALUE" }); if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" }); for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); } r.status = "lobby"; r.result = null; r.game = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; } cb({ ok: true }); emitRoom(io, r); }));
    // ---------- 단어 ----------
    const mySeat = () => { const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !r.game) return null; return { r, p }; };
    socket.on("wd:say", guard((pl, cb) => {
      const x = mySeat(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" });
      const t = now(); if (t - x.p.sayWin > 1000) { x.p.sayWin = t; x.p.sayN = 0; } if (++x.p.sayN > WDS.sayRate) return cb({ ok: false, error: "TOO_FAST" });
      const res = say(io, x.r, me.id, pl.w); cb(res.ok ? { ok: true, pts: res.e.pts } : { ok: false, error: res.error });
    }));
    socket.on("wd:typing", (pl) => { try { const x = mySeat(); if (!x || x.r.game.curP()?.id !== me.id) return; const t = now(); if (t - x.p.typeAt < WDS.typeGap) return; x.p.typeAt = t; socket.to(chan(x.r.id)).emit("wd:typing", { id: me.id, t: String(pl?.t ?? "").replace(/[<>]/g, "").slice(0, 15) }); } catch {} });
    socket.on("wd:pass", guard((pl, cb) => { const x = mySeat(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" }); const g = x.r.game; if (g.curP()?.id !== me.id || now() < g.turnAt) return cb({ ok: false, error: "NOT_YOUR_TURN" }); cb({ ok: true }); onMiss(io, x.r, g.miss(me.id, now(), "pass")); }));
    // ---------- 스트리머: 시청자 자리 + 채팅 연결 ----------
    socket.on("wd:stream", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.solo) return cb({ ok: false, error: "BAD_VALUE" });
      const on = !!pl.on;
      if (on && !r.players.has(VIEWER_ID)) { if (seatsOf(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" }); r.players.set(VIEWER_ID, newSeat(VIEWER_ID, "📺 시청자", { viewer: true })); r.order.push(VIEWER_ID); }
      if (!on && r.players.has(VIEWER_ID)) removeSeat(r, VIEWER_ID);
      r.stream.on = on; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("wd:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, error: null }; emitRoom(io, r);
      const key = "dw_wd_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "wordchain",
          onDonation: () => {}, onChat: (m) => { if (rooms.get(r.id) === r) onViewerChat(io, r, m); },
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, error: res.ok ? null : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("wd:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_wd_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    // 방장 시험용: 시청자 채팅 흉내 (연결 없이 확인)
    socket.on("wd:testChat", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" }); onViewerChat(io, r, { content: String(pl.text || "").slice(0, 20), senderChannelId: "test_" + Math.floor(Math.random() * 1e6), profile: { nickname: "테스트 시청자" } }); cb({ ok: true }); }));
    socket.on("wd:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" }); cb({ ok: true, room: pubRoom(r, me.id) }); sendStart(r, socket); }));
    socket.on("wd:emote", guard((pl, cb) => { const r = myRoom(); const p = r?.players.get(me.id) || r?.spect.get(me.id); if (!p) return cb({ ok: false }); const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t; const e = ["👍", "🔥", "😱", "😂", "🙏", "🤔"][Number(pl.e)]; if (!e) return cb({ ok: false }); io.to(chan(r.id)).emit("wd:emote", { id: me.id, name: p.name, e }); cb({ ok: true }); }));
    socket.on("wd:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= WDS.lobbyDc - 50) leave(io, r, me.id); }, WDS.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("wd:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= WDS.lobbyDc - 50) leave(io, r, me.id); }, WDS.lobbyDc);
      else if (r.hostUserId === me.id) { const h = humans(r).find(p => p.connected); if (h) r.hostUserId = h.id; }
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
addPublicList("wordchain", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.solo || r.status !== "lobby") continue; const n = seatsOf(r).length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers, game: "ffa", playing: false }); } return out; });
export const _wdTest = { rooms, invites, userRoom, WDS };
