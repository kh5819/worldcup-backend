// =========================
// 심리테스트·빙고 — 친구와 함께 2~8인 (tm:*)
// 같은 심리테스트(또는 빙고판)를 모두 동시에 시작 → 각자 자기 속도로 풀기(진행률은 서로 보임) → 다 끝나면 결과 비교
//  · 심리테스트: 각자 결과 유형 + 문항별 답 → 같은 답 비율로 '찰떡 짝꿍' 계산
//  · 빙고: 각자 체크한 칸·빙고 줄 수 → 칸별 몇 명 체크했는지(우리 방 공통 칸) · 최다 빙고
// 흐름: lobby → play → result → (한 판 더) lobby. 결과 계산·저장은 화면이 하고 서버는 모아서 나눠 줌 (DB 쓰지 않음, 메모리)
// 입장: 링크(?room=코드)로 들어오면 바로 대기실. 게스트도 방 만들기·입장 가능
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicList } from "./public-rooms.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8, KINDS = new Set(["ptest", "bingo"]);
const PLAY_MS = 20 * 60 * 1000, LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 120000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000; const joinFails = new Map();
const now = () => Date.now();
const sockRoom = (id) => `tm:${id}`;
const cleanTxt = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const okId = (s) => /^[A-Za-z0-9_-]{1,64}$/.test(String(s || ""));
const okThumb = (u) => (/^https:\/\/[^\s"<>]{5,490}$/.test(String(u || "")) ? String(u) : null);   // 공개방 카드 썸네일 (https 주소만)
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const intList = (a, max, n) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x >= 0 && x <= max);
// 화면이 보낸 결과 정리
function cleanResult(kind, p) {
  if (kind === "ptest") return { resultIdx: Math.max(0, Math.min(99, parseInt(p?.resultIdx, 10) || 0)), title: cleanTxt(p?.title, 40), answers: intList(p?.answers, 9, 200) };
  return { checked: [...new Set(intList(p?.checked, 48, 49))], half: [...new Set(intList(p?.half, 48, 49))], lines: Math.max(0, Math.min(20, parseInt(p?.lines, 10) || 0)) };
}
const newPlayer = (name, isGuest, socketId) => ({ name: cleanTxt(name, 12) || "참가자", isGuest, socketId, connected: true, ready: false, progress: 0, result: null, dropTimer: null });

function pubRoom(r) {
  return { id: r.id, code: r.code, kind: r.kind, contentId: r.contentId, title: r.title, host: r.host, maxPlayers: r.maxPlayers, phase: r.phase, isPublic: !!r.isPublic, round: r.round, startedAt: r.startedAt,
    players: r.order.map((u) => { const p = r.players.get(u); return p && { id: u, nick: p.name, connected: p.connected, ready: p.ready, host: r.host === u, progress: p.progress, done: !!p.result }; }).filter(Boolean),
    results: r.phase === "result" ? r.order.map((u) => { const p = r.players.get(u); return p?.result ? { id: u, nick: p.name, ...p.result } : null; }).filter(Boolean) : null, serverNow: now() };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("tm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function deleteRoom(io, r, reason) { clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer); for (const p of r.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer); ROOMS.delete(r.id); CODES.delete(r.code); for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u); io.to(sockRoom(r.id)).emit("tm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id)); }
function checkEmpty(io, r) { const any = [...r.players.values()].some((p) => p.connected); if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; } if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, EMPTY_TTL_MS); }
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) { const p = r.players.get(uid); if (p?.dropTimer) clearTimeout(p.dropTimer); r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid); if (!r.order.length) return deleteRoom(io, r, "EMPTY"); if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0]; maybeFinish(io, r); emitRoom(io, r); }
// 연결된 사람이 모두 결과를 냈으면 결과 단계로
function maybeFinish(io, r) { if (r.phase !== "play") return; const live = r.order.map((u) => r.players.get(u)).filter((p) => p.connected); if (live.length && live.every((p) => p.result)) finish(io, r); }
function finish(io, r) { if (r.phase !== "play") return; clearT(r); r.phase = "result"; emitRoom(io, r); }

