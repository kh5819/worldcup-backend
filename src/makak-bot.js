// =========================
// 막아막아 — AI 상대 (솔로 모드)
// 엔진 함수는 makak.js 가 E 로 넘겨준다 (순환 import 방지).
// 반환: { type:"move", row, col } | { type:"wall", orientation, row, col } | { type:"skill", ...payload }
// =========================

const LEVEL = {
  easy:   { wallMin: 3.5, wallChance: 0.35, skillChance: 0.3, noise: 0.35 },
  normal: { wallMin: 2.0, wallChance: 0.8,  skillChance: 0.6, noise: 0.12 },
  hard:   { wallMin: 1.2, wallChance: 1.0,  skillChance: 0.9, noise: 0 },
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function chooseBotAction(E, room, uid, level = "normal") {
  const L = LEVEL[level] || LEVEL.normal;
  const p = room.players.get(uid);
  const myDist = E.bfsDist(room, p.row, p.col, p.side);

  const enemies = [...room.players.entries()]
    .filter(([id, x]) => id !== uid && x.alive && E.isEnemy(room, uid, id));
  const enemyBefore = enemies.map(([, x]) => E.bfsDist(room, x.row, x.col, x.side) ?? 99);

  // 1) 스킬
  const skill = tryBotSkill(E, room, uid, p, L, myDist, enemies, enemyBefore);
  if (skill) return skill;

  // 2) 벽 (가장 이득이 큰 슬롯)
  if (E.getWallPool(room, p) > 0 && enemies.length && Math.random() < L.wallChance) {
    const best = bestWall(E, room, p, enemies, enemyBefore, myDist);
    if (best && best.score >= L.wallMin) {
      return { type: "wall", orientation: best.o, row: best.r, col: best.c };
    }
  }

  // 3) 이동: 결승선까지 최단거리가 가장 줄어드는 칸
  const moves = E.getLegalMoves(room, p);
  if (!moves.length) return null;
  let best = null, bestD = Infinity;
  for (const m of moves) {
    let d = E.bfsDist(room, m.row, m.col, p.side);
    if (d == null) continue;
    d += Math.random() * L.noise * 3; // 약한 난이도는 가끔 비효율 선택
    if (d < bestD) { bestD = d; best = m; }
  }
  if (!best) best = pick(moves);
  return { type: "move", row: best.row, col: best.col };
}

function bestWall(E, room, p, enemies, enemyBefore, myDist) {
  let best = null;
  for (const o of ["H", "V"]) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!E.canPlaceWall(room.walls, o, r, c)) continue;
        const slot = o === "H" ? room.walls.horizontal : room.walls.vertical;
        const k = `${r},${c}`;
        slot[k] = true;
        let score = null;
        if (E.allPlayersHavePath(room)) {
          let gain = 0;
          enemies.forEach(([, x], i) => {
            const after = E.bfsDist(room, x.row, x.col, x.side) ?? 99;
            const w = 1 / (1 + enemyBefore[i] / 3); // 결승선에 가까운 적일수록 가중
            gain += (after - enemyBefore[i]) * (1 + w * 2);
          });
          const meAfter = E.bfsDist(room, p.row, p.col, p.side) ?? 99;
          score = gain - 0.8 * Math.max(0, meAfter - myDist);
        }
        delete slot[k];
        if (score != null && (!best || score > best.score)) best = { o, r, c, score };
      }
    }
  }
  return best;
}

function tryBotSkill(E, room, uid, p, L, myDist, enemies, enemyBefore) {
  const st = E.getSkillTargets(room, uid, p);
  if (!st || Math.random() > L.skillChance) return null;
  const id = st.skill;

  if (id === "dash" || id === "blink" || id === "phase") {
    let best = null;
    for (const t of st.cells) {
      const d = E.bfsDist(room, t.row, t.col, p.side);
      if (d == null) continue;
      if (!best || d < best.d) best = { d, t };
    }
    if (best && myDist - best.d >= 2) return { type: "skill", row: best.t.row, col: best.t.col };
    return null;
  }
  if (id === "smash") {
    let best = null;
    for (const w of st.walls) {
      const slot = w.orientation === "H" ? room.walls.horizontal : room.walls.vertical;
      const k = `${w.row},${w.col}`;
      delete slot[k];
      const d = E.bfsDist(room, p.row, p.col, p.side);
      slot[k] = true;
      if (d != null && (!best || d < best.d)) best = { d, w };
    }
    if (best && myDist - best.d >= 2) return { type: "skill", orientation: best.w.orientation, row: best.w.row, col: best.w.col };
    return null;
  }
  if (id === "freeze") {
    // 결승선에 가장 가까운 적을 얼린다 (4칸 이내일 때만)
    let best = null;
    for (const t of st.cells) {
      const idx = enemies.findIndex(([, x]) => x.row === t.row && x.col === t.col);
      const d = idx >= 0 ? enemyBefore[idx] : 99;
      if (d <= 4 && (!best || d < best.d)) best = { d, t };
    }
    return best ? { type: "skill", row: best.t.row, col: best.t.col } : null;
  }
  if (id === "steal") {
    return st.auto ? { type: "skill" } : null;
  }
  return null; // knock / dwall / trap 은 봇이 쓰지 않는다
}
