// =========================
// 우리방 OX (서버) — v0.1
// 동시 OX + 친구 답 예측 모드
// 'ox:*' 이벤트 prefix, 별도 Map (oxRooms)
// =========================

import { OX_CATEGORIES, OX_QUESTIONS, pickRandomQuestion } from "./oxgame-questions.js";

const oxRooms = new Map();
const oxInvites = new Map();
const oxUserRoom = new Map();

const ALLOWED_INPUT_SECS = [30, 45, 60, 90, 120];
const ALLOWED_ROUNDS = [3, 5, 7];
const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const MIN_PLAYERS = 2;
const RESULT_DELAY_MS = 6500;
const ROUND_INTRO_MS = 1500;
const EMPTY_ROOM_TTL_MS = 30_000;

const CATEGORY_IDS = Object.keys(OX_QUESTIONS);
function isValidCategory(c) { return c === "random" || !!OX_QUESTIONS[c]; }
function resolveCategory(roomCat) {
  if (roomCat !== "random") return roomCat;
  return CATEGORY_IDS[Math.floor(Math.random() * CATEGORY_IDS.length)];
}

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!oxInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function socketRoomName(roomId) { return `ox:${roomId}`; }
function clearRoundTimer(room) {
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

// ===== state =====
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
    inputSec: room.inputSec,
    category: room.category,
    effectiveCategory: room.roundData?.effectiveCategory || null,
    currentRoundIdx: room.currentRoundIdx,
    phase: room.roundData?.phase || (room.status === "lobby" ? "lobby" : null),
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    deadline: room.roundData?.deadline || null,
    finishedUserIds: room.roundData
      ? Array.from(room.roundData.finished)
      : [],
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("ox:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearRoundTimer(room);
  clearEmptyRoomTimer(room);
  oxRooms.delete(room.id);
  oxInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (oxUserRoom.get(uid) === room.id) oxUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("ox:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[ox] room ${room.id} deleted: ${reason}`);
}

// ===== game flow =====
function startNextRound(io, room) {
  if (room.status !== "playing") return;
  if (room.currentRoundIdx >= room.totalRounds) return endGame(io, room);

  const effectiveCat = resolveCategory(room.category);
  const picked = pickRandomQuestion(effectiveCat, room.seenQuestionIds);
  if (!picked) return endGame(io, room);
  room.seenQuestionIds.add(picked.id);

  room.roundData = {
    phase: "input",
    effectiveCategory: effectiveCat,
    questionId: picked.id,
    question: picked.question,
    answers: new Map(),       // userId -> "O"|"X"
    predictions: new Map(),   // predictorId -> Map(targetId -> "O"|"X")
    finished: new Set(),      // userIds 완료 누른 사람
    deadline: Date.now() + room.inputSec * 1000,
    timer: null,
  };

  const catLabel = OX_CATEGORIES.find(c => c.id === effectiveCat)?.label || effectiveCat;

  io.to(socketRoomName(room.id)).emit("ox:roundStart", {
    roundIdx: room.currentRoundIdx,
    totalRounds: room.totalRounds,
    category: effectiveCat,
    categoryLabel: catLabel,
    isRandomCategory: room.category === "random",
    question: picked.question,
    inputSec: room.inputSec,
    deadline: room.roundData.deadline,
    playerOrder: room.playerOrder,
  });

  clearRoundTimer(room);
  room.roundData.timer = setTimeout(() => {
    finishRound(io, room, /*timedOut*/ true);
  }, room.inputSec * 1000);

  broadcastRoomState(io, room);
}

function submitAnswer(io, room, userId, payload) {
  if (room.status !== "playing" || !room.roundData) return false;
  if (room.roundData.phase !== "input") return false;
  if (!room.players.has(userId)) return false;
  if (room.roundData.finished.has(userId)) return false; // 중복 제출 방지

  const myAnswer = payload?.myAnswer === "O" || payload?.myAnswer === "X" ? payload.myAnswer : null;
  if (!myAnswer) return false;
  room.roundData.answers.set(userId, myAnswer);

  // 예측 처리: 자신 제외, 알려진 userId만
  const predMap = new Map();
  if (payload?.predictions && typeof payload.predictions === "object") {
    for (const [targetId, val] of Object.entries(payload.predictions)) {
      if (targetId === userId) continue;
      if (!room.players.has(targetId)) continue;
      if (val !== "O" && val !== "X") continue;
      predMap.set(targetId, val);
    }
  }
  room.roundData.predictions.set(userId, predMap);
  room.roundData.finished.add(userId);

  io.to(socketRoomName(room.id)).emit("ox:answerSubmitted", { userId });

  // 모두 완료(연결된 사람 기준)
  const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
  if (room.roundData.finished.size >= connectedUids.length) {
    clearRoundTimer(room);
    finishRound(io, room, false);
  }
  return true;
}

function finishRound(io, room, timedOut) {
  if (room.status !== "playing" || !room.roundData) return;
  clearRoundTimer(room);
  room.roundData.phase = "result";

  const { answers, predictions } = room.roundData;

  // 시간 만료 시 미답자 처리: 답 없음(=무답)으로 두고 점수 계산에서 제외
  // 점수 계산:
  //  - predictor가 target을 맞추면 +1
  //  - target에 대한 모든 (예측한) 사람이 빗나가면 target에 +2 (숨기기 GOAT)
  //  - 다만 target이 답을 안 했으면 보너스 없음
  const gain = new Map(); // userId -> +score this round
  for (const uid of room.playerOrder) gain.set(uid, 0);

  // 예측 채점
  const predictionDetails = [];
  for (const [predictorId, predMap] of predictions.entries()) {
    for (const [targetId, predValue] of predMap.entries()) {
      const actual = answers.get(targetId);
      if (!actual) continue;
      const correct = predValue === actual;
      if (correct) gain.set(predictorId, (gain.get(predictorId) || 0) + 1);
      predictionDetails.push({ predictorId, targetId, predValue, correct });
    }
  }

  // 의외 보너스 / 만장일치 분석
  const surprise = [];
  const unanimous = [];
  for (const targetId of room.playerOrder) {
    const actual = answers.get(targetId);
    if (!actual) continue;
    // 이 target에 대한 예측 모두 모음
    const predsForThis = [];
    for (const [predictorId, predMap] of predictions.entries()) {
      if (predictorId === targetId) continue;
      const pv = predMap.get(targetId);
      if (pv) predsForThis.push({ predictorId, predValue: pv });
    }
    if (predsForThis.length === 0) continue;
    const allCorrect = predsForThis.every(p => p.predValue === actual);
    const allWrong = predsForThis.every(p => p.predValue !== actual);
    if (allWrong) {
      // 숨기기 보너스 +2
      gain.set(targetId, (gain.get(targetId) || 0) + 2);
      surprise.push({ targetId, actual });
    }
    if (allCorrect && predsForThis.length >= 2) {
      unanimous.push({ targetId, actual });
    }
  }

  // 점수 적용
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p) p.score += (gain.get(uid) || 0);
  }

  // 답 / 예측 / 점수 직렬화
  const answersArr = room.playerOrder.map(uid => ({
    userId: uid,
    answer: answers.get(uid) || null, // null = 미답
  }));
  // 예측은 predictor별로 정리
  const predictionsArr = [];
  for (const [predictorId, predMap] of predictions.entries()) {
    for (const [targetId, predValue] of predMap.entries()) {
      const actual = answers.get(targetId);
      predictionsArr.push({
        predictorId,
        targetId,
        predValue,
        correct: actual ? predValue === actual : null,
      });
    }
  }
  const scoresArr = room.playerOrder.map(uid => ({
    userId: uid,
    score: room.players.get(uid)?.score || 0,
    gain: gain.get(uid) || 0,
  }));

  const isLastRound = room.currentRoundIdx >= room.totalRounds - 1;

  io.to(socketRoomName(room.id)).emit("ox:roundResult", {
    roundIdx: room.currentRoundIdx,
    totalRounds: room.totalRounds,
    isLastRound,
    question: room.roundData.question,
    answers: answersArr,
    predictions: predictionsArr,
    scores: scoresArr,
    surprise,
    unanimous,
    timedOut: !!timedOut,
  });

  // ✅ 자동 진행 X — 호스트가 ox:nextRound emit 해야 다음 라운드/게임종료
}

