// =========================
// DUO 증강 원카드 — 규칙 엔진 (2026-11-17)
// · 소켓과 분리된 순수 엔진: 시각(now)·난수(rng)를 받아서 시험·시뮬이 쉬움
// · 카드·손패·덱·차례·공격·증강·원카드 선언·승패를 전부 여기서 판정 (화면은 보여주기만)
// · 기본 카드 116장은 판 내내 덱·버린 더미·손패 어딘가에 정확히 1장씩 (checkInvariant)
//   증강이 만드는 카드는 token:true 로 따로 세고, 내면 사라짐(버린 더미를 덱으로 섞을 때 빠짐)
//
// [규칙 — 방 설정 화면에 그대로 표시]
// 1. 7장씩 나눠 받고, 맨 위 카드와 같은 색 또는 같은 숫자/같은 기호면 낼 수 있음. 색 변경 카드는 언제든(공격받는 중 제외)
// 2. 낼 카드가 없거나 내기 싫으면 1장 뽑기. 뽑은 카드를 낼 수 있으면 그 카드만 바로 낼 수 있음(설정)
// 3. 공격(+2 / 색변경 공격 +4)을 받으면: 공격 카드로 넘기기(중첩 설정) · 방어 카드로 막기(방어 설정) · 쌓인 만큼 뽑기
//    공격받는 중에는 색과 상관없이 아무 공격 카드·방어 카드나 낼 수 있음. 맞으면 차례 끝
// 4. 건너뛰기: 다음 사람 건너뜀 / 방향 전환: 진행 방향 반대 (2명이면 건너뛰기와 같음)
// 5. 손패가 1장이 되면 '원카드!'를 외쳐야 함. 2장일 때 내 차례에 미리 외치거나, 1장이 된 뒤 5초 안에 외치기
//    그 전에 다른 사람이 '잡았다!'를 누르거나 5초가 지나면 벌칙으로 N장(설정) 뽑기
// 6. 마지막 카드 제한(설정): 켜면 마지막 1장이 특수 카드일 땐 낼 수 없음
// 7. 파산(설정): 손패가 N장 이상이 되면 탈락, 그 카드는 덱 맨 아래로
// 8. 손패를 먼저 다 내면 1등, 게임 끝. 나머지는 손패 적은 순 (파산은 늦게 탈락한 순)
// =========================
import { randomInt, randomBytes } from "node:crypto";
import { AUG, COPYABLE, MAX_AUGS, PICK_EVERY, rollOffer, synergyOf } from "./onecard-augs.js";

export const COLORS = ["r", "b", "g", "y"];
export const COLOR_NAME = { r: "빨강", b: "파랑", g: "초록", y: "노랑" };
export const KIND_NAME = { num: "숫자", atk2: "공격 +2", def: "방어", skip: "건너뛰기", rev: "방향 전환", wild: "색 변경", wild4: "색변경 공격 +4" };
export const SPECIAL_KINDS = ["atk2", "def", "skip", "rev", "wild", "wild4"];
export const BASE_DECK_SIZE = 116;
const HAND0 = 7;
const PICK_MS = 15_000;
const ONE_WIN_MS = 5_000;
const PENDING_CAP = 16;
const LOG_MAX = 40;

export const DEFAULT_RULES = { stack: true, defense: true, lastSpecial: false, drawPlay: true, penalty: 2, bankrupt: 20, turnSec: 30 };
export const RULE_CHOICES = { penalty: [1, 2, 3], bankrupt: [0, 15, 20, 25], turnSec: [15, 20, 30, 45, 60] };

export const cryptoRng = () => randomInt(0, 2 ** 31) / 2 ** 31;
const isAtk = (c) => c.kind === "atk2" || c.kind === "wild4";
const isWild = (c) => c.kind === "wild" || c.kind === "wild4";
const isSpecial = (c) => c.kind !== "num";

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newId() { return "c" + randomBytes(5).toString("hex"); } // 카드 종류를 짐작할 수 없는 무작위 번호

export function buildDeck() {
  const d = [];
  for (const color of COLORS) {
    d.push({ color, kind: "num", n: 0 });
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) d.push({ color, kind: "num", n });
    for (const kind of ["atk2", "def", "skip", "rev"]) for (let k = 0; k < 2; k++) d.push({ color, kind, n: null });
  }
  for (let k = 0; k < 4; k++) { d.push({ color: null, kind: "wild", n: null }); d.push({ color: null, kind: "wild4", n: null }); }
  return d.map(c => ({ ...c, id: newId(), base: c.color }));
}
export const cardLabel = (c) => c.kind === "num" ? `${COLOR_NAME[c.color] || ""} ${c.n}` : `${c.color ? COLOR_NAME[c.color] + " " : ""}${KIND_NAME[c.kind]}`;
const pubCard = (c) => c ? { id: c.id, color: c.color, kind: c.kind, n: c.n, token: c.token || null } : null;

