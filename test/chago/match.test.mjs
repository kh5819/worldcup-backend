// 차고차고 경기 규칙 테스트: node --test test/chago/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, matchAddPlayer, stepMatch, publicMatchState, finalStats, RULES, COUNTDOWN_SEC, GOAL_CELEBRATE_SEC, SHOOTOUT } from "../../src/chago-match.js";
import { getPlayer, DT } from "../../src/chago-engine.js";

const TPS = Math.round(1 / DT);

function mk(opts = {}) {
  const m = createMatch({ teamSize: 1, ...opts });
  matchAddPlayer(m, { id: "a", team: 0 });
  matchAddPlayer(m, { id: "b", team: 1 });
  return m;
}
function untilPhase(m, phase, maxTicks = TPS * 400, inputs) {
  for (let i = 0; i < maxTicks; i++) {
    if (m.phase === phase) return i;
    stepMatch(m, inputs ? inputs(i, m) : null);
  }
  throw new Error(`phase ${phase} 도달 실패 (현재 ${m.phase})`);
}
// 팀0 선수 a가 오른쪽 골대로 한 방에 넣는 장면
function scoreByA(m) {
  const w = m.world, a = getPlayer(w, "a");
  Object.assign(a, { x: 800, y: w.field.cy, vx: 0, vy: 0, ax: 1, ay: 0 });
  Object.assign(w.ball, { x: 831, y: w.field.cy, vx: 0, vy: 0 });
  for (let i = 0; i < 12; i++) stepMatch(m, { a: { ax: 1, shoot: true } });
  stepMatch(m, { a: { ax: 1, shoot: false } });
  for (let i = 0; i < TPS * 2 && m.phase === "play"; i++) stepMatch(m, null);
}

test("카운트다운 동안 입력이 무시되고 끝나면 경기 시작", () => {
  const m = mk();
  assert.equal(m.phase, "countdown");
  const a = getPlayer(m.world, "a"), x0 = a.x;
  for (let i = 0; i < TPS * 2; i++) stepMatch(m, { a: { mx: 1 } });
  assert.equal(a.x, x0, "카운트다운 중 이동 불가");
  untilPhase(m, "play");
  assert.ok(m.clock >= m.durationSec - 0.1);
});

test("시계는 play 단계에서만 줄고, 설정 시간이 정확히 반영된다", () => {
  for (const d of [120, 180, 300]) {
    const m = mk({ durationSec: d });
    untilPhase(m, "play");
    for (let i = 0; i < TPS * 10; i++) stepMatch(m, null);
    assert.ok(Math.abs(m.clock - (d - 10)) < 0.2, `${d}: ${m.clock}`);
  }
  assert.equal(createMatch({ durationSec: 999 }).durationSec, 180, "허용 외 시간은 기본값");
});

test("골: 점수 +1, 세레머니 3초 동안 시계 정지·입력 무시, 이후 킥오프로 전원 제자리", () => {
  const m = mk();
  untilPhase(m, "play");
  scoreByA(m);
  assert.equal(m.phase, "goal");
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.goals.length, 1);
  assert.equal(m.goals[0].scorer, "a");
  const clock0 = m.clock;
  const b = getPlayer(m.world, "b"), bx = b.x;
  for (let i = 0; i < TPS * 2; i++) stepMatch(m, { b: { mx: 1 } });
  assert.equal(m.clock, clock0, "세레머니 중 시계 정지");
  assert.equal(b.x, bx, "세레머니 중 입력 무시");
  untilPhase(m, "countdown");
  assert.equal(m.world.goalFlag, false);
  assert.equal(m.world.ball.x, m.world.field.W / 2);
  assert.equal(m.kickoffTeam, 1, "실점한 팀이 킥오프");
  untilPhase(m, "play");
  assert.deepEqual(m.score, [1, 0]);
});

test("시간 종료: 점수가 다르면 앞선 팀 승리", () => {
  const m = mk({ durationSec: 120 });
  untilPhase(m, "play");
  scoreByA(m);
  untilPhase(m, "ended");
  assert.equal(m.winner, 0);
  assert.equal(m.endReason, "time");
});

test("동점: 연장 골든골 → 먼저 넣은 팀이 즉시 승리", () => {
  const m = mk({ durationSec: 120 });
  untilPhase(m, "play");
  untilPhase(m, "overtime");
  assert.equal(m.overtime, true);
  assert.equal(m.phase, "overtime");
  scoreByA(Object.assign(m, {}));
  // scoreByA는 play 단계만 기다리므로 연장에서도 골 처리만 확인
  for (let i = 0; i < TPS * 3 && m.phase !== "ended"; i++) stepMatch(m, null);
  assert.equal(m.phase, "ended");
  assert.equal(m.winner, 0);
  assert.equal(m.endReason, "golden_goal");
  assert.ok(m.goals[0].overtime);
});

