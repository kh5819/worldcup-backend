// =========================
// DUO 증강 물고기 키우기 — 서버 시뮬레이션 (2026-11-21)
// · World 하나 = 수조 하나 (사람 + AI 물고기 최대 50마리). 이동·먹기·크기·증강·이벤트·AI 판정은 전부 여기서
// · 20Hz 고정 틱. 먹이·새우는 격자(GRID)로 후보만 검사, 물고기끼리는 50마리라 전부 비교(1,225쌍)
// · 화면에는 관심 영역(그 사람 화면)만: 물고기·새우는 매 틱, 먹이는 새로 보인 것·사라진 것만 (아는 목록 = known)
// =========================
import { TICK, MAP, SURFACE, FLOOR, GAME_LEN, MASS0, MAX_FISH, MAX_AUGS, MAX_ACTIVE, MAX_LEGEND, AUG_AT, EAT_RATIO, DECAY_FROM, MASS_CAP, RESPAWN, SPAWN_SAFE, DASH,
  rOf, spdOf, FOOD, KRILL, SKIN_IDS, AUGS, AUG, RARITY_W, SYNERGIES, EVENT_AT, EVENTS, EVENT_IDS, FEAST_AT, BOT_LV, BOT_NAMES, BOSS_AT, BOSS_LEN, BOSSES, BOSS_IDS, BOSS_REWARD, whirlVel } from "./aq-data.js";

const GRID = 128, GW = Math.ceil(MAP.w / GRID), GH = Math.ceil(MAP.h / GRID);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const Y0 = SURFACE, Y1 = MAP.h - FLOOR;
// 물고기 깃발 (화면으로 보냄)
export const FL = { protect: 1, dash: 2, shark: 4, puff: 8, invis: 16, camo: 32, stun: 64, armor: 128, blind: 256, decoy: 512, weed: 1024, frenzy: 2048, npc: 4096, donor: 8192, torpedo: 16384, poison: 32768 };
const LEG = (id) => AUG[id]?.r === "legend";

