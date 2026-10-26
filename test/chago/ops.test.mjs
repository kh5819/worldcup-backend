// 6단계 운영 기능 테스트: 경기 기록·레이팅·이탈·관전·신고·관리자 API (가짜 DB·가짜 소켓)
import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { registerChago, registerChagoRoutes, shutdownChago, chagoStats, _tickForTest, _roomsForTest, liveRooms } from "../../src/chago.js";
import { createStore } from "../../src/chago-store.js";

// ---- 가짜 소켓 (net.test.mjs 와 같은 방식) ----
class FakeIO {
  constructor() { this.sockets = new Map(); this.connHandlers = []; }
  on(ev, cb) { if (ev === "connection") this.connHandlers.push(cb); }
  to(room) { const d = (ev, data) => { for (const s of this.sockets.values()) if (s.rooms.has(room)) s.inbox.push({ ev, data }); }; return { emit: d, volatile: { emit: d } }; }
  in(room) { return { socketsLeave: (r) => { for (const s of this.sockets.values()) s.rooms.delete(r); } }; }
  connect(user) { const s = new FakeSocket(this, user); this.sockets.set(s.id, s); for (const cb of this.connHandlers) cb(s); return s; }
  close() {}
}
let sid = 0;
class FakeSocket {
  constructor(io, user) { this.io = io; this.id = `osock${++sid}`; this.user = user; this.handlers = {}; this.rooms = new Set([this.id]); this.inbox = []; }
  on(ev, h) { this.handlers[ev] = h; }
  join(r) { this.rooms.add(r); } leave(r) { this.rooms.delete(r); }
  call(ev, payload) { return new Promise((resolve) => { const r = this.handlers[ev](payload, (res) => resolve(res)); if (r && r.catch) r.catch(() => resolve({ ok: false, error: "THROW" })); }); }
  send(ev, payload) { this.handlers[ev](payload); }
  disconnect() { this.handlers["disconnect"]?.(); this.io.sockets.delete(this.id); }
  take(ev) { const o = this.inbox.filter((m) => m.ev === ev); this.inbox = this.inbox.filter((m) => m.ev !== ev); return o.map((m) => m.data); }
  last(ev) { const l = this.inbox.filter((m) => m.ev === ev); return l.length ? l[l.length - 1].data : null; }
}

// ---- 가짜 DB: from(table).select().eq()… 는 설정한 행을 돌려주고 rpc/insert 호출을 기록 ----
function makeDb({ tables = {}, error = null, rpcId = "match-1" } = {}) {
  const calls = { rpc: [], insert: [] };
  const builder = (table) => {
    const api = new Proxy({}, {
      get(_, prop) {
        if (prop === "then") return (res) => res({ data: error ? null : tables[table] || [], error, count: (tables[table] || []).length });
        if (prop === "single") return async () => ({ data: table === "profiles" ? null : { id: "rep-1" }, error });
        if (prop === "insert") return (row) => { calls.insert.push({ table, row }); return api; };
        return () => api;
      },
    });
    return api;
  };
  return { calls, from: builder, rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: error ? null : rpcId, error }; } };
}

const U = (n, guest = false) => ({ id: guest ? `guest_${n}` : `user-${n}`, isGuest: guest, isAdmin: false });
let io, db;
const flush = () => new Promise((r) => setImmediate(r));
async function mkRoom(users, { teamSize = 1, mode = "ranked", fillBots = true } = {}) {
  const socks = users.map((u) => io.connect(u));
  const c = await socks[0].call("chago:createRoom", { teamSize, nickname: "호스트" });
  assert.ok(c.ok, JSON.stringify(c));
  for (let i = 1; i < socks.length; i++) assert.ok((await socks[i].call("chago:joinRoom", { inviteCode: c.inviteCode, nickname: "P" + i })).ok);
  await socks[0].call("chago:setConfig", { durationSec: 120, mode, fillBots });
  return { socks, code: c.inviteCode, room: () => [..._roomsForTest().values()][0] };
}
// 경기를 15초 이상 진행시킨 뒤 팀 w 가 이긴 채로 끝낸다
async function finishWith(room, w) {
  _tickForTest(io, 100);
  mock.timers.tick(20_000);
  const m = room.match;
  m.score = w === 0 ? [1, 0] : [0, 1];
  m.clock = 0.05;
  let g = 0;
  while (m.phase !== "ended" && g++ < 30 * 60) _tickForTest(io, 1);
  await flush(); await flush();
}