test("친선 동점: 연장에서도 득점이 없으면 무승부", () => {
  const m = mk({ durationSec: 120, mode: "friendly" });
  untilPhase(m, "ended", TPS * 400);
  assert.equal(m.winner, null);
  assert.equal(m.endReason, "draw");
  assert.deepEqual(m.score, [0, 0]);
});

test("연장 시간은 규칙대로(90초)이고, 경쟁전은 승부차기까지 열려 있다", () => {
  assert.equal(RULES.friendly.overtimeSec, 90);
  assert.equal(RULES.friendly.enabled, true);
  assert.equal(RULES.ranked.enabled, true);
  assert.equal(RULES.ranked.tiebreak, "shootout");
  const m = mk({ durationSec: 120 });
  const t = untilPhase(m, "overtime");
  const ot = untilPhase(m, "ended");
  assert.ok(Math.abs(ot * DT - 90) < 1.5, `연장 ${ot * DT}s`);
  void t;
});

test("종료 시각에 터진 골은 인정되고 세레머니 후 종료 판정", () => {
  const m = mk({ durationSec: 120 });
  untilPhase(m, "play");
  m.clock = 3;                                          // 곧 종료(공이 도달할 시간은 충분)
  scoreByA(m);                                          // 이 안에 골이 들어간다
  if (m.phase === "goal") untilPhase(m, "ended");
  assert.equal(m.phase, "ended");
  assert.equal(m.winner, 0);
});

test("공개 상태: 직렬화 가능, 필요한 값만", () => {
  const m = mk();
  const s = publicMatchState(m);
  assert.ok(JSON.stringify(s).length < 300);
  for (const k of ["phase", "clock", "score", "overtime", "winner"]) assert.ok(k in s);
  assert.equal(COUNTDOWN_SEC, 3);
  assert.equal(GOAL_CELEBRATE_SEC, 3);
});

// ================= 승부차기 · 통계 =================
function toShootout(teamSize = 1) {
  const m = createMatch({ teamSize, durationSec: 120, mode: "ranked" });
  for (let t = 0; t < teamSize; t++) { matchAddPlayer(m, { id: String(t), team: 0, slot: t }); matchAddPlayer(m, { id: String(teamSize + t), team: 1, slot: t }); }
  let guard = 0;
  while (m.phase !== "shootout" && m.phase !== "ended" && guard++ < 30 * 400) stepMatch(m, null);
  return m;
}
// plan(team, n번째 시도) → 'goal' | 'save' | 'miss'
function drive(m, plan) {
  let guard = 0;
  const seen = {};
  while (m.phase !== "ended" && guard++ < 30 * 60 * 30) {
    let inputs = null;
    if (m.phase === "shootout" && m.so.state === "live") {
      const so = m.so, dir = so.atk === 0 ? 1 : -1;
      const k = so.marks[so.atk].length, what = plan(so.atk, k);
      const n = Math.round(so.liveT / DT);
      if (what !== "miss") {
        const ay = what === "goal" ? 0.27 : 0;
        inputs = { [so.kicker]: { ax: dir, ay, shoot: n < 10 } };
      }
      seen.last = what;
    }
    stepMatch(m, inputs);
  }
  return m;
}

test("승부차기: 동점이면 연장 뒤 승부차기로 가고, 키커·키퍼가 정해진다", () => {
  const m = toShootout();
  assert.equal(m.phase, "shootout");
  assert.ok(m.overtime && m.so);
  const st = publicMatchState(m);
  assert.equal(st.so.per, 5);
  assert.ok(st.so.kicker != null && st.so.keeper != null && st.so.kicker !== st.so.keeper);
  assert.equal(st.mode, "ranked");
});

test("승부차기: 한 팀만 계속 넣으면 승부가 확정되는 즉시(남은 시도로 못 따라잡을 때) 끝난다", () => {
  const m = drive(toShootout(), (team) => (team === 0 ? "goal" : "miss"));
  assert.equal(m.phase, "ended");
  assert.equal(m.endReason, "shootout");
  assert.equal(m.winner, 0);
  assert.deepEqual(m.so.score[0] > m.so.score[1], true);
  // 3-0 이 되면 상대의 남은 2번으로도 못 따라잡으므로 팀0 3번, 팀1 3번 시도에서 끝나야 함
  assert.ok(m.so.marks[0].length <= 4 && m.so.marks[1].length <= 4, `시도 ${m.so.marks[0].length}:${m.so.marks[1].length}`);
});

