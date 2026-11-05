// 인생 방송국 스트리머 모드 — 방장 시청자 관리(강퇴·닉네임 변경) 시험
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast } from "../src/lifebc-broadcast.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const g = s.handshake.query.gid; s.user = { id: g, isGuest: true }; next(); });
registerLifeBroadcast(io, null, null);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (gid) => new Promise((res) => { const s = ioc(URL0, { query: { gid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

const H = await conn("host1"), A = await conn("va"), B = await conn("vb");
const c = await emit(H, "lbc:create", { nick: "방장", title: "t" }); const id = c.id; ok(c.ok, "방송 생성");
ok((await emit(A, "lbc:join", { id, nick: "나쁜닉" })).ok && (await emit(B, "lbc:join", { id, nick: "착한닉" })).ok, "시청자 2명 참여");
// A 출연 신청 → 수락
ok((await emit(A, "lbc:apply", { id, nick: "나쁜닉", look: {}, preset: "joker", goal: "star" })).ok, "A 출연 신청");
const apps = await emit(H, "lbc:apps", { id }); const acc = await emit(H, "lbc:accept", { id, appId: apps.rows[0].id }); ok(acc.ok, "A 출연 확정");
// B 투표
const poll = await emit(H, "lbc:poll", { id, q: "질문", opts: [{ id: "x", label: "X" }, { id: "y", label: "Y" }], sec: 30 });
ok((await emit(A, "lbc:vote", { id, pollId: poll.pollId, opt: "x" })).ok, "A 투표");
// 목록
const vl = await emit(H, "lbc:viewers", { id }); ok(vl.ok && vl.rows.length === 2, "방장 목록 2명");
const va = vl.rows.find((r) => r.nick === "나쁜닉"), vb = vl.rows.find((r) => r.nick === "착한닉");
ok(va.cast && va.appId === acc.app.id && !vb.cast, "출연 여부·신청서 연결 표시");
ok(!vl.rows.some((r) => "key" in r), "목록에 내부 키 노출 안 됨");
// 권한: 시청자는 못 함
ok((await emit(B, "lbc:viewers", { id })).error === "NOT_HOST", "시청자는 목록 못 봄");
ok((await emit(B, "lbc:kick", { id, vid: va.vid })).error === "NOT_HOST", "시청자는 강퇴 못 함");
ok((await emit(B, "lbc:rename", { id, vid: va.vid, nick: "x" })).error === "NOT_HOST", "시청자는 이름 변경 못 함");
// 닉네임 변경
let renamedMsg = null; A.on("lbc:renamed", (m) => (renamedMsg = m));
ok((await emit(H, "lbc:rename", { id, vid: va.vid, nick: "" })).error === "NEED_NICK", "빈 닉네임 거절");
const rn = await emit(H, "lbc:rename", { id, vid: va.vid, nick: "고친닉" }); ok(rn.ok && rn.old === "나쁜닉" && rn.appId === acc.app.id, "이름 변경 + 캐릭터 연결 정보");
await wait(150); ok(renamedMsg?.nick === "고친닉", "본인 폰에 이름 변경 알림");
ok((await emit(A, "lbc:me", { id })).nick === "고친닉", "본인 정보에도 반영");
// 강퇴
let kickedMsg = null, stateAfter = 0; A.on("lbc:kicked", (m) => (kickedMsg = m));
await wait(100); A.on("lbc:state", () => stateAfter++);
const kk = await emit(H, "lbc:kick", { id, vid: va.vid }); ok(kk.ok && kk.nick === "고친닉" && kk.appId === acc.app.id, "강퇴 성공 + 출연 캐릭터 정보");
await wait(200); ok(kickedMsg?.id === id, "본인 폰에 강퇴 알림");
const st = await emit(B, "lbc:watch", { id }); ok(st.state.poll.total === 0, "강퇴된 사람 표는 빠짐");
stateAfter = 0; await emit(H, "lbc:intensity", { id, level: "high" }); await wait(200); ok(stateAfter === 0, "강퇴 후엔 방송 소식 안 받음");
ok((await emit(A, "lbc:join", { id, nick: "다시" })).error === "KICKED", "다시 참여 불가");
ok((await emit(A, "lbc:watch", { id })).error === "KICKED", "다시 보기도 불가");
ok((await emit(A, "lbc:vote", { id, pollId: poll.pollId, opt: "y" })).error === "NOT_JOINED", "강퇴 후 투표 불가");
const A2 = await conn("va"); ok((await emit(A2, "lbc:join", { id, nick: "새창" })).error === "KICKED", "새 창으로 들어와도 불가");
ok((await emit(H, "lbc:kick", { id, vid: va.vid })).error === "VIEWER_NOT_FOUND", "두 번 강퇴는 없음");
ok((await emit(H, "lbc:kick", { id, vid: "v0" })).error === "VIEWER_NOT_FOUND", "방장 자신은 강퇴 대상 아님");
const vl2 = await emit(H, "lbc:viewers", { id }); ok(vl2.rows.length === 1 && vl2.kicked === 1, "목록 1명 · 강퇴 1명");
ok((await emit(B, "lbc:vote", { id, pollId: poll.pollId, opt: "y" })).ok, "남은 시청자는 그대로 투표");
console.log(`통과 ${pass} · 실패 ${fail}`); for (const s of [H, A, B, A2]) s.disconnect(); server.close(); setTimeout(() => process.exit(fail ? 1 : 0), 200);
