// 플듀 블록로얄 — 게임 규칙 엔진 (화면 없음)
// 브라우저와 서버가 똑같은 파일을 씀(worldcup-backend/src/br-core.js 와 동일해야 함, 시험으로 확인).
// 조작을 글자로 기록(ops) → 서버가 같은 조작을 다시 돌려 이동·회전·줄·점수·공격을 직접 계산한다.
//   L R 이동 · A 시계 회전 · B 반시계 회전 · D 한 칸 내림 · H 보관 · X 바로 내리기 · K 바닥에서 고정
export const RULES = {
  cols: 10, rows: 20, hidden: 4, garbageCell: 8,
  lockMs: 500, lockResets: 15, garbagePerLock: 8,
  score: { line: [0, 100, 300, 500, 800], tspin: [400, 800, 1200, 1600], mini: [100, 200, 400], spin: [100, 300, 500, 700, 900], combo: 50, perfect: 1800, piece: 2 },
  attack: { line: [0, 0, 1, 2, 4], tspin: [0, 2, 4, 6], mini: [0, 0, 1], spin: [0, 1, 2, 3, 4], b2b: 1, perfect: 6, combo: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5] },
};
export const COLS = RULES.cols, ROWS = RULES.rows, HIDDEN = RULES.hidden, TOTAL = ROWS + HIDDEN, GARBAGE = RULES.garbageCell;
// 조각: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L — 회전별 칸 [x, y]
export const SHAPES = {
  1: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
  2: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
  3: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  4: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  5: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  6: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  7: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
};
// 벽 차기 표 (y는 아래가 +). 회전이 막히면 순서대로 옮겨 보고 처음 되는 곳으로
const KICK = { "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]] };
const KICK_I = { "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]] };
const FRONT = [[[0, 0], [2, 0]], [[2, 0], [2, 2]], [[0, 2], [2, 2]], [[0, 0], [0, 2]]];
const rngOf = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// 7개씩 섞기: 같은 시드 = 같은 순서
function bagAt(seed, n) { const r = rngOf((seed ^ Math.imul(n + 1, 0x9e3779b1)) | 0), b = [1, 2, 3, 4, 5, 6, 7]; for (let i = 6; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
export const speedMs = (level) => Math.max(40, Math.round(1000 * Math.pow(0.81, Math.max(0, level - 1))));
// ---- 증강 모드 (2026-11-16). aug 가 없으면 아래 코드는 전부 건너뜀 → 일반 경기와 완전히 같음
// k: p 내 판 규칙 · a 사용형(조작 글자 op, c회) · s 서버가 처리(공격 전달) / sc: 기록 경쟁에도 나옴
export const AUG_TH = [2, 10, 22, 36, 55];
export const AUG_W = { common: 60, rare: 28, epic: 10, legendary: 3 };
export const AUGS = {
  tetra: { r: "rare", k: "p" }, spin: { r: "rare", k: "p", sc: 1 }, combo: { r: "epic", k: "p", sc: 1 }, b2b: { r: "rare", k: "p", sc: 1 }, single: { r: "common", k: "p", sc: 1 },
  pc: { r: "epic", k: "p", sc: 1 }, shield: { r: "common", k: "p" }, buffer: { r: "common", k: "p" }, clean: { r: "common", k: "p" }, revenge: { r: "rare", k: "p" },
  edge: { r: "rare", k: "p", sc: 1 }, recycle: { r: "rare", k: "p" }, cancel: { r: "common", k: "p" }, score: { r: "common", k: "p", sc: 1 }, slow: { r: "common", k: "p", sc: 1 }, lock: { r: "common", k: "p", sc: 1 },
  bomb: { r: "rare", k: "a", op: "Q", c: 2, sc: 1 }, ibar: { r: "rare", k: "a", op: "W", c: 3, sc: 1 }, grav: { r: "epic", k: "a", op: "G", c: 1, sc: 1 },
  amp: { r: "rare", k: "s" }, split: { r: "epic", k: "s" }, thorn: { r: "rare", k: "s" }, dodge: { r: "rare", k: "s" }, hunter: { r: "common", k: "s" },
  phoenix: { r: "legendary", k: "p", sc: 1 }, crown: { r: "legendary", k: "p", sc: 1 },
};
export const AUG_OPS = { Q: "bomb", W: "ibar", G: "grav" };

export class BRGame {
  constructor({ seed = 1, startLevel = 1, aug = 0 } = {}) {
    this.seed = seed >>> 0; this.gN = 0; this.grid = new Uint8Array(COLS * TOTAL); this.bagN = 0; this.queue = [];
    this.startLevel = startLevel; this.floor = startLevel; this.score = 0; this.lines = 0; this.pieces = 0; this.combo = -1; this.maxCombo = 0; this.b2b = false; this.sent = 0; this.hold = 0; this.holdUsed = false; this.garbage = [];
    this.dead = false; this.cur = null; this.grav = 0; this.lock = 0; this.resets = 0; this.soft = false; this.softMs = 90; this.lastRot = false; this.lastKick = 0; this.ev = []; this.ops = ""; this.lastOps = ""; this.aug = aug ? { m: aug, list: [], n: 0, rr: 1, ch: {}, sh: 0, rv: 0, ph: 0 } : null; this.fill(); this.spawn();
  }
  get scoreLv() { return this.startLevel + Math.floor(this.lines / 10); }
  get level() { return Math.max(this.floor, this.scoreLv); }
  fill() { while (this.queue.length < 7) { this.queue.push(...bagAt(this.seed, this.bagN)); this.bagN++; } }
  next(n = 5) { return this.queue.slice(0, n); }
  at(x, y) { return this.grid[y * COLS + x]; }
  free(p, r, x, y) { for (const [cx, cy] of SHAPES[p][r]) { const X = x + cx, Y = y + cy; if (X < 0 || X >= COLS || Y >= TOTAL) return false; if (Y >= 0 && this.at(X, Y)) return false; } return true; }
  spawn(forced) {
    const p = forced || this.queue.shift(); this.fill(); const y0 = HIDDEN - 2; this.cur = { p, r: 0, x: 3, y: y0 }; this.grav = 0; this.lock = 0; this.resets = 0; this.lastRot = false; this.lastKick = 0;
    if (!this.free(p, 0, 3, y0)) { this.die(); if (this.dead) return false; }
    if (this.free(p, 0, 3, y0 + 1)) this.cur.y = y0 + 1;
    return true;
  }
  die() { if (this.dead) return; if (this.aug && this.aug.ph > 0) { this.aug.ph = 0; this.grid.fill(0); this.garbage = []; this.ev.push({ t: "revive" }); return; } this.dead = true; this.ev.push({ t: "dead" }); }
  grounded() { const c = this.cur; return !this.free(c.p, c.r, c.x, c.y + 1); }
  touched() { if (this.grounded() && this.resets < RULES.lockResets) { this.lock = 0; this.resets++; } }
  move(dx) { if (this.dead) return false; const c = this.cur; if (!this.free(c.p, c.r, c.x + dx, c.y)) return false; c.x += dx; this.lastRot = false; this.ops += dx < 0 ? "L" : "R"; this.touched(); this.ev.push({ t: "move" }); return true; }
  rotate(dir) {
    if (this.dead) return false; const c = this.cur; if (c.p === 2) return false; const to = (c.r + dir + 4) % 4, tbl = (c.p === 1 ? KICK_I : KICK)[c.r + ">" + to];
    for (let i = 0; i < tbl.length; i++) { const [kx, ky] = tbl[i]; if (this.free(c.p, to, c.x + kx, c.y + ky)) { c.x += kx; c.y += ky; c.r = to; this.lastRot = true; this.lastKick = i; this.ops += dir > 0 ? "A" : "B"; this.touched(); this.ev.push({ t: "rotate" }); return true; } }
    return false;
  }
  down() { const c = this.cur; if (this.dead || !this.free(c.p, c.r, c.x, c.y + 1)) return false; c.y++; this.lastRot = false; this.lock = 0; this.ops += "D"; return true; }
  ghostY() { const c = this.cur; let y = c.y; while (this.free(c.p, c.r, c.x, y + 1)) y++; return y; }
  hardDrop() { if (this.dead) return false; const c = this.cur, y = this.ghostY(); if (y !== c.y) this.lastRot = false; const dist = y - c.y; c.y = y; this.ops += "X"; this.ev.push({ t: "drop", n: dist }); this.lockPiece(); return true; }
  useHold() { if (this.dead || this.holdUsed) return false; const c = this.cur, h = this.hold; this.hold = c.p; this.holdUsed = true; this.ops += "H"; this.spawn(h || undefined); this.ev.push({ t: "hold" }); return true; }
  // 방해 줄: s 번호로 서버와 맞춤. m=true(도착 시간이 지남)여야 판에 올라온다
  addGarbage(n, s = 0, m = false) { n = Math.max(0, Math.min(40, n | 0)); if (n && !this.dead) this.garbage.push({ s, n, m }); }
  matureUpTo(seq) { for (const g of this.garbage) if (g.s <= seq) g.m = true; }
  pendingGarbage() { let a = 0; for (const g of this.garbage) a += g.n; return a; }
  tspinKind() { const c = this.cur; if (c.p !== 3 || !this.lastRot) return 0; const hit = (dx, dy) => { const X = c.x + dx, Y = c.y + dy; return X < 0 || X >= COLS || Y >= TOTAL || (Y >= 0 && this.at(X, Y)); }; let n = 0; for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) if (hit(dx, dy)) n++; if (n < 3) return 0; const f = FRONT[c.r].filter(([dx, dy]) => hit(dx, dy)).length; return f === 2 || this.lastKick === 4 ? 2 : 1; }
  // S·Z·L·J·I 스핀: 회전으로 들어와 꼼짝 못 하는 자리
  spinKind() { const c = this.cur; if (c.p === 3 || c.p === 2 || !this.lastRot) return 0; return !this.free(c.p, c.r, c.x - 1, c.y) && !this.free(c.p, c.r, c.x + 1, c.y) && !this.free(c.p, c.r, c.x, c.y - 1) ? c.p : 0; }
  lockPiece() {
    const c = this.cur, ts = this.tspinKind(), spin = this.spinKind(), A = this.aug, s0 = this.score, h0 = A ? this.height() : 0; let above = true, gRows = 0;
    for (const [cx, cy] of SHAPES[c.p][c.r]) { const X = c.x + cx, Y = c.y + cy; if (Y >= 0) this.grid[Y * COLS + X] = c.p; if (Y >= HIDDEN) above = false; }
    this.pieces++; this.lastOps = this.ops; this.ops = ""; this.holdUsed = false;
    const full = []; for (let y = 0; y < TOTAL; y++) { let ok = true; for (let x = 0; x < COLS; x++) if (!this.at(x, y)) { ok = false; break; } if (ok) full.push(y); }
    if (A) for (const y of full) if (this.grid.subarray(y * COLS, y * COLS + COLS).includes(GARBAGE)) gRows++;
    const n = full.length, cells = SHAPES[c.p][c.r].map(([cx, cy]) => [c.x + cx, c.y + cy]);
    if (n) { const g = new Uint8Array(COLS * TOTAL); let to = TOTAL - 1; for (let y = TOTAL - 1; y >= 0; y--) { if (full.includes(y)) continue; for (let x = 0; x < COLS; x++) g[to * COLS + x] = this.at(x, y); to--; } this.grid = g; }
    const R = RULES, hard = n === 4 || ((ts > 0 || spin > 0) && n > 0); let atk = 0; this.score += R.score.piece;
    if (n) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); const lv = this.scoreLv, b2b = hard && this.b2b; this.lines += n;
      const base = ts === 2 ? R.score.tspin[n] : ts === 1 ? R.score.mini[Math.min(n, 2)] : spin ? R.score.spin[n] : R.score.line[n];
      this.score += Math.round(base * lv * (b2b ? 1.5 : 1)) + (this.combo > 0 ? R.score.combo * this.combo * lv : 0);
      atk = (ts === 2 ? R.attack.tspin[n] : ts === 1 ? R.attack.mini[Math.min(n, 2)] : spin ? R.attack.spin[n] : R.attack.line[n]) + (b2b ? R.attack.b2b : 0) + R.attack.combo[Math.min(this.combo, R.attack.combo.length - 1)];
      const perfect = this.grid.every((v) => !v); if (perfect) { atk += R.attack.perfect; this.score += R.score.perfect * lv; }
      if (A) { const b = this.augBonus(n, ts, spin, b2b, perfect, h0, gRows); if (b) { atk += b; this.score += 30 * b * lv; this.ev.push({ t: "augAtk", n: b }); } if (perfect && this.has("pc")) this.score += R.score.perfect * lv; }
      this.b2b = hard;
      this.ev.push({ t: "clear", n, ts, spin, combo: this.combo, perfect, b2b, rows: full, atk });
    } else { this.combo = -1; if (ts || spin) this.score += (ts === 2 ? R.score.tspin[0] : R.score.mini[0]) * this.scoreLv; this.ev.push({ t: "lock", ts, spin, cells }); }
    // 내 공격은 받을 방해 줄부터 막고, 남은 만큼만 상대에게
    if (A && this.has("score")) this.score += Math.round((this.score - s0) * 0.3);
    const cx = A && this.has("cancel") ? 2 : 1;
    while (atk > 0 && this.garbage.length) { const g = this.garbage[0], take = Math.min(atk * cx, g.n); g.n -= take; atk -= Math.ceil(take / cx); if (!g.n) this.garbage.shift(); this.ev.push({ t: "cancel", n: take }); }
    if (atk > 0) { this.sent += atk; this.ev.push({ t: "attack", n: atk }); }
    if (!n) this.riseGarbage();
    if (this.dead) return;
    if (above && !n) { this.die(); if (this.dead) return; }
    this.spawn();
  }
  riseGarbage() {
    const A = this.aug; let budget = A && this.has("buffer") ? 4 : RULES.garbagePerLock;
    while (budget > 0 && this.garbage.length && this.garbage[0].m && !this.dead) {
      const g = this.garbage[0];
      if (A && A.sh > 0) { const a = Math.min(A.sh, g.n); g.n -= a; A.sh -= a; this.ev.push({ t: "shield", n: a, left: A.sh }); if (!g.n) { this.garbage.shift(); continue; } }
      const take = Math.min(budget, g.n); g.n -= take; budget -= take; if (!g.n) this.garbage.shift();
      let hole = Math.floor(rngOf((this.seed + Math.imul(++this.gN, 0x2f6e2b1)) | 0)() * COLS); if (A && this.has("clean")) hole = this.seed % COLS;
      if (A && this.has("revenge")) A.rv = Math.min(3, A.rv + 1);
      for (let y = 0; y < take; y++) for (let x = 0; x < COLS; x++) if (this.at(x, y)) this.die();
      if (this.dead) return;
      this.grid.copyWithin(0, take * COLS); for (let y = TOTAL - take; y < TOTAL; y++) for (let x = 0; x < COLS; x++) this.grid[y * COLS + x] = x === hole ? 0 : GARBAGE;
      this.ev.push({ t: "rise", n: take });
    }
  }
  setFloor(level) { this.floor = Math.max(this.startLevel, level | 0); }
  // 시간 진행 (브라우저 전용)
  tick(dt) {
    if (this.dead) return; dt = Math.min(dt, 250); const base = speedMs(this.aug && this.has("slow") ? Math.max(1, this.level - 3) : this.level), ms = this.soft ? Math.min(this.softMs, base) : base; if (this.soft && this.grav > ms) this.grav = ms; this.grav += dt;
    while (this.grav >= ms && !this.dead) { this.grav -= ms; if (!this.down()) { this.grav = 0; break; } }
    if (!this.dead && this.grounded()) { this.lock += dt; if (this.lock >= (this.aug && this.has("lock") ? 900 : RULES.lockMs)) { this.ops += "K"; this.ev.push({ t: "settle" }); this.lockPiece(); } } else this.lock = 0;
  }
  // 조각 하나의 조작 기록을 다시 돌림 (서버 검증). 불가능한 조작이면 false. 정확히 조각 1개를 고정해야 통과
  replay(ops) {
    if (this.dead || typeof ops !== "string" || !(this.aug ? /^[LRABDHQWG]*[XK]$/ : /^[LRABDH]*[XK]$/).test(ops)) return false;
    const before = this.pieces;
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i]; let ok = true;
      if (o === "L") ok = this.move(-1); else if (o === "R") ok = this.move(1); else if (o === "A") ok = this.rotate(1); else if (o === "B") ok = this.rotate(-1); else if (o === "D") ok = this.down(); else if (o === "H") ok = this.useHold();
      else if (AUG_OPS[o]) ok = this.useAbility(o); else if (o === "X") ok = this.hardDrop(); else if (o === "K") { if (!this.grounded()) return false; this.ops += "K"; this.lockPiece(); }
      if (!ok) return false;
      if (this.dead && i < ops.length - 1) return false;
    }
    return this.pieces === before + 1;
  }
  takeEvents() { const e = this.ev; this.ev = []; return e; }
  visible() { return this.grid.subarray(HIDDEN * COLS); }
  height() { for (let y = 0; y < TOTAL; y++) for (let x = 0; x < COLS; x++) if (this.at(x, y)) return TOTAL - y; return 0; }
  hash() { let h = 0x811c9dc5; for (let i = 0; i < this.grid.length; i++) { h ^= this.grid[i]; h = Math.imul(h, 16777619); } h ^= this.score; h = Math.imul(h, 16777619); return (h >>> 0).toString(36); }
  stats() { return { score: this.score, lines: this.lines, level: this.level, combo: Math.max(0, this.combo), pieces: this.pieces, sent: this.sent, maxCombo: this.maxCombo, b2b: this.b2b }; }
  save() { return { seed: this.seed, gN: this.gN, grid: encodeBoard(this.grid), bagN: this.bagN, queue: this.queue.slice(), startLevel: this.startLevel, floor: this.floor, score: this.score, lines: this.lines, pieces: this.pieces, combo: this.combo, maxCombo: this.maxCombo, b2b: this.b2b, sent: this.sent, hold: this.hold, holdUsed: this.holdUsed, garbage: this.garbage.map((x) => ({ ...x })), cur: this.cur ? { ...this.cur } : null, dead: this.dead, ops: this.ops, aug: this.aug ? JSON.parse(JSON.stringify(this.aug)) : null }; }
  static load(o) { const g = new BRGame({ seed: o.seed, startLevel: o.startLevel }); Object.assign(g, { gN: o.gN, bagN: o.bagN, queue: o.queue.slice(), floor: o.floor, score: o.score, lines: o.lines, pieces: o.pieces, combo: o.combo, maxCombo: o.maxCombo, b2b: o.b2b, sent: o.sent, hold: o.hold, holdUsed: o.holdUsed, garbage: o.garbage.map((x) => ({ ...x })), cur: { ...o.cur }, dead: !!o.dead, ops: o.ops || "", ev: [], aug: o.aug ? JSON.parse(JSON.stringify(o.aug)) : null }); decodeBoard(o.grid, g.grid); return g; }
  // ---- 증강
  has(id) { return !!this.aug && this.aug.list.includes(id); }
  augDue() { const A = this.aug; return !!A && !this.dead && A.n < AUG_TH.length && this.lines >= AUG_TH[A.n]; }
  // 고를 후보 3개: 시드·몇 번째 고르기·새로고침 횟수로 정해짐 → 서버와 같음
  augOffer(rr = 0) {
    const A = this.aug; if (!A) return []; const r = rngOf((this.seed ^ Math.imul(A.n + 1, 0x51ed27) ^ Math.imul(rr + 3, 0x2c1b3c6d)) | 0), list = Object.keys(AUGS).filter((id) => !A.list.includes(id) && (A.m !== 2 || AUGS[id].sc)), out = [];
    for (let k = 0; k < 3 && list.length; k++) { let tot = 0; for (const id of list) tot += AUG_W[AUGS[id].r]; let x = r() * tot, pick = list.length - 1; for (let i = 0; i < list.length; i++) { x -= AUG_W[AUGS[list[i]].r]; if (x <= 0) { pick = i; break; } } out.push(list[pick]); list.splice(pick, 1); }
    return out;
  }
  augPick(id, rr = 0) {
    const A = this.aug; if (!this.augDue() || !(rr === 0 || rr === 1) || rr > A.rr || !this.augOffer(rr).includes(id)) return false;
    A.rr -= rr; A.list.push(id); A.n++; const d = AUGS[id]; if (d.op) A.ch[d.op] = (A.ch[d.op] || 0) + d.c; if (id === "shield") A.sh += 10; if (id === "phoenix") A.ph = 1;
    this.ev.push({ t: "aug", id }); return true;
  }
  fixCur() { const c = this.cur; let k = 0; while (!this.free(c.p, c.r, c.x, c.y) && k++ < 6) c.y--; if (!this.free(c.p, c.r, c.x, c.y)) this.die(); }
  // 사용형: Q 바닥 3줄 폭파 · W 지금 조각을 막대로 · G 블록을 아래로 떨어뜨려 빈칸 메우기
  useAbility(op) {
    const A = this.aug; if (!A || this.dead || !(A.ch[op] > 0)) return false; const c = this.cur;
    if (op === "W") { if (c.p === 1) return false; let x = c.x; if (!this.free(1, 0, x, c.y)) { x = 3; if (!this.free(1, 0, x, c.y)) return false; } c.p = 1; c.r = 0; c.x = x; }
    else if (op === "Q") { const k = 3; this.grid.copyWithin(k * COLS, 0, (TOTAL - k) * COLS); this.grid.fill(0, 0, k * COLS); this.fixCur(); }
    else if (op === "G") { for (let x = 0; x < COLS; x++) { const col = []; for (let y = TOTAL - 1; y >= 0; y--) if (this.at(x, y)) col.push(this.at(x, y)); for (let y = TOTAL - 1, i = 0; y >= 0; y--, i++) this.grid[y * COLS + x] = col[i] || 0; } this.fixCur(); }
    else return false;
    A.ch[op]--; this.lastRot = false; this.lock = 0; this.ops += op; this.ev.push({ t: "ability", op }); return true;
  }
  augBonus(n, ts, spin, b2b, perfect, h0, gRows) {
    const A = this.aug; let b = 0; const h = (id) => A.list.includes(id);
    if (h("tetra") && n === 4) b += 2; if (h("spin") && (ts || spin)) b += 1; if (h("combo") && this.combo >= 2) b += 1; if (h("b2b") && b2b) b += 1; if (h("single") && n === 1) b += 1;
    if (h("pc") && perfect) b += 4; if (h("edge") && h0 >= 14) b += 2; if (h("recycle")) b += gRows >> 1; if (h("crown")) b += 1; if (h("revenge") && A.rv) { b += A.rv; A.rv = 0; }
    return b;
  }
}
// 판 줄이기: 맨 위 빈 줄 수 | 줄마다 숫자(뒤쪽 빈칸 생략)
export function encodeBoard(cells, cols = COLS) { const rows = cells.length / cols; let top = 0; for (; top < rows; top++) { let e = true; for (let x = 0; x < cols; x++) if (cells[top * cols + x]) { e = false; break; } if (!e) break; } const out = []; for (let y = top; y < rows; y++) { let s = ""; for (let x = 0; x < cols; x++) s += cells[y * cols + x]; out.push(s.replace(/0+$/, "")); } return top + "|" + out.join(","); }
export function decodeBoard(str, into) { into.fill(0); if (typeof str !== "string") return into; const i = str.indexOf("|"); if (i < 0) return into; const top = +str.slice(0, i) || 0, rows = str.slice(i + 1).split(","), H = into.length / COLS; rows.forEach((s, k) => { const y = top + k; if (y >= H) return; for (let x = 0; x < s.length && x < COLS; x++) { const v = s.charCodeAt(x) - 48; if (v >= 0 && v <= GARBAGE) into[y * COLS + x] = v; } }); return into; }