export class OneCardGame {
  /** players: [{ id, name, avatar, isBot, diff }] */
  constructor({ players, mode = "augment", rules = {}, rng = cryptoRng, now = Date.now() }) {
    this.mode = mode === "classic" ? "classic" : "augment";
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = rng;
    this.players = players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar || null, isBot: !!p.isBot, diff: p.diff || "normal",
      hand: [], augs: [], turnsDone: 0, out: false, outAt: 0, finished: false, offer: null, picked: true, refresh: 1,
      fx: { colorBan: null, sealed: {}, timeLord: 0, immune: 0, king: 0 },
      used: {}, colorStreak: { color: null, n: 0 }, stats: { played: 0, attacks: 0, maxAtk: 0, drawn: 0, augUsed: 0, blocked: 0 },
      connected: true, dcAt: 0, synCleanup: 3,
    }));
    this.deck = shuffle(buildDeck(), rng);
    this.discard = [];
    this.tokensMade = 0;
    this.dir = 1; this.turnIdx = 0; this.color = null;
    this.pending = null;       // { n, from, reflected }
    this.turn = null;
    this.phase = "deal"; this.pickIdx = -1; this.pickDeadline = 0; this.pickStartedAt = 0;
    this.oneWin = [];          // [{ uid, until, botAt, catchAt, catcher }]
    this.lastPlay = null;      // 시간 역행용
    this.lastActive = null;    // 전술 복제용 { uid, id }
    this.actSeq = 0;
    this.log = []; this.events = []; this.seq = 0;
    this.result = null; this.winner = null;
    this.startedAt = now; this._now = now;
    this.deal(now);
  }

  // ---------- 기본 도구 ----------
  P(uid) { return this.players.find(p => p.id === uid); }
  alive() { return this.players.filter(p => !p.out && !p.finished); }
  cur() { return this.players[this.turnIdx]; }
  top() { return this.discard[this.discard.length - 1] || null; }
  push(type, data = {}) { this.events.push({ type, seq: ++this.seq, ...data }); }
  addLog(text, uid = null) { this.log.push({ t: Date.now(), uid, text }); if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX); }
  aug(p, id) {
    if (this.mode !== "augment") return null;
    const a = p.augs.find(x => x.id === id);
    return a && !(a.sealed > 0) ? a : null;
  }
  charged(p, id) { const a = this.aug(p, id); return a && (a.charges === null || a.charges > 0) ? a : null; }
  spend(p, a) { if (a.charges !== null) a.charges--; p.used[a.id] = (p.used[a.id] || 0) + 1; p.stats.augUsed++; }
  syn(p) { return this.mode === "augment" ? synergyOf(p.augs.filter(a => !(a.sealed > 0)).map(a => a.id)) : []; }

  /** 덱에서 1장 (비면 버린 더미 맨 위만 남기고 섞음, 복제 카드는 사라짐) */
  drawOne() {
    if (!this.deck.length) this.reshuffle();
    return this.deck.pop() || null;
  }
  reshuffle() {
    if (this.discard.length <= 1) return;
    const keep = this.discard.pop();
    const back = this.discard.filter(c => !c.token).map(c => ({ ...c, color: c.base })); // 바뀐 색은 원래대로
    this.discard = [keep];
    this.deck = shuffle(back, this.rng).concat(this.deck);
    this.push("reshuffle", { n: back.length });
    this.addLog(`🔀 버린 카드 ${back.length}장을 섞어 덱으로`);
  }
  toBottom(cards) { for (const c of cards) if (!c.token) this.deck.unshift({ ...c, color: c.base }); }
  give(p, n, reason) {
    let got = 0;
    for (let i = 0; i < n; i++) { const c = this.drawOne(); if (!c) break; p.hand.push(c); got++; }
    p.stats.drawn += got;
    if (got) this.push("draw", { uid: p.id, n: got, reason });
    this.afterHandChange(p);
    this.checkBankrupt(p);
    return got;
  }
  takeFromHand(p, id) { const i = p.hand.findIndex(c => c.id === id); if (i < 0) return null; delete p.fx.sealed[id]; return p.hand.splice(i, 1)[0]; } // 손에서 나간 카드는 봉인 목록에서도 빠짐

  checkInvariant() {
    const all = [...this.deck, ...this.discard, ...this.players.flatMap(p => p.hand)].filter(c => !c.token);
    const ids = new Set(all.map(c => c.id));
    return all.length === BASE_DECK_SIZE && ids.size === BASE_DECK_SIZE;
  }

  // ---------- 시작 ----------
  deal(now) {
    for (let k = 0; k < HAND0; k++) for (const p of this.players) p.hand.push(this.drawOne());
    // 첫 카드는 숫자 카드가 나올 때까지 (특수 카드는 덱 아래로)
    let c = this.drawOne(), guard = 0;
    while (c && c.kind !== "num" && guard++ < 40) { this.deck.unshift(c); c = this.drawOne(); }
    this.discard.push(c); this.color = c.color;
    this.turnIdx = Math.floor(this.rng() * this.players.length);
    this.addLog(`게임 시작! ${this.mode === "augment" ? "증강 원카드" : "일반 원카드"} · ${this.players.length}명 · 첫 카드 ${cardLabel(c)}`);
    this.push("deal", { top: pubCard(c) });
    if (this.mode === "augment") this.startPick(0, now);
    else this.startTurn(now);
  }

  // ---------- 증강 고르기 ----------
  startPick(idx, now) { this._now = now;
    this.phase = "pick"; this.pickIdx = idx; this.turn = null;
    this.pickDeadline = now + PICK_MS; this.pickStartedAt = now;
    let any = false;
    for (const p of this.players) {
      // 끝난 사람(1등으로 나감·파산)은 고르지 않음
      if (p.out || p.finished || p.augs.length >= MAX_AUGS) { p.offer = null; p.picked = true; continue; }
      p.offer = rollOffer(idx, p.augs.map(a => a.id), { players: this.players.length, rng: this.rng });
      p.picked = !p.offer.length; if (!p.picked) any = true;
      p.botPickAt = now + 900 + Math.floor(this.rng() * 1500);
    }
    if (!any) { this.phase = "turn"; return this.startTurn(now); }
    this.push("pick", { idx, deadline: this.pickDeadline });
    this.addLog(idx === 0 ? "✨ 증강 고르기 — 3장 중 1장!" : `✨ 모두 ${idx * PICK_EVERY}차례 완료! 새 증강 고르기`);
  }
  pick(uid, id, now) { this._now = now;
    const p = this.P(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICK_PHASE" };
    if (!p.offer?.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    this.grant(p, id, false);
    this.finishPickIfDone(now);
    return { ok: true };
  }
  refreshOffer(uid) {
    const p = this.P(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICK_PHASE" };
    if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    p.refresh--;
    p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), { players: this.players.length, rng: this.rng });
    return { ok: true, offer: p.offer, refresh: p.refresh };
  }
  grant(p, id, auto) {
    const d = AUG[id];
    p.augs.push({ id, charges: d.charges ?? null, sealed: 0 });
    p.offer = null; p.picked = true;
    this.addLog(`${p.name}: ${d.name} [${({ common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" })[d.rarity]}]${auto ? " (자동)" : ""}`, p.id);
    this.push("augGet", { uid: p.id, id, auto });
    if (id === "luckyHand" && p.hand.length >= 3) {
      const out = [];
      for (let k = 0; k < 2; k++) out.push(p.hand.splice(Math.floor(this.rng() * p.hand.length), 1)[0]);
      for (const c of out) if (!c.token) this.deck.splice(Math.floor(this.rng() * (this.deck.length + 1)), 0, { ...c, color: c.base }); // 증강이 만든 카드는 덱에 안 넣고 사라짐
      this.give(p, 1, "luckyHand");
      this.addLog(`🍀 ${p.name}: 행운의 손패 — 손패 -1`, p.id);
    }
  }
  autoPick(p) {
    if (!p.offer?.length) { p.picked = true; return; }
    const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
    const best = [...p.offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0];
    this.grant(p, best, true);
  }
  finishPickIfDone(now) {
    if (this.phase !== "pick" || this.players.some(p => !p.picked)) return false;
    const paused = now - this.pickStartedAt;
    for (const w of this.oneWin) { w.until += paused; if (w.botAt) w.botAt += paused; if (w.catchAt) w.catchAt += paused; }
    this.push("picked", { idx: this.pickIdx });
    this.phase = "turn";
    this.startTurn(now);
    return true;
  }

  // ---------- 차례 ----------
  startTurn(now, { extra = false } = {}) { this._now = now;
    if (this.phase === "ended") return;
    this.phase = "turn";
    let guard = 0;
    while (guard++ <= this.players.length && (this.cur().out || this.cur().finished)) this.turnIdx = this.stepIdx(this.turnIdx, 1);
    const p = this.cur();
    // 내 차례 시작: 지속 효과 줄이기
    if (p.fx.colorBan) p.fx.colorBan.turns--; // 봉인 카드·시간 지배 등은 차례가 끝날 때 줄임
    let sec = this.rules.turnSec;
    if (p.fx.timeLord > 0) { sec = Math.max(8, Math.floor(sec / 2)); }
    this.turn = {
      uid: p.id, start: now, deadline: now + sec * 1000, sec, drawn: null, bonus: null, bonusUsed: {},
      augUsed: false, armed: {}, acted: false, preDeclared: false, extra,
      botAt: now + (p.isBot ? this.botDelay(p) : 5000), // 끊긴 사람은 5초 뒤 대신 둠
      startSeq: this.actSeq,
    };
    if (this.mode === "augment") this.turnStartAugs(p);
    if (this.phase === "ended") return;
    this.push("turn", { uid: p.id, deadline: this.turn.deadline, pending: this.pending?.n || 0, extra });
  }
  botDelay(p) { return 850 + Math.floor(this.rng() * (p.diff === "hard" ? 700 : 1100)); }
  turnStartAugs(p) {
    // 역전 준비
    if (p.hand.length >= 10) {
      const a = this.charged(p, "comebackPrep");
      if (a) { const c = this.randomNum(p); if (c) { this.spend(p, a); this.toBottom([this.takeFromHand(p, c.id)]); this.push("aug", { uid: p.id, id: "comebackPrep" }); this.addLog(`🔄 ${p.name}: 역전 준비 — 숫자 카드 1장 정리`, p.id); } }
    }
    // 손패 시너지
    if (p.hand.length >= 8 && p.synCleanup > 0 && this.syn(p).includes("hand")) {
      const c = this.randomNum(p); if (c) { p.synCleanup--; this.toBottom([this.takeFromHand(p, c.id)]); this.push("synergy", { uid: p.id, tag: "hand" }); this.addLog(`🃏 ${p.name}: 손패 시너지 — 숫자 카드 1장 정리`, p.id); }
    }
    // 최후의 역전
    const most = Math.max(...this.alive().map(q => q.hand.length));
    if (p.hand.length >= 8 && p.hand.length >= most) {
      const a = this.charged(p, "lastStand");
      if (a) {
        this.spend(p, a);
        const nums = p.hand.filter(c => c.kind === "num");
        const k = Math.min(Math.floor(nums.length / 2), p.hand.length - 2);
        shuffle(nums, this.rng).slice(0, Math.max(0, k)).forEach(c => this.toBottom([this.takeFromHand(p, c.id)]));
        p.fx.immune = 2;
        this.push("aug", { uid: p.id, id: "lastStand", big: true });
        this.addLog(`🔥 ${p.name}: 최후의 역전! 숫자 카드 ${Math.max(0, k)}장 정리 + 2차례 공격 면역`, p.id);
        this.afterHandChange(p);
      }
    }
  }
  randomNum(p) { const nums = p.hand.filter(c => c.kind === "num"); return nums.length ? nums[Math.floor(this.rng() * nums.length)] : null; }
  stepIdx(i, s) { const n = this.players.length; return ((i + s * this.dir) % n + n) % n; }
  nextAliveIdx(from, skip = 0) {
    let i = from, left = skip + 1, guard = 0;
    while (left > 0 && guard++ < this.players.length * 4) { i = this.stepIdx(i, 1); const q = this.players[i]; if (!q.out && !q.finished) left--; }
    return i;
  }
  nextPlayer(uid = this.cur().id) { return this.players[this.nextAliveIdx(this.players.findIndex(p => p.id === uid))]; }

  /** 차례 끝 — skip: 건너뛸 사람 수 */
  endTurn(now, { skip = 0, extraTurn = false, jumpTo = null } = {}) {
    const p = this.cur();
    const t = this.turn;
    p.turnsDone++;
    // 이번 차례 지속 효과 줄이기 (내 차례가 지날 때마다)
    if (p.fx.colorBan && p.fx.colorBan.turns <= 0) p.fx.colorBan = null;
    for (const id of Object.keys(p.fx.sealed)) if (--p.fx.sealed[id] <= 0) delete p.fx.sealed[id];
    if (p.fx.timeLord > 0) p.fx.timeLord--;
    if (p.fx.immune > 0) p.fx.immune--;
    if (p.fx.king > 0) p.fx.king--;
    for (const a of p.augs) if (a.sealed > 0) a.sealed--;
    this.turn = null;
    if (this.phase === "ended") return;
    if (this.alive().length <= 1) return this.finish(now);
    // 다음 사람
    if (jumpTo) this.turnIdx = this.players.findIndex(q => q.id === jumpTo);
    else if (!extraTurn) this.turnIdx = this.nextAliveIdx(this.turnIdx, skip);
    // 증강 고르기: 남은 모두가 3차례씩 더 마쳤을 때
    if (this.mode === "augment") {
      const need = (this.pickIdx + 1) * PICK_EVERY;
      const al = this.alive();
      if (this.pickIdx < 4 && al.length && al.every(q => q.turnsDone >= need) && al.some(q => q.augs.length < MAX_AUGS)) return this.startPick(this.pickIdx + 1, now);
    }
    this.startTurn(now, { extra: extraTurn });
  }

  // ---------- 낼 수 있는지 ----------
  canPlay(p, c, { ignorePhase = false } = {}) {
    if (!c) return false;
    if (p.fx.sealed[c.id]) return false;
    if (this.rules.lastSpecial && p.hand.length === 1 && isSpecial(c)) return false;
    if (p.fx.colorBan && p.fx.colorBan.turns >= 0 && c.color === p.fx.colorBan.color && !isWild(c)) return false;
    const t = this.turn;
    if (!ignorePhase && t) {
      if (t.drawn) { if (c.id !== t.drawn) return false; }
      if (t.bonus) {
        if (t.bonus.kind === "num") return c.kind === "num" && c.n === t.bonus.n;
        if (t.bonus.kind === "atk") return isAtk(c);
      }
    }
    if (this.pending) return (isAtk(c) && this.rules.stack) || (c.kind === "def" && this.rules.defense);
    if (isWild(c)) return true;
    const top = this.top();
    if (c.color === this.color) return true;
    if (!top) return true;
    if (c.kind === "num" && top.kind === "num") {
      if (c.n === top.n) return true;
      if (p.fx.king > 0 && Math.abs(c.n - top.n) === 1) return true;
      return false;
    }
    return c.kind !== "num" && c.kind === top.kind;
  }
  playable(p) { return p.hand.filter(c => this.canPlay(p, c)).map(c => c.id); }

  // ---------- 행동: 카드 내기 ----------
  play(uid, cardId, chosenColor, now) { this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.phase !== "turn" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    const c = p.hand.find(x => x.id === cardId);
    if (!c) return { ok: false, error: "NO_CARD" };
    if (p.fx.sealed[c.id]) return { ok: false, error: "SEALED" };
    if (this.rules.lastSpecial && p.hand.length === 1 && isSpecial(c)) return { ok: false, error: "LAST_SPECIAL" };
    if (!this.canPlay(p, c)) return { ok: false, error: this.pending ? "MUST_ANSWER_ATTACK" : "CANT_PLAY" };
    if (isWild(c) && !COLORS.includes(chosenColor)) return { ok: false, error: "PICK_COLOR" };
    // 시간 역행용 기록
    const snap = { uid, card: c, color: this.color, dir: this.dir, pending: this.pending ? { ...this.pending } : null, turnIdx: this.turnIdx };
    this.takeFromHand(p, c.id);
    this.discard.push(c);
    this.color = isWild(c) ? chosenColor : c.color;
    p.stats.played++;
    t.acted = true; t.drawn = null;
    const wasBonus = t.bonus; t.bonus = null;
    this.actSeq++;
    this.lastPlay = { ...snap, seq: this.actSeq };
    let skip = 0, extraTurn = false, atkAdd = 0;
    const ev = { uid, card: pubCard(c), color: this.color };
    // 효과
    if (isAtk(c)) {
      atkAdd = this.attackAmount(p, c);
      const before = this.pending?.n || 0;
      this.pending = { n: Math.min(PENDING_CAP, before + atkAdd), from: uid, reflected: false };
      p.stats.attacks++; p.stats.maxAtk = Math.max(p.stats.maxAtk, this.pending.n);
      ev.atk = atkAdd; ev.pending = this.pending.n;
    } else if (c.kind === "def") {
      if (this.pending) { ev.blocked = this.pending.n; p.stats.blocked++; this.pending = null; }
    } else if (c.kind === "skip") {
      skip = p.fx.king > 0 ? 2 : 1;
      ev.skip = skip;
    } else if (c.kind === "rev") {
      if (this.alive().length === 2) { skip = 1; ev.skip = 1; }
      else { this.dir *= -1; }
      ev.dir = this.dir;
    }
    this.push("play", ev);
    this.addLog(`${p.name}: ${cardLabel(c)}${isWild(c) ? ` → ${COLOR_NAME[this.color]}` : ""}${ev.atk ? ` (공격 +${ev.atk}, 쌓임 ${ev.pending})` : ""}${ev.blocked ? ` 🛡️ ${ev.blocked}장 막음` : ""}`, uid);
    // 이겼나
    if (p.hand.length === 0) { this.finishBy(p, now); return { ok: true, win: true }; }
    // 색상 전문가: 색 변경 뒤 그 색 숫자 1장 같이 버림
    if (isWild(c) && p.hand.length >= 3 && this.aug(p, "colorExpert")) {
      const same = p.hand.filter(x => x.kind === "num" && x.color === this.color).sort((a, b) => b.n - a.n)[0];
      if (same) { this.takeFromHand(p, same.id); this.discard.splice(this.discard.length - 1, 0, same); this.push("aug", { uid, id: "colorExpert", card: pubCard(same) }); this.addLog(`🎨 ${p.name}: 색상 전문가 — ${cardLabel(same)} 같이 버림`, uid); }
    }
    this.afterHandChange(p, t.preDeclared);
    // 턴 가속 (같은 색 3차례 연속)
    if (!wasBonus) {
      const col = c.color || this.color;
      if (p.colorStreak.color === col) p.colorStreak.n++; else p.colorStreak = { color: col, n: 1 };
      if (p.colorStreak.n >= 3 && !t.extra) { const a = this.charged(p, "turnAccel"); if (a) { this.spend(p, a); extraTurn = true; p.colorStreak = { color: null, n: 0 }; this.push("aug", { uid, id: "turnAccel" }); this.addLog(`⏩ ${p.name}: 턴 가속 — 추가 차례!`, uid); } }
    }
    // 이어 내기 (연속 플레이·연쇄 공격) — 한 차례 각 1번
    if (c.kind === "num" && !t.bonusUsed.combo && this.aug(p, "comboPlay") && p.hand.some(x => x.kind === "num" && x.n === c.n && !p.fx.sealed[x.id])) {
      t.bonusUsed.combo = true; t.bonus = { kind: "num", n: c.n, reason: "comboPlay", skip, extraTurn };
    } else if (isAtk(c) && !t.bonusUsed.chain && this.charged(p, "chainAtk") && p.hand.some(x => isAtk(x) && !p.fx.sealed[x.id])) {
      t.bonusUsed.chain = true; this.spend(p, this.aug(p, "chainAtk")); t.bonus = { kind: "atk", reason: "chainAtk", skip, extraTurn };
    }
    if (t.bonus) {
      // 이어 내기 전 건너뛰기 수는 마지막 카드 기준이 아니라 합침
      if (wasBonus) { t.bonus.skip += wasBonus.skip || 0; t.bonus.extraTurn = t.bonus.extraTurn || wasBonus.extraTurn; }
      t.deadline = Math.max(t.deadline, now + 8000);
      this.push("bonus", { uid, kind: t.bonus.kind, n: t.bonus.n ?? null, reason: t.bonus.reason });
      return { ok: true, bonus: true };
    }
    if (wasBonus) { skip += wasBonus.skip || 0; extraTurn = extraTurn || wasBonus.extraTurn; }
    // 쓰지 않은 켜기형은 횟수 그대로 (공격 카드에 쓰였으면 attackAmount에서 이미 씀)
    this.endTurn(now, { skip, extraTurn });
    return { ok: true };
  }
  /** 공격 장수: 기본(2/4) + 고정 보너스 → 이중 공격 ×2 */
  attackAmount(p, c) {
    let n = c.kind === "wild4" ? 4 : 2;
    const used = [];
    if (this.mode === "augment") {
      const t = this.turn;
      const prep = this.charged(p, "attackPrep"); if (prep) { this.spend(p, prep); n += 1; used.push("attackPrep"); }
      if (this.aug(p, "master")) { n += 1; used.push("master"); }
      if (p.fx.king > 0) { n += 1; used.push("cardKing"); }
      if (this.syn(p).includes("atk")) { n += 1; used.push("synAtk"); }
      if (t?.armed.atkAmp) { const a = this.charged(p, "atkAmp"); if (a) { this.spend(p, a); n += 2; used.push("atkAmp"); } t.armed.atkAmp = false; }
      if (t?.armed.doubleAtk) { const a = this.charged(p, "doubleAtk"); if (a) { this.spend(p, a); n *= 2; used.push("doubleAtk"); } t.armed.doubleAtk = false; }
    }
    if (used.length) this.push("atkBoost", { uid: p.id, used, n });
    return Math.min(n, 12);
  }

  // ---------- 행동: 뽑기 / 공격 맞기 ----------
  draw(uid, now) { this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.phase !== "turn" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    if (this.pending) return this.takeAttack(uid, null, now);
    if (t.drawn) return { ok: false, error: "ALREADY_DREW" };
    if (t.bonus) return this.pass(uid, now);
    t.acted = true; this.actSeq++;
    let c;
    if (this.aug(p, "quickDraw")) {
      const a = this.drawOne(), b = this.drawOne();
      const cand = [a, b].filter(Boolean);
      c = cand.find(x => this.canPlay(p, x, { ignorePhase: true })) || cand[0];
      const rest = cand.filter(x => x !== c);
      this.toBottom(rest);
      if (c && rest.length) this.push("aug", { uid, id: "quickDraw", quiet: true });
    } else c = this.drawOne();
    if (!c) { this.addLog(`${p.name}: 뽑을 카드가 없어요`, uid); this.endTurn(now); return { ok: true, empty: true }; }
    p.hand.push(c); p.stats.drawn++;
    this.push("draw", { uid, n: 1, reason: "draw" });
    this.addLog(`${p.name}: 1장 뽑음`, uid);
    this.afterHandChange(p);
    if (this.checkBankrupt(p)) return { ok: true };
    if (this.rules.drawPlay && this.canPlay(p, c, { ignorePhase: true })) {
      t.drawn = c.id;
      t.deadline = Math.max(t.deadline, now + 8000);
      return { ok: true, drawn: c.id, canPlay: true };
    }
    this.endTurn(now);
    return { ok: true, drawn: c.id, canPlay: false };
  }
  pass(uid, now) { this._now = now;
    const t = this.turn;
    if (this.phase !== "turn" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    if (!t.drawn && !t.bonus) return { ok: false, error: "CANT_PASS" };
    const b = t.bonus;
    t.drawn = null; t.bonus = null;
    this.endTurn(now, { skip: b?.skip || 0, extraTurn: !!b?.extraTurn });
    return { ok: true };
  }
  /** 공격 맞기. react = 반응형 증강 id(공격 반사·공격 무효화·완벽한 방어·절대 반사) 또는 null */
  takeAttack(uid, react, now) { this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.phase !== "turn" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    if (!this.pending) return { ok: false, error: "NO_ATTACK" };
    if (t.drawn || t.bonus) return { ok: false, error: "CANT_NOW" };
    const pend = this.pending, n = pend.n;
    const from = this.P(pend.from);
    const canBack = from && from.id !== uid && !from.out && !from.finished;
    t.acted = true; this.actSeq++;
    if (react) {
      const d = AUG[react];
      if (!d || d.kind !== "reaction") return { ok: false, error: "NO_AUG" };
      const a = this.charged(p, react);
      if (!a) return { ok: false, error: "NO_CHARGES" };
      if ((react === "reflect" || react === "absReflect") && (pend.reflected || !canBack)) return { ok: false, error: "CANT_REFLECT" };
      if (react === "atkNull" && n > 6) return { ok: false, error: "TOO_BIG" };
      this.spend(p, a);
      p.stats.blocked++;
      if (react === "atkNull" || react === "perfectDef") {
        this.pending = null;
        this.push("react", { uid, id: react, n });
        this.addLog(`🛡️ ${p.name}: ${d.name} — 공격 ${n}장 막음`, uid);
        if (react === "perfectDef" && p.hand.length >= 3) { const c = this.randomNum(p); if (c) { this.toBottom([this.takeFromHand(p, c.id)]); this.afterHandChange(p); } }
        t.acted = false; // 막고 이어서 내 차례
        t.deadline = Math.max(t.deadline, now + 10000);
        return { ok: true, blocked: true };
      }
      // 반사: 공격한 사람 차례로 넘어감
      const back = react === "absReflect" ? Math.min(PENDING_CAP, n + 2) : Math.ceil(n / 2);
      const mine = react === "absReflect" ? 0 : n - back;
      this.push("react", { uid, id: react, n, back, to: from.id });
      this.addLog(`↩️ ${p.name}: ${d.name} — ${from.name}에게 ${back}장 되돌림${mine ? `, 나는 ${mine}장` : ""}`, uid);
      this.pending = null;
      if (mine) this.give(p, mine, "attack");
      if (this.phase === "ended" || p.out) return { ok: true };
      if (from.out || from.finished) { this.endTurn(now); return { ok: true }; }
      this.pending = { n: back, from: uid, reflected: true };
      this.endTurn(now, { jumpTo: from.id });
      return { ok: true, reflected: true };
    }
    // 자동 반응 (우선순위대로 하나)
    let take = n, auto = null;
    if (this.mode === "augment") {
      if (p.fx.immune > 0) { take = 0; auto = "lastStand"; }
      else if (p.hand.length === 1 && this.charged(p, "lastOne")) { this.spend(p, this.aug(p, "lastOne")); take = 0; auto = "lastOne"; }
      else if (this.charged(p, "master")) { this.spend(p, this.aug(p, "master")); take = Math.floor(n / 2); auto = "master"; }
      else if (n >= 4 && this.charged(p, "defInstinct")) { this.spend(p, this.aug(p, "defInstinct")); take = Math.floor(n / 2); auto = "defInstinct"; }
      else if (this.syn(p).includes("def") && n >= 2) { take = n - 1; auto = "synDef"; }
    }
    this.pending = null;
    if (auto) this.push("autoReact", { uid, id: auto, n, take });
    this.addLog(`💥 ${p.name}: 공격 ${n}장${auto ? ` → ${take}장 (${auto === "synDef" ? "방어 시너지" : AUG[auto].name})` : ""}`, uid);
    if (take > 0) this.give(p, take, "attack");
    if (this.phase === "ended") return { ok: true };
    if (!p.out) this.endTurn(now);
    return { ok: true, took: take };
  }

  // ---------- 원카드 선언 ----------
  afterHandChange(p, preDeclared = false) {
    if (this.phase === "ended") return;
    const w = this.oneWin.find(x => x.uid === p.id);
    if (p.hand.length !== 1 || p.out || p.finished) { if (w) this.oneWin = this.oneWin.filter(x => x !== w); return; }
    if (w) return;
    const auto = this.aug(p, "lastOne") || this.aug(p, "master");
    if (preDeclared || auto) { this.push("onecard", { uid: p.id, k: "safe", auto: !!auto && !preDeclared }); this.addLog(`☝️ ${p.name}: 원카드!${auto && !preDeclared ? " (증강 자동)" : ""}`, p.id); return; }
    const now = this._now ?? Date.now();
    const win = { uid: p.id, until: now + ONE_WIN_MS };
    if (p.isBot) win.botAt = now + (p.diff === "easy" ? 900 + this.rng() * 3800 : p.diff === "hard" ? 500 + this.rng() * 900 : 700 + this.rng() * 1800);
    // 가장 빠른 봇 한 명이 잡으러 옴
    const bots = this.players.filter(q => q.isBot && q.id !== p.id && !q.out && !q.finished);
    if (bots.length) {
      const b = bots[Math.floor(this.rng() * bots.length)];
      win.catchAt = now + (b.diff === "hard" ? 1700 : b.diff === "easy" ? 3300 : 2400) + this.rng() * 1400;
      win.catcher = b.id;
    }
    this.oneWin.push(win);
    this.push("onecard", { uid: p.id, k: "open", until: win.until });
  }
  declare(uid, now) { this._now = now;
    const p = this.P(uid);
    if (!p || this.phase === "ended") return { ok: false, error: "NOT_PLAYING" };
    const w = this.oneWin.find(x => x.uid === uid);
    if (w) {
      this.oneWin = this.oneWin.filter(x => x !== w);
      this.push("onecard", { uid, k: "declared" });
      this.addLog(`☝️ ${p.name}: 원카드!`, uid);
      return { ok: true };
    }
    const t = this.turn;
    if (t && t.uid === uid && p.hand.length === 2 && !t.preDeclared) { t.preDeclared = true; this.push("onecard", { uid, k: "pre" }); return { ok: true, pre: true }; }
    return { ok: false, error: "NOT_ONE_CARD" };
  }
  catchOne(byUid, targetUid, now) { this._now = now;
    const by = this.P(byUid);
    if (!by || this.phase === "ended") return { ok: false, error: "NOT_PLAYING" };
    if (by.out || by.left) return { ok: false, error: "OUT" }; // 파산·나간 사람은 잡기 못 함
    const w = this.oneWin.find(x => x.uid === targetUid && x.uid !== byUid);
    if (!w) return { ok: false, error: "TOO_LATE" };
    this.oneWin = this.oneWin.filter(x => x !== w);
    const p = this.P(targetUid);
    this.push("onecard", { uid: targetUid, k: "caught", by: byUid });
    this.addLog(`🫵 ${by.name}: 잡았다! ${p.name} 벌칙 ${this.rules.penalty}장`, byUid);
    this.give(p, this.rules.penalty, "penalty");
    return { ok: true };
  }

  // ---------- 증강 사용 ----------
  useAug(uid, pl, now) { this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (this.phase !== "turn" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    let id = String(pl?.id || "");
    const d = AUG[id];
    if (!d) return { ok: false, error: "NO_AUG" };
    if (!p.augs.some(a => a.id === id)) return { ok: false, error: "NO_AUG" };
    const a = this.aug(p, id);
    if (!a) return { ok: false, error: "AUG_SEALED" };
    if (d.kind === "arm") {
      if (!this.charged(p, id)) return { ok: false, error: "NO_CHARGES" };
      t.armed[id] = !t.armed[id];
      return { ok: true, armed: t.armed[id] };
    }
    if (d.kind !== "active") return { ok: false, error: "PASSIVE" };
    if (!this.charged(p, id)) return { ok: false, error: "NO_CHARGES" };
    if (t.augUsed) return { ok: false, error: "AUG_USED" };
    if (t.drawn || t.bonus) return { ok: false, error: "CANT_NOW" };
    if (this.pending && !d.whenAtk) return { ok: false, error: "UNDER_ATTACK" };
    let as = id;
    if (id === "tacticCopy") {
      const la = this.lastActive;
      if (!la || la.uid === uid || !COPYABLE.has(la.id)) return { ok: false, error: "NOTHING_TO_COPY" };
      as = la.id;
      if (this.pending && !AUG[as].whenAtk) return { ok: false, error: "UNDER_ATTACK" };
    }
    const r = this.applyActive(p, as, pl, now);
    if (!r.ok) return r;
    this.spend(p, a);
    t.augUsed = true;
    if (id !== "tacticCopy") this.lastActive = { uid, id };
    this.actSeq++;
    this.push("aug", { uid, id, as: as !== id ? as : null, target: r.target || null, color: r.color || null, big: d.rarity === "legendary" });
    this.addLog(`${p.name}: ${d.name}${as !== id ? `(${AUG[as].name})` : ""}${r.text ? " — " + r.text : ""}`, uid);
    if (this.phase === "ended") return { ok: true };
    if (r.after) r.after();
    return { ok: true };
  }
  applyActive(p, id, pl, now) {
    const t = this.turn;
    const card = () => p.hand.find(c => c.id === pl?.card);
    const target = () => { const q = this.P(pl?.target); return q && q.id !== p.id && !q.out && !q.finished ? q : null; };
    const color = COLORS.includes(pl?.color) ? pl.color : null;
    const ctlBonus = this.syn(p).includes("ctl") ? 1 : 0;
    switch (id) {
      case "sortTactics": {
        const c = card(); if (!c) return { ok: false, error: "NO_CARD" };
        this.toBottom([this.takeFromHand(p, c.id)]); this.give(p, 1, "aug");
        return { ok: true, text: "1장 교체" };
      }
      case "cardCopy": {
        const c = card(); if (!c || c.kind !== "num") return { ok: false, error: "NEED_NUM" };
        const top = this.top(); if (!top) return { ok: false, error: "NO_TOP" };
        this.toBottom([this.takeFromHand(p, c.id)]);
        const tok = { id: newId(), color: isWild(top) ? null : top.color, base: null, kind: top.kind, n: top.n, token: "copy" };
        p.hand.push(tok); this.tokensMade++;
        this.afterHandChange(p);
        return { ok: true, text: `${cardLabel(top)} 복제` };
      }
      case "colorSeal": {
        if (!color) return { ok: false, error: "PICK_COLOR" };
        const q = this.nextPlayer(p.id); if (!q || q === p) return { ok: false, error: "NO_TARGET" };
        q.fx.colorBan = { color, turns: 1 + ctlBonus };
        return { ok: true, target: q.id, color, text: `${q.name} ${COLOR_NAME[color]} 봉인` };
      }
      case "handSwap": {
        const c = card(), q = target(); if (!c) return { ok: false, error: "NO_CARD" }; if (!q || !q.hand.length) return { ok: false, error: "NO_TARGET" };
        const theirs = q.hand[Math.floor(this.rng() * q.hand.length)];
        this.takeFromHand(p, c.id); this.takeFromHand(q, theirs.id);
        p.hand.push(theirs); q.hand.push(c);
        delete q.fx.sealed[theirs.id];
        this.afterHandChange(p); this.afterHandChange(q);
        return { ok: true, target: q.id, text: `${q.name}와 1장 교환` };
      }
      case "steal": {
        const q = target(); if (!q || q.hand.length < 2) return { ok: false, error: "NO_TARGET" };
        const c = q.hand[Math.floor(this.rng() * q.hand.length)];
        this.takeFromHand(q, c.id); delete q.fx.sealed[c.id]; p.hand.push(c);
        this.afterHandChange(q); this.afterHandChange(p);
        return { ok: true, target: q.id, text: `${q.name}의 카드 1장`, after: () => this.checkBankrupt(p) };
      }
      case "transform": {
        const c = card(); if (!c || c.kind !== "num") return { ok: false, error: "NEED_NUM" };
        if (!color || color === c.color) return { ok: false, error: "PICK_COLOR" };
        c.color = color;
        return { ok: true, color, text: `${c.n} → ${COLOR_NAME[color]}` };
      }
      case "dirControl": this.dir *= -1; return { ok: true, text: "방향 전환" };
      case "handStorm": {
        const others = this.alive().filter(q => q.id !== p.id);
        return { ok: true, text: `${others.length}명 1장씩`, after: () => { for (const q of others) { if (this.phase === "ended") break; this.give(q, 1, "aug"); } if (this.phase !== "ended" && this.alive().length <= 1) this.finish(now); } };
      }
      case "reconstruct": {
        const nums = p.hand.filter(c => c.kind === "num");
        if (p.hand.length < 3 || !nums.length) return { ok: false, error: "CANT_NOW" };
        for (const c of nums) { this.takeFromHand(p, c.id); if (!c.token) this.deck.splice(Math.floor(this.rng() * (this.deck.length + 1)), 0, { ...c, color: c.base }); } // 토큰은 사라짐 (덱에 섞이면 복제 카드가 계속 돌았음)
        const k = nums.length - 1;
        if (k > 0) this.give(p, k, "aug"); else this.afterHandChange(p);
        if (!p.hand.length) this.give(p, 1, "aug"); // 손패가 0이 되지 않게 (증강으로 이기기 금지)
        return { ok: true, text: `${nums.length}장 → ${Math.max(1, k)}장` };
      }
      case "forceSwap": {
        const q = target(); if (!q || q.hand.length < 2 || p.hand.length < 2) return { ok: false, error: "NO_TARGET" };
        const mine = shuffle([...p.hand], this.rng).slice(0, 2), theirs = shuffle([...q.hand], this.rng).slice(0, 2);
        for (const c of mine) { this.takeFromHand(p, c.id); delete p.fx.sealed[c.id]; q.hand.push(c); }
        for (const c of theirs) { this.takeFromHand(q, c.id); delete q.fx.sealed[c.id]; p.hand.push(c); }
        return { ok: true, target: q.id, text: `${q.name}와 2장씩 교환` };
      }
      case "cardSeal": {
        const q = target(); if (!q || q.hand.length < 2) return { ok: false, error: "NO_TARGET" };
        const free = q.hand.filter(c => !q.fx.sealed[c.id]);
        shuffle(free, this.rng).slice(0, 2).forEach(c => { q.fx.sealed[c.id] = 2 + ctlBonus; });
        return { ok: true, target: q.id, text: `${q.name} 카드 2장 봉인` };
      }
      case "timeLord": {
        const q = target(); if (!q) return { ok: false, error: "NO_TARGET" };
        q.fx.timeLord = 3 + ctlBonus;
        return { ok: true, target: q.id, text: `${q.name} 시간 절반` };
      }
      case "fateHand": {
        const nums = shuffle(p.hand.filter(c => c.kind === "num"), this.rng).slice(0, 2);
        if (!nums.length) return { ok: false, error: "NEED_NUM" };
        for (const c of nums) { this.takeFromHand(p, c.id); delete p.fx.sealed[c.id]; this.toBottom([c]); p.hand.push({ id: newId(), color: null, base: null, kind: "wild", n: null, token: "fate" }); this.tokensMade++; }
        return { ok: true, text: `운명 카드 ${nums.length}장` };
      }
      case "cardKing": p.fx.king = 3; return { ok: true, text: "3차례 강화" };
      case "timeRewind": {
        const lp = this.lastPlay;
        if (!lp || lp.uid === p.id || lp.seq !== this.actSeq || t.startSeq !== this.actSeq || t.acted) return { ok: false, error: "CANT_REWIND" };
        const q = this.P(lp.uid);
        if (!q || q.out || q.finished || this.top()?.id !== lp.card.id) return { ok: false, error: "CANT_REWIND" };
        this.discard.pop(); q.hand.push(lp.card);
        this.color = lp.color; this.dir = lp.dir; this.pending = null; // 그 카드의 효과(공격 포함)는 전부 취소
        this.lastPlay = null;
        this.afterHandChange(q);
        return { ok: true, target: q.id, text: `${q.name}의 ${cardLabel(lp.card)} 되돌림` };
      }
      case "battlefield": {
        if (!color) return { ok: false, error: "PICK_COLOR" };
        this.dir *= -1; this.color = color;
        return { ok: true, color, text: `방향 전환 + ${COLOR_NAME[color]}` };
      }
      case "revolution": {
        const al = this.alive();
        const total = al.reduce((s, q) => s + q.hand.length, 0);
        if (p.hand.length * al.length <= total) return { ok: false, error: "NOT_MORE_THAN_AVG" };
        const order = [...al].sort((a, b) => b.hand.length - a.hand.length);
        const pool = shuffle(al.flatMap(q => q.hand), this.rng);
        for (const q of al) { q.hand = []; q.fx.sealed = {}; }
        const base = Math.floor(total / al.length); let rem = total - base * al.length;
        for (const q of order) { const k = base + (rem > 0 ? 1 : 0); if (rem > 0) rem--; q.hand = pool.splice(0, k); }
        for (const q of al) this.afterHandChange(q);
        return { ok: true, text: `${total}장을 ${al.length}명이 나눔` };
      }
      case "godDraw": {
        const kind = String(pl?.kind || "");
        if (!["atk2", "def", "skip", "rev", "wild", "wild4"].includes(kind)) return { ok: false, error: "PICK_KIND" };
        const i = this.deck.findIndex(c => c.kind === kind);
        let c;
        if (i >= 0) c = this.deck.splice(i, 1)[0];
        else { c = { id: newId(), color: isWild({ kind }) ? null : COLORS[Math.floor(this.rng() * 4)], base: null, kind, n: null, token: "god" }; this.tokensMade++; }
        p.hand.push(c); this.afterHandChange(p);
        return { ok: true, text: KIND_NAME[kind], after: () => this.checkBankrupt(p) };
      }
      case "absSeal": {
        const q = target(); if (!q) return { ok: false, error: "NO_TARGET" };
        const ta = q.augs.find(x => x.id === pl?.aug);
        if (!ta) return { ok: false, error: "NO_AUG" };
        ta.sealed = 4 + ctlBonus;
        return { ok: true, target: q.id, text: `${q.name}의 ${AUG[ta.id].name} 봉인` };
      }
    }
    return { ok: false, error: "NO_AUG" };
  }

  // ---------- 파산·승리 ----------
  checkBankrupt(p) {
    if (!this.rules.bankrupt || p.out || p.finished || p.hand.length < this.rules.bankrupt || this.phase === "ended") return false;
    p.out = true; p.outAt = this.actSeq + 1; this.actSeq++;
    const cards = p.hand; p.hand = []; p.fx.sealed = {};
    this.toBottom(cards);
    this.oneWin = this.oneWin.filter(x => x.uid !== p.id);
    this.push("bankrupt", { uid: p.id, n: cards.length });
    this.addLog(`💀 ${p.name}: 파산! (${cards.length}장)`, p.id);
    if (this.alive().length <= 1) { this.finish(this._now ?? Date.now()); return true; }
    if (this.turn?.uid === p.id) { this.pending = null; this.endTurn(this._now ?? Date.now()); }
    return true;
  }
  finishBy(p, now) {
    p.finished = true; this.winner = p.id;
    this.push("win", { uid: p.id });
    this.addLog(`🏆 ${p.name}: 손패를 다 냈어요!`, p.id);
    this.finish(now);
  }
  finish(now) {
    if (this.phase === "ended") return;
    if (!this.winner) { const al = this.alive(); if (al.length === 1) this.winner = al[0].id; }
    this.phase = "ended"; this.turn = null; this.oneWin = []; this.pending = null;
    const rows = this.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, left: !!p.left,
      cards: p.hand.length, out: p.out, outAt: p.outAt, win: p.id === this.winner,
      augs: p.augs.map(a => a.id), stats: { ...p.stats },
    }));
    rows.sort((a, b) => (b.win - a.win) || (Number(a.left) - Number(b.left)) || (Number(a.out) - Number(b.out)) || (a.out ? b.outAt - a.outAt : a.cards - b.cards));
    let rank = 0, prevKey = null;
    rows.forEach((r, i) => { const key = r.win ? "w" : r.left ? "l" + i : r.out ? "o" + r.outAt : "c" + r.cards; if (key !== prevKey) rank = i + 1; r.rank = rank; prevKey = key; });
    this.result = { mode: this.mode, rows, at: now, winner: this.winner };
    this.push("end", { winner: this.winner });
  }

  /** 나간 사람: 카드는 덱 아래로, 차례면 넘김 */
  leave(uid, now) { this._now = now;
    const p = this.P(uid); if (!p || p.left) return;
    p.left = true;
    if (this.phase === "ended") return;
    const wasTurn = this.turn?.uid === uid;
    p.out = true; p.outAt = 0;
    this.toBottom(p.hand); p.hand = []; p.offer = null; p.picked = true;
    this.oneWin = this.oneWin.filter(x => x.uid !== uid);
    this.addLog(`${p.name}님이 나갔어요`);
    if (this.alive().length <= 1) return this.finish(now);
    if (this.phase === "pick") return this.finishPickIfDone(now);
    if (this.pending?.from === uid) this.pending.from = null;
    if (wasTurn) this.endTurn(now);
  }

  // ---------- 시간 흐름 (방이 200ms마다 부름) ----------
  tick(now) { this._now = now;
    if (this.phase === "ended") return;
    if (this.phase === "pick") {
      for (const p of this.players) if (!p.picked && (p.isBot || !p.connected) && now >= (p.botPickAt || 0)) this.autoPick(p);
      if (now >= this.pickDeadline) for (const p of this.players) if (!p.picked) this.autoPick(p);
      this.finishPickIfDone(now);
      return;
    }
    // 원카드 창
    for (const w of [...this.oneWin]) {
      if (!this.oneWin.includes(w)) continue;
      const p = this.P(w.uid);
      if (w.botAt && now >= w.botAt && (p.isBot || !p.connected)) { this.declare(w.uid, now); continue; }
      if (w.catchAt && now >= w.catchAt) { const r = this.catchOne(w.catcher, w.uid, now); if (r.ok) continue; }
      if (now >= w.until) {
        this.oneWin = this.oneWin.filter(x => x !== w);
        this.push("onecard", { uid: w.uid, k: "failed" });
        this.addLog(`⏰ ${p.name}: 원카드 선언 실패 — 벌칙 ${this.rules.penalty}장`, w.uid);
        this.give(p, this.rules.penalty, "penalty");
      }
      if (this.phase === "ended") return;
    }
    const t = this.turn; if (!t || this.phase !== "turn") return;
    const p = this.P(t.uid);
    if ((p.isBot || !p.connected) && now >= t.botAt) { botStep(this, p, now); return; }
    if (now >= t.deadline) this.timeout(now);
  }
  timeout(now) {
    const t = this.turn, p = this.P(t.uid);
    this.push("timeout", { uid: p.id });
    this.addLog(`⏱️ ${p.name}: 시간 초과`, p.id);
    if (this.pending) return this.takeAttack(p.id, null, now);
    if (t.drawn || t.bonus) return this.pass(p.id, now);
    // 뽑고 끝
    const r = this.draw(p.id, now);
    if (this.turn === t && t.drawn) this.pass(p.id, now);
    return r;
  }

  // ---------- 보여줄 상태 ----------
  view(viewerId, { spectator = false } = {}) {
    const me = spectator ? null : this.P(viewerId);
    const t = this.turn;
    const v = {
      mode: this.mode, rules: this.rules, phase: this.phase, dir: this.dir, color: this.color,
      top: pubCard(this.top()), discardCount: this.discard.length, deckCount: this.deck.length,
      recent: this.discard.slice(-5).map(pubCard),
      pending: this.pending ? { n: this.pending.n, from: this.pending.from, reflected: this.pending.reflected } : null,
      pickIdx: this.pickIdx, pickDeadline: this.phase === "pick" ? this.pickDeadline : null,
      turn: t ? { uid: t.uid, deadline: t.deadline, sec: t.sec, drawn: me && t.uid === me.id ? t.drawn : (t.drawn ? "?" : null), bonus: t.bonus ? { kind: t.bonus.kind, n: t.bonus.n ?? null, reason: t.bonus.reason } : null, augUsed: t.augUsed, armed: me && t.uid === me.id ? { ...t.armed } : {}, extra: t.extra, preDeclared: t.preDeclared, acted: t.acted } : null,
      oneWin: this.oneWin.map(w => ({ uid: w.uid, until: w.until })),
      players: this.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, cards: p.hand.length, out: p.out, finished: p.finished, left: !!p.left,
        connected: p.connected, turnsDone: p.turnsDone, picking: this.phase === "pick" && !p.picked,
        augs: p.augs.map(a => ({ id: a.id, charges: a.charges, sealed: a.sealed || 0 })),
        syn: this.syn(p),
        fx: { colorBan: p.fx.colorBan && p.fx.colorBan.turns >= 0 ? p.fx.colorBan.color : null, sealedN: Object.keys(p.fx.sealed).length, timeLord: p.fx.timeLord, immune: p.fx.immune, king: p.fx.king },
      })),
      lastActive: this.lastActive ? { ...this.lastActive } : null,
      canRewind: !!(me && t && t.uid === me.id && this.lastPlay && this.lastPlay.uid !== me.id && this.lastPlay.seq === this.actSeq && t.startSeq === this.actSeq && !t.acted),
      log: this.log.slice(-14),
      result: this.result,
      tokens: this.tokensMade,
    };
    if (me) {
      v.hand = me.hand.map(c => ({ ...pubCard(c), sealed: me.fx.sealed[c.id] || 0 }));
      v.playable = t && t.uid === me.id ? this.playable(me) : [];
      v.offer = this.phase === "pick" && !me.picked ? me.offer : null;
      v.refresh = me.refresh;
      if (this.aug(me, "prophecy")) v.prophecy = this.deck.slice(-2).reverse().map(pubCard);
      if (this.aug(me, "cardSense") && t && t.uid === me.id) {
        const nx = this.nextPlayer(me.id);
        v.sense = { next: nx?.id || null, nextCanBlock: !!nx && nx.hand.some(c => isAtk(c) || c.kind === "def"), best: bestCardFor(this, me) };
      }
    }
    return v;
  }
}

