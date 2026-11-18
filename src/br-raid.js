// =========================
// 플듀 블록로얄 보스 레이드 — 서버 전용 (2026-11-18)
// · 방 하나에 보스 하나(상태 머신), 참가자마다 따로인 판(기존 BRGame) — 판·줄은 기존처럼 서버가 조작 기록을 다시 돌려 확정
// · 피해는 서버가 '그 조각의 줄 제거 사건'으로 한 번만 계산 (클라이언트가 보낸 피해량은 없음)
// · 보스 공격: 판에 닿는 것(방해 줄·패턴 줄·미션 실패)은 기존 방해 줄 통로(서버 검증), 화면 방해(가림·봉인 등)는 화면만
// · hooks: { emit(ev,d) 방 전체, emitTo(uid,ev,d), garbage(uid,n,h), revive(uid), finish(reason), actives(), player(uid) }
// =========================
import { BOSSES, DMG, RAID, RAID_AUGS, tierOf, hpFor } from "./br-raid-data.js";
const ST = { idle: 0, telegraph: 1, attack: 2, recovery: 3, stunned: 4, phase: 5, defeated: 6 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Raid {
  constructor({ bossId, n, startsAt, hooks, rng = Math.random, aug = false }) {
    this.id = BOSSES[bossId] ? bossId : "slime"; this.B = BOSSES[this.id]; this.hooks = hooks; this.rng = rng;
    this.n = Math.max(1, n); this.tier = tierOf(this.n);
    this.aug = !!aug; this.maxHp = Math.round(hpFor(this.B.hp, this.n) * (this.aug ? RAID.augHp : 1)); this.hp = this.maxHp; this.shield = 0; this.shieldMax = 0; this.shieldStun = 0;
    this.phase = 0; this.state = "idle"; this.until = 0; this.enraged = false; this.startsAt = startsAt;
    this.timeLimit = (this.B.time + this.tier.time) * 1000; this.deadline = startsAt + this.timeLimit;
    this.nextAt = startsAt + 5000; this.pend = null; this.lastPat = null; this.used = new Set();
    this.parts = []; this.partSeq = 0; this.team = null; this.bombs = new Map(); this.charge = 0;
    this.gauge = 0; this.downs = []; this.c = new Map(); // 기여: uid → { dmg, parts, shield, lines, rescue, missions, revives }
    this.cheer = new Map(); this.buffUntil = 0; this.jointLog = []; this.jointCd = 0; this.jointN = 0;
    this.delays = []; this.ev = 0; this.over = false; this.result = null; this.stunN = 0; this.lastTick = startsAt;
    this.timers = new Map(); // uid → { drone, dragon:[{until,next}], blade:{until,next} }
    this.protect = new Map(); this.lastHit = new Map(); this.miracleUsed = new Set(); this.featherUsed = new Set(); this.collapseN = new Map(); this.phaseDone = new Map();
  }
  // ---------------- 도우미 ----------------
  P(uid) { return this.hooks.player(uid); }
  has(uid, id) { return !!this.P(uid)?.game?.aug?.list?.includes(id); }
  holders(id) { return this.hooks.actives().filter(([u]) => this.has(u, id)).map(([u]) => u); }
  con(uid) { let c = this.c.get(uid); if (!c) { c = { dmg: 0, parts: 0, shield: 0, lines: 0, rescue: 0, missions: 0, revives: 0, procs: 0 }; this.c.set(uid, c); const p = this.P(uid); if (p) p.raidC = c; } return c; }
  say(k, d = {}) { this.hooks.emit("br:raid", { k, e: ++this.ev, ...d }); }
  bodyGuard() { // 촉수·분신이 살아 있으면 본체 피해가 줄어듦
    if (this.B.bodyGuard && this.parts.some((x) => x.kind === "tentacle")) return this.B.bodyGuard;
    if (this.B.cloneGuard && this.parts.some((x) => x.kind === "clone")) return this.B.cloneGuard;
    return 1;
  }
  teamMul(now) { let m = 1; for (const [, v] of this.cheer) if (v.until > now) m += v.v; if (this.buffUntil > now) m += 0.1; return m; }
  stateCode() { return ST[this.state] ?? 0; }

  // ---------------- 피해 ----------------
  /** 조각 하나 고정 후 서버가 확정한 사건들 → 피해 (조각 번호로 중복 막음은 호출하는 쪽) */
  onLock(uid, p, events, now) {
    if (this.over) return 0;
    let total = 0; const g = p.game, c = this.con(uid);
    for (const e of events) {
      if (e.t !== "clear") continue;
      c.lines += e.n;
      this.addGauge(uid, e.n, now);
      this.teamProgress(uid, e, now);
      this.bombProgress(uid, p, e, now);
      this.chargeDrain(e.n);
      total += this.clearDamage(uid, p, e, now);
      this.joint(uid, e, now);
    }
    if (!events.some((e) => e.t === "clear")) this.bombProgress(uid, p, null, now);
    void g; return total;
  }
  clearDamage(uid, p, e, now) {
    const has = (id) => this.has(uid, id), n = e.n;
    let base = e.ts === 2 ? DMG.tspin[n] || 0 : e.ts === 1 ? DMG.mini[Math.min(n, 2)] || 0 : e.spin ? DMG.spin[n] || 0 : DMG.line[n] || 0;
    if (e.perfect) base += DMG.perfect;
    const step = DMG.comboStep * (has("r_combo") ? 2 : 1), cmax = DMG.comboMax * (has("r_combo") ? 2 : 1);
    let d = base * (1 + Math.min(cmax, step * Math.max(0, e.combo))) * (e.b2b ? DMG.b2b : 1);
    let pct = 0, flat = 0;
    if (has("r_strike")) pct += 0.15;
    if (has("r_goldTetris") && n === 4) pct += 0.6;
    if (has("r_lucky") && (e.ts || e.perfect)) pct += 0.4;
    const st = this.stat(uid);
    if (has("r_focus") && now - (st.lastClear || 0) <= RAID_AUGS.r_focus.win) pct += 0.2;
    st.lastClear = now;
    if (has("r_fury") && p.game.height() >= RAID_AUGS.r_fury.h) pct += 0.5;
    if (has("r_goldRush")) pct += 0.25;
    if (has("r_raidGod")) pct += 0.15;
    if (has("r_reversal") && this.losing(now)) pct += 0.6;
    if (has("r_swordRain")) flat += 6;
    if (has("r_legion")) flat += 2 * (p.game.aug?.list?.length || 0);
    if (has("r_chainBolt") && n >= 2) flat += 20;
    if (has("r_storm") && e.combo >= 3) flat += 30;
    d = (d + flat) * (1 + pct) * this.teamMul(now);
    // 발동형 (발동형끼리는 서로 다시 발동하지 않음)
    const procs = [];
    st.clears = (st.clears || 0) + 1; st.linesAll = (st.linesAll || 0) + n;
    if (has("r_flameBurst") && st.clears % RAID_AUGS.r_flameBurst.every === 0) procs.push(["r_flameBurst", 120]);
    if (has("r_meteor")) { const k = Math.floor(st.linesAll / 20); if (k > (st.meteors || 0)) { st.meteors = k; procs.push(["r_meteor", 500]); } }
    if (has("r_laser") && n === 4 && e.p === 1) procs.push(["r_laser", 200]);
    if (has("r_collapse") && (e.perfect || (e.ts === 2 && n === 3)) && (this.collapseN.get(uid) || 0) < 3) { this.collapseN.set(uid, (this.collapseN.get(uid) || 0) + 1); procs.push(["r_collapse", Math.round(this.maxHp * 0.05), true]); }
    if (has("r_bladeDance") && n === 4) { const t = this.timer(uid); t.blade = { until: now + 10000, next: now + 1000 }; }
    if (has("r_iceArrow") && (n === 4 || e.ts === 2)) this.delay(2000, now, "r_iceArrow");
    if (has("r_cheer")) { const v = this.cheer.get(uid) || { v: 0, until: 0 }; v.v = Math.min(RAID_AUGS.r_cheer.max, (v.until > now ? v.v : 0) + RAID_AUGS.r_cheer.v); v.until = now + RAID_AUGS.r_cheer.dur; this.cheer.set(uid, v); }
    const dealt = this.hit(uid, Math.floor(d), { n, ts: e.ts, perfect: e.perfect, chain: has("r_chainBolt") && n >= 2 }, now);
    let extra = 0; for (const [id, v, body] of procs) { extra += this.hit(uid, v, { proc: id, body: !!body }, now); this.con(uid).procs++; }
    if (has("r_vamp")) { st.vamp = (st.vamp || 0) + dealt + extra; while (st.vamp >= 300) { st.vamp -= 300; st.buf = Math.min(RAID_AUGS.r_vamp.max, (st.buf || 0) + 1); } }
    if (has("r_recover") && n === 4) st.buf = Math.min(RAID_AUGS.r_recover.max, (st.buf || 0) + RAID_AUGS.r_recover.v);
    if (dealt + extra > 0) this.hooks.emitTo(uid, "br:dmg", { d: dealt, x: extra, procs: procs.map((x) => x[0]), n });
    return dealt + extra;
  }
  stat(uid) { const p = this.P(uid); if (!p.raidSt) p.raidSt = {}; return p.raidSt; }
  timer(uid) { let t = this.timers.get(uid); if (!t) { t = { drone: 0, dragon: [], blade: null }; this.timers.set(uid, t); } return t; }
  losing(now) { const al = this.hooks.actives().length, tot = al + this.downs.length; return al * 2 <= tot || this.deadline - now <= this.timeLimit * 0.3; }
  /** 피해를 보스(방어막·부위·본체)에 적용. 반환: 실제 들어간 양 */
  hit(uid, raw, info, now) {
    if (this.over || raw <= 0) return 0;
    if (this.state === "phase" && now < this.until) return 0; // 페이즈 전환 무적
    let d = raw * (this.state === "stunned" ? RAID.stunMul : 1);
    const brk = this.has(uid, "r_breaker") ? 2 : 1, c = this.con(uid);
    // 방어막
    if (this.shield > 0) {
      let sd = d * brk * (info.n === 1 ? DMG.onePartShield : 1) * (this.id === "machine" && (info.n === 4 || info.ts) ? 2 : 1);
      sd = Math.min(this.shield, Math.floor(sd)); this.shield -= sd; c.shield += sd; c.dmg += sd;
      if (this.shield <= 0) { this.shield = 0; this.say("shieldBreak", { by: this.idx(uid) }); if (this.shieldStun) this.stun(this.shieldStun, now, "shield"); this.shieldStun = 0; }
      return sd;
    }
    // 부위: 고른 대상 → 없으면 자동(체력 가장 낮은 부위)
    const p = this.P(uid), want = p?.raidTarget;
    let part = want && want !== "auto" && want !== "body" ? this.parts.find((x) => x.id === want) : null;
    if (!part && !info.body && want !== "body" && this.parts.length && (this.bodyGuard() < 1 || want === "auto" || !want)) part = this.parts.slice().sort((a, b) => a.hp - b.hp)[0];
    if (part) {
      const pd = Math.min(part.hp, Math.floor(d * brk * (this.has(uid, "r_weak") ? 1.3 : 1) + (info.chain ? 10 : 0)));
      part.hp -= pd; c.parts += pd; c.dmg += pd;
      if (part.hp <= 0) this.partDie(part, uid, now);
      return pd;
    }
    const bd = Math.min(this.hp, Math.floor(d * this.bodyGuard()));
    this.hp -= bd; c.dmg += bd;
    this.afterBodyHit(now);
    return bd;
  }
  afterBodyHit(now) {
    if (this.hp <= 0) return this.defeat(now);
    while (this.phase < RAID.phaseAt.length && this.hp <= this.maxHp * RAID.phaseAt[this.phase]) this.nextPhase(now);
  }
  partDie(part, uid, now) {
    this.parts = this.parts.filter((x) => x !== part);
    this.say("partDie", { id: part.id, kind: part.kind, by: this.idx(uid) });
    if (part.kind === "slime") { const b = Math.round(this.maxHp * 0.03); const bd = Math.min(this.hp, b); this.hp -= bd; this.con(uid).dmg += bd; this.afterBodyHit(now); }
    if (part.kind === "drone") { this.buffUntil = now + 20000; this.say("buff", { k: "drone", until: this.buffUntil }); }
    if ((part.kind === "tentacle" || part.kind === "clone") && this.bodyGuard() === 1) this.say("exposed", {});
  }
  idx(uid) { return this.P(uid)?.idx ?? -1; }

  // ---------------- 페이즈·기절·지연 ----------------
  nextPhase(now) {
    this.phase++;
    this.state = "phase"; this.until = now + RAID.phaseInvuln; this.pend = null;
    this.say("phase", { phase: this.phase, until: this.until });
    // 페이즈 시작 고정 행동 (w:0 소환 등)
    for (const pat of this.B.phases[this.phase] || []) if (pat.w === 0 && !this.used.has(pat.id)) { this.used.add(pat.id); this.apply(pat, this.pickTargets(pat, now), now); }
    // 증강: 천상의 심판·드래곤·보호막/절대 방어 충전·시간 왜곡
    for (const [u] of this.hooks.actives()) {
      if (this.has(u, "r_judgment")) { const k = u + ":" + this.phase; if (!this.phaseDone.has(k)) { this.phaseDone.set(k, 1); this.hit(u, Math.round(this.maxHp * RAID_AUGS.r_judgment.v), { proc: "r_judgment", body: true }, now + RAID.phaseInvuln + 1); this.say("proc", { id: "r_judgment", by: this.idx(u) }); } }
      if (this.has(u, "r_dragon")) this.timer(u).dragon.push({ until: now + 15000, next: now + 2000 });
      const st = this.stat(u); st.shieldUsed = false; st.absUsed = false;
      if (this.has(u, "r_timeWarp")) this.delay(RAID_AUGS.r_timeWarp.v, now, "r_timeWarp");
    }
  }
  stun(ms, now, why) { this.state = "stunned"; this.until = now + ms; this.pend = null; this.stunN++; this.say("stun", { until: this.until, why }); }
  /** 보스 행동 늦추기 (증강·미션) — 30초 동안 합쳐 최대 8초 (무한 지연 방지) */
  delay(ms, now, why) {
    this.delays = this.delays.filter((x) => now - x.at < RAID.delayWindow);
    const used = this.delays.reduce((a, x) => a + x.ms, 0), can = Math.max(0, Math.min(ms, RAID.delayCap - used));
    if (!can) return 0;
    this.delays.push({ at: now, ms: can }); this.nextAt += can; if (this.pend) this.pend.at += can;
    this.say("delay", { ms: can, why }); return can;
  }

  // ---------------- 보스 차례 (상태 머신) ----------------
  tick(now) {
    if (this.over) return;
    const dt = Math.max(0, now - this.lastTick); this.lastTick = now;
    if (now < this.startsAt) return;
    if (now >= this.deadline) return this.end(false, "TIME_UP");
    if (!this.began) { this.began = true; for (const pat of this.B.phases[0] || []) if (pat.w === 0 && !this.used.has(pat.id)) { this.used.add(pat.id); this.apply(pat, this.pickTargets(pat, now), now); } } // 1페이즈 시작 고정 행동 (크라켄 촉수 등)
    if (!this.enraged && this.deadline - now <= this.timeLimit * RAID.enrageAt) { this.enraged = true; this.say("enrage", {}); for (const [u] of this.hooks.actives()) if (this.has(u, "r_timeWarp")) this.delay(RAID_AUGS.r_timeWarp.v, now, "r_timeWarp"); }
    this.autoAttacks(now);
    this.partTick(now);
    this.missionTick(now);
    if (this.B.charge) this.chargeTick(dt, now);
    if (this.over) return;
    switch (this.state) {
      case "phase": case "stunned": case "recovery": if (now >= this.until) { this.state = "idle"; this.nextAt = Math.max(this.nextAt, now + 1500); } break;
      case "idle": if (now >= this.nextAt) this.telegraph(now); break;
      case "telegraph": if (this.pend && now >= this.pend.at) { const pd = this.pend; this.pend = null; this.state = "attack"; this.apply(pd.pat, pd.targets.filter((u) => this.P(u)?.status === "active"), now, pd); this.state = "recovery"; this.until = now + 700; this.nextAt = now + this.interval(); } break;
    }
  }
  interval() { const j = 0.85 + this.rng() * 0.3; return Math.round(this.B.every / this.tier.spd * (this.enraged ? RAID.enrageSpd : 1) * j); }
  choose(now) {
    let list = (this.B.phases[this.phase] || []).filter((p) => p.w > 0 && !(p.once && this.used.has(p.id)));
    list = list.filter((p) => {
      if (p.k === "shield" && this.shield > 0) return false;
      if (p.k === "team" && this.team) return false;
      if (p.k === "summon" && this.parts.filter((x) => x.kind === p.part).length + p.count > (p.max || p.count)) return false;
      return p.id !== this.lastPat || (this.B.phases[this.phase] || []).length === 1;
    });
    if (!list.length) return null;
    let tot = list.reduce((a, p) => a + p.w, 0), x = this.rng() * tot;
    let pat = list[list.length - 1]; for (const p of list) { x -= p.w; if (x <= 0) { pat = p; break; } }
    if (pat.k === "borrow") { // 공허의 지배자: 다른 보스의 기술을 빌려 씀 (소환·방어막·빌리기 제외)
      const from = this.B.borrow[Math.floor(this.rng() * this.B.borrow.length)], B2 = BOSSES[from];
      const pool = (B2.phases[Math.min(this.phase, B2.phases.length - 1)] || []).filter((p) => p.w > 0 && ["garb", "debuff", "column", "bomb"].includes(p.k));
      if (!pool.length) return null;
      pat = { ...pool[Math.floor(this.rng() * pool.length)], from, id: pat.id + ":" + from };
    }
    void now; return pat;
  }
  telegraph(now) {
    const pat = this.choose(now); if (!pat) { this.nextAt = now + 3000; return; }
    this.lastPat = pat.id; if (pat.once) this.used.add(pat.id);
    const targets = this.pickTargets(pat, now);
    const pend = { pat, targets, at: now + (pat.warn || 2000) };
    if (pat.k === "column") { const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; for (let i = 9; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } pend.cols = all.slice(0, Math.min(10, pat.cols)); } // 섞어서 앞에서부터 (반복 뽑기는 같은 수만 나오면 안 끝남)
    if (pat.k === "garb" && pat.hole === "same") pend.hole = Math.floor(this.rng() * 10);
    if (pat.k === "team" && pat.goal === "shape") pend.shape = 1 + Math.floor(this.rng() * 7);
    this.pend = pend; this.state = "telegraph";
    this.say("tele", { id: pat.id, from: pat.from || null, kind: pat.k, fx: pat.fx || null, n: pat.n || 0, at: pend.at, tg: targets.map((u) => this.idx(u)), all: pat.tgt === "all", cols: pend.cols || null, big: !!pat.big, goal: pat.goal || null, shape: pend.shape || null });
  }
  /** 공격 대상: 오래 안 맞은 사람부터, 판이 꽉 찬 사람·보호 중인 사람은 빼고(모두 그렇지 않다면) */
  pickTargets(pat, now) {
    const act = this.hooks.actives().filter(([u, p]) => p.connected !== false && !((this.protect.get(u) || 0) > now));
    if (pat.k === "team" || pat.k === "shield" || pat.k === "summon" || pat.k === "steal") return act.map(([u]) => u);
    if (pat.tgt === "all") return act.map(([u]) => u);
    const danger = ([, p]) => (p.game?.height?.() || 0) + (p.game?.pendingGarbage?.() || 0) >= RAID.dangerHeight;
    let pool = act.filter((x) => !danger(x)); if (!pool.length) pool = act;
    const fresh = pool.filter(([u]) => now - (this.lastHit.get(u) || 0) >= RAID.minGapPerPlayer); if (fresh.length) pool = fresh;
    const k = Math.max(1, Math.min(pool.length, Math.round(act.length * this.tier.tgt * (typeof pat.tgt === "number" ? pat.tgt : 1))));
    return pool.map(([u]) => [u, (this.lastHit.get(u) || 0) + this.rng() * 1500]).sort((a, b) => a[1] - b[1]).slice(0, k).map((x) => x[0]);
  }
  apply(pat, targets, now, pend = {}) {
    this.say("atk", { id: pat.id, kind: pat.k, tg: targets.map((u) => this.idx(u)) });
    switch (pat.k) {
      case "garb": for (const u of targets) this.sendGarbage(u, pat.n, pat, pend, now); break;
      case "debuff": for (const u of targets) { this.lastHit.set(u, now); const dur = Math.round(pat.dur * (this.has(u, "r_steady") ? 0.5 : 1)); this.hooks.emitTo(u, "br:raidFx", { fx: pat.fx, dur, until: now + dur }); } break;
      case "column": for (const u of targets) {
        const g = this.P(u)?.game; if (!g) continue; let h = 0;
        for (const c of pend.cols || []) for (let y = 0; y < 24; y++) if (g.at(c, y)) { h = Math.max(h, 24 - y); break; }
        if (h >= pat.thr) this.sendGarbage(u, pat.n, pat, { hole: (pend.cols || [0])[0] }, now); else this.hooks.emitTo(u, "br:raidFx", { fx: "dodge", dur: 1200 });
      } break;
      case "bomb": for (const u of targets) { const p = this.P(u); if (!p?.game) continue; this.lastHit.set(u, now); this.bombs.set(u, { end: p.game.pieces + pat.pieces, need: pat.need, got: 0, fail: pat.fail, rew: pat.rew, id: pat.id }); this.hooks.emitTo(u, "br:raidFx", { fx: "bomb", left: pat.pieces, need: pat.need }); } break;
      case "team": {
        const N = this.n, mul = pat.goal === "lines" ? (N === 1 ? 0.7 : Math.pow(N, 0.95)) : pat.goal === "tech" ? (N === 1 ? 1 : Math.pow(N, 0.55)) : (N === 1 ? 0.67 : Math.pow(N, 0.75)); // 인원이 늘수록 목표도 늘지만 덜 가파르게
        const need = Math.max(1, Math.round(pat.n * mul));
        this.team = { id: pat.id, goal: pat.goal, need, got: 0, until: now + pat.sec * 1000, ok: pat.ok, okSec: pat.okSec || 0, okPct: pat.okPct || 0, fail: pat.fail, shape: pend.shape || (pat.goal === "shape" ? 1 + Math.floor(this.rng() * 7) : null), by: new Map() };
        this.say("team", { goal: pat.goal, need, until: this.team.until, shape: this.team.shape, ok: pat.ok });
      } break;
      case "shield": this.shieldMax = this.shield = Math.round(this.maxHp * pat.pct); this.shieldStun = pat.stunOnBreak || 0; this.say("shield", { v: this.shield }); break;
      case "summon": for (let i = 0; i < pat.count; i++) { const hp = Math.round(this.maxHp * pat.hp); this.parts.push({ id: pat.part + (++this.partSeq), kind: pat.part, hp, max: hp, next: now + 12000 }); } this.say("summon", { part: pat.part, count: pat.count }); break;
      case "steal": this.gauge = Math.max(0, this.gauge - 30); this.buffUntil = 0; this.cheer.clear(); this.say("steal", {}); break;
    }
  }
  /** 보스 방해 줄 보내기 — 막는 순서: 시간 역행 → 절대 방어(강한 공격) → 보호막(페이즈 1번) → 철벽·레이드의 신(−1줄씩) → 저장된 상쇄 */
  sendGarbage(uid, n, pat, pend, now) {
    const p = this.P(uid); if (!p || p.status !== "active") return;
    this.lastHit.set(uid, now);
    if ((this.protect.get(uid) || 0) > now) return this.hooks.emitTo(uid, "br:raidFx", { fx: "blocked", why: "protect" });
    const st = this.stat(uid);
    if (this.has(uid, "r_rewind") && (st.rewind || 0) < RAID_AUGS.r_rewind.v) { st.rewind = (st.rewind || 0) + 1; return this.hooks.emitTo(uid, "br:raidFx", { fx: "blocked", why: "r_rewind" }); }
    if (pat.big && this.has(uid, "r_absolute") && !st.absUsed) { st.absUsed = true; return this.hooks.emitTo(uid, "br:raidFx", { fx: "blocked", why: "r_absolute" }); }
    if (this.has(uid, "r_shield") && !st.shieldUsed) { st.shieldUsed = true; return this.hooks.emitTo(uid, "br:raidFx", { fx: "blocked", why: "r_shield" }); }
    let k = n - (this.has(uid, "r_wall") ? 1 : 0) - (this.has(uid, "r_raidGod") ? 1 : 0);
    if (st.buf > 0 && k > 0) { const t = Math.min(st.buf, k); st.buf -= t; k -= t; }
    if (k <= 0) return this.hooks.emitTo(uid, "br:raidFx", { fx: "blocked", why: "wall" });
    if (pat.hole === "yut") { const holes = [1, 8, 4, 5]; for (let i = 0; i < k; i++) this.hooks.garbage(uid, 1, holes[i % holes.length]); return; }
    const h = pat.hole === "same" ? pend.hole ?? 0 : pat.hole === "col" ? Math.floor(this.rng() * 10) : pat.hole === "center" ? 4 + Math.floor(this.rng() * 2) : pend.hole != null && pat.k === "column" ? pend.hole : null;
    this.hooks.garbage(uid, k, h);
  }

  // ---------------- 미션 ----------------
  bombProgress(uid, p, e, now = Date.now()) {
    const b = this.bombs.get(uid); if (!b) return;
    if (e) b.got += e.n;
    if (b.got >= b.need) { this.bombs.delete(uid); const v = Math.round(this.maxHp * b.rew); this.hit(uid, v, { proc: "bomb", body: true }, now); this.con(uid).missions++; this.hooks.emitTo(uid, "br:raidFx", { fx: "bombOk", dmg: v }); this.say("bombOk", { by: this.idx(uid) }); return; }
    if (p.game.pieces >= b.end) { this.bombs.delete(uid); this.hooks.emitTo(uid, "br:raidFx", { fx: "bombFail" }); this.hooks.garbage(uid, b.fail, null); return; }
    this.hooks.emitTo(uid, "br:raidFx", { fx: "bomb", left: b.end - p.game.pieces, need: b.need - b.got });
  }
  teamProgress(uid, e, now) {
    const t = this.team; if (!t || now > t.until) return;
    let v = 0;
    if (t.goal === "lines") v = e.n;
    else if (t.goal === "tech") v = e.n === 4 || e.ts === 2 || e.perfect ? 1 : 0;
    else if (t.goal === "shape") v = e.p === t.shape ? 1 : 0;
    if (!v) return;
    t.got += v; t.by.set(uid, (t.by.get(uid) || 0) + v);
    if (t.got >= t.need) this.teamDone(true, now);
  }
  teamDone(ok, now) {
    const t = this.team; this.team = null; if (!t) return;
    if (ok) {
      for (const u of t.by.keys()) this.con(u).missions++;
      if (t.ok === "stun") this.stun(t.okSec, now, "mission");
      else if (t.ok === "delay") this.delay(t.okSec, now, "mission");
      else if (t.ok === "golden") { // 황금 공격: 참여한 사람 몫으로 나눠 기록
        const tot = Math.round(this.maxHp * t.okPct), us = [...t.by.keys()];
        this.stun(t.okSec, now, "golden");
        for (const u of us) this.hit(u, Math.round(tot / us.length), { proc: "golden", body: true }, now);
      }
      this.say("teamOk", { ok: t.ok, goal: t.goal });
    } else {
      this.say("teamFail", { goal: t.goal });
      for (const [u] of this.hooks.actives()) this.sendGarbage(u, t.fail, { k: "garb" }, {}, now);
    }
  }
  missionTick(now) { if (this.team && now > this.team.until) this.teamDone(false, now); }
  chargeDrain(lines) { if (!this.B.charge) return; this.charge = Math.max(0, this.charge - this.B.charge.perLine * lines / Math.max(1, Math.pow(this.n, 0.8))); }
  chargeTick(dt, now) {
    if (this.state === "stunned" || this.state === "phase") return;
    this.charge = Math.min(100, this.charge + this.B.charge.perSec * dt / 1000);
    if (this.charge >= 100) { this.charge = 0; const pat = { k: "garb", n: this.B.charge.n, hole: "col", big: true, id: "overcharge", tgt: "all" }; this.say("tele", { id: "overcharge", kind: "garb", at: now, all: true, big: true, n: pat.n, tg: [] }); this.apply(pat, this.pickTargets(pat, now), now); }
  }

  // ---------------- 자동 공격 (증강·부위) ----------------
  autoAttacks(now) {
    for (const [u] of this.hooks.actives()) {
      const t = this.timer(u);
      if (this.has(u, "r_drone")) { if (!t.drone) t.drone = now + 8000; if (now >= t.drone) { t.drone = now + 8000; this.proc(u, "r_drone", 25, now); } }
      if (t.blade && now >= t.blade.next) { if (now > t.blade.until) t.blade = null; else { t.blade.next += 1000; this.proc(u, "r_bladeDance", 20, now); } }
      t.dragon = t.dragon.filter((d) => d.until > now);
      for (const d of t.dragon) if (now >= d.next) { d.next += 2000; this.proc(u, "r_dragon", 60, now); }
      if (this.over) return;
    }
  }
  proc(uid, id, v, now) { const d = this.hit(uid, v, { proc: id }, now); if (d > 0) { this.con(uid).procs++; this.hooks.emitTo(uid, "br:dmg", { d: 0, x: d, procs: [id] }); } }
  partTick(now) {
    for (const part of this.parts) if (part.kind === "drone" && now >= part.next) {
      part.next = now + 12000; const tg = this.pickTargets({ k: "garb", tgt: 0.2 }, now).slice(0, 1);
      for (const u of tg) this.sendGarbage(u, 1, { k: "garb" }, {}, now);
    }
  }

  // ---------------- 합동 공격 ----------------
  joint(uid, e, now) {
    const J = RAID.joint; this.jointLog = this.jointLog.filter((x) => now - x.at <= J.window); this.jointLog.push({ uid, at: now });
    if (now < this.jointCd) return;
    const who = new Set(this.jointLog.map((x) => x.uid)), N = this.hooks.actives().length + this.downs.length;
    let lv = -1;
    if (this.n === 1) { if (e.combo >= 4) lv = 0; } // 혼자: 콤보 4로 대신
    else for (let i = 0; i < J.need.length; i++) { const need = i === 0 ? Math.min(J.need[0], Math.max(2, N)) : J.need[i]; if (need <= N && who.size >= need) lv = i; }
    if (lv < 0) return;
    this.jointCd = now + J.cd; this.jointLog = []; this.jointN++;
    const uni = Math.min(RAID_AUGS.r_unison.max, this.holders("r_unison").length * RAID_AUGS.r_unison.v);
    const tot = Math.round(this.maxHp * J.pct[lv] * (1 + uni)), us = [...who];
    this.say("joint", { lv, n: us.length, dmg: tot });
    for (const u of us) this.hit(u, Math.round(tot / us.length), { proc: "joint", body: true }, now);
  }

  // ---------------- 쓰러짐·구조 ----------------
  addGauge(uid, lines, now = Date.now()) {
    this.downs = this.downs.filter((x) => this.P(x)?.status === "down"); // 나간 사람은 빼기
    if (!this.downs.length) return;
    const g = RAID.reviveGain * lines * (this.has(uid, "r_rescue") ? 2 : 1) * (this.has(uid, "r_raidGod") ? 1.5 : 1);
    this.gauge = Math.min(RAID.reviveFull * 2, this.gauge + g); this.con(uid).rescue += g;
    while (this.gauge >= RAID.reviveFull && this.downs.length) {
      const u = this.downs.find((x) => (this.con(x).revives || 0) < RAID.maxRevive);
      if (!u) break;
      this.gauge -= RAID.reviveFull; this.revive(u, "gauge", now);
    }
  }
  /** 판이 꽉 차 쓰러짐. true = 레이드가 처리함(아직 탈락 아님) */
  onDown(uid, now) {
    if (this.over) return false;
    const p = this.P(uid); if (!p) return false;
    if (this.has(uid, "r_feather") && !this.featherUsed.has(uid)) { this.featherUsed.add(uid); this.say("down", { i: this.idx(uid) }); this.revive(uid, "r_feather", now, true); return true; }
    if ((this.con(uid).revives || 0) >= RAID.maxRevive) return false; // 부활 다 썼으면 진짜 탈락
    p.status = "down"; p.dirtyRow = true; this.downs.push(uid); this.bombs.delete(uid);
    this.say("down", { i: this.idx(uid), gauge: this.gauge });
    const act = this.hooks.actives();
    if (act.length === 1) { const [lu] = act[0]; if (this.has(lu, "r_miracle") && !this.miracleUsed.has(lu)) { this.miracleUsed.add(lu); this.say("proc", { id: "r_miracle", by: this.idx(lu) }); for (const d of this.downs.slice()) this.revive(d, "r_miracle", now); } }
    if (!this.hooks.actives().length) this.end(false, "WIPE");
    return true;
  }
  revive(uid, why, now, self = false) {
    const p = this.P(uid); if (!p || (p.status !== "down" && !self)) { this.downs = this.downs.filter((x) => x !== uid); return; }
    this.downs = this.downs.filter((x) => x !== uid);
    if (!self || why !== "r_feather") this.con(uid).revives = (this.con(uid).revives || 0) + 1;
    this.protect.set(uid, now + RAID.protectMs);
    this.hooks.revive(uid);
    this.say("revive", { i: this.idx(uid), why, gauge: this.gauge });
  }
  /** 진짜 탈락(끊김·포기·부활 소진) 뒤 전멸 확인 */
  checkWipe() { if (!this.over && !this.hooks.actives().length) { if (this.downs.length) this.end(false, "WIPE"); else this.end(false, "WIPE"); } }

  // ---------------- 끝 ----------------
  defeat(now) { this.hp = 0; this.state = "defeated"; this.say("defeated", { at: now }); this.end(true, "BOSS_DOWN"); }
  end(win, reason) { if (this.over) return; this.over = true; this.result = { win, reason, boss: this.id }; this.hooks.finish(reason); }
  // ---------------- 보내는 상태 ----------------
  row(now) {
    return [this.hp, this.maxHp, this.shield, this.shieldMax, this.phase, this.stateCode(), this.until, Math.round(this.gauge), Math.round(this.charge), this.enraged ? 1 : 0,
      this.parts.map((x) => [x.id, x.kind, x.hp, x.max]), this.team ? [this.team.goal, this.team.got, this.team.need, this.team.until, this.team.shape] : null, this.downs.length, this.buffUntil > now ? this.buffUntil : 0];
  }
  snapshot(uid, now) {
    return { boss: this.id, n: this.n, tier: this.tier.key, deadline: this.deadline, row: this.row(now), pend: this.pend ? { id: this.pend.pat.id, kind: this.pend.pat.k, fx: this.pend.pat.fx || null, at: this.pend.at, tg: this.pend.targets.map((u) => this.idx(u)), cols: this.pend.cols || null, big: !!this.pend.pat.big, all: this.pend.pat.tgt === "all" } : null,
      bomb: uid && this.bombs.get(uid) ? { left: this.bombs.get(uid).end - (this.P(uid)?.game?.pieces || 0), need: this.bombs.get(uid).need - this.bombs.get(uid).got } : null, down: uid ? this.downs.includes(uid) : false, protect: uid ? this.protect.get(uid) || 0 : 0, target: uid ? this.P(uid)?.raidTarget || "auto" : "auto" };
  }
  summary() {
    const list = [...this.c.entries()].map(([u, c]) => ({ i: this.idx(u), ...c })).sort((a, b) => b.dmg - a.dmg);
    return { ...this.result, boss: this.id, maxHp: this.maxHp, hp: this.hp, phase: this.phase, n: this.n, tier: this.tier.key, joints: this.jointN, stuns: this.stunN, list };
  }
  setTarget(uid, t) { const p = this.P(uid); if (!p) return false; if (t === "auto" || t === "body" || this.parts.some((x) => x.id === t)) { p.raidTarget = t; return true; } return false; }
}
