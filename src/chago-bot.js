// =========================
// 차고차고 AI 봇 — 입력 생성기 (서버 전용)
//   · 봇은 사람과 똑같은 입력 구조(mx,my,ax,ay,shoot,pass,dash,tackle)만 만든다. 물리·규칙·스태미나·쿨다운은 사람과 동일(치트 없음).
//   · 난이도 = 반응 지연 + 판단 주기 + 조준 오차 + 선택의 질. 속도·힘은 그대로.
//   · 팀원이 모두 공으로 몰리지 않도록 "추격자 1명"만 공을 쫓고 나머지는 위치를 잡는다(사람 팀원도 추격자 후보).
//   · 역할(슬롯 기준): 1v1 all / 2v2 gk,fwd / 3v3 gk,mid,fwd / 4v4 gk,mid,mid,fwd
// =========================
import { PHYS, NEUTRAL_INPUT, formationPos, DT } from "./chago-engine.js";

export const BOT_LEVELS = Object.freeze({
  //          반응(초) 판단주기(초) 조준오차(도) 대시 태클확률 슛사거리 패스정확 키퍼반응 실수확률
  easy:   { react: 0.26, think: 0.26, aimDeg: 13, dash: 0.30, tackle: 0.14, shootRange: 400, pass: 0.45, keeper: 0.55, blunder: 0.18 },
  normal: { react: 0.15, think: 0.15, aimDeg: 6,  dash: 0.60, tackle: 0.33, shootRange: 520, pass: 0.72, keeper: 0.80, blunder: 0.07 },
  hard:   { react: 0.07, think: 0.08, aimDeg: 2,  dash: 0.90, tackle: 0.60, shootRange: 620, pass: 0.95, keeper: 1.00, blunder: 0.01 },
});
export const BOT_LEVEL_NAMES = Object.keys(BOT_LEVELS);

const ROLES = { 1: ["all"], 2: ["gk", "fwd"], 3: ["gk", "mid", "fwd"], 4: ["gk", "mid", "mid", "fwd"] };
export const roleFor = (teamSize, slot) => (ROLES[teamSize] || ROLES[2])[slot % (ROLES[teamSize] || ROLES[2]).length];

const PR = PHYS.playerR, BR = PHYS.ballR;
const DASH_MIN_STAMINA = 62;   // 이 이상일 때만 대시 시작(태클 예비분 보존)
const D2R = Math.PI / 180;
const len = (x, y) => Math.sqrt(x * x + y * y);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => len(a.x - b.x, a.y - b.y);

function rnd(bot) { bot.s = (Math.imul(bot.s, 1664525) + 1013904223) >>> 0; return bot.s / 4294967296; }

export function createBot({ eid, team, slot, teamSize, level = "normal", seed, shared }) {
  const L = BOT_LEVELS[level] || BOT_LEVELS.normal;
  const sh = shared || { plan: null, roles: {} };
  if (!sh.roles) sh.roles = {};
  sh.roles[String(eid)] = roleFor(teamSize, slot);
  return {
    eid: String(eid), team, slot, teamSize, level, L,
    role: roleFor(teamSize, slot),
    s: ((seed ?? (eid * 7919 + team * 104729 + 12345)) >>> 0) || 1,
    reactTicks: Math.max(1, Math.round(L.react / DT)),
    thinkTicks: Math.max(1, Math.round(L.think / DT)),
    nextThink: 0, queue: [], last: null, action: null, tacklePulse: 0,
    shared: sh,
  };
}

// ---------- 월드 읽기 도우미 ----------
function ballAt(ball, t) {
  // 지수 감쇠(0.75/s)를 반영한 t초 뒤 공 위치(벽 반사는 무시)
  const k = PHYS.ball.drag;
  const f = (1 - Math.exp(-k * t)) / k;
  return { x: ball.x + ball.vx * f, y: ball.y + ball.vy * f };
}
function clampField(f, x, y, m = 30) { return { x: clamp(x, m, f.W - m), y: clamp(y, m, f.H - m) }; }

function moveTo(me, tx, ty, slow = 14) {
  const dx = tx - me.x, dy = ty - me.y, d = len(dx, dy);
  if (d < slow) return { mx: 0, my: 0, d };
  return { mx: dx / d, my: dy / d, d };
}

