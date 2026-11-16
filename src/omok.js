// =========================
// DUO GAME ZONE — 멀티 오목 (서버) v20260514_1
// 기존 worldcup/quiz/tier/lifegame/liar/oxgame/fibbage 와 완전 격리.
// - 별도 Map(omokRooms / omokInvites / omokUserRoom)
// - 'omok:*' 이벤트 prefix
// - socket.io room name = `omok:${roomId}`
//
// 모드:
//   '1v1'   — 2인, 팀 없음, 색 2
//   '2v2'   — 4인, 팀 2, 팀당 1색
//   '3v3'   — 6인, 팀 2, 팀당 1색
//   '4v4'   — 8인, 팀 2, 팀당 1색
//   'ffa'   — 2~8인, 팀 없음, 인원수만큼 색
//
// 보드: 15 / 19 / 25 (호스트 선택)
// 타이머: 30/60/90/120/180 (호스트 선택) — 시간초과 시 자동 패스 (착수 X, 차례 넘김)
// 5목 검사: 매 착수 시 4방향 (가로/세로/대각 NW-SE, NE-SW) — 5 이상 연속이면 승리
// =========================

import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import { chooseOmokMove, OMOK_BOT_LEVELS } from "./omok-bot.js";
import { OMOK_AUGS, AUG_BY_ID, AUG_ONLY_CARDS, AUG_PICK_SEC, AUG_PICK_MOVES, MAX_AUG_HAND, MAX_AUGS, MAX_USES_PER_TURN, hasAug, rollOffer, applyAug, bestOf, randomPoolCard, senseOn, bonusEvery } from "./omok-augs.js";

// ===== Room storage =====
const omokRooms = new Map();      // roomId → room
const omokInvites = new Map();    // inviteCode → roomId
const omokUserRoom = new Map();   // userId → roomId

// ===== Constants =====
const MIN_PLAYERS = 2;
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_BOARD_SIZES = [15, 19, 25];
const ALLOWED_TURN_SECS = [10, 30, 60, 90, 120, 180];
const ALLOWED_MODES = ["1v1", "2v2", "3v3", "4v4", "2v2v2", "2v2v2v2", "ffa"];
const ALLOWED_WIN_LENGTHS = [3, 4, 5]; // 호스트가 인원·보드에 맞게 승리 조건 조정
const EMPTY_ROOM_TTL_MS = 30_000;
// AI 봇: 난이도별 이름·생각하는 척 하는 지연(ms)
const BOT_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };
const BOT_DELAY_MS = { easy: [700, 1500], normal: [800, 1700], hard: [900, 2000] };
const ENDED_ROOM_TTL_MS = 10 * 60_000;

// 모드별 인원 (ffa는 가변)
const MODE_INFO = {
  "1v1":     { players: 2, teams: 0 },
  "2v2":     { players: 4, teams: 2 },
  "3v3":     { players: 6, teams: 2 },
  "4v4":     { players: 8, teams: 2 },
  "2v2v2":   { players: 6, teams: 3 },
  "2v2v2v2": { players: 8, teams: 4 },
  "ffa":     { players: null, teams: 0 },
};

// 색상 팔레트 (1~8) — 클라이언트도 동일 매핑
const COLOR_NAMES = ["red", "blue", "green", "yellow", "purple", "black", "white", "orange"];
const COLOR_HEX   = ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7", "#1f2937", "#f3f4f6", "#f97316"];

// ===== Utils =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!omokInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function socketRoomName(roomId) { return `omok:${roomId}`; }

function modeMaxPlayers(mode, ffaSize) {
  if (mode === "ffa") return Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(ffaSize) || 8));
  return MODE_INFO[mode]?.players || 2;
}

// ===== 초딩 모드 카드 정의 =====
// 가중치 = 출현률 (총합 무관, 비율로 계산)
// (2026-11-15) 8종 → 16종. 강한 카드는 덜 나오게, 약한 카드·견제 카드는 자주.
const SPECIAL_CARDS = [
  // 강
  { id: "bomb",    emoji: "💣", name: "폭탄",     weight: 7  },
  { id: "flip",    emoji: "🔄", name: "뒤집기",   weight: 6  },
  { id: "replay",  emoji: "✨", name: "재행동",   weight: 6  }, // 공짜 행동 (턴 안 끝남)
  { id: "cross",   emoji: "💥", name: "십자폭탄", weight: 4  }, // 고른 칸 상하좌우 적 돌 제거
  { id: "swap",    emoji: "🔁", name: "맞바꾸기", weight: 6  }, // 내 돌 ↔ 옆 적 돌
  { id: "tornado", emoji: "🌪️", name: "회오리",   weight: 5  }, // 3×3 안 돌 섞기
  // 중
  { id: "move",    emoji: "↔️", name: "이동",     weight: 11 },
  { id: "wall",    emoji: "🧱", name: "벽",       weight: 10 },
  { id: "push",    emoji: "🌀", name: "밀치기",   weight: 11 },
  { id: "ghost",   emoji: "👻", name: "투명돌",   weight: 9  }, // 본인 화면엔 보임
  { id: "shield",  emoji: "🛡️", name: "방패",     weight: 9  }, // 내 돌 1개 한 바퀴 보호
  { id: "steal",   emoji: "🃏", name: "훔치기",   weight: 5  }, // 공짜 행동
  // 약
  { id: "lightning", emoji: "⚡", name: "번개",   weight: 9  },
  { id: "timeThief", emoji: "⏳", name: "시간도둑", weight: 7 }, // 공짜 행동
  { id: "lucky",   emoji: "🎁", name: "럭키박스", weight: 5  }, // 공짜 행동
  { id: "peek",    emoji: "👀", name: "엿보기",   weight: 5  }, // 공짜 행동
];
const SPECIAL_CARD_IDS = new Set([...SPECIAL_CARDS.map(c => c.id), ...AUG_ONLY_CARDS]); // 증강 전용 카드도 사용 검사 통과 (초딩 모드는 뽑기에서 안 나오고 useCard에서 막음)
const SPECIAL_CARDS_TOTAL_WEIGHT = SPECIAL_CARDS.reduce((s, c) => s + c.weight, 0);
// 턴을 끝내지 않는 카드 (쓰고 나서 돌을 두거나 다른 카드를 더 쓸 수 있음)
const FREE_ACTION_CARDS = new Set(["replay", "timeThief", "lucky", "peek", "steal", "focus"]);
// 보드를 바꾸는 카드 — 쓰면 모두에게 보드 전체를 다시 보냄
const BOARD_CHANGING_CARDS = new Set(["bomb", "flip", "move", "push", "lightning", "cross", "swap", "tornado", "rewind"]);
// 카드를 쓰는 모드 (초딩·증강)
const cardMode = (room) => room.specialMode === "kid" || room.specialMode === "aug";
// 카드 효과 지속 턴 수
const WALL_DURATION_TURNS = 1;   // 2→1
const GHOST_REVEAL_TURNS = 1;    // 2→1
const TIME_THIEF_MIN_SEC = 5;
function drawRandomCard() {
  let r = Math.random() * SPECIAL_CARDS_TOTAL_WEIGHT;
  for (const c of SPECIAL_CARDS) {
    r -= c.weight;
    if (r <= 0) return c.id;
  }
  return SPECIAL_CARDS[0].id;
}
const MAX_CARDS_PER_PLAYER = 3;
const CARDS_DRAW_INTERVAL = 5; // 5턴마다 카드 1장

function newPlayerState(name, isGuest, avatarUrl) {
  return {
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    joinedAt: Date.now(),
    connected: true,
    color: 0,    // 1~8, 배정 전 0
    team: null,  // 0|1 (팀전만)
    cards: [],   // 초딩 모드 보유 카드 id 배열
  };
}

function newBotState(level, seq) {
  const lv = OMOK_BOT_LEVELS.includes(level) ? level : "normal";
  const p = newPlayerState(`🤖 봇${seq}(${BOT_LABEL[lv]})`, false, null);
  p.isBot = true;
  p.botLevel = lv;
  return p;
}
function hasConnectedHuman(room) {
  for (const p of room.players.values()) if (!p.isBot && p.connected) return true;
  return false;
}
function hasHuman(room) {
  for (const p of room.players.values()) if (!p.isBot) return true;
  return false;
}

function countTeam(room, team) {
  let n = 0;
  for (const uid of room.playerOrder) {
    if (room.players.get(uid)?.team === team) n++;
  }
  return n;
}

function isColorTaken(room, color, exceptUserId) {
  for (const uid of room.playerOrder) {
    if (uid === exceptUserId) continue;
    if (room.players.get(uid)?.color === color) return true;
  }
  return false;
}

// Fisher-Yates 셔플
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// 팀 자동 배정: 입장 순서대로 좌우 인터리브, 색은 팀당 고정
// 팀별 색 매핑: 0=빨강(1), 1=파랑(2), 2=초록(3), 3=노랑(4)
const TEAM_COLOR_MAP = [1, 2, 3, 4];
function reassignColorsAndTeams(room) {
  const m = room.mode;
  const info = MODE_INFO[m];
  const order = room.playerOrder;
  if (m === "1v1") {
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.color = i === 0 ? 1 : 2; // red, blue
      p.team = null;
    });
  } else if (info && info.teams >= 2) {
    // N팀 인터리브: i % teams로 팀 배정, 팀별 고정색 (빨/파/초/노)
    const teams = info.teams;
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      const team = i % teams;
      p.team = team;
      p.color = TEAM_COLOR_MAP[team];
    });
  } else if (m === "ffa") {
    order.forEach((uid, i) => {
      const p = room.players.get(uid);
      if (!p) return;
      p.color = (i % 8) + 1;
      p.team = null;
    });
  }
}

// 보드 인덱스
function idx(size, x, y) { return y * size + x; }

