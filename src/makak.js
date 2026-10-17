// =========================
// 막아막아 (DUO Makak) — Quoridor 한국형 멀티/솔로 서버
// 보드: 9×9 셀. 벽: 2칸 길이 가로/세로. 모드: 1v1 / 1v1v1v1 / 2v2 / 2v2v2v2
// 경로 검증: BFS — 벽 설치 시 모든 플레이어가 자기 결승선까지 도달 가능해야 함
// 확장: 스테이지(3판 연속·바위·포탈) / 캐릭터 11종(고유 스킬) / 몬스터 5종 + 보스 2종 / 솔로(AI 상대)
// 이벤트 prefix: 'makak:'
// =========================

import {
  CLASSIC_STAGE, STAGES, UNITS, UNIT_IDS, DEFAULT_UNIT, MONSTER_DEFS, BOT_NAMES,
} from "./makak-data.js";
import { chooseBotAction } from "./makak-bot.js";

const mkRooms = new Map();
const mkInvites = new Map();
const mkUserRoom = new Map();

const BOARD_SIZE = 9;
const ALLOWED_MAX_PLAYERS = [2, 4, 8];
const ALLOWED_MODES = new Set(["1v1", "1v1v1v1", "2v2", "2v2v2v2"]);
const ALLOWED_TURN_TIME_SEC = [30, 60, 0];
const ALLOWED_STAGES = [1, 3];
const ALLOWED_LEVELS = new Set(["easy", "normal", "hard"]);
const EMPTY_ROOM_TTL_MS = 30_000;
const MAX_NICK_LEN = 14;
const STAGE_BREAK_MS = 7000;
const STUN_GRACE = 2; // 기절에서 깨어난 뒤 몬스터 접촉 기절을 받지 않는 몬스터 틱 수

// 모드별 인원
const MODE_PLAYER_COUNT = { "1v1": 2, "1v1v1v1": 4, "2v2": 4, "2v2v2v2": 8 };
// 모드별 팀 구성
const MODE_TEAM_COUNT = { "1v1": 0, "1v1v1v1": 0, "2v2": 2, "2v2v2v2": 4 };
// 벽 개수 (개인 또는 팀 공유)
const MODE_WALLS = { "1v1": 10, "1v1v1v1": 5, "2v2": 10, "2v2v2v2": 8 };
const MODE_WALLS_SHARED = { "1v1": false, "1v1v1v1": false, "2v2": true, "2v2v2v2": true };

// 방향: N(위, row-1), S(아래, row+1), W(왼쪽 col-1), E(오른쪽 col+1)
const DIR = {
  N: { dr: -1, dc: 0, goalRow: 0 },
  S: { dr: 1,  dc: 0, goalRow: BOARD_SIZE - 1 },
  W: { dr: 0,  dc: -1, goalCol: 0 },
  E: { dr: 0,  dc: 1, goalCol: BOARD_SIZE - 1 },
};
const DIRS4 = [DIR.N, DIR.S, DIR.W, DIR.E];

const key = (r, c) => `${r},${c}`;
const inBounds = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
const cheb = (r1, c1, r2, c2) => Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 시작 위치 — 모드별
function getStartPositions(mode) {
  const m = BOARD_SIZE - 1; // 8
  if (mode === "1v1") {
    return [
      { row: 0, col: 4, side: "N", team: null },
      { row: m, col: 4, side: "S", team: null },
    ];
  }
  if (mode === "1v1v1v1") {
    return [
      { row: 0, col: 4, side: "N", team: null },
      { row: m, col: 4, side: "S", team: null },
      { row: 4, col: 0, side: "W", team: null },
      { row: 4, col: m, side: "E", team: null },
    ];
  }
  if (mode === "2v2") {
    return [
      { row: 0, col: 3, side: "N", team: "A" },
      { row: 0, col: 5, side: "N", team: "A" },
      { row: m, col: 3, side: "S", team: "B" },
      { row: m, col: 5, side: "S", team: "B" },
    ];
  }
  if (mode === "2v2v2v2") {
    return [
      { row: 0, col: 3, side: "N", team: "A" },
      { row: 0, col: 5, side: "N", team: "A" },
      { row: m, col: 3, side: "S", team: "B" },
      { row: m, col: 5, side: "S", team: "B" },
      { row: 3, col: 0, side: "W", team: "C" },
      { row: 5, col: 0, side: "W", team: "C" },
      { row: 3, col: m, side: "E", team: "D" },
      { row: 5, col: m, side: "E", team: "D" },
    ];
  }
  return [];
}

// 한 플레이어의 결승선 도달 여부 체크
function isGoal(side, row, col) {
  if (side === "N") return row === BOARD_SIZE - 1;
  if (side === "S") return row === 0;
  if (side === "W") return col === BOARD_SIZE - 1;
  if (side === "E") return col === 0;
  return false;
}

// 두 셀 사이 벽이 있는가?
// 가로벽 (wr, wc): (wr, wc)↕(wr+1, wc), (wr, wc+1)↕(wr+1, wc+1) 두 쌍 차단
// 세로벽 (wr, wc): (wr, wc)↔(wr, wc+1), (wr+1, wc)↔(wr+1, wc+1) 두 쌍 차단
function isBlocked(walls, r1, c1, r2, c2) {
  if (c1 === c2 && Math.abs(r1 - r2) === 1) {
    const topR = Math.min(r1, r2);
    if (walls.horizontal[`${topR},${c1}`]) return true;
    if (c1 > 0 && walls.horizontal[`${topR},${c1 - 1}`]) return true;
    return false;
  }
  if (r1 === r2 && Math.abs(c1 - c2) === 1) {
    const leftC = Math.min(c1, c2);
    if (walls.vertical[`${r1},${leftC}`]) return true;
    if (r1 > 0 && walls.vertical[`${r1 - 1},${leftC}`]) return true;
    return false;
  }
  return true; // 인접 셀이 아님
}

// 벽 설치 충돌 체크
function canPlaceWall(walls, orientation, row, col) {
  if (orientation === "H") {
    if (row < 0 || row >= BOARD_SIZE - 1) return false;
    if (col < 0 || col >= BOARD_SIZE - 1) return false;
    const k = `${row},${col}`;
    if (walls.horizontal[k]) return false;
    if (col > 0 && walls.horizontal[`${row},${col - 1}`]) return false;
    if (col < BOARD_SIZE - 2 && walls.horizontal[`${row},${col + 1}`]) return false;
    if (walls.vertical[k]) return false;
    return true;
  }
  if (orientation === "V") {
    if (row < 0 || row >= BOARD_SIZE - 1) return false;
    if (col < 0 || col >= BOARD_SIZE - 1) return false;
    const k = `${row},${col}`;
    if (walls.vertical[k]) return false;
    if (row > 0 && walls.vertical[`${row - 1},${col}`]) return false;
    if (row < BOARD_SIZE - 2 && walls.vertical[`${row + 1},${col}`]) return false;
    if (walls.horizontal[k]) return false;
    return true;
  }
  return false;
}

// ===== 보드 컨텍스트 (바위 / 말 / 몬스터) =====
function isRock(room, r, c) { return !!room.rockMap?.[key(r, c)]; }
function isPortal(room, r, c) { return !!room.portalMap?.[key(r, c)]; }
function monsterAt(room, r, c, exceptMonster = null) {
  for (const m of room.monsters || []) if (m !== exceptMonster && m.row === r && m.col === c) return m;
  return null;
}
function pawnAt(room, r, c, exceptPawn = null) {
  for (const p of room.players.values()) {
    if (p !== exceptPawn && p.alive && p.row === r && p.col === c) return p;
  }
  return null;
}
// 이동 판정용: 말 또는 몬스터가 있는가 (본인 제외)
function pieceAt(room, r, c, exceptPawn = null) {
  return pawnAt(room, r, c, exceptPawn) || monsterAt(room, r, c);
}

