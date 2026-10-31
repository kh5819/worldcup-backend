// =========================
// 게이머 에이징 커브 진단소 — 최대 8인 멀티 (clm:*)
// 서버가 라운드 시작·마감 시각을 정하고(같은 시드), 각자 기록을 제출하면 서버가 채점·순위 확정
// 흐름: lobby → [intro → play → result] × 검사 수 → final
// =========================
import * as C from "./clinic-core.js";
import { judgeSubmit, resultId, publicRow, memberProfile, sanitizePrefs, withI18n, insertResults } from "./clinic.js";

const ROOMS = new Map();       // roomId → room
const CODES = new Map();       // 초대 코드 → roomId
const USER_ROOM = new Map();   // userId → roomId

const MAX_PLAYERS = 8;
const fast = (ms) => (process.env.CLINIC_FAST === "1" ? ms * 0.02 : ms);   // 자동 시험용
const INTRO_MS = 9000;         // 튜토리얼+카운트다운 (마지막 3초가 카운트다운)
const FIRST_INTRO_MS = 12000;
const RESULT_MS = 8000;        // 라운드 순위 공개
const GRACE_MS = 4500;                // 검사 시간 + 네트워크 여유
const LOBBY_DROP_MS = 20000;   // 대기실에서 끊긴 사람 정리
const EMPTY_TTL_MS = 90000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000;   // 초대 코드 무작위 대입 방어 (소켓·사람 기준)
const joinFails = new Map();   // userId → { n, at, until }
const PROGRESS_MS = 700;

const now = () => Date.now();
const sockRoom = (id) => `clm:${id}`;
function genCode() {
  for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; }
  return String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
}
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;

function pubPlayer(r, uid) {
  const p = r.players.get(uid);
  if (!p) return null;
  const cur = r.round >= 0 ? p.rounds[r.round] : null;
  return {
    id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null,
    gender: p.prefs?.shareMulti ? p.profile?.gender || null : null, age: p.prefs?.shareMulti ? p.profile?.age || null : null,
    hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device, connected: p.connected, ready: p.ready,
    host: r.host === uid, total: p.totalSoFar, late: !!p.late,
    status: r.phase === "play" ? (cur ? "done" : p.late ? "skip" : "playing") : null,
    progress: r.phase === "play" ? p.progress : null,
  };
}
function pubRoom(r) {
  return {
    id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, mode: r.mode, tests: r.tests,
    phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    seed: r.phase === "lobby" ? null : r.seeds?.[r.round] ?? null,
    roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { ...r.final, individual: undefined } : null,   // 개인 진단서는 본인에게만 따로
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean),
    serverNow: now(),
  };
}
function emitRoom(io, r) { io.to(sockRoom(r.id)).emit("clm:room", pubRoom(r)); }
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(io, r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[clm] timer", e); } }, Math.max(0, at - now())); }

function deleteRoom(io, r, reason) {
  clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer);
  ROOMS.delete(r.id); CODES.delete(r.code);
  for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  io.to(sockRoom(r.id)).emit("clm:closed", { reason });
  io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id));
}
function checkEmpty(io, r) {
  const any = [...r.players.values()].some((p) => p.connected);
  if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS));
}
function pickHost(r) {
  if (r.players.get(r.host)?.connected) return;
  const next = r.order.find((u) => r.players.get(u)?.connected);
  if (next) r.host = next;
}
function removePlayer(io, r, uid) {
  r.players.delete(uid);
  r.order = r.order.filter((u) => u !== uid);
  if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid);
  if (!r.order.length) return deleteRoom(io, r, "EMPTY");
  if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0];
  if (r.phase === "play") maybeEndRound(io, r);
  emitRoom(io, r);
}

function newPlayer(name, isGuest, socketId, dev) {
  return { name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, totalSoFar: 0, progress: 0, lastProg: 0, late: false, dropTimer: null };
}

