// =========================
// 플듀 게임 종합 진단소 — 함께 하기
// 1) 친구 대결 2~8인 (glm:*): lobby → [intro → play → result] × 미션 수 → final. 서버 시계로 같이 시작, 결과 raw를 서버가 다시 채점
//    관전: glm:watch — 참가자 자리 없이 방을 읽기만 함 (OBS 출력도 같은 경로)
// 2) 스트리머 VS 시청자 (glb:* + /gamelab/bc/*): 방송 진단소를 열면 시청자가 링크로 같은 구성·난이도를 혼자 플레이 → 한 사람 첫 기록만 집계, 2초 묶음으로 통계 전송
// 게임은 각자 브라우저에서 돌아감 → 위조를 완전히 막을 수는 없음. 서버 시계로 불가능한 값은 표시(flagged)하고 순위에서 0점 처리
// DB: gamelab_results(기존) + gamelab_broadcasts (sql/gamelab_live.sql). 게임 랭킹·기록 테이블은 읽지도 쓰지도 않음
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import * as C from "./gamelab-core.js";
import { suspicious, buildRow, setGamelabHooks, newResultId, ownerOf } from "./gamelab.js";

const now = () => Date.now();
const fast = (ms) => (process.env.GAMELAB_FAST === "1" ? ms * 0.05 : ms);
const clean = (s, n = 14) => String(s || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, n);
function sockIp(socket) { const h = socket.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const xff = String(h["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); if (xff.length) return xff[0]; return String(socket.handshake?.address || "").replace(/^::ffff:/, ""); }

// ========== 친구 대결 ==========
const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8, MAX_SPEC = 300, FIRST_INTRO_MS = 12000, INTRO_MS = 8000, RESULT_MS = 7000, LOAD_GRACE_MS = 30000, RAISING_MS = 360000, LOBBY_DROP_MS = 20000, DROP_WAIT_MS = 20000, EMPTY_TTL_MS = 90000, PROGRESS_MS = 700, MAX_RAW = 2000;
export const SETS = { quick: { name: "빠른 대결" }, full: { name: "종합 대결" }, single: { name: "단일 게임 대결" }, random: { name: "랜덤 챌린지" } };
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000, joinFails = new Map();
const GUEST_ROOM_WIN = 10 * 60 * 1000, GUEST_ROOM_MAX = 8, roomMakes = new Map();
const sockRoom = (id) => `glm:${id}`;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
function pickPlan(set, single) { if (set === "full") return [...C.FULL]; if (set === "quick") return [...C.QUICK]; if (set === "single") return [C.byId[single] ? single : "dodge"]; const a = [...C.FULL]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 3 + Math.floor(Math.random() * 3)); }   // 랜덤: 3~5종, 시작 전에 모두에게 공개
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 13, okScale = (s) => (C.TIME_SCALES[s] ? s : "normal"), cfgOfRoom = (r, id) => C.liveCfg(id, r.diff, C.TIME_SCALES[r.time] || 1);
const okSet = (s) => (SETS[s] ? s : "quick"), okDiff = (d) => (C.DIFFS.includes(d) ? d : "normal");
/** 동점은 같은 순위 */
export function rankRows(rows, keyFn) { const s = [...rows].sort((a, b) => { const A = keyFn(a), B = keyFn(b); for (let k = 0; k < A.length; k++) if (A[k] !== B[k]) return B[k] - A[k]; return 0; }); let rank = 0, prev = null; s.forEach((x, k) => { const key = keyFn(x).join("|"); if (key !== prev) rank = k + 1; x.rank = rank; prev = key; }); return s; }
const sumOf = (p, r) => r.plan.reduce((a, id) => a + (p.scores[id]?.score || 0), 0);
function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null; const id = r.plan?.[r.round], cur = id ? p.scores[id] : null;
  return { id: uid, nick: p.name, avatarUrl: p.avatarUrl || null, isGuest: p.isGuest, device: p.device, connected: p.connected, ready: p.ready, host: r.host === uid, total: sumOf(p, r), wins: p.wins || 0, late: !!p.late,
    status: r.phase === "play" ? (cur ? (cur.missing ? "skip" : "done") : p.late ? "skip" : "playing") : null, score: cur && !cur.missing ? cur.score : null, cleared: !!cur?.good, prog: r.phase === "play" && !cur ? p.prog || null : null, scores: Object.fromEntries(Object.entries(p.scores).map(([k, v]) => [k, v.missing ? null : v.score])) };
}
export function pubRoom(r) {
  return { id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, set: r.set, single: r.single || null, time: r.time, allowWatch: r.allowWatch, seed: r.phase === "lobby" ? null : r.seed ?? null, diff: r.diff, plan: r.plan, phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline, isPublic: !!r.isPublic, spectators: r.spec.size,
    roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null, final: r.phase === "final" ? r.final : null, players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), serverNow: now() };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("glm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[glm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) { clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer); for (const p of r.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer); ROOMS.delete(r.id); CODES.delete(r.code); for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u); io.to(sockRoom(r.id)).emit("glm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id)); }
