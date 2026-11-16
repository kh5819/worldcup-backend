// =========================
// 플듀 증강 오셀로 — 한 판 진행 (2026-11-16)
// 규칙: othello-core.js / 증강: othello-augs.js. 시계·증강 고르기·패스·증강 효과·결과
// ply = 차례 수(패스 포함, 연속 착수 중엔 안 늘어남) · moves = 놓은 돌 수
// =========================
import { BK, WH, opp, FOREVER, CORNERS, isCorner, isEdge, isFixed, flipsFor, legalMoves, hasMove, count, emptyCount, adjEmpty, cloneState, initialState, sqName, NEIGH } from "./othello-core.js";
import { AUG, rollOffer, targets, area, sweepList, chainTarget, bombTargets, comebackTargets, reversalTargets, goldTargets, bestBy } from "./othello-augs.js";

export const MAX_AUGS = 3, PICK_AT = [0, 16, 36], PICK_MS = 15000;
const TURN_ACTIONS = ["ghost", "godHand", "rewind"];
const clonePlayers = (P) => { const c = (p) => ({ ...p, augs: p.augs.map(a => ({ ...a })), used: { ...p.used }, stat: { ...p.stat }, offer: p.offer ? [...p.offer] : null }); return { b: c(P.b), w: c(P.w) }; };
const newP = () => ({ augs: [], offer: null, picked: true, refresh: 1, used: {}, stat: { collector: 0, maxFlip: 0, corners: 0 } });

export class OthelloGame {
  constructor(opts = {}, rng = Math.random, now = Date.now) {
    this.rng = rng; this.now = now;
    this.mode = opts.mode === "augment" ? "augment" : "classic";
    this.base = Math.max(0, opts.base || 0); this.inc = Math.max(0, opts.inc || 0);
    this.S = initialState(); this.P = { b: newP(), w: newP() };
    this.clock = { b: this.base, w: this.base }; this.tickAt = 0;
    this.phase = "init"; this.pickIdx = -1; this.pickDeadline = 0;
    this.armed = { b: null, w: null }; this.extraLeft = 0; this.freeUsed = false; this.forbid = null;
    this.breathMode = false; this.mustChoose = false; this.passes = 0;
    this.hist = []; this.last = null; this.lastPlacer = null; this.result = null; this.events = []; this._legal = null;
  }
  emit(type, d = {}) { this.events.push({ type, ...d }); if (this.events.length > 300) this.events.shift(); }
  drain() { const e = this.events; this.events = []; return e; }
  has(c, id) { return this.mode === "augment" && this.P[c].augs.some(a => a.id === id); }
  aug(c, id) { return this.P[c].augs.find(a => a.id === id); }
  charged(c, id) { const a = this.aug(c, id); return !!a && (a.charges === null || a.charges > 0); }
  useCharge(c, id) { const a = this.aug(c, id); if (a && a.charges !== null) a.charges = Math.max(0, a.charges - 1); this.P[c].used[id] = (this.P[c].used[id] || 0) + 1; }

