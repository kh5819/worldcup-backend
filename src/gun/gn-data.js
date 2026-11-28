// =========================
// GUN ARENA — 공용 데이터 (화면·서버 같은 파일: 서버는 scripts/sync-gun.mjs 로 복사)
// · 2D 횡스크롤 플랫폼 슈팅. 체력 없음 — 맞으면 밀려나고, 맵 밖으로 떨어지면 목숨 1개 잃음
// · 단위: 픽셀·초. 서버 틱 60Hz (1틱 = 1/60초). 화면 기준 틀 1600x900
// · 이름은 [한국어, 日本語, English]
// =========================
export const TPS = 60, DT = 1 / 60;
export const FRAME = { w: 1600, h: 900 };
export const BLAST = { l: -380, r: 1980, b: 1160, t: -900 }; // 이 밖으로 나가면 탈락
export const PHYS = {
  grav: 2100, maxFall: 1150, fastFall: 1550,
  run: 300, accG: 3400, accA: 2100, fricG: 2800, fricA: 500,
  kbFricG: 1200, kbFricA: 240, // 넉백으로 달리기보다 빠를 때
  jump: 820, djump: 720, coyote: 5, jbuf: 6, // 틱
  w: 28, h: 46,
  iceAcc: 0.22, iceFric: 0.09,
};
export const BITS = { L: 1, R: 2, J: 4, D: 8, F: 16, B: 32 };
export const MAX_PLAYERS = 8;
export const LIVES_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_LIVES = 5;
export const RESPAWN_TICKS = 100, SPAWN_INV = 150; // 1.7초 뒤 부활, 2.5초 무적
export const BOMB = { start: 2, max: 5, cd: 30, fuse: 84, r: 125, kb: 1000, spd: 600, up: 540 };
export const TIME_LIMIT = 300, SUDDEN = 240; // 4분부터 서든데스(넉백 1.5배), 5분이면 남은 목숨 많은 쪽 승리
export const CRATE_RATE = { 0: 0, 1: 9, 2: 6, 3: 3.5 }; // 상자 빈도 (초마다)
export const CRATE_LIFE = 18;
export const KO_CREDIT = 6;
// % 게이지: 맞을 때마다 넉백×0.035 만큼 쌓이고, 받는 넉백 = 기본 × (0.62 + %/110)  (0%면 0.62배 · 100%면 1.53배 · 200%면 2.44배)
export const PCT = { gain: 0.035, base: 0.62, div: 110, max: 999 };
export const MUZ = { x: 28, y: 27 }; // 총구 위치 (발 기준) // 마지막으로 친 사람이 6초 안이면 그 사람 처치

