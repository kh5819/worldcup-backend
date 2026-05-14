// =========================
// DUO GAME ZONE — 난장 카드게임 (서버) v20260515_1
// 기존 worldcup/quiz/tier/lifegame/liar/oxgame/fibbage/omok 와 완전 격리.
// - 별도 Map(cgRooms / cgInvites / cgUserRoom)
// - 'cg:*' 이벤트 prefix
// - socket.io room name = `cg:${roomId}`
//
// 모드: 처음부터 8인 기준 통합 설계
//   '1v1'     — 2인, 팀2 (1-1)
//   '2v2'     — 4인, 팀2 (2-2)
//   '3v3'     — 6인, 팀2 (3-3)
//   '4v4'     — 8인, 팀2 (4-4)
//   '2v2v2'   — 6인, 팀3 (2-2-2)
//   '2v2v2v2' — 8인, 팀4 (2-2-2-2)
//   'ffa8'    — 2~8인 개인전
//
// 핵심: 반응 카드 스택 (Action Stack, LIFO)
//   공격 카드 사용 → 스택에 push → 대상(+팀원/전체)에게 반응 윈도우 오픈
//   → 선착순 1장 반응 또는 전원 pass / 타임아웃 → resolve (LIFO)
//   → 반응 깊이 제한 3
// =========================

import { CARDS, buildDeck, getCard, isReactionCard, publicCardList } from "./cardgame-cards.js";
import { EVENTS, getEvent, pickRandomEvent, publicEventList } from "./cardgame-events.js";

// ===== Room storage =====
const cgRooms = new Map();      // roomId → room
const cgInvites = new Map();    // inviteCode → roomId
const cgUserRoom = new Map();   // userId → roomId

// ===== Constants =====
// 모드: 처음부터 8인 기준 통합 설계
// teams=0 (개인전) / 2 / 3 / 4
// perTeam = 팀당 인원 (teams>=2일 때)
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
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_TURN_SECS = [10, 20, 30, 45, 60, 90, 120, 180];
const ALLOWED_REACTION_SECS = [3, 5, 7, 10];
const DEFAULT_HP = 25;
const DEFAULT_HAND = 5;
const DEFAULT_DRAW_PER_TURN = 1;
const DEFAULT_PLAY_PER_TURN = 2;
const TURN_SEC = 30;
const REACTION_SEC = 7;
const REACTION_DEPTH_LIMIT = 3;
const EVENT_EVERY_N_TURNS = 4;
const EMPTY_ROOM_TTL_MS = 30_000;
const ENDED_ROOM_TTL_MS = 10 * 60_000;
// 팀 색상 (최대 4팀까지)
const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#facc15"];
const TEAM_LABELS = ["A", "B", "C", "D"];

function socketRoomName(roomId) { return `cg:${roomId}`; }
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
    if (!cgInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
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
    hp: DEFAULT_HP, maxHp: DEFAULT_HP,
    hand: [],
    statuses: {},           // { poison: 3, stun: 1, silence: 2, burn: 2 }
    isDown: false, downedAt: null,
    extraPlays: 0,          // 이번 턴 추가 플레이 횟수 (special 등)
  };
}

// 팀 자동 배정: 입장 순서로 round-robin (팀 수 만큼 회전)
// 개인전(ffa8)이면 각자 다른 team id
function assignTeams(room) {
  const info = MODE_INFO[room.mode];
  if (!info) return;
  const order = room.playerOrder;
  if (info.teams === 0) {
    // 개인전: 각자 고유 team
    order.forEach((uid, i) => { const p = room.players.get(uid); if (p) p.team = i; });
  } else {
    // 팀전: round-robin
    order.forEach((uid, i) => { const p = room.players.get(uid); if (p) p.team = i % info.teams; });
  }
}

function modeMaxPlayers(mode) { return MODE_INFO[mode]?.players || 2; }
function modeMinPlayers(mode) {
  const info = MODE_INFO[mode];
  if (!info) return 2;
  return info.min ?? info.players;
}
function modeTeamCount(mode) { return MODE_INFO[mode]?.teams || 0; }
function modePerTeam(mode) { return MODE_INFO[mode]?.perTeam || null; }

// ===== Public serialization =====
function publicPlayer(userId, p, includeHandCount = true) {
  return {
    userId, name: p.name, isGuest: p.isGuest, avatar_url: p.avatar_url || null,
    connected: p.connected, team: p.team,
    hp: p.hp, maxHp: p.maxHp,
    handCount: includeHandCount ? (p.hand?.length || 0) : 0,
    statuses: { ...p.statuses },
    isDown: p.isDown,
  };
}

