// 인생 방송국 스트리머 모드 서버 시험 + 부하 — node scripts/test-lifebc-bc.mjs [시청자 수=300]
process.env.LBC_RL = "100000";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast, _lbcTest, nickOk } from "../src/lifebc-broadcast.js";

const N = Number(process.argv[2] || 300);
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerLifeBroadcast(io, null, app);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

ok(!nickOk("시발놈") && !nickOk("운영자") && !nickOk("http://x") && nickOk("치즈냥"), "닉네임 거르기");
const host = await conn("guest_host01");
ok((await emit(host, "lbc:create", {})).error === "NEED_NICK", "닉네임 필수");
ok((await emit(host, "lbc:create", { nick: "관리자" })).error === "BAD_NICK", "사칭 닉네임 막기");
const c = await emit(host, "lbc:create", { nick: "방송국PD", title: "인생 방송국 합방", intensity: "normal" });
ok(c.ok && c.id, "방송 만들기"); const id = c.id, B = _lbcTest.BC.get(id);

const vs = []; for (let k = 0; k < N; k += 50) vs.push(...(await Promise.all(Array.from({ length: Math.min(50, N - k) }, (_, j) => conn(`guest_v${k + j}`)))));
let states = 0; vs[0].on("lbc:state", () => states++);
const t0 = Date.now(); const joins = await Promise.all(vs.map((v, k) => emit(v, "lbc:join", { id, nick: `시청자${k}` })));
ok(joins.every((j) => j.ok) && B.viewers.size === N + 1, `시청자 ${N}명 참여 (${Date.now() - t0}ms)`);
ok((await emit(vs[1], "lbc:poll", { id, q: "x", opts: [{ label: "a" }, { label: "b" }] })).error === "NOT_HOST", "시청자는 투표 못 엶");
ok((await emit(await conn("guest_bad"), "lbc:join", { id, nick: "씨발" })).error === "BAD_NICK", "욕설 닉네임 참여 막기");

// 투표
const po = await emit(host, "lbc:poll", { id, kind: "event", q: { ko: "어떻게 할까?", ja: "どうする？", en: "What now?" }, opts: [{ id: "0", label: { ko: "화해", en: "Make up" } }, { id: "1", label: "방송에 쓴다" }], sec: 20 });
ok(po.ok, "투표 열기");
ok((await emit(host, "lbc:vote", { id, pollId: po.pollId, opt: "0" })).error === "HOST_NO_VOTE", "스트리머는 투표 안 함");
const t1 = Date.now(); await Promise.all(vs.map((v, k) => emit(v, "lbc:vote", { id, pollId: po.pollId, opt: k % 3 === 0 ? "1" : "0" })));
ok((await emit(vs[0], "lbc:vote", { id, pollId: po.pollId, opt: "1" })).dup, "중복 투표 무시");
ok((await emit(vs[0], "lbc:vote", { id, pollId: po.pollId, opt: "9" })).error, "없는 선택지 거부");
const pc = await emit(host, "lbc:pollClose", { id });
const exp1 = vs.filter((_, k) => k % 3 === 0).length;
ok(pc.ok && pc.total === N && pc.counts["1"] === exp1 && pc.result === (exp1 > N - exp1 ? "1" : "0"), `투표 집계 정확 (${Date.now() - t1}ms, ${pc.counts["0"]}:${pc.counts["1"]})`);
ok((await emit(vs[2], "lbc:vote", { id, pollId: po.pollId, opt: "0" })).error === "POLL_CLOSED", "마감 후 투표 무효");