// 공을 보내고 싶은 방향(목표 쪽). 공이 벽에 붙어 있으면 벽 안쪽으로 차는 성분을 제한한다(벽 쪽에서는 접근할 수 없으므로 벽을 따라 차 낸다)
function kickDir(f, ball, gx, gy, fallbackDirX) {
  const gl = len(gx - ball.x, gy - ball.y) || 1;
  let dx = (gx - ball.x) / gl, dy = (gy - ball.y) / gl;
  const mouth = Math.abs(ball.y - f.cy) < f.gw / 2 + 20;
  if (ball.y < 70) dy = clamp(dy, -0.05, 0.3); else if (ball.y > f.H - 70) dy = clamp(dy, -0.3, 0.05);
  if (!mouth) { if (ball.x < 70) dx = clamp(dx, -0.05, 0.3); else if (ball.x > f.W - 70) dx = clamp(dx, -0.3, 0.05); }
  const l = len(dx, dy);
  if (l < 0.25) return { x: fallbackDirX, y: 0 };
  return { x: dx / l, y: dy / l };
}

// 목표로 가는 직선이 공을 스치면(공을 밀어버리게 됨) 공 옆으로 돌아가는 중간 지점을 돌려준다
function aroundBall(me, tx, ty, ball, gap = PR + BR + 18) {
  const dx = tx - me.x, dy = ty - me.y, l2 = dx * dx + dy * dy;
  if (l2 < 1) return { x: tx, y: ty };
  const t = clamp(((ball.x - me.x) * dx + (ball.y - me.y) * dy) / l2, 0, 1);
  const px = me.x + dx * t, py = me.y + dy * t;
  const off = len(ball.x - px, ball.y - py);
  if (off >= gap || t <= 0 || t >= 1) return { x: tx, y: ty };
  // 공 중심에서 직선에 수직인 방향 중 내가 있는 쪽으로 gap*1.4 만큼 벌린 지점
  const l = Math.sqrt(l2);
  let nx = -dy / l, ny = dx / l;
  const side = (me.x - ball.x) * nx + (me.y - ball.y) * ny >= 0 ? 1 : -1;
  return { x: ball.x + nx * side * gap * 1.4, y: ball.y + ny * side * gap * 1.4 };
}

// 선분(me→target) 근처(폭 w)에 상대가 있는가
function laneBlocked(me, tx, ty, opps, w) {
  const dx = tx - me.x, dy = ty - me.y, l2 = dx * dx + dy * dy || 1;
  for (const o of opps) {
    const t = ((o.x - me.x) * dx + (o.y - me.y) * dy) / l2;
    if (t < 0.05 || t > 1) continue;
    const px = me.x + dx * t, py = me.y + dy * t;
    if (len(o.x - px, o.y - py) < w) return true;
  }
  return false;
}

// ---------- 팀 전술(추격자 선정): 팀당 5틱마다 한 번 계산해 모든 봇이 같은 결과를 본다 ----------
function teamPlan(shared, world, team, tick) {
  const old = shared.plan;
  if (old && tick - old.tick < 5) return old;
  const ball = world.ball;
  const mates = world.players.filter((p) => p.team === team);
  let best = null, bestEta = Infinity, oldEta = Infinity;
  for (const p of mates) {
    const d0 = dist(p, ball);
    const t = Math.min(0.7, d0 / 320);
    const ip = ballAt(ball, t);
    // 이미 공 쪽으로 달리는 중이면 보너스, 기절/회복 중이면 불이익
    let eta = len(p.x - ip.x, p.y - ip.y) / PHYS.walkSpeed;
    if (p.stunT > 0 || p.recoverT > 0) eta += 0.6;
    if (shared.roles && shared.roles[p.id] === "gk") eta += 0.9;                 // 키퍼는 웬만하면 골문 앞
    if (old && old.chaser === p.id) oldEta = eta;
    if (eta < bestEta) { bestEta = eta; best = p; }
  }
  let chaser = best ? best.id : null;
  if (old && old.chaser && chaser !== old.chaser && oldEta <= bestEta * 1.18 + 0.05) chaser = old.chaser;   // 잦은 교체 방지
  const plan = { tick, chaser, eta: bestEta };
  shared.plan = plan;
  return plan;
}

// ---------- 입력 한 틱 ----------
export function botInput(bot, world, tick, extra = {}) {
  const me = world.players.find((p) => p.id === bot.eid);
  if (!me) return NEUTRAL_INPUT;
  // 진행 중인 동작(차징 → 발사)
  if (bot.action) return runAction(bot, me, world);

  if (tick >= bot.nextThink) {
    bot.nextThink = tick + bot.thinkTicks;
    bot.queue.push({ at: tick + bot.reactTicks, d: think(bot, me, world, tick, extra) });
  }
  while (bot.queue.length > 1 && bot.queue[1].at <= tick) bot.queue.shift();
  const q = bot.queue[0];
  if (q && q.at <= tick) bot.last = q.d;
  const d = bot.last;
  if (!d) return NEUTRAL_INPUT;
  if (d.act && !d.started) { d.started = true; bot.action = { ...d.act, t: 0, mx: d.mx, my: d.my }; return runAction(bot, me, world); }
  let tackle = false;
  if (d.tackle && !d.tackled) { d.tackled = true; tackle = true; }
  return { mx: d.mx, my: d.my, ax: d.ax, ay: d.ay, shoot: false, pass: false, dash: !!d.dash, tackle, seq: 0 };
}

