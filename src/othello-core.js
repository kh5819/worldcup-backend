// =========================
// 플듀 증강 오셀로 — 규칙 엔진 (순수 함수, 2026-11-16)
// 칸 번호 sq = 행*8 + 열 (행 0 = 화면 맨 위 '1', 열 0 = 'a'). 흑(b) 선공
// 칸: null 또는 { c, fix(이 ply 전까지 안 뒤집힘, 1e9 = 끝까지), gold }
// 막힌 칸 S.blocks: { sq, until, only } — only 가 없으면 둘 다 못 둠, 있으면 그 색만 못 둠
// 고정 돌은 줄에는 포함되지만 뒤집히지 않음 (적어도 1개는 실제로 뒤집혀야 둘 수 있음)
// =========================
export const BK = "b", WH = "w";
export const opp = (c) => (c === BK ? WH : BK);
export const FOREVER = 1e9;
export const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const CORNERS = [0, 7, 56, 63];
const FILES = "abcdefgh";
export const sqName = (s) => FILES[s & 7] + ((s >> 3) + 1);
export const rowOf = (s) => s >> 3, colOf = (s) => s & 7;
export const isCorner = (s) => s === 0 || s === 7 || s === 56 || s === 63;
export const isEdge = (s) => { const r = s >> 3, f = s & 7; return r === 0 || r === 7 || f === 0 || f === 7; };
export const NEIGH = Array.from({ length: 64 }, (_, s) => { const out = [], r = s >> 3, f = s & 7; for (const [dr, df] of DIRS) { const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) out.push(rr * 8 + ff); } return out; });
// 칸 가치 (AI·자동 선택용)
export const WEIGHT = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

export function initialState() {
  const b = Array(64).fill(null);
  b[27] = { c: WH }; b[28] = { c: BK }; b[35] = { c: BK }; b[36] = { c: WH };
  return { b, turn: BK, ply: 0, moves: 0, blocks: [], pts: { b: 0, w: 0 }, frozen: null };
}
export function cloneState(S) {
  return { ...S, b: S.b.map(x => (x ? { ...x } : null)), blocks: S.blocks.map(x => ({ ...x })), pts: { ...S.pts }, frozen: S.frozen ? { ...S.frozen } : null };
}
export const isFixed = (S, s) => { const d = S.b[s]; return !!d && (d.gold || (d.fix || 0) > S.ply); };
/** c가 sq에 못 두게 막혔는지 */
export function blockedFor(S, sq, c) { for (const k of S.blocks) if (k.sq === sq && k.until > S.ply && (!k.only || k.only === c)) return true; return false; }
export const blockedAll = (S, sq) => S.blocks.some(k => k.sq === sq && k.until > S.ply && !k.only);
/** sq에 c가 두면 뒤집히는 칸들 */
export function flipsFor(S, c, sq) {
  if (S.b[sq] || blockedFor(S, sq, c)) return [];
  const out = [], r0 = sq >> 3, f0 = sq & 7, o = opp(c);
  for (const [dr, df] of DIRS) {
    let r = r0 + dr, f = f0 + df; const line = [];
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const s = r * 8 + f, d = S.b[s];
      if (!d || blockedAll(S, s)) { line.length = 0; break; }
      if (d.c === o) { line.push(s); r += dr; f += df; continue; }
      break;
    }
    if (line.length && r >= 0 && r < 8 && f >= 0 && f < 8 && S.b[r * 8 + f]?.c === c) for (const s of line) if (!isFixed(S, s)) out.push(s);
  }
  return out;
}
/** 둘 수 있는 칸 [{ sq, flips }] — 빙결(변·모서리 금지)도 반영 */
export function legalMoves(S, c) {
  const out = [];
  for (let s = 0; s < 64; s++) { if (S.b[s]) continue; const fl = flipsFor(S, c, s); if (fl.length) out.push({ sq: s, flips: fl }); }
  if (S.frozen && S.frozen.c === c && S.frozen.ply === S.ply) { const inner = out.filter(m => !isEdge(m.sq)); if (inner.length) return inner; }
  return out;
}
export function hasMove(S, c) { for (let s = 0; s < 64; s++) if (!S.b[s] && flipsFor(S, c, s).length) return true; return false; }
export function count(S) { let b = 0, w = 0; for (const d of S.b) if (d) d.c === BK ? b++ : w++; return { b, w }; }
export const emptyCount = (S) => S.b.reduce((n, d) => n + (d ? 0 : 1), 0);
/** 놓고 뒤집기 (S를 직접 바꿈) */
export function place(S, c, sq, flips) {
  S.b[sq] = { c };
  for (const s of flips) S.b[s].c = c;
}
/** 빈 칸 중 어느 돌이든 맞닿은 칸 (유령 착수·숨통용) */
export function adjEmpty(S, c) {
  const out = [];
  for (let s = 0; s < 64; s++) if (!S.b[s] && !blockedFor(S, s, c) && NEIGH[s].some(n => S.b[n])) out.push(s);
  return out;
}

// ---------------- AI 평가 ----------------
export function evaluate(S, c) {
  const o = opp(c); let pos = 0, mine = 0, theirs = 0;
  for (let s = 0; s < 64; s++) { const d = S.b[s]; if (!d) continue; let w = WEIGHT[s];
    // 모서리를 이미 가진 쪽에겐 X·C칸이 덜 위험
    if (w < 0) { const cr = nearCorner(s); if (cr >= 0 && S.b[cr]) w = 4; }
    if (isFixed(S, s)) w += 6;
    if (d.c === c) { pos += w; mine++; } else { pos -= w; theirs++; } }
  const empty = 64 - mine - theirs;
  let mob = 0; if (empty > 0) { const a = countMoves(S, c), b = countMoves(S, o); mob = a + b ? (100 * (a - b)) / (a + b + 2) : 0; }
  const disc = empty < 14 ? (mine - theirs) * (16 - empty) : 0;
  return pos + mob * 0.9 + disc + (S.pts[c] - S.pts[o]) * 10;
}
function countMoves(S, c) { let n = 0; for (let s = 0; s < 64; s++) if (!S.b[s] && flipsFor(S, c, s).length) n++; return n; }
export function nearCorner(s) { const r = s >> 3, f = s & 7; if (r <= 1 && f <= 1) return 0; if (r <= 1 && f >= 6) return 7; if (r >= 6 && f <= 1) return 56; if (r >= 6 && f >= 6) return 63; return -1; }
