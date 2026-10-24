// ⚠ 자동 복사본 — 고치려면 홈페이지 제작/fight/chars.js 를 고치고 sync-fight-engine.js 실행
// =========================
// 플듀 파이터 — 캐릭터 4명(외형·능력치·기술 프레임 데이터)
// 기술(move):
//   rank  : L(약) H(강) S(필살) U(초필살) A(점프) T(잡기) — 캔슬 순서 L→H→S→U
//   len   : 전체 프레임(60fps)
//   hits  : [{f 시작, n 지속, b:[앞x0, y0, 앞x1, y1] 상자, dmg, hs 맞음경직, bs 막음경직, kb 밀림, lv mid|low|over, launch 띄우기, kd 다운, stop 히트스톱, fx}]
//   anim  : [[프레임, 자세]] (poses.js)
//   vel   : [[f0, f1, 앞속도, 위속도(시작 프레임에만)]]   inv/armor : [[f0,f1]] 무적/아머
//   proj  : 발사체 [{f, dx, dy, vx, w, h, life, hits, cool, kind, fixed, hit:{...}}]
//   grab  : {f, range, dmg, tech(풀기 가능), cmd(필살 잡기), anim(잡은 뒤 기술)}
//   hold  : 잡힌 상대 위치 [[f, dx, dy, rot]]  release : 던지는 프레임
// =========================

const H = (f, n, b, dmg, o = {}) => ({ f, n, b, dmg, hs: 16, bs: 12, kb: 4, lv: "mid", ...o });
const scaleBox = (b, rg) => [b[0], b[1], Math.round(b[2] * rg), b[3]];

