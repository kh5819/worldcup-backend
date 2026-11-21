// =========================
// DUO 증강 공중전 — 데이터 (2026-11-21)
// · 서버(worldcup-backend/src/sky-data.js)와 화면(홈페이지 제작/js/sky/sk-data.js)이 같은 파일 (_sky-verify가 확인)
// · 이름·설명은 [한, 日, EN]
// =========================
export const TICK = 0.05;
export const MAP = { w: 6400, h: 4400 };       // 위에서 본 하늘 (아래는 바다·섬)
export const EDGE = 180;                        // 이 안쪽으로 밀어 넣음 (지도 밖으로 못 나감)
export const GAME_LEN = 300;                    // 5분
export const MAX_FISH = 50;                     // 한 하늘 비행기 수 (사람 + AI)
export const MAX_AUGS = 8, MAX_ACTIVE = 2, MAX_LEGEND = 2;
export const AUG_AT = [10, 24, 42, 66, 98, 140, 195, 265]; // 별(경험치)이 이만큼 모이면 증강 1장
export const PLANE = { r: 24, hp: 170, spd: 290, turn: 2.8, boostMul: 1.65, boostMax: 100, boostDrain: 45, boostRegen: 14 };
export const GUN = { cd: 0.12, dmg: 6, spd: 950, life: 0.62, spread: 0.035 };
export const ROLL = { t: 0.45, cd: 4, spd: 1.25 };
export const RESPAWN = 3, SPAWN_SAFE = 2.5;
export const SCORE = { kill: 100, assist: 40, star: 1 };
export const STAR = { r: 14, pick: 46 };        // 떠다니는 별 (경험치·점수)
export const PICKUPS = { health: { icon: "power_health", hp: 40 }, shield: { icon: "power_shield", sh: 40, t: 10 }, power: { icon: "power_up", mul: 2, t: 8 } };
/** 실제 속도 (부스터·버프 반영 전 기본) */
export const spdBase = (lv) => PLANE.spd * (1 + Math.min(lv, 20) * 0.004);

// 기체 모습 (Kenney Scribble Planes) — 꾸미기일 뿐 능력 차이 없음 (기본 색)
// 기체마다 특징 (2026-11-21 2차) — st: 속도·체력·선회·총알 피해·부스터 연료 배율. 장점 하나엔 단점 하나
export const SKINS = {
  falcon:  { spr: "unit_plane_a", col: "#ff6b6b", st: { spd: 1, hp: 1, turn: 1, dmg: 1, bo: 1 }, name: ["팔콘", "ファルコン", "Falcon"], tag: ["균형형", "バランス型", "Balanced"], desc: ["모든 능력이 고른 기본 기체", "全能力が平均的な基本機", "All-round standard fighter"] },
  sparrow: { spr: "unit_plane_b", col: "#4dabf7", st: { spd: 1.08, hp: 0.9, turn: 1.05, dmg: 1, bo: 1 }, name: ["스패로", "スパロー", "Sparrow"], tag: ["날쌘형", "俊敏型", "Nimble"], desc: ["속도 +8%·선회 +5%, 체력 -10%", "速度+8%・旋回+5%、HP-10%", "+8% speed, +5% turn, -10% HP"] },
  hornet:  { spr: "unit_plane_c", col: "#ffd43b", st: { spd: 1, hp: 0.92, turn: 1, dmg: 1.12, bo: 1 }, name: ["호넷", "ホーネット", "Hornet"], tag: ["화력형", "火力型", "Gunner"], desc: ["총알 피해 +12%, 체력 -8%", "弾ダメージ+12%、HP-8%", "+12% bullet damage, -8% HP"] },
  biplane: { spr: "unit_plane_d", col: "#69db7c", st: { spd: 0.94, hp: 1, turn: 1.2, dmg: 1, bo: 1 }, name: ["복엽기", "複葉機", "Biplane"], tag: ["곡예형", "曲芸型", "Acrobat"], desc: ["선회 +20%, 속도 -6%", "旋回+20%、速度-6%", "+20% turn rate, -6% speed"] },
  raven:   { spr: "unit_plane_f", col: "#b197fc", st: { spd: 0.95, hp: 1.15, turn: 1, dmg: 1, bo: 1 }, name: ["레이븐", "レイヴン", "Raven"], tag: ["튼튼형", "頑丈型", "Tank"], desc: ["체력 +15%, 속도 -5%", "HP+15%、速度-5%", "+15% HP, -5% speed"] },
  twin:    { spr: "unit_plane_i", col: "#ff922b", st: { spd: 0.97, hp: 1.08, turn: 0.9, dmg: 1.08, bo: 1 }, name: ["쌍발기", "双発機", "Twin"], tag: ["중무장형", "重武装型", "Heavy"], desc: ["체력 +8%·피해 +8%, 선회 -10%", "HP+8%・ダメージ+8%、旋回-10%", "+8% HP and damage, -10% turn"] },
  corsair: { spr: "unit_plane_j", col: "#63e6be", st: { spd: 1, hp: 0.95, turn: 1, dmg: 1, bo: 1.4 }, name: ["커세어", "コルセア", "Corsair"], tag: ["부스터형", "ブースト型", "Booster"], desc: ["부스터 연료 +40%, 체력 -5%", "ブースト燃料+40%、HP-5%", "+40% boost fuel, -5% HP"] },
  jet:     { spr: "unit_plane_k", col: "#e9ecef", st: { spd: 1.12, hp: 0.9, turn: 0.9, dmg: 1, bo: 1 }, name: ["제트기", "ジェット", "Jet"], tag: ["고속형", "高速型", "Speedster"], desc: ["속도 +12%, 선회 -10%·체력 -10%", "速度+12%、旋回-10%・HP-10%", "+12% speed, -10% turn and HP"] },
};
export const SKIN_ST0 = { spd: 1, hp: 1, turn: 1, dmg: 1, bo: 1 };
export const SKIN_IDS = Object.keys(SKINS);

