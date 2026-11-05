// 인생 방송국 채팅 투표 시험 — 치지직·SOOP·씨미 채팅 "!1"~"!6" 이 폰 투표와 같은 집계에 합쳐지는지
process.env.LBC_RL = "100000";
import http from "http";
import fs from "fs";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast, lbcChatVote, lbcExists } from "../src/lifebc-broadcast.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
const logRows = []; const sb = { from: (t) => ({ insert: (r) => { logRows.push([t, r]); return Promise.resolve({ error: null }); } }) };
registerLifeBroadcast(io, sb, null);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 게스트 스트리머도 방송 가능 + admin 목록에 기록
const H = await conn("guest_streamer01");
const c = await emit(H, "lbc:create", { nick: "게스트방송", title: "테스트" }); ok(c.ok, "게스트도 스트리머 모드 시작");
await wait(50);
ok(logRows.some(([t, r]) => t === "streamer_chat_log" && r.platform === "lifebc" && r.nickname === "게스트방송" && r.host_user_id === null), "admin 스트리머 목록에 기록 (게스트)");
const M = await conn("11111111-2222-3333-4444-555555555555"); const cm = await emit(M, "lbc:create", { nick: "회원방송" }); await wait(50);
ok(logRows.some(([, r]) => r.nickname === "회원방송" && r.host_user_id === "11111111-2222-3333-4444-555555555555"), "admin 기록 (회원은 아이디도)");
const id = c.id; ok(lbcExists(id) && !lbcExists("nope"), "방송 확인");

// 투표 없을 때 채팅 표는 버림
ok(lbcChatVote(id, "c:chzzk:a", 1) === null, "열린 투표 없으면 채팅 표 무시");
// 투표 열기 → 폰 1표 + 채팅 표
const P = await emit(H, "lbc:poll", { id, kind: "event", q: "질문", opts: [{ id: "0", label: "가" }, { id: "1", label: "나" }, { id: "2", label: "다" }], sec: 20 }); ok(P.ok, "투표 열기");
const V = await conn("guest_viewer01"); await emit(V, "lbc:join", { id, nick: "폰시청자" }); ok((await emit(V, "lbc:vote", { id, pollId: P.pollId, opt: "1" })).ok, "폰 투표");
ok(lbcChatVote(id, "c:chzzk:u1", 2)?.opt === "1", "치지직 채팅 !2 → 선택지 2");
ok(lbcChatVote(id, "c:soop:u2", 3)?.opt === "2", "SOOP 채팅 !3 → 선택지 3");
ok(lbcChatVote(id, "c:cime:u3", 1)?.opt === "0", "씨미 채팅 !1 → 선택지 1");
ok(lbcChatVote(id, "c:chzzk:u1", 2)?.dup === true, "같은 사람 같은 표는 한 번만");
ok(lbcChatVote(id, "c:soop:u2", 2)?.opt === "1", "표 바꾸기");
ok(lbcChatVote(id, "c:chzzk:u9", 5) === null, "없는 번호(!5) 무시");
const cl = await emit(H, "lbc:pollClose", { id });
ok(cl.ok && cl.total === 4 && cl.counts["1"] === 3 && cl.counts["2"] === 0 && cl.counts["0"] === 1 && cl.result === "1", `폰+채팅 합산 결과 (${JSON.stringify(cl.counts)} → ${cl.result})`);
ok(lbcChatVote(id, "c:chzzk:u7", 1) === null, "마감 후 채팅 표 무시");
// 우승 예측에도 들어감
const R = await emit(H, "lbc:pred", { id, q: "누가 이길까", opts: [{ id: "doyun", label: "도윤" }, { id: "harin", label: "하린" }], sec: 25, pts: 10 }); ok(R.ok, "예측 열기");
ok(lbcChatVote(id, "c:chzzk:u1", 2)?.kind === "pred", "투표가 없으면 채팅 표는 우승 예측으로");
// 채팅 문장 해석 (index.js 의 규칙과 같은 식)
const src = fs.readFileSync(new globalThis.URL("../src/index.js", import.meta.url), "utf8");
const m = src.match(/const m = t\.match\((\/\^\[!！\][^/]*\/)\)/); ok(!!m, "index.js 채팅 해석 규칙 찾음");
const re = eval(m[1]); const parse = (s) => { const r = String(s).normalize("NFKC").trim().match(re); return r ? +r[1] : null; };
ok(parse("!1") === 1 && parse(" ! 3 ") === 3 && parse("！２") === 2 && parse("!6") === 6, "!1 · ! 3 · 전각 ！２ 인식");
ok(parse("1") === null && parse("!7") === null && parse("!12") === null && parse("!1 가자") === null, "느낌표 없음·범위 밖·긴 문장은 무시");
for (const s of [H, M, V]) s.disconnect();
console.log(`통과 ${pass} · 실패 ${fail}`); server.close(); setTimeout(() => process.exit(fail ? 1 : 0), 200);
