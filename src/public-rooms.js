// =========================
// 공개 방 — 멀티 게임의 공개 방을 한곳에 모음 (게임천국 "지금 열린 공개 방")
// · 방장이 켠 방만 보임(기본은 비공개). 대기 중이고 자리가 남은 방만. 입장은 게스트도 가능(각 게임의 기존 입장 그대로)
// · 방문자는 HTTP로 조회(실시간 연결을 새로 열지 않음). 결과 3초 보관
// · 게임 파일은 addPublicRooms 한 줄만 호출하고 방 데이터 구조는 건드리지 않음
// =========================
const SOURCES = new Map(); // game → { rooms, skip } 또는 { list }
const CACHE_MS = 3000, MAX_ROWS = 60;

const hostIdOf = (r) => r.hostUserId ?? r.host;
const statusOf = (r) => r.status ?? r.phase;
const codeOf = (r) => r.inviteCode ?? r.code;
const nameOf = (p) => p?.name || p?.nickname || p?.nick || p?.profile?.nick || "";

// 혼자 AI와 하는 방·코드 없는 방은 공개 대상이 아님
const notListable = (r) => !!(r.solo || r.soloAi) || !codeOf(r);
export function addPublicRooms(game, rooms) { SOURCES.set(game, { rooms }); }
export function addPublicList(game, list) { SOURCES.set(game, { list }); }

function rowsOf(src) {
  if (src.list) return src.list();
  const out = [];
  for (const r of src.rooms.values()) {
    if (!r.isPublic || statusOf(r) !== "lobby" || notListable(r)) continue;
    const n = r.players?.size ?? 0, max = r.maxPlayers || 2; if (n >= max) continue;
    out.push({ code: codeOf(r), host: nameOf(r.players?.get(hostIdOf(r))), n, max });
  }
  return out;
}
export function collectPublicRooms() {
  const rows = [];
  for (const [game, src] of SOURCES) {
    try { for (const r of rowsOf(src)) rows.push({ game, code: r.code, host: String(r.host || "").slice(0, 20), n: r.n, max: r.max, playing: !!r.playing, locked: !!r.locked }); }
    catch (e) { console.error("[public-rooms]", game, e); } // 한 게임이 실패해도 나머지는 보여 줌
  }
  // 대기 중인 방 먼저, 그다음 사람이 많은 방
  return rows.sort((a, b) => Number(a.playing) - Number(b.playing) || b.n - a.n).slice(0, MAX_ROWS);
}
// 내가 방장인 대기실 찾기
function myLobby(game, uid) { const src = SOURCES.get(game); if (!src?.rooms) return null; for (const r of src.rooms.values()) if (hostIdOf(r) === uid && statusOf(r) === "lobby" && !notListable(r)) return r; return null; }

export function registerPublicRooms(app, io) {
  let cache = null, at = 0;
  app.get("/public-rooms", (_req, res) => {
    const t = Date.now();
    if (!cache || t - at > CACHE_MS) { cache = { ok: true, rooms: collectPublicRooms() }; at = t; }
    res.set("Cache-Control", "no-store");
    res.json(cache);
  });
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const reply = (cb, v) => { if (typeof cb === "function") cb(v); }; let lastSet = 0;
    socket.on("pub:get", (d, cb) => { const r = myLobby(String(d?.game || ""), me.id); reply(cb, r ? { ok: true, host: true, isPublic: !!r.isPublic } : { ok: true, host: false }); });
    socket.on("pub:set", (d, cb) => { const r = myLobby(String(d?.game || ""), me.id); if (!r) return reply(cb, { ok: false, error: "NOT_HOST" }); const t = Date.now(); if (t - lastSet < 700) return reply(cb, { ok: false, error: "TOO_FAST", isPublic: !!r.isPublic }); lastSet = t; r.isPublic = !!d?.isPublic; cache = null; reply(cb, { ok: true, isPublic: r.isPublic }); });
  });
}
