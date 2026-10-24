// ⚠ 자동 복사본 — 고치려면 홈페이지 제작/fight/engine.js 를 고치고 sync-fight-engine.js 실행
// =========================
// 플듀 파이터 — 1:1 격투 판정 엔진 (60fps 고정 프레임, 결정적)
// 같은 입력 → 같은 결과. 화면(DOM)·난수에 의존하지 않아 나중에 온라인 동기화(입력만 주고받기)에 그대로 쓴다.
//   const m = createMatch({ p1:'hanbit', p2:'yuna', training:false });
//   step(m, [input1, input2]);   input = {u,d,l,r,lp,hp,lk,hk,sp} (0/1)
//   m.ev : 이번 프레임에 일어난 일(그림·소리용)
// =========================
import { CHARS } from "./chars.js";
import { CFG } from "./config.js";

export const STAGE_HALF = 640;
export const MAX_SEP = 720;
const GRAV = 0.95, JUMP_VY = 18.5, PUSH_W = 62;
const JUG_MAX = CFG.combo.juggleMax;
const NEUTRAL = new Set(["idle", "walkF", "walkB", "crouch"]);
const BTNS = ["lp", "hp", "lk", "hk", "sp", "pa"];

export const emptyInput = () => ({ u: 0, d: 0, l: 0, r: 0, lp: 0, hp: 0, lk: 0, hk: 0, sp: 0, pa: 0 });

function mkFighter(idx, id, alt) {
  const ch = CHARS[id];
  return {
    idx, id, ch, alt: !!alt, x: idx ? 180 : -180, y: 0, vx: 0, vy: 0, face: idx ? -1 : 1,
    hp: ch.hp, maxHp: ch.hp, meter: 0, st: "idle", t: 0, mv: null, mvId: null, mf: 0, hitDone: 0, connected: 0, chain: 0,
    stun: 0, inv: 0, armor: 0, armorUsed: 0, combo: 0, comboDmg: 0, juggle: 0, jdir: 5, dashDir: 0, landRec: 0,
    hist: [], press: { lp: -99, hp: -99, lk: -99, hk: -99, sp: -99, pa: -99 }, prev: emptyInput(), inp: emptyInput(), dir: 5, prevDir: 5,
    grabbed: -1, holdBy: -1, techT: 0, alpha: 1, rot: 0, hitLv: "mid", blockLow: 0, counter: 0, idleT: 0, airAtk: 0,
    // 2.0 방어: 가드 입력 시작 프레임, 패링(서기/앉기), 패링 끝난 프레임(재사용 대기), 통계(평평한 숫자 — 스냅샷 복사 안전)
    guardAt: -99, parryLow: 0, parryEnd: -999, sPaTry: 0, sPaOk: 0, sPaWhiff: 0, sPaLast: -1, sPg: 0, sBlock: 0,
    // 2.0 각성: 남은 프레임, 이번 라운드 사용 여부, 슈퍼아머(여러 대 버팀)
    awakeT: 0, awakeUsed: 0, superArmor: 0,
    // 2.0 콤보·버스트: 시전 번호(같은 기술 반복 판정), 받은 콤보의 기술 기록(문자열 — 스냅샷 안전), 마지막 보정률·원본피해, 버스트
    mvInst: 0, superSeq: 0, comboSeq: "", lastInst: -1, lastScale: 1, lastRaw: 0, lastDmg: 0, burstUsed: 0, burstFailAt: -999,
  };
}

export function createMatch(o = {}) {
  const m = {
    frame: 0, round: 1, wins: [0, 0], need: o.training ? 99 : 2, timer: 99, tick: 0, phase: "intro", phaseT: 0,
    hitstop: 0, flash: 0, flashIdx: -1, slow: 0, shake: 0, projs: [], ev: [], winner: -1, roundWinner: -1, sim: 0,
    training: !!o.training, dummy: o.dummy || "stand", infMeter: !!o.infMeter,
    f: [mkFighter(0, o.p1 || "hanbit", 0), mkFighter(1, o.p2 || "yuna", (o.p1 || "hanbit") === (o.p2 || "yuna"))],
  };
  if (m.training) { m.phase = "fight"; m.timer = 99; }
  return m;
}

function resetRound(m) {
  for (const f of m.f) {
    const keepMeter = f.meter;
    Object.assign(f, mkFighter(f.idx, f.id, f.alt));
    f.meter = keepMeter;
  }
  m.projs = []; m.timer = 99; m.tick = 0; m.phase = "intro"; m.phaseT = 0; m.hitstop = 0; m.flash = 0; m.slow = 0; m.roundWinner = -1;
}

// ===== 입력 =====
function dirOf(inp, face) {
  const fwd = face > 0 ? inp.r : inp.l, back = face > 0 ? inp.l : inp.r;
  const h = fwd && !back ? 1 : back && !fwd ? -1 : 0, v = inp.u ? 1 : inp.d ? -1 : 0;
  return v === 1 ? (h === 1 ? 9 : h === -1 ? 7 : 8) : v === -1 ? (h === 1 ? 3 : h === -1 ? 1 : 2) : (h === 1 ? 6 : h === -1 ? 4 : 5);
}
function readInput(m, f, inp) {
  f.inp = inp;
  f.prevDir = f.dir;
  f.dir = dirOf(inp, f.face);
  f.hist.push(f.dir); if (f.hist.length > 40) f.hist.shift();
  for (const b of BTNS) if (inp[b] && !f.prev[b]) f.press[b] = m.frame;
  const isBack = (d) => d === 4 || d === 1 || d === 7;
  if (isBack(f.dir) && !isBack(f.prevDir)) f.guardAt = m.frame;   // 퍼펙트 가드: 가드를 "새로" 시작한 프레임
  f.prev = { ...inp };
}
const pressed = (m, f, b, win = 6) => m.frame - f.press[b] <= win;
const consume = (f, ...bs) => { for (const b of bs) f.press[b] = -99; };
function cmd(f, seq, win = 15) {
  let k = seq.length - 1;
  for (let i = f.hist.length - 1, lim = Math.max(0, f.hist.length - win); i >= lim && k >= 0; i--) if (f.hist[i] === seq[k]) k--;
  return k < 0;
}

