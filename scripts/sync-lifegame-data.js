// =========================
// DUO GAME ZONE / 인생게임 데이터 sync
// 프론트(홈페이지 제작/js/…)를 진실의 원본으로 삼고 백엔드(worldcup-backend/src/…)로 복사한다.
// 멀티 서버와 솔로 클라이언트가 같은 코어·이벤트·엔딩을 쓰게 하기 위함.
// - lifegame-events.js → lifegame-data.js (기존 이름 유지)
// - v2(1살~사망): lifegame-core.js / lifegame-life-data.js / lifegame-events-young·family·later.js / lifegame-endings-v2.js
//   (import 경로의 ?v=캐시버전 쿼리는 서버에서 의미가 없어 지운다)
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
const SRC_DIR = path.join(repoRoot, "홈페이지 제작", "js");
const DST_DIR = path.join(repoRoot, "worldcup-backend", "src");
const FILES = [
  ["lifegame-events.js", "lifegame-data.js"],
  ["lifegame-core.js", "lifegame-core.js"],
  ["lifegame-life-data.js", "lifegame-life-data.js"],
  ["lifegame-events-young.js", "lifegame-events-young.js"],
  ["lifegame-events-family.js", "lifegame-events-family.js"],
  ["lifegame-events-later.js", "lifegame-events-later.js"],
  ["lifegame-events-pets.js", "lifegame-events-pets.js"],
  ["lifegame-events-careers.js", "lifegame-events-careers.js"],
  ["lifegame-endings-v2.js", "lifegame-endings-v2.js"],
  ["lifegame-systems.js", "lifegame-systems.js"],       // v3: 기억·관계·목표·시대·업적
  ["lifegame-events-v3.js", "lifegame-events-v3.js"],
];

function copyOnce() {
  for (const [src, dst] of FILES) {
    const S = path.join(SRC_DIR, src), D = path.join(DST_DIR, dst);
    if (!fs.existsSync(S)) { console.error(`[lifegame-sync] source not found: ${S}`); process.exit(1); }
    const txt = fs.readFileSync(S, "utf8").replace(/(from\s+["'][^"']+?\.js)\?v=[^"']*(["'])/g, "$1$2");
    fs.writeFileSync(D, txt);
    console.log(`[lifegame-sync] ${txt.split("\n").length} lines  ${src}  ->  src/${dst}`);
  }
}

copyOnce();

if (process.argv.includes("--watch")) {
  console.log(`[lifegame-sync] watching ${SRC_DIR} ...`);
  let timer = null;
  fs.watch(SRC_DIR, (_e, name) => {
    if (!FILES.some(([s]) => s === name)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { copyOnce(); } catch (e) { console.error("[lifegame-sync] copy failed:", e); }
    }, 100);
  });
}
