// =========================
// DUO TERRITORY — AI (2026-11-16)
// 칸에 들어갈 때마다(또는 멈췄을 때) 다음 방향을 정함. 서버 시뮬레이션과 같은 규칙(game.setDir)만 씀
// · 집(내 땅)에서 출발 → 바깥으로 a칸 → 꺾어서 b칸 → 다시 꺾어 집으로 (사각형 고리)
// · 궤적이 길어지거나 적 머리가 가까우면 가장 가까운 내 땅으로 BFS 귀환
// · 3칸 안에 적 궤적이 보이면 끊으러 감 · 내 궤적·벽·맵 밖으로는 절대 안 감
// · 증강: 위험할 때 귀환·방어형, 여유 있을 때 점령·속도형을 씀
// =========================
import { DIRS, opposite, neighbor } from "./territory-core.js";
import { AUG } from "./territory-augs.js";

const LV = { easy: { maxTrail: 14, look: 2, react: 0.55, aug: 0.004 }, normal: { maxTrail: 22, look: 3, react: 0.8, aug: 0.01 }, hard: { maxTrail: 32, look: 4, react: 0.95, aug: 0.02 } };

export function botThink(g, p, rng = Math.random) {
  if (!p.alive || g.phase !== "play") return;
  const L = LV[p.level] || LV.normal, G = g.G, S = G.W;
  const ai = p.ai || (p.ai = { lastCell: -1, plan: [], legs: [], mode: "home", path: null });
  if (g.mode === "augment" && rng() < L.aug) useAug(g, p, rng);
  const atCell = ai.lastCell !== p.c || p.n < 0;
  if (!atCell && p.prog > 0.25) return;
  ai.lastCell = p.c;
  const ok = (d) => { if (d === opposite(p.dir) && p.trail.length) return false; const n = neighbor(G, p.c, d); if (n < 0 || g.blockedFor(p, n)) return false; const t = G.trail[n]; if (t === p.i + 1) return false; return true; };
  const inSafe = g.safe(p, p.c), x = p.c % S, y = (p.c / S) | 0;
  // 적 머리 거리
  let enemyD = 99; for (const q of g.P) if (q.alive && !g.sameTeam(q.i, p.i)) enemyD = Math.min(enemyD, Math.abs(q.c % S - x) + Math.abs(((q.c / S) | 0) - y));
  // 1) 적 궤적 끊기
  if (rng() < L.react) {
    let best = -1, bd = 99;
    for (let d = 0; d < 4; d++) { if (!ok(d)) continue; let c = p.c; for (let k = 1; k <= L.look; k++) { c = neighbor(G, c, d); if (c < 0) break; const t = G.trail[c]; if (t && t !== p.i + 1 && !g.sameTeam(t - 1, p.i)) { if (k < bd) { bd = k; best = d; } break; } if (G.trail[c] === p.i + 1) break; } }
    if (best >= 0) { g.setDir(p.i, best); ai.mode = "out"; return; }
  }
  // 2) 위험하면 귀환
  const danger = p.trail.length && (p.trail.length > L.maxTrail || enemyD <= Math.max(3, Math.min(8, p.trail.length / 2)));
  if (!inSafe && (danger || ai.mode === "return")) {
    ai.mode = "return";
    const d = homeDir(g, p);
    if (d >= 0 && ok(d)) { g.setDir(p.i, d); return; }
  }
  if (inSafe) {
    if (ai.mode === "return" || ai.mode === "out") { ai.mode = "home"; ai.legs = []; }
    // 땅 안: 가장 가까운 경계로 나가서 고리 계획
    if (!ai.legs.length) { const a = 3 + Math.floor(rng() * (L.maxTrail / 4)), b = 3 + Math.floor(rng() * (L.maxTrail / 3)), turn = rng() < 0.5 ? 1 : 3; ai.legs = [a, b, a + 1]; ai.turn = turn; ai.leg = 0; ai.left = -1; }
    const ed = edgeDir(g, p, rng);
    if (ed >= 0 && ok(ed)) { g.setDir(p.i, ed); ai.outDir = ed; return; }
  } else {
    // 고리 그리기
    if (ai.left < 0) { ai.left = ai.legs[0] || 4; ai.leg = 0; }
    ai.left--;
    if (ai.left <= 0) { ai.leg++; if (ai.leg >= 3) { ai.mode = "return"; const d = homeDir(g, p); if (d >= 0 && ok(d)) { g.setDir(p.i, d); return; } } else { ai.left = ai.legs[ai.leg]; const nd = (p.dir + ai.turn) & 3; if (ok(nd)) { g.setDir(p.i, nd); return; } } }
  }
  if (!ok(p.nextDir)) { const opts = [0, 1, 2, 3].filter(ok); if (opts.length) g.setDir(p.i, opts.sort((a, b) => score(g, p, b) - score(g, p, a))[0]); }
}
/** 다음 칸 점수: 맵 안쪽·적 궤적 없는 곳 선호 */
function score(g, p, d) { const S = g.G.W, n = neighbor(g.G, p.c, d); if (n < 0) return -99; const x = n % S, y = (n / S) | 0; return Math.min(x, y, S - 1 - x, S - 1 - y) * 0.2 + (g.safe(p, n) ? 0.5 : 0) + Math.random() * 0.3; }
/** 내 땅 밖으로 나가는 방향 (가까운 경계 쪽) */
function edgeDir(g, p, rng) {
  const G = g.G; let best = -1, bd = 99;
  const dirs = [0, 1, 2, 3].sort(() => rng() - 0.5);
  for (const d of dirs) { if (d === opposite(p.dir) && p.trail.length) continue; let c = p.c; for (let k = 1; k < 12; k++) { c = neighbor(G, c, d); if (c < 0) break; if (!g.safe(p, c)) { const S = G.W, x = c % S, y = (c / S) | 0; const margin = Math.min(x, y, S - 1 - x, S - 1 - y); const v = k + (margin < 4 ? 6 : 0); if (v < bd) { bd = v; best = d; } break; } } }
  return best;
}
/** 가장 가까운 내 땅으로 가는 첫 방향 (내 궤적은 못 지나감) */
export function homeDir(g, p) {
  const G = g.G, N = G.W * G.H, prev = new Int32Array(N).fill(-2), q = [p.c]; prev[p.c] = -1;
  const me = p.i + 1;
  for (let h = 0; h < q.length && h < 6000; h++) {
    const c = q[h];
    if (c !== p.c && g.safe(p, c)) { let k = c; while (prev[k] !== p.c && prev[k] >= 0) k = prev[k]; for (let d = 0; d < 4; d++) if (neighbor(G, p.c, d) === k) return d; return -1; }
    for (let d = 0; d < 4; d++) {
      if (c === p.c && d === opposite(p.dir) && p.trail.length) continue;
      const n = neighbor(G, c, d); if (n < 0 || prev[n] !== -2 || G.trail[n] === me || g.blockedFor(p, n)) continue;
      prev[n] = c; q.push(n);
    }
  }
  return -1;
}
function useAug(g, p, rng) {
  const inSafe = g.safe(p, p.c), act = p.augs.filter(a => AUG[a.id].kind === "active" && (a.charges === null || a.charges > 0) && a.cdUntil <= g.t);
  if (!act.length) return;
  const danger = p.trail.length > 8;
  const pref = danger ? ["emergencyReturn", "timeRewind", "absoluteDefense", "territoryKing", "safeZone", "trailCamo", "spaceRule", "dash"] : inSafe ? ["replicate", "divineLand", "rulerStep", "infiniteSprint", "shortSprint", "doubleTrail", "shadowClone", "cloneArmy", "decoyTrail", "recover"] : ["territoryBlast", "megaBlast", "conversion", "barrier", "doubleTrail", "dimensionShift", "dash", "shortSprint"];
  for (const id of pref) if (act.some(a => a.id === id)) { const r = g.use(p.i, id); if (r.ok) return; }
  void rng; void DIRS;
}