// ---------- 무기 20종 ----------
// k: bullet·hitscan·nade(포물선 폭발)·rocket·flame·bounce·boom(부메랑)·mine·wind·ice
// cd 초 · ammo(-1 무한) · spd px/s · kb 넉백 · rc 반동 · sp 퍼짐(라디안) · n 한 번에 몇 발 · life 초 · w 드롭 비중
export const WEAPONS = [
  { id: "pistol", n: ["권총", "ピストル", "Pistol"], k: "bullet", cd: 0.3, ammo: -1, spd: 1500, kb: 300, rc: 40, sp: 0.02, life: 0.9, w: 0, snd: "pistol", d: ["기본 무기 · 탄약 무한", "基本武器・弾無限", "Default · infinite ammo"] },
  { id: "magnum", n: ["매그넘", "マグナム", "Magnum"], k: "bullet", cd: 0.55, ammo: 8, spd: 1900, kb: 720, rc: 230, sp: 0, life: 0.9, w: 10, snd: "magnum", d: ["한 발이 묵직한 리볼버", "一発が重いリボルバー", "Heavy-hitting revolver"] },
  { id: "smg", n: ["기관단총", "サブマシンガン", "SMG"], k: "bullet", cd: 0.075, ammo: 45, spd: 1500, kb: 135, rc: 22, sp: 0.09, life: 0.7, w: 10, snd: "smg", d: ["빠르게 퍼붓는 연사", "高速連射", "Rapid spray"] },
  { id: "rifle", n: ["돌격소총", "アサルトライフル", "Assault Rifle"], k: "bullet", cd: 0.11, ammo: 32, spd: 1800, kb: 220, rc: 40, sp: 0.04, life: 0.9, w: 10, snd: "rifle", d: ["정확한 연사", "正確な連射", "Accurate auto fire"] },
  { id: "burst", n: ["점사 소총", "バーストライフル", "Burst Rifle"], k: "bullet", cd: 0.45, ammo: 30, burst: 3, gap: 0.06, spd: 1900, kb: 270, rc: 55, sp: 0.015, life: 0.9, w: 10, snd: "rifle", d: ["한 번에 3발씩", "3発ずつ発射", "Three-round bursts"] },
  { id: "shotgun", n: ["산탄총", "ショットガン", "Shotgun"], k: "bullet", cd: 0.7, ammo: 6, n2: 7, spd: 1400, kb: 155, rc: 380, sp: 0.22, life: 0.28, w: 10, snd: "shotgun", d: ["가까이서 강력 · 반동 큼", "近距離で強力・反動大", "Brutal up close · big recoil"] },
  { id: "sniper", n: ["저격총", "スナイパー", "Sniper"], k: "hitscan", cd: 1.1, ammo: 5, kb: 1150, rc: 420, len: 2300, w: 5, snd: "sniper", d: ["즉시 명중 · 아주 강한 넉백", "即着弾・超強力ノックバック", "Instant hit · huge knockback"] },
  { id: "minigun", n: ["미니건", "ミニガン", "Minigun"], k: "bullet", cd: 0.05, ammo: 150, spin: 0.35, spd: 1700, kb: 105, rc: 30, sp: 0.07, life: 0.8, slow: 0.5, w: 7, snd: "minigun", d: ["예열 뒤 끝없는 탄막 · 쏘는 동안 느림", "予熱後に弾幕・撃つ間は遅い", "Spins up into a storm · slows you"] },
  { id: "grenade", n: ["유탄발사기", "グレネードランチャー", "Grenade Launcher"], k: "nade", cd: 0.7, ammo: 6, spd: 900, up: 0.35, g: 1600, r: 95, kb: 820, rc: 160, life: 2.5, w: 7, snd: "thump", d: ["포물선으로 날아가 터짐", "放物線で飛んで爆発", "Lobbed explosive shells"] },
  { id: "rocket", n: ["로켓", "ロケット", "Rocket"], k: "rocket", cd: 0.9, ammo: 4, spd: 950, acc: 1400, max: 1600, r: 115, kb: 980, rc: 320, life: 2.5, w: 5, snd: "rocket", d: ["닿으면 큰 폭발 · 로켓 점프 가능", "当たると大爆発", "Big blast · rocket jumps"] },
  { id: "laser", n: ["레이저", "レーザー", "Laser"], k: "hitscan", cd: 0.28, ammo: 12, kb: 430, rc: 60, len: 1800, w: 7, snd: "laser", d: ["빛처럼 곧바로 명중", "光の速さで命中", "Light-speed beam"] },
  { id: "flame", n: ["화염방사기", "火炎放射器", "Flamethrower"], k: "flame", cd: 0.035, ammo: 120, spd: 650, kb: 80, rc: 6, sp: 0.2, life: 0.32, w: 7, snd: "flame", d: ["짧고 넓게 밀어냄 · 관통", "短く広く押し出す・貫通", "Short wide push · pierces"] },
  { id: "bounce", n: ["튕김총", "バウンドガン", "Bounce Gun"], k: "bounce", cd: 0.22, ammo: 16, spd: 1250, kb: 330, rc: 45, sp: 0.03, life: 1.6, nb: 4, w: 7, snd: "bounce", d: ["발판·벽에 4번 튕김", "足場や壁で4回跳ねる", "Ricochets 4 times"] },
  { id: "railgun", n: ["레일건", "レールガン", "Railgun"], k: "hitscan", cd: 1.4, ammo: 3, kb: 1500, rc: 700, len: 2600, pierce: 1, w: 3, snd: "rail", d: ["모두 관통 · 최강 넉백 · 반동도 최강", "全貫通・最強ノックバック", "Pierces all · strongest knockback"] },
  { id: "boomerang", n: ["부메랑", "ブーメラン", "Boomerang"], k: "boom", cd: 0.5, ammo: 6, spd: 1150, kb: 450, rc: 30, life: 1.7, w: 7, snd: "whoosh", d: ["갔다가 돌아옴 · 관통", "戻ってくる・貫通", "Comes back · pierces"] },
  { id: "mine", n: ["지뢰", "地雷", "Mine Layer"], k: "mine", cd: 0.5, ammo: 4, r: 100, kb: 950, rc: 0, life: 20, arm: 0.6, w: 5, snd: "click", d: ["발밑에 설치 · 적이 밟으면 펑", "足元に設置", "Lay traps on the floor"] },
  { id: "dual", n: ["쌍권총", "二丁拳銃", "Dual Pistols"], k: "bullet", cd: 0.12, ammo: 28, spd: 1600, kb: 245, rc: 20, sp: 0.03, life: 0.9, dual: 1, w: 10, snd: "pistol", d: ["양손 번갈아 연사", "左右交互に連射", "Alternating double fire"] },
  { id: "wind", n: ["송풍기", "ブロワー", "Wind Blaster"], k: "wind", cd: 0.09, ammo: 50, spd: 950, kb: 290, rc: 0, sp: 0.16, life: 0.22, w: 7, snd: "wind", d: ["피해 없이 강하게 밀어냄", "強風で押し出す", "Pure push, no recoil"] },
  { id: "cannon", n: ["대포", "大砲", "Cannon"], k: "nade", cd: 1.2, ammo: 3, spd: 1100, up: 0.05, g: 520, r: 90, kb: 1250, rc: 750, life: 2.5, big: 1, w: 5, snd: "cannon", d: ["거대한 포탄 · 반동으로 날아감", "巨大砲弾・反動で飛ぶ", "Huge ball · recoil launches you"] },
  { id: "freeze", n: ["빙결총", "フリーズガン", "Freeze Gun"], k: "ice", cd: 0.4, ammo: 10, spd: 1300, kb: 200, rc: 35, sp: 0.02, life: 1.0, frz: 1.2, w: 7, snd: "freeze", d: ["맞으면 1.2초 얼어서 미끄러짐", "当たると1.2秒凍って滑る", "Freezes for 1.2s — they slide"] },
];
export const W_IDX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));

