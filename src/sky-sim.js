// =========================
// DUO 증강 공중전 — 서버 시뮬레이션 (2026-11-21)
// · World 하나 = 하늘 하나 (사람 + AI 비행기 최대 50). 비행·사격·피해·격추·별·증강·이벤트·보스·AI 판정은 전부 여기서
// · 비행기는 항상 앞으로 날고 원하는 방향으로 선회(선회 속도 제한). 총알은 빠르니 '지나간 선분'으로 맞음 판정
// · 화면에는 관심 영역만: 비행기·총알은 매 틱 바이너리, 별은 새로 보인 것·사라진 것만 (known)
// =========================
import { TICK, MAP, EDGE, GAME_LEN, MAX_FISH, MAX_AUGS, MAX_ACTIVE, MAX_LEGEND, AUG_AT, PLANE, GUN, ROLL, RESPAWN, SPAWN_SAFE, SCORE, STAR, PICKUPS, spdBase,
  SKIN_IDS, AUGS, AUG, RARITY_W, SYNERGIES, EVENT_AT, EVENTS, EVENT_IDS, DOUBLE_AT, BOSS_AT, BOSS_LEN, BOSSES, BOSS_IDS, BOSS_REWARD, BOT_LV, BOT_NAMES, SKINS, SKIN_ST0, THEMES, TURRET } from "./sky-data.js";

const GRID = 160, GW = Math.ceil(MAP.w / GRID), GH = Math.ceil(MAP.h / GRID);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angDiff = (a, b) => { const d = a - b; if (d >= -Math.PI && d <= Math.PI) return d; return ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI; };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function segHit(ax, ay, bx, by, cx, cy, r) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = ax + dx * t - cx, py = ay + dy * t - cy; return px * px + py * py <= r * r; }
export const FL = { protect: 1, roll: 2, boost: 4, shield: 8, burn: 16, emp: 32, stun: 64, after: 128, airship: 256, power: 512, bounty: 1024, flare: 2048, warp: 4096, npc: 8192, donor: 16384, hurt: 32768 };
// 총알 종류 (화면 그림)
export const BK = { gun: 0, missile: 1, mine: 2, boss: 3, tail: 4, wing: 5, counter: 6, chain: 7, turret: 8 };
const LEG = (id) => AUG[id]?.r === "legend";
const X0 = EDGE, X1 = MAP.w - EDGE, Y0 = EDGE, Y1 = MAP.h - EDGE;

