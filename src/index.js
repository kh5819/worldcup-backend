import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const app = express();
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true
}));

app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Supabase (토큰 검증용)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Supabase (DB 조회용 — SERVICE_ROLE_KEY 권장, 없으면 ANON_KEY 폴백)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function verify(accessToken) {
  if (!accessToken) return null;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;

  const email = data.user.email || "";
  const isAdmin = (email && process.env.ADMIN_EMAIL
    && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase())
    || (process.env.ADMIN_USER_ID && data.user.id === process.env.ADMIN_USER_ID);

  return { id: data.user.id, email, isAdmin };
}

// 방 메모리 저장
const rooms = new Map();
const GRACE_MS = 15000; // 재접속 유예: 15초
const userRoomMap = new Map(); // userId -> roomId (현재 참가 중인 방)

function buildSyncPayload(room, userId) {
  const player = room.players.get(userId);
  const remainingSec = room.roundEndsAt
    ? Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000))
    : 0;
  return {
    roomId: room.id,
    phase: room.phase || "lobby",
    roundIndex: room.roundIndex || 0,
    totalMatches: room.totalMatches || 0,
    currentMatch: room.currentMatch || null,
    content: room.content || null,
    timer: { enabled: !!room.timerEnabled, sec: room.timerSec || 0, remainingSec },
    myChoice: player?.choice || null,
    committed: room.committed.has(userId),
    scores: buildScores(room),
    isHost: room.hostUserId === userId,
    lastReveal: room.lastReveal || null
  };
}

// --- 멀티 점수제 라운드: 후보 & 브라켓 헬퍼 ---

// DB에서 콘텐츠 + 후보 로드 (visibility/권한 체크 포함)
async function loadCandidates(contentId, userId, isAdmin) {
  // 1) 콘텐츠 조회
  const { data: content, error: cErr } = await supabaseAdmin
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (cErr || !content) return { error: "CONTENT_NOT_FOUND" };
  if (content.mode !== "worldcup") return { error: "NOT_WORLDCUP" };

  // 2) 공개범위 체크
  if (content.visibility === "private") {
    if (content.owner_id !== userId && !isAdmin) {
      return { error: "NOT_ALLOWED" };
    }
  }
  // public / unlisted → contentId를 아는 사람은 허용

  // 3) 후보 조회
  const { data: rows, error: rErr } = await supabaseAdmin
    .from("worldcup_candidates")
    .select("*")
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true });

  if (rErr || !rows) return { error: "CANDIDATES_LOAD_FAILED" };
  if (rows.length < 2) return { error: "NOT_ENOUGH_CANDIDATES" };

  // 4~32개 클램프
  const clamped = rows.slice(0, 32);

  return {
    content: { id: content.id, title: content.title, visibility: content.visibility },
    candidates: clamped.map(c => ({
      name: c.name,
      mediaType: c.media_type,
      mediaUrl: c.media_url,
      startSec: c.start_sec
    }))
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initBracket(room, candidates) {
  const shuffled = shuffleArray(candidates);
  room.bracket = [...shuffled];
  room.nextBracket = [];
  room.matchIndex = 0;
  room.roundIndex = 0;
  room.scores = {};
  room.picksHistory = [];
  room.phase = "lobby";
  room.currentMatch = null;
  room.champion = null;
  room.totalMatches = candidates.length - 1;
  if (room.bracket.length % 2 !== 0) {
    room.nextBracket.push(room.bracket.pop());
  }
}

function nextMatch(room) {
  const idx = room.matchIndex;
  const candA = room.bracket[idx * 2];
  const candB = room.bracket[idx * 2 + 1];
  // 내부용: 브라켓 진행에 사용 (full candidate objects)
  room._matchCands = { A: candA, B: candB };
  // 클라이언트 전송용: A/B는 이름 문자열 유지 + 미디어 정보 추가
  room.currentMatch = {
    A: candA.name, B: candB.name,
    mediaA: { type: candA.mediaType, url: candA.mediaUrl, startSec: candA.startSec },
    mediaB: { type: candB.mediaType, url: candB.mediaUrl, startSec: candB.startSec }
  };
  return room.currentMatch;
}

function advanceBracket(room, winnerCandidate) {
  room.nextBracket.push(winnerCandidate);
  room.matchIndex++;
  if (room.matchIndex * 2 >= room.bracket.length) {
    room.bracket = [...room.nextBracket];
    room.nextBracket = [];
    room.matchIndex = 0;
    if (room.bracket.length > 1 && room.bracket.length % 2 !== 0) {
      room.nextBracket.push(room.bracket.pop());
    }
  }
  const remaining = room.bracket.length + room.nextBracket.length;
  if (remaining <= 1) {
    return { finished: true, champion: room.bracket[0] || winnerCandidate };
  }
  return { finished: false };
}

function startRoundTimer(room) {
  if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
  if (!room.timerEnabled) { room.roundEndsAt = null; return; }
  room.roundEndsAt = Date.now() + room.timerSec * 1000;
  room.roundTimer = setTimeout(() => {
    room.roundTimer = null;
    room.roundEndsAt = null;
    for (const [userId, p] of room.players.entries()) {
      if (!room.committed.has(userId)) {
        p.choice = Math.random() < 0.5 ? "A" : "B";
        room.committed.add(userId);
      }
    }
    io.to(room.id).emit("room:state", publicRoom(room));
    doReveal(room);
  }, room.timerSec * 1000);
}

function buildScores(room) {
  return Object.entries(room.scores).map(([userId, score]) => {
    const player = room.players.get(userId);
    return { userId, name: player?.name || userId.slice(0, 6), score };
  }).sort((a, b) => b.score - a.score);
}

function publicRoom(room) {
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    phase: room.phase || "lobby",
    roundIndex: room.roundIndex || 0,
    totalMatches: room.totalMatches || 0,
    currentMatch: room.currentMatch || null,
    content: room.content || null,
    players: Array.from(room.players.entries()).map(([userId, p]) => ({
      userId,
      name: p.name,
      status: room.disconnected?.has(userId) ? "재접속 대기…"
        : room.committed.has(userId) ? "선택 완료" : "선택 중…"
    }))
  };
}

