// =========================
// DUO 증강 서바이벌 아레나 — 게임 데이터 (2026-11-20)
// · 서버(src/sva-data.js)와 화면(js/survival/sva-data.js)이 같은 파일 (시험이 같은지 확인)
// · 이름·설명은 [한국어, 日本語, English]
// · 거리 단위: 1m = 24 (월드 좌표) · 시간: 초
// =========================
export const M = 24;
export const TICK = 0.05;              // 서버 20Hz
export const MAP = { w: 3600, h: 3600 };
export const MAX_AUGS = 6, MAX_WEAPONS = 4, MAX_PASSIVE_LV = 5, MAX_WEAPON_LV = 5, MAX_LEGEND = 2;
export const CAP = { speed: 330, aspd: 2.2, dr: 0.6, crit: 0.75, area: 2.2, atk: 4, lifestealPerSec: 0.06 };
export const GAME_LEN = { 15: 900, 10: 600, 5: 300 };
export const MODES = ["coop", "versus", "team"];
export const MODE_MAX = { coop: 8, versus: 8, team: 8 };
export const DIFF = {
  easy:      { hp: 0.7, dmg: 0.6, spawn: 0.8, elite: 0.6, bossHp: 0.7, bossFreq: 0.8, xp: 1.15, name: ["쉬움", "やさしい", "Easy"] },
  normal:    { hp: 1, dmg: 1, spawn: 1, elite: 1, bossHp: 1, bossFreq: 1, xp: 1, name: ["보통", "ふつう", "Normal"] },
  hard:      { hp: 1.45, dmg: 1.35, spawn: 1.2, elite: 1.5, bossHp: 1.4, bossFreq: 1.15, xp: 0.95, name: ["어려움", "むずかしい", "Hard"] },
  nightmare: { hp: 2.1, dmg: 1.8, spawn: 1.4, elite: 2.2, bossHp: 2, bossFreq: 1.3, xp: 0.9, name: ["악몽", "悪夢", "Nightmare"] },
};
// 협동 인원 보정 — 인원만큼 그대로 늘리지 않음 (8명 = 몬스터 수 ×2.9, 체력 ×1.5)
export const partyScale = (n) => { n = Math.max(1, Math.min(8, n)); return { count: 1 + 0.27 * (n - 1), hp: 1 + 0.07 * (n - 1), dmg: 1 + 0.03 * (n - 1), boss: 1 + 0.45 * (n - 1), cap: Math.min(300, 190 + 16 * (n - 1)) }; };

// ---------- 상태 이상 ----------
// dot: 초당 피해(가한 사람 공격력 비율, 몬스터→플레이어는 고정값) · max: 최대 중첩 · refresh: 다시 걸면 시간 갱신 · boss: 보스 지속시간 배율 · immune: 끝난 뒤 면역(초)
export const STATUS = {
  burn:   { dur: 3, dot: 0.15, max: 1, refresh: true, boss: 1, immune: 0, col: "#ff7a2f", name: ["화상", "火傷", "Burn"] },
  freeze: { dur: 1.2, dot: 0, max: 1, refresh: false, boss: 0, immune: 3, col: "#8fd8ff", name: ["빙결", "凍結", "Freeze"] },          // 보스는 빙결 대신 둔화
  shock:  { dur: 3, dot: 0, max: 1, refresh: true, boss: 0.6, immune: 0, vuln: 0.15, col: "#ffe14d", name: ["감전", "感電", "Shock"] },
  poison: { dur: 4, dot: 0.12, max: 3, refresh: true, boss: 1, immune: 0, col: "#7bd94a", name: ["중독", "毒", "Poison"] },
  bleed:  { dur: 4, dot: 0.1, max: 5, refresh: true, boss: 1, immune: 0, col: "#d6334a", name: ["출혈", "出血", "Bleed"] },
  slow:   { dur: 2, dot: 0, max: 1, refresh: true, boss: 0.5, immune: 0, col: "#6fa8ff", name: ["둔화", "鈍化", "Slow"] },
  stun:   { dur: 1, dot: 0, max: 1, refresh: false, boss: 0.3, immune: 5, col: "#fff2a8", name: ["기절", "気絶", "Stun"] },
  curse:  { dur: 5, dot: 0, max: 1, refresh: true, boss: 0.5, immune: 0, vuln: 0.2, col: "#b34dff", name: ["저주", "呪い", "Curse"] },
};

// ---------- 캐릭터 6 ----------
// spr: [시트, 열, 행] (td = Kenney Tiny Dungeon, cr = Tiny Creatures)
export const CHARS = {
  warrior:  { spr: ["td", 0, 8], col: "#ff8a5c", hp: 175, def: 6, speed: 158, crit: 0.05, area: 1.1, regen: 0.3, weapon: "sword",
    q: { id: "bash", cd: 10 }, e: { id: "roar", cd: 18 },
    name: ["전사", "戦士", "Warrior"], desc: ["높은 체력과 방어. 근접 공격 강화", "高い体力と防御。近接強化", "High HP and armor, strong melee"],
    qn: ["방패 돌진", "シールドチャージ", "Shield Bash"], en: ["전투 함성", "ウォークライ", "War Cry"],
    qd: ["앞으로 돌진하며 200% 피해·밀치기·기절 0.6초", "前へ突進し200%ダメージ・ノックバック・気絶0.6秒", "Charge forward: 200% damage, knockback, 0.6s stun"],
    ed: ["6초간 받는 피해 -30%, 주변 적 둔화", "6秒間被ダメージ-30%、周囲の敵を鈍化", "6s: -30% damage taken, slow nearby foes"] },
  archer:   { spr: ["td", 4, 9], col: "#7bd94a", hp: 125, def: 1, speed: 172, crit: 0.12, area: 1, regen: 0, weapon: "bow",
    q: { id: "volley", cd: 9 }, e: { id: "trap", cd: 14 },
    name: ["궁수", "弓使い", "Archer"], desc: ["원거리·공격 속도·치명타", "遠距離・攻撃速度・クリティカル", "Ranged, attack speed, crits"],
    qn: ["부채 사격", "扇撃ち", "Fan Volley"], en: ["올가미 덫", "くくり罠", "Snare Trap"],
    qd: ["조준 방향으로 화살 9발 (각 120%)", "照準方向に矢9本(各120%)", "9 arrows toward aim (120% each)"],
    ed: ["덫 설치: 밟은 적 2초 묶기 + 200% 피해", "罠設置:踏んだ敵を2秒拘束+200%", "Place a trap: 2s root + 200% damage"] },
  mage:     { spr: ["td", 0, 7], col: "#b07bff", hp: 115, def: 1, speed: 160, crit: 0.05, area: 1.2, regen: 0, weapon: "wand",
    q: { id: "nova", cd: 10 }, e: { id: "blink", cd: 8 },
    name: ["마법사", "魔法使い", "Mage"], desc: ["범위 마법·원소·광역 피해", "範囲魔法・元素・広域ダメージ", "Area magic, elements, AoE"],
    qn: ["원소 폭발", "エレメントノヴァ", "Elemental Nova"], en: ["순간이동", "テレポート", "Blink"],
    qd: ["주변 300% 피해 + 화상", "周囲に300%ダメージ+火傷", "300% damage around you + burn"],
    ed: ["이동 방향으로 순간이동 (짧은 무적)", "移動方向へ瞬間移動(短い無敵)", "Teleport in move direction (brief invulnerability)"] },
  assassin: { spr: ["cr", 7, 6], col: "#8a8fa8", hp: 120, def: 1, speed: 186, crit: 0.15, critDmg: 0.3, area: 1, regen: 0, weapon: "dagger",
    q: { id: "shadowstab", cd: 8 }, e: { id: "smoke", cd: 15 },
    name: ["암살자", "アサシン", "Assassin"], desc: ["빠른 이동·회피·단일 폭딜", "高速移動・回避・単体高火力", "Fast, evasive, single-target burst"],
    qn: ["그림자 찌르기", "影突き", "Shadow Stab"], en: ["연막", "煙幕", "Smoke Bomb"],
    qd: ["가장 가까운 강한 적 뒤로 이동, 400% 피해 + 출혈", "近くの強敵の背後へ移動、400%+出血", "Blink behind the nearest strong foe: 400% + bleed"],
    ed: ["3초간 은신·회피 60%·이동 속도 +25%", "3秒間隠れ身・回避60%・移動速度+25%", "3s stealth, 60% evasion, +25% speed"] },
  engineer: { spr: ["td", 2, 7], col: "#ffc94d", hp: 140, def: 3, speed: 156, crit: 0.05, area: 1, regen: 0.2, weapon: "drone",
    q: { id: "turret", cd: 12 }, e: { id: "repair", cd: 16 },
    name: ["기계공", "エンジニア", "Engineer"], desc: ["드론·포탑·소환물 강화 (소환물 피해 +15%)", "ドローン・砲台・召喚強化(召喚ダメージ+15%)", "Drones & turrets (+15% summon damage)"],
    qn: ["포탑 설치", "砲台設置", "Deploy Turret"], en: ["긴급 수리", "緊急修理", "Field Repair"],
    qd: ["12초간 자동 사격 포탑 (최대 2개)", "12秒間自動射撃する砲台(最大2基)", "Auto-firing turret for 12s (max 2)"],
    ed: ["3초간 체력 25% 회복 + 보호막 10%", "3秒で体力25%回復+シールド10%", "Heal 25% over 3s + 10% shield"] },
  cleric:   { spr: ["td", 3, 8], col: "#ffe9a8", hp: 145, def: 3, speed: 158, crit: 0.05, area: 1.05, regen: 0.6, weapon: "holy",
    q: { id: "heal", cd: 12 }, e: { id: "aegis", cd: 20 },
    name: ["성직자", "聖職者", "Cleric"], desc: ["회복·보호막·팀 지원", "回復・シールド・チーム支援", "Healing, shields, team support"],
    qn: ["치유의 빛", "癒やしの光", "Healing Light"], en: ["신성 방벽", "聖なる防壁", "Holy Aegis"],
    qd: ["주변 아군 체력 20% 회복, 쓰러진 아군 부활 진행 +50%", "周囲の味方を20%回復、ダウン中の味方の蘇生+50%", "Heal nearby allies 20%; +50% revive progress"],
    ed: ["주변 아군에게 최대 체력 15% 보호막", "周囲の味方に最大体力15%のシールド", "Shield nearby allies for 15% max HP"] },
};
export const CHAR_IDS = Object.keys(CHARS);

