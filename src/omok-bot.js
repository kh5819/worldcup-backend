// =========================
// DUO 오목 AI (서버) — omok.js 에서 봇 차례에 호출
// - 승리 길이 N(3/4/5), 보드 15/19/25, 다인전(색 최대 8), 팀전(팀=같은 색)에 모두 대응
// - 방식: "N칸 창(window)" 점수. 둘 칸을 지나는 모든 창에서 (필요한 돌 수)가 적을수록 고득점.
//   · 내 승리 > 상대 승리 막기 > 공격점수+수비점수. 난이도는 선택의 정확도/탐색 깊이로 구분
// - 순수 함수(방 상태를 읽기만 함). 착수는 omok.js 의 placeStone 이 검증
// =========================

const WIN = 1_000_000;

// 창 안에 "앞으로 더 필요한 돌 수(rem)" 별 점수
function remValue(rem) {
  switch (rem) {
    case 0: return WIN;
    case 1: return 10_000;
    case 2: return 300;
    case 3: return 20;
    case 4: return 2;
    default: return 0;
  }
}

const LEVELS = {
  //          공격 수비  동작
  easy:   { att: 0.8, def: 0.55, pool: 6, topBias: 0.45, blockWin: 0.65, depth2: 0, noise: 0.35, bonus: 0, vcf: 0 },
  normal: { att: 1.0, def: 0.9,  pool: 3, topBias: 0.8,  blockWin: 1,    depth2: 0, noise: 0.08, bonus: 0.5, vcf: 0 },
  hard:   { att: 1.6, def: 1.0,  pool: 1, topBias: 1,    blockWin: 1,    depth2: 8, noise: 0, bonus: 1, vcf: 7 },
};
export const OMOK_BOT_LEVELS = Object.keys(LEVELS);

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/**
 * (x,y)에 color 돌을 놓았을 때의 점수. 이미 놓인 돌/벽 판정은 호출 전에.
 * 반환 값이 WIN 이상이면 그 칸에 두면 즉시 N목 완성.
 * bonusScale: 이중 위협(4-4, 4-3, 3-3, 열린 4) 보너스 반영 비율 (0=모름, 1=완전)
 */
function scoreCell(board, size, n, x, y, color, blk, bonusScale = 1) {
  let total = 0;
  let fourDirs = 0, threeDirs = 0, openFour = false;
  for (const [dx, dy] of DIRS) {
    let c1 = 0, c2 = 0;      // 이 방향에서 "하나만 더(rem1)" / "둘 더(rem2)" 창 개수
    for (let s = -(n - 1); s <= 0; s++) {
      const sx = x + s * dx, sy = y + s * dy;
      const ex = sx + (n - 1) * dx, ey = sy + (n - 1) * dy;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
      let own = 1, ok = true;
      for (let k = 0; k < n; k++) {
        const cx = sx + k * dx, cy = sy + k * dy;
        if (cx === x && cy === y) continue;
        const ci = cy * size + cx;
        const v = board[ci];
        if (v === color) own++;
        else if (v !== 0 || blk[ci]) { ok = false; break; }
      }
      if (!ok) continue;
      const rem = n - own;
      total += remValue(rem);
      if (rem === 1) c1++;
      else if (rem === 2) c2++;
    }
    if (c1 >= 1) fourDirs++;
    if (c1 >= 2) openFour = true;
    if (n >= 4 && c2 >= 2) threeDirs++;   // n=3 에서 rem2 는 돌 1개라 위협이 아님
  }
  if (bonusScale > 0 && total < WIN) {
    let bonus = 0;
    if (openFour) bonus = 200_000;
    else if (fourDirs >= 2) bonus = 150_000;
    else if (fourDirs >= 1 && threeDirs >= 1) bonus = 80_000;
    else if (threeDirs >= 2) bonus = 20_000;
    total += bonus * bonusScale;
  }
  return total;
}

/**
 * (x,y)에 color 돌을 놓으면 "하나만 더 두면 이기는" 칸(완성 칸)들. 이미 (x,y)는 비어 있다고 가정.
 * 2개 이상이면 상대가 한 번에 못 막는 열린 4 / 쌍 4.
 */
function completionCells(board, size, n, x, y, color, blk) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    for (let s = -(n - 1); s <= 0; s++) {
      const sx = x + s * dx, sy = y + s * dy;
      const ex = sx + (n - 1) * dx, ey = sy + (n - 1) * dy;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
      let own = 1, ok = true, empty = -1, emptyCount = 0;
      for (let k = 0; k < n; k++) {
        const cx = sx + k * dx, cy = sy + k * dy;
        if (cx === x && cy === y) continue;
        const ci = cy * size + cx;
        const v = board[ci];
        if (v === color) own++;
        else if (v === 0 && !blk[ci]) { empty = ci; emptyCount++; }
        else { ok = false; break; }
      }
      if (ok && own === n - 1 && emptyCount === 1 && !out.includes(empty)) out.push(empty);
    }
  }
  return out;
}

