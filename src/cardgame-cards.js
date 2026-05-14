// =========================
// DUO GAME ZONE — 난장 카드게임 카드 풀 (40장) v20260515_1
// 갓필드 / 초딩 카드게임 감성, 반응 스택 시스템
// =========================
//
// type:
//   'attack'    — 공격 (대상 1명, 반응 윈도우 열림)
//   'defense'   — 방어 (반응 전용, 자기가 공격받을 때만)
//   'reaction'  — 반응 (조건부, 회피/보호/반격)
//   'support'   — 지원 (즉시 발동, 반응 없음)
//   'special'   — 특수/억까 (즉시 발동, 랜덤성)
//
// targeting:
//   'enemy'  — 적 1명 선택
//   'ally'   — 아군 1명 선택 (자기 포함)
//   'self'   — 자기 자신
//   'any'    — 살아있는 누구든 1명
//   'all_enemy' — 적 전체
//   'random' — 서버가 랜덤 선택
//
// reactsTo:
//   ['attack']            — 자기가 공격 대상일 때만 사용 가능
//   ['attack:targetTeam'] — 아군이 공격받을 때도 사용 가능 (보호)
//   ['attack:anyone']     — 누구든 공격받을 때 (개입)
//
// effect: 서버 cardgame.js engine에서 해석. 클라이언트는 표시용 텍스트만 참조.

