// =========================
// DUO 수라상 (한식 진화형 합성) — 대회형 비동기 멀티 서버
// 핵심 원칙:
//   - 물리 동기화 X, 각자 자기 판에서 플레이
//   - 서버는 점수/상태/미니보드 snapshot broadcast만 담당
//   - 룸 lifecycle: lobby → playing → ended
//   - 'merge:*' 이벤트 prefix, socket room name = `merge:${roomId}`
// =========================

const mergeRooms = new Map();      // roomId → room
const mergeInvites = new Map();    // inviteCode → roomId
const mergeUserRoom = new Map();   // userId → roomId

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_TIME_LIMIT_SEC = [0, 180, 300, 600]; // 0 = 무제한, 3/5/10분
const ALLOWED_INTERFERENCE_TYPES = new Set(["shake", "random_next", "deadline_down"]);
const EMPTY_ROOM_TTL_MS = 30_000;
const PEER_UPDATE_THROTTLE_MS = 900;
const SNAPSHOT_THROTTLE_MS = 1200;
const INTERFERENCE_THROTTLE_MS = 1500;  // 동일 보낸 사람 방해 연속 발사 방지
const MAX_NICK_LEN = 14;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!mergeInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `merge:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) {
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }
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
    // 게임 진행 상태
    score: 0,
    maxStage: 1,
    combo: 1.0,
    comboMax: 1.0,
    alive: true,
    danger: 0,
    snapshot: [],
    elapsedMs: 0,
    // throttle
    lastScoreEmit: 0,
    lastSnapshotEmit: 0,
    lastInterferenceAt: 0,
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
    maxStage: p.maxStage,
    combo: p.combo,
    comboMax: p.comboMax,
    alive: p.alive,
    danger: p.danger,
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
    interferenceMode: !!room.interferenceMode,
    timeLimitSec: room.timeLimitSec || 0,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("merge:roomState", publicRoom(room));
}

function clearGameTimer(room) {
  if (room?.gameTimer) {
    clearTimeout(room.gameTimer);
    room.gameTimer = null;
  }
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearGameTimer(room);
  mergeRooms.delete(room.id);
  mergeInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (mergeUserRoom.get(uid) === room.id) mergeUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("merge:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[merge] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = mergeRooms.get(room.id);
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
  if (mergeUserRoom.get(userId) === room.id) mergeUserRoom.delete(userId);

  // 호스트 이전
  if (wasHost && room.playerOrder.length > 0) {
    room.hostUserId = room.playerOrder[0];
  }

  io.to(socketRoomName(room.id)).emit("merge:peerLeave", { playerId: userId });

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }

  // 게임 진행 중에 모두 alive=false면 게임 종료
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

  // 순위 산정 — TIME_UP에선 alive 무시(점수 우선), 그 외엔 alive 우선
  // 1순위: alive (TIME_UP은 무시) / 2: score / 3: maxStage / 4: comboMax / 5: elapsedMs ↑(오래 생존)
  const ignoreAlive = (reason === "TIME_UP");
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);
  ranking.sort((a, b) => {
    if (!ignoreAlive && !!a.alive !== !!b.alive) return a.alive ? -1 : 1;
    if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
    if ((b.maxStage || 1) !== (a.maxStage || 1)) return (b.maxStage || 1) - (a.maxStage || 1);
    if ((b.comboMax || 1) !== (a.comboMax || 1)) return (b.comboMax || 1) - (a.comboMax || 1);
    return (b.elapsedMs || 0) - (a.elapsedMs || 0);
  });

  io.to(socketRoomName(room.id)).emit("merge:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[merge] room ${room.id} game ended: ${reason}`);
}