function publicStackFrame(frame) {
  return {
    id: frame.id,
    type: frame.type,
    actorUserId: frame.actorUserId,
    targetUserId: frame.targetUserId,
    cardId: frame.cardId,
    pendingDamage: frame.pendingDamage,
    halved: !!frame.halved,
    negated: !!frame.negated,
    reflectTo: frame.reflectTo || null,
    awaiting: frame.awaiting || [],
    deadline: frame.deadline,
    depth: frame.depth,
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
    turnSec: room.turnSec,
    reactionSec: room.reactionSec,
    teamColors: TEAM_COLORS,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    currentTurnUserId: room.status === "playing" ? (room.playerOrder[room.currentTurnIdx] || null) : null,
    turnDeadline: room.turnDeadline,
    turnNumber: room.turnNumber,
    actionStack: room.actionStack.map(publicStackFrame),
    pendingEvent: room.pendingEvent || null,
    winnerTeam: room.winnerTeam,
    winnerUserId: room.winnerUserId,
    deckLeft: room.deck.length,
    discardLeft: room.discard.length,
  };
}

// ===== Timers =====
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearReactionTimer(room) {
  if (room.reactionTimer) { clearTimeout(room.reactionTimer); room.reactionTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  clearTurnTimer(room);
  clearReactionTimer(room);
  clearEmptyRoomTimer(room);
  cgRooms.delete(room.id);
  cgInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (cgUserRoom.get(uid) === room.id) cgUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("cg:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[cg] room ${room.id} deleted: ${reason}`);
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("cg:roomState", publicRoom(room));
}

// hand는 본인에게만
function sendHandTo(io, room, userId) {
  const p = room.players.get(userId);
  if (!p) return;
  // socket id 찾기
  const sockets = io.sockets.adapter.rooms.get(socketRoomName(room.id));
  if (!sockets) return;
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.user?.id === userId) {
      s.emit("cg:hand", { userId, hand: p.hand.slice() });
    }
  }
}
function sendHandsAll(io, room) {
  for (const uid of room.playerOrder) sendHandTo(io, room, uid);
}

// ===== Deck =====
function drawN(room, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (room.deck.length === 0) {
      if (room.discard.length === 0) break;
      room.deck = shuffleArr(room.discard.slice());
      room.discard = [];
    }
    out.push(room.deck.shift());
  }
  return out;
}
function drawIntoHand(room, userId, n) {
  const p = room.players.get(userId);
  if (!p) return 0;
  const cards = drawN(room, n);
  p.hand.push(...cards);
  return cards.length;
}
function discardCard(room, cardId) { room.discard.push(cardId); }

// ===== Engine context (for events) =====
function makeEventCtx(io, room) {
  return {
    alivePlayers: () => room.playerOrder
      .map(uid => ({ userId: uid, ...room.players.get(uid) }))
      .filter(p => !p.isDown),
    shuffle: shuffleArr,
    damage: (userId, dmg, source) => applyDamageDirect(io, room, userId, dmg, source),
    heal: (userId, hp) => {
      const p = room.players.get(userId);
      if (!p || p.isDown) return;
      p.hp = Math.min(p.maxHp, p.hp + hp);
    },
    applyStatus: (userId, statuses) => {
      const p = room.players.get(userId);
      if (!p || p.isDown) return;
      for (const k of Object.keys(statuses)) {
        p.statuses[k] = Math.max(p.statuses[k] || 0, statuses[k]);
      }
    },
    drawCards: (userId, n) => drawIntoHand(room, userId, n),
  };
}

// ===== Damage / Down =====
function applyDamageDirect(io, room, userId, dmg, source) {
  const p = room.players.get(userId);
  if (!p || p.isDown) return;
  p.hp = Math.max(0, p.hp - Math.max(0, Math.floor(dmg)));
  if (p.hp <= 0) {
    p.isDown = true;
    p.downedAt = Date.now();
    io.to(socketRoomName(room.id)).emit("cg:playerDown", { userId, name: p.name, source });
  }
}

// ===== Turn flow =====
function teamsAlive(room) {
  const set = new Set();
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p && !p.isDown) set.add(p.team);
  }
  return set;
}

function checkWinCondition(io, room) {
  const teams = teamsAlive(room);
  if (teams.size > 1) return false;

  const isTeamMode = modeTeamCount(room.mode) > 0;
  if (isTeamMode) {
    room.winnerTeam = teams.values().next().value ?? null;
    room.winnerUserId = null;
  } else {
    // 개인전: 마지막 생존자
    const winnerUid = room.playerOrder.find(uid => !room.players.get(uid).isDown) || null;
    const winnerP = winnerUid ? room.players.get(winnerUid) : null;
    room.winnerTeam = winnerP?.team ?? null;
    room.winnerUserId = winnerUid;
  }
  endGame(io, room);
  return true;
}

