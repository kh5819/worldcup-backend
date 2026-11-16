// =========================
// 증강 오목 — 증강 목록 (2026-11-16)
// · 사용형(card): 초딩 모드 카드를 n장 받음 → 기존 카드 UI·검사(useCard)를 그대로 씀
// · 지속형(passive): 판 내내 규칙이 바뀜 (omok.js 의 각 지점에서 hasAug 로 확인)
// · 1대1 전용. 고르기: 시작 + 두 사람 모두 5·10·15수를 뒀을 때, 3개 중 1개 (동시에, 20초), 최대 4개
// · 승리 판정은 일반 오목과 같음(N목 이상 = 승리, 금수 없음). 돌이 바뀌면 그 칸들로 다시 검사
// · 카드 사용: 한 차례 최대 2번. 판을 바꾸는 카드는 차례가 끝남, 정보·시간·재행동 카드는 안 끝남
// =========================
export const AUG_RARITY = { common: { w: 60, name: "일반" }, rare: { w: 28, name: "희귀" }, epic: { w: 10, name: "영웅" }, legendary: { w: 3, name: "전설" } };
export const OMOK_AUGS = [
  // ---- 사용형 (카드 지급) ----
  { id: "aMove", kind: "card", card: "move", n: 2, rarity: "common", icon: "move", name: "기동 작전", desc: "이동 카드 2장 — 내 돌 1개를 빈 칸으로" },
  { id: "aWall", kind: "card", card: "wall", n: 2, rarity: "common", icon: "wall", name: "봉인", desc: "벽 카드 2장 — 빈 칸 하나를 1턴 막음" },
  { id: "aPush", kind: "card", card: "push", n: 2, rarity: "common", icon: "push", name: "돌 밀기", desc: "밀치기 카드 2장 — 돌 1개를 옆 빈 칸으로" },
  { id: "aShield", kind: "card", card: "shield", n: 2, rarity: "common", icon: "shield", name: "돌의 보호", desc: "방패 카드 2장 — 내 돌 1개를 한 바퀴 보호" },
  { id: "aTime", kind: "card", card: "timeThief", n: 2, rarity: "common", icon: "time", name: "시간 도둑", desc: "시간도둑 카드 2장 — 상대 다음 차례 시간 절반 (차례 안 끝남)" },
  { id: "aFocus", kind: "card", card: "focus", n: 2, rarity: "common", icon: "focus", name: "집중력", desc: "집중 카드 2장 — 지금 가장 좋은 자리 1곳 표시 (차례 안 끝남)" },
  { id: "aLight", kind: "card", card: "lightning", n: 2, rarity: "rare", icon: "lightning", name: "번개 소환", desc: "번개 카드 2장 — 무작위 상대 돌 1개 제거" },
  { id: "aBomb", kind: "card", card: "bomb", n: 1, rarity: "rare", icon: "bomb", name: "돌 제거", desc: "폭탄 카드 1장 — 고른 상대 돌 1개 제거" },
  { id: "aGhost", kind: "card", card: "ghost", n: 2, rarity: "rare", icon: "ghost", name: "유령 돌", desc: "투명돌 카드 2장 — 상대에겐 안 보이다 1턴 뒤 나타남" },
  { id: "aSwap", kind: "card", card: "swap", n: 1, rarity: "rare", icon: "swap", name: "자리 교환", desc: "맞바꾸기 카드 1장 — 내 돌 ↔ 바로 옆 상대 돌" },
  { id: "aTornado", kind: "card", card: "tornado", n: 1, rarity: "rare", icon: "tornado", name: "혼돈의 회오리", desc: "회오리 카드 1장 — 3×3 안의 돌을 섞음" },
  { id: "aFlip", kind: "card", card: "flip", n: 1, rarity: "epic", icon: "flip", name: "돌 흡수", desc: "뒤집기 카드 1장 — 상대 돌 1개를 내 돌로" },
  { id: "aCross", kind: "card", card: "cross", n: 1, rarity: "epic", icon: "cross", name: "폭발 돌", desc: "십자폭탄 카드 1장 — 고른 칸 상하좌우 상대 돌 제거" },
  { id: "aReplay", kind: "card", card: "replay", n: 1, rarity: "epic", icon: "replay", name: "이중 착수", desc: "재행동 카드 1장 — 이번 차례에 돌 두 번" },
  { id: "aRewind", kind: "card", card: "rewind", n: 1, rarity: "legendary", icon: "rewind", name: "시간 되감기", desc: "되감기 카드 1장 — 상대가 마지막에 둔 돌을 없앰" },
  // ---- 지속형 ----
  { id: "pDefSense", kind: "passive", rarity: "common", icon: "radar", name: "수비 감지", desc: "내 차례마다 상대가 4목·5목을 만들 수 있는 자리 표시" },
  { id: "pAtkSense", kind: "passive", rarity: "common", icon: "target", name: "공격 감지", desc: "내 차례마다 내가 4목·5목을 만들 수 있는 자리 표시" },
  { id: "pTime", kind: "passive", rarity: "common", icon: "hourglass", name: "시간 부자", desc: "내 제한 시간 1.5배" },
  { id: "pPress", kind: "passive", rarity: "common", icon: "press", name: "압박", desc: "상대 제한 시간 25% 줄어듦 (최소 5초)" },
  { id: "pLuck", kind: "passive", rarity: "common", icon: "clover", name: "행운", desc: "다음 증강부터 선택지 4개 + 새로고침 1번 더" },
  { id: "pCollect", kind: "passive", rarity: "rare", icon: "cards", name: "카드 수집가", desc: "내 돌 6개를 둘 때마다 무작위 카드 1장" },
  { id: "pGamble", kind: "passive", rarity: "rare", icon: "dice", name: "도박사", desc: "지금 무작위 카드 3장" },
  { id: "pInstinct", kind: "passive", rarity: "rare", icon: "alarm", name: "긴급 방어", desc: "상대가 한 수만 더 두면 이기는 줄을 만들면 그 끝에 자동 벽 (상대 차례 1번 동안, 3바퀴에 1번)" },
  { id: "pSolid", kind: "passive", rarity: "epic", icon: "fortress", name: "철벽 진형", desc: "4개 이상 이어진 내 돌은 상대 카드에 안 당함" },
  { id: "pBonus", kind: "passive", rarity: "epic", icon: "double", name: "연속 착수", desc: "내 돌 5번째마다 한 번 더 둠" },
  { id: "pSecond", kind: "passive", rarity: "legendary", icon: "phoenix", name: "최후의 반격", desc: "상대가 이기는 순간 1번 막음 — 그 줄 가운데 돌이 사라짐" },
  { id: "pMaster", kind: "passive", rarity: "legendary", icon: "crown", name: "오목의 지배자", desc: "수비·공격 감지 + 내 돌 6번째마다 한 번 더 + 지금 카드 2장" },
];
export const AUG_BY_ID = new Map(OMOK_AUGS.map(a => [a.id, a]));
/** 증강 모드에서 나오는 카드 (훔치기·엿보기·럭키박스는 빼고) */
export const AUG_CARD_POOL = ["move", "wall", "push", "lightning", "shield", "timeThief", "focus", "bomb", "ghost", "swap", "tornado", "flip", "cross", "replay"];
/** 증강 모드에만 있는 카드 (초딩 모드에선 안 나옴) */
export const AUG_ONLY_CARDS = ["focus", "rewind"];
export const MAX_AUG_HAND = 6, MAX_AUGS = 4, MAX_USES_PER_TURN = 2;
export const AUG_PICK_SEC = 20;
/** 고르기 시점: 시작 + 두 사람 모두 돌 5·10·15개를 뒀을 때 (최대 4개) */
export const AUG_PICK_MOVES = [0, 5, 10, 15];

