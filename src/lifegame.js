// =========================
// DUO GAME ZONE — 인생게임 멀티 (서버) v2: 1살부터 사망까지
// 기존 worldcup/quiz/tier 멀티 시스템과 완전 격리.
// - 별도 Map(lifegameRooms) / 별도 invite code Map / 'lifegame:*' 이벤트 prefix
// - socket.io room name = `lifegame:${roomId}`
// - v2: 모두가 각자의 인생을 산다. 나이는 함께 먹고(한 해 = 한 라운드), 사건이 있는 사람만 동시에 선택.
//   코어(lifegame-core.js)·데이터는 프론트가 원본 → scripts/sync-lifegame-data.js 로 복사
// =========================

import * as LEG from "./lifegame-data.js";
import { buildLife, MINI_AGES } from "./lifegame-life-data.js";
import { createCore, MAX_AGE } from "./lifegame-core.js";

import {
  startMinigame, handleMiniAct, recheckMinigame, abortMinigame, isMinigameActive,
} from "./lifegame-minigames.js";

const core = createCore(buildLife(LEG));
const STAT_DEFS = core.STAT_DEFS;

// ===== Room storage =====
const lifegameRooms = new Map();      // roomId → room
const lifegameInvites = new Map();    // inviteCode → roomId
const lifegameUserRoom = new Map();   // userId → roomId (단일 방 제약)

// ===== Constants =====
const MIN_PLAYERS = 2;
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_TURN_SECS = [5, 10, 15, 20, 30];
const EMPTY_ROOM_TTL_MS = 30_000;
const BIRTH_MS = 7000;          // 탄생 카드 보는 시간
const YEAR_MS = 1300;           // 아무 일 없는 해
const YEAR_MS_NOTABLE = 2600;   // 운명·마일스톤·사망이 있던 해
const RESULT_HOLD_MS = 2600;    // 모두 고른 뒤 결과 보여 주는 시간
const MINI_MONEY_MUL = 20;      // 미니게임 돈 보상(구 단위) → 만원

// ===== Utils =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!lifegameInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function clampStat(key, val) {
  if (key === "money") return Math.round(val);
  return Math.max(0, Math.min(100, val));
}

function lobbyStats() {
  const s = {};
  for (const d of STAT_DEFS) s[d.key] = d.initial;
  return s;
}

function newPlayerState(name, isGuest, avatarUrl, gender) {
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    gender: gender || null, // 'M' | 'F' | 'X' | null
    joinedAt: Date.now(),
    connected: true,
    stats: lobbyStats(),    // 게임 시작 후엔 life.stats 와 같은 객체를 가리킨다(미니게임 보상이 그대로 반영)
    life: null,
    finished: false,
  };
}

function startLifeFor(p) {
  p.life = core.createPlayer(p.name, { gender: p.gender });
  p.stats = p.life.stats;
  p.finished = false;
}

// ===== 공개용 직렬화 =====
function publicLife(L) {
  if (!L) return null;
  return {
    age: L.age, alive: L.alive, deathAge: L.deathAge, cause: L.cause,
    housing: L.housing, job: L.job ? { title: L.job.title, salary: L.job.salary } : null,
    careerTitle: L.careerTitle || null, careerYears: L.careerYears,
    spouse: L.spouse ? { name: L.spouse.name, bond: L.spouse.bond, since: L.spouse.since } : null,
    kids: L.kids.map(k => ({ name: k.name, born: k.born, gender: k.gender })),
    pets: (L.pets || []).map(x => ({ kind: x.kind, breed: x.breed, name: x.name, born: x.born, startAge: x.startAge || 0, alive: x.alive, diedAt: x.diedAt ?? null })),
    birth: L.birth || null,
    flags: Array.from(L.flags),
    routes: Array.from(L.routes),
    relations: {
      romance: L.relations?.romance || null,
      friends: { ...(L.relations?.friends || {}) },
      foes: [...(L.relations?.foes || [])],
    },
    ending: L.ending && !L.alive ? endingPublic(L.ending) : null,
    titles: !L.alive ? (L.titles || []) : [],
  };
}

function endingPublic(e) {
  return e ? { id: e.id, title: e.title, emoji: e.emoji, badge: e.badge, rarity: e.rarity, quote: e.quote } : null;
}