// ===== 초딩 모드 도우미 =====
// 이 색 돌의 주인(팀전이면 같은 색 여럿 → 입장 순서상 첫 사람)
function ownerIdOfColor(room, color) {
  return room.playerOrder.find(uid => room.players.get(uid)?.color === color) || null;
}
// me 기준으로 v 색 돌이 적 돌인가 (팀전 같은 팀 돌은 아군)
function isEnemyStone(room, me, v) {
  if (!v || v === me.color) return false;
  if (me.team != null) {
    const owner = room.players.get(ownerIdOfColor(room, v));
    if (owner && owner.team === me.team) return false;
  }
  return true;
}
function isShielded(room, x, y) {
  if (room.shields && room.shields.has(`${x},${y}`)) return true;
  return room.specialMode === "aug" && isSolid(room, x, y);
}
// 증강 '철벽 진형': 주인이 가진 색의 돌이 4개 이상 이어져 있으면 보호
function runLen(board, W, x, y, color) {
  let best = 0;
  for (const [dx, dy] of DIRS) {
    let n = 1, cx = x + dx, cy = y + dy;
    while (cx >= 0 && cy >= 0 && cx < W && cy < W && board[idx(W, cx, cy)] === color) { n++; cx += dx; cy += dy; }
    cx = x - dx; cy = y - dy;
    while (cx >= 0 && cy >= 0 && cx < W && cy < W && board[idx(W, cx, cy)] === color) { n++; cx -= dx; cy -= dy; }
    if (n > best) best = n;
  }
  return best;
}
function isSolid(room, x, y) {
  const v = room.board[idx(room.boardSize, x, y)];
  if (!v) return false;
  const owner = room.players.get(ownerIdOfColor(room, v));
  return hasAug(owner, "pSolid") && runLen(room.board, room.boardSize, x, y, v) >= 4;
}
function inBoard(W, ...nums) {
  return nums.every(n => Number.isInteger(n) && n >= 0 && n < W);
}
// 여러 칸이 바뀐 뒤 승리 검사 — 카드 쓴 사람 색을 먼저 봄
function findWinAmong(room, cells, preferColor) {
  const W = room.boardSize;
  const sorted = cells.slice().sort((a, b) => {
    const ca = room.board[idx(W, a.x, a.y)], cb = room.board[idx(W, b.x, b.y)];
    return (cb === preferColor) - (ca === preferColor);
  });
  for (const c of sorted) {
    const v = room.board[idx(W, c.x, c.y)];
    if (!v) continue;
    const line = findWinLine(room.board, W, c.x, c.y, v, room.winLength);
    if (line) return { line, color: v };
  }
  return null;
}
function setWinner(room, line, color) {
  const uid = ownerIdOfColor(room, color);
  room.winLine = line;
  room.winnerUserId = uid;
  room.winnerTeam = uid ? (room.players.get(uid)?.team ?? null) : null;
}
// 다음 차례 사람(나 다음, 같은 팀 제외) — 시간도둑 대상
function nextEnemyUid(room, me) {
  const n = room.playerOrder.length;
  for (let k = 1; k < n; k++) {
    const uid = room.playerOrder[(room.currentTurnIdx + k) % n];
    const p = room.players.get(uid);
    if (!p) continue;
    if (me.team != null && p.team === me.team) continue;
    return uid;
  }
  return null;
}

// N목 검사 — 마지막 착수 좌표에서 4방향, 승리 길이는 winLength (3/4/5)
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
function findWinLine(board, size, x, y, color, winLength) {
  const need = Math.max(3, Math.min(5, winLength || 5));
  for (const [dx, dy] of DIRS) {
    const line = [{x, y}];
    let cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < size && cy >= 0 && cy < size && board[idx(size, cx, cy)] === color) {
      line.push({x: cx, y: cy});
      cx += dx; cy += dy;
    }
    cx = x - dx; cy = y - dy;
    while (cx >= 0 && cx < size && cy >= 0 && cy < size && board[idx(size, cx, cy)] === color) {
      line.unshift({x: cx, y: cy});
      cx -= dx; cy -= dy;
    }
    if (line.length >= need) return line.slice(0, need);
  }
  return null;
}

// ===== 공개용 직렬화 =====
function publicPlayer(userId, p) {
  if (!p) return null;
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    connected: p.connected,
    color: p.color,
    team: p.team,
    cardCount: (p.cards || []).length, // 카드 개수만 공개 (내용 비공개)
    augs: (p.augs || []).slice(),       // 증강 모드: 고른 증강은 모두에게 공개
    moves: p.myMoves || 0,
    isBot: !!p.isBot,
    botLevel: p.isBot ? p.botLevel : null,
  };
}

function publicRoom(room, viewerUserId = null) {
  // 벽 정보 — 모두에게 공개
  const walls = [];
  if (room.walls) for (const [key, v] of room.walls) walls.push({ key, expireAtTurn: v.expireAtTurn });
  // 투명돌 — 본인 ghost는 색 노출, 다른 사람 ghost는 위치만 + ❓
  const ghosts = [];
  if (room.ghosts) for (const [key, g] of room.ghosts) {
    const isMine = viewerUserId && g.ownerId === viewerUserId;
    ghosts.push({
      key,
      ownerId: g.ownerId,
      color: isMine ? g.color : null,    // 본인만 색 보임
      expireAtTurn: g.expireAtTurn,
    });
  }
  // 방패 — 모두에게 공개 (어떤 돌이 보호 중인지 알아야 폭탄 대상에서 뺌)
  const shields = [];
  if (room.shields) for (const [key, v] of room.shields) shields.push({ key, expireAtTurn: v.expireAtTurn });
  // 증강 '철벽 진형'으로 보호 중인 돌도 방패처럼 표시 (카드 고를 때 빛나는 칸에서 빠지게)
  if (room.specialMode === "aug" && room.status === "playing") {
    const W = room.boardSize;
    for (let i = 0; i < room.board.length; i++) { const x = i % W, y = (i / W) | 0; if (room.board[i] && !room.shields.has(`${x},${y}`) && isSolid(room, x, y)) shields.push({ key: `${x},${y}`, expireAtTurn: null, solid: true }); }
  }
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    mode: room.mode,
    specialMode: room.specialMode || "off",
    boardSize: room.boardSize,
    turnTimeSec: room.turnTimeSec,
    winLength: room.winLength,
    maxPlayers: room.maxPlayers,
    ffaSize: room.ffaSize,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
    currentTurnUserId: room.status === "playing" ? (room.playerOrder[room.currentTurnIdx] || null) : null,
    turnDeadline: room.turnDeadline,
    lastMove: room.lastMove,
    winLine: room.winLine,
    winnerUserId: room.winnerUserId,
    winnerTeam: room.winnerTeam,
    historyLen: room.history.length,
    turnCount: room.turnCount || 0,
    walls,
    ghosts,
    shields,
    timeThiefUserId: room.timeThiefFor || null,
    augPick: room.pick ? { round: room.pick.round, deadline: room.pick.deadline, userId: room.pick.uid, name: room.players.get(room.pick.uid)?.name || "" } : null,
    augLog: room.specialMode === "aug" ? (room.augLog || []).slice(-12) : undefined,
  };
}

// 본인에게만 자기 카드 목록 전송
function emitMyCards(io, room, userId) {
  const p = room.players.get(userId);
  if (!p) return;
  // 해당 user의 socket을 찾아 전달
  for (const [sid, s] of io.sockets.sockets) {
    if (s.user?.id === userId) {
      s.emit("omok:yourCards", { cards: (p.cards || []).slice() });
    }
  }
}

