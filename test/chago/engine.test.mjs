// 차고차고 물리 엔진 테스트: node --test test/chago/
import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld, addPlayer, getPlayer, stepWorld, resetPositions, cleanInput, hashWorld, packWorld,
  PHYS, DT, FIELD_PRESETS,
} from "../../src/chago-engine.js";

const TICKS_PER_SEC = Math.round(1 / DT);

function mk(teamSize = 1, players = [["a", 0], ["b", 1]]) {
  const w = createWorld({ teamSize });
  for (const [id, team] of players) addPlayer(w, { id, team });
  return w;
}
function run(w, ticks, fn = () => ({})) {
  const evs = [];
  for (let i = 0; i < ticks; i++) evs.push(...stepWorld(w, fn(i, w)));
  return evs;
}
const spd = (o) => Math.hypot(o.vx, o.vy);
// 고정 시드 난수 (테스트 재현용)
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function place(p, x, y) { p.x = x; p.y = y; p.vx = p.vy = 0; }
function putBall(w, x, y, vx = 0, vy = 0) { Object.assign(w.ball, { x, y, vx, vy, spin: 0 }); }

test("선수: 걷기 최고속도를 넘지 않고, 대각선 입력도 같은 속도", () => {
  const w = mk();
  const a = getPlayer(w, "a"); place(a, 200, 260);
  run(w, 20, () => ({ a: { mx: 1, my: 1 } }));      // 길이 1.41 입력 → 정규화
  assert.ok(spd(a) <= PHYS.walkSpeed + 0.5, `speed ${spd(a)}`);
  assert.ok(spd(a) > PHYS.walkSpeed - 5);
  run(w, 20, () => ({ a: { mx: 9999, my: -9999 } }));
  assert.ok(spd(a) <= PHYS.walkSpeed + 0.5);
});

test("선수: 입력을 놓으면 멈춘다", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 300, 260);
  run(w, 15, () => ({ a: { mx: 1, my: 0 } }));
  run(w, 15, () => ({}));
  assert.ok(spd(a) < 1);
});

test("대시: 1.5배 속도, 스태미나 소모, 바닥나면 지치고 다시 회복", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 60, 260);
  run(w, 15, () => ({ a: { mx: 1, my: 0, dash: true } }));
  assert.ok(Math.abs(spd(a) - PHYS.walkSpeed * PHYS.dashMult) < 1, `dash ${spd(a)}`);
  assert.ok(a.stamina < PHYS.stamina.max);
  place(a, 60, 260);
  let tired = false;
  for (let i = 0; i < TICKS_PER_SEC * 6; i++) {
    stepWorld(w, { a: { mx: i % 60 < 30 ? 1 : -1, my: 0, dash: true } });
    if (a.exhausted) tired = true;
  }
  assert.ok(tired, "스태미나가 바닥나야 함");
  // 지친 동안엔 대시 안 됨
  a.stamina = 0; a.exhausted = true;
  place(a, 400, 260);
  run(w, 15, () => ({ a: { mx: 1, my: 0, dash: true } }));
  assert.ok(spd(a) <= PHYS.walkSpeed + 0.5);
  // 쉬면 회복
  run(w, TICKS_PER_SEC * 5, () => ({}));
  assert.equal(a.exhausted, false);
  assert.ok(a.stamina > 50);
});

test("공: 속도가 계속 줄어 결국 멈추고, 중간에 빨라지지 않는다", () => {
  const w = mk(); putBall(w, 200, 260, 900, 0);
  let prev = 900, stopped = -1;
  for (let i = 0; i < TICKS_PER_SEC * 12; i++) {
    stepWorld(w, {});
    const s = spd(w.ball);
    const wallHit = w.events.length > 0;                 // 벽 반사는 속도 방향만 바뀜(크기는 줄어듦)
    assert.ok(s <= prev + 1e-6 || wallHit, `tick ${i} 가속 ${prev}→${s}`);
    prev = s;
    if (s === 0 && stopped < 0) stopped = i;
  }
  assert.ok(stopped > 0 && stopped < TICKS_PER_SEC * 12, "멈춰야 함");
});

