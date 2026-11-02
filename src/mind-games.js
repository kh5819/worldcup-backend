// =========================
// 플듀 심리전 진단소 — 미니게임 12종 + 멀티 전용 4종 (서버 전용: 정답·AI·시나리오 생성)
// 모든 상태는 서버에만 있고 화면에는 viewOf()로 공개 정보만 나감
// AI는 내 공개 행동·자기 패만 보고 결정 (플레이어의 비밀 패·이번 턴 답을 보지 않음 → 시험으로 확인)
// 칩·포인트는 전부 게임 안의 가상 값
// =========================
import { GAMES as META, levelOf, RIVAL_POOL } from "./mind-core.js";
// 라이벌별 전략값: noise 무작위, bluff 허세 추가, call 콜 느슨함(+)·신중(-), mem 기억 가중, mimic 따라 하기, lie 거짓 선언, risk 입찰 배수, acc 분석 정확도, press 앞설 때 압박
export const PERSONA = {
  luna: { mem: 1.6, acc: 0.06 }, zero: { noise: 0.38, acc: -0.12 }, kain: { bluff: 0.4, big: true, call: -0.06 }, mira: { contract: "grudger", call: -0.02 }, raven: { mem: 2.2, counter: true }, neon: { bluff: 0.15, call: 0.16, risk: 1.22, big: true },
  iris: { bluff: -0.1, call: -0.1, risk: 0.82, acc: 0.1 }, black: { bluff: 0.25, lie: 0.38, contract: "exploiter" }, echo: { mimic: true, contract: "tft" }, sera: { contract: "gtft", nego: "conceder", risk: 0.95 }, crow: { press: true, bluff: 0.12, nego: "boulware" }, omega: { mem: 1.6, mix: true, acc: 0.05 },
};
const P = (s) => PERSONA[s.rival] || {};

