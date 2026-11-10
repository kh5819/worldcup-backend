// 스토리 모드 새 기능 버그 사냥: 이상한 값·순서 마구 넣기 + 사건 도중 저장/불러오기 — node scripts/test-lifebc-ops-fuzz.mjs [판수] [시드]
import { createGame, newState, loadState, autoPlan, runShowHeadless, initCrisis } from "../../홈페이지 제작/js/lifebc/game.js";
import { CASES, EMERGENCIES } from "../../홈페이지 제작/js/lifebc/ops-data.js?v=202611091444";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const N = +(process.argv[2] || 60), S0 = +(process.argv[3] || 7);
const BAD = ["constructor", "__proto__", "toString", -1, 1.5, 999, NaN, null, undefined, "", "1", {}, [], true, "out", "x"];
let rs = 1; const rnd = () => ((rs = (rs * 1103515245 + 12345) >>> 0) / 4294967296), pick = (a) => a[Math.floor(rnd() * a.length)];
const fails = {}; const fail = (k, ex) => { (fails[k] = fails[k] || { n: 0, ex }).n++; };
const ok = (n, c, x = "") => { console.log(`${c ? "✅" : "❌"} ${n}${x !== "" ? " — " + x : ""}`); if (!c) process.exitCode = 1; };
const finite = (G) => { const C = G.S.crisis; return Number.isFinite(G.S.money) && ["trust", "unity", "stab", "ctrv", "fat"].every((k) => Number.isFinite(C[k]) && C[k] >= 0 && C[k] <= 100) && Number.isFinite(C.ads); };
const people = (G) => G.sim.ops.people().map((a) => a.id);
function poke(G) {
  const o = G.sim.ops, A = o.O.active, ids = people(G), r = rnd() < 0.3;
  const v = (good) => (r ? pick(BAD) : good);
  const calls = [
    () => o.inspect(v(A?.ev ? pick(A.ev).id : 1)), () => o.check(v(A?.sus ? pick(A.sus) : ids[0])), () => o.ask(v(A?.sus ? pick(A.sus) : ids[0]), v(pick(["where", "who", "did"]))),
    () => o.verdict(v(pick(["accuse", "out", "hold"])), v(A?.sus ? pick(A.sus) : ids[0])), () => o.reopen(),
    () => o.assign(v(pick(ids)), v(A?.id && EMERGENCIES.find((e) => e.id === A.id) ? pick(EMERGENCIES.find((e) => e.id === A.id).probs) : "server")), () => o.gambit(rnd() < 0.5), () => o.resolveEmg(),
    () => o.defend(v(pick(["reform", "record", "cast", "cases"]))),
    () => o.propose(v(pick(["bonus", "show", "support", "info", "protect"])), v(pick(ids))), () => o.breakPact(v(pick(o.O.pacts)?.id ?? 1)),
  ];
  const before = G.S.money; let res; try { res = pick(calls)(); } catch (e) { fail("예외 " + e.message, e.stack.split("\n")[1]); return; }
  if (res && res.ok === false && G.S.money !== before) fail("실패했는데 돈이 변함", res);
  if (!finite(G)) fail("지표가 숫자 아님/범위 밖", { m: G.S.money, c: G.S.crisis });
}
let ended = 0, reloads = 0, opsSeen = { case: 0, emg: 0, hear: 0 };
for (let gi = 0; gi < N; gi++) {
  rs = S0 * 7919 + gi; const diff = pick(["normal", "hard", "expert"]); let S = newState({ mode: "story", seed: S0 * 1000 + gi }); initCrisis(S, diff); let G = createGame(S);
  const hook = (g) => { g.sim.hooks = { op: (d) => opsSeen[d.kind]++ }; }; hook(G);
  try {
    for (let d = 0; d < 32 && !G.S.crisis.end; d++) {
      autoPlan(G, ["morning", "evening"]); if (rnd() < 0.4) poke(G);
      let g = 0; while (G.sim.mode !== "night" && g++ < 20000) {
        G.sim.update(0.5); if (G.shows.live) runShowHeadless(G);
        const P = G.S.pendingEvent;
        if (P?.op) {
          for (let k = 0; k < 6; k++) poke(G);
          // 사건 도중 저장 → 불러오기
          if (rnd() < 0.25) { const j = G.sim.serialize(); const S2 = loadState(j); if (!S2) { fail("불러오기 실패", {}); break; } G = createGame(S2); hook(G); reloads++; if (!G.S.crisis.ops?.active) fail("불러온 뒤 진행 중 일 사라짐", {}); }
          if (rnd() < 0.5) G.events.resolve(0); // 자동 마무리
          else { const A = G.sim.ops.O.active; if (A?.res || !A) { G.sim.ops.end(); } }
        } else if (P) G.events.resolve(Math.floor(rnd() * 3));
        if (G.S.pendingEvent?.op && !G.sim.ops.O.active) { fail("op 대기인데 진행 중 일 없음", {}); G.S.pendingEvent = null; }
        if (G.S.crisis.end) break;
      }
      if (g >= 20000) { fail("하루가 안 끝남", { day: G.S.day, pe: G.S.pendingEvent }); break; }
      if (G.S.crisis.end || G.S.day >= 30) break; G.sim.startDay();
      const O = G.S.crisis.ops; if (O && O.pacts.filter((p) => p.st === "on").length > 3) fail("약속 3개 초과", {});
    }
    if (G.S.crisis.end || G.S.day >= 30) ended++; else fail("끝나지 않음", { day: G.S.day });
    JSON.parse(G.sim.serialize());
  } catch (e) { fail("게임 예외 " + e.message, e.stack.split("\n").slice(1, 3).join(" | ")); }
}
console.log(`판 ${N}, 끝까지 ${ended}, 사건 중 저장/불러오기 ${reloads}회, 발생 ${JSON.stringify(opsSeen)}`);
const ks = Object.keys(fails); for (const k of ks) console.log(" -", k, "x" + fails[k].n, JSON.stringify(fails[k].ex)?.slice(0, 240));
ok("문제 없음", ks.length === 0, ks.length + "종"); void CASES;
