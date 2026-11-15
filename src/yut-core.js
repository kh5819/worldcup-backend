// =========================
// 플듀 증강 윷놀이 — 윷판·이동 규칙 (순수 계산, 상태는 바꾸지 않음)
//
// 윷판 29칸 (좌표 기반 노드 그래프)
//   바깥: 0(참먹이·출발점, 오른쪽 아래) → 1~4 위로 → 5(오른쪽 위 모서리) → 6~9 왼쪽 → 10(왼쪽 위)
//         → 11~14 아래로 → 15(왼쪽 아래) → 16~19 오른쪽 → 0
//   지름길: 5→20→21→22(방)→23→24→15  /  10→25→26→22(방)→27→28→0
//   갈림길: 모서리 5·10에 멈춘 말은 지름길/바깥길을, 방(22)에 멈춘 말은 출발점 쪽/반대쪽을 고름
//   출발점(0)에 딱 멈추면 아직 판 위(참먹이). 0을 "지나야" 완주
// 말 위치: -1 = 집(아직 안 나감), 0~28 = 판 위, 99 = 완주
// =========================

export const HOME = -1, DONE = 99;
export const NODE_COUNT = 29;
export const FORKS = [5, 10, 22];

// 화면 좌표 (0~100). 그림·애니메이션용 — 서버 판정엔 안 씀
export const NODE_XY = (() => {
  const xy = {};
  const S = 8, E = 92, step = (E - S) / 5;
  for (let i = 0; i <= 5; i++) xy[i] = [E, E - step * i];            // 0~5 오른쪽 줄 (아래→위)
  for (let i = 1; i <= 5; i++) xy[5 + i] = [E - step * i, S];        // 6~10 위쪽 줄
  for (let i = 1; i <= 5; i++) xy[10 + i] = [S, S + step * i];       // 11~15 왼쪽 줄
  for (let i = 1; i <= 4; i++) xy[15 + i] = [S + step * i, E];       // 16~19 아래쪽 줄
  const C = 50, lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  xy[22] = [C, C];
  xy[20] = lerp(xy[5], xy[22], 1 / 3); xy[21] = lerp(xy[5], xy[22], 2 / 3);
  xy[23] = lerp(xy[22], xy[15], 1 / 3); xy[24] = lerp(xy[22], xy[15], 2 / 3);
  xy[25] = lerp(xy[10], xy[22], 1 / 3); xy[26] = lerp(xy[10], xy[22], 2 / 3);
  xy[27] = lerp(xy[22], xy[0], 1 / 3); xy[28] = lerp(xy[22], xy[0], 2 / 3);
  return xy;
})();
export const EDGES = [
  ...Array.from({ length: 20 }, (_, i) => [i, (i + 1) % 20]),
  [5, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 15],
  [10, 25], [25, 26], [26, 22], [22, 27], [27, 28], [28, 0],
];

/**
 * 한 칸 앞으로 갈 수 있는 곳들 (첫 번째가 기본 길)
 * node: 지금 칸, prev: 직전 칸(방향), start: 이번 이동의 출발 칸인지(멈춰 있던 칸 = 갈림길 선택 가능)
 * flags: { passTurn: 지나가는 모서리에서도 꺾기(갈림길 지배자·경로 왜곡), gate15: 15에서 방으로(지름길 개방) }
 */
export function nextOptions(node, prev, start, flags = {}) {
  if (node === HOME) return [1];
  if (node === 0) return [DONE];
  switch (node) {
    case 5: return start || flags.passTurn ? [20, 6] : [6];
    case 10: return start || flags.passTurn ? [25, 11] : [11];
    case 15:
      if (prev === 24) return [16];
      return (start || flags.passTurn) && flags.gate15 ? [24, 16] : [16];
    case 20: return [21];
    case 21: return [22];
    case 25: return [26];
    case 26: return [22];
    case 27: return [28];
    case 28: return [0];
    case 23: return prev === 24 ? [22] : [24];
    case 24: return prev === 15 ? [23] : [15];
    case 22: {
      // 기본: 5쪽에서 오면 직진(23), 10쪽·15쪽에서 오면 출발점 쪽(27). 멈춰 있으면 둘 중 고름(출발점 쪽 먼저)
      // 15쪽 지름길(23)에서 들어온 말은 출발점 쪽(27)으로만 — 반대쪽(21)은 방으로 되돌아오는 막다른 길
      if (prev === 23) return [27];
      if (start || flags.passTurn) return [27, 23];
      if (prev === 21) return [23];
      return [27];
    }
  }
  return [node + 1 === 20 ? 0 : node + 1]; // 바깥 일반 칸 (19 → 0)
}