export function registerTestsMulti(io) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "tm:progress") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 40; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    on("tm:create", (p, reply) => {
      { const _f = createFlight("tm", me?.id, reply); if (!_f) return; reply = _f; }
      if (!KINDS.has(p.kind) || !okId(p.contentId)) return reply({ ok: false, error: "BAD_CONTENT" });
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "tm" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, code: genCode(), kind: p.kind, contentId: String(p.contentId), title: cleanTxt(p.title, 60), thumb: okThumb(p.thumb), isPublic: false, host: me.id, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), phase: "lobby", round: 0, startedAt: null, players: new Map(), order: [], timer: null, emptyTimer: null };
      ROOMS.set(id, r); CODES.set(r.code, id);
      r.players.set(me.id, newPlayer(p.name, !!me.isGuest, socket.id)); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("tm:join", (p, reply) => {
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
    on("tm:name", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); const n = cleanTxt(p.name, 12); if (!n) return reply({ ok: false, error: "BAD_NAME" }); r.players.get(me.id).name = n; reply({ ok: true }); emitRoom(io, r); });
    on("tm:options", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers)); reply({ ok: true }); emitRoom(io, r); });   // 값 없이 부르면 방 정보만 다시 보냄 (공개방 켠 뒤)
    on("tm:ready", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); r.players.get(me.id).ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("tm:kick", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" }); io.to(t.socketId).emit("tm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true }); });
    on("tm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected); if (live.length < 2) return reply({ ok: false, error: "NEED_TWO" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      for (const p of r.players.values()) { p.result = null; p.progress = 0; p.ready = false; }
      r.phase = "play"; r.round++; r.startedAt = now(); clearT(r); r.timer = setTimeout(() => finish(io, r), PLAY_MS);
      reply({ ok: true }); emitRoom(io, r);
    });
    on("tm:progress", (p) => { const r = myRoom(); if (!r || r.phase !== "play") return; const pl = r.players.get(me.id); if (!pl || pl.result) return; const v = Math.max(0, Math.min(100, Math.round(Number(p.v) || 0))); if (v === pl.progress) return; pl.progress = v; emitRoom(io, r); });
    on("tm:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id); if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (pl.result) return reply({ ok: true, dup: true });
      pl.result = cleanResult(r.kind, p); pl.progress = 100; reply({ ok: true }); emitRoom(io, r); maybeFinish(io, r);
    });
    on("tm:end", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); finish(io, r); reply({ ok: true }); });   // 방장: 기다리지 않고 결과 보기
    on("tm:rematch", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "result") return reply({ ok: false, error: "NOT_RESULT" });
      r.phase = "lobby"; clearT(r); for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.result = null; pl.progress = 0; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("tm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return; const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      // 방장 넘김은 8초 기다렸다가: 시작할 때 화면을 새로 고치느라 잠깐 끊기는 것 때문에 방장이 바뀌지 않게
      setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.players.get(me.id) && !rr.players.get(me.id).connected) { pickHost(rr); emitRoom(io, rr); } }, 8000);
      maybeFinish(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _tmTest = { ROOMS, CODES, USER_ROOM };
// 메인 「🌐 공개방」: 방장이 대기실에서 켠 방만 (대기 중 · 자리 남은 방) — 입장 링크에 콘텐츠 id(cid) 필요
for (const kind of KINDS) addPublicList(kind, () => {
  const out = [];
  for (const r of ROOMS.values()) {
    if (r.kind !== kind || !r.isPublic || r.phase !== "lobby" || r.order.length >= r.maxPlayers) continue;
    out.push({ code: r.code, host: r.players.get(r.host)?.name || "", n: r.order.length, max: r.maxPlayers, title: r.title, thumb: r.thumb || undefined, cid: r.contentId });
  }
  return out;
}, { lobbyOf: (uid) => { const id = USER_ROOM.get(uid), r = id && ROOMS.get(id); return r && r.kind === kind && r.host === uid && r.phase === "lobby" ? r : null; } });
