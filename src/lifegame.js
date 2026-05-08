// =========================
// DUO GAME ZONE — 인생게임 멀티 (서버)
// 기존 worldcup/quiz/tier 멀티 시스템과 완전 격리.
// - 별도 Map(lifegameRooms)
// - 별도 invite code Map
// - 'lifegame:*' 이벤트 prefix 전용
// - socket.io room name = `lifegame:${roomId}`
// =========================

import {
  STAGES, STAGE_TURNS, STAT_DEFS, EVENTS, ENDINGS, ANALYSIS_LINES,
} from "./lifegame-data.js";

const STAT_KEYS = STAT_DEFS.map(d => d.key);

// ===== Room storage =====
const lifegameRooms = new Map();      // roomId → room
const lifegameInvites = new Map();    // inviteCode → roomId
const lifegameUserRoom = new Map();   // userId → roomId (단일 방 제약)

// ===== Constants =====
const MIN_PLAYERS = 2;
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_TURN_SECS = [5, 10, 15, 20, 30];
const RESULT_DELAY_MS = 1500;
const EMPTY_ROOM_TTL_MS = 30_000;
const TOTAL_ROUNDS = STAGES.reduce((a, s) => a + (STAGE_TURNS[s.id] || 1), 0);

// ===== Utils =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!lifegameInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function pickWeighted(items, weightFn) {
  const ws = items.map(it => Math.max(0.01, weightFn ? weightFn(it) : 1));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickByChance(outcomes) {
  const total = outcomes.reduce((a, o) => a + (o.chance || 0), 0) || 1;
  let r = Math.random() * total;
  for (const o of outcomes) {
    r -= (o.chance || 0);
    if (r <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function clampStat(key, val) {
  if (key === "money") return val;
  return Math.max(0, Math.min(100, val));
}

function newPlayerState(name, isGuest, avatarUrl) {
  const stats = {};
  for (const def of STAT_DEFS) stats[def.key] = def.initial;
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    stats,
    routes: new Set(),
    history: [],
    finished: false,
    ending: null,
    analysis: null,
  };
}

// ===== 공개용 직렬화 =====
function publicPlayer(userId, p, opts = {}) {
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    stats: { ...p.stats },
    routes: Array.from(p.routes),
    finished: p.finished,
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
    currentRoundIndex: room.currentRoundIndex,
    totalRounds: TOTAL_ROUNDS,
    currentTurnUserId: room.playerOrder[room.currentTurnPlayerIdx] || null,
    turnDeadline: room.turnDeadline,
    currentEvent: room.currentEvent
      ? publicEvent(room.currentEvent)
      : null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    stage: STAGES[room.stageIdx] || null,
  };
}

function publicEvent(ev) {
  return {
    id: ev.id,
    stage: ev.stage,
    emoji: ev.emoji,
    title: ev.title,
    desc: ev.desc,
    routeRequired: ev.routeRequired || null,
    choices: ev.choices.map(c => ({
      id: c.id,
      emoji: c.emoji,
      text: c.text,
      sub: c.sub || null,
      hasOutcomes: !!c.outcomes,
    })),
  };
}

// ===== 게임 진행 (room 단위) =====
function getStage(room) {
  return STAGES[room.stageIdx] || null;
}

function pickRoomEvent(room) {
  const stage = getStage(room);
  if (!stage) return null;
  const candidates = EVENTS.filter(ev => {
    if (ev.stage !== stage.id) return false;
    if (room.seenEventIds.has(ev.id)) return false;
    if (ev.routeRequired) {
      // 한 명이라도 해당 루트가 있으면 OK
      const anyHas = room.playerOrder.some(uid => {
        const p = room.players.get(uid);
        return p && ev.routeRequired.some(r => p.routes.has(r));
      });
      if (!anyHas) return false;
    }
    return true;
  });
  if (candidates.length === 0) {
    const fallback = EVENTS.filter(ev => ev.stage === stage.id && !ev.routeRequired);
    return fallback.length ? pickWeighted(fallback) : null;
  }
  return pickWeighted(candidates);
}

function applyChoiceForPlayer(player, event, choiceId) {
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) return null;

  let outcome = null;
  let baseEffects = choice.effects || {};
  if (choice.outcomes && choice.outcomes.length) {
    outcome = pickByChance(choice.outcomes);
  }

  // statRequired 미달 페널티
  if (choice.statRequired) {
    let met = true;
    for (const k of Object.keys(choice.statRequired)) {
      if ((player.stats[k] ?? 0) < choice.statRequired[k]) { met = false; break; }
    }
    if (!met) {
      baseEffects = { ...baseEffects };
      for (const k of Object.keys(baseEffects)) baseEffects[k] = Math.round(baseEffects[k] * 0.5);
      baseEffects.happy = (baseEffects.happy || 0) - 3;
    }
  }

  const deltas = {};
  for (const k of STAT_KEYS) deltas[k] = 0;
  for (const [k, v] of Object.entries(baseEffects)) {
    if (deltas.hasOwnProperty(k)) deltas[k] += v;
  }
  if (outcome) {
    for (const [k, v] of Object.entries(outcome.effects || {})) {
      if (deltas.hasOwnProperty(k)) deltas[k] += v;
    }
  }

  // 운 보정
  const luckBonus = (player.stats.luck - 50) / 200;
  for (const k of STAT_KEYS) {
    if (k === "luck" || k === "money") continue;
    if (deltas[k] > 0) deltas[k] = Math.round(deltas[k] * (1 + luckBonus));
  }

  for (const [k, v] of Object.entries(deltas)) {
    player.stats[k] = clampStat(k, (player.stats[k] || 0) + v);
  }

  if (choice.route) player.routes.add(choice.route);
  if (outcome?.route) player.routes.add(outcome.route);

  // narrative
  let narrative = "";
  if (outcome?.narrative) narrative = outcome.narrative;
  else if (choice.narratives && choice.narratives.length) {
    narrative = choice.narratives[Math.floor(Math.random() * choice.narratives.length)];
  } else {
    narrative = "그렇게 시간이 흘렀다.";
  }

  // grade
  let grade = choice.grade || "mid";
  if (outcome) {
    const sum = Object.values(outcome.effects || {}).reduce((a, b) => a + b, 0);
    if (sum > 30) grade = "crit";
    else if (sum < -20) grade = "bad";
  }

  player.history.push({
    eventTitle: event.title,
    eventEmoji: event.emoji,
    choiceText: choice.text,
    deltas,
    narrative,
    grade,
  });

  return { choiceId: choice.id, choiceText: choice.text, choiceEmoji: choice.emoji, deltas, narrative, grade };
}

