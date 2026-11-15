// =========================
// 플듀 증강 야추 — 규칙 엔진 (방·소켓과 무관한 순수 계산)
// · 점수 칸 12개 (에이스~식스, 초이스, 포카드, 풀하우스, 스몰/라지 스트레이트, 야추)
// · 상단(에이스~식스) 합 63 이상 → +35
// · 증강 37종 (일반 10 · 희귀 11 · 영웅 9 · 전설 7). 일반 모드에선 증강이 하나도 없으므로 이 파일의 증강 분기는 전부 건너뜀
//
// 증강 점수 적용 순서 (겹칠 때 항상 이 순서):
//   1) 칸 인정 규칙 완화 (야추 사냥꾼·완벽한 풀하우스·느슨한 스트레이트·잭팟)
//   2) 기본 점수
//   3) 고정 점수 더하기 (찬스 강화 등) — 기본 점수가 0이면 더하지 않음 (초이스·찬스 강화 제외)
//   4) 퍼센트 증가 — 여러 개면 퍼센트끼리 더한 뒤 한 번에 곱함 (예: +20% & +30% → ×1.5)
//   5) 배율 토글 (점수 증폭 ×1.5, 점수 폭발 ×2) — 이 둘은 서로 곱함
//   6) 세금(상대가 건 -5)
//   7) 점수 보험 (최종 0점이면 8점)
//   소수점은 매 단계 끝에 버림
// =========================

export const CATS = ["ones", "twos", "threes", "fours", "fives", "sixes", "choice", "fourKind", "fullHouse", "smallStraight", "largeStraight", "yacht"];
export const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"];
export const CAT_LABEL = { ones: "에이스", twos: "듀스", threes: "트레이", fours: "포", fives: "파이브", sixes: "식스", choice: "초이스", fourKind: "포카드", fullHouse: "풀하우스", smallStraight: "스몰 스트레이트", largeStraight: "라지 스트레이트", yacht: "야추" };
export const UPPER_BONUS_AT = 63, UPPER_BONUS = 35;
export const BASE_ROLLS = 3;

