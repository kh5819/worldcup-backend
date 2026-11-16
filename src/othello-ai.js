// =========================
// 플듀 증강 오셀로 — AI (2026-11-16)
// decide(game, c, level) → 한 걸음: { kind:"place", sq } · { kind:"aug", id, sq } · { kind:"pass" }
// 착수 탐색은 숫자 배열판 알파베타(시간 제한) — 본 서버를 오래 붙잡지 않게 쉬움 5ms·보통 40ms·어려움 90ms
// =========================
import { opp, isCorner, isEdge, isFixed, legalMoves, flipsFor, WEIGHT, nearCorner, evaluate, cloneState, CORNERS, blockedFor, adjEmpty } from "./othello-core.js";
import { AUG, targets, area, sweepList, bombTargets } from "./othello-augs.js";

const DEPTH = { easy: 1, normal: 4, hard: 7 }, TIME = { easy: 5, normal: 40, hard: 90 };
const DR = [-9, -8, -7, -1, 1, 7, 8, 9];
const okStep = (s, d) => { const f = s & 7; if ((d === -9 || d === -1 || d === 7) && f === 0) return false; if ((d === -7 || d === 1 || d === 9) && f === 7) return false; const n = s + d; return n >= 0 && n < 64; };

// ---------------- 빠른 탐색판 ----------------
function toFast(S, me) {
  const cell = new Int8Array(64), fix = new Uint8Array(64), blkMe = new Uint8Array(64), blkOp = new Uint8Array(64), o = opp(me);
  for (let s = 0; s < 64; s++) { const d = S.b[s]; if (d) { cell[s] = d.c === me ? 1 : -1; if (isFixed(S, s)) fix[s] = 1; } if (blockedFor(S, s, me)) blkMe[s] = 1; if (blockedFor(S, s, o)) blkOp[s] = 1; }
  return { cell, fix, blkMe, blkOp };
}
function fFlips(F, cell, who, s) {
  if (cell[s] || (who === 1 ? F.blkMe[s] : F.blkOp[s])) return null;
  let out = null;
  for (const d of DR) {
    let p = s, n = 0, buf = [];
    while (okStep(p, d)) { p += d; const v = cell[p]; if (v === -who) { buf.push(p); n++; continue; } if (v === who && n) { for (const q of buf) if (!F.fix[q]) (out || (out = [])).push(q); } break; }
  }
  return out;
}
function fMoves(F, cell, who) { const out = []; for (let s = 0; s < 64; s++) { const fl = fFlips(F, cell, who, s); if (fl) out.push([s, fl]); } return out; }
function fEval(F, cell) {
  let pos = 0, me = 0, op = 0;
  for (let s = 0; s < 64; s++) { const v = cell[s]; if (!v) continue; let w = WEIGHT[s]; if (w < 0) { const cr = nearCorner(s); if (cr >= 0 && cell[cr]) w = 4; } if (F.fix[s]) w += 6; pos += v * w; v > 0 ? me++ : op++; }
  const empty = 64 - me - op;
  const a = fMoves(F, cell, 1).length, b = fMoves(F, cell, -1).length;
  const mob = a + b ? (100 * (a - b)) / (a + b + 2) : 0;
  return pos + mob * 0.9 + (empty < 14 ? (me - op) * (16 - empty) : 0);
}
function search(F, cell, who, depth, alpha, beta, ctx, passed) {
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.until) ctx.stop = true;
  if (ctx.stop) return 0;
  if (depth === 0) return who * fEval(F, cell);
  const mv = fMoves(F, cell, who);
  if (!mv.length) {
    if (passed) { let d = 0; for (let s = 0; s < 64; s++) d += cell[s]; return who * d * 1000; }
    return -search(F, cell, -who, depth - 1, -beta, -alpha, ctx, true);
  }
  mv.sort((x, y) => WEIGHT[y[0]] - WEIGHT[x[0]]);
  let best = -1e9;
  for (const [s, fl] of mv) {
    const nc = cell.slice(); nc[s] = who; for (const q of fl) nc[q] = who;
    const v = -search(F, nc, -who, depth - 1, -beta, -alpha, ctx, false);
    if (ctx.stop) return 0;
    if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
  }
  return best;
}
/** 둘 수 있는 칸(legal) 중 최선 */
export function bestPlace(game, c, level = "normal", rng = Math.random) {
  const legal = game.legal(c); if (!legal.length) return null;
  if (legal.length === 1) return legal[0].sq;
  if (level === "easy" && rng() < 0.35) return legal[Math.floor(rng() * legal.length)].sq;
  const F = toFast(game.S, c), ctx = { nodes: 0, until: Date.now() + TIME[level], stop: false };
  let best = legal[0].sq, bestV = -1e9;
  const order = legal.map(m => m.sq).sort((a, b) => WEIGHT[b] - WEIGHT[a]);
  for (let d = 1; d <= DEPTH[level]; d++) {
    let curBest = null, curV = -1e9;
    for (const sq of order) {
      const nc = F.cell.slice(); nc[sq] = 1;
      const fl = game.breathMode ? [] : (fFlips(F, F.cell, 1, sq) || []);
      for (const q of fl) nc[q] = 1;
      const v = -search(F, nc, -1, d - 1, -1e9, 1e9, ctx, false) + (level === "easy" ? rng() * 30 : 0);
      if (ctx.stop) break;
      if (v > curV) { curV = v; curBest = sq; }
    }
    if (ctx.stop && curBest === null) break;
    if (curBest !== null && !ctx.stop) { best = curBest; bestV = curV; order.sort((a, b) => (a === best ? -1 : b === best ? 1 : 0)); }
    if (ctx.stop) break;
  }
  void bestV;
  return best;
}
// 증강 효과를 흉내 낸 판 평가 (자기 관점)
function evalAfter(game, c, fn) { const S = cloneState(game.S); fn(S); return evaluate(S, c); }

