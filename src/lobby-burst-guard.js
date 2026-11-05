// =========================
// 대기실 연타 막기 (모든 멀티 게임 공통)
// 준비·설정·내보내기처럼 한 번 누를 때마다 방 전원에게 전송되는 요청만, 같은 요청을 1초에 8번까지 받음.
// 사람이 빠르게 눌러도 걸리지 않고, 자동 클릭·매크로만 막힘. 경기 조작(착수·이동 등)은 대상이 아님.
// =========================
const LOBBY_EVENT = /^[a-zA-Z]+:(set[A-Z]\w*|ready|options|kick\w*|autoTeams|addBot)$/;
const MAX_PER_SEC = 8;

export function installLobbyBurstGuard(io) {
  io.on("connection", (socket) => {
    const seen = new Map();
    socket.use((packet, next) => {
      const ev = packet[0];
      if (typeof ev !== "string" || !LOBBY_EVENT.test(ev)) return next();
      const now = Date.now(), s = seen.get(ev);
      if (!s || now - s.at >= 1000) { seen.set(ev, { at: now, n: 1 }); return next(); }
      if (++s.n <= MAX_PER_SEC) return next();
      const ack = packet[packet.length - 1];
      if (typeof ack === "function") ack({ ok: false, error: "TOO_FAST" }); // 응답을 기다리는 화면이 멈추지 않게
    });
  });
}
