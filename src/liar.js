// =========================
// DUO 라이어 키워드 게임 (서버) — v0.1
// 기존 worldcup/quiz/tier/lifegame 멀티와 완전 격리
// - 별도 Map (liarRooms)
// - 별도 invite code Map
// - 'liar:*' 이벤트 prefix 전용
// - socket.io room name = `liar:${roomId}`
// =========================

import { CATEGORIES, LIAR_KEYWORDS, pickRandomPair } from "./liar-words.js";

const CATEGORY_IDS = Object.keys(LIAR_KEYWORDS);
function isValidCategory(cat) {
  return cat === "random" || !!LIAR_KEYWORDS[cat];
}
function resolveCategoryForRound(roomCategory) {
  if (roomCategory !== "random") return roomCategory;
  return CATEGORY_IDS[Math.floor(Math.random() * CATEGORY_IDS.length)];
}

const liarRooms = new Map();
const liarInvites = new Map();
const liarUserRoom = new Map();

const ALLOWED_TURN_SECS = [20, 30, 45];
const ALLOWED_VOTE_SECS = [30, 45, 60];
const ALLOWED_ROUNDS = [3, 5];
const ALLOWED_MAX_PLAYERS = [4, 6, 8];
const MIN_PLAYERS = 3;
const HINT_LEN_MAX = 80;
const MAX_HINT_ROUNDS = 3;       // 한 라운드에서 최대 힌트 바퀴 수
const DECISION_SEC = 30;         // 결정 단계(투표 vs 한 바퀴 더) 제한시간
const DECISION_TRANSITION_MS = 1500; // 결정 결과 노출 후 다음 단계 진입 딜레이
const RESULT_DELAY_MS = 8000;
const EMPTY_ROOM_TTL_MS = 30_000;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!liarInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function socketRoomName(roomId) { return `liar:${roomId}`; }
function clearTimer(room) {
  if (room?.roundData?.timer) {
    clearTimeout(room.roundData.timer);
    room.roundData.timer = null;
  }
  if (room?.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) {
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }
}

// ===== state shapes =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    socketId,
    score: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    score: p.score,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    totalRounds: room.totalRounds,
    turnSec: room.turnSec,
    voteSec: room.voteSec,
    category: room.category,                                // 호스트 설정값 (random 가능)
    effectiveCategory: room.roundData?.effectiveCategory || null,  // 진행 중 라운드의 실제 카테고리
    currentRoundIdx: room.currentRoundIdx,
    phase: room.roundData?.phase || (room.status === "lobby" ? "lobby" : null),
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    // 게임 진행 중일 때만 추가 정보
    turnUserId: room.roundData?.phase === "hint"
      ? room.playerOrder[room.roundData.turnIdx]
      : null,
    hintRoundIdx: room.roundData?.hintRoundIdx ?? null,
    maxHintRounds: MAX_HINT_ROUNDS,
    deadline: room.roundData?.deadline || null,
  };
}

// ===== game flow =====
function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("liar:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearTimer(room);
  clearEmptyRoomTimer(room);
  liarRooms.delete(room.id);
  liarInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (liarUserRoom.get(uid) === room.id) liarUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("liar:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[liar] room ${room.id} deleted: ${reason}`);
}

function startNextRound(io, room) {
  if (room.status !== "playing") return;
  if (room.currentRoundIdx >= room.totalRounds) return endGame(io, room);

  // 랜덤 카테고리면 매 라운드마다 다시 뽑기
  const effectiveCat = resolveCategoryForRound(room.category);
  const pair = pickRandomPair(effectiveCat);
  if (!pair) return endGame(io, room);
  const [citizenWord, liarWord] = pair;
  const liarUid = pickRandom(room.playerOrder);

  room.roundData = {
    phase: "hint",
    citizenWord, liarWord, liarUserId: liarUid,
    effectiveCategory: effectiveCat,
    hintRoundIdx: 0,
    hintsByRound: [new Map()],   // 바퀴마다 새 Map(uid → {text,timedOut})
    turnIdx: 0,
    decisionVotes: new Map(),    // uid → "vote" | "more"
    votes: new Map(),
    deadline: null,
    timer: null,
  };

  const catLabel = CATEGORIES.find(c => c.id === effectiveCat)?.label || effectiveCat;

  // 모두에게 라운드 시작 (역할/키워드 제외)
  io.to(socketRoomName(room.id)).emit("liar:roundStart", {
    roundIdx: room.currentRoundIdx,
    totalRounds: room.totalRounds,
    category: effectiveCat,                  // 실제 사용된 카테고리
    categoryLabel: catLabel,
    isRandomCategory: room.category === "random",
    playerOrder: room.playerOrder,
    maxHintRounds: MAX_HINT_ROUNDS,
  });

  // 각자에게 자기 역할/키워드 (private)
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;
    sock.emit("liar:yourRole", {
      role: uid === liarUid ? "liar" : "citizen",
      keyword: uid === liarUid ? liarWord : citizenWord,
      categoryLabel: catLabel,
    });
  }

  // 잠시 후 힌트 단계 시작 (역할 확인 시간)
  room.phaseTimer = setTimeout(() => startHintTurn(io, room), 3000);
}

