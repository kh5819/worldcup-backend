// =========================
// DUO 거짓말 매치 (Fibbage 한국형) — 서버 v0.1
// 기존 worldcup/quiz/tier/lifegame/liar 멀티와 완전 격리
// - 별도 Map (fbRooms)
// - 별도 invite code Map
// - 'fb:*' 이벤트 prefix 전용
// - socket.io room name = `fb:${roomId}`
// =========================

import {
  FB_CATEGORIES,
  FB_QUESTIONS,
  pickRandomQuestion,
  normalizeAnswer,
  isLuckyHit,
  pickDecoy,
} from "./fibbage-questions.js";

const CATEGORY_IDS = Object.keys(FB_QUESTIONS);
function isValidCategory(cat) {
  return cat === "random" || !!FB_QUESTIONS[cat];
}
function resolveCategoryForRound(roomCategory) {
  if (roomCategory !== "random") return roomCategory;
  return CATEGORY_IDS[Math.floor(Math.random() * CATEGORY_IDS.length)];
}

const fbRooms = new Map();
const fbInvites = new Map();
const fbUserRoom = new Map();

const ALLOWED_INPUT_SECS = [20, 30, 45];   // 가짜 답 작성 시간
const ALLOWED_VOTE_SECS = [15, 20, 30];    // 정답 선택 시간
const ALLOWED_ROUNDS = [3, 5];
const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const MIN_PLAYERS = 2;                      // 2명도 OK (선택지 부족 시 decoys로 자동 패딩 4개 보장)
const FAKE_LEN_MAX = 30;
const RESULT_FALLBACK_MS = 60_000;         // 호스트 부재 시 자동 진행 안전장치
const REVEAL_BEFORE_VOTE_MS = 1500;        // 셔플 후 보여주기 전 짧은 텀
const EMPTY_ROOM_TTL_MS = 30_000;

// 점수
const SCORE_CORRECT = 500;
const SCORE_FOOLED_PER_VOTER = 250;
const SCORE_LUCKY_HIT = 1000;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!fbInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `fb:${roomId}`; }
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
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
    inputSec: room.inputSec,
    voteSec: room.voteSec,
    category: room.category,
    effectiveCategory: room.roundData?.effectiveCategory || null,
    currentRoundIdx: room.currentRoundIdx,
    phase: room.roundData?.phase || (room.status === "lobby" ? "lobby" : null),
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    deadline: room.roundData?.deadline || null,
  };
}

// ===== game flow =====
function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("fb:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearTimer(room);
  clearEmptyRoomTimer(room);
  fbRooms.delete(room.id);
  fbInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (fbUserRoom.get(uid) === room.id) fbUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("fb:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[fb] room ${room.id} deleted: ${reason}`);
}

function startNextRound(io, room) {
  if (room.status !== "playing") return;
  if (room.currentRoundIdx >= room.totalRounds) return endGame(io, room);

  const effectiveCat = resolveCategoryForRound(room.category);
  const question = pickRandomQuestion(effectiveCat, room.usedQuestionIds);
  if (!question) return endGame(io, room);
  room.usedQuestionIds.add(question.id);

  const catLabel = FB_CATEGORIES.find(c => c.id === effectiveCat)?.label || effectiveCat;

  room.roundData = {
    phase: "input",
    question,
    effectiveCategory: effectiveCat,
    fakes: new Map(),                  // userId → { text, normalized, isLucky }
    choices: null,                     // 셔플 후 채움
    realChoiceIdx: -1,
    votes: new Map(),                  // userId → choiceIdx
    deadline: null,
    timer: null,
  };

  io.to(socketRoomName(room.id)).emit("fb:roundStart", {
    roundIdx: room.currentRoundIdx,
    totalRounds: room.totalRounds,
    category: effectiveCat,
    categoryLabel: catLabel,
    isRandomCategory: room.category === "random",
  });

  // 잠시 텀 후 input phase 시작
  room.phaseTimer = setTimeout(() => startInputPhase(io, room), 1200);
}

function startInputPhase(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  room.roundData.phase = "input";
  room.roundData.deadline = Date.now() + room.inputSec * 1000;

  const q = room.roundData.question;
  const catLabel = FB_CATEGORIES.find(c => c.id === room.roundData.effectiveCategory)?.label || room.roundData.effectiveCategory;

  io.to(socketRoomName(room.id)).emit("fb:inputPhase", {
    roundIdx: room.currentRoundIdx,
    question: q.question,
    category: room.roundData.effectiveCategory,
    categoryLabel: catLabel,
    inputSec: room.inputSec,
    deadline: room.roundData.deadline,
    fakeLenMax: FAKE_LEN_MAX,
  });

  clearTimer(room);
  room.roundData.timer = setTimeout(() => finishInputPhase(io, room, true), room.inputSec * 1000);
}

function submitFake(io, room, userId, rawText) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "input") return;
  if (!room.players.has(userId)) return;
  if (room.roundData.fakes.has(userId)) return;

  const text = String(rawText || "").slice(0, FAKE_LEN_MAX).trim();
  const normalized = normalizeAnswer(text);
  const lucky = text ? isLuckyHit(text, room.roundData.question) : false;

  room.roundData.fakes.set(userId, { text, normalized, isLucky: lucky });
  io.to(socketRoomName(room.id)).emit("fb:fakeSubmitted", { userId });

  // 모든 연결된 플레이어가 제출 → 즉시 종료
  const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
  if (room.roundData.fakes.size >= connectedUids.length) {
    clearTimer(room);
    finishInputPhase(io, room, false);
  }
}

