// 인생 방송국 현장 경영(대표 걷기 콘텐츠) 시험 — node scripts/test-lifebc-patrol.mjs
// 일거리 생성(하루 한 번·결정적·걸을 수 있는 칸)·처리 보상·기자 놓치면 평판 하락·고민 대답(돈 부족·성공/실패)·결재 하루 한 번·같은 방 연습 ×1.25·저장 왕복
import { createGame, newState } from "../../홈페이지 제작/js/lifebc/game.js";
import * as PT from "../../홈페이지 제작/js/lifebc/patrol.js";
import { walkable, roomAt } from "../../홈페이지 제작/js/lifebc/map.js";
globalThis.performance = globalThis.performance || { now: () => Date.now() };
let fails = 0, pass = 0; const ok = (c, m, x = "") => { if (!c) { fails++; console.log("  ✗", m, x); } else pass++; };
const mk = (seed = 7, mode = "free") => { const S = newState({ seed, mode }), G = createGame(S); G.sim.hooks = { event: () => G.events.resolve(0) }; return G; };

{ const G = mk(), S = G.S; ok(!S.patrol || !S.patrol.day, "처음엔 비어 있음");
  PT.ensure(S, G.sim); const P = S.patrol; ok(P.day === S.day && P.spots.length >= 3 && P.spots.length <= 5, "일거리 3~5개", P.spots.length);
  ok(P.spots.every((s) => walkable(G.sim.G, s.x, s.y) && PT.SPOTS[s.k]), "걸을 수 있는 칸·유효 종류");
  ok(new Set(P.spots.map((s) => s.x + "," + s.y)).size === P.spots.length, "자리 중복 없음");
  ok(!P.spots.some((s) => s.k === "reporter"), "1~2일째는 기자 없음");
  ok(P.worry.length >= 1 && P.worry.length <= 2 && P.worry.every((w) => PT.WORRY[w.t] && S.cast.some((c) => c.id === w.id)), "고민 1~2명");
  const snap = JSON.stringify(P); PT.ensure(S, G.sim); ok(JSON.stringify(S.patrol) === snap, "같은 날 다시 안 만듦");
  const G2 = mk(); PT.ensure(G2.S, G2.sim); ok(JSON.stringify(G2.S.patrol.spots) === JSON.stringify(P.spots), "같은 시드·날짜 → 같은 배치");
  // 처리
  for (const sp of [...P.spots]) { const before = { m: S.money, f: S.fame, fans: S.fans }; const r = PT.resolve(S, G.sim, sp); ok(r && r.k === sp.k, "처리 " + sp.k);
    if (sp.k === "letter") ok(S.fans === before.fans + r.n, "팬레터 → 팬");
    if (sp.k === "coin" || sp.k === "broken") ok(S.money === before.m + r.n, "돈 증가");
    if (sp.k === "idea") ok(S.fame === before.f + r.n, "아이디어 → 평판"); }
  ok(S.patrol.spots.length === 0 && S.patrol.done >= 3, "다 처리"); ok(PT.resolve(S, G.sim, { k: "coin", x: 0, y: 0 }) === null, "없는 일거리 무시");
  // 결재
  const m0 = S.money, r1 = PT.sign(S); ok(r1.ok && S.money === m0 + PT.PAPER(S.day), "결재 → 돈"); ok(PT.sign(S).reason === "done", "결재는 하루 한 번");
  // 고민
  const w = S.patrol.worry[0], a = G.sim.byId.get(w.id); a.emo.stress = 60; S.money = 0;
  const rg = PT.answer(S, G.sim, w.id, "gift"); ok(rg && !rg.ok && rg.reason === "money", "돈 없으면 휴가·보너스 불가");
  S.money = 1e6; const st0 = a.emo.stress, rr = PT.answer(S, G.sim, w.id, "gift"); ok(rr.ok && rr.good && a.emo.stress < st0, "보너스 → 스트레스 내려감"); ok(!PT.worryOf(S, w.id), "고민 해결되면 사라짐");
  ok(PT.answer(S, G.sim, w.id, "cheer") === null, "해결된 고민엔 대답 없음");
}
/* 다음 날 · 기자 놓치기 */
{ const G = mk(11), S = G.S; S.day = 5; PT.ensure(S, G.sim); S.patrol.spots.push({ k: "reporter", x: 2, y: 14 }); S.fame = 50; S.day = 6; const r = PT.ensure(S, G.sim);
  ok(r && r.missed > 0 && S.fame === 50 - r.missed, "기자 놓치면 평판 하락", { r, f: S.fame }); ok(S.patrol.day === 6 && !S.patrol.paper, "새 날 새 일거리·결재 초기화");
  let rep = 0; for (let d = 3; d < 60; d++) { S.day = d; PT.ensure(S, G.sim); const n = S.patrol.spots.filter((s) => s.k === "reporter").length; ok(n <= 1, "기자 하루 최대 1"); rep += n; } ok(rep > 3, "기자도 가끔 나옴", rep); }