function currentHintMap(room) {
  return room.roundData.hintsByRound[room.roundData.hintRoundIdx];
}

function buildHintsByRoundPayload(room) {
  return room.roundData.hintsByRound.map((m, idx) => ({
    hintRoundIdx: idx,
    hints: room.playerOrder.map(uid => {
      const h = m.get(uid);
      return {
        userId: uid,
        hint: h?.text || "(미입력)",
        timedOut: !!h?.timedOut,
      };
    }),
  }));
}

function startHintTurn(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  const hintsMap = currentHintMap(room);
  // 다음 미입력자/연결자 찾기
  while (room.roundData.turnIdx < room.playerOrder.length) {
    const uid = room.playerOrder[room.roundData.turnIdx];
    const p = room.players.get(uid);
    const alreadySubmitted = hintsMap.has(uid);
    if (p?.connected && !alreadySubmitted) break;
    room.roundData.turnIdx++;
  }
  if (room.roundData.turnIdx >= room.playerOrder.length) {
    return startDecisionPhase(io, room);
  }

  const turnUid = room.playerOrder[room.roundData.turnIdx];
  room.roundData.deadline = Date.now() + room.turnSec * 1000;

  io.to(socketRoomName(room.id)).emit("liar:hintTurn", {
    roundIdx: room.currentRoundIdx,
    hintRoundIdx: room.roundData.hintRoundIdx,
    maxHintRounds: MAX_HINT_ROUNDS,
    turnUserId: turnUid,
    turnSec: room.turnSec,
    deadline: room.roundData.deadline,
  });

  clearTimer(room);
  room.roundData.timer = setTimeout(() => {
    submitHint(io, room, turnUid, "(시간 초과)", true);
  }, room.turnSec * 1000);
}

function submitHint(io, room, userId, rawHint, timedOut) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "hint") return;
  const hintsMap = currentHintMap(room);
  if (hintsMap.has(userId)) return;
  const turnUid = room.playerOrder[room.roundData.turnIdx];
  if (turnUid !== userId) return;

  clearTimer(room);
  const text = String(rawHint || "").slice(0, HINT_LEN_MAX).trim() || "(빈 힌트)";

  hintsMap.set(userId, { text, timedOut: !!timedOut });
  io.to(socketRoomName(room.id)).emit("liar:hintSubmitted", {
    userId,
    hintRoundIdx: room.roundData.hintRoundIdx,
    timedOut: !!timedOut,
  });

  room.roundData.turnIdx++;
  startHintTurn(io, room);
}

function startDecisionPhase(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  clearTimer(room);
  room.roundData.phase = "decision";
  room.roundData.decisionVotes = new Map();
  room.roundData.deadline = Date.now() + DECISION_SEC * 1000;

  const canMore = (room.roundData.hintRoundIdx + 1) < MAX_HINT_ROUNDS;

  io.to(socketRoomName(room.id)).emit("liar:decisionPhase", {
    roundIdx: room.currentRoundIdx,
    hintRoundIdx: room.roundData.hintRoundIdx,
    maxHintRounds: MAX_HINT_ROUNDS,
    canMore,
    decisionSec: DECISION_SEC,
    deadline: room.roundData.deadline,
    hintsByRound: buildHintsByRoundPayload(room),
  });

  room.roundData.timer = setTimeout(() => tallyDecision(io, room, true), DECISION_SEC * 1000);
}

