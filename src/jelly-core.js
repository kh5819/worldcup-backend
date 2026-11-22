// =========================
// DUO 증강 젤리 매치 — 규칙 엔진 (2026-11-22, 오리지널 매치3) · v2: 보스·방해물·스테이지·통계
// ※ 서버(worldcup-backend/src/jelly-core.js)와 화면(js/jelly/jelly-core.js)이 '같은 파일'. 고치면 둘 다 복사.
// · 화면은 이 엔진으로 내 판을 바로 움직이고 조작 기록을 서버로 보냄 → 서버가 같은 엔진으로 다시 돌려 해시 비교 (2048과 같은 방식)
// · 난수: 떨어지는 젤리(sr)와 증강·보스 효과(ar) 흐름이 따로 → 공정 경쟁
// · 8×8 판, 젤리 6색. 특수 s: h(가로 줄무늬)·v(세로)·b(폭탄)·r(무지개) · 방해: x(돌)·o(초콜릿, 안 깨면 번짐) · 젤리에 붙는 것: f(얼음 겹 1~2, 못 움직임)·k(사슬, 못 움직임) — 모두 옆에서 맞추거나 폭발에 맞으면 깨지거나 한 겹 벗겨짐
// · 황금 g(점수 배) · 보스: 젤리를 터뜨려 체력을 깎음(약점 색은 2배), 3수마다 공격(돌·얼음·초콜릿·사슬)
// · 조작: ['m',a,b] 이웃 교환 · ['p',id] 증강 고르기 · ['r'] 새로고침 · ['u',id,a,b] 증강 사용
// · steps: 한 조작에서 생긴 연쇄 단계 (화면 연출용, 저장·해시에는 안 들어감)
// · 외부 의존 없음 (브라우저·Node 공용)
// =========================
export const VERSION = 2;
export const N = 8, COLORS = 6;
export const MAX_AUGS = 5;
export const PICK_AT = [0, 45, 130, 260, 430];     // 터뜨린 젤리 수 기준 증강 고르기 (시작 + 4번)
export const MULT_CAP = 8;
export const MOVES_LIMIT = 30;
export const STREAM_TIME_CAP = 60;
export const COLOR_NAME = ["딸기", "오렌지", "소다", "멜론", "포도", "레몬"];
export const BOSS_EVERY = 3, BOSS_FIRST = 60, BOSS_GAP = 90;
export const bossHp = (lvl) => 45 + 35 * lvl;
export const BOSS_TYPES = [
  { id: "jam", name: "잼 대왕", icon: "🍓", weak: 0, atk: "stone", n: 2, desc: "돌 2개를 던져요" },
  { id: "pudding", name: "얼음 푸딩", icon: "🍮", weak: 2, atk: "freeze", n: 3, desc: "젤리 3개를 얼려요" },
  { id: "choco", name: "초코 마왕", icon: "🍫", weak: 5, atk: "choco", n: 2, desc: "초콜릿 2개를 뿌려요" },
  { id: "bear", name: "사슬 젤리곰", icon: "🧸", weak: 4, atk: "chain", n: 3, desc: "젤리 3개를 사슬로 묶어요" },
];

// ---------- 스테이지 30 ----------
// goals: score(점수) · color(c색 n개) · stone · ice(얼음 겹) · chain · choco · special(특수 만들기) · boss(c=보스 종류, n=레벨)
// setup: x 돌 · i 얼음 칸 · il 얼음 겹 · k 사슬 · o 초콜릿
const G = (k, n, c) => (c == null ? { k, n } : { k, n, c });
const ST = (moves, goals, setup = {}) => ({ moves, goals, setup, star: [0, moves * 150, moves * 260] });
export const STAGES = [
  ST(15, [G("score", 1500)]), ST(16, [G("color", 20, 0)]), ST(18, [G("stone", 5)], { x: 5 }), ST(16, [G("special", 3)]), ST(16, [G("boss", 1, 0)]),
  ST(14, [G("ice", 6)], { i: 6, il: 1 }), ST(20, [G("color", 30, 2), G("score", 2500)]), ST(16, [G("chain", 6)], { k: 6 }), ST(20, [G("choco", 6)], { o: 4 }), ST(18, [G("boss", 2, 1)]),
  ST(18, [G("ice", 12)], { i: 6, il: 2 }), ST(20, [G("color", 25, 3), G("color", 25, 4)]), ST(26, [G("stone", 8), G("score", 3000)], { x: 8 }), ST(20, [G("special", 6)]), ST(20, [G("boss", 3, 2)]),
  ST(20, [G("chain", 8), G("ice", 6)], { k: 8, i: 6, il: 1 }), ST(26, [G("choco", 10)], { o: 6 }), ST(22, [G("score", 4000)]), ST(20, [G("ice", 16)], { i: 8, il: 2 }), ST(20, [G("boss", 4, 3)]),
  ST(22, [G("stone", 8), G("chain", 6)], { x: 8, k: 6 }), ST(22, [G("color", 40, 5)]), ST(26, [G("choco", 10), G("ice", 8)], { o: 6, i: 8, il: 1 }), ST(26, [G("special", 5), G("score", 5000)]), ST(22, [G("boss", 5, 0)], { x: 6 }),
  ST(22, [G("ice", 16), G("chain", 8)], { i: 8, il: 2, k: 8 }), ST(24, [G("color", 35, 0), G("color", 35, 2)]), ST(26, [G("choco", 12)], { o: 8 }), ST(24, [G("stone", 8), G("ice", 10), G("chain", 6)], { x: 8, i: 5, il: 2, k: 6 }), ST(24, [G("boss", 6, 3)], { x: 4, i: 4, il: 2, o: 3 }),
];
export const stageSeed = (n) => hashStr("jelly-stage:" + n) || 1;

