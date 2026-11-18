// =========================
// DUO 증강 벽돌깨기 — 규칙·물리 엔진 (2026-11-18)
// ※ 서버(worldcup-backend/src/brk-core.js)와 화면(js/brick/brk-core.js)이 '같은 파일'이어야 함. 고치면 둘 다 복사.
// · 고정 타임스텝 1/60초, 공 이동은 하위 스텝(한 번에 3 이하)으로 쪼개 충돌 누락 방지
// · 결정적: + − × ÷ √ 와 floor/round/min/max/abs만 사용 (sin·cos·pow·random·Date 금지) → 브라우저·서버 결과가 같음
// · 화면은 이 엔진으로 내 판을 바로 돌리고 입력(패들 목표 x·발사·증강)만 서버로 → 서버가 같은 입력으로 다시 돌려 확인
// · 난수 3갈래: 스테이지 배치(seed+스테이지 번호, 모두 같음) · 게임 중(gr) · 증강 카드(ar)
// =========================

export const VERSION = 1;
export const W = 480, H = 640, COLS = 12, BW = 37, BH = 16, GAP = 2, OFFX = 7, OFFY = 64;  // 벽과 벽돌 사이 틈 7 < 공 지름 12 (옆으로 새지 않음)
export const PADDLE_Y = 596, PADDLE_H = 14, PADDLE_W = 84, BALL_R = 6;
export const MAX_BALLS = 30, MAX_LASERS = 60, MAX_ITEMS = 40, MAX_LIVES = 5, START_LIVES = 3;
export const MAX_AUGS = 5, MULT_CAP = 8, TPS = 60;
export const BOSS_EVERY = 4, BOSS_TIME = 90 * TPS;
const SUB = 3;                 // 하위 스텝 한 번에 최대 이동 거리
const PADDLE_SPEED = 16;       // 한 틱 최대 패들 이동
const SERVE_AUTO = 3 * TPS;    // 3초 안 쏘면 자동 발사
const SNAP_EVERY = 30;         // 시간 역행용 기록 간격
const SNAP_KEEP = 7;           // 3초 = 180틱 이상 보관

