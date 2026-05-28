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

  // ===== v4 신규 카드 (8장) =====
  { id: "a_dual",    name: "쌍검",        emoji: "⚔️", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 6, hits: 2 }, text: "쌍검 연타 6 데미지" },
  { id: "a_frost",   name: "얼음 창",     emoji: "❄️", type: "attack", targeting: "enemy",  copies: 2,
    effect: { damage: 3, applyStatus: { stun: 1 } }, text: "3 데미지 + 기절(1턴)" },
  { id: "d_dodge",   name: "회피",        emoji: "💨", type: "defense", reactsTo: ["attack"], copies: 2,
    effect: { negateDamage: true }, text: "공격 완전 무효" },
  { id: "r_thorns",  name: "가시 갑옷",   emoji: "🌵", type: "reaction", reactsTo: ["attack"], copies: 2,
    effect: { halveDamage: true, reflectDamage: 2 }, text: "데미지 절반 + 반사 2" },
  { id: "s_steal",   name: "강탈",        emoji: "🪙", type: "support", targeting: "enemy", copies: 2,
    effect: { stealCard: 1 }, text: "적 손패 1장 랜덤 훔치기" },
  { id: "s_focus",   name: "집중",        emoji: "🧘", type: "support", targeting: "self",  copies: 2,
    effect: { applyStatus: { rage: 1 } }, text: "다음 공격 +3 데미지" },
  { id: "x_revival", name: "응급처치",    emoji: "💉", type: "special", targeting: "ally",  copies: 1,
    effect: { healTarget: 8 }, text: "대상 +8 HP" },
  { id: "x_chaos",   name: "혼돈의 외침", emoji: "🌀", type: "special", targeting: "self",  copies: 1,
    effect: { shuffleAllHands: true }, text: "전원 손패 셔플 + 5장 재분배" },
];

