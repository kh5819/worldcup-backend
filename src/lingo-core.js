// =========================
// 플듀 언어 진단소 (PLAYDUO LANGUAGE LAB) — 공용 채점·등급·진단 유형
// 서버(src/lingo-core.js)와 화면(js/lingo/lingo-core.js)이 똑같은 파일이어야 함 (scripts/test-lingo.mjs가 확인)
// 정답·해설은 여기 없음 — 문제은행(lingo-bank-*.js)은 서버에만 있음
// 상식 진단소(know-core.js)의 채점 틀(찍기 보정·난이도 가중·분야 점수)을 그대로 가져옴
// 다른 점: 검사 언어(ko/ja/en)별 문제은행 · 난이도 3단계 선택 · 10종 검사 · 등급 SSS~D · 새 방식 spot(오류 찾기)·type(타자)
// 게임 안 평가일 뿐 공인 어학 인증이 아님 (DISCLAIMER)
// =========================

export const CORE_VERSION = 1;

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashSeed(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function shuffle(arr, r) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function dayKey(t = Date.now()) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }   // 한국 날짜
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// ---------- 검사 언어 (화면 언어와 따로) ----------
export const LANGS = ["ko", "ja", "en"];
export const LANG = {
  ko: { flag: "🇰🇷", lab: "한국어 진단소", cert: "한국어 감각 진단서", native: "한국어" },
  ja: { flag: "🇯🇵", lab: "日本語診断所", cert: "日本語センス診断書", native: "日本語" },
  en: { flag: "🇺🇸", lab: "English Language Lab", cert: "English Language Report", native: "English" },
};
export const normQLang = (l) => (LANGS.includes(l) ? l : "ko");

// ---------- 난이도 3단계 (선택) ----------
// 문항 난이도 d(1~4) 중 이 대역에서 뽑음. 보통도 d1만 나오지 않게 d2를 더 많이
export const DIFFS = {
  normal: { ko: "보통",   mix: { 1: 0.35, 2: 0.65 } },
  hard:   { ko: "어려움", mix: { 2: 0.45, 3: 0.55 } },
  expert: { ko: "전문가", mix: { 3: 0.6, 4: 0.4 } },
};
export const DIFF_KEYS = Object.keys(DIFFS);
export const normDiff = (d) => (DIFFS[d] ? d : "normal");
export const DIFF = { 1: { ko: "기초", w: 1 }, 2: { ko: "보통", w: 1.6 }, 3: { ko: "어려움", w: 2.4 }, 4: { ko: "전문가", w: 3.4 } };
/** n문항을 난이도 대역에 맞게 나눔 → { d: 개수 } */
export function diffNeed(diff, n) {
  const mix = DIFFS[normDiff(diff)].mix, ks = Object.keys(mix).map(Number), out = {};
  let left = n; ks.forEach((d, i) => { const k = i === ks.length - 1 ? left : Math.round(n * mix[d]); out[d] = k; left -= k; });
  return out;
}
export const inBand = (diff, d) => !!DIFFS[normDiff(diff)].mix[d];