// ===== 상태 도우미 =====
const grounded = (f) => f.y <= 0 && f.st !== "air" && f.st !== "juggle" && f.st !== "fall" && !(f.st === "move" && f.mv?.air && f.y > 0);
const firstHitF = (mv) => (mv?.hits?.length ? mv.hits[0].f : mv?.proj?.length ? mv.proj[0].f : mv?.grab ? mv.grab.f : 999);

function toNeutral(f) {
  f.st = f.dir <= 3 ? "crouch" : "idle"; f.t = 0; f.mv = null; f.mvId = null; f.vx = 0; f.armor = 0; f.alpha = 1; f.rot = 0; f.inv = Math.max(0, f.inv);
}
function startMove(m, f, id) {
  const mv = f.ch.moves[id];
  if (!mv) return false;
  if (mv.projOne && m.projs.some((p) => p.o === f.idx && p.kind === mv.proj[0].kind)) return false;   // 같은 발사체는 한 번에 하나
  if (mv.rank === "U") { const cost = superCost(f); if (f.meter < cost && !m.infMeter) return false; f.meter = m.infMeter ? 100 : f.meter - cost; m.flash = 30; m.flashIdx = f.idx; m.ev.push({ type: "super", who: f.idx, x: f.x, y: f.y }); }
  if (f.mv && f.st === "move" && (mv.rank === "L") && f.mv.rank === "L") f.chain++; else f.chain = 0;
  f.st = "move"; f.mv = mv; f.mvId = id; f.mf = 0; f.t = 0; f.hitDone = 0; f.connected = 0; f.armorUsed = 0; f.counter = 0; f.mvInst++;
  f.superSeq = mv.rank === "U" ? 1 : 0;   // 초필살 연출 중(초필살에서 이어지는 잡기 포함)
  if (!mv.air && !mv.vel) f.vx = 0;
  if (mv.rank === "A") f.airAtk = 1;
  m.ev.push({ type: "swing", who: f.idx, rank: mv.rank, id });
  return true;
}

// ===== 2.0 각성 도우미(원본 기술 정의는 건드리지 않고 계산할 때만 보정) =====
const AW = CFG.awaken;
const awake = (f) => f.awakeT > 0;
const awk = (f) => AW.chars[f.id] || {};
export const superCost = (f) => (awake(f) ? AW.superCost : 100);
function canAwaken(f) { return !f.awakeUsed && f.awakeT <= 0 && f.hp > 0 && f.hp <= f.maxHp * AW.hpRatio; }
const recCut = (f) => (awake(f) && awk(f).recCut ? awk(f).recCut[f.mvId] || 0 : 0);

// ===== 조작 해석 =====
function canCancelInto(f, rank) {
  if (f.st !== "move" || !f.connected || f.mv.nocancel) return false;
  const r = f.mv.rank;
  if (r === "L") return rank === "L" ? f.chain < 3 : rank === "H" || rank === "S" || rank === "U";
  if (r === "H") return rank === "S" || rank === "U";
  if (r === "S") return rank === "U" && f.mv.superCancel;
  return false;
}
function tryAct(m, f, o) {
  const free = NEUTRAL.has(f.st) || f.st === "land" && f.t >= 2;
  const air = f.st === "air";
  const inCancel = f.st === "move" && f.connected;
  if (!free && !air && !inCancel) return false;
  const can = (rank) => free ? true : inCancel ? canCancelInto(f, rank) : false;
  const P = (b) => pressed(m, f, b);
  const meterOk = f.meter >= superCost(f) || m.infMeter;

  if (!air) {
    // 초필살: 필살+강손 동시 / ↓↘→↓↘→+손
    if (meterOk && can("U") && ((P("sp") && P("hp")) || ((P("lp") || P("hp")) && (cmd(f, [2, 3, 6, 2, 3, 6], 34) || cmd(f, [2, 6, 2, 6], 30))))) {
      if (startMove(m, f, "su")) { consume(f, "sp", "hp", "lp"); return true; }
    }
    // 잡기: 약손+약발
    if (free && P("lp", 4) && P("lk", 4)) { consume(f, "lp", "lk"); return startMove(m, f, "throw"); }
    // 필살기: 필살 버튼+방향 또는 커맨드
    if (can("S")) {
      let id = null;
      if (P("sp")) { id = f.dir <= 3 ? "sp3" : (f.dir === 6 || f.dir === 9) ? "sp2" : "sp1"; consume(f, "sp"); }
      else if ((P("lp") || P("hp")) && (cmd(f, [6, 2, 3], 16) || cmd(f, [6, 3, 2, 3], 16))) { id = "sp3"; consume(f, "lp", "hp"); }
      else if ((P("lp") || P("hp")) && cmd(f, [2, 3, 6], 16)) { id = "sp1"; consume(f, "lp", "hp"); }
      else if ((P("lk") || P("hk")) && cmd(f, [2, 1, 4], 16)) { id = "sp2"; consume(f, "lk", "hk"); }
      if (id && startMove(m, f, id)) return true;
    }
  }
  // 기본기
  for (const b of ["hk", "hp", "lk", "lp"]) {
    if (!P(b)) continue;
    let id;
    if (air) { if (f.airAtk) continue; id = "j" + b; }
    else id = (f.dir <= 3 ? "c" : "s") + b;
    const mv = f.ch.moves[id];
    if (!mv) continue;
    if (!air && !can(mv.rank)) continue;
    consume(f, b);
    if (air) {   // 점프 중 공격: 점프 궤도 유지
      const vx = f.vx, vy = f.vy;
      startMove(m, f, id); f.vx = vx; f.vy = vy;
    } else startMove(m, f, id);
    return true;
  }
  return false;
}