// 증강 40종 — kind: p(항상) · a(Q/E 스킬, 최대 2개) · r: common·rare·epic·legend
export const AUGS = [
  // 무기
  { id: "w01", r: "rare", kind: "p", icon: "🔫", v: {}, name: ["쌍발 기관총", "連装機関銃", "Twin Guns"], desc: ["총알이 두 줄로 나감", "弾が2列で出る", "Fire two streams of bullets"] },
  { id: "w02", r: "common", kind: "p", icon: "🎆", v: { n: 3, spread: 0.22, life: 0.7 }, name: ["산탄", "散弾", "Spread Shot"], desc: ["부채꼴로 3발 (사거리 조금 짧음)", "扇状に3発(射程少し短い)", "Fire 3 bullets in a fan (slightly shorter range)"] },
  { id: "w03", r: "rare", kind: "p", icon: "🎯", v: { n: 1 }, name: ["관통탄", "貫通弾", "Piercing Rounds"], desc: ["총알이 1대를 뚫고 지나감", "弾が1機を貫通する", "Bullets pierce through one plane"] },
  { id: "w04", r: "common", kind: "p", icon: "💣", v: { dmg: 0.35, rate: 0.15 }, name: ["대구경 탄", "大口径弾", "Heavy Caliber"], desc: ["피해 +35%, 연사 -15%", "ダメージ+35%、連射-15%", "+35% damage, -15% fire rate"] },
  { id: "w05", r: "common", kind: "p", icon: "⚡", v: { rate: 0.35 }, name: ["속사", "速射", "Rapid Fire"], desc: ["연사 +35%", "連射+35%", "+35% fire rate"] },
  { id: "w06", r: "common", kind: "p", icon: "🔭", v: { range: 0.4 }, name: ["장거리 포신", "長距離砲身", "Long Barrel"], desc: ["사거리·총알 속도 +40%", "射程・弾速+40%", "+40% range and bullet speed"] },
  { id: "w07", r: "rare", kind: "p", icon: "↩️", v: { cd: 0.35, dmg: 6 }, name: ["후방 기관총", "後方機銃", "Tail Gunner"], desc: ["뒤쪽 가까운 적에게 자동 사격", "後ろの近い敵へ自動射撃", "Auto-fires at enemies behind you"] },
  { id: "w08", r: "rare", kind: "p", icon: "🚀", v: { cd: 2.5, dmg: 30 }, name: ["유도 미사일", "誘導ミサイル", "Homing Missile"], desc: ["2.5초마다 앞쪽 적을 쫓는 미사일 (30 피해)", "2.5秒ごとに前方の敵を追うミサイル(30ダメージ)", "Every 2.5s a missile hunts an enemy ahead (30 dmg)"] },
  { id: "w09", r: "common", kind: "p", icon: "🔥", v: { dps: 4, t: 3 }, name: ["화염탄", "焼夷弾", "Incendiary Rounds"], desc: ["맞은 적이 3초 동안 불탐 (초당 4)", "当たった敵が3秒燃える(毎秒4)", "Hits set enemies on fire for 3s (4/s)"] },
  { id: "w10", r: "rare", kind: "p", icon: "🧨", v: { cd: 4, dmg: 45, r: 70 }, name: ["기뢰 투하", "機雷投下", "Mine Layer"], desc: ["4초마다 뒤에 기뢰 (닿으면 45 피해)", "4秒ごとに後方へ機雷(触れると45ダメージ)", "Drop a mine behind you every 4s (45 dmg on contact)"] },
  { id: "w11", r: "epic", kind: "p", icon: "🔆", v: { cd: 3, dmg: 45, len: 700 }, name: ["레이저 포", "レーザー砲", "Laser Cannon"], desc: ["3초마다 앞으로 레이저 (일직선 전부 45 피해)", "3秒ごとに前方へレーザー(直線上すべてに45)", "Every 3s fire a laser that hits everything in a line (45 dmg)"] },
  { id: "w12", r: "rare", kind: "p", icon: "🌩️", v: { ch: 0.2, dmg: 10, n: 2 }, name: ["번개탄", "雷撃弾", "Chain Lightning"], desc: ["맞힐 때 20% 확률로 근처 적 2대에 번개 (10)", "命中時20%で近くの敵2機に雷(10)", "20% chance on hit to chain lightning to 2 nearby enemies (10)"] },
  // 기체
  { id: "b13", r: "common", kind: "p", icon: "🛡️", v: { hp: 40 }, name: ["장갑 강화", "装甲強化", "Armor Plating"], desc: ["최대 체력 +40", "最大HP+40", "+40 max HP"] },
  { id: "b14", r: "common", kind: "p", icon: "🌀", v: { turn: 0.3 }, name: ["날렵한 선회", "鋭い旋回", "Agile Turning"], desc: ["선회 +30%", "旋回+30%", "+30% turn rate"] },
  { id: "b15", r: "common", kind: "p", icon: "⛽", v: { max: 0.6, regen: 0.5 }, name: ["연료 탱크", "燃料タンク", "Fuel Tank"], desc: ["부스터 양 +60%, 차는 속도 +50%", "ブースト量+60%、回復+50%", "+60% boost fuel, +50% refill speed"] },
  { id: "b16", r: "common", kind: "p", icon: "🔧", v: { hps: 3, wait: 3 }, name: ["자동 수리", "自動修理", "Auto Repair"], desc: ["3초 동안 안 맞으면 초당 3 회복", "3秒被弾しないと毎秒3回復", "Heal 3/s after 3s without being hit"] },
  { id: "b17", r: "rare", kind: "p", icon: "🪶", v: { r: 0.25 }, name: ["소형 기체", "小型機体", "Compact Frame"], desc: ["맞는 크기 -25%", "当たり判定-25%", "-25% hitbox"] },
  { id: "b18", r: "common", kind: "p", icon: "🏎️", v: { spd: 0.12 }, name: ["고속 엔진", "高速エンジン", "Fast Engine"], desc: ["속도 +12%", "速度+12%", "+12% speed"] },
  { id: "b19", r: "rare", kind: "p", icon: "🩸", v: { pct: 0.15 }, name: ["흡혈탄", "吸血弾", "Vampire Rounds"], desc: ["준 피해의 15% 회복", "与えたダメージの15%回復", "Heal 15% of damage dealt"] },
  { id: "b20", r: "common", kind: "p", icon: "🔵", v: { cd: 20, sh: 25 }, name: ["보호막 발생기", "シールド発生器", "Shield Generator"], desc: ["20초마다 보호막 25", "20秒ごとにシールド25", "Gain a 25 shield every 20s"] },
  { id: "b21", r: "common", kind: "p", icon: "🧲", v: { mul: 2.5 }, name: ["자석", "マグネット", "Magnet"], desc: ["별을 2.5배 멀리서 끌어옴", "星を2.5倍遠くから引き寄せる", "Pull stars from 2.5× farther"] },
  { id: "b22", r: "rare", kind: "p", icon: "🗡️", v: { below: 0.4, dmg: 0.25 }, name: ["사냥꾼", "ハンター", "Hunter"], desc: ["체력 40% 아래 적에게 피해 +25%", "HP40%以下の敵へダメージ+25%", "+25% damage to enemies below 40% HP"] },
  { id: "b23", r: "common", kind: "p", icon: "💢", v: { ch: 0.3, n: 4 }, name: ["반격", "反撃", "Counterfire"], desc: ["맞으면 30% 확률로 사방에 4발", "被弾時30%で全方向に4発", "30% chance when hit to fire 4 bullets around you"] },
  { id: "b24", r: "rare", kind: "p", icon: "🔥", v: { t: 4, rate: 0.3, spd: 0.15 }, name: ["연속 격추", "連続撃墜", "Killing Spree"], desc: ["격추하면 4초 동안 연사 +30%·속도 +15%", "撃墜すると4秒間連射+30%・速度+15%", "After a kill: +30% fire rate and +15% speed for 4s"] },
  { id: "b25", r: "rare", kind: "p", icon: "💰", v: { score: 0.5, star: 1.5 }, name: ["현상금 사냥꾼", "賞金稼ぎ", "Bounty Hunter"], desc: ["격추 점수 +50%, 떨어지는 별 +50%", "撃墜スコア+50%、落ちる星+50%", "+50% kill score and +50% stars dropped"] },
  { id: "b26", r: "legend", kind: "p", icon: "🪂", v: { cd: 60, inv: 2 }, name: ["비상 탈출", "緊急脱出", "Ejection Seat"], desc: ["격추될 피해를 받아도 체력 1로 버티고 2초 무적 (60초마다)", "撃墜されるダメージでもHP1で耐え2秒無敵(60秒ごと)", "Survive a lethal hit with 1 HP and 2s invincibility (every 60s)"] },
  { id: "b27", r: "rare", kind: "p", icon: "🍀", v: {}, name: ["행운", "幸運", "Lucky"], desc: ["다음 증강부터 카드 4장 + 높은 등급이 더 잘 나옴", "次から4枚から選べる+高ランクが出やすい", "Future picks show 4 cards with better rarity odds"] },
  { id: "b28", r: "common", kind: "p", icon: "🌪️", v: { cd: 0.4, t: 0.2 }, name: ["회피 기동", "回避機動", "Evasive Maneuvers"], desc: ["배럴롤 쿨타임 -40%, 무적 시간 +0.2초", "バレルロールのCT-40%、無敵+0.2秒", "-40% barrel roll cooldown, +0.2s invincibility"] },
  { id: "b29", r: "common", kind: "p", icon: "🎁", v: { keep: 0.75, sh: 30 }, name: ["낙하산 보급", "パラシュート補給", "Air Drop"], desc: ["다시 출격할 때 별 75% 유지 + 보호막 30", "再出撃時に星75%維持+シールド30", "Keep 75% of stars on respawn and start with a 30 shield"] },
  { id: "b30", r: "epic", kind: "p", icon: "🎯", v: { per: 0.05, max: 0.4 }, name: ["집중 사격", "集中射撃", "Focus Fire"], desc: ["같은 적을 계속 맞히면 한 발마다 피해 +5% (최대 +40%)", "同じ敵に当て続けると1発ごとに+5%(最大+40%)", "Each consecutive hit on the same enemy adds +5% damage (up to +40%)"] },
  // 스킬 (Q/E)
  { id: "s31", r: "common", kind: "a", icon: "✨", cd: 14, v: { t: 5 }, name: ["플레어", "フレア", "Flares"], desc: ["5초 동안 미사일이 나를 못 쫓고, 쫓던 미사일은 빗나감", "5秒間ミサイルに追われず、追跡中のミサイルも外れる", "For 5s missiles can't track you and incoming ones miss"] },
  { id: "s32", r: "rare", kind: "a", icon: "🔥", cd: 12, v: { t: 3, mul: 2.2, ram: 30 }, name: ["애프터버너", "アフターバーナー", "Afterburner"], desc: ["3초 동안 속도 2.2배, 부딪힌 적에게 30 피해", "3秒間速度2.2倍、ぶつかった敵に30", "2.2× speed for 3s; ramming deals 30 damage"] },
  { id: "s33", r: "rare", kind: "a", icon: "🛡️", cd: 18, v: { sh: 80, t: 4 }, name: ["방어막", "バリア", "Barrier"], desc: ["4초 동안 피해 80 막는 방어막", "4秒間ダメージ80を防ぐバリア", "A barrier that blocks 80 damage for 4s"] },
  { id: "s34", r: "epic", kind: "a", icon: "📡", cd: 20, v: { r: 360, t: 2.5 }, name: ["EMP", "EMP", "EMP"], desc: ["주변 적 무기 2.5초 정지, 날아오던 미사일 파괴", "周りの敵の武器を2.5秒停止、飛来中のミサイルを破壊", "Jam nearby enemies' weapons for 2.5s and destroy incoming missiles"] },
  { id: "s35", r: "rare", kind: "a", icon: "🛩️", cd: 22, v: { n: 2, t: 10 }, name: ["호위기", "護衛機", "Wingmen"], desc: ["10초 동안 호위기 2대가 함께 쏨", "10秒間護衛機2機が一緒に撃つ", "Two wingmen fly with you and shoot for 10s"] },
  { id: "s36", r: "rare", kind: "a", icon: "💥", cd: 16, v: { n: 6, dmg: 50, r: 120 }, name: ["융단 폭격", "絨毯爆撃", "Carpet Bombing"], desc: ["지나간 길에 폭탄 6개 (0.8초 뒤 폭발, 50)", "通った跡に爆弾6個(0.8秒後に爆発、50)", "Drop 6 bombs along your path (explode after 0.8s, 50 dmg)"] },
  { id: "s37", r: "epic", kind: "a", icon: "🎇", cd: 15, v: { n: 6, dmg: 25 }, name: ["미사일 일제 사격", "ミサイル一斉射撃", "Missile Barrage"], desc: ["유도 미사일 6발 발사 (각 25)", "誘導ミサイル6発(各25)", "Launch 6 homing missiles (25 each)"] },
  { id: "s38", r: "common", kind: "a", icon: "🌀", cd: 10, v: { d: 260 }, name: ["점프 드라이브", "ジャンプドライブ", "Jump Drive"], desc: ["앞으로 순간 이동", "前方へ瞬間移動", "Teleport forward"] },
  { id: "s39", r: "legend", kind: "a", icon: "🎈", cd: 45, v: { t: 8, hp: 150 }, name: ["전투 비행선", "戦闘飛行船", "Battle Airship"], desc: ["8초 동안 거대 비행선 (체력 +150, 사방 포탑, 느려짐)", "8秒間巨大飛行船(HP+150、全方向砲塔、遅くなる)", "Become a huge airship for 8s (+150 HP, turrets all around, slower)"] },
  { id: "s40", r: "legend", kind: "a", icon: "⏳", cd: 24, v: { r: 520, t: 3, slow: 0.5 }, name: ["시간 감속", "時間減速", "Time Warp"], desc: ["3초 동안 주변 적·총알이 절반 속도", "3秒間周りの敵・弾が半分の速さ", "For 3s nearby enemies and bullets move at half speed"] },
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
export const RARITY_W = { common: 55, rare: 30, epic: 12, legend: 4 };
export const RARITY_NAME = { common: ["일반", "ノーマル", "Common"], rare: ["희귀", "レア", "Rare"], epic: ["영웅", "エピック", "Epic"], legend: ["전설", "レジェンド", "Legendary"] };
export const SYNERGIES = [
  { id: "y1", req: ["w01", "w05"], name: ["탄막", "弾幕", "Bullet Storm"], desc: ["총알 한 줄 더", "弾がもう1列", "One more stream of bullets"] },
  { id: "y2", req: ["w08", "w09"], name: ["소이 미사일", "焼夷ミサイル", "Napalm Missiles"], desc: ["미사일이 맞은 곳 주변을 불태움", "ミサイルが当たった周りを燃やす", "Missiles set the area around the hit on fire"] },
  { id: "y3", req: ["b13", "b16"], name: ["요새", "要塞", "Flying Fortress"], desc: ["자동 수리 2배, 바로 시작", "自動修理2倍、すぐ開始", "Auto Repair doubled and starts right away"] },
  { id: "y4", req: ["b17", "b28"], name: ["유령 비행", "幽霊飛行", "Ghost Flight"], desc: ["배럴롤 무적 +0.3초, 쿨타임 추가 -20%", "バレルロール無敵+0.3秒、CTさらに-20%", "+0.3s roll invincibility and an extra -20% cooldown"] },
  { id: "y5", req: ["w11", "w06"], name: ["저격 레이저", "狙撃レーザー", "Sniper Laser"], desc: ["레이저 길이 1,100, 피해 1.5배", "レーザー長さ1,100、ダメージ1.5倍", "Laser length 1,100 and 1.5× damage"] },
  { id: "y6", req: ["w10", "s36"], name: ["지뢰밭", "地雷原", "Minefield"], desc: ["기뢰 2개씩, 폭탄 9개", "機雷2個ずつ、爆弾9個", "Mines drop in pairs and bombing drops 9 bombs"] },
  { id: "y7", req: ["s35", "s37"], name: ["편대 비행", "編隊飛行", "Squadron"], desc: ["호위기 3대, 호위기도 미사일을 쏨", "護衛機3機、護衛機もミサイルを撃つ", "3 wingmen that also fire missiles"] },
  { id: "y8", req: ["s34", "w12"], name: ["전자전", "電子戦", "Electronic Warfare"], desc: ["EMP 맞은 적은 1초 조종 불능", "EMPを受けた敵は1秒操縦不能", "EMP also locks enemy controls for 1s"] },
  { id: "y9", req: ["b22", "b30"], name: ["처형자", "処刑人", "Executioner"], desc: ["체력 40% 아래 적에게 피해 +60%", "HP40%以下の敵へ+60%", "+60% damage to enemies below 40% HP"] },
  { id: "y10", req: ["b18", "s32"], name: ["음속 돌파", "音速突破", "Sound Barrier"], desc: ["애프터버너 4.5초·2.6배", "アフターバーナー4.5秒・2.6倍", "Afterburner lasts 4.5s at 2.6× speed"] },
  { id: "y11", req: ["b19", "b20"], name: ["생명의 방패", "命の盾", "Life Shield"], desc: ["보호막이 생길 때 체력 20 회복", "シールド発生時にHP20回復", "Heal 20 HP whenever your shield generator fires"] },
  { id: "y12", req: ["b26", "b29"], name: ["불사조", "不死鳥", "Phoenix"], desc: ["비상 탈출 30초마다", "緊急脱出が30秒ごと", "Ejection Seat recharges every 30s"] },
];
export const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s]));

