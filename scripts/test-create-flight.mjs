// 방 중복 생성 시험 — 같은 사람이 '방 만들기'를 동시에 여러 번 보내도 방은 하나 (사과·블록블래스트)
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { createFlight } from "../src/create-flight.js";
import { registerAppleMulti } from "../src/apple-multi.js";
import { registerBlockBlastMulti } from "../src/blockblast-multi.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 도우미 단독
{ const got = []; const f1 = createFlight("t", "u1", (r) => got.push(["a", r])); const f2 = createFlight("t", "u1", (r) => got.push(["b", r]));
  ok(typeof f1 === "function" && f2 === null, "진행 중이면 두 번째는 기다림"); f1({ ok: true, roomId: "R1" });
  ok(got.length === 2 && got.every(([, r]) => r.roomId === "R1"), "두 요청 모두 같은 방을 받음");
  const f3 = createFlight("t", "u1", () => {}); ok(typeof f3 === "function", "끝난 뒤엔 새로 만들 수 있음"); f3({ ok: true });
  const f4 = createFlight("t", "u2", () => {}); ok(typeof f4 === "function", "다른 사람은 따로"); f4({}); }

// 2) 실제 게임 모듈: 프로필 조회가 느릴 때(경쟁 상황) 동시에 3번 생성
const slowDb = { from: () => { const q = { select: () => q, eq: () => q, single: async () => { await wait(150); return { data: { nickname: "테스터", avatar_url: null } }; }, maybeSingle: async () => { await wait(150); return { data: null }; }, insert: async () => ({}), update: () => q, upsert: async () => ({}) }; return q; } };
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerAppleMulti(io, slowDb); registerBlockBlastMulti(io, slowDb);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL0, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
for (const game of ["apple", "blockblast"]) {
  const s = await conn("11111111-0000-0000-0000-00000000000" + (game === "apple" ? 1 : 2));
  const rs = await Promise.all([emit(s, `${game}:createRoom`, {}), emit(s, `${game}:createRoom`, {}), emit(s, `${game}:createRoom`, {})]);
  const ids = new Set(rs.map((r) => r.roomId));
  ok(rs.every((r) => r.ok) && ids.size === 1, `${game}: 동시에 3번 → 방 1개 (${[...ids].join(",")})`);
  // 다시 만들기(순서대로) → 이전 방은 정리되고 새 방 1개
  const r2 = await emit(s, `${game}:createRoom`, {}); ok(r2.ok && r2.roomId !== rs[0].roomId, `${game}: 다시 만들면 새 방`);
  s.disconnect();
}
console.log(`통과 ${pass} · 실패 ${fail}`); server.close(); setTimeout(() => process.exit(fail ? 1 : 0), 200);