function tryBurst(m, f, o) {
  const B = CFG.burst;
  // 두 버튼을 inputWin 안에 같이 누르고, 그게 bufferWin 안이면 인정(히트스톱 동안 눌러도 됨)
  if (!(pressed(m, f, "pa", B.bufferWin) && pressed(m, f, "hp", B.bufferWin) && Math.abs(f.press.pa - f.press.hp) <= B.inputWin)) return false;
  const inCombo = (f.st === "hit" || f.st === "juggle") && f.combo >= 1 && f.hp > 0;
  if (!inCombo) return false;
  consume(f, "pa", "hp");
  const banned = f.burstUsed >= B.perRound || (o.st === "move" && (o.mv?.rank === "U" || o.superSeq)) || o.grabbed === f.idx;
  if (banned) {   // 쓸 수 없음: 자원은 안 씀, 알림만(너무 자주 안 뜨게)
    if (m.frame - f.burstFailAt > B.failCool) { f.burstFailAt = m.frame; m.ev.push({ type: "burstFail", who: f.idx, x: f.x, y: f.y + 100 }); }
    return true;
  }
  f.burstUsed++;
  resetCombo(f);
  f.st = "burst"; f.t = 0; f.vx = 0; f.vy = f.y > 0 ? 2 : 0; f.inv = 1; f.mv = null; f.mvId = null; f.alpha = 1; f.rot = 0;
  // 상대는 밀려나며 경직(공중이면 떨어짐)
  o.mv = null; o.mvId = null; o.armor = 0; o.connected = 0;
  if (o.y > 0) { o.st = "juggle"; o.vy = 5; o.t = 0; o.vx = Math.sign(o.x - f.x || o.face * -1) * B.pushVx * 0.6; }
  else { o.st = "hit"; o.stun = B.attackerStun; o.t = 0; o.hitLow = 0; o.hitLv = "mid"; o.vx = Math.sign(o.x - f.x || -f.face) * B.pushVx; }
  m.projs = m.projs.filter((p) => p.o !== o.idx || p.fixed);   // 날아오던 상대 발사체 지움
  m.hitstop = Math.max(m.hitstop, B.stop); m.shake = Math.max(m.shake, 10);
  m.ev.push({ type: "burst", who: f.idx, x: f.x, y: f.y + 90 });
  return true;
}

function control(m, f, o) {
  if (m.phase !== "fight") return;
  if ((f.st === "hit" || f.st === "juggle") && tryBurst(m, f, o)) return;
  // 각성: 필살+패링 동시(체력 25% 이하, 라운드당 1번). 자유로운 상태에서만
  if ((NEUTRAL.has(f.st) || (f.st === "land" && f.t >= 2)) && f.y <= 0 && pressed(m, f, "sp", AW.inputWin) && pressed(m, f, "pa", AW.inputWin) && canAwaken(f)) {
    consume(f, "sp", "pa");
    f.awakeT = AW.dur; f.awakeUsed = 1; f.vx = 0;
    m.flash = AW.flash; m.flashIdx = f.idx;
    m.ev.push({ type: "awaken", who: f.idx, x: f.x, y: f.y });
    return;
  }
  // 패링: 별도 버튼. 땅에서 자유로운 상태일 때만, 실패 후 재사용 대기 중엔 안 나감
  const freeForParry = NEUTRAL.has(f.st) || (f.st === "land" && f.t >= 2);
  if (freeForParry && f.y <= 0 && pressed(m, f, "pa", CFG.parry.buffer) && m.frame - f.parryEnd >= CFG.parry.cooldown) {
    consume(f, "pa");
    f.st = "parry"; f.t = 0; f.vx = 0; f.parryLow = f.dir <= 3 ? 1 : 0; f.sPaTry++;
    m.ev.push({ type: "parryStart", who: f.idx, low: f.parryLow });
    return;
  }
  if (tryAct(m, f, o)) return;
  if (!NEUTRAL.has(f.st)) return;
  const d = f.dir;
  // 대시: →→ / ←←
  if (d === 6 && f.prevDir !== 6 && cmd(f, [6, 5, 6], 12)) { f.st = "dash"; f.dashDir = 1; f.t = 0; m.ev.push({ type: "dash", who: f.idx }); return; }
  if (d === 4 && f.prevDir !== 4 && cmd(f, [4, 5, 4], 12)) { f.st = "dash"; f.dashDir = -1; f.t = 0; m.ev.push({ type: "dash", who: f.idx }); return; }
  if (d >= 7) { f.st = "prejump"; f.t = 0; f.jdir = d; return; }
  if (d <= 3) { if (f.st !== "crouch") { f.st = "crouch"; f.t = 0; } f.vx = 0; return; }
  const wk = awake(f) && awk(f).walk ? awk(f).walk : 1;
  if (d === 6) { if (f.st !== "walkF") { f.st = "walkF"; f.t = 0; } f.vx = f.ch.walkF * wk * f.face; return; }
  if (d === 4) { if (f.st !== "walkB") { f.st = "walkB"; f.t = 0; } f.vx = -f.ch.walkB * wk * f.face; return; }
  if (f.st !== "idle") { f.st = "idle"; f.t = 0; } f.vx = 0;
}

