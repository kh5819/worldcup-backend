// 등록된 모든 사건 데이터를 검사한다: node scripts/validate-cases.mjs
import { CASES } from "../src/mystery-cases.js";
import { validateCase } from "../src/mystery-validate.js";

let bad = 0;
for (const [id, c] of Object.entries(CASES)) {
  const { errors, warns } = validateCase(c);
  if (c.id !== id) errors.push(`등록 이름 ${id} 와 사건 id ${c.id} 가 다름`);
  console.log(`\n■ ${id} 「${c.title}」 — 오류 ${errors.length} · 주의 ${warns.length}`);
  for (const e of errors) console.log("  ✗", e);
  for (const w of warns) console.log("  △", w);
  if (errors.length) bad++;
}
console.log(bad ? `\n✗ 오류 있는 사건 ${bad}개` : "\n✓ 모든 사건 통과");
process.exit(bad ? 1 : 0);
