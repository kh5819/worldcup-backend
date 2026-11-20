// =========================
// 플듀 붕어빵 장사 진단소 — 엔진 (서버 전용, 순수 함수)
// 한 달: event(사건 선택, 없을 수도) → plan(가격·메뉴·반죽·휴업) → bake(40초 굽기, 손님 목록은 서버가 정함) → 정산 → 다음 달
// 같은 씨앗 + 같은 선택 = 같은 손님·사건 (오늘의 장사·방송 진단소·친구 대결은 모두 같은 씨앗)
// =========================
import { START_CASH, RENT, FIXED, CLOSED_FIXED, MONTH_F, BAKE_SEC, MONTHS, SEASON, MENUS, START_MENUS, MAX_SELL, EVENTS, CAUSES, DEFAULT_CAUSE, ABIL, TYPES } from "./bb-data.js";
import { STAGES, UPGRADES, SIGN_F, WEATHER, WX_ODDS, KINDS, ENDINGS, ACHS, EVENT_NAMES } from "./bb-data2.js";

export const CORE_VERSION = 2;
const EV = new Map(EVENTS.map((e) => [e.id, e]));
const COOK = { side: 2.4, good: [2.3, 3.6], burn: 4.4 };   // 한 면 굽기(초): 2.3~3.6 노릇 · 4.4 넘으면 탐
const STAFF_WAGE = 200000, LOAN_INT = 30000, DELIVERY_FEE = 0.08;

