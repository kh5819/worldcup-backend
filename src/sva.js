// =========================
// DUO 증강 서바이벌 아레나 — 방·소켓 (2026-11-20)  이벤트 prefix 'sva:*'
// · 모드: 협동(1~8, 한 맵) · 개인전(2~8, 같은 웨이브 시드로 각자 아레나 / 방장 옵션 직접 PvP = 한 맵) · 팀 대전(2v2·3v3·4v4, 팀별 아레나)
// · 일반/증강, 난이도 4, 길이 5·10·15분, 보스 3마리(랜덤 또는 방장이 고름)
// · 기존 방 흐름: 게스트 가능, 초대 코드, 방장 권한, 관전, 재접속(같은 아이디), 공개방, 스트리머 후원(치지직·씨미 공식, SOOP 비공식)
// · 서버 권위: 화면은 이동 방향·조준·버튼·고른 카드 번호만 보냄 → 위치·피해·경험치·증강·보스는 sva-sim.js가 확정
// · 보내기: 20Hz, 사람마다 관심 영역(내 화면 주변)만 — 몬스터·투사체·보석은 바이너리, 나머지 JSON. 소켓 쓰기가 밀리면 그 틱은 건너뜀
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicList } from "./public-rooms.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { World } from "./sva-sim.js";
import { CHARS, CHAR_IDS, BOSSES, BOSS_TIER, DIFF, GAME_LEN, MODE_MAX, STREAM_KINDS, STREAM_DEFAULT, STREAM_LABEL, MONSTERS, MAP, AUG } from "./sva-data.js";
import { createProgress } from "./sva-progress.js"; // 업적·해금 (2026-11-20)

