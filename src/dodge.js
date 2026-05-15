// =========================
// 피해피해 (DUO Dodge) — 멀티 탄막 회피 생존 게임 서버
// 핵심: 물리/적/탄막 동기화 X. 각자 자기 화면에서 진행, 서버는 점수/HP/상태/snapshot broadcast만.
// 수라상 멀티 패턴 그대로 (merge.js와 거의 동일 구조)
// 이벤트 prefix: 'dodge:*', socket room name: `dodge:${roomId}`
// =========================

const dgRooms = new Map();
const dgInvites = new Map();
const dgUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_TIME_LIMIT_SEC = [0, 180, 300, 600]; // 0 = 무제한, 3/5/10분
const EMPTY_ROOM_TTL_MS = 30_000;
const PEER_UPDATE_THROTTLE_MS = 700;
const SNAPSHOT_THROTTLE_MS = 1000;
const MAX_NICK_LEN = 14;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!dgInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `dodge:${roomId}`; }
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

// ===== state shapes =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    score: 0,
    hp: 100,
    maxHp: 100,
    kills: 0,
    level: 1,
    alive: true,
    snapshot: [],
    elapsedMs: 0,
    lastScoreEmit: 0,
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
    hp: p.hp,
    maxHp: p.maxHp,
    kills: p.kills,
    level: p.level,
    alive: p.alive,
    snapshot: p.snapshot || [],
    elapsedMs: p.elapsedMs,
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
    interfereEnabled: !!room.interfereEnabled,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("dodge:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearGameTimer(room);
  dgRooms.delete(room.id);
  dgInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (dgUserRoom.get(uid) === room.id) dgUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("dodge:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[dodge] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = dgRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (dgUserRoom.get(userId) === room.id) dgUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("dodge:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing") {
    const anyAlive = [...room.players.values()].some(p => p.alive);
    if (!anyAlive) finishGame(io, room, "ALL_DEAD");
  }
  broadcastRoomState(io, room);
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearGameTimer(room);

  // 순위: TIME_UP/LAST_STANDING — alive 우선 / score 내림차순 / kills 내림차순 / elapsedMs 내림차순
  const ignoreAlive = (reason === "TIME_UP");
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);
  ranking.sort((a, b) => {
    if (!ignoreAlive && !!a.alive !== !!b.alive) return a.alive ? -1 : 1;
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((b.kills || 0) !== (a.kills || 0)) return (b.kills || 0) - (a.kills || 0);
    return (b.elapsedMs || 0) - (a.elapsedMs || 0);
  });

  io.to(socketRoomName(room.id)).emit("dodge:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[dodge] room ${room.id} game ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerDodge(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("dodge:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (dgUserRoom.has(me.id)) {
          const old = dgRooms.get(dgUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const requestedTL = Number(payload?.timeLimitSec);
        const timeLimitSec = ALLOWED_TIME_LIMIT_SEC.includes(requestedTL)
          ? requestedTL : 300; // 기본 5분

        const roomId = `dg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, timeLimitSec,
          interfereEnabled: true, // 방해모드 호스트 토글 (기본 ON)
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, gameTimer: null,
        };
        dgRooms.set(roomId, room);
        dgInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        dgUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[dodge] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[dodge:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("dodge:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = dgInvites.get(code);
        const room = roomId ? dgRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          dgUserRoom.set(me.id, roomId);
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
        dgUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[dodge:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 옵션 -----
    socket.on("dodge:setMaxPlayers", (payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
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

    socket.on("dodge:setRoomOptions", (payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.timeLimitSec !== undefined) {
        const t = Number(payload.timeLimitSec);
        if (ALLOWED_TIME_LIMIT_SEC.includes(t)) room.timeLimitSec = t;
      }
      if (payload?.interfereEnabled !== undefined) {
        room.interfereEnabled = !!payload.interfereEnabled;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 방해 이벤트 발동 (게이지 가득 찼을 때 클라가 호출) -----
    socket.on("dodge:interfere", (payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (!room.interfereEnabled) return cb?.({ ok: false, error: "INTERFERE_OFF" });
      const sender = room.players.get(me.id);
      if (!sender || !sender.alive) return cb?.({ ok: false, error: "DEAD_OR_NOT_PLAYER" });
      const allowedEffects = ["darken", "invert", "slow", "bulletStorm"];
      const effect = allowedEffects.includes(payload?.effect) ? payload.effect : "darken";
      // 살아있는 다른 플레이어 중 랜덤 1명
      const others = [];
      for (const p of room.players.values()) {
        if (p.userId !== me.id && p.alive) others.push(p);
      }
      if (others.length === 0) return cb?.({ ok: false, error: "NO_TARGET" });
      const target = others[Math.floor(Math.random() * others.length)];
      const senderName = sender.nickname || "익명";
      io.to(target.socketId).emit("dodge:interfered", { effect, fromNickname: senderName });
      // 다른 모두에게 발동 알림 (토스트)
      io.to(roomId).emit("dodge:interfereSent", {
        fromUserId: me.id, fromNickname: senderName,
        toUserId: target.userId, toNickname: target.nickname || "익명",
        effect,
      });
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("dodge:startGame", (_payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      room.status = "playing";
      room.startedAt = Date.now();
      for (const p of room.players.values()) {
        p.score = 0; p.hp = p.maxHp = 100; p.kills = 0; p.level = 1;
        p.alive = true; p.snapshot = []; p.elapsedMs = 0;
        p.lastScoreEmit = 0; p.lastSnapshotEmit = 0;
      }

      io.to(socketRoomName(room.id)).emit("dodge:roundStart", {
        startedAt: room.startedAt,
        timeLimitSec: room.timeLimitSec || 0,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      clearGameTimer(room);
      if (room.timeLimitSec > 0) {
        room.gameTimer = setTimeout(() => {
          const r = dgRooms.get(room.id);
          if (r && r.status === "playing") finishGame(io, r, "TIME_UP");
        }, room.timeLimitSec * 1000);
      }
      cb?.({ ok: true, startedAt: room.startedAt });
    });

    // ----- 점수/HP 업데이트 (throttle) -----
    socket.on("dodge:scoreUpdate", (payload) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || !p.alive) return;
      const now = Date.now();
      if (now - p.lastScoreEmit < PEER_UPDATE_THROTTLE_MS) return;
      p.lastScoreEmit = now;
      p.score = safeNumber(payload?.score, p.score);
      p.hp = Math.max(0, Math.min(p.maxHp, safeNumber(payload?.hp, p.hp)));
      p.kills = safeNumber(payload?.kills, p.kills);
      p.level = Math.max(1, safeNumber(payload?.level, p.level));
      p.elapsedMs = safeNumber(payload?.elapsedMs, p.elapsedMs);
      socket.to(socketRoomName(room.id)).emit("dodge:peerUpdate", {
        playerId: me.id, nickname: p.name,
        score: p.score, hp: p.hp, maxHp: p.maxHp,
        kills: p.kills, level: p.level, alive: p.alive,
        elapsedMs: p.elapsedMs,
      });
    });

    // ----- 스냅샷 (자기 화면 미니 — 1초 throttle) -----
    socket.on("dodge:snapshot", (payload) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || !p.alive) return;
      const now = Date.now();
      if (now - p.lastSnapshotEmit < SNAPSHOT_THROTTLE_MS) return;
      p.lastSnapshotEmit = now;
      // snapshot 검증 — 정규화 좌표 0~1, 최대 60 객체
      const raw = Array.isArray(payload?.snapshot) ? payload.snapshot.slice(0, 60) : [];
      const safe = [];
      for (const o of raw) {
        const x = Number(o?.x), y = Number(o?.y), t = String(o?.t || "").slice(0, 8);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < 0 || x > 1 || y < 0 || y > 1) continue;
        safe.push({ x: +x.toFixed(3), y: +y.toFixed(3), t });
      }
      p.snapshot = safe;
      socket.to(socketRoomName(room.id)).emit("dodge:peerUpdate", { playerId: me.id, snapshot: safe });
    });

    // ----- 사망 -----
    socket.on("dodge:dead", (payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (!p.alive) return cb?.({ ok: true, alreadyDead: true });
      p.alive = false; p.hp = 0;
      p.score = safeNumber(payload?.score, p.score);
      p.kills = safeNumber(payload?.kills, p.kills);
      p.elapsedMs = safeNumber(payload?.elapsedMs, p.elapsedMs);
      io.to(socketRoomName(room.id)).emit("dodge:peerUpdate", {
        playerId: me.id, score: p.score, hp: 0, kills: p.kills,
        alive: false, elapsedMs: p.elapsedMs,
      });
      const anyAlive = [...room.players.values()].some(x => x.alive);
      if (!anyAlive) finishGame(io, room, "ALL_DEAD");
      else if ([...room.players.values()].filter(x => x.alive).length === 1) {
        // 1명만 남으면 마지막 생존자 승리
        finishGame(io, room, "LAST_STANDING");
      }
      cb?.({ ok: true });
    });

    // ----- 자발 퇴장 -----
    socket.on("dodge:leaveRoom", (_payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ----- 호스트 강퇴 (로비 한정) -----
    socket.on("dodge:kickPlayer", (payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("dodge:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 -----
    socket.on("dodge:requestState", (_payload, cb) => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = dgUserRoom.get(me.id);
      const room = roomId ? dgRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("dodge:peerUpdate", { playerId: me.id, connected: false });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
