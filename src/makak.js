// =========================
// 막아막아 (DUO Makak) — Quoridor 한국형 멀티 서버
// 보드: 9×9 셀. 벽: 2칸 길이 가로/세로. 모드: 1v1 / 1v1v1v1 / 2v2 / 2v2v2v2
// 경로 검증: BFS — 벽 설치 시 모든 플레이어가 자기 결승선까지 도달 가능해야 함
// 이벤트 prefix: 'makak:'
// =========================

const mkRooms = new Map();
const mkInvites = new Map();
const mkUserRoom = new Map();

const BOARD_SIZE = 9;
const ALLOWED_MAX_PLAYERS = [2, 4, 8];
const ALLOWED_MODES = new Set(["1v1", "1v1v1v1", "2v2", "2v2v2v2"]);
const ALLOWED_TURN_TIME_SEC = [30, 60, 0];
const MIN_PLAYERS_TO_START = 2;
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;

// 모드별 인원
const MODE_PLAYER_COUNT = { "1v1": 2, "1v1v1v1": 4, "2v2": 4, "2v2v2v2": 8 };
// 모드별 팀 구성
const MODE_TEAM_COUNT = { "1v1": 0, "1v1v1v1": 0, "2v2": 2, "2v2v2v2": 4 };
const MODE_TEAM_SIZE  = { "1v1": 0, "1v1v1v1": 0, "2v2": 2, "2v2v2v2": 2 };
// 벽 개수 (개인 또는 팀 공유)
const MODE_WALLS = { "1v1": 10, "1v1v1v1": 5, "2v2": 10, "2v2v2v2": 8 };
const MODE_WALLS_SHARED = { "1v1": false, "1v1v1v1": false, "2v2": true, "2v2v2v2": true };

// 방향: N(위, row-1), S(아래, row+1), W(왼쪽 col-1), E(오른쪽 col+1)
const DIR = {
  N: { dr: -1, dc: 0, goalRow: 0 },
  S: { dr: 1,  dc: 0, goalRow: BOARD_SIZE - 1 },
  W: { dr: 0,  dc: -1, goalCol: 0 },
  E: { dr: 0,  dc: 1, goalCol: BOARD_SIZE - 1 },
};

// 시작 위치 — 모드별
// 1v1: 북(0,4) → 남으로 / 남(8,4) → 북으로
// 1v1v1v1: 북·남·서·동 각 변 중앙
// 2v2: 4인 1v1v1v1과 같지만 팀 묶음
// 2v2v2v2: 한 변에 2명씩 (양쪽 끝에서 안쪽 1칸 들어간 자리)
function getStartPositions(mode) {
  const m = BOARD_SIZE - 1; // 8
  if (mode === "1v1") {
    return [
      { row: 0, col: 4, side: "N", team: null },
      { row: m, col: 4, side: "S", team: null },
    ];
  }
  if (mode === "1v1v1v1") {
    return [
      { row: 0, col: 4, side: "N", team: null },
      { row: m, col: 4, side: "S", team: null },
      { row: 4, col: 0, side: "W", team: null },
      { row: 4, col: m, side: "E", team: null },
    ];
  }
  if (mode === "2v2") {
    // N+S vs W+E? 또는 N+S = 팀A, W+E = 팀B. 대각선 팀
    // 더 자연스럽게: 마주보는 두 변 = 두 팀 (1v1v1v1을 두 팀으로 묶기 어색)
    // 차라리: 북변에 2명(A), 남변에 2명(B). 보드는 위아래로만 (서/동 미사용)
    return [
      { row: 0, col: 3, side: "N", team: "A" },
      { row: 0, col: 5, side: "N", team: "A" },
      { row: m, col: 3, side: "S", team: "B" },
      { row: m, col: 5, side: "S", team: "B" },
    ];
  }
  if (mode === "2v2v2v2") {
    return [
      { row: 0, col: 3, side: "N", team: "A" },
      { row: 0, col: 5, side: "N", team: "A" },
      { row: m, col: 3, side: "S", team: "B" },
      { row: m, col: 5, side: "S", team: "B" },
      { row: 3, col: 0, side: "W", team: "C" },
      { row: 5, col: 0, side: "W", team: "C" },
      { row: 3, col: m, side: "E", team: "D" },
      { row: 5, col: m, side: "E", team: "D" },
    ];
  }
  return [];
}

// 한 플레이어의 결승선 도달 여부 체크
function isGoal(side, row, col) {
  if (side === "N") return row === BOARD_SIZE - 1;
  if (side === "S") return row === 0;
  if (side === "W") return col === BOARD_SIZE - 1;
  if (side === "E") return col === 0;
  return false;
}

