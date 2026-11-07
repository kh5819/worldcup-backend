// =========================
// 플듀 감각 진단소 — 서버·화면 공용 (js/feel/feel-core.js 와 worldcup-backend/src/feel-core.js 는 똑같아야 함: test-feel이 검사)
// 문제는 (검사, 시드, 문제 번호, 난이도 단계)로 정해짐 → 화면은 답만 기록 → 서버가 같은 순서로 다시 풀어 채점
// 적응형: 맞히면 단계↑, 틀리면 단계↓ (단계 변화도 답으로부터 다시 계산되므로 조작 불가)
// 찍기·연타·가만히 있기는 낮은 단계에 머물러 낮은 점수. 미완료 검사는 0점이 아니라 '미측정'
// 오락용 지표 — 시력·청력·색각 등 의학적 검사가 아님
// =========================
export const CORE_VERSION = 1;
export const SET_VERSION = "f1";

export function rng(seed) { let a = (seed >>> 0) || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const c01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
const ri = (r, n) => Math.floor(r() * n);
const shuffle = (r, a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = ri(r, i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const num = (v) => (Number.isFinite(+v) ? +v : NaN);
const arr = (v) => (Array.isArray(v) ? v : []);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { if (a.length < 2) return null; const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };

// ---------- 난이도 ----------
// 3단계만 (매우 쉬움·쉬움 없음). 적응형 단계(1~20)는 고른 난이도의 구간 [lo, hi] 안에서만 움직임
// tol = 오차 허용 배율(작을수록 엄격) · time = 제한 시간 배율. 점수·랭킹은 난이도별로 따로
export const DIFFS = {
  normal: { name: "보통", desc: "처음이라도 도전할 수 있지만, 금방 쉬워지진 않아요", lo: 2, hi: 11, start: 3, time: 1, tol: 1 },
  hard: { name: "어려움", desc: "아주 미세한 차이를 구분해야 해요", lo: 7, hi: 16, start: 8, time: 0.8, tol: 0.75 },
  expert: { name: "전문가", desc: "최고 난이도 · 높은 정확도와 집중력이 필요해요", lo: 11, hi: 20, start: 12, time: 0.65, tol: 0.55 },
};
export const DIFF_IDS = Object.keys(DIFFS);
export const diffName = (d) => DIFFS[d]?.name || "보통";
export const okDiff = (d) => (DIFFS[d] ? d : "normal");

// ---------- 감각 4영역 ----------
export const AREAS = ["sight", "hear", "timing", "space"];
export const AREA_NAME = { sight: "시각 감각", hear: "청각 감각", timing: "타이밍 감각", space: "공간·주의 감각" };
export const AREA_SHORT = { sight: "시각", hear: "청각", timing: "타이밍", space: "공간" };
export const AREA_COL = { sight: "#3ee6f0", hear: "#c77dff", timing: "#f4c76a", space: "#46e08a" };

// ---------- 검사 15종 (ready: 이번 단계에서 플레이 가능한 검사) ----------
// dev: 기기(화면·스피커·입력 지연) 영향이 큰 검사 → 랭킹을 기기별로 나눠 보여 줌
const T = (o) => ({ abil: { [o.area]: 1 }, ...o });
export const TESTS = {
  color: T({ name: "색 구분", en: "Color Eye", icon: "palette", area: "sight", stage: 2, ready: true, dev: true, n: 20, desc: "비슷한 색 중 다른 칸 하나 찾기", how: ["칸 하나만 색이 아주 살짝 달라요. 그 칸을 누르세요.", "맞히면 더 어려워지고, 틀리면 쉬워져요(적응형).", "빨리 찾을수록 약간의 보너스가 있어요."], ctl: "다른 칸 누르기" }),
  pitch: T({ name: "음 높이", en: "Pitch Ear", icon: "note", area: "hear", stage: 3, sound: true, n: 24, desc: "두 소리 중 더 높은 음 찾기" }),
  rhythm: T({ name: "리듬감", en: "Rhythm", icon: "drum", area: "timing", stage: 3, sound: true, dev: true, desc: "박자에 맞춰 정확하게 누르기" }),
  time: T({ name: "시간 감각", en: "Inner Clock", icon: "clock", area: "timing", stage: 2, ready: true, n: 6, desc: "시계 없이 정해진 시간 맞히기", how: ["‘시작’을 누르고, 목표 시간이 지났다고 느낄 때 ‘멈춤’을 누르세요.", "화면에는 시간이 보이지 않아요. 몸속 시계만 믿으세요.", "6번 해요. 오차가 작고 일정할수록 높은 점수예요."], ctl: "버튼 · 스페이스" }),
  eye: T({ name: "눈대중", en: "Eyeball", icon: "ruler", area: "sight", stage: 2, ready: true, n: 12, desc: "자 없이 길이·각도·중심점 맞히기", how: ["선의 정중앙, 원의 중심, 같은 길이, 같은 각도, 정사각형의 남은 꼭짓점을 맞혀요.", "알맞다고 생각하는 곳을 한 번 누르세요.", "정답과의 거리(각도)가 가까울수록 높은 점수예요."], ctl: "화면 누르기" }),
  count: T({ name: "개수 세기", en: "Quick Count", icon: "dots", area: "space", stage: 2, ready: true, n: 14, desc: "잠깐 보인 점은 몇 개였을까", how: ["점들이 아주 잠깐 나타났다 사라져요.", "몇 개였는지 숫자를 입력하고 확인을 누르세요.", "정확히 맞히면 점이 많아지고 더 짧게 보여요(적응형)."], ctl: "숫자 버튼·키보드 → 확인(Enter)" }),
  direction: T({ name: "소리 방향", en: "Sound Side", icon: "headphones", area: "hear", stage: 3, sound: true, phones: true, dev: true, desc: "왼쪽·오른쪽 중 소리가 난 쪽 찾기" }),
  loud: T({ name: "음량 구분", en: "Loudness", icon: "volume", area: "hear", stage: 3, sound: true, dev: true, desc: "두 소리 중 더 큰 소리 찾기" }),
  react: T({ name: "반응속도", en: "Reaction", icon: "bolt", area: "timing", stage: 4, dev: true, desc: "신호가 뜨는 순간 바로 누르기" }),
  track: T({ name: "움직임 추적", en: "Tracking", icon: "target", area: "space", stage: 4, desc: "섞이는 물체 중 목표 따라가기" }),
  bright: T({ name: "밝기 구분", en: "Brightness", icon: "sun", area: "sight", stage: 4, dev: true, desc: "미세하게 밝은 칸 찾기" }),
  spatial: T({ name: "공간 기억", en: "Spatial Memory", icon: "grid", area: "space", stage: 4, desc: "켜진 위치와 순서 기억하기" }),
  speed: T({ name: "속도 감각", en: "Speed Sense", icon: "wind", area: "timing", stage: 5, desc: "더 빠른 물체 고르기" }),
  pattern: T({ name: "패턴 감지", en: "Pattern", icon: "shapes", area: "space", stage: 5, desc: "도형 배열의 규칙 찾기" }),
  balance: T({ name: "균형 감각", en: "Level", icon: "level", area: "sight", stage: 5, desc: "기울어진 선을 수평으로" }),
};
export const TEST_IDS = Object.keys(TESTS);
export const READY = TEST_IDS.filter((t) => TESTS[t].ready);
export const MODES = { full: { name: "전체 검사" }, single: { name: "개별 검사" } };
export const modeName = (m) => MODES[m]?.name || (m === "practice" ? "연습" : m);

// ---------- 종합 등급 SSS~D (1000점 기준) — SSS는 검사 평균 95점 이상일 때만 ----------
export const TIERS = [
  { id: "SSS", min: 950, name: "SSS", col: "#ffdf7a", emb: "challenger" },
  { id: "SS", min: 880, name: "SS", col: "#ff6078", emb: "grandmaster" },
  { id: "S", min: 790, name: "S", col: "#c77dff", emb: "master" },
  { id: "A", min: 660, name: "A", col: "#7ab8ff", emb: "diamond" },
  { id: "B", min: 520, name: "B", col: "#46e08a", emb: "emerald" },
  { id: "C", min: 360, name: "C", col: "#f4c76a", emb: "gold" },
  { id: "D", min: 0, name: "D", col: "#8a8f9e", emb: "silver" },
];
export const tierOf = (t) => TIERS.find((x) => t >= x.min) || TIERS[TIERS.length - 1];

// =========================================================
// 1) 적응형 단계
// =========================================================
export const LMAX = 20;
/** 지금까지 맞고 틀린 기록(ok 배열)으로 다음 단계 계산. rule: up=연속 몇 번 맞혀야 오르는지, down=틀리면 내려가는 칸 */
export function stepLevel(L, run, o, rule, diff) {
  const D = DIFFS[okDiff(diff)];
  if (o === true) { run++; if (run >= (rule.up || 1)) { L = Math.min(D.hi, L + 1); run = 0; } }
  else if (o === false) { run = 0; L = Math.max(D.lo, L - (rule.down || 2)); }   // "stay" → 그대로
  return [L, run];
}
/** 단계 점수: 뒤쪽 2/3 시행에서 맞힌 단계 평균 (처음 출발 단계 영향은 줄이고, 틀린 단계는 반만) */
// 난이도 구간 안에서의 위치(0~1)로 바꿈 → 난이도별 점수. 구간 맨 아래에서 틀리기만 하면 0
function levelScore(lv, oks, diff) {
  const D = DIFFS[okDiff(diff)], span = D.hi - D.lo + 1, pos = (L) => (L - D.lo + 1) / span, from = Math.floor(oks.length / 3); let s = 0, n = 0;
  for (let i = from; i < oks.length; i++) { s += oks[i] === true ? pos(lv[i]) : oks[i] === "stay" ? pos(lv[i]) * 0.8 : Math.max(0, pos(lv[i]) - 2 / span) * 0.5; n++; }
  return n ? c01(s / n) : 0;
}

// =========================================================
// 2) 검사별 문제 (검사, 시드, 번호, 단계, 난이도)
// =========================================================
const R = (tid, seed, i) => rng(hashSeed(`${tid}:${seed >>> 0}:${i}`));
// 색 구분: OKLab(사람 눈 기준 색 공간)에서 색 차이 ΔE를 정함 → RGB 차이가 아니라 '보이는 차이'가 단계마다 일정하게 줄어듦
// ΔE 0.09 → 약 0.006(아주 미세) · 칸 5×5 → 8×8
export const colorDelta = (L) => 0.09 * 0.865 ** (L - 1);
// 보통도 5×5부터 (보통 5~7칸 · 어려움 6~8칸 · 전문가 7~8칸)
export const colorGrid = (L) => clamp(5 + Math.floor((L - 2) / 4), 5, 8);
const lin2s = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
export function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return rgb.map((x) => Math.round(clamp(lin2s(x), 0, 1) * 255));
}
const inGamut = (L, a, b) => { const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3; return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].every((x) => x >= 0.002 && x <= 0.998); };
export const colorLimit = (diff) => Math.round(7000 * DIFFS[okDiff(diff)].time);
// 개수 세기: 단계마다 점이 늘고 보이는 시간이 줄어듦
export const countN = (L) => 4 + L + Math.floor(L * L / 20);
export const countShow = (L, diff = "normal") => Math.round(clamp(2000 * 0.93 ** (L - 1) * (diff === "expert" ? 0.8 : 1), 500, 2000));   // 0.5~2초 (전문가는 더 짧게)
export const COUNT_LIMIT = 12000;
export const COUNT_NEAR = { normal: 0.3, hard: 0.22, expert: 0.15 };   // 근사 점수: 상대 오차가 이만큼이면 0
// 시간 감각: 난이도별 목표 시간(초) · 방해 요소
// 난이도별 목표 시간: 보통 5초 · 어려움 10초 · 전문가 15초 (6번 모두 같은 목표 → 일관성까지 봄). 길수록 오차가 커지는 게 정상이라 허용 오차는 같은 비율
export const TIME_TARGET = { normal: 5, hard: 10, expert: 15 };
export const timeLimitOf = (Tms) => Tms * 2.5 + 3000;
// 눈대중
export const EYE_KINDS = ["len", "size", "center", "angle", "box", "mid"];
export const EYE_LIMIT = 10000, EYE_TOL = 0.13, ANG_TOL = 15;
export const eyeHide = (diff) => (diff === "expert" ? 1800 : 0);   // 전문가: 잠깐 보고 기억해서 누르기
export const eyeTol = (diff) => EYE_TOL * DIFFS[okDiff(diff)].tol, angTol = (diff) => ANG_TOL * DIFFS[okDiff(diff)].tol;
export const timeTol = (diff) => ({ normal: 0.22, hard: 0.16, expert: 0.11 })[okDiff(diff)];   // 상대 오차가 이만큼이면 0점

// 같은 (검사, 시드, 번호, 단계, 난이도) = 같은 문제 → 다시 풀기(replay) 때 매번 새로 만들지 않게 기억 (결과는 똑같음)
const ITEM_CACHE = new Map();
export function item(tid, seed, i, L, diff = "normal") {
  const key = `${tid}|${seed >>> 0}|${i}|${L}|${okDiff(diff)}`, hit = ITEM_CACHE.get(key); if (hit) return hit;
  const v = makeItem(tid, seed, i, L, diff); if (ITEM_CACHE.size > 4000) ITEM_CACHE.clear(); ITEM_CACHE.set(key, v); return v;
}
function makeItem(tid, seed, i, L, diff) {
  const r = R(tid, seed, i); diff = okDiff(diff);
  switch (tid) {
    case "color": {
      const n = colorGrid(L), dE = colorDelta(L); let base, odd, fam;
      for (let k = 0; k < 60; k++) {   // 색 계열(색상각) 무작위 + 방향(밝기·색상·채도 섞임) 무작위, 둘 다 표시 가능한 색일 때만
        const h = r() * Math.PI * 2, C0 = 0.04 + r() * 0.1, L0 = 0.5 + r() * 0.3, th = r() * Math.PI * 2, ph = (r() - 0.5) * 1.6;
        base = [L0, C0 * Math.cos(h), C0 * Math.sin(h)]; odd = [L0 + dE * Math.sin(ph), base[1] + dE * Math.cos(ph) * Math.cos(th), base[2] + dE * Math.cos(ph) * Math.sin(th)]; fam = Math.round((h * 180) / Math.PI);
        if (inGamut(...base) && inGamut(...odd)) break;
      }
      return { L, n, odd: ri(r, n * n), base: oklabToRgb(...base), oddc: oklabToRgb(...odd), dE: Math.round(dE * 10000) / 10000, hue: fam, limit: colorLimit(diff) };
    }
    case "count": {
      const n = countN(L), dots = []; let guard = 0;
      const sizeVar = diff === "normal" ? 0.012 : 0.026, k = clamp(Math.sqrt(16 / n), 0.55, 1);   // 점이 많을수록 작게 (겹침 없이 다 들어가게)
      while (dots.length < n && guard++ < 4000) { const rad = (0.02 + r() * sizeVar) * k, x = 0.06 + r() * 0.88, y = 0.06 + r() * 0.88; if (dots.every((d) => Math.hypot(d[0] - x, d[1] - y) > d[2] + rad + 0.015)) dots.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(rad * 1000) / 1000]); }
      return { L, n: dots.length, dots, show: countShow(L, diff), limit: COUNT_LIMIT, mix: diff !== "normal" && r() < 0.5 };
    }
    case "time": { const T = TIME_TARGET[diff] * 1000; return { T, limit: timeLimitOf(T), noise: diff === "normal" ? 0 : diff === "hard" ? 1 : 2, nseed: ri(r, 1e9) }; }
    case "eye": return eyeItem(r, eyeOrder(seed)[i], diff);
  }
  throw new Error("UNKNOWN_TEST");
}
export const eyeOrder = (seed) => shuffle(rng(hashSeed(`eye-order:${seed >>> 0}`)), [...EYE_KINDS, ...EYE_KINDS]);
function eyeItem(r, k, diff) {
  const P = () => 0.12 + r() * 0.76, base = { k, limit: Math.round(EYE_LIMIT * DIFFS[diff].time), tol: eyeTol(diff), atol: angTol(diff), hide: eyeHide(diff), thin: diff !== "normal" };
  if (k === "mid") { for (;;) { const a = [P(), P()], b = [P(), P()], L = Math.hypot(a[0] - b[0], a[1] - b[1]); if (L > 0.45) return { ...base, a, b, ans: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], scale: L }; } }
  if (k === "center") { const rad = 0.14 + r() * 0.2, c = [rad + 0.06 + r() * (0.88 - 2 * rad), rad + 0.06 + r() * (0.88 - 2 * rad)], gap = diff === "normal" ? 0 : 0.25 + r() * 0.35; return { ...base, c, rad, gap, rot: r() * 6.283, ans: c, scale: rad * 2 }; }
  if (k === "len") { for (;;) { const L = 0.2 + r() * 0.24, a1 = r() * Math.PI * 2, a2 = r() * Math.PI * 2, A = [P(), P()], B = [A[0] + Math.cos(a1) * L, A[1] + Math.sin(a1) * L], S = [0.1 + r() * 0.8, 0.1 + r() * 0.8], E = [S[0] + Math.cos(a2) * L, S[1] + Math.sin(a2) * L];
    const inb = (p) => p[0] > 0.05 && p[0] < 0.95 && p[1] > 0.05 && p[1] < 0.95, far = Math.hypot((A[0] + B[0]) / 2 - (S[0] + E[0]) / 2, (A[1] + B[1]) / 2 - (S[1] + E[1]) / 2) > 0.32, angOk = Math.abs(Math.cos(a1 - a2)) < 0.85;
    if (inb(B) && inb(E) && far && angOk) return { ...base, a: A, b: B, s: S, dir: [Math.cos(a2), Math.sin(a2)], ans: E, scale: L }; } }
  if (k === "size") {   // 왼쪽 원과 같은 크기가 되도록 오른쪽 원의 테두리 위치를 누름 (반지름만 봄)
    const rad = 0.08 + r() * 0.12, A = [0.25, 0.3 + r() * 0.4], B = [0.72, 0.3 + r() * 0.4], ang = r() * Math.PI * 2;
    return { ...base, A, B, rad, ans: [B[0] + Math.cos(ang) * rad, B[1] + Math.sin(ang) * rad], scale: rad }; }
  if (k === "box") {   // 직사각형 틀의 정중앙에 물체 놓기
    const w = 0.35 + r() * 0.5, h = 0.3 + r() * 0.5, x = 0.05 + r() * (0.9 - w), y = 0.05 + r() * (0.9 - h), rot = diff === "normal" ? 0 : (r() - 0.5) * 0.9;
    return { ...base, x, y, w, h, rot, ans: [x + w / 2, y + h / 2], scale: Math.min(w, h) * 0.6 }; }
  if (k === "angle") {   // 왼쪽 각과 같은 각이 되도록 오른쪽 각의 두 번째 변 끝을 누름 (방향만 봄)
    for (;;) { const ang = (25 + r() * 110) * Math.PI / 180, r1 = r() * Math.PI * 2, r2 = r() * Math.PI * 2, A = [0.27, 0.5], B = [0.73, 0.5], len = 0.18;
      const sgn = r() < 0.5 ? 1 : -1, tgt = r2 + sgn * ang, ans = [B[0] + Math.cos(tgt) * len, B[1] + Math.sin(tgt) * len];
      if (ans[0] > 0.52 && ans[0] < 0.97 && ans[1] > 0.05 && ans[1] < 0.95 && Math.cos(r2) > -0.3) return { ...base, A, B, r1, ang, r2, sgn, len, ans, scale: len }; }
  }
  for (;;) { const side = 0.3 + r() * 0.25, rot = r() * Math.PI * 2, o = [0.2 + r() * 0.6, 0.2 + r() * 0.6], u = [Math.cos(rot) * side, Math.sin(rot) * side], v = [-u[1], u[0]];
    const pts = [o, [o[0] + u[0], o[1] + u[1]], [o[0] + u[0] + v[0], o[1] + u[1] + v[1]], [o[0] + v[0], o[1] + v[1]]];
    if (pts.every((p) => p[0] > 0.06 && p[0] < 0.94 && p[1] > 0.06 && p[1] < 0.94)) { const miss = ri(r, 4); return { ...base, k: "corner", pts: pts.filter((_, j) => j !== miss), ans: pts[miss], scale: side }; } }
}
export function colorOf(it, odd) { const c = odd ? it.oddc : it.base; return `rgb(${c[0]},${c[1]},${c[2]})`; }
/** 눈대중 오차(0~): 각도 문제는 각도 차이/허용치, 나머지는 거리/크기/허용치 */
export function eyeErr(it, x, y) {
  if (it.k === "size") { const rr = Math.hypot(x - it.B[0], y - it.B[1]); return Math.abs(rr - it.rad) / it.rad / it.tol; }
  if (it.k === "angle") { const a = Math.atan2(y - it.B[1], x - it.B[0]), got = Math.atan2(Math.sin(a - it.r2), Math.cos(a - it.r2)) * it.sgn, d = Math.abs(got - it.ang) * 180 / Math.PI; return Math.hypot(x - it.B[0], y - it.B[1]) < 0.03 ? 9 : d / it.atol; }
  return Math.hypot(x - it.ans[0], y - it.ans[1]) / it.scale / it.tol;
}
export const eyePoint = (e) => c01(1 - e);
export const timePoint = (d, T, diff = "normal") => { const e = Math.abs(d - T) / T, tol = timeTol(diff); return e <= tol * 0.08 ? 1 : c01(1 - (e - tol * 0.08) / (tol * 0.92)); };