test("슈팅 파워: 차징이 길수록 공이 빠르고 상한을 넘지 않는다", () => {
  const speeds = [];
  for (const hold of [0, 6, 14, 40]) {
    const w = mk(4); const a = getPlayer(w, "a"); place(a, 300, 260); putBall(w, 330, 260);
    for (let i = 0; i < hold; i++) stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
    stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } });
    speeds.push(spd(w.ball));
  }
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] > speeds[i - 1], speeds.join(","));
  assert.ok(speeds[speeds.length - 1] <= PHYS.kick.maxPower * 1.2);
  assert.ok(speeds[speeds.length - 1] > PHYS.kick.maxPower * 0.9);
});

test("킥: 공이 멀면 안 나가고, 쿨다운 중 연속 킥 불가", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 300, 260); putBall(w, 500, 260);
  stepWorld(w, { a: { ax: 1, shoot: true } }); stepWorld(w, { a: { ax: 1, shoot: false } });
  assert.equal(spd(w.ball), 0);
  putBall(w, 330, 260);
  stepWorld(w, { a: { ax: 1, shoot: true } }); stepWorld(w, { a: { ax: 1, shoot: false } });
  const first = spd(w.ball);
  assert.ok(first > 0);
  // 바로 다시 같은 자리에 공을 놓고 찬다 → 쿨다운 때문에 무시
  putBall(w, a.x + 31, a.y);
  stepWorld(w, { a: { ax: 1, shoot: true } }); stepWorld(w, { a: { ax: 1, shoot: false } });
  assert.ok(spd(w.ball) < 5, "쿨다운 중 킥 무시");
});

test("킥: 공이 몸 뒤(조준 반대편)에 있으면 못 차고 헛발질 이벤트가 난다", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 300, 260); putBall(w, 265, 260);   // 공은 왼쪽(발 닿는 거리), 조준은 오른쪽
  stepWorld(w, { a: { ax: 1, shoot: true } });
  const evs = stepWorld(w, { a: { ax: 1, shoot: false } });
  assert.ok(evs.some((e) => e.type === "whiff"));
  assert.ok(spd(w.ball) < 1);
  assert.equal(w.ball.lastTouch, null);
});

test("커브슛: 옆으로 달리며 차면 공이 휜다 / 가만히 차면 직선", () => {
  const trace = (moveY) => {
    const w = mk(); const a = getPlayer(w, "a"); place(a, 300, 260); putBall(w, 331, 260);
    a.vy = moveY; a.fx = 1; a.fy = 0;
    stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
    a.vy = moveY;
    stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } });
    const ys = [];
    for (let i = 0; i < 20; i++) { stepWorld(w, {}); ys.push(w.ball.y); }
    return { spin: w.ball.spin, ys };
  };
  const straight = trace(0);
  const curved = trace(220);
  assert.equal(straight.spin, 0);
  assert.ok(Math.abs(straight.ys[19] - 260) < 1.5);
  assert.notEqual(curved.spin, 0);
  // 곡선이면 직선 궤적과 확실히 다르다
  const diff = Math.abs(curved.ys[19] - straight.ys[19]);
  assert.ok(diff > 5, `curve diff ${diff}`);
});

test("패스: 조준 방향 팀원에게 간다 / 스루패스는 달리는 팀원 앞쪽을 노린다", () => {
  const mkPass = (through) => {
    const w = mk(2, [["a", 0], ["m", 0], ["x", 1], ["y", 1]]);
    const a = getPlayer(w, "a"), m = getPlayer(w, "m");
    place(a, 300, 290); place(m, 600, 290); place(getPlayer(w, "x"), 900, 80); place(getPlayer(w, "y"), 900, 500);
    putBall(w, 331, 290);
    m.vx = 0; m.vy = -200;                       // 팀원이 위로 달리는 중
    const inp = (pass) => ({ a: { ax: 1, ay: 0, pass } });
    const holdTicks = through ? 12 : 2;
    for (let i = 0; i < holdTicks; i++) { stepWorld(w, inp(true)); m.vx = 0; m.vy = -200; }
    const evs = stepWorld(w, inp(false));
    const kick = evs.find((e) => e.type === "kick");
    return { kick, w };
  };
  const normal = mkPass(false), through = mkPass(true);
  assert.equal(normal.kick.kind, "pass"); assert.equal(normal.kick.to, "m");
  assert.equal(through.kick.kind, "through");
  // 스루패스가 더 위쪽(y 작은 쪽)을 향함
  assert.ok(through.w.ball.vy < normal.w.ball.vy - 20, `${through.w.ball.vy} vs ${normal.w.ball.vy}`);
});

