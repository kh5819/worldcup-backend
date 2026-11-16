// =========================
// 플듀 증강 체스 — AI (2026-11-16)
// · 알파베타 + 정지 탐색(잡기만). 증강 이동 보너스(mods)·보호막·무적까지 그대로 계산
// · 쉬움: 1수 + 실수 많음 / 보통: 2수 / 어려움: 시간 안에서 3~4수
// · 증강 모드: 행동 증강 후보를 평가해 좋은 수보다 낫다 싶으면 사용, 고르기는 등급·성향 점수
// =========================
import { W, B, opp, applyMove, legalMoves, inCheck, VALUE, kingSq } from "./chess-core.js";
import { AUG, candidates, applyAction } from "./chess-augs.js";

const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// 자리 점수 (백 기준, a1=0)
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
  kEnd: [-50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50],
};
/** 정적 평가 (c 입장, 센티폰) */
export function evaluate(S, c) {
  let sc = 0, mat = 0;
  for (const p of S.b) if (p && p.t !== "k" && p.t !== "p") mat += PV[p.t];
  const end = mat <= 1400;
  for (let s = 0; s < 64; s++) {
    const p = S.b[s]; if (!p) continue;
    const idx = p.c === W ? s : (7 - (s >> 3)) * 8 + (s & 7);
    let v = PV[p.t] + (p.t === "k" ? PST[end ? "kEnd" : "k"][idx] : PST[p.t][idx]);
    if (p.sh) v += Math.min(p.sh, 2) * (PV[p.t] * 0.25 + 15);
    if (p.inv > S.ply) v += PV[p.t] * 0.2;
    if (p.frz > S.ply) v -= PV[p.t] * 0.15 + 20;
    if (p.qm > S.ply) v += 120;
    sc += p.c === c ? v : -v;
  }
  return sc;
}
const order = (S, list) => list.map(m => { let k = 0; if (m.cap !== undefined) { const v = S.b[m.cap]; k = 10 * (v ? PV[v.t] : 100) - (S.b[m.from] ? PV[S.b[m.from].t] / 10 : 0) + (m.block ? -500 : 0); } if (m.promo) k += PV[m.promo]; return [k, m]; }).sort((a, b) => b[0] - a[0]).map(x => x[1]);