// =========================
// AI (봇·끊긴 사람 대신)
// =========================
function colorPref(p) {
  const c = { r: 0, b: 0, g: 0, y: 0 };
  for (const x of p.hand) if (x.color) c[x.color] += x.kind === "num" ? 1 : 1.5;
  return COLORS.slice().sort((a, b) => c[b] - c[a])[0];
}
export function bestCardFor(g, p) {
  const ids = g.playable(p);
  if (!ids.length) return null;
  const cards = ids.map(id => p.hand.find(c => c.id === id));
  const nx = g.nextPlayer(p.id);
  const danger = nx && nx.hand.length <= 2;
  const score = (c) => {
    let s = 0;
    if (g.pending) return c.kind === "def" ? (g.pending.n >= 4 ? 5 : 2) : 3 + (c.kind === "wild4" ? 1 : 0);
    if (c.kind === "num") s = 3 + c.n * 0.05;
    if (c.kind === "skip" || c.kind === "rev") s = danger ? 6 : 2.5;
    if (c.kind === "atk2") s = danger ? 7 : 3.2;
    if (c.kind === "def") s = 1; // 방어는 아껴 둠
    if (c.kind === "wild") s = p.hand.length <= 2 ? 4 : 0.5;
    if (c.kind === "wild4") s = danger ? 8 : p.hand.length <= 3 ? 4 : 1;
    // 같은 색이 많이 남는 카드를 먼저
    if (c.color) s += p.hand.filter(x => x.color === c.color).length * 0.15;
    if (g.rules.lastSpecial && p.hand.length === 2 && c.kind === "num" && p.hand.some(x => x !== c && x.kind !== "num")) s -= 2;
    return s;
  };
  return cards.sort((a, b) => score(b) - score(a))[0].id;
}
function botAug(g, p, now) {
  const t = g.turn;
  if (g.mode !== "augment" || t.augUsed || t.drawn || t.bonus) return false;
  const can = (id) => g.charged(p, id) && AUG[id].kind === "active";
  const use = (pl) => g.useAug(p.id, pl, now).ok;
  const al = g.alive().filter(q => q.id !== p.id);
  const leader = al.slice().sort((a, b) => a.hand.length - b.hand.length)[0];
  const rnd = g.rng;
  if (g.pending) {
    if (can("timeRewind") && g.view(p.id).canRewind && g.pending.n >= 4) return use({ id: "timeRewind" });
    return false;
  }
  if (can("revolution") && p.hand.length * (al.length + 1) > al.reduce((s, q) => s + q.hand.length, p.hand.length) * 1.6 && p.hand.length >= 8) return use({ id: "revolution" });
  if (can("absSeal") && leader && leader.hand.length <= 3 && leader.augs.length) {
    const best = leader.augs.slice().sort((a, b) => ({ common: 0, rare: 1, epic: 2, legendary: 3 })[AUG[b.id].rarity] - ({ common: 0, rare: 1, epic: 2, legendary: 3 })[AUG[a.id].rarity])[0];
    return use({ id: "absSeal", target: leader.id, aug: best.id });
  }
  if (can("handStorm") && leader && leader.hand.length <= 2) return use({ id: "handStorm" });
  if (can("cardSeal") && leader && leader.hand.length <= 3 && leader.hand.length >= 2) return use({ id: "cardSeal", target: leader.id });
  if (can("steal") && leader && leader.hand.length === 2 && rnd() < 0.6) return use({ id: "steal", target: leader.id });
  if (can("forceSwap") && leader && leader.hand.length >= 2 && leader.hand.length <= 3 && p.hand.length >= 5) return use({ id: "forceSwap", target: leader.id });
  if (can("timeLord") && leader && leader.hand.length <= 4 && rnd() < 0.5) return use({ id: "timeLord", target: leader.id });
  if (can("fateHand") && p.hand.length <= 5 && p.hand.some(c => c.kind === "num")) return use({ id: "fateHand" });
  if (can("cardKing") && p.hand.length <= 6 && rnd() < 0.4) return use({ id: "cardKing" });
  const noPlay = !g.playable(p).length;
  if (noPlay) {
    if (can("cardCopy")) { const c = p.hand.find(x => x.kind === "num"); if (c) return use({ id: "cardCopy", card: c.id }); }
    if (can("transform")) { const c = p.hand.find(x => x.kind === "num" && x.color !== g.color && !p.fx.sealed[x.id]); if (c) return use({ id: "transform", card: c.id, color: g.color }); }
    if (can("battlefield")) return use({ id: "battlefield", color: colorPref(p) });
    if (can("godDraw") && p.hand.length <= 6) return use({ id: "godDraw", kind: "wild" });
    if (can("sortTactics") && p.hand.length) return use({ id: "sortTactics", card: p.hand[Math.floor(rnd() * p.hand.length)].id });
    if (can("reconstruct") && p.hand.length >= 4) return use({ id: "reconstruct" });
  }
  if (can("colorSeal") && rnd() < 0.35) { const nx = g.nextPlayer(p.id); if (nx && nx.hand.length <= 4) return use({ id: "colorSeal", color: g.color }); }
  if (can("handSwap") && leader && leader.hand.length <= 3 && rnd() < 0.5) { const worst = p.hand.find(c => c.kind === "num"); if (worst) return use({ id: "handSwap", card: worst.id, target: leader.id }); }
  if (can("dirControl") && leader && g.nextPlayer(p.id)?.id === leader.id && leader.hand.length <= 2) return use({ id: "dirControl" });
  if (can("tacticCopy") && g.lastActive && g.lastActive.uid !== p.id && COPYABLE.has(g.lastActive.id)) {
    const as = g.lastActive.id;
    const pl = { id: "tacticCopy" };
    if (AUG[as].target === "player" || AUG[as].target === "cardPlayer") pl.target = leader?.id;
    if (AUG[as].target === "card" || AUG[as].target === "cardPlayer" || AUG[as].target === "numCard" || AUG[as].target === "numCardColor") pl.card = p.hand.find(c => c.kind === "num")?.id;
    if (AUG[as].target === "color" || AUG[as].target === "numCardColor") pl.color = colorPref(p);
    if (rnd() < 0.5 && use(pl)) return true;
  }
  return false;
}
export function botStep(g, p, now) {
  const t = g.turn;
  if (!t || t.uid !== p.id) return;
  t.botAt = now + g.botDelay(p);
  const hardish = p.diff !== "easy";
  // 원카드 미리 선언
  if (p.hand.length === 2 && !t.preDeclared && (p.diff !== "easy" || g.rng() < 0.7)) g.declare(p.id, now);
  if (g.mode === "augment" && (hardish || g.rng() < 0.5) && botAug(g, p, now)) return;
  if (g.phase !== "turn" || g.turn !== t) return;
  if (g.pending) {
    const ids = g.playable(p);
    const atk = ids.map(id => p.hand.find(c => c.id === id)).filter(isAtk);
    const def = ids.map(id => p.hand.find(c => c.id === id)).find(c => c.kind === "def");
    const n = g.pending.n;
    if (atk.length && (p.diff === "hard" || n <= 6 || !def)) {
      const c = atk.sort((a, b) => (a.kind === "atk2" ? 0 : 1) - (b.kind === "atk2" ? 0 : 1))[0];
      if (g.mode === "augment" && n >= 3) { if (g.charged(p, "doubleAtk")) t.armed.doubleAtk = true; else if (g.charged(p, "atkAmp")) t.armed.atkAmp = true; }
      g.play(p.id, c.id, isWild(c) ? colorPref(p) : null, now); return;
    }
    if (def && n >= 2) { g.play(p.id, def.id, null, now); return; }
    if (g.mode === "augment") {
      const from = g.P(g.pending.from);
      const canBack = from && !from.out && !from.finished && !g.pending.reflected;
      for (const id of ["absReflect", "reflect", "perfectDef", "atkNull"]) {
        if (!g.charged(p, id)) continue;
        if ((id === "absReflect" || id === "reflect") && !canBack) continue;
        if (id === "atkNull" && n > 6) continue;
        if (n < (id === "absReflect" || id === "perfectDef" ? 4 : 3)) continue;
        g.takeAttack(p.id, id, now); return;
      }
    }
    g.takeAttack(p.id, null, now); return;
  }
  if (t.bonus || t.drawn) {
    const ids = g.playable(p);
    if (ids.length) { const c = p.hand.find(x => x.id === ids[0]); g.play(p.id, c.id, isWild(c) ? colorPref(p) : null, now); }
    else g.pass(p.id, now);
    return;
  }
  const best = p.diff === "easy" && g.rng() < 0.35 ? g.playable(p)[0] : bestCardFor(g, p);
  if (best) {
    const c = p.hand.find(x => x.id === best);
    if (g.rules.lastSpecial && p.hand.length === 1 && isSpecial(c)) { g.draw(p.id, now); return; }
    if (g.mode === "augment" && isAtk(c) && hardish) { const nx = g.nextPlayer(p.id); if (nx && nx.hand.length <= 3) { if (g.charged(p, "doubleAtk")) t.armed.doubleAtk = true; else if (g.charged(p, "atkAmp")) t.armed.atkAmp = true; } }
    g.play(p.id, c.id, isWild(c) ? colorPref(p) : null, now); return;
  }
  const r = g.draw(p.id, now);
  if (r.ok && r.canPlay && g.turn === t) t.botAt = now + 600;
}