// ===== 상태 진행 =====
function update(m, f, o) {
  f.t++;
  if (f.awakeT > 0) { f.awakeT--; if (f.awakeT === 0) m.ev.push({ type: "awakenEnd", who: f.idx }); }
  if (f.inv > 0 && !(f.st === "move" && f.mv?.inv)) f.inv--;
  switch (f.st) {
    case "idle": case "crouch": f.vx = 0; f.idleT++; break;
    case "walkF": case "walkB": f.x += f.vx; break;
    case "prejump":
      if (f.t >= 4) {
        f.st = "air"; f.t = 0; f.vy = JUMP_VY; f.airAtk = 0;
        f.vx = f.jdir === 9 ? f.ch.jumpF * f.face : f.jdir === 7 ? -f.ch.jumpB * f.face : 0;
        m.ev.push({ type: "jump", who: f.idx });
      }
      break;
    case "air": case "fall":
      f.vy -= GRAV; f.x += f.vx; f.y += f.vy;
      if (f.y <= 0) { f.y = 0; f.vy = 0; f.vx = 0; const rec = f.st === "fall" ? f.landRec : 3; f.st = "land"; f.t = 0; f.landRec = rec; f.airAtk = 0; m.ev.push({ type: "land", who: f.idx, x: f.x }); }
      break;
    case "land": if (f.t >= (f.landRec || 3)) toNeutral(f); break;
    case "dash": {
      const len = f.dashDir > 0 ? 18 : 20, k = 1 - f.t / len;
      const dk = awake(f) && awk(f).dash ? awk(f).dash : 1;
      f.vx = (f.dashDir > 0 ? f.ch.dash : -f.ch.dash * 0.85) * dk * Math.max(0.15, k) * f.face;
      f.x += f.vx;
      if (f.dashDir < 0 && f.t <= 7) f.inv = 1;
      if (f.t >= len) toNeutral(f);
      break;
    }
    case "move": updateMove(m, f, o); break;
    case "hit": case "block":
      f.x += f.vx; f.vx *= 0.82; f.stun--;
      if (f.stun <= 0) { toNeutral(f); if (f.st !== "move") resetCombo(f); }
      break;
    case "juggle":
      f.vy -= GRAV * 0.92; f.x += f.vx; f.y += f.vy;
      if (f.y <= 0 && f.vy < 0) {
        f.y = 0; f.vy = 0; f.vx = 0;
        if (f.hp <= 0) { f.st = "ko"; f.t = 0; } else { f.st = "kd"; f.t = 0; f.inv = 1; }
        m.ev.push({ type: "kd", who: f.idx, x: f.x }); m.shake = Math.max(m.shake, 6);
      }
      break;
    case "kd": f.inv = 1; if (f.t >= 38) { f.st = "getup"; f.t = 0; } break;
    case "getup": f.inv = 1; if (f.t >= 18) { toNeutral(f); f.inv = 3; resetCombo(f); } break;
    case "burst":   // 버스트 동작(무적) → 끝나면 땅이면 중립, 공중이면 낙하
      f.inv = 1; f.vx = 0;
      if (f.y > 0) { f.vy -= GRAV * 0.4; f.y = Math.max(0, f.y + f.vy); }
      if (f.t >= CFG.burst.invuln) { f.inv = 0; if (f.y > 0) { f.st = "fall"; f.t = 0; f.landRec = 2; } else toNeutral(f); }
      break;
    case "parry":   // 판정 중(누른 프레임 포함 active프레임). 넘기면 헛패링 → 회복 경직
      f.vx = 0;
      if (f.t > CFG.parry.active) { f.st = "parryRec"; f.t = 0; f.sPaWhiff++; m.ev.push({ type: "parryWhiff", who: f.idx }); }
      break;
    case "parryRec":
      if (f.t >= CFG.parry.whiffRec) { toNeutral(f); f.parryEnd = m.frame; }
      break;
    case "thrown":
      // 잡은 쪽이 놓쳤으면(맞았거나 끝남) 떨어뜨림
      if (o.grabbed !== f.idx) { f.st = "juggle"; f.vy = 4; f.vx = 0; f.rot = 0; f.holdBy = -1; }
      break;
    case "ko": case "win": case "lose": f.vx = 0; break;
  }
}
function resetCombo(f) { f.combo = 0; f.comboDmg = 0; f.juggle = 0; f.comboSeq = ""; f.lastInst = -1; }
/** 콤보 n타째 배율 */
export function comboScale(n, rank) {
  const T = CFG.scaling.table, v = T[Math.min(n, T.length) - 1] ?? 1;
  return rank === "U" ? Math.max(CFG.scaling.superMin, v) : v;
}

function updateMove(m, f, o) {
  const mv = f.mv, mf = ++f.mf;
  // 무적·아머·투명
  f.inv = mv.inv && mv.inv.some(([a, b]) => mf >= a && mf <= b) ? 1 : 0;
  f.armor = mv.armor && mv.armor.some(([a, b]) => mf >= a && mf <= b) ? 1 : 0;
  f.superArmor = 0;
  if (awake(f) && awk(f).armorMoves && awk(f).armorMoves.includes(f.mvId)) {
    const last = (mv.hits || []).reduce((a, h) => Math.max(a, h.f + h.n), 0);
    if (mf >= 1 && mf <= last) { f.armor = 1; f.superArmor = 1; }
  }
  if (mv.alpha) { let a = 1; for (let i = 0; i < mv.alpha.length - 1; i++) { const [f0, a0] = mv.alpha[i], [f1, a1] = mv.alpha[i + 1]; if (mf >= f0 && mf <= f1) a = a0 + (a1 - a0) * ((mf - f0) / Math.max(1, f1 - f0)); } f.alpha = a; }
  // 이동
  let moving = false;
  if (mv.vel) for (const [a, b, vx, vy] of mv.vel) if (mf >= a && mf <= b) { moving = true; f.vx = vx * f.face; if (vy != null && mf === a) f.vy = vy; }
  if (!moving && !mv.air && f.y <= 0) f.vx *= 0.75;
  if (mv.air || f.y > 0) {
    if (!(mv.hold && f.grabbed >= 0 && !mv.air)) { f.vy -= GRAV; f.y += f.vy; }
    if (f.y <= 0) {
      f.y = 0;
      if (mv.rank === "A") { f.vy = 0; f.vx = 0; f.st = "land"; f.t = 0; f.landRec = 4; f.mv = null; f.airAtk = 0; m.ev.push({ type: "land", who: f.idx, x: f.x }); return; }
      if (f.vy < 0 && mf > 4) { f.vy = 0; if (!mv.hold) { f.vx = 0; } }
    }
  }
  f.x += f.vx;
  // 순간이동
  if (mv.tele && mf === mv.tele) { f.x = clamp(o.x - o.face * 82, -STAGE_HALF + 30, STAGE_HALF - 30); f.face = Math.sign(o.x - f.x) || f.face; m.ev.push({ type: "tele", who: f.idx, x: f.x }); }
  // 발사체
  if (mv.proj) for (const p of mv.proj) if (p.f === mf) {
    let vx = p.vx, w = p.w, h = p.h, hits = p.hits, dx = p.dx;
    const A = awake(f) ? awk(f) : null;
    if (A && A.kiSpeed && p.kind === "orb") { vx *= A.kiSpeed; w *= A.kiSize; h *= A.kiSize; }
    if (A && A.beamLen && p.kind === "beam") { w *= A.beamLen; dx *= A.beamLen; }
    if (A && A.boltWide && p.kind === "bolt") { w *= A.boltWide; hits += A.boltHits || 0; }
    let x = f.x + dx * f.face;
    if (p.kind === "bolt") x = clamp(x, -STAGE_HALF + w / 2, STAGE_HALF - w / 2);   // 번개는 무대 안에서만
    m.projs.push({ o: f.idx, x, y: f.y + p.dy, dx, vx: vx * f.face, w, h, life: p.life, hits, cool: 0, gap: p.cool || 6, kind: p.kind, fixed: p.fixed, follow: p.follow, face: f.face, hit: p.hit, t: 0, aw: A ? 1 : 0 });
    m.ev.push({ type: "proj", who: f.idx, kind: p.kind, x, y: f.y + p.dy, aw: A ? 1 : 0 });
  }
  if (mv.shake && mf === firstHitF(mv)) m.shake = Math.max(m.shake, mv.shake);
  // 잡기 판정
  if (mv.grab && mf === mv.grab.f) tryGrab(m, f, o, mv.grab);
  // 잡은 상대 움직이기
  if (mv.hold && f.grabbed >= 0) holdVictim(m, f, m.f[f.grabbed], mv, mf);
  // 끝(유나 각성: 지정 기술 후딜 감소)
  if (mf >= mv.len - recCut(f)) {
    f.grabbed = -1;
    if (f.y > 0) { f.st = "fall"; f.t = 0; f.landRec = mv.landRec ?? 6; f.mv = null; f.alpha = 1; }
    else toNeutral(f);
  }
}

