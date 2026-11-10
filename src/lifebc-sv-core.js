// 방송국 서바이벌 — 서버 기준 게임 판정. 소켓·DB를 모름(시뮬·시험 공용). 비밀은 viewFor(seat)로만 본인에게 나간다.
import { L, DIFF, METRICS, ROLES, STATION_SIZE, ROLE_ORDER, NPC_NAMES, ACTIONS, PROGRAMS, AGENDAS, RUMORS, REACTIONS, MISSIONS, PUBLIC_GOALS, CONTRACTS, EVIDENCE_KINDS, ENDINGS, LOCATIONS } from "./lifebc-sv-data.js";
import { URGENT, URGENT_BY_ID, LAST_BY_DOOM, PALETTE, CONFLICTS, EMERGENCIES, PROBLEMS } from "./lifebc-sv-events.js";
import { CASES, CASE_BY_ID, ATTRS, QUESTIONS, ANSWERS, makeCase, evText, crimeAct, crimeResult, deduce } from "./lifebc-sv-crime.js";

class RNG { constructor(s) { this.s = s >>> 0 || 1; } next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); } chance(p) { return this.next() < p; } pick(a) { return a[Math.floor(this.next() * a.length)]; } weighted(a, f) { let t = 0; const w = a.map((x) => { const v = Math.max(0, f(x)); t += v; return v; }); if (t <= 0) return null; let r = this.next() * t; for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; } }
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k); // 사용자 값으로 표를 찾을 때 constructor 같은 이름 차단
export const PHASE_SEC = { plan: 40, urgent: 28, urgent_result: 6, emergency: 40, emergency_result: 8, hearing_talk: 35, hearing_vote: 20, hearing_result: 6, election: 18, crime_news: 6, crime_collect: 30, crime_ask: 30, crime_debate: 20, crime_vote: 18, crime_defense: 12, crime_final: 12, crime_result: 10, night: 7 };
const WAIT_ALL = new Set(["plan", "urgent", "emergency", "hearing_talk", "hearing_vote", "election", "crime_collect", "crime_ask", "crime_debate", "crime_vote", "crime_defense", "crime_final", "urgent_result", "emergency_result", "hearing_result", "crime_news", "crime_result", "night"]);
const MISSION_POOL = ["money", "program", "replace", "secret", "truth", "rescue", "ownership", "clean", "coin", "ally", "popular", "driveout"];
const SPY_GOAL = 12, DOOM_COND = { bankrupt: (g) => g.m.money < 0, trust: (g) => g.m.trust < 14, blackout: (g) => g.m.stab < 12, split: (g) => g.m.unity < 13, ads: (g) => g.m.ad < 12, walkout: (g) => g.m.fat > 88 && g.m.unity < 42, chain: (g) => g.streak >= 4, scandal: (g) => g.crimes.unsolvedStreak >= 3 && g.m.trust < 48, mgmt: (g) => g.removed >= 2 && g.m.unity < 36 };

export class SvGame {
  constructor({ players, diff = "hard", seed = Date.now() % 1e9, speed = 1, now = () => Date.now() }) {
    this.R = new RNG(seed); this.seed = seed; this.diffKey = DIFF[diff] ? diff : "hard"; this.D = DIFF[this.diffKey]; this.speed = Math.max(0.6, Math.min(2, +speed || 1)); this.now = now;
    const humans = players.length, n = Math.max(humans, STATION_SIZE(humans)); const order = this.shuffle(ROLE_ORDER.slice(0, n)), names = this.shuffle(NPC_NAMES);
    this.seats = []; for (let i = 0; i < n; i++) { const p = players[i]; this.seats.push({ seat: i, key: p?.key || null, nick: p?.nick || names[i], human: !!p, away: false, left: false, role: order[i], coin: 200, fame: 28 + this.R.int(0, 8), rep: 50, grudge: 0, suspendedUntil: 0, spy: null, action: null, actionTarget: null, stats: { share: 0, rescue: 0, truth: 0, breach: 0, shamed: 0, bribed: 0, votesRight: 0 }, done: false, notes: [], nid: 1, seenRumor: {} }); }
    this.day = 0; this.m = { money: this.D.money, trust: 62, rating: 40, unity: 62, stab: 64, ctrv: 14, fat: 22, ad: 62 }; this.risk = { maint: 0, unpaid: 0, grudge: 0, fans: 0, ads: 0 }; this.debts = []; this.doom = {}; this.lcOffered = {}; this.streak = 0; this.removed = 0; this.chiefImmuneUntil = 0; this.crimes = { total: 0, solved: 0, unsolved: 0, unsolvedStreak: 0, wrong: 0 }; this.crimeChain = 0; this.lastCulprits = []; this.lastAction = {};
    this.queue = []; this.cd = {}; this.flags = {}; this.hist = []; this.feed = []; this.fid = 1; this.h = []; this.rumors = []; this.rid = 1; this.contracts = []; this.ctid = 1; this.evidence = []; this.eid = 1; this.rel = {}; this.petitions = new Set(); this.urgent = null; this.emg = null; this.hearing = null; this.crime = null; this.ending = null; this.highlights = null; this.endTags = []; this.pendEnd = null; this.bigDay = -9; this.nextCrime = this.R.int(5, 7); this.nextEmg = 8 + this.R.int(0, 2); this.lows = { trust: 62, money: this.m.money, unity: 62 }; this.maxRating = { v: 40, day: 1 }; this.programLog = { bold: 0 }; this.rev = 1; this.crimeLog = []; this.phase = { name: "lobby", ends: 0 };
    this.assign();
  }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = this.R.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  humans() { return this.seats.filter((s) => s.human && !s.left); }
  live() { return this.seats.filter((s) => !s.left); }
  find(role) { return this.live().find((s) => s.role === role) || null; }
  director() { return this.find("director") || this.live()[0]; }
  relKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
  relOf(a, b) { return this.rel[this.relKey(a, b)] || 0; }
  addRel(a, b, v) { const k = this.relKey(a, b); this.rel[k] = clamp((this.rel[k] || 0) + v, -100, 100); }
  highlight(t, o) { this.h.push({ t, day: this.day, ...o }); }
  news(text, vars, tone = "news", kind = "news") { this.feed.push({ id: this.fid++, day: this.day, kind, tone, text, vars: vars || null }); if (this.feed.length > 120) this.feed.shift(); }
  privateNote(seat, text, vars) { const s = this.seats[seat]; if (!s) return; s.notes.push({ id: s.nid++, day: this.day, text, vars: vars || null }); if (s.notes.length > 40) s.notes.shift(); }
  score(seat, k, n = 1) { const s = this.seats[seat]; if (s?.stats[k] != null) s.stats[k] += n; }
  stationScale() { return 6 / Math.max(6, this.live().length); }
  actionScale(A) { if (A.roles?.[0] === "cast") return Math.min(1, 2 / Math.max(1, this.live().filter((s) => s.role === "cast").length)); if (!A.roles) return this.stationScale(); return Math.pow(this.stationScale(), 0.7); }

  // ---------- 지표 변화: 나쁜 쪽은 난이도 배율, 좋은 쪽은 회복 배율 ----------
  apply(d, mult = 1, raw = false) { const m = this.m, D = this.D; for (const k in d || {}) { if (!(k in m)) continue; let v = (d[k] || 0) * mult; if (!v) continue; const harmful = METRICS[k].inv ? v > 0 : v < 0; if (!raw) v *= harmful ? D.sev * (1 + 0.3 * this.sizeK()) : D.rec; if (k === "money") m.money = Math.round(m.money + v); else m[k] = clamp(m[k] + v); } }
  sizeK() { const n = this.live().length; return n <= 6 ? 0 : n <= 8 ? 1 : Math.max(0.55, 1 - 0.065 * (n - 8)); }
  applyRisk(r) { for (const k in r || {}) this.risk[k] = Math.min(4, (this.risk[k] || 0) + r[k]); }
  clearRisk(r) { for (const k in r || {}) this.risk[k] = Math.max(0, (this.risk[k] || 0) - r[k]); }

  // ---------- 역할·미션 ----------
  assign() {
    const n = this.seats.length, nSpy = n >= 9 ? 2 : n >= 3 ? 1 : 0, eligible = this.shuffle(this.seats.filter((s) => s.role !== "director")).slice(0, nSpy); for (const s of eligible) s.spy = { pts: 0, heat: 0, exposed: false };
    const pool = this.shuffle(MISSION_POOL); let i = 0; for (const s of this.seats) { s.mission = this.makeMission(s, pool[i++ % pool.length]); s.publicGoal = PUBLIC_GOALS[s.role]; }
  }
  makeMission(s, id) { const M = MISSIONS[id], o = { id, target: null, swapped: false }; if (M.needTarget) { const t = this.R.pick(this.seats.filter((x) => x.seat !== s.seat)); o.target = t.seat; } return o; }
  missionDone(s) { const M = s.mission, g = this, t = M.target != null ? g.seats[M.target] : null; switch (M.id) { case "ally": return g.relOf(s.seat, M.target) >= 40; case "money": return g.m.money >= 3500; case "program": return (g.programLog.bold || 0) >= 3; case "replace": return g.removed >= 1 && g.hearingYes?.has(s.seat); case "popular": return s.fame > t.fame; case "secret": return g.contracts.some((c) => c.parties.includes(s.seat) && !c.public && !c.exposed && c.st !== "broken" && (c.endDay ?? g.day) - c.day >= 5); case "truth": return s.stats.truth >= 2; case "rescue": return s.stats.rescue >= 3; case "ownership": return s.role === "director"; case "driveout": return t.rep <= 25; case "clean": return s.stats.breach === 0 && s.stats.shamed === 0; case "coin": return s.coin >= 500; default: return s.rep >= 50; } }
  missionImpossible(s) { const M = s.mission, t = M.target != null ? this.seats[M.target] : null; if (t?.left) return true; if (M.id === "replace" && this.day >= 27 && this.removed === 0) return true; if (M.id === "secret" && this.day >= 25 && !this.contracts.some((c) => c.parties.includes(s.seat) && !c.public && c.st === "on")) return true; if (M.id === "clean" && (s.stats.breach || s.stats.shamed)) return true; return false; }

  // ---------- 흐름 ----------
  setPhase(name, extra = {}) { const sec = (PHASE_SEC[name] || 20) * this.speed; this.phase = { name, ends: this.now() + sec * 1000, sec, ...extra }; for (const s of this.seats) s.done = false; this.rev++; this.afterPhaseStart?.(name); this.npcPhase(name); }
  start() { this.startedAt = this.now(); this.nextDay(); }
  nextDay() {
    this.day++; this.h.push({ t: "day", day: this.day }); for (const s of this.seats) { s.action = null; s.actionTarget = null; s.done = false; } this.today = { agenda: this.R.pick(AGENDAS.filter((a) => (this.cd[a.id] ?? -99) + 6 <= this.day)) || AGENDAS[0], votes: {}, program: null, statements: {} }; this.cd[this.today.agenda.id] = this.day; this.todayIncident = null;
    this.spawnRumor(); this.reactions(); this.setPhase("plan");
  }
  spawnRumor() { if (this.day < 2 || !this.R.chance(0.42)) return; const open = this.rumors.filter((r) => r.st === "open"); if (open.length >= 2) return; const T = this.R.pick(RUMORS.filter((x) => !this.rumors.some((r) => r.tpl === x.id && this.day - r.day < 10)) || RUMORS); if (!T) return; let p = 0.34; if (T.id === "r_pay" && this.risk.unpaid) p = 0.85; if (T.id === "r_quit" && this.m.fat > 60) p = 0.75; if (T.id === "r_rival" && this.seats.some((s) => s.spy && s.spy.pts > 0)) p = 0.8; if (T.id === "r_fight" && this.m.unity < 45) p = 0.75; const u = this.R.next(); const truth = u < p ? "true" : this.R.chance(0.45) ? "false" : this.R.chance(0.5) ? "forged" : "mis"; const r = { id: this.rid++, tpl: T.id, text: T.t, key: T.key, truth, day: this.day, st: "open", heat: 2, verified: false, mode: null }; this.rumors.push(r); this.news(T.t, null, "rumor", "rumor"); }
  reactions() { const m = this.m, tone = m.ctrv > 55 || m.trust < 40 ? "bad" : m.trust > 65 && m.ctrv < 30 ? "good" : "mid"; const a = REACTIONS[tone]; this.news(this.R.pick(a), null, tone, "comment"); if (this.R.chance(0.5)) this.news(this.R.pick(REACTIONS[this.R.chance(0.6) ? tone : "mid"]), null, tone, "comment"); }