function runAction(bot, me, world) {
  const a = bot.action, ball = world.ball;
  const key = a.type === "shoot" ? "shoot" : "pass";
  const d = dist(me, ball);
  // 차징 중 공이 발에서 멀어지면 따라붙는다. 너무 오래 놓치면 포기(다시 판단)
  let mx = 0, my = 0;
  if (d > PR + BR + 6) {
    const v = moveTo(me, ball.x, ball.y, 1);
    mx = v.mx; my = v.my;
    a.lost = (a.lost || 0) + 1;
    if (a.lost > 9) { bot.action = null; bot.queue.length = 0; bot.nextThink = 0; return { mx, my, ax: a.ax, ay: a.ay, shoot: false, pass: false, dash: false, tackle: false, seq: 0 }; }
  }
  const out = { mx, my, ax: a.ax, ay: a.ay, shoot: false, pass: false, dash: false, tackle: false, seq: 0 };
  if (a.t < a.hold) { out[key] = true; a.t += 1; return out; }
  // 놓는 순간(=발사). 버튼이 떼어진 입력을 한 번 보낸다
  bot.action = null;
  bot.queue.length = 0; bot.nextThink = 0;
  return out;
}

// ---------- 벽·구석에 붙은 공 빼내기 ----------
// 공을 벽에서 떼어 내려면 공 "옆"(벽을 따라 안쪽)에 서서, 공이 조준 앞쪽 반원(±105°) 안에 들어오도록 안쪽으로 비스듬히 차야 한다.
function wallClose(f, ball, m = 58) {
  const mouth = Math.abs(ball.y - f.cy) < f.gw / 2 + 10;
  return ball.y < m || ball.y > f.H - m || (!mouth && (ball.x < m || ball.x > f.W - m));
}
function thinkClear(bot, me, w, dec, rot, tgtX, tgtY) {
  const f = w.field, ball = w.ball;
  const off = PR + BR + 4;
  const tl = len(tgtX - ball.x, tgtY - ball.y) || 1, tx = (tgtX - ball.x) / tl, ty = (tgtY - ball.y) / tl;
  const cl = len(f.W / 2 - ball.x, f.cy - ball.y) || 1, cx = (f.W / 2 - ball.x) / cl, cy = (f.cy - ball.y) / cl;
  // 공 둘레의 자리 후보 × 그 자리에서 공이 앞쪽 반원에 들어오는 조준(공 방향에 수직 ± 목표 쪽으로 살짝)
  let best = null, bestScore = -1e9;
  for (let k = 0; k < 16; k++) {
    const th = (k / 16) * Math.PI * 2;
    const P = { x: ball.x + Math.cos(th) * off, y: ball.y + Math.sin(th) * off };
    if (P.x < 22 || P.x > f.W - 22 || P.y < 22 || P.y > f.H - 22) continue;
    const bx = -Math.cos(th), by = -Math.sin(th);                 // P → 공 방향
    for (const sg of [1, -1]) {
      let ax = -by * sg + tx * 0.35, ay = bx * sg + ty * 0.35;
      const l = len(ax, ay) || 1; ax /= l; ay /= l;
      if (ax * bx + ay * by < -0.2) continue;                     // 공이 조준 뒤쪽이면 못 참
      const sc = (ax * cx + ay * cy) * 1.0 + (ax * tx + ay * ty) * 0.6 - dist(P, me) / 700;
      if (sc > bestScore) { bestScore = sc; best = { P, ax, ay }; }
    }
  }
  if (!best) { const d = moveTo(me, f.W / 2, f.cy); return dec(d.mx, d.my, { ax: ball.x - me.x, ay: ball.y - me.y }); }
  const dP = dist(best.P, me);
  if (dP > 12) {
    const via = aroundBall(me, best.P.x, best.P.y, ball, PR + BR + 6);
    const d = moveTo(me, via.x, via.y, 4);
    return dec(d.mx, d.my, { dash: dP > 200 && me.stamina > DASH_MIN_STAMINA, ax: ball.x - me.x, ay: ball.y - me.y });
  }
  // 실제 서 있는 자리 기준으로 조준을 다시 맞춘다: 공이 반드시 조준 앞쪽 반원 안에 들어오도록 공 방향에 수직인 쪽으로
  const ux = (ball.x - me.x) / (dist(me, ball) || 1), uy = (ball.y - me.y) / (dist(me, ball) || 1);
  const q1 = { x: -uy, y: ux }, q2 = { x: uy, y: -ux };
  const q = q1.x * best.ax + q1.y * best.ay >= q2.x * best.ax + q2.y * best.ay ? q1 : q2;
  let fx = q.x + tx * 0.35, fy = q.y + ty * 0.35;
  const fl = len(fx, fy) || 1; fx /= fl; fy /= fl;
  if (fx * ux + fy * uy < 0.05) { fx = q.x; fy = q.y; }
  const a = rot(fx, fy);
  return dec(0, 0, { ax: a.x, ay: a.y, act: { type: "shoot", hold: 4, ax: a.x, ay: a.y } });
}

