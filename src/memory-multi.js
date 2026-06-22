// =========================
// 메모리 카드 (DUO Memory) — 멀티 턴제 두뇌 대결 서버
// 핵심: 한 보드 공유 + 차례 돌아가며 카드 뒤집기 (race condition 0)
//       서버 권위: 카드 셔플 / 차례 관리 / 매칭 판정 / 타임아웃
//       매칭 성공 = 한 번 더 + 콤보 ↑, 실패 = 다음 차례
// 이벤트 prefix: 'memory:*', socket room name: `memory:${roomId}`
// =========================

const memoryRooms = new Map();
const memoryInvites = new Map();
const memoryUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_DIFFICULTIES = [4, 6, 8];
const ALLOWED_THEMES = ["animal", "food", "face", "nature"];
const ALLOWED_TURN_TIME = [10, 30, 60, 0]; // 0 = 무제한
const EMPTY_ROOM_TTL_MS = 30_000;
const WRONG_REVEAL_MS = 1200; // 매칭 실패 카드 보여주는 시간
const MAX_NICK_LEN = 14;

// ===== Theme Emoji Pools (백엔드 동일 — 카드 셔플용) =====
const THEMES = {
  animal: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪲','🐢','🐍','🦎','🦂','🦀','🦞','🦐','🦑','🐙','🐠','🐟','🐡','🐬','🦈','🐳','🐋','🦓','🦒','🦏','🦛','🐪','🐫','🦘','🦬','🐘','🐂','🦃','🦚','🦜','🦢','🦤','🪶','🦩','🐓','🦌','🐕','🐩','🐈'],
  food: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡'],
  face: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'],
  nature: ['🌸','💮','🏵️','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🪴','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂','🍃','🌍','🌎','🌏','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌚','🌛','🌜','☀️','🌝','🌞','⭐','🌟','🌠','☁️','⛅','⛈️','🌤️','🌥️','🌦️','🌧️','🌨️','🌩️','🌪️','🌫️','🌬️','🌈','☂️','☔','⛱️','⚡','❄️','☃️','⛄','🔥','💧','🌊','🪐','🌋','⛰️','🏔️','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🌌'],
};

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!memoryInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `memory:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearTurnTimer(room) {
  if (room?.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearWrongRevealTimer(room) {
  if (room?.wrongRevealTimer) { clearTimeout(room.wrongRevealTimer); room.wrongRevealTimer = null; }
}
function safeNumber(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function buildShuffledCards(difficulty, theme) {
  const pool = THEMES[theme] || THEMES.animal;
  const pairs = (difficulty * difficulty) / 2;
  const poolCopy = [...pool];
  // 셔플
  for (let i = poolCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
  }
  const chosen = poolCopy.slice(0, pairs);
  const list = [];
  chosen.forEach((emoji, idx) => {
    list.push({ pairId: idx, value: emoji });
    list.push({ pairId: idx, value: emoji });
  });
  // 카드 리스트 셔플
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.map((c, i) => ({
    id: i,
    pairId: c.pairId,
    value: c.value,
    flipped: false,
    matched: false,
    matchedBy: null,
  }));
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
    matches: 0,
    attempts: 0,
    combo: 1,
    maxCombo: 1,
    status: "active",  // active | left
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
    score: p.score,
    matches: p.matches,
    attempts: p.attempts,
    combo: p.combo,
    maxCombo: p.maxCombo,
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
    difficulty: room.difficulty,
    theme: room.theme,
    turnTimeSec: room.turnTimeSec,
    currentTurnId: room.currentTurnId,
    turnDeadline: room.turnDeadline,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("memory:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearTurnTimer(room);
  clearWrongRevealTimer(room);
  memoryRooms.delete(room.id);
  memoryInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (memoryUserRoom.get(uid) === room.id) memoryUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("memory:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[memory] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = memoryRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function getActivePlayers(room) {
  return room.playerOrder.filter(uid => {
    const p = room.players.get(uid);
    return p && p.status === "active";
  });
}

function nextTurn(io, room) {
  if (room.status !== "playing") return;
  const active = getActivePlayers(room);
  if (active.length === 0) return finishGame(io, room, "ALL_LEFT");

  // 현재 차례 다음 active player
  const curIdx = active.indexOf(room.currentTurnId);
  const nextIdx = curIdx >= 0 ? (curIdx + 1) % active.length : 0;
  room.currentTurnId = active[nextIdx];
  // 새 차례 사람 콤보 리셋 (차례가 진짜 바뀐 시점에만)
  const p = room.players.get(room.currentTurnId);
  if (p) p.combo = 1;
  startTurn(io, room);
}

function startTurn(io, room) {
  clearTurnTimer(room);
  clearWrongRevealTimer(room);
  room.firstFlipped = null;
  room.secondFlipped = null;
  room.actionLocked = false;
  // 콤보 리셋은 nextTurn에서만 (매칭 성공 후 같은 사람 한 번 더 시 콤보 누적 유지)

  if (room.turnTimeSec > 0) {
    room.turnDeadline = Date.now() + room.turnTimeSec * 1000;
    room.turnTimer = setTimeout(() => {
      const r = memoryRooms.get(room.id);
      if (!r || r.status !== "playing") return;
      // 타임아웃: 뒤집은 카드 있으면 다시 뒤집기 + 다음 차례
      const cardsToUnflip = [];
      if (r.firstFlipped != null) {
        const c = r.cards[r.firstFlipped];
        if (c && !c.matched) { c.flipped = false; cardsToUnflip.push(c.id); }
      }
      if (r.secondFlipped != null) {
        const c = r.cards[r.secondFlipped];
        if (c && !c.matched) { c.flipped = false; cardsToUnflip.push(c.id); }
      }
      if (cardsToUnflip.length > 0) {
        io.to(socketRoomName(r.id)).emit("memory:cardsUnflipped", { cardIds: cardsToUnflip });
      }
      io.to(socketRoomName(r.id)).emit("memory:turnTimeout", { playerId: r.currentTurnId });
      nextTurn(io, r);
    }, room.turnTimeSec * 1000 + 200); // 200ms buffer
  } else {
    room.turnDeadline = null;
  }

  io.to(socketRoomName(room.id)).emit("memory:turnStart", {
    currentTurnId: room.currentTurnId,
    deadline: room.turnDeadline,
  });
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  clearTurnTimer(room);
  clearWrongRevealTimer(room);

  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, ...publicPlayer(uid, p) } : null;
  }).filter(Boolean);
  ranking.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((b.matches || 0) !== (a.matches || 0)) return (b.matches || 0) - (a.matches || 0);
    return (a.attempts || 0) - (b.attempts || 0);
  });

  io.to(socketRoomName(room.id)).emit("memory:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[memory] room ${room.id} game ended: ${reason}`);
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
  }
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0 && room.status !== "playing") room.playerOrder.splice(idx, 1);
  if (memoryUserRoom.get(userId) === room.id) memoryUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) {
    // 다음 active player를 새 호스트로
    const active = getActivePlayers(room);
    room.hostUserId = active[0] || room.playerOrder[0];
  }
  io.to(socketRoomName(room.id)).emit("memory:peerLeave", { playerId: userId });

  if (room.playerOrder.length === 0 || getActivePlayers(room).length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }

  // 게임 중 + 떠난 사람이 현재 차례 → 다음 차례
  if (room.status === "playing" && wasCurrent) {
    nextTurn(io, room);
  }

  broadcastRoomState(io, room);
}

