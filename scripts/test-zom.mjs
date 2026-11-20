// 좀비 생존 진단소 엔진 시험 — node scripts/test-zom.mjs [판수=400]
// 1) 데이터 검사(물건·동료·조건 이름) 2) 봇 여러 성향으로 끝까지 플레이: 오류·무한루프·숫자 이상 3) 생존 일수 분포·유형 분포 4) 같은 씨앗+같은 선택 = 같은 결과
import * as C from "../src/zom-core.js";
import { EVENTS, FORCED, ITEMS, COMPS } from "../src/zom-data.js";
const N = Number(process.argv[2] || 400);
let fails = 0; const fail = (m) => { fails++; if (fails < 30) console.log("❌", m); };

// ---------- 1) 데이터 ----------
const ids = new Set();
const condWords = (s) => String(s || "").split("&").filter(Boolean).map((p) => p.replace(/^!/, ""));
const okWord = (w) => /^(noise|food|hp|san|day)[<>]\d/.test(w) || w === "comp" || w === "comp2" || w.startsWith("flag:") || ITEMS[w];
for (const e of [...EVENTS, ...Object.values(FORCED)]) {
  if (ids.has(e.id)) fail(`중복 id ${e.id}`); ids.add(e.id);
  for (const w of condWords(e.need)) if (!okWord(w)) fail(`${e.id} need ${w}`);
  if (!e.c.some((c) => !c.need)) fail(`${e.id} 조건 없는 선택지가 없음`);
  for (const c of e.c) {
    for (const w of condWords(c.need)) if (!okWord(w)) fail(`${e.id} 선택 need ${w}`);
    const outs = c.task ? [...(c.ok || []), ...(c.mid || []), ...(c.bad || [])] : c.o;
    if (!outs?.length) fail(`${e.id} "${c.t}" 결과 없음`);
    if (c.task && !(c.ok?.length && c.mid?.length && c.bad?.length)) fail(`${e.id} 손 작업 결과 3단계 빠짐`);
    for (const o of outs || []) {
      for (const w of condWords(o.when)) if (!okWord(w)) fail(`${e.id} when ${w}`);
      for (const it of [...(o.e?.add || []), ...(o.e?.rm || [])]) if (!ITEMS[it]) fail(`${e.id} 물건 ${it}`);
      if (o.e?.join && !COMPS[o.e.join.replace("!", "")]) fail(`${e.id} 동료 ${o.e.join}`);
      if (o.e?.hp < 0 && !o.cause && !o.kill && e.id !== "f_turn") { /* 사인 없는 피해는 기본 사인 */ }
      if (o.e?.hp <= -15 && !o.cause) fail(`${e.id} 큰 피해인데 사인 없음: ${o.m.slice(0, 20)}`);
    }
  }
}
console.log(`사건 ${EVENTS.length} (낮 ${EVENTS.filter((e) => e.ph === "day").length} · 밤 ${EVENTS.filter((e) => e.ph === "night").length}) + 강제 ${Object.keys(FORCED).length}`);

