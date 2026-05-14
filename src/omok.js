// =========================
// DUO GAME ZONE — 멀티 오목 (서버) v20260514_1
// 기존 worldcup/quiz/tier/lifegame/liar/oxgame/fibbage 와 완전 격리.
// - 별도 Map(omokRooms / omokInvites / omokUserRoom)
// - 'omok:*' 이벤트 prefix
// - socket.io room name = `omok:${roomId}`
//
// 모드:
//   '1v1'   — 2인, 팀 없음, 색 2
//   '2v2'   — 4인, 팀 2, 팀당 1색
//   '3v3'   — 6인, 팀 2, 팀당 1색
//   '4v4'   — 8인, 팀 2, 팀당 1색
//   'ffa'   — 2~8인, 팀 없음, 인원수만큼 색
//
// 보드: 15 / 19 / 25 (호스트 선택)
// 타이머: 30/60/90/120/180 (호스트 선택) — 시간초과 시 자동 패스 (착수 X, 차례 넘김)
// 5목 검사: 매 착수 시 4방향 (가로/세로/대각 NW-SE, NE-SW) — 5 이상 연속이면 승리
// =========================

// ===== Room storage =====
const omokRooms = new Map();      // roomId → room
const omokInvites = new Map();    // inviteCode → roomId
const omokUserRoom = new Map();   // userId → roomId

// ===== Constants =====
const MIN_PLAYERS = 2;
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_BOARD_SIZES = [15, 19, 25];
const ALLOWED_TURN_SECS = [10, 30, 60, 90, 120, 180];
const ALLOWED_MODES = ["1v1", "2v2", "3v3", "4v4", "ffa"];
const ALLOWED_WIN_LENGTHS = [3, 4, 5]; // 호스트가 인원·보드에 맞게 승리 조건 조정
const EMPTY_ROOM_TTL_MS = 30_000;
const ENDED_ROOM_TTL_MS = 10 * 60_000;

// 모드별 인원 (ffa는 가변)
const MODE_INFO = {
  "1v1": { players: 2, teams: 0 },
  "2v2": { players: 4, teams: 2 },
  "3v3": { players: 6, teams: 2 },
  "4v4": { players: 8, teams: 2 },
  "ffa": { players: null, teams: 0 },
};

// 색상 팔레트 (1~8) — 클라이언트도 동일 매핑
const COLOR_NAMES = ["red", "blue", "green", "yellow", "purple", "black", "white", "orange"];
const COLOR_HEX   = ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#1f2937", "#f3f4f6", "#f97316"];

// ===== Utils =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!omokInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function socketRoomName(roomId) { return `omok:${roomId}`; }

function modeMaxPlayers(mode, ffaSize) {
  if (mode === "ffa") return Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(ffaSize) || 8));
  return MODE_INFO[mode]?.players || 2;
}

function newPlayerState(name, isGuest, avatarUrl) {
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    color: 0,    // 1~8, 배정 전 0
    team: null,  // 0|1 (팀전만)
  };
}

function countTeam(room, team) {
  let n = 0;
  for (const uid of room.playerOrder) {
    if (room.players.get(uid)?.team === team) n++;
  }
  return n;
}

function isColorTaken(room, color, exceptUserId) {
  for (const uid of room.playerOrder) {
    if (uid === exceptUserId) continue;
    if (room.players.get(uid)?.color === color) return true;
  }
  return false;
}

// Fisher-Yates 셔플
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// 팀 자동 배정: 입장 순서대로 좌우 인터리브, 색은 팀당 고정
function reassignColorsAndTeams(room) {
  const m = room.mode;
  const info = MODE_INFO[m];
  const order = room.playerOrder;
  if (m === "1v1") {
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.color = i === 0 ? 1 : 2; // red, blue
      p.team = null;
    });
  } else if (info?.teams === 2) {
    // 팀A=1, 팀B=2 (색은 빨강/파랑 고정)
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      const team = i % 2; // 0: A, 1: B
      p.team = team;
      p.color = team === 0 ? 1 : 2;
    });
  } else if (m === "ffa") {
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.color = (i % 8) + 1;
      p.team = null;
    });
  }
}

// 보드 인덱스
function idx(size, x, y) { return y * size + x; }