// ===== 타이머 =====
function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearBotTimer(room) {
  if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  clearTurnTimer(room);
  clearBotTimer(room);
  clearEmptyRoomTimer(room);
  omokRooms.delete(room.id);
  omokInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (omokUserRoom.get(uid) === room.id) omokUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("omok:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[omok] room ${room.id} deleted: ${reason}`);
}

function broadcastRoomState(io, room) {
  // ghost는 본인에게만 색 노출 → per-socket 송신
  if (room.ghosts && room.ghosts.size > 0) {
    for (const [sid, s] of io.sockets.sockets) {
      const room2 = s.user?.id ? omokRooms.get(omokUserRoom.get(s.user.id)) : null;
      if (room2 !== room) continue;
      s.emit("omok:roomState", publicRoom(room, s.user?.id || null));
    }
  } else {
    io.to(socketRoomName(room.id)).emit("omok:roomState", publicRoom(room));
  }
}

// ===== 게임 진행 =====
function startTurn(io, room) {
  if (room.status !== "playing") return;
  // 증강 모드: 고르는 중이면 차례를 시작하지 않음 / 고를 때가 됐으면 고르기부터
  if (room.specialMode === "aug") {
    if (room.pick) return resendPick(io, room);
  }
  room.turnUses = 0; // 이번 차례 카드 사용 횟수

  // 연결된 플레이어 찾을 때까지 인덱스 진행 (skip disconnected)
  let safety = room.playerOrder.length;
  while (safety-- > 0) {
    const uid = room.playerOrder[room.currentTurnIdx];
    const p = room.players.get(uid);
    if (p && p.connected) break;
    room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  }
  // 모두 끊겨있으면 그냥 대기 (사람이 없으면 봇끼리 계속 두지 않고 멈춤)
  const turnUid = room.playerOrder[room.currentTurnIdx];
  const turnPlayer = room.players.get(turnUid);
  if (!turnPlayer?.connected || !hasConnectedHuman(room)) {
    return;
  }
  // 증강 모드: 이번 차례 사람이 고를 때가 됐으면 그 사람만 먼저 고름
  if (room.specialMode === "aug" && pickDueFor(turnPlayer)) return beginPick(io, room, turnUid);
  clearBotTimer(room);

  // 시간도둑: 이번 차례가 대상이면 제한 시간 절반 (재행동으로 이어지는 같은 사람 차례엔 다시 안 깎음)
  let sec = room.turnTimeSec;
  let timeStolen = false;
  if (room.specialMode === "aug") {
    if (hasAug(turnPlayer, "pTime")) sec = Math.ceil(sec * 1.5);
    if (room.playerOrder.some(u => u !== turnUid && hasAug(room.players.get(u), "pPress"))) sec = Math.max(TIME_THIEF_MIN_SEC, Math.floor(sec * 0.75));
  }
  if (room.timeThiefFor && room.timeThiefFor === turnUid) {
    sec = Math.max(TIME_THIEF_MIN_SEC, Math.ceil(sec / 2));
    room.timeThiefFor = null;
    timeStolen = true;
  }
  room.turnDeadline = Date.now() + sec * 1000;

  io.to(socketRoomName(room.id)).emit("omok:turnStart", {
    turnUserId: turnUid,
    turnDeadline: room.turnDeadline,
    turnTimeSec: sec,
    timeStolen,
  });

  clearTurnTimer(room);
  room.turnTimer = setTimeout(() => onTurnTimeout(io, room, turnUid), sec * 1000);

  if (turnPlayer.isBot) scheduleBot(io, room, turnUid);
  else if (room.specialMode === "aug") sendSense(io, room, turnUid);
}

// ===== AI 봇 =====
function scheduleBot(io, room, uid) {
  clearBotTimer(room);
  const p = room.players.get(uid);
  const [lo, hi] = BOT_DELAY_MS[p?.botLevel] || BOT_DELAY_MS.normal;
  const delay = lo + Math.floor(Math.random() * (hi - lo));
  const histLen = room.history.length;
  room.botTimer = setTimeout(() => botTurn(io, room, uid, histLen), delay);
}

function botTurn(io, room, uid, histLen) {
  room.botTimer = null;
  if (!omokRooms.has(room.id) || room.status !== "playing") return;
  // 그 사이 차례가 바뀌었거나 이미 착수가 일어났으면 무시
  if (room.playerOrder[room.currentTurnIdx] !== uid || room.history.length !== histLen || room.pick) return;
  if (!hasConnectedHuman(room)) return;
  const bot = room.players.get(uid);
  if (!bot) return;
  try {
    const mv = chooseOmokMove(room, uid, bot.botLevel);
    if (mv && placeStone(io, room, uid, mv.x, mv.y).ok) return;
    // 예외 상황(벽/투명돌과 겹침 등): 아무 합법 칸이나
    const size = room.boardSize;
    const start = Math.floor(Math.random() * room.board.length);
    for (let k = 0; k < room.board.length; k++) {
      const i = (start + k) % room.board.length;
      if (room.board[i] !== 0) continue;
      if (placeStone(io, room, uid, i % size, Math.floor(i / size)).ok) return;
    }
  } catch (e) {
    console.error("[omok:bot]", e);
  }
  // 둘 곳이 없으면 패스
  if (room.status === "playing" && room.playerOrder[room.currentTurnIdx] === uid) {
    clearTurnTimer(room);
    io.to(socketRoomName(room.id)).emit("omok:turnPass", { userId: uid, name: bot.name, timedOut: false });
    passTurn(io, room);
  }
}

// 착수 없이 차례를 넘김 (시간초과·끊김·봇 둘 곳 없음) — 재행동 효과는 버림, 턴 수는 셈(벽·투명돌 만료)
function passTurn(io, room) {
  room.replayNext = false;
  if (endTurnCommon(io, room)) return;
  room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  startTurn(io, room);
  if (cardMode(room)) broadcastRoomState(io, room);
}

// 한 턴이 끝날 때 공통 처리: 턴 수 +1, 벽·방패 만료, 투명돌 공개(+승리 검사), 카드 지급.
// 게임이 끝났으면 true
function endTurnCommon(io, room) {
  room.turnCount = (room.turnCount || 0) + 1;
  if (room.walls && room.walls.size > 0) {
    for (const [k, v] of room.walls) if (room.turnCount >= v.expireAtTurn) room.walls.delete(k);
  }
  if (room.shields && room.shields.size > 0) {
    for (const [k, v] of room.shields) {
      const [sx, sy] = k.split(",").map(Number);
      // 만료됐거나 그 칸 돌이 사라졌으면 방패도 없앰
      if (room.turnCount >= v.expireAtTurn || room.board[idx(room.boardSize, sx, sy)] === 0) room.shields.delete(k);
    }
  }
  if (room.ghosts && room.ghosts.size > 0) {
    const revealed = [];
    for (const [k, g] of room.ghosts) {
      if (room.turnCount < g.expireAtTurn) continue;
      const [gx, gy] = k.split(",").map(Number);
      const gi = idx(room.boardSize, gx, gy);
      if (room.board[gi] === 0) {
        room.board[gi] = g.color;
        revealed.push({ x: gx, y: gy, color: g.color, ownerId: g.ownerId });
      }
      room.ghosts.delete(k);
    }
    for (const r of revealed) io.to(socketRoomName(room.id)).emit("omok:ghostReveal", r);
    for (const r of revealed) {
      let win = findWinLine(room.board, room.boardSize, r.x, r.y, r.color, room.winLength);
      if (win) win = resolveWin(io, room, win, r.color);
      if (win) {
        room.winLine = win;
        room.winnerUserId = r.ownerId;
        room.winnerTeam = room.players.get(r.ownerId)?.team ?? null;
        endGame(io, room, win);
        return true;
      }
    }
  }
  if (room.specialMode === "kid" && room.turnCount % CARDS_DRAW_INTERVAL === 0) {
    // 모든 플레이어에게 카드 1장 (가득 찬 사람은 건너뜀)
    for (const uid of room.playerOrder) {
      const p = room.players.get(uid);
      if (!p) continue;
      if ((p.cards || []).length >= MAX_CARDS_PER_PLAYER) continue;
      p.cards.push(drawRandomCard());
      emitMyCards(io, room, uid);
    }
    io.to(socketRoomName(room.id)).emit("omok:cardDraw", { turn: room.turnCount });
  }
  return false;
}

// ===== 증강 모드 (1대1) =====
function emitToUser(io, userId, ev, data) {
  for (const [, s] of io.sockets.sockets) if (s.user?.id === userId) s.emit(ev, data);
}
function logAug(io, room, entry) {
  room.augLog = room.augLog || [];
  const e = { at: Date.now(), turn: room.turnCount || 0, ...entry };
  room.augLog.push(e); if (room.augLog.length > 60) room.augLog.splice(0, room.augLog.length - 60);
  io.to(socketRoomName(room.id)).emit("omok:augEvent", e);
}
// (2026-11-16 사용자 요청) 증강 고르기는 '각자 따로': 내 돌이 0·5·10·15개가 된 뒤 '내 차례가 올 때' 나만 고름.
// 상대 화면엔 고르기 창이 안 뜨고 "상대가 증강 고르는 중"만 보임. 고르는 동안 내 차례 시계는 멈춤
function pickDueFor(p) {
  if (!p) return false;
  const k = p.pickIdx || 0;
  if (k >= AUG_PICK_MOVES.length || (p.augs || []).length >= MAX_AUGS) return false;
  return (p.myMoves || 0) >= AUG_PICK_MOVES[k];
}
function offerView(p) {
  return { offers: (p.augOffer || []).map(id => AUG_BY_ID.get(id)), refresh: p.augRefresh || 0, picked: !!p.augPicked };
}
let PICK_SEQ = 0;
function beginPick(io, room, uid) {
  const p = room.players.get(uid); if (!p) return;
  clearTurnTimer(room); clearBotTimer(room);
  const round = (p.pickIdx || 0) + 1, seq = ++PICK_SEQ;
  room.turnDeadline = null;
  const lucky = hasAug(p, "pLuck");
  p.augOffer = rollOffer(p, room, lucky ? 4 : 3);
  p.augRefresh = lucky ? 2 : 1;
  p.augPicked = false;
  if (!p.augOffer.length) { p.pickIdx = AUG_PICK_MOVES.length; return startTurn(io, room); } // 고를 게 없으면 넘어감
  room.pick = { uid, round, seq, deadline: Date.now() + AUG_PICK_SEC * 1000, timer: null };
  room.pick.timer = setTimeout(() => finishPick(io, room, seq), AUG_PICK_SEC * 1000 + 300);
  // 봇·끊긴 사람은 조금 뒤 자동
  if (p.isBot || !p.connected) setTimeout(() => { if (room.pick && room.pick.seq === seq && !p.augPicked) pickAug(io, room, uid, bestOf(p.augOffer)); }, 600 + Math.random() * 1200);
  io.to(socketRoomName(room.id)).emit("omok:augPhase", { picking: true, round, deadline: room.pick.deadline, userId: uid, name: p.name });
  resendPick(io, room);
  broadcastRoomState(io, room);
}
function resendPick(io, room) {
  if (!room.pick) return;
  const p = room.players.get(room.pick.uid);
  if (p && !p.isBot) emitToUser(io, room.pick.uid, "omok:augOffer", { round: room.pick.round, deadline: room.pick.deadline, ...offerView(p) });
}
function pickAug(io, room, uid, id) {
  const p = room.players.get(uid);
  if (!room.pick) return { ok: false, error: "NOT_PICKING" };
  if (!p) return { ok: false, error: "NOT_PLAYER" };
  if (room.pick.uid !== uid) return { ok: false, error: "NOT_YOUR_PICK" };
  if (p.augPicked) return { ok: false, error: "ALREADY_PICKED" };
  if (!(p.augOffer || []).includes(id)) return { ok: false, error: "NOT_OFFERED" };
  const r = applyAug(p, id, room);
  p.augPicked = true; p.augOffer = [];
  emitMyCards(io, room, uid);
  logAug(io, room, { type: "pick", userId: uid, name: p.name, augId: id, cards: r.cards });
  finishPick(io, room, room.pick.seq);
  return { ok: true, augId: id, cards: r.cards };
}
function refreshAug(io, room, uid) {
  const p = room.players.get(uid);
  if (!room.pick || room.pick.uid !== uid || !p || p.augPicked) return { ok: false, error: "NOT_PICKING" };
  if ((p.augRefresh || 0) <= 0) return { ok: false, error: "NO_REFRESH" };
  p.augRefresh--;
  p.augOffer = rollOffer(p, room, hasAug(p, "pLuck") ? 4 : 3);
  return { ok: true, ...offerView(p) };
}
function finishPick(io, room, seq) {
  if (!room.pick || room.pick.seq !== seq || room.status !== "playing") return;
  if (room.pick.timer) clearTimeout(room.pick.timer);
  const { uid, round } = room.pick;
  const p = room.players.get(uid);
  // 시간 안에 못 고르면 가장 좋은 등급으로 자동
  if (p && !p.augPicked && p.augOffer?.length) { const id = bestOf(p.augOffer); const r = applyAug(p, id, room); p.augPicked = true; p.augOffer = []; emitMyCards(io, room, uid); logAug(io, room, { type: "pick", userId: uid, name: p.name, augId: id, cards: r.cards, auto: true }); }
  if (p) p.pickIdx = (p.pickIdx || 0) + 1;
  room.pick = null;
  io.to(socketRoomName(room.id)).emit("omok:augPhase", { picking: false, round, userId: uid });
  startTurn(io, room); // 같은 사람 차례가 이제 시작 (고를 게 더 있으면 이어서 고름)
  broadcastRoomState(io, room);
}
// 이기는 줄이 생겼을 때: 상대에게 '최후의 반격'이 남아 있으면 그 줄 가운데 돌을 없애고 계속.
// 끝까지 이기는 줄이 남으면 그 줄을, 다 막혔으면 null
function resolveWin(io, room, line, color) {
  if (room.specialMode !== "aug" || !line) return line;
  const W = room.boardSize;
  const winnerUid = ownerIdOfColor(room, color);
  const winner = room.players.get(winnerUid);
  let cur = line;
  for (let guard = 0; cur && guard < 4; guard++) {
    const blockerUid = room.playerOrder.find(u => {
      const q = room.players.get(u);
      return q && u !== winnerUid && q.color !== color && !(winner && winner.team != null && q.team === winner.team) && hasAug(q, "pSecond") && !q.secondUsed;
    });
    if (!blockerUid) return cur;
    const q = room.players.get(blockerUid);
    q.secondUsed = true;
    const mid = cur[Math.floor(cur.length / 2)];
    room.board[idx(W, mid.x, mid.y)] = 0;
    room.shields.delete(`${mid.x},${mid.y}`);
    logAug(io, room, { type: "second", userId: blockerUid, name: q.name, x: mid.x, y: mid.y, board: Array.from(room.board) });
    const again = findWinAmong(room, cur.filter(c => c !== mid), color);
    cur = again ? again.line : null;
  }
  if (!cur) { room.winLine = null; room.winnerUserId = null; room.winnerTeam = null; }
  return cur;
}
// 돌을 둔 뒤: 내 돌 수, 연속 착수, 카드 수집, 상대의 긴급 방어
function afterAugPlace(io, room, uid, player, x, y) {
  player.myMoves = (player.myMoves || 0) + 1;
  const every = bonusEvery(player);
  if (every && player.myMoves % every === 0 && !room.replayNext) {
    room.replayNext = true;
    logAug(io, room, { type: "bonus", userId: uid, name: player.name });
  }
  if (hasAug(player, "pCollect") && player.myMoves % 6 === 0 && player.cards.length < MAX_AUG_HAND) {
    player.cards.push(randomPoolCard()); emitMyCards(io, room, uid);
    logAug(io, room, { type: "collect", userId: uid, name: player.name });
  }
  // 긴급 방어: 상대가 (N-1)목을 만들면 그 끝 빈 칸에 벽 (상대의 다음 차례까지)
  const W = room.boardSize, need = room.winLength, color = player.color;
  if (room.board[idx(W, x, y)] !== color) return; // 반격으로 방금 돌이 사라졌으면 볼 것 없음
  for (const qid of room.playerOrder) {
    const q = room.players.get(qid);
    if (!q || qid === uid || q.color === color || !hasAug(q, "pInstinct") || (q.instinctNext || 0) > room.turnCount) continue;
    for (const [dx, dy] of DIRS) {
      let a = 0, cx = x + dx, cy = y + dy;
      while (inBoard(W, cx, cy) && room.board[idx(W, cx, cy)] === color) { a++; cx += dx; cy += dy; }
      const e1 = { x: cx, y: cy };
      let b = 0; cx = x - dx; cy = y - dy;
      while (inBoard(W, cx, cy) && room.board[idx(W, cx, cy)] === color) { b++; cx -= dx; cy -= dy; }
      const e2 = { x: cx, y: cy };
      if (a + b + 1 !== need - 1) continue;
      const ok = [e1, e2].filter(e => inBoard(W, e.x, e.y) && room.board[idx(W, e.x, e.y)] === 0 && !room.walls.has(`${e.x},${e.y}`) && !room.ghosts.has(`${e.x},${e.y}`));
      if (!ok.length) continue;
      const e = ok[Math.floor(Math.random() * ok.length)];
      room.walls.set(`${e.x},${e.y}`, { placedByUserId: qid, expireAtTurn: room.turnCount + 3 });
      q.instinctNext = room.turnCount + 3 * room.playerOrder.length;
      logAug(io, room, { type: "instinct", userId: qid, name: q.name, x: e.x, y: e.y });
      return;
    }
  }
}
// 이 색이 다음에 두면 N목(win)·(N-1)목(four)이 되는 빈 칸
function threatCells(room, color) {
  const W = room.boardSize, need = room.winLength, win = [], four = [];
  for (let i = 0; i < room.board.length; i++) {
    if (room.board[i] !== 0) continue;
    const x = i % W, y = (i / W) | 0;
    if (room.walls.has(`${x},${y}`) || room.ghosts.has(`${x},${y}`)) continue;
    room.board[i] = color;
    const n = runLen(room.board, W, x, y, color);
    room.board[i] = 0;
    if (n >= need) win.push({ x, y }); else if (n === need - 1 && need >= 4) four.push({ x, y });
  }
  return { win, four: four.slice(0, 40) };
}
function sendSense(io, room, uid) {
  const p = room.players.get(uid);
  const def = senseOn(p, "pDefSense"), atk = senseOn(p, "pAtkSense");
  if (!def && !atk) return;
  const out = { turn: room.turnCount };
  if (atk) out.atk = threatCells(room, p.color);
  if (def) {
    const enemyColors = [...new Set(room.playerOrder.map(u => room.players.get(u)).filter(q => q && q.color !== p.color && !(p.team != null && q.team === p.team)).map(q => q.color))];
    const w = [], f = [];
    for (const c of enemyColors) { const t = threatCells(room, c); w.push(...t.win); f.push(...t.four); }
    out.def = { win: w, four: f.slice(0, 40) };
  }
  emitToUser(io, uid, "omok:augHints", out);
}

function onTurnTimeout(io, room, expectedTurnUid) {
  if (room.status !== "playing") return;
  const turnUid = room.playerOrder[room.currentTurnIdx];
  if (turnUid !== expectedTurnUid) return; // 이미 다음 차례로 넘어감

  const p = room.players.get(turnUid);
  // 시간초과 = 자동 패스 (착수 X, 차례 넘김)
  io.to(socketRoomName(room.id)).emit("omok:turnPass", {
    userId: turnUid,
    name: p?.name || "?",
    timedOut: true,
  });
  passTurn(io, room);
}

// ===== 카드 효과 적용 =====
// 반환: { ok, error?, effect?, private? }
// 보드가 바뀌어 누군가 이기면 room.winLine 등만 채워 둠 — 끝내기는 useCard 처리에서 바로 함
function applyCardEffect(io, room, userId, cardId, payload) {
  const me = room.players.get(userId);
  if (!me) return { ok: false, error: "NOT_PLAYER" };
  const W = room.boardSize;
  const walled = (x, y) => room.walls.has(`${x},${y}`);
  const ghosted = (x, y) => room.ghosts.has(`${x},${y}`);

  if (cardId === "bomb" || cardId === "flip") {
    const x = Number(payload.x), y = Number(payload.y);
    if (!inBoard(W, x, y)) return { ok: false, error: "INVALID_COORD" };
    const i = idx(W, x, y);
    const v = room.board[i];
    if (v === 0) return { ok: false, error: "EMPTY_CELL" };
    if (v === me.color) return { ok: false, error: "OWN_STONE" };
    if (!isEnemyStone(room, me, v)) return { ok: false, error: "OWN_TEAM_STONE" };
    if (isShielded(room, x, y)) return { ok: false, error: "SHIELDED" };
    if (cardId === "bomb") {
      room.board[i] = 0;
      return { ok: true, effect: { type: "bomb", x, y } };
    }
    room.board[i] = me.color;
    const win = findWinLine(room.board, W, x, y, me.color, room.winLength);
    if (win) setWinner(room, win, me.color);
    return { ok: true, effect: { type: "flip", x, y, color: me.color } };
  }

  if (cardId === "move") {
    // 내 돌 1개 → 빈 칸 (벽·투명돌 칸 불가)
    const fx = Number(payload.fromX), fy = Number(payload.fromY);
    const tx = Number(payload.toX), ty = Number(payload.toY);
    if (!inBoard(W, fx, fy, tx, ty)) return { ok: false, error: "INVALID_COORD" };
    const fi = idx(W, fx, fy), ti = idx(W, tx, ty);
    if (room.board[fi] !== me.color) return { ok: false, error: "NOT_OWN_STONE" };
    if (room.board[ti] !== 0) return { ok: false, error: "TARGET_OCCUPIED" };
    if (walled(tx, ty)) return { ok: false, error: "TARGET_WALLED" };
    if (ghosted(tx, ty)) return { ok: false, error: "GHOST_HERE" };
    room.board[fi] = 0;
    room.board[ti] = me.color;
    // 방패는 돌을 따라감
    const sk = `${fx},${fy}`;
    if (room.shields.has(sk)) { room.shields.set(`${tx},${ty}`, room.shields.get(sk)); room.shields.delete(sk); }
    const win = findWinLine(room.board, W, tx, ty, me.color, room.winLength);
    if (win) setWinner(room, win, me.color);
    return { ok: true, effect: { type: "move", fromX: fx, fromY: fy, toX: tx, toY: ty } };
  }

  if (cardId === "replay") {
    if (room.replayNext) return { ok: false, error: "REPLAY_ALREADY" };
    room.replayNext = true;
    return { ok: true, effect: { type: "replay" } };
  }

  if (cardId === "lightning") {
    // 무작위 적 돌 1개 제거 (방패 돌 제외)
    const candidates = [];
    for (let i = 0; i < room.board.length; i++) {
      const v = room.board[i];
      if (!isEnemyStone(room, me, v)) continue;
      if (isShielded(room, i % W, Math.floor(i / W))) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return { ok: false, error: "NO_TARGET" };
    const i = candidates[Math.floor(Math.random() * candidates.length)];
    room.board[i] = 0;
    return { ok: true, effect: { type: "lightning", x: i % W, y: Math.floor(i / W) } };
  }

  if (cardId === "wall" || cardId === "ghost") {
    const x = Number(payload.x), y = Number(payload.y);
    if (!inBoard(W, x, y)) return { ok: false, error: "INVALID_COORD" };
    if (room.board[idx(W, x, y)] !== 0) return { ok: false, error: "OCCUPIED" };
    const key = `${x},${y}`;
    if (walled(x, y)) return { ok: false, error: "WALL_ALREADY" };
    if (ghosted(x, y)) return { ok: false, error: "GHOST_HERE" };
    if (cardId === "wall") {
      room.walls.set(key, { placedByUserId: userId, expireAtTurn: room.turnCount + WALL_DURATION_TURNS + 1 });
      return { ok: true, effect: { type: "wall", x, y } };
    }
    room.ghosts.set(key, { ownerId: userId, color: me.color, expireAtTurn: room.turnCount + GHOST_REVEAL_TURNS + 1 });
    return { ok: true, effect: { type: "ghost", x, y, owner: userId } };
  }

  if (cardId === "push") {
    // 인접 돌 1칸 밀기 (상하좌우)
    const fx = Number(payload.fromX), fy = Number(payload.fromY);
    const tx = Number(payload.toX), ty = Number(payload.toY);
    if (!inBoard(W, fx, fy, tx, ty)) return { ok: false, error: "INVALID_COORD" };
    const fi = idx(W, fx, fy), ti = idx(W, tx, ty);
    if (room.board[fi] === 0) return { ok: false, error: "EMPTY_FROM" };
    if (room.board[ti] !== 0) return { ok: false, error: "TARGET_OCCUPIED" };
    if (Math.abs(tx - fx) + Math.abs(ty - fy) !== 1) return { ok: false, error: "NOT_ADJACENT" };
    if (walled(tx, ty)) return { ok: false, error: "TARGET_WALLED" };
    if (ghosted(tx, ty)) return { ok: false, error: "GHOST_HERE" };
    // 방패 돌은 적이 못 밂 (내 돌·아군 돌은 밀 수 있고 방패도 따라감)
    const pushedColor = room.board[fi];
    const sk = `${fx},${fy}`;
    if (room.shields.has(sk) && isEnemyStone(room, me, pushedColor)) return { ok: false, error: "SHIELDED" };
    room.board[fi] = 0;
    room.board[ti] = pushedColor;
    if (room.shields.has(sk)) { room.shields.set(`${tx},${ty}`, room.shields.get(sk)); room.shields.delete(sk); }
    const win = findWinLine(room.board, W, tx, ty, pushedColor, room.winLength);
    if (win) setWinner(room, win, pushedColor);
    return { ok: true, effect: { type: "push", fromX: fx, fromY: fy, toX: tx, toY: ty } };
  }

  if (cardId === "cross") {
    // 고른 칸의 상하좌우 4칸 적 돌 제거 (가운데 칸은 그대로, 방패 돌 제외)
    const x = Number(payload.x), y = Number(payload.y);
    if (!inBoard(W, x, y)) return { ok: false, error: "INVALID_COORD" };
    const removed = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inBoard(W, nx, ny)) continue;
      const v = room.board[idx(W, nx, ny)];
      if (!isEnemyStone(room, me, v) || isShielded(room, nx, ny)) continue;
      removed.push({ x: nx, y: ny });
    }
    if (removed.length === 0) return { ok: false, error: "NO_TARGET" };
    for (const c of removed) room.board[idx(W, c.x, c.y)] = 0;
    return { ok: true, effect: { type: "cross", x, y, removed } };
  }

  if (cardId === "swap") {
    // 내 돌 ↔ 바로 옆(8방향) 적 돌 자리 바꾸기
    const fx = Number(payload.fromX), fy = Number(payload.fromY);
    const tx = Number(payload.toX), ty = Number(payload.toY);
    if (!inBoard(W, fx, fy, tx, ty)) return { ok: false, error: "INVALID_COORD" };
    if (Math.max(Math.abs(tx - fx), Math.abs(ty - fy)) !== 1) return { ok: false, error: "NOT_ADJACENT" };
    const fi = idx(W, fx, fy), ti = idx(W, tx, ty);
    if (room.board[fi] !== me.color) return { ok: false, error: "NOT_OWN_STONE" };
    const ev = room.board[ti];
    if (ev === 0) return { ok: false, error: "EMPTY_CELL" };
    if (!isEnemyStone(room, me, ev)) return { ok: false, error: "OWN_TEAM_STONE" };
    if (isShielded(room, tx, ty)) return { ok: false, error: "SHIELDED" };
    room.board[fi] = ev;
    room.board[ti] = me.color;
    const sk = `${fx},${fy}`;
    if (room.shields.has(sk)) { room.shields.set(`${tx},${ty}`, room.shields.get(sk)); room.shields.delete(sk); }
    const w = findWinAmong(room, [{ x: tx, y: ty }, { x: fx, y: fy }], me.color);
    if (w) setWinner(room, w.line, w.color);
    return { ok: true, effect: { type: "swap", fromX: fx, fromY: fy, toX: tx, toY: ty } };
  }

  if (cardId === "tornado") {
    // 고른 칸 중심 3×3 안의 돌을 무작위로 섞음 (벽·투명돌·방패 칸은 그대로)
    const x = Number(payload.x), y = Number(payload.y);
    if (!inBoard(W, x, y)) return { ok: false, error: "INVALID_COORD" };
    const cells = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inBoard(W, nx, ny) || walled(nx, ny) || ghosted(nx, ny) || isShielded(room, nx, ny)) continue;
      cells.push({ x: nx, y: ny });
    }
    const vals = cells.map(c => room.board[idx(W, c.x, c.y)]);
    const stones = vals.filter(v => v !== 0).length;
    if (stones === 0 || stones === cells.length) return { ok: false, error: "NOTHING_TO_SHUFFLE" };
    // 같은 배치가 나오면 다시 섞기 (최대 10번)
    const before = vals.join(",");
    for (let t = 0; t < 10; t++) { shuffleArr(vals); if (vals.join(",") !== before) break; }
    cells.forEach((c, k) => { room.board[idx(W, c.x, c.y)] = vals[k]; });
    const w = findWinAmong(room, cells, me.color);
    if (w) setWinner(room, w.line, w.color);
    return { ok: true, effect: { type: "tornado", x, y } };
  }

  if (cardId === "shield") {
    // 내 돌 1개를 한 바퀴(모두 한 번씩 둘 때까지) 동안 보호
    const x = Number(payload.x), y = Number(payload.y);
    if (!inBoard(W, x, y)) return { ok: false, error: "INVALID_COORD" };
    const v = room.board[idx(W, x, y)];
    if (v === 0) return { ok: false, error: "EMPTY_CELL" };
    if (isEnemyStone(room, me, v)) return { ok: false, error: "NOT_OWN_STONE" };
    if (isShielded(room, x, y)) return { ok: false, error: "SHIELD_ALREADY" };
    room.shields.set(`${x},${y}`, { ownerId: userId, expireAtTurn: room.turnCount + room.playerOrder.length + 1 });
    return { ok: true, effect: { type: "shield", x, y } };
  }

  if (cardId === "timeThief") {
    const target = nextEnemyUid(room, me);
    if (!target) return { ok: false, error: "NO_TARGET" };
    if (room.timeThiefFor === target) return { ok: false, error: "ALREADY_STOLEN" };
    room.timeThiefFor = target;
    return { ok: true, effect: { type: "timeThief", targetId: target, targetName: room.players.get(target)?.name || "?" } };
  }

  if (cardId === "lucky") {
    // 카드 2장 (가득 차면 그만큼만) — 이 카드는 이미 손에서 빠진 상태
    const space = MAX_CARDS_PER_PLAYER - me.cards.length;
    const n = Math.min(2, space);
    const got = [];
    for (let k = 0; k < n; k++) { const c = drawRandomCard(); me.cards.push(c); got.push(c); }
    return { ok: true, effect: { type: "lucky", count: n } };
  }

  if (cardId === "peek") {
    // 적들의 카드 보기 — 쓴 사람에게만 내용 전달
    const list = [];
    for (const uid of room.playerOrder) {
      const p = room.players.get(uid);
      if (!p || uid === userId) continue;
      if (me.team != null && p.team === me.team) continue;
      list.push({ userId: uid, name: p.name, cards: (p.cards || []).slice() });
    }
    if (list.length === 0) return { ok: false, error: "NO_TARGET" };
    return { ok: true, effect: { type: "peek" }, private: { peek: list } };
  }

  if (cardId === "steal") {
    // 카드가 있는 적 중 무작위 1명에게서 무작위 카드 1장
    if (me.cards.length >= MAX_CARDS_PER_PLAYER) return { ok: false, error: "HAND_FULL" };
    const victims = room.playerOrder.filter(uid => {
      const p = room.players.get(uid);
      if (!p || uid === userId || !(p.cards || []).length) return false;
      return !(me.team != null && p.team === me.team);
    });
    if (victims.length === 0) return { ok: false, error: "NO_TARGET" };
    const vid = victims[Math.floor(Math.random() * victims.length)];
    const vp = room.players.get(vid);
    const card = vp.cards.splice(Math.floor(Math.random() * vp.cards.length), 1)[0];
    me.cards.push(card);
    emitMyCards(io, room, vid);
    return { ok: true, effect: { type: "steal", victimId: vid, victimName: vp.name }, private: { stolen: card } };
  }

  if (cardId === "focus") {
    // 지금 가장 좋은 자리 1곳 (AI '어려움'이 고르는 수) — 쓴 사람에게만
    const mv = chooseOmokMove(room, userId, "hard");
    if (!mv) return { ok: false, error: "NO_TARGET" };
    return { ok: true, effect: { type: "focus" }, private: { focus: { x: mv.x, y: mv.y } } };
  }

  if (cardId === "rewind") {
    // 상대가 마지막에 둔 돌(아직 그 자리에 있는 것)을 없앰. 방패·철벽 돌은 못 없앰
    for (let k = room.history.length - 1; k >= 0; k--) {
      const h = room.history[k];
      if (h.userId === userId) continue;
      const hp = room.players.get(h.userId);
      if (hp && me.team != null && hp.team === me.team) continue;
      if (room.board[idx(W, h.x, h.y)] !== h.color) return { ok: false, error: "NO_TARGET" }; // 이미 바뀐 돌
      if (isShielded(room, h.x, h.y)) return { ok: false, error: "SHIELDED" };
      room.board[idx(W, h.x, h.y)] = 0;
      return { ok: true, effect: { type: "rewind", x: h.x, y: h.y } };
    }
    return { ok: false, error: "NO_TARGET" };
  }

  return { ok: false, error: "UNKNOWN_CARD" };
}

