// =========================
// DUO 증강 2048 — 규칙 엔진 (2026-11-18)
// ※ 서버(worldcup-backend/src/ttfe-core.js)와 화면(js/2048/ttfe-core.js)이 '같은 파일'이어야 함. 고치면 둘 다 복사.
// · 화면은 이 엔진으로 내 판을 바로 움직이고(즉시 반응), 조작 기록(이동·증강 고르기·증강 사용)을 서버로 보냄
// · 서버는 같은 엔진으로 같은 조작을 다시 돌려 판·점수를 직접 계산 → 해시가 다르면 서버 판으로 다시 맞춤
// · 난수: 타일 생성(spawn)과 증강 효과(aug)가 서로 다른 흐름 → 증강을 써도 생성 순서는 그대로 (공정 경쟁)
// · 외부 의존 없음 (브라우저·Node 공용)
// =========================

export const VERSION = 1;
export const MAX_AUGS = 5;
export const PICK_AT = [0, 20, 60, 130, 230];   // 누적 합성 수 기준 증강 고르기 (시작 + 4번)
export const HIST_MAX = 5;                       // 되감기용 기록
export const MULT_CAP = 5;                       // 한 번 합성의 최대 점수 배율
export const GOLD_CAP = 4;                       // 황금 타일 최대 (황금 보드는 6)
export const STREAM_TIME_CAP = 60;               // 후원으로 늘릴 수 있는 시간 합계(초)
export const DIRS = ["up", "right", "down", "left"];

