// 인생 방송국 PD 직접 연출 시험 — node scripts/test-lifebc-pd.mjs
// ① 안 누르면 결과 = 기존(누르기 전 코드와 같은 흐름) ② 누르면 우승자·순위는 그대로, 시청률·분위기만 오름 ③ 같은 타이밍이면 같은 결과 ④ 늦게 누르면 무효
import { createGame, newState, autoPlan, SHOW_DT } from "../../홈페이지 제작/js/lifebc/game.js";
import { CUE, PD_MAX_BONUS } from "../../홈페이지 제작/js/lifebc/pd.js";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
let fails = 0, pass = 0; const ok = (c, m, x = "") => { if (!c) { fails++; console.log("  ✗", m, x); } else pass++; };
// policy: 'none' | 'fast'(0.3초 뒤) | 'slow'(0.8×창) | 'late'(창 지나서)
function runShows(seed, policy, days = 6) {
  const S = newState({ seed, mode: "free" }), G = createGame(S); G.sim.hooks = { event: () => G.events.resolve(0) }; const out = [];
  for (let d = 0; d < days; d++) {
    autoPlan(G, ["noon", "evening"]); let guard = 0;
    while (G.sim.mode !== "night" && guard++ < 20000) {
      G.sim.update(0.5);
      if (G.shows.live) {
        const L = G.shows.live, sh = L.show, lv = sh.live; let t = 0, presses = 0, early = 0;
        while (!sh.done && t < 400) {
          sh.update(SHOW_DT); t += SHOW_DT; const c = lv?.pd?.cue;
          if (c && policy !== "none") { const age = sh.t - c.t0, win = CUE[c.k].win; if ((policy === "fast" && age >= 0.3) || (policy === "slow" && age >= win * 0.8)) { if (lv.pd.press(lv)) presses++; } if (policy === "late" && age > win + 0.06) { if (lv.pd.press(lv)) early++; } }
        }
        sh.done = true; const r = G.shows.finish(); out.push({ show: r.show, winner: r.winner, ranking: r.ranking.join(), rating: r.rating, pd: r.parts.pd || 0, peak: r.live?.peak, mood: r.live?.mood, rev: r.revenue, presses, late: early, pdr: r.live?.pd });
      }
      if (G.S.pendingEvent) G.events.resolve(0);
    }
    G.sim.startDay();
  }
  return out;
}
for (const seed of [11, 202, 3030]) {
  const none = runShows(seed, "none"), none2 = runShows(seed, "none"), fast = runShows(seed, "fast"), fast2 = runShows(seed, "fast"), slow = runShows(seed, "slow"), late = runShows(seed, "late");
  ok(none.length >= 6, `시드 ${seed}: 방송 진행`, none.length);
  ok(JSON.stringify(none) === JSON.stringify(none2), `시드 ${seed}: 안 누르면 매번 같음`);
  ok(none.every((x) => x.pd === 0 && x.pdr.hits === 0 && x.pdr.total > 0), `시드 ${seed}: 안 누르면 보너스 0 · 신호는 뜸`, none.map((x) => x.pdr.total).join());
  ok(JSON.stringify(fast) === JSON.stringify(fast2), `시드 ${seed}: 같은 타이밍이면 같은 결과`);
  ok(fast[0].winner === none[0].winner && fast[0].ranking === none[0].ranking, `시드 ${seed}: 첫 방송 우승·순위는 연출과 무관`);
  ok(fast.every((x) => x.pd > 0 && x.pd <= PD_MAX_BONUS), `시드 ${seed}: 누르면 보너스(0~${PD_MAX_BONUS})`, fast.map((x) => x.pd).join());
  ok(fast[0].peak >= none[0].peak && fast[0].mood >= none[0].mood - 3, `시드 ${seed}: 첫 방송 최고 시청자·분위기 ↑`, `${none[0].peak}→${fast[0].peak} / ${none[0].mood}→${fast[0].mood}`);
  ok(fast[0].pdr.perfect >= slow[0].pdr.perfect && slow[0].pdr.perfect === 0, `시드 ${seed}: 빨리 누를수록 완벽 컷`, `${fast[0].pdr.perfect} vs ${slow[0].pdr.perfect}`);
  ok(late.every((x) => x.late === 0 && x.pd === 0), `시드 ${seed}: 창 지나서 누르면 무효`);
  const avg = (a, k) => (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
  console.log(`  시드 ${seed}: 평균 시청률 안누름 ${avg(none, "rating")} · 빨리 ${avg(fast, "rating")} · 늦게 ${avg(slow, "rating")} | 신호 ${avg(none.map((x) => ({ v: x.pdr.total })), "v")}개/방송 · 성공 ${avg(fast.map((x) => ({ v: x.pdr.hits })), "v")}`);
}
console.log(`PD 연출 시험: 통과 ${pass} · 실패 ${fails}`); process.exit(fails ? 1 : 0);
