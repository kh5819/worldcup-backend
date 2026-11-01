// 블록 탈출 어려운 문제은행 만들기 (d3~5) → src/iq-bank.js
import * as G from "../src/iq-gen.js";
import fs from "node:fs";
const want = { 3: [6, 9], 4: [9, 13], 5: [13, 40] }, COUNT = Number(process.argv[2] || 120);
const bank = { 3: [], 4: [], 5: [] }; const seen = new Set();
let seed = 1;
const t0 = Date.now();
while (Object.values(bank).some((b) => b.length < COUNT) && Date.now() - t0 < 25 * 60 * 1000) {
  const R = G.rng(seed++);
  const d = [3, 4, 5].find((x) => bank[x].length < COUNT);
  let it; try { it = G.genSlideRaw(R, d, 400); } catch { continue; }
  const opt = it.key;
  for (const k of [3, 4, 5]) if (opt >= want[k][0] && opt <= want[k][1] && bank[k].length < COUNT) {
    const row = [opt, ...it.view.pieces.flatMap((p) => [p.r, p.c, p.len, p.dir === "v" ? 1 : 0])];
    const key = row.slice(1).join(","); if (seen.has(key)) break; seen.add(key);
    bank[k].push(row); break;
  }
  if (seed % 50 === 0) console.log(seed, bank[3].length, bank[4].length, bank[5].length, Math.round((Date.now() - t0) / 1000) + "s");
}
fs.writeFileSync(new URL("../src/iq-bank.js", import.meta.url), `// 자동 생성 (scripts/build-iq-slide-bank.mjs) — 블록 탈출 문제은행 [최소 이동수, (행,열,길이,세로?)×조각]\nexport const SLIDE_BANK = ${JSON.stringify(bank)};\n`);
console.log("done", bank[3].length, bank[4].length, bank[5].length);