/** 공용 기본기(캐릭터마다 위력·사거리·속도·자세 덮어쓰기) */
function normals({ pw = 1, rg = 1, sd = 0, anim = {} }) {
  const A = (k, def) => anim[k] || def;
  const d = (x) => Math.round(x * pw);
  return {
    slp: { rank: "L", len: 14 + sd, hits: [H(4 + sd, 3, scaleBox([10, 108, 84, 138], rg), d(30), { hs: 15, bs: 10, kb: 3, stop: 7, fx: "light" })], anim: [[0, "stance"], [2 + sd, A("lpPrep", "lpPrep")], [4 + sd, A("lpHit", "lpHit")], [8 + sd, A("lpHit", "lpHit")], [14 + sd, "stance"]] },
    shp: { rank: "H", len: 30 + sd, hits: [H(8 + sd, 4, scaleBox([10, 100, 104, 142], rg), d(72), { hs: 20, bs: 16, kb: 6, stop: 11, fx: "heavy" })], anim: [[0, "stance"], [5 + sd, A("hpPrep", "hpPrep")], [8 + sd, A("hpHit", "hpHit")], [14 + sd, A("hpHit", "hpHit")], [30 + sd, "stance"]] },
    slk: { rank: "L", len: 17 + sd, hits: [H(5 + sd, 3, scaleBox([10, 38, 96, 82], rg), d(35), { hs: 15, bs: 11, kb: 3, stop: 7, fx: "light" })], anim: [[0, "stance"], [3 + sd, A("lkPrep", "lkPrep")], [5 + sd, A("lkHit", "lkHit")], [9 + sd, A("lkHit", "lkHit")], [17 + sd, "stance"]] },
    shk: { rank: "H", len: 32 + sd, hits: [H(10 + sd, 4, scaleBox([20, 108, 122, 165], rg), d(90), { hs: 21, bs: 17, kb: 8, stop: 12, fx: "heavy" })], anim: [[0, "stance"], [6 + sd, A("hkPrep", "hkPrep")], [10 + sd, A("hkHit", "hkHit")], [16 + sd, A("hkHit", "hkHit")], [32 + sd, "stance"]] },
    clp: { rank: "L", crouch: 1, len: 14 + sd, hits: [H(4 + sd, 3, scaleBox([10, 58, 86, 90], rg), d(25), { hs: 14, bs: 9, kb: 3, stop: 7, fx: "light" })], anim: [[0, "crouch"], [4 + sd, A("clpHit", "clpHit")], [8 + sd, A("clpHit", "clpHit")], [14 + sd, "crouch"]] },
    chp: { rank: "H", crouch: 1, len: 30 + sd, hits: [H(7 + sd, 5, scaleBox([0, 60, 72, 196], rg), d(75), { launch: 13, bs: 14, kb: 3, stop: 11, jug: 1, fx: "heavy" })], anim: [[0, "crouch"], [4 + sd, "chpPrep"], [7 + sd, A("chpHit", "chpHit")], [15 + sd, A("chpHit", "chpHit")], [30 + sd, "crouch"]] },
    clk: { rank: "L", crouch: 1, len: 17 + sd, hits: [H(5 + sd, 3, scaleBox([20, 0, 104, 30], rg), d(30), { lv: "low", hs: 14, bs: 11, kb: 3, stop: 7, fx: "light" })], anim: [[0, "crouch"], [5 + sd, A("clkHit", "clkHit")], [9 + sd, A("clkHit", "clkHit")], [17 + sd, "crouch"]] },
    chk: { rank: "H", crouch: 1, nocancel: 1, len: 36 + sd, hits: [H(9 + sd, 4, scaleBox([20, 0, 128, 28], rg), d(85), { lv: "low", kd: 1, launch: 5, bs: 16, kb: 6, stop: 11, fx: "heavy" })], anim: [[0, "crouch"], [5 + sd, "chkPrep"], [9 + sd, A("chkHit", "chkHit")], [16 + sd, A("chkHit", "chkHit")], [36 + sd, "crouch"]] },
    jlp: { rank: "A", air: 1, len: 30, hits: [H(5, 8, scaleBox([0, 50, 74, 115], rg), d(40), { lv: "over", hs: 17, bs: 12, kb: 3, stop: 7, fx: "light" })], anim: [[0, "jumpTuck"], [4, A("jlp", "jlp")], [14, A("jlp", "jlp")], [30, "fall"]] },
    jhp: { rank: "A", air: 1, len: 32, hits: [H(8, 6, scaleBox([10, 20, 90, 95], rg), d(75), { lv: "over", hs: 21, bs: 15, kb: 4, stop: 11, fx: "heavy" })], anim: [[0, "jumpTuck"], [6, A("jhp", "jhp")], [16, A("jhp", "jhp")], [32, "fall"]] },
    jlk: { rank: "A", air: 1, len: 30, hits: [H(5, 10, scaleBox([10, 10, 88, 62], rg), d(40), { lv: "over", hs: 17, bs: 12, kb: 3, stop: 7, fx: "light" })], anim: [[0, "jumpTuck"], [4, A("jlk", "jlk")], [16, A("jlk", "jlk")], [30, "fall"]] },
    jhk: { rank: "A", air: 1, len: 32, hits: [H(9, 6, scaleBox([10, 30, 116, 92], rg), d(85), { lv: "over", hs: 21, bs: 15, kb: 5, stop: 12, fx: "heavy" })], anim: [[0, "jumpTuck"], [6, A("jhk", "jhk")], [16, A("jhk", "jhk")], [32, "fall"]] },
    throw: { rank: "T", len: 30, grab: { f: 3, range: Math.round(84 * rg), dmg: d(120), tech: 1, anim: "throwHit" }, anim: [[0, "stance"], [3, "grab"], [12, "grab"], [30, "stance"]] },
    throwHit: { rank: "T", len: 46, hold: [[0, 52, 4, 0], [12, 46, 50, -30], [24, 64, 96, -100], [30, 96, 64, -150]], release: 30, rdmg: d(120), rvx: 7, rvy: 6, anim: [[0, "grab"], [12, "lift"], [26, "toss"], [46, "stance"]] },
  };
}