beforeEach(() => { mock.timers.enable({ apis: ["setTimeout", "Date"] }); shutdownChago(); io = new FakeIO(); db = makeDb(); registerChago(io, db); });
afterEach(() => { shutdownChago(); mock.timers.reset(); });

test("저장소: 테이블이 없으면 게임에 영향 없이 건너뛰고, 60초 뒤 다시 확인한다", async () => {
  const bad = makeDb({ error: { code: "42P01", message: 'relation "chago_ratings" does not exist' } });
  const st = createStore(bad, { warn() {}, error() {} });
  assert.equal(st.enabled, true);
  assert.deepEqual(await st.loadRatings(["a"], "2026-10"), {});
  assert.equal(st.enabled, false, "없는 테이블 → 비활성");
  const before = bad.calls.rpc.length;
  assert.equal(await st.recordMatch({}, []), null);
  assert.equal(bad.calls.rpc.length, before, "비활성 중에는 DB를 부르지 않음");
  mock.timers.tick(61_000);
  assert.equal(st.enabled, true, "60초 뒤 다시 시도");
});

test("경쟁전 1v1(로그인 2명): 경기 기록 + 레이팅 ±16(첫 경기) 반영, 양쪽에 chago:rating 전달", async () => {
  const { socks, room } = await mkRoom([U(0), U(1)]);
  await socks[0].call("chago:startGame");
  await finishWith(room(), 0);
  assert.equal(db.calls.rpc.length, 1);
  const { name, args } = db.calls.rpc[0];
  assert.equal(name, "chago_apply_match");
  assert.equal(args.m.ranked, true); assert.equal(args.m.mode, "ranked"); assert.equal(args.m.winner, 0); assert.match(args.m.season, /^\d{4}-\d{2}$/);
  const a = args.pl.find((p) => p.uid === "user-0"), b = args.pl.find((p) => p.uid === "user-1");
  assert.equal(a.rated, true); assert.equal(a.rating_delta, 16); assert.equal(a.result, "win");
  assert.equal(b.rating_delta, -16); assert.equal(b.result, "loss");
  const r0 = socks[0].take("chago:rating")[0], r1 = socks[1].take("chago:rating")[0];
  assert.deepEqual([r0.after, r0.delta, r0.rated], [1016, 16, true]);
  assert.deepEqual([r1.after, r1.delta], [984, -16]);
});

test("친선은 기록만 하고 레이팅은 안 바뀐다 / 봇만 상대하면 경쟁전이어도 레이팅 없음", async () => {
  const f = await mkRoom([U(0), U(1)], { mode: "friendly" });
  await f.socks[0].call("chago:startGame");
  await finishWith(f.room(), 1);
  assert.equal(db.calls.rpc.at(-1).args.m.ranked, false);
  assert.ok(db.calls.rpc.at(-1).args.pl.every((p) => !p.rated));
  shutdownChago(); io = new FakeIO(); db = makeDb(); registerChago(io, db);
  const b = await mkRoom([U(0)], { teamSize: 2, mode: "ranked" });             // 사람 1 + 봇 3
  await b.socks[0].call("chago:startGame");
  await finishWith(b.room(), 0);
  const args = db.calls.rpc.at(-1).args;
  assert.equal(args.m.ranked, false, "봇 상대는 파밍 방지로 레이팅 제외");
  assert.equal(args.pl.filter((p) => p.bot).length, 3);
});

test("너무 짧은 경기(15초 미만)나 사람이 없는 경기는 기록하지 않는다", async () => {
  const { socks, room } = await mkRoom([U(0), U(1)]);
  await socks[0].call("chago:startGame");
  _tickForTest(io, 100);
  const m = room().match; m.score = [1, 0]; m.clock = 0.05;                     // mock.timers.tick 없이 → 경과 시간 짧음
  let g = 0; while (m.phase !== "ended" && g++ < 30 * 60) _tickForTest(io, 1);
  await flush();
  assert.equal(db.calls.rpc.length, 0);
});

