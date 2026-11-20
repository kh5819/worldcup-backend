// 눈치 진단소 엔진 시험 — node scripts/test-nc.mjs [판수=400]
// 봇 성향(잘함·보통·막함)으로 끝까지: 오류·점수 범위·거짓말 문제 유일해·같은 씨앗 같은 결과·유형/단 분포·이상한 입력
import * as C from "../src/nc-core.js";
import { KAKAO, MAJOR } from "../src/nc-data.js";
const N = Number(process.argv[2] || 400);
let fails = 0; const fail = (m) => { fails++; if (fails < 25) console.log("❌", m); };
// 데이터
for (const k of KAKAO) if (k.o.filter((o) => o[1] === 2).length !== 1) fail("카톡 정답 1개 아님 " + k.id);
for (const m of MAJOR) if (m.p.length !== m.o.length) fail("다수 예측 기대치 개수 " + m.id);
// 거짓말 문제: 범인이 딱 한 명
{ const st = { rs: 1 }; for (let i = 0; i < 600; i++) { const L = C.genLie(st, i % 3); const sol = C.lieSolve(L.stmts); if (sol.length !== 1 || sol[0] !== L.c) fail("거짓말 해 " + JSON.stringify(sol)); } }
const crowd = new Map();
const ctx = { crowd: (id) => crowd.get(id) || null, vote: (id, i) => { const a = crowd.get(id) || [0, 0, 0, 0]; a[i]++; crowd.set(id, a); } };
function bot(st, skill, r) {
  const s = C.publicStep(st), g = s.g, it = st.item;
  if (g === "lie") return { pick: r() < skill ? it.lie.c : Math.floor(r() * 4) };
  if (g === "kakao") { const q = KAKAO.find((x) => x.id === it.id); const best = it.order.findIndex((i) => q.o[i][1] === 2); return { pick: r() < skill ? best : Math.floor(r() * it.order.length) }; }
  if (g === "trust") return { move: r() < 0.3 + skill * 0.4 ? "C" : "D" };
  if (g === "deal") { const d = it.d, t = d.t, last = d.log.at(-1)?.me; const step = 0.18 + skill * 0.1;
    if (d.role === "buy") { const first = d.ask * (0.62 - skill * 0.04 + r() * 0.06); return { price: last ? last + (d.counter - last) * step + d.ask * 0.02 : first }; }
    const first = d.counter * (1.75 + skill * 0.1 + r() * 0.1); return { price: last ? last - (last - d.counter) * step - d.counter * 0.02 : first }; }
  if (g === "bluff") return it.phase === "bet" ? { bet: 1 + Math.floor(r() * 3) } : { fold: it.cards[0] < 4 + r() * 4 * (1 - skill) };
  if (g === "major") { const q = MAJOR.find((x) => x.id === it.id); const top = q.p.indexOf(Math.max(...q.p)); return { mine: Math.floor(r() * q.o.length), guess: r() < skill ? top : Math.floor(r() * q.o.length) }; }
}
const types = {}, lv = {}, G = {}; let totSum = 0;
for (let g = 0; g < N; g++) {
  const skill = [0.9, 0.6, 0.25][g % 3]; let rs = g * 7919 + 1; const r = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const st = C.newRun((g * 2654435761) >>> 0); let n = 0;
  try {
    while (!st.over && n++ < 200) { const res = C.act(st, bot(st, skill, r), ctx); if (!res.ok) throw new Error(res.error); JSON.stringify(res); }
    if (!st.over) throw new Error("안 끝남");
    const d = C.diagnose(st); JSON.stringify(d);
    if (!(d.total >= 0 && d.total <= 100)) fail("점수 범위 " + d.total);
    for (const [k, v] of Object.entries(d.games)) if (v == null || v < 0 || v > 100) fail(`게임 점수 ${k} ${v}`);
    types[d.typeId] = (types[d.typeId] || 0) + 1; (G[skill] = G[skill] || []).push(d.games); lv[d.level] = (lv[d.level] || 0) + 1; totSum += d.total;
  } catch (e) { fail(`g${g}: ${e.message} ${String(e.stack).split("\n")[1]}`); }
}
// 같은 씨앗
function trail(seed) { const st = C.newRun(seed); const out = []; while (!st.over) { const s = C.publicStep(st); out.push(JSON.stringify(s).length); C.act(st, s.g === "lie" || s.g === "kakao" ? { pick: 0 } : s.g === "trust" ? { move: "C" } : s.g === "deal" ? { price: 100000 } : s.g === "bluff" ? (st.item.phase === "bet" ? { bet: 2 } : { fold: false }) : { mine: 0, guess: 0 }, {}); } return out.join(",") + C.diagnose(st).total; }
if (trail(42) !== trail(42)) fail("같은 씨앗 결과 다름");
// 이상한 입력
{ const st = C.newRun(9); for (const a of [null, {}, { pick: -1 }, { pick: 99 }, { pick: "x" }, { move: "Z" }, { price: "abc" }, { bet: 99 }, { mine: 9, guess: -2 }]) { try { const r = C.act(st, a || {}, ctx); if (r.ok && st.item?.g === "lie" && a?.pick == null) fail("빈 답 통과"); } catch (e) { fail("예외 " + JSON.stringify(a) + " " + e.message); } } }
// 숨은 정보가 화면 데이터에 없는지
{ const st = C.newRun(77); let leak = false; while (!st.over) { const s = JSON.stringify(C.publicStep(st)); if (/"c":|"rooms"|"M":|"per":|"cards"|"bluff":true|"kind":"(loyal|tft|sly|fickle|snake)"|"order"/.test(s)) leak = true; const p = C.publicStep(st); C.act(st, p.g === "trust" ? { move: "C" } : p.g === "deal" ? { price: 1e9 } : p.g === "bluff" ? (st.item.phase === "bet" ? { bet: 1 } : { fold: true }) : p.g === "major" ? { mine: 0, guess: 0 } : { pick: 0 }, {}); } if (leak) fail("숨은 정보가 화면 데이터에 들어감"); }
console.log(`판 ${N} · 평균 눈치 지수 ${Math.round(totSum / N)}`);
console.log("단:", Object.entries(lv).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}단:${v}`).join(" "));
console.log("유형:", Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
for (const [k, arr] of Object.entries(G)) { const o = {}; for (const g of Object.keys(arr[0])) o[g] = Math.round(arr.reduce((s, x) => s + x[g], 0) / arr.length); console.log("실력", k, JSON.stringify(o)); }
console.log(fails ? `실패 ${fails}` : "통과");
process.exit(fails ? 1 : 0);