// ---------- 검사별 진행 규칙 ----------
// adaptive: 답이 정해진 검사. judge(it, v) → true/false/"stay"
const RULES = {
  color: { adaptive: true, up: 1, down: 2, n: 20, judge: (it, v) => num(v[1]) === it.odd },
  count: { adaptive: true, up: 1, down: 2, n: 14, judge: (it, v) => { const a = Math.round(num(v[1])); return a === it.n ? true : Math.abs(a - it.n) <= Math.max(1, it.n * 0.1) ? "stay" : false; } },
  time: { adaptive: false, n: 6 },
  eye: { adaptive: false, n: 12 },
};
export const nTrials = (tid) => RULES[tid]?.n || TESTS[tid]?.n || 10;
export const isAdaptive = (tid) => !!RULES[tid]?.adaptive;
/** 화면용: 지금까지 답(log.a)으로 다음 문제 */
export function nextItem(tid, seed, diff, answers) {
  const i = answers.length; if (i >= nTrials(tid)) return null;
  const L = isAdaptive(tid) ? replay(tid, seed, diff, answers).lv[i] : DIFFS[okDiff(diff)].start;
  return { i, L, ...item(tid, seed, i, L, diff) };
}
/** 답을 처음부터 다시 풀어 맞음/틀림(oks)과 각 문제의 단계(lv) 계산 — 화면·서버 같은 함수 */
export function replay(tid, seed, diff, answers) {
  const rule = RULES[tid], oks = [], lv = []; let L = DIFFS[okDiff(diff)].start, run = 0;
  for (let i = 0; i <= answers.length; i++) {
    lv.push(L); if (i === answers.length) break;
    const it = item(tid, seed, i, L, diff), v = answers[i];
    const o = v && num(v[v.length - 1]) <= it.limit + 400 ? rule.judge(it, v) : false; oks.push(o);
    [L, run] = stepLevel(L, run, o, rule, diff);
  }
  return { oks, lv };
}
/** 답 기록 정리: log.a = [[번호, ...값, ms]] 번호 순서대로 하나씩만 */
function answersOf(log, n, len) { const out = []; for (const v of arr(log?.a)) { if (!Array.isArray(v) || v.length < len || num(v[0]) !== out.length) continue; out.push(v); if (out.length >= n) break; } return out; }