const rooms = new Map(), invites = new Map(), userRoom = new Map(), soloIpHits = new Map();
const socketIp = (s) => String(s.handshake.headers["cf-connecting-ip"] || s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
export const SV = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 40, tickMs: 50, botAfter: 4_000, inRate: 45, soloPerSock: 30, soloPerIp: 120, hudEvery: 5, sabCd: 45, sabCost: 90, backlog: 40 };
const MODES = ["coop", "versus", "team"];
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k); // "constructor"·"toString" 같은 이름 거절
const SOOP_BALLOON_KRW = 100;
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {};
let PROG = createProgress(null);
const loadCos = (id) => Promise.race([PROG.load(id).catch(() => null), new Promise(r => setTimeout(r, 1500))]); // 꾸미기 읽기 (DB 느려도 입장은 안 막음)
const chan = (id) => `sva:${id}`;
const now = () => Date.now();
const MAX_NICK = 12;
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim().slice(0, MAX_NICK) || d;
// 후원자 이름 금칙어 (몬스터 머리 위에 뜨므로) — 걸리면 * 로 가림
const BAD = ["씨발", "시발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "ㅈㄴ", "개새", "새끼", "느금", "니애미", "애미", "엠창", "섹스", "fuck", "shit", "bitch", "nigger", "sex", "porn"];
export function safeDonor(s) { let t = cleanDonor(s); const low = t.toLowerCase(); for (const w of BAD) { let i = low.indexOf(w); while (i >= 0) { t = t.slice(0, i) + "*".repeat(w.length) + t.slice(i + w.length); i = t.toLowerCase().indexOf(w, i + w.length); } } return t.slice(0, 12); }
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const defaultStream = () => ({ on: false, rules: { ...STREAM_DEFAULT }, targets: { buff: "streamer", monster: "streamer", supply: "streamer", elite: "streamer" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map(), queue: [] });
const humans = (r) => [...r.players.values()].filter(p => !p.left);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
const playing = (r) => r.status === "playing";
const defaultOpts = () => ({ diff: "normal", len: 15, bosses: "random", b1: BOSS_TIER[1][0], b2: BOSS_TIER[2][0], b3: BOSS_TIER[3][0], pvp: false, teamSize: 2 });
function cleanOpts(o = {}, base = defaultOpts()) {
  const out = { ...base };
  if (own(DIFF, o.diff)) out.diff = o.diff;
  if ([5, 10, 15].includes(Number(o.len))) out.len = Number(o.len);
  if (["random", "pick"].includes(o.bosses)) out.bosses = o.bosses;
  if (BOSS_TIER[1].includes(o.b1)) out.b1 = o.b1; if (BOSS_TIER[2].includes(o.b2)) out.b2 = o.b2; if (BOSS_TIER[3].includes(o.b3)) out.b3 = o.b3;
  if (typeof o.pvp === "boolean") out.pvp = o.pvp;
  if ([2, 3, 4].includes(Number(o.teamSize))) out.teamSize = Number(o.teamSize);
  return out;
}
function pubRoom(r, viewer) {
  const host = viewer === r.hostUserId, st = r.stream;
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator, solo: !!r.solo, mode: r.mode, aug: r.aug, opts: r.opts, maxPlayers: r.maxPlayers, isPublic: !!r.isPublic,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, idx: p.idx, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left, team: p.team ?? 0, char: p.char, ready: !!p.ready, cos: p.cos || null }; }),
    spectators: r.spect.size, result: r.status === "ended" ? r.result : null,
    worlds: r.worlds ? r.worlds.map(w => ({ k: w.kind, ids: [...w.P.values()].map(P => P.idx), st: w.status, res: w.result })) : null,
    stream: st.on ? { on: true, rules: st.rules, targets: st.targets, labels: STREAM_LABEL, link: host ? st.link : { status: st.link.status, platform: st.link.platform }, log: st.log.slice(-10) } : { on: false },
    serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("sva:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("sva:room", pubRoom(r, s.id));
}
// 한 사람이 보는 세계·중심
function viewOf(r, rec) {
  if (!r.worlds) return null;
  const mine = r.players.has(rec.id) && !r.players.get(rec.id).left ? r.worldOf.get(rec.id) : null;
  let W = mine, P = mine ? mine.P.get(rec.id) : null;
  // 쓰러졌거나 관전이면 지켜볼 사람 (고른 사람 → 같은 세계 살아 있는 사람 → 아무나)
  const focusP = (idx) => { for (const w of r.worlds) for (const Q of w.P.values()) if (Q.idx === idx) return [w, Q]; return null; };
  if (!P || P.state === "dead") {
    let f = rec.focus != null ? focusP(rec.focus) : null;
    if (!f || f[1].state === "dead") { const pool = W ? [W] : r.worlds; outer: for (const w of [...pool, ...r.worlds]) for (const Q of w.P.values()) if (Q.state !== "dead") { f = [w, Q]; break outer; } }
    if (f) { W = f[0]; const me = P; P = f[1]; return { W, P, me, watching: P.idx }; }
    if (!W) W = r.worlds[0];
    return { W, P: P || [...W.P.values()][0], me: P, watching: null };
  }
  return { W, P, me: P, watching: null };
}
function sendSnaps(io, r) {
  const tick = r.tickN;
  for (const rec of [...r.players.values(), ...r.spect.values()]) {
    if (!rec.sockId || !rec.connected || rec.left) continue;
    const sock = io.sockets.sockets.get(rec.sockId); if (!sock) continue;
    // 쓰기 버퍼가 밀려 있으면 이번 틱은 건너뜀 (느린 망에서 쌓여 터지지 않게)
    const wb = sock.conn?.writeBuffer?.length || 0; if (wb > SV.backlog) { r.skipped = (r.skipped || 0) + 1; continue; }
    const v = viewOf(r, rec); if (!v) continue;
    if (rec.viewW !== v.W) { rec.viewW = v.W; rec.hzKnown = new Set(); } // 다른 세계를 보기 시작하면 장판 다시 전부
    const { j, buf } = v.W.view(v.P, v.P.x, v.P.y, rec.vw, rec.hzKnown);
    j.me = v.me ? v.me.idx : -1; j.wt = v.watching; j.wi = r.worlds.indexOf(v.W);
    if (v.W.kind === "team") j.sg = [v.W.sab || 0, SV.sabCost, Math.max(0, Math.ceil(SV.sabCd - (v.W.t - (v.W.sabAt ?? -999))))]; // 팀전 방해 게이지 [현재, 필요, 남은 쿨]
    if (v.me && r.worldOf.get(rec.id) === v.W) { j.ack = v.me.in.seq; }
    sock.emit("sva:s", j, Buffer.from(buf));
    if (DEV) r.bytes = (r.bytes || 0) + buf.byteLength + JSON.stringify(j).length; // 시험 때만 잼
    // 내 정보: 바뀌었을 때만, 0.25초마다
    if (v.me && tick % SV.hudEvery === (rec.hudPhase || 0)) { const W0 = r.worldOf.get(rec.id); const P0 = W0?.P.get(rec.id); if (P0) { const h = W0.hud(P0), s = JSON.stringify(h); if (s !== rec.lastHud) { rec.lastHud = s; sock.emit("sva:hud", h); } } }
  }
}
function onWorldEnd(io, r) {
  if (!r.worlds || r.worlds.some(w => w.status === "play")) return;
  finishRoom(io, r);
}
function finishRoom(io, r) {
  if (r.status !== "playing") return;
  const rows = [];
  for (const w of r.worlds) for (const P of w.P.values()) { const p = r.players.get(P.id); rows.push({ i: P.idx, name: p?.name || P.name, char: P.char, team: P.team, lv: P.lvl, kills: P.kills, dmg: Math.round(P.dmg), boss: Math.round(P.bossDmg), taken: Math.round(P.taken), heal: Math.round(P.healed), rev: P.revivedOthers, alive: Math.round(P.aliveT), score: w.scoreOf(P), win: w.result === "win", state: P.state, augs: P.augs, weapons: P.weapons.map(x => x.evo || x.id), wb: w.bossesKilled, left: !!p?.left }); }
  let winner = null;
  if (r.mode === "coop") winner = r.worlds[0].result;
  else if (r.mode === "team") { const sc = [0, 0]; for (const x of rows) sc[x.team] += x.score; for (const w of r.worlds) if (w.result === "win") sc[[...w.P.values()][0].team] += 5000; winner = sc[0] === sc[1] ? "draw" : sc[0] > sc[1] ? 0 : 1; r.teamScore = sc; }
  rows.sort((a, b) => (b.win - a.win) || (b.score - a.score));
  const mvp = rows.slice().sort((a, b) => b.dmg - a.dmg)[0];
  r.result = { mode: r.mode, aug: r.aug, rows, winner, teamScore: r.teamScore || null, mvp: mvp ? mvp.i : -1, t: Math.round(Math.max(...r.worlds.map(w => w.endT || w.t))), bosses: r.worlds[0].bossPlan, killed: Math.max(...r.worlds.map(w => w.bossesKilled)) };
  r.status = "ended"; r.endedAt = now();
  io.to(chan(r.id)).emit("sva:end", r.result); emitRoom(io, r);
  recordAch(io, r, rows, winner);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, SV.endedTtl);
}
// 업적: 게임 서버가 확정한 값으로만 기록 → 새로 깬 업적은 그 사람에게만 알림 (DB가 늦어도 게임엔 영향 없음)
function recordAch(io, r, rows, winner) {
  try {
    const len = GAME_LEN[r.opts.len] || 900, entries = [];
    for (const w of r.worlds) for (const P of w.P.values()) {
      const p = r.players.get(P.id); if (!p || p.left) continue;
      const row = rows.find(x => x.i === P.idx);
      const win = r.mode === "team" ? winner === P.team : w.result === "win";
      const first = r.mode === "versus" && rows.filter(x => !x.left).length >= 2 && rows[0]?.i === P.idx && (rows[0].score > (rows[1]?.score ?? -1) || rows[0].win > (rows[1]?.win ?? 0));
      entries.push({ key: p.id, isGuest: p.isGuest, name: p.name, sockId: p.sockId, run: { win, first, mode: r.mode, diff: r.opts.diff, len, aug: !!r.aug, char: P.char, party: w.P.size, kills: P.kills, elite: P.eliteKills || 0, bosses: w.bossesKilled, evo: P.weapons.filter(x => x.evo).length, lv: P.lvl, syn: P.syn?.size || 0, leg: P.augs.filter(a => AUG[a]?.r === "legendary").length, rev: P.revivedOthers, alive: P.aliveT, falls: P.falls || 0, score: row?.score || 0 } });
    }
    if (!entries.length) return;
    PROG.record(entries).then((res) => {
      for (const e of entries) { const o = res.get(e.key); if (!o) continue; const p = r.players.get(e.key); const sid = p?.sockId || e.sockId; if (sid) io.to(sid).emit("sva:ach", { newly: o.newly, count: o.count, unlocked: o.unlocked, stats: o.stats }); }
    }).catch((e) => console.error("[sva] ach", e));
  } catch (e) { console.error("[sva] ach", e); }
}
// ---------- 시작 ----------
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return false;
  r.order.forEach((u, i) => { r.players.get(u).idx = i; });
  const seed = (Math.random() * 2 ** 32) >>> 0, o = r.opts;
  const rnd = (arr) => arr[(Math.random() * arr.length) | 0];
  const bosses = o.bosses === "pick" ? [o.b1, o.b2, o.b3] : [rnd(BOSS_TIER[1]), rnd(BOSS_TIER[2]), rnd(BOSS_TIER[3])];
  const len = GAME_LEN[o.len] || 900;
  const seat = (u) => { const p = r.players.get(u); return { id: p.id, name: p.name, char: p.char, idx: p.idx, team: p.team ?? 0 }; };
  const base = { seed, aug: r.aug, diff: o.diff, len, bosses, out: (ev, d, to) => { const p = r.players.get(to); if (p?.sockId) io.to(p.sockId).emit("sva:" + ev, d); },
    onEnd: () => setImmediate(() => onWorldEnd(io, r)), onSabotage: (P) => sabotage(io, r, P), onKill: null };
  r.worlds = []; r.worldOf = new Map();
  const all = r.order.map(seat);
  if (r.mode === "coop" || (r.mode === "versus" && o.pvp)) { const W = new World({ ...base, kind: r.mode === "coop" ? "coop" : "pvp", players: all, party: all.length }); r.worlds.push(W); for (const s of all) r.worldOf.set(s.id, W); }
  else if (r.mode === "versus") for (const s of all) { const W = new World({ ...base, kind: "versus", players: [s], party: 1 }); r.worlds.push(W); r.worldOf.set(s.id, W); }
  else { for (const t of [0, 1]) { const ps = all.filter(s => s.team === t); if (!ps.length) continue; const W = new World({ ...base, kind: "team", players: ps, party: ps.length }); W.teamId = t; W.sab = 0; W.sabAt = -999; r.worlds.push(W); for (const s of ps) r.worldOf.set(s.id, W); } }
  for (const W of r.worlds) W.o.onKill = (w) => { if (w.kind === "team") w.sab = Math.min(SV.sabCost, (w.sab || 0) + 1); };
  r.stream.queue.length = 0; // 지난 판에 밀린 후원이 새 판 시작에 튀어나오지 않게
  r.status = "playing"; r.result = null; r.tickN = 0; r.startedAt = now(); r.bytes = 0; r.skipped = 0;
  for (const p of r.players.values()) { p.lastHud = ""; p.hudPhase = p.idx % SV.hudEvery; p.dcBot = false; }
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  const meta = { obs: r.worlds[0].obs, map: MAP, mode: r.mode, aug: r.aug, bosses, len, diff: o.diff, worlds: r.worlds.map(w => [...w.P.values()].map(P => P.idx)), pvp: !!o.pvp };
  io.to(chan(r.id)).emit("sva:start", meta); r.meta = meta;
  emitRoom(io, r);
  return true;
}
// 팀전 방해: 우리 팀 처치로 게이지가 차면 상대 팀 아레나에 침입 정예 (45초에 한 번, 상대 쪽 침입자 4마리까지)
function sabotage(io, r, P) {
  if (r.mode !== "team" || !r.worlds) return;
  const mine = r.worldOf.get(P.id), other = r.worlds.find(w => w !== mine); if (!mine || !other || other.status !== "play") return;
  if ((mine.sab || 0) < SV.sabCost || mine.t - (mine.sabAt ?? -999) < SV.sabCd || other.invaders >= 4) { const p = r.players.get(P.id); if (p?.sockId) io.to(p.sockId).emit("sva:notice", { k: "sabno" }); return; }
  mine.sab = 0; mine.sabAt = mine.t;
  const ps = other.alivePlayers(); const T = ps[(Math.random() * ps.length) | 0]; if (!T) return;
  const types = Object.keys(MONSTERS).filter(k => MONSTERS[k].t <= other.t * other.ts + 60).slice(-6);
  for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2, m = other.spawnMon(types[(Math.random() * types.length) | 0] || "goblin", T.x + Math.cos(a) * 420, T.y + Math.sin(a) * 420, { elite: true, invader: true }); if (m) { other.invaders++; m.invaderName = P.name; } }
  io.to(chan(r.id)).emit("sva:feed", { k: "sab", from: P.idx, team: P.team });
}