// ---------- 10종 검사 (= 진단서 레이더의 축 9개 + 종합 언어 센스) ----------
// kind = 조작 방식. mcq·ox·sort·link·order·catch는 상식 진단소 화면 부품을 그대로 씀, spot·type은 언어 진단소 전용
// stage = 배경 장면 (상식 진단소 장면 재사용)
export const AREAS = ["spell", "vocab", "context", "idiom", "read", "trend", "arrange", "errfind", "typing"];
export const BANK_AREAS = AREAS;
export const AREA = {
  spell:   { ko: "맞춤법·표기", icon: "✍️", col: "#ff5fd2", desc: "헷갈리는 표기·철자" },
  vocab:   { ko: "어휘력",      icon: "📖", col: "#46e08a", desc: "낱말의 정확한 뜻" },
  context: { ko: "문맥 추론",   icon: "🧩", col: "#7ab8ff", desc: "문장 속 가장 자연스러운 표현" },
  idiom:   { ko: "빈칸 완성",   icon: "🎎", col: "#ffb347", desc: "속담·관용구·사자성어" },
  read:    { ko: "읽기·발음",   icon: "🔊", col: "#3ee6f0", desc: "읽는 법·표준 발음" },
  trend:   { ko: "신조어",      icon: "🔥", col: "#ffd35a", desc: "요즘 말·인터넷 표현" },
  arrange: { ko: "문장 배열",   icon: "🧱", col: "#9be15d", desc: "조각을 바른 순서로" },
  errfind: { ko: "오류 찾기",   icon: "🔎", col: "#ff6b6b", desc: "문장 속 틀린 곳" },
  typing:  { ko: "타자",        icon: "⌨️", col: "#9a7bff", desc: "속도와 정확도" },
};
export const CLUE_KINDS = new Set(["reveal"]);
export const KINDS = ["mcq", "ox", "sort", "link", "order", "spot", "type", "catch", "reveal"];
// 한 검사(=분야)가 쓸 수 있는 방식 · 문항 제한시간(초, 문항 난이도 d1~4)
export const GAMES = {
  spell:   { ko: "맞춤법·표기 감각", icon: "✍️", kinds: ["mcq", "ox", "sort"], lim: [15, 16, 18, 20], stage: "gallery" },
  vocab:   { ko: "어휘력",           icon: "📖", kinds: ["mcq", "link"],      lim: [15, 16, 18, 20], linkLim: [35, 38, 40, 45], stage: "museum" },
  context: { ko: "문맥 추론",        icon: "🧩", kinds: ["mcq"],              lim: [20, 22, 25, 28], stage: "office" },
  idiom:   { ko: "빈칸 완성",        icon: "🎎", kinds: ["mcq"],              lim: [16, 18, 20, 22], stage: "town" },
  read:    { ko: "읽기·발음 지식",   icon: "🔊", kinds: ["mcq"],              lim: [15, 16, 18, 20], stage: "lab" },
  trend:   { ko: "신조어·현대 표현", icon: "🔥", kinds: ["mcq", "ox"],        lim: [14, 15, 16, 18], stage: "arcade" },
  arrange: { ko: "문장 배열",        icon: "🧱", kinds: ["order"],            lim: [30, 32, 35, 40], stage: "board" },
  errfind: { ko: "오류 찾기",        icon: "🔎", kinds: ["spot"],             lim: [20, 22, 25, 28], stage: "news" },
  typing:  { ko: "타자 챌린지",      icon: "⌨️", kinds: ["type"],             lim: [40, 45, 50, 55], stage: "circuit" },
};
export const GAME_KEYS = Object.keys(GAMES);
export const isArcade = () => false;
export const limitOf = (game, d, kind) => ((kind === "link" && GAMES[game]?.linkLim?.[(d | 0) - 1]) || (kind === "ox" ? 12 : 0) || GAMES[game]?.lim[(d | 0) - 1] || 20) * 1000;

// ---------- 검사 구성 ----------
// games: 검사별 문항 수 (분야별 검사는 고른 검사만 n문항). speed는 제한시간을 줄여 빠르게(limK)
export const PLANS = {
  full:  { ko: "종합 언어 진단", n: 26, games: { spell: 3, vocab: 3, context: 3, idiom: 3, read: 3, trend: 3, arrange: 3, errfind: 3, typing: 2 }, ranked: true },
  speed: { ko: "5분 스피드 진단", n: 15, games: { spell: 2, vocab: 2, context: 2, idiom: 2, read: 2, trend: 2, arrange: 1, errfind: 2 }, limK: 0.75, ranked: true },
  area:  { ko: "개별 검사", n: 8, games: null, ranked: true, typingN: 4 },
  mix:   { ko: "종합 언어 센스", n: 12, games: { spell: 2, vocab: 2, context: 2, idiom: 1, read: 1, trend: 1, arrange: 1, errfind: 2 }, limK: 0.85, ranked: true },
};
export const PRACTICE = { retry: { ko: "오답 다시 풀기", n: 8, ranked: false } };
export const MODES = [...Object.keys(PLANS), ...Object.keys(PRACTICE)];
export const modeName = (m) => PLANS[m]?.ko || PRACTICE[m]?.ko || m;
export const planN = (mode, area) => (mode === "area" && area === "typing" ? PLANS.area.typingN : (PLANS[mode] || PRACTICE[mode])?.n || 0);