// ---------- 난수 (mulberry32, 상태를 숫자 하나로 저장 → 저장·복원 가능) ----------
export function rnd(st) {
  let t = (st.s = (st.s + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

// ---------- 증강 40종 ----------
// kind: passive(지속) · active(사용형: 횟수 ch, 재사용 대기 cd=이동 수) · trigger(발동형: 조건이 되면 자동)
// target: none · tile(타일 1개) · empty(빈칸) · tile_empty(타일→빈칸) · tile_tile(타일 2개) · tile_adj(타일→옆 타일) · cell(아무 칸) · row(줄의 아무 칸)
// group: 시너지 묶음 score(점수) · craft(타일 조작) · guard(생존) · burst(폭주)
export const RARITY = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" };
export const KIND_LABEL = { passive: "지속형", active: "사용형", trigger: "발동형" };
export const SYNERGY = {
  score: { name: "점수 설계", icon: "💰", t2: "합성 점수 +5%", t3: "합성 점수 +12%" },
  craft: { name: "타일 장인", icon: "🛠️", t2: "사용형 재사용 대기 절반", t3: "가진 타일 조작 증강 횟수 +1 (한 번)" },
  guard: { name: "생존 본능", icon: "🛡️", t2: "4 타일이 덜 나옴 (10%→5%)", t3: "구조가 발동하면 타일 2개 더 정리" },
  burst: { name: "폭주 회로", icon: "🔥", t2: "버프 지속 +5번", t3: "연쇄 합성 한도 +1" },
};
const A = (id, name, rarity, kind, group, icon, desc, o = {}) => ({ id, name, rarity, kind, group, icon, desc, ch: o.ch ?? null, cd: o.cd || 0, target: o.target || "none", dur: o.dur || "", timedOnly: !!o.timedOnly, anim: o.anim || "spark" });
export const AUGS = [
  // ---- 일반 10
  A("c_merge", "합성 전문가", "common", "passive", "score", "plus", "모든 합성 점수 +10%", { dur: "계속" }),
  A("c_hint", "숫자 감별사", "common", "passive", "guard", "eye", "합칠 수 있는 타일을 빛나게 표시하고, 가장 좋은 방향을 화살표로 알려 줌", { dur: "계속" }),
  A("c_chain", "연속 합성", "common", "passive", "burst", "combo", "합성이 있는 이동을 연속으로 하면 한 번마다 점수 +2% (최대 +30%), 합성 없는 이동이면 초기화", { dur: "계속" }),
  A("c_luck", "작은 행운", "common", "passive", "score", "clover", "합성할 때마다 10% 확률로 그 숫자의 절반만큼 보너스 점수", { dur: "계속" }),
  A("c_empty", "빈칸 탐지", "common", "passive", "score", "eye", "빈칸 수를 표시. 이동 뒤 빈칸이 6칸 이상이면 빈칸 수 × 2점", { dur: "계속" }),
  A("c_sort", "정리의 달인", "common", "active", "craft", "broom", "고른 줄의 타일을 큰 숫자부터 왼쪽으로 정렬 (합성 없음)", { ch: 2, target: "row", anim: "sort" }),
  A("c_safe", "안전한 이동", "common", "trigger", "guard", "shield", "더 움직일 수 없게 되면 한 번, 가장 작은 타일 2개를 치워 줌", { ch: 1, dur: "1회", anim: "rescue" }),
  A("c_collect", "숫자 수집가", "common", "passive", "score", "star", "64·256·1024를 만들 때마다 그 숫자만큼 보너스 점수", { dur: "계속" }),
  A("c_grow", "성장 가속", "common", "passive", "score", "amp", "16 이하를 만드는 합성 점수 +50%", { dur: "계속" }),
  A("c_perfect", "완벽한 한 수", "common", "trigger", "score", "sparkle", "한 번 이동의 합성 숫자 합이 256 이상이면 그 이동 점수 +25%", { dur: "계속" }),
  // ---- 희귀 10
  A("r_dup", "타일 복제", "rare", "active", "craft", "double", "256 이하 타일 하나를 골라 빈칸에 똑같이 복제", { ch: 2, cd: 5, target: "tile_empty", anim: "dup" }),
  A("r_del", "타일 제거", "rare", "active", "craft", "eraser", "타일 하나를 지움", { ch: 3, cd: 6, target: "tile", anim: "pop" }),
  A("r_half", "숫자 감소", "rare", "active", "craft", "small", "타일 하나의 숫자를 절반으로 (4 이상)", { ch: 2, target: "tile", anim: "shrink" }),
  A("r_double", "숫자 증가", "rare", "active", "craft", "double", "128 이하 타일 하나의 숫자를 두 배로 (점수는 없음)", { ch: 1, target: "tile", anim: "grow" }),
  A("r_swap", "위치 교환", "rare", "active", "craft", "swap", "두 칸의 타일 위치를 바꿈", { ch: 3, cd: 4, target: "tile_tile", anim: "swap" }),
  A("r_bomb", "폭탄 타일", "rare", "active", "craft", "bomb", "고른 칸과 위·아래·왼쪽·오른쪽 칸의 타일을 터뜨림", { ch: 1, target: "cell", anim: "boom" }),
  A("r_gold", "황금 타일", "rare", "active", "score", "gold", "타일 하나를 황금으로 — 황금 타일이 낀 합성은 점수 ×2, 합쳐도 황금 유지 (판에 최대 4개)", { ch: 2, target: "tile", anim: "gold" }),
  A("r_undo", "되감기", "rare", "active", "guard", "rewind", "직전 이동 하나를 되돌림 (점수도 그때로)", { ch: 2, anim: "rewind" }),
  A("r_luckyspawn", "행운의 생성", "rare", "passive", "guard", "clover", "새 타일의 40%는 같은 숫자 옆 빈칸에 나옴", { dur: "계속" }),
  A("r_transform", "타일 변환", "rare", "active", "craft", "wand", "타일 하나를 바로 옆 타일과 같은 숫자로 바꿈 (최대 두 단계 위까지)", { ch: 2, target: "tile_adj", anim: "morph" }),
  // ---- 영웅 10
  A("e_chain", "연쇄 합성", "epic", "passive", "burst", "combo", "이동 뒤 새로 합쳐진 타일 옆에 같은 숫자가 있으면 한 번 더 합성 (한 이동에 최대 2번)", { dur: "계속", anim: "chain" }),
  A("e_blast", "대폭발", "epic", "active", "craft", "burst", "고른 칸 중심 3×3 칸의 타일을 모두 터뜨림", { ch: 1, target: "cell", anim: "boom" }),
  A("e_evolve", "숫자 진화", "epic", "active", "craft", "amp", "판의 8 이하 타일을 모두 두 배로", { ch: 1, anim: "grow" }),
  A("e_reshuffle", "보드 재배치", "epic", "active", "craft", "rotate", "모든 타일을 큰 숫자부터 뱀 모양(ㄹ자)으로 다시 놓음", { ch: 1, anim: "shuffle" }),
  A("e_frenzy", "합성 폭주", "epic", "active", "burst", "combo", "다음 15번 이동 동안 합성 점수 ×2", { ch: 1, dur: "15이동", anim: "frenzy" }),
  A("e_time", "시간 확장", "epic", "active", "guard", "hourglass", "남은 시간 +30초 (제한 시간 있는 판만)", { ch: 1, timedOnly: true, anim: "time" }),
  A("e_teleport", "타일 순간이동", "epic", "active", "craft", "swap", "타일 하나를 아무 빈칸으로 옮김", { ch: 2, cd: 4, target: "tile_empty", anim: "tele" }),
  A("e_goldnum", "황금 숫자", "epic", "passive", "score", "gold", "128 이상을 만드는 합성 점수 +50%, 새 최고 숫자(64 이상)를 만들면 그 숫자만큼 보너스", { dur: "계속" }),
  A("e_balance", "숫자 균형", "epic", "active", "craft", "line", "32 이하 숫자 중 짝이 없는 타일을 한 단계 올려 같은 숫자끼리 짝을 맞춤", { ch: 1, anim: "morph" }),
  A("e_life", "추가 생명", "epic", "trigger", "guard", "phoenix", "게임 오버가 되면 한 번, 가장 작은 타일 6개를 치우고 계속", { ch: 1, dur: "1회", anim: "rescue" }),
  // ---- 전설 10
  A("l_god", "숫자의 신", "legendary", "active", "burst", "crown", "다음 20번 이동 동안 합성 점수 ×3", { ch: 1, dur: "20이동", anim: "frenzy" }),
  A("l_automerge", "완벽한 합성", "legendary", "trigger", "burst", "sparkle", "10번 이동마다 판에서 가장 큰 '같은 숫자 두 개'(8 이상)를 떨어져 있어도 자동으로 합성", { dur: "10이동마다", anim: "chain" }),
  A("l_fate", "운명의 재구성", "legendary", "active", "craft", "dice", "판 전체 숫자를 모두 합친 뒤 서로 다른 숫자로 다시 나눠 ㄹ자로 배치 (점수 없음)", { ch: 1, anim: "shuffle" }),
  A("l_rewind", "시간 역행", "legendary", "active", "guard", "rewind", "최대 5번 이동을 한꺼번에 되돌림 (점수도 그때로)", { ch: 1, anim: "rewind" }),
  A("l_goldboard", "황금 보드", "legendary", "active", "score", "gold", "가장 큰 타일 4개를 황금으로 (판에 최대 6개)", { ch: 1, anim: "gold" }),
  A("l_infinite", "무한 성장", "legendary", "passive", "score", "amp", "고른 뒤 150번 합성 동안 합성 점수 +60%", { dur: "합성 150번" }),
  A("l_expand", "차원 확장", "legendary", "active", "burst", "cross", "40번 이동 동안 판이 5×5로 커짐. 끝나면 바깥 줄 타일은 빈칸으로 들어오거나 작은 타일과 바뀜", { ch: 1, dur: "40이동", anim: "expand" }),
  A("l_revolution", "숫자 혁명", "legendary", "active", "craft", "star", "64 이하 타일을 모두 그중 가장 많은 숫자로 바꿈 (3개 이상일 때)", { ch: 1, anim: "morph" }),
  A("l_miracle", "최후의 기적", "legendary", "trigger", "guard", "phoenix", "게임 오버가 되면 한 번, 가장 큰 타일 4개만 남기고 모두 정리", { ch: 1, dur: "1회", anim: "rescue" }),
  A("l_master", "2048 마스터", "legendary", "passive", "burst", "crown", "모든 합성 +25%, 256 이상 합성 점수 +100%, 연쇄 합성 1번, 2048을 처음 만들면 +2048점", { dur: "계속" }),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const W = { common: 60, rare: 28, epic: 10, legendary: 3 };
const rarityW = (r, k) => r === "common" ? Math.max(20, W.common - 10 * k) : r === "rare" ? W.rare : r === "epic" ? W.epic + 4 * k : W.legendary + 2 * k;

// ---------- 판 도구 ----------
const cp = (t) => t ? { id: t.id, v: t.v, g: t.g } : null;
const lg2 = (v) => Math.round(Math.log2(v));
export function lineIdx(n, dir, k) { // 이동 방향 쪽 끝부터
  const out = [];
  for (let j = 0; j < n; j++) {
    if (dir === 3) out.push(k * n + j);
    else if (dir === 1) out.push(k * n + (n - 1 - j));
    else if (dir === 0) out.push(j * n + k);
    else out.push((n - 1 - j) * n + k);
  }
  return out;
}
const nb4 = (n, i) => { const r = Math.floor(i / n), c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
const snakeIdx = (n) => { const o = []; for (let r = 0; r < n; r++) for (let j = 0; j < n; j++) o.push(r * n + (r % 2 ? n - 1 - j : j)); return o; };

/**
 * 한 사람의 2048 판.
 * opts: { seed, augSeed, mode: 'classic'|'augment', timed: bool }
 */
export class Game2048 {
  constructor(o = {}) {
    if (o.state) { this.load(o.state); return; }
    this.v = VERSION;
    this.mode = o.mode === "augment" ? "augment" : "classic";
    this.timed = !!o.timed;
    this.n = 4; this.cells = Array(16).fill(null); this.nid = 1;
    this.sr = { s: (o.seed >>> 0) || 1 }; this.ar = { s: (o.augSeed ?? ((o.seed ^ 0x9E3779B9) >>> 0)) >>> 0 || 7 };
    this.score = 0; this.moves = 0; this.merges = 0; this.combo = 0; this.maxTile = 0;
    this.alive = true; this.won = false; this.m2048 = false;
    this.augs = []; this.picks = 0; this.offer = null; this.refresh = 1; this.syn3c = false;
    this.buffs = { frenzy: 0, god: 0, inf: 0 }; this.expand = 0; this.autoN = 0;
    this.timeBonus = 0; this.streamTime = 0; this.hist = []; this.ops = 0;
    this.fx = [];
    this.spawn(); this.spawn();
    if (this.mode === "augment") this.offerIfDue();
  }
  // ---------- 저장 / 복원 ----------
  save() {
    return { v: this.v, mode: this.mode, timed: this.timed, n: this.n, cells: this.cells.map(cp), nid: this.nid, sr: this.sr.s, ar: this.ar.s, score: this.score, moves: this.moves, merges: this.merges, combo: this.combo, maxTile: this.maxTile, alive: this.alive, won: this.won, m2048: this.m2048, augs: this.augs.map(a => ({ ...a })), picks: this.picks, offer: this.offer ? [...this.offer] : null, refresh: this.refresh, syn3c: this.syn3c, buffs: { ...this.buffs }, expand: this.expand, autoN: this.autoN, timeBonus: this.timeBonus, streamTime: this.streamTime, hist: this.hist.map(h => JSON.parse(JSON.stringify(h))), ops: this.ops };
  }
  load(s) {
    Object.assign(this, JSON.parse(JSON.stringify(s)));
    this.sr = { s: s.sr >>> 0 }; this.ar = { s: s.ar >>> 0 }; this.fx = [];
  }
  hash() {
    let s = this.n + "|" + this.cells.map(t => t ? t.v + (t.g ? "g" : "") : "").join(",") + "|" + this.score + "|" + (this.alive ? 1 : 0) + "|" + this.picks + "|" + (this.offer || []).join(",") + "|" + this.augs.map(a => a.id + ":" + a.ch + ":" + a.cdUntil).join(",") + "|" + this.sr.s + "|" + this.ar.s + "|" + this.expand + "|" + this.timeBonus + "|" + this.streamTime;
    return hashStr(s);
  }
  // 다른 사람에게 보여 줄 짧은 판 글자: "4:" + 칸마다 2의 지수(36진, 0=빈칸) + 황금이면 뒤에 '*'
  board() { return this.n + ":" + this.cells.map(t => t ? lg2(t.v).toString(36) + (t.g ? "*" : "") : "0").join(""); }
  // ---------- 조회 ----------
  has(id) { return this.augs.some(a => a.id === id); }
  aug(id) { return this.augs.find(a => a.id === id); }
  tiles() { return this.cells.filter(Boolean); }
  empties() { const o = []; this.cells.forEach((t, i) => { if (!t) o.push(i); }); return o; }
  synCount(g) { return this.augs.filter(a => AUG[a.id]?.group === g).length; }
  goldCount() { return this.cells.filter(t => t && t.g).length; }
  canMove() {
    const n = this.n;
    for (let i = 0; i < n * n; i++) {
      const t = this.cells[i]; if (!t) return true;
      const c = i % n;
      if (c < n - 1 && this.cells[i + 1]?.v === t.v) return true;
      if (i + n < n * n && this.cells[i + n]?.v === t.v) return true;
    }
    return false;
  }
  canDir(d) { return this.simulate(d).moved; }
  // 숫자 감별사: 가장 좋은 방향 (합성 수 → 빈칸 수 → 큰 타일이 모서리)
  hint() {
    let best = -1, bs = -1e9;
    for (let d = 0; d < 4; d++) { const r = this.simulate(d); if (!r.moved) continue; const s = r.gain * 10 + r.merges * 40 + r.empty * 6 + (d === 1 || d === 2 ? 1 : 0); if (s > bs) { bs = s; best = d; } }
    return best;
  }
  mergeablePairs() {
    const n = this.n, o = [];
    for (let i = 0; i < n * n; i++) { const t = this.cells[i]; if (!t) continue; if (i % n < n - 1 && this.cells[i + 1]?.v === t.v) o.push([i, i + 1]); if (i + n < n * n && this.cells[i + n]?.v === t.v) o.push([i, i + n]); }
    return o;
  }
  simulate(d) {
    const n = this.n; let moved = false, merges = 0, gain = 0; const cells = Array(n * n).fill(null);
    for (let k = 0; k < n; k++) {
      const idx = lineIdx(n, d, k), line = idx.map(i => this.cells[i]).filter(Boolean); let w = 0;
      for (let j = 0; j < line.length; j++) {
        if (j + 1 < line.length && line[j].v === line[j + 1].v) { cells[idx[w]] = { v: line[j].v * 2 }; merges++; gain += line[j].v * 2; j++; }
        else cells[idx[w]] = line[j];
        w++;
      }
      for (let j = 0; j < n; j++) if ((this.cells[idx[j]] || null) !== (cells[idx[j]] || null)) moved = true;
    }
    return { moved, merges, gain, empty: cells.filter(c => !c).length };
  }

  // ---------- 점수 ----------
  multOf(v, gold) {
    let add = 0;
    if (this.has("c_merge")) add += 0.10;
    if (this.has("c_chain")) add += Math.min(0.30, 0.02 * this.combo);
    if (this.has("c_grow") && v <= 16) add += 0.5;
    if (this.has("e_goldnum") && v >= 128) add += 0.5;
    if (this.has("l_infinite") && this.buffs.inf > 0) add += 0.6;
    if (this.has("l_master")) { add += 0.25; if (v >= 256) add += 1.0; }
    const sc = this.synCount("score"); if (sc >= 3) add += 0.12; else if (sc >= 2) add += 0.05;
    const burst = Math.max(this.buffs.god > 0 ? 3 : 1, this.buffs.frenzy > 0 ? 2 : 1);
    return Math.min(MULT_CAP, (1 + add) * burst * (gold ? 2 : 1));
  }
  onMerged(v, gold, at) { // 합성 1번의 점수 (+ 보너스). 반환: 얻은 점수
    let pts = Math.round(v * this.multOf(v, gold));
    if (this.has("c_luck") && rnd(this.ar) < 0.10) { const b = v / 2; pts += b; this.fx.push({ k: "luck", at, pts: b }); }
    if (this.has("c_collect") && (v === 64 || v === 256 || v === 1024)) { pts += v; this.fx.push({ k: "collect", at, pts: v }); }
    if (this.has("e_goldnum") && v > this.maxTile && v >= 64) { pts += v; this.fx.push({ k: "newmax", at, pts: v }); }
    if (v > this.maxTile) this.maxTile = v;
    if (v >= 2048 && !this.won) { this.won = true; this.fx.push({ k: "win", at }); }
    if (v >= 2048 && this.has("l_master") && !this.m2048) { this.m2048 = true; pts += 2048; this.fx.push({ k: "master", at, pts: 2048 }); }
    this.merges++;
    if (this.buffs.inf > 0) this.buffs.inf--;
    return pts;
  }
  snap() { return { n: this.n, cells: this.cells.map(cp), score: this.score, moves: this.moves, merges: this.merges, combo: this.combo, buffs: { ...this.buffs }, expand: this.expand, maxTile: this.maxTile, autoN: this.autoN, won: this.won, m2048: this.m2048 }; }
  restore(s) { Object.assign(this, { n: s.n, cells: s.cells.map(cp), score: s.score, moves: s.moves, merges: s.merges, combo: s.combo, buffs: { ...s.buffs }, expand: s.expand, maxTile: s.maxTile, autoN: s.autoN, won: s.won, m2048: s.m2048 }); }

  // ---------- 이동 ----------
  /** 반환 { ok, error?, anim:{slides:[[id,from,to]], merges:[[newId,at,v,aId,bId,gold]], spawn:[id,at,v]|null}, gain } */
  move(d) {
    d = Number(d);
    if (!(d >= 0 && d <= 3)) return { ok: false, error: "BAD_DIR" };
    if (!this.alive) return { ok: false, error: "DEAD" };
    if (this.offer) return { ok: false, error: "PICKING" };
    const n = this.n, before = this.mode === "augment" ? this.snap() : null;
    const old = this.cells, cells = Array(n * n).fill(null), slides = [], merges = [], made = [];
    let moved = false, gain = 0, sumMerged = 0;
    this.fx = [];
    for (let k = 0; k < n; k++) {
      const idx = lineIdx(n, d, k); const line = []; for (const i of idx) if (old[i]) line.push([old[i], i]);
      let w = 0;
      for (let j = 0; j < line.length; j++) {
        const [t, from] = line[j], to = idx[w];
        if (j + 1 < line.length && line[j + 1][0].v === t.v) {
          const [u, from2] = line[j + 1];
          const nt = { id: this.nid++, v: t.v * 2, g: t.g || u.g ? 1 : 0 };
          cells[to] = nt; slides.push([t.id, from, to], [u.id, from2, to]); merges.push([nt.id, to, nt.v, t.id, u.id, nt.g]); made.push(to);
          moved = true; j++;
        } else { cells[to] = t; slides.push([t.id, from, to]); if (from !== to) moved = true; }
        w++;
      }
    }
    if (!moved) return { ok: false, error: "NO_MOVE" };
    this.cells = cells;
    if (before) { this.hist.push(before); if (this.hist.length > HIST_MAX) this.hist.shift(); }
    const hadMerge = merges.length > 0;
    this.combo = hadMerge ? this.combo + 1 : 0;
    for (const m of merges) { const p = this.onMerged(m[2], m[5], m[1]); gain += p; sumMerged += m[2]; }
    // 연쇄 합성 (연쇄 합성 2 + 2048 마스터 1 + 폭주 회로 3개 1)
    let cap = (this.has("e_chain") ? 2 : 0) + (this.has("l_master") ? 1 : 0); if (cap && this.synCount("burst") >= 3) cap++;
    if (cap && made.length) {
      const used = new Set(); let done = 0;
      for (const at of made) {
        if (done >= cap) break; const t = this.cells[at]; if (!t || used.has(at)) continue;
        const nbI = nb4(n, at).find(j => !used.has(j) && this.cells[j] && this.cells[j].v === t.v);
        if (nbI == null) continue;
        const u = this.cells[nbI]; const nt = { id: this.nid++, v: t.v * 2, g: t.g || u.g ? 1 : 0 };
        this.cells[nbI] = null; this.cells[at] = nt; used.add(at); used.add(nbI); done++;
        merges.push([nt.id, at, nt.v, t.id, u.id, nt.g]); slides.push([u.id, nbI, at]);
        gain += this.onMerged(nt.v, nt.g, at); sumMerged += nt.v; this.fx.push({ k: "chain", at });
      }
    }
    this.moves++;
    // 완벽한 합성: 10번 이동마다 가장 큰 같은 숫자 두 개(8 이상)를 합성
    if (this.has("l_automerge")) {
      this.autoN++;
      if (this.autoN >= 10) {
        this.autoN = 0;
        const by = new Map(); this.cells.forEach((t, i) => { if (t && t.v >= 8) { if (!by.has(t.v)) by.set(t.v, []); by.get(t.v).push(i); } });
        const vs = [...by.keys()].filter(v => by.get(v).length >= 2).sort((a, b) => b - a);
        if (vs.length) {
          const [i1, i2] = by.get(vs[0]); const t = this.cells[i1], u = this.cells[i2];
          const nt = { id: this.nid++, v: t.v * 2, g: t.g || u.g ? 1 : 0 };
          this.cells[i2] = null; this.cells[i1] = nt; merges.push([nt.id, i1, nt.v, t.id, u.id, nt.g]); slides.push([u.id, i2, i1]);
          gain += this.onMerged(nt.v, nt.g, i1); sumMerged += nt.v; this.fx.push({ k: "auto", at: i1, from: i2 });
        }
      }
    }
    if (this.has("c_perfect") && sumMerged >= 256) { const b = Math.round(gain * 0.25); gain += b; this.fx.push({ k: "perfect", pts: b }); }
    if (this.buffs.frenzy > 0) this.buffs.frenzy--;
    if (this.buffs.god > 0) this.buffs.god--;
    if (this.expand > 0) { this.expand--; if (this.expand === 0) this.shrink(); }
    const spawn = this.spawn();
    if (this.has("c_empty")) { const e = this.empties().length; if (e >= 6) { gain += e * 2; this.fx.push({ k: "empty", pts: e * 2 }); } }
    this.score += gain;
    this.offerIfDue();
    this.checkOver();
    this.ops++;
    return { ok: true, anim: { slides, merges, spawn }, gain, fx: this.fx };
  }
  spawn() {
    const em = this.empties(); if (!em.length) return null;
    const r1 = rnd(this.sr), r2 = rnd(this.sr);
    let at = em[Math.floor(r1 * em.length)];
    const p4 = this.synCount("guard") >= 2 ? 0.05 : 0.10;
    const v = r2 < p4 ? 4 : 2;
    if (this.has("r_luckyspawn") && rnd(this.ar) < 0.40) {
      const good = em.filter(i => nb4(this.n, i).some(j => this.cells[j]?.v === v));
      if (good.length) at = good[Math.floor(rnd(this.ar) * good.length)];
    }
    const t = { id: this.nid++, v, g: 0 }; this.cells[at] = t;
    if (v > this.maxTile) this.maxTile = v;
    return [t.id, at, v];
  }
  shrink() { // 차원 확장 끝: 5×5 → 4×4
    const n = this.n; if (n !== 5) return;
    const keep = Array(16).fill(null), ring = [];
    for (let i = 0; i < 25; i++) { const t = this.cells[i]; if (!t) continue; const r = Math.floor(i / 5), c = i % 5; if (r < 4 && c < 4) keep[r * 4 + c] = t; else ring.push(t); }
    ring.sort((a, b) => b.v - a.v);
    let dropped = 0;
    for (const t of ring) {
      const e = keep.indexOf(null);
      if (e >= 0) { keep[e] = t; continue; }
      let mi = -1; for (let i = 0; i < 16; i++) if (mi < 0 || keep[i].v < keep[mi].v) mi = i;
      if (keep[mi].v < t.v) { keep[mi] = t; } dropped++;
    }
    this.n = 4; this.cells = keep; this.fx.push({ k: "shrink", dropped });
  }
  checkOver() {
    if (!this.alive) return;
    if (!this.tiles().length) { this.spawn(); this.spawn(); }
    if (this.canMove()) return;
    const extra = this.synCount("guard") >= 3 ? 2 : 0;
    const smallest = (k) => { const ord = this.cells.map((t, i) => [t, i]).filter(x => x[0]).sort((a, b) => a[0].v - b[0].v || a[1] - b[1]); for (const [, i] of ord.slice(0, k)) this.cells[i] = null; };
    for (const id of ["c_safe", "e_life", "l_miracle"]) {
      const a = this.aug(id); if (!a || a.ch <= 0) continue;
      a.ch--;
      if (id === "c_safe") smallest(2 + extra);
      else if (id === "e_life") smallest(6 + extra);
      else smallest(Math.max(0, this.tiles().length - 4)); // 가장 큰 4개만 남김
      this.fx.push({ k: "rescue", id });
      if (this.canMove()) return;
    }
    this.alive = false; this.offer = null; this.fx.push({ k: "over" });
  }

  // ---------- 증강 고르기 ----------
  pool() { const own = new Set(this.augs.map(a => a.id)); return AUGS.filter(a => !own.has(a.id) && (!a.timedOnly || this.timed)); }
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
    // 죽은 사람·이미 고르는 중·다 고른 사람은 증강 카드가 뜨지 않음
    if (this.mode !== "augment" || !this.alive || this.offer || this.picks >= MAX_AUGS || this.augs.length >= MAX_AUGS) return false;
    if (this.merges < PICK_AT[this.picks]) return false;
    this.offer = this.roll(this.picks); if (!this.offer.length) { this.offer = null; return false; }
    this.fx.push({ k: "offer" });
    return true;
  }
  pick(id) {
    if (!this.offer) return { ok: false, error: "NOT_PICK_PHASE" };
    if (!this.alive) { this.offer = null; return { ok: false, error: "DEAD" }; }
    if (!this.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    this.fx = [];
    this.grant(id);
    this.picks++; this.offer = null; this.ops++;
    this.offerIfDue(); // 합성이 빨라 다음 기준도 이미 넘었으면 이어서
    return { ok: true, fx: this.fx };
  }
  rerollOffer() {
    if (!this.offer) return { ok: false, error: "NOT_PICK_PHASE" };
    if (this.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    this.refresh--; this.offer = this.roll(this.picks); this.ops++;
    return { ok: true };
  }
  grant(id) {
    const d = AUG[id]; if (!d || this.has(id) || this.augs.length >= MAX_AUGS) return false;
    this.augs.push({ id, ch: d.ch, cdUntil: 0 });
    if (id === "l_infinite") this.buffs.inf = 150;
    if (!this.syn3c && this.synCount("craft") >= 3) { this.syn3c = true; for (const a of this.augs) if (AUG[a.id].group === "craft" && AUG[a.id].kind === "active") a.ch++; this.fx.push({ k: "syn", g: "craft" }); }
    this.fx.push({ k: "got", id });
    return true;
  }

  // ---------- 증강 사용 ----------
  /** a, b = 칸 번호 (필요한 증강만). 반환 { ok, error?, cells:[바뀐 칸], fx } */
  use(id, a = -1, b = -1) {
    if (!this.alive) return { ok: false, error: "DEAD" };
    if (this.offer) return { ok: false, error: "PICKING" };
    const st = this.aug(id), d = AUG[id];
    if (!st || !d) return { ok: false, error: "NO_AUG" };
    if (d.kind !== "active") return { ok: false, error: "NOT_ACTIVE" };
    if (st.ch <= 0) return { ok: false, error: "NO_CHARGES" };
    if (this.moves < st.cdUntil) return { ok: false, error: "COOLDOWN" };
    if (d.timedOnly && !this.timed) return { ok: false, error: "CANT_NOW" };
    const n = this.n, N = n * n, C = this.cells;
    a = Number(a); b = Number(b);
    const inB = (i) => Number.isInteger(i) && i >= 0 && i < N;
    const need = d.target;
    if (["tile", "tile_empty", "tile_tile", "tile_adj", "cell", "row"].includes(need) && !inB(a)) return { ok: false, error: "BAD_CELL" };
    if (["tile_empty", "tile_tile", "tile_adj"].includes(need) && !inB(b)) return { ok: false, error: "BAD_CELL" };
    if (["tile", "tile_empty", "tile_tile", "tile_adj"].includes(need) && !C[a]) return { ok: false, error: "NEED_TILE" };
    if (need === "tile_empty" && C[b]) return { ok: false, error: "NEED_EMPTY" };
    if ((need === "tile_tile" || need === "tile_adj") && (!C[b] || a === b)) return { ok: false, error: "NEED_TILE" };
    this.fx = [];
    const changed = [];
    const E = (code) => ({ ok: false, error: code });
    switch (id) {
      case "c_sort": {
        const r = Math.floor(a / n), idx = []; for (let c = 0; c < n; c++) idx.push(r * n + c);
        const ts = idx.map(i => C[i]).filter(Boolean); if (ts.length < 2) return E("NO_EFFECT");
        const sorted = ts.slice().sort((x, y) => y.v - x.v);
        const same = idx.every((i, j) => (C[i] || null) === (sorted[j] || null)); if (same) return E("NO_EFFECT");
        idx.forEach((i, j) => { C[i] = sorted[j] || null; changed.push(i); });
        break;
      }
      case "r_dup": if (C[a].v > 256) return E("TOO_BIG"); C[b] = { id: this.nid++, v: C[a].v, g: 0 }; changed.push(a, b); break;
      case "r_del": C[a] = null; changed.push(a); break;
      case "r_half": if (C[a].v < 4) return E("TOO_SMALL"); C[a] = { ...C[a], v: C[a].v / 2 }; changed.push(a); break;
      case "r_double": if (C[a].v > 128) return E("TOO_BIG"); C[a] = { ...C[a], v: C[a].v * 2 }; if (C[a].v > this.maxTile) this.maxTile = C[a].v; changed.push(a); break;
      case "r_swap": { const t = C[a]; C[a] = C[b]; C[b] = t; changed.push(a, b); break; }
      case "r_bomb": { const hit = [a, ...nb4(n, a)].filter(i => C[i]); if (!hit.length) return E("NO_EFFECT"); for (const i of hit) { C[i] = null; changed.push(i); } break; }
      case "e_blast": {
        const r0 = Math.floor(a / n), c0 = a % n, hit = [];
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (r >= 0 && c >= 0 && r < n && c < n && C[r * n + c]) hit.push(r * n + c);
        if (!hit.length) return E("NO_EFFECT"); for (const i of hit) { C[i] = null; changed.push(i); } break;
      }
      case "r_gold": if (C[a].g) return E("ALREADY_GOLD"); if (this.goldCount() >= GOLD_CAP) return E("GOLD_CAP"); C[a] = { ...C[a], g: 1 }; changed.push(a); break;
      case "l_goldboard": {
        const ord = C.map((t, i) => [t, i]).filter(x => x[0] && !x[0].g).sort((x, y) => y[0].v - x[0].v || x[1] - y[1]);
        let room = 6 - this.goldCount(); if (room <= 0 || !ord.length) return E("GOLD_CAP");
        for (const [, i] of ord.slice(0, Math.min(4, room))) { C[i] = { ...C[i], g: 1 }; changed.push(i); }
        break;
      }
      case "r_undo": case "l_rewind": {
        if (!this.hist.length) return E("CANT_REWIND");
        const k = id === "r_undo" ? 1 : Math.min(5, this.hist.length);
        let s = null; for (let j = 0; j < k; j++) s = this.hist.pop();
        this.restore(s); for (let i = 0; i < this.n * this.n; i++) changed.push(i);
        this.fx.push({ k: "rewind", steps: k });
        break;
      }
      case "r_transform": {
        if (!nb4(n, a).includes(b)) return E("NOT_ADJ");
        if (C[a].v === C[b].v) return E("NO_EFFECT"); if (C[a].v * 4 < C[b].v) return E("TOO_BIG");
        C[a] = { ...C[a], v: C[b].v }; if (C[a].v > this.maxTile) this.maxTile = C[a].v; changed.push(a); break;
      }
      case "e_teleport": C[b] = C[a]; C[a] = null; changed.push(a, b); break;
      case "e_evolve": { let k = 0; C.forEach((t, i) => { if (t && t.v <= 8) { C[i] = { ...t, v: t.v * 2 }; changed.push(i); k++; } }); if (!k) return E("NO_EFFECT"); this.maxTile = Math.max(this.maxTile, ...this.tiles().map(t => t.v)); break; }
      case "e_reshuffle": case "l_fate": {
        let list;
        if (id === "e_reshuffle") list = this.tiles().sort((x, y) => y.v - x.v);
        else {
          let sum = 0, golds = this.goldCount(); for (const t of this.tiles()) sum += t.v;
          list = []; for (let bit = 30; bit >= 1; bit--) if (sum & (1 << bit)) list.push({ id: this.nid++, v: 1 << bit, g: 0 });
          for (let j = 0; j < list.length && golds > 0; j++, golds--) list[j].g = 1;
          if (list.length > N) list.length = N;
        }
        const order = snakeIdx(n); this.cells = Array(N).fill(null);
        list.forEach((t, j) => { this.cells[order[j]] = t; });
        for (let i = 0; i < N; i++) changed.push(i);
        this.maxTile = Math.max(this.maxTile, ...list.map(t => t.v));
        if (this.maxTile >= 2048 && !this.won) { this.won = true; this.fx.push({ k: "win" }); }
        break;
      }
      case "e_balance": {
        let k = 0;
        for (let v = 2; v <= 32; v *= 2) {
          const at = []; this.cells.forEach((t, i) => { if (t && t.v === v) at.push(i); });
          if (at.length % 2 === 1) { const i = at[at.length - 1]; this.cells[i] = { ...this.cells[i], v: v * 2 }; changed.push(i); k++; }
        }
        if (!k) return E("NO_EFFECT"); break;
      }
      case "l_revolution": {
        const small = []; C.forEach((t, i) => { if (t && t.v <= 64) small.push(i); });
        if (small.length < 3) return E("NO_EFFECT");
        const cnt = new Map(); for (const i of small) cnt.set(C[i].v, (cnt.get(C[i].v) || 0) + 1);
        let tv = 0, tc = -1; for (const [v, c] of cnt) if (c > tc || (c === tc && v > tv)) { tv = v; tc = c; }
        for (const i of small) if (C[i].v !== tv) { C[i] = { ...C[i], v: tv }; changed.push(i); }
        if (!changed.length) return E("NO_EFFECT"); break;
      }
      case "e_frenzy": this.buffs.frenzy = 15 + (this.synCount("burst") >= 2 ? 5 : 0); break;
      case "l_god": this.buffs.god = 20 + (this.synCount("burst") >= 2 ? 5 : 0); break;
      case "e_time": this.timeBonus += 30; break;
      case "l_expand": {
        if (n !== 4) return E("CANT_NOW");
        const nc = Array(25).fill(null); for (let i = 0; i < 16; i++) nc[Math.floor(i / 4) * 5 + (i % 4)] = C[i];
        this.n = 5; this.cells = nc; this.expand = 40 + (this.synCount("burst") >= 2 ? 5 : 0);
        for (let i = 0; i < 25; i++) changed.push(i);
        break;
      }
      default: return E("NO_AUG");
    }
    st.ch--;
    const cd = this.synCount("craft") >= 2 ? Math.floor(d.cd / 2) : d.cd;
    st.cdUntil = this.moves + cd;
    this.fx.push({ k: "use", id, a, b });
    this.checkOver();
    this.ops++;
    return { ok: true, cells: [...new Set(changed)], fx: this.fx };
  }

  // ---------- 스트리머 후원 효과 (서버가 확인한 뒤 호출) ----------
  stream(kind) {
    if (!this.alive) return { ok: false };
    this.fx = []; let ok = false, note = "";
    if (kind === "gift" && this.mode === "augment" && this.augs.length < MAX_AUGS) {
      const ids = this.pool().map(a => a.id); if (ids.length) { const id = ids[Math.floor(rnd(this.ar) * ids.length)]; ok = this.grant(id); note = AUG[id].name; }
    }
    if (kind === "frenzy") { this.buffs.frenzy = Math.max(this.buffs.frenzy, 10); ok = true; }
    if (kind === "clean") { const ord = this.cells.map((t, i) => [t, i]).filter(x => x[0]).sort((a, b) => a[0].v - b[0].v || a[1] - b[1]).slice(0, 3); if (ord.length && this.tiles().length > 2) { for (const [, i] of ord) this.cells[i] = null; ok = true; } }
    if (kind === "time" && this.timed && this.streamTime < STREAM_TIME_CAP) { const add = Math.min(15, STREAM_TIME_CAP - this.streamTime); this.streamTime += add; ok = true; note = "+" + add + "초"; }
    if (kind === "junk") { for (let k = 0; k < 2; k++) { const em = this.empties(); if (em.length <= 1) break; this.cells[em[Math.floor(rnd(this.ar) * em.length)]] = { id: this.nid++, v: 2, g: 0 }; ok = true; } }
    if (ok) { this.fx.push({ k: "stream", kind }); this.checkOver(); this.ops++; }
    return { ok, note, fx: this.fx };
  }

  /** 서버·화면 공통 조작 실행: op = ['m',dir] | ['p',id] | ['r'] | ['u',id,a,b] */
  apply(op) {
    if (!Array.isArray(op)) return { ok: false, error: "BAD_OP" };
    if (op[0] === "m") return this.move(op[1]);
    if (op[0] === "p") return this.pick(String(op[1] || ""));
    if (op[0] === "r") return this.rerollOffer();
    if (op[0] === "u") return this.use(String(op[1] || ""), op[2] ?? -1, op[3] ?? -1);
    return { ok: false, error: "BAD_OP" };
  }
  /** 남들에게 보여 줄 요약 */
  summary() { return { score: this.score, max: this.maxTile, moves: this.moves, merges: this.merges, alive: this.alive, augs: this.augs.map(a => a.id), won: this.won, n: this.n }; }
}

/** 공정 경쟁: 방 시드 하나로 모두 같은 흐름 / 아니면 사람마다 다른 흐름 */
export function seedFor(roomSeed, idx, fair) { return fair ? (roomSeed >>> 0) || 1 : hashStr(roomSeed + ":" + idx) || 1; }
/** 짧은 판 글자 → { n, cells:[{v,g}|null] } */
export function decodeBoard(s) {
  const [nS, body] = String(s || "4:").split(":"); const n = Number(nS) === 5 ? 5 : 4, cells = [];
  for (let i = 0; i < (body || "").length; i++) { const ch = body[i]; if (ch === "*") { if (cells.length && cells[cells.length - 1]) cells[cells.length - 1].g = 1; continue; } const e = parseInt(ch, 36); cells.push(e ? { v: 2 ** e, g: 0 } : null); }
  while (cells.length < n * n) cells.push(null);
  return { n, cells: cells.slice(0, n * n) };
}