/* 대답 성격 반영: 실패하면 기분 조금 나빠짐 */
{ let good = 0, bad = 0; for (let seed = 1; seed < 30; seed++) { const G = mk(seed), S = G.S; PT.ensure(S, G.sim); for (const w of [...S.patrol.worry]) { const r = PT.answer(S, G.sim, w.id, seed % 2 ? "cheer" : "advice"); if (r?.good) good++; else bad++; } }
  ok(good > 0 && bad > 0, "격려·조언은 성격에 따라 성공/실패가 갈림", { good, bad }); }
/* ④ 같은 방 연습 ×1.25 */
{ const train = (owner) => { const G = mk(21), S = G.S, a = S.cast[0]; a.x = 26; a.y = 22; const room = roomAt(G.sim.G, 26, 22); a.act = { k: "practiceSing", phase: "do", until: S.min + 999 }; a.path = null; a.needs.energy = 100; const k = "sing", v0 = a.abil[k]; S._ownerRoom = owner ? room : null; for (let i = 0; i < 40; i++) G.sim.tickAgent(a, 0.5); return { d: a.abil[k] - v0, room }; };
  const n = train(false), y = train(true); ok(y.room === "practice", "연습실 좌표", y.room); ok(y.d > n.d * 1.15, "대표가 같은 방이면 연습 더 빠름", { n: n.d, y: y.d }); }
/* 저장 왕복 */
{ const G = mk(), S = G.S; PT.ensure(S, G.sim); PT.sign(S); const json = G.sim.serialize(), back = JSON.parse(json); ok(back.patrol && back.patrol.paper === true && back.patrol.spots.length === S.patrol.spots.length, "저장에 현장 경영 상태 포함"); }
/* 스토리 모드도 */
{ const G = mk(3, "story"); PT.ensure(G.S, G.sim); ok(G.S.patrol.spots.length >= 3, "스토리 모드 일거리"); }
/* 예외: 옛 저장(patrol 없음)·떠난 출연자 고민·출연자 0명 */
{ const G = mk(5), S = G.S; delete S.patrol; ok(PT.ensure(S, G.sim) && S.patrol.day === S.day, "옛 저장도 새로 만듦");
  const w = S.patrol.worry[0]; if (w) { G.sim.byId.get(w.id).status = "gone"; } const G2 = mk(6), S2 = G2.S; S2.cast.forEach((c) => (c.status = "gone")); S2.patrol = null; PT.ensure(S2, G2.sim); ok(S2.patrol.worry.length === 0 && S2.patrol.spots.length >= 3, "출연자 0명이어도 오류 없음");
  ok(PT.answer(S2, G2.sim, "nope", "cheer") === null && PT.answer(S, G.sim, w ? w.id : "x", "zzz") === null, "이상한 대답 무시"); }
/* 여러 날 돌려도(진짜 진행) 오류 없음 */
{ const G = mk(9), S = G.S; let days = 0, guard = 0; while (days < 5 && guard++ < 200000) { const d = S.day; PT.ensure(S, G.sim); for (const sp of [...S.patrol.spots].slice(0, 2)) PT.resolve(S, G.sim, sp); G.sim.update(0.5); if (G.shows.live) { G.shows.live.show.done = true; try { G.shows.finish(); } catch {} } if (G.sim.mode === "night") G.sim.startDay(); if (S.pendingEvent) G.events.resolve(0); if (S.day !== d) days++; }
  ok(days >= 5, "5일 진행", days); ok(Number.isFinite(S.money) && Number.isFinite(S.fame) && Number.isFinite(S.fans), "숫자 정상"); }
console.log(`현장 경영 시험: 통과 ${pass} · 실패 ${fails}`); process.exit(fails ? 1 : 0);
