// 운명의 균열 서버 시험 (실제 소켓 · 2~4인 협동 끝까지 · 재접속 · 시간 초과 · 관전 · 부정 행동 · 혼자 기록 검증): node scripts/test-rift-server.mjs
process.env.RIFT_FAST = "0.02";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import DATA from "../src/rift-data.js"; import * as R from "../src/rift-core.js"; import { botAction } from "../src/rift-bot.js";
const { registerRift, _riftTest } = await import("../src/rift.js");   // 환경값(RIFT_FAST) 적용 뒤에 불러오기
R.setData(DATA);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
registerRift(io, null, app);
await new Promise((r) => server.listen(0, r)); const BASE = `http://localhost:${server.address().port}`;
const conn = (uid) => new Promise((res) => { const s = ioc(BASE, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rng = (s) => { let a = s >>> 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// 봇 클라이언트: 받은 상태를 보고 자기 행동만 보냄 (투표 단계도 투표)
function bot(s, code, seed, opt = {}) {
  const st = { run: null, me: 0, over: false, acts: 0, errs: 0, busy: false, last: 0, lazy: !!opt.lazy };
  const r = rng(seed);
  st.seen = 0; st.wait = -1; st.kinds = {};
  s.on("rift:state", (m) => { st.run = m.run; st.me = m.me; st.spect = m.spectator; if (m.run.over) st.over = true; st.last = Date.now(); st.seen++; });
  st.loop = setInterval(async () => {
    if (!st.run || st.over || st.busy || st.spect || st.lazy) return;
    if (st.seen <= st.wait && Date.now() - st.sentAt < 800) return;   // 보낸 행동의 결과(새 상태)를 받은 뒤에 다음 행동
    const run = st.run; let a = null;
    if (run.phase === "map") { const nx = R.nextNodes(run); a = { t: "path", node: nx[Math.floor(r() * nx.length)] }; }
    else if (run.phase === "event") { if (run.room.chosen == null) { const e = DATA.EVENTS.find((x) => x.id === run.room.ev); const okO = e.opts.map((o, i) => (o.need?.gold && run.players.some((x) => x.gold < o.need.gold) ? -1 : i)).filter((x) => x >= 0); a = { t: "event", opt: okO[0] }; } else a = { t: "leave" }; }
    else a = botAction(run, st.me, r);
    if (!a) return; st.busy = true; st.wait = st.seen; st.sentAt = Date.now(); const x = await emit(s, "rift:act", { code, a }); st.busy = false; st.acts++; if (x.voted) st.wait = -1;
    if (!x.ok && !["READY", "DONE", "PHASE", "RATE_LIMITED"].includes(x.error)) { st.errs++; const k = `${x.error}:${a.t}`; st.kinds[k] = (st.kinds[k] || 0) + 1; }
  }, 15);
  return st;
}
// 1) 방 만들기·입장·캐릭터·준비·출발
const A = await conn("u_a"), B = await conn("guest_b1"), Cc = await conn("u_c"), Dd = await conn("guest_d1");
const cr = await emit(A, "rift:create", { name: "방장<b>" }); ok(cr.ok && cr.room.code.length === 5, "방 만들기"); const code = cr.room.code;
ok(!cr.room.players[0].name.includes("<"), "이름 정리");
for (const [s, nm] of [[B, "비"], [Cc, "씨"], [Dd, "디"]]) { const j = await emit(s, "rift:join", { code, name: nm }); ok(j.ok, "입장 " + nm); }
const E5 = await conn("u_e"); ok((await emit(E5, "rift:join", { code, name: "오" })).error === "FULL", "5번째는 가득 참");
ok(!(await emit(B, "rift:start", { code })).ok, "방장 아니면 출발 못 함");
ok((await emit(A, "rift:start", { code })).error === "NOT_READY", "모두 준비 전엔 출발 못 함");
await emit(B, "rift:char", { code, char: "knight" });
for (const s of [A, B, Cc, Dd]) await emit(s, "rift:ready", { code, ready: true });
const bots = [bot(A, code, 1), bot(B, code, 2), bot(Cc, code, 3), bot(Dd, code, 4)];
const st0 = await emit(A, "rift:start", { code }); ok(st0.ok, "출발");
await sleep(300);
const room = _riftTest.ROOMS.get(code);
ok(room.run && room.run.players.length === 4 && room.run.mode === "coop", "4인 판 시작");
ok(room.run.hpMult === 4 && Math.abs(room.run.dmgMult - 1.9) < 1e-9, "몬스터 체력 ×4 · 공격 +90%");
ok(bots.every((b) => b.run), "모두 상태 받음");
// 2) 부정 행동
const sp = await emit(E5, "rift:join", { code, name: "관전" }); ok(sp.ok && sp.spectator, "게임 중 입장 = 관전");
ok((await emit(E5, "rift:act", { code, a: { t: "end" } })).error === "SPECTATOR", "관전자는 행동 못 함");
// 3) 중간에 한 명 끊기 → 시간 초과 자동 처리 → 재접속
await sleep(1500);
bots[3].lazy = true; Dd.disconnect(); await sleep(1200);
ok(room.players[3].on === false, "끊긴 사람 표시");
const D2 = await conn("guest_d1"); const rj = await emit(D2, "rift:join", { code, name: "디" }); ok(rj.ok && rj.me === 3 && !rj.spectator, "같은 사람 재접속 = 자기 자리");
const b4 = bot(D2, code, 9, { lazy: true }); bots[3] = b4;   // 이 사람은 끝까지 아무것도 안 함 → 시간 초과 자동 처리로 진행돼야 함
// 4) 끝까지
const T0 = Date.now(); while (!bots.every((b) => b.over || b.lazy) || !room.run.over && Date.now() - T0 < 120000) await sleep(200);
ok(bots.every((b) => b.over), "협동 판 끝까지 진행 (" + room.run.phase + " " + room.run.floor + ")");
ok(room.run.log.some(([pi, x]) => pi === 3 && (x.t === "end" || x.t === "reward" || x.t === "leave" || x.t === "rest")), "가만히 있는 사람은 시간 초과로 자동 처리");
const sm = R.summary(room.run);
console.log(`  협동 결과: ${sm.win ? "클리어" : "패배"} · ${sm.floor}층 · ${sm.turns}턴 · 행동 ${bots.reduce((s, b) => s + b.acts, 0)} · 거절 ${bots.reduce((s, b) => s + b.errs, 0)}`);
const kinds = {}; for (const b of bots) for (const [k, n] of Object.entries(b.kinds)) kinds[k] = (kinds[k] || 0) + n; if (Object.keys(kinds).length) console.log("  거절 이유:", JSON.stringify(kinds));
{ const acts = bots.reduce((s, b) => s + b.acts, 0), errs = bots.reduce((s, b) => s + b.errs, 0); ok(errs < acts * 0.05, `정상 봇의 거절이 거의 없음 (${errs}/${acts}) ${JSON.stringify(bots.map((b) => b.kinds))}`); }
// 5) 상태 일치: 서버 기록으로 다시 돌리면 같은 결과
const rp = R.replay({ seed: room.run.seed, chars: room.run.players.map((p) => p.char), names: room.run.players.map((p) => p.name), diff: room.run.diff, mode: "coop" }, room.run.log);
ok(rp.ok && JSON.stringify(R.summary(rp.run)) === JSON.stringify(sm), "서버 판정 기록 다시 돌리기 = 같은 결과");
ok(JSON.stringify(bots[0].run.players.map((p) => p.hp)) === JSON.stringify(room.run.players.map((p) => p.hp)), "클라가 받은 상태 = 서버 상태");
// 6) 혼자 하기 기록 검증
{ const run = R.newRun({ seed: 4242, chars: ["knight"] }); const r = rng(5); let n = 0; while (!run.over && n++ < 5000) { const a = botAction(run, 0, r); if (!a) break; R.act(run, 0, a); }
  const S = await conn("guest_solo1"); const good = await emit(S, "rift:submit", { seed: 4242, chars: ["knight"], diff: "normal", log: run.log, playMs: 60000 }); ok(good.ok && good.summary.floor === R.summary(run).floor, "혼자 기록 검증 통과");
  const bad = JSON.parse(JSON.stringify(run.log)); const k = bad.findIndex(([, a]) => a.t === "play"); if (k >= 0) bad[k][1].u = 99999;
  ok(!(await emit(S, "rift:submit", { seed: 4242, chars: ["knight"], diff: "normal", log: bad })).ok, "조작한 기록은 거절");
  ok(!(await emit(S, "rift:submit", { seed: 4242, chars: ["knight"], diff: "normal", log: run.log.slice(0, 10) })).ok, "끝나지 않은 기록은 거절"); S.close(); }
// 7) 로비에서 나가기·방장 넘기기
{ const H = await conn("u_h"), G = await conn("u_g"); const c2 = (await emit(H, "rift:create", { name: "H" })).room.code; await emit(G, "rift:join", { code: c2, name: "G" }); await emit(H, "rift:leave", { code: c2 }); const r2 = _riftTest.ROOMS.get(c2); ok(r2 && r2.players.filter(Boolean).length === 1 && r2.players[r2.host]?.uid === "u_g", "방장 나가면 넘김"); await emit(G, "rift:leave", { code: c2 }); ok(!_riftTest.ROOMS.get(c2), "모두 나가면 방 삭제"); H.close(); G.close(); }
for (const b of bots) clearInterval(b.loop);
console.log(`\n통과 ${pass} · 실패 ${fail}`);
for (const s of [A, B, Cc, D2, E5]) s.close(); io.close(); server.close(); process.exit(fail ? 1 : 0);
