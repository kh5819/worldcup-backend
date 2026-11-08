// 언어 진단소 문제은행 자동 검사 — 형식·정답 유일성·중복·분포 (언어 사실 검증은 아님: 사람/근거 대조 기록으로)
// node scripts/validate-lingo-bank.mjs  → 오류 있으면 exit 1
import * as C from "../src/lingo-core.js";
import { validateItem, findDupes, LIVE_STATUS } from "../src/lingo-validate.js";
import { BANK } from "../src/lingo-bank.js";
let bad = 0;
const ids = new Set();
for (const q of BANK) {
  const v = validateItem(q);
  if (ids.has(q.id)) v.errors.push("id 중복"); ids.add(q.id);
  if (/�/.test(JSON.stringify(q))) v.errors.push("깨진 글자(인코딩)");
  if (q.volatile && q.asOf && (Date.parse(q.asOf + "-01") < Date.now() - 2 * 365 * 864e5)) v.warns.push("기준일 2년 지남 — 오래된 신조어인지 다시 검수");
  if (v.errors.length) { bad++; console.log("✗", q.id, v.errors.join(" · ")); }
  else if (v.warns.length) console.log("△", q.id, v.warns.join(" · "));
}
const d = findDupes(BANK); for (const x of d) console.log("≈", x.a, x.b, x.sim, x.why);
// 분포: 언어 × 검사 × 난이도 (출제 가능한 것만)
const live = BANK.filter((q) => LIVE_STATUS.has(q.status));
for (const L of C.LANGS) {
  const ls = live.filter((q) => q.lang === L); if (!ls.length) { console.log(`\n[${L}] 문항 없음`); continue; }
  console.log(`\n[${L}] 출제 ${ls.length}문항 · 사람 검수 필요 ${ls.filter((q) => q.expert).length}`);
  for (const a of C.AREAS) { const r = ls.filter((q) => q.area === a), by = [1, 2, 3, 4].map((k) => r.filter((q) => q.d === k).length); console.log(`  ${a.padEnd(8)} ${String(r.length).padStart(3)}  d1~4 ${by.join("/")}`); }
  for (const df of C.DIFF_KEYS) console.log(`  난이도 ${df}: ${ls.filter((q) => C.inBand(df, q.d)).length}문항`);
}
console.log(`\n총 ${BANK.length}문항 · 오류 ${bad} · 비슷한 쌍 ${d.length}`);
process.exit(bad ? 1 : 0);