let ticker = null;
const DEV = process.env.SVA_DEV === "1";
// 50ms마다 — setInterval은 윈도 등에서 타이머 해상도 때문에 62ms로 밀리므로, 다음 목표 시각을 기억해 스스로 맞춤
function ensureTicker(io) {
  if (ticker) return;
  let next = Date.now();
  const loop = () => { next += SV.tickMs; const late = Date.now() - next; if (late > 250) next = Date.now(); tickAll(io); ticker = setTimeout(loop, Math.max(0, next - Date.now())); ticker.unref?.(); };
  ticker = setTimeout(loop, SV.tickMs); ticker.unref?.();
}
function tickAll(io) {
  {
    const t = now();
    for (const r of rooms.values()) {
      if (!playing(r) || !r.worlds) continue;
      try {
        r.tickN++;
        // 끊긴 사람: 4초 뒤 자동 조종 (돌아오면 해제)
        for (const p of r.players.values()) {
          const W = r.worldOf.get(p.id), P = W?.P.get(p.id); if (!P) continue;
          if ((!p.connected || p.left) && !P.bot && (p.left || t - p.dcAt > SV.botAfter)) { P.bot = true; P.wasHuman = true; p.dcBot = true; }
        }
        const t0 = process.hrtime.bigint();
        for (const W of r.worlds) W.step();
        r.simNs = (r.simNs || 0) + Number(process.hrtime.bigint() - t0);
        // 후원 대기열 (정예 소환 상한 때문에 밀린 것)
        if (r.stream.queue.length && r.tickN % 20 === 0) { const q = r.stream.queue.shift(); applyDonation(io, r, q, true); }
        sendSnaps(io, r);
      } catch (e) { console.error("[sva] tick", e); }
    }
  }
}

