// =========================================================
// 플듀 대전쟁 — 전투 엔진 (화면·서버 공용, DOM 없음)
// · 싱글(브라우저)과 멀티(서버 권한형)가 같은 파일을 씀
//   서버 사본: worldcup-backend/src/duowars-core.js (내용 같아야 함)
// · 고정 틱(기본 20틱/초). 무작위는 시드 난수만 사용
// · 전장 3종: lane(좌우 2기지: 싱글·협동·팀전) / arena(여러 기지: 개인전)
// =========================================================

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
const ST = { walk: 0, windup: 1, recover: 2, knock: 3, dead: 4, dash: 5, idle: 6, spawn: 7 };
export const STATE = ST;
export const STATE_NAMES = Object.keys(ST);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 에너지 업그레이드 표 (레벨 1~8)
export function energyStats(lv) {
  lv = clamp(lv | 0, 1, 8);
  return { rate: 16 + 7 * (lv - 1), max: 400 + 220 * (lv - 1), upCost: lv >= 8 ? null : 60 * lv + 20 * (lv - 1) * (lv - 1) };
}
// 유닛 레벨 배율 (1~30)
export function levelMul(lv) { return 1 + 0.12 * (clamp(lv | 0, 1, 30) - 1); }

export class DuoWarsGame {
  /**
   * @param {object} data   dw-data.json 내용
   * @param {object} cfg    { mode: 'solo'|'coop'|'team'|'ffa', stageId, seed, players:[{id,name,team,deck,levels}], difficulty, levelFlat }
   */
  constructor(data, cfg) {
    this.data = data;
    this.cfg = cfg;
    this.mode = cfg.mode || "solo";
    this.rng = mulberry32((cfg.seed >>> 0) || 12345);
    this.tick = 0;
    this.time = 0;
    this.units = [];
    this.unitMap = new Map();
    this.projs = [];
    this.bases = [];
    this.players = new Map();
    this.events = [];
    this.nextId = 1;
    this.over = false;
    this.winner = null;      // 팀 번호
    this.teamBuffs = new Map(); // team → [{key, stat, mul, until}]
    this.teamEnergyMul = new Map();
    this.speedMul = 1;
    this.triggers = {};
    this.stats = { kills: {}, dmg: {}, summons: {}, donorSpawns: 0 };
    this.unitCapPerPlayer = this.mode === "ffa" ? 20 : 25;
    this.aiCap = 70;
    const D = data;
    this.stage = D.stages.find((s) => s.id === cfg.stageId) || D.stages[0];
    this.diff = D.difficulty[cfg.difficulty || "normal"] || D.difficulty.normal;
    this.lane = this.mode !== "ffa";
    this._buildField();
    for (const p of cfg.players || []) this._addPlayer(p);
    this._balanceTeams();
    this.wave = { idx: 0, timers: [], boss: [], fired: new Set() };
    if (this.hasAI) this._initWaves();
  }