// N목 검사 — 마지막 착수 좌표에서 4방향, 승리 길이는 winLength (3/4/5)
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
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

// ===== 공개용 직렬화 =====
function publicPlayer(userId, p) {
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    color: p.color,
    team: p.team,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    mode: room.mode,
    boardSize: room.boardSize,
    turnTimeSec: room.turnTimeSec,
    winLength: room.winLength,
    maxPlayers: room.maxPlayers,
    ffaSize: room.ffaSize,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    currentTurnUserId: room.status === "playing" ? (room.playerOrder[room.currentTurnIdx] || null) : null,
    turnDeadline: room.turnDeadline,
    lastMove: room.lastMove,
    winLine: room.winLine,
    winnerUserId: room.winnerUserId,
    winnerTeam: room.winnerTeam,
    historyLen: room.history.length,
  };
}

// ===== 타이머 =====
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  clearTurnTimer(room);
  clearEmptyRoomTimer(room);
  omokRooms.delete(room.id);
  omokInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (omokUserRoom.get(uid) === room.id) omokUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("omok:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[omok] room ${room.id} deleted: ${reason}`);
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("omok:roomState", publicRoom(room));
}

// ===== 게임 진행 =====
function startTurn(io, room) {
  if (room.status !== "playing") return;

  // 연결된 플레이어 찾을 때까지 인덱스 진행 (skip disconnected)
  let safety = room.playerOrder.length;
  while (safety-- > 0) {
    const uid = room.playerOrder[room.currentTurnIdx];
    const p = room.players.get(uid);
    if (p && p.connected) break;
    room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  }
  // 모두 끊겨있으면 그냥 대기
  const turnUid = room.playerOrder[room.currentTurnIdx];
  const turnPlayer = room.players.get(turnUid);
  if (!turnPlayer?.connected) {
    return;
  }

  room.turnDeadline = Date.now() + room.turnTimeSec * 1000;

  io.to(socketRoomName(room.id)).emit("omok:turnStart", {
    turnUserId: turnUid,
    turnDeadline: room.turnDeadline,
    turnTimeSec: room.turnTimeSec,
  });

  clearTurnTimer(room);
  room.turnTimer = setTimeout(() => onTurnTimeout(io, room, turnUid), room.turnTimeSec * 1000);
}

function onTurnTimeout(io, room, expectedTurnUid) {
  if (room.status !== "playing") return;
  const turnUid = room.playerOrder[room.currentTurnIdx];
  if (turnUid !== expectedTurnUid) return; // 이미 다음 차례로 넘어감

  const p = room.players.get(turnUid);
  // 시간초과 = 자동 패스 (착수 X, 차례 넘김)
  io.to(socketRoomName(room.id)).emit("omok:turnPass", {
    userId: turnUid,
    name: p?.name || "?",
    timedOut: true,
  });
  // 다음 턴
  room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  startTurn(io, room);
}

function placeStone(io, room, userId, x, y) {
  const turnUid = room.playerOrder[room.currentTurnIdx];
  if (turnUid !== userId) return { ok: false, error: "NOT_YOUR_TURN" };
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, error: "INVALID_COORD" };
  if (x < 0 || y < 0 || x >= room.boardSize || y >= room.boardSize) return { ok: false, error: "OUT_OF_BOUNDS" };
  const i = idx(room.boardSize, x, y);
  if (room.board[i] !== 0) return { ok: false, error: "OCCUPIED" };

  const player = room.players.get(userId);
  if (!player) return { ok: false, error: "NOT_PLAYER" };
  if (!player.color || player.color < 1 || player.color > 8) return { ok: false, error: "NO_COLOR" };

  // 착수
  room.board[i] = player.color;
  room.lastMove = { x, y, color: player.color, userId, ts: Date.now() };
  room.history.push({ userId, x, y, color: player.color, ts: room.lastMove.ts });

  clearTurnTimer(room);

  io.to(socketRoomName(room.id)).emit("omok:move", {
    userId,
    name: player.name,
    color: player.color,
    team: player.team,
    x, y,
    moveIndex: room.history.length - 1,
  });

  // 승리 검사 (호스트가 정한 N목 기준)
  const win = findWinLine(room.board, room.boardSize, x, y, player.color, room.winLength);
  if (win) {
    room.winLine = win;
    room.winnerUserId = userId;
    room.winnerTeam = player.team;
    return endGame(io, room, win);
  }

  // 보드 가득찼는지
  const fullCount = countNonZero(room.board);
  if (fullCount >= room.boardSize * room.boardSize) {
    room.winnerUserId = null;
    room.winnerTeam = null;
    return endGame(io, room, null, "BOARD_FULL");
  }

  // 다음 턴
  room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  startTurn(io, room);

  return { ok: true };
}

