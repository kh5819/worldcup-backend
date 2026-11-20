// 좀비 생존 진단소 번역 시험 — node scripts/test-zom-i18n.mjs [판수=300]
// 1) 데이터·유형의 모든 한국어 문장이 사전에 있는지 2) 여러 판을 끝까지 돌리며 화면에 보낼 모든 응답(장면·결과·손 작업·하루 정리·진단)을 日/EN으로 바꿨을 때 한글이 남지 않는지
import * as C from "../src/zom-core.js";
import * as D from "../src/zom-data.js";
import { TYPES } from "../src/zom-types.js";
import { EVENTS2 } from "../src/zom-data2.js";
import { tx, trStr, _trTest } from "../src/zom-tr.js";
const N = Number(process.argv[2] || 300);
const H = /[가-힣]/;
let fails = 0; const seen = new Set(); const fail = (m) => { if (seen.has(m)) return; seen.add(m); fails++; if (fails <= 40) console.log("❌", m); };
// 1) 데이터 문장
const walk = (o, f) => { if (typeof o === "string") return f(o); if (Array.isArray(o)) return o.forEach((x) => walk(x, f)); if (o && typeof o === "object") for (const v of Object.values(o)) walk(v, f); };
let n = 0;
walk([D.EVENTS, D.FORCED, D.ITEMS, D.COMPS, D.STARVE_CAUSES, D.MAD_CAUSES, D.DEFAULT_CAUSE, TYPES, D.ABIL], (s) => { if (!H.test(s)) return; n++; for (const L of ["ja", "en"]) { const t = trStr(s, L); if (H.test(t)) fail(`[${L}] 사전에 없음: ${s.slice(0, 60)}`); } });
console.log(`데이터 문장 ${n}개 · 사전 ${_trTest.DICT.size}개 · 패턴 ${_trTest.PATS.length}개`);
// 2) 실제 응답
const check = (obj, where) => { for (const L of ["ja", "en"]) { const t = tx(obj, L); walk(t, (s) => { if (H.test(s)) fail(`[${L}] ${where}: ${s.slice(0, 70)}`); }); } };
function solve(t, r) {
  if (t.kind === "pack") return { pick: t.list.filter(() => r() < 0.5).map((x) => x.i) };
  if (t.kind === "barricade") return { stops: t.zones.map((z) => (r() < 0.6 ? z.c : 0)) };
  if (t.kind === "sneak") return r() < 0.5 ? { done: true, caught: false, prog: 1 } : { caught: true, prog: r() };
  if (t.kind === "radio") return { f: r() < 0.5 ? t.peaks.sort((a, b) => b.s - a.s)[0].f : 95 };
  if (t.kind === "aid") return { taps: t.opts.map((o) => o.id).sort(() => r() - 0.5) };
  if (t.kind === "escape") return { picks: t.jx.map(() => Math.floor(r() * 3)) };
  if (t.kind === "crank") return (r() < 0.6) ? { inBand: 0.9, over: 0 } : { inBand: 0.3, over: 0.4 };
  if (t.kind === "throw") return { shots: [{ a: 45, p: (r() < 0.6) ? 0.55 : 0.1 }] };
  if (t.kind === "spot") return { picks: (r() < 0.6) ? t.people.map((p, i) => (p.tells.some((x) => x === "pale" || x === "eyes") ? i : -1)).filter((i) => i >= 0) : [0, 1] };
  if (t.kind === "lockpick") return { rel: t.pins.map((p) => ((r() < 0.6) ? p.a : p.a + 40)) };
}
for (let g = 0; g < N; g++) {
  let rs = g * 7919 + 13; const r = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const st = C.newRun((g * 2654435761) >>> 0); C.nextScene(st); let t = 0, steps = 0;
  check({ scene: C.publicScene(st), st: C.publicState(st) }, "시작");
  while (!st.over && steps++ < 300) {
    const sc = C.publicScene(st);
    let res = C.choose(st, sc.choices[Math.floor(r() * sc.choices.length)].i, (t += 5000));
    if (res.task) { check(res.task, `손 작업 ${res.task.kind}`); res = C.finishTask(st, solve(res.task, r), (t += 9000)); }
    check(res, `결과 ${res.out?.ev}`);
  }
  check(C.diagnose(st), "진단");
}
console.log(fails ? `실패 ${fails}` : `통과 (${N}판, 日·EN)`);
process.exit(fails ? 1 : 0);
