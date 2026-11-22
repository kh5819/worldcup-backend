// =========================
// 플듀 끝말잇기 — 규칙 (2026-11-21)  서버만 판정 (화면은 단어만 보냄)
// · 차례대로 단어: 앞 단어 끝 글자(두음법칙 포함)로 시작 · 사전에 있는 명사 · 이번 판에 안 나온 단어 · 최소 글자 수
// · 시간 압박: 이어질수록 한 차례 시간이 줄어듦 (기본 15초 → 최소 5초)
// · 못 내면(시간 초과·포기) 하트 -1, 그 사람이 새 시작 글자로 다시 시작. 하트 0이면 탈락 → 마지막 1명이 승리
// · 한방단어 금지 옵션: 끝 글자로 이어질 단어가 사전에 하나도 없는 단어는 못 냄
// · 점수: 글자 수×10 + 남은 초 + 이어진 길이 보너스
// · 2026-11-22: 남은 이을 단어 수(한방 위험 표시) · 사람마다 기록(업적용) · 판 끝 요약(summary)
// · 혼자 1자리(오늘의 도전)면 내 끝 글자로 내가 계속 이어 감 → 하트 0이면 끝
// =========================
import { HANGUL_RE } from "./wd-dict.js";

export const WD = { fastMs: 2500, minTurnMs: 5000, shrinkMs: 300, maxLen: 15, hearts: [1, 2, 3], turns: [10, 15, 20], minLens: [2, 3] };
export const isAiLevel = (l) => typeof l === "string" && Object.prototype.hasOwnProperty.call(AI_LEVELS, l);
export const AI_LEVELS = { easy: { miss: 0.14, delay: [3200, 6500], pick: "short" }, normal: { miss: 0.05, delay: [2000, 4200], pick: "any" }, hard: { miss: 0.015, delay: [1100, 2800], pick: "attack" } };

export function cleanWord(s) { return String(s ?? "").replace(/[\s​-‏﻿]/g, "").normalize("NFC").slice(0, 30); }