// 하늘 이벤트 (겹치지 않게 무작위 4번) + 2:20 보스 + 마지막 30초 점수 2배
export const EVENT_AT = [40, 95, 200, 240];
export const EVENTS = {
  storm: { icon: "⛈️", t: 18, name: ["뇌우", "雷雨", "Thunderstorm"], desc: ["번개가 떨어져요 — 빨간 원에서 피하세요 (40 피해), 구름이 짙어져 잘 안 보여요", "雷が落ちる — 赤い円から逃げよう(40ダメージ)、雲が濃くなり見えにくい", "Lightning strikes — dodge the red circles (40 dmg); thick clouds cut visibility"] },
  supply: { icon: "🪂", t: 14, name: ["보급 낙하산", "補給パラシュート", "Supply Drop"], desc: ["표시된 곳에 보급 상자가 떨어져요 — 먼저 가서 가져가세요", "マークの場所に補給箱が落ちる — 先に取ろう", "Supply crates drop at the marked spots — get there first"] },
  gust: { icon: "🌬️", t: 15, name: ["돌풍", "突風", "Gale"], desc: ["15초 동안 모두 한쪽으로 밀려요", "15秒間みんな一方向へ流される", "Everyone gets pushed one way for 15s"] },
  squad: { icon: "🛩️", t: 20, name: ["적 편대 습격", "敵編隊襲来", "Enemy Squadron"], desc: ["정예 편대가 1등을 노려요 — 함께 막아요", "精鋭編隊が1位を狙う — みんなで防ごう", "An elite squadron hunts the leader — fight them off together"] },
  meteor: { icon: "☄️", t: 16, name: ["운석 비", "流星雨", "Meteor Shower"], desc: ["하늘에서 운석이 떨어져요 — 빨간 원을 피하세요 (50 피해)", "隕石が降ってくる — 赤い円をよけよう(50ダメージ)", "Meteors rain down — avoid the red circles (50 dmg)"] },
  balloon: { icon: "🎈", t: 20, name: ["황금 열기구", "黄金の気球", "Golden Balloons"], desc: ["황금 열기구가 떠올라요 — 쏴서 터뜨리면 별 폭포 + 150점", "黄金の気球が浮かぶ — 撃って割ると星の雨+150点", "Golden balloons float up — pop them for a shower of stars + 150 points"] },
  bounty: { icon: "💰", t: 20, name: ["현상금", "賞金首", "Bounty"], desc: ["1등에게 현상금! 격추하면 점수 500", "1位に賞金!撃墜でスコア500", "Bounty on the leader! Shoot them down for 500 points"] },
};
export const EVENT_IDS = Object.keys(EVENTS);
export const DOUBLE_AT = 270; // 마지막 30초 점수 2배
export const BOSS_AT = 140, BOSS_LEN = 50;
export const BOSSES = {
  airship: { icon: "🎈", spr: "unit_airship_a", hp: 700, hpPer: 25, r: 200, spd: 55, name: ["거대 전투 비행선", "巨大戦闘飛行船", "Giant Battle Airship"], desc: ["포탑 4개가 사방으로 쏘고, 가끔 폭탄을 뿌려요", "砲塔4基が全方向に撃ち、ときどき爆弾をまく", "Four turrets fire in every direction and it scatters bombs"] },
  fortress: { icon: "✈️", spr: "unit_plane_bomber", hp: 650, hpPer: 22, r: 180, spd: 95, name: ["공중 요새 폭격기", "空中要塞爆撃機", "Flying Fortress Bomber"], desc: ["빠르게 지나가며 폭탄 줄을 떨어뜨리고 뒤로 미사일을 쏴요", "高速で通過しながら爆弾の列を落とし、後方へミサイル", "Sweeps past dropping bomb lines and firing missiles behind it"] },
};
BOSSES.heli = { icon: "🚁", spr: "unit_helicopter_a", hp: 620, hpPer: 22, r: 170, spd: 120, name: ["거대 공격 헬기", "巨大攻撃ヘリ", "Giant Gunship"], desc: ["가까운 비행기를 쫓아오며 회전 날개로 주변을 휩쓸고, 드론을 내보내요", "近くの機体を追いかけ、回転翼で周りをなぎ払い、ドローンを放つ", "Chases nearby planes, sweeps its surroundings with its rotor and launches drones"] };
export const BOSS_IDS = Object.keys(BOSSES);
export const BOSS_REWARD = [1500, 1000, 600, 300]; // 기여 1·2·3등, 그 밖 참여

