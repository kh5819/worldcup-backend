// 편성표 방송 시작과 사건이 겹치는지 검사: 방송 시작 45분 전~시작 사이 사건 발동·방송 시작 때 사건 대기가 0이어야 함
import { createGame, newState, autoPlan, runShowHeadless, initCrisis } from "../../홈페이지 제작/js/lifebc/game.js";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
let begins = 0, pendAt = 0, near = 0, fired = 0;
for (let seed = 1; seed <= 8; seed++) { const S = newState({ seed: seed * 77, mode: "story" }); initCrisis(S, "hard"); S.money = 90000; const G = createGame(S); let last = -1e9;
  const b = G.shows.begin.bind(G.shows); G.shows.begin = (...a) => { begins++; if (S.pendingEvent) pendAt++; if (S.day * 1440 + S.min - last < 45) near++; return b(...a); };
  const f = G.events.fire.bind(G.events); G.events.fire = (...a) => { fired++; last = S.day * 1440 + S.min; return f(...a); };
  for (let d = 0; d < 12; d++) { autoPlan(G, ["morning", "noon", "evening", "late"]); let g = 0; while (G.sim.mode !== "night" && g++ < 20000) { G.sim.update(0.5); if (S.pendingEvent) G.events.resolve(0); if (G.shows.live) runShowHeadless(G); } if (S.crisis.end) break; G.sim.startDay(); if (S.pendingEvent) G.events.resolve(0); } }
console.log(JSON.stringify({ begins, fired, 방송시작때사건대기: pendAt, 시작45분내사건: near }));
if (pendAt || near) process.exit(1);
