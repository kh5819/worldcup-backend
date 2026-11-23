// 인생게임 REBORN 엔진을 프론트(원본) → 백엔드로 복사 — node scripts/sync-life-reborn.mjs
// 프론트 js/life 가 원본. 화면 전용 파일(장면·지도·화면 문구·멀티 화면)은 빼고 복사한다.
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../홈페이지 제작/js/life"), DST = path.resolve(here, "../src/life-reborn");
const SKIP = new Set(["life-app.js", "life-scene.js", "life-scene-more.js", "life-map.js", "life-ui-text.js", "life-multi.js", "life-multi-ui.js", "lifegame-tr-ja.js", "lifegame-tr-en.js"]);
fs.mkdirSync(DST, { recursive: true });
let n = 0; for (const f of fs.readdirSync(SRC)) { if (!f.endsWith(".js") || SKIP.has(f)) continue; fs.copyFileSync(path.join(SRC, f), path.join(DST, f)); n++; }
for (const f of fs.readdirSync(DST)) if (!fs.existsSync(path.join(SRC, f)) || SKIP.has(f)) fs.unlinkSync(path.join(DST, f));
fs.writeFileSync(path.join(DST, "README.txt"), "자동 복사본 — 고치지 말 것. 원본: 홈페이지 제작/js/life (scripts/sync-life-reborn.mjs)\n");
console.log("복사", n, "개 →", DST);
