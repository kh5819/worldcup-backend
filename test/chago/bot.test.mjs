// 차고차고 AI 봇 테스트: 봇끼리 실제 경기를 돌려 품질 지표와 난이도 순서를 검증 (시드 고정 → 재현 가능)
import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../../scripts/bot-sim-chago.mjs";
import { createMatch, matchAddPlayer, stepMatch } from "../../src/chago-match.js";
import { createBot, botInput, roleFor, BOT_LEVELS } from "../../src/chago-bot.js";
import { DT, PHYS } from "../../src/chago-engine.js";

function battle(size, la, lb, n, dur = 180) {
  const r = { a: 0, b: 0, d: 0, goals: 0, zero: 0, maxStill: 0, oof: 0, cluster: 0, csamp: 0 };
  for (let i = 1; i <= n; i++) {
    const { m, stats } = simulate({ teamSize: size, levels: [la, lb], durationSec: dur, seed: i });
    if (m.winner === 0) r.a++; else if (m.winner === 1) r.b++; else r.d++;
    const g = m.score[0] + m.score[1]; r.goals += g; if (g === 0) r.zero++;
    r.maxStill = Math.max(r.maxStill, stats.maxBallStill * DT); r.oof += stats.outOfField;
    r.cluster += stats.chaserCluster; r.csamp += stats.clusterSamples;
  }
  return r;
}

test("봇 경기 품질: 모든 인원에서 득점이 나고, 공이 오래 멈추지 않고, 경기장을 벗어나지 않는다", () => {
  for (const size of [1, 2, 3, 4]) {
    const r = battle(size, "normal", "normal", 12);
    assert.equal(r.oof, 0, `${size}v${size} 경기장 이탈`);
    assert.ok(r.maxStill < 6, `${size}v${size} 공 최장 정지 ${r.maxStill.toFixed(1)}s`);
    assert.equal(r.zero, 0, `${size}v${size} 무득점 경기 ${r.zero}`);
    assert.ok(r.goals / 12 >= 2 && r.goals / 12 <= 14, `${size}v${size} 경기당 득점 ${(r.goals / 12).toFixed(1)}`);
  }
});

test("공 몰림 방지: 같은 팀 3명 이상이 공 주변 150px에 모이는 시간이 15% 미만 (4대4)", () => {
  const r = battle(4, "normal", "normal", 10);
  assert.ok(r.cluster / r.csamp < 0.15, `몰림 ${(r.cluster / r.csamp * 100).toFixed(1)}%`);
});

test("난이도 순서: 보통 > 쉬움, 어려움 > 보통 (인원별 30경기, 60% 이상 승리)", () => {
  for (const size of [1, 3]) {
    const n = 30;
    const ne = battle(size, "normal", "easy", n);
    assert.ok(ne.a >= n * 0.6 && ne.a > ne.b * 2, `${size}v${size} 보통 vs 쉬움 ${ne.a}:${ne.b}`);
    const hn = battle(size, "hard", "normal", n);
    assert.ok(hn.a >= n * 0.6 && hn.a > hn.b * 2, `${size}v${size} 어려움 vs 보통 ${hn.a}:${hn.b}`);
  }
});

test("구석 탈출: 공이 네 구석 어디에 있어도 봇(양 팀)이 4초 안에 공을 구석 밖으로 빼낸다", () => {
  const W = 1000, H = 580;
  const corners = [[11, 11], [W - 11, 11], [11, H - 11], [W - 11, H - 11]];
  for (const team of [0, 1]) for (const [cx, cy] of corners) {
    const m = createMatch({ teamSize: 2, durationSec: 180 });
    matchAddPlayer(m, { id: "0", team: 0, slot: 1 }); matchAddPlayer(m, { id: "1", team: 1, slot: 1 });
    const bots = [createBot({ eid: 0, team: 0, slot: 1, teamSize: 2, level: "normal", seed: 5 }), createBot({ eid: 1, team: 1, slot: 1, teamSize: 2, level: "normal", seed: 6 })];
    for (let t = 0; t < 120; t++) stepMatch(m, null);
    const w = m.world; const me = w.players[team], other = w.players[1 - team];
    Object.assign(other, { x: W / 2, y: H / 2 });
    Object.assign(me, { x: cx + (cx < W / 2 ? 90 : -90), y: cy + (cy < H / 2 ? 90 : -90) });
    Object.assign(w.ball, { x: cx, y: cy, vx: 0, vy: 0 });
    let out = -1;
    for (let t = 0; t < 30 * 8 && out < 0; t++) {
      stepMatch(m, { [String(team)]: botInput(bots[team], w, w.tick), [String(1 - team)]: null });
      const b = w.ball;
      if (Math.hypot(b.x - cx, b.y - cy) > 130) out = t;
    }
    assert.ok(out >= 0 && out * DT <= 4.5, `팀${team} 구석(${cx},${cy}) 탈출 ${out < 0 ? "실패" : (out * DT).toFixed(1) + "s"}`);
  }
});

