// =========================
// 플듀 상식 레벨 진단소 — 2~8인 상식왕 대결 (knm:*)
// 모두에게 같은 문항·같은 보기 순서 · 서버 시각 기준 시작/마감 · 답은 서버가 채점
// 라운드 진행 중엔 정답·정오답을 아무에게도 안 보냄(제출 여부만) → 라운드 결과 때 정답·해설·순위 변동 공개
// 대결 점수 = 정확도 × 난이도 × 빠르기(서버가 받은 시각 기준). 개인 상식 진단서(속도 제외 채점)는 끝나고 따로 발급
// 흐름: lobby → [intro → play → result] × N → final
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicList } from "./public-rooms.js";
import * as C from "./know-core.js";
import { STORE } from "./know-store.js";
import { buildPlan, serveAll, revealAll, judgeServed, buildRow, publicRow, normLang, poolFor, localize, caughtOf } from "./know.js";
// 단서(정체를 밝혀라)도 언어별 글자를 같이 실음 → 화면이 내 언어로 골라 씀
const cluesTr = (q, n, base = {}) => { const tr = {}; for (const L of ["ja", "en"]) { const lq = localize(q, L); if (lq) tr[L] = { ...(base[L] || {}), clues: lq.clues.slice(0, n) }; } return tr; };
import { resultId, memberProfile, sanitizeProfile, sanitizePrefs } from "./iq.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const fast = (ms) => (process.env.KNOW_FAST === "1" ? ms * 0.02 : ms);
const FIRST_INTRO_MS = 6000, INTRO_MS = 3200, FINAL_INTRO_MS = 5000, RESULT_MS = 7000, GRACE_MS = 1500;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000;
const joinFails = new Map(), createdBy = new Map();
// 대결 길이: 10라운드(오늘의 챌린지 구성, 무작위) · 15라운드(빠른검사 구성)
export const MULTI = { m10: { ko: "10라운드", base: "daily" }, m15: { ko: "15라운드", base: "quick" }, fresh: { ko: "신작 미니게임 10라운드", base: "fresh" } };
const now = () => Date.now();
const sockRoom = (id) => `knm:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const qOf = (r, i) => STORE.all.get(r.plan[i].id);

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  return { id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null, hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device,
    connected: p.connected, ready: p.ready, host: r.host === uid, pts: p.pts, streak: p.streak || 0,
    status: r.phase === "play" ? (p.rounds[r.round] ? "done" : p.late ? "skip" : "playing") : null };   // 정오답 대신 제출 여부만
}
function pubRoom(r) {
  return {
    id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, mode: r.mode, modeName: MULTI[r.mode].ko, n: r.plan?.length || (MULTI[r.mode].base === "quick" ? 15 : 10),
    plan: r.plan ? r.plan.map((x) => { const q = STORE.all.get(x.id); return { game: q.game, area: q.area, d: q.d }; }) : null,
    phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    nextGame: r.phase === "intro" && r.served ? r.served.pub.game : null,
    item: r.phase === "play" && r.served ? (C.CLUE_KINDS.has(r.served.pub.kind) ? { ...r.served.pub, clues: qOf(r, r.round).clues.slice(0, 1), tr: cluesTr(qOf(r, r.round), 1, r.served.pub.tr) } : r.served.pub) : null,
    roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { groupId: r.final.groupId, players: r.final.players, saved: r.final.saved } : null,
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now(),
  };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("knm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[knm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) {
  clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer);
  ROOMS.delete(r.id); CODES.delete(r.code);
  for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  io.to(sockRoom(r.id)).emit("knm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id));
}
function checkEmpty(io, r) {
  const any = [...r.players.values()].some((p) => p.connected);
  if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS));
}
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) {
  r.players.delete(uid); r.order = r.order.filter((u) => u !== uid);
  if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid);
  if (!r.order.length) return deleteRoom(io, r, "EMPTY");
  if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0];
  if (r.phase === "play") maybeEndRound(io, r);
  emitRoom(io, r);
}
const newPlayer = (name, isGuest, socketId, dev) => ({ name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, st: {}, pts: 0, streak: 0, late: false, dropTimer: null });

function startRound(io, r, i) {
  const q = qOf(r, i);
  r.round = i; r.phase = "intro"; r.served = serveAll(q, r.plan[i].seed);   // 모두 같은 보기 순서
  for (const p of r.players.values()) { p.late = !p.connected; p.st[i] = null; }
  const firstFinal = q.game === "final" && (i === 0 || qOf(r, i - 1).game !== "final");
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : firstFinal ? FINAL_INTRO_MS : INTRO_MS);
  r.startAt = r.phaseEnd; r.deadline = r.startAt + (process.env.KNOW_FAST === "1" ? 400 : r.served.pub.lim + GRACE_MS);
  emitRoom(io, r);
  schedule(r, r.startAt, () => {
    r.phase = "play";
    for (const p of r.players.values()) p.st[i] = { at: r.startAt, clues: C.CLUE_KINDS.has(q.kind) ? 1 : 0 };
    emitRoom(io, r);
    schedule(r, r.deadline, () => endRound(io, r));
  });
}
function maybeEndRound(io, r) {
  if (r.phase !== "play") return;
  if (!r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.rounds[r.round]; })) endRound(io, r);
}
function rankMap(r) {
  const arr = r.order.map((u) => ({ u, pts: r.players.get(u).pts })).sort((a, b) => b.pts - a.pts);
  const m = {}; let rank = 0, prev = null; arr.forEach((x, k) => { if (x.pts !== prev) rank = k + 1; m[x.u] = rank; prev = x.pts; }); return m;
}
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  clearT(r);
  const i = r.round, q = qOf(r, i), sv = r.served, before = rankMap(r);
  for (const u of r.order) {
    const p = r.players.get(u);
    if (!p.rounds[i]) p.rounds[i] = { ...judgeServed(q, sv, null, p.st[i] || { at: r.startAt }, r.startAt + sv.pub.lim + GRACE_MS + 1), bp: 0, missing: true };
    p.streak = p.rounds[i].part >= 1 ? (p.streak || 0) + 1 : 0;
    p.pts = Object.values(p.rounds).reduce((s, x) => s + (x.bp || 0), 0);
  }
  const after = rankMap(r);
  const rows = r.order.map((u) => { const p = r.players.get(u), x = p.rounds[i]; return { id: u, part: x.part, ms: x.ms, timeout: x.timeout, stage: x.stage, bp: x.bp || 0, total: p.pts, rank: after[u], prevRank: before[u], streak: p.streak, choice: p.answers?.[i] ?? null }; })
    .sort((a, b) => b.bp - a.bp || a.ms - b.ms);
  // 보기별 선택 수 (객관식·O/X·지도·가짜 판별): 결과 때만 공개
  const dist = ["mcq", "reveal", "map", "fake", "ox", "case", "where"].includes(q.kind) ? rows.reduce((o, x) => { if (x.choice != null) { const k = String(x.choice); o[k] = (o[k] || 0) + 1; } return o; }, {}) : null;
  r.lastRound = { round: i, item: sv.pub, reveal: revealAll(q, sv), rows, dist, fastest: rows.filter((x) => x.part >= 1).sort((a, b) => a.ms - b.ms)[0]?.id || null };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS);
  emitRoom(io, r);
  schedule(r, r.phaseEnd, () => { if (r.round + 1 < r.plan.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[knm] finish", e)); });
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId(), rank = rankMap(r);
  const rows = [], individual = {}, players = [];
  for (const u of r.order) {
    const p = r.players.get(u);
    const results = r.plan.map((_, i) => { const x = p.rounds[i]; const { bp, missing, ...rest } = x; void bp; void missing; return rest; });
    const prof = p.profile || { nick: p.name, age: null, avatar: { skin: 0, hc: 0, hs: 0, shirt: 0, pants: 0, hat: 0 } };
    const row = buildRow({ id: resultId(), key: p.isGuest ? `g:${u}` : `u:${u}`, me: { isGuest: p.isGuest, id: u }, prof, prefs: p.prefs, mode: "multi", dev: p.device, plan: r.plan, results, isPublic: true, avatarUrl: p.avatarUrl, groupId, flagged: true });
    row.diag.multi = { rank: rank[u], of: r.order.length, pts: p.pts, room: r.mode };
    rows.push(row); individual[u] = publicRow(row, { owner: true });
    players.push({ id: u, resultId: row.id, nick: prof.nick, avatar: prof.avatar, avatarUrl: p.avatarUrl, isGuest: p.isGuest, pts: p.pts, rank: rank[u], total: row.total, lv: row.lv, type: row.diag.type.name, correct: row.correct, n: results.length, streak: row.diag.streak });
  }
  players.sort((a, b) => a.rank - b.rank || b.total - a.total);
  r.final = { groupId, players, individual, saved: false };
  emitRoom(io, r);
  for (const u of r.order) { const p = r.players.get(u); if (p.connected && p.socketId) io.to(p.socketId).emit("knm:mine", individual[u]); }
  if (r.sb) {
    try { const { error } = await r.sb.from("know_results").insert(rows); if (error) console.error("[knm] save", error.message); else { r.final.saved = true; io.to(sockRoom(r.id)).emit("knm:saved", { groupId }); } } catch (e) { console.error("[knm] save", e?.message); }
  }
}

export function registerKnowMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "knm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.KNOW_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    async function applyMember(pl, p) {
      const prof = sanitizeProfile(p.profile), mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; } else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null;
      if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }
    on("knm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("knm:mine", (_p, reply) => { const r = myRoom(); const x = r?.final?.individual?.[me.id]; reply(x ? { ok: true, result: x } : { ok: false, error: "NO_RESULT" }); });

    // 방 만들기: 게스트도 가능 (같은 사람 1분에 5개까지)
    on("knm:create", async (p, reply) => {
      { const _f = createFlight("knm", me?.id, reply); if (!_f) return; reply = _f; } // 방 중복 생성 막기
      const c = (createdBy.get(me.id) || []).filter((t) => now() - t < 60000); if (c.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); c.push(now()); createdBy.set(me.id, c); if (createdBy.size > 20000) createdBy.clear();
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "kn" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, lang: normLang(p.lang), code: genCode(), host: me.id, hostKey: me.isGuest ? `g:${me.id}` : `u:${me.id}`, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), mode: MULTI[p.mode] ? p.mode : "m10", isPublic: p.isPublic === true, plan: null, served: null, phase: "lobby", round: -1, players: new Map(), order: [], phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    // 공개방 목록 (대기 중인 방만, 코드 포함)
    on("knm:list", (_p, reply) => reply({ ok: true, rooms: [...ROOMS.values()].filter((r) => r.isPublic && r.phase === "lobby" && r.order.length < r.maxPlayers).slice(0, 30).map((r) => ({ code: r.code, host: r.players.get(r.host)?.name || "", n: r.order.length, max: r.maxPlayers, mode: MULTI[r.mode].ko })) }));
    on("knm:join", async (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; if (r.phase === "play" && !ex.rounds[r.round]) ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true, mine: r.phase === "play" ? mineNow(r, ex) : null }); return emitRoom(io, r); }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p);
      if (ROOMS.get(r.id) !== r) return reply({ ok: false, error: "NOT_FOUND" }); if (r.players.has(me.id)) return reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" }); if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" }); // 프로필 읽는 사이 동시에 들어온 사람 다시 확인
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    // 재접속 때 내가 이번 라운드에 받은 단서·제출 여부 (정답은 아님)
    const mineNow = (r, pl) => { const st = pl.st[r.round]; const q = qOf(r, r.round); return { submitted: !!pl.rounds[r.round], clues: C.CLUE_KINDS.has(q.kind) && st ? q.clues.slice(0, st.clues) : null, tr: C.CLUE_KINDS.has(q.kind) && st ? cluesTr(q, st.clues) : undefined }; };
    on("knm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; ex.late = false; attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r), mine: r.phase === "play" ? mineNow(r, ex) : null }); emitRoom(io, r);
    });
    on("knm:profile", async (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); await applyMember(pl, p); if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" });
      reply({ ok: true }); emitRoom(io, r);
    });
    on("knm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      if (MULTI[p.mode]) r.mode = p.mode; if (typeof p.isPublic === "boolean") r.isPublic = p.isPublic;
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });
    on("knm:ready", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" });
      pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r);
    });
    on("knm:host", (p, reply) => { const r = myRoom(); if (!r || r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" }); r.host = p.to; reply({ ok: true }); emitRoom(io, r); });
    on("knm:kick", (p, reply) => {
      const r = myRoom(); if (!r || r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" });
      io.to(t.socketId).emit("knm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true });
    });
    on("knm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.length < 2 && process.env.KNOW_SOLO_MULTI !== "1") return reply({ ok: false, error: "NEED_TWO" });
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      try { r.plan = buildPlan(MULTI[r.mode].base, newSeed(), { pool: poolFor(r.lang || "ko") }); } catch (e) { return reply({ ok: false, error: e.message, detail: e.detail || null }); }
      r.final = null; r.lastRound = null;
      for (const p of r.players.values()) { p.rounds = {}; p.st = {}; p.answers = {}; p.pts = 0; p.streak = 0; p.ready = false; }
      reply({ ok: true }); startRound(io, r, 0);
    });
    const curSt = (r) => r.players.get(me.id)?.st?.[r.round] || null;
    on("knm:clue", (p, reply) => {
      const r = myRoom(); if (!r || r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const q = qOf(r, r.round), st = curSt(r); if (!st || !C.CLUE_KINDS.has(q.kind) || r.players.get(me.id).rounds[r.round]) return reply({ ok: false, error: "NOT_PLAYING" });
      st.clues = Math.min(q.clues.length, st.clues + 1); reply({ ok: true, clues: q.clues.slice(0, st.clues), stage: st.clues, tr: cluesTr(q, st.clues) });
    });
    // 상식 캐치!: 하나씩 받기/놓치기 확정 → 그다음 맞는지 공개
    on("knm:catch", (p, reply) => {
      const r = myRoom(); if (!r || r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const q = qOf(r, r.round), st = curSt(r); if (!st || q.kind !== "catch" || r.players.get(me.id).rounds[r.round]) return reply({ ok: false, error: "NOT_PLAYING" });
      const key = r.served.key, k = p.k | 0; if (k < 0 || k >= key.length) return reply({ ok: false, error: "BAD_IDX" });
      st.dec ||= {}; if (st.dec[k] == null) st.dec[k] = !!p.take;
      reply({ ok: true, k, take: st.dec[k], truth: key[k] });
    });
    on("knm:answer", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id); if (pl.rounds[r.round]) return reply({ ok: true, dup: true });
      let ans = p.answer ?? null;
      if (!(ans == null || typeof ans === "number" || typeof ans === "boolean" || (Array.isArray(ans) && ans.length <= 16))) ans = null;
      if (Array.isArray(ans)) ans = ans.map((v) => Number(v) | 0);
      const q = qOf(r, r.round), st0 = curSt(r), res = judgeServed(q, r.served, q.kind === "catch" && st0?.dec ? caughtOf(st0) : ans, st0 || { at: r.startAt });
      res.bp = C.battlePoints(res.part, res.d, res.game, res.ms, res.lim);
      pl.rounds[r.round] = res; (pl.answers ||= {})[r.round] = Array.isArray(ans) ? null : ans;
      reply({ ok: true, submitted: true }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("knm:rematch", (p, reply) => {
      const r = myRoom(); if (!r || r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      if (MULTI[p.mode]) r.mode = p.mode;
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.plan = null; r.served = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); Object.assign(pl, { ready: false, rounds: {}, st: {}, answers: {}, pts: 0, streak: 0, late: false }); if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("knm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r); if (r.phase === "play") maybeEndRound(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _knmTest = { ROOMS, CODES, USER_ROOM };
// 게임천국 공개 방 모아보기용 (knm:list 와 같은 조건)
export const publicKnowRooms = () => [...ROOMS.values()].filter((r) => r.isPublic && r.phase === "lobby" && r.order.length < r.maxPlayers).slice(0, 30).map((r) => ({ code: r.code, host: r.players.get(r.host)?.name || "", n: r.order.length, max: r.maxPlayers }));
addPublicList("know", publicKnowRooms);