function quiesce(S, c, alpha, beta, mods, depth, ctx) {
  ctx.nodes++;
  const stand = evaluate(S, c);
  if (depth <= 0) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  const caps = order(S, legalMoves(S, c, mods).filter(m => m.cap !== undefined && !m.block));
  for (const m of caps) {
    const v = -quiesce(applyMove(S, m), opp(c), -beta, -alpha, mods, depth - 1, ctx);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
    if (ctx.stop()) break;
  }
  return alpha;
}
function negamax(S, c, depth, alpha, beta, mods, ctx, ply) {
  if (ctx.stop()) return 0;
  ctx.nodes++;
  const list = legalMoves(S, c, mods);
  if (!list.length) return inCheck(S, c, mods) ? -30000 + ply : 0;
  if (depth <= 0) return quiesce(S, c, alpha, beta, mods, 4, ctx);
  let best = -Infinity;
  for (const m of order(S, list)) {
    const v = -negamax(applyMove(S, m), opp(c), depth - 1, -beta, -alpha, mods, ctx, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
const LEVEL = { easy: { depth: 1, noise: 180, blunder: 0.22, ms: 400 }, normal: { depth: 2, noise: 35, blunder: 0.04, ms: 900 }, hard: { depth: 4, noise: 0, blunder: 0, ms: 1600 } };

/** 루트 수 고르기: 게임의 실제 합법 수(이중 행동·금지 수 반영) 중에서 */
export function bestMove(G, c, level = "normal", rng = Math.random) {
  const L = LEVEL[level] || LEVEL.normal;
  const root = G.legal(c); if (!root.length) return null;
  const mods = G.mods, t0 = Date.now();
  const ctx = { nodes: 0, stop: () => Date.now() - t0 > L.ms * 1.6 };
  let scored = root.map(m => ({ m, v: 0 }));
  for (let d = 1; d <= L.depth; d++) {
    const ctxD = { nodes: 0, stop: () => Date.now() - t0 > L.ms * (d === 1 ? 5 : 1) };
    const next = [];
    let alpha = -Infinity, aborted = false;
    for (const { m } of scored) {
      const T = applyMove(G.S, m);
      let v = -negamax(T, opp(c), d - 1, -Infinity, level === "hard" ? -alpha : Infinity, mods, ctxD, 1);
      if (G.extra) v = evaluate(T, c); // 덤 수는 얕게
      next.push({ m, v });
      if (v > alpha) alpha = v;
      if (ctxD.stop() && d > 1) { aborted = true; break; }
    }
    if (aborted) break;
    scored = next.sort((a, b) => b.v - a.v);
    if (Date.now() - t0 > L.ms) break;
  }
  void ctx;
  // 사람 같은 실수
  if (L.noise) scored = scored.map(x => ({ ...x, v: x.v + (rng() - 0.5) * 2 * L.noise })).sort((a, b) => b.v - a.v);
  if (L.blunder && rng() < L.blunder && scored.length > 2) return { m: scored[1 + Math.floor(rng() * Math.min(3, scored.length - 1))].m, v: scored[0].v };
  return scored[0];
}
/** 쓸 만한 증강 행동 (없으면 null). bestV: 가장 좋은 수의 점수 */
export function bestAction(G, c, level = "normal", bestV = 0, rng = Math.random) {
  if (G.mode !== "augment" || G.extra) return null;
  if (level === "easy" && rng() < 0.5) return null;
  const list = G.actionList(c); let best = null;
  const base = evaluate(G.S, c);
  for (const [id, info] of Object.entries(list)) {
    if (!info.ok) continue;
    const def = AUG[id];
    if (def.kind === "arm") { if (id === "doubleAction" && rng() < 0.25) return { id, pl: {}, v: Infinity }; if (id === "godMove") return { id, pl: {}, v: Infinity }; continue; }
    if (id === "rewind") { const h = G.hist[G.hist.length - 1]; if (h && h.rec.cap && ["q", "r"].includes(h.rec.cap)) return { id, pl: {}, v: Infinity }; continue; }
    if (id === "timeMaster") { const h = G.hist[G.hist.length - 1]; if (h && h.rec.cap && ["q", "r", "n", "b"].includes(h.rec.cap)) return { id, pl: {}, v: Infinity }; continue; }
    let cands = info.cands || [];
    if (cands.length > 120) cands = cands.filter((_, i) => i % Math.ceil(cands.length / 120) === 0);
    for (const pl of cands) {
      const r = applyAction(G, c, id, pl, rng); if (!r) continue;
      // 상대 응수 1수 + 잡기 정리 (내 입장 점수)
      const T = r.S; T.turn = opp(c);
      const v = -negamax(T, opp(c), 1, -Infinity, Infinity, G.mods, { nodes: 0, stop: () => false }, 1);
      const gain = v - base;
      if (!best || v > best.v) best = { id, pl, v, gain };
    }
  }
  if (!best) return null;
  const margin = level === "hard" ? 40 : level === "normal" ? 70 : 110;
  return best.v > bestV + margin ? best : null;
}
/** 증강 고르기 */
export function pickAug(offer, rng = Math.random) {
  const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const like = { secondQueen: 3, immortalKnight: 2, absoluteDefense: 2, kingWrath: 1, rookJump: 1, knightOrder: 1, ironRook: 1, revive: 1, royalRevive: 1, dimension: 1, guardian: 1, queenBless: 1, fateReverse: 1 };
  return [...offer].sort((a, b) => (ord[AUG[b].rarity] * 2 + (like[b] || 0) + rng()) - (ord[AUG[a].rarity] * 2 + (like[a] || 0) + rng()))[0];
}
export { kingSq, VALUE, B };