export class WordGame {
  /** seats: [{ id, name, ai?: "easy"|"normal"|"hard", viewer?: true }] */
  constructor(dict, seats, opts = {}, rng = Math.random) {
    this.d = dict; this.rng = rng;
    this.o = { hearts: WD.hearts.includes(opts.hearts) ? opts.hearts : 3, turn: WD.turns.includes(opts.turn) ? opts.turn : 15, noKill: !!opts.noKill, minLen: WD.minLens.includes(opts.minLen) ? opts.minLen : 2 };
    this.ps = seats.map(s => ({ id: s.id, name: s.name, ai: isAiLevel(s.ai) ? s.ai : s.ai ? "normal" : null, viewer: !!s.viewer, hearts: this.o.hearts, score: 0, words: 0, miss: 0, alive: true, longest: "", bestChain: 0, kills: 0, out: 0, fast: 0, dueum: 0, long6: 0, fastest: 0, fastestW: "" }));
    this.usedStart = new Map(); // 첫 글자 → 이번 판에 쓴 단어 수 (남은 이을 단어 계산)
    this.cur = Math.floor(rng() * this.ps.length); this.used = new Set(); this.hist = []; this.last = null; this.chain = 0; this.maxChain = 0;
    this.phase = "play"; this.round = 1; this.startSyl = dict.randomStart(rng); this.turnAt = 0; this.turnEnds = 0; this.outOrder = []; this.winner = null;
  }
  turnMs() { return Math.max(WD.minTurnMs, this.o.turn * 1000 - this.chain * WD.shrinkMs); }
  beginTurn(t) { this.turnAt = t; this.turnEnds = t + this.turnMs(); }
  /** 지금 이을 수 있는 (안 쓴) 사전 단어 수 — 글자 수 규칙·한방 금지는 안 따짐 (대략) */
  remaining() { let n = 0; for (const s of this.needs()) n += Math.max(0, (this.d.countStart?.(s) || 0) - (this.usedStart.get(s) || 0)); return n; }
  /** 한방 위험 0 없음 · 1 조심 · 2 위험 (이어진 단어가 있을 때만) */
  risk() { if (!this.last || !this.d.risk) return 0; const n = this.remaining(), [hi, mid] = this.d.risk; return n <= hi ? 2 : n <= mid ? 1 : 0; }
  needs() { return this.last ? this.d.startsFor(this.last[this.last.length - 1]) : this.d.startsFor(this.startSyl); }
  alive() { return this.ps.filter(p => p.alive); }
  curP() { return this.ps[this.cur]; }
  /** 단어 확인만 (점수·차례는 안 바꿈) */
  check(word) {
    const w = cleanWord(word);
    if (!w) return { ok: false, error: "EMPTY" };
    if (!HANGUL_RE.test(w)) return { ok: false, error: "NOT_HANGUL" };
    if (w.length < this.o.minLen) return { ok: false, error: "TOO_SHORT" };
    if (w.length > WD.maxLen) return { ok: false, error: "TOO_LONG" };
    if (!this.needs().includes(w[0])) return { ok: false, error: "WRONG_START" };
    if (this.used.has(w)) return { ok: false, error: "USED" };
    if (!this.d.has(w)) return { ok: false, error: "NOT_WORD" };
    if (this.o.noKill && this.d.isKill(w)) return { ok: false, error: "KILL_WORD" };
    return { ok: true, w };
  }
  submit(pid, word, t, by) {
    if (this.phase !== "play") return { ok: false, error: "NOT_PLAYING" };
    const p = this.curP(); if (!p || p.id !== pid) return { ok: false, error: "NOT_YOUR_TURN" };
    if (t > this.turnEnds) return { ok: false, error: "TIME_OVER" };
    const c = this.check(word); if (!c.ok) return c;
    const w = c.w, left = Math.max(0, this.turnEnds - t), kill = this.d.isKill(w), need = this.needs(), dueum = need.length > 1 && w[0] === need[1] && w[0] !== need[0];
    const pts = w.length * 10 + Math.ceil(left / 1000) + Math.min(30, Math.floor(this.chain / 5) * 5) + (kill ? 20 : 0);
    this.used.add(w); this.usedStart.set(w[0], (this.usedStart.get(w[0]) || 0) + 1); this.last = w; this.chain++; this.maxChain = Math.max(this.maxChain, this.chain);
    p.score += pts; p.words++; if (w.length > p.longest.length) p.longest = w; p.bestChain = Math.max(p.bestChain, this.chain); if (kill) p.kills++;
    const ms = Math.round(t - this.turnAt);
    if (ms <= WD.fastMs) p.fast++; if (dueum) p.dueum++; if (w.length >= 6) p.long6++; if (!p.fastest || ms < p.fastest) { p.fastest = ms; p.fastestW = w; }
    const e = { w, pid, by: by ? String(by).slice(0, 14) : null, pts, kill, ms, chain: this.chain, dueum };
    this.hist.push(e); if (this.hist.length > 400) this.hist.shift();
    this.advance(); this.beginTurn(t);
    return { ok: true, e };
  }
  /** 시간 초과·포기 */
  miss(pid, t, why = "time") {
    if (this.phase !== "play") return null;
    const p = this.curP(); if (!p || p.id !== pid) return null;
    p.hearts--; p.miss++;
    const out = p.hearts <= 0; if (out) { p.alive = false; p.out = this.outOrder.length + 1; this.outOrder.push(p.id); }
    const e = { pid, why, out, need: this.needs(), chain: this.chain };
    this.last = null; this.chain = 0; this.round++; this.startSyl = this.d.randomStart(this.rng);
    const alive = this.alive();
    if (alive.length === 0 || (this.ps.length > 1 && alive.length <= 1)) { this.end(t); return { ...e, end: true }; }
    if (out) this.advance(); // 탈락하면 다음 사람이 새로 시작, 아니면 틀린 사람이 다시 시작
    this.beginTurn(t);
    return e;
  }
  advance() { const n = this.ps.length; for (let k = 1; k <= n; k++) { const i = (this.cur + k) % n; if (this.ps[i].alive) { this.cur = i; return; } } }
  tick(t) { if (this.phase === "play" && t >= this.turnEnds) return this.miss(this.curP().id, t, "time"); return null; }
  end(t) { this.phase = "over"; this.endedAt = t; const a = this.alive(); this.winner = a.length === 1 ? a[0].id : (a.length ? [...a].sort((x, y) => y.score - x.score)[0].id : null); }
  /** 순위: 살아남은 사람(점수순) → 늦게 떨어진 순 */
  ranking() {
    return [...this.ps].sort((a, b) => (b.alive - a.alive) || (a.alive ? b.score - a.score : b.out - a.out) || b.score - a.score)
      .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, ai: p.ai, viewer: p.viewer, score: p.score, words: p.words, longest: p.longest, kills: p.kills, alive: p.alive }));
  }
  pub(t) {
    return { phase: this.phase, cur: this.curP()?.id || null, last: this.last, needs: this.phase === "play" ? this.needs() : [], startSyl: this.last ? null : this.startSyl, chain: this.chain, maxChain: this.maxChain, round: this.round,
      turnEnds: this.turnEnds, turnMs: this.turnMs(), remain: this.phase === "play" && this.last ? this.remaining() : null, risk: this.phase === "play" ? this.risk() : 0, left: Math.max(0, this.turnEnds - t), opts: this.o, winner: this.winner,
      ps: this.ps.map(p => ({ id: p.id, name: p.name, ai: p.ai, viewer: p.viewer, hearts: p.hearts, score: p.score, words: p.words, alive: p.alive })), hist: this.hist.slice(-30) };
  }
}