// reveal 로직 (중복 방지용 함수 분리)
function doReveal(room) {
  if (room.phase !== "playing") return; // 중복 reveal 방지
  room.phase = "revealed";

  // 타이머 정리
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  room.roundEndsAt = null;

  const match = room.currentMatch;
  const picks = Array.from(room.players.entries()).map(([userId, pp]) => ({
    userId,
    name: pp.name,
    choice: pp.choice
  }));
  const aCount = picks.filter(x => x.choice === "A").length;
  const bCount = picks.filter(x => x.choice === "B").length;
  const total = Math.max(1, picks.length);

  // 다수결 승자 결정
  let roundWinner = null; // "A" or "B" or null(동점)
  if (aCount > bCount) roundWinner = "A";
  else if (bCount > aCount) roundWinner = "B";

  // 점수: 다수결 쪽을 고른 사람 +1, 동점이면 모두 0
  if (roundWinner) {
    for (const p of picks) {
      if (p.choice === roundWinner) {
        room.scores[p.userId] = (room.scores[p.userId] || 0) + 1;
      }
    }
  }

  // 브라켓 진행: 승리 후보 결정 (동점이면 랜덤)
  // _matchCands는 full candidate object, bracket 내부 진행에 사용
  const matchCands = room._matchCands;
  let winnerCand;
  if (roundWinner) {
    winnerCand = roundWinner === "A" ? matchCands.A : matchCands.B;
  } else {
    winnerCand = Math.random() < 0.5 ? matchCands.A : matchCands.B;
  }

  const result = advanceBracket(room, winnerCand);

  // 히스토리 기록 (이름 문자열로 저장)
  room.picksHistory.push({
    roundIndex: room.roundIndex,
    match,
    picks: picks.map(p => ({ userId: p.userId, name: p.name, choice: p.choice })),
    aCount, bCount, roundWinner, winningCandidate: winnerCand.name
  });

  if (result.finished) {
    room.champion = result.champion; // full candidate object
  }

  const scores = buildScores(room);

  const revealPayload = {
    picks,
    percent: {
      A: Math.round((aCount / total) * 100),
      B: Math.round((bCount / total) * 100)
    },
    roundWinner,
    winningCandidate: winnerCand.name,
    scores,
    roundIndex: room.roundIndex,
    totalMatches: room.totalMatches,
    isLastRound: result.finished
  };
  room.lastReveal = revealPayload;
  io.to(room.id).emit("worldcup:reveal", revealPayload);
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.accessToken;
    const user = await verify(token);
    if (!user) return next(new Error("UNAUTHORIZED"));
    socket.user = user;
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

io.on("connection", (socket) => {
  const me = socket.user;

  // --- 재접속 자동 복구 ---
  const prevRoomId = userRoomMap.get(me.id);
  if (prevRoomId) {
    const prevRoom = rooms.get(prevRoomId);
    if (prevRoom && prevRoom.players.has(me.id)) {
      const disc = prevRoom.disconnected?.get(me.id);
      if (disc) {
        clearTimeout(disc.timeoutId);
        prevRoom.disconnected.delete(me.id);
      }
      socket.join(prevRoomId);
      socket.emit("room:sync", buildSyncPayload(prevRoom, me.id));
      io.to(prevRoomId).emit("room:state", publicRoom(prevRoom));
    } else {
      userRoomMap.delete(me.id);
    }
  }

  socket.on("room:create", (payload, cb) => {
    const roomId = nanoid(8);
    const room = {
      id: roomId,
      hostUserId: me.id,
      contentId: payload?.contentId || null,
      players: new Map(),
      committed: new Set(),
      disconnected: new Map(),
      timerEnabled: !!payload?.timerEnabled,
      timerSec: Math.min(180, Math.max(10, Number(payload?.timerSec) || 45)),
      roundTimer: null,
      roundEndsAt: null
    };
    rooms.set(roomId, room);

    room.players.set(me.id, { name: payload?.hostName || "host" });
    socket.join(roomId);
    userRoomMap.set(me.id, roomId);

    io.to(roomId).emit("room:state", publicRoom(room));
    cb?.({ ok: true, roomId });
  });

  socket.on("room:join", (payload, cb) => {
    const roomId = payload?.roomId;
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });

    room.players.set(me.id, { name: payload?.name || "player" });
    socket.join(roomId);
    userRoomMap.set(me.id, roomId);

    io.to(roomId).emit("room:state", publicRoom(room));
    cb?.({ ok: true });
  });

  socket.on("room:leave", (payload, cb) => {
    const roomId = payload?.roomId;
    const room = rooms.get(roomId);
    if (room) {
      const disc = room.disconnected?.get(me.id);
      if (disc) { clearTimeout(disc.timeoutId); room.disconnected.delete(me.id); }
      room.players.delete(me.id);
      room.committed.delete(me.id);
      userRoomMap.delete(me.id);
      io.to(roomId).emit("room:state", publicRoom(room));
      if (room.players.size === 0) {
        if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
        rooms.delete(roomId);
      }
    }
    socket.leave(roomId);
    cb?.({ ok: true });
  });

  socket.on("room:ping", (payload) => {
    // 여기서는 데모라 아무것도 안 함(나중에 재접속 유예 넣을 자리)
  });

  socket.on("game:start", async (payload, cb) => {
    try {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });

    // 이전 타이머 정리
    if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

    // DB에서 콘텐츠 + 후보 로드
    const contentId = room.contentId;
    if (!contentId) return cb?.({ ok: false, error: "NO_CONTENT_ID" });

    const loaded = await loadCandidates(contentId, me.id, me.isAdmin);
    if (loaded.error) return cb?.({ ok: false, error: loaded.error });

    room.content = loaded.content;
    initBracket(room, loaded.candidates);

    // 첫 라운드
    room.roundIndex = 1;
    room.phase = "playing";
    room.committed.clear();
    for (const p of room.players.values()) delete p.choice;
    for (const userId of room.players.keys()) room.scores[userId] = 0;

    nextMatch(room);

    const timerInfo = { enabled: room.timerEnabled, sec: room.timerSec };
    io.to(room.id).emit("game:started", {
      roomId: room.id,
      roundIndex: room.roundIndex,
      totalMatches: room.totalMatches,
      match: room.currentMatch,
      timer: timerInfo
    });
    io.to(room.id).emit("room:state", publicRoom(room));

    startRoundTimer(room);
    cb?.({ ok: true });
    } catch (err) {
      console.error("game:start error:", err);
      cb?.({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  // 월드컵 동시선택(Commit)
  socket.on("worldcup:commit", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.phase !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });

    // 내 선택은 서버에 저장하되, 공개는 전원 완료 후에만
    const choice = payload?.choice;
    if (choice !== "A" && choice !== "B") return cb?.({ ok: false, error: "BAD_CHOICE" });

    // 선택 저장
    const p = room.players.get(me.id);
    if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
    p.choice = choice;

    // 상태 표시용 committed
    room.committed.add(me.id);

    // 상태 업데이트(누가 선택 완료인지)
    io.to(room.id).emit("room:state", publicRoom(room));
    cb?.({ ok: true });

    // 전원 완료면 결과 공개 (doReveal 내부에서 타이머 정리)
    if (room.committed.size === room.players.size) {
      doReveal(room);
    }
  });

  // 다음 라운드 (호스트만)
  socket.on("worldcup:nextRound", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
    if (room.phase !== "revealed") return cb?.({ ok: false, error: "NOT_REVEALED" });

    // 마지막 라운드였으면 game:finished
    if (room.champion) {
      room.phase = "finished";
      const scores = buildScores(room);
      io.to(room.id).emit("game:finished", {
        roomId: room.id,
        champion: room.champion?.name || room.champion,
        scores,
        picksHistory: room.picksHistory
      });
      cb?.({ ok: true, finished: true });
      return;
    }

    // 다음 라운드 진입
    room.committed.clear();
    for (const p of room.players.values()) delete p.choice;
    room.roundIndex++;
    room.phase = "playing";
    nextMatch(room);

    const timerInfo = { enabled: room.timerEnabled, sec: room.timerSec };
    io.to(room.id).emit("worldcup:round", {
      roomId: room.id,
      roundIndex: room.roundIndex,
      totalMatches: room.totalMatches,
      match: room.currentMatch,
      timer: timerInfo
    });
    io.to(room.id).emit("room:state", publicRoom(room));

    startRoundTimer(room);
    cb?.({ ok: true, finished: false });
  });

  // --- 재접속 유예: disconnect 시 즉시 제거 대신 grace 부여 ---
  socket.on("disconnect", async () => {
    const roomId = userRoomMap.get(me.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players.has(me.id)) return;

    // 같은 유저의 다른 소켓이 방에 남아 있으면 grace 불필요
    try {
      const sockets = await io.in(roomId).fetchSockets();
      if (sockets.some(s => s.user?.id === me.id)) return;
    } catch {}

    if (!room.disconnected) room.disconnected = new Map();
    const timeoutId = setTimeout(() => {
      room.disconnected.delete(me.id);
      room.players.delete(me.id);
      room.committed.delete(me.id);
      userRoomMap.delete(me.id);
      io.to(roomId).emit("room:state", publicRoom(room));
      // 남은 플레이어 전원 committed 상태면 자동 reveal
      if (room.phase === "playing" && room.players.size > 0
          && room.committed.size === room.players.size) {
        doReveal(room);
      }
      if (room.players.size === 0) {
        if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
        rooms.delete(roomId);
      }
    }, GRACE_MS);

    room.disconnected.set(me.id, { at: Date.now(), timeoutId });
    io.to(roomId).emit("room:state", publicRoom(room));
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`Backend listening on http://localhost:${process.env.PORT || 3001}`);
});
