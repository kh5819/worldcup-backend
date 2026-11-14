// 인생 방송국 — 방장 자격 유지 시험: 로그인 상태가 바뀌거나 다시 연결돼 계정이 달라져도 방장 유지 (자격표 hostTok)
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast, _lbcTest } from "../src/lifebc-broadcast.js";
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerLifeBroadcast(io, null, null);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL0, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

const G = await conn("guest_streamer");
const c = await emit(G, "lbc:create", { nick: "방장", title: "t", don: true });
ok(c.ok && typeof c.hostTok === "string" && c.hostTok.length === 24, "방송 만들면 방장 자격표 받음");
const V = await conn("guest_viewer"); await emit(V, "lbc:join", { id: c.id, nick: "시청자" });
const vw = await emit(V, "lbc:watch", { id: c.id }); ok(!JSON.stringify(vw).includes(c.hostTok), "시청자에게 자격표 안 감");
ok((await emit(G, "lbc:viewers", { id: c.id })).ok, "처음엔 시청자 관리 됨");
// 같은 사람이 중간에 로그인 → 다른 계정으로 다시 연결
G.close(); const U = await conn("11111111-2222-3333-4444-555555555555");
ok((await emit(U, "lbc:viewers", { id: c.id })).error === "NOT_HOST", "(고치기 전 증상) 계정이 바뀌면 NOT_HOST");
const w1 = await emit(U, "lbc:watch", { id: c.id, hostTok: "x".repeat(24) }); ok(w1.ok && !w1.host, "틀린 자격표로는 방장 안 됨");
const w2 = await emit(U, "lbc:watch", { id: c.id, hostTok: c.hostTok }); ok(w2.ok && w2.host && w2.donKey === c.donKey, "맞는 자격표 → 새 계정이 방장 (후원 키도 다시 받음)");
const vr = await emit(U, "lbc:viewers", { id: c.id }); ok(vr.ok && vr.rows.length === 1 && vr.rows[0].nick === "시청자", "시청자 관리 다시 됨 (시청자 목록 그대로)");
const st = await emit(V, "lbc:watch", { id: c.id }); ok(st.state.viewers === 1, "시청자 수 그대로 (방장이 시청자로 잘못 세지지 않음)");
// 시청자가 방장 자격표 없이 빼앗기 시도
ok(!(await emit(V, "lbc:watch", { id: c.id, hostTok: "" })).host, "시청자는 방장 못 뺏음");
ok((await emit(V, "lbc:viewers", { id: c.id })).error === "NOT_HOST", "시청자는 시청자 관리 못 함");
// 카드 요청이 새 방장에게 가는지
const reqs = []; U.on("lbc:cardReq", (r) => reqs.push(r));
const card = await emit(V, "lbc:card", { id: c.id, card: "cheer", a: "c1" }); await wait(100);
ok(card.ok && reqs.length === 1, "시청자 카드 요청이 새 계정 방장에게 도착");
// 끝난 방송은 자격표로도 못 살림
await emit(U, "lbc:end", { id: c.id }); const G2 = await conn("guest_streamer");
ok(!(await emit(G2, "lbc:watch", { id: c.id, hostTok: c.hostTok })).host, "끝난 방송은 다시 방장 안 됨");
// 오래 켜 둔 방송: 만든 지 8시간 넘어도 방장이 계속 움직이면 안 지워짐 (정리 기준 = 마지막 활동)
const c2 = await emit(G2, "lbc:create", { nick: "긴방송", title: "t" }); const b2 = _lbcTest.BC.get(c2.id);
b2.createdAt -= 9 * 3600e3; await emit(G2, "lbc:status", { id: c2.id, status: { day: 1 } });
ok(Date.now() - b2.lastAt < 5000, "방장이 움직이면 마지막 활동 시각 갱신");
console.log(`host reclaim: ${pass} pass, ${fail} fail`);
U.close(); V.close(); G2.close(); io.close(); server.close(); process.exit(fail ? 1 : 0);
