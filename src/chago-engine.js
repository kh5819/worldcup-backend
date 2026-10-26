// =========================
// 차고차고 (DUO Chago) — 탑다운 2D 축구 물리 엔진
// 서버(권위)와 브라우저(입력 예측)가 같은 파일을 쓴다. 의존성 없음, 시간·난수 없음.
//   · 고정 틱 30Hz, 틱마다 4번 쪼개서(120Hz) 계산 → 빠른 공도 벽/선수를 뚫지 않는다
//   · 좌표 단위 px, 시간 초. 팀0=왼쪽 진영(오른쪽 골대 공격), 팀1=오른쪽 진영
//   · 서버가 공 소유·킥·태클·골을 모두 판정한다. 클라이언트는 입력만 보낸다.
// 수정하면 프론트 복사본(홈페이지 제작/js/chago-engine.js)도 같이 갱신: scripts/sync-chago.mjs
// =========================

export const ENGINE_VERSION = 1;
export const DT = 1 / 30;
export const SUBSTEPS = 4;
export const H = DT / SUBSTEPS;

export const PHYS = Object.freeze({
  playerR: 20,
  ballR: 11,
  postR: 6,
  walkSpeed: 250,
  dashMult: 1.5,
  accel: 2600,
  decel: 3400,
  chargeSlow: 0.72,
  turnRate: 16,                       // rad/s (바라보는 방향 회전)
  stamina: { max: 100, drain: 38, regen: 20, regenDelay: 0.6, exhaustResume: 25, tackleCost: 22 },
  ball: { drag: 0.75, roll: 40, max: 1100, wallE: 0.78, postE: 0.85, spinDecay: 1.4, magnus: 0.5, playerE: 0.55, playerMass: 3, mass: 1 },
  kick: { perfect: { from: 0.82, to: 0.96, boost: 1.18 }, combo: { window: 4, per: 0.04, max: 3 }, save: { window: 2.0, superSpeed: 850 }, reach: 12, frontDot: -0.25, minPower: 360, maxPower: 1050, chargeTime: 0.85, inherit: 0.35, cooldown: 0.28, minCharge: 0.12 },
  pass: { throughHold: 0.28, leadTime: 0.55, minSpeed: 380, maxSpeed: 780, coneDeg: 38, wideConeDeg: 70 },
  tackle: { speed: 560, duration: 0.22, recover: 0.35, cooldown: 1.0, stun: 0.55, ballKnock: 430, hitReach: 4, recoverHit: 0.2 },
});

// 경기 인원별 경기장 (px). gw=골문 폭, gd=골대 깊이, power=킥 세기 배율(작은 경기장일수록 약하게)
export const FIELD_PRESETS = Object.freeze({
  1: { W: 900, H: 520, gw: 170, gd: 54, power: 0.82 },
  2: { W: 1000, H: 580, gw: 190, gd: 56, power: 0.9 },
  3: { W: 1100, H: 640, gw: 210, gd: 58, power: 0.95 },
  4: { W: 1200, H: 700, gw: 230, gd: 60, power: 1 },
});

// 팀 안 슬롯별 킥오프 위치 (자기 진영 기준 비율, 팀0 기준 → 팀1은 좌우 반전)
export const FORMATIONS = {
  1: [[0.34, 0.5]],
  2: [[0.12, 0.5], [0.36, 0.5]],
  3: [[0.10, 0.5], [0.32, 0.28], [0.32, 0.72]],
  4: [[0.09, 0.5], [0.27, 0.28], [0.27, 0.72], [0.41, 0.5]],
};

const len = (x, y) => Math.sqrt(x * x + y * y);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// ---------- 월드 생성 ----------
export function fieldFor(teamSize) {
  const f = FIELD_PRESETS[teamSize] || FIELD_PRESETS[2];
  return { W: f.W, H: f.H, gw: f.gw, gd: f.gd, cy: f.H / 2, power: f.power };
}

function buildWalls(f) {
  const { W, H: Hh, gw, gd, cy } = f;
  const t = cy - gw / 2, b = cy + gw / 2;
  // [x1,y1,x2,y2, playerOnly]
  const segs = [
    [0, 0, W, 0, 0], [0, Hh, W, Hh, 0],
    [0, 0, 0, t, 0], [0, b, 0, Hh, 0],
    [W, 0, W, t, 0], [W, b, W, Hh, 0],
    // 골대 안쪽(공만 들어감)
    [0, t, -gd, t, 0], [-gd, t, -gd, b, 0], [-gd, b, 0, b, 0],
    [W, t, W + gd, t, 0], [W + gd, t, W + gd, b, 0], [W + gd, b, W, b, 0],
    // 골문 입구 막기(선수는 골대 안으로 못 들어감)
    [0, t, 0, b, 1], [W, t, W, b, 1],
  ];
  const posts = [[0, t], [0, b], [W, t], [W, b]];
  return { segs, posts };
}