function placeStone(io, room, userId, x, y) {
  if (room.pick) return { ok: false, error: "PICKING" };
  const turnUid = room.playerOrder[room.currentTurnIdx];
  if (turnUid !== userId) return { ok: false, error: "NOT_YOUR_TURN" };
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, error: "INVALID_COORD" };
  if (x < 0 || y < 0 || x >= room.boardSize || y >= room.boardSize) return { ok: false, error: "OUT_OF_BOUNDS" };
  const i = idx(room.boardSize, x, y);
  if (room.board[i] !== 0) return { ok: false, error: "OCCUPIED" };
  // 벽/투명돌 차단
  const key = `${x},${y}`;
  if (room.walls && room.walls.has(key)) return { ok: false, error: "WALLED" };
  if (room.ghosts && room.ghosts.has(key)) return { ok: false, error: "GHOST_HERE" };

  const player = room.players.get(userId);
  if (!player) return { ok: false, error: "NOT_PLAYER" };
  if (!player.color || player.color < 1 || player.color > 8) return { ok: false, error: "NO_COLOR" };

  // 착수
  room.board[i] = player.color;
  room.lastMove = { x, y, color: player.color, userId, ts: Date.now() };
  room.history.push({ userId, x, y, color: player.color, ts: room.lastMove.ts });

  clearTurnTimer(room);

  io.to(socketRoomName(room.id)).emit("omok:move", {
    userId,
    name: player.name,
    color: player.color,
    team: player.team,
    x, y,
    moveIndex: room.history.length - 1,
  });

  // 승리 검사 (호스트가 정한 N목 기준) — 증강 '최후의 반격'이 막을 수 있음
  let win = findWinLine(room.board, room.boardSize, x, y, player.color, room.winLength);
  if (win) win = resolveWin(io, room, win, player.color);
  if (win) {
    room.winLine = win;
    room.winnerUserId = userId;
    room.winnerTeam = player.team;
    return endGame(io, room, win);
  }

  // 보드 가득찼는지
  const fullCount = countNonZero(room.board);
  if (fullCount >= room.boardSize * room.boardSize) {
    room.winnerUserId = null;
    room.winnerTeam = null;
    return endGame(io, room, null, "BOARD_FULL");
  }

  if (room.specialMode === "aug") afterAugPlace(io, room, userId, player, x, y);

  // 턴 마무리 (턴 수·벽/방패 만료·투명돌 공개·카드 지급)
  if (endTurnCommon(io, room)) return { ok: true };

  // 재행동: 같은 플레이어가 한 번 더 두기
  if (room.replayNext) {
    room.replayNext = false;
  } else {
    room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
  }
  startTurn(io, room);
  // 초딩 모드: 벽이 사라지거나 투명돌이 공개된 걸 화면에 알림 (전엔 다른 카드를 쓸 때까지 옛 벽이 남아 보였음)
  if (cardMode(room)) broadcastRoomState(io, room);

  return { ok: true };
}

