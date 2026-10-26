// =========================
// 차고차고 (DUO Chago) — 실시간 축구 방·네트워크 서버
// 물리: chago-engine.js / 규칙: chago-match.js / 여기서는 방·팀·입력·스냅샷·재접속만 다룬다.
//   · 서버가 모든 걸 판정한다. 클라이언트는 입력(이동·조준·버튼)만 보낸다.
//   · 모든 방을 전역 스케줄러 1개가 30Hz로 진행(드리프트 보정, 밀리면 최대 3틱 따라잡고 나머지는 버림)
//   · 입력 이벤트는 safeOn(IP당 10초 30개 한도)을 쓰지 않고 소켓별 자체 한도를 쓴다
// 이벤트 prefix: 'chago:*', socket room: `chago:${roomId}`
// 참조 패턴: golf.js (방 구조), raising-pvp.js (재접속 스냅샷)
// =========================

import { DT, packWorld } from "./chago-engine.js";
import { createBot, botInput, botShootout } from "./chago-bot.js";
import { createMatch, matchAddPlayer, stepMatch, publicMatchState, finalStats, RULES, ALLOWED_DURATIONS, DEFAULT_DURATION } from "./chago-match.js";
import { createStore } from "./chago-store.js";
import { seasonId, assessSuspicion, computeRatingChanges } from "./chago-rank.js";

const rooms = new Map();
const invites = new Map();
const userRoom = new Map();
const active = new Set();           // 경기 중인 방
const specRoom = new Map();         // 관전자 userId → roomId
let storeRef = null;                // DB 저장소(registerChago 에서 생성)
const reportHits = new Map();       // 신고 남용 방지: userId → [시각…]
const MAX_SPECTATORS = 30;
const REPORT_REASONS = ["cheat", "abuse", "afk", "other"];

const MAX_NICK_LEN = 14;
const MAX_TEAM_SIZE = 4;
const EMPTY_ROOM_TTL_MS = 60_000;
const LOBBY_GRACE_MS = 60_000;      // 대기실에서 끊긴 사람을 기다리는 시간(링크 공유하러 앱 전환 등)
const RECONNECT_GRACE_MS = 10_000;  // 경기 중 끊긴 사람을 기다리는 시간 (이후 '자리 비움' → 3단계에서 봇 대체)
const INPUT_STALE_MS = 250;         // 이 시간 넘게 입력이 없으면 중립 입력
const INPUT_QUEUE_MAX = 10;         // 소켓별 입력 대기열 상한 (클라이언트 한 틱 = 서버 한 틱 대응을 지키기 위해 쌓아 두고 하나씩 처리)
const INPUT_QUEUE_LAG = 4;          // 이보다 많이 밀리면 최근 쪽으로 건너뛴다
const SNAP_HZ = 20;                 // 스냅샷 전송 빈도 (시뮬은 30Hz)
const INPUT_BUCKET_MAX = 40;        // 소켓별 입력 토큰 버킷(초당 90개 보충)
const INPUT_REFILL_PER_SEC = 90;
const MAX_CATCHUP_TICKS = 3;

// ===== util =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!invites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
const roomName = (id) => `chago:${id}`;
const cleanNick = (v, dflt) => {
  const s = String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NICK_LEN);
  return s || dflt;
};

function newPlayer(uid, name, isGuest, avatarUrl, socketId, team) {
  return {
    uid, name, isGuest: !!isGuest, avatar_url: avatarUrl || null, team, socketId,
    connected: true, goneTimer: null, away: false, pending: false, pendingSince: 0,
    eid: null,
    queue: [], cur: null, inputAt: 0, lastSeq: -1,
    bucket: { n: INPUT_BUCKET_MAX, t: Date.now() }, dropped: 0,
  };
}

function teamCounts(room) {
  const c = [0, 0];
  for (const p of room.players.values()) c[p.team] += 1;
  return c;
}
function pickTeam(room) {
  const c = teamCounts(room);
  const cap = room.config.teamSize;
  const order = c[0] <= c[1] ? [0, 1] : [1, 0];
  for (const t of order) if (c[t] < cap) return t;
  return null;
}

// 팀별로 봇이 채울 자리 수 (사람이 모자란 만큼)
function botSlotsFor(room) {
  if (!room.config.fillBots) return [0, 0];
  const c = [0, 0];
  for (const p of room.players.values()) if (p.connected && !p.pending) c[p.team] += 1;
  return [Math.max(0, room.config.teamSize - c[0]), Math.max(0, room.config.teamSize - c[1])];
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostId: room.hostUserId,
    status: room.status,
    config: room.config,
    maxPlayers: room.config.teamSize * 2,
    botSlots: botSlotsFor(room),
    spectators: room.specs.size,
    players: [...room.players.values()].map((p) => ({
      id: p.uid, nickname: p.name, avatar_url: p.avatar_url, isGuest: p.isGuest,
      team: p.team, connected: p.connected, away: p.away, isHost: p.uid === room.hostUserId, eid: p.eid, pending: !!p.pending,
    })),
  };
}
function broadcastRoom(io, room) { io.to(roomName(room.id)).emit("chago:roomState", publicRoom(room)); }

function seatInfo(s) { return { eid: s.eid, uid: s.uid, name: s.name, avatar_url: s.avatar_url || null, team: s.team, slot: s.slot, bot: !!s.bot }; }

