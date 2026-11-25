// =========================
// DUO 증강 알까기 — 게임 규칙 엔진 (2026-11-17, 11-25 경기장 규칙·보스·도전 모드·알 8개)
// · 소켓과 분리 (now·rng 주입) → 시험·시뮬·AI가 같은 코드
// · 화면은 발사(알·방향·힘·휘는 방향·증강)만 보냄. 결과(충돌·이탈·승패)는 전부 여기 + flick-physics.js
//
// [규칙 — 방 설정 화면에 그대로 표시]
// 1. 모두 같은 수의 알(2~8개, 기본 3)을 가지고 시작. 판 크기·시작 자리는 인원·알 수에 맞춰 자동
// 2. 내 차례(기본 20초)에 내 알 하나를 골라 방향·힘을 정해 튕김. 시간이 지나면 차례를 넘김
// 3. 알의 중심이 판 밖(또는 용암 구멍)으로 나가면 떨어짐(내 알이든 상대 알이든). 알이 하나도 없으면 탈락
// 4. 마지막까지 알이 남은 사람(팀전은 팀)이 승리. 한 번에 모두 떨어지면 그 발사로 떨어진 사람끼리 공동 순위
// 5. 30바퀴가 지나면 남은 알이 많은 순으로 끝 (보스전은 보스 승리)
// 6. 증강 모드: 시작 + 살아 있는 모두가 2번씩 쏠 때마다 3장 중 1장(최대 5개, 15초, 고르는 동안 시간 멈춤). 탈락한 사람·보스는 안 고름
// 7. 경기장마다 규칙이 다름 (flick-maps.js) · 보스전: 보스 알 체력(보호막)이 다 닳은 뒤 떨어뜨리면 승리 (flick-data.js)
// =========================
import { simulate, makeDisc, findSafe, mulberry32, VMAX, BASE_R, REC_EVERY, DT } from "./flick-physics.js";
import { AUG, MAX_AUGS, PICK_EVERY, rollOffer, synergyOf } from "./flick-augs.js";
import { buildEnv, newWind, envView, envObstacles } from "./flick-maps.js";
import { BOSSES, SKILL_NAME } from "./flick-data.js";

export const MAPS = ["classic", "neon", "ice", "space", "volcano", "toy", "cloud", "ruins"];
export const SKINS = ["glass", "marble", "gem", "metal", "wood", "candy", "planet", "lava"];
export const COLORS = ["#ff5a5a", "#3d8bff", "#3fcf6e", "#ffc23d", "#b36bff", "#ff8a3c", "#2fd0c4", "#ff6fb1"];
export const DEFAULT_OPTS = { stones: 3, turnSec: 20, teams: 0, map: "classic" };
export const OPT_CHOICES = { stones: [2, 3, 4, 5, 6, 7, 8], turnSec: [15, 20, 30, 45], teams: [0, 2, 3, 4] };
const PICK_MS = 15_000;
const MAX_ROUNDS = 30;
const EXTRA_CAP = 3;               // 한 사람이 동시에 가질 수 있는 추가 알(분열·군단) 수
const MINION_CAP = 3;              // 보스 부하 알 최대
const LOG_MAX = 40;
const KIND_SCALE = { stone: 1, split: 0.72, triple: 0.62, legion: 0.75, boss: 2.1, minion: 0.85 };
const KIND_MASS = { stone: 1, split: 0.5, triple: 0.38, legion: 0.6, boss: 3.2, minion: 0.8 };
/** 판 크기: 인원 + 알이 많으면 조금 더 넓게 */
const boardSize = (n, k) => Math.round(([0, 600, 620, 680, 720, 780, 820, 860, 900][n] || 900) * (k > 4 ? 1 + (k - 4) * 0.06 : 1));

export class FlickGame {
  /** players: [{ id, name, avatar, isBot, diff, team, skin, title, stones?, boss? }]
   *  extra: { stage, daily, raid } — 도전 모드 단계·오늘의 도전·멀티 레이드 표시용 */
  constructor({ players, mode = "augment", opts = {}, rng = Math.random, now = Date.now(), seed = null, extra = null }) {
    this.mode = mode === "classic" ? "classic" : "augment";
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this.rng = rng; this.seed = seed ?? Math.floor(rng() * 2 ** 31);
    this._now = now;
    this.extra = extra || null;
    if (this.opts.map === "random" || !MAPS.includes(this.opts.map)) this.opts = { ...this.opts, map: MAPS[Math.floor(rng() * MAPS.length)] };
    const n = players.length;
    const maxK = Math.max(this.opts.stones, ...players.map(p => p.stones || 0));
    this.L = boardSize(players.some(p => p.boss) ? Math.max(3, n) : n, maxK);
    this.players = players.map((p, i) => ({
      id: p.id, name: p.name, avatar: p.avatar || null, isBot: !!p.isBot || !!p.boss, diff: p.diff || "normal", title: p.title || null,
      seat: i, color: p.boss ? BOSSES[p.boss]?.col || "#ffcf3a" : COLORS[i % COLORS.length], skin: SKINS.includes(p.skin) ? p.skin : SKINS[i % SKINS.length],
      team: this.opts.teams ? (Number.isInteger(p.team) ? p.team % this.opts.teams : i % this.opts.teams) : null,
      boss: p.boss && BOSSES[p.boss] ? p.boss : null, bossHpOpt: Math.max(1, Math.min(12, Number(p.bossHp) || 3)), bossHp0: 0, stoneCount: p.stones || this.opts.stones,
      augs: [], offer: null, picked: true, refresh: 1, out: false, outAt: 0, shotsSincePick: 0,
      combo: 0, fateUsed: false, connected: true,
      stats: { shots: 0, hits: 0, kills: 0, lost: 0, augUsed: 0, maxPush: 0, bKill: 0, holes: 0, bossDmg: 0 },
    }));
    this.bossP = this.players.find(p => p.boss) || null;
    this.discs = []; this.seq = 0; this.discSeq = 0;
    this.layout();
    this.env = buildEnv(this.opts.map, this.L, this.discs, rng);
    this.phase = "deal"; this.turnIdx = Math.floor(rng() * n); this.turn = null; this.round = 1; this.turnsInRound = 0;
    if (this.bossP && this.players[this.turnIdx].boss) this.turnIdx = this.players.findIndex(p => !p.boss);
    this.sinceBoss = 0; this.bossReturn = -1; this.bossTurns = 0; this.rage = false;
    this.pickIdx = -1; this.pickDeadline = 0;
    this.shotSeq = 0; this.lastShot = null; this.snap = null;
    this.log = []; this.events = []; this.result = null; this.winners = [];
    this.addLog(`게임 시작! ${this.mode === "augment" ? "증강 알까기" : "일반 알까기"} · ${n}명${this.opts.teams && !this.bossP ? ` · ${this.opts.teams}팀전` : ""} · 알 ${this.opts.stones}개씩`);
    if (this.bossP) this.addLog(`👹 보스 등장: ${BOSSES[this.bossP.boss].name} (체력 ${this.bossDisc()?.shield + 1})`);
    if (this.mode === "augment") this.startPick(0, now); else this.startTurn(now);
  }
  // ---------- 도구 ----------
  P(uid) { return this.players.find(p => p.id === uid); }
  alivePlayers() { return this.players.filter(p => !p.out); }
  discsOf(uid) { return this.discs.filter(d => d.alive && d.owner === uid); }
  bossDisc() { return this.bossP ? this.discs.find(d => d.alive && d.owner === this.bossP.id && d.kind === "boss") || null : null; }
  sameSide(a, b) { if (a === b) return true; if (!this.opts.teams) return false; const A = this.P(a), B = this.P(b); return A && B && A.team === B.team; }
  push(type, data = {}) { this.events.push({ type, seq: ++this.seq, ...data }); }
  addLog(text, uid = null) { this.log.push({ uid, text }); if (this.log.length > LOG_MAX) this.log.splice(0, this.log.length - LOG_MAX); }
  aug(p, id) { return this.mode === "augment" ? p.augs.find(a => a.id === id) : null; }
  syn(p) { return this.mode === "augment" ? synergyOf(p.augs.map(a => a.id)) : []; }
  newDisc(o) { const d = makeDisc({ ...o, id: "d" + (++this.discSeq) }); d.kind = o.kind || "stone"; d.home = o.home || { x: o.x, y: o.y }; d.golden = false; return d; }
  /** 빈 자리 찾기 — 경기장 장애물·구멍도 피함 */
  safe(x, y, r, opt = {}) { return findSafe(opt.discs || this.discs, this.L, x, y, r, { ...opt, avoid: envObstacles(this.env) }); }
  world() { return { L: this.L, discs: this.discs, env: this.env }; }

