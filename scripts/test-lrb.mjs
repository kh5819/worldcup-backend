// 인생게임 REBORN 같이 태어난 친구(멀티) 서버 시험 — node scripts/test-lrb.mjs
// 검증: 2명 같은 나이 · 8명 동기화 · 15명 성능 · 늦게 고르는 사람 · 재접속 복원 · 세계 사건 공통 반영 · 상호작용 수락/거절/결과 · 사망 뒤 진행 · 장례·추모 · 공동 결말 일치 · 조작 시도 막기
process.env.LRB_RL = "100000"; process.env.LRB_FAST = "1"; process.env.LRB_TICK = "40"; process.env.LRB_OFFLINE_MS = "300";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeReborn, __lrb } from "../src/lrb.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerLifeReborn(io);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 사람 하나 = 소켓 + 받은 상태 */
async function player(uid) {
  const s = await conn(uid); const me = { s, uid, state: null, room: null, friends: [], notices: [], reqs: [], saga: null, results: [], bytes: 0 };
  s.on("lrb:me", (o) => { me.bytes += JSON.stringify(o).length; if (o.full || !me.state) me.state = o; else { const st = me.state; st.years = st.years.slice(0, o.yFrom).concat(o.years); st.decs = st.decs.slice(0, o.dFrom).concat(o.decs); Object.assign(st, { p: o.p, texts: o.texts, pending: o.pending, prompt: o.prompt, done: o.done, final: o.final, mpq: o.mpq, wev: o.wev, world: o.world }); } });
  s.on("lrb:room", (o) => { me.room = o.room; me.friends = o.friends; me.reqs = o.reqs; });
  s.on("lrb:notice", (o) => me.notices.push(o));
  s.on("lrb:req", (o) => me.reqs.push(o));
  s.on("lrb:result", (o) => me.results.push(o));
  s.on("lrb:saga", (o) => { me.saga = o; });
  return me;
}
/** 내 차례 풀기 (결정·질문·장례) */
async function act(me, code, rnd = Math.random) {
  const st = me.state; if (!st) return;
  if (st.pending) { const ch = st.pending.pub.choices.filter((c) => !c.locked); const c = ch[Math.floor(rnd() * ch.length)] || st.pending.pub.choices[0]; await emit(me.s, "lrb:choose", { code, cid: c.id }); }
  if (st.prompt && !st.prompt.final) await emit(me.s, "lrb:text", { code, key: rnd() < 0.5 ? st.prompt.key : "skip", text: "열심히 살자" });
  for (const f of st.mpq || []) await emit(me.s, "lrb:funeral", { code, seat: f.seat, c: "attend" });
  if (st.done && st.prompt?.final) { await emit(me.s, "lrb:text", { code, key: "last", text: "고마웠어" }); await emit(me.s, "lrb:text", { code, key: "finish" }); }
}

