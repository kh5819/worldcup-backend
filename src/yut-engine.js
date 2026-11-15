// =========================
// 플듀 증강 윷놀이 — 게임 엔진 (서버 권한, 네트워크와 분리)
// · 한 판의 모든 상태와 규칙·증강 판정을 여기서만 함. yut.js 는 이 엔진을 감싸 방·소켓을 다룸
// · 모든 행동은 { ok, error } 를 돌려주고, 화면 연출용 사건은 this.events 에 쌓음 (yut.js 가 꺼내 보냄)
// =========================
import { HOME, DONE, forwardPaths, distLeft, throwSticks, sticksFor, isBonus, RES_LABEL } from "./yut-core.js";
import { AUG, rollOffer } from "./yut-augs.js";

const clone = (o) => JSON.parse(JSON.stringify(o));
const MAX_EVENTS = 200;
// 결과별 대략 확률 (AI 위험도 계산용)
const P_RES = { 1: 0.1875, 2: 0.375, 3: 0.25, 4: 0.0625, 5: 0.0625 };

export class YutGame {
  /**
   * players: [{ id, name, team, isBot }] — team 은 0부터. 개인전이면 사람마다 다른 팀
   * opts: { mode:"classic"|"augment", pieces:2~4, backdo:bool, maxAugs:1~6, pickEvery:2~6 }
   */
  constructor(players, opts = {}, rng = Math.random) {
    this.rng = rng;
    this.mode = opts.mode === "classic" ? "classic" : "augment";
    this.pieceCount = Math.max(1, Math.min(4, opts.pieces || 4));
    this.backdo = opts.backdo !== false;
    this.maxAugs = Math.max(1, Math.min(6, opts.maxAugs || 4));
    this.pickEvery = Math.max(2, Math.min(6, opts.pickEvery || 4));
    const teamIds = [...new Set(players.map(p => p.team))].sort((a, b) => a - b);
    this.teams = teamIds.map((t, i) => ({ id: i, members: players.filter(p => p.team === t).map(p => p.id), ptr: 0, turns: 0, defense: 0, revenge: false, reserve: [] }));
    this.players = new Map(players.map(p => [p.id, {
      id: p.id, name: p.name, isBot: !!p.isBot, team: this.teams.findIndex(t => t.members.includes(p.id)),
      augs: [], offer: null, picked: true, refresh: 1, armed: {}, capUsed: {}, luckyDo: 0,
      stats: { captures: 0, captured: 0, yut: 0, mo: 0, throws: 0, finished: 0, augUses: {}, augImpact: {} },
    }]));
    this.pieces = [];
    this.teams.forEach(t => { for (let k = 0; k < this.pieceCount; k++) this.pieces.push(newPiece(`t${t.id}p${k}`, t.id)); });
    this.cloneSeq = 0;
    this.teamIdx = 0; this.round = 1; this.turnNo = 0;
    this.phase = "init"; this.pickIdx = -1; this.cur = null; this.events = []; this.winner = null; this.ranking = null; this.lastPickRound = 0;
    this.firstEntry = new Set(); // 안전한 출발: 팀별 첫 출발 한 번
  }