// ---------- 능력치 강화 (레벨업) ----------
export const PASSIVES = {
  vit:    { icon: ["td", 5, 9], name: ["체력", "体力", "Vitality"], desc: ["최대 체력 +20", "最大体力+20", "+20 max HP"] },
  might:  { icon: ["td", 11, 8], name: ["힘", "力", "Might"], desc: ["공격력 +10%", "攻撃力+10%", "+10% damage"] },
  agi:    { icon: ["td", 7, 8], name: ["민첩", "敏捷", "Agility"], desc: ["공격 속도 +8%", "攻撃速度+8%", "+8% attack speed"] },
  boots:  { icon: ["td", 3, 10], name: ["신발", "ブーツ", "Boots"], desc: ["이동 속도 +6%", "移動速度+6%", "+6% move speed"] },
  armor:  { icon: ["td", 6, 8], name: ["갑옷", "鎧", "Armor"], desc: ["방어력 +3", "防御力+3", "+3 armor"] },
  magnet: { icon: ["td", 6, 9], name: ["자석", "磁石", "Magnet"], desc: ["줍는 거리 +30%", "回収範囲+30%", "+30% pickup range"] },
  luck:   { icon: ["td", 7, 9], name: ["행운", "幸運", "Luck"], desc: ["치명타 확률 +4%p", "クリ率+4%p", "+4%p crit chance"] },
  wis:    { icon: ["td", 8, 9], name: ["지혜", "知恵", "Wisdom"], desc: ["경험치 +10%", "経験値+10%", "+10% XP"] },
  regen:  { icon: ["td", 5, 10], name: ["재생", "再生", "Regen"], desc: ["초당 체력 +0.6", "毎秒体力+0.6", "+0.6 HP/s"] },
  area:   { icon: ["td", 9, 10], name: ["범위", "範囲", "Area"], desc: ["공격 범위 +8%", "攻撃範囲+8%", "+8% area"] },
};
export const PASSIVE_IDS = Object.keys(PASSIVES);