function submitDecision(io, room, voterId, choice) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "decision") return;
  if (!room.players.has(voterId)) return;
  if (room.roundData.decisionVotes.has(voterId)) return;

  let normalized = choice === "more" ? "more" : "vote";
  // 마지막 라운드에서는 "more" 차단 → 강제로 vote
  const canMore = (room.roundData.hintRoundIdx + 1) < MAX_HINT_ROUNDS;
  if (!canMore) normalized = "vote";

  room.roundData.decisionVotes.set(voterId, normalized);
  io.to(socketRoomName(room.id)).emit("liar:decisionVoteSubmitted", {
    voterId,
    choice: normalized,
  });

  // 연결된 사람 모두 결정하면 즉시 종료
  const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
  if (room.roundData.decisionVotes.size >= connectedUids.length) {
    clearTimer(room);
    tallyDecision(io, room, false);
  }
}

function tallyDecision(io, room, timedOut) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "decision") return; // 중복 호출 방어 (지연 vote + timeout race)
  clearTimer(room);
  // sentinel: 다음 phase로 넘어가기 전까지 submitDecision/tallyDecision 모두 차단
  room.roundData.phase = "decision_locked";

  const canMore = (room.roundData.hintRoundIdx + 1) < MAX_HINT_ROUNDS;
  let moreCount = 0, voteCount = 0;
  for (const c of room.roundData.decisionVotes.values()) {
    if (c === "more") moreCount++;
    else voteCount++;
  }
  // 다수결: more가 vote보다 strictly 많고 canMore일 때만 진행. 동률은 → 투표 (안전 default).
  const goMore = canMore && moreCount > voteCount;

  io.to(socketRoomName(room.id)).emit("liar:decisionResult", {
    decision: goMore ? "more" : "vote",
    moreCount,
    voteCount,
    timedOut: !!timedOut,
    nextHintRoundIdx: goMore ? room.roundData.hintRoundIdx + 1 : null,
  });

  if (goMore) {
    // 다음 힌트 바퀴 시작 — 약간 delay (UI가 결과 보여줄 시간)
    room.roundData.hintRoundIdx++;
    room.roundData.hintsByRound.push(new Map());
    room.roundData.turnIdx = 0;
    room.roundData.phase = "hint";
    room.phaseTimer = setTimeout(() => startHintTurn(io, room), DECISION_TRANSITION_MS);
  } else {
    // 투표 단계로
    room.phaseTimer = setTimeout(() => startVotePhase(io, room), DECISION_TRANSITION_MS);
  }
}

function startVotePhase(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  room.roundData.phase = "vote";
  room.roundData.deadline = Date.now() + room.voteSec * 1000;
  io.to(socketRoomName(room.id)).emit("liar:votePhase", {
    roundIdx: room.currentRoundIdx,
    voteSec: room.voteSec,
    deadline: room.roundData.deadline,
  });
  clearTimer(room);
  room.roundData.timer = setTimeout(() => finishVoting(io, room), room.voteSec * 1000);
}

function submitVote(io, room, voterId, targetId) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "vote") return;
  if (voterId === targetId) return;
  if (!room.players.has(voterId) || !room.players.has(targetId)) return;
  if (room.roundData.votes.has(voterId)) return; // 중복 투표 방지

  room.roundData.votes.set(voterId, targetId);
  io.to(socketRoomName(room.id)).emit("liar:voteSubmitted", { voterId });

  // 연결된 사람 모두 투표하면 즉시 종료
  const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
  if (room.roundData.votes.size >= connectedUids.length) {
    clearTimer(room);
    finishVoting(io, room);
  }
}

