// =========================
// 플듀 언어 진단소 — 2~8인 언어 대결 (lgm:*)  ※ 상식 진단소 대결(know-multi.js) 흐름 그대로
// 방장이 검사 언어(ko/ja/en)·난이도(보통·어려움·전문가)·문제 수(5/10/15)·인원(2~8, 2명 = 1대1 듀얼)을 정함 → 경기 중엔 못 바꿈
// 모두에게 같은 문항·같은 보기 순서 · 서버 시각 기준 시작/마감(늦은 제출 무효) · 답은 서버가 채점, 문항당 1회
// 라운드 진행 중엔 정답·정오답을 아무에게도 안 보냄(제출 여부만) → 라운드 결과 때 정답·해설·순위 변동 공개
// 대결 점수 = 정확도 × 난이도 × 빠르기(서버가 받은 시각). 동점 = 정답 수 많은 순 → 정답 맞힌 시간 합이 짧은 순 (타이브레이커, 대기실에 안내)
// 타자는 기기 차이가 커서 대결에서 뺌. 대결 기록은 개인 진단서로 저장하되 공식 랭킹 제외(flagged)
// 흐름: lobby → [intro → play → result] × N → final
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicList } from "./public-rooms.js";
import * as C from "./lingo-core.js";
import { STORE, poolOf, serve, revealOf, judgeServed, buildRow, publicRow, bankVersion } from "./lingo.js";
import { resultId, memberProfile, sanitizeProfile, sanitizePrefs } from "./iq.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const MULTI_KINDS = new Set(["mcq", "ox", "spot", "order", "link", "sort"]);
// 경기 방식: 챔피언십(모두 동시에 점수 경쟁) · 토너먼트(1대1 대진표, 같은 라운드 경기는 동시 진행) · 파티(비공식 특별 규칙)
export const FORMATS = { champ: "챔피언십", tourney: "토너먼트", party: "파티" };
// 파티 특별 규칙 (시작 전 대기실에 공개): 마지막 문제 2배 · 서바이벌(목숨 3) · 타임 어택(제한시간 60%) · 랜덤 언어 섞기
const PARTY_KEYS = ["last2x", "survival", "timeAttack", "mixLang"];
const LIVES = 3, TIME_ATTACK = 0.6;
const sanitizeParty = (p) => Object.fromEntries(PARTY_KEYS.map((k) => [k, !!p?.[k]]));
const fast = (ms) => (process.env.LINGO_FAST === "1" ? ms * 0.02 : ms);
const FIRST_INTRO_MS = 6000, INTRO_MS = 3200, RESULT_MS = 7000, GRACE_MS = 1500;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000;
const joinFails = new Map(), createdBy = new Map();
const now = () => Date.now();
const sockRoom = (id) => `lgm:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const qOf = (r, i) => STORE.all.get(r.plan[i].id);

// 대결용 출제: 고른 난이도 대역 · 검사 고르게(10종 섞기) · 같은 검사 연속 3번 피하기
export function multiPlan(seed, n, lang, diff) {
  const pool = (lang === "*" ? STORE.pool : poolOf(lang)).filter((q) => MULTI_KINDS.has(q.kind));   // "*" = 파티 랜덤 언어 섞기
  if (pool.length < n) { const e = new Error("NOT_ENOUGH_ITEMS"); e.detail = { need: n, have: pool.length }; throw e; }
  const r = C.rng(seed), need = C.diffNeed(diff, n), used = new Set(), out = [], areaN = {}, cap = Math.ceil(n / 8) + 1;
  for (let i = 0; i < n; i++) {
    let best = null, bs = Infinity;
    for (const q of pool) { if (used.has(q.id)) continue; const s = (C.inBand(diff, q.d) ? (need[q.d] > 0 ? 0 : 3) : 15) + ((areaN[q.area] || 0) >= cap ? 8 : 0) + r() * 3; if (s < bs) { bs = s; best = q; } }
    used.add(best.id); if (need[best.d] > 0) need[best.d]--; areaN[best.area] = (areaN[best.area] || 0) + 1; out.push(best);
  }
  const arr = C.shuffle(out, r);
  for (let pass = 0; pass < 3; pass++) for (let i = 2; i < arr.length; i++) if (arr[i].area === arr[i - 1].area && arr[i].area === arr[i - 2].area) { const j = arr.findIndex((q, k) => k > i && q.area !== arr[i].area); if (j > 0) [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.map((q, i) => ({ id: q.id, seed: C.hashSeed(`${seed}:m:${i}:${q.id}`) >>> 0 }));
}

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  return { id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null, hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device,
    connected: p.connected, ready: p.ready, host: r.host === uid, pts: p.pts, correct: p.correct || 0, streak: p.streak || 0, out: !!p.out,
    lives: r.format === "party" && r.party.survival ? p.lives : null,
    status: r.phase === "play" ? (p.out ? "out" : p.rounds[r.round] ? "done" : p.late ? "skip" : "playing") : null };
}
function pubRoom(r) {
  return {
    id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, lang: r.lang, diff: r.diff, rounds: r.rounds, isPublic: r.isPublic, n: r.plan?.length || r.rounds,
    format: r.format, party: r.format === "party" ? r.party : null, perMatch: r.format === "tourney" ? r.rounds : null, bracket: r.format === "tourney" ? r.bracket : null, watchers: r.watchers.size, official: r.format !== "party",
    plan: r.plan ? r.plan.map((x) => { const q = STORE.all.get(x.id); return { game: q.area, area: q.area, d: q.d }; }) : null,
    phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    nextGame: r.phase === "intro" && r.served ? r.served.pub.game : null,
    item: r.phase === "play" && r.served ? r.served.pub : null,
    roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { players: r.final.players, saved: r.final.saved, champion: r.final.champion } : null,
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now(),
  };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("lgm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[lgm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) {
  clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer);
  ROOMS.delete(r.id); CODES.delete(r.code);
  for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  io.to(sockRoom(r.id)).emit("lgm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id));
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
const newPlayer = (name, isGuest, socketId, dev) => ({ name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, st: {}, answers: {}, pts: 0, correct: 0, okMs: 0, streak: 0, late: false, out: false, lives: LIVES, dropTimer: null });
const resetPlay = (pl) => Object.assign(pl, { rounds: {}, st: {}, answers: {}, pts: 0, correct: 0, okMs: 0, streak: 0, late: false, out: false, lives: LIVES });

// ---------- 토너먼트 대진표 ----------
// 2의 거듭제곱 칸에 맞추고 남는 칸은 부전승(null). 1번 시드 ↔ 마지막 칸처럼 짝지어 부전승끼리 만나지 않게
function makeBracket(ids) {
  let size = 1; while (size < ids.length) size *= 2;
  const slots = [...ids, ...Array(size - ids.length).fill(null)], matches = [];
  for (let i = 0; i < size / 2; i++) { const a = slots[i], b = slots[size - 1 - i]; matches.push({ a, b, winner: a && !b ? a : !a && b ? b : null, bye: !a || !b, ptsA: 0, ptsB: 0 }); }
  return [{ matches }];
}
const totalTourneyRounds = (n) => { let k = 0, s = 1; while (s < n) { s *= 2; k++; } return Math.max(1, k); };
// 한 경기(문제 묶음) 점수: 점수 → 정답 수 → 정답 시간 합(짧을수록)
function setScore(p, from, to) { let pts = 0, ok = 0, ms = 0; for (let i = from; i < to; i++) { const x = p.rounds[i]; if (!x) continue; pts += x.bp || 0; if (x.part >= 1) { ok++; ms += x.ms || 0; } } return { pts, ok, ms }; }
const better = (A, B) => A.pts - B.pts || A.ok - B.ok || B.ms - A.ms;
function resolveBracket(r, setIdx) {
  const cur = r.bracket[r.bracket.length - 1], from = setIdx * r.rounds, to = from + r.rounds, next = [];
  for (const m of cur.matches) {
    if (!m.bye) {
      const A = r.players.get(m.a), Bp = r.players.get(m.b);
      const sa = A ? setScore(A, from, to) : { pts: -1, ok: 0, ms: 0 }, sb = Bp ? setScore(Bp, from, to) : { pts: -1, ok: 0, ms: 0 };
      m.ptsA = Math.max(0, sa.pts); m.ptsB = Math.max(0, sb.pts);
      let c = better(sa, sb); if (c === 0) c = (A?.okMs ?? 0) <= (Bp?.okMs ?? 0) ? 1 : -1;   // 완전히 같으면 전체 대결에서 정답을 더 빨리 맞힌 쪽
      m.winner = c > 0 ? m.a : m.b; const loser = c > 0 ? m.b : m.a;
      const L = r.players.get(loser); if (L) { L.out = true; r.elim[loser] = setIdx; }
    }
    next.push(m.winner);
  }
  if (next.length <= 1) { r.champion = next[0] || null; r.over = true; return; }
  const matches = []; for (let i = 0; i < next.length; i += 2) { const a = next[i], b = next[i + 1] ?? null; matches.push({ a, b, winner: b ? null : a, bye: !b, ptsA: 0, ptsB: 0 }); }
  r.bracket.push({ matches });
}

function startRound(io, r, i) {
  const q = qOf(r, i);
  r.round = i; r.phase = "intro"; r.served = serve(q, r.plan[i].seed);   // 모두 같은 보기 순서
  if (r.format === "party" && r.party.timeAttack) r.served.pub.lim = Math.round(r.served.pub.lim * TIME_ATTACK);   // 판정도 이 제한시간으로
  for (const p of r.players.values()) { p.late = !p.connected || p.out; p.st[i] = null; }
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : INTRO_MS);
  r.startAt = r.phaseEnd; r.deadline = r.startAt + (process.env.LINGO_FAST === "1" ? 400 : r.served.pub.lim + GRACE_MS);
  emitRoom(io, r);
  schedule(r, r.startAt, () => {
    r.phase = "play";
    for (const p of r.players.values()) p.st[i] = { at: r.startAt };
    emitRoom(io, r);
    schedule(r, r.deadline, () => endRound(io, r));
  });
}
function maybeEndRound(io, r) {
  if (r.phase !== "play") return;
  if (!r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.out && !p.rounds[r.round]; })) endRound(io, r);
}
// 순위: 점수 → 정답 수 → 정답 맞힌 시간 합(짧을수록 위). 셋 다 같으면 공동 순위
// 토너먼트·서바이벌은 늦게 탈락할수록 위(살아남은 사람 = 999, 우승자 = 10000), 그다음 점수
function rankMap(r) {
  const elimOf = (u) => (r.format === "tourney" || (r.format === "party" && r.party.survival) ? (r.champion === u ? 1e4 : r.elim[u] ?? 999) : 0);
  const arr = r.order.map((u) => { const p = r.players.get(u); return { u, e: elimOf(u), pts: p.pts, ok: p.correct || 0, ms: p.okMs || 0 }; }).sort((a, b) => b.e - a.e || b.pts - a.pts || b.ok - a.ok || a.ms - b.ms);
  const m = {}; let rank = 0, prev = null; arr.forEach((x, k) => { const key = `${x.e}|${x.pts}|${x.ok}|${x.ms}`; if (key !== prev) rank = k + 1; m[x.u] = rank; prev = key; }); return m;
}
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  clearT(r);
  const i = r.round, q = qOf(r, i), sv = r.served, before = rankMap(r);
  for (const u of r.order) {
    const p = r.players.get(u);
    if (!p.rounds[i]) p.rounds[i] = { ...judgeServed(q, sv, null, p.st[i] || { at: r.startAt }, r.startAt + sv.pub.lim + GRACE_MS + 1), bp: 0, missing: true, watch: !!p.out };   // 탈락해서 관전 중이던 문항은 진단서에서 뺌
    p.streak = p.rounds[i].part >= 1 ? (p.streak || 0) + 1 : 0;
    p.pts = Object.values(p.rounds).reduce((s, x) => s + (x.bp || 0), 0);
    p.correct = Object.values(p.rounds).filter((x) => x.part >= 1).length;
    p.okMs = Object.values(p.rounds).filter((x) => x.part >= 1).reduce((s, x) => s + (x.ms || 0), 0);
  }
  // 서바이벌: 이번 문제를 틀리거나 못 낸 사람은 목숨 -1, 0이면 탈락(관전). 1명 이하 남으면 끝
  const lifeLost = [];
  if (r.format === "party" && r.party.survival) {
    for (const u of r.order) { const p = r.players.get(u), x = p.rounds[i]; if (p.out || x.watch) continue; if (x.part < 1) { p.lives--; lifeLost.push(u); if (p.lives <= 0) { p.out = true; r.elim[u] = i; } } }
    if (r.order.filter((u) => !r.players.get(u).out).length <= 1) r.over = true;
  }
  // 토너먼트: 한 경기(문제 묶음)가 끝나면 대진표 판정
  let bracketDone = null;
  if (r.format === "tourney" && (i + 1) % r.rounds === 0) { bracketDone = Math.floor(i / r.rounds); resolveBracket(r, bracketDone); }
  const after = rankMap(r);
  const rows = r.order.map((u) => { const p = r.players.get(u), x = p.rounds[i]; return { id: u, part: x.part, ms: x.ms, timeout: x.timeout, bp: x.bp || 0, total: p.pts, rank: after[u], prevRank: before[u], streak: p.streak, choice: p.answers?.[i] ?? null }; })
    .sort((a, b) => b.bp - a.bp || a.ms - b.ms);
  const dist = ["mcq", "ox", "spot"].includes(q.kind) ? rows.reduce((o, x) => { if (x.choice != null) { const k = String(x.choice); o[k] = (o[k] || 0) + 1; } return o; }, {}) : null;
  r.lastRound = { round: i, item: sv.pub, reveal: revealOf(q, sv), rows, dist, fastest: rows.filter((x) => x.part >= 1).sort((a, b) => a.ms - b.ms)[0]?.id || null, lifeLost, bracketDone, double: r.format === "party" && r.party.last2x && i === r.plan.length - 1 };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS + (bracketDone != null ? 3000 : 0));
  emitRoom(io, r);
  schedule(r, r.phaseEnd, () => { if (!r.over && r.round + 1 < r.plan.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[lgm] finish", e)); });
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const played = r.plan.slice(0, r.round + 1);   // 서바이벌·토너먼트는 일찍 끝날 수 있음
  const rank = rankMap(r), rows = [], individual = {}, players = [];
  for (const u of r.order) {
    const p = r.players.get(u);
    const idx = played.map((_, i) => i).filter((i) => p.rounds[i] && !p.rounds[i].watch);   // 관전 중이던 문항은 빼고
    const results = idx.map((i) => { const { bp, missing, watch, ...rest } = p.rounds[i]; void bp; void missing; void watch; return rest; });
    const myPlan = idx.map((i) => played[i]);
    const prof = p.profile || { nick: p.name, age: null, avatar: { skin: 0, hc: 0, hs: 0, shirt: 0, pants: 0, hat: 0 } };
    if (!results.length) continue;
    const s = { results, mode: "multi", diff: r.diff, lang: r.lang, area: null, device: p.device, plan: myPlan, challengeOf: null };
    const row = buildRow({ id: resultId(), key: p.isGuest ? `g:${u}` : `u:${u}`, me: { isGuest: p.isGuest, id: u }, prof, prefs: p.prefs, s, isPublic: true, avatarUrl: p.avatarUrl, flagged: true });
    row.diag.multi = { rank: rank[u], of: r.order.length, pts: p.pts, rounds: r.rounds, format: r.format, party: r.format === "party" ? r.party : null, champion: r.champion === u };
    rows.push(row); individual[u] = publicRow(row, { owner: true });
    players.push({ id: u, resultId: row.id, nick: prof.nick, avatar: prof.avatar, avatarUrl: p.avatarUrl, isGuest: p.isGuest, pts: p.pts, rank: rank[u], total: row.total, grade: row.grade, type: row.diag.type.name, correct: p.correct || 0, n: results.length, out: !!p.out, lives: r.format === "party" && r.party.survival ? p.lives : null });
  }
  players.sort((a, b) => a.rank - b.rank || b.total - a.total);
  r.final = { players, individual, saved: false, champion: r.champion || null };
  emitRoom(io, r);
  for (const u of r.order) { const p = r.players.get(u); if (p.connected && p.socketId) io.to(p.socketId).emit("lgm:mine", individual[u]); }
  if (r.sb) { try { const { error } = await r.sb.from("lingo_results").insert(rows); if (error) console.error("[lgm] save", error.message); else { r.final.saved = true; io.to(sockRoom(r.id)).emit("lgm:saved", {}); } } catch (e) { console.error("[lgm] save", e?.message); } }
}

export function registerLingoMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "lgm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.LINGO_RL || 60); };
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
    on("lgm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("lgm:mine", (_p, reply) => { const r = myRoom(); const x = r?.final?.individual?.[me.id]; reply(x ? { ok: true, result: x } : { ok: false, error: "NO_RESULT" }); });

    // 방 만들기: 게스트도 가능 (같은 사람 1분에 5개까지)
    on("lgm:create", async (p, reply) => {
      { const _f = createFlight("lgm", me?.id, reply); if (!_f) return; reply = _f; }
      const c = (createdBy.get(me.id) || []).filter((t) => now() - t < 60000); if (c.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); c.push(now()); createdBy.set(me.id, c); if (createdBy.size > 20000) createdBy.clear();
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "lg" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, lang: C.normQLang(p.lang), diff: C.normDiff(p.diff), rounds: [5, 10, 15].includes(Number(p.rounds)) ? Number(p.rounds) : 10, code: genCode(), host: me.id, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), isPublic: p.isPublic === true, format: FORMATS[p.format] ? p.format : "champ", party: sanitizeParty(p.party), watchers: new Set(), elim: {}, bracket: null, champion: null, over: false, plan: null, served: null, phase: "lobby", round: -1, players: new Map(), order: [], phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("lgm:join", async (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; if (r.phase === "play" && !ex.rounds[r.round]) ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true, mine: r.phase === "play" ? { submitted: !!ex.rounds[r.round] } : null }); return emitRoom(io, r); }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED", canWatch: true });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL", canWatch: true });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc"); await applyMember(pl, p);
      if (ROOMS.get(r.id) !== r) return reply({ ok: false, error: "NOT_FOUND" }); if (r.players.has(me.id)) return reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" }); if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    // 관전: 참가자가 아닌 사람이 코드로 보기만 (답 제출·설정 불가, 정답은 라운드 끝난 뒤 방 상태에만 실림)
    let watching = null;
    const unwatch = () => { if (!watching) return; const r = ROOMS.get(watching); if (r) { r.watchers.delete(socket.id); socket.leave(sockRoom(r.id)); emitRoom(io, r); } watching = null; };
    on("lgm:watch", (p, reply) => {
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null; if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (r.players.has(me.id)) return reply({ ok: false, error: "ALREADY_PLAYER" });
      unwatch(); r.watchers.add(socket.id); watching = r.id; socket.join(sockRoom(r.id));
      reply({ ok: true, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("lgm:unwatch", (_p, reply) => { unwatch(); reply({ ok: true }); });
    on("lgm:rejoin", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; ex.late = false; attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r), mine: r.phase === "play" ? { submitted: !!ex.rounds[r.round] } : null }); emitRoom(io, r);
    });
    on("lgm:profile", async (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); await applyMember(pl, p); if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" });
      reply({ ok: true }); emitRoom(io, r);
    });
    // 방장 설정: 바꾸면 모두의 준비가 풀림 (다른 조건으로 시작하지 않게)
    on("lgm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      let changed = false;
      if (p.lang && C.LANGS.includes(p.lang) && p.lang !== r.lang) { r.lang = p.lang; changed = true; }
      if (p.diff && C.DIFFS[p.diff] && p.diff !== r.diff) { r.diff = p.diff; changed = true; }
      if ([5, 10, 15].includes(Number(p.rounds)) && Number(p.rounds) !== r.rounds) { r.rounds = Number(p.rounds); changed = true; }
      if (p.maxPlayers) { const m = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers)); if (m !== r.maxPlayers) { r.maxPlayers = m; } }
      if (typeof p.isPublic === "boolean") r.isPublic = p.isPublic;
      if (p.format && FORMATS[p.format] && p.format !== r.format) { r.format = p.format; changed = true; }
      if (p.party && typeof p.party === "object") { const np = sanitizeParty({ ...r.party, ...p.party }); if (JSON.stringify(np) !== JSON.stringify(r.party)) { r.party = np; if (r.format === "party") changed = true; } }
      if (changed) for (const pl of r.players.values()) pl.ready = false;
      reply({ ok: true, unready: changed }); emitRoom(io, r);
    });
    on("lgm:ready", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" });
      pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r);
    });
    on("lgm:host", (p, reply) => { const r = myRoom(); if (!r || r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" }); r.host = p.to; reply({ ok: true }); emitRoom(io, r); });
    on("lgm:kick", (p, reply) => {
      const r = myRoom(); if (!r || r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" });
      io.to(t.socketId).emit("lgm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true });
    });
    on("lgm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.length < 2 && process.env.LINGO_SOLO_MULTI !== "1") return reply({ ok: false, error: "NEED_TWO" });
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      const n = r.format === "tourney" ? r.rounds * totalTourneyRounds(r.order.length) : r.rounds;   // 토너먼트: 문제 수 = 한 경기당
      try { r.plan = multiPlan(newSeed(), n, r.format === "party" && r.party.mixLang ? "*" : r.lang, r.diff); } catch (e) { return reply({ ok: false, error: e.message, detail: e.detail || null }); }
      r.final = null; r.lastRound = null; r.bankVer = bankVersion(); r.elim = {}; r.champion = null; r.over = false;
      for (const pl of r.players.values()) { resetPlay(pl); pl.ready = false; }
      r.bracket = r.format === "tourney" ? makeBracket(C.shuffle(r.order, C.rng(newSeed()))) : null;
      reply({ ok: true }); startRound(io, r, 0);
    });
    on("lgm:answer", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      if (now() > r.deadline) return reply({ ok: false, error: "TIME_UP" });   // 마감 뒤 도착한 답은 점수에 안 넣음
      const pl = r.players.get(me.id); if (pl.out) return reply({ ok: false, error: "OUT" });   // 탈락(관전 중)
      if (pl.rounds[r.round]) return reply({ ok: true, dup: true });
      let ans = p.answer ?? null;
      if (!(ans == null || typeof ans === "number" || typeof ans === "boolean" || (Array.isArray(ans) && ans.length <= 16))) ans = null;
      if (Array.isArray(ans)) ans = ans.map((v) => Number(v) | 0);
      const q = qOf(r, r.round), res = judgeServed(q, r.served, ans, pl.st[r.round] || { at: r.startAt });
      res.bp = C.battlePoints(res.part, res.d, res.game, res.ms, res.lim);
      if (r.format === "party" && r.party.last2x && r.round === r.plan.length - 1) res.bp *= 2;   // 파티: 마지막 문제 2배 (대기실에 미리 공개)
      pl.rounds[r.round] = res; pl.answers[r.round] = Array.isArray(ans) ? null : ans;
      reply({ ok: true, submitted: true }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("lgm:rematch", (_p, reply) => {
      const r = myRoom(); if (!r || r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.plan = null; r.served = null; r.phaseEnd = null;
      r.elim = {}; r.bracket = null; r.champion = null; r.over = false;
      for (const u of [...r.order]) { const pl = r.players.get(u); resetPlay(pl); pl.ready = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("lgm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      unwatch();
      const r = myRoom(); if (!r) return;
      const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r); if (r.phase === "play") maybeEndRound(io, r); checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _lgmTest = { ROOMS, CODES, USER_ROOM };
// 공개방 목록(메인 🌐 공개방 탭·게임천국): 대기 중·자리 남은·방장이 공개로 켠 방만
export const publicLingoRooms = () => [...ROOMS.values()].filter((r) => r.isPublic && r.phase === "lobby" && r.order.length < r.maxPlayers).slice(0, 30).map((r) => ({ code: r.code, host: r.players.get(r.host)?.name || "", n: r.order.length, max: r.maxPlayers }));
addPublicList("lingo", publicLingoRooms);
