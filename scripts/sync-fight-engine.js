// =========================
// 플듀 파이터 엔진 sync — 프론트(홈페이지 제작/fight/)가 원본, 서버(src/fight-engine/)로 복사
// 서버는 이 엔진으로 두 사람의 입력 기록을 다시 돌려(재현) 공식 승패를 정한다(클라이언트 보고를 믿지 않음).
//   node scripts/sync-fight-engine.js
// =========================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "..", "..", "홈페이지 제작", "fight");
const DST = path.resolve(__dirname, "..", "src", "fight-engine");
fs.mkdirSync(DST, { recursive: true });
for (const f of ["engine.js", "chars.js", "config.js"]) {
  const txt = fs.readFileSync(path.join(SRC, f), "utf8").replace(/(from\s+["'][^"']+?\.js)\?v=[^"']*(["'])/g, "$1$2");
  fs.writeFileSync(path.join(DST, f), `// ⚠ 자동 복사본 — 고치려면 홈페이지 제작/fight/${f} 를 고치고 sync-fight-engine.js 실행\n` + txt);
  console.log(`[fight-sync] ${f} -> src/fight-engine/${f}`);
}