// 조준 a 방향으로 공을 차되, 공이 조준 앞쪽 반원 밖(몸 뒤/옆)에 있으면 먼저 공 뒤로 돌아간다. 벽 때문에 못 돌아가면 벽 빼내기 루틴.
function kickWith(bot, me, w, dec, rot, a, type, hold, tx, ty) {
  const ball = w.ball, f = w.field;
  const dB = dist(me, ball) || 1;
  const front = ((ball.x - me.x) * a.x + (ball.y - me.y) * a.y) / dB;
  if (front > 0.1 && dB <= PR + BR + 9) return dec(0, 0, { ax: a.x, ay: a.y, act: { type, hold, ax: a.x, ay: a.y } });
  const want = { x: ball.x - a.x * 38, y: ball.y - a.y * 38 };
  const P = clampField(f, want.x, want.y, 22);
  if (len(P.x - want.x, P.y - want.y) > 14) return thinkClear(bot, me, w, dec, rot, tx, ty);
  const via = aroundBall(me, P.x, P.y, ball, PR + BR + 6);
  const d = moveTo(me, via.x, via.y, 4);
  return dec(d.mx, d.my, { ax: ball.x - me.x, ay: ball.y - me.y });
}

// ---------- 판단 ----------
function think(bot, me, w, tick, extra) {
  const L = bot.L, f = w.field, ball = w.ball;
  const dir = bot.team === 0 ? 1 : -1;
  const ownX = bot.team === 0 ? 0 : f.W, oppX = bot.team === 0 ? f.W : 0;
  const mates = w.players.filter((p) => p.team === bot.team && p.id !== me.id);
  const opps = w.players.filter((p) => p.team !== bot.team);
  const dBall = dist(me, ball);
  const aimNoise = (rnd(bot) * 2 - 1) * L.aimDeg * D2R;
  const rot = (x, y) => { const c = Math.cos(aimNoise), s = Math.sin(aimNoise); return { x: x * c - y * s, y: x * s + y * c }; };
  const dec = (mx, my, o = {}) => ({ mx, my, ax: o.ax ?? 0, ay: o.ay ?? 0, dash: !!o.dash, tackle: !!o.tackle, act: o.act || null });

  if (bot.role === "gk") return thinkKeeper(bot, me, w, dec, rot, dir, ownX, oppX, dBall, opps);

  const plan = teamPlan(bot.shared, w, bot.team, tick);
  const iAmChaser = plan.chaser === me.id;
  const blunder = rnd(bot) < L.blunder;

  const reach = PR + BR + PHYS.kick.reach - 3;
  const ballFrontDot = ((ball.x - me.x) * dir) / (dBall || 1);   // 공이 공격 방향 앞쪽에 있는가

  // ① 공을 발 앞에 두고 있다 → 슛/패스/드리블
  const relSpeed = len(ball.vx - me.vx, ball.vy - me.vy);
  // 벽·구석에 붙은 거의 정지한 공은 슛/드리블보다 먼저 빼낸다(안 그러면 슛 시도 ↔ 접근을 오가며 시간 낭비)
  if (wallClose(f, ball, 52) && len(ball.vx, ball.vy) < 90 && dBall < 140 && (plan.chaser === me.id || dBall < 60)) {
    bot.branch = "clear";
    return thinkClear(bot, me, w, dec, rot, oppX, f.cy);
  }
  if (dBall <= reach + 6 && ballFrontDot > -0.1 && relSpeed < 240 && !blunder) {
    bot.branch = "carrier";
    return thinkCarrier(bot, me, w, dec, rot, dir, oppX, mates, opps, L);
  }

  // ② 내가 추격자 → 공 쪽으로
  if (iAmChaser || (dBall < 120 && !mates.some((m) => dist(m, ball) < dBall - 15))) {
    // 상대가 공 근처에서 막 잡았으면 태클 시도
    const nearOpp = opps.find((o) => dist(o, ball) < 38);
    if (nearOpp && dBall < 68 && me.tackleCd <= 0 && me.stamina >= PHYS.stamina.tackleCost + 4 && rnd(bot) < L.tackle) {
      const d = moveTo(me, ball.x, ball.y, 1);
      return dec(d.mx, d.my, { tackle: true, ax: d.mx, ay: d.my });
    }
    if (wallClose(f, ball) && len(ball.vx, ball.vy) < 90) {
      const gx = ball.x + dir * 300, gy = f.cy;                       // 안쪽 + 상대 골대 방향으로
      bot.branch = "clear";
      return thinkClear(bot, me, w, dec, rot, gx, gy);
    }
    // 공이 닿을 지점(ip)을 예측하고, 그 공을 상대 골대 쪽으로 보낼 수 있는 쪽(공 뒤)으로 접근한다.
    // 공이 우리 골대 쪽으로 굴러가고 내가 그 뒤에 있으면, 쫓아가며 밀면 자책이 되므로 공 앞으로 돌아 들어간다.
    const t = Math.min(0.6, dBall / 330);
    const ip = ballAt(ball, t);
    const D = kickDir(f, ip, oppX, f.cy, dir);
    let tx = ip.x, ty = ip.y;
    // 대치(양쪽이 공 주변을 맴돌며 서로 못 건드림) 감지: 공이 거의 멈춘 채 가까이서 5번 연속 판단했으면 그냥 부딪혀 밀어낸다
    const still = len(ball.vx, ball.vy) < 40 && dBall < 80;
    bot.standoff = still ? (bot.standoff || 0) + 1 : 0;
    if (bot.standoff >= 5) {
      if (bot.standoff >= 12) bot.standoff = 0;
      const d = moveTo(me, ball.x, ball.y, 1);
      const canTackle = me.tackleCd <= 0 && me.stamina >= PHYS.stamina.tackleCost + 4 && dBall < 70;
      bot.branch = "poke";
      return dec(d.mx, d.my, { tackle: canTackle && rnd(bot) < 0.7, dash: me.stamina > 40, ax: d.mx, ay: d.my });
    }
    if (dBall > 58) {
      const want = { x: ip.x - D.x * 32, y: ip.y - D.y * 32 };
      const pt = clampField(f, want.x, want.y, 24);
      // 공 뒤로 돌아갈 자리가 벽 밖이면(구석·벽에 붙은 공) 일반 접근 대신 벽 빼내기 루틴
      if (len(pt.x - want.x, pt.y - want.y) > 14 && len(ball.vx, ball.vy) < 120) {
        bot.branch = "clear";
        return thinkClear(bot, me, w, dec, rot, oppX, f.cy);
      }
      const via = aroundBall(me, pt.x, pt.y, ip);
      tx = via.x; ty = via.y;
    }
    bot.branch = "chase";
    const d = moveTo(me, tx, ty);
    return dec(d.mx, d.my, { dash: d.d > 160 && me.stamina > DASH_MIN_STAMINA && rnd(bot) < L.dash, ax: ball.x - me.x, ay: ball.y - me.y });
  }

  // ③ 그 외: 위치 잡기
  bot.branch = "support";
  return thinkSupport(bot, me, w, dec, dir, ownX, oppX, mates, opps, plan, L);
}

