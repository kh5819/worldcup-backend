// 감각 진단소 시험: node scripts/test-feel.mjs
// 1) 채점 파일 화면·서버 동일  2) 문제 생성 유효성  3) 난이도 3단계 차이  4) 찍기·연타·같은 답 방지  5) 소켓 흐름(가짜 DB)
import fs from "fs"; import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import * as C from "../src/feel-core.js"; import { registerFeel, _feelTest } from "../src/feel.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
const R = Math.random;

// 1)
ok(fs.readFileSync("src/feel-core.js", "utf8") === fs.readFileSync("../홈페이지 제작/js/feel/feel-core.js", "utf8"), "feel-core 화면·서버 파일이 다름");
ok(C.DIFF_IDS.join() === "normal,hard,expert", "난이도는 보통·어려움·전문가 3개만");
ok(C.TEST_IDS.length === 15, "검사 15종 목록");
ok(C.READY.length === 15, "검사 15종 모두 열림");
ok(C.READY.every((t) => C.nTrials(t) >= 1 && C.nTrials(t) <= 5), "검사마다 3~5번 (리듬은 한 곡): " + C.READY.map((t) => t + C.nTrials(t)).join(" "));

// 2) 문제 생성: 모든 단계·난이도에서 정답 존재·범위 안
for (const d of C.DIFF_IDS) for (let seed = 1; seed < 16; seed++) {
  for (let L = 1; L <= 20; L++) {
    const c = C.item("color", seed, L % 7, L, d); ok(c.odd >= 0 && c.odd < c.n * c.n && c.n >= 5 && c.n <= 8, `color 정답 칸 ${seed}/${L}`); ok(C.colorOf(c, true) !== C.colorOf(c, false) || c.dE < 0.012, `color 색이 같음 ${seed}/${L} ${c.dE}`);
    const k = C.item("count", seed, L % 5, L, d); ok(k.n === k.dots.length && Math.abs(k.n - C.countN(L)) <= 2, `count 점 개수 ${seed}/${L} ${k.n}/${C.countN(L)}`); ok(k.show >= 500 && k.show <= 2000, "count 표시 0.5~2초");
    for (let a = 0; a < k.dots.length; a++) for (let b = a + 1; b < k.dots.length; b++) { const p = k.dots[a], q = k.dots[b]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) < p[2] + q[2]) { ok(false, `count 점 겹침 ${seed}/${L}`); } }
  }
  for (let i = 0; i < 5; i++) { const e = C.item("eye", seed, i, 1, d); ok(e.ans.every((v) => v > 0 && v < 1), `eye 정답 범위 ${e.k}`); ok(C.eyeErr(e, e.ans[0], e.ans[1]) < 0.01, `eye 정답 위치 오차 0 ${e.k}`); }
  const ks = new Set(Array.from({ length: 5 }, (_, i) => C.item("eye", seed, i, 1, d).k)); ok(ks.size === 5, "eye 5번 모두 다른 종류");
  ok(Array.from({ length: 3 }, (_, i) => C.item("time", seed, i, 1, d).T).every((T) => T === C.TIME_TARGET[d] * 1000), "time 난이도별 목표 5·10·15초");
}
ok(C.colorGrid(C.DIFFS.normal.start) === 5, "보통 색 구분 5×5부터 시작");
// 새 검사 11종 문제 유효성
for (const d of C.DIFF_IDS) for (let seed = 1; seed < 40; seed++) {
  for (let i = 0; i < 5; i++) { const b = C.item("bright", seed, i, 2 + ((seed + i) % 19), d); ok(b.odd >= 0 && b.odd < b.n * b.n && (b.oddc[0] + b.oddc[1] + b.oddc[2] >= b.base[0] + b.base[1] + b.base[2]), "bright: 다른 칸이 더 밝음(같거나)"); }
  for (let i = 0; i < 5; i++) { const r = C.item("react", seed, i, 1, d); ok(r.wait >= 1200 && r.wait <= 3500 && r.side >= 0, "react 대기 1.2~3.5초"); }
  for (let i = 0; i < 4; i++) { const t = C.item("track", seed, i, 1, d); ok(t.targets.length === C.TRACK[d].k && t.balls.length === C.TRACK[d].n, "track 공·목표 수");
    const end = t.balls.map((b) => C.trackPos(b, t.T)); ok(end.every((p) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1), "track 화면 안"); let close = false; for (let a = 0; a < end.length; a++) for (let c = a + 1; c < end.length; c++) if (Math.hypot(end[a][0] - end[c][0], end[a][1] - end[c][1]) < (t.balls[0].r) * 2.3) close = true; ok(!close, "track 마지막에 공이 안 겹침"); }
  for (let i = 0; i < 4; i++) { const sp = C.item("spatial", seed, i, 1, d); ok(new Set(sp.cells).size === sp.k && sp.cells.every((c) => c < sp.g * sp.g), "spatial 칸 중복 없음"); }
  for (let i = 0; i < 5; i++) { const v = C.item("speed", seed, i, 1, d); ok(v.objs[v.fast].v > v.objs[1 - v.fast].v, "speed 정답이 실제로 더 빠름"); }
  for (let i = 0; i < 4; i++) { const pt = C.item("pattern", seed, i, 1, d), key = (a) => [a.shape, a.col, a.rot, a.size].join(); ok(new Set(pt.choices.map(key)).size === 4, "pattern 보기 4개 서로 다름"); ok(pt.choices[pt.answer] && pt.seq.length === 5, "pattern 정답 하나"); }
  for (let i = 0; i < 4; i++) { const bl = C.item("balance", seed, i, 1, d); ok(Math.abs(bl.start) >= 3 && Math.abs(bl.start) <= 15, "balance 처음 기울기 3~15°"); }
  for (let i = 0; i < 5; i++) { ok(C.item("pitch", seed, i, 1, d).c === C.PITCH_C[d][i] && [0, 1].includes(C.item("loud", seed, i, 1, d).louder) && [0, 1].includes(C.item("direction", seed, i, 1, d).side), "소리 3종 문제"); }
  const rh = C.item("rhythm", seed, 0, 1, d); ok(rh.phases.length === 2 && rh.phases.every((p) => p.beats.length === C.RHYTHM[d].snd + C.RHYTHM[d].sil), "rhythm 2단계");
}
// 재생 순서가 무작위여도 정답 계산: 음 높이 1번/2번 둘 다 나옴
{ const his = new Set(Array.from({ length: 40 }, (_, s2) => C.item("pitch", s2, 0, 1, "normal").hi)); ok(his.size === 2, "음 높이 정답 위치 무작위"); }

