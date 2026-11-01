import fs from "node:fs";
// IQ 진단소 문제 생성기 시험: 모든 유형·난이도 × 여러 시드 → 생성 성공, 정답으로 채점하면 맞음, 오답은 틀림, 시간
import * as G from "../src/iq-gen.js";
import { SLIDE_BANK } from "../src/iq-bank.js";
G.setSlideBank(SLIDE_BANK);
const N = Number(process.argv[2] || 60);
let fail = 0;
const bad = (m) => { fail++; if (fail < 40) console.log("FAIL", m); };
import { answerFor } from "./iq-solver.mjs";
const stats = {};
for (const t of G.TYPE_IDS) for (let d = 1; d <= 5; d++) {
  let ms = 0, mx = 0;
  for (let s = 1; s <= N; s++) {
    const seed = (s * 2654435761) >>> 0;
    const t0 = performance.now();
    let it; try { it = G.gen(t, d, seed); } catch (e) { bad(`${t} d${d} s${s} gen ${e.message}`); continue; }
    const dt = performance.now() - t0; ms += dt; mx = Math.max(mx, dt);
    const it2 = G.gen(t, d, seed);
    if (JSON.stringify(it) !== JSON.stringify(it2)) bad(`${t} d${d} not deterministic`);
    if (JSON.stringify(G.publicItem(it)).length > 12000) bad(`${t} view too big`);
    if (t === "scale") {
      // 최적 전략 없이: 저울질 다 쓰고 후보가 1개면 정답
      const st = {}; const n = v => v; const cands = () => G.scaleCandidates(it.view.n, st.w);
      // 3분할 전략
      let pool = Array.from({ length: it.view.n }, (_, i) => i + 1);
      while ((st.w?.length || 0) < it.view.maxW && pool.length > 1) {
        const k = Math.ceil(pool.length / 3); const L = pool.slice(0, k), R = pool.slice(k, 2 * k);
        G.scaleWeigh(it, st, L, R); pool = cands();
      }
      if (!G.check(it, pool[0], st).ok) bad(`scale d${d} strategy fail n=${it.view.n} pool=${pool}`);
      const st2 = {}; if (G.check(it, it.key, st2).ok && it.view.n > 1) bad(`scale guess accepted`);
      continue;
    }
    const a = answerFor(it);
    if (a == null) { bad(`${t} d${d} s${s} no answer`); continue; }
    const r = G.check(it, a, {});
    if (!r.ok) bad(`${t} d${d} s${s} correct answer rejected ${JSON.stringify(a).slice(0, 80)}`);
    // 오답
    const W2 = () => ({ matrix: (it.key + 1) % 6, figseq: (it.key + 1) % 5, rotate: (it.key + 1) % 4, liar: (it.key + 1) % (it.view.n||1), analogy: (it.key + 1) % 4, oddword: (it.key + 1) % (it.view.words?.length||1), syllogism: (it.key + 1) % 3, gears: (it.key + 1) % (it.view.opts?.length||1), series: it.key + 1, symbols: it.key + 1 }); const wrong = ["matrix","figseq","rotate","liar","analogy","oddword","syllogism","gears","series","symbols"].includes(t) ? W2()[t] : undefined;
    if (wrong !== undefined && G.check(it, wrong, {}).ok) bad(`${t} wrong accepted`);
    if (t === "circuit" && G.check(it, null, {}).ok) bad("circuit start solved");
    if (t === "mirror" && G.check(it, it.view.mirrors.map((m) => m.s), {}).ok) bad("mirror start solved");
  }
  stats[`${t}${d}`] = [Math.round(ms / N * 10) / 10, Math.round(mx)];
}
const slow = Object.entries(stats).filter(([, [a, m]]) => m > 150);
console.log("평균/최대 ms (느린 것):", slow.length ? slow : "없음");
console.log("전체 평균 ms 상위:", Object.entries(stats).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6));
// 서버·화면 공용 파일이 같은지
for (const f of ["iq-gen", "iq-core"]) { const a = fs.readFileSync(new URL(`../src/${f}.js`, import.meta.url), "utf8"), b = fs.readFileSync(new URL(`../../홈페이지 제작/js/iq/${f}.js`, import.meta.url), "utf8"); if (a !== b) { console.log("FAIL 공용 파일 다름:", f); fail++; } else console.log("공용 파일 같음:", f); }
console.log(fail ? `실패 ${fail}` : "전부 통과");
process.exit(fail ? 1 : 0);
