// 차고차고 물리 엔진을 프론트로 복사한다 (서버·브라우저가 같은 코드를 쓰도록)
//   node scripts/sync-chago.mjs          복사
//   node scripts/sync-chago.mjs --check  서로 같은지만 확인(다르면 종료코드 1)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src", "chago-engine.js");
const dst = path.join(here, "..", "..", "홈페이지 제작", "js", "chago-engine.js");
const HEADER = "// ⚠ 자동 복사본 — 직접 수정 금지. 원본: worldcup-backend/src/chago-engine.js → node scripts/sync-chago.mjs\n";

const body = HEADER + fs.readFileSync(src, "utf8");
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(dst) ? fs.readFileSync(dst, "utf8") : "";
  if (cur !== body) { console.error("chago-engine.js 프론트 복사본이 원본과 다릅니다. node scripts/sync-chago.mjs 를 실행하세요."); process.exit(1); }
  console.log("chago-engine.js 동일함");
} else {
  fs.writeFileSync(dst, body);
  console.log("복사 완료 →", dst);
}
