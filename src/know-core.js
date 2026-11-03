// =========================
// 플듀 상식 레벨 진단소 (PLAYDUO KNOWLEDGE LAB) — 공용 채점·레벨·진단 유형
// 서버(src/know-core.js)와 화면(js/know/know-core.js)이 똑같은 파일이어야 함 (scripts/test-know-core.mjs가 확인)
// 정답·해설은 여기 없음 — 문제은행(know-bank.js)은 서버에만 있음
//
// IQ 진단소와 다른 점: 추론 퍼즐이 아니라 "아는가"를 봄 → 풀이 속도는 혼자 검사 점수에 안 넣음
// (멀티 대결 점수에만 빠르기 가산). 점수 = 난이도 가중 정답률 + 분야 균형.
// =========================

export const CORE_VERSION = 1;
export const BANK_SCHEMA = 1;

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashSeed(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function shuffle(arr, r) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function dayKey(t = Date.now()) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }   // 한국 날짜

// ---------- 분야 (진단서 그래프 6개 + 종합·기타는 총점에만) ----------
export const AREAS = ["history", "science", "geo", "culture", "life", "econ"];
export const BANK_AREAS = [...AREAS, "mix"];
export const AREA = {
  history: { ko: "역사·사회", icon: "🏛️", col: "#ffb347", desc: "한국사·세계사·사회" },
  science: { ko: "과학·자연", icon: "🔬", col: "#46e08a" },
  geo:     { ko: "지리·세계", icon: "🌍", col: "#3ee6f0" },
  culture: { ko: "문화·예술", icon: "🎨", col: "#ff5fd2" },
  life:    { ko: "생활상식", icon: "🏠", col: "#ffd35a" },
  econ:    { ko: "경제·기술", icon: "💡", col: "#9a7bff" },
  mix:     { ko: "종합·기타", icon: "🎲", col: "#eaf6ff" },
};
// 문제은행 목표 (분야마다 90문항 · 모두 630문항, 2026-11-03 사용자 결정: 150 → 100 → 90) — 진행률 표시·검수용
// 역사·사회 90문항 중 한국사(tags "한국사") 45문항 이상
export const KOREA_HISTORY_TARGET = 45;
export const BANK_TARGET = { history: 90, science: 90, geo: 90, culture: 90, life: 90, econ: 90, mix: 90 };
export const DIFF_TARGET = { 1: 0.30, 2: 0.45, 3: 0.20, 4: 0.05 };
export const DIFF = { 1: { ko: "쉬움", w: 1 }, 2: { ko: "보통", w: 1.6 }, 3: { ko: "어려움", w: 2.4 }, 4: { ko: "전문가", w: 3.4 } };

