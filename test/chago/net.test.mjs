// 차고차고 방·네트워크 테스트 (가짜 io 사용 — 네트워크 없이 서버 로직만 검증)
import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { registerChago, shutdownChago, chagoStats, _tickForTest, _roomsForTest } from "../../src/chago.js";

// ---- 가짜 socket.io ----
class FakeIO {
  constructor() { this.sockets = new Map(); this.connHandlers = []; }
  on(ev, cb) { if (ev === "connection") this.connHandlers.push(cb); }
  to(room) {
    const deliver = (ev, data) => { for (const s of this.sockets.values()) if (s.rooms.has(room)) s.inbox.push({ ev, data }); };
    return { emit: deliver, volatile: { emit: deliver } };
  }
  in(room) { return { socketsLeave: (r) => { for (const s of this.sockets.values()) s.rooms.delete(r); } }; }
  connect(user) {
    const s = new FakeSocket(this, user);
    this.sockets.set(s.id, s);
    for (const cb of this.connHandlers) cb(s);
    return s;
  }
}
let sid = 0;
class FakeSocket {
  constructor(io, user) { this.io = io; this.id = `sock${++sid}`; this.user = user; this.handlers = {}; this.rooms = new Set([this.id]); this.inbox = []; }
  on(ev, h) { this.handlers[ev] = h; }
  join(r) { this.rooms.add(r); }
  leave(r) { this.rooms.delete(r); }
  // 클라이언트 → 서버 (ack 있으면 Promise)
  call(ev, payload) {
    return new Promise((resolve) => {
      const r = this.handlers[ev](payload, (res) => resolve(res));
      if (r && typeof r.catch === "function") r.catch(() => resolve({ ok: false, error: "THROW" }));
      // ack 없는 이벤트는 바로 끝
      if (ev === "chago:input") resolve(undefined);
    });
  }
  send(ev, payload) { this.handlers[ev](payload); }
  disconnect() { this.handlers["disconnect"]?.(); this.io.sockets.delete(this.id); }
  take(ev) { const out = this.inbox.filter((m) => m.ev === ev); this.inbox = this.inbox.filter((m) => m.ev !== ev); return out.map((m) => m.data); }
  last(ev) { const l = this.inbox.filter((m) => m.ev === ev); return l.length ? l[l.length - 1].data : null; }
}

const supa = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) };
let io;
const U = (n, guest = false) => ({ id: guest ? `guest_${n}` : `user-${n}`, isGuest: guest, isAdmin: false });
async function setup(n = 2, teamSize = 2) {
  const socks = [];
  for (let i = 0; i < n; i++) socks.push(io.connect(U(i)));
  const c = await socks[0].call("chago:createRoom", { teamSize, nickname: "호스트" });
  assert.ok(c.ok, JSON.stringify(c));
  for (let i = 1; i < n; i++) { const j = await socks[i].call("chago:joinRoom", { inviteCode: c.inviteCode, nickname: "P" + i }); assert.ok(j.ok, JSON.stringify(j)); }
  return { socks, code: c.inviteCode, roomId: c.roomId };
}

beforeEach(() => { shutdownChago(); io = new FakeIO(); registerChago(io, supa); });
afterEach(() => { shutdownChago(); mock.timers.reset(); });

test("방 만들기: 게스트는 불가, 로그인 유저는 가능 / 입장은 게스트도 가능", async () => {
  const g = io.connect(U(9, true));
  assert.equal((await g.call("chago:createRoom", {})).error, "GUEST_CANNOT_CREATE");
  const h = io.connect(U(1));
  const c = await h.call("chago:createRoom", { teamSize: 3, nickname: "<b>방장</b>" });
  assert.ok(c.ok);
  assert.equal(c.room.config.teamSize, 3);
  assert.ok(!c.room.players[0].nickname.includes("<"), "닉네임 태그 제거");
  const j = await g.call("chago:joinRoom", { inviteCode: c.inviteCode, nickname: "손님" });
  assert.ok(j.ok);
  assert.equal(j.room.players.length, 2);
  assert.equal((await g.call("chago:joinRoom", { inviteCode: "000000" })).error, "ROOM_NOT_FOUND");
});