// 3) 난이도 차이 + 4) 꼼수 — 검사 15종 모두
const play = (tid, diff, f, seed = 777) => { if (tid === "rhythm") return C.scoreTest(tid, C.genSpec(tid, seed, diff), f(C.item("rhythm", seed, 0, 1, diff))).score; const a = []; for (;;) { const it = C.nextItem(tid, seed, diff, a); if (!it) break; a.push(f(it, a.length)); } return C.scoreTest(tid, C.genSpec(tid, seed, diff), { a }).score; };
const avgOf = (n, fn) => { let s = 0; for (let i = 0; i < n; i++) s += fn(i); return s / n; };
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// "같은 실력" 사람 모형: 감각 임계값(이만큼 차이 나면 구분)·오차를 정해 두고 세 난이도를 풀게 함
const sig = (x, th) => R() < 1 / (1 + Math.exp(-(x / th - 1) * 3));   // 차이 x가 임계 th보다 클수록 맞힐 확률↑
const M = {
  color: (it, i) => [i, sig(it.dE * 100, 2.5) ? it.odd : (it.odd + 1) % (it.n * it.n), 1800],
  bright: (it, i) => [i, sig(it.dL * 100, 1.2) ? it.odd : (it.odd + 1) % (it.n * it.n), 1800],
  count: (it, i) => [i, it.n <= 10 + it.show / 250 ? it.n : Math.round(it.n * (0.85 + R() * 0.3)), 2500],
  eye: (it, i) => { let x = it.ans[0], y = it.ans[1]; if (it.k === "angle") { const a = it.r2 + it.sgn * (it.ang + gauss() * 0.07); x = it.B[0] + Math.cos(a) * it.len; y = it.B[1] + Math.sin(a) * it.len; } else if (it.k === "size") { const rr = it.rad * (1 + gauss() * 0.06); x = it.B[0] + rr; y = it.B[1]; } else { x += gauss() * 0.04 * it.scale; y += gauss() * 0.04 * it.scale; } return [i, Math.round(x * 1000), Math.round(y * 1000), 2000]; },
  time: (() => { let t = 0; return (it, i) => { if (i === 0) t = 0; const st = t + 800, d = it.T * (1 + gauss() * 0.08); t = st + d; return [i, Math.round(st), Math.round(st + d)]; }; })(),
  react: (it, i) => { const base = it.kind === "simple" ? 260 : it.kind === "choice" ? 360 : 420, rt = base + gauss() * 40; if (it.nogo) return [i, R() < 0.8 ? -1 : 0, 0, 400]; return [i, R() < 0.95 ? it.side : (it.side + 1) % 2, 0, Math.round(rt)]; },
  track: (it, i) => { const cap = 2.2 - (it.balls.length - 5) * 0.12; const picks = it.targets.map((t, k) => (k < cap || R() < 0.3 ? t : (t + 1) % it.balls.length)); return [i, picks, 3000]; },
  spatial: (it, i) => { const cap = it.order ? 4 : 5.5; const picks = it.cells.map((c, k) => (k < cap ? c : (c + 3) % (it.g * it.g))); return [i, picks, 4000]; },
  speed: (it, i) => [i, sig(it.d * 100, 12) ? it.fast : 1 - it.fast, 1500],
  pattern: (it, i) => [i, R() < [0.95, 0.7, 0.45][it.vary.length - 1] ? it.answer : (it.answer + 1) % 4, 6000],
  balance: (it, i) => [i, Math.round(gauss() * 1.0 * 100), 6000],
  pitch: (it, i) => [i, sig(it.c, 18) ? it.hi : 1 - it.hi, 1200],
  loud: (it, i) => [i, sig(it.db, 1.0) ? it.louder : 1 - it.louder, 1200],
  direction: (it, i) => [i, sig(it.db, 1.2) ? it.side : 1 - it.side, 1200],
  rhythm: (it) => ({ k: it.phases.flatMap((p) => p.beats.map((b, k) => Math.round(b + 60 + gauss() * (k < p.snd ? 35 : 35 + (k - p.snd) * 12)))) }),
};
for (const t of C.READY) {
  const sc = C.DIFF_IDS.map((d) => avgOf(30, (k) => play(t, d, M[t], 100 + k)));
  console.log(`  ${t} 같은 실력 → 보통 ${sc[0].toFixed(0)} · 어려움 ${sc[1].toFixed(0)} · 전문가 ${sc[2].toFixed(0)}`);
  ok(sc[0] > sc[1] + 4 && sc[1] > sc[2] + 2, `${t} 난이도가 올라갈수록 같은 실력의 점수가 낮아야 함 ${sc.map((x) => x.toFixed(0))}`);
  ok(sc[2] > 3, `${t} 전문가도 풀 수 있어야 함 ${sc[2].toFixed(0)}`);
  if (sc[0] >= 97) console.log(`  (참고) ${t}: 잘하는 사람 모형은 보통에서 거의 만점 ${sc[0].toFixed(0)}`);
}
// 찍기·연타·같은 답·0ms — 모두 낮은 점수
const CHEAT = {
  rand: { color: (it, i) => [i, Math.floor(R() * it.n * it.n), 300], bright: (it, i) => [i, Math.floor(R() * it.n * it.n), 300], count: (it, i) => [i, 15, 900], eye: (it, i) => [i, Math.round(R() * 1000), Math.round(R() * 1000), 400], time: () => [0, 0, 0], react: (it, i) => [i, 0, 1, 0], track: (it, i) => [i, Array.from({ length: it.k }, () => Math.floor(R() * it.balls.length)), 300], spatial: (it, i) => [i, Array.from({ length: it.k }, () => Math.floor(R() * it.g * it.g)), 300], speed: (it, i) => [i, Math.floor(R() * 2), 300], pattern: (it, i) => [i, Math.floor(R() * 4), 300], balance: (it, i) => [i, Math.round((R() - 0.5) * 3000), 300], pitch: (it, i) => [i, Math.floor(R() * 2), 300], loud: (it, i) => [i, Math.floor(R() * 2), 300], direction: (it, i) => [i, Math.floor(R() * 2), 300], rhythm: () => ({ k: Array.from({ length: 300 }, (_, k) => k * 70) }) },
  same: { color: (it, i) => [i, 0, 50], bright: (it, i) => [i, 0, 50], count: (it, i) => [i, 10, 50], eye: (it, i) => [i, 500, 500, 50], time: (it, i) => [i, i * 1000, i * 1000 + 50], react: (it, i) => [i, 0, 0, 0], track: (it, i) => [i, [0, 1, 2].slice(0, it.k), 50], spatial: (it, i) => [i, [0, 1, 2, 3, 4, 5, 6].slice(0, it.k), 50], speed: (it, i) => [i, 0, 50], pattern: (it, i) => [i, 0, 50], balance: (it, i) => [i, 1000, 50], pitch: (it, i) => [i, 0, 50], loud: (it, i) => [i, 0, 50], direction: (it, i) => [i, 0, 50], rhythm: () => ({ k: [] }) },
};
for (const d of C.DIFF_IDS) for (const t of C.READY) {
  const r = avgOf(40, (k) => play(t, d, CHEAT.rand[t], k)), sm = avgOf(20, (k) => play(t, d, CHEAT.same[t], k));
  ok(r < 25, `${t} ${d} 찍기·연타 평균 ${r.toFixed(1)}`); ok(sm < 30, `${t} ${d} 같은 답만 ${sm.toFixed(1)}`);
  for (let k = 0; k < 6; k++) { const v = play(t, d, CHEAT.rand[t], 900 + k); ok(v >= 0 && v <= 100, "점수 0~100"); }
}
// 적응형이 실제로 움직임: 잘하는 사람은 단계가 오르고, 다 틀리면 구간 바닥에 머묾
{ const a = []; for (let i = 0; i < 4; i++) { const it = C.nextItem("color", 5, "normal", a); a.push([i, it.odd, 1500]); } ok(C.nextItem("color", 5, "normal", a).L === C.DIFFS.normal.hi, "다 맞히면 보통 최고 단계(구간 위)까지만 (한 번에 +2)");
  const b = []; for (let i = 0; i < 4; i++) { const it = C.nextItem("color", 5, "hard", b); b.push([i, -1, 1500]); } ok(C.nextItem("color", 5, "hard", b).L === C.DIFFS.hard.lo, "다 틀려도 어려움 구간 아래로는 안 내려감"); }
