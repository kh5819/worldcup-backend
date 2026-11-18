// =========================
// 플듀 블록로얄 보스 레이드 — 데이터·수치 (2026-11-18)
// 브라우저와 서버가 같은 파일을 씀 (worldcup-backend/src/br-raid-data.js = 홈페이지 제작/js/blockroyale/br-raid-data.js)
// 글자는 [한국어, 日本語, English]
// =========================

// ---- 줄 제거 피해 (서버가 조각 하나마다 한 번만 계산)
// 순서: 기본(줄·T스핀·스핀) → +퍼펙트 → ×콤보(1단계마다 +5%, 최대 +50%) → ×백투백 1.2 → ×증강·팀 버프 → 소수점 버림
export const DMG = {
  line: [0, 10, 25, 45, 80],
  tspin: [0, 35, 70, 110], mini: [0, 12, 24], spin: [0, 15, 35, 60, 90],
  perfect: 150, comboStep: 0.05, comboMax: 0.5, b2b: 1.2,
  onePartShield: 0.3, // 방어막에는 1줄 제거가 30%만 들어감
};
// ---- 인원 구간 (시작할 때 인원으로 확정, 중간에 나가도 안 바뀜)
export const TIERS = [
  { max: 1, key: "solo", hp: 1, spd: 1, tgt: 1, time: 0 },
  { max: 4, key: "small", hp: 1.1, spd: 1.1, tgt: 0.55, time: 0 },
  { max: 8, key: "elite", hp: 1.2, spd: 1.2, tgt: 0.45, time: 15 },
  { max: 24, key: "large", hp: 1.35, spd: 1.35, tgt: 0.4, time: 30 },
  { max: 50, key: "world", hp: 1.5, spd: 1.5, tgt: 0.35, time: 45 },
];
export const tierOf = (n) => TIERS.find((t) => n <= t.max) || TIERS[TIERS.length - 1];
export const TIER_NAME = { solo: ["솔로", "ソロ", "Solo"], small: ["소규모 협동", "少人数協力", "Small party"], elite: ["정예 레이드", "精鋭レイド", "Elite raid"], large: ["대규모 레이드", "大規模レイド", "Large raid"], world: ["월드 보스", "ワールドボス", "World boss"] };
/** 보스 체력: 인원^1.05 × 구간 배율(1.0~1.5) — 사람이 많을수록 한 사람 몫이 커져 더 어려움 (2026-11-18 사용자 요청) */
export const hpFor = (base, n) => Math.round(base * Math.pow(Math.max(1, n), 1.05) * tierOf(n).hp);
export const RAID = {
  phaseAt: [0.6, 0.25], phaseInvuln: 2000, stunMul: 1.25, enrageAt: 0.2, enrageSpd: 0.7,
  minGapPerPlayer: 5000, dangerHeight: 16, protectMs: 5000, maxRevive: 2,
  reviveGain: 7, reviveFull: 100, joint: { window: 5000, cd: 20000, need: [3, 5, 10, 20], pct: [0.004, 0.006, 0.008, 0.01] },
  delayCap: 8000, delayWindow: 30000,
  augHp: 1.6, // 증강 보스 레이드는 증강이 세서 보스 체력 1.6배
};
export const JOINT_NAME = [["번개 연계", "稲妻連携", "Chain Lightning"], ["화염 폭격", "火炎爆撃", "Fire Barrage"], ["대형 메테오", "大メテオ", "Grand Meteor"], ["월드 레이드 필살기", "ワールドレイド必殺技", "World Raid Finisher"]];

// ---- 보스 공격 종류
// garb: 방해 줄 n줄 (hole: rnd 무작위·same 한 열·col 정해진 열·yut 윷판 무늬·center 가운데)
// debuff: 화면 방해 fx(hideNext 다음 블록 가림 · hideGhost 고스트 숨김 · holdSeal 보관 봉인 · fog 시야 축소 · ink 먹물 · tentacle 촉수 가림 · speed 낙하 속도 · fake 가짜 블록 · shake 흔들림) dur ms
// bomb: 개인 미션 — 조각 pieces개 안에 줄 need줄 지우기. 성공: 보스에게 반격(최대 체력 rew%), 실패: 방해 줄 fail줄
// column: 열 cols개 예고 → 그 열 높이가 thr 이상인 사람만 n줄
// team: 팀 미션 goal(lines 줄·tech 4줄/T스핀/퍼펙트·shape 정해진 조각으로 줄 지우기) n개(인원 따라 늘어남) sec초 안에 → ok: stun 기절·golden 황금 공격·delay 행동 지연 / 실패: fail줄
// shield: 방어막 pct(최대 체력 비율) · summon: 부위 part ×count, 부위 하나 체력 hp(최대 체력 비율) · steal: 구조 게이지 −30·팀 버프 제거
// tgt: 공격받는 인원 비율(구간 비율과 곱) · "all" 전원 · warn 예고 ms · w 고르는 무게 · big 강한 공격(절대 방어 대상)
const G = (n, hole, extra = {}) => ({ k: "garb", n, hole, warn: 2500, w: 3, ...extra });
const D = (fx, dur, extra = {}) => ({ k: "debuff", fx, dur, warn: 2000, w: 2, ...extra });