function computeEndingFor(player) {
  const r = { has: (k) => player.routes.has(k) };
  for (const ending of ENDINGS) {
    if (ending.match(player.stats, r)) {
      player.ending = ending;
      break;
    }
  }
  if (!player.ending) player.ending = ENDINGS[ENDINGS.length - 1];

  const lines = [];
  for (const a of ANALYSIS_LINES) {
    if (a.when(player.stats, r)) lines.push(a.text);
    if (lines.length >= 4) break;
  }
  if (!lines.length) lines.push("어느 한 쪽에 치우치지 않은 균형형. 그냥저냥 살아간다.");
  player.analysis = lines;
}

function rankPlayers(room) {
  const arr = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    // 종합 점수: 돈/10 + 행복 + 지능 + 사회성 + 체력 + 인터넷력 + 운 (가중평균)
    const score = Math.round(
      (p.stats.money / 10) +
      p.stats.happy + p.stats.intel + p.stats.social +
      p.stats.power + p.stats.internet + p.stats.luck
    );
    return { userId: uid, name: p.name, avatar_url: p.avatar_url, score, stats: { ...p.stats }, ending: p.ending, analysis: p.analysis, routes: Array.from(p.routes) };
  });
  arr.sort((a, b) => b.score - a.score);

  // 카테고리별 1위 — 동률은 첫번째가 가져감
  const cats = [];
  if (arr.length) {
    const byMoney = [...arr].sort((a, b) => b.stats.money - a.stats.money)[0];
    cats.push({ key: "money", emoji: "💰", label: "돈 1위", winnerUserId: byMoney.userId, value: byMoney.stats.money });

    const byHappy = [...arr].sort((a, b) => b.stats.happy - a.stats.happy)[0];
    cats.push({ key: "happy", emoji: "❤️", label: "행복 1위", winnerUserId: byHappy.userId, value: byHappy.stats.happy });

    const byInternet = [...arr].sort((a, b) => b.stats.internet - a.stats.internet)[0];
    cats.push({ key: "internet", emoji: "🌐", label: "인터넷력 1위", winnerUserId: byInternet.userId, value: byInternet.stats.internet });

    const worst = [...arr].sort((a, b) => a.score - b.score)[0];
    cats.push({ key: "worst", emoji: "🪦", label: "가장 망한 인생", winnerUserId: worst.userId, value: worst.score });
  }

  return { ranking: arr, categories: cats };
}

// ===== 타이머 =====
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}

function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  clearTurnTimer(room);
  clearEmptyRoomTimer(room);
  lifegameRooms.delete(room.id);
  lifegameInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (lifegameUserRoom.get(uid) === room.id) lifegameUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("lifegame:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[lifegame] room ${room.id} deleted: ${reason}`);
}