  // ---------- 틱·조기 종료 ----------
  tick() { const n = this.now(); if (this.phase.name === "over" || this.phase.name === "lobby") return false; if (n >= this.phase.ends) { this.endPhase(); return true; } return false; }
  allDone() { const list = this.humans().filter((s) => !s.away); if (!list.length) return true; const nm = this.phase.name; if (nm === "crime_defense") { const a = this.seats[this.crime?.accused]; return !a?.human || a.away || !!this.crime.defense; } if (nm === "crime_final") return list.every((s) => s.seat === this.crime.accused || this.crime.finals[s.seat] !== undefined); if (nm === "crime_vote") return list.every((s) => this.crime.votes[s.seat] !== undefined); if (nm === "hearing_vote") return list.every((s) => s.seat === this.hearing.chief || this.hearing.votes[s.seat] !== undefined); if (nm === "election") return list.every((s) => this.hearing.elect[s.seat] !== undefined); return list.every((s) => s.done); }
  checkEarly() { if (!this.humans().some((s) => !s.away)) return; if (WAIT_ALL.has(this.phase.name) && this.allDone()) { const left = this.phase.ends - this.now(); if (left > 700) { this.phase.ends = this.now() + 700; this.rev++; } } }
  endPhase() {
    const nm = this.phase.name;
    switch (nm) {
      case "plan": this.resolvePlan(); return this.afterPlan();
      case "urgent": this.resolveUrgent(); return this.setPhase("urgent_result");
      case "urgent_result": return this.afterIncident();
      case "emergency": this.resolveEmg(); return this.setPhase("emergency_result");
      case "emergency_result": return this.afterIncident();
      case "crime_news": return this.setPhase("crime_collect");
      case "crime_collect": return this.setPhase("crime_ask");
      case "crime_ask": return this.setPhase("crime_debate");
      case "crime_debate": return this.setPhase("crime_vote");
      case "crime_vote": return this.tallyCrime();
      case "crime_defense": return this.setPhase("crime_final");
      case "crime_final": return this.tallyFinal();
      case "crime_result": this.crime = null; return this.afterIncident();
      case "hearing_talk": return this.setPhase("hearing_vote");
      case "hearing_vote": return this.tallyHearing();
      case "hearing_result": if (this.hearing?.passed) return this.setPhase("election"); this.hearing = null; return this.afterIncident();
      case "election": this.tallyElection(); this.hearing = null; return this.afterIncident();
      case "night": return this.ending ? null : this.pendEnd ? this.finish(this.pendEnd) : this.nextDay();
    }
  }

  // ---------- 하루 계획 처리 ----------
  resolvePlan() {
    const f = this.stationScale();
    for (const s of this.live()) { if (s.action) continue; if (s.human && !s.away) { s.action = "rest"; } else this.npcAction(s); }
    if (!this.today.program) this.today.program = this.npcProgram();
    for (const s of this.live()) this.doAction(s, f);
    // 안건: 다수결 (국장 2표), 동률이면 현상 유지(마지막 선택지)
    const A = this.today.agenda, c = A.o.map(() => 0); for (const s of this.live()) { let v = this.today.votes[s.seat]; if (v == null) { if (s.human && !s.away) continue; v = this.npcAgenda(A); } c[v] += s.human && this.humans().length === 1 ? 3 : s.role === "director" ? 2 : 1; } const top = Math.max(...c), win = c.indexOf(top) === c.lastIndexOf(top) ? c.indexOf(top) : A.o.length - 1; const O = A.o[win]; this.today.agendaResult = win; this.apply(O.d || {}); this.applyRisk(O.risk); this.clearRisk(O.clear); if (O.flag) this.flags[O.flag] = 1; if (O.debt) this.debts.push({ day: this.day + 5, v: O.debt });
    this.resolveStatements();
    for (const s of this.live()) { const a = ACTIONS[s.action]; this.lastAction[s.seat] = { id: s.action, loc: a?.loc || "lounge" }; }
    this.today.prog = PROGRAMS[this.today.program] || PROGRAMS.normal;
    this.boldRun = this.today.program === "bold" ? (this.boldRun || 0) + 1 : 0; if (this.boldRun >= 2) { const n = Math.min(4, this.boldRun - 1); this.apply({ ctrv: 3 * n, fat: 2 * n, stab: -2 * n, trust: -1 * n }); this.applyRisk({ maint: n >= 2 ? 1 : 0, fans: n >= 2 ? 1 : 0 }); }
    const P = this.today.prog; this.apply({ rating: P.rating, stab: P.stab, fat: P.fat, ctrv: P.ctrv, trust: P.trust || 0, ad: P.ad || 0 }, 1); if (this.today.program === "bold" && this.m.stab >= 30) this.programLog.bold++;
  }
  doAction(s, f) {
    const id = s.action, A = ACTIONS[id]; if (!A) return;
    if (A.coin && s.coin + A.coin < 0) { s.action = "rest"; return this.doAction(s, f); }
    if (A.coin) s.coin += A.coin;
    f = this.actionScale(A); const scaled = {}; for (const k in A.d) scaled[k] = k === "money" ? A.d[k] : A.d[k] * f * (k === "rating" ? 0.4 : 1); this.apply(scaled, 1, true); this.clearRisk(A.clear); if (A.flag) this.flags[A.flag] = 1; if (A.fame) s.fame = clamp(s.fame + A.fame);
    if (id === "network" && s.actionTarget != null) { this.addRel(s.seat, s.actionTarget, 14); s.rep = clamp(s.rep + 1); }
    if (id === "investigate" || id === "audit") this.investigate(s, id);
    if (id === "monitor") { const r = this.rumors.find((x) => x.st === "open"); if (r) this.privateNote(s.seat, L("모니터링 결과: '{k}'{v}", "モニタリング結果：'{k}'{v}", "Monitoring: '{k}'{v}"), { k: r.key, v: r.truth === "true" ? L(" 근거 있음", " 根拠あり", " has substance") : L(" 근거 약함", " 根拠薄い", " looks weak") }); }
    if (id === "revenge" && s.grudge > 0 && s.actionTarget != null) { const t = this.seats[s.actionTarget]; s.grudge--; t.rep = clamp(t.rep - 18); t.stats.shamed++; s.rep = clamp(s.rep + 8); this.addRel(s.seat, t.seat, -15); this.news(L("[단독] {a}, {b}의 과거 내부 비리 폭로", "[独占] {a}、{b}の過去の内部不正を暴露", "[Exclusive] {a} exposes {b}'s past misconduct"), { a: s.nick, b: t.nick }, "bad"); this.highlight("betray", { a: s.seat, b: t.seat, size: 16, revenge: 1 }); }
    if (id === "spy_leak" && s.spy) { s.spy.pts += 1; s.spy.heat += 2; s.coin += 70; if (this.R.chance(0.4)) this.addHidden(s.seat, "chat", true, L("경쟁사 측과 주고받은 메시지", "競合とやり取りしたメッセージ", "Messages exchanged with the rival"), "spy"); this.highlight("spy", { a: s.seat }); }
    if (id === "spy_deal" && s.spy) { s.spy.pts += 2; s.spy.heat += 3; s.coin += 110; if (this.R.chance(0.6)) this.addHidden(s.seat, "contract", true, L("경쟁사 측 광고 계약 초안", "競合側の広告契約草案", "A rival-side ad contract draft"), "spy"); this.highlight("spy", { a: s.seat }); }
    if (id === "spy_lay" && s.spy) { s.spy.heat = Math.max(0, s.spy.heat - 3); if (this.R.chance(0.5)) this.evidence = this.evidence.filter((e) => !(e.about === s.seat && e.hold == null)); }
    if (id === "spy_exec" && s.spy && !s.spy.exposed && s.spy.pts >= SPY_GOAL && this.m.rating >= 35 && this.m.money > 0) { this.endTags.push("spy"); this.spyWinner = s.seat; this.pendEnd = "spy"; }
  }
  addHidden(about, kind, truth, title, tag) { const e = { id: this.eid++, kind, about, truth, title, tag, hold: null, day: this.day, checked: null, published: false }; this.evidence.push(e); return e; }
  investigate(s, id) {
    const pool = this.evidence.filter((e) => e.hold == null && e.about !== s.seat && (id !== "audit" || e.kind === "ledger" || e.kind === "contract")); const p = pool.length ? 0.7 : 0;
    if (this.R.chance(p)) { const e = this.R.pick(pool); e.hold = s.seat; this.privateNote(s.seat, L("증거 확보: {t}", "証拠確保：{t}", "Evidence found: {t}"), { t: e.title }); return; }
    if (this.R.chance(0.3)) { const t = this.R.pick(this.live().filter((x) => x.seat !== s.seat)); const e = this.addHidden(t.seat, "tip", false, L("{n}에 관한 익명 제보", "{n}に関する匿名情報", "Anonymous tip about {n}"), "tip"); e.vars = { n: t.nick }; e.hold = s.seat; this.privateNote(s.seat, L("익명 제보를 받았다. 진짜인지는 모른다.", "匿名情報が届いた。本物かは不明。", "You got an anonymous tip. It may not be real.")); return; }
    this.privateNote(s.seat, L("오늘은 쓸 만한 걸 찾지 못했다.", "今日は使えるものが見つからなかった。", "Nothing useful today."));
  }
  resolveStatements() {
    for (const r of this.rumors.filter((x) => x.st === "open")) {
      const mode = r.mode || (this.day - r.day >= 1 ? this.npcStatement(r) : null); r.heat = Math.min(6, r.heat + (mode ? 0 : 1)); if (!mode) continue; r.mode = null; const T = r.truth;
      if (mode === "verify") { if (r.verified) continue; r.verified = true; this.apply({ money: -60 }); this.news(L("[공식] 플듀 방송국 '해당 소문 확인 결과: {v}'", "[公式] プルドゥ放送局「該当の噂の確認結果：{v}」", "[Official] PlayDuo Station on the rumor: '{v}'"), { v: T === "true" ? L("일부 사실", "一部事実", "partly true") : T === "forged" ? L("조작된 자료", "捏造された資料", "forged material") : T === "mis" ? L("오해에서 시작", "誤解から始まった", "began as a misunderstanding") : L("사실 무근", "事実無根", "baseless") }, "official", "official"); if (T !== "true") { this.apply({ ctrv: -5, trust: 3 }); r.st = "closed"; } continue; }
      r.st = "closed"; let d;
      if (mode === "admit") d = T === "true" ? { trust: -3, ctrv: -7 } : { trust: -9, ctrv: 9, unity: -3 };
      else if (mode === "deny") d = T === "true" ? { trust: -10, ctrv: 12 } : r.verified ? { trust: 3, ctrv: -5 } : T === "forged" ? { trust: 2, ctrv: -3 } : { ctrv: -4 };
      else d = T === "true" ? { ctrv: 7, trust: -5 } : T === "mis" ? { ctrv: 3 } : { ctrv: -1 }; // 무시
      this.apply(d); this.news(mode === "admit" ? L("[공식] 방송국, 논란 인정하고 사과", "[公式] 放送局、騒動を認め謝罪", "[Official] Station admits and apologizes") : mode === "deny" ? L("[공식] 방송국 '사실 아니다' 부인", "[公式] 放送局「事実でない」と否定", "[Official] Station denies the claim") : L("[기자수첩] 방송국, 소문에 묵묵부답", "[記者手帳] 局は噂に沈黙", "[Column] Station stays mum on rumor"), null, "official", "official"); if (mode === "deny" && T === "true") { this.news(L("[후속] 부인했던 소문, 증거로 사실 확인… 거센 비판", "[続報] 否定した噂が証拠で事実と判明…激しい批判", "[Follow-up] Denied rumor proven true; backlash grows"), null, "bad"); this.highlight("accident", { size: 20, name: r.key }); }
    }
    for (const r of this.rumors.filter((x) => x.st === "open" && this.day - x.day >= 3)) { r.st = "closed"; this.apply({ ctrv: r.truth === "true" ? 6 : 1 }); }
  }

