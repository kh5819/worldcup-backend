// =========================
// 야추 다이스 (DUO Yacht / Yahtzee 한국형) — 2~8인 턴제 정통 룰
// 5 주사위 × 최대 3번 굴림 × 13 카테고리
// 상단 63+ → +35 보너스 / 야추 보너스 +100
// 이벤트 prefix: 'yacht:*'
// =========================

const yachtRooms = new Map();
const yachtInvites = new Map();
const yachtUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_TURN_TIME = [0, 30, 60, 90]; // 자유/30/60/90초
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;
const TOTAL_CATEGORIES = 13;

const CATEGORIES = [
  "ones","twos","threes","fours","fives","sixes",
  "threeKind","fourKind","fullHouse","smallStraight","largeStraight","yacht","chance",
];
const UPPER_KEYS = ["ones","twos","threes","fours","fives","sixes"];

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!yachtInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `yacht:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearTurnTimer(room) {
  if (room?.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function safeNumber(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function rollOne() { return 1 + Math.floor(Math.random() * 6); }

// ===== score calc =====
function calcScore(category, dice) {
  const counts = [0,0,0,0,0,0,0];  // 1~6
  for (const d of dice) counts[d]++;
  const sum = dice.reduce((a,b)=>a+b, 0);

  switch (category) {
    case "ones":   return counts[1] * 1;
    case "twos":   return counts[2] * 2;
    case "threes": return counts[3] * 3;
    case "fours":  return counts[4] * 4;
    case "fives":  return counts[5] * 5;
    case "sixes":  return counts[6] * 6;
    case "threeKind": return counts.some(c => c >= 3) ? sum : 0;
    case "fourKind":  return counts.some(c => c >= 4) ? sum : 0;
    case "fullHouse": {
      const has3 = counts.some(c => c === 3);
      const has2 = counts.some(c => c === 2);
      // 야추(5개 같은수)도 풀하우스로 인정하는 룰도 있지만 정통은 X
      return (has3 && has2) ? 25 : 0;
    }
    case "smallStraight": {
      const set = new Set(dice);
      const patterns = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
      return patterns.some(p => p.every(n => set.has(n))) ? 30 : 0;
    }
    case "largeStraight": {
      const set = new Set(dice);
      const patterns = [[1,2,3,4,5],[2,3,4,5,6]];
      return patterns.some(p => p.every(n => set.has(n))) ? 40 : 0;
    }
    case "yacht":  return counts.some(c => c === 5) ? 50 : 0;
    case "chance": return sum;
    default: return 0;
  }
}

function calcUpperSum(scoreCard) {
  let s = 0;
  for (const k of UPPER_KEYS) if (typeof scoreCard[k] === "number") s += scoreCard[k];
  return s;
}
function calcTotal(player) {
  let s = 0;
  for (const k of CATEGORIES) if (typeof player.scoreCard[k] === "number") s += player.scoreCard[k];
  const upper = calcUpperSum(player.scoreCard);
  if (upper >= 63) s += 35;
  s += (player.yachtBonus || 0);
  return s;
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
    scoreCard: {},     // {ones:N, twos:N, ...}  채워진 카테고리만
    yachtBonus: 0,     // 야추 한 번 더 시 +100씩 누적
    status: "active",
    lastActionMs: 0,
  };
}

function publicPlayer(userId, p) {
  if (!p) return null;
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    scoreCard: p.scoreCard || {},
    upperSum: calcUpperSum(p.scoreCard || {}),
    yachtBonus: p.yachtBonus || 0,
    total: calcTotal(p),
    filledCount: Object.keys(p.scoreCard || {}).length,
    status: p.status,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    turnTimeSec: room.turnTimeSec,
    currentTurnId: room.currentTurnId,
    turnDeadline: room.turnDeadline,
    dice: room.dice || [0,0,0,0,0],
    locked: room.locked || [false,false,false,false,false],
    rollsLeft: room.rollsLeft || 0,
    turnRound: room.turnRound || 0,  // 1~13
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("yacht:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearTurnTimer(room);
  yachtRooms.delete(room.id);
  yachtInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (yachtUserRoom.get(uid) === room.id) yachtUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("yacht:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[yacht] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = yachtRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function activeOrderedPlayers(room) {
  return room.playerOrder.filter(uid => {
    const p = room.players.get(uid);
    // active 상태 + connected 둘 다 필요 (disconnect 사람은 차례 안 옴)
    return p && p.status === "active" && p.connected;
  });
}

function startTurn(io, room) {
  clearTurnTimer(room);
  room.dice = [0,0,0,0,0];
  room.locked = [false,false,false,false,false];
  room.rollsLeft = 3;
  room.actionLocked = false;  // 중복 입력 방지 락 초기화

  if (room.turnTimeSec > 0) {
    room.turnDeadline = Date.now() + room.turnTimeSec * 1000;
    room.turnTimer = setTimeout(() => {
      const r = yachtRooms.get(room.id);
      if (!r || r.status !== "playing") return;
      // 타임아웃 → 강제 점수 입력 (chance에 0점 또는 빈 카테고리 0점)
      autoFillForTimeout(io, r);
    }, room.turnTimeSec * 1000 + 200);
  } else {
    room.turnDeadline = null;
  }

  io.to(socketRoomName(room.id)).emit("yacht:turnStart", {
    currentTurnId: room.currentTurnId,
    deadline: room.turnDeadline,
    turnRound: room.turnRound,
  });
}

function autoFillForTimeout(io, room) {
  const p = room.players.get(room.currentTurnId);
  if (!p) return;
  // 빈 카테고리 중 첫 번째에 현재 다이스로 점수 0 적용 (또는 가능한 점수)
  const emptyKey = CATEGORIES.find(k => !(k in p.scoreCard));
  if (!emptyKey) return nextTurn(io, room);
  const score = (room.dice || []).every(d => d > 0) ? calcScore(emptyKey, room.dice) : 0;
  p.scoreCard[emptyKey] = score;
  io.to(socketRoomName(room.id)).emit("yacht:scoreFilled", {
    playerId: room.currentTurnId,
    category: emptyKey,
    score,
    auto: true,
  });
  nextTurn(io, room);
}

function nextTurn(io, room) {
  if (room.status !== "playing") return;
  const active = activeOrderedPlayers(room);
  if (active.length === 0) return finishGame(io, room, "ALL_LEFT");

  // 모든 사람이 13 카테고리 다 채웠는지?
  const allDone = active.every(uid => {
    const p = room.players.get(uid);
    return Object.keys(p.scoreCard).length >= TOTAL_CATEGORIES;
  });
  if (allDone) return finishGame(io, room, "ALL_DONE");

  // 다음 차례: 현재 차례 다음 active player (한 바퀴 돌면 turnRound +1)
  const curIdx = active.indexOf(room.currentTurnId);
  const nextIdx = curIdx >= 0 ? (curIdx + 1) % active.length : 0;
  room.currentTurnId = active[nextIdx];
  if (curIdx >= 0 && nextIdx === 0) room.turnRound += 1;
  startTurn(io, room);
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearTurnTimer(room);

  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);
  ranking.sort((a, b) => (b.total || 0) - (a.total || 0));

  io.to(socketRoomName(room.id)).emit("yacht:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[yacht] room ${room.id} game ended: ${reason}`);
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasCurrent = room.currentTurnId === userId;
  const p = room.players.get(userId);
  if (p && room.status === "playing") {
    p.status = "left";
    p.connected = false;
  }
  if (room.status !== "playing") {
    room.players.delete(userId);
    const idx = room.playerOrder.indexOf(userId);
    if (idx >= 0) room.playerOrder.splice(idx, 1);
  }
  if (yachtUserRoom.get(userId) === room.id) yachtUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) {
    const af = room.playerOrder.find(uid => {
      const pp = room.players.get(uid);
      return pp && pp.connected && pp.status !== "left";
    });
    room.hostUserId = af || room.playerOrder[0];
  }
  io.to(socketRoomName(room.id)).emit("yacht:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0 || activeOrderedPlayers(room).length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing" && wasCurrent) {
    nextTurn(io, room);
  }
  broadcastRoomState(io, room);
}