test("팀 자동 균형 배정 + 정원 초과 시 입장 거부 + 팀 이동", async () => {
  const { socks, code } = await setup(4, 2);          // 2v2 방에 4명
  const room = (await socks[0].call("chago:requestState")).room;
  assert.deepEqual([0, 1].map((t) => room.players.filter((p) => p.team === t).length), [2, 2]);
  const extra = io.connect(U(7));
  assert.equal((await extra.call("chago:joinRoom", { inviteCode: code })).error, "ROOM_FULL");
  const mine = room.players.find((q) => q.id === "user-1").team;
  assert.equal((await socks[1].call("chago:setTeam", { team: 1 - mine })).error, "TEAM_FULL", "꽉 찬 팀으로는 이동 불가");
  assert.ok((await socks[1].call("chago:setTeam", { team: mine })).ok);
  const bad = await socks[2].call("chago:setTeam", { team: 5 });
  assert.equal(bad.error, "INVALID_TEAM");
});

test("설정: 방장만, 허용 값만, 없는 모드는 거부, 인원 줄이기 제한", async () => {
  const { socks } = await setup(3, 2);
  assert.equal((await socks[1].call("chago:setConfig", { durationSec: 120 })).error, "NOT_HOST");
  assert.equal((await socks[0].call("chago:setConfig", { durationSec: 77 })).error, "INVALID_DURATION");
  assert.equal((await socks[0].call("chago:setConfig", { mode: "nonsense" })).error, "MODE_DISABLED");
  assert.ok((await socks[0].call("chago:setConfig", { mode: "ranked" })).ok, "경쟁전(승부차기)은 열려 있음");
  await socks[0].call("chago:setConfig", { mode: "friendly" });
  assert.equal((await socks[0].call("chago:setConfig", { teamSize: 9 })).error, "INVALID_TEAM_SIZE");
  assert.equal((await socks[0].call("chago:setConfig", { botLevel: "god" })).error, "INVALID_BOT_LEVEL");
  const ok = await socks[0].call("chago:setConfig", { durationSec: 300, teamSize: 4, botLevel: "hard" });
  assert.ok(ok.ok); assert.equal(ok.config.durationSec, 300); assert.equal(ok.config.teamSize, 4);
  // 한 팀에 2명이 있으면 1로 못 줄임
  const r = await socks[0].call("chago:setConfig", { teamSize: 1 });
  assert.equal(r.error, "BELOW_CURRENT");
});

test("게임 시작: 방장만, 각자 자기 eid(you)를 받고 같은 명단을 본다", async () => {
  const { socks } = await setup(4, 2);
  assert.equal((await socks[1].call("chago:startGame")).error, "NOT_HOST");
  assert.ok((await socks[0].call("chago:startGame")).ok);
  const inits = socks.map((s) => s.take("chago:gameStart")[0]);
  assert.ok(inits.every(Boolean));
  const eids = inits.map((i) => i.you).sort();
  assert.deepEqual(eids, [0, 1, 2, 3]);
  assert.equal(inits[0].roster.length, 4);
  assert.equal(inits[0].field.W, 1000);
  assert.equal((await socks[0].call("chago:startGame")).error, "ALREADY_PLAYING");
  const late = io.connect(U(8));
  assert.equal((await late.call("chago:joinRoom", { inviteCode: (await socks[0].call("chago:requestState")).room.inviteCode })).error, "ROOM_FULL");   // 봇 자리가 없는 가득 찬 경기에는 못 들어옴
});

test("입력 → 서버 물리 → 스냅샷: 오른쪽으로 달리면 x가 늘고 ack 시퀀스가 돌아온다", async () => {
  const { socks } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  const me = socks[0].take("chago:gameStart")[0].you;
  _tickForTest(io, 100);                              // 카운트다운(3초) 통과
  socks[0].take("chago:snap");
  const readX = () => { const s = socks[0].last("chago:snap"); return s.p.find((q) => q[0] === String(me)); };
  _tickForTest(io, 2);
  const x0 = readX()[1];
  for (let i = 1; i <= 15; i++) { socks[0].send("chago:input", { s: i, mx: 1, my: 0, ax: 1, ay: 0, f: 0 }); _tickForTest(io, 1); }
  _tickForTest(io, 3);
  const p = readX();
  assert.ok(p[1] > x0 + 40, `x ${x0} → ${p[1]}`);
  assert.equal(p[9], 15, "ack 시퀀스");
});

