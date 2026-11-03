// 화면 번역용: JS·HTML 파일에서 한국어 문장 뽑기 → 사전 키 목록(JSON)
// node scripts/extract-ko.mjs out.json file1 file2 ...
// - JS: 문자열("…" '…' `…`)만 (주석 제외). 템플릿의 ${…}는 {a}{b}… 틀 자리로 바꿈, HTML 태그 기준으로 쪼갬
// - HTML: 태그 사이 글자 + placeholder·title·aria-label 값 (script·style 제외)
import fs from "fs";
const [out, ...files] = process.argv.slice(2);
const H = /[가-힣]/;
const keys = new Map(); // key → 처음 나온 파일
const add = (k, f) => { k = k.replace(/\s+/g, " ").trim(); if (!H.test(k) || k.length > 400) return; if (!keys.has(k)) keys.set(k, f); };
const splitHtml = (s, f) => s.split(/<[^>]*>/).forEach((seg) => seg.split(/&nbsp;|\n/).forEach((x) => add(x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"), f)));
function jsStrings(src, f) {
  let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && d === "*") { i = src.indexOf("*/", i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1, s = ""; while (j < n && src[j] !== c) { if (src[j] === "\\") { s += src[j + 1]; j += 2; continue; } if (src[j] === "\n") break; s += src[j++]; } if (H.test(s)) splitHtml(s, f); i = j + 1; continue; }
    if (c === "`") {
      let j = i + 1, s = "", ph = 0;
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") { s += src[j + 1]; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") { let depth = 1, k = j + 2; const st = k; while (k < n && depth) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; else if (src[k] === "`") { k = src.indexOf("`", k + 1); } k++; } const inner = src.slice(st, k - 1); jsStrings(inner, f); s += `{${String.fromCharCode(97 + (ph++ % 26))}}`; j = k; continue; }
        s += src[j++];
      }
      if (H.test(s)) splitHtml(s, f);
      i = j + 1; continue;
    }
    i++;
  }
}
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (f.endsWith(".html")) {
    const body = src.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
    for (const m of body.matchAll(/(?:placeholder|title|aria-label|content)="([^"]*)"/g)) add(m[1], f);
    splitHtml(body.replace(/<head[\s\S]*?<\/head>/, ""), f);
    for (const m of src.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) jsStrings(m[1], f);
  } else jsStrings(src, f);
}
fs.writeFileSync(out, JSON.stringify([...keys.keys()], null, 0));
console.log(keys.size, "문장");