function finishInputPhase(io, room, timedOut) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "input") return;
  clearTimer(room);
  room.roundData.phase = "input_locked";

  const q = room.roundData.question;
  const fakes = room.roundData.fakes; // userId → {text, normalized, isLucky}

  // 1) lucky hit / 빈 답 분류
  const luckyHits = [];
  const emptyOrTroll = [];     // userId 목록
  const validFakesByNorm = new Map(); // normalized → { text, ownerIds:[...] }
  const realNorm = normalizeAnswer(q.answer);

  // 모든 연결된 플레이어가 제출했어야 정상; 미제출은 emptyOrTroll로
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.connected) continue;
    const f = fakes.get(uid);
    if (!f) {
      // 미제출 (timedOut 또는 disconnect)
      emptyOrTroll.push(uid);
      continue;
    }
    if (f.isLucky) {
      luckyHits.push(uid);
      continue; // 가짜 풀에 안 넣음 (진짜 정답과 동일)
    }
    if (!f.text || f.text.length < 1) {
      emptyOrTroll.push(uid);
      continue;
    }
    // 너무 짧은 답(1글자 미만 무시함) 또는 단순 도배(같은 문자 반복)
    if (/^(.)\1{2,}$/.test(f.text)) {
      emptyOrTroll.push(uid);
      continue;
    }
    // 가짜 답들 중 normalized 기준으로 그룹화
    const key = f.normalized;
    if (!validFakesByNorm.has(key)) {
      validFakesByNorm.set(key, { text: f.text, ownerIds: [], normalized: key });
    }
    validFakesByNorm.get(key).ownerIds.push(uid);
  }

  // 2) 중복 가짜 분류 (2명 이상 ownerIds → duplicate, 풀에서 제거)
  const duplicates = []; // [[uid1, uid2], ...]
  const validUnique = []; // { text, ownerIds:[1명], normalized }
  for (const [norm, group] of validFakesByNorm.entries()) {
    if (group.ownerIds.length >= 2) {
      duplicates.push(group.ownerIds.slice());
    } else {
      validUnique.push(group);
    }
  }

  // 3) decoy 채우기 (선택지 부족 방지) — emptyOrTroll 수만큼
  const usedNorms = new Set();
  usedNorms.add(realNorm);
  for (const v of validUnique) usedNorms.add(v.normalized);

  const decoyChoices = []; // { text, ownerIds:[], isDecoy:true }
  for (let i = 0; i < emptyOrTroll.length; i++) {
    const dtext = pickDecoy(q, usedNorms);
    const dnorm = normalizeAnswer(dtext);
    if (usedNorms.has(dnorm)) continue; // 더 이상 안 겹치는 것 없음 — 그냥 skip
    usedNorms.add(dnorm);
    decoyChoices.push({ text: dtext, ownerIds: [], isDecoy: true, normalized: dnorm });
  }

  // 4) 최종 선택지 = 진짜 + valid fakes + decoys, 셔플
  const choices = [];
  choices.push({ text: q.answer, ownerIds: [], isReal: true, isDecoy: false, normalized: realNorm });
  for (const v of validUnique) {
    choices.push({ text: v.text, ownerIds: v.ownerIds, isReal: false, isDecoy: false, normalized: v.normalized });
  }
  for (const d of decoyChoices) {
    choices.push({ text: d.text, ownerIds: [], isReal: false, isDecoy: true, normalized: d.normalized });
  }
  // 부족 시 (예: 4명인데 다 lucky hit) — decoys 더 채워서 최소 4개 보장
  while (choices.length < 4) {
    const dtext = pickDecoy(q, usedNorms);
    const dnorm = normalizeAnswer(dtext);
    if (usedNorms.has(dnorm)) break;
    usedNorms.add(dnorm);
    choices.push({ text: dtext, ownerIds: [], isReal: false, isDecoy: true, normalized: dnorm });
  }

  shuffleInPlace(choices);
  // 인덱스 부여 + realChoiceIdx 추출
  let realIdx = -1;
  for (let i = 0; i < choices.length; i++) {
    choices[i].idx = i;
    if (choices[i].isReal) realIdx = i;
  }

  room.roundData.choices = choices;
  room.roundData.realChoiceIdx = realIdx;
  room.roundData.luckyHits = luckyHits;
  room.roundData.duplicates = duplicates;
  room.roundData.emptyOrTroll = emptyOrTroll;

  // 짧은 텀 후 vote phase
  room.phaseTimer = setTimeout(() => startVotePhase(io, room), REVEAL_BEFORE_VOTE_MS);
}