function countNonZero(arr) {
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) n++;
  return n;
}

function endGame(io, room, winLine, reason = "WIN") {
  room.status = "ended";
  clearTurnTimer(room);

  const winnerP = room.winnerUserId ? room.players.get(room.winnerUserId) : null;
  io.to(socketRoomName(room.id)).emit("omok:gameEnd", {
    reason,
    winnerUserId: room.winnerUserId,
    winnerName: winnerP?.name || null,
    winnerColor: winnerP?.color || null,
    winnerTeam: room.winnerTeam,
    winLine: winLine,
    winLength: room.winLength,
    historyLen: room.history.length,
    history: room.history.slice(0),
    boardSize: room.boardSize,
    mode: room.mode,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });

  // 일정 시간 뒤 정리 (결과 화면 확인 시간)
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, ENDED_ROOM_TTL_MS);

  return { ok: true };
}

// ===== 핸들러 등록 =====
export function registerOmok(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ===== createRoom =====
    socket.on("omok:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (omokUserRoom.has(me.id)) {
          const old = omokRooms.get(omokUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, true);
        }

        const mode = ALLOWED_MODES.includes(payload?.mode) ? payload.mode : "1v1";
        const boardSize = ALLOWED_BOARD_SIZES.includes(Number(payload?.boardSize))
          ? Number(payload.boardSize) : 15;
        const turnTimeSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 60;
        const winLength = ALLOWED_WIN_LENGTHS.includes(Number(payload?.winLength))
          ? Number(payload.winLength) : 5;
        const ffaSize = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(payload?.ffaSize) || 8));
        const maxPlayers = modeMaxPlayers(mode, ffaSize);

        const roomId = `om_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",      // lobby | playing | ended
          mode,
          boardSize,
          turnTimeSec,
          winLength,
          maxPlayers,
          ffaSize: mode === "ffa" ? ffaSize : null,
          createdAt: Date.now(),

          players: new Map(),
          playerOrder: [],

          board: new Int8Array(boardSize * boardSize),
          history: [],
          lastMove: null,
          winLine: null,
          winnerUserId: null,
          winnerTeam: null,

          currentTurnIdx: 0,
          turnDeadline: null,
          turnTimer: null,
          emptyRoomTimer: null,
        };
        omokRooms.set(roomId, room);
        omokInvites.set(inviteCode, roomId);

        // 호스트 등록
        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
        } catch {}

        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        room.players.set(me.id, newPlayerState(hostName, false, avatar));
        room.playerOrder.push(me.id);
        omokUserRoom.set(me.id, roomId);
        reassignColorsAndTeams(room);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[omok] created room ${roomId} mode=${mode} board=${boardSize} timer=${turnTimeSec}`);
      } catch (e) {
        console.error("[omok:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== joinRoom =====
    socket.on("omok:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = omokInvites.get(code);
        const room = roomId ? omokRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") {
          // 재접속: 이미 방에 있던 유저면 재참가 허용
          if (room.players.has(me.id)) {
            const p = room.players.get(me.id);
            p.connected = true;
            socket.join(socketRoomName(roomId));
            omokUserRoom.set(me.id, roomId);
            cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), reconnected: true });
            broadcastRoomState(io, room);
            return;
          }
          return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        }
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          omokUserRoom.set(me.id, roomId);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), reconnected: true });
          broadcastRoomState(io, room);
          return;
        }

        let avatar = null;
        if (!me.isGuest) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
          } catch {}
        }
        const playerName = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);

        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar));
        room.playerOrder.push(me.id);
        omokUserRoom.set(me.id, roomId);
        reassignColorsAndTeams(room);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[omok:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== setOptions (host only, lobby only) =====
    socket.on("omok:setOptions", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      let changed = false;

      if (payload?.mode && ALLOWED_MODES.includes(payload.mode)) {
        // 모드 변경 시 maxPlayers도 재계산 — 현재 인원 초과 시 거부
        const newMax = modeMaxPlayers(payload.mode, room.ffaSize || 8);
        if (newMax >= room.players.size) {
          room.mode = payload.mode;
          room.maxPlayers = newMax;
          reassignColorsAndTeams(room);
          changed = true;
        } else {
          return cb?.({ ok: false, error: "MODE_PLAYERS_OVERFLOW" });
        }
      }
      if (payload?.boardSize && ALLOWED_BOARD_SIZES.includes(Number(payload.boardSize))) {
        const sz = Number(payload.boardSize);
        room.boardSize = sz;
        room.board = new Int8Array(sz * sz);
        changed = true;
      }
      if (payload?.turnTimeSec && ALLOWED_TURN_SECS.includes(Number(payload.turnTimeSec))) {
        room.turnTimeSec = Number(payload.turnTimeSec);
        changed = true;
      }
      if (payload?.winLength && ALLOWED_WIN_LENGTHS.includes(Number(payload.winLength))) {
        room.winLength = Number(payload.winLength);
        changed = true;
      }
      if (payload?.ffaSize != null && room.mode === "ffa") {
        const n = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(payload.ffaSize) || 8));
        if (n >= room.players.size) {
          room.ffaSize = n;
          room.maxPlayers = n;
          changed = true;
        } else {
          return cb?.({ ok: false, error: "FFA_PLAYERS_OVERFLOW" });
        }
      }
      if (changed) broadcastRoomState(io, room);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ===== startGame =====
    socket.on("omok:startGame", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      const minNeeded = room.mode === "ffa" ? 2 : MODE_INFO[room.mode].players;
      if (room.players.size < minNeeded) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", needed: minNeeded });

      // ffa면 첫 진입자가 항상 첫 차례. 팀전이면 팀A 첫 사람부터.
      room.status = "playing";
      room.currentTurnIdx = 0;
      room.board = new Int8Array(room.boardSize * room.boardSize);
      room.history = [];
      room.lastMove = null;
      room.winLine = null;
      room.winnerUserId = null;
      room.winnerTeam = null;

      reassignColorsAndTeams(room);

      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("omok:gameStart", {
        mode: room.mode,
        boardSize: room.boardSize,
        turnTimeSec: room.turnTimeSec,
        winLength: room.winLength,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      startTurn(io, room);
    });

    // ===== placeStone =====
    socket.on("omok:place", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      const res = placeStone(io, room, me.id, x, y);
      cb?.(res);
    });

    // ===== requestState =====
    socket.on("omok:requestState", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.join(socketRoomName(room.id));
      // 진행중이라면 보드 전체 + history 함께 보내서 즉시 복원 가능
      const payload = {
        ok: true,
        room: publicRoom(room),
      };
      if (room.status === "playing" || room.status === "ended") {
        payload.boardArray = Array.from(room.board);
        payload.history = room.history.slice(0);
      }
      cb?.(payload);
    });

    // ===== changeMySlot — 본인 팀/색 변경 (lobby에서만) =====
    socket.on("omok:changeMySlot", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_PLAYER" });

      if (room.mode === "1v1") {
        // 색 1 ↔ 2 swap (혹은 혼자면 토글)
        const others = room.playerOrder.filter(u => u !== me.id);
        if (others.length === 0) {
          p.color = p.color === 1 ? 2 : 1;
        } else {
          const other = room.players.get(others[0]);
          const tmp = p.color;
          p.color = other.color;
          other.color = tmp;
        }
      } else if (["2v2","3v3","4v4"].includes(room.mode)) {
        const targetTeam = p.team === 0 ? 1 : 0;
        const cap = MODE_INFO[room.mode].players / 2;
        const targetCount = countTeam(room, targetTeam);
        if (targetCount < cap) {
          // 정원 여유 — 그냥 이동
          p.team = targetTeam;
          p.color = targetTeam === 0 ? 1 : 2;
        } else {
          // 정원 꽉 참 — 같은 팀 마지막 들어온 사람과 swap
          const targetMembers = room.playerOrder.filter(u => room.players.get(u)?.team === targetTeam);
          const swapUid = targetMembers[targetMembers.length - 1];
          if (!swapUid) return cb?.({ ok: false, error: "TEAM_FULL_NO_SWAP" });
          const swapP = room.players.get(swapUid);
          const myOrigTeam = p.team;
          p.team = targetTeam;       p.color = targetTeam === 0 ? 1 : 2;
          swapP.team = myOrigTeam;   swapP.color = myOrigTeam === 0 ? 1 : 2;
        }
      } else if (room.mode === "ffa") {
        const newColor = Number(payload?.color);
        if (!Number.isInteger(newColor) || newColor < 1 || newColor > 8) {
          return cb?.({ ok: false, error: "INVALID_COLOR" });
        }
        if (newColor === p.color) {
          return cb?.({ ok: true });
        }
        if (isColorTaken(room, newColor, me.id)) {
          return cb?.({ ok: false, error: "COLOR_TAKEN" });
        }
        p.color = newColor;
      } else {
        return cb?.({ ok: false, error: "UNSUPPORTED_MODE" });
      }

      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== reshuffleTeams — 호스트가 팀 랜덤 재배정 =====
    socket.on("omok:reshuffleTeams", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      // 호스트는 첫 자리 유지하지 말고, 모두 셔플 후 재배정
      shuffleArr(room.playerOrder);
      reassignColorsAndTeams(room);
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== leaveRoom =====
    socket.on("omok:leaveRoom", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      leavePlayer(io, room, me.id, false);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        // 로비에선 즉시 제거
        leavePlayer(io, room, me.id, false);
      } else if (room.status === "playing") {
        // 진행중: 자기 차례면 즉시 패스, 아니면 그냥 끊김 표시
        const turnUid = room.playerOrder[room.currentTurnIdx];
        if (turnUid === me.id) {
          clearTurnTimer(room);
          io.to(socketRoomName(room.id)).emit("omok:turnPass", {
            userId: me.id,
            name: p.name,
            timedOut: false,
            disconnected: true,
          });
          room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
          startTurn(io, room);
        }
        broadcastRoomState(io, room);
        // 모두 끊기면 일정 시간 뒤 정리
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        }
      }
    });
  });
}