/** 한 걸음 고르기 */
export function decide(game, c, level = "normal", rng = Math.random) {
  const S = game.S, o = opp(c), aug = game.mode === "augment";
  const okA = (id) => aug && game.actionOk(c, id);
  const chance = level === "easy" ? 0.45 : level === "normal" ? 0.85 : 1;
  // 1) 둘 곳이 없음
  if (game.mustChoose) {
    if (okA("godHand")) { const t = targets(S, c, "godHand"); const cr = t.filter(isCorner); return { kind: "aug", id: "godHand", sq: (cr.length ? cr : t).sort((a, b) => WEIGHT[b] - WEIGHT[a] || flipsFor(S, c, b).length - flipsFor(S, c, a).length)[0] }; }
    if (okA("rewind")) return { kind: "aug", id: "rewind" };
    if (okA("ghost")) { const t = targets(S, c, "ghost").sort((a, b) => WEIGHT[b] - WEIGHT[a]); return { kind: "aug", id: "ghost", sq: t[0] }; }
    return { kind: "pass" };
  }
  if (game.breathMode) { const t = adjEmpty(S, c).sort((a, b) => WEIGHT[b] - WEIGHT[a]); return { kind: "place", sq: t[0] }; }
  const legal = game.legal(c);
  if (!legal.length) return { kind: "pass" };
  if (aug && rng() < chance) {
    // 2) 상대가 방금 모서리 → 되감기
    const last = game.hist[game.hist.length - 1];
    if (okA("rewind") && last?.rec.type === "place" && isCorner(last.rec.sq)) return { kind: "aug", id: "rewind" };
    // 3) 신의 손으로 빈 모서리
    if (okA("godHand") && !legal.some(m => isCorner(m.sq))) { const cr = targets(S, c, "godHand").filter(isCorner); if (cr.length && S.moves >= 20) return { kind: "aug", id: "godHand", sq: cr[0] }; }
    // 4) 공짜 증강 (한 차례 1번)
    if (!game.freeUsed && game.extraLeft === 0) {
      const now = evaluate(S, c), oppMoves = legalMoves(S, o), oppCorners = oppMoves.filter(m => isCorner(m.sq)).map(m => m.sq);
      const late = S.moves >= 40;
      const tryBest = (id, sim, thr) => { if (!okA(id)) return null; let best = null, bv = -1e9; for (const t of targets(S, c, id)) { const v = evalAfter(game, c, (T) => sim(T, t)) - now; if (v > bv) { bv = v; best = t; } } return best !== null && (bv >= thr || (late && bv > 0)) ? { kind: "aug", id, sq: best } : null; };
      const r = tryBest("blackhole", (T, t) => { for (const q of area(t)) if (T.b[q] && !isCorner(q)) T.b[q] = null; }, 40)
        || tryBest("sweep", (T, t) => { for (const q of sweepList(T, c, t)) T.b[q].c = c; }, 30)
        || tryBest("steal", (T, t) => { T.b[t].c = c; }, 28)
        || tryBest("eraser", (T, t) => { T.b[t] = null; }, 24);
      if (r) return r;
      if (oppCorners.length && okA("cornerSeal")) return { kind: "aug", id: "cornerSeal", sq: oppCorners[0] };
      if (oppCorners.length && okA("freeze")) return { kind: "aug", id: "freeze" };
      const oppGood = oppMoves.filter(m => !isCorner(m.sq) && WEIGHT[m.sq] >= 15).map(m => m.sq);
      if (oppGood.length && okA("reserve")) return { kind: "aug", id: "reserve", sq: oppGood[0] };
      if (oppGood.length && okA("wall") && S.moves >= 8) return { kind: "aug", id: "wall", sq: oppGood[0] };
      if (okA("guard")) { const risk = new Set(); for (const m of oppMoves) for (const q of m.flips) risk.add(q); const g = [...risk].filter(q => S.b[q]?.c === c && isEdge(q)).sort((a, b) => WEIGHT[b] - WEIGHT[a]); if (g.length) return { kind: "aug", id: "guard", sq: g[0] }; }
    }
  }
  // 5) 착수 (+ 켜기)
  let sq = game._botPlan && game._botPlan.c === c && game._botPlan.ply === S.ply && game._botPlan.moves === S.moves && legal.some(m => m.sq === game._botPlan.sq) ? game._botPlan.sq : bestPlace(game, c, level, rng);
  if (aug && !game.armed[c] && rng() < chance) {
    const mv = legal.find(m => m.sq === sq);
    const pick = () => {
      if (okA("timeStop") && S.moves >= 26) return "timeStop";
      if (okA("doubleMove") && S.moves >= 18) return "doubleMove";
      if (okA("bomb")) { const T = cloneState(S); T.b[sq] = { c }; for (const q of mv.flips) T.b[q].c = c; if (bombTargets(T, c, sq).length >= 3) return "bomb"; }
      if (okA("anchor") && isEdge(sq) && !isCorner(sq)) return "anchor";
      if (okA("inspire") && mv.flips.length >= 4) return "inspire";
      if (okA("chain")) return "chain";
      if (okA("fixStone") && (isEdge(sq) || S.moves >= 20)) return "fixStone";
      return null;
    };
    const id = pick();
    if (id) { game._botPlan = { c, sq, ply: S.ply, moves: S.moves }; return { kind: "aug", id }; }
  }
  game._botPlan = null;
  return { kind: "place", sq };
}
/** 증강 고르기: 희귀도 + 취향 */
export function botPick(offer, rng = Math.random) {
  const ord = { common: 0, rare: 1, epic: 2, legendary: 3 }, dislike = ["peek", "lastWord", "passBonus", "breath"];
  return [...offer].sort((a, b) => (ord[AUG[b].rarity] - ord[AUG[a].rarity]) || (dislike.includes(a) - dislike.includes(b)) || rng() - 0.5)[0];
}
export { CORNERS };