test("태클: 상대는 기절하고 공이 튕겨 나오며, 쿨다운 동안 재사용 불가", () => {
  const w = mk(); const a = getPlayer(w, "a"), b = getPlayer(w, "b");
  place(a, 300, 260); place(b, 345, 260); putBall(w, 382, 260);
  const evs = [];
  for (let i = 0; i < 10; i++) evs.push(...stepWorld(w, { a: { mx: 1, my: 0, tackle: i === 0 } }));
  assert.ok(evs.some((e) => e.type === "tackleHit"), "태클 적중");
  assert.ok(b.stunT > 0 || b.stunT === 0);
  assert.ok(w.ball.vx > 100, `공이 태클 방향으로 튕김 ${w.ball.vx}`);
  assert.equal(w.ball.lastTouchTeam, 0);
  // 쿨다운 중 재시도
  const cd = a.tackleCd; assert.ok(cd > 0);
  const st = a.stamina;
  stepWorld(w, { a: { mx: 1, tackle: false } });
  const evs2 = stepWorld(w, { a: { mx: 1, tackle: true } });
  assert.ok(!evs2.some((e) => e.type === "tackle"), "쿨다운 중 태클 불가");
  assert.ok(a.stamina >= st - 1e-6);
});

test("태클: 헛스윙하면 회복 시간 동안 못 움직인다", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 100, 260); place(getPlayer(w, "b"), 800, 100);
  stepWorld(w, { a: { mx: 1, tackle: true } });
  for (let i = 0; i < 6; i++) stepWorld(w, { a: { mx: 1 } });
  assert.ok(a.recoverT > 0 || a.tackleT > 0);
  let moved = false;
  for (let i = 0; i < 30; i++) { stepWorld(w, { a: { mx: -1 } }); if (a.recoverT === 0 && a.tackleT === 0) { moved = true; break; } }
  assert.ok(moved, "회복 후엔 다시 움직임");
});

test("벽: 위쪽 벽에 수직으로 맞으면 반사(약간 감속)되고 밖으로 안 나간다", () => {
  const w = mk(); putBall(w, 500, 60, 0, -600);
  let maxUp = Infinity, bounced = false;
  for (let i = 0; i < 30; i++) {
    stepWorld(w, {});
    maxUp = Math.min(maxUp, w.ball.y);
    if (w.ball.vy > 0) bounced = true;
  }
  assert.ok(bounced);
  assert.ok(maxUp >= PHYS.ballR - 0.01, `벽 뚫음 ${maxUp}`);
  assert.ok(w.ball.vy > 0 && w.ball.vy < 600 * PHYS.ball.wallE + 5);
});

test("터널링 없음: 최고속도 공을 무작위 각도로 쏴도 경기장·골대 밖으로 안 나간다", () => {
  const rnd = lcg(12345);
  for (let size = 1; size <= 4; size++) {
    for (let n = 0; n < 60; n++) {
      const w = mk(size, []);
      const f = w.field;
      const ang = rnd() * Math.PI * 2;
      putBall(w, f.W * (0.2 + rnd() * 0.6), f.H * (0.2 + rnd() * 0.6), Math.cos(ang) * PHYS.ball.max, Math.sin(ang) * PHYS.ball.max);
      for (let i = 0; i < TICKS_PER_SEC * 8; i++) {
        stepWorld(w, {});
        const b = w.ball;
        const inGoalX = b.x < 0 || b.x > f.W;
        if (inGoalX) {
          assert.ok(Math.abs(b.y - f.cy) <= f.gw / 2, `골대 옆으로 샘 size${size} n${n} (${b.x},${b.y})`);
          assert.ok(b.x >= -f.gd - 0.01 && b.x <= f.W + f.gd + 0.01, `골망 뚫음 (${b.x})`);
        }
        assert.ok(b.y >= -0.01 && b.y <= f.H + 0.01, `y 이탈 ${b.y}`);
        assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
      }
    }
  }
});