// ---------- 아이템 10종 ---------- dur 초 (0 = 바로)
export const ITEMS = [
  { id: "bomb", n: ["폭탄 +2", "爆弾+2", "Bombs +2"], dur: 0, w: 14, d: ["폭탄 2개 추가 (최대 5)", "爆弾を2個追加(最大5)", "+2 bombs (max 5)"] },
  { id: "shield", n: ["방어막", "バリア", "Shield"], dur: 8, w: 12, hits: 4, d: ["8초 · 넉백 4번 막음", "8秒・ノックバックを4回防ぐ", "8s · blocks 4 hits"] },
  { id: "speed", n: ["신속", "スピード", "Speed"], dur: 8, w: 12, d: ["8초 · 이동 속도 +40%", "8秒・移動速度+40%", "8s · +40% move speed"] },
  { id: "jump", n: ["점프 강화", "ジャンプ強化", "Super Jump"], dur: 10, w: 12, d: ["10초 · 더 높이, 3단 점프", "10秒・より高く3段ジャンプ", "10s · higher, triple jump"] },
  { id: "star", n: ["무적", "無敵", "Invincible"], dur: 5, w: 6, d: ["5초 · 넉백을 전혀 안 받음", "5秒・ノックバック無効", "5s · immune to knockback"] },
  { id: "heavy", n: ["강철 부츠", "鋼鉄ブーツ", "Iron Boots"], dur: 10, w: 10, d: ["10초 · 받는 넉백 절반", "10秒・受けるノックバック半減", "10s · half knockback taken"] },
  { id: "power", n: ["파워 업", "パワーアップ", "Power Up"], dur: 8, w: 10, d: ["8초 · 주는 넉백 1.5배", "8秒・与えるノックバック1.5倍", "8s · 1.5x knockback dealt"] },
  { id: "rapid", n: ["속사", "連射", "Rapid Fire"], dur: 8, w: 10, d: ["8초 · 연사 속도 거의 2배", "8秒・連射速度ほぼ2倍", "8s · nearly 2x fire rate"] },
  { id: "jet", n: ["제트팩", "ジェットパック", "Jetpack"], dur: 6, w: 9, d: ["6초 · 공중에서 점프를 누르면 날아오름", "6秒・空中でジャンプ長押しで上昇", "6s · hold jump in the air to fly"] },
  { id: "life", n: ["목숨 +1", "残機+1", "Extra Life"], dur: 0, w: 3, d: ["목숨 1개 추가 (처음 목숨 +2까지)", "残機+1(最初の+2まで)", "+1 life (up to start +2)"] },
];
export const I_IDX = Object.fromEntries(ITEMS.map((w, i) => [w.id, i]));

