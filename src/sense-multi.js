// =========================
// 플듀 게임 센스 진단소 — 최대 8인 멀티 (sm:*)
// 모두 같은 시드의 같은 문제를 같은 시각에 시작 → 각자 기록 제출 → 서버가 채점(sense.js judgeSubmit)·순위 확정
// 흐름: lobby → [intro(설명+카운트다운) → play → result] × 검사 수 → final(시상식·개인 진단서)
// 실시간 방 구조는 게이머 에이징 커브 단체 검사(clinic-multi.js)와 같음
// =========================
import * as C from "./sense-core.js";
import { judgeSubmit, buildRow, publicRow, insertResults } from "./sense.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId } from "./iq.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const fast = (ms) => (process.env.SENSE_FAST === "1" ? ms * 0.02 : ms);
const INTRO_MS = 11000, FIRST_INTRO_MS = 14000, RESULT_MS = 8000, GRACE_MS = 5000;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000, PROGRESS_MS = 700;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000; const joinFails = new Map();
const now = () => Date.now();
const sockRoom = (id) => `sm:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  const cur = r.round >= 0 ? p.rounds[r.round] : null;
  return { id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null, age: p.prefs?.shareMulti ? p.profile?.age || null : null, best: p.best || null, rankTrail: p.rankTrail || [],
    hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device, connected: p.connected, ready: p.ready, host: r.host === uid, total: p.totalSoFar, late: !!p.late,
    status: r.phase === "play" ? (cur ? "done" : p.late ? "skip" : "playing") : null, progress: r.phase === "play" ? p.progress : null };
}
function pubRoom(r) {
  return { id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, mode: r.mode, tests: r.tests, phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    seed: r.phase === "lobby" ? null : r.seeds?.[r.round] ?? null, roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { ...r.final, individual: undefined } : null, players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now() };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("sm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[sm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) { clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer); ROOMS.delete(r.id); CODES.delete(r.code); for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u); io.to(sockRoom(r.id)).emit("sm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id)); }
function checkEmpty(io, r) { const any = [...r.players.values()].some((p) => p.connected); if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; } if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS)); }
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) { r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid); if (!r.order.length) return deleteRoom(io, r, "EMPTY"); if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0]; if (r.phase === "play") maybeEndRound(io, r); emitRoom(io, r); }
async function bestOf(sb, uid, isGuest) {   // 그 사람의 공식 최고 기록 (의심 기록 제외)
  if (!sb) return null;
  try { const { data } = await sb.from("sense_results").select("total, tier, mode").eq("owner_key", isGuest ? `g:${uid}` : `u:${uid}`).eq("flagged", false).order("total", { ascending: false }).limit(1).maybeSingle(); return data ? { total: data.total, tier: data.tier, mode: data.mode } : null; } catch { return null; }
}
const newPlayer = (name, isGuest, socketId, dev) => ({ name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, totalSoFar: 0, progress: 0, lastProg: 0, late: false, dropTimer: null });

// ----- 라운드 -----
function startRound(io, r, i) {
  r.round = i; r.phase = "intro";
  for (const p of r.players.values()) { p.progress = 0; p.late = !p.connected; }
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : INTRO_MS); r.startAt = r.phaseEnd;
  r.deadline = r.startAt + fast(C.TESTS[r.tests[i]].dur) + GRACE_MS;
  emitRoom(io, r);
  schedule(r, r.startAt, () => { r.phase = "play"; emitRoom(io, r); schedule(r, r.deadline, () => endRound(io, r)); });
}
function maybeEndRound(io, r) { if (r.phase !== "play") return; if (!r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.rounds[r.round]; })) endRound(io, r); }
function runningTotal(p, r) { const sc = {}; r.tests.forEach((t, i) => { if (p.rounds[i]) sc[t] = p.rounds[i].score; }); return Object.keys(sc).length ? C.totalOf(sc) : 0; }
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  const tid = r.tests[r.round];
  for (const u of r.order) { const p = r.players.get(u); if (!p.rounds[r.round]) p.rounds[r.round] = { id: tid, score: 0, m: {}, flags: [], missing: true, why: p.late ? "불참" : "미제출" }; p.totalSoFar = runningTotal(p, r); }
  const rows = r.order.map((u) => { const x = r.players.get(u).rounds[r.round]; return { id: u, score: x.score, m: x.m || {}, flags: x.flags, missing: !!x.missing }; }).sort((a, b) => b.score - a.score);
  let rank = 0, prev = null; rows.forEach((x, k) => { if (x.score !== prev) rank = k + 1; x.rank = rank; prev = x.score; });
  const overall = r.order.map((u) => ({ id: u, total: r.players.get(u).totalSoFar })).sort((a, b) => b.total - a.total);
  overall.forEach((x, i) => { const p = r.players.get(x.id); const before = p.rankTrail?.length ? p.rankTrail[p.rankTrail.length - 1] : null; x.rank = i + 1; x.delta = before ? before - x.rank : 0; p.rankTrail = [...(p.rankTrail || []), x.rank]; });
  const titles = [];
  if (rows[0] && rows[0].score > 0 && !rows[0].missing) titles.push({ id: rows[0].id, title: ROUND_TITLE[tid] || "이번 라운드 1위", value: rows[0].score });
  const climb = [...overall].sort((a, b) => b.delta - a.delta)[0]; if (climb && climb.delta >= 2 && r.round > 0) titles.push({ id: climb.id, title: "이번 라운드 최대 순위 상승!", value: climb.delta });
  r.lastRound = { round: r.round, test: tid, rows, overall, titles };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS); emitRoom(io, r);
  schedule(r, r.phaseEnd, () => { if (r.round + 1 < r.tests.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[sm] finish", e)); });
}
const ROUND_TITLE = { minimap: "미니맵 수호자", engage: "교전 판단왕", target: "타깃 저격수", cooldown: "쿨타임 장인", boss: "보스 패턴 해독자", vision: "시야 기억왕", resource: "자원 관리의 달인", multitask: "멀티태스킹 사령관", path: "길잡이", teamfight: "한타의 지배자", fake: "페이크 간파왕", overload: "정보 필터 마스터", comeback: "역전의 한 수", team: "팀워크 마스터", final: "최종 보스 슬레이어" };
/** 시상식: MVP · 특별상(실제 검사 기록 기준) · 꾸준함 · 역전의 주인공 · 검사별 최고점 */
export function groupReport(people, tests) {
  const ranking = [...people].sort((a, b) => b.total - a.total).map((x, i, arr) => ({ id: x.id, total: x.total, rank: arr.findIndex((y) => y.total === x.total) + 1 }));
  const awards = [];
  if (people.length) awards.push({ key: "mvp", title: "MVP", desc: "가장 높은 게임 센스", id: ranking[0].id, value: ranking[0].total });
  // 특별상: 정해진 능력·검사 점수가 가장 높은 사람 (동점이면 총점 높은 사람)
  const SPECIAL = [["strat", "최고의 전략가", "area"], ["minimap", "미니맵 수호자", "test"], ["crisis", "위기 탈출왕", "area"], ["teamfight", "한타의 지배자", "test"], ["combat", "한타의 지배자", "area"], ["resource", "자원 관리의 달인", "test"], ["team", "팀워크 마스터", "test"], ["info", "정보 처리의 신", "area"], ["multi", "멀티태스킹 사령관", "area"], ["situ", "상황 판단의 달인", "area"]];
  const given = new Set();
  for (const [k, title, kind] of SPECIAL) {
    if (given.has(title)) continue; if (kind === "test" && !tests.includes(k)) continue;
    const val = (x) => (kind === "area" ? x.areas[k] : x.scores[k]) ?? -1;
    const top = [...people].sort((x, y) => val(y) - val(x) || y.total - x.total)[0]; if (!top || val(top) < 15) continue;   // 너무 낮은 점수로 주는 상은 어색하므로 15점 이상만
    awards.push({ key: k, title, desc: kind === "area" ? C.AREA_NAME[k] : C.TESTS[k].name, id: top.id, value: val(top) }); given.add(title);
  }
  if (people.length >= 2) { const sd = (x) => { const v = tests.map((t) => x.scores[t] ?? 0), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); }; const st = [...people].sort((a, b) => sd(a) - sd(b))[0]; awards.push({ key: "steady", title: "꾸준함 상", desc: "검사마다 점수 차이가 가장 적음", id: st.id, value: Math.round(sd(st)) }); }
  // 역전의 주인공: 첫 라운드 종합 순위보다 최종 순위가 가장 많이 오른 사람
  const climb = people.filter((x) => x.trail?.length >= 2).map((x) => ({ id: x.id, up: x.trail[0] - (ranking.find((r) => r.id === x.id)?.rank ?? x.trail[0]) })).sort((a, b) => b.up - a.up)[0];
  if (climb && climb.up >= 2) awards.push({ key: "comeback", title: "역전의 주인공", desc: "첫 라운드보다 순위가 가장 많이 오름", id: climb.id, value: climb.up });
  const tops = tests.map((t) => { const b = [...people].sort((x, y) => (y.scores[t] ?? 0) - (x.scores[t] ?? 0))[0]; return { test: t, id: b?.id, value: b?.scores[t] ?? 0 }; });
  return { ranking, awards, tops };
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId(), rows = [], individual = {};
  const people = r.order.map((u) => { const p = r.players.get(u); const plan = r.tests.map((t, i) => ({ id: t, seed: r.seeds[i] })); const results = r.tests.map((t, i) => p.rounds[i] || { id: t, score: 0, m: {}, flags: [] }); const scores = Object.fromEntries(r.tests.map((t, i) => [t, results[i].score])); return { id: u, p, plan, results, scores, total: C.totalOf(scores), areas: C.areaScores(scores), trail: p.rankTrail || [] }; });
  const report = groupReport(people, r.tests), rankOf = Object.fromEntries(report.ranking.map((x) => [x.id, x.rank]));
  for (const x of people) {
    const prof = x.p.profile || { nick: x.p.name, age: null, avatar: {} };
    const me = { id: x.id, isGuest: x.p.isGuest };
    const row = buildRow({ id: resultId(), key: x.p.isGuest ? `g:${x.id}` : `u:${x.id}`, me, prof, prefs: x.p.prefs, mode: r.mode, dev: x.p.device, plan: x.plan, results: x.results, rank: rankOf[x.id], of: people.length, groupId, isPublic: true, avatarUrl: x.p.avatarUrl });
    rows.push(row); individual[x.id] = publicRow(row, { owner: true });
  }
  const playersPub = people.map((x) => { const I = individual[x.id]; return { id: x.id, resultId: I.id, nick: I.nick, avatar: I.avatar, avatarUrl: I.avatarUrl, isGuest: x.p.isGuest, device: x.p.device, total: I.total, tier: I.tier, style: I.style, areas: I.areas, scores: I.scores, rank: rankOf[x.id], flagged: I.flagged }; });
  r.final = { groupId, report, players: playersPub, individual, saved: false };
  emitRoom(io, r);
  for (const x of people) if (x.p.connected && x.p.socketId) io.to(x.p.socketId).emit("sm:mine", individual[x.id]);
  if (r.sb) {
    try {
      const { error: e1 } = await insertResults(r.sb, rows);
      const { error: e2 } = await r.sb.from("sense_groups").insert({ id: groupId, host_key: r.hostKey, mode: r.mode, players: playersPub, report });
      if (e1 || e2) console.error("[sm] save", e1?.message, e2?.message); else { r.final.saved = true; io.to(sockRoom(r.id)).emit("sm:saved", { groupId }); }
    } catch (e) { console.error("[sm] save", e?.message); }
  }
}

export function registerSenseMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "sm:progress" || ev === "sm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.SENSE_RL || 50); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    async function applyMember(pl, p) {   // 회원 = 플레이듀오 프로필 닉네임·사진 우선
      const prof = sanitizeProfile(p.profile), mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; } else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null; if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }
    on("sm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("sm:mine", (_p, reply) => { const r = myRoom(); if (!r?.final?.individual?.[me.id]) return reply({ ok: false, error: "NO_RESULT" }); reply({ ok: true, result: r.final.individual[me.id] }); });
    on("sm:create", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "GUEST_CANNOT_CREATE" });
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "sm" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, code: genCode(), host: me.id, hostKey: `u:${me.id}`, maxPlayers: Math.min(MAX_PLAYERS, Math.max(1, Number(p.maxPlayers) || 8)), mode: C.MODES[p.mode] ? p.mode : "quick", tests: null, phase: "lobby", round: -1, players: new Map(), order: [], seeds: null, phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin };
      r.tests = C.MODES[r.mode].tests; ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, false, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p); pl.best = await bestOf(supabaseAdmin, me.id, false);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("sm:join", async (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; if (r.phase === "play" && !ex.rounds[r.round]) ex.late = true; if (r.phase === "intro") ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); return emitRoom(io, r); }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p); pl.best = await bestOf(supabaseAdmin, me.id, !!me.isGuest);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("sm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; if (p.device) ex.device = p.device === "mobile" ? "mobile" : "pc";
      if (r.phase === "play" && !ex.rounds[r.round] && !p.inRound) ex.late = true;   // 진행 중인 검사는 건너뜀 (공정성)
      if (r.phase === "intro") ex.late = false;
      attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("sm:profile", async (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" }); const pl = r.players.get(me.id); await applyMember(pl, p); if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" }); if (p.device) pl.device = p.device === "mobile" ? "mobile" : "pc"; reply({ ok: true }); emitRoom(io, r); });
    on("sm:options", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); if (C.MODES[p.mode]) { r.mode = p.mode; r.tests = C.MODES[p.mode].tests; } if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 1, Number(p.maxPlayers) || r.maxPlayers)); reply({ ok: true }); emitRoom(io, r); });
    on("sm:ready", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const pl = r.players.get(me.id); if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" }); pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("sm:host", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" }); r.host = p.to; reply({ ok: true }); emitRoom(io, r); });
    on("sm:kick", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" }); io.to(t.socketId).emit("sm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true }); });
    on("sm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.seeds = r.tests.map(() => newSeed()); r.final = null; r.lastRound = null;
      for (const p of r.players.values()) { p.rounds = {}; p.totalSoFar = 0; p.ready = false; p.rankTrail = []; }
      reply({ ok: true }); startRound(io, r, 0);
    });
    on("sm:progress", (p) => { const r = myRoom(); if (!r || r.phase !== "play") return; const pl = r.players.get(me.id), t = now(); if (!pl || t - pl.lastProg < PROGRESS_MS) return; pl.lastProg = t; pl.progress = Math.max(0, Math.min(100, Math.round(Number(p.v) || 0))); socket.to(sockRoom(r.id)).emit("sm:prog", { id: me.id, v: pl.progress, s: String(p.s || "").slice(0, 24) }); });
    on("sm:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id); if (pl.late) return reply({ ok: false, error: "LATE" });
      if (pl.rounds[r.round]) return reply({ ok: true, result: pl.rounds[r.round], dup: true });
      const res = judgeSubmit(r.tests[r.round], r.seeds[r.round], p.log, now() - r.startAt + (process.env.SENSE_FAST === "1" ? 1e9 : 0));
      pl.rounds[r.round] = res; reply({ ok: true, result: res }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("sm:rematch", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      if (C.MODES[p.mode]) { r.mode = p.mode; r.tests = C.MODES[p.mode].tests; }
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.seeds = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.rounds = {}; pl.totalSoFar = 0; pl.late = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("sm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return; const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r); if (r.phase === "play") maybeEndRound(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _smTest = { ROOMS, CODES, USER_ROOM };
