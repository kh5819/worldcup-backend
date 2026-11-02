// 게임 센스 채점 엔진 시험: node scripts/test-sense-core.mjs
// 결정성 · 이상 입력 · 무작위/연타/반복 정책은 낮은 점수 · 잘하는 정책은 높은 점수 · 분포
import fs from "fs";
import * as C from "../src/sense-core.js"; import { play } from "./sense-bots.mjs";
let pass = 0, fail = 0; const fails = new Map(); const ok = (c, m) => { if (c) pass++; else { fail++; fails.set(m, (fails.get(m) || 0) + 1); } };
const R = (seed) => C.rng(seed);
// ---- 정책: good(규칙대로 잘함) · rnd(찍기) · spam(아무 때나 연타/한 가지만 반복) · idle(아무것도 안 함) ----
// 1) 공용 파일
const front = "../홈페이지 제작/js/sense/sense-core.js";
if (fs.existsSync(front)) ok(fs.readFileSync(front, "utf8") === fs.readFileSync("src/sense-core.js", "utf8"), "화면·서버 공용 파일 다름");
// 2) 결정성 · 이상 입력
for (const tid of C.TEST_IDS) for (let seed = 1; seed <= 6; seed++) {
  const a = C.genSpec(tid, seed * 977), b = C.genSpec(tid, seed * 977); ok(JSON.stringify(a) === JSON.stringify(b), `${tid} 생성 결정성`);
  const L = play(tid, a, "good", R(seed)); const s1 = C.scoreTest(tid, a, L), s2 = C.scoreTest(tid, b, JSON.parse(JSON.stringify(L))); ok(s1.score === s2.score, `${tid} 채점 결정성`);
  for (const bad of [null, {}, { a: "x", c: 5, o: [[99, [1, 1, 1, 1]]], z: [[-5, 9]], k: [["x", "z"]], b: ["nan"] }, { a: [[1e12, "p", 0]], c: [[0, 9, 0]] }]) { const r = C.scoreTest(tid, a, bad); ok(r.score >= 0 && r.score <= 100, `${tid} 이상 입력 범위`); }
}
// 3) 정책별 분포
const res = {};
for (const tid of C.TEST_IDS) {
  res[tid] = {};
  for (const pol of ["good", "rnd", "spam", "idle"]) { const xs = []; for (let i = 0; i < (tid === "teamfight" ? 12 : 60); i++) { const s = C.genSpec(tid, i * 7919 + 13); xs.push(C.scoreTest(tid, s, play(tid, s, pol, R(i + 5))).score); } res[tid][pol] = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length); }
  ok(res[tid].good >= 80, `${tid}: 잘하면 80점 이상 (${res[tid].good})`);
  ok(res[tid].rnd <= 30, `${tid}: 찍기는 30점 이하 (${res[tid].rnd})`);
  ok(res[tid].spam <= 30, `${tid}: 연타·반복은 30점 이하 (${res[tid].spam})`);
  ok(res[tid].idle <= 15, `${tid}: 가만히는 15점 이하 (${res[tid].idle})`);
}
// 4) 종합
{ const sc = Object.fromEntries(C.TEST_IDS.map((t) => [t, 100])); ok(C.totalOf(sc) === 1000, "만점 1000"); ok(C.tierOf(1000).id === "challenger" && C.tierOf(0).id === "iron" && C.tierOf(455).id === "gold", "티어 구간"); const z = Object.fromEntries(C.TEST_IDS.map((t) => [t, 0])); ok(C.totalOf(z) === 0, "0점"); const st = new Set(); for (let i = 0; i < 6000; i++) { const a = {}; for (const k of C.AREAS) a[k] = Math.floor(Math.random() * (i % 3 ? 101 : 30)); st.add(C.styleOf(a).id); } ok(st.size >= 11, `유형 도달 ${st.size}/${C.STYLES.length}`); const d = C.diagnose({ scores: { minimap: 80, engage: 60 } }); ok(d.tier.name && d.style.name && d.opinion.length, "진단"); }
console.log(`\n통과 ${pass} · 실패 ${fail}`); for (const [m, n] of fails) console.log("  ✗", m, n > 1 ? `(${n}회)` : "");
console.log("정책별 평균 점수 (잘함/찍기/연타/가만히):"); for (const t of C.TEST_IDS) console.log(` ${t.padEnd(10)} ${res[t].good} / ${res[t].rnd} / ${res[t].spam} / ${res[t].idle}`);
process.exit(fail ? 1 : 0);