// ---------------- 증강 정의 ----------------
// kind: passive(자동) | active(버튼, charges회) | toggle(이번 기록에 켜기, charges회) | perTurn(매 턴 1번)
// target: 능동 증강이 고르는 대상 (die=주사위 1개, die2=주사위 2개(복사 원본→대상), value=눈 고르기, delta=±1)
export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
export const AUGMENTS = [
  // ---- 일반 (기대 효과 +8~13점 / 견제 카드는 상대 -4~8점) ----
  { id: "spareRoll", rarity: "common", icon: "🎲", name: "여유 굴림", kind: "active", charges: 2, desc: "원하는 턴에 굴림 +1. (2회)", cond: "내 차례 아무 때나" },
  { id: "insurance", rarity: "common", icon: "☂️", name: "점수 보험", kind: "passive", desc: "0점을 기록하게 되면 대신 5점. (최대 3번)" },
  { id: "choiceBoost", rarity: "common", icon: "🍀", name: "초이스 강화", kind: "passive", desc: "초이스 점수 +10." },
  { id: "upperBoost", rarity: "common", icon: "⬆️", name: "상단 강화", kind: "passive", desc: "에이스~식스 점수 +15%." },
  { id: "luckySix", rarity: "common", icon: "6️⃣", name: "행운의 6", kind: "passive", desc: "기록할 때 6이 3개 이상이면 +4. (0점 칸 제외)" },
  { id: "smallFan", rarity: "common", icon: "🐣", name: "작은 수 사랑", kind: "passive", desc: "에이스·듀스·트레이 점수 +50%." },
  { id: "straightBonus", rarity: "common", icon: "📏", name: "직선 애호가", kind: "passive", desc: "스몰·라지 스트레이트 성공 시 +8." },
  { id: "fullHouseFlat", rarity: "common", icon: "🏠", name: "집들이", kind: "passive", desc: "풀하우스 성공 시 +10." },
  { id: "firstRollLuck", rarity: "common", icon: "⚡", name: "첫 굴림의 행운", kind: "passive", desc: "한 번만 굴리고 바로 기록하면 +5. (0점 칸 제외, 최대 3번)" },
  { id: "evenOdd", rarity: "common", icon: "☯️", name: "짝홀 맞추기", kind: "passive", desc: "기록하는 주사위가 전부 짝수거나 전부 홀수면 +4. (0점 칸 제외, 최대 3번)" },
  // ---- 희귀 (+11~19점) ----
  { id: "flip", rarity: "rare", icon: "🔃", name: "뒤집기", kind: "active", charges: 3, target: "die", desc: "주사위 1개를 반대 면으로 (1↔6, 2↔5, 3↔4). (3회)", cond: "한 번 이상 굴린 뒤" },
  { id: "nudge", rarity: "rare", icon: "🎚️", name: "숫자 조작", kind: "active", charges: 3, target: "delta", desc: "주사위 1개 눈을 +1 또는 -1. (3회)", cond: "한 번 이상 굴린 뒤" },
  { id: "bonusEase", rarity: "rare", icon: "🎯", name: "보너스 완화", kind: "passive", desc: "상단 보너스 기준 63 → 50점." },
  { id: "jam", rarity: "common", icon: "🧊", name: "방해 굴림", kind: "active", charges: 4, desc: "다음 차례 상대의 굴림 -1. (4회, 최소 1번은 굴림)", cond: "내 차례 아무 때나" },
  { id: "tax", rarity: "common", icon: "💸", name: "점수 세금", kind: "active", charges: 3, desc: "다음 차례 상대가 기록하는 점수 -5. (3회)", cond: "내 차례 아무 때나" },
  { id: "fourKindBoost", rarity: "rare", icon: "🧱", name: "포카드 장인", kind: "passive", desc: "포카드 성공 시 +22." },
  { id: "bigNumbers", rarity: "rare", icon: "🐘", name: "큰 수 사랑", kind: "passive", desc: "포·파이브·식스 점수 +20%." },
  { id: "yachtAnnuity", rarity: "rare", icon: "🏦", name: "야추 연금", kind: "passive", desc: "야추 칸 성공 시 +40, 그 뒤 야추가 또 나와서 다른 칸에 기록해도 +50." },
  { id: "steadyHand", rarity: "rare", icon: "🤲", name: "안정된 손", kind: "passive", desc: "주사위 2개 이상 보관하고 굴리면 굴림이 줄지 않음. (턴마다 1번)" },
  { id: "lastChance", rarity: "rare", icon: "⏰", name: "막판 스퍼트", kind: "passive", desc: "남은 칸이 4개 이하일 때 모든 점수 +35%." },
  { id: "looseStraight", rarity: "rare", icon: "〰️", name: "느슨한 스트레이트", kind: "passive", desc: "스트레이트에 빈틈 1칸 허용 (예: 1-2-3-5 스몰, 1-2-3-4-6 라지), 성공 시 +5." },
  // ---- 영웅 (+16~28점) ----
  { id: "copyDie", rarity: "epic", icon: "🪞", name: "주사위 복제", kind: "active", charges: 4, target: "die2", desc: "주사위 하나의 눈을 다른 주사위에 복사. (4회)", cond: "한 번 이상 굴린 뒤" },
  { id: "amplify", rarity: "epic", icon: "📢", name: "점수 증폭", kind: "toggle", charges: 2, desc: "켜고 기록하면 그 점수 ×1.5. (2회)", cond: "기록 전에 켜기" },
  { id: "retry", rarity: "epic", icon: "🔁", name: "행운의 재도전", kind: "perTurn", desc: "굴림을 다 쓴 뒤, 보관 안 한 주사위만 한 번 더 굴림. (턴마다 1번)", cond: "굴림을 다 쓴 뒤" },
  { id: "perfectFH", rarity: "epic", icon: "🏰", name: "완벽한 풀하우스", kind: "passive", desc: "투페어(2+2+1)도 풀하우스 인정, 풀하우스 성공 시 +15." },
  { id: "streak", rarity: "epic", icon: "🔥", name: "연속 보너스", kind: "passive", desc: "0점 없이 기록을 이어가면 3번째부터 매번 +4. 0점이면 처음부터." },
  { id: "extraRoll", rarity: "epic", icon: "➕", name: "추가 굴림", kind: "passive", desc: "매 턴 굴림 +1 (3번 → 4번)." },
  { id: "sixthDie", rarity: "epic", icon: "🎲", name: "여섯 번째 주사위", kind: "passive", desc: "주사위 6개를 굴리고 칸마다 가장 좋은 5개로 자동 계산. 대신 매 턴 굴림 -1." },
  { id: "greed", rarity: "epic", icon: "💰", name: "욕심쟁이", kind: "passive", desc: "상단 보너스 기준 63 → 56점, 보너스 35 → 65점." },
  { id: "thief", rarity: "epic", icon: "🦝", name: "점수 도둑", kind: "passive", desc: "상대가 야추나 라지 스트레이트를 성공하면 나도 +15. (최대 2번)" },
  // ---- 전설 (+22~35점) ----
  { id: "wild", rarity: "legendary", icon: "🌈", name: "만능 주사위", kind: "active", charges: 4, target: "value", desc: "주사위 1개를 원하는 눈으로. (4회)", cond: "한 번 이상 굴린 뒤" },
  { id: "yachtHunter", rarity: "legendary", icon: "🏹", name: "야추 사냥꾼", kind: "passive", desc: "같은 눈 4개도 야추로 인정." },
  { id: "explode", rarity: "legendary", icon: "💥", name: "점수 폭발", kind: "toggle", charges: 1, desc: "켜고 기록하면 그 점수 ×2. (1회)", cond: "기록 전에 켜기" },
  { id: "rewind", rarity: "legendary", icon: "⏪", name: "시간 되감기", kind: "active", charges: 4, desc: "이번 턴을 처음으로 — 굴림을 전부 돌려받고 다시. (4회)", cond: "한 번 이상 굴린 뒤" },
  { id: "fate", rarity: "legendary", icon: "🔮", name: "운명 조작", kind: "passive", desc: "굴릴 때마다 보관 안 한 주사위가 15% 확률로 지금 가장 많은 눈으로 바뀜." },
  { id: "rewrite", rarity: "legendary", icon: "✍️", name: "다시 쓰기", kind: "active", charges: 2, target: "cat", desc: "이미 기록한 칸 하나를 지우고 나중에 다시 기록 (턴이 1번 늘어남). 다시 쓸 때 +15. (2회)", cond: "내 차례, 굴리기 전" },
  { id: "jackpot", rarity: "legendary", icon: "🎰", name: "잭팟", kind: "passive", desc: "야추 100점. 같은 눈 4개면 야추 칸에 40점, 포카드 성공 시 +10." },
];
export const AUG = Object.fromEntries(AUGMENTS.map(a => [a.id, a]));