// ---------- 방 관리 ----------
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted"; r.worlds = null;
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_sv_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("sva:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, SV.emptyTtl);
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
    const W = r.worldOf.get(uid), P = W?.P.get(uid);
    if (P) { P.bot = true; P.wasHuman = true; if (W.kind === "versus") W.finish("lose"); } // 개인전은 나가면 그 아레나 끝
  } else removeSeat(r, uid);
  io.to(chan(r.id)).emit("sva:notice", { k: "left", name: p.name });
  if (!humans(r).filter(q => !q.left).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
  emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("sva:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; rec.lastHud = ""; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
  // 자동 조종 해제
  const W = r.worldOf?.get(rec.id), P = W?.P.get(rec.id); if (P && rec.dcBot && !rec.left) { P.bot = false; rec.dcBot = false; P.in.mx = 0; P.in.my = 0; }
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, idx: 0, team: o.team ?? 0, char: own(CHARS, o.char) ? o.char : "warrior", focus: null, inN: 0, inWin: 0, cos: PROG.cosOf(id) });
function smallerTeam(r) { const c = [0, 0]; for (const p of r.players.values()) if (!p.left) c[p.team ?? 0]++; return c[1] < c[0] ? 1 : 0; }
function sendStart(r, socket) { if (r.meta && playing(r)) socket.emit("sva:start", r.meta); }