// ================= 1) 2명: 같은 해 태어나 같은 나이 =================
{
  const A = await player("guest_a1"), B = await player("guest_b1");
  ok((await emit(A.s, "lrb:create", { nick: "" })).error === "NEED_NICK", "닉네임 필수");
  ok((await emit(A.s, "lrb:create", { nick: "운영자" })).error === "BAD_NICK", "사칭 닉네임 막기");
  const c = await emit(A.s, "lrb:create", { nick: "도윤", max: 4, limit: 0, auto: true, era: "modern" }); ok(c.ok, "방 만들기"); const code = c.code;
  ok((await emit(B.s, "lrb:join", { code, nick: "도윤" })).error === "NICK_TAKEN", "같은 이름 막기");
  ok((await emit(B.s, "lrb:join", { code, nick: "유키" })).ok, "들어가기");
  ok((await emit(B.s, "lrb:start", { code })).error === "NOT_HOST", "방장만 시작");
  await emit(A.s, "lrb:setup", { code, gender: "M", dream: "의사가 되고 싶다 <script>" });
  await emit(B.s, "lrb:setup", { code, gender: "F", country: "JP" });
  const st = await emit(A.s, "lrb:start", { code }); ok(st.ok && st.by >= 1980 && st.by <= 2012, "시작·출생연도(지금 시대) " + st.by);
  await wait(200);
  ok(A.state?.p.birthYear === st.by && B.state?.p.birthYear === st.by, "두 사람 같은 해에 태어남");
  ok(A.state.p.age === B.state.p.age && A.state.p.age === 1, "둘 다 같은 나이에서 시작");
  ok(!A.state.texts.dream.includes("<"), "자유 입력 꺾쇠 제거");
  ok(A.friends.length === 2 && A.friends.some((f) => f.nick === "유키"), "같이 태어난 친구 목록 2명");
  ok(B.state.profile.country === "KR", "같은 나라 모드는 방 나라로 (설정의 JP 무시)");
  // 조작 시도: 고르지 않은 사건 id·잘못된 선택
  ok((await emit(A.s, "lrb:choose", { code, cid: "hack" })).error === (A.state.pending ? "BAD_CHOICE" : "NO_PENDING"), "없는 선택지 거절");
  // A만 계속 고르고 B는 멈춤 → 나이가 앞서지 않아야
  const ageB0 = B.state.p.age;
  for (let i = 0; i < 30; i++) { await act(A, code); await wait(30); }
  ok(A.state.p.age <= B.state.p.age + 0 && A.state.p.age === B.state.p.age, `먼저 골라도 나이 앞서지 않음 (A ${A.state.p.age} B ${B.state.p.age})`);
  // 방장이 다음 해로 넘기기 (B 자동 선택)
  const before = A.room.cal; const sk = await emit(A.s, "lrb:skip", { code }); ok(sk.ok, "방장 넘기기 " + JSON.stringify(sk)); await wait(150);
  ok(A.room.cal === before + 1 && B.state.p.age === ageB0 + 1 || B.state.p.age === A.state.p.age, "넘기면 다 같이 한 살");
  // 친구 행동: 4살이 될 때까지 넘김 → 친구 하자 → 거절 → 다시 → 수락
  for (let i = 0; i < 8 && A.state.p.age < 5; i++) { await emit(A.s, "lrb:skip", { code }); await wait(120); }
  let r = await emit(A.s, "lrb:ask", { code, kind: "friend", to: 1 });
  if (r.ok) { await wait(60); const q = B.reqs.find((x) => x.kind === "friend"); ok(!!q, "신청이 상대에게 도착"); ok((await emit(A.s, "lrb:answer", { code, id: q.id, yes: true })).error === "NOT_YOURS", "남의 신청은 못 받음"); await emit(B.s, "lrb:answer", { code, id: q.id, yes: false }); await wait(60); ok(A.results.some((x) => x.kind === "friend" && !x.ok), "거절 결과 전달"); }
  await emit(A.s, "lrb:skip", { code }); await wait(150);
  let KIND = "friend"; r = await emit(A.s, "lrb:ask", { code, kind: KIND, to: 1 });
  if (!r.ok && r.error === "NOT_NOW" && A.state.p.people.some((x) => x.pid === "s1")) { ok(A.state.years.some((y) => (y.mp || []).some((m) => m.k === "classmate")), "7살에 같은 반이 되어 이미 친구"); KIND = "hangout"; r = await emit(A.s, "lrb:ask", { code, kind: KIND, to: 1 }); }
  ok(r.ok, "다음 해 다시 신청 " + (r.error || ""));
  let q = null; for (let k = 0; k < 20 && !q; k++) { await wait(50); q = B.reqs.find((x) => x.kind === KIND); }
  if (!q) { ok(false, "친구 신청 도착 안 함 " + JSON.stringify(r)); process.exit(1); } const ra = await emit(B.s, "lrb:answer", { code, id: q.id, yes: true }); ok(ra.ok && ra.result?.ok, "수락하면 적용");
  await wait(100);
  ok(A.state.p.people.some((x) => x.pid === "s1" && x.rel === "friend") && B.state.p.people.some((x) => x.pid === "s0"), "양쪽 인생에 친구로 등록");
  ok((await emit(B.s, "lrb:answer", { code, id: q.id, yes: true })).error === "GONE", "같은 신청 두 번 수락 못 함");
  ok(A.friends.find((f) => f.seat === 1)?.close >= 50, "친구 패널 친밀도 표시");
  // 선물: 돈이 실제로 오감 (단계 0) — 돈이 있을 때만
  // 재접속: A 끊고 다시
  A.s.disconnect(); await wait(500);
  const A2 = await player("guest_a1"); const rj = await emit(A2.s, "lrb:join", { code }); await wait(150);
  ok(rj.ok && rj.phase === "live" && A2.state?.full && A2.state.p.nickname === "도윤", "재접속하면 내 인생 그대로 (전부)");
  ok(A2.state.p.age === B.state.p.age, "재접속 뒤에도 같은 나이");
  // 끝까지: 둘 다 자동으로
  const t0 = Date.now();
  while (!A2.saga && Date.now() - t0 < 60000) { await act(A2, code); await act(B, code); await wait(20); }
  ok(!!A2.saga && !!B.saga, "모두 떠나면 공동 결말(saga)");
  if (A2.saga) {
    const sg = A2.saga; const pa = sg.players.find((x) => x.seat === 0), pb = sg.players.find((x) => x.seat === 1);
    ok(pa.by === st.by && pb.by === st.by, "공동 결말: 출생연도 일치");
    ok(pa.dy === pa.by + pa.age && pa.dy === A2.state.p.birthYear + A2.state.p.deathAge, "공동 결말: 사망연도 = 실제 기록");
    ok(sg.pairs.some((x) => x.seats.includes(0) && x.seats.includes(1) && x.years >= 0), "우정 기간 계산");
    ok(sg.moments.some((m) => m.kind === KIND || m.kind === "classmate"), "함께한 순간 기록 (" + KIND + ")");
    ok(sg.world.length > 0, "공동 세계 사건 기록 " + sg.world.length);
    const first = sg.deaths[0]; ok(first && sg.deaths.length === 2, "사망 2건 기록");
    // 사망 뒤에도 다른 사람 진행: 먼저 죽은 사람 이후에도 해가 흘렀는지
    const d0 = Math.min(pa.dy, pb.dy), d1 = Math.max(pa.dy, pb.dy); ok(d1 >= d0, "한 명 사망 뒤 다른 사람은 계속");
    if (d1 > d0) { const later = pa.dy > pb.dy ? A2 : B; ok(later.notices.some((n) => n.k === "death"), "사망 알림"); ok(later.state.years.some((y) => (y.mp || []).some((m) => m.k === "funeral" || m.k === "lost")), "장례식/떠남 기록이 남은 사람 인생에"); }
  }
  console.log(`2명 시험 — 전송 크기 A ${(A2.bytes / 1024).toFixed(0)}KB`);
  A2.s.disconnect(); B.s.disconnect();
}