  /** 시작 자리: 2명은 위·아래 줄, 3명 이상(또는 보스전)은 판 가운데를 둘러싼 무리. 알이 많으면 줄을 늘림 */
  layout() {
    const L = this.L, gap = BASE_R * 2.9;
    const fighters = this.players.filter(p => !p.boss), n = fighters.length;
    const ringMode = n !== 2 || !!this.bossP;
    fighters.forEach((p, i) => {
      const k = p.stoneCount, pts = [];
      if (!ringMode) {
        const rowMax = 5, rows = Math.ceil(k / rowMax);
        for (let s = 0; s < k; s++) {
          const row = Math.floor(s / rowMax), cnt = row < rows - 1 ? rowMax : k - row * rowMax, idx = s - row * rowMax;
          const y0 = i === 0 ? L * 0.8 : L * 0.2, y = y0 + (i === 0 ? 1 : -1) * row * gap * 0.95 - (i === 0 ? 1 : -1) * (rows - 1) * gap * 0.45;
          pts.push({ x: L / 2 + (idx - (cnt - 1) / 2) * gap * 1.25, y });
        }
      } else {
        const th = Math.PI / 2 + i / Math.max(1, n) * Math.PI * 2, D = L * (this.bossP ? 0.37 : 0.33);
        const cx = L / 2 + Math.cos(th) * D, cy = L / 2 + Math.sin(th) * D;
        const tx = -Math.sin(th), ty = Math.cos(th);
        const rowMax = k <= 3 ? 3 : k <= 6 ? 3 : 4, rows = Math.ceil(k / rowMax);
        for (let s = 0; s < k; s++) {
          const row = Math.floor(s / rowMax), cnt = row < rows - 1 ? rowMax : k - row * rowMax, idx = s - row * rowMax;
          const off = (idx - (cnt - 1) / 2) * gap, back = row * gap * 0.9 - (rows > 2 ? gap * 0.45 : 0);
          pts.push({ x: cx + tx * off + Math.cos(th) * back, y: cy + ty * off + Math.sin(th) * back });
        }
      }
      for (const pt of pts) {
        const x = Math.max(BASE_R * 1.6, Math.min(L - BASE_R * 1.6, pt.x)), y = Math.max(BASE_R * 1.6, Math.min(L - BASE_R * 1.6, pt.y));
        this.discs.push(this.newDisc({ owner: p.id, team: p.team, x, y, kind: "stone" }));
      }
    });
    // 보스: 가운데 큰 알 + 부하
    if (this.bossP) {
      const b = this.bossP, def = BOSSES[b.boss];
      const d = this.newDisc({ owner: b.id, team: b.team, x: L / 2, y: L / 2, kind: "boss" });
      const big = Math.max(1, Math.min(1.45, L / 680)); // 넓은 판(레이드)에선 보스도 크게
      d.r = BASE_R * KIND_SCALE.boss * big; d.m = KIND_MASS.boss * big; d.shield = b.bossHpOpt - 1; this.bossBig = big;
      this.discs.push(d); b.bossHp0 = d.shield + 1;
      for (let i = 0; i < def.minions; i++) this.spawnMinion(b, i);
    }
  }
  spawnMinion(b, i = 0) {
    const bd = this.discs.find(x => x.alive && x.owner === b.id && x.kind === "boss"); if (!bd) return null;
    if (this.discs.filter(x => x.alive && x.owner === b.id && x.kind === "minion").length >= MINION_CAP) return null;
    const a = this.rng() * Math.PI * 2 + i * 2.1, r = BASE_R * KIND_SCALE.minion;
    const s = this.safe(bd.x + Math.cos(a) * (bd.r + r + 8), bd.y + Math.sin(a) * (bd.r + r + 8), r, { margin: BASE_R * 3 }); if (!s) return null;
    const m = this.newDisc({ owner: b.id, team: b.team, x: s.x, y: s.y, kind: "minion" }); m.r = r; m.m = KIND_MASS.minion;
    this.discs.push(m); return m;
  }
  /** 증강·알 종류·경기장에 따른 물리 값 (발사 직전 매번 다시 계산) */
  applyStats(shooterId = null) {
    const L = this.L, eAdd = this.env?.eAdd || 0;
    for (const d of this.discs) {
      if (!d.alive) continue;
      const p = this.P(d.owner); const has = (id) => !!this.aug(p, id); const syn = this.syn(p);
      const mine = this.discsOf(d.owner).length;
      const big = d.kind === "boss" ? this.bossBig || 1 : 1;
      let r = BASE_R * (KIND_SCALE[d.kind] || 1) * big, m = (KIND_MASS[d.kind] || 1) * big, e = 0.86 + eAdd, mu = 1, recv = 1, deal = 1;
      if (has("tiny")) { r *= 0.8; mu *= 0.85; m *= 0.8; }
      if (has("heavyStone")) { m *= 1.5; mu *= 1.05; }
      if (has("lightStone")) mu *= 0.8;
      if (has("bouncy")) e += 0.1;
      if (has("hardStone")) recv *= 0.85;
      if (has("lastStone") && mine === 1) { m *= 1.4; recv *= 0.8; }
      if (has("guard")) { const edge = Math.min(d.x, d.y, L - d.x, L - d.y); if (edge < BASE_R * 4) recv *= 0.7; }
      if (has("pushOut")) deal *= 1.2;
      if (has("flickGod")) { deal *= 1.15; recv *= 0.85; }
      if (p.fateUsed) m *= 1.3;
      if (syn.includes("guard")) recv *= 0.92;
      if (syn.includes("stone")) m *= 1.1;
      if (d.golden) { m *= 1.7; r *= 1.12; recv *= 0.75; deal *= 1.15; }
      if (d.kind === "boss" && this.rage) deal *= 1.15;
      d.r = r; d.m = m; d.e = e; d.mu = mu; d.recvMul = recv; d.dealMul = deal;
      d._frontal = has("precisionHit") ? 1.3 : 0;
    }
    void shooterId;
  }
  hooksFor(shooter, { dry = false, out = null } = {}) {
    const g = this;
    const REACT = { shield: "shield", absDef: "absDefense", reflect: "reflectShock", lastSurvival: "lastSurvival" };
    const used = new Map();
    return {
      react(owner, kind) {
        const p = g.P(owner); if (!p || g.mode !== "augment") return false;
        const a = g.aug(p, REACT[kind]); if (!a || !(a.charges > 0)) return false;
        const k = owner + kind; const u = used.get(k) || 0;
        if (dry) { if (u >= a.charges) return false; used.set(k, u + 1); return true; }
        a.charges--; p.stats.augUsed++;
        out?.push({ uid: owner, id: REACT[kind] });
        return true;
      },
      spawnSplit(D, n) {
        if (dry) return [];
        const p = g.P(D.owner);
        if (D.kind === "boss" || D.kind === "minion") return [];
        const extra = g.discs.filter(x => x.alive && x.owner === D.owner && x.kind !== "stone").length;
        const room = Math.max(0, EXTRA_CAP - extra);
        const want = n === 3 ? 2 : 1, cnt = Math.min(want, room);
        if (!cnt) return [];
        const kind = n === 3 ? "triple" : "split";
        if (n === 3) { D.kind = "triple"; D.r = BASE_R * KIND_SCALE.triple; D.m = KIND_MASS.triple; }
        const kids = [];
        for (let i = 0; i < cnt; i++) {
          const ang = Math.atan2(D.vy, D.vx) + (i === 0 ? 1.4 : -1.4);
          const r = BASE_R * KIND_SCALE[kind];
          let x = D.x + Math.cos(ang) * (D.r + r + 3), y = D.y + Math.sin(ang) * (D.r + r + 3);
          x = Math.max(r + 2, Math.min(g.L - r - 2, x)); y = Math.max(r + 2, Math.min(g.L - r - 2, y));
          const k = g.newDisc({ owner: D.owner, team: D.team, x, y, kind, home: D.home });
          k.r = r; k.m = KIND_MASS[kind]; k.recvMul = D.recvMul; k.dealMul = D.dealMul; k.e = D.e; k.mu = D.mu;
          kids.push(k);
        }
        void p;
        return kids;
      },
      safeSpot(x, y, r, self) { return g.safe(x, y, r, { margin: BASE_R * 3, ignore: self }) || { x: g.L / 2, y: g.L / 2 }; },
      onHit(atk, tgt) {
        if (!shooter || dry) return;
        if (atk.owner === shooter.id && !g.sameSide(tgt.owner, shooter.id)) g._shotHit = true;
      },
    };
  }