// ---------- 스트리머 ----------
function rankList(r) {
  if (!r.worlds) return [];
  const all = []; for (const w of r.worlds) for (const P of w.P.values()) if (P.state === "alive") all.push(P);
  return all.sort((a, b) => b.dmg - a.dmg);
}
function pickTarget(r, how) {
  const list = rankList(r); if (!list.length) return null;
  if (how === "streamer") return list.find(P => P.id === r.hostUserId) || list[0];
  if (how === "leader") return list[0]; if (how === "last") return list[list.length - 1];
  return list[Math.floor(Math.random() * list.length)];
}
function applyDonation(io, r, rec, fromQueue) {
  const P = pickTarget(r, r.stream.targets[rec.kind] || "streamer");
  if (!P) { rec.status = "skipped"; rec.note = "대상 없음"; return rec; }
  const W = r.worldOf.get(P.id); if (!W || W.status !== "play") { rec.status = "skipped"; rec.note = "게임 중이 아님"; return rec; }
  const t = W.t;
  if (rec.kind === "buff") { P.buffs.sbuff = t + 20; W.ev.push({ k: "sbuff", i: P.idx, x: P.x, y: P.y }); }
  else if (rec.kind === "monster") { W.monBuff = t + 20; W.gev.push({ k: "monbuff", d: 20 }); }
  else if (rec.kind === "supply") { const a = Math.random() * Math.PI * 2; W.dropItem("supply", Math.max(40, Math.min(MAP.w - 40, P.x + Math.cos(a) * 120)), Math.max(40, Math.min(MAP.h - 40, P.y + Math.sin(a) * 120))); }
  else if (rec.kind === "elite") {
    if (W.donorElites >= 3) { if (!fromQueue && r.stream.queue.length < 5) { r.stream.queue.push(rec); rec.status = "queued"; rec.note = "정예가 많아 잠시 뒤 등장"; return rec; } rec.status = "skipped"; rec.note = "정예 상한"; return rec; }
    const types = Object.keys(MONSTERS).filter(k => MONSTERS[k].t <= Math.max(120, W.t * W.ts)); const type = types[(Math.random() * types.length) | 0] || "goblin";
    const a = Math.random() * Math.PI * 2, m = W.spawnMon(type, P.x + Math.cos(a) * 380, P.y + Math.sin(a) * 380, { elite: true, donor: rec.donor });
    if (m) { W.donorElites++; m.hp *= 1.5; m.maxHp *= 1.5; }
  }
  rec.status = "applied"; rec.target = P.idx; rec.note = P.name;
  if (fromQueue) io.to(chan(r.id)).emit("sva:donation", { ...rec, label: STREAM_LABEL[rec.kind] });
  return rec;
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream, kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: safeDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off";
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (!playing(r) || !r.worlds) { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else {
    st.lastKind = st.lastKind || {}; const last = st.lastKind[kind] || 0;
    if (now() - last < 2000) { rec.status = "skipped"; rec.note = "너무 잦아요 (2초 뒤 다시)"; }
    else { st.lastKind[kind] = now(); applyDonation(io, r, rec, false); }
  }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("sva:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null }); emitRoom(io, r);
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
export function registerSurvival(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; ensureTicker(io); PROG = hooks.progress || createProgress(supabaseAdmin);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    let inCount = 0, inWin = 0;
    const guard = (fn, o = {}) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (o.game) { const t = now(); if (t - inWin > 1000) { inWin = t; inCount = 0; } if (++inCount > (o.rate || 12)) return reply({ ok: false, error: "TOO_FAST" }); }
      const fail = (e) => { console.error("[sva]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    socket.on("sva:ping", guard((pl, cb) => cb({ ok: true, s: now(), c: pl.c })));
    // 업적·꾸미기 (2026-11-20)
    let progHits = [];
    const progLimit = () => { const t = now(); progHits = progHits.filter(x => t - x < 60_000); if (progHits.length >= 30) return true; progHits.push(t); return false; };
    socket.on("sva:progress", guard(async (pl, cb) => {
      if (progLimit()) return cb({ ok: false, error: "TOO_FAST" });
      const row = await PROG.load(me.id, { fresh: true });
      if (row?.failed) return cb({ ok: false, error: "BUSY" });
      cb({ ok: true, ready: PROG.isReady(), isGuest: !!me.isGuest, stats: row?.stats || {}, unlocked: row?.unlocked || [], equip: row ? { ...row.equip } : {} });
    }));
    socket.on("sva:equip", guard(async (pl, cb) => {
      if (progLimit()) return cb({ ok: false, error: "TOO_FAST" });
      const res = await PROG.setEquip(me.id, !!me.isGuest, { c: pl.c, t: pl.t });
      if (!res.ok) return cb(res);
      const r = myRoom(), p = r?.players.get(me.id); if (p && !p.left) { p.cos = res.equip.c || res.equip.t ? res.equip : null; emitRoom(io, r); }
      cb(res);
    }));
    let soloHits = [];
    socket.on("sva:solo", guard(async (pl, cb) => {
      const t = now(); soloHits = soloHits.filter(x => t - x < 600_000);
      const ip = socketIp(socket), ipArr = (soloIpHits.get(ip) || []).filter(x => t - x < 600_000);
      if (soloHits.length >= SV.soloPerSock || ipArr.length >= SV.soloPerIp) return cb({ ok: false, error: "RATE_LIMITED" });
      soloHits.push(t); ipArr.push(t); soloIpHits.set(ip, ipArr); if (soloIpHits.size > 20000) soloIpHits.clear();
      return create({ ...pl, solo: true, mode: "coop" }, cb);
    }));
    socket.on("sva:createRoom", guard((pl, cb) => create({ ...pl, solo: false }, cb)));
    const create = async (pl, cb) => {
      { const f = createFlight("sva", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      const mode = MODES.includes(pl.mode) ? pl.mode : "coop";
      const id = `sv_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const mp = Math.round(Number(pl.maxPlayers));
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", mode, aug: pl.aug !== false, maxPlayers: mp >= 1 && mp <= 8 ? mp : 8, opts: cleanOpts(pl.opts || {}), isPublic: false, solo: !!pl.solo, players: new Map(), order: [], spect: new Map(), stream: defaultStream(), createdAt: now(), worlds: null, worldOf: null };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0, char: pl.char }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id }); emitRoom(io, r);
      if (r.solo) startGame(io, r);
    };
    socket.on("sva:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, rejoined: true }); io.to(chan(r.id)).emit("sva:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendStart(r, socket); return; }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const [{ name, avatar }] = await Promise.all([profileOf(supabaseAdmin, me, pl.nickname), loadCos(me.id)]);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const n = humans(r).length;
      // 협동은 게임 중에도 빈자리에 중도 참가 (뒤처지지 않게 팀 최저 레벨-2까지 자동 성장)
      const midJoin = playing(r) && r.mode === "coop" && !r.solo && n < r.maxPlayers && pl.watch !== true && !r.players.get(me.id)?.left && r.worlds?.[0]?.status === "play";
      if (!midJoin && (pl.watch === true || playing(r) || r.solo || n >= r.maxPlayers || r.players.get(me.id)?.left)) {
        if (r.spect.size >= SV.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, focus: null }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, spectator: true }); emitRoom(io, r); sendStart(r, socket); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: smallerTeam(r), char: pl.char }); r.players.set(me.id, p); r.order.push(me.id);
      if (midJoin) {
        const W = r.worlds[0]; p.idx = Math.max(...[...r.players.values()].map(q => q.idx)) + 1; if (p.idx > 7) p.idx = [...Array(8).keys()].find(i => ![...r.players.values()].some(q => q !== p && q.idx === i)) ?? 7;
        const P = W.addPlayer({ id: p.id, name, char: p.char, idx: p.idx, team: 0 }, p.idx);
        const ref = [...W.P.values()].filter(Q => Q !== P); if (ref.length) { const near = ref[0]; P.x = near.x + 30; P.y = near.y; W.pushOut(P); const target = Math.max(1, Math.min(...ref.map(Q => Q.lvl)) - 2); P.bot = "smart"; let g = 0; while (P.lvl < target && g++ < 80) { W.gainXp(P, P.xpNext - P.xp + 0.01); W.checkPicks(); } P.bot = false; P.hp = P.maxHp; }
        r.worldOf.set(p.id, W); r.meta.worlds = [[...W.P.values()].map(Q => Q.idx)];
      }
      attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, midJoin }); io.to(chan(r.id)).emit("sva:notice", { k: "join", name }); emitRoom(io, r); if (midJoin) io.to(chan(r.id)).emit("sva:start", r.meta);
    }));
    socket.on("sva:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (humans(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); r.players.delete(me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id, team: smallerTeam(r) }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, focus: null }); userRoom.set(me.id, r.id);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:char", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (!own(CHARS, pl.char)) return cb({ ok: false, error: "BAD_VALUE" });
      p.char = pl.char; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (MODES.includes(pl.mode) && pl.mode !== r.mode) { r.mode = pl.mode; r.order.forEach((u, i) => { r.players.get(u).team = r.mode === "team" ? i % 2 : 0; }); }
      if (typeof pl.aug === "boolean") r.aug = pl.aug;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= 8)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < humans(r).length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.opts) r.opts = cleanOpts(pl.opts, r.opts);
      if (r.mode === "team") r.maxPlayers = Math.max(humans(r).length, Math.min(8, r.opts.teamSize * 2));
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:team", guard((pl, cb) => {
      const r = myRoom(); if (!r || playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.mode !== "team") return cb({ ok: false, error: "NO_TEAMS" });
      const uid = pl.uid && r.hostUserId === me.id ? String(pl.uid) : me.id; const p = r.players.get(uid); if (!p) return cb({ ok: false, error: "BAD_TARGET" });
      const t = Number(pl.t) === 1 ? 1 : 0; const cnt = [...r.players.values()].filter(q => q.team === t && q.id !== uid).length; if (cnt >= r.opts.teamSize) return cb({ ok: false, error: "TEAM_FULL" });
      p.team = t; cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:kick", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("sva:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("sva:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      const conn = r.order.filter(u => r.players.get(u)?.connected);
      if (!conn.length) return cb({ ok: false, error: "NEED_1" });
      if (r.mode === "versus" && conn.length < 2) return cb({ ok: false, error: "NEED_2" });
      if (r.mode === "team") { const c = [0, 0]; for (const u of conn) c[r.players.get(u).team]++; if (!c[0] || !c[1]) return cb({ ok: false, error: "NEED_TEAMS" }); if (c[0] !== c[1]) return cb({ ok: false, error: "TEAM_UNEVEN" }); }
      cb({ ok: true }); startGame(io, r);
    }));
    socket.on("sva:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      r.status = "lobby"; r.result = null; r.worlds = null; r.worldOf = null; r.solo = false; r.meta = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:again", guard((pl, cb) => { // 혼자 하기 다시
      const r = myRoom(); if (!r || !r.solo || r.hostUserId !== me.id || r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      const p = r.players.get(me.id); if (own(CHARS, pl.char)) p.char = pl.char; if (own(DIFF, pl.diff)) r.opts.diff = pl.diff; if (typeof pl.aug === "boolean") r.aug = pl.aug;
      cb({ ok: true }); startGame(io, r);
    }));
    // ---------- 경기 입력 ----------
    const inWorld = () => { const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !r.worlds) return null; const W = r.worldOf.get(me.id); return W ? { r, W } : null; };
    // 입력: 20~30Hz로 옴. 초당 45개 넘으면 버림 (속도 조작 막기 — 이동은 어차피 서버가 틱마다 속도로 계산)
    socket.on("sva:in", (d) => {
      const x = inWorld(); if (!x || !d || typeof d !== "object") return;
      const p = x.r.players.get(me.id), t = now(); if (t - p.inWin > 1000) { p.inWin = t; p.inN = 0; } if (++p.inN > SV.inRate) return;
      x.W.input(me.id, { s: Number(d.s) | 0, mx: Number(d.mx) / 100, my: Number(d.my) / 100, a: Number(d.a) / 1000, au: !!d.au, b: Number(d.b) | 0 });
    });
    socket.on("sva:view", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false }); const rec = r.players.get(me.id) || r.spect.get(me.id); const hw = Math.round(Number(pl.hw)), hh = Math.round(Number(pl.hh)); if (rec && hw > 0 && hh > 0) rec.vw = { hw: Math.max(380, Math.min(1000, hw)), hh: Math.max(300, Math.min(760, hh)) }; cb({ ok: true }); }, { game: true, rate: 4 }));
    socket.on("sva:pick", guard((pl, cb) => { const x = inWorld(); if (!x) return cb({ ok: false, error: "NOT_PLAYING" }); cb(x.W.pick(me.id, Number(pl.n) | 0, String(pl.id || "").slice(0, 20))); }, { game: true, rate: 10 }));
    socket.on("sva:focus", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false }); const rec = r.players.get(me.id) || r.spect.get(me.id); const i = Number(pl.idx); rec.focus = Number.isInteger(i) && i >= 0 && i < 8 ? i : null; cb({ ok: true }); }, { game: true, rate: 8 }));
    socket.on("sva:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" }); cb({ ok: true, room: pubRoom(r, me.id) }); sendStart(r, socket); const rec = r.players.get(me.id); if (rec) rec.lastHud = ""; }));
    socket.on("sva:emote", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false });
      const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t;
      const e = ["👍", "🔥", "😱", "😂", "🙏", "🆘"][Number(pl.e)]; if (!e) return cb({ ok: false });
      io.to(chan(r.id)).emit("sva:emote", { i: p.idx, e }); cb({ ok: true });
    }));
    // ---------- 스트리머 ----------
    socket.on("sva:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (pl.rules) { const next = { ...st.rules }; for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" }); st.rules = next; }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("sva:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("sva:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_sv_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "survival",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("sva:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_sv_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    // ---------- 시험 전용 (운영에선 꺼짐: 환경 변수 SVA_DEV=1 일 때만) ----------
    if (process.env.SVA_DEV === "1") socket.on("sva:dev", guard((pl, cb) => {
      const r = myRoom(); if (!r?.worlds) return cb({ ok: false });
      for (const W of r.worlds) {
        if (Number(pl.t) > 0) { W.t = Number(pl.t); W.augNext = W.augAt.filter(x => x <= W.t).length; }
        if (Number(pl.bots) > 0) for (let i = 0; i < Math.min(7, Number(pl.bots)); i++) { const idx = W.P.size; const P = W.addPlayer({ id: "devbot" + idx + "_" + r.id, name: "봇" + idx, char: CHAR_IDS[idx % 6], idx, bot: "smart" }, idx); P.bot = "smart"; const q = [...W.P.values()][0]; P.x = q.x + 60 * Math.cos(idx); P.y = q.y + 60 * Math.sin(idx); W.pushOut(P); }
        if (Number(pl.spawn) > 0) { const ps = W.alivePlayers(); const types = Object.keys(MONSTERS).filter(k => MONSTERS[k].t <= Math.max(60, W.t * W.ts)); for (let i = 0; i < Math.min(400, Number(pl.spawn)); i++) { const P = ps[i % ps.length]; const a = Math.random() * Math.PI * 2, d = 250 + Math.random() * 500; W.spawnMon(types[i % types.length], P.x + Math.cos(a) * d, P.y + Math.sin(a) * d); } }
        if (pl.cap) W.party.cap = Math.min(400, Number(pl.cap) || 300);
        if (pl.god) for (const P of W.P.values()) P.god = true;
        if (pl.god === false) for (const P of W.P.values()) P.god = false;
        if (pl.die) for (const P of W.P.values()) { P.god = false; P.iframes = 0; W.hurtPlayer(P, 1e9, { k: "haz" }); if (P.state === "down") { P.state = "dead"; } }
      }
      cb({ ok: true, mons: r.worlds.map(w => w.mons.length) });
    }));
    socket.on("sva:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= SV.lobbyDc - 50) leave(io, r, me.id); }, SV.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("sva:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= SV.lobbyDc - 50) leave(io, r, me.id); }, SV.lobbyDc);
      else if (r.hostUserId === me.id) pickNewHost(r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
addPublicList("survival", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.status !== "lobby" || r.solo) continue; const n = humans(r).length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers, game: r.mode }); } return out; }, { lobbyOf: (uid) => { for (const r of rooms.values()) if (r.hostUserId === uid && r.status === "lobby") return r; return null; } });
export const _svaTest = { rooms, invites, userRoom, SV };