// 예측
const pr = await emit(host, "lbc:pred", { id, q: "누가 우승?", opts: [{ id: "doyun", label: "한도윤" }, { id: "harin", label: "서하린" }, { id: "taeo", label: "강태오" }], sec: 30, pts: 10 });
ok(pr.ok, "예측 열기");
await Promise.all(vs.map((v, k) => emit(v, "lbc:predict", { id, predId: pr.predId, opt: ["doyun", "harin", "taeo"][k % 3] })));
await emit(host, "lbc:predLock", { id });
ok((await emit(vs[5], "lbc:predict", { id, predId: pr.predId, opt: "doyun" })).error === "PRED_LOCKED", "잠긴 뒤 예측 무효");
const st = await emit(host, "lbc:predSettle", { id, predId: pr.predId, answer: "harin" });
const hit = vs.filter((_, k) => k % 3 === 1).length;
ok(st.ok && st.winners.n === hit, `예측 정산 (${hit}명 정답, +${st.winners.pts}점)`);
const me1 = await emit(vs[1], "lbc:me", { id }), me0 = await emit(vs[0], "lbc:me", { id });
ok(me1.pts === me0.pts + st.winners.pts && me1.rank === 1, "점수·순위 (현금성 없음, 게임 포인트만)");
ok((await emit(host, "lbc:predSettle", { id, predId: pr.predId, answer: "doyun" })).dup, "두 번 정산 막기");

// 출연 신청
const ap = await Promise.all(vs.slice(0, 20).map((v, k) => emit(v, "lbc:apply", { id, nick: `지원${k}`, look: { base: 9, hair: 3, shirt: -2 }, preset: "joker", goal: "love" })));
ok(ap.every((a) => a.ok), "출연 신청 20명");
ok(B.apps[0].look.base === 5 && B.apps[0].look.shirt === 0, "외형 값 범위 보정");
ok((await emit(vs[0], "lbc:apply", { id })).dup, "중복 신청 무시");
ok((await emit(vs[25], "lbc:apply", { id, nick: "admin" })).error === "BAD_NICK", "신청 닉네임 거르기");
const list = await emit(host, "lbc:apps", { id }); ok(list.ok && list.rows.length === 20 && !("key" in list.rows[0]), "신청 목록(개인 키 숨김)");
const acc = await emit(host, "lbc:accept", { id, appId: list.rows.find((r) => r.nick === "지원3").id }); // 신청 순서는 동시 도착이라 매번 다름 ok(acc.ok && acc.app.nick === "지원3", "스트리머 승인");
const dr = await emit(host, "lbc:draw", { id }); ok(dr.ok && dr.app.nick && B.apps.length === 18, "추첨");
ok((await emit(vs[3], "lbc:apply", { id })).error === "ALREADY_CAST", "이미 출연 중이면 재신청 막기");
ok((await emit(vs[3], "lbc:me", { id })).accepted, "내 출연 확정 표시");

// 상태 전달 + 크기 제한
await emit(host, "lbc:status", { id, status: { day: 3, time: "19:05", money: 4210, rating: 7.25, show: { ko: "요리왕" }, ticker: Array(10).fill({ ko: "x".repeat(500) }), cast: Array(30).fill({ name: { ko: "가" }, mood: "😄", doing: { ko: "요리" } }) } });
await wait(700);
ok(B.status.ticker.length === 4 && B.status.ticker[0].ko.length === 120 && B.status.cast.length === 16 && B.status.rating === 7.3, "상황 전달 크기 제한");
ok(states > 0 && states < 60, `방 화면 갱신 묶음 전송 (${states}회)`);
ok((await emit(host, "lbc:intensity", { id, level: "off" })).ok && (await emit(vs[30], "lbc:apply", { id })).error === "APPLY_OFF", "개입 끄기 → 신청 막힘");
const end = await emit(host, "lbc:end", { id }); ok(end.ok && end.board.top[0].pts > 0, "방송 종료 + 순위");
ok((await emit(vs[40], "lbc:join", { id, nick: "늦음" })).error === "BC_CLOSED", "종료 후 참여 막기");
const h2 = await emit(host, "lbc:create", { nick: "방송국PD" }); ok(h2.ok && h2.id !== id, "새 방송 (이전 것은 자동 종료)");

console.log(`\n${pass} 통과 / ${fail} 실패 (시청자 ${N}명)`);
for (const v of vs) v.close(); host.close(); io.close(); server.close(); process.exit(fail ? 1 : 0);
