// 상식 스트리머 퀴즈쇼 서버 시험 + 부하 (가짜 Supabase + 실제 Socket.IO)
// node scripts/test-know-bc.mjs [시청자 수=300]
process.env.KNOW_RL = "100000";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerKnow } from "../src/know.js";
import { registerKnowBroadcast, _kbcTest } from "../src/know-broadcast.js";

DB.know_results = []; DB.know_questions = []; DB.know_broadcasts = []; DB.streamer_chat_log = [];
const N = Number(process.argv[2] || 300);
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerKnow(io, sb, app, {}); registerKnowBroadcast(io, sb, app);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LEAK = /"(exp|src|ans|years|truth|value|key)":/;

const host = await conn("guest_streamer01");
ok((await emit(host, "kbc:create", { title: "x" })).error === "NEED_NICK", "게스트는 닉네임 필수");
const c = await emit(host, "kbc:create", { nick: "상식스트리머", title: "오늘의 퀴즈쇼", rounds: 5 });
ok(c.ok && c.id && c.state.n === 5, "방송 만들기");
ok((await emit(host, "kbc:create", { nick: "또" })).error === "TOO_MANY_OPEN", "게스트 동시 1개");
await wait(50);
ok(DB.streamer_chat_log.some((x) => x.platform === "know" && x.channel_id === c.id && x.nickname === "상식스트리머"), "admin 스트리머 기록 platform=know");
ok(DB.know_broadcasts.some((x) => x.id === c.id), "방송 DB 저장");
const id = c.id, B = _kbcTest.BC.get(id);

// 시청자 N명 접속·참여
const vs = []; for (let k = 0; k < N; k += 50) { const batch = await Promise.all(Array.from({ length: Math.min(50, N - k) }, (_, j) => conn(`guest_v${String(k + j).padStart(5, "0")}`))); vs.push(...batch); }
let leak = false, states = 0; vs[0].on("kbc:state", (s) => { states++; if ((s.phase === "open" || s.phase === "closed") && LEAK.test(JSON.stringify(s))) leak = true; });
const t0 = Date.now(); await Promise.all(vs.map((v, k) => emit(v, "kbc:join", { id, nick: `시청자${k}` }))); const joinMs = Date.now() - t0;
ok(B.viewers.size === N + 1, `시청자 ${N}명 참여 (${joinMs}ms)`);
const outsider = await conn("guest_outsider1");
ok((await emit(outsider, "kbc:next", { id })).error === "NOT_HOST", "시청자는 진행 못 함");
ok((await emit(outsider, "kbc:answer", { id, round: 0, answer: 0 })).error === "BC_CLOSED", "문제 열기 전 답 막기");

