// =========================
// DUO GAME ZONE — 보드파티 (서버) v20260515_1 Phase 1
// 기존 게임들과 완전 격리. bp:* 이벤트 prefix.
// 이번 Phase: 룸 + 주사위 + 이동 + 칸 효과 베이스 (coin/minus/safe만 동작)
// 아이템/이벤트/벌칙은 Phase 2~5에서 추가
// =========================

import { TILES, BOARD_TOTAL, BOARD_GRID_N, publicBoard, getTile } from "./boardparty-board.js";
import { pickRandomEvent, publicEventList } from "./boardparty-events.js";
import { ITEMS, buildItemDeck, getItem, publicItemList } from "./boardparty-items.js";
import { PENALTIES, PENALTY_CATEGORIES, DEFAULT_PENALTY_KINDS, pickPenalty, publicPenaltyList } from "./boardparty-penalties.js";
import { MINIGAMES, pickRandomMinigame, computeReactionResult, computeGuessResult, computeClickResult, computeNunchiResult, publicMinigameList } from "./boardparty-minigames.js";

// ===== Room storage =====
const bpRooms = new Map();
const bpInvites = new Map();
const bpUserRoom = new Map();

// ===== Modes (카드게임과 동일 구조 — 처음부터 8인) =====
const ALLOWED_MODES = ["1v1", "2v2", "3v3", "4v4", "2v2v2", "2v2v2v2", "ffa8"];
const MODE_INFO = {
  "1v1":     { players: 2, teams: 2, perTeam: 1 },
  "2v2":     { players: 4, teams: 2, perTeam: 2 },
  "3v3":     { players: 6, teams: 2, perTeam: 3 },
  "4v4":     { players: 8, teams: 2, perTeam: 4 },
  "2v2v2":   { players: 6, teams: 3, perTeam: 2 },
  "2v2v2v2": { players: 8, teams: 4, perTeam: 2 },
  "ffa8":    { players: 8, teams: 0, perTeam: null, min: 2 },
};

// ===== 옵션 기본/허용값 =====
const ALLOWED_TURN_SECS = [10, 15, 20, 30, 45, 60, 90, 120];
const ALLOWED_TARGET_COINS = [20, 30, 40, 50];
const ALLOWED_MAX_ROUNDS = [6, 8, 10, 12, 15, 20];
const ALLOWED_EVENT_INTENSITY = ["mild", "normal", "chaos"];
const EVENT_EVERY_N_TURNS = { mild: 8, normal: 5, chaos: 3 };

const DEFAULT_TURN_SEC = 30;
const DEFAULT_TARGET_COINS = 30;
const DEFAULT_MAX_ROUNDS = 12;
const DEFAULT_START_COINS = 10;
const DICE_MIN = 1, DICE_MAX = 6;
const MAX_ITEMS = 5; // 손패 최대치

const EMPTY_ROOM_TTL_MS = 30_000;
const ENDED_ROOM_TTL_MS = 10 * 60_000;

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#facc15"];
const TEAM_LABELS = ["A", "B", "C", "D"];

// ===== Utils =====
function socketRoomName(roomId) { return `bp:${roomId}`; }
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!bpInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function modeMaxPlayers(mode) { return MODE_INFO[mode]?.players || 2; }
function modeMinPlayers(mode) {
  const i = MODE_INFO[mode];
  return i?.min ?? i?.players ?? 2;
}
function modeTeamCount(mode) { return MODE_INFO[mode]?.teams || 0; }
function modePerTeam(mode) { return MODE_INFO[mode]?.perTeam || null; }

function assignTeams(room) {
  const info = MODE_INFO[room.mode];
  if (!info) return;
  const order = room.playerOrder;
  if (info.teams === 0) {
    order.forEach((uid, i) => { const p = room.players.get(uid); if (p) p.team = i; });
  } else {
    order.forEach((uid, i) => { const p = room.players.get(uid); if (p) p.team = i % info.teams; });
  }
}

// ===== Player state =====
function newPlayerState(name, isGuest, avatarUrl) {
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    team: 0,
    pos: 0,
    coins: DEFAULT_START_COINS,
    items: [],
    statuses: {},
    penaltyHits: 0,
    finished: false,
    stats: makeEmptyStats(),
  };
}
function makeEmptyStats() {
  return {
    diceRolls: [],         // [3, 5, 1, ...]
    coinHistory: [DEFAULT_START_COINS],  // 라운드별 코인 snapshot
    totalMoves: 0,         // 누적 이동 칸 수
    coinGained: 0,         // 누적 +코인 (이벤트/아이템/칸 합산)
    coinLost: 0,           // 누적 -코인
    maxCoins: DEFAULT_START_COINS,
    minCoins: DEFAULT_START_COINS,
    bombsHit: 0,           // 폭탄 밟은 횟수
    bombsPlanted: 0,       // 폭탄 설치 횟수
    itemsUsed: 0,          // 아이템 사용
    eventsAffected: 0,     // 이벤트로 영향 받은 횟수
    jailedTurns: 0,        // 감옥 당한 횟수
    stoleFrom: 0,          // 강탈한 코인 누적
    stolenFrom: 0,         // 강탈당한 코인 누적
    timesDownTo0: 0,       // 코인 0 도달 횟수
  };
}

// ===== Public serialization =====
function publicPlayer(uid, p) {
  return {
    userId: uid, name: p.name, isGuest: p.isGuest, avatar_url: p.avatar_url || null,
    connected: p.connected, team: p.team,
    pos: p.pos, coins: p.coins,
    itemCount: p.items?.length || 0,
    statuses: { ...p.statuses },
    penaltyHits: p.penaltyHits || 0,
  };
}
function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    mode: room.mode,
    maxPlayers: room.maxPlayers,
    teamColors: TEAM_COLORS,
    options: { ...room.options },
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    currentTurnUserId: room.status === "playing" ? (room.playerOrder[room.currentTurnIdx] || null) : null,
    turnDeadline: room.turnDeadline,
    turnNumber: room.turnNumber,
    round: room.round,
    winnerTeam: room.winnerTeam,
    winnerUserId: room.winnerUserId,
    pendingDice: room.pendingDice || null,
    bombs: Array.from(room.bombs?.entries?.() || []).map(([tileIdx, b]) => ({ tileIdx, ownerUid: b.ownerUid })),
  };
}

// ===== Timers / room lifecycle =====
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function deleteRoom(io, room, reason = "UNKNOWN") {
  clearTurnTimer(room);
  clearEmptyRoomTimer(room);
  bpRooms.delete(room.id);
  bpInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) if (bpUserRoom.get(uid) === room.id) bpUserRoom.delete(uid);
  io.to(socketRoomName(room.id)).emit("bp:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[bp] room ${room.id} deleted: ${reason}`);
}
function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("bp:roomState", publicRoom(room));
}