// ---------- 캐릭터 꾸미기 ----------
export const LOOK = {
  skin: ["#ffe0c4", "#f6c9a0", "#e0a878", "#b87a50", "#7d4f32", "#f2d3ff"],
  hairC: ["#3a2a22", "#7a4a26", "#e8c25a", "#e85a4a", "#4a7ee8", "#f0f0f0", "#ff8fd0", "#3fd09a"],
  hair: 6, // 머리 모양 0~5
  body: ["#e84a5f", "#3f8ef0", "#38c172", "#f5b82e", "#9b59f0", "#ff7a2f", "#2fd5d5", "#f2f2f2", "#454a5a"],
  hat: 7, // 0 없음 · 1 모자 · 2 헬멧 · 3 비니 · 4 고양이 귀 · 5 머리띠 · 6 고글
  eye: 3,
};
export const DEFAULT_LOOK = { s: 0, hs: 0, hc: 0, b: 0, h: 0, e: 0 };
export function cleanLook(o) {
  const n = (v, m, d) => { v = Number(v); return Number.isInteger(v) && v >= 0 && v < m ? v : d; };
  o = o && typeof o === "object" ? o : {};
  return { s: n(o.s, LOOK.skin.length, 0), hs: n(o.hs, LOOK.hair, 0), hc: n(o.hc, LOOK.hairC.length, 0), b: n(o.b, LOOK.body.length, 0), h: n(o.h, LOOK.hat, 0), e: n(o.e, LOOK.eye, 0) };
}
export const TEAM_COL = ["#ff4d5e", "#3fa0ff"];
export const TEAM_NAME = [["레드", "レッド", "Red"], ["블루", "ブルー", "Blue"]];
export const BOT_LV = { easy: { think: 16, aim: 0.45, react: 22 }, normal: { think: 7, aim: 0.8, react: 11 }, hard: { think: 3, aim: 0.97, react: 4 } };
export const BOT_LV_NAME = { easy: ["초급", "初級", "Easy"], normal: ["중급", "中級", "Normal"], hard: ["고급", "上級", "Hard"] };
export const BOT_NAMES = ["버니", "토토", "뽀삐", "모찌", "콩이", "레오", "루비", "제트", "보리", "치즈", "나나", "두부", "카이", "미미", "탄이", "로또"];