// 증강 고르기 차례별 희귀도 확률 (게임 시작 · 3라운드 뒤 · 6라운드 뒤 · 9라운드 뒤) — 뒤로 갈수록 좋은 카드
export const PICK_ROUNDS = [1, 4, 7, 10];
const RARITY_WEIGHTS = [
  { common: 60, rare: 30, epic: 9, legendary: 1 },
  { common: 42, rare: 36, epic: 17, legendary: 5 },
  { common: 28, rare: 34, epic: 26, legendary: 12 },
  { common: 18, rare: 30, epic: 32, legendary: 20 },
];

/** 증강 3장 뽑기 — 이미 가진 것·같은 장에 겹치는 것 제외 */
export function rollOffer(pickIdx, owned = [], rng = Math.random, count = 3) {
  const w = RARITY_WEIGHTS[Math.min(pickIdx, RARITY_WEIGHTS.length - 1)];
  const out = [];
  const taken = new Set(owned);
  for (let k = 0; k < count; k++) {
    let pool = [];
    // 희귀도 먼저 뽑고, 그 희귀도에 남은 카드가 없으면 다른 희귀도에서
    let r = rng() * 100, rar = "common";
    for (const [key, val] of Object.entries(w)) { r -= val; if (r <= 0) { rar = key; break; } }
    pool = AUGMENTS.filter(a => a.rarity === rar && !taken.has(a.id));
    if (!pool.length) pool = AUGMENTS.filter(a => !taken.has(a.id));
    if (!pool.length) break;
    const pick = pool[Math.floor(rng() * pool.length)];
    out.push(pick.id); taken.add(pick.id);
  }
  return out;
}