// ---------- 타자 ----------
// 한글은 자모(키 누름) 수, 영어는 글자 수, 일본어는 가나 1자 ≈ 로마자 2타로 셈. 목표 속도(타/분)는 언어별
const H0 = 0xac00, JONG2 = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);   // 겹받침(ㄳ ㄵ ㄶ ㄺ…)은 2타
const JUNG2 = new Set([9, 10, 11, 14, 15, 16, 19]);   // 이중모음(ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ)은 2타
export function strokes(text, lang) {
  let n = 0;
  for (const ch of String(text || "")) {
    const c = ch.codePointAt(0);
    if (lang === "ko" && c >= H0 && c <= 0xd7a3) { const s = c - H0, jung = Math.floor((s % 588) / 28), jong = s % 28; n += 1 + (JUNG2.has(jung) ? 2 : 1) + (jong ? (JONG2.has(jong) ? 2 : 1) : 0); }
    else if (lang === "ja" && ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff))) n += c >= 0x4e00 ? 3 : 2;
    else n += 1;
  }
  return n;
}
export const TYPE_SPEED = { ko: [120, 420], ja: [90, 300], en: [100, 360] };   // [0점 속도, 만점 속도] 타/분
// 사람이 낼 수 없는 속도 기준 (타/분): 한국어 1,100 · 영어 1,000 · 일본어 850(가나 1자 ≈ 2타로 세서 같은 속도도 숫자가 작음)
export const TYPE_MAX_CPM = { ko: 1100, en: 1000, ja: 850 };
/** 편집 거리 (짧은 문장용) */
export function editDistance(a, b) {
  a = [...String(a)]; b = [...String(b)];
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const normType = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
/** 타자 판정: 정확도(편집 거리) × 속도. ms는 서버가 잰 시간(문항 받은 때부터) */
export function typeScore(target, typed, ms, lang) {
  const t = normType(target), y = normType(typed).slice(0, t.length * 2 + 10);
  if (!y) return { part: 0, acc: 0, cpm: 0 };
  const acc = clamp01(1 - editDistance(t, y) / Math.max(1, t.length));
  const cpm = Math.round((strokes(y, lang) * 60000) / Math.max(1500, ms));
  const [lo, hi] = TYPE_SPEED[lang] || TYPE_SPEED.ko;
  const sp = clamp01((cpm - lo) / (hi - lo));
  // 사람이 낼 수 없는 속도(타/분 1,100 넘음)는 매크로·자동 입력으로 보고 0점 (세계 기록급 타자도 1,000타 안팎)
  const bot = cpm > (TYPE_MAX_CPM[lang] || 1100);
  const part = bot || acc < 0.6 ? 0 : Math.round(Math.pow((acc - 0.6) / 0.4, 1.5) * (0.45 + 0.55 * sp) * 100) / 100;
  return { part, acc: Math.round(acc * 1000) / 10, cpm, bot };
}

// ---------- 문항 하나 채점 ----------
// part 0~1. 찍기 기대값이 0에 가깝도록 순서·연결은 보정 (상식 진단소와 같음)
export function judge(kind, pub, ans, key, extra = {}) {
  if (ans == null) return 0;
  switch (kind) {
    case "mcq": case "spot": return Number(ans) === key ? 1 : 0;
    case "ox": return (ans === true || ans === "o") === key ? 1 : 0;
    case "reveal": {
      if (Number(ans) !== key) return 0;
      return [1, 0.85, 0.7, 0.55, 0.45][Math.min(4, Math.max(1, extra.stage | 0) - 1)];
    }
    case "sort": {
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const hit = key.filter((k, i) => Number(ans[i]) === k).length;
      return Math.round((hit / key.length) * 100) / 100;
    }
    case "catch": {
      if (!Array.isArray(ans)) return 0;
      const got = new Set(ans.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < key.length));
      const T = key.filter(Boolean).length; let R = 0, W = 0; for (const i of got) key[i] ? R++ : W++;
      return T ? Math.max(0, Math.round(((R - W) / T) * 100) / 100) : 0;
    }
    case "order": {
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const pos = new Map(ans.map((v, i) => [Number(v), i]));
      if (pos.size !== key.length || key.some((k) => !pos.has(k))) return 0;
      let good = 0, all = 0;
      for (let i = 0; i < key.length; i++) for (let j = i + 1; j < key.length; j++) { all++; if (pos.get(key[i]) < pos.get(key[j])) good++; }
      if (good === all) return 1;
      return Math.max(0, Math.round((2 * good / all - 1) * 0.8 * 100) / 100);
    }
    case "link": {
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const n = key.length, hit = key.filter((k, i) => Number(ans[i]) === k).length;
      if (new Set(ans.map(Number)).size !== n) return 0;
      if (hit === n) return 1;
      return Math.max(0, Math.round(((hit - 1) / (n - 1)) * 0.8 * 100) / 100);
    }
    case "type": return typeScore(key.text, typeof ans === "string" ? ans : ans?.text, extra.ms || 0, key.lang).part;
  }
  return 0;
}
export const itemWeight = (d) => DIFF[d]?.w || 1;
export function chanceOf(kind, nOpts) {
  if (kind === "ox") return 0.5;
  if (kind === "mcq" || kind === "reveal" || kind === "spot" || kind === "sort") return nOpts > 1 ? 1 / nOpts : 0;
  return 0;
}
export const GUESS_K = 0.6;
export const corrected = (r) => { const c = (r.c || 0) * GUESS_K; return (r.part - c) / (1 - c); };
// 대결 점수: 정확도 × 난이도 × 빠르기 (빠르기는 대결·스피드에서)
export function battlePoints(part, d, game, ms, lim) {
  if (!part) return 0;
  const speed = clamp01(1 - ms / lim);
  return Math.round(100 * part * itemWeight(d) * (0.6 + 0.4 * speed));
}