  // ---------- 오늘의 사건 고르기: 매일 대형 사고가 되지 않게 ----------
  afterPlan() {
    const due = this.queue.findIndex((q) => q.day <= this.day);
    const lastK = Object.keys(this.doom).find((k) => this.doom[k] >= 1 && this.lcOffered[k] !== this.day && (this.lcOffered[k] ?? -9) + 2 <= this.day);
    if (lastK) { this.lcOffered[lastK] = this.day; const id = LAST_BY_DOOM[lastK] || "lc_chain"; return this.startUrgent(URGENT_BY_ID[id]); }
    if (this.reopenCase && this.reopenCase.day <= this.day) { const q = this.reopenCase; this.reopenCase = null; return this.startCrime(CASE_BY_ID[q.id], { reopen: true, exclude: new Set([q.accused]), forceInsider: q.insider, wrongPrev: q.accused }); }
    if (this.day >= this.nextCrime && this.bigDay !== this.day - 1) { const nx = this.chainCase; this.chainCase = null; const def = nx ? CASE_BY_ID[nx] : this.R.pick(CASES.filter((c) => !this.crimeLog.some((l) => l.id === c.id))) || this.R.pick(CASES); return this.startCrime(def, {}); }
    if (due >= 0) { const q = this.queue.splice(due, 1)[0]; const ev = URGENT_BY_ID[q.id]; if (ev) return this.startUrgent(ev); }
    if (this.day >= this.nextEmg && this.bigDay !== this.day - 1 && this.R.chance(0.4 + this.pressure() * 0.6)) { const def = this.R.pick(EMERGENCIES.filter((x) => x.min <= this.day && !this.cd[x.id])); if (def) { this.nextEmg = this.day + this.R.int(5, 7); this.cd[def.id] = this.day; return this.startEmg(def); } }
    const early = this.day < 8 ? 0.55 : this.day > 20 ? 1.2 : 1; const restDay = this.bigDay === this.day - 1; const p = restDay ? 0.12 : this.D.urgent * early * (0.72 + this.pressure() * 0.75);
    if (this.day >= 3 && this.R.chance(p)) { const ev = this.pickUrgent(); if (ev) return this.startUrgent(ev); }
    if (this.hearingQ) return this.openHearing();
    return this.toNight();
  }
  pressure() { const m = this.m; return clamp(((100 - m.trust) + (100 - m.unity) + (100 - m.stab) + m.ctrv + m.fat + (100 - m.ad)) / 600, 0, 1); }
  pickUrgent() { const list = URGENT.filter((e) => !e.chainOnly && !e.last && this.day >= e.min && this.day <= e.max && (this.cd[e.id] ?? -99) + e.cd <= this.day && (!e.when || e.when(this))); return this.R.weighted(list, (e) => e.w * (e.tech && this.flags.backup ? 0.5 : 1) * (e.tech && this.m.stab > 62 ? 0.5 : 1)); }
  leadOf(ev) { const d = this.find(ev.lead) || this.director(); if (d.human && !d.away) return d; const hs = this.humans().filter((s) => !s.away); if (!hs.length) return d; this.leadCount = this.leadCount || {}; const m = hs.slice().sort((a, b) => (this.leadCount[a.seat] || 0) - (this.leadCount[b.seat] || 0) || a.seat - b.seat)[0]; this.leadCount[m.seat] = (this.leadCount[m.seat] || 0) + 1; return m; }
  startUrgent(ev) { this.cd[ev.id] = this.day; const lead = this.leadOf(ev); this.urgent = { id: ev.id, ev, lead: lead.seat, pick: null, tags: {}, res: null, sev: 1 }; this.todayIncident = "urgent"; this.news(ev.n, null, "breaking", "breaking"); this.setPhase("urgent"); }
  resolveUrgent() {
    const U = this.urgent, ev = U.ev, lead = this.seats[U.lead]; const timeout = U.pick == null && lead.human && !lead.away;
    if (U.pick == null) U.pick = timeout ? ev.ch.length - 1 : this.npcPick(ev);
    for (const s of this.live()) { if (s.seat === U.lead || U.tags[s.seat]) continue; if (s.human && !s.away) { this.crisisMiss(s); continue; } U.tags[s.seat] = this.npcTag(s, ev); }
    const ch = ev.ch[U.pick], o = ch[3] || {}, before = { ...this.m }; let tagScore = 0, conflicts = 0; const tags = Object.values(U.tags); for (const t of tags) tagScore += ev.fit[t] || 0; for (const [a, b] of CONFLICTS) if (tags.includes(a) && tags.includes(b)) conflicts++;
    const cnt = Math.max(1, tags.length), norm = clamp(Math.round(tagScore / Math.sqrt(cnt)), -4, 4), inj = tags.filter((t) => t === "inject").length, setl = tags.filter((t) => t === "settle").length; if (inj) this.apply({ money: -120 * Math.min(2, inj) }); if (setl) this.apply({ money: -80 * Math.min(2, setl) });
    const backup = ev.tech && this.flags.backup; if (backup) this.flags.backup = 0;
    this.apply(ch[1], backup ? 0.5 : 1); this.applyRisk(o.risk); this.clearRisk(o.clear); if (o.debt) this.debts.push({ day: this.day + 5, v: o.debt });
    if (norm) this.apply(norm > 0 ? { trust: norm * 1.5, ctrv: -norm * 2, unity: norm } : { trust: norm * 1.5, ctrv: -norm * 2, unity: norm }); if (conflicts) this.apply({ unity: -3 * conflicts, ctrv: 2 * conflicts });
    let rollOk = null; if (o.roll) { const r = o.roll, st = r.k === "money" ? this.m.money / 40 : this.m[r.k], pv = clamp((r.inv ? r.th - st : st - r.th) / 45 + 0.5 + norm * 0.06, 0.1, 0.92); rollOk = this.R.chance(pv); this.apply(rollOk ? r.good : r.bad); if (!rollOk && r.nextBad) this.queueNext(r.nextBad); }
    if (o.next) this.queueNext(o.next); if (o.end) { this.pendEnd = o.end; this.endTags.push(o.end); }
    if (o.clearStreak) this.streak = 0; if (o.clearCrime) { this.crimes.unsolvedStreak = 0; this.crimeChain = 0; this.chainCase = null; }
    if (o.rescue) { for (const s of this.live()) if (U.tags[s.seat] || s.seat === U.lead) if (s.human || s.seat === U.lead) { this.score(s.seat, "rescue", s.seat === U.lead ? 1 : 0.34); } this.highlight("rescue", { a: U.lead, name: ev.n }); }
    const delta = {}; for (const k in this.m) delta[k] = Math.round(this.m[k] - before[k]); const harm = -delta.trust * 1.2 - delta.unity - delta.stab - delta.ad + delta.ctrv + delta.fat * 0.5 - delta.money / 60; const failed = timeout || rollOk === false || harm > 16;
    if (failed) this.streak++; else if (harm < 4) this.streak = Math.max(0, this.streak - 1); if (harm > 12) this.highlight("accident", { size: Math.round(harm), name: ev.n }); if (delta.money < -250) this.highlight("loss", { size: -delta.money, name: ev.n });
    U.res = { pick: U.pick, text: ch[2], delta, tagScore: norm, conflicts, timeout, rollOk, backup: !!backup }; this.news(L("[후속] {n}: 대응 {r}", "[続報] {n}：対応{r}", "[Follow-up] {n}: response {r}"), { n: ev.n, r: failed ? L("실패", "失敗", "failed") : L("수습", "収拾", "held") }, failed ? "bad" : "good"); this.bigDay = ev.group === "last" ? this.bigDay : this.bigDay;
  }
  crisisMiss(s) { for (const c of this.contracts) if (c.type === "crisis" && c.st === "on" && c.parties.includes(s.seat)) this.breach(c, s.seat, "auto"); }
  queueNext(a) { if (!a) return; this.queue.push({ id: a[0], day: this.day + a[1] }); }
  afterIncident() { if (this.hearingQ && !this.hearing) return this.openHearing(); return this.toNight(); }

  // ---------- 비상사태 ----------
  startEmg(def) { this.bigDay = this.day; this.emg = { def, assign: {}, gambit: false, res: null }; this.todayIncident = "emergency"; this.news(def.n, null, "breaking", "breaking"); this.setPhase("emergency"); }
  resolveEmg() {
    const E = this.emg, def = E.def, before = { ...this.m }, n = this.live().length, tokens = {}; for (const k of def.probs) tokens[k] = 0;
    for (const s of this.live()) { let p = E.assign[s.seat]; if (p == null) { if (s.human && !s.away) continue; p = this.npcEmg(s, def, E); E.assign[s.seat] = p; } tokens[p] += s.role === "director" ? 2 : 1; }
    let solved = []; const order = def.probs.slice().sort((a, b) => tokens[b] / PROBLEMS[b].need - tokens[a] / PROBLEMS[a].need); let budget = this.m.money; const sv = (k) => { solved.push(k); this.apply(PROBLEMS[k].ok); };
    for (const k of order) { const P = PROBLEMS[k], need = Math.max(1, Math.ceil(P.need * n)); if (tokens[k] >= need && budget >= P.cost) { budget -= P.cost; this.apply({ money: -P.cost }); sv(k); for (const s of this.live()) if (E.assign[s.seat] === k) this.score(s.seat, "rescue", 1 / Math.max(1, tokens[k]) * need * 0.8); } }
    if (E.gambit) { const G = def.gambit; this.apply(G.d); if (G.debt) this.debts.push({ day: this.day + 6, v: G.debt }); let left = G.solve; for (const k of def.probs) { if (left <= 0) break; if (!solved.includes(k)) { sv(k); left--; } } }
    const unsolved = def.probs.filter((k) => !solved.includes(k)); for (const k of unsolved) { this.apply(PROBLEMS[k].no); if (def.nextOf?.[k]) this.queue.push({ id: def.nextOf[k], day: this.day + 2 + this.R.int(0, 1) }); }
    const delta = {}; for (const k in this.m) delta[k] = Math.round(this.m[k] - before[k]); if (unsolved.length >= def.probs.length - 1) this.streak++; else if (solved.length >= 2) this.streak = Math.max(0, this.streak - 1); this.highlight("accident", { size: unsolved.length * 12 + 6, name: def.n }); E.res = { solved, unsolved, tokens, delta, gambit: E.gambit }; this.news(L("[비상] {n}: {a}건 수습, {b}건 미해결", "[非常] {n}：{a}件収拾、{b}件未解決", "[Emergency] {n}: {a} handled, {b} unresolved"), { n: def.n, a: solved.length, b: unsolved.length }, unsolved.length > solved.length ? "bad" : "good");
  }