function startVotePhase(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  room.roundData.phase = "vote";
  room.roundData.deadline = Date.now() + room.voteSec * 1000;

  // 클라에게는 익명화된 choices만 (ownerIds, isReal, isDecoy 숨김)
  const publicChoices = room.roundData.choices.map(c => ({
    idx: c.idx,
    text: c.text,
  }));

  io.to(socketRoomName(room.id)).emit("fb:votePhase", {
    roundIdx: room.currentRoundIdx,
    choices: publicChoices,
    voteSec: room.voteSec,
    deadline: room.roundData.deadline,
  });

  clearTimer(room);
  room.roundData.timer = setTimeout(() => finishVotePhase(io, room, true), room.voteSec * 1000);
}

function submitVote(io, room, voterId, choiceIdx) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "vote") return;
  if (!room.players.has(voterId)) return;
  if (room.roundData.votes.has(voterId)) return;

  const choices = room.roundData.choices || [];
  if (!Number.isInteger(choiceIdx) || choiceIdx < 0 || choiceIdx >= choices.length) return;
  // 자기가 작성한 가짜는 못 고름
  if ((choices[choiceIdx].ownerIds || []).includes(voterId)) return;

  room.roundData.votes.set(voterId, choiceIdx);
  io.to(socketRoomName(room.id)).emit("fb:voteSubmitted", { voterId });

  const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
  if (room.roundData.votes.size >= connectedUids.length) {
    clearTimer(room);
    finishVotePhase(io, room, false);
  }
}

