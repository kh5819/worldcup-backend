// 플듀 끝말잇기 — 우리말샘 사전 파일 → data/wd-words.txt (명사만) + data/wd-defs/00~ff.txt.gz (짧은 뜻, 2026-11-22)
// 사용: node scripts/build-wd-dict.mjs <우리말샘 JSON 폴더> [--keep-dialect] [--keep-old] [--keep-north] [--out <폴더>]  (기본 data/)
// · 출처: 국립국어원 우리말샘 (CC BY-SA 2.0 KR) — 게임 화면에 출처 표시
// · 고르는 것: 품사 '명사' · 어휘 단위(속담·관용구 제외) · 한글만 2~15글자 · 기본으로 방언·옛말·북한어 제외
// · 뜻: 단어마다 하나 (전문 분야 없는 일반어 > 낮은 동음이의어 번호 > 낮은 뜻 번호), 태그·「」 지우고 40글자까지
//   첫 글자 번호 % 256 으로 256개 묶음 파일 → 서버는 필요한 묶음만 풀어 읽음
import fs from "fs";
import path from "path";
import zlib from "zlib";

const dir = process.argv[2]; if (!dir || !fs.existsSync(dir)) { console.error("폴더를 찾을 수 없어요:", dir); process.exit(1); }
const keep = { dialect: process.argv.includes("--keep-dialect"), old: process.argv.includes("--keep-old"), north: process.argv.includes("--keep-north") };
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.json$/i.test(f)) files.push(p); } })(dir);
console.log("JSON 파일", files.length, "개");
const words = new Set(), defs = new Map(), stat = { items: 0, noun: 0, skipType: 0, skipUnit: 0, skipChar: 0 };
const cleanDef = (d) => String(d || "").replace(/<[^>]*>/g, "").replace(/「[^」]*」/g, "").replace(/\[[^\]]*\]/g, "").replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s.·]+/, "").trim();
const cut = (d, n = 40) => { const a = [...d]; return a.length > n ? a.slice(0, n - 1).join("").trimEnd() + "…" : d; };
const get = (o, ...ks) => { for (const k of ks) if (o && o[k] !== undefined) return o[k]; return undefined; };
function handle(item) {
  stat.items++;
  const wi = get(item, "wordinfo", "word_info") || item, word = get(wi, "word"), unit = get(wi, "word_unit");
  const senses = [].concat(get(item, "senseinfo", "sense_info") || []);
  if (!word || !senses.length) return;
  if (unit && unit !== "어휘") { stat.skipUnit++; return; }
  let ok = false, best = null;
  const sup = Number(get(wi, "sup_no") || String(word).match(/\d+$/)?.[0] || 0) || 0;
  for (const s of senses) {
    const pos = get(s, "pos"), type = String(get(s, "type") || "일반어");
    if (pos !== "명사") continue;
    if ((type.includes("방언") && !keep.dialect) || (type.includes("옛말") && !keep.old) || (type.includes("북한") && !keep.north)) { stat.skipType++; continue; }
    ok = true;
    const d = cleanDef(get(s, "definition", "definition_original")); if (!d) continue;
    const cat = [].concat(get(s, "cat_info") || []).length > 0, no = Number(get(s, "sense_no") || 999) || 999;
    const score = (cat ? 100000 : 0) + (type === "일반어" ? 0 : 50000) + sup * 1000 + no;
    if (!best || score < best.score) best = { score, d };
  }
  if (!ok) return; stat.noun++;
  const w = String(word).replace(/[-^ ]/g, "").replace(/\d+$/, "").normalize("NFC");
  if (!/^[가-힣]{2,15}$/.test(w)) { stat.skipChar++; return; }
  words.add(w);
  if (best) { const o = defs.get(w); if (!o || best.score < o.score) defs.set(w, best); }
}
function scan(o) { if (!o || typeof o !== "object") return; if (Array.isArray(o)) { for (const x of o) scan(x); return; } if ((o.wordinfo || o.word_info) && (o.senseinfo || o.sense_info)) return handle(o); for (const k of Object.keys(o)) if (typeof o[k] === "object") scan(o[k]); }
for (const f of files) { try { scan(JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""))); } catch (e) { console.error("읽기 실패", path.basename(f), e.message); } }
const out = [...words].sort();
const oi = process.argv.indexOf("--out"), outDir = oi > 0 && process.argv[oi + 1] ? path.resolve(process.argv[oi + 1]) : path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "data");
const dest = path.join(outDir, "wd-words.txt");
fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, out.join("\n") + "\n");
// 뜻 묶음 256개
const ddir = path.join(path.dirname(dest), "wd-defs"); fs.mkdirSync(ddir, { recursive: true });
const buckets = Array.from({ length: 256 }, () => []);
for (const w of out) { const o = defs.get(w); if (o) buckets[w.charCodeAt(0) % 256].push(w + "\t" + cut(o.d)); }
let defBytes = 0;
buckets.forEach((lines, i) => { const f = path.join(ddir, i.toString(16).padStart(2, "0") + ".txt.gz"); const gz = zlib.gzipSync(lines.join("\n"), { level: 9 }); fs.writeFileSync(f, gz); defBytes += gz.length; });
console.log({ ...stat, 단어: out.length, 뜻: defs.size, 파일: dest, 크기MB: (fs.statSync(dest).size / 1e6).toFixed(1), 뜻MB: (defBytes / 1e6).toFixed(1) });
console.log("예시:", out.filter((_, i) => i % Math.max(1, Math.floor(out.length / 12)) === 0).slice(0, 12).join(", "));