// 결정적: 같은 답 = 같은 점수
{ const a = []; for (let i = 0; i < 5; i++) { const it = C.nextItem("color", 9, "hard", a); a.push([i, i % 3 ? it.odd : 0, 1000 + i * 37]); } ok(C.scoreTest("color", C.genSpec("color", 9, "hard"), { a }).score === C.scoreTest("color", C.genSpec("color", 9, "hard"), { a: JSON.parse(JSON.stringify(a)) }).score, "같은 기록 같은 점수"); }
// 종합: 미측정 제외 · 유형 · 등급
{ const d = C.diagnose({ scores: { color: 80, eye: 60 } }); ok(d.done === 2 && d.style.id === "scouting", "검사 2개면 '탐색 중' 유형"); ok(C.totalOf({ color: 80 }) === C.totalOf({ color: 80, time: undefined }), "미측정은 0점 처리 안 함");
  ok(C.diagnose({ scores: { color: 99, eye: 99, time: 99, count: 99 } }).tier.id === "SSS", "평균 99 → SSS"); ok(C.diagnose({ scores: { color: 90, eye: 90, time: 90, count: 90 } }).tier.id !== "SSS", "평균 90은 SSS 아님"); }

// 5) 소켓 흐름
const sb = makeFakeSb({ profiles: [] }), app = express(), srv = http.createServer(app), io = new Server(srv, { allowEIO3: true });
io.use((s, n) => { s.user = { id: String(s.handshake.query.uid), isGuest: true }; n(); }); registerFeel(io, sb, app, {});
process.env.FEEL_DEV_TIME = ""; await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
const cli = (gid) => new Promise((r) => { const s = ioc(`http://localhost:${port}`, { query: { uid: gid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => r(s)); });
const call = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const prof = { nick: "시험<b>", avatar: {} };
const s1 = await cli("guest_aaaaaaa1"), s2 = await cli("guest_bbbbbbb2");
let b = await call(s1, "feel:begin", { mode: "full", diff: "hard", device: "pc" }); ok(b.ok && b.plan.length === C.READY.length && b.diff === "hard", "begin full (15종)");
ok(!(await call(s1, "feel:submit", { sid: b.sid, idx: 1, log: {} })).ok, "순서 건너뛰기 막음");
ok(!(await call(s2, "feel:testStart", { sid: b.sid, idx: 0 })).ok, "남의 세션 막음");
await call(s1, "feel:testStart", { sid: b.sid, idx: 0 });
const pl = b.plan; const fakeLog = (tid, seed, diff) => { const a = []; for (;;) { const it = C.nextItem(tid, seed, diff, a); if (!it) break; a.push(tid === "time" ? [it.i, a.length * 1000, a.length * 1000 + 600] : tid === "eye" ? [it.i, Math.round(it.ans[0] * 1000), Math.round(it.ans[1] * 1000), 900] : [it.i, tid === "color" ? it.odd : it.n, 900]); } return { a }; };
const sub0 = await call(s1, "feel:submit", { sid: b.sid, idx: 0, log: fakeLog(pl[0].id, pl[0].seed, "hard") });
ok(sub0.ok && sub0.result.flags.includes("TOO_QUICK"), "너무 빨리 끝낸 제출은 의심 표시 (" + JSON.stringify(sub0.result?.flags) + ")");
ok(sub0.result.score <= 40, "의심 기록 40점 상한");
const dup = await call(s1, "feel:submit", { sid: b.sid, idx: 0, log: {} }); ok(dup.dup && dup.result.score === sub0.result.score, "중복 제출은 처음 결과");
const skip = await call(s1, "feel:submit", { sid: b.sid, idx: 1, skip: true }); ok(skip.ok && skip.result.skipped, "건너뛰기");
for (let i = 2; i < pl.length; i++) { if (i > 3) { await call(s1, "feel:submit", { sid: b.sid, idx: i, skip: true }); continue; } await call(s1, "feel:testStart", { sid: b.sid, idx: i }); _feelTest.SESS.get(b.sid).started[i] -= 200000; await call(s1, "feel:submit", { sid: b.sid, idx: i, log: fakeLog(pl[i].id, pl[i].seed, "hard") }); }
const fin = await call(s1, "feel:finish", { sid: b.sid, profile: prof, prefs: {} });
ok(fin.ok && fin.id, "finish 저장"); ok(!(pl[1].id in fin.result.scores), "건너뛴 검사는 미측정(점수 없음)"); ok(fin.result.done === 3, "측정 3종"); ok(fin.result.nick === "시험b", "닉네임 꺾쇠 제거"); ok(fin.result.flagged, "의심 포함 결과는 flagged");
// 정상 결과 하나 더 (s2) → 랭킹
const b2 = await call(s2, "feel:begin", { mode: "single", test: "eye", diff: "hard", device: "mobile" }); await call(s2, "feel:testStart", { sid: b2.sid, idx: 0 }); _feelTest.SESS.get(b2.sid).started[0] -= 200000;
const r2 = await call(s2, "feel:submit", { sid: b2.sid, idx: 0, log: fakeLog("eye", b2.plan[0].seed, "hard") }); ok(r2.result.score >= 95 && !r2.result.flags.length, "정답 그대로면 고득점 " + r2.result.score);
const f2 = await call(s2, "feel:finish", { sid: b2.sid, profile: { nick: "둘", avatar: {} }, prefs: {} }); ok(f2.ok, "single finish");
const get = (u) => fetch(`http://localhost:${port}${u}`).then((x) => x.json());
let rk = await get("/feel/ranking?diff=hard&board=test&test=eye"); ok(rk.ok && rk.rows.length === 1 && rk.rows[0].nick === "둘", "검사별 랭킹 (의심 기록 제외)");
rk = await get("/feel/ranking?diff=normal&board=test&test=eye"); ok(rk.rows.length === 0, "난이도별로 분리");
rk = await get("/feel/ranking?diff=hard&board=total"); ok(rk.rows.length === 0, "single·flagged는 종합 랭킹에 없음");
const v = await get(`/feel/result/${f2.id}`); ok(v.ok && v.result.scores.eye === r2.result.score, "결과 링크");
ok(!(await call(s1, "feel:begin", { mode: "single", test: "nope", diff: "normal" })).ok, "없는 검사 막음");
ok((await call(s1, "feel:begin", { mode: "full", diff: "easy" })).diff === "normal", "없는 난이도는 보통으로");
// 랭킹 영구 유지: 예전 검사 버전(set_ver) 기록도 종합 랭킹에 그대로
sb.DB.feel_results.push({ id: "oldver1", owner_key: "g:guest_oldver", user_id: null, nickname: "예전기록", avatar: {}, mode: "full", diff: "hard", set_ver: "f0", device: "pc", scores: { color: 90 }, metrics: {}, total: 900, areas: {}, tier: "SS", style: "scouting", diag: {}, done: 1, is_public: true, flagged: false, created_at: "2026-01-01T00:00:00Z" });
{ const r = await fetch(`http://localhost:${port}/feel/ranking?diff=hard&board=total&device=pc`).then((x) => x.json()); ok(r.rows.some((x) => x.nick === "예전기록"), "예전 버전 기록도 종합 랭킹에 남음 (초기화 없음)"); }
// 스트리머 체크 → admin 스트리머 기록(platform feel) 1줄, 체크 안 하면 0줄
ok(!(sb.DB.streamer_chat_log || []).length, "일반 결과는 스트리머 기록 없음");
{ const b4 = await call(s2, "feel:begin", { mode: "single", test: "color", diff: "expert", device: "pc" }); await call(s2, "feel:testStart", { sid: b4.sid, idx: 0 }); _feelTest.SESS.get(b4.sid).started[0] -= 200000;
  await call(s2, "feel:submit", { sid: b4.sid, idx: 0, log: fakeLog("color", b4.plan[0].seed, "expert") }); const f4 = await call(s2, "feel:finish", { sid: b4.sid, profile: { nick: "스트리머", avatar: {} }, prefs: { streamer: true } });
  await new Promise((r) => setTimeout(r, 50)); const L = sb.DB.streamer_chat_log || [];
  ok(L.length === 1 && L[0].platform === "feel" && L[0].channel_id === f4.id && L[0].nickname === "스트리머" && /감각 진단소 · 개별 검사 · 색 구분 · 전문가/.test(L[0].content_title), "스트리머 기록 " + JSON.stringify(L[0]?.content_title));
  await call(s2, "feel:finish", { sid: b4.sid, profile: { nick: "스트리머", avatar: {} }, prefs: { streamer: true } }); ok((sb.DB.streamer_chat_log || []).length === 1, "같은 결과 다시 마감해도 기록 1줄"); }
// 전부 건너뛰면 진단서 없음
const b3 = await call(s1, "feel:begin", { mode: "full", diff: "normal" }); for (let i = 0; i < b3.plan.length; i++) await call(s1, "feel:submit", { sid: b3.sid, idx: i, skip: true }); ok((await call(s1, "feel:finish", { sid: b3.sid, profile: prof })).error === "NOTHING_MEASURED", "측정 0개면 진단서 거절");
s1.close(); s2.close(); io.close(); srv.close();
console.log(`\n통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