function finishVotePhase(io, room, timedOut) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "vote") return;
  clearTimer(room);
  room.roundData.phase = "vote_locked";

  const { choices, realChoiceIdx, votes, luckyHits, duplicates, question } = room.roundData;

  // voters 채우기
  const votersByChoice = new Map(); // idx → [uid...]
  for (const [voter, idx] of votes.entries()) {
    if (!votersByChoice.has(idx)) votersByChoice.set(idx, []);
    votersByChoice.get(idx).push(voter);
  }

  // 점수 계산
  const deltaByUser = new Map(); // uid → delta
  function addDelta(uid, n) {
    deltaByUser.set(uid, (deltaByUser.get(uid) || 0) + n);
  }

  // 1) lucky hit 보너스
  for (const uid of luckyHits) addDelta(uid, SCORE_LUCKY_HIT);

  // 2) 진짜 정답 맞춤
  const realVoters = votersByChoice.get(realChoiceIdx) || [];
  for (const uid of realVoters) addDelta(uid, SCORE_CORRECT);

  // 3) 가짜 작성자 → 자기 가짜에 속은 사람 수 × SCORE_FOOLED_PER_VOTER
  for (const c of choices) {
    if (c.isReal || c.isDecoy) continue;
    const voters = votersByChoice.get(c.idx) || [];
    if (voters.length === 0) continue;
    for (const owner of c.ownerIds) {
      addDelta(owner, voters.length * SCORE_FOOLED_PER_VOTER);
    }
  }

  // 누적 점수 적용
  const scores = [];
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    const delta = deltaByUser.get(uid) || 0;
    if (p) p.score += delta;
    scores.push({ userId: uid, score: p?.score || 0, deltaThisRound: delta });
  }

  // 결과 emit (모든 정보 공개)
  const choicesPublic = choices.map(c => ({
    idx: c.idx,
    text: c.text,
    ownerIds: c.ownerIds.slice(),
    voters: (votersByChoice.get(c.idx) || []).slice(),
    isReal: !!c.isReal,
    isDecoy: !!c.isDecoy,
  }));

  const isLastRound = (room.currentRoundIdx + 1) >= room.totalRounds;

  io.to(socketRoomName(room.id)).emit("fb:roundResult", {
    roundIdx: room.currentRoundIdx,
    isLastRound,
    hostUserId: room.hostUserId,
    fallbackSec: Math.floor(RESULT_FALLBACK_MS / 1000),
    realIdx: realChoiceIdx,
    realAnswer: question.answer,
    source: question.source || null,
    questionText: question.question,
    choices: choicesPublic,
    luckyHits: luckyHits.slice(),
    duplicates: duplicates.map(arr => arr.slice()),
    emptyOrTroll: (room.roundData.emptyOrTroll || []).slice(),
    scores,
    scoring: {
      correct: SCORE_CORRECT,
      fooledPerVoter: SCORE_FOOLED_PER_VOTER,
      luckyHit: SCORE_LUCKY_HIT,
    },
  });

  room.roundData.phase = "result";
  // 호스트가 fb:hostNext로 진행. 부재 시 fallback timeout으로 안전 진행.
  room.phaseTimer = setTimeout(() => advanceFromResult(io, room), RESULT_FALLBACK_MS);
}

function advanceFromResult(io, room) {
  if (room.status !== "playing" || !room.roundData) return;
  if (room.roundData.phase !== "result") return;
  clearTimer(room);
  room.roundData.phase = "result_locked";
  room.currentRoundIdx++;
  startNextRound(io, room);
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
  io.to(socketRoomName(room.id)).emit("fb:gameEnd", {
    ranking,
    totalRounds: room.totalRounds,
  });
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, 60_000);
}

// ===== leave / disconnect =====
function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (fbUserRoom.get(userId) === room.id) fbUserRoom.delete(userId);

  if (room.playerOrder.length === 0) return deleteRoom(io, room, "EMPTY");
  if (wasHost) room.hostUserId = room.playerOrder[0];

  if (room.status === "playing") {
    // 진행 중이면 phase별 자동 진입 체크
    if (room.roundData?.phase === "input") {
      const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
      if (room.roundData.fakes.size >= connectedUids.length && connectedUids.length > 0) {
        clearTimer(room);
        finishInputPhase(io, room, false);
      }
    } else if (room.roundData?.phase === "vote") {
      const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
      if (room.roundData.votes.size >= connectedUids.length && connectedUids.length > 0) {
        clearTimer(room);
        finishVotePhase(io, room, false);
      }
    }
    const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
    if (!anyConnected) {
      clearEmptyRoomTimer(room);
      room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
    }
  }
  broadcastRoomState(io, room);
}

