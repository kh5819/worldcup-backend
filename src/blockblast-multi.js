// =========================
// 블록 블래스트 (DUO BlockBlast) — 멀티 점수 경쟁 + 탈락/관전 + 전체 타이머
// 각자 자기 10x10 보드 / 같은 블록 시퀀스 / 점수 경쟁
// 탈락 = 자기 보드에서 더 못 놓을 때 → 관전 모드
// 게임 종료 = 한 명만 남거나 / 모두 탈락 / 전체 타이머 만료
// 이벤트 prefix: 'blockblast:*'
// =========================

const bbRooms = new Map();
const bbInvites = new Map();
const bbUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_GAME_TIME = [300, 600, 0]; // 5분/10분/무제한
const ALLOWED_BLOCK_TIME = [0, 15, 30, 60]; // 자유/15/30/60초 — 한 세트(3블록)
const EMPTY_ROOM_TTL_MS = 30_000;
const PROGRESS_THROTTLE_MS = 700;
const SNAPSHOT_THROTTLE_MS = 1500;
const MAX_NICK_LEN = 14;
const TOTAL_BLOCKS_DEFINED = 17;  // 17종 폴리오미노

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!bbInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `blockblast:${roomId}`; }
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
function genSeed() { return Math.floor(Math.random() * 0xffffffff) >>> 0; }

// ===== state =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    // 진척
    score: 0,
    linesCleared: 0,
    blocksPlaced: 0,
    combo: 1,
    maxCombo: 1,
    boardMask: [],   // boolean[100] — 자기 보드 채워진 셀 (관전용)
    // 결과
    status: "active",       // active | eliminated | left
    eliminatedAt: 0,
    eliminatedRank: 0,      // 탈락 순서 (1=가장 먼저 탈락 → 8등)
    lastActionMs: 0,
    lastProgressEmit: 0,
    lastSnapshotEmit: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    score: p.score,
    linesCleared: p.linesCleared,
    blocksPlaced: p.blocksPlaced,
    combo: p.combo,
    maxCombo: p.maxCombo,
    boardMask: p.boardMask || [],
    status: p.status,
    eliminatedAt: p.eliminatedAt,
    eliminatedRank: p.eliminatedRank,
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
    gameTimeSec: room.gameTimeSec,
    blockTimeSec: room.blockTimeSec ?? 30,
    seed: room.seed || null,
    gameDeadline: room.gameDeadline || null,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("blockblast:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearGameTimer(room);
  bbRooms.delete(room.id);
  bbInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (bbUserRoom.get(uid) === room.id) bbUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("blockblast:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[blockblast] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = bbRooms.get(room.id);
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
  if (p && room.status === "playing" && p.status === "active") {
    p.status = "left";
    p.connected = false;
  }
  if (room.status !== "playing") {
    room.players.delete(userId);
    const idx = room.playerOrder.indexOf(userId);
    if (idx >= 0) room.playerOrder.splice(idx, 1);
  }
  if (bbUserRoom.get(userId) === room.id) bbUserRoom.delete(userId);
  // 새 호스트는 left/disconnected 아닌 사람 우선
  if (wasHost && room.playerOrder.length > 0) {
    const activeFirst = room.playerOrder.find(uid => {
      const pp = room.players.get(uid);
      return pp && pp.connected && pp.status !== "left";
    });
    room.hostUserId = activeFirst || room.playerOrder[0];
  }
  io.to(socketRoomName(room.id)).emit("blockblast:peerLeave", { playerId: userId });

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing") {
    checkAndMaybeFinish(io, room);
  }
  broadcastRoomState(io, room);
}

function activeCount(room) {
  let n = 0;
  for (const p of room.players.values()) if (p.status === "active") n++;
  return n;
}

