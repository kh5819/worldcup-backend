// =========================
// 차고차고 — 경기 규칙 (서버 전용): 킥오프/골/타이머/연장전/종료
// 물리는 chago-engine.js, 방·네트워크는 chago.js. 여기는 "지금 어떤 단계인가"만 다룬다.
//
// 단계 흐름
//   countdown(3초, 전원 정지) → play(시계 진행) → goal(세레머니 3초, 시계 정지) → countdown …
//   시간 종료 시: 점수 다르면 ended / 같으면 모드 규칙대로 overtime(골든골) → 그래도 같으면 tiebreak
//
// 모드별 규칙 (명시)
//   friendly(친선): 연장 골든골 90초 → 그래도 같으면 무승부로 종료
//   ranked(경쟁): 연장 골든골 90초 → 승부차기(팀당 5번, 동점이면 서든데스). 순위·시즌 기록은 6단계
// =========================

import { createWorld, addPlayer, removePlayer, resetPositions, stepWorld, NEUTRAL_INPUT, DT } from "./chago-engine.js";
import { newStats, applyEvents, rating, pickMvp } from "./chago-stats.js";

export const RULES = Object.freeze({
  friendly: { enabled: true, overtimeSec: 90, tiebreak: "draw" },
  ranked: { enabled: true, overtimeSec: 90, tiebreak: "shootout" },
});
export const ALLOWED_DURATIONS = [120, 180, 300];      // 초 (2/3/5분)
export const DEFAULT_DURATION = 180;
export const COUNTDOWN_SEC = 3;
export const GOAL_CELEBRATE_SEC = 3;
export const MAX_GOALS_LEAD = 0;                       // 0 = 점수차로 조기 종료 없음

export function createMatch({ teamSize = 2, durationSec = DEFAULT_DURATION, mode = "friendly" } = {}) {
  const rules = RULES[mode] || RULES.friendly;
  const dur = ALLOWED_DURATIONS.includes(durationSec) ? durationSec : DEFAULT_DURATION;
  const world = createWorld({ teamSize });
  return {
    mode, rules, teamSize,
    durationSec: dur,
    world,
    phase: "countdown",
    phaseT: COUNTDOWN_SEC,        // 현재 단계 남은 시간(초)
    clock: dur,                   // 남은 경기 시간(초) — play 중에만 줄어든다
    overtime: false,
    score: [0, 0],
    goals: [],                    // {team, scorer, own, at(남은시간|연장 경과)}
    winner: null,                 // 0 | 1 | null(무승부)
    endReason: null,
    events: [],
    kickoffTeam: 0,
    stats: {},                    // eid → 통계(chago-stats.js)
    so: null,                     // 승부차기 상태
  };
}

export function matchAddPlayer(m, p) { m.stats[p.id] = newStats(); return addPlayer(m.world, p); }
export function matchRemovePlayer(m, id) { removePlayer(m.world, id); }

function enter(m, phase, sec) { m.phase = phase; m.phaseT = sec; }

function startKickoff(m) {
  resetPositions(m.world);
  enter(m, "countdown", COUNTDOWN_SEC);
}

function endMatch(m, winner, reason) {
  m.winner = winner; m.endReason = reason;
  enter(m, "ended", 0);
  m.events.push({ type: "end", winner, reason });
}

// 한 틱 진행. inputs = { playerId: 입력 }
export function stepMatch(m, inputs) {
  m.events = [];
  const w = m.world;
  switch (m.phase) {
    case "countdown": {
      // 전원 정지: 입력 무시. 카운트다운이 끝나면 play
      stepWorld(w, null);
      m.phaseT -= DT;
      if (m.phaseT <= 0) { enter(m, m.overtime ? "overtime" : "play", 0); m.events.push({ type: "whistle" }); }
      break;
    }
    case "play":
    case "overtime": {
      const evs = stepWorld(w, inputs);
      for (const e of evs) m.events.push(e);
      applyEvents(m.stats, evs);
      if (m.phase === "play") m.clock = Math.max(0, m.clock - DT);
      else m.phaseT += DT;                             // 연장은 경과시간
      const goal = evs.find((e) => e.type === "goal");
      if (goal) {
        m.score[goal.team] += 1;
        m.goals.push({ team: goal.team, scorer: goal.scorer, own: goal.own, at: m.phase === "play" ? m.durationSec - m.clock : m.durationSec + m.phaseT, overtime: m.phase === "overtime" });
        m.kickoffTeam = 1 - goal.team;
        if (m.phase === "overtime") { endMatch(m, goal.team, "golden_goal"); break; }
        enter(m, "goal", GOAL_CELEBRATE_SEC);
        break;
      }
      if (m.phase === "play" && m.clock <= 0) onRegulationEnd(m);
      else if (m.phase === "overtime" && m.phaseT >= m.rules.overtimeSec) onOvertimeEnd(m);
      break;
    }
    case "goal": {
      // 세레머니 동안은 입력을 받지 않고 공만 굴러간다
      const evs = stepWorld(w, null);
      for (const e of evs) if (e.type !== "goal") m.events.push(e);
      m.phaseT -= DT;
      if (m.phaseT <= 0) {
        // 마지막 골이 시간 종료 후였거나 시계가 0이면 이제 종료 판정
        if (m.clock <= 0 && !m.overtime) onRegulationEnd(m);
        else startKickoff(m);
      }
      break;
    }
    case "shootout":
      stepShootout(m, inputs);
      break;
    case "ended":
    default:
      break;
  }
  return m.events;
}