export function createWorld({ teamSize = 2 } = {}) {
  const field = fieldFor(teamSize);
  const { segs, posts } = buildWalls(field);
  return {
    tick: 0, t: 0, teamSize, field, segs, posts,
    players: [],
    ball: { x: field.W / 2, y: field.cy, vx: 0, vy: 0, spin: 0, lastTouch: null, lastTouchTeam: -1, lastTouchT: -99, shot: null, pass: null },
    combo: [{ n: 0, t: -99 }, { n: 0, t: -99 }],      // 팀별 연속 패스 성공 횟수
    assist: [null, null],                              // 팀별 마지막 패스 성공 {from,to,t}
    events: [],
    goalFlag: false,
    lastGoal: null,
  };
}

function newPlayer(id, team, slot) {
  return {
    id, team, slot,
    x: 0, y: 0, vx: 0, vy: 0, fx: team === 0 ? 1 : -1, fy: 0, ax: team === 0 ? 1 : -1, ay: 0,
    wx: 0, wy: 0,
    stamina: PHYS.stamina.max, exhausted: false, regenWait: 0, dashing: false,
    charge: 0, passHold: 0, prevShoot: false, prevPass: false, prevTackle: false,
    kickCd: 0, tackleCd: 0, tackleT: 0, tx: 0, ty: 0, tackleHit: false, tackleBall: false,
    recoverT: 0, stunT: 0, pinT: 0,
    seq: 0,
  };
}

export function addPlayer(world, { id, team, slot }) {
  if (world.players.some((p) => p.id === id)) return null;
  if (slot == null) slot = world.players.filter((p) => p.team === team).length;
  const p = newPlayer(id, team, slot);
  world.players.push(p);
  placeAtFormation(world, p);
  return p;
}

export function removePlayer(world, id) {
  const i = world.players.findIndex((p) => p.id === id);
  if (i >= 0) world.players.splice(i, 1);
}

export function getPlayer(world, id) {
  return world.players.find((p) => p.id === id) || null;
}

// 슬롯의 킥오프 위치(월드 좌표)
export function formationPos(world, team, slot) {
  const f = world.field;
  const slots = FORMATIONS[world.teamSize] || FORMATIONS[2];
  const [fx, fy] = slots[slot % slots.length];
  return { x: team === 0 ? fx * f.W : (1 - fx) * f.W, y: fy * f.H };
}

function placeAtFormation(world, p) {
  const f = world.field;
  const slots = FORMATIONS[world.teamSize] || FORMATIONS[2];
  const [fx, fy] = slots[p.slot % slots.length];
  p.x = p.team === 0 ? fx * f.W : (1 - fx) * f.W;
  p.y = fy * f.H;
  p.vx = p.vy = 0;
  p.fx = p.ax = p.team === 0 ? 1 : -1; p.fy = p.ay = 0;
}

// 킥오프/골 직후: 전원 제자리, 공은 가운데
export function resetPositions(world) {
  const b = world.ball;
  b.x = world.field.W / 2; b.y = world.field.cy; b.vx = b.vy = 0; b.spin = 0;
  b.lastTouch = null; b.lastTouchTeam = -1; b.lastTouchT = -99; b.shot = null; b.pass = null;
  world.combo = [{ n: 0, t: -99 }, { n: 0, t: -99 }]; world.assist = [null, null];
  for (const p of world.players) {
    placeAtFormation(world, p);
    p.wx = p.wy = 0; p.charge = 0; p.passHold = 0;
    p.kickCd = 0; p.tackleCd = 0; p.tackleT = 0; p.recoverT = 0; p.stunT = 0; p.tackleHit = false; p.pinT = 0;
    p.stamina = PHYS.stamina.max; p.exhausted = false; p.regenWait = 0; p.dashing = false;
  }
  world.goalFlag = false;
  world.lastGoal = null;
}