// ---------------- 점수 계산 ----------------
const has = (p, id) => !!p?.augs?.some(a => a.id === id);
function counts(d) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]++; return c; }
const sum = (d) => d.reduce((a, b) => a + b, 0);

// 스트레이트 판정: len개 연속 (loose면 빈틈 1칸 허용 = len개 서로 다른 눈이 len+1 폭 안에)
function hasStraight(d, len, loose) {
  const s = new Set(d);
  for (let start = 1; start + len - 1 <= 6; start++) {
    let ok = true; for (let v = start; v < start + len; v++) if (!s.has(v)) { ok = false; break; }
    if (ok) return true;
  }
  if (loose) {
    for (let start = 1; start + len <= 6; start++) {
      let n = 0; for (let v = start; v <= start + len; v++) if (s.has(v)) n++;
      if (n >= len) return true;
    }
  }
  return false;
}

/** 증강 없이(또는 규칙 완화만 반영해) 5개 주사위의 기본 점수 */
export function baseScore(cat, d, p = null) {
  const c = counts(d), total = sum(d), mx = Math.max(...c);
  switch (cat) {
    case "ones": return c[1]; case "twos": return c[2] * 2; case "threes": return c[3] * 3;
    case "fours": return c[4] * 4; case "fives": return c[5] * 5; case "sixes": return c[6] * 6;
    case "choice": return total;
    case "fourKind": return mx >= 4 ? total : 0;
    case "fullHouse": {
      const sorted = c.slice(1).filter(x => x).sort((a, b) => b - a);
      const real = sorted[0] === 3 && sorted[1] === 2;
      const twoPair = has(p, "perfectFH") && sorted[0] === 2 && sorted[1] === 2;
      return real || twoPair ? total : 0;
    }
    case "smallStraight": return hasStraight(d, 4, has(p, "looseStraight")) ? 15 : 0;
    case "largeStraight": return hasStraight(d, 5, has(p, "looseStraight")) ? 30 : 0;
    case "yacht": {
      const jack = has(p, "jackpot");
      if (mx >= 5) return jack ? 100 : 50;
      if (mx >= 4 && has(p, "yachtHunter")) return jack ? 100 : 50;
      if (mx >= 4 && jack) return 40;
      return 0;
    }
  }
  return 0;
}

/** 칸 하나의 최종 점수. ctx: { rollsUsed, toggles:{amplify,explode}, taxed, remaining(이번 칸 포함 남은 칸 수) }
 *  반환 { score, base, dice(실제 쓴 5개) } — base 는 증강 없는 정통 점수(증강으로 번 점수 계산용) */
