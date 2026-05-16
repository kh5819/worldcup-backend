// =========================
// 그려봐 (DUO Draw) — 멀티플레이어 그림 맞히기 서버
// 모드: 직접 출제 (v1) + 공식 문제 (v2 예정)
// 룸 lifecycle: lobby → playing → ended
// 이벤트 prefix: 'draw:', socket room name: `draw:${roomId}`
// =========================

const drawRooms = new Map();       // roomId → room
const drawInvites = new Map();     // inviteCode → roomId
const drawUserRoom = new Map();    // userId → roomId

let _supabaseRef = null;           // registerDraw에서 세팅 (공식 단어 fetch용)

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const ALLOWED_ROUNDS = [3, 5, 8];
const ALLOWED_DRAW_TIME_SEC = [60, 90, 120];
const ALLOWED_WORD_MODES = new Set(["manual", "official"]);
const ALLOWED_CATEGORIES = new Set(["food", "animal", "thing", "character", "meme", "any"]);
const MIN_PLAYERS_TO_START = 2;
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;
const MAX_WORD_LEN = 14;
const MIN_WORD_LEN = 2;
const STROKE_THROTTLE_MS = 40;
const CHOSEONG_HINT_AT_RATIO = 0.5;  // 라운드 50% 경과 시 초성 공개

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!drawInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `draw:${roomId}`; }