/** color 가 지금 두면 바로 이기는 칸이 있는가 */
function hasWinningCell(board, size, n, blk, color, cells) {
  for (const i of cells) {
    if (board[i] !== 0 || blk[i]) continue;
    if (scoreCell(board, size, n, i % size, Math.floor(i / size), color, blk, 0) >= WIN) return true;
  }
  return false;
}

/** color 돌 주변 2칸 이내 빈 칸 */
function cellsNear(board, size, blk, color) {
  const near = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y * size + x] !== color) continue;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(size - 1, y + 2); yy++) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(size - 1, x + 2); xx++) near[yy * size + xx] = 1;
      }
    }
  }
  const out = [];
  for (let i = 0; i < near.length; i++) if (near[i] && board[i] === 0 && !blk[i]) out.push(i);
  return out;
}

/**
 * VCF: "4를 연달아 만들어(상대는 막을 수밖에 없음) 끝내 이기는" 수순 탐색. (1:1 상대 전용)
 * 이기는 수순이 있으면 그 첫 수의 칸 인덱스, 없으면 -1. budget.nodes 가 0이 되면 중단.
 */
function vcfSearch(board, size, n, blk, me, enemy, depth, budget) {
  if (depth <= 0 || budget.nodes <= 0) return -1;
  const cands = cellsNear(board, size, blk, me);
  const enemyCells = cellsNear(board, size, blk, enemy);
  for (const c of cands) {
    if (budget.nodes <= 0) return -1;
    const cx = c % size, cy = Math.floor(c / size);
    const threats = completionCells(board, size, n, cx, cy, me, blk);
    if (threats.length === 0) continue;
    budget.nodes--;
    board[c] = me;
    let won = false;
    if (threats.length >= 2) {
      // 상대가 먼저 이기지 못하면 열린 4/쌍 4 = 승리
      won = !hasWinningCell(board, size, n, blk, enemy, enemyCells);
    } else {
      const t = threats[0];
      const tx = t % size, ty = Math.floor(t / size);
      // 상대의 유일한 방어가 그대로 상대의 5목이 되면 실패
      const blockWins = scoreCell(board, size, n, tx, ty, enemy, blk, 0) >= WIN;
      if (!blockWins && !hasWinningCell(board, size, n, blk, enemy, enemyCells)) {
        board[t] = enemy;
        // 막은 결과 상대가 바로 이길 수 있게 되면(역습) 이 수순은 버린다
        const counter = hasWinningCell(board, size, n, blk, enemy, cellsNear(board, size, blk, enemy));
        if (!counter) won = vcfSearch(board, size, n, blk, me, enemy, depth - 1, budget) >= 0;
        board[t] = 0;
      }
    }
    board[c] = 0;
    if (won) return c;
  }
  return -1;
}

function buildBlockMask(room) {
  const size = room.boardSize;
  const blk = new Uint8Array(size * size);
  const mark = (map) => {
    if (!map) return;
    for (const key of map.keys()) {
      const [x, y] = key.split(",").map(Number);
      if (Number.isInteger(x) && Number.isInteger(y)) blk[y * size + x] = 1;
    }
  };
  mark(room.walls);
  mark(room.ghosts);
  return blk;
}

/** 돌 주변 2칸 이내의 빈 칸 후보 (돌이 하나도 없으면 null) */
function candidateCells(board, size, blk) {
  const near = new Uint8Array(size * size);
  let any = false;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y * size + x] === 0) continue;
      any = true;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(size - 1, y + 2); yy++) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(size - 1, x + 2); xx++) near[yy * size + xx] = 1;
      }
    }
  }
  if (!any) return null;
  const out = [];
  for (let i = 0; i < near.length; i++) {
    if (near[i] && board[i] === 0 && !blk[i]) out.push(i);
  }
  return out;
}

function weightedPick(sorted, pool, topBias) {
  const top = sorted.slice(0, pool);
  if (top.length === 1 || Math.random() < topBias) return top[0];
  const w = top.map((_, i) => top.length - i);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) return top[i]; }
  return top[0];
}

/**
 * 봇의 다음 착수 좌표를 고른다. 둘 곳이 없으면 null.
 * @param room   omok.js 의 room (board/boardSize/winLength/players/walls/ghosts)
 * @param botUid 봇 userId
 * @param level  'easy' | 'normal' | 'hard'
 */
