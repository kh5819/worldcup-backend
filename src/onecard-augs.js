// =========================
// DUO 증강 원카드 — 증강 40종 정의 (2026-11-17)
// kind (종류)
//   passive  지속형: 조건이 맞으면 자동으로 적용 (횟수 있는 것도 있음)
//   instant  고르는 순간 1번 적용
//   active   사용형: 내 차례에 버튼으로 사용. 차례를 쓰지 않음(카드는 그대로 낼 수 있음). 한 차례에 사용형 1개
//   arm      켜기형: 켜 두면 이번 차례에 내는 공격 카드에 적용. 안 쓰고 차례가 끝나면 횟수 그대로
//   reaction 반응형: 공격을 받은 내 차례에 '맞기' 대신 고르는 버튼 (반사·무효화). 차례를 쓰지 않음(무효화는 막고 이어서 진행)
//   auto     자동 반응: 공격을 맞을 때 우선순위대로 하나만 자동 적용 (감소·무효)
// 자동 반응 우선순위: 최후의 역전 면역 → 마지막 한 장 → 원카드 마스터 → 방어 본능 → 방어 시너지
// tags: 시너지 묶음 (같은 묶음 3개 이상 → 보너스, 고르기에서 같은 묶음이 조금 더 잘 나옴)
// =========================
export const RARITY = {
  common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 },
  epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 },
};
export const KIND_LABEL = { passive: "지속형", instant: "즉시", active: "사용형", arm: "켜기형", reaction: "반응형", auto: "자동 반응" };
export const SYNERGY = {
  atk: { label: "공격 시너지", desc: "공격 증강 3개 이상: 내 공격 카드 +1" },
  def: { label: "방어 시너지", desc: "방어 증강 3개 이상: 공격을 맞을 때 1장 덜 뽑음 (다른 감소가 없을 때)" },
  ctl: { label: "통제 시너지", desc: "통제 증강 3개 이상: 봉인·제한 효과가 1차례 더 감" },
  hand: { label: "손패 시너지", desc: "손패 증강 3개 이상: 내 차례 시작에 손패 8장 이상이면 숫자 카드 1장 정리 (3번)" },
};

