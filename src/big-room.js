// =========================
// 대규모 방(9명 이상) 공통 — 블록블래스트·수라상·피해피해 (사과게임은 apple-multi.js 안에 같은 방식으로 따로 있음)
// 작은 방: 각자 보낸 점수·미니보드를 방 전원에게 그대로 전달 (인원² 으로 늘어남)
// 대규모 방: 서버가 저장만 해 두고 1초마다
//   ① 순위표 1장(전원 점수)을 방 전체에
//   ② 상위 3명 미니보드(바뀐 것만)를 방 전체에
//   ③ 각자 고른 관전 대상 미니보드(바뀐 것만)를 그 사람에게만
// =========================
export const BIG_ROOM_MIN = 9;
export const BIG_ALLOWED_MAX_PLAYERS = [2, 4, 6, 8, 12, 16, 20, 30, 40, 50];
const BOARD_TICK_MS = 1000;
const TOP_SNAP = 3;

export const isBig = (room) => (room?.maxPlayers || 0) >= BIG_ROOM_MIN;

// 미니보드가 새로 들어왔을 때 호출 (대규모 방이면 true → 호출한 쪽은 전원 전달을 건너뜀)
export function markSnapshot(room, p) {
  p.snapVer = (p.snapVer || 0) + 1;
  return isBig(room);
}

// opts: { boardEvent, entry(uid, p) → 순위표 한 줄, order(room) → uid 배열(순위순), snapEvent, snapPayload(uid, p) }
export function startBoard(io, room, sr, opts) {
  stopBoard(room);
  if (!isBig(room)) return;
  room._topSent = new Map();
  for (const p of room.players.values()) { p.snapVer = 0; p.watchSentVer = -1; }
  room.boardTimer = setInterval(() => {
    try { boardTick(io, room, sr, opts); } catch (e) { console.error("[big-room] tick", e); }
  }, BOARD_TICK_MS);
}

export function stopBoard(room) {
  if (room?.boardTimer) { clearInterval(room.boardTimer); room.boardTimer = null; }
}

function boardTick(io, room, sr, opts) {
  if (room.status !== "playing") return stopBoard(room);
  const order = opts.order(room);
  io.to(sr).emit(opts.boardEvent, {
    players: order.map(uid => { const p = room.players.get(uid); return p ? opts.entry(uid, p) : null; }).filter(Boolean),
  });
  const top = order.slice(0, TOP_SNAP);
  for (const uid of top) {
    const p = room.players.get(uid);
    if (!p || !p.snapVer || room._topSent.get(uid) === p.snapVer) continue;
    room._topSent.set(uid, p.snapVer);
    io.to(sr).emit(opts.snapEvent, opts.snapPayload(uid, p));
  }
  for (const w of room.players.values()) {
    if (!w.connected || !w.socketId || !w.watch || top.includes(w.watch)) continue;
    const t = room.players.get(w.watch);
    if (!t || !t.snapVer || w.watchSentVer === t.snapVer) continue;
    w.watchSentVer = t.snapVer;
    io.to(w.socketId).emit(opts.snapEvent, opts.snapPayload(w.watch, t));
  }
}

// 관전 대상 고르기: payload { playerId } (null이면 해제). 대규모 방 경기 중이면 바로 한 번 보내 줌
export function setWatch(socket, room, meId, payload, opts) {
  const p = room?.players.get(meId);
  if (!p) return;
  const target = String(payload?.playerId || "");
  p.watch = target && target !== meId && room.players.has(target) ? target : null;
  p.watchSentVer = -1;
  if (p.watch && isBig(room) && room.status === "playing") {
    const t = room.players.get(p.watch);
    if (t?.snapVer) { p.watchSentVer = t.snapVer; socket.emit(opts.snapEvent, opts.snapPayload(p.watch, t)); }
  }
}
