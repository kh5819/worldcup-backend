// 인생 방송국 함께 운영(멀티) 서버 시험 — node scripts/test-lifebc-multi.mjs [방 수=50]
process.env.LBM_RL = "100000";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeMulti } from "../src/lifebc-multi.js";

const ROOMS_N = Number(process.argv[2] || 50);
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerLifeMulti(io);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, ms = 1500) => new Promise((res) => { const t = setTimeout(() => res(null), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });

// 만들기
const H = await conn("guest_mh");
ok((await emit(H, "lbm:create", {})).error === "NEED_NICK", "닉네임 필수");
ok((await emit(H, "lbm:create", { nick: "운영자" })).error === "BAD_NICK", "사칭 닉네임 막기");
const c = await emit(H, "lbm:create", { nick: "방장", max: 3 }); ok(c.ok && /^[A-Z0-9]{6}$/.test(c.code) && c.max === 3, "방 만들기 (최대 3명)");
const code = c.code;
ok((await emit(H, "lbm:create", { nick: "방장", max: 99 })).max === 8, "최대 인원은 8로 제한 (이전 방은 닫힘)");
const c2 = await emit(H, "lbm:create", { nick: "방장", max: 3 }); const CODE = c2.code;
ok((await emit(await conn("guest_x0"), "lbm:join", { code, nick: "늦은이" })).error === "NOT_FOUND", "닫힌 이전 방엔 못 들어감");

// 참가
const P1 = await conn("guest_p1"), P2 = await conn("guest_p2"), P3 = await conn("guest_p3");
const hostHello = once(H, "lbm:act");
const j1 = await emit(P1, "lbm:join", { code: CODE.toLowerCase(), nick: "참가1" }); ok(j1.ok && j1.seat === 1 && !j1.isHost, "참가 (소문자 코드도 됨)");
ok((await hostHello)?.type === "hello", "방장에게 '들어왔어요' 알림");
ok((await emit(P2, "lbm:join", { code: CODE, nick: "참가1" })).error === "NICK_TAKEN", "같은 닉네임 막기");
const j2 = await emit(P2, "lbm:join", { code: CODE, nick: "참가2" }); ok(j2.ok && j2.seat === 2, "두 번째 참가");
ok((await emit(P3, "lbm:join", { code: CODE, nick: "참가3" })).error === "FULL", "꽉 차면 거절");
// 재접속: 같은 사람은 같은 자리
const j1b = await emit(P1, "lbm:join", { code: CODE, nick: "아무거나" }); ok(j1b.ok && j1b.seat === 1 && j1b.nick === "참가1", "다시 들어오면 같은 자리·닉네임");

// 전체 상태 · 조각 중계
const gotFull = once(P1, "lbm:full"); ok((await emit(H, "lbm:full", { code: CODE, json: '{"a":1}', rev: 3, seat: 1 })).ok, "전체 상태 보내기");
ok((await gotFull)?.json === '{"a":1}', "지정한 참가자가 전체 상태 받음");
ok((await emit(P1, "lbm:full", { code: CODE, json: "{}" })).error === "NOT_HOST", "참가자는 전체 상태 못 보냄");
ok((await emit(H, "lbm:full", { code: CODE, json: "x".repeat(900001) })).error === "TOO_BIG", "너무 큰 상태 거절");
const gotSnap = once(P2, "lbm:snap"); H.emit("lbm:snap", { code: CODE, k: "fast", d: '{"t":"f"}' }); ok((await gotSnap)?.d === '{"t":"f"}', "화면 조각 중계");
const noSnap = once(H, "lbm:snap", 500); P1.emit("lbm:snap", { code: CODE, k: "fast", d: "{}" }); ok((await noSnap) === null, "참가자가 보낸 조각은 무시");

// 행동
const gotAct = once(H, "lbm:act"); ok((await emit(P1, "lbm:act", { code: CODE, type: "direct", cast: "doyun", kind: "workout", junk: "x" })).ok, "참가자 행동 보내기");
const a = await gotAct; ok(a?.type === "direct" && a.seat === 1 && a.nick === "참가1" && a.cast === "doyun" && a.junk === undefined, "방장이 행동 받음 (자리·닉네임 붙음, 이상한 값 제거)");
ok((await emit(P1, "lbm:act", { code: CODE, type: "hack" })).error === "BAD_TYPE", "모르는 행동 거절");
ok((await emit(H, "lbm:act", { code: CODE, type: "vote" })).error === "NOT_PLAYER", "방장은 행동 보낼 필요 없음");
ok((await emit(P3, "lbm:act", { code: CODE, type: "vote" })).error === "NOT_PLAYER", "방 밖 사람 행동 거절");
const gotNotice = once(P2, "lbm:notice"); await emit(H, "lbm:notice", { code: CODE, seat: 2, text: { ko: "안내", ja: "案内", en: "note" } }); ok((await gotNotice)?.text?.ko === "안내", "방장 → 한 사람에게 안내");

// 채팅
const gotChat = once(H, "lbm:chat"); await emit(P2, "lbm:chat", { code: CODE, text: "  안녕  " }); ok((await gotChat)?.text === "안녕", "채팅");
ok((await emit(P2, "lbm:chat", { code: CODE, text: "시발" })).error === "BAD_TEXT", "욕설 채팅 막기");

// 방장 연결 끊김 → 참가자에게 알림 → 다시 들어오면 복구
const offP = once(P1, "lbm:players"); H.disconnect(); const po = await offP; ok(po && po.hostOnline === false, "방장 끊김 알림");
ok((await emit(P1, "lbm:act", { code: CODE, type: "vote" })).error === "HOST_OFFLINE", "방장 없을 땐 행동 보류");
const H2 = await conn("guest_mh"); const onP = once(P1, "lbm:players"); const rj = await emit(H2, "lbm:join", { code: CODE, nick: "방장" }); ok(rj.ok && rj.isHost && rj.seat === 0, "방장 재접속 → 방장 자리 그대로");
ok((await onP)?.hostOnline === true, "참가자에게 방장 복귀 알림");

// 내보내기 · 나가기 · 닫기
const kicked = once(P2, "lbm:closed"); ok((await emit(H2, "lbm:kick", { code: CODE, seat: 2 })).ok, "내보내기"); ok((await kicked)?.reason === "KICKED", "내보내진 사람에게 알림");
ok((await emit(P1, "lbm:kick", { code: CODE, seat: 0 })).error === "NOT_HOST", "참가자는 못 내보냄");
ok((await emit(P2, "lbm:join", { code: CODE, nick: "다시옴" })).error === "BANNED", "내보낸 사람은 다시 못 들어옴");
{ const HT = await conn("guest_mh"); const r = await emit(HT, "lbm:join", { code: CODE, nick: "방장", asGuest: 1 }); ok(r.error === "IS_HOST", "방장 계정이 참가자로 들어오면 거절");
  const still = once(P1, "lbm:snap"); H2.emit("lbm:snap", { code: CODE, k: "fast", d: "{\"t\":\"f2\"}" }); ok((await still)?.d === "{\"t\":\"f2\"}", "그래도 방은 그대로 (방장 연결 유지)");
  const act = once(H2, "lbm:act"); await emit(P1, "lbm:act", { code: CODE, type: "resync" }); ok((await act)?.type === "resync", "행동은 원래 방장 창으로 감"); HT.close(); }
const bye = once(H2, "lbm:act"); ok((await emit(P1, "lbm:leave", { code: CODE })).ok, "참가자 나가기"); ok((await bye)?.type === "bye", "방장에게 나감 알림");
const P4 = await conn("guest_p4"); await emit(P4, "lbm:join", { code: CODE, nick: "참가4" }); const closed = once(P4, "lbm:closed");
ok((await emit(H2, "lbm:leave", { code: CODE })).ok, "방장 나가기 = 방 닫기"); ok((await closed)?.reason === "HOST_CLOSED", "참가자에게 방 닫힘 알림");

// 부하: 방 N개 × 8명, 초당 4번 조각
const t0 = Date.now(); const socks = []; let recv = 0;
for (let i = 0; i < ROOMS_N; i++) {
  const h = await conn("guest_lh" + i); socks.push(h); const r = await emit(h, "lbm:create", { nick: "방장" + i, max: 8 });
  for (let k = 1; k < 8; k++) { const g = await conn(`guest_lg${i}_${k}`); socks.push(g); await emit(g, "lbm:join", { code: r.code, nick: `참가${k}` }); g.on("lbm:snap", () => recv++); }
  h._code = r.code; h._host = true;
}
const big = JSON.stringify({ t: "f", ag: Array.from({ length: 12 }, (_, i) => ["cast" + i, 10.5, 20.5, 1, 1, "eat", "d", null, null]) });
const hosts = socks.filter((s) => s._host);
for (let tick = 0; tick < 8; tick++) { for (const h of hosts) h.emit("lbm:snap", { code: h._code, k: "fast", d: big }); await wait(250); }
await wait(800);
const expect = ROOMS_N * 7 * 8; ok(recv >= expect * 0.95, `부하: 방 ${ROOMS_N}개×8명 조각 ${recv}/${expect}`);
console.log(`부하 ${ROOMS_N}방 × 8명: ${Date.now() - t0}ms, 받은 조각 ${recv}/${expect}`);
for (const s of [...socks, P1, P2, P3, P4, H2]) s.disconnect();
console.log(`통과 ${pass} · 실패 ${fail}`); server.close(); process.exit(fail ? 1 : 0);
