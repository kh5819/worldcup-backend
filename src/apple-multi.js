// =========================
// 사과게임 (DUO Apple / Fruit Box) — 멀티 2분 점수 대결 서버
// 핵심: 모든 플레이어 같은 격자 (서버가 seed 1개 broadcast)
//       서버는 점수/사과제거상태 sync만, 사과 합 판정 로직은 클라가 결정
//       2분 타이머 만료 시 게임 종료, 점수 1위 우승
//       랭킹 등록 X (솔로 전용)
// 이벤트 prefix: 'apple:*', socket room name: `apple:${roomId}`
// =========================

const appleRooms = new Map();
const appleInvites = new Map();
const appleUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_TIME_LIMIT_SEC = [60, 120, 180]; // 1분/2분/3분
const EMPTY_ROOM_TTL_MS = 30_000;
const PROGRESS_THROTTLE_MS = 600; // 진척 emit 최소 간격
const SNAPSHOT_THROTTLE_MS = 1500; // 보드 스냅샷 (관전용 미니보드)
const MAX_NICK_LEN = 14;
const COLS = 17;
const ROWS = 10;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!appleInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `apple:${roomId}`; }
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
    score: 0,
    applesCleared: 0,
    combo: 1,
    maxCombo: 1,
    removedMask: [],   // boolean[170] — true=제거됨 (관전 미니보드용)
    // 결과
    status: "playing",        // playing | finished | left
    finishedAt: 0,
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
    applesCleared: p.applesCleared,
    combo: p.combo,
    maxCombo: p.maxCombo,
    removedMask: p.removedMask || [],
    status: p.status,
    finishedAt: p.finishedAt,
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
    timeLimitSec: room.timeLimitSec || 120,
    seed: room.seed || null,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("apple:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearGameTimer(room);
  appleRooms.delete(room.id);
  appleInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (appleUserRoom.get(uid) === room.id) appleUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("apple:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[apple] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = appleRooms.get(room.id);
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
    p.status = "left";
    p.connected = false;
  }
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (appleUserRoom.get(userId) === room.id) appleUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("apple:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  broadcastRoomState(io, room);
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearGameTimer(room);

  // 미완료 모두 finished 처리
  for (const p of room.players.values()) {
    if (p.status === "playing") p.status = "finished";
  }

  // 순위: score 내림차순 > applesCleared 내림차순 > lastActionMs 오름차순
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);

  ranking.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((b.applesCleared || 0) !== (a.applesCleared || 0)) return (b.applesCleared || 0) - (a.applesCleared || 0);
    return (a.lastActionMs || 0) - (b.lastActionMs || 0);
  });

  io.to(socketRoomName(room.id)).emit("apple:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[apple] room ${room.id} game ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerAppleMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("apple:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (appleUserRoom.has(me.id)) {
          const old = appleRooms.get(appleUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const requestedTL = Number(payload?.timeLimitSec);
        const timeLimitSec = ALLOWED_TIME_LIMIT_SEC.includes(requestedTL)
          ? requestedTL : 120; // 기본 2분

        const roomId = `ap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, timeLimitSec,
          seed: null,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, gameTimer: null,
        };
        appleRooms.set(roomId, room);
        appleInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        appleUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[apple] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[apple:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("apple:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = appleInvites.get(code);
        const room = roomId ? appleRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          appleUserRoom.set(me.id, roomId);
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
        appleUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[apple:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 옵션 -----
    socket.on("apple:setMaxPlayers", (payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
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

    socket.on("apple:setRoomOptions", (payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.timeLimitSec !== undefined) {
        const t = Number(payload.timeLimitSec);
        if (ALLOWED_TIME_LIMIT_SEC.includes(t)) room.timeLimitSec = t;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("apple:startGame", (_payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") { clearGameTimer(room); room.endedAt = null; }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      const seed = genSeed();
      room.seed = seed;
      room.status = "playing";
      room.startedAt = Date.now();

      for (const p of room.players.values()) {
        p.score = 0;
        p.applesCleared = 0;
        p.combo = 1;
        p.maxCombo = 1;
        p.removedMask = [];
        p.status = "playing";
        p.finishedAt = 0;
        p.lastActionMs = Date.now();
        p.lastProgressEmit = 0;
        p.lastSnapshotEmit = 0;
      }

      io.to(socketRoomName(room.id)).emit("apple:gameStart", {
        startedAt: room.startedAt,
        timeLimitSec: room.timeLimitSec,
        seed: room.seed,
        cols: COLS,
        rows: ROWS,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      clearGameTimer(room);
      room.gameTimer = setTimeout(() => {
        const r = appleRooms.get(room.id);
        if (r && r.status === "playing") finishGame(io, r, "TIME_UP");
      }, room.timeLimitSec * 1000);

      cb?.({ ok: true, startedAt: room.startedAt, seed: room.seed });
    });

    // ----- 점수 업데이트 (throttle) -----
    // payload: { score, applesCleared, combo, maxCombo }
    socket.on("apple:scoreUpdate", (payload) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing") return;
      const now = Date.now();
      if (now - p.lastProgressEmit < PROGRESS_THROTTLE_MS) return;
      p.lastProgressEmit = now;

      p.score = Math.max(0, Math.min(9999, safeNumber(payload?.score, p.score)));
      p.applesCleared = Math.max(0, Math.min(170, safeNumber(payload?.applesCleared, p.applesCleared)));
      p.combo = Math.max(1, Math.min(50, safeNumber(payload?.combo, p.combo)));
      const newMaxCombo = Math.max(p.maxCombo, safeNumber(payload?.maxCombo, p.maxCombo));
      p.maxCombo = Math.max(0, Math.min(50, newMaxCombo));
      p.lastActionMs = now;

      socket.to(socketRoomName(room.id)).emit("apple:peerUpdate", {
        playerId: me.id,
        score: p.score,
        applesCleared: p.applesCleared,
        combo: p.combo,
        maxCombo: p.maxCombo,
        lastActionMs: p.lastActionMs,
      });
    });

    // ----- 보드 스냅샷 (관전 미니보드, 더 느린 throttle) -----
    // payload: { removedMask: boolean[170] }
    socket.on("apple:snapshot", (payload) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing") return;
      const now = Date.now();
      if (now - p.lastSnapshotEmit < SNAPSHOT_THROTTLE_MS) return;
      p.lastSnapshotEmit = now;

      const mask = Array.isArray(payload?.removedMask) ? payload.removedMask : null;
      if (mask && mask.length === COLS * ROWS) {
        // boolean[170]만 허용
        p.removedMask = mask.map(v => !!v);
      }

      socket.to(socketRoomName(room.id)).emit("apple:peerSnapshot", {
        playerId: me.id,
        removedMask: p.removedMask,
      });
    });

    // ----- 자발 종료 (포기) -----
    socket.on("apple:giveUp", (_payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      p.status = "finished";
      p.finishedAt = Date.now();
      io.to(socketRoomName(room.id)).emit("apple:peerFinish", { playerId: me.id });
      cb?.({ ok: true });
    });

    // ----- 자발 퇴장 -----
    socket.on("apple:leaveRoom", (_payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ----- 호스트 강퇴 (로비 한정) -----
    socket.on("apple:kickPlayer", (payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("apple:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 -----
    socket.on("apple:requestState", (_payload, cb) => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = appleUserRoom.get(me.id);
      const room = roomId ? appleRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("apple:peerUpdate", { playerId: me.id, connected: false });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