function onRegulationEnd(m) {
  if (m.score[0] !== m.score[1]) return endMatch(m, m.score[0] > m.score[1] ? 0 : 1, "time");
  if (m.rules.overtimeSec > 0) {
    m.overtime = true;
    m.events.push({ type: "overtimeStart" });
    startKickoff(m);
    m.phaseT = COUNTDOWN_SEC;
    return;
  }
  endMatch(m, null, "draw");
}

function onOvertimeEnd(m) {
  if (m.rules.tiebreak === "shootout") return startShootout(m);
  endMatch(m, null, "draw");
}

// =========================
// 승부차기: 팀당 5번 번갈아, 5번 뒤에도 같으면 한 번씩 서든데스.
//   공격 차례 팀의 키커 1명 vs 수비 팀 키퍼(슬롯이 가장 낮은 선수). 나머지는 터치라인에서 구경(입력 무시).
//   결과: 골 / 선방 / 실축(공이 멈추거나 시간 초과). 슛은 일반 경기와 같은 세기라 키퍼는 반응보다 예측(미리 한쪽에 걸기)이 중요.
// =========================
export const SHOOTOUT = Object.freeze({ perTeam: 5, spotDist: 220, introSec: 2.6, resultSec: 2.2, kickTimeoutSec: 10, settleSec: 3.5, powerScale: 1, keeperReach: 140, suddenMax: 5 });

function soPlayers(m, team) { return m.world.players.filter((p) => p.team === team).sort((a, b) => a.slot - b.slot); }
const soGoalX = (m, team) => (team === 0 ? m.world.field.W : 0);       // team 이 공격하는 골대의 x
const soDir = (team) => (team === 0 ? 1 : -1);

function startShootout(m) {
  if (!soPlayers(m, 0).length || !soPlayers(m, 1).length) return endMatch(m, null, "draw");   // 한 팀이 비어 있으면 승부차기 불가
  m.world.field.power *= SHOOTOUT.powerScale;
  m.so = { state: "intro", t: SHOOTOUT.introSec, first: m.world.tick % 2, coin: (m.world.tick >> 1) % 2, marks: [[], []], score: [0, 0], atk: 0, kicker: null, keeper: null, attempt: 0, liveT: 0, kicked: false, kickT: 0, saveSeen: false, still: 0, result: null };
  enter(m, "shootout", 0);
  m.events.push({ type: "shootoutStart" });
  prepareAttempt(m);
}

function prepareAttempt(m) {
  const so = m.so, w = m.world, f = w.field;
  const n = so.marks[0].length + so.marks[1].length;
  so.atk = (so.first + n) % 2;
  const kickers = soPlayers(m, so.atk), keepers = soPlayers(m, 1 - so.atk);
  const kicker = kickers[so.marks[so.atk].length % kickers.length], keeper = keepers[0];
  so.kicker = kicker.id; so.keeper = keeper.id;
  so.attempt += 1; so.state = "intro"; so.t = SHOOTOUT.introSec; so.liveT = 0; so.kicked = false; so.saveSeen = false; so.still = 0; so.result = null;
  resetPositions(w);
  const dir = soDir(so.atk), gx = soGoalX(m, so.atk), sx = gx - dir * SHOOTOUT.spotDist;
  Object.assign(w.ball, { x: sx, y: f.cy, vx: 0, vy: 0 });
  Object.assign(kicker, { x: sx - dir * 36, y: f.cy, fx: dir, fy: 0, ax: dir, ay: 0 });
  Object.assign(keeper, { x: gx - dir * 26, y: f.cy, fx: -dir, fy: 0, ax: -dir, ay: 0 });
  let k = 0;
  for (const p of w.players) {
    if (p === kicker || p === keeper) continue;
    Object.assign(p, { x: f.W * 0.3 + (k++ % 8) * 62, y: p.team === 0 ? 38 : f.H - 38, vx: 0, vy: 0 });   // 터치라인에서 구경
  }
}