export function chooseOmokMove(room, botUid, level = "normal") {
  const L = LEVELS[level] || LEVELS.normal;
  const size = room.boardSize;
  const n = Math.max(3, Math.min(5, room.winLength || 5));
  const board = room.board;
  const me = room.players.get(botUid);
  if (!me || !me.color) return null;
  const myColor = me.color;

  const enemyColors = [];
  for (const p of room.players.values()) {
    if (p.color && p.color !== myColor && !enemyColors.includes(p.color)) enemyColors.push(p.color);
  }
  const blk = buildBlockMask(room);

  let cands = candidateCells(board, size, blk);
  if (cands === null) {
    // 첫 수: 중앙 근처
    const c = Math.floor(size / 2);
    const jx = c + Math.floor(Math.random() * 3) - 1, jy = c + Math.floor(Math.random() * 3) - 1;
    if (board[jy * size + jx] === 0 && !blk[jy * size + jx]) return { x: jx, y: jy };
    cands = [];
    for (let i = 0; i < board.length; i++) if (board[i] === 0 && !blk[i]) cands.push(i);
  }
  if (cands.length === 0) {
    for (let i = 0; i < board.length; i++) if (board[i] === 0 && !blk[i]) cands.push(i);
    if (cands.length === 0) return null;
  }
  const toXY = (i) => ({ x: i % size, y: Math.floor(i / size) });

  // 1) 내가 바로 이기는 칸
  const mine = new Map();
  for (const i of cands) {
    const { x, y } = toXY(i);
    const s = scoreCell(board, size, n, x, y, myColor, blk, L.bonus);
    mine.set(i, s);
    if (s >= WIN) return { x, y };
  }

  // 2) 상대가 바로 이기는 칸 막기
  const theirs = new Map();   // i → 가장 큰 상대 점수
  const winCells = [];
  for (const i of cands) {
    const { x, y } = toXY(i);
    let best = 0, sum = 0;
    for (const e of enemyColors) {
      const s = scoreCell(board, size, n, x, y, e, blk, L.bonus);
      sum += s;
      if (s > best) best = s;
    }
    theirs.set(i, { best, sum });
    if (best >= WIN) winCells.push(i);
  }
  if (winCells.length && Math.random() < L.blockWin) {
    winCells.sort((a, b) => (mine.get(b) || 0) - (mine.get(a) || 0));
    return toXY(winCells[0]);
  }

  // 2.5) 어려움(1:1): 4를 연달아 몰아붙여 이기는 수순이 있으면 그대로 실행
  const duel = enemyColors.length === 1;
  if (L.vcf && duel) {
    const c = vcfSearch(board, size, n, blk, myColor, enemyColors[0], L.vcf, { nodes: 600 });
    if (c >= 0) return toXY(c);
  }

  // 3) 공격+수비 점수
  const center = (size - 1) / 2;
  const scored = cands.map((i) => {
    const { x, y } = toXY(i);
    const t = theirs.get(i);
    const def = t.best + 0.25 * (t.sum - t.best);
    const centerBias = -(Math.abs(x - center) + Math.abs(y - center)) * 0.05;
    const noise = L.noise ? (Math.random() - 0.5) * L.noise * 40 : 0;
    return { i, x, y, score: mine.get(i) * L.att + def * L.def + centerBias + noise };
  });
  scored.sort((a, b) => b.score - a.score);

  // 4) 어려움: 상위 후보를 놓아 본 뒤 상대의 최선 반격(점수)을 빼서 재평가
  if (L.depth2 > 0 && scored.length > 1) {
    const K = Math.min(L.depth2, scored.length);
    for (let k = 0; k < K; k++) {
      const m = scored[k];
      board[m.i] = myColor;
      let oppBest = 0;
      const around = candidateCells(board, size, blk) || [];
      for (const j of around) {
        const jx = j % size, jy = Math.floor(j / size);
        for (const e of enemyColors) {
          const s = scoreCell(board, size, n, jx, jy, e, blk, L.bonus);
          if (s > oppBest) oppBest = s;
        }
        if (oppBest >= WIN) break;
      }
      let vcfPenalty = 0;
      if (L.vcf && duel && oppBest < WIN) {
        if (vcfSearch(board, size, n, blk, enemyColors[0], myColor, L.vcf, { nodes: 150 }) >= 0) vcfPenalty = 400_000;
      }
      board[m.i] = 0;
      m.final = m.score - 0.7 * oppBest - vcfPenalty;
    }
    const head = scored.slice(0, K).sort((a, b) => b.final - a.final);
    return { x: head[0].x, y: head[0].y };
  }

  const pick = weightedPick(scored, L.pool, L.topBias);
  return { x: pick.x, y: pick.y };
}
