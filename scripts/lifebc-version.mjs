// 인생 방송국 프론트 버전 번호 통일 — node scripts/lifebc-version.mjs [태그]
// js/lifebc 안의 모든 상대 import와 lifebc.html·lifebc-join.html의 main/join/css 주소에 같은 ?v= 를 붙인다.
// (같은 모듈을 다른 주소로 부르면 브라우저가 두 벌을 만들어 언어 설정 등이 갈라지므로 반드시 한 번에 통일)
import fs from "fs"; import path from "path";
const ROOT = "D:/worldcup-project/홈페이지 제작";
const tag = process.argv[2] || new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "");
const dir = path.join(ROOT, "js/lifebc"); let n = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  const p = path.join(dir, f), s = fs.readFileSync(p, "utf8");
  const t = s.replace(/(from\s+|import\s*\(\s*)"(\.\/[\w-]+\.js)(\?v=[\w.]+)?"/g, (m, pre, file) => { n++; return `${pre}"${file}?v=${tag}"`; });
  if (t !== s) fs.writeFileSync(p, t);
}
for (const h of ["lifebc.html", "lifebc-join.html"]) {
  const p = path.join(ROOT, h); let s = fs.readFileSync(p, "utf8");
  s = s.replace(/(\.\/js\/lifebc\/(?:main|join)\.js|\.\/lifebc\.css)\?v=[\w.]+/g, `$1?v=${tag}`); fs.writeFileSync(p, s);
}
// art.js 이미지 주소도 같은 태그
const art = path.join(dir, "main.js"); let a = fs.readFileSync(art, "utf8"); a = a.replace(/loadArt\("\?v=[\w.]+"\)/, `loadArt("?v=${tag}")`); fs.writeFileSync(art, a);
const jn = path.join(dir, "join.js"); let j = fs.readFileSync(jn, "utf8"); j = j.replace(/loadArt\("\?v=[\w.]+"\)/, `loadArt("?v=${tag}")`); fs.writeFileSync(jn, j);
console.log(`버전 ${tag}: import ${n}곳 갱신`);