// =========================================================
// 3) 채점 (검사 유형마다 다른 공식)
// =========================================================
const SCORE = {
  // 단계(난이도) 70% + 정답률 15% + 찾는 속도 15%
  color(s, log) {
    const ans = answersOf(log, nTrials("color"), 3), { oks, lv } = replay("color", s.seed, s.diff, ans);
    const okRt = ans.filter((v, i) => oks[i] === true).map((v) => num(v[2])), lim = colorLimit(s.diff), flags = [];
    if (ans.filter((v) => num(v[2]) < 150).length >= 4) flags.push("TOO_FAST");
    const lvS = levelScore(lv, oks, s.diff), acc = ans.length ? oks.filter((o) => o === true).length / nTrials("color") : 0, spd = okRt.length ? c01(1 - avg(okRt) / lim) * acc : 0;
    const best = Math.max(0, ...lv.filter((_, i) => oks[i] === true));
    return { score: (lvS * 0.7 + acc * 0.15 + spd * 0.15) * 100, m: { right: oks.filter((o) => o === true).length, n: nTrials("color"), done: ans.length, best, minDelta: best ? Math.round(colorDelta(best) * 1000) / 10 : null, rt: okRt.length ? Math.round(avg(okRt)) : null }, flags };
  },
  // 정확히 맞힌 단계 75% + 근사 정확도 25%
  count(s, log) {
    const ans = answersOf(log, nTrials("count"), 3), { oks, lv } = replay("count", s.seed, s.diff, ans);
    let near = 0; ans.forEach((v, i) => { const it = item("count", s.seed, i, lv[i], s.diff), a = Math.round(num(v[1])); near += Number.isFinite(a) ? c01(1 - Math.abs(a - it.n) / it.n / COUNT_NEAR[s.diff]) : 0; });
    const best = Math.max(0, ...lv.filter((_, i) => oks[i] === true)), rts = ans.map((v) => num(v[2])).filter(Number.isFinite);
    return { score: (levelScore(lv, oks, s.diff) * 0.75 + (near / nTrials("count")) * 0.25) * 100, m: { exact: oks.filter((o) => o === true).length, n: nTrials("count"), best, bestN: best ? countN(best) : null, rt: rts.length ? Math.round(avg(rts)) : null }, flags: [] };
  },
  // 오차 80% + 일관성(오차 들쭉날쭉 정도) 20%
  time(s, log) {
    const ans = answersOf(log, nTrials("time"), 3), got = [], errs = [], flags = []; let sum = 0, prev = -1;
    for (let i = 0; i < nTrials("time"); i++) { const v = ans[i], it = item("time", s.seed, i, 1, s.diff); if (!v) { got.push(null); continue; } const st = num(v[1]), en = num(v[2]); if (!(st >= 0) || !(en > st) || st < prev) { flags.push("BAD_LOG"); got.push(null); continue; } prev = en; const d = Math.min(en - st, it.limit); got.push(Math.round(d)); sum += timePoint(d, it.T, s.diff); errs.push((d - it.T) / it.T); }
    const acc = sum / nTrials("time"), cons = errs.length >= 3 ? c01(1 - sd(errs) / timeTol(s.diff)) * acc : 0;   // 일관성은 정확할 때만 (늘 똑같이 틀리는 건 보너스 없음)
    return { score: (acc * 0.8 + cons * 0.2) * 100, m: { got, targets: Array.from({ length: nTrials("time") }, (_, i) => item("time", s.seed, i, 1, s.diff).T), err: errs.length ? Math.round(avg(errs.map(Math.abs)) * 1000) / 10 : null, bias: errs.length ? Math.round(avg(errs) * 1000) / 10 : null }, flags: [...new Set(flags)] };
  },
  // 오차 85% + 일관성 15%
  eye(s, log) {
    const ans = answersOf(log, nTrials("eye"), 4), es = []; let sum = 0; const byKind = {};
    ans.forEach((v, i) => { const it = item("eye", s.seed, i, 1, s.diff), x = num(v[1]) / 1000, y = num(v[2]) / 1000, t = num(v[3]); if (!Number.isFinite(x) || !Number.isFinite(y) || !(t <= it.limit + 400)) return; const e = eyeErr(it, x, y); es.push(Math.min(e, 3)); sum += eyePoint(e); (byKind[it.k] ||= []).push(eyePoint(e)); });
    const acc = sum / nTrials("eye"), cons = es.length >= 4 ? c01(1 - sd(es) / 0.8) * acc : 0;
    return { score: (acc * 0.85 + cons * 0.15) * 100, m: { n: nTrials("eye"), done: es.length, perfect: es.filter((e) => e < 0.2).length, kinds: Object.fromEntries(Object.entries(byKind).map(([k, a]) => [k, Math.round(avg(a) * 100)])) }, flags: [] };
  },
};
export function genSpec(tid, seed, diff = "normal") { if (!TESTS[tid]?.ready) throw new Error("UNKNOWN_TEST"); return { tid, seed: seed >>> 0, diff: okDiff(diff), n: nTrials(tid) }; }
export function scoreTest(tid, spec, log) {
  const f = SCORE[tid]; if (!f) throw new Error("UNKNOWN_TEST");
  let r; try { r = f(spec, log || {}); } catch { r = { score: 0, m: {}, flags: ["BAD_LOG"] }; }
  let score = Math.round(clamp(Number.isFinite(r.score) ? r.score : 0, 0, 100));
  if (r.flags.length) score = Math.min(score, 40);
  return { id: tid, score, m: r.m, flags: r.flags };
}
/** 기록 안 반응 시간 합(ms) — 서버가 잰 검사 시간보다 길면 조작 */
export function logSpan(tid, log) {
  const a = arr(log?.a); let s = 0;
  for (const v of a) { if (!Array.isArray(v)) continue; if (tid === "time") { const x = num(v[2]); if (x > s) s = x; } else { const x = num(v[v.length - 1]); if (x > 0) s += x; } }
  return s;
}

