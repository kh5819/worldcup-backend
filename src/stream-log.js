// =========================
// 게임 스트리머 모드 사용 기록 → admin 「📺 스트리머」 (2026-11-22)
// · 사용자: "스트리머 모드 했는데 admin에 안 떠" — 예전엔 방송 채팅을 실제로 연결해야만 기록됐음
//   → 방장이 스트리머 모드를 켜는 순간 한 번 기록 (platform "game", content_mode = 게임 이름, channel_id = "room:게임:코드")
//   채팅까지 연결하면 그때 치지직·씨미·SOOP 줄이 따로 하나 더 남음 (원래대로)
// · 방마다 한 번만 · 같은 방장·같은 게임은 30분에 한 번만 (껐다 켰다 반복해도 줄이 쌓이지 않게)
// · index.js가 setStreamLogger(_logStreamerChat)로 연결. 연결 전이거나 DB가 느려도 게임엔 영향 없음
// =========================
let LOG = null;
const recent = new Map(); // "게임|방장" → 시각
export function setStreamLogger(fn) { LOG = typeof fn === "function" ? fn : null; }
/** game: contentMode 이름(STREAMER_LOG_MODES 키) · room: 방 객체(inviteCode·hostUserId·players) */
export function logGameStreamer(game, room) {
  try {
    if (!LOG || !room || room._streamLogged) return;
    const host = room.hostUserId, code = room.inviteCode || room.code || room.id; if (!host || !code) return;
    const k = game + "|" + host, t = Date.now(), last = recent.get(k) || 0;
    room._streamLogged = true; if (t - last < 30 * 60_000) return; recent.set(k, t); if (recent.size > 5000) recent.clear();
    const seat = room.players?.get?.(host), name = seat?.name ? String(seat.name).slice(0, 20) : null;
    Promise.resolve(LOG({ platform: "game", channelId: `room:${game}:${code}`, nickname: name, roomCode: String(code), hostUserId: host, hostNick: name, contentMode: game })).catch(() => {});
  } catch (e) { console.warn("[stream-log]", e?.message); }
}