function resolveAttempt(m, result) {
  const so = m.so;
  so.state = "result"; so.t = SHOOTOUT.resultSec; so.result = result;
  so.marks[so.atk].push(result === "goal" ? 1 : 0);
  if (result === "goal") so.score[so.atk] += 1;
  m.events.push({ type: "soResult", team: so.atk, kicker: so.kicker, result, score: so.score.slice() });
}

function shootoutWinner(so) {
  const [na, nb] = [so.marks[0].length, so.marks[1].length], [sa, sb] = so.score, per = SHOOTOUT.perTeam;
  if (na < per || nb < per) {
    if (sa > sb + (per - nb)) return 0;
    if (sb > sa + (per - na)) return 1;
    return null;
  }
  if (na === nb && sa !== sb) return sa > sb ? 0 : 1;
  if (na === nb && na >= per + SHOOTOUT.suddenMax) return so.coin;      // 서든데스 5번을 더 해도 같으면 동전 던지기(시작할 때 정해 둔 값)
  return null;
}

function stepShootout(m, inputs) {
  const so = m.so, w = m.world;
  if (so.state === "intro") {
    stepWorld(w, null);
    so.t -= DT;
    if (so.t <= 0) { so.state = "live"; m.events.push({ type: "whistle" }); }
    return;
  }
  if (so.state === "result") {
    const evs = stepWorld(w, null);
    for (const e of evs) if (e.type !== "goal") m.events.push(e);
    so.t -= DT;
    if (so.t <= 0) {
      const win = shootoutWinner(so);
      if (win != null) return endMatch(m, win, "shootout");
      prepareAttempt(m);
    }
    return;
  }
  // live: 키커·키퍼만 입력을 받는다
  const ins = {};
  if (inputs) { if (!so.kicked) ins[so.kicker] = inputs[so.kicker]; ins[so.keeper] = inputs[so.keeper]; }
  const evs = stepWorld(w, ins);
  for (const e of evs) m.events.push(e);
  so.liveT += DT;
  // 키퍼는 골문 가까이에서만 움직인다
  const keeper = w.players.find((p) => p.id === so.keeper), dir = soDir(so.atk), gx = soGoalX(m, so.atk);
  const lo = Math.min(gx - dir * SHOOTOUT.keeperReach, gx - dir * 20), hi = Math.max(gx - dir * SHOOTOUT.keeperReach, gx - dir * 20);
  keeper.x = Math.max(lo, Math.min(hi, keeper.x));
  for (const e of evs) {
    if (e.type === "kick" && e.id === so.kicker && e.kind === "shot" && !so.kicked) { so.kicked = true; so.kickT = so.liveT; }
    if (e.type === "save") so.saveSeen = true;
    if (e.type === "goal" && e.team === so.atk) return resolveAttempt(m, "goal");
  }
  const sp = Math.hypot(w.ball.vx, w.ball.vy);
  so.still = so.kicked && sp < 40 ? so.still + DT : 0;
  if (so.kicked && (so.still >= 0.5 || so.liveT - so.kickT > SHOOTOUT.settleSec)) return resolveAttempt(m, so.saveSeen ? "saved" : "miss");
  if (!so.kicked && so.liveT > SHOOTOUT.kickTimeoutSec) return resolveAttempt(m, "miss");
}

export function shootoutRoles(m) { return m.so ? { kicker: m.so.kicker, keeper: m.so.keeper, state: m.so.state } : null; }

// 최종 통계(이름은 서버에서 붙인다). eid → 통계 + 평점, MVP
export function finalStats(m) {
  const players = m.world.players.map((p) => ({ eid: p.id, team: p.team }));
  const rows = players.map((pl) => ({ eid: pl.eid, team: pl.team, ...(m.stats[pl.eid] || newStats()), rating: rating(m.stats[pl.eid] || newStats()) }));
  return { rows, mvp: pickMvp(m.stats, players, m.winner) };
}

// 클라이언트로 보내는 경기 상태 (물리 스냅샷과 별도, 값이 바뀔 때만)
export function publicMatchState(m) {
  return {
    phase: m.phase,
    phaseT: Math.max(0, Math.round(m.phaseT * 10) / 10),
    clock: Math.ceil(m.clock),
    overtime: m.overtime,
    overtimeSec: m.rules.overtimeSec,
    score: m.score.slice(),
    winner: m.winner,
    endReason: m.endReason,
    durationSec: m.durationSec,
    teamSize: m.teamSize,
    mode: m.mode,
    so: m.so ? { state: m.so.state, atk: m.so.atk, kicker: m.so.kicker, keeper: m.so.keeper, marks: m.so.marks.map((a) => a.slice()), score: m.so.score.slice(), attempt: m.so.attempt, per: SHOOTOUT.perTeam, result: m.so.result } : null,
  };
}

export { NEUTRAL_INPUT };
