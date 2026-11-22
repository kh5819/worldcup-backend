// =========================
// 플듀 끝말잇기 — 단어 사전·한글 규칙 (2026-11-21)
// · 사전: data/wd-words.txt (한 줄에 한 단어, scripts/build-wd-dict.mjs가 국립국어원 우리말샘 자료에서 명사만 골라 만듦)
//   파일이 없으면 임시 단어 목록(wd-words-temp.js)으로 돌아감
// · 두음법칙: 앞 단어가 '력'으로 끝나면 '력'·'역' 둘 다 됨 (ㄹ→ㄴ/ㅇ, ㄴ→ㅇ)
// · 뜻 (2026-11-22): data/wd-defs/00~ff.txt.gz (첫 글자 번호 % 256 묶음, 한 줄 "단어	뜻")
//   필요할 때만 묶음 하나를 풀어 읽고 최근 48개 묶음만 기억 → 서버 메모리 적게. 파일이 없으면 뜻 없이 그대로
// =========================
import fs from "fs";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";
import { TEMP_WORDS } from "./wd-words-temp.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SB = 0xac00;
export const HANGUL_RE = /^[가-힣]+$/;
export function split(ch) { const c = ch.charCodeAt(0) - SB; if (!(c >= 0 && c <= 11171)) return null; return { i: Math.floor(c / 588), m: Math.floor((c % 588) / 28), f: c % 28 }; }
const join = (i, m, f) => String.fromCharCode(SB + i * 588 + m * 28 + f);
const IY = new Set([2, 6, 7, 12, 17, 20]); // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
/** 두음법칙으로 바뀐 첫 글자 (없으면 null): 력→역, 라→나, 녀→여 */
export function dueum(ch) {
  const s = split(ch); if (!s) return null;
  if (s.i === 5) return join(IY.has(s.m) ? 11 : 2, s.m, s.f); // ㄹ
  if (s.i === 2 && IY.has(s.m)) return join(11, s.m, s.f); // ㄴ + ㅣ계열
  return null;
}
/** 앞 단어 끝 글자로 시작할 수 있는 글자들 */
export const startsFor = (last) => { const d = dueum(last); return d ? [last, d] : [last]; };

/** 뜻 찾기 (묶음 파일). dir 없으면 항상 "" */
export function createDefs(dir) {
  const ok = !!dir && fs.existsSync(dir), cache = new Map(), MAX = 48;
  const bucket = (w) => (w.charCodeAt(0) % 256).toString(16).padStart(2, "0");
  function load(b) {
    let m = cache.get(b); if (m) { cache.delete(b); cache.set(b, m); return m; }
    m = new Map();
    try { const f = path.join(dir, b + ".txt.gz"); if (fs.existsSync(f)) for (const line of zlib.gunzipSync(fs.readFileSync(f)).toString("utf8").split("\n")) { const i = line.indexOf("\t"); if (i > 0) m.set(line.slice(0, i), line.slice(i + 1)); } } catch (e) { console.error("[wd] 뜻 파일", b, e.message); }
    cache.set(b, m); if (cache.size > MAX) cache.delete(cache.keys().next().value); return m;
  }
  return { ready: ok, of: (w) => { if (!ok || typeof w !== "string" || !w) return ""; return load(bucket(w)).get(w) || ""; } };
}

export function createDict(list, { source = "temp", defs = null } = {}) {
  const set = new Set(), by = new Map();
  for (const raw of list) {
    const w = String(raw).trim(); if (w.length < 2 || w.length > 15 || !HANGUL_RE.test(w) || set.has(w)) continue;
    set.add(w); const f = w[0]; let a = by.get(f); if (!a) by.set(f, a = []); a.push(w);
  }
  const cont = new Map(); // 끝 글자 → 이어질 수 있는 단어 수
  const contCount = (last) => { let n = cont.get(last); if (n === undefined) { n = 0; for (const s of startsFor(last)) n += by.get(s)?.length || 0; cont.set(last, n); } return n; };
  // 시작 글자 후보: 그 글자로 시작하는 단어가 넉넉한 글자만
  const minStart = set.size > 50000 ? 60 : 6;
  const starts = [...by.entries()].filter(([, a]) => a.length >= minStart).map(([k]) => k);
  // 한방 위험 기준: 이을 수 있는 (안 쓴) 단어가 이 수 이하면 위험(2)·조심(1)
  const risk = set.size > 50000 ? [15, 60] : set.size > 3000 ? [2, 6] : [1, 3];
  return {
    source, get size() { return set.size; }, has: (w) => set.has(w), startsFor, contCount, risk,
    /** 사전 API로 확인된 단어 더하기 (AI도 쓰고, 이을 단어 수에도 들어감) */
    addWord: (raw) => { const w = String(raw || "").normalize("NFC"); if (w.length < 2 || w.length > 15 || !HANGUL_RE.test(w) || set.has(w)) return false; set.add(w); const f = w[0]; let a = by.get(f); if (!a) by.set(f, a = []); a.push(w); cont.clear(); return true; },
    /** 이 글자로 시작하는 사전 단어 수 */
    countStart: (s) => by.get(s)?.length || 0,
    /** 뜻 (없으면 "") */
    def: (w) => (defs ? defs.of(w) : ""), hasDefs: !!defs?.ready,
    isKill: (w) => contCount(w[w.length - 1]) === 0,
    /** need(시작 가능한 글자들)로 시작하는 단어들 */
    wordsFrom: (needs) => { const out = []; for (const s of needs) { const a = by.get(s); if (a) out.push(a); } return out; },
    randomStart: (rng = Math.random) => starts[Math.floor(rng() * starts.length)] || "가",
  };
}

let DICT = null;
export function getDict() {
  if (DICT) return DICT;
  const file = path.join(DIR, "..", "data", "wd-words.txt");
  try {
    if (fs.existsSync(file)) {
      const list = fs.readFileSync(file, "utf8").split(/\r?\n/);
      const d = createDict(list, { source: "urimalsaem", defs: createDefs(path.join(DIR, "..", "data", "wd-defs")) });
      if (d.size >= 1000) { DICT = d; console.log(`[wd] 우리말샘 사전 ${d.size}개 단어${d.hasDefs ? " · 뜻 있음" : ""}`); return DICT; }
    }
  } catch (e) { console.error("[wd] 사전 파일 읽기 실패", e.message); }
  DICT = createDict(TEMP_WORDS.split(/\s+/), { source: "temp", defs: createDefs(path.join(DIR, "..", "data", "wd-defs")) }); // 임시 목록도 미리 받아 둔 뜻(wd-defs)이 있으면 씀
  console.log(`[wd] 임시 단어 목록 ${DICT.size}개 (data/wd-words.txt 없음)${DICT.hasDefs ? " · 뜻 있음" : ""}`);
  return DICT;
}
