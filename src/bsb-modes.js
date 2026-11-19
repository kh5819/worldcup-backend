// =========================
// DUO 플듀 베이스볼 — 모드 규칙 (서버 전용, 2026-11-19)
// · Derby(홈런더비 1~50) · Match(투수VS타자 2 / 미니 야구 2~8, 자동 수비·주자·이닝) · Raid(보스 레이드 1~8)
// · 소켓을 모름: out(대상, 이벤트, 데이터)로만 내보냄 (대상 "all" 또는 플레이어 id) → 시험에서 가짜 시계로 그대로 돌릴 수 있음
// · 모든 판정(스트라이크·타격·타구·수비·점수·피해)은 여기서. 화면이 보낸 건 스윙 시각·배트 위치·투구 선택뿐
// =========================
import {
  makePitch, judgeSwing, launch, playBall, flight, bossPitch, rng, mixSeed, isStrike, PITCH_TYPES, PT, WINDUP, SWING_LAG, WIN, MAX_LAG, FUTURE_TOL,
  DERBY, BOSSES, PATS, HIT_KINDS, OUT_KINDS, PICK_MS, MAX_AUGS, AUG,
} from "./bsb-core.js";
import { newAugHolder, rollOffer, addAug, batMods, pitchMods, fieldMods, afterContact, luckyHit, isMeteor, useAug, passPitch, augView, bufView, st, has, synergy, CAP } from "./bsb-augs.js";

const CAP_WIN = 2.2;
export const AI_SKILL = { easy: { tsd: 62, psd: 0.42, chase: 0.35, fooled: 0.6, swing: 0.8 }, normal: { tsd: 40, psd: 0.27, chase: 0.25, fooled: 0.4, swing: 0.86 }, hard: { tsd: 25, psd: 0.17, chase: 0.15, fooled: 0.22, swing: 0.9 } };
const g3 = (r) => (r() + r() + r() - 1.5) * 2;
/** 스윙 시각 검증: 서버가 잰 경과(now−rel)와 화면이 말한 dt 비교. 미래 스윙은 거절, 너무 늦게 온 건 지연 보정 상한까지만 */
export function fixDt(rel, dt, now) {
  const m = now - rel; dt = Number(dt);
  if (!Number.isFinite(dt) || dt < -200) return { dt: m, flag: "BAD_DT" };
  if (dt > m + FUTURE_TOL) return { dt: m, flag: "FUTURE" };
  if (dt < m - MAX_LAG) return { dt: m - MAX_LAG, flag: "LAG" };
  return { dt, flag: null };
}
export const cleanSwing = (sw) => ({ pid: Number(sw.pid), dt: Number(sw.dt), x: Math.max(-3, Math.min(3, Number(sw.x) || 0)), y: Math.max(-3, Math.min(3, Number(sw.y) || 0)), pw: !!sw.pw });
/** 공을 화면에 보낼 모양 (판정에 쓰는 값 그대로 — 진짜 공은 화면도 알아야 그릴 수 있음) */
export function pubPitch(p) {
  const o = { id: p.id, type: p.type, spd: p.spd, T: p.T, fx: p.fx, fy: p.fy, rx: p.rx, ry: p.ry, bx: p.bx, by: p.by, k: p.k, hump: p.hump };
  for (const k of ["wob", "tp", "prof", "decoys", "pat", "vfx", "fake", "vanish", "golden", "big", "shadow", "dim"]) if (p[k] !== undefined) o[k] = p[k];
  return o;
}
const closeAtOf = (p, rel) => rel + p.T - SWING_LAG + WIN.max * CAP_WIN + MAX_LAG + 60;
const hintOf = (m) => [Math.round(m.win * 100) / 100, Math.round(m.rad * 100) / 100, m.late, m.predict ? 1 : 0];
/** AI 타자: 스윙할지·언제·어디로 (분신 공에 속기도 함) */
export function aiPlan(p, skill, r) {
  const k = AI_SKILL[skill] || AI_SKILL.normal;
  const strikeLike = p.fake ? r() < 0.45 : (p.strike ?? isStrike(p.fx, p.fy));
  if (!(strikeLike ? r() < k.swing : r() < k.chase)) return null;
  let tx = p.fx, ty = p.fy;
  if (p.decoys?.length && r() < k.fooled) { const d = p.decoys[Math.floor(r() * p.decoys.length)]; tx = d.fx; ty = d.fy; }
  if (p.tp && r() < k.fooled) { tx -= p.tp.dx; ty -= p.tp.dy; }
  const prof = p.prof ? 1 : 0;
  return { dt: Math.round(p.T - SWING_LAG + g3(r) * k.tsd * (1 + prof * 0.6)), x: tx + g3(r) * k.psd, y: ty + g3(r) * k.psd, pw: r() < 0.15 };
}
/** AI 투수 */
export function aiPitchSel(r, P, ctx = {}) {
  const types = PITCH_TYPES; let type = r() < 0.38 ? "fb" : types[1 + Math.floor(r() * 5)];
  if (has(P, "l_heaven") && !ctx.hvUsed && r() < 0.3) type = "hv";
  const ball = r() < 0.22, corner = r() < 0.6;
  const x = ball ? (r() < 0.5 ? -1 : 1) * (1.3 + r() * 0.4) : corner ? (r() < 0.5 ? -0.7 : 0.7) + (r() - 0.5) * 0.4 : (r() - 0.5) * 1.2;
  const y = ball && r() < 0.5 ? (r() < 0.5 ? -1.4 : 1.35) : (r() - 0.5) * 1.6;
  return { type, x, y, pw: 0.35 + r() * 0.65, dim: has(P, "l_dimension") && !ctx.dimUsed && r() < 0.35 };
}
function seatP(s) { return { ...newAugHolder(), id: s.id, name: s.name, idx: s.idx, team: s.team ?? 0, ai: !!s.ai, auto: false, skill: s.skill || "normal", left: false, frozen: 0 }; }