export const CHARS = {
  // ───────────── 한빛: 균형형 태권도 ─────────────
  hanbit: {
    id: "hanbit", name: { ko: "한빛", ja: "ハンビッ", en: "Hanbit" }, title: { ko: "불꽃 태권 소년", ja: "炎のテコンドー少年", en: "Flame Taekwondo Kid" },
    hp: 980, walkF: 4.2, walkB: 3.3, jumpF: 4.6, jumpB: 4.2, dash: 11,
    stats: { pow: 3, spd: 3, rng: 3, diff: 1 },
    body: { th: 40, sh: 41, to: 54, ua: 30, fa: 28, hr: 20, neck: 6, hipW: 36, shW: 52, arm: 16, leg: 20, scale: 1 },
    look: { skin: "#F2C29B", hair: "#23191A", hairStyle: "spiky", top: "#F6F4EE", top2: "#D9D5CA", sleeve: "#F6F4EE", fore: "#F6F4EE", pants: "#F2F0E8", shoe: "#2B2B33", belt: "#1B1B22", band: "#E8384F", energy: "#5EC8FF", gi: true },
    alt: { top: "#2E3550", top2: "#232842", sleeve: "#2E3550", fore: "#2E3550", pants: "#262C44", band: "#F2C14B", energy: "#FF8A3D" },
    ai: { pref: 240, combos: [["clk", "clp", "sp1"], ["slp", "shp", "sp3"], ["shp", "sp2"], ["jhk", "shp", "sp1"], ["clp", "clp", "shp", "sp3"]], zoner: 0.5 },
    moves: {
      ...normals({ pw: 0.94, rg: 1 }),
      sp1: { rank: "S", name: { ko: "기공파", ja: "気功波", en: "Ki Blast" }, len: 46, superCancel: 1, projOne: 1,
        proj: [{ f: 13, dx: 62, dy: 116, vx: 8.5, w: 46, h: 42, life: 120, hits: 1, kind: "orb", hit: { dmg: 70, hs: 20, bs: 16, kb: 5, chip: 0.15, stop: 10, fx: "special" } }],
        anim: [[0, "stance"], [4, "fbPrep"], [11, "fbPrep"], [13, "fbHit"], [36, "fbHit"], [46, "stance"]] },
      sp2: { rank: "S", name: { ko: "회오리발", ja: "旋風脚", en: "Whirlwind Kick" }, len: 46, superCancel: 1, after: 1,
        vel: [[6, 34, 5.4, 6]], air: 1, landRec: 6,
        hits: [H(8, 4, [-60, 70, 92, 150], 32, { hs: 16, bs: 12, kb: 1, stop: 7, fx: "heavy" }), H(16, 4, [-60, 70, 92, 150], 32, { hs: 16, bs: 12, kb: 1, stop: 7, fx: "heavy" }), H(24, 5, [-60, 70, 96, 150], 42, { hs: 20, bs: 16, kb: 6, launch: 9, kd: 1, stop: 12, fx: "special" })],
        anim: [[0, "prejump"], [6, "spinA"], [10, "spinB"], [14, "spinA"], [18, "spinB"], [22, "spinA"], [26, "spinB"], [30, "spinA"], [34, "fall"], [46, "stance"]] },
      sp3: { rank: "S", name: { ko: "승천권", ja: "昇天拳", en: "Rising Fist" }, len: 52, superCancel: 1, after: 1, inv: [[1, 9]],
        vel: [[3, 18, 2.6, 13.5]], air: 1, landRec: 14,
        hits: [H(3, 3, [0, 40, 62, 160], 60, { launch: 14, hs: 20, bs: 18, kb: 2, stop: 10, jug: 0, fx: "special" }), H(6, 9, [0, 90, 60, 205], 70, { launch: 14, kd: 1, bs: 18, kb: 3, stop: 12, fx: "special" })],
        anim: [[0, "dpPrep"], [3, "dpRise"], [20, "dpRise"], [30, "fall"], [52, "stance"]] },
      su: { rank: "U", name: { ko: "기공 대포", ja: "気功大砲", en: "Ki Cannon" }, len: 84, inv: [[0, 16]], super: 1,
        proj: [{ f: 16, dx: 330, dy: 116, vx: 0, w: 560, h: 76, life: 42, hits: 5, cool: 6, kind: "beam", fixed: 1, follow: 1, hit: { dmg: 62, hs: 26, bs: 16, kb: 2, chip: 0.25, stop: 6, launch: 4, fx: "special" } }],
        anim: [[0, "superPose"], [10, "fbPrep"], [16, "fbHit"], [64, "fbHit"], [84, "stance"]] },
    },
  },

  // ───────────── 유나: 스피드형 무술 ─────────────
  yuna: {
    id: "yuna", name: { ko: "유나", ja: "ユナ", en: "Yuna" }, title: { ko: "번개 발차기", ja: "稲妻キック", en: "Lightning Legs" },
    hp: 1040, walkF: 5.2, walkB: 4.0, jumpF: 5.4, jumpB: 4.6, dash: 13,
    stats: { pow: 2, spd: 5, rng: 2, diff: 2 },
    body: { th: 41, sh: 42, to: 50, ua: 28, fa: 26, hr: 19, neck: 6, hipW: 34, shW: 42, arm: 13, leg: 17, scale: 0.97 },
    look: { skin: "#F7D2B6", hair: "#4A2632", hairStyle: "pony", top: "#FF5C93", top2: "#D93F78", sleeve: "#FF5C93", fore: "#F7D2B6", pants: "#2E2A44", shoe: "#FFFFFF", belt: "#FFD166", band: "#FFD166", energy: "#FF8FD8" },
    alt: { top: "#3FC6C9", top2: "#2A9EA1", sleeve: "#3FC6C9", pants: "#1E2638", band: "#FFFFFF", energy: "#7AF5FF" },
    ai: { pref: 130, combos: [["clk", "clk", "sp1"], ["slp", "slk", "shk", "sp1"], ["clp", "chp", "sp3"], ["jlk", "slp", "shp", "sp1"]], zoner: 0 },
    moves: {
      ...normals({ pw: 1.08, rg: 1.02, sd: -1, anim: { hkHit: [0, 0, -30, -4, 100, 30, 40, 70, -4, 4, 128, 0, -16], jhk: [0, 0, -30, -6, 90, 40, 60, 60, 20, 80, 110, 0, -20] } }),
      sp1: { rank: "S", name: { ko: "돌진 장", ja: "突進掌", en: "Rushing Palm" }, len: 38, superCancel: 1, after: 1, vel: [[4, 16, 10.5]],
        hits: [H(10, 6, [10, 70, 88, 144], 95, { hs: 21, bs: 14, kb: 7, stop: 12, fx: "special" })],
        anim: [[0, "stance"], [3, "palmPrep"], [10, "palm"], [24, "palm"], [40, "stance"]] },
      sp2: { rank: "S", name: { ko: "공중 회전차기", ja: "空中回転蹴り", en: "Flip Kick" }, len: 44, superCancel: 1, after: 1,
        vel: [[6, 28, 4.6, 11]], air: 1, landRec: 8,
        hits: [H(19, 9, [0, -10, 76, 80], 80, { lv: "over", hs: 21, bs: 15, kb: 5, stop: 12, fx: "special" })],
        anim: [[0, "prejump"], [6, "flipA"], [13, "flipB"], [19, "flipC"], [26, "jhk"], [44, "stance"]] },
      sp3: { rank: "S", name: { ko: "제비 차기", ja: "燕蹴り", en: "Swallow Kick" }, len: 46, superCancel: 1, after: 1, inv: [[1, 7]],
        vel: [[3, 16, 2.2, 12.5]], air: 1, landRec: 12,
        hits: [H(3, 12, [0, 70, 74, 196], 100, { launch: 13, kd: 1, hs: 20, bs: 18, kb: 3, stop: 12, fx: "special" })],
        anim: [[0, "crouch"], [3, "riseKick"], [18, "riseKick"], [28, "fall"], [46, "stance"]] },
      su: { rank: "U", name: { ko: "천열 난무", ja: "天裂乱舞", en: "Heaven Rend Flurry" }, len: 96, inv: [[0, 12]], super: 1, after: 1, vel: [[2, 12, 12]],
        hits: [H(6, 8, [0, 40, 90, 160], 36, { hs: 30, bs: 14, kb: 0.4, stop: 6, fx: "heavy" }),
          ...[16, 23, 30, 37, 44, 51, 58].map((f) => H(f, 4, [-10, 40, 96, 170], 30, { hs: 30, bs: 10, kb: 0.4, stop: 5, jug: 0, fx: "heavy" })),
          H(68, 6, [0, 60, 100, 220], 60, { launch: 15, kd: 1, bs: 16, kb: 6, stop: 14, fx: "special" })],
        anim: [[0, "superPose"], [6, "flurryA"], [12, "flurryB"], [18, "flurryC"], [24, "flurryA"], [30, "flurryB"], [36, "clkHit"], [42, "flurryA"], [48, "flurryC"], [56, "flurryB"], [64, "chpPrep"], [68, "riseKick"], [80, "riseKick"], [96, "stance"]] },
    },
  },

  // ───────────── 강철: 파워형 레슬러 ─────────────
  gangcheol: {
    id: "gangcheol", name: { ko: "강철", ja: "カンチョル", en: "Steel" }, title: { ko: "철벽 레슬러", ja: "鉄壁レスラー", en: "Iron Wrestler" },
    hp: 1130, walkF: 3.2, walkB: 2.6, jumpF: 4.0, jumpB: 3.6, dash: 9,
    stats: { pow: 5, spd: 1, rng: 3, diff: 3 },
    body: { th: 40, sh: 40, to: 60, ua: 32, fa: 30, hr: 20, neck: 7, hipW: 48, shW: 72, arm: 24, leg: 26, scale: 1.12 },
    look: { skin: "#D9A27A", hair: "#2A1C16", hairStyle: "bald", top: "#2F5FD0", top2: "#2148A6", sleeve: "#D9A27A", fore: "#D9A27A", pants: "#2F5FD0", shoe: "#E8384F", belt: "#F2C14B", band: "#E8384F", energy: "#FFB84D", shades: true, beard: true, singlet: true },
    alt: { top: "#C9363F", top2: "#9E2830", pants: "#C9363F", shoe: "#2B2B33", energy: "#FF6B5C" },
    ai: { pref: 95, combos: [["clp", "sp1"], ["shp", "sp2"], ["clk", "chk"], ["jhp", "shp", "sp2"]], zoner: 0, grabber: 1 },
    moves: {
      ...normals({ pw: 1.1, rg: 1.06, sd: 1, anim: { hpPrep: [-6, 0, -10, -10, 170, 20, 160, 30, -20, 10, 18, 16, 0], hpHit: [10, 0, 40, 10, 100, 0, 96, 0, -30, 8, 40, 20, 0] } }),
      sp1: { rank: "S", name: { ko: "베어 허그", ja: "ベアハッグ", en: "Bear Hug" }, len: 48, superCancel: 0,
        grab: { f: 5, range: 92, dmg: 170, cmd: 1, anim: "cgThrow" },
        anim: [[0, "stance"], [3, "grab"], [12, "grab"], [48, "stance"]] },
      cgThrow: { rank: "T", len: 60, hold: [[0, 44, 6, 0], [16, 12, 150, -180], [30, 20, 170, -180], [40, 70, 0, -270]], release: 40, rdmg: 170, rvx: 2, rvy: 2, shake: 14,
        anim: [[0, "grab"], [16, "lift"], [32, "lift"], [40, "slam"], [60, "stance"]] },
      sp2: { rank: "S", name: { ko: "어깨 돌진", ja: "ショルダータックル", en: "Shoulder Tackle" }, len: 50, superCancel: 1, armor: [[6, 24]], after: 1, vel: [[8, 26, 8.6]],
        hits: [H(10, 16, [0, 60, 78, 158], 110, { kd: 1, launch: 7, bs: 18, kb: 8, stop: 13, fx: "special" })],
        anim: [[0, "stance"], [6, "shoulder"], [28, "shoulder"], [50, "stance"]] },
      sp3: { rank: "S", name: { ko: "지진 내려찍기", ja: "地震落とし", en: "Earthquake Slam" }, len: 54, superCancel: 1,
        hits: [H(15, 4, [0, 0, 84, 50], 60, { lv: "low", kd: 1, launch: 6, bs: 16, kb: 4, stop: 12, fx: "heavy" })],
        proj: [{ f: 17, dx: 80, dy: 14, vx: 7, w: 64, h: 28, life: 34, hits: 1, kind: "quake", hit: { dmg: 90, lv: "low", hs: 22, bs: 16, kb: 5, launch: 7, kd: 1, chip: 0.15, stop: 10, fx: "special" } }],
        anim: [[0, "stance"], [8, "poundPrep"], [15, "poundHit"], [40, "poundHit"], [54, "stance"]], shake: 10 },
      su: { rank: "U", name: { ko: "하늘 파일드라이버", ja: "天空パイルドライバー", en: "Sky Piledriver" }, len: 46, super: 1, inv: [[0, 10]],
        grab: { f: 6, range: 118, dmg: 380, cmd: 1, anim: "pdThrow" },
        anim: [[0, "superPose"], [6, "grab"], [20, "grab"], [46, "stance"]] },
      pdThrow: { rank: "T", len: 84, air: 1, vel: [[10, 11, 0, 16]], hold: [[0, 40, 10, 0], [10, 10, 120, -180], [30, 0, 150, -180], [52, 0, 120, -180]], release: 54, rdmg: 380, rvx: 3, rvy: 4, shake: 22, landRec: 0,
        anim: [[0, "grab"], [10, "lift"], [40, "lift"], [54, "slam"], [84, "stance"]] },
    },
  },

  // ───────────── 레이: 원거리형 마술사 ─────────────
  rei: {
    id: "rei", name: { ko: "레이", ja: "レイ", en: "Rei" }, title: { ko: "번개 카드 마술사", ja: "雷カードマジシャン", en: "Thunder Card Mage" },
    hp: 930, walkF: 3.8, walkB: 3.6, jumpF: 4.4, jumpB: 4.4, dash: 12,
    stats: { pow: 3, spd: 3, rng: 5, diff: 4 },
    body: { th: 42, sh: 42, to: 54, ua: 30, fa: 28, hr: 19, neck: 6, hipW: 34, shW: 46, arm: 14, leg: 18, scale: 1.02 },
    look: { skin: "#F4D6C4", hair: "#EDEBFA", hairStyle: "messy", top: "#4B2E83", top2: "#36205F", sleeve: "#4B2E83", fore: "#4B2E83", pants: "#22203A", shoe: "#1A1828", belt: "#55E6FF", band: "#55E6FF", energy: "#7AF5FF", hood: true, scarf: "#55E6FF" },
    alt: { top: "#2E2E36", top2: "#1E1E24", sleeve: "#2E2E36", fore: "#2E2E36", pants: "#3A1E2A", belt: "#FF5C7A", scarf: "#FF5C7A", energy: "#FF8FB0" },
    ai: { pref: 330, combos: [["clk", "clp", "sp1"], ["shp", "sp3"], ["slp", "shk", "sp1"]], zoner: 0.7 },
    moves: {
      ...normals({ pw: 0.95, rg: 1.06, anim: { hpHit: [12, 0, 20, -4, 40, 100, 100, 30, -30, 8, 34, 18, 0] } }),
      sp1: { rank: "S", name: { ko: "번개 카드", ja: "雷カード", en: "Thunder Card" }, len: 50, superCancel: 1, projOne: 1,
        proj: [{ f: 12, dx: 52, dy: 122, vx: 8.5, w: 34, h: 22, life: 110, hits: 1, kind: "card", hit: { dmg: 42, hs: 18, bs: 14, kb: 4, chip: 0.15, stop: 8, fx: "special" } }],
        anim: [[0, "stance"], [4, "cardPrep"], [10, "cardPrep"], [12, "cardHit"], [36, "cardHit"], [50, "stance"]] },
      sp2: { rank: "S", name: { ko: "순간이동", ja: "瞬間移動", en: "Blink" }, len: 36, tele: 14, inv: [[6, 22]], alpha: [[0, 1], [10, 0], [18, 0], [24, 1]],
        anim: [[0, "stance"], [8, "superPose"], [18, "stance"], [36, "stance"]] },
      sp3: { rank: "S", name: { ko: "번개 기둥", ja: "雷柱", en: "Thunder Pillar" }, len: 48, superCancel: 1,
        proj: [{ f: 14, dx: 150, dy: 110, vx: 0, w: 58, h: 230, life: 20, hits: 2, cool: 8, kind: "bolt", fixed: 1, hit: { dmg: 50, hs: 20, bs: 14, kb: 2, launch: 12, kd: 1, chip: 0.15, stop: 9, fx: "special" } }],
        anim: [[0, "stance"], [6, "callUp"], [14, "callDown"], [36, "callDown"], [48, "stance"]] },
      su: { rank: "U", name: { ko: "번개 폭풍", ja: "雷嵐", en: "Thunderstorm" }, len: 92, inv: [[0, 14]], super: 1,
        proj: [110, 210, 310, 410, 510].map((dx, i) => ({ f: 16 + i * 8, dx, dy: 110, vx: 0, w: 70, h: 240, life: 18, hits: 1, kind: "bolt", fixed: 1, hit: { dmg: 66, hs: 30, bs: 12, kb: 1, launch: 10, jug: 0, chip: 0.25, stop: 7, fx: "special" } })),
        anim: [[0, "superPose"], [10, "callUp"], [16, "callDown"], [24, "callUp"], [32, "callDown"], [40, "callUp"], [48, "callDown"], [70, "callDown"], [92, "stance"]] },
    },
  },
};

export const CHAR_IDS = ["hanbit", "yuna", "gangcheol", "rei"];

/** 기술표(화면 표시용): [이름키, 커맨드, 터치] */
export const MOVE_LIST = {
  common: [
    ["throw", "약손+약발 (가까이)", "잡기 버튼"],
    ["chp", "↓ + 강손 (띄우기)", "↓ + 강손"],
    ["chk", "↓ + 강발 (다리 걸기, 하단)", "↓ + 강발"],
  ],
};
