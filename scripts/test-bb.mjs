// 붕어빵 장사 진단소 엔진 시험 — node scripts/test-bb.mjs [판수=600]
// 봇 성향 4가지(계산형·무계획·인심·고가) × 굽기 실력 3단계로 끝까지: 오류·숫자 이상·폐업 개월 분포·유형 분포·같은 씨앗 같은 결과
import * as C from "../src/bb-core.js";
import { EVENTS, MENUS } from "../src/bb-data.js";
const N = Number(process.argv[2] || 600);
let fails = 0; const fail = (m) => { fails++; if (fails < 25) console.log("❌", m); };
// 데이터 검사
const ids = new Set();
for (const e of EVENTS) { if (ids.has(e.id)) fail("중복 " + e.id); ids.add(e.id); for (const c of e.c) for (const o of c.o) { if (o.e?.menu && !MENUS[o.e.menu]) fail(`${e.id} 메뉴 ${o.e.menu}`); } if (!e.c.some((c) => !c.need)) fail(`${e.id} 조건 없는 선택지 없음`); }
// 굽기 봇: 실력(skill 0~1)에 따라 틀 회전 속도·완벽 비율
function bakeBot(b, skill, r) {
  const cycle = 8.5 - skill * 3.2, perMold = Math.floor(b.dur / cycle), fish = Math.min(b.molds * perMold, b.prep * 3);
  const need = {}; for (const c of b.customers) need[c.f] = (need[c.f] || 0) + c.n * 3;
  const tot = Object.values(need).reduce((s, x) => s + x, 0) || 1, made = {};
  for (const m of b.sale) { const share = Math.round(fish * (need[m.id] || 0) / tot); const p = Math.round(share * (0.25 + skill * 0.65)), bb = Math.round(share * (0.25 - skill * 0.22) * (0.5 + r())); made[m.id] = { p, o: Math.max(0, share - p - bb), b: Math.max(0, bb) }; }
  const P = Object.fromEntries(b.sale.map((m) => [m.id, made[m.id].p])), O = Object.fromEntries(b.sale.map((m) => [m.id, made[m.id].o])), served = [];
  const rate = (b.molds / cycle) * 3 / 3;
  for (const c of b.customers) { const ready = Math.min(fish, rate * (c.at + c.pat)); const usedSoFar = served.reduce((s, i) => s + b.customers[i].n * 3, 0), need = c.n * 3; if (usedSoFar + need > ready) continue;
    if (b.kinds[c.k]?.perfect) { if (P[c.f] >= need) { P[c.f] -= need; served.push(c.i); } } else if (P[c.f] + O[c.f] >= need) { const fo = Math.min(O[c.f], need); O[c.f] -= fo; P[c.f] -= need - fo; served.push(c.i); } }
  const pTot = Object.values(made).reduce((s, x) => s + x.p, 0);
  return { made, served, combo: Math.round(pTot * skill * 0.5) };
}
const PLANS = {
  smart: (st, r) => { const s = st.forecast; return s <= 2 && st.cash > 700000 ? { closed: true } : { price: s >= 4 ? 2500 : s >= 3 ? 2000 : 1500, menus: st.menus.slice(-3).map((m) => m.id), prep: Math.round([3, 4, 7, 9, 11][s - 1] * (1 + 0.12 * (st.molds - 4))) }; },
  random: (st, r) => ({ price: 1000 + Math.floor(r() * 9) * 500, menus: st.menus.map((m) => m.id).sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 3)), prep: 4 + Math.floor(r() * 24), closed: r() < 0.05 }),
  cheap: (st) => ({ price: 1500, menus: st.menus.slice(0, 3).map((m) => m.id), prep: 16 }),
  pricey: (st) => ({ price: 3500, menus: st.menus.slice(0, 2).map((m) => m.id), prep: 10 }),
};
const dist = {}, types = {}, causes = {}, ends = {}, achN = {}, byBot = {}; let surv = 0, profitSum = 0, survCash = [];
for (let g = 0; g < N; g++) {
  const bot = Object.keys(PLANS)[g % 4], skill = [0.85, 0.55, 0.25][Math.floor(g / 4) % 3];
  let rs = g * 7919 + 1; const r = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const st = C.newRun((g * 2654435761) >>> 0); C.nextScene(st); let t = 0, steps = 0;
  try {
    while (!st.over && steps++ < 100) {
      let res;
      if (st.phase === "event") { const sc = C.publicScene(st); res = C.choose(st, sc.choices[Math.floor(r() * sc.choices.length)].i); }
      else if (st.phase === "plan") { if (bot === "smart") { const ps = C.publicState(st); for (const it of ps.shop || []) { const keep = 900000; if (it.state === "OK" && st.cash - it.price > keep && (it.id !== "stage" || [11, 12, 1].includes(ps.month)) && r() < 0.6) C.buy(st, it.id); } } res = C.submitPlan(st, PLANS[bot](C.publicState(st), r), (t += 1000)); if (res.bake) { const b = res.bake; res = C.submitBake(st, bakeBot(b, skill, r), (t += 41000)); } }
      if (!res?.ok) throw new Error(`${st.phase} ${res?.error}`);
      if (!Number.isFinite(st.cash) || !Number.isFinite(st.rep)) throw new Error("숫자 NaN");
    }
    if (!st.over) throw new Error("안 끝남");
    const d = C.diagnose(st); JSON.stringify(d);
    dist[d.months] = (dist[d.months] || 0) + 1; types[d.typeId] = (types[d.typeId] || 0) + 1; if (d.cause) causes[d.cause] = (causes[d.cause] || 0) + 1;
    ends[d.ending.id] = (ends[d.ending.id] || 0) + 1; for (const a of d.titles) achN[a.id] = (achN[a.id] || 0) + 1;
    const kb = bot + skill; byBot[kb] = byBot[kb] || [0, 0, []]; byBot[kb][0]++; if (d.survived) { byBot[kb][1]++; byBot[kb][2].push(d.cash); }
    if (d.survived) { surv++; survCash.push(d.cash); }
    profitSum += d.profit;
  } catch (e) { fail(`g${g} ${bot}: ${e.message} ${String(e.stack).split("\n")[1]}`); }
}
// 같은 씨앗
function trail(seed) { const st = C.newRun(seed); C.nextScene(st); const out = []; let t = 0; while (!st.over && out.length < 60) { if (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); else { const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 10 }, (t += 1000)); if (p.bake) C.submitBake(st, { made: { red: { p: 20 } }, served: [0, 1, 2] }, (t += 41000)); } out.push(st.mi + ":" + Math.round(st.cash)); } return out.join(","); }
if (trail(42) !== trail(42)) fail("같은 씨앗 결과 다름");
// 조작 방어: 너무 빠른 제출·불가능한 양
{ const st = C.newRun(9); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 30 }, 0); const r1 = C.submitBake(st, { made: { red: { p: 99999 } }, served: p.bake.customers.map((c) => c.i) }, 2000); if (r1.report.soldBags > 0) fail("너무 빠른 제출인데 판매됨"); }
{ const st = C.newRun(10); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 30 }, 0); const r1 = C.submitBake(st, { made: { red: { p: 99999 } }, served: p.bake.customers.map((c) => c.i) }, 41000); if (r1.report.made.p > st.molds * 10 + 10) fail("불가능한 양을 그대로 인정 " + r1.report.made.p); }
{ const st = C.newRun(11); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 30 }, 0); const r1 = C.submitBake(st, { made: { red: { p: 60 } }, served: p.bake.customers.map((c) => c.i) }, 10000); const tot = r1.report.made.p + r1.report.made.o + r1.report.made.b; if (tot > st.molds * 3) fail("10초에 40초 분량 인정 " + tot); if (r1.report.served > p.bake.customers.filter((c) => c.at <= 11).length) fail("아직 안 온 손님 판매"); }
// 상점·업적·엔딩·도감
{ const st = C.newRun(77); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); st.cash = 9e6; for (const id of ["mold", "mold", "flipper", "warmer", "sign", "stage", "sign", "stage", "mold", "mold"]) { const r = C.buy(st, id); if (!r.ok) fail("구매 " + id + " " + r.error); }
  if (st.up.stage !== 2 || st.up.sign !== 2 || st.molds !== 8) fail("구매 결과 " + JSON.stringify(st.up) + " " + st.molds);
  if (C.buy(st, "flipper").ok) fail("자동 뒤집개 두 번"); st.cash = 0; if (C.buy(st, "mold").ok) fail("돈 없이 구매"); if (C.buy(st, "zzz").ok) fail("없는 물건");
  st.phase = "bake"; if (C.buy(st, "mold").ok) fail("굽기 중 구매"); }
{ const st = C.newRun(78); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 30 }, 0); const b = p.bake;
  const pick = b.customers.find((c) => b.kinds[c.k].perfect); if (pick) { const r1 = C.submitBake(st, { made: { red: { p: 0, o: 60 } }, served: [pick.i] }, 41000); if (r1.report.served) fail("완벽만 사는 손님에게 괜찮음 판매"); } }
{ const d = C.diagnose((() => { const st = C.newRun(5); C.nextScene(st); let t = 0; while (!st.over) { if (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); else { const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 10 }, (t += 1000)); if (p.bake) C.submitBake(st, { made: { red: { p: 30 } }, served: p.bake.customers.map((c) => c.i), combo: 30 }, (t += 41000)); } } return st; })());
  if (!d.ending?.id || !Array.isArray(d.titles) || !d.codex?.events?.length) fail("엔딩·업적·도감 없음"); }
