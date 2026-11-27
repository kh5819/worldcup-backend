// 화면의 게임 엔진 파일을 서버로 복사 (zero-core·data·anoms·content). 서버와 화면이 같은 규칙을 쓰게.
import fs from "fs"; import path from "path";
const SRC = "D:/worldcup-project/홈페이지 제작/js/zero", DST = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../src/zero");
fs.mkdirSync(DST, { recursive: true });
for (const f of ["zero-core.js", "zero-data.js", "zero-anoms.js", "zero-content.js", "zero-ugc.js"]) { fs.copyFileSync(path.join(SRC, f), path.join(DST, f)); console.log("copied", f); }