function checkEmpty(io, r) { const any = [...r.players.values()].some((p) => p.connected); if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; } if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS)); }
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) { const p = r.players.get(uid); if (p?.dropTimer) clearTimeout(p.dropTimer); r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid); if (!r.order.length) return deleteRoom(io, r, "EMPTY"); if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0]; if (r.phase === "play") maybeEndRound(io, r); emitRoom(io, r); }
const newPlayer = (name, isGuest, socketId, dev) => ({ name: clean(name, 12) || "참가자", isGuest, socketId, connected: true, ready: false, avatarUrl: null, device: dev === "mobile" ? "mobile" : "pc", scores: {}, raws: {}, wins: 0, trail: [], prog: null, lastProg: 0, late: false, dropTimer: null });
const roundMs = (r, id) => (cfgOfRoom(r, id)?.limit ? cfgOfRoom(r, id).limit * 1000 : RAISING_MS) + LOAD_GRACE_MS;

function startRound(io, r, i) {
  r.round = i; r.phase = "intro"; r.lastRound = null;
  for (const p of r.players.values()) { p.prog = null; p.late = !p.connected; }
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : INTRO_MS); r.startAt = r.phaseEnd; r.deadline = r.startAt + fast(roundMs(r, r.plan[i])); r.seed = newSeed();
  emitRoom(io, r);
  schedule(r, r.startAt, () => { r.phase = "play"; emitRoom(io, r); schedule(r, r.deadline, () => endRound(io, r)); });
}
function maybeEndRound(io, r) { if (r.phase !== "play") return; const id = r.plan[r.round]; if (!r.order.some((u) => { const p = r.players.get(u); return (p.connected || now() - (p.dropAt || 0) < fast(DROP_WAIT_MS)) && !p.late && !p.scores[id]; })) endRound(io, r); }
/** 서버 시계로 불가능한 값 찾기 (점수가 낮은 건 문제 삼지 않음) */
export function timeCheck(id, diff, raw, elapsedSec, cfg = null) {
  const m = C.byId[id], c = cfg || C.cfgOf(id, diff), t = Number(raw?.t) || 0;
  if (t > elapsedSec + 5) return "TIME_AHEAD";
  if (m.kind === "survive" && raw?.ok && elapsedSec < c.goal - 2) return "TIME_SHORT";
  if ((m.kind === "reach" || m.kind === "golf") && (raw?.ok || Number(raw?.done) >= (c.holes || 1e9)) && elapsedSec < 3) return "TIME_SHORT";
  return null;
}
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return; clearT(r);
  const id = r.plan[r.round];
  for (const u of r.order) { const p = r.players.get(u); if (!p.scores[id]) p.scores[id] = { score: 0, missing: true, status: p.late ? "absent" : "none" }; }
  const rows = rankRows(r.order.map((u) => { const x = r.players.get(u).scores[id]; return { id: u, score: x.score, status: x.status, missing: !!x.missing, flag: x.flag || null }; }), (x) => [x.score]);
  for (const x of rows) if (x.rank === 1 && x.score > 0) { const p = r.players.get(x.id); p.wins = (p.wins || 0) + 1; }
  const overall = rankRows(r.order.map((u) => { const p = r.players.get(u); return { id: u, total: sumOf(p, r), wins: p.wins || 0 }; }), (x) => [x.total, x.wins]);
  const prevLeader = r.leader || null; overall.forEach((x) => { const p = r.players.get(x.id), before = p.trail.length ? p.trail[p.trail.length - 1] : null; x.delta = before ? before - x.rank : 0; p.trail = [...p.trail, x.rank]; });
  const leader = overall[0] && overall[0].total > 0 && overall.filter((x) => x.rank === 1).length === 1 ? overall[0].id : prevLeader; r.leader = leader;
  r.lastRound = { round: r.round, mission: id, rows, overall, overtake: r.round > 0 && prevLeader && leader && leader !== prevLeader ? { by: leader, from: prevLeader } : null };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS); emitRoom(io, r);
  schedule(r, r.phaseEnd, () => { if (r.round + 1 < r.plan.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[glm] finish", e)); });
}
/** 시상: 우승·미션별 1위·꾸준함·역전 */
export function groupReport(people, plan) {
  const ranking = rankRows(people.map((x) => ({ id: x.id, total: x.sum, wins: x.wins })), (x) => [x.total, x.wins]).map((x) => ({ id: x.id, total: x.total, wins: x.wins, rank: x.rank }));
  const awards = []; for (const w of ranking.filter((x) => x.rank === 1 && x.total > 0)) awards.push({ key: "mvp", title: "우승", desc: "가장 높은 대결 점수", id: w.id, value: w.total });
  for (const id of plan) { const top = Math.max(...people.map((x) => x.scores[id] ?? -1)); if (top < 40) continue; const tops = people.filter((y) => (y.scores[id] ?? -1) === top); if (tops.length === 1) awards.push({ key: id, title: `${C.byId[id].name} 1위`, desc: C.byId[id].name, id: tops[0].id, value: top }); }   // 공동 1위는 칭호 없음
  if (people.length >= 2 && plan.length >= 2) { const sd = (x) => { const v = plan.map((t) => x.scores[t] ?? 0), m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); }; const st = [...people].sort((a, b) => sd(a) - sd(b))[0]; if (st.sum > 0) awards.push({ key: "steady", title: "꾸준함의 달인", desc: "미션마다 점수 차이가 가장 적음", id: st.id, value: Math.round(sd(st)) }); }
  const climb = people.filter((x) => x.trail?.length >= 2).map((x) => ({ id: x.id, up: x.trail[0] - (ranking.find((y) => y.id === x.id)?.rank ?? x.trail[0]) })).sort((a, b) => b.up - a.up)[0]; if (climb && climb.up >= 2) awards.push({ key: "comeback", title: "역전의 제왕", desc: "첫 미션보다 순위가 가장 많이 오름", id: climb.id, value: climb.up });
  return { ranking, awards };
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null; const groupId = newResultId();
  const people = r.order.map((u) => { const p = r.players.get(u), scores = {}; for (const id of r.plan) { const x = p.scores[id]; if (x && !x.missing) scores[id] = x.score; } return { id: u, p, scores, sum: sumOf(p, r), wins: p.wins || 0, trail: p.trail }; });
  const report = groupReport(people, r.plan), rankOf = Object.fromEntries(report.ranking.map((x) => [x.id, x.rank])), saveable = (r.set === "quick" || r.set === "full") && r.time === "normal", rows = [];   // 정해진 구성·기본 시간만 기록에 저장 (단일·랜덤·시간 변경은 이 방 결과로만)
  const players = people.map((x) => {
    const results = Object.fromEntries(Object.entries(x.p.scores).filter(([, v]) => !v.missing)), sum = C.summarize(r.plan, results), flagged = Object.values(results).some((v) => v.flag); let resultId = null;
    if (saveable && sum.done) { const row = buildRow({ id: newResultId(), key: x.p.isGuest ? `g:${x.id}` : `u:${x.id}`, userId: x.p.isGuest ? null : x.id, nickname: x.p.name, mode: r.set, diff: r.diff, plan: r.plan, sum, raws: x.p.raws, flags: Object.fromEntries(Object.entries(results).filter(([, v]) => v.flag).map(([k, v]) => [k, v.flag])), isPublic: true, isStreamer: false, durationMs: now() - r.startedAt, groupId }); rows.push(row); resultId = row.id; }
    return { id: x.id, nick: x.p.name, avatarUrl: x.p.avatarUrl, rank: rankOf[x.id], sum: x.sum, wins: x.wins, total: sum.total, tier: sum.tier, type: sum.type, done: sum.done, scores: x.scores, flagged, resultId };
  });
  r.final = { groupId, report, players, of: r.plan.length, saved: false }; emitRoom(io, r);
  if (r.sb && rows.length) { try { const { error } = await r.sb.from("gamelab_results").insert(rows); if (error) { console.error("[glm] save", error.message); for (const pl of r.final.players) pl.resultId = null; } else r.final.saved = true; emitRoom(io, r); } catch (e) { console.error("[glm] save", e?.message); } }
}

// ========== 스트리머 VS 시청자 ==========
const BC = new Map(), REST_CACHE = new Map();
const STATS_MS = 2000, GRACE_MS = 25 * 60 * 1000, MAX_DEADLINE_MIN = 24 * 60, PLAY_TTL = 90 * 1000, GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60 * 1000, GUEST_IP_MAX = () => Number(process.env.GAMELAB_BC_IP_MAX || 5), ipMakes = new Map(), playHits = new Map();
let SB = null, IO = null;
const bcRoom = (id) => `glb:${id}`;
function bcId() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), r1 = (v) => (v == null ? null : Math.round(v * 10) / 10), median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
async function loadBc(id) {
  id = String(id || "").slice(0, 16); if (BC.has(id)) return BC.get(id); if (!SB) return null;
  const { data: row } = await SB.from("gamelab_broadcasts").select("*").eq("id", id).maybeSingle(); if (!row) return null;
  const { data: ents } = await SB.from("gamelab_results").select("id, owner_key, nickname, total, tier, scores, is_streamer, flagged, created_at").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), playing: new Map(), stats: null, dirty: true, at: 0, timer: null }; BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old) BC.delete(old[0]); }
  return b;
}
const isOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const acceptsUntil = (b) => new Date(b.row.closes_at).getTime() + GRACE_MS;
export function computeBcStats(b) {
  const all = [...b.entries.values()], rated = (e) => e.tier !== C.UNRATED && !e.flagged, valid = all.filter((e) => rated(e) && !e.is_streamer), tot = valid.map((e) => e.total), hide = !!b.row.settings?.hideNicks, plan = C.plan(b.row.mode);
  const name = (e, i) => (hide ? `시청자 ${i + 1}` : e.nickname), sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at)), streamer = all.find((e) => e.is_streamer) || null;
  const tiers = Object.fromEntries(C.TIERS.map((t) => [t.id, 0])); for (const e of valid) tiers[C.tierOf(e.total).id]++;
  const perMission = {}, kings = {}; for (const id of plan) { const v = valid.map((e) => e.scores?.[id]).filter(Number.isFinite); perMission[id] = r1(avg(v)); let best = null, bi = 0; sorted.forEach((e, i) => { const s = e.scores?.[id]; if (Number.isFinite(s) && (!best || s > best.scores[id])) { best = e; bi = i; } }); if (best && best.scores[id] > 0) kings[id] = { nick: name(best, bi), score: best.scores[id] }; }
  const avgT = avg(tot), play = [...b.playing.values()].filter((x) => now() - x.at < PLAY_TTL).sort((x, y) => y.idx - x.idx || x.since - y.since);
  const s = { id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, avatarUrl: b.row.avatar_url || null, mode: b.row.mode, diff: b.row.diff, plan, status: b.row.status, closesAt: b.row.closes_at, open: isOpen(b), paused: !!b.row.settings?.paused, settings: { hideNicks: hide, minutes: b.row.settings?.minutes || 30 }, revealAt: b.row.settings?.revealAt || null,
    count: valid.length, flaggedCount: all.filter((e) => e.flagged).length, avgTotal: r1(avgT), medianTotal: median(tot), topTotal: tot.length ? Math.max(...tot) : null, bottomTotal: tot.length ? Math.min(...tot) : null, avgTier: avgT == null ? null : C.tierOf(Math.round(avgT)).id, tiers, perMission, kings,
    top10: sorted.slice(0, 10).map((e, i) => ({ key: hide ? `v${i}` : e.id, rank: i + 1, nick: name(e, i), total: e.total, tier: C.tierOf(e.total).id })),
    streamerScore: streamer && rated(streamer) ? { total: streamer.total, tier: streamer.tier, scores: streamer.scores } : null, updatedAt: new Date().toISOString(), viewers: (() => { const fin = all.filter((e) => !e.is_streamer).length, pl = b.row.status === "final" ? [] : play.filter((x) => !x.streamer); const rounds = plan.map(() => 0); for (const x of pl) rounds[Math.min(plan.length - 1, Math.max(0, x.idx))]++; return { joined: fin + pl.length, playing: pl.length, finished: fin, rounds }; })(), playing: b.row.status === "final" ? 0 : play.length, playingList: b.row.status === "final" ? [] : play.slice(0, 40).map((x, i) => ({ key: hide ? `p${i}` : x.key.slice(-8), nick: x.streamer || !hide ? x.nick : `시청자 ${i + 1}`, idx: x.idx, of: x.of, mission: x.mission, text: x.text, streamer: !!x.streamer })) };
  if (s.streamerScore && s.avgTotal != null) { s.beatStreamer = Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100); s.vs = { streamer: s.streamerScore.total, viewers: s.avgTotal, win: s.streamerScore.total > s.avgTotal }; }
  return s;
}
function markDirty(b) { b.dirty = true; REST_CACHE.delete(b.row.id); if (b.timer) return; b.timer = setTimeout(() => { b.timer = null; b.stats = computeBcStats(b); b.dirty = false; b.at = now(); IO?.to(bcRoom(b.row.id)).emit("glb:stats", b.stats); }, Math.max(0, fast(STATS_MS) - (now() - b.at))); b.timer.unref?.(); }
function getStats(b) { if (b.row.final_stats) return b.row.final_stats; const stale = b.stats && (b.stats.open !== isOpen(b) || b.stats.closesAt !== b.row.closes_at || b.stats.status !== b.row.status); if (!b.stats || stale || (b.dirty && now() - b.at > STATS_MS)) { b.stats = computeBcStats(b); b.dirty = false; b.at = now(); } return b.stats; }
async function finalizeIfDue(b, force = false) {
  if (b.row.status === "final") return;
  if (b.row.status === "wait" && !force) { if (now() - new Date(b.row.created_at).getTime() > MAX_DEADLINE_MIN * 60000) force = true; else return; }
  if (!force && now() < acceptsUntil(b)) return;
  b.row.status = "final"; const stats = computeBcStats(b); stats.status = "final"; stats.open = false; stats.finalAt = new Date().toISOString(); b.row.final_stats = stats; REST_CACHE.delete(b.row.id);
  if (SB) await SB.from("gamelab_broadcasts").update({ status: "final", final_stats: stats, finalized_at: stats.finalAt }).eq("id", b.row.id);
  IO?.to(bcRoom(b.row.id)).emit("glb:stats", stats);
}
/** gamelab.js 결과 저장에 거는 고리: 저장 전 검사 + 저장 뒤 집계 */
const hooks = {
  async check(bcid, key, { mode, diff, plan }, startedAt) {
    const b = await loadBc(bcid); if (!b) return { ok: false, error: "BC_NOT_FOUND" };
    if (b.row.status === "final") return { ok: false, error: "BC_FINAL" };
    if (mode !== b.row.mode || diff !== b.row.diff || plan.join() !== C.plan(b.row.mode).join()) return { ok: false, error: "BC_MODE" };
    if (b.row.status === "wait" || (Number(startedAt) > 0 && Number(startedAt) > new Date(b.row.closes_at).getTime()) || now() > acceptsUntil(b)) return { ok: false, error: "BC_CLOSED" };
    if (b.entries.has(key)) return { ok: false, error: "ALREADY" };
    return { ok: true, isOwner: b.row.owner_key === key };
  },
  done(bcid, row) { const b = BC.get(bcid); if (!b) return null; b.entries.set(row.owner_key, row); b.playing.delete(row.owner_key); markDirty(b); const rank = row.is_streamer || row.flagged || row.tier === C.UNRATED ? null : [...b.entries.values()].filter((x) => !x.flagged && !x.is_streamer && x.tier !== C.UNRATED && x.total > row.total).length + 1; return { rank, counted: rank != null, streamer: row.is_streamer }; },
};