// BFS — 말/몬스터는 무시하고 바위·벽만 고려한 결승선까지 최단거리 (없으면 null)
function bfsDist(room, sr, sc, side) {
  const seen = new Set([key(sr, sc)]);
  let frontier = [[sr, sc]];
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const [r, c] of frontier) {
      if (isGoal(side, r, c)) return d;
      for (const dir of DIRS4) {
        const nr = r + dir.dr, nc = c + dir.dc;
        if (!inBounds(nr, nc)) continue;
        if (isRock(room, nr, nc)) continue;
        if (isBlocked(room.walls, r, c, nr, nc)) continue;
        const k = key(nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push([nr, nc]);
      }
    }
    frontier = next;
    d++;
  }
  return null;
}

// 벽 설치 후 모든 생존 플레이어가 자기 결승선까지 도달 가능한가?
function allPlayersHavePath(room) {
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    if (bfsDist(room, p.row, p.col, p.side) == null) return false;
  }
  return true;
}

// 이동 가능 여부 — 점프 룰 + 바위/몬스터 포함
function getLegalMoves(room, p) {
  const walls = room.walls;
  const moves = [];
  for (const d of DIRS4) {
    const nr = p.row + d.dr, nc = p.col + d.dc;
    if (!inBounds(nr, nc)) continue;
    if (isBlocked(walls, p.row, p.col, nr, nc)) continue;
    if (isRock(room, nr, nc)) continue;
    const blocker = pieceAt(room, nr, nc, p);
    if (!blocker) {
      moves.push({ row: nr, col: nc });
      continue;
    }
    // 점프 룰: 상대(말/몬스터) 뒤 셀로 점프
    const jr = nr + d.dr, jc = nc + d.dc;
    if (inBounds(jr, jc) && !isBlocked(walls, nr, nc, jr, jc) && !isRock(room, jr, jc)) {
      if (!pieceAt(room, jr, jc, p)) {
        moves.push({ row: jr, col: jc, jump: true });
        continue;
      }
    }
    // 직선 점프 불가 → 대각선 (상대 옆 두 칸)
    const sideDirs = (d.dr !== 0) ? [DIR.W, DIR.E] : [DIR.N, DIR.S];
    for (const sd of sideDirs) {
      const dr = nr + sd.dr, dc = nc + sd.dc;
      if (!inBounds(dr, dc)) continue;
      if (isBlocked(walls, nr, nc, dr, dc)) continue;
      if (isRock(room, dr, dc)) continue;
      if (pieceAt(room, dr, dc, p)) continue;
      moves.push({ row: dr, col: dc, jump: true });
    }
  }
  return moves;
}

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!mkInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
function socketRoomName(roomId) { return `makak:${roomId}`; }
function clearEmptyRoomTimer(room) {
  if (room?.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
function clearTurnTimer(room) {
  if (room?.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}
function clearBotTimer(room) {
  if (room?.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
}
function clearBreakTimer(room) {
  if (room?.breakTimer) { clearTimeout(room.breakTimer); room.breakTimer = null; }
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function emitRoom(io, room, ev, payload) { io.to(socketRoomName(room.id)).emit(ev, payload); }

// ===== state shapes =====
function newPlayerState(name, isGuest, avatarUrl, socketId) {
  return {
    name: String(name || "익명").slice(0, MAX_NICK_LEN),
    isGuest: !!isGuest, avatar_url: avatarUrl || null,
    joinedAt: Date.now(), connected: true, socketId,
    row: 0, col: 0, side: null, team: null, walls: 0, alive: true,
    isBot: false, unit: DEFAULT_UNIT, skillUsed: false, stun: 0, grace: 0, dw: 0,
    eliminated: false, // 접속 끊김 유예(30초) 안에 못 돌아와 탈락 확정된 경우만 true
  };
}
function publicPlayer(userId, p) {
  if (!p) return null;
  return {
    playerId: userId, nickname: p.name, isGuest: p.isGuest,
    avatar_url: p.avatar_url || null, connected: p.connected,
    row: p.row, col: p.col, side: p.side, team: p.team,
    walls: p.walls, alive: p.alive,
    isBot: !!p.isBot, unit: p.unit, skillUsed: !!p.skillUsed, stun: p.stun || 0,
  };
}
function publicStage(room) {
  const s = room.stageDef || CLASSIC_STAGE;
  return { id: s.id, name: s.name, emoji: s.emoji, desc: s.desc };
}
function publicRoom(room) {
  const cur = room.currentTurnPlayerId ? room.players.get(room.currentTurnPlayerId) : null;
  let skillTargets = null;
  if (room.status === "playing" && !room.stageBreak && cur && cur.alive) {
    skillTargets = getSkillTargets(room, room.currentTurnPlayerId, cur);
  }
  return {
    id: room.id, inviteCode: room.inviteCode, hostUserId: room.hostUserId,
    status: room.status, maxPlayers: room.maxPlayers, mode: room.mode,
    turnTimeSec: room.turnTimeSec,
    stages: room.stages, stageIndex: room.stageIndex || 0, stageTotal: room.stageTotal || 1,
    stageBreak: !!room.stageBreak, stage: publicStage(room),
    rocks: room.rocks || [], portals: room.portalPairs || [],
    monsters: (room.monsters || []).map(m => ({ id: m.id, type: m.type, row: m.row, col: m.col, boss: !!m.boss })),
    traps: (room.traps || []).map(t => ({ row: t.row, col: t.col, owner: t.owner })),
    scores: room.scores || {},
    solo: !!room.solo, difficulty: room.difficulty || "normal",
    currentTurnPlayerId: room.currentTurnPlayerId,
    walls: room.walls,
    teamWalls: room.teamWalls,
    skillTargets,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}
function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("makak:roomState", publicRoom(room));
}
function humanCount(room) {
  let n = 0;
  for (const p of room.players.values()) if (!p.isBot) n++;
  return n;
}
function deleteRoom(io, room, reason) {
  clearEmptyRoomTimer(room);
  clearTurnTimer(room);
  clearBotTimer(room);
  clearBreakTimer(room);
  mkRooms.delete(room.id);
  mkInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (mkUserRoom.get(uid) === room.id) mkUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("makak:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[makak] room ${room.id} deleted: ${reason}`);
}
function maybeScheduleEmptyRoomDelete(io, room) {
  const connected = [...room.players.values()].filter(p => p.connected && !p.isBot).length;
  if (connected === 0 && !room.emptyRoomTimer) {
    room.emptyRoomTimer = setTimeout(() => {
      const r = mkRooms.get(room.id);
      if (!r) return;
      if ([...r.players.values()].every(p => p.isBot || !p.connected)) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

// 편(팀 또는 개인) 키
function squadKeyOf(room, uid) {
  const p = room.players.get(uid);
  return p ? (p.team || uid) : uid;
}
function isEnemy(room, uidA, uidB) {
  if (!uidA || !uidB || uidA === uidB) return false;
  const a = room.players.get(uidA), b = room.players.get(uidB);
  if (!a || !b) return false;
  if (a.team) return a.team !== b.team;
  return true;
}
function uidOfPawn(room, pawn) {
  for (const [id, x] of room.players.entries()) if (x === pawn) return id;
  return null;
}

function leavePlayer(io, room, userId) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const wasTurn = room.currentTurnPlayerId === userId;
  room.players.delete(userId);
  const idx = room.playerOrder.indexOf(userId);
  if (idx >= 0) room.playerOrder.splice(idx, 1);
  if (mkUserRoom.get(userId) === room.id) mkUserRoom.delete(userId);
  if (wasHost) {
    const nextHost = room.playerOrder.find(uid => !room.players.get(uid)?.isBot);
    if (nextHost) room.hostUserId = nextHost;
  }
  io.to(socketRoomName(room.id)).emit("makak:peerLeave", { playerId: userId });
  // 사람이 한 명도 안 남으면 방 종료 (봇만 남은 방 방지)
  if (room.playerOrder.length === 0 || humanCount(room) === 0) { deleteRoom(io, room, "ALL_LEFT"); return; }
  if (room.status === "playing" && !room.stageBreak) {
    if (checkLastStanding(io, room)) { broadcastRoomState(io, room); return; }
    if (wasTurn) {
      // 나간 사람은 이미 순서에서 빠졌으므로, "그 앞 사람" 기준으로 다음 차례를 구해야 순서가 안 꼬인다
      if (idx > 0) room.currentTurnPlayerId = room.playerOrder[Math.min(idx, room.playerOrder.length) - 1] || null;
      else room.currentTurnPlayerId = room.playerOrder[room.playerOrder.length - 1] || null;
      advanceTurn(io, room);
    }
    checkWinCondition(io, room);
  }
  broadcastRoomState(io, room);
}

// 생존자가 한 명(또는 한 팀)뿐이면 그 편이 승리. 이탈/끊김 후 호출
function checkLastStanding(io, room) {
  if (room.status !== "playing" || room.stageBreak) return false;
  const alive = [...room.players.entries()].filter(([, x]) => x.alive);
  if (alive.length === 0) { finishGame(io, room, "NO_ALIVE"); return true; }
  const sides = new Set(alive.map(([uid, x]) => x.team || uid));
  if (sides.size <= 1) { finishGame(io, room, "LAST_STANDING", alive[0][0]); return true; }
  return false;
}

// ===== 솔로: 봇 =====
function fillBots(room) {
  const target = MODE_PLAYER_COUNT[room.mode];
  // 기존 봇 전부 제거 후 필요한 만큼 다시 채움
  for (const [uid, p] of [...room.players.entries()]) {
    if (p.isBot) {
      room.players.delete(uid);
      const i = room.playerOrder.indexOf(uid);
      if (i >= 0) room.playerOrder.splice(i, 1);
    }
  }
  const need = Math.max(0, target - room.players.size);
  const names = shuffle(BOT_NAMES.slice());
  for (let i = 0; i < need; i++) {
    const uid = `bot_${i + 1}`;
    const p = newPlayerState(names[i % names.length], false, null, null);
    p.isBot = true;
    p.unit = UNIT_IDS[rnd(0, UNIT_IDS.length - 1)];
    room.players.set(uid, p);
    room.playerOrder.push(uid);
  }
  room.maxPlayers = target;
}

// ===== 게임 시작 (매치 / 스테이지) =====
function unitBonus(p) { return UNITS[p.unit]?.wallBonus || 0; }
function getWallPool(room, p) {
  if (MODE_WALLS_SHARED[room.mode]) return room.teamWalls[p.team] || 0;
  return p.walls;
}
function addWalls(room, p, n) {
  if (MODE_WALLS_SHARED[room.mode]) room.teamWalls[p.team] = Math.max(0, (room.teamWalls[p.team] || 0) + n);
  else p.walls = Math.max(0, p.walls + n);
}
function decrementWalls(room, p) { addWalls(room, p, -1); }

function startMatch(room) {
  const starts = getStartPositions(room.mode);
  const shuffled = shuffle(room.playerOrder.slice());
  room.slotOrder = shuffled.slice();
  room.teamOf = {};
  shuffled.forEach((uid, i) => { room.teamOf[uid] = starts[i]?.team || null; });

  // 팀 인터리브 순서
  if (MODE_TEAM_COUNT[room.mode] > 0) {
    const byTeam = {};
    for (const uid of shuffled) {
      const t = room.teamOf[uid];
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(uid);
    }
    const teams = Object.keys(byTeam).sort();
    const maxSize = Math.max(...teams.map(t => byTeam[t].length));
    const interleaved = [];
    for (let i = 0; i < maxSize; i++) {
      for (const t of teams) if (byTeam[t][i]) interleaved.push(byTeam[t][i]);
    }
    room.playerOrder = interleaved;
  } else {
    room.playerOrder = shuffled.slice();
  }

  room.stageTotal = room.stages >= 3 ? 3 : 1;
  room.stageIndex = 0;
  room.scores = {};
  room.stageWins = {};
  room.stageBreak = false;
  clearBreakTimer(room);
  // 새 매치: 지금 연결이 끊긴 사람만 탈락 취급 (재대결 시 유령 말 방지)
  for (const p of room.players.values()) p.eliminated = !p.isBot && !p.connected;
  setupStage(room);
  room.status = "playing";
}

// 현재 stageIndex 의 보드/말/벽/몬스터를 세팅
function setupStage(room) {
  const def = room.stageTotal > 1 ? STAGES[room.stageIndex] : CLASSIC_STAGE;
  room.stageDef = def;
  room.rocks = def.rocks.map(([r, c]) => [r, c]);
  room.rockMap = {};
  for (const [r, c] of def.rocks) room.rockMap[key(r, c)] = true;
  room.portalPairs = def.portals.map(([a, b]) => [[a[0], a[1]], [b[0], b[1]]]);
  room.portalMap = {};
  for (const [a, b] of def.portals) {
    room.portalMap[key(a[0], a[1])] = [b[0], b[1]];
    room.portalMap[key(b[0], b[1])] = [a[0], a[1]];
  }
  room.monsters = def.monsters.map((m, i) => ({
    id: `m${room.stageIndex}_${i}`, type: m.type, row: m.row, col: m.col, boss: !!m.boss,
  }));
  room.traps = [];
  room.tick = 0;
  room.turnsSinceTick = 0;
  room.walls = { horizontal: {}, vertical: {} };
  room.stageBreak = false;
  room._stuckChain = 0;

  const starts = getStartPositions(room.mode);
  const order = room.slotOrder.filter(uid => room.players.has(uid));
  const teamMode = MODE_TEAM_COUNT[room.mode] > 0;
  // 스테이지마다 출발 변을 돌려서 공평하게 (팀전은 2칸 단위로 회전 → 팀원은 같은 변 유지)
  const shift = teamMode ? room.stageIndex * 2 : room.stageIndex;
  order.forEach((uid, i) => {
    const p = room.players.get(uid);
    const s = starts[(i + shift) % starts.length];
    if (!p || !s) return;
    p.row = s.row; p.col = s.col; p.side = s.side;
    p.team = room.teamOf[uid] || null; // 팀 글자는 매치 내내 고정
    // 잠깐 끊긴 사람(새로고침/네트워크 순단)은 다음 스테이지에도 참가한다. 탈락 확정자만 제외
    p.alive = !p.eliminated;
    p.skillUsed = false; p.stun = 0; p.grace = 0; p.dw = 0;
    p.walls = MODE_WALLS_SHARED[room.mode] ? 0 : MODE_WALLS[room.mode] + unitBonus(p);
  });

  room.teamWalls = {};
  if (MODE_WALLS_SHARED[room.mode]) {
    for (const uid of order) {
      const p = room.players.get(uid);
      if (!p || !p.team) continue;
      room.teamWalls[p.team] = (room.teamWalls[p.team] ?? MODE_WALLS[room.mode]) + unitBonus(p);
    }
  }
}

// ===== 턴 진행 =====
function aliveCount(room) {
  let n = 0;
  for (const p of room.players.values()) if (p.alive && p.connected) n++;
  return Math.max(1, n);
}

function nextAlivePlayerId(room, fromUserId) {
  const order = room.playerOrder;
  const startIdx = fromUserId ? order.indexOf(fromUserId) : -1;
  // 1차: alive + connected
  for (let i = 1; i <= order.length; i++) {
    const idx = (startIdx + i + order.length) % order.length;
    const uid = order[idx];
    const p = room.players.get(uid);
    if (p?.alive && p?.connected) return uid;
  }
  // 2차 (모두 끊긴 경우 대비): alive만
  for (let i = 1; i <= order.length; i++) {
    const idx = (startIdx + i + order.length) % order.length;
    const uid = order[idx];
    const p = room.players.get(uid);
    if (p?.alive) return uid;
  }
  return null;
}

function startTurn(io, room, playerId) {
  room.currentTurnPlayerId = playerId;
  clearTurnTimer(room);
  clearBotTimer(room);
  const cur = room.players.get(playerId);
  if (cur) cur.dw = 0;
  emitRoom(io, room, "makak:turnStart", {
    playerId,
    nickname: cur?.name || "?",
    turnTimeSec: room.turnTimeSec,
    stunned: !!(cur && cur.stun > 0),
  });
  broadcastRoomState(io, room);

  // 기절: 이번 턴은 건너뜀
  if (cur && cur.alive && cur.stun > 0) {
    cur.stun -= 1;
    if (cur.stun === 0) cur.grace = STUN_GRACE;
    emitRoom(io, room, "makak:turnTimeout", { playerId, stunned: true });
    room.turnTimer = setTimeout(() => {
      const r = mkRooms.get(room.id);
      if (!r || r.status !== "playing" || r.stageBreak || r.currentTurnPlayerId !== playerId) return;
      advanceTurn(io, r);
    }, 1100);
    return;
  }

  // 갇혀서 움직일 수도, 벽을 놓을 수도 없으면 자동 패스 (혼잡 시 시간제한 무제한 교착 방지)
  if (cur && cur.alive) {
    const stuck = getLegalMoves(room, cur).length === 0 && getWallPool(room, cur) <= 0;
    if (stuck && (room._stuckChain || 0) < room.playerOrder.length) {
      room._stuckChain = (room._stuckChain || 0) + 1;
      emitRoom(io, room, "makak:turnTimeout", { playerId, blocked: true });
      room.turnTimer = setTimeout(() => {
        const r = mkRooms.get(room.id);
        if (!r || r.status !== "playing" || r.stageBreak || r.currentTurnPlayerId !== playerId) return;
        advanceTurn(io, r);
      }, 1200);
      return;
    }
  }
  room._stuckChain = 0;

  if (cur?.isBot) { scheduleBot(io, room, playerId); return; }

  // 자동 진행 타이머 (시간 초과 시 결승선 방향으로 1칸 자동 이동)
  if (room.turnTimeSec > 0) {
    room.turnTimer = setTimeout(() => {
      const r = mkRooms.get(room.id);
      if (!r || r.status !== "playing" || r.stageBreak || r.currentTurnPlayerId !== playerId) return;
      autoMoveTowardGoal(io, r, playerId);
    }, room.turnTimeSec * 1000);
  }
}

function autoMoveTowardGoal(io, room, userId) {
  const p = room.players.get(userId);
  if (!p || !p.alive) return advanceTurn(io, room);
  const moves = getLegalMoves(room, p);
  if (!moves.length) {
    emitRoom(io, room, "makak:turnTimeout", { playerId: userId, blocked: true });
    return advanceTurn(io, room);
  }
  // 결승선까지 최단거리가 가장 줄어드는 이동 선택
  let best = moves[0], bestDist = Infinity;
  for (const m of moves) {
    const d = (bfsDist(room, m.row, m.col, p.side) ?? 99) + Math.random() * 0.1;
    if (d < bestDist) { bestDist = d; best = m; }
  }
  p.dw = 0;
  const from = { row: p.row, col: p.col };
  p.row = best.row; p.col = best.col;
  const tele = resolveLanding(io, room, p, userId, true);
  emitRoom(io, room, "makak:turnTimeout", { playerId: userId, autoMoveTo: { row: best.row, col: best.col } });
  emitRoom(io, room, "makak:moved", { playerId: userId, from, row: best.row, col: best.col, teleport: tele, auto: true });
  broadcastRoomState(io, room);
  if (checkWinCondition(io, room)) return;
  advanceTurn(io, room);
}

function advanceTurn(io, room) {
  if (room.status !== "playing" || room.stageBreak) return;
  const next = nextAlivePlayerId(room, room.currentTurnPlayerId);
  if (!next) return finishGame(io, room, "NO_ALIVE");
  room.turnsSinceTick = (room.turnsSinceTick || 0) + 1;
  if (room.monsters.length && room.turnsSinceTick >= aliveCount(room)) {
    room.turnsSinceTick = 0;
    monstersTick(io, room);
  }
  startTurn(io, room, next);
}

function checkWinCondition(io, room) {
  if (room.status !== "playing" || room.stageBreak) return false;
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p || !p.alive) continue;
    if (isGoal(p.side, p.row, p.col)) {
      finishGame(io, room, "GOAL_REACHED", uid);
      return true;
    }
  }
  return false;
}

// ===== 착지 처리 (포탈 · 함정) =====
// fromMove=true 일 때만 포탈이 작동한다 (스킬 착지는 포탈 칸을 고르지 못함)
function resolveLanding(io, room, p, uid, fromMove) {
  let teleport = null;
  if (fromMove) {
    const pair = room.portalMap?.[key(p.row, p.col)];
    if (pair && !isRock(room, pair[0], pair[1]) && !pieceAt(room, pair[0], pair[1], p)) {
      p.row = pair[0]; p.col = pair[1];
      teleport = { row: pair[0], col: pair[1] };
    }
  }
  // 함정: 상대 편 함정을 밟으면 기절 + 함정 소멸
  const ti = (room.traps || []).findIndex(t => t.row === p.row && t.col === p.col && t.owner !== (p.team || uid));
  if (ti >= 0) {
    const t = room.traps[ti];
    room.traps.splice(ti, 1);
    emitRoom(io, room, "makak:trapTriggered", { playerId: uid, row: t.row, col: t.col });
    applyStun(io, room, uid, p, 1, "trap");
  }
  return teleport;
}

function applyStun(io, room, uid, p, turns, source) {
  if (!p || !p.alive) return false;
  if (UNITS[p.unit]?.immuneStun) {
    emitRoom(io, room, "makak:stunBlocked", { playerId: uid, source });
    return false;
  }
  p.stun = (p.stun || 0) + turns;
  emitRoom(io, room, "makak:stunned", { playerId: uid, turns, source });
  return true;
}

// ===== 몬스터 =====
function freeForMonster(room, r, c, m) {
  if (!inBounds(r, c) || isRock(room, r, c)) return false;
  if (pawnAt(room, r, c)) return false;
  if (monsterAt(room, r, c, m)) return false;
  return true;
}

// target 칸 방향으로 한 걸음 (BFS). wallPass 면 벽 무시
function monsterStepToward(room, m, tr, tc, wallPass) {
  const startK = key(m.row, m.col);
  const prev = new Map([[startK, null]]);
  let frontier = [[m.row, m.col]];
  let found = false;
  while (frontier.length && !found) {
    const next = [];
    for (const [r, c] of frontier) {
      for (const d of DIRS4) {
        const nr = r + d.dr, nc = c + d.dc;
        if (!inBounds(nr, nc) || isRock(room, nr, nc)) continue;
        if (!wallPass && isBlocked(room.walls, r, c, nr, nc)) continue;
        const k = key(nr, nc);
        if (prev.has(k)) continue;
        const isTarget = nr === tr && nc === tc;
        if (!isTarget && !freeForMonster(room, nr, nc, m)) continue;
        prev.set(k, key(r, c));
        if (isTarget) { found = true; break; }
        next.push([nr, nc]);
      }
      if (found) break;
    }
    frontier = next;
  }
  if (!found) return null;
  // 역추적해서 첫 걸음을 구한다
  let cur = key(tr, tc);
  const path = [];
  while (cur && cur !== startK) { path.push(cur); cur = prev.get(cur); }
  path.reverse();
  const first = path[0];
  if (!first) return null;
  const [fr, fc] = first.split(",").map(Number);
  if (fr === tr && fc === tc) return null; // 이미 인접 → 이동하지 않음
  return { row: fr, col: fc };
}

function monsterStep(room, m, def) {
  if (def.ai === "random") {
    const opts = [];
    for (const d of DIRS4) {
      const nr = m.row + d.dr, nc = m.col + d.dc;
      if (!freeForMonster(room, nr, nc, m)) continue;
      if (!def.wallPass && isBlocked(room.walls, m.row, m.col, nr, nc)) continue;
      opts.push({ row: nr, col: nc });
    }
    return opts.length ? opts[rnd(0, opts.length - 1)] : null;
  }
  if (def.ai === "chase") {
    let target = null, best = Infinity;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const d = Math.abs(p.row - m.row) + Math.abs(p.col - m.col);
      if (d < best) { best = d; target = p; }
    }
    if (!target) return null;
    return monsterStepToward(room, m, target.row, target.col, !!def.wallPass);
  }
  return null; // guard
}

function monstersTick(io, room) {
  room.tick = (room.tick || 0) + 1;
  const events = [];

  for (const m of room.monsters) {
    const def = MONSTER_DEFS[m.type];
    if (!def) continue;
    if (def.ai !== "guard" && room.tick % (def.every || 1) === 0) {
      for (let i = 0; i < (def.steps || 0); i++) {
        const step = monsterStep(room, m, def);
        if (!step) break;
        m.row = step.row; m.col = step.col;
      }
    }
    // 보스 고유 패턴
    if (def.special && room.tick % def.special.every === 0) {
      if (def.special.kind === "fire") {
        const all = [];
        for (const k of Object.keys(room.walls.horizontal)) all.push(["H", k]);
        for (const k of Object.keys(room.walls.vertical)) all.push(["V", k]);
        shuffle(all);
        const removed = [];
        for (const [o, k] of all.slice(0, 2)) {
          delete (o === "H" ? room.walls.horizontal : room.walls.vertical)[k];
          const [r, c] = k.split(",").map(Number);
          removed.push({ orientation: o, row: r, col: c });
        }
        events.push({ t: "fire", monsterId: m.id, walls: removed });
      } else if (def.special.kind === "quake") {
        const hit = [];
        for (const [uid, p] of room.players.entries()) {
          if (!p.alive || cheb(p.row, p.col, m.row, m.col) > 2) continue;
          if (applyStun(io, room, uid, p, 1, "quake")) hit.push(uid);
        }
        events.push({ t: "quake", monsterId: m.id, playerIds: hit });
      }
    }
  }

  // 접촉 기절: 몬스터와 인접한 말
  const stunnedNow = new Set();
  for (const m of room.monsters) {
    const def = MONSTER_DEFS[m.type];
    if (!def || !def.stun) continue;
    for (const [uid, p] of room.players.entries()) {
      if (!p.alive || stunnedNow.has(uid)) continue;
      if (Math.abs(p.row - m.row) + Math.abs(p.col - m.col) !== 1) continue;
      if (!def.wallPass && isBlocked(room.walls, m.row, m.col, p.row, p.col)) continue;
      if (p.grace > 0 || p.stun > 0) continue;
      if (applyStun(io, room, uid, p, def.stun, "monster")) {
        stunnedNow.add(uid);
        events.push({ t: "stun", playerId: uid, monsterId: m.id, turns: def.stun });
      }
    }
  }
  // 유예(grace) 틱 차감 — 이번 틱에 새로 기절한 사람은 제외
  for (const [uid, p] of room.players.entries()) {
    if (p.grace > 0 && !stunnedNow.has(uid)) p.grace -= 1;
  }

  emitRoom(io, room, "makak:monstersTick", {
    tick: room.tick,
    monsters: room.monsters.map(m => ({ id: m.id, type: m.type, row: m.row, col: m.col, boss: !!m.boss })),
    events,
  });
}

// ===== 스킬 =====
function enemyPawns(room, uid) {
  const out = [];
  for (const [id, x] of room.players.entries()) if (x.alive && isEnemy(room, uid, id)) out.push([id, x]);
  return out;
}
function cellOkForSkill(room, p, r, c) {
  return inBounds(r, c) && !isRock(room, r, c) && !pieceAt(room, r, c, p)
    && !isPortal(room, r, c) && !isGoal(p.side, r, c);
}

// 현재 스킬로 선택 가능한 대상. 서버가 단일 진실원 — 클라이언트는 이 목록만 표시
function getSkillTargets(room, uid, p) {
  const unit = UNITS[p.unit];
  const sk = unit?.skill;
  if (!sk || p.skillUsed || p.stun > 0 || !p.alive) return null;
  const out = { skill: sk.id, kind: sk.target, cells: [], walls: [], auto: false };

  if (sk.id === "dash") {
    for (const d of DIRS4) {
      const mr = p.row + d.dr, mc = p.col + d.dc;
      const tr = p.row + 2 * d.dr, tc = p.col + 2 * d.dc;
      if (!inBounds(tr, tc)) continue;
      if (isBlocked(room.walls, p.row, p.col, mr, mc) || isBlocked(room.walls, mr, mc, tr, tc)) continue;
      if (isRock(room, mr, mc) || pieceAt(room, mr, mc, p)) continue;
      if (!cellOkForSkill(room, p, tr, tc)) continue;
      out.cells.push({ row: tr, col: tc });
    }
  } else if (sk.id === "blink") {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      if (cellOkForSkill(room, p, p.row + dr, p.col + dc)) out.cells.push({ row: p.row + dr, col: p.col + dc });
    }
  } else if (sk.id === "phase") {
    for (const d of DIRS4) {
      const nr = p.row + d.dr, nc = p.col + d.dc;
      if (!inBounds(nr, nc)) continue;
      if (!isBlocked(room.walls, p.row, p.col, nr, nc)) continue; // 벽에 막힌 칸만
      if (cellOkForSkill(room, p, nr, nc)) out.cells.push({ row: nr, col: nc });
    }
  } else if (sk.id === "smash") {
    for (const k of Object.keys(room.walls.horizontal)) { const [r, c] = k.split(",").map(Number); out.walls.push({ orientation: "H", row: r, col: c }); }
    for (const k of Object.keys(room.walls.vertical)) { const [r, c] = k.split(",").map(Number); out.walls.push({ orientation: "V", row: r, col: c }); }
    if (!out.walls.length) return null;
  } else if (sk.id === "freeze") {
    for (const [, x] of enemyPawns(room, uid)) {
      if (cheb(p.row, p.col, x.row, x.col) <= 3 && !UNITS[x.unit]?.immuneStun) out.cells.push({ row: x.row, col: x.col });
    }
  } else if (sk.id === "knock") {
    for (const d of DIRS4) {
      const tr = p.row + d.dr, tc = p.col + d.dc;
      const tgt = inBounds(tr, tc) ? pawnAt(room, tr, tc, p) : null;
      if (!tgt || !isEnemy(room, uid, uidOfPawn(room, tgt))) continue;
      if (isBlocked(room.walls, p.row, p.col, tr, tc)) continue;
      const pr = tr + d.dr, pc = tc + d.dc;
      if (!inBounds(pr, pc) || isBlocked(room.walls, tr, tc, pr, pc)) continue;
      if (isRock(room, pr, pc) || pieceAt(room, pr, pc) || isPortal(room, pr, pc) || isGoal(tgt.side, pr, pc)) continue;
      out.cells.push({ row: tr, col: tc });
    }
  } else if (sk.id === "trap") {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = p.row + dr, c = p.col + dc;
      if (!inBounds(r, c) || isRock(room, r, c) || pieceAt(room, r, c, p) || isPortal(room, r, c)) continue;
      if ((room.traps || []).some(t => t.row === r && t.col === c)) continue;
      out.cells.push({ row: r, col: c });
    }
  } else if (sk.id === "steal") {
    const has = enemyPawns(room, uid).some(([, x]) => getWallPool(room, x) > 0);
    if (!has) return null;
    out.auto = true;
  } else if (sk.id === "dwall") {
    if (getWallPool(room, p) < 2) return null;
    out.auto = true;
  }
  if (sk.target === "cell" && !out.cells.length) return null;
  return out;
}

function doSkill(io, room, uid, payload) {
  if (!room || room.status !== "playing" || room.stageBreak) return { ok: false, error: "NOT_PLAYING" };
  if (room.currentTurnPlayerId !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
  const p = room.players.get(uid);
  if (!p || !p.alive) return { ok: false, error: "DEAD" };
  const unit = UNITS[p.unit];
  if (!unit?.skill) return { ok: false, error: "NO_SKILL" };
  if (p.skillUsed) return { ok: false, error: "SKILL_USED" };
  const st = getSkillTargets(room, uid, p);
  if (!st) return { ok: false, error: "NO_TARGET" };

  const id = st.skill;
  const row = Number(payload?.row), col = Number(payload?.col);
  const evBase = { playerId: uid, skill: id };
  const from = { row: p.row, col: p.col };
  let endsTurn = true;

  if (id === "dash" || id === "blink" || id === "phase") {
    if (!st.cells.some(t => t.row === row && t.col === col)) return { ok: false, error: "INVALID_TARGET" };
    p.row = row; p.col = col;
    resolveLanding(io, room, p, uid, false);
    emitRoom(io, room, "makak:skillUsed", { ...evBase, from, to: { row, col } });
  } else if (id === "smash") {
    const o = payload?.orientation === "V" ? "V" : "H";
    if (!st.walls.some(w => w.orientation === o && w.row === row && w.col === col)) return { ok: false, error: "INVALID_TARGET" };
    delete (o === "H" ? room.walls.horizontal : room.walls.vertical)[key(row, col)];
    emitRoom(io, room, "makak:skillUsed", { ...evBase, wall: { orientation: o, row, col } });
  } else if (id === "freeze") {
    if (!st.cells.some(t => t.row === row && t.col === col)) return { ok: false, error: "INVALID_TARGET" };
    const tgt = pawnAt(room, row, col, p);
    const tid = uidOfPawn(room, tgt);
    if (!tgt || !tid) return { ok: false, error: "INVALID_TARGET" };
    applyStun(io, room, tid, tgt, 1, "freeze");
    emitRoom(io, room, "makak:skillUsed", { ...evBase, target: tid });
  } else if (id === "knock") {
    if (!st.cells.some(t => t.row === row && t.col === col)) return { ok: false, error: "INVALID_TARGET" };
    const tgt = pawnAt(room, row, col, p);
    const tid = uidOfPawn(room, tgt);
    if (!tgt || !tid) return { ok: false, error: "INVALID_TARGET" };
    const dr = row - p.row, dc = col - p.col;
    tgt.row = row + dr; tgt.col = col + dc;
    resolveLanding(io, room, tgt, tid, false);
    emitRoom(io, room, "makak:skillUsed", { ...evBase, target: tid, to: { row: tgt.row, col: tgt.col } });
  } else if (id === "trap") {
    if (!st.cells.some(t => t.row === row && t.col === col)) return { ok: false, error: "INVALID_TARGET" };
    room.traps.push({ row, col, owner: p.team || uid });
    emitRoom(io, room, "makak:skillUsed", { ...evBase, trap: { row, col } });
  } else if (id === "steal") {
    // 벽이 가장 많은 상대 편에서 최대 2개
    let best = null, bestPool = 0;
    for (const [, x] of enemyPawns(room, uid)) {
      const pool = getWallPool(room, x);
      if (pool > bestPool) { bestPool = pool; best = x; }
    }
    const n = Math.min(2, bestPool);
    addWalls(room, best, -n);
    addWalls(room, p, n);
    emitRoom(io, room, "makak:skillUsed", { ...evBase, amount: n });
  } else if (id === "dwall") {
    p.dw = 2;
    endsTurn = false;
    emitRoom(io, room, "makak:skillUsed", { ...evBase });
  } else {
    return { ok: false, error: "UNKNOWN_SKILL" };
  }

  p.skillUsed = true;
  broadcastRoomState(io, room);
  if (endsTurn) {
    clearTurnTimer(room);
    if (checkWinCondition(io, room)) return { ok: true, win: true };
    advanceTurn(io, room);
  }
  return { ok: true };
}

// ===== 행동: 이동 / 벽 =====
function doMove(io, room, uid, row, col) {
  if (!room || room.status !== "playing" || room.stageBreak) return { ok: false, error: "NOT_PLAYING" };
  if (room.currentTurnPlayerId !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
  const p = room.players.get(uid);
  if (!p || !p.alive) return { ok: false, error: "DEAD" };
  if (p.stun > 0) return { ok: false, error: "STUNNED" };
  const legal = getLegalMoves(room, p);
  if (!legal.some(m => m.row === row && m.col === col)) return { ok: false, error: "ILLEGAL_MOVE" };
  const from = { row: p.row, col: p.col };
  p.dw = 0;
  p.row = row; p.col = col;
  clearTurnTimer(room);
  const tele = resolveLanding(io, room, p, uid, true);
  emitRoom(io, room, "makak:moved", { playerId: uid, from, row, col, teleport: tele });
  broadcastRoomState(io, room);
  if (checkWinCondition(io, room)) return { ok: true, win: true };
  advanceTurn(io, room);
  return { ok: true };
}

function doWall(io, room, uid, orientationIn, row, col) {
  if (!room || room.status !== "playing" || room.stageBreak) return { ok: false, error: "NOT_PLAYING" };
  if (room.currentTurnPlayerId !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
  const p = room.players.get(uid);
  if (!p || !p.alive) return { ok: false, error: "DEAD" };
  if (p.stun > 0) return { ok: false, error: "STUNNED" };
  if (getWallPool(room, p) <= 0) return { ok: false, error: "NO_WALLS" };
  const orientation = orientationIn === "V" ? "V" : "H";
  if (!canPlaceWall(room.walls, orientation, row, col)) return { ok: false, error: "WALL_CONFLICT" };
  const k = key(row, col);
  const slot = orientation === "H" ? room.walls.horizontal : room.walls.vertical;
  slot[k] = true;
  if (!allPlayersHavePath(room)) {
    delete slot[k];
    return { ok: false, error: "BLOCKS_PATH" };
  }
  decrementWalls(room, p);
  emitRoom(io, room, "makak:wallPlaced", { playerId: uid, orientation, row, col, team: p.team });
  broadcastRoomState(io, room);
  // 이중 설치 스킬: 이번 턴에 한 번 더 놓을 수 있다
  if (p.dw > 0) {
    p.dw -= 1;
    if (p.dw > 0 && getWallPool(room, p) > 0) return { ok: true, again: true };
    p.dw = 0;
  }
  clearTurnTimer(room);
  advanceTurn(io, room);
  return { ok: true };
}

// ===== 스테이지 / 매치 종료 =====
function distToGoal(p) {
  if (!p || !p.alive) return Infinity;
  if (p.side === "N") return (BOARD_SIZE - 1) - p.row;
  if (p.side === "S") return p.row;
  if (p.side === "W") return (BOARD_SIZE - 1) - p.col;
  if (p.side === "E") return p.col;
  return Infinity;
}

function computeStageStandings(room, winnerUserId) {
  const groups = new Map();
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p) continue;
    const k = p.team || uid;
    const g = groups.get(k) || { key: k, members: [], best: Infinity, team: p.team };
    g.members.push({ playerId: uid, nickname: p.name, avatar_url: p.avatar_url || null, unit: p.unit, isBot: !!p.isBot });
    const d = distToGoal(p);
    if (d < g.best) g.best = d;
    groups.set(k, g);
  }
  const winKey = winnerUserId ? squadKeyOf(room, winnerUserId) : null;
  if (winKey) { room.stageWins = room.stageWins || {}; room.stageWins[winKey] = (room.stageWins[winKey] || 0) + 1; }
  const arr = [...groups.values()].sort((a, b) => {
    const wa = a.key === winKey ? 0 : 1, wb = b.key === winKey ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return a.best < b.best ? -1 : a.best > b.best ? 1 : 0;
  });
  const n = arr.length;
  let rank = 0, prevBest = null, prevWin = false;
  arr.forEach((g, i) => {
    const isWin = g.key === winKey;
    if (i === 0 || isWin || prevWin || g.best !== prevBest) rank = i + 1; // 동점 거리는 같은 순위
    prevBest = g.best; prevWin = isWin;
    g.rank = rank;
    g.points = n - rank;
    room.scores[g.key] = (room.scores[g.key] || 0) + g.points;
    g.total = room.scores[g.key];
    g.label = g.team ? `팀 ${g.team}` : g.members[0].nickname;
  });
  return {
    standings: arr.map(g => ({
      key: g.key, label: g.label, team: g.team || null, members: g.members,
      rank: g.rank, points: g.points, total: g.total,
    })),
    winKey,
  };
}

function finishGame(io, room, reason, winnerUserId = null) {
  if (room.status !== "playing" || room.stageBreak) return;
  clearTurnTimer(room);
  clearBotTimer(room);
  const multi = room.stageTotal > 1;
  const { standings, winKey } = computeStageStandings(room, winnerUserId);

  if (!multi) {
    return finishMatch(io, room, reason, winKey ? new Set([winKey]) : new Set());
  }

  // 다음 스테이지로 갈 수 있나? 연결된 편이 2개 이상이어야 함
  const liveSquads = new Set();
  for (const [uid, p] of room.players.entries()) if (!p.eliminated) liveSquads.add(p.team || uid);
  const hasNext = room.stageIndex + 1 < room.stageTotal && liveSquads.size >= 2;

  if (!hasNext) {
    // 최종 정산: 누적 점수 1위(동점 공동 우승)
    // 동점이면 스테이지 승수로 가르고, 그래도 같으면 공동 우승
    let max = -1;
    for (const s of standings) if (s.total > max) max = s.total;
    let top = standings.filter(s => s.total === max);
    if (top.length > 1) {
      const wins = k => (room.stageWins?.[k] || 0);
      const mw = Math.max(...top.map(s => wins(s.key)));
      top = top.filter(s => wins(s.key) === mw);
    }
    return finishMatch(io, room, reason, new Set(top.map(s => s.key)));
  }

  room.stageBreak = true;
  const nextDef = STAGES[room.stageIndex + 1];
  emitRoom(io, room, "makak:stageEnded", {
    stageIndex: room.stageIndex, stageTotal: room.stageTotal, reason,
    winnerKey: winKey, winnerUserId,
    standings,
    next: { index: room.stageIndex + 1, name: nextDef.name, emoji: nextDef.emoji, desc: nextDef.desc },
    breakMs: STAGE_BREAK_MS,
  });
  broadcastRoomState(io, room);
  clearBreakTimer(room);
  room.breakTimer = setTimeout(() => beginNextStage(io, room), STAGE_BREAK_MS);
}

function beginNextStage(io, room) {
  const r = mkRooms.get(room.id);
  if (!r || r.status !== "playing" || !r.stageBreak) return;
  r.breakTimer = null;
  r.stageIndex += 1;
  setupStage(r);
  // 시작 전에 살아있는 편이 하나뿐이면 매치 종료
  const liveSquads = new Set();
  for (const [uid, p] of r.players.entries()) if (p.alive) liveSquads.add(p.team || uid);
  if (liveSquads.size < 2) {
    return finishMatch(io, r, "LAST_STANDING", new Set(liveSquads));
  }
  emitRoom(io, r, "makak:stageStart", {
    stageIndex: r.stageIndex, stageTotal: r.stageTotal, stage: publicStage(r),
  });
  broadcastRoomState(io, r);
  const prev = r.playerOrder[(r.stageIndex - 1 + r.playerOrder.length) % r.playerOrder.length];
  const first = nextAlivePlayerId(r, prev);
  if (!first) return finishGame(io, r, "NO_ALIVE");
  startTurn(io, r, first);
}

function finishMatch(io, room, reason, winnerKeys) {
  room.status = "ended";
  room.stageBreak = false;
  clearTurnTimer(room);
  clearBotTimer(room);
  clearBreakTimer(room);
  const ranking = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    if (!p) return null;
    const k = p.team || uid;
    return {
      playerId: uid, nickname: p.name, avatar_url: p.avatar_url || null, team: p.team,
      winner: !!(winnerKeys && winnerKeys.has(k)), row: p.row, col: p.col,
      score: room.scores?.[k] || 0, unit: p.unit, isBot: !!p.isBot,
    };
  }).filter(Boolean).sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0) || b.score - a.score);
  const firstWinner = ranking.find(x => x.winner) || null;
  emitRoom(io, room, "makak:gameEnded", {
    reason,
    winnerUserId: firstWinner ? firstWinner.playerId : null,
    winnerTeam: firstWinner ? firstWinner.team : null,
    stageTotal: room.stageTotal || 1,
    ranking,
  });
  broadcastRoomState(io, room);
}

// ===== 봇 =====
const E = { bfsDist, getLegalMoves, canPlaceWall, allPlayersHavePath, isEnemy, getSkillTargets, getWallPool };

function scheduleBot(io, room, uid) {
  clearBotTimer(room);
  room.botTimer = setTimeout(() => botTurn(io, room, uid), 750 + rnd(0, 550));
}

function botTurn(io, room, uid) {
  const r = mkRooms.get(room.id);
  if (!r || r.status !== "playing" || r.stageBreak || r.currentTurnPlayerId !== uid) return;
  let res = null;
  try {
    const act = chooseBotAction(E, r, uid, r.difficulty);
    if (act?.type === "move") res = doMove(io, r, uid, act.row, act.col);
    else if (act?.type === "wall") res = doWall(io, r, uid, act.orientation, act.row, act.col);
    else if (act?.type === "skill") res = doSkill(io, r, uid, act);
  } catch (e) {
    console.error("[makak:bot]", e);
  }
  if (!res?.ok && r.currentTurnPlayerId === uid && r.status === "playing") {
    autoMoveTowardGoal(io, r, uid);
  }
}

// ===== 등록 =====
export function registerMakak(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    function makeRoom(opts) {
      const roomId = `mk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        id: roomId, inviteCode: opts.solo ? `solo_${roomId}` : genInviteCode(), hostUserId: me.id,
        status: "lobby", maxPlayers: opts.maxPlayers, mode: opts.mode, turnTimeSec: opts.turnTimeSec,
        stages: opts.stages, solo: !!opts.solo, difficulty: opts.difficulty || "normal",
        currentTurnPlayerId: null,
        walls: { horizontal: {}, vertical: {} },
        teamWalls: {},
        rockMap: {}, portalMap: {}, rocks: [], portalPairs: [], monsters: [], traps: [],
        players: new Map(), playerOrder: [],
        emptyRoomTimer: null, turnTimer: null, botTimer: null, breakTimer: null,
        createdAt: Date.now(),
      };
    }
    async function loadProfile(nick) {
      let avatar = null;
      if (!me.isGuest) {
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (!nick && data?.nickname) nick = data.nickname;
        } catch {}
      }
      return { avatar, nick };
    }
    function leaveOld() {
      if (mkUserRoom.has(me.id)) {
        const old = mkRooms.get(mkUserRoom.get(me.id));
        if (old) leavePlayer(io, old, me.id);
      }
    }

    socket.on("makak:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        leaveOld();
        const maxPlayers = ALLOWED_MAX_PLAYERS.includes(Number(payload?.maxPlayers))
          ? Number(payload.maxPlayers) : 8;
        const mode = ALLOWED_MODES.has(payload?.mode) ? payload.mode : "1v1";
        const turnTimeSec = ALLOWED_TURN_TIME_SEC.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 60;
        const stages = ALLOWED_STAGES.includes(Number(payload?.stages)) ? Number(payload.stages) : 3;
        const room = makeRoom({ maxPlayers, mode, turnTimeSec, stages });
        mkRooms.set(room.id, room);
        mkInvites.set(room.inviteCode, room.id);
        const { avatar, nick } = await loadProfile(payload?.nickname);
        const p = newPlayerState(nick || "방장", false, avatar, socket.id);
        if (UNIT_IDS.includes(payload?.unit)) p.unit = payload.unit;
        room.players.set(me.id, p);
        room.playerOrder.push(me.id);
        mkUserRoom.set(me.id, room.id);
        socket.join(socketRoomName(room.id));
        cb?.({ ok: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) { console.error("[makak:createRoom]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    // 솔로: 봇과 대전 (게스트 가능, 초대 코드 없음)
    socket.on("makak:createSolo", async (payload, cb) => {
      try {
        leaveOld();
        const mode = ALLOWED_MODES.has(payload?.mode) ? payload.mode : "1v1";
        const turnTimeSec = ALLOWED_TURN_TIME_SEC.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 0;
        const stages = ALLOWED_STAGES.includes(Number(payload?.stages)) ? Number(payload.stages) : 3;
        const difficulty = ALLOWED_LEVELS.has(payload?.difficulty) ? payload.difficulty : "normal";
        const room = makeRoom({ maxPlayers: MODE_PLAYER_COUNT[mode], mode, turnTimeSec, stages, solo: true, difficulty });
        mkRooms.set(room.id, room);
        const { avatar, nick } = await loadProfile(payload?.nickname);
        const p = newPlayerState(nick || payload?.nickname || "플레이어", !!me.isGuest, avatar, socket.id);
        if (UNIT_IDS.includes(payload?.unit)) p.unit = payload.unit;
        room.players.set(me.id, p);
        room.playerOrder.push(me.id);
        fillBots(room);
        mkUserRoom.set(me.id, room.id);
        socket.join(socketRoomName(room.id));
        cb?.({ ok: true, roomId: room.id, inviteCode: null, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) { console.error("[makak:createSolo]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("makak:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = mkInvites.get(code);
        const room = roomId ? mkRooms.get(roomId) : null;
        if (!room || room.solo) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.status === "ended") return cb?.({ ok: false, error: "GAME_ENDED" });
        if (room.players.has(me.id)) {
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          socket.join(socketRoomName(roomId));
          mkUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
        const { avatar, nick } = await loadProfile(payload?.nickname);
        const playerName = nick || payload?.nickname || (me.isGuest ? "게스트" : "유저");
        const p = newPlayerState(playerName, !!me.isGuest, avatar, socket.id);
        if (UNIT_IDS.includes(payload?.unit)) p.unit = payload.unit;
        room.players.set(me.id, p);
        room.playerOrder.push(me.id);
        mkUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));
        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) { console.error("[makak:joinRoom]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("makak:setOptions", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      if (payload?.maxPlayers !== undefined && !room.solo) {
        const n = Number(payload.maxPlayers);
        if (!ALLOWED_MAX_PLAYERS.includes(n)) return cb?.({ ok: false, error: "INVALID_MAX" });
        if (n < room.players.size) return cb?.({ ok: false, error: "BELOW_CURRENT" });
        room.maxPlayers = n;
      }
      if (payload?.mode !== undefined) {
        if (!ALLOWED_MODES.has(payload.mode)) return cb?.({ ok: false, error: "INVALID_MODE" });
        room.mode = payload.mode;
        if (room.solo) fillBots(room);
      }
      if (payload?.turnTimeSec !== undefined) {
        const n = Number(payload.turnTimeSec);
        if (!ALLOWED_TURN_TIME_SEC.includes(n)) return cb?.({ ok: false, error: "INVALID_TIME" });
        room.turnTimeSec = n;
      }
      if (payload?.stages !== undefined) {
        const n = Number(payload.stages);
        if (!ALLOWED_STAGES.includes(n)) return cb?.({ ok: false, error: "INVALID_STAGES" });
        room.stages = n;
      }
      if (payload?.difficulty !== undefined) {
        if (!ALLOWED_LEVELS.has(payload.difficulty)) return cb?.({ ok: false, error: "INVALID_LEVEL" });
        room.difficulty = payload.difficulty;
      }
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    // 캐릭터 선택 (대기실 / 결과 화면)
    socket.on("makak:selectUnit", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      const unit = String(payload?.unit || "");
      if (!UNIT_IDS.includes(unit)) return cb?.({ ok: false, error: "INVALID_UNIT" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      p.unit = unit;
      broadcastRoomState(io, room);
      cb?.({ ok: true });
    });

    socket.on("makak:startGame", (_payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.status === "ended") { room.endedAt = null; }
      if (room.solo) fillBots(room);
      const required = MODE_PLAYER_COUNT[room.mode];
      if (room.players.size !== required) return cb?.({ ok: false, error: "MODE_PLAYER_COUNT_MISMATCH" });
      startMatch(room);
      cb?.({ ok: true });
      emitRoom(io, room, "makak:stageStart", { stageIndex: 0, stageTotal: room.stageTotal, stage: publicStage(room), first: true });
      broadcastRoomState(io, room);
      // 첫 턴도 연결된 사람 중에서 (끊긴 사람에게 주면 유예 30초 동안 게임이 멈춘다)
      const first = nextAlivePlayerId(room, null) || room.playerOrder[0];
      startTurn(io, room, first);
    });

    socket.on("makak:move", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_PLAYING" });
      cb?.(doMove(io, room, me.id, Number(payload?.row), Number(payload?.col)));
    });

    socket.on("makak:placeWall", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_PLAYING" });
      cb?.(doWall(io, room, me.id, payload?.orientation, Number(payload?.row), Number(payload?.col)));
    });

    socket.on("makak:skill", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_PLAYING" });
      cb?.(doSkill(io, room, me.id, payload));
    });

    socket.on("makak:leaveRoom", (_payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: true });
      leavePlayer(io, room, me.id);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("makak:kickPlayer", (payload, cb) => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      const target = room.players.get(targetId);
      if (target?.isBot) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (target?.socketId) io.to(target.socketId).emit("makak:kicked", { reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId);
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const roomId = mkUserRoom.get(me.id);
      const room = roomId ? mkRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby") leavePlayer(io, room, me.id);
      else {
        io.to(socketRoomName(room.id)).emit("makak:peerDisconnect", { playerId: me.id });
        maybeScheduleEmptyRoomDelete(io, room);
        // 끊긴 사람의 차례였다면 즉시 넘긴다 (유예 30초 동안 전원이 기다리지 않도록). 돌아오면 순서에 복귀
        if (room.status === "playing" && !room.stageBreak && room.currentTurnPlayerId === me.id) {
          clearTurnTimer(room);
          advanceTurn(io, room);
        }
        // 30초 후 재접속 안 했으면 alive=false 처리 — 본인 차례면 자동 턴 패스
        const expectedRoomId = roomId;
        setTimeout(() => {
          const r = mkRooms.get(expectedRoomId);
          if (!r || r.status !== "playing") return;
          const pp = r.players.get(me.id);
          if (!pp || pp.connected) return;
          pp.alive = false;
          pp.eliminated = true;
          io.to(socketRoomName(r.id)).emit("makak:peerEliminated", { playerId: me.id, nickname: pp.name, reason: "DISCONNECT_TIMEOUT" });
          if (r.stageBreak) return;
          // 생존자가 한 명/한 팀뿐이면 즉시 종료 (팀전 포함)
          if (checkLastStanding(io, r)) return;
          // 끊긴 사람이 현재 턴이면 다음으로 진행
          if (r.currentTurnPlayerId === me.id) advanceTurn(io, r);
        }, 30_000);
      }
    });
  });
}