function publicPlayer(userId, p) {
  if (!p) return null;
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    gender: p.gender || null,
    connected: p.connected,
    stats: { ...p.stats },
    finished: p.finished,
    life: publicLife(p.life),
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    v: 2,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    turnTimeSec: room.turnTimeSec,
    minigames: room.minigames !== false,
    year: room.year || 0,
    maxAge: MAX_AGE,
    miniAges: MINI_AGES,
    deadline: room.deadline || null,
    pendingUserIds: room.pending ? [...room.pending.keys()] : [],
    lastEntries: room.lastEntries || [],
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

// ===== 타이머 =====
function clearYearTimer(room) {
  if (room.yearTimer) { clearTimeout(room.yearTimer); room.yearTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
/** 게임 흐름용 지연 실행 — 게임이 바뀌면(재시작·종료) 무효 */
function later(room, fn, ms) {
  const gen = room.gen;
  clearYearTimer(room);
  room.yearTimer = setTimeout(() => {
    room.yearTimer = null;
    if (room.status !== "playing" || room.gen !== gen) return;
    fn();
  }, ms);
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  abortMinigame(room);
  clearYearTimer(room);
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
function aliveIds(room) {
  return room.playerOrder.filter(uid => room.players.get(uid)?.life?.alive);
}

function startGame(io, room) {
  abortMinigame(room);
  room.status = "playing";
  room.gen = (room.gen || 0) + 1;
  room.year = 0;
  room.pending = new Map();
  room.deadline = null;
  room.lastEntries = [];
  room.miniUsed = new Set();
  const first = {};
  const births = {};
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p) continue;
    startLifeFor(p);
    const rec = core.beginLife(p.life);
    first[uid] = rec;
    births[uid] = rec.birth;
  }
  io.to(socketRoomName(room.id)).emit("lifegame:gameStart", {
    v: 2, maxAge: MAX_AGE, miniAges: MINI_AGES, birthMs: BIRTH_MS, births,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });
  later(room, () => runYear(io, room, first), BIRTH_MS);
}

/** 한 해 진행. first = 1살(탄생 직후) 기록 */
function runYear(io, room, first = null) {
  if (room.status !== "playing") return;
  room.year += 1;
  room.pending = new Map();
  const entries = [];
  let notable = false;
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.life?.alive) continue;
    const rec = first ? first[uid] : core.advanceYear(p.life);
    if (!rec) continue;
    const e = {
      userId: uid, age: p.life.age,
      milestone: rec.milestone || null,
      quiet: rec.quiet || null,
      lines: rec.lines || [],
      lineKeys: rec.lineKeys || [],
      fate: rec.fate || null,
      net: p.life.age >= 19 && rec.economy ? rec.economy.net : null,
    };
    if (rec.milestone || rec.fate) notable = true;
    if (rec.death) {
      e.death = { age: rec.death.age, cause: rec.death.cause, ending: endingPublic(rec.death.ending) };
      p.finished = true;
      notable = true;
    } else if (rec.event) {
      e.event = core.publicEvent(p.life, rec.event);
      room.pending.set(uid, rec.event);
    }
    entries.push(e);
  }
  room.lastEntries = entries;
  const turnMs = room.turnTimeSec * 1000;
  room.deadline = room.pending.size ? Date.now() + turnMs : null;

  io.to(socketRoomName(room.id)).emit("lifegame:year", {
    year: room.year,
    entries,
    deadline: room.deadline,
    turnSec: room.turnTimeSec,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });

  // 연결 끊긴 사람의 사건은 바로 자동 선택
  for (const uid of [...room.pending.keys()]) {
    if (!room.players.get(uid)?.connected) autoPick(io, room, uid);
  }
  if (room.status !== "playing") return;
  if (!room.pending.size) {
    if (!aliveIds(room).length) return later(room, () => endGame(io, room), YEAR_MS_NOTABLE);
    return later(room, () => afterYear(io, room), notable ? YEAR_MS_NOTABLE : YEAR_MS);
  }
  later(room, () => {
    for (const uid of [...room.pending.keys()]) autoPick(io, room, uid, true);
  }, turnMs + 300);
}

function autoPick(io, room, uid, timedOut = false) {
  const p = room.players.get(uid);
  const ev = room.pending.get(uid);
  if (!p || !ev) return;
  const list = core.choicesFor(p.life, ev);
  const c = list[Math.floor(Math.random() * list.length)];
  applyPick(io, room, uid, c.id, timedOut);
}

