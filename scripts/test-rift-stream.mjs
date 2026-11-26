// 운명의 균열 스트리머 모드 시험: 스트리머 혼자 + 시청자 다수 · 웹 투표 · 채팅 !1~!4 · 후원(중복 방지) · 추천 카드 따르기 · 끝까지: node scripts/test-rift-stream.mjs
process.env.RIFT_FAST = "0.02";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import DATA from "../src/rift-data.js"; import * as R from "../src/rift-core.js"; import { botAction } from "../src/rift-bot.js";
const { registerRift, _riftTest } = await import("../src/rift.js");
R.setData(DATA);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
let linked = null; registerRift(io, null, app, { linkChat: async (o) => { linked = o; return { ok: true, donationSubscribed: true, nickname: "테스트방송" }; }, unlinkChat: () => {} });
await new Promise((r) => server.listen(0, r)); const BASE = `http://localhost:${server.address().port}`;
const conn = (uid) => new Promise((res) => { const s = ioc(BASE, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rng = (s) => { let a = s >>> 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// 1) 스트리머 방 · 설정 · 혼자 출발
const H = await conn("u_streamer");
const cr = await emit(H, "rift:create", { name: "방송인", stream: true }); ok(cr.ok && cr.room.mode === "stream" && cr.room.stream, "스트리머 방 만들기"); const code = cr.room.code;
ok((await emit(H, "rift:stream", { code, rules: { bless: 1000, curse: 1000 } })).error === "SAME_AMOUNT", "같은 금액 두 효과 거절");
ok((await emit(H, "rift:stream", { code, rules: { bless: 1500 }, follow: true, dur: 10 })).ok, "설정 저장");
const lk = await emit(H, "rift:streamLink", { code, platform: "soop", url: "play.sooplive.com/test/1" }); ok(lk.ok && linked?.key === "dw_rf_" + code && linked.contentMode === "rift", "후원·채팅 연결");
// 2) 시청자 200명
const V = []; for (let i = 0; i < 200; i++) V.push(await conn("guest_v" + i));
let gotState = 0; V[0].on("rift:state", () => gotState++);
const w = await Promise.all(V.map((s, i) => emit(s, "rift:watch", { code, nick: "시청자" + i }))); ok(w.every((x) => x.ok), "시청자 200명 입장");
ok(!(await emit(V[0], "rift:act", { code, a: { t: "end" } })).ok, "시청자는 행동 못 함");
const st = await emit(H, "rift:start", { code }); ok(st.ok, "스트리머 혼자 출발");
const room = _riftTest.ROOMS.get(code); ok(room.run.players.length === 1 && room.run.stream, "1인 방송 판");
await sleep(100); ok(room.st.vote && room.st.vote.kind, "첫 투표 자동으로 열림 (" + room.st.vote?.kind + ")");
// 3) 웹 투표 · 채팅 투표 · 한 사람 한 표
const v0 = room.st.vote;
for (let i = 0; i < 120; i++) await emit(V[i], "rift:vote", { code, i: i % 3 === 0 ? 1 : 0 });
await emit(V[0], "rift:vote", { code, i: 1 }); await emit(V[0], "rift:vote", { code, i: 1 });
ok(v0.counts.reduce((a, b) => a + b, 0) === 120, "한 사람 한 표 (" + v0.counts + ")");
for (let i = 0; i < 30; i++) _riftTest.onPlatformChat(io, room, { content: "!2", senderChannelId: "chat" + i, profile: { nickname: "채팅" + i } });
_riftTest.onPlatformChat(io, room, { content: "!2", senderChannelId: "chat0" }); _riftTest.onPlatformChat(io, room, { content: "안녕 !2", senderChannelId: "chatX" });
ok(v0.counts.reduce((a, b) => a + b, 0) === 150, "채팅 !2 투표 · 중복·다른 말 무시");
ok((await emit(V[5], "rift:vote", { code, i: 9 })).error === "BAD_OPT", "없는 선택지 거절");
// 4) 후원 (고유 ID 중복 방지 · 금액별 효과)
const before = room.st.log.length;
_riftTest.onPlatformDonation(io, room, "soop", { balloons: 15, donatorNickname: "별풍왕", donationId: "D1" });
_riftTest.onPlatformDonation(io, room, "soop", { balloons: 15, donatorNickname: "별풍왕", donationId: "D1" });   // 같은 ID
ok(room.st.log.length === before + 1 && room.st.log[room.st.log.length - 1].kind === "bless", "같은 후원은 한 번만 · 1,500원 = 축복");
_riftTest.onPlatformDonation(io, room, "soop", { balloons: 20, donatorNickname: "닉몬주인", donationId: "D2" });
ok(room.st.log[room.st.log.length - 1].kind === "nick" && (room.run.sx?.nick?.some((n) => n.nick === "닉몬주인") || room.run.cb?.en.some((e) => e.nick === "닉몬주인")), "2,000원 = 닉네임 몬스터");
_riftTest.onPlatformDonation(io, room, "soop", { balloons: 7, donatorNickname: "작은손", donationId: "D3" }); ok(room.st.log[room.st.log.length - 1].status === "no_match", "맞는 금액 없으면 효과 없음");
ok((await emit(H, "rift:streamTest", { code, kind: "boss" })).ok, "시험 후원 (보스 강화)");
ok(!(await emit(V[1], "rift:streamTest", { code, kind: "boss" })).ok, "시청자는 시험 후원 못 함");
// 5) 스트리머 봇이 끝까지 (투표는 계속 열리고 닫힘)
let sstate = null; H.on("rift:state", (m) => (sstate = m.run));
const r = rng(7); let votes = 0, lastVote = null; const T0 = Date.now();
while (!room.run.over && Date.now() - T0 < 150000) {
  const run = room.run; let a = null;
  if (room.st.vote && room.st.vote !== lastVote) { lastVote = room.st.vote; votes++; for (let i = 0; i < 40; i++) emit(V[i], "rift:vote", { code, i: i % room.st.vote.opts.length }); }
  if (run.phase === "map") { const nx = R.nextNodes(run); a = { t: "path", node: nx[Math.floor(r() * nx.length)] }; }
  else if (run.phase === "event") a = run.room.chosen == null ? { t: "event", opt: 0 } : { t: "leave" };
  else if (run.phase === "reward") { await sleep(30); if (room.run.phase !== "reward") continue; a = botAction(run, 0, r); }
  else a = botAction(run, 0, r);
  if (a) await emit(H, "rift:act", { code, a }); else await sleep(20);
}
ok(room.run.over, "방송 판 끝까지 (" + room.run.phase + " " + room.run.floor + "층)");
console.log(`  방송 결과: ${room.run.over?.win ? "클리어" : "패배"} · ${room.run.floor + 1}층 · 투표 ${votes}번 · 시청자 투표 참여 ${room.st.voters} · 후원 기록 ${room.st.log.length}`);
ok(votes >= 4, "투표가 여러 번 열림");
await sleep(400);
ok(gotState > 0 && gotState < 2000, `시청자는 모아 받은 상태 (${gotState}번)`);
ok(sstate && !("log" in sstate), "보내는 상태에 행동 기록 없음");
const sent = JSON.stringify(sstate).length; ok(sent < 60000, `상태 크기 ${sent}바이트`);
console.log(`\n통과 ${pass} · 실패 ${fail}`);
for (const s of [H, ...V]) s.close(); io.close(); server.close(); process.exit(fail ? 1 : 0);