// AI 조종사 (콜사인)
export const BOT_LV = { easy: { name: ["쉬움", "やさしい", "Easy"], aim: 0.45, react: 0.5, see: 0.75 }, normal: { name: ["보통", "ふつう", "Normal"], aim: 0.68, react: 0.75, see: 0.95 }, hard: { name: ["어려움", "むずかしい", "Hard"], aim: 0.95, react: 1, see: 1.2 } };
export const BOT_NAMES = [
  ["매버릭", "マーベリック", "Maverick"], ["아이스맨", "アイスマン", "Iceman"], ["바이퍼", "バイパー", "Viper"], ["고스트", "ゴースト", "Ghost"], ["피닉스", "フェニックス", "Phoenix"],
  ["레드 바론", "レッドバロン", "Red Baron"], ["스톰", "ストーム", "Storm"], ["썬더", "サンダー", "Thunder"], ["코브라", "コブラ", "Cobra"], ["팬텀", "ファントム", "Phantom"],
  ["블레이즈", "ブレイズ", "Blaze"], ["섀도", "シャドウ", "Shadow"], ["이글", "イーグル", "Eagle"], ["호크", "ホーク", "Hawk"], ["볼트", "ボルト", "Bolt"],
  ["졸린 조종사", "眠いパイロット", "Sleepy Pilot"], ["배고픈 기장", "腹ペコ機長", "Hungry Captain"], ["구름 사냥꾼", "雲ハンター", "Cloud Hunter"], ["종이비행기", "紙飛行機", "Paper Plane"], ["할머니 조종사", "おばあちゃんパイロット", "Granny Ace"],
  ["번개 우체부", "稲妻の郵便屋", "Lightning Mailman"], ["하늘 고양이", "空の猫", "Sky Cat"], ["엉뚱한 프로펠러", "とぼけたプロペラ", "Goofy Propeller"], ["졸음 비행", "居眠り飛行", "Nap Flyer"], ["푸른 매", "青い鷹", "Blue Hawk"],
  ["철새", "渡り鳥", "Migrant Bird"], ["무지개 꼬리", "虹のしっぽ", "Rainbow Tail"], ["낙하산 왕", "パラシュート王", "Parachute King"], ["구름빵", "雲パン", "Cloud Bun"], ["바람개비", "風車", "Pinwheel"],
  ["은빛 날개", "銀の翼", "Silver Wing"], ["새벽 비행", "夜明け飛行", "Dawn Patrol"], ["태풍의 눈", "台風の目", "Eye of the Storm"], ["모험가", "冒険家", "Adventurer"], ["꼬마 조종사", "ちびパイロット", "Tiny Pilot"],
  ["황금 프로펠러", "黄金のプロペラ", "Golden Propeller"], ["불꽃 날개", "炎の翼", "Flame Wing"], ["달빛 정찰", "月光偵察", "Moon Scout"], ["하늘 해적", "空の海賊", "Sky Pirate"], ["번개 매", "稲妻の鷹", "Thunder Hawk"],
  ["용감한 참새", "勇敢なスズメ", "Brave Sparrow"], ["눈송이", "雪片", "Snowflake"], ["회오리", "竜巻", "Twister"], ["바다 갈매기", "海のカモメ", "Seagull"], ["별똥별", "流れ星", "Shooting Star"],
  ["쌍둥이 엔진", "ツインエンジン", "Twin Engine"], ["노을 비행", "夕焼け飛行", "Sunset Flight"], ["철갑 독수리", "鉄甲の鷲", "Iron Eagle"], ["깃털", "羽根", "Feather"], ["에이스", "エース", "Ace"],
];
// 스트리머 후원 (금액이 정확히 같을 때만)
export const STREAM_KINDS = ["supply", "heal", "squad", "bounty", "donor"];
export const STREAM_DEFAULT = { supply: 1000, heal: 2000, squad: 3000, bounty: 5000, donor: 10000 };
export const STREAM_LABEL = {
  supply: ["🪂 보급 상자 (대상 근처)", "🪂 補給箱(対象の近く)", "🪂 Supply crate (near target)"],
  heal: ["❤️ 대상 체력 회복 + 보호막", "❤️ 対象のHP回復+シールド", "❤️ Heal target + shield"],
  squad: ["🛩️ 적 편대가 대상을 노림 (15초)", "🛩️ 敵編隊が対象を狙う(15秒)", "🛩️ Enemy squadron hunts the target (15s)"],
  bounty: ["💰 대상에게 현상금", "💰 対象に賞金", "💰 Bounty on the target"],
  donor: ["✈️ 후원자 이름 에이스 비행기 등장", "✈️ スポンサー名のエース機が登場", "✈️ Ace plane with the donor's name appears"],
};
export const MODES = ["ffa", "team"];
export const TEAM_COL = ["#4dabf7", "#ff6b6b", "#51cf66", "#fcc419", "#cc5de8"];
export const TEAM_NAME = [["파랑 편대", "青編隊", "Blue Squadron"], ["빨강 편대", "赤編隊", "Red Squadron"], ["초록 편대", "緑編隊", "Green Squadron"], ["노랑 편대", "黄編隊", "Yellow Squadron"], ["보라 편대", "紫編隊", "Purple Squadron"]];
// 계급 (레벨 = 고른 증강 수 + 1 정도) — 화면 표시
export const RANKS = [["훈련병", "訓練生", "Cadet"], ["소위", "少尉", "Ensign"], ["중위", "中尉", "Lieutenant"], ["대위", "大尉", "Captain"], ["소령", "少佐", "Major"], ["중령", "中佐", "Lt. Colonel"], ["대령", "大佐", "Colonel"], ["준장", "准将", "Brigadier"], ["에이스", "エース", "Ace"]];