test("스냅샷은 시뮬 30Hz 중 약 20Hz로만 나간다", async () => {
  const { socks } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  socks[0].inbox = [];
  _tickForTest(io, 60);
  const n = socks[0].take("chago:snap").length;
  assert.ok(n >= 38 && n <= 42, `2초에 ${n}개`);
});

test("입력 방어: 쓰레기·과거 시퀀스·남의 소켓·과도한 속도는 무시/제한", async () => {
  const { socks } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  _tickForTest(io, 100);
  const me = 0;
  for (const bad of [null, undefined, 5, "x", [], { s: "a", mx: "b", f: "c" }, { s: 1, mx: NaN, my: Infinity, f: 1e30 }]) socks[0].send("chago:input", bad);
  _tickForTest(io, 5);                                // 크래시 없음
  socks[0].send("chago:input", { s: 50, mx: 1, my: 0, f: 0 });
  socks[0].send("chago:input", { s: 49, mx: -1, my: 0, f: 0 });           // 과거 → 무시
  _tickForTest(io, 3);
  const snap = socks[0].last("chago:snap");
  assert.ok(snap.p.find((q) => q[0] === String(me))[3] > 0, "과거 시퀀스는 무시되어 계속 오른쪽");
  // 한도 초과: 같은 순간 500개 → 앞 일부만 받아들이고 나머지는 버린다(앞 100개는 오른쪽, 뒤는 왼쪽)
  for (let i = 100; i < 600; i++) socks[0].send("chago:input", { s: i, mx: i < 300 ? 1 : -1, my: 0, f: 0 });
  _tickForTest(io, 3);
  const after = socks[0].last("chago:snap").p.find((q) => q[0] === String(me));
  assert.ok(after[3] > 0, "한도를 넘은 입력(왼쪽)은 버려져야 함");
});

test("연결 끊김: 경기 중 입력은 즉시 중립, 10초 안 재접속하면 같은 선수로 복귀 / 넘기면 '자리 비움'", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks, code } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  const init1 = socks[1].take("chago:gameStart")[0];
  _tickForTest(io, 100);
  socks[1].disconnect();
  let st = (await socks[0].call("chago:requestState")).room.players.find((p) => p.id === "user-1");
  assert.equal(st.connected, false);
  // 재접속(새 소켓)
  const again = io.connect(U(1));
  const j = await again.call("chago:joinRoom", { inviteCode: code });
  assert.ok(j.ok && j.rejoined);
  assert.equal(j.game.you, init1.you, "같은 eid로 복귀");
  assert.ok(j.state);
  // 이번엔 10초 넘게 끊김
  again.disconnect();
  mock.timers.tick(11_000);
  st = (await socks[0].call("chago:requestState")).room.players.find((p) => p.id === "user-1");
  assert.equal(st.away, true);
});

test("한 계정이 새 소켓으로 들어오면 이전 소켓의 입력은 무시된다", async () => {
  const { socks, code } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  _tickForTest(io, 100);
  const old = socks[1];
  const fresh = io.connect(U(1));
  assert.ok((await fresh.call("chago:joinRoom", { inviteCode: code })).ok);
  old.send("chago:input", { s: 1, mx: 1, my: 0, f: 0 });                 // 옛 소켓: 무시
  _tickForTest(io, 5);
  const me = (await fresh.call("chago:requestState")).game.you;
  const p = fresh.last("chago:snap").p.find((q) => q[0] === String(me));
  assert.equal(p[3], 0);
  fresh.send("chago:input", { s: 1, mx: 1, my: 0, f: 0 });
  _tickForTest(io, 5);
  assert.ok(fresh.last("chago:snap").p.find((q) => q[0] === String(me))[3] > 0);
});