// ---------- 10종 미니게임 ----------
// kind = 조작 방식. 같은 미니게임 안에서도 여러 kind를 쓸 수 있음
// 단서를 하나씩 서버가 내주는 방식 (받은 단서 수 = 점수 단계)
export const CLUE_KINDS = new Set(["reveal", "case", "where"]);
// 공식 검사(빠른·정밀·분야·오늘·연습)에서 빼는 아케이드 미니게임 — 조작 실력이 섞임
export const isArcade = (q) => !!GAMES_REF.g?.[q?.game]?.arcade;
const GAMES_REF = {};
export const KINDS = ["mcq", "ox", "order", "num", "map", "pair", "reveal", "fake", "sort", "case", "link", "where", "catch"];
export const GAMES = {
  world:    { ko: "세계를 맞혀라",     icon: "🌍", kinds: ["map", "mcq", "pair"], lim: [20, 22, 25, 30], stage: "globe" },
  timeline: { ko: "시간의 순서",       icon: "⏳", kinds: ["order", "mcq"],       lim: [30, 35, 40, 45], mcqLim: [16, 18, 20, 22], stage: "museum", note: "끌어서 순서 맞추기 우선 + 역사 인물·사건 문제(한국사·세계사)" },
  science:  { ko: "과학 상식 연구소",  icon: "🔬", kinds: ["mcq"],                lim: [18, 20, 22, 25], stage: "lab" },
  ox:       { ko: "진실 혹은 거짓",    icon: "⭕", kinds: ["ox"],                 lim: [12, 12, 14, 15], stage: "court" },
  culture:  { ko: "문화 박물관",       icon: "🎨", kinds: ["mcq"],                lim: [18, 20, 22, 25], stage: "gallery" },
  reveal:   { ko: "정체를 밝혀라",     icon: "🔍", kinds: ["reveal"],             lim: [30, 30, 32, 35], stage: "vault" },
  life:     { ko: "생활 속 상식",      icon: "🏠", kinds: ["mcq", "ox"],          lim: [16, 18, 20, 22], stage: "town" },
  number:   { ko: "숫자에 강한 사람",  icon: "🔢", kinds: ["num"],                lim: [25, 25, 28, 30], stage: "board" },
  fake:     { ko: "가짜 정보 판별",    icon: "📰", kinds: ["fake"],               lim: [25, 28, 30, 32], stage: "news" },
  final:    { ko: "최후의 상식왕",     icon: "👑", kinds: ["mcq", "order", "num"], lim: [18, 20, 22, 25], stage: "show", boss: true },
  // ---- 6차: 신규 5종 (2026-11-03) ----
  sortfac:  { ko: "상식 분류 공장",    icon: "🏭", kinds: ["sort"],               lim: [40, 42, 45, 48], stage: "factory", note: "컨베이어로 오는 물건을 분류함에 넣기" },
  detective:{ ko: "지식 탐정단",       icon: "🕵️", kinds: ["case"],               lim: [40, 42, 45, 48], stage: "office", note: "단서를 열어 용의자 6명 중 정답 지목 (단서 적게 쓸수록 높음)" },
  linker:   { ko: "지식 연결왕",       icon: "🔗", kinds: ["link"],               lim: [35, 38, 40, 45], stage: "circuit", note: "관련 개념을 선으로 연결 (4~6쌍)" },
  where:    { ko: "여기는 어디?",      icon: "🧭", kinds: ["where"],              lim: [30, 32, 35, 38], stage: "travel", note: "여행 엽서 단서로 장소의 나라를 지도에서 찾기" },
  catch:    { ko: "상식 캐치!",        icon: "🧺", kinds: ["catch"],              lim: [34, 34, 34, 34], stage: "arcade", arcade: true, note: "떨어지는 것 중 주제에 맞는 것만 받기 — 조작 실력이 섞여 공식 검사(빠른·정밀·챌린지)에는 넣지 않음" },
};
GAMES_REF.g = GAMES;
export const GAME_KEYS = Object.keys(GAMES);
export const limitOf = (game, d, kind) => ((kind === "mcq" && GAMES[game]?.mcqLim?.[(d | 0) - 1]) || GAMES[game]?.lim[(d | 0) - 1] || 20) * 1000;