// 두 셀 (r1,c1) ↔ (r2,c2) 사이 벽이 있는가?
// 가로벽 (wr, wc): (wr, wc)↕(wr+1, wc), (wr, wc+1)↕(wr+1, wc+1) 두 쌍 차단
// 세로벽 (wr, wc): (wr, wc)↔(wr, wc+1), (wr+1, wc)↔(wr+1, wc+1) 두 쌍 차단
function isBlocked(walls, r1, c1, r2, c2) {
  // 수직 이동 (위/아래) — 가로벽 검사
  if (c1 === c2 && Math.abs(r1 - r2) === 1) {
    const topR = Math.min(r1, r2);
    // 가로벽 (topR, c1)의 좌측칸 또는 (topR, c1-1)의 우측칸이 차단?
    if (walls.horizontal[`${topR},${c1}`]) return true;
    if (c1 > 0 && walls.horizontal[`${topR},${c1 - 1}`]) return true;
    return false;
  }
  // 수평 이동 (좌/우) — 세로벽 검사
  if (r1 === r2 && Math.abs(c1 - c2) === 1) {
    const leftC = Math.min(c1, c2);
    if (walls.vertical[`${r1},${leftC}`]) return true;
    if (r1 > 0 && walls.vertical[`${r1 - 1},${leftC}`]) return true;
    return false;
  }
  return true; // 인접 셀이 아님
}

// 벽 설치 충돌 체크
function canPlaceWall(walls, orientation, row, col) {
  if (orientation === "H") {
    if (row < 0 || row >= BOARD_SIZE - 1) return false;
    if (col < 0 || col >= BOARD_SIZE - 1) return false;
    const key = `${row},${col}`;
    if (walls.horizontal[key]) return false;
    // 가로벽 옆 슬롯 (가로벽 길이 2이므로 (row, col-1), (row, col+1)과 겹침)
    if (col > 0 && walls.horizontal[`${row},${col - 1}`]) return false;
    if (col < BOARD_SIZE - 2 && walls.horizontal[`${row},${col + 1}`]) return false;
    // 같은 교차점 +자 — v1은 가로/세로 동시 슬롯 차단 (단순화)
    if (walls.vertical[key]) return false;
    return true;
  }
  if (orientation === "V") {
    if (row < 0 || row >= BOARD_SIZE - 1) return false;
    if (col < 0 || col >= BOARD_SIZE - 1) return false;
    const key = `${row},${col}`;
    if (walls.vertical[key]) return false;
    if (row > 0 && walls.vertical[`${row - 1},${col}`]) return false;
    if (row < BOARD_SIZE - 2 && walls.vertical[`${row + 1},${col}`]) return false;
    if (walls.horizontal[key]) return false;
    return true;
  }
  return false;
}

// BFS — start에서 goal 라인까지 경로 존재?
function hasPathToGoal(walls, players, startRow, startCol, side) {
  const visited = new Set();
  const queue = [[startRow, startCol]];
  visited.add(`${startRow},${startCol}`);
  // 다른 말 위치는 점프 가능하므로 path-finding엔 무시 (단순화)
  while (queue.length) {
    const [r, c] = queue.shift();
    if (isGoal(side, r, c)) return true;
    for (const d of [DIR.N, DIR.S, DIR.W, DIR.E]) {
      const nr = r + d.dr, nc = c + d.dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      if (isBlocked(walls, r, c, nr, nc)) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push([nr, nc]);
    }
  }
  return false;
}

// 벽 설치 후 모든 플레이어가 자기 결승선까지 도달 가능한가?
function allPlayersHavePath(walls, players) {
  for (const p of players) {
    if (!p.alive) continue;
    if (!hasPathToGoal(walls, players, p.row, p.col, p.side)) return false;
  }
  return true;
}

