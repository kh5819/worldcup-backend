// 「우리 방송 피지컬 평균」 시험 (메모리 가짜 DB): node scripts/test-clinic-bc.mjs
// 시청자 1·10·100·500명 집계 정확성, 중복 방지, 비정상 제외, 스트리머 비교, 마감·유예·확정, 대항전, 처리 시간
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerClinic, memberProfile } from "../src/clinic.js";
import { registerClinicBroadcast, _bcTest } from "../src/clinic-broadcast.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
DB.profiles.push({ id: "u_streamer", nickname: "테스트방송인", avatar_url: null });
DB.clinic_broadcasts = []; DB.clinic_bc_entries = []; DB.streamer_chat_log = [];

const app = express(); const server = http.createServer(app);
const io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerClinic(io, sb, app, { getOptionalUser: async () => null });
registerClinicBroadcast(io, sb, app, { memberProfile });
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const get = async (p) => { const r = await fetch(URL + p); return { status: r.status, ...(await r.json()) }; };
const prof = (i) => ({ nick: `시청자${i}`, gender: i % 2 ? "f" : "m", age: 15 + (i % 50), avatar: {} });

// 한 사람 검사 (빠른검사 5종, 반응속도만 기록 → 점수가 사람마다 다름)
async function play(s, bc, profile, { rt = 250, cheat = false, showName = true, mode = "quick", beginOnly = false } = {}) {
  const b = await emit(s, "clinic:begin", { mode, device: Math.random() < 0.5 ? "pc" : "mobile", bc });
  if (!b.ok) return b;
  if (beginOnly) return b;
  return finish(s, b, profile, { rt, cheat, showName });
}
async function finish(s, b, profile, { rt = 250, cheat = false, showName = true } = {}) {
  for (let i = 0; i < b.plan.length; i++) {
    await emit(s, "clinic:testStart", { sid: b.sid, idx: i });
    const id = b.plan[i].id;
    const log = id === "reaction" ? { tr: [rt, rt + 13, rt + 27, rt + 8, rt + 19] } : id === "tap" && cheat ? { t: Array.from({ length: 140 }, (_, k) => k * 70) } : {};
    await emit(s, "clinic:submit", { sid: b.sid, idx: i, log });
  }
  return emit(s, "clinic:finish", { sid: b.sid, profile, prefs: {}, isPublic: true, bcShowName: showName });
}

// 1) 만들기: 게스트 불가, 회원 가능, 프로필 닉네임
const st = await conn("u_streamer");
// 게스트(로그인 없음)도 만들 수 있음: 닉네임 직접 입력 필수, 동시에 1개, user_id 없음
{
  const g = await conn("guest_nobc");
  ok((await emit(g, "clinic:bc:create", { title: "x" })).error === "NEED_NICK", "게스트가 닉네임 없이 만듦");
  const gc = await emit(g, "clinic:bc:create", { title: "게스트 방송", streamerNick: "<i>방송인</i>", mode: "quick", minutes: 30 });
  ok(gc.ok && gc.bc.streamer_nick === "i방송인/i" && gc.bc.user_id === null && gc.bc.owner_key === "g:guest_nobc", "게스트 방송 만들기 이상: " + JSON.stringify(gc).slice(0, 160));
  ok((await emit(g, "clinic:bc:create", { title: "둘째", streamerNick: "방송인" })).error === "TOO_MANY_OPEN", "게스트가 동시에 2개 만듦");
  ok((await emit(g, "clinic:bc:mine", {})).rows.length === 1, "게스트 내 방송 목록 없음");
  await sleep(50);
  const lg = DB.streamer_chat_log.find((x) => x.channel_id === gc.bc.id);
  ok(lg && lg.platform === "clinic" && lg.nickname === "i방송인/i" && lg.content_title === "게스트 방송" && lg.host_user_id === null && lg.host_nick === null, "admin 스트리머 기록(게스트) 이상: " + JSON.stringify(lg));
  ok((await emit(g, "clinic:bc:watch", { id: gc.bc.id })).owner === true && (await emit(await conn("guest_other1"), "clinic:bc:watch", { id: gc.bc.id })).owner === false, "게스트 방송 주인 판정 이상");
  ok((await emit(g, "clinic:bc:control", { id: gc.bc.id, action: "close" })).ok, "게스트 주인이 마감 못 함");
  // 같은 IP 10분에 5개까지 (위에서 1개 만듦 → 4개 더 되고 그다음 막힘)
  const made = [];
  for (let i = 0; i < 5; i++) made.push(await emit(await conn(`guest_ipspam${i}`), "clinic:bc:create", { title: "도배", streamerNick: "도배" + i }));
  ok(made.slice(0, 4).every((x) => x.ok) && made[4].error === "RATE_LIMITED", "게스트 IP 도배 제한 이상: " + made.map((x) => x.ok || x.error).join(","));
}
const c = await emit(st, "clinic:bc:create", { title: "<b>오늘의 피지컬</b>", mode: "quick", minutes: 30, streamerNick: "가짜" });
ok(c.ok && c.bc.streamer_nick === "테스트방송인" && !/[<>]/.test(c.bc.title) && c.bc.mode === "quick", "방송 진단소 생성 이상");
const BCID = c.bc.id;
await sleep(50);
{ const lm = DB.streamer_chat_log.find((x) => x.channel_id === BCID);
  ok(lm && lm.platform === "clinic" && lm.nickname === "테스트방송인" && lm.host_user_id === "u_streamer" && lm.host_nick === "테스트방송인" && lm.content_title === "b오늘의 피지컬/b", "admin 스트리머 기록(회원) 이상: " + JSON.stringify(lm)); }
