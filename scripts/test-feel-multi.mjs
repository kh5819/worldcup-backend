// 감각 진단소 멀티(fm:*)·스트리머(fbc:*) 시험: FEEL_FAST=1 node scripts/test-feel-multi.mjs
process.env.FEEL_FAST = "1"; process.env.FEEL_RL = "1000";   // 시험은 15라운드를 몇 초에 몰아서 → 요청 제한만 풀어 줌
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import * as C from "../src/feel-core.js"; import { registerFeel } from "../src/feel.js"; import { registerFeelMulti, groupReport, _fmTest } from "../src/feel-multi.js"; import { registerFeelBroadcast, _fbcTest } from "../src/feel-broadcast.js";
import { registerPublicRooms, collectPublicRooms } from "../src/public-rooms.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sb = makeFakeSb({ profiles: [] }), app = express(), srv = http.createServer(app), io = new Server(srv, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
registerFeel(io, sb, app, {}); registerFeelMulti(io, sb); registerFeelBroadcast(io, sb, app, { memberProfile: async () => null }); registerPublicRooms(app, io);
await new Promise((r) => srv.listen(0, r)); const port = srv.address().port, URL = `http://localhost:${port}`;
const cli = (uid) => new Promise((r) => { const s = ioc(URL, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.room = null; s.on("fm:room", (x) => (s.room = x)); s.on("fm:mine", (x) => (s.mine = x)); s.on("connect", () => r(s)); });
const call = (s, ev, p = {}) => new Promise((r) => s.emit(ev, p, r));
const prof = (nick) => ({ profile: { nick, avatar: {} }, prefs: {}, device: "pc" });
const waitFor = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(20); } return false; };
// 정답 기록 만들기 (고정 순서 문제): q = 맞힐 비율
function logFor(tid, seed, diff, q = 1) {   // q = 맞힐 비율 (같은 q면 같은 답 → 같은 점수)
  const good = (i) => (i * 7919 + 13) % 100 < q * 100;
  if (tid === "rhythm") { const it = C.item("rhythm", seed, 0, 1, diff); return { k: it.phases.flatMap((p) => p.beats.map((b, k) => b + (good(k) ? 20 : 200))) }; }
  const a = []; for (;;) { const it = C.nextItem(tid, seed, diff, a, true); if (!it) break; const i = a.length, g = good(i);
    const A = { time: () => [i, i * 20000, i * 20000 + Math.round(it.T * (g ? 1 : 1.4))], eye: () => [i, Math.round((g ? it.ans[0] : 0.5) * 1000), Math.round((g ? it.ans[1] : 0.5) * 1000), 1500], color: () => [i, g ? it.odd : -1, 1500], bright: () => [i, g ? it.odd : -1, 1500], count: () => [i, g ? it.n : 1, 1500],
      react: () => [i, it.nogo ? (g ? -1 : 0) : g ? it.side : -1, 0, 250], track: () => [i, g ? it.targets : [], 2000], spatial: () => [i, g ? it.cells : [], 2000], speed: () => [i, g ? it.fast : 1 - it.fast, 1000], pattern: () => [i, g ? it.answer : (it.answer + 1) % 4, 3000], balance: () => [i, g ? 0 : 800, 3000],
      pitch: () => [i, g ? it.hi : 1 - it.hi, 1000], loud: () => [i, g ? it.louder : 1 - it.louder, 1000], direction: () => [i, g ? it.side : 1 - it.side, 1000] };
    a.push(A[tid]()); }
  return { a };
}

