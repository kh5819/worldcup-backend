// 게임 센스 8인 멀티 서버 시험: node scripts/test-sense-multi.mjs
process.env.SENSE_FAST = "1"; process.env.SENSE_RL = "100000";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import { registerSenseMulti, _smTest, groupReport } from "../src/sense-multi.js"; import * as C from "../src/sense-core.js"; import { play } from "./sense-bots.mjs"; import { makeFakeSb } from "./mind-fake-sb.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sb = makeFakeSb({ profiles: [{ id: "u_host", nickname: "방장닉", avatar_url: null }] });
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_"), isAdmin: false }; n(); });
registerSenseMulti(io, sb);
await new Promise((r) => server.listen(0, r)); const URLB = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URLB, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.room = null; s.mine = null; s.on("sm:room", (r) => (s.room = r)); s.on("sm:mine", (m) => (s.mine = m)); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const PROF = (nick, i) => ({ nick, age: 20 + i, avatar: { skin: 0, hc: 1, hs: i % 10, shirt: i, pants: 1, hat: 0 } });
const POL = ["good", "good", "rnd", "spam", "good", "rnd", "idle", "good"];

// 1) 방 만들기·입장·권한
const host = await conn("u_host"); const g0 = await conn("guest_zzzzzzzz");
ok((await emit(g0, "sm:create", { profile: PROF("게스트", 0) })).error === "GUEST_CANNOT_CREATE", "게스트는 방 못 만듦");
const c = await emit(host, "sm:create", { mode: "quick", profile: PROF("가짜닉", 0), device: "pc" }); ok(c.ok && c.room.code, "방 생성"); ok(c.room.players[0].nick === "방장닉", "회원 닉 = 프로필");
const code = c.room.code; const P = [host];
for (let i = 1; i < 8; i++) { const s = await conn(`guest_p${i}xxxxxx`); const j = await emit(s, "sm:join", { code, profile: PROF(`플레이어${i}`, i), device: i % 2 ? "mobile" : "pc" }); ok(j.ok, `입장 ${i}`); P.push(s); }
const extra = await conn("guest_extra000"); ok((await emit(extra, "sm:join", { code, profile: PROF("9번", 9) })).error === "ROOM_FULL", "9번째는 가득 참");
ok((await emit(extra, "sm:join", { code: "000000x", profile: PROF("x", 1) })).error === "NO_ROOM", "없는 코드");
ok((await emit(P[1], "sm:start", {})).error === "NOT_HOST", "방장만 시작");
ok((await emit(host, "sm:start", {})).error === "NOT_READY", "준비 안 됐으면 시작 불가");
ok((await emit(P[1], "sm:options", { mode: "full" })).error === "NOT_HOST", "방장만 설정");
ok((await emit(host, "sm:options", { mode: "quick", maxPlayers: 8 })).ok, "방장 설정");
for (const s of P.slice(1)) await emit(s, "sm:ready", { ready: true });
await sleep(100); ok(host.room.players.filter((p) => p.ready).length === 7, "7명 준비");
ok((await emit(host, "sm:start", {})).ok, "시작");
await sleep(50); ok(host.room.phase === "intro" && host.room.seed != null, "설명 단계 + 같은 시드");
ok((await emit(extra, "sm:join", { code, profile: PROF("늦음", 1) })).error === "ALREADY_STARTED", "시작 후 입장 불가");
// 2) 라운드 진행: 각자 정책대로 기록 제출 (5번은 한 라운드에서 끊겼다 재접속)
const tests = host.room.tests; let dropped = false;
for (let rd = 0; rd < tests.length; rd++) {
  for (let k = 0; k < 400 && host.room.phase !== "play"; k++) await sleep(20);
  ok(host.room.phase === "play" && host.room.round === rd, `라운드 ${rd + 1} 시작`);
  const seed = host.room.seed, spec = C.genSpec(tests[rd], seed);
  ok(P.every((s) => s.room.seed === seed), "모두 같은 문제");
  if (rd === 1 && !dropped) { dropped = true; P[5].disconnect(); await sleep(50); P[5] = await conn("guest_p5xxxxxx"); const rj = await emit(P[5], "sm:join", { code }); ok(rj.ok && rj.rejoined, "재접속"); ok((await emit(P[5], "sm:submit", { round: rd, log: {} })).error === "LATE", "진행 중 재접속은 그 검사 건너뜀"); }
  for (let i = 0; i < 8; i++) { if (rd === 1 && i === 5) continue; const r = await emit(P[i], "sm:submit", { round: rd, log: play(tests[rd], spec, POL[i], C.rng(i + rd)) }); ok(r.ok, `제출 ${i}`); if (i === 0) { const d = await emit(P[i], "sm:submit", { round: rd, log: {} }); ok(d.dup && d.result.score === r.result.score, "중복 제출 = 처음 결과"); } }
  for (let k = 0; k < 400 && host.room.phase === "play"; k++) await sleep(20);
  ok(host.room.phase === "result" || host.room.phase === "final" || host.room.phase === "intro", `라운드 ${rd + 1} 결과`);
  if (host.room.phase === "result") { const rr = host.room.roundResult; ok(rr.rows.length === 8 && rr.rows.every((x, i, a) => !i || a[i - 1].score >= x.score), "라운드 순위 정렬"); }
}
for (let k = 0; k < 600 && host.room.phase !== "final"; k++) await sleep(20);
await sleep(200);
// 3) 최종·시상식·저장
const f = host.room.final; ok(host.room.phase === "final" && f, "최종 결과");
ok(f.players.length === 8 && f.report.awards.some((a) => a.key === "mvp") && f.report.awards.length >= 7, "시상식 (MVP·능력별·꾸준함)");
const tot = Object.fromEntries(f.players.map((p) => [p.nick, p.total])); console.log("  총점", JSON.stringify(tot));
ok(f.players.find((p) => p.nick === "방장닉").total > f.players.find((p) => p.nick === "플레이어6").total, "잘한 사람 > 가만히 있은 사람");
ok(f.players.find((p) => p.nick === "플레이어1").total > f.players.find((p) => p.nick === "플레이어3").total, "잘한 사람 > 연타한 사람");
ok(P.every((s) => s.mine?.id && s.mine.total != null), "8명 모두 개인 진단서");
ok(!JSON.stringify(host.room).includes("owner_key"), "소유 키 안 보냄");
ok(sb.DB.sense_results.length === 8 && sb.DB.sense_groups.length === 1, "결과 8개 + 단체 1개 저장");
ok(sb.DB.sense_results.every((r) => r.group_id === f.groupId && r.mode === "quick"), "단체 기록 연결");
ok(f.report.awards.some((a) => a.title === "최고의 전략가") && f.report.awards.some((a) => a.title === "미니맵 수호자"), "특별상 (실제 기록 기준)");
ok(host.room.roundResult?.titles?.length >= 1 && host.room.roundResult.overall.every((x) => Number.isFinite(x.delta)), "라운드 칭호·순위 변동");
// 4) 재대결
ok((await emit(P[2], "sm:rematch", {})).error === "NOT_HOST", "재대결은 방장만");
ok((await emit(host, "sm:rematch", { mode: "full" })).ok, "재대결"); await sleep(50); ok(host.room.phase === "lobby" && host.room.tests.length === 15, "대기실로·정밀검사");
{ await emit(P[1], "sm:leave", {}); const nb = await conn("guest_newbie1"); const j = await emit(nb, "sm:join", { code, profile: PROF("새친구", 3) }); ok(j.ok, "새 참가자"); const pl = j.room.players.find((p) => p.nick === "새친구"); ok(pl && pl.best === null, "기록 없는 사람은 최고 티어 없음"); await emit(nb, "sm:leave", {}); const old = await conn("guest_p1xxxxxx"); const j2 = await emit(old, "sm:join", { code, profile: PROF("플레이어1", 1) }); ok(j2.ok && j2.room.players.find((p) => p.nick === "플레이어1")?.best?.tier, "다시 들어온 사람은 이전 최고 티어 표시"); P.push(nb, old); }
// 5) 나가기·방장 넘김
await emit(host, "sm:leave", {}); await sleep(50); ok(P[2].room.host !== "u_host" && P[2].room.players.length === 7, "방장 나가면 넘김");
// 6) 시상식 계산 단독
{ const ppl = [{ id: "a", total: 900, areas: { situ: 90 }, scores: { minimap: 90, engage: 90 } }, { id: "b", total: 500, areas: { situ: 40 }, scores: { minimap: 10, engage: 90 } }]; const rep = groupReport(ppl, ["minimap", "engage"]); ok(rep.ranking[0].id === "a" && rep.awards.find((x) => x.key === "steady").id === "a", "시상식 계산"); }
console.log(`\n통과 ${pass} · 실패 ${fail}`);
[...P, g0, extra].forEach((s) => s.close()); server.close(); process.exit(fail ? 1 : 0);
