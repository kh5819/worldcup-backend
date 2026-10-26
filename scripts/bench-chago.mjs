// 차고차고 서버 부하 측정: node scripts/bench-chago.mjs [방 수=50]
// 8명짜리(4대4) 방 N개를 30Hz로 가상 시간 60초 돌리는 데 걸린 실제 CPU 시간을 잰다.
import { createMatch, matchAddPlayer, stepMatch } from "../src/chago-match.js";
import { DT } from "../src/chago-engine.js";

const ROOMS = Number(process.argv[2]) || 50;
const SECONDS = 60;
let seed = 1;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

const rooms = [];
for (let r = 0; r < ROOMS; r++) {
  const m = createMatch({ teamSize: 4, durationSec: 300 });
  for (let i = 0; i < 8; i++) matchAddPlayer(m, { id: `r${r}p${i}`, team: i % 2 });
  rooms.push(m);
}
// 처음 3초 카운트다운을 건너뛴다
for (const m of rooms) for (let i = 0; i < 100; i++) stepMatch(m, null);

const ticks = Math.round(SECONDS / DT);
let worst = 0;
const t0 = process.hrtime.bigint();
for (let k = 0; k < ticks; k++) {
  const ts = process.hrtime.bigint();
  for (const m of rooms) {
    const ins = {};
    for (const p of m.world.players) {
      ins[p.id] = { mx: rnd() * 2 - 1, my: rnd() * 2 - 1, ax: rnd() * 2 - 1, ay: rnd() * 2 - 1, shoot: rnd() < 0.15, pass: rnd() < 0.05, dash: rnd() < 0.4, tackle: rnd() < 0.02 };
    }
    stepMatch(m, ins);
  }
  const dt = Number(process.hrtime.bigint() - ts) / 1e6;
  if (dt > worst) worst = dt;
}
const total = Number(process.hrtime.bigint() - t0) / 1e6;
const perTick = total / ticks;
console.log(`방 ${ROOMS}개 × 8명, 가상 ${SECONDS}초(${ticks}틱)`);
console.log(`실제 소요 ${total.toFixed(0)}ms | 틱당 평균 ${perTick.toFixed(3)}ms (전체 방 합계) | 최악 틱 ${worst.toFixed(3)}ms`);
console.log(`틱 예산(33.3ms) 대비 사용률 평균 ${((perTick / (DT * 1000)) * 100).toFixed(1)}% / 방 1개당 ${(perTick / ROOMS).toFixed(4)}ms`);
