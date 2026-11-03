// 상식 진단소 다국어 시험: 일본어·영어 검사엔 한국사·한국 전용 문항이 안 나오고, 문제·보기·해설이 그 언어, 정답 위치·채점은 한국어와 같음
// 대결·퀴즈쇼용 serveAll/revealAll: 언어별 글자만 싣고 정답 정보는 안 실음
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerKnow, _knowTest, serve, serveAll, revealAll, localize, poolFor, buildPlan, STORE } from "../src/know.js";
import { LOCAL } from "../src/know-bank-i18n.js";
process.env.KNOW_RL = "100000";
DB.know_results = []; DB.know_reports = []; DB.know_questions = []; DB.know_qstats = [];
let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const HAN = /[가-힣]/;
const isLocal = (q) => LOCAL.has(q.id) || (q.tags || []).includes("한국사");

// 1) 출제 범위
for (const L of ["ja", "en"]) {
  const P = poolFor(L);
  ok(P.length >= 150 && P.every((q) => !isLocal(q)), `${L} 출제 ${P.length}문항, 한국사·한국 전용 0`);
  for (const mode of ["quick", "full", "daily"]) {
    let bad = 0; for (let s = 1; s <= 30; s++) for (const p of buildPlan(mode, s, { pool: P })) if (isLocal(STORE.all.get(p.id))) bad++;
    ok(!bad, `${L} ${mode} 계획 30개에 지역 문항 ${bad}`);
  }
}
ok(poolFor("ko").some(isLocal), "한국어는 한국사 포함");

// 2) 글자 + 정답 위치
let han = 0, keyDiff = 0;
for (const L of ["ja", "en"]) for (const q of poolFor(L)) {
  const lq = localize(q, L), sv = serve(lq, 7), rv = revealAll(q, serveAll(q, 7));
  const txt = JSON.stringify({ q: sv.pub.q, o: sv.pub.opts, e: sv.pub.events, s: sv.pub.stmts, l: sv.pub.left, r: sv.pub.right, x: lq.exp, c: lq.clues });
  if (HAN.test(txt)) { han++; console.log("  한글 남음", L, q.id); }
  if (JSON.stringify(sv.key) !== JSON.stringify(serve(q, 7).key)) keyDiff++;
  if (!rv.tr[L]?.exp || HAN.test(rv.tr[L].exp)) han++;
}
ok(!han, `번역 글자에 한글 남음 ${han}`); ok(!keyDiff, `정답 위치 다름 ${keyDiff}`);
// 3) serveAll: 정답 정보 없음
let leak = 0; for (const q of STORE.pool) { const sv = serveAll(q, 3); if (/"(exp|src|ans|years|truth|key|value)":/.test(JSON.stringify(sv.pub))) leak++; }
ok(!leak, `serveAll 공개 정보에 정답 ${leak}`);
ok(Object.keys(serveAll(poolFor("en")[0], 1).pub.tr).length === 2, "serveAll ja·en 글자 실림");
ok(!Object.keys(serveAll(STORE.pool.find(isLocal), 1).pub.tr).length, "한국사 문항은 번역 글자 없음");

console.log("  1~3 통과", pass, "실패", fail);
// 4) 소켓: lang=en으로 검사 → 문항 영어, 정답 맞히면 만점
const app = express(); app.use(express.json()); const server = http.createServer(app); const io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
registerKnow(io, sb, app, {});
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
for (const L of ["en", "ja"]) {
  const s = await conn(`guest_i18n_${L}0001`);
  const b = await emit(s, "know:begin", { mode: "quick", device: "pc", lang: L });
  ok(b.ok, `${L} 빠른 검사 시작`);
  let hanItems = 0, full = 0, localN = 0;
  for (let i = 0; i < b.plan.length; i++) {
    const it = await emit(s, "know:item", { sid: b.sid, idx: i });
    if (HAN.test(JSON.stringify({ q: it.item.q, o: it.item.opts, e: it.item.events, s: it.item.stmts, l: it.item.left }))) hanItems++;
    if (isLocal(STORE.all.get(it.item.id))) localN++;
    const sv = _knowTest.SESS.get(b.sid).served[i]; const ans = sv.pub.kind === "num" ? sv.key.v : sv.key;
    const a = await emit(s, "know:answer", { sid: b.sid, idx: i, answer: ans, seq: i });
    if (a.res?.part === 1) full++;
    if (HAN.test(a.reveal?.exp || "")) hanItems++;
  }
  ok(!hanItems && !localN, `${L} 문항 ${b.plan.length}개 모두 ${L} · 지역 문항 ${localN}`);
  ok(full === b.plan.length, `${L} 정답 입력 = 만점 ${full}/${b.plan.length}`);
  const d = await emit(s, "know:begin", { mode: "daily", device: "pc", lang: L });
  ok(d.ok && _knowTest.SESS.get(d.sid).plan.every((p) => !isLocal(STORE.all.get(p.id))), `${L} 오늘의 챌린지 세트 지역 문항 없음`);
  s.close();
}
const k = await conn("guest_i18n_ko0001"); const kb = await emit(k, "know:begin", { mode: "daily", device: "pc" }); ok(kb.ok, "한국어(언어 안 보냄) 그대로 동작"); k.close();
console.log(`\n상식 다국어 시험: 통과 ${pass} · 실패 ${fail}`);
server.close(); process.exit(fail ? 1 : 0);