export function registerGamelabLive(io, supabaseAdmin, app, { memberProfile, getOptionalUser } = {}) {
  SB = supabaseAdmin; IO = io; setGamelabHooks(hooks);
  setInterval(() => { for (const b of BC.values()) { finalizeIfDue(b).catch(() => {}); let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) markDirty(b); } if (playHits.size > 20000) playHits.clear(); }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = me.isGuest ? `g:${me.id}` : `u:${me.id}`; let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "glm:progress" || ev === "glm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.GAMELAB_RL || 50); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    const nameFor = async (p) => { const mp = !me.isGuest && memberProfile ? await memberProfile(supabaseAdmin, me) : null; return { nick: clean(mp?.nickname || p.nick, 12) || `게스트${Math.floor(Math.random() * 900 + 100)}`, avatarUrl: mp?.avatar_url || null }; };

    on("glm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("glm:create", async (p, reply) => {
      { const _f = createFlight("glm", me?.id, reply); if (!_f) return; reply = _f; }
      if (me.isGuest) { const ip = sockIp(socket), n = now(), arr = (roomMakes.get(ip) || []).filter((t) => n - t < GUEST_ROOM_WIN); if (arr.length >= GUEST_ROOM_MAX) return reply({ ok: false, error: "RATE_LIMITED" }); roomMakes.set(ip, [...arr, n]); if (roomMakes.size > 5000) roomMakes.clear(); }
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "glm" + now().toString(36) + Math.random().toString(36).slice(2, 6), set = okSet(p.set), single = C.byId[p.single] ? p.single : "dodge";
      const r = { id, code: genCode(), host: me.id, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), set, single, time: okScale(p.time), allowWatch: p.allowWatch !== false, diff: okDiff(p.diff), plan: pickPlan(set, single), phase: "lobby", round: -1, players: new Map(), order: [], phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin, isPublic: !!p.isPublic, spec: new Set(), leader: null, startedAt: now() };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const nm = await nameFor(p), pl = newPlayer(nm.nick, !!me.isGuest, socket.id, p.device); pl.avatarUrl = nm.avatarUrl; r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    const failJoin = () => { const jf = joinFails.get(me.id), f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); };
    on("glm:join", async (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null; if (!r) { failJoin(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; const id = r.plan?.[r.round]; if (r.phase === "play" && id && !ex.scores[id]) ex.late = true; if (r.phase === "intro") ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); return emitRoom(io, r); }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" }); if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const nm = await nameFor(p); if (ROOMS.get(r.id) !== r) return reply({ ok: false, error: "NO_ROOM" }); if (r.players.has(me.id)) return reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true }); if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" }); if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const pl = newPlayer(nm.nick, !!me.isGuest, socket.id, p.device); pl.avatarUrl = nm.avatarUrl; r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("glm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); const ex = r.players.get(me.id); if (!ex) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; const id = r.plan?.[r.round]; if (r.phase === "play" && id && !ex.scores[id] && !p.inRound) ex.late = true;   // 새로고침으로 미션을 다시 시작하는 건 막음
      if (r.phase === "intro") ex.late = false; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    // 관전: 자리 차지 없이 읽기만. OBS 출력도 같음
    on("glm:watch", (p, reply) => {
      const jf = joinFails.get(me.id); if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null; if (!r) { failJoin(); return reply({ ok: false, error: "NO_ROOM" }); }
      if (!r.allowWatch && !r.players.has(me.id)) return reply({ ok: false, error: "WATCH_OFF" });
      if (r.spec.size >= MAX_SPEC && !r.spec.has(socket.id)) return reply({ ok: false, error: "ROOM_FULL" });
      r.spec.add(socket.id); socket.join(sockRoom(r.id)); socket.data.glmWatch = r.id; reply({ ok: true, room: pubRoom(r) }); emitRoom(io, r);
    });
    const hostRoom = (reply, lobby = true) => { const r = myRoom(); if (!r) { reply({ ok: false, error: "NOT_IN_ROOM" }); return null; } if (r.host !== me.id) { reply({ ok: false, error: "NOT_HOST" }); return null; } if (lobby && r.phase !== "lobby") { reply({ ok: false, error: "NOT_LOBBY" }); return null; } return r; };
    on("glm:options", (p, reply) => { const r = hostRoom(reply); if (!r) return; if (C.byId[p.single]) r.single = p.single; if (SETS[p.set] || C.byId[p.single] || p.reroll) { if (SETS[p.set]) r.set = p.set; r.plan = pickPlan(r.set, r.single); } if (p.time) r.time = okScale(p.time); if (p.allowWatch != null) { r.allowWatch = !!p.allowWatch; if (!r.allowWatch) { for (const sid of r.spec) { const s = io.sockets.sockets.get(sid); s?.emit("glm:closed", { reason: "WATCH_OFF" }); s?.leave(sockRoom(r.id)); } r.spec.clear(); } } if (p.diff) r.diff = okDiff(p.diff); if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers)); if (p.isPublic != null) r.isPublic = !!p.isPublic; reply({ ok: true }); emitRoom(io, r); });
    on("glm:nick", async (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); if (!me.isGuest) return reply({ ok: false, error: "MEMBER_NICK" }); const n = clean(p.nick, 12); if (!n) return reply({ ok: false, error: "NEED_NICK" }); r.players.get(me.id).name = n; reply({ ok: true }); emitRoom(io, r); });
    on("glm:ready", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" }); r.players.get(me.id).ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("glm:host", (p, reply) => { const r = hostRoom(reply, false); if (!r) return; if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" }); r.host = p.to; reply({ ok: true }); emitRoom(io, r); });
    on("glm:kick", (p, reply) => { const r = hostRoom(reply); if (!r) return; if (p.id === me.id) return reply({ ok: false, error: "BAD_TARGET" }); const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" }); io.to(t.socketId).emit("glm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id)); removePlayer(io, r, p.id); reply({ ok: true }); });
    on("glm:start", (_p, reply) => {
      const r = hostRoom(reply); if (!r) return; const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      if (live.length < 2) return reply({ ok: false, error: "NEED_TWO" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.final = null; r.lastRound = null; r.isPublic = false; r.leader = null; r.startedAt = now();
      for (const p of r.players.values()) { p.scores = {}; p.raws = {}; p.wins = 0; p.ready = false; p.trail = []; }
      reply({ ok: true }); startRound(io, r, 0);
    });
    // 진행 상황: 숫자·짧은 글만, 0.7초에 한 번 (방 전체 다시 보내지 않음 → 깜빡임·트래픽 방지)
    on("glm:progress", (p) => { const r = myRoom(); if (!r || r.phase !== "play") return; const pl = r.players.get(me.id), t = now(); if (!pl || t - pl.lastProg < PROGRESS_MS) return; pl.lastProg = t; pl.prog = { text: clean(p.text, 24), t: Math.max(0, Math.round(Number(p.t) || 0)) }; io.to(sockRoom(r.id)).emit("glm:prog", { id: me.id, ...pl.prog }); });
    on("glm:submit", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id), id = r.plan[r.round]; if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" }); if (pl.late) return reply({ ok: false, error: "LATE" }); if (pl.scores[id]) return reply({ ok: true, score: pl.scores[id].score, dup: true });
      const raw = p.raw && typeof p.raw === "object" && !Array.isArray(p.raw) && JSON.stringify(p.raw).length <= MAX_RAW ? p.raw : null; if (!raw) return reply({ ok: false, error: "BAD_RAW" });
      const cfg = cfgOfRoom(r, id), flag = suspicious(id, r.diff, raw) || (process.env.GAMELAB_FAST === "1" ? null : timeCheck(id, r.diff, raw, (now() - r.startAt) / 1000, cfg)), res = C.scoreMission(id, r.diff, raw, cfg);
      pl.scores[id] = { score: flag ? 0 : res.score, status: res.status, good: !flag && (res.status === "clear" || res.status === "win"), flag }; pl.raws[id] = raw; pl.prog = null;
      reply({ ok: true, score: pl.scores[id].score, status: res.status, flag }); emitRoom(io, r); maybeEndRound(io, r);
    });
    on("glm:rematch", (p, reply) => { const r = hostRoom(reply, false); if (!r) return; if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" }); if (SETS[p.set]) r.set = p.set; if (p.diff) r.diff = okDiff(p.diff); r.plan = pickPlan(r.set, r.single); r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.phaseEnd = null; r.leader = null; for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.scores = {}; pl.raws = {}; pl.wins = 0; pl.trail = []; pl.late = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } } reply({ ok: true }); emitRoom(io, r); });
    on("glm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });
    socket.on("disconnect", () => {
      if (socket.data.glmWatch) { const w = ROOMS.get(socket.data.glmWatch); if (w) { w.spec.delete(socket.id); emitRoom(io, w); } }
      const r = myRoom(); if (!r) return; const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return; pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, fast(LOBBY_DROP_MS)); }
      pl.dropAt = now(); if (r.phase === "play") { const rid = r.id, round = r.round; setTimeout(() => { const rr = ROOMS.get(rid); if (rr && rr.round === round) maybeEndRound(io, rr); }, fast(DROP_WAIT_MS) + 50).unref?.(); } pickHost(r); checkEmpty(io, r); emitRoom(io, r);   // 잠깐 끊겨도 미션은 계속: 시간 안에 다시 붙으면 제출 가능. 안 돌아오면 마감에 미제출
    });

    // ---------- 방송 ----------
    const bcOn = (ev, fn) => on(ev, fn);
    bcOn("glb:create", async (p, reply) => {
      { const _f = createFlight("glb", me?.id, reply); if (!_f) return; reply = _f; }
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) { if (!clean(p.streamerNick, 16)) return reply({ ok: false, error: "NEED_NICK" }); const ip = sockIp(socket), n = now(), arr = (ipMakes.get(ip) || []).filter((t) => n - t < GUEST_IP_WIN); if (arr.length >= GUEST_IP_MAX()) return reply({ ok: false, error: "RATE_LIMITED" }); ipMakes.set(ip, arr); }
      const mode = p.mode === "full" ? "full" : "quick", diff = okDiff(p.diff), mins = Math.min(MAX_DEADLINE_MIN, Math.max(5, Math.round(Number(p.minutes) || 30))), mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const nick = clean(mp?.nickname || p.streamerNick, 16) || "스트리머", title = clean(p.title, 40) || `${nick} 방송 게임 종합 진단소`;
      const { count } = await SB.from("gamelab_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN" });
      const startNow = p.wait !== true, row = { id: bcId(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, mode, diff, ver: C.VER, status: startNow ? "open" : "wait", closes_at: new Date(now() + (startNow ? mins : MAX_DEADLINE_MIN) * 60000).toISOString(), settings: { hideNicks: !!p.hideNicks, minutes: mins }, created_at: new Date().toISOString() };
      const { error } = await SB.from("gamelab_broadcasts").insert(row); if (error) { console.error("[glb] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      SB.from("streamer_chat_log").insert({ platform: "gamelab", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: "bc", room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error: le }) => { if (le) console.error("[glb] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), playing: new Map(), stats: null, dirty: true, at: 0, timer: null }); reply({ ok: true, bc: row });
    });
    bcOn("glb:mine", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("gamelab_broadcasts").select("id, title, mode, diff, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20); reply({ ok: true, rows: data || [] }); });
    bcOn("glb:watch", async (p, reply) => { const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); await finalizeIfDue(b); socket.join(bcRoom(b.row.id)); const mine = b.entries.get(key) || null; reply({ ok: true, stats: getStats(b), owner: b.row.owner_key === key, mine: mine ? { total: mine.total, tier: mine.tier, flagged: !!mine.flagged, streamer: !!mine.is_streamer, resultId: mine.id } : null }); });
    bcOn("glb:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      const upd = async (patch) => { if (SB) await SB.from("gamelab_broadcasts").update(patch).eq("id", b.row.id); }, setS = async (x) => { b.row.settings = { ...(b.row.settings || {}), ...x }; await upd({ settings: b.row.settings }); };
      if (p.action === "reveal") { if (b.row.status !== "final") return reply({ ok: false, error: "NOT_FINAL" }); const at = new Date().toISOString(); b.row.settings = { ...(b.row.settings || {}), revealAt: at }; if (b.row.final_stats) b.row.final_stats = { ...b.row.final_stats, revealAt: at }; await upd({ settings: b.row.settings, final_stats: b.row.final_stats }); REST_CACHE.delete(b.row.id); IO?.to(bcRoom(b.row.id)).emit("glb:stats", getStats(b)); return reply({ ok: true, stats: getStats(b) }); }
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") { const mins = Math.min(MAX_DEADLINE_MIN, Math.max(1, Math.round(Number(p.minutes) || 10))); b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString(); await upd({ closes_at: b.row.closes_at }); }
      else if (p.action === "close") { b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString(); await upd({ closes_at: b.row.closes_at }); }
      else if (p.action === "finalize") { if (isOpen(b)) return reply({ ok: false, error: "STILL_OPEN" }); await finalizeIfDue(b, true); }
      else if (p.action === "start") { if (b.row.status !== "wait") return reply({ ok: false, error: "NOT_WAITING" }); b.row.status = "open"; b.row.closes_at = new Date(now() + (b.row.settings?.minutes || 30) * 60000).toISOString(); await upd({ status: "open", closes_at: b.row.closes_at }); IO?.to(bcRoom(b.row.id)).emit("glb:start", { id: b.row.id }); }
      else if (p.action === "pause" || p.action === "resume") { if (b.row.status !== "open") return reply({ ok: false, error: "NOT_OPEN" }); await setS({ paused: p.action === "pause" }); }
      else if (p.action === "settings") await setS({ hideNicks: !!p.hideNicks });
      else return reply({ ok: false, error: "BAD_ACTION" });
      b.stats = null; markDirty(b); reply({ ok: true, stats: getStats(b) });
    });
  });

  if (!app) return;
  app.get("/gamelab/bc/:id", async (req, res) => {
    try { const id = String(req.params.id || "").slice(0, 16), c = REST_CACHE.get(id); if (c && now() - c.at < 1500) return res.json(c.body); const b = await loadBc(id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); await finalizeIfDue(b); const body = { ok: true, stats: getStats(b) }; REST_CACHE.set(id, { at: now(), body }); if (REST_CACHE.size > 500) REST_CACHE.clear(); res.json(body); }
    catch (e) { console.error("[glb/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 시청자가 검사를 시작할 수 있는지 + 방송 구성 (진단소 화면이 이걸로 난이도·구성을 고정)
  app.post("/gamelab/bc/:id/begin", async (req, res) => {
    try {
      const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); await finalizeIfDue(b);
      const key = await ownerOf(req, getOptionalUser); if (!key) return res.status(400).json({ ok: false, error: "NO_OWNER" });
      const info = { title: b.row.title, streamer: b.row.streamer_nick, mode: b.row.mode, diff: b.row.diff, owner: b.row.owner_key === key }, mine = b.entries.get(key);
      if (mine) return res.json({ ok: false, error: "ALREADY", ...info, mine: { total: mine.total, tier: mine.tier, resultId: mine.id } });
      if (b.row.status === "wait") return res.json({ ok: false, error: "BC_WAIT", ...info }); if (b.row.status === "final" || !isOpen(b)) return res.json({ ok: false, error: "BC_CLOSED", ...info }); if (b.row.settings?.paused) return res.json({ ok: false, error: "BC_PAUSED", ...info });
      res.json({ ok: true, ...info });
    } catch (e) { console.error("[glb/begin]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 시청자 진행 상황 (소켓을 새로 열지 않도록 HTTP · 사람당 2초에 한 번만 받음)
  app.post("/gamelab/bc/:id/play", async (req, res) => {
    try {
      const b = BC.get(String(req.params.id || "").slice(0, 16)) || (await loadBc(req.params.id)); if (!b || b.row.status === "final") return res.json({ ok: false });
      const key = await ownerOf(req, getOptionalUser); if (!key) return res.status(400).json({ ok: false }); const n = now(); if (n - (playHits.get(key) || 0) < 2000) return res.json({ ok: true, skip: true }); playHits.set(key, n);
      const x = req.body || {}, cur = b.playing.get(key); if (x.end) { if (b.playing.delete(key)) markDirty(b); return res.json({ ok: true }); }
      if (b.entries.has(key)) return res.json({ ok: true });
      b.playing.set(key, { key, since: cur?.since || n, at: n, nick: clean(x.nick, 12) || "시청자", idx: Math.max(0, Math.min(10, x.idx | 0)), of: Math.max(1, Math.min(10, x.of | 0)), mission: C.byId[x.mission] ? x.mission : null, text: clean(x.text, 24), streamer: b.row.owner_key === key });
      if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
      markDirty(b); res.json({ ok: true });
    } catch (e) { console.error("[glb/play]", e); res.status(500).json({ ok: false }); }
  });
}
export const _glTest = { ROOMS, CODES, USER_ROOM, BC };
addPublicRooms("gamelab", ROOMS);