// ---------- 검사 구성 ----------
// games: 미니게임별 문항 수, diff: 난이도별 목표 수 (정확히 못 맞추면 가까운 난이도로 채움)
export const PLANS = {
  quick: { ko: "빠른 상식 검사", n: 15, games: { world: 2, timeline: 1, science: 1, ox: 2, culture: 1, reveal: 1, life: 2, number: 1, fake: 1, final: 1, sortfac: 1, linker: 1 }, diff: { 1: 5, 2: 7, 3: 2, 4: 1 }, ranked: true },
  full:  { ko: "정밀 상식 검사", n: 40, games: { world: 4, timeline: 4, science: 4, ox: 3, culture: 4, reveal: 2, life: 3, number: 3, fake: 2, final: 4, sortfac: 2, detective: 2, linker: 2, where: 1 }, diff: { 1: 12, 2: 18, 3: 8, 4: 2 }, ranked: true },
  area:  { ko: "분야별 상식 검사", n: 10, games: null, diff: { 1: 3, 2: 4, 3: 2, 4: 1 }, ranked: true },
  daily: { ko: "오늘의 상식 챌린지", n: 10, games: { world: 1, timeline: 1, science: 1, ox: 1, culture: 1, reveal: 1, life: 1, number: 1, fake: 1, final: 1 }, diff: { 1: 3, 2: 4, 3: 2, 4: 1 }, ranked: true },
};
// 연습 (기록은 남지만 랭킹 제외): 취약 분야 = 정답률 따라 난이도 조절, 오답 다시 풀기 = 예전에 틀린 문제
export const PRACTICE = {
  arcade: { ko: "상식 캐치! 아케이드", n: 5, ranked: false, arcade: true },
  weak:  { ko: "취약 분야 연습", n: 10, adaptive: true, ranked: false },
  retry: { ko: "오답 다시 풀기", n: 10, ranked: false },
};
// 대결 전용 구성 (혼자 공식 검사엔 없음): 신규 미니게임만 모은 10라운드
export const EXTRA_PLANS = {
  fresh: { ko: "신작 미니게임 대결", n: 10, games: { sortfac: 2, detective: 2, linker: 2, where: 2, catch: 2 }, diff: { 1: 3, 2: 4, 3: 2, 4: 1 }, ranked: false, arcadeOk: true },
};
export const MODES = [...Object.keys(PLANS), ...Object.keys(PRACTICE)];
export const modeName = (m) => PLANS[m]?.ko || PRACTICE[m]?.ko || m;
// 최후의 상식왕은 검사 끝에 몰아서 (보스 라운드)
export const FINAL_LAST = true;

