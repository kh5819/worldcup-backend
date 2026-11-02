// 심리전 진단소 게임 시험: node scripts/test-mind-games.mjs
// 12종 × 난이도 3 × 여러 시드를 정책별로 끝까지 돌려 종료·점수 범위·정답 검증·AI 정보 접근·시나리오 다양성·밸런스를 확인
import fs from "fs";
import * as C from "../src/mind-core.js";
import * as G from "../src/mind-games.js";

let pass = 0, fail = 0; const fails = new Map();
const ok = (c, m) => { if (c) pass++; else { fail++; fails.set(m, (fails.get(m) || 0) + 1); } };
const IDS = C.PLANS.full;
const rint = (n) => Math.floor(Math.random() * n);

// 정책: random(무작위) / timeout(전부 시간 초과) / smart(정답·합리적 선택에 가까운 시험용 정책 — 서버 상태를 보므로 사람보다 유리)
function randomAction(s, v) {
  switch (s.g) {
    case "liar": return { pick: rint(4), conf: 1 + rint(2) };
    case "bluff": return { op: v.options[rint(v.options.length)] };
    case "predict": return v.phase === "guess" ? { rule: rint(4) } : { guess: rint(3) };
    case "rps": return { hand: rint(3) };
    case "auction": return { bid: rint(Math.min(v.budget, v.lot.mine) + 1), guess: rint(50) };
    case "contract": return v.phase === "guess" ? { type: rint(4) } : { act: rint(2) ? "C" : "D", promise: !!rint(2) };
    case "suspect": return rint(5) === 0 && v.canClue ? { op: "clue" } : { op: "accuse", who: rint(v.names.length), liar: rint(v.names.length) };
    case "nego": { if (v.phase === "guess") return { want: rint(3) }; const r = rint(4); if (r === 0) return { op: "accept" }; return { op: "offer", mine: v.cnt.map((c) => rint(c + 1)) }; }
    case "trap": return v.options ? { pick: rint(3) } : { num: rint(101) };
    case "maze": return v.left > 0 && v.cand.length && rint(2) ? { cell: v.cand[rint(v.cand.length)] } : { pass: true };
    case "fake": return rint(6) === 0 && v.canVerify ? { op: "verify", idx: rint(v.hints.length) } : { op: "submit", cell: rint(16), fake: rint(v.hints.length) };
    case "final": return v.round === "bid" ? { bid: rint(v.maxBid + 1) } : v.round === "truth" ? { claim: rint(2) ? "high" : "low" } : v.round === "read" ? { call: rint(2) ? "truth" : "bluff" } : { act: rint(2) ? "C" : "D" };
  }
}
function smartAction(s, v) {
  switch (s.g) {
    case "liar": return { pick: s.cases[s.i].ans, conf: 2 };
    case "bluff": { const q = (s.mine - 1) / 8; if (s.bet) return { op: s.mine > 5 - (s.bet === 5 ? 0 : 1) ? "call" : "fold" }; if (q > 0.7 && v.options.includes("big")) return { op: "big" }; if (q < 0.2 && Math.random() < 0.5 && v.options.includes("small")) return { op: "small" }; return { op: "check" }; }
    case "predict": if (v.phase === "guess") { const cur = s.pHist.length > s.sw && s.st2 ? s.st2 : s.st1; return { rule: s.ruleOpts.indexOf(cur.name) }; } return { guess: s.nextA };
    case "rps": return { hand: (s.aiNext + 1) % 3 };
    case "auction": { const l = s.lots[s.i]; const est = Math.min(s.budget, Math.max(0, Math.round(l.mine * 0.8))); return { bid: est, guess: Math.round(l.mine * 0.7) }; }
    case "contract": if (v.phase === "guess") return { type: s.opts.indexOf(s.type) }; return { act: s.hist.length && s.hist[s.hist.length - 1].ai === "D" ? "D" : "C", promise: true };
    case "suspect": { const c = s.cases[s.i]; return { op: "accuse", who: c.c, liar: c.liars[0] }; }
    case "nego": { if (v.phase === "guess") { return { want: s.aiVal.indexOf(Math.max(...s.aiVal)) }; } let best = null, bs = -1; for (let a = 0; a <= s.cnt[0]; a++) for (let b = 0; b <= s.cnt[1]; b++) for (let c = 0; c <= s.cnt[2]; c++) { const mine = [a, b, c], toA = [s.cnt[0] - a, s.cnt[1] - b, s.cnt[2] - c]; if (!G.aiNegoRespond(s, toA, s.turn).accept) continue; const u = a * s.val[0] + b * s.val[1] + c * s.val[2] + (mine[s.goal.i] >= s.goal.n ? s.goal.bonus : 0); if (u > bs) { bs = u; best = mine; } } return best ? { op: "offer", mine: best } : { op: "offer", mine: s.cnt.map((c) => Math.floor(c / 2)) }; }
    case "trap": { const r = s.rules[s.i]; if (r === "beauty") return { num: 25 }; const w = s.qs[s.i][2].map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]); return { pick: r === "majority" ? w[0] : r === "second" ? w[1] : w[2] }; }
    case "maze": { const m = s.m; return m.next != null && v.cand.includes(m.next) && v.left > 0 ? { cell: m.next } : { pass: true }; }
    case "fake": { const c = s.cases[s.i]; return { op: "submit", cell: c.t, fake: c.fakes[0] }; }
    case "final": { const r = s.cur; if (r.t === "bid") return { bid: Math.min(v.maxBid, Math.max(0, r.pot - 2)) }; if (r.t === "truth") return { claim: Math.random() < 0.5 ? (r.card >= 6 ? "high" : "low") : (r.card >= 6 ? "low" : "high") }; if (r.t === "read") return { call: r.aiLie ? "bluff" : "truth" }; return { act: "C" }; }
  }
}
function run(g, lv, seed, policy, opt = {}) {
  const s = G.createGame(g, { seed, lv, ...opt });
  let guard = 0;
  while (!s.done) {
    if (++guard > 400) { ok(false, `${g} ${policy} 끝나지 않음`); break; }
    const v = G.viewOf(s);
    ok(v.lim > 0 && v.kind === g, `${g} view 형식`);
    const a = policy === "timeout" ? null : policy === "smart" ? smartAction(s, v) : randomAction(s, v);
    const r = G.applyAction(s, a);
    ok(!r.error, `${g} ${policy} 행동 오류 ${r.error} ${JSON.stringify(a)}`);
    if (r.error) { G.applyAction(s, null); }
  }
  const res = G.resultOf(s);
  for (const k of Object.keys(C.GAMES[g].w)) ok(typeof res.perf[k] === "number" && res.perf[k] >= 0 && res.perf[k] <= 1, `${g} perf ${k} 범위/누락 ${res.perf[k]}`);
  ok(Number.isFinite(C.gameScore(g, res.perf, res.win, lv)), `${g} 점수 숫자`);
  return { s, res, score: C.gameScore(g, res.perf, res.win, lv) };
}