function checkAndMaybeFinish(io, room) {
  if (room.status !== "playing") return;
  const active = activeCount(room);
  // 모두 탈락 또는 한 명만 살아남으면 종료
  if (active <= 1 && room.players.size >= 2) {
    finishGame(io, room, active === 1 ? "LAST_STANDING" : "ALL_ELIMINATED");
  }
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearGameTimer(room);

  // 살아남은 사람들 active 상태 유지 (점수 기준 1위)
  // 탈락 사람들은 점수 기반으로 그 다음 순위
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);
  ranking.sort((a, b) => {
    // 1순위: status active > eliminated > left
    const order = { active: 0, eliminated: 1, left: 2 };
    if ((order[a.status] ?? 9) !== (order[b.status] ?? 9)) return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    // 2순위: score 내림
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    // 3순위: linesCleared 내림
    return (b.linesCleared || 0) - (a.linesCleared || 0);
  });

  io.to(socketRoomName(room.id)).emit("blockblast:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[blockblast] room ${room.id} game ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerBlockBlastMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("blockblast:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (bbUserRoom.has(me.id)) {
          const old = bbRooms.get(bbUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const gameTimeSec = ALLOWED_GAME_TIME.includes(Number(payload?.gameTimeSec))
          ? Number(payload.gameTimeSec) : 600;
        const blockTimeSec = ALLOWED_BLOCK_TIME.includes(Number(payload?.blockTimeSec))
          ? Number(payload.blockTimeSec) : 30;

        const roomId = `bb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, gameTimeSec, blockTimeSec,
          seed: null,
          gameDeadline: null,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          eliminatedCount: 0,
          emptyRoomTimer: null, gameTimer: null,
        };
        bbRooms.set(roomId, room);
        bbInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        bbUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[blockblast] created room ${roomId} by ${me.id}`);
      } catch (e) {
        console.error("[blockblast:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("blockblast:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = bbInvites.get(code);
        const room = roomId ? bbRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          bbUserRoom.set(me.id, roomId);
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
        bbUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[blockblast:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("blockblast:setMaxPlayers", (payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
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

    socket.on("blockblast:setRoomOptions", (payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.gameTimeSec !== undefined) {
        const t = Number(payload.gameTimeSec);
        if (ALLOWED_GAME_TIME.includes(t)) room.gameTimeSec = t;
      }
      if (payload?.blockTimeSec !== undefined) {
        const bt = Number(payload.blockTimeSec);
        if (ALLOWED_BLOCK_TIME.includes(bt)) room.blockTimeSec = bt;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("blockblast:startGame", (_payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") {
        clearGameTimer(room);
        room.endedAt = null;
        // rematch: 떠난 사람(left) + 끊긴 사람 제거 → 새 사람이 들어올 자리 확보
        const toRemove = [];
        for (const [uid, pp] of room.players.entries()) {
          if (pp.status === "left" || !pp.connected) toRemove.push(uid);
        }
        for (const uid of toRemove) {
          room.players.delete(uid);
          const idx = room.playerOrder.indexOf(uid);
          if (idx >= 0) room.playerOrder.splice(idx, 1);
          if (bbUserRoom.get(uid) === room.id) bbUserRoom.delete(uid);
        }
        // 호스트가 정리된 경우 (자기 자신이 정리되진 않음 — startGame 호출자라 connected)
        if (!room.players.has(room.hostUserId)) {
          room.hostUserId = room.playerOrder[0];
        }
      }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      room.seed = genSeed();
      room.status = "playing";
      room.startedAt = Date.now();
      room.eliminatedCount = 0;
      room.gameDeadline = room.gameTimeSec > 0 ? Date.now() + room.gameTimeSec * 1000 : null;

      for (const p of room.players.values()) {
        p.score = 0; p.linesCleared = 0; p.blocksPlaced = 0;
        p.combo = 1; p.maxCombo = 1;
        p.boardMask = [];
        p.status = "active";
        p.eliminatedAt = 0; p.eliminatedRank = 0;
        p.lastActionMs = Date.now();
        p.lastProgressEmit = 0;
        p.lastSnapshotEmit = 0;
      }

      io.to(socketRoomName(room.id)).emit("blockblast:gameStart", {
        startedAt: room.startedAt,
        seed: room.seed,
        gameTimeSec: room.gameTimeSec,
        gameDeadline: room.gameDeadline,
        blockTimeSec: room.blockTimeSec ?? 30,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      clearGameTimer(room);
      if (room.gameTimeSec > 0) {
        room.gameTimer = setTimeout(() => {
          const r = bbRooms.get(room.id);
          if (r && r.status === "playing") finishGame(io, r, "TIME_UP");
        }, room.gameTimeSec * 1000);
      }

      cb?.({ ok: true });
    });

    // 점수 / 진척 업데이트 (throttle)
    socket.on("blockblast:scoreUpdate", (payload) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "active") return;
      const now = Date.now();
      if (now - p.lastProgressEmit < PROGRESS_THROTTLE_MS) return;
      p.lastProgressEmit = now;

      p.score = Math.max(0, Math.min(999999, safeNumber(payload?.score, p.score)));
      p.linesCleared = Math.max(0, Math.min(9999, safeNumber(payload?.linesCleared, p.linesCleared)));
      p.blocksPlaced = Math.max(0, Math.min(9999, safeNumber(payload?.blocksPlaced, p.blocksPlaced)));
      p.combo = Math.max(1, Math.min(50, safeNumber(payload?.combo, p.combo)));
      p.maxCombo = Math.max(p.maxCombo, Math.min(50, safeNumber(payload?.maxCombo, p.maxCombo)));
      p.lastActionMs = now;

      socket.to(socketRoomName(room.id)).emit("blockblast:peerUpdate", {
        playerId: me.id,
        score: p.score,
        linesCleared: p.linesCleared,
        blocksPlaced: p.blocksPlaced,
        combo: p.combo,
        maxCombo: p.maxCombo,
        lastActionMs: p.lastActionMs,
      });
    });

    // 보드 스냅샷 (관전용)
    socket.on("blockblast:snapshot", (payload) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "active") return;
      const now = Date.now();
      if (now - p.lastSnapshotEmit < SNAPSHOT_THROTTLE_MS) return;
      p.lastSnapshotEmit = now;

      const mask = Array.isArray(payload?.boardMask) ? payload.boardMask : null;
      if (mask && mask.length === 100) {
        p.boardMask = mask.map(v => Math.max(0, Math.min(7, Number(v) | 0)));
      }

      socket.to(socketRoomName(room.id)).emit("blockblast:peerSnapshot", {
        playerId: me.id,
        boardMask: p.boardMask,
      });
    });

    // 탈락
    socket.on("blockblast:eliminated", (payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p || p.status !== "active") return cb?.({ ok: false, error: "NOT_ACTIVE" });

      // 최종 점수 한 번 더 갱신
      p.score = Math.max(0, Math.min(999999, safeNumber(payload?.score, p.score)));
      p.linesCleared = Math.max(0, Math.min(9999, safeNumber(payload?.linesCleared, p.linesCleared)));
      p.blocksPlaced = Math.max(0, Math.min(9999, safeNumber(payload?.blocksPlaced, p.blocksPlaced)));
      p.maxCombo = Math.max(p.maxCombo, Math.min(50, safeNumber(payload?.maxCombo, p.maxCombo)));
      p.status = "eliminated";
      p.eliminatedAt = Date.now();
      room.eliminatedCount += 1;
      p.eliminatedRank = room.eliminatedCount;  // 먼저 탈락한 사람일수록 낮은 등수 (꼴찌)

      io.to(socketRoomName(room.id)).emit("blockblast:peerEliminated", {
        playerId: me.id,
        score: p.score,
        eliminatedRank: p.eliminatedRank,
      });
      broadcastRoomState(io, room);

      checkAndMaybeFinish(io, room);
      cb?.({ ok: true });
    });

    socket.on("blockblast:leaveRoom", (_payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("blockblast:kickPlayer", (payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("blockblast:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("blockblast:requestState", (_payload, cb) => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = bbUserRoom.get(me.id);
      const room = roomId ? bbRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("blockblast:peerUpdate", { playerId: me.id, connected: false });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
