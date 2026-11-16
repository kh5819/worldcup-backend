// =========================
// 플듀 증강 오셀로 — 증강 36종 (2026-11-16)
// kind: passive(자동) · instant(고르는 순간) · arm(켜 두면 이번에 놓는 돌에 적용, 차례 안 씀)
//       free(칸을 골라 쓰고 차례는 그대로 — 한 차례에 1번) · action(칸을 골라 쓰고 차례 끝)
// target: empty(빈 칸, 모서리 제외) · emptyCorner · oppDisc(모서리·고정 제외) · ownDisc · adj(돌 옆 빈 칸) · any(빈 칸 아무 데나) · area(2×2 왼쪽 위 칸) · ownRow(내 돌)
// 점수 = 돌 수 + 보너스 점수(pts)
// =========================
import { opp, isCorner, isEdge, isFixed, blockedFor, blockedAll, flipsFor, adjEmpty, NEIGH, CORNERS, WEIGHT, FOREVER, count, rowOf } from "./othello-core.js";

export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
const A = (id, rarity, art, name, kind, charges, cond, effect, duration, extra = {}) => ({ id, rarity, art, name, kind, charges, cond, effect, duration, ...extra });
export const AUGS = [
  // ---------- 일반 14 ----------
  A("fixStone", "common", "stone-shield", "단단한 돌", "arm", 3, "켜고 돌을 놓을 때", "이번에 놓는 돌은 상대 3차례 동안 안 뒤집혀요", "3회"),
  A("wall", "common", "wall", "벽 세우기", "free", 2, "빈 칸 (모서리 제외)", "그 칸을 상대 2차례 동안 아무도 못 두게 막아요", "2회", { target: "empty" }),
  A("guard", "common", "guard", "수비 태세", "free", 2, "내 돌", "내 돌 1개가 상대 3차례 동안 안 뒤집혀요", "2회", { target: "ownDisc" }),
  A("collector", "common", "gem", "수집가", "passive", null, "한 번에 5개 이상 뒤집을 때", "+1점 (한 판 최대 6점)", "판 전체"),
  A("passBonus", "common", "hourglass", "버티기", "passive", null, "둘 곳이 없어 패스할 때", "패스할 때마다 +3점", "판 전체"),
  A("cornerTax", "common", "coin", "모서리 세금", "passive", null, "상대가 모서리를 차지할 때", "그때마다 내가 +2점", "판 전체"),
  A("lastWord", "common", "flag", "마지막 한 수", "passive", null, "판의 마지막 돌을 내가 놓으면", "+4점", "끝날 때"),
  A("edgeBonus", "common", "edge", "변두리 수당", "passive", null, "끝날 때 내 변 돌 (모서리 제외)", "3개마다 +1점", "끝날 때"),
  A("chain", "common", "chain", "연쇄 반응", "arm", 2, "켜고 돌을 놓을 때", "놓은 돌과 맞닿은 상대 돌 1개를 더 뒤집어요 (가장 좋은 자리 자동)", "2회"),
  A("firstAid", "common", "heart", "응급 처치", "passive", 2, "상대 수에 내 돌이 6개 이상 뒤집히면", "그중 2개를 다시 내 돌로 되돌려요", "2회"),
  A("peek", "common", "eye", "수읽기", "passive", null, "항상", "상대 증강이 전부 보이고, 상대가 둘 수 있는 칸이 표시돼요", "판 전체"),
  A("lucky", "common", "clover", "행운의 출발", "instant", null, "고르는 순간", "+3점", "즉시"),
  A("breath", "common", "wind", "숨통", "passive", 1, "둘 곳이 없어 패스해야 할 때", "돌 옆 빈 칸에 뒤집기 없이 돌 1개를 놓을 수 있어요", "1회"),
  A("timeBank", "common", "clock", "시간 은행", "instant", null, "고르는 순간", "내 시계 +60초 (시간 무제한이면 +2점)", "즉시"),
  // ---------- 희귀 9 ----------
  A("anchor", "rare", "anchor", "닻 내리기", "arm", 1, "켜고 돌을 놓을 때", "이번에 놓는 돌은 끝까지 안 뒤집혀요", "1회"),
  A("steal", "rare", "hand", "강탈", "free", 1, "상대 돌 (모서리·고정 제외) · 12수부터", "상대 돌 1개를 내 돌로 바꿔요", "1회", { target: "oppDisc", minMoves: 12 }),
  A("eraser", "rare", "eraser", "지우개", "free", 2, "상대 돌 (모서리·고정 제외) · 8수부터", "상대 돌 1개를 지워 빈 칸으로 만들어요", "2회", { target: "oppDisc", minMoves: 8 }),
  A("cornerSeal", "rare", "lock", "모서리 봉인", "free", 1, "빈 모서리", "그 모서리를 상대 3차례 동안 아무도 못 두게 막아요", "1회", { target: "emptyCorner" }),
  A("freeze", "rare", "snow", "빙결", "free", 1, "상대의 다음 차례", "상대는 다음 차례에 변·모서리에 못 둬요 (둘 곳이 그것뿐이면 풀려요)", "1회", { target: null }),
  A("ghost", "rare", "ghost", "유령 착수", "action", 2, "돌 옆 빈 칸", "뒤집기 없이 내 돌 1개를 놓고 차례를 마쳐요", "2회", { target: "adj" }),
  A("conqueror", "rare", "crown", "정복자", "passive", null, "끝날 때 내 모서리", "모서리 1개마다 +3점", "끝날 때"),
  A("inspire", "rare", "spark", "기세", "arm", 2, "켜고 돌을 놓을 때", "이번 수로 뒤집은 돌이 전부 상대 2차례 동안 안 뒤집혀요", "2회"),
  A("reserve", "rare", "pin", "내 자리", "free", 2, "빈 칸 (모서리 제외)", "그 칸은 상대 4차례 동안 상대만 못 둬요", "2회", { target: "empty" }),
  // ---------- 영웅 8 ----------
  A("bomb", "epic", "bomb", "폭탄 돌", "arm", 1, "켜고 돌을 놓을 때", "놓은 돌 주변 8칸의 상대 돌도 전부 내 돌로 (모서리·고정 제외)", "1회"),
  A("doubleMove", "epic", "double", "연속 착수", "arm", 1, "켜고 돌을 놓을 때", "이번 수 뒤 한 번 더 둬요 (둘 곳이 있으면)", "1회"),
  A("rewind", "epic", "rewind", "되감기", "action", 1, "상대가 방금 돌을 놓았을 때", "상대의 직전 수를 무르고, 상대는 그 칸에 다시 못 둬요", "1회", { target: null }),
  A("plague", "epic", "virus", "전염", "passive", null, "내가 모서리를 차지할 때", "그 모서리와 맞닿은 상대 돌 3칸도 내 돌로 (고정 제외)", "판 전체"),
  A("blackhole", "epic", "hole", "블랙홀", "free", 1, "2×2 칸 · 20수부터", "그 안의 돌을 모두 없애요 (모서리 돌은 남아요)", "1회", { target: "area", minMoves: 20 }),
  A("fortress", "epic", "castle", "요새", "instant", null, "고르는 순간", "지금 내 변·모서리 돌이 전부 끝까지 안 뒤집혀요", "즉시"),
  A("sweep", "epic", "broom", "쓸어 담기", "free", 1, "내 돌 · 24수부터", "그 돌의 가로 줄에서 가까운 상대 돌 3개를 내 돌로 (모서리·고정 제외)", "1회", { target: "ownRow", minMoves: 24 }),
  A("comeback", "epic", "phoenix", "역전의 발판", "passive", 1, "내 차례 시작에 돌이 상대보다 12개 이상 적을 때", "내 돌과 맞닿은 상대 돌 4개를 내 돌로 + 2점", "1회"),
  // ---------- 전설 5 ----------
  A("godHand", "legendary", "god", "신의 손", "action", 1, "빈 칸 아무 데나 · 20수부터", "규칙 무시하고 돌을 놓고, 그 칸에서 8방향으로 뒤집어요", "1회", { target: "any", minMoves: 20 }),
  A("timeStop", "legendary", "stop", "시간 정지", "arm", 1, "켜고 돌을 놓을 때", "이번 수 뒤 연달아 2번 더 둬요 (둘 곳이 있으면)", "1회"),
  A("goldRush", "legendary", "gold", "황금 돌", "instant", null, "고르는 순간", "내 돌 중 가장 좋은 자리 3개가 황금 돌: 끝까지 안 뒤집히고 끝날 때 1개당 +2점", "즉시"),
  A("kingCorner", "legendary", "king", "모서리의 왕", "instant", null, "고르는 순간", "지금 비어 있는 모서리는 상대 8차례 동안 상대만 못 둬요", "상대 8차례"),
  A("reversal", "legendary", "storm", "대역전", "passive", 1, "내 차례 시작에 돌이 상대의 절반 이하일 때", "판 가운데 4×4의 상대 돌(고정 제외)이 전부 내 돌로", "1회"),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const WEIGHTS = [
  { common: 60, rare: 30, epic: 9, legendary: 1 },
  { common: 30, rare: 40, epic: 24, legendary: 6 },
  { common: 12, rare: 33, epic: 37, legendary: 18 },
];
export function rollOffer(pickIdx, owned = [], rng = Math.random, n = 3, exclude = []) {
  const w = WEIGHTS[Math.min(pickIdx, WEIGHTS.length - 1)];
  const pool = AUGS.filter(a => !owned.includes(a.id) && !exclude.includes(a.id));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let tot = 0; for (const a of pool) tot += w[a.rarity];
    let x = rng() * tot, i = 0;
    for (; i < pool.length - 1; i++) { x -= w[pool[i].rarity]; if (x <= 0) break; }
    out.push(pool[i].id); pool.splice(i, 1);
  }
  return out;
}