// 이동 가능 여부 — 점프 룰 포함
function getLegalMoves(walls, players, p) {
  const moves = [];
  for (const dKey of ["N", "S", "W", "E"]) {
    const d = DIR[dKey];
    const nr = p.row + d.dr, nc = p.col + d.dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
    if (isBlocked(walls, p.row, p.col, nr, nc)) continue;
    // 같은 셀에 다른 말 있는지
    const blocker = players.find(o => o !== p && o.alive && o.row === nr && o.col === nc);
    if (!blocker) {
      moves.push({ row: nr, col: nc });
      continue;
    }
    // 점프 룰: 상대 뒤 셀로 점프
    const jr = nr + d.dr, jc = nc + d.dc;
    const jumpInBound = jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE;
    if (jumpInBound && !isBlocked(walls, nr, nc, jr, jc)) {
      // 점프 위치에 또 다른 말 없으면 점프 OK
      const blocker2 = players.find(o => o !== p && o.alive && o.row === jr && o.col === jc);
      if (!blocker2) {
        moves.push({ row: jr, col: jc, jump: true });
        continue;
      }
    }
    // 직선 점프 불가 → 대각선 (상대 옆 두 칸)
    const sideDirs = (d.dr !== 0) ? [DIR.W, DIR.E] : [DIR.N, DIR.S];
    for (const sd of sideDirs) {
      const dr = nr + sd.dr, dc = nc + sd.dc;
      if (dr < 0 || dr >= BOARD_SIZE || dc < 0 || dc >= BOARD_SIZE) continue;
      if (isBlocked(walls, nr, nc, dr, dc)) continue;
      const blocker3 = players.find(o => o !== p && o.alive && o.row === dr && o.col === dc);
      if (blocker3) continue;
      moves.push({ row: dr, col: dc, jump: true });
    }
  }
  return moves;
}

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!mkInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `makak:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearTurnTimer(room) {
  if (room?.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}

// ===== state shapes =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest, avatar_url: avatarUrl || null,
    joinedAt: Date.now(), connected: true, socketId,
    row: 0, col: 0, side: null, team: null, walls: 0, alive: true,
  };
}
function publicPlayer(userId, p) {
  return {
    playerId: userId, nickname: p.name, isGuest: p.isGuest,
    avatar_url: p.avatar_url || null, connected: p.connected,
    row: p.row, col: p.col, side: p.side, team: p.team,
    walls: p.walls, alive: p.alive,
  };
}
function publicRoom(room) {
  return {
    id: room.id, inviteCode: room.inviteCode, hostUserId: room.hostUserId,
    status: room.status, maxPlayers: room.maxPlayers, mode: room.mode,
    turnTimeSec: room.turnTimeSec,
    currentTurnPlayerId: room.currentTurnPlayerId,
    walls: room.walls,
    teamWalls: room.teamWalls,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}
function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("makak:roomState", publicRoom(room));
}
function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearTurnTimer(room);
  mkRooms.delete(room.id);
  mkInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (mkUserRoom.get(uid) === room.id) mkUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("makak:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[makak] room ${room.id} deleted: ${reason}`);
}
function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = mkRooms.get(room.id);
      if (!r) return;
      if ([...r.players.values()].every(p => !p.connected)) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}
function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasTurn = room.currentTurnPlayerId === userId;
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (mkUserRoom.get(userId) === room.id) mkUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("makak:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0) { deleteRoom(io, room, "ALL_LEFT"); return; }
  if (room.status === "playing") {
    if (wasTurn) advanceTurn(io, room);
    checkWinCondition(io, room);
  }
  broadcastRoomState(io, room);
}