test("경기 종료: 결과 전송 후 방은 대기 상태로 남고 다시 시작할 수 있다 / 방 정리", async () => {
  const { socks } = await setup(2, 1);
  await socks[0].call("chago:setConfig", { durationSec: 120 });
  await socks[0].call("chago:startGame");
  let guard = 0;
  while (chagoStats().active > 0 && guard++ < 30 * 400) _tickForTest(io, 1);
  assert.equal(chagoStats().active, 0, "경기가 끝나야 함");
  const end = socks[1].take("chago:matchEnd")[0];
  assert.ok(end);
  assert.equal(end.winner, null);
  assert.equal(end.reason, "draw");
  assert.ok(["lobby", "ended"].includes((await socks[0].call("chago:requestState")).room.status));
  assert.ok((await socks[0].call("chago:startGame")).ok, "다시 시작");
  assert.equal(chagoStats().active, 1);
});

test("퇴장: 방장이 나가면 방장 이전, 마지막 사람이 나가면 방 삭제(맵 정리)", async () => {
  const { socks } = await setup(3, 2);
  await socks[0].call("chago:leaveRoom");
  const st = (await socks[1].call("chago:requestState")).room;
  assert.equal(st.hostId, "user-1");
  await socks[1].call("chago:leaveRoom");
  await socks[2].call("chago:leaveRoom");
  assert.equal(chagoStats().rooms, 0);
  assert.equal(socks[2].take("chago:roomClosed").length >= 0, true);
});

test("강퇴: 방장만, 대기실에서만", async () => {
  const { socks } = await setup(3, 2);
  assert.equal((await socks[1].call("chago:kickPlayer", { targetUserId: "user-2" })).error, "NOT_HOST");
  assert.ok((await socks[0].call("chago:kickPlayer", { targetUserId: "user-2" })).ok);
  assert.equal(socks[2].take("chago:kicked").length, 1);
  await socks[0].call("chago:startGame");
  assert.equal((await socks[0].call("chago:kickPlayer", { targetUserId: "user-1" })).error, "NOT_LOBBY");
});

test("대기실에서 끊겨도 60초는 자리 유지(링크 공유하러 앱 전환), 넘으면 퇴장", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks } = await setup(2, 2);
  socks[1].disconnect();
  mock.timers.tick(30_000);
  let r = (await socks[0].call("chago:requestState")).room;
  assert.equal(r.players.length, 2);
  mock.timers.tick(31_000);
  r = (await socks[0].call("chago:requestState")).room;
  assert.equal(r.players.length, 1);
});

test("핑: 서버 시각을 돌려준다", async () => {
  const s = io.connect(U(1));
  const res = await new Promise((resolve) => s.handlers["chago:ping"](123, resolve));
  assert.equal(res.t, 123);
  assert.ok(res.st > 0);
});

// ================= 3단계: 봇 =================
const seatsOf = (sock) => sock.last("chago:gameStart") || sock.take("chago:gameStart")[0];

test("봇 충원: 사람이 모자란 자리는 봇이 채우고 슬롯은 봇=앞(키퍼), 사람=뒤", async () => {
  const { socks } = await setup(1, 2);                       // 2v2 방에 사람 1명
  await socks[0].call("chago:startGame");
  const init = socks[0].take("chago:gameStart")[0];
  assert.equal(init.roster.length, 4);
  const bots = init.roster.filter((r) => r.bot), humans = init.roster.filter((r) => !r.bot);
  assert.equal(bots.length, 3);
  assert.equal(humans.length, 1);
  assert.ok(bots.every((b) => /^봇/.test(b.name)));
  assert.equal(init.you, humans[0].eid);
  assert.deepEqual(bots.map((b) => b.team).sort(), [0, 1, 1]);
});

test("봇 충원 끄기: 사람만 경기, 난이도 설정 반영", async () => {
  const { socks } = await setup(2, 2);
  await socks[0].call("chago:setConfig", { fillBots: false, botLevel: "hard" });
  await socks[0].call("chago:startGame");
  assert.equal(socks[0].take("chago:gameStart")[0].roster.length, 2);
});

