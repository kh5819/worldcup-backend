// 인생 방송국 시뮬레이션 시험 — node test-sim.mjs [일수] [시드]
// 화면 없이 N일을 돌리며: 자율 행동 · 대화 · 관계 변화 · 기억 · 소문 · 사건 · 방송 · 정산 · 저장/불러오기를 확인
import { createGame, newState, loadState, autoPlan, runShowHeadless, checkGoals, checkAchievements } from "../../홈페이지 제작/js/lifebc/game.js";
import { decideEnding, ENDINGS } from "../../홈페이지 제작/js/lifebc/progress.js";
import { tx } from "../../홈페이지 제작/js/lifebc/i18n.js";
import { SAVE_VER } from "../../홈페이지 제작/js/lifebc/data.js";

globalThis.performance = globalThis.performance || { now: () => Date.now() };
const DAYS = +(process.argv[2] || 30), SEED = +(process.argv[3] || 12345);
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("  ✗", m); } else console.log("  ✓", m); };

const t0 = Date.now();
let S = newState({ seed: SEED, mode: DAYS <= 30 ? "story" : "free" });
let G = createGame(S);
const counts = { acts: {}, shows: {}, events: 0, logs: 0, nightEnds: 0 };
const hookAll = (g) => { g.sim.hooks = { log: () => counts.logs++, event: () => { counts.events++; g.events.resolve(g.sim.rng.int(0, 2)); }, dayEnd: () => counts.nightEnds++ }; };
hookAll(G);
const relSnap = JSON.stringify(Object.values(S.rels).map((r) => Object.values(r).map((x) => [Math.round(x.like), x.type])));
const abilSnap = S.cast.map((a) => Object.values(a.abil).reduce((s, v) => s + v, 0));
const visited = new Set(); let maxTick = 0, saveOK = true;

for (let d = 0; d < DAYS; d++) {
  if (d === 2) { G.sim.addViewerCast({ nick: "치즈냥", look: { base: 1, hair: 4, shirt: 2, pants: 1, skin: 2 }, preset: "romantic", goal: "love" }); G.sim.addViewerCast({ nick: "혼돈왕", look: { base: 5, hair: 0, shirt: 5, pants: 0, skin: 0 }, preset: "schemer", goal: "chaos" }); }
  autoPlan(G, d % 2 ? ["noon", "evening"] : ["evening", "late"]);
  let guard = 0;
  while (G.sim.mode !== "night" && guard++ < 20000) {
    const a0 = performance.now(); G.sim.update(0.5); maxTick = Math.max(maxTick, performance.now() - a0);
    if (G.shows.live) { const r = runShowHeadless(G); if (r) counts.shows[r.show] = (counts.shows[r.show] || 0) + 1; }
    if (G.S.pendingEvent) G.events.resolve(0);
    for (const a of G.S.cast) { if (a.act) counts.acts[a.act.k] = (counts.acts[a.act.k] || 0) + 0; const room = G.sim.G.room[(Math.round(a.y)) * 60 + Math.round(a.x)]; if (room) visited.add(room); }
    for (const a of G.S.cast) if (a.act && a.act.phase === "do" && !a._c) { a._c = a.act.t0; counts.acts[a.act.k] = (counts.acts[a.act.k] || 0) + 1; } else if (a.act?.t0 !== a._c) a._c = null;
  }
  ok(guard < 20000, `${G.S.day}일차가 밤까지 진행 (${guard} 단계)`);
  checkGoals(G.S); checkAchievements(G.S);
  if (G.S.money < -500) { console.log("  (파산)"); break; }
  G.sim.startDay();
  // 7일마다 저장 → 다시 불러와서 이어하기
  if (d % 7 === 6) { const json = G.sim.serialize(); const L = loadState(json); if (!L) saveOK = false; else { G = createGame(L); hookAll(G); } }
}
const S2 = G.S;
console.log(`\n== ${DAYS}일 시뮬 결과 (시드 ${SEED}, ${((Date.now() - t0) / 1000).toFixed(1)}초, 최대 1단계 ${maxTick.toFixed(1)}ms) ==`);
console.log("행동 횟수:", JSON.stringify(counts.acts));
console.log("방송:", JSON.stringify(counts.shows), "· 사건(선택지):", counts.events, "· 기록:", S2.log.length, "· 사건 총:", S2.stats.events);
console.log("통계:", JSON.stringify(S2.stats));
console.log("자금:", S2.money, "명성:", S2.fame.toFixed(1), "팬:", S2.fans, "최고 시청률:", S2.records.bestRating, "라이벌:", S2.rival.power.toFixed(1), "빚:", S2.debt || 0);
console.log("시청률 추이:", S2.ratings.map((r) => r.toFixed(1)).join(" "));
const types = {}; for (const a in S2.rels) for (const b in S2.rels[a]) { const t = S2.rels[a][b].type; types[t] = (types[t] || 0) + 1; }
console.log("관계 종류:", JSON.stringify(types)); let mg = 0, mr = 0; for (const a in S2.rels) for (const b in S2.rels[a]) { mg = Math.max(mg, S2.rels[a][b].grudge); mr = Math.max(mr, S2.rels[a][b].rival); } console.log("최대 원한", mg.toFixed(0), "최대 경쟁심", mr.toFixed(0));
console.log("방문한 방:", [...visited].join(","));
console.log("업적:", Object.keys(S2.achievements || {}).join(","), "· 목표:", JSON.stringify(S2.goals || {}));
const end = decideEnding(S2); console.log("엔딩:", end, tx(ENDINGS[end].name));
for (const a of S2.cast.slice(0, 3)) console.log(`- ${tx(a.name)} 인기 ${a.pop.toFixed(0)} 우승 ${a.wins} 기억 ${a.memories.length}개 예: ${a.memories.slice(-2).map((m) => tx(m.text, m.vars)).join(" / ")}`);
console.log("최근 기록:"); for (const e of S2.log.slice(-8)) console.log(`  [${e.d}일 ${String(Math.floor(e.m / 60) % 24).padStart(2, "0")}:${String(e.m % 60).padStart(2, "0")}] ${tx(e.text, e.vars)}`);