function applyPick(io, room, uid, choiceId, timedOut) {
  const p = room.players.get(uid);
  const ev = room.pending.get(uid);
  if (!p || !ev) return false;
  const res = core.applyChoice(p.life, ev, choiceId);
  if (!res) return false;
  room.pending.delete(uid);
  if (res.death) p.finished = true;
  io.to(socketRoomName(room.id)).emit("lifegame:choiceResult", {
    year: room.year,
    userId: uid,
    name: p.name,
    timedOut: !!timedOut,
    eventId: ev.id,
    eventEmoji: ev.emoji,
    eventTitle: core.fill(p.life, ev.title),
    choiceId: res.choiceId,
    choiceText: res.choiceText,
    choiceEmoji: res.choiceEmoji,
    narrative: res.narrative,
    deltas: res.deltas,
    grade: res.grade,
    src: res.src || null,
    death: res.death ? { age: res.death.age, cause: res.death.cause, ending: endingPublic(res.death.ending) } : null,
    player: publicPlayer(uid, p),
  });
  if (!room.pending.size) {
    room.deadline = null;
    later(room, () => afterYear(io, room), RESULT_HOLD_MS);
  }
  return true;
}

function afterYear(io, room) {
  if (room.status !== "playing") return;
  const alive = aliveIds(room);
  if (!alive.length) return endGame(io, room);
  if (room.minigames !== false && MINI_AGES.includes(room.year)) {
    const started = startMinigame({
      room,
      emit: (ev, payload) => io.to(socketRoomName(room.id)).emit(ev, payload),
      clampStat,
      eligible: (uid) => !!room.players.get(uid)?.life?.alive,
      minPlayers: 1,
      moneyMul: MINI_MONEY_MUL,
      onFinish: () => {
        if (room.status !== "playing") return;
        broadcastRoomState(io, room);
        runYear(io, room);
      },
    });
    if (started) return;
  }
  runYear(io, room);
}

function rankPlayers(room) {
  const arr = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    const L = p.life;
    if (L && !L.ending) core.computeEnding(L);
    const highlights = (L?.history || []).filter(h => h.grade === "crit" || h.grade === "bad" || h.fate || /결혼|아기|프러포즈|첫 직장|입영|수능|투병|손주|이혼/.test(h.eventTitle || "")).slice(-10)
      .map(h => ({ age: h.age, emoji: h.eventEmoji, title: h.eventTitle, choice: h.choiceText, grade: h.grade, src: h.src || null }));
    return {
      userId: uid,
      name: p.name,
      avatar_url: p.avatar_url,
      gender: p.gender || null,
      score: L ? core.lifeScore(L) : 0,
      stats: { ...p.stats },
      ending: endingPublic(L?.ending),
      titles: L?.titles || [],
      analysis: L?.analysis || [],
      analysisKeys: L?.analysisKeys || null,
      life: publicLife(L),
      highlights,
    };
  });
  arr.sort((a, b) => b.score - a.score);

  const cats = [];
  if (arr.length) {
    const top = (f, asc) => [...arr].sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a))[0];
    const age = r => r.life?.deathAge ?? r.life?.age ?? 0;
    const a1 = top(age);
    cats.push({ key: "age", emoji: "🐢", label: "최장수", winnerUserId: a1.userId, value: `${age(a1)}세` });
    const m1 = top(r => r.stats.money);
    cats.push({ key: "money", emoji: "💰", label: "최고 부자", winnerUserId: m1.userId, value: m1.stats.money, money: true });
    const h1 = top(r => r.stats.happy);
    cats.push({ key: "happy", emoji: "❤️", label: "가장 행복", winnerUserId: h1.userId, value: h1.stats.happy });
    const k1 = top(r => r.life?.kids?.length || 0);
    if ((k1.life?.kids?.length || 0) > 0) cats.push({ key: "family", emoji: "👨‍👩‍👧", label: "대가족", winnerUserId: k1.userId, value: `자녀 ${k1.life.kids.length}명` });
    const w = top(r => r.score, true);
    cats.push({ key: "worst", emoji: "🪦", label: "가장 파란만장", winnerUserId: w.userId, value: w.score });
  }
  return { ranking: arr, categories: cats };
}