export const BOSSES = {
  slime: {
    star: 1, hp: 1030, time: 300, every: 8100, art: "slime", color: "#5ee07a", bg: "bg-swamp",
    name: ["슬라임 킹", "スライムキング", "Slime King"], desc: ["점액으로 판을 더럽히고, 맞으면 작은 슬라임으로 갈라져요", "粘液で盤面を汚し、ダメージで小さなスライムに分裂", "Splatters slime and splits into minis when hurt"],
    weak: ["작은 슬라임을 잡으면 본체에 추가 피해", "小スライムを倒すと本体に追加ダメージ", "Killing minis hurts the king"],
    phases: [
      [G(1, "same", { id: "ooze", w: 4 }), D("ink", 5000, { id: "stain", w: 2 }), G(2, "rnd", { id: "press", w: 2, tgt: 0.5 })],
      [{ k: "summon", part: "slime", count: 3, hp: 0.06, id: "split", w: 0, once: true }, G(2, "same", { id: "ooze2", w: 3 }), D("ink", 6000, { id: "stain2", w: 2 })],
      [G(2, "rnd", { id: "rampage", w: 4, tgt: "all", big: true }), { k: "summon", part: "slime", count: 2, hp: 0.05, id: "split2", w: 1, max: 4 }, D("fog", 6000, { id: "goo", w: 2 })],
    ],
  },
  dragon: {
    star: 2, hp: 1800, time: 330, every: 7700, art: "dragon", color: "#ff6a3c", bg: "bg-lava",
    name: ["화염 드래곤", "火炎ドラゴン", "Flame Dragon"], desc: ["폭탄 블록과 불타는 줄로 공격해요", "爆弾ブロックと炎の列で攻撃", "Attacks with bombs and burning rows"],
    weak: ["폭탄 미션을 성공하면 드래곤에게 반격", "爆弾ミッション成功で反撃", "Clear bomb missions to counterattack"],
    phases: [
      [G(1, "rnd", { id: "ember", w: 3 }), { k: "bomb", pieces: 7, need: 2, fail: 3, rew: 0.02, id: "bomb", w: 3, warn: 1500 }, { k: "column", cols: 2, thr: 10, n: 2, id: "bombard", w: 2, warn: 3000 }],
      [G(2, "col", { id: "flamerow", w: 3 }), { k: "bomb", pieces: 6, need: 2, fail: 3, rew: 0.02, id: "bomb2", w: 3, warn: 1500 }, D("shake", 2500, { id: "roar", w: 1, tgt: "all" })],
      [G(3, "rnd", { id: "breath", w: 3, tgt: "all", big: true, warn: 3000 }), { k: "bomb", pieces: 6, need: 3, fail: 4, rew: 0.03, id: "bomb3", w: 3, warn: 1500 }, { k: "column", cols: 3, thr: 9, n: 3, id: "bombard2", w: 2, warn: 3000 }],
    ],
  },
  ice: {
    star: 2, hp: 1350, time: 330, every: 8100, art: "ice", color: "#7fd8ff", bg: "bg-ice",
    name: ["얼음 여왕", "氷の女王", "Ice Queen"], desc: ["보관을 얼리고 고스트를 숨기며 얼음 장벽을 세워요", "ホールドを凍らせゴーストを隠し、氷の壁を張る", "Freezes your hold, hides the ghost, raises ice walls"],
    weak: ["팀이 함께 줄을 지워 얼음 장벽(방어막)을 깨면 기절", "チームでラインを消して氷の壁を壊すと気絶", "Break the ice wall together to stun her"],
    phases: [
      [D("holdSeal", 8000, { id: "frosthold", w: 3 }), D("hideGhost", 8000, { id: "whiteout", w: 2 }), G(1, "same", { id: "icerow", w: 3 })],
      [{ k: "shield", pct: 0.12, id: "icewall", w: 2, once: true, stunOnBreak: 6000 }, D("holdSeal", 9000, { id: "frosthold2", w: 2 }), G(2, "same", { id: "icerow2", w: 3 }), { k: "team", goal: "lines", n: 12, sec: 25, ok: "stun", okSec: 5000, fail: 2, id: "thaw", w: 1 }],
      [{ k: "shield", pct: 0.1, id: "icewall2", w: 2, stunOnBreak: 6000 }, G(3, "rnd", { id: "blizzard", w: 3, tgt: "all", big: true }), D("fog", 7000, { id: "snowfog", w: 2 })],
    ],
  },
  machine: {
    star: 3, hp: 950, time: 360, every: 7200, art: "machine", color: "#9aa7b8", bg: "bg-factory",
    name: ["기계 군주", "機械君主", "Machine Lord"], desc: ["레이저와 드론, 방어막으로 버텨요", "レーザーとドローン、シールドで耐える", "Lasers, drones and energy shields"],
    weak: ["방어막은 2줄 이상 제거로만 제대로 깨짐 · 드론을 잡으면 팀 공격력 +10%", "シールドは2ライン以上でしか割れない・ドローン撃破で攻撃力+10%", "Shields only break with 2+ line clears · drones down = team +10% damage"],
    phases: [
      [{ k: "column", cols: 2, thr: 11, n: 2, id: "laser", w: 3, warn: 3000 }, G(2, "same", { id: "scrap", w: 3 }), { k: "shield", pct: 0.05, id: "barrier", w: 1 }],
      [{ k: "summon", part: "drone", count: 3, hp: 0.04, id: "drones", w: 0, once: true }, { k: "column", cols: 3, thr: 10, n: 2, id: "laser2", w: 3, warn: 3000 }, { k: "shield", pct: 0.06, id: "barrier2", w: 1 }, G(2, "col", { id: "lockdown", w: 2 })],
      [G(3, "same", { id: "overdrive", w: 3, tgt: "all", big: true }), { k: "summon", part: "drone", count: 2, hp: 0.04, id: "drones2", w: 1, max: 4 }, { k: "shield", pct: 0.06, id: "barrier3", w: 1 }],
    ],
  },
  shadow: {
    star: 3, hp: 1800, time: 360, every: 7700, art: "shadow", color: "#a66bff", bg: "bg-shadow",
    name: ["그림자 마법사", "影の魔法使い", "Shadow Mage"], desc: ["다음 블록을 가리고 가짜 블록 환영을 보여 줘요 (진짜 판은 그대로)", "NEXTを隠し、偽ブロックの幻を見せる(本物の盤面は変わらない)", "Hides your NEXT and shows fake-block illusions (your real board is unchanged)"],
    weak: ["저주 해제 미션(4줄·T스핀·퍼펙트)을 해내면 기절", "解呪ミッション(4ライン・Tスピン・パーフェクト)で気絶", "Complete the cleansing mission (quad/T-spin/perfect) to stun"],
    phases: [
      [D("hideNext", 8000, { id: "veil", w: 3 }), D("fake", 7000, { id: "illusion", w: 2 }), G(1, "rnd", { id: "curse", w: 3 })],
      [D("fog", 8000, { id: "dark", w: 3 }), D("holdSeal", 7000, { id: "bind", w: 2 }), G(2, "rnd", { id: "curse2", w: 3 }), { k: "team", goal: "tech", n: 1, sec: 30, ok: "stun", okSec: 6000, fail: 2, id: "cleanse", w: 2 }],
      [D("fake", 9000, { id: "illusion2", w: 2, tgt: "all" }), G(3, "center", { id: "void", w: 3, big: true }), D("hideNext", 9000, { id: "veil2", w: 2 }), { k: "team", goal: "tech", n: 2, sec: 30, ok: "stun", okSec: 6000, fail: 3, id: "cleanse2", w: 2 }],
    ],
  },
  golem: {
    star: 3, hp: 1800, time: 360, every: 7200, art: "golem", color: "#ffe14a", bg: "bg-storm",
    name: ["번개 골렘", "雷のゴーレム", "Thunder Golem"], desc: ["번개가 떨어질 열을 미리 보여 줘요. 그 열을 낮게 유지하면 안 맞아요", "雷が落ちる列を予告。その列を低く保てば当たらない", "Shows where lightning strikes — keep those columns low to dodge"],
    weak: ["팀이 줄을 지울수록 충전 게이지가 내려가요. 꽉 차면 전원에게 큰 번개", "ラインを消すほど充電ゲージが下がる。満タンで全員に大落雷", "Line clears drain its charge; a full charge hits everyone"],
    charge: { perSec: 1.2, perLine: 2.2, n: 3 },
    phases: [
      [{ k: "column", cols: 2, thr: 10, n: 2, id: "bolt", w: 4, warn: 3000 }, G(1, "col", { id: "shock", w: 3 }), D("shake", 2000, { id: "static", w: 1 })],
      [{ k: "column", cols: 3, thr: 10, n: 2, id: "bolt2", w: 4, warn: 3000 }, G(2, "col", { id: "chain", w: 3, tgt: 0.7 }), D("shake", 2500, { id: "static2", w: 1 })],
      [{ k: "column", cols: 4, thr: 9, n: 3, id: "bolt3", w: 4, warn: 3000, big: true }, G(2, "rnd", { id: "wall", w: 2, tgt: "all" })],
    ],
  },
  time: {
    star: 4, hp: 2500, time: 390, every: 6800, art: "time", color: "#e8c98a", bg: "bg-clock",
    name: ["시간의 관리자", "時の管理者", "Keeper of Time"], desc: ["낙하 속도를 올리고 보관을 잠그고 시간 폭탄을 걸어요", "落下速度を上げ、ホールドを封じ、時限爆弾を仕掛ける", "Speeds up gravity, locks hold, plants time bombs"],
    weak: ["정해진 시간 안에 팀이 줄을 지우면 행동이 늦어져요", "制限時間内にチームでラインを消すと行動が遅れる", "Clear enough lines in time to delay its actions"],
    phases: [
      [D("speed", 10000, { id: "haste", w: 3 }), D("holdSeal", 8000, { id: "stop", w: 2 }), { k: "bomb", pieces: 8, need: 2, fail: 3, rew: 0.015, id: "timebomb", w: 2, warn: 1500 }, G(1, "rnd", { id: "rift", w: 2 })],
      [D("speed", 12000, { id: "haste2", w: 3 }), { k: "team", goal: "lines", n: 15, sec: 25, ok: "delay", okSec: 8000, fail: 2, id: "rewind", w: 2 }, G(2, "rnd", { id: "rift2", w: 3 }), { k: "bomb", pieces: 7, need: 2, fail: 3, rew: 0.02, id: "timebomb2", w: 2, warn: 1500 }],
      [D("speed", 14000, { id: "haste3", w: 3, tgt: "all" }), G(3, "same", { id: "collapse", w: 3, big: true }), { k: "team", goal: "lines", n: 18, sec: 25, ok: "delay", okSec: 8000, fail: 3, id: "rewind2", w: 2 }],
    ],
  },
  kraken: {
    star: 4, hp: 1650, time: 390, every: 7200, art: "kraken", color: "#3fc6c0", bg: "bg-deep",
    name: ["심해의 크라켄", "深海のクラーケン", "Kraken of the Deep"], desc: ["촉수가 살아 있는 동안 본체는 피해를 거의 안 받아요", "触手が生きている間、本体はほぼダメージを受けない", "Takes little damage while its tentacles live"],
    weak: ["촉수 4개를 부수면 본체가 드러나요 (공격 대상 고르기)", "触手4本を壊すと本体が露出(攻撃対象を選べる)", "Break the 4 tentacles to expose the body (choose your target)"],
    bodyGuard: 0.35,
    phases: [
      [{ k: "summon", part: "tentacle", count: 4, hp: 0.07, id: "tentacles", w: 0, once: true }, D("tentacle", 7000, { id: "grab", w: 3 }), G(2, "rnd", { id: "wave", w: 3 }), D("ink", 6000, { id: "ink", w: 2 })],
      [G(2, "col", { id: "seal", w: 3 }), D("tentacle", 8000, { id: "grab2", w: 3 }), D("ink", 7000, { id: "ink2", w: 2 })],
      [{ k: "summon", part: "tentacle", count: 2, hp: 0.05, id: "regrow", w: 1, max: 4 }, G(3, "rnd", { id: "maelstrom", w: 3, tgt: "all", big: true }), D("ink", 8000, { id: "ink3", w: 2 })],
    ],
  },
  dokkaebi: {
    star: 5, hp: 3110, time: 420, every: 6800, art: "dokkaebi", color: "#ff5a6e", bg: "bg-hanok",
    name: ["도깨비 대왕", "トッケビ大王", "Dokkaebi King"], desc: ["방망이와 장난으로 판을 흔드는 플듀 대표 보스", "金棒といたずらで盤面を揺さぶるPlayDuo代表ボス", "PlayDuo's signature boss — club smashes and goblin pranks"],
    weak: ["도깨비가 요구하는 블록 모양으로 줄을 지우면 기절 + 황금 공격", "トッケビが求める形で消すと気絶+黄金攻撃", "Clear lines with the shape it demands to stun it and unleash a golden strike"],
    phases: [
      [G(2, "rnd", { id: "club", w: 3, tgt: 0.5 }), D("fake", 7000, { id: "prank", w: 2 }), { k: "team", goal: "shape", n: 3, sec: 30, ok: "golden", okPct: 0.05, okSec: 5000, fail: 2, id: "demand", w: 2 }],
      [G(2, "yut", { id: "yutboard", w: 3 }), D("holdSeal", 8000, { id: "curse", w: 1 }), D("hideNext", 7000, { id: "curse2", w: 1 }), { k: "steal", id: "gold", w: 1 }, { k: "team", goal: "shape", n: 3, sec: 30, ok: "golden", okPct: 0.05, okSec: 5000, fail: 3, id: "demand2", w: 2 }],
      [G(3, "yut", { id: "yutboard2", w: 3, tgt: "all", big: true }), G(3, "rnd", { id: "club2", w: 2, tgt: 0.6 }), D("fake", 9000, { id: "prank2", w: 2, tgt: "all" }), { k: "team", goal: "shape", n: 4, sec: 30, ok: "golden", okPct: 0.06, okSec: 6000, fail: 3, id: "demand3", w: 2 }],
    ],
  },
  void: {
    star: 5, hp: 2800, time: 450, every: 6300, art: "void", color: "#c86bff", bg: "bg-void",
    name: ["공허의 지배자", "虚無の支配者", "Lord of the Void"], desc: ["블랙홀·공간 왜곡·분신, 그리고 앞선 보스들의 힘을 써요", "ブラックホール・空間歪曲・分身、そして他のボスの力を使う", "Black holes, warped space, clones — and the powers of every other boss"],
    weak: ["분신을 먼저 부수면 본체 피해가 정상으로 돌아와요", "分身を先に壊すと本体へのダメージが戻る", "Destroy its clone to restore full damage to the body"],
    cloneGuard: 0.5, borrow: ["slime", "dragon", "ice", "machine", "shadow", "golem", "time", "kraken", "dokkaebi"],
    phases: [
      [G(2, "center", { id: "blackhole", w: 3 }), D("fog", 7000, { id: "erosion", w: 2 }), { k: "borrow", id: "echo", w: 2 }],
      [{ k: "summon", part: "clone", count: 1, hp: 0.12, id: "clone", w: 0, once: true }, D("fake", 8000, { id: "warp", w: 2 }), G(2, "rnd", { id: "multi", w: 3, tgt: "all" }), { k: "borrow", id: "echo2", w: 2 }],
      [G(3, "center", { id: "collapse", w: 3, tgt: "all", big: true }), D("hideNext", 8000, { id: "nothing", w: 2 }), { k: "summon", part: "clone", count: 1, hp: 0.1, id: "clone2", w: 1, max: 1 }, { k: "borrow", id: "echo3", w: 3 }],
    ],
  },
};
export const BOSS_IDS = Object.keys(BOSSES);
export const PART_NAME = { slime: ["작은 슬라임", "小スライム", "Mini slime"], drone: ["공격 드론", "攻撃ドローン", "Drone"], tentacle: ["촉수", "触手", "Tentacle"], clone: ["공허의 분신", "虚無の分身", "Void clone"] };
export const PHASE_NAME = [["1페이즈", "フェーズ1", "Phase 1"], ["2페이즈", "フェーズ2", "Phase 2"], ["3페이즈", "フェーズ3", "Phase 3"]];
export const VOID_PHASE = [["공허의 침식", "虚無の侵食", "Void Erosion"], ["차원 붕괴", "次元崩壊", "Dimensional Collapse"], ["최종 광폭화", "最終暴走", "Final Frenzy"]];
export const FX_NAME = { hideNext: ["다음 블록 봉인", "NEXT封印", "NEXT sealed"], hideGhost: ["고스트 숨김", "ゴースト消失", "Ghost hidden"], holdSeal: ["보관 봉인", "ホールド封印", "Hold sealed"], fog: ["시야 축소", "視界縮小", "Vision shrunk"], ink: ["먹물", "墨", "Ink"], tentacle: ["촉수 가림", "触手", "Tentacle grab"], speed: ["낙하 가속", "落下加速", "Gravity up"], fake: ["가짜 블록 환영", "偽ブロック", "Fake blocks"], shake: ["흔들림", "揺れ", "Shake"] };