// ---------- 문항 하나 채점 ----------
// part 0~1. 찍기 기대값이 0에 가깝도록 순서·연결은 보정
export function judge(kind, pub, ans, key, extra = {}) {
  if (ans == null) return 0;
  switch (kind) {
    case "mcq": case "map": return Number(ans) === key ? 1 : 0;
    case "ox": return (ans === true || ans === "o") === key ? 1 : 0;
    case "fake": return Number(ans) === key ? 1 : 0;
    case "case": {     // 지식 탐정단: 용의자 지목 — 단서를 적게 열수록 높음 (단서 단계는 서버 기록)
      if (Number(ans) !== key) return 0;
      return [1, 0.85, 0.7, 0.55, 0.45][Math.min(4, Math.max(1, extra.stage | 0) - 1)];
    }
    case "where": {    // 여기는 어디?: 지도에서 나라 — 엽서 단서를 더 볼수록 낮음
      if (Number(ans) !== key) return 0;
      return [1, 0.85, 0.7, 0.6][Math.min(3, Math.max(1, extra.stage | 0) - 1)];
    }
    case "sort": {     // 분류 공장: 맞게 넣은 비율 (찍기 확률 1/분류함 수는 점수 계산에서 보정)
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const hit = key.filter((k, i) => Number(ans[i]) === k).length;
      return Math.round((hit / key.length) * 100) / 100;
    }
    case "catch": {    // 캐치: (받은 정답 − 받은 오답) / 정답 수. 놓친 정답은 조작 탓일 수 있어 감점 없이 비율만 줄어듦
      if (!Array.isArray(ans)) return 0;
      const got = new Set(ans.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < key.length));
      const T = key.filter(Boolean).length; let R = 0, W = 0; for (const i of got) key[i] ? R++ : W++;
      return T ? Math.max(0, Math.round(((R - W) / T) * 100) / 100) : 0;
    }
    case "reveal": {   // 일찍 맞힐수록 높음 (단계는 서버가 기록한 값)
      if (Number(ans) !== key) return 0;
      const st = Math.max(1, extra.stage | 0);
      return [1, 0.85, 0.7, 0.55, 0.45][Math.min(4, st - 1)];
    }
    case "order": {    // 짝 맞춤 비율 → 무작위(0.5)면 0점, 완벽하면 1
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const pos = new Map(ans.map((v, i) => [Number(v), i]));
      if (pos.size !== key.length || key.some((k) => !pos.has(k))) return 0;
      let good = 0, all = 0;
      for (let i = 0; i < key.length; i++) for (let j = i + 1; j < key.length; j++) { all++; if (pos.get(key[i]) < pos.get(key[j])) good++; }
      if (good === all) return 1;
      return Math.max(0, Math.round((2 * good / all - 1) * 0.8 * 100) / 100);   // 다 맞춤이 아니면 최대 0.8
    }
    case "link":       // 지식 연결왕: 짝 맞추기와 같은 채점 (연결선으로 고름)
    case "pair": {     // key[i] = i번째 왼쪽과 짝인 오른쪽 번호. 무작위 기대값(1/n) 빼기
      if (!Array.isArray(ans) || ans.length !== key.length) return 0;
      const n = key.length, hit = key.filter((k, i) => Number(ans[i]) === k).length;
      if (new Set(ans.map(Number)).size !== n) return 0;
      if (hit === n) return 1;
      return Math.max(0, Math.round(((hit - 1) / (n - 1)) * 0.8 * 100) / 100);
    }
    case "num": {      // key = { v, tol(완전 정답 범위), far(0점 되는 거리), abs(연도처럼 절대 차) }
      const x = Number(ans); if (!Number.isFinite(x)) return 0;
      const err = key.abs ? Math.abs(x - key.v) : Math.abs(Math.log(Math.max(x, 1e-9) / key.v));
      const tol = key.abs ? key.tol : Math.log(1 + key.tol), far = key.abs ? key.far : Math.log(1 + key.far);
      if (err <= tol) return 1;
      if (err >= far) return 0;
      return Math.round((1 - (err - tol) / (far - tol)) * 0.7 * 100) / 100;   // 근접은 최대 0.7
    }
  }
  return 0;
}
export const itemWeight = (d, game) => (DIFF[d]?.w || 1) * (game === "final" ? 1.25 : 1);
// 찍어서 맞힐 확률 (보기 수 기준). 순서·연결·숫자는 judge가 이미 찍기 = 0점이 되게 보정함
export function chanceOf(kind, nOpts) {
  if (kind === "ox") return 0.5;
  if (kind === "mcq" || kind === "map" || kind === "reveal" || kind === "fake" || kind === "case" || kind === "where" || kind === "sort") return nOpts > 1 ? 1 / nOpts : 0;
  return 0;
}
// 찍기 보정 점수: (맞힌 몫 − k×찍기 확률) / (1 − k×찍기 확률), k = 0.6
// 완전 보정(k=1)은 절반 맞히고 절반 틀린 사람이 33점이 돼 너무 박함 → 다 찍으면 약 10~15점, 다 알면 100점
export const GUESS_K = 0.6;
export const corrected = (r) => { const c = (r.c || 0) * GUESS_K; return (r.part - c) / (1 - c); };

// 멀티 대결 점수: 정확도 × 난이도 × 빠르기 (빠르기는 대결에서만)
export function battlePoints(part, d, game, ms, lim) {
  if (!part) return 0;
  const speed = Math.max(0, Math.min(1, 1 - ms / lim));
  return Math.round(100 * part * itemWeight(d, game) * (0.6 + 0.4 * speed));
}