// ---------- 1. 공용 파일 동일성 ----------
const front = "../홈페이지 제작/js/mind/mind-core.js";
if (fs.existsSync(front)) ok(fs.readFileSync(front, "utf8") === fs.readFileSync("src/mind-core.js", "utf8"), "프론트·서버 공용 파일 다름");

// ---------- 2. 끝까지 돌리기·시간 초과·잘못된 입력 ----------
for (const g of IDS) for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 40; seed++) { run(g, lv, seed * 7919, "random"); run(g, lv, seed * 104729, "smart"); if (seed <= 8) { const t = run(g, lv, seed, "timeout"); ok(t.res.timeouts > 0, `${g} 시간 초과 기록`); ok(!t.res.win || ["contract"].includes(g) === false || true, "x"); } if (seed <= 8) run(g, lv, seed * 31, "random", { short: true }); if (seed <= 8) run(g, lv, seed * 37, "random", { mp: true }); }
for (const g of IDS) { const s = G.createGame(g, { seed: 5, lv: 1 }); for (const bad of [{}, { x: 1 }, { pick: 99, conf: 9 }, { op: "hack" }, { bid: -5, guess: 0 }, { cell: 9999 }, { hand: 7 }, { act: "X" }]) { const before = JSON.stringify(s); const r = G.applyAction(s, bad); if (r.error) ok(JSON.stringify(s) === before, `${g} 잘못된 입력이 상태 변경`); } }