  // ---------- 증강 고르기 ----------
  startPick(idx, now) {
    this._now = now;
    this.phase = "pick"; this.pickIdx = idx; this.turn = null; this.pickDeadline = now + PICK_MS; this.pickStart = now;
    let any = false;
    for (const p of this.players) {
      p.shotsSincePick = 0;
      if (p.out || p.boss || p.augs.length >= MAX_AUGS) { p.offer = null; p.picked = true; continue; } // 탈락한 사람·보스는 증강 카드가 안 뜸
      p.offer = rollOffer(idx, p.augs.map(a => a.id), { rng: this.rng }); p.picked = !p.offer.length; if (!p.picked) any = true;
      p.botPickAt = now + 900 + Math.floor(this.rng() * 1500);
    }
    if (!any) { this.phase = "aim"; return this.startTurn(now); }
    this.push("pick", { idx, deadline: this.pickDeadline });
    this.addLog(idx === 0 ? "✨ 증강 고르기 — 3장 중 1장!" : "✨ 모두 2번씩 쐈어요! 새 증강 고르기");
  }
  pick(uid, id, now) {
    const p = this.P(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICK_PHASE" };
    if (!p.offer?.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    this.grant(p, id, false); this.finishPick(now);
    return { ok: true };
  }
  refreshOffer(uid) {
    const p = this.P(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICK_PHASE" };
    if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    p.refresh--; p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), { rng: this.rng });
    return { ok: true, offer: p.offer, refresh: p.refresh };
  }
  grant(p, id, auto) {
    const d = AUG[id];
    p.augs.push({ id, charges: d.charges ?? null, cd: 0 });
    p.offer = null; p.picked = true;
    this.addLog(`${p.name}: ${d.name} [${({ common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" })[d.rarity]}]${auto ? " (자동)" : ""}`, p.id);
    this.push("augGet", { uid: p.id, id, auto });
    if (id === "flickGod") { const mine = this.discsOf(p.id); if (mine.length) mine[Math.floor(this.rng() * mine.length)].shield++; }
  }
  autoPick(p) {
    if (!p.offer?.length) { p.picked = true; return; }
    const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
    this.grant(p, [...p.offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0], true);
  }
  finishPick(now) {
    if (this.phase !== "pick" || this.players.some(p => !p.picked)) return false;
    this.push("picked", { idx: this.pickIdx });
    this.phase = "aim"; this.startTurn(now);
    return true;
  }

  // ---------- 차례 ----------
  startTurn(now) {
    this._now = now;
    if (this.phase === "ended") return;
    let guard = 0;
    while (guard++ <= this.players.length && (this.players[this.turnIdx].out || (this.players[this.turnIdx].boss && this.bossReturn < 0))) this.turnIdx = (this.turnIdx + 1) % this.players.length;
    const p = this.players[this.turnIdx];
    this.phase = "aim";
    // 철벽 알: 내 차례가 돌아오면 풀림
    for (const d of this.discsOf(p.id)) if (d.iron) d.iron = 0;
    // 바람 경기장: 차례마다 바람이 바뀜 (조준할 때 미리 보임)
    if (this.env?.map === "cloud") { this.env.wind = newWind(this.rng); this.push("wind", { wind: this.env.wind }); }
    // 운명 역전
    if (this.mode === "augment" && !p.fateUsed && !p.boss) {
      const a = this.aug(p, "fateReversal");
      const most = Math.max(...this.players.filter(q => !this.sameSide(q.id, p.id)).map(q => this.discsOf(q.id).length), 0);
      if (a && a.charges > 0 && most > 0 && this.discsOf(p.id).length * 2 <= most) {
        a.charges--; p.fateUsed = true; p.stats.augUsed++;
        const back = this.reviveOne(p);
        this.push("aug", { uid: p.id, id: "fateReversal", big: true, disc: back?.id || null });
        this.addLog(`🔥 ${p.name}: 운명 역전! ${back ? "알 1개 부활 + " : ""}알 질량 ×1.3`, p.id);
      }
    }
    const sec = this.opts.turnSec;
    this.turn = { uid: p.id, start: now, deadline: now + sec * 1000, sec, augUsed: false, botAt: now + (p.isBot ? this.botDelay(p) : 4500), boss: !!p.boss };
    this.push("turn", { uid: p.id, deadline: this.turn.deadline, round: this.round, boss: !!p.boss });
  }
  botDelay(p) { if (p.boss) return 1300 + Math.floor(this.rng() * 500); return 1100 + Math.floor(this.rng() * (p.diff === "hard" ? 700 : 1300)); }
  /** 보스가 몇 번 차례마다 움직이나 (사람이 많으면 더 자주 — 사람 2명마다 1번) */
  bossEvery() { const n = this.alivePlayers().filter(p => !p.boss).length; return n <= 1 ? 2 : Math.max(1, Math.ceil(n / 2)); }
  nextTurn(now) {
    const n = this.players.length;
    const cur = this.players[this.turnIdx];
    // 보스전: 보스 차례 끼워 넣기
    if (this.bossP && !this.bossP.out) {
      if (cur?.boss) { this.turnIdx = this.bossReturn >= 0 ? this.bossReturn : this.turnIdx; this.bossReturn = -1; }
      else if (++this.sinceBoss >= this.bossEvery()) { this.sinceBoss = 0; this.bossReturn = this.turnIdx; this.turnIdx = this.players.indexOf(this.bossP); return this.startTurn(now); }
    } else this.bossReturn = -1;
    // 다음 사람 · 바퀴 수
    let i = this.turnIdx;
    for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!this.players[i].out && !this.players[i].boss) break; }
    if (i <= this.turnIdx) this.round++;
    this.turnIdx = i;
    if (this.round > MAX_ROUNDS) return this.finish(now, "rounds");
    // 증강 고르기: 살아 있는 모두가 2번씩 쐈을 때
    if (this.mode === "augment" && this.pickIdx < 4) {
      const al = this.alivePlayers().filter(q => !q.boss);
      if ((al.length > 1 || this.bossP) && al.length && al.every(q => q.shotsSincePick >= PICK_EVERY) && al.some(q => q.augs.length < MAX_AUGS)) return this.startPick(this.pickIdx + 1, now);
    }
    this.startTurn(now);
  }

  // ---------- 준비형 증강 (발사 전) ----------
  useAug(uid, pl, now) {
    this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (this.phase !== "aim" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    const id = String(pl?.id || ""), def = AUG[id], a = this.aug(p, id);
    if (!def || !a) return { ok: false, error: "NO_AUG" };
    if (def.kind !== "pre") return { ok: false, error: def.kind === "shot" ? "USE_WITH_SHOT" : "PASSIVE" };
    if (!(a.charges > 0)) return { ok: false, error: "NO_CHARGES" };
    if (a.cd > 0) return { ok: false, error: "COOLDOWN" };
    if (t.augUsed) return { ok: false, error: "AUG_USED" };
    const L = this.L;
    const own = () => { const d = this.discs.find(x => x.id === pl.disc && x.alive && x.owner === uid); return d || null; };
    const pt = () => { const x = Number(pl.x), y = Number(pl.y); return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null; };
    let fx = { id };
    switch (id) {
      case "teleport": case "spaceMove": {
        const d = own(), q = pt(); if (!d) return { ok: false, error: "PICK_OWN" }; if (!q) return { ok: false, error: "PICK_POINT" };
        const margin = d.r * 3; // 가장자리에서 알 1.5개 (반지름 3배) 안쪽만
        if (q.x < margin || q.x > L - margin || q.y < margin || q.y > L - margin) return { ok: false, error: "TOO_EDGE" };
        if (id === "teleport" && Math.hypot(q.x - d.x, q.y - d.y) > BASE_R * 2 * (def.range || 4)) return { ok: false, error: "TOO_FAR" };
        const s = this.safe(q.x, q.y, d.r, { margin, ignore: d });
        if (!s || Math.hypot(s.x - q.x, s.y - q.y) > BASE_R * 2.5) return { ok: false, error: "NO_SPACE" };
        fx.from = { x: d.x, y: d.y }; d.x = s.x; d.y = s.y; fx.disc = d.id; fx.to = { x: Math.round(s.x), y: Math.round(s.y) };
        break;
      }
      case "posSwap": {
        const d = own(); const e = this.discs.find(x => x.id === pl.target && x.alive && !this.sameSide(x.owner, uid));
        if (!d) return { ok: false, error: "PICK_OWN" }; if (!e) return { ok: false, error: "PICK_ENEMY" };
        if (e.kind === "boss") return { ok: false, error: "BOSS_IMMUNE" };
        const ax = d.x, ay = d.y; d.x = e.x; d.y = e.y; e.x = ax; e.y = ay;
        // 크기가 다르면 겹칠 수 있음 → 겹친 쪽을 가까운 빈 곳으로
        for (const z of [d, e]) { const s = this.safe(z.x, z.y, z.r, { ignore: z }); if (s) { z.x = s.x; z.y = s.y; } }
        fx.disc = d.id; fx.target = e.id; fx.targetOwner = e.owner;
        break;
      }
      case "revive": {
        const back = this.reviveOne(p); if (!back) return { ok: false, error: "NOTHING_FALLEN" };
        fx.disc = back.id; break;
      }
      case "legion": {
        const extra = this.discs.filter(x => x.alive && x.owner === uid && x.kind !== "stone").length;
        const cnt = Math.min(2, EXTRA_CAP - extra); if (cnt <= 0) return { ok: false, error: "EXTRA_FULL" };
        const base = this.discsOf(uid)[0]; const kids = [];
        for (let i = 0; i < cnt; i++) {
          const r = BASE_R * KIND_SCALE.legion;
          const s = this.safe((base?.x ?? L / 2) + (i ? 1 : -1) * BASE_R * 2.5, base?.y ?? L / 2, r, { margin: BASE_R * 3 });
          if (!s) break;
          const k = this.newDisc({ owner: uid, team: p.team, x: s.x, y: s.y, kind: "legion", home: base?.home });
          this.discs.push(k); kids.push(k.id);
        }
        if (!kids.length) return { ok: false, error: "NO_SPACE" };
        fx.kids = kids; break;
      }
      case "timeRewind": {
        const s = this.snap;
        if (!s || s.shooter === uid || s.shotSeq !== this.shotSeq) return { ok: false, error: "CANT_REWIND" };
        this.discs = s.discs.map(x => ({ ...x }));
        for (const q of this.players) { const o = s.out.get(q.id); q.out = o.out; q.outAt = o.outAt; }
        // 그사이 나간 사람은 되살리지 않음 (알도 판에서 뺌)
        for (const q of this.players) if (q.left) { q.out = true; for (const d of this.discs) if (d.owner === q.id) d.alive = false; }
        this.snap = null; fx.rewind = true;
        break;
      }
      case "ironWall": { const d = own(); if (!d) return { ok: false, error: "PICK_OWN" }; d.iron = 1; fx.disc = d.id; break; }
      case "goldenStone": {
        const d = own(); if (!d) return { ok: false, error: "PICK_OWN" };
        if (this.discs.some(x => x.alive && x.owner === uid && x.golden)) return { ok: false, error: "ALREADY_GOLDEN" };
        d.golden = true; d.shield++;
        this.applyStats();
        const s = this.safe(d.x, d.y, d.r, { ignore: d }); if (s) { d.x = s.x; d.y = s.y; }
        fx.disc = d.id; break;
      }
      default: return { ok: false, error: "NO_AUG" };
    }
    a.charges--; a.cd = (def.cd || 0) + 1; t.augUsed = true; p.stats.augUsed++;
    this.applyStats();
    this.push("aug", { uid, ...fx, big: def.rarity === "legendary" });
    this.addLog(`${p.name}: ${def.name}`, uid);
    return { ok: true };
  }
  reviveOne(p) {
    const fallen = this.discs.filter(x => !x.alive && x.owner === p.id && x.kind === "stone");
    if (!fallen.length) return null;
    const d = fallen[0];
    const s = this.safe(d.home.x, d.home.y, BASE_R, { margin: BASE_R * 3, discs: this.discs.filter(x => x !== d) });
    if (!s) return null;
    d.alive = true; d.x = s.x; d.y = s.y; d.vx = 0; d.vy = 0; d.shield = 0; d.golden = false; d.iron = 0; d.split = 0;
    p.out = false;
    this.applyStats();
    return d;
  }

  // ---------- 발사 ----------
  /** pl = { disc, angle(라디안), power(0~1), curve(-1|0|1), aug:{ id, x, y } } */
  shoot(uid, pl, now) {
    this._now = now;
    const p = this.P(uid), t = this.turn;
    if (this.phase !== "aim" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    const d = this.discs.find(x => x.id === pl?.disc && x.alive);
    if (!d) return { ok: false, error: "NO_DISC" };
    if (d.owner !== uid) return { ok: false, error: "NOT_YOUR_DISC" };
    // 각도·힘은 진짜 숫자만 (null·문자열을 0으로 읽어 발사되던 것 막음)
    if (typeof pl.angle !== "number" || typeof pl.power !== "number") return { ok: false, error: "BAD_SHOT" };
    const angle = pl.angle, power = pl.power;
    if (!Number.isFinite(angle) || !Number.isFinite(power)) return { ok: false, error: "BAD_SHOT" };
    const pw = Math.max(0.05, Math.min(1, power));
    // 발사형 증강
    let sa = null, sdef = null;
    if (pl.aug?.id) {
      if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
      sdef = AUG[pl.aug.id]; sa = this.aug(p, pl.aug.id);
      if (!sdef || !sa) return { ok: false, error: "NO_AUG" };
      if (sdef.kind !== "shot") return { ok: false, error: "NOT_SHOT_AUG" };
      if (!(sa.charges > 0)) return { ok: false, error: "NO_CHARGES" };
      if (sa.cd > 0) return { ok: false, error: "COOLDOWN" };
      if (t.augUsed) return { ok: false, error: "AUG_USED" };
      if (sdef.id === "blackHole") { const x = Number(pl.aug.x), y = Number(pl.aug.y); if (!(x >= 0 && x <= this.L && y >= 0 && y <= this.L)) return { ok: false, error: "PICK_POINT" }; }
    }
    this.takeSnap(uid);
    this.applyStats(d.id);
    const syn = this.syn(p), has = (id) => !!this.aug(p, id);
    let speed = VMAX * Math.pow(pw, 1.1);
    if (has("strongFinger")) speed *= 1.1;
    if (has("lastStone") && this.discsOf(uid).length === 1) speed *= 1.12;
    if (has("flickGod")) speed *= 1.12;
    if (syn.includes("power")) speed *= 1.06;
    if (p.combo > 0 && has("combo")) speed *= 1.15;
    let err = 2.4 * Math.PI / 180 * pw;
    if (has("preciseAim")) err *= 0.7;
    if (has("stance")) err *= 0.3;
    if (has("flickGod")) err = 0;
    const tags = {}, fields = [], quake = [];
    const fieldMul = syn.includes("field") ? 1.2 : 1;
    let restore = null;
    if (sdef) {
      const id = sdef.id;
      if (id === "godFinger") { speed *= 1.6; err = 0; restore = { m: d.m, deal: d.dealMul }; d.m *= 2; d.dealMul *= 1.3; }
      if (id === "giant") { restore = { r: d.r, m: d.m }; d.r *= 1.45; d.m *= 1.9; }
      if (id === "splitStone") d._split = 1;
      if (id === "tripleSplit") d._triple = 1;
      if (id === "bombStone") d._bomb = 1;
      if (id === "megaBlast") d._mega = 1;
      if (id === "magnetStone") d._magnet = 1;
      if (id === "iceStone") tags.ice = 1;
      if (id === "whirl") { tags.whirl = 1; d._whirl = 1; }
      if (id === "chainShock") tags.chain = 1;
      if (id === "gravity") fields.push({ kind: "gravity", ax: Math.cos(angle) * 980 * fieldMul, ay: Math.sin(angle) * 980 * fieldMul, dur: 1.2 });
      if (id === "blackHole") fields.push({ kind: "blackhole", x: Number(pl.aug.x), y: Number(pl.aug.y), R: BASE_R * 2 * 7, acc: 2600 * fieldMul, dur: 2.5 });
      if (id === "earthquake") for (const x of this.discs) if (x.alive && x !== d && !x.iron) { const a = this.rng() * Math.PI * 2, v = (150 + this.rng() * 130) * fieldMul / (x.kind === "boss" ? 2 : 1); quake.push({ id: x.id, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); }
      sa.charges--; sa.cd = (sdef.cd || 0) + 1; t.augUsed = true; p.stats.augUsed++;
    }
    if (p.freeGiant && !restore) { p.freeGiant = false; restore = { r: d.r, m: d.m }; d.r *= 1.45; d.m *= 1.9; this.push("aug", { uid, id: "giant", donation: true }); }
    if (restore?.r) { const s = this.safe(d.x, d.y, d.r, { ignore: d }); if (s && Math.hypot(s.x - d.x, s.y - d.y) < BASE_R * 3) { d.x = s.x; d.y = s.y; } }
    const ang = angle + (this.rng() * 2 - 1) * err;
    const curve = tags.whirl ? (Number(pl.curve) > 0 ? 1 : Number(pl.curve) < 0 ? -1 : 0) : 0;
    this._fire(p, { id: d.id, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, curve, tags, fields, quake }, now, { disc: d.id, angle: ang, speed, aug: sdef?.id || null, restore, label: sdef ? ` [${sdef.name}]` : "" });
    return { ok: true, seq: this.shotSeq };
  }
  takeSnap(uid) { this.snap = { shooter: uid, shotSeq: this.shotSeq + 1, discs: this.discs.map(x => ({ ...x })), out: new Map(this.players.map(q => [q.id, { out: q.out, outAt: q.outAt }])) }; }
  /** 실제 계산 + 결과 정리 (사람 발사·보스 기술 공통) */
  _fire(p, shot, now, o = {}) {
    const d = shot.id ? this.discs.find(x => x.id === shot.id) : null;
    const reacts = [];
    this._shotHit = false;
    const before = new Map(this.discs.map(x => [x.id, x.alive]));
    const bossHpBefore = this.bossDisc()?.shield ?? null;
    const res = simulate(this.world(), shot, this.hooksFor(p, { out: reacts }));
    if (o.restore && d) { if (o.restore.r) d.r = o.restore.r; if (o.restore.m) d.m = o.restore.m; if (o.restore.deal) d.dealMul = o.restore.deal; }
    this.shotSeq++;
    p.stats.shots++; p.shotsSincePick++;
    // 보스가 체력 0에서 떨어지면 부하도 같이 사라짐
    if (this.bossP && !this.bossDisc()) for (const x of this.discs) if (x.alive && x.owner === this.bossP.id) { x.alive = false; res.events.push({ f: res.frames.length - 1, k: "fall", id: x.id, owner: x.owner, x: Math.round(x.x), y: Math.round(x.y), vx: 0, vy: 0, kind: x.kind, poof: 1 }); }
    const fell = this.discs.filter(x => before.get(x.id) && !x.alive);
    const poofed = new Set(res.events.filter(e => e.k === "fall" && e.poof).map(e => e.id));
    let enemyFell = 0;
    for (const f of fell) {
      const o2 = this.P(f.owner); o2.stats.lost++;
      if (!this.sameSide(f.owner, p.id) && !poofed.has(f.id)) { p.stats.kills++; enemyFell++; if (res.events.some(e => e.k === "fall" && e.id === f.id && e.hole)) p.stats.holes++; }
    }
    p.stats.bKill = Math.max(p.stats.bKill, enemyFell);
    // 보스 피해 (체력 깎인 만큼 + 처치)
    const bossHpAfter = this.bossDisc()?.shield ?? null;
    if (bossHpBefore != null && !p.boss) { const dmg = bossHpAfter == null ? bossHpBefore + 1 : bossHpBefore - bossHpAfter; if (dmg > 0) p.stats.bossDmg += dmg; }
    if (this._shotHit) { p.stats.hits++; p.combo++; } else p.combo = 0;
    const maxHit = Math.max(0, ...res.events.filter(e => e.k === "hit").map(e => e.p));
    p.stats.maxPush = Math.max(p.stats.maxPush, maxHit);
    // 쿨다운: 내 차례가 끝날 때 1씩
    for (const a of p.augs) if (a.cd > 0) a.cd--;
    // 탈락
    const outNow = [];
    for (const q of this.players) if (!q.out && this.discsOf(q.id).length === 0) { q.out = true; q.outAt = this.shotSeq; outNow.push(q.id); }
    // 보스 분노 (체력 절반 이하)
    const bd = this.bossDisc();
    if (bd && !this.rage && this.bossP.bossHp0 >= 2 && bd.shield + 1 <= Math.floor(this.bossP.bossHp0 / 2)) { this.rage = true; this.push("bossRage", { uid: this.bossP.id }); this.addLog(`😡 ${BOSSES[this.bossP.boss].name}: 분노! 매번 기술을 쓰고 더 세져요`); }
    this.applyStats();
    const dur = res.frames.length / (1 / (DT * REC_EVERY));
    const slow = slowWindows(res.events, outNow, fell, (id) => this.P(id), p.id, this);
    this.lastShot = { seq: this.shotSeq, shooter: p.id, disc: o.disc ?? null, angle: o.angle ?? 0, speed: o.speed ?? 0, aug: o.aug || null, curve: shot.curve || 0, frames: res.frames, events: res.events, reacts, fell: fell.map(x => x.id), out: outNow, startAt: now, dur, fields: (shot.fields || []).map(f => ({ ...f })), slow: slow.list, kills: enemyFell, skill: o.skill || null, quakeEvent: !!o.quakeEvent, resume: o.resume || null };
    if (o.quakeEvent) this.lastShot.shooter = null;
    this.phase = "play";
    this.turn = null;
    this.playEnd = now + (dur + slow.extra) * 1000 + 700;
    this.push("shot", { shot: this.lastShot });
    const names = fell.map(x => this.P(x.owner)?.name);
    this.addLog(`${o.quakeEvent ? "🌋 후원: 판 전체가 흔들려요" : `${p.name}: ${o.skill ? SKILL_NAME[o.skill] || "발사" : "발사"}${o.label || ""}`}${fell.length ? ` — ${fell.length}개 떨어짐 (${[...new Set(names)].join(", ")})` : ""}`, o.quakeEvent ? null : p.id);
    if (bossHpAfter != null && bossHpBefore != null && bossHpAfter < bossHpBefore) this.addLog(`💥 ${BOSSES[this.bossP.boss].name} 체력 ${bossHpAfter + 1}/${this.bossP.bossHp0}`);
    for (const id of outNow) this.addLog(this.P(id).boss ? `🏆 ${this.P(id).name} 처치!` : `💀 ${this.P(id).name}: 탈락!`, id);
  }
  /** 재생이 끝나면 승패 → 다음 차례 */
  afterShot(now) {
    const resume = this.lastShot?.resume;
    const sides = new Set(this.alivePlayers().map(p => this.opts.teams ? "t" + p.team : p.id));
    if (sides.size <= 1) return this.finish(now, sides.size === 1 ? "last" : "draw");
    if (resume) { // 후원 '판 흔들기'가 끝나면 같은 사람 차례를 새로 시작
      const i = this.players.findIndex(q => q.id === resume);
      if (i >= 0 && !this.players[i].out) { this.turnIdx = i; this.startTurn(now); if (this.turn) this.turn.resumed = true; return; }
    }
    this.nextTurn(now);
  }
  /** 후원 효과: 판 위 모든 알을 제멋대로 흔듦 (차례 사이에만, 물리로 계산·재생) */
  streamQuake(now) {
    if (this.phase !== "aim" || !this.turn) return false;
    const uid = this.turn.uid;
    this.applyStats();
    const quake = [];
    for (const x of this.discs) if (x.alive && !x.iron) { const a = this.rng() * Math.PI * 2, v = (120 + this.rng() * 120) / (x.kind === "boss" ? 2 : 1); quake.push({ id: x.id, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); }
    const p = this.P(uid);
    const keep = { ...p.stats }, keepSince = p.shotsSincePick, keepCombo = p.combo, keepCd = p.augs.map(a => a.cd);
    this._fire(p, { id: null, vx: 0, vy: 0, quake }, now, { quakeEvent: true, resume: uid });
    // 후원 흔들기는 그 사람 발사로 치지 않음
    const lost = p.stats.lost; p.stats = { ...keep, lost }; p.shotsSincePick = keepSince; p.combo = keepCombo; p.augs.forEach((a, i) => { a.cd = keepCd[i]; });
    this.snap = null;
    return true;
  }
  pass(uid, now, why = "pass") {
    const t = this.turn;
    if (this.phase !== "aim" || !t || t.uid !== uid) return { ok: false, error: "NOT_YOUR_TURN" };
    const p = this.P(uid);
    p.shotsSincePick++; p.combo = 0;
    for (const a of p.augs) if (a.cd > 0) a.cd--;
    this.push(why === "timeout" ? "timeout" : "pass", { uid });
    this.addLog(`${why === "timeout" ? "⏱️" : "⏭️"} ${p.name}: ${why === "timeout" ? "시간 초과 — 차례 넘김" : "차례 넘김"}`, uid);
    this.turn = null;
    this.nextTurn(now);
    return { ok: true };
  }
  finish(now, why) {
    if (this.phase === "ended") return;
    this.phase = "ended"; this.turn = null;
    const sideOf = (p) => this.opts.teams ? "t" + p.team : p.id;
    let rows = this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, boss: p.boss, team: p.team, color: p.color, left: !!p.left, stones: this.discsOf(p.id).length, baseStones: this.discsOf(p.id).filter(d => d.kind === "stone").length, startStones: p.stoneCount, out: p.out, outAt: p.outAt, augs: p.augs.map(a => a.id), stats: { ...p.stats } }));
    const alive = new Set(this.alivePlayers().map(sideOf));
    let winSides;
    if (why === "rounds") {
      if (this.bossP) winSides = new Set([sideOf(this.bossP)]); // 보스전: 시간 안에 못 잡으면 보스 승리
      else {
        const score = new Map(); for (const r of rows) { const s = this.opts.teams ? "t" + r.team : r.id; score.set(s, (score.get(s) || 0) + r.stones); }
        const best = Math.max(...score.values()); winSides = new Set([...score].filter(([, v]) => v === best && v > 0).map(([k]) => k));
      }
    } else if (alive.size === 1) winSides = alive;
    else { const last = Math.max(...this.players.map(p => p.outAt)); winSides = new Set(this.players.filter(p => p.outAt === last).map(sideOf)); } // 한꺼번에 모두 떨어짐 → 공동
    // 보스를 처치했으면 같은 발사에 모두 떨어져도 보스는 승리 아님 (플레이어 편 승리)
    if (this.bossP && this.bossP.out && !this.bossP.left) { winSides.delete(sideOf(this.bossP)); if (!winSides.size) for (const p of this.players) if (!p.boss) winSides.add(sideOf(p)); }
    for (const r of rows) r.win = winSides.has(this.opts.teams ? "t" + r.team : r.id);
    rows.sort((a, b) => (b.win - a.win) || (Number(a.left) - Number(b.left)) || (b.stones - a.stones) || (b.outAt - a.outAt) || (b.stats.kills - a.stats.kills));
    let rank = 0, prev = null;
    rows.forEach((r, i) => { const k = r.win ? "w" : `${r.left}|${r.stones}|${r.outAt}`; if (k !== prev) rank = i + 1; r.rank = r.win ? 1 : rank; prev = k; });
    this.winners = rows.filter(r => r.win).map(r => r.id);
    const bossKilled = !!(this.bossP && this.bossP.out && !this.bossP.left);
    this.result = { mode: this.mode, rows, why, teams: this.bossP ? 0 : this.opts.teams, winners: this.winners, winTeam: this.opts.teams && !this.bossP && winSides.size === 1 ? Number([...winSides][0].slice(1)) : null, at: now, map: this.opts.map, boss: this.bossP ? { kind: this.bossP.boss, killed: bossKilled, hp0: this.bossP.bossHp0 } : null, extra: this.extra };
    this.push("end", { winners: this.winners, why });
    this.addLog(`🏆 게임 끝! ${rows.filter(r => r.win).map(r => r.name).join(", ") || "-"}`);
  }
  leave(uid, now) {
    const p = this.P(uid); if (!p || p.left) return;
    p.left = true;
    if (this.phase === "ended") return;
    p.out = true; p.outAt = 0; p.offer = null; p.picked = true;
    for (const d of this.discs) if (d.owner === uid && d.alive) { d.alive = false; }
    this.push("leave", { uid });
    this.addLog(`${p.name}님이 나갔어요`);
    const sides = new Set(this.alivePlayers().map(q => this.opts.teams ? "t" + q.team : q.id));
    if (sides.size <= 1 && this.phase !== "play") return this.finish(now, "last");
    if (this.phase === "pick") return this.finishPick(now);
    if (this.turn?.uid === uid) { this.turn = null; this.nextTurn(now); }
  }

  // ---------- 시간 흐름 ----------
  tick(now) {
    this._now = now;
    if (this.phase === "ended") return;
    if (this.phase === "pick") {
      for (const p of this.players) if (!p.picked && (p.isBot || !p.connected) && now >= (p.botPickAt || 0)) this.autoPick(p);
      if (now >= this.pickDeadline) for (const p of this.players) if (!p.picked) this.autoPick(p);
      this.finishPick(now); return;
    }
    if (this.phase === "play") { if (now >= this.playEnd) this.afterShot(now); return; }
    const t = this.turn; if (!t) return;
    const p = this.P(t.uid);
    if ((p.isBot || !p.connected) && now >= t.botAt) { if (p.boss) bossTurn(this, p, now); else botTurn(this, p, now); return; }
    if (now >= t.deadline) this.pass(p.id, now, "timeout");
  }

  // ---------- 화면용 상태 (숨길 정보 없음 — 모두 같은 화면) ----------
  view(viewerId) {
    const me = this.P(viewerId), t = this.turn, bd = this.bossDisc();
    return {
      mode: this.mode, opts: this.opts, L: this.L, phase: this.phase, round: this.round, maxRounds: MAX_ROUNDS,
      pickIdx: this.pickIdx, pickDeadline: this.phase === "pick" ? this.pickDeadline : null,
      turn: t ? { uid: t.uid, deadline: t.deadline, sec: t.sec, augUsed: t.augUsed, boss: !!t.boss } : null,
      discs: this.discs.filter(d => d.alive).map(d => ({ id: d.id, owner: d.owner, kind: d.kind, x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10, a: Math.round(d.a * 100) / 100, r: Math.round(d.r * 10) / 10, golden: d.golden, iron: d.iron, shield: d.shield })),
      players: this.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, color: p.color, skin: p.skin, team: p.team, seat: p.seat, title: p.title, boss: p.boss,
        stones: this.discsOf(p.id).length, out: p.out, left: !!p.left, connected: p.connected, combo: p.combo,
        picking: this.phase === "pick" && !p.picked, augs: p.augs.map(a => ({ id: a.id, charges: a.charges, cd: a.cd })), syn: this.syn(p),
        fallen: this.discs.filter(d => !d.alive && d.owner === p.id && d.kind === "stone").length,
      })),
      env: envView(this.env),
      boss: this.bossP ? { uid: this.bossP.id, kind: this.bossP.boss, hp: bd ? bd.shield + 1 : 0, hp0: this.bossP.bossHp0, rage: this.rage, every: this.bossEvery(), next: this.bossEvery() - this.sinceBoss } : null,
      extra: this.extra,
      canRewind: !!(me && t && t.uid === me.id && this.snap && this.snap.shooter !== me.id && this.snap.shotSeq === this.shotSeq),
      shot: this.phase === "play" && this.lastShot ? this.lastShot : null,
      shotSeq: this.shotSeq,
      offer: me && this.phase === "pick" && !me.picked ? me.offer : null, refresh: me ? me.refresh : 0,
      log: this.log.slice(-14), result: this.result,
    };
  }
}

