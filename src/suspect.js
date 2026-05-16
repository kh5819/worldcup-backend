// =========================
// 수상한 카드 (DUO) — 멀티플레이어 흑백 추리 카드 게임 서버
// 모드: ffa(개인전) / 1v1 / 2v2 / 2v2v2 / 2v2v2v2
// 카드: 0~17 × 흑/백 (총 36장) — 인원에 따라 dealing
// 룰 핵심:
//   - 시작 시 각자 손패 3장 (오름차순 자동 정렬, 같은 숫자=흑이 앞)
//   - 턴: 중앙 더미에서 1장 뽑음 → 자기 손패 자동 정렬 위치에 들어감
//   - 그 카드를 본인만 보고, 다른 사람 카드 1장 선택 + 숫자 추리
//   - 정답: 그 카드 공개, "한 번 더 추리" 또는 "턴 종료" 선택. 턴 종료 시 방금 뽑은 카드는 비공개로 손에 합류.
//   - 오답: 방금 뽑은 카드를 모두에게 공개. 턴 종료.
//   - 손패 전부 공개되면 탈락. 최후의 1인(팀) 승.
// =========================

const scRooms = new Map();
const scInvites = new Map();
const scUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_MODES = new Set(["ffa", "1v1", "2v2", "2v2v2", "2v2v2v2"]);
const ALLOWED_GUESS_TIME_SEC = [30, 60, 0];
const MIN_PLAYERS_TO_START = 2;
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;
const HAND_SIZE_INITIAL = 3;     // 시작 손패
const CARD_MAX_VALUE = 17;       // 0~17 (총 36장 흑+백)
const DRAW_AUTO_TIMEOUT_SEC = 10; // 카드 뽑기 단계 자동 진행 시간
const TEAM_SIZE_BY_MODE = { "ffa": 0, "1v1": 1, "2v2": 2, "2v2v2": 2, "2v2v2v2": 2 };
const TEAM_COUNT_BY_MODE = { "ffa": 0, "1v1": 2, "2v2": 2, "2v2v2": 3, "2v2v2v2": 4 };
const TEAM_LABELS = ["A", "B", "C", "D"];

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!scInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `suspect:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearGuessTimer(room) {
  if (room?.guessTimer) { clearTimeout(room.guessTimer); room.guessTimer = null; }
}
function clearDrawTimer(room) {
  if (room?.drawTimer) { clearTimeout(room.drawTimer); room.drawTimer = null; }
}
function clearAllTimers(room) {
  clearGuessTimer(room);
  clearDrawTimer(room);
}

// 카드 ID: 색-숫자 (예: "B-7", "W-12"). 정렬 키: 숫자*2 + (흑=0/백=1)
function makeFullDeck() {
  const deck = [];
  for (let n = 0; n <= CARD_MAX_VALUE; n++) {
    deck.push({ id: `B-${n}`, color: "B", value: n });
    deck.push({ id: `W-${n}`, color: "W", value: n });
  }
  return deck;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sortHand(hand) {
  return hand.slice().sort((a, b) => {
    if (a.value !== b.value) return a.value - b.value;
    return a.color === "B" ? -1 : 1; // 같은 숫자: 흑 먼저
  });
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
    team: null,        // 'A'|'B'|'C'|'D' (개인전이면 null)
    hand: [],          // [{id, color, value, revealed}]
    alive: true,
    drawnCardId: null, // 이번 턴에 뽑은 카드 (자기만 보고 있는 상태)
  };
}

function publicPlayer(userId, p, viewerUserId, isSameTeam) {
  // 상대 입장에서 보이는 카드 — revealed 카드만 숫자/색 공개, 나머지는 가려짐
  // 팀원은 자기 팀 카드 다 볼 수 있음
  const showAll = (userId === viewerUserId) || isSameTeam;
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    team: p.team,
    alive: p.alive,
    handCount: p.hand.length,
    hand: p.hand.map((c, idx) => ({
      idx,
      revealed: !!c.revealed,
      // 본인/팀원이면 전체 정보, 아니면 revealed 카드만 공개
      color: (showAll || c.revealed) ? c.color : null,
      value: (showAll || c.revealed) ? c.value : null,
    })),
  };
}

function publicRoom(room, viewerUserId) {
  const viewerTeam = room.players.get(viewerUserId)?.team || null;
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    mode: room.mode,
    guessTimeSec: room.guessTimeSec,
    deckRemaining: room.deck?.length || 0,
    currentTurnPlayerId: room.currentTurnPlayerId,
    turnPhase: room.turnPhase, // 'idle' | 'guess'
    players: room.playerOrder.map(uid => {
      const p = room.players.get(uid);
      const isSameTeam = !!(viewerTeam && p.team && p.team === viewerTeam);
      return publicPlayer(uid, p, viewerUserId, isSameTeam);
    }),
  };
}

function broadcastRoomState(io, room) {
  // 각 플레이어에게 본인 시점의 publicRoom 전송 (정보 비대칭 유지)
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.emit("suspect:roomState", publicRoom(room, uid));
  }
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearAllTimers(room);
  scRooms.delete(room.id);
  scInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (scUserRoom.get(uid) === room.id) scUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("suspect:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[suspect] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = scRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
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
  if (scUserRoom.get(userId) === room.id) scUserRoom.delete(userId);

  if (wasHost && room.playerOrder.length > 0) {
    room.hostUserId = room.playerOrder[0];
  }
  io.to(socketRoomName(room.id)).emit("suspect:peerLeave", { playerId: userId });

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  if (room.status === "playing") {
    // 진행 중 누가 나가면: 생존 1인(팀)만 남으면 종료, 아니면 턴 다음으로
    if (wasTurn) advanceTurn(io, room);
    checkWinCondition(io, room);
  }
  broadcastRoomState(io, room);
}

// ===== 게임 lifecycle =====
function assignTeams(room) {
  if (room.mode === "ffa") {
    for (const uid of room.playerOrder) {
      const p = room.players.get(uid);
      if (p) p.team = null;
    }
    // 개인전은 셔플 순서대로
    room.playerOrder = shuffle(room.playerOrder.slice());
    return;
  }
  const teamCount = TEAM_COUNT_BY_MODE[room.mode] || 0;
  const teamSize = TEAM_SIZE_BY_MODE[room.mode] || 0;
  // playerOrder shuffle 후 순서대로 팀 배정 (랜덤 팀 구성)
  const shuffled = shuffle(room.playerOrder.slice());
  for (let i = 0; i < shuffled.length; i++) {
    const uid = shuffled[i];
    const p = room.players.get(uid);
    if (!p) continue;
    if (i < teamCount * teamSize) {
      p.team = TEAM_LABELS[i % teamCount];
    } else {
      p.team = null;
    }
  }
  // 팀 번갈아 인터리브 — A1 → B1 → C1 → D1 → A2 → B2 → ...
  // 같은 팀이 연속으로 차례가 오지 않게.
  const byTeam = {};
  for (const uid of shuffled) {
    const t = room.players.get(uid)?.team || "Z";
    if (!byTeam[t]) byTeam[t] = [];
    byTeam[t].push(uid);
  }
  const teams = Object.keys(byTeam).filter(t => t !== "Z").sort();
  const maxSize = Math.max(...teams.map(t => byTeam[t].length));
  const interleaved = [];
  for (let i = 0; i < maxSize; i++) {
    for (const t of teams) {
      if (byTeam[t][i]) interleaved.push(byTeam[t][i]);
    }
  }
  room.playerOrder = interleaved;
}

function dealInitial(room) {
  room.deck = shuffle(makeFullDeck());
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p) continue;
    p.hand = [];
    for (let i = 0; i < HAND_SIZE_INITIAL; i++) {
      const c = room.deck.pop();
      if (c) p.hand.push({ ...c, revealed: false });
    }
    p.hand = sortHand(p.hand);
    p.alive = true;
    p.drawnCardId = null;
  }
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
  room.turnPhase = "draw";
  room.guessTargetPlayerId = null;
  room.guessTargetCardIdx = null;
  clearAllTimers(room);
  io.to(socketRoomName(room.id)).emit("suspect:turnStart", {
    playerId,
    nickname: room.players.get(playerId)?.name || "?",
    phase: "draw",
    drawTimeoutSec: DRAW_AUTO_TIMEOUT_SEC,
  });
  broadcastRoomState(io, room);
  // 카드 뽑기 자동 타이머 — 10초 안에 안 뽑으면 서버가 자동 뽑기
  room.drawTimer = setTimeout(() => {
    const r = scRooms.get(room.id);
    if (!r || r.status !== "playing" || r.currentTurnPlayerId !== playerId) return;
    if (r.turnPhase !== "draw") return;
    performDraw(io, r, playerId, true);
  }, DRAW_AUTO_TIMEOUT_SEC * 1000);
}

// 실제 뽑기 동작 (수동/자동 공용)
function performDraw(io, room, userId, isAuto) {
  clearDrawTimer(room);
  if (room.turnPhase !== "draw") return false;
  if (!room.deck.length) {
    // 더미 비었음 — 추리 phase로 바로 진입
    room.turnPhase = "guess";
    io.to(socketRoomName(room.id)).emit("suspect:drewCard", { playerId: userId, hasCard: false, auto: !!isAuto });
    broadcastRoomState(io, room);
    startGuessTimer(io, room, userId);
    return true;
  }
  const card = room.deck.pop();
  const p = room.players.get(userId);
  if (!p) return false;
  p.drawnCardId = card.id;
  p.hand.push({ ...card, revealed: false });
  p.hand = sortHand(p.hand);
  room.turnPhase = "guess";
  // 본인에게만 카드 정보
  const sock = io.sockets.sockets.get(p.socketId);
  if (sock) sock.emit("suspect:drewCard", { playerId: userId, hasCard: true, card, auto: !!isAuto });
  // 나머지에겐 hasCard만
  io.in(socketRoomName(room.id)).fetchSockets().then(sockets => {
    for (const s of sockets) {
      if (s.id !== p.socketId) {
        s.emit("suspect:drewCard", { playerId: userId, hasCard: true, auto: !!isAuto });
      }
    }
  }).catch(() => {});
  broadcastRoomState(io, room);
  startGuessTimer(io, room, userId);
  return true;
}

function startGuessTimer(io, room, userId) {
  if (room.guessTimeSec <= 0) return;
  clearGuessTimer(room);
  room.guessTimer = setTimeout(() => {
    const r = scRooms.get(room.id);
    if (!r || r.status !== "playing" || r.currentTurnPlayerId !== userId) return;
    const player = r.players.get(userId);
    if (player && player.drawnCardId) {
      const idx = player.hand.findIndex(c => c.id === player.drawnCardId);
      if (idx >= 0) player.hand[idx].revealed = true;
      player.drawnCardId = null;
    }
    io.to(socketRoomName(r.id)).emit("suspect:turnTimeout", { playerId: userId });
    checkPlayerDead(io, r, userId);
    if (!checkWinCondition(io, r)) advanceTurn(io, r);
  }, room.guessTimeSec * 1000);
}

function advanceTurn(io, room) {
  const next = nextAlivePlayerId(room, room.currentTurnPlayerId);
  if (!next) {
    finishGame(io, room, "NO_ALIVE");
    return;
  }
  startTurn(io, room, next);
}

function checkWinCondition(io, room) {
  if (room.status !== "playing") return false;
  const alive = [...room.players.values()].filter(p => p.alive);
  if (room.mode === "ffa") {
    if (alive.length <= 1) {
      finishGame(io, room, "LAST_STANDING");
      return true;
    }
  } else {
    // 팀전: 살아있는 팀이 1개만 남으면 승
    const aliveTeams = new Set(alive.map(p => p.team).filter(Boolean));
    if (aliveTeams.size <= 1) {
      finishGame(io, room, "LAST_TEAM");
      return true;
    }
  }
  return false;
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  clearAllTimers(room);

  // 순위: alive 우선, 그 다음 hand 가려진 카드 많은 순(=오래 버틴 정도)
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    if (!p) return null;
    const hiddenCount = p.hand.filter(c => !c.revealed).length;
    return {
      playerId: uid,
      nickname: p.name,
      team: p.team,
      alive: p.alive,
      hiddenCards: hiddenCount,
    };
  }).filter(Boolean).sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.hiddenCards - a.hiddenCards;
  });

  io.to(socketRoomName(room.id)).emit("suspect:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[suspect] room ${room.id} game ended: ${reason}`);
}