// ---------- 입력 정리 (클라가 뭘 보내도 이 모양으로만 들어온다) ----------
export const NEUTRAL_INPUT = Object.freeze({ mx: 0, my: 0, ax: 0, ay: 0, hasAim: false, shoot: false, pass: false, dash: false, tackle: false, seq: 0 });

export function cleanInput(raw) {
  if (!raw || typeof raw !== "object") return NEUTRAL_INPUT;
  let mx = num(raw.mx), my = num(raw.my);
  const ml = len(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  let ax = num(raw.ax), ay = num(raw.ay);
  const al = len(ax, ay);
  const hasAim = al > 0.01;
  if (hasAim) { ax /= al; ay /= al; } else { ax = 0; ay = 0; }
  return { mx, my, ax, ay, hasAim, shoot: !!raw.shoot, pass: !!raw.pass, dash: !!raw.dash, tackle: !!raw.tackle, seq: (num(raw.seq) | 0) };
}

// ---------- 한 틱 진행 ----------
// inputs: { [playerId]: 입력 } (없으면 가만히). 반환: 이번 틱 이벤트 목록
export function stepWorld(world, inputs) {
  world.events = [];
  const ins = inputs || {};
  for (const p of world.players) {
    const inp = ins[p.id] ? cleanInput(ins[p.id]) : NEUTRAL_INPUT;
    if (inp.seq) p.seq = inp.seq;
    applyIntent(world, p, inp);
  }
  for (let s = 0; s < SUBSTEPS; s++) substep(world);
  world.tick += 1;
  world.t += DT;
  return world.events;
}

function applyIntent(world, p, inp) {
  const T = PHYS.tackle, S = PHYS.stamina;
  p.kickCd = Math.max(0, p.kickCd - DT);
  p.tackleCd = Math.max(0, p.tackleCd - DT);
  p.stunT = Math.max(0, p.stunT - DT);
  if (p.recoverT > 0) p.recoverT = Math.max(0, p.recoverT - DT);
  if (p.tackleT > 0) {
    p.tackleT = Math.max(0, p.tackleT - DT);
    if (p.tackleT === 0) { p.recoverT = T.recover; p.tackleHit = false; p.tackleBall = false; }
  }
  const locked = p.stunT > 0 || p.recoverT > 0 || p.tackleT > 0;

  const ml = len(inp.mx, inp.my);
  if (inp.hasAim) { p.ax = inp.ax; p.ay = inp.ay; }
  else if (ml > 0.1) { p.ax = inp.mx / ml; p.ay = inp.my / ml; }
  else { p.ax = p.fx; p.ay = p.fy; }

  if (!locked && ml > 0.1) turnFacing(p, inp.mx / ml, inp.my / ml);

  p.wx = locked ? 0 : inp.mx;
  p.wy = locked ? 0 : inp.my;

  // 대시 / 스태미나
  const wantDash = !locked && inp.dash && ml > 0.1 && !p.exhausted && p.stamina > 0;
  p.dashing = wantDash;
  if (wantDash) {
    p.stamina = Math.max(0, p.stamina - S.drain * DT);
    p.regenWait = S.regenDelay;
    if (p.stamina <= 0) { p.exhausted = true; p.dashing = false; }
  } else {
    if (p.regenWait > 0) p.regenWait -= DT;
    else p.stamina = Math.min(S.max, p.stamina + S.regen * DT);
    if (p.exhausted && p.stamina >= S.exhaustResume) p.exhausted = false;
  }

  if (locked) {
    // 기절·태클 중에는 차징/패스 입력이 쌓이지 않는다 (풀어도 발동 안 함)
    p.charge = 0; p.passHold = 0;
    p.prevShoot = inp.shoot; p.prevPass = inp.pass; p.prevTackle = inp.tackle;
    return;
  }

  // 슛 차징 → 버튼을 떼는 순간 킥
  if (inp.shoot) {
    p.charge = Math.min(1, p.charge + DT / PHYS.kick.chargeTime);
  } else if (p.prevShoot) {
    doShoot(world, p, Math.max(PHYS.kick.minCharge, p.charge));
    p.charge = 0;
  } else {
    p.charge = 0;
  }
  // 패스: 짧게 = 일반, 길게 누르고 떼기 = 스루
  if (inp.pass) {
    p.passHold += DT;
  } else if (p.prevPass) {
    doPass(world, p, p.passHold >= PHYS.pass.throughHold);
    p.passHold = 0;
  } else {
    p.passHold = 0;
  }
  // 태클 (누르는 순간)
  if (inp.tackle && !p.prevTackle && p.tackleCd <= 0 && p.stamina >= S.tackleCost && !p.exhausted) {
    let dx = ml > 0.1 ? inp.mx / ml : p.ax, dy = ml > 0.1 ? inp.my / ml : p.ay;
    const dl = len(dx, dy) || 1;
    p.tx = dx / dl; p.ty = dy / dl;
    p.tackleT = T.duration; p.tackleCd = T.cooldown; p.tackleHit = false; p.tackleBall = false;
    p.stamina -= S.tackleCost; p.regenWait = S.regenDelay;
    p.fx = p.tx; p.fy = p.ty;
    world.events.push({ type: "tackle", id: p.id, team: p.team });
  }
  p.prevShoot = inp.shoot; p.prevPass = inp.pass; p.prevTackle = inp.tackle;
}

function turnFacing(p, tx, ty) {
  const cur = Math.atan2(p.fy, p.fx), want = Math.atan2(ty, tx);
  let d = want - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const step = PHYS.turnRate * DT;
  const a = Math.abs(d) <= step ? want : cur + Math.sign(d) * step;
  p.fx = Math.cos(a); p.fy = Math.sin(a);
}

// ---------- 킥 / 패스 ----------
// 공이 발 닿는 거리 + 조준 방향 앞쪽(±약 105°)에 있어야 찰 수 있다. 몸 뒤쪽 공은 못 찬다(헛발질).
function ballInReach(world, p) {
  const b = world.ball;
  const dx = b.x - p.x, dy = b.y - p.y, d = len(dx, dy);
  if (d > PHYS.playerR + PHYS.ballR + PHYS.kick.reach) return false;
  if (d < 1e-6) return true;
  return (dx * p.ax + dy * p.ay) / d > PHYS.kick.frontDot;
}

function touch(world, p) {
  const b = world.ball, K = PHYS.kick;
  // 선방: 상대의 유효슈팅을 수비 쪽이 건드림 (강한 슛·퍼펙트 슛이면 슈퍼 세이브)
  if (b.shot) {
    if (p.team !== b.shot.team && b.shot.onTarget && world.t - b.shot.t < K.save.window) {
      world.events.push({ type: "save", id: p.id, team: p.team, shooter: b.shot.id, speed: Math.round(b.shot.speed), super: b.shot.speed >= K.save.superSpeed || b.shot.perfect });
      b.shot = null;
    } else if (p.team === b.shot.team && p.id !== b.shot.id && world.t - b.shot.t > 0.15) b.shot = null;
  }
  // 콤보: 패스가 같은 팀 다른 선수에게 닿으면 성공, 상대에게 닿으면 끊김
  if (b.pass && p.id !== b.pass.id) {
    if (p.team === b.pass.team && world.t - b.pass.t < 3) {
      const c = world.combo[p.team];
      if (world.t - c.t > K.combo.window) c.n = 0;
      c.n += 1; c.t = world.t;
      world.assist[p.team] = { from: b.pass.id, to: p.id, t: world.t };
      world.events.push({ type: "combo", team: p.team, n: c.n, id: p.id, from: b.pass.id });
    }
    b.pass = null;
  }
  world.combo[1 - p.team].n = 0;                       // 상대가 공을 건드리면 상대 팀 콤보는 끊김
  b.lastTouch = p.id; b.lastTouchTeam = p.team; b.lastTouchT = world.t;
}

function setBall(world, p, dx, dy, speed, spin) {
  const b = world.ball;
  b.vx = dx * speed + p.vx * PHYS.kick.inherit;
  b.vy = dy * speed + p.vy * PHYS.kick.inherit;
  const sp = len(b.vx, b.vy);
  if (sp > PHYS.ball.max) { b.vx *= PHYS.ball.max / sp; b.vy *= PHYS.ball.max / sp; }
  b.spin = spin;
  p.kickCd = PHYS.kick.cooldown;
  touch(world, p);
}

function doShoot(world, p, charge) {
  if (p.kickCd > 0) return false;
  if (!ballInReach(world, p)) {
    world.events.push({ type: "whiff", id: p.id, team: p.team });
    return false;
  }
  const K = PHYS.kick;
  let power = (K.minPower + (K.maxPower - K.minPower) * charge) * world.field.power;
  const perfect = charge >= K.perfect.from && charge <= K.perfect.to;
  if (perfect) power *= K.perfect.boost;
  const cb = world.combo[p.team];
  const comboLvl = world.t - cb.t <= K.combo.window ? clamp(cb.n - 1, 0, K.combo.max) : 0;   // 패스 2번 이상 이어지면 +4%씩(최대 +12%)
  power *= 1 + comboLvl * K.combo.per;
  // 달리면서 옆으로 차면 감겨 들어간다: 조준선에 수직인 이동 성분의 반대로 휜다
  const lat = (-p.ay * p.vx + p.ax * p.vy) / PHYS.walkSpeed;
  const spin = Math.abs(lat) > 0.25 ? clamp(-lat * 1.2, -1, 1) : 0;
  setBall(world, p, p.ax, p.ay, power, spin);
  const sp = len(world.ball.vx, world.ball.vy);
  const onTarget = shotOnTarget(world, p);
  world.ball.shot = { id: p.id, team: p.team, t: world.t, speed: sp, onTarget, perfect, combo: comboLvl };
  cb.n = 0;
  world.events.push({ type: "kick", id: p.id, team: p.team, kind: "shot", power: charge, curve: spin !== 0, perfect, combo: comboLvl, onTarget, speed: Math.round(sp) });
  return true;
}

// 지금 공의 방향·속도로 상대 골문 안(골대 폭)에 들어갈 직선 궤적인가 (벽 반사·휘어짐은 무시)
function shotOnTarget(world, p) {
  const b = world.ball, f = world.field;
  const goalX = p.team === 0 ? f.W : 0;
  if ((goalX - b.x) * b.vx <= 0) return false;
  const sp = len(b.vx, b.vy);
  const dist = Math.abs(goalX - b.x) * (sp / Math.abs(b.vx));
  if (dist > (sp / PHYS.ball.drag) * 0.85) return false;     // 공이 거기까지 못 간다
  const yAt = b.y + (b.vy / b.vx) * (goalX - b.x);
  return Math.abs(yAt - f.cy) < f.gw / 2 + 4;
}

function pickPassTarget(world, p) {
  const P = PHYS.pass;
  let best = null, bestScore = Infinity;
  const tryCone = (deg) => {
    const cosMin = Math.cos((deg * Math.PI) / 180);
    for (const q of world.players) {
      if (q.team !== p.team || q.id === p.id) continue;
      const dx = q.x - p.x, dy = q.y - p.y, d = len(dx, dy);
      if (d < 30) continue;
      const cos = (dx * p.ax + dy * p.ay) / d;
      if (cos < cosMin) continue;
      const score = (1 - cos) * 600 + d * 0.35;
      if (score < bestScore) { bestScore = score; best = q; }
    }
  };
  tryCone(P.coneDeg);
  if (!best) tryCone(P.wideConeDeg);
  return best;
}

function doPass(world, p, through) {
  if (p.kickCd > 0 || !ballInReach(world, p)) return false;
  const P = PHYS.pass, f = world.field;
  const tgt = pickPassTarget(world, p);
  let tx, ty;
  if (tgt) {
    const lead = through ? P.leadTime : 0.15;
    tx = clamp(tgt.x + tgt.vx * lead, 30, f.W - 30);
    ty = clamp(tgt.y + tgt.vy * lead, 30, f.H - 30);
  } else {
    // 받을 사람이 없으면 조준 방향으로 가볍게
    tx = clamp(p.x + p.ax * 260, 30, f.W - 30);
    ty = clamp(p.y + p.ay * 260, 30, f.H - 30);
  }
  let dx = tx - world.ball.x, dy = ty - world.ball.y;
  const d = len(dx, dy) || 1;
  dx /= d; dy /= d;
  const speed = clamp(d * 2.0 + 240, P.minSpeed, P.maxSpeed) * world.field.power;
  setBall(world, p, dx, dy, speed, 0);
  world.ball.pass = { id: p.id, team: p.team, t: world.t };
  world.ball.shot = null;
  world.events.push({ type: "kick", id: p.id, team: p.team, kind: through ? "through" : "pass", to: tgt ? tgt.id : null });
  return true;
}

// ---------- 120Hz 서브스텝: 이동 → 충돌 → 골 판정 ----------
function substep(world) {
  movePlayers(world);
  moveBall(world);
  collidePlayersWithPlayers(world);
  tackleContacts(world);
  collideBallWithPlayers(world);
  wallsForPlayers(world);
  wallsForBall(world);
  unpinBall(world);
  containBall(world);        // 어떤 경우에도 공은 경기장·골대 밖으로 못 나감(여러 선수에 끼어 밀려난 경우 대비)
  checkGoal(world);
}

function movePlayers(world) {
  const speedBase = PHYS.walkSpeed;
  for (const p of world.players) {
    if (p.tackleT > 0) {
      p.vx = p.tx * PHYS.tackle.speed;
      p.vy = p.ty * PHYS.tackle.speed;
    } else {
      let sp = speedBase;
      if (p.dashing) sp *= PHYS.dashMult;
      if (p.charge > 0) sp *= PHYS.chargeSlow;
      const tvx = p.wx * sp, tvy = p.wy * sp;
      const moving = p.wx !== 0 || p.wy !== 0;
      const a = (moving ? PHYS.accel : PHYS.decel) * H;
      let dvx = tvx - p.vx, dvy = tvy - p.vy;
      const dl = len(dvx, dvy);
      if (dl > a) { dvx *= a / dl; dvy *= a / dl; }
      p.vx += dvx; p.vy += dvy;
    }
    p.x += p.vx * H;
    p.y += p.vy * H;
  }
}

function moveBall(world) {
  const b = world.ball, B = PHYS.ball;
  let sp = len(b.vx, b.vy);
  if (sp > 0) {
    // 마그누스: 속도에 수직(왼쪽 법선)으로 휘는 가속
    if (b.spin !== 0) {
      const nx = -b.vy / sp, ny = b.vx / sp;
      const a = b.spin * B.magnus * sp;
      b.vx += nx * a * H; b.vy += ny * a * H;
      b.spin *= Math.exp(-B.spinDecay * H);
      if (Math.abs(b.spin) < 0.01) b.spin = 0;
    }
    sp = len(b.vx, b.vy);
    const ns = Math.max(0, sp - B.roll * H) * Math.exp(-B.drag * H);
    if (sp > 0) { const k = ns / sp; b.vx *= k; b.vy *= k; }
    if (ns < 2) { b.vx = 0; b.vy = 0; }
  }
  b.x += b.vx * H;
  b.y += b.vy * H;
}

function collidePlayersWithPlayers(world) {
  const ps = world.players, R2 = PHYS.playerR * 2;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j];
      let dx = c.x - a.x, dy = c.y - a.y;
      const d = len(dx, dy);
      if (d >= R2) continue;
      if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
      const push = (R2 - d) / 2;
      // 태클 중인 쪽은 밀리지 않는다(돌진 유지)
      const aw = a.tackleT > 0 ? 0 : 1, cw = c.tackleT > 0 ? 0 : 1;
      const tw = aw + cw || 1;
      a.x -= dx * push * 2 * (aw / tw); a.y -= dy * push * 2 * (aw / tw);
      c.x += dx * push * 2 * (cw / tw); c.y += dy * push * 2 * (cw / tw);
      const rv = (c.vx - a.vx) * dx + (c.vy - a.vy) * dy;
      if (rv < 0) {
        const j2 = -(1 + 0.2) * rv / 2;
        a.vx -= dx * j2 * aw; a.vy -= dy * j2 * aw;
        c.vx += dx * j2 * cw; c.vy += dy * j2 * cw;
      }
    }
  }
}