// =========================
// 손맛: 느린 화면 구간 (서버가 정해서 모두 같은 장면 · 그만큼 다음 차례가 늦게 시작)
// · 탈락(마지막 알)·한 번에 2개 이상·보스 체력 깎임 → 그 순간 앞뒤 0.35초를 0.3배 속도로
// =========================
const SLOW_RATE = 0.3, SLOW_HALF = 0.35, MAX_SLOW = 2;
function slowWindows(events, outNow, fell, P, shooterId, g) {
  const fps = 1 / (DT * REC_EVERY), marks = [];
  const outSet = new Set(outNow);
  const falls = events.filter(e => e.k === "fall" && !e.poof);
  // 탈락: 그 사람의 마지막 떨어짐
  for (const uid of outSet) { const last = falls.filter(e => e.owner === uid).pop(); if (last) marks.push({ t: last.f / fps, why: P(uid)?.boss ? "bossDown" : "out" }); }
  // 한 번에 상대 알 2개 이상
  const enemy = falls.filter(e => !g.sameSide(e.owner, shooterId));
  if (enemy.length >= 2 && !marks.length) marks.push({ t: enemy[enemy.length - 1].f / fps, why: "multi" });
  // 보스 체력 깎임
  for (const e of events) if (e.k === "save" && e.how === "boss") marks.push({ t: e.f / fps, why: "bossHit" });
  marks.sort((a, b) => a.t - b.t);
  const list = [];
  for (const m of marks) {
    if (list.length >= MAX_SLOW) break;
    const t0 = Math.max(0, m.t - SLOW_HALF), t1 = m.t + SLOW_HALF;
    const prev = list[list.length - 1]; if (prev && t0 <= prev.t1) { prev.t1 = Math.max(prev.t1, t1); continue; }
    list.push({ t0: Math.round(t0 * 1000) / 1000, t1: Math.round(t1 * 1000) / 1000, rate: SLOW_RATE, why: m.why });
  }
  const extra = list.reduce((s, w) => s + (w.t1 - w.t0) * (1 / w.rate - 1), 0);
  void fell;
  return { list, extra };
}

