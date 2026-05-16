// =========================
// 지켜라 (DUO Gacha TD) — 멀티 타워디펜스 클리어 모드 서버
// 핵심: 각 플레이어 자기 라인 (필러 시뮬은 클라이언트), 보스만 공유 HP (서버 권위)
// 클리어 조건: 보스 10종 다 잡으면 팀 승리. 전원 라이프 0 = 실패.
// 이벤트 prefix: 'gt:*', socket room name: `gt:${roomId}`
// =========================

const gtRooms = new Map();
const gtInvites = new Map();
const gtUserRoom = new Map();

const ALLOWED_MAX_PLAYERS = [2, 4, 6, 8];
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;

// 보스 정의 (HP만 — 시각은 클라이언트가)
const BOSS_DATA = {
  berserker:    { hp: 2000, name: '광전사', emoji: '⚔️' },
  giant:        { hp: 4800, name: '거탑',   emoji: '🏔️' },
  summoner:     { hp: 2200, name: '소환사', emoji: '🧙' },
  phantom:      { hp: 1900, name: '환영',   emoji: '👻' },
  aoeking:      { hp: 2600, name: '광역왕', emoji: '🌋' },
  shieldbearer: { hp: 2000, name: '방패병', emoji: '🛡️' },
  splitter:     { hp: 2400, name: '분열체', emoji: '🦠' },
  timelord:     { hp: 2300, name: '시간왕', emoji: '🌀' },
  vampire:      { hp: 2400, name: '흡혈귀', emoji: '🦇' },
  mahwang:      { hp: 5500, name: '마왕',   emoji: '👹' },
};

const WAVE_AUTO_INTERVAL_MS = 30_000;    // 다음 웨이브 자동 시작 (30초)
const BOSS_TIMEOUT_MS_BASE = 30_000;     // 보스 등장 후 본진 도달 가정 시간 (30초)
const BOSS_RESPAWN_DELAY_WAVES = 5;      // 미스 보스 재등장 (5웨이브 후)