// ===== Win condition =====
function checkWinCondition(io, room) {
  // 목표 코인 도달자 있으면 즉시 종료
  const winners = [];
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p && p.coins >= room.options.targetCoins) winners.push({ uid, coins: p.coins });
  }
  if (winners.length > 0) {
    winners.sort((a, b) => b.coins - a.coins);
    return finishGame(io, room, winners[0].uid);
  }
  // 최대 라운드 도달 시 최다 코인 우승
  if (room.round > room.options.maxRound) {
    return finishGameByRound(io, room);
  }
  return false;
}
function finishGameByRound(io, room) {
  let best = null;
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!best || p.coins > best.coins) best = { uid, coins: p.coins };
  }
  return finishGame(io, room, best?.uid || null);
}
function finishGame(io, room, winnerUid) {
  room.status = "ended";
  clearTurnTimer(room);
  const winP = winnerUid ? room.players.get(winnerUid) : null;
  if (modeTeamCount(room.mode) > 0 && winP) {
    room.winnerTeam = winP.team;
    room.winnerUserId = winnerUid;
  } else {
    room.winnerTeam = null;
    room.winnerUserId = winnerUid;
  }
  // 꼴지
  let loserUid = null;
  let minCoins = Infinity;
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p && p.coins < minCoins) { minCoins = p.coins; loserUid = uid; }
  }

  // 최종 stats snapshot
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.stats) continue;
    // 마지막 coinHistory 추가 (라운드 안 끝나도)
    if (p.stats.coinHistory[p.stats.coinHistory.length - 1] !== p.coins) {
      p.stats.coinHistory.push(p.coins);
    }
  }

  // 어워드 계산
  const awards = computeAwards(room);

  // 플레이어 + stats 페이로드
  const playersWithStats = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    return { ...publicPlayer(uid, p), stats: p.stats };
  });

  io.to(socketRoomName(room.id)).emit("bp:gameEnd", {
    winnerTeam: room.winnerTeam,
    winnerUserId: room.winnerUserId,
    loserUserId: loserUid,
    mode: room.mode,
    players: playersWithStats,
    awards,
    totalRounds: room.round,
  });
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, ENDED_ROOM_TTL_MS);
  return true;
}

// ===== Awards 계산 =====
function computeAwards(room) {
  const players = room.playerOrder.map(uid => ({ uid, p: room.players.get(uid) })).filter(x => x.p);
  if (players.length === 0) return [];
  const awards = [];

  // 🏆 MVP — winner 또는 최고 코인
  let mvp = null;
  if (room.winnerUserId) mvp = players.find(x => x.uid === room.winnerUserId);
  else {
    mvp = players.slice().sort((a, b) => b.p.coins - a.p.coins)[0];
  }
  if (mvp) awards.push({ id: "mvp", emoji: "🏆", title: "MVP", userId: mvp.uid, detail: `${mvp.p.coins} 코인` });

  // 🎲 행운왕 — 평균 주사위 가장 높음
  const diceAvgs = players.map(x => {
    const arr = x.p.stats?.diceRolls || [];
    const avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    return { uid: x.uid, name: x.p.name, avg, count: arr.length };
  }).filter(x => x.count >= 3);
  diceAvgs.sort((a, b) => b.avg - a.avg);
  if (diceAvgs.length > 0 && diceAvgs[0].avg >= 3.8) {
    awards.push({ id: "lucky", emoji: "🎲", title: "행운왕", userId: diceAvgs[0].uid, detail: `주사위 평균 ${diceAvgs[0].avg.toFixed(1)}` });
  }

  // 💸 불운왕 — 평균 주사위 가장 낮음
  if (diceAvgs.length > 0 && diceAvgs[diceAvgs.length - 1].avg <= 3.2) {
    const u = diceAvgs[diceAvgs.length - 1];
    awards.push({ id: "unlucky", emoji: "💸", title: "불운왕", userId: u.uid, detail: `주사위 평균 ${u.avg.toFixed(1)}` });
  }

  // 💣 폭탄러 — 폭탄 가장 많이 밟음
  const bombMax = players.slice().sort((a, b) => (b.p.stats?.bombsHit || 0) - (a.p.stats?.bombsHit || 0))[0];
  if (bombMax && bombMax.p.stats?.bombsHit >= 1) {
    awards.push({ id: "bomb", emoji: "💣", title: "폭탄러", userId: bombMax.uid, detail: `폭탄 ${bombMax.p.stats.bombsHit}회 피격` });
  }

  // 🎴 아이템왕 — 아이템 가장 많이 사용
  const itemMax = players.slice().sort((a, b) => (b.p.stats?.itemsUsed || 0) - (a.p.stats?.itemsUsed || 0))[0];
  if (itemMax && itemMax.p.stats?.itemsUsed >= 3) {
    awards.push({ id: "item", emoji: "🎴", title: "아이템왕", userId: itemMax.uid, detail: `${itemMax.p.stats.itemsUsed}장 사용` });
  }

  // 🦹 강도왕 — 강탈한 코인 가장 많음
  const stealMax = players.slice().sort((a, b) => (b.p.stats?.stoleFrom || 0) - (a.p.stats?.stoleFrom || 0))[0];
  if (stealMax && stealMax.p.stats?.stoleFrom >= 3) {
    awards.push({ id: "robber", emoji: "🦹", title: "강도왕", userId: stealMax.uid, detail: `${stealMax.p.stats.stoleFrom} 코인 강탈` });
  }

  // 📈 부자왕 — 최고 코인 가장 높음
  const richMax = players.slice().sort((a, b) => (b.p.stats?.maxCoins || 0) - (a.p.stats?.maxCoins || 0))[0];
  if (richMax) {
    awards.push({ id: "rich", emoji: "📈", title: "최고 부자", userId: richMax.uid, detail: `최고 ${richMax.p.stats?.maxCoins || 0} 코인` });
  }

  // 📉 빈털터리 — 코인 0 도달 횟수
  const downMax = players.slice().sort((a, b) => (b.p.stats?.timesDownTo0 || 0) - (a.p.stats?.timesDownTo0 || 0))[0];
  if (downMax && downMax.p.stats?.timesDownTo0 >= 1) {
    awards.push({ id: "broke", emoji: "📉", title: "빈털터리", userId: downMax.uid, detail: `코인 0 ${downMax.p.stats.timesDownTo0}회` });
  }

  // ⛓️ 감옥왕 — 감옥 가장 많이
  const jailMax = players.slice().sort((a, b) => (b.p.stats?.jailedTurns || 0) - (a.p.stats?.jailedTurns || 0))[0];
  if (jailMax && jailMax.p.stats?.jailedTurns >= 1) {
    awards.push({ id: "jail", emoji: "⛓️", title: "감옥왕", userId: jailMax.uid, detail: `감옥 ${jailMax.p.stats.jailedTurns}회` });
  }

  // 🌪️ 방랑자 — 가장 많이 이동
  const moveMax = players.slice().sort((a, b) => (b.p.stats?.totalMoves || 0) - (a.p.stats?.totalMoves || 0))[0];
  if (moveMax) {
    awards.push({ id: "wanderer", emoji: "🌪️", title: "방랑자", userId: moveMax.uid, detail: `${moveMax.p.stats?.totalMoves || 0}칸 이동` });
  }

  return awards;
}