function tackleContacts(world) {
  const T = PHYS.tackle, R = PHYS.playerR, BR = PHYS.ballR, b = world.ball;
  for (const p of world.players) {
    if (p.tackleT <= 0) continue;
    if (!p.tackleHit) {
      for (const o of world.players) {
        if (o.team === p.team || o.stunT > 0) continue;
        if (len(o.x - p.x, o.y - p.y) > R * 2 + T.hitReach) continue;
        p.tackleHit = true;
        o.stunT = T.stun; o.charge = 0; o.passHold = 0; o.tackleT = 0;
        o.vx = p.tx * 160; o.vy = p.ty * 160;
        // 적중하면 돌진이 멈춘다(상대를 끌고 가지 않음). 회복은 헛스윙보다 짧다
        p.tackleT = 0; p.recoverT = T.recoverHit; p.vx *= 0.2; p.vy *= 0.2; p.tackleBall = false;
        // 공을 가진(가까이 있는) 상대면 공이 튕겨 나온다
        if (len(b.x - o.x, b.y - o.y) <= R + BR + 18) {
          b.vx = p.tx * T.ballKnock; b.vy = p.ty * T.ballKnock; b.spin = 0;
          touch(world, p);
        }
        world.events.push({ type: "tackleHit", id: p.id, victim: o.id, team: p.team });
        break;
      }
    }
    if (!p.tackleBall && len(b.x - p.x, b.y - p.y) <= R + BR + T.hitReach) {
      p.tackleBall = true;
      b.vx = p.tx * T.ballKnock + p.vx * 0.2; b.vy = p.ty * T.ballKnock + p.vy * 0.2; b.spin = 0;
      touch(world, p);
    }
  }
}