// 연표: 상점을 많이 사도 마지막 '완주'가 남음 · 6개월 대결엔 1년 업적 없음
{ const st = C.newRun(91); C.nextScene(st); let t = 0; while (!st.over) { if (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); else { st.cash += 5e6; for (let k = 0; k < 4; k++) for (const it of C.shopList(st)) if (it.state === "OK") C.buy(st, it.id); const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 10 }, (t += 1000)); if (p.bake) C.submitBake(st, { made: { red: { p: 30 } }, served: p.bake.customers.map((c) => c.i) }, (t += 41000)); } }
  const d = C.diagnose(st); if (!d.timeline.some((x) => x.ic === "🎉" || x.ic === "🔒")) fail("연표에 마지막 기록 빠짐"); }
{ const st = C.newRun(92, { months: 6 }); C.nextScene(st); let t = 0; while (!st.over) { if (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i); else { st.cash += 3e6; const p = C.submitPlan(st, { price: 2000, menus: ["red"], prep: 8 }, (t += 1000)); if (p.bake) C.submitBake(st, { made: { red: { p: 24 } }, served: p.bake.customers.map((c) => c.i) }, (t += 41000)); } }
  const d = C.diagnose(st); if (d.survived && d.titles.some((a) => ["year", "noclose", "noloan", "nowaste"].includes(a.id))) fail("6개월인데 1년 업적"); }