  // ---------- 범인 찾기 ----------
  startCrime(def, opts) {
    this.crime = makeCase(this, def, opts); this.bigDay = this.day; this.todayIncident = "crime"; const c = this.crime; this.crimes.total++; this.nextCrime = 1e9; this.crimeLog.push({ id: def.id, day: this.day, c: c.culprit, acc: c.accomplice, out: c.outsider, name: def.n, motive: def.motive, outsiderText: def.outsider, res: null, accused: null, reopen: !!opts.reopen });
    if (c.culprit != null) { this.lastCulprits = [...this.lastCulprits.slice(-1), c.culprit]; this.privateNote(c.culprit, L("당신은 이번 사건의 범인입니다. 정체를 숨기고 수사를 피하세요.", "あなたは今回の事件の犯人です。正体を隠して捜査を逃れてください。", "You are the culprit of this case. Hide your identity and evade the investigation.")); }
    if (c.accomplice != null) this.privateNote(c.accomplice, L("당신은 공범입니다. 범인은 {n}. 끝까지 도울지 배신할지는 당신의 선택입니다.", "あなたは共犯です。犯人は{n}。助けるか裏切るかはあなた次第。", "You are the accomplice. The culprit is {n}. Help or betray: your choice."), { n: this.seats[c.culprit].nick });
    this.news(def.n, null, "breaking", "breaking"); this.setPhase("crime_news");
  }
  npcAnswer(a) { const c = this.crime, crook = c.culprit === a.target || c.accomplice === a.target; a.a = crook ? (this.R.chance(0.75) ? "deny" : "refuse") : this.R.chance(0.8) ? "truth" : "deny"; if (crook && a.a === "deny" && this.R.chance(0.22)) { const k = this.R.pick(Object.keys(ATTRS)); c.ev.push({ id: c.nid++, src: "trace", attr: k, val: c.target[k], kind: "true", by: new Set(), shared: true }); } }
  npcOffer(o) { const c = this.crime; if (this.R.chance(0.35)) { const f = this.seats[o.from], s = this.seats[o.to]; if (f.coin >= o.coin) { f.coin -= o.coin; s.coin += o.coin; o.st = "ok"; return; } } o.st = "no"; }
  crimeSeen(s) { const c = this.crime; return c.ev.filter((e) => e.shared || e.by.has(s.seat)); }
  npcCrimeVote(s) {
    const c = this.crime, list = this.live(); if (c.culprit === s.seat || c.accomplice === s.seat) { const scape = list.filter((x) => x.seat !== c.culprit && x.seat !== c.accomplice); return this.R.chance(0.35) ? "out" : this.R.pick(scape)?.seat ?? "none"; }
    const humanV = Object.entries(c.votes).filter(([k, v]) => this.seats[k].human && v !== "none").map(([, v]) => v), follow = humanV.length && this.R.chance(this.humans().length <= 2 ? 0.72 : 0.42); if (follow) return this.R.pick(humanV);
    const { n, full } = deduce(c, list, this.crimeSeen(s)), clash = new Set(c.checks.filter((x) => x.verdict === "clash").map((x) => x.target)); if (n === 0) return this.R.chance(0.6) ? "none" : "out"; if (!full.length) return this.R.chance(0.72) ? "out" : "none"; if (full.length === 1) return this.R.chance(0.84) ? full[0].seat : "none"; const hot = full.filter((x) => clash.has(x.seat)); if (hot.length) return this.R.pick(hot).seat; return n >= 3 && this.R.chance(0.4) ? this.R.pick(full).seat : "none";
  }
  tallyCrime() {
    const c = this.crime; for (const s of this.live()) if (c.votes[s.seat] === undefined && (!s.human || s.away)) c.votes[s.seat] = this.npcCrimeVote(s);
    const count = {}; for (const k in c.votes) { const v = c.votes[k]; if (v === "none") continue; count[v] = (count[v] || 0) + 1; } const rows = Object.entries(count).sort((a, b) => b[1] - a[1]); c.tally = count; if (!rows.length || (rows[1] && rows[0][1] === rows[1][1])) { c.verdict = "hung"; return this.closeCrime(); }
    if (rows[0][0] === "out") { c.verdict = "out"; return this.closeCrime(); }
    c.accused = +rows[0][0]; const log = this.crimeLog[this.crimeLog.length - 1]; log.accused = c.accused; this.setPhase("crime_defense");
  }
  tallyFinal() { const c = this.crime; for (const s of this.live()) if (s.seat !== c.accused && c.finals[s.seat] === undefined && (!s.human || s.away)) { const voted = c.votes[s.seat] === c.accused, def = c.defense && c.defense.kind !== "plead"; c.finals[s.seat] = c.culprit === s.seat || c.accomplice === s.seat ? "guilty" : this.R.chance(voted ? (def ? 0.68 : 0.85) : (def ? 0.2 : 0.4)) ? "guilty" : "innocent"; } const v = Object.values(c.finals), g = v.filter((x) => x === "guilty").length; c.verdict = g > v.length - g ? "guilty" : "acquit"; if (c.verdict === "acquit") c.verdictAcquit = true; this.closeCrime(); }
  endCaseEarly() { this.closeCrime(); }
  closeCrime() {
    const c = this.crime, r = crimeResult(this), before = { ...this.m }, S = c.scale, log = this.crimeLog[this.crimeLog.length - 1], cul = c.culprit != null ? this.seats[c.culprit] : null, acc = c.accomplice != null ? this.seats[c.accomplice] : null, acd = c.accused != null ? this.seats[c.accused] : null;
    const penal = (x, rep, coin) => { x.rep = clamp(x.rep - rep); x.coin = Math.max(0, x.coin - coin); x.suspendedUntil = this.day + 2; x.grudge++; x.stats.shamed++; };
    const solved = () => { this.crimes.solved++; this.crimes.unsolvedStreak = 0; this.crimeChain = 0; this.chainCase = null; };
    const unsolved = () => { this.crimes.unsolved++; this.crimes.unsolvedStreak++; this.crimeChain++; };
    const creditTruth = (want) => { for (const s of this.live()) if (c.votes[s.seat] === want) { s.stats.truth++; s.rep = clamp(s.rep + 3); s.stats.votesRight++; } };
    switch (r.kind) {
      case "caught": { const a = this.seats[c.accused]; this.apply({ trust: 8 * S, unity: 5, ctrv: -9 * S }); penal(a, 22, 120); creditTruth(c.accused); if (a === acc && cul) this.news(L("[단독] 공범 검거. 주범은 아직 밝혀지지 않았다", "[独占] 共犯逮捕。主犯はまだ不明", "[Exclusive] Accomplice caught; mastermind still unknown"), null, "bad"); solved(); if (c.wrongPrev != null) this.clearName(c.wrongPrev); this.highlight("reveal", { a: c.accused, name: c.def.n, right: 1 }); break; }
      case "confess": { const a = this.seats[c.confessed]; this.apply({ trust: 3 * S, ctrv: -4 * S, unity: -1 }); penal(a, 9, 40); solved(); if (c.wrongPrev != null) this.clearName(c.wrongPrev); this.highlight("reveal", { a: c.confessed, name: c.def.n, confess: 1 }); break; }
      case "betray": { this.apply({ trust: 6 * S, unity: 2, ctrv: -7 * S }); if (cul) penal(cul, 22, 120); if (acc) { acc.rep = clamp(acc.rep - 3); acc.coin += 80; } solved(); if (c.wrongPrev != null) this.clearName(c.wrongPrev); this.highlight("reveal", { a: c.culprit, name: c.def.n, betrayed: 1 }); break; }
      case "out_right": this.apply({ trust: 6, ctrv: -6, unity: 3 }); creditTruth("out"); this.crimes.solved++; this.crimes.unsolvedStreak = 0; this.chainCase = null; this.crimeChain = 0; this.highlight("reveal", { name: c.def.n, outsider: 1 }); break;
      case "out_wrong": this.apply({ ctrv: 2 }); if (cul) cul.coin += 120; unsolved(); break;
      case "false": case "false_out": { this.apply({ trust: -6 * S, unity: -9 * S, ctrv: 8 * S }); acd.rep = clamp(acd.rep - 15); acd.grudge++; acd.suspendedUntil = this.day + 1; acd.stats.shamed++; if (r.kind === "false" && cul) { cul.coin += 120; if (cul.spy) cul.spy.pts += 2; } this.crimes.wrong++; if (r.kind === "false") unsolved(); this.reopenAvail = { id: c.id, accused: c.accused, insider: !c.outsider, day: this.day }; this.highlight("framed", { a: c.accused, name: c.def.n }); break; }
      case "hung": this.apply({ trust: -3 * S, ctrv: 6 * S, unity: -2 }); if (cul) cul.coin += 60; unsolved(); break;
      case "hung_out": this.apply({ ctrv: 3, trust: -1 }); break;
    }
    if (r.kind === "caught" || r.kind === "confess" || r.kind === "betray" || r.kind === "out_right") c.reveal = true;
    if ((r.kind === "out_wrong" || r.kind === "false" || r.kind === "hung") && c.def.next && !c.outsider) { this.chainCase = c.def.next; this.nextCrime = this.day + 2 + this.R.int(0, 1); } else { this.nextCrime = this.day + Math.round(this.R.int(7, 9) / this.D.crime); }
    // 보호 협약: 상대를 지목했으면 위반
    for (const ct of this.contracts) if (ct.st === "on" && ct.type === "protect") { const [a, b] = ct.parties; if (c.votes[a] === b) this.breach(ct, a, "auto"); else if (c.votes[b] === a) this.breach(ct, b, "auto"); }
    const delta = {}; for (const k in this.m) delta[k] = Math.round(this.m[k] - before[k]); c.res = { ...r, delta, tally: c.tally || {}, finals: c.finals }; log.res = r.kind; this.setPhase("crime_result");
  }
  clearName(seat) { const s = this.seats[seat]; s.rep = clamp(s.rep + 18); s.stats.shamed = Math.max(0, s.stats.shamed - 1); s.coin += 60; this.news(L("[재수사] {n}의 누명이 벗겨졌다", "[再捜査] {n}の濡れ衣が晴れた", "[Reopened] {n} is cleared of the false charge"), { n: s.nick }, "good"); }

