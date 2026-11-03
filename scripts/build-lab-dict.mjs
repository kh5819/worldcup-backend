// 진단소 번역 사전 만들기: 뽑은 한국어 문장 목록(JSON) + 번역표(TSV: 번호\t日本語\tEnglish) → JS 사전 파일
// node scripts/build-lab-dict.mjs keys.json out.js 이름 tr1.tsv tr2.tsv ...
// 검사: 번호 빠짐·{자리} 이름 불일치·빈 번역이 있으면 멈춤
import fs from "fs";
const [keysFile, outFile, name, ...tsvs] = process.argv.slice(2);
const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
const tr = new Map(); const bad = [];
for (const f of tsvs) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [i, ja, en] = line.split("\t");
  if (ja == null || en == null || !ja.trim() || !en.trim()) { bad.push(`빈 번역: ${line.slice(0, 40)}`); continue; }
  tr.set(Number(i), { ja, en });
}
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const D = {};
keys.forEach((k, i) => {
  const t = tr.get(i); if (!t) { bad.push(`번역 없음 #${i}: ${k}`); return; }
  for (const L of ["ja", "en"]) if (ph(t[L]) !== ph(k)) bad.push(`#${i} ${L} 자리 이름 다름: "${k}" → "${t[L]}"`);
  D[k] = t;
});
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
const body = Object.entries(D).map(([k, v]) => `  ${JSON.stringify(k)}: J(${JSON.stringify(v.ja)}, ${JSON.stringify(v.en)}),`).join("\n");
fs.writeFileSync(outFile, `// ${name} 화면 글자 사전 (한국어 원문 → 日本語 · English) — clinic/lab-i18n.js의 T()·watch()가 씀\n// 만든 도구: worldcup-backend/scripts/build-lab-dict.mjs (문장 뽑기 extract-ko.mjs)\nconst J = (ja, en) => ({ ja, en });\nexport default {\n${body}\n};\n`);
console.log(Object.keys(D).length, "문장 →", outFile);
