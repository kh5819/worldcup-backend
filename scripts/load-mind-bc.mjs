// 스트리머 모드 부하 시험 (로컬 전용, 가짜 DB): node scripts/load-mind-bc.mjs 100 500 1000
// 같은 PC에서 서버와 가상 시청자를 함께 돌림 → 실서버(Render)·실제 네트워크 수치가 아님
process.env.MIND_BC_IP_MAX = "1000000"; process.env.MIND_RL = "100000";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import { registerMindBroadcast } from "../src/mind-broadcast.js"; import { memberProfile } from "../src/iq.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
const sizes = process.argv.slice(2).map(Number); if (!sizes.length) sizes.push(100, 500, 1000);
const sb = makeFakeSb({}); const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { s.user = { id: String(s.handshake.query.uid), isGuest: true }; n(); }); registerMindBroadcast(io, sb, app, { memberProfile });
await new Promise((r) => server.listen(0, r)); const U = `http://localhost:${server.address().port}`;
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "TIMEOUT" }), 30000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const conn = (id) => new Promise((res, rej) => { const s = ioc(U, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); s.on("connect_error", rej); });
const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
for (const n of sizes) {
  const owner = await conn(`guest_own${n}${Date.now()}`), c = await emit(owner, "mbc:create", { title: `load${n}`, streamerNick: "s", mode: "quick" }), id = c.bc.id;
  const t0 = Date.now(), vs = []; let connFail = 0;
  for (let i = 0; i < n; i += 25) { const chunk = await Promise.allSettled(Array.from({ length: Math.min(25, n - i) }, (_, k) => conn(`guest_v${n}_${i + k}`))); for (const x of chunk) x.status === "fulfilled" ? vs.push(x.value) : connFail++; }
  const tConn = Date.now() - t0; await Promise.all(vs.map((s) => emit(s, "mbc:watch", { id })));
  let msgs = 0, sealedLeak = 0; for (const s of vs) { s.on("mbc:stats", (d) => { msgs++; if (d.round?.phase !== "revealed" && /"cnt"/.test(JSON.stringify(d.round || {}))) sealedLeak++; }); s.on("mbc:count", () => msgs++); }
  const lat = [], cpu0 = process.cpuUsage(), mem0 = process.memoryUsage().rss; await emit(owner, "mbc:control", { id, action: "open", kind: "know", qi: 0 }); await emit(owner, "mbc:control", { id, action: "lock", pick: 0, pct: 50 });
  const tv = Date.now(); let fails = 0; const spread = Math.max(1000, n * 5);
  await Promise.all(vs.map(async (s, i) => { await new Promise((r) => setTimeout(r, Math.random() * spread)); const a = Date.now(), x = await emit(s, "mbc:vote", { id, n: 1, c: i % 2, g: i % 3 === 0 ? 0 : 1, nick: `v${i}` }); lat.push(Date.now() - a); if (!x.ok) fails++; }));
  const dup = await emit(vs[0], "mbc:vote", { id, n: 1, c: 1, g: 1 });
  await emit(owner, "mbc:control", { id, action: "closeVotes" }); const rv = Date.now(), R = await emit(owner, "mbc:control", { id, action: "reveal" }), tR = Date.now() - rv; await new Promise((r) => setTimeout(r, 1500));
  const cpu = process.cpuUsage(cpu0), res = R.stats.round.result, ok = res.votes === vs.length - 0 && res.cnt.reduce((x, y) => x + y, 0) === vs.length;
  console.log(`[${n}명] 접속 ${vs.length}성공/${connFail}실패 ${tConn}ms | 표 ${vs.length - fails}개 ${Date.now() - tv}ms 실패 ${fails} | 응답 지연 평균 ${Math.round(lat.reduce((a, b) => a + b, 0) / (lat.length || 1))}ms p95 ${pct(lat, 0.95)}ms 최대 ${Math.max(...lat, 0)}ms | 공개 계산 ${tR}ms | 전송 ${msgs}건 | CPU ${Math.round((cpu.user + cpu.system) / 1000)}ms | 메모리 ${Math.round(process.memoryUsage().rss / 1e6)}MB(+${Math.round((process.memoryUsage().rss - mem0) / 1e6)}) | 집계 ${ok ? "정확" : "불일치"} | 중복 표 ${dup.dup ? "무시" : "오류"} | 봉인 누출 ${sealedLeak}`);
  for (const s of [...vs, owner]) s.close(); await new Promise((r) => setTimeout(r, 800));
}
process.exit(0);