// === 다국어 wrapper — 카드 이름/효과 설명 lang별 ===
// id 매핑으로 ko의 effect를 그대로 사용. name/text만 lang별 변경.
const CARD_I18N = {
  ja: {
    a_club:    { name: "棍棒",         text: "3ダメージ" },
    a_knife:   { name: "ナイフ突き",    text: "4ダメージ" },
    a_fire:    { name: "ファイアボール", text: "5ダメージ + 火傷(2ターン)" },
    a_arrow:   { name: "毒矢",         text: "2ダメージ + 毒(3ターン)" },
    a_thunder: { name: "雷",           text: "6ダメージ (反応不可)" },
    a_pebble:  { name: "小石",         text: "誰でも2ダメージ (味方可)" },
    a_combo:   { name: "連続攻撃",      text: "2回攻撃、合計5ダメージ" },
    a_snipe:   { name: "狙撃",         text: "7ダメージ (反応不可)" },
    a_bomb:    { name: "爆弾",         text: "対象4ダメージ + 周囲2ダメージ" },
    a_bleed:   { name: "斬り",         text: "2ダメージ + 出血(3ターン)" },
    a_volley:  { name: "広域の矢",      text: "対象2 + 周囲2 (全体広域)" },
    a_execute: { name: "処刑",         text: "4ダメージ、対象HP8以下なら+6" },
    a_recoil:  { name: "無謀な突撃",    text: "7ダメージ、自分も1被害" },
    d_shield:  { name: "盾",           text: "受ける被害半分" },
    d_dodge:   { name: "回避",         text: "攻撃完全無効" },
    d_barrier: { name: "バリア",        text: "受ける被害-3" },
    d_void:    { name: "無効化",        text: "ダメージ+状態異常全て無効" },
    d_charge:  { name: "チャージ姿勢",    text: "2ターン間受ける全被害-2" },
    d_ward:    { name: "結界",         text: "チーム全員に次の攻撃1回無効" },
    r_counter: { name: "カウンター",     text: "被害を防ぎ攻撃者に3ダメージ" },
    r_protect: { name: "保護",         text: "味方の代わりに被害を受ける" },
    r_mirror:  { name: "ミラー",        text: "被害を攻撃者にそのまま反射" },
    r_absorb:  { name: "吸収",         text: "攻撃無効 + そのカードを手札へ" },
    r_disable: { name: "無力化",        text: "攻撃無効 + 攻撃者沈黙(2ターン)" },
    s_heal:    { name: "応急治療",      text: "味方1人 +4 HP" },
    s_bigheal: { name: "回復魔法",      text: "味方1人 +7 HP" },
    s_cleanse: { name: "解毒",         text: "味方1人 状態異常全除去" },
    s_draw:    { name: "カード補給",     text: "カード2枚ドロー" },
    s_buff:    { name: "戦闘の雄叫び",   text: "次の攻撃+3ダメージ(2ターン)" },
    s_lifesteal: { name: "吸血の術",    text: "2ターン間攻撃時に半分回復" },
    x_lucky:   { name: "運ゲー",        text: "50%: 20ダメージ / 50%: 失敗" },
    x_stun:    { name: "気絶",         text: "対象次のターン行動不可" },
    x_silence: { name: "沈黙",         text: "対象特殊カード使用不可(2ターン)" },
    x_swap:    { name: "手札交換",      text: "対象と手札交換" },
    x_chaos:   { name: "運ゲー乱闘",     text: "ランダムイベント即時発動" },
    x_steal:   { name: "カード強奪",     text: "対象の手札1枚ランダム取得" },
    x_burn:    { name: "手札焼却",      text: "対象の手札1枚ランダム破壊" },
    x_swaphp:  { name: "運命交換",      text: "対象とHP交換" },
    x_nuke:    { name: "核爆弾",       text: "全員(自分含む)5ダメージ" },
    a_dual:    { name: "双剣",         text: "双剣連打6ダメージ" },
    a_frost:   { name: "氷の槍",       text: "3ダメージ + 気絶(1ターン)" },
    r_thorns:  { name: "棘の鎧",       text: "ダメージ半分 + 反射2" },
    s_steal:   { name: "強奪",         text: "敵手札1枚ランダム強奪" },
    s_focus:   { name: "集中",         text: "次の攻撃+3ダメージ" },
    x_revival: { name: "応急処置",      text: "対象 +8 HP" },
  },
  en: {
    a_club:    { name: "Club",          text: "3 damage" },
    a_knife:   { name: "Knife Stab",    text: "4 damage" },
    a_fire:    { name: "Fireball",      text: "5 damage + Burn (2 turns)" },
    a_arrow:   { name: "Poison Arrow",  text: "2 damage + Poison (3 turns)" },
    a_thunder: { name: "Lightning",     text: "6 damage (cannot react)" },
    a_pebble:  { name: "Pebble",        text: "2 damage to anyone (ally allowed)" },
    a_combo:   { name: "Combo Attack",  text: "2 hits, total 5 damage" },
    a_snipe:   { name: "Snipe",         text: "7 damage (cannot react)" },
    a_bomb:    { name: "Bomb",          text: "Target 4 dmg + splash 2" },
    a_bleed:   { name: "Slash",         text: "2 damage + Bleed (3 turns)" },
    a_volley:  { name: "Arrow Volley",  text: "Target 2 + adjacent 2 (AoE)" },
    a_execute: { name: "Execute",       text: "4 dmg, +6 if target HP ≤8" },
    a_recoil:  { name: "Reckless Charge", text: "7 dmg, self 1 dmg" },
    d_shield:  { name: "Shield",        text: "Halve incoming damage" },
    d_dodge:   { name: "Dodge",         text: "Negate attack" },
    d_barrier: { name: "Barrier",       text: "Incoming damage -3" },
    d_void:    { name: "Nullify",       text: "Negate damage + status" },
    d_charge:  { name: "Charge Stance", text: "Incoming dmg -2 for 2 turns" },
    d_ward:    { name: "Ward",          text: "Team: negate next attack" },
    r_counter: { name: "Counter",       text: "Negate dmg + 3 dmg to attacker" },
    r_protect: { name: "Protect",       text: "Take damage for ally" },
    r_mirror:  { name: "Mirror",        text: "Reflect damage to attacker" },
    r_absorb:  { name: "Absorb",        text: "Negate atk + take card to hand" },
    r_disable: { name: "Disable",       text: "Negate atk + silence attacker (2 turns)" },
    s_heal:    { name: "First Aid",     text: "+4 HP to ally" },
    s_bigheal: { name: "Heal Magic",    text: "+7 HP to ally" },
    s_cleanse: { name: "Cleanse",       text: "Remove all status from ally" },
    s_draw:    { name: "Card Supply",   text: "Draw 2 cards" },
    s_buff:    { name: "Battle Cry",    text: "Next attack +3 dmg (2 turns)" },
    s_lifesteal: { name: "Lifesteal",   text: "Heal half of damage dealt (2 turns)" },
    x_lucky:   { name: "Lucky Trash",   text: "50%: 20 dmg / 50%: fail" },
    x_stun:    { name: "Stun",          text: "Target skip next turn" },
    x_silence: { name: "Silence",       text: "Target cannot use special cards (2 turns)" },
    x_swap:    { name: "Hand Swap",     text: "Swap hand with target" },
    x_chaos:   { name: "Chaos",         text: "Trigger random event" },
    x_steal:   { name: "Steal Card",    text: "Take 1 random card from target" },
    x_burn:    { name: "Burn Hand",     text: "Destroy 1 random card from target" },
    x_swaphp:  { name: "Fate Swap",     text: "Swap HP with target" },
    x_nuke:    { name: "Nuke",          text: "Everyone (incl. self) 5 damage" },
    a_dual:    { name: "Dual Blades",   text: "Dual hit 6 damage" },
    a_frost:   { name: "Frost Spear",   text: "3 dmg + Stun (1 turn)" },
    r_thorns:  { name: "Thorn Armor",   text: "Halve dmg + reflect 2" },
    s_steal:   { name: "Steal",         text: "Steal 1 random card from enemy" },
    s_focus:   { name: "Focus",         text: "Next attack +3 damage" },
    x_revival: { name: "Revival",       text: "+8 HP to target" },
  },
};
// id에 v4 신규 추가된 'x_chaos' (혼돈의 외침) override
CARD_I18N.ja.x_chaos = { name: "混沌の叫び", text: "全員手札シャッフル + 5枚再配布" };
CARD_I18N.en.x_chaos = { name: "Chaos Cry", text: "Shuffle all hands + redeal 5" };

// 다국어 카드 정의 (lang별 name/text만 변경)
export function getCardI18n(id, lang = "ko") {
  const baseCard = CARD_MAP.get(id);
  if (!baseCard) return null;
  if (lang === "ko") return baseCard;
  const i18n = CARD_I18N[lang]?.[id];
  if (!i18n) return baseCard;
  return { ...baseCard, name: i18n.name, text: i18n.text };
}

// lang별 공개 카드 리스트 (클라이언트 표시용)
export function publicCardListByLang(lang = "ko") {
  return CARDS.map(c => {
    const i18n = lang !== "ko" ? CARD_I18N[lang]?.[c.id] : null;
    return {
      id: c.id,
      name: i18n?.name || c.name,
      emoji: c.emoji,
      type: c.type,
      targeting: c.targeting || null,
      reactsTo: c.reactsTo || null,
      text: i18n?.text || c.text,
      pierce: !!c.pierce,
    };
  });
}

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