function thinkKeeper(bot, me, w, dec, rot, dir, ownX, oppX, dBall, opps) {
  const f = w.field, ball = w.ball, L = bot.L;
  const gx = ownX + dir * 46, gcy = f.cy;
  const halfGoal = f.gw / 2 - 16;
  // 공이 가까우면 걷어낸다 (측면·상대 진영 쪽으로)
  if (dBall < PR + BR + 40 && Math.abs(ball.y - gcy) < f.gw) {
    const awayY = ball.y > gcy ? 1 : -1;
    const tx = ball.x + dir * 400, ty = ball.y + awayY * 260;
    const a = rot(tx - ball.x, ty - ball.y), al = len(a.x, a.y) || 1;
    if (((ball.x - me.x) * a.x + (ball.y - me.y) * a.y) / (dBall || 1) > -0.1) {
      const d = moveTo(me, ball.x, ball.y, 1);
      return dec(d.mx, d.my, { ax: a.x / al, ay: a.y / al, act: { type: "shoot", hold: 4, ax: a.x / al, ay: a.y / al } });
    }
  }
  // 슛이 골문으로 오고 있으면 도착 지점을 가로막는다
  let ty = gcy + clamp((ball.y - gcy) * 0.55, -halfGoal, halfGoal);
  const towards = ball.vx * -dir;                                  // 내 골대 쪽으로 오는 속도
  if (towards > 140) {
    const t = Math.max(0, (ball.x - ownX) * dir / towards);
    const yHit = ball.y + ball.vy * Math.min(t, 1.2);
    const aimed = clamp(yHit, gcy - f.gw / 2 + 8, gcy + f.gw / 2 - 8);
    ty = lerpN(ty, aimed, L.keeper);
  }
  ty = clamp(ty, gcy - halfGoal, gcy + halfGoal);
  // 공이 골문 앞 구역에서 멈춰 있고 가까우면 나가서 처리
  const rush = dBall < 190 && Math.abs(ball.x - ownX) < 230 && len(ball.vx, ball.vy) < 120;
  let tx = gx, tyy = ty;
  if (rush && wallClose(f, ball)) return thinkClear(bot, me, w, dec, rot, ball.x + dir * 300, f.cy);
  if (rush) {
    // 공과 우리 골대 사이로 들어가 걷어낸다(필드 쪽에서 달려들면 공을 골대로 밀어 넣게 됨)
    const D = kickDir(f, ball, ball.x + (ball.x - ownX), ball.y + (ball.y - f.cy) * 1.0 + 1e-3, dir);   // 우리 골대에서 멀어지는 방향
    const behind = { x: ball.x - D.x * (PR + BR + 6), y: ball.y - D.y * (PR + BR + 6) };
    const via = aroundBall(me, behind.x, behind.y, ball);
    tx = clamp(via.x, 30, f.W - 30); tyy = clamp(via.y, 30, f.H - 30);
  }
  const d = moveTo(me, tx, tyy, 6);
  return dec(d.mx, d.my, { dash: (towards > 300 || rush) && me.stamina > 25, ax: ball.x - me.x, ay: ball.y - me.y });
}
const lerpN = (a, b, t) => a + (b - a) * t;

