// =========================
// GUN ARENA — 물리·판정 엔진 (화면·서버 같은 파일)
// · World: 서버(멀티)와 화면(혼자 AI 대전)이 똑같이 돌림. 1틱 = 1/60초
// · stepBody: 한 사람 움직임(달리기·점프·이단 점프·발판·벽·기믹). 화면은 이걸로 내 캐릭터를 먼저 움직여 봄(예측)
// · tryFire: 연사 간격·탄약·반동 (예측도 같이)
// =========================
import { TPS, DT, PHYS, BITS, BLAST, BOMB, WEAPONS, ITEMS, MAPS, RESPAWN_TICKS, SPAWN_INV, TIME_LIMIT, SUDDEN, CRATE_RATE, CRATE_LIFE, KO_CREDIT, BOT_LV, BOT_NAMES, PRESS, PCT, MUZ, buildMap, envAt, platAt, rng, cleanLook } from "./gn-data.js";

const HW = PHYS.w / 2, PH = PHYS.h;
export const READY = 120;
export const EFF_KEYS = ["shield", "speed", "jump", "star", "heavy", "power", "rapid", "jet"];
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 지금 틱의 발판 위치들 (움직이는 발판 반영)
export function platsAt(map, tick) { const t = tick / TPS; return map.plats.map(p => (p.mv ? platAt(p, t) : p)); }
const live = (ctx, k) => !ctx.cr || ctx.cr[k] !== 2;
const has = (p, k, tick) => (p.eff[k] || 0) > tick;

export function newBody(o = {}) {
  return { x: 0, y: 0, vx: 0, vy: 0, face: 1, gnd: -1, jumps: 0, coy: 0, jb: 0, jcut: false, prev: 0, drop: -1, dropT: 0, stun: 0, frz: 0, floatT: 0, eff: {}, w: 0, ammo: -1, cd: 0, bq: 0, bt: 0, spin: 0, slow: false, ...o };
}

// ctx = { map, tick, cr(무너짐 상태), env, P0(이전 틱 발판), P1(지금 발판), fx(효과 목록, 없어도 됨), bot }
export function stepBody(ctx, p, bits) {
  const { map, tick } = ctx, P0 = ctx.P0, P1 = ctx.P1, env = ctx.env;
  const fx = ctx.fx;
  const L = bits & BITS.L, R = bits & BITS.R, J = bits & BITS.J, D = bits & BITS.D;
  const jPress = J && !(p.prev & BITS.J), dPress = D && !(p.prev & BITS.D);
  const frozen = p.frz > tick, stunned = p.stun > tick;
  // 부활 직후 공중에 떠 있기 (아무 키나 누르면 내려옴)
  if (p.floatT > tick) {
    if (bits & (BITS.L | BITS.R | BITS.J | BITS.D)) p.floatT = 0;
    else { p.vx *= 0.8; p.vy = 0; p.prev = bits; return; }
  }
  const g = PHYS.grav * map.grav;
  const ctrl = frozen ? 0 : stunned ? 0.3 : 1;
  const run = PHYS.run * (has(p, "speed", tick) ? 1.4 : 1) * (p.slow ? 0.5 : 1);
  // 서 있던 발판 따라 움직이기 (움직이는 발판)
  let gp = null;
  if (p.gnd >= 0 && live(ctx, p.gnd)) {
    const a = P0[p.gnd], b = P1[p.gnd]; gp = b;
    if (b.mv) { p.x += b.x - a.x; p.y = b.y; }
  } else if (p.gnd >= 0) p.gnd = -1;
  const onG = p.gnd >= 0;
  const ice = (gp && gp.ice) || frozen;
  let dir = ctrl ? (R ? 1 : 0) - (L ? 1 : 0) : 0;
  if (dir && !frozen) p.face = dir;
  // 가로 이동
  const acc = (onG ? PHYS.accG * (ice ? PHYS.iceAcc : 1) : PHYS.accA) * ctrl;
  if (dir) { const v = p.vx * dir; if (v < run) p.vx = Math.min(run, v + acc * DT) * dir; }
  const sp = Math.abs(p.vx), over = sp > run + 0.5;
  if (over) { const f = onG ? PHYS.kbFricG * (ice ? 0.25 : 1) : PHYS.kbFricA; p.vx = sgn(p.vx) * Math.max(run, sp - f * DT); }
  else if (!dir || stunned) { const f = onG ? (stunned ? PHYS.kbFricG * 0.6 : PHYS.fricG) * (ice ? PHYS.iceFric : 1) : PHYS.fricA; p.vx = sgn(p.vx) * Math.max(0, sp - f * DT); }
  // 바람·에어락
  let drift = 0;
  if (env && env.wind) { if (onG) drift += env.wind * 0.2; else p.vx += env.wind * DT; }
  if (gp && gp.cv) drift += gp.cv;
  // 점프
  const maxJ = has(p, "jump", tick) ? 3 : 2, jm = has(p, "jump", tick) ? 1.18 : 1;
  if (onG) { p.coy = tick + PHYS.coyote; p.jumps = maxJ; }
  else if (p.coy <= tick && p.jumps === maxJ) p.jumps = maxJ - 1;
  if (jPress) p.jb = tick + PHYS.jbuf;
  if (p.jb > tick && ctrl) {
    if (onG || (p.coy > tick && p.jumps === maxJ)) { p.vy = -PHYS.jump * jm; p.jumps = maxJ - 1; p.gnd = -1; p.coy = 0; p.jb = 0; p.jcut = !ctx.bot; if (fx) fx.push({ e: "jump", p: p.pid, x: p.x, y: p.y }); }
    else if (jPress && p.jumps > 0) { p.vy = -PHYS.djump * jm; p.jumps--; p.jb = 0; p.jcut = false; if (fx) fx.push({ e: "djump", p: p.pid, x: p.x, y: p.y }); }
  }
  if (p.jcut && !J && p.vy < -250) { p.vy *= 0.55; p.jcut = false; }
  if (p.vy >= 0) p.jcut = false;
  // 아래로 내려가기 (통과 발판)
  if (dPress && onG && gp && gp.t === "p" && ctrl) { p.drop = p.gnd; p.dropT = tick + 14; p.gnd = -1; p.y += 2; }
  const airborne = p.gnd < 0;
  // 제트팩
  let jet = false;
  if (airborne && J && !jPress && has(p, "jet", tick) && ctrl) { p.vy = Math.max(p.vy - 3900 * DT, -560); jet = true; }
  // 중력
  if (airborne && !jet) {
    const fast = D && p.vy > 0 && ctrl;
    const mf = (fast ? PHYS.fastFall : PHYS.maxFall) * (map.grav < 1 ? 0.78 : 1);
    p.vy = Math.min(p.vy + g * (fast ? 1.35 : 1) * DT, Math.max(mf, p.vy));
  }
  // ---- 충돌 ----
  const prevY = p.y;
  // 가로: 단단한 블록 옆면
  let nx = p.x + (p.vx + drift) * DT;
  for (let k = 0; k < P1.length; k++) {
    const b = P1[k]; if (b.t !== "s" || !live(ctx, k)) continue;
    if (p.y > b.y + 0.5 && p.y - PH < b.y + b.h) {
      if (nx + HW > b.x && nx - HW < b.x + b.w) {
        if (p.x <= b.x + b.w / 2) nx = b.x - HW - 0.01; else nx = b.x + b.w + HW + 0.01;
        if (Math.abs(p.vx) > 500 && fx) fx.push({ e: "wall", p: p.pid, x: nx, y: p.y });
        p.vx = 0;
      }
    }
  }
  p.x = nx;
  // 세로
  let ny = p.y + p.vy * DT;
  p.gnd = -1;
  if (p.vy >= 0) {
    let best = -1, bt = Infinity;
    for (let k = 0; k < P1.length; k++) {
      const b = P1[k]; if (b.t === "v" || !live(ctx, k)) continue;
      if (k === p.drop && p.dropT > tick) continue;
      if (p.x + HW <= b.x || p.x - HW >= b.x + b.w) continue;
      const top0 = P0[k].y, top = b.y;
      if (prevY <= Math.max(top0, top) + 2 && ny >= top && top < bt) { bt = top; best = k; }
    }
    if (best >= 0) { if (p.vy > 650 && fx) fx.push({ e: "land", p: p.pid, x: p.x, y: bt }); ny = bt; p.vy = 0; p.gnd = best; }
  } else {
    for (let k = 0; k < P1.length; k++) {
      const b = P1[k]; if (b.t !== "s" || !live(ctx, k)) continue;
      if (p.x + HW <= b.x || p.x - HW >= b.x + b.w) continue;
      const bot = b.y + b.h;
      if (prevY - PH >= bot - 2 && ny - PH < bot) { ny = bot + PH; p.vy = 0; }
    }
  }
  p.y = ny;
  // 환풍구 점프대
  for (let k = 0; k < P1.length; k++) {
    const b = P1[k]; if (b.t !== "v") continue;
    if (p.x + HW > b.x && p.x - HW < b.x + b.w && p.y >= b.y - 12 && p.y <= b.y + b.h + 4 && p.vy >= 0) { p.vy = -b.vent; p.gnd = -1; p.jumps = maxJ - 1; p.coy = 0; if (fx) fx.push({ e: "vent", p: p.pid, x: b.x + b.w / 2, y: b.y }); }
  }
  // 범퍼
  for (const c of map.bump) {
    const cx = clamp(c.x, p.x - HW, p.x + HW), cy = clamp(c.y, p.y - PH, p.y);
    const dx = cx - c.x, dy = cy - c.y, d = Math.hypot(dx, dy);
    if (d < c.r) {
      let nx2 = p.x - c.x, ny2 = (p.y - PH / 2) - c.y; const n = Math.hypot(nx2, ny2) || 1; nx2 /= n; ny2 /= n;
      p.vx = nx2 * 950; p.vy = ny2 * 950 - 120; p.gnd = -1; p.x += nx2 * 4; p.y += ny2 * 4;
      if (fx) fx.push({ e: "bump", x: c.x, y: c.y, p: p.pid });
    }
  }
  p.prev = bits;
}