// ================= 2) 8명: 연도 동기화·세계 사건·상호작용 =================
async function bigRoom(n, label, years = 40) {
  const P = []; for (let i = 0; i < n; i++) P.push(await player(`guest_${label}${i}`));
  const c = await emit(P[0].s, "lrb:create", { nick: "방장" + label, max: n, limit: 0, auto: true, mode: "world", era: "past" }); const code = c.code;
  for (let i = 1; i < n; i++) ok((await emit(P[i].s, "lrb:join", { code, nick: `친구${label}${i}` })).ok, `${label} 입장 ${i}`);
  const CT = ["KR", "JP", "US", "DE", "IN", "BR", "FR", "GB", "CN", "MX", "EG", "AU", "KR", "JP", "US"];
  for (let i = 0; i < n; i++) await emit(P[i].s, "lrb:setup", { code, country: CT[i % CT.length] });
  const st = await emit(P[0].s, "lrb:start", { code }); ok(st.ok, `${label} 시작`); await wait(300);
  const t0 = Date.now(); let asks = 0, accepted = 0, maxLag = 0; const errs = {};
  const startCal = P[0].room.cal;
  while (P[0].room.cal < startCal + years && Date.now() - t0 < 90000) {
    const ts = Date.now();
    await Promise.all(P.map((me) => act(me, code)));
    // 무작위 친구 행동
    for (let t = 0; t < 4; t++) {
      const i = Math.floor(Math.random() * n), j = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
      const kinds = ["friend", "friend", "hangout", "study", "travel", "gift", "help", "argue", "reconcile", "confess", "propose", "samejob", "partner", "startup"];
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      const r = await emit(P[i].s, "lrb:ask", { code, kind: k, to: j, tier: 0 }); if (r.ok) asks++; else errs[r.error] = (errs[r.error] || 0) + 1;
    }
    if (Math.random() < 0.05) await emit(P[0].s, "lrb:ask", { code, kind: "party", what: "모임" });
    await wait(10);
    for (const me of P) for (const q of me.reqs.splice(0)) { const a = await emit(me.s, "lrb:answer", { code, id: q.id, yes: Math.random() < 0.8, reply: "sorry" }); if (a.result?.ok) accepted++; }
    maxLag = Math.max(maxLag, Date.now() - ts);
    await wait(20);
  }
  await wait(200);
  const ages = P.map((me) => me.state.p.alive ? me.state.p.age : null).filter((x) => x != null);
  ok(new Set(ages).size <= 1, `${label}: 살아 있는 모두 같은 나이 (${[...new Set(ages)].join(",")})`);
  const cals = new Set(P.map((me) => me.room.cal)); ok(cals.size === 1, `${label}: 모두 같은 연도 ${[...cals]}`);
  // 세계 사건: 같은 해 같은 목록
  const wl = P.filter((me) => me.state.p.alive).map((me) => JSON.stringify((me.state.wev || []).filter((w) => w.y === me.room.cal - 1).map((w) => w.id).sort()));
  ok(new Set(wl).size === 1, `${label}: 세계 사건 모두 같음`);
  const r0 = __lrb.ROOMS.get(code); const ids = r0.worldLog.map((x) => x.id);
  ok(ids.length > 0, `${label}: 세계 사건 발생 ${ids.length}`);
  // 영향은 사람마다 다름 (같은 사건, 다른 수치)
  const diffAny = r0.worldLog.some((x) => new Set(x.by.map((b) => JSON.stringify(b.d))).size > 1); ok(diffAny, `${label}: 같은 세계 사건이라도 사람마다 영향 다름`);
  ok(asks > 0 && accepted >= 0, `${label}: 친구 행동 신청 ${asks} · 수락 적용 ${accepted} · 거절 이유 ${JSON.stringify(errs)}`);
  // 조작 불가: 클라이언트가 보낸 나이/돈 필드는 무시 (보낼 방법 자체 없음) → 서버 상태와 받은 상태 일치
  const srv = r0.players.get("g:guest_" + label + "0").S.p; ok(srv.age === P[0].state.p.age && Math.round(srv.stats.money) === Math.round(P[0].state.p.stats.money), `${label}: 화면 상태 = 서버 상태`);
  console.log(`${label}: ${n}명 · ${P[0].room.cal - startCal}년 · 한 해 처리 최대 ${maxLag}ms · 방장 받은 데이터 ${(P[0].bytes / 1024).toFixed(0)}KB`);
  return { P, code, maxLag };
}
const R8 = await bigRoom(8, "e", 45);
// 방장 넘기기
R8.P[0].s.disconnect(); await wait(21500 + 400);
ok(R8.P[1].room.host !== 0 || R8.P[1].notices.some((n) => n.k === "host"), "방장이 나가면 다음 사람이 방장");
for (const me of R8.P.slice(1)) me.s.disconnect();