// art: 공통 증강 카드 그림(aug-kit) 문양 이름
const A = (id, rarity, art, name, kind, charges, cond, desc, tags = [], extra = {}) => ({ id, rarity, art, name, kind, charges, cond, desc, tags, ...extra });
export const AUGS = [
  // ---------- 일반 10 ----------
  A("quickDraw", "common", "plus", "빠른 드로우", "passive", null, "내가 스스로 카드를 뽑을 때", "덱 위 2장을 보고 낼 수 있는 카드를 먼저 가져와요. 남은 1장은 덱 맨 아래로", ["hand"]),
  A("cardSense", "common", "eye", "카드 감별사", "passive", null, "내 차례", "낼 수 있는 카드 중 추천 카드를 표시하고, 다음 사람이 공격을 막을 수 있는지 알려 줘요", ["hand"]),
  A("attackPrep", "common", "amp", "공격 준비", "passive", 4, "내가 공격 카드를 낼 때", "공격 +1 (판당 4번)", ["atk"]),
  A("defInstinct", "common", "shield", "방어 본능", "auto", 2, "쌓인 공격 4장 이상을 맞을 때", "절반만 뽑아요 (내림, 2번)", ["def"]),
  A("colorExpert", "common", "sparkle", "색상 전문가", "passive", null, "색 변경 카드를 내고 손패가 3장 이상일 때", "고른 색의 숫자 카드 1장(가장 큰 수)을 함께 버려요", ["hand"]),
  A("comboPlay", "common", "combo", "연속 플레이", "passive", null, "숫자 카드를 냈는데 같은 숫자가 또 있을 때", "같은 숫자 카드 1장을 이어서 낼 수 있어요 (한 차례 1번, 색 상관없음)", ["hand"]),
  A("luckyHand", "common", "clover", "행운의 손패", "instant", null, "고르는 순간 (손패 3장 이상)", "무작위 손패 2장을 덱에 섞고 1장만 새로 받아요 (손패 -1)", ["hand"]),
  A("sortTactics", "common", "swap", "카드 정리", "active", 3, "내 차례 · 손패 1장 고르기", "고른 카드를 덱 맨 아래에 넣고 1장 뽑아요 (3번)", ["hand"], { target: "card" }),
  A("lastOne", "common", "small", "마지막 한 장", "auto", 1, "손패 1장일 때 공격을 맞으면", "그 공격을 1번 막아요. 원카드 선언도 자동 성공", ["def"]),
  A("comebackPrep", "common", "rotate", "역전 준비", "passive", 4, "내 차례 시작에 손패 10장 이상", "무작위 숫자 카드 1장을 덱 맨 아래로 (판당 4번)", ["hand"]),
  // ---------- 희귀 10 ----------
  A("cardCopy", "rare", "double", "카드 복제", "active", 2, "내 차례 · 손패의 숫자 카드 1장", "그 카드를 덱 아래로 보내고, 맨 위 카드와 같은 '복제 카드'(1번 쓰면 사라짐)를 받아요", ["hand"], { target: "numCard" }),
  A("reflect", "rare", "rewind", "공격 반사", "reaction", 2, "공격을 받은 내 차례", "쌓인 공격의 절반(올림)을 공격한 사람에게 되돌리고 나머지만 뽑아요. 반사된 공격은 다시 반사 증강으로 못 돌려요", ["def"]),
  A("colorSeal", "rare", "eraser", "색상 봉인", "active", 1, "내 차례 · 색 고르기", "다음 사람은 다음 1차례 동안 그 색 카드를 못 내요 (색 변경 카드는 가능)", ["ctl"], { target: "color" }),
  A("handSwap", "rare", "swap", "손패 교환", "active", 2, "내 차례 · 내 카드 1장 + 상대 1명", "고른 내 카드와 상대의 무작위 카드 1장을 바꿔요", ["ctl"], { target: "cardPlayer" }),
  A("steal", "rare", "magnet", "카드 훔치기", "active", 1, "내 차례 · 손패 2장 이상인 상대", "상대의 무작위 카드 1장을 가져와요", ["ctl"], { target: "player" }),
  A("atkAmp", "rare", "amp", "공격 증폭", "arm", 2, "켜고 공격 카드를 낼 때", "이번 공격 +2", ["atk"]),
  A("atkNull", "rare", "shield", "공격 무효화", "reaction", 1, "공격(6장 이하)을 받은 내 차례", "쌓인 공격을 취소하고 이어서 내 차례를 진행해요", ["def"]),
  A("turnAccel", "rare", "clock", "턴 가속", "passive", 2, "같은 색 카드를 3차례 연속 낼 때", "추가 차례 1번 (판당 2번, 추가 차례에선 다시 안 생김)", ["atk"]),
  A("transform", "rare", "wand", "카드 변환", "active", 2, "내 차례 · 손패의 숫자 카드 1장 + 색", "그 카드의 색을 바꿔요", ["hand"], { target: "numCardColor" }),
  A("dirControl", "rare", "rotate", "방향 지배", "active", 2, "내 차례 (3명 이상)", "진행 방향을 바꿔요", ["ctl"], { minPlayers: 3, whenAtk: true }),
  // ---------- 영웅 10 ----------
  A("doubleAtk", "epic", "double", "이중 공격", "arm", 1, "켜고 공격 카드를 낼 때", "이번 공격 장수 ×2 (다른 보너스 먼저 더한 뒤)", ["atk"]),
  A("perfectDef", "epic", "shield", "완벽한 방어", "reaction", 1, "공격을 받은 내 차례", "크기와 상관없이 모두 막고, 손패가 3장 이상이면 무작위 숫자 1장도 버려요", ["def"]),
  A("handStorm", "epic", "burst", "손패 폭풍", "active", 1, "내 차례", "나를 뺀 모두가 1장씩 뽑아요", ["atk"]),
  A("reconstruct", "epic", "broom", "카드 재구성", "active", 1, "내 차례 · 손패 3장 이상, 숫자 카드 있음", "숫자 카드를 전부 덱에 섞고 그보다 1장 적게 다시 뽑아요", ["hand"]),
  A("forceSwap", "epic", "swap", "강제 교환", "active", 1, "내 차례 · 서로 2장 이상인 상대", "상대와 무작위 2장씩 바꿔요", ["ctl"], { target: "player" }),
  A("cardSeal", "epic", "eraser", "카드 봉인", "active", 1, "내 차례 · 손패 2장 이상인 상대", "상대 무작위 카드 2장을 그 사람 2차례 동안 못 내게 해요 (자물쇠 표시)", ["ctl"], { target: "player" }),
  A("timeLord", "epic", "hourglass", "시간 지배", "active", 1, "내 차례 · 상대 1명", "그 사람의 다음 3차례 제한 시간이 절반 (최소 8초)", ["ctl"], { target: "player" }),
  A("prophecy", "epic", "eye", "카드 예언", "passive", null, "항상", "덱 맨 위 2장이 나에게만 보여요", ["hand"]),
  A("chainAtk", "epic", "combo", "연쇄 공격", "passive", 3, "공격 카드를 냈는데 공격 카드가 또 있을 때", "공격 카드 1장을 이어서 낼 수 있어요 (한 차례 1번, 판당 3번)", ["atk"]),
  A("tacticCopy", "epic", "star", "전술 복제", "active", 1, "내 차례 · 다른 사람이 최근 쓴 사용형 증강", "그 증강 효과를 내가 1번 써요 (전설·전술 복제는 제외)", ["ctl"]),
  // ---------- 전설 10 (모두 횟수 제한) ----------
  A("fateHand", "legendary", "gold", "운명의 손패", "active", 1, "내 차례 · 숫자 카드 있음", "숫자 카드 최대 2장을 덱 아래로 보내고 같은 수의 '운명 카드'(색 변경, 1번 쓰면 사라짐)로 바꿔요", ["hand"]),
  A("absReflect", "legendary", "phoenix", "절대 반사", "reaction", 1, "공격을 받은 내 차례", "쌓인 공격에 +2를 더해 공격한 사람에게 전부 돌려줘요 (나는 안 뽑음)", ["def"]),
  A("cardKing", "legendary", "crown", "카드의 왕", "active", 1, "내 차례", "내 3차례 동안: 공격 +1, 건너뛰기는 2명, 숫자 카드는 ±1 숫자에도 낼 수 있어요", ["atk"]),
  A("timeRewind", "legendary", "rewind", "시간 역행", "active", 1, "내 차례 시작 직후 · 바로 앞 행동이 다른 사람의 카드 내기", "그 카드를 낸 사람 손패로 돌려보내고 효과(공격·색·방향)를 취소해요. 차례는 나에게", ["ctl"], { whenAtk: true }),
  A("battlefield", "legendary", "crown", "전장 지배", "active", 1, "내 차례 · 색 고르기", "진행 방향을 바꾸고 현재 색을 원하는 색으로 바꿔요", ["ctl"], { target: "color" }),
  A("revolution", "legendary", "burst", "손패 대변혁", "active", 1, "내 차례 · 내 손패가 평균보다 많을 때", "남은 모두의 손패를 모아 섞고 똑같이 나눠요 (나머지는 원래 많던 사람부터)", ["hand"]),
  A("godDraw", "legendary", "sparkle", "신의 드로우", "active", 1, "내 차례 · 카드 종류 고르기", "덱에서 원하는 특수 카드 1장을 찾아와요 (덱에 없으면 1번 쓰는 '신의 카드' 생성)", ["hand"], { target: "kind" }),
  A("lastStand", "legendary", "phoenix", "최후의 역전", "passive", 1, "내 차례 시작에 손패가 가장 많고 8장 이상", "숫자 카드 절반을 덱 아래로 보내고(최소 2장 남김) 내 2차례 동안 공격 면역 (1번)", ["def"]),
  A("absSeal", "legendary", "eraser", "절대 봉인", "active", 1, "내 차례 · 상대의 증강 1개", "그 증강을 그 사람 4차례 동안 못 쓰게 해요", ["ctl"], { target: "playerAug" }),
  A("master", "legendary", "star", "원카드 마스터", "passive", 2, "항상", "내 공격 카드 +1 · 공격을 맞으면 절반만 뽑음(2번) · 원카드 선언 자동 성공", ["atk", "def"]),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
// 다른 사람이 쓴 걸 전술 복제로 따라 할 수 있는 증강 (전설 제외)
export const COPYABLE = new Set(AUGS.filter(a => a.kind === "active" && a.rarity !== "legendary" && a.id !== "tacticCopy").map(a => a.id));

// 고르기 회차별 희귀도 확률 (0 = 시작, 1~4 = 3·6·9·12차례 뒤)
const WEIGHTS = [
  { common: 62, rare: 28, epic: 9, legendary: 1 },
  { common: 45, rare: 35, epic: 16, legendary: 4 },
  { common: 30, rare: 38, epic: 24, legendary: 8 },
  { common: 20, rare: 36, epic: 30, legendary: 14 },
  { common: 14, rare: 32, epic: 34, legendary: 20 },
];
export const MAX_AUGS = 5;
export const PICK_EVERY = 3;

/** 3장 뽑기 — 이미 가진 것 제외, 같은 시너지 묶음은 1.5배 잘 나옴 */
export function rollOffer(pickIdx, owned, { players = 2, rng = Math.random, n = 3 } = {}) {
  const w = WEIGHTS[Math.min(pickIdx, WEIGHTS.length - 1)];
  const ownedTags = new Set(owned.flatMap(id => AUG[id]?.tags || []));
  const pool = AUGS.filter(a => !owned.includes(a.id) && (!a.minPlayers || players >= a.minPlayers));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    const wt = pool.map(a => (w[a.rarity] || 1) * (a.tags.some(t => ownedTags.has(t)) ? 1.5 : 1));
    let tot = wt.reduce((s, x) => s + x, 0), r = rng() * tot, pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= wt[i]; if (r <= 0) { pick = i; break; } }
    out.push(pool[pick].id); pool.splice(pick, 1);
  }
  return out;
}
export function synergyOf(ids) {
  const c = {};
  for (const id of ids) for (const t of AUG[id]?.tags || []) c[t] = (c[t] || 0) + 1;
  return Object.keys(SYNERGY).filter(t => (c[t] || 0) >= 3);
}
export const META_AUGS = AUGS.map(({ id, rarity, art, name, kind, charges, cond, desc, tags, target, minPlayers, whenAtk }) => ({ id, rarity, art, name, kind, charges, cond, desc, tags, target: target || null, minPlayers: minPlayers || null, whenAtk: !!whenAtk }));
