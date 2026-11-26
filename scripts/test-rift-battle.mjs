// 운명의 균열 덱 배틀 서버 시험 (실제 소켓 · 사람 봇 + AI 채우기로 50명 · 5라운드 끝까지 · 시간 초과 자동 진행 · 재접속 · 부정 행동): node scripts/test-rift-battle.mjs
process.env.RIFT_FAST = "0.03";
import http from "http"; import express from "express"; import { Server } from "socket.io"; import ioc from "socket.io-client";
import DATA from "../src/rift-data.js"; import * as R from "../src/rift-core.js"; import { botAction } from "../src/rift-bot.js";
const { registerRiftBattle, _rfbTest } = await import("../src/rift-battle.js");
R.setData(DATA);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗", m); } };
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, n) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; n(); });
registerRiftBattle(io, null);
await new Promise((r) => server.listen(0, r)); const BASE = `http://localhost:${server.address().port}`;
const conn = (uid) => new Promise((res) => { const s = ioc(BASE, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: "NOACK" }), 8000); s.emit(ev, p, (x) => { clearTimeout(t); res(x); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rng = (s) => { let a = s >>> 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const t0 = Date.now();

// 사람 봇: 받은 자기 상태만 보고 행동 (lazy면 아무것도 안 함 → 시간 초과 자동 진행 확인)
function human(s, code, seed, lazy = false) {
  const st = { run: null, board: null, acts: 0, errs: 0, busy: false, seen: 0, wait: -1, kinds: {}, states: 0 };
  const r = rng(seed);
  s.on("rfb:state", (m) => { if (m.code !== code) return; st.run = m.run; st.seen++; st.states++; });
  s.on("rfb:room", (m) => { if (m.code === code) st.board = m; });
  st.loop = setInterval(async () => {
    if (lazy || !st.run || st.busy || st.board?.phase === "end") return;
    if (st.seen <= st.wait && Date.now() - st.sentAt < 800) return;
    const a = botAction(st.run, 0, r); if (!a) return;
    st.busy = true; st.wait = st.seen; st.sentAt = Date.now(); const x = await emit(s, "rfb:act", { code, a }); st.busy = false; st.acts++;
    if (!x.ok && !["PHASE", "READY", "DONE"].includes(x.error)) { st.errs++; const k = `${x.error}:${a.t}`; st.kinds[k] = (st.kinds[k] || 0) + 1; }
  }, 12);
  return st;
}

// 1) 방 · 입장 · AI 채우기
const A = await conn("u_a"), B = await conn("guest_b"), C = await conn("u_c");
const cr = await emit(A, "rfb:create", { name: "방장<i>" }); ok(cr.ok && cr.code?.length === 5, "방 만들기"); const code = cr.code;
const hA = human(A, code, 1), hB = human(B, code, 2), hC = human(C, code, 3, true);
ok((await emit(B, "rfb:join", { code, name: "비" })).ok, "입장 B");
ok((await emit(C, "rfb:join", { code, name: "씨" })).ok, "입장 C (가만히 있는 사람)");
ok((await emit(B, "rfb:ai", { code, n: 10 })).error === "NOT_HOST", "방장 아니면 AI 못 바꿈");
ok((await emit(A, "rfb:ai", { code, n: 60 })).ok, "AI 채우기");
await sleep(400); ok(hA.board?.players.length === 50 && hA.board.players.filter((p) => p.ai).length === 47, `50명까지만 (사람 3 + AI 47) → ${hA.board?.players.length}`);
ok(!hA.board.players[0].name.includes("<"), "이름 정리");
ok((await emit(A, "rfb:char", { code, char: "alch" })).ok && (await emit(A, "rfb:char", { code, char: "nope" })).error, "캐릭터 고르기·잘못된 캐릭터 거절");
ok((await emit(A, "rfb:start", { code })).error === "NOT_READY", "준비 안 되면 출발 못 함");
await emit(B, "rfb:ready", { code, ready: true }); await emit(C, "rfb:ready", { code, ready: true });
ok((await emit(B, "rfb:start", { code })).error === "NOT_HOST", "방장만 출발");
const late = await conn("u_late");
ok((await emit(A, "rfb:start", { code })).ok, "출발");
ok((await emit(late, "rfb:join", { code, name: "늦음" })).error === "STARTED", "시작 뒤 새 사람은 못 들어옴");
await sleep(300);
ok(hC.run?.mode === "battle" && hC.run.bt.round === 1 && hC.run.phase === "map" && hA.run?.bt.round === 1, "1라운드 준비 단계 · 각자 내 판 받음");
ok(!("log" in (hA.run || {})), "상태에 행동 기록은 안 보냄");
// 부정 행동
ok((await emit(C, "rfb:act", { code, a: { t: "path", node: "99-9" } })).error === "BAD_NODE", "없는 칸 거절");
ok((await emit(C, "rfb:act", { code, a: { t: "rest", kind: "heal" } })).error === "PHASE", "단계 안 맞는 행동 거절");
ok((await emit(C, "rfb:act", { code, a: { t: "play", u: 1 } })).error === "PHASE", "전투 아닐 때 카드 거절");
ok((await emit(late, "rfb:act", { code, a: { t: "end" } })).error === "NOT_IN_ROOM", "방에 없는 사람 거절");
// 재접속: B가 끊겼다 다시
await sleep(200); B.disconnect(); await sleep(200);
const B2 = await conn("guest_b"); const hB2 = human(B2, code, 22); clearInterval(hB.loop);
const rj = await emit(B2, "rfb:join", { code, name: "비" }); ok(rj.ok && rj.me >= 0 && rj.run?.mode === "battle", "다시 들어오면 자기 자리·판 그대로");
// 2) 끝까지
let phases = new Set(), rounds = new Set(), lastRes = null;
for (let k = 0; k < 4000; k++) { await sleep(25); const b = hA.board; if (!b) continue; phases.add(b.phase); rounds.add(b.round); if (b.phase === "result") lastRes = b; if (b.phase === "end") break; }
const b = hA.board;
ok(b.phase === "end", "5라운드 끝까지 진행 (" + b.phase + " r" + b.round + ")");
ok(["build", "duel", "result", "end"].every((x) => phases.has(x)), "준비·결투·결과·끝 단계 모두 거침");
ok(b.final?.length === 50 && b.final[0].rank === 1, "최종 순위 50명");
ok(b.final.every((x, i, a) => i === 0 || a[i - 1].pts > x.pts || (a[i - 1].pts === x.pts && a[i - 1].sc >= x.sc)), "순위: 점수 → 결투 점수 순");
const totalPts = b.final.reduce((s, x) => s + x.pts, 0); ok(totalPts >= 3 * 24 * 5 && totalPts <= 3 * 25 * 5 + 10, `점수 합이 맞음 (${totalPts})`);
ok(lastRes && lastRes.players.every((p) => p.last && ["win", "lose", "draw"].includes(p.last.res)), "라운드마다 모두 결과 받음");
const pC = b.players.find((p) => p.name === "씨"); ok(pC && pC.last, "가만히 있던 사람도 시간 초과 자동 진행으로 결과 있음");
ok(hA.acts > 20 && hA.errs < Math.max(5, hA.acts * 0.05), `정상 사람 봇 거절 거의 없음 (${hA.errs}/${hA.acts}) ${JSON.stringify(hA.kinds)}`);
ok(hA.run.bt.hist.length === 5, "내 결투 기록 5번");
// 3) 다시 하기
ok((await emit(A, "rfb:again", { code })).ok, "다시 대기실로"); await sleep(400); ok(hA.board.phase === "lobby" && hA.board.players.length === 50, "대기실 · 인원 유지");
// 4) 혼자 + AI 1명
const S1 = await conn("u_solo"); const cs = await emit(S1, "rfb:create", { name: "혼자" }); const hS = human(S1, cs.code, 9);
ok((await emit(S1, "rfb:start", { code: cs.code })).error === "NEED_2", "혼자서는 AI 없으면 못 함");
await emit(S1, "rfb:ai", { code: cs.code, n: 1 }); ok((await emit(S1, "rfb:start", { code: cs.code })).ok, "혼자 + AI 1명 출발");
for (let k = 0; k < 3000 && hS.board?.phase !== "end"; k++) await sleep(25);
ok(hS.board?.phase === "end" && hS.board.final.length === 2, "혼자 + AI 끝까지");
for (const h of [hA, hB2, hC, hS]) clearInterval(h.loop);
console.log(`  사람 봇 행동 ${hA.acts} · 최종 1위 ${b.final[0].name}(${b.final[0].pts}점) · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
console.log(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
