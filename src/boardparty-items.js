// =========================
// DUO GAME ZONE — 보드파티 아이템 카드 v20260515_1 Phase 3
// 15종 = common 10 + rare 5
// =========================
//
// targeting:
//   'self'   — 자기 자신
//   'enemy'  — 적 1명 (개인전이면 자기 외 누구든)
//   'ally'   — 아군 1명 (팀전 한정. 개인전이면 자기 자신만)
//   'any'    — 누구든 1명
//   null     — 타겟 없음
//
// effect 키 (boardparty.js useItem에서 해석):
//   gainSelf: N             — 자기 +N 코인
//   gainTeam: N             — 팀 전체 +N (팀전 / 개인전 = 자기만)
//   damageTarget: N         — 대상 -N 코인
//   stealFromTarget: N      — 대상 -N, 자기 +N
//   moveSelf: N             — 자기 +N 칸 (음수 가능)
//   teleportSelf: 'start'   — 자기 시작 칸으로
//   diceBoost: N            — 다음 자기 주사위 +N (status)
//   diceFixed: N            — 다음 자기 주사위 N으로 고정 (status)
//   extraRoll: true         — 이번 턴 추가 1회 굴림 (status: extraRoll=1)
//   shield: 1               — 다음 음수 효과 1회 자동 무효 (status)
//   mirror: 1               — 다음 음수 효과 1회 반사 (status)
//   swapPosition: true      — 대상과 위치 교환
//   plantBomb: { damage: 5 } — 자기 현재 칸에 폭탄 설치 (다음 밟는 사람)
//   nuke: { selfDmg: 3, others: 3 } — 자기 -selfDmg, 다른 모두 -others
//
// 자기 턴 어디서든 사용 (주사위 전/후). 단 useItem 시점 검증은 서버.

export const ITEMS = [
  // ===== COMMON (10) =====
  { id: "it_dice_p3", rarity: "common", emoji: "🎲", name: "주사위 +3",
    targeting: "self", text: "다음 주사위 +3", copies: 3,
    effect: { diceBoost: 3 } },
  { id: "it_dice_fix6", rarity: "common", emoji: "🎯", name: "정밀 주사위",
    targeting: "self", text: "다음 주사위 6 고정", copies: 2,
    effect: { diceFixed: 6 } },
  { id: "it_extra_roll", rarity: "common", emoji: "⏩", name: "추가 굴림",
    targeting: "self", text: "이번 턴 주사위 한 번 더", copies: 2,
    effect: { extraRoll: true } },
  { id: "it_jump", rarity: "common", emoji: "🚀", name: "점프",
    targeting: "self", text: "즉시 3칸 전진", copies: 3,
    effect: { moveSelf: 3 } },
  { id: "it_back", rarity: "common", emoji: "🐌", name: "후진",
    targeting: "self", text: "즉시 2칸 후진 (전략용)", copies: 1,
    effect: { moveSelf: -2 } },
  { id: "it_coin5", rarity: "common", emoji: "💰", name: "동전 줍기",
    targeting: "self", text: "+5 코인", copies: 3,
    effect: { gainSelf: 5 } },
  { id: "it_gift_team", rarity: "common", emoji: "🎁", name: "팀 선물",
    targeting: null, text: "팀 전체 +3 (개인전이면 자기만)", copies: 2,
    effect: { gainTeam: 3 } },
  { id: "it_shield", rarity: "common", emoji: "🛡️", name: "보호막",
    targeting: "self", text: "다음 음수 효과 1회 무효", copies: 2,
    effect: { shield: 1 } },
  { id: "it_swap", rarity: "common", emoji: "🤝", name: "자리 바꾸기",
    targeting: "any", text: "대상과 위치 교환", copies: 1,
    effect: { swapPosition: true } },
  { id: "it_steal", rarity: "common", emoji: "💸", name: "강탈",
    targeting: "enemy", text: "대상 -3 코인, 자기 +3", copies: 2,
    effect: { stealFromTarget: 3 } },

  // ===== RARE (5) =====
  { id: "it_bomb", rarity: "rare", emoji: "💣", name: "폭탄 설치",
    targeting: "self", text: "현재 칸에 폭탄 (다음 밟는 사람 -5)", copies: 1,
    effect: { plantBomb: { damage: 5 } } },
  { id: "it_mirror", rarity: "rare", emoji: "🪞", name: "거울",
    targeting: "self", text: "다음 음수 효과 1회 공격자에게 반사", copies: 1,
    effect: { mirror: 1 } },
  { id: "it_coronate", rarity: "rare", emoji: "👑", name: "즉위",
    targeting: "self", text: "+10 코인", copies: 1,
    effect: { gainSelf: 10 } },
  { id: "it_nuke", rarity: "rare", emoji: "☢️", name: "핵폭탄",
    targeting: null, text: "자기 -3, 다른 모두 -3", copies: 1,
    effect: { nuke: { selfDmg: 3, others: 3 } } },
  { id: "it_back_to_start", rarity: "rare", emoji: "⏰", name: "시작점",
    targeting: "self", text: "자기 시작 칸으로 + 시작 보너스 +5", copies: 1,
    effect: { teleportSelf: "start", gainSelf: 5 } },
];

// 덱 빌드
export function buildItemDeck() {
  const deck = [];
  for (const it of ITEMS) {
    const n = it.copies || 1;
    for (let i = 0; i < n; i++) deck.push(it.id);
  }
  return deck;
}

const ITEM_MAP = new Map(ITEMS.map(it => [it.id, it]));
export function getItem(id) { return ITEM_MAP.get(id); }

export function publicItemList() {
  return ITEMS.map(it => ({
    id: it.id, rarity: it.rarity, emoji: it.emoji, name: it.name,
    targeting: it.targeting, text: it.text,
  }));
}