// =========================================================
// 4) 종합: 측정한 검사만 → 1000점 → 등급 → 유형
// =========================================================
export const CAL = [[0, 0], [25, 230], [40, 380], [55, 520], [68, 650], [80, 780], [91, 900], [100, 1000]];
const curve = (x, pts) => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); } return pts[pts.length - 1][1]; };
const measured = (scores) => Object.entries(scores || {}).filter(([t, s]) => TESTS[t] && Number.isFinite(s));
export function areaScores(scores) { const out = {}; for (const a of AREAS) { const v = measured(scores).filter(([t]) => TESTS[t].area === a).map((x) => x[1]); out[a] = v.length ? Math.round(avg(v)) : null; } return out; }
export function totalOf(scores) { const v = measured(scores).map((x) => x[1]); return v.length ? Math.round(curve(avg(v), CAL)) : 0; }
export const STYLES = [
  { id: "ultra", name: "초감각 탐지자", desc: "측정한 모든 감각이 최상위예요. 작은 변화도 가장 먼저 알아채요.", col: "#ffdf7a" },
  { id: "allround", name: "만능 감각러", desc: "어느 감각 하나 빠지지 않고 고르게 좋아요.", col: "#5ee0c8" },
  { id: "colorist", name: "색채 탐험가", desc: "색과 밝기의 아주 작은 차이를 구분해요.", tests: ["color", "bright"], col: "#3ee6f0" },
  { id: "observer", name: "정밀 관찰자", desc: "자 없이도 길이·각도·중심을 정확히 잡아요.", tests: ["eye"], col: "#7ab8ff" },
  { id: "balancer", name: "균형의 달인", desc: "기울어짐을 한눈에 알아채는 수평 감각의 소유자.", tests: ["balance"], col: "#9be15d" },
  { id: "hunter", name: "소리 사냥꾼", desc: "음 높이·크기·방향의 작은 차이까지 귀로 잡아내요.", tests: ["pitch", "direction", "loud"], col: "#c77dff" },
  { id: "rhythm", name: "리듬 마스터", desc: "박자가 몸에 새겨져 있어요. 소리가 끊겨도 흔들리지 않아요.", tests: ["rhythm"], col: "#ff5fd2" },
  { id: "timewiz", name: "시간의 마술사", desc: "시계 없이도 시간이 정확해요. 몸속에 스톱워치가 있어요.", tests: ["time"], col: "#f4c76a" },
  { id: "snap", name: "순간 포착자", desc: "찰나의 신호와 속도 차이를 놓치지 않아요.", tests: ["react", "speed", "count"], col: "#ff9a4a" },
  { id: "space", name: "공간 지배자", desc: "위치·순서·움직임을 머릿속 지도로 정리해요.", tests: ["spatial", "track", "pattern"], col: "#46e08a" },
  { id: "charging", name: "감각 충전 중", desc: "오늘은 감각이 쉬는 날. 컨디션 좋을 때 다시 재 보면 깜짝 놀랄지도?", col: "#8a93c4" },
  { id: "scouting", name: "감각 탐색 중", desc: "아직 측정한 검사가 적어요. 검사를 더 하면 진짜 유형이 나와요.", col: "#8a96c8" },
];
const styleBy = (id) => STYLES.find((s) => s.id === id);
export function styleOf(scores) {
  const m = measured(scores).sort((a, b) => b[1] - a[1]);
  if (m.length < 3) return styleBy("scouting");
  const vals = m.map((x) => x[1]), mean = avg(vals), spread = vals[0] - vals[vals.length - 1];
  if (mean >= 85 && vals[vals.length - 1] >= 70) return styleBy("ultra");
  if (mean < 30) return styleBy("charging");
  if (spread <= 15 && mean >= 55) return styleBy("allround");
  return STYLES.find((s) => s.tests?.includes(m[0][0])) || styleBy("allround");
}
const COMMENT = {
  sight: ["색과 모양의 작은 차이를 정확히 봤어요.", "보는 감각은 무난해요. 아주 작은 차이에서 조금 흔들렸어요.", "화면 밝기를 올리고 천천히 비교해 보세요."],
  hear: ["아주 작은 소리 차이까지 구분했어요.", "큰 차이는 잘 듣는데 미세한 차이에서 흔들렸어요.", "조용한 곳에서 이어폰으로 다시 해 보세요."],
  timing: ["시간과 타이밍이 몸에 새겨져 있어요.", "타이밍은 괜찮은데 길어질수록 조금 어긋났어요.", "속으로 박자를 세며 몸으로 리듬을 타 보세요."],
  space: ["한 번 본 것을 정확히 기억하고 셌어요.", "적당한 양까지는 정확하지만 많아지면 흔들렸어요.", "덩어리로 묶어 보는 연습을 해 보세요."],
};
export const QUIPS = {
  sleep: ["감각이 잠깐 로그아웃했어요. 물 한 잔 마시고 다시!", "오늘은 감각 절전 모드. 내일의 감각을 믿어요."],
  dull: ["감은 있어요! 조금만 더 집중하면 한 단계 위로.", "무던한 감각은 스트레스에 강하다는 뜻일지도?"],
  normal: ["딱 평균의 감각. 어디 가서 안 밀려요.", "보통이 제일 어렵다죠. 균형 잡힌 감각이에요."],
  keen: ["또렷한 감각! 남들이 놓치는 걸 가끔 잡아내요.", "감각이 깨어 있어요. 컨디션 좋은 날이네요."],
  sharp: ["예리하다! 친구들 사이에서 '눈 좋다' 소리 듣는 타입.", "작은 차이를 잡아내는 감각이 있어요."],
  super: ["초감각 레벨. 틀린 그림 찾기 대회 나가도 돼요.", "이 감각이면 어디서든 눈치 백단."],
  sixth: ["육감 각성! 이 진단서는 액자에 걸어야 해요.", "보고, 듣고, 느끼는 모든 감각이 최상위예요."],
};
export const DISCLAIMER = "감각 점수는 플레이듀오 미니게임 안의 반응으로 계산한 오락용 게임 점수예요. 화면·조명·스피커·이어폰·기기에 따라 달라지며, 시력·청력·색각 등을 의학적으로 측정하거나 진단하지 않아요.";
export function diagnose({ scores, prev = null, rank = null, of = null }) {
  const m = measured(scores), areas = areaScores(scores), total = totalOf(scores), tier = tierOf(total), style = styleOf(scores);
  const valid = AREAS.filter((a) => areas[a] != null).sort((a, b) => areas[b] - areas[a]);
  const best = valid[0] || null, worst = valid.length > 1 ? valid[valid.length - 1] : null;
  const band = (v) => (v >= 70 ? 0 : v >= 45 ? 1 : 2);
  const opinion = [best, worst].filter((a, i, l) => a && l.indexOf(a) === i).map((a) => COMMENT[a][band(areas[a])]);
  const tests = [...m].sort((a, b) => b[1] - a[1]);
  const qs = QUIPS[tier.id] || QUIPS.sleep, quip = qs[(total + m.reduce((a, b) => a + (b[1] | 0), 0)) % qs.length];
  return { total, areas, quip, done: m.length, of15: TEST_IDS.length, tier: { id: tier.id, name: tier.name, col: tier.col }, style: { id: style.id, name: style.name, desc: style.desc, col: style.col }, best, worst, opinion, bestTest: tests[0]?.[0] || null, worstTest: tests.length > 1 ? tests[tests.length - 1][0] : null, prevDelta: prev ? total - prev.total : null, rank, of };
}
