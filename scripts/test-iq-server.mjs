// IQ 진단소 서버 시험 (가짜 Supabase + 실제 Socket.IO)
// 혼자 검사·정답 숨김·순서·시간초과·저울·힌트·챌린지 중복·랭킹 분리·복습·8인 멀티·방송 집계·예측·120명 부하
process.env.IQ_FAST = "1";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerIq, _iqTest } from "../src/iq.js";
import { registerIqMulti, _test as M } from "../src/iq-multi.js";
import { registerIqBroadcast, _bcTest } from "../src/iq-broadcast.js";
import * as C from "../src/iq-core.js";
import * as G from "../src/iq-gen.js";
import { answerFor } from "./iq-solver.mjs";

let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express();
const server = http.createServer(app);
const io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
const getOptionalUser = async (req) => { const a = req.headers.authorization || ""; return a.startsWith("Bearer u_") ? { id: a.slice(7) } : null; };
registerIq(io, sb, app, { getOptionalUser });
registerIqMulti(io, sb);
registerIqBroadcast(io, sb, app, { memberProfile: async () => null });
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const get = async (path, headers = {}) => { const r = await fetch(URL + path, { headers }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const prof = (nick) => ({ nick, age: 25, avatar: { skin: 1, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });
const sessOf = (sid) => _iqTest.SESS.get(sid);
const hasKey = (o) => JSON.stringify(o).includes('"key"') || JSON.stringify(o).includes('"exp"');

// 한 사람 검사 끝까지: quality 0~1 (정답 비율)
async function run(s, mode, { quality = 1, hintAt = -1, bc, bcNick, isPublic = true, nick = "테스터" } = {}) {
  const b = await emit(s, "iq:begin", { mode, device: "pc", bc, bcNick });
  if (!b.ok) return b;
  const S = sessOf(b.sid);
  for (let i = 0; i < b.plan.length; i++) {
    const g = await emit(s, "iq:item", { sid: b.sid, idx: i });
    if (!g.ok) return g;
    const it = _iqTest.makeItem(S.plan[i]);
    if (i === hintAt) await emit(s, "iq:hint", { sid: b.sid, idx: i });
    let ans = null;
    if ((i * 37 % 100) / 100 < quality) {
      if (it.type === "scale") {
        let pool = Array.from({ length: it.view.n }, (_, k) => k + 1);
        for (let w = 0; w < it.view.maxW && pool.length > 1; w++) { const k = Math.ceil(pool.length / 3); const r = await emit(s, "iq:act", { sid: b.sid, idx: i, op: "weigh", L: pool.slice(0, k), R: pool.slice(k, 2 * k) }); pool = G.scaleCandidates(it.view.n, S.st[i].act.w); void r; }
        ans = pool[0];
      } else ans = answerFor(it);
    }
    const a = await emit(s, "iq:answer", { sid: b.sid, idx: i, answer: ans });
    if (!a.ok) return a;
  }
  return emit(s, "iq:finish", { sid: b.sid, profile: prof(nick), prefs: {}, isPublic });
}

// 1) 혼자 빠른검사 — 정답 숨김, 순서, 해설 공개, 저장
{
  const m = await conn("u_marin");
  const b = await emit(m, "iq:begin", { mode: "quick", device: "pc" });
  ok(b.ok && b.plan.length === 10 && !JSON.stringify(b).includes("seed"), "begin: 시드가 화면으로 감");
  ok((await emit(m, "iq:item", { sid: b.sid, idx: 1 })).error === "BAD_IDX", "순서 건너뛰기 허용됨");
  const g = await emit(m, "iq:item", { sid: b.sid, idx: 0 });
  ok(g.ok && g.item && !hasKey(g), "문항에 정답(key/exp)이 들어감");
  ok((await emit(m, "iq:answer", { sid: b.sid, idx: 1, answer: 1 })).error === "BAD_IDX", "다음 문항 미리 제출 허용됨");
  const it = _iqTest.makeItem(sessOf(b.sid).plan[0]);
  const a = await emit(m, "iq:answer", { sid: b.sid, idx: 0, answer: answerFor(it) });
  ok(a.ok && a.res.ok && a.reveal && a.pts > 0, "정답인데 틀림 처리 / 해설 없음");
  const a2 = await emit(m, "iq:answer", { sid: b.sid, idx: 0, answer: 99 });
  ok(a2.dup && a2.res.ok, "같은 문항 두 번 제출로 결과가 바뀜");
  ok(typeof a2.pts === "number" && a2.pts === a.pts && a2.reveal, "중복 제출 응답에 점수·해설 없음");
  // 새로고침: 같은 문항 다시 받으면 경과 시간 유지
  const g1 = await emit(m, "iq:item", { sid: b.sid, idx: 1 });
  await new Promise((r) => setTimeout(r, 120));
  const g1b = await emit(m, "iq:item", { sid: b.sid, idx: 1 });
  ok(g1b.elapsed >= 100 && JSON.stringify(g1b.item) === JSON.stringify(g1.item), "새로고침하면 시간이 다시 시작됨");
  // 시간 초과: 시작 시각을 과거로
  sessOf(b.sid).st[1].at -= 999999;
  const it1 = _iqTest.makeItem(sessOf(b.sid).plan[1]);
  const to = await emit(m, "iq:answer", { sid: b.sid, idx: 1, answer: answerFor(it1) });
  ok(to.ok && !to.res.ok && to.res.timeout, "시간 초과 답이 정답 처리됨");
  ok((await emit(m, "iq:finish", { sid: b.sid, profile: prof("x") })).error === "NOT_COMPLETE", "다 안 풀었는데 발급됨");
  const resume = await emit(m, "iq:resume", { sid: b.sid });
  ok(resume.ok && resume.idx === 2, "이어하기 위치 틀림");
  m.disconnect();
}
// 2) 끝까지 + 저장값 + 공개/비공개 + 복습
let marinResult;
{
  const m = await conn("u_marin");
  const f = await run(m, "quick", { quality: 1 });
  ok(f.ok && f.result.total >= 85 && f.result.iq >= 136, `만점 근처인데 점수 낮음 ${f.result?.total}`);
  ok(f.result.diag.titles.some((t) => t.k === "perfect"), "만점 칭호 없음");
  const row = DB.iq_results.find((r) => r.id === f.id);
  ok(row && row.set_ver === C.SET_VERSION && row.plan.length === 10 && row.diag.i18n?.en?.title, "결과 저장값 이상");
  marinResult = f.id;
  const pubv = await get(`/iq/result/${f.id}`);
  ok(pubv.ok && !JSON.stringify(pubv).includes("owner_key") && pubv.result.age == null, "공개 결과에 소유키/나이 노출");
  await emit(m, "iq:setPublic", { id: f.id, isPublic: false });
  ok((await get(`/iq/result/${f.id}`)).status === 403, "비공개가 남에게 보임");
  ok((await get(`/iq/result/${f.id}`, { authorization: "Bearer u_marin" })).status === 200, "본인이 비공개를 못 봄");
  const rv = await get(`/iq/review/${f.id}`, { authorization: "Bearer u_marin" });
  ok(rv.ok && rv.items.length === 10 && rv.items.every((x) => x.reveal && x.res), "복습에 정답·내 결과 없음");
  ok((await get(`/iq/review/${f.id}`)).status === 403, "비공개 복습이 남에게 보임");
  await emit(m, "iq:setPublic", { id: f.id, isPublic: true });
  // 힌트 쓰면 점수 낮아짐
  const f2 = await run(m, "quick", { quality: 1, hintAt: 0 });
  ok(f2.result.items[0].hint === true && f2.result.total <= f.result.total, "힌트가 점수에 반영 안 됨");
  ok(f2.result.diag.opinion.some((x) => /올랐|내려|Up|Down/.test(x)) || Math.abs(f2.result.total - f.result.total) < 3, "이전 기록 비교 문장 없음");
  m.disconnect();
}
// 3) 저울: 찍기 거부, 저울질 제한
{
  const s = await conn("guest_scale1");
  const b = await emit(s, "iq:begin", { mode: "full", device: "mobile" });
  const S = sessOf(b.sid);
  const idx = S.plan.findIndex((p) => p.type === "scale");
  for (let i = 0; i < idx; i++) { await emit(s, "iq:item", { sid: b.sid, idx: i }); await emit(s, "iq:answer", { sid: b.sid, idx: i, answer: null }); }
  await emit(s, "iq:item", { sid: b.sid, idx });
  const it = _iqTest.makeItem(S.plan[idx]);
  const w1 = await emit(s, "iq:act", { sid: b.sid, idx, op: "weigh", L: [1, 2, 3], R: [4, 5, 6] });
  ok(w1.ok && ["L", "R", "="].includes(w1.res), "저울질 안 됨");
  ok((await emit(s, "iq:act", { sid: b.sid, idx, op: "weigh", L: [1], R: [1] })).error === "BAD_WEIGH", "같은 추 양쪽 허용");
  // 한 번만 재고 바로 정답 찍기 → 후보가 여럿이면 오답
  const cands = G.scaleCandidates(it.view.n, S.st[idx].act.w);
  const a = await emit(s, "iq:answer", { sid: b.sid, idx, answer: it.key });
  ok(cands.length > 1 ? !a.res.ok : a.res.ok, "논리로 안 좁혔는데 정답 처리(찍기)");
  s.disconnect();
}
// 4) 오늘의 챌린지: 모두 같은 문제, 두 번째는 순위 제외
{
  const a = await conn("u_aa"), b = await conn("guest_bb1");
  { const c1 = await conn("guest_cc1"), c2 = await conn("guest_cc2");
    const x1 = await emit(c1, "iq:begin", { mode: "daily", device: "pc" }), x2 = await emit(c2, "iq:begin", { mode: "daily", device: "pc" });
    ok(JSON.stringify(sessOf(x1.sid).plan) === JSON.stringify(sessOf(x2.sid).plan), "오늘의 챌린지 문제가 사람마다 다름");
    // 미리 보기 악용: 시작해서 문제만 보고 그만둔 뒤 다시 시작 → 그 기록은 순위 제외
    await emit(c1, "iq:item", { sid: x1.sid, idx: 0 });
    const again = await run(c1, "daily", { quality: 1, nick: "미리보기" });
    ok(again.ok && again.repeat === true && DB.iq_results.find((r) => r.id === again.id).flagged, "챌린지 미리 보고 다시 시작한 기록이 순위에 들어감");
    c1.disconnect(); c2.disconnect(); }
  const f1 = await run(a, "daily", { quality: 0.7, nick: "에이" });
  const f2 = await run(a, "daily", { quality: 1, nick: "에이" });
  ok(!DB.iq_results.find((r) => r.id === f1.id).flagged && DB.iq_results.find((r) => r.id === f2.id).flagged && f2.repeat, "챌린지 두 번째 기록이 순위에 들어감");
  await run(b, "daily", { quality: 0.4, nick: "비" });
  const rk = await get(`/iq/ranking?mode=daily`);
  ok(rk.ok && rk.rows.length === 2 && rk.rows[0].nick === "에이" && rk.rows[0].total === DB.iq_results.find((r) => r.id === f1.id).total, "챌린지 랭킹 틀림(중복·순위)");
  const rq = await get(`/iq/ranking?mode=quick`), rf = await get(`/iq/ranking?mode=full`);
  ok(rq.rows.every((r) => DB.iq_results.find((x) => x.id === r.id).mode === "quick") && rf.rows.length === 0, "빠른·정밀 랭킹이 섞임");
  const ra = await get(`/iq/ranking?mode=quick&board=area&area=logic`);
  ok(ra.ok && ra.rows.every((r) => r.area !== undefined), "영역 랭킹 이상");
  // 진행 중 챌린지 복습은 남에게 스포일러 금지
  ok((await get(`/iq/review/${f1.id}`)).error === "SPOILER", "오늘 챌린지 정답이 남에게 보임");
  a.disconnect(); b.disconnect();
}
// 5) 8인 멀티 (빠름 모드)
{
  const ids = ["u_h", "u_p1", "guest_p2aa", "u_p3", "u_p4", "guest_p5aa", "u_p6", "u_p7"];
  const S = await Promise.all(ids.map(conn));
  const states = ids.map(() => null);
  S.forEach((s, k) => s.on("iqm:room", (r) => { states[k] = r; }));
  const mine = {}; S.forEach((s, k) => s.on("iqm:mine", (r) => { mine[k] = r; }));
  const c = await emit(S[0], "iqm:create", { mode: "quick", profile: prof("방장"), device: "pc" });
  ok(c.ok && c.room.code, "방 생성 실패");
  ok((await emit(S[2], "iqm:create", { profile: prof("게") })).error === "GUEST_CANNOT_CREATE", "게스트가 방을 만듦");
  for (let k = 1; k < 8; k++) { const j = await emit(S[k], "iqm:join", { code: c.room.code, profile: prof("p" + k), device: k % 2 ? "mobile" : "pc" }); ok(j.ok, "입장 실패 " + k); await emit(S[k], "iqm:ready", { ready: true }); }
  const extra = await conn("u_p9");
  ok((await emit(extra, "iqm:join", { code: c.room.code, profile: prof("9") })).error === "ROOM_FULL", "9번째 입장 허용");
  ok((await emit(S[0], "iqm:start", {})).ok, "시작 실패");
  const room = () => M.ROOMS.get(c.room.id);
  let leakDuringPlay = false, sawResult = 0, dropped = false;
  for (let round = 0; round < 10; round++) {
    // play 될 때까지
    for (let t = 0; t < 400 && !(room().phase === "play" && room().round === round); t++) await new Promise((r) => setTimeout(r, 5));
    const st = states[0];
    if (st?.item && hasKey(st.item)) leakDuringPlay = true;
    if (room().round === 3 && !dropped) { dropped = true; S[7].disconnect(); }
    const it = room().item;
    await Promise.all(S.map(async (s, k) => {
      if (dropped && k === 7) return;
      const ans = it.type === "scale" ? null : k < 4 ? answerFor(it) : null;
      const r = await emit(s, "iqm:answer", { round, answer: ans });
      if (r?.res || r?.reveal) leakDuringPlay = true;   // 제출 응답에 정오답 없어야 함
    }));
    // 다른 사람 상태에 정오답이 안 보여야 함
    if (JSON.stringify(states[1]?.players || []).includes('"ok"')) leakDuringPlay = true;
    for (let t = 0; t < 400 && room().phase === "play"; t++) await new Promise((r) => setTimeout(r, 5));
    if (room().lastRound?.reveal && room().lastRound.rows.length === 8) sawResult++;
  }
  for (let t = 0; t < 600 && room().phase !== "final"; t++) await new Promise((r) => setTimeout(r, 10));
  await new Promise((r) => setTimeout(r, 200));
  ok(!leakDuringPlay, "진행 중 정답·정오답 노출");
  ok(sawResult === 10, "라운드 결과 공개 횟수 " + sawResult);
  const fin = room().final;
  ok(fin && fin.players.length === 8 && fin.report.ranking.length === 8 && fin.report.kings, "최종 결과 없음");
  const top = fin.players.find((p) => p.rank === 1);
  ok(["u_h", "u_p1", "guest_p2aa", "u_p3"].includes(top.id), "정답 낸 사람이 1위가 아님");
  ok(mine[0]?.diag && mine[1]?.diag && !mine[7], "개인 진단서가 본인에게 안 감 / 나간 사람에게 감");
  ok(DB.iq_groups.length === 1 && DB.iq_results.filter((r) => r.group_id === fin.groupId).length === 8, "단체 결과 저장 안 됨");
  // 재대결
  ok((await emit(S[0], "iqm:rematch", { mode: "quick" })).ok && room().phase === "lobby", "재대결 실패");
  S.forEach((s) => s.disconnect()); extra.disconnect();
}
// 6) 방송 진단소: 만들기·참여·집계·분야왕·예측·중복·확정·대항전
{
  const host = await conn("u_streamer");
  const cr = await emit(host, "iq:bc:create", { mode: "quick", title: "우리 방송 IQ", minutes: 30 });
  ok(cr.ok && cr.bc.set_ver === C.SET_VERSION, "방송 생성 실패");
  const bcid = cr.bc.id;
  ok(DB.streamer_chat_log?.some((x) => x.platform === "iq" && x.channel_id === bcid), "admin 스트리머 기록 없음");
  ok((await emit(host, "iq:bc:predict", { id: bcid, guess: 112 })).ok, "예측 실패");
  ok((await emit(host, "iq:bc:predict", { id: bcid, guess: 120 })).error === "ALREADY", "예측 두 번 허용");
  ok((await emit(host, "iq:begin", { mode: "full", bc: bcid })).error === "BC_MODE", "다른 모드로 방송 참여 허용");
  const hs = await run(host, "quick", { quality: 0.6, bc: bcid, bcNick: "스트리머" });
  ok(hs.bc?.streamer === true, "스트리머 기록 표시 안 됨");
  // 시청자 12명
  const V = []; for (let k = 0; k < 12; k++) V.push(await conn(k % 3 ? `guest_view${k}xx` : `u_view${k}`));
  await emit(V[0], "iq:bc:predict", { id: bcid, guess: 100, nick: "예측왕" });
  const fins = await Promise.all(V.map((s, k) => run(s, "quick", { quality: 0.3 + (k % 6) * 0.13, bc: bcid, bcNick: "시청" + k, nick: "시청" + k })));
  ok(fins.every((f) => f.ok && f.bc?.counted), "시청자 기록 집계 안 됨");
  const again = await run(V[1], "quick", { quality: 1, bc: bcid, bcNick: "시청1" });
  ok(again.bc?.counted === false && again.bc.reason === "ALREADY", "같은 사람 두 번 집계");
  const w = await emit(V[2], "iq:bc:watch", { id: bcid });
  await new Promise((r) => setTimeout(r, 2200));
  const st = (await get(`/iq/bc/${bcid}`)).stats;
  ok(st.count === 12 && st.avgIq > 60 && st.medianIq && st.top10.length === 10 && st.streamerScore && st.beatStreamer != null, "방송 통계 이상");
  ok(Object.keys(st.kings).length >= 6 && st.perArea.logic != null, "분야별 1위·영역 평균 없음");
  ok(!st.predictWinners && st.predictions === 2, "확정 전 예측 결과 노출");
  ok(w.ok && w.mine && !w.owner, "시청자 watch 이상");
  ok((await emit(V[0], "iq:bc:control", { id: bcid, action: "close" })).error === "NOT_OWNER", "시청자가 마감함");
  await emit(host, "iq:bc:control", { id: bcid, action: "close" });
  ok((await emit(V[3], "iq:begin", { mode: "quick", bc: bcid })).error === "BC_CLOSED", "마감 후 참여 허용");
  const fz = await emit(host, "iq:bc:control", { id: bcid, action: "finalize" });
  ok(fz.ok && fz.stats.status === "final" && fz.stats.predictWinners?.length === 2, "확정·예측 결과 이상");
  // 대항전: 다른 모드 방송은 비교 불가
  const cr2 = await emit(V[0], "iq:bc:create", { mode: "full", title: "정밀 방송" });
  const bt = await get(`/iq/bc-battle?ids=${bcid},${cr2.bc.id}`);
  ok(bt.ok && bt.rows.find((r) => r.id === cr2.bc.id).comparable === false, "다른 모드 방송이 같은 순위에");
  host.disconnect(); V.forEach((s) => s.disconnect());
}
// 7) 부하: 방송 1개에 150명 완료 기록 → 통계 계산 시간
{
  const host = await conn("u_load");
  const cr = await emit(host, "iq:bc:create", { mode: "quick", title: "부하" });
  const b = _bcTest.BC.get(cr.bc.id);
  for (let k = 0; k < 150; k++) {
    const areas = Object.fromEntries(C.AREAS.map((a) => [a, Math.round(Math.random() * 100)]));
    const total = Math.round(Math.random() * 100);
    b.entries.set("g:load" + k, { bc_id: cr.bc.id, owner_key: "g:load" + k, nickname: "L" + k, show_name: true, is_member: false, is_streamer: false, device: "pc", total, iq: C.gameIQ(total), areas, flagged: false, created_at: new Date().toISOString() });
    b.playing ||= new Map(); b.playing.set("g:p" + k, { nick: "P" + k, round: 3, total: 10, done: 2, device: "pc", at: Date.now(), since: Date.now() });
  }
  const t0 = performance.now(); let s; for (let i = 0; i < 20; i++) s = _bcTest.computeStats(b); const dt = (performance.now() - t0) / 20;
  ok(s.count === 150 && s.playingList.length === 60 && s.playing === 150, "부하 통계 이상");
  ok(dt < 15, `통계 계산이 느림 ${dt.toFixed(2)}ms`);
  console.log(`150명 통계 계산 ${dt.toFixed(2)}ms, 전송 크기 ${JSON.stringify(s).length}B`);
  // 동시 접속 100명이 한꺼번에 begin/item/answer
  const many = await Promise.all(Array.from({ length: 100 }, (_, k) => conn(`guest_many${k}xx`)));
  const t1 = performance.now();
  const rs = await Promise.all(many.map((s2, k) => run(s2, "quick", { quality: 0.5, bc: cr.bc.id, bcNick: "M" + k, nick: "M" + k })));
  const dt2 = performance.now() - t1;
  ok(rs.every((r) => r.ok && r.bc?.counted), "100명 동시 참여 중 실패");
  console.log(`100명 동시 빠른검사(문항 1000개) ${Math.round(dt2)}ms`);
  many.forEach((s2) => s2.disconnect()); host.disconnect();
}

console.log(fail ? `실패 ${fail} / 통과 ${pass}` : `전부 통과 (${pass})`);
io.close(); server.close();
process.exit(fail ? 1 : 0);
