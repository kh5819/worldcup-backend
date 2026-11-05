// 플듀 블록로얄 — 게임 규칙 엔진 (화면 없음)
// 브라우저와 서버가 똑같은 파일을 씀(worldcup-backend/src/br-core.js 와 동일해야 함, 시험으로 확인).
// 조작을 글자로 기록(ops) → 서버가 같은 조작을 다시 돌려 이동·회전·줄·점수·공격을 직접 계산한다.
//   L R 이동 · A 시계 회전 · B 반시계 회전 · D 한 칸 내림 · H 보관 · X 바로 내리기 · K 바닥에서 고정
export const RULES = {
  cols: 10, rows: 20, hidden: 4, garbageCell: 8,
  lockMs: 500, lockResets: 15, garbagePerLock: 8,
  score: { line: [0, 100, 300, 500, 800], tspin: [400, 800, 1200, 1600], mini: [100, 200, 400], combo: 50, perfect: 1800, piece: 2 },
  attack: { line: [0, 0, 1, 2, 4], tspin: [0, 2, 4, 6], mini: [0, 0, 1], b2b: 1, perfect: 6, combo: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5] },
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

export class BRGame {
  constructor({ seed = 1, startLevel = 1 } = {}) {
    this.seed = seed >>> 0; this.gN = 0; this.grid = new Uint8Array(COLS * TOTAL); this.bagN = 0; this.queue = [];
    this.startLevel = startLevel; this.floor = startLevel; this.score = 0; this.lines = 0; this.pieces = 0; this.combo = -1; this.maxCombo = 0; this.b2b = false; this.sent = 0; this.hold = 0; this.holdUsed = false; this.garbage = [];
    this.dead = false; this.cur = null; this.grav = 0; this.lock = 0; this.resets = 0; this.soft = false; this.lastRot = false; this.lastKick = 0; this.ev = []; this.ops = ""; this.lastOps = ""; this.fill(); this.spawn();
  }
  get scoreLv() { return this.startLevel + Math.floor(this.lines / 10); }
  get level() { return Math.max(this.floor, this.scoreLv); }
  fill() { while (this.queue.length < 7) { this.queue.push(...bagAt(this.seed, this.bagN)); this.bagN++; } }
  next(n = 5) { return this.queue.slice(0, n); }
  at(x, y) { return this.grid[y * COLS + x]; }
  free(p, r, x, y) { for (const [cx, cy] of SHAPES[p][r]) { const X = x + cx, Y = y + cy; if (X < 0 || X >= COLS || Y >= TOTAL) return false; if (Y >= 0 && this.at(X, Y)) return false; } return true; }
  spawn(forced) {
    const p = forced || this.queue.shift(); this.fill(); const y0 = HIDDEN - 2; this.cur = { p, r: 0, x: 3, y: y0 }; this.grav = 0; this.lock = 0; this.resets = 0; this.lastRot = false; this.lastKick = 0;
    if (!this.free(p, 0, 3, y0)) { this.die(); return false; }
    if (this.free(p, 0, 3, y0 + 1)) this.cur.y = y0 + 1;
    return true;
  }
  die() { if (!this.dead) { this.dead = true; this.ev.push({ t: "dead" }); } }
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
  lockPiece() {
    const c = this.cur, ts = this.tspinKind(); let above = true;
    for (const [cx, cy] of SHAPES[c.p][c.r]) { const X = c.x + cx, Y = c.y + cy; if (Y >= 0) this.grid[Y * COLS + X] = c.p; if (Y >= HIDDEN) above = false; }
    this.pieces++; this.lastOps = this.ops; this.ops = ""; this.holdUsed = false;
    const full = []; for (let y = 0; y < TOTAL; y++) { let ok = true; for (let x = 0; x < COLS; x++) if (!this.at(x, y)) { ok = false; break; } if (ok) full.push(y); }
    const n = full.length, cells = SHAPES[c.p][c.r].map(([cx, cy]) => [c.x + cx, c.y + cy]);
    if (n) { const g = new Uint8Array(COLS * TOTAL); let to = TOTAL - 1; for (let y = TOTAL - 1; y >= 0; y--) { if (full.includes(y)) continue; for (let x = 0; x < COLS; x++) g[to * COLS + x] = this.at(x, y); to--; } this.grid = g; }
    const R = RULES, hard = n === 4 || (ts > 0 && n > 0); let atk = 0; this.score += R.score.piece;
    if (n) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); const lv = this.scoreLv, b2b = hard && this.b2b; this.lines += n;
      const base = ts === 2 ? R.score.tspin[n] : ts === 1 ? R.score.mini[Math.min(n, 2)] : R.score.line[n];
      this.score += Math.round(base * lv * (b2b ? 1.5 : 1)) + (this.combo > 0 ? R.score.combo * this.combo * lv : 0);
      atk = (ts === 2 ? R.attack.tspin[n] : ts === 1 ? R.attack.mini[Math.min(n, 2)] : R.attack.line[n]) + (b2b ? R.attack.b2b : 0) + R.attack.combo[Math.min(this.combo, R.attack.combo.length - 1)];
      const perfect = this.grid.every((v) => !v); if (perfect) { atk += R.attack.perfect; this.score += R.score.perfect * lv; }
      this.b2b = hard;
      this.ev.push({ t: "clear", n, ts, combo: this.combo, perfect, b2b, rows: full, atk });
    } else { this.combo = -1; if (ts) this.score += (ts === 2 ? R.score.tspin[0] : R.score.mini[0]) * this.scoreLv; this.ev.push({ t: "lock", ts, cells }); }
    // 내 공격은 받을 방해 줄부터 막고, 남은 만큼만 상대에게
    while (atk > 0 && this.garbage.length) { const g = this.garbage[0], take = Math.min(atk, g.n); g.n -= take; atk -= take; if (!g.n) this.garbage.shift(); this.ev.push({ t: "cancel", n: take }); }
    if (atk > 0) { this.sent += atk; this.ev.push({ t: "attack", n: atk }); }
    if (!n) this.riseGarbage();
    if (this.dead) return;
    if (above && !n) { this.die(); return; }
    this.spawn();
  }
  riseGarbage() {
    let budget = RULES.garbagePerLock;
    while (budget > 0 && this.garbage.length && this.garbage[0].m && !this.dead) {
      const g = this.garbage[0], take = Math.min(budget, g.n); g.n -= take; budget -= take; if (!g.n) this.garbage.shift();
      const hole = Math.floor(rngOf((this.seed + Math.imul(++this.gN, 0x2f6e2b1)) | 0)() * COLS);
      for (let y = 0; y < take; y++) for (let x = 0; x < COLS; x++) if (this.at(x, y)) this.die();
      if (this.dead) return;
      this.grid.copyWithin(0, take * COLS); for (let y = TOTAL - take; y < TOTAL; y++) for (let x = 0; x < COLS; x++) this.grid[y * COLS + x] = x === hole ? 0 : GARBAGE;
      this.ev.push({ t: "rise", n: take });
    }
  }
  setFloor(level) { this.floor = Math.max(this.startLevel, level | 0); }
  // 시간 진행 (브라우저 전용)
  tick(dt) {
    if (this.dead) return; dt = Math.min(dt, 250); const ms = this.soft ? Math.min(40, speedMs(this.level)) : speedMs(this.level); this.grav += dt;
    while (this.grav >= ms && !this.dead) { this.grav -= ms; if (!this.down()) { this.grav = 0; break; } }
    if (!this.dead && this.grounded()) { this.lock += dt; if (this.lock >= RULES.lockMs) { this.ops += "K"; this.ev.push({ t: "settle" }); this.lockPiece(); } } else this.lock = 0;
  }
  // 조각 하나의 조작 기록을 다시 돌림 (서버 검증). 불가능한 조작이면 false. 정확히 조각 1개를 고정해야 통과
  replay(ops) {
    if (this.dead || typeof ops !== "string" || !/^[LRABDH]*[XK]$/.test(ops)) return false;
    const before = this.pieces;
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i]; let ok = true;
      if (o === "L") ok = this.move(-1); else if (o === "R") ok = this.move(1); else if (o === "A") ok = this.rotate(1); else if (o === "B") ok = this.rotate(-1); else if (o === "D") ok = this.down(); else if (o === "H") ok = this.useHold();
      else if (o === "X") ok = this.hardDrop(); else if (o === "K") { if (!this.grounded()) return false; this.ops += "K"; this.lockPiece(); }
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
  save() { return { seed: this.seed, gN: this.gN, grid: encodeBoard(this.grid), bagN: this.bagN, queue: this.queue.slice(), startLevel: this.startLevel, floor: this.floor, score: this.score, lines: this.lines, pieces: this.pieces, combo: this.combo, maxCombo: this.maxCombo, b2b: this.b2b, sent: this.sent, hold: this.hold, holdUsed: this.holdUsed, garbage: this.garbage.map((x) => ({ ...x })), cur: this.cur ? { ...this.cur } : null, dead: this.dead, ops: this.ops }; }
  static load(o) { const g = new BRGame({ seed: o.seed, startLevel: o.startLevel }); Object.assign(g, { gN: o.gN, bagN: o.bagN, queue: o.queue.slice(), floor: o.floor, score: o.score, lines: o.lines, pieces: o.pieces, combo: o.combo, maxCombo: o.maxCombo, b2b: o.b2b, sent: o.sent, hold: o.hold, holdUsed: o.holdUsed, garbage: o.garbage.map((x) => ({ ...x })), cur: { ...o.cur }, dead: !!o.dead, ops: o.ops || "", ev: [] }); decodeBoard(o.grid, g.grid); return g; }
}
// 판 줄이기: 맨 위 빈 줄 수 | 줄마다 숫자(뒤쪽 빈칸 생략)
export function encodeBoard(cells, cols = COLS) { const rows = cells.length / cols; let top = 0; for (; top < rows; top++) { let e = true; for (let x = 0; x < cols; x++) if (cells[top * cols + x]) { e = false; break; } if (!e) break; } const out = []; for (let y = top; y < rows; y++) { let s = ""; for (let x = 0; x < cols; x++) s += cells[y * cols + x]; out.push(s.replace(/0+$/, "")); } return top + "|" + out.join(","); }
export function decodeBoard(str, into) { into.fill(0); if (typeof str !== "string") return into; const i = str.indexOf("|"); if (i < 0) return into; const top = +str.slice(0, i) || 0, rows = str.slice(i + 1).split(","), H = into.length / COLS; rows.forEach((s, k) => { const y = top + k; if (y >= H) return; for (let x = 0; x < s.length && x < COLS; x++) { const v = s.charCodeAt(x) - 48; if (v >= 0 && v <= GARBAGE) into[y * COLS + x] = v; } }); return into; }