// ---------- 2) 봇 ----------
const BOTS = {
  random: (st, sc, r) => sc.choices[Math.floor(r() * sc.choices.length)].i,
  careful: (st, sc, r) => (sc.choices.find((c) => c.need) || sc.choices[Math.floor(r() * sc.choices.length)]).i,
  first: (st, sc) => sc.choices[0].i,
};
const TASK = { good: 0.9, mid: 0.55, bad: 0.15 };
function solveTask(t, skill, r) {
  const ok = r() < skill;
  if (t.kind === "pack") { let w = 0; const pick = []; for (const it of t.list) if (w + it.w <= t.cap && (ok || r() < 0.5)) { pick.push(it.i); w += it.w; } return { pick }; }
  if (t.kind === "barricade") return { stops: t.zones.map((z) => (r() < skill ? z.c : (z.c + 0.4) % 1)) };
  if (t.kind === "sneak") return ok ? { done: true, caught: false, prog: 1 } : { done: false, caught: true, prog: r() };
  if (t.kind === "radio") { const best = t.peaks.sort((a, b) => b.s - a.s)[0]; return { f: ok ? best.f : 90 }; }
  if (t.kind === "aid") return { taps: t.opts.map((o) => o.id) };
  if (t.kind === "escape") return { picks: t.jx.map(() => Math.floor(r() * 3)) };
  if (t.kind === "crank") return ok ? { inBand: 0.9, over: 0 } : { inBand: 0.3, over: 0.4 };
  if (t.kind === "throw") return { shots: [{ a: 45, p: ok ? 0.55 : 0.1 }] };
  if (t.kind === "spot") return { picks: ok ? t.people.map((p, i) => (p.tells.some((x) => x === "pale" || x === "eyes") ? i : -1)).filter((i) => i >= 0) : [0, 1] };
  if (t.kind === "lockpick") return { rel: t.pins.map((p) => (ok ? p.a : p.a + 40)) };
}
const dist = {}, types = {}, causes = {}; let totalDays = 0, rescued = 0, maxSteps = 0, totalSteps = 0;
for (let g = 0; g < N; g++) {
  const seed = (g * 2654435761) >>> 0, bot = Object.keys(BOTS)[g % 3], skill = [0.9, 0.55, 0.2][g % 3 === 0 ? 1 : (g >> 1) % 3];
  let rs = seed ^ 0x9e3779b9; const r = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const st = C.newRun(seed); C.nextScene(st);
  let steps = 0, t = 1000;
  try {
    while (!st.over && steps < 400) {
      const sc = C.publicScene(st); if (!sc) throw new Error(`장면 없음 day=${st.day} ph=${st.ph}`);
      if (!sc.choices.length) throw new Error(`선택지 없음 ${sc.id}`);
      let res = C.choose(st, BOTS[bot](st, sc, r), (t += 5000));
      if (!res.ok) throw new Error(`choose ${res.error}`);
      if (res.task) { res = C.finishTask(st, solveTask(res.task, skill, r), (t += 8000)); if (!res.ok) throw new Error(`task ${res.error}`); }
      steps++;
      for (const k of ["hp", "food", "noise", "san"]) if (!Number.isFinite(st[k])) throw new Error(`${k} NaN`);
      if (st.hp > 100 || st.san > 100 || st.noise > 100 || st.noise < 0 || st.food < 0) throw new Error(`범위 밖 hp${st.hp} san${st.san} noise${st.noise} food${st.food}`);
      if (st.comps.filter((c) => c.alive).length > 3) throw new Error("동료 3명 넘음");
    }
    if (!st.over) throw new Error("400걸음 안에 안 끝남");
    const dg = C.diagnose(st);
    dist[Math.min(30, dg.days)] = (dist[Math.min(30, dg.days)] || 0) + 1; totalDays += dg.days; if (dg.rescued) rescued++;
    types[dg.typeId] = (types[dg.typeId] || 0) + 1; if (dg.cause) causes[dg.cause] = (causes[dg.cause] || 0) + 1;
    maxSteps = Math.max(maxSteps, steps); totalSteps += steps;
    JSON.stringify(dg);
  } catch (e) { fail(`g${g} ${bot}: ${e.message}\n   ${String(e.stack).split("\n")[1]}`); }
}
// ---------- 3) 같은 씨앗 같은 결과 ----------
function replay(seed) { const st = C.newRun(seed); C.nextScene(st); const trail = []; let t = 0; while (!st.over && trail.length < 300) { const sc = C.publicScene(st); let res = C.choose(st, sc.choices[0].i, (t += 5000)); if (res.task) res = C.finishTask(st, solveTask(res.task, 1, () => 0.1), (t += 9000)); trail.push(sc.id + ":" + st.hp + ":" + st.food); } return trail.join("|"); }
if (replay(777) !== replay(777)) fail("같은 씨앗·같은 선택인데 결과가 다름");

console.log(`판 ${N} · 평균 생존 ${(totalDays / N).toFixed(1)}일 · 구조 ${(rescued / N * 100).toFixed(0)}% · 평균 선택 ${(totalSteps / N).toFixed(1)}번 (최대 ${maxSteps})`);
console.log("생존 일수:", Object.entries(dist).sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}일:${n}`).join(" "));
console.log("유형:", Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(" "));
console.log("사인 TOP 8:\n " + Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${n} · ${k}`).join("\n "));
console.log(fails ? `실패 ${fails}` : "통과");
process.exit(fails ? 1 : 0);