  // ---------- 청문회 ----------
  requestHearing(reason) { if (this.day < this.chiefImmuneUntil || this.hearing || this.hearingQ) return false; this.hearingQ = { reason }; return true; }
  openHearing() { const q = this.hearingQ; this.hearingQ = null; this.petitions.clear(); const chief = this.director(); this.hearing = { chief: chief.seat, reason: q.reason, says: [], evid: [], votes: {}, elect: {}, passed: null }; this.bigDay = this.day; this.news(L("[속보] 방송국장 {n} 긴급 청문회 개최", "[速報] 局長{n}の緊急聴聞会を開催", "[Breaking] Emergency hearing for Chief {n}"), { n: chief.nick }, "breaking", "breaking"); this.setPhase("hearing_talk"); }
  tallyHearing() {
    const H = this.hearing, m = this.m, chief = this.seats[H.chief], eligible = this.live().filter((s) => s.seat !== H.chief); const perf = (100 - m.trust + 100 - m.unity + m.ctrv) / 300; H.evid.forEach(() => { /* 제출 증거는 NPC 표심에 반영 */ });
    for (const s of eligible) { if (H.votes[s.seat] !== undefined) continue; if (s.human && !s.away) continue; const rel = this.relOf(s.seat, H.chief) / 100; const pYes = clamp(0.2 + perf * 0.9 - rel + H.evid.length * 0.09 + (chief.rep < 35 ? 0.15 : 0), 0.05, 0.95); H.votes[s.seat] = this.R.chance(pYes) ? "yes" : this.R.chance(0.82) ? "no" : "abstain"; }
    const v = Object.values(H.votes), yes = v.filter((x) => x === "yes").length, no = v.filter((x) => x === "no").length, cast = yes + no, quorum = Math.ceil(eligible.length * 0.5), ok = cast >= quorum; H.counts = { yes, no, abstain: v.filter((x) => x === "abstain").length, eligible: eligible.length, quorum }; H.passed = ok && yes > no; this.hearingYes = this.hearingYes || new Set(); if (H.passed) for (const k in H.votes) if (H.votes[k] === "yes") this.hearingYes.add(+k);
    if (H.passed) { this.removed++; chief.rep = clamp(chief.rep - 10); chief.grudge++; chief.stats.shamed++; this.apply({ unity: -4, ctrv: 3 }); this.highlight("hearing", { a: H.chief, passed: 1 }); this.news(L("[속보] 불신임 가결! 방송국장 {n} 해임", "[速報] 不信任可決！局長{n}を解任", "[Breaking] No-confidence passes! Chief {n} removed"), { n: chief.nick }, "breaking", "breaking"); }
    else { for (const k in H.votes) if (H.votes[k] === "yes") { this.addRel(+k, H.chief, -6); const s = this.seats[k]; s.rep = clamp(s.rep - 3); } this.apply({ unity: -3, ctrv: 2 }); chief.rep = clamp(chief.rep + 4); this.chiefImmuneUntil = this.day + 5; this.highlight("hearing", { a: H.chief, passed: 0 }); this.news(L("[속보] 불신임 부결… 그러나 앙금은 남았다", "[速報] 不信任否決…だがわだかまりは残った", "[Breaking] Motion fails; bad blood remains"), null, "bad"); }
    this.setPhase("hearing_result");
  }
  tallyElection() {
    const H = this.hearing, chief = this.seats[H.chief], cands = this.live().filter((s) => s.seat !== H.chief); for (const s of this.live()) { if (H.elect[s.seat] !== undefined) continue; if (s.human && !s.away) continue; H.elect[s.seat] = this.R.weighted(cands, (c) => Math.max(1, c.rep + this.relOf(s.seat, c.seat) * 0.6 + (c.seat === s.seat ? 10 : 0))).seat; }
    const count = {}; for (const k in H.elect) count[H.elect[k]] = (count[H.elect[k]] || 0) + 1; const top = cands.slice().sort((a, b) => (count[b.seat] || 0) - (count[a.seat] || 0) || b.rep - a.rep || a.seat - b.seat)[0]; const oldRole = top.role; top.role = "director"; chief.role = oldRole; top.publicGoal = PUBLIC_GOALS.director; chief.publicGoal = PUBLIC_GOALS[oldRole]; this.chiefImmuneUntil = this.day + 4; H.winner = top.seat; for (const c of this.contracts) if (c.type === "support" && c.st === "on") { const [a, b] = c.parties, want = c.candidate ?? a; if (H.elect[b] !== want) this.breach(c, b, "auto"); else this.close(c); } this.news(L("[속보] 신임 방송국장 {n} 선출", "[速報] 新局長に{n}", "[Breaking] {n} elected new Chief"), { n: top.nick }, "breaking", "breaking"); this.highlight("elect", { a: top.seat });
  }

  // ---------- 계약 ----------
  close(c) { c.st = "done"; c.endDay = this.day; if (c.day != null && this.day - c.day >= 3) this.highlight("alliance", { a: c.parties[0], b: c.parties[1], size: this.day - c.day, type: c.type }); }
  breach(c, seat, how) {
    if (c.st !== "on") return; const other = c.parties.find((x) => x !== seat), s = this.seats[seat], t = this.seats[other]; c.st = "broken"; c.endDay = this.day; c.breachedBy = seat; s.rep = clamp(s.rep - 12); s.stats.breach++; this.addRel(seat, other, -28); t.grudge++;
    if (c.binding && c.penalty) { const v = Math.min(s.coin, c.penalty); s.coin -= v; t.coin += v; }
    if (c.public) { this.apply({ unity: -5, ctrv: 4 }); this.news(L("[단독] {a}, {b:와}의 약속을 깼다", "[独占] {a}、{b}との約束を破る", "[Exclusive] {a} broke a deal with {b}"), { a: s.nick, b: t.nick }, "bad"); } else { const e = this.addHidden(seat, "contract", true, L("{a:와} {b}의 비밀 계약서", "{a}と{b}の秘密契約書", "Secret contract between {a} and {b}"), "contract"); e.vars = { a: s.nick, b: t.nick }; e.hold = other; this.privateNote(other, L("{a:이} 약속을 어겼습니다. 계약서 증거를 확보했고 복수권을 얻었습니다.", "{a}が約束を破りました。契約書の証拠を確保し復讐権を得ました。", "{a} broke the deal. You hold the contract as evidence and gained a grudge."), { a: s.nick }); }
    this.highlight("betray", { a: seat, b: other, size: 12 + (c.penalty || 0) / 10 + (c.coin || 0) / 10, how });
  }

  // ---------- 플레이어 행동 ----------
  act(seat, type, p = {}) {
    const s = this.seats[seat]; if (!s || s.left) return { ok: false, error: "NOT_SEATED" }; if (this.phase.name === "over") return { ok: false, error: "OVER" }; const r = this.act2(s, type, p) || {}; if (r.error) return { ok: false, error: r.error }; this.rev++; if (r.endCase) { this.endCaseEarly(); return { ok: true }; } this.checkEarly(); return { ok: true, ...r };
  }
  actionsFor(s) { const out = []; for (const id in ACTIONS) { const A = ACTIONS[id]; if (A.spy) { if (s.spy && !s.spy.exposed) out.push(id); continue; } if (A.grudge) { if (s.grudge > 0) out.push(id); continue; } if (A.roles && !A.roles.includes(s.role)) continue; if (A.roles && s.suspendedUntil > this.day) continue; out.push(id); } return out; }
  canProgram(s) { if (s.role === "pd") return true; const pd = this.find("pd"); if (pd?.human && !pd.away) return false; if (s.role === "director") return true; const d = this.director(); return !(d.human && !d.away) && this.humans().filter((x) => !x.away)[0]?.seat === s.seat; }
  canStatement(s) { if (s.role === "pr" || s.role === "director") return true; const pr = this.find("pr"), d = this.director(); return !(pr?.human && !pr.away) && !(d.human && !d.away) && this.humans().filter((x) => !x.away)[0]?.seat === s.seat; }
  act2(s, type, p) {
    const nm = this.phase.name;
    if (type.startsWith("c_")) return crimeAct(this, s, type, p);
    switch (type) {
      case "done": s.done = true; return {};
      case "action": { if (nm !== "plan") return { error: "PHASE" }; if (!this.actionsFor(s).includes(p.id)) return { error: "DENIED" }; const A = ACTIONS[p.id]; if (A.target === "seat") { const t = +p.target; if (!this.seats[t] || this.seats[t].left || t === s.seat) return { error: "BAD_SEAT" }; s.actionTarget = t; } s.action = p.id; return {}; }
      case "agenda": { if (nm !== "plan") return { error: "PHASE" }; const i = p.i | 0; if (!this.today.agenda.o[i]) return { error: "BAD" }; this.today.votes[s.seat] = i; return {}; }
      case "program": { if (nm !== "plan" || !this.canProgram(s)) return { error: "DENIED" }; if (!own(PROGRAMS, p.id)) return { error: "BAD" }; if (this.flags.forceSafe) return { error: "FORCED" }; this.today.program = p.id; return {}; }
      case "statement": { if (nm !== "plan" || !this.canStatement(s)) return { error: "DENIED" }; const r = this.rumors.find((x) => x.id === +p.id && x.st === "open"); if (!r || !["verify", "deny", "admit", "ignore"].includes(p.mode)) return { error: "BAD" }; if (p.mode === "verify" && r.verified) return { error: "DONE" }; r.mode = p.mode; r.by = s.seat; return {}; }
      case "u_pick": { if (nm !== "urgent" || this.urgent.lead !== s.seat) return { error: "DENIED" }; const i = p.i | 0; if (!this.urgent.ev.ch[i]) return { error: "BAD" }; this.urgent.pick = i; s.done = true; return {}; }
      case "u_tag": { if (nm !== "urgent" || this.urgent.lead === s.seat) return { error: "DENIED" }; const opts = PALETTE[s.role] || PALETTE.cast; if (!opts.some((o) => o[0] === p.tag)) return { error: "BAD" }; this.urgent.tags[s.seat] = p.tag; s.done = true; return {}; }
      case "x_assign": { if (nm !== "emergency" || !this.emg.def.probs.includes(p.p)) return { error: "BAD" }; this.emg.assign[s.seat] = p.p; s.done = true; return {}; }
      case "x_gambit": { if (nm !== "emergency" || s.role !== "director") return { error: "DENIED" }; this.emg.gambit = !this.emg.gambit; return {}; }
      case "petition": { if (this.day < this.chiefImmuneUntil) return { error: "IMMUNE" }; if (s.role === "director" || this.hearing) return { error: "DENIED" }; this.petitions.add(s.seat); const need = Math.max(1, Math.ceil(this.humans().length * 0.34)); const npcs = this.live().filter((x) => !x.human && x.role !== "director" && this.pressure() > 0.5 && this.relOf(x.seat, this.director().seat) < 10).length; if (this.petitions.size + npcs >= need) this.requestHearing("petition"); return { need }; }
      case "h_say": { if (nm !== "hearing_talk") return { error: "PHASE" }; const k = ["blame", "defend", "reform", "evidence"]; if (!k.includes(p.kind)) return { error: "BAD" }; if (this.hearing.says.some((x) => x.seat === s.seat)) return { error: "DONE" }; this.hearing.says.push({ seat: s.seat, kind: p.kind }); s.done = true; return {}; }
      case "h_evid": { if (nm !== "hearing_talk") return { error: "PHASE" }; const e = this.evidence.find((x) => x.id === +p.id && x.hold === s.seat && !x.published); if (!e) return { error: "BAD" }; if (e.about !== this.hearing.chief) return { error: "NOT_RELATED" }; this.hearing.evid.push({ seat: s.seat, id: e.id, title: e.title, vars: e.vars || null, truth: e.truth }); e.published = true; return {}; }
      case "h_vote": { if (nm !== "hearing_vote" || s.seat === this.hearing.chief) return { error: "DENIED" }; if (this.hearing.votes[s.seat] !== undefined) return { error: "VOTED" }; if (!["yes", "no", "abstain"].includes(p.v)) return { error: "BAD" }; this.hearing.votes[s.seat] = p.v; return {}; }
      case "e_vote": { if (nm !== "election") return { error: "PHASE" }; const t = +p.seat; if (!this.seats[t] || this.seats[t].left || t === this.hearing.chief) return { error: "BAD_SEAT" }; if (this.hearing.elect[s.seat] !== undefined) return { error: "VOTED" }; this.hearing.elect[s.seat] = t; return {}; }
      case "ct_propose": return this.ctPropose(s, p);
      case "ct_reply": { const c = this.contracts.find((x) => x.id === +p.id && x.st === "offer" && x.parties[1] === s.seat); if (!c) return { error: "BAD" }; return p.accept ? this.ctAccept(c) : ((c.st = "rejected"), {}); }
      case "ct_break": { const c = this.contracts.find((x) => x.id === +p.id && x.st === "on" && x.parties.includes(s.seat)); if (!c) return { error: "BAD" }; this.breach(c, s.seat, "manual"); return {}; }
      case "ev_verify": { const e = this.evidence.find((x) => x.id === +p.id && x.hold === s.seat); if (!e || e.checked != null) return { error: "BAD" }; if (s.coin < 40) return { error: "COIN" }; s.coin -= 40; e.checked = this.R.chance(0.82) ? (e.truth ? "real" : "fake") : "unclear"; return {}; }
      case "ev_publish": return this.publishEv(s, p);
      case "retrial": { const a = this.reopenAvail; if (!a) return { error: "BAD" }; if (s.coin < 60) return { error: "COIN" }; s.coin -= 60; this.reopenCase = { ...a, day: this.day + 1 }; this.reopenAvail = null; return {}; }
      default: return { error: "BAD_TYPE" };
    }
  }
  ctPropose(s, p) {
    const def = own(CONTRACTS, p.type) ? CONTRACTS[p.type] : null; if (!def) return { error: "BAD" }; const to = +p.to, t = this.seats[to]; if (!t || t.left || to === s.seat) return { error: "BAD_SEAT" }; if (this.contracts.filter((c) => c.parties[0] === s.seat && c.st === "offer").length >= 3) return { error: "LIMIT" }; if (this.contracts.filter((c) => c.parties[0] === s.seat && c.day === this.day).length >= 3) return { error: "DAY_LIMIT" }; if (this.contracts.some((c) => c.parties[0] === s.seat && c.parties[1] === to && c.day === this.day && c.st === "rejected")) return { error: "REJECTED_TODAY" }; const cand = p.candidate != null && p.candidate !== "" ? +p.candidate : null; if (cand != null && (!this.seats[cand] || this.seats[cand].left)) return { error: "BAD_SEAT" }; this.contracts = this.contracts.filter((c) => !(c.st === "rejected" && this.day - c.day > 2));
    const days = Math.max(2, Math.min(10, p.days | 0 || 5)), coin = Math.max(0, Math.min(300, p.coin | 0)), penalty = def.bind ? Math.max(0, Math.min(300, p.penalty | 0)) : 0; if (coin > s.coin) return { error: "COIN" };
    const c = { id: this.ctid++, type: p.type, parties: [s.seat, to], day: this.day, until: this.day + days, days, coin, penalty, public: !!p.public, binding: !!def.bind, candidate: cand, st: "offer", exposed: false, did: {} }; this.contracts.push(c); if (!t.human || t.away) { const trust = this.relOf(s.seat, to) + (coin / 4) + (s.rep - 45) * 0.5; if (this.R.chance(clamp(0.45 + trust / 60, 0.1, 0.95))) this.ctAccept(c); else c.st = "rejected"; } return { id: c.id, st: c.st };
  }
  ctAccept(c) { const [a, b] = c.parties, A = this.seats[a], B = this.seats[b]; if (c.coin > A.coin) { c.st = "rejected"; return { error: "COIN" }; } A.coin -= c.coin; B.coin += c.coin; c.st = "on"; c.signed = this.day; this.addRel(a, b, 12); if (c.public) this.news(L("[공식] {a}·{b}, 계약 체결", "[公式] {a}・{b}が契約締結", "[Official] {a} and {b} sign a deal"), { a: A.nick, b: B.nick }, "official", "official"); if (c.type === "info") { this.privateNote(a, L("{n}의 비밀 미션 종류: {t}", "{n}の秘密任務の種類：{t}", "{n}'s mission type: {t}"), { n: B.nick, t: MISSIONS[B.mission.id].text }); this.privateNote(b, L("{n}의 비밀 미션 종류: {t}", "{n}の秘密任務の種類：{t}", "{n}'s mission type: {t}"), { n: A.nick, t: MISSIONS[A.mission.id].text }); this.close(c); } return {}; }
  publishEv(s, p) {
    const e = this.evidence.find((x) => x.id === +p.id && x.hold === s.seat && !x.published); if (!e) return { error: "BAD" }; e.published = true; const t = e.about != null ? this.seats[e.about] : null;
    for (const c of this.contracts) if (c.st === "on" && c.type === "protect" && c.parties.includes(s.seat) && e.about === c.parties.find((x) => x !== s.seat)) this.breach(c, s.seat, "auto");
    if (e.truth) { s.rep = clamp(s.rep + 9); s.stats.truth++; this.apply({ trust: 3, ctrv: 4 }); if (t) { t.rep = clamp(t.rep - 15); t.stats.shamed++; this.addRel(s.seat, t.seat, -18); if (e.tag === "spy" && t.spy) { t.spy.exposed = true; t.spy.pts = Math.max(0, t.spy.pts - 3); t.grudge++; this.news(L("[충격] {n}, 경쟁사 내통 사실 공개", "[衝撃] {n}、競合との内通が発覚", "[Shock] {n} exposed as the rival's inside source"), { n: t.nick }, "breaking", "breaking"); this.highlight("spyOut", { a: t.seat, b: s.seat }); } if (e.tag === "contract") for (const c of this.contracts) if (c.parties.includes(t.seat) && !c.public) c.exposed = true; } this.news(L("[제보] {a:이} 공개한 자료, 사실로 확인", "[情報] {a}が公開した資料は事実と確認", "[Tip] Files {a} released were verified"), { a: s.nick }, "good"); this.highlight("rescue", { a: s.seat, name: e.title, soft: 1 }); }
    else { s.rep = clamp(s.rep - 13); s.stats.shamed++; this.apply({ ctrv: 6, unity: -3 }); if (t) t.rep = clamp(t.rep + 4); this.news(L("[정정] {a:이} 공개한 제보는 허위로 드러났다", "[訂正] {a}が公開した情報は虚偽と判明", "[Correction] {a}'s tip turned out false"), { a: s.nick }, "bad"); }
    return { truth: !!e.truth };
  }