// 업적 26종 · 보상 = 기체 색(11) 또는 칭호(15) — 서버가 판 결과로만 기록 (sky-progress.js, 표 sky_progress)
export const ACH_COLORS = {
  coral:  { col: "#ff7f6b", name: ["산호", "サンゴ", "Coral"] },
  navy:   { col: "#1c4fd6", name: ["해군 파랑", "ネイビー", "Navy"] },
  lava:   { col: "#ff4b1f", name: ["용암", "溶岩", "Lava"] },
  gold:   { col: "#ffc928", name: ["황금", "黄金", "Gold"] },
  aurora: { col: "#3fffd2", name: ["오로라", "オーロラ", "Aurora"] },
  royal:  { col: "#7b2ff7", name: ["왕실 보라", "ロイヤルパープル", "Royal Purple"] },
  sun:    { col: "#ffe066", name: ["햇살", "陽ざし", "Sunbeam"] },
  abyss:  { col: "#2b2f4a", name: ["밤하늘", "夜空", "Night Sky"] },
  cloud:  { col: "#bfe3ff", name: ["구름", "雲", "Cloud"] },
  prism:  { col: "#ff9ff3", name: ["프리즘", "プリズム", "Prism"] },
  blood:  { col: "#c92a2a", name: ["붉은 남작", "赤い男爵", "Red Baron"] },
};
export const ACHS = [
  { id: "k01", k: "plays", n: 1, rw: ["t"], icon: "🛫", name: ["첫 비행", "初飛行", "First Flight"], desc: ["첫 판 끝내기", "初めての1回を終える", "Finish your first run"] },
  { id: "k02", k: "plays", n: 10, rw: ["c", "coral"], icon: "✈️", name: ["단골 조종사", "常連パイロット", "Regular Pilot"], desc: ["10판 끝내기", "10回終える", "Finish 10 runs"] },
  { id: "k03", k: "plays", n: 50, rw: ["t"], icon: "🎖️", name: ["베테랑", "ベテラン", "Veteran"], desc: ["50판 끝내기", "50回終える", "Finish 50 runs"] },
  { id: "k04", k: "kills", n: 1, rw: ["t"], icon: "💥", name: ["첫 격추", "初撃墜", "First Kill"], desc: ["처음으로 격추", "初めて撃墜する", "Shoot down your first plane"] },
  { id: "k05", k: "kills", n: 100, rw: ["c", "navy"], icon: "🎯", name: ["명사수", "名射手", "Sharpshooter"], desc: ["모두 100대 격추", "合計100機撃墜", "Shoot down 100 planes in total"] },
  { id: "k06", k: "kills", n: 500, rw: ["t"], icon: "👑", name: ["하늘의 왕", "空の王", "King of the Skies"], desc: ["모두 500대 격추", "合計500機撃墜", "Shoot down 500 planes in total"] },
  { id: "k07", k: "bKills", n: 10, rw: ["c", "lava"], icon: "🔥", name: ["연쇄 격추", "連続撃墜", "Rampage"], desc: ["한 판에 10대 격추", "1回で10機撃墜", "Shoot down 10 planes in one run"] },
  { id: "k08", k: "bKills", n: 25, rw: ["t"], icon: "☄️", name: ["에이스 중의 에이스", "エースの中のエース", "Ace of Aces"], desc: ["한 판에 25대 격추", "1回で25機撃墜", "Shoot down 25 planes in one run"] },
  { id: "k09", k: "bScore", n: 1500, rw: ["c", "gold"], icon: "🏅", name: ["공중전의 별", "空戦の星", "Rising Star"], desc: ["한 판에 1,500점", "1回で1,500点", "Score 1,500 in one run"] },
  { id: "k10", k: "bScore", n: 3000, rw: ["t"], icon: "🌟", name: ["전설의 조종사", "伝説のパイロット", "Legendary Pilot"], desc: ["한 판에 3,000점", "1回で3,000点", "Score 3,000 in one run"] },
  { id: "k11", k: "bScore", n: 6000, rw: ["c", "aurora"], icon: "🌌", name: ["하늘의 전설", "空の伝説", "Sky Legend"], desc: ["한 판에 6,000점", "1回で6,000点", "Score 6,000 in one run"] },
  { id: "k12", k: "wins", n: 1, rw: ["t"], icon: "🥇", name: ["1등 조종사", "1位パイロット", "Top Gun"], desc: ["개인전 1등 (사람 2명 이상 또는 AI 20대 이상)", "個人戦1位(人2人以上またはAI20機以上)", "Finish 1st in free-for-all (2+ players or 20+ AI)"] },
  { id: "k13", k: "wins", n: 10, rw: ["c", "royal"], icon: "🏆", name: ["무패의 날개", "無敗の翼", "Unbeaten Wings"], desc: ["개인전 1등 10번", "個人戦1位10回", "Finish 1st 10 times"] },
  { id: "k14", k: "teamWins", n: 5, rw: ["t"], icon: "🤝", name: ["편대장", "編隊長", "Squadron Leader"], desc: ["팀전 5번 이기기", "チーム戦で5回勝つ", "Win 5 team battles"] },
  { id: "k15", k: "stars", n: 1000, rw: ["c", "sun"], icon: "⭐", name: ["별 수집가", "星コレクター", "Star Collector"], desc: ["별 모두 1,000 모으기", "星を合計1,000集める", "Collect 1,000 stars in total"] },
  { id: "k16", k: "assists", n: 100, rw: ["t"], icon: "🫡", name: ["든든한 윙맨", "頼れるウィングマン", "Trusty Wingman"], desc: ["도움 모두 100번", "アシスト合計100回", "Get 100 assists in total"] },
  { id: "k17", k: "bossKills", n: 1, rw: ["t"], icon: "🎈", name: ["비행선 격추반", "飛行船撃墜隊", "Airship Hunter"], desc: ["보스 쓰러뜨리기 (함께)", "ボスを倒す(みんなで)", "Help bring down a boss"] },
  { id: "k18", k: "bossTop", n: 1, rw: ["c", "abyss"], icon: "🗡️", name: ["보스 킬러", "ボスキラー", "Boss Slayer"], desc: ["보스 기여도 1등", "ボスの貢献度1位", "Top boss damage"] },
  { id: "k19", k: "bounty", n: 3, rw: ["t"], icon: "💰", name: ["현상금 사냥꾼", "賞金稼ぎ", "Bounty Hunter"], desc: ["현상금 붙은 비행기 모두 3번 격추", "賞金首を合計3回撃墜", "Shoot down 3 bounty targets"] },
  { id: "k20", k: "dodge", n: 50, rw: ["c", "cloud"], icon: "🌪️", name: ["곡예 비행", "曲芸飛行", "Barnstormer"], desc: ["배럴롤로 총알 모두 50발 피하기", "バレルロールで弾を合計50発かわす", "Dodge 50 bullets with barrel rolls"] },
  { id: "k21", k: "revenge", n: 1, rw: ["t"], icon: "😤", name: ["복수의 날개", "復讐の翼", "Wings of Vengeance"], desc: ["나를 격추한 비행기를 다시 격추", "自分を撃墜した機体を撃墜し返す", "Shoot down the plane that shot you down"] },
  { id: "k22", k: "noDeath", n: 1, rw: ["t"], icon: "😇", name: ["무적 비행", "無敵飛行", "Untouchable"], desc: ["한 번도 안 격추되고 5대 이상 격추", "一度も撃墜されず5機以上撃墜", "Shoot down 5+ planes without ever being shot down"] },
  { id: "k23", k: "bLeg", n: 2, rw: ["c", "prism"], icon: "✨", name: ["전설 수집가", "レジェンド収集家", "Legend Collector"], desc: ["한 판에 전설 증강 2개", "1回でレジェンド2個", "Hold 2 legendary augments in one run"] },
  { id: "k24", k: "bSyn", n: 3, rw: ["t"], icon: "✦", name: ["시너지 장인", "シナジー職人", "Synergy Master"], desc: ["한 판에 시너지 3개", "1回でシナジー3個", "Activate 3 synergies in one run"] },
  { id: "k25", k: "humans", n: 10, rw: ["c", "blood"], icon: "🩸", name: ["사람 사냥꾼", "プレイヤーハンター", "Player Hunter"], desc: ["다른 사람 비행기 모두 10번 격추", "他の人の機体を合計10回撃墜", "Shoot down other players 10 times"] },
  { id: "k26", k: "ejects", n: 5, rw: ["t"], icon: "🪂", name: ["불사의 조종사", "不死身のパイロット", "Survivor"], desc: ["비상 탈출로 모두 5번 버티기", "緊急脱出で合計5回耐える", "Survive 5 times with the Ejection Seat"] },
];
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
export const achHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ACH_SUM = ["plays", "kills", "wins", "teamWins", "stars", "assists", "bossKills", "bossTop", "bounty", "dodge", "revenge", "noDeath", "humans", "ejects"];
const ACH_MAX = ["bKills", "bScore", "bLeg", "bSyn"];
/** 한 판 결과를 기록에 더함. run = { win, teamWin, kills, score, stars, assists, bossKill, bossTop, bounty, dodge, revenge, deaths, humans, ejects, leg, syn } */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const add = { plays: 1, kills: num(run.kills), wins: run.win ? 1 : 0, teamWins: run.teamWin ? 1 : 0, stars: num(run.stars), assists: num(run.assists), bossKills: run.bossKill ? 1 : 0, bossTop: run.bossTop ? 1 : 0,
    bounty: num(run.bounty), dodge: num(run.dodge), revenge: num(run.revenge), noDeath: !num(run.deaths) && num(run.kills) >= 5 ? 1 : 0, humans: num(run.humans), ejects: num(run.ejects) };
  for (const k of ACH_SUM) s[k] = num(s[k]) + (add[k] || 0);
  const best = { bKills: num(run.kills), bScore: Math.round(num(run.score)), bLeg: num(run.leg), bSyn: num(run.syn) };
  for (const k of ACH_MAX) s[k] = Math.max(num(s[k]), best[k]);
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
export function achEquip(unlocked, want) {
  const u = new Set(unlocked || []), out = { c: null, t: null };
  const c = String(want?.c || ""), t = String(want?.t || "");
  if (achHas(ACH_COLORS, c) && ACHS.some(a => a.rw[0] === "c" && a.rw[1] === c && u.has(a.id))) out.c = c;
  if (achHas(ACH, t) && ACH[t].rw[0] === "t" && u.has(t)) out.t = t;
  return out;
}

// ---------- 2차 (2026-11-21): 하늘 테마 · 섬 대공포 ----------
export const THEMES = ["day", "sunset", "night"];
export const THEME_NAME = { day: ["낮", "昼", "Day"], sunset: ["노을", "夕焼け", "Sunset"], night: ["밤", "夜", "Night"] };
export const TURRET = { n: 4, r: 240, cap: 3, range: 650, cd: 0.45, dmg: 7, score: 150 };
// 연속 격추 이름 (4초 안에 연달아)
export const MULTI = { 2: ["더블 킬!", "ダブルキル!", "Double Kill!"], 3: ["트리플 킬!", "トリプルキル!", "Triple Kill!"], 4: ["쿼드라 킬!", "クアドラキル!", "Quadra Kill!"], 5: ["하늘의 학살자!", "空の殲滅者!", "Sky Rampage!"] };
