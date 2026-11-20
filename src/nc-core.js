// =========================
// 플듀 눈치 진단소 — 엔진 (서버 전용, 순수 함수)
// 혼자 한 판: 거짓말 3 → 카톡 4 → 믿을까 2판(각 5턴) → 협상 2 → 블러핑 3판 → 다수 예측 5
// 정답·AI의 속마음(마지노선·성격·카드)은 서버만 앎. 화면엔 공개 정보만 보냄
// 친구 대결·방송도 같은 생성기·채점을 씀 (nc.js)
// =========================
import { NAMES, ROOMS, GAMES, GAME_INFO, LIE_CASES, TRUST_AI, TRUST_TALK, KAKAO, DEAL_ITEMS, DEAL_TALK, MAJOR, ABIL, LEVELS } from "./nc-data.js";
import { TYPES } from "./nc-types.js";

export const CORE_VERSION = 1;
export const PLAN = [["lie", 3], ["kakao", 4], ["trust", 2], ["deal", 2], ["bluff", 3], ["major", 5]];
export const TRUST_TURNS = 5, DEAL_TURNS = 6, BLUFF_START = 10;
export function rnd(st) { let t = (st.rs = (st.rs + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const dayKey = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const numIn = (v) => (typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN);   // null·""·true 같은 건 숫자로 안 침
const clamp = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);   // NaN·무한대 → 최솟값 (조작된 입력 방어)
const pick = (st, a) => a[Math.floor(rnd(st) * a.length)];
const shuffle = (st, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const look = (st) => Math.floor(rnd(st) * 1000);

// =========================================================
// 1) 누가 거짓말? — 범인(부엌에 혼자 있던 사람)만 거짓말. 말끼리 맞춰 보면 범인이 딱 한 명으로 정해지는 문제만 냄
// =========================================================
const K = 0;   // ROOMS[0] = 부엌
function stmtTrue(s, who, rooms) {
  const me = rooms[who];
  switch (s.k) {
    case "self": return me === s.r;
    case "notk": return me !== K;
    case "at": return rooms[s.a] === s.r;
    case "not": return rooms[s.a] !== s.r;
    case "with": return rooms[s.a] === me;
    default: return false;
  }
}
export function lieSolve(stmts) {   // 범인이 될 수 있는 사람 목록
  const ok = [];
  for (let L = 0; L < 4; L++) {
    const others = [0, 1, 2, 3].filter((i) => i !== L); let found = false;
    for (let m = 0; m < 27 && !found; m++) {
      const rooms = []; rooms[L] = K; let x = m; for (const o of others) { rooms[o] = 1 + (x % 3); x = Math.floor(x / 3); }
      found = stmts.every((s, i) => (i === L ? !stmtTrue(s, i, rooms) : stmtTrue(s, i, rooms)));
    }
    if (found) ok.push(L);
  }
  return ok;
}
export function genLie(st, round) {
  for (let tries = 0; tries < 400; tries++) {
    const names = shuffle(st, NAMES).slice(0, 4), c = Math.floor(rnd(st) * 4), rooms = [0, 1, 2, 3].map((i) => (i === c ? K : 1 + Math.floor(rnd(st) * 3)));
    const stmts = [0, 1, 2, 3].map((i) => {
      for (let k = 0; k < 40; k++) {
        const kinds = round === 0 ? ["self", "at", "notk", "not"] : ["self", "at", "not", "with", "notk", "at", "not"];
        const kd = pick(st, kinds), a = pick(st, [0, 1, 2, 3].filter((j) => j !== i)), r = Math.floor(rnd(st) * 4);
        const s = kd === "self" ? { k: kd, r } : kd === "notk" ? { k: kd } : kd === "with" ? { k: kd, a } : { k: kd, a, r };
        if (stmtTrue(s, i, rooms) === (i !== c)) return s;
      }
      return null;
    });
    if (stmts.some((s) => !s)) continue;
    const sol = lieSolve(stmts); if (sol.length !== 1 || sol[0] !== c) continue;
    if (round >= 1 && stmts[c].k === "notk" && rnd(st) < 0.8) continue;   // 뒤 판은 '부엌 안 갔다' 직접 거짓말을 줄여 어렵게
    return { names, c, rooms, stmts, caseId: pick(st, LIE_CASES).id };
  }
  throw new Error("LIE_GEN");
}
export function stmtText(s, names) {
  const R = (r) => ROOMS[r];
  switch (s.k) {
    case "self": return `나는 ${R(s.r)}에 있었어요.`;
    case "notk": return "나는 부엌에 안 갔어요.";
    case "at": return `${names[s.a]}는 ${R(s.r)}에 있었어요.`;
    case "not": return `${names[s.a]}는 ${R(s.r)}에 없었어요.`;
    case "with": return `나는 ${names[s.a]}랑 같은 방에 있었어요.`;
  }
  return "";
}
function lieView(it) { const cs = LIE_CASES.find((x) => x.id === it.caseId); return { case: cs.t, people: it.names.map((n, i) => ({ name: n, say: stmtText(it.stmts[i], it.names), look: hashSeed(n) % 1000 })) }; }

// =========================================================
// 2) 믿을까 배신할까 — AI 성격별 다음 수 (이전 기록만 보고 정함)
// =========================================================
export const PAY = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
export function aiMove(kind, t, my, their, r) {   // r: 0~1 난수
  const myD = my.filter((x) => x === "D").length;
  if (kind === "loyal") return myD >= 2 ? "D" : "C";
  if (kind === "tft") return t === 0 ? "C" : my[t - 1];
  if (kind === "sly") return t === TRUST_TURNS - 1 || myD > 0 && my[t - 1] === "D" ? "D" : "C";
  if (kind === "fickle") return r < 0.6 ? "C" : "D";
  return r < 0.2 ? "C" : "D";   // snake
}
function talkFor(st, kind, move, t) {
  const lie = (kind === "sly" && t === TRUST_TURNS - 1) || (kind === "snake" && move === "D" && rnd(st) < 0.5);
  return pick(st, lie ? TRUST_TALK.lieCoop : move === "C" ? TRUST_TALK.coop : TRUST_TALK.defect);
}
// 그 판에서 낼 수 있었던 최고 점수 (AI의 운은 실제와 같게 고정해 32가지 다 시험)
export function trustBest(kind, rs) {
  let best = 0;
  for (let m = 0; m < 1 << TRUST_TURNS; m++) {
    const my = [], th = []; let pts = 0;
    for (let t = 0; t < TRUST_TURNS; t++) { const a = aiMove(kind, t, my, th, rs[t]); const p = m >> t & 1 ? "D" : "C"; pts += PAY[p + a][0]; my.push(p); th.push(a); }
    best = Math.max(best, pts);
  }
  return best;
}

// =========================================================
// 3) 협상 — AI 마지노선(숨김)·성격(양보 속도·참을성)
// =========================================================
const DEAL_PERS = { soft: { con: 0.42, acc: [0.75, 0.55, 0.38, 0.22, 0.1, 0], ins: 0.7, mood: 3 }, normal: { con: 0.32, acc: [0.85, 0.65, 0.45, 0.28, 0.12, 0], ins: 0.75, mood: 2 }, tough: { con: 0.22, acc: [0.92, 0.78, 0.6, 0.4, 0.2, 0.05], ins: 0.8, mood: 2 } };
export function genDeal(st, k) {
  const it = DEAL_ITEMS[(k + Math.floor(rnd(st) * 2) * 2) % DEAL_ITEMS.length], per = pick(st, ["soft", "normal", "tough"]), ask = it.ask;
  if (it.role === "buy") { const M = Math.round((ask * (0.6 + rnd(st) * 0.22)) / 1000) * 1000; return { id: it.id, role: "buy", n: it.n, ic: it.ic, who: it.who, ask, M, per, counter: ask, mood: DEAL_PERS[per].mood, t: 0, log: [], done: null, look: look(st) }; }
  const V = Math.round((ask * (0.8 + rnd(st) * 0.32)) / 1000) * 1000, start = Math.round((V * 0.58) / 1000) * 1000;   // 파는 쪽: 상대가 낼 수 있는 최고가 V(숨김), 처음 제시가 start
  return { id: it.id, role: "sell", n: it.n, ic: it.ic, who: it.who, ask, M: V, per, counter: start, start, mood: DEAL_PERS[per].mood, t: 0, log: [], done: null, look: look(st) };
}
// x: 내가 부른 가격 → { kind: accept|counter|insult|leave, price?, talk }
export function dealStep(st, d, x) {
  const P = DEAL_PERS[d.per], buy = d.role === "buy";
  x = clamp(Math.round(Number(x) / 1000) * 1000, 1000, d.ask * 3);
  const lo = buy ? d.M : d.start, hi = buy ? d.ask : d.M;   // 사는 쪽: 마지노선 M~요구가 ask / 파는 쪽: 처음 제시가~최고가 V
  const accLine = buy ? lo + (hi - lo) * P.acc[Math.min(d.t, P.acc.length - 1)] : hi - (hi - lo) * P.acc[Math.min(d.t, P.acc.length - 1)];
  d.t++; let res;
  const better = buy ? x >= d.counter : x <= d.counter;   // 상대 제시보다 나한테 불리하게 부르면 바로 성사 (상대 제시가로)
  if (better) res = { kind: "accept", price: d.counter };
  else if (buy ? x >= accLine : x <= accLine) res = { kind: "accept", price: x };
  else if (buy ? x < lo * P.ins : x > hi / P.ins) { d.mood--; res = d.mood <= 0 ? { kind: "leave" } : { kind: "insult" }; }
  else {
    const c2 = buy ? Math.max(lo, d.counter - (d.counter - x) * P.con) : Math.min(hi, d.counter + (x - d.counter) * P.con);
    d.counter = Math.round(c2 / 1000) * 1000;
    res = { kind: "counter", price: d.counter, near: Math.abs(d.counter - x) / d.ask < 0.12 };
  }
  if (res.kind === "counter" && d.t >= DEAL_TURNS) res = { kind: "leave" };
  res.talk = pick(st, DEAL_TALK[res.kind === "counter" ? (res.near ? "near" : "far") : res.kind]);
  d.log.push({ me: x, ...res });
  if (res.kind === "accept" || res.kind === "leave") d.done = res;
  return res;
}
export function dealScore(d) {
  if (!d.done || d.done.kind !== "accept") return 0;
  const p = d.done.price;
  if (d.role === "buy") return Math.round(clamp((d.ask - p) / Math.max(1, d.ask - d.M), 0, 1) * 100);
  return Math.round(clamp((p - d.start) / Math.max(1, d.M - d.start), 0, 1) * 100);
}
function dealView(d) { return { id: d.id, role: d.role, n: d.n, ic: d.ic, who: d.who, ask: d.ask, counter: d.counter, mood: d.mood, moodMax: DEAL_PERS[d.per].mood, t: d.t, turns: DEAL_TURNS, log: d.log.map((x) => ({ me: x.me, kind: x.kind, price: x.price ?? null, talk: x.talk })), look: d.look }; }

// =========================================================
// 4) 블러핑 — 카드 1~10, 판돈 1, 걸기(1~3) → 서로의 걸기 보고 따라가기/접기 → 남은 사람 중 높은 카드가 판돈을 가짐
// =========================================================
export function botBet(st, card) { if (card <= 4 && rnd(st) < 0.3) return { bet: 3, bluff: true }; return { bet: card >= 8 ? 3 : card >= 5 ? 2 : 1, bluff: false }; }
export function botCall(st, card, myBet, maxOther) { const p = card / 10 + (3 - maxOther) * 0.12 + (myBet === 3 ? 0.12 : 0) - 0.05; return card >= 7 || rnd(st) < p; }
// tell: 허세 중인 봇은 55% 확률로 땀(긴장)이 보이고, 진짜 센 패는 30% 확률로 여유 표정
export function botTell(st, b) { return b.bluff ? (rnd(st) < 0.55 ? "sweat" : null) : b.bet === 3 && rnd(st) < 0.3 ? "smug" : rnd(st) < 0.12 ? "sweat" : null; }
export function settleHand(players) {   // players: [{ card, bet, fold, chips }]
  const pot = players.reduce((s, p) => s + 1 + p.bet, 0), stay = players.filter((p) => !p.fold);
  const pool = stay.length ? stay : players, win = pool.reduce((a, b) => (b.card > a.card ? b : a));
  for (const p of players) p.chips -= 1 + p.bet;
  win.chips += pot;
  return { pot, winner: players.indexOf(win) };
}

// =========================================================
// 혼자 한 판
// =========================================================
export function newRun(seed, { mode = "normal" } = {}) {
  const st = { v: CORE_VERSION, seed: seed >>> 0, rs: seed >>> 0, mode, pi: 0, k: 0, item: null, over: false, scores: Object.fromEntries(GAMES.map((g) => [g, []])), logs: Object.fromEntries(GAMES.map((g) => [g, []])),
    met: { coop: 0, turns: 0, betrayed: 0, bluffTry: 0, bluffWin: 0, caught: 0, foldBest: 0, chips: BLUFF_START, kakaoBest: 0, rt: [] }, sentAt: 0 };
  st.kakaoSet = shuffle(st, KAKAO.map((x) => x.id)).slice(0, 4);
  st.majorSet = shuffle(st, MAJOR.map((x) => x.id)).slice(0, 5);
  st.trustSet = shuffle(st, Object.keys(TRUST_AI)).slice(0, 2);
  makeItem(st);
  return st;
}
const gameOf = (st) => PLAN[st.pi]?.[0];
function makeItem(st, now = 0) {
  const [g] = PLAN[st.pi] || []; if (!g) { st.item = null; st.over = true; return; }
  const k = st.k;
  if (g === "lie") st.item = { g, lie: genLie(st, k) };
  else if (g === "kakao") { const q = KAKAO.find((x) => x.id === st.kakaoSet[k]); st.item = { g, id: q.id, order: shuffle(st, q.o.map((_, i) => i)) }; }
  else if (g === "trust") { const kind = st.trustSet[k]; const rs = Array.from({ length: TRUST_TURNS }, () => rnd(st)); st.item = { g, kind, rs, my: [], th: [], pts: [0, 0], name: pick(st, NAMES), look: look(st) }; st.item.next = aiMove(kind, 0, [], [], rs[0]); st.item.talk = talkFor(st, kind, st.item.next, 0); }
  else if (g === "deal") st.item = { g, d: genDeal(st, k) };
  else if (g === "bluff") {
    const cards = shuffle(st, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4), bots = st.bots || (st.bots = [0, 1, 2].map(() => ({ name: "", chips: BLUFF_START, look: look(st) })));
    if (!bots[0].name) { const ns = shuffle(st, NAMES); bots.forEach((b, i) => (b.name = ns[i])); }
    st.item = { g, cards, phase: "bet", bots: bots.map((b, i) => { const x = botBet(st, cards[i + 1]); return { ...x, bet: Math.min(x.bet, Math.max(0, b.chips - 1)) }; }), my: null };
    st.item.tells = st.item.bots.map((b) => botTell(st, b));
  }
  else if (g === "major") { const q = MAJOR.find((x) => x.id === st.majorSet[k]); st.item = { g, id: q.id }; }
  st.sentAt = now;
}
export function publicStep(st) {
  if (st.over || !st.item) return null;
  const it = st.item, g = it.g, base = { g, gi: st.pi, k: st.k, n: PLAN[st.pi][1], games: PLAN.map(([x, n]) => ({ g: x, n, ic: GAME_INFO[x].ic, name: GAME_INFO[x].n })), info: GAME_INFO[g] };
  if (g === "lie") return { ...base, lie: lieView(it.lie) };
  if (g === "kakao") { const q = KAKAO.find((x) => x.id === it.id); return { ...base, kakao: { who: q.who, ctx: q.ctx, msg: q.msg, opts: it.order.map((i) => q.o[i][0]) } }; }
  if (g === "trust") return { ...base, trust: { name: it.name, look: it.look, turn: it.my.length, turns: TRUST_TURNS, talk: it.talk, hist: it.my.map((m, i) => ({ me: m, them: it.th[i], pts: PAY[m + it.th[i]] })), pts: it.pts } };
  if (g === "deal") return { ...base, deal: dealView(it.d) };
  if (g === "bluff") {
    const bots = st.bots;
    return { ...base, bluff: { phase: it.phase, card: it.cards[0], chips: st.met.chips, hand: st.k + 1, bots: bots.map((b, i) => ({ name: b.name, look: b.look, chips: b.chips, bet: it.phase === "call" ? it.bots[i].bet : null, tell: it.phase === "call" ? it.tells[i] : null })), myBet: it.my?.bet ?? null } };
  }
  if (g === "major") { const q = MAJOR.find((x) => x.id === it.id); return { ...base, major: { q: q.q, opts: q.o } }; }
  return base;
}
// a: 화면이 보낸 행동 · ctx.crowd(id) → 그 질문의 지금까지 표 [n0, n1, …] (다수 예측용)
export function act(st, a = {}, ctx = {}) {
  if (st.over || !st.item) return { ok: false, error: "OVER" };
  const it = st.item, g = it.g; let fb = null, done = false;
  if (g === "lie") {
    const p = numIn(a.pick); if (!Number.isInteger(p) || p < 0 || p >= 4) return { ok: false, error: "BAD_PICK" };
    const ok = p === it.lie.c; st.scores.lie.push(ok ? 100 : 0);
    st.logs.lie.push({ ok }); fb = { ok, liar: it.lie.c, rooms: it.lie.rooms.map((r) => ROOMS[r]), names: it.lie.names }; done = true;
  } else if (g === "kakao") {
    const p = numIn(a.pick); if (!Number.isInteger(p) || p < 0 || p >= it.order.length) return { ok: false, error: "BAD_PICK" };
    const q = KAKAO.find((x) => x.id === it.id), s = q.o[it.order[p]][1], best = it.order.findIndex((i) => q.o[i][1] === 2);
    st.scores.kakao.push(s * 50); if (s === 2) st.met.kakaoBest++;
    st.logs.kakao.push({ id: q.id, s }); fb = { s, best, why: q.why }; done = true;
  } else if (g === "trust") {
    const m = a.move === "D" ? "D" : a.move === "C" ? "C" : null; if (!m) return { ok: false, error: "BAD_MOVE" };
    const t = it.my.length, them = it.next, pay = PAY[m + them];
    it.my.push(m); it.th.push(them); it.pts[0] += pay[0]; it.pts[1] += pay[1];
    st.met.turns++; if (m === "C") st.met.coop++; if (m === "C" && them === "D") st.met.betrayed++;
    fb = { me: m, them, pay, pts: it.pts.slice() };
    if (it.my.length >= TRUST_TURNS) {
      const best = trustBest(it.kind, it.rs), sc = Math.round(clamp(it.pts[0] / Math.max(1, best), 0, 1) * 100);
      st.scores.trust.push(sc); st.logs.trust.push({ kind: it.kind, pts: it.pts.slice(), best, coop: it.my.filter((x) => x === "C").length });
      fb.end = { kind: it.kind, ai: TRUST_AI[it.kind], best, score: sc }; done = true;
    } else { it.next = aiMove(it.kind, t + 1, it.my, it.th, it.rs[t + 1]); it.talk = talkFor(st, it.kind, it.next, t + 1); }
  } else if (g === "deal") {
    const d = it.d; if (d.done) return { ok: false, error: "BAD_PHASE" };
    if (!a.walk && !(Number.isFinite(numIn(a.price)) && numIn(a.price) > 0)) return { ok: false, error: "BAD_PRICE" };
    const r = a.walk ? (d.done = { kind: "leave", talk: "", self: true }) : dealStep(st, d, a.price);
    fb = { res: r, deal: dealView(d) };
    if (d.done) { const sc = dealScore(d); st.scores.deal.push(sc); st.logs.deal.push({ id: d.id, role: d.role, price: d.done.price ?? null, ask: d.ask, line: d.M, score: sc }); fb.end = { score: sc, line: d.M, start: d.start ?? null, price: d.done.price ?? null }; done = true; }
  } else if (g === "bluff") {
    if (it.phase === "bet") {
      const b = clamp(Math.round(Number(a.bet)), 1, 3); it.my = { bet: Math.min(b, Math.max(0, st.met.chips - 1)) };
      if (it.cards[0] <= 4 && it.my.bet === 3) st.met.bluffTry++;
      it.phase = "call"; fb = { phase: "call" };
    } else {
      const fold = !!a.fold, players = [{ card: it.cards[0], bet: it.my.bet, fold, chips: st.met.chips }, ...st.bots.map((b, i) => ({ card: it.cards[i + 1], bet: it.bots[i].bet, fold: false, chips: b.chips }))];
      for (let i = 1; i < 4; i++) { const maxOther = Math.max(...players.filter((_, j) => j !== i).map((p) => p.bet)); players[i].fold = !botCall(st, players[i].card, players[i].bet, maxOther); }
      const before = st.met.chips, r = settleHand(players);
      st.met.chips = players[0].chips; st.bots.forEach((b, i) => (b.chips = players[i + 1].chips));
      const top = Math.max(...it.cards), won = r.winner === 0;
      if (won && it.cards[0] !== top) st.met.bluffWin++;
      if (won && !fold && players.some((p, i) => i && !p.fold && p.bet === 3 && p.card < it.cards[0])) st.met.caught++;
      if (fold && it.cards[0] === top) st.met.foldBest++;
      st.logs.bluff.push({ card: it.cards[0], bet: it.my.bet, fold, won, delta: st.met.chips - before });
      fb = { show: players.map((p, i) => ({ name: i ? st.bots[i - 1].name : null, card: p.card, bet: p.bet, fold: p.fold, chips: p.chips, bluff: i ? it.bots[i - 1].bluff : it.cards[0] <= 4 && it.my.bet === 3 })), winner: r.winner, pot: r.pot, delta: st.met.chips - before, chips: st.met.chips };
      if (st.k + 1 >= PLAN[st.pi][1]) st.scores.bluff.push(Math.round(clamp(50 + (st.met.chips - BLUFF_START) * 6, 0, 100)));
      done = true;
    }
  } else if (g === "major") {
    const q = MAJOR.find((x) => x.id === it.id), mine = numIn(a.mine), guess = numIn(a.guess);
    if (![mine, guess].every((v) => Number.isInteger(v) && v >= 0 && v < q.o.length)) return { ok: false, error: "BAD_PICK" };
    const real = ctx.crowd ? ctx.crowd(q.id) : null, cnt = q.p.map((p, i) => p + (real?.[i] || 0)), max = Math.max(...cnt), top = cnt.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
    const ok = top.includes(guess); st.scores.major.push(ok ? 100 : 0);
    const tot = cnt.reduce((s, x) => s + x, 0);
    st.logs.major.push({ id: q.id, mine, guess, ok, top }); fb = { ok, top, pct: cnt.map((c) => Math.round((c / tot) * 100)), votes: real ? real.reduce((s, x) => s + x, 0) : 0 }; done = true;
    ctx.vote?.(q.id, mine);
  }
  if (done) { st.k++; if (st.k >= PLAN[st.pi][1]) { st.pi++; st.k = 0; } makeItem(st); }
  return { ok: true, fb, done, next: publicStep(st), over: st.over };
}

// =========================================================
// 결과
// =========================================================
export function gameScores(st) { const o = {}; for (const g of GAMES) o[g] = st.scores[g].length ? Math.round(avg(st.scores[g])) : null; return o; }
export function abilities(st) {
  const s = gameScores(st), v = (x) => (x == null ? 50 : x);
  return { read: Math.round((v(s.lie) + v(s.kakao)) / 2), trust: v(s.trust), deal: v(s.deal), poker: v(s.bluff), crowd: v(s.major) };
}
export function typeOf(st, ab, total) {
  const coop = st.met.turns ? st.met.coop / st.met.turns : 0.5;
  if (total >= 80 && Math.min(...Object.values(ab)) >= 60) return "master";
  if (total < 35) return "rookie";
  if (coop >= 0.8 && ab.read < 50) return "pure";
  if (coop >= 0.75) return "loyal";
  if (coop <= 0.3) return "snake";
  const top = Object.entries({ read: ab.read, poker: ab.poker, deal: ab.deal, crowd: ab.crowd }).sort((a, b) => b[1] - a[1])[0][0];
  return { read: "detector", poker: "poker", deal: "dealer", crowd: "crowd" }[top];
}
export const TITLES = [
  { id: "detective", ic: "🕵️", n: "완벽한 탐정", d: "거짓말 찾기 전부 정답", f: (st) => st.logs.lie.length >= 3 && st.logs.lie.every((x) => x.ok) },
  { id: "kakao", ic: "💬", n: "카톡 해석가", d: "카톡 속뜻 전부 정답", f: (st) => st.logs.kakao.length >= 4 && st.logs.kakao.every((x) => x.s === 2) },
  { id: "loyal", ic: "🤝", n: "끝까지 의리", d: "믿을까 배신할까에서 한 번도 배신 안 함", f: (st) => st.met.turns >= 10 && st.met.coop === st.met.turns },
  { id: "betrayed", ic: "💔", n: "배신의 아픔", d: "믿었다가 3번 이상 배신당함", f: (st) => st.met.betrayed >= 3 },
  { id: "dealer", ic: "💰", n: "흥정의 귀재", d: "협상 두 번 모두 80점 이상", f: (st) => st.scores.deal.length >= 2 && st.scores.deal.every((x) => x >= 80) },
  { id: "walk", ic: "🚪", n: "판 깨기 전문", d: "협상 상대가 두 번 다 떠남", f: (st) => st.logs.deal.length >= 2 && st.logs.deal.every((x) => x.price == null) },
  { id: "bluff", ic: "🎭", n: "허세의 달인", d: "낮은 카드로 판돈을 가져감", f: (st) => st.met.bluffWin >= 1 },
  { id: "caught", ic: "🧿", n: "허세 간파", d: "상대 허세를 받아쳐 이김", f: (st) => st.met.caught >= 1 },
  { id: "chips", ic: "🪙", n: "칩 부자", d: "블러핑 배틀을 칩 18개 이상으로 마침", f: (st) => st.met.chips >= 18 },
  { id: "crowd", ic: "📊", n: "민심 예언가", d: "다수 예측 5개 전부 정답", f: (st) => st.logs.major.length >= 5 && st.logs.major.every((x) => x.ok) },
  { id: "rebel", ic: "🦄", n: "소수파의 자존심", d: "내 선택이 다수와 3번 이상 다름", f: (st) => st.logs.major.filter((x) => !x.top.includes(x.mine)).length >= 3 },
  { id: "allgood", ic: "🌟", n: "눈치 올라운더", d: "모든 능력 70점 이상", f: (st) => Object.values(abilities(st)).every((x) => x >= 70) },
];
function analysisOf(st, s, ab) {
  const out = [], M = st.met, L = st.logs;
  if (L.lie.length) out.push(`거짓말 찾기 ${L.lie.length}문제 중 ${L.lie.filter((x) => x.ok).length}문제를 맞혔어요.`);
  if (L.kakao.length) out.push(`카톡 속뜻 ${L.kakao.length}개 중 ${L.kakao.filter((x) => x.s === 2).length}개를 정확히 읽었어요.`);
  if (M.turns) out.push(`믿을까 배신할까에서 ${M.turns}번 중 ${M.coop}번 믿었어요. 믿었다가 배신당한 건 ${M.betrayed}번이에요.`);
  for (const d of L.deal) { const ln = (d.line || 0).toLocaleString(); if (d.role === "buy") out.push(d.price == null ? `살 때 협상은 결렬됐어요. 상대가 버틸 수 있던 최저가는 ${ln}원이었어요.` : `${d.price.toLocaleString()}원에 샀어요. 상대가 버틸 수 있던 최저가는 ${ln}원이었어요.`); else out.push(d.price == null ? `팔 때 협상은 결렬됐어요. 상대가 낼 수 있던 최고가는 ${ln}원이었어요.` : `${d.price.toLocaleString()}원에 팔았어요. 상대가 낼 수 있던 최고가는 ${ln}원이었어요.`); }
  if (L.bluff.length) out.push(`블러핑 배틀을 칩 ${M.chips}개로 마쳤어요. (시작 ${BLUFF_START}개)`);
  if (M.bluffTry) out.push(`낮은 카드로 크게 건 허세는 ${M.bluffTry}번이었어요.`);
  if (M.foldBest) out.push(`가장 높은 카드를 들고 접은 판이 ${M.foldBest}번 있었어요. 조금 더 배짱을 가져도 돼요.`);
  if (L.major.length) out.push(`다수의 선택을 ${L.major.length}문제 중 ${L.major.filter((x) => x.ok).length}문제 맞혔어요.`);
  return out;
}
// ---------- 성향 4축 (실제 플레이로 계산) ----------
const AX = {
  trust: { l: "믿음형", r: "전략형", t: ["먼저 믿어 주는 쪽이에요. 손해를 보더라도 관계를 지키는 걸 택해요.", "상대를 봐 가며 믿을지 정해요. 믿을 사람은 믿고, 아닌 사람은 경계해요.", "이길 수 있을 땐 과감하게 배신도 골라요. 관계보다 결과를 먼저 봐요."] },
  bold: { l: "신중형", r: "승부사형", t: ["확실할 때만 움직여요. 큰 위험은 피하고 작게 이기는 걸 좋아해요.", "상황을 봐서 걸 때는 걸고, 물러설 때는 물러서요.", "크게 걸고 크게 노려요. 허세도 전략이라고 생각하는 타입이에요."] },
  logic: { l: "감성형", r: "논리형", t: ["말의 앞뒤보다 그 속에 담긴 감정을 먼저 읽어요.", "논리와 감정을 둘 다 써서 사람을 읽어요.", "감정보다 말이 앞뒤가 맞는지를 먼저 따져요."] },
  crowd: { l: "개성형", r: "대중형", t: ["남들과 다른 선택을 즐겨요. 유행보다 내 취향이 먼저예요.", "대세도 알고 내 취향도 있어요. 때에 따라 골라요.", "사람들과 비슷한 선택을 해요. 그래서 다수의 마음을 잘 알아요."] },
};
export function axesOf(st, s = gameScores(st)) {
  const M = st.met, L = st.logs, out = [];
  const band = (v) => (v < 38 ? 0 : v > 62 ? 2 : 1);
  const push = (id, v) => { if (v == null || !Number.isFinite(v)) return; v = Math.round(clamp(v, 0, 100)); const a = AX[id]; out.push({ id, l: a.l, r: a.r, v, t: a.t[band(v)] }); };
  if (M.turns) push("trust", 100 - (M.coop / M.turns) * 100);
  if (L.bluff.length) { const avgBet = avg(L.bluff.map((x) => x.bet)), folds = L.bluff.filter((x) => x.fold).length / L.bluff.length; push("bold", ((avgBet - 1) / 2) * 80 + (M.bluffTry ? 20 : 0) - folds * 30 + 15); }
  if (s.lie != null && s.kakao != null) push("logic", 50 + (s.lie - s.kakao) / 2);
  if (L.major.length) push("crowd", (L.major.filter((x) => x.top.includes(x.mine)).length / L.major.length) * 100);
  return out;
}
export function scoreOf(total) { return total; }
export function diagnose(st) {
  const s = gameScores(st), ab = abilities(st), total = Math.round(avg(Object.values(ab))), typeId = typeOf(st, ab, total), T = TYPES[typeId], lv = Math.min(9, Math.floor(total / 10));
  return {
    v: CORE_VERSION, total, level: lv, levelName: LEVELS[lv], typeId,
    type: { n: T.n, ic: T.ic, d: T.d, long: T.long, strong: T.strong, weak: T.weak, work: T.work, friends: T.friends, love: T.love, tip: T.tip, says: T.says, seen: T.seen, charm: T.charm, stress: T.stress, jobs: T.jobs, good: TYPES[T.good].n, bad: TYPES[T.bad].n },
    axes: axesOf(st, s),
    abil: ab, abilNames: ABIL, games: s, gameInfo: Object.fromEntries(GAMES.map((g) => [g, { ic: GAME_INFO[g].ic, n: GAME_INFO[g].n }])),
    coopRate: st.met.turns ? Math.round((st.met.coop / st.met.turns) * 100) : null, chips: st.met.chips,
    analysis: analysisOf(st, s, ab), titles: TITLES.filter((t) => t.f(st)).map((t) => ({ id: t.id, ic: t.ic, n: t.n, d: t.d })),
    trust: st.logs.trust.map((x) => ({ ...x, ai: TRUST_AI[x.kind] })), kakao: st.logs.kakao.map((x) => { const q = KAKAO.find((k) => k.id === x.id); return { msg: q.msg, who: q.who, s: x.s, best: q.o.find((o) => o[1] === 2)[0] }; }),
    major: st.logs.major.map((x) => { const q = MAJOR.find((m) => m.id === x.id); return { q: q.q, mine: q.o[x.mine], guess: q.o[x.guess], top: x.top.map((i) => q.o[i]), ok: x.ok }; }),
    deals: st.logs.deal, bluff: st.logs.bluff,
  };
}
export { GAMES, GAME_INFO, TYPES, ABIL, LEVELS, KAKAO, MAJOR, TRUST_AI, NAMES, ROOMS };