function collideBallWithPlayers(world) {
  const b = world.ball, B = PHYS.ball, R = PHYS.playerR, BR = PHYS.ballR;
  for (const p of world.players) {
    let dx = b.x - p.x, dy = b.y - p.y;
    const d = len(dx, dy), min = R + BR;
    if (d >= min) continue;
    if (d < 1e-6) { dx = p.fx; dy = p.fy; } else { dx /= d; dy /= d; }
    // 공을 밖으로 (선수는 자기가 조종하므로 공이 일방적으로 밀려난다)
    b.x = p.x + dx * min; b.y = p.y + dy * min;
    const rv = (b.vx - p.vx) * dx + (b.vy - p.vy) * dy;
    if (rv < 0) {
      const j = -(1 + B.playerE) * rv / (1 / B.mass + 1 / B.playerMass);
      b.vx += dx * j / B.mass; b.vy += dy * j / B.mass;
    }
    touch(world, p);
  }
}

// 선·원 충돌 공통: (cx,cy) 원이 선분 s와 겹치면 밀어내고 속도를 반사
function bounceCircleOnSegment(o, r, seg, e) {
  const [x1, y1, x2, y2] = seg;
  const sx = x2 - x1, sy = y2 - y1;
  const sl2 = sx * sx + sy * sy;
  let t = sl2 > 0 ? ((o.x - x1) * sx + (o.y - y1) * sy) / sl2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + sx * t, py = y1 + sy * t;
  let nx = o.x - px, ny = o.y - py;
  const d = len(nx, ny);
  if (d >= r) return false;
  if (d < 1e-6) { // 정확히 선 위: 선분의 법선 중 원래 쪽
    const sl = Math.sqrt(sl2) || 1;
    nx = -sy / sl; ny = sx / sl;
  } else { nx /= d; ny /= d; }
  o.x = px + nx * r; o.y = py + ny * r;
  const vn = o.vx * nx + o.vy * ny;
  if (vn < 0) { o.vx -= (1 + e) * vn * nx; o.vy -= (1 + e) * vn * ny; }
  return true;
}