// =========================
// 등록
// =========================
export function registerMemoryMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("memory:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (memoryUserRoom.has(me.id)) {
          const old = memoryRooms.get(memoryUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;
        const difficulty = ALLOWED_DIFFICULTIES.includes(Number(payload?.difficulty))
          ? Number(payload.difficulty) : 6;
        const theme = ALLOWED_THEMES.includes(payload?.theme) ? payload.theme : "animal";
        const turnTimeSec = ALLOWED_TURN_TIME.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 30;

        const roomId = `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers, difficulty, theme, turnTimeSec,
          cards: [], currentTurnId: null, turnDeadline: null,
          firstFlipped: null, secondFlipped: null, actionLocked: false,
          totalPairs: 0, matchedPairs: 0,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null, turnTimer: null, wrongRevealTimer: null,
        };
        memoryRooms.set(roomId, room);
        memoryInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        memoryUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[memory] created room ${roomId} by ${me.id}`);
      } catch (e) {
        console.error("[memory:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("memory:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = memoryInvites.get(code);
        const room = roomId ? memoryRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          memoryUserRoom.set(me.id, roomId);
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
        memoryUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[memory:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("memory:setMaxPlayers", (payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
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

    socket.on("memory:setRoomOptions", (payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.difficulty !== undefined) {
        const d = Number(payload.difficulty);
        if (ALLOWED_DIFFICULTIES.includes(d)) room.difficulty = d;
      }
      if (payload?.theme !== undefined && ALLOWED_THEMES.includes(payload.theme)) {
        room.theme = payload.theme;
      }
      if (payload?.turnTimeSec !== undefined) {
        const t = Number(payload.turnTimeSec);
        if (ALLOWED_TURN_TIME.includes(t)) room.turnTimeSec = t;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("memory:startGame", (_payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") {
        clearTurnTimer(room); clearWrongRevealTimer(room); room.endedAt = null;
        // rematch: status를 다시 lobby로 잠시 만들지 않고 바로 playing 진입
      }
      if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      // 카드 셔플
      room.cards = buildShuffledCards(room.difficulty, room.theme);
      room.totalPairs = (room.difficulty * room.difficulty) / 2;
      room.matchedPairs = 0;
      room.firstFlipped = null;
      room.secondFlipped = null;
      room.actionLocked = false;

      // 모든 플레이어 상태 리셋
      for (const p of room.players.values()) {
        p.score = 0; p.matches = 0; p.attempts = 0;
        p.combo = 1; p.maxCombo = 1;
        p.status = "active";
      }

      room.status = "playing";
      room.startedAt = Date.now();

      // 첫 차례 = 호스트
      const active = getActivePlayers(room);
      room.currentTurnId = active[0] || room.playerOrder[0];

      io.to(socketRoomName(room.id)).emit("memory:gameStart", {
        startedAt: room.startedAt,
        difficulty: room.difficulty,
        theme: room.theme,
        turnTimeSec: room.turnTimeSec,
        cards: room.cards.map(c => ({ id: c.id, pairId: c.pairId, value: c.value })),
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
      });
      broadcastRoomState(io, room);

      // 첫 차례 시작
      startTurn(io, room);

      cb?.({ ok: true });
    });

    // 카드 뒤집기
    socket.on("memory:flipCard", (payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.actionLocked) return cb?.({ ok: false, error: "LOCKED" });

      const cardId = safeNumber(payload?.cardId, -1);
      if (cardId < 0 || cardId >= room.cards.length) return cb?.({ ok: false, error: "INVALID_CARD" });
      const card = room.cards[cardId];
      if (card.flipped || card.matched) return cb?.({ ok: false, error: "ALREADY_FLIPPED" });
      if (room.firstFlipped === cardId) return cb?.({ ok: false, error: "SAME_CARD" });

      // 두 번째 카드 동안 추가 클릭 막기
      if (room.firstFlipped != null && room.secondFlipped != null) {
        return cb?.({ ok: false, error: "WAITING" });
      }

      card.flipped = true;
      const p = room.players.get(me.id);

      io.to(socketRoomName(room.id)).emit("memory:cardFlipped", {
        cardId: card.id,
        playerId: me.id,
      });

      if (room.firstFlipped == null) {
        // 첫 번째
        room.firstFlipped = cardId;
        cb?.({ ok: true });
        return;
      }

      // 두 번째
      room.secondFlipped = cardId;
      room.actionLocked = true;
      p.attempts += 1;

      const first = room.cards[room.firstFlipped];
      const second = card;

      if (first.pairId === second.pairId) {
        // 매칭 성공!
        first.matched = true; second.matched = true;
        first.matchedBy = me.id; second.matchedBy = me.id;
        room.matchedPairs += 1;

        // 콤보 ↑ + 점수
        p.combo = Math.min(50, p.combo + 1);
        if (p.combo > p.maxCombo) p.maxCombo = p.combo;
        const gained = 10 + (p.combo - 1) * 5;
        p.score += gained;
        p.matches += 1;

        io.to(socketRoomName(room.id)).emit("memory:cardsMatched", {
          cardIds: [first.id, second.id],
          playerId: me.id,
          gained,
          combo: p.combo,
          score: p.score,
        });
        broadcastRoomState(io, room);

        // 모든 카드 매칭 → 끝
        if (room.matchedPairs >= room.totalPairs) {
          setTimeout(() => finishGame(io, room, "COMPLETE"), 600);
          cb?.({ ok: true, matched: true });
          return;
        }

        // 한 번 더 → 자기 차례 유지, 다음 클릭 대기
        room.firstFlipped = null;
        room.secondFlipped = null;
        room.actionLocked = false;
        // turn 타이머 재시작
        startTurn(io, room);
        cb?.({ ok: true, matched: true });
      } else {
        // 매칭 실패
        p.combo = 1;
        broadcastRoomState(io, room);

        // 일정 시간 동안 카드 보여줬다가 → 다시 뒤집기 + 다음 차례
        room.wrongRevealTimer = setTimeout(() => {
          const r = memoryRooms.get(room.id);
          if (!r || r.status !== "playing") return;
          // unflip
          const ids = [];
          if (r.firstFlipped != null) {
            const c = r.cards[r.firstFlipped];
            if (c && !c.matched) { c.flipped = false; ids.push(c.id); }
          }
          if (r.secondFlipped != null) {
            const c = r.cards[r.secondFlipped];
            if (c && !c.matched) { c.flipped = false; ids.push(c.id); }
          }
          if (ids.length > 0) {
            io.to(socketRoomName(r.id)).emit("memory:cardsUnflipped", { cardIds: ids });
          }
          nextTurn(io, r);
        }, WRONG_REVEAL_MS);

        cb?.({ ok: true, matched: false });
      }
    });

    socket.on("memory:leaveRoom", (_payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("memory:kickPlayer", (payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("memory:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("memory:requestState", (_payload, cb) => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      // 재접속 시 현재 카드 상태도 같이
      cb?.({
        ok: true,
        room: publicRoom(room),
        cards: room.cards.map(c => ({ id: c.id, pairId: c.pairId, value: c.value, flipped: c.flipped, matched: c.matched })),
      });
    });

    socket.on("disconnect", () => {
      const roomId = memoryUserRoom.get(me.id);
      const room = roomId ? memoryRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("memory:peerUpdate", { playerId: me.id, connected: false });
        // 무제한 시간 + 차례인 사람 끊김 → 15초 후 차례 강제 넘김 (게임 멈춤 방지)
        if (room.currentTurnId === me.id && room.turnTimeSec === 0) {
          setTimeout(() => {
            const r = memoryRooms.get(room.id);
            if (!r || r.status !== "playing") return;
            const stillDisc = !r.players.get(me.id)?.connected && r.currentTurnId === me.id;
            if (stillDisc) {
              // 뒤집어진 카드 unflip
              const ids = [];
              if (r.firstFlipped != null) {
                const c = r.cards[r.firstFlipped];
                if (c && !c.matched) { c.flipped = false; ids.push(c.id); }
              }
              if (r.secondFlipped != null) {
                const c = r.cards[r.secondFlipped];
                if (c && !c.matched) { c.flipped = false; ids.push(c.id); }
              }
              if (ids.length > 0) {
                io.to(socketRoomName(r.id)).emit("memory:cardsUnflipped", { cardIds: ids });
              }
              io.to(socketRoomName(r.id)).emit("memory:turnTimeout", { playerId: me.id });
              nextTurn(io, r);
            }
          }, 15000);
        }
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}