// ---------- 결과 전체 ----------
// 검사(분야) 점수는 문항 수가 적으면 50점 쪽으로 당겨서(사전값) 보여 줌 + conf. 문항이 없는 검사는 null(미측정)
const PRIOR_W = 1.2;
export function areaScores(results) {
  const out = {}, n = {}, raw = {};
  for (const a of AREAS) {
    const rs = results.filter((r) => r.area === a);
    n[a] = rs.length;
    if (!rs.length) { out[a] = null; raw[a] = null; continue; }
    let got = 0, max = 0;
    for (const r of rs) { const w = itemWeight(r.d); got += w * corrected(r); max += w; }
    raw[a] = Math.max(0, got / max);
    out[a] = Math.max(0, Math.min(100, Math.round((100 * (got + PRIOR_W * 0.5)) / (max + PRIOR_W))));
  }
  return { scores: out, raw, n, conf: Object.fromEntries(AREAS.map((a) => [a, n[a] >= 4 ? "high" : n[a] >= 2 ? "mid" : n[a] ? "low" : "none"])) };
}
// 일관성: 문항별 점수가 고를수록 높음 (반은 다 맞고 반은 다 틀리면 낮음) — 종합에 5%
function consistency(results) {
  if (results.length < 4) return null;
  const v = results.map((r) => clamp01(corrected(r))), m = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
  return clamp01(1 - sd / 0.5);
}
export function scoreAll(results, { speed = false } = {}) {
  let got = 0, max = 0, correct = 0, sp = 0;
  for (const r of results) { const w = itemWeight(r.d); got += w * corrected(r); max += w; if (r.part >= 1) correct++; sp += r.part > 0 ? clamp01(1 - r.ms / r.lim) : 0; }
  const acc = max ? Math.max(0, got / max) : 0;
  const A = areaScores(results), cons = consistency(results), spd = results.length ? sp / results.length : 0;
  // 종합 = 난이도 가중·찍기 보정 정답률 85% + 일관성 5% + (스피드 진단만) 빠르기 10%, 아니면 정답률 95%
  const base = speed ? 0.85 * acc + 0.1 * spd : 0.95 * acc;
  const total = Math.max(0, Math.min(100, Math.round(100 * (base + 0.05 * (cons ?? acc)))));
  const byDiff = {};
  for (const d of [1, 2, 3, 4]) { const rs = results.filter((r) => r.d === d); byDiff[d] = rs.length ? { n: rs.length, ok: rs.filter((r) => r.part >= 1).length } : null; }
  const byGame = {};
  for (const g of GAME_KEYS) { const rs = results.filter((r) => r.game === g); if (rs.length) byGame[g] = { n: rs.length, pct: Math.round(100 * rs.reduce((s, r) => s + r.part, 0) / rs.length) }; }
  const ty = results.filter((r) => r.kind === "type" && r.cpm != null && !r.bot);   // 매크로로 0점 처리된 입력은 평균에서 뺌
  const typing = ty.length ? { cpm: Math.round(ty.reduce((s, r) => s + r.cpm, 0) / ty.length), acc: Math.round((10 * ty.reduce((s, r) => s + r.tacc, 0)) / ty.length) / 10 } : null;
  return { total, acc: Math.round(acc * 1000) / 10, correct, n: results.length, rate: results.length ? Math.round((100 * correct) / results.length) : 0, areas: A.scores, areaN: A.n, conf: A.conf, byDiff, byGame, streak: bestStreak(results), cons: cons == null ? null : Math.round(cons * 100), speed: Math.round(spd * 100), typing };
}
export function bestStreak(results) { let b = 0, c = 0; for (const r of results) { if (r.part >= 1) { c++; b = Math.max(b, c); } else c = 0; } return b; }