export function rnd(st) { let t = (st.rs = (st.rs + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const dayKey = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r0 = (v) => Math.round(v);
const pickW = (st, arr) => { const tot = arr.reduce((s, x) => s + (x.w ?? 1), 0); let r = rnd(st) * tot; for (const x of arr) { r -= x.w ?? 1; if (r < 0) return x; } return arr[arr.length - 1]; };
const monthOf = (st) => MONTHS[st.mi];

export function newRun(seed, { months = 12 } = {}) {
  const st = {
    v: CORE_VERSION, seed: seed >>> 0, rs: seed >>> 0, mi: 0, months: clamp(months | 0, 3, 12), cash: START_CASH, rep: 50, molds: 4,
    menus: START_MENUS.slice(), flags: {}, used: {}, phase: "event", cur: null, day: null, mult: 1, rival: 0, flourLeft: 0, lastQ: 0.6, lastPrice: 2000, lastSale: START_MENUS.slice(0, 2), lastPrep: 14,
    over: null, hist: [], log: [], keys: [], met: { g: [], b: [], bets: 0, q: [], waste: [], lost: [], price: [], profit: [], closed: 0, served: 0, cust: 0, sold: {}, loss: { waste: 0, burnt: 0, slow: 0, summer: 0, cheap: 0, pricey: 0, rival: 0 },
      pf: 0, maxCombo: 0, kinds: {}, kindsMet: {}, rushBest: 0, rainWin: 0, fullServe: 0, lowCash: START_CASH, wxSeen: {}, tips: 0, buys: 0 },
    up: { mold: 0, flipper: 0, warmer: 0, sign: 0, stage: 0 }, wx: null, boomNext: 0,
  };
  st.wx = rollWeather(st, MONTHS[0]);
  return st;
}
// ---------- 가게 성장 · 날씨 ----------
export const maxMolds = (st) => STAGES[st.up.stage].maxMolds;
const shopF = (st) => STAGES[st.up.stage].demand * SIGN_F[st.up.sign];
export function rollWeather(rs, mon) {   // rs: { rs } 난수 상태 (한 판 또는 방 전체)
  const odds = WX_ODDS[mon] || { clear: 1 }, out = [];
  for (let w = 0; w < 4; w++) { let r = rnd(rs); let k = "clear"; for (const [id, p] of Object.entries(odds)) { r -= p; if (r < 0) { k = id; break; } } out.push(k); }
  return out;
}
function wxF(st, sale = []) {
  const wx = st.wx || ["clear"]; let f = 0;
  for (const w of wx) { let x = WEATHER[w].f; if (w === "rain") x *= STAGES[st.up.stage].rain; if (w === "hot" && sale.includes("ice")) x = 0.3; f += x; }
  return 1 + f / wx.length;
}
function upPrice(st, id) {
  const u = UPGRADES.find((x) => x.id === id); if (!u) return { err: "BAD_ITEM" };
  const lv = st.up[id] | 0;
  if (id === "mold") { if (st.molds >= maxMolds(st)) return { err: "MAXED" }; return { price: u.price[Math.min(lv, u.price.length - 1)] }; }
  if (lv >= u.price.length) return { err: "MAXED" };
  if (id === "sign" && lv === 1 && st.up.stage < 1) return { err: "LOCKED" };
  return { price: u.price[lv] };
}
export function shopList(st) {
  return UPGRADES.map((u) => { const x = upPrice(st, u.id), lv = st.up[u.id] | 0;
    const name = u.id === "stage" ? (STAGES[lv + 1] ? STAGES[lv + 1].n : STAGES[lv].n) : u.id === "sign" && lv === 1 ? "LED 전광판" : u.n;
    return { id: u.id, ic: u.id === "stage" ? (STAGES[lv + 1] || STAGES[lv]).ic : u.ic, n: name, d: u.d, lv, price: x.price ?? null, state: x.err || (x.price > st.cash ? "POOR" : "OK") }; });
}
export function buy(st, id) {
  if (st.over) return { ok: false, error: "OVER" };
  if (st.phase !== "plan") return { ok: false, error: "BAD_PHASE" };
  const x = upPrice(st, String(id || "")); if (x.err) return { ok: false, error: x.err };
  if (st.cash - x.price < 0) return { ok: false, error: "POOR" };
  st.cash -= x.price; st.met.buys++;
  if (id === "mold") { st.up.mold++; st.molds = Math.min(maxMolds(st), st.molds + 1); keyEvent(st, "🔥", `붕어빵 틀 ${st.molds}개로 늘림`); }
  else { st.up[id]++; if (id === "stage") keyEvent(st, STAGES[st.up.stage].ic, `${STAGES[st.up.stage].n} 오픈`); else keyEvent(st, UPGRADES.find((u) => u.id === id).ic, `${id === "sign" && st.up.sign === 2 ? "LED 전광판" : UPGRADES.find((u) => u.id === id).n} 설치`); }
  return { ok: true, st: publicState(st), shop: shopList(st) };
}

// ---------- 조건 ----------
function cond(st, s) {
  if (!s) return true;
  return String(s).split("&").every((p0) => {
    const neg = p0.startsWith("!"), p = neg ? p0.slice(1) : p0; let v;
    const m = p.match(/^(cash|rep|molds|season)([<>])(\d+(?:\.\d+)?)$/);
    if (m) { const x = m[1] === "season" ? SEASON[monthOf(st)] : st[m[1]]; v = m[2] === "<" ? x < +m[3] : x > +m[3]; }
    else if (p.startsWith("flag:")) v = !!st.flags[p.slice(5)];
    else if (p.startsWith("menu:")) v = st.menus.includes(p.slice(5));
    else v = false;
    return neg ? !v : v;
  });
}

// ---------- 장면 ----------
export function nextScene(st) {
  if (st.over || st.phase !== "event" || st.cur) return;
  const mon = monthOf(st);
  const fixed = EVENTS.find((e) => Array.isArray(e.m) && e.m.includes(mon) && !st.used[e.id] && cond(st, e.need) && (e.w === 0 || true) && (e.w === 0 || rnd(st) < 0.7));
  let ev = fixed || null;
  if (!ev && rnd(st) < 0.62) {
    const pool = EVENTS.filter((e) => e.m === "any" && e.w > 0 && st.mi + 1 >= (e.minM || 1) && cond(st, e.need) && !(e.once && st.used[e.id]));
    let fresh = pool.filter((e) => !st.used[e.id]); if (!fresh.length) fresh = pool;
    if (fresh.length) ev = pickW(st, fresh);
  }
  if (!ev) { st.phase = "plan"; return; }
  st.used[ev.id] = (st.used[ev.id] || 0) + 1;
  st.cur = { id: ev.id, vis: ev.c.map((c, i) => (cond(st, c.need) ? i : -1)).filter((i) => i >= 0) };
}
export function publicState(st) {
  const mon = monthOf(st);
  return {
    mi: st.mi, month: mon, months: st.months, phase: st.phase, cash: r0(st.cash), rep: r0(st.rep), molds: st.molds,
    menus: st.menus.map((k) => ({ id: k, n: MENUS[k].n, ic: MENUS[k].ic, cost: MENUS[k].cost, col: MENUS[k].col })),
    rival: st.rival || 0, staff: !!st.flags.staff, delivery: !!st.flags.delivery, loan: !!st.flags.loan, flourLeft: st.flourLeft,
    forecast: forecastStars(st), last: { price: st.lastPrice, sale: st.lastSale, prep: st.lastPrep }, fixedCost: fixedCost(st, false), closedCost: fixedCost(st, true),
    up: { ...st.up }, stage: STAGES[st.up.stage].n, stageIc: STAGES[st.up.stage].ic, maxMolds: maxMolds(st), wx: (st.wx || []).map((w) => ({ id: w, ic: WEATHER[w].ic, n: WEATHER[w].n })), shop: st.phase === "plan" ? shopList(st) : null,
  };
}
function forecastStars(st) { const s = SEASON[monthOf(st)] * st.mult * shopF(st) * wxF(st); return s >= 1.25 ? 5 : s >= 0.95 ? 4 : s >= 0.6 ? 3 : s >= 0.38 ? 2 : 1; }
export function publicScene(st) {
  if (!st.cur) return null;
  const ev = EV.get(st.cur.id);
  return { id: ev.id, mi: st.mi, month: monthOf(st), t: ev.t, choices: st.cur.vis.map((i) => ({ i, t: ev.c[i].t, need: ev.c[i].need?.includes("menu:") ? null : null })) };
}

// ---------- 사건 선택 ----------
export function choose(st, ci) {
  if (st.over) return { ok: false, error: "OVER" };
  if (st.phase !== "event" || !st.cur) return { ok: false, error: "NO_SCENE" };
  ci = Number(ci); if (!st.cur.vis.includes(ci)) return { ok: false, error: "BAD_CHOICE" };
  const ev = EV.get(st.cur.id), c = ev.c[ci];
  st.met.g.push(c.g || 0); if (c.b) st.met.b.push(c.b);
  const cand = c.o.filter((o) => cond(st, o.when)), o = pickW(st, cand.length ? cand : c.o);
  const e = o.e || {}, before = { cash: st.cash, rep: st.rep }, notes = [];
  if (e.cash) st.cash += e.cash;
  if (e.rep) st.rep = clamp(st.rep + e.rep, 5, 100);
  if (e.mult) st.mult *= e.mult;
  if (e.molds) { st.molds = Math.min(maxMolds(st), st.molds + e.molds); notes.push(`🔥 붕어빵 틀 ${st.molds}개`); keyEvent(st, "🔥", `붕어빵 틀 ${st.molds}개로 늘림`); }
  if (e.menu && !st.menus.includes(e.menu)) { st.menus.push(e.menu); notes.push(`${MENUS[e.menu].ic} ${MENUS[e.menu].n} 메뉴 추가`); keyEvent(st, MENUS[e.menu].ic, `${MENUS[e.menu].n} 출시`); }
  if (e.flag) { st.flags[e.flag] = 1; if (e.flag === "flour") st.flourLeft = 5; if (e.flag === "staff") keyEvent(st, "🧑‍🍳", "알바생 고용"); if (e.flag === "delivery") keyEvent(st, "🛵", "배달 앱 입점"); if (e.flag === "loan") keyEvent(st, "🏦", "소상공인 대출"); }
  if (e.rival) { st.rival = e.rival; keyEvent(st, "🏪", "건너편에 프랜차이즈 개업"); }
  if (["tv", "festival", "flour", "youtuber"].includes(ev.id) && ci === 0) st.met.bets++;
  if (ev.id === "youtuber" && e.rep >= 10) keyEvent(st, "📸", "유튜버 영상이 터짐");
  if (ev.id === "tv" && ci === 0) { keyEvent(st, "📺", "'서민 갑부' 출연"); st.flags.star = 1; }
  if (ev.id === "youtuber" && e.rep >= 10) st.flags.star = 1;
  logLine(st, o.m);
  st.cur = null; st.phase = "plan";
  return { ok: true, out: { m: o.m, notes, d: { cash: r0(st.cash - before.cash), rep: r0(st.rep - before.rep) } }, st: publicState(st), phase: "plan" };
}

// ---------- 계획 → 오늘 손님 ----------
function fixedCost(st, closed) { return (closed ? RENT * 0.5 : RENT) + STAGES[st.up.stage].rent + (closed ? CLOSED_FIXED : FIXED) + (st.flags.staff ? STAFF_WAGE : 0) + (st.flags.loan ? LOAN_INT : 0); }
function menuCost(st, k) { return MENUS[k].cost * (st.flourLeft > 0 ? 0.7 : 1); }
export function demandOf(st, price, sale) {
  const mon = monthOf(st);
  let season = SEASON[mon];
  if (sale.includes("ice") && [5, 6, 7, 8, 9].includes(mon)) season *= 1.9;
  const draw = sale.reduce((s, k) => s + MENUS[k].draw, 0) / sale.length * (1 + 0.05 * (sale.length - 1));
  const priceF = Math.pow(2000 / price, price > 2500 ? 1.95 : 1.5), repF = 0.55 + (st.rep / 100) * 0.9, qF = 0.85 + st.lastQ * 0.3;
  let share = 1;
  if (st.rival) { const me = priceF * repF * qF, them = 0.8 * Math.pow(2000 / st.rival, 1.5); share = Math.min(1, (me / (me + them)) * 1.55); }
  return 22 * season * priceF * repF * qF * draw * share * st.mult * (st.flags.delivery ? 1.12 : 1) * shopF(st) * wxF(st, sale);
}
// 친구 대결(같은 거리): 모두 같은 사건 · 거리 손님을 가게 매력대로 나눔
export function forceEvent(st, id) {
  st.cur = null;
  if (st.over) return;
  const ev = id ? EV.get(id) : null;
  if (!ev) { st.phase = "plan"; return; }
  st.phase = "event"; st.used[ev.id] = (st.used[ev.id] || 0) + 1;
  st.cur = { id: ev.id, vis: ev.c.map((c, i) => (cond(st, c.need) ? i : -1)).filter((i) => i >= 0) };
  if (!st.cur.vis.length) { st.cur = null; st.phase = "plan"; }
}
export function pickStreetEvent(roomSt, mi) {   // roomSt: { rs } 방 전체 난수
  const mon = MONTHS[mi];
  const fixed = EVENTS.find((e) => Array.isArray(e.m) && e.m.includes(mon));
  if (fixed && (fixed.w === 0 || rnd(roomSt) < 0.7)) return fixed.id;
  if (rnd(roomSt) < 0.62) { const pool = EVENTS.filter((e) => e.m === "any" && e.w > 0 && mi + 1 >= (e.minM || 1) && !/cash<|molds</.test(e.need || "")); if (pool.length) return pickW(roomSt, pool).id; }
  return null;
}
export const weatherFactor = (st, sale) => wxF(st, sale);
export function attractOf(st, price, sale) {
  const draw = sale.reduce((s, k) => s + MENUS[k].draw, 0) / sale.length * (1 + 0.05 * (sale.length - 1));
  return Math.pow(2000 / price, price > 2500 ? 2.0 : 1.6) * (0.55 + (st.rep / 100) * 0.9) * (0.85 + st.lastQ * 0.3) * draw * shopF(st);
}
export function normPlan(st, p = {}) {
  const price = clamp(Math.round((Number(p.price) || 2000) / 500) * 500, 1000, 5000);
  let sale = [...new Set((Array.isArray(p.menus) ? p.menus : []).map(String))].filter((k) => st.menus.includes(k)).slice(0, MAX_SELL);
  if (!sale.length) sale = [st.menus[0]];
  return { closed: !!p.closed, price, menus: sale, prep: clamp(Math.round(Number(p.prep) || 12), 3, 30) };
}
export function submitPlan(st, p = {}, now = Date.now(), demandOverride = null) {
  if (st.over) return { ok: false, error: "OVER" };
  if (st.phase !== "plan") return { ok: false, error: "BAD_PHASE" };
  const closed = !!p.closed;
  if (closed) { st.met.closed++; const rep = settle(st, { closed: true }); return { ok: true, closed: true, report: rep, ...after(st) }; }
  const price = clamp(Math.round((Number(p.price) || 2000) / 500) * 500, 1000, 5000);
  let sale = [...new Set((Array.isArray(p.menus) ? p.menus : []).map(String))].filter((k) => st.menus.includes(k)).slice(0, MAX_SELL);
  if (!sale.length) sale = [st.menus[0]];
  const prep = clamp(Math.round(Number(p.prep) || 12), 3, 30);
  const dem = Number.isFinite(demandOverride) ? demandOverride : demandOf(st, price, sale);
  const n = clamp(Math.round(dem / 2.2 + (rnd(st) - 0.5)), 1, 20);
  const wsum = sale.reduce((s, k) => s + MENUS[k].pop * (k === "ice" && [5, 6, 7, 8, 9].includes(monthOf(st)) ? 2 : 1), 0);
  const pat = (st.flags.staff ? 1.35 : 1) * (0.9 + st.rep / 250) * (st.up.warmer ? 1.15 : 1) * STAGES[st.up.stage].pat;
  const dwx = (st.wx || ["clear"])[Math.floor(rnd(st) * (st.wx || ["clear"]).length)];
  // 손님 종류: 비 오는 날엔 비 피하는 손님 · 평판 좋으면 단골 할머니 · 피자 팔면 학생 무리 · 유튜버는 하루 1명까지
  const KW = Object.entries(KINDS).map(([id, k]) => ({ id, w: id === "rainy" ? (dwx === "rain" ? 18 : 0) : id === "granny" ? k.w * (st.rep >= 60 ? 1.6 : 1) : id === "students" ? k.w * (sale.includes("pizza") ? 1.7 : 1) : k.w }));
  const rushS = Math.round((12 + rnd(st) * 10) * 10) / 10, rushE = rushS + 6;
  let tubers = 0;
  const customers = Array.from({ length: n }, (_, i) => {
    let r = rnd(st) * wsum, f = sale[0]; for (const k of sale) { r -= MENUS[k].pop * (k === "ice" && [5, 6, 7, 8, 9].includes(monthOf(st)) ? 2 : 1); if (r < 0) { f = k; break; } }
    let kind = pickW(st, KW).id; if (kind === "youtuber" && tubers++) kind = "normal";
    if (kind === "students" && sale.includes("pizza") && rnd(st) < 0.6) f = "pizza";
    const K = KINDS[kind], rush = rnd(st) < 0.22, at = rush ? rushS + rnd(st) * 6 : 1 + rnd(st) * (BAKE_SEC - 9);
    const bags = kind === "normal" ? (rnd(st) < 0.72 ? 1 : 2) : K.bags[0] + Math.floor(rnd(st) * (K.bags[1] - K.bags[0] + 1));
    return { i, at: Math.round(Math.min(BAKE_SEC - 3, at) * 10) / 10, n: bags, f, pat: Math.round((9 + rnd(st) * 7) * pat * K.pat * 10) / 10, look: Math.floor(rnd(st) * 1000), k: kind, rush: rush ? 1 : 0 };
  }).sort((a, b) => a.at - b.at).map((c, i) => ({ ...c, i }));
  for (const c of customers) st.met.kindsMet[c.k] = 1;
  st.met.wxSeen[dwx] = 1;
  st.day = { price, sale, prep, customers, at: now, wx: dwx, rush: [rushS, rushE] };
  st.lastPrice = price; st.lastSale = sale; st.lastPrep = prep;
  st.phase = "bake";
  return { ok: true, bake: publicBake(st), st: publicState(st) };
}
export function publicBake(st) {
  const d = st.day; if (!d) return null;
  return { dur: BAKE_SEC, molds: st.molds, price: d.price, sale: d.sale.map((k) => ({ id: k, n: MENUS[k].n, ic: MENUS[k].ic, col: MENUS[k].col })), prep: d.prep, cook: COOK, wx: d.wx, wxIc: WEATHER[d.wx]?.ic, rush: d.rush, flipper: !!st.up.flipper, warmer: !!st.up.warmer, stage: st.up.stage,
    kinds: Object.fromEntries(Object.entries(KINDS).map(([id, k]) => [id, { ic: k.ic, n: k.n, d: k.d, perfect: !!k.perfect }])),
    customers: d.customers.map((c) => ({ i: c.i, at: c.at, n: c.n, f: c.f, pat: c.pat, look: c.look, k: c.k, rush: c.rush })) };
}

// ---------- 굽기 결과 → 정산 ----------
// res = { made: { 메뉴: { p: 완벽, o: 괜찮음, b: 탐 } }, served: [손님 번호…] }
export function submitBake(st, res = {}, now = Date.now()) {
  if (st.over) return { ok: false, error: "OVER" };
  if (st.phase !== "bake" || !st.day) return { ok: false, error: "BAD_PHASE" };
  const d = st.day, ms = now - d.at;
  const maxFish = st.molds * Math.floor(BAKE_SEC / (COOK.good[0] * 2 + 0.3)) + st.molds, poursCap = d.prep * 3;
  const made = {}; let tot = 0;
  for (const k of d.sale) { const m = res?.made?.[k] || {}; made[k] = { p: clamp(m.p | 0, 0, 999), o: clamp(m.o | 0, 0, 999), b: clamp(m.b | 0, 0, 999) }; tot += made[k].p + made[k].o + made[k].b; }
  // 물리적으로 불가능한 양이면 비율대로 줄임 (틀 수·시간·반죽 한도)
  // 실제로 지난 시간만큼만 구울 수 있음 (화면 시계를 빠르게 돌려도 서버 시계 기준)
  const el = Math.min(BAKE_SEC, ms / 1000), timeCap = st.molds * Math.floor(el / (COOK.good[0] * 2 + 0.3)) + st.molds;
  const cap = Math.min(maxFish, poursCap, timeCap), tooFast = ms < 8000;
  if (tot > cap || tooFast) { const k0 = tooFast ? 0 : cap / tot; for (const k of d.sale) for (const q of ["p", "o", "b"]) made[k][q] = Math.floor(made[k][q] * k0); tot = d.sale.reduce((s, k) => s + made[k].p + made[k].o + made[k].b, 0); }
  // 판 손님: 그 메뉴의 잘 구운 붕어빵이 있어야 함
  const P = Object.fromEntries(d.sale.map((k) => [k, made[k].p])), O = Object.fromEntries(d.sale.map((k) => [k, made[k].o])), servedSet = new Set();
  for (const i of [...new Set((Array.isArray(res?.served) ? res.served : []).map((x) => x | 0))]) {
    const c = d.customers[i]; if (!c || c.at > el + 1) continue;   // 아직 오지 않은 손님은 못 받음
    const need = c.n * 3;
    if (KINDS[c.k]?.perfect) { if (P[c.f] >= need) { P[c.f] -= need; servedSet.add(i); } }
    else if (P[c.f] + O[c.f] >= need) { const fo = Math.min(O[c.f], need); O[c.f] -= fo; P[c.f] -= need - fo; servedSet.add(i); }
  }
  const served = d.customers.filter((c) => servedSet.has(c.i)), soldBags = served.reduce((s, c) => s + c.n, 0), lost = d.customers.length - served.length;
  const pf = d.sale.reduce((s, k) => s + made[k].p, 0), bf = d.sale.reduce((s, k) => s + made[k].b, 0), of = d.sale.reduce((s, k) => s + made[k].o, 0);
  const q = tot ? (pf + of * 0.5) / tot : 0, burntR = tot ? bf / tot : 0, lostR = d.customers.length ? lost / d.customers.length : 0;
  const avgCost = d.sale.reduce((s, k) => s + menuCost(st, k), 0) / d.sale.length;
  const base = soldBags * d.price * MONTH_F * (st.flags.delivery ? 1 - DELIVERY_FEE : 1);
  // 손님 종류 효과 · 콤보 팁 (콤보는 완벽 붕어빵 수를 넘을 수 없음)
  const sk = {}, lk = {}; for (const c of d.customers) (servedSet.has(c.i) ? sk : lk)[c.k] = ((servedSet.has(c.i) ? sk : lk)[c.k] || 0) + 1;
  const combo = clamp(res?.combo | 0, 0, pf), tipRate = Math.min(0.25, Math.min(0.15, combo * 0.008) + 0.02 * (sk.granny || 0));
  const tips = r0(base * tipRate), revenue = base + tips;
  const unsold = Math.max(0, d.prep - soldBags), cogs = d.prep * avgCost * MONTH_F - (st.up.warmer ? unsold * avgCost * MONTH_F * 0.5 : 0);
  const kindRep = (sk.granny || 0) * 1 + (sk.youtuber || 0) * 6 - (lk.youtuber || 0) * 4 - (lk.jerk || 0) * 2;
  if (sk.youtuber) { st.boomNext = 1.12; st.flags.star = st.flags.star || ((st.met.kinds.youtuber || 0) + sk.youtuber >= 2 ? 1 : 0); }
  for (const [k, v] of Object.entries(sk)) st.met.kinds[k] = (st.met.kinds[k] || 0) + v;
  const rushServed = d.customers.filter((c) => c.rush && servedSet.has(c.i)).length;
  st.met.pf += pf; st.met.maxCombo = Math.max(st.met.maxCombo, combo); st.met.rushBest = Math.max(st.met.rushBest, rushServed); st.met.tips += tips;
  if (lost === 0 && d.customers.length >= 8) st.met.fullServe++;
  const wasteR = d.prep ? clamp((d.prep - soldBags) / d.prep, 0, 1) : 0;
  const repD = (q - 0.55) * 12 - burntR * 14 - lostR * 10 + (soldBags > 0 ? 2 : -2) + kindRep;
  st.rep = clamp(st.rep + repD, 5, 100); st.lastQ = q;
  st.met.q.push(q); st.met.waste.push(wasteR); st.met.lost.push(lostR); st.met.price.push(d.price); st.met.served += served.length; st.met.cust += d.customers.length;
  // 손해 원인 기록 (폐업 사유 고르기용, 원 단위)
  const L = st.met.loss, F = MONTH_F;
  L.waste += Math.max(0, d.prep - soldBags - bf / 3) * avgCost * F; L.burnt += (bf / 3) * (avgCost + d.price * 0.5) * F; L.slow += lost * 1.3 * d.price * F * 0.08;
  if (d.price <= 1500) L.cheap += soldBags * (2000 - d.price) * F * 0.6; if (d.price >= 3500) L.pricey += d.customers.length * 0.4 * d.price * F * 0.3;
  if (st.rival && d.price > st.rival) L.rival += (d.price - st.rival) * 2 * F * 0.5;
  for (const c of served) st.met.sold[c.f] = (st.met.sold[c.f] || 0) + c.n;
  const dwx = d.wx;
  const rep = settle(st, { revenue, cogs, soldBags, served: served.length, cust: d.customers.length, lost, made: { p: pf, o: of, b: bf }, q, wasteR, price: d.price, sale: d.sale, prep: d.prep, repD, tips, combo, wx: dwx, rushServed, sk, lk });
  if (dwx === "rain" && rep.profit > 0) st.met.rainWin++;
  return { ok: true, report: rep, ...after(st) };
}
function settle(st, x) {
  const fixed = fixedCost(st, !!x.closed), revenue = r0(x.revenue || 0), cogs = r0(x.cogs || 0), profit = revenue - cogs - fixed;
  st.cash += profit; st.met.profit.push(profit);
  if (profit < 0 && [4, 5, 6, 7, 8, 9].includes(monthOf(st))) st.met.loss.summer += -profit * 0.55;
  if (st.flourLeft > 0 && !x.closed) st.flourLeft--;
  const mon = monthOf(st);
  st.hist.push({ m: mon, cash: r0(st.cash), profit, rep: r0(st.rep), closed: !!x.closed });
  const best = Math.max(...st.met.profit), worst = Math.min(...st.met.profit);
  if (profit === best && profit > 300000 && st.met.profit.length > 1) { st.keys = st.keys.filter((k) => k.ic !== "📈"); keyEvent(st, "📈", `역대 최고 매출의 달 (+${Math.round(profit / 10000)}만 원)`); }
  if (profit === worst && profit < -300000 && st.met.profit.length > 1) { st.keys = st.keys.filter((k) => k.ic !== "📉"); keyEvent(st, "📉", `최악의 달 (${Math.round(profit / 10000)}만 원)`); }
  if (x.closed) keyEvent(st, "💤", `${mon}월 휴업`);
  const report = { month: mon, closed: !!x.closed, revenue, cogs, fixed, profit, cash: r0(st.cash), ...(x.closed ? {} : { soldBags: x.soldBags, served: x.served, cust: x.cust, lost: x.lost, made: x.made, q: Math.round(x.q * 100), waste: Math.round(x.wasteR * 100), price: x.price, prep: x.prep, repD: Math.round(x.repD), tips: x.tips || 0, combo: x.combo || 0, wx: x.wx, wxIc: WEATHER[x.wx]?.ic, rushServed: x.rushServed || 0,
    kinds: Object.keys(KINDS).filter((k) => (x.sk?.[k] || 0) + (x.lk?.[k] || 0) > 0 && k !== "normal").map((k) => ({ k, ic: KINDS[k].ic, n: KINDS[k].n, s: x.sk?.[k] || 0, l: x.lk?.[k] || 0 })) }), rep: r0(st.rep) };
  st.met.lowCash = Math.min(st.met.lowCash, st.cash);
  st.day = null; st.mult = 1; if (st.boomNext) { st.mult *= st.boomNext; st.boomNext = 0; }
  if (st.cash < 0) { st.over = { bankrupt: true, month: mon, mi: st.mi, cause: causeOf(st) }; keyEvent(st, "🔒", "폐업"); }
  else { st.mi++; if (st.mi >= st.months) { st.over = { survived: true, month: mon, mi: st.mi - 1 }; keyEvent(st, "🎉", `${st.months}개월 완주`); } else { st.wx = rollWeather(st, monthOf(st)); st.phase = "event"; nextScene(st); } }
  return report;
}
function after(st) { return { scene: publicScene(st), phase: st.over ? "over" : st.phase, st: publicState(st), over: overInfo(st) }; }
function keyEvent(st, ic, t) { if (st.keys.length < 24 || ic === "🎉" || ic === "🔒") st.keys.push({ mi: st.mi, m: monthOf(st) || MONTHS[MONTHS.length - 1], ic, t }); }
function logLine(st, m) { if (m) { st.log.push({ m: monthOf(st), t: m }); if (st.log.length > 40) st.log.shift(); } }
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function causeOf(st) {
  // 가장 많이 잃은 원인 (반죽 낭비·탄 붕어빵·놓친 손님·여름 적자·너무 싼 값·너무 비싼 값·경쟁 가게) · 인심은 따로
  if (st.met.b.filter((x) => x > 0).length >= 4 && st.rep >= 70) return CAUSES.generous;
  const L = st.met.loss, top = Object.entries(L).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 150000) return CAUSES.rent;
  return { waste: CAUSES.waste, burnt: CAUSES.burnt, slow: CAUSES.slow, summer: CAUSES.summer, cheap: CAUSES.cheap, pricey: CAUSES.pricey, rival: CAUSES.rival }[top[0]];
}
export function overInfo(st) { return st.over ? { ...st.over, months: monthsDone(st) } : null; }
export function monthsDone(st) { return st.over?.survived ? st.months : st.mi + 1; }

// ---------- 결과 ----------
export function abilities(st) {
  const M = st.met;
  const hands = M.q.length ? avg(M.q) * 100 : 50;
  const ap = avg(M.profit) ?? 0;
  const price = 50 + 50 * Math.tanh(ap / 350000);
  const stock = M.waste.length ? (1 - avg(M.waste)) * 100 : 50;
  const service = M.cust ? (M.served / M.cust) * 100 : 50;
  const crisis = M.g.length ? ((M.g.reduce((s, x) => s + x, 0) + M.g.length) / (2 * M.g.length)) * 100 : 50;
  const o = { hands, price, stock, service, crisis }; for (const k of Object.keys(o)) o[k] = Math.round(clamp(o[k], 0, 100));
  return o;
}
export function typeOf(st, ab) {
  const done = monthsDone(st), surv = !!st.over?.survived, ap = avg(st.met.price) ?? 2000, help = st.met.b.filter((x) => x > 0).length;
  if (!surv && done <= 6) return "rookie";
  if (surv && st.cash >= START_CASH * 1.6) return "tycoon";
  if (st.met.bets >= 2) return "gambler";
  if (ap >= 3000) return "greedy";
  if (ap <= 1700) return "hustler";
  if (help >= 3 && (avg(st.met.profit) ?? 0) < 150000) return "angel";
  if (ab.hands >= 78) return "artisan";
  if (ab.service >= 78) return "regular";
  return surv ? "tycoon" : "rookie";
}
function reviewsOf(st, ab) {
  const out = [], M = st.met, ap = avg(M.price) ?? 2000, burnt = 1 - ab.hands / 100;
  out.push(ab.hands >= 80 ? { s: 5, t: "겉바속촉 그 자체. 꼬리까지 바삭해요." } : burnt > 0.45 ? { s: 1, t: "반은 타 있었어요. 숯을 파는 줄." } : { s: 3, t: "맛은 그럭저럭. 가끔 덜 익은 게 있어요." });
  out.push(ap >= 3000 ? { s: 2, t: "맛있긴 한데 이 가격이면 케이크를 사 먹겠어요." } : ap <= 1600 ? { s: 5, t: "이 가격에 이 양이라니. 사장님 남는 거 있으세요?" } : { s: 4, t: "가격 적당하고 양도 괜찮아요." });
  out.push(ab.service >= 80 ? { s: 5, t: "사장님이 늘 웃으면서 반겨 주세요. 줄도 금방 줄어요." } : ab.service < 50 ? { s: 2, t: "줄이 너무 길어서 기다리다 그냥 갔어요." } : { s: 4, t: "바쁠 땐 좀 기다려야 하지만 친절해요." });
  if (st.menus.includes("mint") && out.length < 4) out.push({ s: 5, t: "민트초코 붕어빵 있는 유일한 곳. 성지입니다." });
  return out.slice(0, 3);
}
function analysisOf(st, ab) {
  const M = st.met, out = [], ap = Math.round(avg(M.price) ?? 2000), totP = st.cash - START_CASH;
  out.push(`평균 가격은 ${ap.toLocaleString()}원이었어요.`); if (ap >= 3000) out.push("손님에겐 조금 비싼 가격이었어요."); else if (ap <= 1600) out.push("많이 팔았지만 남는 게 적었어요.");
  out.push(`손님 ${M.cust}명 중 ${M.served}명에게 팔았어요. 놓친 손님은 ${M.cust - M.served}명이에요.`);
  if (M.waste.length) { out.push(`준비한 반죽 중 평균 ${Math.round(avg(M.waste) * 100)}%를 버렸어요.`); if (avg(M.waste) > 0.4) out.push("반죽을 줄이면 재료비가 확 줄어요."); }
  if (M.q.length) out.push(`구운 붕어빵 중 노릇하게 잘 구운 비율은 ${Math.round(avg(M.q) * 100)}%예요.`);
  if (M.closed) out.push(`${M.closed}달은 휴업했어요.`);
  const bestI = M.profit.indexOf(Math.max(...M.profit)), worstI = M.profit.indexOf(Math.min(...M.profit));
  if (M.profit.length >= 2) out.push(`가장 잘 번 달은 ${st.hist[bestI].m}월(${Math.round(M.profit[bestI] / 10000)}만 원), 가장 힘든 달은 ${st.hist[worstI].m}월(${Math.round(M.profit[worstI] / 10000)}만 원)이었어요.`);
  out.push(totP >= 0 ? `창업 자금보다 ${Math.round(totP / 10000)}만 원을 더 남겼어요.` : `창업 자금에서 ${Math.round(-totP / 10000)}만 원을 잃었어요.`);
  return out;
}
export function endingOf(st) {
  if (!st.over?.survived) return [5, 6, 7, 8, 9].includes(st.over?.month) ? "closed_summer" : "closed";
  if ((st.cash >= 6000000 && st.up.stage >= 1) || (st.up.stage >= 2 && st.cash >= 4000000)) return "franchise";
  if (st.rep >= 85) return "legend";
  if (st.flags.star) return "star";
  if (st.flags.loan || st.cash < 1000000) return "debt";
  return "steady";
}
export function achsOf(st) {
  const M = st.met, surv = !!st.over?.survived && st.months >= 12, sold = M.sold, tot = Object.values(sold).reduce((a, b) => a + b, 0), prices = M.price;
  const freeze = prices.length >= 6 && prices.every((p) => p === prices[0]);
  const has = {
    first: M.q.length >= 1, year: surv, noclose: surv && M.closed === 0, freeze, mint: (sold.mint || 0) >= 20, pizza: (sold.pizza || 0) >= 30, allmenu: st.menus.length >= 7,
    perfect100: M.pf >= 100, perfect300: M.pf >= 300, combo15: M.maxCombo >= 15, granny: (M.kinds.granny || 0) >= 5, youtuber: (M.kinds.youtuber || 0) >= 2, jerk: (M.kinds.jerk || 0) >= 5, students: (M.kinds.students || 0) >= 6,
    rush: M.rushBest >= 8, rain: M.rainWin >= 2, bigmonth: M.profit.some((p) => p >= 1000000), summer: st.hist.some((h) => [6, 7, 8].includes(h.m) && h.profit > 0 && !h.closed),
    rich5: st.hist.some((h) => h.cash >= 5000000), rich10: st.hist.some((h) => h.cash >= 10000000), truck: st.up.stage >= 1, shop: st.up.stage >= 2, molds8: st.molds >= 8, fullserve: M.fullServe >= 1,
    nowaste: surv && M.waste.length > 0 && avg(M.waste) < 0.15, noloan: surv && !st.flags.loan, comeback: surv && M.lowCash < 300000, sold150: tot >= 150,
  };
  return ACHS.filter((a) => has[a.id]).map((a) => ({ id: a.id, ic: a.ic, n: a.n }));
}
export function catalog() {
  return {
    menus: Object.entries(MENUS).map(([id, m]) => ({ id, n: m.n, ic: m.ic, col: m.col })),
    events: EVENTS.map((e) => ({ id: e.id, ic: EVENT_NAMES[e.id]?.[0] || "📰", n: EVENT_NAMES[e.id]?.[1] || e.id })),
    kinds: Object.entries(KINDS).map(([id, k]) => ({ id, ic: k.ic, n: k.n, d: k.d })),
    weather: Object.entries(WEATHER).map(([id, w]) => ({ id, ic: w.ic, n: w.n })),
    endings: Object.entries(ENDINGS).map(([id, e]) => ({ id, ic: e.ic, n: e.n, d: e.d })),
    achs: ACHS.map((a) => ({ ...a })), stages: STAGES.map((x) => ({ id: x.id, ic: x.ic, n: x.n })),
  };
}
export function scoreOf(st) { return monthsDone(st) * 10000000 + Math.max(0, Math.min(9999999, Math.round(st.cash))); }
export function diagnose(st) {
  const ab = abilities(st), typeId = typeOf(st, ab), T = TYPES[typeId], months = monthsDone(st), surv = !!st.over?.survived;
  return {
    v: CORE_VERSION, months, survived: surv, cash: r0(st.cash), profit: r0(st.cash - START_CASH), cause: surv ? null : st.over?.cause || DEFAULT_CAUSE,
    headline: surv ? `${months}개월 완주 — 순이익 ${Math.round((st.cash - START_CASH) / 10000)}만 원` : `${months}개월 만에 폐업`,
    typeId, type: { n: T.n, ic: T.ic, d: T.d, long: T.long, strong: T.strong, weak: T.weak, shop: T.shop, life: T.life, tip: T.tip, good: TYPES[T.good].n, bad: TYPES[T.bad].n },
    abil: ab, abilNames: ABIL, reviews: reviewsOf(st, ab), analysis: analysisOf(st, ab), score: scoreOf(st),
    graph: st.hist.map((h) => [h.m, h.cash, h.profit, h.rep, h.closed ? 1 : 0]),
    timeline: [{ m: 11, ic: "🐟", t: "붕어빵 리어카 개업" }, ...st.keys.map((k) => ({ m: k.m, ic: k.ic, t: k.t }))],
    menus: st.menus.map((k) => MENUS[k].ic), molds: st.molds, diary: st.log.slice(-6), closedMonths: st.met.closed, cust: st.met.cust, served: st.met.served, avgPrice: Math.round(avg(st.met.price) ?? 0), quality: st.met.q.length ? Math.round(avg(st.met.q) * 100) : null,
    sold: Object.entries(st.met.sold).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n: MENUS[k].n, ic: MENUS[k].ic, bags: n })),
    ending: (() => { const id = endingOf(st), e = ENDINGS[id]; return { id, ic: e.ic, n: e.n, d: e.d }; })(),
    titles: achsOf(st), stage: st.up.stage, stageN: STAGES[st.up.stage].n, up: { ...st.up }, perfect: st.met.pf, maxCombo: st.met.maxCombo, tips: r0(st.met.tips),
    kindsServed: Object.entries(st.met.kinds).filter(([k]) => k !== "normal").map(([k, n]) => ({ k, ic: KINDS[k].ic, n: KINDS[k].n, count: n })),
    codex: { menus: [...st.menus], events: Object.keys(st.used), kinds: Object.keys(st.met.kindsMet), wx: Object.keys(st.met.wxSeen), ending: endingOf(st), achs: achsOf(st).map((a) => a.id) },
  };
}
export { MENUS, TYPES, ABIL, COOK, MONTHS, SEASON, KINDS, ENDINGS, ACHS, STAGES };
