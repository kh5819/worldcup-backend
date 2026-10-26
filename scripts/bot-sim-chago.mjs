// 봇끼리 경기 시뮬레이션 (서버 틱 없이 최대 속도): node scripts/bot-sim-chago.mjs [경기수=20] [팀크기=4] [A난이도=normal] [B난이도=normal] [시간초=180]
import { createMatch, matchAddPlayer, stepMatch } from "../src/chago-match.js";
import { createBot, botInput } from "../src/chago-bot.js";
import { DT } from "../src/chago-engine.js";

export function simulate({ teamSize = 4, levels = ["normal", "normal"], durationSec = 180, seed = 1, trace = false } = {}) {
  const m = createMatch({ teamSize, durationSec: [120, 180, 300].includes(durationSec) ? durationSec : 180, mode: "friendly" });
  const shared = [{ plan: null, roles: {} }, { plan: null, roles: {} }];
  const bots = [];
  let eid = 0;
  for (let team = 0; team < 2; team++) for (let slot = 0; slot < teamSize; slot++) {
    matchAddPlayer(m, { id: String(eid), team, slot });
    bots.push(createBot({ eid, team, slot, teamSize, level: levels[team], seed: seed * 1000 + eid, shared: shared[team] }));
    eid++;
  }
  const stats = { ticks: 0, chaserCluster: 0, clusterSamples: 0, ballStill: 0, maxBallStill: 0, outOfField: 0, shots: 0, passes: 0, tackles: 0, goalsBy: [0, 0], possession: [0, 0], playerStill: 0, playerSamples: 0, kicks: 0 };
  let still = 0;
  const maxTicks = 30 * (durationSec + 200);
  for (let t = 0; t < maxTicks && m.phase !== "ended"; t++) {
    const inputs = {};
    if (m.phase === "play" || m.phase === "overtime") for (const b of bots) inputs[b.eid] = botInput(b, m.world, m.world.tick);
    const evs = stepMatch(m, inputs);
    stats.ticks++;
    for (const e of evs) { if (e.type === "kick") { stats.kicks++; if (e.kind === "shot") stats.shots++; else stats.passes++; } if (e.type === "tackle") stats.tackles++; }
    if (m.phase === "play" || m.phase === "overtime") {
      const b = m.world.ball;
      // 공 주변 150px 안의 같은 팀 선수 수 (몰림 지표)
      for (let team = 0; team < 2; team++) {
        const n = m.world.players.filter((p) => p.team === team && Math.hypot(p.x - b.x, p.y - b.y) < 150).length;
        if (teamSize > 1) { stats.clusterSamples++; if (n >= 3) stats.chaserCluster++; }
      }
      if (Math.hypot(b.vx, b.vy) < 5) { still++; stats.maxBallStill = Math.max(stats.maxBallStill, still); } else still = 0;
      if (b.lastTouchTeam >= 0) stats.possession[b.lastTouchTeam]++;
      for (const p of m.world.players) { stats.playerSamples++; if (Math.hypot(p.vx, p.vy) < 8) stats.playerStill++; if (p.x < 0 || p.x > m.world.field.W || p.y < 0 || p.y > m.world.field.H) stats.outOfField++; }
    }
  }
  return { m, stats };
}

if (import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1]?.endsWith("bot-sim-chago.mjs")) {
  const N = Number(process.argv[2]) || 20, size = Number(process.argv[3]) || 4;
  const lv = [process.argv[4] || "normal", process.argv[5] || "normal"], dur = Number(process.argv[6]) || 180;
  const agg = { w: [0, 0, 0], goals: [0, 0], shots: 0, passes: 0, tackles: 0, cluster: 0, csamp: 0, maxStill: 0, still: 0, samp: 0, oof: 0, totalGoals: [], endReasons: {} };
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const { m, stats } = simulate({ teamSize: size, levels: lv, durationSec: dur, seed: i + 1 });
    if (m.winner == null) agg.w[2]++; else agg.w[m.winner]++;
    agg.goals[0] += m.score[0]; agg.goals[1] += m.score[1]; agg.totalGoals.push(m.score[0] + m.score[1]);
    agg.shots += stats.shots; agg.passes += stats.passes; agg.tackles += stats.tackles;
    agg.cluster += stats.chaserCluster; agg.csamp += stats.clusterSamples; agg.maxStill = Math.max(agg.maxStill, stats.maxBallStill);
    agg.still += stats.playerStill; agg.samp += stats.playerSamples; agg.oof += stats.outOfField;
    agg.endReasons[m.endReason] = (agg.endReasons[m.endReason] || 0) + 1;
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`${N}경기 ${size}v${size} A=${lv[0]} B=${lv[1]} ${dur}s  (${((Date.now() - t0) / 1000).toFixed(1)}초 소요)`);
  console.log(`승패 A:${agg.w[0]} B:${agg.w[1]} 무:${agg.w[2]} | 평균 득점 A ${(agg.goals[0] / N).toFixed(2)} B ${(agg.goals[1] / N).toFixed(2)} | 총득점 최소 ${Math.min(...agg.totalGoals)} 최대 ${Math.max(...agg.totalGoals)} 0골경기 ${agg.totalGoals.filter((g) => g === 0).length}`);
  console.log(`경기당 슛 ${(agg.shots / N).toFixed(1)} 패스 ${(agg.passes / N).toFixed(1)} 태클 ${(agg.tackles / N).toFixed(1)}`);
  console.log(`공 주변 3명 이상 몰림 ${(agg.cluster / Math.max(1, agg.csamp) * 100).toFixed(1)}% | 공 최장 정지 ${(agg.maxStill * DT).toFixed(1)}초 | 선수 멈춤 비율 ${(agg.still / Math.max(1, agg.samp) * 100).toFixed(1)}% | 경기장 이탈 ${agg.oof}`);
  console.log("종료 사유", JSON.stringify(agg.endReasons));
}