function holdVictim(m, f, v, mv, mf) {
  if (v.st !== "thrown") { f.grabbed = -1; return; }
  // 풀기(보통 잡기만): 잡힌 뒤 8프레임 안에 약손+약발
  if (v.techT > 0) {
    v.techT--;
    if (pressed(m, v, "lp", 4) && pressed(m, v, "lk", 4)) {
      consume(v, "lp", "lk");
      for (const w of [f, v]) { w.st = "hit"; w.stun = 14; w.vx = -w.face * 7; w.mv = null; w.rot = 0; }
      f.grabbed = -1; v.holdBy = -1;
      m.ev.push({ type: "tech", x: (f.x + v.x) / 2, y: 120 });
      return;
    }
  }
  const H = mv.hold;
  let a = H[0], b = H[H.length - 1];
  for (let i = 0; i < H.length - 1; i++) if (mf >= H[i][0] && mf <= H[i + 1][0]) { a = H[i]; b = H[i + 1]; break; }
  const k = b[0] > a[0] ? (mf - a[0]) / (b[0] - a[0]) : 0, L = (i) => a[i] + (b[i] - a[i]) * Math.max(0, Math.min(1, k));
  v.x = f.x + L(1) * f.face; v.y = Math.max(0, f.y + L(2)); v.rot = L(3); v.face = -f.face;
  if (mf === mv.release) {
    const dmg = mv.rdmg;
    v.hp = Math.max(m.training ? 1 : 0, v.hp - dmg); v.comboDmg += dmg; v.combo = Math.max(1, v.combo + 1);
    v.st = "juggle"; v.vx = mv.rvx * f.face; v.vy = mv.rvy; v.rot = 0; v.holdBy = -1; v.t = 0;
    f.grabbed = -1; f.meter = Math.min(100, f.meter + 12); v.meter = Math.min(100, v.meter + 8);
    m.hitstop = 14; m.shake = Math.max(m.shake, mv.shake || 10);
    m.ev.push({ type: "hit", who: v.idx, by: f.idx, x: v.x, y: v.y + 60, pow: 3, dmg, combo: v.combo, fx: "special", throw: 1 });
  }
}

function tryGrab(m, f, o, g) {
  const dx = Math.abs(o.x - f.x);
  // 경직(맞음·막음) 중이거나 공중·다운·무적이면 잡을 수 없음
  const bad = ["kd", "getup", "ko", "thrown", "juggle", "prejump", "air", "fall", "hit", "block"];
  if (dx > g.range || o.y > 0 || o.inv || bad.includes(o.st)) return;
  o.st = "thrown"; o.t = 0; o.mv = null; o.techT = g.tech ? 8 : 0; o.holdBy = f.idx; o.vx = 0; o.vy = 0;
  f.grabbed = o.idx;
  const fromSuper = f.mv?.rank === "U";
  const nxt = f.ch.moves[g.anim];
  f.mv = nxt; f.mvId = g.anim; f.mf = 0; f.hitDone = 0; f.connected = 1; f.superSeq = fromSuper ? 1 : 0;
  if (nxt.vel) f.vy = 0;
  m.ev.push({ type: "grab", who: f.idx, x: o.x, y: 100 });
}

// ===== 맞는 몸 =====
function hurtboxes(f) {
  if (f.inv > 0 || f.st === "kd" || f.st === "getup" || f.st === "ko" || f.st === "thrown" || f.st === "burst") return [];
  const crouch = f.st === "crouch" || ((f.st === "parry" || f.st === "parryRec") && f.parryLow) || (f.st === "block" && f.blockLow) || (f.st === "move" && f.mv?.crouch && (f.mf < (f.mv.hits?.[0]?.f ?? 0) || f.mvId === "chk" || f.mvId === "clk" || f.mvId === "clp")) || (f.st === "hit" && f.hitLow);
  const air = f.y > 0 || f.st === "juggle" || f.st === "air" || f.st === "fall";
  const sc = f.ch.body.scale;
  const boxes = [];
  if (air) boxes.push([f.x - 26 * sc, f.y + 10, f.x + 26 * sc, f.y + 150 * sc]);
  else if (crouch) boxes.push([f.x - 30 * sc, 0, f.x + 30 * sc, 104 * sc]);
  else boxes.push([f.x - 25 * sc, 0, f.x + 25 * sc, 166 * sc]);
  // 공격 중 뻗은 팔다리도 맞음(헛치면 반격당함)
  if (f.st === "move" && f.mv?.hits?.length && f.mf >= f.mv.hits[0].f && f.mv.rank !== "U") {
    const h = f.mv.hits[f.mv.hits.length - 1], b = h.b;
    const x0 = f.x + f.face * b[0] * 0.6, x1 = f.x + f.face * b[2] * 0.8;
    boxes.push([Math.min(x0, x1), f.y + b[1], Math.max(x0, x1), f.y + b[3]]);
  }
  return boxes;
}
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function canBlock(o, lv) {
  const back = o.dir === 4 || o.dir === 1 || o.dir === 7;
  const ok = o.st === "block" || ((NEUTRAL.has(o.st) || (o.st === "land" && o.t >= 2)) && back);
  if (!ok || o.y > 0) return false;
  const low = o.dir === 1 || (o.st === "block" && o.blockLow && o.dir <= 3);
  if (lv === "low" && !low) return false;
  if (lv === "over" && low) return false;
  return true;
}