  // ---------- 밤 정산: 지표 연쇄 → 위험 → 조기 종료 ----------
  toNight() {
    const m = this.m, D = this.D, P = this.today.prog || PROGRAMS.normal, n = this.live().length, before = { ...m };
    m.rating = clamp(m.rating + (29 + m.trust * 0.18 - m.rating) * 0.2 - Math.max(0, m.fat - 62) * 0.05 - Math.max(0, 35 - m.stab) * 0.1);
    const rev = (160 + m.rating * 7.4) * (0.4 + m.ad / 100) * (this.boldRun >= 2 ? Math.min(P.rev, 1) : P.rev) * D.rev + m.trust * 1.5, up = (640 + n * 11) * D.up + (this.risk.unpaid ? 30 : 0); m.money = Math.round(m.money + rev - up);
    for (const d of this.debts.filter((x) => x.day <= this.day)) { m.money -= d.v; d.paid = true; this.news(L("[재무] 빌린 돈 {v} 상환일이 왔다", "[財務] 借入{v}の返済日", "[Finance] {v} loan repayment is due"), { v: d.v }, "bad"); } this.debts = this.debts.filter((x) => !x.paid);
    // 연쇄: 논란→신뢰→광고→수익, 돈→안정성·결속, 피로→결속·안정성
    const R = D.rec, S = D.sev * (1 + 0.72 * this.sizeK()); if (m.ctrv > 50) { m.trust = clamp(m.trust - (m.ctrv - 50) * 0.075 * S); m.ad = clamp(m.ad - (m.ctrv - 50) * 0.055 * S); } if (m.trust < 42) m.ad = clamp(m.ad - (42 - m.trust) * 0.05 * S); if (m.money < 600) { m.stab = clamp(m.stab - 2.2 * S); m.unity = clamp(m.unity - 1.6 * S); this.risk.unpaid = Math.min(4, this.risk.unpaid + (m.money < 200 ? 1 : 0)); } if (m.fat > 62) { m.unity = clamp(m.unity - (m.fat - 62) * 0.08 * S); m.stab = clamp(m.stab - (m.fat - 62) * 0.04 * S); } if (m.unity < 36) { m.fat = clamp(m.fat + 1.6 * S); m.stab = clamp(m.stab - 1 * S); }
    m.ctrv = clamp(m.ctrv - 2 * R + this.risk.fans * 0.8); m.stab = clamp(m.stab - 2.6 * S - this.risk.maint * 0.9); m.fat = clamp(m.fat + 3.2 * S); m.unity = clamp(m.unity - 1.8 * S - this.risk.grudge * 0.8); m.ad = clamp(m.ad - 1.5 * S - this.risk.ads * 0.8); m.trust = clamp(m.trust - 0.8 * S);
    if (this.day % 3 === 0) { this.risk.maint = Math.min(4, this.risk.maint + (m.stab < 60 ? 1 : 0)); this.risk.grudge = Math.min(4, this.risk.grudge + (m.unity < 50 ? 1 : 0)); this.risk.fans = Math.min(4, this.risk.fans + (m.ctrv > 40 ? 1 : 0)); this.risk.ads = Math.min(4, this.risk.ads + (m.ad < 45 ? 1 : 0)); }
    // 개인: 수당·계약
    for (const s of this.live()) { s.coin += 18 + (s.role === "director" ? 8 : 0); s.fame = clamp(s.fame + (s.role === "cast" && this.today.prog === PROGRAMS.bold ? 1 : 0)); }
    for (const c of this.contracts.filter((x) => x.st === "on")) { const [a, b] = c.parties, A = this.seats[a], B = this.seats[b]; if (c.type === "revshare") { const v = Math.min(A.coin, 20); A.coin -= v; B.coin += v; this.addRel(a, b, 1); } if (c.type === "show") { const on = (x) => ["perform", "produce", "script", "fanmeet", "rehearse"].includes(x.action); if (on(A)) c.did[a] = 1; if (on(B)) c.did[b] = 1; if (on(A) && on(B)) { A.fame = clamp(A.fame + 3); B.fame = clamp(B.fame + 3); this.apply({ rating: 1 }); } } if (this.day >= c.until) { if (c.type === "show") { if (!c.did[a] && c.did[b]) { this.breach(c, a, "auto"); continue; } if (!c.did[b] && c.did[a]) { this.breach(c, b, "auto"); continue; } } if (c.type === "support") { c.st = "done"; c.endDay = this.day; continue; } this.close(c); } }
    for (const s of this.live()) if (this.missionImpossible(s) && !s.mission.swapped) { s.mission = { id: "fallback", target: null, swapped: true }; this.privateNote(s.seat, L("비밀 미션을 더 이상 달성할 수 없어 대체 목표로 바뀌었습니다.", "秘密任務が達成不能となり代替目標に変わりました。", "Your mission became impossible; here's a replacement.")); }
    // 자동 청문회
    if (!this.hearing && !this.hearingQ && this.day >= this.chiefImmuneUntil && this.day >= 7 && (this.streak >= 2 || m.unity < 34 || m.ctrv >= 72 || m.trust < 34) && this.R.chance(0.55)) this.hearingQ = { reason: "failure" };
    for (const k in m) if (k !== "money") m[k] = Math.round(m[k] * 10) / 10;
    if (m.rating > this.maxRating.v) this.maxRating = { v: m.rating, day: this.day }; this.lows.trust = Math.min(this.lows.trust, m.trust); this.lows.money = Math.min(this.lows.money, m.money); this.lows.unity = Math.min(this.lows.unity, m.unity); if (this.hist.length && this.hist[this.hist.length - 1].money - m.money > 700) this.highlight("loss", { size: this.hist[this.hist.length - 1].money - m.money });
    this.hist.push({ day: this.day, money: m.money, trust: m.trust, rating: m.rating, unity: m.unity, stab: m.stab, ctrv: m.ctrv, fat: m.fat, ad: m.ad });
    // 위험 상태가 이어지면 다음 날 마지막 기회 → 그래도 안 풀리면 끝
    let end = null; for (const k in DOOM_COND) { if (this.day >= 3 && DOOM_COND[k](this)) { this.doom[k] = (this.doom[k] || 0) + 1; if (this.doom[k] > this.D.doom && this.lcOffered[k] != null) { end = end || k; } } else if (this.doom[k]) this.doom[k] = Math.max(0, this.doom[k] - 1); }
    const nightDelta = {}; for (const k in m) nightDelta[k] = Math.round(m[k] - before[k]); this.today.night = { delta: nightDelta, rev: Math.round(rev), up: Math.round(up) };
    if (this.pendEnd) end = this.pendEnd; else if (!end && this.day >= 30) end = this.finalEnding();
    this.flags.forceSafe = 0; if (end) this.pendEnd = end; this.setPhase("night");
  }
  finalEnding() { const m = this.m, breaches = this.seats.reduce((a, s) => a + s.stats.breach, 0); if (this.maxRating.v >= 78 && m.rating >= 62) return "record"; if (m.trust >= 62 && m.unity >= 60 && m.stab >= 60 && m.rating >= 58 && m.ad >= 60 && m.ctrv <= 38 && m.fat <= 45) return "legend"; if (m.trust >= 74 && m.rating >= 58) return "national"; if (this.crimes.solved >= 4 && this.crimes.unsolved === 0 && this.crimes.wrong === 0 && m.trust >= 55) return "detective"; if (breaches === 0 && m.unity >= 70 && m.trust >= 50 && this.humans().length >= 2) return "teamwork"; if (this.removed >= 1 && m.trust >= 50 && m.unity >= 50) return "regime"; if ((this.lows.trust < 28 || this.lows.money < 300 || this.lows.unity < 26) && m.trust >= 45 && m.money >= 500) return "comeback"; return "survive"; }
  warnings() { const m = this.m, r = this.risk, out = []; const w = (lv, t) => out.push({ lv, t }); if (m.money < 500) w(3, L("자금이 바닥납니다. 대출·영업·지출 동결이 필요해요", "資金が底をつきます。融資・営業・支出凍結を", "Funds nearly gone; borrow, sell, or freeze spending")); else if (m.money < 1200) w(2, L("자금이 줄고 있어요", "資金が減っています", "Funds are shrinking")); if (m.trust < 26) w(3, L("시청자 신뢰가 무너지기 직전", "視聴者の信頼が崩壊寸前", "Viewer trust on the verge")); if (m.ctrv > 62) w(2, L("논란이 신뢰와 광고주를 갉아먹어요", "炎上が信頼と広告主を蝕みます", "Controversy is eating trust and sponsors")); if (m.stab < 28) w(3, L("송출 장비가 곧 멈출 듯해요", "送出機材がもうすぐ止まりそう", "Equipment may fail soon")); else if (r.maint >= 2) w(2, L("장비 점검이 밀렸어요 (사고 위험↑)", "機材点検が遅れています（事故リスク↑）", "Maintenance overdue (accident risk up)")); if (m.unity < 28) w(3, L("내부 분열 직전", "内部分裂の寸前", "On the verge of a split")); if (r.unpaid >= 2) w(2, L("임금 체불이 쌓였어요 (집단 요구 위험)", "賃金未払いが累積（集団要求の危険）", "Unpaid wages pile up (mass demand risk)")); if (m.fat > 68) w(2, L("출연진이 지쳤어요 (하차·쓰러짐 위험)", "出演者が疲弊（降板・倒れる危険）", "Cast exhausted (quit or collapse risk)")); if (m.ad < 30) w(3, L("광고주가 나갈 준비 중", "広告主が撤退準備中", "Sponsors preparing to leave")); if (this.streak >= 3) w(2, L("대응 실패 {n}연속", "対応失敗{n}連続", "{n} failed responses in a row"), this.streak); if (this.crimes.unsolvedStreak >= 2) w(2, L("미제 사건이 쌓이고 있어요", "未解決事件が積もっています", "Unsolved cases are piling up")); return out.sort((a, b) => b.lv - a.lv); }