// ---------- 무기 12 + 진화 12 ----------
// lv 배열은 1~5레벨 값. dmg = 공격력 100 기준 기본 피해 · cd 초 · n 개수 · area 반경/길이(월드 단위) · pierce 관통 · kind: direct(직접)·summon(소환)·dot(지속)
export const WEAPONS = {
  sword:   { kind: "direct", type: "melee", icon: ["td", 8, 8], col: "#e8eef7", dmg: [21, 26, 32, 39, 48], cd: [1.05, 1, 0.92, 0.85, 0.78], area: [76, 82, 90, 98, 108], arc: [110, 120, 130, 140, 160], n: [1, 1, 1, 2, 2], evo: "berserker", need: "armor",
    name: ["철검", "鉄の剣", "Iron Sword"], desc: ["앞쪽 부채꼴 베기", "前方を扇状に斬る", "Arc slash in front"] },
  bow:     { kind: "direct", type: "proj", icon: ["td", 11, 10], col: "#d8b27a", dmg: [18, 22, 27, 32, 38], cd: [0.9, 0.85, 0.78, 0.72, 0.65], n: [1, 1, 2, 2, 3], spd: 620, pierce: [1, 2, 2, 3, 4], area: [6, 6, 7, 7, 8], life: 1.1, evo: "skyrain", need: "agi",
    name: ["장궁", "長弓", "Longbow"], desc: ["조준 방향 직선 화살 (관통)", "照準方向へ貫通する矢", "Piercing arrows toward aim"] },
  wand:    { kind: "direct", type: "homing", icon: ["td", 9, 10], col: "#b9a2ff", dmg: [19, 23, 27, 32, 38], cd: [0.9, 0.85, 0.8, 0.74, 0.66], n: [1, 2, 2, 3, 4], spd: 420, pierce: [0, 0, 0, 1, 1], area: [8, 8, 9, 9, 10], life: 1.6, evo: "archmage", need: "wis",
    name: ["마법 지팡이", "魔法の杖", "Magic Wand"], desc: ["가까운 적을 쫓는 마법 탄", "近くの敵を追う魔法弾", "Homing bolts at the nearest foe"] },
  dagger:  { kind: "direct", type: "stab", icon: ["td", 7, 8], col: "#c9d2de", dmg: [15, 18, 22, 26, 31], cd: [0.4, 0.38, 0.35, 0.32, 0.28], area: [74, 78, 82, 88, 94], n: [1, 1, 2, 2, 3], bleed: [0, 0, 0.3, 0.4, 0.5], evo: "shadowblade", need: "luck",
    name: ["단검", "短剣", "Dagger"], desc: ["빠른 근접 찌르기 (3레벨부터 출혈)", "高速の突き(Lv3から出血)", "Rapid stabs (bleed from Lv3)"] },
  gun:     { kind: "direct", type: "proj", icon: ["td", 10, 8], col: "#ffd66b", dmg: [6, 7, 8.5, 10, 12], cd: [0.16, 0.15, 0.13, 0.12, 0.1], n: [1, 1, 1, 2, 2], spd: 760, pierce: [0, 0, 1, 1, 1], spread: 0.16, area: [4, 4, 5, 5, 5], life: 0.8, evo: "bullethell", need: "might",
    name: ["기관총", "機関銃", "Machine Gun"], desc: ["빠른 연속 탄환", "高速連射の弾", "Rapid stream of bullets"] },
  fireball:{ kind: "direct", type: "boom", icon: ["td", 7, 9], col: "#ff7a2f", dmg: [26, 32, 40, 48, 58], cd: [1.6, 1.5, 1.4, 1.3, 1.2], n: [1, 1, 1, 2, 2], spd: 380, area: [54, 62, 70, 80, 92], life: 1.4, burn: [0.3, 0.35, 0.4, 0.5, 0.6], evo: "sunburst", need: "area",
    name: ["화염구", "ファイアボール", "Fireball"], desc: ["터지는 화염 마법 + 화상", "爆発する炎魔法+火傷", "Exploding fire magic + burn"] },
  icespear:{ kind: "direct", type: "proj", icon: ["td", 11, 10], col: "#8fd8ff", dmg: [20, 24, 29, 35, 42], cd: [1.4, 1.32, 1.24, 1.15, 1.05], n: [1, 1, 2, 2, 3], spd: 560, pierce: [99, 99, 99, 99, 99], area: [8, 9, 9, 10, 11], life: 1.2, slow: [0.3, 0.32, 0.35, 0.38, 0.4], freeze: [0, 0, 0, 0, 0.15], evo: "absolutezero", need: "boots",
    name: ["얼음창", "氷の槍", "Ice Spear"], desc: ["모두 관통 + 둔화 (5레벨 빙결)", "全貫通+鈍化(Lv5で凍結)", "Pierces all + slow (Lv5 freeze)"] },
  lightning:{ kind: "direct", type: "chain", icon: ["td", 10, 10], col: "#ffe14d", dmg: [18, 22, 26, 31, 37], cd: [1.3, 1.22, 1.14, 1.06, 0.98], n: [3, 3, 4, 5, 6], area: [190, 200, 210, 220, 240], shock: [0.2, 0.25, 0.3, 0.35, 0.4], evo: "thunder", need: "magnet",
    name: ["번개 지팡이", "雷の杖", "Lightning Staff"], desc: ["적 사이를 튀는 연쇄 번개 + 감전", "敵の間を跳ぶ連鎖雷+感電", "Chain lightning + shock"] },
  axe:     { kind: "direct", type: "orbit", icon: ["td", 10, 9], col: "#c8a27a", dmg: [14, 17, 21, 25, 30], cd: [0.5, 0.5, 0.48, 0.46, 0.44], n: [1, 2, 2, 3, 4], area: [74, 78, 84, 90, 98], evo: "whirlwind", need: "vit",
    name: ["회전 도끼", "回転斧", "Spinning Axe"], desc: ["몸 주위를 도는 도끼", "体の周りを回る斧", "Axes orbiting you"] },
  drone:   { kind: "summon", type: "drone", icon: ["cr", 1, 8], col: "#7fe0c8", dmg: [20, 24, 29, 34, 40], cd: [0.8, 0.75, 0.7, 0.65, 0.58], n: [1, 2, 2, 3, 3], spd: 560, area: [5, 5, 5, 6, 6], life: 1.0, evo: "dronearmy", need: "agi",
    name: ["드론", "ドローン", "Drone"], desc: ["자동으로 쫓아 쏘는 드론 (소환물)", "自動で追尾射撃するドローン(召喚)", "Auto-targeting drones (summon)"] },
  holy:    { kind: "direct", type: "guard", icon: ["cr", 9, 8], col: "#fff1a8", dmg: [14, 17, 20, 24, 29], cd: [0.55, 0.55, 0.5, 0.5, 0.45], n: [2, 2, 3, 3, 4], area: [58, 62, 66, 70, 76], evo: "angel", need: "regen",
    name: ["성스러운 구체", "聖なる宝珠", "Holy Orb"], desc: ["가까이 도는 구체 — 적 투사체를 막고 밀침", "近くを回る宝珠 — 敵弾を防ぎ押し返す", "Close orbs that block enemy shots and push foes"] },
  poison:  { kind: "dot", type: "pool", icon: ["td", 6, 9], col: "#8be04a", dmg: [8, 10, 12, 15, 18], cd: [2.2, 2.1, 2, 1.85, 1.7], n: [1, 1, 2, 2, 3], area: [52, 58, 64, 70, 78], dur: [3, 3.2, 3.5, 3.8, 4.2], evo: "toxicstorm", need: "luck",
    name: ["독 폭탄", "毒爆弾", "Poison Bomb"], desc: ["적 근처에 독 웅덩이 (지속 피해)", "敵の近くに毒の沼(持続ダメージ)", "Toxic pools near foes (damage over time)"] },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const EVOS = {
  berserker:    { from: "sword", dmg: 78, cd: 0.8, area: 150, arc: 360, n: 1, kind: "direct", col: "#ff5c5c", wave: true,
    name: ["광전사의 대검", "狂戦士の大剣", "Berserker Greatsword"], desc: ["360° 회전 베기 + 검기 파동", "360°回転斬り+剣気の波動", "360° spin slash + sword waves"] },
  skyrain:      { from: "bow", dmg: 40, cd: 0.6, n: 4, pierce: 5, spd: 700, area: 9, life: 1.2, rain: 6, rainArea: 46, kind: "direct", col: "#ffd27a",
    name: ["천공의 화살비", "天空の矢の雨", "Sky Arrow Rain"], desc: ["관통 화살 + 하늘에서 화살비", "貫通矢+空から矢の雨", "Piercing arrows + arrow rain from above"] },
  archmage:     { from: "wand", dmg: 32, cd: 0.6, n: 6, pierce: 1, spd: 480, area: 10, life: 1.8, blast: 46, kind: "direct", col: "#c9a8ff",
    name: ["대마법사의 지팡이", "大魔導師の杖", "Archmage Staff"], desc: ["유도탄 6발, 맞으면 작은 폭발", "誘導弾6発、命中で小爆発", "6 homing bolts with small blasts"] },
  shadowblade:  { from: "dagger", dmg: 34, cd: 0.28, area: 80, n: 3, bleed: 0.7, kind: "direct", col: "#9a7bff", warp: true,
    name: ["그림자 암살검", "影の暗殺剣", "Shadow Assassin Blade"], desc: ["적 3명을 순간 베기 + 강한 출혈", "敵3体を瞬時に斬る+強出血", "Instantly cuts 3 foes + heavy bleed"] },
  bullethell:   { from: "gun", dmg: 12, cd: 0.07, n: 3, spd: 820, pierce: 2, spread: 0.3, area: 5, life: 0.9, spiral: true, kind: "direct", col: "#ffb347",
    name: ["무한 탄막", "無限弾幕", "Endless Barrage"], desc: ["조준 연사 + 사방 나선 탄막", "照準連射+全方位の螺旋弾幕", "Aimed fire + spiral barrage"] },
  sunburst:     { from: "fireball", dmg: 70, cd: 1.1, n: 3, spd: 400, area: 120, life: 1.4, burn: 0.8, ground: 3, kind: "direct", col: "#ffcf3f",
    name: ["태양 폭발", "太陽爆発", "Sunburst"], desc: ["거대한 폭발 + 불타는 땅", "巨大爆発+燃える地面", "Huge blasts + burning ground"] },
  absolutezero: { from: "icespear", dmg: 48, cd: 1.0, n: 3, spd: 600, pierce: 99, area: 12, life: 1.2, slow: 0.5, freeze: 0.3, nova: 4, novaArea: 190, kind: "direct", col: "#bff0ff",
    name: ["절대영도", "絶対零度", "Absolute Zero"], desc: ["얼음창 + 4초마다 빙결 파동", "氷の槍+4秒ごとに凍結の波動", "Ice spears + freezing nova every 4s"] },
  thunder:      { from: "lightning", dmg: 42, cd: 0.9, n: 8, area: 260, shock: 0.6, strikes: 5, strikeArea: 52, kind: "direct", col: "#fff27a",
    name: ["천둥의 심판", "雷鳴の審判", "Thunder Judgment"], desc: ["연쇄 번개 + 낙뢰 5발", "連鎖雷+落雷5発", "Chain lightning + 5 lightning strikes"] },
  whirlwind:    { from: "axe", dmg: 34, cd: 0.4, n: 6, area: 120, pulse: true, kind: "direct", col: "#ffae5c",
    name: ["파괴의 회오리", "破壊の竜巻", "Destruction Whirlwind"], desc: ["도끼 6개, 멀어졌다 가까워지는 회오리", "斧6本、伸縮する竜巻", "6 axes in a pulsing whirlwind"] },
  dronearmy:    { from: "drone", dmg: 26, cd: 0.6, n: 5, spd: 620, area: 6, life: 1.1, missile: 44, kind: "summon", col: "#5ff0d0",
    name: ["전투 드론 군단", "戦闘ドローン軍団", "Drone Legion"], desc: ["드론 5기 + 폭발 미사일", "ドローン5機+爆発ミサイル", "5 drones firing explosive missiles"] },
  angel:        { from: "holy", dmg: 28, cd: 0.45, n: 6, area: 92, heal: 0.04, kind: "direct", col: "#fffbd0",
    name: ["천사의 수호", "天使の守護", "Angel's Guard"], desc: ["구체 6개 + 4초마다 주변 아군 회복", "宝珠6個+4秒ごとに周囲の味方を回復", "6 orbs + heals nearby allies every 4s"] },
  toxicstorm:   { from: "poison", dmg: 22, cd: 1.6, n: 3, area: 96, dur: 5, move: true, kind: "dot", col: "#b6ff5c",
    name: ["맹독 폭풍", "猛毒の嵐", "Toxic Storm"], desc: ["적을 쫓아가는 독 폭풍", "敵を追う毒の嵐", "Toxic storms that chase foes"] },
};
export const EVO_IDS = Object.keys(EVOS);
// 증강 모드 진화 공명: 이 증강을 가지고 있으면 진화 무기 피해 +25%
export const EVO_RESONANCE = { berserker: "a26", skyrain: "a16", archmage: "a30", shadowblade: "a29", bullethell: "a30", sunburst: "a12", absolutezero: "a13", thunder: "a11", whirlwind: "a32", dronearmy: "a18", angel: "a20", toxicstorm: "a14" };

// ---------- 몬스터 20 ----------
// ai: chase(추적)·weave(박쥐 갈지자)·ranged(거리 유지 사격)·lunge(달려듦)·charge(예고 돌진)·bomber(자폭)·summoner(소환)·tank(느린 방어)·shield(앞 방패)·blink(순간이동)·stealth(은신)·orbit(빙빙 돌며 사격)·phase(벽 통과 가속)·spore(포자 구름)
export const MONSTERS = {
  slime:    { spr: ["td", 0, 9], hp: 22, dmg: 6, spd: 62, r: 13, xp: 1, ai: "chase", t: 0, split: true, name: ["슬라임", "スライム", "Slime"], desc: ["죽으면 작은 슬라임 2마리로 갈라짐", "倒すと小さなスライム2匹に分裂", "Splits into 2 small slimes"] },
  goblin:   { spr: ["cr", 0, 1], hp: 18, dmg: 7, spd: 96, r: 12, xp: 1, ai: "chase", flank: true, t: 0, name: ["고블린", "ゴブリン", "Goblin"], desc: ["옆으로 돌아 둘러쌈", "横から回り込む", "Flanks around you"] },
  bat:      { spr: ["td", 0, 10], hp: 10, dmg: 5, spd: 130, r: 10, xp: 1, ai: "weave", fly: true, t: 0, name: ["박쥐", "コウモリ", "Bat"], desc: ["갈지자로 빠르게 날아옴, 장애물 무시", "ジグザグに高速飛行、障害物無視", "Fast zigzag flyer, ignores obstacles"] },
  skeleton: { spr: ["cr", 1, 0], hp: 26, dmg: 8, spd: 70, r: 12, xp: 2, ai: "ranged", range: 260, shot: { spd: 220, dmg: 5, cd: 3.2, kind: "bone" }, t: 75, name: ["스켈레톤", "スケルトン", "Skeleton"], desc: ["거리를 두고 뼈를 던짐", "距離を取って骨を投げる", "Keeps distance and throws bones"] },
  zombie:   { spr: ["cr", 0, 0], hp: 60, dmg: 11, spd: 46, r: 14, xp: 2, ai: "chase", revive: true, t: 60, name: ["좀비", "ゾンビ", "Zombie"], desc: ["한 번 되살아남 (화상·성스러운 공격엔 안 살아남)", "一度復活(火傷・聖なる攻撃では復活しない)", "Revives once (not if burned or holy-killed)"] },
  wolf:     { spr: ["cr", 3, 9], hp: 34, dmg: 10, spd: 108, r: 13, xp: 2, ai: "lunge", t: 90, name: ["늑대", "オオカミ", "Wolf"], desc: ["가까워지면 확 달려듦", "近づくと飛びかかる", "Lunges when close"] },
  spider:   { spr: ["td", 2, 10], hp: 30, dmg: 8, spd: 84, r: 13, xp: 2, ai: "ranged", range: 220, shot: { spd: 210, dmg: 4, cd: 3.4, kind: "web", st: "slow" }, t: 120, name: ["거미", "クモ", "Spider"], desc: ["거미줄로 느리게 만듦", "クモの糸で鈍化", "Webs slow you down"] },
  mushroom: { spr: ["cr", 3, 1], hp: 50, dmg: 6, spd: 34, r: 14, xp: 2, ai: "spore", t: 150, name: ["독버섯", "毒キノコ", "Toxic Shroom"], desc: ["가까이 가면 독 포자 구름", "近づくと毒の胞子雲", "Releases poison spores when near"] },
  firesp:   { spr: ["cr", 5, 4], hp: 40, dmg: 9, spd: 92, r: 13, xp: 3, ai: "chase", trail: "fire", hitSt: "burn", t: 200, name: ["불꽃 정령", "炎の精霊", "Fire Spirit"], desc: ["불길을 남기고 화상", "炎の跡を残し火傷を与える", "Leaves fire trails, burns"] },
  icesp:    { spr: ["cr", 9, 4], hp: 44, dmg: 8, spd: 80, r: 13, xp: 3, ai: "chase", hitSt: "slow", aura: "chill", t: 230, name: ["얼음 정령", "氷の精霊", "Ice Spirit"], desc: ["주변을 얼려 둔화, 겹치면 빙결", "周囲を凍らせ鈍化、重なると凍結", "Chilling aura, can freeze"] },
  boltsp:   { spr: ["cr", 8, 4], hp: 38, dmg: 9, spd: 76, r: 13, xp: 3, ai: "blink", hitSt: "shock", tint: "#ffe14d", t: 260, name: ["번개 정령", "雷の精霊", "Storm Spirit"], desc: ["번쩍 순간이동해 감전", "瞬間移動して感電させる", "Blinks in and shocks"] },
  golem:    { spr: ["cr", 7, 4], hp: 190, dmg: 18, spd: 38, r: 22, xp: 6, ai: "tank", slam: true, kbImmune: true, t: 300, name: ["돌 골렘", "ストーンゴーレム", "Stone Golem"], desc: ["단단하고 느림, 예고 후 땅 내려찍기", "硬くて遅い、予告後に叩きつけ", "Tough and slow, telegraphed ground slam"] },
  shade:    { spr: ["cr", 4, 0], hp: 46, dmg: 16, spd: 112, r: 12, xp: 4, ai: "stealth", t: 330, name: ["그림자 암살자", "影の暗殺者", "Shadow Stalker"], desc: ["보이지 않다가 가까이서 기습", "見えないまま近づき奇襲", "Invisible until it strikes"] },
  curser:   { spr: ["cr", 5, 6], hp: 52, dmg: 8, spd: 60, r: 13, xp: 4, ai: "summoner", range: 300, shot: { spd: 200, dmg: 6, cd: 3.6, kind: "curse", st: "curse" }, summon: "bat", t: 360, name: ["저주 마법사", "呪いの魔術師", "Curse Mage"], desc: ["저주탄 + 박쥐 소환", "呪い弾+コウモリ召喚", "Curse bolts + summons bats"] },
  bomber:   { spr: ["cr", 1, 1], hp: 28, dmg: 26, spd: 104, r: 13, xp: 3, ai: "bomber", t: 240, name: ["폭탄 고블린", "爆弾ゴブリン", "Bomb Goblin"], desc: ["달려와 1초 뒤 자폭", "駆け寄り1秒後に自爆", "Runs in and explodes after 1s"] },
  boar:     { spr: ["cr", 0, 16], hp: 70, dmg: 16, spd: 70, r: 15, xp: 4, ai: "charge", t: 280, name: ["돌진 멧돼지", "突進イノシシ", "Charging Boar"], desc: ["예고 후 일직선 돌진", "予告後に一直線に突進", "Telegraphed straight charge"] },
  knight:   { spr: ["td", 1, 8], hp: 110, dmg: 13, spd: 54, r: 15, xp: 5, ai: "shield", t: 420, name: ["방패 기사", "盾の騎士", "Shield Knight"], desc: ["앞에서 오는 공격 70% 막음", "正面からの攻撃を70%防ぐ", "Blocks 70% from the front"] },
  scorpion: { spr: ["cr", 5, 14], hp: 58, dmg: 10, spd: 88, r: 14, xp: 4, ai: "chase", hitSt: "poison", t: 450, name: ["독 전갈", "毒サソリ", "Venom Scorpion"], desc: ["독 중첩", "毒が重なる", "Stacking poison"] },
  mdrone:   { spr: ["cr", 0, 8], hp: 48, dmg: 7, spd: 120, r: 12, xp: 4, ai: "orbit", fly: true, range: 230, shot: { spd: 300, dmg: 5, cd: 2.4, kind: "laser", burst: 3 }, t: 500, name: ["기계 드론", "機械ドローン", "Mech Drone"], desc: ["빙빙 돌며 3연발 레이저", "周回しながら3連レーザー", "Circles and fires 3-shot lasers"] },
  voidst:   { spr: ["cr", 5, 7], hp: 120, dmg: 20, spd: 80, r: 15, xp: 8, ai: "phase", hitSt: "curse", t: 620, name: ["공허의 추적자", "虚空の追跡者", "Void Stalker"], desc: ["벽을 통과하며 점점 빨라짐", "壁をすり抜け徐々に加速", "Phases through walls, accelerates"] },
};
export const MON_IDS = Object.keys(MONSTERS);

// ---------- 보스 10 ----------
// pats: 페이즈별 패턴 (1: 기본 · 2: 70% 이하 강화 · 3: 35% 이하 광폭화)
export const BOSSES = {
  slimeking: { spr: ["td", 0, 9], scale: 6, hp: 2600, dmg: 18, spd: 64, r: 52, tier: 1, col: "#5fe08a", crown: true,
    pats: [["jump", "pool", "shock"], ["jump", "pool", "shock", "split"], ["jump2", "pool", "shock2", "split"]],
    name: ["슬라임 킹", "スライムキング", "Slime King"], desc: ["분열·점액 장판·점프·충격파", "分裂・粘液床・ジャンプ・衝撃波", "Split, slime pools, jump, shockwave"] },
  goblord:   { spr: ["cr", 4, 12], scale: 5, hp: 3000, dmg: 20, spd: 92, r: 42, tier: 1, col: "#7bd94a",
    pats: [["summon", "bombs", "charge"], ["summon", "bombs", "charge", "rally"], ["summon2", "bombs2", "charge2", "rally"]],
    name: ["고블린 군주", "ゴブリンロード", "Goblin Warlord"], desc: ["부하 소환·폭탄 투척·돌진·부하 강화", "手下召喚・爆弾投げ・突進・手下強化", "Summons, bomb volleys, charge, rally"] },
  spiderq:   { spr: ["td", 2, 10], scale: 6, hp: 2800, dmg: 18, spd: 82, r: 50, tier: 1, col: "#b06bff", crown: true,
    pats: [["webfan", "poisonpool", "eggs"], ["webfan", "poisonpool", "eggs", "grab"], ["webfan2", "poisonpool", "eggs", "grab"]],
    name: ["거미 여왕", "クモの女王", "Spider Queen"], desc: ["거미줄·독 장판·알 소환·포획", "クモの糸・毒床・卵召喚・捕獲", "Webs, poison pools, eggs, grab"] },
  dragon:    { spr: ["cr", 3, 3], scale: 6, hp: 5200, dmg: 26, spd: 88, r: 54, tier: 2, col: "#ff5c3a",
    pats: [["breath", "meteor", "dash"], ["breath", "meteor", "dash", "firefloor"], ["breath2", "meteor2", "dash", "firefloor"]],
    name: ["화염 드래곤", "炎のドラゴン", "Flame Dragon"], desc: ["화염 브레스·메테오·돌진·화염 장판", "炎ブレス・メテオ・突進・炎床", "Breath, meteors, dash, fire floor"] },
  icequeen:  { spr: ["cr", 6, 2], scale: 5, hp: 4800, dmg: 24, spd: 76, r: 42, tier: 2, col: "#8fd8ff", tint: "#9fe4ff", crown: true,
    pats: [["frostnova", "icespears", "icewall"], ["frostnova", "icespears", "icewall", "blizzard"], ["frostnova2", "icespears2", "icewall", "blizzard"]],
    name: ["얼음 여왕", "氷の女王", "Ice Queen"], desc: ["빙결·얼음창·얼음 벽·눈보라", "凍結・氷の槍・氷の壁・吹雪", "Freeze, ice spears, ice walls, blizzard"] },
  boltgolem: { spr: ["cr", 8, 12], scale: 5, hp: 5600, dmg: 26, spd: 58, r: 50, tier: 2, col: "#ffe14d", tint: "#ffe98a",
    pats: [["strikes", "elecfloor", "chainbolt"], ["strikes", "elecfloor", "chainbolt", "shock"], ["strikes2", "elecfloor", "chainbolt", "shock2"]],
    name: ["번개 골렘", "雷のゴーレム", "Thunder Golem"], desc: ["낙뢰·전기 장판·연쇄 번개·충격파", "落雷・電気床・連鎖雷・衝撃波", "Strikes, electric floor, chain bolt, shockwave"] },
  reaper:    { spr: ["cr", 9, 1], scale: 5, hp: 5000, dmg: 28, spd: 96, r: 40, tier: 2, col: "#9a7bff",
    pats: [["teleport", "scythe", "clones"], ["teleport", "scythe", "clones", "darkness"], ["teleport2", "scythe2", "clones", "darkness"]],
    name: ["그림자 사신", "影の死神", "Shadow Reaper"], desc: ["순간이동·그림자 분신·낫 공격·어둠 장막", "瞬間移動・影の分身・鎌攻撃・闇の帳", "Teleport, clones, scythe, darkness"] },
  mechlord:  { spr: ["cr", 7, 9], scale: 5, hp: 8200, dmg: 30, spd: 70, r: 46, tier: 3, col: "#7fe0c8",
    pats: [["laser", "drones", "missiles"], ["laser", "drones", "missiles", "barrier"], ["laser2", "drones", "missiles2", "barrier"]],
    name: ["기계 군주", "機械の君主", "Mech Overlord"], desc: ["레이저·드론 소환·미사일·방어막", "レーザー・ドローン召喚・ミサイル・バリア", "Laser, drones, missiles, barrier"] },
  dokkaebi:  { spr: ["cr", 3, 12], scale: 6, hp: 8600, dmg: 32, spd: 80, r: 50, tier: 3, col: "#ff6b6b",
    pats: [["club", "talisman", "clones"], ["club", "talisman", "clones", "giant"], ["club2", "talisman2", "clones", "giant"]],
    name: ["도깨비 대왕", "トッケビ大王", "Dokkaebi King"], desc: ["도깨비 방망이·분신·부적·거대화", "トッケビの棍棒・分身・お札・巨大化", "Magic club, clones, talismans, giant form"] },
  voidlord:  { spr: ["cr", 5, 0], scale: 6, hp: 9800, dmg: 34, spd: 78, r: 50, tier: 3, col: "#c04dff", tint: "#d58cff",
    pats: [["blackhole", "rift", "mix"], ["blackhole", "rift", "mix", "rift2"], ["blackhole2", "rift2", "mix", "mix"]],
    name: ["공허의 지배자", "虚空の支配者", "Void Sovereign"], desc: ["블랙홀·차원 균열·다른 보스 패턴 조합·최종 광폭화", "ブラックホール・次元の裂け目・他ボスの技・最終暴走", "Black hole, rifts, borrowed patterns, final enrage"] },
};
export const BOSS_IDS = Object.keys(BOSSES);
export const BOSS_TIER = { 1: ["slimeking", "goblord", "spiderq"], 2: ["dragon", "icequeen", "boltgolem", "reaper"], 3: ["mechlord", "dokkaebi", "voidlord"] };
// 보스 패턴 이름 (화면 경고 문구)
export const PAT_NAME = {
  jump: ["점프 공격", "ジャンプ攻撃", "Jump Slam"], jump2: ["연속 점프", "連続ジャンプ", "Triple Jump"], pool: ["점액 장판", "粘液床", "Slime Pools"], shock: ["충격파", "衝撃波", "Shockwave"], shock2: ["이중 충격파", "二重衝撃波", "Double Shockwave"], split: ["분열", "分裂", "Split"],
  summon: ["부하 소환", "手下召喚", "Summon Minions"], summon2: ["대규모 소환", "大量召喚", "Mass Summon"], bombs: ["폭탄 투척", "爆弾投げ", "Bomb Volley"], bombs2: ["폭탄 비", "爆弾の雨", "Bomb Rain"], charge: ["돌진", "突進", "Charge"], charge2: ["연속 돌진", "連続突進", "Triple Charge"], rally: ["부하 강화", "手下強化", "Rally"],
  webfan: ["거미줄 발사", "クモの糸", "Web Fan"], webfan2: ["거미줄 폭풍", "クモの糸の嵐", "Web Storm"], poisonpool: ["독 장판", "毒床", "Poison Pools"], eggs: ["알 소환", "卵召喚", "Egg Clutch"], grab: ["포획", "捕獲", "Grab"],
  breath: ["화염 브레스", "炎ブレス", "Flame Breath"], breath2: ["회전 브레스", "回転ブレス", "Sweeping Breath"], meteor: ["메테오", "メテオ", "Meteors"], meteor2: ["메테오 폭풍", "メテオの嵐", "Meteor Storm"], dash: ["돌진", "突進", "Dash"], firefloor: ["화염 장판", "炎床", "Fire Floor"],
  frostnova: ["빙결 파동", "凍結の波動", "Frost Nova"], frostnova2: ["이중 빙결 파동", "二重凍結波動", "Double Frost Nova"], icespears: ["얼음창", "氷の槍", "Ice Spears"], icespears2: ["얼음창 소나기", "氷槍の雨", "Ice Spear Barrage"], icewall: ["얼음 벽", "氷の壁", "Ice Walls"], blizzard: ["눈보라", "吹雪", "Blizzard"],
  strikes: ["낙뢰", "落雷", "Lightning Strikes"], strikes2: ["낙뢰 폭풍", "落雷の嵐", "Thunderstorm"], elecfloor: ["전기 장판", "電気床", "Electric Floor"], chainbolt: ["연쇄 번개", "連鎖雷", "Chain Bolt"],
  teleport: ["순간이동", "瞬間移動", "Teleport Strike"], teleport2: ["연속 순간이동", "連続瞬間移動", "Phantom Strikes"], scythe: ["낫 공격", "鎌攻撃", "Scythe Sweep"], scythe2: ["회전 낫", "回転鎌", "Scythe Whirl"], clones: ["분신", "分身", "Clones"], darkness: ["어둠 장막", "闇の帳", "Darkness"],
  laser: ["레이저", "レーザー", "Laser Sweep"], laser2: ["이중 레이저", "二重レーザー", "Twin Lasers"], drones: ["드론 소환", "ドローン召喚", "Drone Swarm"], missiles: ["미사일", "ミサイル", "Missiles"], missiles2: ["미사일 폭격", "ミサイル爆撃", "Missile Barrage"], barrier: ["방어막", "バリア", "Barrier"],
  club: ["도깨비 방망이", "トッケビの棍棒", "Magic Club"], club2: ["방망이 연타", "棍棒の連打", "Club Fury"], talisman: ["부적 공격", "お札攻撃", "Talismans"], talisman2: ["부적 소용돌이", "お札の渦", "Talisman Spiral"], giant: ["거대화", "巨大化", "Giant Form"],
  blackhole: ["블랙홀", "ブラックホール", "Black Hole"], blackhole2: ["거대 블랙홀", "巨大ブラックホール", "Great Black Hole"], rift: ["차원 균열", "次元の裂け目", "Dimension Rift"], rift2: ["차원 붕괴", "次元崩壊", "Rift Collapse"], mix: ["패턴 조합", "技の融合", "Pattern Fusion"],
};

// ---------- 증강 40 ----------
// cat: atk(공격)·def(방어)·move(이동)·elem(원소)·summon(소환)·support(지원)·special(특수)
// v: 수치 (서버 로직이 그대로 씀) — 밸런스는 여기만 고치면 됨
export const RARITY_W = { common: 50, rare: 30, epic: 15, legendary: 5 };
export const RARITY_NAME = { common: ["일반", "コモン", "Common"], rare: ["희귀", "レア", "Rare"], epic: ["영웅", "エピック", "Epic"], legendary: ["전설", "レジェンド", "Legendary"] };
export const CAT_NAME = { atk: ["공격", "攻撃", "Attack"], def: ["방어", "防御", "Defense"], move: ["이동", "移動", "Movement"], elem: ["원소", "元素", "Element"], summon: ["소환", "召喚", "Summon"], support: ["지원", "支援", "Support"], special: ["특수", "特殊", "Special"] };
export const AUGS = [
  // 일반 10
  { id: "a01", r: "common", cat: "atk", ico: "blade", v: { dmg: 0.12 }, name: ["날카로운 칼날", "鋭い刃", "Sharp Blade"], desc: ["모든 직접 공격 피해 +12%", "すべての直接攻撃ダメージ+12%", "+12% direct attack damage"] },
  { id: "a02", r: "common", cat: "move", ico: "boot", v: { spd: 0.10 }, name: ["신속한 발걸음", "素早い足取り", "Swift Steps"], desc: ["이동 속도 +10%", "移動速度+10%", "+10% move speed"] },
  { id: "a03", r: "common", cat: "def", ico: "armor", v: { dr: 0.10 }, name: ["튼튼한 갑옷", "頑丈な鎧", "Sturdy Armor"], desc: ["받는 최종 피해 -10%", "最終被ダメージ-10%", "-10% damage taken"] },
  { id: "a04", r: "common", cat: "atk", ico: "hand", v: { cd: 0.10 }, name: ["빠른 손놀림", "素早い手さばき", "Quick Hands"], desc: ["무기 공격 주기 -10%", "武器の攻撃間隔-10%", "-10% weapon cooldown"] },
  { id: "a05", r: "common", cat: "def", ico: "heart", v: { hp: 20 }, name: ["생명의 샘", "命の泉", "Fountain of Life"], desc: ["최대 체력 +20, 현재 체력 +20", "最大体力+20、現在体力+20", "+20 max HP and heal 20"] },
  { id: "a06", r: "common", cat: "atk", ico: "star", v: { crit: 0.05 }, name: ["행운의 별", "幸運の星", "Lucky Star"], desc: ["치명타 확률 +5%p", "クリティカル率+5%p", "+5%p crit chance"] },
  { id: "a07", r: "common", cat: "special", ico: "gem", v: { xp: 0.15 }, name: ["경험치 수집가", "経験値コレクター", "XP Collector"], desc: ["경험치 획득 +15%", "経験値獲得+15%", "+15% XP gained"] },
  { id: "a08", r: "common", cat: "atk", ico: "wide", v: { area: 0.12 }, name: ["넓은 공격", "広い攻撃", "Wide Swing"], desc: ["근접·범위 공격 반경 +12%", "近接・範囲攻撃の半径+12%", "+12% melee & AoE radius"] },
  { id: "a09", r: "common", cat: "def", ico: "bubble", v: { every: 30, pct: 0.10, max: 0.20 }, name: ["작은 보호막", "小さなシールド", "Small Shield"], desc: ["30초마다 최대 체력 10% 보호막 (최대 20%)", "30秒ごとに最大体力10%のシールド(最大20%)", "Every 30s: shield 10% max HP (cap 20%)"] },
  { id: "a10", r: "common", cat: "move", ico: "run", v: { th: 0.30, spd: 0.15 }, name: ["끈질긴 생존", "しぶとい生存", "Stubborn Survival"], desc: ["체력 30% 이하일 때 이동 속도 +15%", "体力30%以下で移動速度+15%", "+15% speed below 30% HP"] },
  // 희귀 10
  { id: "a11", r: "rare", cat: "elem", ico: "chain", v: { every: 5, n: 3, mult: 0.45, range: 170 }, name: ["연쇄 번개", "連鎖雷", "Chain Lightning"], desc: ["직접 공격 5번 적중마다 주변 3명에게 45% 번개", "直接攻撃5回命中ごとに周囲3体へ45%の雷", "Every 5 direct hits: 45% lightning to 3 nearby"] },
  { id: "a12", r: "rare", cat: "elem", ico: "boom", v: { ch: 0.15, rad: 2.5 * M, mult: 0.8 }, name: ["화염 폭발", "火炎爆発", "Flame Burst"], desc: ["처치 시 15% 확률로 반경 2.5m 폭발 (80%)", "撃破時15%で半径2.5mの爆発(80%)", "On kill: 15% chance of 2.5m blast (80%)"] },
  { id: "a13", r: "rare", cat: "def", ico: "ice", v: { slow: 0.25, dur: 1.5, icd: 8, bossSlow: 0.1 }, name: ["얼음 갑옷", "氷の鎧", "Frost Armor"], desc: ["맞으면 공격자 1.5초간 25% 둔화 (8초마다)", "被弾時に攻撃者を1.5秒25%鈍化(8秒ごと)", "When hit: slow attacker 25% for 1.5s (8s cd)"] },
  { id: "a14", r: "rare", cat: "elem", ico: "drop", v: { ch: 0.20, dur: 4, mult: 0.12, max: 3 }, name: ["독의 손길", "毒の手", "Venom Touch"], desc: ["직접 공격 20% 확률로 4초 중독 (초당 12%, 3중첩)", "直接攻撃20%で4秒毒(毎秒12%、3重)", "Direct hits: 20% to poison 4s (12%/s, 3 stacks)"] },
  { id: "a15", r: "rare", cat: "def", ico: "fang", v: { pct: 0.04 }, name: ["흡혈", "吸血", "Lifesteal"], desc: ["직접 공격 피해의 4% 회복 (초당 상한)", "直接攻撃ダメージの4%回復(毎秒上限)", "Heal 4% of direct damage (per-second cap)"] },
  { id: "a16", r: "rare", cat: "atk", ico: "arrow", v: { pierce: 2, fall: 0.15 }, name: ["관통 사격", "貫通射撃", "Piercing Shot"], desc: ["투사체 관통 +2, 관통마다 피해 -15%", "弾の貫通+2、貫通ごとに-15%", "+2 pierce, -15% damage per pierce"] },
  { id: "a17", r: "rare", cat: "move", ico: "dash", v: { mult: 1.0, rad: 2.6 * M, cd: 6 }, name: ["폭풍 대시", "嵐のダッシュ", "Storm Dash"], desc: ["대시 끝 지점에 100% 범위 피해 (6초마다)", "ダッシュ終点に100%範囲ダメージ(6秒ごと)", "Dash end: 100% AoE (6s cd)"] },
  { id: "a18", r: "rare", cat: "summon", ico: "drone", v: { cd: 1.5, mult: 0.35, max: 1 }, name: ["전투 드론", "戦闘ドローン", "Combat Drone"], desc: ["자동 공격 드론 1기 (1.5초마다 35%)", "自動攻撃ドローン1機(1.5秒ごと35%)", "1 drone: 35% every 1.5s"] },
  { id: "a19", r: "rare", cat: "def", ico: "thorn", v: { pct: 0.25, perSec: 6 }, name: ["가시 갑옷", "トゲの鎧", "Thorn Armor"], desc: ["근접 피격 시 받은 피해 25% 반사", "近接被弾時、受けたダメージの25%を反射", "Reflect 25% of melee damage taken"] },
  { id: "a20", r: "rare", cat: "support", ico: "wave", v: { every: 25, rad: 5 * M, pct: 0.08 }, name: ["치유의 파동", "癒やしの波動", "Healing Wave"], desc: ["25초마다 5m 안 아군 체력 8% 회복", "25秒ごとに5m内の味方を8%回復", "Every 25s: heal allies in 5m by 8%"] },
  // 영웅 10
  { id: "a21", r: "epic", cat: "elem", ico: "meteor", v: { every: 12, mult: 2.5, rad: 3 * M, warn: 1 }, name: ["메테오", "メテオ", "Meteor"], desc: ["12초마다 적 밀집 지역에 메테오 (250%, 3m, 1초 예고)", "12秒ごとに密集地へメテオ(250%、3m、1秒予告)", "Every 12s: meteor on crowds (250%, 3m)"] },
  { id: "a22", r: "epic", cat: "special", ico: "clock", v: { every: 20, dur: 4, rad: 6 * M, slow: 0.35, bossSlow: 0.15 }, name: ["시간 왜곡", "時間の歪み", "Time Warp"], desc: ["20초마다 4초간 6m 안 적 -35% 속도 (보스 -15%)", "20秒ごとに4秒間6m内の敵-35%(ボス-15%)", "Every 20s: -35% enemy speed in 6m for 4s (boss -15%)"] },
  { id: "a23", r: "epic", cat: "summon", ico: "twin", v: { every: 18, dur: 5, mult: 0.4 }, name: ["분신술", "分身の術", "Doppelganger"], desc: ["18초마다 5초간 분신 (본체 무기 피해 40%)", "18秒ごとに5秒間分身(本体武器の40%)", "Every 18s: 5s clone dealing 40% weapon damage"] },
  { id: "a24", r: "epic", cat: "elem", ico: "storm", v: { every: 15, n: 8, mult: 0.9, range: 320 }, name: ["번개 폭풍", "雷の嵐", "Lightning Storm"], desc: ["15초마다 주변 8명에게 90% 번개", "15秒ごとに周囲8体へ90%の雷", "Every 15s: 90% lightning on 8 nearby"] },
  { id: "a25", r: "epic", cat: "def", ico: "phoenix", v: { inv: 2 }, name: ["불사의 의지", "不死の意志", "Undying Will"], desc: ["치명적인 피해를 받으면 체력 1로 버티고 2초 무적 (1회)", "致命ダメージで体力1で耐え2秒無敵(1回)", "Survive a lethal hit at 1 HP + 2s invulnerable (once)"] },
  { id: "a26", r: "epic", cat: "atk", ico: "rage", v: { th: 0.35, atk: 0.35, aspd: 0.20 }, name: ["광전사의 분노", "狂戦士の怒り", "Berserker Rage"], desc: ["체력 35% 이하일 때 공격력 +35%, 공격 속도 +20%", "体力35%以下で攻撃力+35%、攻撃速度+20%", "Below 35% HP: +35% damage, +20% attack speed"] },
  { id: "a27", r: "epic", cat: "special", ico: "gravity", v: { every: 16, dur: 4, rad: 5 * M, pull: 150 }, name: ["중력장", "重力場", "Gravity Well"], desc: ["16초마다 4초간 5m 안 적을 끌어당김 (보스 제외)", "16秒ごとに4秒間5m内の敵を引き寄せる(ボス除く)", "Every 16s: pull enemies in 5m for 4s (not bosses)"] },
  { id: "a28", r: "epic", cat: "support", ico: "halo", v: { every: 30, dur: 3, rad: 5 * M, dr: 0.30 }, name: ["신성한 보호", "神聖な加護", "Divine Protection"], desc: ["30초마다 3초간 나와 5m 안 아군 피해 -30%", "30秒ごとに3秒間、自分と5m内の味方の被ダメ-30%", "Every 30s: -30% damage for you and allies in 5m (3s)"] },
  { id: "a29", r: "epic", cat: "atk", ico: "skull", v: { th: 0.20, mult: 0.50, boss: 0.10 }, name: ["처형자", "処刑人", "Executioner"], desc: ["체력 20% 이하 일반 몬스터에게 직접 피해 +50% (보스 +10%)", "体力20%以下の通常モンスターに直接ダメ+50%(ボス+10%)", "+50% direct damage to monsters below 20% HP (boss +10%)"] },
  { id: "a30", r: "epic", cat: "atk", ico: "overload", v: { every: 25, dur: 5, extra: 2, area: 0.25 }, name: ["무기 과부하", "武器オーバーロード", "Weapon Overload"], desc: ["25초마다 5초간 투사체 +2 (투사체 없는 무기는 범위 +25%)", "25秒ごとに5秒間弾数+2(弾のない武器は範囲+25%)", "Every 25s for 5s: +2 projectiles (others +25% area)"] },
  // 전설 10
  { id: "a31", r: "legendary", cat: "elem", ico: "judgment", v: { every: 30, n: 15, mult: 3.0, bossCap: 0.03 }, name: ["천상의 심판", "天上の審判", "Heavenly Judgment"], desc: ["30초마다 화면 안 적 15명에게 300% 피해", "30秒ごとに画面内の敵15体へ300%", "Every 30s: 300% to 15 foes on screen"] },
  { id: "a32", r: "legendary", cat: "summon", ico: "swords", v: { every: 20, dur: 6, n: 6, mult: 0.65, hitGap: 0.5, rad: 92 }, name: ["무한 검무", "無限剣舞", "Endless Blade Dance"], desc: ["20초마다 6초간 회전 검 6개 (각 65%)", "20秒ごとに6秒間回転する剣6本(各65%)", "Every 20s: 6 orbiting swords for 6s (65% each)"] },
  { id: "a33", r: "legendary", cat: "special", ico: "gold", v: { every: 40, dur: 8, atk: 0.5, spd: 0.2 }, name: ["황금 폭주", "黄金の暴走", "Golden Frenzy"], desc: ["40초마다 8초간 공격력 +50%, 이동 속도 +20%", "40秒ごとに8秒間攻撃力+50%、移動速度+20%", "Every 40s: +50% damage, +20% speed for 8s"] },
  { id: "a34", r: "legendary", cat: "def", ico: "rewind", v: { back: 3 }, name: ["시간 역행", "時間逆行", "Time Rewind"], desc: ["치명적인 피해를 받으면 3초 전 위치·체력으로 (1회)", "致命ダメージで3秒前の位置・体力へ(1回)", "On lethal damage: return to your state 3s ago (once)"] },
  { id: "a35", r: "legendary", cat: "def", ico: "aegis", v: { every: 35 }, name: ["절대 방어", "絶対防御", "Absolute Defense"], desc: ["35초마다 다음 피해 1회 완전 차단", "35秒ごとに次の被ダメ1回を完全に防ぐ", "Every 35s: fully block the next hit"] },
  { id: "a36", r: "legendary", cat: "summon", ico: "dragon", v: { every: 45, dur: 10, gap: 2, mult: 1.5, rad: 3 * M }, name: ["드래곤 소환", "ドラゴン召喚", "Summon Dragon"], desc: ["45초마다 10초간 드래곤 (2초마다 150% 화염)", "45秒ごとに10秒間ドラゴン(2秒ごと150%の炎)", "Every 45s: a dragon for 10s (150% fire every 2s)"] },
  { id: "a37", r: "legendary", cat: "def", ico: "fate", v: { th: 0.20, dur: 5, dr: 0.5, atk: 0.4, cd: 60 }, name: ["운명 역전", "運命逆転", "Turn of Fate"], desc: ["체력 20% 이하가 되면 5초간 피해 -50%, 공격력 +40% (60초마다)", "体力20%以下で5秒間被ダメ-50%、攻撃力+40%(60秒ごと)", "Below 20% HP: -50% damage taken, +40% damage for 5s (60s cd)"] },
  { id: "a38", r: "legendary", cat: "elem", ico: "collapse", v: { every: 35, rad: 7 * M, mult: 4.0, bossCap: 0.04 }, name: ["차원 붕괴", "次元崩壊", "Dimension Collapse"], desc: ["35초마다 7m 안 400% 광역 피해", "35秒ごとに7m内に400%の広域ダメージ", "Every 35s: 400% damage in 7m"] },
  { id: "a39", r: "legendary", cat: "support", ico: "miracle", v: { pct: 0.30 }, name: ["최후의 기적", "最後の奇跡", "Final Miracle"], desc: ["협동: 전원 쓰러지기 직전 1명을 체력 30%로 부활 (팀당 1회) · 혼자: 치명적인 피해 1회 막기", "協力:全滅直前に1人を体力30%で復活(チーム1回)・ソロ:致命ダメ1回を防ぐ", "Co-op: revive one ally at 30% before a wipe (once per team) · Solo: block one lethal hit"] },
  { id: "a40", r: "legendary", cat: "special", ico: "crown", v: { atk: 0.20, aspd: 0.15, spd: 0.10, dr: 0.10 }, name: ["서바이벌의 신", "サバイバルの神", "God of Survival"], desc: ["공격력 +20%, 공격 속도 +15%, 이동 속도 +10%, 피해 감소 10%", "攻撃力+20%、攻撃速度+15%、移動速度+10%、被ダメ-10%", "+20% damage, +15% attack speed, +10% speed, -10% damage taken"] },
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));

