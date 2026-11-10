// 플듀 마피아 밸런스 자동 시뮬레이션 (봇끼리, 단순 추리 규칙) — node scripts/sim-mafia.mjs [판수=200]
// ⚠ 실제 사람의 심리전·토론은 반영되지 않음. 규칙 이상(한쪽 압도·너무 짧음/김) 발견용.
import { _sim, _setTimeScale } from "../src/mafia.js";
import { ROLES } from "../src/mafia-data.js";
const N = Number(process.argv[2] || 200);
_setTimeScale(0.002);
const fakeIo = { to: () => ({ emit() {} }), in: () => ({ socketsLeave() {} }), sockets: { sockets: new Map() } };
function play(n) {
  return new Promise((resolve) => {
    const room = _sim.createRoom({ id: "sim_h" + Math.random(), isGuest: true }, "h", { hostMode: "mc", max: 30 });
    for (let i = 0; i < n; i++) { const id = "bot_" + i + "_" + Math.random().toString(36).slice(2, 6); const p = _sim.newPlayer(id, "b" + i, { bot: true }); room.players.set(id, p); room.order.push(id); }
    _sim.seatList(room);
    const firstDayOut = { v: false };
    room.onEnd = (r) => { const all = r.order.map((u) => r.players.get(u)); resolve({ team: r.winner.team, days: r.winner.days, sec: r.winner.simSec, roles: all.map((p) => ({ role: p.role, win: r.winner.winners.includes(p.uid), alive: p.alive })), cases: r.caseN, firstDayOut: all.some((p) => p.deathBy === "vote" && p.deathDay === 1) }); _sim.rooms.delete(r.code); };
    _sim.startGame(fakeIo, room);
    void firstDayOut;
  });
}
for (const n of [6, 10, 15, 30]) {
  const t0 = Date.now(); const out = [];
  for (let b = 0; b < N; b += 50) out.push(...(await Promise.all(Array.from({ length: Math.min(50, N - b) }, () => play(n)))));
  const town = out.filter((o) => o.team === "town").length, maf = out.length - town;
  const avg = (f) => out.reduce((s, o) => s + f(o), 0) / out.length;
  const roleWin = {};
  for (const o of out) for (const r of o.roles) { const k = r.role; (roleWin[k] ||= { n: 0, w: 0 }); roleWin[k].n++; if (r.win) roleWin[k].w++; }
  console.log(`\n== ${n}명 · ${out.length}판 (${Date.now() - t0}ms) ==`);
  console.log(`시민팀 ${(town / out.length * 100).toFixed(0)}% · 조작단 ${(maf / out.length * 100).toFixed(0)}% · 평균 ${avg((o) => o.days).toFixed(1)}일 · 계획 시간 평균 ${(avg((o) => o.sec) / 60).toFixed(1)}분 (최소 ${(Math.min(...out.map((o) => o.sec)) / 60).toFixed(1)} / 최대 ${(Math.max(...out.map((o) => o.sec)) / 60).toFixed(1)})`);
  console.log(`2일 이내 종료 ${(out.filter((o) => o.days <= 2).length / out.length * 100).toFixed(0)}% · 사건 조사 평균 ${avg((o) => o.cases).toFixed(1)}회 · 첫날 투표 하차 ${(out.filter((o) => o.firstDayOut).length / out.length * 100).toFixed(0)}%`);
  console.log("직업별 승률: " + Object.entries(roleWin).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${ROLES[k].name} ${(v.w / v.n * 100).toFixed(0)}%`).join(" · "));
}
process.exit(0);