function bounceCircleOnPoint(o, r, px, py, e) {
  let nx = o.x - px, ny = o.y - py;
  const d = len(nx, ny);
  if (d >= r) return false;
  if (d < 1e-6) { nx = 1; ny = 0; } else { nx /= d; ny /= d; }
  o.x = px + nx * r; o.y = py + ny * r;
  const vn = o.vx * nx + o.vy * ny;
  if (vn < 0) { o.vx -= (1 + e) * vn * nx; o.vy -= (1 + e) * vn * ny; }
  return true;
}

function wallsForPlayers(world) {
  const R = PHYS.playerR, f = world.field;
  for (const p of world.players) {
    for (const s of world.segs) bounceCircleOnSegment(p, R, s, 0.05);
    for (const [px, py] of world.posts) bounceCircleOnPoint(p, R + PHYS.postR, px, py, 0.05);
    // 최후 안전장치: 어떤 경우에도 경기장 밖으로 못 나감
    p.x = clamp(p.x, R, f.W - R);
    p.y = clamp(p.y, R, f.H - R);
  }
}

function wallsForBall(world) {
  const b = world.ball, BR = PHYS.ballR, B = PHYS.ball;
  for (const s of world.segs) {
    if (s[4]) continue;
    bounceCircleOnSegment(b, BR, s, B.wallE);
  }
  for (const [px, py] of world.posts) {
    if (bounceCircleOnPoint(b, BR + PHYS.postR, px, py, B.postE)) {
      world.events.push({ type: "post" });
    }
  }
}