// =========================
// 등록
// =========================
export function registerMerge(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("merge:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });

        // 기존 방 정리
        if (mergeUserRoom.has(me.id)) {
          const old = mergeRooms.get(mergeUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }

        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const interferenceMode = !!payload?.interferenceMode;
        const requestedTL = Number(payload?.timeLimitSec);
        // 기본: 방해 ON=180s(3분) / OFF=300s(5분). 무제한(0)은 명시적 선택 시만
        const timeLimitSec = ALLOWED_TIME_LIMIT_SEC.includes(requestedTL)
          ? requestedTL
          : (interferenceMode ? 180 : 300);

        const roomId = `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",
          maxPlayers,
          interferenceMode,
          timeLimitSec,
          createdAt: Date.now(),
          startedAt: null,
          endedAt: null,
          players: new Map(),
          playerOrder: [],
          emptyRoomTimer: null,
          gameTimer: null,
        };
        mergeRooms.set(roomId, room);
        mergeInvites.set(inviteCode, roomId);

        // 호스트 프로필 가져오기
        let avatar = null;
        let nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}

        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        mergeUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[merge] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[merge:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("merge:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = mergeInvites.get(code);
        const room = roomId ? mergeRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        // 재접속
        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          mergeUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true });
          broadcastRoomState(io, room);
          return;
        }

        // 진행 중이면 신규 입장 거부 (관전 모드는 추후)
        if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        let avatar = null;
        let nick = payload?.nickname;
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
        mergeUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[merge:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 옵션 -----
    socket.on("merge:setMaxPlayers", (payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
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

    socket.on("merge:setRoomOptions", (payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });

      if (typeof payload?.interferenceMode === "boolean") {
        room.interferenceMode = payload.interferenceMode;
      }
      if (payload?.timeLimitSec !== undefined) {
        const t = Number(payload.timeLimitSec);
        if (ALLOWED_TIME_LIMIT_SEC.includes(t)) room.timeLimitSec = t;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("merge:startGame", (_payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      room.status = "playing";
      room.startedAt = Date.now();
      // 모든 플레이어 상태 초기화
      for (const p of room.players.values()) {
        p.score = 0;
        p.maxStage = 1;
        p.combo = 1.0;
        p.comboMax = 1.0;
        p.alive = true;
        p.danger = 0;
        p.snapshot = [];
        p.elapsedMs = 0;
        p.lastScoreEmit = 0;
        p.lastSnapshotEmit = 0;
      }

      io.to(socketRoomName(room.id)).emit("merge:roundStart", {
        startedAt: room.startedAt,
        interferenceMode: !!room.interferenceMode,
        timeLimitSec: room.timeLimitSec || 0,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      // 서버 타이머 — 제한시간 도달 시 finishGame
      clearGameTimer(room);
      if (room.timeLimitSec > 0) {
        room.gameTimer = setTimeout(() => {
          const r = mergeRooms.get(room.id);
          if (r && r.status === "playing") finishGame(io, r, "TIME_UP");
        }, room.timeLimitSec * 1000);
      }

      cb?.({ ok: true, startedAt: room.startedAt });
      console.log(`[merge] room ${room.id} game started, ${room.players.size} players, interference=${room.interferenceMode}, tl=${room.timeLimitSec}s`);
    });

    // ----- 점수 업데이트 (1초 throttle) -----
    socket.on("merge:scoreUpdate", (payload) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || !p.alive) return;

      const now = Date.now();
      if (now - p.lastScoreEmit < PEER_UPDATE_THROTTLE_MS) return;
      p.lastScoreEmit = now;

      p.score = safeNumber(payload?.score, p.score);
      p.maxStage = Math.max(1, Math.min(11, safeNumber(payload?.maxStage, p.maxStage)));
      p.combo = Math.max(1.0, Math.min(3.0, safeNumber(payload?.combo, p.combo)));
      p.comboMax = Math.max(p.comboMax, safeNumber(payload?.comboMax, p.comboMax));
      p.danger = Math.max(0, Math.min(1, safeNumber(payload?.danger, p.danger)));
      p.elapsedMs = safeNumber(payload?.elapsedMs, p.elapsedMs);

      // 자신 제외 broadcast
      socket.to(socketRoomName(room.id)).emit("merge:peerUpdate", {
        playerId: me.id,
        nickname: p.name,
        score: p.score,
        maxStage: p.maxStage,
        combo: p.combo,
        comboMax: p.comboMax,
        alive: p.alive,
        danger: p.danger,
        elapsedMs: p.elapsedMs,
      });
    });

    // ----- 스냅샷 (1.5초 throttle) -----
    socket.on("merge:snapshot", (payload) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || !p.alive) return;

      const now = Date.now();
      if (now - p.lastSnapshotEmit < SNAPSHOT_THROTTLE_MS) return;
      p.lastSnapshotEmit = now;

      // 검증: 배열, 최대 30개, 각 항목 형식
      const rawSnap = Array.isArray(payload?.snapshot) ? payload.snapshot.slice(0, 30) : [];
      const safe = [];
      for (const o of rawSnap) {
        const s = Number(o?.s);
        const x = Number(o?.x);
        const y = Number(o?.y);
        const r = Number(o?.r);
        if (!Number.isFinite(s) || s < 1 || s > 11) continue;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) continue;
        if (x < 0 || x > 1 || y < 0 || y > 1 || r < 0 || r > 1) continue;
        safe.push({ s: Math.floor(s), x: +x.toFixed(3), y: +y.toFixed(3), r: +r.toFixed(3) });
      }
      p.snapshot = safe;

      socket.to(socketRoomName(room.id)).emit("merge:peerUpdate", {
        playerId: me.id,
        snapshot: safe,
      });
    });

    // ----- 방해 발사 -----
    // payload: { type, targetPlayerId? } — targetPlayerId 생략 시 자동 1등 타겟(자기 제외)
    socket.on("merge:interference", (payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (!room.interferenceMode) return cb?.({ ok: false, error: "MODE_OFF" });
      const sender = room.players.get(me.id);
      if (!sender || !sender.alive) return cb?.({ ok: false, error: "DEAD" });

      const type = String(payload?.type || "");
      if (!ALLOWED_INTERFERENCE_TYPES.has(type)) return cb?.({ ok: false, error: "INVALID_TYPE" });

      const now = Date.now();
      if (now - (sender.lastInterferenceAt || 0) < INTERFERENCE_THROTTLE_MS) {
        return cb?.({ ok: false, error: "THROTTLED" });
      }
      sender.lastInterferenceAt = now;

      // 타겟 결정
      let targetId = payload?.targetPlayerId || null;
      if (!targetId) {
        // 자동: 자기 제외 생존자 중 점수 최고
        let best = null;
        for (const uid of room.playerOrder) {
          if (uid === me.id) continue;
          const p = room.players.get(uid);
          if (!p || !p.alive) continue;
          if (!best || p.score > best.p.score) best = { uid, p };
        }
        targetId = best?.uid || null;
      }
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "NO_TARGET" });
      const target = room.players.get(targetId);
      if (!target || !target.alive) return cb?.({ ok: false, error: "TARGET_DEAD" });

      // 같은 방 전원에게 broadcast (다른 사람도 누가 누구에게 쏘는지 보이도록)
      io.to(socketRoomName(room.id)).emit("merge:interference", {
        type,
        from: me.id,
        fromNickname: sender.name,
        to: targetId,
        toNickname: target.name,
        createdAt: now,
      });
      cb?.({ ok: true, to: targetId });
    });

    // ----- 게임오버 -----
    socket.on("merge:dead", (payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (!p.alive) return cb?.({ ok: true, alreadyDead: true });

      p.alive = false;
      p.danger = 1.0;
      // 최종 점수/단계도 반영
      p.score = safeNumber(payload?.score, p.score);
      p.maxStage = Math.max(1, Math.min(11, safeNumber(payload?.maxStage, p.maxStage)));
      p.comboMax = Math.max(p.comboMax, safeNumber(payload?.comboMax, p.comboMax));
      p.elapsedMs = safeNumber(payload?.elapsedMs, p.elapsedMs);

      io.to(socketRoomName(room.id)).emit("merge:peerUpdate", {
        playerId: me.id,
        score: p.score,
        maxStage: p.maxStage,
        comboMax: p.comboMax,
        alive: false,
        danger: 1.0,
        elapsedMs: p.elapsedMs,
      });

      // 모두 dead면 게임 종료
      const anyAlive = [...room.players.values()].some(x => x.alive);
      if (!anyAlive) finishGame(io, room, "ALL_DEAD");

      cb?.({ ok: true });
    });

    // ----- 자발 퇴장 -----
    socket.on("merge:leaveRoom", (_payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 (재접속) -----
    socket.on("merge:requestState", (_payload, cb) => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = mergeUserRoom.get(me.id);
      const room = roomId ? mergeRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      // 최신 소켓이 이미 다른 곳이면 무시
      if (p.socketId !== socket.id) return;
      p.connected = false;

      // 로비 단계라면 즉시 leave, 진행 중이면 connected=false 유지(재접속 대기)
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("merge:peerUpdate", {
          playerId: me.id,
          connected: false,
        });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