// ===== Event ctx (이벤트 핸들러가 사용) =====
function makeEventCtx(io, room) {
  return {
    alivePlayers: () => room.playerOrder
      .map(uid => ({ userId: uid, ...room.players.get(uid) }))
      .filter(p => p && p.connected),
    shuffle: shuffleArr,
    isTeamMode: () => modeTeamCount(room.mode) > 0,
    gainCoin: (uid, n) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.coins = Math.max(0, p.coins + Math.max(0, Math.floor(n)));
    },
    damageCoin: (uid, n) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.coins = Math.max(0, p.coins - Math.max(0, Math.floor(n)));
    },
    movePlayer: (uid, delta) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.pos = ((p.pos + delta) % BOARD_TOTAL + BOARD_TOTAL) % BOARD_TOTAL;
    },
    teleportPlayer: (uid, pos) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.pos = ((pos % BOARD_TOTAL) + BOARD_TOTAL) % BOARD_TOTAL;
    },
    swapPositions: (uidA, uidB) => {
      const a = room.players.get(uidA), b = room.players.get(uidB);
      if (!a || !b) return;
      const tmp = a.pos; a.pos = b.pos; b.pos = tmp;
    },
    applyStatus: (uid, st) => {
      const p = room.players.get(uid);
      if (!p) return;
      for (const k of Object.keys(st)) {
        p.statuses[k] = Math.max(p.statuses[k] || 0, st[k]);
      }
    },
    shuffleTeams: () => {
      const tc = modeTeamCount(room.mode);
      if (tc === 0) return;
      const uids = room.playerOrder.slice();
      shuffleArr(uids);
      // round-robin 배정
      uids.forEach((uid, i) => {
        const p = room.players.get(uid);
        if (p) p.team = i % tc;
      });
    },
  };
}

// 이벤트 발동 (칸 도착 / 자동 N턴마다)
function fireEvent(io, room, triggerUserId, source) {
  const intensity = room.options?.eventIntensity || "normal";
  const ev = pickRandomEvent(intensity);
  if (!ev) return;
  const ctx = makeEventCtx(io, room);
  let result;
  try {
    result = ev.apply(ctx);
  } catch (e) {
    console.error("[bp:event apply error]", ev.id, e);
    result = { affected: [], msg: "(이벤트 처리 실패)" };
  }
  // affected 카운트
  for (const uid of (result?.affected || [])) {
    const ap = room.players.get(uid);
    if (ap?.stats) ap.stats.eventsAffected += 1;
  }
  io.to(socketRoomName(room.id)).emit("bp:event", {
    id: ev.id,
    emoji: ev.emoji,
    title: ev.title,
    desc: ev.desc,
    rarity: ev.rarity,
    source,
    triggerUserId: triggerUserId || null,
    affected: result?.affected || [],
    msg: result?.msg || "",
  });
}

// ===== Item helpers =====
function drawItemFor(room, userId) {
  const p = room.players.get(userId);
  if (!p) return null;
  if (p.items.length >= MAX_ITEMS) return null;
  if (room.itemDeck.length === 0) {
    if (room.itemDiscard.length === 0) return null;
    room.itemDeck = shuffleArr(room.itemDiscard.slice());
    room.itemDiscard = [];
  }
  const id = room.itemDeck.shift();
  p.items.push(id);
  return id;
}
function discardItem(room, itemId) { room.itemDiscard.push(itemId); }

function sendItemsTo(io, room, userId) {
  const p = room.players.get(userId);
  if (!p) return;
  const sockets = io.sockets.adapter.rooms.get(socketRoomName(room.id));
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.user?.id === userId) {
      s.emit("bp:hand", { userId, items: p.items.slice() });
    }
  }
}

// 음수 효과 처리 시 shield/mirror 검사 (외부 데미지 적용 전)
// 반환: { absorbed: true } / { reflectTo: uidA } / null (정상 진행)
function consumeDefenseStatus(room, victimUid, attackerUid) {
  const p = room.players.get(victimUid);
  if (!p) return null;
  if (p.statuses?.mirror) {
    p.statuses.mirror -= 1;
    if (p.statuses.mirror <= 0) delete p.statuses.mirror;
    return { reflectTo: attackerUid || null };
  }
  if (p.statuses?.shield) {
    p.statuses.shield -= 1;
    if (p.statuses.shield <= 0) delete p.statuses.shield;
    return { absorbed: true };
  }
  return null;
}

