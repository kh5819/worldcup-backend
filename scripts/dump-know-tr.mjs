// 번역할 상식 문항 내보내기 (사람이 읽기 쉬운 줄 형식). 한국 전용(LOCAL)·한국사는 빼고
// node scripts/dump-know-tr.mjs out.txt
import fs from "fs";
import { BANK } from "../src/know-bank.js";
import { LOCAL, I18N } from "../src/know-bank-i18n.js";
const out = [];
for (const q of BANK) {
  if (LOCAL.has(q.id) || (q.tags || []).includes("한국사")) continue;
  if (I18N[q.id]?.ja && I18N[q.id]?.en) continue;
  const f = { id: q.id, kind: q.kind, q: q.q, exp: q.exp };
  if (q.opts) f.opts = q.opts; if (q.clues) f.clues = q.clues; if (q.stmts) f.stmts = q.stmts.map((s) => s[0]);
  if (q.events) { f.events = q.events.map((e) => e[0]); if (q.events.some((e) => e[2])) f.yl = q.events.map((e) => e[2] || null); }
  if (q.pairs) f.pairs = q.pairs; if (q.n?.unit) f.unit = q.n.unit; if (q.fun) f.fun = q.fun;
  out.push(JSON.stringify(f));
}
fs.writeFileSync(process.argv[2], out.join("\n"));
console.log(out.length, "문항");