// =========================
// AI — 후보 발사를 실제 물리로 미리 계산해 점수가 가장 좋은 것
// =========================
function scoreBoard(g, uid, discs) {
  let s = 0;
  const L = g.L, edge = (d) => Math.min(d.x, d.y, L - d.x, L - d.y);
  const counts = new Map();
  for (const d of discs) if (d.alive) counts.set(d.owner, (counts.get(d.owner) || 0) + 1);
  for (const q of g.players) {
    if (q.out) continue;
    const before = g.discsOf(q.id).length, after = counts.get(q.id) || 0, lost = before - after;
    if (g.sameSide(q.id, uid)) s -= lost * (q.id === uid ? 13 : 9);
    else if (!q.boss) { s += lost * 10; if (before > 0 && after === 0) s += 8; }
  }
  // 보스: 체력 깎기·처치가 가장 큰 점수, 부하는 조금
  if (g.bossP && !g.bossP.out && !g.sameSide(g.bossP.id, uid)) {
    const b0 = g.bossDisc(), b1 = discs.find(d => d.alive && d.kind === "boss");
    if (b0) { if (!b1) s += 60; else s += (b0.shield - b1.shield) * 22 + Math.max(0, (edge(b0) - edge(b1)) / L) * 30; }
    const m0 = g.discs.filter(d => d.alive && d.kind === "minion").length, m1 = discs.filter(d => d.alive && d.kind === "minion").length; s += (m0 - m1) * 4;
  }
  for (const d of discs) {
    if (!d.alive) continue;
    const e = edge(d) / L;
    if (g.sameSide(d.owner, uid)) s += Math.min(e, 0.25) * 3; else if (d.kind !== "boss") s -= Math.min(e, 0.25) * 2;
    // 구멍 근처 내 알은 위험
    if (g.env?.holes?.length && g.sameSide(d.owner, uid)) for (const h of g.env.holes) { const dd = Math.hypot(d.x - h.x, d.y - h.y); if (dd < h.r + d.r * 1.5) s -= 2; }
  }
  return s;
}
export function planShot(g, p, { maxCand, only = null, speedMul = 1 } = {}) {
  const mine = g.discsOf(p.id).filter(d => !only || d.id === only), enemies = g.discs.filter(d => d.alive && !g.sameSide(d.owner, p.id));
  if (!mine.length || !enemies.length) return null;
  const diff = p.boss ? "normal" : p.diff;
  const cands = [];
  for (const m of mine) for (const e of enemies) {
    const dx = e.x - m.x, dy = e.y - m.y, dist = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    // 보스를 노릴 땐 더 세게
    const bossT = e.kind === "boss" ? 1.25 : 1;
    for (const off of diff === "easy" ? [0] : [0, 0.08, -0.08]) for (const pw of [0.5, 0.72, 0.95]) cands.push({ disc: m.id, angle: base + off, power: Math.min(1, pw * bossT * (0.6 + Math.min(1, dist / (g.L * 0.7)) * 0.5)), pre: dist * (e.kind === "boss" ? 0.6 : 1) });
  }
  // 가까운 것 우선, 개수 제한
  cands.sort((a, b) => a.pre - b.pre);
  const lim = maxCand || (diff === "hard" ? 36 : diff === "normal" ? 16 : 6);
  const pool = cands.slice(0, lim);
  let best = null;
  g.applyStats();
  for (const c of pool) {
    const discs = g.discs.map(d => ({ ...d }));
    const sh = discs.find(d => d.id === c.disc);
    const v = VMAX * Math.pow(c.power, 1.1) * speedMul;
    simulate({ L: g.L, discs, env: g.env }, { id: sh.id, vx: Math.cos(c.angle) * v, vy: Math.sin(c.angle) * v }, g.hooksFor(p, { dry: true }), { record: false });
    c.score = scoreBoard(g, p.id, discs) + (diff === "easy" ? (g.rng() - 0.5) * 12 : diff === "normal" ? (g.rng() - 0.5) * 4 : 0);
    if (!best || c.score > best.score) best = c;
  }
  if (best) { const noise = diff === "hard" ? 0.012 : diff === "normal" ? 0.035 : 0.08; best.angle += (g.rng() - 0.5) * 2 * noise; }
  return best;
}
function botAugs(g, p, now, plan) {
  if (g.mode !== "augment" || g.turn?.augUsed) return null;
  const can = (id) => { const a = g.aug(p, id); return a && a.charges > 0 && !(a.cd > 0) ? a : null; };
  // 준비형
  if (can("timeRewind") && g.view(p.id).canRewind && g.lastShot && g.lastShot.fell.some(id => { const d = g.snap.discs.find(x => x.id === id); return d && g.sameSide(d.owner, p.id); })) { if (g.useAug(p.id, { id: "timeRewind" }, now).ok) return "pre"; }
  if (can("revive") && g.discs.some(d => !d.alive && d.owner === p.id && d.kind === "stone")) { if (g.useAug(p.id, { id: "revive" }, now).ok) return "pre"; }
  if (can("legion") && g.rng() < 0.6) { if (g.useAug(p.id, { id: "legion" }, now).ok) return "pre"; }
  const mine = g.discsOf(p.id);
  const L = g.L, edge = (d) => Math.min(d.x, d.y, L - d.x, L - d.y);
  if (can("goldenStone") && mine.length && g.rng() < 0.6) { const d = mine.slice().sort((a, b) => edge(a) - edge(b))[0]; if (g.useAug(p.id, { id: "goldenStone", disc: d.id }, now).ok) return "pre"; }
  const risky = mine.filter(d => edge(d) < BASE_R * 3.5).sort((a, b) => edge(a) - edge(b))[0];
  if (risky && can("spaceMove") && g.useAug(p.id, { id: "spaceMove", disc: risky.id, x: L / 2 + (g.rng() - 0.5) * L * 0.3, y: L / 2 + (g.rng() - 0.5) * L * 0.3 }, now).ok) return "pre";
  if (risky && can("teleport")) { const cx = risky.x + Math.sign(L / 2 - risky.x) * BASE_R * 4, cy = risky.y + Math.sign(L / 2 - risky.y) * BASE_R * 4; if (g.useAug(p.id, { id: "teleport", disc: risky.id, x: cx, y: cy }, now).ok) return "pre"; }
  if (risky && can("ironWall") && g.useAug(p.id, { id: "ironWall", disc: risky.id }, now).ok) return "pre";
  if (risky && can("posSwap")) { const e = g.discs.filter(d => d.alive && !g.sameSide(d.owner, p.id) && d.kind !== "boss").sort((a, b) => edge(b) - edge(a))[0]; if (e && g.useAug(p.id, { id: "posSwap", disc: risky.id, target: e.id }, now).ok) return "pre"; }
  // 발사형: 쓸 만하면 이번 발사에
  const shotIds = ["godFinger", "megaBlast", "blackHole", "tripleSplit", "bombStone", "magnetStone", "giant", "splitStone", "chainShock", "gravity", "earthquake", "whirl", "iceStone"];
  if (g.rng() < (p.diff === "easy" ? 0.25 : 0.55)) for (const id of shotIds) if (can(id)) {
    const aug = { id };
    if (id === "blackHole") { const en = g.discs.filter(d => d.alive && !g.sameSide(d.owner, p.id)); const c = en[Math.floor(g.rng() * en.length)]; if (!c) continue; const vx = c.x - L / 2, vy = c.y - L / 2, k = Math.hypot(vx, vy) || 1; aug.x = Math.max(10, Math.min(L - 10, c.x + vx / k * BASE_R * 3)); aug.y = Math.max(10, Math.min(L - 10, c.y + vy / k * BASE_R * 3)); }
    if (id === "iceStone" && plan && plan.power > 0.7) continue;
    return aug;
  }
  return null;
}
export function botTurn(g, p, now) {
  const t = g.turn;
  t.botAt = now + 600;
  const r = botAugs(g, p, now, null);
  if (r === "pre") return; // 준비형을 썼으면 다음 틱에 발사
  const plan = planShot(g, p);
  if (!plan) return g.pass(p.id, now);
  const res = g.shoot(p.id, { disc: plan.disc, angle: plan.angle, power: plan.power, curve: g.rng() < 0.5 ? 1 : -1, aug: r || undefined }, now);
  if (!res.ok) g.shoot(p.id, { disc: plan.disc, angle: plan.angle, power: plan.power }, now);
}

