// 자유 경영·함께 운영에서 새 기능(범인 찾기·비상사태·청문회·약속)이 꺼져 있는지 + 함께 운영 게스트에게 비밀이 안 가는지
import { createGame, newState, autoPlan, runShowHeadless, initCrisis } from "../../홈페이지 제작/js/lifebc/game.js";
import { CASE_BY_ID } from "../../홈페이지 제작/js/lifebc/ops-data.js?v=202611091444";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.location = globalThis.location || { hostname: "localhost", origin: "http://localhost" }; globalThis.window = globalThis.window || globalThis;
const { guestState } = await import("../../홈페이지 제작/js/lifebc/multi.js?v=202611091444");
const ok = (n, c, x = "") => { console.log(`${c ? "✅" : "❌"} ${n}${x !== "" ? " — " + x : ""}`); if (!c) process.exitCode = 1; };
function play(G, days) { let ops = 0; G.sim.hooks = { op: () => ops++ }; for (let d = 0; d < days && !G.S.crisis?.end && !G.S.ending; d++) { autoPlan(G, ["morning", "evening"]); let g = 0; while (G.sim.mode !== "night" && g++ < 20000) { G.sim.update(0.5); if (G.shows.live) runShowHeadless(G); if (G.S.pendingEvent) G.events.resolve(0); } G.sim.startDay(); } return ops; }
// 1) 자유 경영
for (let i = 0; i < 4; i++) { const S = newState({ mode: "free", seed: 50 + i }); const G = createGame(S); const n = play(G, 30); ok(`자유 경영 ${i + 1}: 새 기능 0회`, n === 0 && !G.sim.ops.on && G.sim.ops.propose("bonus", G.sim.ops.people()[0]?.id).error === "OFF", `${n}회, 날 ${S.day}`); }
// 2) 함께 운영 (방 열린 상태 표시)
for (let i = 0; i < 4; i++) { const S = newState({ mode: "story", seed: 80 + i }); initCrisis(S, "hard"); S.flags.multi = { code: "TEST", nick: "h" }; const G = createGame(S); const n = play(G, 30); ok(`함께 운영 ${i + 1}: 새 기능 0회`, n === 0 && !G.sim.ops.on, `${n}회, 날 ${S.day}, 끝 ${S.crisis.end || "-"}`); }
// 3) 혼자 하다 사건 도중 함께 운영을 열면: 게스트에게 보내는 상태에 범인 정보 없음
{ const S = newState({ mode: "story", seed: 99 }); initCrisis(S, "hard"); const G = createGame(S); G.sim.ops.startCase(CASE_BY_ID.c_sns, { forceInsider: true }); const cul = S.crisis.ops.active.culprit;
  const sent = guestState(G); const js = JSON.stringify(sent); ok("게스트 상태를 만들었음", !!sent); ok("게스트 상태에 진행 중 사건 없음", sent && !/"active":\{/.test(js) && !sent.pendingEvent && !js.includes("secret\":\""+cul), cul);
  ok("호스트 쪽 사건은 그대로", S.crisis.ops.active?.culprit === cul); }
// 4) 함께 운영을 닫으면 다시 켜짐
{ const S = newState({ mode: "story", seed: 7 }); initCrisis(S, "normal"); S.flags.multi = { code: "X" }; const G = createGame(S); ok("방 열린 동안 꺼짐", !G.sim.ops.on); delete S.flags.multi; ok("방 닫으면 다시 켜짐", G.sim.ops.on); }
