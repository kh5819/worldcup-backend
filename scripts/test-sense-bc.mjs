// 게임 센스 스트리머 모드 서버 시험: node scripts/test-sense-bc.mjs
process.env.SENSE_RL = "100000"; process.env.SENSE_BC_IP_MAX = "1000";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import { registerSense, _senseTest } from "../src/sense.js"; import { registerSenseBroadcast, _sbcTest } from "../src/sense-broadcast.js"; import * as C from "../src/sense-core.js";
import { memberProfile } from "../src/iq.js"; import { play } from "./sense-bots.mjs"; import { makeFakeSb } from "./mind-fake-sb.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sb = makeFakeSb({ profiles: [{ id: "u_str", nickname: "스트리머A", avatar_url: null }], streamer_chat_log: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_"), isAdmin: false }; n(); });
registerSense(io, sb, app, {}); registerSenseBroadcast(io, sb, app, { memberProfile });
await new Promise((r) => server.listen(0, r)); const URLB = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URLB, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.stats = null; s.on("sbc:stats", (x) => (s.stats = x)); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const get = async (p) => { const r = await fetch(URLB + p); return { status: r.status, j: await r.json() }; };
const PROF = (nick) => ({ nick, age: 25, avatar: { skin: 0, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });
async function viewer(s, bc, pol, extra = {}) {
  const b = await emit(s, "sense:begin", { mode: "quick", device: "pc", bc, bcNick: extra.nick || "시청자", bcShowName: extra.show !== false });
  if (!b.ok) return b;
  for (let i = 0; i < b.plan.length; i++) { await emit(s, "sense:testStart", { sid: b.sid, idx: i }); _senseTest.SESS.get(b.sid).started[i] = Date.now() - C.TESTS[b.plan[i].id].dur - 1000; await emit(s, "sense:submit", { sid: b.sid, idx: i, log: play(b.plan[i].id, C.genSpec(b.plan[i].id, b.plan[i].seed), pol, C.rng(i + 7)) }); }
  return emit(s, "sense:finish", { sid: b.sid, profile: PROF(extra.nick || "시청자"), prefs: {}, isPublic: true, bcShowName: extra.show !== false });
}
const st = await conn("u_str"), g0 = await conn("guest_nonick00");
ok((await emit(g0, "sbc:create", { mode: "quick" })).error === "NEED_NICK", "게스트는 방송 닉네임 필요");
const c = await emit(st, "sbc:create", { mode: "quick", minutes: 30, title: "오늘의 센스 검사" }); ok(c.ok && c.bc.id, "방송 진단소 생성");
const id = c.bc.id; ok(c.bc.streamer_nick === "스트리머A", "회원 닉네임");
ok(sb.DB.streamer_chat_log.some((r) => r.platform === "sense" && r.channel_id === id), "관리자 스트리머 목록 기록 (platform sense)");
const w = await emit(st, "sbc:watch", { id }); ok(w.ok && w.owner && w.stats.count === 0, "주인 보기");
// 시청자 참여
const pols = ["good", "good", "rnd", "spam", "good", "idle"]; const viewers = [];
for (let i = 0; i < pols.length; i++) { const s = await conn(`guest_v${i}xxxxxx`); viewers.push(s); const f = await viewer(s, id, pols[i], { nick: `시청자${i}`, show: i !== 1 }); ok(f.ok && f.bc?.counted, `시청자 ${i} 집계됨`); }
const fs1 = await viewer(st, id, "good", { nick: "스트리머A" }); ok(fs1.ok && fs1.bc?.streamer && !fs1.bc.counted, "스트리머 기록은 시청자 통계에서 빠짐");
const dup = await viewer(viewers[0], id, "good"); ok(dup.ok && dup.bc?.reason === "ALREADY", "한 사람 두 번째 기록은 집계 안 함");
ok((await emit(viewers[0], "sense:begin", { mode: "full", bc: id })).error === "BC_MODE", "다른 모드로는 참여 불가");
ok((await emit(viewers[0], "sense:begin", { mode: "quick", bc: "없는방송" })).error === "BC_NOT_FOUND", "없는 방송");
await sleep(2300);
const S = (await get(`/sense/bc/${id}`)).j.stats;
ok(S.count === 6, "참여 6명 " + S.count); ok(S.avgTotal > 0 && S.topTotal >= S.medianTotal, "평균·중앙·최고");
ok(Object.values(S.tiers).reduce((a, b) => a + b, 0) === 6 && S.hist.reduce((a, b) => a + b, 0) === 6, "티어 분포·점수 분포");
ok(S.top10.length === 6 && S.top10.every((x, i, a) => !i || a[i - 1].total >= x.total), "TOP10 정렬"); ok(S.top10.some((x) => x.anon && x.nick === "익명 시청자"), "닉네임 숨김 시청자는 익명");
ok(S.streamerScore && S.beatStreamer != null, "스트리머 점수·이긴 비율"); ok(Object.keys(S.kings).length >= 1 && S.perArea.situ != null, "능력별 1위·평균");
ok(st.stats && st.stats.count === 6, "보는 사람에게 2초 묶음 통계 전송");
const rk = (await get(`/sense/bc/${id}/rank?from=0&n=3`)).j; ok(rk.ok && rk.rows.length === 3 && rk.more, "순위 더보기");
// 진행 중 목록
{ const s = await conn("guest_playing1"); const b = await emit(s, "sense:begin", { mode: "quick", bc: id, bcNick: "하는중" }); await emit(s, "sense:testStart", { sid: b.sid, idx: 0 }); await sleep(2300); const x = (await get(`/sense/bc/${id}`)).j.stats; ok(x.playing >= 1 && x.playingList.some((p) => p.nick === "하는중"), "검사 중 시청자 표시"); s.close(); }
// 권한·마감·확정
ok((await emit(viewers[0], "sbc:control", { id, action: "close" })).error === "NOT_OWNER", "주인만 마감");
ok((await emit(st, "sbc:control", { id, action: "finalize" })).error === "STILL_OPEN", "열려 있으면 확정 불가");
ok((await emit(st, "sbc:control", { id, action: "extend", minutes: 10 })).ok, "연장");
ok((await emit(st, "sbc:control", { id, action: "close" })).ok, "마감");
ok((await emit(viewers[2], "sense:begin", { mode: "quick", bc: id })).error === "BC_CLOSED", "마감 뒤 새 참여 불가");
const fz = await emit(st, "sbc:control", { id, action: "finalize" }); ok(fz.ok && fz.stats.status === "final", "확정");
ok(sb.DB.sense_broadcasts.find((r) => r.id === id).final_stats?.count === 6, "확정 통계 DB 보관");
ok(sb.DB.sense_bc_entries.length === 7, "참여 기록 저장 (시청자 6 + 스트리머 1)");
// 진행자 제어: 접수 대기 → 예측 → 시작 → 일시정지/재개 → 마감 → 확정 → 결과 발표
{ const c2 = await emit(st, "sbc:create", { mode: "quick", minutes: 20, wait: true }); ok(c2.ok && c2.bc.status === "wait", "접수 대기 상태로 생성"); const id2 = c2.bc.id;
  const v = viewers[3]; ok((await emit(v, "sense:begin", { mode: "quick", bc: id2 })).error === "BC_WAIT", "시작 전엔 검사 불가");
  ok((await emit(v, "sbc:control", { id: id2, action: "start" })).error === "NOT_OWNER", "시청자는 시작 못 함");
  ok((await emit(st, "sbc:control", { id: id2, action: "predict", tier: "없음" })).error === "BAD_TIER", "없는 티어 예측 거부");
  ok((await emit(st, "sbc:control", { id: id2, action: "predict", tier: "gold" })).ok, "평균 티어 예측");
  let started = false; v.on("sbc:start", () => (started = true)); await emit(v, "sbc:watch", { id: id2 });
  ok((await emit(st, "sbc:control", { id: id2, action: "start" })).ok, "검사 시작"); await sleep(100); ok(started, "시청자에게 시작 신호");
  ok((await emit(st, "sbc:control", { id: id2, action: "predict", tier: "iron" })).error === "PREDICT_BEFORE_START", "시작 뒤엔 예측 변경 불가");
  ok((await emit(st, "sbc:control", { id: id2, action: "pause" })).ok, "접수 일시정지"); ok((await emit(v, "sense:begin", { mode: "quick", bc: id2 })).error === "BC_PAUSED", "일시정지 중 새 참여 불가");
  ok((await emit(st, "sbc:control", { id: id2, action: "resume" })).ok, "재개");
  for (let i = 0; i < 3; i++) { const f = await viewer(viewers[i], id2, pols[i], { nick: "v" + i }); ok(f.ok && f.bc?.counted, "재개 후 참여 " + i); }
  await viewer(st, id2, "good", { nick: "스트리머A" });
  ok((await emit(st, "sbc:control", { id: id2, action: "reveal" })).error === "NOT_FINAL", "확정 전엔 결과 발표 불가");
  await emit(st, "sbc:control", { id: id2, action: "close" }); const fz2 = await emit(st, "sbc:control", { id: id2, action: "finalize" });
  ok(fz2.ok && fz2.stats.predict === "gold" && fz2.stats.predictResult && typeof fz2.stats.predictResult.hit === "boolean", "예측 결과 비교");
  ok(fz2.stats.streamerVsViewers && typeof fz2.stats.streamerVsViewers.win === "boolean", "스트리머 vs 시청자 평균");
  let rev = false; v.on("sbc:reveal", () => (rev = true)); ok((await emit(st, "sbc:control", { id: id2, action: "reveal" })).ok, "결과 발표"); await sleep(100); ok(rev, "결과 발표 신호");
  ok((await get(`/sense/bc/${id2}`)).j.stats.revealAt, "발표 시각 보관"); }
// 대규모: 시청자 5000명 통계 계산 속도
{ const b = { row: { ...sb.DB.sense_broadcasts[0], status: "open", final_stats: null }, entries: new Map() }; for (let i = 0; i < 5000; i++) { const t = Math.floor(Math.random() * 1000); b.entries.set("k" + i, { total: t, tier: C.tierOf(t).id, style: "radar", areas: Object.fromEntries(C.AREAS.map((a) => [a, Math.floor(Math.random() * 100)])), show_name: true, nickname: "n" + i, device: i % 2 ? "pc" : "mobile", created_at: new Date().toISOString() }); }
  const t0 = performance.now(); const x = _sbcTest.computeStats(b); const ms = performance.now() - t0; ok(x.count === 5000 && ms < 150, `5000명 통계 ${ms.toFixed(1)}ms`); }
console.log(`\n통과 ${pass} · 실패 ${fail}`);
[st, g0, ...viewers].forEach((s) => s.close()); server.close(); process.exit(fail ? 1 : 0);