// ===== Tile effects =====
function applyTileEffect(io, room, userId) {
  const p = room.players.get(userId);
  if (!p) return;
  const tile = getTile(p.pos);
  const payload = { userId, tileIdx: p.pos, tileKind: tile.kind, emoji: tile.emoji, label: tile.label, delta: {} };
  switch (tile.kind) {
    case "coin": {
      const d = tile.payload?.coin || 0;
      p.coins = Math.max(0, p.coins + d);
      if (p.stats) {
        p.stats.coinGained += Math.max(0, d);
        if (p.coins > p.stats.maxCoins) p.stats.maxCoins = p.coins;
      }
      payload.delta.coins = d;
      break;
    }
    case "minus": {
      const def = consumeDefenseStatus(room, userId, null);
      if (def?.absorbed) {
        payload.delta.absorbed = true;
        payload.delta.coins = 0;
      } else {
        const d = tile.payload?.coin || 0;
        const before = p.coins;
        p.coins = Math.max(0, p.coins + d);
        const lost = before - p.coins;
        if (p.stats) {
          p.stats.coinLost += lost;
          if (p.coins < p.stats.minCoins) p.stats.minCoins = p.coins;
          if (p.coins === 0 && before > 0) p.stats.timesDownTo0 += 1;
        }
        payload.delta.coins = d;
      }
      break;
    }
    case "penalty": {
      p.penaltyHits = (p.penaltyHits || 0) + 1;
      payload.delta.penaltyHits = 1;
      break;
    }
    case "item": {
      // 아이템 칸 도착 → 카드 1장 드로우
      const drawnId = drawItemFor(room, userId);
      payload.delta.drawnItem = drawnId || null;
      io.to(socketRoomName(room.id)).emit("bp:tileEffect", payload);
      sendItemsTo(io, room, userId);
      return;
    }
    case "event": {
      io.to(socketRoomName(room.id)).emit("bp:tileEffect", payload);
      fireEvent(io, room, userId, "tile");
      return;
    }
    case "mini": {
      io.to(socketRoomName(room.id)).emit("bp:tileEffect", payload);
      // 미니게임 시작 — 보드 일시 정지
      startMinigame(io, room, userId);
      return;
    }
    case "safe":
    case "start":
    default:
      break;
  }
  io.to(socketRoomName(room.id)).emit("bp:tileEffect", payload);

  // 폭탄 체크: 도착 칸에 폭탄 있으면 발동 (coin/minus/penalty 같이 적용된 후)
  const bomb = room.bombs.get(p.pos);
  if (bomb && bomb.ownerUid !== userId) {
    const def = consumeDefenseStatus(room, userId, bomb.ownerUid);
    if (def?.absorbed) {
      io.to(socketRoomName(room.id)).emit("bp:bombTrigger", { userId, tileIdx: p.pos, absorbed: true, ownerUid: bomb.ownerUid });
    } else if (def?.reflectTo) {
      const owner = room.players.get(def.reflectTo);
      if (owner) owner.coins = Math.max(0, owner.coins - bomb.damage);
      io.to(socketRoomName(room.id)).emit("bp:bombTrigger", { userId, tileIdx: p.pos, reflectedTo: def.reflectTo, damage: bomb.damage });
    } else {
      const before = p.coins;
      p.coins = Math.max(0, p.coins - bomb.damage);
      const lost = before - p.coins;
      if (p.stats) {
        p.stats.coinLost += lost;
        p.stats.bombsHit += 1;
        if (p.coins < p.stats.minCoins) p.stats.minCoins = p.coins;
        if (p.coins === 0 && before > 0) p.stats.timesDownTo0 += 1;
      }
      io.to(socketRoomName(room.id)).emit("bp:bombTrigger", { userId, tileIdx: p.pos, damage: bomb.damage, ownerUid: bomb.ownerUid });
    }
    room.bombs.delete(p.pos);
  }
}

// ===== Turn flow =====
function advanceTurn(room) {
  const N = room.playerOrder.length;
  for (let i = 0; i < N; i++) {
    room.currentTurnIdx = (room.currentTurnIdx + 1) % N;
    if (room.currentTurnIdx === 0) {
      room.round += 1;
      // 라운드 끝: 모든 플레이어 코인 snapshot
      for (const uid of room.playerOrder) {
        const p = room.players.get(uid);
        if (p?.stats) p.stats.coinHistory.push(p.coins);
      }
    }
    const uid = room.playerOrder[room.currentTurnIdx];
    const p = room.players.get(uid);
    if (p && p.connected) return uid;
  }
  return null;
}

function startTurn(io, room) {
  if (room.status !== "playing") return;
  if (checkWinCondition(io, room)) return;
  const turnUid = room.playerOrder[room.currentTurnIdx];
  const turnP = room.players.get(turnUid);
  if (!turnP || !turnP.connected) {
    advanceTurn(room);
    return startTurn(io, room);
  }

  // jailed 상태이상: 다음 턴 스킵
  if (turnP.statuses?.jailed) {
    turnP.statuses.jailed -= 1;
    if (turnP.statuses.jailed <= 0) delete turnP.statuses.jailed;
    if (turnP.stats) turnP.stats.jailedTurns += 1;
    io.to(socketRoomName(room.id)).emit("bp:turnStart", {
      turnUserId: turnUid,
      turnNumber: room.turnNumber + 1,
      round: room.round,
      turnDeadline: Date.now() + 1500,
      skipped: true,
      reason: "jailed",
    });
    broadcastRoomState(io, room);
    setTimeout(() => {
      if (room.status !== "playing") return;
      if (room.playerOrder[room.currentTurnIdx] !== turnUid) return;
      advanceTurn(room);
      room.pendingDice = null;
      startTurn(io, room);
    }, 1500);
    return;
  }

  room.turnNumber += 1;
  room.pendingDice = null;

  // 매 N턴마다 자동 랜덤 이벤트 (자기 칸 효과 전에 발동)
  const everyN = EVENT_EVERY_N_TURNS[room.options?.eventIntensity || "normal"] || 5;
  if (room.turnNumber > 1 && (room.turnNumber % everyN) === 0) {
    fireEvent(io, room, turnUid, "auto");
  }

  room.turnDeadline = Date.now() + room.options.turnSec * 1000;
  io.to(socketRoomName(room.id)).emit("bp:turnStart", {
    turnUserId: turnUid,
    turnNumber: room.turnNumber,
    round: room.round,
    turnDeadline: room.turnDeadline,
  });
  broadcastRoomState(io, room);
  clearTurnTimer(room);
  room.turnTimer = setTimeout(() => {
    if (room.status !== "playing") return;
    if (room.playerOrder[room.currentTurnIdx] !== turnUid) return;
    autoRollDice(io, room, turnUid);
  }, room.options.turnSec * 1000);
}

async function autoRollDice(io, room, userId) {
  await performRoll(io, room, userId, true);
}