function thinkCarrier(bot, me, w, dec, rot, dir, oppX, mates, opps, L) {
  const f = w.field;
  const dg = len(oppX - me.x, f.cy - me.y);
  const nearOpp = opps.reduce((m, o) => Math.min(m, dist(o, me)), 1e9);

  // 슛: 사거리 안 + 골문 쪽 길이 열려 있음
  if (dg < L.shootRange) {
    const opp = opps.filter((o) => Math.abs(o.x - oppX) < 260);
    // 상대 수비(키퍼)에서 더 먼 쪽 골문 구석
    let best = null, bestScore = -1;
    for (const side of [-1, 1]) {
      const ty = f.cy + side * (f.gw / 2 - 26);
      let score = opp.reduce((m, o) => Math.min(m, len(o.x - oppX, o.y - ty)), 400);
      if (laneBlocked(me, oppX, ty, opps, 26)) score *= 0.2;
      score += (rnd(bot) - 0.5) * 20;
      if (score > bestScore) { bestScore = score; best = ty; }
    }
    // 상대가 바짝 붙어 있으면(태클 위험) 길게 차징하지 않는다: 골대가 아주 가까울 때만 바로 슛
    const risky = nearOpp < 110;
    if (bestScore > 55 && (!risky || dg < 260)) {
      const a = rot(oppX - me.x, best - me.y), al = len(a.x, a.y) || 1;
      // 공이 골대까지 닿을 만큼만 충전(공 비행거리 ≈ 초속): 필요 속도 ≈ 거리×1.3
      const need = (dg * 1.3) / f.power;
      const c = clamp((need - PHYS.kick.minPower) / (PHYS.kick.maxPower - PHYS.kick.minPower), 0.12, 1);
      let hold = risky ? 3 : Math.max(2, Math.round((c * PHYS.kick.chargeTime) / DT));
      // 먼 슛이면 퍼펙트 구간(차징 0.82~0.96)에 맞춰 뗀다: 어려움 85%, 보통 35%
      if (!risky && c >= 0.8 && rnd(bot) < (bot.level === "hard" ? 0.85 : bot.level === "normal" ? 0.35 : 0)) hold = Math.round(0.89 * PHYS.kick.chargeTime / DT);
      return kickWith(bot, me, w, dec, rot, { x: a.x / al, y: a.y / al }, "shoot", hold, oppX, best);
    }
  }
  // 패스: 압박받거나, 앞에 열린 팀원이 있을 때
  const pressured = nearOpp < 85;
  let target = null, ts = -1;
  for (const m of mates) {
    if (bot.shared.roles && bot.shared.roles[m.id] === "gk") continue;     // 키퍼에게 되돌려 주지 않는다(자기 골대 쪽 패스는 위험)
    const adv = (m.x - me.x) * dir;
    const d = dist(m, me);
    if (d < 110 || d > 560 || adv < -40) continue;
    if (laneBlocked(me, m.x, m.y, opps, 34)) continue;
    const free = opps.reduce((mn, o) => Math.min(mn, dist(o, m)), 400);
    const sc = adv * 0.6 + free * 0.5 - d * 0.1 + (pressured ? 80 : 0);
    if ((adv > 70 || pressured) && sc > ts) { ts = sc; target = m; }
  }
  if (target && (pressured || ts > 90) && rnd(bot) < L.pass) {
    const a = rot(target.x - me.x, target.y - me.y), al = len(a.x, a.y) || 1;
    const moving = len(target.vx, target.vy) > 90;
    return kickWith(bot, me, w, dec, rot, { x: a.x / al, y: a.y / al }, "pass", moving ? 9 : 2, target.x, target.y);
  }
  // 드리블: 상대 골대 쪽으로, 가까운 상대는 비켜서
  let tx = oppX - dir * 70, ty = f.cy;
  const front = opps.filter((o) => (o.x - me.x) * dir > 0 && dist(o, me) < 170).sort((a, b) => dist(a, me) - dist(b, me))[0];
  if (front) ty = me.y + (me.y >= front.y ? 1 : -1) * 140;
  const d = moveTo(me, tx, ty);
  return dec(d.mx, d.my, { dash: !front && me.stamina > DASH_MIN_STAMINA && rnd(bot) < L.dash, ax: d.mx, ay: d.my });
}