test("봇 입력은 항상 유효하다: 값 범위·형식, 사람과 같은 입력 구조", () => {
  const m = createMatch({ teamSize: 4, durationSec: 180 });
  const bots = [];
  for (let e = 0; e < 8; e++) { matchAddPlayer(m, { id: String(e), team: e % 2, slot: (e / 2) | 0 }); bots.push(createBot({ eid: e, team: e % 2, slot: (e / 2) | 0, teamSize: 4, level: ["easy", "normal", "hard"][e % 3], seed: e + 1 })); }
  for (let t = 0; t < 120; t++) stepMatch(m, null);
  for (let t = 0; t < 30 * 60; t++) {
    const ins = {};
    for (const b of bots) {
      const i = botInput(b, m.world, m.world.tick);
      for (const k of ["mx", "my", "ax", "ay"]) assert.ok(Number.isFinite(i[k]), `${k} 비정상`);
      assert.ok(Math.hypot(i.mx, i.my) <= 1.0001, "이동 벡터가 단위 길이 초과");
      for (const k of ["shoot", "pass", "dash", "tackle"]) assert.equal(typeof i[k], "boolean");
      ins[b.eid] = i;
    }
    stepMatch(m, ins);
  }
});

test("역할 배정: 슬롯0은 키퍼(2v2 이상), 1v1은 올라운더", () => {
  assert.equal(roleFor(1, 0), "all");
  for (const n of [2, 3, 4]) { assert.equal(roleFor(n, 0), "gk"); assert.equal(roleFor(n, n - 1), "fwd"); }
  assert.deepEqual(Object.keys(BOT_LEVELS).sort(), ["easy", "hard", "normal"]);
  // 같은 규칙: 봇 난이도로 속도·킥 세기를 올리는 항목이 없다
  for (const L of Object.values(BOT_LEVELS)) assert.ok(!("speed" in L) && !("power" in L));
  assert.ok(PHYS.walkSpeed > 0);
});

// ================= 봇 승부차기 =================
import { botShootout } from "../../src/chago-bot.js";
import { matchAddPlayer as addP, createMatch as mkMatch, stepMatch as stepM } from "../../src/chago-match.js";

function botShootoutMatch(size, la, lb, seed) {
  const m = mkMatch({ teamSize: size, durationSec: 120, mode: "ranked" });
  const bots = [], shared = [{ plan: null, roles: {} }, { plan: null, roles: {} }];
  let eid = 0;
  for (let t = 0; t < 2; t++) for (let sl = 0; sl < size; sl++) { addP(m, { id: String(eid), team: t, slot: sl }); bots.push(createBot({ eid, team: t, slot: sl, teamSize: size, level: t === 0 ? la : lb, seed: seed * 100 + eid, shared: shared[t] })); eid++; }
  const res = [];
  let guard = 0;
  while (m.phase !== "ended" && guard++ < 30 * 60 * 20) {
    const ins = {};
    if (m.phase === "shootout" && m.so.state === "live") {
      for (const b of bots) {
        const role = b.eid === m.so.kicker ? "kicker" : b.eid === m.so.keeper ? "keeper" : null;
        if (role) ins[b.eid] = botShootout(b, m, role);
      }
    }
    for (const e of stepM(m, ins)) if (e.type === "soResult") res.push(e.result);
  }
  return { m, res };
}

test("봇 승부차기: 어떤 인원·난이도에서도 끝까지 진행되어 승자가 정해지고 골/선방/실축이 모두 나온다", () => {
  const tot = { goal: 0, saved: 0, miss: 0 };
  for (const [size, la, lb] of [[1, "normal", "normal"], [2, "hard", "hard"], [3, "easy", "easy"], [4, "hard", "easy"]]) {
    for (let seed = 1; seed <= 6; seed++) {
      const { m, res } = botShootoutMatch(size, la, lb, seed);
      assert.equal(m.phase, "ended", `${size}v${size} ${la}/${lb} seed${seed} 종료`);
      assert.equal(m.endReason, "shootout");
      assert.ok(m.winner === 0 || m.winner === 1, "승자 결정");
      assert.ok(res.length >= 3 && res.length <= 40, `시도 수 ${res.length}`);
      for (const r of res) tot[r]++;
    }
  }
  assert.ok(tot.goal > 0 && tot.saved + tot.miss > 0, JSON.stringify(tot));
});

test("봇 승부차기: 어려운 키퍼가 쉬운 키퍼보다 더 많이 막고, 어느 쪽도 전부 넣거나 전부 막히는 극단이 아니다", () => {
  // 팀0 키커(어려움) 시도만 집계: 팀1 키퍼 난이도별 실점률
  const concede = (keeperLv) => {
    let goals = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { m } = botShootoutMatch(1, "hard", keeperLv, seed);
      for (const r of m.so.marks[0]) { n++; goals += r; }
    }
    return goals / n;
  };
  const vsEasy = concede("easy"), vsHard = concede("hard");
  assert.ok(vsEasy >= vsHard, `쉬운 키퍼 상대 득점률 ${vsEasy.toFixed(2)} ≥ 어려운 키퍼 상대 ${vsHard.toFixed(2)}`);
  assert.ok(vsHard > 0.35 && vsHard < 0.95, `어려운 키퍼 상대 득점률 ${vsHard.toFixed(2)}`);
  assert.ok(vsEasy > 0.5 && vsEasy < 0.99, `쉬운 키퍼 상대 득점률 ${vsEasy.toFixed(2)}`);
});
