// 상식 진단소 서버 시험 (가짜 Supabase + 실제 Socket.IO)
// 정답 숨김 · 순서 강제 · 중복 제출 · 시간 초과 · 단서 단계 · 저장/비공개 · 챌린지 재도전 순위 제외 · 랭킹 · 찍기 보정 · 공용 파일 동일
import http from "http";
import fs from "fs";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { DB, sb } from "./fake-supabase.mjs";
import { registerKnow, _knowTest, serve, buildPlan, STORE } from "../src/know.js";
const POOL = STORE.pool;
import * as C from "../src/know-core.js";

DB.know_results = [];
process.env.KNOW_RL = "100000";
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(); app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
const getOptionalUser = async (req) => { const a = req.headers.authorization || ""; return a.startsWith("Bearer u_") ? { id: a.slice(7) } : null; };
DB.know_reports = []; DB.know_questions = []; DB.know_qstats = [];
const requireAdmin = (req, res, next) => { const a = req.headers.authorization || ""; if (a !== "Bearer admin_ok") return res.status(a ? 403 : 401).json({ ok: false, error: "FORBIDDEN" }); req.user = { email: "op@test" }; next(); };
registerKnow(io, sb, app, { getOptionalUser, requireAdmin });
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const get = async (path, headers = {}) => { const r = await fetch(URL + path, { headers }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
const prof = (nick) => ({ nick, age: 25, avatar: { skin: 1, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });
const LEAK = /"(exp|src|ans|years|truth|key|value|clues_all)":/;

// 서버 세션에서 정답 키를 꺼내 정답 만들기 (시험 전용)
const rightOf = (sid, i) => { const sv = _knowTest.SESS.get(sid).served[i]; return sv.pub.kind === "num" ? sv.key.v : sv.key; };
const wrongOf = (sid, i) => {
  const sv = _knowTest.SESS.get(sid).served[i], k = sv.key;
  switch (sv.pub.kind) { case "ox": return !k; case "num": return k.abs ? k.v + k.far + 5 : k.v * (1 + k.far) * 2; case "order": case "pair": return [...k].reverse(); default: return (k + 1) % (sv.pub.opts || sv.pub.codes || sv.pub.stmts).length; }
};
async function run(s, mode, { quality = 1, area, isPublic = true, nick = "테스터", guess = false } = {}) {
  const b = await emit(s, "know:begin", { mode, area, device: "pc" });
  if (!b.ok) return b;
  let r0 = C.rng(99);
  for (let i = 0; i < b.plan.length; i++) {
    const it = await emit(s, "know:item", { sid: b.sid, idx: i });
    if (!it.ok) return it;
    if (LEAK.test(JSON.stringify(it))) ok(false, `정답 재료 노출 ${it.item.id}`);
    let ans;
    if (guess) { const p = it.item; ans = p.kind === "ox" ? r0() < 0.5 : p.kind === "num" ? p.num.min + r0() * (p.num.max - p.num.min) : p.kind === "order" ? C.shuffle(p.events.map((_, k) => k), r0) : p.kind === "pair" ? C.shuffle(p.left.map((_, k) => k), r0) : Math.floor(r0() * (p.opts || p.codes || p.stmts).length); }
    else ans = (i / b.plan.length) < quality ? rightOf(b.sid, i) : wrongOf(b.sid, i);
    const a = await emit(s, "know:answer", { sid: b.sid, idx: i, answer: ans });
    if (!a.ok) return a;
  }
  const f = await emit(s, "know:finish", { sid: b.sid, profile: prof(nick), prefs: {}, isPublic });
  return { ...f, sid: b.sid, plan: b.plan };
}

// ---- 공용 파일 동일 ----
const front = "../홈페이지 제작/js/know/";
for (const f of ["know-core.js", "know-geo.js"]) { const a = fs.readFileSync(`src/${f}`, "utf8"), p = front + f; ok(fs.existsSync(p) && fs.readFileSync(p, "utf8") === a, `화면 ${f}가 서버와 다름`); }
ok(!fs.existsSync(front + "know-bank.js"), "문제은행이 화면 폴더에 있음(정답 노출)");

// ---- 출제 ----
for (const m of ["quick", "full", "daily"]) { const p = buildPlan(m, 12345); ok(p.length === C.PLANS[m].n, `${m} 문항 수 ${p.length}`); ok(new Set(p.map((x) => x.id)).size === p.length, `${m} 중복`); const g = p.map((x) => POOL.find((q) => q.id === x.id).game); ok(g[g.length - 1] === "final", `${m} 마지막이 최후의 상식왕 아님`); }
ok(JSON.stringify(buildPlan("daily", 7)) === JSON.stringify(buildPlan("daily", 7)), "같은 seed 같은 세트");
ok(JSON.stringify(serve(POOL[0], 1).pub.opts) !== JSON.stringify(serve(POOL[0], 2).pub.opts) || JSON.stringify(serve(POOL[0], 3).pub.opts) !== JSON.stringify(serve(POOL[0], 1).pub.opts), "보기 순서가 안 섞임");
{ const pos = new Set(); for (let s = 1; s < 60; s++) pos.add(serve(POOL.find((q) => q.kind === "mcq"), s).key); ok(pos.size === 4, `정답 위치가 고르지 않음 ${[...pos]}`); }

// ---- 소켓 흐름 ----
const g1 = await conn("guest_aaaa1111");
{
  const b = await emit(g1, "know:begin", { mode: "quick", device: "pc" });
  ok(b.ok && b.plan.length === 15, "begin");
  ok(!LEAK.test(JSON.stringify(b)), "begin 응답에 정답");
  ok((await emit(g1, "know:item", { sid: b.sid, idx: 1 })).error === "BAD_IDX", "순서 건너뛰기 막기");
  const it = await emit(g1, "know:item", { sid: b.sid, idx: 0 });
  ok(it.ok && !LEAK.test(JSON.stringify(it)), "item 정답 숨김");
  const a1 = await emit(g1, "know:answer", { sid: b.sid, idx: 0, answer: rightOf(b.sid, 0) });
  ok(a1.ok && a1.res.part === 1 && a1.reveal?.exp && a1.reveal.src?.length, "정답 채점 + 해설 공개");
  const a2 = await emit(g1, "know:answer", { sid: b.sid, idx: 0, answer: wrongOf(b.sid, 0) });
  ok(a2.dup && a2.res.part === 1, "중복 제출은 처음 결과 유지");
  ok((await emit(g1, "know:finish", { sid: b.sid, profile: prof("a") })).error === "NOT_COMPLETE", "다 안 풀고 끝내기 막기");
  // 시간 초과: 받은 시각을 과거로
  await emit(g1, "know:item", { sid: b.sid, idx: 1 });
  _knowTest.SESS.get(b.sid).st[1].at -= 120000;
  const a3 = await emit(g1, "know:answer", { sid: b.sid, idx: 1, answer: rightOf(b.sid, 1) });
  ok(a3.ok && a3.res.timeout && a3.res.part === 0, "시간 초과 0점");
  const other = await conn("guest_bbbb2222");
  ok((await emit(other, "know:item", { sid: b.sid, idx: 2 })).error === "NO_SESSION", "남의 세션 접근 막기");
  other.close();
}
// 정체를 밝혀라: 단서 받으면 단계 내려감
{
  const q = POOL.find((x) => x.kind === "reveal");
  const s = await conn("guest_cccc3333");
  const b = await emit(s, "know:begin", { mode: "quick" });
  const S = _knowTest.SESS.get(b.sid); S.plan[0] = { id: q.id, seed: 5 }; delete S.served[0];
  const it = await emit(s, "know:item", { sid: b.sid, idx: 0 });
  ok(it.item.clues.length === 1 && it.item.clueN === q.clues.length, "단서 1개만 먼저");
  const c = await emit(s, "know:clue", { sid: b.sid, idx: 0 }); await emit(s, "know:clue", { sid: b.sid, idx: 0 });
  ok(c.ok && c.clues.length === 2, "단서 추가");
  const a = await emit(s, "know:answer", { sid: b.sid, idx: 0, answer: rightOf(b.sid, 0) });
  ok(a.res.stage === 3 && Math.abs(a.res.part - 0.7) < 1e-9, `3단계 정답 = 0.7 (${a.res.part})`);
  s.close();
}
// 끝까지 + 저장 + 비공개
{
  const s = await conn("u_marin");
  const r = await run(s, "full", { quality: 1, nick: "마린" });
  ok(r.ok && r.id && r.result.total === 100 && r.result.lv === 10, `만점 100점 LV10 (${r.result?.total})`);
  ok(DB.know_results.length === 1 && DB.know_results[0].owner_key === "u:u_marin" && DB.know_results[0].nickname === "마린", "회원 닉네임으로 저장");
  ok(!JSON.stringify(r.result).includes("owner_key"), "결과에 소유 키 안 나감");
  const pub = await get(`/know/result/${r.id}`); ok(pub.ok && !pub.result.mine, "공개 결과 보기");
  const rv = await get(`/know/review/${r.id}`); ok(rv.ok && rv.items.length === 40 && rv.items.every((x) => x.reveal.exp), "복습");
  const g = await conn("guest_dddd4444");
  const p2 = await run(g, "quick", { quality: 0.5, isPublic: false, nick: "숨김" });
  ok((await get(`/know/result/${p2.id}`)).status === 403, "비공개는 남에게 403");
  ok((await get(`/know/result/${p2.id}`, { "x-iq-guest": "guest_dddd4444" })).ok, "비공개도 본인은 보기");
  const rk = await get("/know/ranking?mode=full"); ok(rk.ok && rk.rows.length === 1 && rk.rows[0].nick === "마린" && !JSON.stringify(rk).includes("owner_key"), "랭킹 (소유 키 숨김)");
  ok((await get("/know/ranking?mode=quick")).rows.length === 0, "비공개 빠른검사는 랭킹 제외 + 모드 분리");
  // 챌린지 두 번째는 순위 제외
  const d1 = await run(s, "daily", { quality: 0.8 }), d2 = await run(s, "daily", { quality: 1 });
  ok(!d1.repeat && d2.repeat && DB.know_results.find((x) => x.id === d2.id).flagged, "챌린지 두 번째 순위 제외");
  ok(JSON.stringify(d1.plan) === JSON.stringify(d2.plan), "챌린지는 모두 같은 문제");
  const other = await conn("u_lemur");
  ok((await get(`/know/review/${d1.id}`)).error === "SPOILER", "오늘 챌린지 정답은 남에게 숨김");
  // 분야별
  const ar = await run(other, "area", { area: "science", quality: 1, nick: "레무르" });
  ok(ar.ok && ar.result.items.every((x) => x.area === "science"), "분야별 검사는 그 분야만");
  ok((await emit(other, "know:begin", { mode: "area", area: "zzz" })).error === "BAD_AREA", "잘못된 분야");
  // 중복 출제 줄이기: 연속 빠른검사 두 번이면 겹침이 적어야
  const q1 = await emit(other, "know:begin", { mode: "quick" }), q2 = await emit(other, "know:begin", { mode: "quick" });
  const ids = (b) => _knowTest.SESS.get(b.sid).plan.map((x) => x.id); const ov = ids(q1).filter((x) => ids(q2).includes(x)).length;
  ok(ov <= 8, `연속 검사 문항 겹침 ${ov}/15`);
  // 도감
  const dex = await emit(s, "know:dex", {}); ok(dex.ok && Object.keys(dex.seen).length >= 40, "상식 도감");
  s.close(); g.close(); other.close();
}
// 찍기 보정: 다 찍으면 평균 0점 근처, 반만 알면 50점 근처
{
  const s = await conn("guest_eeee5555"); let sum = 0;
  for (let k = 0; k < 12; k++) { const r = await run(s, "full", { guess: true, isPublic: false }); sum += r.result.total; }
  ok(sum / 12 <= 20, `다 찍기 평균 ${sum / 12}점 (20 이하여야)`); console.log("  다 찍기 평균", (sum / 12).toFixed(1));
  const half = await run(s, "full", { quality: 0.5, isPublic: false });
  ok(half.result.total >= 30 && half.result.total <= 62, `절반 정답 ${half.result.total}점`); console.log("  절반 맞고 절반 틀림", half.result.total);
  s.close();
}
// 진단 유형·레벨 범위
{
  ok(C.TYPES.length >= 30, `진단 유형 ${C.TYPES.length}종`);
  const r = C.rng(3); const types = new Set();
  for (let k = 0; k < 3000; k++) {
    const res = buildPlan("full", k + 1).map((p) => { const q = POOL.find((x) => x.id === p.id); const skill = r(); return { id: q.id, game: q.game, kind: q.kind, area: q.area, d: q.d, part: r() < 0.25 + skill * 0.7 - (q.d - 2) * 0.1 ? 1 : 0, c: q.kind === "ox" ? 0.5 : 0.25 }; });
    const d = C.diagnose(res, { mode: "full" }); types.add(d.type.id);
    if (!(d.total >= 0 && d.total <= 100 && d.level.lv >= 1 && d.level.lv <= 10)) { ok(false, "점수 범위"); break; }
  }
  ok(types.size >= 12, `시뮬레이션에 나온 유형 ${types.size}종`);
}
// ---- 2차: 연습 모드·신고·관리자·문제 부족 ----
{
  const s = await conn("u_lemur");
  // 취약 분야 연습: 문항이 하나씩 정해지고, 잘 맞히면 난이도가 올라감
  const b = await emit(s, "know:begin", { mode: "weak", area: "science" });
  ok(b.ok && b.plan.length === 10 && b.plan[0].game === null, "취약 분야 연습 시작 (미리 정하지 않음)");
  const ds = [];
  for (let i = 0; i < 10; i++) { const it = await emit(s, "know:item", { sid: b.sid, idx: i }); ok(it.ok && it.item.area === "science", `연습 ${i} 분야`); ds.push(it.item.d); await emit(s, "know:answer", { sid: b.sid, idx: i, answer: rightOf(b.sid, i) }); }
  ok(ds[ds.length - 1] >= ds[0] && Math.max(...ds.slice(5)) >= 3, `잘 맞히면 난이도 올라감 ${ds}`);
  const f = await emit(s, "know:finish", { sid: b.sid, profile: prof("레무르") });
  ok(f.ok && DB.know_results.find((x) => x.id === f.id)?.flagged === true, "연습 기록은 랭킹 제외");
  // 오답 다시 풀기
  const g = await conn("guest_rrrr7777");
  ok((await emit(g, "know:begin", { mode: "retry" })).error === "NO_WRONG", "틀린 문제 없으면 안내");
  const w = await run(g, "quick", { quality: 0.4, isPublic: false });
  const rb = await emit(g, "know:begin", { mode: "retry" });
  const wrongSet = new Set(w.result.items.filter((x) => x.part < 1).map((x) => x.id));
  ok(rb.ok && _knowTest.SESS.get(rb.sid).plan.every((p) => wrongSet.has(p.id)), "오답 다시 풀기 = 예전 오답만");
  // 오류 신고: 본 문제만, 한 번만
  const seenId = w.result.items[0].id;
  ok((await emit(g, "know:report", { qid: "Z9999", reason: "typo" })).error === "NOT_SEEN", "안 본 문제 신고 막기");
  ok((await emit(g, "know:report", { qid: seenId, reason: "bad" })).error === "BAD_REASON", "신고 사유 확인");
  ok((await emit(g, "know:report", { qid: seenId, reason: "wrong_answer", note: "<b>x</b>" })).ok && DB.know_reports.length === 1 && !DB.know_reports[0].note.includes("<"), "신고 저장");
  // 관리자: 권한 없으면 막힘
  ok((await get("/admin/know/summary")).status === 401 && (await get("/admin/know/summary", { authorization: "Bearer u_marin" })).status === 403, "관리자 아니면 막힘");
  const A = { authorization: "Bearer admin_ok", "content-type": "application/json" };
  const sum = await get("/admin/know/summary", A); ok(sum.ok && sum.live === POOL.length, "관리자 요약");
  const ls = await get("/admin/know/questions?reported=1", A); ok(ls.ok && ls.rows.length === 1 && ls.rows[0].errorReportCount === 1 && ls.rows[0].questionId === seenId, "신고된 문제 목록 + 표준 필드");
  const put = async (id, body) => { const r = await fetch(URL + `/admin/know/questions/${id}`, { method: "PUT", headers: A, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
  const good = { area: "science", sub: "천문", game: "science", kind: "mcq", d: 2, q: "얼음과 암석으로 된 넓은 고리가 가장 뚜렷하게 보이는 행성은?", opts: ["토성", "목성", "천왕성", "해왕성"], exp: "토성의 고리는 얼음 알갱이와 암석 조각으로 되어 있고, 작은 망원경으로도 보일 만큼 뚜렷해요.", src: [{ t: "NASA", u: "https://science.nasa.gov/saturn/" }], status: "approved", tags: [] };
  ok((await put("S9001", { ...good, opts: ["토성", "토성", "천왕성", "해왕성"] })).error === "INVALID", "보기 중복이면 저장 거부");
  const r1 = await put("S9001", good); ok(r1.ok && r1.live && DB.know_questions.length === 1 && STORE.pool.some((q) => q.id === "S9001"), "새 문제 등록 → 바로 출제 목록");
  ok((await put("S9002", { ...good })).error === "DUPLICATE", "같은 문제 중복 등록 막기");
  const st = await fetch(URL + "/admin/know/questions/S9001/status", { method: "PATCH", headers: A, body: JSON.stringify({ status: "disabled" }) }).then((r) => r.json());
  ok(st.ok && !st.live && !STORE.pool.some((q) => q.id === "S9001"), "비활성화하면 출제 안 함");
  ok((await get("/admin/know/dupes", A)).ok, "중복 확인");
  ok((await get("/admin/know/reports", A)).rows.length === 1, "신고 목록");
  // 문제 부족: 분야 문항이 모자라면 이유를 알려 줌 (같은 문제 반복 안 함)
  const saved = STORE.pool; let lifeLeft = 3; STORE.pool = saved.filter((q) => q.area !== "life" || lifeLeft-- > 0);
  const ne = await emit(s, "know:begin", { mode: "area", area: "life" });
  ok(ne.error === "NOT_ENOUGH_ITEMS" && ne.detail?.need === 10 && ne.detail.have < 10, `문제 부족 안내 ${JSON.stringify(ne.detail)}`);
  STORE.pool = saved;
  s.close(); g.close();
}
// 비슷한 문제가 한 세트에 같이 안 나옴
{ let bad = 0; const { similarity, contentText } = await import("../src/know-validate.js");
  for (let k = 1; k <= 100; k++) { const qs = buildPlan("full", k).map((p) => POOL.find((q) => q.id === p.id)); for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) if (similarity(contentText(qs[i]), contentText(qs[j])) > 0.45) bad++; }
  ok(bad <= 5, `비슷한 문제 같이 출제 ${bad}건/100세트`); }
// 요청 제한
{
  process.env.KNOW_RL = "60";
  const s = await conn("guest_ffff6666"); let lim = false;
  for (let k = 0; k < 70; k++) { const r = await emit(s, "know:resume", { sid: "x" }); if (r.error === "RATE_LIMITED") { lim = true; break; } }
  ok(lim, "요청 제한"); s.close();
}
g1.close();
console.log(`\n상식 진단소 서버 시험: 통과 ${pass} · 실패 ${fail}`);
server.close(); process.exit(fail ? 1 : 0);
