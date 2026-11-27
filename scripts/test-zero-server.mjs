// 격리구역: 제로 서버 시험 (실제 소켓): node scripts/test-zero-server.mjs
// 협동 2·4·8인(역할 자동 배정·권한·충돌·하루 끝까지·다음 날) · 재접속(역할 복구) · 방장 이탈 → 이전 · 진행 중 참여 · 관전자 50명(프레임 수신) · 투표(웹+채팅) · 시청자 직원 지원·승인 · 모의 후원(중복 차단·쿨타임) · 잘못된 요청 거절
process.env.ZERO_FAST = "0.05";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
const { registerZero, _test } = await import("../src/zero.js");
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
let chatCb = null, donCb = null;
registerZero(io, null, { linkChat: async (o) => { chatCb = o.onChat; donCb = o.onDonation; return { ok: true, nickname: "TestCh", donationSubscribed: true }; }, unlinkChat: () => {} });
await new Promise((r) => server.listen(0, r)); const BASE = `http://localhost:${server.address().port}`;
const conn = (uid) => new Promise((res) => { const s = ioc(BASE, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); s.on("connect_error", (e) => console.log("connect_error", e.message)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, err: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const track = (s) => { const t = { full: 0, tick: 0, room: null, S: null, dons: [] }; s.on("zero:full", (x) => { t.full++; t.S = x; }); s.on("zero:tick", () => t.tick++); s.on("zero:room", (r) => (t.room = r)); s.on("zero:don", (d) => t.dons.push(d)); return t; };

async function coop(n) {
  console.log(`— 협동 ${n}인`);
  const socks = [], tr = [];
  for (let i = 0; i < n; i++) { const s = await conn(`u${n}_${i}`); socks.push(s); tr.push(track(s)); }
  const c = await emit(socks[0], "zero:create", { name: "Host" }); console.log("  create", c.ok, c.err); ok(c.ok, "create"); const code = c.room.code;
  for (let i = 1; i < n; i++) { const j = await emit(socks[i], "zero:join", { code, name: "P" + i }); ok(j.ok, "join " + i); }
  await sleep(150);
  const room = _test.ROOMS.get(code); ok(room.players.length === n, "players " + n);
  const allRoles = new Set(room.players.flatMap((p) => p.roles)); ok(_test.ROOMS && ["manager", "research", "security", "medical", "tech", "hr", "records", "explore"].every((r) => allRoles.has(r)), "all roles assigned");
  ok(room.players[0].roles.includes("manager"), "host manager");
  // 방장 아니면 시작 못 함
  if (n > 1) ok(!(await emit(socks[1], "zero:begin", { code })).ok, "non-host cannot begin");
  ok((await emit(socks[0], "zero:begin", { code })).ok, "begin");
  await sleep(300); ok(tr.every((t) => t.full > 0 && t.S), "all got full state");
  ok(room.S.players === n, "players scale");
  // 아침 준비: 권한 있는 사람만 건설
  const lot = room.S.rooms.find((r) => r.type === "lot");
  if (n > 1) { const techUser = room.players.find((p) => p.roles.includes("tech") && p.uid !== room.host); const other = room.players.find((p) => !p.roles.includes("tech") && !p.roles.includes("manager"));
    if (other) { const so = socks[room.players.indexOf(other)]; ok((await emit(so, "zero:cmd", { code, c: { k: "build", rid: lot.id, t: "lab" } })).err === "role", "role blocks build"); }
    if (techUser) { const st = socks[room.players.indexOf(techUser)]; ok((await emit(st, "zero:cmd", { code, c: { k: "build", rid: lot.id, t: "lab" } })).ok, "tech builds"); } }
  ok((await emit(socks[0], "zero:cmd", { code, c: { k: "start" } })).ok, "start day");
  // 충돌: 두 사람이 같은 직원에게
  if (n > 1) {
    const r1 = await emit(socks[0], "zero:cmd", { code, c: { k: "order", sid: 1, task: { k: "rest" } } });
    const p1 = room.players[1], s1 = socks[1];
    const r2 = await emit(s1, "zero:cmd", { code, c: { k: "order", sid: 1, task: { k: "move", rid: 0 } } });
    ok(r1.ok && !r2.ok && r2.err === "conflict" && r2.who === "Host", "conflict detected");
  }
  // 잘못된 요청
  ok(!(await emit(socks[0], "zero:cmd", { code, c: null })).ok, "bad cmd"); ok(!(await emit(socks[0], "zero:cmd", { code, c: { k: "order", sid: 999, task: { k: "rest" } } })).ok, "bad staff");
  ok(!(await emit(socks[0], "zero:cmd", { code: "ZZZZZ", c: { k: "start" } })).ok, "not in room");
  // 하루를 빨리: 배속 2 + 서버 상태 직접 빨리 감기 (클라는 연구 명령)
  ok((await emit(socks[0], "zero:opts", { code, speed: 2 })).ok, "speed");
  const resUsers = room.players.filter((p) => p.roles.some((r) => ["research", "records", "explore", "manager"].includes(r)));
  for (let k = 0; k < 40 && room.S.phase === "work"; k++) {
    for (const p of resUsers) { const s = socks[room.players.indexOf(p)]; const free = room.S.staff.find((x) => x.job === "researcher" && x.cond === "ok" && !x.task && !x.panic); const a = room.S.anoms.find((q) => q.st === "in" && !room.S.staff.some((o) => o.task?.aid === q.id)); if (free && a) await emit(s, "zero:cmd", { code, c: { k: "order", sid: free.id, task: { k: "research", aid: a.id, m: "observe" } } }); }
    if (room.S.ev.cur) await emit(socks[0], "zero:cmd", { code, c: { k: "choose", i: 0 } });
    for (let q = 0; q < 140 && room.S.phase === "work" && !room.S.ev.cur; q++) (await import("../src/zero/zero-core.js")).step(room.S);
    await sleep(60);
  }
  ok(room.S.phase === "end", "day ended " + room.S.phase); await sleep(2200);
  ok(tr.every((t) => t.S?.phase === "end"), "clients see end");
  ok(tr[0].tick > 3, "light frames " + tr[0].tick);
  ok((await emit(socks[0], "zero:cmd", { code, c: { k: "next" } })).ok, "next day"); ok(room.S.day === 2, "day 2");
  // 재접속: 1번 끊었다 다시 → 역할 복구, 방장 이탈 → 다음 사람
  if (n > 1) {
    const roles1 = room.players[1].roles.slice(); socks[1].disconnect(); await sleep(150); ok(!room.players[1].on, "offline marked");
    ok(_test.myRoles(room, room.host).some((x) => roles1.includes(x)), "host covers offline roles");
    socks[1] = await conn(`u${n}_1`); tr[1] = track(socks[1]); const j = await emit(socks[1], "zero:join", { code, name: "P1" }); ok(j.ok && j.state && room.players[1].on && room.players[1].roles.join() === roles1.join(), "rejoin keeps roles");
    socks[0].disconnect(); await sleep(150); ok(room.host === room.players[1].uid, "host moved");
  }
  // 진행 중 참여
  const late = await conn(`late_${n}`); const lj = await emit(late, "zero:join", { code, name: "Late" });
  ok(n < 8 ? lj.ok && room.players.length === n + 1 : !lj.ok && lj.err === "full", "late join " + n);
  for (const s of [...socks, late]) s.disconnect();
}
await coop(1); await coop(2); await coop(4); await coop(8);

// ---------- 스트리머 ----------
console.log("— 스트리머 + 시청자 50");
{
  const host = await conn("streamer"), th = track(host);
  const c = await emit(host, "zero:create", { name: "Streamer", stream: true }); ok(c.ok && c.room.mode === "stream", "stream room"); const code = c.room.code;
  const room = _test.ROOMS.get(code);
  const viewers = []; for (let i = 0; i < 50; i++) { const v = await conn(`v${i}`); const t = track(v); const w = await emit(v, "zero:watch", { code, nick: "V" + i }); if (!w.ok) ok(false, "watch " + i); viewers.push({ s: v, t }); }
  ok(room.viewers.size === 50, "50 viewers");
  ok((await emit(host, "zero:begin", { code })).ok, "begin"); ok((await emit(host, "zero:cmd", { code, c: { k: "start" } })).ok, "start");
  await sleep(800); ok(viewers.every((v) => v.t.full > 0), "viewers got state"); ok(viewers[0].t.tick > 0, "viewers got frames");
  // 시청자는 명령 불가
  ok(!(await emit(viewers[0].s, "zero:cmd", { code, c: { k: "mute" } })).ok, "viewer cannot cmd");
  // 투표: 열고 → 웹 투표 + 채팅 투표 → 마감 적용
  await emit(host, "zero:stream", { code, votes: false }); room.st.vote = null;
  ok((await emit(host, "zero:voteNow", { code, kind: "supply" })).ok, "vote open");
  const m0 = room.S.res.money;
  for (let i = 0; i < 30; i++) await emit(viewers[i].s, "zero:vote", { code, i: 1 });
  for (let i = 30; i < 40; i++) await emit(viewers[i].s, "zero:vote", { code, i: 0 });
  ok((await emit(viewers[0].s, "zero:vote", { code, i: 1 })).ok, "same vote ok"); ok(!(await emit(viewers[0].s, "zero:vote", { code, i: 9 })).ok, "bad option");
  await emit(host, "zero:streamLink", { code, platform: "chzzk", accessToken: "x" }); ok(!!chatCb && room.st.link.status === "connected", "chat linked (mock)");
  chatCb({ content: "!2", senderChannelId: "c1", profile: { nickname: "ChatA" } }); chatCb({ content: "!2", senderChannelId: "c1", profile: { nickname: "ChatA" } });
  ok(room.st.vote.counts[1] === 31, "chat vote counted once " + room.st.vote.counts.join());
  const vv = room.st.vote; vv.until = Date.now() - 1; await sleep(150);
  ok(vv.result === 1 && room.S.res.money === m0 + 150, "vote applied (+150 funds) " + vv.result + " " + (room.S.res.money - m0));
  // 시청자 직원 지원 → 승인
  const n0 = room.S.staff.length;
  ok((await emit(viewers[5].s, "zero:apply", { code, nick: "시청자왕" })).ok, "apply"); ok(!(await emit(viewers[5].s, "zero:apply", { code, nick: "시청자왕" })).ok, "dup apply");
  chatCb({ content: "!지원", senderChannelId: "c2", profile: { nickname: "채팅러" } });
  ok(room.st.applicants.length === 2, "applicants 2");
  ok((await emit(host, "zero:approve", { code, name: "시청자왕" })).ok && room.S.staff.length === n0 + 1 && room.S.staff.at(-1).viewer, "approved viewer staff");
  ok(!(await emit(viewers[1].s, "zero:approve", { code, name: "채팅러" })).ok, "viewer cannot approve");
  // 후원: 시험 후원 + 플랫폼 후원(중복 ID 한 번만) + 쿨타임
  const t1 = await emit(host, "zero:streamTest", { code, kind: "research" }); ok(t1.ok && t1.rec.status === "applied", "test donation applied");
  room.st.lastDon = 0; donCb({ payAmount: "2000", donatorNickname: "후원왕", donationId: "D1" }); donCb({ payAmount: "2000", donatorNickname: "후원왕", donationId: "D1" });
  ok(room.st.log.filter((d) => d.donor === "후원왕").length === 1 && room.S.staff.some((s) => s.name[0] === "후원왕"), "donation dedupe + donor staff");
  donCb({ payAmount: "1000", donatorNickname: "B", donationId: "D2" }); ok(room.st.log.at(-1).status === "cooldown", "cooldown");
  ok(!(await emit(host, "zero:stream", { code, rules: { supply: 1000, env: 1000 } })).ok, "same amount rejected");
  ok((await emit(host, "zero:stream", { code, rules: { supply: 1500 } })).ok && room.st.rules.supply === 1500, "rules saved");
  // 사건: 시청자 투표로 정해짐
  const C = await import("../src/zero/zero-core.js"); C.forceEvent(room.S, "ev_birthday"); await sleep(300);
  ok(room.st.vote?.kind === "event" || room.st.vote === null, "event vote opened " + room.st.vote?.kind);
  if (room.st.vote?.kind === "event") { for (let i = 0; i < 5; i++) await emit(viewers[i].s, "zero:vote", { code, i: 0 }); room.st.vote.until = Date.now() - 1; await sleep(300); ok(!room.S.ev.cur, "event resolved by vote"); }
  await sleep(300); ok(th.dons.length >= 2 && viewers[3].t.dons.length >= 2, "donation broadcast");
  for (const v of viewers) v.s.disconnect(); host.disconnect();
}
console.log(`pass ${pass} fail ${fail}`); server.close(); io.close(); process.exit(fail ? 1 : 0);