// ---------- 시너지 12 ----------
export const SYNERGIES = [
  { id: "s1", req: ["a11", "a24"], name: ["뇌신의 분노", "雷神の怒り", "Wrath of the Thunder God"], desc: ["연쇄 번개 5명·번개 폭풍 10초마다, 번개에 감전", "連鎖雷5体・雷の嵐10秒ごと、雷に感電付与", "Chain hits 5, storm every 10s, lightning shocks"] },
  { id: "s2", req: ["a12", "a21"], name: ["화염 종말", "炎の終末", "Inferno's End"], desc: ["메테오 자리에 4초 불타는 땅, 처치 폭발 25%", "メテオ跡に4秒燃える地面、撃破爆発25%", "Meteors leave 4s fire ground, kill blasts 25%"] },
  { id: "s3", req: ["a13", "a22"], name: ["절대 냉기", "絶対冷気", "Absolute Cold"], desc: ["시간 왜곡 시작 때 일반 몬스터 1.2초 빙결, 얼음 갑옷 4초마다", "時間の歪み開始時に通常敵を1.2秒凍結、氷の鎧4秒ごと", "Time Warp freezes monsters 1.2s, Frost Armor every 4s"] },
  { id: "s4", req: ["a15", "a26"], name: ["피의 광전사", "血の狂戦士", "Blood Berserker"], desc: ["분노 조건 체력 50%, 분노 중 흡혈 8%", "怒りの条件が体力50%に、怒り中の吸血8%", "Rage at 50% HP, 8% lifesteal while raging"] },
  { id: "s5", req: ["a18", "a30"], name: ["기계 군단", "機械軍団", "Machine Legion"], desc: ["드론 +2기, 과부하 중 드론 공격 속도 2배", "ドローン+2機、オーバーロード中ドローン攻撃速度2倍", "+2 drones; drones fire 2× during Overload"] },
  { id: "s6", req: ["a19", "a35"], name: ["반격의 요새", "反撃の要塞", "Counter Fortress"], desc: ["절대 방어가 막으면 200% 반격 파동, 가시 반사 40%", "絶対防御発動時200%の反撃波、トゲ反射40%", "Blocked hits release a 200% shockwave; thorns 40%"] },
  { id: "s7", req: ["a23", "a32"], name: ["그림자 검무", "影の剣舞", "Shadow Blade Dance"], desc: ["분신도 회전 검 3개, 검무 15초마다", "分身も回転剣3本、剣舞15秒ごと", "Clones get 3 swords; Blade Dance every 15s"] },
  { id: "s8", req: ["a27", "a38"], name: ["블랙홀", "ブラックホール", "Black Hole"], desc: ["중력장이 끝날 때 250% 폭발, 붕괴 전에 끌어당김", "重力場終了時に250%爆発、崩壊前に引き寄せ", "Gravity Well ends in a 250% blast; Collapse pulls first"] },
  { id: "s9", req: ["a20", "a28"], name: ["성역", "聖域", "Sanctuary"], desc: ["치유의 파동이 3초 피해 -15%, 신성한 보호가 5% 회복", "癒やしの波動に3秒被ダメ-15%、加護に5%回復", "Healing Wave adds -15% damage 3s; Protection heals 5%"] },
  { id: "s10", req: ["a16", "a31"], name: ["천공의 심판", "天空の審判", "Celestial Verdict"], desc: ["심판 대상 25명, 관통 +1 더", "審判の対象25体、貫通+1", "Judgment hits 25 foes, +1 more pierce"] },
  { id: "s11", req: ["a17", "a33"], name: ["황금 질주", "黄金の疾走", "Golden Rush"], desc: ["황금 폭주 중 대시 재사용 -50%, 폭풍 대시 200%", "黄金の暴走中ダッシュ再使用-50%、嵐のダッシュ200%", "During Frenzy: -50% dash cd, Storm Dash 200%"] },
  { id: "s12", req: ["a25", "a37"], name: ["최후의 전사", "最後の戦士", "Last Warrior"], desc: ["불사의 의지가 터지면 운명 역전 8초 자동 발동 (재사용 초기화)", "不死の意志発動時に運命逆転が8秒自動発動(再使用リセット)", "Undying triggers an 8s Turn of Fate (resets its cd)"] },
];
export const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s]));