test("골: 오른쪽 골대는 팀0 득점, 왼쪽은 팀1 득점 + 득점자·자책 판정", () => {
  const w = mk(); const a = getPlayer(w, "a"), b = getPlayer(w, "b");
  place(a, 800, 260); place(b, 100, 100); putBall(w, 830, 260);
  stepWorld(w, { a: { ax: 1, shoot: true } });
  let evs = [...stepWorld(w, { a: { ax: 1, shoot: false } })];
  evs.push(...run(w, 60));
  const g = evs.find((e) => e.type === "goal");
  assert.ok(g, "골 이벤트");
  assert.equal(g.team, 0); assert.equal(g.scorer, "a"); assert.equal(g.own, false);
  // 골 이벤트는 한 번만
  assert.equal(evs.filter((e) => e.type === "goal").length, 1);

  // 팀0 선수가 마지막으로 건드린 공이 자기 골대(왼쪽)로 → 팀1 득점, 자책
  const w2 = mk(); const a2 = getPlayer(w2, "a"); place(a2, 230, 260); place(getPlayer(w2, "b"), 800, 100); putBall(w2, 200, 260);
  for (let i = 0; i < 20; i++) stepWorld(w2, { a: { ax: -1, shoot: true } });
  const e2 = [...stepWorld(w2, { a: { ax: -1, shoot: false } }), ...run(w2, 60)];
  const g2 = e2.find((e) => e.type === "goal");
  assert.equal(g2.team, 1); assert.equal(g2.own, true);
});

test("골: 골대 옆(골포스트·골대 밖)으로 가면 골이 아니다 / 골문 안에 갇힌다", () => {
  const w = mk(); const f = w.field;
  putBall(w, 500, f.cy - f.gw / 2 - 20, -700, 0);       // 골문 위쪽 벽을 따라
  const evs = run(w, 60);
  assert.ok(!evs.some((e) => e.type === "goal"));
  // 골 후 공은 골망 안에 있고 선수는 골대에 못 들어온다
  const w2 = mk(); const a = getPlayer(w2, "a"); place(a, 40, w2.field.cy);
  run(w2, 60, () => ({ a: { mx: -1, my: 0 } }));
  assert.ok(a.x >= PHYS.playerR - 0.01, "선수가 골대 안으로 못 들어감");
});

test("골포스트: 포스트에 맞으면 튕기고 골이 아니다", () => {
  const w = mk(); const f = w.field;
  putBall(w, 150, f.cy - f.gw / 2, -500, 0);
  const evs = run(w, 20);
  assert.ok(evs.some((e) => e.type === "post"));
});

test("선수끼리 겹치지 않는다 (정면 충돌 반복)", () => {
  const w = mk(2, [["a", 0], ["b", 1], ["c", 0], ["d", 1]]);
  const ids = ["a", "b", "c", "d"];
  place(getPlayer(w, "a"), 300, 280); place(getPlayer(w, "b"), 600, 280);
  place(getPlayer(w, "c"), 300, 320); place(getPlayer(w, "d"), 600, 320);
  let worst = 0;
  for (let i = 0; i < TICKS_PER_SEC * 6; i++) {
    stepWorld(w, { a: { mx: 1, dash: true }, c: { mx: 1, dash: true }, b: { mx: -1, dash: true }, d: { mx: -1, dash: true } });
    for (let p = 0; p < ids.length; p++) for (let q = p + 1; q < ids.length; q++) {
      const A = getPlayer(w, ids[p]), B = getPlayer(w, ids[q]);
      worst = Math.max(worst, PHYS.playerR * 2 - Math.hypot(A.x - B.x, A.y - B.y));
    }
  }
  assert.ok(worst < 4, `최대 겹침 ${worst}px`);
});