test("봇이 실제로 움직이고 경기를 진행한다 (사람 입력 없이도 스냅샷 속 봇이 이동)", async () => {
  const { socks } = await setup(1, 2);
  await socks[0].call("chago:startGame");
  const init = socks[0].take("chago:gameStart")[0];
  _tickForTest(io, 100);                                     // 카운트다운
  socks[0].take("chago:snap");
  const posAt = () => { const s = socks[0].last("chago:snap"); return new Map(s.p.map((q) => [q[0], [q[1], q[2]]])); };
  _tickForTest(io, 2); const a = posAt();
  _tickForTest(io, 150); const b = posAt();
  const botIds = init.roster.filter((r) => r.bot).map((r) => String(r.eid));
  const moved = botIds.filter((id) => Math.hypot(a.get(id)[0] - b.get(id)[0], a.get(id)[1] - b.get(id)[1]) > 20);
  assert.ok(moved.length >= 2, `움직인 봇 ${moved.length}/3`);
});

test("봇끼리·사람과 같은 규칙: 봇 선수는 경기장 밖으로 안 나가고 점수가 난다", async () => {
  const { socks } = await setup(1, 3);
  await socks[0].call("chago:setConfig", { durationSec: 120, botLevel: "hard" });
  await socks[0].call("chago:startGame");
  let guard = 0, worst = 0;
  while (chagoStats().active > 0 && guard++ < 30 * 400) {
    _tickForTest(io, 1);
    const s = socks[0].last("chago:snap");
    if (s) for (const q of s.p) worst = Math.max(worst, -q[1], q[1] - 1100, -q[2], q[2] - 640);
  }
  assert.ok(worst <= 0.5, `경기장 이탈 ${worst}`);
  const end = socks[0].take("chago:matchEnd")[0];
  assert.ok(end, "경기 종료");
  assert.ok(end.score[0] + end.score[1] >= 1, `득점 ${end.score}`);
});

test("사람이 경기 중 나가면 그 자리를 봇이 이어받는다 (선수는 그대로)", async () => {
  const { socks } = await setup(2, 1);                        // 1v1 사람 2명
  await socks[0].call("chago:startGame");
  const init1 = socks[1].take("chago:gameStart")[0];
  socks[0].take("chago:gameStart");
  _tickForTest(io, 100);
  const myEid = init1.you;
  await socks[1].call("chago:leaveRoom");
  const seat = socks[0].take("chago:seat").find((e) => e.eid === myEid);
  assert.ok(seat && seat.bot === true, "자리가 봇으로 바뀜");
  assert.ok(/봇/.test(seat.name));
  socks[0].take("chago:snap");
  _tickForTest(io, 90);
  const s = socks[0].last("chago:snap");
  assert.ok(s.p.some((q) => q[0] === String(myEid)), "선수는 경기장에 남음");
});

test("10초 넘게 끊긴 사람의 자리는 봇이 맡고, 재접속하면 돌려받는다", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks, code } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  const init1 = socks[1].take("chago:gameStart")[0];
  _tickForTest(io, 100);
  socks[1].disconnect();
  mock.timers.tick(11_000);
  const away = socks[0].take("chago:seat").find((e) => e.eid === init1.you);
  assert.ok(away && away.bot, "자리 비움 → 봇");
  const again = io.connect(U(1));
  const j = await again.call("chago:joinRoom", { inviteCode: code });
  assert.ok(j.ok && j.rejoined);
  const back = socks[0].take("chago:seat").find((e) => e.eid === init1.you);
  assert.ok(back && back.bot === false && back.uid === "user-1", "자리를 돌려받음");
  assert.equal(j.game.you, init1.you);
});