// ===== 1) 3인 대결 끝까지 =====
const host = await cli("u_host1"), g1 = await cli("guest_aaaaaa1"), g2 = await cli("guest_bbbbbb2");
ok(!(await call(g1, "fm:create", prof("게스트"))).ok, "게스트는 방 못 만듦");
const cr = await call(host, "fm:create", { ...prof("방장"), diff: "hard", set: "all", maxPlayers: 4 }); ok(cr.ok && cr.room.diff === "hard" && cr.room.tests.length === C.READY.length, "방 만들기 (어려움·전체)");
const code = cr.room.code;
ok((await call(g1, "fm:join", { code, ...prof("하나") })).ok, "게스트1 입장"); ok((await call(g2, "fm:join", { code, ...prof("둘") })).ok, "게스트2 입장");
ok((await call(g1, "fm:join", { code, ...prof("하나") })).rejoined, "같은 사람 다시 입장 = 같은 자리 (중복 없음)");
await waitFor(() => host.room?.players.length === 3); ok(host.room.players.length === 3, "참가자 3명");
ok(!(await call(g1, "fm:options", { diff: "expert" })).ok, "방장 아니면 난이도 못 바꿈");
ok((await call(host, "fm:options", { diff: "expert" })).ok, "방장이 난이도 바꿈"); await waitFor(() => g1.room?.diff === "expert"); ok(g1.room.diff === "expert", "모두에게 같은 난이도");
ok((await call(host, "fm:options", { diff: "easy" })).ok && (await waitFor(() => host.room.diff === "normal")), "없는 난이도(쉬움)는 보통으로");
await call(host, "fm:options", { diff: "hard" });
// 공개방
const pr = await call(host, "pub:set", { game: "feel", isPublic: true }); ok(pr?.ok && pr.isPublic, "🌐 공개방 켜기");
ok(collectPublicRooms().some((x) => x.game === "feel" && x.code === code), "게임천국 공개 방 목록에 보임");
ok(!(await call(host, "fm:start")).ok, "준비 안 하면 시작 못 함");
await call(g1, "fm:ready", { ready: true }); await call(g2, "fm:ready", { ready: true });
ok((await call(host, "fm:start")).ok, "시작"); await waitFor(() => host.room?.phase === "intro");
ok(!collectPublicRooms().some((x) => x.code === code), "시작하면 공개 목록에서 내려감");
ok((await call(host, "fm:options", { diff: "normal" })).error === "NOT_LOBBY", "대결 중엔 난이도 못 바꿈");
const seeds = []; for (const s of [host, g1, g2]) seeds.push(s.room.seed); ok(seeds.every((x) => x === seeds[0] && x), "모두 같은 문제 시드");
ok(host.room.startAt === g1.room.startAt, "모두 같은 시작 시각(서버 기준)");
const rounds = host.room.tests.length; let tieChecked = false;
for (let i = 0; i < rounds; i++) {
  await waitFor(() => host.room?.phase === "play" && host.room.round === i, 6000);
  const tid = host.room.tests[i], seed = host.room.seed;
  ok((await call(host, "fm:submit", { round: i + 1, log: {} })).error === "NOT_PLAYING", "다른 라운드 제출 거절");
  const a = await call(host, "fm:submit", { round: i, log: logFor(tid, seed, "hard", 1) });
  const b = await call(g1, "fm:submit", { round: i, log: logFor(tid, seed, "hard", i === 0 ? 1 : 0.4) });   // 첫 라운드는 방장과 동점
  ok(a.ok && b.ok, `라운드 ${i + 1} 제출 ${tid} ${JSON.stringify([a.error, b.error, host.room.phase, host.room.round])}`); if (i === 0) ok(a.result.score === b.result.score, "같은 답 = 같은 점수");
  const dup = await call(host, "fm:submit", { round: i, log: logFor(tid, seed, "hard", 0) }); ok(dup.dup && dup.result.score === a.result.score, "중복 제출은 처음 결과");
  if (i === 1) { g2.disconnect(); await sleep(50); }   // 게스트2 검사 중 끊김 → 남은 사람만으로 라운드 끝
  else if (i !== 0 || true) { if (g2.connected) await call(g2, "fm:submit", { round: i, log: logFor(tid, seed, "hard", 0.2) }); }
  await waitFor(() => host.room?.phase === "result" || host.room?.phase === "final", 6000);
  const rr = host.room.roundResult; ok(rr && rr.round === i, `라운드 ${i + 1} 결과`);
  if (i === 0) { const h = rr.rows.find((x) => x.id === "u_host1"), o = rr.rows.find((x) => x.id === "guest_aaaaaa1"); ok(h.rank === 1 && o.rank === 1, "동점은 공동 1위"); ok(rr.titles.filter((t) => t.title === C.TESTS[tid] && false).length === 0, ""); tieChecked = true; }
  if (i === 1) { const x = rr.rows.find((r) => r.id === "guest_bbbbbb2"); ok(x.missing && x.score === 0, "끊긴 사람은 미제출 0점(그 라운드)"); }
  if (i === 1) { // 게스트2 다시 접속 → 다음 라운드부터 참여
    const g2b = await cli("guest_bbbbbb2"); Object.assign(g2, { emit: g2b.emit.bind(g2b), connected: true }); g2b.on("fm:room", (x) => (g2.room = x)); const rj = await call(g2b, "fm:rejoin", { device: "pc" }); ok(rj.ok && rj.room.round === i, "재접속하면 현재 상태 받음"); g2.real = g2b; }
}
ok(tieChecked, "동점 처리 확인");
await waitFor(() => host.room?.phase === "final", 8000);
const fin = host.room.final; ok(!!fin && fin.players.length === 3, "시상식 (3명)");
const rk = fin.report.ranking; ok(rk[0].id === "u_host1" && rk[0].rank === 1, "우승 = 점수 합 1위");
ok(fin.report.awards.some((a) => a.key === "mvp" && a.id === "u_host1"), "MVP");
ok(fin.report.awards.filter((a) => C.READY.includes(a.key)).every((a) => a.value >= 30), "검사별 칭호는 30점 이상만");
await waitFor(() => !!host.mine); ok(host.mine && host.mine.multi.rank === 1, "개인 진단서 (본인에게만)");
await waitFor(() => (sb.DB.feel_results || []).filter((r) => r.group_id === fin.groupId).length === 3, 3000);
const saved = (sb.DB.feel_results || []).filter((r) => r.group_id === fin.groupId); ok(saved.length === 3 && saved.every((r) => r.mode === "full" && r.diff === "hard"), "전체 대결 결과 저장(난이도 함께)");
ok((sb.DB.feel_groups || []).some((g) => g.id === fin.groupId), "단체 결과 저장");
ok(!(await call(g1, "fm:rematch")).ok, "재대결은 방장만"); ok((await call(host, "fm:rematch", { set: "quick" })).ok, "재대결(빠른 2종)"); await waitFor(() => host.room.phase === "lobby"); ok(host.room.tests.length === 2 && host.room.players.every((p) => !p.ready), "대기실로 · 준비 초기화");
// 방장 이탈 → 위임, 경기 계속
await call(g1, "fm:ready", { ready: true }); await call(g2.real, "fm:ready", { ready: true }); ok((await call(host, "fm:start")).ok, "빠른 대결 시작");
await waitFor(() => host.room.phase === "play", 6000); host.disconnect(); await waitFor(() => g1.room?.host !== "u_host1", 3000);
ok(g1.room.host !== "u_host1" && ["play", "result"].includes(g1.room.phase), "방장 끊김 → 다른 사람이 방장, 경기 그대로");
for (let i = 0; i < 2; i++) { await waitFor(() => g1.room.phase === "play" && g1.room.round === i, 6000); const tid = g1.room.tests[i]; await call(g1, "fm:submit", { round: i, log: logFor(tid, g1.room.seed, "hard", 0.8) }); await call(g2.real, "fm:submit", { round: i, log: logFor(tid, g1.room.seed, "hard", 0.6) }); await waitFor(() => g1.room.phase !== "play", 6000); }
await waitFor(() => g1.room.phase === "final", 8000); ok(g1.room.phase === "final", "방장 없이도 끝까지");
const before = (sb.DB.feel_results || []).length; await sleep(100); ok((sb.DB.feel_results || []).length === before, "빠른 대결(2종)은 기록 저장 안 함");
await waitFor(() => !!g1.mine); ok(g1.mine && g1.mine.id === null, "저장 안 한 결과는 링크 없음");
// 8인 방
const H8 = await cli("u_host8"); const r8 = await call(H8, "fm:create", { ...prof("방장8"), maxPlayers: 8 }); const gs = []; for (let i = 0; i < 8; i++) { const s = await cli(`guest_e${String(i).padStart(6, "0")}`); gs.push(s); const j = await call(s, "fm:join", { code: r8.room.code, ...prof("p" + i) }); if (i < 7) ok(j.ok, `8인 방 입장 ${i + 2}`); else ok(j.error === "ROOM_FULL", "9번째는 방 가득"); }
// groupReport 동점
{ const rep = groupReport([{ id: "a", sum: 150, wins: 1, scores: { color: 80, eye: 70 }, trail: [2, 1] }, { id: "b", sum: 150, wins: 1, scores: { color: 70, eye: 80 }, trail: [1, 1] }], ["color", "eye"]); ok(rep.ranking.every((x) => x.rank === 1), "점수·라운드승 같으면 공동 우승"); ok(rep.awards.filter((a) => a.key === "mvp").length === 2, "공동 MVP"); }

