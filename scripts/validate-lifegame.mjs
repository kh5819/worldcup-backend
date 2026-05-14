// 빠른 validator — 데이터 모듈 로드 후 카운트 출력
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "..", "..", "홈페이지 제작", "js", "lifegame-events.js");
const url = pathToFileURL(target).href;

const m = await import(url);
console.log("[validate] events:", m.EVENTS.length);
console.log("[validate] endings:", m.ENDINGS.length);
console.log("[validate] analysis lines:", m.ANALYSIS_LINES.length);
const total = Object.values(m.STAGE_TURNS).reduce((a, b) => a + b, 0);
console.log("[validate] total turns:", total);
console.log("[validate] stage_turns:", m.STAGE_TURNS);
console.log("[validate] routes:", Object.keys(m.ROUTES).join(", "));

// 모든 엔딩이 함수인지 + match가 ctx 3-arg 호출에도 throw 안 하는지 sanity
const sStub = { money: 0, happy: 50, intel: 50, social: 50, power: 60, internet: 30, luck: 50 };
const rStub = { has: () => false };
const ctxStub = { gender: null, flags: { has: () => false }, relations: { romance: null, friends: {}, foes: [] }, history: [] };
let ok = 0, bad = 0;
for (const e of m.ENDINGS) {
  try { e.match(sStub, rStub, ctxStub); ok++; } catch (err) { bad++; console.error("  bad ending:", e.id, err.message); }
}
console.log(`[validate] endings match() ok=${ok} bad=${bad}`);

let okA = 0, badA = 0;
for (const a of m.ANALYSIS_LINES) {
  try { a.when(sStub, rStub, ctxStub); okA++; } catch (err) { badA++; console.error("  bad line:", err.message); }
}
console.log(`[validate] analysis when() ok=${okA} bad=${badA}`);

// special / longterm / genderRequired 통계
const stats = { normal: 0, special: 0, longterm: 0, genderM: 0, genderF: 0 };
for (const e of m.EVENTS) {
  const t = e.type || "normal";
  if (t in stats) stats[t]++;
  if (e.genderRequired === "M") stats.genderM++;
  if (e.genderRequired === "F") stats.genderF++;
}
console.log("[validate] event type breakdown:", stats);