function finishVoting(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  clearTimer(room);

  const { votes, liarUserId, citizenWord, liarWord } = room.roundData;
  const tally = new Map();
  for (const target of votes.values()) {
    tally.set(target, (tally.get(target) || 0) + 1);
  }
  // 최다 득표자(들) 산출
  let maxVotes = 0;
  for (const c of tally.values()) if (c > maxVotes) maxVotes = c;
  const topUids = [];
  for (const [uid, c] of tally.entries()) if (c === maxVotes) topUids.push(uid);
  const isTie = topUids.length > 1;
  const topUid = isTie ? null : topUids[0];

  const liarCaught = !isTie && topUid === liarUserId && maxVotes > 0;

  // 점수 적용
  if (liarCaught) {
    for (const uid of room.playerOrder) {
      if (uid === liarUserId) continue;
      const p = room.players.get(uid);
      if (p) p.score += 1;
    }
  } else {
    const lp = room.players.get(liarUserId);
    if (lp) lp.score += 2;
  }

  // tally 직렬화
  const tallyArr = room.playerOrder.map(uid => ({
    userId: uid,
    voteCount: tally.get(uid) || 0,
    voters: Array.from(votes.entries())
      .filter(([_, t]) => t === uid)
      .map(([v, _]) => v),
  }));

  io.to(socketRoomName(room.id)).emit("liar:roundResult", {
    roundIdx: room.currentRoundIdx,
    liarUserId,
    citizenWord,
    liarWord,
    tally: tallyArr,
    topUid,
    isTie,
    liarCaught,
    scores: room.playerOrder.map(uid => ({
      userId: uid,
      score: room.players.get(uid)?.score || 0,
    })),
  });

  room.roundData.phase = "result";
  room.phaseTimer = setTimeout(() => {
    room.currentRoundIdx++;
    startNextRound(io, room);
  }, RESULT_DELAY_MS);
}

function endGame(io, room) {
  room.status = "ended";
  clearTimer(room);
  const ranking = room.playerOrder
    .map(uid => {
      const p = room.players.get(uid);
      return {
        userId: uid,
        name: p?.name || "익명",
        avatar_url: p?.avatar_url || null,
        score: p?.score || 0,
      };
    })
    .sort((a, b) => b.score - a.score);
  io.to(socketRoomName(room.id)).emit("liar:gameEnd", {
    ranking,
    totalRounds: room.totalRounds,
  });
  // 60초 후 정리
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, 60_000);
}

// ===== leave / disconnect =====
function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasTurn = room.roundData?.phase === "hint"
    && room.playerOrder[room.roundData.turnIdx] === userId;

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (liarUserRoom.get(userId) === room.id) liarUserRoom.delete(userId);

  if (room.playerOrder.length === 0) return deleteRoom(io, room, "EMPTY");

  if (wasHost) room.hostUserId = room.playerOrder[0];

  if (room.status === "playing") {
    // 진행 중 이탈 처리
    if (wasTurn) {
      // 현재 차례였으면 자동 패스 → 다음 사람
      if (room.roundData) {
        currentHintMap(room).set(userId, { text: "(이탈)", timedOut: true });
        room.roundData.turnIdx++;
        clearTimer(room);
        startHintTurn(io, room);
      }
    }
    // 모두 끊기면 정리
    const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
    if (!anyConnected) {
      clearEmptyRoomTimer(room);
      room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
    }
  }
  broadcastRoomState(io, room);
}