async function performRoll(io, room, userId, isAuto = false) {
  if (room.status !== "playing") return { ok: false, error: "NOT_PLAYING" };
  if (room.playerOrder[room.currentTurnIdx] !== userId) return { ok: false, error: "NOT_YOUR_TURN" };
  if (room.pendingDice) return { ok: false, error: "ALREADY_ROLLED" };

  const p = room.players.get(userId);
  if (!p) return { ok: false, error: "NOT_IN_ROOM" };
  let value = DICE_MIN + Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1));
  // diceFixed 우선
  if (p.statuses?.diceFixed) {
    value = p.statuses.diceFixed;
    delete p.statuses.diceFixed;
  } else if (p.statuses?.diceBoost) {
    value = Math.min(DICE_MAX + 3, value + p.statuses.diceBoost);
    delete p.statuses.diceBoost;
  }
  room.pendingDice = value;
  if (p.stats) {
    p.stats.diceRolls.push(value);
    p.stats.totalMoves += value;
  }

  clearTurnTimer(room);

  // bp:rollAnnounce (애니메이션 시작)
  io.to(socketRoomName(room.id)).emit("bp:rollAnnounce", { userId, auto: isAuto });
  // 600ms 애니 후 결과
  await new Promise(r => setTimeout(r, 600));
  io.to(socketRoomName(room.id)).emit("bp:rollResult", { userId, value });

  // 순차 이동 (240ms씩)
  const from = p.pos;
  for (let i = 0; i < value; i++) {
    if (room.status !== "playing") return { ok: false, error: "NOT_PLAYING" };
    p.pos = (p.pos + 1) % BOARD_TOTAL;
    io.to(socketRoomName(room.id)).emit("bp:move", { userId, from, to: p.pos, step: i + 1, total: value });
    broadcastRoomState(io, room);
    await new Promise(r => setTimeout(r, 240));
  }

  // 칸 효과
  applyTileEffect(io, room, userId);
  broadcastRoomState(io, room);

  // 승리 검사
  if (checkWinCondition(io, room)) return { ok: true };

  // extraRoll status가 있으면 다시 굴림 (이번 턴 1회만)
  if (p.statuses?.extraRoll && !room.extraRollUsed) {
    room.extraRollUsed = true;
    delete p.statuses.extraRoll;
    room.pendingDice = null;
    setTimeout(() => {
      if (room.status !== "playing") return;
      if (room.playerOrder[room.currentTurnIdx] !== userId) return;
      io.to(socketRoomName(room.id)).emit("bp:extraRoll", { userId });
    }, 700);
    return { ok: true };
  }

  // 턴 종료 → 다음 턴 (잠시 대기)
  setTimeout(() => {
    if (room.status !== "playing") return;
    advanceTurn(room);
    room.pendingDice = null;
    room.extraRollUsed = false;
    startTurn(io, room);
  }, 700);

  return { ok: true };
}

// ===== Use Item =====
function tryUseItem(io, room, userId, itemId, targetUserId) {
  if (room.status !== "playing") return { ok: false, error: "NOT_PLAYING" };
  if (room.playerOrder[room.currentTurnIdx] !== userId) return { ok: false, error: "NOT_YOUR_TURN" };
  const p = room.players.get(userId);
  if (!p) return { ok: false, error: "NOT_IN_ROOM" };
  const idx = p.items.indexOf(itemId);
  if (idx < 0) return { ok: false, error: "NOT_IN_HAND" };
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "UNKNOWN_ITEM" };

  // 타겟 검증
  let targetP = targetUserId ? room.players.get(targetUserId) : null;
  if (item.targeting === "enemy") {
    if (!targetP) return { ok: false, error: "INVALID_TARGET" };
    if (targetUserId === userId) return { ok: false, error: "TARGET_NOT_ENEMY" };
    if (modeTeamCount(room.mode) > 0 && targetP.team === p.team) return { ok: false, error: "TARGET_NOT_ENEMY" };
  } else if (item.targeting === "ally") {
    if (!targetP) return { ok: false, error: "INVALID_TARGET" };
    if (modeTeamCount(room.mode) > 0) {
      if (targetP.team !== p.team) return { ok: false, error: "TARGET_NOT_ALLY" };
    } else {
      if (targetUserId !== userId) return { ok: false, error: "TARGET_NOT_SELF" };
    }
  } else if (item.targeting === "any") {
    if (!targetP) return { ok: false, error: "INVALID_TARGET" };
  } else if (item.targeting === "self") {
    targetUserId = userId; targetP = p;
  }

  // 손패에서 제거
  p.items.splice(idx, 1);
  discardItem(room, itemId);
  if (p.stats) p.stats.itemsUsed += 1;

  // 효과 적용
  const ef = item.effect || {};
  const eventCtx = makeEventCtx(io, room);
  if (ef.gainSelf) p.coins += ef.gainSelf;
  if (ef.gainTeam) {
    const isTeam = modeTeamCount(room.mode) > 0;
    if (isTeam) {
      for (const uid of room.playerOrder) {
        const pp = room.players.get(uid);
        if (!pp || pp.team !== p.team) continue;
        pp.coins += ef.gainTeam;
      }
    } else {
      p.coins += ef.gainTeam;
    }
  }
  if (ef.damageTarget && targetP) {
    const def = consumeDefenseStatus(room, targetUserId, userId);
    if (def?.absorbed) { /* 무효 */ }
    else if (def?.reflectTo) {
      const refP = room.players.get(def.reflectTo);
      if (refP) refP.coins = Math.max(0, refP.coins - ef.damageTarget);
    } else {
      targetP.coins = Math.max(0, targetP.coins - ef.damageTarget);
    }
  }
  if (ef.stealFromTarget && targetP) {
    const def = consumeDefenseStatus(room, targetUserId, userId);
    if (def?.absorbed) { /* 무효 — 자기 이득도 없음 */ }
    else if (def?.reflectTo) {
      const refP = room.players.get(def.reflectTo);
      if (refP) refP.coins = Math.max(0, refP.coins - ef.stealFromTarget);
    } else {
      const taken = Math.min(targetP.coins, ef.stealFromTarget);
      targetP.coins -= taken;
      p.coins += taken;
      if (p.stats) p.stats.stoleFrom += taken;
      if (targetP.stats) targetP.stats.stolenFrom += taken;
    }
  }
  if (ef.moveSelf != null) eventCtx.movePlayer(userId, ef.moveSelf);
  if (ef.teleportSelf === "start") eventCtx.teleportPlayer(userId, 0);
  if (ef.diceBoost) p.statuses.diceBoost = ef.diceBoost;
  if (ef.diceFixed) p.statuses.diceFixed = ef.diceFixed;
  if (ef.extraRoll) p.statuses.extraRoll = 1;
  if (ef.shield) p.statuses.shield = ef.shield;
  if (ef.mirror) p.statuses.mirror = ef.mirror;
  if (ef.swapPosition && targetP) eventCtx.swapPositions(userId, targetUserId);
  if (ef.plantBomb) {
    room.bombs.set(p.pos, { ownerUid: userId, damage: ef.plantBomb.damage || 5 });
    if (p.stats) p.stats.bombsPlanted += 1;
  }
  if (ef.nuke) {
    p.coins = Math.max(0, p.coins - (ef.nuke.selfDmg || 0));
    for (const uid of room.playerOrder) {
      if (uid === userId) continue;
      const def = consumeDefenseStatus(room, uid, userId);
      if (def?.absorbed) continue;
      const pp = room.players.get(uid);
      if (pp) pp.coins = Math.max(0, pp.coins - (ef.nuke.others || 0));
    }
  }

  io.to(socketRoomName(room.id)).emit("bp:itemUsed", {
    userId, itemId, targetUserId: targetUserId || null,
    emoji: item.emoji, name: item.name, rarity: item.rarity,
  });
  sendItemsTo(io, room, userId);
  broadcastRoomState(io, room);
  checkWinCondition(io, room);
  return { ok: true };
}