  // ---------------- 진행 ----------------
  start() { if (this.mode === "augment") this.startPick(0); else { this.phase = "play"; this.emit("start"); this.turnStart(); } }
  startPick(idx) {
    this.stopClock();
    this.phase = "pick"; this.pickIdx = idx; this.pickDeadline = this.now() + PICK_MS;
    for (const c of [BK, WH]) { const p = this.P[c]; p.offer = p.augs.length < MAX_AUGS ? rollOffer(idx, p.augs.map(a => a.id), this.rng) : []; p.picked = !p.offer.length; p.refresh = 1; }
    this.emit("pick", { idx });
    if (this.P.b.picked && this.P.w.picked) this.endPick();
  }
  pick(c, id, auto = false) {
    const p = this.P[c];
    if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (!p.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    const d = AUG[id];
    p.augs.push({ id, charges: d.charges ?? null }); p.picked = true; p.offer = null;
    if (d.kind === "instant") this.applyInstant(c, id);
    this.emit("picked", { c, id, auto });
    if (this.P.b.picked && this.P.w.picked) this.endPick();
    return { ok: true };
  }
  refreshOffer(c) {
    const p = this.P[c];
    if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    p.refresh--; p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng, 3, p.offer);
    return { ok: true };
  }
  autoPick() { for (const c of [BK, WH]) { const p = this.P[c]; if (!p.picked && p.offer?.length) this.pick(c, bestOffer(p.offer), true); } }
  endPick() { this.phase = "play"; this.pickDeadline = 0; this._legal = null; this.emit("resume"); this.turnStart(); }
  applyInstant(c, id) {
    const S = this.S, sq = [];
    if (id === "lucky") S.pts[c] += 3;
    else if (id === "timeBank") { if (this.base) this.clock[c] += 60000; else S.pts[c] += 2; }
    else if (id === "fortress") { for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && isEdge(s)) { S.b[s].fix = FOREVER; sq.push(s); } }
    else if (id === "goldRush") { for (const s of goldTargets(S, c)) { S.b[s].gold = true; sq.push(s); } }
    else if (id === "kingCorner") { for (const s of CORNERS) if (!S.b[s]) { S.blocks.push({ sq: s, until: S.ply + 16, only: opp(c), by: c }); sq.push(s); } }
    this.P[c].used[id] = 1; this._legal = null;
    this.emit("aug", { c, id, squares: sq, instant: true });
  }
  stopClock() { if (this.phase === "play" && this.base && this.tickAt) this.clock[this.S.turn] -= this.now() - this.tickAt; this.tickAt = 0; }
  tick() {
    if (this.phase !== "play" || !this.base || !this.tickAt) return false;
    const c = this.S.turn; if (this.clock[c] - (this.now() - this.tickAt) > 0) return false;
    this.clock[c] = 0; this.finish(opp(c), "timeout"); return true;
  }
  timeLeft(c) { if (!this.base) return null; return this.phase === "play" && this.S.turn === c && this.tickAt ? Math.max(0, this.clock[c] - (this.now() - this.tickAt)) : this.clock[c]; }

  // ---------------- 둘 수 있는 칸 ----------------
  legal(c = this.S.turn) {
    if (this.phase !== "play" || c !== this.S.turn) return [];
    if (this._legal) return this._legal;
    let list;
    if (this.breathMode) list = adjEmpty(this.S, c).map(sq => ({ sq, flips: [], breath: true }));
    else list = legalMoves(this.S, c);
    if (this.forbid && this.forbid.c === c) list = list.filter(m => m.sq !== this.forbid.sq);
    return (this._legal = list);
  }
  place(c, sq) {
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (this.S.turn !== c) return { ok: false, error: "NOT_YOUR_TURN" };
    const mv = this.legal(c).find(m => m.sq === sq);
    if (!mv) return { ok: false, error: "ILLEGAL" };
    const before = this.snapshot();
    const breath = !!mv.breath;
    if (breath) { this.useCharge(c, "breath"); this.breathMode = false; }
    const armed = this.armed[c]; this.armed[c] = null;
    const r = this.putStone(c, sq, mv.flips, armed);
    const rec = { type: "place", c, sq, san: sqName(sq) + (breath ? "·숨통" : ""), flips: r.flipped, extra: r.extra, armed: armed || null, breath };
    this.hist.push({ before, rec });
    if (this.forbid && this.forbid.c === c) this.forbid = null;
    this.emit("place", { c, sq, flips: mv.flips, extra: r.extra, armed: armed || null, restored: r.restored, breath });
    this._legal = null;
    if (armed === "doubleMove") this.extraLeft += 1;
    if (armed === "timeStop") this.extraLeft += 2;
    if (this.extraLeft > 0) {
      if (emptyCount(this.S) && legalMoves(this.S, c).length) { this.extraLeft--; this.inExtra = true; this.emit("extra", { c, left: this.extraLeft }); return { ok: true, extra: true }; }
      this.extraLeft = 0;
    }
    this.endTurn(c);
    return { ok: true };
  }
  /** 돌 놓기 + 켜 둔 증강·자동 증강 (place·유령·신의 손 공용) */
  putStone(c, sq, flips, armed = null) {
    const S = this.S, o = opp(c);
    S.b[sq] = { c };
    for (const s of flips) S.b[s].c = c;
    const extra = [];
    const flipExtra = (list) => { for (const s of list) if (S.b[s] && S.b[s].c === o && !isFixed(S, s) && !isCorner(s)) { S.b[s].c = c; extra.push(s); } };
    if (armed === "fixStone") S.b[sq].fix = S.ply + 6;
    if (armed === "anchor") S.b[sq].fix = FOREVER;
    if (armed === "chain") flipExtra(chainTarget(S, c, sq));
    if (armed === "bomb") flipExtra(bombTargets(S, c, sq));
    if (isCorner(sq)) {
      this.P[c].stat.corners++;
      if (this.has(o, "cornerTax")) { S.pts[o] += 2; this.P[o].used.cornerTax = (this.P[o].used.cornerTax || 0) + 1; this.emit("bonus", { c: o, id: "cornerTax", pts: 2 }); }
      if (this.has(c, "plague")) { const before = extra.length; for (const n of NEIGH[sq]) if (S.b[n] && S.b[n].c === o && !isFixed(S, n)) { S.b[n].c = c; extra.push(n); } if (extra.length > before) this.P[c].used.plague = (this.P[c].used.plague || 0) + 1; }
    }
    const flipped = [...flips, ...extra];
    if (armed === "inspire") for (const s of flipped) S.b[s].fix = Math.max(S.b[s].fix || 0, S.ply + 4);
    if (flipped.length > this.P[c].stat.maxFlip) this.P[c].stat.maxFlip = flipped.length;
    if (this.has(c, "collector") && flipped.length >= 5 && this.P[c].stat.collector < 6) { this.P[c].stat.collector++; S.pts[c] += 1; this.P[c].used.collector = (this.P[c].used.collector || 0) + 1; this.emit("bonus", { c, id: "collector", pts: 1 }); }
    let restored = [];
    if (flipped.length >= 6 && this.charged(o, "firstAid") && this.has(o, "firstAid")) {
      restored = bestBy(flipped.filter(s => !isFixed(S, s)), 2);
      for (const s of restored) S.b[s].c = o;
      this.useCharge(o, "firstAid"); this.emit("aug", { c: o, id: "firstAid", squares: restored, auto: true });
    }
    S.moves++; this.lastPlacer = c;
    this.last = { sq, flips: flipped.filter(s => !restored.includes(s)) };
    return { flipped, extra, restored };
  }
  /** 증강 사용 (arm·free·action) */
  action(c, id, sq = null) {
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (this.S.turn !== c) return { ok: false, error: "NOT_YOUR_TURN" };
    const a = this.aug(c, id), d = AUG[id];
    if (!a || !d) return { ok: false, error: "NO_AUG" };
    if (!["arm", "free", "action"].includes(d.kind)) return { ok: false, error: "PASSIVE" };
    if (a.charges !== null && a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
    if (d.minMoves && this.S.moves < d.minMoves) return { ok: false, error: "TOO_EARLY" };
    const S = this.S, o = opp(c);
    if (d.kind === "arm") {
      if (this.armed[c]) return { ok: false, error: "ALREADY_ARMED" };
      if (this.breathMode || !this.legal(c).length) return { ok: false, error: "NO_MOVE" };
      this.armed[c] = id; this.useCharge(c, id);
      this.emit("aug", { c, id, armed: true });
      return { ok: true, armed: true };
    }
    if (d.kind === "free" && this.freeUsed) return { ok: false, error: "FREE_USED" };
    if (d.kind === "action" && this.extraLeft > 0) return { ok: false, error: "EXTRA_MOVE" };
    if (id === "rewind") return this.rewind(c);
    if (d.target) { if (!Number.isInteger(sq) || !targets(S, c, id).includes(sq)) return { ok: false, error: "BAD_TARGET" }; }
    const before = this.snapshot();
    let squares = [sq].filter(x => x !== null && x !== undefined);
    switch (id) {
      case "wall": S.blocks.push({ sq, until: S.ply + 4 }); break;
      case "cornerSeal": S.blocks.push({ sq, until: S.ply + 6 }); break;
      case "reserve": S.blocks.push({ sq, until: S.ply + 8, only: o, by: c }); break;
      case "guard": S.b[sq].fix = Math.max(S.b[sq].fix || 0, S.ply + 6); break;
      case "steal": S.b[sq].c = c; break;
      case "eraser": S.b[sq] = null; break;
      case "freeze": S.frozen = { c: o, ply: S.ply + 1 }; squares = []; break;
      case "blackhole": squares = area(sq).filter(q => S.b[q] && !isCorner(q)); for (const q of squares) S.b[q] = null; break;
      case "sweep": squares = sweepList(S, c, sq); for (const q of squares) S.b[q].c = c; break;
      case "ghost": this.putStone(c, sq, []); break;
      case "godHand": { const fl = flipsFor(S, c, sq); this.putStone(c, sq, fl); squares = [sq, ...fl]; break; }
      default: return { ok: false, error: "NO_AUG" };
    }
    this.useCharge(c, id);
    const rec = { type: d.kind, c, id, sq, san: `✦${d.name}${sq !== null && sq !== undefined && d.target ? " " + sqName(sq) : ""}`, squares };
    this.hist.push({ before, rec });
    this.emit("aug", { c, id, sq, squares });
    this._legal = null;
    if (d.kind === "action") { if (this.forbid && this.forbid.c === c) this.forbid = null; this.endTurn(c); return { ok: true }; }
    this.freeUsed = true;
    if (!this.legal(c).length) { // 쓰고 나니 둘 곳이 없으면 다시 판단 (숨통·차례 증강·패스)
      if (!this.stuckCheck(c)) return { ok: true };
    } else this.mustChoose = false;
    return { ok: true };
  }
  /** 되감을 상대 수 위치 (이번 차례에 내가 쓴 칸 증강은 건너뜀) */
  rewindIdx(c) { let i = this.hist.length - 1; while (i >= 0 && this.hist[i].rec.c === c && this.hist[i].rec.type === "free") i--; return i; }
  canRewind(c) { const i = this.rewindIdx(c), h = this.hist[i]; return i >= 0 && !!h && h.rec.c === opp(c) && h.rec.type === "place" && h.before?.pk === this.pickIdx && this.extraLeft === 0; }
  rewind(c) {
    if (!this.canRewind(c)) return { ok: false, error: "NOTHING_TO_UNDO" };
    const n = this.rewindIdx(c) + 1, target = this.hist[n - 1];
    this.chargeClock(c);
    const clock = { ...this.clock };
    this.restore(target.before); // 상대가 두기 직전으로 통째로 (그 뒤 내가 켜거나 쓴 증강도 함께 돌아옴)
    this.clock = clock;
    this.hist.length = n - 1;
    this.useCharge(c, "rewind");
    this.forbid = { c: opp(c), sq: target.rec.sq };
    this.last = null;
    this.emit("aug", { c, id: "rewind", squares: [target.rec.sq], undone: target.rec.san });
    this.hist.push({ before: null, rec: { type: "action", c, id: "rewind", san: "✦되감기", undo: true } });
    this.turnStart(true);
    return { ok: true };
  }
  pass(c) {
    if (this.phase !== "play" || this.S.turn !== c) return { ok: false, error: "NOT_YOUR_TURN" };
    if (this.legal(c).length) return { ok: false, error: "HAS_MOVE" };
    this.endTurn(c, true); return { ok: true };
  }
  chargeClock(c) { if (this.base && this.tickAt) { this.clock[c] -= this.now() - this.tickAt; this.clock[c] += this.inc; } this.tickAt = this.now(); }
  snapshot() { return { pk: this.pickIdx, S: cloneState(this.S), P: clonePlayers(this.P), armed: { ...this.armed }, extraLeft: this.extraLeft, inExtra: !!this.inExtra, freeUsed: this.freeUsed, forbid: this.forbid ? { ...this.forbid } : null, last: this.last, lastPlacer: this.lastPlacer, breathMode: this.breathMode, passes: this.passes }; }
  restore(s) { this.S = cloneState(s.S); this.P = clonePlayers(s.P); this.armed = { ...s.armed }; this.extraLeft = s.extraLeft; this.inExtra = !!s.inExtra; this.freeUsed = s.freeUsed; this.forbid = s.forbid; this.last = s.last; this.lastPlacer = s.lastPlacer; this.breathMode = s.breathMode; this.passes = s.passes; this.mustChoose = false; this._legal = null; }

  /** 한쪽 차례 끝 */
  endTurn(c, passed = false) {
    this.chargeClock(c);
    if (this.armed[c]) { const a = this.aug(c, this.armed[c]); if (a && a.charges !== null) a.charges++; this.P[c].used[this.armed[c]] = Math.max(0, (this.P[c].used[this.armed[c]] || 1) - 1); this.armed[c] = null; } // 안 쓴 준비는 돌려줌
    if (passed) {
      if (this.hist.length < 400) this.hist.push({ before: this.snapshot(), rec: { type: "pass", c, san: "패스" } });
      if (this.has(c, "passBonus")) { this.S.pts[c] += 3; this.P[c].used.passBonus = (this.P[c].used.passBonus || 0) + 1; }
      this.emit("pass", { c, bonus: this.has(c, "passBonus") ? 3 : 0 });
      this.passes++;
    } else this.passes = 0;
    if (this.forbid && this.forbid.c === c) this.forbid = null;
    const S = this.S; S.ply++; S.turn = opp(c);
    S.blocks = S.blocks.filter(k => k.until > S.ply);
    if (S.frozen && S.frozen.ply < S.ply) S.frozen = null;
    this.extraLeft = 0; this.inExtra = false; this.freeUsed = false; this.breathMode = false; this.mustChoose = false; this._legal = null;
    if (this.mode === "augment" && this.pickIdx < PICK_AT.length - 1 && S.moves >= PICK_AT[this.pickIdx + 1] && (this.P.b.augs.length < MAX_AUGS || this.P.w.augs.length < MAX_AUGS) && emptyCount(S) > 2) { this.startPick(this.pickIdx + 1); return; }
    this.turnStart();
  }
  /** 차례 시작: 자동 증강 → 끝났는지 → 둘 곳 없으면 숨통·선택·패스 */
  turnStart(skipAuto = false) {
    const S = this.S, c = S.turn, o = opp(c);
    this.tickAt = this.now(); this._legal = null; this.mustChoose = false;
    if (!skipAuto && this.mode === "augment") {
      const n = count(S), mine = n[c], theirs = n[o];
      if (this.charged(c, "comeback") && this.has(c, "comeback") && theirs - mine >= 12 && mine > 0) {
        const t = comebackTargets(S, c); for (const s of t) S.b[s].c = c; S.pts[c] += 2; this.useCharge(c, "comeback");
        this.emit("aug", { c, id: "comeback", squares: t, auto: true });
      }
      const n2 = count(S);
      if (this.charged(c, "reversal") && this.has(c, "reversal") && n2[c] > 0 && n2[c] * 2 <= n2[o] && S.moves >= 10) {
        const t = reversalTargets(S, c); for (const s of t) S.b[s].c = c; this.useCharge(c, "reversal");
        this.emit("aug", { c, id: "reversal", squares: t, auto: true });
      }
    }
    if (!emptyCount(S) || (!hasMove(S, c) && !hasMove(S, o)) || this.passes >= 2) { this.finishByScore(); return; }
    if (!this.legal(c).length) this.stuckCheck(c);
  }
  /** 둘 곳이 없을 때: 숨통 → 차례 증강 선택 → 자동 패스. 패스했으면 false */
  stuckCheck(c) {
    if (this.has(c, "breath") && this.charged(c, "breath") && adjEmpty(this.S, c).length) { this.breathMode = true; this._legal = null; this.emit("breath", { c }); return true; }
    if (this.mode === "augment" && TURN_ACTIONS.some(id => this.actionOk(c, id))) { this.mustChoose = true; this.emit("stuck", { c }); return true; }
    this.endTurn(c, true); return false;
  }
  actionOk(c, id) {
    const a = this.aug(c, id), d = AUG[id]; if (!a || !d) return false;
    if (a.charges !== null && a.charges <= 0) return false;
    if (d.minMoves && this.S.moves < d.minMoves) return false;
    if (id === "rewind") return this.canRewind(c);
    if (d.kind === "arm") return !this.armed[c] && !this.breathMode && this.legal(c).length > 0;
    if (d.kind === "free" && this.freeUsed) return false;
    if (d.kind === "action" && this.extraLeft > 0) return false;
    return d.target ? targets(this.S, c, id).length > 0 : true;
  }
  /** 점수 계산 (끝날 때 보너스 포함) */
  scores() {
    const S = this.S, n = count(S), out = {};
    for (const c of [BK, WH]) {
      const bonus = { pts: S.pts[c], gold: 0, edge: 0, corner: 0, last: 0 };
      for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && S.b[s].gold) bonus.gold += 2;
      if (this.has(c, "edgeBonus")) { let e = 0; for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && isEdge(s) && !isCorner(s)) e++; bonus.edge = Math.floor(e / 3); }
      if (this.has(c, "conqueror")) bonus.corner = CORNERS.filter(s => S.b[s]?.c === c).length * 3;
      if (this.has(c, "lastWord") && this.lastPlacer === c && !emptyCount(S)) bonus.last = 4;
      const extra = bonus.pts + bonus.gold + bonus.edge + bonus.corner + bonus.last;
      out[c] = { discs: n[c], bonus, extra, total: n[c] + extra };
    }
    return out;
  }
  finishByScore() {
    const sc = this.scores();
    const w = sc.b.total > sc.w.total ? BK : sc.w.total > sc.b.total ? WH : null;
    this.finish(w, "end");
  }
  resign(c) { if (this.phase === "over") return { ok: false, error: "OVER" }; this.finish(opp(c), "resign"); return { ok: true }; }
  finish(winner, reason) {
    if (this.phase === "over") return;
    this.stopClock(); this.phase = "over";
    this.result = { winner, reason, scores: this.scores(), moves: this.S.moves };
    this.emit("over", this.result);
  }

  // ---------------- 화면용 ----------------
  publicState(viewer) {
    const S = this.S, mine = viewer === BK || viewer === WH ? viewer : null;
    const seeAll = !mine || this.phase === "over";
    const peek = mine && this.has(mine, "peek");
    const discs = [];
    for (let s = 0; s < 64; s++) { const d = S.b[s]; if (d) discs.push({ s, c: d.c, fix: d.gold ? 0 : d.fix >= FOREVER ? -1 : (d.fix || 0) > S.ply ? Math.ceil((d.fix - S.ply) / 2) : 0, gold: !!d.gold }); }
    const blocks = S.blocks.filter(k => k.until > S.ply).map(k => ({ sq: k.sq, left: k.until >= FOREVER ? -1 : Math.ceil((k.until - S.ply) / 2), only: k.only || null }));
    const myTurn = mine && this.phase === "play" && S.turn === mine;
    const legal = myTurn ? this.legal(mine).map(m => ({ sq: m.sq, n: m.flips.length, breath: !!m.breath })) : null;
    const oppLegal = peek && this.phase === "play" ? legalMoves(S, opp(mine)).map(m => m.sq) : null;
    const sc = this.scores();
    const pl = (c) => {
      const p = this.P[c], show = seeAll || c === mine || peek;
      return {
        augs: p.augs.map(a => (show || p.used[a.id] ? { id: a.id, charges: a.charges } : { hidden: true, rarity: AUG[a.id].rarity })),
        picking: this.phase === "pick" && !p.picked, armed: this.armed[c], clock: this.timeLeft(c),
        discs: sc[c].discs, extra: sc[c].extra, total: sc[c].total,
        offer: this.phase === "pick" && !p.picked && c === mine ? p.offer : null, refresh: c === mine ? p.refresh : 0,
      };
    };
    return {
      mode: this.mode, phase: this.phase, turn: S.turn, ply: S.ply, moves: S.moves, empty: emptyCount(S), pickIdx: this.pickIdx, pickDeadline: this.pickDeadline || null,
      discs, blocks, last: this.last, legal, oppLegal, frozen: S.frozen && S.frozen.ply >= S.ply ? S.frozen.c : null,
      players: { b: pl(BK), w: pl(WH) }, actions: myTurn && this.mode === "augment" ? this.actionList(mine) : null,
      extraLeft: this.extraLeft, inExtra: !!this.inExtra, freeUsed: this.freeUsed, breathMode: myTurn ? this.breathMode : false, mustChoose: myTurn ? this.mustChoose : false,
      forbid: this.forbid && this.forbid.c === mine ? this.forbid.sq : null,
      log: this.hist.slice(-120).map(h => ({ c: h.rec.c, san: h.rec.san, type: h.rec.type })),
      result: this.result, base: this.base, inc: this.inc, timed: !!this.base,
    };
  }
  actionList(c) {
    const out = {};
    for (const a of this.P[c].augs) {
      const d = AUG[a.id]; if (!["arm", "free", "action"].includes(d.kind)) continue;
      if (a.charges !== null && a.charges <= 0) continue;
      if (d.minMoves && this.S.moves < d.minMoves) { out[a.id] = { ok: false, why: `${d.minMoves}수부터` }; continue; }
      if (d.kind === "free" && this.freeUsed) { out[a.id] = { ok: false, why: "이번 차례에 이미 씀" }; continue; }
      const ok = this.actionOk(c, a.id);
      out[a.id] = { ok, cands: ok && d.target ? targets(this.S, c, a.id) : [], armed: this.armed[c] === a.id, why: ok ? "" : a.id === "rewind" ? "무를 수가 없음" : d.kind === "arm" ? (this.armed[c] ? "다른 증강 준비 중" : "둘 곳이 없음") : "대상 없음" };
    }
    return out;
  }
  replay() {
    const frames = [];
    for (const h of this.hist) if (h.before && h.rec.type !== "pass") frames.push({ rec: h.rec, discs: h.before.S.b.map((d, s) => d && { s, c: d.c }).filter(Boolean) });
    frames.push({ rec: null, discs: this.S.b.map((d, s) => d && { s, c: d.c }).filter(Boolean) });
    return frames;
  }
}
function bestOffer(offer) { const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }; return [...offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0]; }
export { sqName };