test("승부차기: 5번씩 비기면 서든데스로 이어지고, 먼저 한 번 더 넣은 쪽이 이긴다", () => {
  const m = drive(toShootout(), (team, k) => (k < 5 ? "goal" : team === 0 ? "goal" : "miss"));
  assert.equal(m.phase, "ended");
  assert.equal(m.so.marks[0].length, m.so.marks[1].length);
  assert.ok(m.so.marks[0].length >= 6, "서든데스 라운드가 있었음");
  assert.equal(m.winner, 0);
  assert.equal(m.so.score[0], m.so.score[1] + 1);
});

test("승부차기: 키퍼가 슛 경로에 있으면 선방(saved)으로 기록된다 / 안 차면 시간 초과로 실축", () => {
  const m = toShootout();
  const results = [];
  let guard = 0;
  while (results.length < 2 && guard++ < 30 * 200) {
    let inputs = null;
    if (m.phase === "shootout" && m.so.state === "live") {
      const dir = m.so.atk === 0 ? 1 : -1, n = Math.round(m.so.liveT / DT);
      if (results.length === 0) inputs = { [m.so.kicker]: { ax: dir, ay: 0, shoot: n < 12 } };    // 정면 → 키퍼가 선 자리
    }
    const evs = stepMatch(m, inputs);
    for (const e of evs) if (e.type === "soResult") results.push(e.result);
  }
  assert.deepEqual(results, ["saved", "miss"]);
  assert.ok(SHOOTOUT.kickTimeoutSec >= 5);
});

test("통계·MVP: 득점/도움/슛이 집계되고 평점 최고 선수가 MVP", () => {
  const m = createMatch({ teamSize: 2, durationSec: 120, mode: "friendly" });
  for (const [id, team, slot] of [["0", 0, 0], ["1", 0, 1], ["2", 1, 0], ["3", 1, 1]]) matchAddPlayer(m, { id, team, slot });
  for (let t = 0; t < 100; t++) stepMatch(m, null);
  const w = m.world; const p0 = getPlayer(w, "0"), p1 = getPlayer(w, "1");
  Object.assign(p0, { x: 500, y: 290 }); Object.assign(p1, { x: 760, y: 290 }); Object.assign(getPlayer(w, "2"), { x: 100, y: 80 }); Object.assign(getPlayer(w, "3"), { x: 100, y: 500 });
  Object.assign(w.ball, { x: 531, y: 290, vx: 0, vy: 0 });
  stepMatch(m, { 0: { ax: 1, ay: 0, pass: true } }); stepMatch(m, { 0: { ax: 1, ay: 0, pass: false } });
  for (let t = 0; t < 70; t++) stepMatch(m, null);
  Object.assign(w.ball, { x: p1.x + 31, y: p1.y, vx: 0, vy: 0 }); p1.vx = p1.vy = 0; p1.kickCd = 0;
  for (let t = 0; t < 10; t++) stepMatch(m, { 1: { ax: 1, ay: 0, shoot: true } });
  stepMatch(m, { 1: { ax: 1, ay: 0, shoot: false } });
  for (let t = 0; t < 60 && m.phase === "play"; t++) stepMatch(m, null);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.stats["1"].goals, 1); assert.equal(m.stats["1"].shots, 1); assert.equal(m.stats["0"].assists, 1); assert.equal(m.stats["0"].passes, 1);
  while (m.phase !== "ended" && m.phase !== undefined) stepMatch(m, null);
  const f = finalStats(m);
  assert.equal(f.mvp, "1", "득점자가 MVP");
  assert.ok(f.rows.find((r) => r.eid === "1").rating > f.rows.find((r) => r.eid === "0").rating);
});

test("승부차기: 서든데스가 5번을 더 해도 같으면 동전(coin)으로 승자를 정해 반드시 끝난다", () => {
  const m = drive(toShootout(), () => "goal");
  assert.equal(m.phase, "ended");
  assert.equal(m.so.marks[0].length, SHOOTOUT.perTeam + SHOOTOUT.suddenMax);
  assert.ok(m.winner === 0 || m.winner === 1);
  assert.equal(m.so.score[0], m.so.score[1]);
});

test("MVP: 아무 기여가 없으면(모두 0점) MVP 없음, 기여가 있으면 이긴 팀 보너스가 반영된다", async () => {
  const { pickMvp, newStats } = await import("../../src/chago-stats.js");
  const players = [{ eid: "0", team: 0 }, { eid: "1", team: 1 }];
  assert.equal(pickMvp({ 0: newStats(), 1: newStats() }, players, 0), null);
  const a = { ...newStats(), goals: 1 }, b = { ...newStats(), goals: 1, assists: 1 };
  assert.equal(pickMvp({ 0: a, 1: b }, players, 1), "1");
  assert.equal(pickMvp({ 0: a, 1: { ...newStats(), onTarget: 1 } }, players, 0), "0", "이긴 팀 + 득점");
});
