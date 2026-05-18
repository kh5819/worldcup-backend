// =========================
// 도망도망 (DUO Dodogo) — 멀티 팩맨 변종 서버
// 핵심:
//   - 모든 플레이어 같은 미로, 같은 유령 (서버 권위)
//   - 인원 스케일링: 유령 수 max(4, players+1), 속도 1 + (N-2)*0.025
//   - 위치/이동 = 클라 권위 + 서버 throttle relay
//   - 골드 먹기 = 서버 timestamp 권위 (race 해결)
//   - 유령 AI = 서버 5Hz tick + 위치 broadcast
//   - 충돌(유령↔플레이어) = 서버 매 tick 검사
// 이벤트 prefix: 'dodogo:*', socket room: `dodogo:${roomId}`
// =========================

const dodogoRooms = new Map();
const dodogoInvites = new Map();
const dodogoUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 3, 4, 5, 6, 7, 8];
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;

const GHOST_TICK_MS = 200;        // 유령 AI tick (5Hz)
const POS_BROADCAST_MS = 80;      // 플레이어 위치 broadcast throttle
const FRIGHTENED_DURATION = 8000; // 파워펠릿 8초
const STARTING_LIVES = 3;
const GAME_MAX_DURATION_MS = 10 * 60 * 1000;  // 한 라운드 최대 10분 (안전)

// ── 미로 데이터 (클라이언트와 동일하게 유지) ─────
// 클라의 dodogo.js MAZES와 한 글자 단위로 같아야 골드/벽/spawn 일치.
const MAZES = [
  {
    id: "classic", name: "클래식",
    data: [
      "###############",
      "#......#......#",
      "#o##.#.#.#.##.#",
      "#.............#",
      "#.##.#####.##.#",
      "#....#...#....#",
      "###.###.###.###",
      "  #.#  _  #.#  ",
      "###.# ### #.###",
      "   .  ###  .   ",
      "###.# ### #.###",
      "  #.#     #.#  ",
      "###.#######.###",
      "#......#......#",
      "#.##.#.#.#.##o#",
      "#.............#",
      "######S########",
    ],
    ghostSpawns: [
      { row: 7, col: 6 }, { row: 7, col: 8 },
      { row: 7, col: 5 }, { row: 7, col: 7 },
    ],
  },
  {
    id: "tunnel", name: "터널",
    data: [
      "###############",
      "#......#......#",
      "#.####.#.####.#",
      "#o....#.#.....#",
      "#.###.#.#.###.#",
      "#.....#.#.....#",
      "###.#.#_#.#.###",
      "   ...   ...   ",
      "###.#.# #.#.###",
      "#.....#.#.....#",
      "#.###.#.#.###.#",
      "#.....#.#....o#",
      "#.####.#.####.#",
      "#......S......#",
      "###############",
    ],
    ghostSpawns: [
      { row: 6, col: 7 }, { row: 7, col: 4 },
      { row: 7, col: 10 }, { row: 8, col: 7 },
    ],
  },
  {
    id: "plaza", name: "광장",
    data: [
      "###############",
      "#.............#",
      "#.###.###.###.#",
      "#.#.........#.#",
      "#.#.#######.#.#",
      "#.#.#.._..#.#.#",
      "#.#.#.# #.#.#.#",
      "#o....# #....o#",
      "#.#.#.# #.#.#.#",
      "#.#.#.._..#.#.#",
      "#.#.#######.#.#",
      "#.#.........#.#",
      "#.###.###.###.#",
      "#......S......#",
      "###############",
    ],
    ghostSpawns: [
      { row: 5, col: 6 }, { row: 5, col: 8 },
      { row: 9, col: 6 }, { row: 9, col: 8 },
    ],
  },
  {
    id: "spiral", name: "나선",
    data: [
      "###############",
      "#.............#",
      "#.###########.#",
      "#.............#",
      "#.#########.#.#",
      "#.#.........#.#",
      "#.#.#####._.#.#",
      "#.#.#####.#.#.#",
      "#.#.........#.#",
      "#.#########.#.#",
      "#.............#",
      "#o###########o#",
      "#......S......#",
      "###############",
    ],
    ghostSpawns: [
      { row: 6, col: 10 }, { row: 5, col: 10 },
      { row: 8, col: 10 }, { row: 6, col: 9 },
    ],
  },
];