// ======================================================================
// 홈런더비 (1~50인) — 각자 자기 타석, 같은 투구 순서(공정), 같은 시간
// ======================================================================
export class Derby {
  constructor({ seats, aug, opts = {}, seed, out }) {
    this.kind = "derby"; this.aug = !!aug; this.seed = seed >>> 0; this.out = out || (() => {});
    this.o = { time: [60, 120, 180].includes(opts.time) ? opts.time : 0, pitches: [20, 30].includes(opts.pitches) ? opts.pitches : 0, diff: ["easy", "normal", "hard"].includes(opts.diff) ? opts.diff : "normal", fair: opts.fair !== false, practice: !!opts.practice };
    if (!this.o.time && !this.o.pitches && !this.o.practice) this.o.time = 120;
    this.P = new Map();
    for (const s of seats) { const P = seatP(s); Object.assign(P, { score: 0, hr: 0, hits: 0, maxDist: 0, combo: 0, bestCombo: 0, hitStreak: 0, perfect: 0, n: 0, ph: "wait", nextAt: 0, extra: 0, done: null, cur: null }); this.P.set(s.id, P); }
    this.status = "prep";
  }
  get mode() { return "derby"; }
  start(now) {
    this.startedAt = now;
    if (this.aug) for (const P of this.P.values()) this.offer(P, now, true);
    this.prepEnd = now + (this.aug ? 15_000 : 2_500);
    this.out("all", "phase", { st: "prep", prepEnd: this.prepEnd });
  }
  offer(P, now, first = false) {
    const r = rng(mixSeed(this.seed, P.idx, "aug", P.picks));
    const ids = rollOffer(P, "derby", r, { legendOk: !first }); if (!ids) return false;
    P.offer = ids; P.offerUntil = first ? Infinity : now + PICK_MS; P.pickStart = now;
    this.out(P.id, "offer", { ids, until: first ? this.prepEnd || now + 15000 : P.offerUntil, first });
    return true;
  }
  pick(uid, id, now) {
    const P = this.P.get(uid); if (!P || !P.offer) return { ok: false, error: "NO_OFFER" };
    if (!P.offer.includes(id)) return { ok: false, error: "BAD_PICK" };
    addAug(P, id); P.offer = null; P.picks++;
    if (this.status === "play" && P.pickStart) { P.extra += Math.min(PICK_MS, now - P.pickStart); P.pickStart = 0; P.ph = "wait"; P.nextAt = now + 400; }
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) });
    return { ok: true };
  }
  go(now) {
    for (const P of this.P.values()) if (P.offer) { this.pick(P.id, P.offer[0], now); }
    this.status = "play"; this.startsAt = now;
    this.endsAt = this.o.time ? now + this.o.time * 1000 : this.o.practice ? now + DERBY.practiceCap * 1000 : now + 12 * 60_000;
    for (const P of this.P.values()) { P.ph = "wait"; P.nextAt = now + 600; P.extra = 0; if (P.left) P.done = "left"; }
    this.out("all", "phase", { st: "play", startsAt: now, endsAt: this.endsAt, timed: !!this.o.time });
  }
  rankList() { return [...this.P.values()].sort((a, b) => b.score - a.score || b.hr - a.hr || b.maxDist - a.maxDist || a.idx - b.idx); }
  pitchFor(P) {
    const seedP = this.o.fair ? this.seed : mixSeed(this.seed, P.idx);
    const r = rng(mixSeed(seedP, "p", P.n));
    const d = this.o.diff, wts = d === "easy" ? { fb: 7, ch: 2, cu: 1 } : d === "normal" ? { fb: 5, ch: 2, cu: 1, sl: 1, si: 1 } : { fb: 4, ch: 2, cu: 2, sl: 2, si: 1, fk: 1 };
    let tot = 0; for (const k in wts) tot += wts[k]; let x = r() * tot, type = "fb"; for (const k in wts) { x -= wts[k]; if (x <= 0) { type = k; break; } }
    const ball = r() < (d === "easy" ? 0.08 : d === "normal" ? 0.14 : 0.2);
    const spread = d === "easy" ? 1.0 : 1.5;
    const sel = { type, pw: r() * (d === "hard" ? 1 : 0.7), x: ball ? (r() < 0.5 ? -1 : 1) * (1.35 + r() * 0.4) : (r() - 0.5) * spread, y: ball ? (r() - 0.5) * 2.2 : (r() - 0.5) * spread };
    const p = makePitch(P.n + 1, sel, {}, r, { spdMul: d === "easy" ? 0.8 : d === "normal" ? 0.88 : 0.97, brkMul: d === "easy" ? 0.6 : d === "normal" ? 0.85 : 1 });
    if ((has(P, "e_goldball") && P.n % 5 === 4) || P.buf.golden > 0) { p.golden = true; if (P.buf.golden > 0) P.buf.golden--; }
    return p;
  }
  ctxOf(P, now) {
    const list = this.rankList(), k = list.indexOf(P);
    const left = this.o.time ? (this.endsAt + P.extra) - now : Infinity;
    return { mode: "derby", bottomHalf: list.length > 1 && k >= Math.ceil(list.length / 2), last30: left < 30_000, last15: left < 15_000, pitch: P.cur };
  }
  tick(now) {
    if (this.status === "prep") { const all = [...this.P.values()].every(P => !P.offer || P.left); if (now >= this.prepEnd || (all && now >= this.startedAt + 1200)) this.go(now); return; }
    if (this.status !== "play") return;
    for (const P of this.P.values()) {
      if (P.done) continue;
      if (P.left) { this.finishP(P, "left"); continue; }
      const timeUp = now >= this.endsAt + P.extra + (P.ph === "pick" && P.pickStart ? Math.min(PICK_MS, now - P.pickStart) : 0); // 고르는 시간은 빼 줌
      if (timeUp && P.ph !== "flight" && P.ph !== "result") { this.finishP(P, "time"); continue; }
      if (this.o.pitches && P.n >= this.o.pitches && P.ph !== "flight" && P.ph !== "result" && P.ph !== "windup") { this.finishP(P, "time"); continue; }
      switch (P.ph) {
        case "wait":
          if (now < P.nextAt || timeUp) break;
          P.cur = this.pitchFor(P); P.rel = now + WINDUP; P.swung = false; P.ph = "windup";
          this.out(P.id, "windup", { pid: P.cur.id, rel: P.rel, n: P.n + 1, golden: !!P.cur.golden });
          break;
        case "windup":
          if (now >= P.rel) { const m = batMods(P, this.ctxOf(P, now)); P.closeAt = closeAtOf(P.cur, P.rel); P.ph = "flight"; this.out(P.id, "pitch", { p: pubPitch(P.cur), rel: P.rel, h: hintOf(m) }); }
          break;
        case "flight": if (now >= P.closeAt) this.resolve(P, null, now); break;
        case "result":
          if (now < P.nextAt) break;
          if (this.aug && this.offerDue(P) && this.offer(P, now)) P.ph = "pick"; else { P.ph = "wait"; P.nextAt = now + 150; }
          break;
        case "pick": if (P.offer && now >= P.offerUntil) this.pick(P.id, P.offer[0], now); break;
      }
    }
    if ([...this.P.values()].every(P => P.done)) this.end(now, "ALL_DONE");
    else if (now > this.endsAt + 25_000 + Math.max(0, ...[...this.P.values()].map(P => P.extra))) this.end(now, "TIME");
  }
  offerDue(P) {
    if (P.augs.length >= MAX_AUGS && P.augs.every(a => a.st >= (AUG[a.id].max || 1))) return false;
    const th = this.o.pitches ? DERBY.augAtPitch : DERBY.augAt, v = this.o.pitches ? P.n : P.score;
    const passed = th.filter(t => v >= t).length; return P.picks - 1 < passed && P.picks < MAX_AUGS;
  }
  finishP(P, why) { if (P.done) return; P.done = why; P.ph = "done"; P.offer = null; this.out(P.id, "done", { why }); }
  swing(uid, sw0, now) {
    const P = this.P.get(uid); if (!P || P.done) return { ok: false, error: "NOT_PLAYING" };
    const sw = cleanSwing(sw0);
    if (P.ph !== "flight" || P.cur?.id !== sw.pid) return { ok: false, error: "NO_PITCH" };
    if (P.swung) return { ok: false, error: "DUP" };
    const f = fixDt(P.rel, sw.dt, now); sw.dt = f.dt;
    P.swung = true; this.resolve(P, sw, now, f.flag); return { ok: true, flag: f.flag };
  }
  resolve(P, sw, now, flag = null) {
    const p = P.cur, ctx = this.ctxOf(P, now), m = batMods(P, ctx); m.ev += DERBY.evBonus; m.la += 2; const r = rng(mixSeed(this.o.fair ? this.seed : mixSeed(this.seed, P.idx), "L", P.n));
    P.snap = { score: P.score, hr: P.hr, hits: P.hits, combo: P.combo, hitStreak: P.hitStreak, maxDist: P.maxDist, perfect: P.perfect, n: P.n, buf: { ...P.buf }, pn: P.pn, p };
    let kind, j = null, L = null, play = null, dist = 0, fx = [], pts = 0;
    if (!sw) kind = p.strike ? "strike" : "ball";
    else {
      j = judgeSwing(p, sw, m);
      if (!j.contact) kind = "whiff";
      else {
        L = launch(p, j, sw, m, r); fx = afterContact(P, ctx, j, L);
        if (L.foul && !L.forceHr) kind = "foul";
        else { L.foul = false; const res = playBall(L, {}, r, { distMul: m.dist }); kind = res.kind; play = res.play; dist = res.dist; if (L.forceHr && kind !== "hr") { kind = "hr"; } }
        if (luckyHit(P, j, kind, r)) { kind = "single"; fx.push("lucky"); }
      }
    }
    // 점수
    const hit = HIT_KINDS.has(kind);
    if (hit) {
      P.hits++; P.hitStreak++; pts = DERBY.score[kind] || 0;
      if (kind === "hr") { P.hr++; P.combo++; for (const [d, b] of DERBY.longHr) if (dist >= d) pts += b; pts += Math.min(DERBY.comboCap, (P.combo - 1) * DERBY.combo * (1 + 0.5 * st(P, "c_combo"))); if (has(P, "r_hrboom")) { pts += 300; fx.push("hrboom"); } if (isMeteor(P, L, kind)) { pts += 800; fx.push("meteor"); } }
      else { if (has(P, "c_stance")) P.combo = Math.max(0, P.combo - 1); else P.combo = 0; }
      if (j?.grade === "perfect") { pts += DERBY.perfect; P.perfect++; }
      if (has(P, "e_triple") && P.hitStreak % 3 === 0) { pts += 300; fx.push("triple"); }
      let mul = m.mul; if (p.golden) { mul *= DERBY.golden; fx.push("golden"); }
      if (has(P, "l_miracle") && ctx.last15 && ctx.bottomHalf) { mul *= 1.3; fx.push("miracle"); }
      pts = Math.round(pts * Math.min(CAP.mul, mul));
      P.score += pts; P.maxDist = Math.max(P.maxDist, dist); P.bestCombo = Math.max(P.bestCombo, P.combo);
    } else {
      const safe = (kind === "whiff" && P.buf.inf > 0) || kind === "ball";
      if (!safe) { if (has(P, "c_stance")) P.combo = Math.max(0, P.combo - 1); else P.combo = 0; P.hitStreak = 0; }
      if (OUT_KINDS.has(kind) && j?.contact) P.score += DERBY.score.out;
    }
    P.n++; passPitch(P);
    P.last = kind; P.ph = "result"; P.nextAt = now + (kind === "hr" ? 2300 : hit || OUT_KINDS.has(kind) ? 1700 : kind === "foul" ? 1000 : 650);
    this.out(P.id, "res", { pid: p.id, i: P.idx, sw: sw ? { dt: sw.dt, x: sw.x, y: sw.y, pw: sw.pw } : null, j: j ? { c: j.contact, e: j.e, d: j.d, g: j.grade || j.why } : null, L, dm: m.dist, kind, play, dist, pts, fx, flag,
      me: { score: P.score, hr: P.hr, combo: P.combo, maxDist: P.maxDist, n: P.n, hits: P.hits }, augs: augView(P), buf: bufView(P) });
    if (kind === "hr" && (P.combo >= 3 || dist >= 140 || fx.includes("meteor"))) this.out("all", "feed", { k: "hr", i: P.idx, dist, combo: P.combo, meteor: fx.includes("meteor") });
  }
  use(uid, id, now) {
    const P = this.P.get(uid); if (!P || P.done) return { ok: false, error: "NOT_PLAYING" };
    const canRewind = id === "l_rewind" && P.ph === "result" && P.snap && ["whiff", "strike", "foul", "groundout", "flyout", "lineout", "popout"].includes(P.last);
    const r = useAug(P, id, { canRewind }); if (!r.ok) return r;
    if (id === "l_rewind") { const s = P.snap; Object.assign(P, { score: s.score, hr: s.hr, hits: s.hits, combo: s.combo, hitStreak: s.hitStreak, maxDist: s.maxDist, perfect: s.perfect, n: s.n, pn: s.pn }); P.buf = { ...s.buf };
      P.cur = { ...s.p, id: s.p.id + 1000 }; P.rel = now + WINDUP; P.swung = false; P.ph = "windup"; P.snap = null; this.out(P.id, "windup", { pid: P.cur.id, rel: P.rel, n: P.n + 1, rewind: true }); }
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P), used: id });
    if (AUG[id].rarity === "legendary") this.out("all", "feed", { k: "use", i: P.idx, id });
    return { ok: true };
  }
  stream(kind, uid, now) {
    const P = this.P.get(uid); if (!P || P.done) return { ok: false };
    if (kind === "buff") P.buf.donBuff = 5; else if (kind === "debuff") P.buf.donDebuff = 5; else if (kind === "golden") P.buf.golden = (P.buf.golden || 0) + 1;
    else if (kind === "event") { for (const Q of this.P.values()) if (!Q.done) Q.buf.golden = Math.min(3, (Q.buf.golden || 0) + 1); }
    else return { ok: false };
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) }); return { ok: true };
  }
  leave(uid) { const P = this.P.get(uid); if (P) P.left = true; }
  rows() { return [...this.P.values()].map(P => [P.idx, P.score, P.hr, Math.round(P.maxDist), P.combo, P.n, P.done ? (P.done === "left" ? 2 : 1) : P.offer ? 3 : 0, P.augs.length, P.left ? 0 : 1, P.bestCombo]); }
  snapshot(uid, now) {
    const P = this.P.get(uid); const base = { kind: "derby", status: this.status, o: this.o, aug: this.aug, prepEnd: this.prepEnd, startsAt: this.startsAt, endsAt: this.endsAt };
    if (!P) return base;
    const m = batMods(P, this.ctxOf(P, now));
    return { ...base, me: { score: P.score, hr: P.hr, combo: P.combo, maxDist: P.maxDist, n: P.n, hits: P.hits, extra: P.extra, done: P.done, ph: P.ph }, augs: augView(P), buf: bufView(P), offer: P.offer, offerUntil: P.offerUntil === Infinity ? this.prepEnd : P.offerUntil,
      cur: (P.ph === "flight" || P.ph === "windup") && P.cur ? { p: P.ph === "flight" ? pubPitch(P.cur) : null, pid: P.cur.id, rel: P.rel, h: hintOf(m) } : null };
  }
  end(now, reason) {
    if (this.status === "ended") return; this.status = "ended";
    for (const P of this.P.values()) if (!P.done) P.done = "time";
    const rows = this.rankList().map((P, k) => ({ place: k + 1, id: P.id, idx: P.idx, name: P.name, score: P.score, hr: P.hr, hits: P.hits, maxDist: Math.round(P.maxDist), bestCombo: P.bestCombo, perfect: P.perfect, n: P.n, augs: P.augs.map(a => a.id), done: P.done }));
    this.result = { kind: "derby", reason, rows, practice: this.o.practice }; this.out("all", "end", this.result);
  }
}

