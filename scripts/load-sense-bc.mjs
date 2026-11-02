// 게임 센스 스트리머 모드 부하 시험 (한 컴퓨터 안 서버+클라이언트): node scripts/load-sense-bc.mjs 50 100 300
// 시청자 N명이 동시에: 방송 구독 → 검사 6종 시작·제출 → 결과 발급. 통계 묶음 전송 횟수·응답 시간·메모리·정확도 측정
process.env.SENSE_RL = "100000"; process.env.SENSE_BC_IP_MAX = "100000"; process.env.SENSE_DEV_TIME = "1";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import { registerSense } from "../src/sense.js"; import { registerSenseBroadcast, _sbcTest } from "../src/sense-broadcast.js"; import * as C from "../src/sense-core.js";
import { memberProfile } from "../src/iq.js"; import { play } from "./sense-bots.mjs"; import { makeFakeSb } from "./mind-fake-sb.mjs";
const STEPS = process.argv.slice(2).map(Number).filter(Boolean); if (!STEPS.length) STEPS.push(50, 100, 300);
const sb = makeFakeSb({ profiles: [{ id: "u_str", nickname: "스트리머", avatar_url: null }], streamer_chat_log: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_"), isAdmin: false }; n(); });
registerSense(io, sb, app, {}); registerSenseBroadcast(io, sb, app, { memberProfile });
await new Promise((r) => server.listen(0, r)); const URLB = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res, rej) => { const s = ioc(URLB, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.nStats = 0; s.on("sbc:stats", () => s.nStats++); s.on("connect", () => res(s)); s.on("connect_error", rej); });
const emit = (s, ev, p) => new Promise((res) => { const t0 = performance.now(), t = setTimeout(() => res({ ok: false, error: "NOACK", ms: 15000 }), 15000); s.emit(ev, p, (x) => { clearTimeout(t); res({ ...x, ms: performance.now() - t0 }); }); });
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]); };
const POL = ["good", "rnd", "good", "spam", "good", "idle"];
const st = await conn("u_str");
for (const N of STEPS) {
  const c = await emit(st, "sbc:create", { mode: "quick", minutes: 60 }); const id = c.bc.id;
  const mem0 = process.memoryUsage().heapUsed, t0 = performance.now();
  const vs = []; const connR = async (id) => { for (let k = 0; k < 5; k++) { try { return await conn(id); } catch { await new Promise((r) => setTimeout(r, 200 * (k + 1))); } } throw new Error("CONNECT_FAIL " + id); };
  for (let i = 0; i < N; i += 25) vs.push(...(await Promise.all(Array.from({ length: Math.min(25, N - i) }, (_, j) => connR(`guest_load${N}_${i + j}xx`)))));
  await Promise.all(vs.map((s) => emit(s, "sbc:watch", { id })));
  const lat = [], errs = {};
  const one = async (s, i) => {
    const pol = POL[i % POL.length]; const b = await emit(s, "sense:begin", { mode: "quick", device: i % 2 ? "mobile" : "pc", bc: id, bcNick: "시청자" + i }); lat.push(b.ms); if (!b.ok) return (errs[b.error] = (errs[b.error] || 0) + 1);
    for (let k = 0; k < b.plan.length; k++) { const a = await emit(s, "sense:testStart", { sid: b.sid, idx: k }); lat.push(a.ms); const r = await emit(s, "sense:submit", { sid: b.sid, idx: k, log: play(b.plan[k].id, C.genSpec(b.plan[k].id, b.plan[k].seed), pol, C.rng(i + k)) }); lat.push(r.ms); if (!r.ok) errs[r.error] = (errs[r.error] || 0) + 1; }
    const f = await emit(s, "sense:finish", { sid: b.sid, profile: { nick: "시청자" + i, age: 20, avatar: {} }, prefs: {}, isPublic: true }); lat.push(f.ms); if (!f.ok || !f.bc?.counted) errs[f.error || f.bc?.reason || "?"] = (errs[f.error || f.bc?.reason || "?"] || 0) + 1;
  };
  await Promise.all(vs.map(one));
  const wall = performance.now() - t0; await new Promise((r) => setTimeout(r, 2600));
  const stats = (await (await fetch(`${URLB}/sense/bc/${id}`)).json()).stats;
  const avgStats = vs.reduce((a, s) => a + s.nStats, 0) / N;
  const tc = performance.now(); _sbcTest.computeStats(_sbcTest.BC.get(id)); const statMs = performance.now() - tc;
  console.log(`시청자 ${String(N).padStart(3)}명 | 전부 끝난 시간 ${(wall / 1000).toFixed(1)}s | 응답 중앙 ${pct(lat, 0.5)}ms · 95% ${pct(lat, 0.95)}ms · 최대 ${pct(lat, 1)}ms | 집계 ${stats.count}/${N} | 1인당 받은 통계 ${avgStats.toFixed(1)}번(2초 묶음) | 통계 계산 ${statMs.toFixed(1)}ms | 메모리 +${((process.memoryUsage().heapUsed - mem0) / 1048576).toFixed(1)}MB | 오류 ${JSON.stringify(errs)}`);
  vs.forEach((s) => s.close());
}
st.close(); server.close(); process.exit(0);