// 모드가 다르면 참여 불가
ok((await emit(await conn("guest_wrongmode"), "clinic:begin", { mode: "full", device: "pc", bc: BCID })).error === "BC_MODE", "모드 다른 참여 허용");

// 2) 스트리머 본인 기록 (집계엔 안 들어감)
const sf = await play(st, BCID, prof(0), { rt: 260 });
ok(sf.ok && sf.bc?.streamer === true && sf.bc.counted === false, "스트리머 기록 처리 이상");

// 3) 시청자 1 → 10 → 100 → 500 단계별
const viewers = [];
let made = 0;
async function addViewers(n) {
  const batch = [];
  for (let i = 0; i < n; i++) {
    const idx = made++;
    batch.push((async () => {
      const s = await conn(`guest_v${idx}x`);
      const rt = 170 + ((idx * 37) % 330);
      const r = await play(s, BCID, prof(idx), { rt, showName: idx % 7 !== 0, cheat: idx % 50 === 49 });
      viewers.push({ idx, r });
      s.close();
    })());
    if (batch.length >= 50) { await Promise.all(batch); batch.length = 0; }
  }
  await Promise.all(batch);
}
for (const target of [1, 10, 100, 500]) {
  const t0 = Date.now();
  await addViewers(target - made);
  const dt = Date.now() - t0;
  await sleep(2300);   // 묶음 재계산 간격
  const w = await emit(st, "clinic:bc:watch", { id: BCID });
  const S = w.stats;
  const ents = DB.clinic_bc_entries.filter((e) => e.bc_id === BCID && !e.flagged && !e.is_streamer);
  const avgT = Math.round(ents.reduce((a, e) => a + e.total, 0) / ents.length * 10) / 10;
  const ph = ents.map((e) => e.phys).sort((a, b) => a - b), m = ph.length >> 1, med = ph.length % 2 ? ph[m] : (ph[m - 1] + ph[m]) / 2;
  ok(S.count === ents.length, `${target}명: 참여자 수 ${S.count} ≠ ${ents.length}`);
  ok(S.avgTotal === avgT && S.medianPhys === med, `${target}명: 평균/중앙값 불일치`);
  ok(S.top10.length === Math.min(10, ents.length) && S.top10.every((x, i, A) => i === 0 || A[i - 1].total >= x.total), `${target}명: TOP10 이상`);
  const sTot = DB.clinic_bc_entries.find((e) => e.is_streamer && e.bc_id === BCID).total;
  ok(S.beatStreamer === Math.round(ents.filter((e) => e.total > sTot).length / ents.length * 100), `${target}명: 스트리머 비교 이상`);
  console.log(`  ${target}명: 처리 ${dt}ms · 평균 ${S.avgTotal}점 · 평균 피지컬 ${S.avgPhys}세 · 중앙값 ${S.medianPhys}세 · 스트리머보다 높은 ${S.beatStreamer}% · 제외(의심) ${S.flaggedCount}`);
}
const t1 = Date.now(); for (let i = 0; i < 20; i++) _bcTest.computeStats(_bcTest.BC.get(BCID)); console.log(`  500명 통계 계산 1회 평균 ${((Date.now() - t1) / 20).toFixed(1)}ms`);
const S500 = (await emit(st, "clinic:bc:watch", { id: BCID })).stats;
ok(S500.flaggedCount === 10 && S500.count === 490, "비정상 기록 제외 이상: " + S500.flaggedCount + "/" + S500.count);
ok(S500.top10.some((x) => x.anon) || S500.top10.every((x) => !x.anon), "");
ok(!JSON.stringify(S500).match(/"age":\s*\d/) && !JSON.stringify(S500).includes("gender"), "통계에 실제 나이·성별 노출");
ok(Object.values(S500.ageDist).reduce((a, b) => a + b, 0) === 490, "연령대 분포 합 이상");
ok(Object.keys(S500.perTest).length === 5 && S500.device.pc + S500.device.mobile === 490, "검사별 평균/기기 구분 이상");