export class World {
  /** o = { seed, aug, mode:'ffa'|'team', teams, fill, botLv, players:[{id,name,skin,team}], out(ev,data,to), onEnd } */
  constructor(o) {
    this.o = o; this.aug = o.aug !== false; this.mode = o.mode === "team" ? "team" : "ffa"; this.teams = this.mode === "team" ? clamp(o.teams | 0 || 2, 2, 5) : 0;
    this.botLv = BOT_LV[o.botLv] ? o.botLv : "normal"; this.fill = clamp(o.fill ?? 30, 0, MAX_FISH);
    this.rng = mulberry((o.seed ^ 0x9e3779b9) >>> 0);
    this.t = 0; this.tick = 0; this.status = "play"; this.paused = false; this.result = null; this.len = o.len || GAME_LEN;
    this.F = new Map(); this.fidSeq = 1; this.botSeq = 100; this.npcSeq = 900; this.decoySeq = 1000;
    this.pel = new Map(); this.pelSeq = 1; this.pg = new Array(GW * GH); for (let i = 0; i < this.pg.length; i++) this.pg[i] = [];
    this.krill = []; this.krillSeq = 1; this.kg = new Array(GW * GH); for (let i = 0; i < this.kg.length; i++) this.kg[i] = [];
    this.jellies = []; this.whirl = null; this.boss = null; this.bossKind = BOSS_IDS[Math.floor(mulberry((o.seed * 3 + 1) >>> 0)() * BOSS_IDS.length)]; this.bossDone = false; this.bossResult = null;
    this.ev = []; this.gev = []; this.gone = []; // gone: [pelletId, eaterFid] 이번 틱에 사라진 먹이
    this.inks = []; this.hooks = []; this.goldWarn = []; this.decoys = []; this.cur = { x: 0, y: 0 }; this.curT = 0; this.darkUntil = 0; this.event = null; this.feast = false;
    this.evPlan = []; { const ids = EVENT_IDS.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } this.evPlan = EVENT_AT.map((at, i) => ({ at: at * this.len / GAME_LEN, k: ids[i % ids.length], done: false })); }
    this.rocks = this.makeRocks(); this.weeds = this.makeWeeds();
    this.stats = { eats: 0, maxFish: 0 };
    this.rosterVer = 1;
    (o.players || []).forEach(p => this.addHuman(p, false));
    this.balanceBots();
    for (let i = 0; i < 800; i++) this.spawnPellet(true);
    for (let i = 0; i < 12; i++) this.spawnKrillSchool();
    if (this.aug) for (const F of this.F.values()) if (!F.npc) this.checkOffer(F);
  }
  // ---------- 지형 ----------
  makeRocks() {
    const r = mulberry((this.o.seed * 7 + 13) >>> 0), list = [];
    // 바닥 바위 (반쯤 묻힘) + 물속 암초
    for (let i = 0; i < 9; i++) { const x = 250 + (i + r() * 0.6) * (MAP.w - 500) / 9, rad = 70 + r() * 70; list.push({ x, y: Y1 + rad * 0.35, r: rad, k: r() < 0.5 ? 0 : 1, floor: 1 }); }
    for (let i = 0; i < 40 && list.filter(x => !x.floor).length < 6; i++) {
      const x = 500 + r() * (MAP.w - 1000), y = Y0 + 500 + r() * (Y1 - Y0 - 1000), rad = 70 + r() * 55;
      if (list.some(o => d2(o.x, o.y, x, y) < (o.r + rad + 420) ** 2)) continue;
      list.push({ x, y, r: rad, k: r() < 0.5 ? 0 : 1, floor: 0 });
    }
    return list;
  }
  makeWeeds() {
    const r = mulberry((this.o.seed * 11 + 5) >>> 0), list = [];
    for (let i = 0; i < 7; i++) { const x = 380 + (i + 0.2 + r() * 0.6) * (MAP.w - 760) / 7; list.push({ x, y: Y1 - 150, r: 170 + r() * 60, c: Math.floor(r() * 3) }); }
    return list;
  }
  pushOut(F, R) {
    const yTop = Y0 + R * 0.3, yBot = Y1 - R * 0.3;
    F.x = clamp(F.x, R * 0.4, MAP.w - R * 0.4); F.y = clamp(F.y, Math.min(yTop, (Y0 + Y1) / 2), Math.max(yBot, (Y0 + Y1) / 2));
    for (const o of this.rocks) { const dx = F.x - o.x, dy = F.y - o.y, min = o.r + R * 0.55, dd = dx * dx + dy * dy; if (dd < min * min) { const d = Math.sqrt(dd) || 0.01; F.x = o.x + dx / d * min; F.y = o.y + dy / d * min; } }
  }
  inWeed(F) { if (F.m > 80) return false; for (const w of this.weeds) if (d2(F.x, F.y, w.x, w.y) < w.r * w.r) return true; return false; }
  // ---------- 물고기 ----------
  newFish(o) {
    const F = { fid: o.fid, id: o.id || null, name: o.name, skin: SKIN_IDS.includes(o.skin) ? o.skin : SKIN_IDS[Math.floor(this.rng() * 6)], team: o.team || 0, idx: o.idx ?? -1,
      human: !!o.human, bot: o.bot || null, npc: o.npc || null, donor: o.donor || null,
      x: 0, y: 0, vx: 0, vy: 0, ang: 0, m: o.m || MASS0, best: o.m || MASS0, eats: 0, food: 0, deaths: 0, kills: [], biggestEat: 0,
      state: "alive", deadT: 0, killer: 0, protect: this.t + SPAWN_SAFE, in: { mx: 0, my: 0, seq: 0, btn: 0 }, dashT: 0, dashMul: DASH.mul, dashCd: 0, dashDir: { x: 1, y: 0 }, kb: { x: 0, y: 0 },
      stun: 0, slow: 0, augs: [], syn: new Set(), act: [null, null], acd: [0, 0], pend: [], pickN: 0, picks: 0,
      st: { gold: 0, krill: 0, armor: 0, spine: 0, revenge: 0, humans: 0, dodge: 0 }, tl: [], eatenBy: {}, bh: null, lastKiller: 0, jellyAt: 0, bossHitAt: 0,
      b: {}, armorAt: 0, spineAt: 0, bubbleAt: 0, reflexAt: 0, still: 0, eatLog: [], poison: null, helpers: 0, brain: { tgt: null, pel: 0, next: 0, wx: 0, wy: 0, dashAt: 0 }, botAug: 0 };
    this.spawnAt(F, true);
    return F;
  }
  addHuman(p, mid = true) {
    const F = this.newFish({ fid: this.fidSeq++, id: p.id, name: p.name, skin: p.skin, team: p.team, idx: p.idx, human: true });
    this.F.set(F.fid, F); this.rosterVer++;
    if (mid) { this.balanceBots(); if (this.aug) this.checkOffer(F); }
    return F;
  }
  removeHuman(id) { const F = this.fishById(id); if (F) { this.dropRemains(F, 0.6); this.F.delete(F.fid); this.rosterVer++; this.balanceBots(); } }
  fishById(id) { for (const F of this.F.values()) if (F.id === id) return F; return null; }
  humanCount() { let n = 0; for (const F of this.F.values()) if (F.human && !F.left) n++; return n; }
  balanceBots() {
    const humans = [...this.F.values()].filter(F => F.human).length;
    const want = Math.max(0, Math.min(MAX_FISH - humans, this.fill - humans));
    const bots = [...this.F.values()].filter(F => F.bot && !F.human && !F.donor && !F.npc);
    if (bots.length < want) {
      const used = new Set(bots.map(b => b.nameIdx));
      for (let i = bots.length; i < want; i++) {
        let ni = Math.floor(this.rng() * BOT_NAMES.length); for (let g = 0; g < 60 && used.has(ni); g++) ni = (ni + 7) % BOT_NAMES.length; used.add(ni);
        const kind = this.rng(); const F = this.newFish({ fid: this.botSeq++, name: BOT_NAMES[ni], skin: SKIN_IDS[Math.floor(this.rng() * SKIN_IDS.length)], team: this.mode === "team" ? this.smallTeam() : 0, bot: kind < 0.3 ? "hunter" : kind < 0.42 ? "shy" : "normal" });
        F.nameIdx = ni; F.m = MASS0 + Math.floor(this.rng() * 30) * (this.t > 20 ? 2 : 1); F.best = F.m; this.F.set(F.fid, F);
      }
      this.rosterVer++;
    } else if (bots.length > want) {
      bots.sort((a, b) => a.m - b.m); for (let i = 0; i < bots.length - want; i++) { const B = bots[i]; this.ev.push({ k: "pop", x: Math.round(B.x), y: Math.round(B.y), f: B.fid }); this.F.delete(B.fid); }
      this.rosterVer++;
    }
  }
  smallTeam() { const c = new Array(this.teams).fill(0); for (const F of this.F.values()) if (!F.npc) c[F.team]++; let best = 0; for (let i = 1; i < this.teams; i++) if (c[i] < c[best]) best = i; return best; }
  roster() { return [...this.F.values()].map(F => [F.fid, F.human ? F.idx : -1, F.bot ? F.nameIdx ?? -1 : -1, F.skin, F.team, F.npc ? 2 : F.donor ? 3 : F.bot ? 1 : 0, F.donor || (F.human ? F.name : "")]); }
  spawnAt(F, first) {
    const R = rOf(F.m);
    for (let g = 0; g < 40; g++) {
      const x = 200 + this.rng() * (MAP.w - 400), y = Y0 + 120 + this.rng() * (Y1 - Y0 - 240);
      let ok = !this.rocks.some(o => d2(o.x, o.y, x, y) < (o.r + R + 30) ** 2);
      if (ok) for (const Q of this.F.values()) if (Q !== F && Q.state === "alive" && Q.m > F.m * 1.2 && d2(Q.x, Q.y, x, y) < (rOf(Q.m) + 520) ** 2) { ok = false; break; }
      if (ok || g === 39) { F.x = x; F.y = y; break; }
    }
    F.ang = this.rng() < 0.5 ? 0 : Math.PI; F.vx = 0; F.vy = 0; this.pushOut(F, R);
  }
  // ---------- 먹이 ----------
  pcell(x, y) { return clamp((y / GRID) | 0, 0, GH - 1) * GW + clamp((x / GRID) | 0, 0, GW - 1); }
  addPel(x, y, type, v) {
    if (this.pel.size > 4200) return null;
    const p = { id: this.pelSeq++, x: Math.round(x), y: Math.round(y), type, v: v ?? FOOD[type].m, c: 0, i: 0 };
    p.c = this.pcell(p.x, p.y); const cell = this.pg[p.c]; p.i = cell.length; cell.push(p); this.pel.set(p.id, p);
    if (this.pelSeq > 0xfffffff0) this.pelSeq = 1;
    return p;
  }
  delPel(p, eater = 0) {
    const cell = this.pg[p.c], last = cell.pop(); if (last !== p) { cell[p.i] = last; last.i = p.i; }
    this.pel.delete(p.id); this.gone.push(p.id, eater);
  }
  spawnPellet(init) {
    const r = this.rng();
    if (r < 0.16) { const w = this.weeds[Math.floor(this.rng() * this.weeds.length)]; const a = this.rng() * TAU, d = Math.sqrt(this.rng()) * w.r; return this.addPel(w.x + Math.cos(a) * d, Math.min(Y1 - 30, w.y + Math.sin(a) * d * 0.8), 1); }
    if (r < 0.165 && !init) { const x = 300 + this.rng() * (MAP.w - 600), y = Y0 + 100 + this.rng() * (Y1 - Y0 - 200); return this.addPel(x, y, 2); }
    const x = 40 + this.rng() * (MAP.w - 80), y = Y0 + 40 + this.rng() * (Y1 - Y0 - 80);
    if (this.rocks.some(o => d2(o.x, o.y, x, y) < (o.r + 12) ** 2)) return null;
    return this.addPel(x, y, 0);
  }
  pelTarget() { return Math.round((750 + 10 * this.F.size) * (this.feast ? 1.8 : 1)); }
  nearPel(x, y, r, fn) {
    const x0 = clamp(((x - r) / GRID) | 0, 0, GW - 1), x1 = clamp(((x + r) / GRID) | 0, 0, GW - 1), y0 = clamp(((y - r) / GRID) | 0, 0, GH - 1), y1 = clamp(((y + r) / GRID) | 0, 0, GH - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const cell = this.pg[cy * GW + cx]; for (let i = cell.length - 1; i >= 0; i--) { const p = cell[i]; if (p && fn(p) === true) return; } }
  }
  dropRemains(F, frac) {
    const total = F.m * frac; if (total < 2) return; const n = clamp(Math.round(total / 8), 2, 14), R = rOf(F.m);
    for (let i = 0; i < n; i++) { const a = this.rng() * TAU, d = R * (0.6 + this.rng() * 1.6); this.addPel(clamp(F.x + Math.cos(a) * d, 20, MAP.w - 20), clamp(F.y + Math.sin(a) * d, Y0 + 10, Y1 - 10), 3, total / n); } // 둘레에 흩어짐 (먹은 물고기가 바로 다 먹지 않게)
  }
  // ---------- 새우 떼 ----------
  spawnKrillSchool() {
    if (this.krill.length > 170) return;
    const cx = 300 + this.rng() * (MAP.w - 600), cy = Y0 + 200 + this.rng() * (Y1 - Y0 - 400), a = this.rng() * TAU, n = 8 + Math.floor(this.rng() * 8), school = { cx, cy, a, t: 0 };
    for (let i = 0; i < n; i++) this.krill.push({ id: this.krillSeq++ & 0xffff, x: cx + (this.rng() - 0.5) * 120, y: cy + (this.rng() - 0.5) * 80, a, s: school, ph: this.rng() * TAU });
  }
  updKrill(dt) {
    const schools = new Set();
    for (const k of this.krill) schools.add(k.s);
    for (const s of schools) { s.t += dt; s.a += Math.sin(s.t * 0.7 + s.cx) * 0.6 * dt; s.cx += Math.cos(s.a) * KRILL.spd * dt; s.cy += Math.sin(s.a) * KRILL.spd * 0.6 * dt; if (s.cx < 200 || s.cx > MAP.w - 200) s.a = Math.PI - s.a; if (s.cy < Y0 + 150 || s.cy > Y1 - 150) s.a = -s.a; s.cx = clamp(s.cx, 150, MAP.w - 150); s.cy = clamp(s.cy, Y0 + 100, Y1 - 100); }
    const g = this.kg; for (let i = 0; i < g.length; i++) if (g[i].length) g[i].length = 0;
    for (const k of this.krill) {
      k.ph += dt * 3; const tx = k.s.cx + Math.cos(k.ph + k.id) * 50, ty = k.s.cy + Math.sin(k.ph * 1.3 + k.id) * 35;
      // 큰 물고기가 오면 흩어짐 (가까운 물고기 1마리만 확인 — 격자 안 씀, 물고기 수가 적어서)
      let fx = 0, fy = 0; if ((this.tick + k.id) % 4 === 0) for (const F of this.F.values()) { if (F.state !== "alive") continue; const dd = d2(F.x, F.y, k.x, k.y), rr = rOf(F.m) + 110; if (dd < rr * rr) { const d = Math.sqrt(dd) || 1; fx += (k.x - F.x) / d; fy += (k.y - F.y) / d; } }
      if (fx || fy) { k.fx = fx; k.fy = fy; k.ft = 0.6; } if (k.ft > 0) { k.ft -= dt; }
      const vx = (tx - k.x) * 2 + (k.ft > 0 ? k.fx * 160 : 0), vy = (ty - k.y) * 2 + (k.ft > 0 ? k.fy * 160 : 0);
      const sp = Math.hypot(vx, vy), lim = 150; const s = sp > lim ? lim / sp : 1;
      k.x = clamp(k.x + vx * s * dt, 20, MAP.w - 20); k.y = clamp(k.y + vy * s * dt, Y0 + 20, Y1 - 20); if (sp > 5) k.a = Math.atan2(vy, vx);
      g[this.pcell(k.x, k.y)].push(k);
    }
    if (this.tick % 24 === 0 && this.krill.length < 150) this.spawnKrillSchool();
  }
  // ---------- 입력 ----------
  input(pid, d) {
    const F = this.fishById(pid); if (!F) return false;
    const seq = d.s | 0; if (seq <= F.in.seq && F.in.seq - seq < 1e6) return false;
    let mx = Number(d.mx), my = Number(d.my); if (!Number.isFinite(mx)) mx = 0; if (!Number.isFinite(my)) my = 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    F.in.mx = mx; F.in.my = my; F.in.seq = seq; F.in.btn |= (d.b | 0) & 7; // 1 돌진 · 2 Q · 4 E
    return true;
  }
  // ---------- 틱 ----------
  step() {
    if (this.status !== "play") return;
    this.ev.length = 0; this.gev.length = 0; this.gone.length = 0;
    if (this.paused) { for (const F of this.F.values()) F.in.btn = 0; this.checkPicks(); return; } // 고르는 동안 누른 버튼은 버림 (고른 뒤 갑자기 돌진하지 않게)
    const dt = TICK; this.t += dt; this.tick++;
    this.events(dt);
    this.updJellies(dt); this.updWhirl(dt); this.updBoss(dt);
    if (this.tick % 100 === 0) for (const F of this.F.values()) if (F.human) { F.tl.push(Math.round(F.state === "alive" ? F.m : 0)); if (F.tl.length > 80) F.tl.shift(); } // 크기 그래프 (5초마다)
    this.updKrill(dt);
    for (const F of this.F.values()) this.updFish(F, dt);
    this.updDecoys(dt);
    this.eatFood();
    this.eatFish();
    this.updHooks(dt);
    // 먹이 채우기
    const tgt = this.pelTarget(), rate = this.feast ? 14 : 5; for (let i = 0; i < rate && this.pel.size < tgt; i++) this.spawnPellet(false);
    if (this.tick % 40 === 0) for (const F of this.F.values()) if (F.state === "alive" && F.augs.includes("a15") && this.rng() < 0.5) { const a = this.rng() * TAU, d = 220 + this.rng() * 300; this.addPel(clamp(F.x + Math.cos(a) * d, 40, MAP.w - 40), clamp(F.y + Math.sin(a) * d, Y0 + 30, Y1 - 30), 2); }
    this.inks = this.inks.filter(k => k.until > this.t);
    this.checkPicks();
    if (this.F.size > this.stats.maxFish) this.stats.maxFish = this.F.size;
    if (this.t >= this.len) this.finish();
  }
  // ---------- 물고기 한 마리 ----------
  updFish(F, dt) {
    const t = this.t;
    if (F.state === "dead") {
      if (F.npc || F.donor) { this.F.delete(F.fid); this.rosterVer++; return; }
      F.deadT -= dt; if (F.deadT <= 0) this.respawn(F); return;
    }
    if (F.npc) return this.updNpc(F, dt);
    if (F.donor && F.until <= this.t) { F.state = "dead"; this.ev.push({ k: "pop", x: Math.round(F.x), y: Math.round(F.y), f: F.fid }); this.gev.push({ k: "donorgone", f: F.fid }); return; }
    if (F.bot) this.botThink(F);
    const R = rOf(F.m);
    // 성장·줄어듦·독
    const from = DECAY_FROM * (F.augs.includes("a23") ? AUG.a23.v.from : 1), cap = MASS_CAP * (F.augs.includes("a23") ? 1 + AUG.a23.v.cap : 1);
    if (F.m > from) F.m -= dt * (F.m - from) * (0.014 + F.m / 400000) * (F.augs.includes("a10") ? 1 - AUG.a10.v.decay : 1);
    if (F.augs.includes("a11")) F.m += dt * (AUG.a11.v.base + F.m * AUG.a11.v.pct) * (F.syn.has("s9") ? 2 : 1) * (F.m < from ? 1 : 0.3);
    if (F.poison) { if (F.poison.until <= t) F.poison = null; else F.m -= F.poison.rate * dt; }
    F.m = clamp(F.m, MASS0 * 0.6, cap); if (F.m > F.best) F.best = F.m;
    // 버튼
    const btn = F.in.btn; F.in.btn = 0;
    if (F.dashCd > 0) F.dashCd -= dt; if (F.acd[0] > 0) F.acd[0] -= dt; if (F.acd[1] > 0) F.acd[1] -= dt;
    const stunned = F.stun > t;
    if (!stunned) { if (btn & 1) this.dash(F); if (btn & 2) this.skill(F, 0); if (btn & 4) this.skill(F, 1); }
    // 역류: 나를 먹을 수 있는 물고기가 바짝 붙으면 자동 돌진
    if (F.augs.includes("a29") && F.reflexAt <= t && F.dashT <= 0 && !stunned) { const th = this.threatNear(F, R + 40); if (th) { const dx = F.x - th.x, dy = F.y - th.y, l = Math.hypot(dx, dy) || 1; F.dashDir = { x: dx / l, y: dy / l }; F.dashT = DASH.ticks; F.dashMul = DASH.mul; F.reflexAt = t + AUG.a29.v.cd; this.ev.push({ k: "dash", f: F.fid, x: Math.round(F.x), y: Math.round(F.y), r: 1 }); } }
    // 이동
    let vx = 0, vy = 0; const base = this.speedOf(F);
    if (F.dashT > 0) { F.dashT--; const sp = spdOf(F.m) * F.dashMul; vx = F.dashDir.x * sp; vy = F.dashDir.y * sp; if (F.dashT === 0 && F.torpedo && F.syn.has("s11")) this.burst(F, AUG.a37.v.r, AUG.a37.v.f); if (F.dashT === 0) F.torpedo = false; }
    else if (!stunned) { vx = F.in.mx * base; vy = F.in.my * base; }
    if (!F.augs.includes("a19")) { vx += this.cur.x; vy += this.cur.y; if (this.whirl) { const [wx, wy] = whirlVel(F.x, F.y, this.whirlArr()); vx += wx; vy += wy; } }
    vx += F.kb.x; vy += F.kb.y; F.kb.x *= 0.82; F.kb.y *= 0.82; if (Math.abs(F.kb.x) < 2) F.kb.x = 0; if (Math.abs(F.kb.y) < 2) F.kb.y = 0;
    F.x += vx * dt; F.y += vy * dt; this.pushOut(F, R);
    F.vx = vx; F.vy = vy;
    const spd = Math.hypot(vx - this.cur.x, vy - this.cur.y);
    if (spd > 8) F.ang = Math.atan2(vy, vx);
    // 보호색 (거의 멈춤)
    F.still = spd < 30 ? F.still + dt : 0;
    // 그림자 사냥꾼: 투명 중 먹물 자국
    if (F.syn.has("s4") && F.b.invis > t && this.tick % 6 === 0) this.inks.push({ x: F.x, y: F.y, r: 120, until: t + 2, owner: F.fid });
  }
  speedOf(F) {
    const t = this.t, a = F.augs; let mul = 1;
    if (a.includes("a04")) mul += AUG.a04.v.spd; if (a.includes("a19")) mul += AUG.a19.v.spd; if (F.syn.has("s3")) mul += 0.05;
    if (F.b.chain > t) mul += AUG.a14.v.spd; if (F.b.frenzy > t) mul += 0.25;
    if (a.includes("a22") && this.threatNear(F, AUG.a22.v.r + rOf(F.m))) mul += AUG.a22.v.spd;
    if (F.b.puff > t) mul *= 1 - AUG.a38.v.slow; if (F.slow > t) mul *= 0.55;
    if (F.b.shark > t) mul *= 1.1;
    return spdOf(F.m) * mul;
  }
  threatNear(F, r) { for (const Q of this.F.values()) { if (Q === F || Q.state !== "alive") continue; if (d2(F.x, F.y, Q.x, Q.y) > (r + rOf(Q.m)) ** 2) continue; if (this.canEat(Q, F)) return Q; } return null; }
  dash(F) {
    if (F.dashCd > 0 || F.dashT > 0) return;
    const free = F.augs.includes("a09");
    if (!free && F.m < DASH.min) return;
    let dx = F.in.mx, dy = F.in.my; if (!dx && !dy) { dx = Math.cos(F.ang); dy = Math.sin(F.ang); }
    const l = Math.hypot(dx, dy) || 1; F.dashDir = { x: dx / l, y: dy / l }; F.dashT = DASH.ticks + (F.augs.includes("a24") ? AUG.a24.v.ticks : 0); F.dashMul = DASH.mul;
    let cd = DASH.cd; if (F.augs.includes("a08")) cd *= 1 - AUG.a08.v.dcd; if (F.syn.has("s3")) cd *= 0.7; F.dashCd = cd;
    if (!free) { const cost = F.m * DASH.cost; F.m -= cost; const R = rOf(F.m); this.addPel(clamp(F.x - F.dashDir.x * R * 1.2, 20, MAP.w - 20), clamp(F.y - F.dashDir.y * R * 1.2, Y0 + 10, Y1 - 10), 4, cost * 0.75); }
    this.ev.push({ k: "dash", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) });
  }
  // ---------- 스킬 (Q/E) ----------
  skill(F, slot) {
    const id = F.act[slot]; if (!id || F.acd[slot] > 0) return;
    const A = AUG[id], v = A.v, t = this.t, R = rOf(F.m);
    let cd = A.cd; if (id === "a32" && F.syn.has("s10")) cd *= 0.6; F.acd[slot] = cd;
    switch (id) {
      case "a31": this.inks.push({ x: F.x, y: F.y, r: v.r + R, until: t + v.t, owner: F.fid }); this.ev.push({ k: "ink", x: Math.round(F.x), y: Math.round(F.y), r: Math.round(v.r + R) }); break;
      case "a32": F.b.invis = t + v.t + (F.syn.has("s4") ? 2 : 0); this.ev.push({ k: "invis", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); break;
      case "a33": { const rr = v.r + R; this.ev.push({ k: "shock", x: Math.round(F.x), y: Math.round(F.y), r: Math.round(rr), f: F.fid }); if (this.boss && this.bossCircles(this.boss).some(([cx, cy, cr]) => d2(F.x, F.y, cx, cy) < (rr + cr) ** 2)) this.hitBoss(F, 40 + F.m * 0.1, true);
        for (const Q of this.F.values()) { if (Q === F || Q.state !== "alive" || this.ally(F, Q)) continue; if (d2(F.x, F.y, Q.x, Q.y) > (rr + rOf(Q.m) * 0.5) ** 2) continue; if (!Q.npc && Q.m > F.m * v.max) continue; if (this.bubble(Q)) continue;
          Q.stun = t + (Q.npc ? 0.6 : v.t); if (F.syn.has("s8") && !Q.npc) { const loss = Q.m * 0.05; Q.m -= loss; F.m += loss; } }
        break; }
      case "a34": F.b.shark = t + (F.syn.has("s7") ? 12 : v.t); F.sharkEnd = !F.syn.has("s7"); this.ev.push({ k: "shark", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); this.gev.push({ k: "sharkf", f: F.fid }); break;
      case "a35": { const a = F.ang; this.decoys.push({ fid: this.decoySeq++, owner: F.fid, x: F.x, y: F.y, vx: Math.cos(a) * spdOf(F.m) * 1.05, vy: Math.sin(a) * spdOf(F.m) * 1.05, m: F.m, skin: F.skin, until: t + v.t, ang: a }); if (this.decoySeq > 1999) this.decoySeq = 1000; this.ev.push({ k: "decoy", f: F.fid, d: this.decoys[this.decoys.length - 1].fid, x: Math.round(F.x), y: Math.round(F.y) }); break; }
      case "a36": { const big = F.syn.has("s5") ? 1.6 : 1, rr = v.r * big + R; F.b.vortex = t + 1; F.vortexR = rr; this.ev.push({ k: "vortex", x: Math.round(F.x), y: Math.round(F.y), r: Math.round(rr), f: F.fid });
        for (const Q of this.F.values()) { if (Q === F || Q.state !== "alive" || this.ally(F, Q)) continue; const dd = d2(F.x, F.y, Q.x, Q.y); if (dd > (v.slow * big + R) ** 2) continue; if (this.bubble(Q)) continue; Q.slow = t + v.t;
          if (F.syn.has("s5") && Q.m < F.m && !Q.npc) { const d = Math.sqrt(dd) || 1; Q.kb.x += (F.x - Q.x) / d * 420; Q.kb.y += (F.y - Q.y) / d * 420; } }
        break; }
      case "a37": this.burst(F, v.r, v.f); if (this.boss && this.bossCircles(this.boss).some(([cx, cy, cr]) => d2(F.x, F.y, cx, cy) < (v.r + R + cr) ** 2)) this.hitBoss(F, 30 + F.m * 0.08, true); break;
      case "a38": F.b.puff = t + v.t; this.ev.push({ k: "puff", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); break;
      case "a39": { let dx = F.in.mx, dy = F.in.my; if (!dx && !dy) { dx = Math.cos(F.ang); dy = Math.sin(F.ang); } const l = Math.hypot(dx, dy) || 1; F.dashDir = { x: dx / l, y: dy / l }; F.dashT = v.ticks; F.dashMul = v.mul; F.torpedo = true; this.ev.push({ k: "torpedo", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); break; }
      case "a40": F.b.sonar = t + v.t; this.ev.push({ k: "sonar", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); break;
    }
  }
  burst(F, r0, force) {
    const R = rOf(F.m), rr = r0 + R; this.ev.push({ k: "burst", x: Math.round(F.x), y: Math.round(F.y), r: Math.round(rr), f: F.fid });
    for (const Q of [...this.F.values(), ...this.decoys]) { if (Q === F || Q.state === "dead" || (Q.fid && this.F.has(Q.fid) && this.ally(F, Q))) continue; const dd = d2(F.x, F.y, Q.x, Q.y); const rq = rOf(Q.m); if (dd > (rr + rq * 0.5) ** 2) continue; if (Q.kb === undefined) continue; if (this.bubble(Q)) continue;
      const d = Math.sqrt(dd) || 1, k = force * (Q.npc ? 0.8 : 1) * clamp(1.6 - Q.m / Math.max(F.m, 1) * 0.4, 0.5, 1.6); Q.kb.x += (Q.x - F.x) / d * k; Q.kb.y += (Q.y - F.y) / d * k; Q.dashT = 0; }
  }
  bubble(Q) { if (!Q.augs?.includes("a28") || Q.bubbleAt > this.t) return false; Q.bubbleAt = this.t + AUG.a28.v.cd; this.ev.push({ k: "bubble", f: Q.fid, x: Math.round(Q.x), y: Math.round(Q.y) }); return true; }
  ally(A, B) { return this.mode === "team" && !A.npc && !B.npc && !A.donor && !B.donor && A.team === B.team; }
  // ---------- 먹기 판정 ----------
  effMass(B) { return B.m * (B.b.puff > this.t ? AUG.a38.v.mul : 1); }
  canEat(A, B) {
    const t = this.t;
    if (A === B || A.state !== "alive" || B.state !== "alive" || this.ally(A, B)) return false;
    if (B.npc) return false;                      // 상어는 못 먹음
    if (B.protect > t || A.protect > t || B.b.inv > t) return false;
    if (A.npc) return B.m * 1.1 <= A.m;
    const bm = this.effMass(B);
    if (B.b.shark > t && A.m < B.m * AUG.a34.v.safe) return false;
    if (A.b.shark > t) return bm <= A.m * AUG.a34.v.eat;
    let need = A.syn.has("s2") ? 1.05 : A.augs.includes("a18") ? AUG.a18.v.ratio : EAT_RATIO;
    if (B.augs.includes("a17")) need = Math.max(need, AUG.a17.v.ratio);
    return A.m >= bm * need;
  }
  mouth(F) { let m = 1; if (F.augs.includes("a01")) m += AUG.a01.v.mouth; if (F.b.frenzy > this.t) m += 0.25; if (F.b.shark > this.t) m += 0.15; return m; }
  eatFood() {
    const t = this.t;
    for (const F of this.F.values()) {
      if (F.state !== "alive" || F.npc) continue;
      const R = rOf(F.m), mouthR = R * this.mouth(F) * (F.augs.includes("a07") ? AUG.a07.v.pull : 1), vR = F.b.vortex > t ? F.vortexR : 0, reach = Math.max(mouthR, vR);
      const foodMul = 1 + (F.augs.includes("a02") ? AUG.a02.v.food : 0), goldMul = F.syn.has("s6") ? 3 : F.augs.includes("a15") ? AUG.a15.v.mul : 1, remMul = F.augs.includes("a16") ? AUG.a16.v.mul : 1;
      let got = 0, n = 0;
      this.nearPel(F.x, F.y, reach + 14, (p) => {
        const rr = reach + FOOD[p.type].r * 0.5; if (d2(F.x, F.y, p.x, p.y) > rr * rr) return;
        const v = p.type === 3 || p.type === 4 ? p.v * remMul : p.type === 2 ? p.v * goldMul * foodMul : p.v * foodMul;
        got += v; n++; this.delPel(p, F.fid);
        if (p.type === 2) { F.st.gold++; if (F.human) this.ev.push({ k: "gold", f: F.fid, x: p.x, y: p.y }); }
      });
      // 새우
      const kr = R * this.mouth(F) + KRILL.r;
      { const x0 = clamp(((F.x - kr) / GRID) | 0, 0, GW - 1), x1 = clamp(((F.x + kr) / GRID) | 0, 0, GW - 1), y0 = clamp(((F.y - kr) / GRID) | 0, 0, GH - 1), y1 = clamp(((F.y + kr) / GRID) | 0, 0, GH - 1);
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const k of this.kg[cy * GW + cx]) { if (k.dead) continue; if (d2(F.x, F.y, k.x, k.y) > kr * kr) continue; k.dead = true; got += KRILL.m * foodMul; n++; F.st.krill++; this.ev.push({ k: "krill", f: F.fid, i: k.id, x: Math.round(k.x), y: Math.round(k.y) }); } }
      // 새끼 물고기 (도우미)
      if (F.augs.includes("a20")) for (let h = 0; h < AUG.a20.v.n; h++) {
        const a = t * 2.2 + h * TAU / 3 + F.fid, hx = F.x + Math.cos(a) * (R + 46), hy = F.y + Math.sin(a) * (R + 46) * 0.7;
        this.nearPel(hx, hy, 30, (p) => { if (d2(hx, hy, p.x, p.y) > 30 * 30 || p.type === 2) return; got += p.v * AUG.a20.v.eff; n++; this.delPel(p, F.fid); });
      }
      if (n) {
        F.m += got; F.food += n;
        if (F.augs.includes("a30")) { for (let i = 0; i < n; i++) F.eatLog.push(t); while (F.eatLog.length && F.eatLog[0] < t - AUG.a30.v.w) F.eatLog.shift(); if (F.eatLog.length >= AUG.a30.v.n && !(F.b.frenzy > t)) { F.b.frenzy = t + AUG.a30.v.t; F.eatLog.length = 0; this.ev.push({ k: "frenzy", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) }); } }
      }
    }
    if (this.krill.some(k => k.dead)) this.krill = this.krill.filter(k => !k.dead);
  }
  eatFish() {
    const list = [...this.F.values()].filter(F => F.state === "alive"), t = this.t;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      let A = list[i], B = list[j]; if (A.state !== "alive" || B.state !== "alive") continue;
      const rA = rOf(A.m), rB = rOf(B.m), dd = d2(A.x, A.y, B.x, B.y), touch = rA + rB; if (dd > touch * touch) continue;
      let aE = this.canEat(A, B), bE = this.canEat(B, A); if (!aE && !bE) continue;
      if (bE && (!aE || B.m > A.m)) { const T = A; A = B; B = T; }
      const ra = rOf(A.m) * this.mouth(A) * (A.npc ? 0.9 : 1), rb = rOf(B.m), need = ra - rb * (A.npc ? 0.3 : 0.4);
      if (dd > need * need) continue;
      // 가시 (나를 먹으려는 물고기 튕김)
      if (this.spineHit(A, B)) continue;
      // 비늘 갑옷
      if (B.augs.includes("a05") && B.armorAt <= t && !A.npc) {
        const lost = B.m * (1 - AUG.a05.v.keep); B.m -= lost; A.m += lost * 0.8; B.armorAt = t + (B.syn.has("s12") ? 30 : AUG.a05.v.cd); B.b.inv = t + AUG.a05.v.inv;
        const d = Math.sqrt(dd) || 1; B.kb.x += (B.x - A.x) / d * 900; B.kb.y += (B.y - A.y) / d * 900; B.dashT = 0;
        B.st.armor++; this.ev.push({ k: "armor", f: B.fid, x: Math.round(B.x), y: Math.round(B.y) }); continue;
      }
      this.eat(A, B);
    }
    // 미끼: 큰 물고기가 닿으면 터짐
    for (const D of this.decoys) { if (D.dead) continue; for (const Q of list) { if (Q.fid === D.owner || Q.state !== "alive") continue; if (Q.m < D.m * 1.1 && !Q.npc) continue; const rr = rOf(Q.m); if (d2(Q.x, Q.y, D.x, D.y) < rr * rr) { D.dead = true; this.ev.push({ k: "pop", x: Math.round(D.x), y: Math.round(D.y), f: D.fid }); break; } } }
  }
  spineHit(A, B) {
    if (!B.augs.includes("a06") || A.npc || B.spineAt > this.t || A.m > B.m * AUG.a06.v.max) return false;
    const puffed = B.b.puff > this.t, big = puffed && B.syn.has("s1");
    const loss = A.m * (big ? 0.15 : AUG.a06.v.loss); A.m -= loss; this.dropRemainsAt(A.x, A.y, loss * 0.6, rOf(A.m));
    const dx = A.x - B.x, dy = A.y - B.y, d = Math.hypot(dx, dy) || 1, k = big ? 1300 : 800; A.kb.x += dx / d * k; A.kb.y += dy / d * k; A.dashT = 0;
    B.spineAt = this.t + AUG.a06.v.cd; B.st.spine++; this.ev.push({ k: "spine", f: B.fid, a: A.fid, x: Math.round(B.x), y: Math.round(B.y) });
    return true;
  }
  dropRemainsAt(x, y, total, R) { if (total < 2) return; const n = clamp(Math.round(total / 8), 1, 8); for (let i = 0; i < n; i++) { const a = this.rng() * TAU, d = R * (1.5 + this.rng() * 1.5); /* 입 밖으로 흩어짐 */ this.addPel(clamp(x + Math.cos(a) * d, 20, MAP.w - 20), clamp(y + Math.sin(a) * d, Y0 + 10, Y1 - 10), 3, total / n); } }
  eat(A, B) {
    const t = this.t;
    let gain = 0;
    if (!A.npc) {
      gain = B.m * 0.72 * (1 + (A.augs.includes("a03") ? AUG.a03.v.prey : 0) + (A.augs.includes("a27") && B.m > AUG.a27.v.from ? AUG.a27.v.mul : 0));
      A.m += gain; A.eats++; if (B.m > A.biggestEat) A.biggestEat = B.m; if (A.augs.includes("a14")) A.b.chain = t + AUG.a14.v.t;
      if (B.augs.includes("a21")) { A.poison = { rate: gain * AUG.a21.v.back / AUG.a21.v.t, until: t + AUG.a21.v.t }; }
      if (A.human) A.kills.push(B.fid);
      if (B.human && A.human) A.st.humans++;
      if (A.lastKiller && A.lastKiller === B.fid) { A.st.revenge++; A.lastKiller = 0; this.ev.push({ k: "revenge", f: A.fid, x: Math.round(B.x), y: Math.round(B.y) }); }
      if (!A.bh || B.m > A.bh.m) A.bh = { fid: B.fid, m: Math.round(B.m), t: Math.round(this.t), name: B.human ? B.name : null, ni: B.nameIdx ?? -1 };
    }
    this.dropRemains(B, A.npc ? 0.3 : 0.12);
    this.ev.push({ k: "eat", a: A.fid, b: B.fid, x: Math.round(B.x), y: Math.round(B.y), m: Math.round(B.m), s: B.skin });
    if (B.human || A.human || B.m > 200 || B.donor) this.gev.push({ k: "ate", a: A.fid, b: B.fid, m: Math.round(B.m) });
    this.stats.eats++;
    if (B.donor) { B.state = "dead"; return; }
    B.eatenBy[A.fid] = (B.eatenBy[A.fid] || 0) + 1; B.lastKiller = A.npc ? 0 : A.fid;
    B.state = "dead"; B.deadT = RESPAWN; B.killer = A.fid; B.deaths++; B.dashT = 0; B.kb.x = 0; B.kb.y = 0; B.poison = null; B.lastMass = Math.round(B.m);
    if (A.npc && A.target === B) A.retarget = 0;
  }
  respawn(F) {
    // 증강 절반 유지 (높은 등급 먼저, 같으면 먼저 고른 것)
    const ord = { legend: 0, epic: 1, rare: 2, common: 3 };
    const keepN = Math.ceil(F.augs.length / 2);
    const kept = F.augs.map((id, i) => [id, i]).sort((a, b) => (ord[AUG[a[0]].r] - ord[AUG[b[0]].r]) || (a[1] - b[1])).slice(0, keepN).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    F.augs = kept; F.pend.length = 0; this.recalcSyn(F);
    F.act = [null, null]; for (const id of kept) if (AUG[id].kind === "a") { const s = F.act[0] ? 1 : 0; F.act[s] = id; } F.acd = [0, 0];
    F.m = F.augs.includes("a26") ? AUG.a26.v.m : MASS0; F.state = "alive"; F.protect = this.t + SPAWN_SAFE; F.b = {}; F.stun = 0; F.slow = 0; F.dashCd = 0; F.armorAt = 0; F.bubbleAt = 0; F.eatLog = []; F.brain.tgt = null; F.brain.pel = 0;
    this.spawnAt(F, false);
    this.ev.push({ k: "spawn", f: F.fid, x: Math.round(F.x), y: Math.round(F.y) });
    if (this.aug) this.checkOffer(F);
  }
  recalcSyn(F) { const before = F.syn; F.syn = new Set(SYNERGIES.filter(s => s.req.every(r => F.augs.includes(r))).map(s => s.id)); for (const s of F.syn) if (!before.has(s)) this.gev.push({ k: "syn", f: F.fid, s }); }
  // ---------- 미끼 ----------
  updDecoys(dt) {
    for (const D of this.decoys) { D.x += D.vx * dt; D.y += D.vy * dt; if (D.y < Y0 + 30 || D.y > Y1 - 30) D.vy = -D.vy; if (D.x < 30 || D.x > MAP.w - 30) D.vx = -D.vx; D.ang = Math.atan2(D.vy, D.vx); if (D.until <= this.t && !D.dead) { D.dead = true; this.ev.push({ k: "pop", x: Math.round(D.x), y: Math.round(D.y), f: D.fid }); } }
    if (this.decoys.some(d => d.dead)) this.decoys = this.decoys.filter(d => !d.dead);
  }
  // ---------- AI ----------
  seen(F, Q, see) { // F가 Q를 볼 수 있나
    if (Q.b?.invis > this.t) return false;
    if (Q.augs?.includes("a13") && Q.still >= (Q.syn.has("s10") ? 0.3 : AUG.a13.v.still)) return false;
    if (Q.m <= 80 && !Q.npc && this.inWeed(Q) && d2(F.x, F.y, Q.x, Q.y) > 150 * 150) return false;
    return d2(F.x, F.y, Q.x, Q.y) < see * see;
  }
  botThink(F) {
    const br = F.brain, t = this.t, L = BOT_LV[this.botLv], R = rOf(F.m);
    if ((this.tick + F.fid) % 2) { this.botSteer(F); return; }
    let see = (480 + R * 2.2) * L.see * (F.bot === "hunter" ? 1.15 : 1);
    if (this.darkUntil > t) see *= 0.45;
    if (this.inks.some(k => k.owner !== F.fid && d2(k.x, k.y, F.x, F.y) < k.r * k.r)) see = 110;
    // 위험 (나를 먹을 수 있는 것)
    let fx = 0, fy = 0, danger = null, dd0 = Infinity, prey = null, pv = 0;
    for (const Q of [...this.F.values(), ...this.decoys.map(d => ({ ...d, state: "alive", b: {}, augs: [], syn: new Set(), decoy: true, protect: 0 }))]) {
      if (Q.fid === F.fid || Q.state !== "alive") continue;
      if (!this.seen(F, Q, see + rOf(Q.m))) continue;
      const d = Math.sqrt(d2(F.x, F.y, Q.x, Q.y)), rq = rOf(Q.m);
      if (Q.decoy ? Q.m >= F.m * 1.25 : this.canEat(Q, F)) {
        const w = 1 / Math.max(30, d - rq); fx += (F.x - Q.x) / (d || 1) * w; fy += (F.y - Q.y) / (d || 1) * w;
        if (d - rq < dd0) { dd0 = d - rq; danger = Q; }
      } else if (Q.decoy ? F.m >= Q.m * 1.25 : this.canEat(F, Q)) {
        const v = Q.m / (d + 80) * (F.bot === "hunter" ? 1.6 : F.bot === "shy" ? 0.5 : 1);
        if (v > pv) { pv = v; prey = Q; }
      }
    }
    // 스킬 쓰기 (가끔)
    if (F.act[0] || F.act[1]) for (let s = 0; s < 2; s++) { const id = F.act[s]; if (!id || F.acd[s] > 0 || this.rng() > 0.25) continue;
      const near = danger && dd0 < 200, pnear = prey && Math.hypot(prey.x - F.x, prey.y - F.y) < R + 260;
      if ((["a31", "a32", "a37", "a38", "a35"].includes(id) && near) || (["a33"].includes(id) && (near || pnear)) || (id === "a39" && pnear) || (id === "a34" && pnear) || (id === "a36" && this.rng() < 0.2) || (id === "a40" && this.rng() < 0.05)) { if (id === "a39" && prey) { const l = Math.hypot(prey.x - F.x, prey.y - F.y) || 1; F.in.mx = (prey.x - F.x) / l; F.in.my = (prey.y - F.y) / l; } this.skill(F, s); } }
    const noise = (1 - L.aim) * 0.9;
    if (this.boss && this.boss.atk?.k !== "suck" && F.m >= 30 && (F.bot === "hunter" || F.fid % 2 === 0) && !(danger && dd0 < 250 + R) && this.boss.x > 0 && this.boss.x < MAP.w) {
      const Bo = this.boss, c = this.bossCircles(Bo)[1], l = Math.hypot(c[0] - F.x, c[1] - F.y) || 1; br.dx = (c[0] - F.x) / l; br.dy = (c[1] - F.y) / l; br.mode = "boss";
      if (l < c[2] + R + 220 && F.dashCd <= 0 && this.rng() < 0.5) F.in.btn |= 1; this.botSteer(F); return;
    }
    if (danger && dd0 < 300 + R) {
      // 벽 피하기 섞기
      const wx = F.x < 400 ? 1 : F.x > MAP.w - 400 ? -1 : 0, wy = F.y < Y0 + 300 ? 1 : F.y > Y1 - 300 ? -1 : 0;
      const l = Math.hypot(fx, fy) || 1; br.dx = fx / l + wx * 0.6; br.dy = fy / l + wy * 0.6; br.mode = "flee";
      if (dd0 < 120 && this.rng() < L.dash * 0.5) F.in.btn |= 1;
    } else if (prey && (F.bot !== "shy" || prey.m < F.m * 0.5)) {
      const lead = Math.min(0.5, Math.hypot(prey.x - F.x, prey.y - F.y) / 600);
      const px = prey.x + (prey.vx || 0) * lead, py = prey.y + (prey.vy || 0) * lead, l = Math.hypot(px - F.x, py - F.y) || 1;
      br.dx = (px - F.x) / l; br.dy = (py - F.y) / l; br.mode = "hunt";
      if (l < R * 2 + 170 && prey.m > 6 && this.rng() < L.dash * 0.35 && F.m > 25) F.in.btn |= 1;
    } else {
      // 먹이 찾기 (값/거리), 가끔 바꿈
      let tp = br.pel ? this.pel.get(br.pel) : null;
      if (!tp || br.next < t) {
        let best = null, bv = 0; const sr = Math.min(see, 520);
        this.nearPel(F.x, F.y, sr, (p) => { const d = Math.sqrt(d2(F.x, F.y, p.x, p.y)); const v = (p.type === 2 ? 30 : p.type === 3 || p.type === 4 ? p.v * 1.5 : p.v) / (d + 60); if (v > bv) { bv = v; best = p; } });
        tp = best; br.pel = best ? best.id : 0; br.next = t + 0.8 + this.rng() * 0.6;
      }
      if (tp) { const l = Math.hypot(tp.x - F.x, tp.y - F.y) || 1; br.dx = (tp.x - F.x) / l; br.dy = (tp.y - F.y) / l; br.mode = "food"; }
      else { if (!br.wx || d2(F.x, F.y, br.wx, br.wy) < 150 * 150 || br.next < t - 4) { br.wx = 300 + this.rng() * (MAP.w - 600); br.wy = Y0 + 200 + this.rng() * (Y1 - Y0 - 400); br.next = t + 4; } const l = Math.hypot(br.wx - F.x, br.wy - F.y) || 1; br.dx = (br.wx - F.x) / l; br.dy = (br.wy - F.y) / l; br.mode = "wander"; }
    }
    if (noise) { const a = Math.atan2(br.dy, br.dx) + (this.rng() - 0.5) * noise; br.dx = Math.cos(a); br.dy = Math.sin(a); }
    this.botSteer(F);
  }
  botSteer(F) {
    const br = F.brain; let dx = br.dx || 0, dy = br.dy || 0;
    // 바위 피하기
    const R = rOf(F.m); for (const o of this.rocks) { const ox = F.x + dx * (R + 60) - o.x, oy = F.y + dy * (R + 60) - o.y, rr = o.r + R * 0.6 + 30; if (ox * ox + oy * oy < rr * rr) { const l = Math.hypot(F.x - o.x, F.y - o.y) || 1; dx += (F.x - o.x) / l * 0.9; dy += (F.y - o.y) / l * 0.9; } }
    const l = Math.hypot(dx, dy); F.in.mx = l ? dx / l : 0; F.in.my = l ? dy / l : 0;
    if (br.mode === "food" || br.mode === "wander") { F.in.mx *= 0.85; F.in.my *= 0.85; }
  }
  // ---------- 상어 (이벤트·후원) ----------
  spawnShark(target, dur, donor) {
    const top = [...this.F.values()].filter(F => !F.npc && F.state === "alive").sort((a, b) => b.m - a.m);
    const m = Math.max(1600, (top[0]?.m || 100) * 1.6);
    const side = this.rng() < 0.5 ? -1 : 1, S = this.newFish({ fid: this.npcSeq++, name: ["거대 상어", "巨大ザメ", "Giant Shark"], skin: "shark", npc: "shark", m });
    if (this.npcSeq > 999) this.npcSeq = 900;
    S.x = side < 0 ? -200 : MAP.w + 200; S.y = Y0 + 300 + this.rng() * (Y1 - Y0 - 600); S.protect = 0; S.until = this.t + dur; S.target = target || null; S.retarget = 0; S.donorName = donor || null;
    this.F.set(S.fid, S); this.rosterVer++;
    this.gev.push({ k: "shark", f: S.fid, d: donor || null, tg: target?.fid || 0 });
    return S;
  }
  updNpc(S, dt) {
    const t = this.t;
    if (S.until <= t) { // 떠남
      const ex = S.x < MAP.w / 2 ? -600 : MAP.w + 600; const l = Math.abs(ex - S.x) || 1; S.vx = (ex - S.x) / l * 420; S.vy = 0; S.x += S.vx * dt; S.ang = Math.atan2(S.vy, S.vx);
      if (S.x < -500 || S.x > MAP.w + 500) { S.state = "dead"; }
      return;
    }
    if (!S.target || S.target.state !== "alive" || S.retarget <= t || !this.F.has(S.target.fid)) {
      const cand = [...this.F.values()].filter(F => !F.npc && F.state === "alive" && F.protect <= t && !(F.b.invis > t)).sort((a, b) => b.m - a.m).slice(0, 3);
      S.target = cand.length ? cand[Math.floor(this.rng() * cand.length)] : null; S.retarget = t + 6;
    }
    let dx = 0, dy = 0; if (S.target) { dx = S.target.x - S.x; dy = S.target.y - S.y; } else { dx = MAP.w / 2 - S.x; dy = (Y0 + Y1) / 2 - S.y; }
    const l = Math.hypot(dx, dy) || 1, sp = S.stun > t ? 0 : spdOf(S.m) * 1.45;
    S.vx = dx / l * sp + S.kb.x; S.vy = dy / l * sp + S.kb.y; S.kb.x *= 0.85; S.kb.y *= 0.85;
    S.x += S.vx * dt; S.y += S.vy * dt; S.x = clamp(S.x, -300, MAP.w + 300); S.y = clamp(S.y, Y0, Y1);
    if (Math.hypot(S.vx, S.vy) > 10) S.ang = Math.atan2(S.vy, S.vx);
  }
  // ---------- 이벤트 ----------
  events(dt) {
    const t = this.t;
    for (const e of this.evPlan) if (!e.done && t >= e.at) { e.done = true; this.startEvent(e.k); }
    if (!this.feast && t >= FEAST_AT * this.len / GAME_LEN) { this.feast = true; this.gev.push({ k: "feast" }); }
    if (this.event && this.event.until <= t) { this.gev.push({ k: "evend", e: this.event.k }); this.event = null; }
    // 해류 (서서히 켜지고 꺼짐)
    if (this.curT > t) { const k = Math.min(1, (this.curT - t) / 2, (t - this.curAt) / 2); this.cur = { x: this.curDir.x * 150 * k, y: this.curDir.y * 150 * k }; } else if (this.cur.x || this.cur.y) this.cur = { x: 0, y: 0 };
    // 황금 비: 예고 끝나면 쏟아짐
    for (const g of this.goldWarn) if (!g.done && g.at <= t) { g.done = true; for (let i = 0; i < g.n; i++) { const a = this.rng() * TAU, d = Math.sqrt(this.rng()) * g.r; this.addPel(clamp(g.x + Math.cos(a) * d, 30, MAP.w - 30), clamp(g.y + Math.sin(a) * d, Y0 + 20, Y1 - 20), 2); } this.ev.push({ k: "goldrain", x: Math.round(g.x), y: Math.round(g.y), r: g.r }); }
    this.goldWarn = this.goldWarn.filter(g => !g.done);
  }
  startEvent(k, o = {}) {
    if (!Object.prototype.hasOwnProperty.call(EVENTS, k)) return;
    const t = this.t, E = EVENTS[k];
    this.event = { k, until: t + E.t };
    if (k === "shark") this.spawnShark(null, E.t);
    if (k === "current") { const a = this.rng() < 0.5 ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() - 0.5) * 1.2 + (this.rng() < 0.5 ? 0 : Math.PI); this.curDir = { x: Math.cos(a), y: Math.sin(a) * 0.5 }; this.curAt = t; this.curT = t + E.t; }
    if (k === "gold") { const tops = [...this.F.values()].filter(F => !F.npc && F.state === "alive"); const pick = tops[Math.floor(this.rng() * tops.length)]; const spots = [[600 + this.rng() * (MAP.w - 1200), Y0 + 400 + this.rng() * (Y1 - Y0 - 800)]]; if (pick) spots.push([clamp(pick.x + (this.rng() - 0.5) * 900, 400, MAP.w - 400), clamp(pick.y + (this.rng() - 0.5) * 500, Y0 + 300, Y1 - 300)]); for (const [x, y] of spots) this.goldWarn.push({ x, y, r: 260, n: 26, at: t + 3 }); }
    if (k === "dark") this.darkUntil = t + E.t;
    if (k === "hook") { for (let i = 0; i < 3; i++) this.hooks.push({ id: i, at: t + 1 + i * 5, rank: i, state: 0 }); }
    if (k === "jelly") { const left = this.rng() < 0.5, n = 26, band = Y0 + 300 + this.rng() * (Y1 - Y0 - 900); for (let i = 0; i < n; i++) this.jellies.push({ id: i, x: left ? -60 - this.rng() * 900 : MAP.w + 60 + this.rng() * 900, y0: band + this.rng() * 600, y: 0, vx: (left ? 1 : -1) * (190 + this.rng() * 70), ph: this.rng() * TAU, r: 30 + this.rng() * 14 }); }
    if (k === "whirl") { this.whirl = { x: 1200 + this.rng() * (MAP.w - 2400), y: Y0 + 800 + this.rng() * (Y1 - Y0 - 1600), at: t, until: t + E.t }; }
    this.gev.push({ k: "event", e: k, gw: this.goldWarn.map(g => [Math.round(g.x), Math.round(g.y), g.r]), cd: k === "current" ? [+this.curDir.x.toFixed(2), +this.curDir.y.toFixed(2)] : undefined });
  }
  // 낚싯바늘: 예고(2초) → 떨어짐. hook = { at(조준 시각), rank 또는 target, x, y, r, state 0 대기 1 예고 2 끝 }
  updHooks() {
    const t = this.t;
    for (const h of this.hooks) {
      if (h.state === 0 && t >= h.at) {
        const tg = h.target && h.target.state === "alive" ? h.target : [...this.F.values()].filter(F => !F.npc && F.state === "alive" && !(F.b.invis > t)).sort((a, b) => b.m - a.m)[h.rank || 0];
        if (!tg) { h.state = 2; continue; }
        h.x = clamp(tg.x + tg.vx * 1.2, 60, MAP.w - 60); h.y = clamp(tg.y + tg.vy * 1.2, Y0 + 60, Y1 - 60); h.r = 100 + rOf(tg.m) * 0.5; h.state = 1; h.drop = t + 2; h.tf = tg.fid;
        this.ev.push({ k: "hookwarn", x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.r), f: tg.fid });
      } else if (h.state === 1 && t >= h.drop) {
        h.state = 2;
        for (const F of this.F.values()) { if (F.npc || F.state !== "alive" || F.protect > t) continue; if (d2(F.x, F.y, h.x, h.y) > (h.r + rOf(F.m) * 0.3) ** 2) continue; if (this.bubble(F)) continue;
          const loss = F.m * 0.35; F.m -= loss; F.stun = t + 1; F.hookedAt = 1; this.dropRemainsAt(F.x, F.y, loss * 0.3, rOf(F.m) * 1.6); /* 대부분은 바늘이 끌어올림, 30%만 흩어짐 */ this.gev.push({ k: "hooked", f: F.fid, m: Math.round(loss) }); }
        this.ev.push({ k: "hook", x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.r) });
        const tf = this.F.get(h.tf); if (tf && tf.state === "alive" && !tf.hookedAt) tf.st.dodge++; for (const F of this.F.values()) F.hookedAt = 0;
      }
    }
    this.hooks = this.hooks.filter(h => h.state !== 2);
  }
  // ---------- 증강 고르기 ----------
  // ---------- 해파리 떼 ----------
  updJellies(dt) {
    if (!this.jellies.length) return; const t = this.t;
    for (const J of this.jellies) { J.x += J.vx * dt; J.ph += dt * 2.2; J.y = J.y0 + Math.sin(J.ph) * 60; }
    for (const F of this.F.values()) {
      if (F.state !== "alive" || F.npc || F.protect > t || F.jellyAt > t) continue; const R = rOf(F.m);
      for (const J of this.jellies) { if (d2(F.x, F.y, J.x, J.y) > (R * 0.7 + J.r) ** 2) continue; F.jellyAt = t + 1.5; if (this.bubble(F)) break; F.stun = t + 1; F.m *= 0.95; this.ev.push({ k: "jelly", f: F.fid, x: Math.round(J.x), y: Math.round(J.y) }); break; }
    }
    this.jellies = this.jellies.filter(J => J.x > -1200 && J.x < MAP.w + 1200 && !(t > (this.event?.until ?? 0) && (J.x < -80 || J.x > MAP.w + 80)));
    if (!this.event || this.event.k !== "jelly") this.jellies = this.jellies.filter(J => J.x > -80 && J.x < MAP.w + 80);
  }
  // ---------- 소용돌이 ----------
  whirlArr() { const w = this.whirl; if (!w) return null; const t = this.t; return [w.x, w.y, Math.max(0, Math.min(1, (t - w.at) / 2, (w.until - t) / 2))]; }
  updWhirl() {
    const w = this.whirl; if (!w) return; if (this.t >= w.until) { this.whirl = null; return; }
    if (this.tick % 2 === 0) for (let i = 0; i < 3; i++) { const a = this.rng() * TAU, d = this.rng() * 260; this.addPel(clamp(w.x + Math.cos(a) * d, 30, MAP.w - 30), clamp(w.y + Math.sin(a) * d, Y0 + 20, Y1 - 20), this.rng() < 0.1 ? 2 : 0); }
  }
  // ---------- 보스 물고기 ----------
  bossCircles(B) { const c = Math.cos(B.ang), s = Math.sin(B.ang), r = B.r; return B.kind === "whale" ? [[B.x + c * r * 0.55, B.y + s * r * 0.55, r * 0.52], [B.x, B.y, r * 0.58], [B.x - c * r * 0.62, B.y - s * r * 0.62, r * 0.4]] : [[B.x, B.y - r * 0.15, r * 0.62], [B.x, B.y + r * 0.35, r * 0.5]]; }
  spawnBoss() {
    const D = BOSSES[this.bossKind], alive = [...this.F.values()].filter(F => !F.npc && F.state === "alive").length, left = this.rng() < 0.5;
    this.boss = { kind: this.bossKind, x: left ? -300 : MAP.w + 300, y: (Y0 + Y1) / 2, ang: left ? 0 : Math.PI, r: D.r, hp: D.hp + D.hpPer * alive, max: D.hp + D.hpPer * alive, until: this.t + BOSS_LEN, dmg: new Map(), next: this.t + 5, atk: null, tx: MAP.w / 2, ty: (Y0 + Y1) / 2, retarget: 0, hurt: 0 };
    this.gev.push({ k: "boss", b: this.bossKind });
  }
  hitBoss(F, dmg, kind) {
    const B = this.boss; if (!B || B.hp <= 0 || F.npc) return; dmg = Math.max(1, dmg);
    B.hp -= dmg; B.hurt = this.t + 0.12; B.dmg.set(F.fid, (B.dmg.get(F.fid) || 0) + dmg);
    if (F.human || kind) this.ev.push({ k: "bhit", f: F.fid, d: Math.round(dmg), x: Math.round(F.x), y: Math.round(F.y) });
    if (B.hp <= 0) this.bossDown();
  }
  bossDown() {
    const B = this.boss; if (!B) return; this.boss = null; this.bossDone = true;
    const list = [...B.dmg.entries()].sort((a, b) => b[1] - a[1]); const top = [];
    list.forEach(([fid, d], i) => { const F = this.F.get(fid); if (!F || F.npc) return; const k = BOSS_REWARD[i] ?? 0.05; if (F.state === "alive") { F.m *= 1 + k; if (F.m > F.best) F.best = F.m; } F.st.bossKill = 1; if (i === 0) F.st.bossTop = 1; if (i < 5) top.push([fid, Math.round(d), Math.round(k * 100)]); });
    for (let i = 0; i < 70; i++) { const a = this.rng() * TAU, d = 60 + this.rng() * B.r * 1.8; this.addPel(clamp(B.x + Math.cos(a) * d, 30, MAP.w - 30), clamp(B.y + Math.sin(a) * d, Y0 + 20, Y1 - 20), i < 30 ? 2 : 3, i < 30 ? 22 : 12); }
    this.bossResult = { kind: B.kind, top, killed: true };
    this.ev.push({ k: "bossdown", x: Math.round(B.x), y: Math.round(B.y), r: B.r }); this.gev.push({ k: "bossdown", b: B.kind, top });
  }
  updBoss(dt) {
    const t = this.t;
    if (!this.boss && !this.bossDone && t >= BOSS_AT * this.len / GAME_LEN) { this.bossDone = true; this.spawnBoss(); }
    const B = this.boss; if (!B) return;
    if (t >= B.until) { // 못 잡으면 떠남
      const ex = B.x < MAP.w / 2 ? -700 : MAP.w + 700; B.ang = ex < B.x ? Math.PI : 0; B.x += (ex < B.x ? -1 : 1) * 380 * dt; B.atk = null;
      if (B.x < -600 || B.x > MAP.w + 600) { this.boss = null; this.bossResult = { kind: B.kind, top: [], killed: false }; this.gev.push({ k: "bossgone", b: B.kind }); }
      return;
    }
    const D = BOSSES[B.kind];
    // 이동: 사람(없으면 아무) 물고기 쪽으로 천천히, 머리 방향은 서서히
    if (B.retarget <= t) { const ps = [...this.F.values()].filter(F => !F.npc && F.state === "alive"); const hs = ps.filter(F => F.human); const P = (hs.length && this.rng() < 0.6 ? hs : ps)[Math.floor(this.rng() * Math.max(1, (hs.length && this.rng() < 0.6 ? hs : ps).length))]; if (P) { B.tx = P.x; B.ty = P.y; } B.retarget = t + 3.5; }
    if (!B.atk || B.atk.k !== "suck") { const want = Math.atan2(B.ty - B.y, B.tx - B.x); let da = want - B.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; B.ang += clamp(da, -0.8 * dt, 0.8 * dt); const sp = D.spd * (Math.hypot(B.tx - B.x, B.ty - B.y) > 200 ? 1 : 0.3); B.x += Math.cos(B.ang) * sp * dt; B.y += Math.sin(B.ang) * sp * dt; }
    B.y = clamp(B.y, Y0 + B.r * 0.7, Y1 - B.r * 0.55); if (B.x > -50 && B.x < MAP.w + 50) B.x = clamp(B.x, B.r * 0.6, MAP.w - B.r * 0.6);
    // 공격
    if (!B.atk && B.next <= t) {
      if (B.kind === "whale") { const suck = this.rng() < 0.55; B.atk = suck ? { k: "suck", t0: t, warn: 1.5, len: 2.2 } : { k: "slam", t0: t, warn: 1.2, len: 0.3, x: B.x - Math.cos(B.ang) * B.r * 1.05, y: B.y - Math.sin(B.ang) * B.r * 1.05, r: 340 }; B.next = t + (suck ? 6.5 : 5.5); }
      else { const ink = this.rng() < 0.3; if (ink) { B.atk = { k: "ink", t0: t, warn: 0.8, len: 0.2 }; B.next = t + 6; } else { const near = [...this.F.values()].filter(F => !F.npc && F.state === "alive" && d2(F.x, F.y, B.x, B.y) < 900 * 900).sort(() => this.rng() - 0.5).slice(0, 4); const pts = near.map(F => [clamp(F.x + F.vx * 0.6, 40, MAP.w - 40), clamp(F.y + F.vy * 0.6, Y0 + 40, Y1 - 40)]); while (pts.length < 3) { const a = this.rng() * TAU; pts.push([B.x + Math.cos(a) * 400, B.y + Math.sin(a) * 300]); } B.atk = { k: "tent", t0: t, warn: 1.2, len: 0.25, pts, r: 150 }; B.next = t + 4.5; } }
      this.ev.push({ k: "batk", a: B.atk.k });
    }
    const A = B.atk;
    if (A) {
      const at = t - A.t0, live = at >= A.warn;
      if (A.k === "suck" && live) { const mx = B.x + Math.cos(B.ang) * B.r * 0.95, my = B.y + Math.sin(B.ang) * B.r * 0.95;
        for (const F of this.F.values()) { if (F.npc || F.state !== "alive" || F.protect > t) continue; const dx = mx - F.x, dy = my - F.y, d = Math.hypot(dx, dy) || 1; if (d > 700) continue; const ang = Math.atan2(-dy, -dx); let da = ang - B.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; if (Math.abs(da) > 0.75) continue;
          if (this.bubble(F)) continue; F.kb.x += dx / d * 320 * dt * 6; F.kb.y += dy / d * 320 * dt * 6;
          if (d < B.r * 0.35 + rOf(F.m) * 0.3 && F.m < 700) this.eat({ npc: "boss", fid: 999, m: 1e9, b: {}, augs: [], target: null }, F); } }
      if (A.k === "slam" && live && !A.done) { A.done = true; for (const F of this.F.values()) { if (F.npc || F.state !== "alive" || F.protect > t) continue; const d = Math.hypot(F.x - A.x, F.y - A.y) || 1; if (d > A.r + rOf(F.m) * 0.5) continue; if (this.bubble(F)) continue; F.kb.x += (F.x - A.x) / d * 900; F.kb.y += (F.y - A.y) / d * 900; F.stun = t + 0.8; const loss = F.m * 0.08; F.m -= loss; this.dropRemainsAt(F.x, F.y, loss * 0.5, rOf(F.m) * 1.5); } this.ev.push({ k: "slam", x: Math.round(A.x), y: Math.round(A.y), r: A.r }); }
      if (A.k === "ink" && live && !A.done) { A.done = true; this.inks.push({ x: B.x, y: B.y, r: 560, until: t + 4, owner: -1 }); this.ev.push({ k: "ink", x: Math.round(B.x), y: Math.round(B.y), r: 560 }); }
      if (A.k === "tent" && live && !A.done) { A.done = true; for (const [px, py] of A.pts) { for (const F of this.F.values()) { if (F.npc || F.state !== "alive" || F.protect > t) continue; if (d2(F.x, F.y, px, py) > (A.r + rOf(F.m) * 0.4) ** 2) continue; if (this.bubble(F)) continue; F.stun = t + 1; const loss = F.m * 0.12; F.m -= loss; this.dropRemainsAt(F.x, F.y, loss * 0.5, rOf(F.m) * 1.5); } this.ev.push({ k: "slam", x: Math.round(px), y: Math.round(py), r: A.r }); } }
      if (at >= A.warn + A.len) B.atk = null;
    }
    // 몸에 부딪히면 피해 (돌진이면 크게) + 튕겨남
    const cs = this.bossCircles(B);
    for (const F of this.F.values()) {
      if (F.npc || F.state !== "alive" || F.bossHitAt > t) continue; const R = rOf(F.m);
      for (const [cx, cy, cr] of cs) { const dd = d2(F.x, F.y, cx, cy); if (dd > (cr + R * 0.6) ** 2) continue; const d = Math.sqrt(dd) || 1, dash = F.dashT > 0;
        this.hitBoss(F, dash ? (8 + F.m * 0.06) * (F.torpedo ? 2 : 1) : 2 + F.m * 0.02, dash); F.bossHitAt = t + (dash ? 0.4 : 0.45);
        F.kb.x += (F.x - cx) / d * (dash ? 520 : 260); F.kb.y += (F.y - cy) / d * (dash ? 520 : 260); if (dash) F.dashT = 0; break; }
      if (!this.boss) return;
    }
  }
  checkOffer(F) {
    if (!this.aug || F.npc || F.donor) return;
    const n = F.augs.length + F.pend.length; if (n >= MAX_AUGS) return;
    if (F.m >= AUG_AT[n]) this.offer(F);
  }
  offer(F) {
    const have = new Set([...F.augs, ...F.pend.flatMap(p => p.opts)]), acts = F.augs.filter(a => AUG[a].kind === "a").length, legs = F.augs.filter(LEG).length;
    const tier = F.augs.length + F.pend.length, luck = F.augs.includes("a25");
    const pool = AUGS.filter(a => !F.augs.includes(a.id) && !(a.kind === "a" && acts >= MAX_ACTIVE) && !(a.r === "legend" && legs >= MAX_LEGEND));
    const w = (a) => { let x = RARITY_W[a.r]; if (a.r !== "common") x *= 1 + tier * 0.18 + (luck ? 0.6 : 0); if (a.r === "legend" && tier < 2) x *= 0.3; if (a.kind === "a" && acts === 0) x *= 1.3; return x; };
    const opts = [], want = luck ? 4 : 3;
    const avail = pool.slice();
    while (opts.length < want && avail.length) { let sum = 0; for (const a of avail) sum += w(a); let r = this.rng() * sum, pick = avail[0]; for (const a of avail) { r -= w(a); if (r <= 0) { pick = a; break; } } opts.push(pick.id); avail.splice(avail.indexOf(pick), 1); }
    if (!opts.length) return;
    const p = { n: ++F.pickN, kind: "aug", opts, until: this.t + 14, multi: this.humanCount() > 1 };
    F.pend.push(p);
    if (F.human && F.id) this.o.out?.("pick", { n: p.n, kind: p.kind, opts: p.opts, multi: p.multi }, F.id);
  }
  pick(pid, n, id) {
    const F = this.fishById(pid); if (!F) return { ok: false, error: "NO_PLAYER" };
    const i = F.pend.findIndex(p => p.n === n); if (i < 0) return { ok: false, error: "NO_OFFER" };
    const p = F.pend[i]; if (!p.opts.includes(id)) return { ok: false, error: "BAD_PICK" };
    F.pend.splice(i, 1); this.applyAug(F, id); return { ok: true };
  }
  applyAug(F, id) {
    if (!AUG[id] || F.augs.includes(id) || F.augs.length >= MAX_AUGS) return; // 없는 증강은 무시 (잘못 들어가면 매 틱 오류)
    F.augs.push(id); F.picks++;
    if (AUG[id].kind === "a") { const s = F.act[0] ? (F.act[1] ? -1 : 1) : 0; if (s >= 0) { F.act[s] = id; F.acd[s] = 0; } }
    this.recalcSyn(F);
    this.ev.push({ k: "aug", f: F.fid, x: Math.round(F.x), y: Math.round(F.y), a: id });
    if (AUG[id].r === "legend") this.gev.push({ k: "legend", f: F.fid, a: id });
    this.checkOffer(F);
  }
  autoPick(F, p) {
    // 스킬이 없으면 스킬 먼저, 아니면 등급 높은 것
    const ord = { legend: 4, epic: 3, rare: 2, common: 1 };
    const best = p.opts.slice().sort((a, b) => ((AUG[b].kind === "a" && !F.act[0] ? 2 : 0) + ord[AUG[b].r]) - ((AUG[a].kind === "a" && !F.act[0] ? 2 : 0) + ord[AUG[a].r]))[0];
    F.pend.splice(F.pend.indexOf(p), 1); this.applyAug(F, best);
    if (F.human && F.id) this.o.out?.("autopicked", { n: p.n }, F.id);
  }
  checkPicks() {
    const solo = this.humanCount() <= 1; let anyPending = false;
    for (const F of this.F.values()) {
      if (F.npc) continue;
      if (F.state === "alive" && this.aug && !F.pend.length) this.checkOffer(F);
      for (const p of [...F.pend]) {
        if (!F.human || F.left) { this.autoPick(F, p); continue; }
        if (F.state === "dead") continue;
        if (solo) { anyPending = true; if (!p.wall) p.wall = Date.now() + 30000; if (Date.now() > p.wall) this.autoPick(F, p); }
        else if (this.t >= p.until) this.autoPick(F, p);
      }
    }
    this.paused = solo && anyPending;
  }
  // ---------- 끝 ----------
  ranking() { return [...this.F.values()].filter(F => !F.npc && !F.donor).sort((a, b) => (b.state === "alive" ? b.m : 0) - (a.state === "alive" ? a.m : 0) || b.best - a.best); }
  finish() {
    if (this.status !== "play") return;
    this.status = "ended";
    const rank = this.ranking();
    let teamScore = null, winner = null;
    if (this.mode === "team") { teamScore = new Array(this.teams).fill(0); for (const F of rank) if (F.state === "alive") teamScore[F.team] += F.m; teamScore = teamScore.map(Math.round); const mx = Math.max(...teamScore); winner = teamScore.filter(x => x === mx).length > 1 ? "draw" : teamScore.indexOf(mx); }
    this.result = { rank: rank.map((F, i) => ({ fid: F.fid, rank: i + 1, human: F.human, idx: F.idx, id: F.id, name: F.human ? F.name : null, ni: F.nameIdx ?? -1, skin: F.skin, team: F.team, m: F.state === "alive" ? Math.round(F.m) : 0, best: Math.round(F.best), eats: F.eats, food: F.food, deaths: F.deaths, augs: F.augs.slice(), big: Math.round(F.biggestEat), ...(F.human ? { tl: [...F.tl, Math.round(F.state === "alive" ? F.m : 0)], eb: Object.entries(F.eatenBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => [+f, n]), bh: F.bh, st: F.st, leg: F.augs.filter(a => AUG[a].r === "legend").length, syn: F.syn.size } : {}) })), teamScore, winner, t: Math.round(this.t), eats: this.stats.eats, boss: this.bossResult };
    this.o.onEnd?.();
  }
  // ---------- 화면으로 보내기 ----------
  /** 보는 사람 하나 — me(물고기 또는 null), 중심, 화면 반폭(월드 단위), 아는 먹이 목록 */
  view(me, cx, cy, vw, known) {
    const t = this.t, hw = vw.hw, hh = vw.hh, x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
    const inV = (x, y, pad) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
    // 물고기
    const fish = [];
    for (const F of this.F.values()) {
      if (F.state !== "alive") continue; const R = rOf(F.m);
      if (!inV(F.x, F.y, R + 40)) continue;
      if (F.b.invis > t && F !== me && !(me && this.ally(me, F))) continue; // 투명: 나·우리 팀만
      fish.push(F);
    }
    const dec = this.decoys.filter(D => inV(D.x, D.y, rOf(D.m) + 40));
    // 새우
    const kr = []; for (const k of this.krill) if (inV(k.x, k.y, 20)) { kr.push(k); if (kr.length >= 120) break; }
    // 먹이: 새로 보인 것 (아는 목록에 없는 것)
    const add = [], rm = [];
    for (let i = 0; i < this.gone.length; i += 2) { const id = this.gone[i]; if (known.has(id)) { known.delete(id); rm.push(id, this.gone[i + 1]); } }
    if (this.tick % 10 === 0) { for (const id of known) { const p = this.pel.get(id); if (!p || !inV(p.x, p.y, 420)) { known.delete(id); rm.push(id, 0); } } }
    { const gx0 = clamp(((x0 - 60) / GRID) | 0, 0, GW - 1), gx1 = clamp(((x1 + 60) / GRID) | 0, 0, GW - 1), gy0 = clamp(((y0 - 60) / GRID) | 0, 0, GH - 1), gy1 = clamp(((y1 + 60) / GRID) | 0, 0, GH - 1);
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) for (const p of this.pg[gy * GW + gx]) { if (known.has(p.id)) continue; if (add.length >= 900) break; known.add(p.id); add.push(p); } }
    const nf = fish.length + dec.length, buf = new ArrayBuffer(8 + nf * 14 + kr.length * 7 + add.length * 9 + (rm.length / 2) * 6), dv = new DataView(buf);
    dv.setUint16(0, nf, true); dv.setUint16(2, kr.length, true); dv.setUint16(4, add.length, true); dv.setUint16(6, rm.length / 2, true);
    let o = 8;
    const put = (fid, x, y, m, ang, fl, skin) => { dv.setUint16(o, fid, true); dv.setInt16(o + 2, Math.round(x), true); dv.setInt16(o + 4, Math.round(y), true); dv.setFloat32(o + 6, m, true); dv.setInt8(o + 10, Math.round(((ang % TAU) + TAU) % TAU / TAU * 255) - 128); dv.setUint16(o + 11, fl, true); dv.setUint8(o + 13, skin); o += 14; };
    for (const F of fish) {
      let f = 0; if (F.protect > t) f |= FL.protect; if (F.dashT > 0) f |= FL.dash; if (F.b.shark > t) f |= FL.shark; if (F.b.puff > t) f |= FL.puff; if (F.b.invis > t) f |= FL.invis;
      if (F.augs.includes("a13") && F.still >= (F.syn.has("s10") ? 0.3 : AUG.a13.v.still)) f |= FL.camo; if (F.stun > t) f |= FL.stun; if (F.augs.includes("a05") && F.armorAt <= t) f |= FL.armor;
      if (F.m <= 80 && !F.npc && this.inWeed(F)) f |= FL.weed; if (F.b.frenzy > t) f |= FL.frenzy; if (F.npc) f |= FL.npc; if (F.donor) f |= FL.donor; if (F.torpedo) f |= FL.torpedo; if (F.poison) f |= FL.poison;
      if (this.inks.some(k => k.owner !== F.fid && d2(k.x, k.y, F.x, F.y) < k.r * k.r)) f |= FL.blind;
      put(F.fid, F.x, F.y, F.m, F.ang, f, F.npc ? 254 : SKIN_IDS.indexOf(F.skin));
    }
    for (const D of dec) put(D.fid, D.x, D.y, D.m, D.ang, FL.decoy, SKIN_IDS.indexOf(D.skin));
    for (const k of kr) { dv.setUint16(o, k.id, true); dv.setInt16(o + 2, Math.round(k.x), true); dv.setInt16(o + 4, Math.round(k.y), true); dv.setInt8(o + 6, Math.round(((k.a % TAU) + TAU) % TAU / TAU * 255) - 128); o += 7; }
    for (const p of add) { dv.setUint32(o, p.id, true); dv.setInt16(o + 4, p.x, true); dv.setInt16(o + 6, p.y, true); dv.setUint8(o + 8, p.type | ((p.type >= 3 ? clamp(Math.round(Math.sqrt(p.v)), 0, 31) : 0) << 3)); o += 9; }
    for (let i = 0; i < rm.length; i += 2) { dv.setUint32(o, rm[i], true); dv.setUint16(o + 4, rm[i + 1], true); o += 6; }
    // JSON
    const ev = []; for (const e of this.ev) if (e.x === undefined || inV(e.x, e.y, 400)) ev.push(e);
    const j = { t: +this.t.toFixed(2), ev };
    if (this.gev.length) j.g = this.gev;
    if (this.cur.x || this.cur.y) j.cur = [Math.round(this.cur.x), Math.round(this.cur.y)];
    if (this.darkUntil > t) j.dk = 1;
    if (this.inks.length) { const ik = this.inks.filter(k => inV(k.x, k.y, k.r)).map(k => [Math.round(k.x), Math.round(k.y), Math.round(k.r), +(k.until - t).toFixed(1), k.owner]); if (ik.length) j.ink = ik; }
    if (this.hooks.length) { const hk = this.hooks.filter(h => h.state === 1).map(h => [Math.round(h.x), Math.round(h.y), Math.round(h.r), +(h.drop - t).toFixed(2)]); if (hk.length) j.hk = hk; }
    if (this.goldWarn.length) j.gw = this.goldWarn.map(g => [Math.round(g.x), Math.round(g.y), g.r, +(g.at - t).toFixed(1)]);
    if (this.event) j.e = [this.event.k, +(this.event.until - t).toFixed(1)];
    if (this.feast) j.fe = 1;
    if (me && me.state === "alive") j.sp = Math.round(this.speedOf(me)); // 내 예측 이동용
    if (this.jellies.length) { const jl = []; for (const J of this.jellies) if (inV(J.x, J.y, 60)) jl.push([J.id, Math.round(J.x), Math.round(J.y), J.r | 0]); if (jl.length) j.jl = jl; }
    if (this.whirl) { const w = this.whirlArr(); j.wh = [Math.round(w[0]), Math.round(w[1]), +w[2].toFixed(2)]; }
    if (this.boss) { const B = this.boss, A = B.atk; j.bo = [B.kind, Math.round(B.x), Math.round(B.y), +B.ang.toFixed(3), Math.max(0, Math.round(B.hp)), Math.round(B.max), B.hurt > t ? 1 : 0, Math.max(0, Math.ceil(B.until - t)), A ? [A.k, +Math.max(0, A.warn - (t - A.t0)).toFixed(2), A.x !== undefined ? Math.round(A.x) : 0, A.y !== undefined ? Math.round(A.y) : 0, A.r || 0, A.pts ? A.pts.map(p => p.map(Math.round)) : 0] : 0]; }
    if (this.tick % 10 === 0) { j.top = this.ranking().slice(0, 10).map(F => [F.fid, Math.round(F.state === "alive" ? F.m : 0), Math.round(F.x), Math.round(F.y)]); if (this.mode === "team") { const s = new Array(this.teams).fill(0); for (const F of this.F.values()) if (!F.npc && F.state === "alive") s[F.team] += F.m; j.ts = s.map(Math.round); } }
    if (me && me.b.sonar > t && this.tick % 4 === 0) j.son = [...this.F.values()].filter(F => F.state === "alive" && F !== me && !(F.b.invis > t)).map(F => [F.fid, Math.round(F.x), Math.round(F.y), Math.round(F.m)]);
    return { j, buf };
  }
  hud(F) {
    const t = this.t, rank = this.ranking(), ri = rank.indexOf(F);
    return { m: Math.round(F.m), best: Math.round(F.best), e: F.eats, k: F.food, d: F.deaths, a: F.augs, s: [...F.syn], act: F.act, cd: [Math.max(0, +F.dashCd.toFixed(1)), Math.max(0, +F.acd[0].toFixed(1)), Math.max(0, +F.acd[1].toFixed(1))],
      pk: F.pend.map(p => ({ n: p.n, kind: p.kind, opts: p.opts, multi: p.multi })), rk: ri + 1, n: rank.length, st: F.state, rs: F.state === "dead" ? +Math.max(0, F.deadT).toFixed(1) : 0, kl: F.state === "dead" ? F.killer : 0, lm: F.lastMass || 0,
      ar: F.augs.includes("a05") ? Math.max(0, Math.ceil(F.armorAt - t)) : -1, bb: F.augs.includes("a28") ? Math.max(0, Math.ceil(F.bubbleAt - t)) : -1, next: this.aug && F.augs.length + F.pend.length < MAX_AUGS ? AUG_AT[F.augs.length + F.pend.length] : 0,
      b: Object.entries(F.b).filter(([, v]) => v > t).map(([k, v]) => [k, +(v - t).toFixed(1)]), dm: F.dashT > 0 ? F.dashMul : 0, dt: F.dashT };
  }
}
