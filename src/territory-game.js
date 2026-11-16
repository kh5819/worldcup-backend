// =========================
// DUO TERRITORY — 한 판 시뮬레이션 (서버 권한, 고정 20Hz, 2026-11-16)
// 판정 명세는 territory-core.js 맨 위. 여기선 이동·충돌·점령·증강·고르기·점수·동기화 데이터
// · 클라이언트는 방향(dir)만 보냄. 위치·속도·영토·점수는 전부 여기서 계산
// · 증강 고르기 중(phase "pick")에는 시뮬레이션 시간(t)이 멈춤 — 이동·점령·타이머·재사용 대기 전부 정지
// · 리스폰 규칙: 탈락하면 내 궤적·영토가 모두 사라지고, 3초 뒤 빈 곳에 5×5 새 영토로 재출발
// =========================
import { DIRS, opposite, makeGrid, neighbor, capture, rect, circle, rleChanges, rle, checksum } from "./territory-core.js";
import { AUG, rollOffer } from "./territory-augs.js";

export const HZ = 20, DT = 1 / HZ, PICK_MS = 12000, PICK_EVERY = 45, MAX_AUGS = 5, BASE_SPEED = 6.5, RESPAWN_SEC = 3;
export function mapSize(n) { return n <= 4 ? 56 : n <= 8 ? 76 : n <= 12 ? 92 : 112; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TerritoryGame {
  /** opts: { mode, teamMode, teamShare, durationSec, respawn, map, players:[{ id, name, team, isBot, level }] } */
  constructor(opts, rng = Math.random) {
    this.rng = rng;
    this.mode = opts.mode === "classic" ? "classic" : "augment";
    this.teamMode = !!opts.teamMode; this.teamShare = this.teamMode && opts.teamShare !== false;
    this.duration = clamp(opts.durationSec || 240, 60, 900); this.respawn = !!opts.respawn; this.map = opts.map || "classic";
    const n = opts.players.length, S = mapSize(n);
    this.G = makeGrid(S, S); this.total = S * S;
    this.P = opts.players.map((o, i) => this.newPlayer(i, o));
    this.counts = new Array(n + 1).fill(0); this.counts[0] = this.total;
    this.t = 0; this.phase = "init"; this.pickIdx = -1; this.pickDeadline = 0; this.nextPickAt = PICK_EVERY;
    this.events = []; this.oc = new Map(); this.ta = []; this.tc = []; this.ent = { clones: [], decoys: [], zones: [], walls: [], warns: [], marks: [] };
    this.result = null; this.seq = 0; this.tickNo = 0;
  }
  newPlayer(i, o) {
    return { i, id: o.id, name: o.name, team: this.teamMode ? (o.team | 0) : i, isBot: !!o.isBot, level: o.level || "normal", alive: false, c: 0, n: -1, dir: 1, nextDir: 1, prog: 0, trail: [],
      safeLast: null, kills: 0, deaths: 0, score: 0, captured: 0, bestCapture: 0, maxPct: 0, lastCapAt: 0, comboN: 0, comboUntil: 0, chainUntil: 0, firstCapIdx: -1,
      augs: [], offer: null, picked: true, refresh: 1, used: {}, buffs: [], lostLog: [], lastShape: null, spaceMark: null, respawnAt: 0, aliveSec: 0, warnNear: false, gone: false, killedBy: null, outAt: null };
  }
  emit(type, d = {}) { this.events.push({ type, t: +this.t.toFixed(2), ...d }); }
  drain() { const e = this.events; this.events = []; return e; }
  has(p, id) { return this.mode === "augment" && p.augs.some(a => a.id === id); }
  aug(p, id) { return p.augs.find(a => a.id === id); }
  sameTeam(a, b) { return a === b || (this.teamMode && this.P[a].team === this.P[b].team); }
  safe(p, c) { const o = this.G.owner[c]; return o === p.i + 1 || (this.teamShare && o > 0 && this.P[o - 1].team === p.team); }
  buff(p, k) { return p.buffs.some(b => b.k === k && b.until > this.t); }
  addBuff(p, k, sec, mul = 1) { p.buffs = p.buffs.filter(b => !(b.k === k && b.until <= this.t)); p.buffs.push({ k, until: this.t + sec, mul }); }

  // ---------------- 시작·고르기 ----------------
  start() {
    const S = this.G.W, n = this.P.length;
    this.P.forEach((p, i) => { const a = (i / n) * Math.PI * 2 + 0.3, r = S * 0.33; this.spawn(p, Math.round(S / 2 + Math.cos(a) * r), Math.round(S / 2 + Math.sin(a) * r)); });
    this.emit("start");
    if (this.mode === "augment") this.startPick(0); else this.phase = "play";
  }
  // 증강 받을 수 있는 사람: 나가지 않았고, 5개 미만이고, 완전히 탈락하지 않음(부활 대기 중이면 받음)
  canPick(p) { return !p.gone && p.augs.length < MAX_AUGS && !(p.outAt != null && !p.alive && !p.respawnAt); }
  startPick(idx) {
    this.phase = "pick"; this.pickIdx = idx; this.pickDeadline = Date.now() + PICK_MS;
    for (const p of this.P) { if (!this.canPick(p)) { p.offer = null; p.picked = true; continue; } p.offer = rollOffer(idx, p.augs.map(a => a.id), this.rng); p.picked = !p.offer.length; p.refresh = 1; }
    this.emit("pick", { idx });
    if (this.P.every(p => p.picked)) this.endPick();
  }
  pick(i, id, auto = false) {
    const p = this.P[i];
    if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (!p.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    const d = AUG[id]; p.augs.push({ id, charges: d.charges, cdUntil: 0 }); p.picked = true; p.offer = null;
    this.emit("picked", { i, id, auto });
    if (this.P.every(q => q.picked)) this.endPick();
    return { ok: true };
  }
  refreshOffer(i) { const p = this.P[i]; if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" }; if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" }; p.refresh--; p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng, 3, p.offer); return { ok: true }; }
  autoPick() { const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }; for (const p of this.P) if (!p.picked && p.offer?.length) this.pick(p.i, [...p.offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0], true); }
  endPick() { this.phase = "play"; this.pickDeadline = 0; this.nextPickAt = this.t + PICK_EVERY; this.emit("resume"); }

  // ---------------- 출발·탈락 ----------------
  spawn(p, cx = -1, cy = -1) {
    const G = this.G, S = G.W;
    if (cx < 0) { // 빈 곳 찾기: 살아 있는 머리들과 가장 먼 후보 (중립이 많을수록 좋음)
      let best = null, bv = -1;
      for (let k = 0; k < 50; k++) {
        const x = 3 + Math.floor(this.rng() * (S - 6)), y = 3 + Math.floor(this.rng() * (S - 6));
        let dmin = 999; for (const q of this.P) if (q.alive && q !== p) { const qx = q.c % S, qy = (q.c / S) | 0; dmin = Math.min(dmin, Math.abs(qx - x) + Math.abs(qy - y)); }
        let neutral = 0; for (const c of rect(G, x, y, 2)) if (!G.owner[c] && !G.trail[c]) neutral++;
        const v = Math.min(dmin, 30) * 2 + neutral; if (v > bv) { bv = v; best = [x, y]; }
      }
      [cx, cy] = best;
    }
    cx = clamp(cx, 2, S - 3); cy = clamp(cy, 2, S - 3);
    for (const c of rect(G, cx, cy, 2)) { if (G.trail[c]) this.cutTrailAt(c); this.setOwner(c, p.i + 1); }
    p.alive = true; p.c = cy * S + cx; p.dir = Math.floor(this.rng() * 4); p.nextDir = p.dir; p.prog = 0; p.n = neighbor(G, p.c, p.dir); p.trail = []; p._ts = new Set();
    p.safeLast = { c: p.c, dir: p.dir }; p.respawnAt = 0; p.killedBy = null;
    this.addBuff(p, "spawnGuard", 1.5);
  }
  /** 다른 사람 궤적 칸 위에 영토가 생길 때(출발 등) 그 궤적 주인은 그대로, 칸 표시만 정리 */
  cutTrailAt(c) { void c; }
  setOwner(c, o) {
    const G = this.G, prev = G.owner[c]; if (prev === o) return;
    this.counts[prev]--; this.counts[o]++; G.owner[c] = o; this.oc.set(c, o);
    if (prev > 0) { const q = this.P[prev - 1]; q.lostLog.push(c, this.t); if (q.lostLog.length > 1200) q.lostLog.splice(0, 400); if (this.actor >= 0 && this.actor !== q.i) q.lastTakenBy = this.actor; }
  }
  /** 땅이 0칸이 된 사람은 탈락 (돌아갈 곳이 없어 점령도 못 하므로). 팀 영토 공유 중 팀원 땅이 남았으면 생존 */
  checkLandless() {
    for (const p of this.P) {
      if (!p.alive || this.counts[p.i + 1] > 0) continue;
      if (this.teamShare && this.P.some(q => q !== p && q.team === p.team && this.counts[q.i + 1] > 0)) continue;
      this.kill(p.i, p.lastTakenBy ?? -1, "land");
    }
  }
  tset(p) { if (!p._ts || p._ts.size !== p.trail.length) p._ts = new Set(p.trail); return p._ts; }
  /** 궤적 목록엔 있는데 칸 표시가 빈 곳을 다시 채움 (겹친 칸이 다른 사람 때문에 지워졌을 때) */
  repairTrails() { const G = this.G; for (const q of this.P) if (q.alive) for (const c of q.trail) if (!G.trail[c]) G.trail[c] = q.i + 1; }
  clearTrail(p) {
    const G = this.G, me = p.i + 1;
    for (const c of p.trail) if (G.trail[c] === me) G.trail[c] = 0;
    if (p.trail.length) this.tc.push(p.i);
    p.trail = []; p._ts = new Set();
    this.repairTrails();
  }
  kill(v, by, how) {
    const p = this.P[v]; if (!p.alive) return;
    // 절대 생존: 1번 살아남기
    const sv = this.aug(p, "survive");
    if (sv && sv.charges > 0 && this.mode === "augment") { sv.charges--; p.used.survive = 1; this.clearTrail(p); this.teleport(p, this.safestOwn(p)); this.addBuff(p, "invuln", 2); this.emit("aug", { i: v, id: "survive", auto: true }); return; }
    p.alive = false; p.deaths++; p.killedBy = by; p.outAt = this.t;
    if (by !== v && by >= 0 && this.P[by]) { this.P[by].kills++; }
    this.clearTrail(p);
    const me = v + 1; for (let c = 0; c < this.total; c++) if (this.G.owner[c] === me) this.setOwner(c, 0);
    this.emit("kill", { v, by, how });
    if (this.respawn && this.t < this.duration - RESPAWN_SEC) p.respawnAt = this.t + RESPAWN_SEC;
  }
  teleport(p, c) {
    if (c < 0) return;
    p.c = c; p.prog = 0; p.n = neighbor(this.G, c, p.dir);
    if (p.n < 0) { for (let d = 0; d < 4; d++) { const nn = neighbor(this.G, c, d); if (nn >= 0) { p.dir = d; p.nextDir = d; p.n = nn; break; } } }
  }
  /** 내 영토 중 적 머리와 가장 먼 칸 */
  safestOwn(p) {
    const G = this.G, S = G.W, me = p.i + 1; let best = -1, bv = -1;
    for (let c = 0; c < this.total; c += 1) {
      if (G.owner[c] !== me) continue;
      const x = c % S, y = (c / S) | 0; let d = 999;
      for (const q of this.P) if (q.alive && !this.sameTeam(q.i, p.i)) { d = Math.min(d, Math.abs(q.c % S - x) + Math.abs(((q.c / S) | 0) - y)); }
      if (d > bv) { bv = d; best = c; }
    }
    return best >= 0 ? best : p.c;
  }
  nearestOwn(p) {
    const G = this.G, seen = new Uint8Array(this.total), q = [p.c]; seen[p.c] = 1;
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (this.safe(p, c) && G.owner[c] === p.i + 1) return c; for (let d = 0; d < 4; d++) { const n = neighbor(G, c, d); if (n >= 0 && !seen[n]) { seen[n] = 1; q.push(n); } } }
    return -1;
  }

  // ---------------- 속도 ----------------
  speedOf(p) {
    let m = 1; const aug = this.mode === "augment", inSafe = this.safe(p, p.c);
    if (aug) {
      if (this.has(p, "swiftStep")) m *= 1.08;
      if (this.has(p, "explorer") && !inSafe) m *= 1.06;
      if (this.has(p, "guardian") && inSafe) m *= 1.12;
      if (this.has(p, "chaser") && this.enemyTrailNear(p, 6)) m *= 1.15;
    }
    for (const b of p.buffs) if (b.until > this.t && b.mul !== 1) m *= b.mul;
    return BASE_SPEED * clamp(m, 0.5, 2.2);
  }
  enemyTrailNear(p, r) {
    const G = this.G, S = G.W, x0 = p.c % S, y0 = (p.c / S) | 0;
    for (let y = Math.max(0, y0 - r); y <= Math.min(S - 1, y0 + r); y++) for (let x = Math.max(0, x0 - r); x <= Math.min(S - 1, x0 + r); x++) { const t = G.trail[y * S + x]; if (t && !this.sameTeam(t - 1, p.i)) return true; }
    return false;
  }
  blockedFor(p, c) { const b = this.G.block[c]; return b > 0 && !this.sameTeam(b - 1, p.i); }

  // ---------------- 한 틱 ----------------
  setDir(i, d) { const p = this.P[i]; if (!Number.isInteger(d) || d < 0 || d > 3) return false; p.nextDir = d; return true; }
  tick() {
    if (this.phase !== "play") return false;
    this.t += DT; this.tickNo++;
    const t = this.t, G = this.G;
    // 만료
    for (const p of this.P) if (p.buffs.length) p.buffs = p.buffs.filter(b => b.until > t);
    this.ent.zones = this.ent.zones.filter(z => z.until > t);
    this.ent.decoys = this.ent.decoys.filter(z => z.until > t);
    this.ent.marks = this.ent.marks.filter(m => m.until > t);
    const keepWalls = []; for (const w of this.ent.walls) { if (w.until > t) keepWalls.push(w); else for (const c of w.cells) if (G.block[c] === w.o) G.block[c] = 0; } this.ent.walls = keepWalls;
    // 경고 끝난 전설 발동
    const warns = this.ent.warns; this.ent.warns = [];
    for (const w of warns) { if (w.at <= t) this.fireLegend(w); else this.ent.warns.push(w); }
    // 리스폰
    for (const p of this.P) if (!p.alive && p.respawnAt && p.respawnAt <= t && !p.gone) { this.spawn(p); this.emit("respawn", { i: p.i }); }
    // 이동
    const entries = [];
    for (const p of this.P) {
      if (!p.alive) continue;
      p.aliveSec += DT;
      // 서 있으면(막힘) 새 방향으로 출발
      if (p.n < 0) { const d = p.nextDir; if (d !== opposite(p.dir) || !p.trail.length) { const nn = neighbor(G, p.c, d); if (nn >= 0 && !this.blockedFor(p, nn)) { p.dir = d; p.n = nn; } } if (p.n < 0) continue; }
      // 꺾기는 항상 다음 칸 중심에서만 (예전 '출발 직후 바로 꺾기'는 0.2칸 순간이동이 생겨 화면 예측과 어긋났음)
      p.prog += this.speedOf(p) * DT;
      let guard = 0;
      while (p.prog >= 1 && guard++ < 4) {
        p.prog -= 1; p.c = p.n; entries.push([p.i, p.c, 0]);
        if (p.nextDir !== opposite(p.dir)) p.dir = p.nextDir;
        let nn = neighbor(G, p.c, p.dir);
        if (nn >= 0 && this.blockedFor(p, nn)) nn = -1;
        p.n = nn; if (nn < 0) { p.prog = 0; break; }
      }
    }
    this.processEntries(entries);
    this.moveClones();
    this.updateFlags();
    // 경기 시간·고르기
    if (this.t >= this.duration) { this.finish("time"); return true; }
    if (!this.respawn) { const teams = new Set(this.P.filter(p => p.alive).map(p => p.team)); if (this.P.length > 1 && teams.size <= 1) { this.finish("survivor"); return true; } }
    if (this.mode === "augment" && this.t >= this.nextPickAt && this.duration - this.t > 20 && this.P.some(p => this.canPick(p))) this.startPick(this.pickIdx + 1);
    return true;
  }
  /** 칸 들어가기 처리: entries = [[플레이어, 칸, noCollide]] — 이동·대시·순간이동 공용 */
  processEntries(entries) {
    if (!entries.length) return;
    const G = this.G, hits = [], heads = new Map(), caps = new Set();
    for (const [i, c, noCol] of entries) {
      const p = this.P[i]; if (!p.alive) continue;
      const safe = this.safe(p, c), tr = G.trail[c], mine = this.tset(p).has(c);
      if (!noCol) {
        if (mine && !safe) hits.push({ a: i, v: i, c, self: true }); // 내 궤적 (남의 궤적과 겹친 칸이어도). 그 칸이 그새 내 편 땅이 됐으면 안전
        if (tr && tr - 1 !== i) { const v = tr - 1; if (!this.sameTeam(v, i)) hits.push({ a: i, v, c }); }
        if (!safe && p.trail.length) { const h = heads.get(c) || []; h.push(i); heads.set(c, h); }
      }
      if (safe) { if (p.trail.length) caps.add(i); p.safeLast = { c, dir: p.dir }; }
      else if (!mine) { if (!tr) G.trail[c] = i + 1; p.trail.push(c); p._ts.add(c); this.ta.push(i, c); } // 남의 궤적 칸은 그 주인 표시를 남겨 둠(겹침)
    }
    // 머리끼리 같은 칸 (둘 다 궤적 있음) → 둘 다
    for (const [c, list] of heads) if (list.length > 1) for (const a of list) for (const b of list) if (a !== b && !this.sameTeam(a, b)) hits.push({ a: b, v: a, c, head: true });
    // 동시 판정: 피해자 먼저 모으고 한 번에
    const dead = new Map();
    for (const h of hits) { if (dead.has(h.v)) continue; if (this.protects(h)) continue; dead.set(h.v, h); }
    for (const [v, h] of dead) this.kill(v, h.a, h.self ? "self" : h.head ? "head" : "trail");
    // 지운 궤적 칸 위에 다른 사람 궤적이 겹쳐 있었다면 그 사람 표시로 되살림
    if (dead.size) this.repairTrails();
    // 살아남은 사람만 점령 (번호 순)
    for (const i of [...caps].sort((a, b) => a - b)) if (this.P[i].alive && this.P[i].trail.length) this.doCapture(this.P[i]);
    this.actor = -1;
    if (caps.size) this.checkLandless();
  }
  /** 이 피격을 막는가 (보호막·무적·절대 방어·영토의 왕·안전 지대) */
  protects(h) {
    const p = this.P[h.v];
    if (this.buff(p, "invuln") || this.buff(p, "spawnGuard") && h.self) return true;
    if (this.buff(p, "defense") || this.buff(p, "king")) return true;
    if (h.self) return false;
    if (this.ent.zones.some(z => z.o === p.i && z.cells.has(h.c))) return true;
    const sh = this.aug(p, "shield");
    if (sh && sh.charges > 0 && this.mode === "augment") {
      sh.charges--; p.used.shield = 1;
      // 끊긴 칸 궤적만 지움 (그 칸은 공격자 궤적이 차지)
      const k = p.trail.indexOf(h.c); if (k >= 0) { p.trail.splice(k, 1); this.tset(p).delete(h.c); }
      const a = this.P[h.a]; if (this.G.trail[h.c] === p.i + 1) this.G.trail[h.c] = a && a.alive && this.tset(a).has(h.c) ? a.i + 1 : 0;
      this.emit("aug", { i: p.i, id: "shield", auto: true, c: h.c });
      return true;
    }
    return false;
  }
  doCapture(p) {
    const G = this.G, me = p.i + 1, aug = this.mode === "augment";
    const isWall = this.teamShare ? (o) => o > 0 && this.P[o - 1].team === p.team : (o) => o === me;
    const trailCells = p.trail.slice();
    const res = capture(G, me, trailCells, isWall);
    // capture 가 owner 를 직접 바꿨으니 집계 맞추기
    const changed = res.changed;
    for (const [c, prev] of changed) { this.counts[prev]--; this.counts[me]++; this.oc.set(c, me); if (prev > 0) { const q = this.P[prev - 1]; q.lostLog.push(c, this.t); if (q !== p) q.lastTakenBy = p.i; } }
    this.actor = p.i;
    const newCells = changed.map(x => x[0]);
    const extra = [];
    const grab = (c, onlyEnemy) => { const o = G.owner[c]; if (o === me || isWall(o)) return false; if (onlyEnemy && !o) return false; extra.push([c, o]); this.setOwner(c, me); return true; };
    if (aug && this.buff(p, "doubleTrail")) for (const c of trailCells) for (let d = 0; d < 4; d++) { const n = neighbor(G, c, d); if (n >= 0) grab(n, false); }
    const comeback = aug && this.has(p, "lastComeback") && this.isFarBehind(p);
    if (aug && (this.has(p, "absorb") || comeback || this.buff(p, "king"))) {
      let budget = this.has(p, "absorb") ? 60 : 40; const set = new Set(newCells);
      outer: for (let ring = 0; ring < 2; ring++) {
        const frontier = [...set];
        for (const c of frontier) for (let d = 0; d < 4; d++) { const n = neighbor(G, c, d); if (n < 0 || set.has(n)) continue; const o = G.owner[n]; if (o && o !== me && !isWall(o)) { if (grab(n, true)) { set.add(n); if (--budget <= 0) break outer; } } }
      }
    }
    for (const c of trailCells) if (G.trail[c] === me) G.trail[c] = 0;
    p.trail = []; p._ts = new Set(); this.tc.push(p.i); this.repairTrails();
    const all = changed.concat(extra), n = all.length;
    if (!n) return;
    // 점수
    let enemyN = 0; for (const [, o] of all) if (o > 0 && !isWall(o)) enemyN++;
    let pts = n + (aug && this.has(p, "raider") ? enemyN * 0.6 : 0);
    let mul = 1;
    if (aug) {
      if (this.has(p, "expander")) mul *= 1.1;
      if (this.has(p, "combo")) { p.comboN = p.comboUntil > this.t ? Math.min(3, p.comboN + 1) : 0; p.comboUntil = this.t + 8; mul *= 1 + 0.15 * p.comboN; }
      if (this.has(p, "chainCapture") && p.chainUntil > this.t) { mul *= 1.5; p.chainUntil = 0; }
      if (this.buff(p, "ruler")) mul *= 1.5;
      if (this.buff(p, "king")) mul *= 1.5;
      if (comeback) mul *= 2;
    }
    pts *= mul;
    if (aug && this.has(p, "firstCapture") && p.firstCapIdx !== this.pickIdx) { p.firstCapIdx = this.pickIdx; pts += 40; p.used.firstCapture = 1; }
    p.score += Math.round(pts); p.captured += n; p.bestCapture = Math.max(p.bestCapture, n); p.lastCapAt = this.t;
    if (aug) {
      if (this.has(p, "safeReturn")) { this.addBuff(p, "safeReturn", 1.5, 1.3); p.used.safeReturn = 1; }
      if (this.has(p, "accel")) { this.addBuff(p, "accel", 2, 1.25); p.used.accel = 1; }
      if (this.has(p, "chainCapture") && n >= 25) { p.chainUntil = this.t + 10; p.used.chainCapture = 1; }
      if (this.has(p, "absorb") && extra.length) p.used.absorb = 1;
      if (comeback) p.used.lastComeback = 1;
      // 영역 복제용 모양 (내 머리 기준 상대 좌표, 최대 50칸)
      const S = G.W, hx = p.c % S, hy = (p.c / S) | 0;
      p.lastShape = newCells.slice(0, 50).map(c => [(c % S) - hx, ((c / S) | 0) - hy]);
    }
    this.emit("capture", { i: p.i, n, enemy: enemyN, pts: Math.round(pts), c: p.c });
  }
  isFarBehind(p) { let lead = 0; for (const q of this.P) lead = Math.max(lead, this.counts[q.i + 1]); return lead > 0 && this.counts[p.i + 1] < lead * 0.4; }

  // ---------------- 분신 ----------------
  moveClones() {
    const G = this.G, t = this.t, keep = [];
    for (const k of this.ent.clones) {
      if (k.until <= t) continue;
      k.prog += k.speed * DT;
      while (k.prog >= 1) {
        k.prog -= 1; k.c = k.n; k.path.push(k.c); if (k.path.length > 30) k.path.shift();
        if (--k.turnIn <= 0 || neighbor(G, k.c, k.dir) < 0) { const opts = [0, 1, 2, 3].filter(d => d !== opposite(k.dir) && neighbor(G, k.c, d) >= 0); k.dir = opts[Math.floor(this.rng() * opts.length)]; k.turnIn = 3 + Math.floor(this.rng() * 6); }
        k.n = neighbor(G, k.c, k.dir);
      }
      keep.push(k);
    }
    this.ent.clones = keep;
  }
  addClone(p, dir) { const n = neighbor(this.G, p.c, dir); if (n < 0) return; this.ent.clones.push({ o: p.i, c: p.c, n, dir, prog: p.prog, speed: this.speedOf(p), until: this.t + 6, turnIn: 4, path: [] }); }
  updateFlags() {
    for (const p of this.P) {
      if (!p.alive || !this.has(p, "dangerSense") || !p.trail.length) { p.warnNear = false; continue; }
      const S = this.G.W; let near = false;
      for (const q of this.P) { if (!q.alive || this.sameTeam(q.i, p.i)) continue; const qx = q.c % S, qy = (q.c / S) | 0; for (let k = p.trail.length - 1; k >= 0 && !near; k -= 2) { const c = p.trail[k]; if (Math.abs(c % S - qx) + Math.abs(((c / S) | 0) - qy) <= 5) near = true; } if (near) break; }
      if (near && !p.warnNear) this.emit("danger", { i: p.i });
      p.warnNear = near;
    }
  }

  // ---------------- 증강 사용 ----------------
  ahead(p, k) { const S = this.G.W; let x = p.c % S, y = (p.c / S) | 0; x = clamp(x + DIRS[p.dir][0] * k, 0, S - 1); y = clamp(y + DIRS[p.dir][1] * k, 0, S - 1); return [x, y]; }
  use(i, id) {
    const p = this.P[i], a = this.aug(p, id), d = AUG[id];
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (!p.alive) return { ok: false, error: "DEAD" };
    if (!a || !d) return { ok: false, error: "NO_AUG" };
    if (d.kind !== "active") return { ok: false, error: "PASSIVE" };
    if (a.charges !== null && a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
    if (a.cdUntil > this.t) return { ok: false, error: "COOLDOWN" };
    if (this.ent.warns.some(w => w.i === i)) return { ok: false, error: "WARNING_ACTIVE" };
    const G = this.G, S = G.W;
    let done = true;
    this.actor = i;
    try { return this._use(p, a, d, i, id, G, S, done); } finally { this.actor = -1; this.checkLandless(); }
  }
  _use(p, a, d, i, id, G, S, done) {
    switch (id) {
      case "shortSprint": this.addBuff(p, "sprint", 1.2, 1.4); break;
      case "infiniteSprint": this.addBuff(p, "sprint", 3, 1.8); break;
      case "rulerStep": this.addBuff(p, "ruler", 5, 1.3); break;
      case "trailCamo": this.addBuff(p, "camo", 5); break;
      case "doubleTrail": this.addBuff(p, "doubleTrail", 8); break;
      case "absoluteDefense": this.addBuff(p, "defense", 4); break;
      case "dash": case "dimensionShift": {
        const steps = id === "dash" ? 4 : 6, ent = []; let c = p.c;
        for (let k = 0; k < steps; k++) { const n = neighbor(G, c, p.dir); if (n < 0 || this.blockedFor(p, n)) break; c = n; ent.push([i, c, id === "dimensionShift" ? 1 : 0]); }
        if (!ent.length) return { ok: false, error: "BLOCKED" };
        p.c = c; p.prog = 0; p.n = neighbor(G, c, p.dir); if (p.n >= 0 && this.blockedFor(p, p.n)) p.n = -1;
        for (const e of ent) { if (!p.alive) break; this.processEntries([e]); } break; // 한 칸씩 (중간에 땅에 닿으면 그때 점령)
      }
      case "emergencyReturn": { if (!p.trail.length) return { ok: false, error: "NO_TRAIL" }; const c = this.nearestOwn(p); if (c < 0) return { ok: false, error: "NO_TARGET" }; this.clearTrail(p); this.teleport(p, c); break; }
      case "timeRewind": { if (!p.trail.length || !p.safeLast) return { ok: false, error: "NO_TRAIL" }; this.clearTrail(p); let c = p.safeLast.c; if (!this.safe(p, c)) c = this.nearestOwn(p); p.dir = p.safeLast.dir; p.nextDir = p.dir; this.teleport(p, c); this.addBuff(p, "invuln", 1.5); break; }
      case "decoyTrail": { const cells = []; let c = p.c; const back = opposite(p.dir); for (let k = 0; k < 10; k++) { const n = neighbor(G, c, k < 5 ? back : (back + 1) & 3); if (n < 0) break; c = n; cells.push(c); } this.ent.decoys.push({ o: i, cells, until: this.t + 6 }); break; }
      case "recover": {
        const L = p.lostLog, got = []; const since = this.t - 10;
        for (let k = L.length - 2; k >= 0 && got.length < 40; k -= 2) if (L[k + 1] >= since && G.owner[L[k]] === 0 && !got.includes(L[k])) got.push(L[k]);
        if (!got.length) return { ok: false, error: "NO_TARGET" };
        for (const c of got) this.setOwner(c, i + 1); this.emit("aug", { i, id, n: got.length, c: p.c }); done = false; break;
      }
      case "safeZone": { const cx = p.c % S, cy = (p.c / S) | 0; this.ent.zones.push({ o: i, cx, cy, r: 2, cells: new Set(rect(G, cx, cy, 2)), until: this.t + 5 }); break; }
      case "territoryBlast": { const [x, y] = this.ahead(p, 4); let n = 0; for (const c of rect(G, x, y, 3)) { const o = G.owner[c]; if (o && !this.sameTeam(o - 1, i)) { this.setOwner(c, 0); n++; } } this.emit("aug", { i, id, cx: x, cy: y, r: 3, n }); done = false; break; }
      case "shadowClone": this.addClone(p, (p.dir + 1) & 3); break;
      case "barrier": {
        const [x, y] = this.ahead(p, 3), cells = []; const px = DIRS[(p.dir + 1) & 3];
        for (let k = -2; k <= 2; k++) { const cx = x + px[0] * k, cy = y + px[1] * k; if (cx < 0 || cy < 0 || cx >= S || cy >= S) continue; const c = cy * S + cx; if (this.P.some(q => q.alive && q.c === c)) continue; G.block[c] = i + 1; cells.push(c); }
        if (!cells.length) return { ok: false, error: "BLOCKED" };
        this.ent.walls.push({ o: i + 1, cells, until: this.t + 6 });
        for (const q of this.P) if (q.alive && q.n >= 0 && this.blockedFor(q, q.n)) { q.n = -1; q.prog = 0; }
        break;
      }
      case "replicate": {
        if (!this.safe(p, p.c)) return { ok: false, error: "NEED_OWN_LAND" };
        if (!p.lastShape?.length) return { ok: false, error: "NO_TARGET" };
        const hx = p.c % S, hy = (p.c / S) | 0; let n = 0;
        for (const [dx, dy] of p.lastShape) { const x = hx + dx, y = hy + dy; if (x < 0 || y < 0 || x >= S || y >= S) continue; const c = y * S + x; if (!G.owner[c] && !G.trail[c]) { this.setOwner(c, i + 1); n++; } }
        if (!n) return { ok: false, error: "NO_TARGET" };
        this.emit("aug", { i, id, n, c: p.c }); done = false; break;
      }
      case "spaceRule": {
        if (!p.spaceMark || p.spaceMark.until <= this.t) { p.spaceMark = { c: p.c, until: this.t + 15 }; this.ent.marks = this.ent.marks.filter(m => m.o !== i); this.ent.marks.push({ o: i, c: p.c, until: this.t + 15 }); this.emit("aug", { i, id, mark: true, c: p.c }); return { ok: true, mark: true }; }
        this.clearTrail(p); this.teleport(p, p.spaceMark.c); p.spaceMark = null; this.ent.marks = this.ent.marks.filter(m => m.o !== i);
        if (!this.safe(p, p.c)) this.processEntries([[i, p.c, 1]]); // 땅 밖에 도착하면 그 칸부터 궤적 (틈이 생겨 점령이 새지 않게)
        break;
      }
      case "divineLand": case "megaBlast": case "conversion": case "cloneArmy": case "territoryKing": {
        const w = { i, id, at: this.t + d.warn };
        const S2 = S; if (id === "megaBlast") { const [x, y] = this.ahead(p, 6); Object.assign(w, { cx: x, cy: y, r: 6, shape: "rect" }); }
        else if (id === "conversion") { const [x, y] = this.ahead(p, 5); Object.assign(w, { cx: x, cy: y, r: 4, shape: "rect" }); }
        else if (id === "divineLand") Object.assign(w, { cx: p.c % S2, cy: (p.c / S2) | 0, r: 7, shape: "circle", follow: true });
        else Object.assign(w, { cx: p.c % S2, cy: (p.c / S2) | 0, r: 2, shape: "circle", follow: true });
        this.ent.warns.push(w);
        this.emit("warn", { i, id, sec: d.warn, cx: w.cx, cy: w.cy, r: w.r, shape: w.shape });
        break;
      }
      default: return { ok: false, error: "NO_AUG" };
    }
    if (a.charges !== null) a.charges--;
    if (d.cd) a.cdUntil = this.t + d.cd;
    p.used[id] = (p.used[id] || 0) + 1;
    if (done) this.emit("aug", { i, id, c: p.c });
    return { ok: true };
  }
  fireLegend(w) {
    const p = this.P[w.i], G = this.G, S = G.W, me = w.i + 1;
    if (!p.alive && w.id !== "megaBlast" && w.id !== "conversion") return;
    if (w.follow) { w.cx = p.c % S; w.cy = (p.c / S) | 0; }
    this.actor = w.i;
    try { this._fire(w, p, G, me); } finally { this.actor = -1; this.checkLandless(); }
  }
  _fire(w, p, G, me) {
    let n = 0;
    if (w.id === "divineLand") { for (const c of circle(G, w.cx, w.cy, w.r)) if (!G.owner[c] && !G.trail[c]) { this.setOwner(c, me); n++; } }
    else if (w.id === "megaBlast") { for (const c of rect(G, w.cx, w.cy, w.r)) { const o = G.owner[c]; if (o && !this.sameTeam(o - 1, w.i)) { this.setOwner(c, 0); n++; } } }
    else if (w.id === "conversion") { for (const c of rect(G, w.cx, w.cy, w.r)) { const o = G.owner[c]; if (o && !this.sameTeam(o - 1, w.i)) { this.setOwner(c, me); n++; } } }
    else if (w.id === "cloneArmy") { for (let d = 0; d < 4; d++) this.addClone(p, d); }
    else if (w.id === "territoryKing") this.addBuff(p, "king", 8, 1.2);
    if (n) { p.score += Math.round(n * (w.id === "megaBlast" ? 0.3 : 1)); }
    this.emit("aug", { i: w.i, id: w.id, fired: true, n, cx: w.cx, cy: w.cy, r: w.r });
  }
  /** 스트리머 모드 이벤트 (모의 후원 등) — 서버가 정한 효과만 */
  streamEvent(kind, target = -1) {
    const alive = this.P.filter(p => p.alive);
    if (kind === "buff") { const p = this.P[target] || alive[Math.floor(this.rng() * alive.length)]; if (!p) return null; this.addBuff(p, "fanBuff", 8, 1.15); this.emit("stream", { kind, i: p.i }); return p.i; }
    if (kind === "debuff") { const p = this.P[target] || alive[Math.floor(this.rng() * alive.length)]; if (!p) return null; this.addBuff(p, "fanDebuff", 6, 0.85); this.emit("stream", { kind, i: p.i }); return p.i; }
    if (kind === "randomAug" && this.mode === "augment") { const p = alive[Math.floor(this.rng() * alive.length)]; if (!p) return null; const act = p.augs.filter(a => AUG[a.id].kind === "active"); for (const a of act) a.cdUntil = 0; this.addBuff(p, "fanBuff", 5, 1.1); this.emit("stream", { kind, i: p.i }); return p.i; }
    if (kind === "mapEvent") { for (const p of alive) this.addBuff(p, "fanDebuff", 3, 0.7); this.emit("stream", { kind }); return -1; }
    return null;
  }

  // ---------------- 끝 ----------------
  ranking() {
    const rows = this.P.map(p => ({ i: p.i, cells: this.counts[p.i + 1], pct: this.counts[p.i + 1] / this.total, score: p.score, kills: p.kills, lastCapAt: p.lastCapAt }));
    rows.sort((a, b) => b.cells - a.cells || b.score - a.score || b.kills - a.kills || a.lastCapAt - b.lastCapAt);
    return rows;
  }
  teamRanking() {
    if (!this.teamMode) return null; const m = new Map();
    for (const p of this.P) { const e = m.get(p.team) || { team: p.team, cells: 0, score: 0 }; e.cells += this.counts[p.i + 1]; e.score += p.score; m.set(p.team, e); }
    return [...m.values()].map(e => ({ ...e, pct: e.cells / this.total })).sort((a, b) => b.cells - a.cells || b.score - a.score);
  }
  finish(reason) {
    if (this.phase === "over") return;
    this.phase = "over";
    for (const p of this.P) p.maxPct = Math.max(p.maxPct, this.counts[p.i + 1] / this.total);
    const rank = this.ranking(), teams = this.teamRanking();
    this.result = { reason, rank, teams, winner: teams ? teams[0].team : rank[0].i, stats: this.P.map(p => ({ i: p.i, kills: p.kills, deaths: p.deaths, captured: p.captured, best: p.bestCapture, maxPct: +p.maxPct.toFixed(4), aliveSec: Math.round(p.aliveSec), augs: p.augs.map(a => a.id), score: p.score })) };
    this.emit("over", { reason });
  }

  // ---------------- 동기화 데이터 ----------------
  /** 매 틱 보내는 묶음 (바뀐 것만) */
  packet() {
    if (this.tickNo % 10 === 0) for (const p of this.P) p.maxPct = Math.max(p.maxPct, this.counts[p.i + 1] / this.total);
    const pl = this.P.map(p => {
      const S = this.G.W; let x = p.c % S + 0.5, y = ((p.c / S) | 0) + 0.5;
      if (p.alive && p.n >= 0) { const nx = p.n % S + 0.5, ny = ((p.n / S) | 0) + 0.5; x += (nx - x) * p.prog; y += (ny - y) * p.prog; }
      let f = 0; if (p.alive) f |= 1; if (this.aug(p, "shield")?.charges > 0) f |= 2; if (this.buff(p, "invuln") || this.buff(p, "spawnGuard")) f |= 4; if (this.buff(p, "camo")) f |= 8;
      if (this.buff(p, "defense")) f |= 16; if (p.warnNear) f |= 32; if (this.buff(p, "king")) f |= 64; if (this.buff(p, "ruler")) f |= 128; if (p.buffs.some(b => b.mul > 1.0001)) f |= 256; if (p.buffs.some(b => b.mul < 0.999)) f |= 512; if (this.buff(p, "doubleTrail")) f |= 1024;
      return [Math.round(x * 100), Math.round(y * 100), p.dir, f];
    });
    const out = { t: +this.t.toFixed(2), n: this.tickNo, p: pl };
    if (this.oc.size) { out.oc = rleChanges(this.oc); this.oc.clear(); }
    if (this.ta.length) { out.ta = this.ta; this.ta = []; }
    if (this.tc.length) { out.tc = this.tc; this.tc = []; }
    const E = this.ent;
    if (E.clones.length || E.decoys.length || E.zones.length || E.walls.length || E.warns.length || E.marks.length || this._entWas) {
      out.e = { k: E.clones.map(k => { const S = this.G.W; let x = k.c % S + 0.5, y = ((k.c / S) | 0) + 0.5; if (k.n >= 0) { x += ((k.n % S + 0.5) - x) * k.prog; y += ((((k.n / S) | 0) + 0.5) - y) * k.prog; } return [k.o, Math.round(x * 100), Math.round(y * 100), k.dir, k.path.slice(-24)]; }),
        d: E.decoys.map(z => [z.o, z.cells]), z: E.zones.map(z => [z.o, z.cx, z.cy, z.r]), w: E.walls.map(w => [w.o - 1, w.cells]), a: E.warns.map(w => [w.i, w.id, w.cx, w.cy, w.r, w.shape, +(w.at - this.t).toFixed(2)]), m: E.marks.map(m => [m.o, m.c]) };
      this._entWas = !!(E.clones.length || E.decoys.length || E.zones.length || E.walls.length || E.warns.length || E.marks.length);
    }
    if (this.tickNo % 20 === 0) out.cs = checksum(this.G.owner);
    return out;
  }
  /** 점수판 (1초마다) */
  board() { return { c: this.P.map(p => this.counts[p.i + 1]), s: this.P.map(p => p.score), k: this.P.map(p => p.kills), r: this.P.map(p => (p.alive ? 0 : p.respawnAt ? Math.max(0, +(p.respawnAt - this.t).toFixed(1)) : -1)) }; }
  /** 처음·재접속용 전체 상태 */
  full(viewer = -1) {
    const G = this.G;
    return {
      W: G.W, H: G.H, owner: rle(G.owner), trails: this.P.map(p => p.trail.slice()), t: this.t, n: this.tickNo, cs: checksum(G.owner),
      mode: this.mode, teamMode: this.teamMode, teamShare: this.teamShare, duration: this.duration, respawn: this.respawn, map: this.map,
      phase: this.phase, pickIdx: this.pickIdx, pickDeadline: this.pickDeadline || null, nextPickAt: this.nextPickAt,
      players: this.P.map(p => ({ i: p.i, name: p.name, team: p.team, isBot: p.isBot, gone: p.gone, augs: p.augs.map(a => ({ id: a.id, charges: a.charges, cd: Math.max(0, +(a.cdUntil - this.t).toFixed(1)) })), picking: this.phase === "pick" && !p.picked })),
      me: viewer >= 0 ? this.mine(viewer) : null, board: this.board(), result: this.result,
    };
  }
  /** 내 정보 (고르기 카드·증강 재사용 대기) */
  mine(i) { const p = this.P[i]; if (!p) return null; return { i, offer: this.phase === "pick" && !p.picked ? p.offer : null, refresh: p.refresh, augs: p.augs.map(a => ({ id: a.id, charges: a.charges, cd: Math.max(0, +(a.cdUntil - this.t).toFixed(1)) })), mark: p.spaceMark ? Math.max(0, +(p.spaceMark.until - this.t).toFixed(1)) : 0 }; }
}
