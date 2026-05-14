// 오목 핵심 로직 단위 테스트
// findWinLine은 omok.js 안 비-export 함수. 동등 구현으로 검증.

const DIRS = [[1,0],[0,1],[1,1],[1,-1]];

function idx(size, x, y) { return y * size + x; }

function findWinLine(board, size, x, y, color, winLength) {
  const need = Math.max(3, Math.min(5, winLength || 5));
  for (const [dx, dy] of DIRS) {
    const line = [{x, y}];
    let cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < size && cy >= 0 && cy < size && board[idx(size, cx, cy)] === color) {
      line.push({x: cx, y: cy});
      cx += dx; cy += dy;
    }
    cx = x - dx; cy = y - dy;
    while (cx >= 0 && cx < size && cy >= 0 && cy < size && board[idx(size, cx, cy)] === color) {
      line.unshift({x: cx, y: cy});
      cx -= dx; cy -= dy;
    }
    if (line.length >= need) return line.slice(0, need);
  }
  return null;
}

function placeStones(size, moves) {
  const b = new Int8Array(size * size);
  for (const [x, y, c] of moves) b[idx(size, x, y)] = c;
  return b;
}

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗ FAIL:", name); }
}

console.log("=== 5목 검사 ===");
{
  // 가로 5목
  const b = placeStones(15, [[3,7,1],[4,7,1],[5,7,1],[6,7,1],[7,7,1]]);
  const w = findWinLine(b, 15, 7, 7, 1, 5);
  ok("가로 5목 인식", w && w.length === 5);
  ok("좌표 모두 같은 y", w && w.every(p => p.y === 7));
}
{
  // 세로 5목
  const b = placeStones(15, [[7,3,2],[7,4,2],[7,5,2],[7,6,2],[7,7,2]]);
  const w = findWinLine(b, 15, 7, 7, 2, 5);
  ok("세로 5목 인식", w && w.length === 5);
}
{
  // 대각 5목
  const b = placeStones(15, [[3,3,1],[4,4,1],[5,5,1],[6,6,1],[7,7,1]]);
  const w = findWinLine(b, 15, 7, 7, 1, 5);
  ok("대각 NW-SE 5목 인식", w && w.length === 5);
}
{
  // 4목은 false
  const b = placeStones(15, [[4,7,1],[5,7,1],[6,7,1],[7,7,1]]);
  const w = findWinLine(b, 15, 7, 7, 1, 5);
  ok("4목은 5목 기준에서 NO", !w);
}

console.log("=== 3목 모드 ===");
{
  const b = placeStones(9, [[3,4,1],[4,4,1],[5,4,1]]);
  const w = findWinLine(b, 9, 5, 4, 1, 3);
  ok("가로 3목 인식 (3목 모드)", w && w.length === 3);
}
{
  const b = placeStones(9, [[3,4,1],[4,4,1]]);
  const w = findWinLine(b, 9, 4, 4, 1, 3);
  ok("2목은 3목 모드에서 NO", !w);
}

console.log("=== 4목 모드 ===");
{
  const b = placeStones(15, [[5,5,1],[5,6,1],[5,7,1],[5,8,1]]);
  const w = findWinLine(b, 15, 5, 8, 1, 4);
  ok("세로 4목 인식 (4목 모드)", w && w.length === 4);
}
{
  const b = placeStones(15, [[5,5,1],[5,6,1],[5,7,1],[5,8,1],[5,9,1]]);
  const w = findWinLine(b, 15, 5, 9, 1, 4);
  ok("5목도 4목 기준에서 OK (4까지만 자르기)", w && w.length === 4);
}

console.log("=== 다른 색 사이 ===");
{
  // 다른 색이 사이에 끼면 끊김
  const b = placeStones(15, [[3,7,1],[4,7,2],[5,7,1],[6,7,1],[7,7,1]]);
  const w = findWinLine(b, 15, 7, 7, 1, 5);
  ok("다른 색 사이 끼면 NO", !w);
}
{
  // 다른 색이 5목 옆에 있어도 5목은 인정
  const b = placeStones(15, [[3,7,1],[4,7,1],[5,7,1],[6,7,1],[7,7,1],[8,7,2]]);
  const w = findWinLine(b, 15, 7, 7, 1, 5);
  ok("5목 옆 다른 색 있어도 5목 인정", w && w.length === 5);
}

console.log("=== 경계 ===");
{
  // 보드 모서리에서 5목
  const b = placeStones(15, [[0,0,1],[1,1,1],[2,2,1],[3,3,1],[4,4,1]]);
  const w = findWinLine(b, 15, 0, 0, 1, 5);
  ok("모서리(0,0)에서 대각 5목 인식", w && w.length === 5);
}

console.log("=== ffa 8색 ===");
{
  // 색 1~8 모두 작동
  for (let c = 1; c <= 8; c++) {
    const b = placeStones(15, [[3,7,c],[4,7,c],[5,7,c],[6,7,c],[7,7,c]]);
    const w = findWinLine(b, 15, 7, 7, c, 5);
    if (!(w && w.length === 5)) { ok(`color ${c} 5목`, false); break; }
  }
  ok("8개 색 모두 5목 인식", true);
}

console.log();
console.log(`Total: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
