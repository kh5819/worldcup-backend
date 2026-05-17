// =========================
// 굴려굴려 (DUO Golf) — 멀티 네온 미니골프 10홀 동시 슬링 서버
// 핵심: 모든 플레이어 같은 코스, 같은 홀에서 동시 진행
//       서버는 룸/홀 진행/Snapshot relay만, 물리 자체는 클라가 결정
//       모두 홀인 또는 홀 타임아웃 → 다음 홀, 마지막 홀 종료 시 ranking
// 이벤트 prefix: 'golf:*', socket room: `golf:${roomId}`
// 참조 패턴: fit.js
// =========================

const golfRooms = new Map();
const golfInvites = new Map();
const golfUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_MODES = ["short", "hard"];
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;
const TOTAL_HOLES = 10;
const HOLE_TIMEOUT_MS = 120_000;   // 한 홀 최대 2분 (안 끝나면 강제 진행)
const POS_THROTTLE_MS = 50;        // peerPos 서버 throttle (클라 10Hz 송신 → 안전 마진)

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!golfInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `golf:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearHoleTimer(room) {
  if (room?.holeTimer) { clearTimeout(room.holeTimer); room.holeTimer = null; }
}
function safeNumber(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

// ===== state =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    // 현재 홀 진척
    strokes: 0,
    holed: false,
    holeStartT: 0,
    holeTime: 0,
    // 누적 (10홀)
    totalStrokes: 0,
    totalTime: 0,
    lastFinishedAt: 0,
    // 결과
    status: "playing",       // playing | finished | left | timeout
    lastActionMs: 0,
    lastPosEmit: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    id: userId,
    playerId: userId,
    userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    strokes: p.strokes,
    holed: p.holed,
    totalStrokes: p.totalStrokes,
    totalTime: p.totalTime,
    status: p.status,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostId: room.hostUserId,
    hostUserId: room.hostUserId,
    status: room.status,
    started: room.status === "playing",
    maxPlayers: room.maxPlayers,
    mode: room.mode,
    holeIndex: room.holeIndex || 0,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("golf:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearHoleTimer(room);
  golfRooms.delete(room.id);
  golfInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (golfUserRoom.get(uid) === room.id) golfUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("golf:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[golf] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = golfRooms.get(room.id);
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
  if (golfUserRoom.get(userId) === room.id) golfUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("golf:peerLeave", { playerId: userId, nickname: p?.name });
  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing") {
    checkAllHoledAndAdvance(io, room);
  }
  broadcastRoomState(io, room);
}

// ===== 홀 진행 =====
function startHole(io, room, holeIndex) {
  room.holeIndex = holeIndex;
  room.holeStartT = Date.now();
  for (const p of room.players.values()) {
    if (p.status === "left") continue;
    p.strokes = 0;
    p.holed = false;
    p.holeStartT = Date.now();
    p.holeTime = 0;
    p.lastActionMs = Date.now();
  }
  clearHoleTimer(room);
  room.holeTimer = setTimeout(() => {
    const r = golfRooms.get(room.id);
    if (r && r.status === "playing" && r.holeIndex === holeIndex) {
      // 시간 초과 → 못 들어간 사람들도 그냥 진행 (totalStrokes에 par+3 같은 페널티 부여)
      for (const p of r.players.values()) {
        if (p.status === "playing" && !p.holed){
          // 페널티: 현재 stroke + 2
          p.totalStrokes += (p.strokes + 2);
          p.totalTime += HOLE_TIMEOUT_MS;
        }
      }
      advanceHole(io, r);
    }
  }, HOLE_TIMEOUT_MS);
}

function advanceHole(io, room) {
  clearHoleTimer(room);
  const next = (room.holeIndex || 0) + 1;
  if (next >= TOTAL_HOLES) {
    // 라운드 종료
    finishRound(io, room, "ALL_HOLES_DONE");
    return;
  }
  io.to(socketRoomName(room.id)).emit("golf:holeAdvance", { holeIndex: next });
  startHole(io, room, next);
  broadcastRoomState(io, room);
}

function checkAllHoledAndAdvance(io, room) {
  if (room.status !== "playing") return;
  const active = [...room.players.values()].filter(p => p.status === "playing");
  if (active.length === 0) {
    // 모두 떠남 (left)
    finishRound(io, room, "ALL_LEFT");
    return;
  }
  const allHoled = active.every(p => p.holed);
  if (allHoled) {
    advanceHole(io, room);
  }
}

function finishRound(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearHoleTimer(room);

  // 순위 정렬: 타수 ↑ → 시간 ↓ → 마지막 홀인 시각 ↓
  // colorIdx는 게임 시작 시 고정된 값 사용 (leave해도 다른 사람 색 안 바뀜)
  const ranking = room.playerOrder.map((uid, idx) => {
    const p = room.players.get(uid);
    if (!p) return null;
    return {
      playerId: uid,
      nickname: p.name,
      strokes: p.totalStrokes,
      totalTime: p.totalTime,
      finishedAt: p.lastFinishedAt || 0,
      colorIdx: p.colorIdx !== undefined ? p.colorIdx : idx,
      status: p.status,
    };
  }).filter(Boolean);
  ranking.sort((a, b) => {
    if (a.strokes !== b.strokes) return a.strokes - b.strokes;
    if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
    return (a.finishedAt || 0) - (b.finishedAt || 0);
  });

  io.to(socketRoomName(room.id)).emit("golf:roundEnd", { reason, ranking });
  io.to(socketRoomName(room.id)).emit("golf:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[golf] room ${room.id} round ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerGolf(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("golf:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (golfUserRoom.has(me.id)) {
          const old = golfRooms.get(golfUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const mode = ALLOWED_MODES.includes(payload?.mode) ? payload.mode : "short";

        const roomId = `gf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, mode,
          holeIndex: 0,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, holeTimer: null,
          holeStartT: 0,
        };
        golfRooms.set(roomId, room);
        golfInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        golfUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[golf] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[golf:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("golf:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = golfInvites.get(code);
        const room = roomId ? golfRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          golfUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status === "playing") return cb?.({ ok: false, error: "GAME_STARTED" });
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
        golfUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        io.to(socketRoomName(room.id)).emit("golf:peerJoin", { player: publicPlayer(me.id, room.players.get(me.id)) });
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[golf:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 설정 -----
    socket.on("golf:setMaxPlayers", (payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
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

    socket.on("golf:setMode", (payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const m = String(payload?.mode || "");
      if (!ALLOWED_MODES.includes(m)) return cb?.({ ok: false, error: "INVALID_MODE" });
      room.mode = m;
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("golf:startGame", (_payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") { clearHoleTimer(room); room.endedAt = null; }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      room.status = "playing";
      room.startedAt = Date.now();
      room.holeIndex = 0;

      let colorAssignIdx = 0;
      for (const uid of room.playerOrder) {
        const p = room.players.get(uid);
        if (!p) continue;
        p.colorIdx = colorAssignIdx++;  // 시작 시점 고정 — leave 시 다른 사람 색 안 바뀜
        p.strokes = 0;
        p.holed = false;
        p.totalStrokes = 0;
        p.totalTime = 0;
        p.lastFinishedAt = 0;
        p.holeStartT = Date.now();
        p.holeTime = 0;
        p.status = "playing";
        p.lastActionMs = Date.now();
      }

      io.to(socketRoomName(room.id)).emit("golf:gameStart", {
        startedAt: room.startedAt,
        mode: room.mode,
        totalHoles: TOTAL_HOLES,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);
      startHole(io, room, 0);
      cb?.({ ok: true, startedAt: room.startedAt });
    });

    // ----- Snapshot relay: 샷 발사 -----
    socket.on("golf:peerShot", (payload) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing" || p.holed) return;
      // 단순 stroke 카운트 업데이트 (클라가 보낸 strokes 반영)
      p.strokes = Math.max(p.strokes, safeNumber(payload?.strokes, p.strokes));
      p.lastActionMs = Date.now();
      socket.to(socketRoomName(room.id)).emit("golf:peerShot", {
        playerId: me.id,
        x: safeNumber(payload?.x, 0),
        y: safeNumber(payload?.y, 0),
        vx: safeNumber(payload?.vx, 0),
        vy: safeNumber(payload?.vy, 0),
        strokes: p.strokes,
        ts: Date.now(),
      });
    });

    // ----- Snapshot relay: 위치 업데이트 (10Hz throttle) -----
    socket.on("golf:peerPos", (payload) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing" || p.holed) return;
      const now = Date.now();
      if (now - p.lastPosEmit < POS_THROTTLE_MS) return;
      p.lastPosEmit = now;
      socket.to(socketRoomName(room.id)).emit("golf:peerPos", {
        playerId: me.id,
        x: safeNumber(payload?.x, 0),
        y: safeNumber(payload?.y, 0),
        vx: safeNumber(payload?.vx, 0),
        vy: safeNumber(payload?.vy, 0),
        ts: now,
      });
    });

    // ----- Snapshot relay: 정지 -----
    socket.on("golf:peerStop", (payload) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing") return;
      socket.to(socketRoomName(room.id)).emit("golf:peerStop", {
        playerId: me.id,
        x: safeNumber(payload?.x, 0),
        y: safeNumber(payload?.y, 0),
        ts: Date.now(),
      });
    });

    // ----- 홀인 -----
    socket.on("golf:peerHoleIn", (payload) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.status !== "playing" || p.holed) return;
      const holeIndex = safeNumber(payload?.holeIndex, room.holeIndex);
      if (holeIndex !== room.holeIndex) return;  // 홀 mismatch 무시

      const strokes = Math.max(1, safeNumber(payload?.strokes, p.strokes || 1));
      const holeTime = Math.max(0, safeNumber(payload?.time, Date.now() - p.holeStartT));

      p.holed = true;
      p.strokes = strokes;
      p.holeTime = holeTime;
      p.totalStrokes += strokes;
      p.totalTime += holeTime;
      // lastFinishedAt를 game start 기준 offset(ms)으로 저장 — 클라가 fmtTime 직접 사용 가능
      p.lastFinishedAt = Date.now() - (room.startedAt || Date.now());
      p.lastActionMs = Date.now();

      io.to(socketRoomName(room.id)).emit("golf:peerHoleIn", {
        playerId: me.id,
        holeIndex,
        strokes,
        time: holeTime,
      });
      checkAllHoledAndAdvance(io, room);
    });

    // ----- 자발 퇴장 -----
    socket.on("golf:leaveRoom", (_payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 -----
    socket.on("golf:requestState", (_payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 호스트 강퇴 (로비 한정) -----
    socket.on("golf:kickPlayer", (payload, cb) => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("golf:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = golfUserRoom.get(me.id);
      const room = roomId ? golfRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("golf:peerLeave", { playerId: me.id, nickname: p.name });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