// ── util ────────────────────────────────────────
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!dodogoInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `dodogo:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearGhostTick(room) {
  if (room?.ghostTimer) { clearInterval(room.ghostTimer); room.ghostTimer = null; }
}

// ── 미로 파싱 ───────────────────────────────────
function parseMaze(mazeIdx) {
  const m = MAZES[mazeIdx] || MAZES[0];
  const maxLen = Math.max(...m.data.map(r => r.length));
  const data = m.data.map(r => r + " ".repeat(Math.max(0, maxLen - r.length)));
  const rows = data.length, cols = maxLen;

  const grid = Array.from({length:rows}, () => new Array(cols).fill(null));
  let startRow = 0, startCol = 0;
  const golds = new Set();   // "r,c"
  const pellets = new Set();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = data[r][c];
      const cell = { wall:false };
      if (ch === "#") cell.wall = true;
      else if (ch === ".") golds.add(`${r},${c}`);
      else if (ch === "o") pellets.add(`${r},${c}`);
      else if (ch === "S") { startRow = r; startCol = c; }
      grid[r][c] = cell;
    }
  }
  return {
    rows, cols, grid,
    startRow, startCol,
    initialGolds: golds,
    initialPellets: pellets,
    mazeIdx,
    mazeId: m.id,
    ghostSpawns: m.ghostSpawns,
  };
}

// ── 이동 헬퍼 ───────────────────────────────────
const DIR = {
  up:    [0, -1], down:  [0, 1],
  left:  [-1, 0], right: [1, 0],
};
function moveCoord(maze, col, row, dir) {
  const d = DIR[dir];
  if (!d) return null;
  let nc = col + d[0];
  let nr = row + d[1];
  // 좌우 워프
  if (nc < 0) nc = maze.cols - 1;
  else if (nc >= maze.cols) nc = 0;
  if (nr < 0 || nr >= maze.rows) return null;
  return { col: nc, row: nr };
}
function canMove(maze, col, row, dir) {
  const next = moveCoord(maze, col, row, dir);
  if (!next) return false;
  return !maze.grid[next.row][next.col].wall;
}

// ── 유령 AI (BFS) ──────────────────────────────
function bfsNextDir(maze, fc, fr, tc, tr, banDir) {
  if (fc === tc && fr === tr) return null;
  const visited = Array.from({length: maze.rows}, () => new Array(maze.cols).fill(false));
  const prev = Array.from({length: maze.rows}, () => new Array(maze.cols).fill(null));
  const queue = [[fc, fr]];
  visited[fr][fc] = true;
  const DIRS = ["up","down","left","right"];
  let found = false;
  while (queue.length) {
    const [cc, cr] = queue.shift();
    if (cc === tc && cr === tr) { found = true; break; }
    for (const d of DIRS) {
      if (cc === fc && cr === fr && d === banDir) continue;
      const n = moveCoord(maze, cc, cr, d);
      if (!n) continue;
      if (maze.grid[n.row][n.col].wall) continue;
      if (visited[n.row][n.col]) continue;
      visited[n.row][n.col] = true;
      prev[n.row][n.col] = { col: cc, row: cr, dir: d };
      queue.push([n.col, n.row]);
    }
  }
  if (!found) return null;
  let cur = { col: tc, row: tr }, firstDir = null;
  while (cur && (cur.col !== fc || cur.row !== fr)) {
    const p = prev[cur.row][cur.col];
    if (!p) return null;
    firstDir = p.dir;
    cur = { col: p.col, row: p.row };
  }
  return firstDir;
}
function randomDir(maze, col, row, banDir) {
  const DIRS = ["up","down","left","right"];
  const valid = DIRS.filter(d => d !== banDir && canMove(maze, col, row, d));
  if (!valid.length) return DIRS.find(d => canMove(maze, col, row, d)) || null;
  return valid[Math.floor(Math.random() * valid.length)];
}
const OPPOSITE = { up:"down", down:"up", left:"right", right:"left" };
const GHOST_TYPES = ["pursuer", "ambusher", "wanderer", "guardian"];
const GHOST_COLORS = {
  pursuer: "#ef4444", ambusher: "#06b6d4",
  wanderer: "#f97316", guardian: "#a78bfa",
};

function ghostDecide(maze, ghost, players, isFrightened) {
  const ban = ghost.lastDir ? OPPOSITE[ghost.lastDir] : null;
  if (ghost.eaten) {
    // spawn 복귀
    const dir = bfsNextDir(maze, ghost.col, ghost.row, ghost.spawnCol, ghost.spawnRow, ban);
    return dir || randomDir(maze, ghost.col, ghost.row, ban);
  }

  // 가장 가까운 살아있는 플레이어 찾기
  let target = null, bestDist = Infinity;
  for (const [, p] of players) {
    if (!p.alive || !p.connected) continue;
    const dist = Math.abs(p.col - ghost.col) + Math.abs(p.row - ghost.row);
    if (dist < bestDist) { bestDist = dist; target = p; }
  }
  if (!target) return randomDir(maze, ghost.col, ghost.row, ban);

  if (isFrightened) {
    // 도망 — 50% 거리 멀어지는 방향, 50% 랜덤
    if (Math.random() < 0.5) {
      const DIRS = ["up","down","left","right"];
      const valid = DIRS.filter(d => d !== ban && canMove(maze, ghost.col, ghost.row, d));
      let best = null, bestDist = -1;
      for (const d of valid) {
        const n = moveCoord(maze, ghost.col, ghost.row, d);
        const dist = Math.abs(n.col - target.col) + Math.abs(n.row - target.row);
        if (dist > bestDist) { bestDist = dist; best = d; }
      }
      return best || randomDir(maze, ghost.col, ghost.row, ban);
    }
    return randomDir(maze, ghost.col, ghost.row, ban);
  }

  switch (ghost.type) {
    case "pursuer":
      return bfsNextDir(maze, ghost.col, ghost.row, target.col, target.row, ban)
          || randomDir(maze, ghost.col, ghost.row, ban);
    case "ambusher": {
      const pd = DIR[target.facing || "right"];
      let tc = target.col, tr = target.row;
      if (pd) {
        for (let k = 1; k <= 4; k++) {
          const ntc = tc + pd[0], ntr = tr + pd[1];
          if (ntc < 0 || ntc >= maze.cols || ntr < 0 || ntr >= maze.rows) break;
          if (maze.grid[ntr][ntc].wall) break;
          tc = ntc; tr = ntr;
        }
      }
      return bfsNextDir(maze, ghost.col, ghost.row, tc, tr, ban)
          || randomDir(maze, ghost.col, ghost.row, ban);
    }
    case "wanderer":
      if (Math.random() < 0.5) {
        return bfsNextDir(maze, ghost.col, ghost.row, target.col, target.row, ban)
            || randomDir(maze, ghost.col, ghost.row, ban);
      }
      return randomDir(maze, ghost.col, ghost.row, ban);
    case "guardian": {
      // 영역 가운데에서 일정 반경 안 순찰
      const cx = Math.floor(maze.cols / 2), cy = Math.floor(maze.rows / 2);
      const dist = Math.abs(ghost.col - cx) + Math.abs(ghost.row - cy);
      if (dist > 5 && Math.random() < 0.7) {
        return bfsNextDir(maze, ghost.col, ghost.row, cx, cy, ban)
            || randomDir(maze, ghost.col, ghost.row, ban);
      }
      const pDist = Math.abs(target.col - cx) + Math.abs(target.row - cy);
      if (pDist <= 6) {
        return bfsNextDir(maze, ghost.col, ghost.row, target.col, target.row, ban)
            || randomDir(maze, ghost.col, ghost.row, ban);
      }
      return randomDir(maze, ghost.col, ghost.row, ban);
    }
  }
  return randomDir(maze, ghost.col, ghost.row, ban);
}

// ── 인원 스케일링 ──────────────────────────────
function ghostCountFor(players) {
  // 룸의 connected & playing 플레이어 수 기준
  let n = 0;
  for (const [, p] of players) if (p.connected && p.alive) n++;
  return Math.max(4, Math.min(8, n + 1));
}
function speedFactorFor(players) {
  let n = 0;
  for (const [, p] of players) if (p.connected) n++;
  return 1 + Math.max(0, n - 2) * 0.025;  // 2인=1.0, 8인=1.15
}

// ── state 생성 ─────────────────────────────────
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    // 게임 상태
    col: 0, row: 0,
    facing: "right",
    alive: true,
    lives: STARTING_LIVES,
    goldCount: 0,
    score: 0,
    lastPosBroadcast: 0,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    mazeIdx: room.mazeIdx,
    mazeId: room.maze?.mazeId || null,
    players: Array.from(room.players.entries()).map(([uid, p]) => ({
      userId: uid, name: p.name, isGuest: p.isGuest, avatar_url: p.avatar_url,
      connected: p.connected, alive: p.alive, lives: p.lives,
      goldCount: p.goldCount, score: p.score,
      col: p.col, row: p.row, facing: p.facing,
    })),
    goldRemaining: room.golds ? room.golds.size : 0,
    pelletRemaining: room.pellets ? room.pellets.size : 0,
    frightenedUntil: room.frightenedUntil || 0,
    ghostCount: room.ghosts?.length || 0,
    speedFactor: room.speedFactor || 1,
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("dodogo:state", publicRoom(room));
}

// ── 게임 시작 ──────────────────────────────────
function startRound(io, room) {
  const maze = parseMaze(room.mazeIdx);
  room.maze = maze;
  // golds/pellets는 set으로 사본 (먹으면 제거)
  room.golds = new Set(maze.initialGolds);
  room.pellets = new Set(maze.initialPellets);
  // 플레이어 시작 위치
  for (const [, p] of room.players) {
    p.col = maze.startCol;
    p.row = maze.startRow;
    p.facing = "right";
    p.alive = true;
    p.lives = STARTING_LIVES;
    p.goldCount = 0;
    p.score = 0;
  }
  // 유령 생성 (인원 스케일링)
  const gCount = ghostCountFor(room.players);
  room.speedFactor = speedFactorFor(room.players);
  room.ghosts = [];
  for (let i = 0; i < gCount; i++) {
    const type = GHOST_TYPES[i % GHOST_TYPES.length];
    const spawn = maze.ghostSpawns[i % maze.ghostSpawns.length];
    room.ghosts.push({
      id: i, type, color: GHOST_COLORS[type] || "#fff",
      col: spawn.col, row: spawn.row,
      spawnCol: spawn.col, spawnRow: spawn.row,
      facing: "up", lastDir: null,
      eaten: false,
    });
  }
  room.frightenedUntil = 0;
  room.status = "playing";
  room.startedAt = Date.now();

  io.to(socketRoomName(room.id)).emit("dodogo:start", {
    roomId: room.id,
    mazeIdx: room.mazeIdx,
    ghosts: room.ghosts.map(g => ({ id:g.id, type:g.type, color:g.color, col:g.col, row:g.row })),
    speedFactor: room.speedFactor,
    startedAt: room.startedAt,
  });

  // 유령 tick 시작 (인원 스케일링 적용한 interval)
  clearGhostTick(room);
  const tickMs = Math.max(80, GHOST_TICK_MS / room.speedFactor);
  room.ghostTimer = setInterval(() => ghostTick(io, room), tickMs);
  console.log(`[dodogo] room ${room.id} round started — players=${room.players.size}, ghosts=${gCount}, speed=${room.speedFactor.toFixed(2)}, tick=${tickMs}ms`);
}

function endRound(io, room, reason, payload = {}) {
  clearGhostTick(room);
  room.status = "ended";
  room.endedAt = Date.now();
  io.to(socketRoomName(room.id)).emit("dodogo:end", {
    roomId: room.id,
    reason,
    duration: room.endedAt - (room.startedAt || room.endedAt),
    players: Array.from(room.players.entries()).map(([uid, p]) => ({
      userId: uid, name: p.name, avatar_url: p.avatar_url || null,
      score: p.score, goldCount: p.goldCount,
      alive: p.alive, lives: p.lives, isGuest: p.isGuest,
    })),
    ...payload,
  });
  console.log(`[dodogo] room ${room.id} ended: ${reason}`);
}

// ── 유령 tick (서버 권위 AI) ────────────────────
function ghostTick(io, room) {
  if (!room || room.status !== "playing") return;
  const isFrightened = Date.now() < (room.frightenedUntil || 0);

  for (const g of room.ghosts) {
    const dir = ghostDecide(room.maze, g, room.players, isFrightened);
    if (!dir) continue;
    const next = moveCoord(room.maze, g.col, g.row, dir);
    if (!next || room.maze.grid[next.row][next.col].wall) continue;
    g.col = next.col;
    g.row = next.row;
    g.facing = dir;
    g.lastDir = dir;

    // spawn 위치 도달 시 부활
    if (g.eaten && g.col === g.spawnCol && g.row === g.spawnRow) {
      g.eaten = false;
    }
  }

  // 위치 broadcast
  io.to(socketRoomName(room.id)).emit("dodogo:ghosts", {
    ghosts: room.ghosts.map(g => ({ id:g.id, col:g.col, row:g.row, facing:g.facing, eaten:g.eaten })),
    frightened: isFrightened,
  });

  // 충돌 검사
  for (const [uid, p] of room.players) {
    if (!p.alive || !p.connected) continue;
    for (const g of room.ghosts) {
      if (g.eaten) continue;
      if (g.col === p.col && g.row === p.row) {
        if (isFrightened) {
          // 잡아먹음 — 점수 + 유령 spawn 복귀
          g.eaten = true;
          p.score += 200;
          io.to(socketRoomName(room.id)).emit("dodogo:ghostEaten", { userId: uid, ghostId: g.id, points: 200 });
        } else {
          // 잡힘 — 목숨 -1, 시작 위치로
          p.lives = Math.max(0, p.lives - 1);
          p.col = room.maze.startCol;
          p.row = room.maze.startRow;
          io.to(socketRoomName(room.id)).emit("dodogo:caught", { userId: uid, lives: p.lives });
          if (p.lives <= 0) {
            p.alive = false;
            io.to(socketRoomName(room.id)).emit("dodogo:dead", { userId: uid, score: p.score });
          }
          break;
        }
      }
    }
  }

  // 전원 사망 → 게임오버
  const allDead = Array.from(room.players.values()).every(p => !p.alive || !p.connected);
  if (allDead && room.players.size > 0) {
    endRound(io, room, "ALL_DEAD");
    return;
  }
  // 모든 골드 클리어 → 클리어
  if (room.golds.size === 0) {
    endRound(io, room, "CLEAR");
    return;
  }
}

// ── 플레이어 이동 (클라 권위 + 검증) ────────────
function tryMovePlayer(room, userId, col, row, facing) {
  const p = room.players.get(userId);
  if (!p || !p.alive || !p.connected) return false;
  const maze = room.maze;
  if (!maze) return false;
  // 범위/벽 검사
  if (col < 0 || col >= maze.cols || row < 0 || row >= maze.rows) return false;
  if (maze.grid[row][col].wall) return false;
  // 이전 위치와의 거리가 1 초과면 anti-cheat (워프 예외: col이 0↔COLS-1 점프)
  const dc = Math.abs(col - p.col), dr = Math.abs(row - p.row);
  const isWarp = (dr === 0) && (dc === maze.cols - 1);
  if (!isWarp && dc + dr > 1) {
    // 의심 — 무시
    return false;
  }
  p.col = col;
  p.row = row;
  if (facing) p.facing = facing;
  // 골드/펠릿 먹기 (서버 권위 — 첫 사람만)
  const key = `${row},${col}`;
  if (room.golds.has(key)) {
    room.golds.delete(key);
    p.goldCount++;
    p.score += 10;
    return { ate: "gold", points: 10 };
  }
  if (room.pellets.has(key)) {
    room.pellets.delete(key);
    p.score += 50;
    room.frightenedUntil = Date.now() + FRIGHTENED_DURATION;
    return { ate: "pellet", points: 50, frightenedUntil: room.frightenedUntil };
  }
  return true;
}

// ── 플레이어 떠나기 ────────────────────────────
function leavePlayer(io, room, userId) {
  if (!room) return;
  if (room.players.has(userId)) {
    const p = room.players.get(userId);
    p.connected = false;
    room.players.delete(userId);
  }
  dodogoUserRoom.delete(userId);
  if (room.players.size === 0) {
    clearEmptyRoomTimer(room);
    room.emptyRoomTimer = setTimeout(() => {
      clearGhostTick(room);
      dodogoRooms.delete(room.id);
      if (room.inviteCode) dodogoInvites.delete(room.inviteCode);
      console.log(`[dodogo] room ${room.id} cleaned (empty)`);
    }, EMPTY_ROOM_TTL_MS);
  } else {
    // 호스트 자동 이양
    if (room.hostUserId === userId) {
      const firstUid = room.players.keys().next().value;
      if (firstUid) room.hostUserId = firstUid;
    }
  }
  broadcastRoomState(io, room);
}

// =========================
// 등록
// =========================
export function registerDodogo(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ── 방 만들기 ──
    socket.on("dodogo:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (dodogoUserRoom.has(me.id)) {
          const old = dodogoRooms.get(dodogoUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const mazeIdx = Number.isFinite(payload?.mazeIdx) ? Math.max(0, Math.min(MAZES.length - 1, Number(payload.mazeIdx))) : 0;

        const roomId = `dd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers,
          mazeIdx,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(),
          emptyRoomTimer: null, ghostTimer: null,
        };
        dodogoRooms.set(roomId, room);
        dodogoInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        dodogoUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[dodogo] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[dodogo:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ── 입장 ──
    socket.on("dodogo:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = dodogoInvites.get(code);
        const room = roomId ? dodogoRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        // ended 상태는 허용 (rematch 대기 중) — playing만 차단

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          dodogoUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status === "playing") return cb?.({ ok: false, error: "GAME_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "도전자", me.isGuest, avatar, socket.id));
        dodogoUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[dodogo:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ── 호스트 시작 ── (rematch: ended 상태도 허용)
    socket.on("dodogo:startGame", (payload, cb) => {
      const roomId = dodogoUserRoom.get(me.id);
      const room = roomId ? dodogoRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      if (room.players.size < 1) return cb?.({ ok: false, error: "NEED_PLAYERS" });
      room.endedAt = null;
      startRound(io, room);
      cb?.({ ok: true });
    });

    // ── 호스트 미로 선택 ── (rematch: ended 상태도 허용)
    socket.on("dodogo:setMaze", (payload, cb) => {
      const roomId = dodogoUserRoom.get(me.id);
      const room = roomId ? dodogoRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      const idx = Math.max(0, Math.min(MAZES.length - 1, Number(payload?.mazeIdx) || 0));
      room.mazeIdx = idx;
      broadcastRoomState(io, room);
      cb?.({ ok: true, mazeIdx: idx });
    });

    // ── 플레이어 이동 (클라 → 서버) ──
    socket.on("dodogo:move", (payload, cb) => {
      const roomId = dodogoUserRoom.get(me.id);
      const room = roomId ? dodogoRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false });
      const col = Number(payload?.col);
      const row = Number(payload?.row);
      const facing = payload?.facing;
      const result = tryMovePlayer(room, me.id, col, row, facing);
      if (!result) return cb?.({ ok: false });

      const p = room.players.get(me.id);
      // 위치 broadcast (throttle)
      const now = Date.now();
      if (now - p.lastPosBroadcast >= POS_BROADCAST_MS) {
        p.lastPosBroadcast = now;
        socket.to(socketRoomName(room.id)).emit("dodogo:peerPos", {
          userId: me.id, col: p.col, row: p.row, facing: p.facing,
        });
      }
      // 먹기 이벤트 broadcast
      if (result && typeof result === "object" && result.ate) {
        io.to(socketRoomName(room.id)).emit("dodogo:ate", {
          userId: me.id, ate: result.ate, points: result.points,
          col: p.col, row: p.row,
          score: p.score, goldCount: p.goldCount,
          frightenedUntil: result.frightenedUntil || 0,
          goldRemaining: room.golds.size,
        });
      }
      cb?.({ ok: true, score: p.score, goldCount: p.goldCount });
    });

    // ── 떠나기 ──
    socket.on("dodogo:leave", (_, cb) => {
      const roomId = dodogoUserRoom.get(me.id);
      const room = roomId ? dodogoRooms.get(roomId) : null;
      if (room) leavePlayer(io, room, me.id);
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const roomId = dodogoUserRoom.get(me.id);
      const room = roomId ? dodogoRooms.get(roomId) : null;
      if (room) {
        const p = room.players.get(me.id);
        if (p) p.connected = false;
        broadcastRoomState(io, room);
        // 30초 후 정리 (재접속 grace)
        setTimeout(() => {
          const r = dodogoRooms.get(roomId);
          if (!r) return;
          const pp = r.players.get(me.id);
          if (pp && !pp.connected) leavePlayer(io, r, me.id);
        }, 30000);
      }
    });
  });

  console.log("[dodogo] socket handlers registered");
}