function getBossHpScale(wave) {
  // 1차 사이클 (wave 1~50): 초반 부드럽게, 중반부터 가파르게
  // wave 5=0.25, 25=1.0, 50=3.0 — 솔로와 동일한 곡선
  if (wave <= 50) {
    const keyByStep = [0.25, 0.35, 0.55, 0.75, 1.0, 1.3, 1.6, 2.0, 2.5, 3.0];
    const step = Math.floor((wave - 1) / 5);
    if (step <= 0) return keyByStep[0];
    if (step >= 9) return keyByStep[9];
    return keyByStep[step];
  }
  // 2차+ 사이클: wave 50의 3.0 베이스 + 50 단위마다 +1.5
  const cycle = Math.floor((wave - 1) / 50);
  return 3.0 + cycle * 1.5;
}

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!gtInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `gt:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
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
    // 게임 상태
    lives: 10,
    alive: true,
    bossDamage: 0,   // 누적 보스 데미지
    kills: 0,
    elapsedMs: 0,
  };
}

function publicPlayer(userId, p) {
  return {
    playerId: userId,
    nickname: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    lives: p.lives,
    alive: p.alive,
    bossDamage: p.bossDamage,
    kills: p.kills,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status, // 'lobby' | 'playing' | 'ended'
    maxPlayers: room.maxPlayers,
    startedAt: room.startedAt || null,
    endedAt: room.endedAt || null,
    // 게임 진행 상태
    wave: room.wave || 0,
    bossOrder: room.bossOrder || [],
    killedBossKeys: Array.from(room.killedBossKeys || []),
    bossHp: room.bossHp || 0,
    bossMaxHp: room.bossMaxHp || 0,
    bossKey: room.currentBossKey || null,
    players: room.playerOrder.map((uid) => publicPlayer(uid, room.players.get(uid))),
  };
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("gt:roomState", publicRoom(room));
}

function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  gtRooms.delete(room.id);
  gtInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (gtUserRoom.get(uid) === room.id) gtUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("gt:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[gachatd] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter((p) => p.connected).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = gtRooms.get(room.id);
      if (!r) return;
      const stillEmpty = [...r.players.values()].every((p) => !p.connected);
      if (stillEmpty) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (gtUserRoom.get(userId) === room.id) gtUserRoom.delete(userId);
  if (wasHost && room.playerOrder.length > 0) room.hostUserId = room.playerOrder[0];
  io.to(socketRoomName(room.id)).emit("gt:peerLeave", { playerId: userId });
  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "ALL_LEFT");
    return;
  }
  broadcastRoomState(io, room);
}

// =========================
// 웨이브 / 보스 관리
// =========================
function scheduleNextWave(io, room, delayMs) {
  if (room.waveTimerId) { clearTimeout(room.waveTimerId); room.waveTimerId = null; }
  if (room.status !== "playing") return;
  const startAt = Date.now() + delayMs;
  io.to(socketRoomName(room.id)).emit("gt:nextWaveCountdown", {
    nextWave: room.wave + 1,
    startAt,
    delayMs,
  });
  room.waveTimerId = setTimeout(() => {
    room.waveTimerId = null;
    if (room.status !== "playing") return;
    startWave(io, room);
  }, delayMs);
}

function startWave(io, room) {
  if (room.status !== "playing") return;
  if (room.waveTimerId) { clearTimeout(room.waveTimerId); room.waveTimerId = null; }

  room.wave += 1;
  const wave = room.wave;

  // 보스 키 결정
  let bossKey = null;
  if (wave % 5 === 0) {
    const bossIdx = ((wave / 5) - 1) % 10;
    bossKey = room.bossOrder[bossIdx] || 'berserker';
  }
  // 미스 보스 재등장 (다음 보스 슬롯에)
  const dueMissed = room.missedBosses.filter((m) => m.dueWave === wave);
  room.missedBosses = room.missedBosses.filter((m) => m.dueWave !== wave);

  // 이번 웨이브에 처음으로 등장할 보스 (정규 + 미스 중 첫번째)
  // 단순화: 정규 보스 우선, 없으면 미스 첫번째, 나머지 미스는 다시 큐로
  const primaryBossKey = bossKey || (dueMissed.length ? dueMissed.shift().bossKey : null);
  // 남은 미스는 다음 사이클에 재등장
  for (const m of dueMissed) {
    room.missedBosses.push({ bossKey: m.bossKey, dueWave: wave + BOSS_RESPAWN_DELAY_WAVES });
  }

  io.to(socketRoomName(room.id)).emit("gt:waveStart", {
    wave,
    hasBoss: !!primaryBossKey,
    bossKey: primaryBossKey,
  });

  // 보스 등장 시간 (필러 처리 후 약 8초 뒤 보스 등장)
  if (primaryBossKey) {
    setTimeout(() => spawnBoss(io, room, primaryBossKey), 8_000);
  } else {
    // 보스 없는 웨이브 — 필러만 (약 20초 후 자동 다음 웨이브)
    scheduleNextWave(io, room, 20_000);
  }

  room.wave = wave;
  broadcastRoomState(io, room);
}

function spawnBoss(io, room, bossKey) {
  if (room.status !== "playing") return;
  const data = BOSS_DATA[bossKey];
  if (!data) return;
  const hpScale = getBossHpScale(room.wave);
  // 인원수 따라 추가 스케일 (협동이라 더 강한 보스)
  const playerCount = [...room.players.values()].filter((p) => p.alive).length || 1;
  const playerScale = 0.5 + playerCount * 0.5; // 1인=1, 2인=1.5, 4인=2.5, 8인=4.5
  const finalHp = Math.floor(data.hp * hpScale * playerScale);

  room.currentBoss = {
    bossKey,
    hp: finalHp,
    maxHp: finalHp,
    alive: true,
    spawnedAt: Date.now(),
    lastHpEmit: 0,
  };
  room.currentBossKey = bossKey;
  room.bossHp = finalHp;
  room.bossMaxHp = finalHp;

  io.to(socketRoomName(room.id)).emit("gt:bossSpawn", {
    bossKey,
    bossName: data.name,
    bossEmoji: data.emoji,
    hp: finalHp,
    maxHp: finalHp,
  });
  broadcastRoomState(io, room);

  // 보스 timeout — 시간 내 못 잡으면 미스
  if (room.bossTimerId) clearTimeout(room.bossTimerId);
  const timeoutMs = BOSS_TIMEOUT_MS_BASE + (room.wave - 5) * 200; // 웨이브 깊을수록 약간 길게
  room.bossTimerId = setTimeout(() => handleBossMissed(io, room), timeoutMs);
}

function handleBossMissed(io, room) {
  if (room.status !== "playing") return;
  const boss = room.currentBoss;
  if (!boss || !boss.alive) return;
  boss.alive = false;
  if (room.bossTimerId) { clearTimeout(room.bossTimerId); room.bossTimerId = null; }
  // 미스 처리 — 5웨이브 뒤 재등장 예약
  room.missedBosses.push({ bossKey: boss.bossKey, dueWave: room.wave + BOSS_RESPAWN_DELAY_WAVES });
  io.to(socketRoomName(room.id)).emit("gt:bossMissed", {
    bossKey: boss.bossKey,
    dueWave: room.wave + BOSS_RESPAWN_DELAY_WAVES,
  });
  // 모든 살아있는 플레이어 라이프 -3 (보스가 본진 도달 가정)
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    p.lives = Math.max(0, p.lives - 3);
    if (p.lives <= 0) {
      p.alive = false;
      io.to(socketRoomName(room.id)).emit("gt:playerEliminated", { playerId: getKeyByPlayer(room, p) });
    }
  }
  const anyAlive = [...room.players.values()].some((pp) => pp.alive);
  if (!anyAlive) {
    finishGame(io, room, 'defeat');
    return;
  }
  broadcastRoomState(io, room);
  room.currentBoss = null;
  scheduleNextWave(io, room, 5_000);
}

function getKeyByPlayer(room, target) {
  for (const [k, v] of room.players.entries()) {
    if (v === target) return k;
  }
  return null;
}

function finishGame(io, room, result) {
  if (room.status === 'ended') return;
  room.status = 'ended';
  room.endedAt = Date.now();
  if (room.bossTimerId) { clearTimeout(room.bossTimerId); room.bossTimerId = null; }
  if (room.waveTimerId) { clearTimeout(room.waveTimerId); room.waveTimerId = null; }

  // 랭킹 — bossDamage 내림차순
  const ranking = room.playerOrder.map((uid) => {
    const p = room.players.get(uid);
    if (!p) return null;
    return {
      playerId: uid,
      nickname: p.name,
      lives: p.lives,
      bossDamage: p.bossDamage || 0,
      kills: p.kills || 0,
      alive: p.alive,
    };
  }).filter(Boolean);
  ranking.sort((a, b) => (b.bossDamage || 0) - (a.bossDamage || 0));

  io.to(socketRoomName(room.id)).emit("gt:gameEnded", {
    result, // 'victory' | 'defeat'
    wave: room.wave,
    killedBosses: Array.from(room.killedBossKeys),
    ranking,
  });
  broadcastRoomState(io, room);
  console.log(`[gachatd] game ended ${room.id} result=${result} wave=${room.wave}`);
}

// =========================
// 등록
// =========================
export function registerGachatd(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ----- 방 만들기 (로그인 유저만) -----
    socket.on("gt:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (gtUserRoom.has(me.id)) {
          const old = gtRooms.get(gtUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id);
        }
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 4;

        const roomId = `gt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", maxPlayers,
          createdAt: Date.now(), startedAt: null, endedAt: null,
          players: new Map(), playerOrder: [],
          emptyRoomTimer: null,
          // 게임 진행 상태
          wave: 0,
          bossOrder: [],
          killedBossKeys: new Set(),
          missedBosses: [],
          currentBossKey: null,
          bossHp: 0,
          bossMaxHp: 0,
        };
        gtRooms.set(roomId, room);
        gtInvites.set(inviteCode, roomId);

        let avatar = null, nick = payload?.nickname;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
        room.players.set(me.id, newPlayerState(nick || "방장", false, avatar, socket.id));
        room.playerOrder.push(me.id);
        gtUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[gachatd] created room ${roomId} by ${me.id} inv=${inviteCode}`);
      } catch (e) {
        console.error("[gt:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 입장 -----
    socket.on("gt:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = gtInvites.get(code);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          gtUserRoom.set(me.id, roomId);
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
        room.players.set(me.id, newPlayerState(nick || (me.isGuest ? "게스트" : "유저"), me.isGuest, avatar, socket.id));
        room.playerOrder.push(me.id);
        gtUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[gachatd] join room ${roomId} by ${me.id}`);
      } catch (e) {
        console.error("[gt:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 방 나가기 -----
    socket.on("gt:leaveRoom", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (room) {
          leavePlayer(io, room, me.id);
          socket.leave(socketRoomName(room.id));
        }
        cb?.({ ok: true });
      } catch (e) {
        console.error("[gt:leaveRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트: 최대인원 변경 -----
    socket.on("gt:setMaxPlayers", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
        if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
        const maxP = Number(payload?.maxPlayers);
        if (!ALLOWED_MAX_PLAYERS.includes(maxP)) return cb?.({ ok: false, error: "INVALID_MAX" });
        if (maxP < room.players.size) return cb?.({ ok: false, error: "TOO_MANY_PLAYERS" });
        room.maxPlayers = maxP;
        cb?.({ ok: true });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[gt:setMaxPlayers]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 게임 시작 (호스트) ----
    socket.on("gt:startGame", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
        if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
        if (room.players.size < 2) return cb?.({ ok: false, error: "NEED_2_OR_MORE" });

        // 보스 순서 셔플
        const REGULAR_BOSSES = ['berserker', 'giant', 'summoner', 'phantom', 'aoeking',
                                'shieldbearer', 'splitter', 'timelord', 'vampire'];
        const shuffled = [...REGULAR_BOSSES];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        room.bossOrder = [...shuffled, 'mahwang'];

        room.status = "playing";
        room.startedAt = Date.now();
        room.wave = 0;
        room.killedBossKeys = new Set();
        room.missedBosses = [];
        room.currentBoss = null;
        room.bossTimerId = null;
        room.waveTimerId = null;

        // 모든 플레이어 게임 상태 리셋
        for (const p of room.players.values()) {
          p.lives = 10;
          p.alive = true;
          p.bossDamage = 0;
          p.kills = 0;
        }

        cb?.({ ok: true });
        io.to(socketRoomName(room.id)).emit("gt:gameStarted", {
          bossOrder: room.bossOrder,
          maxPlayers: room.maxPlayers,
        });
        broadcastRoomState(io, room);
        console.log(`[gachatd] game started ${room.id} (${room.players.size}p)`);

        // 첫 웨이브 자동 시작 카운트다운 (10초 후)
        scheduleNextWave(io, room, 10_000);
      } catch (e) {
        console.error("[gt:startGame]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 호스트 수동 웨이브 시작 -----
    socket.on("gt:requestWaveStart", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
        if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
        if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
        startWave(io, room);
        cb?.({ ok: true });
      } catch (e) {
        console.error("[gt:requestWaveStart]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ----- 보스 데미지 (각 클라이언트가 자기 유닛으로 보스에 데미지 줄 때마다) -----
    socket.on("gt:dealBossDamage", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room || room.status !== "playing") return;
        const boss = room.currentBoss;
        if (!boss || !boss.alive) return;
        const dmg = Math.max(0, Math.min(50000, Number(payload?.dmg) || 0));
        if (dmg <= 0) return;
        boss.hp = Math.max(0, boss.hp - dmg);
        // 플레이어 기여도 추적
        const p = room.players.get(me.id);
        if (p) p.bossDamage += dmg;

        if (boss.hp <= 0 && boss.alive) {
          // 보스 처치
          boss.alive = false;
          room.killedBossKeys.add(boss.bossKey);
          if (room.bossTimerId) { clearTimeout(room.bossTimerId); room.bossTimerId = null; }
          io.to(socketRoomName(room.id)).emit("gt:bossKilled", {
            bossKey: boss.bossKey,
            killedBy: me.id,
            totalKilled: room.killedBossKeys.size,
          });
          broadcastRoomState(io, room);

          // 클리어 체크
          if (room.killedBossKeys.size >= 10) {
            finishGame(io, room, 'victory');
            return;
          }

          // 다음 보스/웨이브 카운트다운
          room.currentBoss = null;
          scheduleNextWave(io, room, 5_000); // 5초 후 다음 웨이브
        } else {
          // HP 업데이트 broadcast (너무 자주 보내지 않게 throttle)
          const now = Date.now();
          if (!boss.lastHpEmit || now - boss.lastHpEmit > 150) {
            boss.lastHpEmit = now;
            io.to(socketRoomName(room.id)).emit("gt:bossUpdate", {
              hp: Math.ceil(boss.hp),
              maxHp: Math.ceil(boss.maxHp),
            });
          }
        }
      } catch (e) {
        console.error("[gt:dealBossDamage]", e);
      }
    });

    // ----- 본진 도달 (라이프 손실) -----
    socket.on("gt:lifeLost", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room || room.status !== "playing") return;
        const p = room.players.get(me.id);
        if (!p || !p.alive) return;
        const dmg = Math.max(1, Math.min(10, Number(payload?.dmg) || 1));
        p.lives = Math.max(0, p.lives - dmg);
        if (p.lives <= 0) {
          p.alive = false;
          io.to(socketRoomName(room.id)).emit("gt:playerEliminated", { playerId: me.id });
          // 전원 탈락 체크
          const anyAlive = [...room.players.values()].some((pp) => pp.alive);
          if (!anyAlive) {
            finishGame(io, room, 'defeat');
            return;
          }
        }
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[gt:lifeLost]", e);
      }
    });

    // ----- 플레이어 snapshot relay (관전용) -----
    socket.on("gt:peerSnapshot", (payload) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room || room.status !== "playing") return;
        // 본인 제외 broadcast — 데이터 검증은 가볍게
        const snap = payload?.snapshot;
        if (!snap || typeof snap !== "object") return;
        socket.to(socketRoomName(room.id)).emit("gt:peerSnapshot", {
          playerId: me.id,
          snapshot: snap,
        });
      } catch (e) {
        // silent — snapshot 실패는 게임에 영향 X
      }
    });

    // ----- 보스 본진 도달 (해당 라인 player가 알림) — 미스 처리 -----
    socket.on("gt:bossMissedSelf", (payload, cb) => {
      try {
        const roomId = gtUserRoom.get(me.id);
        const room = roomId ? gtRooms.get(roomId) : null;
        if (!room || room.status !== "playing") return;
        const boss = room.currentBoss;
        if (!boss || !boss.alive) return;
        // 서버가 직접 미스 처리 (각자 클라이언트가 신고해도 동일 로직)
        handleBossMissed(io, room);
      } catch (e) {
        console.error("[gt:bossMissedSelf]", e);
      }
    });

    // ----- disconnect -----
    socket.on("disconnect", () => {
      const roomId = gtUserRoom.get(me.id);
      const room = roomId ? gtRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;
      io.to(socketRoomName(room.id)).emit("gt:peerDisconnect", { playerId: me.id });
      maybeScheduleEmptyRoomDelete(io, room);
      broadcastRoomState(io, room);
    });
  });

  console.log("[gachatd] socket handlers registered");
}