// ---------- 결과 전체 ----------
// results: [{ id, game, kind, area, d, part, c(찍기 확률), ms, lim, timeout, stage }]
// 분야 점수는 문항 수가 적으면 50점 쪽으로 당겨서 보여줌(사전값 = 보통 1문항 50%) + conf 표시
const PRIOR_W = 1.6;
export function areaScores(results) {
  const out = {}, n = {}, raw = {};
  for (const a of AREAS) {
    const rs = results.filter((r) => r.area === a);
    n[a] = rs.length;
    if (!rs.length) { out[a] = null; raw[a] = null; continue; }
    let got = 0, max = 0;
    for (const r of rs) { const w = itemWeight(r.d, r.game); got += w * corrected(r); max += w; }
    raw[a] = Math.max(0, got / max);
    out[a] = Math.max(0, Math.min(100, Math.round((100 * (got + PRIOR_W * 0.5)) / (max + PRIOR_W))));
  }
  return { scores: out, raw, n, conf: Object.fromEntries(AREAS.map((a) => [a, n[a] >= 5 ? "high" : n[a] >= 3 ? "mid" : n[a] ? "low" : "none"])) };
}
export function scoreAll(results) {
  let got = 0, max = 0, correct = 0;
  for (const r of results) { const w = itemWeight(r.d, r.game); got += w * corrected(r); max += w; if (r.part >= 1) correct++; }
  const acc = max ? Math.max(0, got / max) : 0;   // 난이도 가중 + 찍기 보정 정답률
  const A = areaScores(results);
  const vals = AREAS.map((a) => A.raw[a]).filter((v) => v != null);   // 균형은 당기기 전 값으로
  const bal = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : acc;
  // 종합 = 난이도 가중 정답률 85% + 분야 평균 15% (한 분야만 잘해서 높게 나오는 것 방지)
  const total = Math.max(0, Math.min(100, Math.round(100 * (0.85 * acc + 0.15 * Math.min(bal, acc + 0.1)))));
  const byDiff = {};
  for (const d of [1, 2, 3, 4]) { const rs = results.filter((r) => r.d === d); byDiff[d] = rs.length ? { n: rs.length, ok: rs.filter((r) => r.part >= 1).length } : null; }
  const byGame = {};
  for (const g of GAME_KEYS) { const rs = results.filter((r) => r.game === g); if (rs.length) byGame[g] = { n: rs.length, pct: Math.round(100 * rs.reduce((s, r) => s + r.part, 0) / rs.length) }; }
  return { total, acc: Math.round(acc * 1000) / 10, correct, n: results.length, rate: results.length ? Math.round((100 * correct) / results.length) : 0, areas: A.scores, areaN: A.n, conf: A.conf, byDiff, byGame, streak: bestStreak(results) };
}
export function bestStreak(results) { let b = 0, c = 0; for (const r of results) { if (r.part >= 1) { c++; b = Math.max(b, c); } else c = 0; } return b; }

// ---------- 상식 레벨 LV.1~10 ----------
export const LEVELS = [
  { lv: 1, min: 0, ko: "상식 새싹" }, { lv: 2, min: 15, ko: "호기심 탐험가" }, { lv: 3, min: 27, ko: "상식 견습생" },
  { lv: 4, min: 38, ko: "생활 지식인" }, { lv: 5, min: 48, ko: "상식 중수" }, { lv: 6, min: 58, ko: "지식 탐험가" },
  { lv: 7, min: 68, ko: "상식 고수" }, { lv: 8, min: 77, ko: "박식가" }, { lv: 9, min: 86, ko: "걸어 다니는 백과사전" },
  { lv: 10, min: 94, ko: "전설의 상식왕" },
];
export function levelOf(total) { let L = LEVELS[0]; for (const l of LEVELS) if (total >= l.min) L = l; return L; }