function thinkSupport(bot, me, w, dec, dir, ownX, oppX, mates, opps, plan, L) {
  const f = w.field, ball = w.ball;
  const home = formationPos(w, bot.team, bot.slot);
  const ballMine = w.ball.lastTouchTeam === bot.team && w.t - w.ball.lastTouchT < 1.6;
  let tx = home.x + (ball.x - home.x) * 0.35, ty = home.y + (ball.y - home.y) * 0.25;
  if (bot.role === "fwd" || bot.role === "all" || bot.role === "mid") {
    if (ballMine || plan.chaser && mates.some((m) => m.id === plan.chaser && dist(m, ball) < 50)) {
      // 공격 가담: 앞으로 올라가서 상대가 없는 높이로
      tx = clamp(ball.x + dir * (bot.role === "fwd" ? 190 : 110), 60, f.W - 60);
      let by = ty, bs = -1;
      for (const oy of [-200, -100, 0, 100, 200]) {
        const cy = clamp(f.cy + oy, 60, f.H - 60);
        let sc = opps.reduce((m, o) => Math.min(m, len(o.x - tx, o.y - cy)), 500) + mates.reduce((m, o) => Math.min(m, len(o.x - tx, o.y - cy)), 500) * 0.6;
        sc -= Math.abs(cy - ball.y) < 60 ? 120 : 0;
        if (sc > bs) { bs = sc; by = cy; }
      }
      ty = by;
    } else if (!ballMine && (ball.x - ownX) * dir < f.W * 0.55) {
      // 상대가 우리 쪽에서 공격 중: 공과 우리 골대 사이로 내려온다
      const gx = ownX - ball.x, gy = f.cy - ball.y, gl = len(gx, gy) || 1;
      tx = ball.x + (gx / gl) * 150; ty = ball.y + (gy / gl) * 150;
    }
  }
  // 팀원과 너무 붙지 않기
  for (const m of mates) {
    const d = dist(m, { x: tx, y: ty });
    if (d < 80 && d > 1) { tx += ((tx - m.x) / d) * (80 - d); ty += ((ty - m.y) / d) * (80 - d); }
  }
  const p = clampField(f, tx, ty, 40);
  const d = moveTo(me, p.x, p.y, 16);
  return dec(d.mx, d.my, { dash: d.d > 260 && me.stamina > DASH_MIN_STAMINA + 10 && rnd(bot) < L.dash * 0.7, ax: ball.x - me.x, ay: ball.y - me.y });
}