// ======================================================================
// 경기: 투수 VS 타자(2인) · 미니 야구(2~8인, 팀) — 같은 규칙 엔진
// ======================================================================
export class Match {
  constructor({ seats, mode, aug, opts = {}, seed, out }) {
    this.kind = mode === "pvb" ? "pvb" : "mini"; this.aug = !!aug; this.seed = seed >>> 0; this.out = out || (() => {});
    this.o = { innings: [1, 3, 5].includes(opts.innings) ? opts.innings : 3, ext: opts.ext !== false, rot: opts.rot === "fixed" ? "fixed" : "rotate", diff: ["easy", "normal", "hard"].includes(opts.diff) ? opts.diff : "normal", mercy: 6 };
    this.P = new Map(); for (const s of seats) this.P.set(s.id, seatP(s));
    this.T = [0, 1].map(t => ({ lineup: seats.filter(s => (s.team ?? 0) === t).map(s => s.id), bat: 0, rot: 0, runs: 0, hits: 0, line: [], streak: 0 }));
    for (const P of this.P.values()) P.stats = { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, so: 0, r: 0, k: 0, pc: 0, er: 0 };
    this.inning = 1; this.half = 0; this.outs = 0; this.balls = 0; this.strikes = 0; this.bases = [null, null, null]; this.halfRuns = 0;
    this.status = "prep"; this.ph = "prep"; this.pc = 0; this.log = []; this.rseq = 0;
  }
  get mode() { return this.kind; }
  get off() { return this.half; } get def() { return 1 - this.half; }
  pl(id) { return this.P.get(id); }
  start(now) {
    this.startedAt = now;
    if (this.aug) for (const P of this.P.values()) this.offer(P, now, true);
    this.prepEnd = now + (this.aug ? 15_000 : 2_500);
    this.out("all", "phase", { st: "prep", prepEnd: this.prepEnd });
  }
  offer(P, now, first = false) {
    const r = rng(mixSeed(this.seed, P.idx, "aug", P.picks));
    const ids = rollOffer(P, this.kind, r, { legendOk: !first }); if (!ids) return false;
    if (P.ai || P.auto) { addAug(P, ids[Math.floor(r() * ids.length)]); P.picks++; return false; }
    P.offer = ids; P.offerUntil = first ? this.prepEnd || now + 15000 : now + PICK_MS;
    this.out(P.id, "offer", { ids, until: P.offerUntil, first });
    return true;
  }
  pick(uid, id) {
    const P = this.P.get(uid); if (!P || !P.offer) return { ok: false, error: "NO_OFFER" };
    if (!P.offer.includes(id)) return { ok: false, error: "BAD_PICK" };
    addAug(P, id); P.offer = null; P.picks++;
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) }); this.out("all", "picked", { i: P.idx });
    return { ok: true };
  }
  anyOffer() { return [...this.P.values()].some(P => P.offer && !P.left && !P.ai && !P.auto); }
  go(now) { for (const P of this.P.values()) if (P.offer) this.pick(P.id, P.offer[0]); this.status = "play"; this.beginHalf(now); }
  pitcherId() { const T = this.T[this.def]; if (!T.lineup.length) return null; return this.o.rot === "fixed" ? T.lineup[0] : T.lineup[T.rot % T.lineup.length]; }
  batterId() { const T = this.T[this.off]; return T.lineup[T.bat % T.lineup.length]; }
  beginHalf(now) {
    this.outs = 0; this.balls = 0; this.strikes = 0; this.bases = [null, null, null]; this.halfRuns = 0;
    for (const P of this.P.values()) { P.used.absInning = false; P.used.ghost = false; P.used.meteor = false; }
    this.robUsed = false;
    this.T[this.off].line[this.inning - 1] = 0; this.T[this.off].streak = 0;
    this.out("all", "half", { inning: this.inning, half: this.half });
    this.nextBatter(now, true);
  }
  nextBatter(now, first = false) {
    this.balls = 0; this.strikes = 0; this.hvUsed = false; this.dimUsed = false;
    this.pitcher = this.pitcherId(); this.batter = this.batterId();
    this.ph = "select"; this.selUntil = now + 15_000; this.cur = null;
    const PP = this.pl(this.pitcher); this.aiPitchAt = (PP?.ai || PP?.auto) ? now + 900 + Math.floor(rng(mixSeed(this.seed, this.pc, "ai"))() * 900) : 0;
    this.out("all", "state", this.pubState());
  }
  pubState() {
    return { inning: this.inning, half: this.half, outs: this.outs, balls: this.balls, strikes: this.strikes, bases: this.bases.map(b => b ? { i: this.pl(b.u)?.idx ?? -1, n: b.n } : null),
      runs: [this.T[0].runs, this.T[1].runs], hits: [this.T[0].hits, this.T[1].hits], line: [this.T[0].line, this.T[1].line], pitcher: this.pl(this.pitcher)?.idx ?? -1, batter: this.pl(this.batter)?.idx ?? -1,
      ph: this.ph, selUntil: this.selUntil, innings: this.o.innings, lineups: this.T.map(T => T.lineup.map(id => this.pl(id).idx)), bat: [this.T[0].bat, this.T[1].bat], hvOk: !this.hvUsed, dimOk: !this.dimUsed };
  }
  teamOf(t) { return this.T[t].lineup.map(id => this.pl(id)); }
  trailing(t) { return this.T[t].runs < this.T[1 - t].runs; }
  pitch(uid, sel0, now) {
    if (this.status !== "play" || this.ph !== "select") return { ok: false, error: "NOT_NOW" };
    if (uid !== this.pitcher) return { ok: false, error: "NOT_PITCHER" };
    const P = this.pl(uid), sel = { type: String(sel0.type || "fb"), x: Math.max(-2.2, Math.min(2.2, Number(sel0.x) || 0)), y: Math.max(-2.2, Math.min(2.2, Number(sel0.y) || 0)), pw: Math.max(0, Math.min(1, Number(sel0.pw) || 0)), dim: !!sel0.dim };
    if (!PITCH_TYPES.includes(sel.type) && !(sel.type === "hv" && has(P, "l_heaven") && !this.hvUsed)) return { ok: false, error: "BAD_PITCH" };
    if (sel.dim && !(has(P, "l_dimension") && !this.dimUsed)) sel.dim = false;
    const r = rng(mixSeed(this.seed, "pitch", this.pc));
    const pm = pitchMods(P, { type: sel.type });
    const p = makePitch(++this.pc, sel, pm, r, { spdMul: 1 });
    if (sel.type === "hv") this.hvUsed = true;
    if (sel.dim) { this.dimUsed = true; p.tp = { s: 0.8, dx: (r() < 0.5 ? -1 : 1) * 0.6, dy: Math.round((r() - 0.5) * 50) / 100 }; p.dim = true; }
    p.pm = { fbWin: pm.fbWin, radDown: pm.radDown };
    this.cur = p; this.rel = now + WINDUP; this.swung = false; this.ph = "windup"; P.stats.pc++;
    this.out("all", "windup", { pid: p.id, rel: this.rel, pi: P.idx, bi: this.pl(this.batter).idx });
    return { ok: true };
  }
  batCtx(B) {
    const t = B.team;
    return { mode: this.kind, team: this.teamOf(t), trailing: this.trailing(t), twoStrikes: this.strikes >= 2, streak: B.streak || 0, teamStreak: this.T[t].streak, pitch: this.cur, pm: this.cur?.pm };
  }
  tick(now) {
    if (this.status === "prep") { if (now >= this.prepEnd || (!this.anyOffer() && now >= this.startedAt + 1200)) this.go(now); return; }
    if (this.status !== "play") return;
    switch (this.ph) {
      case "select": {
        if (this.aiPitchAt && now >= this.aiPitchAt) { const P = this.pl(this.pitcher); this.pitch(P.id, aiPitchSel(rng(mixSeed(this.seed, "aisel", this.pc)), P, { hvUsed: this.hvUsed, dimUsed: this.dimUsed }), now); }
        else if (now >= this.selUntil) { const P = this.pl(this.pitcher); this.pitch(P.id, aiPitchSel(rng(mixSeed(this.seed, "auto", this.pc)), P, { hvUsed: true, dimUsed: true }), now); this.out("all", "feed", { k: "autopitch", i: P.idx }); }
        break;
      }
      case "windup":
        if (now >= this.rel) {
          const B = this.pl(this.batter), m = batMods(B, this.batCtx(B));
          this.ph = "flight"; this.closeAt = closeAtOf(this.cur, this.rel);
          this.out("all", "pitch", { p: pubPitch(this.cur), rel: this.rel, h: hintOf(m), bi: B.idx });
          if (B.ai || B.auto) { const plan = aiPlan(this.cur, B.ai ? (B.skill || this.o.diff) : "normal", rng(mixSeed(this.seed, "aib", this.pc))); this.aiSwing = plan ? { ...plan, at: this.rel + plan.dt, pid: this.cur.id } : null; } else this.aiSwing = null;
        }
        break;
      case "flight":
        if (this.aiSwing && now >= this.aiSwing.at) { const s = this.aiSwing; this.aiSwing = null; this.swung = true; this.resolve({ dt: s.dt, x: s.x, y: s.y, pw: s.pw }, now); }
        else if (now >= this.closeAt) this.resolve(null, now);
        break;
      case "result": if (now >= this.nextAt) this.afterResult(now); break;
      case "pick": if (!this.anyOffer() || now >= this.pickUntil) { for (const P of this.P.values()) if (P.offer) this.pick(P.id, P.offer[0]); this.ph = "between"; this.nextAt = now + 300; } break;
      case "between": if (now >= this.nextAt) this.beginHalf(now); break;
    }
  }
  swing(uid, sw0, now) {
    if (this.status !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (uid !== this.batter) return { ok: false, error: "NOT_BATTER" };
    const sw = cleanSwing(sw0);
    if (this.ph !== "flight" || this.cur?.id !== sw.pid) return { ok: false, error: "NO_PITCH" };
    if (this.swung) return { ok: false, error: "DUP" };
    const f = fixDt(this.rel, sw.dt, now); sw.dt = f.dt; this.swung = true;
    this.resolve(sw, now, f.flag); return { ok: true, flag: f.flag };
  }
  resolve(sw, now, flag = null) {
    const p = this.cur, B = this.pl(this.batter), PP = this.pl(this.pitcher), ctx = this.batCtx(B), m = batMods(B, ctx);
    const r = rng(mixSeed(this.seed, "res", p.id));
    this.snap = { inning: this.inning, half: this.half, outs: this.outs, balls: this.balls, strikes: this.strikes, bases: [...this.bases], halfRuns: this.halfRuns, runs: [this.T[0].runs, this.T[1].runs], hits: [this.T[0].hits, this.T[1].hits], line: [this.T[0].line[this.inning - 1], this.T[1].line[this.inning - 1]], bat: [this.T[0].bat, this.T[1].bat], stats: new Map([...this.P.values()].map(Q => [Q.id, { ...Q.stats }])), streak: B.streak, tstreak: this.T[this.off].streak, p, batter: B.id };
    let kind, j = null, L = null, play = null, dist = 0, fx = [];
    if (!sw) kind = p.strike ? "strike" : "ball";
    else {
      j = judgeSwing(p, sw, m);
      if (!j.contact) kind = (B.buf.inf > 0) ? "whiffSafe" : "whiff";
      else {
        L = launch(p, j, sw, m, r); fx = afterContact(B, ctx, j, L);
        if (L.foul && !L.forceHr) kind = "foul";
        else {
          L.foul = false; const D = fieldMods(this.teamOf(this.def), this.robUsed);
          const res = playBall(L, D, r, { distMul: m.dist }); kind = res.kind; play = res.play; dist = res.dist;
          if (play?.robbed) { this.robUsed = true; fx.push("robbed"); }
          if (L.forceHr && kind !== "hr") kind = "hr";
          if (luckyHit(B, j, kind, r)) { kind = "single"; fx.push("lucky"); }
        }
      }
    }
    passPitch(B);
    const ev = this.apply(kind, B, PP, { dist, play, fx, L });
    this.out("all", "res", { pid: p.id, bi: B.idx, pi: PP.idx, sw: sw ? { dt: sw.dt, x: sw.x, y: sw.y, pw: sw.pw } : null, j: j ? { c: j.contact, e: j.e, d: j.d, g: j.grade || j.why } : null, L, dm: m.dist, kind: ev.kind, raw: kind, play, dist, fx, flag, ...ev.info, st: this.pubState(), stats: [...this.P.values()].map(Q => ({ i: Q.idx, ...Q.stats })) });
    this.out(B.id, "augs", { augs: augView(B), buf: bufView(B) });
    this.ph = "result"; const big = ev.kind === "hr" || ev.runs > 0;
    this.nextAt = now + (ev.kind === "hr" ? 3000 : HIT_KINDS.has(kind) || OUT_KINDS.has(kind) || kind === "dp" ? (big ? 2900 : 2500) : kind === "foul" ? 1300 : 1100);
    this.lastKind = ev.kind; this.lastBatter = B.id; this.lastPaEnd = ev.paEnd;
  }
  /** 야구 규칙 적용 → 득점·아웃·주자 */
  apply(kind, B, PP, o) {
    const T = this.T[this.off], before = [...this.bases]; let runs = 0, scorers = [], outsAdd = 0, paEnd = false, outKind = kind, extra = 0;
    // 베이스에는 '주자 표' { u: 사람, n: 번호 } — 1인 팀은 같은 사람이 주자이면서 다시 타석에 서기 때문
    const tok = () => ({ u: B.id, n: ++this.rseq });
    const score = (r) => { if (!r) return; runs++; scorers.push(r.n); const Q = this.pl(r.u); if (Q) Q.stats.r++; };
    const force = () => { // 볼넷: 밀어내기
      if (this.bases[0]) { if (this.bases[1]) { if (this.bases[2]) score(this.bases[2]); this.bases[2] = this.bases[1]; } this.bases[1] = this.bases[0]; }
      this.bases[0] = tok();
    };
    if (kind === "ball") { this.balls++; if (this.balls >= 4) { force(); outKind = "walk"; paEnd = true; B.stats.bb++; } }
    else if (kind === "strike" || kind === "whiff") { this.strikes++; if (this.strikes >= 3) { outsAdd = 1; outKind = "k"; paEnd = true; B.stats.so++; PP.stats.k++; } }
    else if (kind === "whiffSafe") { outKind = "whiffSafe"; }
    else if (kind === "foul") { if (this.strikes < 2) this.strikes++; }
    else if (HIT_KINDS.has(kind)) {
      const n = kind === "single" ? 1 : kind === "double" ? 2 : kind === "triple" ? 3 : 4;
      B.streak = (B.streak || 0) + 1; T.streak++;
      if (has(B, "e_triple") && B.streak % 3 === 0 && n < 4) { extra = 1; o.fx.push("triple"); }
      if (has(B, "r_ghost") && !B.used.ghost && n < 4 && this.bases.some(Boolean)) { extra += 1; B.used.ghost = true; o.fx.push("ghost"); }
      const nb = [null, null, null];
      for (let b = 2; b >= 0; b--) { const id = this.bases[b]; if (!id) continue; let to = b + n + extra; if (n === 1 && b === 1 && o.dist > 55) to++; if (n === 2 && b === 0 && o.dist > 85) to++; while (to < 3 && nb[to]) to++; if (to >= 3) score(id); else nb[to] = id; }
      if (n >= 4) score(tok()); else nb[n - 1] = tok();
      this.bases = nb; T.hits++; B.stats.h++; B.stats.ab++; paEnd = true;
      if (n === 4 || kind === "ihr") { B.stats.hr++; if (isMeteor(B, o.L, kind) && !B.used.meteor) { B.used.meteor = true; runs++; o.fx.push("meteor"); } if (has(B, "r_hrboom") && this.kind === "mini") { B.buf.hrNext = 2; o.fx.push("hrboom"); } }
    } else if (OUT_KINDS.has(kind)) {
      B.streak = 0; T.streak = 0; outsAdd = 1; paEnd = true; B.stats.ab++;
      if (kind === "groundout" && this.bases[0] && this.outs < 2 && o.play?.quick) { outsAdd = 2; outKind = "dp"; this.bases[0] = null; }
      if (this.outs + outsAdd < 3) {
        if (kind === "groundout") { const nb = [null, null, null]; for (let b = 2; b >= 0; b--) { const id = this.bases[b]; if (!id) continue; if (b + 1 >= 3) score(id); else nb[b + 1] = id; } this.bases = nb; }
        else if (kind === "flyout" && this.bases[2] && o.dist > 65) { score(this.bases[2]); this.bases[2] = null; o.fx.push("sacfly"); }
      }
    }
    if (paEnd && !HIT_KINDS.has(kind)) { if (outKind !== "walk") { B.streak = 0; T.streak = 0; } }
    if (paEnd && outKind === "walk") B.stats.pa++;
    // 최후의 기적: 이 아웃으로 우리 팀이 지며 끝나게 되면 한 번 취소 (타자 1루로)
    if (outsAdd && this.outs + outsAdd >= 3 && this.wouldLose(runs)) {
      const holder = this.teamOf(this.off).find(Q => has(Q, "l_miracle") && !Q.used.miracle);
      if (holder) { holder.used.miracle = true; outsAdd = Math.max(0, 3 - this.outs - 1); if (outKind === "dp") outsAdd = Math.min(outsAdd, 1); force(); o.fx.push("miracle"); outKind = outKind === "k" ? "kMiracle" : "miracle"; }
    }
    this.outs += outsAdd;
    if (runs) { T.runs += runs; this.halfRuns += runs; T.line[this.inning - 1] = (T.line[this.inning - 1] || 0) + runs; B.stats.rbi += runs; PP.stats.er += runs; }
    if (paEnd) { B.stats.pa += outKind === "walk" ? 0 : 1; T.bat++; this.balls = 0; this.strikes = 0; if (B.buf.hrNext > 0 && !(kind === "hr")) B.buf.hrNext--; }
    return { kind: outKind, runs, paEnd, info: { runs, scorers, before: before.map(b => b ? { i: this.pl(b.u)?.idx ?? -1, n: b.n } : null), outsAdd } };
  }
  wouldLose(runsNow) {
    const off = this.off, lastInn = this.inning >= this.o.innings;
    if (!lastInn) return false;
    const my = this.T[off].runs + runsNow, opp = this.T[1 - off].runs;
    return my < opp;                                // 마지막 이닝: 초 공격은 홈팀이 앞서면 바로 끝, 말 공격은 그대로 끝
  }
  afterResult(now) {
    const homeLead = this.T[1].runs > this.T[0].runs;
    // 끝내기
    if (this.half === 1 && this.inning >= this.o.innings && homeLead) return this.end(now, "WALKOFF");
    const halfOver = this.outs >= 3 || this.halfRuns >= this.o.mercy;
    if (!halfOver) { if (this.lastPaEnd) return this.nextBatter(now); this.ph = "select"; this.selUntil = now + 15_000; this.cur = null; const PP = this.pl(this.pitcher); this.aiPitchAt = (PP?.ai || PP?.auto) ? now + 800 + Math.floor(rng(mixSeed(this.seed, "aw", this.pc))() * 700) : 0; this.out("all", "state", this.pubState()); return; }
    if (this.halfRuns >= this.o.mercy && this.outs < 3) this.out("all", "feed", { k: "mercy" });
    this.T[this.def].rot++;
    if (this.half === 0) {
      if (this.inning >= this.o.innings && homeLead) return this.end(now, "HOME_LEADS");
      this.half = 1;
      if (this.aug && this.o.innings === 1) return this.startPick(now);
      return this.beginHalf(now);
    }
    // 이닝 끝
    if (this.inning >= this.o.innings) {
      if (this.T[0].runs !== this.T[1].runs) return this.end(now, "FINAL");
      if (!this.o.ext || this.inning >= this.o.innings + 2) return this.end(now, "DRAW");
      this.out("all", "feed", { k: "extra", inning: this.inning + 1 });
    }
    this.inning++; this.half = 0;
    if (this.aug) return this.startPick(now);
    this.beginHalf(now);
  }
  startPick(now) {
    let any = false; for (const P of this.P.values()) if (!P.left && this.offer(P, now)) any = true;
    if (!any) return this.beginHalf(now);
    this.ph = "pick"; this.pickUntil = now + PICK_MS; this.out("all", "state", this.pubState());
  }
  use(uid, id, now) {
    const P = this.pl(uid); if (!P || this.status !== "play") return { ok: false, error: "NOT_PLAYING" };
    const canRewind = id === "l_rewind" && this.ph === "result" && this.snap && this.snap.batter === uid && ["k", "groundout", "flyout", "lineout", "popout", "dp"].includes(this.lastKind) && this.snap.inning === this.inning;
    const r = useAug(P, id, { canRewind }); if (!r.ok) return r;
    if (id === "l_rewind") {
      const s = this.snap; Object.assign(this, { inning: s.inning, half: s.half, outs: s.outs, balls: s.balls, strikes: s.strikes, bases: s.bases, halfRuns: s.halfRuns });
      for (let t = 0; t < 2; t++) { this.T[t].runs = s.runs[t]; this.T[t].hits = s.hits[t]; this.T[t].line[s.inning - 1] = s.line[t]; this.T[t].bat = s.bat[t]; }
      for (const Q of this.P.values()) Q.stats = s.stats.get(Q.id) || Q.stats;
      P.streak = s.streak; this.T[this.off].streak = s.tstreak; this.batter = s.batter;
      const p = { ...s.p, id: ++this.pc }; this.cur = p; this.rel = now + WINDUP; this.swung = false; this.ph = "windup"; this.snap = null;
      this.out("all", "feed", { k: "rewind", i: P.idx }); this.out("all", "state", this.pubState());
      this.out("all", "windup", { pid: p.id, rel: this.rel, pi: this.pl(this.pitcher).idx, bi: P.idx, rewind: true });
    }
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P), used: id });
    if (AUG[id].rarity === "legendary" || AUG[id].rarity === "epic") this.out("all", "feed", { k: "use", i: P.idx, id });
    return { ok: true };
  }
  stream(kind, uid) {
    const P = this.pl(uid); if (!P) return { ok: false };
    if (kind === "buff") P.buf.donBuff = 5; else if (kind === "debuff") P.buf.donDebuff = 5; else if (kind === "golden") P.buf.donBuff = Math.max(P.buf.donBuff || 0, 1);
    else if (kind === "event") { for (const Q of this.teamOf(P.team)) Q.buf.donBuff = 3; } else return { ok: false };
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) }); return { ok: true };
  }
  /** 나감·끊김: AI가 대신 (경기는 계속) */
  setAuto(uid, on, now) { const P = this.pl(uid); if (!P || P.ai) return; P.auto = !!on; if (on && P.offer) this.pick(uid, P.offer[0]); if (on && this.ph === "select" && this.pitcher === uid && !this.aiPitchAt) this.aiPitchAt = now + 600; }
  leave(uid, now) { const P = this.pl(uid); if (!P) return; P.left = true; this.setAuto(uid, true, now); if (![...this.P.values()].some(Q => !Q.ai && !Q.left)) this.end(now, "EMPTY"); }
  snapshot(uid, now) {
    const P = this.pl(uid);
    const base = { kind: this.kind, status: this.status, o: this.o, aug: this.aug, prepEnd: this.prepEnd, st: this.status === "prep" ? null : this.pubState(), stats: [...this.P.values()].map(Q => ({ i: Q.idx, ...Q.stats })) };
    const cur = (this.ph === "flight" || this.ph === "windup") && this.cur ? { p: this.ph === "flight" ? pubPitch(this.cur) : null, pid: this.cur.id, rel: this.rel, bi: this.pl(this.batter).idx, pi: this.pl(this.pitcher).idx, h: hintOf(batMods(this.pl(this.batter), this.batCtx(this.pl(this.batter)))) } : null;
    if (!P) return { ...base, cur };
    return { ...base, cur, augs: augView(P), buf: bufView(P), offer: P.offer, offerUntil: P.offerUntil };
  }
  end(now, reason) {
    if (this.status === "ended") return; this.status = "ended"; this.ph = "end";
    const [a, h] = [this.T[0].runs, this.T[1].runs], win = a === h ? -1 : a > h ? 0 : 1;
    const ps = [...this.P.values()];
    const mvp = ps.slice().sort((x, y) => (y.stats.hr * 4 + y.stats.h * 2 + y.stats.rbi * 2 + y.stats.k) - (x.stats.hr * 4 + x.stats.h * 2 + x.stats.rbi * 2 + x.stats.k))[0];
    this.result = { kind: this.kind, reason, runs: [a, h], win, line: [this.T[0].line, this.T[1].line], hits: [this.T[0].hits, this.T[1].hits], mvp: mvp?.idx ?? -1,
      rows: ps.map(Q => ({ id: Q.id, idx: Q.idx, name: Q.name, team: Q.team, ai: Q.ai, ...Q.stats, augs: Q.augs.map(x => x.id) })) };
    this.out("all", "end", this.result);
  }
}