// =========================
// 등록
// =========================
export function registerYachtMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("yacht:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (yachtUserRoom.has(me.id)) {
          const old = yachtRooms.get(yachtUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const turnTimeSec = ALLOWED_TURN_TIME.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 60;

        const roomId = `yc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, turnTimeSec,
          currentTurnId: null, turnDeadline: null,
          dice: [0,0,0,0,0], locked: [false,false,false,false,false], rollsLeft: 0,
          turnRound: 0,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, turnTimer: null,
        };
        yachtRooms.set(roomId, room);
        yachtInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        yachtUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[yacht:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("yacht:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = yachtInvites.get(code);
        const room = roomId ? yachtRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          yachtUserRoom.set(me.id, roomId);
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
        yachtUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[yacht:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("yacht:setMaxPlayers", (payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
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

    socket.on("yacht:setRoomOptions", (payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.turnTimeSec !== undefined) {
        const t = Number(payload.turnTimeSec);
        if (ALLOWED_TURN_TIME.includes(t)) room.turnTimeSec = t;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("yacht:startGame", (_payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") {
        clearTurnTimer(room); room.endedAt = null;
        // rematch: left 사람 제거
        const toRemove = [];
        for (const [uid, pp] of room.players.entries()) {
          if (pp.status === "left" || !pp.connected) toRemove.push(uid);
        }
        for (const uid of toRemove) {
          room.players.delete(uid);
          const idx = room.playerOrder.indexOf(uid);
          if (idx >= 0) room.playerOrder.splice(idx, 1);
          if (yachtUserRoom.get(uid) === room.id) yachtUserRoom.delete(uid);
        }
        if (!room.players.has(room.hostUserId)) {
          room.hostUserId = room.playerOrder[0];
        }
      }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      // 모든 player 리셋
      for (const p of room.players.values()) {
        p.scoreCard = {};
        p.yachtBonus = 0;
        p.status = "active";
      }

      room.status = "playing";
      room.startedAt = Date.now();
      room.turnRound = 1;
      const active = activeOrderedPlayers(room);
      room.currentTurnId = active[0] || room.playerOrder[0];

      io.to(socketRoomName(room.id)).emit("yacht:gameStart", {
        startedAt: room.startedAt,
        turnTimeSec: room.turnTimeSec,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);
      startTurn(io, room);
      cb?.({ ok: true });
    });

    // 주사위 굴리기
    socket.on("yacht:rollDice", (_payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.rollsLeft <= 0) return cb?.({ ok: false, error: "NO_ROLLS_LEFT" });

      // locked 아닌 다이스만 다시 굴림
      const newDice = room.dice.map((d, i) => room.locked[i] ? d : rollOne());
      room.dice = newDice;
      room.rollsLeft -= 1;

      io.to(socketRoomName(room.id)).emit("yacht:diceRolled", {
        playerId: me.id,
        dice: room.dice,
        locked: room.locked,
        rollsLeft: room.rollsLeft,
      });
      cb?.({ ok: true, dice: room.dice, rollsLeft: room.rollsLeft });
    });

    // 다이스 lock 토글
    socket.on("yacht:toggleLock", (payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      const idx = safeNumber(payload?.index, -1);
      if (idx < 0 || idx >= 5) return cb?.({ ok: false, error: "INVALID_INDEX" });
      if (room.rollsLeft >= 3) return cb?.({ ok: false, error: "ROLL_FIRST" });  // 첫 굴림 전엔 lock X
      if (room.dice[idx] === 0) return cb?.({ ok: false, error: "DICE_NOT_ROLLED" });
      room.locked[idx] = !room.locked[idx];
      io.to(socketRoomName(room.id)).emit("yacht:diceLocked", {
        playerId: me.id,
        index: idx,
        locked: room.locked[idx],
        lockedAll: room.locked,
      });
      cb?.({ ok: true });
    });

    // 점수 입력 (카테고리 선택)
    socket.on("yacht:fillScore", (payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.actionLocked) return cb?.({ ok: false, error: "WAITING_NEXT_TURN" });  // 중복 입력 방지
      const cat = String(payload?.category || "");
      if (!CATEGORIES.includes(cat)) return cb?.({ ok: false, error: "INVALID_CATEGORY" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NO_PLAYER" });
      if (cat in p.scoreCard) return cb?.({ ok: false, error: "ALREADY_FILLED" });
      if (room.rollsLeft >= 3) return cb?.({ ok: false, error: "ROLL_FIRST" });  // 한 번도 안 굴림

      // 락 즉시 → 다음 fillScore 호출 막음
      room.actionLocked = true;
      const score = calcScore(cat, room.dice);
      p.scoreCard[cat] = score;
      p.lastActionMs = Date.now();

      // 야추 보너스: 이미 야추 카테고리 50점 채운 상태에서 또 야추 → +100
      let yachtBonusGained = 0;
      const isYachtRoll = (() => {
        const c = [0,0,0,0,0,0,0];
        for (const d of room.dice) c[d]++;
        return c.some(v => v === 5);
      })();
      if (isYachtRoll && cat !== "yacht" && p.scoreCard.yacht === 50) {
        p.yachtBonus = (p.yachtBonus || 0) + 100;
        yachtBonusGained = 100;
      }

      io.to(socketRoomName(room.id)).emit("yacht:scoreFilled", {
        playerId: me.id,
        category: cat,
        score,
        yachtBonusGained,
        scoreCard: p.scoreCard,
        upperSum: calcUpperSum(p.scoreCard),
        total: calcTotal(p),
      });
      broadcastRoomState(io, room);

      cb?.({ ok: true, score, yachtBonusGained });

      // 다음 차례
      setTimeout(() => nextTurn(io, room), 400);
    });

    socket.on("yacht:leaveRoom", (_payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("yacht:kickPlayer", (payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("yacht:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("yacht:requestState", (_payload, cb) => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = yachtUserRoom.get(me.id);
      const room = roomId ? yachtRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("yacht:peerUpdate", { playerId: me.id, connected: false });
        broadcastRoomState(io, room);
        // 게임 중 + 현재 차례 사람이 끊김 → 차례 즉시 넘김 (멈춤 방지)
        if (room.currentTurnId === me.id && room.status === "playing") {
          nextTurn(io, room);
        }
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