function countNonZero(arr) {
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) n++;
  return n;
}

function endGame(io, room, winLine, reason = "WIN") {
  if (room.status === "ended") return { ok: true }; // 두 번 끝내기 방지
  room.status = "ended";
  room.replayNext = false;
  room.timeThiefFor = null;
  clearTurnTimer(room);
  clearBotTimer(room);
  if (room.pick) { if (room.pick.timer) clearTimeout(room.pick.timer); room.pick = null; }

  const winnerP = room.winnerUserId ? room.players.get(room.winnerUserId) : null;
  io.to(socketRoomName(room.id)).emit("omok:gameEnd", {
    reason,
    winnerUserId: room.winnerUserId,
    winnerName: winnerP?.name || null,
    winnerColor: winnerP?.color || null,
    winnerTeam: room.winnerTeam,
    winLine: winLine,
    winLength: room.winLength,
    historyLen: room.history.length,
    history: room.history.slice(0),
    // 초딩 모드: 카드로 바뀐 실제 최종 판 (결과 화면 마지막 장면용)
    finalBoard: cardMode(room) ? Array.from(room.board) : null,
    augLog: room.specialMode === "aug" ? (room.augLog || []).slice(-30) : null,
    boardSize: room.boardSize,
    mode: room.mode,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });

  // 일정 시간 뒤 정리 (결과 화면 확인 시간)
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, ENDED_ROOM_TTL_MS);

  return { ok: true };
}