function gameInit(room, p) {
  const m = room.match;
  return {
    config: room.config,
    field: m ? m.world.field : null,
    roster: [...room.seats.values()].map(seatInfo),
    you: p ? p.eid : null,
    spectator: !p,
    startedAt: room.startedAt,
  };
}

// ===== 방 정리 =====
function clearPlayerTimer(p) { if (p.goneTimer) { clearTimeout(p.goneTimer); p.goneTimer = null; } }

function deleteRoom(io, room, reason) {
  if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
  for (const p of room.players.values()) clearPlayerTimer(p);
  active.delete(room);
  rooms.delete(room.id);
  invites.delete(room.inviteCode);
  for (const uid of room.players.keys()) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  for (const uid of room.specs.keys()) if (specRoom.get(uid) === room.id) specRoom.delete(uid);
  io.to(roomName(room.id)).emit("chago:roomClosed", { reason });
  io.in(roomName(room.id)).socketsLeave(roomName(room.id));
  console.log(`[chago] room ${room.id} deleted: ${reason}`);
}

function checkEmpty(io, room) {
  const anyone = [...room.players.values()].some((p) => p.connected);
  if (anyone) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (!room.emptyTimer) {
    room.emptyTimer = setTimeout(() => {
      const r = rooms.get(room.id);
      if (r && [...r.players.values()].every((p) => !p.connected)) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function transferHost(room) {
  const next = [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
  if (next) room.hostUserId = next.uid;
}

// 완전히 내보냄(대기실 퇴장/강퇴/유예 만료). 경기 중이면 엔진에서 선수도 뺀다.
function removePlayer(io, room, uid, why) {
  const p = room.players.get(uid);
  if (!p) return;
  clearPlayerTimer(p);
  room.players.delete(uid);
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  room.pending = room.pending.filter((u) => u !== uid);
  if (room.status === "playing" && room.match && p.eid != null) {
    // 나간 사람의 선수는 그대로 두고 봇이 이어서 움직인다
    const seat = room.seats.get(p.eid);
    const ent = room.mp.get(p.eid);
    if (ent && ent.uid === uid) { ent.left = true; ent.dropped = p.dropped; }
    if (seat) { seat.uid = null; seat.name = p.name + " (봇)"; seat.avatar_url = null; handToBot(io, room, seat); }
  }
  if (room.players.size === 0) return deleteRoom(io, room, "ALL_LEFT");
  if (room.hostUserId === uid) transferHost(room);
  io.to(roomName(room.id)).emit("chago:peerLeave", { playerId: uid, nickname: p.name, why });
  broadcastRoom(io, room);
  checkEmpty(io, room);
}

// ===== 경기 시작/종료 =====
// ----- 봇 제어권 -----
function handToBot(io, room, seat) {
  if (room.ctl.has(seat.eid)) return;
  const ctl = createBot({ eid: seat.eid, team: seat.team, slot: seat.slot, teamSize: room.config.teamSize, level: room.config.botLevel, seed: (Date.now() ^ (seat.eid * 977)) & 0xffffff, shared: room.shared[seat.team] });
  room.ctl.set(seat.eid, ctl);
  seat.bot = true;
  io.to(roomName(room.id)).emit("chago:seat", seatInfo(seat));
}
function takeFromBot(io, room, seat, p) {
  room.ctl.delete(seat.eid);
  if (room.shared[seat.team].roles) delete room.shared[seat.team].roles[String(seat.eid)];
  seat.bot = false; seat.uid = p.uid; seat.name = p.name; seat.avatar_url = p.avatar_url;
  p.eid = seat.eid; p.pending = false; p.away = false;
  p.queue = []; p.cur = null; p.inputAt = 0; p.lastSeq = -1;
  io.to(roomName(room.id)).emit("chago:seat", seatInfo(seat));
}

function startMatch(io, room) {
  const cfg = room.config;
  const m = createMatch({ teamSize: cfg.teamSize, durationSec: cfg.durationSec, mode: cfg.mode });
  room.seats = new Map(); room.ctl = new Map(); room.pending = [];
  room.shared = [{ plan: null, roles: {} }, { plan: null, roles: {} }];
  const humans = [[], []];
  for (const p of room.players.values()) { p.eid = null; p.pending = false; if (p.connected) humans[p.team].push(p); }
  const nb = [0, 1].map((t) => (cfg.fillBots ? Math.max(0, cfg.teamSize - humans[t].length) : 0));
  let eid = 0;
  // 자리(슬롯): 봇이 앞쪽(키퍼·수비), 사람이 뒤쪽(공격)
  for (const t of [0, 1]) humans[t].forEach((p, i) => {
    p.eid = eid++;
    p.queue = []; p.cur = null; p.inputAt = 0; p.lastSeq = -1; p.away = false;
    const slot = nb[t] + i;
    matchAddPlayer(m, { id: String(p.eid), team: t, slot });
    room.seats.set(p.eid, { eid: p.eid, team: t, slot, uid: p.uid, name: p.name, avatar_url: p.avatar_url, bot: false });
  });
  const humanCount = eid;
  let botNo = 0;
  for (const t of [0, 1]) for (let i = 0; i < nb[t]; i++) {
    const seat = { eid: eid++, team: t, slot: i, uid: null, name: "봇 " + (++botNo), avatar_url: null, bot: false };
    matchAddPlayer(m, { id: String(seat.eid), team: t, slot: i });
    room.seats.set(seat.eid, seat);
    const ctl = createBot({ eid: seat.eid, team: t, slot: i, teamSize: cfg.teamSize, level: cfg.botLevel, seed: ((Date.now() & 0xffff) * 31 + seat.eid * 977) >>> 0, shared: room.shared[t] });
    room.ctl.set(seat.eid, ctl); seat.bot = true;
  }
  room.mp = new Map();
  for (const seat of room.seats.values()) {
    const pl = seat.uid ? room.players.get(seat.uid) : null;
    if (pl) pl.dropped = 0;
    room.mp.set(seat.eid, { eid: seat.eid, team: seat.team, slot: seat.slot, uid: seat.uid, name: seat.name, isGuest: !!(pl && pl.isGuest), bot: !seat.uid, left: false, dropped: 0 });
  }
  room.lastMatchDbId = null;
  room.match = m;
  room.status = "playing";
  room.startedAt = Date.now();
  room.lastState = "";
  room.snapAcc = 0;
  active.add(room);
  for (const p of room.players.values()) {
    if (p.connected && p.socketId && p.eid != null) io.to(p.socketId).emit("chago:gameStart", gameInit(room, p));
  }
  broadcastRoom(io, room);
  ensureLoop(io);
  console.log("[chago] room " + room.id + " start " + cfg.teamSize + "v" + cfg.teamSize + " " + cfg.durationSec + "s humans=" + humanCount + " bots=" + botNo + " level=" + cfg.botLevel);
}

function finishMatch(io, room) {
  const m = room.match;
  room.status = "ended";
  active.delete(room);
  const names = {};
  for (const seat of room.seats.values()) names[seat.eid] = seat.name;
  const fin = finalStats(m);
  const bySeat = (eid) => room.seats.get(Number(eid));
  const rows = fin.rows.map((r) => { const st = bySeat(r.eid); return { ...r, name: st ? st.name : "", bot: !!(st && st.bot), avatar_url: st ? st.avatar_url : null }; });
  io.to(roomName(room.id)).emit("chago:matchEnd", {
    stats: rows, mvp: fin.mvp, mode: m.mode,
    shootout: m.so ? { score: m.so.score, marks: m.so.marks } : null,
    score: m.score, winner: m.winner, reason: m.endReason, overtime: m.overtime,
    goals: m.goals.map((g) => ({ ...g, scorerName: g.scorer != null ? names[g.scorer] || null : null })),
    durationSec: m.durationSec,
  });
  for (const p of room.players.values()) { p.eid = null; p.pending = false; }
  room.pending = [];
  broadcastRoom(io, room);
  console.log(`[chago] room ${room.id} end score=${m.score.join(":")} winner=${m.winner} reason=${m.endReason}`);
  persistMatch(io, room, m, rows, fin).catch((e) => console.error("[chago] persist", e));
}

// 경기 기록 + 레이팅 반영 (비동기, 게임 진행과 무관 — 실패해도 경기에는 영향 없음)
async function persistMatch(io, room, m, rows, fin) {
  const store = storeRef;
  if (!store || !store.enabled) return;
  const endedAt = Date.now(), startedAt = room.startedAt ?? endedAt;
  if (endedAt - startedAt < 15_000) return;                       // 너무 짧은 경기는 기록하지 않음
  const season = seasonId(endedAt);
  const players = rows.map((r) => {
    const e = room.mp.get(Number(r.eid));
    const human = !!(e && !e.bot && e.uid);
    const live = human ? room.players.get(e.uid) : null;
    const abandoned = !!(human && (e.left || (live && live.away && !live.connected)));
    const sus = human ? assessSuspicion({ dropped: live ? live.dropped : e.dropped, shots: r.shots, perfect: r.perfect, onTarget: r.onTarget }) : { flags: [], blocked: false, score: 0 };
    return {
      eid: Number(r.eid), team: r.team, slot: e ? e.slot : 0, uid: human ? e.uid : null, isGuest: !!(e && e.isGuest), bot: !human, late: false,
      abandoned, blocked: sus.blocked, flags: sus.flags, mvp: String(r.eid) === String(fin.mvp), name: r.name,
      goals: r.goals, assists: r.assists, shots: r.shots, on_target: r.onTarget, perfect: r.perfect, passes: r.passes, pass_ok: r.passOk,
      saves: r.saves, super_saves: r.superSaves, tackles: r.tackles, tackle_hits: r.tackleHits, own_goals: r.own, perf: r.rating,
    };
  });
  if (!players.some((p) => !p.bot)) return;
  const summary = { mode: m.mode, reason: m.endReason, winner: m.winner, players };
  const current = await store.loadRatings(players.filter((p) => p.uid && !p.isGuest).map((p) => p.uid), season);
  const changes = computeRatingChanges(summary, current);
  const byUid = new Map(changes.map((c) => [c.uid, c]));
  const mm = {
    room_id: room.id, mode: m.mode, team_size: m.teamSize, duration_sec: m.durationSec, season, score_a: m.score[0], score_b: m.score[1],
    winner: m.winner, end_reason: m.endReason, overtime: m.overtime, shootout: m.so ? { score: m.so.score, marks: m.so.marks } : null,
    ranked: changes.length > 0, started_at: new Date(startedAt).toISOString(), ended_at: new Date(endedAt).toISOString(),
  };
  const pl = players.map((p) => {
    const c = p.uid ? byUid.get(p.uid) : null;
    const result = m.winner == null ? "draw" : p.team === m.winner && !p.abandoned ? "win" : "loss";
    return { ...p, guest: p.isGuest, rated: !!c, rating_before: c ? c.before : p.uid && current[p.uid] ? current[p.uid].rating : null, rating_delta: c ? c.delta : 0, result, flags: p.flags.length ? { blocked: p.blocked, list: p.flags.join(",") } : null };
  });
  const id = await store.recordMatch(mm, pl);
  room.lastMatchDbId = id;
  if (!id) return;
  for (const p of pl) {
    if (p.bot || !p.uid) continue;
    const pp = room.players.get(p.uid);
    if (!pp || !pp.socketId) continue;
    const c = byUid.get(p.uid);
    io.to(pp.socketId).emit("chago:rating", { eid: p.eid, season, rated: !!c, ranked: mm.ranked, before: c ? c.before : null, after: c ? c.after : null, delta: c ? c.delta : 0, abandoned: p.abandoned, blocked: p.blocked });
  }
}

// 틱마다 입력 하나를 꺼낸다. 비어 있으면 직전 입력을 이어 쓰고, 250ms 넘게 새 입력이 없으면 중립.
function nextInput(p, nowMs) {
  if (!p.connected) return null;
  if (p.queue.length) {
    while (p.queue.length > INPUT_QUEUE_LAG) p.queue.shift();
    p.cur = p.queue.shift();
  }
  if (!p.cur || nowMs - p.inputAt > INPUT_STALE_MS) return null;
  return p.cur;
}

// 경기 중에 들어온 사람은 봇이 맡은 자리에 앉는다. 득점 후 휴식·킥오프 대기 중이거나, 그 봇이 공에서 멀 때(최대 5초 대기) 교체.
function processPending(io, room, nowMs) {
  const m = room.match;
  const calm = m.phase === "countdown" || m.phase === "goal";
  for (const uid of [...room.pending]) {
    const p = room.players.get(uid);
    if (!p) { room.pending = room.pending.filter((u) => u !== uid); continue; }
    if (!p.connected) continue;
    const seats = [...room.seats.values()].filter((s) => s.team === p.team && room.ctl.has(s.eid) && !s.uid);
    seats.sort((x, y) => y.slot - x.slot);                    // 키퍼(슬롯0)는 마지막까지 봇에게 맡긴다
    let pick = null;
    for (const s of seats) {
      const wp = m.world.players.find((q) => q.id === String(s.eid));
      const far = wp && Math.hypot(wp.x - m.world.ball.x, wp.y - m.world.ball.y) > 400;
      if (calm || far || nowMs - p.pendingSince >= 5000) { pick = s; break; }
    }
    if (pick) {
      room.pending = room.pending.filter((u) => u !== uid);
      takeFromBot(io, room, pick, p);
      if (p.socketId) io.to(p.socketId).emit("chago:gameStart", gameInit(room, p));
      broadcastRoom(io, room);
    }
  }
}

// ===== 틱 =====
function tickRoom(io, room, nowMs) {
  const m = room.match;
  const inputs = {};
  const live = m.phase === "play" || m.phase === "overtime";
  const so = m.phase === "shootout" && m.so && m.so.state === "live" ? m.so : null;
  for (const seat of room.seats.values()) {
    const ctl = room.ctl.get(seat.eid);
    if (ctl) {
      if (so) {
        const id = String(seat.eid), role = id === so.kicker ? "kicker" : id === so.keeper ? "keeper" : null;
        inputs[seat.eid] = role ? botShootout(ctl, m, role) : null;
      } else inputs[seat.eid] = live ? botInput(ctl, m.world, m.world.tick) : null;
      continue;
    }
    const hp = seat.uid ? room.players.get(seat.uid) : null;
    inputs[seat.eid] = hp ? nextInput(hp, nowMs) : null;
  }
  if (room.pending.length) processPending(io, room, nowMs);
  // 카운트다운·세레머니 중에도 클라이언트가 보낸 시퀀스를 ack 해준다(클라 예측 기록이 쌓이지 않도록)
  for (const seat of room.seats.values()) {
    const hp = seat.uid ? room.players.get(seat.uid) : null;
    if (!hp || hp.lastSeq < 0) continue;
    const wp = m.world.players.find((q) => q.id === String(seat.eid));
    if (wp) wp.seq = hp.lastSeq;
  }
  const evs = stepMatch(m, inputs);
  const rn = roomName(room.id);
  if (evs.length) io.to(rn).emit("chago:ev", evs);

  const st = publicMatchState(m);
  // 승부차기는 시계가 안 가므로 단계·시도·점수 변화를 키에 넣어야 화면에 전달된다
  const soKey = st.so ? `${st.so.state}.${st.so.attempt}.${st.so.marks[0].length}.${st.so.marks[1].length}.${st.so.score[0]}-${st.so.score[1]}.${st.so.kicker}.${st.so.keeper}` : "";
  const key = `${st.phase}|${st.clock}|${st.score[0]}-${st.score[1]}|${st.overtime ? 1 : 0}|${st.winner}|${Math.ceil(st.phaseT)}|${soKey}`;
  if (key !== room.lastState) { room.lastState = key; io.to(rn).emit("chago:matchState", st); }

  room.snapAcc += SNAP_HZ / (1 / DT);
  if (room.snapAcc >= 1) {
    room.snapAcc -= 1;
    io.to(rn).volatile.emit("chago:snap", packWorld(m.world));
  }
  if (m.phase === "ended") finishMatch(io, room);
}

let loopTimer = null;
let nextAt = 0;
const loopStats = { ticks: 0, dropped: 0, maxLateMs: 0 };
let ioRef = null;

function ensureLoop(io) {
  ioRef = io;
  if (loopTimer) return;
  nextAt = performance.now();
  loopTimer = setTimeout(loop, 0);
}

function loop() {
  loopTimer = null;
  const io = ioRef;
  const stepMs = DT * 1000;
  let steps = 0;
  while (nextAt <= performance.now() && steps < MAX_CATCHUP_TICKS) {
    const now = Date.now();
    for (const room of [...active]) {
      try {
        tickRoom(io, room, now);
      } catch (e) {
        console.error(`[chago] tick error room=${room.id}`, e);
        active.delete(room);
        deleteRoom(io, room, "ERROR");
      }
    }
    nextAt += stepMs;
    steps += 1;
    loopStats.ticks += 1;
  }
  const late = performance.now() - nextAt;
  if (late > loopStats.maxLateMs) loopStats.maxLateMs = late;
  if (nextAt <= performance.now()) { loopStats.dropped += Math.floor((performance.now() - nextAt) / stepMs) + 1; nextAt = performance.now() + stepMs; }   // 너무 밀렸으면 따라잡기 포기
  if (active.size === 0) return;                                           // 경기 중인 방이 없으면 타이머 정지
  loopTimer = setTimeout(loop, Math.max(1, nextAt - performance.now()));
}

export function shutdownChago() {
  if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
  for (const r of rooms.values()) {
    if (r.emptyTimer) clearTimeout(r.emptyTimer);
    for (const p of r.players.values()) clearPlayerTimer(p);
  }
  rooms.clear(); invites.clear(); userRoom.clear(); active.clear(); specRoom.clear(); reportHits.clear();
}
export function getStore() { return storeRef; }
// 관리자: 실시간 방 현황 / 강제 종료
export function liveRooms() {
  return [...rooms.values()].map((r) => ({
    id: r.id, inviteCode: r.inviteCode, status: r.status, mode: r.config.mode, teamSize: r.config.teamSize, botLevel: r.config.botLevel,
    humans: [...r.players.values()].map((p) => ({ name: p.name, guest: p.isGuest, connected: p.connected, away: p.away, team: p.team })),
    spectators: r.specs.size,
    phase: r.match ? r.match.phase : null, clock: r.match ? Math.ceil(r.match.clock) : null, score: r.match ? r.match.score.slice() : null,
    startedAt: r.startedAt, ageSec: Math.round((Date.now() - r.createdAt) / 1000),
  }));
}
export function closeRoomById(io, id, reason = "ADMIN") {
  const r = rooms.get(id);
  if (!r) return false;
  deleteRoom(io, r, reason);
  return true;
}

// ===== HTTP: 공개 랭킹 / 내 전적 / 관리자 =====
export function registerChagoRoutes(app, { requireAuth, requireAdmin, io }) {
  const store = () => storeRef;
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error("[chago route]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); } };
  const seasonOf = (q) => (/^\d{4}-\d{2}$/.test(String(q || "")) ? String(q) : seasonId());

  app.get("/chago/leaderboard", wrap(async (req, res) => {
    const season = seasonOf(req.query.season);
    const rows = await store().leaderboard(season, Math.min(100, Number(req.query.limit) || 50));
    res.set("Cache-Control", "public, max-age=30");
    res.json({ ok: true, season, enabled: store().enabled, rows: rows.map((r) => ({ rank: r.rank, nickname: r.nickname, avatar_url: r.avatar_url, rating: r.rating, peak: r.peak, games: r.ranked_games, wins: r.wins, losses: r.losses, goals: r.goals, assists: r.assists, mvps: r.mvps })) });
  }));
  app.get("/chago/me", requireAuth, wrap(async (req, res) => {
    const season = seasonOf(req.query.season);
    const [me, hist] = await Promise.all([store().me(req.user.id, season), store().history(req.user.id, 10)]);
    res.json({ ok: true, season, enabled: store().enabled, stats: me.stats, rank: me.rank, history: hist });
  }));

  app.get("/admin/chago/overview", requireAdmin, wrap(async (_req, res) => {
    res.json({ ok: true, live: liveRooms(), loop: chagoStats(), counts: await store().counts(), season: seasonId() });
  }));
  app.get("/admin/chago/reports", requireAdmin, wrap(async (req, res) => {
    const st = ["pending", "reviewed", "dismissed", "actioned", "all"].includes(req.query.status) ? req.query.status : "pending";
    res.json({ ok: true, rows: await store().listReports(st) });
  }));
  app.patch("/admin/chago/reports/:id", requireAdmin, wrap(async (req, res) => {
    const st = String(req.body?.status || "");
    if (!["reviewed", "dismissed", "actioned", "pending"].includes(st)) return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    res.json({ ok: await store().updateReport(req.params.id, st, req.body?.note) });
  }));
  app.get("/admin/chago/leaderboard", requireAdmin, wrap(async (req, res) => {
    const season = seasonOf(req.query.season);
    res.json({ ok: true, season, rows: await store().leaderboard(season, 100) });
  }));
  app.get("/admin/chago/matches", requireAdmin, wrap(async (req, res) => {
    res.json({ ok: true, rows: await store().recentMatches(Math.min(100, Number(req.query.limit) || 40)) });
  }));
  app.post("/admin/chago/rating", requireAdmin, wrap(async (req, res) => {
    const { season, userId, rating, reset } = req.body || {};
    if (!/^[0-9a-f-]{36}$/i.test(String(userId || "")) || !/^\d{4}-\d{2}$/.test(String(season || ""))) return res.status(400).json({ ok: false, error: "INVALID" });
    console.log(`[chago admin] ${req.user?.id} rating season=${season} user=${userId} ${reset ? "RESET" : "set " + rating}`);
    if (reset) return res.json({ ok: await store().deleteRating(season, userId) });
    const r = await store().setRating(season, userId, rating);
    res.json({ ok: r != null, rating: r });
  }));
  app.post("/admin/chago/rooms/:id/close", requireAdmin, wrap(async (req, res) => {
    console.log(`[chago admin] ${req.user?.id} close room ${req.params.id}`);
    res.json({ ok: closeRoomById(io, req.params.id, "ADMIN") });
  }));
}

export function chagoStats() { return { rooms: rooms.size, active: active.size, ...loopStats }; }
// 테스트 전용: 방 목록(자동 시험이 시간·점수를 조작할 때 사용)
export function _roomsForTest() { return rooms; }
// 테스트 전용: 타이머 없이 경기 중인 방을 n틱 진행
export function _tickForTest(io, n = 1) {
  for (let i = 0; i < n; i++) for (const room of [...active]) tickRoom(io, room, Date.now());
}

// =========================
// 등록
// =========================
export function registerChago(io, supabaseAdmin) {
  storeRef = createStore(supabaseAdmin);
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    const roomOf = () => {
      const id = userRoom.get(me.id);
      return id ? rooms.get(id) || null : null;
    };
    const lobbyLike = (room) => room.status === "lobby" || room.status === "ended";

    async function loadProfile(nick) {
      let avatar = null, name = nick;
      if (!me.isGuest) {
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname) name = data.nickname;        // 닉네임 = 프로필 우선
        } catch {}
      }
      return { avatar, name };
    }

    function on(event, handler) {
      socket.on(event, async (...args) => {
        try { await handler(...args); }
        catch (e) {
          console.error(`[${event}]`, e);
          const cb = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
          cb?.({ ok: false, error: "INTERNAL" });
        }
      });
    }

    // ----- 방 만들기 -----
    on("chago:createRoom", async (payload, cb) => {
      if (typeof cb !== "function") return;
      if (me.isGuest) return cb({ ok: false, error: "GUEST_CANNOT_CREATE" });
      const old = roomOf();
      if (old) removePlayer(io, old, me.id, "left");
      const teamSize = Math.min(MAX_TEAM_SIZE, Math.max(1, Number(payload?.teamSize) | 0 || 2));
      const roomId = `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = {
        id: roomId, inviteCode: genInviteCode(), hostUserId: me.id, status: "lobby",
        config: { teamSize, durationSec: DEFAULT_DURATION, mode: "friendly", botLevel: "normal", fillBots: true },
        players: new Map(), createdAt: Date.now(), startedAt: null,
        match: null, emptyTimer: null, lastState: "", snapAcc: 0,
        mp: new Map(), specs: new Map(), lastMatchDbId: null,
        seats: new Map(), ctl: new Map(), pending: [], shared: [{ plan: null, roles: {} }, { plan: null, roles: {} }],
      };
      rooms.set(roomId, room);
      invites.set(room.inviteCode, roomId);
      const prof = await loadProfile(cleanNick(payload?.nickname, "방장"));
      const p = newPlayer(me.id, cleanNick(prof.name, "방장"), false, prof.avatar, socket.id, 0);
      room.players.set(me.id, p);
      userRoom.set(me.id, roomId);
      socket.join(roomName(roomId));
      cb({ ok: true, roomId, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
      broadcastRoom(io, room);
    });

    // ----- 입장 / 재접속 -----
    on("chago:joinRoom", async (payload, cb) => {
      if (typeof cb !== "function") return;
      const code = String(payload?.inviteCode || "").trim();
      const roomId = invites.get(code);
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });

      const existing = room.players.get(me.id);
      if (existing) {                                     // 재접속
        clearPlayerTimer(existing);
        existing.connected = true; existing.away = false; existing.socketId = socket.id;
        existing.bucket = { n: INPUT_BUCKET_MAX, t: Date.now() };
        if (room.status === "playing" && existing.eid != null) {
          const seat = room.seats.get(existing.eid);
          if (seat && seat.uid === existing.uid && room.ctl.has(seat.eid)) {     // 끊긴 사이 봇이 맡았던 자리 → 돌려받음
            takeFromBot(io, room, seat, existing);
            existing.queue = []; existing.cur = null; existing.lastSeq = -1;
          }
        }
        userRoom.set(me.id, room.id);
        socket.join(roomName(room.id));
        if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
        cb({ ok: true, rejoined: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room),
          game: room.status === "playing" && existing.eid != null ? gameInit(room, existing) : null,
          state: room.match ? publicMatchState(room.match) : null });
        broadcastRoom(io, room);
        return;
      }
      if (room.status === "playing") {
        // 봇이 맡은 자리가 있는 팀(사람이 적은 쪽 우선)에 들어간다
        const free = [0, 1].map((t) => [...room.seats.values()].filter((s) => s.team === t && room.ctl.has(s.eid) && !s.uid).length
          - [...room.players.values()].filter((q) => q.pending && q.team === t).length);
        const humansIn = [0, 1].map((t) => [...room.seats.values()].filter((s) => s.team === t && s.uid).length);
        const cand = [0, 1].filter((t) => free[t] > 0).sort((x, y) => humansIn[x] - humansIn[y]);
        if (!cand.length) return cb({ ok: false, error: "ROOM_FULL" });
        const old2 = roomOf();
        if (old2 && old2.id !== room.id) removePlayer(io, old2, me.id, "left");
        const prof2 = await loadProfile(cleanNick(payload?.nickname, me.isGuest ? "게스트" : "유저"));
        const pp = newPlayer(me.id, cleanNick(prof2.name, me.isGuest ? "게스트" : "유저"), me.isGuest, prof2.avatar, socket.id, cand[0]);
        pp.pending = true; pp.pendingSince = Date.now();
        room.players.set(me.id, pp);
        room.pending.push(me.id);
        userRoom.set(me.id, room.id);
        socket.join(roomName(room.id));
        if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
        cb({ ok: true, pending: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcastRoom(io, room);
        return;
      }
      const team = pickTeam(room);
      if (team == null) return cb({ ok: false, error: "ROOM_FULL" });
      const old = roomOf();
      if (old && old.id !== room.id) removePlayer(io, old, me.id, "left");
      const prof = await loadProfile(cleanNick(payload?.nickname, me.isGuest ? "게스트" : "유저"));
      const p = newPlayer(me.id, cleanNick(prof.name, me.isGuest ? "게스트" : "유저"), me.isGuest, prof.avatar, socket.id, team);
      room.players.set(me.id, p);
      userRoom.set(me.id, room.id);
      socket.join(roomName(room.id));
      if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
      cb({ ok: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
      broadcastRoom(io, room);
    });

    // ----- 설정 (방장, 대기실) -----
    on("chago:setConfig", (payload, cb) => {
      const room = roomOf();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (!lobbyLike(room)) return cb?.({ ok: false, error: "NOT_LOBBY" });
      const next = { ...room.config };
      if (payload?.teamSize != null) {
        const n = Number(payload.teamSize) | 0;
        if (n < 1 || n > MAX_TEAM_SIZE) return cb?.({ ok: false, error: "INVALID_TEAM_SIZE" });
        if (teamCounts(room).some((c) => c > n)) return cb?.({ ok: false, error: "BELOW_CURRENT" });
        next.teamSize = n;
      }
      if (payload?.durationSec != null) {
        if (!ALLOWED_DURATIONS.includes(Number(payload.durationSec))) return cb?.({ ok: false, error: "INVALID_DURATION" });
        next.durationSec = Number(payload.durationSec);
      }
      if (payload?.mode != null) {
        if (!RULES[payload.mode]?.enabled) return cb?.({ ok: false, error: "MODE_DISABLED" });
        next.mode = payload.mode;
      }
      if (payload?.botLevel != null) {
        if (!["easy", "normal", "hard"].includes(payload.botLevel)) return cb?.({ ok: false, error: "INVALID_BOT_LEVEL" });
        next.botLevel = payload.botLevel;
      }
      if (payload?.fillBots != null) next.fillBots = !!payload.fillBots;
      room.config = next;
      broadcastRoom(io, room);
      cb?.({ ok: true, config: next });
    });

    on("chago:setTeam", (payload, cb) => {
      const room = roomOf();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (!lobbyLike(room)) return cb?.({ ok: false, error: "NOT_LOBBY" });
      const t = Number(payload?.team);
      if (t !== 0 && t !== 1) return cb?.({ ok: false, error: "INVALID_TEAM" });
      const p = room.players.get(me.id);
      if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (p.team !== t && teamCounts(room)[t] >= room.config.teamSize) return cb?.({ ok: false, error: "TEAM_FULL" });
      p.team = t;
      broadcastRoom(io, room);
      cb?.({ ok: true });
    });

    on("chago:kickPlayer", (payload, cb) => {
      const room = roomOf();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (!lobbyLike(room)) return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      const t = room.players.get(targetId);
      if (!t || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (t.socketId) io.to(t.socketId).emit("chago:kicked", { reason: "KICKED_BY_HOST" });
      removePlayer(io, room, targetId, "kicked");
      cb?.({ ok: true });
    });

    // ----- 게임 시작 -----
    on("chago:startGame", (_payload, cb) => {
      const room = roomOf();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (![...room.players.values()].some((p) => p.connected)) return cb?.({ ok: false, error: "NO_PLAYERS" });
      startMatch(io, room);
      cb?.({ ok: true });
    });

    // ----- 입력 (초당 최대 ~30회, 소켓별 한도) -----
    socket.on("chago:input", (d) => {
      const room = roomOf();
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id || p.eid == null) return;
      if (!d || typeof d !== "object") return;
      const now = Date.now();
      const b = p.bucket;
      b.n = Math.min(INPUT_BUCKET_MAX, b.n + ((now - b.t) / 1000) * INPUT_REFILL_PER_SEC);
      b.t = now;
      if (b.n < 1) { p.dropped += 1; return; }
      b.n -= 1;
      const s = Number(d.s) | 0;
      if (s <= p.lastSeq && p.lastSeq - s < 1000) return;       // 오래됐거나 중복 (크게 작으면 클라 재시작으로 보고 허용)
      const f = Number(d.f) | 0;
      p.queue.push({ seq: s, mx: d.mx, my: d.my, ax: d.ax, ay: d.ay, shoot: !!(f & 1), pass: !!(f & 2), dash: !!(f & 4), tackle: !!(f & 8) });
      if (p.queue.length > INPUT_QUEUE_MAX) p.queue.shift();
      p.inputAt = now;
      p.lastSeq = s;
    });

    // 이모티콘: 0~5 (소켓별 1.2초에 한 번). 경기 중 자기 자리에서만
    socket.on("chago:emote", (d) => {
      const room = roomOf();
      if (!room || room.status !== "playing") return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id || p.eid == null) return;
      const e = d && typeof d.e === "number" ? d.e : NaN;
      if (!Number.isInteger(e) || e < 0 || e > 5) return;
      const now = Date.now();
      if (now - (p.lastEmote ?? -1e12) < 1200) return;
      p.lastEmote = now;
      io.to(roomName(room.id)).emit("chago:emote", { eid: p.eid, e });
    });

    // 왕복 지연 측정
    socket.on("chago:ping", (t, cb) => { if (typeof cb === "function") cb({ t, st: Date.now() }); });

    // ----- 퇴장 / 상태 재요청 -----
    on("chago:leaveRoom", (_payload, cb) => {
      const room = roomOf();
      if (room) { socket.leave(roomName(room.id)); removePlayer(io, room, me.id, "left"); }
      cb?.({ ok: true });
    });

    // ----- 관전: 진행 중인 방을 코드로 입장해 구경만 한다 (자리·입력 없음, 최대 30명) -----
    on("chago:spectate", (payload, cb) => {
      if (typeof cb !== "function") return;
      if (userRoom.has(me.id) || specRoom.has(me.id)) return cb({ ok: false, error: "ALREADY_IN_ROOM" });
      const roomId = invites.get(String(payload?.inviteCode || "").trim());
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.status !== "playing" || !room.match) return cb({ ok: false, error: "NOT_PLAYING" });
      if (room.specs.size >= MAX_SPECTATORS) return cb({ ok: false, error: "SPECTATORS_FULL" });
      room.specs.set(me.id, { socketId: socket.id, name: cleanNick(payload?.nickname, "관전자") });
      specRoom.set(me.id, room.id);
      socket.join(roomName(room.id));
      cb({ ok: true, spectator: true, roomId: room.id, room: publicRoom(room), game: gameInit(room, null), state: publicMatchState(room.match) });
      broadcastRoom(io, room);
    });
    const leaveSpectate = () => {
      const id = specRoom.get(me.id);
      if (!id) return false;
      specRoom.delete(me.id);
      const room = rooms.get(id);
      socket.leave(roomName(id));
      if (room && room.specs.delete(me.id)) broadcastRoom(io, room);
      return true;
    };
    on("chago:leaveSpectate", (_payload, cb) => { leaveSpectate(); cb?.({ ok: true }); });

    // ----- 신고: 직전 경기에 같이 뛴 사람만, 로그인 필요, 10분에 5번까지 -----
    on("chago:report", async (payload, cb) => {
      if (typeof cb !== "function") return;
      if (me.isGuest) return cb({ ok: false, error: "LOGIN_REQUIRED" });
      const room = roomOf();
      if (!room || !room.mp.size) return cb({ ok: false, error: "NO_MATCH" });
      const ent = room.mp.get(Number(payload?.eid));
      const mine = [...room.mp.values()].some((e) => e.uid === me.id);
      if (!ent || ent.bot || !ent.uid || !mine) return cb({ ok: false, error: "INVALID_TARGET" });
      if (ent.uid === me.id) return cb({ ok: false, error: "SELF_REPORT" });
      const reason = String(payload?.reason || "");
      if (!REPORT_REASONS.includes(reason)) return cb({ ok: false, error: "INVALID_REASON" });
      const now = Date.now();
      const hits = (reportHits.get(me.id) || []).filter((t) => now - t < 600_000);
      if (hits.length >= 5) return cb({ ok: false, error: "RATE_LIMITED" });
      hits.push(now); reportHits.set(me.id, hits);
      const id = await storeRef.createReport({
        match_id: room.lastMatchDbId || null, room_id: room.id, kind: "manual", reporter_id: me.id, target_user_id: ent.uid,
        target_name: String(ent.name || "").slice(0, 30), reason, detail: String(payload?.detail || "").replace(/[\u0000-\u001f]/g, " ").slice(0, 300) || null,
      });
      cb({ ok: !!id, error: id ? undefined : "SAVE_FAILED_OR_DUPLICATE" });
    });

    on("chago:requestState", (_payload, cb) => {
      const room = roomOf();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const p = room.players.get(me.id);
      cb?.({ ok: true, room: publicRoom(room), game: room.status === "playing" && p?.eid != null ? gameInit(room, p) : null, state: room.match ? publicMatchState(room.match) : null });
    });

    // ----- 연결 끊김 -----
    socket.on("disconnect", () => {
      const sid = specRoom.get(me.id);
      if (sid) { const r0 = rooms.get(sid); if (r0 && r0.specs.get(me.id)?.socketId === socket.id) leaveSpectate(); }
      const room = roomOf();
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id) return;           // 새 소켓으로 이미 교체됨
      p.connected = false;
      p.queue = []; p.cur = null;
      clearPlayerTimer(p);
      if (room.status === "playing" && p.eid != null) {
        p.goneTimer = setTimeout(() => {
          p.goneTimer = null;
          if (!p.connected) {
            p.away = true;
            const seat = p.eid != null ? room.seats.get(p.eid) : null;
            if (seat && room.status === "playing") handToBot(io, room, seat);
            broadcastRoom(io, room);
          }
        }, RECONNECT_GRACE_MS);
      } else {
        p.goneTimer = setTimeout(() => { p.goneTimer = null; if (!p.connected) removePlayer(io, room, me.id, "disconnect"); }, LOBBY_GRACE_MS);
      }
      broadcastRoom(io, room);
      checkEmpty(io, room);
    });
  });
}