// 연사·탄약·반동 → 이번 틱에 쏘면 1
export function tryFire(p, bits, tick, onG) {
  const W = WEAPONS[p.w];
  p.slow = false;
  if (p.frz > tick) return 0;
  if (p.bq > 0) { if (tick >= p.bt) { p.bq--; p.bt = tick + Math.max(1, Math.round(W.gap * TPS)); recoil(p, W, onG); return 1; } return 0; }
  if (!(bits & BITS.F)) { p.spin = Math.max(0, p.spin - 2); return 0; }
  if (W.spin) { const need = Math.round(W.spin * TPS); p.spin = Math.min(need, p.spin + 1); p.slow = true; if (p.spin < need) return 0; }
  if (tick < p.cd) return 0;
  const rap = has(p, "rapid", tick) ? 0.55 : 1;
  p.cd = tick + Math.max(2, Math.round(W.cd * TPS * rap));
  if (W.burst) { p.bq = W.burst - 1; p.bt = tick + Math.max(1, Math.round(W.gap * TPS)); }
  recoil(p, W, onG);
  return 1;
}
function recoil(p, W, onG) { if (W.rc) p.vx -= p.face * W.rc * (onG ? 0.6 : 1); }

// 선분(x0,y0)→(x1,y1)과 사각형 [l,t,r,b] → 처음 닿는 비율 0~1 (안 닿으면 -1)
export function segRect(x0, y0, x1, y1, l, t, r, b) {
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  const ch = (p, q) => { if (p === 0) return q >= 0; const u = q / p; if (p < 0) { if (u > t1) return false; if (u > t0) t0 = u; } else { if (u < t0) return false; if (u < t1) t1 = u; } return true; };
  if (ch(-dx, x0 - l) && ch(dx, r - x0) && ch(-dy, y0 - t) && ch(dy, b - y0)) return t0;
  return -1;
}

