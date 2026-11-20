// =========================
// DUO 증강 서바이벌 아레나 — 서버 시뮬레이션 (2026-11-20)
// · World 하나 = 아레나 하나 (협동: 방 전체 1개 · 개인전: 사람마다 1개(같은 웨이브 시드) · 팀전: 팀마다 1개 · PvP: 1개)
// · 모든 판정(이동·충돌·공격·피해·체력·경험치·레벨·증강·진화·보스·부활·승패)은 여기서. 화면은 입력만 보냄
// · 20Hz 고정 틱, 공간 분할 격자(GRID)로 충돌 후보만 검사, 몬스터·투사체는 배열 재사용(풀)
// · 피해 순서: 기본 피해 → 공격력 → 스킬 배율 → 치명타 → 방어력 → 피해 감소 → 취약(감전·저주) → 최종 (최소 1)
// =========================
import { M, TICK, MAP, MAX_AUGS, MAX_WEAPONS, MAX_PASSIVE_LV, MAX_WEAPON_LV, MAX_LEGEND, CAP, DIFF, partyScale, STATUS, CHARS, CHAR_IDS, PASSIVES, PASSIVE_IDS,
  WEAPONS, WEAPON_IDS, EVOS, EVO_RESONANCE, MONSTERS, MON_IDS, BOSSES, BOSS_IDS, BOSS_TIER, AUGS, AUG, SYNERGIES, RARITY_W, AUG_TIMES, BOSS_TIMES, XP_CURVE } from "./sva-data.js";

export const AP_BASE = 40;            // '공격력의 100%' = 40 × 공격력 배율
const GRID = 96, GW = Math.ceil(MAP.w / GRID), GH = Math.ceil(MAP.h / GRID);
const VIEW = { hw: 900, hh: 620 };    // 관심 영역 (이 안의 것만 그 사람에게 보냄)
const MON_TYPE = Object.fromEntries(MON_IDS.map((k, i) => [k, i]));
const BOSS_TYPE = Object.fromEntries(BOSS_IDS.map((k, i) => [k, 20 + i]));
const WEAP_TYPE = Object.fromEntries([...WEAPON_IDS, ...Object.keys(EVOS)].map((k, i) => [k, i]));
export const TYPE_TABLES = { MON_TYPE, BOSS_TYPE, WEAP_TYPE };
const ESHOT_KIND = { bone: 1, web: 2, curse: 3, laser: 4, boss: 5, fire: 6, ice: 7, talisman: 8, bolt: 9, slime: 10 };
export const ESHOT_KINDS = ESHOT_KIND;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TAU = 2 * Math.PI;
const angDiff = (a, b) => { const d = a - b; if (d >= -Math.PI && d <= Math.PI) return d; return ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI; }; // 반복 없이 (아주 큰 값에도 안 멈춤)
// 선분(ax,ay→bx,by)과 원(cx,cy,r) 충돌 (빠른 투사체가 건너뛰지 않게)
function segHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - cx, py = ay + dy * t - cy; return px * px + py * py <= r * r;
}