function leavePlayer(io, room, userId, forced) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasTurn = room.status === "playing" && room.playerOrder[room.currentTurnIdx] === userId;
  const leaveIdx = room.playerOrder.indexOf(userId);

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (omokUserRoom.get(userId) === room.id) omokUserRoom.delete(userId);

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "EMPTY");
    return;
  }

  if (wasHost) {
    room.hostUserId = room.playerOrder[0];
  }

  if (room.status === "lobby") {
    reassignColorsAndTeams(room);
  } else if (room.status === "playing") {
    // 진행중 이탈: 색은 유지(이미 둔 돌 보존), turnIdx 조정
    if (leaveIdx < room.currentTurnIdx) {
      room.currentTurnIdx = Math.max(0, room.currentTurnIdx - 1);
    } else if (leaveIdx === room.currentTurnIdx) {
      // 자기 차례에 나감 — 다음 차례로
      if (room.currentTurnIdx >= room.playerOrder.length) room.currentTurnIdx = 0;
    }
    if (wasTurn) {
      clearTurnTimer(room);
      startTurn(io, room);
    }
    // 남은 인원이 모드 최소 인원보다 적으면 무승부 종료
    const minNeeded = room.mode === "ffa" ? 2 : MODE_INFO[room.mode].players;
    if (room.playerOrder.filter(uid => room.players.get(uid)?.connected).length < 2) {
      // 한 명만 남으면 그 사람 승리
      const survivor = room.playerOrder.find(uid => room.players.get(uid)?.connected);
      if (survivor) {
        room.winnerUserId = survivor;
        room.winnerTeam = room.players.get(survivor)?.team;
        endGame(io, room, null, "OPPONENT_LEFT");
        return;
      }
    }
  }
  broadcastRoomState(io, room);
}

// 색 메타 export (테스트/디버그용)
export const OMOK_COLORS = { names: COLOR_NAMES, hex: COLOR_HEX };
