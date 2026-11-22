// 좀비 생존 난이도 측정 — 사람처럼 '결과를 따져 보고' 고르는 봇 (node scripts/sim-zom-smart.mjs [판수])
// 무작위 봇(test-zom)은 사람보다 훨씬 못해서 난이도가 실제보다 어렵게 보였음 → 이 봇으로 맞춤
// 봇 3단계: 고수(손 작업 90%·잘 따짐) / 보통(70%·가끔 실수) / 초보(45%·자주 실수)
import * as C from "../src/zom-core.js";
import { EVENTS, FORCED } from "../src/zom-data.js";
const N = Number(process.argv[2] || 600);
const EVM = new Map([...EVENTS, ...Object.values(FORCED)].map((e) => [e.id, e]));
function outVal(st, o) {
  const e = o.e || {}; let v = 0;
  if (o.kill) return -500;
  if (e.hp) v += e.hp * (st.hp < 40 ? 2 : 1);
  if (e.food) v += e.food * (st.food < 2 ? 22 : 12);
  if (e.foodHalf) v -= st.food * 6;
  if (e.san) v += e.san * (st.san < 40 ? 1.5 : 0.6);
  if (e.noise) v -= e.noise * (st.noise > 45 ? 0.9 : 0.35);
  if (e.join) v += st.comps.filter((c) => c.alive).length < 3 ? (e.join.endsWith("!") ? 4 : 18) : 0;
  if (e.add) v += e.add.length * 6; if (e.rm) v -= e.rm.length * 6;
  if (e.flag === "evac" || e.flag === "contact") v += 15; if (e.flag === "fort") v += 12; if (e.garden) v += 15;
  if (e.trust) v += e.trust * 0.3; if (e.leave) v -= 12;
  // v3: 감염·겨울 (사람도 이 정도는 따짐)
  if (e.inf) v -= st.flags.infected ? 5 : 35; if (e.cure && st.flags.infected) v += 40;
  if (e.add?.includes("antibiotic")) v += st.flags.infected ? 30 : 8;
  if (e.warm) v += e.warm * (st.day >= 14 ? 6 : 2); if (e.flag === "heat") v += st.day >= 12 ? 35 : 15;
  if (e.rescued) v += 200;
  return v;
}
const avgOut = (st, outs) => { const t = outs.reduce((s, o) => s + (o.w || 1), 0) || 1; return outs.reduce((s, o) => s + outVal(st, o) * (o.w || 1), 0) / t; };
function choiceVal(st, ev, c, skill) {
  if (c.task) return avgOut(st, c.ok) * skill + avgOut(st, c.mid) * (1 - skill) * 0.7 + avgOut(st, c.bad) * (1 - skill) * 0.3;
  return avgOut(st, c.o || []);
}
function solveTask(t, skill, r) {
  const ok = r() < skill;
  if (t.kind === "pack") { const l = [...t.list].sort((a, b) => (b.food || 0.5) / b.w - (a.food || 0.5) / a.w); let w = 0; const pick = []; for (const it of l) if (w + it.w <= t.cap && (ok || r() < 0.5)) { pick.push(it.i); w += it.w; } return { pick }; }
  if (t.kind === "barricade") return { stops: t.zones.map((z) => (r() < skill ? z.c : (z.c + 0.4) % 1)) };
  if (t.kind === "sneak") return ok ? { done: true, caught: false, prog: 1 } : { done: false, caught: true, prog: r() };
  if (t.kind === "radio") { const best = [...t.peaks].sort((a, b) => b.s - a.s)[0]; return { f: ok ? best.f : 90 }; }
  if (t.kind === "aid") return { taps: t.opts.map((o) => o.id) };
  if (t.kind === "escape") return { picks: t.jx.map(() => Math.floor(r() * 3)) };
  if (t.kind === "crank") return ok ? { inBand: 0.9, over: 0 } : { inBand: 0.3, over: 0.4 };
  if (t.kind === "throw") return { shots: [{ a: 45, p: ok ? 0.55 : 0.1 }] };
  if (t.kind === "spot") return { picks: ok ? t.people.map((p, i) => (p.tells.some((x) => x === "pale" || x === "eyes") ? i : -1)).filter((i) => i >= 0) : [0, 1] };
  if (t.kind === "lockpick") return { rel: t.pins.map((p) => (ok ? p.a : p.a + 40)) };
}
const LV = { pro: { skill: 0.9, err: 0.05 }, mid: { skill: 0.7, err: 0.2 }, new: { skill: 0.45, err: 0.4 } };
for (const [name, L] of Object.entries(LV)) {
  let days = 0, resc = 0, hpEnd = [], sanEnd = []; const causes = {}, dd = {};
  for (let g = 0; g < N; g++) {
    const seed = ((g + 1) * 2246822519) >>> 0; let rs = seed ^ 0x51ed27; const r = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
    const st = C.newRun(seed); C.nextScene(st); let t = 1000, steps = 0;
    while (!st.over && steps++ < 400) {
      const sc = C.publicScene(st), ev = EVM.get(sc.id);
      let pick = sc.choices[Math.floor(r() * sc.choices.length)].i;
      if (r() >= L.err) { let best = -1e9; for (const ch of sc.choices) { const v = choiceVal(st, ev, ev.c[ch.i], L.skill) + r() * 2; if (v > best) { best = v; pick = ch.i; } } }
      let res = C.choose(st, pick, (t += 5000)); if (res.task) res = C.finishTask(st, solveTask(res.task, L.skill, r), (t += 8000));
    }
    const dg = C.diagnose(st); days += dg.days; if (dg.rescued) { resc++; hpEnd.push(st.hp); sanEnd.push(st.san); } else causes[dg.cause] = (causes[dg.cause] || 0) + 1;
    const b = dg.days >= 30 ? "30" : dg.days >= 20 ? "20-29" : dg.days >= 10 ? "10-19" : "1-9"; dd[b] = (dd[b] || 0) + 1;
  }
  const a = (x) => (x.length ? Math.round(x.reduce((s, v) => s + v, 0) / x.length) : "-");
  console.log(`${name.padEnd(4)} 평균 ${(days / N).toFixed(1)}일 · 구조 ${Math.round((resc / N) * 100)}% · 구조 때 체력 ${a(hpEnd)} 정신력 ${a(sanEnd)} · ${JSON.stringify(dd)} · 사인 ${Object.entries(causes).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => k.slice(0, 14) + ':' + n).join(' / ')}`);
}