// ===== handlers =====
export function registerFibbage(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("fb:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (fbUserRoom.has(me.id)) {
          const old = fbRooms.get(fbUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }

        const totalRounds = ALLOWED_ROUNDS.includes(Number(payload?.totalRounds))
          ? Number(payload.totalRounds) : 5;
        const inputSec = ALLOWED_INPUT_SECS.includes(Number(payload?.inputSec))
          ? Number(payload.inputSec) : 30;
        const voteSec = ALLOWED_VOTE_SECS.includes(Number(payload?.voteSec))
          ? Number(payload.voteSec) : 20;
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 6;
        const category = isValidCategory(payload?.category) ? payload.category : "random";

        const roomId = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",
          maxPlayers,
          totalRounds,
          inputSec,
          voteSec,
          category,
          createdAt: Date.now(),
          players: new Map(),
          playerOrder: [],
          currentRoundIdx: 0,
          usedQuestionIds: new Set(),
          roundData: null,
          phaseTimer: null,
          emptyRoomTimer: null,
        };
        fbRooms.set(roomId, room);
        fbInvites.set(inviteCode, roomId);

        let avatar = null;
        let nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}

        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        fbUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[fb] created room ${roomId} by ${me.id} cat=${category} inv=${inviteCode}`);
      } catch (e) {
        console.error("[fb:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("fb:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = fbInvites.get(code);
        const room = roomId ? fbRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          fbUserRoom.set(me.id, roomId);
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
        fbUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[fb:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("fb:setOptions", (payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.totalRounds != null && ALLOWED_ROUNDS.includes(Number(payload.totalRounds))) {
        room.totalRounds = Number(payload.totalRounds);
      }
      if (payload?.inputSec != null && ALLOWED_INPUT_SECS.includes(Number(payload.inputSec))) {
        room.inputSec = Number(payload.inputSec);
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

    socket.on("fb:setMaxPlayers", (payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
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

    socket.on("fb:startGame", (_payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", min: MIN_PLAYERS });

      for (const p of room.players.values()) p.score = 0;
      room.status = "playing";
      room.currentRoundIdx = 0;
      room.usedQuestionIds = new Set();
      cb?.({ ok: true });

      io.to(socketRoomName(room.id)).emit("fb:gameStart", {
        totalRounds: room.totalRounds,
        category: room.category,
      });
      startNextRound(io, room);
    });

    socket.on("fb:submitFake", (payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "input") return cb?.({ ok: false, error: "NOT_INPUT_PHASE" });
      if (room.roundData.fakes.has(me.id)) return cb?.({ ok: false, error: "ALREADY_SUBMITTED" });

      cb?.({ ok: true });
      submitFake(io, room, me.id, payload?.text || "");
    });

    socket.on("fb:submitVote", (payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "vote") return cb?.({ ok: false, error: "NOT_VOTE_PHASE" });
      const idx = Number(payload?.choiceIdx);
      if (!Number.isInteger(idx)) return cb?.({ ok: false, error: "INVALID_CHOICE" });
      if (room.roundData.votes.has(me.id)) return cb?.({ ok: false, error: "ALREADY_VOTED" });
      // 자기 가짜 검사
      const c = room.roundData.choices?.[idx];
      if (!c) return cb?.({ ok: false, error: "INVALID_CHOICE" });
      if ((c.ownerIds || []).includes(me.id)) return cb?.({ ok: false, error: "CANNOT_VOTE_OWN_FAKE" });

      cb?.({ ok: true });
      submitVote(io, room, me.id, idx);
    });

    socket.on("fb:hostNext", (_payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "playing" || !room.roundData) return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.roundData.phase !== "result") return cb?.({ ok: false, error: "NOT_RESULT_PHASE" });

      cb?.({ ok: true });
      advanceFromResult(io, room);
    });

    socket.on("fb:leaveRoom", (_payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.leave(socketRoomName(room.id));
      leavePlayer(io, room, me.id);
      cb?.({ ok: true });
    });

    socket.on("fb:kickPlayer", (payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("fb:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("fb:requestState", (_payload, cb) => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const p = room.players.get(me.id);
      if (p) { p.socketId = socket.id; p.connected = true; }
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = fbUserRoom.get(me.id);
      const room = roomId ? fbRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else if (room.status === "playing") {
        broadcastRoomState(io, room);
        // 모든 연결된 플레이어가 입력/투표 완료된 상태인지 재확인
        if (room.roundData?.phase === "input") {
          const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
          if (connectedUids.length > 0 && room.roundData.fakes.size >= connectedUids.length) {
            clearTimer(room);
            finishInputPhase(io, room, false);
          }
        } else if (room.roundData?.phase === "vote") {
          const connectedUids = room.playerOrder.filter(uid => room.players.get(uid)?.connected);
          if (connectedUids.length > 0 && room.roundData.votes.size >= connectedUids.length) {
            clearTimer(room);
            finishVotePhase(io, room, false);
          }
        }
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        }
      }
    });
  });
}