/**
 * pos(직전 칸 prev)에서 n칸 갈 때 도착할 수 있는 모든 길.
 * 반환: [{ to, steps:[지나간 칸…], route:"기본"|"지름길"|"바깥길"|… }] — 첫 번째가 기본
 */
export function forwardPaths(pos, prev, n, flags = {}) {
  const out = [];
  const seen = new Set();
  const walk = (node, pv, left, steps, first, label) => {
    if (left === 0 || node === DONE) {
      const key = steps.join(",");
      if (!seen.has(key)) { seen.add(key); out.push({ to: node, steps: steps.slice(), route: label || "기본" }); }
      return;
    }
    const opts = nextOptions(node, pv, first, flags);
    opts.forEach((nx, k) => {
      let lb = label;
      if (opts.length > 1 && !lb) lb = routeLabel(node, nx, k);
      walk(nx, node, left - 1, [...steps, nx], false, lb);
    });
  };
  walk(pos, prev, n, [], true, null);
  return out;
}
function routeLabel(node, nx, k) {
  if (node === 22) return nx === 27 ? "출발점 쪽" : "반대쪽";
  if (node === 15) return nx === 24 ? "지름길" : "바깥길";
  return k === 0 ? "지름길" : "바깥길";
}

/** 완주까지 가장 짧은 칸 수 (갈림길은 멈춰 있을 때만 선택 가능하다고 보고 계산) */
export function distLeft(pos, prev = null) {
  if (pos === DONE) return 0;
  // BFS: 상태 (node, prev, start)
  const q = [[pos, prev, true, 0]];
  const seen = new Set();
  while (q.length) {
    const [node, pv, st, d] = q.shift();
    if (node === DONE) return d;
    const key = node + ":" + pv + ":" + st;
    if (seen.has(key)) continue; seen.add(key);
    for (const nx of nextOptions(node, pv, st)) q.push([nx, node, false, d + 1]);
  }
  return 30;
}

// ---------------- 윷 던지기 ----------------
// 윷가락 4개, 각각 평평한 면(배)이 위로 올 확률 p. 0번 가락 배에 표시(빽도).
// 배 1개 = 도(그 하나가 표시 가락이면 빽도), 2 = 개, 3 = 걸, 4 = 윷, 0 = 모
export const RES = { BACKDO: -1, DO: 1, GAE: 2, GEOL: 3, YUT: 4, MO: 5 };
export const RES_LABEL = { [-1]: "빽도", 1: "도", 2: "개", 3: "걸", 4: "윷", 5: "모" };
export function throwSticks(rng = Math.random, { backdo = true, p = 0.5 } = {}) {
  const flat = [0, 1, 2, 3].map(() => rng() < p);
  return { sticks: flat, result: resultOf(flat, backdo) };
}
export function resultOf(flat, backdo = true) {
  const n = flat.filter(Boolean).length;
  if (n === 0) return 5; if (n === 4) return 4; if (n === 3) return 3; if (n === 2) return 2;
  return flat[0] && backdo ? -1 : 1;
}
/** 결과에 맞는 가락 모양 (증강으로 결과가 바뀌었을 때 그림용) */
export function sticksFor(result, rng = Math.random, backdo = true) {
  for (let t = 0; t < 300; t++) { const s = throwSticks(rng, { backdo }); if (s.result === result) return s.sticks; }
  return result === 5 ? [false, false, false, false] : result === 4 ? [true, true, true, true] : [false, true, false, false];
}
export const isBonus = (r) => r === 4 || r === 5;