const stealable = (S, s, c) => { const d = S.b[s]; return !!d && d.c === opp(c) && !isCorner(s) && !isFixed(S, s); };
/** 증강 대상 후보 칸 (free/action) */
export function targets(S, c, id) {
  const d = AUG[id], t = d.target, out = [];
  switch (t) {
    case "empty": for (let s = 0; s < 64; s++) if (!S.b[s] && !isCorner(s) && !blockedAll(S, s)) out.push(s); break;
    case "emptyCorner": for (const s of CORNERS) if (!S.b[s] && !blockedAll(S, s)) out.push(s); break;
    case "oppDisc": for (let s = 0; s < 64; s++) if (stealable(S, s, c)) out.push(s); break;
    case "ownDisc": for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && !isFixed(S, s)) out.push(s); break;
    case "adj": return adjEmpty(S, c);
    case "any": for (let s = 0; s < 64; s++) if (!S.b[s] && !blockedFor(S, s, c)) out.push(s); break;
    case "area": for (let s = 0; s < 64; s++) if ((s & 7) < 7 && (s >> 3) < 7 && area(s).some(q => S.b[q] && !isCorner(q))) out.push(s); break;
    case "ownRow": for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && sweepList(S, c, s).length) out.push(s); break;
    default: return [];
  }
  return out;
}
export const area = (s) => [s, s + 1, s + 8, s + 9];
export function sweepList(S, c, s) {
  const r = rowOf(s), list = [];
  for (let f = 0; f < 8; f++) { const q = r * 8 + f; if (stealable(S, q, c)) list.push(q); }
  return list.sort((a, b) => Math.abs(a - s) - Math.abs(b - s)).slice(0, 3);
}
/** 자동으로 고르는 가장 좋은 상대 돌 (연쇄·응급 처치·역전) */
export function bestBy(list, n = 1) { return [...list].sort((a, b) => WEIGHT[b] - WEIGHT[a] || a - b).slice(0, n); }
export function chainTarget(S, c, sq) { return bestBy(NEIGH[sq].filter(s => stealable(S, s, c)), 1); }
export function bombTargets(S, c, sq) { return NEIGH[sq].filter(s => stealable(S, s, c)); }
export function comebackTargets(S, c) { const set = new Set(); for (let s = 0; s < 64; s++) if (S.b[s]?.c === c) for (const n of NEIGH[s]) if (stealable(S, n, c)) set.add(n); return bestBy([...set], 4); }
export function reversalTargets(S, c) { const out = []; for (let r = 2; r < 6; r++) for (let f = 2; f < 6; f++) { const s = r * 8 + f; const d = S.b[s]; if (d && d.c === opp(c) && !isFixed(S, s)) out.push(s); } return out; }
export function goldTargets(S, c) { const mine = []; for (let s = 0; s < 64; s++) if (S.b[s]?.c === c && !S.b[s].gold) mine.push(s); return bestBy(mine, 3); }
export { count, isEdge, isCorner, FOREVER, flipsFor };