export class World {
  /**
   * o = { seed, kind:'coop'|'versus'|'team'|'pvp', aug, diff, len(초), players:[{id,name,char}], bosses:[3개 id], out(ev, data, to?), party(인원 보정용 수), solo }
   */
  constructor(o) {
    this.o = o; this.kind = o.kind || "coop"; this.aug = !!o.aug; this.D = Object.prototype.hasOwnProperty.call(DIFF, o.diff) ? DIFF[o.diff] : DIFF.normal; this.len = o.len || 900;
    this.ts = 900 / this.len;            // 게임 길이가 짧으면 진행을 비율로 빠르게
    this.rng = mulberry((o.seed ^ 0x9e3779b9) >>> 0); this.wrng = mulberry(o.seed >>> 0); // wrng: 웨이브(개인전 모두 같음)
    this.out = o.out || (() => {}); this.t = 0; this.tick = 0; this.status = "play"; this.paused = false; this.result = null;
    this.P = new Map(); this.order = [];
    this.mons = []; this.shots = []; this.eshots = []; this.haz = []; this.gems = []; this.items = []; this.ents = []; // ents: 포탑·분신·덫 등
    this.monSeq = 1; this.hazSeq = 1; this.itemSeq = 1; this.entSeq = 1;
    this.grid = new Array(GW * GH); for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    this.ev = []; this.gev = [];          // ev: 위치 있는 화면 효과 · gev: 모두에게
    this.spawnAcc = 0; this.bossPlan = o.bosses || [BOSS_TIER[1][0], BOSS_TIER[2][0], BOSS_TIER[3][0]]; this.bossIdx = 0; this.boss = null; this.bossesKilled = 0;
    this.augAt = AUG_TIMES.map(x => x / this.ts); this.augNext = 1; this.bossAt = BOSS_TIMES.map(x => x / this.ts);
    this.teamGauge = 0; this.miracleUsed = false; this.monBuff = 0; this.darkUntil = 0; this.invaders = 0; this.donorElites = 0;
    this.stats = { kills: 0, maxMons: 0 };
    this.obs = this.makeObstacles(); this.walls = []; // walls: 보스가 만든 임시 벽 (얼음 벽)
    const n = o.party || o.players.length; this.party = partyScale(this.kind === "versus" ? 1 : n);
    o.players.forEach((p, i) => this.addPlayer(p, i, false));
    if (this.aug) for (const P of this.P.values()) this.offerAug(P, true); // 모두 들어온 뒤에 (여럿인지 알고) 시작 증강
  }
  // ---------- 맵 ----------
  makeObstacles() {
    const r = mulberry((this.o.seed * 7 + 13) >>> 0), list = [], cx = MAP.w / 2, cy = MAP.h / 2;
    for (let i = 0; i < 46 && list.length < 34; i++) {
      const x = 160 + r() * (MAP.w - 320), y = 160 + r() * (MAP.h - 320), rad = 26 + r() * 40;
      if (d2(x, y, cx, cy) < 420 * 420) continue;
      if (list.some(o => d2(o.x, o.y, x, y) < (o.r + rad + 120) ** 2)) continue;
      list.push({ x: Math.round(x), y: Math.round(y), r: Math.round(rad), k: Math.floor(r() * 4) }); // k: 바위·기둥·나무·수정
    }
    return list;
  }
  pushOut(e, rr) {
    const R = rr ?? e.r;
    e.x = clamp(e.x, R, MAP.w - R); e.y = clamp(e.y, R, MAP.h - R);
    for (const list of [this.obs, this.walls]) for (const o of list) {
      const dx = e.x - o.x, dy = e.y - o.y, min = o.r + R, dd = dx * dx + dy * dy;
      if (dd < min * min) { const d = Math.sqrt(dd) || 0.01; e.x = o.x + dx / d * min; e.y = o.y + dy / d * min; }
    }
  }
  freeSpot(x, y, r = 20) { const e = { x, y, r }; for (let k = 0; k < 3; k++) this.pushOut(e); return e; }
  // ---------- 플레이어 ----------
  addPlayer(p, i, offer = true) {
    const okC = Object.prototype.hasOwnProperty.call(CHARS, p.char), C = okC ? CHARS[p.char] : CHARS.warrior, a = (i / Math.max(1, this.o.players.length)) * Math.PI * 2;
    const P = {
      id: p.id, idx: p.idx ?? i, name: p.name, char: okC ? p.char : "warrior", team: p.team ?? 0, x: MAP.w / 2 + Math.cos(a) * 70, y: MAP.h / 2 + Math.sin(a) * 70, r: 14,
      hp: C.hp, maxHp: C.hp, shield: 0, state: "alive", downT: 0, revProg: 0, revives: 0, lvl: 1, xp: 0, xpNext: XP_CURVE(1),
      weapons: [{ id: C.weapon, lv: 1, evo: null, t: 0.4, hits: new Map(), ang: 0 }], passives: {}, augs: [], syn: new Set(), evoTokens: 0,
      in: { mx: 0, my: 0, aim: 0, auto: true, seq: 0, btn: 0 }, aim: 0, kb: { x: 0, y: 0 },
      dashCd: 0, dashT: 0, dashDir: { x: 1, y: 0 }, iframes: 0, qCd: 2, eCd: 2, st: {}, imm: {}, buffs: {}, at: {}, flags: {},
      hist: [], histT: 0, kills: 0, dmg: 0, bossDmg: 0, taken: 0, healed: 0, score: 0, revivedOthers: 0, aliveT: 0, falls: 0, eliteKills: 0,
      pend: [], pendSeq: 1, lsWin: 0, lsAmt: 0, thornWin: 0, thornN: 0, hitCount: 0, bot: !!p.bot, contact: new Map(), hud: "", stats: null, lastMove: 0,
    };
    this.P.set(P.id, P); this.order.push(P.id); this.pushOut(P); this.recalc(P);
    P.hp = P.maxHp;
    if (this.aug && offer) this.offerAug(P, true);
    return P;
  }
  alivePlayers() { const a = []; for (const P of this.P.values()) if (P.state === "alive") a.push(P); return a; }
  recalc(P) {
    const C = CHARS[P.char], pv = (k) => P.passives[k] || 0, has = (id) => P.augs.includes(id), b = P.buffs, t = this.t;
    const on = (k) => b[k] && b[k] > t;
    const hpPct = P.hp / Math.max(1, P.maxHp);
    const berserk = has("a26") && hpPct <= (P.syn.has("s4") ? 0.5 : AUG.a26.v.th) && P.state === "alive";
    P.flags.berserk = berserk;
    let atk = 1 + pv("might") * 0.10 + (has("a40") ? AUG.a40.v.atk : 0) + (on("golden") ? AUG.a33.v.atk : 0) + (on("fate") ? AUG.a37.v.atk : 0) + (berserk ? AUG.a26.v.atk : 0) + (on("sbuff") ? 0.3 : 0) + (on("team") ? 0.2 : 0);
    let aspd = 1 + pv("agi") * 0.08 + (has("a40") ? AUG.a40.v.aspd : 0) + (berserk ? AUG.a26.v.aspd : 0) + (on("sbuff") ? 0.15 : 0);
    let spdM = 1 + pv("boots") * 0.06 + (has("a02") ? AUG.a02.v.spd : 0) + (has("a40") ? AUG.a40.v.spd : 0) + (has("a10") && hpPct <= AUG.a10.v.th ? AUG.a10.v.spd : 0) + (on("golden") ? AUG.a33.v.spd : 0) + (on("smoke") ? 0.25 : 0) + (on("sbuff") ? 0.1 : 0);
    let dr = (has("a03") ? AUG.a03.v.dr : 0) + (has("a40") ? AUG.a40.v.dr : 0) + (on("roar") ? 0.3 : 0) + (on("holy") ? AUG.a28.v.dr : 0) + (on("fate") ? AUG.a37.v.dr : 0) + (on("sanct") ? 0.15 : 0) + (on("team") ? 0.2 : 0);
    const maxHp = C.hp + pv("vit") * 20 + (has("a05") ? AUG.a05.v.hp : 0);
    if (maxHp !== P.maxHp) { P.maxHp = maxHp; P.hp = Math.min(P.hp, maxHp); }
    const slow = P.st.slow ? P.st.slow.v : 0, frozen = P.st.freeze || P.st.stun;
    P.stats = {
      atk: Math.min(CAP.atk, atk), aspd: Math.min(CAP.aspd, aspd), cdMul: (has("a04") ? 1 - AUG.a04.v.cd : 1),
      spd: frozen ? 0 : Math.min(CAP.speed, C.speed * spdM * (1 - slow)), def: C.def + pv("armor") * 3, dr: Math.min(CAP.dr, dr),
      crit: Math.min(CAP.crit, C.crit + pv("luck") * 0.04 + (has("a06") ? AUG.a06.v.crit : 0)), critDmg: 1.5 + (C.critDmg || 0),
      area: Math.min(CAP.area, (C.area || 1) + pv("area") * 0.08 + (has("a08") ? AUG.a08.v.area : 0)),
      pickup: 72 * (1 + pv("magnet") * 0.3), regen: (C.regen || 0) + pv("regen") * 0.6, xp: (1 + pv("wis") * 0.1 + (has("a07") ? AUG.a07.v.xp : 0)) * this.D.xp,
      pierce: (has("a16") ? AUG.a16.v.pierce : 0) + (P.syn.has("s10") ? 1 : 0), proj: on("overload") ? AUG.a30.v.extra : 0, ovArea: on("overload") ? AUG.a30.v.area : 0,
      summon: P.char === "engineer" ? 1.15 : 1,
    };
    P.ap = AP_BASE * P.stats.atk;
  }
  // ---------- 입력 ----------
  input(pid, d) {
    const P = this.P.get(pid); if (!P) return false;
    const seq = d.s | 0; if (seq <= P.in.seq && P.in.seq - seq < 1e6) return false; // 같은/옛 입력 무시 (중복 방지)
    let mx = Number(d.mx), my = Number(d.my); if (!Number.isFinite(mx)) mx = 0; if (!Number.isFinite(my)) my = 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } // 무한대·글자 숫자("1e400")로 위치가 NaN 되지 않게 · // 이동 벡터는 길이 1까지만 (속도 조작 불가)
    P.in.mx = mx; P.in.my = my; P.in.seq = seq;
    if (Number.isFinite(d.a)) P.in.aim = clamp(d.a, -7, 7);
    P.in.auto = !!d.au;
    P.in.btn |= (d.b | 0) & 31;        // 1 대시 · 2 Q · 4 E · 8 합동기 · 16 방해(팀전)
    return true;
  }
  // ---------- 틱 ----------
  step() {
    if (this.status !== "play") return;
    this.ev.length = 0; this.gev.length = 0;
    if (this.paused) { this.checkPicks(); return; }
    const dt = TICK; this.t += dt; this.tick++;
    if (this.walls.length) { const n = this.walls.length; this.walls = this.walls.filter(x => x.until > this.t); if (this.walls.length !== n) this.gev.push({ k: "walls", w: this.walls.map(w => [Math.round(w.x), Math.round(w.y), w.r]) }); } // 얼음 벽 만료
    this.buildGrid();
    for (const P of this.P.values()) this.updPlayer(P, dt);
    this.director(dt);
    this.updMons(dt);
    if (this.boss) this.updBoss(dt);
    this.updShots(dt); this.updEShots(dt); this.updHaz(dt); this.updEnts(dt); this.updGems(dt);
    this.checkPicks(); this.checkEnd();
    if (this.mons.length > this.stats.maxMons) this.stats.maxMons = this.mons.length;
  }
  buildGrid() {
    const g = this.grid; for (let i = 0; i < g.length; i++) if (g[i].length) g[i].length = 0;
    for (const m of this.mons) { const cx = clamp((m.x / GRID) | 0, 0, GW - 1), cy = clamp((m.y / GRID) | 0, 0, GH - 1); g[cy * GW + cx].push(m); }
  }
  // (x,y) 반경 r 안 몬스터마다 fn — 격자 칸만 확인 (반환값 true면 멈춤)
  near(x, y, r, fn) {
    const x0 = clamp(((x - r) / GRID) | 0, 0, GW - 1), x1 = clamp(((x + r) / GRID) | 0, 0, GW - 1), y0 = clamp(((y - r) / GRID) | 0, 0, GH - 1), y1 = clamp(((y + r) / GRID) | 0, 0, GH - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const cell = this.grid[cy * GW + cx]; for (let i = 0; i < cell.length; i++) { const m = cell[i]; if (m.hp <= 0) continue; const rr = r + m.r; if (d2(x, y, m.x, m.y) <= rr * rr) { if (fn(m) === true) return; } } }
  }
  nearest(x, y, r, skip) { let best = null, bd = Infinity; this.near(x, y, r, (m) => { if (m.decoy && m.untarget) return; if (skip && skip.has(m.id)) return; const d = d2(x, y, m.x, m.y); if (d < bd) { bd = d; best = m; } }); return best; }
  nearestN(x, y, r, n, skip) { const arr = []; this.near(x, y, r, (m) => { if (skip && skip.has(m.id)) return; arr.push([d2(x, y, m.x, m.y), m]); }); arr.sort((a, b) => a[0] - b[0]); return arr.slice(0, n).map(a => a[1]); }
  // ---------- 플레이어 업데이트 ----------
  updPlayer(P, dt) {
    if (P.state === "dead") return;
    if (P.state === "down") {
      P.downT -= dt;
      // 근처 아군이 서 있으면 부활 진행 (2.5초)
      let helper = null; for (const Q of this.P.values()) if (Q !== P && Q.state === "alive" && d2(P.x, P.y, Q.x, Q.y) < 72 * 72) { helper = Q; break; }
      if (helper) { P.revProg += dt / 2.5; if (P.revProg >= 1) { this.revive(P, 0.4, helper); return; } } else P.revProg = Math.max(0, P.revProg - dt * 0.25);
      if (P.downT <= 0) { P.state = "dead"; this.ev.push({ k: "dead", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: "pdead", i: P.idx }); }
      return;
    }
    P.aliveT += dt;
    if (P.bot) this.botInput(P);
    const st = P.st, t = this.t;
    // 상태 이상
    for (const k in st) { const s = st[k]; s.t -= dt; if (s.dot) { s.acc = (s.acc || 0) + dt; if (s.acc >= 0.5) { s.acc -= 0.5; this.hurtPlayer(P, s.dot * 0.5 * (s.n || 1), { k: "dot", st: k, noReact: true }); if (P.state !== "alive") return; } } if (s.t <= 0) { delete st[k]; if (STATUS[k]?.immune) P.imm[k] = t + STATUS[k].immune; } }
    // 버프 끝·조건 → 능력치 다시 계산 (매 틱 계산해도 8명이라 가벼움)
    this.recalc(P);
    const S = P.stats;
    if (S.regen > 0 && P.hp < P.maxHp) this.heal(P, S.regen * dt, true);
    if (P.iframes > 0) P.iframes -= dt; if (P.dashCd > 0) P.dashCd -= dt; if (P.qCd > 0) P.qCd -= dt; if (P.eCd > 0) P.eCd -= dt;
    // 3초 전 상태 기록 (시간 역행)
    P.histT += dt; if (P.histT >= 0.25) { P.histT = 0; P.hist.push({ t, x: P.x, y: P.y, hp: P.hp }); if (P.hist.length > 20) P.hist.shift(); }
    // 조준
    const inp = P.in; let aim = inp.aim;
    if (inp.auto || P.bot) { const m = this.nearest(P.x, P.y, 520); if (m) aim = Math.atan2(m.y - P.y, m.x - P.x); else if (inp.mx || inp.my) aim = Math.atan2(inp.my, inp.mx); else aim = P.aim; }
    P.aim = aim;
    // 버튼 (한 번 누른 것만, 틱마다 소비)
    const btn = inp.btn; inp.btn = 0;
    const stunned = !!(st.stun || st.freeze);
    if (!stunned) {
      if (btn & 1) this.dash(P);
      if (btn & 2) this.skill(P, "q");
      if (btn & 4) this.skill(P, "e");
      if (btn & 8) this.teamSkill(P);
      if (btn & 16) this.o.onSabotage?.(P);
    }
    // 이동 (서버가 계산: 입력은 방향뿐 → 순간이동·속도 조작 불가)
    let vx, vy;
    if (P.dashT > 0) { P.dashT -= dt; const sp = 760; vx = P.dashDir.x * sp; vy = P.dashDir.y * sp; if (P.dashT <= 0) this.dashEnd(P); }
    else { vx = inp.mx * S.spd; vy = inp.my * S.spd; }
    vx += P.kb.x; vy += P.kb.y; P.kb.x *= 0.7; P.kb.y *= 0.7;
    // 블랙홀 등 끌림
    if (P.pull) { vx += P.pull.x; vy += P.pull.y; P.pull = null; }
    P.x += vx * dt; P.y += vy * dt; this.pushOut(P);
    if (vx || vy) P.lastMove = t;
    // 무기
    if (!stunned) for (const w of P.weapons) this.updWeapon(P, w, dt);
    if (this.aug) this.updAugs(P, dt);
    // 줍기
    const pr = S.pickup;
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; if (d2(P.x, P.y, it.x, it.y) < (pr * 0.6 + 16) ** 2) { this.items.splice(i, 1); this.useItem(P, it); } }
  }
  botInput(P) {
    // 자리 비움·시험용 자동 조종: 가까운 적은 피하고(140 안), 조금 먼 적 무리 주위를 빙 돌며 싸움, 장판 피하기, 보석 줍기, 맵 가운데 쪽 선호
    let fx = 0, fy = 0, cx = 0, cy = 0, cn = 0, close = 0; const melee = ["sword", "dagger", "axe", "holy"].includes(P.weapons[0]?.id);
    const keep = P.weapons[0]?.id === "dagger" ? 55 : melee ? 85 : 160;
    this.near(P.x, P.y, 420, (m) => { const dx = P.x - m.x, dy = P.y - m.y, d = Math.hypot(dx, dy) || 1, w = m.boss ? 3 : m.elite ? 2 : 1;
      if (d < keep + m.r) { fx += dx / d * w * (keep + m.r - d) / keep * 3; fy += dy / d * w * (keep + m.r - d) / keep * 3; close++; }
      cx += m.x; cy += m.y; cn++; });
    if (cn) { cx /= cn; cy /= cn; const dx = cx - P.x, dy = cy - P.y, d = Math.hypot(dx, dy) || 1, s = P.idx % 2 ? 1 : -1; fx += -dy / d * s * 0.9; fy += dx / d * s * 0.9; if (!close) { fx += dx / d * 0.5; fy += dy / d * 0.5; } }
    for (const h of this.haz) if (!h.friendly && h.r && d2(P.x, P.y, h.x, h.y) < (h.r + 50) ** 2) { const dx = P.x - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy) || 1; fx += dx / d * 4; fy += dy / d * 4; }
    for (const s of this.eshots) if (d2(P.x, P.y, s.x, s.y) < 120 * 120) { const l = Math.hypot(s.vx, s.vy) || 1; fx += -s.vy / l * 1.2; fy += s.vx / l * 1.2; }
    let g = null, gd = 300 * 300; for (const gm of this.gems) { const dd = d2(P.x, P.y, gm.x, gm.y); if (dd < gd) { gd = dd; g = gm; } }
    if (g && close < 3) { const dx = g.x - P.x, dy = g.y - P.y, d = Math.hypot(dx, dy) || 1; fx += dx / d * 0.8; fy += dy / d * 0.8; }
    const ox = MAP.w / 2 - P.x, oy = MAP.h / 2 - P.y, od = Math.hypot(ox, oy); if (od > 700) { fx += ox / od * (od - 700) / 300; fy += oy / od * (od - 700) / 300; }
    if (Math.hypot(fx, fy) < 0.15) { fx = Math.cos(this.t * 0.5 + P.idx); fy = Math.sin(this.t * 0.5 + P.idx); }
    const l = Math.hypot(fx, fy) || 1; P.in.mx = fx / l; P.in.my = fy / l; P.in.auto = true;
    if (P.bot === "smart") { // 시험용: 스킬·대시도 씀
      if (P.qCd <= 0 && this.mons.length && close) P.in.btn |= 2; if (P.eCd <= 0 && (P.hp < P.maxHp * 0.6 || close > 4)) P.in.btn |= 4;
      if (P.dashCd <= 0 && (P.hp < P.maxHp * 0.5 || close > 5)) P.in.btn |= 1; if (this.teamGauge >= this.teamMax()) P.in.btn |= 8;
    }
    if (P.bot === "idle") { P.in.mx = 0; P.in.my = 0; }
  }
  dash(P) {
    if (P.dashCd > 0 || P.dashT > 0) return;
    let dx = P.in.mx, dy = P.in.my; if (!dx && !dy) { dx = Math.cos(P.aim); dy = Math.sin(P.aim); }
    const l = Math.hypot(dx, dy) || 1; P.dashDir = { x: dx / l, y: dy / l }; P.dashT = 0.2; P.iframes = Math.max(P.iframes, 0.28);
    const golden = P.syn.has("s11") && P.buffs.golden > this.t;
    P.dashCd = golden ? 1.5 : 3;
    this.ev.push({ k: "dash", i: P.idx, x: P.x, y: P.y });
  }
  dashEnd(P) {
    if (!this.aug || !P.augs.includes("a17")) return;
    if ((P.at.a17 || 0) > this.t) return; P.at.a17 = this.t + AUG.a17.v.cd;
    const mult = P.syn.has("s11") && P.buffs.golden > this.t ? 2 : AUG.a17.v.mult;
    this.aoe(P, P.x, P.y, AUG.a17.v.rad, P.ap * mult, { kind: "proc" }); this.ev.push({ k: "boom", x: P.x, y: P.y, r: AUG.a17.v.rad, c: 1 });
  }
  // ---------- 액티브 스킬 ----------
  skill(P, which) {
    const C = CHARS[P.char], sk = C[which]; if (!sk) return;
    if (which === "q" ? P.qCd > 0 : P.eCd > 0) return;
    if (which === "q") P.qCd = sk.cd; else P.eCd = sk.cd;
    const t = this.t, ap = P.ap, ca = Math.cos(P.aim), sa = Math.sin(P.aim), all = this.alivePlayers().filter(Q => this.ally(P, Q));
    switch (sk.id) {
      case "bash": { P.dashDir = { x: ca, y: sa }; P.dashT = 0.22; P.iframes = Math.max(P.iframes, 0.35); const x0 = P.x, y0 = P.y, x1 = P.x + ca * 170, y1 = P.y + sa * 170;
        this.near((x0 + x1) / 2, (y0 + y1) / 2, 130, (m) => { if (segHit(x0, y0, x1, y1, m.x, m.y, m.r + 34)) { this.hitMon(P, m, ap * 2.0, { kind: "proc", kb: 120, kbx: ca, kby: sa }); this.applySt(m, "stun", { t: 0.6 }); } }); break; }
      case "roar": P.buffs.roar = t + 6; this.near(P.x, P.y, 170, (m) => { this.applySt(m, "slow", { v: 0.4, t: 2 }); }); break;
      case "volley": for (let i = -4; i <= 4; i++) this.fireShot(P, { w: "bow", x: P.x, y: P.y, a: P.aim + i * 0.09, spd: 640, dmg: ap * 1.2, pierce: 1, r: 7, life: 0.9, kind: "proc" }); break;
      case "trap": this.ents.push({ id: this.entSeq++, k: "trap", x: P.x, y: P.y, r: 42, owner: P.id, until: t + 15, armed: t + 0.4 }); break;
      case "nova": this.aoe(P, P.x, P.y, 150 * P.stats.area, ap * 3, { kind: "proc", st: "burn" }); this.ev.push({ k: "boom", x: P.x, y: P.y, r: 150 * P.stats.area, c: 2 }); break;
      case "blink": { let dx = P.in.mx, dy = P.in.my; if (!dx && !dy) { dx = ca; dy = sa; } const l = Math.hypot(dx, dy) || 1; const fx = P.x, fy = P.y; P.x += dx / l * 175; P.y += dy / l * 175; this.pushOut(P); P.iframes = Math.max(P.iframes, 0.3); this.ev.push({ k: "blink", i: P.idx, x: fx, y: fy, x2: P.x, y2: P.y }); break; }
      case "shadowstab": { let best = null, bh = -1; this.near(P.x, P.y, 330, (m) => { if (m.maxHp > bh && !m.untarget) { bh = m.maxHp; best = m; } });
        if (!best) { P.qCd = 1; break; } const a = Math.atan2(best.y - P.y, best.x - P.x), fx = P.x, fy = P.y; P.x = best.x + Math.cos(a) * (best.r + 18); P.y = best.y + Math.sin(a) * (best.r + 18); this.pushOut(P); P.iframes = Math.max(P.iframes, 0.3);
        this.hitMon(P, best, ap * 4, { kind: "proc", forceCrit: false }); this.applySt(best, "bleed", { t: 4, n: 3, pow: ap }); this.ev.push({ k: "blink", i: P.idx, x: fx, y: fy, x2: P.x, y2: P.y }); break; }
      case "smoke": P.buffs.smoke = t + 3; this.ev.push({ k: "smoke", x: P.x, y: P.y }); break;
      case "turret": { const mine = this.ents.filter(e => e.k === "turret" && e.owner === P.id); if (mine.length >= 2) mine[0].until = 0; this.ents.push({ id: this.entSeq++, k: "turret", x: P.x + ca * 30, y: P.y + sa * 30, owner: P.id, until: t + 12, cd: 0 }); break; }
      case "repair": P.buffs.repair = t + 3; this.addShield(P, P.maxHp * 0.1); break;
      case "heal": for (const Q of this.P.values()) { if (!this.ally(P, Q) || d2(P.x, P.y, Q.x, Q.y) > 210 * 210) continue; if (Q.state === "alive") this.heal(Q, Q.maxHp * 0.2); else if (Q.state === "down") { Q.revProg += 0.5; if (Q.revProg >= 1) this.revive(Q, 0.4, P); } } this.ev.push({ k: "heal", x: P.x, y: P.y, r: 210 }); break;
      case "aegis": for (const Q of all) if (d2(P.x, P.y, Q.x, Q.y) < 230 * 230) this.addShield(Q, Q.maxHp * 0.15); this.ev.push({ k: "aegis", x: P.x, y: P.y, r: 230 }); break;
    }
    this.ev.push({ k: "skill", i: P.idx, s: sk.id, x: P.x, y: P.y, a: +P.aim.toFixed(2) });
  }
  ally(P, Q) { return this.kind === "pvp" ? P === Q : P.team === Q.team; }
  teamMax() { return Math.round(120 + 30 * Math.max(0, this.P.size - 2)); }
  teamSkill(P) {
    if (this.P.size < 2 || this.kind === "versus" || this.kind === "pvp") return;
    if (this.teamGauge < this.teamMax()) return; this.teamGauge = 0;
    for (const Q of this.alivePlayers()) { this.aoe(Q, Q.x, Q.y, 5 * M, Q.ap * 5, { kind: "proc", bossCap: 0.05 }); this.heal(Q, Q.maxHp * 0.2); Q.buffs.team = this.t + 4; this.ev.push({ k: "boom", x: Q.x, y: Q.y, r: 5 * M, c: 3 }); }
    this.gev.push({ k: "teamskill", i: P.idx });
  }
  // ---------- 무기 ----------
  wstat(w) { const W = WEAPONS[w.id]; if (w.evo) { const E = EVOS[w.evo]; return { ...W, ...E, lvl: 5, evo: true }; } const L = w.lv - 1; const o = { kind: W.kind, type: W.type, col: W.col, evo: false, lvl: w.lv }; for (const k of ["dmg", "cd", "area", "arc", "n", "pierce", "bleed", "burn", "slow", "freeze", "shock", "dur"]) if (Array.isArray(W[k])) o[k] = W[k][L]; for (const k of ["spd", "life", "spread"]) if (W[k] !== undefined) o[k] = W[k]; return o; }
  updWeapon(P, w, dt) {
    const S = P.stats, ws = this.wstat(w);
    let mult = 1; if (w.evo && this.aug && P.augs.includes(EVO_RESONANCE[w.evo])) mult = 1.25;
    const isProj = ["proj", "homing", "boom", "drone"].includes(ws.type);
    const area = S.area + (!isProj ? S.ovArea : 0), dmg = ws.dmg * S.atk * mult * (ws.kind === "summon" ? S.summon : 1);
    // 상시형 (몸 주위 도는 것)
    if (ws.type === "orbit" || ws.type === "guard") { this.orbitHits(P, w, ws, dmg, area, dt); return; }
    const cdMul = S.cdMul / S.aspd;
    w.t -= dt; if (w.t > 0) return; w.t += Math.max(ws.cd * 0.35, ws.cd * cdMul);
    const n = ws.n + (isProj ? S.proj : 0), aim = P.aim;
    switch (ws.type) {
      case "melee": {
        const R = ws.area * area, arc = ws.arc * Math.PI / 180;
        for (let k = 0; k < (ws.evo ? 1 : n); k++) { const a = aim + (k ? Math.PI : 0); this.cone(P, P.x, P.y, a, arc, R, dmg, { kind: "direct", kb: 40 }); this.ev.push({ k: "slash", i: P.idx, a: +a.toFixed(2), r: Math.round(R), arc: ws.arc, w: w.evo || w.id }); }
        if (ws.wave) for (let k = 0; k < 4; k++) this.fireShot(P, { w: "berserker", x: P.x, y: P.y, a: aim + k * Math.PI / 2, spd: 520, dmg: dmg * 0.6, pierce: 3, r: 16, life: 0.6, kind: "direct" });
        break;
      }
      case "stab": {
        const R = ws.area * area * (ws.evo ? 2.6 : 1), tg = this.nearestN(P.x, P.y, R, n);
        for (const m of tg) { this.hitMon(P, m, dmg, { kind: "direct" }); if (ws.bleed && this.rng() < ws.bleed) this.applySt(m, "bleed", { t: 4, pow: P.ap }); this.ev.push({ k: "stab", i: P.idx, x: m.x, y: m.y, w: w.evo || w.id }); }
        if (!tg.length) this.ev.push({ k: "stab", i: P.idx, x: P.x + Math.cos(aim) * 40, y: P.y + Math.sin(aim) * 40, w: w.evo || w.id });
        break;
      }
      case "proj": {
        const spread = ws.spread || 0.12;
        for (let k = 0; k < n; k++) { const off = n > 1 ? (k - (n - 1) / 2) * spread : (ws.spread ? (this.rng() - 0.5) * ws.spread : 0); this.fireShot(P, { w: w.evo || w.id, x: P.x, y: P.y, a: aim + off, spd: ws.spd, dmg, pierce: ws.pierce + S.pierce, r: ws.area, life: ws.life, kind: "direct", slow: ws.slow, freeze: ws.freeze }); }
        if (ws.spiral) { w.ang = (w.ang || 0) + 0.55; for (let k = 0; k < 2; k++) this.fireShot(P, { w: "bullethell", x: P.x, y: P.y, a: w.ang + k * Math.PI, spd: 520, dmg: dmg * 0.7, pierce: 1, r: 5, life: 1, kind: "direct" }); }
        if (ws.rain) { const tg = this.nearestN(P.x, P.y, 420, ws.rain); for (const m of tg) this.friendlyCircle(P, m.x, m.y, ws.rainArea * area, dmg * 0.8, 0.35, { kind: "direct", fx: "arrowrain" }); }
        if (ws.nova) { w.nv = (w.nv || 0) + 1; if (w.nv * ws.cd * cdMul >= ws.nova) { w.nv = 0; const R = ws.novaArea * area; this.aoe(P, P.x, P.y, R, dmg, { kind: "direct", st: "freeze", stCh: ws.freeze }); this.ev.push({ k: "boom", x: P.x, y: P.y, r: R, c: 4 }); } }
        break;
      }
      case "homing": {
        const tg = this.nearestN(P.x, P.y, 560, n);
        for (let k = 0; k < n; k++) { const m = tg[k % Math.max(1, tg.length)]; const a = m ? Math.atan2(m.y - P.y, m.x - P.x) : aim + (k - (n - 1) / 2) * 0.3; this.fireShot(P, { w: w.evo || w.id, x: P.x, y: P.y, a, spd: ws.spd, dmg, pierce: ws.pierce + S.pierce, r: ws.area, life: ws.life, kind: "direct", home: m ? m.id : 0, blast: ws.blast ? ws.blast * area : 0 }); }
        break;
      }
      case "boom": {
        const tg = this.nearestN(P.x, P.y, 520, n);
        for (let k = 0; k < n; k++) { const m = tg[k]; const a = m ? Math.atan2(m.y - P.y, m.x - P.x) : aim + k * 0.4; this.fireShot(P, { w: w.evo || w.id, x: P.x, y: P.y, a, spd: ws.spd, dmg, pierce: 0, r: 10, life: ws.life, kind: "direct", blast: ws.area * area, burn: ws.burn, ground: ws.ground || 0 }); }
        break;
      }
      case "chain": {
        const hit = new Set(); let from = { x: P.x, y: P.y }; const pts = [P.x, P.y];
        for (let k = 0; k < n; k++) { const m = this.nearest(from.x, from.y, k ? 160 : ws.area * area, hit); if (!m) break; hit.add(m.id); this.hitMon(P, m, dmg, { kind: "direct" }); if (this.rng() < ws.shock) this.applySt(m, "shock", { t: 3 }); pts.push(Math.round(m.x), Math.round(m.y)); from = m; }
        if (pts.length > 2) this.ev.push({ k: "bolt", p: pts, x: P.x, y: P.y, c: 0 });
        if (ws.strikes) { const tg = this.nearestN(P.x, P.y, 420, 12); for (let k = 0; k < ws.strikes && tg.length; k++) { const m = tg[(this.rng() * tg.length) | 0]; this.friendlyCircle(P, m.x, m.y, ws.strikeArea * area, dmg * 1.2, 0.3, { kind: "direct", st: "shock", fx: "strike" }); } }
        break;
      }
      case "drone": {
        const cnt = n; for (let k = 0; k < cnt; k++) { const a = this.t * 2 + k * Math.PI * 2 / cnt, dx = P.x + Math.cos(a) * 46, dy = P.y + Math.sin(a) * 46; const m = this.nearest(dx, dy, 400); if (!m) continue; this.fireShot(P, { w: w.evo || w.id, x: dx, y: dy, a: Math.atan2(m.y - dy, m.x - dx), spd: ws.spd, dmg, pierce: 0, r: ws.area, life: ws.life, kind: "summon", blast: ws.missile ? ws.missile * area : 0 }); }
        break;
      }
      case "pool": {
        const tg = this.nearestN(P.x, P.y, 340, 8);
        for (let k = 0; k < n; k++) { const m = tg.length ? tg[(this.rng() * tg.length) | 0] : null; const x = m ? m.x : P.x + (this.rng() - 0.5) * 200, y = m ? m.y : P.y + (this.rng() - 0.5) * 200; this.friendlyPool(P, x, y, ws.area * area, dmg, ws.dur, { kind: "dot", st: "poison", move: !!ws.move, fx: w.evo ? "toxic" : "poison" }); }
        break;
      }
    }
  }
  orbitHits(P, w, ws, dmg, area, dt) {
    const n = ws.n + P.stats.proj, R0 = ws.area * area; let R = R0;
    if (ws.pulse) R = R0 * (0.75 + 0.35 * Math.sin(this.t * 2.2));
    const spd = ws.type === "guard" ? 2.4 : 3.4, base = this.t * spd, gap = Math.max(0.2, ws.cd * P.stats.cdMul / P.stats.aspd), orbR = ws.type === "guard" ? 14 : 20;
    w.R = R; w.n = n;
    if (w.hits.size > 600) w.hits.clear();
    for (let k = 0; k < n; k++) {
      const a = base + k * Math.PI * 2 / n, ox = P.x + Math.cos(a) * R, oy = P.y + Math.sin(a) * R;
      this.near(ox, oy, orbR, (m) => { const nt = w.hits.get(m.id) || 0; if (nt > this.t) return; w.hits.set(m.id, this.t + gap); this.hitMon(P, m, dmg, { kind: "direct", holy: w.id === "holy", kb: ws.type === "guard" ? 60 : 25, kbx: m.x - P.x, kby: m.y - P.y }); });
      if (ws.type === "guard") for (let i = this.eshots.length - 1; i >= 0; i--) { const s = this.eshots[i]; if (d2(ox, oy, s.x, s.y) < (orbR + s.r) ** 2) { this.eshots.splice(i, 1); this.ev.push({ k: "block", x: s.x, y: s.y }); } }
      if (this.kind === "pvp") this.pvpCircle(P, ox, oy, orbR, dmg * 0.5, w);
    }
    if (ws.heal) { w.ht = (w.ht || 0) + dt; if (w.ht >= 4) { w.ht = 0; for (const Q of this.alivePlayers()) if (this.ally(P, Q) && d2(P.x, P.y, Q.x, Q.y) < 170 * 170) this.heal(Q, Q.maxHp * ws.heal); this.ev.push({ k: "heal", x: P.x, y: P.y, r: 170 }); } }
  }
  fireShot(P, s) {
    if (this.shots.length > 900) return; // 투사체 상한
    const sh = { w: s.w, wt: WEAP_TYPE[s.w] ?? 0, x: s.x, y: s.y, vx: Math.cos(s.a) * s.spd, vy: Math.sin(s.a) * s.spd, a: s.a, dmg: s.dmg, pierce: s.pierce ?? 0, hitN: 0, r: s.r || 6, life: s.life || 1, kind: s.kind || "direct", owner: P.id, hit: null, home: s.home || 0, blast: s.blast || 0, burn: s.burn || 0, ground: s.ground || 0, slow: s.slow || 0, freeze: s.freeze || 0, spd: s.spd };
    this.shots.push(sh);
  }
  updShots(dt) {
    const sh = this.shots;
    for (let i = sh.length - 1; i >= 0; i--) {
      const s = sh[i]; const P = this.P.get(s.owner);
      if (!P) { sh.splice(i, 1); continue; }
      if (s.home) { const m = this.monById(s.home); if (m && m.hp > 0) { const a = Math.atan2(m.y - s.y, m.x - s.x), cur = Math.atan2(s.vy, s.vx), na = cur + clamp(angDiff(a, cur), -6 * dt, 6 * dt); s.vx = Math.cos(na) * s.spd; s.vy = Math.sin(na) * s.spd; s.a = na; } else s.home = 0; }
      const ox = s.x, oy = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > MAP.w || s.y > MAP.h;
      if (!dead) {
        const mx = (ox + s.x) / 2, my = (oy + s.y) / 2, rr = Math.hypot(s.x - ox, s.y - oy) / 2 + s.r + 24;
        this.near(mx, my, rr, (m) => {
          if (s.hit && s.hit.has(m.id)) return; if (!segHit(ox, oy, s.x, s.y, m.x, m.y, m.r + s.r)) return;
          (s.hit || (s.hit = new Set())).add(m.id);
          if (s.blast) { this.aoe(P, m.x, m.y, s.blast, s.dmg, { kind: s.kind, st: s.burn ? "burn" : null, stCh: s.burn || 0 }); this.ev.push({ k: "boom", x: m.x, y: m.y, r: s.blast, c: s.burn ? 2 : 5 }); if (s.ground) this.friendlyPool(P, m.x, m.y, s.blast * 0.8, s.dmg * 0.25, s.ground, { kind: "dot", st: "burn", fx: "fire" }); dead = true; return true; }
          const fall = P.augs.includes("a16") ? Math.pow(1 - AUG.a16.v.fall, s.hitN) : 1;
          this.hitMon(P, m, s.dmg * fall, { kind: s.kind, kb: 18, kbx: s.vx, kby: s.vy });
          if (s.slow) this.applySt(m, "slow", { v: s.slow, t: 2 }); if (s.freeze && this.rng() < s.freeze) this.applySt(m, "freeze", { t: 1.2 });
          s.hitN++; if (s.hitN > s.pierce) { dead = true; return true; }
        });
        if (!dead && this.kind === "pvp") { for (const Q of this.P.values()) if (Q !== P && Q.state === "alive" && segHit(ox, oy, s.x, s.y, Q.x, Q.y, Q.r + s.r)) { this.pvpHit(P, Q, s.dmg); dead = true; break; } }
        if (!dead && s.kind !== "summon") for (const o of this.obs) if (d2(s.x, s.y, o.x, o.y) < (o.r) ** 2 && !s.w.startsWith("ice") && s.w !== "absolutezero") { dead = true; break; }
      }
      if (dead) { if (s.blast && s.life <= 0) { this.aoe(P, s.x, s.y, s.blast, s.dmg, { kind: s.kind, st: s.burn ? "burn" : null, stCh: s.burn || 0 }); this.ev.push({ k: "boom", x: s.x, y: s.y, r: s.blast, c: s.burn ? 2 : 5 }); } sh[i] = sh[sh.length - 1]; sh.pop(); }
    }
  }
  monById(id) { for (const m of this.mons) if (m.id === id) return m; return null; }
  // ---------- 범위 판정 도우미 ----------
  aoe(P, x, y, r, dmg, o = {}) {
    let n = 0; this.near(x, y, r, (m) => { this.hitMon(P, m, dmg, o); if (o.st && (!o.stCh || this.rng() < o.stCh)) this.applySt(m, o.st, { t: STATUS[o.st].dur, pow: P.ap }); n++; });
    if (this.kind === "pvp") this.pvpCircle(P, x, y, r, dmg);
    return n;
  }
  cone(P, x, y, a, arc, r, dmg, o = {}) {
    this.near(x, y, r, (m) => { const ma = Math.atan2(m.y - y, m.x - x); if (arc < 6.2 && Math.abs(angDiff(ma, a)) > arc / 2 + Math.atan2(m.r, Math.max(1, Math.sqrt(d2(x, y, m.x, m.y))))) return; this.hitMon(P, m, dmg, { ...o, kbx: m.x - x, kby: m.y - y }); });
    if (this.kind === "pvp") for (const Q of this.P.values()) if (Q !== P && Q.state === "alive" && d2(x, y, Q.x, Q.y) < (r + Q.r) ** 2 && (arc >= 6.2 || Math.abs(angDiff(Math.atan2(Q.y - y, Q.x - x), a)) < arc / 2)) this.pvpHit(P, Q, dmg);
  }
  friendlyCircle(P, x, y, r, dmg, warn, o = {}) { this.haz.push({ id: this.hazSeq++, friendly: true, owner: P.id, k: "circle", x, y, r, warn, dmg, st: o.st || null, kind: o.kind || "proc", fx: o.fx || "", bossCap: o.bossCap || 0, life: warn + 0.25 }); }
  friendlyPool(P, x, y, r, dmg, dur, o = {}) { const mine = this.haz.filter(h => h.friendly && h.k === "pool"); if (mine.length > 60) mine[0].life = 0; this.haz.push({ id: this.hazSeq++, friendly: true, owner: P.id, k: "pool", x, y, r, warn: 0, dmg, st: o.st || null, kind: o.kind || "dot", fx: o.fx || "", life: dur, acc: 0, move: !!o.move }); }
  pvpCircle(P, x, y, r, dmg, w) { for (const Q of this.P.values()) { if (Q === P || Q.state !== "alive" || d2(x, y, Q.x, Q.y) > (r + Q.r) ** 2) continue; if (w) { const k = "p" + Q.id; if ((w.hits.get(k) || 0) > this.t) continue; w.hits.set(k, this.t + 0.5); } this.pvpHit(P, Q, dmg); } }
  pvpHit(P, Q, dmg) { if (!(this.kind === "pvp")) return; this.hurtPlayer(Q, dmg * 0.25, { k: "pvp", src: P }); P.dmg += dmg * 0.25; }
  // ---------- 피해 (몬스터) ----------
  // o.kind: direct(직접) · summon(소환물) · dot(지속) · proc(증강·스킬 발동) — 흡혈·연쇄·독은 direct만, 재귀 금지
  hitMon(P, m, base, o = {}) {
    if (m.hp <= 0 || m.inv > 0) return 0;
    const S = P.stats; let dmg = base;                                    // 기본 피해 (이미 공격력 반영된 값이 들어옴)
    const direct = o.kind === "direct";
    if (direct && P.augs.includes("a01")) dmg *= 1 + AUG.a01.v.dmg;       // 스킬 배율
    if (direct && P.augs.includes("a29")) { if (m.boss) dmg *= 1 + AUG.a29.v.boss; else if (m.hp / m.maxHp <= AUG.a29.v.th) dmg *= 1 + AUG.a29.v.mult; }
    let crit = false; if (o.kind !== "dot" && this.rng() < S.crit) { crit = true; dmg *= S.critDmg; } // 치명타
    dmg *= 100 / (100 + (m.def || 0));                                   // 방어력
    let dr = m.dr || 0;
    if (m.shieldFront) { const from = Math.atan2(P.y - m.y, P.x - m.x); if (Math.abs(angDiff(from, m.face || 0)) < 1.0) dr = Math.max(dr, 0.7); }
    if (m.barrier > this.t) dr = Math.max(dr, 0.7);
    dmg *= 1 - dr;                                                        // 피해 감소
    if (m.st.shock) dmg *= 1 + STATUS.shock.vuln; if (m.st.curse) dmg *= 1 + STATUS.curse.vuln; // 취약
    if (o.bossCap && m.boss) dmg = Math.min(dmg, m.maxHp * o.bossCap);   // 보스 피해 상한 (광역 증강)
    dmg = Math.max(1, Math.round(dmg));
    const real = Math.min(dmg, m.hp);
    m.hp -= dmg; m.hurt = 0.12; P.dmg += real; if (m.boss) P.bossDmg += real;
    if (o.kb && !m.kbImmune && !m.boss) { const l = Math.hypot(o.kbx || 0, o.kby || 0) || 1; m.kx += (o.kbx || 0) / l * o.kb * 4; m.ky += (o.kby || 0) / l * o.kb * 4; }
    if (this.ev.length < 400) this.ev.push({ k: "hit", x: Math.round(m.x), y: Math.round(m.y - m.r), d: dmg, c: crit ? 1 : 0, i: P.idx });
    // 직접 공격 반응 (증강) — 소환물·지속·발동 피해는 반응 없음
    if (direct && this.aug) {
      if (P.augs.includes("a15")) { const pct = P.flags.berserk && P.syn.has("s4") ? 0.08 : AUG.a15.v.pct; this.lifesteal(P, real * pct); }
      if (P.augs.includes("a14") && this.rng() < AUG.a14.v.ch) this.applySt(m, "poison", { t: AUG.a14.v.dur, pow: P.ap * AUG.a14.v.mult / STATUS.poison.dot });
      if (P.augs.includes("a11")) { P.hitCount++; if (P.hitCount >= AUG.a11.v.every) { P.hitCount = 0; this.chainProc(P, m, P.syn.has("s1") ? 5 : AUG.a11.v.n, AUG.a11.v.mult, P.syn.has("s1")); } }
    }
    if (m.hp <= 0) this.killMon(m, P, o);
    return real;
  }
  chainProc(P, from, n, mult, shock) {
    const hit = new Set([from.id]), pts = [Math.round(from.x), Math.round(from.y)]; let cur = from;
    for (let k = 0; k < n; k++) { const m = this.nearest(cur.x, cur.y, AUG.a11.v.range, hit); if (!m) break; hit.add(m.id); this.hitMon(P, m, P.ap * mult, { kind: "proc" }); if (shock) this.applySt(m, "shock", { t: 3 }); pts.push(Math.round(m.x), Math.round(m.y)); cur = m; }
    if (pts.length > 2) this.ev.push({ k: "bolt", p: pts, x: from.x, y: from.y, c: 1 });
  }
  lifesteal(P, amt) {
    if (amt <= 0 || P.state !== "alive") return;
    if (this.t - P.lsWin >= 1) { P.lsWin = this.t; P.lsAmt = 0; }
    const cap = P.maxHp * CAP.lifestealPerSec; const give = Math.min(amt, cap - P.lsAmt); if (give <= 0) return;
    P.lsAmt += give; this.heal(P, give, true);
  }
  applySt(m, k, o = {}) {
    const S = STATUS[k]; if (!S || m.hp <= 0) return;
    if (m.imm[k] > this.t) return;
    let dur = o.t ?? S.dur;
    if (m.boss) { if (k === "freeze") { k = "slow"; o = { v: 0.5, t: 1 }; dur = 1; } else dur *= STATUS[k].boss; if (dur <= 0) return; }
    if (m.st.stun && k === "freeze") return;
    const cur = m.st[k];
    if (cur) { if (STATUS[k].refresh) cur.t = Math.max(cur.t, dur); cur.n = Math.min(STATUS[k].max, (cur.n || 1) + (o.n || 1) - (k === "poison" || k === "bleed" ? 0 : 1)); if (o.v) cur.v = Math.max(cur.v || 0, o.v); if (o.pow) cur.pow = Math.max(cur.pow || 0, o.pow); return; }
    m.st[k] = { t: dur, n: Math.min(STATUS[k].max, o.n || 1), v: o.v || 0, pow: o.pow || AP_BASE, acc: 0, src: o.src || null };
  }
  killMon(m, P, o = {}) {
    if (m.dead) return; m.dead = true; m.hp = 0;
    this.stats.kills++;
    if (P) { P.kills++; if (m.elite) P.eliteKills++; if (!m.summoned) this.teamGauge = Math.min(this.teamMax(), this.teamGauge + 1); this.o.onKill?.(this, P, m); }
    const mx = Math.round(m.x), my = Math.round(m.y);
    // 좀비 되살아남 (불·성스러운 공격엔 안 됨)
    if (m.revive && !m.revived && !m.st.burn && !o.holy) { m.revived = true; m.dead = false; m.hp = m.maxHp * 0.5; m.inv = 1.2; this.ev.push({ k: "revive", x: mx, y: my }); return; }
    this.ev.push({ k: "die", x: mx, y: my, t: m.tc, e: m.elite ? 1 : 0, b: m.boss ? 1 : 0 });
    if (m.decoy) return;
    if (m.boss) { this.bossDown(m, P); return; }
    // 경험치 보석
    this.dropGem(m.x, m.y, m.xp * (m.elite ? 6 : 1));
    if (m.split && !m.mini) for (let k = 0; k < 2; k++) this.spawnMon("slime", m.x + (k ? 14 : -14), m.y, { mini: true, hpMul: 0.4 });
    if (m.elite) { const r = this.rng(); if (this.t * this.ts > 420 && r < 0.3) this.dropItem("evo", m.x, m.y); else if (r < 0.65) this.dropItem("meat", m.x, m.y); else this.dropItem("magnet", m.x, m.y); if (m.donor) this.donorElites = Math.max(0, this.donorElites - 1); if (m.invader) this.invaders = Math.max(0, this.invaders - 1); }
    else if (this.rng() < 0.009) this.dropItem(this.rng() < 0.6 ? "meat" : this.rng() < 0.5 ? "magnet" : "bomb", m.x, m.y);
    // 화염 폭발 (발동 피해로 죽은 건 다시 터지지 않음 = 연쇄 폭발 방지)
    if (P && this.aug && P.augs.includes("a12") && o.kind !== "proc") { const ch = P.syn.has("s2") ? 0.25 : AUG.a12.v.ch; if (this.rng() < ch) { this.aoe(P, m.x, m.y, AUG.a12.v.rad, P.ap * AUG.a12.v.mult, { kind: "proc" }); this.ev.push({ k: "boom", x: mx, y: my, r: AUG.a12.v.rad, c: 2 }); } }
  }
  dropGem(x, y, v) {
    if (this.gems.length > 380) { // 보석이 너무 많으면 가까운 것에 합치기
      let best = null, bd = 1e12; for (let i = 0; i < 40; i++) { const g = this.gems[(this.rng() * this.gems.length) | 0]; const d = d2(g.x, g.y, x, y); if (d < bd) { bd = d; best = g; } }
      if (best) { best.v += v; return; }
    }
    this.gems.push({ x: x + (this.rng() - 0.5) * 10, y: y + (this.rng() - 0.5) * 10, v });
  }
  dropItem(k, x, y) { if (this.items.length > 40) return; this.items.push({ id: this.itemSeq++, k, x: Math.round(x), y: Math.round(y) }); }
  useItem(P, it) {
    if (it.k === "meat") this.heal(P, P.maxHp * 0.3);
    else if (it.k === "magnet") { for (const g of this.gems) this.gainXp(P, g.v); this.gems.length = 0; this.ev.push({ k: "magnet", i: P.idx }); }
    else if (it.k === "bomb") { this.aoe(P, P.x, P.y, 520, P.ap * 2, { kind: "proc", bossCap: 0.02 }); this.ev.push({ k: "boom", x: P.x, y: P.y, r: 520, c: 3 }); }
    else if (it.k === "evo") this.giveEvo(P);
    else if (it.k === "supply") { this.heal(P, P.maxHp * 0.5); this.addShield(P, P.maxHp * 0.2); for (const g of this.gems) this.gainXp(P, g.v); this.gems.length = 0; this.gainXp(P, P.xpNext); }
    this.ev.push({ k: "item", i: P.idx, it: it.k, x: it.x, y: it.y });
  }
  updGems(dt) {
    const ps = this.alivePlayers(); if (!ps.length) return;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      for (const P of ps) {
        const pr = P.stats.pickup, dd = d2(P.x, P.y, g.x, g.y);
        if (dd < pr * pr) {
          if (dd < 24 * 24) { this.gems[i] = this.gems[this.gems.length - 1]; this.gems.pop(); this.gainXp(P, g.v);
            if (this.kind === "coop" || this.kind === "team") for (const Q of ps) if (Q !== P && Q.team === P.team) this.gainXp(Q, g.v * 0.5); break; }
          const d = Math.sqrt(dd) || 1, sp = 520 * dt; g.x += (P.x - g.x) / d * Math.min(sp, d); g.y += (P.y - g.y) / d * Math.min(sp, d); break;
        }
      }
    }
  }
  gainXp(P, v) {
    if (P.state !== "alive") return;
    P.xp += v * P.stats.xp;
    let guard = 0;
    while (P.xp >= P.xpNext && guard++ < 5) { P.xp -= P.xpNext; P.lvl++; P.xpNext = XP_CURVE(P.lvl); this.offerLevel(P); this.ev.push({ k: "lvl", i: P.idx, x: P.x, y: P.y }); }
    if (guard >= 5) P.xp = Math.min(P.xp, P.xpNext - 1);
  }
  heal(P, amt, quiet) { if (P.state !== "alive" || amt <= 0) return; const before = P.hp; P.hp = Math.min(P.maxHp, P.hp + amt); P.healed += P.hp - before; if (!quiet && P.hp > before) this.ev.push({ k: "healn", x: Math.round(P.x), y: Math.round(P.y - 20), d: Math.round(P.hp - before) }); }
  addShield(P, amt) { P.shield = Math.min(P.maxHp * 0.5, P.shield + amt); }
  // ---------- 피해 (플레이어) ----------
  // o = { k: 'contact'|'shot'|'haz'|'dot'|'pvp', src: 몬스터, st, melee }
  hurtPlayer(P, raw, o = {}) {
    if (P.state !== "alive" || raw <= 0 || P.god) return 0; // god: 시험 전용 (SVA_DEV)
    const t = this.t;
    if (o.k !== "dot") {
      if (P.iframes > 0) return 0;
      // 절대 방어: 다음 1회 피해 완전 차단 (무적 중엔 소모 안 함)
      if (P.flags.absShield) { P.flags.absShield = false; P.at.a35 = t + AUG.a35.v.every; this.ev.push({ k: "absblock", i: P.idx, x: P.x, y: P.y });
        if (P.syn.has("s6")) { this.aoe(P, P.x, P.y, 130, P.ap * 2, { kind: "proc" }); this.ev.push({ k: "boom", x: P.x, y: P.y, r: 130, c: 6 }); } return 0; }
      if (P.buffs.smoke > t && this.rng() < 0.6) { this.ev.push({ k: "miss", x: P.x, y: P.y - 20 }); return 0; }
    }
    const S = P.stats;
    let dmg = raw;
    if (o.k !== "dot") dmg *= 100 / (100 + S.def);             // 방어력
    dmg *= 1 - S.dr;                                             // 피해 감소 (상한 60%)
    if (P.st.curse) dmg *= 1 + STATUS.curse.vuln; if (P.st.shock) dmg *= 1 + STATUS.shock.vuln;
    dmg = Math.max(1, Math.round(dmg * 10) / 10);
    // 보호막 먼저
    if (P.shield > 0) { const a = Math.min(P.shield, dmg); P.shield -= a; dmg -= a; if (dmg <= 0) return 0; }
    P.taken += dmg;
    if (dmg >= P.hp) { if (this.lethal(P, dmg)) return 0; }
    P.hp -= dmg;
    if (o.k !== "dot" && this.ev.length < 400) this.ev.push({ k: "phit", i: P.idx, x: Math.round(P.x), y: Math.round(P.y - 18), d: Math.round(dmg) });
    if (o.k !== "dot") P.iframes = Math.max(P.iframes, 0.3); // 맞은 뒤 0.3초 무적 (둘러싸여 한순간에 녹지 않게)
    // 피격 반응 증강
    if (this.aug && o.src && !o.noReact) {
      const m = o.src;
      if (P.augs.includes("a13") && (P.at.a13 || 0) <= t) { P.at.a13 = t + (P.syn.has("s3") ? 4 : AUG.a13.v.icd); this.applySt(m, "slow", { v: m.boss ? AUG.a13.v.bossSlow : AUG.a13.v.slow, t: AUG.a13.v.dur }); this.ev.push({ k: "frost", x: m.x, y: m.y }); }
      if (P.augs.includes("a19") && o.melee) { if (t - P.thornWin >= 1) { P.thornWin = t; P.thornN = 0; } if (P.thornN < AUG.a19.v.perSec) { P.thornN++; this.hitMon(P, m, dmg * (P.syn.has("s6") ? 0.4 : AUG.a19.v.pct) / Math.max(0.2, P.stats.atk) * P.stats.atk, { kind: "proc" }); } }
    }
    // 운명 역전 (체력 20% 이하로 들어갈 때, 재사용 60초 — 재진입으로 다시 못 켬)
    if (this.aug && P.augs.includes("a37") && P.hp <= P.maxHp * AUG.a37.v.th && (P.at.a37 || 0) <= t) { P.at.a37 = t + AUG.a37.v.cd; P.buffs.fate = t + AUG.a37.v.dur; this.ev.push({ k: "fate", i: P.idx, x: P.x, y: P.y }); }
    return dmg;
  }
  // 치명적인 피해 처리 — 한 틱 안에서 한 번에 판정 (서버 원자적)
  lethal(P, dmg) {
    const t = this.t;
    if (this.aug) {
      if (P.augs.includes("a25") && !P.flags.undying) { P.flags.undying = true; P.hp = 1; P.iframes = AUG.a25.v.inv; this.ev.push({ k: "undying", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: "save", i: P.idx, a: "a25" });
        if (P.syn.has("s12")) { P.buffs.fate = t + 8; P.at.a37 = t + AUG.a37.v.cd; } return true; }
      if (P.augs.includes("a34") && !P.flags.rewind) {
        const back = P.hist.find(h => h.t >= t - AUG.a34.v.back - 0.13) || P.hist[0];
        if (back) { P.flags.rewind = true; const fx = P.x, fy = P.y; P.x = back.x; P.y = back.y; this.pushOut(P); P.hp = Math.max(1, Math.min(P.maxHp, back.hp)); P.st = {}; P.iframes = 1; this.ev.push({ k: "rewind", i: P.idx, x: fx, y: fy, x2: P.x, y2: P.y }); this.gev.push({ k: "save", i: P.idx, a: "a34" }); return true; }
      }
      if (P.augs.includes("a39")) {
        const solo = this.kind === "versus" || this.kind === "pvp" || [...this.P.values()].filter(Q => Q.team === P.team).length === 1;
        if (solo && !P.flags.miracle) { P.flags.miracle = true; P.hp = Math.max(1, P.maxHp * 0.3); P.iframes = 1.5; this.ev.push({ k: "miracle", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: "save", i: P.idx, a: "a39" }); return true; }
      }
      // 협동: 전원 쓰러지기 직전이면 팀에 '최후의 기적'을 가진 사람이 있을 때 1회
      if (!this.miracleUsed && this.kind !== "versus" && this.kind !== "pvp") {
        const team = [...this.P.values()].filter(Q => Q.team === P.team);
        const others = team.filter(Q => Q !== P && Q.state === "alive");
        if (team.length > 1 && !others.length && team.some(Q => Q.augs.includes("a39"))) { this.miracleUsed = true; P.hp = Math.max(1, P.maxHp * AUG.a39.v.pct); P.iframes = 2; this.ev.push({ k: "miracle", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: "save", i: P.idx, a: "a39" }); return true; }
      }
    }
    // 쓰러짐
    P.hp = 0; P.shield = 0; P.st = {}; P.dashT = 0; P.falls++;
    const canRevive = (this.kind === "coop" || this.kind === "team") && [...this.P.values()].some(Q => Q !== P && Q.team === P.team) && P.revives < 3;
    if (canRevive) { P.state = "down"; P.downT = 25; P.revProg = 0; } else P.state = "dead";
    this.ev.push({ k: P.state === "down" ? "down" : "dead", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: P.state === "down" ? "pdown" : "pdead", i: P.idx });
    for (const e of this.ents) if (e.owner === P.id && e.k !== "trap") e.until = 0;
    return true;
  }
  revive(P, pct, by) {
    if (P.state === "alive") return; P.state = "alive"; P.revives++; P.hp = Math.max(1, P.maxHp * pct); P.iframes = 2; P.revProg = 0; P.st = {};
    if (by && by !== P) by.revivedOthers++;
    this.ev.push({ k: "revived", i: P.idx, x: P.x, y: P.y }); this.gev.push({ k: "prev", i: P.idx, by: by ? by.idx : -1 });
  }
  // ---------- 증강 ----------
  updAugs(P, dt) {
    const t = this.t, has = (id) => P.augs.includes(id), every = (id, sec) => { if ((P.at[id] ?? 0) === 0) { P.at[id] = t + sec * 0.5; return false; } if (P.at[id] <= t) { P.at[id] = t + sec; return true; } return false; };
    const allies = () => this.alivePlayers().filter(Q => this.ally(P, Q) || Q === P);
    if (has("a09") && every("a09", AUG.a09.v.every)) { const cap = P.maxHp * AUG.a09.v.max; if (P.shield < cap) P.shield = Math.min(cap, P.shield + P.maxHp * AUG.a09.v.pct); this.ev.push({ k: "shield", i: P.idx, x: P.x, y: P.y }); }
    if (has("a20") && every("a20", AUG.a20.v.every)) { const list = this.kind === "versus" || this.kind === "pvp" ? [P] : allies(); for (const Q of list) if (d2(P.x, P.y, Q.x, Q.y) < AUG.a20.v.rad ** 2) { this.heal(Q, Q.maxHp * AUG.a20.v.pct); if (P.syn.has("s9")) Q.buffs.sanct = t + 3; } this.ev.push({ k: "heal", x: P.x, y: P.y, r: AUG.a20.v.rad }); }
    if (has("a21") && every("a21", AUG.a21.v.every)) { const c = this.densest(P, 600); if (c) { this.friendlyCircle(P, c.x, c.y, AUG.a21.v.rad, P.ap * AUG.a21.v.mult, AUG.a21.v.warn, { kind: "proc", fx: "meteor", st: "burn" }); if (P.syn.has("s2")) this.haz[this.haz.length - 1].after = { k: "fireground", dur: 4, dps: 0.2 }; } }
    if (has("a22") && every("a22", AUG.a22.v.every)) { P.buffs.warp = t + AUG.a22.v.dur; if (P.syn.has("s3")) this.near(P.x, P.y, AUG.a22.v.rad, (m) => { if (!m.boss) this.applySt(m, "freeze", { t: 1.2 }); }); this.ev.push({ k: "warp", i: P.idx, x: P.x, y: P.y, r: AUG.a22.v.rad }); }
    if (P.buffs.warp > t) this.near(P.x, P.y, AUG.a22.v.rad, (m) => { const v = m.boss ? AUG.a22.v.bossSlow : AUG.a22.v.slow; if (!m.st.slow || m.st.slow.v <= v) this.applySt(m, "slow", { v, t: 0.2 }); });
    if (has("a23") && every("a23", AUG.a23.v.every)) { this.ents.push({ id: this.entSeq++, k: "clone", x: P.x - 30, y: P.y, owner: P.id, until: t + AUG.a23.v.dur, cd: 0 }); this.ev.push({ k: "clone", i: P.idx, x: P.x, y: P.y }); }
    if (has("a24") && every("a24", P.syn.has("s1") ? 10 : AUG.a24.v.every)) { const tg = this.nearestN(P.x, P.y, AUG.a24.v.range, AUG.a24.v.n); const pts = []; for (const m of tg) { this.hitMon(P, m, P.ap * AUG.a24.v.mult, { kind: "proc" }); if (P.syn.has("s1")) this.applySt(m, "shock", { t: 3 }); pts.push(Math.round(m.x), Math.round(m.y)); } if (pts.length) this.ev.push({ k: "storm", i: P.idx, p: pts, x: P.x, y: P.y }); }
    if (has("a27") && every("a27", AUG.a27.v.every)) this.haz.push({ id: this.hazSeq++, friendly: true, owner: P.id, k: "gravity", x: P.x, y: P.y, r: AUG.a27.v.rad, warn: 0, life: AUG.a27.v.dur, dmg: 0, boom: P.syn.has("s8") ? P.ap * 2.5 : 0 });
    if (has("a28") && every("a28", AUG.a28.v.every)) { for (const Q of allies()) if (d2(P.x, P.y, Q.x, Q.y) < AUG.a28.v.rad ** 2) { Q.buffs.holy = Math.max(Q.buffs.holy || 0, t + AUG.a28.v.dur); if (P.syn.has("s9")) this.heal(Q, Q.maxHp * 0.05); } this.ev.push({ k: "holy", x: P.x, y: P.y, r: AUG.a28.v.rad }); }
    if (has("a30") && every("a30", AUG.a30.v.every)) { P.buffs.overload = t + AUG.a30.v.dur; this.ev.push({ k: "overload", i: P.idx, x: P.x, y: P.y }); }
    if (has("a31") && every("a31", AUG.a31.v.every)) { const n = P.syn.has("s10") ? 25 : AUG.a31.v.n, tg = []; this.near(P.x, P.y, VIEW.hw, (m) => { if (Math.abs(m.y - P.y) < VIEW.hh) tg.push(m); }); tg.sort((a, b) => b.hp - a.hp); const pts = []; for (const m of tg.slice(0, n)) { this.hitMon(P, m, P.ap * AUG.a31.v.mult, { kind: "proc", bossCap: AUG.a31.v.bossCap }); pts.push(Math.round(m.x), Math.round(m.y)); } this.ev.push({ k: "judg", i: P.idx, p: pts, x: P.x, y: P.y }); }
    if (has("a32") && every("a32", P.syn.has("s7") ? 15 : AUG.a32.v.every)) { P.buffs.dance = t + AUG.a32.v.dur; this.ev.push({ k: "dance", i: P.idx, x: P.x, y: P.y }); }
    if (P.buffs.dance > t) this.swordRing(P, P.x, P.y, AUG.a32.v.n, AUG.a32.v.rad, "dance");
    if (has("a33") && every("a33", AUG.a33.v.every)) { P.buffs.golden = t + AUG.a33.v.dur; this.ev.push({ k: "golden", i: P.idx, x: P.x, y: P.y }); }
    if (has("a35") && !P.flags.absShield && (P.at.a35 ?? 0) <= t) { P.flags.absShield = true; }
    if (has("a36") && every("a36", AUG.a36.v.every)) { this.ents.push({ id: this.entSeq++, k: "dragon", x: P.x, y: P.y - 60, owner: P.id, until: t + AUG.a36.v.dur, cd: 0.6 }); this.ev.push({ k: "dragon", i: P.idx, x: P.x, y: P.y }); }
    if (has("a38") && every("a38", AUG.a38.v.every)) {
      if (P.syn.has("s8")) this.haz.push({ id: this.hazSeq++, friendly: true, owner: P.id, k: "gravity", x: P.x, y: P.y, r: AUG.a38.v.rad * 1.2, warn: 0, life: 1, dmg: 0, boom: 0 });
      this.friendlyCircle(P, P.x, P.y, AUG.a38.v.rad, P.ap * AUG.a38.v.mult, P.syn.has("s8") ? 1 : 0.4, { kind: "proc", fx: "collapse", bossCap: AUG.a38.v.bossCap });
      this.haz[this.haz.length - 1].follow = P.id;
    }
    if (P.buffs.repair > t) this.heal(P, P.maxHp * 0.25 / 3 * dt, true);
  }
  swordRing(P, x, y, n, R, key, mult = AUG.a32.v.mult) {
    const map = P.flags[key + "Hits"] || (P.flags[key + "Hits"] = new Map()); if (map.size > 600) map.clear();
    for (let k = 0; k < n; k++) { const a = this.t * 4 + k * Math.PI * 2 / n, ox = x + Math.cos(a) * R, oy = y + Math.sin(a) * R;
      this.near(ox, oy, 22, (m) => { const nt = map.get(m.id) || 0; if (nt > this.t) return; map.set(m.id, this.t + AUG.a32.v.hitGap); this.hitMon(P, m, P.ap * mult, { kind: "proc" }); }); }
  }
  densest(P, r) {
    let best = null, bn = 0, k = 0;
    this.near(P.x, P.y, r, (m) => { if (k++ > 24) return true; let c = 0; this.near(m.x, m.y, 72, () => { c++; }); if (c > bn) { bn = c; best = m; } });
    return best;
  }
  // ---------- 소환물·덫·분신 ----------
  updEnts(dt) {
    const t = this.t;
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const e = this.ents[i], P = this.P.get(e.owner);
      if (e.until <= t || !P) { this.ents.splice(i, 1); continue; }
      if (e.k === "turret") { e.cd -= dt; if (e.cd <= 0) { const m = this.nearest(e.x, e.y, 320); if (m) { e.cd = 0.4; e.a = Math.atan2(m.y - e.y, m.x - e.x); this.fireShot(P, { w: "gun", x: e.x, y: e.y, a: e.a, spd: 700, dmg: P.ap * 0.4 * P.stats.summon, pierce: 0, r: 5, life: 0.6, kind: "summon" }); } } }
      else if (e.k === "trap") { if (e.armed > t) continue; let fired = false; this.near(e.x, e.y, e.r, (m) => { fired = true; this.hitMon(P, m, P.ap * 2, { kind: "proc" }); this.applySt(m, m.boss ? "slow" : "stun", m.boss ? { v: 0.4, t: 2 } : { t: 2 }); }); if (fired) { e.until = 0; this.ev.push({ k: "boom", x: e.x, y: e.y, r: e.r, c: 7 }); } }
      else if (e.k === "clone") {
        if (P.state !== "alive") { e.until = 0; continue; }
        e.x += (P.x - 40 - e.x) * 0.15; e.y += (P.y + 10 - e.y) * 0.15;
        e.cd -= dt; if (e.cd <= 0) { e.cd = 0.55; const w0 = P.weapons[0], ws = w0 ? this.wstat(w0) : { dmg: 15 }; const tg = this.nearestN(e.x, e.y, 420, 2); for (const m of tg) this.fireShot(P, { w: "wand", x: e.x, y: e.y, a: Math.atan2(m.y - e.y, m.x - e.x), spd: 520, dmg: ws.dmg * P.stats.atk * AUG.a23.v.mult * 2.2, pierce: 0, r: 8, life: 1.2, kind: "summon", home: m.id }); }
        if (P.syn.has("s7")) this.swordRing(P, e.x, e.y, 3, 70, "cloneDance");
      }
      else if (e.k === "dragon") {
        if (P.state !== "alive") { e.until = 0; continue; }
        const a = t * 1.3; e.x += (P.x + Math.cos(a) * 80 - e.x) * 0.1; e.y += (P.y - 70 + Math.sin(a) * 30 - e.y) * 0.1;
        e.cd -= dt; if (e.cd <= 0) { e.cd = AUG.a36.v.gap; const c = this.densest({ x: e.x, y: e.y }, 360); if (c) { this.aoe(P, c.x, c.y, AUG.a36.v.rad, P.ap * AUG.a36.v.mult, { kind: "summon", st: "burn" }); this.ev.push({ k: "dbreath", x: e.x, y: e.y, x2: c.x, y2: c.y, r: AUG.a36.v.rad }); } }
      }
    }
    // 전투 드론 (증강): 플레이어 주위
    if (this.aug) for (const P of this.alivePlayers()) {
      if (!P.augs.includes("a18")) continue;
      const n = AUG.a18.v.max + (P.syn.has("s5") ? 2 : 0), fast = P.syn.has("s5") && P.buffs.overload > t;
      P.flags.dcd = (P.flags.dcd || 0) - dt * (fast ? 2 : 1);
      if (P.flags.dcd <= 0) { P.flags.dcd = AUG.a18.v.cd; for (let k = 0; k < n; k++) { const a = t * 1.6 + k * 2.1 + 1, dx = P.x + Math.cos(a) * 58, dy = P.y + Math.sin(a) * 58 - 10; const m = this.nearest(dx, dy, 380); if (m) this.fireShot(P, { w: "drone", x: dx, y: dy, a: Math.atan2(m.y - dy, m.x - dx), spd: 600, dmg: P.ap * AUG.a18.v.mult * P.stats.summon, pierce: 0, r: 5, life: 0.9, kind: "summon" }); } }
    }
  }
  // ---------- 장판·예고 (아군·적) ----------
  updHaz(dt) {
    const t = this.t;
    for (let i = this.haz.length - 1; i >= 0; i--) {
      const h = this.haz[i]; if (!h) continue; // 보스가 죽으면서 목록이 줄어든 경우
      if (h.follow) { const F = this.P.get(h.follow); if (F) { h.x = F.x; h.y = F.y; } }
      h.life -= dt;
      if (h.warn > 0) { h.warn -= dt; if (h.warn <= 0) this.hazFire(h); }
      else if (h.k === "pool" || h.k === "gravity" || h.k === "blackhole" || h.k === "laser" || h.k === "ring" || h.k === "zone") this.hazActive(h, dt);
      if (h.life <= 0 && this.haz[i] === h) {
        if (h.k === "gravity" && h.boom) { const P = this.P.get(h.owner); if (P) { this.aoe(P, h.x, h.y, h.r, h.boom, { kind: "proc", bossCap: 0.03 }); this.ev.push({ k: "boom", x: h.x, y: h.y, r: h.r, c: 8 }); } }
        this.haz[i] = this.haz[this.haz.length - 1]; this.haz.pop();
      }
    }
  }
  hazFire(h) {
    // 예고가 끝난 순간 한 번 판정 (원·선·부채꼴)
    if (h.friendly) {
      const P = this.P.get(h.owner); if (!P) return;
      if (h.k === "circle") { this.aoe(P, h.x, h.y, h.r, h.dmg, { kind: h.kind, st: h.st, bossCap: h.bossCap }); this.ev.push({ k: "boom", x: h.x, y: h.y, r: h.r, c: h.fx === "meteor" ? 2 : h.fx === "strike" ? 9 : h.fx === "collapse" ? 8 : 5, f: h.fx });
        if (h.after) this.friendlyPool(P, h.x, h.y, h.r, P.ap * h.after.dps, h.after.dur, { kind: "dot", st: "burn", fx: "fire" }); }
      return;
    }
    const hit = (P) => this.hurtPlayer(P, h.dmg, { k: "haz", src: h.src, st: h.st });
    for (const P of this.alivePlayers()) {
      let inside = false;
      if (h.k === "circle") inside = d2(P.x, P.y, h.x, h.y) < (h.r + P.r) ** 2;
      else if (h.k === "line") inside = segHit(h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len, P.x, P.y, h.w / 2 + P.r);
      else if (h.k === "cone") inside = d2(P.x, P.y, h.x, h.y) < (h.r + P.r) ** 2 && Math.abs(angDiff(Math.atan2(P.y - h.y, P.x - h.x), h.a)) < h.arc / 2;
      else continue;
      if (!inside) continue;
      const before = P.hp; hit(P);
      if (P.hp < before || P.state !== "alive") { if (h.st) this.stPlayer(P, h.st, h.stT); if (h.pull) { P.x = h.x - Math.cos(h.a) * 10 + Math.cos(h.a) * 60; P.y = h.y + Math.sin(h.a) * 60; this.pushOut(P); } if (h.kb) { const dx = P.x - h.x, dy = P.y - h.y, l = Math.hypot(dx, dy) || 1; P.kb.x += dx / l * h.kb; P.kb.y += dy / l * h.kb; } }
    }
    if (h.after) this.haz.push({ id: this.hazSeq++, k: "pool", x: h.x, y: h.y, r: h.after.r || h.r, warn: 0, life: h.after.dur, dmg: h.after.dps, st: h.after.st || null, stT: h.after.stT, acc: 0, fx: h.after.fx || "" });
    if (h.spawn) for (let k = 0; k < h.spawn.n; k++) this.spawnMon(h.spawn.type, h.x + (this.rng() - 0.5) * 50, h.y + (this.rng() - 0.5) * 50, { summoned: true, hpMul: h.spawn.hpMul || 1 });
  }
  hazActive(h, dt) {
    h.acc = (h.acc || 0) + dt;
    const pulse = h.acc >= 0.5; if (pulse) h.acc -= 0.5;
    if (h.friendly) {
      const P = this.P.get(h.owner); if (!P) return;
      if (h.k === "pool") {
        if (h.move) { const m = this.nearest(h.x, h.y, 300); if (m) { const dx = m.x - h.x, dy = m.y - h.y, l = Math.hypot(dx, dy) || 1; h.x += dx / l * 70 * dt; h.y += dy / l * 70 * dt; } }
        if (pulse) this.near(h.x, h.y, h.r, (m) => { this.hitMon(P, m, h.dmg, { kind: "dot" }); if (h.st) this.applySt(m, h.st, { t: STATUS[h.st].dur, pow: P.ap * 0.6 }); });
      } else if (h.k === "gravity") this.near(h.x, h.y, h.r, (m) => { if (m.boss) return; const dx = h.x - m.x, dy = h.y - m.y, l = Math.hypot(dx, dy) || 1; if (l > 10) { m.kx += dx / l * AUG.a27.v.pull * dt * 20; m.ky += dy / l * AUG.a27.v.pull * dt * 20; } });
      return;
    }
    // 적 장판
    for (const P of this.alivePlayers()) {
      if (h.k === "pool" || h.k === "zone") { if (d2(P.x, P.y, h.x, h.y) < (h.r + P.r * 0.5) ** 2) { if (pulse && h.dmg) this.hurtPlayer(P, h.dmg * 0.5, { k: "dot" }); if (h.st) this.stPlayer(P, h.st, 0.6); } }
      else if (h.k === "blackhole") { const dx = h.x - P.x, dy = h.y - P.y, l = Math.hypot(dx, dy) || 1; if (l < h.r) { P.pull = { x: dx / l * h.pullF * (1 - l / h.r * 0.5), y: dy / l * h.pullF * (1 - l / h.r * 0.5) }; if (l < 60 && pulse) this.hurtPlayer(P, h.dmg, { k: "haz", src: h.src }); } }
      else if (h.k === "laser") { h.a += h.spin * dt / Math.max(1, this.alivePlayers().length); if (segHit(h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len, P.x, P.y, h.w / 2 + P.r)) this.hurtPlayer(P, h.dmg, { k: "haz", src: h.src }); }
      else if (h.k === "ring") { const R = h.r0 + (h.dur0 - h.life) * h.spd, dd = Math.sqrt(d2(P.x, P.y, h.x, h.y)); h.r = R; if (Math.abs(dd - R) < h.w / 2 + P.r && !(h.hit || (h.hit = new Set())).has(P.id)) { h.hit.add(P.id); this.hurtPlayer(P, h.dmg, { k: "haz", src: h.src }); if (h.st) this.stPlayer(P, h.st, h.stT || 0.8); } }
    }
    if (h.k === "laser" && this.alivePlayers().length === 0) h.a += h.spin * dt;
  }
  stPlayer(P, k, dur) {
    if (P.state !== "alive" || P.dashT > 0 || P.god) return; // 대시 중엔 안 걸림 (맞은 뒤 무적과는 별개 — 부르는 쪽이 '실제로 맞았을 때만' 부름)
    const S = STATUS[k]; if (!S) return; if (P.imm[k] > this.t) return;
    const t = dur ?? S.dur, cur = P.st[k];
    const dot = k === "burn" ? 3 : k === "poison" ? 2.4 : k === "bleed" ? 2 : 0;
    if (cur) { cur.t = Math.max(cur.t, t); if (k === "poison") cur.n = Math.min(S.max, (cur.n || 1) + 1); return; }
    P.st[k] = { t, n: 1, v: k === "slow" ? 0.35 : 0, dot: dot * this.D.dmg };
  }
  // ---------- 몬스터 ----------
  spawnMon(type, x, y, o = {}) {
    const B = MONSTERS[type]; if (!B) return null;
    const tn = this.t * this.ts, grow = 1 + tn / 900 * 4, dgrow = 0.75 + tn / 900 * 1.45;
    const elite = !!o.elite, hpMul = (o.hpMul || 1) * this.D.hp * this.party.hp * grow * (elite ? 6 : 1);
    const m = { id: this.monSeq = (this.monSeq % 65000) + 1, type, tc: MON_TYPE[type], x, y, r: B.r * (elite ? 1.35 : 1) * (o.mini ? 0.7 : 1), hp: B.hp * hpMul, maxHp: B.hp * hpMul, dmg: B.dmg * this.D.dmg * this.party.dmg * dgrow * (elite ? 1.6 : 1) * (o.mini ? 0.6 : 1), spd: B.spd * (elite ? 1.05 : 1) * (1 + Math.min(0.25, tn / 900 * 0.25)),
      xp: B.xp, ai: B.ai, elite, mini: !!o.mini, st: {}, imm: {}, kx: 0, ky: 0, cd: 1 + this.rng() * 2, phase: 0, pt: 0, tgt: null, tgtT: 0, face: 0, hurt: 0, inv: 0, def: elite ? 10 : 0, dr: 0,
      split: !!B.split, revive: !!B.revive, kbImmune: !!B.kbImmune || elite, fly: !!B.fly, summoned: !!o.summoned, shieldFront: B.ai === "shield", donor: o.donor || null, invader: !!o.invader, kids: 0, alpha: 1, born: this.t };
    this.pushOut(m); this.mons.push(m); return m;
  }
  director(dt) {
    if (!this.alivePlayers().length) return;
    const tn = this.t * this.ts;
    // 보스 등장
    if (!this.boss && this.bossIdx < 3 && this.t >= this.bossAt[this.bossIdx]) this.spawnBoss(this.bossPlan[this.bossIdx]);
    // 증강 고르기 시점
    if (this.aug && this.augNext < this.augAt.length && this.t >= this.augAt[this.augNext]) { this.augNext++; for (const P of this.P.values()) if (P.state === "alive") this.offerAug(P); }
    // 웨이브: 시간에 따라 밀도·종류 (0~3분 기본 · 3~5 밀도↑ · 5~8 정예 · 8~10 특수 · 10~13 고난도 · 13~15 최종)
    const cap = this.party.cap; if (this.mons.length >= cap) return;
    let rate = (1.0 + tn / 60 * 0.62) * this.D.spawn * this.party.count * this.ts;
    if (tn > 180 && tn < 300) rate *= 1.35; if (tn > 600 && tn < 780) rate *= 1.25; if (tn > 780) rate *= 1.5;
    if (this.boss) rate *= 0.35;
    this.spawnAcc += rate * dt;
    // 포위 웨이브 (2분마다 박쥐·슬라임 원)
    const ringEvery = 120 / this.ts; if (Math.floor((this.t - dt) / ringEvery) < Math.floor(this.t / ringEvery) && this.t > 30) this.ringWave();
    let guard = 0;
    while (this.spawnAcc >= 1 && this.mons.length < cap && guard++ < 30) {
      this.spawnAcc -= 1;
      const pool = MON_IDS.filter(k => MONSTERS[k].t <= tn);
      // 최근에 풀린 것 가중치 ↑
      let tot = 0; const w = pool.map(k => { const age = tn - MONSTERS[k].t, v = (age < 150 ? 3 : age < 400 ? 2 : 1) * (MONSTERS[k].shot ? 0.45 : 1); tot += v; return v; }); // 원거리형은 덜 나오게
      let r = this.wrng() * tot, type = pool[0]; for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { type = pool[i]; break; } }
      const eliteCh = (tn > 300 ? 0.012 + tn / 900 * 0.03 : 0.003) * this.D.elite;
      const pos = this.spawnPos(); this.spawnMon(type, pos.x, pos.y, { elite: this.wrng() < eliteCh });
    }
  }
  spawnPos() {
    const ps = this.alivePlayers(), P = ps[(this.wrng() * ps.length) | 0] || { x: MAP.w / 2, y: MAP.h / 2 };
    const a = this.wrng() * Math.PI * 2, d = 600 + this.wrng() * 160;
    return this.freeSpot(clamp(P.x + Math.cos(a) * d, 30, MAP.w - 30), clamp(P.y + Math.sin(a) * d, 30, MAP.h - 30), 16);
  }
  ringWave() {
    const tn = this.t * this.ts, type = tn < 240 ? "bat" : tn < 480 ? "slime" : tn < 700 ? "wolf" : "bat";
    for (const P of this.alivePlayers()) { const n = Math.round((14 + tn / 60) * Math.min(1.6, this.D.spawn)); for (let k = 0; k < n && this.mons.length < this.party.cap + 40; k++) { const a = k / n * Math.PI * 2; this.spawnMon(type, clamp(P.x + Math.cos(a) * 520, 20, MAP.w - 20), clamp(P.y + Math.sin(a) * 520, 20, MAP.h - 20)); } }
    this.gev.push({ k: "ringwave" });
  }
  pickTarget(m) {
    let best = null, bd = Infinity;
    for (const P of this.P.values()) { if (P.state !== "alive") continue; if (P.buffs.smoke > this.t && !m.boss && d2(P.x, P.y, m.x, m.y) > 60 * 60) continue; const d = d2(P.x, P.y, m.x, m.y) * (P.flags.taunt ? 0.5 : 1); if (d < bd) { bd = d; best = P; } }
    return best;
  }
  updMons(dt) {
    const t = this.t, ms = this.mons;
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i];
      if (m.dead || m.hp <= 0) { if (!m.dead) this.killMon(m, null); if (m.dead) { ms[i] = ms[ms.length - 1]; ms.pop(); } continue; }
      if (m.boss) continue;
      const MB = MONSTERS[m.type] || NOMON;
      if (m.decoy && m.until <= t) { m.dead = true; ms[i] = ms[ms.length - 1]; ms.pop(); continue; }
      if (m.hurt > 0) m.hurt -= dt; if (m.inv > 0) m.inv -= dt;
      this.monStatus(m, dt); if (m.dead || m.hp <= 0) continue;
      // 목표 (0.5초마다, 몬스터마다 엇갈리게)
      m.tgtT -= dt; if (m.tgtT <= 0 || !m.tgt || m.tgt.state !== "alive") { m.tgt = this.pickTarget(m); m.tgtT = 0.4 + (m.id % 7) * 0.03; }
      const P = m.tgt; if (!P) { m.kx *= 0.8; m.ky *= 0.8; continue; }
      const stopped = m.st.freeze || m.st.stun;
      let spd = m.spd * (1 - (m.st.slow ? m.st.slow.v : 0)) * (this.monBuff > t ? 1.25 : 1) * (m.rally > t ? 1.3 : 1);
      const dx = P.x - m.x, dy = P.y - m.y, dist = Math.hypot(dx, dy) || 1; let ux = dx / dist, uy = dy / dist;
      m.face = Math.atan2(dy, dx);
      // 멀리 떨어진 몬스터는 플레이어 근처로 다시 (압박 유지)
      if (dist > 1500 && !m.boss) { const p = this.spawnPos(); m.x = p.x; m.y = p.y; continue; }
      let vx = 0, vy = 0;
      if (!stopped) switch (m.ai) {
        case "decoy": { vx = ux * spd * 0.6; vy = uy * spd * 0.6; m.cd -= dt; if (m.cd <= 0) { m.cd = 1.8; for (let k = -1; k <= 1; k++) this.enemyShot(m, m.face + k * 0.25, 260, m.dmg, "boss", "curse"); } break; }
        case "weave": { const s = Math.sin(t * 6 + m.id) * 0.8; vx = (ux - uy * s) * spd; vy = (uy + ux * s) * spd; break; }
        case "ranged": case "summoner": case "orbit": {
          const want = MB.range * 0.8;
          if (m.ai === "orbit") { const a = Math.atan2(-dy, -dx) + 0.9 * dt * 2; const tx = P.x + Math.cos(a) * want, ty = P.y + Math.sin(a) * want; const ex = tx - m.x, ey = ty - m.y, el = Math.hypot(ex, ey) || 1; vx = ex / el * spd; vy = ey / el * spd; }
          else if (dist > want + 30) { vx = ux * spd; vy = uy * spd; } else if (dist < want - 60) { vx = -ux * spd * 0.7; vy = -uy * spd * 0.7; } else { vx = -uy * spd * 0.4 * (m.id % 2 ? 1 : -1); vy = ux * spd * 0.4 * (m.id % 2 ? 1 : -1); }
          m.cd -= dt; const sh = MB.shot;
          if (m.cd <= 0 && dist < MB.range + 60) { m.cd = sh.cd * (0.85 + this.rng() * 0.3);
            const burst = sh.burst || 1; for (let k = 0; k < burst; k++) this.enemyShot(m, m.face + (k - (burst - 1) / 2) * 0.12, sh.spd, sh.dmg * (m.dmg / MB.dmg), sh.kind, sh.st);
            if (m.ai === "summoner" && m.kids < 6 && this.mons.length < this.party.cap) { for (let k = 0; k < 2; k++) { const c = this.spawnMon(MB.summon, m.x + (k ? 20 : -20), m.y, { summoned: true, hpMul: 0.7 }); if (c) { c.parent = m.id; m.kids++; } } } }
          break; }
        case "lunge": { if (m.phase === 0) { vx = ux * spd; vy = uy * spd; if (dist < 150 && m.cd <= 0) { m.phase = 1; m.pt = 0.35; m.lx = ux; m.ly = uy; } m.cd -= dt; } else if (m.phase === 1) { m.pt -= dt; if (m.pt <= 0) { m.phase = 2; m.pt = 0.3; } } else { vx = m.lx * spd * 3.4; vy = m.ly * spd * 3.4; m.pt -= dt; if (m.pt <= 0) { m.phase = 0; m.cd = 1.6; } } break; }
        case "charge": { if (m.phase === 0) { vx = ux * spd; vy = uy * spd; m.cd -= dt; if (dist < 380 && m.cd <= 0) { m.phase = 1; m.pt = 0.7; m.lx = ux; m.ly = uy; this.ev.push({ k: "tele", x: Math.round(m.x), y: Math.round(m.y), a: +Math.atan2(uy, ux).toFixed(2), len: 420, w: 34, t: 0.7 }); } }
          else if (m.phase === 1) { m.pt -= dt; if (m.pt <= 0) { m.phase = 2; m.pt = 0.55; } } else { vx = m.lx * spd * 5.2; vy = m.ly * spd * 5.2; m.pt -= dt; if (m.pt <= 0) { m.phase = 0; m.cd = 2.5; } } break; }
        case "bomber": { if (m.phase === 0) { vx = ux * spd; vy = uy * spd; if (dist < 70) { m.phase = 1; m.pt = 1; this.ev.push({ k: "fuse", x: Math.round(m.x), y: Math.round(m.y), r: 78, t: 1 }); } } else { m.pt -= dt; if (m.pt <= 0) { for (const Q of this.alivePlayers()) if (d2(Q.x, Q.y, m.x, m.y) < (78 + Q.r) ** 2) this.hurtPlayer(Q, m.dmg, { k: "haz", src: m }); this.ev.push({ k: "boom", x: Math.round(m.x), y: Math.round(m.y), r: 78, c: 10 }); m.hp = 0; m.dead = true; this.dropGem(m.x, m.y, m.xp); } } break; }
        case "tank": { vx = ux * spd; vy = uy * spd; m.cd -= dt; if (m.phase === 0 && dist < 120 && m.cd <= 0) { m.phase = 1; m.pt = 0.9; this.haz.push({ id: this.hazSeq++, k: "circle", x: m.x, y: m.y, r: 110, warn: 0.9, life: 1.1, dmg: m.dmg * 1.3, src: m, kb: 300 }); } if (m.phase === 1) { vx = vy = 0; m.pt -= dt; if (m.pt <= 0) { m.phase = 0; m.cd = 3.5; } } break; }
        case "shield": { vx = ux * spd; vy = uy * spd; break; }
        case "blink": { vx = ux * spd; vy = uy * spd; m.cd -= dt; if (m.cd <= 0 && dist > 100 && dist < 460) { m.cd = 3.2; const fx = m.x, fy = m.y; m.x = P.x - ux * 70 + (this.rng() - 0.5) * 40; m.y = P.y - uy * 70 + (this.rng() - 0.5) * 40; this.pushOut(m); this.ev.push({ k: "mblink", x: Math.round(fx), y: Math.round(fy), x2: Math.round(m.x), y2: Math.round(m.y) }); } break; }
        case "stealth": { vx = ux * spd; vy = uy * spd; m.alpha = dist < 130 ? 1 : 0.12; break; }
        case "spore": { vx = ux * spd; vy = uy * spd; m.cd -= dt; if (m.cd <= 0 && dist < 200) { m.cd = 4.5; this.haz.push({ id: this.hazSeq++, k: "circle", x: m.x, y: m.y, r: 70, warn: 0.6, life: 0.8, dmg: m.dmg * 0.6, src: m, after: { dur: 3.5, dps: m.dmg * 0.5, st: "poison", fx: "spore" } }); } break; }
        case "phase": { m.spdUp = Math.min(2, (m.spdUp || 1) + dt * 0.08); vx = ux * spd * m.spdUp; vy = uy * spd * m.spdUp; break; }
        default: {
          let ax = ux, ay = uy;
          if (MB.flank && dist > 90) { const s = m.id % 2 ? 0.6 : -0.6; ax = ux - uy * s; ay = uy + ux * s; const l = Math.hypot(ax, ay); ax /= l; ay /= l; }
          vx = ax * spd; vy = ay * spd;
        }
      }
      // 서로 밀어내기 (같은 칸 후보만, 최대 6마리)
      if (!m.fly && m.ai !== "phase") { let sx = 0, sy = 0, c = 0; this.near(m.x, m.y, m.r + 8, (o) => { if (o === m || o.boss || c > 6) return; const ex = m.x - o.x, ey = m.y - o.y, l = Math.hypot(ex, ey) || 0.1, ov = m.r + o.r - l; if (ov > 0) { sx += ex / l * ov; sy += ey / l * ov; c++; } }); vx += sx * 6; vy += sy * 6; }
      // 화염 정령 불길
      if (MB.trail && (m.trailT = (m.trailT || 0) - dt) <= 0) { m.trailT = 0.9; this.haz.push({ id: this.hazSeq++, k: "pool", x: m.x, y: m.y, r: 26, warn: 0, life: 2.2, dmg: m.dmg * 0.4, st: "burn", acc: 0, fx: "fire" }); }
      m.x += (vx + m.kx) * dt; m.y += (vy + m.ky) * dt; m.kx *= 0.6; m.ky *= 0.6;
      if (m.fly || m.ai === "phase") { m.x = clamp(m.x, 10, MAP.w - 10); m.y = clamp(m.y, 10, MAP.h - 10); } else this.pushOut(m);
      // 몸통 박치기 (사람마다 0.5초 간격)
      if (!stopped && m.ai !== "bomber") for (const Q of this.P.values()) {
        if (Q.state !== "alive") continue; const rr = m.r + Q.r; if (d2(Q.x, Q.y, m.x, m.y) > rr * rr) continue;
        const k = m.id, nt = Q.contact.get(k) || 0; if (nt > t) continue; Q.contact.set(k, t + 0.5); if (Q.contact.size > 400) Q.contact.clear();
        const dmg = m.dmg * (this.monBuff > t ? 1.25 : 1) * (m.rally > t ? 1.3 : 1) * (m.ai === "stealth" && m.alpha < 1 ? 1.5 : 1);
        const got = this.hurtPlayer(Q, dmg, { k: "contact", src: m, melee: true });
        const hs = MB.hitSt; if (hs && got > 0) this.stPlayer(Q, hs, hs === "slow" ? 1.5 : undefined);
        if (got > 0 && MB.aura === "chill") { Q.flags.chill = (Q.flags.chill || 0) + 1; if (Q.flags.chill >= 4) { Q.flags.chill = 0; this.stPlayer(Q, "freeze", 0.6); } }
      }
    }
  }
  monStatus(m, dt) {
    for (const k in m.st) {
      const s = m.st[k]; s.t -= dt;
      const S = STATUS[k];
      if (S.dot) { s.acc += dt; if (s.acc >= 0.5) { s.acc -= 0.5; const P = this.lastHitter(m); const dmg = S.dot * s.pow * 0.5 * (s.n || 1); if (P) this.hitMon(P, m, dmg, { kind: "dot" }); else { m.hp -= dmg; } if (m.hp <= 0) return; } }
      if (s.t <= 0) { delete m.st[k]; if (S.immune) m.imm[k] = this.t + S.immune; }
    }
  }
  lastHitter(m) { let best = null, bd = Infinity; for (const P of this.P.values()) { const d = d2(P.x, P.y, m.x, m.y); if (d < bd) { bd = d; best = P; } } return best; }
  enemyShot(m, a, spd, dmg, kind, st) {
    if (this.eshots.length > 500) return;
    this.eshots.push({ x: m.x, y: m.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, a, r: kind === "boss" ? 11 : 8, dmg, life: 3.2, kind: ESHOT_KIND[kind] || 5, st: st || null, src: m, bounce: 0 });
  }
  updEShots(dt) {
    const es = this.eshots;
    for (let i = es.length - 1; i >= 0; i--) {
      const s = es[i]; const ox = s.x, oy = s.y; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let dead = s.life <= 0 || s.x < 0 || s.y < 0 || s.x > MAP.w || s.y > MAP.h;
      if (!dead) for (const P of this.P.values()) { if (P.state !== "alive") continue; if (segHit(ox, oy, s.x, s.y, P.x, P.y, P.r + s.r)) { const before = P.hp + P.shield; this.hurtPlayer(P, s.dmg, { k: "shot", src: s.src }); if (P.hp + P.shield < before && s.st) this.stPlayer(P, s.st); if (s.chain && s.chain > 0) { const nx = [...this.P.values()].find(Q => Q !== P && Q.state === "alive" && d2(Q.x, Q.y, P.x, P.y) < 320 * 320); if (nx) { const a = Math.atan2(nx.y - P.y, nx.x - P.x); s.x = P.x + Math.cos(a) * 30; s.y = P.y + Math.sin(a) * 30; s.vx = Math.cos(a) * 380; s.vy = Math.sin(a) * 380; s.chain--; s.life = 1.2; break; } } dead = true; break; } }
      if (dead) { es[i] = es[es.length - 1]; es.pop(); }
    }
  }
  // ---------- 보스 ----------
  spawnBoss(id) {
    const B = BOSSES[id]; if (!B) return;
    const ps = this.alivePlayers(); const P = ps[0]; const a = this.wrng() * Math.PI * 2;
    const pos = this.freeSpot(clamp(P.x + Math.cos(a) * 420, 80, MAP.w - 80), clamp(P.y + Math.sin(a) * 420, 80, MAP.h - 80), B.r);
    const hp = B.hp * this.D.bossHp * this.party.boss * 1.8 * (1 + this.bossIdx * 0.75) * (this.kind === "pvp" ? 1.5 : 1);
    const m = { id: this.monSeq = (this.monSeq % 65000) + 1, type: id, tc: BOSS_TYPE[id], boss: true, bossId: id, x: pos.x, y: pos.y, r: B.r, hp, maxHp: hp, dmg: B.dmg * this.D.dmg * this.party.dmg * (1 + this.bossIdx * 0.25), spd: B.spd, xp: 0, st: {}, imm: {}, kx: 0, ky: 0, def: 15 + this.bossIdx * 10, dr: 0,
      phase: 1, patT: 2.5, lastPat: "", tgt: null, tgtT: 0, face: 0, hurt: 0, inv: 1.5, act: null, scale: 1, enraged: false, kbImmune: true, alpha: 1, spawnedAt: this.t, final: this.bossIdx === 2 };
    this.mons.push(m); this.boss = m;
    this.gev.push({ k: "boss", id, final: m.final ? 1 : 0, n: this.bossIdx + 1 });
  }
  updBoss(dt) {
    const m = this.boss, t = this.t, B = BOSSES[m.bossId];
    if (m.dead || m.hp <= 0) { return; }
    if (m.hurt > 0) m.hurt -= dt; if (m.inv > 0) m.inv -= dt;
    this.monStatus(m, dt); if (m.hp <= 0) { this.killMon(m, this.lastHitter(m)); return; }
    // 페이즈 (70%·35%)
    const pct = m.hp / m.maxHp, want = pct <= 0.35 ? 3 : pct <= 0.7 ? 2 : 1;
    if (want > m.phase) { m.phase = want; m.inv = 1; m.patT = 1.6; m.act = null; this.gev.push({ k: "bphase", p: want, id: m.bossId }); if (m.bossId === "slimeking") this.bossPattern(m, "split"); }
    // 최종 보스 시간 초과 광폭화 (등장 후 4분)
    if (m.final && !m.enraged && t - m.spawnedAt > 240 / Math.max(1, this.ts * 0.6)) { m.enraged = true; this.gev.push({ k: "enrage" }); }
    const freq = this.D.bossFreq * (m.phase === 3 ? 1.35 : m.phase === 2 ? 1.15 : 1) * (m.enraged ? 1.4 : 1);
    m.tgtT -= dt; if (m.tgtT <= 0 || !m.tgt || m.tgt.state !== "alive") { const ps = this.alivePlayers(); m.tgt = ps.length ? ps[(this.rng() * ps.length) | 0] : null; m.tgtT = 6; }
    const P = m.tgt; if (!P) return;
    const dx = P.x - m.x, dy = P.y - m.y, dist = Math.hypot(dx, dy) || 1; m.face = Math.atan2(dy, dx);
    // 진행 중인 동작 (점프·돌진·순간이동)
    if (m.act) {
      const A = m.act; A.t -= dt;
      if (A.k === "dash") { if (A.t < A.dur) { m.x += A.ux * A.spd * dt; m.y += A.uy * A.spd * dt; this.pushOut(m); for (const Q of this.alivePlayers()) if (d2(Q.x, Q.y, m.x, m.y) < (m.r + Q.r + 10) ** 2) this.hurtPlayer(Q, m.dmg * 1.2, { k: "haz", src: m }); } }
      if (A.k === "jump") { m.untarget = true; if (A.t <= 0) { m.x = A.x; m.y = A.y; m.untarget = false; } }
      if (A.k === "tp") { m.alpha = 0.15; if (A.t <= 0) { m.x = A.x; m.y = A.y; m.alpha = 1; this.pushOut(m); } }
      if (A.t <= 0) { m.act = null; m.untarget = false; m.alpha = 1; if (A.then) A.then(); }
      return;
    }
    // 걷기
    const spd = m.spd * (1 - (m.st.slow ? m.st.slow.v : 0)) * (m.giant > t ? 0.8 : 1) * (m.enraged ? 1.2 : 1);
    if (!m.st.stun) { if (dist > m.r + 40) { m.x += dx / dist * spd * dt; m.y += dy / dist * spd * dt; this.pushOut(m); } }
    // 몸통
    for (const Q of this.alivePlayers()) { const rr = m.r * (m.giant > t ? 1.4 : 1) + Q.r; if (d2(Q.x, Q.y, m.x, m.y) < rr * rr) { const nt = Q.contact.get(m.id) || 0; if (nt <= t) { Q.contact.set(m.id, t + 0.7); this.hurtPlayer(Q, m.dmg * (m.giant > t ? 1.3 : 1) * (m.enraged ? 1.5 : 1), { k: "contact", src: m, melee: true }); } } }
    if (m.st.stun) return;
    m.patT -= dt * freq;
    if (m.patT <= 0) {
      const list = B.pats[m.phase - 1]; let pat = list[(this.rng() * list.length) | 0]; if (pat === m.lastPat) pat = list[(list.indexOf(pat) + 1) % list.length];
      m.lastPat = pat; m.patT = 2.6 + this.rng() * 0.8; // 패턴 사이 쉬는 시간 (피할 틈 보장)
      this.bossPattern(m, pat);
      this.gev.push({ k: "bpat", p: pat });
    }
  }
  bossPattern(m, pat) {
    const t = this.t, ps = this.alivePlayers(), P = m.tgt || ps[0]; if (!P) return;
    const dmg = m.dmg * (m.enraged ? 1.5 : 1), R = this.rng.bind(this), W = (ph) => (ph === 3 ? 0.75 : 0.9); // 예고 시간
    const warn = W(m.phase), face = Math.atan2(P.y - m.y, P.x - m.x);
    const circ = (x, y, r, w, d, o = {}) => this.haz.push({ id: this.hazSeq++, k: "circle", x, y, r, warn: w, life: w + 0.3, dmg: d, src: m, ...o });
    const line = (x, y, a, len, wd, w, d, o = {}) => this.haz.push({ id: this.hazSeq++, k: "line", x, y, a, len, w: wd, warn: w, life: w + 0.3, dmg: d, src: m, ...o });
    const cone = (x, y, a, arc, r, w, d, o = {}) => this.haz.push({ id: this.hazSeq++, k: "cone", x, y, a, arc, r, warn: w, life: w + 0.3, dmg: d, src: m, ...o });
    const ring = (spd, w, d, o = {}) => this.haz.push({ id: this.hazSeq++, k: "ring", x: m.x, y: m.y, r0: m.r, r: m.r, spd, w, warn: 0.7, life: 0.7 + 2.2, dur0: 2.2, dmg: d, src: m, ...o });
    const pool = (x, y, r, dur, d, st, fx) => this.haz.push({ id: this.hazSeq++, k: "pool", x, y, r, warn: 0.6, life: 0.6 + dur, dmg: d, st, src: m, fx, acc: 0 });
    const bullets = (n, spd, kind, st, off = 0, d = dmg * 0.55) => { for (let k = 0; k < n; k++) this.enemyShot(m, off + k * Math.PI * 2 / n, spd, d, kind, st); };
    const summon = (type, n, hpMul = 1) => { for (let k = 0; k < n && this.mons.length < this.party.cap + 30; k++) { const a = k / n * Math.PI * 2; const c = this.spawnMon(type, m.x + Math.cos(a) * (m.r + 40), m.y + Math.sin(a) * (m.r + 40), { summoned: true, hpMul }); if (c) c.inv = 0.6; } };
    const atPlayers = (fn) => { for (const Q of ps) fn(Q); };
    switch (pat) {
      // 슬라임 킹
      case "jump": case "jump2": { const hops = pat === "jump2" ? 3 : 1; const doHop = (k) => { const Q = ps[(R() * ps.length) | 0] || P; const tx = Q.x, ty = Q.y; circ(tx, ty, 120, 1.1, dmg * 1.3, { kb: 260 }); m.act = { k: "jump", t: 1.1, x: tx, y: ty, then: k + 1 < hops ? () => doHop(k + 1) : () => { pool(tx, ty, 90, 4, dmg * 0.3, "slow", "slime"); } }; }; doHop(0); break; }
      case "pool": for (let k = 0; k < 4; k++) pool(P.x + (R() - 0.5) * 360, P.y + (R() - 0.5) * 360, 80, 6, dmg * 0.3, "slow", "slime"); break;
      case "shock": ring(260, 34, dmg * 0.9); break;
      case "shock2": ring(260, 34, dmg * 0.9); this.haz.push({ id: this.hazSeq++, k: "ring", x: m.x, y: m.y, r0: m.r, r: m.r, spd: 300, w: 34, warn: 1.6, life: 1.6 + 2.2, dur0: 2.2, dmg: dmg * 0.9, src: m }); break;
      case "split": summon("slime", 6, 2.5); break;
      // 고블린 군주
      case "summon": summon("goblin", 5, 1.5); break;
      case "summon2": summon("goblin", 5, 1.5); summon("bomber", 3, 1.2); break;
      case "bombs": case "bombs2": { const n = pat === "bombs2" ? 9 : 5; for (let k = 0; k < n; k++) { const Q = ps[k % ps.length]; circ(Q.x + (R() - 0.5) * 220, Q.y + (R() - 0.5) * 220, 70, 1 + k * 0.08, dmg * 0.9, { st: "burn" }); } break; }
      case "charge": case "charge2": case "dash": {
        const times = pat === "charge2" ? 3 : 1, go = (k) => { const Q = m.tgt && m.tgt.state === "alive" ? m.tgt : ps[0]; if (!Q) return; const a = Math.atan2(Q.y - m.y, Q.x - m.x); line(m.x, m.y, a, 620, m.r * 2, warn, 0); m.act = { k: "dash", t: warn + 0.55, dur: 0.55, ux: Math.cos(a), uy: Math.sin(a), spd: 1050, then: k + 1 < times ? () => go(k + 1) : (pat === "dash" ? () => pool(m.x, m.y, 100, 4, dmg * 0.4, "burn", "fire") : null) }; };
        go(0); break; }
      case "rally": this.near(m.x, m.y, 520, (o) => { if (!o.boss) { o.rally = t + 8; } }); this.ev.push({ k: "rally", x: m.x, y: m.y, r: 520 }); break;
      // 거미 여왕
      case "webfan": case "webfan2": { const n = pat === "webfan2" ? 18 : 9; for (let k = 0; k < n; k++) this.enemyShot(m, face + (k - (n - 1) / 2) * (pat === "webfan2" ? 0.34 : 0.16), 280, dmg * 0.5, "web", "slow"); break; }
      case "poisonpool": atPlayers((Q) => pool(Q.x, Q.y, 90, 5, dmg * 0.35, "poison", "poison")); break;
      case "eggs": for (let k = 0; k < 4; k++) circ(m.x + (R() - 0.5) * 400, m.y + (R() - 0.5) * 400, 30, 3, 0, { spawn: { type: "spider", n: 2, hpMul: 1.2 }, egg: 1 }); break;
      case "grab": atPlayers((Q) => { const a = Math.atan2(Q.y - m.y, Q.x - m.x); line(m.x, m.y, a, 560, 44, 1, dmg * 0.6, { pull: true, st: "stun", stT: 0.8 }); }); break;
      // 화염 드래곤
      case "breath": cone(m.x, m.y, face, 1.1, 360, warn, dmg * 1.2, { st: "burn" }); break;
      case "breath2": for (let k = 0; k < 3; k++) cone(m.x, m.y, face + (k - 1) * 0.9, 0.9, 380, warn + k * 0.45, dmg * 1.1, { st: "burn" }); break;
      case "meteor": case "meteor2": { const n = pat === "meteor2" ? 12 : 6; for (let k = 0; k < n; k++) { const Q = ps[k % ps.length]; circ(Q.x + (R() - 0.5) * 300, Q.y + (R() - 0.5) * 300, 85, 1.1 + k * 0.12, dmg * 1.1, { st: "burn", after: { dur: 2.5, dps: dmg * 0.25, st: "burn", fx: "fire", r: 70 } }); } break; }
      case "firefloor": for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pool(m.x + Math.cos(a) * 200, m.y + Math.sin(a) * 200, 90, 5, dmg * 0.4, "burn", "fire"); } break;
      // 얼음 여왕
      case "frostnova": ring(240, 40, dmg * 0.8, { st: "freeze", stT: 0.9 }); break;
      case "frostnova2": ring(240, 40, dmg * 0.8, { st: "freeze", stT: 0.9 }); this.haz.push({ id: this.hazSeq++, k: "ring", x: m.x, y: m.y, r0: m.r, r: m.r, spd: 240, w: 40, warn: 2, life: 2 + 2.2, dur0: 2.2, dmg: dmg * 0.8, src: m, st: "slow", stT: 2 }); break;
      case "icespears": case "icespears2": { const n = pat === "icespears2" ? 3 : 1; atPlayers((Q) => { for (let k = 0; k < n; k++) { const a = Math.atan2(Q.y - m.y, Q.x - m.x) + (k - (n - 1) / 2) * 0.35; line(m.x, m.y, a, 700, 40, warn + k * 0.2, dmg, { st: "slow", stT: 2 }); } }); break; }
      case "icewall": { // 막지 않게 플레이어에서 떨어진 곳에, 틈 있게
        for (let k = 0; k < 3; k++) { const a = R() * Math.PI * 2, cx = P.x + Math.cos(a) * 240, cy = P.y + Math.sin(a) * 240, pa = a + Math.PI / 2; for (let j = -2; j <= 2; j++) { const w = { x: cx + Math.cos(pa) * j * 46, y: cy + Math.sin(pa) * j * 46, r: 24, until: t + 6 }; if (ps.some(Q => d2(Q.x, Q.y, w.x, w.y) < 70 * 70)) continue; this.walls.push(w); } }
        this.gev.push({ k: "walls", w: this.walls.map(w => [Math.round(w.x), Math.round(w.y), w.r]) }); break; }
      case "blizzard": this.haz.push({ id: this.hazSeq++, k: "zone", x: m.x, y: m.y, r: 380, warn: 1.2, life: 1.2 + 4.5, dmg: dmg * 0.25, st: "slow", src: m, fx: "blizzard", acc: 0 }); break;
      // 번개 골렘
      case "strikes": case "strikes2": { const n = pat === "strikes2" ? 16 : 8; for (let k = 0; k < n; k++) { const Q = ps[k % ps.length]; circ(Q.x + (R() - 0.5) * 420, Q.y + (R() - 0.5) * 420, 60, 0.9 + (k % 4) * 0.25, dmg * 0.9, { st: "shock", fx: "strike" }); } break; }
      case "elecfloor": for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) if ((gx + gy) % 2 === 0) pool(m.x + gx * 130, m.y + gy * 130, 60, 2.2, dmg * 0.5, "shock", "elec"); break;
      case "chainbolt": { const s = { x: m.x, y: m.y, vx: Math.cos(face) * 380, vy: Math.sin(face) * 380, a: face, r: 14, dmg: dmg * 0.8, life: 2.6, kind: ESHOT_KIND.bolt, st: "shock", src: m, chain: 3 }; this.eshots.push(s); break; }
      // 그림자 사신
      case "teleport": case "teleport2": { const times = pat === "teleport2" ? 3 : 1; const go = (k) => { const Q = ps[(R() * ps.length) | 0] || P; const a = Math.atan2(Q.y - m.y, Q.x - m.x), tx = Q.x + Math.cos(a) * 60, ty = Q.y + Math.sin(a) * 60; circ(tx, ty, 120, 0.8, dmg * 1.2); m.act = { k: "tp", t: 0.8, x: tx, y: ty, then: k + 1 < times ? () => go(k + 1) : null }; }; go(0); break; }
      case "scythe": cone(m.x, m.y, face, 3.5, 190, warn, dmg * 1.2, { st: "bleed" }); break;
      case "scythe2": cone(m.x, m.y, face, 6.3, 210, warn, dmg * 1.1, { st: "bleed" }); cone(m.x, m.y, face, 6.3, 330, warn + 0.7, dmg * 0.9); break;
      case "clones": for (let k = 0; k < 2; k++) { const a = k * Math.PI + face; const c = { id: this.monSeq = (this.monSeq % 65000) + 1, type: m.bossId, tc: m.tc, decoy: true, x: m.x + Math.cos(a) * 160, y: m.y + Math.sin(a) * 160, r: m.r * 0.8, hp: m.maxHp * 0.04, maxHp: m.maxHp * 0.04, dmg: dmg * 0.4, spd: m.spd, xp: 0, st: {}, imm: {}, kx: 0, ky: 0, def: 0, dr: 0, ai: "ranged", cd: 1, until: t + 12, alpha: 0.75, kbImmune: true, tgtT: 0, phase: 0, face: 0, hurt: 0, inv: 0 }; this.pushOut(c); this.mons.push(c); c.ai = "decoy"; } break;
      case "darkness": this.darkUntil = t + 6; this.gev.push({ k: "dark", d: 6 }); break;
      // 기계 군주
      case "laser": case "laser2": { const n = pat === "laser2" ? 2 : 1; for (let k = 0; k < n; k++) this.haz.push({ id: this.hazSeq++, k: "laser", x: m.x, y: m.y, a: face + k * Math.PI, spin: 0.9 * (k ? -1 : 1), len: 640, w: 30, warn: 1.1, life: 1.1 + 3.5, dmg: dmg * 0.18, src: m, acc: 0 }); break; }
      case "drones": summon("mdrone", 4, 1.3); break;
      case "missiles": case "missiles2": { const n = pat === "missiles2" ? 4 : 2; atPlayers((Q) => { for (let k = 0; k < n; k++) circ(Q.x + (R() - 0.5) * 80, Q.y + (R() - 0.5) * 80, 75, 1.2 + k * 0.45, dmg * 0.9); }); break; }
      case "barrier": m.barrier = t + 5; this.gev.push({ k: "barrier", d: 5 }); break;
      // 도깨비 대왕
      case "club": case "club2": { const n = pat === "club2" ? 3 : 1; for (let k = 0; k < n; k++) { const Q = ps[(R() * ps.length) | 0] || P; circ(Q.x, Q.y, 140, 1 + k * 0.6, dmg * 1.4, { kb: 300, fx: "club" }); } break; }
      case "talisman": bullets(16, 230, "talisman", "curse", R()); break;
      case "talisman2": for (let k = 0; k < 3; k++) bullets(16, 220 + k * 30, "talisman", "curse", k * 0.2); break;
      case "giant": m.giant = t + 8; this.gev.push({ k: "giant", d: 8 }); break;
      // 공허의 지배자
      case "blackhole": case "blackhole2": this.haz.push({ id: this.hazSeq++, k: "blackhole", x: P.x + (R() - 0.5) * 200, y: P.y + (R() - 0.5) * 200, r: pat === "blackhole2" ? 420 : 300, pullF: pat === "blackhole2" ? 120 : 90, warn: 1, life: 1 + 4.5, dmg: dmg * 0.6, src: m, acc: 0 }); break;
      case "rift": case "rift2": { const n = pat === "rift2" ? 5 : 3; for (let k = 0; k < n; k++) { const a = R() * Math.PI; const Q = ps[k % ps.length]; line(Q.x - Math.cos(a) * 400, Q.y - Math.sin(a) * 400, a, 800, 46, 1.1 + k * 0.25, dmg * 1.1, { st: "curse" }); } break; }
      case "mix": { const pick = ["meteor", "strikes", "icespears", "talisman", "breath", "missiles"][(R() * 6) | 0]; this.bossPattern(m, pick); return; }
    }
  }
  bossDown(m, P) {
    this.boss = null; this.bossesKilled++; this.bossIdx++;
    for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; this.dropGem(m.x + Math.cos(a) * (40 + k * 3), m.y + Math.sin(a) * (40 + k * 3), 6); }
    // 남은 부하·분신 정리, 보상
    for (const o of this.mons) if (o.decoy) { o.dead = true; o.hp = 0; }
    for (const h of this.haz) if (!h.friendly) h.life = 0; // 보스 장판 정리 (목록은 updHaz에서 지움)
    this.eshots.length = 0; this.walls.length = 0;
    const mvp = [...this.P.values()].sort((a, b) => b.bossDmg - a.bossDmg)[0];
    this.gev.push({ k: "bossdown", id: m.bossId, n: this.bossesKilled, mvp: mvp ? mvp.idx : -1, final: m.final ? 1 : 0 });
    for (const Q of this.P.values()) { if (Q.state === "dead" && (this.kind === "coop" || this.kind === "team")) this.revive(Q, 0.5, null); if (Q.state === "down") this.revive(Q, 0.5, null); if (Q.state === "alive") { this.giveEvo(Q); this.heal(Q, Q.maxHp * 0.3); if (this.aug && !m.final) this.offerAug(Q); } }
    if (m.final) this.finish("win");
  }
  giveEvo(P) {
    const can = P.weapons.find(w => !w.evo && w.lv >= MAX_WEAPON_LV && (P.passives[WEAPONS[w.id].need] || 0) >= 1);
    if (can) { can.evo = WEAPONS[can.id].evo; can.t = 0.2; can.hits.clear(); this.ev.push({ k: "evolve", i: P.idx, w: can.evo, x: P.x, y: P.y }); this.gev.push({ k: "evo", i: P.idx, w: can.evo }); }
    else { P.evoTokens = Math.min(3, P.evoTokens + 1); this.gainXp(P, P.xpNext * 0.5); this.ev.push({ k: "chest", i: P.idx, x: P.x, y: P.y }); }
  }
  // ---------- 고르기 (레벨업·증강) ----------
  offerLevel(P) {
    const opts = [];
    const pool = [];
    for (const w of P.weapons) if (!w.evo && w.lv < MAX_WEAPON_LV) pool.push({ t: "w", id: w.id, lv: w.lv + 1, wt: 5 });
    if (P.weapons.length < MAX_WEAPONS) for (const id of WEAPON_IDS) if (!P.weapons.some(w => w.id === id)) pool.push({ t: "w", id, lv: 1, wt: 1.4 });
    for (const id of PASSIVE_IDS) { const lv = P.passives[id] || 0; if (lv < MAX_PASSIVE_LV) pool.push({ t: "p", id, lv: lv + 1, wt: 1.6 + (P.weapons.some(w => WEAPONS[w.id].need === id && w.lv >= 3 && !lv) ? 3 : 0) }); }
    // 가진 무기 강화는 (있으면) 꼭 1장 — 무기가 안 크는 판을 막음
    const up = pool.filter(o => o.t === "w" && o.lv > 1); if (up.length) { const o = up[(this.rng() * up.length) | 0]; opts.push(o); pool.splice(pool.indexOf(o), 1); }
    for (let k = opts.length; k < 3 && pool.length; k++) { let tot = 0; for (const o of pool) tot += o.wt; let r = this.rng() * tot, pi = 0; for (let i = 0; i < pool.length; i++) { r -= pool[i].wt; if (r <= 0) { pi = i; break; } } opts.push(pool[pi]); pool.splice(pi, 1); }
    if (!opts.length) { this.heal(P, P.maxHp * 0.15); return; } // 다 키웠으면 창 없이 회복만 (혼자 할 때 자꾸 멈추지 않게)
    this.pushPick(P, "lvl", opts.map(o => ({ ...o, id: o.t + ":" + o.id })));
  }
  offerAug(P, first = false) {
    if (P.augs.length >= MAX_AUGS) { this.heal(P, P.maxHp * 0.25); this.gainXp(P, P.xpNext * 0.4); this.ev.push({ k: "augfull", i: P.idx }); return; }
    if (P.pend.some(p => p.kind === "aug")) { P.augQueue = (P.augQueue || 0) + 1; return; }
    const legends = P.augs.filter(id => AUG[id].r === "legendary").length;
    const pool = AUGS.filter(a => !P.augs.includes(a.id) && !(a.r === "legendary" && (first || legends >= MAX_LEGEND)));
    const out = [], list = pool.slice();
    for (let k = 0; k < 3 && list.length; k++) { let tot = 0; for (const a of list) tot += RARITY_W[a.r]; let r = this.rng() * tot, pi = list.length - 1; for (let i = 0; i < list.length; i++) { r -= RARITY_W[list[i].r]; if (r <= 0) { pi = i; break; } } out.push({ id: list[pi].id }); list.splice(pi, 1); }
    if (out.length) this.pushPick(P, "aug", out);
  }
  pushPick(P, kind, opts) {
    const multi = this.humanCount() > 1 && this.kind !== "versus";
    const n = P.pendSeq++, until = this.t + (kind === "aug" ? 20 : 12);
    P.pend.push({ n, kind, opts, until, multi });
    this.out("pick", { n, kind, opts, ms: Math.round((until - this.t) * 1000), multi }, P.id);
  }
  humanCount() { let c = 0; for (const P of this.P.values()) if (!P.bot || P.wasHuman) c++; return c; }
  // 화면에서 고름 — 서버가 낸 후보 안에서만
  pick(pid, n, id) {
    const P = this.P.get(pid); if (!P) return { ok: false, error: "NO_PLAYER" };
    const i = P.pend.findIndex(p => p.n === n); if (i < 0) return { ok: false, error: "NO_OFFER" };
    const p = P.pend[i]; const o = p.opts.find(x => x.id === id); if (!o) return { ok: false, error: "BAD_PICK" };
    P.pend.splice(i, 1);
    this.applyPick(P, p.kind, o);
    if (p.kind === "aug" && P.augQueue > 0) { P.augQueue--; this.offerAug(P); }
    return { ok: true };
  }
  applyPick(P, kind, o) {
    if (kind === "aug") {
      if (P.augs.includes(o.id) || P.augs.length >= MAX_AUGS) return;
      P.augs.push(o.id); if (o.id === "a05") { this.recalc(P); P.hp = Math.min(P.maxHp, P.hp + AUG.a05.v.hp); }
      for (const s of SYNERGIES) if (!P.syn.has(s.id) && s.req.every(r => P.augs.includes(r))) { P.syn.add(s.id); this.ev.push({ k: "syn", i: P.idx, s: s.id, x: P.x, y: P.y }); this.gev.push({ k: "syn", i: P.idx, s: s.id }); }
      this.ev.push({ k: "aug", i: P.idx, a: o.id, x: P.x, y: P.y }); if (AUG[o.id].r === "legendary") this.gev.push({ k: "legend", i: P.idx, a: o.id });
    } else {
      const [t, id] = o.id.split(":");
      if (t === "w") { const w = P.weapons.find(x => x.id === id); if (w) { if (!w.evo && w.lv < MAX_WEAPON_LV) w.lv++; } else if (P.weapons.length < MAX_WEAPONS && WEAPONS[id]) P.weapons.push({ id, lv: 1, evo: null, t: 0.3, hits: new Map(), ang: 0 }); }
      else if (t === "p") { if (PASSIVES[id]) P.passives[id] = Math.min(MAX_PASSIVE_LV, (P.passives[id] || 0) + 1); }
      else if (t === "h") this.heal(P, P.maxHp * 0.3);
      else if (t === "g") this.gainXp(P, 0);
      // 진화 상자를 들고 있었으면 조건이 맞는 순간 진화
      if (P.evoTokens > 0) { const can = P.weapons.find(w => !w.evo && w.lv >= MAX_WEAPON_LV && (P.passives[WEAPONS[w.id].need] || 0) >= 1); if (can) { P.evoTokens--; can.evo = WEAPONS[can.id].evo; can.hits.clear(); this.ev.push({ k: "evolve", i: P.idx, w: can.evo, x: P.x, y: P.y }); this.gev.push({ k: "evo", i: P.idx, w: can.evo }); } }
    }
    this.recalc(P);
  }
  // 시간 초과는 정해진 규칙으로: 레벨업 = 첫 후보, 증강 = 희귀도 높은 것 (같으면 첫 번째)
  autoPick(P, p) {
    let o = p.opts[0];
    if (p.kind === "aug") { const rank = { common: 0, rare: 1, epic: 2, legendary: 3 }; for (const x of p.opts) if (rank[AUG[x.id].r] > rank[AUG[o.id].r]) o = x; }
    this.pick(P.id, p.n, o.id); this.out("autopicked", { n: p.n, id: o.id, kind: p.kind }, P.id);
  }
  checkPicks() {
    // 혼자(사람 1명)면 고르는 동안 멈춤 · 여럿이면 안 멈추고 시간 초과에 자동
    const solo = this.humanCount() <= 1;
    let anyPending = false;
    for (const P of this.P.values()) {
      if (P.state === "dead" && P.pend.length) { P.pend.length = 0; continue; } // 죽은 사람에겐 고르기 없음
      for (const p of [...P.pend]) {
        if (P.bot) { if (P.bot === "smart") this.botPick(P, p); else this.autoPick(P, p); continue; }
        if (solo) { anyPending = true; if (!p.wall) p.wall = Date.now() + (p.kind === "aug" ? 30000 : 25000); if (Date.now() > p.wall) this.autoPick(P, p); }
        else if (this.t >= p.until) this.autoPick(P, p);
      }
    }
    this.paused = solo && anyPending;
  }
  // 시험 봇: 사람처럼 고르기 (가진 무기 강화 > 진화 재료 > 새 무기(3개까지) > 생존 능력)
  botPick(P, p) {
    let best = p.opts[0], bs = -1;
    for (const o of p.opts) {
      let sc = 0;
      if (p.kind === "aug") sc = { common: 1, rare: 2, epic: 3, legendary: 4 }[AUG[o.id].r] + (SYNERGIES.some(s => s.req.includes(o.id) && s.req.some(r => P.augs.includes(r))) ? 3 : 0);
      else { const [t, id] = o.id.split(":"); if (t === "w") sc = P.weapons.some(w => w.id === id) ? 10 + o.lv : P.weapons.length < 3 ? 7 : 2; else if (t === "p") sc = P.weapons.some(w => WEAPONS[w.id].need === id && !P.passives[id]) ? 9 : ({ vit: 5, armor: 5, regen: 4, might: 4, agi: 4, magnet: 3 }[id] || 2); }
      if (sc > bs) { bs = sc; best = o; }
    }
    this.pick(P.id, p.n, best.id);
  }
  // ---------- 끝 ----------
  checkEnd() {
    if (this.status !== "play") return;
    const anyAlive = [...this.P.values()].some(P => P.state === "alive"); // 모두 쓰러지면 (일으켜 줄 사람이 없으니) 패배
    if (!anyAlive) this.finish("lose");
    else if (this.t > this.len + 600) this.finish("timeout"); // 마지막 보스를 못 잡고 버티기만 하면 끝없이 이어지지 않게 (정한 시간 + 10분)
  }
  finish(res) {
    if (this.status !== "play") return;
    this.status = "ended"; this.result = res; this.endT = this.t;
    for (const P of this.P.values()) P.score = this.scoreOf(P);
    this.gev.push({ k: "wend", r: res });
    this.o.onEnd?.(this, res);
  }
  scoreOf(P) { return Math.round(P.kills * 10 + P.bossDmg / 20 + P.aliveT * 2 + P.lvl * 25 + this.bossesKilled * 400 + (this.result === "win" ? 3000 : 0)); }
  // ---------- 보내기 (관심 영역만) ----------
  // 사람마다: JSON(작은 것) + 바이너리(몬스터·투사체·보석)
  // vw = { hw, hh } 그 사람 화면 크기(반) + 여유 · known = 이미 보낸 장판 id (새로 생긴 것만 전체 정보, 나머지는 id만)
  view(P, cx, cy, vw, known) {
    const hw = vw?.hw || VIEW.hw, hh = vw?.hh || VIEW.hh;
    const x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh, inV = (x, y, pad = 0) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;
    // 몬스터 12바이트: id u16, type u8, flags u8, x i16, y i16, hp u8, alpha u8, face i8, r u8
    const mon = [];
    const gx0 = clamp((x0 / GRID) | 0, 0, GW - 1), gx1 = clamp((x1 / GRID) | 0, 0, GW - 1), gy0 = clamp((y0 / GRID) | 0, 0, GH - 1), gy1 = clamp((y1 / GRID) | 0, 0, GH - 1);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) for (const m of this.grid[gy * GW + gx]) if (m.hp > 0 && !m.boss) mon.push(m);
    if (this.boss) mon.push(this.boss);
    for (const m of this.mons) if (m.decoy && inV(m.x, m.y, 200) && !mon.includes(m)) mon.push(m);
    const shots = [], es = [], gems = [];
    for (const s of this.shots) if (inV(s.x, s.y, 40)) { shots.push(s); if (shots.length >= 260) break; }
    for (const s of this.eshots) if (inV(s.x, s.y, 40)) { es.push(s); if (es.length >= 200) break; }
    for (const g of this.gems) if (inV(g.x, g.y, 20)) { gems.push(g); if (gems.length >= 240) break; }
    const nm = Math.min(mon.length, 400), buf = new ArrayBuffer(8 + nm * 12 + shots.length * 6 + es.length * 6 + gems.length * 5), dv = new DataView(buf);
    dv.setUint16(0, nm, true); dv.setUint16(2, shots.length, true); dv.setUint16(4, es.length, true); dv.setUint16(6, gems.length, true);
    let o = 8; const t = this.t;
    for (let i = 0; i < nm; i++) {
      const m = mon[i]; let f = 0;
      if (m.elite) f |= 1; if (m.st.freeze) f |= 2; if (m.st.burn) f |= 4; if (m.st.poison) f |= 8; if (m.st.shock) f |= 16; if (m.st.slow) f |= 32; if (m.st.stun) f |= 64; if (m.hurt > 0) f |= 128;
      dv.setUint16(o, m.id, true); dv.setUint8(o + 2, m.decoy ? 50 + (m.tc - 20) : m.tc); dv.setUint8(o + 3, f); dv.setInt16(o + 4, Math.round(m.x), true); dv.setInt16(o + 6, Math.round(m.y), true);
      dv.setUint8(o + 8, Math.max(0, Math.min(255, Math.ceil(m.hp / m.maxHp * 255)))); dv.setUint8(o + 9, Math.round((m.alpha ?? 1) * 255) | (m.phase === 1 && (m.ai === "charge" || m.ai === "lunge") ? 0 : 0));
      dv.setInt8(o + 10, Math.round((m.face || 0) / Math.PI * 127)); dv.setUint8(o + 11, Math.min(255, Math.round(m.r * (m.giant > t ? 1.4 : 1)))); o += 12;
    }
    for (const s of shots) { dv.setUint8(o, s.wt); dv.setInt16(o + 1, Math.round(s.x), true); dv.setInt16(o + 3, Math.round(s.y), true); dv.setInt8(o + 5, Math.round(Math.atan2(s.vy, s.vx) / Math.PI * 127)); o += 6; }
    for (const s of es) { dv.setUint8(o, s.kind); dv.setInt16(o + 1, Math.round(s.x), true); dv.setInt16(o + 3, Math.round(s.y), true); dv.setInt8(o + 5, Math.round(Math.atan2(s.vy, s.vx) / Math.PI * 127)); o += 6; }
    for (const g of gems) { dv.setInt16(o, Math.round(g.x), true); dv.setInt16(o + 2, Math.round(g.y), true); dv.setUint8(o + 4, g.v >= 30 ? 3 : g.v >= 8 ? 2 : g.v >= 3 ? 1 : 0); o += 5; }
    // JSON 쪽: 플레이어·장판·아이템·소환물·화면 효과(관심 영역)
    const pl = []; for (const Q of this.P.values()) pl.push(this.pubP(Q));
    const hz = [], ha = []; for (const h of this.haz) if (inV(h.x, h.y, (h.r || h.len || 100) + 40)) { const moving = h.follow || h.move || h.k === "laser" || h.k === "ring"; ha.push(h.id); if (known && known.has(h.id) && !moving) continue; if (known) known.add(h.id); hz.push([h.id, HZ_KIND[h.k] ?? 0, Math.round(h.x), Math.round(h.y), Math.round(h.r || 0), +(h.a || 0).toFixed(2), +Math.max(0, h.warn).toFixed(2), h.friendly ? 1 : 0, h.len ? Math.round(h.len) : 0, h.w ? Math.round(h.w) : 0, h.arc ? +h.arc.toFixed(2) : 0, h.fx || "", +h.life.toFixed(2)]); if (hz.length > 80) break; }
    if (known && known.size > 2000) { const keep = new Set(ha); for (const id of known) if (!keep.has(id)) known.delete(id); }
    const it = this.items.filter(i => inV(i.x, i.y, 30)).map(i => [i.id, i.k, i.x, i.y]);
    const en = []; for (const e of this.ents) if (inV(e.x, e.y, 60)) en.push([e.id, e.k, Math.round(e.x), Math.round(e.y), this.P.get(e.owner)?.idx ?? 0, +(e.a || 0).toFixed(2)]);
    // 피해 숫자(내 것만)·죽음은 숫자 배열로 (객체 수백 개를 JSON으로 보내지 않게)
    const ev = [], hx = [], dx = []; for (const e of this.ev) { if (e.k === "hit") { if (e.i === P?.idx && hx.length < 200) hx.push(e.x, e.y, e.d, e.c); continue; } if (e.k === "die") { if (inV(e.x, e.y, 40) && dx.length < 300) dx.push(e.x, e.y, e.t, e.e | (e.b ? 2 : 0)); continue; } if (inV(e.x ?? cx, e.y ?? cy, 160) && ev.length < 80) ev.push(e); }
    const j = { t: +this.t.toFixed(2), p: pl, h: hz, ha: known ? ha : undefined, it, en, ev, hx: hx.length ? hx : undefined, dx: dx.length ? dx : undefined, g: this.gev.length ? this.gev : undefined, tg: this.teamGauge, tm: this.teamMax(), dk: this.darkUntil > this.t ? 1 : 0 };
    if (this.boss) { const b = this.boss; j.b = [b.bossId, Math.round(b.hp), Math.round(b.maxHp), b.phase, b.barrier > this.t ? 1 : 0, b.enraged ? 1 : 0, b.giant > this.t ? 1 : 0]; }
    const dn = []; for (let i = 0; i < nm; i++) { const m = mon[i]; if (m.donor || m.invaderName) dn.push([m.id, m.donor ? "🎁 " + m.donor : "⚔ " + m.invaderName]); } if (dn.length) j.dn = dn;
    if (this.walls.length) j.w = this.walls.map(w => [Math.round(w.x), Math.round(w.y), w.r]);
    return { j, buf };
  }
  pubP(Q) {
    let f = 0; if (Q.state === "alive") f |= 1; if (Q.state === "down") f |= 2; if (Q.state === "dead") f |= 4; if (Q.iframes > 0) f |= 8; if (Q.dashT > 0) f |= 16; if (Q.buffs.smoke > this.t) f |= 32; if (Q.flags.absShield) f |= 64; if (Q.buffs.golden > this.t) f |= 128; if (Q.st.freeze) f |= 256; if (Q.st.stun) f |= 512; if (Q.flags.berserk) f |= 1024; if (Q.buffs.fate > this.t) f |= 2048; if (Q.buffs.holy > this.t || Q.buffs.sanct > this.t) f |= 4096; if (Q.buffs.overload > this.t) f |= 8192; if (Q.buffs.team > this.t) f |= 16384;
    const orb = Q.weapons.filter(w => w.R).map(w => [WEAP_TYPE[w.evo || w.id], Math.round(w.R), w.n]);
    return [Q.idx, Math.round(Q.x), Math.round(Q.y), Math.round(Q.hp), Math.round(Q.maxHp), Math.round(Q.shield), f, Q.lvl, CHAR_IDS.indexOf(Q.char), +Q.aim.toFixed(2), Q.in.seq, +Q.revProg.toFixed(2), orb, Q.augs.includes("a18") ? 1 + (Q.syn.has("s5") ? 2 : 0) : 0, Q.buffs.dance > this.t ? 1 : 0, Q.weapons.filter(w => w.id === "drone").reduce((a, w) => a + (w.evo ? 5 : WEAPONS.drone.n[w.lv - 1]), 0), Q.team, Math.round(Q.stats?.spd || 0), Q.kills, Math.round(Q.dmg)];
  }
  // 내 정보 (바뀔 때만 보냄)
  hud(P) {
    const t = this.t;
    return { lv: P.lvl, xp: Math.floor(P.xp), xn: P.xpNext, w: P.weapons.map(w => [w.id, w.lv, w.evo || ""]), ps: P.passives, a: P.augs, s: [...P.syn], ev: P.evoTokens,
      cd: [Math.max(0, +P.dashCd.toFixed(1)), Math.max(0, +P.qCd.toFixed(1)), Math.max(0, +P.eCd.toFixed(1))], k: P.kills, d: Math.round(P.dmg), st: Object.keys(P.st), rv: 3 - P.revives,
      b: Object.entries(P.buffs).filter(([, v]) => v > t).map(([k, v]) => [k, +(v - t).toFixed(1)]), ac: Object.fromEntries(Object.entries(P.at).map(([k, v]) => [k, Math.max(0, +(v - t).toFixed(0))])), abs: P.flags.absShield ? 1 : 0, sc: this.scoreOf(P), pk: P.pend.map(p => ({ n: p.n, kind: p.kind, opts: p.opts, multi: this.humanCount() > 1 })) };
  }
}
const NOMON = { range: 300, dmg: 1 };
const HZ_KIND = { circle: 1, line: 2, cone: 3, ring: 4, pool: 5, zone: 6, blackhole: 7, laser: 8, gravity: 9 };
export const HZ_KINDS = HZ_KIND;