  // ---------- NPC: 합리적이지만 완벽하지 않음 ----------
  npcAction(s) {
    const m = this.m, av = this.actionsFor(s).filter((x) => !ACTIONS[x].spy && !ACTIONS[x].grudge); const need = { maint: m.stab < 55 ? 3 : m.stab < 75 ? 1 : 0, sponsor: m.money < 1800 ? 3 : 1.4, campaign: m.ctrv > 30 ? 2.5 : 0.6, produce: m.rating < 50 ? 2 : 1, rehearse: m.stab < 50 ? 1.6 : 0.5, meeting: m.unity < 55 ? 2.4 : 0.5, care: m.fat > 40 ? 2.5 : 0.5, review: m.ad < 55 ? 2 : 0.8, script: m.rating < 55 ? 1.5 : 0.6, perform: m.fat < 55 ? 2 : 0.6, fanmeet: m.trust < 55 ? 2 : 1, rest: m.fat > 60 ? 1 : 0.15, network: 0.5, investigate: 0.45, audit: 0.5, monitor: 0.3, backup: 0.3 };
    if (s.spy && !s.spy.exposed && this.R.chance(0.3)) { if (s.spy.pts >= SPY_GOAL && this.m.rating >= 35 && this.m.money > 0 && this.R.chance(0.25)) s.action = "spy_exec"; else if (s.coin >= 90) s.action = s.spy.heat >= 6 ? "spy_lay" : "spy_leak"; else s.action = "spy_lay"; return; }
    if (s.grudge > 0 && this.R.chance(0.25)) { const t = this.R.pick(this.live().filter((x) => x.seat !== s.seat)); s.action = "revenge"; s.actionTarget = t.seat; return; }
    const pick = (this.R.chance(0.3) ? this.R.pick(av) : this.R.weighted(av, (x) => need[x] ?? 0.2)) || "rest"; s.action = pick; if (ACTIONS[pick].target === "seat") s.actionTarget = this.R.pick(this.live().filter((x) => x.seat !== s.seat)).seat;
  }
  npcProgram() { const m = this.m; if (m.stab < 40 || m.fat > 62) return "safe"; if (m.money < 900) return "sponsor"; if (m.rating < 45 && m.ctrv < 40) return "bold"; return "normal"; }
  npcAgenda(A) { let best = 0, bv = -1e9; A.o.forEach((o, i) => { const v = this.valueOf(o.d || {}) - (o.risk ? 4 : 0) + (o.clear ? 3 : 0) + this.R.next() * 5; if (v > bv) { bv = v; best = i; } }); return best; }
  valueOf(d) { const m = this.m, need = (x) => Math.max(0.3, (100 - x) / 50); return (d.trust || 0) * need(m.trust) + (d.unity || 0) * need(m.unity) + (d.stab || 0) * need(m.stab) + (d.ad || 0) * need(m.ad) + (d.rating || 0) * 0.6 - (d.ctrv || 0) * need(100 - m.ctrv) - (d.fat || 0) * need(100 - m.fat) + (d.money || 0) / (m.money < 1000 ? 25 : 70); }
  npcPick(ev) { let best = 0, bv = -1e9; ev.ch.forEach((c, i) => { const o = c[3] || {}; let v = this.valueOf(c[1] || {}); if (o.end) v -= 30; if (o.next) v -= 5; if (o.risk) v -= 5; if (o.roll) v += (this.valueOf(o.roll.good) + this.valueOf(o.roll.bad)) / 2 * 0.8; if (o.rescue) v += 5; v += this.R.next() * 14; if (v > bv) { bv = v; best = i; } }); return best; }
  npcTag(s, ev) { const opts = PALETTE[s.role] || PALETTE.cast, good = opts.filter((o) => (ev.fit[o[0]] || 0) > 0); return this.R.chance(0.6) && good.length ? this.R.pick(good)[0] : this.R.pick(opts)[0]; }
  npcEmg(s, def, E) { const humanPicks = Object.values(E.assign); if (humanPicks.length && this.R.chance(0.6)) return this.R.pick(humanPicks); return this.R.pick(def.probs); }
  npcStatement(r) { if (this.find("pr")?.human && this.humans().length > 1) return null; if (r.verified) return r.truth === "true" ? "admit" : "deny"; return this.R.chance(0.55) ? "verify" : this.R.chance(0.5) ? "ignore" : "deny"; }
  npcPhase(nm) {
    const c = this.crime; const list = this.live().filter((s) => !s.human || s.away);
    if (nm === "crime_collect") for (const s of list) { const crook = c.culprit === s.seat || c.accomplice === s.seat, pool = c.ev.filter((e) => !e.by.has(s.seat)); for (let i = 0; i < (c.points[s.seat] || 0) && pool.length; i++) { const e = pool.splice(this.R.int(0, pool.length - 1), 1)[0]; e.by.add(s.seat); if (!crook && this.R.chance(0.7)) { e.shared = true; e.sharer = s.seat; } } c.points[s.seat] = 0; if (crook && this.R.chance(0.5)) { const t = this.R.pick(this.live().filter((x) => x.seat !== c.culprit)); crimeAct(this, s, "c_frame", { target: t?.seat }); } }
    if (nm === "crime_ask") for (const s of list) { const crook = c.culprit === s.seat || c.accomplice === s.seat, real = c.real[s.seat]; if (crook && this.R.chance(0.8)) { const locs = Object.keys(LOCATIONS).filter((l) => l !== c.def.loc); c.alibi[s.seat] = { loc: this.R.pick(locs), act: real.act, with: this.R.pick(this.live().filter((x) => x.seat !== s.seat))?.seat ?? null, lie: true }; } else c.alibi[s.seat] = { loc: real.loc, act: real.act, with: real.with, lie: false }; }
    if (nm === "crime_debate") for (const s of list) { if (c.culprit === s.seat || c.accomplice === s.seat) continue; const seen = this.crimeSeen(s); const tg = this.R.pick(this.live().filter((x) => x.seat !== s.seat && c.alibi[x.seat])); if (tg && this.R.chance(0.5)) { const al = c.alibi[tg.seat]; const v = al.lie ? (this.R.chance(0.72) ? "clash" : "unknown") : this.R.chance(0.86) ? "match" : "unknown"; if (!c.checks.some((x) => x.by === s.seat && x.target === tg.seat)) c.checks.push({ by: s.seat, target: tg.seat, verdict: v }); } void seen; }
    if (nm === "urgent" && this.urgent) { const lead = this.seats[this.urgent.lead]; if (!lead.human || lead.away) this.urgent.pick = this.npcPick(this.urgent.ev); }
    if (nm === "plan") for (const s of list) { this.npcAction(s); if (s.role === "pd" && !this.today.program) this.today.program = this.npcProgram(); }
  }

  // ---------- 플레이어 이탈: 자리는 NPC가 이어받음 ----------
  setAway(seat, away) { const s = this.seats[seat]; if (!s) return; s.away = !!away; this.rev++; this.checkEarly(); }
  leave(seat) { const s = this.seats[seat]; if (!s) return; s.human = false; s.away = false; s.key = null; this.news(L("{n:이} 방송국을 떠났고 대역이 자리를 메웠다", "{n}が局を去り代役が席を埋めた", "{n} left; a stand-in took over"), { n: s.nick }, "mid"); this.rev++; this.checkEarly(); }