test("경기 중 입장: 봇이 있는 자리가 있으면 대기 후 봇과 교체, 없으면 거부", async () => {
  const { socks, code } = await setup(1, 2);                  // 사람1 + 봇3
  await socks[0].call("chago:startGame");
  socks[0].take("chago:gameStart");
  const newbie = io.connect(U(5));
  const j = await newbie.call("chago:joinRoom", { inviteCode: code, nickname: "신입" });
  assert.ok(j.ok && j.pending, "대기 상태로 입장");
  assert.equal(newbie.take("chago:gameStart").length, 0);
  _tickForTest(io, 5);                                        // 카운트다운 중이라 곧바로 교체
  const gs = newbie.take("chago:gameStart")[0];
  assert.ok(gs, "교체되어 경기 화면 정보를 받음");
  assert.equal(gs.roster.find((r) => r.eid === gs.you).uid, "user-5");
  assert.equal(gs.roster.find((r) => r.eid === gs.you).bot, false);
  // 키퍼(슬롯0)가 아닌 자리를 먼저 차지한다
  const seat = gs.roster.filter((r) => r.team === (j.room.players.find((p) => p.id === "user-5").team));
  assert.ok(seat.length === 2);
  // 사람이 가득 차면 거부 (2v2: 사람 2명 + 봇 2명 → 남은 봇 자리에는 들어올 수 있고, 모두 차면 ROOM_FULL)
  const more = [io.connect(U(6)), io.connect(U(7)), io.connect(U(8))];
  const results = [];
  for (const m of more) results.push((await m.call("chago:joinRoom", { inviteCode: code })).ok);
  assert.equal(results.filter(Boolean).length, 2, "봇 자리 3개 중 1개는 이미 사용, 나머지 2개만 입장 가능");
});

test("교체 시점 규칙: 경기 중이고 봇이 공 근처면 최대 5초 기다렸다가 교체", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks, code } = await setup(1, 1);                  // 1v1: 사람1 + 봇1(상대팀)
  await socks[0].call("chago:startGame");
  socks[0].take("chago:gameStart");
  for (let i = 0; i < 100; i++) _tickForTest(io, 1);          // 카운트다운 끝, 경기 중
  const state = () => socks[0].last("chago:matchState");
  assert.equal(state().phase, "play");
  const newbie = io.connect(U(5));
  const j = await newbie.call("chago:joinRoom", { inviteCode: code });
  assert.ok(j.ok && j.pending);
  // 상대 팀 봇이 공 근처(킥오프 직후 중앙 가까이)라 곧바로는 교체되지 않을 수 있음 → 5초 안에는 반드시 교체
  let swapped = newbie.take("chago:gameStart").length > 0;
  for (let i = 0; i < 40 && !swapped; i++) { mock.timers.tick(250); _tickForTest(io, 8); swapped = newbie.take("chago:gameStart").length > 0; }
  assert.ok(swapped, "5초 안에 교체");
});

test("봇만 남은 방은 정리된다 (사람이 모두 나가면)", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks } = await setup(1, 2);
  await socks[0].call("chago:startGame");
  await socks[0].call("chago:leaveRoom");
  assert.equal(chagoStats().rooms, 0, "마지막 사람이 나가면 방 삭제");
});

test("클라이언트가 남의/봇 자리 번호를 끼워 보내도 자기 자리만 움직인다", async () => {
  const { socks } = await setup(2, 2);                        // 사람 2 + 봇 2
  await socks[0].call("chago:startGame");
  const init = socks[0].take("chago:gameStart")[0];
  _tickForTest(io, 100);
  const botEid = init.roster.find((r) => r.bot).eid;
  socks[0].send("chago:input", { s: 1, mx: 1, my: 0, f: 0, eid: botEid, id: String(botEid) });   // 남의 eid를 끼워 보내도 무시
  _tickForTest(io, 5);
  const snap = socks[0].last("chago:snap");
  const mine = snap.p.find((q) => q[0] === String(init.you));
  assert.ok(mine[3] > 0, "입력은 소켓 주인의 자리에만 적용");
});

// ================= 5단계: 이모티콘 · 통계 · 승부차기 =================
test("이모티콘: 경기 중 자기 자리에서 0~5만, 1.2초에 한 번, 방 전체에 eid로 전달", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks } = await setup(2, 1);
  await socks[0].call("chago:startGame");
  const me = socks[0].take("chago:gameStart")[0].you; socks[1].take("chago:gameStart");
  socks[0].send("chago:emote", { e: 2 });
  assert.deepEqual(socks[1].take("chago:emote"), [{ eid: me, e: 2 }]);
  socks[0].send("chago:emote", { e: 3 });                          // 쿨다운
  assert.equal(socks[1].take("chago:emote").length, 0);
  mock.timers.tick(1300);
  for (const bad of [9, -1, 1.5, "x", null, undefined]) { socks[0].send("chago:emote", { e: bad }); mock.timers.tick(1300); }
  socks[0].send("chago:emote", null);
  assert.equal(socks[1].take("chago:emote").length, 0, "잘못된 값은 무시");
  mock.timers.tick(1300);
  socks[0].send("chago:emote", { e: 5 });
  assert.equal(socks[1].take("chago:emote").length, 1);
});