// ---------- 난수 ----------
export function rnd(st) {
  let t = (st.s = (st.s + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const tri = (t, period) => { const p = ((t % period) + period) % period / period; return p < 0.5 ? p * 4 - 1 : 3 - p * 4; }; // -1..1 삼각파 (sin 대신)

// ---------- 증강 40종 ----------
// kind: passive(지속) · active(사용형 ch=횟수, cd=재사용 틱) · trigger(발동형)
// target: none · point(경기장 한 점)
export const RARITY = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" };
export const KIND_LABEL = { passive: "지속형", active: "사용형", trigger: "발동형" };
export const SYNERGY = {
  paddle: { name: "패들 장인", icon: "🏓", t2: "패들 폭 +10%", t3: "패들에 맞을 때마다 콤보 유지" },
  ball: { name: "공 다루기", icon: "🔵", t2: "최대 공 수 그대로, 공 피해 +0 → 첫 타 +1 (스테이지마다 한 번)", t3: "새 공이 생길 때 1초 동안 관통" },
  blast: { name: "폭발 연구", icon: "💥", t2: "폭발 반경 +15%", t3: "폭발 피해 +1" },
  gold: { name: "황금 손", icon: "💰", t2: "점수 +10%", t3: "점수 +25%" },
};
const A = (id, name, rarity, kind, group, icon, desc, o = {}) => ({ id, name, rarity, kind, group, icon, desc, ch: o.ch ?? null, cd: o.cd || 0, dur: o.dur || 0, target: o.target || "none", noBoss: !!o.noBoss, anim: o.anim || "spark" });
export const AUGS = [
  // ---- 일반 10
  A("c_wide", "강한 패들", "common", "passive", "paddle", "plus", "패들 폭 +30%"),
  A("c_fast", "빠른 공", "common", "passive", "ball", "amp", "공 속도 +15%, 벽돌 점수 +15%"),
  A("c_slow", "느린 공", "common", "passive", "ball", "hourglass", "공 속도 −18% (받기 쉬움)"),
  A("c_aim", "정확한 반사", "common", "passive", "paddle", "eye", "패들 반사 각도가 너무 눕거나 서지 않게 보정 (25°~65°)"),
  A("c_combo", "콤보 전문가", "common", "passive", "gold", "combo", "콤보 한 단계 점수 +5% → +8%, 최대 ×2.6"),
  A("c_sturdy", "튼튼한 패들", "common", "passive", "paddle", "shield", "보스 공격(탄·광선)에 패들이 줄어들지 않고, 패들 양 끝 판정 +6"),
  A("c_lucky", "행운의 벽돌", "common", "passive", "gold", "clover", "벽돌을 깨면 12% 확률로 코인이 떨어짐 (받으면 25×스테이지 점)"),
  A("c_reader", "공 감별사", "common", "passive", "ball", "eye", "공이 갈 길(벽 2번 튕김까지)을 미리 보여 줌"),
  A("c_streak", "연속 파괴", "common", "trigger", "gold", "star", "패들에 닿지 않고 벽돌 8개를 깰 때마다 100×스테이지 보너스"),
  A("c_extra", "추가 기회", "common", "trigger", "paddle", "phoenix", "생명을 잃지 않고 스테이지를 깨면 생명 +1 (최대 3번, 생명 최대 5)", { ch: 3 }),
  // ---- 희귀 10
  A("r_multi", "멀티볼", "rare", "active", "ball", "double", "공 2개 추가 (최대 30개)", { ch: 3, cd: 2 * TPS, anim: "multi" }),
  A("r_laser", "레이저 패들", "rare", "active", "blast", "line", "패들 양 끝에서 레이저 2발 (15번, 0.6초마다)", { ch: 15, cd: 36, anim: "laser" }),
  A("r_bomb", "폭탄 공", "rare", "passive", "blast", "bomb", "공이 벽돌을 4번 칠 때마다 폭발 (반경 40, 피해 1)"),
  A("r_pierce", "관통 공", "rare", "active", "ball", "line", "6초 동안 공이 벽돌을 뚫고 지나감 (한 벽돌엔 0.25초에 한 번만 피해)", { ch: 3, cd: 8 * TPS, dur: 6 * TPS, anim: "pierce" }),
  A("r_magnet", "자석 패들", "rare", "passive", "paddle", "magnet", "공이 패들에 붙음 — 누르면 발사 (1.2초 지나면 자동)"),
  A("r_ice", "얼음 공", "rare", "passive", "ball", "shield", "맞은 벽돌을 3초 동안 얼림 — 언 벽돌은 다음 타격 피해 +1, 움직이는 벽돌·보스는 멈춤"),
  A("r_fire", "화염 공", "rare", "passive", "blast", "burst", "맞은 벽돌·보스에 불: 1초마다 피해 1, 2번"),
  A("r_shock", "전기 공", "rare", "passive", "blast", "amp", "벽돌을 칠 때 가까운 벽돌 2개(60 안)에 전기 피해 1"),
  A("r_goldball", "황금 공", "rare", "passive", "gold", "gold", "모든 벽돌 점수 ×1.5"),
  A("r_heal", "회복 구슬", "rare", "active", "paddle", "phoenix", "생명 +1 (2번, 최대 5)", { ch: 2, anim: "heal" }),
  // ---- 영웅 10
  A("e_storm", "공 폭풍", "epic", "active", "ball", "burst", "공 8개를 한꺼번에 추가 (최대 30개)", { ch: 1, anim: "multi" }),
  A("e_barrage", "레이저 폭격", "epic", "active", "blast", "line", "3초 동안 위로 레이저가 쏟아짐 (약 30발)", { ch: 1, dur: 3 * TPS, anim: "laser" }),
  A("e_blast", "대폭발", "epic", "active", "blast", "bomb", "고른 곳 반경 90 벽돌에 피해 3 (보스 30)", { ch: 1, target: "point", anim: "boom" }),
  A("e_timestop", "시간 정지", "epic", "active", "paddle", "clock", "5초 동안 보스·움직이는 벽돌·적 공격·보스 시간이 멈추고, 바닥이 벽이 됨", { ch: 1, dur: 5 * TPS, anim: "time" }),
  A("e_gravity", "중력 조작", "epic", "active", "ball", "magnet", "6초 동안 공이 가장 단단한 벽돌(보스) 쪽으로 휘어짐", { ch: 2, cd: 10 * TPS, dur: 6 * TPS, anim: "gravity" }),
  A("e_split", "분열 폭탄", "epic", "passive", "blast", "double", "폭발이 일어나면 그 자리에서 공 1개가 나옴 (2초에 한 번, 최대 30개)"),
  A("e_guard", "무적 패들", "epic", "active", "paddle", "shield", "8초 동안 바닥에 방어막 — 공이 떨어지지 않음", { ch: 2, cd: 5 * TPS, dur: 8 * TPS, anim: "guard" }),
  A("e_spread", "벽돌 전염", "epic", "passive", "blast", "clover", "벽돌이 부서지면 30% 확률로 옆 벽돌(상하좌우)에 피해 1 (옮은 피해는 다시 안 퍼짐)"),
  A("e_goldrush", "황금 폭주", "epic", "active", "gold", "gold", "10초 동안 점수 ×2", { ch: 1, dur: 10 * TPS, anim: "gold" }),
  A("e_rebuild", "스테이지 재구성", "epic", "active", "paddle", "rotate", "남은 벽돌을 가운데로 모으고 철 벽돌을 단단한 벽돌로 바꿈 (보스판 제외)", { ch: 1, noBoss: true, anim: "rebuild" }),
  // ---- 전설 10
  A("l_infinite", "무한 멀티볼", "legendary", "active", "ball", "double", "10초 동안 0.5초마다 공 1개 생성 (최대 30개)", { ch: 1, dur: 10 * TPS, anim: "multi" }),
  A("l_pierce", "절대 관통", "legendary", "active", "ball", "cross", "10초 동안 관통 + 공 피해 ×2", { ch: 1, dur: 10 * TPS, anim: "pierce" }),
  A("l_destroy", "파괴의 신", "legendary", "active", "blast", "burst", "모든 벽돌에 피해 2, 보스는 최대 체력 15% 피해", { ch: 1, anim: "boom" }),
  A("l_rewind", "시간 역행", "legendary", "active", "paddle", "rewind", "3초 전 상태로 되돌림 (점수·생명·공도 그때로)", { ch: 1, anim: "rewind" }),
  A("l_arena", "황금 아레나", "legendary", "active", "gold", "crown", "20초 동안 가운데 황금 구역 — 그 안에서 부순 벽돌 점수 ×3", { ch: 1, dur: 20 * TPS, anim: "gold" }),
  A("l_legion", "공의 군단", "legendary", "active", "ball", "crown", "공을 최대(30개)까지 한 번에 채움", { ch: 1, anim: "multi" }),
  A("l_lasermaster", "레이저 지배자", "legendary", "passive", "blast", "line", "0.5초마다 자동 레이저 (벽돌 3개까지 관통), 레이저 패들 재사용 절반"),
  A("l_blackhole", "블랙홀", "legendary", "active", "blast", "eye", "고른 곳에 6초 블랙홀: 반경 80 벽돌에 0.5초마다 피해 1, 공을 끌어당김", { ch: 1, target: "point", dur: 6 * TPS, anim: "hole" }),
  A("l_miracle", "최후의 기적", "legendary", "trigger", "paddle", "phoenix", "마지막 생명을 잃는 순간 한 번, 생명 2개로 부활 + 5초 방어막", { ch: 1 }),
  A("l_god", "벽돌깨기의 신", "legendary", "passive", "blast", "crown", "모든 피해 +1, 공 속도 +10%, 벽돌 10개마다 폭발, 점수 +25%"),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const RW = { common: 60, rare: 28, epic: 10, legendary: 3 };
const rarityW = (r, k) => r === "common" ? Math.max(20, RW.common - 10 * k) : r === "rare" ? RW.rare : r === "epic" ? RW.epic + 4 * k : RW.legendary + 2 * k;

// ---------- 벽돌 ----------
export const BRICK = {
  n: { hp: 1, pts: 10, color: ["blue", "green", "pink", "orange"] },
  h: { hp: 2, pts: 20, color: ["blue", "green", "pink", "orange"], outline: true },
  m: { hp: 4, pts: 40, color: ["grey"], outline: true },
  x: { hp: 1, pts: 15, color: ["red"] },
  g: { hp: 1, pts: 50, color: ["yellow"] },
  c: { hp: 1, pts: 20, color: ["black"] }, // 캡슐 벽돌 (아이템이 떨어짐)
};
export const BRICK_COLORS = ["blue", "green", "grey", "orange", "pink", "red", "yellow", "black"];
export const CAPSULE = { W: "넓은 패들 10초", M: "공 +2", S: "느린 공 8초", L: "생명 +1" };
export const BOSS_KIND = ["golem", "eye", "hive"];
export const BOSS_NAME = { golem: "벽돌 골렘", eye: "감시의 눈", hive: "벽돌 벌집" };
const bx = (c) => OFFX + c * (BW + GAP), by = (r) => OFFY + r * (BH + GAP);

// 스테이지 배치 (seed+번호만으로 결정 → 모든 사람 같음)
const PATTERNS = [
  (r, c, R) => r < R,                                                         // 꽉 찬 벽
  (r, c, R) => r < R && (r + c) % 2 === 0,                                    // 체크
  (r, c, R) => r < R && Math.abs(c - 5.5) <= r + 0.5,                         // 피라미드
  (r, c, R) => r < R && (c < 4 || c > 7 || r % 3 === 0),                     // 기둥
  (r, c, R) => r < R && (Math.abs(c - 5.5) > r - 1 || r === R - 1),          // 역 V
  (r, c, R) => r < R && c % 3 !== 1,                                          // 줄무늬
  (r, c, R) => { const d = Math.abs(c - 5.5) + Math.abs(r - (R - 1) / 2); return r < R && d < R * 0.75 && d > R * 0.25; }, // 다이아 고리
  (r, c, R) => r < R && (r % 2 === 0 || c === 0 || c === 11),                 // 사다리
];
export function makeStage(seed, stage) {
  const rr = { s: (hashStr(seed + ":stage:" + stage) || 1) >>> 0 };
  const boss = stage % BOSS_EVERY === 0;
  const bricks = []; const moving = [];
  const R = boss ? 3 : Math.min(9, 3 + Math.floor(stage / 2));
  const pat = PATTERNS[boss ? 3 : (stage - 1 + Math.floor(rnd(rr) * 3)) % PATTERNS.length];
  const hard = Math.min(0.45, 0.06 + stage * 0.035), metal = stage >= 3 ? Math.min(0.18, (stage - 2) * 0.025) : 0;
  let id = 1;
  for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) {
    if (!pat(r, c, R)) continue;
    const q = rnd(rr); let t = "n";
    if (q < metal) t = "m"; else if (q < metal + hard) t = "h"; else if (q < metal + hard + 0.05) t = "x"; else if (q < metal + hard + 0.08) t = "g"; else if (q < metal + hard + 0.15) t = "c";
    const d = BRICK[t]; const hp = t === "h" ? (stage >= 6 ? 3 : 2) : t === "m" ? (stage >= 8 ? 5 : 4) : d.hp;
    const col = d.color[(r + Math.floor(rnd(rr) * 2)) % d.color.length];
    bricks.push({ id: id++, r: boss ? r + 5 : r, c, t, hp, mx: hp, col, frz: 0, burn: 0, bt: 0 });
  }
  // 움직이는 줄: 6스테이지부터 1~2줄, 보스판은 방패 줄
  if (!boss && stage >= 6) { const k = stage >= 11 ? 2 : 1; for (let j = 0; j < k; j++) moving.push({ r: Math.floor(rnd(rr) * R), amp: 18 + Math.floor(rnd(rr) * 14), per: 240 + Math.floor(rnd(rr) * 120) }); }
  if (boss) for (let r = 5; r < 8; r++) moving.push({ r, amp: 22, per: 200 + r * 20 });
  const b = boss ? { kind: BOSS_KIND[(stage / BOSS_EVERY - 1) % 3], tier: Math.floor(stage / BOSS_EVERY), hp: 0, mx: 0, w: 168, h: 64, y: 64, frz: 0, burn: 0, bt: 0, atk: 120, beam: 0, beamX: 0 } : null;
  if (b) { b.mx = b.hp = 60 + 45 * (b.tier - 1) + (b.kind === "golem" ? 20 : 0); }
  return { bricks, moving, boss: b, rows: boss ? 8 : R };
}

/**
 * 한 사람의 경기장.
 * o: { seed, mode:'classic'|'augment', timed }
 */
export class BrickGame {
  constructor(o = {}) {
    if (o.state) { this.load(o.state); return; }
    this.v = VERSION; this.seed = (o.seed >>> 0) || 1; this.mode = o.mode === "augment" ? "augment" : "classic"; this.timed = !!o.timed;
    this.gr = { s: (hashStr(this.seed + ":g") || 3) >>> 0 }; this.ar = { s: (hashStr(this.seed + ":a") || 5) >>> 0 };
    this.t = 0; this.score = 0; this.lives = START_LIVES; this.stage = 0; this.alive = true; this.phase = "play"; this.phaseT = 0;
    this.px = W / 2; this.pTarget = W / 2; this.nid = 1;
    this.balls = []; this.lasers = []; this.items = []; this.shots = []; this.fxq = [];
    this.bricks = []; this.moving = []; this.boss = null; this.rows = 0; this.bossT = 0;
    this.combo = 0; this.maxCombo = 0; this.streak = 0; this.broken = 0; this.lostThisStage = false; this.bombCount = 0; this.godCount = 0;
    this.augs = []; this.picks = 0; this.offer = null; this.refresh = 1;
    this.buf = { pierce: 0, lpierce: 0, timestop: 0, gravity: 0, guard: 0, goldrush: 0, arena: 0, infinite: 0, barrage: 0, wide: 0, slow: 0, shrink: 0, hole: 0, holeX: 0, holeY: 0, auto: 0, splitCd: 0, firstHit: 0 };
    this.snaps = []; this.kills = { boss: 0 };
    this.nextStage();
    if (this.mode === "augment") this.offerIfDue(true);
  }
  // ---------- 저장 ----------
  save(lite = false) {
    const o = { v: this.v, seed: this.seed, mode: this.mode, timed: this.timed, gr: this.gr.s, ar: this.ar.s, t: this.t, score: this.score, lives: this.lives, stage: this.stage, alive: this.alive, phase: this.phase, phaseT: this.phaseT, px: this.px, pTarget: this.pTarget, nid: this.nid,
      balls: this.balls.map(b => ({ ...b, hit: b.hit ? { ...b.hit } : null })), lasers: this.lasers.map(x => ({ ...x })), items: this.items.map(x => ({ ...x })), shots: this.shots.map(x => ({ ...x })),
      bricks: this.bricks.map(b => ({ ...b })), moving: this.moving.map(m => ({ ...m })), boss: this.boss ? { ...this.boss } : null, rows: this.rows, bossT: this.bossT,
      combo: this.combo, maxCombo: this.maxCombo, streak: this.streak, broken: this.broken, lostThisStage: this.lostThisStage, bombCount: this.bombCount, godCount: this.godCount, buf: { ...this.buf }, kills: { ...this.kills }, stageT: this.stageT || 0, playT: this.playT || 0, _frozenOff: this._frozenOff ? { ...this._frozenOff } : null, _boomN: 0 };
    if (!lite) Object.assign(o, { augs: this.augs.map(a => ({ ...a })), picks: this.picks, offer: this.offer ? [...this.offer] : null, refresh: this.refresh, snaps: this.snaps.map(s => JSON.parse(JSON.stringify(s))) });
    return o;
  }
  load(s) {
    const c = JSON.parse(JSON.stringify(s));
    Object.assign(this, c); this.gr = { s: c.gr >>> 0 }; this.ar = { s: c.ar >>> 0 }; this.fxq = [];
    if (!this.snaps) this.snaps = []; if (!this.augs) this.augs = [];
  }
  hash() {
    const n = (x) => Math.round(x * 1000);
    let s = this.t + "|" + this.score + "|" + this.lives + "|" + this.stage + "|" + this.phase + "|" + n(this.px) + "|" + this.gr.s + "|" + this.ar.s + "|" + (this.offer || []).join(",") + "|" + this.augs.map(a => a.id + a.ch + ":" + a.cdT).join(",");
    for (const b of this.balls) s += "|" + n(b.x) + "," + n(b.y) + "," + n(b.dx) + "," + n(b.dy);
    for (const b of this.bricks) s += ";" + b.id + ":" + b.hp;
    if (this.boss) s += "|B" + this.boss.hp + "," + n(this.boss.x || 0);
    s += "|" + this.lasers.length + "|" + this.items.length + "|" + this.shots.length;
    return hashStr(s);
  }
  // ---------- 조회 ----------
  has(id) { return this.augs.some(a => a.id === id); }
  aug(id) { return this.augs.find(a => a.id === id); }
  synCount(g) { return this.augs.filter(a => AUG[a.id]?.group === g).length; }
  isBoss() { return !!this.boss; }
  paddleW() {
    let w = PADDLE_W; if (this.has("c_wide")) w *= 1.3; if (this.synCount("paddle") >= 2) w *= 1.1; if (this.buf.wide > 0) w *= 1.35; if (this.buf.shrink > 0 && !this.has("c_sturdy")) w *= 0.7;
    return Math.round(w);
  }
  speed() {
    let s = Math.min(8, 5.6 + 0.15 * (this.stage - 1));
    if (this.has("c_fast")) s *= 1.15; if (this.has("c_slow")) s *= 0.82; if (this.has("l_god")) s *= 1.1; if (this.buf.slow > 0) s *= 0.8;
    s *= 1 + Math.min(0.3, (this.stageT || 0) / (90 * TPS) * 0.3); // 한 스테이지가 길어지면 공이 점점 빨라짐 (최대 +30%)
    return Math.min(10, Math.max(3, s));
  }
  dmg() { let d = 1; if (this.has("l_god")) d += 1; if (this.buf.lpierce > 0) d *= 2; return d; }
  piercing() { return this.buf.pierce > 0 || this.buf.lpierce > 0; }
  rowOff(r) { if (this.buf.timestop > 0) return this._frozenOff?.[r] ?? 0; const m = this.moving.find(q => q.r === r); return m ? m.amp * tri(this.t, m.per) : 0; }
  brickRect(b) { const o = this.rowOff(b.r); return [bx(b.c) + o, by(b.r), BW, BH]; }
  bossRect() { const b = this.boss; return b ? [b.x - b.w / 2, b.y, b.w, b.h] : null; }
  breakables() { return this.bricks.length; }
  // ---------- 스테이지 ----------
  nextStage() {
    this.stage++;
    const st = makeStage(this.seed, this.stage);
    this.bricks = st.bricks; this.moving = st.moving; this.rows = st.rows; this.boss = st.boss;
    if (this.boss) { this.boss.x = W / 2; this.bossT = BOSS_TIME; this.fxq.push({ k: "boss", kind: this.boss.kind }); }
    this.lasers = []; this.items = []; this.shots = []; this.snaps = []; this.lostThisStage = false; this.stageT = 0; this.buf.firstHit = this.synCount("ball") >= 2 ? 1 : 0;
    this.balls = []; this.serve();
    this.fxq.push({ k: "stage", n: this.stage });
  }
  serve() { this.balls.push({ id: this.nid++, x: this.px, y: PADDLE_Y - BALL_R - 1, dx: 0.32, dy: -0.95, stuck: 0, so: 0, held: SERVE_AUTO, hit: null, np: 0, nb: 0, pt: 0 }); this.normBall(this.balls[this.balls.length - 1]); }
  normBall(b) { const l = Math.sqrt(b.dx * b.dx + b.dy * b.dy) || 1; b.dx /= l; b.dy /= l; if (Math.abs(b.dy) < 0.3) { b.dy = b.dy < 0 ? -0.3 : 0.3; const k = Math.sqrt(1 - 0.09); b.dx = b.dx < 0 ? -k : k; } }
  addBall(x, y, dx, dy, pierceT = 0) {
    if (this.balls.length >= MAX_BALLS) return null;
    const b = { id: this.nid++, x: Math.max(BALL_R, Math.min(W - BALL_R, x)), y: Math.max(BALL_R, Math.min(PADDLE_Y - 10, y)), dx, dy, stuck: 0, so: 0, held: 0, hit: null, np: 0, nb: 0, pt: pierceT || (this.synCount("ball") >= 3 ? TPS : 0) };
    this.normBall(b); this.balls.push(b); return b;
  }
  // ---------- 점수 ----------
  scoreMult(x, y) {
    let m = 1;
    if (this.has("c_fast")) m += 0.15; if (this.has("r_goldball")) m += 0.5; if (this.has("l_god")) m += 0.25;
    const g = this.synCount("gold"); if (g >= 3) m += 0.25; else if (g >= 2) m += 0.1;
    const step = this.has("c_combo") ? 0.08 : 0.05, cap = this.has("c_combo") ? 2.6 : 2;
    m *= Math.min(cap, 1 + this.combo * step);
    if (this.buf.goldrush > 0) m *= 2;
    if (this.buf.arena > 0 && y >= 150 && y <= 350 && x >= 60 && x <= W - 60) m *= 3;
    return Math.min(MULT_CAP, m);
  }
  // ---------- 피해 ----------
  /** 벽돌 피해. src: ball·laser·boom·shock·burn·spread·hole. 부서지면 true */
  hitBrick(b, d, src, depth = 0) {
    if (b.hp <= 0) return false;
    if (b.frz > 0 && src !== "burn") { d += 1; b.frz = 0; }
    b.hp -= d;
    if (src === "ball" || src === "laser") {
      if (this.has("r_ice")) b.frz = 3 * TPS;
      if (this.has("r_fire")) { b.burn = 2; b.bt = TPS; }
    }
    if (b.hp > 0) { this.fxq.push({ k: "hit", id: b.id }); return false; }
    // 부서짐
    const [x, y] = this.brickRect(b), cx = x + BW / 2, cy = y + BH / 2;
    this.bricks = this.bricks.filter(q => q !== b);
    this.broken++; this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const pts = Math.round(BRICK[b.t].pts * (1 + 0.1 * (this.stage - 1)) * this.scoreMult(cx, cy));
    this.score += pts;
    this.fxq.push({ k: "break", id: b.id, x: cx, y: cy, col: b.col, t: b.t, pts });
    if (b.t === "x") this.explode(cx, cy, 46, 1, depth + 1, "brick");
    if (b.t === "c") this.dropItem(cx, cy);
    if (this.has("c_lucky") && rnd(this.gr) < 0.12 && this.items.length < MAX_ITEMS) this.items.push({ id: this.nid++, x: cx, y: cy, k: "coin" });
    if (this.has("c_streak") && src !== "spread") { this.streak++; if (this.streak >= 8) { this.streak = 0; const bon = 100 * this.stage; this.score += bon; this.fxq.push({ k: "streak", pts: bon, x: cx, y: cy }); } }
    if (this.has("e_spread") && src !== "spread" && depth < 3) {
      for (const q of this.bricks.slice()) { if (Math.abs(q.r - b.r) + Math.abs(q.c - b.c) !== 1 || q.hp <= 0) continue; if (rnd(this.gr) < 0.3) { this.hitBrick(q, 1, "spread", depth + 1); this.fxq.push({ k: "spread", from: b.id, to: q.id }); } }
    }
    if (this.has("l_god")) { this.godCount++; if (this.godCount >= 10) { this.godCount = 0; this.explode(cx, cy, 50, 1, depth + 1, "god"); } }
    return true;
  }
  hitBoss(d, src) {
    const b = this.boss; if (!b || b.hp <= 0) return;
    if (src === "ball" || src === "laser") { if (this.has("r_ice")) b.frz = 2 * TPS; if (this.has("r_fire")) { b.burn = 2; b.bt = TPS; } }
    b.hp = Math.max(0, b.hp - d); this.fxq.push({ k: "bhit", d });
    if (b.hp <= 0) { const bon = 1000 * b.tier; this.score += bon; this.kills.boss++; this.fxq.push({ k: "bossdown", pts: bon, kind: b.kind }); }
  }
  explode(x, y, rad, d, depth, why) {
    if (depth > 3) return; // 연쇄 3단계까지
    this._boomN = (this._boomN || 0) + 1; if (this._boomN > 24) return; // 한 틱에 폭발 24번까지
    if (this.synCount("blast") >= 2) rad *= 1.15; if (this.synCount("blast") >= 3) d += 1;
    this.fxq.push({ k: "boom", x, y, r: rad, why });
    const hit = this.bricks.filter(q => { const [qx, qy] = this.brickRect(q); const cx = qx + BW / 2, cy = qy + BH / 2; return (cx - x) * (cx - x) + (cy - y) * (cy - y) <= rad * rad; }).slice(0, 14);
    for (const q of hit) this.hitBrick(q, d, "boom", depth);
    if (this.boss) { const [bx0, by0, bw, bh] = this.bossRect(); if (x > bx0 - rad && x < bx0 + bw + rad && y > by0 - rad && y < by0 + bh + rad) this.hitBoss(d * 2, "boom"); }
    if (this.has("e_split") && this.buf.splitCd <= 0 && this.balls.length < MAX_BALLS) { this.buf.splitCd = 2 * TPS; const k = this.balls.length; this.addBall(x, Math.min(y + 10, PADDLE_Y - 40), (k % 2 ? 0.5 : -0.5), 0.8); this.fxq.push({ k: "split", x, y }); }
  }
  dropItem(x, y) {
    if (this.items.length >= MAX_ITEMS) return;
    const q = rnd(this.gr); const k = q < 0.35 ? "W" : q < 0.7 ? "M" : q < 0.92 ? "S" : "L";
    this.items.push({ id: this.nid++, x, y, k });
  }

  // ---------- 증강 고르기 ----------
  pool() { const own = new Set(this.augs.map(a => a.id)); return AUGS.filter(a => !own.has(a.id)); }
  roll(k) {
    const list = this.pool().slice(), out = [];
    for (let j = 0; j < 3 && list.length; j++) {
      let tot = 0; for (const a of list) tot += rarityW(a.rarity, k);
      let r = rnd(this.ar) * tot, pick = list.length - 1;
      for (let i = 0; i < list.length; i++) { r -= rarityW(list[i].rarity, k); if (r <= 0) { pick = i; break; } }
      out.push(list[pick].id); list.splice(pick, 1);
    }
    return out;
  }
  offerIfDue() {
    // 죽은 사람·이미 고르는 중·다 고른 사람은 카드가 뜨지 않음
    if (this.mode !== "augment" || !this.alive || this.offer || this.picks >= MAX_AUGS || this.augs.length >= MAX_AUGS) return false;
    this.offer = this.roll(this.picks); this.phase = "pick"; this.fxq.push({ k: "offer" });
    return true;
  }
  pick(id) {
    if (!this.offer || this.phase !== "pick") return { ok: false, error: "NOT_PICK_PHASE" };
    if (!this.alive) { this.offer = null; return { ok: false, error: "DEAD" }; }
    if (!this.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    this.grant(id); this.picks++; this.offer = null; this.phase = "play";
    return { ok: true };
  }
  reroll() { if (!this.offer) return { ok: false, error: "NOT_PICK_PHASE" }; if (this.refresh <= 0) return { ok: false, error: "NO_REFRESH" }; this.refresh--; this.offer = this.roll(this.picks); return { ok: true }; }
  grant(id) {
    const d = AUG[id]; if (!d || this.has(id) || this.augs.length >= MAX_AUGS) return false;
    this.augs.push({ id, ch: d.ch, cdT: 0 }); this.fxq.push({ k: "got", id });
    return true;
  }

  // ---------- 증강 사용 ----------
  use(id, x = -1, y = -1) {
    if (!this.alive) return { ok: false, error: "DEAD" };
    if (this.phase !== "play") return { ok: false, error: "CANT_NOW" };
    const st = this.aug(id), d = AUG[id];
    if (!st || !d) return { ok: false, error: "NO_AUG" };
    if (d.kind !== "active") return { ok: false, error: "NOT_ACTIVE" };
    if (st.ch <= 0) return { ok: false, error: "NO_CHARGES" };
    if (this.t < st.cdT) return { ok: false, error: "COOLDOWN" };
    if (d.noBoss && this.boss) return { ok: false, error: "BOSS_STAGE" };
    x = Number(x); y = Number(y);
    if (d.target === "point" && !(x >= 0 && x <= W && y >= 0 && y <= H)) return { ok: false, error: "BAD_POINT" };
    const E = (e) => ({ ok: false, error: e });
    const live = this.balls.filter(b => !b.stuck);
    switch (id) {
      case "r_multi": { if (this.balls.length >= MAX_BALLS) return E("MAX_BALLS"); const s = live[0] || this.balls[0]; if (!s) return E("NO_BALL"); this.addBall(s.x, s.y, s.dx + 0.4, s.dy); this.addBall(s.x, s.y, s.dx - 0.4, s.dy); break; }
      case "r_laser": this.fireLaser(true); break;
      case "r_pierce": this.buf.pierce = d.dur; break;
      case "r_heal": if (this.lives >= MAX_LIVES) return E("FULL_LIVES"); this.lives++; break;
      case "e_storm": { if (this.balls.length >= MAX_BALLS) return E("MAX_BALLS"); for (let i = 0; i < 8; i++) this.addBall(this.px, PADDLE_Y - 40, -0.8 + i * 0.23, -1); break; }
      case "e_barrage": this.buf.barrage = d.dur; break;
      case "e_blast": this.explode(x, y, 90, 3, 1, "blast"); if (this.boss) this.hitBoss(30, "boom"); break;
      case "e_timestop": this._frozenOff = {}; for (const m of this.moving) this._frozenOff[m.r] = m.amp * tri(this.t, m.per); this.buf.timestop = d.dur; break;
      case "e_gravity": this.buf.gravity = d.dur; break;
      case "e_guard": this.buf.guard = d.dur; break;
      case "e_goldrush": this.buf.goldrush = d.dur; break;
      case "e_rebuild": {
        if (!this.bricks.length) return E("NO_EFFECT");
        const list = this.bricks.slice().sort((a, b) => a.r - b.r || a.c - b.c); const n = list.length, perRow = 10, rows = Math.ceil(n / perRow);
        list.forEach((b, i) => { const r = Math.floor(i / perRow), inRow = Math.min(perRow, n - r * perRow); b.r = 2 + r; b.c = Math.floor((COLS - inRow) / 2) + (i % perRow); if (b.t === "m") { b.t = "h"; b.hp = Math.min(b.hp, 2); b.mx = 2; b.col = "blue"; } });
        this.moving = []; this.rows = 2 + rows; break;
      }
      case "l_infinite": this.buf.infinite = d.dur; break;
      case "l_pierce": this.buf.lpierce = d.dur; break;
      case "l_destroy": for (const b of this.bricks.slice()) this.hitBrick(b, 2, "boom", 1); if (this.boss) this.hitBoss(Math.ceil(this.boss.mx * 0.15), "boom"); this.fxq.push({ k: "destroy" }); break;
      case "l_rewind": {
        const target = this.t - 3 * TPS; let s = null;
        for (const q of this.snaps) if (q.t <= target) s = q;
        if (!s) s = this.snaps[0]; if (!s || s.t >= this.t) return E("CANT_REWIND");
        const keepAugs = this.augs, keepPicks = this.picks, keepSnaps = this.snaps.filter(q => q.t < s.t), keepT = this.t, keepAr = this.ar.s;
        const keepRefresh = this.refresh;
        this.load({ ...s, augs: [], picks: keepPicks, offer: null, refresh: keepRefresh, snaps: [] });
        this.augs = keepAugs; this.snaps = keepSnaps; // 증강(남은 횟수 포함)은 그대로 — 같은 객체 유지 (역행으로 횟수가 돌아오지 않게)
        this.t = keepT; this.ar = { s: keepAr }; // 시간은 앞으로만 (조작 기록 번호 유지)
        this.fxq.push({ k: "rewind" });
        break;
      }
      case "l_arena": this.buf.arena = d.dur; break;
      case "l_legion": { if (this.balls.length >= MAX_BALLS) return E("MAX_BALLS"); let i = 0; while (this.balls.length < MAX_BALLS && i < 40) { this.addBall(this.px, PADDLE_Y - 40, -0.9 + (i % 10) * 0.2, -1); i++; } break; }
      case "l_blackhole": this.buf.hole = d.dur; this.buf.holeX = x; this.buf.holeY = Math.min(y, PADDLE_Y - 60); break;
      default: return E("NO_AUG");
    }
    st.ch--;
    let cd = d.cd; if (id === "r_laser" && this.has("l_lasermaster")) cd = Math.floor(cd / 2);
    st.cdT = this.t + cd;
    this.fxq.push({ k: "use", id, x, y });
    return { ok: true };
  }
  fireLaser(manual) {
    const w = this.paddleW(), piercing = this.has("l_lasermaster") ? 3 : 1;
    for (const ox of [-w / 2 + 6, w / 2 - 6]) if (this.lasers.length < MAX_LASERS) this.lasers.push({ id: this.nid++, x: this.px + ox, y: PADDLE_Y - 4, p: piercing });
    this.fxq.push({ k: "laser", manual });
  }

  // ---------- 한 틱 ----------
  /** inp: { x: 패들 목표(0~W), ev: [['L'] | ['U', id, x, y] | ['P', id] | ['R']] } → 반환 이번 틱 결과 */
  step(inp = {}) {
    this._boomN = 0;
    const res = [];
    for (const e of inp.ev || []) {
      if (!Array.isArray(e)) continue;
      if (e[0] === "L") this.launch();
      else if (e[0] === "U") res.push(this.use(String(e[1] || ""), e[2], e[3]));
      else if (e[0] === "P") res.push(this.pick(String(e[1] || "")));
      else if (e[0] === "R") res.push(this.reroll());
    }
    if (Number.isFinite(inp.x)) this.pTarget = Math.max(0, Math.min(W, Math.round(inp.x)));
    this.t++;
    if (!this.alive) return res;
    if (this.phase === "pick") return res;
    if (this.phase === "clear") { if (--this.phaseT <= 0) this.afterClear(); return res; }
    this.stageT = (this.stageT || 0) + 1;
    this.playT = (this.playT || 0) + 1; // 실제로 공이 움직인 틱 (타임어택 시간 = 이것으로 계산, 서버가 확인)
    // 패들
    const w = this.paddleW(), dx = Math.max(-PADDLE_SPEED, Math.min(PADDLE_SPEED, this.pTarget - this.px));
    this.px = Math.max(w / 2, Math.min(W - w / 2, this.px + dx));
    // 시간 역행 기록
    if (this.has("l_rewind") && this.t % SNAP_EVERY === 0) { this.snaps.push(this.save(true)); if (this.snaps.length > SNAP_KEEP) this.snaps.shift(); }
    // 버프 시계
    const B = this.buf;
    for (const k of ["pierce", "lpierce", "timestop", "gravity", "guard", "goldrush", "arena", "infinite", "barrage", "wide", "slow", "shrink", "hole", "splitCd"]) if (B[k] > 0) B[k]--;
    if (B.infinite > 0 && B.infinite % 30 === 0) this.addBall(this.px, PADDLE_Y - 30, (B.infinite % 60 ? 0.5 : -0.5), -1);
    if (B.barrage > 0 && B.barrage % 24 === 0) { for (const lx of [W * 0.2, W * 0.4, W * 0.6, W * 0.8]) if (this.lasers.length < MAX_LASERS) this.lasers.push({ id: this.nid++, x: lx + tri(this.t, 37) * 30, y: PADDLE_Y - 20, p: 1 }); }
    if (this.has("l_lasermaster") && this.t % 30 === 0) this.fireLaser(false);
    // 벽돌 상태 (얼음·불)
    for (const b of this.bricks.slice()) {
      if (b.frz > 0) b.frz--;
      if (b.burn > 0 && --b.bt <= 0) { b.burn--; b.bt = TPS; this.hitBrick(b, 1, "burn"); }
    }
    if (B.hole > 0 && B.hole % 30 === 0) for (const q of this.bricks.slice()) { const [qx, qy] = this.brickRect(q); const cx = qx + BW / 2 - B.holeX, cy = qy + BH / 2 - B.holeY; if (cx * cx + cy * cy <= 80 * 80) this.hitBrick(q, 1, "hole"); }
    // 보스
    if (this.boss && this.boss.hp > 0) this.bossStep();
    // 공
    const sp = this.speed();
    for (const b of this.balls.slice()) this.ballStep(b, sp);
    // 떨어진 공
    const before = this.balls.length;
    this.balls = this.balls.filter(b => b.y - BALL_R <= H);
    if (before && !this.balls.length) this.loseLife();
    // 레이저
    for (const l of this.lasers) { l.y -= 12; for (const q of this.bricks.slice()) { if (l.p <= 0) break; const [qx, qy] = this.brickRect(q); if (l.x >= qx && l.x <= qx + BW && l.y <= qy + BH && l.y + 12 >= qy) { this.hitBrick(q, this.has("l_god") ? 2 : 1, "laser"); l.p--; } } if (l.p > 0 && this.boss && this.boss.hp > 0) { const [rx, ry, rw, rh] = this.bossRect(); if (l.x >= rx && l.x <= rx + rw && l.y <= ry + rh && l.y >= ry) { this.hitBoss(1, "laser"); l.p = 0; } } }
    this.lasers = this.lasers.filter(l => l.y > 0 && l.p > 0);
    // 떨어지는 아이템·코인
    for (const it of this.items) it.y += 2.2;
    for (const it of this.items.slice()) {
      if (it.y >= PADDLE_Y - 6 && it.y <= PADDLE_Y + PADDLE_H && Math.abs(it.x - this.px) <= w / 2 + 6) { this.catchItem(it); it.y = H + 100; }
    }
    this.items = this.items.filter(it => it.y < H + 20);
    // 적 탄
    if (B.timestop <= 0) for (const s of this.shots) s.y += s.v;
    for (const s of this.shots) if (s.y >= PADDLE_Y && s.y <= PADDLE_Y + PADDLE_H + 4 && Math.abs(s.x - this.px) <= w / 2) { s.y = H + 100; if (!this.has("c_sturdy")) { B.shrink = 3 * TPS; this.fxq.push({ k: "zap" }); } else this.fxq.push({ k: "block" }); }
    this.shots = this.shots.filter(s => s.y < H + 10);
    // 끝 확인
    if (this.phase === "play" && this.alive) {
      const cleared = this.boss ? this.boss.hp <= 0 : this.bricks.length === 0;
      if (cleared) this.stageClear();
    }
    return res;
  }
  launch() { for (const b of this.balls) if (b.held > 0 || b.stuck) { b.held = 0; b.stuck = 0; b.dy = -(Math.abs(b.dy) || 1); this.normBall(b); } }
  catchItem(it) {
    if (it.k === "coin") { const p = 25 * this.stage; this.score += p; this.fxq.push({ k: "coin", pts: p, x: it.x }); return; }
    if (it.k === "W") this.buf.wide = 10 * TPS;
    if (it.k === "S") this.buf.slow = 8 * TPS;
    if (it.k === "M") { const s = this.balls.find(b => !b.held) || this.balls[0]; if (s) { this.addBall(s.x, s.y, s.dx + 0.35, s.dy); this.addBall(s.x, s.y, s.dx - 0.35, s.dy); } }
    if (it.k === "L") { if (this.lives < MAX_LIVES) this.lives++; }
    this.fxq.push({ k: "item", it: it.k });
  }
  ballStep(b, sp) {
    const w = this.paddleW();
    if (b.held > 0) { b.x = this.px; b.y = PADDLE_Y - BALL_R - 1; if (--b.held <= 0) this.launch(); return; }
    if (b.stuck) { b.x = Math.max(BALL_R, Math.min(W - BALL_R, this.px + b.so)); b.y = PADDLE_Y - BALL_R - 1; if (--b.stuck <= 0) { b.stuck = 0; b.dy = -Math.abs(b.dy); } return; }
    if (b.pt > 0) b.pt--;
    // 휘어짐 (중력 조작·블랙홀): 방향만 바꾸고 속도는 그대로
    let gx = null, gy = null, ga = 0;
    if (this.buf.hole > 0) { gx = this.buf.holeX; gy = this.buf.holeY; ga = 0.06; }
    else if (this.buf.gravity > 0) {
      if (this.boss && this.boss.hp > 0) { gx = this.boss.x; gy = this.boss.y + this.boss.h / 2; }
      else { let best = null; for (const q of this.bricks) if (!best || q.hp > best.hp || (q.hp === best.hp && q.id < best.id)) best = q; if (best) { const [qx, qy] = this.brickRect(best); gx = qx + BW / 2; gy = qy + BH / 2; } }
      ga = 0.05;
    } else if (!this.boss && this.bricks.length && this.bricks.length <= 4 && b.nb > 6 * TPS && b.dy < 0) {
      // 마지막 벽돌 도우미: 벽돌이 4개 이하이고 6초 넘게 못 맞히면 가장 가까운 벽돌 쪽으로 아주 약하게 휘어짐
      let best = null, bd = 1e12; for (const q of this.bricks) { const [qx, qy] = this.brickRect(q); const d2 = (qx + BW / 2 - b.x) * (qx + BW / 2 - b.x) + (qy + BH / 2 - b.y) * (qy + BH / 2 - b.y); if (d2 < bd) { bd = d2; best = [qx + BW / 2, qy + BH / 2]; } }
      gx = best[0]; gy = best[1]; ga = 0.03;
    }
    if (gx !== null) { let vx = gx - b.x, vy = gy - b.y; const l = Math.sqrt(vx * vx + vy * vy); if (l > 4) { b.dx += vx / l * ga; b.dy += vy / l * ga; const n = Math.sqrt(b.dx * b.dx + b.dy * b.dy) || 1; b.dx /= n; b.dy /= n; } }
    const steps = Math.max(1, Math.ceil(sp / SUB)), st = sp / steps;
    const pierce = this.piercing() || b.pt > 0;
    for (let i = 0; i < steps; i++) {
      b.x += b.dx * st; b.y += b.dy * st;
      // 벽
      if (b.x < BALL_R) { b.x = BALL_R; b.dx = Math.abs(b.dx); this.normBall(b); }
      if (b.x > W - BALL_R) { b.x = W - BALL_R; b.dx = -Math.abs(b.dx); this.normBall(b); }
      if (b.y < BALL_R) { b.y = BALL_R; b.dy = Math.abs(b.dy); }
      // 바닥 방어막 (무적 패들·시간 정지·기적)
      if ((this.buf.guard > 0 || this.buf.timestop > 0) && b.y > PADDLE_Y + PADDLE_H + 8 && b.dy > 0) { b.dy = -Math.abs(b.dy); this.fxq.push({ k: "guard", x: b.x }); }
      // 패들
      const edge = this.has("c_sturdy") ? 6 : 0;
      if (b.dy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H && b.x >= this.px - w / 2 - edge - BALL_R && b.x <= this.px + w / 2 + edge + BALL_R) {
        let off = (b.x - this.px) / (w / 2 + edge); off = Math.max(-1, Math.min(1, off));
        let ddx = off * 1.4, ddy = -1;   // 가장자리 ≈ 35°
        if (this.has("c_aim")) { const sg = off < 0 ? -1 : off > 0 ? 1 : (b.dx < 0 ? -1 : 1); ddx = sg * (0.47 + Math.abs(off) * 0.73); } // 수평에서 40°~65° 사이로만
        b.dx = ddx; b.dy = ddy; this.normBall(b); b.y = PADDLE_Y - BALL_R - 0.5; b.np = 0;
        if (this.synCount("paddle") < 3) this.combo = 0;
        this.streak = 0;
        if (this.has("r_magnet")) { b.stuck = Math.round(1.2 * TPS); b.so = Math.max(-w / 2, Math.min(w / 2, b.x - this.px)); }
        this.fxq.push({ k: "paddle", x: b.x });
        break;
      }
      // 보스
      if (this.boss && this.boss.hp > 0) {
        const r = this.bossRect();
        if (this.circleRect(b, r)) { this.hitBoss(this.dmg(), "ball"); b.nb = 0; if (this.boss && this.boss.hp <= 0) break; }
      }
      // 벽돌 (가까운 칸만)
      const hitList = this.bricksNear(b);
      if (pierce) {
        b.hit = b.hit || {};
        for (const q of hitList) { const last = b.hit[q.id] || -999; if (this.t - last < 15) continue; if (!this.overlap(b, this.brickRect(q))) continue; b.hit[q.id] = this.t; this.ballHits(b, q); }
        if (this.t % 120 === 0) b.hit = {};
      } else {
        let best = null, bd = 1e9;
        for (const q of hitList) { const r = this.brickRect(q); const [cx, cy] = this.closest(b, r); const d2 = (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy); if (d2 < BALL_R * BALL_R && d2 < bd) { bd = d2; best = [q, r]; } }
        if (best) { this.circleRect(b, best[1]); this.ballHits(b, best[0]); }
      }
      // 벽돌·보스에 밀려 벽 밖으로 나가지 않게
      if (b.x < BALL_R) { b.x = BALL_R; b.dx = Math.abs(b.dx); } else if (b.x > W - BALL_R) { b.x = W - BALL_R; b.dx = -Math.abs(b.dx); }
      if (b.y < BALL_R) { b.y = BALL_R; b.dy = Math.abs(b.dy); }
    }
    // 끼임 방지: 오래 패들도 벽돌도 안 닿으면 아래쪽으로 살짝 꺾음
    b.np++; b.nb++;
    if (b.np > 15 * TPS && b.nb > 8 * TPS) { b.dy = Math.abs(b.dy) + 0.4; this.normBall(b); b.np = 10 * TPS; this.fxq.push({ k: "nudge" }); }
  }
  ballHits(b, q) {
    b.nb = 0;
    let d = this.dmg(); if (this.buf.firstHit > 0) { d += 1; this.buf.firstHit = 0; }
    const ox = this.brickRect(q); const cx = ox[0] + BW / 2, cy = ox[1] + BH / 2;
    this.hitBrick(q, d, "ball");
    if (this.has("r_shock")) { const near = this.bricks.filter(z => z !== q).map(z => { const [zx, zy] = this.brickRect(z); const dx = zx + BW / 2 - cx, dy = zy + BH / 2 - cy; return [z, dx * dx + dy * dy]; }).filter(z => z[1] <= 3600).sort((a, b2) => a[1] - b2[1] || a[0].id - b2[0].id).slice(0, 2); for (const [z] of near) { this.hitBrick(z, 1, "shock"); this.fxq.push({ k: "shock", from: q.id, to: z.id, x: cx, y: cy }); } }
    if (this.has("r_bomb")) { this.bombCount++; if (this.bombCount >= 4) { this.bombCount = 0; this.explode(cx, cy, 40, 1, 1, "bomb"); } }
  }
  bricksNear(b) {
    const out = [], maxR = this.rows + 6;
    const r0 = Math.floor((b.y - BALL_R - OFFY) / (BH + GAP)) - 1, r1 = Math.floor((b.y + BALL_R - OFFY) / (BH + GAP)) + 1;
    if (r1 < 0 || r0 > maxR) return out;
    for (const q of this.bricks) if (q.r >= r0 && q.r <= r1) { const r = this.brickRect(q); if (b.x + BALL_R >= r[0] && b.x - BALL_R <= r[0] + r[2]) out.push(q); }
    return out;
  }
  closest(b, [x, y, w, h]) { return [Math.max(x, Math.min(x + w, b.x)), Math.max(y, Math.min(y + h, b.y))]; }
  overlap(b, r) { const [cx, cy] = this.closest(b, r); const dx = b.x - cx, dy = b.y - cy; return dx * dx + dy * dy < BALL_R * BALL_R; }
  /** 원-사각형 충돌: 겹치면 밀어내고 반사, true */
  circleRect(b, r) {
    const [x, y, w, h] = r; const [cx, cy] = this.closest(b, r);
    let nx = b.x - cx, ny = b.y - cy; let d2 = nx * nx + ny * ny;
    if (d2 >= BALL_R * BALL_R) return false;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { // 중심이 안에 들어감 → 가장 얕은 쪽으로
      const l = b.x - x, rr = x + w - b.x, t = b.y - y, bt = y + h - b.y, m = Math.min(l, rr, t, bt);
      nx = m === l ? -1 : m === rr ? 1 : 0; ny = m === t ? -1 : m === bt ? 1 : 0; if (nx && ny) ny = 0; d = 0;
      b.x = nx < 0 ? x - BALL_R : nx > 0 ? x + w + BALL_R : b.x; b.y = ny < 0 ? y - BALL_R : ny > 0 ? y + h + BALL_R : b.y;
    } else { nx /= d; ny /= d; b.x = cx + nx * (BALL_R + 0.01); b.y = cy + ny * (BALL_R + 0.01); }
    const vn = b.dx * nx + b.dy * ny;
    if (vn < 0) { b.dx -= 2 * vn * nx; b.dy -= 2 * vn * ny; }
    this.normBall(b);
    return true;
  }
  bossStep() {
    const b = this.boss, B = this.buf, frozen = B.timestop > 0;
    if (!frozen) this.bossT--;
    if (this.bossT <= 0) { // 시간 끝: 생명 1 잃고 보스 20% 회복, 시간 다시
      this.bossT = BOSS_TIME; b.hp = Math.min(b.mx, b.hp + Math.ceil(b.mx * 0.2)); this.fxq.push({ k: "bosstime" }); this.loseLife(true); if (!this.alive) return;
    }
    if (b.frz > 0) b.frz--;
    if (b.burn > 0 && --b.bt <= 0) { b.burn--; b.bt = TPS; this.hitBoss(1, "burn"); if (b.hp <= 0) return; }
    if (frozen || b.frz > 0) return;
    const rage = b.hp < b.mx * 0.4 ? 1.6 : 1;
    b.mv = (b.mv || 0) + rage; b.x = W / 2 + tri(b.mv, 360) * (W / 2 - b.w / 2 - 8); // 화나면 빨라지지만 위치는 이어짐
    if (b.beam > 0) { b.beam--; if (b.beam < 30 && Math.abs(this.px - b.beamX) <= this.paddleW() / 2 + 10 && b.beam % 10 === 0) { if (!this.has("c_sturdy")) { B.shrink = 2 * TPS; this.fxq.push({ k: "zap" }); } else this.fxq.push({ k: "block" }); } }
    if (--b.atk > 0) return;
    b.atk = Math.round((b.kind === "eye" ? 150 : 110) / rage);
    if (b.kind === "eye") { b.beam = 75; b.beamX = this.px; this.fxq.push({ k: "beam", x: b.beamX }); }
    else if (b.kind === "hive" && this.bricks.length < 30) { // 아래에 벽돌 한 줄을 다시 깔기
      const r = 8 + Math.floor(rnd(this.gr) * 2); let added = 0;
      for (let c = 1; c < COLS - 1; c += 2) if (!this.bricks.some(q => q.r === r && q.c === c)) { this.bricks.push({ id: this.nid++, r, c, t: "n", hp: 1, mx: 1, col: "pink", frz: 0, burn: 0, bt: 0 }); added++; }
      if (added) { this.rows = Math.max(this.rows, r + 1); this.fxq.push({ k: "spawnrow", r }); }
    }
    const n = b.kind === "golem" ? 3 : 1;
    for (let i = 0; i < n; i++) this.shots.push({ id: this.nid++, x: b.x + (i - (n - 1) / 2) * 40, y: b.y + b.h, v: 3 + b.tier * 0.4 });
  }
  loseLife(byTime = false) {
    this.combo = 0; this.streak = 0; this.lostThisStage = true;
    this.lives--;
    this.fxq.push({ k: "lost", byTime });
    if (this.lives <= 0) {
      const m = this.aug("l_miracle");
      if (m && m.ch > 0) { m.ch--; this.lives = 2; this.buf.guard = Math.max(this.buf.guard, 5 * TPS); this.fxq.push({ k: "miracle" }); }
      else { this.alive = false; this.offer = null; this.phase = "over"; this.balls = []; this.fxq.push({ k: "over" }); return; }
    }
    if (!this.balls.length) this.serve();
  }
  stageClear() {
    const bon = 100 * this.stage + this.lives * 20;
    this.score += bon; this.phase = "clear"; this.phaseT = 90;
    if (this.has("c_extra") && !this.lostThisStage) { const a = this.aug("c_extra"); if (a.ch > 0 && this.lives < MAX_LIVES) { a.ch--; this.lives++; this.fxq.push({ k: "extra" }); } }
    this.balls = []; this.lasers = []; this.shots = []; this.items = [];
    this.fxq.push({ k: "clear", n: this.stage, pts: bon, boss: !!this.boss });
  }
  afterClear() {
    this.phase = "play";
    this.nextStage();
    if (this.mode === "augment") this.offerIfDue();
  }
  /** 스트리머 후원 효과 (서버가 금액·대상 확인 뒤 호출) */
  stream(kind) {
    if (!this.alive || this.phase === "over") return { ok: false };
    let ok = false;
    if (kind === "multi") { const s = this.balls.find(b => !b.held && !b.stuck) || this.balls[0]; if (s && this.balls.length < MAX_BALLS) { for (let i = 0; i < 3; i++) this.addBall(s.x, s.y, -0.6 + i * 0.6, -1); ok = true; } }
    if (kind === "life" && this.lives < MAX_LIVES) { this.lives++; ok = true; }
    if (kind === "goldrush") { this.buf.goldrush = Math.max(this.buf.goldrush, 10 * TPS); ok = true; }
    if (kind === "laser") { this.buf.barrage = Math.max(this.buf.barrage, 3 * TPS); ok = true; }
    if (kind === "shrink") { this.buf.shrink = Math.max(this.buf.shrink, 5 * TPS); ok = true; }
    if (ok) this.fxq.push({ k: "stream", kind });
    return { ok };
  }
  /** 다른 사람에게 보여 줄 요약 (관전·미리보기) */
  view() {
    const r = (x) => Math.round(x);
    return {
      t: this.t, s: this.score, l: this.lives, st: this.stage, a: this.alive ? 1 : 0, ph: this.phase, px: r(this.px), pw: this.paddleW(),
      b: this.balls.slice(0, 30).map(b => [r(b.x), r(b.y)]),
      k: this.bricks.map(q => [q.id, q.r, q.c, q.hp, q.mx, q.t, BRICK_COLORS.indexOf(q.col), (q.frz > 0 ? 1 : 0) + (q.burn > 0 ? 2 : 0)]),
      mv: this.moving.map(m => [m.r, m.amp, m.per]), ts: this.buf.timestop > 0 ? 1 : 0,
      boss: this.boss ? [r(this.boss.x), this.boss.y, this.boss.w, this.boss.h, this.boss.hp, this.boss.mx, this.boss.kind, this.boss.beam > 0 ? r(this.boss.beamX) : -1] : null,
      la: this.lasers.slice(0, 20).map(l => [r(l.x), r(l.y)]), sh: this.shots.slice(0, 12).map(s => [r(s.x), r(s.y)]), it: this.items.slice(0, 16).map(i => [r(i.x), r(i.y), i.k]),
      augs: this.augs.map(a => a.id), buf: Object.entries(this.buf).filter(([k, v]) => v > 0 && ["pierce", "lpierce", "timestop", "gravity", "guard", "goldrush", "arena", "infinite", "barrage", "hole"].includes(k)).map(([k]) => k), hole: this.buf.hole > 0 ? [r(this.buf.holeX), r(this.buf.holeY)] : null,
    };
  }
  summary() { return { score: this.score, lives: this.lives, stage: this.stage, alive: this.alive, augs: this.augs.map(a => a.id), boss: this.kills.boss, combo: this.maxCombo }; }
}
export function seedFor(roomSeed, idx, fair) { return fair ? (roomSeed >>> 0) || 1 : hashStr(roomSeed + ":" + idx) || 1; }
