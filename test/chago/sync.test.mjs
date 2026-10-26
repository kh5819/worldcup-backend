// 클라이언트 예측·보간 로직 테스트 (프론트 chago-sync.js, 서버 엔진과 지연선 시뮬레이션)
import test from "node:test";
import assert from "node:assert/strict";
import { ChagoSync, INTERP_DELAY_MS } from "../../../홈페이지 제작/js/chago-sync.js";
import { createWorld, addPlayer, getPlayer, stepWorld, packWorld, DT } from "../../src/chago-engine.js";

const TICK_MS = DT * 1000;

// 서버(권위) + 클라(예측)를 지연선으로 이은 시뮬레이터. latencyTicks = 편도 지연(틱)
function sim({ latencyTicks = 6, ticks = 150, input, snapEvery = 1.5 }) {
  const server = createWorld({ teamSize: 1 });
  addPlayer(server, { id: "0", team: 0, slot: 0 });
  addPlayer(server, { id: "1", team: 1, slot: 0 });
  const sp = getPlayer(server, "0");
  const sync = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0, mySlot: 0 });
  const toServer = [], toClient = [];
  let lastIn = null, acc = 0, errMax = 0, errSum = 0, n = 0, now = 0;
  for (let t = 0; t < ticks; t++) {
    now = t * TICK_MS;
    // 클라: 입력 → 예측 + 전송
    const inp = sync.localStep(input(t));
    toServer.push({ at: t + latencyTicks, inp });
    // 서버: 도착한 입력 중 최신 적용
    while (toServer.length && toServer[0].at <= t) lastIn = toServer.shift().inp;
    stepWorld(server, { 0: lastIn });
    acc += 20 / 30;
    if (acc >= 1) { acc -= 1; toClient.push({ at: t + latencyTicks, snap: packWorld(server) }); }
    while (toClient.length && toClient[0].at <= t) sync.pushSnapshot(toClient.shift().snap, now);
    // 예측 위치 vs '서버의 같은 입력 시점' 위치 — 서버는 지연만큼 과거이므로, 예측은 서버 현재 위치 + 지연분 앞서야 정상.
    // 대신 "지연 없는 이상적 시뮬"과 비교한다.
  }
  return { sync, server, sp, now };
}

function ideal(input, ticks) {
  const w = createWorld({ teamSize: 1 });
  addPlayer(w, { id: "0", team: 0, slot: 0 });
  addPlayer(w, { id: "1", team: 1, slot: 0 });
  for (let t = 0; t < ticks; t++) stepWorld(w, { 0: { ...input(t), seq: t + 1 } });
  return getPlayer(w, "0");
}

const run = (t) => ({ mx: Math.cos(t / 20), my: Math.sin(t / 20), ax: 1, ay: 0 });

test("예측: 지연이 있어도 내 선수 화면 위치가 지연 없는 이상적 시뮬과 거의 같다", () => {
  for (const L of [0, 3, 6, 12]) {                       // 편도 0 / 100 / 200 / 400ms
    const { sync } = sim({ latencyTicks: L, ticks: 180, input: run });
    const want = ideal(run, 180);
    const v = sync.render(180 * TICK_MS);
    const me = v.players.find((p) => p.mine);
    const err = Math.hypot(me.x - want.x, me.y - want.y);
    assert.ok(err < 3, `편도 ${L}틱 지연 오차 ${err.toFixed(2)}px`);
  }
});

test("보정: 서버가 내 선수를 갑자기 밀어도(30px) 튀지 않고 서서히 따라간다 / 60px 넘으면 즉시", () => {
  const { sync } = sim({ latencyTicks: 2, ticks: 60, input: () => ({ mx: 0, my: 0 }) });
  sync.render(1000);
  const before = sync.me.x;
  // 서버 스냅샷: 같은 ack인데 위치가 30px 다름
  const snap = (dx) => ({ k: 999, b: [500, 300, 0, 0, 0], p: [["0", before + dx, sync.me.y, 0, 0, 0, 100, 0, 0, sync.seq], ["1", 800, 300, 0, 0, Math.PI, 100, 0, 0, 0]] });
  sync.pushSnapshot(snap(30), 1000);
  const first = sync.render(1000).players.find((p) => p.mine).x;
  assert.ok(Math.abs(first - before) < 1, "처음 프레임은 이전 화면 위치 그대로(튀지 않음)");
  let later = 0;
  for (let t = 1016; t <= 1400; t += 16) later = sync.render(t).players.find((p) => p.mine).x;   // 60fps 프레임
  assert.ok(Math.abs(later - (before + 30)) < 1, "시간이 지나면 서버 위치에 수렴");
  sync.pushSnapshot(snap(100), 1500);
  const warp = sync.render(1500).players.find((p) => p.mine).x;
  assert.ok(Math.abs(warp - (before + 100)) < 1, "큰 오차는 즉시 맞춤");
  assert.ok(sync.stats.warps >= 1);
});

test("보간: 다른 선수·공은 100ms 늦춘 시점에서 두 스냅샷 사이를 부드럽게 이동", () => {
  const s = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0 });
  const mk = (k, x, bx) => ({ k, b: [bx, 200, 0, 0, 0], p: [["0", 100, 100, 0, 0, 0, 100, 0, 0, 0], ["1", x, 300, 0, 0, 0, 100, 0, 0, 0]] });
  s.pushSnapshot(mk(1, 400, 500), 1000);
  s.pushSnapshot(mk(2, 500, 600), 1050);
  s.pushSnapshot(mk(3, 600, 700), 1100);
  const v = s.render(1000 + 50 + INTERP_DELAY_MS);        // 렌더 시각 → 보간 기준 1050 (두 번째 스냅샷)
  const o = v.players.find((p) => p.eid === 1);
  assert.ok(Math.abs(o.x - 500) < 1, `상대 x ${o.x}`);
  assert.ok(Math.abs(v.ball.x - 600) < 1);
  const mid = s.interpolate(1075).players.find((p) => p.eid === 1);
  assert.ok(Math.abs(mid.x - 550) < 1, `중간값 ${mid.x}`);
});

