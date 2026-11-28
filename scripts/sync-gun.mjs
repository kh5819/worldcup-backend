// GUN ARENA: 화면의 엔진 파일(gn-data·gn-sim)을 서버로 복사. 서버와 화면이 같은 물리·판정을 쓰게.
import fs from "fs"; import path from "path";
const SRC = "D:/worldcup-project/홈페이지 제작/js/gun", DST = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../src/gun");
fs.mkdirSync(DST, { recursive: true });
for (const f of ["gn-data.js", "gn-sim.js"]) { fs.copyFileSync(path.join(SRC, f), path.join(DST, f)); console.log("copied", f); }