// 한글 초성 추출. 영문/숫자/기타는 원형 유지.
const CHOSEONG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function toChoseongHint(word) {
  return [...String(word || "")].map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = Math.floor((code - 0xAC00) / 588);
      return CHOSEONG[idx] || ch;
    }
    return ch;
  }).join("");
}
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearRoundTimer(room) {
  if (room?.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
  if (room?.hintTimer) { clearTimeout(room.hintTimer); room.hintTimer = null; }
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
    drewThisGame: false,
    lastCorrectAt: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    score: p.score || 0,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    rounds: room.rounds,
    drawTimeSec: room.drawTimeSec,
    wordMode: room.wordMode,
    wordCategory: room.wordCategory,
    useChoseongHint: !!room.useChoseongHint,
    currentRound: room.currentRound,
    currentDrawerId: room.currentDrawerId,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("draw:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearRoundTimer(room);
  drawRooms.delete(room.id);
  drawInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (drawUserRoom.get(uid) === room.id) drawUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("draw:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[draw] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = drawRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every(p => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasDrawer = room.currentDrawerId === userId;

  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (drawUserRoom.get(userId) === room.id) drawUserRoom.delete(userId);

  if (wasHost && room.playerOrder.length > 0) {
    room.hostUserId = room.playerOrder[0];
  }
  io.to(socketRoomName(room.id)).emit("draw:peerLeave", { playerId: userId });

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  // 진행 중에 출제자가 나가면 라운드 강제 종료 → 다음 출제자로
  if (room.status === "playing" && wasDrawer) {
    endRound(io, room, "DRAWER_LEFT");
  }
  // 진행 중에 인원이 1명이 되면 게임 종료
  if (room.status === "playing" && room.players.size < 2) {
    finishGame(io, room, "NOT_ENOUGH_PLAYERS");
    return;
  }
  broadcastRoomState(io, room);
}

// DB 비어있을 때 fallback 단어풀 (50개)
const FALLBACK_WORDS = [
  "김치","떡볶이","비빔밥","짜장면","라면","김밥","수박","사과","딸기","바나나",
  "강아지","고양이","코끼리","사자","호랑이","곰","토끼","고래","상어","문어",
  "자동차","비행기","자전거","버스","지하철","우산","신발","모자","안경","시계",
  "뽀로로","피카츄","도라에몽","짱구","마리오","엘사","스파이더맨","배트맨","헐크","아이언맨",
  "손흥민","BTS","블랙핑크","뉴진스","카리나","카카오톡","유튜브","넷플릭스","삼성","오징어게임",
];

// 공식 모드 단어 select — DB 우선, 없으면 hard-coded fallback
// 같은 게임 내 중복 방지 — room.usedWords Set 사용
async function pickOfficialWord(supabase, category, usedWords) {
  const used = usedWords || new Set();
  try {
    if (supabase) {
      let q = supabase.from("draw_words").select("word").eq("active", true);
      if (category && category !== "any") q = q.eq("category", category);
      const { data, error } = await q.limit(500);
      if (!error && data?.length) {
        // 안 쓴 단어만 필터
        const fresh = data.filter((d) => d.word && !used.has(d.word));
        const pool = fresh.length > 0 ? fresh : data; // 다 썼으면 풀 리셋
        if (fresh.length === 0 && pool.length > 0) used.clear();
        const idx = Math.floor(Math.random() * pool.length);
        if (pool[idx]?.word) return pool[idx].word;
      }
      console.warn(`[draw] DB word fetch empty (category=${category}) → fallback`);
    }
  } catch (e) {
    console.warn("[draw] pickOfficialWord DB error → fallback:", e?.message);
  }
  // fallback도 중복 방지
  const freshFb = FALLBACK_WORDS.filter((w) => !used.has(w));
  const fbPool = freshFb.length > 0 ? freshFb : FALLBACK_WORDS;
  if (freshFb.length === 0) used.clear();
  return fbPool[Math.floor(Math.random() * fbPool.length)];
}

// ===== 라운드/게임 lifecycle =====
async function startRound(io, room, supabase) {
  // 다음 라운드 번호. rounds 옵션 채우면 종료.
  const nextRoundNo = room.currentRound + 1;
  if (nextRoundNo > room.rounds) {
    finishGame(io, room, "ALL_ROUNDS_DONE");
    return;
  }
  // 출제자 = playerOrder 순환 (라운드-1 인덱스). 2명 5라운드 = A,B,A,B,A
  // playerOrder가 비어있거나 손상되면 종료
  if (!room.playerOrder.length) {
    finishGame(io, room, "NO_PLAYERS");
    return;
  }
  const drawerIdx = (nextRoundNo - 1) % room.playerOrder.length;
  const drawerId = room.playerOrder[drawerIdx];
  if (!drawerId || !room.players.has(drawerId)) {
    finishGame(io, room, "NO_DRAWER");
    return;
  }

  room.currentRound = nextRoundNo;
  room.currentDrawerId = drawerId;
  room.currentWord = null;
  room.roundStartedAt = null;
  room.correctOrder = [];
  clearRoundTimer(room);

  io.to(socketRoomName(room.id)).emit("draw:roundIntro", {
    round: room.currentRound,
    totalRounds: room.rounds,
    drawerId,
    drawerNickname: room.players.get(drawerId)?.name || "?",
    wordMode: room.wordMode,
  });

  console.log(`[draw] room ${room.id} round ${room.currentRound} drawer=${drawerId} mode=${room.wordMode}`);

  // 공식 모드: 서버가 단어 자동 select → 즉시 beginDrawing
  if (room.wordMode === "official" && supabase) {
    if (!room.usedWords) room.usedWords = new Set();
    const word = await pickOfficialWord(supabase, room.wordCategory, room.usedWords);
    if (word) room.usedWords.add(word);
    if (!word) {
      // 실패 시 manual fallback
      console.warn(`[draw] official word fetch fail, fallback to manual`);
    } else {
      // 약간의 딜레이 (roundIntro 받고 화면 전환 시간) 후 시작
      setTimeout(() => {
        const r = drawRooms.get(room.id);
        if (r && r.status === "playing" && r.currentRound === room.currentRound) {
          beginDrawing(io, r, word);
        }
      }, 1500);
    }
  }
}

function beginDrawing(io, room, word) {
  room.currentWord = word;
  room.roundStartedAt = Date.now();
  const drawerId = room.currentDrawerId;
  const drawer = room.players.get(drawerId);
  // drewThisGame 플래그는 더 이상 사용 X (라운드 순환은 currentRound 기반)

  io.to(socketRoomName(room.id)).emit("draw:roundStart", {
    round: room.currentRound,
    drawerId,
    drawerNickname: drawer?.name || "?",
    wordLength: word.length,
    drawTimeSec: room.drawTimeSec,
    startedAt: room.roundStartedAt,
  });

  // 출제자에게만 단어 통보 (글자수만 다른 사람에게)
  const drawerSocket = io.sockets.sockets.get(drawer?.socketId);
  if (drawerSocket) drawerSocket.emit("draw:yourWord", { word });

  // 초성 힌트 타이머 (라운드 50% 경과 시)
  if (room.useChoseongHint) {
    const hintAtMs = Math.floor(room.drawTimeSec * CHOSEONG_HINT_AT_RATIO * 1000);
    room.hintTimer = setTimeout(() => {
      const r = drawRooms.get(room.id);
      if (r && r.status === "playing" && r.currentRound === room.currentRound && r.currentWord) {
        io.to(socketRoomName(r.id)).emit("draw:hint", {
          round: r.currentRound,
          hint: toChoseongHint(r.currentWord),
        });
      }
    }, hintAtMs);
  }

  // 라운드 타이머
  room.roundTimer = setTimeout(() => {
    const r = drawRooms.get(room.id);
    if (r && r.status === "playing" && r.currentRound === room.currentRound) {
      endRound(io, r, "TIME_UP");
    }
  }, room.drawTimeSec * 1000);
}

function endRound(io, room, reason) {
  clearRoundTimer(room);
  const word = room.currentWord;
  io.to(socketRoomName(room.id)).emit("draw:roundEnd", {
    round: room.currentRound,
    reason,
    word,
    correctOrder: room.correctOrder.map(uid => ({
      playerId: uid,
      nickname: room.players.get(uid)?.name || "?",
    })),
  });
  room.currentWord = null;
  room.currentDrawerId = null;
  broadcastRoomState(io, room);

  // 3초 후 다음 라운드
  setTimeout(() => {
    const r = drawRooms.get(room.id);
    if (!r || r.status !== "playing") return;
    startRound(io, r, _supabaseRef);
  }, 3000);
}

function finishGame(io, room, reason) {
  if (room.status === "ended") return;
  room.status = "ended";
  clearRoundTimer(room);

  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return p ? { playerId: uid, nickname: p.name, score: p.score || 0 } : null;
  }).filter(Boolean).sort((a, b) => (b.score || 0) - (a.score || 0));

  io.to(socketRoomName(room.id)).emit("draw:gameEnded", { reason, ranking });
  broadcastRoomState(io, room);
  console.log(`[draw] room ${room.id} game ended: ${reason}`);
}

// 점수 계산: 정답 순서별 가중치 + 출제자 보너스
const SCORE_BY_RANK = [100, 70, 50, 30, 30, 30, 30, 30]; // 1~8등
function awardCorrect(room, userId) {
  const p = room.players.get(userId);
  if (!p || userId === room.currentDrawerId) return null;
  if (room.correctOrder.includes(userId)) return null;
  const rank = room.correctOrder.length; // 0-indexed
  const score = SCORE_BY_RANK[rank] || 30;
  p.score = (p.score || 0) + score;
  p.lastCorrectAt = Date.now();
  room.correctOrder.push(userId);
  return { rank: rank + 1, score, total: p.score };
}

function maybeAwardDrawerAndEnd(io, room) {
  // 모두 정답 시 출제자 보너스 + 라운드 종료
  const totalGuessers = room.players.size - 1; // 출제자 제외
  if (room.correctOrder.length < totalGuessers) return false;
  // 출제자 보너스: 정답자 수 × 30. 단 첫 정답이 3초 이내면 0 (너무 쉬웠음)
  const drawer = room.players.get(room.currentDrawerId);
  if (drawer && room.correctOrder.length > 0) {
    const firstAt = room.players.get(room.correctOrder[0])?.lastCorrectAt || 0;
    const tooFast = (firstAt - room.roundStartedAt) < 3000;
    if (!tooFast) drawer.score = (drawer.score || 0) + room.correctOrder.length * 30;
  }
  endRound(io, room, "ALL_CORRECT");
  return true;
}

// =========================
// 등록
// =========================
export function registerDraw(io, supabaseAdmin) {
  _supabaseRef = supabaseAdmin;
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 -----
    socket.on("draw:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });

        // 기존 방 정리
        if (drawUserRoom.has(me.id)) {
          const old = drawRooms.get(drawUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }

        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const rounds = ALLOWED_ROUNDS.includes(Number(payload?.rounds))
          ? Number(payload.rounds) : 5;
        const drawTimeSec = ALLOWED_DRAW_TIME_SEC.includes(Number(payload?.drawTimeSec))
          ? Number(payload.drawTimeSec) : 90;
        const wordMode = ALLOWED_WORD_MODES.has(payload?.wordMode) ? payload.wordMode : "manual";
        const wordCategory = ALLOWED_CATEGORIES.has(payload?.wordCategory) ? payload.wordCategory : "any";

        const roomId = `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",
          maxPlayers,
          rounds,
          drawTimeSec,
          wordMode,
          wordCategory,
          useChoseongHint: !!payload?.useChoseongHint,
          currentRound: 0,
          currentDrawerId: null,
          currentWord: null,
          roundStartedAt: null,
          correctOrder: [],
          players: new Map(),
          playerOrder: [],
          emptyRoomTimer: null,
          roundTimer: null,
          hintTimer: null,
          createdAt: Date.now(),
        };
        drawRooms.set(roomId, room);
        drawInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}

        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        drawUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[draw] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[draw:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("draw:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = drawInvites.get(code);
        const room = roomId ? drawRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          drawUserRoom.set(me.id, roomId);
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
        drawUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[draw:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 옵션 -----
    socket.on("draw:setOptions", (payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });

      if (payload?.maxPlayers !== undefined) {
        const n = Number(payload.maxPlayers);
        if (!ALLOWED_MAX_PLAYERS.includes(n)) return cb?.({ ok: false, error: "INVALID_MAX" });
        if (n < room.players.size) return cb?.({ ok: false, error: "BELOW_CURRENT" });
        room.maxPlayers = n;
      }
      if (payload?.rounds !== undefined) {
        const n = Number(payload.rounds);
        if (!ALLOWED_ROUNDS.includes(n)) return cb?.({ ok: false, error: "INVALID_ROUNDS" });
        room.rounds = n;
      }
      if (payload?.drawTimeSec !== undefined) {
        const n = Number(payload.drawTimeSec);
        if (!ALLOWED_DRAW_TIME_SEC.includes(n)) return cb?.({ ok: false, error: "INVALID_TIME" });
        room.drawTimeSec = n;
      }
      if (payload?.wordMode !== undefined) {
        if (!ALLOWED_WORD_MODES.has(payload.wordMode)) return cb?.({ ok: false, error: "INVALID_WORD_MODE" });
        room.wordMode = payload.wordMode;
      }
      if (payload?.wordCategory !== undefined) {
        if (!ALLOWED_CATEGORIES.has(payload.wordCategory)) return cb?.({ ok: false, error: "INVALID_CATEGORY" });
        room.wordCategory = payload.wordCategory;
      }
      if (typeof payload?.useChoseongHint === "boolean") {
        room.useChoseongHint = payload.useChoseongHint;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    socket.on("draw:startGame", (_payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (room.players.size < MIN_PLAYERS_TO_START) return cb?.({ ok: false, error: "NEED_AT_LEAST_2" });

      room.status = "playing";
      room.currentRound = 0;
      for (const p of room.players.values()) {
        p.score = 0;
        p.drewThisGame = false;
      }
      // playerOrder shuffle (랜덤 출제 순서)
      room.playerOrder.sort(() => Math.random() - 0.5);

      cb?.({ ok: true });
      broadcastRoomState(io, room);
      // 즉시 첫 라운드 시작
      startRound(io, room, _supabaseRef);
    });

    // ----- 출제자가 단어 입력 -----
    socket.on("draw:submitWord", (payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.currentDrawerId !== me.id) return cb?.({ ok: false, error: "NOT_DRAWER" });
      if (room.currentWord) return cb?.({ ok: false, error: "ALREADY_STARTED" });
      const word = String(payload?.word || "").trim();
      if (word.length < MIN_WORD_LEN || word.length > MAX_WORD_LEN) {
        return cb?.({ ok: false, error: "WORD_LENGTH" });
      }
      beginDrawing(io, room, word);
      cb?.({ ok: true });
    });

    // ----- Stroke broadcast (출제자만, ~50ms throttle) -----
    // payload type: 'begin'|'point'|'end'|'clear'|'undo'|'redo'
    socket.on("draw:stroke", (payload) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return;
      if (room.currentDrawerId !== me.id) return;
      socket.to(socketRoomName(room.id)).emit("draw:stroke", payload);
    });

    // ----- 채팅/정답 -----
    socket.on("draw:chat", (payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const text = String(payload?.text || "").trim();
      if (!text) return cb?.({ ok: false, error: "EMPTY" });
      if (text.length > 30) return cb?.({ ok: false, error: "TOO_LONG" });

      // 출제자는 채팅 금지 (정답 유출 방지)
      if (room.currentDrawerId === me.id) {
        return cb?.({ ok: false, error: "DRAWER_NO_CHAT" });
      }

      // 정답 검사 — 공백/대소문자 정규화
      const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
      const isCorrect = room.currentWord && norm(text) === norm(room.currentWord);

      const sender = room.players.get(me.id);
      if (isCorrect) {
        const award = awardCorrect(room, me.id);
        if (award) {
          io.to(socketRoomName(room.id)).emit("draw:correct", {
            playerId: me.id,
            nickname: sender?.name || "?",
            avatar_url: sender?.avatar_url || null,
            rank: award.rank,
            score: award.score,
            total: award.total,
          });
          maybeAwardDrawerAndEnd(io, room);
        }
        cb?.({ ok: true, correct: true });
      } else {
        io.to(socketRoomName(room.id)).emit("draw:chat", {
          playerId: me.id,
          nickname: sender?.name || "?",
          avatar_url: sender?.avatar_url || null,
          text,
          at: Date.now(),
        });
        cb?.({ ok: true });
      }
    });

    // ----- 신고 (간단 버튼) -----
    socket.on("draw:report", async (payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      try {
        await supabaseAdmin.from("draw_reports").insert({
          room_id: room.id,
          round_no: room.currentRound,
          drawer_user_id: room.currentDrawerId || null,
          reporter_user_id: me.isGuest ? null : me.id,
          word: room.currentWord || null,
          status: "pending",
        });
        cb?.({ ok: true });
      } catch (e) {
        console.error("[draw:report] insert fail", e);
        cb?.({ ok: false, error: "INSERT_FAIL" });
      }
    });

    // ----- 자발 퇴장 -----
    socket.on("draw:leaveRoom", (_payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("draw:kickPlayer", (payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("draw:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    // ----- 상태 재요청 (재접속) -----
    socket.on("draw:requestState", (_payload, cb) => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ----- 연결 해제 -----
    socket.on("disconnect", () => {
      const roomId = drawUserRoom.get(me.id);
      const room = roomId ? drawRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      if (p.socketId !== socket.id) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id);
      } else {
        io.to(socketRoomName(room.id)).emit("draw:peerDisconnect", { playerId: me.id });
        maybeScheduleEmptyRoomDelete(io, room);
        // 출제자 disconnect 시 라운드 종료
        if (room.status === "playing" && room.currentDrawerId === me.id) {
          endRound(io, room, "DRAWER_DISCONNECT");
        }
      }
    });
  });
}