// ===== Minigame =====
function startMinigame(io, room, triggerUserId) {
  // 턴 타이머 일시 중지 (advanceTurn은 미니게임 종료 후)
  clearTurnTimer(room);
  const mg = pickRandomMinigame();
  const startedAt = Date.now();

  room.minigame = {
    kind: mg.id,
    startedAt,
    deadline: startedAt + mg.duration + 2000,  // 여유
    submissions: new Map(),
    triggerUserId,
    params: {},
    timer: null,
    finished: false,
  };

  // 게임별 초기 파라미터
  if (mg.id === "reaction") {
    // 1.5~4초 후 GO 신호
    const goDelay = 1500 + Math.floor(Math.random() * 2500);
    room.minigame.goAt = startedAt + goDelay;
  } else if (mg.id === "guess") {
    room.minigame.params.secret = 1 + Math.floor(Math.random() * 100);
  } else if (mg.id === "click") {
    room.minigame.params.windowMs = 3000;
  } else if (mg.id === "nunchi") {
    const alivePlayers = room.playerOrder
      .map(uid => ({ uid, p: room.players.get(uid) }))
      .filter(x => x.p && x.p.connected);
    room.minigame.params.targetN = alivePlayers.length;
    room.minigame.params.currentNum = 0;     // 마지막 외친 번호 (이거 +1을 다음에 외쳐야)
    room.minigame.params.lastClaimers = [];  // 동시 외침 후보 (윈도우 내)
    room.minigame.params.eliminated = [];    // 탈락 순서
    room.minigame.params.windowMs = 250;
    room.minigame.params.claimWindowTimer = null;
  }

  io.to(socketRoomName(room.id)).emit("bp:minigameStart", {
    kind: mg.id,
    name: mg.name,
    emoji: mg.emoji,
    desc: mg.desc,
    duration: mg.duration,
    startedAt,
    params: publicMinigameParams(room.minigame),
  });

  // 최대 시간 후 강제 종료
  room.minigame.timer = setTimeout(() => endMinigame(io, room, "TIMEOUT"), mg.duration + 1500);

  // 반응속도 GO 신호 송출
  if (mg.id === "reaction") {
    const delay = room.minigame.goAt - Date.now();
    setTimeout(() => {
      if (!room.minigame || room.minigame.kind !== "reaction" || room.minigame.finished) return;
      io.to(socketRoomName(room.id)).emit("bp:minigameSignal", { kind: "reaction", what: "go", ts: Date.now() });
    }, Math.max(0, delay));
  }
  // click: 0.7초 카운트다운 후 시작 신호
  if (mg.id === "click") {
    setTimeout(() => {
      if (!room.minigame || room.minigame.finished) return;
      io.to(socketRoomName(room.id)).emit("bp:minigameSignal", { kind: "click", what: "go", ts: Date.now(), endsAt: Date.now() + 3000 });
      // 3초 후 자동 마감
      setTimeout(() => {
        if (!room.minigame || room.minigame.kind !== "click" || room.minigame.finished) return;
        endMinigame(io, room, "CLICK_DONE");
      }, 3000);
    }, 700);
  }
  // nunchi: 즉시 진행
  // guess: 즉시 진행
}

function publicMinigameParams(mg) {
  if (!mg) return null;
  const out = { ...(mg.params || {}) };
  delete out.secret;          // 비밀 숫자는 클라에 안 보냄
  delete out.lastClaimers;
  delete out.claimWindowTimer;
  return out;
}

function alivePlayersInRoom(room) {
  return room.playerOrder.map(uid => room.players.get(uid)).filter(p => p && p.connected);
}

function handleMinigameSubmit(io, room, userId, payload) {
  const mg = room.minigame;
  if (!mg || mg.finished) return { ok: false, error: "NO_MINIGAME" };
  const players = alivePlayersInRoom(room);
  if (!players.find(p => p === room.players.get(userId))) return { ok: false, error: "NOT_ALIVE" };

  if (mg.kind === "reaction") {
    const now = Date.now();
    if (mg.submissions.has(userId)) return { ok: false, error: "ALREADY_SUBMITTED" };
    const goAt = mg.goAt || 0;
    if (now < goAt) {
      // 빨강일 때 클릭 = 페널티
      mg.submissions.set(userId, { foul: true, ts: now });
    } else {
      mg.submissions.set(userId, { ts: now });
    }
    // 모두 제출했으면 즉시 종료
    if (mg.submissions.size >= players.length) endMinigame(io, room, "ALL_SUBMITTED");
    return { ok: true };
  }
  if (mg.kind === "guess") {
    const v = Math.max(1, Math.min(100, Math.floor(Number(payload?.value) || 0)));
    mg.submissions.set(userId, { value: v });
    if (mg.submissions.size >= players.length) endMinigame(io, room, "ALL_SUBMITTED");
    return { ok: true };
  }
  if (mg.kind === "click") {
    const count = Math.max(0, Math.min(999, Math.floor(Number(payload?.count) || 0)));
    mg.submissions.set(userId, { count });
    if (mg.submissions.size >= players.length) endMinigame(io, room, "ALL_SUBMITTED");
    return { ok: true };
  }
  if (mg.kind === "nunchi") {
    if (mg.params.eliminated.includes(userId)) return { ok: false, error: "ELIMINATED" };
    const claimed = Number(payload?.number);
    const expected = (mg.params.currentNum || 0) + 1;
    if (claimed !== expected) return { ok: false, error: "WRONG_NUMBER" };
    // 외침 윈도우에 추가
    mg.params.lastClaimers.push(userId);
    // 윈도우 처리: 첫 외침이면 250ms 타이머 시작
    if (mg.params.lastClaimers.length === 1) {
      if (mg.params.claimWindowTimer) clearTimeout(mg.params.claimWindowTimer);
      mg.params.claimWindowTimer = setTimeout(() => resolveNunchiWindow(io, room), mg.params.windowMs);
    }
    return { ok: true };
  }
  return { ok: false, error: "UNKNOWN_KIND" };
}