function applyHit(m, A, D, h, proj) {
  const lv = h.lv || "mid";
  const cx = (A.x + D.x) / 2;
  // 패링: 판정 프레임 안 + 높이가 맞으면 공격 무효(피해·경직 없음), 수비 쪽은 바로 자유 → 반격 기회
  if (D.st === "parry" && D.t <= CFG.parry.active && D.y <= 0 && !h.unblock) {
    const okLv = D.parryLow ? (lv === "low" || lv === "mid") : lv !== "low";
    if (okLv) {
      const within = D.t;
      toNeutral(D); D.st = D.parryLow ? "crouch" : "idle";
      D.parryEnd = m.frame - CFG.parry.cooldown;   // 성공하면 연속 패링 바로 가능(다단 공격 대응)
      D.meter = Math.min(100, D.meter + CFG.parry.meter); D.sPaOk++; D.sPaLast = within;
      m.hitstop = Math.max(m.hitstop, CFG.parry.stop);
      m.ev.push({ type: "parry", who: D.idx, by: A.idx, x: D.x - A.face * 20, y: (h.b ? A.y + (h.b[1] + h.b[3]) / 2 : D.y + 100), f: within, proj: !!proj });
      return;
    }
  }
  if (!h.unblock && canBlock(D, lv)) {
    const perfect = m.frame - D.guardAt < CFG.pguard.window;
    D.st = "block"; D.stun = h.bs ?? 12; D.blockLow = D.dir <= 3 ? 1 : 0; D.mv = null; D.t = 0; D.sBlock++;
    if (perfect) {
      D.stun = Math.max(CFG.pguard.minStun, D.stun - CFG.pguard.stunCut);
      D.meter = Math.min(100, D.meter + CFG.pguard.meter); D.sPg++;
      m.ev.push({ type: "pguard", who: D.idx, by: A.idx, x: D.x - A.face * 18, y: (h.b ? A.y + (h.b[1] + h.b[3]) / 2 : D.y + 100) });
    }
    const chip = Math.round(h.dmg * (h.chip || 0));
    if (chip) D.hp = Math.max(A.mv?.rank === "U" || proj ? (m.training ? 1 : 0) : 1, D.hp - chip);
    D.vx = A.face * (h.kb ?? 4) * 1.15;
    if (Math.abs(D.x) > STAGE_HALF - 60 && !proj) A.vx = -A.face * (h.kb ?? 4) * 0.8;
    if (!proj) A.connected = 1;
    A.meter = Math.min(100, A.meter + Math.round(h.dmg * 0.04)); D.meter = Math.min(100, D.meter + Math.round(h.dmg * 0.06));
    m.hitstop = Math.max(m.hitstop, Math.max(4, (h.stop ?? 8) - 3));
    m.ev.push({ type: "block", who: D.idx, by: A.idx, lv, x: D.x - A.face * 18, y: (h.b ? A.y + (h.b[1] + h.b[3]) / 2 : D.y + 100), pow: h.fx === "light" ? 1 : 2 });
    return;
  }
  // 아머(어깨 돌진): 한 대는 버팀
  if (D.armor && (!D.armorUsed || D.superArmor) && !h.unblock && !(D.superArmor && A.mv?.rank === "U")) {
    D.armorUsed = 1; D.hp = Math.max(1, D.hp - Math.round(h.dmg * 0.5));
    m.hitstop = Math.max(m.hitstop, h.stop ?? 8);
    if (!proj) A.connected = 1;
    m.ev.push({ type: "armor", who: D.idx, x: D.x, y: D.y + 100 });
    return;
  }
  const airborne = D.y > 0 || D.st === "juggle" || D.st === "air" || D.st === "fall";
  if (D.st === "juggle" && D.juggle >= JUG_MAX) return;
  const counter = D.st === "move" && D.mf < firstHitF(D.mv);
  const inCombo = D.st === "hit" || D.st === "juggle";
  if (inCombo) D.combo++; else { resetCombo(D); D.combo = 1; }
  if (airborne) D.juggle += h.jug ?? 1;
  // 같은 기술 반복 제한: 새 시전일 때만 셈(다단히트는 1번)
  let breaker = false;
  if (!proj && A.mvId && A.mvInst !== D.lastInst) {
    D.lastInst = A.mvInst;
    D.comboSeq += A.mvId + ",";
    const used = D.comboSeq.split(",").filter((x) => x === A.mvId).length;
    if (used > CFG.combo.sameMoveMax) breaker = true;
  }
  const scale = comboScale(D.combo, A.mv?.rank);
  const awB = awake(A) ? 1 + AW.dmgBonus + (A.mv?.rank === "U" ? AW.superBonus : 0) : 1;
  const dmg = Math.max(CFG.scaling.minDmg, Math.round(h.dmg * scale * (counter ? 1.2 : 1) * awB));
  D.lastScale = scale; D.lastRaw = h.dmg; D.lastDmg = dmg;
  D.hp = Math.max(m.training ? 1 : 0, D.hp - dmg); D.comboDmg += dmg;
  if (!proj) A.connected = 1;
  if (A.mv?.rank !== "U") A.meter = Math.min(100, A.meter + Math.round(dmg * 0.1));
  D.meter = Math.min(100, D.meter + Math.round(dmg * 0.06));
  // 잡고 있던 상대는 그 자리에서 놓아줌(잡는 도중 번개 등에 맞은 경우)
  if (D.grabbed >= 0) { const v = m.f[D.grabbed]; if (v.st === "thrown") { v.st = "juggle"; v.vy = 4; v.vx = 0; v.rot = 0; v.holdBy = -1; v.t = 0; } }
  D.mv = null; D.mvId = null; D.armor = 0; D.alpha = 1; D.grabbed = -1;
  if (D.hp <= 0) {
    D.awakeT = 0;
    D.st = "juggle"; D.vy = 11; D.vx = A.face * 6.5; D.t = 0;
  } else if (breaker) {   // 같은 기술 반복 → 경직 없이 콤보 끊김(공중이면 떨어짐)
    if (airborne) { D.st = "juggle"; D.t = 0; D.vy = 2; D.vx = A.face * 3; D.juggle = JUG_MAX; }
    else { D.st = "hit"; D.t = 0; D.stun = 1; D.vx = A.face * (h.kb ?? 4); }
    m.ev.push({ type: "comboCut", who: D.idx, x: D.x, y: D.y + 120 });
  } else if (h.launch || airborne || h.kd) {
    // 공중 피격: 띄우는 힘이 추격 포인트마다 줄어듦(무한 공중 콤보 방지)
    const decay = airborne ? Math.max(CFG.combo.airDecayMin, 1 - CFG.combo.airDecay * D.juggle) : 1;
    D.st = "juggle"; D.t = 0; D.vy = (h.launch || (airborne ? 7 : 6)) * decay; D.vx = A.face * (h.kd ? 4.5 : 2.6);
  } else {
    D.st = "hit"; D.t = 0; D.stun = (h.hs ?? 16) + (counter ? 4 : 0); D.hitLow = D.dir <= 3 && D.y <= 0 ? 1 : 0; D.hitLv = lv;
    D.vx = A.face * (h.kb ?? 4);
    if (Math.abs(D.x) > STAGE_HALF - 60 && !proj) A.vx = -A.face * (h.kb ?? 4) * 0.9;
  }
  m.hitstop = Math.max(m.hitstop, (h.stop ?? 8) + (counter ? 3 : 0));
  if (h.fx !== "light") m.shake = Math.max(m.shake, h.fx === "special" ? 8 : 5);
  m.ev.push({ type: "hit", who: D.idx, by: A.idx, lv, scale, raw: h.dmg, mv: proj ? "proj" : A.mvId, x: cx, y: 0, pow: h.fx === "light" ? 1 : h.fx === "heavy" ? 2 : 3, dmg, combo: D.combo, counter, proj: !!proj });
}

