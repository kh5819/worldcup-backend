// =========================
// 플듀 비밀 진단소 — 친구와 함께 2~8인 (bl:*)
// 같은 진단실을 모두 같은 순서·같은 시드(같은 상황·같은 질문)로 동시에 진행 → 미니게임마다 서로 결과 비교 → 마지막에 진단 결과·시상식
// 흐름: lobby → [play(각자 미니게임) → result(이번 게임 비교)] × 게임 수 → final(시상식) → (다시 하기) lobby
// 점수 계산은 화면(진단실 플러그인)이 함 — 오락용 파티 게임이라 DB 저장 없음, 메모리에만 (서버 재시작 시 방 사라짐)
// 상태 전환은 서버만. 허용 안 된 요청은 거절
// =========================
import { createFlight } from "./create-flight.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const LAB_ROOMS = { perv: 6, psycho: 6 };   // 진단실 id → 미니게임 수 (진단실 열릴 때 여기 추가)
const fast = (ms) => (process.env.BTLAB_FAST === "1" ? ms * 0.02 : ms);
const PLAY_MS = 200000, RESULT_MS = 9000, FINAL_WAIT_MS = 8000, LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000; const joinFails = new Map();
const now = () => Date.now();
const sockRoom = (id) => `bl:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const cleanTxt = (s, n) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const clampN = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
// 화면이 보낸 미니게임 결과 정리 (지표 이름은 영문 소문자만, 값 0~100)
function cleanRound(p) {
  const stats = {}; let n = 0; for (const [k, v] of Object.entries(p?.stats || {})) { if (!/^[a-z]{2,12}$/.test(k) || n >= 8) continue; stats[k] = clampN(v); n++; }
  return { stats, line: cleanTxt(p?.line, 60), win: !!p?.win, ev: (Array.isArray(p?.ev) ? p.ev : []).slice(0, 2).map((e) => cleanTxt(e, 60)).filter(Boolean) };
}
function cleanFinal(p) {
  const bars = (Array.isArray(p?.bars) ? p.bars : []).slice(0, 6).map((b) => [cleanTxt(b?.[0], 10), clampN(b?.[1])]).filter((b) => b[0]);
  return { main: clampN(p?.main), title: cleanTxt(p?.title, 30), bars };
}
const newPlayer = (name, isGuest, socketId) => ({ name: cleanTxt(name, 12) || "참가자", isGuest, socketId, connected: true, ready: false, rounds: {}, final: null, wins: 0, dropTimer: null });

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  return { id: uid, nick: p.name, connected: p.connected, ready: p.ready, host: r.host === uid, wins: p.wins, done: r.phase === "play" ? !!p.rounds[r.round] : null };
}
function pubRoom(r) {
  return { id: r.id, code: r.code, host: r.host, lab: r.lab, games: r.games, maxPlayers: r.maxPlayers, phase: r.phase, round: r.round, phaseEnd: r.phaseEnd,
    seed: r.phase === "lobby" ? null : r.seeds?.[r.round] ?? null, roundResult: r.phase === "result" ? r.lastRound : null, final: r.phase === "final" ? r.final : null,
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now() };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("bl:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[bl] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) { clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer); for (const p of r.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer); ROOMS.delete(r.id); CODES.delete(r.code); for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u); io.to(sockRoom(r.id)).emit("bl:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id)); }
function checkEmpty(io, r) { const any = [...r.players.values()].some((p) => p.connected); if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; } if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS)); }
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) { const p = r.players.get(uid); if (p?.dropTimer) clearTimeout(p.dropTimer); r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid); if (!r.order.length) return deleteRoom(io, r, "EMPTY"); if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0]; if (r.phase === "play") maybeEndRound(io, r); if (r.phase === "final") maybeFinish(io, r); emitRoom(io, r); }

// ----- 진행 -----
function startRound(io, r, i) {
  r.round = i; r.phase = "play"; r.phaseEnd = now() + fast(PLAY_MS); emitRoom(io, r);
  schedule(r, r.phaseEnd, () => endRound(io, r));
}
const waiting = (r, test) => r.order.some((u) => { const p = r.players.get(u); return p.connected && !test(p); });
function maybeEndRound(io, r) { if (r.phase === "play" && !waiting(r, (p) => p.rounds[r.round])) endRound(io, r); }
function endRound(io, r) {
  if (r.phase !== "play") return; clearT(r);
  const rows = r.order.map((u) => { const p = r.players.get(u), x = p.rounds[r.round]; return { id: u, nick: p.name, line: x ? x.line : "참가 못 함", win: !!x?.win, missing: !x, ev: x?.ev || [] }; });
  for (const x of rows) if (x.win) r.players.get(x.id).wins++;
  r.lastRound = { round: r.round, rows };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS); emitRoom(io, r);
  schedule(r, r.phaseEnd, () => (r.round + 1 < r.games ? startRound(io, r, r.round + 1) : startFinal(io, r)));
}
function startFinal(io, r) { r.phase = "final"; r.final = null; r.phaseEnd = now() + fast(FINAL_WAIT_MS); emitRoom(io, r); schedule(r, r.phaseEnd, () => finish(io, r)); maybeFinish(io, r); }
function maybeFinish(io, r) { if (r.phase === "final" && !r.final && !waiting(r, (p) => p.final)) finish(io, r); }
// 시상식: 대표 점수 순위 + 지표별 1위 + 미니게임 승리 수 1위
function finish(io, r) {
  if (r.phase !== "final" || r.final) return; clearT(r);
  const rows = r.order.map((u) => { const p = r.players.get(u); return { id: u, nick: p.name, main: p.final?.main ?? null, title: p.final?.title || "", bars: p.final?.bars || [], wins: p.wins }; });
  const scored = rows.filter((x) => x.main != null).sort((a, b) => b.main - a.main);
  let rank = 0, prev = null; scored.forEach((x, k) => { if (x.main !== prev) rank = k + 1; x.rank = rank; prev = x.main; });
  const awards = []; const names = scored[0]?.bars.map((b) => b[0]) || [];
  names.forEach((nm, i) => { let best = null; for (const x of scored) { const v = x.bars[i]?.[1]; if (v != null && (!best || v > best.v)) best = { id: x.id, nick: x.nick, v }; } if (best && best.v > 0) awards.push({ title: `${nm} 1위`, id: best.id, nick: best.nick, v: best.v }); });
  const mw = [...rows].sort((a, b) => b.wins - a.wins)[0]; if (mw && mw.wins > 0) awards.push({ title: "미니게임 최다 승리", id: mw.id, nick: mw.nick, v: mw.wins });
  const low = scored[scored.length - 1]; if (scored.length >= 2 && low) awards.push({ title: "이 방의 청정 구역", id: low.id, nick: low.nick, v: low.main });
  r.final = { rows: [...scored, ...rows.filter((x) => x.main == null)], awards };
  r.phaseEnd = null; emitRoom(io, r);
}

export function registerBtlabMulti(io) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "bl:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.BTLAB_RL || 40); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    on("bl:time", (_p, reply) => reply({ ok: true, now: now() }));
    // 방 만들기: 게스트도 가능 (DB에 아무것도 안 씀) · 중복 생성 막기
    on("bl:create", (p, reply) => {
      { const _f = createFlight("bl", me?.id, reply); if (!_f) return; reply = _f; }
      const lab = LAB_ROOMS[p.lab] ? p.lab : null; if (!lab) return reply({ ok: false, error: "BAD_LAB" });
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "bl" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, code: genCode(), host: me.id, lab, games: LAB_ROOMS[lab], maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), phase: "lobby", round: -1, players: new Map(), order: [], seeds: null, phaseEnd: null, lastRound: null, final: null, timer: null, emptyTimer: null };
      ROOMS.set(id, r); CODES.set(r.code, id);
      r.players.set(me.id, newPlayer(p.name, !!me.isGuest, socket.id)); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("bl:join", (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); return emitRoom(io, r); }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      r.players.set(me.id, newPlayer(p.name, !!me.isGuest, socket.id)); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("bl:rejoin", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id); if (!ex) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("bl:name", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const n = cleanTxt(p.name, 12); if (!n) return reply({ ok: false, error: "BAD_NAME" }); r.players.get(me.id).name = n; reply({ ok: true }); emitRoom(io, r); });
    on("bl:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      if (p.lab && LAB_ROOMS[p.lab]) { r.lab = p.lab; r.games = LAB_ROOMS[p.lab]; }
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });
    on("bl:ready", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); r.players.get(me.id).ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("bl:kick", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" }); io.to(t.socketId).emit("bl:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true }); });
    on("bl:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.length < 2) return reply({ ok: false, error: "NEED_TWO" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.seeds = Array.from({ length: r.games }, () => newSeed()); r.final = null; r.lastRound = null;
      for (const p of r.players.values()) { p.rounds = {}; p.final = null; p.wins = 0; p.ready = false; }
      reply({ ok: true }); startRound(io, r, 0);
    });
    on("bl:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id); if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (pl.rounds[r.round]) return reply({ ok: true, dup: true });
      pl.rounds[r.round] = cleanRound(p); reply({ ok: true }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("bl:final", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "final" || r.final) return reply({ ok: false, error: "NOT_FINAL" });
      const pl = r.players.get(me.id); if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (!pl.final) pl.final = cleanFinal(p);
      reply({ ok: true }); maybeFinish(io, r);
    });
    on("bl:rematch", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "final" || !r.final) return reply({ ok: false, error: "NOT_FINAL" });
      if (p.lab && LAB_ROOMS[p.lab]) { r.lab = p.lab; r.games = LAB_ROOMS[p.lab]; }
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.seeds = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.rounds = {}; pl.final = null; pl.wins = 0; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("bl:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return; const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r); if (r.phase === "play") maybeEndRound(io, r); if (r.phase === "final") maybeFinish(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _blTest = { ROOMS, CODES, USER_ROOM, LAB_ROOMS };