// ---------- 진단 유형 (32종) ----------
// 위에서부터 처음 맞는 것. ctx: { total, areas, conf, byGame, byDiff, streak, top, low, spread }
const hi = (c, a, v) => c.areas[a] != null && c.areas[a] >= v && c.conf[a] !== "low";
const gp = (c, g, v, n = 2) => c.byGame[g] && c.byGame[g].n >= n && c.byGame[g].pct >= v;
const dOk = (c, d) => (c.byDiff[d] ? c.byDiff[d].ok / c.byDiff[d].n : 0);
export const TYPES = [
  { id: "legend",      ko: "전설의 상식왕",        say: "모든 분야를 꿰뚫는 압도적 지식. 퀴즈쇼에 나가면 상금은 당신 몫!", t: (c) => c.total >= 94 && c.spread <= 22 },
  { id: "encyclo",     ko: "걸어 다니는 백과사전", say: "무엇을 물어도 대답이 나오는 사람. 친구들의 인간 검색창이에요.", t: (c) => c.total >= 86 && c.spread <= 28 },
  { id: "champion",    ko: "퀴즈쇼 챔피언",        say: "어려운 문제일수록 강해지는 승부사. 최후의 라운드가 당신 무대예요.", t: (c) => c.total >= 80 && gp(c, "final", 75, 1) && dOk(c, 3) >= 0.7 },
  { id: "hidden",      ko: "숨은 상식 고수",       say: "쉬운 건 가끔 놓치지만 어려운 문제는 척척. 실력을 숨기고 있었군요!", t: (c) => dOk(c, 3) + dOk(c, 4) >= 1.4 && dOk(c, 1) < 0.85 },
  { id: "historian",   ko: "역사 탐험가",          say: "시간을 거슬러 여행하는 사람. 연표가 머릿속에 그려져 있어요.", t: (c) => c.top === "history" && hi(c, "history", 80) },
  { id: "scientist",   ko: "과학 덕후",            say: "세상이 돌아가는 원리를 아는 사람. 실험실 가운이 잘 어울려요.", t: (c) => c.top === "science" && hi(c, "science", 80) },
  { id: "traveler",    ko: "세계 여행 전문가",     say: "지도 없이도 세계를 누비는 사람. 여권 도장이 머릿속에 가득해요.", t: (c) => c.top === "geo" && hi(c, "geo", 80) },
  { id: "curator",     ko: "문화 큐레이터",        say: "그림·음악·문학을 두루 아는 교양인. 박물관 해설사 해도 되겠어요.", t: (c) => c.top === "culture" && hi(c, "culture", 80) },
  { id: "lifemaster",  ko: "생활상식 달인",        say: "실생활에서 진짜 쓸모 있는 지식왕. 위급할 때 제일 믿음직해요.", t: (c) => c.top === "life" && hi(c, "life", 80) },
  { id: "techie",      ko: "경제·테크 전략가",     say: "돈과 기술의 흐름을 읽는 사람. 뉴스 경제면이 술술 읽혀요.", t: (c) => c.top === "econ" && hi(c, "econ", 80) },
  { id: "factcheck",   ko: "팩트체커",             say: "그럴듯한 가짜 정보에 속지 않는 냉철한 판별사.", t: (c) => gp(c, "fake", 85) && gp(c, "ox", 75) },
  { id: "chrono",      ko: "타임라인 마스터",      say: "사건의 순서를 꿰는 시간 감각. 역사 드라마 고증 담당!", t: (c) => gp(c, "timeline", 85) },
  { id: "numbers",     ko: "숫자 박사",            say: "연도·기록·수치가 정확히 떠오르는 사람. 숫자 앞에서 흔들림이 없어요.", t: (c) => gp(c, "number", 80) },
  { id: "eagle",       ko: "매의 눈 관찰자",       say: "작은 단서만 보고도 정체를 알아채는 관찰력.", t: (c) => gp(c, "reveal", 85) },
  { id: "mythbuster",  ko: "속설 파괴자",          say: "'다들 그렇다더라'를 믿지 않는 사람. 잘못된 상식을 바로잡아요.", t: (c) => gp(c, "ox", 90, 3) },
  { id: "allrounder",  ko: "만능 지식인",          say: "어느 분야든 고르게 잘하는 균형형 지식인.", t: (c) => c.total >= 72 && c.spread <= 18 },
  { id: "collector",   ko: "지식 수집가",          say: "이것저것 많이 알고 있는 호기심 부자. 잡학 다식의 정석!", t: (c) => c.total >= 68 },
  { id: "historyfan",  ko: "역사 이야기꾼",        say: "옛날이야기를 좋아하는 사람. 역사 속 장면이 재미있게 떠올라요.", t: (c) => c.top === "history" && hi(c, "history", 65) },
  { id: "labkid",      ko: "실험실 탐구생",        say: "왜 그런지 궁금한 게 많은 과학 꿈나무.", t: (c) => c.top === "science" && hi(c, "science", 65) },
  { id: "mapfan",      ko: "지도 읽는 모험가",     say: "세계지도를 펼치면 신나는 모험가.", t: (c) => c.top === "geo" && hi(c, "geo", 65) },
  { id: "artfan",      ko: "감성 예술가",          say: "작품과 이야기에 마음이 가는 감성파.", t: (c) => c.top === "culture" && hi(c, "culture", 65) },
  { id: "homewise",    ko: "알뜰 생활 지식인",     say: "생활 속 꿀팁을 잘 챙기는 실속파.", t: (c) => c.top === "life" && hi(c, "life", 65) },
  { id: "trendy",      ko: "디지털 트렌드세터",    say: "기술과 경제 소식에 밝은 요즘 사람.", t: (c) => c.top === "econ" && hi(c, "econ", 65) },
  { id: "spiky",       ko: "한 우물 전문가",       say: "좋아하는 분야는 깊게, 나머지는 쿨하게. 전문가의 길!", t: (c) => c.spread >= 40 && c.total >= 45 },
  { id: "steady",      ko: "기본기 탄탄형",        say: "쉬운 문제는 거의 안 놓치는 탄탄한 기본기.", t: (c) => dOk(c, 1) >= 0.9 && c.total >= 50 },
  { id: "quizfan",     ko: "퀴즈 애호가",          say: "퀴즈를 즐기는 사람. 하면 할수록 오르는 타입이에요.", t: (c) => c.total >= 55 },
  { id: "balanced",    ko: "균형 잡힌 상식인",     say: "어느 한쪽으로 치우치지 않은 평균 이상의 상식.", t: (c) => c.total >= 48 && c.spread <= 22 },
  { id: "curious",     ko: "호기심 탐험가",        say: "아는 것도 있고 모르는 것도 있지만, 알아가는 재미를 아는 사람.", t: (c) => c.total >= 40 },
  { id: "intuitive",   ko: "감으로 승부하는 타입", say: "확실히 아는 것보다 감으로 맞히는 게 많은 승부사.", t: (c) => c.total >= 30 && dOk(c, 3) > dOk(c, 1) },
  { id: "growing",     ko: "상식 성장형",          say: "지금부터가 시작! 오답 복습으로 쑥쑥 오를 타입이에요.", t: (c) => c.total >= 25 },
  { id: "sprout",      ko: "상식 새싹",            say: "모든 지식은 새싹부터. 상식 도감을 하나씩 채워 봐요.", t: (c) => c.total >= 12 },
  { id: "restart",     ko: "다시 도전하는 모험가", say: "오늘은 운이 없었을 뿐. 다시 하면 분명 오를 거예요.", t: () => true },
];
export const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));