function collectHits(m) {
  const out = [];
  for (const A of m.f) {
    if (A.st !== "move" || !A.mv.hits) continue;
    const D = m.f[1 - A.idx], hb = hurtboxes(D);
    if (!hb.length) continue;
    A.mv.hits.forEach((h, k) => {
      if (A.mf < h.f || A.mf >= h.f + h.n || (A.hitDone >> k) & 1) return;
      const sc = A.ch.body.scale;
      const x0 = A.x + A.face * h.b[0] * sc, x1 = A.x + A.face * h.b[2] * sc;
      const box = [Math.min(x0, x1), A.y + h.b[1] * sc, Math.max(x0, x1), A.y + h.b[3] * sc];
      const hurt = hb.find((b) => overlap(box, b));
      if (!hurt) return;
      out.push({ A, D, h, k, y: (Math.max(box[1], hurt[1]) + Math.min(box[3], hurt[3])) / 2, x: (Math.max(box[0], hurt[0]) + Math.min(box[2], hurt[2])) / 2 });
    });
  }
  for (const r of out) {
    r.A.hitDone |= 1 << r.k;
    const n0 = m.ev.length;
    applyHit(m, r.A, r.D, r.h, false);
    for (let i = n0; i < m.ev.length; i++) if (m.ev[i].type === "hit" || m.ev[i].type === "block") { m.ev[i].x = r.x; m.ev[i].y = r.y; }
  }
}