for (let i = 0; i < 5; i++) {
  ok((await emit(host, "kbc:next", { id })).ok, `문제 ${i + 1} 열기`);
  ok((await emit(host, "kbc:next", { id })).error === "IN_ROUND", "진행 중엔 다음 못 감");
  const key = B.cur.sv.key, kind = B.cur.sv.pub.kind;
  const right = kind === "num" ? key.v : key, wrong = kind === "ox" ? !key : kind === "num" ? key.v * 100 + 999 : (key + 1) % (B.cur.sv.pub.opts || B.cur.sv.pub.codes || B.cur.sv.pub.stmts).length;
  ok((await emit(outsider, "kbc:answer", { id, round: i, answer: right })).error === "NOT_JOINED", "참여 안 한 사람 답 막기");
  const t1 = Date.now();
  await Promise.all(vs.map((v, k) => emit(v, "kbc:answer", { id, round: i, answer: k % 3 === 0 ? wrong : right })));
  const ansMs = Date.now() - t1;
  ok((await emit(vs[1], "kbc:answer", { id, round: i, answer: wrong })).dup, "중복 답 무시");
  await emit(host, "kbc:answer", { id, round: i, answer: i % 2 ? wrong : right });
  await wait(600);
  ok(B.cur.count === N + 1, `문제 ${i + 1} 제출 ${B.cur.count} (${ansMs}ms)`);
  ok((await emit(host, "kbc:reveal", { id })).ok, "정답 공개");
  ok((await emit(vs[2], "kbc:answer", { id, round: i, answer: right })).error === "BC_CLOSED", "마감 후 답 막기");
  const L = B.lastPub, exp = Math.round((100 * Math.floor((N * 2) / 3 + (N % 3 === 2 ? 1 : 0))) / N);
  ok(L.reveal?.exp && L.total === N, "공개: 정답·해설·인원");
  if (kind !== "num") ok(Math.abs(L.acc - 67) <= 2, `시청자 정답률 ${L.acc}%`);
  ok(L.streamer.part === (i % 2 ? (kind === "num" ? L.streamer.part : 0) : 1) || kind === "num", "스트리머 정답 여부");
  ok(B.board.top.length === Math.min(10, N), "TOP10");
}
ok((await emit(host, "kbc:next", { id })).error === "NO_MORE", "마지막 다음");
ok(!leak, "진행 중 상태에 정답 없음");
ok(states < 5 * 12 + 40, `상태 전송 묶음 (${states}회, 답 ${N * 5}개)`);
const me = await emit(vs[0], "kbc:me", { id }); ok(me.ok && me.rank >= 1 && me.of === N, `내 순위 ${JSON.stringify(me)}`);
await emit(host, "kbc:hideNicks", { id, on: true }); ok(B.board.top[0].nick.startsWith("시청자 "), "닉네임 숨기기");
ok((await emit(host, "kbc:finish", { id })).ok && B.final?.streamer && B.final.verdict, "최종 결과 + 스트리머 vs 시청자");
await wait(100);
ok(DB.know_broadcasts.find((x) => x.id === id)?.status === "final", "최종 요약 저장");
const pub = await fetch(`${URL}/know/bc/${id}`).then((r) => r.json()); ok(pub.ok && pub.final?.players === N, "방송 결과 링크");
ok((await emit(vs[3], "kbc:join", { id })).error === "BC_CLOSED", "끝난 방송 참여 막기");
// 창을 닫았다 다시 와도: 내 퀴즈쇼 목록 · 진행 중이면 만들기 막히며 목록을 돌려줌 · 15문제 퀴즈쇼
{
  const h2 = await conn("guest_streamer02");
  const c1 = await emit(h2, "kbc:create", { nick: "두번째", rounds: 15 });
  ok(c1.ok && c1.state.n === 15, `15문제 퀴즈쇼 만들기 (${c1.error || c1.state?.n})`);
  h2.close(); const h3 = await conn("guest_streamer02");   // 같은 사람이 창을 닫고 다시 접속
  const mine = await emit(h3, "kbc:mine", {}); ok(mine.ok && mine.rows.length === 1 && mine.rows[0].id === c1.id && mine.rows[0].n === 15, "다시 접속해도 내 퀴즈쇼 목록");
  const again = await emit(h3, "kbc:create", { nick: "두번째", rounds: 5 }); ok(again.error === "TOO_MANY_OPEN" && again.open?.[0]?.id === c1.id, "진행 중이면 막히고 이어갈 퀴즈쇼를 알려 줌");
  const w = await emit(h3, "kbc:watch", { id: c1.id }); ok(w.ok && w.host === true, "다시 접속해도 진행자");
  ok((await emit(h3, "kbc:next", { id: c1.id })).ok, "다시 접속한 진행자가 문제 열기");
  ok((await emit(h3, "kbc:finish", { id: c1.id })).ok && (await emit(h3, "kbc:mine", {})).rows.length === 0, "끝내면 목록에서 빠짐");
  ok((await emit(h3, "kbc:create", { nick: "두번째", rounds: 15 })).ok, "끝낸 뒤 새로 만들기");
  h3.close();
}
const mem = process.memoryUsage().heapUsed / 1048576;
console.log(`  힙 ${mem.toFixed(0)}MB · 시청자 ${N}`);
[host, outsider, ...vs].forEach((s) => s.close());
console.log(`\n상식 스트리머 퀴즈쇼 시험: 통과 ${pass} · 실패 ${fail}`);
server.close(); process.exit(fail ? 1 : 0);