// ===== 게임 시작 =====
function startGame(room) {
  const starts = getStartPositions(room.mode);
  // playerOrder 셔플 후 starts에 매핑
  const shuffled = shuffle(room.playerOrder.slice());
  for (let i = 0; i < shuffled.length; i++) {
    const uid = shuffled[i];
    const p = room.players.get(uid);
    const s = starts[i];
    if (!p || !s) continue;
    p.row = s.row; p.col = s.col; p.side = s.side; p.team = s.team;
    p.alive = true;
    if (MODE_WALLS_SHARED[room.mode]) p.walls = 0;        // 팀 공유 모드는 개인 카운터 안 씀
    else p.walls = MODE_WALLS[room.mode];
  }
  // 팀 벽 카운터
  room.teamWalls = {};
  if (MODE_WALLS_SHARED[room.mode]) {
    const teams = [...new Set(shuffled.map(uid => room.players.get(uid)?.team).filter(Boolean))];
    for (const t of teams) room.teamWalls[t] = MODE_WALLS[room.mode];
  }
  // 팀 인터리브 순서 (수상한 카드 패턴)
  if (MODE_TEAM_COUNT[room.mode] > 0) {
    const byTeam = {};
    for (const uid of shuffled) {
      const t = room.players.get(uid)?.team;
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(uid);
    }
    const teams = Object.keys(byTeam).sort();
    const maxSize = Math.max(...teams.map(t => byTeam[t].length));
    const interleaved = [];
    for (let i = 0; i < maxSize; i++) {
      for (const t of teams) {
        if (byTeam[t][i]) interleaved.push(byTeam[t][i]);
      }
    }
    room.playerOrder = interleaved;
  } else {
    room.playerOrder = shuffled;
  }
  room.walls = { horizontal: {}, vertical: {} };
  room.status = "playing";
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextAlivePlayerId(room, fromUserId) {
  const order = room.playerOrder;
  const startIdx = fromUserId ? order.indexOf(fromUserId) : -1;
  for (let i = 1; i <= order.length; i++) {
    const idx = (startIdx + i + order.length) % order.length;
    const uid = order[idx];
    const p = room.players.get(uid);
    if (p?.alive) return uid;
  }
  return null;
}

function startTurn(io, room, playerId) {
  room.currentTurnPlayerId = playerId;
  clearTurnTimer(room);
  io.to(socketRoomName(room.id)).emit("makak:turnStart", {
    playerId,
    nickname: room.players.get(playerId)?.name || "?",
    turnTimeSec: room.turnTimeSec,
  });
  broadcastRoomState(io, room);
  // 자동 진행 타이머 (시간 초과 시 결승선 방향으로 1칸 자동 이동)
  if (room.turnTimeSec > 0) {
    room.turnTimer = setTimeout(() => {
      const r = mkRooms.get(room.id);
      if (!r || r.status !== "playing" || r.currentTurnPlayerId !== playerId) return;
      autoMoveTowardGoal(io, r, playerId);
    }, room.turnTimeSec * 1000);
  }
}

function autoMoveTowardGoal(io, room, userId) {
  const p = room.players.get(userId);
  if (!p || !p.alive) return advanceTurn(io, room);
  const moves = getLegalMoves(room.walls, [...room.players.values()], p);
  if (!moves.length) {
    io.to(socketRoomName(room.id)).emit("makak:turnTimeout", { playerId: userId, blocked: true });
    return advanceTurn(io, room);
  }
  // 결승선에 가장 가까워지는 이동 선택
  const dir = DIR[p.side];
  let best = moves[0];
  let bestDist = Infinity;
  for (const m of moves) {
    let dist;
    if (dir.goalRow !== undefined) dist = Math.abs(m.row - dir.goalRow);
    else dist = Math.abs(m.col - dir.goalCol);
    if (dist < bestDist) { bestDist = dist; best = m; }
  }
  p.row = best.row; p.col = best.col;
  io.to(socketRoomName(room.id)).emit("makak:turnTimeout", { playerId: userId, autoMoveTo: { row: best.row, col: best.col } });
  io.to(socketRoomName(room.id)).emit("makak:moved", { playerId: userId, row: best.row, col: best.col, auto: true });
  broadcastRoomState(io, room);
  if (checkWinCondition(io, room)) return;
  advanceTurn(io, room);
}

function advanceTurn(io, room) {
  const next = nextAlivePlayerId(room, room.currentTurnPlayerId);
  if (!next) return finishGame(io, room, "NO_ALIVE");
  startTurn(io, room, next);
}

function checkWinCondition(io, room) {
  if (room.status !== "playing") return false;
  // 누군가 결승선 도달했는지
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p || !p.alive) continue;
    if (isGoal(p.side, p.row, p.col)) {
      finishGame(io, room, "GOAL_REACHED", uid);
      return true;
    }
  }
  return false;
}

function finishGame(io, room, reason, winnerUserId = null) {
  if (room.status === "ended") return;
  room.status = "ended";
  clearTurnTimer(room);
  // 우승자 + 팀
  let winnerTeam = null;
  if (winnerUserId) winnerTeam = room.players.get(winnerUserId)?.team || null;
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    if (!p) return null;
    const isWinner = !!(winnerUserId && (winnerUserId === uid || (winnerTeam && p.team === winnerTeam)));
    return {
      playerId: uid, nickname: p.name, team: p.team,
      winner: isWinner, row: p.row, col: p.col,
    };
  }).filter(Boolean).sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0));
  io.to(socketRoomName(room.id)).emit("makak:gameEnded", { reason, winnerUserId, winnerTeam, ranking });
  broadcastRoomState(io, room);
}

function getPlayerWalls(room, p) {
  if (MODE_WALLS_SHARED[room.mode]) return room.teamWalls[p.team] || 0;
  return p.walls;
}
function decrementWalls(room, p) {
  if (MODE_WALLS_SHARED[room.mode]) room.teamWalls[p.team] = (room.teamWalls[p.team] || 0) - 1;
  else p.walls -= 1;
}