function resolveNunchiWindow(io, room) {
  const mg = room.minigame;
  if (!mg || mg.finished || mg.kind !== "nunchi") return;
  const claimers = mg.params.lastClaimers.slice();
  mg.params.lastClaimers = [];
  mg.params.claimWindowTimer = null;
  if (claimers.length === 0) return;

  if (claimers.length === 1) {
    // 단독 성공
    mg.params.currentNum += 1;
    const uid = claimers[0];
    io.to(socketRoomName(room.id)).emit("bp:minigameSignal", {
      kind: "nunchi", what: "claimed",
      number: mg.params.currentNum, userId: uid,
    });
    // 목표 도달 시 종료
    if (mg.params.currentNum >= mg.params.targetN) {
      endMinigame(io, room, "NUNCHI_COMPLETE");
    }
  } else {
    // 동시 외침 = 다 탈락
    for (const uid of claimers) {
      if (!mg.params.eliminated.includes(uid)) mg.params.eliminated.push(uid);
    }
    io.to(socketRoomName(room.id)).emit("bp:minigameSignal", {
      kind: "nunchi", what: "collision",
      number: mg.params.currentNum + 1,
      userIds: claimers,
    });
    // 생존자가 1명 이하면 종료
    const players = alivePlayersInRoom(room);
    const alive = players.filter(p => !mg.params.eliminated.includes(p.userId));
    if (alive.length <= 1) endMinigame(io, room, "NUNCHI_ENDED");
  }
}

function endMinigame(io, room, reason) {
  const mg = room.minigame;
  if (!mg || mg.finished) return;
  mg.finished = true;
  if (mg.timer) clearTimeout(mg.timer);
  if (mg.params?.claimWindowTimer) clearTimeout(mg.params.claimWindowTimer);

  const players = alivePlayersInRoom(room);
  let results;
  if (mg.kind === "reaction") {
    results = computeReactionResult(mg.submissions, players, mg.startedAt, mg.goAt);
  } else if (mg.kind === "guess") {
    results = computeGuessResult(mg.submissions, players, mg.params.secret);
  } else if (mg.kind === "click") {
    results = computeClickResult(mg.submissions, players);
  } else if (mg.kind === "nunchi") {
    results = computeNunchiResult(mg.params.eliminated, players);
  } else {
    results = [];
  }

  // 보상 적용
  for (const r of results) {
    if (r.reward > 0) {
      const p = room.players.get(r.userId);
      if (p) {
        p.coins += r.reward;
        if (p.stats) {
          p.stats.coinGained += r.reward;
          if (p.coins > p.stats.maxCoins) p.stats.maxCoins = p.coins;
        }
      }
    }
  }

  io.to(socketRoomName(room.id)).emit("bp:minigameEnd", {
    kind: mg.kind,
    reason,
    results,
    secret: mg.kind === "guess" ? mg.params.secret : undefined,
  });

  room.minigame = null;
  broadcastRoomState(io, room);

  // 승리 체크 후 다음 턴 (잠시 대기)
  if (checkWinCondition(io, room)) return;
  setTimeout(() => {
    if (room.status !== "playing") return;
    advanceTurn(room);
    room.pendingDice = null;
    room.extraRollUsed = false;
    startTurn(io, room);
  }, 2200);
}

// ===== Leave =====
function leavePlayer(io, room, userId, hard) {
  const p = room.players.get(userId);
  if (!p) return;
  if (hard) {
    room.players.delete(userId);
    room.playerOrder = room.playerOrder.filter(u => u !== userId);
    bpUserRoom.delete(userId);
  } else {
    p.connected = false;
  }
  if (room.hostUserId === userId && room.playerOrder.length > 0) {
    room.hostUserId = room.playerOrder[0];
  }
  if (room.playerOrder.length === 0) {
    clearEmptyRoomTimer(room);
    room.emptyRoomTimer = setTimeout(() => {
      if (bpRooms.get(room.id) && room.playerOrder.length === 0) {
        deleteRoom(io, room, "EMPTY_ROOM_TTL");
      }
    }, EMPTY_ROOM_TTL_MS);
    return;
  }
  if (room.status === "playing") {
    const turnUid = room.playerOrder[room.currentTurnIdx];
    if (turnUid === userId) {
      clearTurnTimer(room);
      advanceTurn(room);
      room.pendingDice = null;
      startTurn(io, room);
    }
    if (checkWinCondition(io, room)) return;
  }
  broadcastRoomState(io, room);
}