// ======================================================================
// 야구 보스 레이드 (1~8인) — 보스 상태 머신, 모두 같은 공, 합동 공격, 팀 방어 게이지
// ======================================================================
const DMG = { weak: 6, fair: 12, good: 20, perfect: 32 };
export const RAID = { idle: 700, windup: 1100, recovery: 950, phaseMs: 2600, gauge: 100, augHp: 1.15, hpExp: 1.08, shareMul: 0.75 };
export class Raid {
  constructor({ seats, aug, opts = {}, seed, out }) {
    this.kind = "raid"; this.aug = !!aug; this.seed = seed >>> 0; this.out = out || (() => {});
    const boss = BOSSES[opts.boss] ? opts.boss : "slime";
    this.o = { boss, diff: ["easy", "normal", "hard"].includes(opts.diff) ? opts.diff : "normal" };
    this.P = new Map(); for (const s of seats) { const P = seatP(s); Object.assign(P, { dmg: 0, hits: 0, perfect: 0, hr: 0, miss: 0, combo: 0, best: 0, streak3: 0, undying: 0 }); this.P.set(s.id, P); }
    const B = BOSSES[boss], n = Math.max(1, seats.length), dm = { easy: 0.75, normal: 1, hard: 1.3 }[this.o.diff];
    const hp = Math.round(B.hp * Math.pow(n, RAID.hpExp) * dm * (this.aug ? RAID.augHp : 1));
    this.boss = { id: boss, hp, max: hp, phase: 1, st: "IDLE", shield: B.shield ? B.shield + 2 * n : 0, stun: 0, stunMeter: 0, enraged: false };
    this.gauge = RAID.gauge; this.status = "prep"; this.pc = 0; this.queue = [];
  }
  get mode() { return "raid"; }
  active() { return [...this.P.values()].filter(P => !P.left); }
  start(now) {
    this.startedAt = now;
    if (this.aug) for (const P of this.P.values()) this.offer(P, now, true);
    this.prepEnd = now + (this.aug ? 15_000 : 3_000);
    this.out("all", "phase", { st: "prep", prepEnd: this.prepEnd, boss: this.bossView() });
  }
  offer(P, now, first = false) {
    const r = rng(mixSeed(this.seed, P.idx, "aug", P.picks));
    const ids = rollOffer(P, "raid", r, { legendOk: !first }); if (!ids) return false;
    P.offer = ids; P.offerUntil = first ? this.prepEnd : now + PICK_MS;
    this.out(P.id, "offer", { ids, until: P.offerUntil, first }); return true;
  }
  pick(uid, id) {
    const P = this.P.get(uid); if (!P || !P.offer) return { ok: false, error: "NO_OFFER" };
    if (!P.offer.includes(id)) return { ok: false, error: "BAD_PICK" };
    addAug(P, id); P.offer = null; P.picks++; this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) }); return { ok: true };
  }
  anyOffer() { return this.active().some(P => P.offer); }
  bossView() { const b = this.boss; return { id: b.id, hp: b.hp, max: b.max, phase: b.phase, st: b.st, shield: b.shield, stun: b.stun, stunMeter: b.stunMeter, stunNeed: this.stunNeed(), enraged: b.enraged, gauge: Math.round(this.gauge * 10) / 10, endsAt: this.endsAt || 0 }; }
  stunNeed() { const B = BOSSES[this.boss.id]; return B.stunNeed ? B.stunNeed + Math.floor((this.P.size - 1) / 2) : 0; }
  go(now) {
    for (const P of this.P.values()) if (P.offer) this.pick(P.id, P.offer[0]);
    this.status = "play"; this.startsAt = now; this.endsAt = now + BOSSES[this.boss.id].time * 1000;
    this.boss.st = "IDLE"; this.nextAt = now + 1200;
    this.out("all", "phase", { st: "play", startsAt: now, endsAt: this.endsAt, boss: this.bossView() });
  }
  setSt(s) { this.boss.st = s; }
  choosePat(r) {
    const b = this.boss, B = BOSSES[b.id];
    if (b.stun > 0) return "stun";
    const list = (b.phase >= 3 && B.pats3) ? B.pats3 : (b.phase >= 2 && B.pats2) ? B.pats2 : B.pats;
    let tot = 0; for (const [, w] of list) tot += w; let x = r() * tot; for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[0][0];
  }
  tick(now) {
    if (this.status === "prep") { if (now >= this.prepEnd || (!this.anyOffer() && now >= this.startedAt + 1500)) this.go(now); return; }
    if (this.status !== "play") return;
    if (now >= this.endsAt && this.boss.st !== "PITCH" && this.boss.st !== "PHASE_CHANGE" && this.boss.st !== "RECOVERY") return this.end(now, "TIME");
    if (!this.boss.enraged && (this.endsAt - now < 60_000)) { this.boss.enraged = true; this.out("all", "boss", { ev: "enrage", boss: this.bossView() }); }
    const b = this.boss;
    switch (b.st) {
      case "IDLE": case "STUNNED": case "ENRAGED":
        if (now < this.nextAt) break;
        { const r = rng(mixSeed(this.seed, "pat", this.pc)); const pat = this.queue.shift() || this.choosePat(r);
          const p = bossPitch(++this.pc, b.id, pat, b.phase, r, { enraged: b.enraged, diff: { easy: 0.92, normal: 1, hard: 1.06 }[this.o.diff] });
          if (p.multi) this.queue.push("rocket");
          this.cur = p; this.rel = now + (pat === "rocket" && this.lastMulti ? 450 : RAID.windup); this.lastMulti = !!p.multi;
          for (const P of this.P.values()) { P.swung = false; P.res = null; }
          // 황금 공(증강): 5구마다 그 사람에게만
          this.gold = this.active().filter(P => (has(P, "e_goldball") && P.pn % 5 === 4) || P.buf.golden > 0).map(P => { if (P.buf.golden > 0) P.buf.golden--; return P.idx; });
          b.st = PATS[pat]?.atk ? "ATTACK" : "WINDUP";
          this.out("all", "windup", { pid: p.id, rel: this.rel, pat, atk: !!PATS[pat]?.atk, boss: this.bossView() });
          this.ph = "windup";
        }
        break;
      case "WINDUP": case "ATTACK":
        if (now >= this.rel) {
          b.st = "PITCH"; this.closeAt = closeAtOf(this.cur, this.rel);
          const h = {}; for (const P of this.active()) h[P.idx] = hintOf(batMods(P, this.ctx(P)));
          this.out("all", "pitch", { p: pubPitch(this.cur), rel: this.rel, h, gold: this.gold });
          for (const P of this.active()) if (P.ai || P.auto) { const plan = aiPlan(this.cur, "normal", rng(mixSeed(this.seed, "ai", this.pc, P.idx))); P.aiSw = plan ? { ...plan, at: this.rel + plan.dt } : null; }
        }
        break;
      case "PITCH": {
        for (const P of this.active()) if (P.aiSw && now >= P.aiSw.at && !P.swung) { const s = P.aiSw; P.aiSw = null; P.swung = true; this.hit(P, s, now); }
        const all = this.active().every(P => P.swung);
        if (now >= this.closeAt || (all && now >= this.rel + this.cur.T + 120)) this.close(now);
        break;
      }
      case "RECOVERY":
        if (now < this.nextAt) break;
        if (this.boss.hp <= 0) return this.end(now, "DEFEATED");
        if (this.gauge <= 0) return this.end(now, "WIPE");
        if (this.pendingPhase) { this.pendingPhase = false; this.phaseChange(now); break; }
        b.st = b.stun > 0 ? "STUNNED" : b.enraged ? "ENRAGED" : "IDLE"; this.nextAt = now + (this.queue.length ? 0 : RAID.idle);
        break;
      case "PHASE_CHANGE":
        if (now < this.nextAt) break;
        if (this.aug && !this.picking) { this.picking = true; let any = false; for (const P of this.active()) if (this.offer(P, now)) any = true; this.pickUntil = now + PICK_MS; if (any) break; }
        if (this.picking && this.anyOffer() && now < this.pickUntil) break;
        for (const P of this.P.values()) if (P.offer) this.pick(P.id, P.offer[0]);
        this.picking = false; this.endsAt += now - this.phaseAt; b.st = b.enraged ? "ENRAGED" : "IDLE"; this.nextAt = now + 800;
        this.out("all", "boss", { ev: "resume", boss: this.bossView() });
        break;
    }
  }
  ctx(P) { return { mode: "raid", team: this.active(), gaugeLow: this.gauge < 40, pitch: this.cur }; }
  swing(uid, sw0, now) {
    const P = this.P.get(uid); if (!P || P.left || this.status !== "play") return { ok: false, error: "NOT_PLAYING" };
    const sw = cleanSwing(sw0);
    if (this.boss.st !== "PITCH" || this.cur?.id !== sw.pid) return { ok: false, error: "NO_PITCH" };
    if (P.swung) return { ok: false, error: "DUP" };
    const f = fixDt(this.rel, sw.dt, now); sw.dt = f.dt; P.swung = true;
    this.hit(P, sw, now, f.flag); return { ok: true, flag: f.flag };
  }
  hit(P, sw, now, flag = null) {
    const p = this.cur, ctx = this.ctx(P), m = batMods(P, ctx), r = rng(mixSeed(this.seed, "hit", p.id, P.idx));
    const j = judgeSwing(p, sw, m); let dmg = 0, kind = "whiff", L = null, fx = [];
    if (p.fake) { kind = "fakeSwing"; }
    else if (j.contact) {
      L = launch(p, j, sw, m, r); fx = afterContact(P, ctx, j, L);
      const fl = flight({ ...L, foul: false }, { distMul: m.dist }); const hr = fl.hr || L.forceHr;
      kind = hr ? "hr" : j.grade;
      let d = DMG[j.grade]; if (hr) d *= 2.2;
      if ((p.weakMul) && (j.grade === "weak" || j.grade === "fair")) d *= p.weakMul;
      if (has(P, "c_lucky") && j.grade === "weak") d *= 2;
      let mul = m.mul * (p.hm || 1);
      if (this.gold.includes(P.idx)) { mul *= 3; fx.push("golden"); }
      P.combo++; P.best = Math.max(P.best, P.combo); mul *= 1 + Math.min(0.6, 0.06 * (P.combo - 1)) * (1 + 0.5 * st(P, "c_combo"));
      P.streak3++; if (has(P, "e_triple") && P.streak3 % 3 === 0) { mul *= 3; fx.push("triple"); }
      if (hr && has(P, "r_hrboom")) mul *= 1.6;
      if (hr && has(P, "l_dragon")) mul *= 1.5;
      if (hr && isMeteor(P, L, "hr")) { mul *= 2; fx.push("meteor"); }
      if (this.boss.shield > 0) { mul *= 0.25; if (j.grade === "perfect" || j.grade === "good" || hr) { this.boss.shield = Math.max(0, this.boss.shield - (j.grade === "perfect" || hr ? 2 : 1)); fx.push("shieldHit"); if (this.boss.shield === 0) this.out("all", "boss", { ev: "shieldBreak", i: P.idx, boss: this.bossView() }); } }
      if (this.boss.stun > 0) mul *= 2;
      if (P.frozen > 0) { mul *= 0.5; P.frozen--; if (P.frozen === 0) fx.push("thaw"); }
      dmg = Math.round(d * Math.min(CAP.dmg, mul));
      if (p.stun && (j.grade === "good" || j.grade === "perfect" || hr)) { this.boss.stunMeter++; fx.push("stunUp"); }
      // 회복
      let heal = 0; if (has(P, "r_heal") && (j.grade === "good" || j.grade === "perfect")) heal += (j.grade === "perfect" ? 4 : 2) * st(P, "r_heal"); if (has(P, "l_master")) heal += 1;
      if (heal) { this.gauge = Math.min(RAID.gauge, this.gauge + Math.min(6, heal)); fx.push("heal"); }
      P.hits++; if (j.grade === "perfect") P.perfect++; if (hr) P.hr++;
    } else { P.combo = 0; P.streak3 = 0; }
    if (dmg) { this.boss.hp = Math.max(0, this.boss.hp - dmg); P.dmg += dmg; }
    P.res = { kind, grade: j.contact ? j.grade : null, dmg, contact: j.contact && !p.fake };
    passPitch(P);
    this.out("all", "hit", { pid: p.id, i: P.idx, kind, dmg, fx, j: { c: j.contact, e: j.e, d: j.d, g: j.grade || j.why }, L, dm: m.dist, sw: { dt: sw.dt, x: sw.x, y: sw.y, pw: sw.pw }, flag, hp: this.boss.hp, gauge: Math.round(this.gauge * 10) / 10 });
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) });
  }
  close(now) {
    const p = this.cur, b = this.boss, act = this.active(), n = Math.max(1, act.length);
    let loss = 0; const missers = [];
    for (const P of act) {
      if (!P.res) { P.res = { kind: p.strike ? "take" : "takeBall", contact: false, dmg: 0 }; passPitch(P); if (p.strike) { P.combo = 0; P.streak3 = 0; } }
      const missed = (p.fake && P.res.kind === "fakeSwing") || (!p.fake && p.strike && !P.res.contact) || (!p.fake && !p.strike && P.res.kind === "whiff");
      if (!missed) { P.lastLoss = 0; continue; }
      P.miss++;
      let l = (p.md || 6) * RAID.shareMul * (BOSSES[b.id].loss || 1) / n * (P.res.kind === "whiff" && !p.strike ? 0.5 : 1);
      l *= 1 - 0.2 * st(P, "c_stance"); if (synergy(P).support >= 2) l *= 0.9;
      if (P.buf.inf > 0) l = 0;
      if (l > 0 && has(P, "e_undying") && P.undying < b.phase) { P.undying = b.phase; l = 0; this.out("all", "feed", { k: "undying", i: P.idx }); }
      if (p.freeze) P.frozen = 2;
      P.lastLoss = l; loss += l; missers.push(P.idx);
    }
    // 합동 공격
    const hitters = act.filter(P => P.res?.contact), sum = hitters.reduce((t, P) => t + P.res.dmg, 0); let joint = 0, combo = false;
    if (hitters.length >= 2 && sum > 0) {
      let k = Math.min(0.4, 0.1 * (hitters.length - 1));
      if (act.some(P => has(P, "e_teamhr"))) k += 0.4; if (act.some(P => synergy(P).support >= 3)) k += 0.15;
      if (hitters.length === act.length && hitters.every(P => P.res.grade === "perfect" || P.res.kind === "hr")) { k += 0.6; combo = true; }
      joint = Math.round(sum * k); b.hp = Math.max(0, b.hp - joint);
      for (const P of hitters) P.dmg += Math.round(joint * P.res.dmg / sum);
    }
    this.gauge = Math.max(0, this.gauge - loss);
    if (this.gauge <= 0) { const h = act.find(P => has(P, "l_miracle") && !P.used.miracle); if (h) { h.used.miracle = true; this.gauge = 35; this.out("all", "feed", { k: "miracle", i: h.idx }); } }
    if (b.stun > 0) b.stun--;
    if (this.stunNeed() && b.stunMeter >= this.stunNeed() && b.stun === 0) { b.stun = 3; b.stunMeter = 0; this.out("all", "boss", { ev: "stun", boss: this.bossView() }); }
    // 페이즈
    const B = BOSSES[b.id], th = B.phases[b.phase - 1];
    if (th !== undefined && b.hp > 0 && b.hp <= b.max * th) this.pendingPhase = true;
    b.st = "RECOVERY"; this.nextAt = now + RAID.recovery;
    this.out("all", "close", { pid: p.id, loss: Math.round(loss * 10) / 10, missers, joint, combo, hitters: hitters.map(P => P.idx), boss: this.bossView() });
  }
  phaseChange(now) {
    const b = this.boss, B = BOSSES[b.id]; b.phase++; b.st = "PHASE_CHANGE"; this.phaseAt = now; this.nextAt = now + RAID.phaseMs; b.stunMeter = 0;
    if (B.shield) b.shield = B.shield + 2 * this.P.size + 2;
    if (b.id === "cosmic" && b.phase >= 3) b.enraged = true;
    for (const P of this.P.values()) P.frozen = 0;
    this.out("all", "boss", { ev: "phase", boss: this.bossView() });
  }
  use(uid, id, now) {
    const P = this.P.get(uid); if (!P || this.status !== "play") return { ok: false, error: "NOT_PLAYING" };
    const canRewind = id === "l_rewind" && P.lastLoss > 0 && this.boss.st === "RECOVERY";
    const r = useAug(P, id, { canRewind }); if (!r.ok) return r;
    if (id === "l_rewind") { this.gauge = Math.min(RAID.gauge, this.gauge + P.lastLoss); P.lastLoss = 0; this.out("all", "feed", { k: "rewind", i: P.idx }); this.out("all", "boss", { ev: "gauge", boss: this.bossView() }); }
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P), used: id });
    if (AUG[id].rarity === "legendary") this.out("all", "feed", { k: "use", i: P.idx, id });
    return { ok: true };
  }
  stream(kind, uid, now) {
    const P = this.P.get(uid);
    if (kind === "event") { if (this.boss.stun > 0 || this.status !== "play") return { ok: false }; this.boss.stun = 2; this.out("all", "boss", { ev: "stun", don: true, boss: this.bossView() }); return { ok: true }; }
    if (!P) return { ok: false };
    if (kind === "buff") P.buf.donBuff = 5; else if (kind === "debuff") P.buf.donDebuff = 5; else if (kind === "golden") P.buf.golden = (P.buf.golden || 0) + 1; else return { ok: false };
    this.out(P.id, "augs", { augs: augView(P), buf: bufView(P) }); return { ok: true };
  }
  setAuto(uid, on) { const P = this.P.get(uid); if (P && !P.ai) { P.auto = !!on; if (on && P.offer) this.pick(uid, P.offer[0]); } }
  leave(uid, now) { const P = this.P.get(uid); if (!P) return; P.left = true; if (P.offer) this.pick(uid, P.offer[0]); if (!this.active().some(Q => !Q.ai)) this.end(now, "EMPTY"); }
  rows() { return [...this.P.values()].map(P => [P.idx, P.dmg, P.hits, P.perfect, P.hr, P.miss, P.combo, P.left ? 0 : 1, P.frozen, P.augs.length]); }
  snapshot(uid, now) {
    const P = this.P.get(uid);
    const base = { kind: "raid", status: this.status, o: this.o, aug: this.aug, prepEnd: this.prepEnd, startsAt: this.startsAt, endsAt: this.endsAt, boss: this.bossView(), rows: this.rows() };
    const cur = this.cur && (this.boss.st === "PITCH" || this.boss.st === "WINDUP" || this.boss.st === "ATTACK") ? { p: this.boss.st === "PITCH" ? pubPitch(this.cur) : null, pid: this.cur.id, rel: this.rel, pat: this.cur.pat, gold: this.gold, h: P ? { [P.idx]: hintOf(batMods(P, this.ctx(P))) } : {} } : null;
    if (!P) return { ...base, cur };
    return { ...base, cur, augs: augView(P), buf: bufView(P), offer: P.offer, offerUntil: P.offerUntil, me: { dmg: P.dmg, frozen: P.frozen, swung: !!P.swung } };
  }
  end(now, reason) {
    if (this.status === "ended") return; this.status = "ended"; this.boss.st = reason === "DEFEATED" ? "DEFEATED" : this.boss.st;
    const ps = [...this.P.values()].sort((a, b) => b.dmg - a.dmg), tot = ps.reduce((t, P) => t + P.dmg, 0) || 1;
    this.result = { kind: "raid", reason, win: reason === "DEFEATED", boss: this.bossView(), time: Math.round((now - (this.startsAt || now)) / 1000),
      rows: ps.map((P, k) => ({ place: k + 1, id: P.id, idx: P.idx, name: P.name, dmg: P.dmg, share: Math.round(P.dmg / tot * 100), hits: P.hits, perfect: P.perfect, hr: P.hr, miss: P.miss, best: P.best, augs: P.augs.map(a => a.id) })), mvp: ps[0]?.idx ?? -1 };
    this.out("all", "end", this.result);
  }
}