// ---- 증강 보스 레이드 전용 증강 40종 (id 는 r_ 로 시작)
// t: atk 공격 · def 방어 · sup 지원 · spc 특수 / op: 엔진 사용형(1·2·3 키) / v: 수치
export const RAID_AUGS = {
  // 일반
  r_swordRain: { r: "common", t: "atk", v: 6 }, r_strike: { r: "common", t: "atk", v: 0.15 }, r_combo: { r: "common", t: "atk", v: 2 }, r_wall: { r: "common", t: "def", v: 1 },
  r_recover: { r: "common", t: "def", v: 2, max: 4 }, r_lucky: { r: "common", t: "atk", v: 0.4 }, r_weak: { r: "common", t: "atk", v: 0.3 }, r_focus: { r: "common", t: "atk", v: 0.2, win: 3000 },
  r_cheer: { r: "common", t: "sup", v: 0.02, max: 0.1, dur: 10000 }, r_steady: { r: "common", t: "def", v: 0.5 },
  // 희귀
  r_chainBolt: { r: "rare", t: "atk", v: 20 }, r_flameBurst: { r: "rare", t: "atk", v: 120, every: 5 }, r_iceArrow: { r: "rare", t: "spc", v: 2000 }, r_laser: { r: "rare", t: "atk", v: 200 },
  r_vamp: { r: "rare", t: "def", v: 300, max: 4 }, r_shield: { r: "rare", t: "def", v: 1 }, r_blockBomb: { r: "rare", t: "spc", op: "Q", c: 2 }, r_goldTetris: { r: "rare", t: "atk", v: 0.6 },
  r_drone: { r: "rare", t: "atk", v: 25, every: 8000 }, r_rescue: { r: "rare", t: "sup", v: 2 },
  // 영웅
  r_meteor: { r: "epic", t: "atk", v: 500, every: 20 }, r_timeWarp: { r: "epic", t: "spc", v: 6000 }, r_storm: { r: "epic", t: "atk", v: 30 }, r_purify: { r: "epic", t: "def", op: "G", c: 2 },
  r_undying: { r: "epic", t: "def" }, r_legion: { r: "epic", t: "atk", v: 2 }, r_breaker: { r: "epic", t: "atk", v: 2 }, r_unison: { r: "epic", t: "sup", v: 0.5, max: 1 },
  r_fury: { r: "epic", t: "atk", v: 0.5, h: 12 }, r_feather: { r: "epic", t: "sup", v: 1 },
  // 전설
  r_judgment: { r: "legendary", t: "atk", v: 0.04 }, r_bladeDance: { r: "legendary", t: "atk", v: 20, dur: 10000 }, r_goldRush: { r: "legendary", t: "atk", v: 0.25 }, r_rewind: { r: "legendary", t: "def", v: 2 },
  r_absolute: { r: "legendary", t: "def", v: 1 }, r_dragon: { r: "legendary", t: "atk", v: 60, dur: 15000, every: 2000 }, r_reversal: { r: "legendary", t: "spc", v: 0.6 }, r_collapse: { r: "legendary", t: "atk", v: 0.05, max: 3 },
  r_miracle: { r: "legendary", t: "sup", v: 1 }, r_raidGod: { r: "legendary", t: "spc", v: 0.15 },
};
export const RAID_AUG_TEXT = {
  r_swordRain: [["검의 비", "剣の雨", "Sword Rain"], ["줄을 지울 때마다 검이 떨어져 추가 피해 +6", "ライン消去ごとに剣が降り追加ダメージ+6", "+6 bonus damage per line clear"]],
  r_strike: [["강한 일격", "強撃", "Heavy Strike"], ["줄 제거 기본 피해 +15%", "ライン消去の基本ダメージ+15%", "+15% base line damage"]],
  r_combo: [["콤보 전문가", "コンボ職人", "Combo Expert"], ["콤보 피해 보너스 2배 (1단계 +10%, 최대 +100%)", "コンボボーナス2倍(1段階+10%、最大+100%)", "Double combo bonus (+10% per step, max +100%)"]],
  r_wall: [["철벽 방어", "鉄壁", "Iron Wall"], ["보스가 보내는 방해 줄 공격마다 −1줄", "ボスのお邪魔ライン攻撃ごとに−1ライン", "−1 line from every boss garbage attack"]],
  r_recover: [["빠른 회복", "早い回復", "Quick Recovery"], ["4줄 제거마다 방해 줄 상쇄 2 저장 (최대 4, 보스 공격을 받을 때 먼저 씀)", "4ライン消去ごとに相殺2を蓄積(最大4、ボス攻撃時に自動使用)", "Each quad stores 2 garbage blocks (max 4, used automatically on boss attacks)"]],
  r_lucky: [["행운의 블록", "幸運のブロック", "Lucky Block"], ["T스핀·퍼펙트 클리어 피해 +40%", "Tスピン・パーフェクトのダメージ+40%", "+40% damage on T-spins and perfect clears"]],
  r_weak: [["약점 탐지", "弱点探知", "Weak Spot"], ["부위(작은 슬라임·드론·촉수·분신) 피해 +30%", "部位(小スライム・ドローン・触手・分身)へのダメージ+30%", "+30% damage to parts (minis, drones, tentacles, clones)"]],
  r_focus: [["집중 공격", "集中攻撃", "Focus Fire"], ["3초 안에 다시 줄을 지우면 그 피해 +20%", "3秒以内に再びライン消去でダメージ+20%", "+20% damage if you clear again within 3 s"]],
  r_cheer: [["팀 응원", "チーム応援", "Team Cheer"], ["내가 줄을 지우면 팀 전체 피해 +2% (10초, 최대 +10%)", "ライン消去でチーム全体のダメージ+2%(10秒、最大+10%)", "Your clears give the whole team +2% damage (10 s, max +10%)"]],
  r_steady: [["안정된 조작", "安定操作", "Steady Hands"], ["보스의 화면 방해(봉인·시야·가속) 지속 시간 절반", "ボスの画面妨害(封印・視界・加速)の時間が半分", "Boss screen debuffs (seals, vision, speed) last half as long"]],
  r_chainBolt: [["연쇄 번개", "連鎖稲妻", "Chain Bolt"], ["2줄 이상 지우면 번개 피해 +20 (부위에도 +10)", "2ライン以上で稲妻ダメージ+20(部位にも+10)", "2+ line clears add 20 lightning damage (+10 to parts)"]],
  r_flameBurst: [["화염 폭발", "火炎爆発", "Flame Burst"], ["줄 제거 5번마다 폭발 피해 120", "ライン消去5回ごとに爆発ダメージ120", "Every 5th clear explodes for 120 damage"]],
  r_iceArrow: [["얼음 화살", "氷の矢", "Ice Arrow"], ["4줄·T스핀을 하면 보스 다음 공격 2초 지연 (팀 전체 30초에 최대 8초)", "4ライン・Tスピンでボスの次の攻撃を2秒遅延(チームで30秒に最大8秒)", "Quads and T-spins delay the boss's next attack by 2 s (team cap 8 s per 30 s)"]],
  r_laser: [["레이저 블록", "レーザーブロック", "Laser Block"], ["I 조각으로 4줄을 지우면 레이저 200", "Iミノで4ライン消去するとレーザー200", "A quad with the I piece fires a 200-damage laser"]],
  r_vamp: [["흡혈", "吸血", "Vampiric"], ["보스에게 준 피해 300마다 방해 줄 상쇄 1 저장 (최대 4)", "ボスへのダメージ300ごとに相殺1を蓄積(最大4)", "Every 300 damage dealt stores 1 garbage block (max 4)"]],
  r_shield: [["보호막", "バリア", "Barrier"], ["페이즈마다 보스 공격 1번 무효", "フェーズごとにボスの攻撃を1回無効", "Negate one boss attack per phase"]],
  r_blockBomb: [["블록 폭탄", "ブロック爆弾", "Block Bomb"], ["사용형 2회: 바닥 3줄을 날려 버림", "使用型2回:下3ラインを吹き飛ばす", "Use twice: blast away the bottom 3 rows"]],
  r_goldTetris: [["황금 테트리스", "黄金クアッド", "Golden Quad"], ["4줄 제거 피해 +60%", "4ライン消去のダメージ+60%", "+60% quad damage"]],
  r_drone: [["공격 드론", "攻撃ドローン", "Attack Drone"], ["살아 있는 동안 8초마다 자동 피해 25", "生存中8秒ごとに自動ダメージ25", "Deals 25 damage every 8 s while you're alive"]],
  r_rescue: [["팀 구조", "チーム救助", "Team Rescue"], ["내 줄 제거가 구조 게이지를 2배로 채움", "自分のライン消去で救助ゲージが2倍たまる", "Your clears fill the rescue gauge twice as fast"]],
  r_meteor: [["메테오", "メテオ", "Meteor"], ["20줄 지울 때마다 메테오 500", "20ライン消去ごとにメテオ500", "Every 20 lines summons a 500-damage meteor"]],
  r_timeWarp: [["시간 왜곡", "時間歪曲", "Time Warp"], ["보스가 페이즈를 바꾸거나 광폭화하면 행동 6초 정지 (팀 전체 30초에 최대 8초)", "ボスのフェーズ移行・暴走時に行動を6秒停止(チームで30秒に最大8秒)", "When the boss changes phase or enrages, it freezes for 6 s (team cap 8 s per 30 s)"]],
  r_storm: [["번개 폭풍", "稲妻の嵐", "Thunderstorm"], ["콤보 3 이상인 동안 줄 제거마다 +30", "コンボ3以上の間、ライン消去ごとに+30", "+30 per clear while your combo is 3+"]],
  r_purify: [["블록 정화", "ブロック浄化", "Purify"], ["사용형 2회: 블록을 아래로 떨어뜨려 빈칸을 메움", "使用型2回:ブロックを下に落として隙間を埋める", "Use twice: drop all blocks down to fill gaps"]],
  r_undying: [["불사의 의지", "不死の意志", "Undying Will"], ["게임 오버 직전 1번, 판을 비우고 계속", "ゲームオーバー直前に1回、盤面を空にして続行", "Once: instead of topping out, your board is wiped and you continue"]],
  r_legion: [["검의 군단", "剣の軍団", "Sword Legion"], ["줄 제거마다 추가 피해 +2 × 내 증강 수", "ライン消去ごとに追加ダメージ+2×オーグメント数", "+2 × (your augments) bonus damage per clear"]],
  r_breaker: [["약점 파괴", "弱点破壊", "Breaker"], ["방어막·부위 피해 2배", "シールド・部位へのダメージ2倍", "Double damage to shields and parts"]],
  r_unison: [["팀 합동기", "チーム合体技", "Unison Strike"], ["합동 공격 피해 +50% (팀에서 여러 명이 가져도 최대 +100%)", "合同攻撃のダメージ+50%(チーム合計最大+100%)", "+50% joint-attack damage (team total max +100%)"]],
  r_fury: [["분노의 각성", "怒りの覚醒", "Fury"], ["내 판 높이가 12 이상이면 피해 +50%", "盤面の高さ12以上でダメージ+50%", "+50% damage while your stack is 12+ high"]],
  r_feather: [["부활의 깃털", "復活の羽", "Phoenix Feather"], ["쓰러지면 구조 게이지 없이 바로 1번 부활 (보호 5초)", "倒れると救助ゲージなしで即1回復活(保護5秒)", "Once: revive instantly when downed (5 s protection)"]],
  r_judgment: [["천상의 심판", "天上の審判", "Heavenly Judgment"], ["보스 페이즈가 바뀔 때마다 최대 체력 4% 피해", "ボスのフェーズ移行ごとに最大体力の4%ダメージ", "Deals 4% of max HP whenever the boss changes phase"]],
  r_bladeDance: [["무한 검무", "無限剣舞", "Endless Blades"], ["4줄을 지우면 10초 동안 1초마다 20 피해", "4ライン消去で10秒間毎秒20ダメージ", "A quad starts 10 s of 20 damage per second"]],
  r_goldRush: [["황금 폭주", "黄金暴走", "Gold Rush"], ["모든 피해 +25%", "すべてのダメージ+25%", "+25% to all damage"]],
  r_rewind: [["시간 역행", "時間逆行", "Rewind"], ["보스 방해 줄 공격 2번을 받기 직전에 되돌림", "ボスのお邪魔ライン攻撃を2回、受ける直前に巻き戻す", "Rewinds two boss garbage attacks right before they hit"]],
  r_absolute: [["절대 방어", "絶対防御", "Absolute Guard"], ["보스의 강한 공격 1번 완전 방어 (페이즈마다 다시 충전)", "ボスの強力攻撃を1回完全防御(フェーズごとに再充填)", "Fully blocks one heavy boss attack (recharges each phase)"]],
  r_dragon: [["드래곤 소환", "ドラゴン召喚", "Summon Dragon"], ["고를 때와 보스 페이즈가 바뀔 때 드래곤이 15초 동안 2초마다 60 피해", "取得時とフェーズ移行時、ドラゴンが15秒間2秒ごとに60ダメージ", "On pick and each boss phase change, a dragon deals 60 every 2 s for 15 s"]],
  r_reversal: [["운명 역전", "運命逆転", "Turn the Tide"], ["팀 생존자가 절반 이하이거나 남은 시간이 30% 이하면 모든 피해 +60%", "生存者が半分以下か残り時間30%以下で全ダメージ+60%", "+60% damage when half the team is down or under 30% time left"]],
  r_collapse: [["차원 붕괴", "次元崩壊", "Dimension Collapse"], ["퍼펙트 클리어·T스핀 트리플 때 최대 체력 5% 피해 (한 판 3번)", "パーフェクト・Tスピントリプルで最大体力の5%(1試合3回)", "Perfect clears and T-spin triples deal 5% of max HP (3 per raid)"]],
  r_miracle: [["최후의 기적", "最後の奇跡", "Last Miracle"], ["팀에서 나만 살아 있을 때 1번, 쓰러진 동료 전원 부활", "自分だけが生き残った時に1回、倒れた仲間を全員復活", "Once, when you're the last one standing, revive every downed ally"]],
  r_raidGod: [["레이드의 신", "レイドの神", "Raid God"], ["모든 피해 +15% · 방해 줄 −1 · 내 구조 게이지 기여 +50%", "全ダメージ+15%・お邪魔−1・救助ゲージ貢献+50%", "+15% damage · −1 garbage per attack · +50% rescue gauge"]],
};
export const RAID_AUG_TYPE = { atk: ["공격", "攻撃", "Attack"], def: ["방어", "防御", "Defense"], sup: ["지원", "支援", "Support"], spc: ["특수", "特殊", "Special"] };
// 기존 증강 중 레이드에서도 그대로 쓸 수 있는 것 (내 판 방어·조작형)
export const RAID_OLD_OK = ["shield", "buffer", "clean", "cancel", "slow", "lock", "ibar"];
export const SHAPE_NAME = { 1: ["I", "I", "I"], 2: ["O", "O", "O"], 3: ["T", "T", "T"], 4: ["S", "S", "S"], 5: ["Z", "Z", "Z"], 6: ["J", "J", "J"], 7: ["L", "L", "L"] };