// ----- 라운드 진행 -----
function startRound(io, r, i) {
  r.round = i; r.phase = "intro";
  for (const p of r.players.values()) { p.progress = 0; p.late = !p.connected; }
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : INTRO_MS);
  r.startAt = r.phaseEnd;
  r.deadline = r.startAt + C.TESTS[r.tests[i]].dur + GRACE_MS;
  emitRoom(io, r);
  schedule(io, r, r.startAt, () => { r.phase = "play"; emitRoom(io, r); schedule(io, r, r.deadline, () => endRound(io, r)); });
}
function maybeEndRound(io, r) {
  if (r.phase !== "play") return;
  const waiting = r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.rounds[r.round]; });
  if (!waiting) endRound(io, r);
}
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  const tid = r.tests[r.round];
  for (const u of r.order) {
    const p = r.players.get(u);
    if (!p.rounds[r.round]) p.rounds[r.round] = { id: tid, score: 0, m: {}, flags: [], line: p.late ? "불참" : "미제출", missing: true };
    p.totalSoFar = Math.round(r.order.length ? avgScore(p, r) : 0);
  }
  const rows = r.order.map((u) => ({ id: u, score: r.players.get(u).rounds[r.round].score, line: r.players.get(u).rounds[r.round].line, m: r.players.get(u).rounds[r.round].m || {}, flags: r.players.get(u).rounds[r.round].flags }))
    .sort((a, b) => b.score - a.score);
  let rank = 0, prev = null;
  rows.forEach((x, k) => { if (x.score !== prev) rank = k + 1; x.rank = rank; prev = x.score; });
  const overall = r.order.map((u) => ({ id: u, total: r.players.get(u).totalSoFar })).sort((a, b) => b.total - a.total);
  r.lastRound = { round: r.round, test: tid, rows, overall };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS);
  emitRoom(io, r);
  schedule(io, r, r.phaseEnd, () => {
    if (r.round + 1 < r.tests.length) startRound(io, r, r.round + 1);
    else finish(io, r).catch((e) => console.error("[clm] finish", e));
  });
}
function avgScore(p, r) {
  const v = Object.values(p.rounds).map((x) => x.score);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId();
  const people = r.order.map((u) => {
    const p = r.players.get(u);
    const results = {};
    r.tests.forEach((t, i) => { results[t] = p.rounds[i] || { score: 0, m: {}, flags: [] }; });
    const scores = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.score]));
    const total = C.totalScore(scores);
    return { id: u, p, results, total, phys: C.physicalAge(total), age: p.profile?.age || 30 };
  });
  const report = C.groupReport(people, r.tests, C.hashSeed(groupId));
  const rankOf = Object.fromEntries(report.ranking.map((x) => [x.id, x.rank]));
  const rows = [];
  const individual = {};
  for (const x of people) {
    const prof = x.p.profile || { nick: x.p.name, gender: "m", age: 30, avatar: C.defaultAvatar("m", C.hashSeed(x.id)) };
    const dArgs = { results: x.results, age: prof.age, gender: prof.gender, seed: C.hashSeed(groupId + x.id), rank: rankOf[x.id], of: people.length };
    const diag = withI18n(C.diagnose(dArgs), dArgs);
    const id = resultId();
    const row = {
      id, owner_key: x.p.isGuest ? `g:${x.id}` : `u:${x.id}`, user_id: x.p.isGuest ? null : x.id,
      nickname: prof.nick, gender: prof.gender, age: prof.age, avatar: prof.avatar, mode: r.mode, device: x.p.device,
      scores: diag.scores, metrics: Object.fromEntries(Object.entries(x.results).map(([k, v]) => [k, { m: v.m, line: v.line, flags: v.flags }])),
      total: diag.total, phys: diag.phys, diff: diag.diff, diag, is_public: true, flagged: diag.flagged,
      group_id: groupId, rank: rankOf[x.id], rank_of: people.length, created_at: new Date().toISOString(),
      show_gender: x.p.prefs.showGender, show_age: x.p.prefs.showAge, avatar_url: x.p.avatarUrl || null, is_streamer: !!x.p.prefs.streamer,
    };
    rows.push(row);
    individual[x.id] = publicRow(row, { owner: true });
  }
  const playersPub = people.map((x) => {
    const I = individual[x.id], share = !!x.p.prefs.shareMulti;
    return { id: x.id, resultId: I.id, nick: I.nick, gender: share ? I.gender : null, age: share ? I.age : null, avatar: I.avatar, avatarUrl: x.p.avatarUrl || null, isGuest: x.p.isGuest, device: x.p.device,
      total: I.total, phys: I.phys, diff: share ? I.diff : null, title: I.diag.title, type: I.diag.type.name, i18n: I.diag.i18n || null, best: I.diag.best, rank: rankOf[x.id], scores: I.scores };
  });
  r.final = { groupId, report, players: playersPub, individual, saved: false };
  emitRoom(io, r);
  for (const x of people) if (x.p.connected && x.p.socketId) io.to(x.p.socketId).emit("clm:mine", individual[x.id]);
  if (r.sb) {
    try {
      const { error: e1 } = await insertResults(r.sb, rows);
      const { error: e2 } = await r.sb.from("clinic_groups").insert({ id: groupId, host_key: r.hostKey, mode: r.mode, tests: r.tests, players: playersPub, report });
      if (e1 || e2) console.error("[clm] save", e1?.message, e2?.message);
      else { r.final.saved = true; io.to(sockRoom(r.id)).emit("clm:saved", { groupId }); }
    } catch (e) { console.error("[clm] save", e?.message); }
  }
}