export function scoreCategory(cat, dice, p, ctx = {}) {
  // 여섯 번째 주사위: 6개 중 이 칸에 가장 좋은 5개
  let best = null;
  const sets = dice.length > 5 ? dice.map((_, skip) => dice.filter((__, i) => i !== skip)) : [dice];
  for (const d of sets) {
    const r = scoreFive(cat, d, p, ctx);
    if (!best || r.score > best.score) best = { ...r, dice: d };
  }
  return best;
}
function scoreFive(cat, d, p, ctx) {
  const plain = baseScore(cat, d, null);
  // 증강이 없어도 상대가 건 세금·배율은 적용해야 함 (전엔 증강 0개면 세금이 무시됐음)
  if (!p?.augs?.length && !ctx.taxed && !ctx.toggles?.amplify && !ctx.toggles?.explode) return { score: plain, base: plain, capped: [] };
  let s = baseScore(cat, d, p);
  const c = counts(d);
  const capped = [];
  const capLeft = (id, max) => ((p?.capUsed?.[id]) || 0) < max;
  // 3) 고정 더하기
  if (cat === "choice" && has(p, "choiceBoost")) s += 10;
  if (s > 0) {
    if ((cat === "smallStraight" || cat === "largeStraight") && has(p, "straightBonus")) s += 8;
    if (cat === "fullHouse" && has(p, "fullHouseFlat")) s += 10;
    if (cat === "fullHouse" && has(p, "perfectFH")) s += 15;
    if (cat === "fourKind" && has(p, "fourKindBoost")) s += 22;
    if (cat === "fourKind" && has(p, "jackpot")) s += 10;
    if (cat === "yacht" && has(p, "yachtAnnuity")) s += 40;
    if ((cat === "smallStraight" || cat === "largeStraight") && has(p, "looseStraight")) s += 5;
    if (has(p, "luckySix") && c[6] >= 3) s += 4;
    if (has(p, "firstRollLuck") && ctx.rollsUsed === 1 && capLeft("firstRollLuck", 3)) { s += 5; capped.push("firstRollLuck"); }
    if (has(p, "evenOdd") && (d.every(v => v % 2 === 0) || d.every(v => v % 2 === 1)) && capLeft("evenOdd", 3)) { s += 4; capped.push("evenOdd"); }
    if (ctx.rewriteBonus) s += 15;
  }
  // 4) 퍼센트
  let pct = 0;
  if (UPPER.includes(cat) && has(p, "upperBoost")) pct += 15;
  if (["ones", "twos", "threes"].includes(cat) && has(p, "smallFan")) pct += 50;
  if (["fours", "fives", "sixes"].includes(cat) && has(p, "bigNumbers")) pct += 20;
  if (has(p, "lastChance") && (ctx.remaining ?? 99) <= 4) pct += 35;
  s = Math.floor(s * (100 + pct) / 100);
  // 5) 배율 토글
  if (ctx.toggles?.amplify) s = Math.floor(s * 1.5);
  if (ctx.toggles?.explode) s = s * 2;
  // 6) 세금
  if (ctx.taxed) s = Math.max(0, s - 5 * ctx.taxed);
  // 7) 보험
  if (s === 0 && has(p, "insurance") && capLeft("insurance", 3)) { s = 5; capped.push("insurance"); }
  return { score: s, base: plain, capped };
}

/** 상단 보너스 (기준·금액은 증강 반영) */
export function upperBonusRule(p) {
  // 겹치면 낮은 기준·높은 금액 (보너스 완화 50 + 욕심쟁이 65점)
  const at = has(p, "bonusEase") ? 50 : has(p, "greed") ? 56 : UPPER_BONUS_AT;
  return { at, amount: has(p, "greed") ? 65 : UPPER_BONUS };
}
export function upperSum(p) { let s = 0; for (const k of UPPER) if (typeof p.scores[k] === "number") s += p.scores[k]; return s; }
export function totalOf(p) {
  let s = 0; for (const k of CATS) if (typeof p.scores[k] === "number") s += p.scores[k];
  const r = upperBonusRule(p);
  if (upperSum(p) >= r.at) s += r.amount;
  return s + (p.extra || 0);
}
export function rollsPerTurn(p) { return BASE_ROLLS + (has(p, "extraRoll") ? 1 : 0) - (has(p, "sixthDie") ? 1 : 0); }
export function diceCount(p) { return has(p, "sixthDie") ? 6 : 5; }
export const hasAug = has;

// 운명 조작: 보관 안 한 주사위 중 30%를 지금 가장 많은 눈으로 (보관+굴린 결과 기준, 동점이면 큰 눈)
export function applyFate(dice, held, rng = Math.random) {
  const c = counts(dice); let top = 6; for (let v = 6; v >= 1; v--) if (c[v] > c[top]) top = v;
  const changed = [];
  dice.forEach((v, i) => { if (!held[i] && v !== top && rng() < 0.15) { dice[i] = top; changed.push(i); } });
  return changed;
}