function socketRoomName(roomId) { return `lifegame:${roomId}`; }

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("lifegame:roomState", publicRoom(room));
}

// ===== 게임 흐름 =====
function startNextRound(io, room) {
  if (room.status !== "playing") return;
  if (room.currentRoundIndex >= TOTAL_ROUNDS) return endGame(io, room);

  // stage 진행도 계산
  let remaining = room.currentRoundIndex;
  let stageIdx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const turns = STAGE_TURNS[STAGES[i].id] || 1;
    if (remaining < turns) { stageIdx = i; break; }
    remaining -= turns;
  }
  room.stageIdx = stageIdx;

  const event = pickRoomEvent(room);
  if (!event) {
    // 이벤트가 없으면 다음 라운드로 (또는 종료)
    room.currentRoundIndex += 1;
    return startNextRound(io, room);
  }
  room.currentEvent = event;
  room.seenEventIds.add(event.id);
  room.currentTurnPlayerIdx = 0;
  room.turnResultsThisRound = [];

  io.to(socketRoomName(room.id)).emit("lifegame:roundStart", {
    roundIndex: room.currentRoundIndex,
    totalRounds: TOTAL_ROUNDS,
    stage: STAGES[stageIdx],
    event: publicEvent(event),
  });

  startCurrentTurn(io, room);
}

function startCurrentTurn(io, room) {
  if (room.status !== "playing") return;
  // 살아있고 연결된 플레이어 찾을 때까지 인덱스 진행
  while (room.currentTurnPlayerIdx < room.playerOrder.length) {
    const uid = room.playerOrder[room.currentTurnPlayerIdx];
    const p = room.players.get(uid);
    if (p && p.connected && !p.finished) break;
    room.currentTurnPlayerIdx += 1;
  }

  if (room.currentTurnPlayerIdx >= room.playerOrder.length) {
    // 라운드 종료
    return endRound(io, room);
  }

  const turnUserId = room.playerOrder[room.currentTurnPlayerIdx];
  const turnSec = room.turnTimeSec;
  room.turnDeadline = Date.now() + turnSec * 1000;

  io.to(socketRoomName(room.id)).emit("lifegame:turnStart", {
    roundIndex: room.currentRoundIndex,
    turnUserId,
    turnSec,
    turnDeadline: room.turnDeadline,
  });

  clearTurnTimer(room);
  room.turnTimer = setTimeout(() => {
    // 시간초과 — 자동 첫번째 선택
    const ev = room.currentEvent;
    if (!ev) return;
    const firstChoice = ev.choices[0];
    submitChoice(io, room, turnUserId, firstChoice.id, /*timedOut*/ true);
  }, turnSec * 1000);
}

function submitChoice(io, room, userId, choiceId, timedOut) {
  if (room.status !== "playing") return;
  const turnUid = room.playerOrder[room.currentTurnPlayerIdx];
  if (turnUid !== userId) return;

  clearTurnTimer(room);

  const player = room.players.get(userId);
  const event = room.currentEvent;
  if (!player || !event) return;

  const result = applyChoiceForPlayer(player, event, choiceId);
  if (!result) return;

  const payload = {
    roundIndex: room.currentRoundIndex,
    userId,
    name: player.name,
    avatar_url: player.avatar_url,
    timedOut: !!timedOut,
    ...result,
    statsAfter: { ...player.stats },
    routes: Array.from(player.routes),
  };
  room.turnResultsThisRound.push(payload);
  io.to(socketRoomName(room.id)).emit("lifegame:turnResult", payload);

  // 다음 턴
  setTimeout(() => {
    if (room.status !== "playing") return;
    room.currentTurnPlayerIdx += 1;
    startCurrentTurn(io, room);
  }, RESULT_DELAY_MS);
}

function endRound(io, room) {
  io.to(socketRoomName(room.id)).emit("lifegame:roundEnd", {
    roundIndex: room.currentRoundIndex,
    results: room.turnResultsThisRound,
  });
  room.currentRoundIndex += 1;
  // 잠깐 텀 두고 다음 라운드
  setTimeout(() => startNextRound(io, room), 800);
}

function endGame(io, room) {
  room.status = "ended";
  clearTurnTimer(room);

  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p && !p.ending) {
      p.finished = true;
      computeEndingFor(p);
    }
  }

  const { ranking, categories } = rankPlayers(room);
  io.to(socketRoomName(room.id)).emit("lifegame:gameEnd", {
    ranking, categories,
    totalRounds: TOTAL_ROUNDS,
  });

  // ✅ 결과 카드 충분히 읽고 친구들이랑 얘기할 시간 (10분)
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, 10 * 60_000);
}