// 최후 안전장치: 공 중심이 경기장(골문 앞이면 골대 안쪽 포함) 밖에 있으면 안으로 되돌리고 바깥쪽 속도를 없앤다
function containBall(world) {
  const b = world.ball, f = world.field, BR = PHYS.ballR;
  const mouthHalf = f.gw / 2;
  const inMouthSpan = Math.abs(b.y - f.cy) < mouthHalf;
  const minX = inMouthSpan ? -f.gd + BR : BR, maxX = inMouthSpan ? f.W + f.gd - BR : f.W - BR;
  const inGoal = b.x < 0 || b.x > f.W;
  const minY = inGoal ? f.cy - mouthHalf + BR : BR, maxY = inGoal ? f.cy + mouthHalf - BR : f.H - BR;
  if (b.x < minX) { b.x = minX; if (b.vx < 0) b.vx = 0; } else if (b.x > maxX) { b.x = maxX; if (b.vx > 0) b.vx = 0; }
  if (b.y < minY) { b.y = minY; if (b.vy < 0) b.vy = 0; } else if (b.y > maxY) { b.y = maxY; if (b.vy > 0) b.vy = 0; }
}

// 공이 선수와 벽 사이에 끼면 선수가 한 발 물러난다 (공이 달라붙거나 떨리는 현상 방지)
function unpinBall(world) {
  const b = world.ball, R = PHYS.playerR, BR = PHYS.ballR;
  const min = R + BR;
  let moved = false;
  for (const p of world.players) {
    const dx = b.x - p.x, dy = b.y - p.y, d = len(dx, dy);
    const over = min - d;
    if (over <= 0.01) { p.pinT = 0; continue; }
    // 공이 벽에 밀려 선수와 다시 겹침 = 끼임 → 선수가 물러난다
    const nx = d > 1e-6 ? dx / d : p.fx, ny = d > 1e-6 ? dy / d : p.fy;
    p.x -= nx * over; p.y -= ny * over;
    p.pinT += H;
    moved = true;
  }
  if (moved) wallsForPlayers(world);
}

