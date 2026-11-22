// 플듀 끝말잇기 — 임시 단어 목록을 우리말샘 API로 한 번씩 확인 (2026-11-22)
// 사용: WD_DICT_KEY=<인증키> node scripts/check-wd-temp.mjs <결과 JSON 경로>
// · 명사가 아닌 단어 목록 + 뜻(헷갈리지 않는 것만) 저장 → 이어서 하기 가능(이미 확인한 단어는 건너뜀)
import fs from "fs";
import { createDictLookup } from "../src/wd-api.js";
import { TEMP_WORDS } from "../src/wd-words-temp.js";
const out = process.argv[2]; if (!out || !process.env.WD_DICT_KEY) { console.error("사용: WD_DICT_KEY=... node scripts/check-wd-temp.mjs <결과.json>"); process.exit(1); }
const L = createDictLookup(process.env.WD_DICT_KEY, { dailyMax: 9000, timeoutMs: 8000 });
const res = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
const todo = TEMP_WORDS.split(/\s+/).filter(w => w && !(w in res));
console.log("확인할 단어", todo.length, "· 이미", Object.keys(res).length);
let i = 0, done = 0, failed = 0;
async function worker() { while (i < todo.length) { const w = todo[i++]; const r = await L.lookup(w); if (r) res[w] = r.noun ? (r.def || 1) : 0; else failed++; if (++done % 200 === 0) { fs.writeFileSync(out, JSON.stringify(res)); console.log(done, "/", todo.length, "실패", failed); } } }
await Promise.all([worker(), worker(), worker(), worker()]);
fs.writeFileSync(out, JSON.stringify(res));
const vals = Object.values(res);
console.log("끝 · 명사", vals.filter(v => v !== 0).length, "· 명사 아님", vals.filter(v => v === 0).length, "· 뜻 있음", vals.filter(v => typeof v === "string").length, "· 못 물어봄", failed);