ok(Object.keys(counts.acts).length >= 10, `행동 종류 10가지 이상 (${Object.keys(counts.acts).length})`);
ok(visited.size >= 9, `출연자가 방 9곳 이상 다님 (${visited.size})`);
ok(S2.stats.talks > DAYS * 10, `대화 하루 10번 이상 (${S2.stats.talks})`);
ok(JSON.stringify(Object.values(S2.rels).map((r) => Object.values(r).map((x) => [Math.round(x.like), x.type]))) !== relSnap, "관계가 변함");
ok(S2.cast.some((a, i) => Object.values(a.abil).reduce((s, v) => s + v, 0) > abilSnap[i] + 5), "연습으로 능력 성장");
ok(S2.cast.every((a) => a.memories.length > 0) || S2.cast.filter((a) => a.memories.length > 0).length >= 6, "대부분 출연자에게 기억이 쌓임");
ok(Object.keys(counts.shows).length >= 3, `방송 3종 이상 실제 진행 (${Object.keys(counts.shows).join(",")})`);
ok(S2.stats.events >= DAYS, `사건이 하루 1건 이상 (${S2.stats.events})`);
ok(S2.rumors.length > 0, `소문 생성 (${S2.rumors.length})`);
ok(saveOK, "저장 → 불러오기 → 이어하기");
ok(S2.ver === SAVE_VER, "저장 버전 유지");
const vw = S2.cast.filter((a) => a.viewer); if (DAYS >= 5) { ok(vw.length === 2, "시청자 출연자 2명 유지"); ok(vw.every((a) => a.memories.length >= 2 && a.needs.energy > 5), `시청자 출연자도 생활·기억 (${vw.map((a) => a.name + ":" + a.memories.length).join(", ")})`); ok(vw.every((a) => Object.values(S2.rels[a.id]).some((r) => r.type !== "stranger")), "시청자 출연자도 관계 형성"); ok(vw.some((a) => a.shows > 0), "시청자 출연자 방송 출연"); }
ok(maxTick < 30, `1단계 처리 30ms 미만 (${maxTick.toFixed(1)}ms)`);
console.log(fails ? `\n실패 ${fails}개` : "\n전부 통과");
process.exit(fails ? 1 : 0);