// ===== 등록 =====
export function registerMakak(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("makak:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (mkUserRoom.has(me.id)) {
          const old = mkRooms.get(mkUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const mode = ALLOWED_MODES.has(payload?.mode) ? payload.mode : "1v1";
        const turnTimeSec = ALLOWED_TURN_TIME_SEC.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 60;
        const roomId = `mk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, mode, turnTimeSec,
          currentTurnPlayerId: null,
          walls: { horizontal: {}, vertical: {} },
          teamWalls: {},
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, turnTimer: null,
          createdAt: Date.now(),
        };
        mkRooms.set(roomId, room);
        mkInvites.set(inviteCode, roomId);
        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        mkUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) { console.error("[makak:createRoom]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("makak:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = mkInvites.get(code);
        const room = roomId ? mkRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });
        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          mkUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
        let avatar = null, nick = payload?.nickname;
        if (!me.isGuest) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (!nick && data?.nickname) nick = data.nickname;
          } catch {}
        }
        const playerName = nick || (me.isGuest ? "게스트" : "유저");
        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar, socket.id));
        room.playerOrder.push(me.id);
        mkUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) { console.error("[makak:joinRoom]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("makak:setOptions", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.maxPlayers !== undefined) {
        const n = Number(payload.maxPlayers);
        if (!ALLOWED_MAX_PLAYERS.includes(n)) return cb?.({ ok: false, error: "INVALID_MAX" });
        if (n < room.players.size) return cb?.({ ok: false, error: "BELOW_CURRENT" });
        room.maxPlayers = n;
      }
      if (payload?.mode !== undefined) {
        if (!ALLOWED_MODES.has(payload.mode)) return cb?.({ ok: false, error: "INVALID_MODE" });
        room.mode = payload.mode;
      }
      if (payload?.turnTimeSec !== undefined) {
        const n = Number(payload.turnTimeSec);
        if (!ALLOWED_TURN_TIME_SEC.includes(n)) return cb?.({ ok: false, error: "INVALID_TIME" });
        room.turnTimeSec = n;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("makak:startGame", (_payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const required = MODE_PLAYER_COUNT[room.mode];
      if (room.players.size !== required) return cb?.({ ok: false, error: "MODE_PLAYER_COUNT_MISMATCH" });
      startGame(room);
      cb?.({ ok: true });
      broadcastRoomState(io, room);
      startTurn(io, room, room.playerOrder[0]);
    });

    socket.on("makak:move", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnPlayerId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      const p = room.players.get(me.id);
      if (!p || !p.alive) return cb?.({ ok: false, error: "DEAD" });
      const target = { row: Number(payload?.row), col: Number(payload?.col) };
      const legal = getLegalMoves(room.walls, [...room.players.values()], p);
      const ok = legal.some(m => m.row === target.row && m.col === target.col);
      if (!ok) return cb?.({ ok: false, error: "ILLEGAL_MOVE" });
      p.row = target.row; p.col = target.col;
      clearTurnTimer(room);
      io.to(socketRoomName(room.id)).emit("makak:moved", { playerId: me.id, row: p.row, col: p.col });
      broadcastRoomState(io, room);
      if (checkWinCondition(io, room)) { cb?.({ ok: true, win: true }); return; }
      advanceTurn(io, room);
      cb?.({ ok: true });
    });

    socket.on("makak:placeWall", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnPlayerId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      const p = room.players.get(me.id);
      if (!p || !p.alive) return cb?.({ ok: false, error: "DEAD" });
      if (getPlayerWalls(room, p) <= 0) return cb?.({ ok: false, error: "NO_WALLS" });
      const orientation = payload?.orientation === "V" ? "V" : "H";
      const row = Number(payload?.row), col = Number(payload?.col);
      if (!canPlaceWall(room.walls, orientation, row, col)) return cb?.({ ok: false, error: "WALL_CONFLICT" });
      // 임시 설치 후 모든 플레이어 경로 검증
      const key = `${row},${col}`;
      const targetSlot = orientation === "H" ? room.walls.horizontal : room.walls.vertical;
      targetSlot[key] = true;
      const allOk = allPlayersHavePath(room.walls, [...room.players.values()]);
      if (!allOk) {
        delete targetSlot[key];
        return cb?.({ ok: false, error: "BLOCKS_PATH" });
      }
      decrementWalls(room, p);
      clearTurnTimer(room);
      io.to(socketRoomName(room.id)).emit("makak:wallPlaced", {
        playerId: me.id, orientation, row, col, team: p.team,
      });
      broadcastRoomState(io, room);
      advanceTurn(io, room);
      cb?.({ ok: true });
    });

    socket.on("makak:leaveRoom", (_payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("makak:kickPlayer", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("makak:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") leavePlayer(io, room, me.id);
      else {
        io.to(socketRoomName(room.id)).emit("makak:peerDisconnect", { playerId: me.id });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