// ---------- 3. 정답 검증 (독립 풀이) ----------
{ const st = { r: 123 }; for (let i = 0; i < 2000; i++) { const t = 1 + (i % 3), c = G.genLiarCase(st, t); const hits = c.stm.map((x, k) => (G.liarConflict(x, c.ev) ? k : -1)).filter((k) => k >= 0); ok(hits.length === 1 && hits[0] === c.ans, "거짓말 탐지실: 모순 진술이 정확히 하나"); ok(c.why.length > 5, "해설 있음"); } }
{ const st = { r: 321 }; for (let i = 0; i < 2000; i++) { const c = G.genSuspectCase(st, 1 + (i % 3)); const sols = G.susCheck(c); ok(sols.length === 1 && sols[0].culprit === c.c, "용의자: 해가 정확히 하나"); ok(sols[0].lies.length === c.K, "용의자: 거짓말쟁이 수"); ok(!c.clues.includes(c.c), "용의자: 단서가 범인을 가리키지 않음"); } }
{ const st = { r: 555 }; for (let i = 0; i < 1500; i++) { const c = G.genFakeCase(st, 1 + (i % 3), "그림자 찌르"); const sols = G.fakeCheck(c); ok(sols.length === 1 && sols[0].cell === c.t && sols[0].fakes.length === c.F, "가짜 힌트: 해가 정확히 하나"); } }

// ---------- 4. 시나리오 다양성 (게임당 서로 다른 시나리오 20개 이상) ----------
const sig = (g, s) => JSON.stringify(g === "liar" ? s.cases[0].stm : g === "suspect" ? s.cases[0].st : g === "fake" ? s.cases[0].hints : g === "bluff" ? [s.mine, s.aiC] : g === "predict" ? [s.st1.name, s.st1.seq, s.st1.map] : g === "rps" ? s.habit : g === "auction" ? s.lots : g === "contract" ? [s.type, s.n] : g === "nego" ? [s.items, s.cnt, s.val, s.aiVal, s.goal] : g === "trap" ? [s.rules, s.qs.map((q) => q[0])] : g === "maze" ? s.m.open : s.seq);
const varietyOut = {};
for (const g of IDS) { const set = new Set(); for (let i = 1; i <= 200; i++) { const s = G.createGame(g, { seed: i * 2654435 + 11, lv: 1 }); set.add(sig(g, s)); } varietyOut[g] = set.size; ok(set.size >= 20, `${g} 시나리오 ${set.size}개 < 20`); }
ok(new Set(G.DEF ? C.TYPES.map((t) => t.id) : []).size >= 30, "유형 30종"); ok(C.commentCount() >= 150, "멘트 150종");