  // ---------- 끝 ----------
  finish(id) { const E = ENDINGS[id] || ENDINGS.survive; this.ending = { id, tone: E.tone, day: this.day }; this.phase = { name: "over", ends: 0 }; for (const c of this.contracts) if (c.st === "on") this.close(c); this.highlights = this.makeHighlights(); this.rev++; }
  makeHighlights() {
    const by = (t) => this.h.filter((x) => x.t === t), top = (t) => by(t).sort((a, b) => (b.size || 0) - (a.size || 0))[0] || null, id = this.ending.id; const rescueCount = {}; for (const s of this.seats) rescueCount[s.seat] = s.stats.rescue; const saviorSeat = Object.keys(rescueCount).sort((a, b) => rescueCount[b] - rescueCount[a])[0], savior = rescueCount[saviorSeat] > 0 ? +saviorSeat : null;
    const lowDay = this.hist.slice().sort((a, b) => (a.trust + a.unity + a.stab) - (b.trust + b.unity + b.stab))[0], last = this.hist[this.hist.length - 1], comeback = lowDay && last && last.day - lowDay.day >= 3 && (last.trust + last.unity + last.stab) - (lowDay.trust + lowDay.unity + lowDay.stab) >= 45 ? { day: lowDay.day, gain: Math.round((last.trust + last.unity + last.stab) - (lowDay.trust + lowDay.unity + lowDay.stab)) } : null;
    const E = ENDINGS[id]; let cause = null; if (E.tone === "fail") { const acc = by("accident").sort((a, b) => (b.size || 0) - (a.size || 0))[0]; cause = { doom: id, name: acc?.name || null, day: acc?.day ?? null }; }
    const key = by("hearing").find((x) => x.passed) || by("reveal")[0] || top("betray") || top("accident");
    const cases = this.crimeLog.map((c) => ({ id: c.id, day: c.day, name: c.name, culprit: c.c, accomplice: c.acc, outsider: c.out, res: c.res, accused: c.accused, motive: c.motive, outsiderText: c.outsiderText }));
    return { maxRating: this.maxRating, accident: top("accident"), betray: top("betray"), alliance: top("alliance"), loss: top("loss"), comeback, savior, cause, finalChief: this.director().seat, day: this.day, key: key ? { t: key.t, day: key.day, name: key.name || null, a: key.a ?? null, passed: key.passed ?? null } : null, removed: this.removed, crimes: this.crimes, cases, spies: this.seats.filter((s) => s.spy).map((s) => ({ seat: s.seat, pts: s.spy.pts, exposed: s.spy.exposed })), personal: this.seats.map((s) => ({ seat: s.seat, nick: s.nick, role: s.role, human: s.human, mission: { id: s.mission.id, target: s.mission.target, done: this.missionSafe(s), reward: MISSIONS[s.mission.id].reward }, rep: Math.round(s.rep), fame: Math.round(s.fame), coin: Math.round(s.coin), breach: s.stats.breach, rescue: Math.round(s.stats.rescue * 10) / 10, truth: s.stats.truth, spy: !!s.spy })), hist: this.hist };
  }
  missionSafe(s) { try { return !!this.missionDone(s); } catch { return false; } }

  // ---------- 화면용: 본인 비밀만 포함. seat=null은 관전(공개 정보만) ----------
  viewFor(seat) {
    const me = seat != null ? this.seats[seat] : null, m = this.m, over = this.phase.name === "over"; const pubSeat = (s) => { const v = { seat: s.seat, nick: s.nick, role: s.role, human: s.human, away: s.away, left: s.left, fame: Math.round(s.fame), rep: Math.round(s.rep), done: s.done, suspended: s.suspendedUntil > this.day, npc: !s.human }; if (over && s.spy) v.spy = true; return v; };
    const v = { rev: this.rev, serverNow: this.now(), day: this.day, diff: this.diffKey, phase: { name: this.phase.name, ends: this.phase.ends, sec: this.phase.sec }, m: { ...m }, warnings: this.warnings().map((w) => ({ lv: w.lv, t: w.t, n: this.streak })), hist: this.hist.slice(-30), feed: this.feed.slice(-40), seats: this.seats.map(pubSeat), rel: this.rel, rumors: this.rumors.filter((r) => r.st === "open").map((r) => ({ id: r.id, text: r.text, key: r.key, verified: r.verified, day: r.day, pending: r.mode || null })), trending: this.rumors.slice(-3).map((r) => r.key), immune: this.chiefImmuneUntil, petitions: this.petitions.size, removed: this.removed, streak: this.streak, doom: { ...this.doom }, crimes: this.crimes, contractsPublic: this.contracts.filter((c) => c.public && (c.st === "on" || c.st === "broken")).map((c) => this.ctView(c)) };
    if (this.today && this.phase.name === "plan") { const A = this.today.agenda; v.agenda = { t: A.t, o: A.o.map((x) => x.t), counts: A.o.map((_, i) => Object.values(this.today.votes).filter((x) => x === i).length) }; v.program = this.today.program; }
    if (this.today?.night && this.phase.name === "night") v.night = this.today.night;
    if (this.urgent && (this.phase.name === "urgent" || this.phase.name === "urgent_result")) { const U = this.urgent, ev = U.ev; v.urgent = { id: U.id, n: ev.n, s: ev.s, group: ev.group, lead: U.lead, last: !!ev.last, responded: Object.keys(U.tags).length + (U.pick != null ? 1 : 0), res: U.res ? { ...U.res, label: ev.ch[U.res.pick][0] } : null }; if (me) { v.urgent.mine = U.lead === me.seat ? { lead: true, ch: ev.ch.map((c) => ({ t: c[0], d: c[1], hasRoll: !!c[3]?.roll, hasNext: !!c[3]?.next, end: !!c[3]?.end, risk: !!c[3]?.risk })), pick: U.pick } : { lead: false, opts: (PALETTE[me.role] || PALETTE.cast).map((o) => ({ tag: o[0], t: o[1] })), tag: U.tags[me.seat] || null }; } }
    if (this.emg && (this.phase.name === "emergency" || this.phase.name === "emergency_result")) { const E = this.emg, n = this.live().length, cnt = {}; for (const k in E.assign) cnt[E.assign[k]] = (cnt[E.assign[k]] || 0) + (this.seats[k].role === "director" ? 2 : 1); v.emg = { id: E.def.id, n: E.def.n, s: E.def.s, probs: E.def.probs.map((k) => ({ k, ic: PROBLEMS[k].ic, n: PROBLEMS[k].n, need: Math.max(1, Math.ceil(PROBLEMS[k].need * n)), cost: PROBLEMS[k].cost, now: cnt[k] || 0, ok: PROBLEMS[k].ok, no: PROBLEMS[k].no })), gambit: { t: E.def.gambit.t, on: E.gambit, solve: E.def.gambit.solve }, res: E.res, mine: me ? E.assign[me.seat] || null : null }; }
    if (this.hearing) { const H = this.hearing, res = this.phase.name === "hearing_result" || this.phase.name === "election"; v.hearing = { chief: H.chief, reason: H.reason, says: H.says, evid: H.evid.map((e) => ({ seat: e.seat, title: e.title, vars: e.vars })), voted: Object.keys(H.votes).length, counts: res ? H.counts : null, passed: res ? H.passed : null, votes: res ? H.votes : null, mineVote: me ? H.votes[me.seat] ?? null : null, mineElect: me ? H.elect[me.seat] ?? null : null, electVoted: Object.keys(H.elect).length, winner: H.winner ?? null }; }
    if (this.crime) v.crime = this.crimeView(me);
    if (this.reopenAvail) v.reopenAvail = { accused: this.reopenAvail.accused };
    if (me) { v.me = { seat: me.seat, role: me.role, coin: Math.round(me.coin), rep: Math.round(me.rep), fame: Math.round(me.fame), grudge: me.grudge, action: me.action, actionTarget: me.actionTarget, actions: this.actionsFor(me).map((id) => ({ id, ...ACTIONS[id] })), publicGoal: me.publicGoal, mission: { id: me.mission.id, text: MISSIONS[me.mission.id].text, target: me.mission.target, targetNick: me.mission.target != null ? this.seats[me.mission.target].nick : null, reward: MISSIONS[me.mission.id].reward, tier: MISSIONS[me.mission.id].tier, done: this.missionSafe(me), swapped: me.mission.swapped }, spy: me.spy ? { pts: me.spy.pts, heat: me.spy.heat, exposed: me.spy.exposed, goal: SPY_GOAL } : null, notes: me.notes.slice(-12), done: me.done, agendaVote: this.today?.votes?.[me.seat] ?? null, petitioned: this.petitions.has(me.seat), statement: this.canStatement(me), program: this.canProgram(me) }; v.evidence = this.evidence.filter((e) => e.hold === me.seat && !e.published).map((e) => ({ id: e.id, kind: e.kind, ic: EVIDENCE_KINDS[e.kind]?.ic, kindName: EVIDENCE_KINDS[e.kind]?.name, title: e.title, vars: e.vars || null, checked: e.checked, about: e.about })); v.contracts = this.contracts.filter((c) => c.parties.includes(me.seat) && c.st !== "rejected").map((c) => this.ctView(c)); }
    if (over) { v.ending = { ...this.ending, ...ENDINGS[this.ending.id] }; v.highlights = this.highlights; if (this.spyWinner != null) v.ending.spyWinner = this.spyWinner; }
    return v;
  }
  ctView(c) { return { id: c.id, type: c.type, parties: c.parties, day: c.day, until: c.until, coin: c.coin, penalty: c.penalty, public: c.public, binding: c.binding, candidate: c.candidate, st: c.st, breachedBy: c.breachedBy ?? null }; }
  crimeView(me) {
    const c = this.crime, nm = this.phase.name, res = nm === "crime_result", reveal = res && c.reveal, seatV = this.seats.map((s) => ({ seat: s.seat, attrs: c.attrs[s.seat] })), al = {}; for (const k in c.alibi) { const a = c.alibi[k]; al[k] = { loc: a.loc, act: a.act, with: a.with }; }
    const v = { id: c.id, n: c.def.n, s: c.def.s, loc: c.def.loc, reopen: c.reopen, scale: c.scale, attrs: seatV, board: c.ev.filter((e) => e.shared).map((e) => ({ id: e.id, sharer: e.sharer ?? null, ...evText(e) })), slots: c.ev.map((e) => ({ id: e.id, src: evText(e).src, ic: evText(e).ic, r: evText(e).r, shared: e.shared, mine: me ? e.by.has(me.seat) : false })), alibi: al, checks: c.checks, asks: c.asks.map((a) => ({ id: a.id, by: a.by, target: a.target, q: a.q, a: a.a })), votedN: Object.keys(c.votes).length, accused: c.accused, defense: c.defense, finalN: Object.keys(c.finals).length, wrongPrev: c.wrongPrev };
    if (me) { const u = c.used[me.seat] || {}; v.mine = { points: c.points[me.seat] || 0, seen: c.ev.filter((e) => e.by.has(me.seat)).map((e) => ({ id: e.id, shared: e.shared, ...evText(e) })), real: c.real[me.seat], vote: c.votes[me.seat] ?? null, final: c.finals[me.seat] ?? null, alibiSet: !!c.alibi[me.seat], checksLeft: Math.max(0, (2 + (this.seats.length >= 10 ? 1 : 0)) - (u.check || 0)), asksLeft: Math.max(0, 2 - (u.ask || 0)), toAnswer: c.asks.filter((a) => a.target === me.seat && !a.a).map((a) => ({ id: a.id, q: a.q })), offers: c.offers.filter((o) => o.to === me.seat && !o.st).map((o) => ({ id: o.id, coin: o.coin })) }; if (c.culprit === me.seat) { v.mine.secret = "culprit"; v.mine.partner = c.accomplice; v.mine.unseen = c.ev.filter((e) => !e.shared).map((e) => ({ id: e.id, ...evText(e) })); } else if (c.accomplice === me.seat) { v.mine.secret = "accomplice"; v.mine.partner = c.culprit; v.mine.unseen = c.ev.filter((e) => !e.shared).map((e) => ({ id: e.id, ...evText(e) })); } }
    if (nm === "crime_final" || res) v.votesOpen = true;
    if (res) { v.res = { kind: c.res.kind, delta: c.res.delta, accused: c.accused, tally: c.res.tally, finals: Object.values(c.finals).reduce((o, x) => { o[x] = (o[x] || 0) + 1; return o; }, {}) }; if (reveal) { v.reveal = { culprit: c.culprit, accomplice: c.res.kind === "caught" || c.res.kind === "betray" ? c.accomplice : c.confessed === c.accomplice ? c.accomplice : null, outsider: c.outsider, motive: c.def.motive, outsiderText: c.def.outsider, decisive: c.ev.filter((e) => e.kind === "true").slice(0, 3).map((e) => evText(e)), planted: c.ev.filter((e) => e.planted != null).length, misleading: c.ev.filter((e) => e.kind === "misleading").length, target: c.target, confessed: c.confessed, betrayed: c.betrayed }; } }
    return v;
  }
}
export { QUESTIONS, ANSWERS, ATTRS, METRICS, ROLES, ACTIONS, PROGRAMS, CONTRACTS, LOCATIONS, PALETTE };