export class World {
  constructor(o) {
    this.o = o; this.aug = o.aug !== false; this.mode = o.mode === "team" ? "team" : "ffa"; this.teams = this.mode === "team" ? clamp(o.teams | 0 || 2, 2, 5) : 0;
    this.botLv = BOT_LV[o.botLv] ? o.botLv : "normal"; this.fill = clamp(o.fill ?? 30, 0, MAX_FISH);
    this.rng = mulberry((o.seed ^ 0x9e3779b9) >>> 0);
    this.t = 0; this.tick = 0; this.status = "play"; this.paused = false; this.result = null; this.len = o.len || GAME_LEN;
    this.F = new Map(); this.fidSeq = 1; this.botSeq = 100; this.npcSeq = 900;
    this.bul = []; this.bulSeq = 1;
    this.stars = new Map(); this.starSeq = 1; this.sg = new Array(GW * GH); for (let i = 0; i < this.sg.length; i++) this.sg[i] = [];
    this.pickups = []; this.pickSeq = 1; this.warns = []; this.bombs = [];
    this.ev = []; this.gev = []; this.gone = [];
    this.wind = { x: 0, y: 0 }; this.windT = 0; this.event = null; this.double = false; this.storm = 0; this.bountyFid = 0;
    this.evPlan = []; { const ids = EVENT_IDS.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } this.evPlan = EVENT_AT.map((at, i) => ({ at: at * this.len / GAME_LEN, k: ids[i % ids.length], done: false })); }
    this.boss = null; this.bossKind = BOSS_IDS[Math.floor(mulberry((o.seed * 3 + 1) >>> 0)() * BOSS_IDS.length)]; this.bossDone = false; this.bossResult = null;
    this.islands = this.makeIslands(); this.clouds = this.makeClouds();
    this.theme = THEMES[((o.seed >>> 3) % THEMES.length + THEMES.length) % THEMES.length];
    this.tur = this.islands.slice().sort((a, b) => b.r - a.r).slice(0, TURRET.n).map((o2, i) => ({ id: i, x: Math.round(o2.x), y: Math.round(o2.y), own: -1, by: 0, side: -1, prog: 0, cd: 0, aim: 0 }));
    this.balloons = []; this.balSeq = 1;
    this.stats = { kills: 0 }; this.rosterVer = 1;
    (o.players || []).forEach(p => this.addHuman(p, false));
    this.balanceBots();
    for (let i = 0; i < 260; i++) this.spawnStar(null, null, 1 + Math.floor(this.rng() * 3));
  }
  // ---------- 지형 (그림만, 비행엔 영향 없음) ----------
  makeIslands() { const r = mulberry((this.o.seed * 7 + 13) >>> 0), list = []; for (let i = 0; i < 60 && list.length < 14; i++) { const x = 400 + r() * (MAP.w - 800), y = 400 + r() * (MAP.h - 800), rad = 140 + r() * 220; if (list.some(o => d2(o.x, o.y, x, y) < (o.r + rad + 300) ** 2)) continue; list.push({ x, y, r: rad, k: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) }); } return list; }
  makeClouds() { const r = mulberry((this.o.seed * 11 + 5) >>> 0), list = []; for (let i = 0; i < 26; i++) list.push({ x: r() * MAP.w, y: r() * MAP.h, s: 0.7 + r() * 1.1, k: Math.floor(r() * 3), seed: Math.floor(r() * 1e6) }); return list; }
  // ---------- 비행기 ----------
  newPlane(o) {
    const P = { fid: o.fid, id: o.id || null, name: o.name, skin: SKIN_IDS.includes(o.skin) ? o.skin : SKIN_IDS[Math.floor(this.rng() * SKIN_IDS.length)], team: o.team || 0, idx: o.idx ?? -1,
      human: !!o.human, bot: o.bot || null, npc: o.npc || null, donor: o.donor || null, nameIdx: o.nameIdx,
      x: 0, y: 0, vx: 0, vy: 0, ang: 0, hp: PLANE.hp, maxHp: PLANE.hp, sh: 0, bar: 0, barT: 0, state: "alive", deadT: 0, killer: 0, protect: this.t + SPAWN_SAFE,
      in: { ang: 0, has: false, fire: false, boost: false, seq: 0, btn: 0 }, boost: PLANE.boostMax, boosting: false, rollT: 0, rollCd: 0, fireCd: 0,
      augs: [], syn: new Set(), act: [null, null], acd: [0, 0], pend: [], pickN: 0,
      xp: 0, score: 0, kills: 0, deaths: 0, assists: 0, streak: 0, bestStreak: 0, b: {}, burn: null, dmgBy: new Map(), lastHit: -99, focus: { fid: 0, n: 0 },
      at: { missile: 0, mine: 0, laser: 0, tail: 0, shgen: 0, eject: 0 }, wing: [], st: { stars: 0, bounty: 0, dodge: 0, revenge: 0, humans: 0, ejects: 0, shots: 0, hits: 0 }, vic: {}, multi: 0, lastKillT: -99, bestMulti: 0, lastKiller: 0, killedBy: {}, bk: null, tl: [],
      brain: { tgt: 0, next: 0, wx: 0, wy: 0, rollAt: 0 } };
    P.maxHp = P.hp = this.hp0(P); P.boost = this.bmaxOf(P);
    this.spawnAt(P);
    return P;
  }
  stOf(P) { return P.npc || P.donor ? SKIN_ST0 : (SKINS[P.skin]?.st || SKIN_ST0); }
  turnOf(P) { const t = this.t; return PLANE.turn * this.stOf(P).turn * (1 + (P.augs.includes("b14") ? AUG.b14.v.turn : 0)) * (P.b.airship > t ? 0.55 : 1) * (P.b.warp > t ? 0.5 : 1); }
  bmaxOf(P) { return PLANE.boostMax * this.stOf(P).bo * (1 + (P.augs.includes("b15") ? AUG.b15.v.max : 0)); }
  hp0(P) { return Math.round(PLANE.hp * this.stOf(P).hp); }
  addHuman(p, mid = true) { const P = this.newPlane({ fid: this.fidSeq++, id: p.id, name: p.name, skin: p.skin, team: p.team, idx: p.idx, human: true }); this.F.set(P.fid, P); this.rosterVer++; if (mid) this.balanceBots(); return P; }
  removeHuman(id) { const P = this.planeById(id); if (P) { this.dropStars(P, 0.5); this.F.delete(P.fid); this.rosterVer++; this.balanceBots(); } }
  planeById(id) { for (const P of this.F.values()) if (P.id === id) return P; return null; }
  humanCount() { let n = 0; for (const P of this.F.values()) if (P.human) n++; return n; }
  balanceBots() {
    const humans = this.humanCount(), want = Math.max(0, Math.min(MAX_FISH - humans, this.fill - humans));
    const bots = [...this.F.values()].filter(P => P.bot && !P.human && !P.npc && !P.donor);
    if (bots.length < want) { const used = new Set(bots.map(b => b.nameIdx)); for (let i = bots.length; i < want; i++) { let ni = Math.floor(this.rng() * BOT_NAMES.length); for (let g = 0; g < 60 && used.has(ni); g++) ni = (ni + 7) % BOT_NAMES.length; used.add(ni); const P = this.newPlane({ fid: this.botSeq++, name: BOT_NAMES[ni], nameIdx: ni, team: this.mode === "team" ? this.smallTeam() : 0, bot: this.rng() < 0.35 ? "ace" : "normal" }); const Ld = this.lastLeader && this.F.get(this.lastLeader); if (Ld && Ld.bot && !Ld.npc && Ld.team === P.team && (Ld.wingN || 0) < 2 && this.rng() < 0.6) { P.wingOf = Ld.fid; Ld.wingN = (Ld.wingN || 0) + 1; } else this.lastLeader = P.fid; this.F.set(P.fid, P); } this.rosterVer++; }
    else if (bots.length > want) { bots.sort((a, b) => a.score - b.score); for (let i = 0; i < bots.length - want; i++) { this.ev.push({ k: "pop", x: Math.round(bots[i].x), y: Math.round(bots[i].y) }); this.F.delete(bots[i].fid); } this.rosterVer++; }
  }
  smallTeam() { const c = new Array(this.teams).fill(0); for (const P of this.F.values()) if (!P.npc) c[P.team]++; let b = 0; for (let i = 1; i < this.teams; i++) if (c[i] < c[b]) b = i; return b; }
  roster() { return [...this.F.values()].map(P => [P.fid, P.human ? P.idx : -1, P.bot ? P.nameIdx ?? -1 : -1, P.skin, P.team, P.npc ? 2 : P.donor ? 3 : P.bot ? 1 : 0, P.donor || (P.human ? P.name : "")]); }
  spawnAt(P) {
    for (let g = 0; g < 40; g++) {
      const x = X0 + 200 + this.rng() * (X1 - X0 - 400), y = Y0 + 200 + this.rng() * (Y1 - Y0 - 400);
      let ok = true; for (const Q of this.F.values()) if (Q !== P && Q.state === "alive" && !this.ally(P, Q) && d2(Q.x, Q.y, x, y) < 750 * 750) { ok = false; break; }
      if (ok || g === 39) { P.x = x; P.y = y; break; }
    }
    P.ang = Math.atan2(MAP.h / 2 - P.y, MAP.w / 2 - P.x) + (this.rng() - 0.5); P.in.ang = P.ang; P.in.has = false;
  }
  ally(A, B) { if (A === B) return true; if (A.npc && B.npc) return true; if (A.npc || B.npc) return false; return this.mode === "team" && !A.donor && !B.donor && A.team === B.team; }
  // ---------- 별 ----------
  scell(x, y) { return clamp((y / GRID) | 0, 0, GH - 1) * GW + clamp((x / GRID) | 0, 0, GW - 1); }
  addStar(x, y, v) { if (this.stars.size > 2500) return null; const s = { id: this.starSeq++, x: Math.round(clamp(x, 30, MAP.w - 30)), y: Math.round(clamp(y, 30, MAP.h - 30)), v: Math.max(1, Math.round(v)), c: 0, i: 0 }; s.c = this.scell(s.x, s.y); const cell = this.sg[s.c]; s.i = cell.length; cell.push(s); this.stars.set(s.id, s); if (this.starSeq > 0xfffffff0) this.starSeq = 1; return s; }
  delStar(s, eater = 0) { const cell = this.sg[s.c], last = cell.pop(); if (last !== s) { cell[s.i] = last; last.i = s.i; } this.stars.delete(s.id); this.gone.push(s.id, eater); }
  spawnStar(x, y, v) { return this.addStar(x ?? X0 + this.rng() * (X1 - X0), y ?? Y0 + this.rng() * (Y1 - Y0), v); }
  nearStar(x, y, r, fn) { const x0 = clamp(((x - r) / GRID) | 0, 0, GW - 1), x1 = clamp(((x + r) / GRID) | 0, 0, GW - 1), y0 = clamp(((y - r) / GRID) | 0, 0, GH - 1), y1 = clamp(((y + r) / GRID) | 0, 0, GH - 1); for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const cell = this.sg[cy * GW + cx]; for (let i = cell.length - 1; i >= 0; i--) { const s = cell[i]; if (s) fn(s); } } }
  dropStars(P, frac, mul = 1) { const total = (8 + P.xp * frac) * mul, n = clamp(Math.round(total / 4), 3, 16); for (let i = 0; i < n; i++) { const a = this.rng() * TAU, d = 30 + this.rng() * 110; this.addStar(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, total / n); } }
  // ---------- 입력 ----------
  input(pid, d) {
    const P = this.planeById(pid); if (!P) return false;
    const seq = d.s | 0, last = P.rxSeq ?? P.in.seq; if (seq <= last && last - seq < 1e6) return false;
    // 입력은 줄 세워서 한 틱에 하나씩 (네트워크로 두 개가 한꺼번에 와도 화면 예측과 같은 순서·같은 걸음)
    const a = Number(d.a); P.rxSeq = seq;
    (P.inQ ||= []).push({ s: seq, a: Number.isFinite(a) ? clamp(a, -7, 7) : null, f: !!d.f, bo: !!d.bo, b: (d.b | 0) & 7 }); // b: 1 배럴롤 · 2 Q · 4 E
    if (P.inQ.length > 12) P.inQ.shift();
    return true;
  }
  /** 줄 선 입력 하나 꺼내 적용 (밀렸으면 옛것은 버튼만 모으고 건너뜀). all이면 다 비우고 마지막 것만 */
  takeInput(P, all = false) {
    const Q = P.inQ; if (!Q || !Q.length) return;
    let q = Q.shift(), btn = q.b;
    while (Q.length > (all ? 0 : 3)) { q = Q.shift(); btn |= q.b; }
    if (q.a != null) { P.in.ang = q.a; P.in.has = true; } else P.in.has = false;
    P.in.fire = q.f; P.in.boost = q.bo; P.in.seq = q.s; P.in.btn |= btn;
  }
  // ---------- 틱 ----------
  step() {
    if (this.status !== "play") return;
    this.ev.length = 0; this.gev.length = 0; this.gone.length = 0;
    if (this.paused) { for (const P of this.F.values()) { this.takeInput(P, true); P.in.btn = 0; } this.checkPicks(); return; }
    const dt = TICK; this.t += dt; this.tick++;
    this.events(dt);
    for (const P of this.F.values()) this.updPlane(P, dt);
    this.updBoss(dt);
    this.updBullets(dt);
    this.updBombs(dt);
    this.updPickups();
    this.updTurrets(dt);
    if (this.balloons.length) this.updBalloons(dt);
    // 별 채우기
    const tgt = 240 + this.F.size * 4; if (this.stars.size < tgt && this.tick % 3 === 0) this.spawnStar(null, null, 1 + Math.floor(this.rng() * 3));
    if (this.tick % 100 === 0) for (const P of this.F.values()) if (P.human) { P.tl.push(Math.round(P.score)); if (P.tl.length > 80) P.tl.shift(); }
    if (this.tick % 140 === 0 && this.pickups.length < 6) this.spawnPickup(null);
    this.checkPicks();
    if (this.t >= this.len) this.finish();
  }
  lvl(P) { return P.augs.length + 1; }
  // ---------- 비행기 한 대 ----------
  updPlane(P, dt) {
    const t = this.t;
    this.takeInput(P, P.state === "dead");
    if (P.state === "dead") { if (P.npc || P.donor) { this.F.delete(P.fid); this.rosterVer++; return; } P.deadT -= dt; if (P.deadT <= 0) this.respawn(P); return; }
    if ((P.npc || P.donor) && P.until && P.until <= t) { P.state = "dead"; this.ev.push({ k: "pop", x: Math.round(P.x), y: Math.round(P.y) }); return; }
    if (P.bot || P.npc) this.botThink(P);
    const a = P.augs, stun = P.b.stun > t;
    // 쿨타임
    if (P.fireCd > 0) P.fireCd -= dt; if (P.rollCd > 0) P.rollCd -= dt; if (P.acd[0] > 0) P.acd[0] -= dt; if (P.acd[1] > 0) P.acd[1] -= dt; if (P.rollT > 0) P.rollT -= dt;
    // 버튼
    const btn = P.in.btn; P.in.btn = 0;
    if (!stun) { if (btn & 1) this.roll(P); if (btn & 2) this.skill(P, 0); if (btn & 4) this.skill(P, 1); }
    // 선회
    let tr = this.turnOf(P);
    if (stun) tr = 0;
    if (P.in.has && tr > 0) { const da = angDiff(P.in.ang, P.ang); P.ang += clamp(da, -tr * dt, tr * dt); }
    if (P.ang > Math.PI) P.ang -= TAU; else if (P.ang < -Math.PI) P.ang += TAU;
    // 속도
    const sp = this.speedOf(P);
    const bmax = this.bmaxOf(P);
    if (P.boost <= 1) P.boostLock = true; else if (P.boostLock && P.boost >= 20) P.boostLock = false; // 다 쓰면 20 찰 때까지 못 씀 (켜졌다 꺼졌다 깜빡이지 않게)
    P.boosting = P.in.boost && !P.boostLock && !(P.b.after > t) && !stun;
    if (P.boosting) P.boost = Math.max(0, P.boost - PLANE.boostDrain * dt); else P.boost = Math.min(bmax, P.boost + PLANE.boostRegen * (1 + (a.includes("b15") ? AUG.b15.v.regen : 0)) * dt);
    const v = sp * (P.boosting ? PLANE.boostMul : 1);
    P.vx = Math.cos(P.ang) * v + this.wind.x; P.vy = Math.sin(P.ang) * v + this.wind.y;
    P.x = clamp(P.x + P.vx * dt, X0, X1); P.y = clamp(P.y + P.vy * dt, Y0, Y1);
    // 불·수리·보호막
    if (P.burn) { if (P.burn.until <= t) P.burn = null; else this.damage(P, P.burn.dps * dt, this.F.get(P.burn.src), "burn", true); if (P.state !== "alive") return; }
    if (a.includes("b16")) { const wait = P.syn.has("y3") ? 0 : AUG.b16.v.wait; if (t - P.lastHit > wait) P.hp = Math.min(P.maxHp, P.hp + AUG.b16.v.hps * (P.syn.has("y3") ? 2 : 1) * dt); }
    if (a.includes("b20") && P.at.shgen <= t) { P.at.shgen = t + AUG.b20.v.cd; P.sh = Math.max(P.sh, AUG.b20.v.sh); if (P.syn.has("y11")) P.hp = Math.min(P.maxHp, P.hp + 20); this.ev.push({ k: "shield", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); }
    if (t - P.lastHit > 5 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 6 * dt); // 5초 동안 안 맞으면 기본 회복
    if (P.barT && P.barT <= t) { P.bar = 0; P.barT = 0; }
    // 사격
    if (P.in.fire && P.fireCd <= 0 && !(P.b.emp > t) && !(P.protect > t && P.human && false)) this.fire(P);
    if (P.b.airship > t && P.fireCd <= 0 && !(P.b.emp > t)) this.fire(P);
    this.passives(P);
    // 애프터버너 들이받기
    if (P.b.after > t) for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q) || (Q.b.ramAt || 0) > t) continue; if (d2(P.x, P.y, Q.x, Q.y) < (this.radius(P) + this.radius(Q)) ** 2) { Q.b.ramAt = t + 0.6; this.damage(Q, AUG.s32.v.ram, P, "ram"); } }
    // 호위기
    if (P.wing.length) this.updWing(P, dt);
    // 별 줍기
    const pr = STAR.pick * (a.includes("b21") ? AUG.b21.v.mul : 1);
    let got = 0; this.nearStar(P.x, P.y, pr, (s) => { if (d2(P.x, P.y, s.x, s.y) > pr * pr) return; got += s.v; this.delStar(s, P.fid); });
    if (got && !P.npc) { P.xp += got; P.st.stars += got; P.score += got * SCORE.star * (this.double ? 2 : 1); if (this.aug && !P.pend.length) this.checkOffer(P); }
    if (P.state === "alive" && P.boosting && this.tick % 3 === 0) this.ev.push({ k: "trail", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) });
  }
  radius(P) { return P.npc === "squad" ? PLANE.r : PLANE.r * (P.augs.includes("b17") ? 1 - AUG.b17.v.r : 1) * (P.b.airship > this.t ? 2 : 1); }
  speedOf(P) {
    const t = this.t, a = P.augs; let m = 1;
    if (a.includes("b18")) m += AUG.b18.v.spd; if (P.b.spree > t) m += AUG.b24.v.spd;
    if (P.rollT > 0) m *= ROLL.spd;
    if (P.b.after > t) m *= P.syn.has("y10") ? 2.6 : AUG.s32.v.mul;
    if (P.b.airship > t) m *= 0.6;
    if (P.b.warp > t) m *= 0.5;
    if (P.npc === "squad") m *= 1.05;
    return spdBase(this.lvl(P)) * m * this.stOf(P).spd;
  }
  roll(P) {
    if (P.rollCd > 0 || P.rollT > 0) return;
    let cd = ROLL.cd; if (P.augs.includes("b28")) cd *= 1 - AUG.b28.v.cd; if (P.syn.has("y4")) cd *= 0.8;
    P.rollT = ROLL.t + (P.augs.includes("b28") ? AUG.b28.v.t : 0) + (P.syn.has("y4") ? 0.3 : 0); P.rollCd = cd;
    this.ev.push({ k: "roll", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) });
  }
  // ---------- 사격 ----------
  gunStats(P) {
    const a = P.augs, t = this.t; let dmg = GUN.dmg * (1 + (a.includes("w04") ? AUG.w04.v.dmg : 0)), rate = 1 + (a.includes("w05") ? AUG.w05.v.rate : 0) + (P.b.spree > t ? AUG.b24.v.rate : 0) - (a.includes("w04") ? AUG.w04.v.rate : 0);
    if (P.b.power > t) dmg *= PICKUPS.power.mul;
    dmg *= this.stOf(P).dmg;
    const range = 1 + (a.includes("w06") ? AUG.w06.v.range : 0);
    return { dmg, cd: GUN.cd / Math.max(0.4, rate), spd: GUN.spd * range, life: GUN.life * range };
  }
  fire(P) {
    const a = P.augs, g = this.gunStats(P), t = this.t; P.fireCd = g.cd;
    const life = a.includes("w02") ? g.life * 0.9 : g.life;
    const streams = 1 + (a.includes("w01") ? 1 : 0) + (P.syn.has("y1") ? 1 : 0);
    const fan = a.includes("w02") ? AUG.w02.v.n : 1;
    const dirs = P.b.airship > t ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0];
    const R = this.radius(P);
    P.st.shots += dirs.length * streams * fan;
    for (const off of dirs) for (let s = 0; s < streams; s++) {
      const side = streams === 1 ? 0 : (s - (streams - 1) / 2) * 12;
      for (let f = 0; f < fan; f++) {
        const ang = P.ang + off + (fan > 1 ? (f - (fan - 1) / 2) * AUG.w02.v.spread / ((fan - 1) / 2 || 1) * 0.5 : 0) + (this.rng() - 0.5) * GUN.spread;
        const ca = Math.cos(P.ang + off), sa = Math.sin(P.ang + off);
        this.shoot(P, P.x + ca * R * 0.9 - sa * side, P.y + sa * R * 0.9 + ca * side, ang, g.spd, life, g.dmg, BK.gun);
      }
    }
    if (P.human || this.tick % 2 === 0) this.ev.push({ k: "muz", f: P.fid });
  }
  shoot(P, x, y, ang, spd, life, dmg, kind, o = {}) {
    if (this.bul.length > 1800) return null;
    const b = { id: this.bulSeq++, x, y, vx: Math.cos(ang) * spd + (P ? P.vx * 0.35 : 0), vy: Math.sin(ang) * spd + (P ? P.vy * 0.35 : 0), life, owner: P ? P.fid : 0, team: P ? P.team : -1, npc: P ? !!P.npc : true, dmg, kind, pierce: P && P.augs?.includes("w03") && kind === BK.gun ? 1 : 0, hit: null, ...o };
    if (this.bulSeq > 1e9) this.bulSeq = 1; this.bul.push(b); return b;
  }
  passives(P) {
    const a = P.augs, t = this.t, R = this.radius(P); if (P.b.emp > t) return;
    if (a.includes("w07") && P.at.tail <= t) { P.at.tail = t + AUG.w07.v.cd; const T = this.nearestEnemy(P, 520, (Q) => Math.abs(angDiff(Math.atan2(Q.y - P.y, Q.x - P.x), P.ang)) > 2.2); if (T) this.shoot(P, P.x - Math.cos(P.ang) * R, P.y - Math.sin(P.ang) * R, Math.atan2(T.y - P.y, T.x - P.x), GUN.spd, 0.6, AUG.w07.v.dmg, BK.tail); }
    if (a.includes("w08") && P.at.missile <= t) { const T = this.nearestEnemy(P, 950, (Q) => Math.abs(angDiff(Math.atan2(Q.y - P.y, Q.x - P.x), P.ang)) < 1.2 && !(Q.b.flare > t)) || this.bossTarget(P, 950); if (T) { P.at.missile = t + AUG.w08.v.cd; this.missile(P, T, AUG.w08.v.dmg); } }
    if (a.includes("w10") && P.at.mine <= t) { P.at.mine = t + AUG.w10.v.cd; const n = P.syn.has("y6") ? 2 : 1; for (let i = 0; i < n; i++) this.shoot(P, P.x - Math.cos(P.ang) * (R + 20) + (i - (n - 1) / 2) * 50 * Math.sin(P.ang), P.y - Math.sin(P.ang) * (R + 20) - (i - (n - 1) / 2) * 50 * Math.cos(P.ang), 0, 0, 14, AUG.w10.v.dmg, BK.mine, { vx: 0, vy: 0, r: AUG.w10.v.r }); }
    if (a.includes("w11") && P.at.laser <= t) { P.at.laser = t + AUG.w11.v.cd; this.laser(P); }
  }
  missile(P, T, dmg) { const b = this.shoot(P, P.x, P.y, P.ang + (this.rng() - 0.5) * 0.4, 560, 2.6, dmg, BK.missile, { tgt: T.fid ?? -1, boss: T === this.boss }); if (b) b.turn = 3.4; return b; }
  laser(P) {
    const big = P.syn.has("y5"), len = big ? 1100 : AUG.w11.v.len, dmg = AUG.w11.v.dmg * (big ? 1.5 : 1) * (P.b.power > this.t ? 2 : 1);
    const x2 = P.x + Math.cos(P.ang) * len, y2 = P.y + Math.sin(P.ang) * len;
    for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q)) continue; if (segHit(P.x, P.y, x2, y2, Q.x, Q.y, this.radius(Q) + 10)) this.damage(Q, dmg, P, "laser"); }
    if (this.boss && this.bossCircles(this.boss).some(([cx, cy, cr]) => segHit(P.x, P.y, x2, y2, cx, cy, cr))) this.hitBoss(P, dmg);
    this.ev.push({ k: "laser", f: P.fid, x: Math.round(P.x), y: Math.round(P.y), x2: Math.round(x2), y2: Math.round(y2), b: big ? 1 : 0 });
  }
  nearestEnemy(P, r, filt) { let best = null, bd = r * r; for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q) || Q.protect > this.t) continue; const d = d2(P.x, P.y, Q.x, Q.y); if (d < bd && (!filt || filt(Q))) { bd = d; best = Q; } } return best; }
  bossTarget(P, r) { const B = this.boss; if (!B || B.x < 0 || B.x > MAP.w) return null; return d2(P.x, P.y, B.x, B.y) < (r + B.r) ** 2 ? B : null; }
  // ---------- 스킬 ----------
  skill(P, slot) {
    const id = P.act[slot]; if (!id || P.acd[slot] > 0) return;
    const A = AUG[id], v = A.v, t = this.t; P.acd[slot] = A.cd;
    switch (id) {
      case "s31": P.b.flare = t + v.t; for (const b of this.bul) if (b.kind === BK.missile && b.tgt === P.fid) b.tgt = -1; this.ev.push({ k: "flare", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); break;
      case "s32": P.b.after = t + (P.syn.has("y10") ? 4.5 : v.t); this.ev.push({ k: "after", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); break;
      case "s33": P.bar = v.sh; P.barT = t + v.t; this.ev.push({ k: "barrier", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); break;
      case "s34": { const rr = v.r; for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q)) continue; if (d2(P.x, P.y, Q.x, Q.y) > rr * rr) continue; if (Q.b.warp && false) continue; Q.b.emp = t + v.t; if (P.syn.has("y8")) Q.b.stun = t + 1; }
        this.bul = this.bul.filter(b => !(b.kind === BK.missile && b.owner !== P.fid && d2(b.x, b.y, P.x, P.y) < rr * rr)); this.ev.push({ k: "emp", f: P.fid, x: Math.round(P.x), y: Math.round(P.y), r: rr }); break; }
      case "s35": { const n = P.syn.has("y7") ? 3 : v.n; P.wing = []; for (let i = 0; i < n; i++) P.wing.push({ i, x: P.x, y: P.y, ang: P.ang, cd: 0, mcd: 0, until: t + v.t }); this.ev.push({ k: "wing", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); break; }
      case "s36": { const n = P.syn.has("y6") ? 9 : v.n; for (let i = 0; i < n; i++) { const d = 40 + i * 55; this.bombs.push({ x: P.x - Math.cos(P.ang) * d, y: P.y - Math.sin(P.ang) * d, at: t + 0.8 + i * 0.05, r: v.r, dmg: v.dmg, owner: P.fid }); } this.ev.push({ k: "bombs", f: P.fid }); break; }
      case "s37": { const ts = [...this.F.values()].filter(Q => Q !== P && Q.state === "alive" && !this.ally(P, Q) && !(Q.b.flare > t) && d2(P.x, P.y, Q.x, Q.y) < 1100 * 1100).sort((x, y) => d2(P.x, P.y, x.x, x.y) - d2(P.x, P.y, y.x, y.y)); const bt = this.bossTarget(P, 1100); for (let i = 0; i < v.n; i++) { const T = ts.length ? ts[i % ts.length] : bt; if (T) this.missile(P, T, v.dmg); } this.ev.push({ k: "barrage", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); break; }
      case "s38": { const fx = P.x, fy = P.y; P.x = clamp(P.x + Math.cos(P.ang) * v.d, X0, X1); P.y = clamp(P.y + Math.sin(P.ang) * v.d, Y0, Y1); P.rollT = Math.max(P.rollT, 0.25); this.ev.push({ k: "jump", f: P.fid, x: Math.round(fx), y: Math.round(fy), x2: Math.round(P.x), y2: Math.round(P.y) }); break; }
      case "s39": P.b.airship = t + v.t; P.maxHp += v.hp; P.hp += v.hp; P.b.airHp = v.hp; this.ev.push({ k: "airship", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) }); this.gev.push({ k: "airship", f: P.fid }); break;
      case "s40": for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q)) continue; if (d2(P.x, P.y, Q.x, Q.y) < v.r * v.r) Q.b.warp = t + v.t; } for (const b of this.bul) if (b.owner !== P.fid && d2(b.x, b.y, P.x, P.y) < v.r * v.r) { b.vx *= v.slow; b.vy *= v.slow; b.life *= 1.6; } this.ev.push({ k: "warp", f: P.fid, x: Math.round(P.x), y: Math.round(P.y), r: v.r }); break;
    }
  }
  updWing(P, dt) {
    const t = this.t; P.wing = P.wing.filter(w => w.until > t); if (P.state !== "alive") { P.wing = []; return; }
    for (const w of P.wing) {
      const side = (w.i % 2 ? 1 : -1) * (70 + Math.floor(w.i / 2) * 50), back = 60 + Math.floor(w.i / 2) * 40, tx = P.x - Math.cos(P.ang) * back - Math.sin(P.ang) * side, ty = P.y - Math.sin(P.ang) * back + Math.cos(P.ang) * side;
      w.x += (tx - w.x) * Math.min(1, dt * 6); w.y += (ty - w.y) * Math.min(1, dt * 6); w.ang = P.ang;
      w.cd -= dt;
      const T = this.nearestEnemy(P, 700, (Q) => Math.abs(angDiff(Math.atan2(Q.y - w.y, Q.x - w.x), P.ang)) < 0.9);
      if (T && w.cd <= 0) { w.cd = 0.3; this.shoot(P, w.x, w.y, Math.atan2(T.y - w.y, T.x - w.x), GUN.spd, 0.6, 5, BK.wing); }
      if (P.syn.has("y7") && T && w.mcd <= t) { w.mcd = t + 3; const m = this.missile(P, T, 18); if (m) { m.x = w.x; m.y = w.y; } }
    }
  }
  // ---------- 총알 ----------
  updBullets(dt) {
    const t = this.t, planes = [...this.F.values()].filter(P => P.state === "alive"), B = this.boss, bc = B ? this.bossCircles(B) : null;
    for (const b of this.bul) {
      b.life -= dt; if (b.life <= 0) { b.dead = true; if (b.kind === BK.missile && b.napalm) this.napalm(b); continue; }
      if (b.kind === BK.missile) { // 유도
        const T = b.boss ? this.boss : b.tgt > 0 ? this.F.get(b.tgt) : null;
        if (T && (T === this.boss || (T.state === "alive" && !(T.b.flare > t)))) { const want = Math.atan2(T.y - b.y, T.x - b.x), cur = Math.atan2(b.vy, b.vx), da = clamp(angDiff(want, cur), -b.turn * dt, b.turn * dt), sp = Math.hypot(b.vx, b.vy) || 560; b.vx = Math.cos(cur + da) * sp; b.vy = Math.sin(cur + da) * sp; }
      }
      const ox = b.x, oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -100 || b.x > MAP.w + 100 || b.y < -100 || b.y > MAP.h + 100) { b.dead = true; continue; }
      const O = b.owner ? this.F.get(b.owner) : null, br = b.kind === BK.mine ? b.r : b.kind === BK.missile ? 14 : 4;
      // 황금 열기구 맞기
      if (this.balloons.length && !b.npc && b.kind !== BK.boss) { for (const L of this.balloons) if (!L.dead && segHit(ox, oy, b.x, b.y, L.x, L.y, 46 + br)) { L.hp -= b.dmg; b.dead = true; this.ev.push({ k: "hitb", x: Math.round(b.x), y: Math.round(b.y), f: b.owner }); if (L.hp <= 0) this.popBalloon(L, O); break; } if (b.dead) continue; }
      // 보스 맞기
      if (bc && !b.npc && b.kind !== BK.boss) { for (const [cx, cy, cr] of bc) if (segHit(ox, oy, b.x, b.y, cx, cy, cr + br)) { this.hitBoss(O, b.dmg * (b.kind === BK.mine ? 1 : 1)); this.ev.push({ k: "hitb", x: Math.round(b.x), y: Math.round(b.y), f: b.owner }); b.dead = true; break; } if (b.dead) { if (b.napalm) this.napalm(b); continue; } }
      for (const Q of planes) {
        if (Q.state !== "alive" || Q.fid === b.owner || (b.hit && b.hit.has(Q.fid))) continue;
        if (b.npc ? Q.npc : (O ? this.ally(O, Q) : (this.mode === "team" && b.team === Q.team))) continue;
        const rr = this.radius(Q) + br; if (!segHit(ox, oy, b.x, b.y, Q.x, Q.y, rr)) continue;
        if (b.kind === BK.mine) { this.boom(b.x, b.y, b.r * 1.4, b.dmg, O, b.owner); b.dead = true; break; }
        const hit = this.damage(Q, b.dmg, O, b.kind === BK.missile ? "missile" : "gun");
        if (hit === "roll") continue; // 배럴롤로 피함 (총알은 계속)
        if (O && b.kind === BK.gun) O.st.hits++;
        this.ev.push({ k: "hit", x: Math.round(b.x), y: Math.round(b.y), f: b.owner, t: Q.fid, d: Math.round(b.dmg) });
        if (b.napalm) this.napalm(b);
        if (b.pierce > 0) { b.pierce--; (b.hit ||= new Set()).add(Q.fid); continue; }
        b.dead = true; break;
      }
    }
    if (this.bul.some(b => b.dead)) this.bul = this.bul.filter(b => !b.dead);
  }
  napalm(b) { const O = this.F.get(b.owner); for (const Q of this.F.values()) { if (Q.state !== "alive" || (O && this.ally(O, Q))) continue; if (d2(Q.x, Q.y, b.x, b.y) < 140 * 140) Q.burn = { dps: 6, until: this.t + 3, src: b.owner }; } this.ev.push({ k: "napalm", x: Math.round(b.x), y: Math.round(b.y) }); }
  boom(x, y, r, dmg, O, ownerFid, npc = false) {
    for (const Q of this.F.values()) { if (Q.state !== "alive" || Q.fid === ownerFid) continue; if (npc ? Q.npc : (O && this.ally(O, Q))) continue; if (d2(Q.x, Q.y, x, y) < (r + this.radius(Q)) ** 2) this.damage(Q, dmg, O, "boom"); }
    if (!npc && this.boss && this.bossCircles(this.boss).some(([cx, cy, cr]) => d2(x, y, cx, cy) < (cr + r) ** 2)) this.hitBoss(O, dmg);
    this.ev.push({ k: "boom", x: Math.round(x), y: Math.round(y), r: Math.round(r) });
  }
  updBombs() { const t = this.t; for (const b of this.bombs) if (b.at <= t) { b.done = true; const O = b.owner ? this.F.get(b.owner) : null; this.boom(b.x, b.y, b.r, b.dmg, O, b.owner, !!b.npc); } this.bombs = this.bombs.filter(b => !b.done); }
  // ---------- 피해·격추 ----------
  damage(Q, dmg, O, kind, quiet) {
    const t = this.t;
    if (Q.state !== "alive" || Q.protect > t) return "protect";
    if (Q.rollT > 0 && kind !== "burn" && kind !== "storm") { if (kind === "gun") Q.st.dodge++; return "roll"; }
    if (O && !O.npc) {
      const a = O.augs;
      if (a.includes("b30") && kind === "gun") { if (O.focus.fid === Q.fid) O.focus.n = Math.min(O.focus.n + 1, Math.round(AUG.b30.v.max / AUG.b30.v.per)); else O.focus = { fid: Q.fid, n: 0 }; dmg *= 1 + O.focus.n * AUG.b30.v.per; }
      if (a.includes("b22") && Q.hp < Q.maxHp * AUG.b22.v.below) dmg *= 1 + (O.syn.has("y9") ? 0.6 : AUG.b22.v.dmg);
      if (a.includes("w09") && kind === "gun") Q.burn = { dps: AUG.w09.v.dps, until: t + AUG.w09.v.t, src: O.fid };
      if (a.includes("w12") && kind === "gun" && this.rng() < AUG.w12.v.ch) { const near = [...this.F.values()].filter(R => R !== Q && R !== O && R.state === "alive" && !this.ally(O, R) && d2(R.x, R.y, Q.x, Q.y) < 300 * 300).slice(0, AUG.w12.v.n); for (const R of near) { this.ev.push({ k: "chain", x: Math.round(Q.x), y: Math.round(Q.y), x2: Math.round(R.x), y2: Math.round(R.y) }); this.damage(R, AUG.w12.v.dmg, O, "chain"); } }
      if (a.includes("b19")) O.hp = Math.min(O.maxHp, O.hp + dmg * AUG.b19.v.pct);
    }
    // 보호막 → 방어막 → 체력
    let left = dmg;
    if (Q.bar > 0) { const k = Math.min(Q.bar, left); Q.bar -= k; left -= k; }
    if (left > 0 && Q.sh > 0) { const k = Math.min(Q.sh, left); Q.sh -= k; left -= k; }
    Q.hp -= left; Q.lastHit = t; Q.b.hurt = t + 0.1;
    if (O && O.fid !== Q.fid) Q.dmgBy.set(O.fid, { d: (Q.dmgBy.get(O.fid)?.d || 0) + dmg, t });
    if (Q.augs.includes("b23") && kind === "gun" && this.rng() < AUG.b23.v.ch && !(Q.b.emp > t)) for (let i = 0; i < AUG.b23.v.n; i++) this.shoot(Q, Q.x, Q.y, Q.ang + i * TAU / AUG.b23.v.n + 0.4, GUN.spd, 0.5, GUN.dmg, BK.counter);
    if (Q.hp <= 0) {
      const ej = Q.augs.includes("b26") && Q.at.eject <= t;
      if (ej) { Q.hp = 1; Q.at.eject = t + (Q.syn.has("y12") ? 30 : AUG.b26.v.cd); Q.protect = t + AUG.b26.v.inv; Q.st.ejects++; this.ev.push({ k: "eject", f: Q.fid, x: Math.round(Q.x), y: Math.round(Q.y) }); return "eject"; }
      this.kill(Q, O);
    }
    return "hit";
  }
  kill(Q, O) {
    const t = this.t, dbl = this.double ? 2 : 1;
    Q.state = "dead"; Q.deadT = RESPAWN; Q.deaths++; Q.killer = O ? O.fid : 0; Q.streak = 0; Q.wing = []; Q.burn = null; Q.b = {}; Q.rollT = 0;
    if (O) Q.killedBy[O.fid] = (Q.killedBy[O.fid] || 0) + 1;
    const bounty = this.bountyFid === Q.fid;
    if (O && !O.npc) {
      const mulStar = O.augs.includes("b25") ? AUG.b25.v.star : 1, mulSc = O.augs.includes("b25") ? 1 + AUG.b25.v.score : 1;
      const lead = this.ranking()[0], aceKill = lead === Q && Q.score >= 200 && Q !== O;
      O.kills++; O.streak++; O.bestStreak = Math.max(O.bestStreak, O.streak); O.score += SCORE.kill * mulSc * dbl + (bounty ? 500 * dbl : 0) + (aceKill ? 100 * dbl : 0);
      O.multi = t - O.lastKillT <= 4 ? O.multi + 1 : 1; O.lastKillT = t; O.bestMulti = Math.max(O.bestMulti, O.multi); O.vic[Q.fid] = (O.vic[Q.fid] || 0) + 1;
      if (O.multi >= 2) this.gev.push({ k: "multi", f: O.fid, n: Math.min(5, O.multi) });
      if (O.streak === 5 || O.streak === 10 || O.streak === 15) this.gev.push({ k: "streak", f: O.fid, n: O.streak });
      if (aceKill) this.gev.push({ k: "acekill", f: O.fid, v: Q.fid });
      if (O.augs.includes("b24")) O.b.spree = t + AUG.b24.v.t;
      if (O.lastKiller && O.lastKiller === Q.fid) { O.st.revenge++; O.lastKiller = 0; this.ev.push({ k: "revenge", f: O.fid }); }
      if (Q.human && O.human) O.st.humans++;
      if (bounty) { O.st.bounty++; this.bountyFid = 0; this.gev.push({ k: "bountykill", f: O.fid, v: Q.fid }); }
      if (!O.bk || (Q.score > (O.bk.sc || 0))) O.bk = { fid: Q.fid, sc: Math.round(Q.score), t: Math.round(t), name: Q.human ? Q.name : null, ni: Q.nameIdx ?? -1 };
      this.dropStars(Q, 0.3, mulStar);
    } else this.dropStars(Q, 0.3);
    // 도움: 6초 안에 피해 준 다른 비행기
    for (const [fid, rec] of Q.dmgBy) { if (O && fid === O.fid) continue; if (t - rec.t > 6) continue; const A = this.F.get(fid); if (A && !A.npc && A.state === "alive") { A.assists++; A.score += SCORE.assist * dbl; } }
    Q.dmgBy.clear(); Q.lastKiller = O && !O.npc ? O.fid : 0;
    this.stats.kills++;
    this.ev.push({ k: "kill", a: O ? O.fid : 0, b: Q.fid, x: Math.round(Q.x), y: Math.round(Q.y), s: Q.skin, an: +Q.ang.toFixed(2), n: Q.npc ? 1 : 0 });
    if (Q.human || O?.human || Q.npc || Q.donor || bounty) this.gev.push({ k: "killed", a: O ? O.fid : 0, b: Q.fid });
  }
  respawn(P) {
    const ord = { legend: 0, epic: 1, rare: 2, common: 3 }, keepN = Math.ceil(P.augs.length / 2);
    const kept = P.augs.map((id, i) => [id, i]).sort((a, b) => (ord[AUG[a[0]].r] - ord[AUG[b[0]].r]) || (a[1] - b[1])).slice(0, keepN).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    P.augs = kept; P.pend.length = 0; this.recalcSyn(P); P.act = [null, null]; for (const id of kept) if (AUG[id].kind === "a") { const s = P.act[0] ? 1 : 0; P.act[s] = id; } P.acd = [0, 0];
    P.xp = Math.floor(P.xp * (P.augs.includes("b29") ? AUG.b29.v.keep : 0.5));
    P.maxHp = this.hp0(P) + (P.augs.includes("b13") ? AUG.b13.v.hp : 0); P.hp = P.maxHp; P.sh = P.augs.includes("b29") ? AUG.b29.v.sh : 0; P.bar = 0;
    P.state = "alive"; P.protect = this.t + SPAWN_SAFE; P.b = {}; P.boost = this.bmaxOf(P); P.boostLock = false; P.rollT = 0; P.rollCd = 0; P.fireCd = 0; P.at = { missile: 0, mine: 0, laser: 0, tail: 0, shgen: this.t + 3, eject: 0 }; P.focus = { fid: 0, n: 0 }; P.brain.tgt = 0;
    this.spawnAt(P); this.ev.push({ k: "spawn", f: P.fid, x: Math.round(P.x), y: Math.round(P.y) });
    if (this.aug) this.checkOffer(P);
  }
  recalcSyn(P) { const before = P.syn; P.syn = new Set(SYNERGIES.filter(s => s.req.every(r => P.augs.includes(r))).map(s => s.id)); for (const s of P.syn) if (!before.has(s)) this.gev.push({ k: "syn", f: P.fid, s }); }
  // ---------- 보급품 ----------
  spawnPickup(k, x, y, o = {}) { const kinds = ["health", "shield", "power"]; const p = { id: this.pickSeq++, k: k || kinds[Math.floor(this.rng() * 3)], x: x ?? X0 + 300 + this.rng() * (X1 - X0 - 600), y: y ?? Y0 + 300 + this.rng() * (Y1 - Y0 - 600), until: this.t + (o.life || 30) }; this.pickups.push(p); return p; }
  updPickups() {
    const t = this.t;
    for (const p of this.pickups) { if (p.until <= t) { p.done = true; continue; }
      for (const P of this.F.values()) { if (P.state !== "alive" || P.npc) continue; if (d2(P.x, P.y, p.x, p.y) > (this.radius(P) + 40) ** 2) continue;
        if (p.k === "health" || p.k === "supply") P.hp = Math.min(P.maxHp, P.hp + (p.k === "supply" ? P.maxHp : PICKUPS.health.hp));
        if (p.k === "shield" || p.k === "supply") P.sh = Math.max(P.sh, PICKUPS.shield.sh);
        if (p.k === "power" || p.k === "supply") P.b.power = t + PICKUPS.power.t;
        if (p.k === "supply") { P.xp += 20; P.score += 20 * (this.double ? 2 : 1); if (this.aug) this.checkOffer(P); }
        p.done = true; this.ev.push({ k: "pick", f: P.fid, p: p.k, x: Math.round(p.x), y: Math.round(p.y) }); break; } }
    if (this.pickups.some(p => p.done)) this.pickups = this.pickups.filter(p => !p.done);
  }
  // ---------- AI ----------
  botThink(P) {
    const t = this.t, br = P.brain, L = BOT_LV[P.npc === "squad" || P.donor ? "hard" : this.botLv], R = this.radius(P);
    if ((this.tick + P.fid) % 2) return;
    // 화면 밖으로 나가려 하면 가운데로
    const edge = (P.x < X0 + 300 || P.x > X1 - 300 || P.y < Y0 + 300 || P.y > Y1 - 300);
    let T = br.tgt ? this.F.get(br.tgt) : null;
    const Ld = P.wingOf ? this.F.get(P.wingOf) : null, lead = Ld && Ld.state === "alive" && !Ld.human ? Ld : null;
    if (lead && lead.brain.tgt && (!T || T.state !== "alive" || br.next < t)) { const LT = this.F.get(lead.brain.tgt); if (LT && LT.state === "alive" && !this.ally(P, LT)) { T = LT; br.tgt = LT.fid; br.next = t + 1; } } // 편대: 대장과 같은 적을 노림
    if (!T || T.state !== "alive" || br.next < t) {
      const see = 1100 * L.see; let best = null, bv = 0;
      for (const Q of this.F.values()) { if (Q === P || Q.state !== "alive" || this.ally(P, Q) || Q.protect > t) continue; const d = Math.sqrt(d2(P.x, P.y, Q.x, Q.y)); if (d > see) continue;
        const front = Math.cos(angDiff(Math.atan2(Q.y - P.y, Q.x - P.x), P.ang)); let v = (1.4 + front) / (d + 200) * (1.3 - Q.hp / Q.maxHp * 0.5);
        if ((P.npc === "squad" || P.donor) && Q.fid === P.hunt) v *= 6; if (this.bountyFid === Q.fid) v *= 1.6; if (Q.human && P.bot === "ace") v *= 1.2;
        if (v > bv) { bv = v; best = Q; } }
      if (P.hunt && this.F.get(P.hunt)?.state === "alive" && !best) best = this.F.get(P.hunt);
      T = best; br.tgt = T ? T.fid : 0; br.next = t + 1.2 + this.rng();
    }
    // 보스 공격 (일부)
    const B = this.boss; let aim = null, fire = false;
    if (B && !P.npc && (P.bot === "ace" || P.fid % 3 !== 0) && B.x > 0 && B.x < MAP.w && (!T || d2(P.x, P.y, T.x, T.y) > 500 * 500) && d2(P.x, P.y, B.x, B.y) < 1600 * 1600) { aim = Math.atan2(B.y - P.y, B.x - P.x); fire = Math.abs(angDiff(aim, P.ang)) < 0.3 && d2(P.x, P.y, B.x, B.y) < (B.r + 520) ** 2; }
    // 쫓기는 중이고 체력 낮으면 도망 + 배럴롤
    const chaser = this.nearestEnemy(P, 420, (Q) => Math.abs(angDiff(Math.atan2(P.y - Q.y, P.x - Q.x), Q.ang)) < 0.5);
    if (chaser && P.hp < P.maxHp * 0.4 && !P.npc) { aim = Math.atan2(P.y - chaser.y, P.x - chaser.x) + Math.sin(t * 3 + P.fid) * 0.9; P.in.boost = true; if (this.rng() < 0.15 * L.react) P.in.btn |= 1; }
    else P.in.boost = false;
    if (!aim && T) {
      const d = Math.sqrt(d2(P.x, P.y, T.x, T.y)), lead = d / (GUN.spd * 1.0) * L.aim;
      const lx = T.x + T.vx * lead, ly = T.y + T.vy * lead; aim = Math.atan2(ly - P.y, lx - P.x) + (1 - L.aim) * Math.sin(t * 2 + P.fid) * 0.4;
      fire = Math.abs(angDiff(aim, P.ang)) < 0.16 + (1 - L.aim) * 0.1 && d < GUN.spd * GUN.life * 1.05;
      if (d < 240 && Math.abs(angDiff(aim, P.ang)) > 1.5) { P.in.boost = true; } // 지나쳐 버리면 크게 돌기
      if (T.in?.fire && Math.abs(angDiff(Math.atan2(P.y - T.y, P.x - T.x), T.ang)) < 0.2 && d < 600 && this.rng() < 0.08 * L.react) P.in.btn |= 1;
    }
    if (!aim && lead && d2(P.x, P.y, lead.x, lead.y) < 1600 * 1600) { // 편대 비행: 대장 뒤 옆자리
      const side = (P.fid % 2 ? 1 : -1) * 95, sx = lead.x - Math.cos(lead.ang) * 120 - Math.sin(lead.ang) * side, sy = lead.y - Math.sin(lead.ang) * 120 + Math.cos(lead.ang) * side;
      if (d2(P.x, P.y, sx, sy) > 140 * 140) { aim = Math.atan2(sy - P.y, sx - P.x); P.in.boost = d2(P.x, P.y, sx, sy) > 420 * 420; } else aim = lead.ang;
    }
    if (!aim && (P.fid % 3 === 0 || P.bot === "ace")) { // 우리 것이 아닌 대공포 점령하러
      let tu = null, bd = 1500 * 1500; for (const Tu of this.tur) { if (Tu.own === this.sideOf(P)) continue; const d = d2(P.x, P.y, Tu.x, Tu.y); if (d < bd) { bd = d; tu = Tu; } }
      if (tu) aim = d2(P.x, P.y, tu.x, tu.y) < 160 * 160 ? P.ang + 0.9 : Math.atan2(tu.y - P.y, tu.x - P.x);
    }
    if (!aim) { // 별·보급 줍기
      let tgt = this.pickups.find(p => d2(p.x, p.y, P.x, P.y) < 900 * 900);
      if (!tgt) { let bv = 0; this.nearStar(P.x, P.y, 500, (s) => { const v = s.v / (Math.sqrt(d2(P.x, P.y, s.x, s.y)) + 80); if (v > bv) { bv = v; tgt = s; } }); }
      if (tgt) aim = Math.atan2(tgt.y - P.y, tgt.x - P.x);
      else { if (!br.wx || d2(P.x, P.y, br.wx, br.wy) < 200 * 200) { br.wx = X0 + 400 + this.rng() * (X1 - X0 - 800); br.wy = Y0 + 400 + this.rng() * (Y1 - Y0 - 800); } aim = Math.atan2(br.wy - P.y, br.wx - P.x); }
    }
    if (edge) { const c = Math.atan2(MAP.h / 2 - P.y, MAP.w / 2 - P.x); aim = Math.abs(angDiff(aim, c)) > 1.2 ? c : aim; }
    P.in.ang = aim; P.in.has = true; P.in.fire = fire;
    // 스킬
    if ((P.act[0] || P.act[1]) && this.rng() < 0.08) for (let s = 0; s < 2; s++) { const id = P.act[s]; if (!id || P.acd[s] > 0) continue; const near = T && d2(P.x, P.y, T.x, T.y) < 500 * 500; if ((["s33", "s31", "s38"].includes(id) && chaser) || (["s34", "s40", "s36"].includes(id) && near) || ["s35", "s37", "s32", "s39"].includes(id) && T) this.skill(P, s); }
  }
  // ---------- 보스 ----------
  bossCircles(B) { const c = Math.cos(B.ang), s = Math.sin(B.ang), r = B.r; if (B.kind === "heli") return [[B.x, B.y, r * 0.45], [B.x - c * r * 0.62, B.y - s * r * 0.62, r * 0.2]]; return B.kind === "airship" ? [[B.x + c * r * 0.55, B.y + s * r * 0.55, r * 0.42], [B.x, B.y, r * 0.5], [B.x - c * r * 0.55, B.y - s * r * 0.55, r * 0.42]] : [[B.x, B.y, r * 0.42], [B.x - s * r * 0.58, B.y + c * r * 0.58, r * 0.3], [B.x + s * r * 0.58, B.y - c * r * 0.58, r * 0.3]]; }
  turrets(B) { const c = Math.cos(B.ang), s = Math.sin(B.ang), r = B.r; if (B.kind === "heli") return [[B.x + c * r * 0.38, B.y + s * r * 0.38]]; return B.kind === "airship" ? [[0.45, 0.32], [0.45, -0.32], [-0.35, 0.32], [-0.35, -0.32]].map(([f, l]) => [B.x + c * r * f - s * r * l, B.y + s * r * f + c * r * l]) : [[-0.3, 0]].map(([f, l]) => [B.x + c * r * f - s * r * l, B.y + s * r * f + c * r * l]); }
  spawnBoss() {
    const D = BOSSES[this.bossKind], alive = [...this.F.values()].filter(P => !P.npc && P.state === "alive").length, left = this.rng() < 0.5;
    this.boss = { kind: this.bossKind, x: this.bossKind === "heli" ? (left ? 260 : MAP.w - 260) : left ? -300 : MAP.w + 300, y: MAP.h * (0.3 + this.rng() * 0.4), ang: left ? 0 : Math.PI, r: D.r, hp: D.hp + D.hpPer * alive, max: D.hp + D.hpPer * alive, until: this.t + BOSS_LEN, dmg: new Map(), tcd: [0, 0.15, 0.3, 0.45], bombAt: this.t + 6, misAt: this.t + 4, hurt: 0, tx: MAP.w / 2, ty: MAP.h / 2, retarget: 0 };
    this.gev.push({ k: "boss", b: this.bossKind });
  }
  hitBoss(P, dmg) { const B = this.boss; if (!B || B.hp <= 0) return; B.hp -= dmg; B.hurt = this.t + 0.1; if (P && !P.npc) B.dmg.set(P.fid, (B.dmg.get(P.fid) || 0) + dmg); if (B.hp <= 0) this.bossDown(); }
  bossDown() {
    const B = this.boss; if (!B) return; this.boss = null; this.bossDone = true;
    const list = [...B.dmg.entries()].sort((a, b) => b[1] - a[1]), top = [];
    list.forEach(([fid, d], i) => { const P = this.F.get(fid); if (!P || P.npc) return; const sc = BOSS_REWARD[Math.min(i, 3)] * (this.double ? 2 : 1); P.score += sc; P.st.bossKill = 1; if (i === 0) P.st.bossTop = 1; if (i < 5) top.push([fid, Math.round(d), sc]); });
    for (let i = 0; i < 70; i++) { const a = this.rng() * TAU, d = 40 + this.rng() * B.r * 2.2; this.addStar(B.x + Math.cos(a) * d, B.y + Math.sin(a) * d, 3); }
    for (let i = 0; i < 3; i++) this.spawnPickup(null, B.x + (this.rng() - 0.5) * 300, B.y + (this.rng() - 0.5) * 300);
    this.bossResult = { kind: B.kind, top, killed: true };
    this.ev.push({ k: "bossdown", x: Math.round(B.x), y: Math.round(B.y), r: B.r }); this.gev.push({ k: "bossdown", b: B.kind, top });
  }
  updBoss(dt) {
    const t = this.t;
    if (!this.boss && !this.bossDone && t >= BOSS_AT * this.len / GAME_LEN) { this.bossDone = true; this.spawnBoss(); }
    const B = this.boss; if (!B) return; const D = BOSSES[B.kind];
    if (t >= B.until) { const ex = B.x < MAP.w / 2 ? -800 : MAP.w + 800; if (B.kind === "heli") { B.x += (ex < B.x ? -1 : 1) * 200 * dt; B.y -= 0; } B.ang = ex < B.x ? Math.PI : 0; B.x += (ex < B.x ? -1 : 1) * 320 * dt; if (B.x < -700 || B.x > MAP.w + 700) { this.boss = null; this.bossResult = { kind: B.kind, top: [], killed: false }; this.gev.push({ k: "bossgone", b: B.kind }); } return; }
    if (B.kind === "airship") {
      if (B.retarget <= t) { const ps = [...this.F.values()].filter(P => !P.npc && P.state === "alive"); const P = ps[Math.floor(this.rng() * ps.length)]; if (P) { B.tx = P.x; B.ty = P.y; } B.retarget = t + 5; }
      const want = Math.atan2(B.ty - B.y, B.tx - B.x); B.ang += clamp(angDiff(want, B.ang), -0.35 * dt, 0.35 * dt); B.x += Math.cos(B.ang) * D.spd * dt; B.y += Math.sin(B.ang) * D.spd * dt;
      // 포탑: 가까운 비행기 조준 사격
      this.turrets(B).forEach(([tx, ty], i) => { B.tcd[i] -= dt; if (B.tcd[i] > 0) return; const T = this.nearestPlane(tx, ty, 850); if (!T) return; B.tcd[i] = 0.65; const lead = Math.sqrt(d2(tx, ty, T.x, T.y)) / 520; const a = Math.atan2(T.y + T.vy * lead * 0.6 - ty, T.x + T.vx * lead * 0.6 - tx); this.shoot(null, tx, ty, a + (this.rng() - 0.5) * 0.12, 520, 1.7, 9, BK.boss, { npc: true, team: -1 }); });
      if (B.bombAt <= t) { B.bombAt = t + 7; for (let i = 0; i < 8; i++) { const a = this.rng() * TAU, d = 150 + this.rng() * 320; this.bombs.push({ x: B.x + Math.cos(a) * d, y: B.y + Math.sin(a) * d, at: t + 1.3, r: 110, dmg: 30, npc: true }); } this.ev.push({ k: "bwarn", n: 8 }); }
    } else if (B.kind === "heli") {
      // 공격 헬기: 가까운 비행기를 쫓음 → 기관포 연사 · 6초마다 멈춰서 회전 날개 휩쓸기 · 12초마다 드론 3대
      const T = this.nearestPlane(B.x, B.y, 2200), hover = (B.sweepAt || 0) > t;
      if (T && !hover) { const want = Math.atan2(T.y - B.y, T.x - B.x); B.ang += clamp(angDiff(want, B.ang), -1.1 * dt, 1.1 * dt); const far = d2(B.x, B.y, T.x, T.y) > 260 * 260; if (far) { B.x += Math.cos(B.ang) * D.spd * dt; B.y += Math.sin(B.ang) * D.spd * dt; } }
      else if (!T && !hover) { B.x += Math.cos(B.ang) * D.spd * 0.5 * dt; B.y += Math.sin(B.ang) * D.spd * 0.5 * dt; }
      B.x = clamp(B.x, 200, MAP.w - 200); B.y = clamp(B.y, 200, MAP.h - 200);
      const [gx, gy] = this.turrets(B)[0]; B.tcd[0] -= dt;
      if (B.tcd[0] <= 0 && T && !hover && d2(gx, gy, T.x, T.y) < 780 * 780) { B.tcd[0] = 0.16; this.shoot(null, gx, gy, B.ang + (this.rng() - 0.5) * 0.22, 600, 1.3, 6, BK.boss, { npc: true, team: -1 }); }
      if (B.bombAt <= t) { B.bombAt = t + 6; B.sweepAt = t + 1.3; this.warns.push({ x: B.x, y: B.y, r: B.r * 2.3, at: t + 1.3, k: "sweep" }); this.ev.push({ k: "bwarn", n: 1 }); }
      if (B.misAt <= t) { B.misAt = t + 12; const Tg = this.nearestPlane(B.x, B.y, 2500); if (Tg && [...this.F.values()].filter(Q => Q.npc).length < 10) { this.spawnSquad(Tg, 3, 12, { x: B.x, y: B.y, hp: 35, drone: true }); } }
    } else {
      // 폭격기: 한쪽 끝에서 반대쪽으로 빠르게, 끝에서 돌아옴
      const spd = D.spd * 1.9; if ((B.x > MAP.w - 300 && Math.cos(B.ang) > 0) || (B.x < 300 && Math.cos(B.ang) < 0)) { B.turning = true; B.ty = clamp(B.y + (this.rng() < 0.5 ? -1 : 1) * 900, 600, MAP.h - 600); }
      if (B.turning) { B.ang += 0.9 * dt * (B.y < B.ty ? 1 : -1) * (Math.cos(B.ang) > 0 ? 1 : -1); if ((Math.cos(B.ang) > 0.95 && B.x < MAP.w / 2) || (Math.cos(B.ang) < -0.95 && B.x > MAP.w / 2)) { B.turning = false; B.ang = Math.cos(B.ang) > 0 ? 0 : Math.PI; } }
      B.x += Math.cos(B.ang) * spd * dt; B.y += Math.sin(B.ang) * spd * dt; B.y = clamp(B.y, 300, MAP.h - 300);
      if (B.bombAt <= t) { B.bombAt = t + 0.45; this.bombs.push({ x: B.x - Math.cos(B.ang) * 60 + (this.rng() - 0.5) * 120, y: B.y - Math.sin(B.ang) * 60 + (this.rng() - 0.5) * 120, at: t + 1.1, r: 100, dmg: 26, npc: true }); }
      if (B.misAt <= t) { B.misAt = t + 3.5; for (const off of [-0.4, 0.4]) { const T = this.nearestPlane(B.x, B.y, 1100); if (!T) break; const m = this.shoot(null, B.x, B.y, B.ang + Math.PI + off, 480, 3, 22, BK.missile, { npc: true, team: -1, tgt: T.fid }); if (m) m.turn = 2.4; } }
      const [tx, ty] = this.turrets(B)[0]; B.tcd[0] -= dt; if (B.tcd[0] <= 0) { const T = this.nearestPlane(tx, ty, 700); if (T) { B.tcd[0] = 0.35; this.shoot(null, tx, ty, Math.atan2(T.y - ty, T.x - tx) + (this.rng() - 0.5) * 0.15, 560, 1.3, 7, BK.boss, { npc: true, team: -1 }); } }
    }
    // 부딪히면 튕겨남 + 피해
    for (const [cx, cy, cr] of this.bossCircles(B)) for (const P of this.F.values()) { if (P.state !== "alive" || P.npc || (P.b.bumpAt || 0) > t) continue; if (d2(P.x, P.y, cx, cy) < (cr + this.radius(P)) ** 2) { P.b.bumpAt = t + 0.6; this.damage(P, 15, null, "boom"); P.ang = Math.atan2(P.y - cy, P.x - cx); P.in.ang = P.ang; } }
  }
  nearestPlane(x, y, r) { let best = null, bd = r * r; for (const P of this.F.values()) { if (P.state !== "alive" || P.npc || P.protect > this.t) continue; const d = d2(x, y, P.x, P.y); if (d < bd) { bd = d; best = P; } } return best; }
  // ---------- 이벤트 ----------
  events(dt) {
    const t = this.t;
    for (const e of this.evPlan) if (!e.done && t >= e.at) { e.done = true; this.startEvent(e.k); }
    if (!this.double && t >= DOUBLE_AT * this.len / GAME_LEN) { this.double = true; this.gev.push({ k: "double" }); }
    if (this.event && this.event.until <= t) { if (this.event.k === "bounty" && this.bountyFid) { const P = this.F.get(this.bountyFid); if (P && P.state === "alive") { P.score += 300; this.gev.push({ k: "bountysafe", f: P.fid }); } this.bountyFid = 0; } if (this.event.k === "balloon") { for (const L of this.balloons) this.ev.push({ k: "pop", x: Math.round(L.x), y: Math.round(L.y) }); this.balloons = []; } this.gev.push({ k: "evend", e: this.event.k }); this.event = null; this.storm = 0; }
    if (this.windT > t) { const k = Math.min(1, (this.windT - t) / 2, (t - this.windAt) / 2); this.wind = { x: this.windDir.x * 150 * k, y: this.windDir.y * 150 * k }; } else if (this.wind.x || this.wind.y) this.wind = { x: 0, y: 0 };
    // 뇌우: 번개 예고 → 떨어짐
    if (this.event?.k === "meteor" && this.tick % 12 === 0) { const ps = [...this.F.values()].filter(P => P.state === "alive" && !P.npc); for (let i = 0; i < 2 && ps.length; i++) { const P = ps[Math.floor(this.rng() * ps.length)]; this.warns.push({ x: clamp(P.x + P.vx * 1.3 + (this.rng() - 0.5) * 300, X0, X1), y: clamp(P.y + P.vy * 1.3 + (this.rng() - 0.5) * 300, Y0, Y1), r: 130, at: t + 1.4, k: "meteor" }); } }
    if (this.storm && this.tick % 24 === 0) { const ps = [...this.F.values()].filter(P => P.state === "alive" && !P.npc).sort(() => this.rng() - 0.5).slice(0, 3); for (const P of ps) this.warns.push({ x: P.x + P.vx * 1.1 + (this.rng() - 0.5) * 140, y: P.y + P.vy * 1.1 + (this.rng() - 0.5) * 140, r: 120, at: t + 1.3, k: "bolt" }); }
    for (const w of this.warns) if (!w.done && w.at <= t) { w.done = true;
      if (w.k === "bolt") { for (const P of this.F.values()) { if (P.state !== "alive" || P.npc) continue; if (d2(P.x, P.y, w.x, w.y) < (w.r + this.radius(P)) ** 2) { this.damage(P, 40, null, "storm"); P.b.stun = t + 0.5; } } this.ev.push({ k: "bolt", x: Math.round(w.x), y: Math.round(w.y), r: w.r }); }
      if (w.k === "meteor" || w.k === "sweep") { const dmg = w.k === "meteor" ? 50 : 35, cx = w.k === "sweep" && this.boss ? this.boss.x : w.x, cy = w.k === "sweep" && this.boss ? this.boss.y : w.y; for (const P of this.F.values()) { if (P.state !== "alive" || (w.k === "sweep" && P.npc)) continue; if (d2(P.x, P.y, cx, cy) < (w.r + this.radius(P)) ** 2) this.damage(P, dmg, null, "storm"); } this.ev.push({ k: w.k, x: Math.round(cx), y: Math.round(cy), r: w.r }); }
      if (w.k === "crate") { this.spawnPickup("supply", w.x, w.y, { life: 25 }); this.ev.push({ k: "crate", x: Math.round(w.x), y: Math.round(w.y) }); } }
    this.warns = this.warns.filter(w => !w.done);
  }
  startEvent(k, o = {}) {
    if (!Object.prototype.hasOwnProperty.call(EVENTS, k)) return;
    const t = this.t, E = EVENTS[k]; this.event = { k, until: t + E.t };
    if (k === "storm") this.storm = 1;
    if (k === "balloon") { this.balloons = []; const ps = [...this.F.values()].filter(P => P.state === "alive" && !P.npc); for (let i = 0; i < 7; i++) { const hs = ps.filter(Q => Q.human), P = i < 3 && ps.length ? (o.target || (hs.length ? hs[Math.floor(this.rng() * hs.length)] : ps[Math.floor(this.rng() * ps.length)])) : null; this.balloons.push({ id: this.balSeq++, x: P ? clamp(P.x + (this.rng() - 0.5) * 1200, X0 + 200, X1 - 200) : X0 + 300 + this.rng() * (X1 - X0 - 600), y: P ? clamp(P.y + (this.rng() - 0.5) * 800, Y0 + 200, Y1 - 200) : Y0 + 300 + this.rng() * (Y1 - Y0 - 600), hp: 70, max: 70, ph: this.rng() * 6 }); } }
    if (k === "gust") { const a = this.rng() * TAU; this.windDir = { x: Math.cos(a), y: Math.sin(a) }; this.windAt = t; this.windT = t + E.t; }
    if (k === "supply") { const ps = [...this.F.values()].filter(P => P.human && P.state === "alive"); for (let i = 0; i < 3; i++) { const P = i === 0 && ps.length ? ps[Math.floor(this.rng() * ps.length)] : null; const x = P ? clamp(P.x + (this.rng() - 0.5) * 1400, X0 + 200, X1 - 200) : X0 + 400 + this.rng() * (X1 - X0 - 800), y = P ? clamp(P.y + (this.rng() - 0.5) * 900, Y0 + 200, Y1 - 200) : Y0 + 400 + this.rng() * (Y1 - Y0 - 800); this.warns.push({ x, y, r: 110, at: t + 3, k: "crate" }); } }
    if (k === "squad") this.spawnSquad(o.target || this.ranking().find(P => P.state === "alive") || null, 5, E.t);
    if (k === "bounty") { const L = o.target || this.ranking().find(P => P.state === "alive"); this.bountyFid = L ? L.fid : 0; }
    this.gev.push({ k: "event", e: k, tg: k === "bounty" ? this.bountyFid : undefined, wd: k === "gust" ? [+this.windDir.x.toFixed(2), +this.windDir.y.toFixed(2)] : undefined });
  }
  spawnSquad(T, n, dur, o = {}) {
    if (!T) return; const side = this.rng() * TAU;
    for (let i = 0; i < n; i++) { const P = this.newPlane({ fid: this.npcSeq++, name: ["적 편대", "敵編隊", "Enemy Squadron"], skin: "raven", npc: "squad", bot: "ace" }); if (this.npcSeq > 999) this.npcSeq = 900;
      P.x = clamp(o.x != null ? o.x + (i - 1) * 60 : T.x + Math.cos(side) * 1100 + (i - n / 2) * 70, X0, X1); P.y = clamp(o.y != null ? o.y + 40 : T.y + Math.sin(side) * 1100 + (i % 2) * 60, Y0, Y1); P.ang = Math.atan2(T.y - P.y, T.x - P.x); P.hp = P.maxHp = o.hp || 60; if (o.drone) P.drone = 1; P.protect = 0; P.hunt = T.fid; P.until = this.t + dur; P.team = -1;
      this.F.set(P.fid, P); }
    this.rosterVer++; if (!o.drone) this.gev.push({ k: "squad", tg: T.fid }); else this.gev.push({ k: "drones", tg: T.fid });
  }
  // ---------- 섬 대공포 (2차): 혼자(같은 편만) 3초 머물면 점령 → 점령한 편의 적을 자동 사격 ----------
  sideOf(P) { return P.npc ? -5 : P.donor ? -6 : this.mode === "team" ? P.team : P.fid; }
  updTurrets(dt) {
    const t = this.t, R2 = TURRET.r * TURRET.r;
    for (const T of this.tur) {
      const sides = new Set(); let who = null;
      for (const P of this.F.values()) { if (P.state !== "alive" || P.npc || P.donor) continue; if (d2(P.x, P.y, T.x, T.y) > R2) continue; sides.add(this.sideOf(P)); who = who || P; }
      if (sides.size === 1) { const sd = [...sides][0]; if (sd !== T.own) { if (T.side !== sd) { T.side = sd; T.prog = 0; } T.prog += dt / TURRET.cap;
          if (T.prog >= 1) { T.own = sd; T.by = who.fid; T.prog = 0; T.side = -1; const pts = TURRET.score * (this.double ? 2 : 1); who.score += pts; who.st.caps = (who.st.caps || 0) + 1; this.gev.push({ k: "capture", f: who.fid, i: T.id, p: pts }); this.ev.push({ k: "cap", x: T.x, y: T.y }); } }
        else { T.prog = 0; T.side = -1; if (who) T.by = who.fid; } }
      else if (sides.size === 0) { T.prog = Math.max(0, T.prog - dt / TURRET.cap * 0.5); if (T.prog === 0) T.side = -1; }
      // 개인전에서 주인이 나가면 중립
      if (T.own >= 0 && this.mode !== "team" && !this.F.get(T.own)) { T.own = -1; T.by = 0; }
      if (T.own === -1) continue;
      T.cd -= dt; if (T.cd > 0) continue;
      let best = null, bd = TURRET.range * TURRET.range;
      for (const Q of this.F.values()) { if (Q.state !== "alive" || Q.protect > t || this.sideOf(Q) === T.own) continue; const d = d2(T.x, T.y, Q.x, Q.y); if (d < bd) { bd = d; best = Q; } }
      if (!best) continue;
      T.cd = TURRET.cd; const lead = Math.sqrt(bd) / 720, a = Math.atan2(best.y + best.vy * lead - T.y, best.x + best.vx * lead - T.x) + (this.rng() - 0.5) * 0.08; T.aim = a;
      const O = this.F.get(this.mode === "team" ? T.by : T.own);
      const b = this.shoot(O && this.sideOf(O) === T.own ? O : null, T.x + Math.cos(a) * 40, T.y + Math.sin(a) * 40, a, 720, 0.95, TURRET.dmg, BK.turret, { team: this.mode === "team" ? T.own : -1 });
      if (b) { b.vx = Math.cos(a) * 720; b.vy = Math.sin(a) * 720; }
    }
  }
  // ---------- 황금 열기구 (2차 이벤트) ----------
  updBalloons(dt) { const t = this.t; for (const L of this.balloons) { L.x = clamp(L.x + (Math.sin(t * 0.7 + L.ph) * 30 + this.wind.x * 0.5) * dt, X0, X1); L.y = clamp(L.y + (-12 + this.wind.y * 0.5) * dt, Y0, Y1); } }
  popBalloon(L, O) {
    L.dead = true; this.balloons = this.balloons.filter(x => !x.dead);
    for (let i = 0; i < 22; i++) { const a = this.rng() * TAU, d = 20 + this.rng() * 160; this.addStar(L.x + Math.cos(a) * d, L.y + Math.sin(a) * d, 2); }
    if (O && !O.npc) { O.score += 150 * (this.double ? 2 : 1); this.gev.push({ k: "balloonpop", f: O.fid }); }
    this.ev.push({ k: "balloon", x: Math.round(L.x), y: Math.round(L.y) });
  }
  // ---------- 증강 고르기 ----------
  checkOffer(P) { if (!this.aug || P.npc || P.donor) return; const n = P.augs.length + P.pend.length; if (n >= MAX_AUGS) return; if (P.xp >= AUG_AT[n]) this.offer(P); }
  offer(P) {
    const acts = P.augs.filter(a => AUG[a].kind === "a").length, legs = P.augs.filter(LEG).length, tier = P.augs.length + P.pend.length, luck = P.augs.includes("b27");
    const pool = AUGS.filter(a => !P.augs.includes(a.id) && !(a.kind === "a" && acts >= MAX_ACTIVE) && !(a.r === "legend" && legs >= MAX_LEGEND));
    const w = (a) => { let x = RARITY_W[a.r]; if (a.r !== "common") x *= 1 + tier * 0.18 + (luck ? 0.6 : 0); if (a.r === "legend" && tier < 2) x *= 0.3; if (a.kind === "a" && acts === 0) x *= 1.3; return x; };
    const opts = [], want = luck ? 4 : 3, avail = pool.slice();
    while (opts.length < want && avail.length) { let sum = 0; for (const a of avail) sum += w(a); let r = this.rng() * sum, pick = avail[0]; for (const a of avail) { r -= w(a); if (r <= 0) { pick = a; break; } } opts.push(pick.id); avail.splice(avail.indexOf(pick), 1); }
    if (!opts.length) return;
    const p = { n: ++P.pickN, kind: "aug", opts, until: this.t + 14, multi: this.humanCount() > 1 }; P.pend.push(p);
    if (P.human && P.id) this.o.out?.("pick", { n: p.n, kind: p.kind, opts: p.opts, multi: p.multi }, P.id);
  }
  pick(pid, n, id) { const P = this.planeById(pid); if (!P) return { ok: false, error: "NO_PLAYER" }; const i = P.pend.findIndex(p => p.n === n); if (i < 0) return { ok: false, error: "NO_OFFER" }; const p = P.pend[i]; if (!p.opts.includes(id)) return { ok: false, error: "BAD_PICK" }; P.pend.splice(i, 1); this.applyAug(P, id); return { ok: true }; }
  applyAug(P, id) {
    if (!AUG[id] || P.augs.includes(id) || P.augs.length >= MAX_AUGS) return;
    P.augs.push(id); if (AUG[id].kind === "a") { const s = P.act[0] ? (P.act[1] ? -1 : 1) : 0; if (s >= 0) { P.act[s] = id; P.acd[s] = 0; } }
    if (id === "b13") { P.maxHp += AUG.b13.v.hp; P.hp += AUG.b13.v.hp; }
    this.recalcSyn(P); this.ev.push({ k: "aug", f: P.fid, x: Math.round(P.x), y: Math.round(P.y), a: id }); if (AUG[id].r === "legend") this.gev.push({ k: "legend", f: P.fid, a: id });
    this.checkOffer(P);
  }
  autoPick(P, p) { const ord = { legend: 4, epic: 3, rare: 2, common: 1 }; const best = p.opts.slice().sort((a, b) => ((AUG[b].kind === "a" && !P.act[0] ? 2 : 0) + ord[AUG[b].r]) - ((AUG[a].kind === "a" && !P.act[0] ? 2 : 0) + ord[AUG[a].r]))[0]; P.pend.splice(P.pend.indexOf(p), 1); this.applyAug(P, best); if (P.human && P.id) this.o.out?.("autopicked", { n: p.n }, P.id); }
  checkPicks() {
    const solo = this.humanCount() <= 1; let any = false;
    for (const P of this.F.values()) { if (P.npc) continue; if (P.state === "alive" && this.aug && !P.pend.length) this.checkOffer(P);
      for (const p of [...P.pend]) { if (!P.human || P.bot) { this.autoPick(P, p); continue; } if (P.state === "dead") continue; if (solo) { any = true; if (!p.wall) p.wall = Date.now() + 30000; if (Date.now() > p.wall) this.autoPick(P, p); } else if (this.t >= p.until) this.autoPick(P, p); } }
    this.paused = solo && any;
  }
  // ---------- 끝 ----------
  ranking() { return [...this.F.values()].filter(P => !P.npc && !P.donor).sort((a, b) => b.score - a.score || b.kills - a.kills); }
  finish() {
    if (this.status !== "play") return; this.status = "ended";
    const rank = this.ranking(); let teamScore = null, winner = null;
    if (this.mode === "team") { teamScore = new Array(this.teams).fill(0); for (const P of rank) teamScore[P.team] += P.score; teamScore = teamScore.map(Math.round); const mx = Math.max(...teamScore); winner = teamScore.filter(x => x === mx).length > 1 ? "draw" : teamScore.indexOf(mx); }
    this.result = { rank: rank.map((P, i) => ({ fid: P.fid, rank: i + 1, human: P.human, idx: P.idx, id: P.id, name: P.human ? P.name : null, ni: P.nameIdx ?? -1, skin: P.skin, team: P.team, score: Math.round(P.score), kills: P.kills, deaths: P.deaths, assists: P.assists, stars: P.st.stars, streak: P.bestStreak, augs: P.augs.slice(),
      ...(P.human ? { tl: [...P.tl, Math.round(P.score)], kb: Object.entries(P.killedBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => [+f, n]), bk: P.bk, st: P.st, leg: P.augs.filter(LEG).length, syn: P.syn.size, acc: P.st.shots ? Math.round(P.st.hits / P.st.shots * 100) : 0, mk: Object.entries(P.vic).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([f, n]) => [+f, n])[0] || null, bm: P.bestMulti } : {}) })), teamScore, winner, t: Math.round(this.t), kills: this.stats.kills, boss: this.bossResult };
    this.o.onEnd?.();
  }
  // ---------- 화면으로 ----------
  view(me, cx, cy, vw, known) {
    const t = this.t, hw = vw.hw, hh = vw.hh, x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
    const inV = (x, y, pad) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
    const planes = []; for (const P of this.F.values()) if (P.state === "alive" && inV(P.x, P.y, 120)) planes.push(P);
    const buls = []; for (const b of this.bul) if (inV(b.x, b.y, 40)) { buls.push(b); if (buls.length >= 500) break; }
    const add = [], rm = [];
    for (let i = 0; i < this.gone.length; i += 2) { const id = this.gone[i]; if (known.has(id)) { known.delete(id); rm.push(id, this.gone[i + 1]); } }
    if (this.tick % 10 === 0) for (const id of known) { const s = this.stars.get(id); if (!s || !inV(s.x, s.y, 500)) { known.delete(id); rm.push(id, 0); } }
    { const gx0 = clamp(((x0 - 60) / GRID) | 0, 0, GW - 1), gx1 = clamp(((x1 + 60) / GRID) | 0, 0, GW - 1), gy0 = clamp(((y0 - 60) / GRID) | 0, 0, GH - 1), gy1 = clamp(((y1 + 60) / GRID) | 0, 0, GH - 1);
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) for (const s of this.sg[gy * GW + gx]) { if (known.has(s.id)) continue; if (add.length >= 700) break; known.add(s.id); add.push(s); } }
    const buf = new ArrayBuffer(8 + planes.length * 14 + buls.length * 6 + add.length * 9 + (rm.length / 2) * 6), dv = new DataView(buf);
    dv.setUint16(0, planes.length, true); dv.setUint16(2, buls.length, true); dv.setUint16(4, add.length, true); dv.setUint16(6, rm.length / 2, true);
    let o = 8;
    for (const P of planes) {
      let f = 0; if (P.protect > t) f |= FL.protect; if (P.rollT > 0) f |= FL.roll; if (P.boosting) f |= FL.boost; if (P.sh > 0 || P.bar > 0) f |= FL.shield; if (P.burn) f |= FL.burn; if (P.b.emp > t) f |= FL.emp; if (P.b.stun > t) f |= FL.stun; if (P.b.after > t) f |= FL.after; if (P.b.airship > t) f |= FL.airship; if (P.b.power > t) f |= FL.power; if (this.bountyFid === P.fid) f |= FL.bounty; if (P.b.flare > t) f |= FL.flare; if (P.b.warp > t) f |= FL.warp; if (P.npc) f |= FL.npc; if (P.donor) f |= FL.donor; if (P.b.hurt > t) f |= FL.hurt;
      dv.setUint16(o, P.fid, true); dv.setInt16(o + 2, Math.round(P.x), true); dv.setInt16(o + 4, Math.round(P.y), true); dv.setUint16(o + 6, Math.round((((P.ang % TAU) + TAU) % TAU) / TAU * 65535), true);
      dv.setUint8(o + 8, Math.max(0, Math.min(255, Math.ceil(P.hp / P.maxHp * 255)))); dv.setUint16(o + 9, f, true); dv.setUint8(o + 11, SKIN_IDS.indexOf(P.skin) & 255); dv.setUint8(o + 12, Math.min(255, this.lvl(P))); dv.setUint8(o + 13, P.npc ? 254 : P.team & 255); o += 14;
    }
    for (const b of buls) { dv.setInt16(o, Math.round(b.x), true); dv.setInt16(o + 2, Math.round(b.y), true); dv.setUint8(o + 4, Math.round((((Math.atan2(b.vy, b.vx) % TAU) + TAU) % TAU) / TAU * 255)); dv.setUint8(o + 5, b.kind | (b.npc ? 0x80 : 0) | (b.owner && me && b.owner === me.fid ? 0x40 : 0)); o += 6; }
    for (const s of add) { dv.setUint32(o, s.id, true); dv.setInt16(o + 4, s.x, true); dv.setInt16(o + 6, s.y, true); dv.setUint8(o + 8, Math.min(255, s.v)); o += 9; }
    for (let i = 0; i < rm.length; i += 2) { dv.setUint32(o, rm[i], true); dv.setUint16(o + 4, rm[i + 1], true); o += 6; }
    const ev = []; for (const e of this.ev) if (e.x === undefined || inV(e.x, e.y, 500)) ev.push(e);
    const j = { t: +this.t.toFixed(2), ev };
    if (this.gev.length) j.g = this.gev;
    if (this.wind.x || this.wind.y) j.wd = [Math.round(this.wind.x), Math.round(this.wind.y)];
    if (this.storm) j.sm = 1;
    const wn = []; for (const w of this.warns) if (inV(w.x, w.y, w.r)) wn.push([Math.round(w.x), Math.round(w.y), w.r, +(w.at - t).toFixed(2), w.k === "crate" ? 1 : w.k === "meteor" ? 3 : w.k === "sweep" ? 4 : 0]); for (const b of this.bombs) if (inV(b.x, b.y, b.r)) wn.push([Math.round(b.x), Math.round(b.y), b.r, +(b.at - t).toFixed(2), 2]); if (wn.length) j.wn = wn;
    const pk = this.pickups.filter(p => inV(p.x, p.y, 60)).map(p => [p.id, p.k, Math.round(p.x), Math.round(p.y)]); if (pk.length) j.pk = pk;
    const wg = []; for (const P of planes) for (const w of P.wing) wg.push([P.fid, Math.round(w.x), Math.round(w.y), +w.ang.toFixed(2)]); if (wg.length) j.wg = wg;
    if (this.event) j.e = [this.event.k, +(this.event.until - t).toFixed(1)];
    if (this.tick % 2 === 0) j.tu = this.tur.map(T => [T.own, Math.round(T.prog * 100), T.side, +T.aim.toFixed(2)]);
    if (this.balloons.length) { const bn = []; for (const L of this.balloons) if (inV(L.x, L.y, 80)) bn.push([L.id, Math.round(L.x), Math.round(L.y), Math.round(L.hp / L.max * 100)]); if (bn.length) j.bn = bn; }
    if (this.double) j.db = 1;
    if (this.paused) j.ps = 1; // 혼자 카드 고르는 중 (화면 예측도 멈춤)
    if (this.bountyFid) { const B = this.F.get(this.bountyFid); if (B) j.bt = [B.fid, Math.round(B.x), Math.round(B.y)]; }
    if (this.boss) { const B = this.boss; j.bo = [B.kind, Math.round(B.x), Math.round(B.y), +B.ang.toFixed(3), Math.max(0, Math.round(B.hp)), Math.round(B.max), B.hurt > t ? 1 : 0, Math.max(0, Math.ceil(B.until - t))]; }
    if (me && me.state === "alive") { j.sp = Math.round(this.speedOf(me)); j.tr = +this.turnOf(me).toFixed(3); j.bo2 = Math.round(me.boost); if (me.boostLock) j.bl = 1; }
    if (this.tick % 10 === 0) { j.top = this.ranking().slice(0, 10).map(P => [P.fid, Math.round(P.score), Math.round(P.x), Math.round(P.y), P.kills, P.state === "alive" ? 1 : 0]); if (this.mode === "team") { const s = new Array(this.teams).fill(0); for (const P of this.F.values()) if (!P.npc && !P.donor) s[P.team] += P.score; j.ts = s.map(Math.round); } }
    return { j, buf };
  }
  hud(P) {
    const t = this.t, rank = this.ranking(), ri = rank.indexOf(P), n = P.augs.length + P.pend.length;
    return { hp: Math.ceil(Math.max(0, P.hp)), mh: P.maxHp, sh: Math.round(P.sh + P.bar), bo: Math.round(P.boost), bm: Math.round(this.bmaxOf(P)), xp: Math.round(P.xp), next: this.aug && n < MAX_AUGS ? AUG_AT[n] : 0, prev: n > 0 ? AUG_AT[n - 1] : 0, lv: this.lvl(P),
      sc: Math.round(P.score), k: P.kills, d: P.deaths, as: P.assists, a: P.augs, s: [...P.syn], act: P.act, cd: [Math.max(0, +P.rollCd.toFixed(1)), Math.max(0, +P.acd[0].toFixed(1)), Math.max(0, +P.acd[1].toFixed(1))],
      pk: P.pend.map(p => ({ n: p.n, kind: p.kind, opts: p.opts, multi: p.multi })), rk: ri + 1, n: rank.length, st: P.state, rs: P.state === "dead" ? +Math.max(0, P.deadT).toFixed(1) : 0, kl: P.state === "dead" ? P.killer : 0, str: P.streak,
      ej: P.augs.includes("b26") ? Math.max(0, Math.ceil(P.at.eject - t)) : -1, b: Object.entries(P.b).filter(([k, v]) => typeof v === "number" && v > t && !["hurt", "ramAt", "bumpAt"].includes(k)).map(([k, v]) => [k, +(v - t).toFixed(1)]) };
  }
}