function endGame(io, room) {
  if (room.status !== "playing") return;
  room.status = "ended";
  room.gen = (room.gen || 0) + 1;
  abortMinigame(room);
  clearYearTimer(room);
  room.pending = new Map();
  room.deadline = null;

  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p?.life?.alive) core.die(p.life, "natural");      // 안전망(최대 나이 도달 등)
    if (p) p.finished = true;
  }

  const { ranking, categories } = rankPlayers(room);
  io.to(socketRoomName(room.id)).emit("lifegame:gameEnd", { v: 2, ranking, categories, years: room.year });

  // 결과 카드 충분히 읽고 친구들이랑 얘기할 시간 (10분)
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
          const old = lifegameRooms.get(lifegameUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, /*forced*/ true);
        }

        const turnSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 15;
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
          minigames: true,
          createdAt: Date.now(),

          players: new Map(),
          playerOrder: [],

          gen: 0,
          year: 0,
          pending: new Map(),
          deadline: null,
          lastEntries: [],
          yearTimer: null,
          emptyRoomTimer: null,
        };
        lifegameRooms.set(roomId, room);
        lifegameInvites.set(inviteCode, roomId);

        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname) payload = { ...(payload || {}), nickname: payload?.nickname || data.nickname };
        } catch {}

        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        const hostGender = ["M", "F", "X"].includes(payload?.gender) ? payload.gender : "X";
        room.players.set(me.id, newPlayerState(hostName, false, avatar, hostGender));
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
        if (room.players.has(me.id)) {
          // 재접속
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          lifegameUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), myEvent: myPendingEvent(room, me.id) });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        let avatar = null;
        if (!me.isGuest) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
          } catch {}
        }
        const playerName = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);
        const joinGender = ["M", "F", "X"].includes(payload?.gender) ? payload.gender : "X";

        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar, joinGender));
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
      if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.turnTimeSec != null && ALLOWED_TURN_SECS.includes(Number(payload.turnTimeSec))) {
        room.turnTimeSec = Number(payload.turnTimeSec);
      }
      if (payload?.minigames != null) room.minigames = !!payload.minigames;
      if (payload?.maxPlayers != null) {
        const m = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(MIN_PLAYERS, Number(payload.maxPlayers) || 6));
        if (m >= room.players.size) room.maxPlayers = m;
      }
      cb?.({ ok: true, room: publicRoom(room) });
      broadcastRoomState(io, room);
    });

    // ===== setGender (lobby, 본인) =====
    socket.on("lifegame:setGender", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      const p = room?.players.get(me.id);
      if (!room || !p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      if (["M", "F", "X"].includes(payload?.gender)) p.gender = payload.gender;
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== startGame (host only) =====
    socket.on("lifegame:startGame", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS" });

      cb?.({ ok: true });
      startGame(io, room);
    });

    // ===== submitChoice =====
    socket.on("lifegame:submitChoice", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const ev = room.pending.get(me.id);
      if (!ev) return cb?.({ ok: false, error: "NO_PENDING_EVENT" });
      const choiceId = String(payload?.choiceId || "");
      const p = room.players.get(me.id);
      if (!core.choicesFor(p.life, ev).some(c => c.id === choiceId)) return cb?.({ ok: false, error: "INVALID_CHOICE" });
      const ok = applyPick(io, room, me.id, choiceId, false);
      cb?.({ ok });
    });

    // ===== miniAct (미니게임 입력) =====
    socket.on("lifegame:miniAct", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false });
      cb?.({ ok: handleMiniAct(room, me.id, payload) });
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

    socket.on("lifegame:kickPlayer", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      io.to(socketRoomName(room.id)).emit("lifegame:kicked", { userId: targetId, reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId, false);
      cb?.({ ok: true });
    });

    // ===== requestState (재접속/리프레시) =====
    socket.on("lifegame:requestState", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const p = room.players.get(me.id);
      if (p) p.connected = true;
      socket.join(socketRoomName(room.id));
      clearEmptyRoomTimer(room);
      cb?.({ ok: true, room: publicRoom(room), myEvent: myPendingEvent(room, me.id) });
    });

    socket.on("disconnect", () => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id, false);
      } else if (room.status === "playing") {
        // 내 사건이 남아 있으면 자동 선택(다른 사람이 기다리지 않게)
        if (room.pending?.has(me.id)) autoPick(io, room, me.id, true);
        if (isMinigameActive(room)) recheckMinigame(room);
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

function myPendingEvent(room, uid) {
  const ev = room.pending?.get(uid);
  const p = room.players.get(uid);
  return ev && p?.life ? { year: room.year, deadline: room.deadline, event: core.publicEvent(p.life, ev) } : null;
}

function leavePlayer(io, room, userId, forced) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const hadPending = room.pending?.has(userId);

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
    if (isMinigameActive(room)) recheckMinigame(room);
    if (hadPending) {
      room.pending.delete(userId);
      if (!room.pending.size) { room.deadline = null; later(room, () => afterYear(io, room), RESULT_HOLD_MS); }
    }
    if (!aliveIds(room).length && !isMinigameActive(room)) later(room, () => endGame(io, room), 800);
  }
  broadcastRoomState(io, room);
}

// 시험용
export const __lifegameTest = { core, lifegameRooms, runYear, afterYear, rankPlayers };