  // ---------------- 진행 ----------------
  start() {
    if (this.mode === "augment") return this.startPick(0);
    this.startTurn();
  }
  startPick(idx) {
    this.phase = "pick"; this.pickIdx = idx; this.lastPickRound = this.round;
    for (const p of this.players.values()) {
      if (p.augs.length >= this.maxAugs) { p.offer = null; p.picked = true; continue; }
      p.offer = rollOffer(idx, p.augs.map(a => a.id), this.rng);
      p.picked = !p.offer.length;
    }
    this.emit("pick", { idx });
    if ([...this.players.values()].every(p => p.picked)) this.endPick();
  }
  pick(uid, augId, auto = false) {
    const p = this.players.get(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (!p.offer?.includes(augId)) return { ok: false, error: "NOT_OFFERED" };
    const a = AUG[augId];
    p.augs.push({ id: augId, charges: a.charges ?? null });
    if (a.id === "ironWall") this.teams[p.team].defense += 1;
    if (a.id === "absoluteDefense") this.teams[p.team].defense += 2;
    p.offer = null; p.picked = true;
    this.emit("picked", { uid, aug: augId, auto });
    if ([...this.players.values()].every(q => q.picked)) this.endPick();
    return { ok: true };
  }
  refreshOffer(uid) {
    const p = this.players.get(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" };
    p.refresh--;
    p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng, 3, p.offer || []);
    return { ok: true, offer: p.offer };
  }
  autoPickAll() {
    for (const p of this.players.values()) if (!p.picked && p.offer?.length) this.pick(p.id, bestOffer(p.offer), true);
  }
  endPick() {
    if (this.phase !== "pick") return;
    this.phase = "play";
    if (!this.cur) this.startTurn(); else this.emit("resume", {});
  }

  startTurn() {
    const team = this.teams[this.teamIdx];
    const uid = team.members[team.ptr % team.members.length];
    const me = this.players.get(uid);
    this.turnNo++;
    // 분신 수명
    for (const pc of this.pieces) if (pc.clone && pc.team === team.id && pc.pos !== DONE) { pc.ttl--; if (pc.ttl <= 0) { pc.pos = DONE; pc.gone = true; this.emit("cloneGone", { piece: pc.id }); } }
    this.pieces = this.pieces.filter(pc => !pc.gone);
    this.cur = { uid, team: team.id, phase: "throw", throws: 1, pending: [], snap: null, moved: 0, choice: null, revenge: false, groupWith: null, steal: null };
    // 운명 강탈로 빼앗아 둔 결과
    if (team.reserve.length) { for (const r of team.reserve) this.cur.pending.push({ r, src: "steal" }); this.emit("reserve", { uid, results: team.reserve.slice() }); team.reserve = []; }
    if (team.revenge) { team.revenge = false; if (this.teamHas(team.id, "revengeStep")) this.cur.revenge = true; }
    this.phase = "play";
    this.emit("turn", { uid, team: team.id, round: this.round });
    void me;
  }
  endTurn() {
    const team = this.teams[this.cur.team];
    // 봉쇄는 그 팀의 차례 하나가 끝나면 풀림
    for (const pc of this.pieces) if (pc.team === team.id) pc.blocked = false;
    // 보호(상대 한 바퀴)는 다른 팀 차례가 끝날 때마다 줄어듦
    for (const pc of this.pieces) if (pc.team !== team.id && pc.guard > 0) pc.guard--;
    team.ptr++; team.turns++;
    const me = this.players.get(this.cur.uid);
    if (me) me.armed.split = false, me.armed.invincibleMarch = false, me.armed.pathWarp = false;
    this.cur = null;
    this.teamIdx = (this.teamIdx + 1) % this.teams.length;
    if (this.teamIdx === 0) {
      this.round++;
      // 증강 고르기: 시작 + pickEvery 라운드마다, 최대 보유 수까지
      if (this.mode === "augment" && this.round - this.lastPickRound >= this.pickEvery && [...this.players.values()].some(p => p.augs.length < this.maxAugs)) {
        this.startPick(this.pickIdx + 1);
        return;
      }
    }
    this.startTurn();
  }

  // ---------------- 던지기 ----------------
  throw(uid) {
    const c = this.cur;
    if (!this.isTurn(uid)) return { ok: false, error: "NOT_YOUR_TURN" };
    if (c.phase !== "throw" || c.throws <= 0) return { ok: false, error: "NO_THROW" };
    if (c.choice) return { ok: false, error: "CHOOSE_FIRST" };
    const me = this.players.get(uid);
    c.throws--;
    c.snap = null; // 던졌으면 직전 이동 되돌리기 불가
    let forced = null;
    if (me.armed.legendYut) { me.armed.legendYut = false; forced = this.rng() < 0.5 ? 4 : 5; this.useCount(me, "legendYut"); }
    if (me.armed.fateChoice) {
      me.armed.fateChoice = false; this.useCount(me, "fateChoice");
      const a = forced ? { sticks: sticksFor(forced, this.rng, this.backdo), result: forced } : throwSticks(this.rng, { backdo: this.backdo });
      const b = throwSticks(this.rng, { backdo: this.backdo });
      c.choice = [a, b];
      c.throws++; // 고른 뒤 처리하며 다시 깎음
      this.emit("choice", { uid, options: [a, b] });
      return { ok: true, choice: true };
    }
    const t = forced ? { sticks: sticksFor(forced, this.rng, this.backdo), result: forced } : throwSticks(this.rng, { backdo: this.backdo });
    this.afterThrow(me, t);
    return { ok: true, result: t.result };
  }
  choose(uid, idx) {
    const c = this.cur;
    if (!this.isTurn(uid) || !c.choice) return { ok: false, error: "NO_CHOICE" };
    if (idx !== 0 && idx !== 1) return { ok: false, error: "BAD_CHOICE" };
    const t = c.choice[idx]; c.choice = null; c.throws--;
    this.afterThrow(this.players.get(uid), t, true);
    return { ok: true, result: t.result };
  }
  afterThrow(me, t, chosen = false) {
    const c = this.cur;
    let r = t.result;
    me.stats.throws++;
    // 황금 윷: 걸 → 윷 (최대 2번)
    let golden = false;
    if (r === 3 && this.hasAug(me, "goldenYut") && this.capLeft(me, "goldenYut", 2)) { r = 4; golden = true; this.capUse(me, "goldenYut"); }
    if (r === 4) me.stats.yut++;
    if (r === 5) me.stats.mo++;
    const extra = [];
    if (r === 4 && this.hasAug(me, "yutBlessing") && this.capLeft(me, "yutBlessing", 3)) { extra.push(1); this.capUse(me, "yutBlessing"); this.impact(me, "yutBlessing", 1); }
    if (r === 5 && this.hasAug(me, "moBlessing") && this.capLeft(me, "moBlessing", 3)) { extra.push(2); this.capUse(me, "moBlessing"); this.impact(me, "moBlessing", 2); }
    if (r === 1 && this.hasAug(me, "luckyDo") && me.luckyDo < 1 && this.capLeft(me, "luckyDo", 3)) { me.luckyDo++; this.capUse(me, "luckyDo"); }
    if (isBonus(r)) c.throws++;
    // 운명 강탈: 상대가 켜 뒀으면 이 차례 첫 결과를 가져감
    let stolenBy = null;
    if (!c.stealChecked) {
      c.stealChecked = true;
      for (const p of this.players.values()) {
        if (p.team === me.team || !p.armed.fateSteal) continue;
        p.armed.fateSteal = false; this.useCount(p, "fateSteal");
        this.teams[p.team].reserve.push(r); stolenBy = p.id; this.impact(p, "fateSteal", 5);
        break;
      }
    }
    if (!stolenBy) c.pending.push({ r, src: golden ? "golden" : "throw" });
    for (const e of extra) c.pending.push({ r: e, src: "bless" });
    this.emit("throw", { uid: me.id, sticks: golden ? sticksFor(4, this.rng, this.backdo) : t.sticks, result: r, golden, chosen, stolenBy, extra, throwsLeft: c.throws });
    this.settle();
  }
  /** 던질 게 없으면 이동 단계로, 쓸 수 있는 결과가 없으면 버리고, 다 끝나면 차례 넘김 */
  settle() {
    const c = this.cur; if (!c || this.phase === "over") return;
    if (c.throws > 0 && !c.choice) { c.phase = "throw"; return; }
    if (c.choice) return;
    c.phase = "move";
    // 남은 결과를 하나도 쓸 수 없을 때만 전부 버림 — 하나라도 쓸 수 있으면 다 남겨 둠
    // (예: 윷+빽도에 판 위 말이 없으면, 윷으로 말을 내보낸 뒤 빽도를 쓸 수 있어야 함)
    const me = this.players.get(c.uid);
    if (c.pending.length && !c.pending.some(pr => this.movesFor(c.team, pr.r, me).length)) {
      for (const pr of c.pending) this.emit("discard", { uid: c.uid, result: pr.r });
      c.pending = [];
    }
    if (!c.pending.length) {
      if (c.throws > 0) { c.phase = "throw"; return; }
      this.endTurn();
    }
  }

  // ---------------- 이동 ----------------
  /** 이 팀이 결과 r로 할 수 있는 이동 목록 [{ pieceId, pathIdx, to, steps, route, group }] */
  movesFor(team, r, me = null, flagsExtra = {}) {
    const out = [];
    const seen = new Set();
    for (const pc of this.pieces) {
      if (pc.team !== team || pc.pos === DONE) continue;
      const key = pc.pos === HOME ? "home" : "n" + pc.pos + (pc.clone ? "c" : "");
      if (seen.has(key)) continue;
      seen.add(key);
      if (this.groupBlocked(pc)) continue; // 봉쇄된 말이 하나라도 업혀 있으면 그 무리는 못 움직임
      const paths = this.pathsFor(pc, r, me, flagsExtra);
      paths.forEach((p, i) => out.push({ pieceId: pc.id, pathIdx: i, ...p }));
    }
    return out;
  }
  groupBlocked(pc) { return pc.pos !== HOME && this.groupOf(pc).some(p => p.blocked); }
  groupOf(pc) {
    if (pc.pos === HOME || pc.pos === DONE) return [pc];
    // 분신은 진짜 말과 업히지 않고 따로 움직임 (분신끼리만)
    return this.pieces.filter(q => q.team === pc.team && q.pos === pc.pos && !!q.clone === !!pc.clone);
  }
  prevOf(pc) { return pc.hist.length ? pc.hist[pc.hist.length - 1] : null; }
  /** 칸 수 보너스 계산 (앞으로 갈 때만) */
  bonusSteps(pc, r, me, group) {
    if (r < 1 || !me) return { n: r, notes: [] };
    let n = r; const notes = [];
    if (this.mode === "augment") {
      if ((r === 1 || r === 2) && this.hasAug(me, "quickStep") && this.capLeft(me, "quickStep", 6)) { n++; notes.push("quickStep"); }
      if (me.luckyDo > 0 && this.hasAug(me, "luckyDo")) { n += 2; notes.push("luckyDo"); }
      if (group.length >= 2 && this.hasAug(me, "buddyPower")) { n += 2; notes.push("buddyPower"); }
      if (pc.pos !== HOME && this.hasAug(me, "escapeArtist") && this.threatenedBy(pc, 3)) { n++; notes.push("escapeArtist"); }
      if (pc.pos !== HOME && this.hasAug(me, "lastDash") && distLeft(pc.pos, this.prevOf(pc)) <= 5) { n++; notes.push("lastDash"); }
      if (pc.pos !== HOME && this.hasAug(me, "chaser") && this.preyAhead(pc, 5)) { n += 2; notes.push("chaser"); }
      if (this.cur?.revenge) { n += 2; notes.push("revengeStep"); }
      if (this.hasAug(me, "comeback") && this.isBehind(me.team, 15)) { n += 2; notes.push("comeback"); }
      const alive = this.pieces.filter(q => q.team === me.team && !q.clone && q.pos !== DONE);
      if (alive.length === 1 && alive[0] === pc && this.hasAug(me, "finalDash")) { n *= 2; notes.push("finalDash"); }
    }
    return { n, notes };
  }
  pathsFor(pc, r, me, flagsExtra = {}) {
    if (r === -1) {
      if (pc.pos === HOME) return [];
      const back = pc.hist.length ? pc.hist[pc.hist.length - 1] : (pc.pos === 0 ? 19 : Math.max(0, pc.pos - 1));
      return [{ to: back, steps: [back], route: "뒤로", n: 1, notes: [] }];
    }
    const group = this.groupOf(pc);
    const { n, notes } = this.bonusSteps(pc, r, me, group);
    const fork = !!(me && this.mode === "augment" && this.hasAug(me, "forkMaster") && this.capLeft(me, "forkMaster", 2));
    const flags = {
      passTurn: fork || !!(me && this.mode === "augment" && me.armed.pathWarp) || !!flagsExtra.passTurn,
      gate15: !!(me && this.mode === "augment" && (this.hasAug(me, "shortcutOpen") || me.armed.pathWarp)) || !!flagsExtra.gate15,
    };
    const plain = new Set(forwardPaths(pc.pos, this.prevOf(pc), n, { gate15: flags.gate15 }).map(p => p.steps.join(",")));
    return forwardPaths(pc.pos, this.prevOf(pc), n, flags).map(p => {
      const turned = !plain.has(p.steps.join(",")); // 지나가며 꺾은 길
      return { ...p, n, notes: turned && fork && !me.armed.pathWarp ? [...notes, "forkMaster"] : notes };
    });
  }

  /** 결과 pending[ri] 로 말 pieceId 를 pathIdx 길로 이동 */
  move(uid, { ri, pieceId, pathIdx = 0 } = {}) {
    const c = this.cur;
    if (!this.isTurn(uid)) return { ok: false, error: "NOT_YOUR_TURN" };
    if (c.phase !== "move") return { ok: false, error: "THROW_FIRST" };
    const pr = c.pending[ri];
    if (!pr) return { ok: false, error: "BAD_RESULT" };
    const pc = this.pieces.find(p => p.id === pieceId);
    if (!pc || pc.team !== c.team || pc.pos === DONE) return { ok: false, error: "BAD_PIECE" };
    if (this.groupBlocked(pc)) return { ok: false, error: "BLOCKED" };
    const me = this.players.get(uid);
    const paths = this.pathsFor(pc, pr.r, me);
    const path = paths[pathIdx];
    if (!path) return { ok: false, error: "BAD_PATH" };
    // 되돌리기용 상태 저장
    c.snap = { pieces: clone(this.pieces), pending: clone(c.pending), throws: c.throws, moved: c.moved, luckyDo: me.luckyDo, capUsed: clone(me.capUsed), armed: clone(me.armed), augs: clone(me.augs), groupWith: c.groupWith, revenge: c.revenge, defense: this.teams.map(t => t.defense), stats: clone([...this.players.values()].map(p => [p.id, p.stats])), firstEntry: [...this.firstEntry], teamsRevenge: this.teams.map(t => t.revenge) };
    c.pending.splice(ri, 1);
    // 보너스 소모
    for (const nt of path.notes || []) {
      if (nt === "quickStep") this.capUse(me, "quickStep");
      if (nt === "forkMaster") this.capUse(me, "forkMaster");
      if (nt === "luckyDo") me.luckyDo--;
      this.impact(me, nt, 1);
    }
    let group = this.groupOf(pc);
    group = [pc, ...group.filter(x => x !== pc)]; // 고른 말이 맨 앞 (업힌 말 기록은 이 말 기준)
    if (me.armed.split && group.length > 1) { group = [pc]; me.armed.split = false; this.useCount(me, "split"); }
    const res = this.relocate(me, group, path.to, path.steps, pr.r === -1);
    // 집단 이동: 두 번째 무리도 같은 결과로 (기본 길)
    if (c.groupWith && pr.r !== -1) {
      const g2 = this.pieces.find(p => p.id === c.groupWith);
      c.groupWith = null;
      if (g2 && g2.pos !== DONE && g2.pos !== HOME && g2.team === c.team && !group.includes(g2)) {
        const p2 = this.pathsFor(g2, pr.r, me)[0];
        if (p2) { const r2 = this.relocate(me, this.groupOf(g2), p2.to, p2.steps, false); res.captured += r2.captured; this.impact(me, "groupMove", 4); }
      }
    }
    // 무적 행군
    if (me.armed.invincibleMarch) { me.armed.invincibleMarch = false; this.useCount(me, "invincibleMarch"); for (const g of group) if (g.pos !== DONE) g.guard = (this.teams.length - 1) * 2; } // 상대 두 바퀴
    if (me.armed.pathWarp) { me.armed.pathWarp = false; this.useCount(me, "pathWarp"); }
    c.moved++;
    if (this.checkWin(c.team)) return { ok: true, win: true };
    this.settle();
    return { ok: true, captured: res.captured };
  }

  /** 무리를 to 로 옮기고 잡기·업기·완주 처리. 반환 { captured } */
  relocate(me, group, to, steps, isBack) {
    const team = group[0].team;
    const from = group[0].pos;
    for (const g of group) {
      const wasHome = g.pos === HOME;
      if (isBack) { if (g.hist.length) g.hist.pop(); }
      else if (to === DONE) g.hist = [];
      else {
        g.hist.push(g.pos === HOME ? 0 : g.pos);
        for (let k = 0; k < steps.length - 1; k++) if (steps[k] !== DONE) g.hist.push(steps[k]);
        if (g.hist.length > 40) g.hist.splice(0, g.hist.length - 40);
      }
      g.pos = to;
      if (to === DONE) {
        if (g.clone) g.gone = true; else me && this.players.get(me.id) && (this.players.get(me.id).stats.finished++);
      }
      // 출발 보호
      if (wasHome && to !== DONE && this.mode === "augment") {
        if (!this.firstEntry.has(team) && this.teamHas(team, "safeStart")) { this.firstEntry.add(team); g.shield = (g.shield || 0) + 1; this.emit("fx", { kind: "shield", piece: g.id }); }
        if (this.teamHas(team, "startSupport")) { g.guard = Math.max(g.guard || 0, this.teams.length - 1); this.emit("fx", { kind: "shield", piece: g.id }); }
      }
    }
    this.pieces = this.pieces.filter(p => !p.gone);
    // 같은 칸 우리 말(업힌 말)은 기록을 하나로 — 다른 길로 와서 업혀도 빽도·갈림길 방향이 같아야 함
    if (to !== DONE) { const lead = group[0].pos === to ? group[0] : null; if (lead) for (const p of this.pieces) if (p.team === team && p.pos === to && p !== lead) p.hist = lead.hist.slice(); }
    let captured = 0, blocked = 0;
    if (to !== DONE && to !== HOME) {
      const victims = this.pieces.filter(p => p.team !== team && p.pos === to);
      if (victims.length) {
        const vTeam = victims[0].team;
        const guarded = victims.some(v => v.guard > 0);
        const shielded = victims.find(v => v.shield > 0);
        if (guarded) { blocked = 1; this.emit("fx", { kind: "blocked", node: to, reason: "guard" }); }
        else if (shielded) { shielded.shield--; blocked = 1; this.emit("fx", { kind: "blocked", node: to, reason: "shield" }); this.impactTeam(vTeam, "safeStart", 6); }
        else if (this.teams[vTeam].defense > 0) {
          this.teams[vTeam].defense--; blocked = 1;
          const who = this.teamHas(vTeam, "absoluteDefense") ? "absoluteDefense" : "ironWall";
          this.emit("fx", { kind: "blocked", node: to, reason: who }); this.impactTeam(vTeam, who, 6);
        } else {
          for (const v of victims) { if (v.clone) v.gone = true; else { v.pos = HOME; v.hist = []; v.wasCaptured = true; v.shield = 0; v.guard = 0; } }
          this.pieces = this.pieces.filter(p => !p.gone);
          captured = victims.length;
          if (me) { me.stats.captures += victims.filter(v => !v.clone).length; }
          for (const v of victims) { const owner = [...this.players.values()].find(p => p.team === v.team); if (owner && !v.clone) owner.stats.captured++; }
          this.teams[vTeam].revenge = true;
          // 잡으면 한 번 더 던짐 (지금 차례인 팀만)
          if (this.cur && this.cur.team === team) {
            this.cur.throws++;
            if (me && this.hasAug(me, "chainChase")) { this.cur.pending.push({ r: 3, src: "chain" }); this.impact(me, "chainChase", 3); }
          }
        }
      }
    }
    this.emit("move", { uid: me?.id || null, team, pieces: group.map(g => g.id), from, to, steps, back: isBack, captured, blocked, finish: to === DONE });
    return { captured, blocked };
  }

  checkWin(team) {
    const real = this.pieces.filter(p => p.team === team && !p.clone);
    if (!real.length || !real.every(p => p.pos === DONE)) return false;
    this.finish(team);
    return true;
  }
  finish(winTeam) {
    this.phase = "over"; this.winner = winTeam;
    const rows = this.teams.map(t => {
      const real = this.pieces.filter(p => p.team === t.id && !p.clone);
      return { team: t.id, members: t.members, finished: real.filter(p => p.pos === DONE).length, left: real.reduce((s, p) => s + (p.pos === HOME ? 21 : distLeft(p.pos, this.prevOf(p))), 0) };
    });
    rows.sort((a, b) => (b.team === winTeam) - (a.team === winTeam) || b.finished - a.finished || a.left - b.left);
    rows.forEach((r, i) => (r.rank = i + 1));
    this.ranking = rows;
    this.emit("over", { winner: winTeam, ranking: rows });
  }

  // ---------------- 증강 사용 ----------------
  useAug(uid, id, pl = {}) {
    if (this.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
    if (!this.isTurn(uid)) return { ok: false, error: "NOT_YOUR_TURN" };
    const me = this.players.get(uid), c = this.cur;
    const a = me.augs.find(x => x.id === id), def = AUG[id];
    if (!a || !def) return { ok: false, error: "NO_AUG" };
    if (def.kind === "passive") return { ok: false, error: "PASSIVE" };
    if (a.charges !== null && a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
    if (c.choice) return { ok: false, error: "CHOOSE_FIRST" };
    const myPiece = () => { const p = this.pieces.find(x => x.id === pl.pieceId); return p && p.team === c.team && p.pos !== HOME && p.pos !== DONE && !this.groupBlocked(p) ? p : null; }; // 봉쇄된 무리는 증강으로도 못 옮김
    const oppPiece = (ignoreGuard) => { const p = this.pieces.find(x => x.id === pl.targetId); if (!p || p.team === c.team || p.pos === HOME || p.pos === DONE) return null; if (!ignoreGuard && (p.guard > 0)) return "GUARD"; return p; };
    let r = { ok: true };
    switch (id) {
      // ---- 켜 두기 ----
      case "split": case "invincibleMarch": case "pathWarp": {
        if (me.armed[id]) { me.armed[id] = false; return { ok: true, armed: false }; } // 다시 누르면 끔 (횟수 안 씀)
        if (id === "split" && !this.pieces.some(p => p.team === c.team && p.pos >= 0 && p.pos !== DONE && this.groupOf(p).length > 1)) return { ok: false, error: "NO_STACK" };
        me.armed[id] = true; this.emit("aug", { uid, id, armed: true });
        return { ok: true, armed: true }; // 횟수는 실제로 쓰일 때 깎임
      }
      case "fateChoice": case "legendYut": {
        if (c.phase !== "throw" || c.throws <= 0) return { ok: false, error: "NO_THROW" };
        if (me.armed[id]) { me.armed[id] = false; return { ok: true, armed: false }; }
        me.armed[id] = true; this.emit("aug", { uid, id, armed: true });
        return { ok: true, armed: true };
      }
      case "fateSteal": {
        if (me.armed.fateSteal) return { ok: false, error: "ALREADY_ARMED" };
        me.armed.fateSteal = true; this.emit("aug", { uid, id, armed: true });
        return { ok: true, armed: true };
      }
      // ---- 바로 쓰기 ----
      case "extraMove":
        c.throws++; c.phase = "throw"; c.snap = null; break;
      case "retry": {
        const i = Number.isInteger(pl.ri) ? pl.ri : c.pending.length - 1;
        const pr = c.pending[i];
        if (!pr || pr.src !== "throw") return { ok: false, error: "BAD_RESULT" };
        if (isBonus(pr.r)) return { ok: false, error: "NO_RETRY_BONUS" }; // 윷·모는 덤 던지기를 이미 받아서 다시 못 던짐
        c.pending.splice(i, 1); c.throws++; c.phase = "throw"; c.snap = null;
        break;
      }
      case "godHand": {
        const pr = c.pending[pl.ri];
        const v = Number(pl.value);
        if (!pr) return { ok: false, error: "BAD_RESULT" };
        if (![1, 2, 3, 4, 5, ...(this.backdo ? [-1] : [])].includes(v) || v === pr.r) return { ok: false, error: "BAD_VALUE" };
        r.from = pr.r; pr.r = v; pr.src = "god"; r.to = v; c.snap = null;
        break;
      }
      case "teleport": {
        const p = myPiece(); const k = Number(pl.steps);
        if (!p || !(k >= 1 && k <= 3)) return { ok: false, error: "BAD_TARGET" };
        const path = forwardPaths(p.pos, this.prevOf(p), k)[Number(pl.pathIdx) || 0] || forwardPaths(p.pos, this.prevOf(p), k)[0];
        this.relocate(me, this.groupOf(p), path.to, path.steps, false); c.snap = null;
        break;
      }
      case "dimension": {
        const p = myPiece(); if (!p) return { ok: false, error: "BAD_TARGET" };
        const k = Math.max(1, Math.ceil(distLeft(p.pos, this.prevOf(p)) * 2 / 3));
        const path = forwardPaths(p.pos, this.prevOf(p), k)[0];
        this.relocate(me, this.groupOf(p), path.to, path.steps, false); c.snap = null; r.steps = k;
        break;
      }
      case "spaceRule": {
        const p = myPiece(); const node = Number(pl.node);
        if (!p || ![5, 10, 15, 22].includes(node) || p.pos === node) return { ok: false, error: "BAD_TARGET" };
        const g = this.groupOf(p);
        for (const x of g) x.hist = node === 22 ? [21] : node === 5 ? [4] : node === 10 ? [9] : [14];
        this.relocate(me, g, node, [node], false);
        for (const x of g) if (x.pos === node) x.hist = node === 22 ? [5, 20, 21] : node === 5 ? [0, 1, 2, 3, 4] : node === 10 ? [5, 6, 7, 8, 9] : [10, 11, 12, 13, 14];
        c.snap = null;
        break;
      }
      case "swapPos": case "forceSwap": {
        const mp = myPiece(); const op = oppPiece(id === "forceSwap");
        if (!mp || !op) return { ok: false, error: "BAD_TARGET" };
        if (op === "GUARD") return { ok: false, error: "GUARDED" };
        if (op.shield > 0 && id === "swapPos") return { ok: false, error: "GUARDED" };
        if (id === "swapPos" && Math.abs(distLeft(mp.pos, this.prevOf(mp)) - distLeft(op.pos, this.prevOf(op))) > 6) return { ok: false, error: "TOO_FAR" };
        if (id === "forceSwap" && distLeft(op.pos, this.prevOf(op)) <= 4) return { ok: false, error: "TOO_CLOSE_TO_FINISH" };
        const g1 = this.groupOf(mp), g2 = this.groupOf(op);
        const s1 = { pos: mp.pos, hist: mp.hist.slice() }, s2 = { pos: op.pos, hist: op.hist.slice() };
        for (const x of g1) { x.pos = s2.pos; x.hist = s2.hist.slice(); }
        for (const x of g2) { x.pos = s1.pos; x.hist = s1.hist.slice(); }
        this.emit("swap", { uid, a: g1.map(x => x.id), b: g2.map(x => x.id), aTo: s2.pos, bTo: s1.pos });
        this.impact(me, id, Math.max(0, distLeft(s1.pos) - distLeft(s2.pos)));
        c.snap = null;
        break;
      }
      case "pushBack": {
        const op = oppPiece(false);
        if (!op) return { ok: false, error: "BAD_TARGET" };
        if (op === "GUARD") return { ok: false, error: "GUARDED" };
        const g = this.groupOf(op);
        let to = op.pos;
        for (let k = 0; k < 3; k++) { const h = g[0].hist; if (h.length) { to = h[h.length - 1]; for (const x of g) x.hist.pop(); } }
        for (const x of g) x.pos = to;
        this.emit("move", { uid, team: op.team, pieces: g.map(x => x.id), from: op.pos, to, steps: [to], back: true, captured: 0, blocked: 0, pushed: true });
        this.impact(me, "pushBack", 2); c.snap = null;
        break;
      }
      case "blockade": {
        const op = oppPiece(true);
        if (!op || op === "GUARD") return { ok: false, error: "BAD_TARGET" };
        for (const x of this.groupOf(op)) x.blocked = true;
        this.emit("fx", { kind: "block", piece: op.id });
        this.impact(me, "blockade", 3);
        break;
      }
      case "clone": {
        const p = myPiece(); if (!p || p.clone) return { ok: false, error: "BAD_TARGET" };
        if (this.pieces.some(x => x.team === c.team && x.clone)) return { ok: false, error: "ONE_CLONE" };
        const cl = newPiece(`t${c.team}c${++this.cloneSeq}`, c.team);
        cl.pos = p.pos; cl.hist = p.hist.slice(); cl.clone = true; cl.ttl = 6; // 만든 차례 + 다음 내 차례 5번
        this.pieces.push(cl);
        this.emit("fx", { kind: "clone", piece: cl.id, from: p.id, node: p.pos });
        c.snap = null;
        break;
      }
      case "groupMove": {
        const p1 = myPiece(); const p2 = this.pieces.find(x => x.id === pl.pieceId2);
        if (!p1 || !p2 || p2.team !== c.team || p2.pos === HOME || p2.pos === DONE || p1.pos === p2.pos) return { ok: false, error: "BAD_TARGET" };
        c.groupWith = p2.id;
        break;
      }
      case "reviveMarch": case "kingReturn": {
        const homeCaptured = this.pieces.filter(p => p.team === c.team && p.pos === HOME && p.wasCaptured && !p.clone);
        let list = homeCaptured;
        if (id === "reviveMarch") { const p = homeCaptured.find(x => x.id === pl.pieceId) || homeCaptured[0]; list = p ? [p] : []; }
        if (!list.length) return { ok: false, error: "NO_TARGET" };
        for (const p of list) { p.wasCaptured = false; p.hist = [0, 1, 2, 3]; p.pos = 4; } // 모 자리(5)로 — 4를 거쳐 온 것처럼
        this.relocate(me, list, 5, [5], false);
        this.impact(me, id, 6 * list.length); c.snap = null;
        break;
      }
      case "timeRewind": {
        if (!c.snap) return { ok: false, error: "NOTHING_TO_UNDO" };
        const s = c.snap; c.snap = null;
        this.pieces = s.pieces; c.pending = s.pending; c.throws = s.throws; c.moved = s.moved; me.luckyDo = s.luckyDo; me.capUsed = s.capUsed;
        me.armed = s.armed; c.groupWith = s.groupWith; c.revenge = s.revenge;
        // 증강 횟수는 되돌리되, 방금 쓴 시간 역행 1회는 아래에서 깎음
        for (const a of s.augs) { const cur = me.augs.find(x => x.id === a.id); if (cur && a.id !== "timeRewind") cur.charges = a.charges; }
        this.teams.forEach((t, i) => { t.defense = s.defense[i]; t.revenge = s.teamsRevenge[i]; });
        for (const [pid, st] of s.stats) { const p = this.players.get(pid); if (p) p.stats = st; }
        this.firstEntry = new Set(s.firstEntry);
        c.phase = c.throws > 0 ? "throw" : "move";
        this.emit("rewind", { uid });
        break;
      }
      default: return { ok: false, error: "NO_AUG" };
    }
    if (a.charges !== null) a.charges--;
    this.useCount(me, id, false);
    this.emit("aug", { uid, id, ...pickPublic(pl), ...r });
    if (this.phase === "play" && this.cur) {
      for (const t of this.teams) if (this.checkWinSilent(t.id)) { this.finish(t.id); return { ok: true, win: true }; }
      this.settle();
    }
    return r;
  }
  checkWinSilent(team) { const real = this.pieces.filter(p => p.team === team && !p.clone); return real.length && real.every(p => p.pos === DONE); }

  // ---------------- 도우미 ----------------
  isTurn(uid) { return this.phase === "play" && this.cur && this.cur.uid === uid; }
  hasAug(me, id) { return this.mode === "augment" && !!me?.augs.some(a => a.id === id); }
  teamHas(team, id) { if (this.mode !== "augment") return false; for (const p of this.players.values()) if (p.team === team && p.augs.some(a => a.id === id)) return true; return false; }
  capLeft(me, id, max) { return (me.capUsed[id] || 0) < max; }
  capUse(me, id) { me.capUsed[id] = (me.capUsed[id] || 0) + 1; }
  useCount(me, id, charge = true) {
    if (charge) { const a = me.augs.find(x => x.id === id); if (a && a.charges !== null) a.charges--; }
    me.stats.augUses[id] = (me.stats.augUses[id] || 0) + 1;
  }
  impact(me, id, v) { if (!me) return; me.stats.augImpact[id] = (me.stats.augImpact[id] || 0) + v; me.stats.augUses[id] = me.stats.augUses[id] || 0; }
  impactTeam(team, id, v) { for (const p of this.players.values()) if (p.team === team && p.augs.some(a => a.id === id)) return this.impact(p, id, v); }
  /** pc 뒤 1~k칸 안에 상대 말이 있나 (상대가 그 칸 수로 pc에 닿을 수 있나) */
  threatenedBy(pc, k) {
    for (const o of this.pieces) {
      if (o.team === pc.team || o.pos === DONE || o.pos === HOME) continue;
      for (let s = 1; s <= k; s++) if (forwardPaths(o.pos, this.prevOf(o), s).some(p => p.to === pc.pos)) return true;
    }
    return false;
  }
  /** pc 앞 1~k칸 안에 상대 말이 있나 */
  preyAhead(pc, k) {
    for (let s = 1; s <= k; s++) for (const p of forwardPaths(pc.pos, this.prevOf(pc), s)) if (this.pieces.some(o => o.team !== pc.team && o.pos === p.to && p.to !== DONE)) return true;
    return false;
  }
  teamLeft(team) { return this.pieces.filter(p => p.team === team && !p.clone).reduce((s, p) => s + (p.pos === HOME ? 21 : p.pos === DONE ? 0 : distLeft(p.pos, this.prevOf(p))), 0); }
  isBehind(team, by) { const mine = this.teamLeft(team); const best = Math.min(...this.teams.filter(t => t.id !== team).map(t => this.teamLeft(t.id))); return mine - best >= by; }
  emit(type, data) { this.events.push({ type, ...data }); if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---------------- 공개 상태 ----------------
  publicState(viewer = null) {
    const me = viewer ? this.players.get(viewer) : null;
    const c = this.cur;
    let moves = null;
    if (c && c.phase === "move" && viewer === c.uid) {
      const mp = this.players.get(c.uid);
      moves = c.pending.map((pr, ri) => ({ ri, r: pr.r, options: this.movesFor(c.team, pr.r, mp).map(m => ({ pieceId: m.pieceId, pathIdx: m.pathIdx, to: m.to, steps: m.steps, route: m.route, n: m.n, notes: m.notes })) }));
    }
    return {
      mode: this.mode, phase: this.phase, round: this.round, pickIdx: this.pickIdx, backdo: this.backdo, pieceCount: this.pieceCount, maxAugs: this.maxAugs, pickEvery: this.pickEvery,
      teams: this.teams.map(t => ({ id: t.id, members: t.members, defense: t.defense, reserve: t.reserve.length, left: this.teamLeft(t.id) })),
      pieces: this.pieces.map(p => ({ id: p.id, team: p.team, pos: p.pos, prev: this.prevOf(p), clone: !!p.clone, ttl: p.ttl || 0, shield: p.shield || 0, guard: p.guard || 0, blocked: !!p.blocked })),
      players: [...this.players.values()].map(p => ({ id: p.id, team: p.team, augs: p.augs.map(a => ({ id: a.id, charges: a.charges })), armed: Object.keys(p.armed).filter(k => p.armed[k] && (p.id === viewer || k !== "fateSteal")), picking: this.phase === "pick" && !p.picked, luckyDo: p.luckyDo, stats: { captures: p.stats.captures, yut: p.stats.yut, mo: p.stats.mo, finished: p.stats.finished } })),
      cur: c ? { uid: c.uid, team: c.team, phase: c.phase, throws: c.throws, pending: c.pending.map(x => ({ r: x.r, src: x.src })), choice: c.choice && viewer === c.uid ? c.choice.map(x => x.result) : (c.choice ? [] : null), canUndo: !!c.snap, groupWith: c.groupWith, revenge: c.revenge } : null,
      moves,
      offer: me && this.phase === "pick" && !me.picked ? me.offer : null,
      refresh: me ? me.refresh : 0,
      winner: this.winner, ranking: this.ranking,
    };
  }
  resultStats() {
    return [...this.players.values()].map(p => {
      let best = null;
      for (const [id, v] of Object.entries(p.stats.augImpact)) if (!best || v > best.v) best = { id, v };
      return { id: p.id, team: p.team, ...p.stats, augs: p.augs.map(a => a.id), mvpAug: best?.id || null };
    });
  }
}

function newPiece(id, team) { return { id, team, pos: HOME, hist: [], clone: false, ttl: 0, shield: 0, guard: 0, blocked: false, wasCaptured: false }; }
function pickPublic(pl) { const o = {}; for (const k of ["pieceId", "targetId", "pieceId2", "node", "steps", "ri", "value"]) if (pl[k] !== undefined) o[k] = pl[k]; return o; }
function bestOffer(offer) {
  const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
  return [...offer].sort((a, b) => ord[AUG[b].rarity] - ord[AUG[a].rarity])[0];
}
export { RES_LABEL };

// =========================
// AI — 봇·시간초과·끊긴 사람 대신 두기
// =========================
/** 상대가 다음 차례에 그 칸에 닿을 확률 대략 */
function danger(g, node, team) {
  if (node === DONE || node === HOME) return 0;
  let p = 0;
  for (const o of g.pieces) {
    if (o.team === team || o.pos === DONE) continue;
    for (let s = 1; s <= 5; s++) {
      const reach = o.pos === HOME ? (node === s) : forwardPaths(o.pos, g.prevOf(o), s).some(x => x.to === node);
      if (reach) p += P_RES[s];
    }
  }
  return Math.min(1, p);
}
export function aiChooseMove(g) {
  const c = g.cur; const me = g.players.get(c.uid);
  let best = null;
  const seenR = new Set();
  c.pending.forEach((pr, ri) => {
    if (seenR.has(pr.r)) return; seenR.add(pr.r);
    for (const m of g.movesFor(c.team, pr.r, me)) {
      const pc = g.pieces.find(p => p.id === m.pieceId);
      const group = g.groupOf(pc);
      const before = pc.pos === HOME ? 21 : distLeft(pc.pos, g.prevOf(pc));
      const after = m.to === DONE ? 0 : distLeft(m.to, m.steps.length > 1 ? m.steps[m.steps.length - 2] : pc.pos);
      let s = pc.clone ? 0 : (before - after) * 2; // 분신은 완주해도 소용없음 — 잡기에만 씀
      const victims = m.to === DONE ? [] : g.pieces.filter(o => o.team !== c.team && o.pos === m.to);
      if (victims.length && !victims.some(v => v.guard > 0 || v.shield > 0)) s += 55 + victims.length * 12 + victims.reduce((a, v) => a + (21 - distLeft(v.pos)), 0);
      if (m.to === DONE) s += pc.clone ? -5 : 40 * group.length;
      if (g.pieces.some(o => o.team === c.team && o.pos === m.to && !group.includes(o))) s += 6;
      if ([5, 10, 22].includes(m.to)) s += 10;
      const dNow = pc.pos === HOME ? 0 : danger(g, pc.pos, c.team);
      const dNew = danger(g, m.to, c.team);
      s += (dNow - dNew) * 26 * group.length * (pc.pos === HOME ? 0.3 : 1);
      if (pr.r === -1 && pc.pos !== HOME) s -= 3;
      if (!best || s > best.s) best = { s, ri, pieceId: m.pieceId, pathIdx: m.pathIdx };
    }
  });
  return best;
}
/** 봇이 쓸 증강 하나 고르기 (없으면 null) */
export function aiChooseAug(g) {
  if (g.mode !== "augment") return null;
  const c = g.cur; const me = g.players.get(c.uid);
  const has = (id) => { const a = me.augs.find(x => x.id === id); return a && (a.charges === null || a.charges > 0); };
  const mine = g.pieces.filter(p => p.team === c.team && p.pos >= 0 && p.pos !== DONE && !p.clone && !g.groupBlocked(p)); // 봉쇄된 무리는 대상에서 뺌
  const opp = g.pieces.filter(p => p.team !== c.team && p.pos >= 0 && p.pos !== DONE);
  const lead = (arr) => arr.slice().sort((a, b) => distLeft(a.pos, g.prevOf(a)) - distLeft(b.pos, g.prevOf(b)))[0];
  if (c.phase === "throw" && c.throws > 0 && !c.choice) {
    if (has("legendYut") && !me.armed.legendYut) return { id: "legendYut" };
    if (has("fateChoice") && !me.armed.fateChoice && !me.armed.legendYut && g.rng() < 0.6) return { id: "fateChoice" };
    if (has("fateSteal") && !me.armed.fateSteal) return { id: "fateSteal" };
    if (has("extraMove") && c.pending.length === 0 && g.rng() < 0.35) return { id: "extraMove" };
    const homeCap = g.pieces.filter(p => p.team === c.team && p.pos === HOME && p.wasCaptured);
    if (has("kingReturn") && homeCap.length >= 2) return { id: "kingReturn" };
    if (has("reviveMarch") && homeCap.length >= 1) return { id: "reviveMarch", pieceId: homeCap[0].id };
    if (has("blockade") && opp.length && g.rng() < 0.5) { const t = lead(opp); if (t && distLeft(t.pos, g.prevOf(t)) <= 8) return { id: "blockade", targetId: t.id }; }
    if (has("pushBack") && opp.length) { const t = lead(opp); if (t && !(t.guard > 0) && distLeft(t.pos, g.prevOf(t)) <= 10) return { id: "pushBack", targetId: t.id }; }
    if (has("forceSwap") && mine.length && opp.length) { const t = lead(opp), m = mine.slice().sort((a, b) => distLeft(b.pos) - distLeft(a.pos))[0]; if (distLeft(t.pos, g.prevOf(t)) > 4 && distLeft(m.pos, g.prevOf(m)) - distLeft(t.pos, g.prevOf(t)) >= 8) return { id: "forceSwap", pieceId: m.id, targetId: t.id }; }
    if (has("swapPos") && mine.length && opp.length) { for (const m of mine) for (const t of opp) { const d = distLeft(m.pos, g.prevOf(m)) - distLeft(t.pos, g.prevOf(t)); if (d >= 3 && d <= 6 && !(t.guard > 0) && !(t.shield > 0)) return { id: "swapPos", pieceId: m.id, targetId: t.id }; } }
    if (has("dimension") && mine.length) { const m = mine.slice().sort((a, b) => distLeft(b.pos) - distLeft(a.pos))[0]; if (distLeft(m.pos, g.prevOf(m)) >= 10) return { id: "dimension", pieceId: m.id }; }
    if (has("spaceRule") && mine.length) { const m = mine.find(p => distLeft(p.pos, g.prevOf(p)) > 8); if (m) return { id: "spaceRule", pieceId: m.id, node: 22 }; }
    if (has("clone") && mine.length && !g.pieces.some(p => p.team === c.team && p.clone)) return { id: "clone", pieceId: lead(mine).id };
    if (has("teleport") && mine.length) {
      for (const m of mine) for (let k = 1; k <= 3; k++) { const p = forwardPaths(m.pos, g.prevOf(m), k)[0]; if (p && p.to !== DONE && g.pieces.some(o => o.team !== c.team && o.pos === p.to && !(o.guard > 0) && !(o.shield > 0))) return { id: "teleport", pieceId: m.id, steps: k }; }
    }
  }
  if (c.phase === "move" && c.pending.length) {
    // 신의 손: 바꾸면 잡거나 완주할 수 있으면
    if (has("godHand")) {
      for (let ri = 0; ri < c.pending.length; ri++) for (const v of [5, 4, 3, 2, 1]) {
        if (v === c.pending[ri].r) continue;
        for (const m of g.movesFor(c.team, v, me)) {
          const cap = m.to !== DONE && g.pieces.some(o => o.team !== c.team && o.pos === m.to && !(o.guard > 0) && !(o.shield > 0));
          if (cap || m.to === DONE) return { id: "godHand", ri, value: v };
        }
      }
    }
    if (has("retry")) { const i = c.pending.findIndex(p => p.src === "throw" && (p.r === 1 || p.r === -1)); if (i >= 0 && g.rng() < 0.7) return { id: "retry", ri: i }; }
    if (has("invincibleMarch") && !me.armed.invincibleMarch) { const b = aiChooseMove(g); if (b) { const m = g.movesFor(c.team, c.pending[b.ri].r, me).find(x => x.pieceId === b.pieceId && x.pathIdx === b.pathIdx); if (m && danger(g, m.to, c.team) > 0.35) return { id: "invincibleMarch" }; } }
    if (has("groupMove") && !c.groupWith) { const groups = [...new Set(mine.map(p => p.pos))]; if (groups.length >= 2) { const a = mine.find(p => p.pos === groups[0]), b = mine.find(p => p.pos === groups[1]); return { id: "groupMove", pieceId: a.id, pieceId2: b.id }; } }
  }
  return null;
}

/** 운명의 선택: 두 결과 중 고르기 (윷·모 > 걸 > 개 > 도 > 빽도) */
export function aiChooseChoice(g) {
  const c = g.cur; if (!c?.choice) return 0;
  const val = (r) => (r === 5 ? 6 : r === 4 ? 5 : r === -1 ? 0 : r);
  return val(c.choice[1].result) > val(c.choice[0].result) ? 1 : 0;
}