// ===== handlers =====
export function registerLiar(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("liar:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (liarUserRoom.has(me.id)) {
          const old = liarRooms.get(liarUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }

        const totalRounds = ALLOWED_ROUNDS.includes(Number(payload?.totalRounds))
          ? Number(payload.totalRounds) : 5;
        const turnSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnSec))
          ? Number(payload.turnSec) : 30;
        const voteSec = ALLOWED_VOTE_SECS.includes(Number(payload?.voteSec))
          ? Number(payload.voteSec) : 60;
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 6;
        const category = isValidCategory(payload?.category) ? payload.category : "random";

        const roomId = `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",
          maxPlayers,
          totalRounds,
          turnSec,
          voteSec,
          category,
          createdAt: Date.now(),
          players: new Map(),
          playerOrder: [],
          currentRoundIdx: 0,
          roundData: null,
          phaseTimer: null,
          emptyRoomTimer: null,
        };
        liarRooms.set(roomId, room);
        liarInvites.set(inviteCode, roomId);

        let avatar = null;
        let nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}

        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        liarUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[liar] created room ${roomId} by ${me.id} cat=${category} inv=${inviteCode}`);
      } catch (e) {
        console.error("[liar:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("liar:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = liarInvites.get(code);
        const room = roomId ? liarRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        if (room.players.has(me.id)) {
          // 재접속
          const p = room.players.get(me.id);
          p.connected = true;
          p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          liarUserRoom.set(me.id, roomId);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
          broadcastRoomState(io, room);
          return;
        }

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
        liarUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[liar:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("liar:setOptions", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.totalRounds != null && ALLOWED_ROUNDS.includes(Number(payload.totalRounds))) {
        room.totalRounds = Number(payload.totalRounds);
      }
      if (payload?.turnSec != null && ALLOWED_TURN_SECS.includes(Number(payload.turnSec))) {
        room.turnSec = Number(payload.turnSec);
      }
      if (payload?.voteSec != null && ALLOWED_VOTE_SECS.includes(Number(payload.voteSec))) {
        room.voteSec = Number(payload.voteSec);
      }
      if (payload?.category && isValidCategory(payload.category)) {
        room.category = payload.category;
      }
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    socket.on("liar:setMaxPlayers", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_IN_PROGRESS" });

      const requested = Number(payload?.maxPlayers);
      if (!ALLOWED_MAX_PLAYERS.includes(requested)) return cb?.({ ok: false, error: "INVALID_VALUE" });
      if (requested < room.players.size) {
        return cb?.({ ok: false, error: "BELOW_CURRENT_PLAYERS", current: room.players.size });
      }
      room.maxPlayers = requested;
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    socket.on("liar:startGame", (_payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      // rematch: ended 상태에서 새 게임 허용
      if (room.status === "ended") { room.endedAt = null; }
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", min: MIN_PLAYERS });

      // 점수 초기화 + 라운드 시작
      for (const p of room.players.values()) p.score = 0;
      room.status = "playing";
      room.currentRoundIdx = 0;
      cb?.({ ok: true });

      io.to(socketRoomName(room.id)).emit("liar:gameStart", {
        totalRounds: room.totalRounds,
        category: room.category,
      });
      startNextRound(io, room);
    });

    socket.on("liar:submitHint", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "hint") return cb?.({ ok: false, error: "NOT_HINT_PHASE" });
      const turnUid = room.playerOrder[room.roundData.turnIdx];
      if (turnUid !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });

      cb?.({ ok: true });
      submitHint(io, room, me.id, payload?.hint || "", false);
    });

    socket.on("liar:submitDecision", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "decision") return cb?.({ ok: false, error: "NOT_DECISION_PHASE" });
      if (room.roundData.decisionVotes.has(me.id)) return cb?.({ ok: false, error: "ALREADY_DECIDED" });
      const choice = payload?.choice === "more" ? "more" : "vote";

      cb?.({ ok: true });
      submitDecision(io, room, me.id, choice);
    });

    socket.on("liar:submitVote", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "vote") return cb?.({ ok: false, error: "NOT_VOTE_PHASE" });
      const target = String(payload?.targetUserId || "");
      if (target === me.id) return cb?.({ ok: false, error: "CANNOT_VOTE_SELF" });
      if (!room.players.has(target)) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (room.roundData.votes.has(me.id)) return cb?.({ ok: false, error: "ALREADY_VOTED" });

      cb?.({ ok: true });
      submitVote(io, room, me.id, target);
    });

    socket.on("liar:leaveRoom", (_payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.leave(socketRoomName(room.id));
      leavePlayer(io, room, me.id);
      cb?.({ ok: true });
    });

    socket.on("liar:kickPlayer", (payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("liar:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("liar:requestState", (_payload, cb) => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      // socketId 갱신 (탭 변경/새로고침)
      const p = room.players.get(me.id);
      if (p) { p.socketId = socket.id; p.connected = true; }
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = liarUserRoom.get(me.id);
      const room = roomId ? liarRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else if (room.status === "playing") {
        // 자기 차례였으면 자동 패스
        if (room.roundData?.phase === "hint"
            && room.playerOrder[room.roundData.turnIdx] === me.id
            && !currentHintMap(room).has(me.id)) {
          currentHintMap(room).set(me.id, { text: "(연결 끊김)", timedOut: true });
          room.roundData.turnIdx++;
          clearTimer(room);
          startHintTurn(io, room);
        }
        broadcastRoomState(io, room);
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        }
      }
    });
  });
}
