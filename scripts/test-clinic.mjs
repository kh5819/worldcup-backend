// 진단소 서버 시험: node scripts/test-clinic.mjs
// 1) 화면/서버 core 파일 동일 2) 12종 생성·채점 결정성 3) 솔로 흐름·시간 조작 탐지 4) 8인 멀티(재접속·방장·순위·단체 진단)
process.env.CLINIC_FAST = "1";
import fs from "fs";
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import * as C from "../src/clinic-core.js";
import { registerClinic, judgeSubmit } from "../src/clinic.js";
import { registerClinicMulti } from "../src/clinic-multi.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("  ✗", msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 같은 파일인지
const a = fs.readFileSync(new URL("../src/clinic-core.js", import.meta.url), "utf8");
const b = fs.readFileSync(new URL("../../홈페이지 제작/js/clinic/core.js", import.meta.url), "utf8");
ok(a === b, "clinic-core.js 와 홈페이지 js/clinic/core.js 가 다름 — 복사 필요");

// 2) 생성 결정성 + 빈 기록/이상 기록에도 안 죽음
for (const t of C.TEST_IDS) {
  ok(JSON.stringify(C.genSpec(t, 123)) === JSON.stringify(C.genSpec(t, 123)), `${t} 같은 시드 다른 문제`);
  const spec = C.genSpec(t, 9);
  for (const bad of [null, {}, { t: "x" }, { p: [1e9, -5, "a"] }, { a: [[99, 1], ["x", null]] }, { k: [[0, -1]] }, { r: [{ k: "zz" }] }]) {
    const r = C.scoreTest(t, spec, bad);
    ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100, `${t} 이상 기록 점수 ${r.score}`);
  }
}
ok(C.phraseCount() >= 100, "유머 문구 100종 미만");
ok(C.checkLangParity().length === 0, "한/일/영 문구 목록 길이 다름: " + C.checkLangParity().join(","));
for (const t of C.TEST_IDS) ok(C.testName(t, "ja") !== C.testName(t, "ko") && C.testHow(t, "en").length === C.TESTS[t].how.length, `${t} 번역 누락`);
// 진단 다양성: 같은 총점이라도 검사 특징 다르면 진단명 달라야
{
  const mk = (hi) => Object.fromEntries(C.TEST_IDS.map((t) => [t, { score: t === hi ? 95 : 50, m: { taps: 99, tps: 9.9, span: 8, med: 190, best: 180, combos: 15, acc: 95, kills: 12, of: 12, comm: 0, omit: 0, perfect: 6, sec: 30, hits: 0, graze: 3, pf: 30, combo: 35, miss: 0, avg: 380, ok: 33, catches: 11, ratio: 80 }, flags: [] }]));
  const titles = new Set(C.TEST_IDS.map((t) => C.diagnose({ results: mk(t), age: 30, gender: "m", seed: 1 }).title));
  ok(titles.size >= 9, `검사별 진단명 다양성 부족 ${titles.size}`);
  const seeds = new Set(Array.from({ length: 30 }, (_, i) => C.diagnose({ results: mk("aim"), age: 30, gender: "f", seed: i }).opinion.join("|")));
  ok(seeds.size >= 8, `소견 반복 많음 ${seeds.size}`);
  // 성별만 바꿔도 점수·나이 같아야 (성별 보정 없음)
  const m = C.diagnose({ results: mk("tap"), age: 25, gender: "m", seed: 3 }), f = C.diagnose({ results: mk("tap"), age: 25, gender: "f", seed: 3 });
  ok(m.total === f.total && m.phys === f.phys && m.title === f.title, "성별에 따라 결과가 달라짐");
}

