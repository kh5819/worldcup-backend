// 게임 센스 서버 시험 (소켓·REST·가짜 DB): node scripts/test-sense-server.mjs
process.env.SENSE_RL = "100000";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import { registerSense, _senseTest } from "../src/sense.js"; import * as C from "../src/sense-core.js"; import { play } from "./sense-bots.mjs";
import { makeFakeSb } from "./mind-fake-sb.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const sb = makeFakeSb({ profiles: [{ id: "u_a", nickname: "회원A", avatar_url: "https://x/a.png" }] });
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_"), isAdmin: false }; n(); });
const getOptionalUser = async (req) => { const a = req.headers.authorization || ""; return a.startsWith("Bearer ") ? { id: a.slice(7) } : null; };
registerSense(io, sb, app, { getOptionalUser });
await new Promise((r) => server.listen(0, r)); const URLB = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URLB, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const get = async (p, h = {}) => { const r = await fetch(URLB + p, { headers: h }); return { status: r.status, j: await r.json() }; };
const PROF = (nick) => ({ nick, age: 30, avatar: { skin: 0, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });
// 검사 하나: 시작 → (서버 시계를 검사 길이만큼 되돌려 실제로 플레이한 것처럼) → 기록 제출
async function runTest(s, sid, i, item, pol, back = null) {
  const st = await emit(s, "sense:testStart", { sid, idx: i }); if (!st.ok) return st;
  _senseTest.SESS.get(sid).started[i] = Date.now() - (back ?? C.TESTS[item.id].dur + 1000);
  return emit(s, "sense:submit", { sid, idx: i, log: play(item.id, C.genSpec(item.id, item.seed), pol, C.rng(i + 3)) });
}
async function runSolo(s, mode, pol = "good", extra = {}) {
  const b = await emit(s, "sense:begin", { mode, device: "pc", ...extra }); if (!b.ok) return { b };
  const res = []; for (let i = 0; i < b.plan.length; i++) res.push(await runTest(s, b.sid, i, b.plan[i], pol));
  return { b, res, f: await emit(s, "sense:finish", { sid: b.sid, profile: PROF("테스터"), prefs: {}, isPublic: extra.isPublic !== false }) };
}
const g1 = await conn("guest_aaaaaaaa"), g2 = await conn("guest_bbbbbbbb"), m1 = await conn("u_a");
// 1) 빠른·정밀
{ const { b, res, f } = await runSolo(g1, "quick"); ok(b.plan.length === 6, "빠른검사 6종"); ok(res.every((r) => r.ok && r.result.score >= 70), "잘하면 고득점 " + res.map((r) => r.result?.score)); ok(f.ok && f.id, "빠른 저장"); ok(f.result.tier && f.result.style && f.result.diag.opinion.length, "티어·유형·소견"); ok(f.result.total >= 700, "빠른 총점 " + f.result.total); }
{ const { b, f } = await runSolo(m1, "full"); ok(b.plan.length === 15, "정밀검사 15종"); ok(f.ok && f.result.nick === "회원A", "회원 닉네임 = 프로필"); ok(f.result.total >= 800, "정밀 총점 " + f.result.total); ok(Object.keys(f.result.areas).length === 6, "6영역"); ok(f.result.rank === 1, "순위"); }
{ const { f } = await runSolo(g2, "full", "rnd"); ok(f.ok && f.result.total < 300, "찍기는 낮은 티어 " + f.result.total + " " + f.result.tier); }
{ const { f } = await runSolo(g2, "quick", "spam"); ok(f.ok && f.result.total < 300, "연타는 낮은 티어 " + f.result.total); }
// 2) 연습: 저장 안 됨
{ const n0 = sb.DB.sense_results.length; const b = await emit(g1, "sense:begin", { mode: "practice", test: "boss" }); ok(b.ok && b.plan.length === 1, "연습 시작"); const r = await runTest(g1, b.sid, 0, b.plan[0], "good"); ok(r.ok, "연습 제출"); const f = await emit(g1, "sense:finish", { sid: b.sid }); ok(f.practice && f.result.score >= 70, "연습 결과"); ok(sb.DB.sense_results.length === n0, "연습은 DB 저장 없음"); }
ok((await emit(g1, "sense:begin", { mode: "practice", test: "없음" })).error === "BAD_TEST", "없는 검사 거부"); ok((await emit(g1, "sense:begin", { mode: "x" })).error === "BAD_MODE", "없는 모드 거부");
// 3) 부정·중복·순서
{ const b = await emit(g1, "sense:begin", { mode: "quick" }), sid = b.sid;
  ok((await emit(g1, "sense:testStart", { sid, idx: 2 })).error === "BAD_ORDER", "순서 건너뛰기 거부");
  ok((await emit(g1, "sense:submit", { sid, idx: 0, log: {} })).error === "NOT_STARTED", "시작 안 한 검사 제출 거부");
  ok((await emit(m1, "sense:testStart", { sid, idx: 0 })).error === "NO_SESSION", "남의 세션 차단");
  const r1 = await runTest(g1, sid, 0, b.plan[0], "good"), r2 = await emit(g1, "sense:submit", { sid, idx: 0, log: {} }); ok(r2.dup && r2.result.score === r1.result.score, "중복 제출 = 처음 결과");
  ok((await emit(g1, "sense:testStart", { sid, idx: 0 })).error === "ALREADY_DONE", "끝난 검사 다시 시작 거부");
  const r3 = await runTest(g1, sid, 1, b.plan[1], "good", 2000); ok(r3.result.flags.includes("TOO_QUICK") || r3.result.flags.includes("TIME"), "시간 조작 표시"); ok(r3.result.score <= 40, "조작 40점 상한");
  const rs = await emit(g1, "sense:resume", { sid }); ok(rs.ok && rs.idx === 2 && rs.results[0].score === r1.result.score, "새로고침 이어하기");
  ok((await emit(g1, "sense:finish", { sid, profile: PROF("x") })).error === "NOT_COMPLETE", "미완료 저장 거부");
  for (let i = 2; i < b.plan.length; i++) await runTest(g1, sid, i, b.plan[i], "good");
  const f = await emit(g1, "sense:finish", { sid, profile: PROF("x") }); ok(f.ok && f.result.flagged && f.result.rank == null, "의심 기록은 순위 없음");
  const f2 = await emit(g1, "sense:finish", { sid, profile: PROF("x") }); ok(f2.id === f.id, "발급 두 번 = 같은 결과");
  const big = await emit(g1, "sense:begin", { mode: "quick" }); await emit(g1, "sense:testStart", { sid: big.sid, idx: 0 }); const rb = await emit(g1, "sense:submit", { sid: big.sid, idx: 0, log: { a: Array.from({ length: 9000 }, (_, k) => [k, "p", 0]) } }); ok(rb.result.flags.includes("LOG_TOO_BIG") && rb.result.score === 0, "너무 큰 기록 거부");
  const bad = await emit(g1, "sense:begin", { mode: "quick" }); await emit(g1, "sense:testStart", { sid: bad.sid, idx: 0 }); _senseTest.SESS.get(bad.sid).started[0] = Date.now() - 50000; const rx = await emit(g1, "sense:submit", { sid: bad.sid, idx: 0, log: { a: "x" } }); ok(rx.ok && rx.result.score === 0, "이상한 기록 = 0점"); }
// 4) REST
{ const rows = sb.DB.sense_results; const pub = rows.find((r) => r.owner_key === "g:guest_aaaaaaaa" && !r.flagged);
  const r = await get(`/sense/result/${pub.id}`); ok(r.j.ok && r.j.result.total === pub.total && !("owner_key" in r.j.result), "공유 결과 (소유 키 숨김)");
  ok((await emit(g1, "sense:setPublic", { id: pub.id, isPublic: false })).ok, "비공개 전환"); ok((await get(`/sense/result/${pub.id}`)).status === 403, "비공개는 남이 못 봄"); ok((await get(`/sense/result/${pub.id}`, { "x-iq-guest": "guest_aaaaaaaa" })).j.ok, "주인은 봄");
  ok(!(await emit(g2, "sense:setPublic", { id: pub.id, isPublic: true })).error || sb.DB.sense_results.find((x) => x.id === pub.id).is_public === false, "남의 기록 공개 전환 불가");
  await emit(g1, "sense:setPublic", { id: pub.id, isPublic: true });
  const rk = await get("/sense/ranking?mode=full"); ok(rk.j.ok && rk.j.rows[0].nick === "회원A" && rk.j.rows.every((x, i, a) => !i || a[i - 1].total >= x.total), "정밀 랭킹 정렬");
  ok(new Set(rk.j.rows.map((x) => x.nick + x.at)).size === rk.j.rows.length, "사람당 1개");
  const rq = await get("/sense/ranking?mode=quick"); ok(rq.j.rows.every((x) => x.total >= 0) && !rq.j.rows.some((x) => sb.DB.sense_results.find((y) => y.id === x.id)?.flagged), "의심 기록 랭킹 제외");
  const ar = await get("/sense/ranking?mode=full&board=area&area=info"); ok(ar.j.ok && ar.j.rows.every((x) => x.area != null), "영역 랭킹");
  const d = await get("/sense/dist?mode=full"); ok(d.j.ok && Object.keys(d.j.dist).length === 10, "티어 분포");
  const h = await emit(g1, "sense:history", {}); ok(h.ok && h.rows.length >= 2, "내 기록"); }
// 5) 게스트 → 회원 옮기기
{ const m = await emit(m1, "sense:me", { guestId: "guest_bbbbbbbb" }); ok(m.guestRecords === 2, "게스트 기록 수 " + m.guestRecords); const mv = await emit(m1, "sense:mergeGuest", { guestId: "guest_bbbbbbbb" }); ok(mv.ok && mv.moved === 2, "게스트 기록 옮기기"); ok((await emit(g1, "sense:mergeGuest", { guestId: "guest_x" })).error === "LOGIN_REQUIRED", "게스트는 옮기기 불가"); }
console.log(`\n통과 ${pass} · 실패 ${fail}`);
[g1, g2, m1].forEach((s) => s.close()); server.close(); process.exit(fail ? 1 : 0);