test("경기 종료 결과에 선수별 통계·평점·MVP가 담긴다", async () => {
  const { socks } = await setup(1, 2);
  await socks[0].call("chago:setConfig", { durationSec: 120, botLevel: "hard" });
  await socks[0].call("chago:startGame");
  let guard = 0;
  while (chagoStats().active > 0 && guard++ < 30 * 600) _tickForTest(io, 1);
  const end = socks[0].take("chago:matchEnd")[0];
  assert.ok(end && Array.isArray(end.stats) && end.stats.length === 4);
  for (const r of end.stats) { assert.ok("goals" in r && "saves" in r && "rating" in r && typeof r.name === "string"); }
  const goalsSum = end.stats.reduce((a, r) => a + r.goals + r.own, 0);
  assert.equal(goalsSum, end.score[0] + end.score[1], "개인 득점 합 = 팀 득점 합(자책 포함)");
  assert.ok(end.stats.some((r) => r.bot) && end.stats.some((r) => !r.bot));
  if (end.score[0] + end.score[1] > 0) assert.ok(end.mvp != null);
});

test("경쟁전 승부차기: 동점이면 서버가 승부차기를 진행하고(사람이 안 차도 시간 초과 처리) 결과 payload에 shootout이 담긴다", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { socks } = await setup(1, 1);
  await socks[0].call("chago:setConfig", { durationSec: 120, mode: "ranked", botLevel: "hard" });
  await socks[0].call("chago:startGame");
  const seenSo = new Set();
  let guard = 0;
  while (chagoStats().active > 0 && guard++ < 30 * 60 * 15) {
    _tickForTest(io, 1);
    const ms = socks[0].last("chago:matchState"); if (ms && ms.phase === "shootout") seenSo.add(ms.so.state);
  }
  const end = socks[0].take("chago:matchEnd")[0];
  assert.ok(end, "경기가 끝나야 함");
  assert.equal(end.mode, "ranked");
  if (end.reason === "shootout") {
    assert.ok(end.shootout && end.shootout.marks[0].length >= 1);
    assert.ok(seenSo.has("live") || seenSo.size > 0);
    assert.ok(end.winner === 0 || end.winner === 1);
  } else {
    assert.ok(["time", "golden_goal"].includes(end.reason), "정규/연장에서 승부가 난 경우: " + end.reason);
  }
});

test("승부차기 진행(키커·시도·점수)이 클라이언트에 matchState로 전달된다 (시계가 멈춰 있어도)", async () => {
  const { socks } = await setup(1, 1);
  await socks[0].call("chago:setConfig", { durationSec: 120, mode: "ranked", botLevel: "hard" });
  await socks[0].call("chago:startGame");
  const room = [..._roomsForTest().values()][0];
  _tickForTest(io, 100);
  room.match.clock = 0.2; room.match.score = [0, 0];
  let g = 0; while (room.match.phase !== "overtime" && g++ < 600) _tickForTest(io, 1);
  room.match.phaseT = 89.95;
  g = 0; while (room.match.phase !== "shootout" && g++ < 600) _tickForTest(io, 1);
  assert.equal(room.match.phase, "shootout");
  socks[0].take("chago:matchState");
  const seen = new Set();
  g = 0;
  while (room.match.phase === "shootout" && g++ < 30 * 90) {
    _tickForTest(io, 1);
    for (const st of socks[0].take("chago:matchState")) if (st.so) seen.add(`${st.so.state}:${st.so.attempt}:${st.so.marks[0].length + st.so.marks[1].length}`);
    if (room.match.so && room.match.so.marks[0].length + room.match.so.marks[1].length >= 2) break;
  }
  const states = [...seen].map((x) => x.split(":")[0]);
  assert.ok(states.includes("intro") && states.includes("live") && states.includes("result"), "단계 전환이 전달됨: " + [...seen].join(","));
  assert.ok([...seen].some((x) => Number(x.split(":")[2]) >= 1), "시도 결과(마크)가 전달됨");
});