// 4) 같은 사람 다시 하기 → 집계 안 늘어남 (첫 기록 유지)
const again = await conn("guest_v3x");
const ag = await play(again, BCID, prof(3), { rt: 150 });
ok(ag.ok && ag.bc?.counted === false && ag.bc.reason === "ALREADY", "중복 참여가 집계됨");
again.close();

// 5) REST (OBS 오버레이)
const rest = await get(`/clinic/bc/${BCID}`);
ok(rest.ok && rest.stats.count === 490 && rest.stats.open === true, "오버레이 REST 이상");

// 6) 마감: 마감 전 시작 → 마감 후 제출 인정(유예), 마감 후 시작 불가, 확정 후 고정
const late = await conn("guest_lateone1");
const lb = await play(late, BCID, prof(900), { beginOnly: true });
ok((await emit(st, "clinic:bc:control", { id: BCID, action: "close" })).ok, "마감 실패");
ok((await emit(await conn("guest_afterclose"), "clinic:begin", { mode: "quick", device: "pc", bc: BCID })).error === "BC_CLOSED", "마감 후 참여 시작 허용");
const lf = await finish(late, lb, prof(900), { rt: 180 });
ok(lf.ok && lf.bc?.counted === true, "마감 직전 시작한 검사가 집계 안 됨 " + JSON.stringify(lf.bc || lf.error));
ok((await emit(await conn("guest_v5x"), "clinic:bc:control", { id: BCID, action: "finalize" })).error === "NOT_OWNER", "주인 아닌 사람이 확정");
const fz = await emit(st, "clinic:bc:control", { id: BCID, action: "finalize" });
ok(fz.ok && fz.stats.status === "final" && fz.stats.count === 491, "확정 실패: " + fz.stats?.count);
const finalRow = DB.clinic_broadcasts.find((b) => b.id === BCID);
ok(finalRow.status === "final" && finalRow.final_stats?.count === 491, "확정 결과가 DB에 저장 안 됨");
// 확정 후 들어온 결과는 반영 안 됨, 결과 고정
const late2 = await conn("guest_late2two");
const l2b = await emit(late2, "clinic:begin", { mode: "quick", device: "pc" });
ok(l2b.ok, "");
const after = await get(`/clinic/bc/${BCID}`);
ok(after.stats.count === 491 && after.stats.status === "final", "확정 후 결과가 바뀜");
// 메모리 캐시를 지워도 DB에서 그대로 재현
_bcTest.BC.delete(BCID);
const re = await get(`/clinic/bc/${BCID}`);
ok(re.stats.count === 491 && re.stats.avgTotal === fz.stats.avgTotal, "확정 결과 재현 실패");

// 7) 대항전: 같은 모드·채점 버전만 순위, 참여자 적은 방송 별도
const c2 = await emit(st, "clinic:bc:create", { title: "두번째 방송", mode: "quick", minutes: 30 });
for (let i = 0; i < 12; i++) { const s = await conn(`guest_b2v${i}y`); await play(s, c2.bc.id, prof(i), { rt: 160 }); s.close(); }
const c3 = await emit(st, "clinic:bc:create", { title: "작은 방송", mode: "quick", minutes: 30 });
for (let i = 0; i < 3; i++) { const s = await conn(`guest_b3v${i}z`); await play(s, c3.bc.id, prof(i), { rt: 300 }); s.close(); }
const c4 = await emit(st, "clinic:bc:create", { title: "네번째", mode: "full", minutes: 30 });
ok(c4.ok && (await emit(st, "clinic:bc:create", { title: "다섯째", mode: "full", minutes: 30 })).error === "TOO_MANY_OPEN", "동시에 연 방송 수 제한(3개) 이상");
const bfull = await get(`/clinic/bc-battle?ids=${BCID},${c4.bc.id}`);
ok(bfull.rows.find((r) => r.id === c4.bc.id).comparable === false, "모드 다른 방송이 비교 대상에 들어감");
await sleep(2300);
const bt = await get(`/clinic/bc-battle?ids=${BCID},${c2.bc.id},${c3.bc.id}`);
const rowOf = (id) => bt.rows.find((r) => r.id === id);
ok(bt.ok && rowOf(c3.bc.id).enough === false && rowOf(c3.bc.id).rank == null, "참여자 적은 방송이 순위에 들어감");
ok(rowOf(BCID).rank && rowOf(c2.bc.id).rank && rowOf(c2.bc.id).rank === 1, "대항전 순위 이상 (빠른 반응 방송이 1위여야)");

io.close(); server.close();
console.log(`\n방송 진단소 시험: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