// ---------- 특별 칭호 ----------
export const TITLES = [
  { id: "combo10", ko: "🔥 10연속 정답", t: (c, rs) => c.streak >= 10 },
  { id: "combo5", ko: "⚡ 5연속 정답", t: (c, rs) => c.streak >= 5 && c.streak < 10 },
  { id: "expert", ko: "🎓 전문가 문제 정복", t: (c, rs) => rs.some((r) => r.d === 4 && r.part >= 1) },
  { id: "factchecker", ko: "📰 가짜 뉴스 판별사", t: (c, rs) => rs.filter((r) => r.game === "fake").length >= 2 && rs.filter((r) => r.game === "fake").every((r) => r.part >= 1) },
  { id: "timetravel", ko: "⏳ 시간 여행자", t: (c, rs) => rs.filter((r) => r.game === "timeline").length >= 2 && rs.filter((r) => r.game === "timeline").every((r) => r.part >= 1) },
  { id: "hawkeye", ko: "🔍 첫 단서 정답", t: (c, rs) => rs.some((r) => r.game === "reveal" && r.part >= 1) },
  { id: "calculator", ko: "🔢 인간 계산기", t: (c, rs) => rs.filter((r) => r.game === "number").length >= 2 && rs.filter((r) => r.game === "number").every((r) => r.part >= 1) },
  { id: "finalking", ko: "👑 최후의 라운드 완승", t: (c, rs) => rs.filter((r) => r.game === "final").length >= 2 && rs.filter((r) => r.game === "final").every((r) => r.part >= 1) },
  // 6차 신규 미니게임
  { id: "sorter", ko: "🏭 분류 장인", t: (c, rs) => rs.filter((r) => r.game === "sortfac").length >= 2 && rs.filter((r) => r.game === "sortfac").every((r) => r.part >= 1) },
  { id: "sherlock", ko: "🕵️ 명탐정 (첫 단서 해결)", t: (c, rs) => rs.some((r) => r.game === "detective" && r.part >= 1) },
  { id: "wiring", ko: "🔗 회로 마스터", t: (c, rs) => rs.filter((r) => r.game === "linker").length >= 2 && rs.filter((r) => r.game === "linker").every((r) => r.part >= 1) },
  { id: "traveler", ko: "✈️ 세계 여행가", t: (c, rs) => rs.some((r) => r.game === "where" && r.part >= 1) },
  { id: "perfect", ko: "💯 만점", t: (c) => c.n >= 10 && c.correct === c.n },
  { id: "sixarea", ko: "🌈 6분야 70점 이상", t: (c) => AREAS.every((a) => c.areas[a] != null && c.areas[a] >= 70) },
];