const rnd = (s) => { s.r = (s.r + 0x6D2B79F5) | 0; let t = Math.imul(s.r ^ (s.r >>> 15), 1 | s.r); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (s, n) => Math.floor(rnd(s) * n);
const pick = (s, a) => a[ri(s, a.length)];
const shuffle = (s, a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = ri(s, i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const c01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
const hm = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const intIn = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b);
const NAMES = ["민수", "지아", "도윤", "서연", "하준", "유나", "태오", "수아", "지호", "예린", "건우", "나은", "시우", "다인", "현우", "소이", "재민", "하린", "준서", "아린", "은호", "채원", "정우", "윤서", "로이", "미카", "테오", "루나"];

// ========== 1. 거짓말 탐지실 ==========
const PLACES = [["집", 0], ["카페", 1], ["편의점", 2], ["지하철역", 3], ["사무실", 4], ["헬스장", 5], ["공원", 6], ["영화관", 7], ["서점", 8], ["주차장", 9]];
const placeName = (i) => PLACES[i][0];
export const travelMin = (a, b) => (a === b ? 0 : 10 + 6 * Math.abs(PLACES[a][1] - PLACES[b][1]));
/** 진술 s가 증거 ev와 모순되는가 (시험의 정답 검증에도 씀) */
export function liarConflict(st, ev) {
  if (st.k === "at" || st.k === "buy") for (const e of ev.at) { const dt = Math.abs(st.t - e.t); if (e.p !== st.p && dt < travelMin(st.p, e.p)) return true; }
  if (st.k === "buy" && ev.closed && ev.closed.p === st.p && st.t >= ev.closed.from && st.t <= ev.closed.to) return true;
  if (st.k === "wet" && ev.rain != null && st.t < ev.rain) return true;
  if (st.k === "move") { if (st.tb - st.ta < travelMin(st.a, st.b)) return true; for (const e of ev.at) { if (e.p !== st.a && Math.abs(st.ta - e.t) < travelMin(st.a, e.p)) return true; if (e.p !== st.b && Math.abs(st.tb - e.t) < travelMin(st.b, e.p)) return true; } }
  return false;
}
const stmText = (st) => st.k === "at" ? `${hm(st.t)}쯤엔 ${placeName(st.p)}에 있었어요.` : st.k === "buy" ? `${hm(st.t)}쯤 ${placeName(st.p)}에서 물건을 샀어요.` : st.k === "wet" ? `${hm(st.t)}쯤 비를 맞아서 옷이 젖었어요.` : `${hm(st.ta)}에 ${placeName(st.a)}에서 나와 ${hm(st.tb)}에 ${placeName(st.b)}에 도착했어요.`;
export function genLiarCase(s, tier) {
  for (let tries = 0; tries < 400; tries++) {
    const who = pick(s, NAMES), route = shuffle(s, PLACES.map((_, i) => i)).slice(0, 3);
    let t = 18 * 60 + ri(s, 150); const at = [];
    for (let i = 0; i < 3; i++) { at.push({ t, p: route[i], src: ["CCTV", "카드 결제", "출입 기록"][i] }); if (i < 2) t += travelMin(route[i], route[i + 1]) + 10 + ri(s, 30); }
    const rest = PLACES.map((_, i) => i).filter((i) => !route.includes(i));
    const closedP = pick(s, rest); const ev = { at, closed: null, rain: null, tier };
    const tEnd = at[2].t, mid = at[1].t;
    if (tier >= 2) { if (rnd(s) < 0.5) ev.closed = { p: closedP, from: mid - 15, to: mid + 25 }; else ev.rain = tEnd - ri(s, 15); }
    let lie;
    if (tier === 1) { const i = ri(s, 3), other = pick(s, rest); lie = { k: "at", t: at[i].t + 3 - ri(s, 7), p: other }; }
    else if (tier === 2) lie = ev.closed ? { k: "buy", t: mid + 5, p: closedP } : { k: "wet", t: ev.rain - 20 - ri(s, 20) };
    else {
      const i = ri(s, 2), a = route[i], far = PLACES.map((_, k) => k).filter((k) => k !== a && !route.includes(k) && travelMin(a, k) >= 28);
      if (!far.length) continue;
      const b = pick(s, far), gap = travelMin(a, b) - 6 - ri(s, 8);
      if (gap < 8) continue;
      lie = rnd(s) < 0.5 ? { k: "move", a, ta: at[i].t, b, tb: at[i].t + gap } : { k: "at", p: b, t: at[i].t + gap };
    }
    const truth = shuffle(s, [
      { k: "at", t: at[0].t + 1, p: route[0] }, { k: "at", t: at[1].t - 2, p: route[1] }, { k: "at", t: at[2].t + 2, p: route[2] },
      { k: "move", a: route[0], ta: at[0].t + 2, b: route[1], tb: at[1].t - 1 }, { k: "move", a: route[1], ta: at[1].t + 2, b: route[2], tb: at[2].t - 1 },
      { k: "buy", t: at[1].t + 1, p: route[1] }, ...(ev.rain != null ? [{ k: "wet", t: ev.rain + 12 }] : []),
    ]).filter((x) => !liarConflict(x, ev));
    if (truth.length < 3 || !liarConflict(lie, ev)) continue;
    const stm = shuffle(s, [...truth.slice(0, 3), lie]);
    const ans = stm.indexOf(lie);
    if (stm.filter((x) => liarConflict(x, ev)).length !== 1) continue;
    const pairs = [[route[0], route[1]], [route[1], route[2]]];
    if (lie.k === "move") pairs.push([lie.a, lie.b]); else if (lie.k === "at") for (const r of route) pairs.push([r, lie.p]);
    const seen = new Set(), travel = [];
    for (const [a, b] of pairs) { const k = [a, b].sort().join("-"); if (a !== b && !seen.has(k)) { seen.add(k); travel.push({ a, b, m: travelMin(a, b) }); } }
    const why = lie.k === "buy" ? `${placeName(lie.p)}은 ${hm(ev.closed.from)}~${hm(ev.closed.to)}에 문을 닫았어요.` : lie.k === "wet" ? `비는 ${hm(ev.rain)}부터 내렸어요. 그 전에는 비를 맞을 수 없어요.`
      : lie.k === "move" ? `${placeName(lie.a)}→${placeName(lie.b)}은 ${travelMin(lie.a, lie.b)}분인데 ${lie.tb - lie.ta}분 만에 갔다고 했어요.`
      : (() => { const e = at.reduce((b, x) => (Math.abs(x.t - lie.t) < Math.abs(b.t - lie.t) ? x : b), at[0]); return `${e.src} 기록상 ${hm(e.t)}에 ${placeName(e.p)}에 있었어요. ${placeName(lie.p)}까지 ${travelMin(e.p, lie.p)}분이라 불가능해요.`; })();
    return { who, ev, stm, ans, tier, why, travel };
  }
  throw new Error("liar gen failed");
}
const liarPublic = (c) => ({
  who: c.who, tier: c.tier,
  evidence: [...c.ev.at.map((e) => `${e.src} ${hm(e.t)} — ${c.who}, ${placeName(e.p)}`), ...(c.ev.closed ? [`공지: ${placeName(c.ev.closed.p)} ${hm(c.ev.closed.from)}~${hm(c.ev.closed.to)} 임시 휴업`] : []), ...(c.ev.rain != null ? [`기상청: ${hm(c.ev.rain)}부터 비 시작`] : [])],
  travel: c.travel.map((x) => `${placeName(x.a)}↔${placeName(x.b)} ${x.m}분`), statements: c.stm.map(stmText),
});
const RIVAL_ACC = [0.6, 0.76, 0.9];
const TW = { 1: 1, 2: 1.3, 3: 1.6 };
const G_liar = {
  init(s) { const tiers = [[1, 2, 2, 3, 3], [2, 2, 3, 3, 3], [2, 3, 3, 3, 3]][s.lv]; s.cases = (s.short ? tiers.slice(0, 2) : s.mp ? tiers.slice(0, 3) : tiers).map((t) => genLiarCase(s, t)); s.i = 0; s.pts = 0; s.rivalPts = 0; s.wAcc = 0; s.wMax = 0; s.cal = 0; s.calMax = 0; },
  view(s) { const c = s.cases[s.i]; return { kind: "liar", step: s.i, of: s.cases.length, lim: [48, 42, 36][c.tier - 1], ...liarPublic(c), pts: s.pts, rival: s.rivalPts }; },
  auto: () => ({ pick: -1, conf: 1 }),
  act(s, a) {
    if (!intIn(a?.pick, -1, 3) || (a.conf !== 1 && a.conf !== 2)) return { error: "BAD_ACTION" };
    const c = s.cases[s.i], right = a.pick === c.ans, w = TW[c.tier];
    const delta = right ? a.conf : a.conf === 2 ? -1 : 0;
    s.pts += delta; s.wMax += w; if (right) s.wAcc += w;
    s.calMax += 2; s.cal += right ? a.conf : a.conf === 2 ? -1 : a.pick < 0 ? 0 : 0.5;
    const rOk = rnd(s) < (RIVAL_ACC[s.lv] + (P(s).acc || 0) + (s.level === 3 ? 0.04 : 0)) * (c.tier === 3 ? 0.85 : 1), rConf = rOk && rnd(s) < 0.5 ? 2 : 1;
    s.rivalPts += rOk ? rConf : 0;
    const fb = { kind: "liar", right, ans: c.ans, why: c.why, delta, rivalRight: rOk, pts: s.pts, rival: s.rivalPts, sfx: right ? "ok" : "no" };
    s.i++; if (s.i >= s.cases.length) s.done = true;
    return { fb };
  },
  result(s) { return { perf: { analyze: s.wMax ? s.wAcc / s.wMax : 0, risk: s.calMax ? c01(s.cal / s.calMax + 0.1) : 0 }, win: s.pts > s.rivalPts || (s.pts === s.rivalPts && s.pts > 0), detail: `내 점수 ${s.pts} · AI 수사관 ${s.rivalPts}` }; },
};

// ========== 2. 블러핑 포커 (패는 1~9, 가상 칩) ==========
const BET = { small: 2, big: 5 };
// AI 결정 함수: 자기 카드·공개 행동 기록(model)·난수만 받음 → 플레이어 카드를 볼 방법이 없음
export function aiPokerOpen(q, lv, m, r) {
  if (lv === 0) return q > 0.62 ? "small" : "check";
  if (lv === 1) { if (q > 0.72) return r() < 0.7 ? "big" : "small"; if (q > 0.45) return r() < 0.4 ? "small" : "check"; return r() < 0.15 ? "small" : "check"; }
  const slow = q > 0.85 && r() < 0.25;
  if (slow) return "check";
  if (q > 0.72) return "big";
  if (q > 0.45) return r() < 0.45 ? "small" : "check";
  const br = (m.foldAgainst + 1) / (m.facedBet + 3);       // 플레이어가 자주 접으면 허세를 늘림
  return r() < 0.15 + br * 0.45 ? (r() < 0.5 ? "big" : "small") : "check";
}
export function aiPokerRespond(q, size, lv, m, r) {
  if (lv === 0) return q > (size === BET.big ? 0.6 : 0.45) ? "call" : "fold";
  const seen = m.showBet ? m.showBluff / m.showBet : 0.25;
  if (lv === 1) return q > 0.42 + (size === BET.big ? 0.12 : 0) + (r() - 0.5) * 0.12 ? "call" : "fold";
  const betRate = (m.betN + 1) / (m.acts + 3);             // 너무 자주 베팅하면 허세로 의심
  const thr = 0.5 + (size === BET.big ? 0.12 : 0) - (seen - 0.25) * 0.5 - (betRate - 0.45) * 0.4;
  return q > thr + (r() - 0.5) * 0.08 ? "call" : "fold";
}
const qOf = (c) => (c - 1) / 8;
function pokerDeal(s) {
  const d = shuffle(s, [1, 2, 3, 4, 5, 6, 7, 8, 9]); s.mine = d[0]; s.aiC = d[1]; s.pot = 2; s.me -= 1; s.ai -= 1; s.bet = 0; s.line = []; s.first = s.hand % 2 === 0 ? "me" : "ai"; s.turn = s.first; s.checked = false;
  if (s.first === "ai") pokerAi(s);
}
function personaRespond(s, q, size, m, R) {
  const p = P(s), base = aiPokerRespond(q, size, s.lv, m, R);
  if (p.noise && R() < p.noise) return R() < 0.5 ? "call" : "fold";
  const seen = m.showBet ? m.showBluff / m.showBet : 0.25, mem = (p.mem || 0) * (s.level === 3 ? 1.3 : 1), thr = 0.5 + (size === BET.big ? 0.1 : 0) - (p.call || 0) - (seen - 0.25) * 0.45 * mem;
  if (p.mem || p.call) return q > thr ? "call" : "fold";
  return base;
}
function personaOpen(s, q, m, R) {
  const p = P(s); let a = aiPokerOpen(q, s.lv, m, R);
  if (p.noise && R() < p.noise) return ["check", "small", "big"][Math.floor(R() * 3)];
  if (p.mimic && m.acts >= 1) return R() < (m.betN + 0.5) / (m.acts + 1) ? (q > 0.5 ? "big" : "small") : "check";
  if (a === "check" && q < 0.45 && p.bluff && R() < Math.max(0, p.bluff)) a = p.big ? "big" : "small";
  if (a !== "check" && q < 0.45 && (p.bluff || 0) < 0 && R() < -p.bluff * 5) a = "check";
  if (p.big && a === "small") a = "big";
  if (p.press && s.ai > s.me + 3 && q > 0.3) a = "big";
  return a;
}
function pokerAi(s) {
  const R = () => rnd(s), q = qOf(s.aiC), m = s.model;
  if (s.bet) { const a = personaRespond(s, q, s.bet, m, R); if (a === "fold") { s.line.push("ai_fold"); return pokerEnd(s, "me", false); } const pay = Math.min(s.bet, s.ai); s.ai -= pay; s.pot += pay; s.line.push("ai_call"); return pokerEnd(s, null, true); }
  let a = personaOpen(s, q, m, R);
  const cap = Math.min(s.me, s.ai);
  let size = a === "big" ? BET.big : a === "small" ? BET.small : 0; if (size > cap) size = cap >= BET.small ? BET.small : 0;
  if (!size) { s.line.push("ai_check"); if (s.checked) return pokerEnd(s, null, true); s.checked = true; s.turn = "me"; return; }
  s.ai -= size; s.pot += size; s.bet = size; s.aiBet = size; s.line.push(size === BET.big ? "ai_big" : "ai_small"); s.turn = "me";
}
function pokerEnd(s, winner, show) {
  const aiBluff = s.aiBet && qOf(s.aiC) < 0.4;
  if (show) winner = s.mine > s.aiC ? "me" : "ai";
  if (winner === "me") s.me += s.pot; else s.ai += s.pot;
  if (s.myBet) { s.model.betN++; if (show) { s.model.showBet++; if (qOf(s.mine) < 0.4) s.model.showBluff++; } }
  s.model.acts++;
  if (s.myBet && qOf(s.mine) < 0.4) { s.bluffTry++; if (!show) s.bluffOk++; }
  if (s.myBet && qOf(s.mine) >= 0.6) { s.valTry++; if (show) s.valCalled++; }
  if (s.judge) { s.callN++; const stronger = s.aiC > s.mine; if ((s.judge === "call" && !stronger) || (s.judge === "fold" && stronger)) s.callRight++; if (s.judge === "fold" && aiBluff) s.foldedToBluff++; s.model.facedBet++; if (s.judge === "fold") s.model.foldAgainst++; }
  s.lastHand = { winner, show, mine: s.mine, ai: show ? s.aiC : null, pot: s.pot, line: s.line, bluffWin: !!(s.myBet && !show && qOf(s.mine) < 0.4), bluffFail: !!(s.myBet && show && qOf(s.mine) < 0.4 && winner === "ai"), aiBluffCaught: !!(show && aiBluff && winner === "me") };
  s.hand++; s.myBet = 0; s.aiBet = 0; s.judge = null;
  if (s.hand >= s.hands || s.me < 1 || s.ai < 1) { s.done = true; return; }
  pokerDeal(s);
}
const G_bluff = {
  init(s) { s.me = 20; s.ai = 20; s.hand = 0; s.hands = s.short ? 3 : s.mp ? 4 : 7; s.model = { foldAgainst: 0, facedBet: 0, showBet: 0, showBluff: 0, betN: 0, acts: 0 }; s.bluffTry = 0; s.bluffOk = 0; s.valTry = 0; s.valCalled = 0; s.callN = 0; s.callRight = 0; s.foldedToBluff = 0; pokerDeal(s); },
  view(s) { const cap = Math.min(s.me, s.ai); return { kind: "bluff", step: s.hand, of: s.hands, lim: 20, card: s.mine, me: s.me, ai: s.ai, pot: s.pot, facing: s.bet || 0, line: s.line, options: s.bet ? ["call", "fold"] : ["check", ...(cap >= BET.small ? ["small"] : []), ...(cap >= BET.big ? ["big"] : [])], last: s.lastHand || null, callCost: Math.min(s.bet, s.me) }; },
  auto: (s) => (s.bet ? { op: "fold" } : { op: "check" }),
  act(s, a) {
    const op = a?.op, cap = Math.min(s.me, s.ai), startHand = s.hand;
    if (s.bet) {
      if (op !== "call" && op !== "fold") return { error: "BAD_ACTION" };
      s.judge = op;
      if (op === "fold") { s.line.push("me_fold"); pokerEnd(s, "ai", false); }
      else { const pay = Math.min(s.bet, s.me); s.me -= pay; s.pot += pay; s.line.push("me_call"); pokerEnd(s, null, true); }
    } else {
      if (op === "check") { s.line.push("me_check"); if (s.checked) pokerEnd(s, null, true); else { s.checked = true; s.turn = "ai"; pokerAi(s); } }
      else if ((op === "small" && cap >= BET.small) || (op === "big" && cap >= BET.big)) { const size = BET[op]; s.me -= size; s.pot += size; s.bet = size; s.myBet = size; s.line.push(op === "big" ? "me_big" : "me_small"); s.turn = "ai"; pokerAi(s); }
      else return { error: "BAD_ACTION" };
    }
    const ended = s.hand !== startHand || s.done;
    return { fb: { kind: "bluff", ended, hand: ended ? s.lastHand : null, sfx: ended ? (s.lastHand.winner === "me" ? (s.lastHand.bluffWin ? "bluff" : "ok") : "no") : "card", me: s.me, ai: s.ai } };
  },
  result(s) {
    const net = s.me - 20;
    const bl = (s.bluffTry ? (s.bluffOk / s.bluffTry) * 0.6 : 0.1) + (s.valTry ? (s.valCalled / s.valTry) * 0.4 : 0.1);
    return { perf: { bluff: c01(bl), predict: s.callN ? (s.callRight + 0.5) / (s.callN + 1) : 0.4, risk: c01((net + 12) / 24) }, win: net > 0, detail: `칩 ${s.me} : ${s.ai} · 허세 ${s.bluffOk}/${s.bluffTry}` , flags: {} };
  },
};

// ========== 3. 다음 행동 예측 ==========
const PRED_ACTS = 3;
const STRATS = {
  cycle: { desc: "정해진 순서를 반복해요", next: (s, st) => st.seq[s.pHist.length % st.seq.length] },
  stay: { desc: "한 가지 행동을 오래 고집해요", next: (s, st) => (rnd(s) < 0.8 ? st.fav : ri(s, 3)) },
  markov: { desc: "직전 행동에 따라 다음 행동이 정해져요", next: (s, st) => { const l = s.pHist[s.pHist.length - 1] ?? 0; return rnd(s) < 0.88 ? st.map[l] : ri(s, 3); } },
  react: { desc: "내가 맞히면 바꾸고, 틀리면 그대로 가요", next: (s, st) => { const l = s.pHist[s.pHist.length - 1] ?? st.fav, g = s.gHist[s.gHist.length - 1]; return g === l ? (l + st.step) % 3 : l; } },
  mirror: { desc: "내가 직전에 고른 예측을 따라 해요", next: (s, st) => s.gHist[s.gHist.length - 1] ?? st.fav },
  anti: { desc: "내가 가장 안 고른 행동을 골라요", next: (s) => { const n = [0, 0, 0]; for (const g of s.gHist) if (g >= 0) n[g]++; const m = Math.min(...n); return n.indexOf(m); } },
};
function predSetup(s, name) { return { name, seq: shuffle(s, [0, 1, 2, ri(s, 3)]), fav: ri(s, 3), map: shuffle(s, [0, 1, 2]), step: 1 + ri(s, 2) }; }
const G_predict = {
  init(s) {
    s.n = s.short ? 7 : s.mp ? 10 : 16; s.pHist = []; s.gHist = []; s.hits = 0; s.w = 0; s.wMax = 0; s.stage = "play";
    const pool = [["cycle", "stay", "markov"], ["markov", "react", "mirror", "anti"], ["markov", "react", "mirror", "anti"]][s.lv];
    const pf = { zero: "stay", echo: "mirror", raven: "anti", luna: "markov" }[s.rival]; s.st1 = predSetup(s, pf && (s.lv > 0 || pf === "stay") ? pf : pick(s, pool)); s.st2 = s.lv === 2 ? predSetup(s, pick(s, pool.filter((x) => x !== s.st1.name))) : null; s.sw = s.st2 ? Math.floor(s.n * 0.5) + ri(s, 3) : 99; s.noise = [0.03, 0.07, 0.14][s.lv] + (P(s).noise ? 0.2 : 0) + (s.level === 3 ? 0.03 : 0);
    s.nextA = predNext(s);
  },
  view(s) {
    if (s.stage === "guess") return { kind: "predict", phase: "guess", step: s.n, of: s.n + 1, lim: 25, options: s.ruleOpts.map((k) => STRATS[k].desc), hist: s.pHist, gHist: s.gHist, hits: s.hits };
    return { kind: "predict", phase: "play", step: s.pHist.length, of: s.n + 1, lim: 12, hist: s.pHist, gHist: s.gHist, hits: s.hits };
  },
  auto: (s) => (s.stage === "guess" ? { rule: -1 } : { guess: -1 }),
  act(s, a) {
    if (s.stage === "guess") {
      if (!intIn(a?.rule, -1, 3)) return { error: "BAD_ACTION" };
      const cur = s.pHist.length > s.sw && s.st2 ? s.st2 : s.st1;
      s.ruleOk = s.ruleOpts[a.rule] === cur.name; s.done = true;
      return { fb: { kind: "predict", phase: "guess", right: s.ruleOk, ans: s.ruleOpts.indexOf(cur.name), why: `후반 상대의 규칙: ${STRATS[cur.name].desc}${s.st2 ? " (중간에 규칙을 바꿨어요)" : ""}`, sfx: s.ruleOk ? "ok" : "no" } };
    }
    if (!intIn(a?.guess, -1, 2)) return { error: "BAD_ACTION" };
    const act = s.nextA, right = a.guess === act, late = s.pHist.length >= s.n / 2 ? 1.5 : 1;
    s.wMax += late; if (right) { s.hits++; s.w += late; }
    s.pHist.push(act); s.gHist.push(a.guess);
    if (s.pHist.length >= s.n) {
      s.stage = "guess";
      const cur = s.pHist.length > s.sw && s.st2 ? s.st2 : s.st1;
      s.ruleOpts = shuffle(s, [cur.name, ...shuffle(s, Object.keys(STRATS).filter((k) => k !== cur.name)).slice(0, 3)]);
    } else s.nextA = predNext(s);
    return { fb: { kind: "predict", phase: "play", right, act, guess: a.guess, hits: s.hits, sfx: right ? "predict" : "no" } };
  },
  result(s) {
    const acc = s.hits / s.n, base = (s.w / (s.wMax || 1) - 1 / 3) / (0.85 - 1 / 3);
    return { perf: { predict: c01(base), analyze: c01((s.ruleOk ? 0.7 : 0.1) + acc * 0.3) }, win: acc >= [0.55, 0.5, 0.45][s.lv], detail: `적중 ${s.hits}/${s.n}${s.ruleOk ? " · 규칙 간파" : ""}` };
  },
};
function predNext(s) {
  const st = s.pHist.length >= s.sw && s.st2 ? s.st2 : s.st1;
  if (rnd(s) < s.noise) return ri(s, 3);
  return STRATS[st.name].next(s, st);
}

// ========== 4. 심리 가위바위보 (0 바위 1 보 2 가위) ==========
const beatsH = (h) => (h + 1) % 3;   // h를 이기는 손
const outcome = (a, b) => (a === b ? 0 : beatsH(b) === a ? 1 : -1);
export const RPS_EXPERTS = {
  freq: (h) => { const n = [0, 0, 0]; h.me.forEach((x) => x >= 0 && n[x]++); return n.indexOf(Math.max(...n)); },
  markov: (h) => { const l = h.me[h.me.length - 1]; if (l == null || l < 0) return 0; const n = [0, 0, 0]; for (let i = 1; i < h.me.length; i++) if (h.me[i - 1] === l && h.me[i] >= 0) n[h.me[i]]++; return n.indexOf(Math.max(...n)); },
  wsls: (h) => { const k = h.me.length - 1; if (k < 0) return 0; const m = h.me[k]; if (m < 0) return 0; const o = outcome(m, h.ai[k]); return o > 0 ? m : o < 0 ? beatsH(h.ai[k]) : (m + 1) % 3; },
  repeat: (h) => { const l = h.me[h.me.length - 1]; return l >= 0 ? l : 0; },
};
export function rpsAiHand(hist, lv, st, R) {
  const names = Object.keys(RPS_EXPERTS);
  if (lv === 0) { if (R() < 0.45) return beatsH(RPS_EXPERTS.freq(hist)); return st.habit[hist.me.length % st.habit.length]; }
  let best = names[0], bs = -1;
  for (const k of names) { let sc = 0; const from = Math.max(1, hist.me.length - (lv === 2 ? 6 : 10)); for (let i = from; i < hist.me.length; i++) { const sub = { me: hist.me.slice(0, i), ai: hist.ai.slice(0, i) }; if (RPS_EXPERTS[k](sub) === hist.me[i]) sc++; } if (sc > bs) { bs = sc; best = k; } }
  if (lv === 1) return R() < 0.8 ? beatsH(RPS_EXPERTS[best](hist)) : Math.floor(R() * 3);
  // 상급: 구간마다 전략을 바꿈 — 정공 / 한 단계 더 읽기(내가 카운터를 예상할 것을 역이용) / 미끼 패턴
  const phase = Math.floor(hist.me.length / 5) % 3, base = beatsH(RPS_EXPERTS[best](hist));
  if (phase === 0) return R() < 0.82 ? base : Math.floor(R() * 3);
  if (phase === 1) return R() < 0.7 ? beatsH(base) : base;
  return R() < 0.5 ? st.habit[hist.me.length % st.habit.length] : base;
}
const G_rps = {
  init(s) { s.n = s.short ? 7 : s.mp ? 10 : 15; s.h = { me: [], ai: [] }; s.w = 0; s.l = 0; s.d = 0; s.decl = 0; s.declWin = 0; s.habit = [ri(s, 3), ri(s, 3), ri(s, 3)]; rpsPrep(s); },
  view(s) { return { kind: "rps", step: s.h.me.length, of: s.n, lim: 10, w: s.w, l: s.l, d: s.d, declare: s.declare, histMe: s.h.me, histAi: s.h.ai }; },
  auto: () => ({ hand: -1 }),
  act(s, a) {
    if (!intIn(a?.hand, -1, 2)) return { error: "BAD_ACTION" };
    const ai = s.aiNext, o = a.hand < 0 ? -1 : outcome(a.hand, ai);
    if (o > 0) s.w++; else if (o < 0) s.l++; else s.d++;
    if (s.declare != null) { s.decl++; if (o > 0) s.declWin++; }
    // 내 패턴이 얼마나 읽혔나 (AI 전문가들의 사후 적중)
    if (a.hand >= 0) for (const k of Object.keys(RPS_EXPERTS)) { s.read = s.read || {}; s.read[k] = (s.read[k] || 0) + (RPS_EXPERTS[k](s.h) === a.hand ? 1 : 0); }
    const fb = { kind: "rps", me: a.hand, ai, o, w: s.w, l: s.l, d: s.d, declared: s.declare, lied: s.declare != null && s.declare !== ai, sfx: o > 0 ? "ok" : o < 0 ? "no" : "tick" };
    s.h.me.push(a.hand); s.h.ai.push(ai);
    if (s.h.me.length >= s.n) s.done = true; else rpsPrep(s);
    return { fb };
  },
  result(s) {
    const n = s.h.me.length || 1, best = Math.max(0, ...Object.values(s.read || { x: n / 3 })) / n;
    return { perf: { predict: c01(0.35 + ((s.w - s.l) / n) * 1.3), bluff: c01(1 - (best - 1 / 3) / (1 / 3)), risk: c01(s.decl ? (s.declWin + 0.25) / (s.decl + 1) : 0.35) }, win: s.w > s.l, detail: `${s.w}승 ${s.l}패 ${s.d}무` };
  },
};
function rpsPrep(s) {
  const R = () => rnd(s);
  const p = P(s), last = s.h.me[s.h.me.length - 1], strong = [0.45, 0.7, 0.85][s.lv] + (s.level === 3 ? 0.08 : 0);
  s.aiNext = rpsAiHand(s.h, s.lv, { habit: s.habit }, R);
  if (p.noise && R() < p.noise + 0.2) s.aiNext = Math.floor(R() * 3);                       // 제로: 변칙
  else if (p.mimic && last >= 0 && R() < strong) s.aiNext = last;                          // 에코: 내 직전 손을 따라 함
  else if (p.counter && last >= 0 && R() < strong) s.aiNext = beatsH(last);                // 레이븐: 내 직전 손의 카운터
  else if (p.press && s.h.me.length && s.w < s.l && R() < strong) s.aiNext = beatsH(RPS_EXPERTS.wsls(s.h)); // 크로우: 앞서면 습관을 찌름
  s.declare = rnd(s) < 0.4 ? (rnd(s) < [0.85, 0.6, 0.4][s.lv] - (p.lie || 0) ? s.aiNext : (s.aiNext + 1 + ri(s, 2)) % 3) : null;
}

// ========== 5. 비밀 경매 ==========
const LOTS = ["홀로그램 나침반", "네온 시계", "기억 큐브", "금고 열쇠", "복제 지도", "희귀 칩셋", "소리 없는 종", "거울 가면", "수상한 일기장", "별빛 램프", "낡은 로봇 팔", "암호 책", "유리 체스말", "폭풍 병", "연구소 배지", "그림자 망토", "황금 나사", "시간표 조각", "유령 카메라", "달 조각", "마지막 열쇠", "밀수 사탕", "데이터 진주", "연구소 설계도"];
const META_NAME = (id) => ({ neon: "네온", iris: "아이리스", sera: "세라" }[id] || "경쟁자");
const AU_RIVALS = [["절약가 코코", "frugal"], ["돌격 대장 바우", "aggro"], ["저격수 노아", "sniper"], ["따라쟁이 모모", "copy"]];
function aucAiBid(s, r, lot) {
  const v = lot.vals[r.i], rest = r.budget, f = r.type;
  let b;
  if (f === "frugal") b = v * (0.45 + rnd(s) * 0.15);
  else if (f === "aggro") b = v * (0.72 + rnd(s) * 0.2);
  else if (f === "sniper") b = lot.hi >= s.hiCut ? v * (0.85 + rnd(s) * 0.12) : v * 0.3;
  else b = s.prices.length ? (s.prices.reduce((x, y) => x + y, 0) / s.prices.length) * (0.9 + rnd(s) * 0.2) : v * 0.6;
  if (s.lv === 2 && r.i === 0 && s.myRatio.length && rnd(s) < 0.65) { const est = (lot.lo + lot.hi) / 2 * (s.myRatio.reduce((x, y) => x + y, 0) / s.myRatio.length); if (est < v - 3) b = Math.max(b, Math.min(est + 1 + rnd(s) * 2, v - 3)); }
  if (s.lv === 0) b *= 0.82;
  if (r.i === 0) b *= P(s).risk || 1;
  return clamp(Math.round(b), 0, rest);
}
const G_auction = {
  init(s) {
    const N = s.short ? 3 : s.mp ? 4 : 6, names = shuffle(s, LOTS).slice(0, N);
    s.rivals = shuffle(s, AU_RIVALS).slice(0, 3).map(([name, type], i) => ({ name, type, i, budget: 100, profit: 0, won: 0 })); if (s.rival) { s.rivals[0].type = { neon: "aggro", iris: "frugal", sera: "copy" }[s.rival] || s.rivals[0].type; s.rivals[0].name = META_NAME(s.rival); }
    s.lots = names.map((name) => { const base = 14 + ri(s, 34), lo = base - 6 - ri(s, 4), hi = base + 6 + ri(s, 4); return { name, lo, hi, mine: base + ri(s, 7) - 3, vals: [0, 1, 2].map(() => base + ri(s, 9) - 4) }; });
    s.hiCut = [...s.lots].map((l) => l.hi).sort((a, b) => b - a)[1]; s.i = 0; s.budget = 100; s.profit = 0; s.bench = 0; s.close = 0; s.over = 0; s.prices = []; s.myRatio = []; s.hist = [];
  },
  view(s) { const l = s.lots[s.i]; return { kind: "auction", step: s.i, of: s.lots.length, lim: 24, lot: { name: l.name, lo: l.lo, hi: l.hi, mine: l.mine }, budget: s.budget, profit: s.profit, rivals: s.rivals.map((r) => ({ name: r.name, budget: r.budget, profit: r.profit })), hist: s.hist }; },
  auto: () => ({ bid: 0, guess: 0, timeout: true }),
  act(s, a) {
    if (!intIn(a?.bid, 0, s.budget) || !intIn(a?.guess, 0, 200)) return { error: "BAD_ACTION" };
    const l = s.lots[s.i], bids = s.rivals.map((r) => aucAiBid(s, r, l)), top = Math.max(...bids);
    let winner = -1, price = a.bid;
    if (a.bid > top && a.bid > 0) { winner = "me"; s.budget -= a.bid; const p = l.mine - a.bid; s.profit += p; if (p < 0) s.over++; }
    else if (top > 0) { const i = bids.indexOf(top); winner = i; price = top; const r = s.rivals[i]; r.budget -= top; r.profit += l.vals[i] - top; r.won++; }
    s.prices.push(Math.max(top, winner === "me" ? a.bid : 0)); if (a.bid > 0) s.myRatio.push(a.bid / ((l.lo + l.hi) / 2));
    s.bench += Math.max(0, l.mine - top - 1); s.close += 1 - Math.min(1, Math.abs(a.guess - top) / 25);
    const row = { lot: l.name, bid: a.bid, guess: a.guess, top, bids: s.rivals.map((r, i) => ({ name: r.name, bid: bids[i] })), winner: winner === "me" ? "나" : winner >= 0 ? s.rivals[winner].name : "유찰", price: winner === -1 ? 0 : price, gain: winner === "me" ? l.mine - a.bid : 0, mine: l.mine };
    s.hist.push(row); s.i++; if (s.i >= s.lots.length) s.done = true;
    return { fb: { kind: "auction", ...row, profit: s.profit, sfx: winner === "me" ? (row.gain >= 0 ? "ok" : "no") : "tick" } };
  },
  result(s) {
    const best = Math.max(...s.rivals.map((r) => r.profit)), N = s.lots.length;
    const risk = s.bench > 0 ? c01(s.profit / s.bench) : s.over ? 0.2 : 0.7;
    return { perf: { risk: c01(risk - s.over * 0.08), predict: c01(s.close / N) }, win: s.profit > best, detail: `이익 ${s.profit} · 경쟁자 최고 ${best}` };
  },
};

// ========== 6. 배신의 계약 (C 협력 / D 배신) ==========
const PD = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
export const PD_TYPES = {
  tft: { name: "되갚는 사람", desc: "처음엔 협력하고, 내가 직전에 한 대로 따라 해요" },
  gtft: { name: "너그러운 사람", desc: "대체로 되갚지만 가끔 배신도 용서해요" },
  grudger: { name: "뒤끝 있는 사람", desc: "협력하다가 한 번 배신당하면 끝까지 배신해요" },
  pavlov: { name: "결과 따라 사는 사람", desc: "잘되면 그대로, 손해면 행동을 바꿔요" },
  joss: { name: "슬쩍 찌르는 사람", desc: "되갚는 척하다가 가끔 몰래 배신해요" },
  exploiter: { name: "간 보는 사람", desc: "믿게 만든 뒤 찔러 보고, 반격 없으면 계속 찔러요" },
};
export function aiPact(type, hist, promise, R) {
  const n = hist.length, last = hist[n - 1];
  switch (type) {
    case "tft": return last ? last.me : "C";
    case "gtft": return !last || last.me === "C" || R() < 0.3 ? "C" : "D";
    case "grudger": return hist.some((h) => h.me === "D") ? "D" : "C";
    case "pavlov": return !last ? "C" : last.me === last.ai ? "C" : "D";
    case "joss": return !last ? "C" : last.me === "D" ? "D" : R() < 0.15 ? "D" : "C";
    case "exploiter": {
      const streak = (() => { let k = 0; for (let i = n - 1; i >= 0 && hist[i].me === "C"; i--) k++; return k; })();
      if (last?.ai === "D" && last.me === "C") return "D";
      if (last?.ai === "D" && last.me === "D") return "C";
      if (promise && streak >= 1) return streak >= 2 ? "D" : "C";
      return streak >= 3 ? "D" : last ? last.me : "C";
    }
    default: return "C";
  }
}
const G_contract = {
  init(s) {
    s.n = s.short ? 6 : s.mp ? 7 : 10 + ri(s, 5); s.hist = []; s.me = 0; s.ai = 0; s.sucker = 0; s.broken = 0; s.brokenGain = 0; s.stage = "play";
    s.type = (s.lv > 0 && P(s).contract) || pick(s, [["tft", "gtft"], ["grudger", "pavlov", "joss", "tft"], ["exploiter", "joss", "pavlov", "grudger"]][s.lv]); pactPrep(s);
  },
  view(s) {
    if (s.stage === "guess") return { kind: "contract", phase: "guess", step: s.n, of: s.n + 1, lim: 25, options: s.opts.map((k) => PD_TYPES[k]), me: s.me, ai: s.ai, hist: s.hist.map(pubP) };
    return { kind: "contract", phase: "play", step: s.hist.length, of: null, lim: 12, me: s.me, ai: s.ai, aiPromise: s.aiPromise, hist: s.hist.map(pubP) };
  },
  auto: (s) => (s.stage === "guess" ? { type: -1 } : { act: "D", promise: false, timeout: true }),
  act(s, a) {
    if (s.stage === "guess") {
      if (!intIn(a?.type, -1, 3)) return { error: "BAD_ACTION" };
      s.typeOk = s.opts[a.type] === s.type; s.done = true;
      return { fb: { kind: "contract", phase: "guess", right: s.typeOk, ans: s.opts.indexOf(s.type), why: `상대는 ‘${PD_TYPES[s.type].name}’였어요. ${PD_TYPES[s.type].desc}.`, sfx: s.typeOk ? "ok" : "no" } };
    }
    if (a?.act !== "C" && a?.act !== "D") return { error: "BAD_ACTION" };
    const promise = !!a.promise, R = () => rnd(s), aiA = aiPact(s.type, s.hist, promise, R), [pm, pa] = PD[a.act + aiA];
    s.me += pm; s.ai += pa;
    const broke = promise && a.act === "D"; if (broke) { s.broken++; if (aiA === "C") s.brokenGain++; }
    if (a.act === "C" && aiA === "D") s.sucker++;
    const aiBroke = s.aiPromise && aiA === "D";
    s.hist.push({ me: a.act, ai: aiA, promise, aiPromise: s.aiPromise, pm, pa });
    const fb = { kind: "contract", phase: "play", me: a.act, aiA, pm, pa, totalMe: s.me, totalAi: s.ai, aiBroke, broke, sfx: aiA === "D" && a.act === "C" ? "betray" : a.act === "D" && aiA === "C" ? "bluff" : pm >= 3 ? "ok" : "no", cin: aiA === "D" && a.act === "C" ? "betrayed" : null };
    if (s.hist.length >= s.n) { s.stage = "guess"; s.opts = shuffle(s, [s.type, ...shuffle(s, Object.keys(PD_TYPES).filter((k) => k !== s.type)).slice(0, 3)]); fb.gameOverSoon = true; }
    else pactPrep(s);
    return { fb };
  },
  result(s) {
    const n = s.n;
    const allC = s.hist.every((h) => h.me === "C");
    return { perf: { negotiate: c01((s.me - n * 1.2) / (n * 1.8)), predict: c01((s.typeOk ? 0.75 : 0.15) + (s.me >= s.ai ? 0.25 : 0)), risk: c01(1 - s.sucker / Math.max(1, n * 0.5)), bluff: c01(s.broken ? 0.3 + 0.2 * s.brokenGain : 0.3) }, win: s.me >= s.ai && s.me >= n * 2.4, detail: `${s.me} : ${s.ai}${s.typeOk ? " · 유형 간파" : ""}`, flags: { allCooperate: allC, betrayGain: s.brokenGain } };
  },
};
const pubP = (h) => ({ me: h.me, ai: h.ai, promise: h.promise, aiPromise: h.aiPromise });
function pactPrep(s) { s.aiPromise = s.type === "exploiter" ? rnd(s) < 0.8 : s.type === "joss" ? rnd(s) < 0.6 : s.type === "grudger" ? !s.hist.some((h) => h.me === "D") : rnd(s) < 0.5; }

// ========== 7. 표정 없는 용의자 ==========
export const SUS_EVAL = {
  is: (st, c) => c === st.x, not: (st, c) => c !== st.x, me: (st, c) => c !== st.who, either: (st, c) => c === st.x || c === st.y,
};
const susText = (st, names) => st.t === "is" ? `범인은 ${names[st.x]}예요.` : st.t === "not" ? `${names[st.x]}는 범인이 아니에요.` : st.t === "me" ? "저는 범인이 아니에요." : `범인은 ${names[st.x]} 아니면 ${names[st.y]}예요.`;
export function susCheck(c) {
  const sols = [];
  for (let x = 0; x < c.k; x++) { const lies = c.st.map((st, i) => (SUS_EVAL[st.t](st, x) ? -1 : i)).filter((i) => i >= 0); if (lies.length === c.K) sols.push({ culprit: x, lies }); }
  return sols;
}
export function genSuspectCase(s, tier) {
  const k = tier === 3 ? 5 : 4, K = tier === 3 && rnd(s) < 0.5 ? 2 : 1;
  for (let tries = 0; tries < 800; tries++) {
    const names = shuffle(s, NAMES).slice(0, k), c = ri(s, k), liars = shuffle(s, Array.from({ length: k }, (_, i) => i)).slice(0, K);
    const st = [];
    for (let i = 0; i < k; i++) {
      const lie = liars.includes(i), pool = [];
      for (let x = 0; x < k; x++) if (x !== i) { pool.push({ t: "is", x, who: i }, { t: "not", x, who: i }); for (let y = x + 1; y < k; y++) if (y !== i && tier >= 2) pool.push({ t: "either", x, y, who: i }); }
      pool.push({ t: "me", who: i });
      const ok = pool.filter((p) => SUS_EVAL[p.t](p, c) === !lie);
      if (!ok.length) break;
      st.push(pick(s, ok));
    }
    if (st.length !== k) continue;
    const cs = { k, K, st }; const sols = susCheck(cs);
    if (sols.length === 1 && sols[0].culprit === c) {
      const clues = shuffle(s, Array.from({ length: k }, (_, i) => i).filter((i) => i !== c));
      return { names, k, K, st, c, liars: sols[0].lies, clues, tier };
    }
  }
  throw new Error("suspect gen failed");
}
const G_suspect = {
  init(s) { const tiers = [[1, 2, 2, 3], [2, 2, 3, 3], [2, 3, 3, 3]][s.lv]; s.cases = (s.short ? tiers.slice(0, 2) : s.mp ? tiers.slice(0, 3) : tiers).map((t) => genSuspectCase(s, t)); s.i = 0; s.opened = 0; s.pts = 0; s.rivalPts = 0; s.max = 0; s.liarHit = 0; s.noClueWin = 0; s.clueTotal = 0; },
  view(s) { const c = s.cases[s.i]; return { kind: "suspect", step: s.i, of: s.cases.length, lim: [50, 50, 58][c.tier - 1], names: c.names, K: c.K, statements: c.st.map((st) => susText(st, c.names)), clues: c.clues.slice(0, s.opened).map((x) => `${c.names[x]}는 알리바이가 확인됐어요.`), canClue: s.opened < 2, pts: Math.round(s.pts * 10) / 10, rival: Math.round(s.rivalPts * 10) / 10 }; },
  auto: () => ({ op: "accuse", who: -1, liar: -1 }),
  act(s, a) {
    const c = s.cases[s.i];
    if (a?.op === "clue") { if (s.opened >= 2) return { error: "NO_CLUE" }; s.opened++; s.clueTotal++; return { fb: { kind: "suspect", clue: true, sfx: "tick" }, stay: true }; }
    if (a?.op !== "accuse" || !intIn(a.who, -1, c.k - 1) || !intIn(a.liar, -1, c.k - 1)) return { error: "BAD_ACTION" };
    const w = TW[c.tier], right = a.who === c.c, lr = c.liars.includes(a.liar), mul = 1 - s.opened * 0.2;
    const gain = ((right ? 1 : 0) + (lr ? 0.4 : 0)) * w * mul; s.pts += gain; s.max += 1.4 * w; if (lr) s.liarHit++; if (right && !s.opened) s.noClueWin++;
    const rOk = rnd(s) < (RIVAL_ACC[s.lv] + (P(s).acc || 0) + (s.level === 3 ? 0.04 : 0)) * (c.tier === 3 ? 0.85 : 1); s.rivalPts += rOk ? 1.2 * w * 0.85 : 0;
    const fb = { kind: "suspect", right, liarRight: lr, ans: c.c, liars: c.liars, names: c.names, why: `범인이 ${c.names[c.c]}일 때만 거짓말쟁이가 정확히 ${c.K}명이에요. 거짓 진술: ${c.liars.map((i) => c.names[i]).join(", ")}.`, gain: Math.round(gain * 10) / 10, rivalRight: rOk, sfx: right ? "ok" : "no" };
    s.i++; s.opened = 0; if (s.i >= s.cases.length) s.done = true;
    return { fb };
  },
  result(s) { const N = s.cases.length; return { perf: { analyze: c01(s.pts / (s.max || 1)), predict: c01(s.liarHit / N), risk: c01((s.noClueWin / N) * 0.8 + 0.2 * (1 - s.clueTotal / (N * 2))) }, win: s.pts > s.rivalPts, detail: `${Math.round(s.pts * 10) / 10} : ${Math.round(s.rivalPts * 10) / 10}` }; },
};

// ========== 8. 최후의 협상 ==========
const ITEM_SETS = [["에너지 셀", "데이터 칩", "금고 열쇠"], ["연구비", "장비", "보안 등급"], ["금화", "지도", "해독제"], ["사탕", "카드", "티켓"], ["로봇", "배터리", "설계도"], ["토큰", "포션", "룬"], ["네온관", "회로", "렌즈"], ["홍보권", "방송 시간", "협찬품"]];
const allocs = (cnt) => { const out = []; for (let a = 0; a <= cnt[0]; a++) for (let b = 0; b <= cnt[1]; b++) for (let c = 0; c <= cnt[2]; c++) out.push([a, b, c]); return out; };
const util = (mine, val, goal) => mine[0] * val[0] + mine[1] * val[1] + mine[2] * val[2] + (goal && mine[goal.i] >= goal.n ? goal.bonus : 0);
export function aiNegoRespond(s, offerToAi, turn) {
  const { aiVal: v, aiGoal: g, aiBatna: b, cnt } = s, T = s.T, u = util(offerToAi, v, g) * disc(turn), maxU = util(cnt, v, g);
  const f = turn / T;
  const thr = s.aiStyle === "conceder" ? maxU * (0.62 - 0.32 * Math.sqrt(f)) : s.aiStyle === "tit" ? maxU * (0.68 - 0.22 * f - 0.08 * Math.min(1, s.concede / 4)) : maxU * (0.78 - 0.3 * f * f * f);
  return { accept: u >= Math.max(thr, b), thr: Math.max(thr, b), u };
}
export function aiNegoCounter(s, turn, thr) {
  const { aiVal: v, aiGoal: g, cnt } = s;
  const w = s.pref.map((x) => x + 1);   // 플레이어가 제안에서 많이 챙기려던 물건 = 공개 행동으로만 추정
  let best = null, bs = -1e9;
  for (const a of allocs(cnt)) {
    const ua = util(a, v, g) * disc(turn);
    if (ua < thr - 0.01) continue;
    const toP = [cnt[0] - a[0], cnt[1] - a[1], cnt[2] - a[2]], score = toP[0] * w[0] + toP[1] * w[1] + toP[2] * w[2] - ua * 0.01;
    if (score > bs) { bs = score; best = a; }
  }
  return best || cnt;
}
const disc = (t) => 1 - 0.08 * Math.max(0, t - 3);
const G_nego = {
  init(s) {
    s.items = pick(s, ITEM_SETS); s.cnt = [2 + ri(s, 3), 2 + ri(s, 3), 2 + ri(s, 2)]; s.T = s.short ? 4 : 6; s.turn = 1; s.stage = "talk"; s.concede = 0; s.pref = [0, 0, 0]; s.lastMine = null;
    do { s.val = [1 + ri(s, 5), 1 + ri(s, 5), 1 + ri(s, 5)]; s.aiVal = [1 + ri(s, 5), 1 + ri(s, 5), 1 + ri(s, 5)]; } while (s.val.join() === s.aiVal.join());
    const gi = ri(s, 3), ai = (gi + 1 + ri(s, 2)) % 3;
    s.goal = { i: gi, n: Math.max(1, s.cnt[gi] - 1), bonus: 5 }; s.aiGoal = { i: ai, n: Math.max(1, s.cnt[ai] - 1), bonus: 5 };
    const maxMe = util(s.cnt, s.val, s.goal), maxAi = util(s.cnt, s.aiVal, s.aiGoal);
    s.batna = Math.round(maxMe * 0.22); s.aiBatna = Math.round(maxAi * 0.22); s.maxMe = maxMe; s.maxAi = maxAi;
    s.aiStyle = (s.lv > 0 && P(s).nego) || pick(s, [["conceder"], ["tit", "conceder"], ["boulware", "tit"]][s.lv]); s.aiOffer = null; s.log = []; s.deal = null;
    // AI 첫 제안
    const { thr } = aiNegoRespond(s, s.cnt, 1); s.aiOffer = aiNegoCounter(s, 1, Math.max(thr, maxAi * 0.7)); s.log.push({ who: "ai", give: toMine(s, s.aiOffer) });
  },
  view(s) {
    if (s.stage === "guess") return { kind: "nego", phase: "guess", step: s.T, of: s.T + 1, lim: 20, items: s.items, deal: s.deal, myU: s.myU };
    return { kind: "nego", phase: "talk", step: s.turn - 1, of: s.T + 1, lim: 32, turn: s.turn, T: s.T, items: s.items, cnt: s.cnt, val: s.val, goal: s.goal, batna: s.batna, disc: disc(s.turn), offerToMe: toMine(s, s.aiOffer), offerU: Math.round(util(toMine(s, s.aiOffer), s.val, s.goal) * disc(s.turn) * 10) / 10, log: s.log };
  },
  auto: (s) => (s.stage === "guess" ? { want: -1 } : s.turn >= s.T ? { op: "walk" } : { op: "offer", mine: s.lastMine || s.cnt.map((c) => Math.ceil(c / 2)), timeout: true }),
  act(s, a) {
    if (s.stage === "guess") {
      if (!intIn(a?.want, -1, 2)) return { error: "BAD_ACTION" };
      const top = s.aiVal.indexOf(Math.max(...s.aiVal)); s.wantOk = s.aiVal[a.want] === s.aiVal[top]; s.done = true;
      return { fb: { kind: "nego", phase: "guess", right: s.wantOk, ans: top, why: `상대 가치: ${s.items.map((n, i) => `${n} ${s.aiVal[i]}`).join(" · ")} / 상대의 숨은 목표: ${s.items[s.aiGoal.i]} ${s.aiGoal.n}개 이상`, sfx: s.wantOk ? "ok" : "no" } };
    }
    const end = (deal, mine) => { s.stage = "guess"; s.deal = deal; const d = disc(s.turn); s.myU = deal ? Math.round(util(mine, s.val, s.goal) * d * 10) / 10 : s.batna; const toA = deal ? [0, 1, 2].map((i) => s.cnt[i] - mine[i]) : null; s.aiU = deal ? Math.round(util(toA, s.aiVal, s.aiGoal) * d * 10) / 10 : s.aiBatna; s.mineFinal = mine; };
    if (a?.op === "accept") { const mine = toMine(s, s.aiOffer); end(true, mine); return { fb: { kind: "nego", phase: "talk", result: "deal", myU: s.myU, aiU: s.aiU, sfx: "deal" } }; }
    if (a?.op === "walk") { end(false, null); return { fb: { kind: "nego", phase: "talk", result: "walk", myU: s.myU, aiU: s.aiU, sfx: "no" } }; }
    if (a?.op !== "offer" || !Array.isArray(a.mine) || a.mine.length !== 3 || !a.mine.every((v, i) => intIn(v, 0, s.cnt[i]))) return { error: "BAD_ACTION" };
    const mine = a.mine, toA = [0, 1, 2].map((i) => s.cnt[i] - mine[i]);
    for (let i = 0; i < 3; i++) s.pref[i] += mine[i] / s.cnt[i];
    if (s.lastMine) { const before = s.lastMine.reduce((x, y) => x + y, 0), now = mine.reduce((x, y) => x + y, 0); if (now < before) s.concede += before - now; }
    s.lastMine = mine; s.log.push({ who: "me", give: mine });
    const r = aiNegoRespond(s, toA, s.turn);
    if (r.accept) { end(true, mine); return { fb: { kind: "nego", phase: "talk", result: "deal", aiAccept: true, myU: s.myU, aiU: s.aiU, sfx: "deal" } }; }
    if (s.turn >= s.T) { end(false, null); return { fb: { kind: "nego", phase: "talk", result: "timeout", myU: s.myU, aiU: s.aiU, sfx: "no" } }; }
    s.turn++;
    const rr = aiNegoRespond(s, s.cnt, s.turn); s.aiOffer = aiNegoCounter(s, s.turn, rr.thr); s.log.push({ who: "ai", give: toMine(s, s.aiOffer) });
    return { fb: { kind: "nego", phase: "talk", result: "counter", sfx: "card" } };
  },
  result(s) {
    const myN = c01((s.myU - s.batna) / (s.maxMe - s.batna)), aiN = c01((s.aiU - s.aiBatna) / (s.maxAi - s.aiBatna));
    return { perf: { negotiate: s.deal ? c01(myN * 0.8 + (myN + aiN) * 0.15) : 0.12, predict: s.wantOk ? 0.9 : 0.15, risk: s.deal ? (s.myU >= s.batna ? c01(0.5 + myN * 0.5) : 0.1) : (s.offerBelow ? 0.7 : 0.3) }, win: !!s.deal && myN >= aiN, detail: s.deal ? `합의 ${s.myU}점 (결렬 ${s.batna}) / 상대 ${s.aiU}` : `결렬 ${s.batna}점` };
  },
};
const toMine = (s, aiKeep) => [0, 1, 2].map((i) => s.cnt[i] - aiKeep[i]);

// ========== 9. 다수의 함정 ==========
export const TRAP_Q = [
  ["금요일 밤 야식은?", ["치킨", "피자", "떡볶이"], [5, 3, 3]], ["가장 먼저 탈출할 사람은?", ["리더", "막내", "조용한 사람"], [2, 2, 5]], ["보물 상자 세 개, 어떤 걸 열까?", ["금빛 상자", "낡은 상자", "검은 상자"], [5, 3, 2]],
  ["엘리베이터에서 서는 자리는?", ["버튼 앞", "맨 뒤", "가운데"], [2, 6, 2]], ["숫자 하나를 고르면?", ["3", "7", "9"], [3, 6, 2]], ["가장 믿음직한 표정은?", ["미소", "무표정", "진지함"], [5, 2, 3]],
  ["좀비 사태에 고를 무기는?", ["야구방망이", "프라이팬", "삽"], [5, 2, 3]], ["퀴즈 정답이 헷갈리면?", ["1번", "2번", "3번"], [2, 2, 6]], ["팀 이름을 정한다면?", ["불꽃", "그림자", "번개"], [3, 4, 4]],
  ["카드 세 장 중 고른다면?", ["왼쪽", "가운데", "오른쪽"], [2, 5, 3]], ["비밀번호 끝자리는?", ["0", "1", "7"], [2, 3, 5]], ["방학에 가장 하고 싶은 일?", ["여행", "늦잠", "게임"], [3, 4, 4]],
  ["가위바위보 첫 판은?", ["바위", "보", "가위"], [5, 2, 3]], ["가장 인기 있을 색은?", ["파랑", "빨강", "초록"], [5, 3, 2]], ["동전 앞면 뒷면 그리고 옆면!", ["앞면", "뒷면", "옆면"], [5, 3, 1]],
  ["심리전의 첫 수는?", ["공격", "관망", "협력"], [2, 5, 3]], ["가장 많이 고를 동물은?", ["고양이", "강아지", "여우"], [4, 5, 2]], ["영화 볼 때 앉을 자리는?", ["맨 앞", "중간", "맨 뒤"], [1, 6, 3]],
  ["의심스러운 사람은?", ["말 많은 사람", "조용한 사람", "웃는 사람"], [3, 5, 3]], ["출구가 셋이면?", ["가까운 문", "넓은 문", "아무도 안 간 문"], [4, 4, 2]], ["첫 소풍 간식은?", ["김밥", "샌드위치", "과자"], [5, 2, 3]],
  ["친구가 돈을 꿔 달라면?", ["빌려 준다", "거절", "모른 척"], [4, 3, 3]], ["숫자 카드 1·5·9 중?", ["1", "5", "9"], [3, 5, 3]], ["마지막 남은 치킨 조각은?", ["내가 먹는다", "양보한다", "가위바위보"], [3, 3, 5]],
  ["로봇이 고를 답은?", ["A", "B", "C"], [3, 3, 3]], ["가장 많이 나올 요일은?", ["금요일", "토요일", "월요일"], [5, 4, 1]],
];
const RULES = { majority: "가장 많이 나올 답을 맞히세요", minority: "가장 적게 나올 답을 고르세요", second: "두 번째로 많이 나올 답을 고르세요", beauty: "모두가 고른 숫자 평균의 2/3에 가까운 수를 쓰세요" };
function crowdVote(s, q, opts) {
  const weights = q[2], n = 40, cnt = [0, 0, 0];
  const mix = [[0.7, 0.2, 0.1, 0], [0.45, 0.25, 0.15, 0.15], [0.3, 0.2, 0.2, 0.3]][s.lv];
  const naive = () => { let t = rnd(s) * (weights[0] + weights[1] + weights[2]); for (let i = 0; i < 3; i++) { t -= weights[i]; if (t <= 0) return i; } return 2; };
  const rank = weights.map((w, i) => [w, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  for (let i = 0; i < n; i++) {
    const r = rnd(s); let c;
    if (r < mix[0]) c = naive();
    else if (r < mix[0] + mix[1]) c = s.lastTop != null ? s.lastTop : naive();      // 쏠림: 직전 1위를 따라감
    else if (r < mix[0] + mix[1] + mix[2]) c = s.lastLow != null ? s.lastLow : naive(); // 반골: 직전 꼴찌로
    else c = opts === "minority" ? rank[2] : opts === "second" ? rank[1] : rank[0];   // 규칙까지 계산하는 사람
    cnt[c]++;
  }
  return cnt;
}
function crowdBeauty(s) {
  const out = [], mix = [[0.65, 0.3, 0.05], [0.4, 0.4, 0.2], [0.25, 0.4, 0.35]][s.lv];
  for (let i = 0; i < 40; i++) { const r = rnd(s); out.push(r < mix[0] ? clamp(Math.round(50 + (rnd(s) - 0.5) * 60), 0, 100) : r < mix[0] + mix[1] ? 25 + ri(s, 15) : 10 + ri(s, 15)); }
  return out;
}
const G_trap = {
  init(s) {
    const N = s.short ? 4 : s.mp ? 5 : 8;
    const rules = []; const base = ["majority", "minority", "second", "beauty"]; while (rules.length < N) rules.push(...shuffle(s, base));
    s.rules = rules.slice(0, N); s.qs = shuffle(s, TRAP_Q).slice(0, N); s.i = 0; s.pts = 0; s.rivalPts = 0; s.hits = 0; s.nHit = 0; s.bClose = 0; s.bN = 0; s.trapAvoid = 0; s.trapN = 0; s.hist = []; s.lastTop = null; s.lastLow = null;
  },
  view(s) { const r = s.rules[s.i]; const q = s.qs[s.i]; return { kind: "trap", step: s.i, of: s.rules.length, lim: 12, rule: r, ruleText: RULES[r], q: r === "beauty" ? "0~100 숫자 하나를 고르세요" : q[0], options: r === "beauty" ? null : q[1], pts: s.pts, rival: s.rivalPts, hist: s.hist.slice(-3) }; },
  auto: (s) => (s.rules[s.i] === "beauty" ? { num: 100, timeout: true } : { pick: -1 }),
  act(s, a, ctx) {
    const r = s.rules[s.i], q = s.qs[s.i]; let gain = 0, fb;
    if (r === "beauty") {
      if (!intIn(a?.num, 0, 100)) return { error: "BAD_ACTION" };
      const c = crowdBeauty(s), all = [...c, a.num], target = Math.round((all.reduce((x, y) => x + y, 0) / all.length) * (2 / 3));
      const d = Math.abs(a.num - target); gain = d <= 2 ? 3 : d <= 6 ? 2 : d <= 12 ? 1 : 0; s.bClose += 1 - Math.min(1, d / 30); s.bN++;
      const rv = [40, 28, 20][s.lv] + ri(s, 9) - 4, rd = Math.abs(rv - target), rg = rd <= 2 ? 3 : rd <= 6 ? 2 : rd <= 12 ? 1 : 0; s.rivalPts += rg;
      fb = { kind: "trap", rule: r, num: a.num, target, avg: Math.round(all.reduce((x, y) => x + y, 0) / all.length), gain, rivalGain: rg, sfx: gain >= 2 ? "predict" : gain ? "ok" : "no" };
    } else {
      if (!intIn(a?.pick, -1, 2)) return { error: "BAD_ACTION" };
      const cnt = crowdVote(s, q, r); if (a.pick >= 0) cnt[a.pick]++;
      const order = [0, 1, 2].sort((x, y) => cnt[y] - cnt[x]);
      const win = r === "majority" ? order[0] : r === "second" ? order[1] : order[2];
      const hit = a.pick === win || (cnt[a.pick] === cnt[win] && a.pick >= 0); gain = hit ? 2 : 0; s.nHit++; if (hit) s.hits++;
      if (r !== "majority") { s.trapN++; if (a.pick >= 0 && a.pick !== order[0]) s.trapAvoid++; }
      const rvPick = s.lv === 0 || s.rival === "neon" ? ri(s, 3) : s.rival === "crow" && s.lastLow != null ? s.lastLow : (() => { const w = q[2].map((x, i) => [x, i]).sort((m, n) => n[0] - m[0]).map((x) => x[1]); return r === "majority" ? w[0] : r === "second" ? w[1] : w[2]; })();
      const rHit = rvPick === win && (s.lv > 0 ? rnd(s) < 0.85 : true); if (rHit) s.rivalPts += 2;
      s.lastTop = order[0]; s.lastLow = order[2];
      fb = { kind: "trap", rule: r, pick: a.pick, cnt, win, gain, options: q[1], rivalGain: rHit ? 2 : 0, sfx: hit ? "predict" : "no" };
    }
    s.pts += gain; s.hist.push({ rule: r, gain }); fb.pts = s.pts; fb.rival = s.rivalPts;
    s.i++; if (s.i >= s.rules.length) s.done = true;
    return { fb };
  },
  result(s) { return { perf: { predict: c01(s.nHit ? s.hits / s.nHit + 0.1 : 0.3), analyze: c01(s.bN ? s.bClose / s.bN : 0.3), risk: c01(s.trapN ? s.trapAvoid / s.trapN : 0.5) }, win: s.pts > s.rivalPts, detail: `${s.pts} : ${s.rivalPts} (AI 대표)` }; },
};

// ========== 10. 심리 미로 ==========
const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx,dy,bit,반대 bit
export function genMaze(s, N) {
  const open = new Array(N * N).fill(0), seen = new Array(N * N).fill(false), st = [ri(s, N * N)]; seen[st[0]] = true;
  while (st.length) {
    const c = st[st.length - 1], x = c % N, y = (c - x) / N;
    const opts = DIRS.map((d, i) => [x + d[0], y + d[1], i]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[b * N + a]);
    if (!opts.length) { st.pop(); continue; }
    const [a, b, i] = pick(s, opts), n = b * N + a; open[c] |= DIRS[i][2]; open[n] |= DIRS[i][3]; seen[n] = true; st.push(n);
  }
  // 길을 더 뚫어 갈림길을 만듦
  for (let k = 0; k < N * N * 0.42; k++) { const c = ri(s, N * N), x = c % N, y = (c - x) / N, i = ri(s, 4), a = x + DIRS[i][0], b = y + DIRS[i][1]; if (a >= 0 && b >= 0 && a < N && b < N) { open[c] |= DIRS[i][2]; open[b * N + a] |= DIRS[i][3]; } }
  return open;
}
const neighbors = (m, c) => { const out = [], x = c % m.N, y = (c - x) / m.N; DIRS.forEach((d, i) => { if (m.open[c] & d[2]) out.push((y + d[1]) * m.N + x + d[0]); }); return out; };
function bfs(m, from, blocked) { const dist = new Array(m.N * m.N).fill(1e9); dist[from] = 0; const q = [from]; while (q.length) { const c = q.shift(); for (const n of neighbors(m, c)) if (!blocked.has(n) && dist[n] > dist[c] + 1) { dist[n] = dist[c] + 1; q.push(n); } } return dist; }
// 도망자: 놓인 덫(공개 정보)과 내 덫 습관만 봄. 이번 턴 덫은 모름 — 다음 칸은 덫을 받기 전에 미리 정해 둠
function runnerPlan(s, m) {
  const blocked = new Set(m.traps), nbs = neighbors(m, m.pos).filter((n) => !blocked.has(n));
  if (!nbs.length) return null;
  const dists = m.exits.map((e) => bfs(m, e, blocked));
  const realI = m.exits.indexOf(m.real), goal = (i) => (c) => dists[i][c];
  const opts = nbs.map((n) => ({ n, dReal: dists[realI][n], dNear: Math.min(...dists.map((d) => d[n])), back: n === m.prev }));
  if (opts.every((o) => o.dNear >= 1e9)) return null;
  let target = realI;
  if (s.lv >= 1 && m.exits.length > 1 && !m.switched) {
    const decoy = (realI + 1) % m.exits.length;
    if (dists[decoy][m.pos] > 2) target = decoy; else m.switched = true;
  }
  const by = (a, b) => goal(target)(a.n) - goal(target)(b.n) || (a.back ? 1 : 0) - (b.back ? 1 : 0);
  const sorted = [...opts].filter((o) => o.dNear < 1e9).sort(by);
  const firstD = goal(target)(sorted[0].n), ties = sorted.filter((o) => goal(target)(o.n) === firstD);
  let c = pick(s, ties);
  if (P(s).noise && rnd(s) < 0.4) c = pick(s, sorted);                 // 제로: 지름길이 아닌 길도 고름
  if ((s.lv === 2 || P(s).mem) && sorted.length > 1) {
    const habit = s.trapN >= 2 ? s.trapShort / s.trapN : 0.5;    // 내가 지름길 칸에 덫을 놓는 습관
    if (rnd(s) < habit * 0.7) { const alt = sorted.filter((o) => o.n !== c.n && !o.back); if (alt.length) c = alt[0]; }
  }
  m.shortest = ties.map((o) => o.n);
  return c.n;
}
const forward = (m) => neighbors(m, m.pos).filter((n) => !m.traps.includes(n) && n !== m.prev);
// 갈림길이 아니면 도망자는 고민 없이 달림 → 덫 예측은 갈림길에서만 (찍어도 맞는 통로 덫 방지)
function mazeRun(s, m) {
  while (true) {
    m.next = runnerPlan(s, m);
    if (m.next == null) return "caught";
    if (forward(m).length >= 2) return null;
    m.prev = m.pos; m.trail.push(m.pos); m.pos = m.next; m.turn++;
    if (m.exits.includes(m.pos) || m.turn > m.N * m.N) return "escape";
  }
}
function mazeStart(s) {
  for (let t = 0; t < 40; t++) {
    const N = s.mi === 0 ? 6 : 7, m = { N, open: genMaze(s, N), traps: [], left: s.lv === 0 ? 2 : 1, turn: 0, trail: [], switched: false, prev: -1 };
    const ys = shuffle(s, Array.from({ length: N }, (_, i) => i)); m.pos = ys[0] * N; m.exits = ys.slice(0, Math.min(3, 2 + s.lv)).map((y) => (y + 1) * N - 1); m.real = pick(s, m.exits);
    if (mazeRun(s, m) === null) { s.m = m; return; }
  }
  throw new Error("maze gen failed");
}
const G_maze = {
  init(s) { s.mazes = s.short ? 1 : s.mp ? 2 : 3; s.mi = 0; s.caught = 0; s.trapN = 0; s.trapShort = 0; s.hit = 0; s.left = 0; s.rows = []; mazeStart(s); },
  view(s) { const m = s.m; return { kind: "maze", step: s.mi, of: s.mazes, lim: 10, N: m.N, open: m.open, pos: m.pos, traps: m.traps, left: m.left, exits: m.exits, trail: m.trail.slice(-5), caught: s.caught, cand: forward(m), turn: m.turn }; },
  auto: () => ({ pass: true }),
  act(s, a) {
    const m = s.m; let trap = null;
    if (!a?.pass) {
      if (!intIn(a?.cell, 0, m.N * m.N - 1) || m.left <= 0 || !forward(m).includes(a.cell)) return { error: "BAD_ACTION" };
      trap = a.cell; m.left--; m.traps.push(trap); s.trapN++; if (m.shortest?.includes(trap)) s.trapShort++;
    }
    const nx = m.next; let ev = "move", from = m.pos;
    if (nx == null) { ev = "caught"; }
    else { m.prev = m.pos; m.trail.push(m.pos); m.pos = nx; if (trap === nx) { ev = "caught"; s.hit++; } else if (m.exits.includes(nx)) ev = "escape"; m.turn++; if (m.turn > m.N * m.N) ev = "escape"; }
    const fb = { kind: "maze", ev, from, to: nx, trap, hit: trap != null && trap === nx, sfx: ev === "caught" ? "predict" : ev === "escape" ? "no" : trap != null ? "tick" : "step" };
    if (ev === "move") { const r = mazeRun(s, m); if (r === null) return { fb }; ev = r; fb.ev = r; fb.end = m.pos; fb.sfx = r === "caught" ? "predict" : "no"; }
    if (ev === "caught") { s.caught++; s.left += m.left; fb.cin = "caught"; }
    s.rows.push(ev); s.mi++; fb.caught = s.caught;
    if (s.mi >= s.mazes) s.done = true; else mazeStart(s);
    return { fb };
  },
  result(s) { return { perf: { predict: c01((s.caught / s.mazes) * 0.55 + (s.trapN ? Math.max(0, (s.hit / s.trapN - 0.35) / 0.65) * 0.45 : 0)), analyze: c01(s.trapN ? s.hit / s.trapN : 0.1), risk: c01(s.caught ? 0.25 + (s.left / ((s.lv === 0 ? 2 : 1) * s.mazes)) * 0.75 : 0.15) }, win: s.caught >= Math.ceil((s.mazes * 2) / 3), detail: `${s.caught}/${s.mazes}회 포획` }; },
};

// ========== 11. 가짜 힌트 ==========
const COLORS = ["빨강", "파랑", "초록", "노랑"], SHAPES = ["별", "달", "번개", "하트"];
const HINT_T = {
  colorIs: (h, c) => c.color === h.v, colorNot: (h, c) => c.color !== h.v, shapeIs: (h, c) => c.shape === h.v, shapeNot: (h, c) => c.shape !== h.v, rowIs: (h, c) => c.y === h.v, rowNot: (h, c) => c.y !== h.v, colIs: (h, c) => c.x === h.v, colNot: (h, c) => c.x !== h.v,
  rowOr: (h, c) => c.y === h.v || c.y === h.w, colOr: (h, c) => c.x === h.v || c.x === h.w,
};
export const hintTrue = (h, c) => HINT_T[h.t](h, c);
const hintText = (h) => ({ colorIs: `${COLORS[h.v]} 칸이에요`, colorNot: `${COLORS[h.v]} 칸은 아니에요`, shapeIs: `${SHAPES[h.v]} 무늬예요`, shapeNot: `${SHAPES[h.v]} 무늬는 아니에요`, rowIs: `${h.v + 1}번째 줄이에요`, rowNot: `${h.v + 1}번째 줄은 아니에요`, colIs: `${h.v + 1}번째 칸이에요`, colNot: `${h.v + 1}번째 칸은 아니에요`, rowOr: `${h.v + 1}번째 또는 ${h.w + 1}번째 줄이에요`, colOr: `${h.v + 1}번째 또는 ${h.w + 1}번째 칸이에요` }[h.t]);
const INFORMANTS = ["그림자 찌르", "꼬마 해커", "늙은 경비", "수상한 택배원", "연구원 B"];
export function fakeCheck(c) {
  const sols = [];
  for (let i = 0; i < 16; i++) { const f = c.hints.map((h, k) => (hintTrue(h, c.cells[i]) ? -1 : k)).filter((k) => k >= 0); if (f.length === c.F) sols.push({ cell: i, fakes: f }); }
  return sols;
}
export function genFakeCase(s, tier, sly) {
  const F = tier === 3 ? 2 : 1;
  for (let tries = 0; tries < 5000; tries++) {
    const cc = shuffle(s, [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]), ss = shuffle(s, [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
    const cells = Array.from({ length: 16 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4), color: cc[i], shape: ss[i] }));
    const t = ri(s, 16), T = cells[t], n = tier === 1 ? 4 : 5 + (tier === 3 ? 1 : 0), hints = [];
    const mkT = () => { const k = pick(s, ["colorIs", "colorNot", "shapeIs", "shapeNot", "rowNot", "colNot", "rowOr", "colOr", "rowIs", "colIs"]); if (k === "colorIs") return { t: k, v: T.color }; if (k === "shapeIs") return { t: k, v: T.shape }; if (k === "rowIs") return { t: k, v: T.y }; if (k === "colIs") return { t: k, v: T.x }; if (k === "colorNot") return { t: k, v: (T.color + 1 + ri(s, 3)) % 4 }; if (k === "shapeNot") return { t: k, v: (T.shape + 1 + ri(s, 3)) % 4 }; if (k === "rowNot") return { t: k, v: (T.y + 1 + ri(s, 3)) % 4 }; if (k === "colNot") return { t: k, v: (T.x + 1 + ri(s, 3)) % 4 }; if (k === "rowOr") return { t: k, v: T.y, w: (T.y + 1 + ri(s, 3)) % 4 }; return { t: k, v: T.x, w: (T.x + 1 + ri(s, 3)) % 4 }; };
    const mkF = () => { const k = pick(s, ["colorIs", "shapeIs", "rowIs", "colIs", "colorNot", "shapeNot"]); if (k === "colorIs") return { t: k, v: (T.color + 1 + ri(s, 3)) % 4 }; if (k === "shapeIs") return { t: k, v: (T.shape + 1 + ri(s, 3)) % 4 }; if (k === "rowIs") return { t: k, v: (T.y + 1 + ri(s, 3)) % 4 }; if (k === "colIs") return { t: k, v: (T.x + 1 + ri(s, 3)) % 4 }; if (k === "colorNot") return { t: k, v: T.color }; return { t: k, v: T.shape }; };
    const seen = new Set();
    for (let k = 0; k < n - F && hints.length < n; k++) { const h = mkT(); const key = JSON.stringify(h); if (seen.has(key)) { k--; if (seen.size > 40) break; seen.add(key + seen.size); continue; } seen.add(key); hints.push(h); }
    for (let k = 0; k < F; k++) hints.push(mkF());
    const ord = shuffle(s, hints); const c = { cells, hints: ord, F, t, n };
    const sols = fakeCheck(c);
    if (sols.length === 1 && sols[0].cell === t) {
      const fakes = sols[0].fakes;
      // 수상한 정보원은 가짜를 자주 말하지만 언제나는 아님
      const who = shuffle(s, INFORMANTS).slice(0, ord.length); if (ord.length > INFORMANTS.length) who.push("지나가던 로봇");
      if (rnd(s) < 0.6 && who.includes(sly)) { const si = who.indexOf(sly), fi = fakes[0]; [who[si], who[fi]] = [who[fi], who[si]]; }
      return { ...c, fakes, who, tier };
    }
  }
  throw new Error("fake gen failed");
}
const G_fake = {
  init(s) { const tiers = [[1, 2, 2, 3, 3], [2, 2, 3, 3, 3], [2, 3, 3, 3, 3]][s.lv]; s.sly = pick(s, INFORMANTS); s.cases = (s.short ? tiers.slice(0, 2) : s.mp ? tiers.slice(0, 3) : tiers).map((t) => genFakeCase(s, t, s.sly)); s.i = 0; s.verified = null; s.pts = 0; s.max = 0; s.rivalPts = 0; s.fHit = 0; s.nv = 0; s.vUse = 0; s.lies = {}; },
  view(s) { const c = s.cases[s.i]; return { kind: "fake", step: s.i, of: s.cases.length, lim: [50, 50, 62][c.tier - 1], F: c.F, cells: c.cells.map((x) => ({ color: x.color, shape: x.shape })), hints: c.hints.map((h, i) => ({ text: hintText(h), who: c.who[i] })), verified: s.verified, canVerify: !s.verified, pts: Math.round(s.pts * 10) / 10, rival: Math.round(s.rivalPts * 10) / 10, lies: s.lies }; },
  auto: () => ({ op: "submit", cell: -1, fake: -1 }),
  act(s, a) {
    const c = s.cases[s.i];
    if (a?.op === "verify") { if (s.verified) return { error: "NO_VERIFY" }; if (!intIn(a.idx, 0, c.hints.length - 1)) return { error: "BAD_ACTION" }; s.verified = { idx: a.idx, ok: !c.fakes.includes(a.idx) }; s.vUse++; return { fb: { kind: "fake", verify: s.verified, sfx: "tick" }, stay: true }; }
    if (a?.op !== "submit" || !intIn(a.cell, -1, 15) || !intIn(a.fake, -1, c.hints.length - 1)) return { error: "BAD_ACTION" };
    const w = TW[c.tier], right = a.cell === c.t, fr = c.fakes.includes(a.fake), mul = s.verified ? 0.75 : 1, gain = ((right ? 1 : 0) + (fr ? 0.4 : 0)) * w * mul;
    s.pts += gain; s.max += 1.4 * w; if (fr) s.fHit++; if (right && !s.verified) s.nv++;
    for (const f of c.fakes) s.lies[c.who[f]] = (s.lies[c.who[f]] || 0) + 1;
    const rOk = rnd(s) < (RIVAL_ACC[s.lv] + (P(s).acc || 0) + (s.level === 3 ? 0.04 : 0)) * (c.tier === 3 ? 0.85 : 1); s.rivalPts += rOk ? 1.2 * w * 0.85 : 0;
    const fb = { kind: "fake", right, fakeRight: fr, ans: c.t, fakes: c.fakes, why: `가짜 힌트: ${c.fakes.map((i) => `‘${hintText(c.hints[i])}’(${c.who[i]})`).join(", ")}. 이 힌트를 빼면 모두 맞는 칸은 ${Math.floor(c.t / 4) + 1}줄 ${c.t % 4 + 1}칸뿐이에요.`, gain: Math.round(gain * 10) / 10, rivalRight: rOk, sfx: right ? "ok" : "no" };
    s.i++; s.verified = null; if (s.i >= s.cases.length) s.done = true;
    return { fb };
  },
  result(s) { const N = s.cases.length; return { perf: { analyze: c01(s.pts / (s.max || 1)), predict: c01(s.fHit / N), risk: c01((s.nv / N) * 0.8 + (1 - s.vUse / N) * 0.2) }, win: s.pts > s.rivalPts, detail: `${Math.round(s.pts * 10) / 10} : ${Math.round(s.rivalPts * 10) / 10}` }; },
};

// ========== 12. 마지막 심리전 ==========
const G_final = {
  init(s) {
    s.me = 15; s.ai = 15; s.N = s.short ? 4 : s.mp ? 5 : 7; const t = ["bid", "truth", "read", "pact"], seq = []; while (seq.length < s.N) seq.push(...shuffle(s, t)); s.seq = seq.slice(0, s.N); s.i = 0; s.hist = [];
    s.prof = s.profile || {}; s.m = { myCl: 0, myLie: 0, myC: 0, myD: 0, bids: [] }; s.st = { readN: 0, readOk: 0, fool: 0, truthN: 0, pactPts: 0, pactN: 0, bidGain: 0, bidN: 0 }; finalPrep(s);
  },
  view(s) { const r = s.cur; return { kind: "final", step: s.i, of: s.N, lim: 16, me: s.me, ai: s.ai, round: r.t, card: r.card ?? null, aiClaim: r.t === "read" ? r.aiClaim : null, pot: r.pot || null, maxBid: Math.min(s.me, r.pot || 0, 6), hist: s.hist.slice(-3) }; },
  auto: (s) => { const t = s.cur.t; return t === "bid" ? { bid: 0 } : t === "truth" ? { claim: "low" } : t === "read" ? { call: "truth" } : { act: "D", timeout: true }; },
  act(s, a) {
    const r = s.cur; let fb = { kind: "final", round: r.t }, dMe = 0, dAi = 0;
    const lvRead = [0.4, 0.62, 0.8][s.lv];
    if (r.t === "bid") {
      if (!intIn(a?.bid, 0, Math.min(s.me, 6))) return { error: "BAD_ACTION" };
      const avg = s.m.bids.length ? s.m.bids.reduce((x, y) => x + y, 0) / s.m.bids.length : 2 + (s.prof.riskBias || 0);
      const ab = clamp(Math.round(s.lv === 0 ? 1 + ri(s, 3) : s.lv === 1 ? avg + (rnd(s) < 0.5 ? 1 : 0) : Math.min(r.pot - 1, avg + 1 + (rnd(s) < 0.2 ? 1 : 0))), 0, Math.min(s.ai, 6));
      s.m.bids.push(a.bid); dMe -= a.bid; dAi -= ab;
      if (a.bid > ab) dMe += r.pot; else if (ab > a.bid) dAi += r.pot;
      s.st.bidN++; s.st.bidGain += clamp((dMe + 2) / (r.pot + 2), 0, 1);
      fb = { ...fb, bid: a.bid, aiBid: ab, pot: r.pot };
    } else if (r.t === "truth") {
      if (a?.claim !== "high" && a?.claim !== "low") return { error: "BAD_ACTION" };
      const real = r.card >= 6 ? "high" : "low", lie = a.claim !== real;
      s.m.myCl++; if (lie) s.m.myLie++;
      const susp = (s.m.myLie + 1 + (s.prof.bluffRate || 0) * 2) / (s.m.myCl + 3);
      const call = rnd(s) < (s.lv === 0 ? 0.3 : clamp(susp + (s.lv === 2 ? 0.1 : 0), 0.15, 0.85));
      s.st.truthN++;
      if (call) { if (lie) { dMe = -3; dAi = 3; } else { dMe = 2; dAi = -2; } }
      else { dMe = lie ? 2 : 1; dAi = -dMe; if (lie) s.st.fool++; }
      fb = { ...fb, claim: a.claim, card: r.card, lie, aiCall: call, cin: !call && lie ? "bluff" : null };
    } else if (r.t === "read") {
      if (a?.call !== "truth" && a?.call !== "bluff") return { error: "BAD_ACTION" };
      const lie = r.aiLie, right = (a.call === "bluff") === lie; s.st.readN++; if (right) s.st.readOk++;
      dMe = right ? 3 : -3; dAi = -dMe;
      fb = { ...fb, call: a.call, aiCard: r.aiCard, aiClaim: r.aiClaim, lie, right };
    } else {
      if (a?.act !== "C" && a?.act !== "D") return { error: "BAD_ACTION" };
      const coop = (s.m.myC + 1 + (s.prof.cooperate || 0) * 2) / (s.m.myC + s.m.myD + 3);
      const aiA = P(s).mix && s.lv >= 1 && s.i % 3 === 2 ? (s.m.myD > s.m.myC ? "D" : "C") : s.lv === 0 ? (rnd(s) < 0.7 ? "C" : "D") : s.lv === 1 ? (rnd(s) < coop ? "C" : "D") : (rnd(s) < (coop > 0.6 ? 0.45 : 0.7) ? "D" : "C");
      if (a.act === "C") s.m.myC++; else s.m.myD++;
      const tbl = { CC: [2, 2], CD: [-2, 4], DC: [4, -2], DD: [-1, -1] }[a.act + aiA]; dMe = tbl[0]; dAi = tbl[1]; s.st.pactN++; s.st.pactPts += (dMe + 2) / 6;
      fb = { ...fb, act: a.act, aiAct: aiA, cin: a.act === "C" && aiA === "D" ? "betrayed" : null };
    }
    void lvRead;
    s.me = Math.max(0, s.me + dMe); s.ai = Math.max(0, s.ai + dAi);
    fb.dMe = dMe; fb.dAi = dAi; fb.me = s.me; fb.ai = s.ai; fb.sfx = dMe > 0 ? "ok" : dMe < 0 ? "no" : "tick";
    s.hist.push({ t: r.t, dMe }); s.i++;
    if (s.i >= s.N || s.me <= 0 || s.ai <= 0) s.done = true; else finalPrep(s);
    return { fb };
  },
  result(s) {
    const t = s.st, net = s.me - 15;
    return { perf: { predict: c01(t.readN ? t.readOk / t.readN : 0.4), bluff: c01(t.truthN ? (t.fool + 0.3) / (t.truthN * 0.7 + 0.3) : 0.3), analyze: c01(t.readN ? t.readOk / t.readN * 0.7 + 0.2 : 0.4), negotiate: c01(t.pactN ? t.pactPts / t.pactN : 0.4), risk: c01(0.3 * (t.bidN ? t.bidGain / t.bidN : 0.4) + 0.7 * ((net + 15) / 30)) }, win: s.me > s.ai, detail: `칩 ${s.me} : ${s.ai}`, flags: { finalWin: s.me > s.ai } };
  },
};
function finalPrep(s) {
  const t = s.seq[s.i], r = { t };
  if (t === "bid") r.pot = 3 + ri(s, 4);
  if (t === "truth") r.card = 1 + ri(s, 9);
  if (t === "read") { r.aiCard = 1 + ri(s, 9); const real = r.aiCard >= 6 ? "high" : "low"; r.aiLie = rnd(s) < [0.25, 0.4, 0.5][s.lv]; r.aiClaim = r.aiLie ? (real === "high" ? "low" : "high") : real; }
  s.cur = r;
}

export const DEF = { liar: G_liar, bluff: G_bluff, predict: G_predict, rps: G_rps, auction: G_auction, contract: G_contract, suspect: G_suspect, nego: G_nego, trap: G_trap, maze: G_maze, fake: G_fake, final: G_final };

// ---------- 공통 엔진 ----------
export function createGame(g, { seed, lv = 1, short = false, mp = false, profile = null, rival = null }) {
  const def = DEF[g]; if (!def) throw new Error("no game " + g);
  const level = Math.min(3, Math.max(1, lv | 0)), s = { g, level, lv: Math.min(2, level), r: (seed | 0) ^ 0x5bd1e995, done: false, short, mp, profile, to: 0, acts: 0 };
  const pool = RIVAL_POOL[g] || []; s.rival = rival && pool.includes(rival) ? rival : pool.length ? pool[Math.abs(seed | 0) % pool.length] : null;
  def.init(s); return s;
}
export const viewOf = (s) => (s.done ? { kind: META[s.g] ? s.g : "", done: true } : { g: s.g, rivalId: s.rival, ...DEF[s.g].view(s) });
/** action=null이면 시간 초과: 게임 기본 행동 + 시간 초과 기록 */
export function applyAction(s, action) {
  if (s.done) return { error: "GAME_DONE" };
  const def = DEF[s.g]; let a = action;
  if (a == null) { a = def.auto(s); s.to++; }
  const r = def.act(s, a) || {};
  if (!r.error) s.acts++;
  return r;
}
export function resultOf(s) {
  const r = DEF[s.g].result(s);
  // 시간 초과가 많으면 성과를 깎음 (최대 40%)
  const pen = s.acts ? Math.min(0.4, (s.to / s.acts) * 0.8) : 0;
  const perf = {}; for (const k of Object.keys(r.perf)) perf[k] = Math.round(c01(r.perf[k]) * (1 - pen) * 1000) / 1000;
  return { g: s.g, lv: s.level, rival: s.rival, perf, win: !!r.win, detail: r.detail || "", timeouts: s.to, flags: r.flags || undefined };
}
/** 앞 게임 공개 행동으로 만든 습관 요약 — 마지막 심리전 AI가 씀 (비밀 패는 안 들어감) */
export function profileFrom(states) {
  const p = { bluffRate: 0, cooperate: 0, riskBias: 0 };
  for (const s of states) {
    if (s.g === "bluff" && s.bluffTry != null) p.bluffRate = s.model.showBet ? s.model.showBluff / s.model.showBet : 0;
    if (s.g === "contract" && s.hist?.length) p.cooperate = s.hist.filter((h) => h.me === "C").length / s.hist.length;
    if (s.g === "auction" && s.myRatio?.length) p.riskBias = Math.round((s.myRatio.reduce((x, y) => x + y, 0) / s.myRatio.length) * 2);
  }
  return p;
}

// ---------- 멀티 전용: 사람끼리 겨루는 게임 (동시 제출 → 마감 후 공개) ----------
const pctn = (a, b) => (b ? a / b : 0);
export const GROUP = {
  mcontract: {
    init(st) { st.n = 5; st.i = 0; st.pts = Object.fromEntries(st.ids.map((u) => [u, 0])); st.c = Object.fromEntries(st.ids.map((u) => [u, 0])); st.gainD = Object.fromEntries(st.ids.map((u) => [u, 0])); st.hist = []; },
    view: (st, u) => ({ kind: "mcontract", step: st.i, of: st.n, lim: 18, pts: st.pts[u], hist: st.hist }),
    lim: () => 18,
    tick(st, acts) {
      const ids = st.ids, n = ids.length, moves = {}; for (const u of ids) moves[u] = acts[u]?.act === "C" ? "C" : "D";
      const d = ids.filter((u) => moves[u] === "D").length, c = n - d, over = d > n / 2, gains = {};
      for (const u of ids) { const m = moves[u]; gains[u] = over ? (m === "D" ? 0 : 1) : m === "D" ? 5 : d === 0 ? 3 : n === 2 ? 0 : 2; st.pts[u] += gains[u]; if (m === "C") st.c[u]++; else if (!over) st.gainD[u]++; }
      const row = { moves, gains, d, c, over }; st.hist.push({ d, c, over }); st.i++; if (st.i >= st.n) st.done = true; return row;
    },
    score(st, u) { const max = 5 * st.n; const others = Math.max(...st.ids.map((x) => st.pts[x])); return { perf: { negotiate: c01(st.pts[u] / (3 * st.n)), bluff: c01(pctn(st.gainD[u], st.n) + 0.2), predict: c01(st.pts[u] / max + 0.2), risk: c01(st.pts[u] / max + 0.1) }, win: st.pts[u] === others && others > 0, detail: `${st.pts[u]}점` }; },
  },
  mtrap: {
    init(st) { st.n = 5; st.i = 0; st.pts = Object.fromEntries(st.ids.map((u) => [u, 0])); st.hit = { ...st.pts }; const s = { r: st.seed }; st.qs = shuffle(s, TRAP_Q).slice(0, 5); },
    view: (st, u) => ({ kind: "mtrap", step: st.i, of: st.n, lim: 15, q: st.qs[st.i][0], options: st.qs[st.i][1], pts: st.pts[u] }),
    lim: () => 15,
    tick(st, acts) {
      const cnt = [0, 0, 0], picks = {}; for (const u of st.ids) { const p = intIn(acts[u]?.pick, 0, 2) ? acts[u].pick : -1; picks[u] = p; if (p >= 0) cnt[p]++; }
      const top = Math.max(...cnt), winners = top > 0 ? [0, 1, 2].filter((i) => cnt[i] === top) : [], gains = {};
      for (const u of st.ids) { const hit = winners.includes(picks[u]); gains[u] = hit ? 2 : 0; st.pts[u] += gains[u]; if (hit) st.hit[u]++; }
      const row = { cnt, winners, picks, gains, options: st.qs[st.i][1], q: st.qs[st.i][0] }; st.i++; if (st.i >= st.n) st.done = true; return row;
    },
    score(st, u) { const best = Math.max(...st.ids.map((x) => st.pts[x])); return { perf: { predict: c01(st.hit[u] / st.n), analyze: c01(st.hit[u] / st.n), risk: c01(st.hit[u] / st.n + 0.1) }, win: st.pts[u] === best && best > 0, detail: `${st.hit[u]}/${st.n} 적중` }; },
  },
  mduel: {
    init(st) { st.n = 4; st.i = 0; st.phase = "claim"; st.pts = Object.fromEntries(st.ids.map((u) => [u, 0])); st.judgeHit = { ...st.pts }; st.judgeN = { ...st.pts }; st.fool = { ...st.pts }; st.lieN = { ...st.pts }; st.s = { r: st.seed }; duelDeal(st); },
    view(st, u) {
      const base = { kind: "mduel", step: st.i, of: st.n, phase: st.phase, card: st.cards[u], pts: st.pts[u] };
      if (st.phase === "claim") return { ...base, lim: 15 };
      const t = st.target[u]; return { ...base, lim: 15, target: t, targetClaim: st.claims[t] };
    },
    lim: () => 15,
    tick(st, acts) {
      if (st.phase === "claim") { for (const u of st.ids) { const c = acts[u]?.claim; st.claims[u] = c === "high" || c === "low" ? c : (st.cards[u] >= 6 ? "high" : "low"); } st.phase = "judge"; return { phase: "claim", claims: { ...st.claims } }; }
      const gains = {}, rows = {}; for (const u of st.ids) gains[u] = 0;
      for (const u of st.ids) {
        const t = st.target[u], real = st.cards[t] >= 6 ? "high" : "low", lied = st.claims[t] !== real, says = acts[u]?.call === "bluff" ? "bluff" : acts[u]?.call === "truth" ? "truth" : null;
        const right = says != null && (says === "bluff") === lied; st.judgeN[u]++;
        if (right) { gains[u] += 2; st.judgeHit[u]++; }
        if (lied) { st.lieN[t]++; if (!right) { gains[t] += 2; st.fool[t]++; } }
        rows[u] = { target: t, says, right, lied, card: st.cards[t], claim: st.claims[t] };
      }
      for (const u of st.ids) st.pts[u] += gains[u];
      const row = { phase: "judge", rows, gains, cards: { ...st.cards }, claims: { ...st.claims } };
      st.i++; if (st.i >= st.n) st.done = true; else { st.phase = "claim"; duelDeal(st); }
      return row;
    },
    score(st, u) { const best = Math.max(...st.ids.map((x) => st.pts[x])); return { perf: { bluff: c01(st.lieN[u] ? st.fool[u] / st.lieN[u] : 0.2), predict: c01(st.judgeHit[u] / (st.judgeN[u] || 1)), risk: c01(st.pts[u] / (st.n * 4) + 0.2) }, win: st.pts[u] === best && best > 0, detail: `${st.pts[u]}점 · 간파 ${st.judgeHit[u]}` }; },
  },
  mauction: {
    init(st) { st.n = 4; st.i = 0; const s = { r: st.seed }; st.lots = shuffle(s, LOTS).slice(0, 4).map((name) => { const v = 16 + ri(s, 30); return { name, v }; }); st.budget = Object.fromEntries(st.ids.map((u) => [u, 100])); st.profit = Object.fromEntries(st.ids.map((u) => [u, 0])); st.over = { ...st.profit }; st.closeWin = { ...st.profit }; st.wins = { ...st.profit }; },
    view: (st, u) => ({ kind: "mauction", step: st.i, of: st.n, lim: 20, lot: st.lots[st.i], budget: st.budget[u], profit: st.profit[u] }),
    lim: () => 20,
    tick(st, acts) {
      const l = st.lots[st.i], bids = {}; for (const u of st.ids) bids[u] = intIn(acts[u]?.bid, 0, st.budget[u]) ? acts[u].bid : 0;
      const top = Math.max(...Object.values(bids)), tops = st.ids.filter((u) => bids[u] === top && top > 0); let winner = null, gain = 0;
      if (tops.length === 1) { winner = tops[0]; gain = l.v - top; st.budget[winner] -= top; st.profit[winner] += gain; st.wins[winner]++; if (gain < 0) st.over[winner]++; else st.closeWin[winner] += 1 - Math.min(1, gain / l.v); }
      const row = { lot: l, bids, winner, gain, tie: tops.length > 1 }; st.i++; if (st.i >= st.n) st.done = true; return row;
    },
    score(st, u) { const best = Math.max(...st.ids.map((x) => st.profit[x])); const sumV = st.lots.reduce((x, y) => x + y.v, 0); return { perf: { risk: c01(st.profit[u] / (sumV * 0.5) - st.over[u] * 0.1 + 0.15), predict: c01(st.wins[u] ? st.closeWin[u] / st.wins[u] : 0.2) }, win: st.profit[u] === best && best > 0, detail: `이익 ${st.profit[u]}` }; },
  },
};
function duelDeal(st) { st.cards = {}; st.claims = {}; const d = shuffle(st.s, [1, 2, 3, 4, 5, 6, 7, 8, 9]); st.ids.forEach((u, i) => { st.cards[u] = d[i % 9]; }); st.target = {}; const n = st.ids.length, shift = 1 + st.i % Math.max(1, n - 1); st.ids.forEach((u, i) => { st.target[u] = st.ids[(i + shift) % n]; }); }
export function createGroup(g, seed, ids) { const st = { g, seed: seed | 0, ids: [...ids], done: false }; GROUP[g].init(st); return st; }
export const groupView = (st, u) => ({ g: st.g, ...GROUP[st.g].view(st, u) });
export function groupResult(st, u) { const r = GROUP[st.g].score(st, u); const perf = {}; for (const k of Object.keys(r.perf)) perf[k] = Math.round(c01(r.perf[k]) * 1000) / 1000; return { g: st.g, lv: 2, perf, win: !!r.win, detail: r.detail, timeouts: 0 }; }
void levelOf;
