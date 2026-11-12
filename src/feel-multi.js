// =========================
// 플듀 감각 진단소 — 친구와 대결 2~8인 (fm:*)
// 모두 같은 시드·같은 난이도·같은 문제 순서(적응형 대신 고정 순서)로 같은 시각에 시작 → 각자 답 기록 제출 → 서버가 채점·순위 확정
// 흐름: lobby → [intro(설명+카운트다운) → play → result] × 검사 수 → final(시상식·개인 진단서)
// 상태 전환은 서버만: lobby → intro → play → result → … → final → (재대결) lobby. 허용 안 된 요청은 거절
// 구조는 게임 센스 대결(sense-multi.js)과 같음
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import * as C from "./feel-core.js";
import { judgeSubmit, buildRow, publicRow, insertRow } from "./feel.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId } from "./iq.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const fast = (ms) => (process.env.FEEL_FAST === "1" ? ms * 0.02 : ms);
const INTRO_MS = 12000, FIRST_INTRO_MS = 15000, RESULT_MS = 8000, GRACE_MS = 5000;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000, PROGRESS_MS = 700;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000; const joinFails = new Map();
const now = () => Date.now();
const sockRoom = (id) => `fm:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 13;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
// 검사 구성: all = 열린 검사 전부 · quick = 그중 2종 무작위 (빠른 파티)
export const MULTI_SETS = { all: { name: "전체 대결" }, quick: { name: "빠른 대결 (2종)" } };
function pickTests(set) { const all = [...C.READY]; if (set !== "quick") return all; for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } return all.slice(0, 2); }
const ROUND_TITLE = { color: "컬러 헌터", time: "시간 지배자", eye: "정밀 관찰자", count: "순간 포착자", pitch: "피치 마스터", rhythm: "리듬의 신", direction: "사운드 레이더", loud: "볼륨 센서", react: "반응속도 괴물", track: "트래킹 아이", bright: "라이트 디텍터", spatial: "메모리 마스터", speed: "스피드 아이", pattern: "패턴 천재", balance: "균형의 달인" };

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  const cur = r.round >= 0 ? p.rounds[r.round] : null;
  return { id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null, best: p.best || null, rankTrail: p.rankTrail || [], wins: p.wins || 0,
    hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device, connected: p.connected, ready: p.ready, host: r.host === uid, total: p.totalSoFar, late: !!p.late,
    status: r.phase === "play" ? (cur ? "done" : p.late ? "skip" : "playing") : null, progress: r.phase === "play" ? p.progress : null };
}
function pubRoom(r) {
  return { id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, set: r.set, diff: r.diff, tests: r.tests, phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    seed: r.phase === "lobby" ? null : r.seeds?.[r.round] ?? null, roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { ...r.final, individual: undefined } : null, players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now() };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("fm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[fm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) { clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer); for (const p of r.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer); ROOMS.delete(r.id); CODES.delete(r.code); for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u); io.to(sockRoom(r.id)).emit("fm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id)); }
function checkEmpty(io, r) { const any = [...r.players.values()].some((p) => p.connected); if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; } if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS)); }
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }   // 방장이 끊기면 다른 사람에게 (경기는 그대로 계속)
function removePlayer(io, r, uid) { const p = r.players.get(uid); if (p?.dropTimer) clearTimeout(p.dropTimer); r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid); if (!r.order.length) return deleteRoom(io, r, "EMPTY"); if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0]; if (r.phase === "play") maybeEndRound(io, r); emitRoom(io, r); }
async function bestOf(sb, uid, isGuest) {
  if (!sb) return null;
  try { const { data } = await sb.from("feel_results").select("total, tier, diff").eq("owner_key", isGuest ? `g:${uid}` : `u:${uid}`).eq("mode", "full").eq("flagged", false).order("total", { ascending: false }).limit(1).maybeSingle(); return data ? { total: data.total, tier: data.tier, diff: data.diff } : null; } catch { return null; }
}
const newPlayer = (name, isGuest, socketId, dev) => ({ name: String(name || "참가자").replace(/[<>]/g, "").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, totalSoFar: 0, wins: 0, progress: 0, lastProg: 0, late: false, dropTimer: null });

// ----- 라운드 -----
function startRound(io, r, i) {
  r.round = i; r.phase = "intro";
  for (const p of r.players.values()) { p.progress = 0; p.late = !p.connected; }
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : INTRO_MS); r.startAt = r.phaseEnd;
  r.deadline = r.startAt + fast(C.maxMs(r.tests[i], r.diff)) + GRACE_MS;
  emitRoom(io, r);
  schedule(r, r.startAt, () => { r.phase = "play"; emitRoom(io, r); schedule(r, r.deadline, () => endRound(io, r)); });
}
function maybeEndRound(io, r) { if (r.phase !== "play") return; if (!r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.rounds[r.round]; })) endRound(io, r); }
const measuredScores = (p, r) => { const sc = {}; r.tests.forEach((t, i) => { const x = p.rounds[i]; if (x && !x.missing) sc[t] = x.score; }); return sc; };
const sumScore = (p, r) => r.tests.reduce((a, _, i) => a + (p.rounds[i]?.score || 0), 0);   // 대결 점수 = 라운드 점수 합 (라운드마다 최대 100)
/** 동점: 점수 같으면 같은 순위 (임의로 승자를 만들지 않음) */
function rankRows(rows, keyFn) { const s = [...rows].sort((a, b) => { const A = keyFn(a), B = keyFn(b); for (let k = 0; k < A.length; k++) if (A[k] !== B[k]) return B[k] - A[k]; return 0; }); let rank = 0, prev = null; s.forEach((x, k) => { const key = keyFn(x).join("|"); if (key !== prev) rank = k + 1; x.rank = rank; prev = key; }); return s; }
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  clearT(r);
  const tid = r.tests[r.round];
  for (const u of r.order) { const p = r.players.get(u); if (!p.rounds[r.round]) p.rounds[r.round] = { id: tid, score: 0, m: {}, flags: [], missing: true, why: p.late ? "불참" : "미제출" }; p.totalSoFar = sumScore(p, r); }
  const rows = rankRows(r.order.map((u) => { const x = r.players.get(u).rounds[r.round]; return { id: u, score: x.score, m: x.m || {}, flags: x.flags, missing: !!x.missing }; }), (x) => [x.score]);
  for (const x of rows) if (x.rank === 1 && x.score > 0 && !x.missing) r.players.get(x.id).wins = (r.players.get(x.id).wins || 0) + 1;
  const overall = rankRows(r.order.map((u) => { const p = r.players.get(u); return { id: u, total: p.totalSoFar, wins: p.wins || 0 }; }), (x) => [x.total, x.wins]);
  overall.forEach((x) => { const p = r.players.get(x.id); const before = p.rankTrail?.length ? p.rankTrail[p.rankTrail.length - 1] : null; x.delta = before ? before - x.rank : 0; p.rankTrail = [...(p.rankTrail || []), x.rank]; });
  const titles = [];
  const firsts = rows.filter((x) => x.rank === 1 && x.score > 0 && !x.missing); for (const f of firsts) titles.push({ id: f.id, title: ROUND_TITLE[tid] || "이번 라운드 1위", value: f.score });
  const climb = [...overall].sort((a, b) => b.delta - a.delta)[0]; if (climb && climb.delta >= 2 && r.round > 0) titles.push({ id: climb.id, title: "역전의 제왕", value: climb.delta });
  r.lastRound = { round: r.round, test: tid, rows, overall, titles };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS); emitRoom(io, r);
  schedule(r, r.phaseEnd, () => { if (r.round + 1 < r.tests.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[fm] finish", e)); });
}
/** 시상식: 우승·MVP · 검사별 1위 칭호(실제 점수 기준) · 꾸준함 · 역전의 제왕 */
export function groupReport(people, tests) {
  const ranking = rankRows(people.map((x) => ({ id: x.id, total: x.sum, wins: x.wins })), (x) => [x.total, x.wins]).map((x) => ({ id: x.id, total: x.total, wins: x.wins, rank: x.rank }));
  const awards = [];
  for (const w of ranking.filter((x) => x.rank === 1 && x.total > 0)) awards.push({ key: "mvp", title: "MVP", desc: "가장 높은 대결 점수", id: w.id, value: w.total });
  for (const t of tests) { const top = Math.max(...people.map((x) => x.scores[t] ?? -1)); if (top < 30) continue; for (const x of people.filter((y) => (y.scores[t] ?? -1) === top)) awards.push({ key: t, title: ROUND_TITLE[t] || C.TESTS[t].name, desc: C.TESTS[t].name, id: x.id, value: top }); }
  if (people.length >= 2 && tests.length >= 2) { const sd = (x) => { const v = tests.map((t) => x.scores[t] ?? 0), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); }; const st = [...people].sort((a, b) => sd(a) - sd(b))[0]; if (st.sum > 0) awards.push({ key: "steady", title: "감각 밸런서", desc: "검사마다 점수 차이가 가장 적음", id: st.id, value: Math.round(sd(st)) }); }
  const climb = people.filter((x) => x.trail?.length >= 2).map((x) => ({ id: x.id, up: x.trail[0] - (ranking.find((y) => y.id === x.id)?.rank ?? x.trail[0]) })).sort((a, b) => b.up - a.up)[0];
  if (climb && climb.up >= 2) awards.push({ key: "comeback", title: "역전의 제왕", desc: "첫 라운드보다 순위가 가장 많이 오름", id: climb.id, value: climb.up });
  const tops = tests.map((t) => { const b = [...people].sort((x, y) => (y.scores[t] ?? 0) - (x.scores[t] ?? 0))[0]; return { test: t, id: b?.id, value: b?.scores[t] ?? 0 }; });
  return { ranking, awards, tops };
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId(), rows = [], individual = {};
  const fullSet = r.tests.length === C.READY.length;   // 전체 대결만 기록·랭킹에 저장 (2종 빠른 대결은 화면 결과만)
  const people = r.order.map((u) => { const p = r.players.get(u); const plan = r.tests.map((t, i) => ({ id: t, seed: r.seeds[i] })); const results = r.tests.map((t, i) => { const x = p.rounds[i]; return x && !x.missing ? x : { id: t, skipped: true, score: null, m: {}, flags: [] }; }); const scores = measuredScores(p, r); return { id: u, p, plan, results, scores, sum: sumScore(p, r), wins: p.wins || 0, trail: p.rankTrail || [] }; });
  const report = groupReport(people, r.tests), rankOf = Object.fromEntries(report.ranking.map((x) => [x.id, x.rank]));
  for (const x of people) {
    const prof = x.p.profile || { nick: x.p.name, age: null, avatar: {} };
    const me = { id: x.id, isGuest: x.p.isGuest };
    const measured = Object.keys(x.scores).length;
    const row = buildRow({ id: resultId(), key: x.p.isGuest ? `g:${x.id}` : `u:${x.id}`, me, prof, prefs: x.p.prefs, mode: "full", diff: r.diff, dev: x.p.device, plan: x.plan, results: x.results, rank: rankOf[x.id], of: people.length, groupId, isPublic: true, avatarUrl: x.p.avatarUrl });
    if (fullSet && measured) rows.push(row);
    individual[x.id] = { ...publicRow(row, { owner: true }), saved: false, multi: { sum: x.sum, wins: x.wins, rank: rankOf[x.id], of: people.length } };
    if (!fullSet || !measured) individual[x.id].id = null;   // 저장 안 하는 결과는 링크 없음
  }
  const playersPub = people.map((x) => { const I = individual[x.id]; return { id: x.id, resultId: I.id, nick: I.nick, avatar: I.avatar, avatarUrl: I.avatarUrl, isGuest: x.p.isGuest, device: x.p.device, total: I.total, sum: x.sum, wins: x.wins, tier: I.tier, style: I.style, scores: x.scores, rank: rankOf[x.id], flagged: I.flagged }; });
  r.final = { groupId, report, players: playersPub, individual, saved: false, diff: r.diff, tests: r.tests };
  emitRoom(io, r);
  for (const x of people) if (x.p.connected && x.p.socketId) io.to(x.p.socketId).emit("fm:mine", individual[x.id]);
  if (r.sb && rows.length) {
    try {
      let ok = true; for (const row of rows) { const { error } = await insertRow(r.sb, row); if (error) { ok = false; console.error("[fm] save", error.message); } else if (individual[row.user_id || row.owner_key.slice(2)]) individual[row.user_id || row.owner_key.slice(2)].saved = true; }
      const { error: e2 } = await r.sb.from("feel_groups").insert({ id: groupId, host_key: r.hostKey, diff: r.diff, tests: r.tests, players: playersPub, report });
      if (e2) console.error("[fm] group save", e2.message);
      for (const x of people) if (individual[x.id].saved && x.p.connected && x.p.socketId) io.to(x.p.socketId).emit("fm:mine", individual[x.id]);
      if (ok) { r.final.saved = true; io.to(sockRoom(r.id)).emit("fm:saved", { groupId }); }
    } catch (e) { console.error("[fm] save", e?.message); }
  }
}

export function registerFeelMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "fm:progress" || ev === "fm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.FEEL_RL || 50); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    async function applyMember(pl, p) {
      const prof = sanitizeProfile(p.profile), mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; } else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null; if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }
    on("fm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("fm:mine", (_p, reply) => { const r = myRoom(); if (!r?.final?.individual?.[me.id]) return reply({ ok: false, error: "NO_RESULT" }); reply({ ok: true, result: r.final.individual[me.id] }); });
    on("fm:create", async (p, reply) => {
      { const _f = createFlight("fm", me?.id, reply); if (!_f) return; reply = _f; }   // 방 중복 생성 막기
        // (2026-11-12) 게스트도 방 만들기 가능 — 도배는 index.js 소켓 가드가 막음
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "fm" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const set = MULTI_SETS[p.set] ? p.set : "all";
      const r = { id, code: genCode(), host: me.id, hostKey: `u:${me.id}`, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), set, diff: C.okDiff(p.diff), tests: pickTests(set), phase: "lobby", round: -1, players: new Map(), order: [], seeds: null, phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin, isPublic: false };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, false, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p); pl.best = await bestOf(supabaseAdmin, me.id, !!me.isGuest);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("fm:join", async (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; if (r.phase === "play" && !ex.rounds[r.round]) ex.late = true; if (r.phase === "intro") ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); return emitRoom(io, r); }   // 같은 사람 = 한 자리 (중복 입장 없음)
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p); pl.best = await bestOf(supabaseAdmin, me.id, !!me.isGuest);
      if (ROOMS.get(r.id) !== r) return reply({ ok: false, error: "NOT_FOUND" }); if (r.players.has(me.id)) return reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" }); if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" }); // 프로필 읽는 사이 동시에 들어온 사람 다시 확인
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("fm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id); if (!ex) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; if (p.device) ex.device = p.device === "mobile" ? "mobile" : "pc";
      if (r.phase === "play" && !ex.rounds[r.round] && !p.inRound) ex.late = true;   // 진행 중이던 검사는 건너뜀 (공정성: 다시 들어와 새로 풀기 금지)
      if (r.phase === "intro") ex.late = false;
      attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("fm:profile", async (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" }); const pl = r.players.get(me.id); await applyMember(pl, p); if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" }); if (p.device) pl.device = p.device === "mobile" ? "mobile" : "pc"; reply({ ok: true }); emitRoom(io, r); });
    on("fm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });   // 시작 뒤엔 난이도·구성 못 바꿈
      if (MULTI_SETS[p.set]) { r.set = p.set; r.tests = pickTests(p.set); }
      if (p.diff) r.diff = C.okDiff(p.diff);
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });
    on("fm:ready", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const pl = r.players.get(me.id); if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" }); pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("fm:host", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" }); r.host = p.to; reply({ ok: true }); emitRoom(io, r); });
    on("fm:kick", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" }); io.to(t.socketId).emit("fm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true }); });
    on("fm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      if (r.set === "quick") r.tests = pickTests("quick");
      r.seeds = r.tests.map(() => newSeed()); r.final = null; r.lastRound = null; r.isPublic = false;   // 시작하면 공개 목록에서 내려감
      for (const p of r.players.values()) { p.rounds = {}; p.totalSoFar = 0; p.wins = 0; p.ready = false; p.rankTrail = []; }
      reply({ ok: true }); startRound(io, r, 0);
    });
    on("fm:progress", (p) => { const r = myRoom(); if (!r || r.phase !== "play") return; const pl = r.players.get(me.id), t = now(); if (!pl || t - pl.lastProg < PROGRESS_MS) return; pl.lastProg = t; pl.progress = Math.max(0, Math.min(100, Math.round(Number(p.v) || 0))); socket.to(sockRoom(r.id)).emit("fm:prog", { id: me.id, v: pl.progress }); });   // 진행률만 (정답·점수는 라운드 끝까지 비공개)
    on("fm:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id); if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (pl.late) return reply({ ok: false, error: "LATE" });
      if (pl.rounds[r.round]) return reply({ ok: true, result: pl.rounds[r.round], dup: true });   // 중복 제출 = 처음 결과
      const res = judgeSubmit(r.tests[r.round], r.seeds[r.round], r.diff, p.log, now() - r.startAt + (process.env.FEEL_FAST === "1" ? 1e9 : 0), true);
      pl.rounds[r.round] = res; reply({ ok: true, result: { score: res.score, flags: res.flags } }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("fm:rematch", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      if (MULTI_SETS[p.set]) r.set = p.set; if (p.diff) r.diff = C.okDiff(p.diff); r.tests = pickTests(r.set);
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.seeds = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.rounds = {}; pl.totalSoFar = 0; pl.wins = 0; pl.late = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("fm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return; const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r); if (r.phase === "play") maybeEndRound(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _fmTest = { ROOMS, CODES, USER_ROOM };
// 게임천국 공개 방 목록 (방장이 🌐 공개방을 켠 대기실만)
addPublicRooms("feel", ROOMS);