// ---------- 등급 SSS~D (종합 점수 기준, 명확한 수치) ----------
export const GRADES = [
  { id: "SSS", min: 96, col: "#ffe27a" }, { id: "SS", min: 90, col: "#ffc95a" }, { id: "S", min: 83, col: "#ff9a5a" },
  { id: "A", min: 72, col: "#7ee0ff" }, { id: "B", min: 60, col: "#46e08a" }, { id: "C", min: 45, col: "#b9c2d8" }, { id: "D", min: 0, col: "#8a93a8" },
];
export function gradeOf(total) { for (const g of GRADES) if (total >= g.min) return g; return GRADES[GRADES.length - 1]; }

// ---------- 언어 감각 유형 ----------
// 위에서부터 처음 맞는 것. ctx: { total, areas, conf, byGame, byDiff, streak, top, low, spread, typing }
const hi = (c, a, v) => c.areas[a] != null && c.areas[a] >= v && c.conf[a] !== "low";
const dOk = (c, d) => (c.byDiff[d] ? c.byDiff[d].ok / c.byDiff[d].n : 0);
export const TYPES = [
  { id: "legend",      ko: "전설의 언어 마스터",   say: "표기·뜻·문맥·말맛까지 빈틈이 없어요. 당신이 쓴 글엔 빨간 줄이 안 생겨요.", t: (c) => c.total >= 94 && c.spread <= 22 },
  { id: "dictionary",  ko: "걸어 다니는 사전",     say: "모르는 낱말이 없는 사람. 친구들의 인간 맞춤법 검사기예요.", t: (c) => c.total >= 86 && c.spread <= 28 },
  { id: "hidden",      ko: "숨은 언어 고수",       say: "쉬운 건 가끔 놓치지만 어려운 문제는 척척. 실력을 숨기고 있었군요!", t: (c) => dOk(c, 3) + dOk(c, 4) >= 1.4 && dOk(c, 1) < 0.85 },
  { id: "proofreader", ko: "프로 교정자",          say: "틀린 글자를 한눈에 잡아내는 매의 눈. 출판사가 탐내요.", t: (c) => (c.top === "spell" || c.top === "errfind") && hi(c, c.top, 80) },
  { id: "wordsmith",   ko: "어휘 부자",            say: "딱 맞는 낱말을 골라 쓰는 사람. 글에 표현력이 넘쳐요.", t: (c) => c.top === "vocab" && hi(c, "vocab", 80) },
  { id: "reader",      ko: "행간을 읽는 사람",     say: "문장 속 숨은 뜻까지 읽어 내는 문맥 감각.", t: (c) => c.top === "context" && hi(c, "context", 80) },
  { id: "sage",        ko: "옛말 박사",            say: "속담·관용구가 술술. 말 한마디에 무게가 실려요.", t: (c) => c.top === "idiom" && hi(c, "idiom", 80) },
  { id: "announcer",   ko: "아나운서 발음",        say: "읽기와 발음이 정확한 사람. 뉴스 진행도 맡겨 볼까요?", t: (c) => c.top === "read" && hi(c, "read", 80) },
  { id: "trendsetter", ko: "신조어 트렌드세터",    say: "요즘 말을 가장 먼저 아는 사람. 단톡방 통역사예요.", t: (c) => c.top === "trend" && hi(c, "trend", 80) },
  { id: "architect",   ko: "문장 건축가",          say: "흩어진 조각으로 단단한 문장을 짓는 사람.", t: (c) => c.top === "arrange" && hi(c, "arrange", 80) },
  { id: "typist",      ko: "번개 손가락",          say: "생각보다 손이 빠른 사람. 채팅창의 지배자예요.", t: (c) => c.typing && c.typing.cpm >= 400 && c.typing.acc >= 95 },
  { id: "allrounder",  ko: "만능 언어인",          say: "어느 분야든 고르게 잘하는 균형형.", t: (c) => c.total >= 72 && c.spread <= 18 },
  { id: "bookworm",    ko: "책벌레",              say: "많이 읽어서 자연스럽게 아는 사람. 글이 몸에 배어 있어요.", t: (c) => c.total >= 68 },
  { id: "spiky",       ko: "한 우물 언어인",       say: "좋아하는 분야는 깊게, 나머지는 쿨하게.", t: (c) => c.spread >= 40 && c.total >= 45 },
  { id: "steady",      ko: "기본기 탄탄형",        say: "쉬운 문제는 거의 안 놓치는 탄탄한 기본기.", t: (c) => dOk(c, 1) >= 0.9 && c.total >= 50 },
  { id: "fan",         ko: "말놀이 애호가",        say: "말놀이를 즐기는 사람. 하면 할수록 오르는 타입이에요.", t: (c) => c.total >= 55 },
  { id: "curious",     ko: "호기심 많은 학습자",   say: "아는 것도 모르는 것도 있지만, 알아가는 재미를 아는 사람.", t: (c) => c.total >= 40 },
  { id: "intuitive",   ko: "감으로 쓰는 타입",     say: "규칙보다 느낌으로 맞히는 게 많은 승부사.", t: (c) => c.total >= 30 && dOk(c, 3) > dOk(c, 1) },
  { id: "growing",     ko: "언어 성장형",          say: "지금부터가 시작! 오답 복습으로 쑥쑥 오를 타입이에요.", t: (c) => c.total >= 20 },
  { id: "restart",     ko: "다시 도전하는 학습자", say: "오늘은 운이 없었을 뿐. 다시 하면 분명 오를 거예요.", t: () => true },
];
export const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));