function checkGoal(world) {
  if (world.goalFlag) return;
  const b = world.ball, f = world.field, BR = PHYS.ballR;
  if (Math.abs(b.y - f.cy) >= f.gw / 2) return;
  let scorer = -1;
  if (b.x + BR < 0) scorer = 1;           // 왼쪽 골대로 들어감 → 팀1 득점
  else if (b.x - BR > f.W) scorer = 0;    // 오른쪽 골대 → 팀0 득점
  if (scorer < 0) return;
  world.goalFlag = true;
  world.lastGoal = { team: scorer, scorer: b.lastTouchTeam === scorer ? b.lastTouch : null, own: b.lastTouchTeam >= 0 && b.lastTouchTeam !== scorer, t: world.t };
  const as = world.assist[scorer];
  const assist = !world.lastGoal.own && world.lastGoal.scorer != null && as && as.to === world.lastGoal.scorer && as.from !== as.to && world.t - as.t < 5 ? as.from : null;
  const shot = b.shot && b.shot.team === scorer ? b.shot : null;
  world.events.push({ type: "goal", team: scorer, scorer: world.lastGoal.scorer, own: world.lastGoal.own, by: b.lastTouch, assist, perfect: !!(shot && shot.perfect), speed: shot ? Math.round(shot.speed) : 0 });
}

// ---------- 직렬화 / 검증용 ----------
const r1 = (v) => Math.round(v * 10) / 10;

// 네트워크로 보내는 한 틱 스냅샷 (소수 1자리)
export function packWorld(world) {
  const b = world.ball;
  return {
    k: world.tick,
    b: [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.spin * 100) / 100],
    p: world.players.map((p) => [
      p.id, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy),
      r1(Math.atan2(p.fy, p.fx) * 100) / 100,
      Math.round(p.stamina), r1(p.charge * 100) / 100,
      (p.dashing ? 1 : 0) | (p.tackleT > 0 ? 2 : 0) | (p.stunT > 0 ? 4 : 0) | (p.recoverT > 0 ? 8 : 0) | (p.exhausted ? 16 : 0),
      p.seq,
    ]),
  };
}

// 같은 입력이면 같은 결과인지 비교하는 해시 (테스트용)
export function hashWorld(world) {
  let h = 2166136261 >>> 0;
  const mix = (v) => {
    const s = Math.round(v * 1000);
    h ^= s & 0xffffffff; h = Math.imul(h, 16777619) >>> 0;
  };
  const b = world.ball;
  [b.x, b.y, b.vx, b.vy, b.spin].forEach(mix);
  for (const p of world.players) [p.x, p.y, p.vx, p.vy, p.stamina, p.charge].forEach(mix);
  mix(world.tick);
  return h;
}