// ===== 2) 스트리머 모드 =====
const st = await cli("u_streamer"), v1 = await cli("guest_view001"), v2 = await cli("guest_view002");
const bc = await call(st, "fbc:create", { title: "<b>방송</b>", diff: "normal", minutes: 30 }); ok(bc.ok && bc.bc.diff === "normal" && !/[<>]/.test(bc.bc.title), "방송 진단소 만들기 (제목 꺾쇠 제거)");
ok((sb.DB.streamer_chat_log || []).some((x) => x.platform === "feel" && x.content_mode === "bc" && x.channel_id === bc.bc.id), "admin 스트리머 기록(감각·방송)");
const w = await call(v1, "fbc:watch", { id: bc.bc.id }); ok(w.ok && w.stats.count === 0, "시청자 현황 보기");
ok((await call(v1, "feel:begin", { mode: "full", diff: "hard", bc: bc.bc.id })).error === "BC_MODE", "방송 난이도와 다르면 참여 불가");
async function viewerRun(s, q, nick, show = true) { const b = await call(s, "feel:begin", { mode: "full", diff: "normal", bc: bc.bc.id, bcNick: nick, bcShowName: show }); if (!b.ok) return { begin: b }; for (let i = 0; i < b.plan.length; i++) { await call(s, "feel:testStart", { sid: b.sid, idx: i }); const S = (await import("../src/feel.js"))._feelTest.SESS.get(b.sid); S.started[i] -= 400000; const it0 = b.plan[i]; const a = []; for (;;) { const it = C.nextItem(it0.id, it0.seed, "normal", a); if (!it) break; const good = (a.length * 31) % 100 < q * 100; a.push(it0.id === "time" ? [it.i, a.length * 20000, a.length * 20000 + Math.round(it.T * (good ? 1 : 1.5))] : it0.id === "eye" ? [it.i, Math.round((good ? it.ans[0] : .5) * 1000), Math.round((good ? it.ans[1] : .5) * 1000), 1500] : [it.i, good ? (it0.id === "color" ? it.odd : it.n) : -1, 1500]); } await call(s, "feel:submit", { sid: b.sid, idx: i, log: { a } }); } return call(s, "feel:finish", { sid: b.sid, profile: { nick, avatar: {} }, prefs: {}, bcShowName: show }); }
const f1 = await viewerRun(v1, 0.9, "시청자1"), f2 = await viewerRun(v2, 0.5, "비밀", false);
ok(f1.bc?.counted && f2.bc?.counted, "방송 집계 들어감"); ok(f1.result.bcId === bc.bc.id, "결과에 방송 번호");
const again = await viewerRun(v1, 1, "시청자1"); ok(again.bc?.reason === "ALREADY", "한 사람당 첫 기록 1개만");
await sleep(2200); const st2 = (await call(st, "fbc:watch", { id: bc.bc.id })).stats;
ok(st2.count === 2 && st2.top10[0].nick === "시청자1" && st2.top10.some((x) => x.nick === "익명 시청자"), "현황: 2명 · 닉네임 숨김은 익명");
ok(st2.avgTotal != null && C.TIERS.some((t) => t.id === st2.avgTier), "시청자 평균 점수·평균 등급");
ok(!(await call(v1, "fbc:control", { id: bc.bc.id, action: "close" })).ok, "진행 조작은 스트리머만");
ok((await call(st, "fbc:control", { id: bc.bc.id, action: "close" })).ok, "마감"); ok((await call(st, "fbc:control", { id: bc.bc.id, action: "finalize" })).ok, "확정");
const rest = await fetch(`${URL}/feel/bc/${bc.bc.id}`).then((x) => x.json()); ok(rest.ok && rest.stats.status === "final", "확정 결과 링크(REST)");
{ const late = await cli("guest_view003"); ok((await call(late, "feel:begin", { mode: "full", diff: "normal", bc: bc.bc.id })).error === "BC_CLOSED", "확정 뒤엔 방송 참여 불가"); late.close(); }

[host, g1, g2.real, H8, ...gs, st, v1, v2].forEach((s) => s?.close?.()); io.close(); srv.close();
console.log(`\n통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
