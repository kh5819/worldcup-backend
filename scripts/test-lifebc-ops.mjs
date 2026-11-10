// 스토리 모드 범인 찾기·비상사태·청문회·약속 시험 — node scripts/test-lifebc-ops.mjs [판수] [시드] [off]
// off: 새 기능을 끄고 같은 시드로 비교. 전략은 '지표 보고 고르는' smart + 사건은 자동 진행(autoResolve)
import { createGame, newState, autoPlan, runShowHeadless, initCrisis } from "../../홈페이지 제작/js/lifebc/game.js";
import { Ops } from "../../홈페이지 제작/js/lifebc/ops.js?v=202611091444";
import { EV_BY_ID } from "../../홈페이지 제작/js/lifebc/events.js";
import { ENDINGS } from "../../홈페이지 제작/js/lifebc/progress.js";
import { tx } from "../../홈페이지 제작/js/lifebc/i18n.js";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const N = +(process.argv[2] || 20), S0 = +(process.argv[3] || 500), OFF = process.argv[4] === "off";
if (OFF) { Ops.prototype.hourly = () => false; Ops.prototype.dayEnd = () => {}; }
const ok = (n, c, x = "") => { console.log(`${c ? "✅" : "❌"} ${n}${x !== "" ? " — " + x : ""}`); if (!c) process.exitCode = 1; };
const smart = (G) => { const P = G.S.pendingEvent, ev = EV_BY_ID[P.id]; if (!ev) return 0; const C = G.S.crisis; let b = 0, bv = -1e9; ev.choices.forEach((ch, i) => { const d = ch.d || {}; let v = (d.trust || 0) + (d.unity || 0) + (d.stab || 0) - (d.ctrv || 0) - (d.fat || 0) * 0.6 + (d.money || 0) / (G.S.money < 900 ? 25 : 80) + (d.ads || 0) * 8; if (ch.fail) v -= 7; if (ch.end) v -= 50; if (ch.next) v -= 5; if (v > bv) { bv = v; b = i; } }); return b; };
const out = {}; let errs = 0, stuck = 0, saveFail = 0; const tot = { case: 0, emg: 0, hear: 0, pact: 0, pactOk: 0 }, res = {}, ends = {};
for (const diff of ["normal", "hard", "expert"]) {
  const days = [], E = {};
  for (let i = 0; i < N; i++) {
    const S = newState({ mode: "story", seed: S0 + i }); initCrisis(S, diff); const G = createGame(S); const O = () => S.crisis.ops;
    const seen = { case: 0, emg: 0, hear: 0 }; G.sim.hooks = { op: (d) => { seen[d.kind]++; } };
    try {
      for (let d = 0; d < 31 && !S.crisis.end && !S.ending; d++) {
        autoPlan(G, ["morning", "evening", "late"]);
        // 약속: 사흘에 한 번 기분 나쁜 사람에게 보너스·보호, 청문회 대비 지지 서약
        if (!OFF && process.argv[5] !== "nopact" && d % 3 === 1 && G.sim.ops.on) { const p = G.sim.ops.people().sort((a, b) => (a.emo?.happy ?? 50) - (b.emo?.happy ?? 50)); const t = ["bonus", "protect", "support", "show", "info"][d % 5]; const r = G.sim.ops.propose(t, p[0]?.id); if (r.ok) { tot.pact++; if (r.accepted) tot.pactOk++; } }
        let g = 0; while (G.sim.mode !== "night" && g++ < 20000) { G.sim.update(0.5); if (G.shows.live) runShowHeadless(G); if (S.pendingEvent) { if (S.pendingEvent.op) G.events.resolve(0); else G.events.resolve(smart(G)); } }
        if (g >= 20000) { stuck++; break; }
        if (S.crisis.end) break; if (S.day >= 30) break; G.sim.startDay();
        if (d % 7 === 3) { try { const j = G.sim.serialize(); JSON.parse(j); } catch { saveFail++; } }
      }
    } catch (e) { errs++; if (errs < 4) console.log("ERR", diff, i, e.stack.split("\n").slice(0, 3).join(" | ")); }
    const end = S.crisis.end || (S.day >= 30 ? "완주" : "?"); E[end] = (E[end] || 0) + 1; ends[end] = (ends[end] || 0) + 1; days.push(S.crisis.endDay || S.day);
    for (const k in seen) tot[k] += seen[k]; for (const c of O()?.cases || []) res[c.res] = (res[c.res] || 0) + 1;
    if (S.pendingEvent?.op) { stuck++; }
  }
  out[diff] = { avg: (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1), full: Math.round((E["완주"] || 0) / N * 100) + "%", E };
  console.log(`${diff.padEnd(7)} 완주 ${out[diff].full} · 평균 ${out[diff].avg}일 · ${JSON.stringify(E)}`);
}
const n = N * 3; console.log(`판당 사건 ${(tot.case / n).toFixed(2)} · 비상 ${(tot.emg / n).toFixed(2)} · 청문회 ${(tot.hear / n).toFixed(2)} · 약속 제안 ${tot.pact} 수락 ${tot.pactOk}`);
console.log("사건 결과", JSON.stringify(res));
ok("예외 0", errs === 0, errs); ok("멈춤 0", stuck === 0, stuck); ok("저장 실패 0", saveFail === 0, saveFail);
if (!OFF) { ok("범인 찾기 발생", tot.case > 0); ok("비상사태 발생", tot.emg > 0); ok("엔딩 이름 전부 있음", Object.keys(ends).every((k) => k === "완주" || k === "?" || ENDINGS[k]), Object.keys(ends).join(",")); }
void tx;