test("외삽: 스냅샷이 끊기면 최대 150ms까지만 속도로 이어가고 그 이상은 멈춘다", () => {
  const s = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0 });
  s.pushSnapshot({ k: 1, b: [500, 200, 100, 0, 0], p: [["0", 100, 100, 0, 0, 0, 100, 0, 0, 0], ["1", 400, 300, 200, 0, 0, 100, 0, 0, 0]] }, 1000);
  const a = s.interpolate(1000 + 100).players.find((p) => p.eid === 1).x;     // +100ms
  const b = s.interpolate(1000 + 5000).players.find((p) => p.eid === 1).x;    // 한참 뒤
  assert.ok(Math.abs(a - (400 + 200 * 0.1)) < 0.5);
  assert.ok(Math.abs(b - (400 + 200 * 0.15)) < 0.5, `상한 ${b}`);
});

test("스냅샷이 없으면 렌더는 null, 오래된 입력 기록은 ack 후 정리된다", () => {
  const s = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0 });
  assert.equal(s.render(0), null);
  for (let i = 0; i < 10; i++) s.localStep({ mx: 1, my: 0 });
  assert.equal(s.history.length, 10);
  s.pushSnapshot({ k: 1, b: [0, 0, 0, 0, 0], p: [["0", 100, 100, 0, 0, 0, 100, 0, 0, 6]] }, 100);
  assert.equal(s.history.length, 4, "ack 6 이후 입력 4개만 남음");
});

test("몸싸움 예측: 상대가 가로막고 있어도 유령 장애물 덕에 서버와 위치가 거의 같다 (없으면 크게 어긋남)", () => {
  function run(useGhosts) {
    const server = createWorld({ teamSize: 1 });
    addPlayer(server, { id: "0", team: 0, slot: 0 });
    addPlayer(server, { id: "1", team: 1, slot: 0 });
    const me = getPlayer(server, "0"), opp = getPlayer(server, "1");
    me.x = 200; me.y = 260; opp.x = 330; opp.y = 262;                 // 정면에 상대가 서 있음
    const sync = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0, mySlot: 0, ghosts: useGhosts });
    sync.me.x = 200; sync.me.y = 260;
    const lat = 4, toS = [], toC = []; let lastIn = null, acc = 0, errs = [], now = 0;
    for (let t = 0; t < 120; t++) {
      now = t * TICK_MS;
      const inp = sync.localStep({ mx: 1, my: 0, ax: 1, ay: 0 }, now);
      toS.push({ at: t + lat, inp });
      while (toS.length && toS[0].at <= t) lastIn = toS.shift().inp;
      stepWorld(server, { 0: lastIn });
      acc += 20 / 30; if (acc >= 1) { acc -= 1; toC.push({ at: t + lat, snap: packWorld(server) }); }
      while (toC.length && toC[0].at <= t) { sync.pushSnapshot(toC.shift().snap, now); if (t > 40) errs.push(sync.stats.lastErr); }
    }
    errs.sort((a, b) => a - b);
    return { med: errs[errs.length >> 1], p90: errs[Math.floor(errs.length * 0.9)] };
  }
  const withG = run(true), withoutG = run(false);
  assert.ok(withG.p90 < 8, `유령 있음 p90 ${withG.p90.toFixed(1)}px`);
  assert.ok(withoutG.p90 > withG.p90 * 2 || withoutG.p90 > 15, `유령 없음 p90 ${withoutG.p90.toFixed(1)}px (비교용)`);
});

test("골 리플레이: 골 직전 구간을 0.8배속으로 재생하고 끝나면 스스로 멈춘다", () => {
  const s = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0, ghosts: false });
  // 50ms 간격 200개 스냅샷(10초): 상대(eid 1)가 x=100→2100 로 달린다
  for (let i = 0; i < 200; i++) s.pushSnapshot({ k: i, b: [i * 5, 200, 100, 0, 0], p: [["0", 100, 100, 0, 0, 0, 100, 0, 0, 0], ["1", 100 + i * 10, 300, 200, 0, 0, 100, 0, 0, 0]] }, i * 50);
  const goalMs = 199 * 50;
  assert.equal(s.startReplay(goalMs, 4500, 0.8), true);
  const first = s.replayView(0);
  assert.ok(first && first.progress < 0.05);
  const x0 = first.players.find((p) => p.eid === 1).x;
  assert.ok(Math.abs(x0 - (100 + (goalMs - 4500) / 50 * 10)) < 25, `시작 위치 ${x0}`);
  assert.ok(first.players.find((p) => p.eid === 0).mine === true);
  let frames = 0, last = first;
  for (; frames < 1000; frames++) { const v = s.replayView(16); if (!v) break; last = v; }
  const expectFrames = Math.round((4500 + 350) / 0.8 / 16);
  assert.ok(Math.abs(frames - expectFrames) < 25, `프레임 ${frames} ≈ ${expectFrames}`);
  assert.equal(s.replay, null, "끝나면 리플레이 상태 해제");
  assert.ok(last.progress > 0.95);
  // 데이터가 모자라면 시작하지 않는다
  const empty = new ChagoSync({ teamSize: 1, myEid: 0, myTeam: 0 });
  assert.equal(empty.startReplay(1000), false);
  // 중간 취소
  s.startReplay(goalMs); s.stopReplay(); assert.equal(s.replayView(16), null);
});