// ===== 핸들러 등록 =====
export function registerLifegame(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ===== createRoom =====
    socket.on("lifegame:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (lifegameUserRoom.has(me.id)) {
          // 이미 다른 방에 있으면 정리
          const old = lifegameRooms.get(lifegameUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, /*forced*/ true);
        }

        const turnSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 10;
        const maxPlayers = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(MIN_PLAYERS, Number(payload?.maxPlayers) || 6));

        const roomId = `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",  // 'lobby' | 'playing' | 'ended'
          maxPlayers,
          turnTimeSec: turnSec,
          createdAt: Date.now(),

          players: new Map(),
          playerOrder: [],

          stageIdx: 0,
          currentRoundIndex: 0,
          currentTurnPlayerIdx: 0,
          currentEvent: null,
          turnDeadline: null,
          turnTimer: null,

          seenEventIds: new Set(),
          turnResultsThisRound: [],
          emptyRoomTimer: null,
        };
        lifegameRooms.set(roomId, room);
        lifegameInvites.set(inviteCode, roomId);

        // 호스트 등록
        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname) payload = { ...(payload || {}), nickname: payload?.nickname || data.nickname };
        } catch {}

        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        room.players.set(me.id, newPlayerState(hostName, false, avatar));
        room.playerOrder.push(me.id);
        lifegameUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[lifegame] created room ${roomId} by ${me.id} (${hostName}) inv=${inviteCode}`);
      } catch (e) {
        console.error("[lifegame:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== joinRoom (by inviteCode) =====
    socket.on("lifegame:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = lifegameInvites.get(code);
        const room = roomId ? lifegameRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
        if (room.players.has(me.id)) {
          // 재접속
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          lifegameUserRoom.set(me.id, roomId);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
          broadcastRoomState(io, room);
          return;
        }

        let avatar = null;
        if (!me.isGuest) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
          } catch {}
        }
        const playerName = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);

        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar));
        room.playerOrder.push(me.id);
        lifegameUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[lifegame:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== setOptions (host only, lobby only) =====
    socket.on("lifegame:setOptions", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.turnTimeSec != null && ALLOWED_TURN_SECS.includes(Number(payload.turnTimeSec))) {
        room.turnTimeSec = Number(payload.turnTimeSec);
      }
      if (payload?.maxPlayers != null) {
        const m = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(MIN_PLAYERS, Number(payload.maxPlayers) || 6));
        if (m >= room.players.size) room.maxPlayers = m;
      }
      cb?.({ ok: true, room: publicRoom(room) });
      broadcastRoomState(io, room);
    });

    // ===== startGame (host only) =====
    socket.on("lifegame:startGame", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS" });

      room.status = "playing";
      room.currentRoundIndex = 0;
      room.seenEventIds = new Set();

      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("lifegame:gameStart", { totalRounds: TOTAL_ROUNDS });
      startNextRound(io, room);
    });

    // ===== submitChoice =====
    socket.on("lifegame:submitChoice", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });

      const turnUid = room.playerOrder[room.currentTurnPlayerIdx];
      if (turnUid !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });

      const choiceId = String(payload?.choiceId || "");
      const ev = room.currentEvent;
      if (!ev || !ev.choices.find(c => c.id === choiceId)) {
        return cb?.({ ok: false, error: "INVALID_CHOICE" });
      }

      cb?.({ ok: true });
      submitChoice(io, room, me.id, choiceId, false);
    });

    // ===== leaveRoom =====
    socket.on("lifegame:leaveRoom", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      leavePlayer(io, room, me.id, false);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    // ===== requestState (재접속/리프레시) =====
    socket.on("lifegame:requestState", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("disconnect", () => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        // 로비에서 나가면 즉시 제거
        leavePlayer(io, room, me.id, false);
      } else if (room.status === "playing") {
        // 진행 중: 현재 턴이면 자동 패스
        const turnUid = room.playerOrder[room.currentTurnPlayerIdx];
        if (turnUid === me.id) {
          const ev = room.currentEvent;
          if (ev) submitChoice(io, room, me.id, ev.choices[0].id, true);
        }
        broadcastRoomState(io, room);
        // 모두 끊기면 방 정리
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        }
      }
    });
  });
}

function leavePlayer(io, room, userId, forced) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasTurn = room.playerOrder[room.currentTurnPlayerIdx] === userId;

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (lifegameUserRoom.get(userId) === room.id) lifegameUserRoom.delete(userId);

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "EMPTY");
    return;
  }

  if (wasHost) {
    room.hostUserId = room.playerOrder[0];
  }

  if (room.status === "playing") {
    if (wasTurn) {
      // 다음 턴으로 자동 진행 (인덱스는 그대로 두고 startCurrentTurn이 알아서 skip)
      startCurrentTurn(io, room);
    }
  }
  broadcastRoomState(io, room);
}