// 이상한 입력: 예외·NaN 없이 처리
{ const junk = [null, 1, "x", [], { made: "x" }, { made: { red: { p: -5, o: 1e9, b: "z" } }, served: "1,2", combo: 1e9 }, { made: { red: { p: 30 }, hack: { p: 99 } }, served: [-1, 1e6, "0", null, 0, 0, 0], combo: -3 }, { served: Array(5000).fill(0) }];
  for (const [n, j] of junk.entries()) { const st = C.newRun(500 + n); C.nextScene(st); while (st.phase === "event") C.choose(st, C.publicScene(st).choices[0].i);
    for (const id of [null, 5, "constructor", "__proto__", "mold", { a: 1 }]) { try { C.buy(st, id); } catch (e) { fail("buy 예외 " + String(id) + " " + e.message); } }
    try { const p = C.submitPlan(st, { price: "abc", menus: "red", prep: -9 }, 0); if (!p.ok) fail("이상한 계획 거부됨"); const r = C.submitBake(st, j, 41000); if (!r.ok || !Number.isFinite(st.cash) || !Number.isFinite(st.rep) || !Number.isFinite(r.report.revenue)) fail("이상한 굽기 결과 " + n); if (r.report.tips > r.report.revenue) fail("팁이 매출보다 큼"); } catch (e) { fail("굽기 예외 " + n + " " + e.message); } } }
const cat = C.catalog(); if (cat.events.length !== 28 || cat.events.some((e) => e.n === e.id)) fail("도감 사건 이름");
for (const [k, list] of Object.entries(cat)) for (const x of list) for (const f of ["n", "d"]) if (f in x && typeof x[f] !== "string") fail(`도감 ${k}.${x.id}.${f} 글자가 아님`);
const sc = [...survCash].sort((a, b) => a - b);
console.log(`판 ${N} · 완주 ${Math.round(surv / N * 100)}% (완주 통장 중간값 ${sc.length ? Math.round(sc[sc.length >> 1] / 10000) : "-"}만 원) · 평균 순이익 ${Math.round(profitSum / N / 10000)}만 원`);
console.log("버틴 개월:", Object.entries(dist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" "));
console.log("유형:", Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
console.log("봇별 완주:", Object.entries(byBot).map(([k, v]) => `${k} ${Math.round(v[1] / v[0] * 100)}%(${v[2].length ? Math.round(v[2].sort((a, b) => a - b)[v[2].length >> 1] / 10000) : '-'}만)`).join(" · ")); console.log("엔딩:", Object.entries(ends).map(([k, v]) => `${k}:${v}`).join(" ")); console.log("업적:", Object.entries(achN).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
console.log("폐업 사유:\n " + Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} · ${k}`).join("\n "));
console.log(fails ? `실패 ${fails}` : "통과");
process.exit(fails ? 1 : 0);