// =========================
// 보스 차례 — 기술 ↔ 평범한 발사 (분노면 매번 기술)
// · BOSS_POW: 보스 발사 세기 (시뮬로 맞춤: 어려움 AI 기준 첫 보스 대부분 이김, 마지막 보스 절반 안쪽)
// =========================
const BOSS_POW = 0.78;
export function bossTurn(g, p, now, force = null) {
  const bd = g.bossDisc(); if (!bd) return g.pass(p.id, now);
  const def = BOSSES[p.boss], L = g.L;
  g.bossTurns++;
  const useSkill = force || g.rage || g.bossTurns % 2 === 0;
  const skill = force || (useSkill ? def.skills[Math.floor(g.bossTurns / 2) % def.skills.length] : null);
  g.takeSnap(p.id); g.applyStats();
  const enemies = g.discs.filter(d => d.alive && !g.sameSide(d.owner, p.id));
  const sp = BOSS_POW * (g.rage ? 1.12 : 1);
  const plan = () => planShot(g, p, { only: bd.id, maxCand: 18, speedMul: sp });
  const shotOf = (pl, mul = 1) => ({ id: bd.id, vx: Math.cos(pl.angle) * VMAX * Math.pow(pl.power, 1.1) * sp * mul, vy: Math.sin(pl.angle) * VMAX * Math.pow(pl.power, 1.1) * sp * mul });
  const radial = (R, S) => { const q = []; for (const d of g.discs) { if (!d.alive || d.owner === p.id || d.iron) continue; const dx = d.x - bd.x, dy = d.y - bd.y, dist = Math.hypot(dx, dy); if (dist > R || dist < 1) continue; const v = S * (1 - dist / R) + 110; q.push({ id: d.id, vx: dx / dist * v, vy: dy / dist * v }); } return q; };
  const cluster = () => { if (!enemies.length) return { x: L / 2, y: L / 2 }; const x = enemies.reduce((s, d) => s + d.x, 0) / enemies.length, y = enemies.reduce((s, d) => s + d.y, 0) / enemies.length; return { x, y }; };
  let shot = null, extra = {};
  switch (skill) {
    case "charge": { const pl = plan(); if (pl) { shot = shotOf({ ...pl, power: 1 }, 1.08); const keep = bd.dealMul; bd.dealMul *= 1.35; extra.restoreDeal = keep; } break; }
    case "stomp": shot = { id: bd.id, vx: 0, vy: 0, quake: radial(L * 0.33, 520) }; extra.ring = { x: bd.x, y: bd.y, R: L * 0.33 }; break;
    case "erupt": shot = { id: bd.id, vx: 0, vy: 0, quake: radial(L * 0.48, 470) }; extra.ring = { x: bd.x, y: bd.y, R: L * 0.48 }; break;
    case "blizzard": { const c = cluster(); let ax = c.x - L / 2, ay = c.y - L / 2; const k = Math.hypot(ax, ay); if (k < 20) { const a = g.rng() * Math.PI * 2; ax = Math.cos(a); ay = Math.sin(a); } else { ax /= k; ay /= k; } shot = { id: bd.id, vx: 0, vy: 0, fields: [{ kind: "gravity", ax: ax * 820, ay: ay * 820, dur: 1.1 }] }; break; }
    case "hole": { const c = cluster(); let vx = c.x - L / 2, vy = c.y - L / 2; const k = Math.hypot(vx, vy) || 1; const x = Math.max(12, Math.min(L - 12, c.x + vx / k * BASE_R * 4)), y = Math.max(12, Math.min(L - 12, c.y + vy / k * BASE_R * 4)); const pl = plan(); shot = pl ? shotOf({ ...pl, power: Math.min(0.6, pl.power) }) : { id: bd.id, vx: 0, vy: 0 }; shot.fields = [{ kind: "blackhole", x, y, R: BASE_R * 2 * 6.5, acc: 2500, dur: 2.3 }]; break; }
    case "summon": { let n = 0; for (let i = 0; i < 2; i++) if (g.spawnMinion(p, i)) n++; extra.summoned = n; const pl = plan(); shot = pl ? shotOf(pl) : { id: bd.id, vx: 0, vy: 0 }; break; }
    case "iceShot": { const pl = plan(); if (pl) { shot = shotOf(pl); shot.tags = { ice: 1 }; } break; }
    case "bombShot": { const pl = plan(); if (pl) { shot = shotOf(pl); bd._bomb = 1; } break; }
  }
  if (!shot) { const pl = plan(); if (!pl) return g.pass(p.id, now); shot = shotOf(pl); }
  g._fire(p, shot, now, { disc: bd.id, angle: Math.atan2(shot.vy, shot.vx), speed: Math.hypot(shot.vx, shot.vy), skill: skill || null });
  if (extra.restoreDeal != null) { const b = g.discs.find(x => x.id === bd.id); if (b) b.dealMul = extra.restoreDeal; }
  if (skill) { g.lastShot.skillFx = { kind: skill, x: Math.round(bd.x), y: Math.round(bd.y), ring: extra.ring ? { x: Math.round(extra.ring.x), y: Math.round(extra.ring.y), R: Math.round(extra.ring.R) } : null, summoned: extra.summoned || 0 }; }
}
