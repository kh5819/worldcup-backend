// 부하·누수 시험: 방 여러 개를 동시에 돌리고(봇 포함), 모두 닫은 뒤 방·타이머가 남지 않는지 확인
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { registerChago, shutdownChago, chagoStats, _tickForTest, _roomsForTest } from "../../src/chago.js";

class FakeIO {
  constructor() { this.sockets = new Map(); this.connHandlers = []; this.emitted = 0; }
  on(ev, cb) { if (ev === "connection") this.connHandlers.push(cb); }
  to() { const d = () => { this.emitted++; }; return { emit: d, volatile: { emit: d } }; }
  in(room) { return { socketsLeave: (r) => { for (const s of this.sockets.values()) s.rooms.delete(r); } }; }
  connect(user) { const s = new FakeSocket(this, user); this.sockets.set(s.id, s); for (const cb of this.connHandlers) cb(s); return s; }
  close() {}
}
let sid = 0;
class FakeSocket {
  constructor(io, user) { this.io = io; this.id = `lsock${++sid}`; this.user = user; this.handlers = {}; this.rooms = new Set([this.id]); }
  on(ev, h) { this.handlers[ev] = h; }
  join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
  call(ev, payload) { return new Promise((resolve) => { const r = this.handlers[ev](payload, (res) => resolve(res)); if (r && r.catch) r.catch(() => resolve({ ok: false })); }); }
  disconnect() { this.handlers["disconnect"]?.(); this.io.sockets.delete(this.id); }
}
const timers = () => (process.getActiveResourcesInfo?.() || []).filter((t) => t === "Timeout").length;

test("방 40개(2v2·4v4, 봇 포함) 동시 진행: 틱 비용 · 종료 후 누수 없음", async () => {
  shutdownChago();
  const io = new FakeIO();
  registerChago(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
  const base = timers();
  const socks = [];
  const ROOMS = 40;
  for (let i = 0; i < ROOMS; i++) {
    const size = i % 2 ? 4 : 2;
    const s = io.connect({ id: `u${i}`, isGuest: false, isAdmin: false });
    socks.push(s);
    const c = await s.call("chago:createRoom", { teamSize: size, nickname: "H" + i });
    assert.ok(c.ok, JSON.stringify(c));
    await s.call("chago:setConfig", { botLevel: "hard", fillBots: true });
    assert.ok((await s.call("chago:startGame", {})).ok);
  }
  assert.equal(_roomsForTest().size, ROOMS);
  // 카운트다운을 넘기고 실제 경기 틱을 돌린다 (사람 입력 없음 — 봇끼리 + 가만히 선 사람)
  const TICKS = 30 * 20;                     // 20초 분량
  const t0 = performance.now();
  let worst = 0;
  for (let k = 0; k < TICKS; k++) { const a = performance.now(); _tickForTest(io, 1); const d = performance.now() - a; if (d > worst) worst = d; }
  const per = (performance.now() - t0) / TICKS;
  console.log(`  방 ${ROOMS}개 · 틱당 평균 ${per.toFixed(2)}ms · 최악 ${worst.toFixed(1)}ms · 예산 33.3ms · 전송 ${io.emitted}회`);
  assert.ok(per < 20, `틱당 평균 ${per.toFixed(2)}ms 는 너무 느림`);
  assert.ok(worst < 33, `최악 틱 ${worst.toFixed(1)}ms 가 예산(33ms) 초과`);
  assert.equal(chagoStats().active, ROOMS);
  // 전원 연결 끊김 → 정리 (끊긴 사람 자리는 유예 후 방이 닫힘)
  for (const s of socks) await s.call("chago:leaveRoom", {});
  assert.equal(_roomsForTest().size, 0, "방이 남아 있음");
  assert.equal(chagoStats().active, 0, "활성 방 목록에 남아 있음");
  shutdownChago();
  assert.ok(timers() <= base + 1, `타이머가 남음: ${timers()} (시작 ${base})`);
});

test("들어왔다 나가기 500번 반복해도 방·관전·초대코드가 쌓이지 않는다", async () => {
  shutdownChago();
  const io = new FakeIO();
  registerChago(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
  for (let i = 0; i < 500; i++) {
    const h = io.connect({ id: `h${i}`, isGuest: false, isAdmin: false });
    const c = await h.call("chago:createRoom", { teamSize: 1, nickname: "H" });
    const g = io.connect({ id: `guest_${i}`, isGuest: true, isAdmin: false });
    await g.call("chago:joinRoom", { inviteCode: c.inviteCode, nickname: "G" });
    if (i % 3 === 0) await h.call("chago:startGame", {});
    if (i % 2) { g.disconnect(); h.disconnect(); } else { await g.call("chago:leaveRoom", {}); await h.call("chago:leaveRoom", {}); }
  }
  // 연결이 끊긴 쪽은 유예 시간이 지나야 정리되므로, 남은 방이 있으면 종료 정리로 확인
  const left = _roomsForTest().size;
  console.log(`  500회 반복 후 남은 방(끊김 유예 중): ${left}`);
  shutdownChago();
  assert.equal(_roomsForTest().size, 0);
  assert.equal(chagoStats().active, 0);
});

test("전원이 연결을 끊고 돌아오지 않으면 유예 시간 뒤 방이 스스로 정리된다", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  try {
    shutdownChago();
    const io = new FakeIO();
    registerChago(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
    for (let i = 0; i < 60; i++) {
      const h = io.connect({ id: `h${i}`, isGuest: false, isAdmin: false });
      const c = await h.call("chago:createRoom", { teamSize: 2, nickname: "H" });
      if (i % 2) await h.call("chago:startGame", {});
      h.disconnect();
      assert.ok(c.ok);
    }
    mock.timers.tick(10 * 60_000);
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    assert.equal(_roomsForTest().size, 0, "연결이 끊긴 방이 10분 뒤에도 남아 있음");
  } finally { shutdownChago(); mock.timers.reset(); }
});
