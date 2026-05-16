// =========================
// 끼워끼워 (DUO Fit) — 멀티 네온 블록 퍼즐 5라운드 속도 대결 서버
// 핵심: 모든 플레이어 같은 퍼즐 (서버가 5라운드 seed를 한번에 broadcast)
//       서버는 진척(라운드/채워진 셀/모자이크) sync만, 퍼즐 로직 자체는 클라가 결정
//       1등 클리어 시 관전 모드 진입 (탈락 X), 모두 완주 또는 타이머 만료 시 게임 종료
// 이벤트 prefix: 'fit:*', socket room name: `fit:${roomId}`
// =========================

const fitRooms = new Map();
const fitInvites = new Map();
const fitUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_TIME_LIMIT_SEC = [0, 300, 600]; // 0 = 무제한, 5분, 10분
const ALLOWED_MODES = ["easy", "normal"];
const EMPTY_ROOM_TTL_MS = 30_000;
const PROGRESS_THROTTLE_MS = 800; // 진척 emit 최소 간격
const MAX_NICK_LEN = 14;
const TOTAL_ROUNDS = 5;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!fitInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `fit:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearGameTimer(room) {
  if (room?.gameTimer) { clearTimeout(room.gameTimer); room.gameTimer = null; }
}
function safeNumber(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function genSeed() {
  // 32bit 양수 정수 (클라가 seeded RNG에 사용)
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

// ===== state shapes =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    // 진척
    currentRound: 0,          // 0~4 (현재 라운드 인덱스)
    clearedRounds: 0,         // 클리어한 라운드 수
    filledCells: 0,           // 현재 라운드 채워진 셀 수
    totalCells: 0,            // 현재 라운드 총 채울 셀 수
    mosaic: [],               // 현재 라운드 보드 상태 (boolean[][])
    mosaicRows: 0,
    mosaicCols: 0,
    // 결과
    status: "playing",        // playing | finished | timeout | left
    finishedRank: 0,          // 완주 순서 (1=1등)
    finishedAt: 0,            // 완주 시각 (ms)
    totalElapsedMs: 0,        // 완주까지 걸린 시간 (시작~완주)
    roundTimes: [],           // [{round:1, ms:8200}, ...]
    lastActionMs: 0,
    lastProgressEmit: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    currentRound: p.currentRound,
    clearedRounds: p.clearedRounds,
    filledCells: p.filledCells,
    totalCells: p.totalCells,
    mosaic: p.mosaic || [],
    mosaicRows: p.mosaicRows,
    mosaicCols: p.mosaicCols,
    status: p.status,
    finishedRank: p.finishedRank,
    finishedAt: p.finishedAt,
    totalElapsedMs: p.totalElapsedMs,
    roundTimes: p.roundTimes || [],
    lastActionMs: p.lastActionMs,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    timeLimitSec: room.timeLimitSec || 0,
    mode: room.mode,
    seeds: room.seeds || null,       // playing 진입 시점부터 전달
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("fit:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearGameTimer(room);
  fitRooms.delete(room.id);
  fitInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (fitUserRoom.get(uid) === room.id) fitUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("fit:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[fit] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = fitRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const p = room.players.get(userId);
  if (p && room.status === "playing" && p.status === "playing") {
    // 플레이 중 이탈 → left 처리, 게임은 계속
    p.status = "left";
    p.connected = false;
  }
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (fitUserRoom.get(userId) === room.id) fitUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("fit:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing") {
    checkAllDoneAndFinish(io, room);
  }
  broadcastRoomState(io, room);
}

function checkAllDoneAndFinish(io, room) {
  const remaining = [...room.players.values()].filter(p => p.status === "playing");
  if (remaining.length === 0) {
    finishGame(io, room, "ALL_DONE");
  }
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearGameTimer(room);

  // 타이머 만료 시 미완료 모두 timeout 처리
  if (reason === "TIME_UP") {
    for (const p of room.players.values()) {
      if (p.status === "playing") p.status = "timeout";
    }
  }

  // 순위:
  // 1) finished: finishedRank 오름차순 (1등 먼저)
  // 2) timeout/left: clearedRounds 내림차순 > filledCells 내림차순 > lastActionMs 오름차순
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);

  ranking.sort((a, b) => {
    const aF = a.status === "finished";
    const bF = b.status === "finished";
    if (aF !== bF) return aF ? -1 : 1;
    if (aF && bF) return (a.finishedRank || 9999) - (b.finishedRank || 9999);
    // 둘 다 미완주
    if ((b.clearedRounds || 0) !== (a.clearedRounds || 0)) return (b.clearedRounds || 0) - (a.clearedRounds || 0);
    if ((b.filledCells || 0) !== (a.filledCells || 0)) return (b.filledCells || 0) - (a.filledCells || 0);
    return (a.lastActionMs || 0) - (b.lastActionMs || 0);
  });

  io.to(socketRoomName(room.id)).emit("fit:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[fit] room ${room.id} game ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerFit(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("fit:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (fitUserRoom.has(me.id)) {
          const old = fitRooms.get(fitUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const requestedTL = Number(payload?.timeLimitSec);
        const timeLimitSec = ALLOWED_TIME_LIMIT_SEC.includes(requestedTL)
          ? requestedTL : 600; // 기본 10분
        const mode = ALLOWED_MODES.includes(payload?.mode) ? payload.mode : "easy";

        const roomId = `ft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, timeLimitSec, mode,
          seeds: null,
          finishedCount: 0,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, gameTimer: null,
        };
        fitRooms.set(roomId, room);
        fitInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        fitUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[fit] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[fit:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("fit:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = fitInvites.get(code);
        const room = roomId ? fitRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          fitUserRoom.set(me.id, roomId);
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
        fitUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[fit:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 옵션 -----
    socket.on("fit:setMaxPlayers", (payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const n = Number(payload?.maxPlayers);
      if (!ALLOWED_MAX_PLAYERS.includes(n)) return cb?.({ ok: false, error: "INVALID_MAX" });
      if (n < room.players.size) return cb?.({ ok: false, error: "BELOW_CURRENT" });
      room.maxPlayers = n;
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("fit:setRoomOptions", (payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.timeLimitSec !== undefined) {
        const t = Number(payload.timeLimitSec);
        if (ALLOWED_TIME_LIMIT_SEC.includes(t)) room.timeLimitSec = t;
      }
      if (payload?.mode !== undefined) {
        if (ALLOWED_MODES.includes(payload.mode)) room.mode = payload.mode;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("fit:startGame", (_payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      // rematch: ended 상태에서 새 게임 허용 (finishGame이 이미 timer 정리)
      if (room.status === "ended") { clearGameTimer(room); room.endedAt = null; }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      // 5라운드 seed 생성
      const seeds = [];
      for (let i = 0; i < TOTAL_ROUNDS; i++) seeds.push(genSeed());
      room.seeds = seeds;
      room.status = "playing";
      room.startedAt = Date.now();
      room.finishedCount = 0;

      for (const p of room.players.values()) {
        p.currentRound = 0;
        p.clearedRounds = 0;
        p.filledCells = 0;
        p.totalCells = 0;
        p.mosaic = [];
        p.mosaicRows = 0;
        p.mosaicCols = 0;
        p.status = "playing";
        p.finishedRank = 0;
        p.finishedAt = 0;
        p.totalElapsedMs = 0;
        p.roundTimes = [];
        p.lastActionMs = Date.now();
        p.lastProgressEmit = 0;
      }

      io.to(socketRoomName(room.id)).emit("fit:gameStart", {
        startedAt: room.startedAt,
        timeLimitSec: room.timeLimitSec || 0,
        mode: room.mode,
        seeds: room.seeds,
        totalRounds: TOTAL_ROUNDS,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      clearGameTimer(room);
      if (room.timeLimitSec > 0) {
        room.gameTimer = setTimeout(() => {
          const r = fitRooms.get(room.id);
          if (r && r.status === "playing") finishGame(io, r, "TIME_UP");
        }, room.timeLimitSec * 1000);
      }
      cb?.({ ok: true, startedAt: room.startedAt, seeds: room.seeds });
    });

    // ----- 진척 업데이트 (throttle) -----
    // payload: { currentRound, filledCells, totalCells, mosaic: boolean[][] }
    socket.on("fit:progress", (payload) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing") return;
      const now = Date.now();
      if (now - p.lastProgressEmit < PROGRESS_THROTTLE_MS) return;
      p.lastProgressEmit = now;

      const cr = Math.max(0, Math.min(TOTAL_ROUNDS - 1, safeNumber(payload?.currentRound, p.currentRound)));
      p.currentRound = cr;
      p.filledCells = Math.max(0, safeNumber(payload?.filledCells, p.filledCells));
      p.totalCells = Math.max(0, safeNumber(payload?.totalCells, p.totalCells));
      p.lastActionMs = now;

      // mosaic 검증: boolean[][], 최대 10x10
      const mosaic = Array.isArray(payload?.mosaic) ? payload.mosaic : null;
      if (mosaic && mosaic.length > 0 && mosaic.length <= 10) {
        const rows = mosaic.length;
        const cols = Math.min(10, Array.isArray(mosaic[0]) ? mosaic[0].length : 0);
        if (cols > 0) {
          const grid = [];
          for (let r = 0; r < rows; r++) {
            const row = [];
            const src = mosaic[r] || [];
            for (let c = 0; c < cols; c++) row.push(!!src[c]);
            grid.push(row);
          }
          p.mosaic = grid;
          p.mosaicRows = rows;
          p.mosaicCols = cols;
        }
      }

      socket.to(socketRoomName(room.id)).emit("fit:peerProgress", {
        playerId: me.id,
        currentRound: p.currentRound,
        clearedRounds: p.clearedRounds,
        filledCells: p.filledCells,
        totalCells: p.totalCells,
        mosaic: p.mosaic,
        mosaicRows: p.mosaicRows,
        mosaicCols: p.mosaicCols,
        lastActionMs: p.lastActionMs,
      });
    });

    // ----- 라운드 클리어 -----
    // payload: { round, roundMs } — round는 0-base 인덱스
    socket.on("fit:roundClear", (payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing") return cb?.({ ok: false, error: "NOT_ACTIVE" });

      const round = Math.max(0, Math.min(TOTAL_ROUNDS - 1, safeNumber(payload?.round, p.currentRound)));
      const roundMs = Math.max(0, safeNumber(payload?.roundMs, 0));
      if (round !== p.currentRound) return cb?.({ ok: false, error: "ROUND_MISMATCH" });

      p.clearedRounds = round + 1;
      p.roundTimes.push({ round: round + 1, ms: roundMs });
      p.lastActionMs = Date.now();

      io.to(socketRoomName(room.id)).emit("fit:peerRoundClear", {
        playerId: me.id,
        round: round + 1,
        clearedRounds: p.clearedRounds,
        roundMs,
      });

      if (p.clearedRounds >= TOTAL_ROUNDS) {
        // 완주
        room.finishedCount += 1;
        p.status = "finished";
        p.finishedRank = room.finishedCount;
        p.finishedAt = Date.now();
        p.totalElapsedMs = p.finishedAt - room.startedAt;
        io.to(socketRoomName(room.id)).emit("fit:peerFinish", {
          playerId: me.id,
          rank: p.finishedRank,
          totalElapsedMs: p.totalElapsedMs,
          roundTimes: p.roundTimes,
        });
        checkAllDoneAndFinish(io, room);
      } else {
        // 다음 라운드로
        p.currentRound = round + 1;
        p.filledCells = 0;
        p.totalCells = 0;
      }

      broadcastRoomState(io, room);
      cb?.({ ok: true, nextRound: p.currentRound, status: p.status });
    });

    // ----- 자발 퇴장 -----
    socket.on("fit:leaveRoom", (_payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ----- 호스트 강퇴 (로비 한정) -----
    socket.on("fit:kickPlayer", (payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("fit:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 -----
    socket.on("fit:requestState", (_payload, cb) => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = fitUserRoom.get(me.id);
      const room = roomId ? fitRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("fit:peerUpdate", { playerId: me.id, connected: false });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