// ---------- 맵 10종 ----------
// 발판: [x, y, w, h, 종류, 옵션]  종류 p = 아래에서 통과하는 발판 · s = 단단한 블록(옆·아래도 막힘)
// 옵션: ice 미끄러움 · cv 컨베이어 속도 · cr 무너짐 · mv 움직임 {ax, ay, per(초), ph} · vent 위로 날림
export const MAPS = [
  { id: "arena", n: ["기본 아레나", "ベーシックアリーナ", "Basic Arena"], th: "arena", d: ["정석 3층 구조", "定番の3層構造", "Classic three tiers"],
    plat: [[260, 660, 1080, 52, "s"], [420, 510, 240, 16, "p"], [940, 510, 240, 16, "p"], [660, 370, 280, 16, "p"], [400, 235, 180, 16, "p"], [1020, 235, 180, 16, "p"]],
    spawn: [[400, 660], [1200, 660], [540, 510], [1060, 510], [800, 370], [490, 235], [1110, 235], [800, 660]] },
  { id: "islands", n: ["공중섬", "空中島", "Sky Islands"], th: "islands", d: ["섬 사이 틈 · 주기적인 돌풍", "島の隙間・周期的な突風", "Gaps between islands · gusts of wind"], wind: 1,
    plat: [[190, 600, 270, 44, "s"], [640, 690, 320, 48, "s"], [1140, 600, 270, 44, "s"], [470, 455, 160, 16, "p"], [970, 455, 160, 16, "p"], [720, 320, 160, 16, "p"], [260, 300, 120, 16, "p"], [1220, 300, 120, 16, "p"]],
    spawn: [[320, 600], [1280, 600], [800, 690], [550, 455], [1050, 455], [800, 320], [320, 300], [1280, 300]] },
  { id: "lava", n: ["용암 지대", "溶岩地帯", "Lava Field"], th: "lava", d: ["용암이 차오르면 높은 곳으로!", "溶岩が上がったら高所へ!", "Climb when the lava rises!"], lava: 1,
    plat: [[280, 650, 1040, 50, "s"], [340, 500, 210, 16, "p"], [1050, 500, 210, 16, "p"], [695, 425, 210, 16, "p"], [500, 290, 190, 16, "p"], [910, 290, 190, 16, "p"], [720, 170, 160, 16, "p"]],
    spawn: [[400, 650], [1200, 650], [445, 500], [1155, 500], [800, 425], [595, 290], [1005, 290], [800, 650]] },
  { id: "ice", n: ["얼음 동굴", "氷の洞窟", "Ice Cave"], th: "ice", d: ["미끄러운 바닥 · 떨어지는 고드름", "滑る床・落ちるつらら", "Slippery floors · falling icicles"], icicle: 1,
    plat: [[160, 40, 1280, 48, "s"], [300, 650, 1000, 44, "s", { ice: 1 }], [400, 500, 220, 16, "p", { ice: 1 }], [980, 500, 220, 16, "p", { ice: 1 }], [690, 385, 220, 16, "p", { ice: 1 }], [250, 300, 160, 16, "p", { ice: 1 }], [1190, 300, 160, 16, "p", { ice: 1 }], [160, 88, 60, 140, "s"], [1380, 88, 60, 140, "s"]],
    spawn: [[420, 650], [1180, 650], [510, 500], [1090, 500], [800, 385], [330, 300], [1270, 300], [800, 650]] },
  { id: "roof", n: ["옥상", "屋上", "Rooftops"], th: "roof", d: ["빌딩 사이 낭떠러지 · 환풍구 점프대", "ビルの谷間・換気口ジャンプ台", "Gaps between buildings · vent launchers"],
    plat: [[170, 600, 330, 420, "s"], [580, 700, 300, 340, "s"], [960, 560, 290, 460, "s"], [1330, 640, 140, 380, "s"], [260, 450, 120, 16, "p"], [670, 500, 160, 16, "p"], [1040, 400, 140, 16, "p"], [700, 690, 70, 10, "v", { vent: 1250 }], [1360, 630, 70, 10, "v", { vent: 1150 }]],
    spawn: [[300, 600], [1100, 560], [730, 700], [1400, 640], [320, 450], [750, 500], [1110, 400], [420, 600]] },
  { id: "space", n: ["우주 정거장", "宇宙ステーション", "Space Station"], th: "space", d: ["낮은 중력 · 열리는 에어락", "低重力・開くエアロック", "Low gravity · airlock suction"], grav: 0.62, airlock: 1,
    plat: [[380, 620, 840, 40, "s"], [230, 470, 210, 16, "p"], [1160, 470, 210, 16, "p"], [640, 420, 320, 16, "p"], [720, 250, 160, 16, "p"], [420, 300, 140, 16, "p"], [1040, 300, 140, 16, "p"]],
    spawn: [[480, 620], [1120, 620], [335, 470], [1265, 470], [800, 420], [800, 250], [490, 300], [1110, 300]] },
  { id: "factory", n: ["폐공장", "廃工場", "Abandoned Factory"], th: "factory", d: ["컨베이어 벨트 · 내려찍는 프레스", "ベルトコンベア・プレス機", "Conveyor belts · crushing press"], press: 1,
    plat: [[230, 660, 520, 44, "s", { cv: 150 }], [850, 660, 520, 44, "s", { cv: -150 }], [320, 500, 220, 16, "p"], [1060, 500, 220, 16, "p"], [560, 380, 170, 16, "p"], [870, 380, 170, 16, "p"], [420, 250, 150, 16, "p"], [1030, 250, 150, 16, "p"]],
    spawn: [[350, 660], [1250, 660], [430, 500], [1170, 500], [645, 380], [955, 380], [495, 250], [1105, 250]] },
  { id: "moving", n: ["움직이는 플랫폼", "動く足場", "Moving Platforms"], th: "moving", d: ["발판이 계속 움직여요", "足場が動き続ける", "Everything is on the move"],
    plat: [[600, 680, 400, 40, "s"], [300, 540, 180, 16, "p", { mv: { ax: 180, ay: 0, per: 6, ph: 0 } }], [1120, 540, 180, 16, "p", { mv: { ax: 180, ay: 0, per: 6, ph: 0.5 } }], [210, 380, 150, 16, "p", { mv: { ax: 0, ay: 150, per: 5, ph: 0.25 } }], [1240, 380, 150, 16, "p", { mv: { ax: 0, ay: 150, per: 5, ph: 0.75 } }], [720, 380, 160, 16, "p", { mv: { ax: 160, ay: 70, per: 8, ph: 0, circ: 1 } }], [740, 210, 120, 16, "p"]],
    spawn: [[700, 680], [900, 680], [390, 540], [1210, 540], [800, 380], [800, 210], [650, 680], [950, 680]] },
  { id: "crumble", n: ["붕괴하는 발판", "崩れる足場", "Crumbling Floors"], th: "crumble", d: ["밟으면 잠시 뒤 무너져요", "踏むと少しして崩れる", "Tiles fall shortly after you step on them"], crumble: 1,
    plat: [], spawn: [[400, 640], [1200, 640], [520, 470], [1080, 470], [800, 310], [700, 640], [900, 640], [800, 470]] },
  { id: "random", n: ["무작위 장애물 아레나", "ランダム障害物アリーナ", "Random Obstacle Arena"], th: "random", d: ["판마다 다른 구조 · 튕기는 범퍼", "毎回違う構造・バンパー", "New layout every match · bumpers"], random: 1,
    plat: [], spawn: [] },
];
export const MAP_IDS = MAPS.map(m => m.id);

