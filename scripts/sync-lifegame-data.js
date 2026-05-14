// =========================
// DUO GAME ZONE / 인생게임 데이터 sync
// 프론트(홈페이지 제작/js/lifegame-events.js)를 진실의 원본으로 삼고
// 백엔드(worldcup-backend/src/lifegame-data.js)로 그대로 복사한다.
// 이렇게 해야 멀티 서버와 솔로 클라이언트가 동일한 이벤트/엔딩/분석 라인을 본다.
//
// 사용:
//   node scripts/sync-lifegame-data.js        # 한 번 복사
//   node scripts/sync-lifegame-data.js --watch # 변경 감지 자동 복사
// =========================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, "..", "..");
const SRC = path.join(repoRoot, "홈페이지 제작", "js", "lifegame-events.js");
const DST = path.join(repoRoot, "worldcup-backend", "src", "lifegame-data.js");

function copyOnce() {
  if (!fs.existsSync(SRC)) {
    console.error(`[lifegame-sync] source not found: ${SRC}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(SRC);
  fs.writeFileSync(DST, buf);
  const lines = buf.toString("utf8").split("\n").length;
  console.log(`[lifegame-sync] ${lines} lines  ${SRC}  ->  ${DST}`);
}

copyOnce();

if (process.argv.includes("--watch")) {
  console.log(`[lifegame-sync] watching ${SRC} ...`);
  let timer = null;
  fs.watch(SRC, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { copyOnce(); } catch (e) { console.error("[lifegame-sync] copy failed:", e); }
    }, 100);
  });
}