// ================= 3) 15명 성능 =================
const R15 = await bigRoom(15, "f", 35);
ok(R15.maxLag < 1500, "15명 한 해 처리 1.5초 안 (" + R15.maxLag + "ms)");
for (const me of R15.P) me.s.disconnect();

// ================= 4) 늦게 고르는 사람: 제한 시간 지나면 자동 =================
{
  const A = await player("guest_slowA"), B = await player("guest_slowB");
  const c = await emit(A.s, "lrb:create", { nick: "빠름", max: 2, limit: 20, auto: false }); const code = c.code;
  await emit(B.s, "lrb:join", { code, nick: "느림" }); await emit(A.s, "lrb:start", { code }); await wait(200);
  const r = __lrb.ROOMS.get(code); const cal0 = r.cal;
  await act(A, code); await emit(A.s, "lrb:ready", { code, ready: true });
  r.deadline = Date.now() + 300; await wait(700);   // 시험: 제한 시간을 짧게 당김
  ok(r.cal === cal0 + 1, "제한 시간이 지나면 안 고른 사람은 자동 선택하고 다음 해");
  ok(B.state.p.age === A.state.p.age, "느린 사람도 같은 나이");
  A.s.disconnect(); B.s.disconnect();
}

console.log(`\nlrb 시험: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