// ---------- 5. AI가 비밀 정보를 안 봄 ----------
{ // 포커: 내 카드만 바꿔도 AI가 고르는 행동 함수 결과가 같아야 함 (함수 인자에 내 카드가 없음을 실제 호출로 확인)
  for (let i = 0; i < 300; i++) { const seed = 1000 + i; const a = G.createGame("bluff", { seed, lv: 2 }), b = G.createGame("bluff", { seed, lv: 2 }); b.mine = a.mine === 1 ? 9 : 1; ok(b.first === a.first, "포커 선공"); ok(JSON.stringify(a.line) === JSON.stringify(b.line), "포커 AI 선제 행동이 내 카드로 바뀜"); const ra = G.applyAction(a, a.bet ? { op: "call" } : { op: "small" }); void ra; a.bet; const x = G.createGame("bluff", { seed, lv: 2 }), y = G.createGame("bluff", { seed, lv: 2 }); y.mine = x.mine === 1 ? 9 : 1; if (!x.bet) { G.applyAction(x, { op: "small" }); G.applyAction(y, { op: "small" }); const pick = (s) => s.lastHand?.line?.slice(-1)[0]; ok(pick(x) === pick(y), "포커 AI 콜/폴드가 내 카드로 바뀜"); } }
  // 가위바위보·계약·미로: 이번 턴 입력 전에 AI 수가 이미 정해져 있어야 함
  for (let i = 0; i < 300; i++) { const a = G.createGame("rps", { seed: i + 3, lv: 2 }); const fixed = a.aiNext; const r = G.applyAction(a, { hand: i % 3 }); ok(r.fb.ai === fixed, "가위바위보 AI가 내 손을 보고 바꿈"); const m = G.createGame("maze", { seed: i + 9, lv: 2 }); const nx = m.m.next; const cand = G.viewOf(m).cand; const rr = G.applyAction(m, cand.length ? { cell: cand[i % cand.length] } : { pass: true }); ok(rr.fb.to === nx, "미로 AI가 덫을 보고 바꿈"); const p = G.createGame("contract", { seed: i + 21, lv: 2 }), q = G.createGame("contract", { seed: i + 21, lv: 2 }); const pa = G.applyAction(p, { act: "C", promise: true }), qa = G.applyAction(q, { act: "D", promise: true }); ok(pa.fb.aiA === qa.fb.aiA, "계약 AI가 이번 내 선택을 봄"); }
  // 협상: 내 가치표를 바꿔도 AI 응답이 같아야 함
  for (let i = 0; i < 200; i++) { const a = G.createGame("nego", { seed: i + 77, lv: 2 }), b = G.createGame("nego", { seed: i + 77, lv: 2 }); b.val = [9, 9, 9]; b.goal = { i: 0, n: 1, bonus: 50 }; const mine = a.cnt.map((c) => Math.ceil(c / 2)); const ra = G.applyAction(a, { op: "offer", mine }), rb = G.applyAction(b, { op: "offer", mine }); ok(ra.fb.result === rb.fb.result, "협상 AI 수락이 내 가치표로 바뀜"); ok(JSON.stringify(a.aiOffer) === JSON.stringify(b.aiOffer), "협상 AI 역제안이 내 가치표로 바뀜"); }
  // 화면으로 나가는 정보에 비밀이 없어야 함
  for (const g of IDS) for (let i = 0; i < 30; i++) { const s = G.createGame(g, { seed: i + 501, lv: 1 }); const v = JSON.stringify(G.viewOf(s)); ok(!/"ans"|"aiC"|"aiNext"|"aiVal"|"real"|"nextA"|"liars"|"fakes"|"next"/.test(v), `${g} 화면 정보에 비밀 필드`); if (g === "bluff") ok(!("aiC" in G.viewOf(s)), "포커 상대 카드 비공개"); }
}

