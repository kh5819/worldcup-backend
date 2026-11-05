// 인생 방송국 — 시청자 사건 카드 서버 시험 (포인트·쿨타임·환불·채팅 명령·권한)
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast, lbcChatCard, lbcChatVote, CARD_COST, CHAT_CARD, _lbcTest } from "../src/lifebc-broadcast.js";
_lbcTest.gap = 0; // 개별 규칙 시험에서는 방송 전체 간격을 끔 (아래 '한꺼번에' 시험에서 켬)

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { s.user = { id: s.handshake.query.gid, isGuest: true }; next(); });
registerLifeBroadcast(io, null, null);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (gid) => new Promise((res) => { const s = ioc(URL0, { query: { gid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

const H = await conn("host"), A = await conn("va"), B = await conn("vb");
const reqs = []; H.on("lbc:cardReq", (r) => reqs.push(r));
const { id } = await emit(H, "lbc:create", { nick: "방장", title: "t" });
const ja = await emit(A, "lbc:join", { id, nick: "에이" }); await emit(B, "lbc:join", { id, nick: "비" });
ok(ja.pts === 30, "처음 30점");
ok(ja.state.cardCost?.confess === 30 && ja.state.cardCost.gift === 10, "카드 비용이 상태에 실림");
// 투표 +2
const poll = await emit(H, "lbc:poll", { id, q: "q", opts: [{ id: "x", label: "X" }, { id: "y", label: "Y" }], sec: 30 });
const v1 = await emit(A, "lbc:vote", { id, pollId: poll.pollId, opt: "x" }); ok(v1.ok && v1.pts === 32, "투표하면 +2점 → 32");
// 카드 내기
let results = []; A.on("lbc:cardResult", (m) => results.push(m));
ok((await emit(A, "lbc:card", { id, card: "confess", a: "c1", b: "c1" })).error === "BAD_TARGET", "같은 사람 둘은 안 됨");
ok((await emit(A, "lbc:card", { id, card: "nope", a: "c1", b: "c2" })).error === "BAD_CARD", "없는 카드 거절");
ok((await emit(A, "lbc:card", { id, card: "confess", a: "c1" })).error === "BAD_TARGET", "두 명 카드에 한 명만 → 거절");
const c1 = await emit(A, "lbc:card", { id, card: "confess", a: "c1", b: "c2" }); ok(c1.ok && c1.pts === 2, "고백 카드 (-30) → 2점");
await wait(100); ok(reqs.length === 1 && reqs[0].card === "confess" && reqs[0].a === "c1" && reqs[0].nick === "에이" && !("key" in reqs[0]), "스트리머에게 카드 요청 도착 (내부 키 없음)");
ok((await emit(A, "lbc:card", { id, card: "gift", a: "c1", b: "c2" })).error === "CARD_COOLDOWN", "45초 쿨타임");
// 스트리머: 성공 처리 → 본인에게 결과
ok((await emit(B, "lbc:cardDone", { id, rid: reqs[0].rid, ok: true })).error === "NOT_HOST", "시청자는 카드 처리 못 함");
await emit(H, "lbc:cardDone", { id, rid: reqs[0].rid, ok: true, good: true, text: { ko: "커플 탄생", ja: "カップル", en: "couple" } }); await wait(100);
ok(results[0]?.ok && results[0].text?.ko === "커플 탄생", "카드 낸 사람 폰에 결과");
const st = await emit(B, "lbc:watch", { id }); ok(st.state.notice?.kind === "card" && st.state.notice.nick === "에이", "모두에게 '카드 발동' 알림");
// 포인트 부족
const _b = _lbcTest.BC.get(id); _b.viewers.get("g:vb").cardAt = 0; _b.viewers.get("g:vb").pts = 5;
ok((await emit(B, "lbc:card", { id, card: "cheer", a: "c1" })).error === "NO_POINTS", "포인트 부족");
// 실패 처리 → 환불
_b.viewers.get("g:vb").pts = 30; const c2 = await emit(B, "lbc:card", { id, card: "cheer", a: "c9" }); ok(c2.ok && c2.pts === 20, "응원(-10)");
await wait(50); await emit(H, "lbc:cardDone", { id, rid: reqs[1].rid, ok: false }); ok(_b.viewers.get("g:vb").pts === 30, "실행 실패 → 포인트 환불");
// 오래 처리 안 된 카드 → 환불
_b.viewers.get("g:vb").cardAt = 0; const c3 = await emit(B, "lbc:card", { id, card: "gift", a: "c1", b: "c2" }); ok(c3.ok && _b.viewers.get("g:vb").pts === 20, "선물(-10)");
_b.cardQ[0].at -= 200e3; _b.viewers.get("g:va").cardAt = 0; _b.viewers.get("g:va").pts = 50; await emit(A, "lbc:card", { id, card: "gift", a: "c1", b: "c2" });
ok(_b.viewers.get("g:vb").pts === 30, "2분 넘게 처리 안 된 카드는 자동 환불");
// 채팅 명령
ok(CHAT_CARD["고백"] === "confess" && CHAT_CARD["告白"] === "confess" && CHAT_CARD["cheer"] === "cheer", "채팅 명령어 한·일·영");
const cc = lbcChatCard(id, "c:chzzk:u1", "채팅러", "confess", "철수", "영희"); ok(cc.ok && cc.pts === 0, "채팅 계정: 처음 30점 → 고백 후 0점");
await wait(100); const last = reqs[reqs.length - 1]; ok(last.chat === true && last.a === "철수" && last.b === "영희" && last.nick === "채팅러", "채팅 카드는 이름으로 전달");
ok(lbcChatCard(id, "c:chzzk:u1", "채팅러", "gift", "철수", "영희").error === "CARD_COOLDOWN", "채팅도 쿨타임");
_b.cardQ = []; _b.chatW.get("c:chzzk:u1").cardAt = 0; ok(lbcChatCard(id, "c:chzzk:u1", "채팅러", "gift", "철수", "영희").error === "NO_POINTS", "채팅도 포인트 필요");
const poll2 = await emit(H, "lbc:poll", { id, q: "q2", opts: [{ id: "x", label: "X" }, { id: "y", label: "Y" }], sec: 30 });
lbcChatVote(id, "c:chzzk:u1", 1); lbcChatVote(id, "c:chzzk:u1", 2); ok(_b.chatW.get("c:chzzk:u1").pts === 2, "채팅 투표 +2 (표 바꾸기는 추가 없음)");
// 대기열 한도
for (const r of _b.cardQ) r.at = Date.now(); let busy = null;
for (let i = 0; i < 12; i++) { const r = lbcChatCard(id, "c:soop:x" + i, "x" + i, "cheer", "철수"); if (r?.error === "CARD_BUSY") { busy = i; break; } }
ok(busy != null && _b.cardQ.length === 2, "대기 카드 한도(보통 2개) 넘으면 막힘");
// 개입 끄기
await emit(H, "lbc:intensity", { id, level: "off" }); _b.viewers.get("g:va").cardAt = 0;
ok((await emit(A, "lbc:card", { id, card: "cheer", a: "c1" })).error === "APPLY_OFF", "시청자 개입 끄면 카드 못 냄");
ok(Object.keys(CARD_COST).length === 7, "시청자 카드 7종");
// 관계 요약(soc)은 정리·크기 제한 후 전달
await emit(H, "lbc:intensity", { id, level: "normal" });
await emit(H, "lbc:status", { id, status: { day: 3, cast: [], soc: { al: Array.from({ length: 20 }, (_, i) => ({ a: { ko: "가<script>" + i }, b: "나", t: "x".repeat(500), on: 1 })), rev: ["비밀".repeat(200)], iv: { who: "다", lines: [{ q: { ko: "질문" }, a: { ko: "답" }, h: "evil" }, {}, {}, {}, {}] } } } });
const st2 = (await emit(B, "lbc:watch", { id })).state.status.soc;
ok(st2.al.length === 8 && !/[<>]/.test(st2.al[0].a.ko) && st2.al[0].t.length <= 30, "동맹 목록 8개까지 · 태그 제거 · 길이 제한");
ok(st2.rev[0].length <= 120 && st2.iv.lines.length === 3 && st2.iv.lines[0].h === null, "비밀 120자 · 인터뷰 3줄 · 이상한 값 버림");
// ---------- 한꺼번에: 시청자 300 + 채팅 300이 같은 순간 카드 ----------
{
  _lbcTest.gap = null;
  const H2 = await conn("host2"); const rq = []; H2.on("lbc:cardReq", (r) => rq.push(r));
  const { id: id2 } = await emit(H2, "lbc:create", { nick: "방장2", title: "t2" }); const b2 = _lbcTest.BC.get(id2);
  const vs = []; for (let k = 0; k < 300; k += 30) vs.push(...await Promise.all(Array.from({ length: 30 }, (_, i) => conn("burst" + (k + i))))); // 접속만 나눠서, 카드는 동시에
  await Promise.all(vs.map((v, i) => emit(v, "lbc:join", { id: id2, nick: "시청" + i })));
  const before = [...b2.viewers.values()].filter((x) => !x.host).reduce((s, x) => s + x.pts, 0);
  const [phone, chat] = await Promise.all([
    Promise.all(vs.map((v) => emit(v, "lbc:card", { id: id2, card: "cheer", a: "c1" }))),
    Promise.resolve(Array.from({ length: 300 }, (_, i) => lbcChatCard(id2, "c:chzzk:b" + i, "채팅" + i, "cheer", "철수"))),
  ]);
  const all = [...phone, ...chat], okN = all.filter((r) => r.ok).length, busyN = all.filter((r) => r.error === "CARD_BUSY").length;
  ok(okN === 1 && busyN === 599, `600명 동시 → 1장만 접수, 599명 대기 안내 (${okN}/${busyN})`);
  ok(all.filter((r) => r.error === "CARD_BUSY").every((r) => r.wait > 0), "막힌 사람에게 남은 초를 알려 줌");
  const after = [...b2.viewers.values()].filter((x) => !x.host).reduce((s, x) => s + x.pts, 0), used = phone.some((r) => r.ok) ? CARD_COST.cheer : 0;
  ok(after === before - used, "막힌 시청자 포인트는 안 깎임");
  ok([...b2.viewers.values()].filter((x) => x.cardAt).length === (phone.some((r) => r.ok) ? 1 : 0), "막힌 시청자 개인 쿨타임도 안 걸림");
  await wait(200); ok(rq.length === 1 && b2.cardQ.length === 1, "스트리머에게도 1장만 전달");
  // 간격이 지나면 다음 카드 접수, 대기열은 한도까지만
  b2.cardLastAt = 0; const nx = lbcChatCard(id2, "c:chzzk:z1", "다음", "cheer", "철수"); ok(nx.ok, "간격 지나면 다음 카드 접수");
  b2.cardLastAt = 0; ok(lbcChatCard(id2, "c:chzzk:z2", "다음2", "cheer", "철수").error === "CARD_BUSY" && b2.cardQ.length === 2, "대기열 한도는 간격과 별도로 지킴");
  // 개입 강도별 간격
  await emit(H2, "lbc:intensity", { id: id2, level: "high" }); b2.cardLastAt = Date.now() - 26e3; ok(lbcChatCard(id2, "c:chzzk:z3", "높음", "cheer", "철수").ok, "높음: 25초 간격");
  await emit(H2, "lbc:intensity", { id: id2, level: "low" }); b2.cardQ = []; b2.cardLastAt = Date.now() - 80e3; ok(lbcChatCard(id2, "c:chzzk:z4", "낮음", "cheer", "철수").error === "CARD_BUSY", "낮음: 90초 간격");
  // 2분 지난 카드: 상태 전송만으로도 환불 + 폰에 알림
  await emit(H2, "lbc:intensity", { id: id2, level: "normal" }); b2.cardQ = []; b2.cardLastAt = 0;
  const v0 = vs.find((_, i) => !b2.viewers.get("g:burst" + i)?.cardAt), k0 = "g:" + "burst" + vs.indexOf(v0), got = []; v0.on("lbc:cardResult", (m) => got.push(m));
  const pts0 = b2.viewers.get(k0).pts; ok((await emit(v0, "lbc:card", { id: id2, card: "cheer", a: "c1" })).ok, "환불 시험 카드");
  b2.cardQ[0].at -= 200e3; const rid0 = b2.cardQ[0].rid; await emit(H2, "lbc:status", { id: id2, status: { day: 1, cast: [] } }); await wait(150);
  ok(b2.viewers.get(k0).pts === pts0 && b2.cardQ.length === 0, "2분 지난 카드는 상태 전송 때 자동 환불");
  ok(got.length === 1 && got[0].ok === false && got[0].rid === rid0, "환불되면 시청자 폰에 실패 안내");
  ok((await emit(H2, "lbc:cardDone", { id: id2, rid: rid0, ok: true })).error === "CARD_NOT_FOUND" && b2.viewers.get(k0).pts === pts0, "환불된 카드를 나중에 처리해도 이중 처리 없음");
  for (const v of vs) v.disconnect(); H2.disconnect();
}
console.log(`통과 ${pass} · 실패 ${fail}`); for (const s of [H, A, B]) s.disconnect(); server.close(); setTimeout(() => process.exit(fail ? 1 : 0), 200);