export function hasAug(p, id) { return !!(p && p.augs && p.augs.includes(id)); }

/** 선택지 뽑기: 이미 가진 지속형·조건 안 맞는 것 빼고, 희귀도 가중치로 겹치지 않게 */
export function rollOffer(p, room, n) {
  const pool = OMOK_AUGS.filter(a => {
    if (a.kind === "passive" && hasAug(p, a.id)) return false;
    if (a.id === "pInstinct" && room.winLength <= 3) return false;
    if ((a.id === "pDefSense" || a.id === "pAtkSense") && hasAug(p, "pMaster")) return false; // 지배자에 이미 들어 있음
    return true;
  });
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let tot = 0; for (const a of pool) tot += AUG_RARITY[a.rarity].w;
    let r = Math.random() * tot, pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= AUG_RARITY[pool[i].rarity].w; if (r <= 0) { pick = i; break; } }
    out.push(pool[pick].id); pool.splice(pick, 1);
  }
  return out;
}
export const randomPoolCard = () => AUG_CARD_POOL[Math.floor(Math.random() * AUG_CARD_POOL.length)];
/** 증강 적용. 얻은 카드 수를 돌려줌 */
export function applyAug(p, id, room) {
  const a = AUG_BY_ID.get(id); if (!a) return { cards: 0, extra: [] };
  p.augs.push(id);
  let cards = 0; const extra = [];
  const give = (c) => { if (p.cards.length < MAX_AUG_HAND) { p.cards.push(c); cards++; } };
  if (a.kind === "card") for (let k = 0; k < a.n; k++) give(a.card);
  if (id === "pGamble") for (let k = 0; k < 3; k++) give(randomPoolCard());
  if (id === "pMaster") for (let k = 0; k < 2; k++) give(randomPoolCard());
  return { cards, extra };
}
/** 봇·시간 초과: 희귀도 높은 것 우선 */
export function bestOf(offer) {
  const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
  return [...offer].sort((a, b) => ord[AUG_BY_ID.get(b).rarity] - ord[AUG_BY_ID.get(a).rarity] || Math.random() - 0.5)[0];
}
export const senseOn = (p, which) => hasAug(p, which) || hasAug(p, "pMaster");
/** 한 번 더 두기 주기 (연속 착수 5, 지배자 6) — 둘 다면 짧은 쪽 */
export function bonusEvery(p) { return hasAug(p, "pBonus") ? 5 : hasAug(p, "pMaster") ? 6 : 0; }