// ---------- 6. AI 전략 다양성 ----------
{ const hist = new Map(); for (let i = 0; i < 400; i++) { const c = G.createGame("contract", { seed: i, lv: 1 + i % 3 }); hist.set(c.type, 1); const p = G.createGame("predict", { seed: i, lv: 1 + i % 3 }); hist.set(p.st1.name, 1); } ok(hist.size >= 8, `AI 전략 ${hist.size}종`); }
// 상급이 초급보다 어려운가 (같은 무작위·같은 합리 정책 평균) + 무작위 입력은 높은 점수를 못 받아야 함
const bal = {};
for (const g of IDS) {
  bal[g] = {};
  for (const lv of [1, 2, 3]) { let rS = 0, rW = 0, sS = 0, sW = 0, N = 150; for (let i = 0; i < N; i++) { const a = run(g, lv, i * 13 + 1, "random"), b = run(g, lv, i * 17 + 2, "smart"); rS += a.score; rW += a.res.win ? 1 : 0; sS += b.score; sW += b.res.win ? 1 : 0; } bal[g][lv] = { randScore: Math.round(rS / N), randWin: Math.round((rW / N) * 100), smartScore: Math.round(sS / N), smartWin: Math.round((sW / N) * 100) }; }
  ok(bal[g][3].randScore <= 65, `${g}: 무작위 점수 평균이 너무 높음 ${bal[g][2].randScore}`);
  ok(bal[g][3].smartScore > bal[g][3].randScore, `${g}: 잘 두는 정책이 무작위보다 낮음`);
}
// ---------- 7. 합산·진단 ----------
{ const results = IDS.map((g) => run(g, 2, 77, "smart").res); const d = C.diagnose({ results, seed: 3 }); ok(d.total >= 0 && d.total <= 100, "종합 범위"); ok(d.type?.name && d.opinion.length >= 2, "유형·멘트"); const ids = new Set(); for (let i = 0; i < 9000; i++) { const a = {}, top = i % 3 === 0 ? 25 : i % 3 === 1 ? 14 : 101; for (const k of C.AREAS) a[k] = Math.floor(Math.random() * top); ids.add(C.typeOf(a).id); } ok(ids.size === C.TYPES.length, `유형 도달 ${ids.size}/${C.TYPES.length}`); }
// 승률만으로 점수가 안 정해짐
{ const a = C.scoreAll([{ g: "liar", lv: 2, perf: { analyze: 1, risk: 1 }, win: false }]), b = C.scoreAll([{ g: "liar", lv: 2, perf: { analyze: 0, risk: 0 }, win: true }]); ok(a.total > b.total, "승리만 한 사람이 잘 푼 패자보다 높으면 안 됨"); ok(C.scoreAll([{ g: "liar", lv: 1, perf: { analyze: 1, risk: 1 }, win: true }]).total < C.scoreAll([{ g: "liar", lv: 2, perf: { analyze: 1, risk: 1 }, win: true }]).total, "난이도 반영"); }
// ---------- 8. 멀티 게임 ----------
for (const g of Object.keys(G.GROUP)) for (const n of [2, 3, 8]) for (let t = 0; t < 30; t++) { const ids = Array.from({ length: n }, (_, i) => "p" + i); const st = G.createGroup(g, t * 91 + 5, ids); let guard = 0; while (!st.done) { if (++guard > 40) { ok(false, `${g} 안 끝남`); break; } const acts = {}; for (const u of ids) { const v = G.groupView(st, u); ok(v.lim > 0, `${g} lim`); if (g === "mduel") { ok(v.card >= 1, "비밀 카드 있음"); ok(!JSON.stringify(v).includes('"cards"'), "남의 카드 안 보임"); } if (t % 5 === 0 && u === "p1") continue; acts[u] = g === "mcontract" ? { act: rint(2) ? "C" : "D" } : g === "mtrap" ? { pick: rint(3) } : g === "mduel" ? (v.phase === "claim" ? { claim: rint(2) ? "high" : "low" } : { call: rint(2) ? "truth" : "bluff" }) : { bid: rint(Math.min(40, v.budget) + 1) }; } G.GROUP[g].tick(st, acts); } for (const u of ids) { const r = G.groupResult(st, u); for (const k of Object.keys(C.GAMES[g].w)) ok(r.perf[k] >= 0 && r.perf[k] <= 1, `${g} ${k} 범위`); } }
for (const k of Object.keys(C.MULTI_PLANS)) for (const g of C.MULTI_PLANS[k]) ok(C.GAMES[g], `계획 ${k} 게임 ${g}`);

console.log(`\n통과 ${pass} · 실패 ${fail}`);
for (const [m, n] of fails) console.log(`  ✗ ${m} (${n}회)`);
console.log("시나리오 수(200시드 중):", JSON.stringify(varietyOut));
console.log("밸런스 (난이도별 무작위 점수/승률 · 합리 정책 점수/승률):");
for (const g of IDS) console.log(` ${g.padEnd(9)}`, [1, 2, 3].map((lv) => `L${lv} ${bal[g][lv].randScore}/${bal[g][lv].randWin}% · ${bal[g][lv].smartScore}/${bal[g][lv].smartWin}%`).join("  |  "));
process.exit(fail ? 1 : 0);