// 서버 띄우기 (DB 없이)
const server = http.createServer();
const io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerClinic(io, null, null);
registerClinicMulti(io, null);
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const conn = (id) => new Promise((res) => { const s = ioc(`http://localhost:${port}`, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

// 3) 솔로
{
  const s = await conn("guest_solo1", true);
  const b1 = await emit(s, "clinic:begin", { mode: "quick", device: "pc" });
  ok(b1.ok && b1.plan.length === 5, "솔로 시작 실패");
  const prof = { nick: "테스터", gender: "f", age: 31, avatar: { skin: 1, hc: 2, hs: 3, shirt: 4, pants: 1, hat: 2 } };
  const f0 = await emit(s, "clinic:finish", { sid: b1.sid, profile: prof });
  ok(!f0.ok && f0.error === "NOT_COMPLETE", "다 안 했는데 발급됨");
  const nos = await emit(s, "clinic:submit", { sid: b1.sid, idx: 0, log: {} });
  ok(!nos.ok && nos.error === "NOT_STARTED", "시작 안 한 검사 제출됨");
  // 시간 조작: 탭 10초 기록을 시작 직후 제출 → TIME
  const tapIdx = b1.plan.findIndex((x) => x.id === "tap");
  // 순서 건너뛰기 금지
  const skip = await emit(s, "clinic:testStart", { sid: b1.sid, idx: b1.plan.length - 1 });
  ok(!skip.ok && skip.error === "BAD_ORDER", "검사 순서 건너뛰기 허용됨");
  for (let i = 0; i < b1.plan.length; i++) {
    await emit(s, "clinic:testStart", { sid: b1.sid, idx: i });
    if (i === tapIdx) {   // 시간 조작: 10초 기록을 시작 직후 제출 → TIME
      const fake = { t: Array.from({ length: 90 }, (_, k) => 100 + k * 110) };
      const r1 = await emit(s, "clinic:submit", { sid: b1.sid, idx: i, log: fake });
      ok(r1.ok && r1.result.flags.includes("TIME") && r1.result.score <= 40, "시간 조작 못 잡음");
      const dup = await emit(s, "clinic:submit", { sid: b1.sid, idx: i, log: { t: [1, 2, 3] } });
      ok(dup.ok && dup.dup && dup.result.score === r1.result.score, "중복 제출로 점수 바뀜");
      const again = await emit(s, "clinic:testStart", { sid: b1.sid, idx: i });
      ok(!again.ok && again.error === "ALREADY_DONE", "끝난 검사 다시 시작됨");
      continue;
    }
    const r = await emit(s, "clinic:submit", { sid: b1.sid, idx: i, log: b1.plan[i].id === "reaction" ? { tr: [240, 260, 251, 300, 233] } : {} });
    ok(r.ok, "제출 실패 " + b1.plan[i].id);
    if (i === 0) {   // 새로고침 이어하기
      const rs = await emit(s, "clinic:resume", { sid: b1.sid });
      ok(rs.ok && rs.idx === 1 && rs.results[0] && !rs.results[1] && rs.plan.length === 5, "이어하기 정보 이상");
      const s3 = await conn("guest_thief");
      ok(!(await emit(s3, "clinic:resume", { sid: b1.sid })).ok, "남의 세션 이어하기 가능");
      s3.close();
    }
  }
  const bad = await emit(s, "clinic:finish", { sid: b1.sid, profile: { nick: "", gender: "x", age: 3 } });
  ok(!bad.ok && bad.error === "BAD_PROFILE", "잘못된 프로필 통과");
  const f1 = await emit(s, "clinic:finish", { sid: b1.sid, profile: prof });
  ok(f1.ok && f1.result && f1.result.diag.title && f1.result.flagged === true, "발급 실패 또는 의심 표시 없음");
  ok(f1.result.age === 31 && f1.result.gender === "f", "프로필 반영 안 됨");
  // 다른 사람이 남의 세션 제출 못함
  const s2 = await conn("guest_other", true);
  const st = await emit(s2, "clinic:submit", { sid: b1.sid, idx: 0, log: {} });
  ok(!st.ok, "남의 세션 접근 가능");
  // 정상 시간: 10초 기다렸다 제출하면 TIME 없음
  const b2 = await emit(s2, "clinic:begin", { mode: "practice", test: "tap", device: "mobile" });
  await emit(s2, "clinic:testStart", { sid: b2.sid, idx: 0 });
  await sleep(10100);
  const r2 = await emit(s2, "clinic:submit", { sid: b2.sid, idx: 0, log: { t: Array.from({ length: 80 }, (_, i) => 60 + i * 120 + (i % 3) * 9) } });
  ok(r2.ok && !r2.result.flags.length && r2.result.score > 50, "정상 기록이 의심 처리됨 " + JSON.stringify(r2.result.flags));
  ok(judgeSubmit("tap", 1, { t: Array(40000).fill(1) }, "pc", 1e9).flags.includes("LOG_TOO_BIG"), "큰 기록 통과");
  s.close(); s2.close();
}

// 4) 멀티 8인
{
  const prof = (i) => ({ nick: `P${i}`, gender: i % 2 ? "f" : "m", age: 18 + i * 6, avatar: { skin: i % 3, hc: i % 5, hs: i % 9, shirt: i % 12, pants: i % 7, hat: i % 9 } });
  const P = [];
  P.push(await conn("u_host"));
  const g = await emit(P[0], "clm:join", { code: "000000" });
  ok(!g.ok, "없는 방 입장됨");
  const guestCreate = await conn("guest_c", true);
  ok(!(await emit(guestCreate, "clm:create", {})).ok, "게스트가 방 만듦");
  guestCreate.close();
  const c = await emit(P[0], "clm:create", { mode: "quick", maxPlayers: 8, profile: prof(0), device: "pc" });
  ok(c.ok && c.room.code, "방 만들기 실패");
  const code = c.room.code;
  for (let i = 1; i < 8; i++) {
    P.push(await conn(i % 2 ? `guest_m${i}` : `u_m${i}`, i % 2 === 1));
    const j = await emit(P[i], "clm:join", { code, profile: prof(i), device: i % 3 ? "pc" : "mobile" });
    ok(j.ok, "입장 실패 " + i + " " + j.error);
  }
  const extra = await conn("guest_9", true);
  ok((await emit(extra, "clm:join", { code, profile: prof(9) })).error === "ROOM_FULL", "9번째 입장됨");
  extra.close();
  let last = {};
  P.forEach((s, i) => s.on("clm:room", (r) => { last[i] = r; }));
  ok((await emit(P[0], "clm:start", {})).error === "NOT_READY", "준비 안 했는데 시작됨");
  ok((await emit(P[3], "clm:start", {})).error === "NOT_HOST", "방장 아닌데 시작됨");
  // 방장 위임 후 되돌리기
  ok((await emit(P[0], "clm:host", { to: "u_m2" })).ok, "방장 위임 실패");
  await sleep(50);
  ok(last[0].host === "u_m2", "방장 위임 반영 안 됨");
  await emit(P[2], "clm:host", { to: "u_host" });
  for (let i = 1; i < 8; i++) await emit(P[i], "clm:ready", { ready: true });
  // 한 명 대기실에서 끊겼다 복귀
  P[5].close();
  await sleep(100);
  P[5] = await conn("guest_m5", true);
  P[5].on("clm:room", (r) => { last[5] = r; });
  const rj = await emit(P[5], "clm:rejoin", {});
  ok(rj.ok, "대기실 재접속 실패");
  await emit(P[5], "clm:ready", { ready: true });
  const st = await emit(P[0], "clm:start", {});
  ok(st.ok, "시작 실패 " + st.error);
  // 라운드마다: 같은 시드 확인 → 모두 제출 (한 명은 중간 라운드에 끊김)
  const tests = C.MODES.quick.tests;
  let seedsSame = true;
  for (let round = 0; round < tests.length; round++) {
    for (let w = 0; w < 200 && !(last[0]?.phase === "play" && last[0].round === round); w++) await sleep(20);
    ok(last[0]?.phase === "play" && last[0].round === round, `라운드 ${round} 시작 안 됨 ${last[0]?.phase} ${last[0]?.round}`);
    const seeds = new Set(Object.values(last).filter((r) => r.round === round).map((r) => r.seed));
    if (seeds.size !== 1) seedsSame = false;
    if (round === 2) { P[7].close(); }
    if (round === 3) {   // 끊겼던 사람 복귀 → 진행 중 라운드는 건너뜀
      P[7] = await conn("guest_m7", true); P[7].on("clm:room", (r) => { last[7] = r; });
      const r7 = await emit(P[7], "clm:rejoin", {});
      ok(r7.ok && r7.room.players.find((p) => p.id === "guest_m7").late, "진행 중 재접속이 건너뛰기 처리 안 됨");
      ok((await emit(P[7], "clm:submit", { round, log: {} })).error === "LATE", "건너뛴 라운드 제출됨");
    }
    const tid = tests[round];
    await Promise.all(P.map((s, i) => {
      if ((round === 2 && i === 7) || (round === 3 && i === 7)) return null;
      const log = tid === "reaction" ? { tr: [200 + i * 25, 210 + i * 25, 220 + i * 25, 205 + i * 25, 230 + i * 25] } : {};
      return emit(s, "clm:submit", { round, log });
    }));
    for (let w = 0; w < 100 && last[0]?.phase !== "result" && last[0]?.phase !== "final"; w++) await sleep(20);
    const rr = last[0].roundResult;
    ok(rr && rr.rows.length === 8 && rr.test === tid, `라운드 ${round} 결과 이상`);
    if (tid === "reaction") ok(rr.rows[0].id === "u_host" && rr.rows[0].rank === 1, "반응속도 순위 이상");
    if (round === 2) ok(rr.rows.find((x) => x.id === "guest_m7").line === "미제출", "끊긴 사람 미제출 처리 안 됨");
  }
  ok(seedsSame, "참가자마다 시드가 다름");
  for (let w = 0; w < 200 && last[0]?.phase !== "final"; w++) await sleep(20);
  const fin = last[0]?.final;
  ok(fin && fin.players.length === 8, "최종 결과 없음");
  ok(fin && fin.report.ranking.length === 8 && fin.report.ranking[0].rank === 1, "최종 순위 없음");
  ok(fin && Object.keys(fin.report.perTest).length === 5 && fin.report.ward, "검사별 순위/병동 없음");
  ok(fin && fin.report.lastRx && fin.report.lastId, "꼴찌 특별 진단 없음");
  ok(fin && !fin.individual, "개인 진단서가 방 전체에 전송됨(개인정보)");
  ok(fin && fin.players.every((x) => x.gender == null && x.age == null && x.diff == null), "다른 참가자에게 성별·나이 노출");
  ok(fin && fin.players.every((x) => x.i18n?.ja?.title && x.i18n?.en?.title), "단체 결과 진단명 다국어 없음");
  ok(last[0].players.every((x) => x.gender == null && x.age == null), "대기실 정보에 성별·나이 노출");
  // 개인 진단서는 본인만 받음
  const mine = await Promise.all([0, 1, 2, 5].map((i) => emit(P[i], "clm:mine", {})));
  ok(mine.every((x) => x.ok && x.result.diag?.title && x.result.rank >= 1 && x.result.of === 8), "개인 진단서 없음");
  ok(mine[2].result.gender === "m" && mine[1].result.age === 24 && mine[0].result.nick === "P0", "프로필 반영 안 됨");
  ok(mine[1].result.nick === "P1" && mine[2].result.nick === "P2", "개인 진단서가 다른 사람 것");
  // 재대결
  ok((await emit(P[0], "clm:rematch", { mode: "full" })).ok, "재대결 실패");
  await sleep(50);
  ok(last[0].phase === "lobby" && last[0].tests.length === 12, "재대결 후 대기실/정밀검사 아님");
  // 방장 나가면 넘어감
  await emit(P[0], "clm:leave", {});
  await sleep(50);
  ok(last[1].host !== "u_host" && last[1].players.length === 7, "방장 나간 뒤 위임 안 됨");
  P.forEach((s) => s.close());
}

io.close(); server.close();
console.log(`\n진단소 시험: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