// ---------- 진행 (15분 기준, 길이가 다르면 비율로) ----------
export const AUG_TIMES = [0, 180, 360, 540, 720];          // 증강 고르기 (초)
export const BOSS_TIMES = [300, 600, 900];                  // 보스 등장
export const XP_CURVE = (lv) => Math.round(5 + lv * 3 + lv * lv * 0.32 + (lv > 20 ? (lv - 20) ** 2 * 1.5 : 0));
// 스트리머 후원
export const STREAM_KINDS = ["buff", "monster", "supply", "elite"];
export const STREAM_DEFAULT = { buff: 1000, monster: 1100, supply: 3000, elite: 5000 };
export const STREAM_LABEL = {
  buff: ["💪 플레이어 버프 (20초)", "💪 プレイヤー強化(20秒)", "💪 Player buff (20s)"], monster: ["👿 몬스터 강화 (20초)", "👿 モンスター強化(20秒)", "👿 Monster frenzy (20s)"],
  supply: ["📦 보급 상자", "📦 補給箱", "📦 Supply crate"], elite: ["👑 후원자 정예 몬스터", "👑 投げ銭者の精鋭モンスター", "👑 Donor elite monster"],
};

// ---------- 업적·해금 (2026-11-20) — 판이 끝나면 서버가 기록(sva_progress 표)하고 판정 ----------
// · 기록 키: 누적(plays·wins·kills·elite·bosses·evo·rev·alive·wHard…) / 한 판 최고(bKills·bLv·bEvo·bSyn·bLeg) / wChars = 이겨 본 캐릭터 수
// · 보상: 캐릭터 색(c) 또는 칭호(t, 업적 이름이 곧 칭호)
export const ACH_COLORS = {
  ember:    { col: "#ff8c42", name: ["불씨", "残り火", "Ember"] },
  gold:     { col: "#ffd43b", name: ["황금", "黄金", "Gold"] },
  crimson:  { col: "#e03131", name: ["진홍", "深紅", "Crimson"] },
  frost:    { col: "#8fe3ff", name: ["서리", "霜", "Frost"] },
  ruby:     { col: "#ff3d7f", name: ["루비", "ルビー", "Ruby"] },
  emerald:  { col: "#20d68a", name: ["에메랄드", "エメラルド", "Emerald"] },
  sapphire: { col: "#3b7bff", name: ["사파이어", "サファイア", "Sapphire"] },
  amethyst: { col: "#a855f7", name: ["자수정", "アメジスト", "Amethyst"] },
  steel:    { col: "#9aa7b8", name: ["강철", "鋼鉄", "Steel"] },
  prism:    { col: "#ff9ff3", name: ["프리즘", "プリズム", "Prism"] },
  void:     { col: "#5b21b6", name: ["공허", "虚無", "Void"] },
};
export const ACHS = [
  { id: "h01", k: "plays",   n: 1,     rw: ["t"],             icon: "🌱", name: ["새내기 생존자", "新米サバイバー", "Rookie Survivor"], desc: ["첫 판 끝내기", "初めての1戦を終える", "Finish your first run"] },
  { id: "h02", k: "plays",   n: 20,    rw: ["c", "ember"],    icon: "🔥", name: ["단골 손님", "常連さん", "Regular"], desc: ["20판 끝내기", "20戦を終える", "Finish 20 runs"] },
  { id: "h03", k: "wins",    n: 1,     rw: ["t"],             icon: "🏆", name: ["살아남은 자", "生き残り", "Survivor"], desc: ["처음으로 승리 (마지막 보스 처치·팀전 승리)", "初勝利(最後のボス撃破・チーム戦勝利)", "First victory (final boss or team win)"] },
  { id: "h04", k: "wins",    n: 10,    rw: ["c", "gold"],     icon: "👑", name: ["백전노장", "歴戦の勇士", "Veteran"], desc: ["10번 승리", "10回勝利", "Win 10 times"] },
  { id: "h05", k: "bosses",  n: 3,     rw: ["t"],             icon: "👹", name: ["보스 사냥꾼", "ボスハンター", "Boss Hunter"], desc: ["보스 3마리 처치 (누적)", "ボスを3体撃破(累計)", "Defeat 3 bosses (total)"] },
  { id: "h06", k: "bosses",  n: 30,    rw: ["c", "crimson"],  icon: "💀", name: ["마왕 토벌대", "魔王討伐隊", "Demon Slayer"], desc: ["보스 30마리 처치 (누적)", "ボスを30体撃破(累計)", "Defeat 30 bosses (total)"] },
  { id: "h07", k: "evo",     n: 3,     rw: ["t"],             icon: "⚒️", name: ["대장장이", "鍛冶師", "Blacksmith"], desc: ["진화 무기 3개 만들기 (누적)", "進化武器を3つ作る(累計)", "Evolve 3 weapons (total)"] },
  { id: "h08", k: "bEvo",    n: 3,     rw: ["c", "frost"],    icon: "🌟", name: ["무기고", "武器庫", "Arsenal"], desc: ["한 판에 진화 무기 3개", "1戦で進化武器3つ", "3 evolved weapons in one run"] },
  { id: "h09", k: "kills",   n: 1000,  rw: ["t"],             icon: "🧹", name: ["몬스터 청소부", "モンスター掃除屋", "Monster Sweeper"], desc: ["몬스터 1,000마리 처치 (누적)", "モンスターを1,000体撃破(累計)", "Defeat 1,000 monsters (total)"] },
  { id: "h10", k: "kills",   n: 20000, rw: ["c", "ruby"],     icon: "🩸", name: ["끝없는 사냥", "終わりなき狩り", "Endless Hunt"], desc: ["몬스터 20,000마리 처치 (누적)", "モンスターを20,000体撃破(累計)", "Defeat 20,000 monsters (total)"] },
  { id: "h11", k: "bKills",  n: 1500,  rw: ["t"],             icon: "⚔️", name: ["학살자", "殲滅者", "Annihilator"], desc: ["한 판에 1,500마리 처치", "1戦で1,500体撃破", "1,500 kills in one run"] },
  { id: "h12", k: "elite",   n: 50,    rw: ["c", "emerald"],  icon: "💎", name: ["정예 사냥꾼", "精鋭ハンター", "Elite Hunter"], desc: ["정예 몬스터 50마리 처치 (누적)", "精鋭モンスターを50体撃破(累計)", "Defeat 50 elite monsters (total)"] },
  { id: "h13", k: "bLv",     n: 30,    rw: ["t"],             icon: "📈", name: ["성장의 화신", "成長の化身", "Avatar of Growth"], desc: ["한 판에 레벨 30 달성", "1戦でレベル30到達", "Reach level 30 in one run"] },
  { id: "h14", k: "wHard",   n: 1,     rw: ["c", "sapphire"], icon: "🛡️", name: ["강철 심장", "鋼の心臓", "Iron Heart"], desc: ["어려움 이상에서 승리", "むずかしい以上で勝利", "Win on Hard or above"] },
  { id: "h15", k: "wNight",  n: 1,     rw: ["t"],             icon: "🌑", name: ["악몽을 이긴 자", "悪夢を越えし者", "Nightmare Breaker"], desc: ["악몽에서 승리", "悪夢で勝利", "Win on Nightmare"] },
  { id: "h16", k: "wPure",   n: 1,     rw: ["t"],             icon: "🗡️", name: ["순수한 실력", "純粋な実力", "Pure Skill"], desc: ["일반 서바이벌(증강 없이)에서 승리", "通常サバイバル(オーグメントなし)で勝利", "Win Classic Survival (no augments)"] },
  { id: "h17", k: "bSyn",    n: 2,     rw: ["c", "amethyst"], icon: "✦", name: ["조합의 달인", "組み合わせの達人", "Combo Master"], desc: ["한 판에 시너지 2개 완성", "1戦でシナジー2つ完成", "Complete 2 synergies in one run"] },
  { id: "h18", k: "bLeg",    n: 2,     rw: ["t"],             icon: "📜", name: ["전설 수집가", "伝説コレクター", "Legend Collector"], desc: ["한 판에 전설 증강 2개", "1戦で伝説オーグメント2つ", "2 legendary augments in one run"] },
  { id: "h19", k: "rev",     n: 10,    rw: ["t"],             icon: "😇", name: ["수호천사", "守護天使", "Guardian Angel"], desc: ["쓰러진 동료 10번 살리기 (누적)", "倒れた仲間を10回蘇生(累計)", "Revive allies 10 times (total)"] },
  { id: "h20", k: "first",   n: 1,     rw: ["t"],             icon: "🥇", name: ["챔피언", "チャンピオン", "Champion"], desc: ["개인전 1위 (2명 이상)", "個人戦1位(2人以上)", "1st place in Free-for-all (2+ players)"] },
  { id: "h21", k: "wTeam",   n: 1,     rw: ["c", "steel"],    icon: "🚩", name: ["팀의 승리", "チームの勝利", "Team Victory"], desc: ["팀 대전 승리", "チーム戦で勝利", "Win a team battle"] },
  { id: "h22", k: "wParty",  n: 1,     rw: ["t"],             icon: "🤝", name: ["함께라서", "みんなで", "Together"], desc: ["4명 이상 협동에서 승리", "4人以上の協力で勝利", "Win co-op with 4+ players"] },
  { id: "h23", k: "wFull",   n: 1,     rw: ["t"],             icon: "⏳", name: ["끝까지 버틴 자", "最後まで耐えし者", "Last One Standing"], desc: ["15분 판에서 승리", "15分戦で勝利", "Win a 15-minute run"] },
  { id: "h24", k: "wNoFall", n: 1,     rw: ["t"],             icon: "💠", name: ["불굴", "不屈", "Unbroken"], desc: ["한 번도 쓰러지지 않고 승리", "一度も倒れずに勝利", "Win without ever going down"] },
  { id: "h25", k: "wChars",  n: 6,     rw: ["c", "prism"],    icon: "🌈", name: ["만능 영웅", "万能の英雄", "Jack of All Trades"], desc: ["캐릭터 6종 모두로 한 번씩 승리", "6キャラ全員で1回ずつ勝利", "Win once with all 6 characters"] },
  { id: "h26", k: "alive",   n: 10800, rw: ["c", "void"],     icon: "🕳️", name: ["끈질긴 생명", "しぶとい命", "Unkillable"], desc: ["생존 시간 3시간 (누적)", "生存時間3時間(累計)", "Survive 3 hours (total)"] },
];
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
/** 객체에 그 키가 직접 있나 (Object.hasOwn은 옛 iOS 15.3 이하에 없음) */
export const achHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ACH_SUM = ["plays", "wins", "kills", "elite", "bosses", "evo", "rev", "alive", "wHard", "wNight", "wPure", "first", "wTeam", "wParty", "wFull", "wNoFall"];
const ACH_MAX = ["bKills", "bLv", "bEvo", "bSyn", "bLeg"];
/** 한 판 결과를 기록에 더함. run = { win, first, mode, diff, len(초), aug, char, party, kills, elite, bosses, evo, lv, syn, leg, rev, alive, falls } */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const win = !!run.win;
  const add = { plays: 1, wins: win ? 1 : 0, kills: num(run.kills), elite: num(run.elite), bosses: num(run.bosses), evo: num(run.evo), rev: num(run.rev), alive: Math.round(num(run.alive)),
    wHard: win && (run.diff === "hard" || run.diff === "nightmare") ? 1 : 0, wNight: win && run.diff === "nightmare" ? 1 : 0, wPure: win && !run.aug ? 1 : 0,
    first: run.first ? 1 : 0, wTeam: win && run.mode === "team" ? 1 : 0, wParty: win && run.mode === "coop" && num(run.party) >= 4 ? 1 : 0, wFull: win && num(run.len) >= 900 ? 1 : 0, wNoFall: win && !num(run.falls) ? 1 : 0 };
  for (const k of ACH_SUM) s[k] = num(s[k]) + (add[k] || 0);
  const best = { bKills: num(run.kills), bLv: num(run.lv), bEvo: num(run.evo), bSyn: num(run.syn), bLeg: num(run.leg) };
  for (const k of ACH_MAX) s[k] = Math.max(num(s[k]), best[k]);
  const ci = CHAR_IDS.indexOf(run.char); s.cm = num(s.cm) | (win && ci >= 0 ? 1 << ci : 0);
  let n = 0; for (let i = 0; i < CHAR_IDS.length; i++) if (s.cm & (1 << i)) n++; s.wChars = n;
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
/** 해금된 업적으로 쓸 수 있는 꾸미기인지 확인 → { c: 색 id|null, t: 칭호(업적 id)|null } */
export function achEquip(unlocked, want) {
  const u = new Set(unlocked || []), out = { c: null, t: null };
  const c = String(want?.c || ""), t = String(want?.t || "");
  if (achHas(ACH_COLORS, c) && ACHS.some(a => a.rw[0] === "c" && a.rw[1] === c && u.has(a.id))) out.c = c;
  if (achHas(ACH, t) && ACH[t].rw[0] === "t" && u.has(t)) out.t = t;
  return out;
}