// ============ World ============
export class World {
  constructor(o) {
    this.seed = o.seed >>> 0; this.R = rng(this.seed);
    this.mapId = o.map; this.map = buildMap(o.map, this.seed);
    this.mode = o.mode === "team" ? "team" : "ffa"; this.lives = clamp(o.lives | 0 || 5, 1, 10); this.items = [0, 1, 2, 3].includes(o.items) ? o.items : 2; this.pct = o.pct !== false; this.practice = !!o.practice;
    this.ready = o.ready ?? READY; this.tick = 0; this.status = "play"; this.result = null; this.ev = []; this.idSeq = 1; this.sudden = false;
    this.B = []; this.O = []; this.C = []; this.H = [];
    this.cr = this.map.plats.map(() => 0); this.crT = this.map.plats.map(() => 0);
    this.P0 = platsAt(this.map, 0); this.P1 = this.P0; this.env = envAt(this.map, this.seed, 0);
    this.nextCrate = Math.round(2.5 * TPS); this.nextIce = 3 * TPS; this.outN = 0; this.pressCyc = -1;
    this.P = []; this.byId = new Map();
    (o.players || []).forEach((q, i) => this.addPlayer(q, i));
    this.P.forEach((p, i) => this.spawnAt(p, i, true));
  }
  addPlayer(q, i) {
    const p = newBody({ pid: i + 1, id: q.id || null, name: String(q.name || BOT_NAMES[i % BOT_NAMES.length]).slice(0, 12), team: this.mode === "team" ? (q.team | 0) % 2 : i, look: cleanLook(q.look), bot: q.bot && BOT_LV[q.bot] ? q.bot : null, human: !q.bot,
      lives: q.dummy ? 99 : this.lives, dummy: !!q.dummy, pct: 0, st: "alive", rt: 0, inv: 0, bombs: BOMB.start, bcd: 0, lastHit: -9999, lastBy: 0, kos: 0, falls: 0, shots: 0, hits: 0, place: 0, inq: [], bits: 0, ack: 0, alt: 0, shieldN: 0, brain: null, pressHit: -1, outAt: 0, kbGiven: 0 });
    this.P.push(p); if (p.id) this.byId.set(p.id, p);
    return p;
  }
  get t() { return this.tick / TPS; }
  enemy(a, b) { return a !== b && (this.mode !== "team" || a.team !== b.team); }
  // 부활 위치: 적과 가장 먼 곳, 위에서 잠깐 떠 있음
  spawnAt(p, i, first) {
    const sp = this.map.spawn; let pt = sp[i % sp.length];
    if (!first) {
      let best = -1;
      for (const s of sp) {
        if (!this.groundBelow(s[0], s[1] - 4)) continue;
        let d = 1e9; for (const q of this.P) if (q !== p && q.st === "alive") d = Math.min(d, Math.hypot(q.x - s[0], q.y - s[1]));
        d += this.R() * 40; if (d > best) { best = d; pt = s; }
      }
    }
    if (p.dummy) pt = [1060, 660]; // 샌드백은 늘 같은 자리
    Object.assign(p, { x: pt[0], y: first ? pt[1] : pt[1] - 110, vx: 0, vy: 0, gnd: -1, st: "alive", inv: this.tick + (first ? 60 : SPAWN_INV), floatT: first ? 0 : this.tick + 120, w: 0, ammo: -1, cd: 0, bq: 0, spin: 0, bombs: BOMB.start, eff: {}, shieldN: 0, frz: 0, stun: 0, jumps: 2, drop: -1, face: pt[0] < 800 ? 1 : -1, lastBy: 0, pct: 0 });
    if (p.dummy) { p.floatT = 0; p.inv = 0; p.face = -1; }
    if (!first) this.ev.push({ e: "spawn", p: p.pid, x: p.x, y: p.y });
  }
  groundBelow(x, y, P = this.P1) {
    let best = null;
    for (let k = 0; k < P.length; k++) { const b = P[k]; if (b.t === "v" || this.cr[k] === 2) continue; if (x < b.x || x > b.x + b.w || b.y < y) continue; if (!best || b.y < best.top) best = { k, top: b.y, b }; }
    return best;
  }
  input(id, s, bitsArr) {
    const p = this.byId.get(id); if (!p || !p.human) return;
    if (!Array.isArray(bitsArr)) return;
    const n = bitsArr.length; // 마지막 원소가 seq s
    for (let i = 0; i < n; i++) { const seq = s - (n - 1 - i), b = bitsArr[i] & 63; if (seq > p.lastSeq || p.lastSeq === undefined) { p.inq.push({ s: seq, b }); p.lastSeq = seq; } }
    if (p.inq.length > 10) p.inq.splice(0, p.inq.length - 4);
  }
  // ---------- 한 틱 ----------
  step() {
    if (this.status !== "play") return;
    this.tick++;
    const tick = this.tick;
    this.P0 = this.P1; this.P1 = platsAt(this.map, tick); this.env = envAt(this.map, this.seed, tick / TPS);
    if (!this.sudden && tick >= SUDDEN * TPS) { this.sudden = true; this.ev.push({ e: "sudden" }); }
    // 무너지는 발판
    for (let k = 0; k < this.cr.length; k++) {
      if (this.cr[k] === 1 && tick >= this.crT[k]) { this.cr[k] = 2; this.crT[k] = tick + 5 * TPS; const b = this.P1[k]; this.ev.push({ e: "crumble", k, x: b.x + b.w / 2, y: b.y }); }
      else if (this.cr[k] === 2 && tick >= this.crT[k]) {
        const b = this.P1[k];
        if (!this.P.some(p => p.st === "alive" && p.x + HW > b.x && p.x - HW < b.x + b.w && p.y > b.y - 4 && p.y - PH < b.y + b.h)) { this.cr[k] = 0; this.ev.push({ e: "restore", k }); }
      }
    }
    const ctx = { map: this.map, tick, cr: this.cr, env: this.env, P0: this.P0, P1: this.P1, fx: this.ev, bot: false };
    for (const p of this.P) {
      if (p.st === "dead") { if (tick >= p.rt) this.spawnAt(p, p.pid - 1, false); continue; }
      if (p.st !== "alive") continue;
      let bits;
      if (p.bot) bits = this.botBits(p);
      else if (p.inq.length) { const q = p.inq.shift(); bits = q.b; p.ack = q.s; p.bits = bits; }
      else bits = p.bits;
      if (p.st !== "alive") continue;
      if (tick <= this.ready) bits = 0; // 시작 카운트다운 (2초) 동안은 못 움직임
      ctx.bot = !!p.bot;
      const onG0 = p.gnd >= 0;
      if (tryFire(p, bits, tick, onG0)) this.shoot(p);
      stepBody(ctx, p, bits);
      if (p.gnd >= 0 && this.map.plats[p.gnd].cr && this.cr[p.gnd] === 0) { this.cr[p.gnd] = 1; this.crT[p.gnd] = tick + 32; }
      if ((bits & BITS.B) && !(p.prevB) && p.bombs > 0 && tick >= p.bcd && p.frz <= tick) this.throwBomb(p);
      p.prevB = bits & BITS.B;
      if (this.env.lavaY < 2000 && p.y > this.env.lavaY + 6) { this.ev.push({ e: "burn", p: p.pid, x: Math.round(p.x), y: Math.round(this.env.lavaY) }); this.ko(p); } // 차오른 용암 = 탈락
      else if (p.x < BLAST.l || p.x > BLAST.r || p.y > BLAST.b || p.y < BLAST.t) this.ko(p);
    }
    this.stepBullets(); this.stepObjects(); this.stepCrates(); this.stepHazards();
    this.checkEnd();
  }
  // ---------- 사격 ----------
  shoot(p) {
    const W = WEAPONS[p.w], tick = this.tick;
    p.shots++;
    const mx = p.x + p.face * MUZ.x;
    let my = p.y - MUZ.y;
    if (W.dual) { p.alt ^= 1; my += p.alt ? -3 : 3; }
    const pw = this.kbMul(p);
    this.ev.push({ e: "shot", p: p.pid, w: p.w, x: Math.round(mx), y: Math.round(my), f: p.face });
    if (W.k === "hitscan") this.hitscan(p, W, mx, my, pw);
    else if (W.k === "mine") {
      const mine = this.O.filter(o => o.k === "mine" && o.o === p.pid);
      if (mine.length >= 4) this.O.splice(this.O.indexOf(mine[0]), 1);
      this.O.push({ id: this.idSeq++, k: "mine", o: p.pid, tm: p.team, x: p.x + p.face * 10, y: p.y - 6, vx: p.vx * 0.3, vy: 0, arm: tick + Math.round(W.arm * TPS), ttl: tick + W.life * TPS, gk: -1, kb: W.kb * pw, r: W.r });
    } else {
      const n = W.n2 || 1;
      for (let i = 0; i < n; i++) {
        const spread = (W.sp || 0) * (n > 1 ? (i / (n - 1) - 0.5) * 2 + (this.R() - 0.5) * 0.5 : (this.R() - 0.5) * 2);
        let a = (W.up ? -W.up : 0) + spread;
        const spd = W.spd * (n > 1 ? 0.85 + this.R() * 0.3 : 1);
        let vx = Math.cos(a) * spd * p.face, vy = Math.sin(a) * spd;
        if (W.k === "nade") vx += p.vx * 0.3;
        this.B.push({ id: this.idSeq++, k: W.k, w: p.w, o: p.pid, tm: p.team, x: mx, y: my, vx, vy, life: Math.round(W.life * TPS * (W.k === "flame" ? 0.8 + this.R() * 0.4 : 1)), age: 0, kb: W.kb * pw, nb: W.nb || 0, hit: null, back: false });
      }
    }
    if (p.ammo > 0) { p.ammo--; if (p.ammo === 0) { this.ev.push({ e: "empty", p: p.pid }); p.w = 0; p.ammo = -1; p.bq = 0; p.spin = 0; } }
  }
  kbMul(p) { return (has(p, "power", this.tick) ? 1.5 : 1) * (this.sudden ? 1.5 : 1); }
  hitscan(p, W, mx, my, pw) {
    let len = W.len, x2 = mx + p.face * len;
    for (let k = 0; k < this.P1.length; k++) { const b = this.P1[k]; if (b.t !== "s" || this.cr[k] === 2) continue; const u = segRect(mx, my, x2, my, b.x, b.y, b.x + b.w, b.y + b.h); if (u >= 0 && u * len < len) len = u * len; }
    x2 = mx + p.face * len;
    const hits = [];
    for (const q of this.P) { if (q.st !== "alive" || !this.enemy(p, q)) continue; const u = segRect(mx, my, x2, my, q.x - HW - 2, q.y - PH, q.x + HW + 2, q.y); if (u >= 0) hits.push([u, q]); }
    hits.sort((a, b) => a[0] - b[0]);
    let endX = x2;
    for (const [u, q] of hits) {
      this.hitPlayer(q, p, p.face * W.kb * pw, -Math.min(W.kb * 0.16, 240), mx + p.face * u * len, my, W);
      if (!W.pierce) { endX = mx + p.face * u * len; break; }
    }
    this.ev.push({ e: "beam", w: p.w, x1: Math.round(mx), y1: Math.round(my), x2: Math.round(endX), p: p.pid });
  }
  // 넉백 주기 (방어막·무적·강철 부츠 반영)
  hitPlayer(q, by, kx, ky, x, y, W) {
    const tick = this.tick;
    if (q.inv > tick || has(q, "star", tick)) { this.ev.push({ e: "block", x: Math.round(x), y: Math.round(y), p: q.pid }); return false; }
    if (has(q, "shield", tick) && q.shieldN > 0) { q.shieldN--; if (q.shieldN <= 0) q.eff.shield = 0; this.ev.push({ e: "shield", x: Math.round(x), y: Math.round(y), p: q.pid, n: q.shieldN }); return false; }
    const m = (has(q, "heavy", tick) ? 0.5 : 1) * 1.15 * (this.pct ? PCT.base + q.pct / PCT.div : 1);
    if (this.pct) q.pct = Math.min(PCT.max, q.pct + Math.hypot(kx, ky) * PCT.gain * (has(q, "heavy", tick) ? 0.5 : 1));
    q.vx += kx * m; q.vy = Math.min(q.vy, 0) + ky * m;
    if (ky < -1) q.gnd = -1;
    q.stun = tick + Math.round(clamp(Math.hypot(kx, ky) * m / 2600, 0.08, 0.4) * TPS);
    q.floatT = 0;
    if (by) { q.lastBy = by.pid; q.lastHit = tick; by.hits++; by.kbGiven += Math.hypot(kx, ky) * m; }
    if (W && W.frz) { q.frz = tick + Math.round(W.frz * TPS); this.ev.push({ e: "frz", p: q.pid }); }
    this.ev.push({ e: "hit", p: q.pid, by: by ? by.pid : 0, x: Math.round(x), y: Math.round(y), k: Math.round(Math.hypot(kx, ky) * m), d: sgn(kx), pc: Math.round(q.pct) });
    return true;
  }
  explode(x, y, r, kb, owner) {
    this.ev.push({ e: "boom", x: Math.round(x), y: Math.round(y), r });
    const by = owner ? this.P[owner - 1] : null;
    for (const q of this.P) {
      if (q.st !== "alive") continue;
      if (by && q !== by && !this.enemy(by, q)) continue;
      const cx = q.x, cy = q.y - PH / 2, dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy);
      if (d > r + 14) continue;
      const f = kb * (1 - 0.45 * Math.min(1, d / r)) * (q === by ? 0.65 : 1);
      const nx = d > 1 ? dx / d : 0, ny = d > 1 ? dy / d : -1;
      this.hitPlayer(q, q === by ? null : by, nx * f, ny * f * 0.7 - f * 0.35, cx, cy, null);
    }
    // 근처 폭탄·지뢰 연쇄
    for (const o of this.O) if (Math.hypot(o.x - x, o.y - y) < r * 0.9) { if (o.k === "bomb") o.fuse = Math.min(o.fuse, this.tick + 4); if (o.k === "mine") o.arm = -1, o.boom = this.tick + 4; }
  }
  throwBomb(p) {
    p.bombs--; p.bcd = this.tick + BOMB.cd;
    this.O.push({ id: this.idSeq++, k: "bomb", o: p.pid, tm: p.team, x: p.x + p.face * 14, y: p.y - 26, vx: p.face * BOMB.spd + p.vx * 0.5, vy: -BOMB.up + Math.min(0, p.vy * 0.3), fuse: this.tick + BOMB.fuse, gk: -1, kb: BOMB.kb * this.kbMul(p), r: BOMB.r });
    this.ev.push({ e: "throw", p: p.pid, x: Math.round(p.x), y: Math.round(p.y) });
  }
  // ---------- 총알 ----------
  stepBullets() {
    const tick = this.tick, B = this.B;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.age++;
      const x0 = b.x, y0 = b.y;
      const W = WEAPONS[b.w];
      if (b.k === "nade") b.vy += W.g * DT;
      else if (b.k === "rocket") { const s = Math.min(W.max, Math.abs(b.vx) + W.acc * DT); b.vx = sgn(b.vx) * s; if (b.age % 3 === 0) this.ev.push({ e: "trail", x: Math.round(b.x), y: Math.round(b.y) }); }
      else if (b.k === "boom") {
        const o = this.P[b.o - 1];
        if (b.age > b.life * 0.42) b.back = true;
        if (b.back && o && o.st === "alive") { const dx = o.x - b.x, dy = (o.y - 22) - b.y, d = Math.hypot(dx, dy) || 1; b.vx += dx / d * 3400 * DT; b.vy += dy / d * 3400 * DT; const s = Math.hypot(b.vx, b.vy); if (s > 1250) { b.vx *= 1250 / s; b.vy *= 1250 / s; } if (d < 26) { B.splice(i, 1); continue; } }
        else if (!b.back) { b.vx *= 0.985; }
      } else if (b.k === "flame" || b.k === "wind") { b.vx *= (b.k === "flame" ? 0.97 : 0.975); b.vy = b.vy * 0.96 - (b.k === "flame" ? 220 * DT : 0); }
      b.x += b.vx * DT; b.y += b.vy * DT;
      let dead = b.age > b.life;
      // 벽·발판
      if (!dead && b.k !== "wind" && b.k !== "boom") {
        for (let k = 0; k < this.P1.length; k++) {
          const s = this.P1[k]; if (s.t === "v" || this.cr[k] === 2) continue;
          const solidHit = s.t === "s" || b.k === "nade" || b.k === "bounce";
          if (!solidHit) continue;
          if (s.t === "p" && b.k === "nade" && !(y0 <= s.y && b.y >= s.y)) continue; // 통과 발판은 위에서 떨어질 때만
          const u = segRect(x0, y0, b.x, b.y, s.x, s.y, s.x + s.w, s.y + s.h); if (u < 0) continue;
          const hx = x0 + (b.x - x0) * u, hy = y0 + (b.y - y0) * u;
          if (b.k === "bounce" && b.nb > 0) {
            b.nb--; const fromSide = hx <= s.x + 0.5 || hx >= s.x + s.w - 0.5;
            if (fromSide && !(hy <= s.y + 0.5 || hy >= s.y + s.h - 0.5)) { b.vx = -b.vx; b.x = hx + sgn(b.vx) * 1; b.y = hy; } else { b.vy = -b.vy; b.y = hy + sgn(b.vy) * 1; b.x = hx; }
            if (b.vy === 0) b.vy = -0.0001;
            this.ev.push({ e: "ric", x: Math.round(hx), y: Math.round(hy) });
          } else if (b.k === "nade" || b.k === "rocket") { this.explode(hx, hy, W.r, b.kb, b.o); dead = true; b.boomed = true; }
          else { this.ev.push({ e: "spark", x: Math.round(hx), y: Math.round(hy), w: b.w }); dead = true; }
          break;
        }
      }
      // 사람
      if (!dead) {
        const o = this.P[b.o - 1];
        for (const q of this.P) {
          if (q.st !== "alive" || !o || !this.enemy(o, q)) continue;
          if (b.hit && b.hit.has(q.pid)) continue;
          const u = segRect(x0, y0, b.x, b.y, q.x - HW - 1, q.y - PH, q.x + HW + 1, q.y); if (u < 0) continue;
          const hx = x0 + (b.x - x0) * u, hy = y0 + (b.y - y0) * u;
          if (b.k === "nade" || b.k === "rocket") { this.explode(hx, hy, W.r, b.kb, b.o); dead = true; break; }
          const sp = Math.hypot(b.vx, b.vy) || 1, d = sgn(b.vx) || o.face;
          const lift = b.kb >= 400 ? -Math.min(b.kb * 0.2, 240) : b.k === "wind" ? -90 : 0;
          const kx = b.k === "boom" ? (b.vx / sp) * b.kb : d * b.kb;
          this.hitPlayer(q, o, kx, lift, hx, hy, W);
          if (b.k === "flame" || b.k === "wind" || b.k === "boom") { (b.hit ||= new Set()).add(q.pid); continue; }
          dead = true; break;
        }
      }
      if (!dead && (b.x < BLAST.l - 200 || b.x > BLAST.r + 200 || b.y > BLAST.b + 100 || b.y < BLAST.t)) dead = true;
      if (dead) { if (!b.boomed && b.k === "nade" && b.age > b.life) this.explode(b.x, b.y, W.r, b.kb, b.o); B.splice(i, 1); }
    }
    if (B.length > 260) B.splice(0, B.length - 260);
  }
  // ---------- 폭탄·지뢰 ----------
  landObj(o, h) {
    const y0 = o.y; o.vy = Math.min(o.vy + 1800 * DT, 1100);
    if (o.gk >= 0 && this.cr[o.gk] !== 2) { const a = this.P0[o.gk], b = this.P1[o.gk]; o.x += b.x - a.x; o.y = b.y; if (o.vy > 0) o.vy = 0; }
    else o.gk = -1;
    o.x += o.vx * DT; o.y += o.vy * DT;
    // 단단한 블록 옆면
    for (let k = 0; k < this.P1.length; k++) { const s = this.P1[k]; if (s.t !== "s" || this.cr[k] === 2) continue; if (y0 > s.y + 1 && y0 - h < s.y + s.h && o.x > s.x && o.x < s.x + s.w) { const xp = o.x - o.vx * DT; o.x = xp <= s.x + s.w / 2 ? s.x - 1 : s.x + s.w + 1; o.vx = -o.vx * 0.4; } }
    if (o.vy >= 0) {
      for (let k = 0; k < this.P1.length; k++) {
        const s = this.P1[k]; if (s.t === "v" || this.cr[k] === 2) continue;
        if (o.x < s.x || o.x > s.x + s.w) continue;
        if (y0 <= Math.max(this.P0[k].y, s.y) + 2 && o.y >= s.y) {
          o.y = s.y;
          if (o.k === "bomb" && o.vy > 240) { o.vy = -o.vy * 0.38; o.vx *= 0.75; this.ev.push({ e: "bounce", x: Math.round(o.x), y: Math.round(o.y) }); }
          else { o.vy = 0; o.vx *= o.k === "bomb" ? 0.86 : 0.5; o.gk = k; }
          break;
        }
      }
    }
  }
  stepObjects() {
    const tick = this.tick;
    for (let i = this.O.length - 1; i >= 0; i--) {
      const o = this.O[i];
      this.landObj(o, 8);
      if (o.y > BLAST.b) { this.O.splice(i, 1); continue; }
      if (o.k === "bomb") { if (tick >= o.fuse) { this.O.splice(i, 1); this.explode(o.x, o.y - 8, o.r, o.kb, o.o); } continue; }
      if (o.k === "mine") {
        let go = o.boom && tick >= o.boom;
        if (!go && o.arm >= 0 && tick >= o.arm) { const ow = this.P[o.o - 1]; for (const q of this.P) { if (q.st !== "alive" || (ow && !this.enemy(ow, q))) continue; if (Math.abs(q.x - o.x) < HW + 12 && q.y > o.y - 50 && q.y - PH < o.y + 6) { go = true; break; } } }
        if (go || tick >= o.ttl) { this.O.splice(i, 1); this.explode(o.x, o.y - 6, o.r, o.kb, o.o); }
      }
    }
  }
  // ---------- 상자 ----------
  stepCrates() {
    const tick = this.tick, rate = CRATE_RATE[this.items] * (this.sudden ? 0.6 : 1);
    if (rate && tick >= this.nextCrate) {
      this.nextCrate = tick + Math.round(rate * TPS * (0.75 + this.R() * 0.5));
      if (this.C.length < 3) {
        const cand = this.P1.map((b, k) => ({ b, k })).filter(({ b, k }) => b.t !== "v" && this.cr[k] === 0 && b.w >= 70 && b.y > 120);
        if (cand.length) {
          const { b } = cand[Math.floor(this.R() * cand.length)];
          const isW = this.R() < 0.58;
          const v = isW ? this.pickW() : this.pickI();
          this.C.push({ id: this.idSeq++, k: isW ? "w" : "i", v, x: b.x + 24 + this.R() * (b.w - 48), y: -60, vy: 0, vx: 0, gk: -1, ttl: tick + CRATE_LIFE * TPS, landed: false });
        }
      }
    }
    for (let i = this.C.length - 1; i >= 0; i--) {
      const c = this.C[i];
      if (!c.landed) { const y0 = c.y; c.y += 240 * DT; for (let k = 0; k < this.P1.length; k++) { const s = this.P1[k]; if (s.t === "v" || this.cr[k] === 2) continue; if (c.x < s.x || c.x > s.x + s.w) continue; if (y0 <= s.y + 2 && c.y >= s.y) { c.y = s.y; c.landed = true; c.gk = k; this.ev.push({ e: "cland", x: Math.round(c.x), y: Math.round(c.y) }); break; } } }
      else {
        if (c.gk >= 0 && this.cr[c.gk] !== 2) { const a = this.P0[c.gk], b = this.P1[c.gk]; c.x += b.x - a.x; c.y = b.y; if (this.map.plats[c.gk].cv) c.x += this.map.plats[c.gk].cv * DT; }
        else { c.landed = false; c.gk = -1; }
      }
      if (c.y > BLAST.b || tick >= c.ttl) { this.C.splice(i, 1); continue; }
      for (const p of this.P) {
        if (p.st !== "alive") continue;
        if (Math.abs(p.x - c.x) < HW + 14 && p.y > c.y - 30 && p.y - PH < c.y) { this.pick(p, c); this.C.splice(i, 1); break; }
      }
    }
  }
  pickW() { let s = 0; for (const w of WEAPONS) s += w.w; let r = this.R() * s; for (let i = 0; i < WEAPONS.length; i++) { r -= WEAPONS[i].w; if (r < 0) return i; } return 1; }
  pickI() { let s = 0; const ok = ITEMS.map((it) => (it.id === "life" && !this.P.some(p => p.st === "alive" && p.lives < this.lives + 2) ? 0 : it.w)); for (const w of ok) s += w; let r = this.R() * s; for (let i = 0; i < ITEMS.length; i++) { r -= ok[i]; if (r < 0) return i; } return 0; }
  pick(p, c) {
    const tick = this.tick;
    if (c.k === "w") { const W = WEAPONS[c.v]; p.w = c.v; p.ammo = W.ammo; p.cd = tick + 6; p.bq = 0; p.spin = 0; }
    else {
      const it = ITEMS[c.v];
      if (it.id === "bomb") p.bombs = Math.min(BOMB.max, p.bombs + 2);
      else if (it.id === "life") p.lives = Math.min(this.lives + 2, p.lives + 1);
      else { p.eff[it.id] = tick + it.dur * TPS; if (it.id === "shield") p.shieldN = it.hits; }
    }
    this.ev.push({ e: "pick", p: p.pid, k: c.k, v: c.v, x: Math.round(c.x), y: Math.round(c.y) });
  }
  // ---------- 기믹 (고드름·프레스) ----------
  stepHazards() {
    const tick = this.tick, o = this.map.opt;
    if (o.icicle && tick >= this.nextIce) {
      this.nextIce = tick + Math.round((2.2 + this.R() * 1.8) * TPS);
      this.H.push({ id: this.idSeq++, k: "ice", x: 260 + Math.round(this.R() * 1080), y: 96, vy: 0, fall: tick + 50 });
    }
    for (let i = this.H.length - 1; i >= 0; i--) {
      const h = this.H[i]; if (tick < h.fall) continue;
      const y0 = h.y; h.vy = Math.min(h.vy + 2100 * DT, 1300); h.y += h.vy * DT;
      let gone = false;
      for (const p of this.P) { if (p.st !== "alive") continue; if (Math.abs(p.x - h.x) < HW + 8 && h.y > p.y - PH && h.y - 30 < p.y) { this.hitPlayer(p, null, sgn(p.x - h.x || 1) * 320, 0, h.x, h.y, null); p.vy = Math.max(p.vy, 780); p.gnd = -1; gone = true; break; } }
      if (!gone) for (let k = 0; k < this.P1.length; k++) { const s = this.P1[k]; if (s.t === "v" || this.cr[k] === 2) continue; if (h.x < s.x || h.x > s.x + s.w) continue; if (y0 <= s.y && h.y >= s.y) { gone = true; break; } }
      if (gone || h.y > BLAST.b) { this.ev.push({ e: "shatter", x: Math.round(h.x), y: Math.round(Math.min(h.y, 1000)) }); this.H.splice(i, 1); }
    }
    if (o.press && this.env.pressHot) {
      const cyc = Math.floor((this.t - 5) / PRESS.per);
      for (const p of this.P) {
        if (p.st !== "alive" || p.pressHit === cyc) continue;
        if (p.x + HW > PRESS.x && p.x - HW < PRESS.x + PRESS.w && p.y > 300 && p.y - PH < PRESS.bot + 20) {
          p.pressHit = cyc; this.hitPlayer(p, null, sgn(p.x - (PRESS.x + PRESS.w / 2)) * 260, 0, p.x, p.y - 20, null); p.vy = PRESS.kb; p.gnd = -1; p.drop = -1;
          this.ev.push({ e: "crush", p: p.pid, x: Math.round(p.x), y: Math.round(p.y) });
        }
      }
    }
  }
  // ---------- 탈락 ----------
  ko(p) {
    const tick = this.tick;
    const by = p.lastBy && tick - p.lastHit < KO_CREDIT * TPS ? this.P[p.lastBy - 1] : null;
    if (by && by !== p) by.kos++;
    p.falls++; p.lives--; if (p.dummy) p.lives = 99;
    this.ev.push({ e: "ko", p: p.pid, by: by ? by.pid : 0, x: Math.round(clamp(p.x, BLAST.l + 40, BLAST.r - 40)), y: Math.round(clamp(p.y, BLAST.t + 40, BLAST.b - 40)), side: p.x < BLAST.l ? "l" : p.x > BLAST.r ? "r" : p.y < BLAST.t ? "t" : "b", lives: p.lives });
    p.vx = 0; p.vy = 0; p.eff = {}; p.bq = 0; p.spin = 0; p.inq.length = 0;
    if (p.lives <= 0) { p.st = "out"; p.outAt = tick; p.place = ++this.outN; this.ev.push({ e: "out", p: p.pid }); }
    else { p.st = "dead"; p.rt = tick + RESPAWN_TICKS; }
    // 내 폭탄·지뢰는 그대로 (터지면 그 사람 처치)
  }
  removeHuman(id) { const p = this.byId.get(id); if (!p || p.st === "out") return; p.lives = 1; this.ko(p); p.left = true; }
  checkEnd() {
    if (this.status !== "play" || this.practice) return;
    const alive = this.P.filter(p => p.st !== "out");
    const teams = new Set(alive.map(p => p.team));
    let done = false, winner = null;
    if (this.P.length >= 2 && teams.size <= 1) { done = true; winner = alive.length ? alive[0].team : null; }
    if (this.P.length < 2 && !alive.length) { done = true; }
    if (!done && this.tick >= TIME_LIMIT * TPS) {
      done = true;
      const score = new Map(); for (const p of alive) score.set(p.team, (score.get(p.team) || 0) + p.lives);
      let best = -1, tie = false; for (const [t, s] of score) { if (s > best) { best = s; winner = t; tie = false; } else if (s === best) tie = true; }
      if (tie) winner = null;
    }
    if (!done) return;
    this.status = "end";
    const rows = this.P.map(p => ({ pid: p.pid, id: p.id, name: p.name, team: p.team, bot: p.bot, human: p.human, look: p.look, kos: p.kos, falls: p.falls, shots: p.shots, hits: p.hits, lives: Math.max(0, p.lives), win: winner !== null && p.team === winner, outAt: p.st === "out" ? p.outAt : Infinity, kb: Math.round(p.kbGiven) }));
    rows.sort((a, b) => (b.win - a.win) || (b.outAt - a.outAt) || (b.lives - a.lives) || (b.kos - a.kos));
    rows.forEach((r, i) => { r.rank = i + 1; if (r.outAt === Infinity) r.outAt = null; });
    this.result = { winner, mode: this.mode, rows, time: Math.round(this.t), map: this.mapId, draw: winner === null };
    this.ev.push({ e: "end" });
  }
  // ---------- AI ----------
  botBits(p) {
    const tick = this.tick, LV = BOT_LV[p.bot], B = p.brain || (p.brain = { next: 0, bits: 0, tgt: 0, strafe: 0, hop: 0, idle: 0 });
    if (tick < B.next) { let b = B.bits; if (B.hop && tick >= B.hop) { b &= ~BITS.J; } return b; }
    B.next = tick + LV.think + Math.floor(this.R() * 3);
    const R = this.R, W = WEAPONS[p.w], hard = p.bot === "hard", easy = p.bot === "easy";
    let bits = 0, mv = 0, wantJ = false, wantD = false;
    const onG = p.gnd >= 0, under = this.groundBelow(p.x, p.y - 2);
    const env = this.env;
    // 초급은 가끔 멈춰서 멍하니 (쉽게)
    const safeSpot = onG && !env.warn && !env.wind && !(this.P1[p.gnd] && this.P1[p.gnd].cv) && !this.P1[p.gnd]?.cr && this.groundBelow(p.x - 70, p.y - 2) && this.groundBelow(p.x + 70, p.y - 2);
    if (easy && tick < B.idle && safeSpot) { B.bits = 0; return 0; }
    if (easy && safeSpot && R() < 0.04) { B.idle = tick + 30 + Math.floor(R() * 40); }
    // 1) 떨어지는 중이면 복귀가 먼저
    if (!onG && (!under || under.top - p.y > 520)) {
      let best = null, bd = 1e9;
      for (let k = 0; k < this.P1.length; k++) { const b = this.P1[k]; if (b.t === "v" || this.cr[k] === 2) continue; if (env.lavaY < 900 && b.y > env.lavaY - 30) continue; const cx = clamp(p.x, b.x + 18, b.x + b.w - 18); const d = Math.abs(cx - p.x) + Math.max(0, p.y - b.y) * 0.6; if (d < bd) { bd = d; best = { cx, top: b.y }; } }
      B.next = tick + Math.min(LV.think, 5); // 떨어질 땐 초급도 빨리 판단
      if (best) { mv = sgn(best.cx - p.x); if (p.vy > -80 && p.jumps > 0 && p.y > best.top - 90) wantJ = true; }
      else mv = sgn(800 - p.x);
    } else {
      // 2) 목표: 상자 → 적
      let goal = null, gk = "enemy";
      const crates = this.C.filter(c => c.landed && Math.abs(c.y - p.y) < 220 && Math.abs(c.x - p.x) < 750);
      const good = (c) => c.k === "w" ? WEAPONS[c.v].w <= 5 : ["star", "shield", "life", "power"].includes(ITEMS[c.v].id);
      const want = (c) => easy ? p.w === 0 && R() < 0.5 : p.w === 0 || (p.ammo > 0 && p.ammo < 4) || (hard && good(c)) || R() < 0.12;
      const cs = crates.filter(want);
      if (cs.length) { cs.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)); goal = cs[0]; gk = "crate"; }
      if (!goal) {
        let bd = 1e9;
        for (const q of this.P) {
          if (q.st !== "alive" || !this.enemy(p, q)) continue;
          let d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y) * 1.6; if (q.pid === B.tgt) d *= 0.75;
          if (hard) { if (q.x < 380 || q.x > 1220) d *= 0.75; d *= 1 - Math.min(0.4, q.pct / 400); if (q.inv > tick) d *= 1.6; } // 고급: 끝에 있거나 %가 높은 상대부터
          if (d < bd) { bd = d; goal = q; }
        }
        if (goal) B.tgt = goal.pid;
      }
      // 용암·프레스 피하기
      let hazGoal = null;
      if (env.warn === "lava" || env.lavaY < 900) { let hi = null; for (let k = 0; k < this.P1.length; k++) { const b = this.P1[k]; if (b.t === "s" && b.y >= 600) continue; if (b.y > 560) continue; const d = Math.abs(b.x + b.w / 2 - p.x) + Math.abs(b.y - p.y); if (!hi || d < hi.d) hi = { d, x: b.x + b.w / 2, y: b.y }; } if (hi && p.y > 560) hazGoal = hi; }
      if (this.map.opt.press && (env.warn === "press" || env.press > 0.3) && Math.abs(p.x - (PRESS.x + PRESS.w / 2)) < 110 && p.y > 400) hazGoal = { x: p.x < PRESS.x + PRESS.w / 2 ? PRESS.x - 120 : PRESS.x + PRESS.w + 120, y: p.y };
      if (hazGoal) { goal = hazGoal; gk = "safe"; }
      if (goal) {
        const dx = goal.x - p.x, dy = goal.y - p.y, adx = Math.abs(dx);
        const range = W.k === "flame" || W.k === "wind" ? 150 : W.id === "shotgun" ? 200 : W.k === "hitscan" ? 700 : W.k === "nade" ? 420 : W.k === "mine" ? 60 : 380;
        if (gk !== "enemy") { if (adx > 10) mv = sgn(dx); }
        else if (!easy && Math.abs(dy) < 70) {
          // 중급·고급: 상대보다 가운데 쪽에 서서 바깥으로 밀어냄
          const side = sgn(800 - goal.x) || 1, careful = hard && p.pct > 120;
          let want = goal.x + side * Math.min(range * 0.65, 300);
          if (careful) want = clamp(want, 520, 1080);
          const off = want - p.x;
          if (Math.abs(off) > 50 && !(adx < range && sgn(dx) === p.face && Math.abs(off) < 160)) mv = sgn(off);
          else if (sgn(dx) !== p.face) mv = sgn(dx);
          // 상대가 나보다 가운데 쪽이면(내가 밀리는 쪽) 고급은 뛰어넘음
          if (hard && onG && sgn(800 - p.x) === sgn(dx) && adx < 200 && Math.abs(p.x - 800) > 250 && R() < 0.35) { wantJ = true; mv = sgn(dx); }
          if (!hard && adx < range && R() < 0.2) mv = (R() < 0.5 ? 1 : -1) * (sgn(dx) || 1);
        } else {
          if (adx > range) mv = sgn(dx);
          else if (adx < 70 && W.k !== "flame" && W.k !== "mine") mv = -sgn(dx);
          else if (sgn(dx) !== p.face) mv = sgn(dx);
        }
        if (dy < -80 && adx < 320) { if (onG) wantJ = true; else if (p.vy > -120 && p.jumps > 0 && dy < -60) wantJ = true; }
        if (dy > 90 && onG && this.map.plats[p.gnd] && this.map.plats[p.gnd].t === "p" && this.groundBelow(p.x, p.y + 20)) wantD = true;
        if (gk === "enemy") {
          const faceOk = sgn(dx) === (mv ? mv : p.face);
          const aligned = Math.abs(dy + 4) < (W.k === "nade" ? 140 : 46) && faceOk && adx < (W.k === "hitscan" ? 1500 : range * 1.7);
          if (aligned && R() < LV.aim) bits |= BITS.F;
          if (easy && R() < 0.3) bits &= ~BITS.F; // 초급은 끊어서 쏨
          if (W.k === "mine" && onG && adx < 260 && R() < 0.4) bits |= BITS.F;
          // 폭탄: 고급은 상대가 끝에 있거나 %가 높을 때 노려서
          if (p.bombs > 0 && !easy && Math.abs(dy) < 110 && adx > 90 && adx < 280) {
            const edge = goal.x < 420 || goal.x > 1180 || goal.pct > 80;
            if (R() < (hard ? (edge ? 0.45 : 0.12) : 0.07)) bits |= BITS.B;
          }
          // 고급: 저격·레일건·대포를 들고 날 보는 상대면 뛰어 피함
          if (hard && onG && Math.abs(dy) < 34 && goal.face === -sgn(dx)) { const gw = WEAPONS[goal.w]; if ((gw.k === "hitscan" || gw.kb > 900) && R() < 0.35) wantJ = true; else if (R() < 0.08) wantJ = true; }
        }
      } else mv = sgn(800 - p.x) * (Math.abs(800 - p.x) > 150 ? 1 : 0);
      // 터질 폭탄·켜진 지뢰 피하기 (중급·고급)
      if (!easy) for (const o of this.O) {
        const dxo = p.x - o.x, near = Math.abs(dxo) < (o.k === "bomb" ? 150 : 70) && Math.abs(p.y - o.y) < 90;
        if (!near) continue;
        if (o.k === "bomb" && o.fuse - tick < (hard ? 60 : 35)) { mv = sgn(dxo) || 1; if (Math.abs(dxo) < 60 && onG) wantJ = true; }
        if (o.k === "mine" && o.arm >= 0 && tick >= o.arm && o.o !== p.pid && this.enemy(this.P[o.o - 1] || p, p)) { if (onG && Math.abs(dxo) < 60) wantJ = true; }
      }
      // 3) 낭떠러지 조심
      if (mv && onG) {
        const ahead = p.x + mv * (HW + 18 + Math.max(Math.abs(p.vx), 200) * (LV.think + 3) / 60); // 생각이 느릴수록 더 멀리 봄
        if (!this.groundBelow(ahead, p.y - 2)) {
          const far = this.groundBelow(ahead + mv * 160, p.y - 160);
          if (far && far.top - p.y < 120 && far.top - p.y > -170 && gk !== "safe" || (far && gk === "safe")) wantJ = true;
          else if (!(goal && goal.y > p.y + 60 && this.groundBelow(ahead, p.y + 30))) mv = 0;
        }
      }
      // 컨베이어가 끝으로 실어 가면 거슬러 걸음
      if (onG && this.P1[p.gnd] && this.P1[p.gnd].cv) { const cv = this.P1[p.gnd].cv; if (!this.groundBelow(p.x + sgn(cv) * (HW + 50 + Math.abs(cv) * (LV.think + 3) / 60), p.y - 2) && mv !== -sgn(cv)) mv = -sgn(cv); }
      if (!onG && p.vy > -60 && p.jumps > 0 && !this.groundBelow(p.x + p.vx * 0.3, p.y)) wantJ = true; // 틈 위 꼭대기에서 이단 점프
      if (Math.abs(p.vx) > 420 && ((p.vx < 0 && p.x < 520) || (p.vx > 0 && p.x > 1080))) mv = -sgn(p.vx);
    }
    if (env.wind && Math.abs(p.x - 800) > 260 && sgn(env.wind) === sgn(p.x - 800)) mv = -sgn(env.wind);
    if (mv < 0) bits |= BITS.L; else if (mv > 0) bits |= BITS.R;
    if (wantJ && !(B.bits & BITS.J)) { bits |= BITS.J; B.hop = tick + 9; } else B.hop = 0;
    if (wantD && !(B.bits & BITS.D)) bits |= BITS.D;
    if ((p.eff.jet || 0) > tick && !onG && p.vy > 0 && p.y > 520 && (B.bits & BITS.J)) bits |= BITS.J;
    B.bits = bits;
    return bits;
  }
  // ---------- 보내기 ----------
  // 사람 한 명 기준 스냅샷 (JSON) — 모두 같은 내용 + 내 예측용 상태
  snap(meId) {
    const tick = this.tick, r = Math.round;
    const P = this.P.map(p => [p.pid, r(p.x), r(p.y), r(p.vx), r(p.vy), p.face, p.st === "alive" ? 0 : p.st === "dead" ? 1 : 2, p.w, p.ammo, p.bombs, p.lives, (p.inv > tick ? 1 : 0) | (p.frz > tick ? 2 : 0) | (p.stun > tick ? 4 : 0) | (p.gnd >= 0 ? 8 : 0) | (p.slow || p.spin > 0 ? 16 : 0) | (p.floatT > tick ? 32 : 0), EFF_KEYS.map(k => Math.max(0, (p.eff[k] || 0) - tick)), p.shieldN, p.kos, Math.round(p.pct)]);
    const B = this.B.map(b => [b.id, b.w, r(b.x), r(b.y), r(b.vx), r(b.vy)]);
    const O = this.O.map(o => [o.id, o.k === "bomb" ? 0 : 1, r(o.x), r(o.y), r(o.vx), r(o.vy), o.k === "bomb" ? o.fuse - tick : (o.arm >= 0 && tick >= o.arm ? 1 : 0), o.o]);
    const C = this.C.map(c => [c.id, c.k === "w" ? 0 : 1, c.v, r(c.x), r(c.y), c.landed ? 1 : 0, c.ttl - tick]);
    const H = this.H.map(h => [h.id, r(h.x), r(h.y), tick < h.fall ? 0 : 1]);
    const out = { t: tick, P, B, O, C, H, cr: this.cr.some(v => v) ? this.cr.slice() : 0 };
    const me = meId ? this.byId.get(meId) : null;
    if (me) out.me = this.meArr(me);
    return out;
  }
  // 내 캐릭터 예측에 필요한 숨은 상태 (남은 틱으로)
  meArr(me) {
    const tick = this.tick;
    return [me.pid, me.ack, me.jumps, me.coy - tick, me.jb - tick, me.drop, me.dropT - tick, me.stun - tick, me.frz - tick, me.floatT - tick, me.cd - tick, me.bq, me.bt - tick, me.spin, me.gnd, me.prev, me.bcd - tick, me.jcut ? 1 : 0];
  }
  meta() { return { map: this.mapId, seed: this.seed, mode: this.mode, lives: this.lives, items: this.items, pct: this.pct, players: this.P.map(p => ({ pid: p.pid, id: p.id, name: p.name, team: p.team, look: p.look, bot: p.bot, dummy: p.dummy || undefined })), tick: this.tick }; }
}