function updateProjs(m) {
  for (const p of m.projs) {
    p.t++; p.life--;
    const own = m.f[p.o];
    if (p.follow) { p.x = own.x + p.dx * p.face; }
    else if (!p.fixed) p.x += p.vx;
    if (p.cool > 0) p.cool--;
  }
  // 발사체끼리 상쇄
  for (const a of m.projs) for (const b of m.projs) {
    if (a === b || a.o === b.o || a.hits <= 0 || b.hits <= 0 || a.fixed || b.fixed) continue;
    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) { a.hits--; b.hits--; m.ev.push({ type: "clash", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
  }
  for (const p of m.projs) {
    if (p.hits <= 0 || p.cool > 0 || p.t < 2) continue;
    const D = m.f[1 - p.o], hb = hurtboxes(D);
    const box = [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2];
    const hurt = hb.find((b) => overlap(box, b));
    if (!hurt) continue;
    const A = m.f[p.o];
    const fakeA = { ...A, face: p.face, connected: 0 };
    const n0 = m.ev.length;
    applyHit(m, fakeA, D, p.hit, true);
    A.meter = fakeA.meter;
    for (let i = n0; i < m.ev.length; i++) if (m.ev[i].type === "hit" || m.ev[i].type === "block") { m.ev[i].x = (Math.max(box[0], hurt[0]) + Math.min(box[2], hurt[2])) / 2; m.ev[i].y = (Math.max(box[1], hurt[1]) + Math.min(box[3], hurt[3])) / 2; }
    p.hits--; p.cool = p.gap;
  }
  m.projs = m.projs.filter((p) => p.hits > 0 && p.life > 0 && Math.abs(p.x) < STAGE_HALF + 120);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function physicsFix(m) {
  const [a, b] = m.f;
  for (const f of m.f) f.x = clamp(f.x, -STAGE_HALF + 26, STAGE_HALF - 26);
  // 너무 멀어지지 않게
  if (Math.abs(a.x - b.x) > MAX_SEP) {
    const mid = (a.x + b.x) / 2, s = Math.sign(b.x - a.x);
    a.x = mid - s * MAX_SEP / 2; b.x = mid + s * MAX_SEP / 2;
  }
  // 몸 겹침 밀어내기
  const solid = (f) => f.st !== "kd" && f.st !== "ko" && f.st !== "thrown" && f.grabbed < 0 && f.alpha > 0.5;
  if (solid(a) && solid(b) && Math.abs(a.y - b.y) < 110) {
    const pw = PUSH_W * (a.ch.body.scale + b.ch.body.scale) / 2;
    const dx = b.x - a.x, ov = pw - Math.abs(dx);
    if (ov > 0) {
      const s = dx === 0 ? (a.face > 0 ? 1 : -1) : Math.sign(dx);
      let pa = ov / 2, pb = ov / 2;
      if (Math.abs(a.x - s * pa) > STAGE_HALF - 26) { pb += pa; pa = 0; }
      if (Math.abs(b.x + s * pb) > STAGE_HALF - 26) { pa += pb; pb = 0; }
      a.x -= s * pa; b.x += s * pb;
      for (const f of m.f) f.x = clamp(f.x, -STAGE_HALF + 26, STAGE_HALF - 26);
    }
  }
  // 바라보는 방향
  for (const f of m.f) {
    const o = m.f[1 - f.idx];
    if ((NEUTRAL.has(f.st) || f.st === "land" || f.st === "prejump") && f.y <= 0) { const s = Math.sign(o.x - f.x); if (s) f.face = s; }
  }
}

// ===== 한 프레임 =====
export function step(m, inputs) {
  m.ev = [];
  m.frame++;
  const [a, b] = m.f;
  const live = m.phase === "fight";
  readInput(m, a, live ? inputs[0] : emptyInput());
  readInput(m, b, live ? inputs[1] : emptyInput());
  if (m.shake > 0) m.shake--;

  if (m.phase === "intro") {
    m.phaseT++; a.t++; b.t++;
    if (m.phaseT === 1) m.ev.push({ type: "round", n: m.round });
    if (m.phaseT === 80) m.ev.push({ type: "fight" });
    if (m.phaseT >= 92) { m.phase = "fight"; m.phaseT = 0; }
    return;
  }
  if (m.flash > 0) { m.flash--; return; }
  if (m.hitstop > 0) { m.hitstop--; return; }
  if (m.slow > 0) { m.slow--; if (m.slow % 3) return; }

  m.sim++;   // 여기부터가 실제 시뮬레이션 프레임
  control(m, a, b); control(m, b, a);
  update(m, a, b); update(m, b, a);
  collectHits(m);
  updateProjs(m);
  physicsFix(m);

  if (m.training) {
    for (const f of m.f) {
      if (f.combo && (NEUTRAL.has(f.st))) resetCombo(f);
      if (NEUTRAL.has(f.st)) { f.idleT++; if (f.idleT > 50 && f.hp < f.maxHp) { f.hp = f.maxHp; } } else f.idleT = 0;
      if (m.infMeter) f.meter = 100;
    }
    return;
  }
  if (m.phase === "fight") {
    if (++m.tick >= 60) { m.tick = 0; m.timer = Math.max(0, m.timer - 1); }
    const ko = m.f.filter((f) => f.hp <= 0);
    if (ko.length) {
      m.phase = "ko"; m.phaseT = 0; m.slow = 54; m.hitstop = 20;
      m.roundWinner = ko.length === 2 ? -1 : 1 - ko[0].idx;
      m.ev.push({ type: "ko", who: ko[0].idx, double: ko.length === 2 });
    } else if (m.timer <= 0) {
      m.phase = "ko"; m.phaseT = 0;
      const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
      m.roundWinner = ra === rb ? -1 : ra > rb ? 0 : 1;
      m.ev.push({ type: "timeup" });
    }
  } else if (m.phase === "ko") {
    m.phaseT++;
    const w = m.roundWinner;
    const settled = m.f.every((f) => f.st !== "juggle" && f.st !== "thrown" && f.st !== "move" && f.st !== "hit");
    if (m.phaseT > 70 && settled && w >= 0 && m.f[w].st !== "win") {
      m.f[w].st = "win"; m.f[w].t = 0; m.f[w].vx = 0;
      if (m.f[1 - w].hp > 0) { m.f[1 - w].st = "lose"; m.f[1 - w].t = 0; }
    }
    if (m.phaseT > 190) {
      if (w >= 0) m.wins[w]++;
      if (m.wins[0] >= m.need || m.wins[1] >= m.need) {
        m.phase = "end"; m.winner = m.wins[0] >= m.need && m.wins[1] >= m.need ? -1 : m.wins[0] >= m.need ? 0 : 1;
        m.ev.push({ type: "end", winner: m.winner });
      } else { m.round++; resetRound(m); }
    }
  }
}

/** 연습 모드 시각화: 지금 프레임의 공격·피격·잡기 판정(엔진 계산 그대로) */
export function debugBoxes(m) {
  const out = [];
  for (const A of m.f) {
    const inv = A.inv > 0 || A.st === "kd" || A.st === "getup" || A.st === "burst";
    for (const b of hurtboxes(A)) out.push({ who: A.idx, kind: "hurt", b });
    if (inv) { const sc = A.ch.body.scale; out.push({ who: A.idx, kind: "inv", b: [A.x - 25 * sc, A.y, A.x + 25 * sc, A.y + 166 * sc] }); }
    if (A.armor) { const sc = A.ch.body.scale; out.push({ who: A.idx, kind: "armor", b: [A.x - 27 * sc, A.y, A.x + 27 * sc, A.y + 168 * sc] }); }
    if (A.st === "move" && A.mv) {
      const sc = A.ch.body.scale;
      (A.mv.hits || []).forEach((h, k) => {
        if (A.mf < h.f || A.mf >= h.f + h.n) return;
        const x0 = A.x + A.face * h.b[0] * sc, x1 = A.x + A.face * h.b[2] * sc;
        out.push({ who: A.idx, kind: (A.hitDone >> k) & 1 ? "hitDone" : "hit", b: [Math.min(x0, x1), A.y + h.b[1] * sc, Math.max(x0, x1), A.y + h.b[3] * sc], lv: h.lv });
      });
      if (A.mv.grab && A.mf <= A.mv.grab.f + 1) { const g = A.mv.grab; out.push({ who: A.idx, kind: "grab", b: [Math.min(A.x, A.x + A.face * g.range), A.y, Math.max(A.x, A.x + A.face * g.range), A.y + 140], on: A.mf === g.f }); }
    }
  }
  for (const p of m.projs) out.push({ who: p.o, kind: "hit", proj: 1, b: [p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2] });
  return out;
}
/** 오른쪽 위 기술표용: 이 캐릭터가 이 기술을 지금 쓸 수 있는지 등 화면 도우미 */
export function moveOf(f) { return f.mv; }
