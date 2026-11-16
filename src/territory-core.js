// =========================
// DUO TERRITORY (증강 땅따먹기) — 판정 엔진 (순수 함수, 2026-11-16)
//
// [판정 명세]
// 1. 맵은 W×H 칸. owner[c] = 0(중립) 또는 플레이어번호+1. trail[c] = 0 또는 궤적 주인+1 (영토와 별개 층)
// 2. 이동은 칸 중심 → 이웃 칸 중심 (상하좌우). 칸에 '들어가는 순간'에만 판정. 바로 뒤로 돌기(180°)는 불가
// 3. 안전 칸 = 내 영토 (팀전 '영토 공유'가 켜져 있으면 팀원 영토도)
// 4. 안전 칸 밖으로 나가면 들어가는 칸마다 내 궤적. 안전 칸으로 다시 들어오면 '점령':
//    ① 내 궤적 칸을 전부 내 영토로 ② 내 영토(공유 시 팀 영토)를 벽으로 보고, 바깥에서 물을 채우듯 채워
//    물이 닿지 않은 칸 = 둘러싸인 칸 → 내 영토로 (공유 시 팀원 칸은 그대로 둠)
//    '바깥' = 내 영토를 감싸는 사각형(1칸 여유)의 테두리 + 맵 가장자리. 맵 가장자리는 벽이 아님
//    (가장자리에 붙은 땅은 둘러싸인 것으로 보지 않음)
// 5. 같은 틱 처리 순서: ①모두 이동 ②궤적 충돌 판정(동시: 서로 치면 둘 다 탈락) ③살아남은 사람만 점령
//    (점령 직전에 궤적을 맞으면 탈락이 먼저) ④점령은 플레이어 번호 순 — 같은 칸을 같은 틱에 둘이
//    점령하면 나중 순서가 가져감(실제로는 궤적이 겹칠 수 없어 거의 없음)
// 6. 상대 궤적 칸에 들어가면 그 상대 탈락(보호막 등 예외). 내 궤적에 들어가면 나 탈락
//    같은 칸에 같은 틱에 둘이 들어오고 둘 다 궤적이 있으면 둘 다 탈락. 팀원 궤적은 무해
// =========================
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 위·오른쪽·아래·왼쪽
export const opposite = (d) => (d + 2) & 3;
export function makeGrid(W, H) { return { W, H, owner: new Uint8Array(W * H), trail: new Uint8Array(W * H), block: new Uint8Array(W * H) }; }
export const idx = (G, x, y) => y * G.W + x;
export const inside = (G, x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H;
export function neighbor(G, c, d) { const x = (c % G.W) + DIRS[d][0], y = ((c / G.W) | 0) + DIRS[d][1]; return inside(G, x, y) ? y * G.W + x : -1; }

/**
 * 점령 계산 — owner 를 직접 바꾸고 바뀐 칸 목록을 돌려줌
 * @param pid1 점령하는 사람 (번호+1)
 * @param trailCells 그 사람 궤적 칸들
 * @param isWall (o) => 이 주인 값이 '내 편 벽'인지 (기본: o === pid1)
 * @returns { changed: [[칸, 이전 주인], ...], filled: 둘러싸여 새로 얻은 칸 수 }
 */
export function capture(G, pid1, trailCells, isWall = (o) => o === pid1) {
  const { W, H, owner } = G, changed = [];
  for (const c of trailCells) if (owner[c] !== pid1) { if (!isWall(owner[c])) { changed.push([c, owner[c]]); owner[c] = pid1; } }
  // 내 편 벽의 경계 사각형 (1칸 여유)
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let c = 0; c < W * H; c++) if (isWall(owner[c])) { const x = c % W, y = (c / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { changed, filled: 0 };
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, seen = new Uint8Array(bw * bh), stack = [];
  const push = (x, y) => { const l = (y - y0) * bw + (x - x0); if (seen[l]) return; if (isWall(owner[y * W + x])) return; seen[l] = 1; stack.push(x, y); };
  // 바깥에서 물 붓기: 사각형 테두리 + (사각형이 맵 끝에 닿았다면 그 줄) 전부 씨앗
  for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
  for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x > x0) push(x - 1, y); if (x < x1) push(x + 1, y); if (y > y0) push(x, y - 1); if (y < y1) push(x, y + 1);
  }
  let filled = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (seen[(y - y0) * bw + (x - x0)]) continue;
    const c = y * W + x; if (isWall(owner[c])) continue;
    changed.push([c, owner[c]]); owner[c] = pid1; filled++;
  }
  return { changed, filled };
}
/** 사각형 칸 목록 (맵 안만) */
export function rect(G, cx, cy, r) { const out = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(G, x, y)) out.push(y * G.W + x); return out; }
export function circle(G, cx, cy, r) { const out = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(G, x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r) out.push(y * G.W + x); return out; }
/** 칸 수 세기 (owner 값별) */
export function countOwners(G, n) { const a = new Array(n + 1).fill(0); for (let i = 0; i < G.owner.length; i++) a[G.owner[i]]++; return a; }
/** 영토 RLE: [시작, 길이, 주인, ...] — 주인 0 은 생략 */
export function rle(arr) { const out = []; let i = 0; const n = arr.length; while (i < n) { const v = arr[i]; let j = i + 1; while (j < n && arr[j] === v) j++; if (v) out.push(i, j - i, v); i = j; } return out; }
/** 바뀐 칸 [[칸, 새 주인]] → RLE 묶음 [시작, 길이, 주인, ...] */
export function rleChanges(map) { const cells = [...map.keys()].sort((a, b) => a - b), out = []; let i = 0; while (i < cells.length) { const s = cells[i], v = map.get(s); let j = i + 1; while (j < cells.length && cells[j] === s + (j - i) && map.get(cells[j]) === v) j++; out.push(s, j - i, v); i = j; } return out; }
/** 간단 체크섬 (클라이언트와 같은 식) */
export function checksum(arr) { let h = 2166136261; for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