function endGame(io, room) {
  room.status = "ended";
  clearTurnTimer(room);
  clearReactionTimer(room);
  io.to(socketRoomName(room.id)).emit("cg:gameEnd", {
    winnerTeam: room.winnerTeam,
    winnerUserId: room.winnerUserId,
    mode: room.mode,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, ENDED_ROOM_TTL_MS);
}

function tickStatusesAtTurnStart(io, room, userId) {
  const p = room.players.get(userId);
  if (!p) return { skip: false };
  // burn/poison: 턴 시작 시 피해
  let totalTick = 0;
  if (p.statuses.poison) {
    const d = 2;
    totalTick += d;
    applyDamageDirect(io, room, userId, d, "독");
    p.statuses.poison -= 1;
    if (p.statuses.poison <= 0) delete p.statuses.poison;
  }
  if (p.statuses.burn) {
    const d = 2;
    totalTick += d;
    applyDamageDirect(io, room, userId, d, "화상");
    p.statuses.burn -= 1;
    if (p.statuses.burn <= 0) delete p.statuses.burn;
  }
  // stun: 행동 불가
  let skip = false;
  if (p.statuses.stun) {
    p.statuses.stun -= 1;
    if (p.statuses.stun <= 0) delete p.statuses.stun;
    skip = !p.isDown;
  }
  // silence: 자동 감소
  if (p.statuses.silence) {
    p.statuses.silence -= 1;
    if (p.statuses.silence <= 0) delete p.statuses.silence;
  }
  if (totalTick > 0) {
    io.to(socketRoomName(room.id)).emit("cg:statusTick", {
      userId, damage: totalTick, statuses: { ...p.statuses }, isDown: p.isDown,
    });
  }
  return { skip };
}

function advanceTurnIndex(room) {
  const N = room.playerOrder.length;
  for (let i = 0; i < N; i++) {
    room.currentTurnIdx = (room.currentTurnIdx + 1) % N;
    const uid = room.playerOrder[room.currentTurnIdx];
    const p = room.players.get(uid);
    if (p && !p.isDown && p.connected) return uid;
  }
  return null;
}

function startTurn(io, room) {
  if (room.status !== "playing") return;
  if (room.actionStack.length > 0) return; // 스택 진행 중엔 턴 진행 X
  if (checkWinCondition(io, room)) return;

  const turnUid = room.playerOrder[room.currentTurnIdx];
  const turnP = room.players.get(turnUid);
  if (!turnP || turnP.isDown || !turnP.connected) {
    const next = advanceTurnIndex(room);
    if (!next) return;
    return startTurn(io, room);
  }

  room.turnNumber += 1;
  room.cardsPlayedThisTurn = 0;
  turnP.extraPlays = 0;

  // 상태이상 틱
  const { skip } = tickStatusesAtTurnStart(io, room, turnUid);
  if (checkWinCondition(io, room)) return;

  // 카드 드로우
  drawIntoHand(room, turnUid, DEFAULT_DRAW_PER_TURN);
  sendHandTo(io, room, turnUid);

  // 랜덤 이벤트 (매 N턴마다, 게임 전체 턴 기준)
  if (room.turnNumber > 1 && room.turnNumber % EVENT_EVERY_N_TURNS === 0) {
    fireRandomEvent(io, room);
    if (checkWinCondition(io, room)) return;
  }

  room.turnDeadline = Date.now() + room.turnSec * 1000;
  io.to(socketRoomName(room.id)).emit("cg:turnStart", {
    turnUserId: turnUid,
    turnNumber: room.turnNumber,
    turnDeadline: room.turnDeadline,
    skip,
  });
  broadcastRoomState(io, room);

  clearTurnTimer(room);
  if (skip) {
    // 기절: 자동 턴 종료
    setTimeout(() => endTurn(io, room, turnUid, "STUN"), 1200);
    return;
  }
  room.turnTimer = setTimeout(() => {
    if (room.status !== "playing") return;
    if (room.playerOrder[room.currentTurnIdx] !== turnUid) return;
    endTurn(io, room, turnUid, "TIMEOUT");
  }, room.turnSec * 1000);
}

function endTurn(io, room, userId, reason) {
  if (room.status !== "playing") return;
  clearTurnTimer(room);
  // 손패 최대 컷 (선택적 — MVP는 안 자름)
  io.to(socketRoomName(room.id)).emit("cg:turnEnd", { userId, reason });
  advanceTurnIndex(room);
  if (checkWinCondition(io, room)) return;
  startTurn(io, room);
}

function fireRandomEvent(io, room) {
  const ev = pickRandomEvent();
  const ctx = makeEventCtx(io, room);
  const r = ev.apply(ctx);
  io.to(socketRoomName(room.id)).emit("cg:event", {
    id: ev.id, emoji: ev.emoji, title: ev.title, desc: ev.desc,
    affected: r?.affected || [], msg: r?.msg || "",
  });
  sendHandsAll(io, room);
}

// ===== Action Stack =====
function makeFrame({ type, actorUserId, targetUserId, cardId, depth, pendingDamage = 0, parent = null }) {
  return {
    id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type, actorUserId, targetUserId, cardId,
    depth, parent,
    pendingDamage,
    halved: false, negated: false, reflectTo: null,
    awaiting: [],
    deadline: 0,
    passes: new Set(),
  };
}

// 누가 반응 카드를 낼 수 있는가?
// 1) targetUserId 본인
// 2) 팀전이면 target과 같은 팀원 (protect 카드용 — reactsTo: 'attack:targetTeam')
// 개인전(teams=0)이면 본인만
function reactionAwaitList(room, frame) {
  const list = new Set();
  const target = room.players.get(frame.targetUserId);
  if (target && !target.isDown && target.connected) list.add(frame.targetUserId);
  const isTeamMode = modeTeamCount(room.mode) > 0;
  if (target && isTeamMode) {
    for (const uid of room.playerOrder) {
      const p = room.players.get(uid);
      if (!p || p.isDown || !p.connected) continue;
      if (uid === frame.targetUserId) continue;
      if (p.team === target.team) list.add(uid);
    }
  }
  return [...list];
}

function openReactionWindow(io, room, frame) {
  frame.deadline = Date.now() + room.reactionSec * 1000;
  frame.awaiting = reactionAwaitList(room, frame);
  frame.passes = new Set();

  if (frame.awaiting.length === 0) {
    return resolveTopFrame(io, room);
  }

  io.to(socketRoomName(room.id)).emit("cg:reactionWindow", {
    frame: publicStackFrame(frame),
  });
  broadcastRoomState(io, room);

  clearReactionTimer(room);
  const expectedId = frame.id;
  room.reactionTimer = setTimeout(() => {
    if (room.status !== "playing") return;
    const top = room.actionStack[room.actionStack.length - 1];
    if (!top || top.id !== expectedId) return;
    // 타임아웃 → 미응답자 전부 pass 처리 후 resolve
    resolveTopFrame(io, room);
  }, room.reactionSec * 1000);
}

function resolveTopFrame(io, room) {
  clearReactionTimer(room);
  const frame = room.actionStack.pop();
  if (!frame) return;

  // 최종 효과 처리
  const actor = room.players.get(frame.actorUserId);
  const target = room.players.get(frame.targetUserId);

  if (frame.type === "attack") {
    if (!frame.negated && target && !target.isDown) {
      let dmg = frame.pendingDamage;
      if (frame.halved) dmg = Math.ceil(dmg / 2);
      // 반사 (reflectTo): 공격자 또는 redirect 대상이 받음
      if (frame.reflectTo) {
        applyDamageDirect(io, room, frame.reflectTo, dmg, "반사");
      } else {
        applyDamageDirect(io, room, frame.targetUserId, dmg, "공격");
      }
      // 카드의 applyStatus
      const card = getCard(frame.cardId);
      if (card?.effect?.applyStatus && !frame.reflectTo) {
        const tp = room.players.get(frame.targetUserId);
        if (tp && !tp.isDown) {
          for (const k of Object.keys(card.effect.applyStatus)) {
            tp.statuses[k] = Math.max(tp.statuses[k] || 0, card.effect.applyStatus[k]);
          }
        }
      }
    }
  } else if (frame.type === "reaction") {
    // 반응 효과: 부모 프레임을 수정 (스택 resolve 순서 중요)
    const parent = room.actionStack[room.actionStack.length - 1];
    if (parent) {
      const card = getCard(frame.cardId);
      const ef = card?.effect || {};
      if (ef.negateDamage) parent.negated = true;
      if (ef.halveDamage) parent.halved = true;
      if (ef.reflectDamage) {
        // 반격: 새 공격 프레임 만들지 않고 즉시 공격자에게 데미지
        applyDamageDirect(io, room, parent.actorUserId, ef.reflectDamage, "반격");
      }
      if (ef.reflectAll) {
        parent.reflectTo = parent.actorUserId;
      }
      if (ef.redirectToSelf) {
        parent.targetUserId = frame.actorUserId; // 보호자가 대신 받음
      }
    }
  }

  io.to(socketRoomName(room.id)).emit("cg:stackResolved", {
    frame: publicStackFrame(frame),
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });

  if (checkWinCondition(io, room)) return;

  // 더 처리할 프레임이 남아있는지
  if (room.actionStack.length > 0) {
    const next = room.actionStack[room.actionStack.length - 1];
    // 다음 프레임은 이미 반응 윈도우가 열려있었으니, 그대로 resolve (LIFO)
    return resolveTopFrame(io, room);
  }

  // 스택 비었음 → 액션을 쏜 액터의 턴이 계속 진행 중인지 확인
  broadcastRoomState(io, room);

  // 액터의 카드 사용 횟수 검사
  const turnUid = room.playerOrder[room.currentTurnIdx];
  const turnP = room.players.get(turnUid);
  if (turnP && turnP.isDown) {
    endTurn(io, room, turnUid, "DOWNED");
    return;
  }
  // 카드를 너무 많이 썼거나 빈 손이면 자동 종료
  const allowedPlays = DEFAULT_PLAY_PER_TURN + (turnP?.extraPlays || 0);
  if (room.cardsPlayedThisTurn >= allowedPlays) {
    endTurn(io, room, turnUid, "PLAYS_DONE");
  }
}

// ===== Play / React =====
function tryPlayCard(io, room, userId, cardId, targetUserId) {
  if (room.status !== "playing") return { ok: false, error: "NOT_PLAYING" };
  const turnUid = room.playerOrder[room.currentTurnIdx];
  if (turnUid !== userId) return { ok: false, error: "NOT_YOUR_TURN" };
  if (room.actionStack.length > 0) return { ok: false, error: "REACTION_PHASE" };

  const p = room.players.get(userId);
  if (!p || p.isDown) return { ok: false, error: "DOWNED" };
  const handIdx = p.hand.indexOf(cardId);
  if (handIdx < 0) return { ok: false, error: "NOT_IN_HAND" };

  const card = getCard(cardId);
  if (!card) return { ok: false, error: "UNKNOWN_CARD" };

  // defense/reaction은 반응 윈도우에서만 사용
  if (card.type === "defense" || card.type === "reaction") {
    return { ok: false, error: "REACTION_ONLY" };
  }
  // silence는 special 카드 차단
  if (p.statuses.silence && card.type === "special") {
    return { ok: false, error: "SILENCED" };
  }
  // 사용 횟수 검사
  const allowedPlays = DEFAULT_PLAY_PER_TURN + (p.extraPlays || 0);
  if (room.cardsPlayedThisTurn >= allowedPlays) {
    return { ok: false, error: "PLAYS_EXHAUSTED" };
  }
  // 타겟 검증
  const targetP = targetUserId ? room.players.get(targetUserId) : null;
  if (card.targeting === "enemy") {
    if (!targetP || targetP.isDown) return { ok: false, error: "INVALID_TARGET" };
    if (targetP.team === p.team && modeTeamCount(room.mode) > 0) return { ok: false, error: "TARGET_NOT_ENEMY" };
    if (targetUserId === userId) return { ok: false, error: "TARGET_NOT_ENEMY" };
  } else if (card.targeting === "ally") {
    if (!targetP || targetP.isDown) return { ok: false, error: "INVALID_TARGET" };
    if (modeTeamCount(room.mode) > 0 && targetP.team !== p.team) return { ok: false, error: "TARGET_NOT_ALLY" };
    if (modeTeamCount(room.mode) === 0 && targetUserId !== userId) return { ok: false, error: "TARGET_NOT_SELF" };
  } else if (card.targeting === "any") {
    if (!targetP || targetP.isDown) return { ok: false, error: "INVALID_TARGET" };
  } else if (card.targeting === "self") {
    targetUserId = userId;
  } else if (card.targeting == null) {
    // no target
  }

  // 손패에서 제거
  p.hand.splice(handIdx, 1);
  discardCard(room, cardId);
  room.cardsPlayedThisTurn += 1;

  // 공격 카드 → 반응 스택
  if (card.type === "attack" && !card.pierce) {
    const frame = makeFrame({
      type: "attack", actorUserId: userId, targetUserId, cardId,
      depth: 0, pendingDamage: card.effect?.damage || 0,
    });
    room.actionStack.push(frame);
    io.to(socketRoomName(room.id)).emit("cg:actionDeclared", {
      frame: publicStackFrame(frame),
      cardId, actorName: p.name, targetName: targetP?.name || null,
    });
    sendHandTo(io, room, userId);
    openReactionWindow(io, room, frame);
    return { ok: true };
  }

  // pierce 공격(벼락 등) — 반응 윈도우 생략, 즉시 데미지
  if (card.type === "attack" && card.pierce) {
    io.to(socketRoomName(room.id)).emit("cg:actionDeclared", {
      frame: null, cardId, actorUserId: userId, actorName: p.name,
      targetUserId, targetName: targetP?.name || null, pierce: true,
    });
    applyDamageDirect(io, room, targetUserId, card.effect?.damage || 0, "관통");
    if (card.effect?.applyStatus) {
      const tp = room.players.get(targetUserId);
      if (tp && !tp.isDown) {
        for (const k of Object.keys(card.effect.applyStatus)) {
          tp.statuses[k] = Math.max(tp.statuses[k] || 0, card.effect.applyStatus[k]);
        }
      }
    }
    sendHandTo(io, room, userId);
    broadcastRoomState(io, room);
    if (checkWinCondition(io, room)) return { ok: true };
    afterImmediatePlay(io, room, userId);
    return { ok: true };
  }

  // support / special — 즉시 발동
  applyImmediateEffect(io, room, userId, card, targetUserId);
  sendHandTo(io, room, userId);
  broadcastRoomState(io, room);
  if (checkWinCondition(io, room)) return { ok: true };
  afterImmediatePlay(io, room, userId);
  return { ok: true };
}

function afterImmediatePlay(io, room, userId) {
  const p = room.players.get(userId);
  const allowedPlays = DEFAULT_PLAY_PER_TURN + (p?.extraPlays || 0);
  if (room.cardsPlayedThisTurn >= allowedPlays) {
    endTurn(io, room, userId, "PLAYS_DONE");
  }
}

function applyImmediateEffect(io, room, actorId, card, targetUserId) {
  const ef = card.effect || {};
  const ctx = makeEventCtx(io, room);
  io.to(socketRoomName(room.id)).emit("cg:actionDeclared", {
    frame: null, cardId: card.id, actorUserId: actorId,
    actorName: room.players.get(actorId)?.name,
    targetUserId, targetName: targetUserId ? room.players.get(targetUserId)?.name : null,
    immediate: true,
  });
  if (ef.heal) ctx.heal(targetUserId, ef.heal);
  if (ef.clearStatus) {
    const tp = room.players.get(targetUserId);
    if (tp) tp.statuses = {};
  }
  if (ef.applyStatus) ctx.applyStatus(targetUserId, ef.applyStatus);
  if (ef.coinflip) {
    const win = Math.random() < 0.5;
    const branch = win ? ef.coinflip.onWin : ef.coinflip.onLose;
    io.to(socketRoomName(room.id)).emit("cg:coinflip", {
      actorUserId: actorId, targetUserId, win,
    });
    if (branch?.damage) ctx.damage(targetUserId, branch.damage, "운빨");
  }
  if (ef.swapHand) {
    const a = room.players.get(actorId);
    const b = room.players.get(targetUserId);
    if (a && b && !b.isDown) {
      const tmp = a.hand; a.hand = b.hand; b.hand = tmp;
      sendHandTo(io, room, actorId);
      sendHandTo(io, room, targetUserId);
    }
  }
  if (ef.stealCard) {
    const a = room.players.get(actorId);
    const b = room.players.get(targetUserId);
    if (a && b && !b.isDown && b.hand.length > 0) {
      const idx = Math.floor(Math.random() * b.hand.length);
      const [taken] = b.hand.splice(idx, 1);
      a.hand.push(taken);
      sendHandTo(io, room, actorId);
      sendHandTo(io, room, targetUserId);
    }
  }
  if (ef.triggerEvent === "random") fireRandomEvent(io, room);
}

function tryPlayReaction(io, room, userId, cardId) {
  if (room.status !== "playing") return { ok: false, error: "NOT_PLAYING" };
  const top = room.actionStack[room.actionStack.length - 1];
  if (!top) return { ok: false, error: "NO_REACTION_WINDOW" };
  if (!top.awaiting.includes(userId)) return { ok: false, error: "NOT_AWAITED" };
  if (top.passes.has(userId)) return { ok: false, error: "ALREADY_PASSED" };
  if (top.depth >= REACTION_DEPTH_LIMIT) return { ok: false, error: "DEPTH_LIMIT" };

  const p = room.players.get(userId);
  if (!p || p.isDown) return { ok: false, error: "DOWNED" };
  const handIdx = p.hand.indexOf(cardId);
  if (handIdx < 0) return { ok: false, error: "NOT_IN_HAND" };
  const card = getCard(cardId);
  if (!card || !isReactionCard(cardId)) return { ok: false, error: "NOT_REACTION_CARD" };

  // reactsTo 검사
  const tag = top.type === "attack" ? "attack" : "reaction";
  const reactsTo = card.reactsTo || [];
  let allowed = false;
  if (reactsTo.includes(tag)) {
    // 본인이 target일 때만
    if (top.targetUserId === userId) allowed = true;
  }
  if (reactsTo.includes(`${tag}:targetTeam`)) {
    const targetP = room.players.get(top.targetUserId);
    if (targetP && targetP.team === p.team && userId !== top.targetUserId) allowed = true;
  }
  if (!allowed) return { ok: false, error: "NOT_VALID_REACTION" };

  // 손패에서 제거
  p.hand.splice(handIdx, 1);
  discardCard(room, cardId);

  // 선착순 1장: 즉시 reaction 프레임 push 후 새 윈도우 오픈
  const newFrame = makeFrame({
    type: "reaction", actorUserId: userId,
    targetUserId: top.actorUserId, // 반응의 "타겟" = 원래 공격자 (반격이 향할 곳)
    cardId, depth: top.depth + 1, parent: top.id,
  });
  room.actionStack.push(newFrame);
  io.to(socketRoomName(room.id)).emit("cg:actionDeclared", {
    frame: publicStackFrame(newFrame), cardId,
    actorName: p.name, parentFrameId: top.id, reaction: true,
  });
  sendHandTo(io, room, userId);

  // 반응 깊이 도달 시: 추가 윈도우 없이 즉시 resolve 시작
  if (newFrame.depth >= REACTION_DEPTH_LIMIT) {
    return resolveTopFrame(io, room);
  }
  // 반응에 또 반응할 수 있는 카드는 MVP에서는 거의 없음(거울 정도)
  // → 일단 동일하게 윈도우 오픈, 자격자 없으면 즉시 resolve
  openReactionWindow(io, room, newFrame);
  return { ok: true };
}

function tryPassReaction(io, room, userId) {
  const top = room.actionStack[room.actionStack.length - 1];
  if (!top) return { ok: false, error: "NO_REACTION_WINDOW" };
  if (!top.awaiting.includes(userId)) return { ok: false, error: "NOT_AWAITED" };
  if (top.passes.has(userId)) return { ok: false, error: "ALREADY_PASSED" };
  top.passes.add(userId);
  io.to(socketRoomName(room.id)).emit("cg:reactionPassed", { userId });
  // 모두 pass → 즉시 resolve
  if (top.passes.size >= top.awaiting.length) {
    resolveTopFrame(io, room);
  }
  return { ok: true };
}

// ===== Leave =====
function leavePlayer(io, room, userId, hardLeave) {
  const p = room.players.get(userId);
  if (!p) return;
  if (hardLeave) {
    room.players.delete(userId);
    room.playerOrder = room.playerOrder.filter(u => u !== userId);
    cgUserRoom.delete(userId);
  } else {
    p.connected = false;
  }
  // 호스트 위임
  if (room.hostUserId === userId && room.playerOrder.length > 0) {
    room.hostUserId = room.playerOrder[0];
  }
  // 빈 방
  if (room.playerOrder.length === 0) {
    clearEmptyRoomTimer(room);
    room.emptyRoomTimer = setTimeout(() => {
      if (cgRooms.get(room.id) && room.playerOrder.length === 0) {
        deleteRoom(io, room, "EMPTY_ROOM_TTL");
      }
    }, EMPTY_ROOM_TTL_MS);
    return;
  }
  // 진행중인데 한 팀만 남으면 게임 종료
  if (room.status === "playing") {
    // 끊긴 사람이 현재 턴이면 자동 턴 종료
    const turnUid = room.playerOrder[room.currentTurnIdx];
    if (turnUid === userId) {
      // 반응 중이면 그쪽도 정리
      const top = room.actionStack[room.actionStack.length - 1];
      if (top && top.actorUserId === userId) {
        // 액션 취소 (희귀 — actor가 끊긴 경우)
        room.actionStack.pop();
        clearReactionTimer(room);
      }
      endTurn(io, room, userId, "LEAVE");
    }
    if (checkWinCondition(io, room)) return;
  }
  broadcastRoomState(io, room);
}

// ===== Register =====
export function registerCardGame(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    socket.on("cg:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (cgUserRoom.has(me.id)) {
          const old = cgRooms.get(cgUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, true);
        }
        const mode = ALLOWED_MODES.includes(payload?.mode) ? payload.mode : "1v1";
        const maxPlayers = modeMaxPlayers(mode);
        const roomId = `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();
        const room = {
          id: roomId, inviteCode, hostUserId: me.id,
          status: "lobby", mode, maxPlayers,
          turnSec: TURN_SEC, reactionSec: REACTION_SEC,
          createdAt: Date.now(),
          players: new Map(), playerOrder: [],
          deck: [], discard: [],
          currentTurnIdx: 0, turnNumber: 0,
          turnDeadline: null, turnTimer: null,
          actionStack: [], reactionTimer: null,
          cardsPlayedThisTurn: 0,
          pendingEvent: null,
          winnerTeam: null, winnerUserId: null,
          emptyRoomTimer: null,
        };
        cgRooms.set(roomId, room);
        cgInvites.set(inviteCode, roomId);

        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
        } catch {}
        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        room.players.set(me.id, newPlayerState(hostName, false, avatar));
        room.playerOrder.push(me.id);
        cgUserRoom.set(me.id, roomId);
        assignTeams(room);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[cg] created room ${roomId} mode=${mode}`);
      } catch (e) {
        console.error("[cg:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("cg:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = cgInvites.get(code);
        const room = roomId ? cgRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") {
          if (room.players.has(me.id)) {
            const p = room.players.get(me.id);
            p.connected = true;
            socket.join(socketRoomName(roomId));
            cgUserRoom.set(me.id, roomId);
            cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), reconnected: true });
            sendHandTo(io, room, me.id);
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
          cgUserRoom.set(me.id, roomId);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), reconnected: true });
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
        cgUserRoom.set(me.id, roomId);
        assignTeams(room);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);

        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[cg:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("cg:setOptions", (payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
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
        room.turnSec = n;
      }
      if (payload?.reactionSec != null) {
        const n = Number(payload.reactionSec);
        if (!ALLOWED_REACTION_SECS.includes(n)) return cb?.({ ok: false, error: "INVALID_REACTION_SEC" });
        room.reactionSec = n;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    socket.on("cg:setTeam", (payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      const teamCount = modeTeamCount(room.mode);
      if (teamCount === 0) return cb?.({ ok: false, error: "FFA_NO_TEAMS" });
      const team = Number(payload?.team);
      if (!Number.isInteger(team) || team < 0 || team >= teamCount) {
        return cb?.({ ok: false, error: "INVALID_TEAM" });
      }
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      p.team = team;
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("cg:start", (_payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
      const minNeeded = modeMinPlayers(room.mode);
      if (room.players.size < minNeeded) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", needed: minNeeded });
      // 팀전: 각 팀이 정확히 perTeam 명이어야 시작 가능 (ffa는 검사 X)
      const tc = modeTeamCount(room.mode);
      const pt = modePerTeam(room.mode);
      if (tc > 0 && pt) {
        const counts = new Array(tc).fill(0);
        for (const uid of room.playerOrder) {
          const p = room.players.get(uid);
          if (p?.team != null && p.team >= 0 && p.team < tc) counts[p.team]++;
        }
        if (counts.some(n => n !== pt)) return cb?.({ ok: false, error: "TEAM_UNBALANCED", expected: pt, counts });
      }

      room.status = "playing";
      room.deck = shuffleArr(buildDeck());
      room.discard = [];
      room.actionStack = [];
      room.currentTurnIdx = 0;
      room.turnNumber = 0;
      room.cardsPlayedThisTurn = 0;
      // 첫 손패 배포
      for (const uid of room.playerOrder) {
        const pp = room.players.get(uid);
        pp.hand = drawN(room, DEFAULT_HAND);
        pp.hp = DEFAULT_HP;
        pp.maxHp = DEFAULT_HP;
        pp.statuses = {};
        pp.isDown = false;
        pp.downedAt = null;
        pp.extraPlays = 0;
      }
      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("cg:gameStart", {
        mode: room.mode,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
        cards: publicCardList(),
        events: publicEventList(),
      });
      sendHandsAll(io, room);
      startTurn(io, room);
    });

    socket.on("cg:playCard", (payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const cardId = String(payload?.cardId || "");
      const targetUserId = payload?.targetUserId ? String(payload.targetUserId) : null;
      const res = tryPlayCard(io, room, me.id, cardId, targetUserId);
      cb?.(res);
    });

    socket.on("cg:playReaction", (payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const cardId = String(payload?.cardId || "");
      const res = tryPlayReaction(io, room, me.id, cardId);
      cb?.(res);
    });

    socket.on("cg:passReaction", (_payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const res = tryPassReaction(io, room, me.id);
      cb?.(res);
    });

    socket.on("cg:endTurn", (_payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (room.playerOrder[room.currentTurnIdx] !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      if (room.actionStack.length > 0) return cb?.({ ok: false, error: "REACTION_PHASE" });
      cb?.({ ok: true });
      endTurn(io, room, me.id, "MANUAL");
    });

    socket.on("cg:leaveRoom", (_payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false });
      leavePlayer(io, room, me.id, true);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("cg:requestState", (_payload, cb) => {
      const roomId = cgUserRoom.get(me.id);
      const room = roomId ? cgRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.join(socketRoomName(room.id));
      cb?.({ ok: true, room: publicRoom(room) });
      sendHandTo(io, room, me.id);
    });

    socket.on("disconnect", () => {
      const roomId = cgUserRoom.get(me.id);
      if (!roomId) return;
      const room = cgRooms.get(roomId);
      if (!room) return;
      const p = room.players.get(me.id);
      if (p) p.connected = false;
      // 진행 중 끊김 → 60초 후 자동 leave
      setTimeout(() => {
        const r = cgRooms.get(roomId);
        if (!r) return;
        const pp = r.players.get(me.id);
        if (!pp || pp.connected) return;
        leavePlayer(io, r, me.id, true);
      }, 60_000);
      if (room.status === "lobby") {
        broadcastRoomState(io, room);
      } else if (room.status === "playing") {
        // 현재 턴이면 자동 종료
        const turnUid = room.playerOrder[room.currentTurnIdx];
        if (turnUid === me.id) endTurn(io, room, me.id, "DISCONNECT");
      }
    });
  });
}
