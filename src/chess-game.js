// =========================
// 플듀 증강 체스 — 한 판 진행 (2026-11-16)
// 규칙: chess-core.js / 증강: chess-augs.js. 시계·증강 고르기·무승부·되돌리기형 증강·결과
// =========================
import { W, B, opp, applyMove, legalMoves, pseudoMoves, inCheck, insufficient, posKey, san, cloneState, initialState, sqName } from "./chess-core.js";
import { AUG, AUGS, rollOffer, modsFor, MOVE_AUG, candidates, applyAction, applyInstant, material } from "./chess-augs.js";

export const MAX_AUGS = 3, PICK_FULL = [1, 11, 21], PICK_MS = 15000;
const BOARD_ACTIONS = AUGS.filter(a => a.kind === "action" && !["rewind", "timeMaster"].includes(a.id)).map(a => a.id);
const clonePlayers = (P) => ({ w: { ...P.w, augs: P.w.augs.map(a => ({ ...a })), used: { ...P.w.used } }, b: { ...P.b, augs: P.b.augs.map(a => ({ ...a })), used: { ...P.b.used } } });

export class ChessGame {
  /** opts: { mode: "classic"|"augment", base: ms(0=무제한), inc: ms } */
  constructor(opts = {}, rng = Math.random, now = Date.now) {
    this.rng = rng; this.now = now;
    this.mode = opts.mode === "augment" ? "augment" : "classic";
    this.base = Math.max(0, opts.base || 0); this.inc = Math.max(0, opts.inc || 0);
    this.S = initialState();
    this.P = { w: newP(), b: newP() };
    this.clock = { w: this.base, b: this.base }; this.tickAt = 0;
    this.phase = "init"; this.pickIdx = -1; this.pickDeadline = 0;
    this.hist = []; this.keys = [posKey(this.S, this.augSig())];
    this.armed = { w: null, b: null }; this.extra = null; this.forbid = null; this.drawOffer = null;
    this.result = null; this.events = []; this.last = null; this._legal = null;
  }
  get mods() { return { w: modsFor(this.P.w.augs), b: modsFor(this.P.b.augs) }; }
  augSig() { return ["w", "b"].map(c => this.P[c].augs.map(a => a.id[0] + a.id.length + (a.charges ?? "")).join("") + (this.armed?.[c] || "")).join("/"); }
  emit(type, d = {}) { this.events.push({ type, ...d }); if (this.events.length > 200) this.events.shift(); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---------------- 진행 ----------------
  start() {
    if (this.mode === "augment") this.startPick(0);
    else { this.phase = "play"; this.tickAt = this.now(); this.emit("start"); }
  }
  startPick(idx) {
    this.stopClock();
    this.phase = "pick"; this.pickIdx = idx; this.pickDeadline = this.now() + PICK_MS;
    for (const c of [W, B]) { const p = this.P[c]; p.offer = rollOffer(idx, p.augs.map(a => a.id), this.rng); p.picked = !p.offer.length; p.refresh = 1; }
    this.emit("pick", { idx });
    if (this.P.w.picked && this.P.b.picked) this.endPick();
  }
  pick(c, id, auto = false) {
    const p = this.P[c];
    if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (!p.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    const a = AUG[id];
    p.augs.push({ id, charges: a.charges ?? null }); p.picked = true; p.offer = null;
    if (a.kind === "instant") { applyInstant(this.S, c, id); p.used[id] = 1; }
    this.emit("picked", { c, id, auto });
    if (this.P.w.picked && this.P.b.picked) this.endPick();
    return { ok: true };
  }
  refreshOffer(c) {
    const p = this.P[c];
    if (this.phase !== "pick" || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    p.refresh--; p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng, 3, p.offer);
    return { ok: true };
  }
  autoPick() { for (const c of [W, B]) { const p = this.P[c]; if (!p.picked && p.offer?.length) this.pick(c, bestOffer(p.offer), true); } }
  endPick() {
    this.phase = "play"; this.pickDeadline = 0; this._legal = null;
    this.keys = [posKey(this.S, this.augSig())]; // 증강이 바뀌면 반복 판정은 새로 셈
    this.tickAt = this.now();
    this.emit("resume");
    this.afterTurnStart();
  }
  stopClock() { if (this.phase === "play" && this.base && this.tickAt) { const c = this.S.turn; this.clock[c] -= this.now() - this.tickAt; } this.tickAt = 0; }
  /** 시계 확인 (밖에서 주기적으로 부름) — 시간 끝이면 결과 */
  tick() {
    if (this.phase !== "play" || !this.base || !this.tickAt) return false;
    const c = this.S.turn, left = this.clock[c] - (this.now() - this.tickAt);
    if (left > 0) return false;
    this.clock[c] = 0;
    // 상대가 체크메이트할 기물이 없으면 무승부
    const oppMat = this.S.b.filter(p => p && p.c === opp(c) && p.t !== "k");
    const cantMate = !oppMat.length || (oppMat.length === 1 && "nb".includes(oppMat[0].t) && this.mode === "classic");
    this.finish(cantMate ? null : opp(c), cantMate ? "timeoutDraw" : "timeout");
    return true;
  }
  timeLeft(c) { if (!this.base) return null; return this.phase === "play" && this.S.turn === c && this.tickAt ? Math.max(0, this.clock[c] - (this.now() - this.tickAt)) : this.clock[c]; }

  // ---------------- 수 ----------------
  legal(c = this.S.turn) {
    if (c !== this.S.turn) return [];
    if (this._legal) return this._legal;
    let list;
    if (this.extra) {
      const ex = this.extra;
      list = pseudoMoves(this.S, c, this.mods).filter(mv => !mv.castle && (ex.allowCap || mv.cap === undefined)).filter(mv => { const T = applyMove(this.S, mv); return !inCheck(T, c, this.mods) && !inCheck(T, opp(c), this.mods); });
    } else list = legalMoves(this.S, c, this.mods);
    if (this.forbid && this.forbid.c === c) list = list.filter(mv => !(mv.from === this.forbid.from && mv.to === this.forbid.to && (mv.promo || null) === (this.forbid.promo || null)));
    return (this._legal = list);
  }
  move(c, { from, to, promo } = {}) {
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (this.S.turn !== c) return { ok: false, error: "NOT_YOUR_TURN" };
    const mv = this.legal(c).find(m => m.from === from && m.to === to && (m.promo ? m.promo === (promo || "q") : true));
    if (!mv) return { ok: false, error: "ILLEGAL" };
    const before = this.snapshot();
    const label = san(this.S, mv, this.legal(c));
    const captured = mv.cap !== undefined && !mv.block ? this.S.b[mv.cap] : null;
    this.chargeClock(c);
    this.S = applyMove(this.S, mv);
    if (mv.aug && MOVE_AUG[mv.aug]) this.useCharge(c, mv.aug);
    if (mv.aug) this.P[c].used[mv.aug] = (this.P[c].used[mv.aug] || 0) + 1;
    const rec = { type: "move", c, from, to, promo: mv.promo || null, san: label, cap: captured ? captured.t : null, block: !!mv.block, castle: mv.castle || null, ep: !!mv.ep, aug: mv.aug || null, trap: this.S.trapHit || null };
    delete this.S.trapHit;
    this.hist.push({ before, rec });
    this.last = { from, to };
    this.forbid = this.forbid && this.forbid.c === c ? null : this.forbid;
    this.emit("move", rec);
    // 이중 행동 / 신의 한 수
    const wasExtra = !!this.extra; this.extra = null; this._legal = null;
    if (!wasExtra && this.armed[c]) {
      const allowCap = this.armed[c] === "god"; this.armed[c] = null;
      if (!this.endIfOver(opp(c), true)) {
        this.S.turn = c; this.S.ep = null; this.extra = { c, allowCap }; this._legal = null;
        if (this.legal(c).length) { this.emit("extra", { c }); this.tickAt = this.now(); return { ok: true, extra: true }; }
        this.extra = null; this.S.turn = opp(c); this._legal = null;
      } else return { ok: true };
    }
    this.afterTurn(c);
    return { ok: true };
  }
  /** 증강 행동 */
  action(c, id, pl = {}) {
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (this.S.turn !== c) return { ok: false, error: "NOT_YOUR_TURN" };
    if (this.extra) return { ok: false, error: "EXTRA_MOVE" };
    const a = this.P[c].augs.find(x => x.id === id), def = AUG[id];
    if (!a || !def) return { ok: false, error: "NO_AUG" };
    if (def.kind !== "action" && def.kind !== "arm") return { ok: false, error: "PASSIVE" };
    if (a.charges !== null && a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
    if (def.minFull && this.S.full < def.minFull) return { ok: false, error: "TOO_EARLY" };
    const cand = candidates(this, c, id).find(x => Object.keys(x).every(k => x[k] === pl[k]));
    if (!cand) return { ok: false, error: "BAD_TARGET" };
    if (def.kind === "arm") {
      this.armed[c] = id === "godMove" ? "god" : "double"; this.useCharge(c, id); this.P[c].used[id] = 1; this._legal = null;
      this.emit("aug", { c, id, armed: true });
      return { ok: true, armed: true };
    }
    if (id === "rewind" || id === "timeMaster") return this.undoAction(c, id);
    const r = applyAction(this, c, id, cand, this.rng);
    if (!r) return { ok: false, error: "UNSAFE" };
    const before = this.snapshot();
    this.chargeClock(c);
    const S = r.S; S.ep = null; S.half++; if (c === B) S.full++; S.turn = opp(c); S.ply++;
    this.S = S; this.useCharge(c, id); this.P[c].used[id] = (this.P[c].used[id] || 0) + 1;
    const rec = { type: "action", c, id, san: `✦${def.name}`, squares: r.fx.squares, sq: cand.sq ?? null, to: cand.to ?? null };
    this.hist.push({ before, rec });
    this.last = { aug: id, squares: r.fx.squares };
    this.emit("aug", { c, id, squares: r.fx.squares, sq: cand.sq ?? null, to: cand.to ?? null, sq2: cand.sq2 ?? null, t: cand.t ?? null });
    this._legal = null;
    this.afterTurn(c);
    return { ok: true };
  }
  // 되돌리기는 증강 고르기 이전으로는 못 감 (고른 증강·즉시 효과가 사라지므로)
  canRewind(c) { const h = this.hist[this.hist.length - 1]; return !!h && h.rec.c === opp(c) && h.rec.type === "move" && !this.extra && h.before?.pk === this.pickIdx; }
  canTimeMaster(c) { const n = this.hist.length; return n >= 2 && this.hist[n - 1].rec.c === opp(c) && this.hist[n - 2].rec.c === c && this.hist[n - 2].rec.type === "move" && !this.extra && this.hist[n - 2].before?.pk === this.pickIdx; }
  undoAction(c, id) {
    const n = this.hist.length;
    if (id === "rewind" && !this.canRewind(c)) return { ok: false, error: "NOTHING_TO_UNDO" };
    if (id === "timeMaster" && !this.canTimeMaster(c)) return { ok: false, error: "NOTHING_TO_UNDO" };
    const back = id === "rewind" ? 1 : 2;
    const target = this.hist[n - back], undone = this.hist.slice(n - back).map(h => h.rec);
    this.chargeClock(c);
    const clock = { ...this.clock };
    this.restore(target.before);
    this.clock = clock; // 시계는 되돌리지 않음
    this.hist.length = n - back; this.keys.length = Math.max(1, this.keys.length - back);
    this.useCharge(c, id); this.P[c].used[id] = 1;
    if (id === "rewind") { const r = undone[0]; this.forbid = { c: opp(c), from: r.from, to: r.to, promo: r.promo }; }
    this.last = this.hist.length ? lastOf(this.hist[this.hist.length - 1].rec) : null;
    this.emit("aug", { c, id, undone: undone.map(r => r.san) });
    this.hist.push({ before: null, rec: { type: "action", c, id, san: `✦${AUG[id].name}`, undo: true } });
    this._legal = null; this.tickAt = this.now();
    this.afterTurnStart();
    return { ok: true };
  }
  useCharge(c, id) { const a = this.P[c].augs.find(x => x.id === id); if (a && a.charges !== null) a.charges = Math.max(0, a.charges - 1); }
  chargeClock(c) { if (this.base && this.tickAt) { this.clock[c] -= this.now() - this.tickAt; this.clock[c] += this.inc; } this.tickAt = this.now(); }
  snapshot() { return { pk: this.pickIdx, S: cloneState(this.S), P: clonePlayers(this.P), armed: { ...this.armed }, forbid: this.forbid ? { ...this.forbid } : null, last: this.last }; }
  restore(s) { this.S = cloneState(s.S); this.P = clonePlayers(s.P); this.armed = { ...s.armed }; this.forbid = s.forbid; this.last = s.last; this.extra = null; this._legal = null; }

  /** 한 쪽 차례가 끝난 뒤 */
  afterTurn(c) {
    this.drawOffer = this.drawOffer && this.drawOffer !== c ? null : this.drawOffer; // 상대 제안에 수로 답하면 거절로 봄
    this.keys.push(posKey(this.S, this.augSig()));
    this.tickAt = this.now();
    if (this.endIfOver(opp(c))) return;
    // 증강 고르기 시점 (양쪽 10수·20수 뒤)
    if (this.mode === "augment" && this.S.turn === W && this.pickIdx < PICK_FULL.length - 1 && this.S.full >= PICK_FULL[this.pickIdx + 1] && (this.P.w.augs.length < MAX_AUGS || this.P.b.augs.length < MAX_AUGS)) { this.startPick(this.pickIdx + 1); return; }
    this.afterTurnStart();
  }
  /** 차례 시작에 자동 발동 (운명 역전) */
  afterTurnStart() {
    const c = this.S.turn, p = this.P[c];
    const fr = p.augs.find(a => a.id === "fateReverse" && a.charges > 0);
    if (fr && material(this.S, opp(c)) - material(this.S, c) >= 6) {
      fr.charges = 0; p.used.fateReverse = 1;
      const sq = [];
      for (let s = 0; s < 64; s++) { const q = this.S.b[s]; if (q && q.c === c && q.t === "p") { q.sh = Math.min(3, (q.sh || 0) + 1); sq.push(s); } }
      let best = -1; for (let s = 0; s < 64; s++) { const q = this.S.b[s]; if (q && q.c === c && "nbr".includes(q.t) && (best < 0 || "nbr".indexOf(q.t) > "nbr".indexOf(this.S.b[best].t))) best = s; }
      if (best >= 0) { this.S.b[best].qm = this.S.ply + 6; sq.push(best); }
      this._legal = null;
      this.emit("aug", { c, id: "fateReverse", squares: sq, auto: true });
    }
  }
  /** c 차례에 끝났는지 (체크메이트·스테일메이트·자동 무승부) */
  endIfOver(c, silentNoEnd = false) {
    const S = this.S;
    const prevTurn = S.turn; S.turn = c; this._legal = null;
    const any = this.legal(c).length > 0 || this.hasBoardAction(c);
    const chk = inCheck(S, c, this.mods);
    S.turn = prevTurn; this._legal = null;
    if (!any) { this.finish(chk ? opp(c) : null, chk ? "checkmate" : "stalemate"); return true; }
    if (silentNoEnd) return false;
    const key = this.keys[this.keys.length - 1];
    if (this.keys.filter(k => k === key).length >= 5) { this.finish(null, "fivefold"); return true; }
    if (S.half >= 150) { this.finish(null, "move75"); return true; }
    if (insufficient(S) && !this.canAddMaterial()) { this.finish(null, "insufficient"); return true; }
    if (chk) this.emit("check", { c });
    return false;
  }
  hasBoardAction(c) {
    if (this.mode !== "augment") return false;
    for (const a of this.P[c].augs) {
      if (!BOARD_ACTIONS.includes(a.id) || (a.charges !== null && a.charges <= 0)) continue;
      if (AUG[a.id].minFull && this.S.full < AUG[a.id].minFull) continue;
      for (const cand of candidates(this, c, a.id)) if (applyAction(this, c, a.id, cand, this.rng)) return true;
    }
    return false;
  }
  canAddMaterial() {
    if (this.mode !== "augment") return false;
    const adds = ["revive", "royalRevive", "prisonerSwap", "occupy"];
    return [W, B].some(c => this.P[c].augs.some(a => adds.includes(a.id) && a.charges > 0));
  }
  claimable() {
    const key = this.keys[this.keys.length - 1];
    return { threefold: this.keys.filter(k => k === key).length >= 3, fifty: this.S.half >= 100 };
  }
  claimDraw(c) {
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    const cl = this.claimable();
    if (!cl.threefold && !cl.fifty) return { ok: false, error: "CANT_CLAIM" };
    this.finish(null, cl.threefold ? "threefold" : "fifty"); return { ok: true };
  }
  offerDraw(c) {
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    if (this.drawOffer === opp(c)) { this.finish(null, "agreement"); return { ok: true, accepted: true }; }
    if (this.drawOffer === c) return { ok: false, error: "ALREADY_OFFERED" };
    this.drawOffer = c; this.emit("drawOffer", { c }); return { ok: true };
  }
  declineDraw(c) { if (this.drawOffer !== opp(c)) return { ok: false, error: "NO_OFFER" }; this.drawOffer = null; this.emit("drawDecline", { c }); return { ok: true }; }
  resign(c) { if (this.phase === "over") return { ok: false, error: "OVER" }; this.finish(opp(c), "resign"); return { ok: true }; }
  finish(winner, reason) {
    if (this.phase === "over") return;
    this.stopClock(); this.phase = "over"; this.result = { winner, reason, moves: this.hist.filter(h => h.rec.type === "move").length, plies: this.hist.length };
    this.emit("over", this.result);
  }

  // ---------------- 화면용 ----------------
  publicState(viewer) {
    const S = this.S, mine = viewer === W || viewer === B ? viewer : null;
    const seeAll = !mine || this.phase === "over";
    const scout = mine && this.P[mine].augs.some(a => a.id === "scout");
    const pieces = [];
    for (let s = 0; s < 64; s++) { const p = S.b[s]; if (p) pieces.push({ s, id: p.id, t: p.t, c: p.c, sh: p.sh || 0, inv: p.inv > S.ply ? p.inv - S.ply : 0, frz: p.frz > S.ply ? p.frz - S.ply : 0, qm: p.qm > S.ply ? Math.ceil((p.qm - S.ply) / 2) : 0 }); }
    const traps = S.traps.filter(t => t.until > S.ply && (seeAll || t.owner === mine || scout)).map(t => ({ sq: t.sq, owner: t.owner, left: t.until - S.ply }));
    const legal = mine && this.phase === "play" && S.turn === mine ? this.legal(mine).map(m => ({ from: m.from, to: m.to, promo: m.promo || null, cap: m.cap !== undefined, block: !!m.block, castle: m.castle || null, aug: m.aug || null, trap: !!(m.trap && (traps.some(t => t.sq === m.to))) })) : null;
    const pl = (c) => {
      const p = this.P[c], show = seeAll || c === mine || scout;
      return {
        augs: p.augs.map(a => (show || p.used[a.id] ? { id: a.id, charges: a.charges } : { hidden: true, rarity: AUG[a.id].rarity })),
        picking: this.phase === "pick" && !p.picked, armed: this.armed[c], clock: this.timeLeft(c),
        lost: S.lost[c].map(x => x.t), offer: this.phase === "pick" && !p.picked && (c === mine || (scout && c !== mine)) ? p.offer : null, refresh: c === mine ? p.refresh : 0,
      };
    };
    const actions = mine && this.phase === "play" && S.turn === mine && this.mode === "augment" && !this.extra ? this.actionList(mine) : null;
    return {
      mode: this.mode, phase: this.phase, turn: S.turn, full: S.full, ply: S.ply, pickIdx: this.pickIdx, pickDeadline: this.pickDeadline || null,
      pieces, traps, last: this.last, check: this.phase === "play" ? inCheck(S, S.turn, this.mods) : false, ep: S.ep,
      players: { w: pl(W), b: pl(B) }, legal, actions, extra: this.extra ? { c: this.extra.c, allowCap: this.extra.allowCap } : null,
      drawOffer: this.drawOffer, claim: this.phase === "play" ? this.claimable() : null, forbid: this.forbid && this.forbid.c === mine ? this.forbid : null,
      moves: this.hist.map(h => ({ c: h.rec.c, san: h.rec.san, type: h.rec.type })),
      result: this.result, base: this.base, inc: this.inc, timed: !!this.base,
    };
  }
  /** 지금 쓸 수 있는 행동 증강과 후보 칸 (화면에서 고르기용) */
  actionList(c) {
    const out = {};
    for (const a of this.P[c].augs) {
      const d = AUG[a.id]; if (d.kind !== "action" && d.kind !== "arm") continue;
      if (a.charges !== null && a.charges <= 0) continue;
      if (d.minFull && this.S.full < d.minFull) { out[a.id] = { ok: false, why: `${d.minFull}수부터` }; continue; }
      if (d.kind === "arm") { out[a.id] = { ok: !this.armed[c] && candidates(this, c, a.id).length > 0, armed: !!this.armed[c] }; continue; }
      let seed = 12345; const prng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000); // 섞기형(혼돈) 확인용 고정 난수
      const list = candidates(this, c, a.id).filter(x => applyAction(this, c, a.id, x, prng));
      out[a.id] = { ok: list.length > 0, cands: list.slice(0, 400) };
    }
    return out;
  }
  replay() {
    // 주요 장면 다시 보기: 각 수 뒤의 배치
    const frames = [];
    for (const h of this.hist) if (h.before) frames.push({ rec: h.rec, pieces: h.before.S.b.map((p, s) => p && { s, t: p.t, c: p.c }).filter(Boolean) });
    frames.push({ rec: null, pieces: this.S.b.map((p, s) => p && { s, t: p.t, c: p.c }).filter(Boolean) });
    return frames;
  }
}
function newP() { return { augs: [], offer: null, picked: true, refresh: 1, used: {} }; }
function bestOffer(offer) { const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }; return [...offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0]; }
function lastOf(rec) { return rec.type === "move" ? { from: rec.from, to: rec.to } : rec.squares ? { aug: rec.id, squares: rec.squares } : null; }
export { sqName };