export const CARDS = [
  // ===== 공격 카드 =====
  { id: "a_club",    name: "몽둥이",      emoji: "🏑", type: "attack", targeting: "enemy",  copies: 4,
    effect: { damage: 3 }, text: "3 데미지" },
  { id: "a_knife",   name: "칼찌르기",    emoji: "🔪", type: "attack", targeting: "enemy",  copies: 4,
    effect: { damage: 4 }, text: "4 데미지" },
  { id: "a_fire",    name: "화염구",      emoji: "🔥", type: "attack", targeting: "enemy",  copies: 3,
    effect: { damage: 5, applyStatus: { burn: 2 } }, text: "5 데미지 + 화상(2턴)" },
  { id: "a_arrow",   name: "독화살",      emoji: "🏹", type: "attack", targeting: "enemy",  copies: 3,
    effect: { damage: 2, applyStatus: { poison: 3 } }, text: "2 데미지 + 독(3턴)" },
  { id: "a_thunder", name: "벼락",        emoji: "⚡", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 6 }, text: "6 데미지 (반응 불가)", pierce: true },
  { id: "a_pebble",  name: "조약돌",      emoji: "🪨", type: "attack", targeting: "any",    copies: 3,
    effect: { damage: 2 }, text: "아무에게나 2 데미지 (아군 가능)" },
  // (신규)
  { id: "a_combo",   name: "연속공격",    emoji: "🤜", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 5, hits: 2 }, text: "2회 공격, 합산 5 데미지" },
  { id: "a_snipe",   name: "저격",        emoji: "🎯", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 7 }, text: "7 데미지 (반응 불가)", pierce: true },
  { id: "a_bomb",    name: "폭탄",        emoji: "💣", type: "attack", targeting: "enemy",  copies: 1,
    effect: { damage: 4, splash: 2 }, text: "대상 4 데미지 + 주변 2 데미지" },
  { id: "a_bleed",   name: "베기",        emoji: "🩸", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 2, applyStatus: { bleed: 3 } }, text: "2 데미지 + 출혈(3턴)" },
  // (v3 신규)
  { id: "a_volley",  name: "광역 화살",   emoji: "🏹", type: "attack", targeting: "enemy",  copies: 1,
    effect: { damage: 2, splash: 2 }, text: "대상 2 + 주변 적 2 (전체 광역)" },
  { id: "a_execute", name: "처형",        emoji: "⚰️", type: "attack", targeting: "enemy",  copies: 1,
    effect: { damage: 4, executeBonus: { threshold: 8, bonus: 6 } }, text: "4 데미지, 대상 HP 8 이하면 +6" },
  { id: "a_recoil",  name: "무모한 돌격", emoji: "🐗", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 7, selfDamage: 1 }, text: "7 데미지, 자기도 1 피해" },

  // ===== 방어 카드 (반응 전용) =====
  { id: "d_shield",  name: "방패",        emoji: "🛡️", type: "defense", reactsTo: ["attack"], copies: 4,
    effect: { halveDamage: true }, text: "받는 피해 절반" },
  { id: "d_dodge",   name: "회피",        emoji: "💨", type: "defense", reactsTo: ["attack"], copies: 3,
    effect: { negateDamage: true }, text: "공격 무효" },
  // (신규)
  { id: "d_barrier", name: "보호막",      emoji: "🟦", type: "defense", reactsTo: ["attack"], copies: 2,
    effect: { reduceDamage: 3 }, text: "받는 피해 -3" },
  { id: "d_void",    name: "무효화",      emoji: "🚫", type: "defense", reactsTo: ["attack"], copies: 1,
    effect: { negateDamage: true, negateStatus: true }, text: "데미지+상태이상 모두 무효" },
  // (v3 신규) — 사전 발동 self 카드 (방어로 분류하지만 targeting=self로 즉시 사용)
  { id: "d_charge",  name: "차지 자세",   emoji: "🧱", type: "support", targeting: "self",   copies: 2,
    effect: { applyStatus: { shield_buff: 2 } }, text: "2턴간 받는 모든 피해 -2" },
  { id: "d_ward",    name: "결계",        emoji: "🔯", type: "support", targeting: "self",   copies: 1,
    effect: { teamWard: 1 }, text: "팀 전원에게 다음 공격 1회 무효" },

  // ===== 반응 카드 =====
  { id: "r_counter", name: "반격",        emoji: "⚡", type: "reaction", reactsTo: ["attack"], copies: 2,
    effect: { negateDamage: true, reflectDamage: 3 }, text: "피해 막고 공격자에게 3 데미지" },
  { id: "r_protect", name: "보호",        emoji: "💚", type: "reaction", reactsTo: ["attack:targetTeam"], copies: 2,
    effect: { redirectToSelf: true }, text: "아군 대신 피해 받기" },
  { id: "r_mirror",  name: "거울",        emoji: "🪞", type: "reaction", reactsTo: ["attack"], copies: 1,
    effect: { reflectAll: true }, text: "피해를 공격자에게 그대로 반사" },
  // (v3 신규)
  { id: "r_absorb",  name: "흡수",        emoji: "🌀", type: "reaction", reactsTo: ["attack"], copies: 1,
    effect: { negateDamage: true, absorbCard: true }, text: "공격 무효 + 그 카드를 손패로" },
  { id: "r_disable", name: "무력화",      emoji: "🙅", type: "reaction", reactsTo: ["attack"], copies: 1,
    effect: { negateDamage: true, silenceAttacker: 2 }, text: "공격 무효 + 공격자 침묵(2턴)" },

  // ===== 지원 카드 =====
  { id: "s_heal",    name: "응급치료",    emoji: "💚", type: "support", targeting: "ally",   copies: 4,
    effect: { heal: 4 }, text: "아군 1명 +4 HP" },
  { id: "s_bigheal", name: "회복마법",    emoji: "✨", type: "support", targeting: "ally",   copies: 2,
    effect: { heal: 7 }, text: "아군 1명 +7 HP" },
  { id: "s_cleanse", name: "해독",        emoji: "🧪", type: "support", targeting: "ally",   copies: 2,
    effect: { clearStatus: true }, text: "아군 1명 상태이상 모두 제거" },
  // (신규)
  { id: "s_draw",    name: "카드 보급",   emoji: "📦", type: "support", targeting: "self",   copies: 2,
    effect: { drawSelf: 2 }, text: "카드 2장 드로우" },
  { id: "s_buff",    name: "전투의 함성", emoji: "📯", type: "support", targeting: "self",   copies: 1,
    effect: { applyStatus: { rage: 2 } }, text: "다음 공격 +3 데미지(2턴)" },
  // (v3 신규)
  { id: "s_lifesteal", name: "흡혈의 술", emoji: "🦇", type: "support", targeting: "self",   copies: 1,
    effect: { applyStatus: { lifesteal: 2 } }, text: "2턴간 공격 시 가한 피해의 절반 회복" },

  // ===== 특수/억까 카드 =====
  { id: "x_lucky",   name: "운빨좆망겜",  emoji: "🎰", type: "special", targeting: "enemy",  copies: 2,
    effect: { coinflip: { onWin: { damage: 20 }, onLose: {} } }, text: "50%: 20 데미지 / 50%: 실패" },
  { id: "x_stun",    name: "기절시키기",  emoji: "💫", type: "special", targeting: "enemy",  copies: 2,
    effect: { applyStatus: { stun: 1 } }, text: "대상 다음 턴 행동 불가" },
  { id: "x_silence", name: "침묵",        emoji: "🤐", type: "special", targeting: "enemy",  copies: 1,
    effect: { applyStatus: { silence: 2 } }, text: "대상 특수 카드 사용 불가(2턴)" },
  { id: "x_swap",    name: "패바꿔치기",  emoji: "🔀", type: "special", targeting: "enemy",  copies: 1,
    effect: { swapHand: true }, text: "대상과 손패 교환" },
  { id: "x_chaos",   name: "운빨난장판",  emoji: "🎲", type: "special", targeting: "self",   copies: 1,
    effect: { triggerEvent: "random" }, text: "랜덤 이벤트 즉시 발동" },
  { id: "x_steal",   name: "카드 훔치기", emoji: "🫳", type: "special", targeting: "enemy",  copies: 1,
    effect: { stealCard: 1 }, text: "대상의 손패 1장 랜덤으로 가져옴" },
  // (신규)
  { id: "x_burn",    name: "손패 태우기", emoji: "🔥", type: "special", targeting: "enemy",  copies: 1,
    effect: { discardTarget: 1 }, text: "대상의 손패 1장 랜덤 파괴" },
  // (v3 신규)
  { id: "x_swaphp",  name: "운명 교환",   emoji: "🔄", type: "special", targeting: "enemy",  copies: 1,
    effect: { swapHp: true }, text: "대상과 HP 교환" },
  { id: "x_nuke",    name: "핵폭탄",      emoji: "☢️", type: "special", targeting: "self",   copies: 1,
    effect: { nuke: 5 }, text: "전원(자기 포함) 5 데미지" },
];

// === 덱 빌드: copies 만큼 풀어서 1차원 배열 ===
export function buildDeck() {
  const deck = [];
  for (const c of CARDS) {
    const n = c.copies || 1;
    for (let i = 0; i < n; i++) deck.push(c.id);
  }
  return deck;
}

// === 카드 ID → 카드 정의 매핑 ===
const CARD_MAP = new Map(CARDS.map(c => [c.id, c]));
export function getCard(id) { return CARD_MAP.get(id); }

// === 카드가 반응 카드로 사용 가능한지 ===
export function isReactionCard(id) {
  const c = CARD_MAP.get(id);
  if (!c) return false;
  return c.type === "defense" || c.type === "reaction";
}

// === 클라이언트로 보낼 공개 카드 정의 (effect는 숨김 아님 — 카드게임은 정보 공개) ===
export function publicCardList() {
  return CARDS.map(c => ({
    id: c.id, name: c.name, emoji: c.emoji, type: c.type,
    targeting: c.targeting || null,
    reactsTo: c.reactsTo || null,
    text: c.text,
    pierce: !!c.pierce,
  }));
}
