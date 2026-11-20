// =========================
// 눈치 진단소 — 서버 응답 번역기 (좀비 진단소 번역기와 같은 방식) (엔진·저장은 한국어 그대로, 보내기 직전에 보는 사람 언어로)
// - 정확히 같은 문장 → 사전
// - 숫자·이름이 들어간 문장 → 사전 키의 {a}{b}{c} 자리를 패턴으로 맞춰 바꿈 (이름도 다시 번역)
// - "🔦 손전등"처럼 이모지 + 단어 → 단어만 번역
// =========================
import A from "./nc-i18n-a.js";
import B from "./nc-i18n-b.js";

const DICT = new Map();
for (const d of [A, B]) for (const [k, v] of Object.entries(d)) DICT.set(k.trim(), v);
const PATS = [...DICT.entries()].filter(([k]) => /\{[a-z]\}/.test(k)).map(([k, v]) => {
  const names = []; const src = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{([a-z])\\?\}/g, (_, n) => { names.push(n); return "(.+?)"; });
  return { re: new RegExp(`^${src.replace(/\\\{|\\\}/g, "")}$`), names, v, lit: k.replace(/\{[a-z]\}/g, "").length };
}).sort((x, y) => y.lit - x.lit);
const LI = { ja: 0, en: 1 };
const HANGUL = /[가-힣]/;

export function trStr(s, lang, depth = 0) {
  const li = LI[lang]; if (li == null || typeof s !== "string" || !HANGUL.test(s) || depth > 3) return s;
  const hit = DICT.get(s.trim()); if (hit) return hit[li];
  for (const p of PATS) {
    const m = s.match(p.re); if (!m) continue;
    let out = p.v[li];
    p.names.forEach((n, i) => { out = out.split(`{${n}}`).join(trStr(m[i + 1], lang, depth + 1)); });
    return out;
  }
  if (s.includes(" · ")) { const parts = s.split(" · "); const r = parts.map((x) => trStr(x, lang, depth + 1)); if (r.some((x, i) => x !== parts[i])) return r.join(" · "); }   // "🔦 손전등 · 🔋 건전지"
  const em = s.match(/^(\S+) (.+)$/);   // 이모지 + 단어
  if (em && !HANGUL.test(em[1])) { const r = trStr(em[2], lang, depth + 1); if (r !== em[2]) return `${em[1]} ${r}`; }
  return s;
}
const SKIP = new Set(["id", "nick", "nickname", "kind", "loc", "mode", "typeId", "type_id", "setKey", "sid", "role", "ic", "avatar", "avatarUrl", "streamer", "title", "bcId"]);
/** 응답 전체를 깊게 돌며 한국어 글자만 번역 (원본은 그대로 두고 복사본을 돌려줌) */
export function tx(v, lang, key = "") {
  if (lang !== "ja" && lang !== "en") return v;
  if (typeof v === "string") return SKIP.has(key) ? v : trStr(v, lang);
  if (Array.isArray(v)) return v.map((x) => tx(x, lang, key));
  if (v && typeof v === "object" && !(v instanceof Date)) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = SKIP.has(k) ? x : tx(x, lang, k); return o; }
  return v;
}
export const _trTest = { DICT, PATS };