// ---------- 진단 ----------
export function diagnose(results, { mode = "quick" } = {}) {
  const sc = scoreAll(results);
  const known = AREAS.filter((a) => sc.areas[a] != null && sc.conf[a] !== "low");
  const pool = known.length ? known : AREAS.filter((a) => sc.areas[a] != null);
  const sorted = [...pool].sort((a, b) => sc.areas[b] - sc.areas[a]);
  const top = sorted[0] || null, low = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const spread = sorted.length > 1 ? sc.areas[top] - sc.areas[low] : 0;
  const ctx = { ...sc, top, low, spread };
  const type = TYPES.find((t) => t.t(ctx)) || TYPES[TYPES.length - 1];
  const level = levelOf(sc.total);
  const titles = TITLES.filter((t) => t.t(ctx, results)).map((t) => ({ id: t.id, name: t.ko }));
  const strong = sorted.filter((a) => sc.areas[a] >= 60).slice(0, 2);
  const weak = [...sorted].reverse().filter((a) => sc.areas[a] < 60 && !strong.includes(a)).slice(0, 2);
  const fewItems = AREAS.filter((a) => sc.conf[a] === "low").map((a) => a);
  return {
    ...sc, mode, top, low, spread,
    level: { lv: level.lv, name: level.ko },
    type: { id: type.id, name: type.ko, say: type.say },
    titles, strong, weak, fewItems,
    note: mode === "quick" ? "빠른 검사는 분야마다 문항이 적어서 분야 점수는 참고용이에요. 정밀 검사를 하면 더 정확해져요." : null,
  };
}

export const DISCLAIMER = "상식 레벨은 플레이듀오 자체 게임 지표예요. 공인 지능검사나 과학적으로 표준화된 능력 측정이 아니며, 이 게임 문제은행의 정답률로만 계산해요.";