/** 판 끝 요약: 가장 긴 단어·가장 빠른 단어·한방단어들·가장 많이 낸 사람·가장 긴 연결 */
export function summary(game) {
  const name = (e) => e.by ? "📺 " + e.by : game.ps.find(p => p.id === e.pid)?.name || "?";
  const H = game.hist; let longest = null, fastest = null;
  for (const e of H) { if (!longest || e.w.length > longest.w.length) longest = e; if (!fastest || e.ms < fastest.ms) fastest = e; }
  const top = [...game.ps].sort((a, b) => b.words - a.words)[0];
  return {
    longest: longest ? { w: longest.w, name: name(longest), id: longest.pid } : null,
    fastest: fastest ? { w: fastest.w, name: name(fastest), id: fastest.pid, ms: fastest.ms } : null,
    kills: H.filter(e => e.kill).slice(-8).map(e => ({ w: e.w, name: name(e), id: e.pid })),
    most: top && top.words ? { name: top.name, id: top.id, n: top.words } : null,
    maxChain: game.maxChain, dueum: H.filter(e => e.dueum).length,
  };
}

/** AI: 고를 단어 (없거나 일부러 놓치면 null) */
export function aiPick(game, level, rng = Math.random) {
  const L = isAiLevel(level) ? AI_LEVELS[level] : AI_LEVELS.normal; if (rng() < L.miss) return null;
  const pools = game.d.wordsFrom(game.needs()); const cand = [];
  for (const a of pools) { const n = a.length, start = Math.floor(rng() * n), look = Math.min(n, 400); for (let k = 0; k < look; k++) { const w = a[(start + k) % n]; if (game.check(w).ok) { cand.push(w); if (cand.length >= 60) break; } } }
  if (!cand.length) return null;
  if (L.pick === "short") { cand.sort((a, b) => a.length - b.length); return cand[Math.floor(rng() * Math.min(cand.length, 8))]; }
  if (L.pick === "attack") { // 상대가 잇기 힘든 끝 글자 (이어질 단어가 적은 것)
    let best = null, bs = Infinity; for (const w of cand) { const c = game.d.contCount(w[w.length - 1]); const s = (game.o.noKill || c > 0 ? c : -1) + rng() * 3; if (s < bs) { bs = s; best = w; } } return best;
  }
  return cand[Math.floor(rng() * cand.length)];
}
export function aiDelay(level, turnMs, rng = Math.random) { const L = isAiLevel(level) ? AI_LEVELS[level] : AI_LEVELS.normal; const d = L.delay[0] + rng() * (L.delay[1] - L.delay[0]); return Math.min(d, Math.max(600, turnMs - 900)); }
