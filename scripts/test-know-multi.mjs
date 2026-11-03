// 상식 진단소 8인 대결 서버 시험 (가짜 Supabase + 실제 Socket.IO, KNOW_FAST=1)
process.env.KNOW_FAST = "1"; process.env.KNOW_RL = "100000";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerKnow, STORE } from "../src/know.js";
import { registerKnowMulti, _knmTest } from "../src/know-multi.js";

DB.know_results = []; DB.know_questions = []; DB.know_reports = [];
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerKnow(io, sb, app, {}); registerKnowMulti(io, sb);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = (nick) => ({ nick, age: 20, avatar: { skin: 0, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });
const LEAK = /"(exp|src|ans|years|truth|value)":/;

// 8명 입장
const ids = ["guest_host0001", "u_p1", "guest_p2aaaa", "u_p3", "guest_p4aaaa", "u_p5", "guest_p6aaaa", "u_p7"];
const S = await Promise.all(ids.map(conn));
const last = new Map(); let leaked = false, itemSeen = new Map();
S.forEach((s, k) => s.on("knm:room", (r) => {
  last.set(k, r);
  if (r.phase !== "result" && r.phase !== "final" && LEAK.test(JSON.stringify(r))) leaked = true;
  if (r.phase === "play" && r.item) { const prev = itemSeen.get(r.round); const sig = JSON.stringify(r.item); if (!prev) itemSeen.set(r.round, sig); else if (prev !== sig) leaked = "다른 문제"; }
}));
const c = await emit(S[0], "knm:create", { mode: "m10", profile: prof("방장"), maxPlayers: 8 });
ok(c.ok && /^\d{6}$/.test(c.room.code), "게스트도 방 만들기 + 6자리 코드");
const code = c.room.code;
ok((await emit(S[1], "knm:join", { code: "000000" })).error === "NO_ROOM", "없는 코드");
for (let k = 1; k < 8; k++) { const j = await emit(S[k], "knm:join", { code, profile: prof(`참가${k}`) }); ok(j.ok, `${k} 입장`); }
const extra = await conn("guest_extra99");
ok((await emit(extra, "knm:join", { code, profile: prof("9번") })).error === "ROOM_FULL", "9번째는 가득");
ok((await emit(S[1], "knm:start", {})).error === "NOT_HOST", "방장만 시작");
ok((await emit(S[0], "knm:start", {})).error === "NOT_READY", "준비 안 되면 시작 불가");
for (let k = 1; k < 8; k++) await emit(S[k], "knm:ready", { ready: true });
ok((await emit(S[0], "knm:start", {})).ok, "시작");
const R = _knmTest.ROOMS.get(c.room.id);
ok(R.plan.length === 10, "10라운드");

// 라운드 진행: 서버 정답 키로 일부는 정답, 일부는 오답, 1명은 무응답, 3번째 라운드에 1명 끊겼다 재접속
let rejoinOk = null;
for (let i = 0; i < R.plan.length; i++) {
  for (let t = 0; t < 400 && !(R.phase === "play" && R.round === i); t++) await wait(5);
  ok(R.phase === "play" && R.round === i, `라운드 ${i + 1} 시작`);
  const key = R.served.key, kind = R.served.pub.kind;
  const right = kind === "num" ? key.v : key, wrong = kind === "ox" ? !key : kind === "num" ? key.v * 50 + 999 : Array.isArray(key) ? [...key].reverse() : (key + 1) % 3;
  ok((await emit(S[1], "knm:answer", { round: i + 1, answer: right })).error === "NOT_PLAYING", "다른 라운드 답 막기");
  if (i === 2) { S[5].disconnect(); await wait(20); S[5] = await conn("u_p5"); S[5].on("knm:room", (r) => last.set(5, r)); const rj = await emit(S[5], "knm:rejoin", {}); rejoinOk = rj.ok && rj.room.phase === "play" && rj.mine && rj.mine.submitted === false; }
  for (let k = 0; k < 7; k++) {
    const a = await emit(S[k], "knm:answer", { round: i, answer: k < 4 ? right : wrong });
    ok(a.ok && a.submitted && !("part" in a) && !LEAK.test(JSON.stringify(a)), `제출 응답에 정오답 없음 r${i} p${k}`);
  }
  ok((await emit(S[0], "knm:answer", { round: i, answer: wrong })).dup, "중복 제출 무시");
  // 7번은 무응답 → 마감 시각에 끝남
  for (let t = 0; t < 2000 && R.phase === "play"; t++) await wait(5);
  ok(R.phase === "result", `라운드 ${i + 1} 결과`);
  const lr = R.lastRound;
  ok(lr.rows.length === 8 && lr.reveal?.exp, "결과에 정답·해설");
  const row = (k) => lr.rows.find((x) => x.id === ids[k]);
  ok(row(0).part >= 1 && row(0).bp > 0, "정답자 대결 점수");
  ok(row(6).part < 1 || kind === "num", "오답자");
  ok(row(7).timeout && row(7).bp === 0, "무응답 0점");
}
ok(rejoinOk, "진행 중 재접속 복구 (제출 전 상태)");
ok(!leaked, `진행 중 정답 노출 없음 / 모두 같은 문제 (${leaked})`);
for (let t = 0; t < 1000 && R.phase !== "final"; t++) await wait(10);
ok(R.phase === "final" && R.final.players.length === 8, "최종 시상");
ok(R.final.players[0].rank === 1 && R.final.players.every((p, k, a) => !k || a[k - 1].rank <= p.rank), "순위 정렬");
await wait(100);
ok(DB.know_results.filter((x) => x.mode === "multi").length === 8 && DB.know_results.every((x) => x.flagged && x.group_id === R.final.groupId), "8명 개인 진단서 저장 (솔로 랭킹 제외)");
const mine = await emit(S[3], "knm:mine", {}); ok(mine.ok && mine.result.diag.multi.of === 8 && !JSON.stringify(mine).includes("owner_key"), "개인 진단서 본인에게만");
ok((await emit(S[1], "knm:rematch", {})).error === "NOT_HOST", "재대결은 방장만");
ok((await emit(S[0], "knm:rematch", { mode: "m15" })).ok && R.phase === "lobby" && R.mode === "m15" && [...R.players.values()].every((p) => p.pts === 0 && !p.ready), "재대결 초기화");
// 혼자 시작 막기
const solo = await conn("guest_solo1234"); const sc = await emit(solo, "knm:create", { profile: prof("혼자") });
ok((await emit(solo, "knm:start", {})).error === "NEED_TWO", "2명부터 시작");
// 공개방 목록
await emit(S[0], "knm:options", { isPublic: true }); await emit(solo, "knm:options", { isPublic: true }); const ls = await emit(extra, "knm:list", {}); ok(ls.rooms.some((x) => x.code === sc.room.code) && !ls.rooms.some((x) => x.code === code), "공개방 목록 (빈자리 있는 방만)");
ok((await emit(S[2], "knm:options", { isPublic: false })).error === "NOT_HOST", "옵션은 방장만");
// 문제가 부족하면 시작 불가 안내
const keep = STORE.pool; STORE.pool = keep.slice(0, 5);
for (let k = 1; k < 8; k++) await emit(S[k], "knm:ready", { ready: true });
const ne = await emit(S[0], "knm:start", {}); ok(ne.error === "NOT_ENOUGH_ITEMS", `문제 부족 안내 ${ne.error}`); STORE.pool = keep;
[...S, extra, solo].forEach((s) => s.close());
console.log(`\n상식 8인 대결 시험: 통과 ${pass} · 실패 ${fail}`);
server.close(); process.exit(fail ? 1 : 0);
