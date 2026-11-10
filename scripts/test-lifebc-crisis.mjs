// 플듀 방송국 위기 밸런스 시뮬 — node scripts/test-lifebc-crisis.mjs [판수] [시드시작]
// 같은 시드로 난이도·전략별 반복. 전략: first(늘 첫 선택) random(아무거나) costly(제일 비싼 것) ignore(방치: 자동 선택) smart(지표 보고 판단 + 사전 관리)
import { createGame, newState, loadState, autoPlan, runShowHeadless, initCrisis, CR_DIFF } from "../../홈페이지 제작/js/lifebc/game.js";
import { CRISIS_EVENTS, CRISIS_COUNT } from "../../홈페이지 제작/js/lifebc/crisis-data.js";
import { EV_BY_ID } from "../../홈페이지 제작/js/lifebc/events.js";
import { ENDINGS } from "../../홈페이지 제작/js/lifebc/progress.js";
import { tx } from "../../홈페이지 제작/js/lifebc/i18n.js";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const N = +(process.argv[2] || 20), S0 = +(process.argv[3] || 1000), QUIET = process.argv[4] === "q";
const score = (G, ch) => { // smart: 지금 가장 약한 지표를 돌보는 선택. 돈 없으면 돈 아끼기, 위험한 도박은 피함
  const C = G.S.crisis, S = G.S, d = ch.d || {}; let v = 0; const need = (x) => Math.max(0.2, (100 - x) / 45);
  v += (d.trust || 0) * need(C.trust) + (d.unity || 0) * need(C.unity) + (d.stab || 0) * need(C.stab) - (d.ctrv || 0) * need(100 - C.ctrv) * 0.8 - (d.fat || 0) * need(100 - C.fat) * 0.6;
  v += (d.money || 0) / (S.money < 900 ? 28 : S.money < 2000 ? 60 : 110); v += (d.ads || 0) * (C.ads <= 1 ? 16 : 7); v -= (d.debt || 0) / 90;
  if (ch.fail) v -= 7; if (ch.risk) v -= Object.values(ch.risk).reduce((a, b) => a + b, 0) * 3; if (ch.clear) v += Object.keys(ch.clear).length * 3; if (ch.leave) v -= 7 * ch.leave.length; if (ch.next) v -= 5 * ch.next.length;
  if (ch.roll) { const st = ch.roll.stat === "fame" ? 30 + S.fame * 0.8 : C[ch.roll.stat] ?? 50, p = Math.min(0.92, Math.max(0.08, ch.roll.base + (st - 50) / 90)); v += p * 8 - (1 - p) * 10; }
  if (ch.end) v -= 40; if (ch.clearStreak) v += 12; return v;
};
function chooseIdx(G, policy) {
  const P = G.S.pendingEvent, ev = P.life ? null : EV_BY_ID[P.id]; if (!ev) return 0; const chs = ev.choices;
  if (policy === "first") return 0; if (policy === "ignore") return ev.auto ?? 0; if (policy === "random") return G.sim.rng.int(0, chs.length - 1);
  if (policy === "costly") { let b = 0, m = 1e9; chs.forEach((c, i) => { const x = c.d?.money ?? 0; if (x < m && !c.end) { m = x; b = i; } }); return b; }
  if (ev.cat === "crisis") { let b = 0, m = -1e9; chs.forEach((c, i) => { const s = score(G, c); if (s > m) { m = s; b = i; } }); return b; }
  return G.sim.rng.int(0, chs.length - 1);
}
function play(seed, diff, policy) {
  let S = newState({ seed, mode: "story" }); initCrisis(S, diff); const G = createGame(S); const out = { end: null, day: 30, money: 0, moneyMax: 0, urgent: 0, chainMax: 0, fired: {}, doomOffers: 0, minTrust: 100, instant: false };
  G.sim.hooks = { event: (d) => { if (d.ev.cat === "crisis") { out.urgent++; out.fired[d.ev.id] = (out.fired[d.ev.id] || 0) + 1; } } };
  for (let d = 0; d < 32; d++) {
    const C = S.crisis;
    if (policy === "smart") { // 사전 관리 + 쉬는 날 (사람이 경고를 보고 하는 행동)
      const spare = S.money > 700; if (spare && (C.stab < 50 || C.risk.maint >= 2)) G.sim.crisis.action("maint"); if (spare && (C.fat > 62 || C.unity < 45 || C.risk.grudge >= 3)) G.sim.crisis.action("rest"); if (spare && (C.trust < 48 || C.ctrv > 40 || C.risk.fans >= 2)) G.sim.crisis.action("talk"); if (S.money > 1000 && C.ads < 3) G.sim.crisis.action("sponsor");
      const restDay = C.fat > 80; if (!restDay) autoPlan(G, C.fat < 62 ? ["noon", "evening"] : ["evening"]);
    } else if (policy === "first" || policy === "random" || policy === "ignore" || policy === "costly") autoPlan(G, d % 2 ? ["noon", "evening"] : ["evening", "late"]);
    let guard = 0; while (G.sim.mode !== "night" && guard++ < 20000) { G.sim.update(0.5); if (G.shows.live) runShowHeadless(G); if (S.pendingEvent) G.events.resolve(chooseIdx(G, policy)); if (S.crisis.end) break; }
    out.money = S.money; out.moneyMax = Math.max(out.moneyMax, S.money); out.chainMax = Math.max(out.chainMax, S.crisis.peakChain); out.minTrust = Math.min(out.minTrust, S.crisis.trust);
    if (S.crisis.end) { out.end = S.crisis.end; out.day = S.day; break; }
    if (S.day >= 30) { out.end = "완주"; out.day = 30; break; }
    if (d === 11) { const L = loadState(G.sim.serialize()); if (!L || !L.crisis) out.saveFail = true; }
    G.sim.startDay();
    if (S.pendingEvent) G.events.resolve(chooseIdx(G, policy));
  }
  out.final = { t: Math.round(S.crisis.trust), u: Math.round(S.crisis.unity), s: Math.round(S.crisis.stab), c: Math.round(S.crisis.ctrv), f: Math.round(S.crisis.fat), a: S.crisis.ads, st: S.crisis.streak, cast: S.cast.filter((a) => a.status !== "gone").length };
  return out;
}
const POL = (process.env.POL || "ignore,first,random,costly,smart").split(",");
console.log(`긴급 사건 ${CRISIS_COUNT}종 · 판수 ${N}`);
const seen = new Set(); let saveFail = 0;
for (const diff of ["normal", "hard", "expert"]) { console.log(`\n[${diff}]`); for (const pol of POL) {
  const R = []; for (let i = 0; i < N; i++) { const r = play(S0 + i, diff, pol); R.push(r); Object.keys(r.fired).forEach((k) => seen.add(k)); if (r.saveFail) saveFail++; }
  const alive = R.filter((r) => r.end === "완주"), days = R.map((r) => r.day), ends = {}; for (const r of R) ends[r.end] = (ends[r.end] || 0) + 1; const avg = (f) => R.reduce((s, r) => s + f(r), 0) / R.length;
  console.log(`${pol.padEnd(7)} 완주 ${String(Math.round(alive.length / N * 100)).padStart(3)}% · 평균 종료일 ${avg((r) => r.day).toFixed(1).padStart(4)} (최단 ${Math.min(...days)}) · 긴급 ${avg((r) => r.urgent).toFixed(1)} · 연쇄 ${avg((r) => r.chainMax).toFixed(1)} · 완주 자금 ${alive.length ? Math.round(alive.reduce((s, r) => s + r.money, 0) / alive.length) : "-"} · ${JSON.stringify(ends)}`);
  if (!QUIET && pol === "smart") console.log("   마지막 지표 예:", JSON.stringify(R[0].final));
} }
const missing = CRISIS_EVENTS.filter((e) => !seen.has(e.id)).map((e) => e.id); console.log(`\n발생 확인 ${seen.size}/${CRISIS_COUNT}종, 저장 실패 ${saveFail}${missing.length ? `\n안 나온 사건: ${missing.join(", ")}` : ""}`);
process.exit(0);