// ---------- 특별 칭호 ----------
const allOk = (rs, g, n = 2) => rs.filter((r) => r.game === g).length >= n && rs.filter((r) => r.game === g).every((r) => r.part >= 1);
export const TITLES = [
  { id: "combo10", ko: "🔥 10연속 정답", t: (c) => c.streak >= 10 },
  { id: "combo5", ko: "⚡ 5연속 정답", t: (c) => c.streak >= 5 && c.streak < 10 },
  { id: "expert", ko: "🎓 전문가 문제 정복", t: (c, rs) => rs.some((r) => r.d === 4 && r.part >= 1) },
  { id: "redpen", ko: "🖍 빨간 펜 선생님", t: (c, rs) => allOk(rs, "errfind", 3) },
  { id: "speller", ko: "✍️ 맞춤법 백발백중", t: (c, rs) => allOk(rs, "spell", 3) },
  { id: "builder", ko: "🧱 문장 조립 완벽", t: (c, rs) => allOk(rs, "arrange", 3) },
  { id: "flash", ko: "⌨️ 정확도 98% 타자", t: (c) => !!c.typing && c.typing.acc >= 98 },
  { id: "perfect", ko: "💯 만점", t: (c) => c.n >= 10 && c.correct === c.n },
  { id: "allarea", ko: "🌈 모든 검사 70점 이상", t: (c) => AREAS.filter((a) => c.areas[a] != null).length >= 6 && AREAS.every((a) => c.areas[a] == null || c.areas[a] >= 70) },
];

// ---------- 진단 ----------
export function diagnose(results, { mode = "full", diff = "normal", lang = "ko" } = {}) {
  const sc = scoreAll(results, { speed: mode === "speed" });
  const known = AREAS.filter((a) => sc.areas[a] != null && sc.conf[a] !== "low");
  const pool = known.length ? known : AREAS.filter((a) => sc.areas[a] != null);
  const sorted = [...pool].sort((a, b) => sc.areas[b] - sc.areas[a]);
  const top = sorted[0] || null, low = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const spread = sorted.length > 1 ? sc.areas[top] - sc.areas[low] : 0;
  const ctx = { ...sc, top, low, spread };
  const type = TYPES.find((t) => t.t(ctx)) || TYPES[TYPES.length - 1];
  const grade = gradeOf(sc.total);
  const titles = TITLES.filter((t) => t.t(ctx, results)).map((t) => ({ id: t.id, name: t.ko }));
  const strong = sorted.filter((a) => sc.areas[a] >= 60).slice(0, 2);
  const weak = [...sorted].reverse().filter((a) => sc.areas[a] < 60 && !strong.includes(a)).slice(0, 2);
  return {
    ...sc, mode, diff, lang, top, low, spread,
    grade: { id: grade.id, col: grade.col },
    type: { id: type.id, name: type.ko, say: type.say },
    titles, strong, weak,
    note: mode === "area" || mode === "speed" ? "검사 문항이 적어서 분야 점수는 참고용이에요. 종합 언어 진단을 하면 더 정확해져요." : null,
  };
}

export const DISCLAIMER = "언어 진단소 점수와 등급은 플레이듀오 게임 안의 평가예요. 공인 어학 시험이나 표준화된 언어 능력 인증이 아니며, 이 게임 문제은행의 정답률로만 계산해요.";