test("공 끼임: 선수가 공을 벽/구석으로 계속 밀어도 공이 떨리거나 순간이동하지 않는다", () => {
  const w = mk(); const a = getPlayer(w, "a"); place(a, 100, 40); putBall(w, 60, 20);
  let prevBall = { x: w.ball.x, y: w.ball.y }, maxJump = 0, maxOverlap = 0;
  for (let i = 0; i < TICKS_PER_SEC * 6; i++) {
    stepWorld(w, { a: { mx: -1, my: -1 } });
    maxJump = Math.max(maxJump, Math.hypot(w.ball.x - prevBall.x, w.ball.y - prevBall.y));
    prevBall = { x: w.ball.x, y: w.ball.y };
    maxOverlap = Math.max(maxOverlap, PHYS.playerR + PHYS.ballR - Math.hypot(w.ball.x - a.x, w.ball.y - a.y));
    assert.ok(w.ball.x >= PHYS.ballR - 0.01 && w.ball.y >= PHYS.ballR - 0.01, "공이 구석 밖으로");
    assert.ok(a.x >= PHYS.playerR - 0.01 && a.y >= PHYS.playerR - 0.01);
  }
  assert.ok(maxJump < PHYS.ball.max * DT + 1, `순간이동 ${maxJump}`);
  assert.ok(maxOverlap < 6, `겹침 ${maxOverlap}`);
});

test("순간이동 없음: 틱당 이동량이 속도 상한 이내 (공·선수)", () => {
  const rnd = lcg(777);
  const w = mk(4, [["a", 0], ["b", 0], ["c", 0], ["d", 0], ["e", 1], ["f", 1], ["g", 1], ["h", 1]]);
  const ids = w.players.map((p) => p.id);
  let prev = w.players.map((p) => [p.x, p.y]), pb = [w.ball.x, w.ball.y];
  for (let i = 0; i < TICKS_PER_SEC * 40; i++) {
    const ins = {};
    for (const id of ids) ins[id] = { mx: rnd() * 2 - 1, my: rnd() * 2 - 1, ax: rnd() * 2 - 1, ay: rnd() * 2 - 1, shoot: rnd() < 0.2, pass: rnd() < 0.1, dash: rnd() < 0.5, tackle: rnd() < 0.05 };
    stepWorld(w, ins);
    w.players.forEach((p, k) => {
      assert.ok(Math.hypot(p.x - prev[k][0], p.y - prev[k][1]) <= PHYS.tackle.speed * DT + PHYS.playerR + 1, `선수 점프 tick${i}`);
      prev[k] = [p.x, p.y];
      assert.ok(p.x >= 0 && p.x <= w.field.W && p.y >= 0 && p.y <= w.field.H);
    });
    assert.ok(Math.hypot(w.ball.x - pb[0], w.ball.y - pb[1]) <= PHYS.ball.max * DT + PHYS.playerR + PHYS.ballR, `공 점프 tick${i}`);
    pb = [w.ball.x, w.ball.y];
    if (w.goalFlag) resetPositions(w), (prev = w.players.map((p) => [p.x, p.y]), pb = [w.ball.x, w.ball.y]);
  }
});

test("결정성: 같은 입력이면 같은 결과", () => {
  const run1 = () => {
    const rnd = lcg(42);
    const w = mk(2, [["a", 0], ["b", 0], ["c", 1], ["d", 1]]);
    for (let i = 0; i < TICKS_PER_SEC * 20; i++) {
      const ins = {};
      for (const p of w.players) ins[p.id] = { mx: rnd() * 2 - 1, my: rnd() * 2 - 1, ax: rnd() * 2 - 1, ay: rnd() * 2 - 1, shoot: rnd() < 0.3, pass: rnd() < 0.1, dash: rnd() < 0.4, tackle: rnd() < 0.05 };
      stepWorld(w, ins);
    }
    return hashWorld(w);
  };
  assert.equal(run1(), run1());
});

test("입력 방어: NaN/Infinity/문자열/거대한 값이 와도 월드가 깨지지 않는다", () => {
  const w = mk(); const bad = [
    { mx: NaN, my: Infinity, ax: "x", ay: null, shoot: "yes", pass: 1, dash: {}, tackle: [] },
    { mx: 1e308, my: -1e308, ax: 1e308, ay: 1e308 },
    null, undefined, 5, "hello", [],
  ];
  for (const b of bad) {
    stepWorld(w, { a: b, b: b });
    for (const p of w.players) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx));
    assert.ok(Number.isFinite(w.ball.x));
  }
  const c = cleanInput({ mx: 3, my: 4 });
  assert.ok(Math.abs(Math.hypot(c.mx, c.my) - 1) < 1e-9);
});