// ===== 등록 =====
export function registerSuspect(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("suspect:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (scUserRoom.has(me.id)) {
          const old = scRooms.get(scUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const mode = ALLOWED_MODES.has(payload?.mode) ? payload.mode : "ffa";
        const guessTimeSec = ALLOWED_GUESS_TIME_SEC.includes(Number(payload?.guessTimeSec))
          ? Number(payload.guessTimeSec) : 60;

        const roomId = `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby",
          maxPlayers, mode, guessTimeSec,
          deck: [],
          currentTurnPlayerId: null,
          turnPhase: "idle",
          guessTargetPlayerId: null,
          guessTargetCardIdx: null,
          players: new Map(),
          playerOrder: [],
          emptyRoomTimer: null,
          guessTimer: null,
          createdAt: Date.now(),
        };
        scRooms.set(roomId, room);
        scInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        scUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room, me.id) });
        broadcastRoomState(io, room);
        console.log(`[suspect] created ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[suspect:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("suspect:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = scInvites.get(code);
        const room = roomId ? scRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          scUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room, me.id), rejoined: true });
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
        scUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room, me.id) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[suspect:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 옵션 -----
    socket.on("suspect:setOptions", (payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
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
      if (payload?.guessTimeSec !== undefined) {
        const n = Number(payload.guessTimeSec);
        if (!ALLOWED_GUESS_TIME_SEC.includes(n)) return cb?.({ ok: false, error: "INVALID_TIME" });
        room.guessTimeSec = n;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("suspect:startGame", (_payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      // rematch: ended 상태에서 새 게임 허용
      if (room.status === "ended") { room.endedAt = null; }
      if (room.players.size < MIN_PLAYERS_TO_START) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      // 모드별 인원 검증
      const required = {
        "1v1": 2, "2v2": 4, "2v2v2": 6, "2v2v2v2": 8,
      };
      if (required[room.mode] && room.players.size !== required[room.mode]) {
        return cb?.({ ok: false, error: "MODE_PLAYER_COUNT_MISMATCH" });
      }

      assignTeams(room);
      dealInitial(room);
      room.status = "playing";

      cb?.({ ok: true });
      broadcastRoomState(io, room);
      // 시작 시 playerOrder 첫 사람이 첫 턴
      startTurn(io, room, room.playerOrder[0]);
    });

    // ----- 카드 뽑기 (수동) -----
    socket.on("suspect:drawCard", (_payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnPlayerId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.turnPhase !== "draw") return cb?.({ ok: false, error: "ALREADY_DRAWN" });
      const ok = performDraw(io, room, me.id, false);
      cb?.({ ok });
    });

    // ----- 추리 -----
    // payload: { targetPlayerId, targetIdx, guessValue }
    socket.on("suspect:guess", (payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnPlayerId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.turnPhase !== "guess") return cb?.({ ok: false, error: "NOT_GUESS_PHASE" });

      const targetId = String(payload?.targetPlayerId || "");
      const targetIdx = Number(payload?.targetIdx);
      const guess = Number(payload?.guessValue);

      const target = room.players.get(targetId);
      if (!target || !target.alive) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (targetId === me.id) return cb?.({ ok: false, error: "CANNOT_GUESS_SELF" });
      // 같은 팀 카드는 추리 X (팀전)
      const me_p = room.players.get(me.id);
      if (me_p.team && target.team && me_p.team === target.team) {
        return cb?.({ ok: false, error: "SAME_TEAM" });
      }
      const card = target.hand[targetIdx];
      if (!card) return cb?.({ ok: false, error: "INVALID_CARD" });
      if (card.revealed) return cb?.({ ok: false, error: "ALREADY_REVEALED" });
      if (!Number.isInteger(guess) || guess < 0 || guess > CARD_MAX_VALUE) {
        return cb?.({ ok: false, error: "INVALID_GUESS" });
      }

      clearGuessTimer(room);
      const correct = (card.value === guess);
      if (correct) {
        card.revealed = true;
        io.to(socketRoomName(room.id)).emit("suspect:guessResult", {
          ok: true,
          fromPlayerId: me.id,
          fromNickname: room.players.get(me.id)?.name || "?",
          targetPlayerId: targetId,
          targetNickname: target.name,
          targetIdx,
          guessValue: guess,
          revealedCard: { color: card.color, value: card.value },
        });
        checkPlayerDead(io, room, targetId);
        if (checkWinCondition(io, room)) return cb?.({ ok: true, correct: true });
        // 정답 → 한 번 더 추리 또는 턴 종료 선택지로 진입
        room.turnPhase = "continue";
        broadcastRoomState(io, room);
        cb?.({ ok: true, correct: true });
      } else {
        // 오답 — 방금 뽑은 카드 공개 + 턴 종료
        const me_p = room.players.get(me.id);
        if (me_p.drawnCardId) {
          const idx = me_p.hand.findIndex(c => c.id === me_p.drawnCardId);
          if (idx >= 0) me_p.hand[idx].revealed = true;
        }
        const drawnIdx = me_p.hand.findIndex(c => c.id === me_p.drawnCardId);
        const drawnCard = me_p.hand[drawnIdx];
        me_p.drawnCardId = null;
        io.to(socketRoomName(room.id)).emit("suspect:guessResult", {
          ok: true,
          fromPlayerId: me.id,
          fromNickname: room.players.get(me.id)?.name || "?",
          targetPlayerId: targetId,
          targetNickname: target.name,
          targetIdx,
          guessValue: guess,
          wrong: true,
          revealedOwnCard: drawnCard ? { color: drawnCard.color, value: drawnCard.value, idx: drawnIdx } : null,
        });
        checkPlayerDead(io, room, me.id);
        if (!checkWinCondition(io, room)) advanceTurn(io, room);
        cb?.({ ok: true, correct: false });
      }
    });

    // ----- 추리 계속 (정답 후 선택) -----
    socket.on("suspect:continueTurn", (payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentTurnPlayerId !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.turnPhase !== "continue") return cb?.({ ok: false, error: "NOT_CONTINUE_PHASE" });

      const continueChoice = !!payload?.continueGuess;
      if (continueChoice) {
        room.turnPhase = "guess";
        io.to(socketRoomName(room.id)).emit("suspect:continueChoice", { playerId: me.id, continue: true });
        broadcastRoomState(io, room);
        // 시간 타이머 재시작
        if (room.guessTimeSec > 0) {
          clearGuessTimer(room);
          room.guessTimer = setTimeout(() => {
            const r = scRooms.get(room.id);
            if (!r || r.status !== "playing" || r.currentTurnPlayerId !== me.id) return;
            io.to(socketRoomName(r.id)).emit("suspect:turnTimeout", { playerId: me.id });
            advanceTurn(io, r);
          }, room.guessTimeSec * 1000);
        }
        cb?.({ ok: true });
      } else {
        // 턴 종료 — 뽑은 카드 그대로 비공개 손에 합류
        const p = room.players.get(me.id);
        if (p) p.drawnCardId = null;
        io.to(socketRoomName(room.id)).emit("suspect:continueChoice", { playerId: me.id, continue: false });
        advanceTurn(io, room);
        cb?.({ ok: true });
      }
    });

    // ----- 자발 퇴장 -----
    socket.on("suspect:leaveRoom", (_payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("suspect:kickPlayer", (payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("suspect:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 재접속 상태 -----
    socket.on("suspect:requestState", (_payload, cb) => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room, me.id) });
    });

    // ----- disconnect -----
    socket.on("disconnect", () => {
      const roomId = scUserRoom.get(me.id);
      const room = roomId ? scRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("suspect:peerDisconnect", { playerId: me.id });
        maybeScheduleEmptyRoomDelete(io, room);
      }
    });
  });
}

// 손패 전부 공개되면 탈락
function checkPlayerDead(io, room, userId) {
  const p = room.players.get(userId);
  if (!p || !p.alive) return;
  const allRevealed = p.hand.every(c => c.revealed);
  if (allRevealed && p.hand.length > 0) {
    p.alive = false;
    io.to(socketRoomName(room.id)).emit("suspect:playerEliminated", {
      playerId: userId,
      nickname: p.name,
    });
  }
}