  // ---------- 전장 ----------
  _buildField() {
    const S = this.stage;
    const D = this.data;
    if (this.lane) {
      this.L = S.length || 2400;
      this.depth = 64;          // 줄 깊이 (위아래로 겹침 방지)
      this.rows = 7;
      const pHp = (S.playerBaseHp || 3000);
      let eHp = (S.enemyBaseHp || 3000) * this.diff.baseHp;
      const np = (this.cfg.players || []).length || 1;
      if (this.mode === "coop") eHp *= 1 + 0.55 * (np - 1);
      if (this.mode === "team") {
        const hp = D.rules.teamBaseHp;
        this.bases.push(this._mkBase(0, 70, hp, "left"));
        this.bases.push(this._mkBase(1, this.L - 70, hp, "right"));
        this.hasAI = false;
      } else {
        this.bases.push(this._mkBase(0, 70, pHp, "left"));
        this.bases.push(this._mkBase(1, this.L - 70, eHp, "right"));
        this.hasAI = true;   // 팀 1 = 적 AI
      }
    } else {
      const n = Math.max(3, (this.cfg.players || []).length);
      this.R = 460 + 70 * n;
      this.hasAI = false;
      const hp = D.rules.ffaBaseHp;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const b = this._mkBase(i, Math.cos(a) * this.R, Math.sin(a) * this.R, "arena");
        b.hp = b.maxHp = hp;
        this.bases.push(b);
      }
    }
  }
  _mkBase(team, x, y, side) {
    const b = { id: "b" + team, team, x, y: side === "arena" ? y : this.depth / 2, hp: 0, maxHp: 0, side, r: 46, alive: true, hitT: 0, owner: null };
    if (side !== "arena") { b.hp = b.maxHp = y; b.y = (this.depth || 64) / 2; }
    return b;
  }
  baseOf(team) { return this.bases.find((b) => b.team === team); }

  _addPlayer(p) {
    const es = energyStats(1);
    const pl = {
      id: p.id, name: String(p.name || "플레이어").slice(0, 12),
      // 팀 번호 정리: 싱글·협동은 0, 팀전은 0/1, 개인전은 기지 번호
      team: this.mode === "team" ? (p.team === 1 ? 1 : 0) : this.mode === "ffa" ? clamp(p.team | 0, 0, this.bases.length - 1) : 0,
      deck: (p.deck || []).filter((u) => this.data.units[u]).slice(0, 8),
      levels: p.levels || {}, eLv: 1, energy: 0, eMax: es.max, eRate: es.rate,
      cd: new Array(8).fill(0), alive: true, live: 0, color: p.color || null, target: null, isAI: !!p.isAI, left: false,
    };
    if (this.cfg.levelFlat) pl.levels = {};
    if (!pl.deck.length) pl.deck = ["malang"];
    if (this.mode === "ffa") { pl.target = null; }
    this.players.set(p.id, pl);
    this.stats.kills[p.id] = 0; this.stats.dmg[p.id] = 0; this.stats.summons[p.id] = 0;
    return pl;
  }
  // 팀 인원 차이 보정: 적은 팀은 에너지 생산 ↑
  _balanceTeams() {
    if (this.mode !== "team") return;
    const cnt = [0, 0];
    for (const p of this.players.values()) cnt[p.team === 1 ? 1 : 0]++;
    const mx = Math.max(cnt[0], cnt[1], 1);
    for (const t of [0, 1]) this.teamEnergyMul.set(t, cnt[t] ? Math.pow(mx / cnt[t], 0.75) : 1);
  }
  energyMulOf(pl) { return (this.teamEnergyMul.get(pl.team) || 1) * (this.suddenDeath ? 1.6 : 1); }

  // ---------- 명령 (서버가 검증) ----------
  summon(pid, slot) {
    const pl = this.players.get(pid);
    if (!pl || !pl.alive || this.over) return { ok: false, error: "NO_PLAYER" };
    slot |= 0;
    const uid = pl.deck[slot];
    const def = uid && this.data.units[uid];
    if (!def) return { ok: false, error: "BAD_SLOT" };
    if (pl.cd[slot] > this.time + 1e-6) return { ok: false, error: "COOLDOWN" };
    const cost = def.cost;
    if (pl.energy + 1e-6 < cost) return { ok: false, error: "NO_ENERGY" };
    if (pl.live >= this.unitCapPerPlayer) return { ok: false, error: "UNIT_CAP" };
    pl.energy -= cost;
    pl.cd[slot] = this.time + def.cd;
    const lv = this.cfg.levelFlat ? (this.cfg.flatLevel || 10) : clamp(pl.levels[uid] || 1, 1, 30);
    const b = this.mode === "ffa" ? this.bases[pl.team] : this.baseOf(pl.team);
    if (!b || !b.alive) { pl.energy += cost; pl.cd[slot] = 0; return { ok: false, error: "NO_BASE" }; }
    const u = this._spawn(uid, pl.team, { owner: pid, lv, base: b, isAlly: true });
    this.stats.summons[pid] = (this.stats.summons[pid] || 0) + 1;
    return { ok: true, id: u.id };
  }
  upgradeEnergy(pid) {
    const pl = this.players.get(pid);
    if (!pl || !pl.alive || this.over) return { ok: false, error: "NO_PLAYER" };
    const s = energyStats(pl.eLv);
    if (s.upCost == null) return { ok: false, error: "MAX" };
    if (pl.energy + 1e-6 < s.upCost) return { ok: false, error: "NO_ENERGY" };
    pl.energy -= s.upCost; pl.eLv++;
    const n = energyStats(pl.eLv); pl.eMax = n.max; pl.eRate = n.rate;
    this.events.push({ k: "up", p: pid, lv: pl.eLv });
    return { ok: true, lv: pl.eLv };
  }
  setTarget(pid, team) {
    const pl = this.players.get(pid);
    if (!pl || this.mode !== "ffa" || !pl.alive) return { ok: false };
    const b = this.bases[team | 0];
    if (!b || !b.alive || b.team === pl.team) return { ok: false, error: "BAD_TARGET" };
    pl.target = b.team;
    for (const u of this.units) if (u.owner === pid && u.alive) u.goal = b.team;
    return { ok: true };
  }
  /** 특별 소환(후원 몬스터 등) — 같은 전투 엔진 사용 */
  spawnSpecial(defId, team, o = {}) {
    const def = this._defOf(defId);
    if (!def || this.over) return null;
    const base = this.mode === "ffa" ? this.bases[team] : this.baseOf(team);
    if (!base || !base.alive) return null;
    const u = this._spawn(defId, team, { owner: o.owner || "special", lv: o.lv || 1, base, label: o.label, donationId: o.donationId, hpMul: o.hpMul, atkMul: o.atkMul, scale: o.scale, tier: o.tier, isAlly: false, special: true });
    this.stats.donorSpawns++;
    return u;
  }
  addTeamBuff(team, stat, mul, durSec, key) {
    const arr = this.teamBuffs.get(team) || [];
    const k = key || stat + ":" + mul;
    const ex = arr.find((b) => b.key === k);
    if (ex) ex.until = Math.max(ex.until, this.time + durSec); // 같은 효과는 시간만 연장 (중첩 X)
    else arr.push({ key: k, stat, mul, until: this.time + durSec });
    this.teamBuffs.set(team, arr);
    this.events.push({ k: "buff", team, stat, mul, dur: durSec });
  }
  buffMul(team, stat) {
    const arr = this.teamBuffs.get(team);
    if (!arr) return 1;
    let m = 1;
    for (const b of arr) if (b.stat === stat && b.until > this.time) m *= b.mul;
    return clamp(m, 0.3, 3);
  }
  healTeam(team, pct) {
    for (const u of this.units) if (u.alive && u.team === team) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * pct); }
    this.events.push({ k: "teamHeal", team });
  }
  healBase(team, pct) { const b = this.baseOf(team); if (b && b.alive) { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * pct); this.events.push({ k: "baseHeal", b: b.team }); } }
  damageBase(team, pct) { const b = this.baseOf(team); if (b && b.alive) this._hitBase(b, b.maxHp * pct, null); }
  addEnergyAll(team, amt) { for (const p of this.players.values()) if (p.team === team || team == null) p.energy = Math.min(p.eMax, Math.max(0, p.energy + amt)); }
  // ---- 후원·투표 효과 (서버가 검증 후 호출) ----
  aliveOf(team, noBoss) { return this.units.filter((u) => u.alive && (team == null || u.team === team) && !(noBoss && u.boss)); }
  giantTeam(team, mul, dur) {
    for (const u of this.aliveOf(team)) {
      if (u.giantUntil > this.time) { u.giantUntil = this.time + dur; continue; }
      u.giantUntil = this.time + dur; u.giantMul = mul; u.scale *= mul; u.r *= mul; u.atk *= mul; const add = u.maxHp * (mul - 1); u.maxHp += add; u.hp += add;
    }
    this.events.push({ k: "giant", team });
  }
  transformTeam(team, n) {
    const list = this.aliveOf(team, true); const pool = team === 0 || this.mode !== "solo" ? Object.keys(this.data.units) : Object.keys(this.data.enemies);
    for (let i = 0; i < n && list.length; i++) {
      const u = list.splice(Math.floor(this.rng() * list.length), 1)[0];
      const nd = pool[Math.floor(this.rng() * pool.length)], def = this._defOf(nd); const ratio = u.hp / u.maxHp;
      u.def = nd; u.maxHp = Math.round(def.hp * levelMul(u.lv)); u.hp = Math.max(1, Math.round(u.maxHp * ratio)); u.atk = def.atk * levelMul(u.lv); u.r = def.r || 16; u.kbLeft = def.kb || 1; u.dashReady = def.special === "dash";
      this.events.push({ k: "morph", id: u.id, def: nd });
    }
  }
  stunTeam(team, dur) { for (const u of this.aliveOf(team, true)) u.stunT = Math.max(u.stunT, dur); this.events.push({ k: "stun", team, dur }); }
  knockTeam(team) { for (const u of this.aliveOf(team, true)) this._knock(u, null); this.events.push({ k: "knockAll", team }); }
  energyTeam(team, amt) { for (const p of this.players.values()) if (p.team === team) p.energy = clamp(p.energy + amt, 0, p.eMax); }
  spawnWave(defId, team, n, o = {}) { const out = []; for (let i = 0; i < n; i++) { const u = this.spawnSpecial(defId, team, o); if (u) out.push(u); } return out; }
  meteor(x, dmg, r, team) { // team: 맞는 쪽(null=전체)
    this.events.push({ k: "meteor", x, y: this.lane ? this.depth / 2 : 0, r });
    for (const u of this.units) if (u.alive && (team == null || u.team === team) && Math.abs(u.x - x) <= r) { this._damage(null, u, dmg, true); }
  }

  // ---------- 유닛 ----------
  _defOf(id) { return this.data.units[id] || this.data.enemies[id] || this.data.bosses[id] || this.data.donor?.[id]; }
  _spawn(defId, team, o) {
    const def = this._defOf(defId);
    const base = o.base;
    const lvm = levelMul(o.lv || 1);
    let hpMul = (o.hpMul || 1) * lvm, atkMul = (o.atkMul || 1) * lvm;
    if (o.enemyScale) { hpMul *= o.enemyScale.hp; atkMul *= o.enemyScale.atk; }
    const u = {
      id: this.nextId++, def: defId, team, owner: o.owner || "ai", lv: o.lv || 1,
      x: base.x, y: base.y, vx: 0, vy: 0,
      hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul), atk: def.atk * atkMul,
      st: ST.spawn, stT: 0, cdT: 0, tgt: null, slowT: 0, slowMul: 1, stunT: 0,
      kbLeft: def.kb || 1, kbNext: 0, alive: true, r: (def.r || 16) * (o.scale || 1), scale: o.scale || def.scale || 1,
      label: o.label ? String(o.label).slice(0, 16) : null, donationId: o.donationId || null, tier: o.tier || null,
      boss: !!(this.data.bosses[defId] || def.isBoss), dashReady: def.special === "dash", specT: def.specEvery || 0, enraged: false,
      goal: null, row: 0, deadT: 0, leapUsed: false, hitFlash: 0,
    };
    u.kbNext = u.maxHp * (1 - 1 / Math.max(1, def.kb || 1));
    if (this.lane) {
      u.dir = base.side === "left" ? 1 : -1;
      u.x = base.x + u.dir * (base.r + 4);
      // 덜 붐비는 줄 고르기 (겹침 줄이기)
      const rowsCnt = new Array(this.rows).fill(0);
      for (const v of this.units) if (v.alive && v.team === team && Math.abs(v.x - u.x) < 120) rowsCnt[v.row]++;
      let best = 0, bestScore = 1e9;
      for (let i = 0; i < this.rows; i++) { const s = rowsCnt[i] * 10 + Math.abs(i - (this.rows >> 1)) + this.rng() * 2; if (s < bestScore) { bestScore = s; best = i; } }
      u.row = best;
      u.y = (this.depth / (this.rows - 1)) * best;
      if (u.boss) { u.row = this.rows >> 1; u.y = this.depth / 2; }
    } else {
      const pl = this.players.get(o.owner);
      u.goal = pl?.target ?? this._defaultTarget(team);
      const ang = this.rng() * Math.PI * 2;
      u.x = base.x + Math.cos(ang) * 20; u.y = base.y + Math.sin(ang) * 20;
    }
    this.units.push(u); this.unitMap.set(u.id, u);
    const pl = this.players.get(u.owner); if (pl) pl.live++;
    this.events.push({ k: "spawn", id: u.id });
    if (u.boss) this.events.push({ k: "boss", id: u.id, def: defId });
    return u;
  }
  _defaultTarget(team) {
    const n = this.bases.length;
    for (let i = 1; i < n; i++) { const b = this.bases[(team + i) % n]; if (b.alive) return b.team; }
    return null;
  }
  hostile(a, b) { return a.team !== b.team; }

  // ---------- 진행 ----------
  step() {
    if (this.over) return;
    this.tick++;
    this.time = this.tick * DT;
    this.events.length = 0;
    // 에너지
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      p.energy = Math.min(p.eMax, p.energy + p.eRate * DT * this.energyMulOf(p));
    }
    if (this.hasAI) this._stepWaves();
    // 서든데스 (팀전·개인전 6분)
    if (!this.hasAI && !this.suddenDeath && this.time >= this.data.rules.suddenDeathSec) { this.suddenDeath = true; this.events.push({ k: "sudden" }); }
    for (const u of this.units) if (u.alive) this._stepUnit(u);
    this._stepProjs();
    // 죽은 유닛 정리 (사망 연출 시간 뒤)
    if (this.tick % 10 === 0) {
      let w = 0;
      for (const u of this.units) {
        if (!u.alive && this.time - u.deadT > 1.2) { this.unitMap.delete(u.id); continue; }
        this.units[w++] = u;
      }
      this.units.length = w;
    }
    for (const b of this.bases) if (b.hitT > 0) b.hitT -= DT;
    this._checkEnd();
  }

  _stepUnit(u) {
    const def = this._defOf(u.def);
    const dt = DT;
    if (u.giantUntil && u.giantUntil <= this.time) { const m = u.giantMul || 1; u.scale /= m; u.r /= m; u.atk /= m; u.giantUntil = 0; }
    if (u.hitFlash > 0) u.hitFlash -= dt;
    if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slowMul = 1; }
    u.stT += dt;
    if (u.st === ST.spawn) { if (u.stT >= 0.35) this._setSt(u, ST.walk); return; }
    if (u.st === ST.knock) {
      // 넉백: 뒤로 밀림 (감속)
      const back = this.lane ? -u.dir : 0;
      const sp = 260 * Math.max(0, 1 - u.stT / 0.5);
      if (this.lane) { u.x = clamp(u.x + back * sp * dt, 20, this.L - 20); }
      else { u.x += u.kx * sp * dt; u.y += u.ky * sp * dt; }
      if (u.stT >= 0.5) this._setSt(u, ST.walk);
      return;
    }
    if (u.stunT > 0) { u.stunT -= dt; return; }
    // 보스·특수 주기 스킬
    if (def.specEvery) { u.specT -= dt; if (u.specT <= 0) { u.specT = def.specEvery * (u.enraged ? 0.65 : 1); this._special(u, def); } }
    const spdMul = this.buffMul(u.team, "spd") * u.slowMul;
    const asMul = this.buffMul(u.team, "aspd") * (u.enraged ? 1.4 : 1);

    if (u.st === ST.windup) {
      const wind = def.windup / asMul;
      if (u.stT >= wind) { this._strike(u, def); this._setSt(u, ST.recover); }
      return;
    }
    if (u.st === ST.recover) {
      const rec = Math.max(0.05, (def.aspd - def.windup) / asMul);
      if (u.stT >= rec) this._setSt(u, ST.walk);
      return;
    }
    if (u.st === ST.dash) {
      const t = this.unitMap.get(u.tgt);
      if (!t || !t.alive) { this._setSt(u, ST.walk); return; }
      const step = 520 * dt;
      if (this.lane) {
        const gap = Math.abs(t.x - u.x) - t.r - u.r;
        u.x += u.dir * Math.min(step, Math.max(0, gap));
        if (gap <= def.range || u.stT > 0.5) { u.crit = true; this._setSt(u, ST.windup); u.stT = def.windup * 0.6; }
      } else {
        const dx = t.x - u.x, dy = t.y - u.y, d = Math.hypot(dx, dy) || 1, gap = d - t.r - u.r;
        const mv = Math.min(step, Math.max(0, gap)); u.x += (dx / d) * mv; u.y += (dy / d) * mv;
        if (gap <= def.range || u.stT > 0.5) { u.crit = true; this._setSt(u, ST.windup); u.stT = def.windup * 0.6; }
      }
      return;
    }
    // 회복형: 다친 아군이 가까이 있으면 적이 없어도 회복
    if (def.special === "heal" && u.cdT <= this.time && this.tick % 4 === u.id % 4) {
      for (const v of this.units) if (v.alive && v !== u && v.team === u.team && v.hp < v.maxHp * 0.95 && this._dist(u, v) <= def.healRange) { u.tgt = null; this._setSt(u, ST.windup); u.cdT = this.time + def.aspd / asMul; return; }
    }
    // walk: 대상 찾기
    const tg = this._findTarget(u, def);
    if (tg) {
      if (def.special === "dash" && u.dashReady && tg.kind === "u") {
        const d = this._dist(u, tg.o);
        if (d > def.range + 20 && d < 230) { u.dashReady = false; u.tgt = tg.o.id; this._setSt(u, ST.dash); this.events.push({ k: "dash", id: u.id }); return; }
      }
      if (tg.inRange) {
        u.tgt = tg.kind === "u" ? tg.o.id : "b" + tg.o.team;
        if (u.cdT <= this.time) { this._setSt(u, ST.windup); u.cdT = this.time + def.aspd / asMul; return; }
        this._idle(u); return;
      }
    }
    // 지원형: 아군 앞줄 뒤에 머묾
    if (def.support && this.lane) {
      const front = this._allyFront(u);
      if (front != null && (front - u.x) * u.dir < def.keepBack) { this._idle(u); return; }
    }
    this._move(u, def, def.speed * spdMul * dt, tg);
  }
  _idle(u) { if (u.st !== ST.idle) { u.st = ST.idle; u.stT = 0; } }
  _setSt(u, s) { u.st = s; u.stT = 0; }

  _allyFront(u) {
    let f = null;
    for (const v of this.units) if (v.alive && v !== u && v.team === u.team && !this._defOf(v.def).support) {
      if (f == null || (v.x - f) * u.dir > 0) f = v.x;
    }
    return f;
  }
  _dist(a, b) { return this.lane ? Math.abs(a.x - b.x) : Math.hypot(a.x - b.x, a.y - b.y); }

  _findTarget(u, def) {
    // 가장 가까운 적 유닛 (lane: 앞쪽만), 기지는 사거리 안일 때
    let best = null, bd = 1e9;
    const aggro = this.lane ? def.range : def.range + 90;
    for (const v of this.units) {
      if (!v.alive || v.team === u.team || v.st === ST.dead) continue;
      if (this._defOf(v.def).flying && def.ground) continue; // 지상 전용은 날아다니는 적 못 침
      let d;
      if (this.lane) { const dx = (v.x - u.x) * u.dir; if (dx < -v.r - 6) continue; d = Math.max(0, dx - v.r); }
      else d = Math.hypot(v.x - u.x, v.y - u.y) - v.r;
      if (d < bd) { bd = d; best = v; }
    }
    if (best && bd <= def.range) return { kind: "u", o: best, inRange: true };
    // 기지
    for (const b of this.bases) {
      if (!b.alive || b.team === u.team) continue;
      if (!this.lane && u.goal != null && b.team !== u.goal) {
        const dd = Math.hypot(b.x - u.x, b.y - u.y) - b.r; if (dd > def.range) continue; // 목표 아닌 기지는 바로 옆일 때만
      }
      let d;
      if (this.lane) { const dx = (b.x - u.x) * u.dir; if (dx < -b.r) continue; d = Math.max(0, dx - b.r); }
      else d = Math.hypot(b.x - u.x, b.y - u.y) - b.r;
      if (d <= def.range) return { kind: "b", o: b, inRange: true };
    }
    if (best && !this.lane && bd <= aggro) return { kind: "u", o: best, inRange: false };
    return null;
  }

  _move(u, def, step, tg) {
    if (u.st !== ST.walk) { u.st = ST.walk; u.stT = 0; }
    if (this.lane) {
      // 가장 가까운 적(유닛·기지) 앞에서 멈춤 → 통과 불가
      let limit = null;
      for (const v of this.units) {
        if (!v.alive || v.team === u.team) continue;
        if (this._defOf(v.def).flying || def.flying) continue;
        const dx = (v.x - u.x) * u.dir; if (dx < -2) continue;
        const stop = dx - v.r - u.r * 0.6; if (limit == null || stop < limit) limit = stop;
      }
      for (const b of this.bases) {
        if (!b.alive || b.team === u.team) continue;
        const dx = (b.x - u.x) * u.dir; if (dx < -b.r) continue;
        const stop = dx - b.r - u.r * 0.4; if (limit == null || stop < limit) limit = stop;
      }
      let mv = step;
      if (limit != null) mv = Math.max(0, Math.min(mv, limit));
      // 날개 적: 막히면 한 번 뛰어넘기
      if (def.special === "leap" && !u.leapUsed && limit != null && limit < 4) { u.leapUsed = true; u.x += u.dir * 140; this.events.push({ k: "leap", id: u.id }); return; }
      u.x = clamp(u.x + u.dir * mv, 10, this.L - 10);
      // 같은 줄 아군 겹침: 앞이 멈춰 있으면 옆 줄로
      if (mv < step * 0.3) this._shiftRow(u);
      const ty = (this.depth / (this.rows - 1)) * u.row;
      u.y += clamp(ty - u.y, -40 * DT, 40 * DT);
    } else {
      let tx, ty;
      if (tg && tg.kind === "u") { tx = tg.o.x; ty = tg.o.y; }
      else {
        const b = this.bases.find((x) => x.team === u.goal && x.alive) || this.bases.find((x) => x.alive && x.team !== u.team);
        if (!b) return; tx = b.x; ty = b.y;
      }
      const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy) || 1;
      u.x += (dx / d) * step; u.y += (dy / d) * step;
      // 아군끼리 살짝 밀어내기
      for (const v of this.units) {
        if (v === u || !v.alive || v.team !== u.team) continue;
        const ex = u.x - v.x, ey = u.y - v.y, dd = ex * ex + ey * ey, rr = (u.r + v.r) * 0.8;
        if (dd > 0.01 && dd < rr * rr) { const k = (rr - Math.sqrt(dd)) * 0.3 / Math.sqrt(dd); u.x += ex * k; u.y += ey * k; }
      }
    }
  }
  _shiftRow(u) {
    if (this.tick % 5 !== u.id % 5) return;
    const near = (row) => this.units.some((v) => v !== u && v.alive && v.team === u.team && v.row === row && (v.x - u.x) * u.dir > 0 && (v.x - u.x) * u.dir < v.r + u.r);
    if (!near(u.row)) return;
    for (const d of [1, -1, 2, -2]) { const r = u.row + d; if (r >= 0 && r < this.rows && !near(r)) { u.row = r; return; } }
  }

  // ---------- 공격 ----------
  _strike(u, def) {
    const atkMul = this.buffMul(u.team, "atk") * (u.enraged ? 1.3 : 1);
    let dmg = u.atk * atkMul * (u.crit ? 2 : 1);
    u.crit = false;
    let t = null, tb = null;
    if (typeof u.tgt === "number") t = this.unitMap.get(u.tgt);
    else if (typeof u.tgt === "string") tb = this.bases.find((b) => "b" + b.team === u.tgt);
    if (t && !t.alive) t = null;
    if (!t && !tb) { const f = this._findTarget(u, def); if (f) { if (f.kind === "u") t = f.o; else tb = f.o; } }
    if (def.special === "heal") { this._healPulse(u, def); if (!t && !tb) return; dmg = u.atk * atkMul; }
    if (!t && !tb) return;
    const tx = t ? t.x : tb.x, ty = t ? t.y : tb.y;
    if (def.proj) {
      const d = this.lane ? Math.abs(tx - u.x) : Math.hypot(tx - u.x, ty - u.y);
      const dur = Math.max(0.12, d / def.proj.speed);
      const p = { from: u.id, owner: u.owner, team: u.team, tid: t ? t.id : null, tb: tb ? tb.team : null, x0: u.x, y0: u.y, tx, ty, t: 0, dur, dmg, def: u.def, kind: def.proj.kind, aoe: def.aoe || 0 };
      this.projs.push(p);
      this.events.push({ k: "proj", id: u.id, kind: def.proj.kind, x: u.x, y: u.y, tx, ty, dur: +dur.toFixed(2), arc: def.proj.arc ? 1 : 0 });
      return;
    }
    this._impact(u, def, t, tb, tx, ty, dmg);
  }
  _impact(u, def, t, tb, x, y, dmg) {
    const ownerId = u ? u.owner : null;
    const team = u ? u.team : -1;
    if (def.chain && t) {
      const pts = [[t.x, t.y]];
      let cur = t, hit = new Set([t.id]), d = dmg;
      this._damage(u, t, d, false, def);
      for (let i = 1; i < def.chain; i++) {
        d *= 0.7;
        let nx = null, nd = 1e9;
        for (const v of this.units) { if (!v.alive || v.team === team || hit.has(v.id)) continue; const dd = this._dist(cur, v); if (dd < 130 && dd < nd) { nd = dd; nx = v; } }
        if (!nx) break;
        hit.add(nx.id); pts.push([nx.x, nx.y]); this._damage(u, nx, d, false, def); cur = nx;
      }
      this.events.push({ k: "chain", id: u ? u.id : 0, pts: pts.map((p) => [Math.round(p[0]), Math.round(p[1])]) });
      return;
    }
    if (def.aoe) {
      this.events.push({ k: "aoe", x: Math.round(x), y: Math.round(y), r: def.aoe, kind: def.fx || "boom" });
      for (const v of this.units) {
        if (!v.alive || v.team === team) continue;
        if (this._defOf(v.def).flying && def.ground) continue;
        const dd = this.lane ? Math.abs(v.x - x) : Math.hypot(v.x - x, v.y - y);
        if (dd <= def.aoe + v.r) this._damage(u, v, dmg, !!def.knockAll, def);
      }
      for (const b of this.bases) if (b.alive && b.team !== team && (this.lane ? Math.abs(b.x - x) : Math.hypot(b.x - x, b.y - y)) <= def.aoe + b.r) this._hitBase(b, dmg, u);
      return;
    }
    if (t && t.alive) this._damage(u, t, dmg, false, def);
    else if (tb && tb.alive) this._hitBase(tb, dmg, u);
  }
  _damage(src, v, dmg, forceKnock, def) {
    if (!v.alive) return;
    const vd = this._defOf(v.def);
    const armor = (vd.armor || 0);
    const defMul = this.buffMul(v.team, "def");
    let d = dmg * (1 - armor) / defMul;
    d = Math.max(1, Math.round(d));
    v.hp -= d; v.hitFlash = 0.12;
    if (src) { const o = src.owner; if (this.stats.dmg[o] != null) this.stats.dmg[o] += d; }
    this.events.push({ k: "hit", id: v.id, d, c: src && src.crit ? 1 : 0 });
    if (def && def.slow && v.alive) { v.slowT = def.slow.dur; v.slowMul = 1 - def.slow.pct; }
    if (def && def.stun && v.alive && this.rng() < def.stun.chance) v.stunT = def.stun.dur;
    if (v.hp <= 0) { this._kill(v, src); return; }
    // 넉백: 체력 구간을 넘을 때 (보스는 저항)
    if ((v.kbLeft > 1 && v.hp <= v.kbNext) || (forceKnock && !v.boss)) {
      if (vd.kbRes && this.rng() < vd.kbRes && !forceKnock) { v.kbNext -= v.maxHp / (vd.kb || 1); return; }
      if (!forceKnock) { v.kbLeft--; v.kbNext = v.maxHp * ((v.kbLeft - 1) / Math.max(1, vd.kb || 1)); }
      this._knock(v, src);
    }
  }
  _knock(v, src) {
    v.st = ST.knock; v.stT = 0;
    if (!this.lane) { const dx = v.x - (src ? src.x : v.x - 1), dy = v.y - (src ? src.y : v.y), d = Math.hypot(dx, dy) || 1; v.kx = dx / d; v.ky = dy / d; }
    this.events.push({ k: "knock", id: v.id });
  }
  _kill(v, src) {
    v.alive = false; v.hp = 0; v.st = ST.dead; v.stT = 0; v.deadT = this.time;
    const pl = this.players.get(v.owner); if (pl) pl.live = Math.max(0, pl.live - 1);
    this.events.push({ k: "death", id: v.id });
    if (src) {
      const kp = this.players.get(src.owner);
      if (kp) {
        this.stats.kills[kp.id] = (this.stats.kills[kp.id] || 0) + 1;
        const vd = this._defOf(v.def);
        const gain = vd.reward != null ? vd.reward : Math.round((vd.cost || 60) * 0.15);
        kp.energy = Math.min(kp.eMax, kp.energy + gain);
      } else if (this.hasAI && src.team === 0) {
        // 후원 아군 등 주인 없는 유닛이 잡아도 아군 전원 소량 보상
        const vd = this._defOf(v.def); const g = Math.round((vd.reward || 10) * 0.5);
        for (const p of this.players.values()) if (p.team === 0) p.energy = Math.min(p.eMax, p.energy + g);
      }
    }
  }
  _hitBase(b, dmg, src) {
    if (!b.alive) return;
    const d = Math.max(1, Math.round(dmg * (this.suddenDeath ? 1.5 : 1)));
    b.hp -= d; b.hitT = 0.15;
    if (src && this.stats.dmg[src.owner] != null) this.stats.dmg[src.owner] += d;
    this.events.push({ k: "baseHit", b: b.team, d });
    if (b.hp <= 0) {
      b.hp = 0; b.alive = false;
      this.events.push({ k: "baseDown", b: b.team });
      if (this.mode === "ffa") {
        for (const p of this.players.values()) if (p.team === b.team) { p.alive = false; p.outAt = this.time; }
        for (const u of this.units) if (u.alive && u.team === b.team) this._kill(u, null);
        for (const p of this.players.values()) if (p.alive && p.target === b.team) p.target = this._defaultTarget(p.team);
        for (const u of this.units) if (u.alive && u.goal === b.team) u.goal = this.players.get(u.owner)?.target ?? this._defaultTarget(u.team);
      }
    }
  }
  _healPulse(u, def) {
    let n = 0;
    for (const v of this.units) {
      if (!v.alive || v.team !== u.team || v.hp >= v.maxHp) continue;
      if (this._dist(u, v) <= def.healRange) { const h = Math.round(def.heal * levelMul(u.lv)); v.hp = Math.min(v.maxHp, v.hp + h); this.events.push({ k: "heal", id: v.id, h }); if (++n >= 6) break; }
    }
    this.events.push({ k: "pulse", id: u.id, r: def.healRange });
  }
  _stepProjs() {
    let w = 0;
    for (const p of this.projs) {
      p.t += DT;
      const t = p.tid ? this.unitMap.get(p.tid) : null;
      if (t && t.alive) { p.tx = t.x; p.ty = t.y; }
      if (p.t >= p.dur) {
        const src = this.unitMap.get(p.from) || { owner: p.owner, team: p.team, x: p.x0, y: p.y0, crit: false, id: p.from };
        const def = this._defOf(p.def);
        const tb = p.tb != null ? this.bases.find((b) => b.team === p.tb) : null;
        this._impact(src, def, t && t.alive ? t : null, tb, p.tx, p.ty, p.dmg);
        continue;
      }
      this.projs[w++] = p;
    }
    this.projs.length = w;
  }

  // ---------- 보스·특수 ----------
  _special(u, def) {
    const sp = def.spec;
    if (!sp) return;
    if (!u.enraged && def.enrageAt && u.hp <= u.maxHp * def.enrageAt) { u.enraged = true; this.events.push({ k: "enrage", id: u.id }); }
    if (sp.type === "summon") {
      const base = { x: u.x, y: u.y, side: u.dir === 1 ? "left" : "right", r: u.r * 0.5 };
      for (let i = 0; i < sp.count; i++) {
        if (this._aiLive() >= this.aiCap) break;
        const m = this._spawn(sp.unit, u.team, { owner: u.owner, base, enemyScale: this.enemyScale });
        m.x = u.x - (u.dir || 1) * (10 + i * 14);
      }
      this.events.push({ k: "bossSkill", id: u.id, s: "summon" });
    } else if (sp.type === "slam" || sp.type === "quake") {
      const x = u.x + (u.dir || 1) * (sp.offset || 60);
      this.events.push({ k: "aoe", x: Math.round(x), y: Math.round(u.y), r: sp.r, kind: sp.type });
      for (const v of this.units) if (v.alive && v.team !== u.team && Math.abs(v.x - x) <= sp.r + v.r) this._damage(u, v, u.atk * sp.mul, true);
      this.events.push({ k: "bossSkill", id: u.id, s: sp.type });
    } else if (sp.type === "laser") {
      const x0 = u.x, x1 = u.x + (u.dir || 1) * sp.len;
      this.events.push({ k: "laser", id: u.id, x0: Math.round(x0), x1: Math.round(x1), y: Math.round(u.y) });
      for (const v of this.units) if (v.alive && v.team !== u.team && (v.x - x0) * (u.dir || 1) >= 0 && Math.abs(v.x - x0) <= sp.len) this._damage(u, v, u.atk * sp.mul, false);
      this.events.push({ k: "bossSkill", id: u.id, s: "laser" });
    } else if (sp.type === "multi") {
      // 마왕: 순서대로 돌아가며 사용
      u._si = ((u._si || 0) + 1) % sp.list.length;
      this._special(u, { spec: sp.list[u._si], enrageAt: def.enrageAt });
    }
  }

  // ---------- 적 웨이브 (싱글·협동) ----------
  _aiLive() { let n = 0; for (const u of this.units) if (u.alive && u.owner === "ai") n++; return n; }
  _initWaves() {
    const np = Math.max(1, [...this.players.values()].filter((p) => p.team === 0).length);
    const coop = this.mode === "coop" ? 1 + 0.45 * (np - 1) : 1;
    this.enemyScale = { hp: this.diff.hp * coop, atk: this.diff.atk };
    this.spawnRate = this.diff.rate * (this.mode === "coop" ? 1 + 0.3 * (np - 1) : 1) * (this.cfg.aiScale || 1);
    const W = this.stage.waves || [];
    this.wave.timers = W.map((w) => ({ w, next: w.at, left: w.count == null ? Infinity : Math.ceil(w.count * (w.scaleCount === false ? 1 : this.spawnRate)) }));
    this.wave.boss = (this.stage.bosses || []).map((b) => ({ ...b, warned: false, done: false }));
  }
  _aiSpawn(id, extra) {
    if (this._aiLive() >= this.aiCap && !this.data.bosses[id]) return null;
    const b = this.baseOf(1); if (!b || !b.alive) return null;
    return this._spawn(id, 1, { owner: "ai", base: b, enemyScale: this.enemyScale, ...extra });
  }
  _stepWaves() {
    const t = this.time;
    // 시간이 지날수록 점점 강해짐 (전투가 끝없이 늘어지지 않게)
    const ramp = 1 + Math.max(0, t - 90) / 150;
    for (const T of this.wave.timers) {
      const w = T.w;
      if (T.left <= 0 || t < T.next) continue;
      if (w.until && t > w.until) { T.left = 0; continue; }
      const n = w.batch || 1;
      for (let i = 0; i < n; i++) this._aiSpawn(w.unit, ramp > 1.01 ? { hpMul: Math.min(2.2, ramp) } : undefined);
      T.left -= 1;
      T.next = t + (w.every || 5) / Math.min(2.5, this.spawnRate * (w.ramp === false ? 1 : Math.sqrt(ramp)));
    }
    for (const B of this.wave.boss) {
      if (B.done) continue;
      if (!B.warned && t >= B.at - 3) { B.warned = true; this.events.push({ k: "warn", def: B.id, in: 3 }); }
      if (t >= B.at) { B.done = true; this._aiSpawn(B.id); }
    }
    // 기지 체력 트리거 (긴급 방어)
    const eb = this.baseOf(1);
    for (const tr of this.stage.emergency || []) {
      const key = "em" + tr.pct;
      if (!this.wave.fired.has(key) && eb.hp <= eb.maxHp * tr.pct) {
        this.wave.fired.add(key);
        this.events.push({ k: "emergency", pct: tr.pct });
        for (const s of tr.spawn) for (let i = 0; i < s.n; i++) this._aiSpawn(s.unit);
        if (tr.boss) { this.events.push({ k: "warn", def: tr.boss, in: 0 }); this._aiSpawn(tr.boss); }
      }
    }
    // 전진 트리거: 아군이 전장 깊숙이 들어오면 추가 웨이브
    const adv = this.stage.advance;
    if (adv && !this.wave.fired.has("adv") && this.tick % 10 === 0) {
      for (const u of this.units) if (u.alive && u.team === 0 && u.x >= this.L * adv.at) {
        this.wave.fired.add("adv"); this.events.push({ k: "advance" });
        for (const s of adv.spawn) for (let i = 0; i < s.n; i++) this._aiSpawn(s.unit);
        break;
      }
    }
  }

  _checkEnd() {
    if (this.over) return;
    if (this.lane) {
      const b0 = this.baseOf(0), b1 = this.baseOf(1);
      if (!b0.alive || !b1.alive) {
        this.over = true;
        this.winner = b0.alive ? 0 : b1.alive ? 1 : -1;
      } else if (this.cfg.timeLimit && this.time >= this.cfg.timeLimit) {
        this.over = true; this.winner = 0; this.timeUp = true;
      } else if (this.mode === "team") {
        // 팀 전원이 나가면 상대 승리
        const alive = [0, 1].map((t) => [...this.players.values()].some((p) => p.team === t && !p.left));
        if (!alive[0] || !alive[1]) { this.over = true; this.winner = alive[0] ? 0 : alive[1] ? 1 : -1; }
      }
    } else {
      const alive = this.bases.filter((b) => b.alive);
      if (alive.length <= 1) { this.over = true; this.winner = alive[0] ? alive[0].team : -1; }
    }
    if (this.over) this.events.push({ k: "end", winner: this.winner, t: Math.round(this.time) });
  }
  removePlayer(pid) {
    const p = this.players.get(pid); if (!p) return;
    p.left = true;
    if (this.mode === "ffa" && p.alive) { const b = this.bases[p.team]; if (b && b.alive) this._hitBase(b, b.hp + 1, null); }
  }
}