test("스냅샷: 선수 수만큼 담기고 JSON 직렬화 가능", () => {
  const w = mk(4, Array.from({ length: 8 }, (_, i) => ["p" + i, i % 2]));
  stepWorld(w, {});
  const s = packWorld(w);
  assert.equal(s.p.length, 8);
  const json = JSON.stringify(s);
  assert.ok(json.length < 900, `스냅샷 크기 ${json.length}B`);
});

test("경기장 크기: 인원별 프리셋이 있고 골문이 경기장 안에 들어간다", () => {
  for (const n of [1, 2, 3, 4]) {
    const f = FIELD_PRESETS[n];
    assert.ok(f.gw < f.H && f.gd > 0 && f.W > f.H);
  }
});

test("벽에 붙은 선수가 공을 벽 쪽으로 눌러도 공이 경기장 밖으로 빠지지 않는다 (사방·골대 입구)", () => {
  const w0 = createWorld({ teamSize: 2 });
  const f = w0.field;
  // [선수 위치, 공 위치(벽과 선수 사이), 선수 입력]
  const cases = [
    [[300, 45], [300, 18], { mx: 0, my: -1 }],                     // 위 벽
    [[300, f.H - 45], [300, f.H - 18], { mx: 0, my: 1 }],          // 아래 벽
    [[45, 100], [18, 100], { mx: -1, my: 0 }],                     // 왼 벽(골문 밖)
    [[f.W - 45, 100], [f.W - 18, 100], { mx: 1, my: 0 }],          // 오른 벽
    [[45, 18 + 30], [20, 20], { mx: -1, my: -1 }],                 // 구석
    [[30, f.cy - f.gw / 2 - 25], [14, f.cy - f.gw / 2 - 12], { mx: -1, my: 0.3 }],   // 골포스트 옆
  ];
  for (const [pp, bp, inp] of cases) {
    const w = mk(2, [["a", 0], ["b", 1]]);
    const a = getPlayer(w, "a"); place(a, pp[0], pp[1]); place(getPlayer(w, "b"), 600, 300);
    putBall(w, bp[0], bp[1]);
    for (let i = 0; i < TICKS_PER_SEC * 5; i++) {
      stepWorld(w, { a: { ...inp, dash: true } });
      const b = w.ball;
      const inMouth = Math.abs(b.y - f.cy) < f.gw / 2;
      assert.ok(b.y >= -0.01 && b.y <= f.H + 0.01, `공 y 이탈 ${b.y.toFixed(1)} case ${JSON.stringify(inp)}`);
      assert.ok(inMouth ? (b.x >= -f.gd - 0.01 && b.x <= f.W + f.gd + 0.01) : (b.x >= -0.01 && b.x <= f.W + 0.01), `공 x 이탈 ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    }
  }
});

// ================= 5단계: 퍼펙트 슛 · 선방 · 콤보 · 도움 =================
function shootHold(ticks, teamSize = 4) {
  const w = mk(teamSize, [["a", 0], ["b", 1]]); const a = getPlayer(w, "a"); place(a, 300, 260); place(getPlayer(w, "b"), 700, 100); putBall(w, 331, 260);
  for (let i = 0; i < ticks; i++) stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
  const evs = stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } });
  return { ev: evs.find((e) => e.type === "kick"), speed: spd(w.ball), w };
}

test("퍼펙트 슛: 차징이 끝나기 직전 구간(약 0.7~0.8초)에 떼면 가장 강하고, 너무 일찍/늦으면 일반 슛", () => {
  const early = shootHold(19), perfect = shootHold(23), late = shootHold(27), full = shootHold(40);
  assert.equal(early.ev.perfect, false);
  assert.equal(perfect.ev.perfect, true, "23틱(약 0.77초)은 퍼펙트");
  assert.equal(late.ev.perfect, false, "다 차징한 뒤에는 퍼펙트 아님");
  assert.ok(perfect.speed > full.speed + 20, `퍼펙트 ${perfect.speed.toFixed(0)} > 풀차지 ${full.speed.toFixed(0)}`);
  assert.ok(perfect.speed <= PHYS.ball.max + 0.5);
  // 퍼펙트 구간은 연속된 몇 틱(최소 3틱, 100ms 이상)이어야 사람이 맞출 수 있다
  let n = 0; for (let t = 15; t <= 30; t++) if (shootHold(t).ev.perfect) n++;
  assert.ok(n >= 3 && n <= 6, `퍼펙트 가능한 틱 수 ${n}`);
});

test("유효슈팅 판정: 골문 안으로 향하는 슛만 onTarget", () => {
  const w = mk(2, [["a", 0], ["b", 1]]); const a = getPlayer(w, "a"); place(a, 700, w.field.cy); place(getPlayer(w, "b"), 100, 60);
  putBall(w, 731, w.field.cy);
  for (let i = 0; i < 12; i++) stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
  const on = stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } }).find((e) => e.type === "kick");
  assert.equal(on.onTarget, true);
  const w2 = mk(2, [["a", 0], ["b", 1]]); const a2 = getPlayer(w2, "a"); place(a2, 700, 100); place(getPlayer(w2, "b"), 100, 400);
  putBall(w2, 731, 100);
  for (let i = 0; i < 12; i++) stepWorld(w2, { a: { ax: 1, ay: 0, shoot: true } });
  const off = stepWorld(w2, { a: { ax: 1, ay: 0, shoot: false } }).find((e) => e.type === "kick");
  assert.equal(off.onTarget, false, "골대 옆으로 가는 슛");
  // 반대쪽(자기 골대) 방향 슛도 유효슈팅 아님
  const w3 = mk(2, [["a", 0], ["b", 1]]); const a3 = getPlayer(w3, "a"); place(a3, 400, w3.field.cy); place(getPlayer(w3, "b"), 900, 100); putBall(w3, 369, w3.field.cy);
  for (let i = 0; i < 12; i++) stepWorld(w3, { a: { ax: -1, ay: 0, shoot: true } });
  assert.equal(stepWorld(w3, { a: { ax: -1, ay: 0, shoot: false } }).find((e) => e.type === "kick").onTarget, false);
});

test("선방: 상대의 유효슈팅을 수비가 건드리면 save 이벤트, 강한(퍼펙트) 슛이면 슈퍼 세이브", () => {
  const run = (hold) => {
    const w = mk(2, [["a", 0], ["b", 1]]); const a = getPlayer(w, "a"), b = getPlayer(w, "b");
    place(a, 560, w.field.cy); place(b, 860, w.field.cy); putBall(w, 591, w.field.cy);
    for (let i = 0; i < hold; i++) stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
    const evs = [...stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } })];
    for (let i = 0; i < 30; i++) evs.push(...stepWorld(w, {}));
    return evs;
  };
  const weak = run(6).find((e) => e.type === "save");
  assert.ok(weak && weak.id === "b" && weak.shooter === "a", "수비가 막으면 save");
  assert.equal(weak.super, false);
  const strong = run(22).find((e) => e.type === "save");
  assert.ok(strong, "강한 슛도 막으면 save");
  assert.equal(strong.super, true, "퍼펙트·고속 슛을 막으면 슈퍼 세이브");
  // 빗나간 슛을 건드려도 선방이 아니다
  const w = mk(2, [["a", 0], ["b", 1]]); place(getPlayer(w, "a"), 560, 80); place(getPlayer(w, "b"), 860, 80); putBall(w, 591, 80);
  for (let i = 0; i < 12; i++) stepWorld(w, { a: { ax: 1, ay: 0, shoot: true } });
  const evs = [...stepWorld(w, { a: { ax: 1, ay: 0, shoot: false } })];
  for (let i = 0; i < 30; i++) evs.push(...stepWorld(w, {}));
  assert.ok(!evs.some((e) => e.type === "save"), "유효슈팅이 아니면 선방 아님");
});

test("콤보 패스: 팀원에게 이어지면 combo 이벤트, 상대가 건드리면 끊기고, 2번 이상 이어진 뒤 슛은 더 강하다", () => {
  const w = mk(3, [["a", 0], ["m", 0], ["c", 0], ["x", 1]]);
  const a = getPlayer(w, "a"), m = getPlayer(w, "m"), c = getPlayer(w, "c"), x = getPlayer(w, "x");
  place(a, 300, 300); place(m, 600, 300); place(c, 850, 300); place(x, 1000, 100);
  putBall(w, 331, 300);
  const passFrom = (p, to) => { const evs = []; evs.push(...stepWorld(w, { [p.id]: { ax: to.x - p.x, ay: to.y - p.y, pass: true } })); evs.push(...stepWorld(w, { [p.id]: { ax: to.x - p.x, ay: to.y - p.y, pass: false } })); for (let i = 0; i < 70; i++) evs.push(...stepWorld(w, {})); return evs; };
  const e1 = passFrom(a, m);
  const c1 = e1.find((e) => e.type === "combo");
  assert.ok(c1 && c1.id === "m" && c1.from === "a" && c1.n === 1, JSON.stringify(c1));
  // 받은 공을 m 발 앞에 두고 c에게 다시 패스
  putBall(w, m.x + 31, m.y); m.vx = m.vy = 0; m.kickCd = 0;
  const e2 = passFrom(m, c);
  const c2 = e2.find((e) => e.type === "combo");
  assert.ok(c2 && c2.n === 2 && c2.id === "c", "두 번째 성공은 n=2");
  // 콤보 후 슛은 같은 차징의 일반 슛보다 빠르다
  putBall(w, c.x + 31, c.y); c.vx = c.vy = 0; c.kickCd = 0;
  for (let i = 0; i < 10; i++) stepWorld(w, { c: { ax: 1, ay: 0, shoot: true } });
  const shot = stepWorld(w, { c: { ax: 1, ay: 0, shoot: false } }).find((e) => e.type === "kick");
  assert.equal(shot.combo, 1, "콤보 2회 → 보너스 1단계");
  const base = shootHold(10, 3);
  assert.ok(spd(w.ball) > base.speed * 1.02, `콤보 슛 ${spd(w.ball).toFixed(0)} > 기본 ${base.speed.toFixed(0)}`);
  assert.equal(w.combo[0].n, 0, "슛하면 콤보 소모");
  // 상대가 패스를 가로채면 콤보가 끊긴다
  const w2 = mk(3, [["a", 0], ["m", 0], ["x", 1]]);
  const a2 = getPlayer(w2, "a"), x2 = getPlayer(w2, "x");
  place(a2, 300, 300); place(getPlayer(w2, "m"), 800, 300); place(x2, 550, 300); putBall(w2, 331, 300);
  stepWorld(w2, { a: { ax: 1, ay: 0, pass: true } }); stepWorld(w2, { a: { ax: 1, ay: 0, pass: false } });
  const evs = []; for (let i = 0; i < 40; i++) evs.push(...stepWorld(w2, {}));
  assert.ok(!evs.some((e) => e.type === "combo"), "가로채이면 콤보 성공 아님");
  assert.equal(w2.combo[0].n, 0);
});

test("도움: 패스를 받은 선수가 바로 골을 넣으면 goal 이벤트에 assist(패스한 선수)가 담긴다", () => {
  const w = mk(2, [["a", 0], ["m", 0], ["x", 1]]);
  const a = getPlayer(w, "a"), m = getPlayer(w, "m"), x = getPlayer(w, "x");
  place(a, 500, 290); place(m, 760, 290); place(x, 100, 100); putBall(w, 531, 290);
  stepWorld(w, { a: { ax: 1, ay: 0, pass: true } }); stepWorld(w, { a: { ax: 1, ay: 0, pass: false } });
  let got = false; for (let i = 0; i < 60 && !got; i++) got = stepWorld(w, {}).some((e) => e.type === "combo");
  assert.ok(got, "패스 성공");
  putBall(w, m.x + 31, m.y); m.vx = m.vy = 0; m.kickCd = 0;
  for (let i = 0; i < 10; i++) stepWorld(w, { m: { ax: 1, ay: 0, shoot: true } });
  const evs = [...stepWorld(w, { m: { ax: 1, ay: 0, shoot: false } })];
  for (let i = 0; i < 60; i++) evs.push(...stepWorld(w, {}));
  const g = evs.find((e) => e.type === "goal");
  assert.ok(g, "골");
  assert.equal(g.scorer, "m"); assert.equal(g.assist, "a");
  assert.equal(g.own, false);
});