// 시드 난수 (서버·화면 같은 결과)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash2 = (a, b) => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d) >>> 0; return (h ^ (h >>> 15)) >>> 0; };

// 맵 만들기 → { id, th, grav, plats: [{x,y,w,h,t,ice,cv,cr,mv,vent}], bump: [{x,y,r}], spawn, opt }
export function buildMap(id, seed = 1) {
  const M = MAPS.find(m => m.id === id) || MAPS[0];
  const plats = [], bump = [];
  const add = (a) => { const o = a[5] || {}; plats.push({ x: a[0], y: a[1], w: a[2], h: a[3], t: a[4], ice: !!o.ice, cv: o.cv || 0, cr: !!o.cr, mv: o.mv || null, vent: o.vent || 0 }); };
  let spawn = M.spawn.slice();
  if (M.crumble) {
    for (let i = 0; i < 14; i++) add([260 + i * 77, 640, 76, 28, "s", { cr: 1 }]);
    for (let i = 0; i < 10; i++) add([415 + i * 77, 470, 76, 16, "p", i === 4 || i === 5 ? {} : { cr: 1 }]);
    for (let i = 0; i < 5; i++) add([607 + i * 77, 310, 76, 16, "p", { cr: 1 }]);
  } else if (M.random) {
    const R = rng(seed ^ 0x51ed);
    const fw = 760 + Math.floor(R() * 5) * 80, fx = 800 - fw / 2;
    add([fx, 660, fw, 48, "s"]);
    spawn = [[fx + 80, 660], [fx + fw - 80, 660]];
    const cols = [260, 520, 800, 1080, 1340], rows = [520, 390, 260];
    const used = new Set();
    let n = 0;
    for (let tries = 0; tries < 40 && n < 7; tries++) {
      const c = Math.floor(R() * cols.length), r = Math.floor(R() * rows.length), key = c + "," + r;
      if (used.has(key)) continue; used.add(key);
      const w = 140 + Math.floor(R() * 4) * 30, x = cols[c] - w / 2 + Math.round((R() - 0.5) * 60), y = rows[r] + Math.round((R() - 0.5) * 30);
      const solid = R() < 0.25;
      add([x, y, w, solid ? 34 : 16, solid ? "s" : "p"]);
      spawn.push([x + w / 2, y]); n++;
    }
    // 같은 열 위아래가 너무 붙으면 괜찮음(한 줄 130px 간격) · 범퍼 2~3개 (발판과 안 겹치게)
    const nb = 2 + Math.floor(R() * 2);
    for (let tries = 0; tries < 60 && bump.length < nb; tries++) {
      const x = 260 + Math.round(R() * 1080), y = 200 + Math.round(R() * 360), r = 26;
      if (plats.some(p => x + r + 30 > p.x && x - r - 30 < p.x + p.w && y + r + 50 > p.y && y - r - 30 < p.y + p.h)) continue;
      if (bump.some(b => Math.hypot(b.x - x, b.y - y) < 160)) continue;
      bump.push({ x, y, r });
    }
    while (spawn.length < 8) spawn.push(spawn[spawn.length % 2]);
  } else for (const a of M.plat) add(a);
  return { id: M.id, th: M.th, grav: M.grav || 1, plats, bump, spawn, opt: { wind: !!M.wind, lava: !!M.lava, icicle: !!M.icicle, airlock: !!M.airlock, press: !!M.press, crumble: !!M.crumble } };
}