// ---------- 난수 (mulberry32) ----------
export function rnd(st) {
  let t = (st.s = (st.s + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

// ---------- 증강 40종 ----------
export const RARITY = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" };
export const KIND_LABEL = { passive: "지속형", active: "사용형", trigger: "발동형" };
export const SYNERGY = {
  score: { name: "달콤한 계산", icon: "💰", t2: "모든 점수 +5%", t3: "모든 점수 +12%" },
  craft: { name: "젤리 공방", icon: "🛠️", t2: "사용형 재사용 대기 절반", t3: "사용형 증강 횟수 +1 (한 번)" },
  guard: { name: "느긋한 시계", icon: "⏳", t2: "시간 +5초 / 이동 +2 (한 번)", t3: "시간 +10초 / 이동 +4 (한 번 더)" },
  burst: { name: "연쇄 반응", icon: "🔥", t2: "연쇄 배율 +0.1", t3: "연쇄 배율 +0.25" },
};
const A = (id, name, rarity, kind, group, icon, desc, o = {}) => ({ id, name, rarity, kind, group, icon, desc, ch: o.ch ?? null, cd: o.cd || 0, target: o.target || "none" });
export const AUGS = [
  A("c_sweet", "달콤한 시작", "common", "passive", "score", "🍬", "젤리 점수 +12%"),
  A("c_red", "딸기 사랑", "common", "passive", "score", "🍓", "딸기(빨강) 젤리 점수 ×2"),
  A("c_blue", "소다 사랑", "common", "passive", "score", "🫧", "소다(파랑) 젤리 점수 ×2"),
  A("c_green", "멜론 사랑", "common", "passive", "score", "🍈", "멜론(초록) 젤리 점수 ×2"),
  A("c_chain", "연쇄 입문", "common", "passive", "burst", "🔗", "연쇄 단계마다 배율 +0.15 더"),
  A("c_combo", "콤보 유지", "common", "passive", "burst", "🎵", "연쇄가 2단계 이상인 수가 이어질 때마다 점수 +3% (최대 +30%)"),
  A("c_hammer", "뿅망치", "common", "active", "craft", "🔨", "젤리 1개를 바로 터뜨림", { ch: 2, cd: 3, target: "cell" }),
  A("c_time", "여유 시계", "common", "trigger", "guard", "⏱️", "고르면 바로: 시간 +10초 / 이동 +3"),
  A("c_line", "줄무늬 장인", "common", "passive", "craft", "〰️", "줄무늬가 터질 때 점수 +50%"),
  A("c_bombpts", "폭탄 장인", "common", "passive", "craft", "💣", "폭탄이 터질 때 점수 +50%"),
  A("c_lucky", "행운 젤리", "common", "trigger", "score", "🍀", "터진 젤리마다 4% 확률로 +40점"),
  A("c_first", "첫 입 보너스", "common", "passive", "score", "🥄", "매 수 첫 매치(연쇄 1단계) 점수 +25%"),
  A("r_striped", "줄무늬 만들기", "rare", "active", "craft", "🎀", "젤리 1개를 줄무늬 젤리로", { ch: 2, cd: 4, target: "cell" }),
  A("r_bomb", "폭탄 만들기", "rare", "active", "craft", "🧨", "젤리 1개를 폭탄 젤리로", { ch: 1, cd: 5, target: "cell" }),
  A("r_shuffle", "판 섞기", "rare", "active", "guard", "🔀", "특수 젤리는 두고 판을 섞음", { ch: 2, cd: 2 }),
  A("r_cascade", "연쇄 증폭", "rare", "passive", "burst", "🌊", "연쇄 2단계부터 점수 +25%"),
  A("r_time", "시간 여행자", "rare", "trigger", "guard", "⌛", "고르면 바로: 시간 +20초 / 이동 +5"),
  A("r_gold", "황금 젤리", "rare", "trigger", "score", "🪙", "8수마다 황금 젤리 1개 (점수 ×3)"),
  A("r_fever", "피버 타임", "rare", "trigger", "burst", "🎉", "젤리 80개를 터뜨릴 때마다 5수 동안 점수 ×2"),
  A("r_row", "가로 청소", "rare", "active", "craft", "🧹", "고른 젤리의 가로줄 전체를 터뜨림", { ch: 1, cd: 4, target: "cell" }),
  A("r_cross", "십자 줄무늬", "rare", "passive", "craft", "✚", "줄무늬가 가로·세로 십자로 터짐"),
  A("r_free", "자유 교환", "rare", "active", "craft", "🤝", "맞지 않아도 이웃 젤리 2개를 바꿈", { ch: 2, cd: 3, target: "pair" }),
  A("r_candy", "사탕 비", "rare", "trigger", "burst", "🍭", "연쇄 3단계 이상이면 무작위 줄무늬 젤리 1개"),
  A("r_magnet", "젤리 자석", "rare", "trigger", "score", "🧲", "매 수 끝에 가장 많은 색 젤리 2개를 더 터뜨림"),
  A("e_bigbomb", "거대 폭탄", "epic", "passive", "craft", "💥", "폭탄 범위 3×3 → 5×5"),
  A("e_rainbow", "무지개 만들기", "epic", "active", "craft", "🌈", "젤리 1개를 무지개 젤리로", { ch: 1, cd: 6, target: "cell" }),
  A("e_chainx", "연쇄 폭주", "epic", "passive", "burst", "⚡", "연쇄로 늘어나는 배율 ×1.5"),
  A("e_gift", "선물 상자", "epic", "trigger", "craft", "🎁", "10수마다 무작위 특수 젤리 1개"),
  A("e_freeze", "시간 정지", "epic", "active", "guard", "❄️", "시간 +12초 / 이동 +4", { ch: 1, cd: 0 }),
  A("e_overload", "과부하", "epic", "passive", "burst", "🔋", "특수 젤리가 터뜨린 젤리 점수 +100%"),
  A("e_color", "색 지우개", "epic", "active", "craft", "🎨", "고른 젤리와 같은 색을 전부 터뜨림", { ch: 1, cd: 5, target: "cell" }),
  A("e_golden", "황금 손", "epic", "passive", "score", "✨", "6수마다 황금 젤리, 황금 점수 ×4"),
  A("e_sprinkle", "토핑 뿌리기", "epic", "trigger", "burst", "🧁", "새로 떨어지는 젤리 4%가 줄무늬"),
  A("e_quake", "지진", "epic", "active", "burst", "🌋", "맨 아래 두 줄을 터뜨림", { ch: 1, cd: 6 }),
  A("l_king", "젤리 왕", "legendary", "passive", "score", "👑", "모든 점수 +60%"),
  A("l_storm", "특수 폭풍", "legendary", "active", "craft", "🌪️", "무작위 젤리 6개를 특수 젤리로", { ch: 1, cd: 0 }),
  A("l_infinite", "끝없는 연쇄", "legendary", "passive", "burst", "♾️", "연쇄 단계마다 배율 +0.5 더"),
  A("l_heart", "젤리의 심장", "legendary", "passive", "craft", "💗", "특수 젤리가 한 단계 위로 (줄무늬→폭탄, 폭탄→무지개)"),
  A("l_time", "시간의 지배자", "legendary", "trigger", "guard", "🕰️", "고르면 바로: 시간 +40초 / 이동 +10"),
  A("l_midas", "미다스의 손", "legendary", "passive", "score", "🏆", "4수마다 황금 젤리, 황금 점수 ×5"),
];
// 카드 그림 (aug-kit 그림 이름)
const ART = { c_sweet: "sparkle", c_red: "apple", c_blue: "double", c_green: "plus", c_chain: "combo", c_combo: "amp", c_hammer: "burst", c_time: "clock", c_line: "line", c_bombpts: "bomb", c_lucky: "clover", c_first: "star",
  r_striped: "wand", r_bomb: "bomb", r_shuffle: "rotate", r_cascade: "phoenix", r_time: "hourglass", r_gold: "gold", r_fever: "sparkle", r_row: "broom", r_cross: "cross", r_free: "swap", r_candy: "dice", r_magnet: "magnet",
  e_bigbomb: "bomb", e_rainbow: "wand", e_chainx: "combo", e_gift: "dice", e_freeze: "clock", e_overload: "amp", e_color: "eraser", e_golden: "gold", e_sprinkle: "sparkle", e_quake: "burst",
  l_king: "crown", l_storm: "rotate", l_infinite: "phoenix", l_heart: "shield", l_time: "hourglass", l_midas: "gold" };
for (const a of AUGS) a.art = ART[a.id] || "star";
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const W_RAR = [{ common: 62, rare: 30, epic: 7, legendary: 1 }, { common: 45, rare: 37, epic: 15, legendary: 3 }, { common: 30, rare: 40, epic: 24, legendary: 6 }, { common: 20, rare: 38, epic: 32, legendary: 10 }, { common: 12, rare: 33, epic: 40, legendary: 15 }];
const cp = (c) => (c ? { ...c } : null);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = (c) => c && c.c >= 0 && !c.s && !c.g && !c.f && !c.k;           // 아무것도 안 붙은 보통 젤리
export const swappable = (c) => !!c && c.s !== "x" && c.s !== "o" && !c.f && !c.k;

export class JellyGame {
  constructor(o = {}) {
    if (o.state) { this.load(o.state); return; }
    this.v = VERSION;
    this.mode = o.mode === "augment" ? "augment" : "classic";
    this.stage = o.stage ? Math.max(1, Math.min(STAGES.length, o.stage | 0)) : 0;
    this.timed = this.stage ? false : !!o.timed;
    this.cells = Array(N * N).fill(null); this.nid = 1;
    this.sr = { s: (o.seed >>> 0) || 1 }; this.ar = { s: (o.augSeed ?? ((o.seed ^ 0x9E3779B9) >>> 0)) >>> 0 || 7 };
    this.score = 0; this.moves = 0; this.cleared = 0; this.maxTile = 0; /* maxTile = 가장 긴 연쇄 */ this.merges = 0; /* 터뜨린 젤리 수 */
    this.movesLeft = this.timed ? 0 : (this.stage ? STAGES[this.stage - 1].moves : MOVES_LIMIT); this.alive = true; this.won = false; this.combo = 0; this.specials = 0;
    this.augs = []; this.picks = 0; this.offer = null; this.refresh = 1; this.synG = {};
    this.buffs = { fever: 0 }; this.feverAcc = 0; this.timeBonus = 0; this.streamTime = 0; this.ops = 0;
    this.cnt = { color: [0, 0, 0, 0, 0, 0], stone: 0, ice: 0, chain: 0, choco: 0, special: 0, boss: 0 };
    this.boss = null; this.bossN = 0; this.nextBossAt = BOSS_FIRST; this.bossReward = 0; this.chocoHit = 0;
    this.bestMove = 0; this.augPts = 0; this.comboN = 0; this.rrN = 0; this.bossPts = 0;
    this.fx = []; this.steps = [];
    this.fill();
    if (this.stage) this.setupStage(STAGES[this.stage - 1]);
    if (this.mode === "augment") this.offerIfDue();
    this.fx = []; this.steps = [];
  }
  // ---------- 저장 / 복원 ----------
  save() { const o = JSON.parse(JSON.stringify({ ...this, fx: undefined, steps: undefined })); o.sr = this.sr.s; o.ar = this.ar.s; return o; }
  load(s) { Object.assign(this, JSON.parse(JSON.stringify(s))); this.sr = { s: s.sr >>> 0 }; this.ar = { s: s.ar >>> 0 }; this.fx = []; this.steps = []; if (!this.cnt) this.cnt = { color: [0, 0, 0, 0, 0, 0], stone: 0, ice: 0, chain: 0, choco: 0, special: 0, boss: 0 }; }
  hash() {
    const b = this.boss ? this.boss.t + ":" + this.boss.hp + ":" + this.boss.atk : "";
    const s = this.cells.map(c => c ? c.c + (c.s || "") + (c.g ? "g" : "") + (c.f ? "f" + c.f : "") + (c.k ? "k" : "") : "_").join("") + "|" + this.score + "|" + this.moves + "|" + this.movesLeft + "|" + (this.alive ? 1 : 0) + "|" + this.picks + "|" + (this.offer || []).join(",") + "|" + this.augs.map(a => a.id + ":" + a.ch + ":" + a.cdl).join(",") + "|" + this.sr.s + "|" + this.ar.s + "|" + this.timeBonus + "|" + this.buffs.fever + "|" + b + "|" + this.nextBossAt + "|" + this.stage;
    return hashStr(s);
  }
  /** 남에게 보여 줄 짧은 판 */
  board() { return N + ":" + this.cells.map(encCell).join(""); }
  // ---------- 조회 ----------
  has(id) { return this.augs.some(a => a.id === id); }
  aug(id) { return this.augs.find(a => a.id === id); }
  synCount(g) { return this.augs.filter(a => AUG[a.id]?.group === g).length; }
  goalDone(g) { return g.k === "score" ? this.score >= g.n : g.k === "color" ? this.cnt.color[g.c] >= g.n : g.k === "boss" ? this.cnt.boss >= 1 : (this.cnt[g.k] || 0) >= g.n; }
  goalLeft(g) { return g.k === "score" ? Math.max(0, g.n - this.score) : g.k === "color" ? Math.max(0, g.n - this.cnt.color[g.c]) : g.k === "boss" ? (this.cnt.boss ? 0 : 1) : Math.max(0, g.n - (this.cnt[g.k] || 0)); }
  stageDone() { return this.stage && STAGES[this.stage - 1].goals.every(g => this.goalDone(g)); }
  stars() { if (!this.stage || !this.won) return 0; const s = STAGES[this.stage - 1].star; return this.score >= s[2] ? 3 : this.score >= s[1] ? 2 : 1; }
  // ---------- 판 만들기 ----------
  newCell(c, s = "", g = 0) { return { id: this.nid++, c, s, g }; }
  spawnColor() { return Math.floor(rnd(this.sr) * COLORS); }
  fill() {
    for (let tries = 0; tries < 50; tries++) {
      for (let i = 0; i < N * N; i++) { let c, k = 0; do { c = this.spawnColor(); k++; } while (k < 20 && this.wouldMatchAt(i, c)); this.cells[i] = this.newCell(c); }
      if (this.hasMoves()) return;
    }
  }
  setupStage(S) {
    const pickFree = (minRow = 2) => { const free = []; this.cells.forEach((c, i) => { if (plain(c) && Math.floor(i / N) >= minRow) free.push(i); }); return free.length ? free[Math.floor(rnd(this.sr) * free.length)] : -1; };
    const u = S.setup || {};
    for (let n = 0; n < (u.x || 0); n++) { const i = pickFree(2); if (i >= 0) this.cells[i] = { id: this.nid++, c: -2, s: "x", g: 0 }; }
    for (let n = 0; n < (u.o || 0); n++) { const i = pickFree(4); if (i >= 0) this.cells[i] = { id: this.nid++, c: -3, s: "o", g: 0 }; }
    for (let n = 0; n < (u.i || 0); n++) { const i = pickFree(1); if (i >= 0) this.cells[i].f = u.il || 1; }
    for (let n = 0; n < (u.k || 0); n++) { const i = pickFree(1); if (i >= 0) this.cells[i].k = 1; }
    const b = S.goals.find(g => g.k === "boss"); if (b) this.spawnBoss(b.c, b.n);
    if (!this.hasMoves()) this.shuffle();
  }
  wouldMatchAt(i, c) {
    const r = Math.floor(i / N), q = i % N, at = (rr, qq) => this.cells[rr * N + qq]?.c;
    if (q >= 2 && at(r, q - 1) === c && at(r, q - 2) === c) return true;
    if (r >= 2 && at(r - 1, q) === c && at(r - 2, q) === c) return true;
    return false;
  }
  // ---------- 매치 찾기 ----------
  matchable(c) { return c && c.c >= 0 && c.s !== "r" && c.s !== "x" && c.s !== "o"; }
  findRuns() {
    const runs = [];
    for (let r = 0; r < N; r++) { let q = 0; while (q < N) { const c = this.cells[r * N + q]; if (!this.matchable(c)) { q++; continue; } let e = q + 1; while (e < N && this.matchable(this.cells[r * N + e]) && this.cells[r * N + e].c === c.c) e++; if (e - q >= 3) runs.push({ d: "h", idx: Array.from({ length: e - q }, (_, k) => r * N + q + k) }); q = e; } }
    for (let q = 0; q < N; q++) { let r = 0; while (r < N) { const c = this.cells[r * N + q]; if (!this.matchable(c)) { r++; continue; } let e = r + 1; while (e < N && this.matchable(this.cells[e * N + q]) && this.cells[e * N + q].c === c.c) e++; if (e - r >= 3) runs.push({ d: "v", idx: Array.from({ length: e - r }, (_, k) => (r + k) * N + q) }); r = e; } }
    return runs;
  }
  groups(runs) {
    const gs = [];
    for (const run of runs) {
      const hit = gs.filter(g => run.idx.some(i => g.set.has(i)));
      const ng = { set: new Set(run.idx), runs: [run] };
      for (const g of hit) { for (const i of g.set) ng.set.add(i); ng.runs.push(...g.runs); gs.splice(gs.indexOf(g), 1); }
      gs.push(ng);
    }
    return gs;
  }
  pairOk(i, j) {
    const a = this.cells[i], b = this.cells[j]; if (!swappable(a) || !swappable(b)) return false;
    if (a.s === "r" || b.s === "r" || (a.s && b.s)) return true;
    this.cells[i] = b; this.cells[j] = a; const ok = this.findRuns().length > 0; this.cells[i] = a; this.cells[j] = b; return ok;
  }
  hint() {
    for (let i = 0; i < N * N; i++) for (const j of [i + 1, i + N]) { if ((j === i + 1 && i % N === N - 1) || j >= N * N) continue; if (this.pairOk(i, j)) return [i, j]; }
    return null;
  }
  hasMoves() { return !!this.hint(); }
  // ---------- 점수 ----------
  cascadeAdd(k) {
    if (k <= 1) return 0;
    let per = 0.5 + (this.has("c_chain") ? 0.15 : 0) + (this.has("l_infinite") ? 0.5 : 0);
    const b = this.synCount("burst"); per += b >= 3 ? 0.25 : b >= 2 ? 0.1 : 0;
    let add = per * (k - 1); if (this.has("e_chainx")) add *= 1.5;
    if (this.has("r_cascade")) add += 0.25;
    return add;
  }
  multOf(cell, k, bySpecial, first) {
    let add = 0;
    if (this.has("c_sweet")) add += 0.12; if (this.has("l_king")) add += 0.6;
    const sc = this.synCount("score"); add += sc >= 3 ? 0.12 : sc >= 2 ? 0.05 : 0;
    if (first && this.has("c_first")) add += 0.25;
    if (this.has("c_combo")) add += Math.min(0.3, 0.03 * this.combo);
    if ((bySpecial === "h" || bySpecial === "v") && this.has("c_line")) add += 0.5;
    if (bySpecial === "b" && this.has("c_bombpts")) add += 0.5;
    if (bySpecial && this.has("e_overload")) add += 1;
    let m = (1 + add + this.cascadeAdd(k));
    if ((cell.c === 0 && this.has("c_red")) || (cell.c === 2 && this.has("c_blue")) || (cell.c === 3 && this.has("c_green"))) m *= 2;
    if (this.buffs.fever > 0) m *= 2;
    if (cell.g) m *= this.has("l_midas") ? 5 : this.has("e_golden") ? 4 : 3;
    return Math.min(MULT_CAP, m);
  }
  // ---------- 터뜨리기 ----------
  blastArea(i, s, color) {
    const r = Math.floor(i / N), q = i % N, out = [];
    const row = () => { for (let k = 0; k < N; k++) out.push(r * N + k); }, col = () => { for (let k = 0; k < N; k++) out.push(k * N + q); };
    if (s === "h") { row(); if (this.has("r_cross")) col(); }
    else if (s === "v") { col(); if (this.has("r_cross")) row(); }
    else if (s === "b") { const R = this.has("e_bigbomb") ? 2 : 1; for (let dr = -R; dr <= R; dr++) for (let dq = -R; dq <= R; dq++) { const rr = r + dr, qq = q + dq; if (rr >= 0 && rr < N && qq >= 0 && qq < N) out.push(rr * N + qq); } }
    else if (s === "r") { const c = color ?? this.topColor(); this.cells.forEach((x, j) => { if (x && x.c === c) out.push(j); }); }
    return out;
  }
  topColor() { const n = Array(COLORS).fill(0); for (const x of this.cells) if (x && x.c >= 0) n[x.c]++; let b = 0; for (let c = 1; c < COLORS; c++) if (n[c] > n[b]) b = c; return b; }
  /** 칸들을 터뜨림. 얼음·사슬은 한 겹씩 벗겨지고(제자리), 돌·초콜릿은 깨짐. 반환: 단계 기록 */
  pop(seed, k, opt = {}) {
    const clr = new Map(), queue = [], blasts = [];
    const add = (i, by) => { if (i < 0 || i >= N * N || clr.has(i)) return; const c = this.cells[i]; if (!c) return; if (opt.keep?.has(i)) return; clr.set(i, by); if (c.s && c.s !== "x" && c.s !== "o") queue.push(i); };
    for (const [i, by] of seed) add(i, by);
    if (opt.match) for (const i of [...clr.keys()]) for (const j of nbrs(i)) { const c = this.cells[j]; if (c && (c.s === "x" || c.s === "o" || c.f || c.k) && !clr.has(j) && !opt.keep?.has(j)) clr.set(j, null); } // 옆에서 맞추면 돌·초콜릿 깨지고 얼음·사슬은 한 겹
    while (queue.length) {
      const i = queue.shift(), c = this.cells[i]; if (!c || !c.s || c.s === "x" || c.s === "o") continue;
      blasts.push([i, c.s]); this.specials++;
      for (const j of this.blastArea(i, c.s, opt.rainbowColor?.get(i))) add(j, c.s);
    }
    let pts = 0, luckN = 0, dmg = 0; const first = k === 1, gone = [], hit = [], boss = this.boss, aug = this.mode === "augment";
    const weak = boss ? BOSS_TYPES[boss.t].weak : -9;
    for (const [i, by] of clr) {
      const c = this.cells[i]; if (!c) continue;
      if (c.f > 0) { c.f--; this.cnt.ice++; hit.push(i); pts += 15; dmg += 2; continue; }
      if (c.k) { c.k = 0; this.cnt.chain++; hit.push(i); pts += 15; dmg += 2; continue; }
      gone.push(i);
      if (c.s === "x") { this.cnt.stone++; pts += 20; dmg += 2; continue; }
      if (c.s === "o") { this.cnt.choco++; this.chocoHit = 1; pts += 20; dmg += 2; continue; }
      let p = 10 * this.multOf(c, k, by, first);
      if (this.has("c_lucky") && rnd(this.ar) < 0.04) { p += 40; luckN++; }
      if (aug) this.augPts += Math.max(0, p - 10 * Math.min(MULT_CAP, 1 + 0.5 * (k - 1)));
      pts += p; this.merges++; this.feverAcc++; if (c.c >= 0) this.cnt.color[c.c]++;
      dmg += (c.c === weak ? 2 : 1) + (by ? 1 : 0);
    }
    pts = Math.round(pts);
    const step = { k, clr: gone, hit, blasts, pts, luck: luckN };
    for (const i of gone) this.cells[i] = null;
    this.score += pts; this.cleared += gone.length;
    if (boss && dmg) { boss.hp = Math.max(0, boss.hp - dmg); step.dmg = dmg; if (boss.hp <= 0) this.bossDown(step); }
    if (this.has("r_fever") && this.feverAcc >= 80) { this.feverAcc -= 80; this.buffs.fever = Math.max(this.buffs.fever, 5); this.fx.push({ k: "fever" }); }
    return step;
  }
  gravity() {
    const born = [];
    for (let q = 0; q < N; q++) {
      const col = []; for (let r = N - 1; r >= 0; r--) { const c = this.cells[r * N + q]; if (c) col.push(c); }
      for (let r = N - 1, k = 0; r >= 0; r--, k++) {
        if (k < col.length) this.cells[r * N + q] = col[k];
        else { let s = ""; const c = this.spawnColor(); if (this.has("e_sprinkle") && rnd(this.ar) < 0.04) s = rnd(this.ar) < 0.5 ? "h" : "v"; this.cells[r * N + q] = this.newCell(c, s); born.push(r * N + q); }
      }
    }
    return born;
  }
  specialOf(g, prefer) {
    const longest = Math.max(...g.runs.map(r => r.idx.length)), hv = new Set(g.runs.map(r => r.d));
    let s = "";
    if (longest >= 5) s = "r"; else if (hv.size === 2) s = "b"; else if (longest === 4) s = g.runs[0].d === "h" ? "v" : "h";
    if (!s) return null;
    if (this.has("l_heart")) s = s === "h" || s === "v" ? "b" : s === "b" ? "r" : s;
    const ok = (i) => g.set.has(i) && !this.cells[i].f && !this.cells[i].k;
    let at = prefer.find(ok);
    if (at == null) { const run = g.runs.reduce((a, b) => (b.idx.length > a.idx.length ? b : a)); const mid = run.idx[Math.floor(run.idx.length / 2)]; at = ok(mid) ? mid : run.idx.find(ok); }
    if (at == null) return null;
    return { at, s };
  }
  resolve(prefer = [], k0 = 1) {
    let k = k0;
    for (let guard = 0; guard < 60; guard++) {
      const runs = this.findRuns(); if (!runs.length) break;
      const gs = this.groups(runs), seed = [], keep = new Set(), mk = [];
      for (const g of gs) {
        const sp = this.specialOf(g, k === 1 ? prefer : []);
        const color = this.cells[[...g.set][0]].c;
        for (const i of g.set) if (!sp || i !== sp.at) seed.push([i, null]);
        if (sp) { keep.add(sp.at); mk.push([sp.at, color, sp.s]); }
      }
      for (const [at] of mk) { const c = this.cells[at]; if (c?.s && c.s !== "x" && c.s !== "o") { seed.push([at, null]); keep.delete(at); } }
      const step = this.pop(seed, k, { match: true, keep });
      for (const [at, color, s] of mk) { this.cells[at] = this.newCell(color, s); if (s === "r") this.cells[at].c = -1; this.cnt.special++; }
      step.mk = mk; step.born = this.gravity(); step.cells = this.cells.map(cp); this.steps.push(step);
      if (k > this.maxTile) this.maxTile = k;
      k++;
    }
    return k - 1;
  }
  shuffle(tag = "shuffle") {
    for (let tries = 0; tries < 40; tries++) {
      const free = []; this.cells.forEach((c, i) => { if (c && c.c >= 0 && !c.s && !c.g) free.push(i); });
      const cols = free.map(i => this.cells[i].c);
      for (let a = cols.length - 1; a > 0; a--) { const b = Math.floor(rnd(this.sr) * (a + 1)); [cols[a], cols[b]] = [cols[b], cols[a]]; }
      free.forEach((i, k) => { this.cells[i].c = cols[k]; });
      if (!this.findRuns().length && this.hasMoves()) break;
      if (tries === 39) {
        for (const i of free) { let c, n = 0; do { c = this.spawnColor(); n++; } while (n < 20 && this.wouldMatchAt(i, c)); this.cells[i].c = c; }
        if (!this.hasMoves()) { for (const i of free) { this.cells[i].f = 0; this.cells[i].k = 0; } } // 정말 막히면 얼음·사슬을 풀어 줌
      }
    }
    this.steps.push({ k: 0, shuffle: tag, cells: this.cells.map(cp), clr: [], blasts: [], pts: 0 });
  }
  // ---------- 보스 ----------
  spawnBoss(t, lvl) { const hp = bossHp(lvl); this.boss = { t, lvl, hp, max: hp, atk: BOSS_EVERY }; this.bossN++; this.fx.push({ k: "boss", t, lvl }); }
  bossDown(step) {
    const b = this.boss, bonus = 300 + 200 * b.lvl;
    this.score += bonus; this.bossPts += bonus; step.bossDown = { t: b.t, bonus };
    this.cnt.boss++; this.boss = null; this.nextBossAt = this.cleared + BOSS_GAP; this.bossReward = 1;
    this.fx.push({ k: "bossdown", t: b.t, bonus });
  }
  bossAttack() {
    const B = BOSS_TYPES[this.boss.t], n = B.n + (this.boss.lvl >= 3 ? 1 : 0);
    const free = this.cells.map((c, i) => (plain(c) ? i : -1)).filter(i => i >= 0), cells = [];
    for (let q = 0; q < n && free.length > 12; q++) {
      const i = free.splice(Math.floor(rnd(this.ar) * free.length), 1)[0]; cells.push(i); const c = this.cells[i];
      if (B.atk === "stone") this.cells[i] = { id: this.nid++, c: -2, s: "x", g: 0 };
      else if (B.atk === "choco") this.cells[i] = { id: this.nid++, c: -3, s: "o", g: 0 };
      else if (B.atk === "freeze") c.f = this.boss.lvl >= 1 ? 2 : 1;
      else c.k = 1;
    }
    if (cells.length) { this.steps.push({ k: 0, clr: [], blasts: [], pts: 0, atk: { kind: B.atk, cells }, cells: this.cells.map(cp) }); this.fx.push({ k: "bossatk", kind: B.atk, cells }); }
  }
  /** 조작 하나가 끝난 뒤 공통 처리. isMove = 실제 이동(교환)이었는지 */
  settle(isMove, k) {
    if (isMove) {
      if (k >= 2) this.combo++; else this.combo = 0;
      if (this.buffs.fever > 0) this.buffs.fever--;
      if (this.has("r_candy") && k >= 3) this.makeRandom(["h", "v"], 1);
      const goldEvery = this.has("l_midas") ? 4 : this.has("e_golden") ? 6 : this.has("r_gold") ? 8 : 0;
      if (goldEvery && this.moves % goldEvery === 0) { const free = this.cells.map((c, i) => (plain(c) ? i : -1)).filter(i => i >= 0); if (free.length) { const i = free[Math.floor(rnd(this.ar) * free.length)]; this.cells[i].g = 1; this.fx.push({ k: "gold", at: i }); } }
      if (this.has("e_gift") && this.moves % 10 === 0) this.makeRandom(["h", "v", "b"], 1);
      if (this.has("r_magnet")) { const c = this.topColor(), idx = this.cells.map((x, i) => (plain(x) && x.c === c ? i : -1)).filter(i => i >= 0); const pick = []; for (let n = 0; n < 2 && idx.length; n++) pick.push(idx.splice(Math.floor(rnd(this.ar) * idx.length), 1)[0]); if (pick.length) { const st = this.pop(pick.map(i => [i, null]), 1); st.born = this.gravity(); st.cells = this.cells.map(cp); st.magnet = 1; this.steps.push(st); this.resolve([], 2); } }
      // 초콜릿: 이번 수에 하나도 안 깼으면 옆으로 번짐
      if (!this.chocoHit) { const ch = []; this.cells.forEach((c, i) => { if (c?.s === "o") for (const j of nbrs(i)) if (plain(this.cells[j])) ch.push(j); }); if (ch.length) { const j = ch[Math.floor(rnd(this.ar) * ch.length)]; this.cells[j] = { id: this.nid++, c: -3, s: "o", g: 0 }; this.steps.push({ k: 0, clr: [], blasts: [], pts: 0, atk: { kind: "spread", cells: [j] }, cells: this.cells.map(cp) }); this.fx.push({ k: "spread", at: j }); } }
      if (this.boss && this.alive) { this.boss.atk--; if (this.boss.atk <= 0) { this.bossAttack(); if (this.boss) this.boss.atk = BOSS_EVERY; } }
      for (const a of this.augs) if (a.cdl > 0) a.cdl--;
    }
    if (this.bossReward) { this.bossReward = 0; if (!this.stage) { if (!this.timed) this.addTime(0, 3); else if ((this.bossTime || 0) < 30) { this.bossTime = (this.bossTime || 0) + 5; this.addTime(5, 0); } } if (this.mode === "augment") this.makeRandom(["h", "v", "b"], 2); } // 보스 보상: 이동 +3 / 시간 +5초(한 판 최대 30초)
    if (!this.stage && !this.boss && this.alive && this.cleared >= this.nextBossAt) this.spawnBoss(this.bossN % BOSS_TYPES.length, this.bossN);
    if (!this.hasMoves()) { this.shuffle(); this.fx.push({ k: "shuffle" }); }
    if (this.stage && this.alive && this.stageDone()) { this.won = true; const bonus = this.movesLeft * 150; this.score += bonus; this.alive = false; this.offer = null; this.fx.push({ k: "clear", bonus, stars: this.stars() }); return; }
    if (!this.timed && this.movesLeft <= 0) { this.movesLeft = 0; this.alive = false; this.offer = null; this.fx.push({ k: "out" }); return; }
    if (this.mode === "augment" && this.alive) this.offerIfDue();
  }
  makeRandom(kinds, n) {
    for (let t = 0; t < n; t++) { const free = this.cells.map((c, i) => (plain(c) ? i : -1)).filter(i => i >= 0); if (!free.length) return; const i = free[Math.floor(rnd(this.ar) * free.length)]; this.cells[i].s = kinds[Math.floor(rnd(this.ar) * kinds.length)]; this.fx.push({ k: "made", at: i, s: this.cells[i].s }); }
  }
  // ---------- 이동 ----------
  adjacent(a, b) { return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < N * N && b < N * N && ((Math.abs(a - b) === 1 && Math.floor(a / N) === Math.floor(b / N)) || Math.abs(a - b) === N); }
  comboSeed(a, b) {
    const A1 = this.cells[a], B1 = this.cells[b];
    const rainbowColor = new Map();
    if (A1.s === "r" || B1.s === "r") {
      const R = A1.s === "r" ? a : b, O = R === a ? b : a, oc = this.cells[O];
      this.comboN++;
      if (oc.s === "r") { this.rrN++; return { seed: this.cells.map((x, i) => [i, "r"]).filter(([i]) => this.cells[i]), rainbowColor }; }
      const col = oc.c, seed = [[R, null]];
      if (oc.s === "h" || oc.s === "v" || oc.s === "b") { this.cells.forEach((x, i) => { if (x && x.c === col && !x.s && !x.f && !x.k) { x.s = oc.s === "b" ? "b" : (i % 2 ? "h" : "v"); seed.push([i, "r"]); } }); seed.push([O, "r"]); }
      else { this.cells.forEach((x, i) => { if (x && x.c === col) seed.push([i, "r"]); }); }
      this.cells[R] = null; return { seed: seed.filter(([i]) => this.cells[i]), rainbowColor };
    }
    const sa = A1.s, sb = B1.s; if (!sa || !sb) return null;
    this.comboN++;
    const set = new Set(), r = Math.floor(b / N), q = b % N, addRow = (rr) => { if (rr >= 0 && rr < N) for (let k = 0; k < N; k++) set.add(rr * N + k); }, addCol = (qq) => { if (qq >= 0 && qq < N) for (let k = 0; k < N; k++) set.add(k * N + qq); };
    const line = (s) => s === "h" || s === "v";
    if (line(sa) && line(sb)) { addRow(r); addCol(q); }
    else if ((line(sa) && sb === "b") || (sa === "b" && line(sb))) { for (let d = -1; d <= 1; d++) { addRow(r + d); addCol(q + d); } }
    else if (sa === "b" && sb === "b") { for (let dr = -2; dr <= 2; dr++) for (let dq = -2; dq <= 2; dq++) { const rr = r + dr, qq = q + dq; if (rr >= 0 && rr < N && qq >= 0 && qq < N) set.add(rr * N + qq); } }
    this.cells[a].s = ""; this.cells[b].s = "";
    return { seed: [...set].map(i => [i, sa]), rainbowColor };
  }
  move(a, b, free = false) {
    if (!this.alive) return { ok: false, error: "OVER" };
    if (this.offer) return { ok: false, error: "PICKING" };
    a = Number(a); b = Number(b);
    if (!this.adjacent(a, b)) return { ok: false, error: "BAD_SWAP" };
    const A1 = this.cells[a], B1 = this.cells[b]; if (!swappable(A1) || !swappable(B1)) return { ok: false, error: A1 && B1 && (A1.f || A1.k || B1.f || B1.k) ? "LOCKED" : "BAD_SWAP" };
    this.fx = []; this.steps = []; this.chocoHit = 0;
    const before = this.score;
    this.cells[a] = B1; this.cells[b] = A1;
    const isCombo = A1.s === "r" || B1.s === "r" || (A1.s && B1.s);
    if (!isCombo && !free && !this.findRuns().length) { this.cells[a] = A1; this.cells[b] = B1; return { ok: false, error: "NO_MATCH" }; }
    const combo = isCombo ? this.comboSeed(b, a) : null;
    this.moves++; if (!this.timed) this.movesLeft--; this.ops++;
    let k = 1;
    if (combo) { const st = this.pop(combo.seed, 1, { rainbowColor: combo.rainbowColor }); st.born = this.gravity(); st.cells = this.cells.map(cp); st.combo = 1; this.steps.push(st); k = Math.max(1, this.resolve([], 2)); }
    else k = Math.max(1, this.resolve([a, b], 1));
    if (k > this.maxTile) this.maxTile = k;
    this.settle(true, k);
    this.bestMove = Math.max(this.bestMove, this.score - before);
    return { ok: true, fx: this.fx, steps: this.steps, k, gain: this.score - before };
  }
  // ---------- 증강 ----------
  pool() { const own = new Set(this.augs.map(a => a.id)); return AUGS.filter(a => !own.has(a.id)); }
  offerIfDue() {
    if (this.offer || this.picks >= PICK_AT.length || this.augs.length >= MAX_AUGS) return;
    if (this.cleared < PICK_AT[this.picks]) return;
    this.offer = this.rollOffer();
    if (!this.offer.length) this.offer = null;
  }
  rollOffer() {
    const w = W_RAR[Math.min(this.picks, W_RAR.length - 1)], pool = this.pool(), out = [];
    for (let n = 0; n < 3 && pool.length; n++) {
      const tot = pool.reduce((s, a) => s + w[a.rarity], 0); let r = rnd(this.ar) * tot, k = 0;
      for (; k < pool.length; k++) { r -= w[pool[k].rarity]; if (r < 0) break; }
      out.push(pool.splice(Math.min(k, pool.length - 1), 1)[0].id);
    }
    return out;
  }
  rerollOffer() { if (!this.offer || this.refresh <= 0) return { ok: false, error: "NO_REFRESH" }; this.refresh--; this.fx = []; this.steps = []; this.offer = this.rollOffer(); this.ops++; return { ok: true, fx: this.fx }; }
  pick(id) {
    if (!this.offer || !this.offer.includes(id) || !hasOwn(AUG, id)) return { ok: false, error: "BAD_PICK" };
    this.fx = []; this.steps = []; this.offer = null; this.picks++; this.grant(id); this.ops++;
    if (this.mode === "augment") this.offerIfDue();
    return { ok: true, fx: this.fx };
  }
  addTime(sec, moves) { if (this.timed) this.timeBonus += sec; else this.movesLeft += moves; this.fx.push({ k: "time", sec: this.timed ? sec : 0, moves: this.timed ? 0 : moves }); }
  grant(id) {
    const a = AUG[id]; if (!a || this.has(id) || this.augs.length >= MAX_AUGS) return false;
    this.augs.push({ id, ch: a.ch, cdl: 0 }); this.fx.push({ k: "got", id });
    if (id === "c_time") this.addTime(10, 3); if (id === "r_time") this.addTime(20, 5); if (id === "l_time") this.addTime(40, 10);
    const g = a.group, n = this.synCount(g);
    if (g === "guard" && n >= 2 && !this.synG.guard2) { this.synG.guard2 = 1; this.addTime(5, 2); }
    if (g === "guard" && n >= 3 && !this.synG.guard3) { this.synG.guard3 = 1; this.addTime(10, 4); }
    if (g === "craft" && n >= 3 && !this.synG.craft3) { this.synG.craft3 = 1; for (const x of this.augs) if (AUG[x.id].kind === "active" && x.ch != null) x.ch++; }
    return true;
  }
  use(id, t1 = -1, t2 = -1) {
    if (!this.alive) return { ok: false, error: "OVER" };
    if (this.offer) return { ok: false, error: "PICKING" };
    const a = this.aug(id), A0 = hasOwn(AUG, id) ? AUG[id] : null; if (!a || !A0 || A0.kind !== "active") return { ok: false, error: "BAD_AUG" };
    if (a.ch != null && a.ch <= 0) return { ok: false, error: "NO_CHARGE" }; if (a.cdl > 0) return { ok: false, error: "COOLDOWN" };
    t1 = Number(t1); t2 = Number(t2);
    const cell = Number.isInteger(t1) && t1 >= 0 && t1 < N * N ? this.cells[t1] : null;
    if (A0.target === "cell" && !cell) return { ok: false, error: "BAD_TARGET" };
    if (A0.target === "cell" && (id === "r_striped" || id === "r_bomb" || id === "e_rainbow") && !plain({ ...cell, g: 0 })) return { ok: false, error: "BAD_TARGET" };
    if (A0.target === "pair" && !this.adjacent(t1, t2)) return { ok: false, error: "BAD_TARGET" };
    if (id === "r_free") { const r = this.move(t1, t2, true); if (!r.ok) return r; this.consume(a); this.ops++; this.fx.push({ k: "use", id }); return { ok: true, fx: this.fx, steps: this.steps, k: r.k, gain: r.gain }; }
    this.fx = []; this.steps = []; let k = 0; const before = this.score;
    const popNow = (seed) => { const st = this.pop(seed, 1); st.born = this.gravity(); st.cells = this.cells.map(cp); this.steps.push(st); k = Math.max(1, this.resolve([], 2)); };
    if (id === "c_hammer") popNow([[t1, null]]);
    else if (id === "r_striped") { cell.s = rnd(this.ar) < 0.5 ? "h" : "v"; this.steps.push({ k: 0, clr: [], blasts: [], pts: 0, made: t1, cells: this.cells.map(cp) }); }
    else if (id === "r_bomb") { cell.s = "b"; this.steps.push({ k: 0, clr: [], blasts: [], pts: 0, made: t1, cells: this.cells.map(cp) }); }
    else if (id === "e_rainbow") { cell.s = "r"; cell.c = -1; cell.g = 0; this.steps.push({ k: 0, clr: [], blasts: [], pts: 0, made: t1, cells: this.cells.map(cp) }); }
    else if (id === "r_shuffle") this.shuffle("aug");
    else if (id === "r_row") { const r = Math.floor(t1 / N); popNow(Array.from({ length: N }, (_, q) => [r * N + q, "h"])); }
    else if (id === "e_color") { const col = cell.c >= 0 ? cell.c : this.topColor(); popNow(this.cells.map((x, i) => (x && x.c === col ? [i, "r"] : null)).filter(Boolean)); }
    else if (id === "e_quake") popNow(Array.from({ length: N * 2 }, (_, k2) => [(N - 2) * N + k2, "b"]));
    else if (id === "e_freeze") this.addTime(12, 4);
    else if (id === "l_storm") this.makeRandom(["h", "v", "b"], 6);
    this.consume(a); this.ops++;
    if (k > this.maxTile) this.maxTile = k;
    this.fx.push({ k: "use", id });
    this.settle(false, k);
    this.bestMove = Math.max(this.bestMove, this.score - before);
    return { ok: true, fx: this.fx, steps: this.steps, k, gain: this.score - before };
  }
  consume(a) { if (a.ch != null) a.ch--; const cd = AUG[a.id].cd || 0; a.cdl = this.synCount("craft") >= 2 ? Math.ceil(cd / 2) : cd; }
  // ---------- 후원 (서버만) ----------
  stream(kind) {
    if (!this.alive) return { ok: false };
    this.fx = []; this.steps = []; let ok = false, note = "";
    if (kind === "gift" && this.mode === "augment" && this.augs.length < MAX_AUGS) { const ids = this.pool().map(a => a.id); if (ids.length) { const id = ids[Math.floor(rnd(this.ar) * ids.length)]; ok = this.grant(id); note = AUG[id].name; } }
    if (kind === "frenzy") { this.buffs.fever = Math.max(this.buffs.fever, 5); ok = true; }
    if (kind === "clean") { this.makeRandom(["h", "v", "b"], 3); ok = true; }
    if (kind === "time" && this.streamTime < STREAM_TIME_CAP) { if (this.timed) { const add = Math.min(15, STREAM_TIME_CAP - this.streamTime); this.streamTime += add; note = "+" + add + "초"; } else { this.movesLeft += 3; this.streamTime += 15; note = "+3"; } ok = true; }
    if (kind === "junk") { for (let n = 0; n < 2; n++) { const free = this.cells.map((c, i) => (plain(c) ? i : -1)).filter(i => i >= 0); if (free.length < 10) break; const i = free[Math.floor(rnd(this.ar) * free.length)]; this.cells[i] = { id: this.nid++, c: -2, s: "x", g: 0 }; ok = true; } if (!this.hasMoves()) this.shuffle(); }
    if (ok) { this.fx.push({ k: "stream", kind }); this.ops++; }
    return { ok, note, fx: this.fx };
  }
  apply(op) {
    if (!Array.isArray(op)) return { ok: false, error: "BAD_OP" };
    if (op[0] === "m") return this.move(op[1], op[2]);
    if (op[0] === "p") return this.pick(String(op[1] || ""));
    if (op[0] === "r") return this.rerollOffer();
    if (op[0] === "u") return this.use(String(op[1] || ""), op[2] ?? -1, op[3] ?? -1);
    return { ok: false, error: "BAD_OP" };
  }
  summary() { return { score: this.score, max: this.maxTile, moves: this.moves, merges: this.merges, alive: this.alive, augs: this.augs.map(a => a.id), movesLeft: this.movesLeft, boss: this.cnt.boss }; }
}
function nbrs(i) { const r = Math.floor(i / N), q = i % N, o = []; if (q > 0) o.push(i - 1); if (q < N - 1) o.push(i + 1); if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); return o; }
const LET = "abcdef";
function encCell(c) {
  if (!c) return "_";
  let ch = c.s === "x" ? "X" : c.s === "o" ? "O" : c.s === "r" ? "R" : c.s === "h" ? "ghijkl"[c.c] : c.s === "v" ? "mnopqr"[c.c] : c.s === "b" ? "stuvwx"[c.c] : LET[c.c];
  return (ch || "a") + (c.g ? "*" : "") + (c.f ? "~".repeat(c.f) : "") + (c.k ? "#" : "");
}
export function seedFor(roomSeed, idx, fair) { return fair ? (roomSeed >>> 0) || 1 : hashStr(roomSeed + ":" + idx) || 1; }
export function decodeBoard(str) {
  const body = String(str || "").split(":")[1] || "", cells = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i], last = cells[cells.length - 1];
    if (ch === "*") { if (last) last.g = 1; continue; }
    if (ch === "~") { if (last) last.f = (last.f || 0) + 1; continue; }
    if (ch === "#") { if (last) last.k = 1; continue; }
    if (ch === "_") { cells.push(null); continue; }
    if (ch === "X") { cells.push({ c: -2, s: "x", g: 0 }); continue; }
    if (ch === "O") { cells.push({ c: -3, s: "o", g: 0 }); continue; }
    if (ch === "R") { cells.push({ c: -1, s: "r", g: 0 }); continue; }
    let k;
    if ((k = "abcdef".indexOf(ch)) >= 0) cells.push({ c: k, s: "", g: 0 });
    else if ((k = "ghijkl".indexOf(ch)) >= 0) cells.push({ c: k, s: "h", g: 0 });
    else if ((k = "mnopqr".indexOf(ch)) >= 0) cells.push({ c: k, s: "v", g: 0 });
    else if ((k = "stuvwx".indexOf(ch)) >= 0) cells.push({ c: k, s: "b", g: 0 });
  }
  while (cells.length < N * N) cells.push(null);
  return { n: N, cells: cells.slice(0, N * N) };
}