// ===== 핸들러 등록 =====
export function registerOmok(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // ===== createRoom =====
    socket.on("omok:createRoom", async (payload, cb) => {
      { const _f = createFlight("omok", me?.id, cb); if (!_f) return; cb = _f; } // 방 중복 생성 막기
      try {
        // (2026-11-12) 게스트도 일반 방 만들기 가능. 게스트가 AI 대결로 만든 방만 혼자용(1대1 고정)
        const guestAiOnly = !!me.isGuest && payload?.soloAi === true;
        if (omokUserRoom.has(me.id)) {
          const old = omokRooms.get(omokUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, true);
        }

        const mode = (!guestAiOnly && payload?.specialMode !== "aug" && ALLOWED_MODES.includes(payload?.mode)) ? payload.mode : "1v1";
        const boardSize = ALLOWED_BOARD_SIZES.includes(Number(payload?.boardSize))
          ? Number(payload.boardSize) : 15;
        const turnTimeSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 60;
        const winLength = ALLOWED_WIN_LENGTHS.includes(Number(payload?.winLength))
          ? Number(payload.winLength) : 5;
        const ffaSize = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(payload?.ffaSize) || 8));
        const maxPlayers = modeMaxPlayers(mode, ffaSize);
        // 증강 모드는 1대1 전용 (게스트 AI 대결도 가능), 초딩 모드는 기존대로
        const specialMode = payload?.specialMode === "aug" ? "aug" : (!guestAiOnly && payload?.specialMode === "kid") ? "kid" : "off";

        const roomId = `om_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          guestAiOnly,
          status: "lobby",      // lobby | playing | ended
          mode,
          specialMode,          // 'off' | 'kid'
          boardSize,
          turnTimeSec,
          winLength,
          maxPlayers,
          ffaSize: mode === "ffa" ? ffaSize : null,
          createdAt: Date.now(),

          players: new Map(),
          playerOrder: [],

          board: new Int8Array(boardSize * boardSize),
          history: [],
          lastMove: null,
          winLine: null,
          winnerUserId: null,
          winnerTeam: null,

          currentTurnIdx: 0,
          turnCount: 0,          // 누적 턴 수 (카드 지급 기준)
          replayNext: false,     // 다음 턴 한 번 더 두기 플래그
          walls: new Map(),      // key="x,y" → { placedByUserId, expireAtTurn }
          ghosts: new Map(),     // key="x,y" → { ownerId, color, expireAtTurn }
          shields: new Map(),    // key="x,y" → { ownerId, expireAtTurn } (방패)
          timeThiefFor: null,    // 시간도둑 대상 userId
          turnDeadline: null,
          turnTimer: null,
          botTimer: null,
          botSeq: 0,
          emptyRoomTimer: null,
        };
        room.soloAi = payload?.soloAi === true; // AI 대결 방 표시 (공개 방 대상에서 제외)
        omokRooms.set(roomId, room);
        omokInvites.set(inviteCode, roomId);

        // 호스트 등록
        let avatar = null;
        if (!guestAiOnly) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
          } catch {}
        }

        const hostName = String(payload?.nickname || (guestAiOnly ? "게스트" : "방장")).slice(0, 20);
        room.players.set(me.id, newPlayerState(hostName, !!me.isGuest, avatar));
        room.playerOrder.push(me.id);
        omokUserRoom.set(me.id, roomId);
        reassignColorsAndTeams(room);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[omok] created room ${roomId} mode=${mode} board=${boardSize} timer=${turnTimeSec}`);
      } catch (e) {
        console.error("[omok:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== joinRoom =====
    socket.on("omok:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = omokInvites.get(code);
        const room = roomId ? omokRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.guestAiOnly && !room.players.has(me.id)) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status !== "lobby") {
          // 재접속: 이미 방에 있던 유저면 재참가 허용
          if (room.players.has(me.id)) {
            const p = room.players.get(me.id);
            p.connected = true;
            clearEmptyRoomTimer(room);
            socket.join(socketRoomName(roomId));
            omokUserRoom.set(me.id, roomId);
            cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room, me.id), reconnected: true, augMeta: room.specialMode === "aug" ? OMOK_AUGS : undefined });
            broadcastRoomState(io, room);
            if (cardMode(room)) emitMyCards(io, room, me.id); // 재접속하면 내 카드 다시 보여줌
            if (room.pick) resendPick(io, room);
            // 모두 끊겨 멈춰 있던 판(타이머 없음)이면 다시 진행
            if (room.status === "playing") {
              const curBot = room.players.get(room.playerOrder[room.currentTurnIdx])?.isBot;
              if (!room.turnTimer || (curBot && !room.botTimer)) startTurn(io, room);
            }
            return;
          }
          return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        }
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          omokUserRoom.set(me.id, roomId);
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
        const playerName = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);

        if (omokRooms.get(roomId) !== room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" }); if (room.players.has(me.id)) return cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true }); if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" }); if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" }); // 프로필 읽는 사이 동시에 들어온 사람 다시 확인
        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar));
        room.playerOrder.push(me.id);
        omokUserRoom.set(me.id, roomId);
        reassignColorsAndTeams(room);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[omok:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== setOptions (host only, lobby only) =====
    socket.on("omok:setOptions", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      if (room.guestAiOnly && (Object.keys(payload || {}).some(k => k !== "specialMode") || (payload.specialMode !== "aug" && payload.specialMode !== "off"))) return cb?.({ ok: false, error: "NOT_ALLOWED" });

      let changed = false;

      if (payload?.specialMode === "aug" && room.players.size > 2) return cb?.({ ok: false, error: "AUG_1V1_ONLY" });
      if (payload?.mode && ALLOWED_MODES.includes(payload.mode) && payload.mode !== "1v1" && (payload.specialMode ?? room.specialMode) === "aug") return cb?.({ ok: false, error: "AUG_1V1_ONLY" });
      if (payload?.mode && ALLOWED_MODES.includes(payload.mode)) {
        // 모드 변경 시 maxPlayers도 재계산 — 현재 인원 초과 시 거부
        const newMax = modeMaxPlayers(payload.mode, room.ffaSize || 8);
        if (newMax >= room.players.size) {
          room.mode = payload.mode;
          room.maxPlayers = newMax;
          reassignColorsAndTeams(room);
          changed = true;
        } else {
          return cb?.({ ok: false, error: "MODE_PLAYERS_OVERFLOW" });
        }
      }
      if (payload?.boardSize && ALLOWED_BOARD_SIZES.includes(Number(payload.boardSize))) {
        const sz = Number(payload.boardSize);
        room.boardSize = sz;
        room.board = new Int8Array(sz * sz);
        changed = true;
      }
      if (payload?.turnTimeSec && ALLOWED_TURN_SECS.includes(Number(payload.turnTimeSec))) {
        room.turnTimeSec = Number(payload.turnTimeSec);
        changed = true;
      }
      if (payload?.winLength && ALLOWED_WIN_LENGTHS.includes(Number(payload.winLength))) {
        room.winLength = Number(payload.winLength);
        changed = true;
      }
      if (payload?.ffaSize != null && room.mode === "ffa") {
        const n = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(2, Number(payload.ffaSize) || 8));
        if (n >= room.players.size) {
          room.ffaSize = n;
          room.maxPlayers = n;
          changed = true;
        } else {
          return cb?.({ ok: false, error: "FFA_PLAYERS_OVERFLOW" });
        }
      }
      if (payload?.specialMode !== undefined) {
        const sm = payload.specialMode === "aug" ? "aug" : (payload.specialMode === "kid" && !room.guestAiOnly) ? "kid" : "off";
        if (room.specialMode !== sm) { room.specialMode = sm; changed = true; }
        if (sm === "aug" && room.mode !== "1v1") { room.mode = "1v1"; room.maxPlayers = 2; room.ffaSize = null; reassignColorsAndTeams(room); changed = true; }
      }
      if (changed) broadcastRoomState(io, room);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ===== addBot (host only, lobby only) — 빈 자리에 AI 봇 추가 =====
    // payload: { level: 'easy'|'normal'|'hard', fill?: boolean (true면 빈 자리 전부 채움) }
    socket.on("omok:addBot", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const level = OMOK_BOT_LEVELS.includes(payload?.level) ? payload.level : "normal";
      if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
      const want = payload?.fill ? room.maxPlayers - room.players.size : 1;
      for (let k = 0; k < want; k++) {
        room.botSeq = (room.botSeq || 0) + 1;
        const uid = `bot_${room.id}_${room.botSeq}`;
        room.players.set(uid, newBotState(level, room.botSeq));
        room.playerOrder.push(uid);
      }
      reassignColorsAndTeams(room);
      broadcastRoomState(io, room);
      cb?.({ ok: true, room: publicRoom(room) });
    });

    // ===== startGame =====
    socket.on("omok:startGame", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      // rematch: ended 상태에서 새 게임 허용
      if (room.status === "ended") { room.endedAt = null; }
      const minNeeded = room.mode === "ffa" ? 2 : MODE_INFO[room.mode].players;
      if (room.players.size < minNeeded) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS", needed: minNeeded });

      // ffa면 첫 진입자가 항상 첫 차례. 팀전이면 팀A 첫 사람부터.
      room.status = "playing";
      room.currentTurnIdx = 0;
      room.turnCount = 0;
      room.replayNext = false;
      room.walls = new Map();
      room.ghosts = new Map();
      room.shields = new Map();
      room.timeThiefFor = null;
      room.board = new Int8Array(room.boardSize * room.boardSize);
      room.history = [];
      room.lastMove = null;
      room.winLine = null;
      room.winnerUserId = null;
      room.winnerTeam = null;

      reassignColorsAndTeams(room);

      // 초딩 모드: 시작 시 각 플레이어 카드 1장 (일반 모드면 지난 판 카드 비움)
      for (const uid of room.playerOrder) {
        const p = room.players.get(uid);
        if (p) {
          p.cards = room.specialMode === "kid" ? [drawRandomCard()] : [];
          p.augs = []; p.augOffer = []; p.augPicked = false; p.augRefresh = 0; p.myMoves = 0; p.secondUsed = false; p.instinctNext = 0; p.pickIdx = 0;
        }
      }
      if (room.pick?.timer) clearTimeout(room.pick.timer);
      room.pick = null; room.augLog = []; room.turnUses = 0;

      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("omok:gameStart", {
        mode: room.mode,
        specialMode: room.specialMode || "off",
        boardSize: room.boardSize,
        turnTimeSec: room.turnTimeSec,
        winLength: room.winLength,
        players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
        augMeta: room.specialMode === "aug" ? OMOK_AUGS : undefined,
      });
      // 카드는 gameStart 뒤에 보냄 — 화면이 gameStart 때 카드 칸을 비우기 때문에
      // 먼저 보내면 첫 카드가 안 보였음 (5턴 뒤 다음 카드 받을 때까지 빈 칸)
      if (cardMode(room)) for (const uid of room.playerOrder) emitMyCards(io, room, uid);
      startTurn(io, room); // 증강 모드면 여기서 첫 증강 고르기가 시작됨
      if (cardMode(room)) broadcastRoomState(io, room); // 지난 판 벽·투명돌 표시 지우기
    });

    // ===== placeStone =====
    socket.on("omok:place", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      const res = placeStone(io, room, me.id, x, y);
      cb?.(res);
    });

    // ===== useCard (초딩 모드) =====
    socket.on("omok:useCard", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (!cardMode(room)) return cb?.({ ok: false, error: "NOT_KID_MODE" });
      if (room.pick) return cb?.({ ok: false, error: "PICKING" });
      const turnUid = room.playerOrder[room.currentTurnIdx];
      if (turnUid !== me.id) return cb?.({ ok: false, error: "NOT_YOUR_TURN" });
      const player = room.players.get(me.id);
      if (!player) return cb?.({ ok: false, error: "NOT_PLAYER" });
      const cardId = String(payload?.cardId || "");
      if (!SPECIAL_CARD_IDS.has(cardId)) return cb?.({ ok: false, error: "UNKNOWN_CARD" });
      if (room.specialMode === "aug" && (room.turnUses || 0) >= MAX_USES_PER_TURN) return cb?.({ ok: false, error: "USE_LIMIT" });
      const cardIdx = (player.cards || []).indexOf(cardId);
      if (cardIdx < 0) return cb?.({ ok: false, error: "CARD_NOT_OWNED" });

      // 카드를 먼저 손에서 빼고 효과 적용 (럭키박스·훔치기가 빈자리를 셀 수 있게). 실패하면 되돌림
      player.cards.splice(cardIdx, 1);
      const result = applyCardEffect(io, room, me.id, cardId, payload || {});
      if (!result.ok) { player.cards.splice(cardIdx, 0, cardId); return cb?.(result); }
      room.turnUses = (room.turnUses || 0) + 1;

      emitMyCards(io, room, me.id);
      io.to(socketRoomName(room.id)).emit("omok:cardUsed", {
        userId: me.id, name: player.name, cardId,
        effect: result.effect || null,
        board: BOARD_CHANGING_CARDS.has(cardId) ? Array.from(room.board) : null,
      });

      // 카드로 누군가 5목을 만들었으면 바로 끝냄 (전엔 50ms 늦게 끝내서 그 사이 다음 차례가 시작되고
      // 투명돌 공개가 승자를 덮어쓰거나 끝내기가 두 번 일어날 수 있었음)
      if (room.winLine) {
        // 증강 '최후의 반격'이 막으면 계속 진행
        const color = room.board[idx(room.boardSize, room.winLine[0].x, room.winLine[0].y)];
        const fin = resolveWin(io, room, room.winLine, color);
        if (fin) {
          setWinner(room, fin, color);
          endGame(io, room, fin);
          cb?.({ ok: true, ...(result.private || {}) });
          return;
        }
      }

      // 공짜 행동 카드: 턴 계속 (같은 사람이 이어서 돌을 두거나 카드를 더 씀)
      if (FREE_ACTION_CARDS.has(cardId)) {
        broadcastRoomState(io, room);
        cb?.({ ok: true, ...(result.private || {}) });
        return;
      }

      // 일반 카드: 그 턴 종료 (돌을 두지 않음)
      clearTurnTimer(room);
      cb?.({ ok: true, ...(result.private || {}) });
      if (endTurnCommon(io, room)) { broadcastRoomState(io, room); return; }
      if (room.replayNext) room.replayNext = false;
      else room.currentTurnIdx = (room.currentTurnIdx + 1) % room.playerOrder.length;
      startTurn(io, room);
      broadcastRoomState(io, room);
    });

    // ===== 증강 고르기 / 새로고침 =====
    socket.on("omok:pickAug", (payload, cb) => {
      try {
        const room = omokRooms.get(omokUserRoom.get(me.id));
        if (!room || room.status !== "playing" || room.specialMode !== "aug") return cb?.({ ok: false, error: "NOT_PLAYING" });
        if (payload?.refresh) return cb?.(refreshAug(io, room, me.id));
        cb?.(pickAug(io, room, me.id, String(payload?.augId || "")));
      } catch (e) { console.error("[omok:pickAug]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    // ===== requestState =====
    socket.on("omok:requestState", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      socket.join(socketRoomName(room.id));
      // 진행중이라면 보드 전체 + history 함께 보내서 즉시 복원 가능
      const payload = {
        ok: true,
        room: publicRoom(room, me.id),
      };
      if (cardMode(room)) payload.myCards = (room.players.get(me.id)?.cards || []).slice();
      if (room.pick && room.pick.uid === me.id) { const mp = room.players.get(me.id); if (mp) payload.augOffer = { round: room.pick.round, deadline: room.pick.deadline, ...offerView(mp) }; }
      if (room.status === "playing" || room.status === "ended") {
        payload.boardArray = Array.from(room.board);
        payload.history = room.history.slice(0);
      }
      cb?.(payload);
    });

    // ===== changeMySlot — 본인 팀/색 변경 (lobby에서만) =====
    socket.on("omok:changeMySlot", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_PLAYER" });

      if (room.mode === "1v1") {
        // 색 1 ↔ 2 swap (혹은 혼자면 토글)
        const others = room.playerOrder.filter(u => u !== me.id);
        if (others.length === 0) {
          p.color = p.color === 1 ? 2 : 1;
        } else {
          const other = room.players.get(others[0]);
          const tmp = p.color;
          p.color = other.color;
          other.color = tmp;
        }
      } else if (MODE_INFO[room.mode] && MODE_INFO[room.mode].teams >= 2) {
        // 일반화: 2~4팀 모두 지원
        const info = MODE_INFO[room.mode];
        const N = info.teams;
        const capPerTeam = info.players / N;
        // payload.team이 명시되면 그 팀으로, 아니면 다음 팀(순환)
        let targetTeam;
        const requested = Number(payload?.team);
        if (Number.isInteger(requested) && requested >= 0 && requested < N && requested !== p.team) {
          targetTeam = requested;
        } else {
          targetTeam = (p.team + 1) % N;
        }
        const targetCount = countTeam(room, targetTeam);
        if (targetCount < capPerTeam) {
          // 정원 여유 — 그냥 이동
          p.team = targetTeam;
          p.color = TEAM_COLOR_MAP[targetTeam];
        } else {
          // 정원 꽉 참 — 같은 팀 마지막 들어온 사람과 swap
          const targetMembers = room.playerOrder.filter(u => room.players.get(u)?.team === targetTeam);
          const swapUid = targetMembers[targetMembers.length - 1];
          if (!swapUid) return cb?.({ ok: false, error: "TEAM_FULL_NO_SWAP" });
          const swapP = room.players.get(swapUid);
          const myOrigTeam = p.team;
          p.team = targetTeam;       p.color = TEAM_COLOR_MAP[targetTeam];
          swapP.team = myOrigTeam;   swapP.color = TEAM_COLOR_MAP[myOrigTeam];
        }
      } else if (room.mode === "ffa") {
        const newColor = Number(payload?.color);
        if (!Number.isInteger(newColor) || newColor < 1 || newColor > 8) {
          return cb?.({ ok: false, error: "INVALID_COLOR" });
        }
        if (newColor === p.color) {
          return cb?.({ ok: true });
        }
        if (isColorTaken(room, newColor, me.id)) {
          return cb?.({ ok: false, error: "COLOR_TAKEN" });
        }
        p.color = newColor;
      } else {
        return cb?.({ ok: false, error: "UNSUPPORTED_MODE" });
      }

      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== reshuffleTeams — 호스트가 팀 랜덤 재배정 =====
    socket.on("omok:reshuffleTeams", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      // 호스트는 첫 자리 유지하지 말고, 모두 셔플 후 재배정
      shuffleArr(room.playerOrder);
      reassignColorsAndTeams(room);
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== leaveRoom =====
    socket.on("omok:leaveRoom", (_payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      leavePlayer(io, room, me.id, false);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("omok:kickPlayer", (payload, cb) => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.socketId) io.to(target.socketId).emit("omok:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId, false);
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const roomId = omokUserRoom.get(me.id);
      const room = roomId ? omokRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        // 로비에선 즉시 제거
        leavePlayer(io, room, me.id, false);
      } else if (room.status === "playing") {
        // 진행중: 자기 차례면 즉시 패스, 아니면 그냥 끊김 표시
        const turnUid = room.playerOrder[room.currentTurnIdx];
        if (room.pick && room.pick.uid === me.id) {
          // 증강 고르는 중에 끊김: 잠시 뒤 자동으로 고름
          const seq = room.pick.seq;
          setTimeout(() => { if (room.pick && room.pick.seq === seq && !p.augPicked && !p.connected && p.augOffer?.length) pickAug(io, room, me.id, bestOf(p.augOffer)); }, 1500);
        } else if (room.pick) {
          // 상대가 고르는 중 — 내 차례 아님, 그대로
        } else if (turnUid === me.id) {
          clearTurnTimer(room);
          io.to(socketRoomName(room.id)).emit("omok:turnPass", {
            userId: me.id,
            name: p.name,
            timedOut: false,
            disconnected: true,
          });
          passTurn(io, room);
        }
        broadcastRoomState(io, room);
        // 모두 끊기면 일정 시간 뒤 정리
        const anyConnected = hasConnectedHuman(room);
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
  const wasTurn = room.status === "playing" && room.playerOrder[room.currentTurnIdx] === userId;
  const leaveIdx = room.playerOrder.indexOf(userId);

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (omokUserRoom.get(userId) === room.id) omokUserRoom.delete(userId);

  if (room.playerOrder.length === 0 || !hasHuman(room)) {
    deleteRoom(io, room, "EMPTY");
    return;
  }

  if (wasHost) {
    room.hostUserId = room.playerOrder.find(uid => !room.players.get(uid)?.isBot) || room.playerOrder[0];
  }

  if (room.status === "lobby") {
    reassignColorsAndTeams(room);
  } else if (room.status === "playing") {
    // 진행중 이탈: 색은 유지(이미 둔 돌 보존), turnIdx 조정
    if (leaveIdx < room.currentTurnIdx) {
      room.currentTurnIdx = Math.max(0, room.currentTurnIdx - 1);
    } else if (leaveIdx === room.currentTurnIdx) {
      // 자기 차례에 나감 — 다음 차례로
      if (room.currentTurnIdx >= room.playerOrder.length) room.currentTurnIdx = 0;
    }
    if (room.pick && room.pick.uid === userId) {
      // 고르던 사람이 나감 → 고르기 취소하고 다음 사람 차례
      if (room.pick.timer) clearTimeout(room.pick.timer);
      room.pick = null; room.replayNext = false;
      if (room.currentTurnIdx >= room.playerOrder.length) room.currentTurnIdx = 0;
      startTurn(io, room);
    } else if (room.pick) {
      // 다른 사람이 고르는 중 — 그대로
    } else if (wasTurn) {
      clearTurnTimer(room);
      room.replayNext = false; // 나간 사람의 재행동이 다음 사람에게 넘어가지 않게
      startTurn(io, room);
    }
    // 남은 인원이 모드 최소 인원보다 적으면 무승부 종료
    const minNeeded = room.mode === "ffa" ? 2 : MODE_INFO[room.mode].players;
    if (room.playerOrder.filter(uid => room.players.get(uid)?.connected).length < 2) {
      // 한 명만 남으면 그 사람 승리
      const survivor = room.playerOrder.find(uid => room.players.get(uid)?.connected);
      if (survivor) {
        room.winnerUserId = survivor;
        room.winnerTeam = room.players.get(survivor)?.team;
        endGame(io, room, null, "OPPONENT_LEFT");
        return;
      }
    }
  }
  broadcastRoomState(io, room);
}

// 색 메타 export (테스트/디버그용)
export const OMOK_COLORS = { names: COLOR_NAMES, hex: COLOR_HEX };
// 게임천국 공개 방 목록
addPublicRooms("omok", omokRooms);