// ---------------- AI (봇·시간초과 대신 두기) ----------------
// 칸별 평균 기대 점수 — "이 칸을 지금 쓰면 손해인가" 판단용
const EXPECT = { ones: 2.1, twos: 4.2, threes: 6.3, fours: 8.4, fives: 10.5, sixes: 12.6, choice: 22, fourKind: 13, fullHouse: 16, smallStraight: 11, largeStraight: 9, yacht: 6 };
// 증강을 반영한 칸 기대값 (고정 점수 × 대략 성공률, 퍼센트는 곱함) — 강화된 칸을 아무 때나 버리지 않게
const SUCCESS = { fourKind: 0.55, fullHouse: 0.6, smallStraight: 0.8, largeStraight: 0.6, yacht: 0.35 };
function expectFor(p, cat) {
  let e = EXPECT[cat] || 0;
  if (!p?.augs?.length) return e;
  const ok = SUCCESS[cat] || 1;
  if (cat === "choice" && has(p, "choiceBoost")) e += 10;
  if ((cat === "smallStraight" || cat === "largeStraight") && has(p, "straightBonus")) e += 8 * ok;
  if ((cat === "smallStraight" || cat === "largeStraight") && has(p, "looseStraight")) e += 5 * ok + 3;
  if (cat === "fullHouse" && has(p, "fullHouseFlat")) e += 10 * ok;
  if (cat === "fullHouse" && has(p, "perfectFH")) e += 15 * 0.85 + 4;
  if (cat === "fourKind" && has(p, "fourKindBoost")) e += 22 * ok;
  if (cat === "fourKind" && has(p, "jackpot")) e += 10 * ok;
  if (cat === "yacht" && has(p, "yachtAnnuity")) e += 40 * ok;
  if (cat === "yacht" && has(p, "jackpot")) e += 22;
  if (cat === "yacht" && has(p, "yachtHunter")) e += 18;
  if (UPPER.includes(cat) && has(p, "upperBoost")) e *= 1.15;
  if (["ones", "twos", "threes"].includes(cat) && has(p, "smallFan")) e *= 1.5;
  if (["fours", "fives", "sixes"].includes(cat) && has(p, "bigNumbers")) e *= 1.2;
  return e;
}
/** 기록할 칸 고르기 — (점수 - 기대값) 최대, 상단 보너스 가까우면 상단 가산 */
export function bestCategory(p, dice, ctx = {}) {
  let best = null;
  const up = upperSum(p), need = upperBonusRule(p).at - up;
  for (const cat of CATS) {
    if (typeof p.scores[cat] === "number") continue;
    const { score, capped } = scoreCategory(cat, dice, p, ctx);
    // 보험 점수는 판단에서 빼고(일부러 0점 칸을 버리지 않게) 덤으로만 받음
    let v = score - (capped?.includes("insurance") ? 5 : 0) - expectFor(p, cat);
    if (UPPER.includes(cat) && need > 0) {
      const face = UPPER.indexOf(cat) + 1;
      if (score >= face * 3) v += 6; // 보너스에 도움되는 상단 기록
    }
    if (cat === "choice" && score < 20) v -= 4; // 초이스는 보험으로 아껴 둠
    if (!best || v > best.v) best = { cat, v, score };
  }
  return best;
}
/** 다음 굴림 전에 보관할 주사위 */
export function chooseHolds(p, dice) {
  const c = counts(dice);
  const open = (k) => typeof p.scores[k] !== "number";
  // 스트레이트 노림: 4연속이 이미 있고 라지/스몰이 비어 있으면 그 4개 보관
  if (open("largeStraight") || open("smallStraight")) {
    for (const run of [[2, 3, 4, 5], [1, 2, 3, 4], [3, 4, 5, 6]]) {
      if (run.every(v => c[v] > 0)) {
        if (!open("largeStraight") && hasStraight(dice, 4, false)) break; // 스몰만 남았으면 이미 성공
        const used = new Set();
        return dice.map((v, i) => { if (run.includes(v) && !used.has(v)) { used.add(v); return true; } return false; });
      }
    }
  }
  // 가장 많은 눈(동점이면 큰 눈) 보관 — 그 눈의 상단 칸이나 포카드·야추가 비어 있을 때
  let top = 6; for (let v = 6; v >= 1; v--) if (c[v] > c[top]) top = v;
  if (c[top] >= 2) return dice.map(v => v === top);
  // 다 다르면 큰 눈 하나(5·6)만
  return dice.map(v => v >= 5 && v === Math.max(...dice));
}