test("이탈: 끝까지 못 돌아온 사람은 팀이 이겨도 패배·추가 감점으로 기록된다", async () => {
  const { socks, room } = await mkRoom([U(0), U(1)]);
  await socks[0].call("chago:startGame");
  _tickForTest(io, 100);
  await socks[0].call("chago:leaveRoom");                                         // user-0 중도 퇴장 (선수는 봇이 이어받음)
  await finishWith(room(), 1);                                                    // 팀1(user-1)이 이김
  const args = db.calls.rpc.at(-1).args;
  const quitter = args.pl.find((p) => p.uid === "user-0"), stay = args.pl.find((p) => p.uid === "user-1");
  assert.equal(quitter.abandoned, true);
  assert.ok(quitter.rating_delta < 0, `이탈자 ${quitter.rating_delta}`);
  assert.equal(stay.result, "win"); assert.ok(stay.rating_delta > 0);
});

test("재접속해서 끝까지 뛴 사람은 이탈로 취급되지 않는다", async () => {
  const { socks, code, room } = await mkRoom([U(0), U(1)]);
  await socks[0].call("chago:startGame");
  _tickForTest(io, 100);
  socks[1].disconnect();
  mock.timers.tick(3000);                                                         // 10초 안에 복귀
  const again = io.connect(U(1));
  assert.ok((await again.call("chago:joinRoom", { inviteCode: code })).rejoined);
  await finishWith(room(), 0);
  assert.equal(db.calls.rpc.at(-1).args.pl.find((p) => p.uid === "user-1").abandoned, false);
});

test("관전: 진행 중인 방만, 자리·입력 없이 스냅샷을 받고, 나가면 정리된다", async () => {
  const { socks, code, room } = await mkRoom([U(0), U(1)]);
  const spec = io.connect(U(7, true));
  assert.equal((await spec.call("chago:spectate", { inviteCode: code })).error, "NOT_PLAYING", "대기실은 관전 불가");
  await socks[0].call("chago:startGame");
  const r = await spec.call("chago:spectate", { inviteCode: code, nickname: "구경꾼" });
  assert.ok(r.ok && r.spectator && r.game.spectator === true && r.game.you === null && r.game.roster.length === 2);
  assert.equal((await spec.call("chago:spectate", { inviteCode: code })).error, "ALREADY_IN_ROOM");
  _tickForTest(io, 100); spec.take("chago:snap");
  _tickForTest(io, 10);
  assert.ok(spec.take("chago:snap").length >= 5, "스냅샷 수신");
  spec.send("chago:input", { s: 1, mx: 1, my: 0, f: 0 });                        // 관전자 입력은 무시(크래시 없음)
  assert.equal(room().specs.size, 1);
  assert.equal((await socks[0].call("chago:requestState")).room.spectators, 1);
  spec.disconnect();
  assert.equal(room().specs.size, 0, "연결이 끊기면 관전자 정리");
  assert.equal(chagoStats().rooms, 1);
});

test("관전 인원 상한(30)과 한 사람이 두 곳에 못 들어가는 규칙", async () => {
  const { socks, code } = await mkRoom([U(0), U(1)]);
  await socks[0].call("chago:startGame");
  let full = null;
  for (let i = 0; i < 32; i++) { const r = await io.connect(U(100 + i, true)).call("chago:spectate", { inviteCode: code }); if (!r.ok) { full = r.error; break; } }
  assert.equal(full, "SPECTATORS_FULL");
  assert.equal((await socks[1].call("chago:spectate", { inviteCode: code })).error, "ALREADY_IN_ROOM", "선수는 관전 불가");
});