function endGame(io, room) {
  room.status = "ended";
  clearRoundTimer(room);
  // 랭킹
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

  // 타이틀 부여
  const titles = {};
  if (ranking.length > 0) {
    titles[ranking[0].userId] = { key: "psychic", label: "🔮 친구방의 점쟁이" };
    if (ranking.length >= 3) {
      titles[ranking[ranking.length - 1].userId] = { key: "clueless", label: "🤡 친구를 모르는 사람" };
    }
  }

  io.to(socketRoomName(room.id)).emit("ox:gameEnd", {
    ranking,
    titles,
    totalRounds: room.totalRounds,
  });

  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, 60_000);
}

// ===== leave =====
function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (oxUserRoom.get(userId) === room.id) oxUserRoom.delete(userId);

  if (room.playerOrder.length === 0) return deleteRoom(io, room, "EMPTY");
  if (wasHost) room.hostUserId = room.playerOrder[0];

  if (room.status === "playing" && room.roundData?.phase === "input") {
    // 미답자가 나가면 모두 완료 가능성
    const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
    if (room.roundData.finished.size >= connectedUids.length && connectedUids.length > 0) {
      clearRoundTimer(room);
      finishRound(io, room, false);
    }
  }
  broadcastRoomState(io, room);
}

// ===== handlers =====
export function registerOxGame(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("ox:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (oxUserRoom.has(me.id)) {
          const old = oxRooms.get(oxUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }

        const totalRounds = ALLOWED_ROUNDS.includes(Number(payload?.totalRounds))
          ? Number(payload.totalRounds) : 5;
        const inputSec = ALLOWED_INPUT_SECS.includes(Number(payload?.inputSec))
          ? Number(payload.inputSec) : 60;
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 6;
        const category = isValidCategory(payload?.category) ? payload.category : "random";

        const roomId = `ox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",
          maxPlayers,
          totalRounds,
          inputSec,
          category,
          createdAt: Date.now(),
          players: new Map(),
          playerOrder: [],
          currentRoundIdx: 0,
          roundData: null,
          phaseTimer: null,
          emptyRoomTimer: null,
          seenQuestionIds: new Set(),
        };
        oxRooms.set(roomId, room);
        oxInvites.set(inviteCode, roomId);

        let avatar = null;
        let nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}

        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        oxUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[ox] created room ${roomId} by ${me.id} cat=${category} inv=${inviteCode}`);
      } catch (e) {
        console.error("[ox:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("ox:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = oxInvites.get(code);
        const room = roomId ? oxRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          oxUserRoom.set(me.id, roomId);
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
        oxUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[ox:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("ox:setOptions", (payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.totalRounds != null && ALLOWED_ROUNDS.includes(Number(payload.totalRounds))) {
        room.totalRounds = Number(payload.totalRounds);
      }
      if (payload?.inputSec != null && ALLOWED_INPUT_SECS.includes(Number(payload.inputSec))) {
        room.inputSec = Number(payload.inputSec);
      }
      if (payload?.category && isValidCategory(payload.category)) {
        room.category = payload.category;
      }
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    socket.on("ox:setMaxPlayers", (payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
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

    socket.on("ox:startGame", (_payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", min: MIN_PLAYERS });

      for (const p of room.players.values()) p.score = 0;
      room.status = "playing";
      room.currentRoundIdx = 0;
      room.seenQuestionIds = new Set();
      cb?.({ ok: true });

      io.to(socketRoomName(room.id)).emit("ox:gameStart", {
        totalRounds: room.totalRounds,
        category: room.category,
      });
      // 잠깐 대기 후 첫 라운드
      room.phaseTimer = setTimeout(() => startNextRound(io, room), ROUND_INTRO_MS);
    });

    socket.on("ox:submitAnswer", (payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "input") return cb?.({ ok: false, error: "NOT_INPUT_PHASE" });

      const ok = submitAnswer(io, room, me.id, payload);
      if (!ok) return cb?.({ ok: false, error: "INVALID_PAYLOAD" });
      cb?.({ ok: true });
    });

    // ✅ 호스트 수동 다음 라운드 진행
    socket.on("ox:nextRound", (_payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData?.phase !== "result") return cb?.({ ok: false, error: "NOT_RESULT_PHASE" });

      cb?.({ ok: true });
      clearRoundTimer(room);
      room.currentRoundIdx++;
      // 마지막 라운드 끝났으면 endGame, 아니면 다음 라운드
      if (room.currentRoundIdx >= room.totalRounds) {
        endGame(io, room);
      } else {
        startNextRound(io, room);
      }
    });

    socket.on("ox:leaveRoom", (_payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.leave(socketRoomName(room.id));
      leavePlayer(io, room, me.id);
      cb?.({ ok: true });
    });

    socket.on("ox:requestState", (_payload, cb) => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const p = room.players.get(me.id);
      if (p) { p.socketId = socket.id; p.connected = true; }
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = oxUserRoom.get(me.id);
      const room = roomId ? oxRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else if (room.status === "playing") {
        broadcastRoomState(io, room);
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        } else {
          // 입력 단계에서 미답자가 끊기면 모두 완료 가능성
          if (room.roundData?.phase === "input") {
            const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
            if (connectedUids.length > 0 && room.roundData.finished.size >= connectedUids.length) {
              clearRoundTimer(room);
              finishRound(io, room, false);
            }
          }
        }
      }
    });
  });
}
