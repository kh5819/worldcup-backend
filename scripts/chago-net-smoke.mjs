// 차고차고 실제 소켓 통신 시험 (진짜 socket.io 서버 + 클라이언트 N명, 인위적 지연 주입)
//   node scripts/chago-net-smoke.mjs [인원=8] [편도지연ms=0] [초=10]
// socket.io-client v4 가 필요하다. 프로젝트의 socket.io-client 는 v2(채팅 브리지용)라서
//   CHAGO_SIO_CLIENT=<socket.io-client v4 경로> 를 지정하거나 `npm i --no-save socket.io-client@4` 후 실행.
import http from "node:http";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { registerChago, shutdownChago, chagoStats } from "../src/chago.js";

const N = Number(process.argv[2]) || 8;
const ONE_WAY = Number(process.argv[3]) || 0;
const SECONDS = Number(process.argv[4]) || 10;

async function loadClient() {
  const p = process.env.CHAGO_SIO_CLIENT;
  if (p) {
    const req = createRequire(pathToFileURL(p + "/").href);
    return req(p);
  }
  const mod = await import("socket.io-client");
  return mod.default || mod;
}
const sioc = await loadClient();
const ioClient = sioc.io || sioc;

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });
io.use((socket, next) => {
  const g = socket.handshake.auth?.guestId, u = socket.handshake.auth?.uid;
  if (u) socket.user = { id: u, isGuest: false, isAdmin: false };
  else if (g) socket.user = { id: g, isGuest: true, isAdmin: false };
  else return next(new Error("UNAUTHORIZED"));
  next();
});
registerChago(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
await new Promise((r) => httpServer.listen(0, r));
const url = `http://127.0.0.1:${httpServer.address().port}`;

const later = (fn) => (ONE_WAY > 0 ? setTimeout(fn, ONE_WAY) : fn());

function makeClient(i, isHost) {
  const sock = ioClient(url, { transports: ["websocket"], auth: isHost ? { uid: "host-user" } : { guestId: `guest_${i}` } });
  const c = { i, sock, snaps: 0, bytes: 0, last: 0, gaps: [], rtt: [], ackLag: [], sent: 0, seq: 0, you: null, lastAck: 0, sentAt: new Map() };
  const rawOn = sock.on.bind(sock);
  // 수신 지연 주입
  c.on = (ev, h) => rawOn(ev, (...a) => later(() => h(...a)));
  c.emit = (ev, ...a) => later(() => sock.emit(ev, ...a));
  c.call = (ev, payload) => new Promise((res) => later(() => sock.emit(ev, payload, (r) => later(() => res(r)))));
  c.on("chago:snap", (s) => {
    const now = performance.now();
    c.snaps++; c.bytes += JSON.stringify(s).length;
    if (c.last) c.gaps.push(now - c.last);
    c.last = now;
    const me = c.you != null ? s.p.find((q) => q[0] === String(c.you)) : null;
    if (me && me[9] && c.sentAt.has(me[9])) { c.ackLag.push(now - c.sentAt.get(me[9])); c.sentAt.delete(me[9]); }
  });
  c.on("chago:gameStart", (g) => { c.you = g.you; });
  return c;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

const clients = [];
for (let i = 0; i < N; i++) clients.push(makeClient(i, i === 0));
await Promise.all(clients.map((c) => new Promise((r) => c.sock.on("connect", r))));

const teamSize = Math.ceil(N / 2);
const created = await clients[0].call("chago:createRoom", { teamSize, nickname: "H" });
if (!created.ok) throw new Error("createRoom " + JSON.stringify(created));
for (let i = 1; i < N; i++) { const j = await clients[i].call("chago:joinRoom", { inviteCode: created.inviteCode, nickname: "P" + i }); if (!j.ok) throw new Error("join " + JSON.stringify(j)); }
await clients[0].call("chago:startGame");
await wait(300 + ONE_WAY * 2);

// 입력 30Hz: 각자 원을 그리며 달리고 가끔 슛/대시
const timers = clients.map((c) => setInterval(() => {
  c.seq++;
  const t = performance.now() / 1000 + c.i;
  const f = (Math.floor(t * 2) % 5 === 0 ? 1 : 0) | (Math.floor(t) % 3 === 0 ? 4 : 0);
  c.sentAt.set(c.seq, performance.now() + ONE_WAY);        // 서버에 도착하는 시각 기준이 아니라 '보낸 시각'으로 재기 위해 아래에서 보정
  c.sentAt.set(c.seq, performance.now());
  c.emit("chago:input", { s: c.seq, mx: Math.cos(t), my: Math.sin(t), ax: Math.cos(t + 1), ay: Math.sin(t + 1), f });
  c.sent++;
}, 1000 / 30));

// 핑
const pinger = setInterval(() => {
  for (const c of clients) { const t0 = performance.now(); c.emit("chago:ping", t0, () => {}); c.sock.emit("chago:ping", t0, () => c.rtt.push(performance.now() - t0 + ONE_WAY * 2)); }
}, 500);

await wait(SECONDS * 1000);
timers.forEach(clearInterval); clearInterval(pinger);

const rows = clients.map((c) => ({
  c: c.i, 스냅샷: c.snaps, Hz: (c.snaps / SECONDS).toFixed(1),
  KBps: (c.bytes / SECONDS / 1024).toFixed(1),
  간격p50: pct(c.gaps, 0.5).toFixed(0), 간격p95: pct(c.gaps, 0.95).toFixed(0), 간격max: Math.max(...c.gaps).toFixed(0),
  ack왕복p50: pct(c.ackLag, 0.5).toFixed(0), ack왕복p95: pct(c.ackLag, 0.95).toFixed(0),
}));
console.log(`인원 ${N} (${teamSize}v${teamSize}) · 편도 인위지연 ${ONE_WAY}ms · ${SECONDS}초 · 입력 30Hz/명`);
console.table(rows.slice(0, Math.min(4, rows.length)));
const tot = clients.reduce((s, c) => s + c.bytes, 0) / SECONDS / 1024;
console.log(`서버→전체 클라 JSON 합계 ${tot.toFixed(0)} KB/s (방 1개, 압축 전)`);

{ const st = chagoStats(); console.log(`서버 틱 ${st.ticks}회 / 기대 ${Math.round(SECONDS * 30)}회(+시작 대기) · 건너뛴 틱 ${st.dropped} · 최대 지연 ${st.maxLateMs.toFixed(1)}ms`); }
clients.forEach((c) => c.sock.close());
shutdownChago();
io.close();
httpServer.close();
setTimeout(() => process.exit(0), 200);