// ---------- 환경 기믹 (시간만으로 정해짐 → 화면 예측도 같게) ----------
export const LAVA = { per: 22, warn: 3, rise: 1.5, hold: 4.5, low: 940, high: 628, first: 12 };
export const WIND = { per: 13, warn: 1.5, on: 4, force: 950, first: 8 };
export const AIRLOCK = { per: 17, warn: 1.5, on: 3, force: 1150, first: 10 };
export const PRESS = { per: 8, warn: 1.1, down: 0.25, x: 755, w: 90, top: 120, bot: 650, kb: 1150 };
// t: 경기 시간(초) → { wind: 가로 힘(px/s²), warn: 'wind'|'lava'|'air'|'press'|null, dir, lavaY, press: 0~1 (내려온 정도) }
export function envAt(map, seed, t) {
  const e = { wind: 0, warn: null, dir: 0, lavaY: 99999, press: 0, pressHot: false };
  const o = map.opt;
  if (o.wind || o.airlock) {
    const C = o.wind ? WIND : AIRLOCK, tt = t - C.first;
    if (tt >= 0) {
      const cyc = Math.floor(tt / C.per), ph = tt - cyc * C.per, dir = (hash2(seed, cyc + 7) & 1) ? 1 : -1;
      e.dir = dir;
      if (ph < C.warn) e.warn = o.wind ? "wind" : "air";
      else if (ph < C.warn + C.on) { e.wind = dir * C.force; e.warn = o.wind ? "wind" : "air"; }
    }
  }
  if (o.lava) {
    const tt = t - LAVA.first; e.lavaY = LAVA.low;
    if (tt >= 0) {
      const ph = tt % LAVA.per;
      if (ph < LAVA.warn) e.warn = "lava";
      else if (ph < LAVA.warn + LAVA.rise) { e.lavaY = LAVA.low + (LAVA.high - LAVA.low) * ((ph - LAVA.warn) / LAVA.rise); e.warn = "lava"; }
      else if (ph < LAVA.warn + LAVA.rise + LAVA.hold) { e.lavaY = LAVA.high; e.warn = "lava"; }
      else if (ph < LAVA.warn + LAVA.rise * 2 + LAVA.hold) e.lavaY = LAVA.high + (LAVA.low - LAVA.high) * ((ph - LAVA.warn - LAVA.rise - LAVA.hold) / LAVA.rise);
    }
  }
  if (o.press) {
    const tt = t - 5;
    if (tt >= 0) {
      const ph = tt % PRESS.per;
      if (ph < PRESS.warn) { e.warn = "press"; e.press = 0.08 * Math.sin(ph * 40) * 0.5 + 0.04; }
      else if (ph < PRESS.warn + PRESS.down) { e.press = 1; e.pressHot = true; }
      else if (ph < PRESS.warn + PRESS.down + 1.2) e.press = 1 - (ph - PRESS.warn - PRESS.down) / 1.2;
    }
  }
  return e;
}
// 움직이는 발판 위치
export function platAt(p, t) {
  if (!p.mv) return p;
  const m = p.mv, a = (t / m.per + m.ph) * Math.PI * 2;
  const dx = m.circ ? Math.cos(a) * m.ax : Math.sin(a) * m.ax, dy = Math.sin(a) * m.ay;
  return { ...p, x: p.x + dx, y: p.y + dy };
}

// ---------- 화면 문구 공용 ----------
export const LANGS = ["ko", "ja", "en"];
export const nm = (arr, lang) => Array.isArray(arr) ? (arr[LANGS.indexOf(lang)] ?? arr[0]) : String(arr ?? "");