// =========================
// 승부차기: 키커/키퍼 입력 (match.so 참고). 사람과 같은 입력 구조·같은 규칙.
//   키커: 반응 시간 뒤 키퍼가 치우친 반대쪽(어려움)/무작위 코너로 필요한 만큼만 차징해 슛
//   키퍼: 공이 움직이기 전에는 가운데에서 흔들리고(어려움은 가끔 한쪽에 걸기), 공이 움직이면 도착 지점으로 이동
// =========================
export function botShootout(bot, m, role) {
  const so = m.so, w = m.world;
  if (!so || so.state !== "live") return NEUTRAL_INPUT;
  const me = w.players.find((q) => q.id === bot.eid);
  if (!me) return NEUTRAL_INPUT;
  const L = bot.L, f = w.field, ball = w.ball;
  if (bot.soAttempt !== so.attempt) { bot.soAttempt = so.attempt; bot.soPlan = null; bot.soT = 0; bot.soMove = 0; bot.soGuess = null; }
  bot.soT += 1;
  const dir = so.atk === 0 ? 1 : -1, gx = so.atk === 0 ? f.W : 0;
  if (role === "kicker") {
    if (!bot.soPlan) {
      const keeper = w.players.find((q) => q.id === so.keeper);
      const off = keeper ? keeper.y - f.cy : 0;
      const side = bot.level === "hard" && Math.abs(off) > 12 ? (off > 0 ? -1 : 1) : (rnd(bot) < 0.5 ? -1 : 1);
      const margin = f.gw / 2 - (bot.level === "hard" ? 22 : bot.level === "normal" ? 30 : 46);
      const ty = f.cy + side * margin + (rnd(bot) - 0.5) * L.aimDeg * 3;
      const need = bot.level === "hard" ? 900 : bot.level === "normal" ? 780 : 640;
      const c = clamp((need / f.power - PHYS.kick.minPower) / (PHYS.kick.maxPower - PHYS.kick.minPower), 0.2, 1);
      const wait = Math.round(((bot.level === "hard" ? 0.45 : bot.level === "normal" ? 0.7 : 1.0) + rnd(bot) * 0.3) / DT);
      bot.soPlan = { ty, hold: Math.max(2, Math.round((c * PHYS.kick.chargeTime) / DT)), wait, done: false };
    }
    const pl = bot.soPlan;
    const ax = gx - ball.x, ay = pl.ty - ball.y, al = Math.hypot(ax, ay) || 1;
    const nz = (rnd(bot) - 0.5) * L.aimDeg * 0.6 * D2R;
    const aim = { x: (ax / al) * Math.cos(nz) - (ay / al) * Math.sin(nz), y: (ax / al) * Math.sin(nz) + (ay / al) * Math.cos(nz) };
    const t = bot.soT - pl.wait;
    const out = { mx: 0, my: 0, ax: aim.x, ay: aim.y, shoot: false, pass: false, dash: false, tackle: false, seq: 0 };
    if (t >= 0 && t < pl.hold) out.shoot = true;
    return out;
  }
  // 키퍼
  const out = { mx: 0, my: 0, ax: -dir, ay: 0, shoot: false, pass: false, dash: false, tackle: false, seq: 0 };
  const sp = Math.hypot(ball.vx, ball.vy);
  const lineX = gx - dir * 26;
  if (sp < 150) {
    // 공이 움직이기 전: 중앙 근처 대기. 어려움은 가끔 한쪽에 걸고 미리 움직인다
    const pGuess = bot.level === "hard" ? 0.55 : bot.level === "normal" ? 0.35 : 0.15;
    if (bot.soGuess == null) bot.soGuess = rnd(bot) < pGuess ? (rnd(bot) < 0.5 ? -1 : 1) : 0;
    const startedWait = bot.soT > (bot.level === "hard" ? 12 : bot.level === "normal" ? 18 : 24);   // 이 시점에 한쪽에 건다
    const ty = f.cy + (startedWait ? bot.soGuess * f.gw * 0.28 : 0);
    const d = moveTo(me, lineX, ty, 8);
    out.mx = d.mx * 0.7; out.my = d.my * 0.7;
    return out;
  }
  if (!bot.soMove) bot.soMove = bot.soT;
  if (bot.soT - bot.soMove < Math.round(L.react / DT)) return out;                       // 반응 지연
  const t = Math.max(0, (gx - ball.x) / (ball.vx || 1e-6));
  const yAt = clamp(ball.y + ball.vy * Math.min(t, 1.5), f.cy - f.gw / 2 - 20, f.cy + f.gw / 2 + 20);
  const d = moveTo(me, lineX, yAt + (rnd(bot) - 0.5) * L.aimDeg * 2, 4);
  out.mx = d.mx; out.my = d.my; out.dash = true;
  return out;
}