export function registerClinicMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "clm:progress" || ev === "clm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 50; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };

    on("clm:time", (_p, reply) => reply({ ok: true, now: now() }));

    // 프로필 적용: 회원은 플레이듀오 프로필 닉네임·이미지가 우선, 성별·나이·캐릭터는 접수 정보
    async function applyMember(pl, p) {
      const prof = C.sanitizeProfile(p.profile);
      const mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; }
      else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null;
      if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }

    // 내 개인 진단서 다시 받기 (재접속·새로고침)
    on("clm:mine", (_p, reply) => {
      const r = myRoom();
      if (!r?.final?.individual?.[me.id]) return reply({ ok: false, error: "NO_RESULT" });
      reply({ ok: true, result: r.final.individual[me.id] });
    });

    on("clm:create", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "GUEST_CANNOT_CREATE" });
      const old = myRoom();
      if (old) removePlayer(io, old, me.id);
      const id = "cl" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = {
        id, code: genCode(), host: me.id, hostKey: `u:${me.id}`, maxPlayers: Math.min(MAX_PLAYERS, Math.max(1, Number(p.maxPlayers) || 8)),
        mode: C.MODES[p.mode] ? p.mode : "quick", tests: null, phase: "lobby", round: -1, players: new Map(), order: [],
        seeds: null, phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin,
      };
      r.tests = C.MODES[r.mode].tests;
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, false, socket.id, p.device === "mobile" ? "mobile" : "pc");
      await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id);
      attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) });
      emitRoom(io, r);
    });

    on("clm:join", async (p, reply) => {
      const jf = joinFails.get(me.id);
      if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim());
      const r = rid ? ROOMS.get(rid) : null;
      if (!r) {
        const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 };
        f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); }
        joinFails.set(me.id, f);
        if (joinFails.size > 20000) joinFails.clear();
        return reply({ ok: false, error: "NO_ROOM" });
      }
      const ex = r.players.get(me.id);
      if (ex) {   // 재접속
        if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
        ex.connected = true; ex.socketId = socket.id;
        if (r.phase === "play" && !ex.rounds[r.round]) ex.late = true;   // 진행 중인 검사는 건너뜀(공정성)
        if (r.phase === "intro") ex.late = false;
        attach(r); checkEmpty(io, r);
        reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true });
        return emitRoom(io, r);
      }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom();
      if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc");
      await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id);
      attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) });
      emitRoom(io, r);
    });

    on("clm:rejoin", (p, reply) => {
      const r = myRoom();
      if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id);
      if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id;
      if (p.device) ex.device = p.device === "mobile" ? "mobile" : "pc";
      if (r.phase === "play" && !ex.rounds[r.round] && !p.inRound) ex.late = true;
      if (r.phase === "intro") ex.late = false;
      attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) });
      emitRoom(io, r);
    });

    on("clm:profile", async (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id);
      await applyMember(pl, p);
      if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" });
      if (p.device) pl.device = p.device === "mobile" ? "mobile" : "pc";
      reply({ ok: true }); emitRoom(io, r);
    });

    on("clm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      if (C.MODES[p.mode]) { r.mode = p.mode; r.tests = C.MODES[p.mode].tests; }
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 1, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });

    on("clm:ready", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id);
      if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" });
      pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r);
    });

    on("clm:host", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" });
      r.host = p.to; reply({ ok: true }); emitRoom(io, r);
    });

    on("clm:kick", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" });
      io.to(t.socketId).emit("clm:kicked", {});
      io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id));
      removePlayer(io, r, p.id);
      reply({ ok: true });
    });

    on("clm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      // 끊겨 있던 사람은 정리
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.seeds = r.tests.map(() => newSeed());
      r.final = null; r.lastRound = null;
      for (const p of r.players.values()) { p.rounds = {}; p.totalSoFar = 0; p.ready = false; }
      reply({ ok: true });
      startRound(io, r, 0);
    });

    on("clm:progress", (p) => {
      const r = myRoom(); if (!r || r.phase !== "play") return;
      const pl = r.players.get(me.id); const t = now();
      if (t - pl.lastProg < PROGRESS_MS) return;
      pl.lastProg = t; pl.progress = Math.max(0, Math.min(100, Math.round(Number(p.v) || 0)));
      socket.to(sockRoom(r.id)).emit("clm:prog", { id: me.id, v: pl.progress, s: String(p.s || "").slice(0, 16) });
    });

    on("clm:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id);
      if (pl.late) return reply({ ok: false, error: "LATE" });
      if (pl.rounds[r.round]) return reply({ ok: true, result: pl.rounds[r.round], dup: true });
      const res = judgeSubmit(r.tests[r.round], r.seeds[r.round], p.log, pl.device, now() - r.startAt);
      pl.rounds[r.round] = res;
      reply({ ok: true, result: res });
      emitRoom(io, r);
      maybeEndRound(io, r);
    });

    // 재대결(같은 사람·같은 모드) / 새 검사(모드 바꿔 대기실로)
    on("clm:rematch", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      if (C.MODES[p.mode]) { r.mode = p.mode; r.tests = C.MODES[p.mode].tests; }
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.seeds = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.rounds = {}; pl.totalSoFar = 0; pl.late = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });

    on("clm:leave", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: true });
      socket.leave(sockRoom(r.id));
      removePlayer(io, r, me.id);
      reply({ ok: true });
    });

    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const pl = r.players.get(me.id);
      if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") {
        pl.ready = false;
        pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS);
      }
      pickHost(r);
      if (r.phase === "play") maybeEndRound(io, r);
      checkEmpty(io, r);
      emitRoom(io, r);
    });
  });
}

// 시험용
export const _test = { ROOMS, CODES, USER_ROOM, consts: { INTRO_MS, FIRST_INTRO_MS, RESULT_MS, GRACE_MS } };