// ===== Register =====
export function registerBoardParty(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("bp:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (bpUserRoom.has(me.id)) {
          const old = bpRooms.get(bpUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, true);
        }
        const mode = ALLOWED_MODES.includes(payload?.mode) ? payload.mode : "ffa8";
        const roomId = `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", mode, maxPlayers: modeMaxPlayers(mode),
          createdAt: Date.now(),
          options: {
            turnSec: DEFAULT_TURN_SEC,
            targetCoins: DEFAULT_TARGET_COINS,
            maxRound: DEFAULT_MAX_ROUNDS,
            eventIntensity: "normal",
            penaltyMode: true,
            penaltyKinds: { ...DEFAULT_PENALTY_KINDS },
          },
          players: new Map(), playerOrder: [],
          currentTurnIdx: 0, turnNumber: 0, round: 1,
          turnDeadline: null, turnTimer: null,
          pendingDice: null,
          extraRollUsed: false,
          itemDeck: [], itemDiscard: [],
          bombs: new Map(),  // tileIdx → { ownerUid, damage }
          minigame: null,    // { kind, startedAt, goAt, deadline, submissions: Map, params, timer, ... }
          winnerTeam: null, winnerUserId: null,
          emptyRoomTimer: null,
        };
        bpRooms.set(roomId, room);
        bpInvites.set(inviteCode, roomId);

        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
        } catch {}
        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        room.players.set(me.id, newPlayerState(hostName, false, avatar));
        room.playerOrder.push(me.id);
        bpUserRoom.set(me.id, roomId);
        assignTeams(room);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room), board: publicBoard() });
        broadcastRoomState(io, room);
        console.log(`[bp] created room ${roomId} mode=${mode}`);
      } catch (e) {
        console.error("[bp:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("bp:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = bpInvites.get(code);
        const room = roomId ? bpRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") {
          if (room.players.has(me.id)) {
            const p = room.players.get(me.id);
            p.connected = true;
            socket.join(socketRoomName(roomId));
            bpUserRoom.set(me.id, roomId);
            cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), board: publicBoard(), reconnected: true });
            broadcastRoomState(io, room);
            return;
          }
          return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        }
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          bpUserRoom.set(me.id, roomId);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), board: publicBoard(), reconnected: true });
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
        const name = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);
        room.players.set(me.id, newPlayerState(name, !!me.isGuest, avatar));
        room.playerOrder.push(me.id);
        bpUserRoom.set(me.id, roomId);
        assignTeams(room);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), board: publicBoard() });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[bp:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("bp:setOptions", (payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      if (payload?.mode && ALLOWED_MODES.includes(payload.mode)) {
        const newMax = modeMaxPlayers(payload.mode);
        if (newMax < room.players.size) return cb?.({ ok: false, error: "PLAYERS_OVERFLOW" });
        room.mode = payload.mode;
        room.maxPlayers = newMax;
        assignTeams(room);
      }
      if (payload?.turnSec != null) {
        const n = Number(payload.turnSec);
        if (!ALLOWED_TURN_SECS.includes(n)) return cb?.({ ok: false, error: "INVALID_TURN_SEC" });
        room.options.turnSec = n;
      }
      if (payload?.targetCoins != null) {
        const n = Number(payload.targetCoins);
        if (!ALLOWED_TARGET_COINS.includes(n)) return cb?.({ ok: false, error: "INVALID_TARGET_COINS" });
        room.options.targetCoins = n;
      }
      if (payload?.maxRound != null) {
        const n = Number(payload.maxRound);
        if (!ALLOWED_MAX_ROUNDS.includes(n)) return cb?.({ ok: false, error: "INVALID_MAX_ROUND" });
        room.options.maxRound = n;
      }
      if (payload?.eventIntensity && ALLOWED_EVENT_INTENSITY.includes(payload.eventIntensity)) {
        room.options.eventIntensity = payload.eventIntensity;
      }
      if (typeof payload?.penaltyMode === "boolean") {
        room.options.penaltyMode = payload.penaltyMode;
      }
      if (payload?.penaltyKinds && typeof payload.penaltyKinds === "object") {
        // 알려진 키만 받음
        const next = { ...(room.options.penaltyKinds || {}) };
        for (const c of PENALTY_CATEGORIES) {
          if (typeof payload.penaltyKinds[c.key] === "boolean") next[c.key] = payload.penaltyKinds[c.key];
        }
        room.options.penaltyKinds = next;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("bp:setTeam", (payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      const teamCount = modeTeamCount(room.mode);
      if (teamCount === 0) return cb?.({ ok: false, error: "FFA_NO_TEAMS" });
      const team = Number(payload?.team);
      if (!Number.isInteger(team) || team < 0 || team >= teamCount) return cb?.({ ok: false, error: "INVALID_TEAM" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      p.team = team;
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("bp:start", (_payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      const minNeeded = modeMinPlayers(room.mode);
      if (room.players.size < minNeeded) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", needed: minNeeded });
      const tc = modeTeamCount(room.mode), pt = modePerTeam(room.mode);
      if (tc > 0 && pt) {
        const counts = new Array(tc).fill(0);
        for (const uid of room.playerOrder) {
          const p = room.players.get(uid);
          if (p?.team != null && p.team < tc) counts[p.team]++;
        }
        if (counts.some(n => n !== pt)) return cb?.({ ok: false, error: "TEAM_UNBALANCED", counts });
      }
      room.status = "playing";
      room.currentTurnIdx = 0;
      room.turnNumber = 0;
      room.round = 1;
      room.pendingDice = null;
      room.extraRollUsed = false;
      room.itemDeck = shuffleArr(buildItemDeck());
      room.itemDiscard = [];
      room.bombs = new Map();
      for (const uid of room.playerOrder) {
        const p = room.players.get(uid);
        p.pos = 0;
        p.coins = DEFAULT_START_COINS;
        p.items = [];
        p.statuses = {};
        p.penaltyHits = 0;
        p.finished = false;
        p.stats = makeEmptyStats();
      }
      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("bp:gameStart", {
        mode: room.mode,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
        options: { ...room.options },
        board: publicBoard(),
        events: publicEventList(),
        items: publicItemList(),
        penalties: publicPenaltyList(),
        categories: PENALTY_CATEGORIES,
        minigames: publicMinigameList(),
      });
      // 3-2-1-GO 카운트다운 후 첫 턴
      io.to(socketRoomName(room.id)).emit("bp:countdown", { from: 3 });
      setTimeout(() => startTurn(io, room), 3200);
    });

    socket.on("bp:spinPenalty", (_payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "ended") return cb?.({ ok: false, error: "NOT_ENDED" });
      if (!room.options?.penaltyMode) return cb?.({ ok: false, error: "PENALTY_DISABLED" });
      const enabled = room.options?.penaltyKinds || DEFAULT_PENALTY_KINDS;
      const picked = pickPenalty(enabled);
      if (!picked) return cb?.({ ok: false, error: "NO_PENALTY_CATEGORY" });
      cb?.({ ok: true });
      // 모든 후보 카드 (회전 애니용) + 최종 결과
      const candidates = PENALTIES.filter(p => enabled[p.category]);
      io.to(socketRoomName(room.id)).emit("bp:penalty", {
        loserUserId: room.winnerUserId === null ? null : null,  // 클라가 prev 데이터에서 가져옴
        picked: { id: picked.id, emoji: picked.emoji, title: picked.title, desc: picked.desc, category: picked.category },
        candidates: candidates.map(p => ({ id: p.id, emoji: p.emoji, title: p.title })),
      });
    });

    socket.on("bp:rollDice", async (_payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const res = await performRoll(io, room, me.id, false);
      cb?.(res);
    });

    socket.on("bp:minigameSubmit", (payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (!room.minigame) return cb?.({ ok: false, error: "NO_MINIGAME" });
      const res = handleMinigameSubmit(io, room, me.id, payload);
      cb?.(res);
    });

    socket.on("bp:useItem", (payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const itemId = String(payload?.itemId || "");
      const targetUserId = payload?.targetUserId ? String(payload.targetUserId) : null;
      const res = tryUseItem(io, room, me.id, itemId, targetUserId);
      cb?.(res);
    });

    socket.on("bp:leaveRoom", (_payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false });
      leavePlayer(io, room, me.id, true);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("bp:requestState", (_payload, cb) => {
      const roomId = bpUserRoom.get(me.id);
      const room = roomId ? bpRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room), board: publicBoard() });
      sendItemsTo(io, room, me.id);
    });

    socket.on("disconnect", () => {
      const roomId = bpUserRoom.get(me.id);
      if (!roomId) return;
      const room = bpRooms.get(roomId);
      if (!room) return;
      const p = room.players.get(me.id);
      if (p) p.connected = false;
      setTimeout(() => {
        const r = bpRooms.get(roomId);
        if (!r) return;
        const pp = r.players.get(me.id);
        if (!pp || pp.connected) return;
        leavePlayer(io, r, me.id, true);
      }, 60_000);
      if (room.status === "lobby") broadcastRoomState(io, room);
      else if (room.status === "playing") {
        const turnUid = room.playerOrder[room.currentTurnIdx];
        if (turnUid === me.id) {
          clearTurnTimer(room);
          advanceTurn(room);
          room.pendingDice = null;
          startTurn(io, room);
        }
      }
    });
  });
}