test("신고: 로그인한 같은 경기 사람만, 봇·자기 자신·잘못된 사유는 거부, 10분에 5번까지", async () => {
  const { socks, room } = await mkRoom([U(0), U(1)], { teamSize: 2 });           // 사람 2 + 봇 2
  await socks[0].call("chago:startGame");
  const roster = socks[0].take("chago:gameStart")[0].roster;
  const other = roster.find((r) => r.uid === "user-1"), me = roster.find((r) => r.uid === "user-0"), bot = roster.find((r) => r.bot);
  assert.equal((await socks[0].call("chago:report", { eid: other.eid, reason: "cheat" })).ok, true);
  assert.equal(db.calls.insert.at(-1).table, "chago_reports");
  assert.equal(db.calls.insert.at(-1).row.target_user_id, "user-1");
  assert.equal(db.calls.insert.at(-1).row.reporter_id, "user-0");
  assert.equal((await socks[0].call("chago:report", { eid: me.eid, reason: "cheat" })).error, "SELF_REPORT");
  assert.equal((await socks[0].call("chago:report", { eid: bot.eid, reason: "cheat" })).error, "INVALID_TARGET");
  assert.equal((await socks[0].call("chago:report", { eid: other.eid, reason: "nonsense" })).error, "INVALID_REASON");
  const guest = io.connect(U(9, true));
  assert.equal((await guest.call("chago:report", { eid: other.eid, reason: "cheat" })).error, "LOGIN_REQUIRED");
  for (let i = 0; i < 4; i++) await socks[0].call("chago:report", { eid: other.eid, reason: "abuse", detail: "x".repeat(900) });
  assert.equal((await socks[0].call("chago:report", { eid: other.eid, reason: "afk" })).error, "RATE_LIMITED");
  assert.ok(db.calls.insert.at(-1).row.detail.length <= 300, "상세 내용은 300자로 제한");
  mock.timers.tick(601_000);
  assert.equal((await socks[0].call("chago:report", { eid: other.eid, reason: "afk" })).ok, true, "10분 뒤 다시 가능");
  void room;
});

test("HTTP: 공개 랭킹은 누구나, 관리자 API는 관리자만 (방 강제 종료·신고 처리·레이팅 조정)", async () => {
  const tables = {
    chago_ratings: [{ user_id: "u1", rating: 1100, peak: 1100, ranked_games: 5, wins: 4, losses: 1, goals: 3, assists: 1, mvps: 2 }],
    profiles: [{ id: "u1", nickname: "에이스", avatar_url: null }],
    chago_reports: [{ id: "r1", kind: "manual", status: "pending", reason: "cheat", target_user_id: "u1", reporter_id: "u2", created_at: "2026-10-26T00:00:00Z" }],
  };
  shutdownChago(); io = new FakeIO(); db = makeDb({ tables }); registerChago(io, db);
  const app = express(); app.use(express.json());
  const admin = (req, res, next) => (req.headers["x-admin"] === "1" ? ((req.user = { id: "adm" }), next()) : res.status(403).json({ ok: false }));
  const auth = (req, res, next) => ((req.user = { id: "u1" }), next());
  registerChagoRoutes(app, { requireAuth: auth, requireAdmin: admin, io });
  const server = http.createServer(app); await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  mock.timers.reset();                                                            // fetch 는 실제 타이머가 필요
  try {
    const lb = await (await fetch(`${base}/chago/leaderboard`)).json();
    assert.equal(lb.ok, true); assert.equal(lb.rows[0].nickname, "에이스"); assert.equal(lb.rows[0].rank, 1); assert.equal(lb.rows[0].rating, 1100);
    assert.ok(!("user_id" in lb.rows[0]), "공개 랭킹에 사용자 ID를 내보내지 않는다");
    assert.equal((await fetch(`${base}/admin/chago/overview`)).status, 403);
    assert.equal((await fetch(`${base}/admin/chago/reports`)).status, 403);
    const H = { "x-admin": "1", "content-type": "application/json" };
    const rep = await (await fetch(`${base}/admin/chago/reports?status=pending`, { headers: H })).json();
    assert.equal(rep.rows[0].target_nick, "에이스");
    assert.equal((await fetch(`${base}/admin/chago/reports/r1`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "bogus" }) })).status, 400);
    assert.equal((await (await fetch(`${base}/admin/chago/reports/r1`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "actioned", note: "경고" }) })).json()).ok, true);
    assert.equal((await fetch(`${base}/admin/chago/rating`, { method: "POST", headers: H, body: JSON.stringify({ season: "bad", userId: "x" }) })).status, 400);
    // 방 강제 종료
    const c = io.connect(U(0)); const made = await c.call("chago:createRoom", { teamSize: 1 });
    assert.equal(liveRooms().length, 1);
    const closed = await (await fetch(`${base}/admin/chago/rooms/${made.roomId}/close`, { method: "POST", headers: H })).json();
    assert.equal(closed.ok, true); assert.equal(chagoStats().rooms, 0);
    assert.ok(c.take("chago:roomClosed").length >= 1, "방 안 사람들에게 닫힘 알림");
  } finally { server.close(); }
});
