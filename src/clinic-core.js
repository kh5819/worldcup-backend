// =========================
// 게이머 에이징 커브 진단소 — 공용 핵심 (브라우저·서버 동일 파일)
// 문제 생성(시드) · 채점(입력 기록 재생) · 부정 탐지 · 능력치 · 피지컬 나이 · 진단문
// 서버 사본: worldcup-backend/src/clinic-core.js (scripts/test-clinic.mjs가 같은지 검사)
// 외부 import 금지 — 이 파일 하나로 돌아가야 서버에서도 그대로 씀
// =========================

export const CORE_VERSION = 1;

// ---------- 공통 ----------
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}
export function hashSeed(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 꺾은선 보간: pts = [[x,y],...] (x 오름차순 또는 내림차순 모두 가능)
export function curve(x, pts) {
  const p = pts[0][0] <= pts[pts.length - 1][0] ? pts : [...pts].reverse();
  if (x <= p[0][0]) return p[0][1];
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i][0]) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return p[p.length - 1][1];
}
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const r1 = (v) => Math.round(v * 10) / 10;
// 터치 입력 지연 보정(ms) — 반응 측정 종목에만 적용
export const TOUCH_LAG = 20;

// ---------- 능력치 ----------
export const ABILITIES = {
  reaction: { name: "반응속도", short: "반응" },
  memory: { name: "기억력", short: "기억" },
  dexterity: { name: "손가락 민첩성", short: "손놀림" },
  judgment: { name: "판단력", short: "판단" },
  focus: { name: "집중력", short: "집중" },
  aim: { name: "에임 정확도", short: "에임" },
  rhythm: { name: "리듬감", short: "리듬" },
  evasion: { name: "회피 능력", short: "회피" },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

// ---------- 검사 12종 ----------
// dur = 실제 검사 최대 길이(ms, 멀티 라운드 마감 계산용) · room = 검사실 배경 · icon = 아틀라스 이름
export const TESTS = {
  tap: {
    name: "손가락 불나게", sub: "연타 속도", room: "rehab", icon: "boom1", dur: 10000,
    abil: { dexterity: 1 },
    how: ["10초 동안 최대한 빠르게 연타!", "PC: 스페이스·아무 키·클릭", "모바일: 큰 버튼 두 개를 양손으로"],
    unit: "회",
  },
  memory: {
    name: "단기 기억", sub: "순서 기억", room: "neuro", icon: "e_idea", dur: 70000,
    abil: { memory: 1 },
    how: ["불이 켜지는 타일 순서를 기억했다가", "같은 순서로 눌러 주세요", "기회 2번, 길이는 점점 늘어나요"],
    unit: "칸",
  },
  reaction: {
    name: "기절 풀기", sub: "반응속도", room: "er", icon: "e_swirl", dur: 40000,
    abil: { reaction: 1 },
    how: ["기절한 캐릭터를 보고 있다가", "'!' 신호가 뜨는 순간 바로 터치!", "신호 전에 누르면 부정 출발"],
    unit: "ms",
  },
  qwer: {
    name: "스킬콤 QWER", sub: "연속 입력", room: "lab", icon: "spark", dur: 20000,
    abil: { dexterity: 0.55, focus: 0.45 },
    how: ["화면에 뜨는 스킬 콤보를 순서대로 입력", "PC: Q W E R 키 · 모바일: 아래 4버튼", "틀리면 그 콤보는 실패"],
    unit: "콤보",
  },
  lasthit: {
    name: "막타 장인", sub: "체력 계산", room: "ward", icon: "sword", dur: 32000,
    abil: { judgment: 0.6, reaction: 0.4 },
    how: ["몬스터 체력이 내 공격력(노란 선) 이하일 때 공격!", "너무 일찍 치면 막타를 뺏겨요", "공격 후 잠깐 재정비 시간이 있어요"],
    unit: "킬",
  },
  greenlight: {
    name: "초록불 다다닥", sub: "신호 판단", room: "lobby", icon: "e_exclamation", dur: 38000,
    abil: { judgment: 0.55, reaction: 0.45 },
    how: ["초록불이면 바로 터치!", "빨간불이면 절대 누르지 마세요", "참는 것도 실력입니다"],
    unit: "점",
  },
  smash: {
    name: "강타 타이밍", sub: "게이지 맞히기", room: "xray", icon: "hammer", dur: 36000,
    abil: { rhythm: 0.45, focus: 0.55 },
    how: ["움직이는 바늘이 초록 구간에 올 때 터치!", "가운데에 가까울수록 고득점", "8번 내리치고, 점점 빨라져요"],
    unit: "점",
  },
  dodge: {
    name: "불 피하기", sub: "탄막 회피", room: "furnace", icon: "boom2", dur: 30000,
    abil: { evasion: 1 },
    how: ["날아오는 불꽃을 30초 동안 피하세요", "PC: 마우스 또는 방향키·WASD", "모바일: 화면 아무 데나 끌어서 이동"],
    unit: "초",
  },
  rhythm: {
    name: "비트 할아버지", sub: "리듬 입력", room: "music", icon: "e_music", dur: 23000,
    abil: { rhythm: 1 },
    how: ["떨어지는 음표가 선에 닿을 때 입력", "PC: 왼쪽 F · 오른쪽 J", "모바일: 화면 왼쪽·오른쪽 터치"],
    unit: "점",
  },
  aim: {
    name: "에임 도장", sub: "조준 정확도", room: "range", icon: "reticle", dur: 36000,
    abil: { aim: 1 },
    how: ["나타나는 과녁을 빠르고 정확하게 클릭", "빗나가면 정확도 감점", "과녁은 점점 작아져요"],
    unit: "ms",
  },
  stroop: {
    name: "색깔 헷갈림", sub: "색·글자 간섭", room: "eye", icon: "e_question", dur: 25000,
    abil: { judgment: 0.45, focus: 0.55 },
    how: ["'글자 색' 모드: 글자가 칠해진 색을 고르세요", "'글자 뜻' 모드: 글자가 말하는 색을 고르세요", "모드가 중간에 바뀌어요!"],
    unit: "개",
  },
  fly: {
    name: "파리 잡기", sub: "목표 추적", room: "kitchen", icon: "bat", dur: 20000,
    abil: { aim: 0.5, focus: 0.5 },
    how: ["도망 다니는 파리를 따라가세요", "1초 동안 놓치지 않으면 철썩!", "PC: 마우스 · 모바일: 손가락으로 따라가기"],
    unit: "마리",
  },
};
export const TEST_IDS = Object.keys(TESTS);
export const MODES = {
  full: { name: "정밀검사", tests: ["tap", "memory", "reaction", "qwer", "lasthit", "greenlight", "smash", "dodge", "rhythm", "aim", "stroop", "fly"], min: "7~10분" },
  quick: { name: "빠른검사", tests: ["reaction", "tap", "memory", "aim", "stroop"], min: "약 3분" },
};

// =========================================================
// 1) 문제 생성 (같은 시드 = 같은 문제 — 멀티 공정성)
// =========================================================
const GEN = {
  tap: () => ({ dur: 10000 }),

  memory: (R) => {
    const lens = [3, 4, 5, 6, 7, 8, 9];
    const seqs = lens.map((L) => {
      const s = [];
      while (s.length < L) { const t = R.int(0, 15); if (t !== s[s.length - 1]) s.push(t); }
      return s;
    });
    return { grid: 4, lives: 2, flash: 460, gap: 170, seqs };
  },

  reaction: (R) => ({ trials: 5, maxFalse: 4, delays: Array.from({ length: 12 }, () => R.int(1400, 4200)) }),

  qwer: (R) => {
    const combos = [];
    for (let i = 0; i < 90; i++) {
      const L = i < 4 ? 3 : i < 10 ? 4 : R.int(4, 6);
      const c = [];
      while (c.length < L) { const k = R.int(0, 3); if (L <= 3 || k !== c[c.length - 1] || R() < 0.25) c.push(k); }
      combos.push(c);
    }
    return { dur: 20000, combos };
  },

  lasthit: (R) => {
    const minions = [];
    let at = 900;
    for (let i = 0; i < 12; i++) {
      const hp0 = 100 + R.int(0, 10) * 6;
      const hits = [];
      let hp = hp0, t = at + 700 + R.int(0, 300);
      while (hp > 0) { const d = R.int(9, 21); hits.push([t, d]); hp -= d; t += R.int(480, 820); }
      minions.push({ at, slot: i % 3, hp: hp0, hits, kind: R.int(0, 5) });
      at += R.int(1450, 2050);
    }
    const last = minions[minions.length - 1];
    return { dmg: 32, cd: 420, minions, dur: last.hits[last.hits.length - 1][0] + 700 };
  },

  greenlight: (R) => {
    const trials = [];
    let t = 1600, noRun = 0;
    for (let i = 0; i < 26; i++) {
      let go = i < 2 ? true : R() > 0.32;
      if (!go && noRun >= 2) go = true;
      noRun = go ? 0 : noRun + 1;
      trials.push({ at: t, go });
      t += 900 + R.int(500, 1250);
    }
    return { win: 900, trials, dur: t };
  },

  smash: (R) => ({
    timeout: 4000,
    swings: Array.from({ length: 8 }, (_, i) => ({
      speed: 0.55 + i * 0.12 + R() * 0.12,      // 초당 왕복(0→1→0이 2단위)
      c: 0.22 + R() * 0.56,
      w: 0.17 - i * 0.012,
      phase: R(),
    })),
  }),

  dodge: (R) => {
    const B = [];
    const dur = 30000;
    let t = 1200;
    while (t < dur - 600) {
      const k = t / dur;   // 0→1 진행도
      const kind = R.pick(k < 0.25 ? ["rain", "rain", "side"] : k < 0.6 ? ["rain", "side", "ring", "fan"] : ["rain", "side", "ring", "fan", "fan", "cross"]);
      const sp = 0.3 + k * 0.22;
      if (kind === "rain") {
        const n = 3 + Math.floor(k * 4);
        for (let j = 0; j < n; j++) B.push({ t0: t + j * 90, x: 0.05 + R() * 0.9, y: -0.04, vx: (R() - 0.5) * 0.08, vy: sp + R() * 0.1, r: 0.02 });
      } else if (kind === "side") {
        const left = R() < 0.5, y = 0.15 + R() * 0.75;
        for (let j = 0; j < 3; j++) B.push({ t0: t + j * 160, x: left ? -0.04 : 1.04, y: y + (R() - 0.5) * 0.12, vx: (left ? 1 : -1) * (sp + 0.04), vy: (R() - 0.5) * 0.06, r: 0.022 });
      } else if (kind === "ring") {
        const cx = 0.15 + R() * 0.7, cy = -0.03, n = 7 + Math.floor(k * 4), off = R() * Math.PI;
        for (let j = 0; j < n; j++) { const a = off + (Math.PI * (j + 0.5)) / n; B.push({ t0: t, x: cx, y: cy, vx: Math.cos(a) * sp * 0.9, vy: Math.abs(Math.sin(a)) * sp * 0.9, r: 0.018 }); }
      } else if (kind === "fan") {
        const fromLeft = R() < 0.5, cx = fromLeft ? -0.03 : 1.03, cy = 0.05 + R() * 0.4;
        for (let j = 0; j < 5; j++) { const a = (fromLeft ? 0 : Math.PI) + (fromLeft ? 1 : -1) * (0.15 + j * 0.22); B.push({ t0: t + j * 70, x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, r: 0.02 }); }
      } else {
        const y = 0.3 + R() * 0.5, x = 0.2 + R() * 0.6;
        B.push({ t0: t, x: -0.04, y, vx: sp, vy: 0, r: 0.028 }, { t0: t, x: 1.04, y: y + 0.08, vx: -sp, vy: 0, r: 0.028 }, { t0: t + 250, x, y: -0.04, vx: 0, vy: sp, r: 0.028 });
      }
      t += Math.round(820 - k * 470 + R.int(0, 180));
    }
    // 끝나는 시각: 화면 밖으로 나갈 때
    for (const b of B) {
      const tx = b.vx > 0 ? (1.1 - b.x) / b.vx : b.vx < 0 ? (-0.1 - b.x) / b.vx : 1e9;
      const ty = b.vy > 0 ? (1.1 - b.y) / b.vy : b.vy < 0 ? (-0.1 - b.y) / b.vy : 1e9;
      b.t1 = Math.round(b.t0 + Math.min(tx, ty) * 1000);
      for (const k of ["x", "y", "vx", "vy", "r"]) b[k] = Math.round(b[k] * 10000) / 10000;
    }
    B.sort((a, b) => a.t0 - b.t0);
    return { dur, tick: 50, pr: 0.022, speed: 0.95, hp: 3, inv: 1000, start: [0.5, 0.78], B };
  },

  rhythm: (R) => {
    const bpm = 104, beat = 60000 / bpm, start = 2200;
    // 마디 패턴: 8칸(8분음표) — 0 없음, 1 왼쪽, 2 오른쪽
    const P = [
      [1, 0, 2, 0, 1, 0, 2, 0], [1, 0, 1, 0, 2, 0, 2, 0], [1, 0, 2, 0, 1, 2, 0, 0], [2, 0, 1, 0, 2, 0, 1, 1],
      [1, 0, 0, 2, 1, 0, 2, 0], [1, 2, 0, 0, 1, 2, 0, 0], [2, 0, 2, 1, 0, 1, 2, 0], [1, 0, 2, 2, 0, 1, 0, 2],
    ];
    const notes = [];
    for (let bar = 0; bar < 8; bar++) {
      const p = bar === 0 ? P[0] : bar < 3 ? R.pick(P.slice(0, 4)) : R.pick(P);
      p.forEach((v, s) => { if (v) notes.push({ t: Math.round(start + (bar * 8 + s) * beat / 2), l: v - 1 }); });
    }
    return { bpm, beat, start, notes, dur: Math.round(start + 64 * beat / 2 + 900) };
  },

  aim: (R) => {
    const T = [];
    let px = 0.5, py = 0.5;
    for (let i = 0; i < 20; i++) {
      let x, y, n = 0;
      do { x = 0.09 + R() * 0.82; y = 0.1 + R() * 0.8; n++; } while (n < 30 && Math.hypot(x - px, y - py) < 0.28);
      T.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, r: Math.round((0.066 - i * 0.0015) * 1000) / 1000 });
      px = x; py = y;
    }
    return { first: 700, gap: 120, timeout: 1600, T };
  },

  stroop: (R) => {
    const items = [];
    let rule = "ink", left = 8;
    for (let i = 0; i < 90; i++) {
      if (left <= 0) { rule = rule === "ink" ? "word" : "ink"; left = R.int(5, 9); }
      left--;
      const word = R.int(0, 3);
      let ink = word;
      if (R() < 0.75) { do { ink = R.int(0, 3); } while (ink === word); }
      items.push({ w: word, c: ink, r: rule });
    }
    return { dur: 25000, items };
  },

  fly: (R) => {
    const ax = [], ay = [];
    for (let k = 0; k < 3; k++) {
      ax.push([0.24 / (k + 1.4), 0.00075 * (k + 1) * (0.8 + R() * 0.5), R() * 6.28]);
      ay.push([0.24 / (k + 1.4), 0.0008 * (k + 1) * (0.8 + R() * 0.5), R() * 6.28]);
    }
    return { dur: 20000, tick: 50, ax, ay, acc: 0.000016, hitR: 0.085, catchMs: 1000, escMs: 500 };
  },
};

export function genSpec(testId, seed) {
  const g = GEN[testId];
  if (!g) throw new Error("UNKNOWN_TEST");
  return { id: testId, seed: seed >>> 0, ...g(rng(hashSeed(testId) ^ (seed >>> 0))) };
}

// ---------- 화면·채점이 함께 쓰는 계산 ----------
// 막타: 지금까지의 공격 기록(acts=[[minion,t],...])을 반영한 t 시점 몬스터 상태
export function lasthitState(spec, acts, t) {
  const st = spec.minions.map((m) => ({ hp: m.hp, alive: false, dead: false, by: null, at: 0, deadAt: 0, early: 0 }));
  // 모든 사건을 시간순으로
  const ev = [];
  spec.minions.forEach((m, i) => { ev.push([m.at, 0, i, 0]); m.hits.forEach(([ht, d]) => ev.push([ht, 1, i, d])); });
  let lastAtk = -1e9;
  const valid = [];
  for (const a of acts) {
    const i = a[0] | 0, at = num(a[1]);
    if (!(i >= 0 && i < st.length) || !Number.isFinite(at) || at > t) continue;
    if (at - lastAtk < spec.cd) continue;   // 재정비 중 입력 무시
    lastAtk = at; valid.push([at, 2, i, spec.dmg]);
  }
  ev.push(...valid);
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [et, kind, i, d] of ev) {
    if (et > t) break;
    const s = st[i];
    if (kind === 0) { s.alive = true; continue; }
    if (!s.alive || s.dead) continue;
    if (kind === 1) {
      s.hp -= d;
      if (s.hp <= 0) { s.hp = 0; s.dead = true; s.alive = false; s.by = "ally"; s.deadAt = et; }
    } else {
      if (s.hp <= spec.dmg) { s.killHp = s.hp; s.hp = 0; s.dead = true; s.alive = false; s.by = "me"; s.deadAt = et; }
      else { s.hp -= spec.dmg; s.early++; }
    }
  }
  return { minions: st, lastAtk };
}

export function smashPos(sw, ms) {
  const x = sw.phase * 2 + (ms / 1000) * sw.speed * 2;
  const m = x % 2;
  return m <= 1 ? m : 2 - m;
}

export function flyPos(spec, t) {
  const tau = t + spec.acc * t * t;
  let x = 0.5, y = 0.5;
  for (const [A, w, p] of spec.ax) x += A * Math.sin(w * tau + p);
  for (const [A, w, p] of spec.ay) y += A * Math.sin(w * tau + p * 1.3);
  return [clamp(x, 0.07, 0.93), clamp(y, 0.09, 0.91)];
}

export function dodgeBulletPos(b, t) {
  const s = (t - b.t0) / 1000;
  return [b.x + b.vx * s, b.y + b.vy * s];
}

// 불 피하기 한 틱 진행 (화면·서버 공용) — st: {hp, inv, hits, graze, last:[x,y], dead, t}
export function dodgeStep(spec, st, i, x, y) {
  const t = i * spec.tick;
  const out = { hit: false, graze: false };
  if (st.dead) return out;
  if (st.last) {
    const d = Math.hypot(x - st.last[0], y - st.last[1]);
    const lim = spec.speed * spec.tick / 1000 * 1.3 + 0.004;
    if (d > lim) { st.warp = (st.warp || 0) + 1; const k = lim / d; x = st.last[0] + (x - st.last[0]) * k; y = st.last[1] + (y - st.last[1]) * k; }
  }
  x = clamp(x, 0.02, 0.98); y = clamp(y, 0.02, 0.98);
  st.last = [x, y]; st.t = t;
  let near = false;
  for (let j = st.from || 0; j < spec.B.length; j++) {
    const b = spec.B[j];
    if (b.t0 > t) break;
    if (b.t1 < t) { if (j === (st.from || 0)) st.from = j + 1; continue; }
    const [bx, by] = dodgeBulletPos(b, t);
    const d = Math.hypot(bx - x, by - y);
    if (d < spec.pr + b.r) {
      if (t >= st.inv) { st.hp--; st.hits++; st.inv = t + spec.inv; out.hit = true; out.bullet = j; if (st.hp <= 0) { st.dead = true; st.deadAt = t; } }
    } else if (d < spec.pr + b.r + 0.028) near = true;
  }
  if (near && !out.hit && t >= st.inv) {
    if (!st.grazeOn) { st.graze++; out.graze = true; }
    st.grazeOn = true;
  } else st.grazeOn = false;
  return out;
}
export function dodgeInit(spec) { return { hp: spec.hp, inv: 0, hits: 0, graze: 0, last: null, dead: false, deadAt: 0, from: 0, warp: 0 }; }

// 파리 잡기 한 틱 (화면·서버 공용) — st: {on, streak, catches, esc, ticks, onTicks, dsum}
export function flyStep(spec, st, i, x, y, down) {
  const t = i * spec.tick;
  const [fx, fy] = flyPos(spec, t);
  const d = Math.hypot(fx - x, fy - y);
  const out = { caught: false, on: false };
  if (t < st.esc) { return out; }
  st.ticks++;
  if (down && d < spec.hitR) {
    st.onTicks++; st.dsum += d; st.streak += spec.tick; out.on = true;
    if (st.streak >= spec.catchMs) { st.catches++; st.streak = 0; st.esc = t + spec.escMs; out.caught = true; }
  } else st.streak = Math.max(0, st.streak - spec.tick * 2);
  return out;
}
export function flyInit() { return { streak: 0, catches: 0, esc: 0, ticks: 0, onTicks: 0, dsum: 0 }; }

// 에임: 클릭 기록을 차례대로 처리 (화면·서버 공용)
export function aimReplay(spec, clicks, upTo = Infinity) {
  let i = 0, appear = spec.first, hits = 0, miss = 0, early = 0;
  const tth = [];
  const res = [];
  const expireUntil = (t) => {
    while (i < spec.T.length && t > appear + spec.timeout) { res.push({ i, hit: false }); appear = appear + spec.timeout + spec.gap; i++; }
  };
  for (const c of clicks) {
    const t = num(c[0]), x = num(c[1]) / 1000, y = num(c[2]) / 1000;
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y) || t > upTo) continue;
    expireUntil(t);
    if (i >= spec.T.length) break;
    if (t < appear) { early++; miss++; continue; }
    const g = spec.T[i];
    if (Math.hypot(x - g.x, y - g.y) <= g.r) { hits++; tth.push(t - appear); res.push({ i, hit: true, ms: t - appear }); appear = t + spec.gap; i++; }
    else miss++;
  }
  if (upTo !== Infinity) expireUntil(upTo);
  return { idx: i, appear, hits, miss, early, tth, res, done: i >= spec.T.length };
}

// 리듬: 입력을 음표에 맞추기 (bias=지연 보정값)
export function rhythmJudge(spec, hits, bias = 0) {
  const used = new Array(spec.notes.length).fill(false);
  const match = [];
  let extra = 0;
  for (const h of hits) {
    const l = h[0] | 0, t = num(h[1]);
    if (!Number.isFinite(t)) continue;
    let best = -1, bd = 1e9;
    for (let j = 0; j < spec.notes.length; j++) {
      const n = spec.notes[j];
      if (used[j] || n.l !== l) continue;
      const d = Math.abs(t - bias - n.t);
      if (d < bd) { bd = d; best = j; }
      if (n.t > t + 400) break;
    }
    if (best >= 0 && bd <= 140) { used[best] = true; match.push({ j: best, dt: t - spec.notes[best].t }); }
    else extra++;
  }
  return { used, match, extra };
}
export function rhythmGrade(d) { return d <= 38 ? 3 : d <= 75 ? 2 : d <= 130 ? 1 : 0; }

// =========================================================
// 2) 채점 — log는 클라 입력 기록, ctx = { device: "pc"|"mobile" }
//    반환 { score 0~100, m: 기록, flags: [], line: 한 줄 요약 }
// =========================================================
const SCORE = {
  tap(spec, log) {
    const t = arr(log?.t, 400).map(num).filter((v) => v >= 0 && v <= spec.dur + 60).sort((a, b) => a - b);
    const n = t.length;
    const iv = []; for (let i = 1; i < n; i++) iv.push(t[i] - t[i - 1]);
    const cv = iv.length > 4 ? std(iv) / (mean(iv) || 1) : 1;
    const tps = n / (spec.dur / 1000);
    let peak = 0; for (let i = 0, j = 0; i < n; i++) { while (t[i] - t[j] > 1000) j++; peak = Math.max(peak, i - j + 1); }
    const flags = [];
    if (tps > 18 || peak > 24) flags.push("MACRO_SPEED");
    if (n >= 40 && cv < 0.035) flags.push("MACRO_RHYTHM");
    const speed = curve(tps, [[0, 0], [3, 10], [5, 35], [7, 60], [9, 78], [11, 90], [13, 97], [15, 100]]);
    const cons = n >= 6 ? 100 * (1 - clamp((cv - 0.08) / 0.5, 0, 1)) : 0;
    return { score: 0.85 * speed + 0.15 * cons, m: { taps: n, tps: r1(tps), peak, cv: Math.round(cv * 100) / 100 }, flags, line: `${n}회 · 초당 ${r1(tps)}회` };
  },

  memory(spec, log) {
    const rounds = arr(log?.r, 20);
    let lives = spec.lives, span = 0, fails = 0, ri = 0;
    const msPer = [];
    for (const r of rounds) {
      if (lives <= 0 || ri >= spec.seqs.length) break;
      const seq = spec.seqs[ri];
      const k = arr(r?.k, 20).map((v) => v | 0);
      const ok = k.length === seq.length && k.every((v, i) => v === seq[i]);
      const ms = num(r?.ms);
      if (Number.isFinite(ms) && k.length) msPer.push(ms / k.length);
      if (ok) span = seq.length; else { fails++; lives--; }
      ri++;
    }
    const flags = [];
    const avg = mean(msPer);
    if (span >= 6 && avg > 0 && avg < 95) flags.push("BOT_MEMORY");
    const score = curve(span, [[0, 0], [2, 10], [3, 22], [4, 35], [5, 48], [6, 62], [7, 76], [8, 88], [9, 100]]) - fails * 5;
    return { score, m: { span, fails, msPer: Math.round(avg) }, flags, line: span ? `${span}칸까지 기억` : "기억 실패" };
  },

  reaction(spec, log, ctx) {
    const tr = arr(log?.tr, 14).map(num).filter(Number.isFinite);
    const lag = ctx?.device === "mobile" ? TOUCH_LAG : 0;
    const rts = []; let fs = 0, anti = 0;
    for (const v of tr) {
      if (rts.length >= spec.trials) break;
      if (v < 0) { fs++; continue; }
      const a = v - lag;
      if (a < 100) { anti++; fs++; continue; }
      rts.push(Math.min(a, 1500));
    }
    const flags = [];
    if (anti >= 2) flags.push("ANTICIPATE");
    if (rts.length >= 5 && std(rts) < 4) flags.push("BOT_RT");
    if (rts.length < 3) return { score: Math.max(0, 10 - fs * 3), m: { med: 0, best: 0, sd: 0, fs }, flags, line: "측정 불가" };
    const med = median(rts), sd = std(rts);
    const speed = curve(med, [[150, 100], [190, 94], [220, 85], [250, 74], [280, 63], [320, 50], [370, 36], [450, 20], [600, 5], [900, 0]]);
    const cons = 100 * (1 - clamp((sd - 15) / 120, 0, 1));
    return { score: 0.88 * speed + 0.12 * cons - fs * 7, m: { med: Math.round(med), best: Math.round(Math.min(...rts)), sd: Math.round(sd), fs }, flags, line: `평균 ${Math.round(med)}ms` };
  },

  qwer(spec, log) {
    const k = arr(log?.k, 600);
    let idx = 0, pos = 0, ok = 0, bad = 0, done = 0, fast = 0, prev = -1e9;
    for (const e of k) {
      const key = e?.[0] | 0, t = num(e?.[1]);
      if (!Number.isFinite(t) || t < 0 || t > spec.dur + 60 || t < prev) continue;
      if (t - prev < 25) fast++;
      prev = t;
      const c = spec.combos[idx]; if (!c) break;
      if (key === c[pos]) { ok++; pos++; if (pos === c.length) { done++; idx++; pos = 0; } }
      else { bad++; idx++; pos = 0; }
    }
    const kps = ok / (spec.dur / 1000), acc = ok + bad ? ok / (ok + bad) : 0;
    const flags = fast > 10 ? ["MACRO_SPEED"] : [];
    const speed = curve(kps, [[0, 0], [1, 15], [2, 38], [3, 58], [4, 74], [5, 86], [6, 94], [7.5, 100]]);
    return { score: speed * Math.pow(acc, 1.5), m: { combos: done, kps: r1(kps), acc: Math.round(acc * 100), bad }, flags, line: `${done}콤보 · 정확도 ${Math.round(acc * 100)}%` };
  },

  lasthit(spec, log) {
    const acts = arr(log?.a, 200).filter((a) => Array.isArray(a)).map((a) => [a[0] | 0, num(a[1])]).filter((a) => Number.isFinite(a[1])).sort((a, b) => a[1] - b[1]);
    const { minions } = lasthitState(spec, acts, spec.dur + 1000);
    const kills = minions.filter((s) => s.by === "me");
    const early = minions.reduce((s, m) => s + m.early, 0);
    const prec = kills.length ? mean(kills.map((s) => 1 - (s.killHp || 0) / spec.dmg)) : 0;
    const k = kills.length, n = spec.minions.length;
    const score = (100 * k / n) * 0.86 + prec * 14 * (k / n) - early * 2.5;
    return { score, m: { kills: k, of: n, early, lost: n - k, prec: Math.round(prec * 100) }, flags: [], line: `${k}/${n} 막타` };
  },

  greenlight(spec, log, ctx) {
    const taps = arr(log?.t, 300).map(num).filter(Number.isFinite).sort((a, b) => a - b);
    const lag = ctx?.device === "mobile" ? TOUCH_LAG : 0;
    let hit = 0, omit = 0, comm = 0, stray = 0;
    const rts = [];
    const used = new Set();
    for (const tr of spec.trials) {
      const first = taps.find((t) => t >= tr.at && t < tr.at + spec.win);
      if (first !== undefined) used.add(first);
      if (tr.go) { if (first !== undefined) { hit++; rts.push(Math.max(80, first - tr.at - lag)); } else omit++; }
      else if (first !== undefined) comm++;
    }
    stray = taps.filter((t) => !used.has(t)).length;
    const goN = spec.trials.filter((t) => t.go).length, noN = spec.trials.length - goN;
    const med = median(rts);
    const flags = rts.length >= 10 && std(rts) < 5 ? ["BOT_RT"] : [];
    const speed = rts.length ? curve(med, [[200, 100], [260, 85], [320, 68], [400, 45], [500, 25], [650, 5]]) : 0;
    const score = (hit / goN) * 25 + speed * 0.45 + (1 - comm / Math.max(1, noN)) * 30 - Math.min(10, stray * 2);
    return { score, m: { hit, omit, comm, stray, med: Math.round(med) }, flags, line: `실수 ${comm + omit}번 · ${Math.round(med)}ms` };
  },

  smash(spec, log) {
    const s = arr(log?.s, spec.swings.length).map(num);
    let sum = 0, perfect = 0;
    const errs = [];
    spec.swings.forEach((sw, i) => {
      const ms = s[i];
      if (!Number.isFinite(ms) || ms < 0 || ms > spec.timeout) { errs.push(1); return; }
      const d = Math.abs(smashPos(sw, ms) - sw.c), half = sw.w / 2;
      errs.push(d);
      if (d <= sw.w * 0.12) perfect++;
      sum += d <= half ? 100 - 40 * (d / half) : Math.max(0, 50 - (d - half) * 260);
    });
    return { score: sum / spec.swings.length, m: { perfect, err: Math.round(mean(errs) * 1000) / 10 }, flags: [], line: `퍼펙트 ${perfect}번` };
  },

  dodge(spec, log) {
    const p = arr(log?.p, 2 * (spec.dur / spec.tick + 2)).map(num);
    const st = dodgeInit(spec);
    const n = Math.floor(p.length / 2);
    let i = 0;
    for (; i < n && i * spec.tick <= spec.dur; i++) {
      const x = p[i * 2] / 1000, y = p[i * 2 + 1] / 1000;
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      dodgeStep(spec, st, i, x, y);
      if (st.dead) break;
    }
    const lastT = st.dead ? st.deadAt : Math.min(spec.dur, (i - 1) * spec.tick);
    const surv = clamp(lastT / spec.dur, 0, 1);
    const flags = st.warp > 6 ? ["WARP"] : [];
    const score = st.dead ? surv * 70 : 70 * surv + 30 * (st.hp / spec.hp);
    return { score, m: { sec: r1(lastT / 1000), hits: st.hits, graze: st.graze, dead: st.dead }, flags, line: st.dead ? `${r1(lastT / 1000)}초 생존` : `완주 · 피격 ${st.hits}번` };
  },

  rhythm(spec, log) {
    const hits = arr(log?.h, 300).filter(Array.isArray);
    let { match } = rhythmJudge(spec, hits, 0);
    let bias = 0;
    if (match.length >= 8) bias = clamp(median(match.map((m) => m.dt)), -70, 70);
    const J = rhythmJudge(spec, hits, bias);
    match = J.match;
    const grade = new Array(spec.notes.length).fill(0);
    for (const m of match) grade[m.j] = rhythmGrade(Math.abs(m.dt - bias));
    let pf = 0, gr = 0, gd = 0, combo = 0, maxCombo = 0;
    for (const g of grade) { if (g === 3) pf++; else if (g === 2) gr++; else if (g === 1) gd++; combo = g ? combo + 1 : 0; maxCombo = Math.max(maxCombo, combo); }
    const miss = spec.notes.length - pf - gr - gd;
    const raw = (pf * 100 + gr * 75 + gd * 40) / spec.notes.length;
    const flags = hits.length > spec.notes.length * 2.5 ? ["MASH"] : [];
    return { score: raw - Math.min(15, J.extra), m: { pf, gr, gd, miss, combo: maxCombo, bias: Math.round(bias), of: spec.notes.length }, flags, line: `퍼펙트 ${pf} · 미스 ${miss}` };
  },

  aim(spec, log) {
    const c = arr(log?.c, 300).filter(Array.isArray).sort((a, b) => num(a[0]) - num(b[0]));
    const r = aimReplay(spec, c);
    const n = spec.T.length;
    const pts = r.tth.map((ms) => curve(ms, [[250, 100], [400, 90], [550, 76], [700, 62], [900, 45], [1200, 25], [1600, 10]]));
    const acc = r.hits + r.miss ? r.hits / (r.hits + r.miss) : 0;
    const avg = mean(r.tth);
    const flags = r.tth.length >= 8 && median(r.tth) < 130 ? ["BOT_AIM"] : [];
    return { score: (pts.reduce((a, b) => a + b, 0) / n) * (0.6 + 0.4 * acc), m: { hits: r.hits, miss: r.miss, of: n, avg: Math.round(avg), acc: Math.round(acc * 100) }, flags, line: `${r.hits}/${n} 명중 · ${Math.round(avg)}ms` };
  },

  stroop(spec, log) {
    const a = arr(log?.a, spec.items.length).filter(Array.isArray);
    let ok = 0, bad = 0, prev = 0, fast = 0;
    const rts = [];
    a.forEach((e, i) => {
      const ch = e[0] | 0, t = num(e[1]);
      if (!Number.isFinite(t) || t < prev || t > spec.dur + 60) return;
      const it = spec.items[i];
      const ans = it.r === "ink" ? it.c : it.w;
      if (ch === ans) ok++; else bad++;
      if (t - prev < 150) fast++;
      rts.push(t - prev); prev = t;
    });
    const acc = ok + bad ? ok / (ok + bad) : 0;
    const flags = fast > 8 && acc > 0.95 ? ["BOT_STROOP"] : [];
    const sp = curve(ok, [[0, 0], [8, 20], [14, 40], [20, 60], [26, 78], [32, 92], [38, 100]]);
    return { score: sp * acc * acc, m: { ok, bad, acc: Math.round(acc * 100), rt: Math.round(mean(rts)) }, flags, line: `${ok}개 정답 · 오답 ${bad}` };
  },

  fly(spec, log) {
    const p = arr(log?.p, 3 * (spec.dur / spec.tick + 2)).map(num);
    const st = flyInit();
    const n = Math.floor(p.length / 3);
    for (let i = 0; i < n && i * spec.tick <= spec.dur; i++) {
      const x = p[i * 3] / 1000, y = p[i * 3 + 1] / 1000, down = p[i * 3 + 2] ? 1 : 0;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      flyStep(spec, st, i, x, y, down);
    }
    const total = Math.floor(spec.dur / spec.tick);
    const ratio = st.onTicks / Math.max(1, Math.max(st.ticks, total * 0.7));
    const flags = st.onTicks > 100 && st.dsum / st.onTicks < 0.004 ? ["BOT_TRACK"] : [];
    return { score: ratio * 80 + st.catches * 2.5, m: { ratio: Math.round(ratio * 100), catches: st.catches }, flags, line: `${st.catches}마리 · 추적 ${Math.round(ratio * 100)}%` };
  },
};

export function scoreTest(testId, spec, log, ctx = {}) {
  const f = SCORE[testId];
  if (!f) throw new Error("UNKNOWN_TEST");
  let r;
  try { r = f(spec, log || {}, ctx); } catch { r = { score: 0, m: {}, flags: ["BAD_LOG"], line: "기록 오류" }; }
  let score = Math.round(clamp(Number.isFinite(r.score) ? r.score : 0, 0, 100));
  if (r.flags.length) score = Math.min(score, 40);   // 의심 기록은 40점 상한 + 랭킹 제외
  return { id: testId, score, m: r.m, flags: r.flags, line: r.flags.includes("BAD_LOG") ? r.line : lineOf(testId, r.m, "ko") };
}

// =========================================================
// 3) 종합: 능력치 · 피지컬 나이 · 판정
// =========================================================
export function abilities(scores) {
  const out = {};
  for (const a of ABILITY_IDS) {
    let s = 0, w = 0;
    for (const [tid, sc] of Object.entries(scores)) {
      const ww = TESTS[tid]?.abil?.[a];
      if (ww && Number.isFinite(sc)) { s += sc * ww; w += ww; }
    }
    out[a] = w ? Math.round(s / w) : null;
  }
  return out;
}
export function totalScore(scores) {
  const v = Object.values(scores).filter(Number.isFinite);
  return v.length ? Math.round(mean(v)) : 0;
}
// 오락용 추정치 — 실제 연령대 기준 데이터 없음
export function physicalAge(total) {
  return Math.round(curve(total, [[0, 75], [10, 67], [20, 58], [28, 50], [36, 43], [44, 37], [52, 32], [60, 28], [68, 25], [76, 22], [84, 19], [92, 17], [100, 15]]));
}
export function verdictOf(diff) {
  if (diff <= -8) return { key: "young", name: "회춘 판정", color: "#2fae58", stamp: "회춘" };
  if (diff <= 3) return { key: "ok", name: "현역 판정", color: "#3c7ce8", stamp: "현역" };
  if (diff <= 12) return { key: "warn", name: "에이징 주의", color: "#e8a23c", stamp: "주의" };
  return { key: "care", name: "집중 관리 필요", color: "#e8463c", stamp: "관리" };
}
export function ageGroup(age) {
  if (age < 20) return "10대 이하";
  if (age >= 60) return "60대 이상";
  return `${Math.floor(age / 10) * 10}대`;
}

// ---------- 프로필 검증 (닉네임·성별·나이·캐릭터) ----------
export const AVATAR = {
  skins: [[0, 0], [0, 1], [0, 2], [0, 3]],
  skinNames: ["밝은", "중간", "짙은", "초록(외계인)"],
  hairColors: [[19, 0], [23, 0], [19, 4], [23, 4], [19, 8]],
  hairColorNames: ["갈색", "주황", "금발", "검정", "은발"],
  hairStyles: [[0, 0], [0, 1], [2, 1], [1, 1], [3, 1], [1, 2], [2, 2], [2, 0], [3, 0], null],
  hairStyleNames: ["짧은", "단정", "긴", "땋은", "양갈래", "상투", "부스스", "콧수염", "턱수염", "민머리"],
  shirts: [[10, 0], [14, 0], [6, 0], [6, 5], [10, 5], [14, 5], [6, 9], [10, 9], [14, 9], [6, 4], [14, 4], [7, 1]],
  pants: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 6], [3, 8]],
  hats: [null, [28, 2], [29, 3], [30, 4], [31, 5], [28, 7], [28, 8], [28, 0], [28, 6]],
  hatNames: ["없음", "머리띠", "청록 모자", "보라 모자", "초록 모자", "챙 모자", "마법사 모자", "투구", "바이킹"],
};
export function defaultAvatar(gender, seed = 1) {
  const R = rng(seed);
  return { skin: R.int(0, 2), hc: R.int(0, 4), hs: gender === "f" ? R.pick([2, 3, 4, 5]) : R.pick([0, 1, 6]), shirt: R.int(0, 11), pants: R.int(0, 6), hat: 0 };
}
export function sanitizeProfile(p) {
  const nick = String(p?.nick ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
  const gender = p?.gender === "f" ? "f" : p?.gender === "m" ? "m" : null;
  const age = Math.round(Number(p?.age));
  if (!nick || !gender || !(age >= 7 && age <= 99)) return null;
  const a = p?.avatar || {};
  const pickI = (v, n) => { const k = Math.round(Number(v)); return k >= 0 && k < n ? k : 0; };
  const avatar = {
    skin: pickI(a.skin, AVATAR.skins.length), hc: pickI(a.hc, AVATAR.hairColors.length), hs: pickI(a.hs, AVATAR.hairStyles.length),
    shirt: pickI(a.shirt, AVATAR.shirts.length), pants: pickI(a.pants, AVATAR.pants.length), hat: pickI(a.hat, AVATAR.hats.length),
  };
  return { nick, gender, age, avatar };
}
// 캐릭터 부품 → chars.png 칸 좌표 목록(그리는 순서)
export function avatarParts(av) {
  const P = [AVATAR.skins[av.skin], AVATAR.pants[av.pants], [4, AVATAR.pants[av.pants][1]], AVATAR.shirts[av.shirt]];
  const hs = AVATAR.hairStyles[av.hs];
  if (hs) { const [c, r] = AVATAR.hairColors[av.hc]; P.push([c + hs[0], r + hs[1]]); }
  const hat = AVATAR.hats[av.hat];
  if (hat) P.push(hat);
  return P;
}

// =========================================================
// 4) 다국어 글자 (ko 원문 · ja · en) — 목록은 세 언어가 같은 순서·같은 길이 (같은 시드 = 같은 선택)
// =========================================================
export const LANGS = ["ko", "ja", "en"];
const lg = (lang) => (lang === "ja" || lang === "en" ? lang : "ko");
const pk = (pool, lang) => pool[lg(lang)] || pool.ko;
function fill(tpl, m) { return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (m?.[k] ?? "?")); }

const TEST_TX = {
  tap: { ja: ["指が燃えるほど", "連打速度", ["10秒間できるだけ速く連打！", "PC: スペース・任意のキー・クリック", "モバイル: 大きなボタン2つを両手で"]], en: ["Finger Fire", "Tap speed", ["Tap as fast as you can for 10 seconds!", "PC: Space, any key or click", "Mobile: hit the two big buttons with both thumbs"]] },
  memory: { ja: ["短期記憶", "順番記憶", ["光るタイルの順番を覚えて", "同じ順番で押してください", "チャンスは2回、長さはだんだん増えます"]], en: ["Short-term Memory", "Sequence recall", ["Watch the order the tiles light up", "Press them back in the same order", "2 lives, and the sequence keeps growing"]] },
  reaction: { ja: ["気絶から復帰", "反応速度", ["気絶したキャラを見ていて", "「！」が出た瞬間にタッチ！", "合図の前に押すとフライング"]], en: ["Stun Breaker", "Reaction time", ["Watch your stunned character", "Tap the instant the \"!\" appears", "Pressing early is a false start"]] },
  qwer: { ja: ["スキルコンボQWER", "連続入力", ["画面のスキルコンボを順番に入力", "PC: Q W E R キー・モバイル: 下の4ボタン", "間違えるとそのコンボは失敗"]], en: ["QWER Skill Combo", "Combo input", ["Enter the skill combo shown, in order", "PC: Q W E R keys · Mobile: the 4 buttons", "One wrong key breaks the combo"]] },
  lasthit: { ja: ["ラストヒット職人", "体力計算", ["モンスターの体力が自分の攻撃力（黄色い線）以下で攻撃！", "早すぎるとラストヒットを取られます", "攻撃後は少し構え直し時間があります"]], en: ["Last-Hit Master", "HP math", ["Strike when HP drops below your damage (yellow line)!", "Hit too early and you lose the last hit", "There's a short cooldown after each swing"]] },
  greenlight: { ja: ["青信号ダダダッ", "信号判断", ["青信号ならすぐタッチ！", "赤信号では絶対に押さないで", "我慢するのも実力です"]], en: ["Green Light Dash", "Go / no-go", ["Green light? Tap right away!", "Red light? Don't you dare press", "Holding back is a skill too"]] },
  smash: { ja: ["スマイトタイミング", "ゲージ合わせ", ["動く針が緑ゾーンに来たらタッチ！", "中央に近いほど高得点", "8回叩き、だんだん速くなります"]], en: ["Smite Timing", "Gauge timing", ["Tap when the needle hits the green zone!", "Closer to the center scores higher", "8 swings, getting faster each time"]] },
  dodge: { ja: ["炎よけ", "弾幕回避", ["飛んでくる炎を30秒間よけ続けよう", "PC: マウスまたは矢印キー・WASD", "モバイル: 画面のどこでもドラッグで移動"]], en: ["Fire Dodge", "Bullet dodging", ["Dodge the incoming fireballs for 30 seconds", "PC: mouse, arrow keys or WASD", "Mobile: drag anywhere to move"]] },
  rhythm: { ja: ["ビートじいさん", "リズム入力", ["落ちてくる音符が線に重なったら入力", "PC: 左 F・右 J", "モバイル: 画面の左右をタッチ"]], en: ["Beat Grandpa", "Rhythm input", ["Hit the notes as they reach the line", "PC: F for left · J for right", "Mobile: tap the left or right side"]] },
  aim: { ja: ["エイム道場", "照準精度", ["現れる的を素早く正確にクリック", "外すと精度が下がります", "的はだんだん小さくなります"]], en: ["Aim Dojo", "Aim accuracy", ["Click the targets fast and accurately", "Misses lower your accuracy", "Targets keep getting smaller"]] },
  stroop: { ja: ["色まどわし", "色と文字の干渉", ["「文字の色」モード: 文字に塗られた色を選ぶ", "「文字の意味」モード: 文字が示す色を選ぶ", "モードは途中で切り替わります！"]], en: ["Color Confusion", "Stroop test", ["\"Ink\" mode: pick the color the word is painted in", "\"Meaning\" mode: pick the color the word says", "The mode switches mid-test!"]] },
  fly: { ja: ["ハエたたき", "目標追跡", ["逃げ回るハエを追いかけよう", "1秒間逃がさなければバシッ！", "PC: マウス・モバイル: 指で追いかける"]], en: ["Fly Swatter", "Target tracking", ["Chase the buzzing fly", "Stay on it for 1 second — SWAT!", "PC: mouse · Mobile: follow with your finger"]] },
};
export function testName(tid, lang) { const t = TESTS[tid]; const x = TEST_TX[tid]?.[lg(lang)]; return x ? x[0] : t?.name || tid; }
export function testSub(tid, lang) { const t = TESTS[tid]; const x = TEST_TX[tid]?.[lg(lang)]; return x ? x[1] : t?.sub || ""; }
export function testHow(tid, lang) { const t = TESTS[tid]; const x = TEST_TX[tid]?.[lg(lang)]; return x ? x[2] : t?.how || []; }
const MODE_TX = { full: { ko: ["정밀검사", "7~10분"], ja: ["精密検査", "7〜10分"], en: ["Full Checkup", "7-10 min"] }, quick: { ko: ["빠른검사", "약 3분"], ja: ["クイック検査", "約3分"], en: ["Quick Checkup", "~3 min"] } };
export function modeName(mode, lang) { return MODE_TX[mode]?.[lg(lang)]?.[0] || mode; }
const AB_TX = {
  reaction: { ja: ["反応速度", "反応"], en: ["Reaction", "React"] }, memory: { ja: ["記憶力", "記憶"], en: ["Memory", "Memory"] },
  dexterity: { ja: ["指の器用さ", "指先"], en: ["Finger dexterity", "Fingers"] }, judgment: { ja: ["判断力", "判断"], en: ["Judgment", "Judge"] },
  focus: { ja: ["集中力", "集中"], en: ["Focus", "Focus"] }, aim: { ja: ["エイム精度", "エイム"], en: ["Aim accuracy", "Aim"] },
  rhythm: { ja: ["リズム感", "リズム"], en: ["Rhythm", "Rhythm"] }, evasion: { ja: ["回避能力", "回避"], en: ["Evasion", "Evade"] },
};
export function abilityName(a, lang, short = false) { const x = AB_TX[a]?.[lg(lang)]; return x ? x[short ? 1 : 0] : ABILITIES[a]?.[short ? "short" : "name"] || a; }
export const AVATAR_TX = {
  ja: { skin: ["明るい", "中間", "濃い", "緑（宇宙人）"], hc: ["茶色", "オレンジ", "金髪", "黒", "銀髪"], hs: ["ショート", "きっちり", "ロング", "三つ編み", "ツインテール", "ちょんまげ", "ぼさぼさ", "口ひげ", "あごひげ", "スキンヘッド"], hat: ["なし", "ヘアバンド", "青緑の帽子", "紫の帽子", "緑の帽子", "つば帽子", "魔法使いの帽子", "かぶと", "バイキング"] },
  en: { skin: ["Light", "Medium", "Dark", "Green (alien)"], hc: ["Brown", "Orange", "Blond", "Black", "Silver"], hs: ["Short", "Neat", "Long", "Braid", "Pigtails", "Topknot", "Messy", "Mustache", "Beard", "Bald"], hat: ["None", "Headband", "Teal cap", "Purple cap", "Green cap", "Brim hat", "Wizard hat", "Helmet", "Viking"] },
};
const VERDICT_TX = {
  young: { ko: ["회춘 판정", "회춘"], ja: ["若返り判定", "若返"], en: ["Rejuvenated", "YOUNG"] },
  ok: { ko: ["현역 판정", "현역"], ja: ["現役判定", "現役"], en: ["Still in prime", "PRIME"] },
  warn: { ko: ["에이징 주의", "주의"], ja: ["エイジング注意", "注意"], en: ["Aging alert", "ALERT"] },
  care: { ko: ["집중 관리 필요", "관리"], ja: ["要集中ケア", "要ケア"], en: ["Needs intensive care", "CARE"] },
};
export function verdictText(key, lang) { const x = VERDICT_TX[key]?.[lg(lang)] || VERDICT_TX[key]?.ko; return { name: x[0], stamp: x[1] }; }
export function ageGroupText(age, lang) {
  const L = lg(lang);
  if (age < 20) return { ko: "10대 이하", ja: "10代以下", en: "Teens & under" }[L];
  if (age >= 60) return { ko: "60대 이상", ja: "60代以上", en: "60+" }[L];
  const d = Math.floor(age / 10) * 10;
  return { ko: `${d}대`, ja: `${d}代`, en: `${d}s` }[L];
}

// 검사 한 줄 요약 (서버는 ko로 저장, 화면은 보는 사람 언어로 다시 만듦)
export function lineOf(tid, m = {}, lang = "ko") {
  const L = lg(lang);
  const T = {
    tap: { ko: `${m.taps}회 · 초당 ${m.tps}회`, ja: `${m.taps}回・毎秒${m.tps}回`, en: `${m.taps} taps · ${m.tps}/s` },
    memory: m.span ? { ko: `${m.span}칸까지 기억`, ja: `${m.span}マスまで記憶`, en: `Remembered ${m.span} tiles` } : { ko: "기억 실패", ja: "記憶失敗", en: "Memory failed" },
    reaction: m.med ? { ko: `평균 ${m.med}ms`, ja: `平均${m.med}ms`, en: `Avg ${m.med}ms` } : { ko: "측정 불가", ja: "測定不能", en: "No reading" },
    qwer: { ko: `${m.combos}콤보 · 정확도 ${m.acc}%`, ja: `${m.combos}コンボ・精度${m.acc}%`, en: `${m.combos} combos · ${m.acc}% accuracy` },
    lasthit: { ko: `${m.kills}/${m.of} 막타`, ja: `ラストヒット${m.kills}/${m.of}`, en: `${m.kills}/${m.of} last hits` },
    greenlight: { ko: `실수 ${(m.comm || 0) + (m.omit || 0)}번 · ${m.med}ms`, ja: `ミス${(m.comm || 0) + (m.omit || 0)}回・${m.med}ms`, en: `${(m.comm || 0) + (m.omit || 0)} mistakes · ${m.med}ms` },
    smash: { ko: `퍼펙트 ${m.perfect}번`, ja: `パーフェクト${m.perfect}回`, en: `${m.perfect} perfects` },
    dodge: m.dead ? { ko: `${m.sec}초 생존`, ja: `${m.sec}秒生存`, en: `Survived ${m.sec}s` } : { ko: `완주 · 피격 ${m.hits}번`, ja: `完走・被弾${m.hits}回`, en: `Survived · hit ${m.hits}x` },
    rhythm: { ko: `퍼펙트 ${m.pf} · 미스 ${m.miss}`, ja: `パーフェクト${m.pf}・ミス${m.miss}`, en: `${m.pf} perfect · ${m.miss} miss` },
    aim: { ko: `${m.hits}/${m.of} 명중 · ${m.avg}ms`, ja: `${m.hits}/${m.of}命中・${m.avg}ms`, en: `${m.hits}/${m.of} hits · ${m.avg}ms` },
    stroop: { ko: `${m.ok}개 정답 · 오답 ${m.bad}`, ja: `正解${m.ok}・不正解${m.bad}`, en: `${m.ok} right · ${m.bad} wrong` },
    fly: { ko: `${m.catches}마리 · 추적 ${m.ratio}%`, ja: `${m.catches}匹・追跡${m.ratio}%`, en: `${m.catches} swatted · ${m.ratio}% tracked` },
  }[tid];
  if (!T || m == null || !Object.keys(m).length) return { ko: "기록 없음", ja: "記録なし", en: "No record" }[L];
  return T[L];
}

// ---------- 진단문 (웃음 대상은 게임 속 피지컬과 기록만 — 성별·나이 비하 금지) ----------
const TYPE_NOUN = {
  reaction: { ko: ["번개 돌격대장", "반응이 먼저 나가고 생각이 따라오는 타입. 한타 첫 진입은 늘 당신 몫입니다."], ja: ["稲妻の突撃隊長", "考えるより先に体が動くタイプ。集団戦の一番槍はいつもあなた。"], en: ["Lightning Vanguard", "Reflexes first, thinking later. You're always the first one into the team fight."] },
  memory: { ko: ["전략 사령관", "보고 들은 건 잊지 않는 타입. 상대 쿨타임을 머릿속 엑셀로 관리합니다."], ja: ["戦略司令官", "見聞きしたことは忘れないタイプ。相手のクールタイムを頭の中のエクセルで管理しています。"], en: ["Strategy Commander", "Never forgets a thing. You track enemy cooldowns in a spreadsheet inside your head."] },
  dexterity: { ko: ["손가락 피아니스트", "손이 머리보다 빠른 타입. 키보드가 당신을 무서워합니다."], ja: ["指先ピアニスト", "頭より手が速いタイプ。キーボードがあなたを怖がっています。"], en: ["Finger Pianist", "Your hands outrun your brain. Your keyboard is scared of you."] },
  judgment: { ko: ["냉철한 심판관", "누를 때와 참을 때를 아는 타입. 무리한 다이브는 하지 않습니다."], ja: ["冷徹な審判官", "押す時と我慢する時を知っているタイプ。無謀な突っ込みはしません。"], en: ["Cool-headed Judge", "Knows when to press and when to wait. Never takes a reckless dive."] },
  focus: { ko: ["집중력 수도승", "한 번 몰입하면 주변 소리가 꺼지는 타입. 밥 먹으라는 소리도 꺼집니다."], ja: ["集中の修行僧", "没頭すると周りの音が消えるタイプ。「ご飯よ」の声も消えます。"], en: ["Focus Monk", "Once locked in, the world goes silent — including \"dinner's ready.\""] },
  aim: { ko: ["저격수", "보이는 순간 이미 맞힌 타입. 마우스 감도에 진심입니다."], ja: ["スナイパー", "見えた瞬間にもう当てているタイプ。マウス感度にはガチです。"], en: ["Sniper", "Already hit it the moment it appeared. Dead serious about mouse sensitivity."] },
  rhythm: { ko: ["리듬 무희", "몸속에 메트로놈이 있는 타입. 스킬도 박자에 맞춰 씁니다."], ja: ["リズムの踊り子", "体内にメトロノームがあるタイプ。スキルもビートに合わせて撃ちます。"], en: ["Rhythm Dancer", "There's a metronome inside you. Even your skills land on the beat."] },
  evasion: { ko: ["무빙 장인", "맞기 전에 이미 피해 있는 타입. 체력바가 늘 가득 차 있습니다."], ja: ["ムーブ職人", "当たる前にもう避けているタイプ。体力バーはいつも満タン。"], en: ["Movement Master", "Already gone before the hit lands. Your HP bar is always full."] },
};
const TYPE_ADJ = {
  reaction: { ko: "번개같은", ja: "稲妻の", en: "Lightning" }, memory: { ko: "계산적인", ja: "計算高い", en: "Calculating" },
  dexterity: { ko: "손 빠른", ja: "手の速い", en: "Quick-handed" }, judgment: { ko: "신중한", ja: "慎重な", en: "Careful" },
  focus: { ko: "끈질긴", ja: "粘り強い", en: "Relentless" }, aim: { ko: "정밀한", ja: "精密な", en: "Precise" },
  rhythm: { ko: "박자 타는", ja: "ノリのいい", en: "Groovy" }, evasion: { ko: "잘 피하는", ja: "よけ上手な", en: "Slippery" },
};
const TYPE_LOW = { ko: ["느긋한 관광객", "급할 것 없는 타입. 게임도 인생도 천천히 즐기는 여유파입니다."], ja: ["のんびり観光客", "急ぐ必要なしのタイプ。ゲームも人生もゆっくり楽しむ余裕派です。"], en: ["Laid-back Tourist", "No rush, ever. You enjoy games — and life — at your own pace."] };

const DX_TEST = {
  tap: { hi: { ko: ["손가락 불꽃 과열증", "광속 연타 중독", "키보드 혹사 증후군"], ja: ["指先オーバーヒート症", "光速連打依存症", "キーボード酷使症候群"], en: ["Finger Overheat Disorder", "Light-speed Tapping Addiction", "Keyboard Abuse Syndrome"] }, lo: { ko: ["손가락 절전 모드 증후군", "연타 버튼 낯가림증", "한 손가락 비폭력주의"], ja: ["指先省電力モード症候群", "連打ボタン人見知り症", "一本指非暴力主義"], en: ["Finger Power-saving Syndrome", "Button Shyness Disorder", "One-finger Pacifism"] } },
  memory: { hi: { ko: ["사진 기억 과다증", "패턴 저장소 과적재", "빌드오더 암기 체질"], ja: ["写真記憶過多症", "パターン保存庫オーバーロード", "ビルドオーダー暗記体質"], en: ["Photographic Memory Overload", "Pattern Storage Overflow", "Build-order Memorizer Constitution"] }, lo: { ko: ["금붕어형 단기기억", "방금 뭐였지 증후군", "기억력 캐시 삭제증"], ja: ["金魚型短期記憶", "今のなんだっけ症候群", "記憶キャッシュ削除症"], en: ["Goldfish-type Memory", "\"Wait, What Was That?\" Syndrome", "Memory Cache Wipe Disorder"] } },
  reaction: { hi: { ko: ["반응속도 과속증", "번개 반사신경 과민", "예측 불허 순발력"], ja: ["反応速度スピード違反症", "稲妻反射神経過敏", "予測不能の瞬発力"], en: ["Reaction Speeding Violation", "Lightning Reflex Hypersensitivity", "Unpredictable Quickness"] }, lo: { ko: ["기절 연장 체질", "반응 택배 배송지연증", "뒤늦은 깨달음 반사"], ja: ["気絶延長体質", "反応の宅配遅延症", "あとから気づく反射"], en: ["Extended Stun Constitution", "Delayed Reaction Delivery", "Late Realization Reflex"] } },
  qwer: { hi: { ko: ["손가락 콤보 머신증", "스킬 난사 숙련증", "4키 오케스트라 지휘증"], ja: ["指先コンボマシン症", "スキル乱射熟練症", "4キーオーケストラ指揮症"], en: ["Combo Machine Fingers", "Skill Spam Mastery", "Four-key Orchestra Conductor"] }, lo: { ko: ["만성 QWER 증후군", "스킬 키 미아증", "궁극기 엇박 시전증"], ja: ["慢性QWER症候群", "スキルキー迷子症", "必殺技ズレ打ち症"], en: ["Chronic QWER Syndrome", "Lost Skill Key Disorder", "Off-beat Ultimate Casting"] } },
  lasthit: { hi: { ko: ["막타 장인병", "골드 집착 과다증", "미니언 저승사자 증후군"], ja: ["ラストヒット職人病", "ゴールド執着過多症", "ミニオンの死神症候群"], en: ["Last-hit Artisan Disease", "Gold Obsession Overdose", "Minion Grim Reaper Syndrome"] }, lo: { ko: ["막타 양보 미덕증", "미니언 기부천사 증후군", "골드 손실성 망설임"], ja: ["ラストヒット譲り美徳症", "ミニオン寄付天使症候群", "ゴールド損失型ためらい"], en: ["Last-hit Generosity Disorder", "Minion Donation Angel Syndrome", "Gold-losing Hesitation"] } },
  greenlight: { hi: { ko: ["신호 준수 모범 운전증", "브레이크 장인 체질", "손가락 자제력 과다"], ja: ["信号順守の模範運転症", "ブレーキ職人体質", "指先自制心過多"], en: ["Model Driver Syndrome", "Brake Artisan Constitution", "Excessive Finger Self-control"] }, lo: { ko: ["빨간불 질주 본능", "신호위반 상습 손가락", "브레이크 없는 클릭증"], ja: ["赤信号ダッシュ本能", "信号無視常習の指", "ブレーキなしクリック症"], en: ["Red-light Sprint Instinct", "Habitual Signal-running Finger", "Brakeless Clicking Disorder"] } },
  smash: { hi: { ko: ["정글러 본능 과다증", "강타 저격 체질", "용 스틸 예감증"], ja: ["ジャングラー本能過多症", "スマイト狙撃体質", "ドラゴンスティール予感症"], en: ["Jungler Instinct Overdose", "Sniper Smite Constitution", "Dragon Steal Premonition"] }, lo: { ko: ["강타 타이밍 실종", "오브젝트 뺏김 예약 증후군", "게이지 감상형 망설임"], ja: ["スマイトタイミング失踪", "オブジェクト奪われ予約症候群", "ゲージ鑑賞型ためらい"], en: ["Missing Smite Timing", "Pre-booked Objective Loss Syndrome", "Gauge-admiring Hesitation"] } },
  dodge: { hi: { ko: ["탄막 투명화 체질", "회피 무빙 과다증", "불길 무시 체질"], ja: ["弾幕透明化体質", "回避ムーブ過多症", "炎スルー体質"], en: ["Bullet-phasing Constitution", "Excessive Dodging Disorder", "Fireproof Constitution"] }, lo: { ko: ["탄막 자석 체질", "피격 판정 수집가", "불길 직행 내비게이션"], ja: ["弾幕マグネット体質", "被弾判定コレクター", "炎直行ナビゲーション"], en: ["Bullet Magnet Constitution", "Hitbox Collector", "Straight-into-fire Navigation"] } },
  rhythm: { hi: { ko: ["인간 메트로놈 증후군", "박자 감지 과민증", "리듬 세포 과다 분열"], ja: ["人間メトロノーム症候群", "ビート感知過敏症", "リズム細胞過剰分裂"], en: ["Human Metronome Syndrome", "Beat Hypersensitivity", "Rhythm Cell Overgrowth"] }, lo: { ko: ["박치 엇박 증후군", "메트로놈 거부 반응", "자유로운 영혼형 리듬"], ja: ["リズム音痴症候群", "メトロノーム拒絶反応", "自由な魂型リズム"], en: ["Off-beat Syndrome", "Metronome Rejection Response", "Free-spirit Rhythm"] } },
  aim: { hi: { ko: ["에임 핵 의심 증후군", "헤드샷 습관성 반사", "조준점 고정 체질"], ja: ["エイムチート疑惑症候群", "ヘッドショット習慣性反射", "照準固定体質"], en: ["Suspected Aimbot Syndrome", "Habitual Headshot Reflex", "Locked-crosshair Constitution"] }, lo: { ko: ["에임 실종 증후군", "허공 사격 애호가", "마우스 가출 증후군"], ja: ["エイム行方不明症候群", "空中射撃愛好家", "マウス家出症候群"], en: ["Missing Aim Syndrome", "Thin-air Shooting Enthusiast", "Runaway Mouse Syndrome"] } },
  stroop: { hi: { ko: ["색깔 판독 과민증", "함정 문구 면역 체질", "판단력 과열 증후군"], ja: ["色判読過敏症", "ひっかけ文字免疫体質", "判断力オーバーヒート症候群"], en: ["Color-reading Hypersensitivity", "Trick-word Immunity", "Judgment Overheat Syndrome"] }, lo: { ko: ["색깔 혼선 증후군", "글자에 속는 체질", "빨강을 파랑이라 부르는 병"], ja: ["色混線症候群", "文字にだまされる体質", "赤を青と呼ぶ病"], en: ["Color Crossed-wires Syndrome", "Word-fooled Constitution", "Calls-Red-Blue Disease"] } },
  fly: { hi: { ko: ["파리 추적 집착증", "동체시력 과잉 반응", "날파리 천적 체질"], ja: ["ハエ追跡執着症", "動体視力過剰反応", "コバエの天敵体質"], en: ["Fly-tracking Obsession", "Motion Vision Overdrive", "Natural Fly Predator"] }, lo: { ko: ["파리 해방 운동가", "추적 포기 증후군", "날파리 친화형 시선"], ja: ["ハエ解放運動家", "追跡あきらめ症候群", "コバエ親和型の視線"], en: ["Fly Liberation Activist", "Chase-surrender Syndrome", "Fly-friendly Gaze"] } },
};
const DX_AGE = [
  [-99, -15, { ko: ["피지컬 회춘 현상", "역노화 프로게이머 증후군", "시간 역행성 손놀림", "벤자민 버튼형 반사신경"], ja: ["フィジカル若返り現象", "逆老化プロゲーマー症候群", "時間逆行型の手さばき", "ベンジャミン・バトン型反射神経"], en: ["Physical Rejuvenation Phenomenon", "Reverse-aging Pro Gamer Syndrome", "Time-reversing Hands", "Benjamin Button Reflexes"] }],
  [-14, -6, { ko: ["손가락 현역 유지증", "만성 청춘 피지컬", "전성기 연장 증후군", "나이 착각 유발 반사신경"], ja: ["指先現役維持症", "慢性青春フィジカル", "全盛期延長症候群", "年齢詐称疑惑の反射神経"], en: ["Fingers Still in Prime", "Chronic Youthful Physique", "Extended Prime Syndrome", "Age-confusing Reflexes"] }],
  [-5, 5, { ko: ["연식 정상 운행증", "나이값 정확 피지컬", "표준 규격 게이머 증후군", "정시 출근형 반사신경"], ja: ["年式どおり正常運行症", "年相応ジャスト体質", "標準規格ゲーマー症候群", "定時出勤型反射神経"], en: ["Running Exactly to Spec", "Age-accurate Physique", "Standard-issue Gamer Syndrome", "Clock-in-on-time Reflexes"] }],
  [6, 14, { ko: ["초기 에이징 커브", "주말 한정 피지컬", "손목 워밍업 부족증", "프레임 드랍성 반응지연"], ja: ["初期エイジングカーブ", "週末限定フィジカル", "手首ウォームアップ不足症", "フレーム落ち型反応遅延"], en: ["Early Aging Curve", "Weekend-only Physique", "Wrist Warm-up Deficiency", "Frame-drop Reaction Lag"] }],
  [15, 99, { ko: ["급성 에이징 커브", "레트로 감성 피지컬", "슬로우 모션 생활증", "로딩 중 증후군", "추억 보정 필요 피지컬"], ja: ["急性エイジングカーブ", "レトロ感性フィジカル", "スローモーション生活症", "ローディング中症候群", "思い出補正が必要なフィジカル"], en: ["Acute Aging Curve", "Retro-vibe Physique", "Slow-motion Lifestyle Disorder", "Now-Loading Syndrome", "Nostalgia-filter-required Physique"] }],
];
const DX_SPECIAL = [
  [(c) => c.flags, 99, { ko: ["매크로 의심 손가락 (재검사 요망)"], ja: ["マクロ疑惑の指（要再検査）"], en: ["Suspected Macro Fingers (retest required)"] }],
  [(c) => c.total >= 90, 90, { ko: ["프로게이머 오인 증후군", "현역 국가대표 의심증"], ja: ["プロゲーマー誤認症候群", "現役代表選手疑惑症"], en: ["Mistaken-for-a-Pro Syndrome", "Suspected National Team Player"] }],
  [(c) => c.total <= 22, 88, { ko: ["절전 모드 게이머 증후군", "튜토리얼 재수강 권장증"], ja: ["省電力モードゲーマー症候群", "チュートリアル再受講推奨症"], en: ["Power-saving Gamer Syndrome", "Tutorial Retake Recommended"] }],
  [(c) => c.rank === 1 && c.of >= 3, 86, { ko: ["왕좌 고정 증후군", "단톡방 자랑 예정증"], ja: ["王座固定症候群", "グループチャット自慢予定症"], en: ["Throne-lock Syndrome", "Group-chat Bragging Imminent"] }],
  [(c) => c.rank && c.rank === c.of && c.of >= 3, 85, { ko: ["꼴찌 전용 특별 처방 대상", "분위기 메이커 과다증"], ja: ["最下位専用特別処方対象", "ムードメーカー過多症"], en: ["Last-place Special Prescription", "Mood-maker Overdose"] }],
  [(c) => c.delta >= 8, 84, { ko: ["급성 회복 기적 증후군", "재검사 각성 현상"], ja: ["急性回復ミラクル症候群", "再検査覚醒現象"], en: ["Miracle Recovery Syndrome", "Retest Awakening"] }],
  [(c) => c.delta <= -8, 83, { ko: ["컨디션 난조성 일시 퇴화", "어제의 나에게 패배증"], ja: ["コンディション不良型一時退化", "昨日の自分に負けた症"], en: ["Bad-day Temporary Regression", "Lost-to-Yesterday's-Me Disorder"] }],
  [(c) => c.has("tap", "qwer") && c.s.tap >= 80 && c.s.qwer >= 80, 70, { ko: ["양손 폭주 증후군"], ja: ["両手暴走症候群"], en: ["Both-hands Rampage Syndrome"] }],
  [(c) => c.has("reaction", "greenlight") && c.s.reaction >= 78 && c.s.greenlight <= 45, 70, { ko: ["성급한 번개 손가락"], ja: ["せっかちな稲妻の指"], en: ["Impatient Lightning Fingers"] }],
  [(c) => c.has("reaction", "greenlight") && c.s.greenlight >= 78 && c.s.reaction <= 45, 70, { ko: ["신중한 거북이 체질"], ja: ["慎重なカメ体質"], en: ["Cautious Tortoise Constitution"] }],
  [(c) => c.has("aim", "fly") && c.s.aim >= 78 && c.s.fly <= 45, 68, { ko: ["한 방 저격형 산만증"], ja: ["一発狙撃型の散漫症"], en: ["One-shot Sniper Distractibility"] }],
  [(c) => c.has("dodge", "lasthit") && c.s.dodge >= 78 && c.s.lasthit <= 45, 68, { ko: ["생존 우선 평화주의"], ja: ["生存優先の平和主義"], en: ["Survival-first Pacifism"] }],
  [(c) => c.has("memory", "stroop") && c.s.memory <= 40 && c.s.stroop >= 75, 68, { ko: ["순간 판단형 건망증"], ja: ["瞬間判断型の物忘れ"], en: ["Snap-judgment Forgetfulness"] }],
  [(c) => c.has("rhythm", "smash") && c.s.rhythm >= 80 && c.s.smash >= 80, 68, { ko: ["타이밍 귀신 증후군"], ja: ["タイミングの鬼症候群"], en: ["Timing Demon Syndrome"] }],
  [(c) => c.n >= 5 && c.spread <= 16, 66, { ko: ["완벽 밸런스형 육각형 증후군", "평균의 신 강림증"], ja: ["完璧バランス六角形症候群", "平均の神降臨症"], en: ["Perfect Hexagon Syndrome", "Avatar of the Average"] }],
  [(c) => c.n >= 5 && c.spread >= 62, 66, { ko: ["극단적 편식 피지컬", "롤러코스터형 재능 분포"], ja: ["極端な偏食フィジカル", "ジェットコースター型の才能分布"], en: ["Extreme Picky-eater Physique", "Roller-coaster Talent Curve"] }],
];
const OPEN = [
  [85, { ko: ["검사 장비가 고장 난 줄 알았습니다. 다시 봐도 정상 수치를 넘었네요.", "측정 결과를 본 간호사가 사인을 받아 갔습니다.", "이 정도면 진단서가 아니라 추천서를 써 드려야 할 것 같습니다."], ja: ["検査機器が壊れたのかと思いました。見直しても正常値を超えています。", "測定結果を見た看護師がサインをもらっていきました。", "これは診断書ではなく推薦状を書くべきかもしれません。"], en: ["I thought the equipment was broken. Checked twice — you're off the charts.", "The nurse who saw your results asked for an autograph.", "Honestly, I should be writing you a recommendation letter, not a diagnosis."] }],
  [70, { ko: ["전반적으로 매우 건강한 게임 피지컬입니다.", "손가락과 눈이 서로 사이좋게 협업하고 있습니다.", "현역 게이머의 기운이 진료실까지 느껴집니다."], ja: ["全体的にとても健康なゲームフィジカルです。", "指と目が仲良く連携しています。", "現役ゲーマーのオーラが診察室まで伝わってきます。"], en: ["Overall, a very healthy gaming physique.", "Your fingers and eyes are collaborating beautifully.", "I can feel active-gamer energy from across the exam room."] }],
  [55, { ko: ["무난하게 잘 굴러가는 게임 피지컬입니다.", "큰 고장 없이 정상 운행 중인 손가락입니다.", "평균을 살짝 웃도는 안정적인 수치입니다."], ja: ["無難にしっかり動いているゲームフィジカルです。", "大きな故障もなく正常運行中の指です。", "平均を少し上回る安定した数値です。"], en: ["A gaming physique that's chugging along just fine.", "Fingers running normally, no major breakdowns.", "Stable numbers, slightly above average."] }],
  [40, { ko: ["몇몇 부품에서 삐걱거리는 소리가 들립니다.", "전원은 켜져 있으나 절전 모드가 의심됩니다.", "기본기는 있으나 예열이 조금 더 필요해 보입니다."], ja: ["いくつかの部品からきしむ音が聞こえます。", "電源は入っていますが省電力モードの疑いがあります。", "基礎はありますが、もう少しウォームアップが必要そうです。"], en: ["I'm hearing a few parts creak.", "The power is on, but I suspect power-saving mode.", "The fundamentals are there — you just need more warm-up."] }],
  [25, { ko: ["손가락이 아직 출근하지 않은 것 같습니다.", "검사실 기계가 조용히 걱정 섞인 효과음을 냈습니다.", "피지컬이 잠시 휴가 중인 것으로 보입니다."], ja: ["指がまだ出勤していないようです。", "検査室の機械が心配そうな効果音を小さく鳴らしました。", "フィジカルが少し休暇中のようです。"], en: ["Your fingers don't seem to have clocked in yet.", "The exam machine made a quietly worried beep.", "Your physique appears to be on vacation."] }],
  [0, { ko: ["측정기가 '다시 해 보세요'라고 속삭였습니다.", "오늘은 손가락이 파업을 선언한 날로 기록하겠습니다.", "이번 결과는 리허설로 치기로 합시다."], ja: ["測定器が「もう一度やってみて」とささやきました。", "今日は指がストライキを宣言した日として記録します。", "今回の結果はリハーサルということにしましょう。"], en: ["The meter whispered, \"Try again.\"", "I'll record today as the day your fingers went on strike.", "Let's call this one a rehearsal."] }],
];
const BEST_TXT = {
  tap: { ko: ["{taps}번 연타는 키보드 수명을 걱정해야 할 수준입니다.", "초당 {tps}회 연타 — 손가락에 터보 버튼이 달려 있군요."], ja: ["{taps}回の連打はキーボードの寿命が心配なレベルです。", "毎秒{tps}回の連打 — 指にターボボタンが付いていますね。"], en: ["{taps} taps — your keyboard's lifespan is in danger.", "{tps} taps per second — your fingers have a turbo button."] },
  memory: { ko: ["{span}칸 순서를 외우는 기억력, 상대 스킬 쿨타임도 다 외우시겠네요.", "{span}칸 기억 성공. 비밀번호 바꿀 필요가 없겠습니다."], ja: ["{span}マスの順番を覚える記憶力、相手のスキルのクールタイムも全部覚えていそうです。", "{span}マス記憶成功。パスワードを変える必要はなさそうです。"], en: ["Memorizing {span} tiles — you probably know every enemy cooldown too.", "{span} tiles remembered. You'll never need a password manager."] },
  reaction: { ko: ["평균 {med}ms 반응속도, 신호보다 손이 먼저 출발했습니다.", "최고 기록 {best}ms. 기절 상태가 오래가지 않는 체질입니다."], ja: ["平均{med}msの反応速度、合図より先に手が出発しました。", "最高記録{best}ms。気絶が長続きしない体質です。"], en: ["Average reaction {med}ms — your hand left before the signal did.", "Best {best}ms. Stuns just don't stick to you."] },
  qwer: { ko: ["{combos}개의 콤보를 정확도 {acc}%로 넣었습니다. 손가락이 스킬 순서를 외웠습니다.", "QWER 위에서 손가락이 춤을 춥니다. 정확도 {acc}%."], ja: ["{combos}個のコンボを精度{acc}%で決めました。指がスキル順を覚えています。", "QWERの上で指が踊っています。精度{acc}%。"], en: ["{combos} combos at {acc}% accuracy. Your fingers memorized the rotation.", "Your fingers dance on QWER. {acc}% accuracy."] },
  lasthit: { ko: ["몬스터 {of}마리 중 {kills}마리 막타. 골드 냄새를 맡는 코를 가지셨군요.", "막타 {kills}개. 체력바 계산기가 머릿속에 내장돼 있습니다."], ja: ["モンスター{of}体中{kills}体のラストヒット。ゴールドの匂いを嗅ぎ分ける鼻をお持ちですね。", "ラストヒット{kills}回。頭の中に体力バー計算機が内蔵されています。"], en: ["{kills} of {of} last hits. You can smell gold from a mile away.", "{kills} last hits. There's an HP calculator built into your brain."] },
  greenlight: { ko: ["빨간불에서 손을 멈추는 자제력이 훌륭합니다.", "신호 판단 실수 {comm}번. 모범 운전자 표창감입니다."], ja: ["赤信号で手を止める自制心が見事です。", "信号判断ミス{comm}回。模範ドライバー表彰ものです。"], en: ["Excellent self-control at the red light.", "Only {comm} signal mistakes. Model driver award material."] },
  smash: { ko: ["퍼펙트 강타 {perfect}번. 오브젝트 앞에서 떨지 않는 심장입니다.", "게이지 한가운데를 노리는 눈이 정확합니다. 퍼펙트 {perfect}번."], ja: ["パーフェクトスマイト{perfect}回。オブジェクトの前でも震えない心臓です。", "ゲージの真ん中を狙う目が正確です。パーフェクト{perfect}回。"], en: ["{perfect} perfect smites. A heart that doesn't shake at objectives.", "Your eye finds the dead center. {perfect} perfects."] },
  dodge: { ko: ["{sec}초 생존, 피격 {hits}번. 불꽃이 당신을 피해 다닌 것 같습니다.", "아슬아슬한 회피 {graze}번. 관객 심장에 해로운 무빙입니다."], ja: ["{sec}秒生存、被弾{hits}回。炎のほうがあなたを避けていたようです。", "ギリギリ回避{graze}回。観客の心臓に悪いムーブです。"], en: ["Survived {sec}s, hit {hits} times. The fire seemed to avoid you.", "{graze} near-misses. That movement is bad for the audience's heart."] },
  rhythm: { ko: ["퍼펙트 {pf}개. 심장 박동이 BPM에 맞춰 뛰는 분입니다.", "최대 콤보 {combo}. 비트 할아버지가 박수를 쳤습니다."], ja: ["パーフェクト{pf}個。心拍がBPMに合わせて打つ人です。", "最大コンボ{combo}。ビートじいさんが拍手しました。"], en: ["{pf} perfects. Your heartbeat runs on BPM.", "Max combo {combo}. Beat Grandpa gave you a round of applause."] },
  aim: { ko: ["평균 {avg}ms 만에 과녁 명중. 마우스가 순간이동합니다.", "명중 {hits}/{of}. 과녁들이 당신을 피해 다니고 싶어 합니다."], ja: ["平均{avg}msで命中。マウスが瞬間移動しています。", "命中{hits}/{of}。的のほうがあなたから逃げたがっています。"], en: ["Targets hit in {avg}ms on average. Your mouse teleports.", "{hits}/{of} hits. The targets want to run from you."] },
  stroop: { ko: ["{ok}개 정답. 색깔 함정에 전혀 속지 않는 단단한 판단력입니다.", "정확도 {acc}%. 글자가 아무리 속여도 넘어가지 않습니다."], ja: ["正解{ok}個。色のひっかけにまったくだまされない判断力です。", "精度{acc}%。文字がどれだけだましてもひっかかりません。"], en: ["{ok} correct. Rock-solid judgment that no color trick can fool.", "{acc}% accuracy. No word can trick you."] },
  fly: { ko: ["파리 {catches}마리를 잡았습니다. 여름철 주방의 수호자입니다.", "추적 유지율 {ratio}%. 한 번 찍은 목표는 끝까지 따라갑니다."], ja: ["ハエを{catches}匹仕留めました。夏のキッチンの守護者です。", "追跡維持率{ratio}%。一度狙った獲物は最後まで追います。"], en: ["{catches} flies swatted. Guardian of the summer kitchen.", "{ratio}% tracking. Once you lock on, you never let go."] },
};
const WORST_TXT = {
  tap: { ko: ["다만 연타는 {taps}번에 그쳐, 손가락이 아직 예열 중인 것으로 보입니다.", "연타 검사에서 손가락이 '천천히 가자'고 주장했습니다."], ja: ["ただし連打は{taps}回止まりで、指はまだ温まっていないようです。", "連打検査では指が「ゆっくり行こう」と主張しました。"], en: ["That said, only {taps} taps — your fingers are still warming up.", "In the tap test, your fingers insisted on taking it slow."] },
  memory: { ko: ["다만 순서 기억은 {span}칸에서 멈췄습니다. 방금 본 것도 추억이 되는 체질입니다.", "단기 기억 검사에서 기억이 잠시 로그아웃했습니다."], ja: ["ただし順番記憶は{span}マスで止まりました。今見たものもすぐ思い出になる体質です。", "短期記憶検査で記憶が一時ログアウトしました。"], en: ["That said, memory stopped at {span} tiles. Things become memories the moment you see them.", "In the memory test, your memory briefly logged out."] },
  reaction: { ko: ["다만 반응속도 {med}ms로, 신호가 손가락까지 택배로 배송되는 중입니다.", "기절 풀기 검사에서 기절이 생각보다 오래 지속됐습니다."], ja: ["ただし反応速度は{med}msで、合図が指まで宅配便で配送中です。", "気絶から復帰検査で、気絶が思ったより長く続きました。"], en: ["That said, {med}ms — the signal is reaching your finger by parcel post.", "In the stun test, the stun lasted longer than expected."] },
  qwer: { ko: ["다만 QWER 정확도가 {acc}%로, 스킬 키들이 서로 자리를 바꾼 것 같습니다.", "스킬 콤보에서 손가락이 길을 잃었습니다. 키보드 지도가 필요합니다."], ja: ["ただしQWER精度は{acc}%で、スキルキーが席替えしたようです。", "スキルコンボで指が道に迷いました。キーボードの地図が必要です。"], en: ["That said, {acc}% QWER accuracy — the skill keys seem to have swapped seats.", "Your fingers got lost in the combo. You need a keyboard map."] },
  lasthit: { ko: ["다만 막타는 {kills}개뿐, 나머지 골드는 아군에게 기부하셨습니다.", "막타 검사에서 너그러운 마음이 골드를 다 양보했습니다."], ja: ["ただしラストヒットは{kills}回だけ、残りのゴールドは味方に寄付しました。", "ラストヒット検査で、寛大な心がゴールドを全部譲りました。"], en: ["That said, only {kills} last hits — you donated the rest of the gold to your team.", "In the last-hit test, your generous heart gave away all the gold."] },
  greenlight: { ko: ["다만 빨간불에서 {comm}번 출발해 신호 위반 딱지가 쌓였습니다.", "초록불 검사에서 브레이크가 살짝 늦게 작동했습니다."], ja: ["ただし赤信号で{comm}回発進し、違反切符がたまりました。", "青信号検査でブレーキの効きが少し遅れました。"], en: ["That said, you ran {comm} red lights — the tickets are piling up.", "In the green-light test, the brakes kicked in a little late."] },
  smash: { ko: ["다만 강타는 퍼펙트 {perfect}번으로, 오브젝트를 상대에게 양보할 위험이 있습니다.", "강타 게이지를 감상하다가 타이밍이 지나갔습니다."], ja: ["ただしパーフェクトは{perfect}回で、オブジェクトを相手に譲る危険があります。", "ゲージを鑑賞しているうちにタイミングが過ぎ去りました。"], en: ["That said, only {perfect} perfects — the enemy may steal your objectives.", "You admired the gauge so long the timing passed you by."] },
  dodge: { ko: ["다만 불꽃을 {hits}번 맞았습니다. 탄막이 당신을 무척 좋아합니다.", "불 피하기에서 불꽃과 너무 친하게 지내셨습니다."], ja: ["ただし炎に{hits}回当たりました。弾幕にとても好かれています。", "炎よけでは炎と仲良くしすぎました。"], en: ["That said, the fire hit you {hits} times. The bullets really like you.", "In fire dodge, you got a little too friendly with the flames."] },
  rhythm: { ko: ["다만 미스 {miss}개로, 비트 할아버지가 고개를 갸웃했습니다.", "리듬 검사에서 박자와 잠시 서로 다른 길을 걸었습니다."], ja: ["ただしミス{miss}個で、ビートじいさんが首をかしげました。", "リズム検査ではビートと少し別の道を歩みました。"], en: ["That said, {miss} misses — Beat Grandpa tilted his head.", "In the rhythm test, you and the beat briefly went separate ways."] },
  aim: { ko: ["다만 과녁 명중 {hits}/{of}로, 마우스가 가끔 가출합니다.", "에임 검사에서 허공을 꽤 많이 맞히셨습니다."], ja: ["ただし命中{hits}/{of}で、マウスがときどき家出します。", "エイム検査で空中をかなり撃ち抜きました。"], en: ["That said, {hits}/{of} hits — your mouse runs away from home sometimes.", "In the aim test, you hit a lot of thin air."] },
  stroop: { ko: ["다만 색깔 검사 오답 {bad}개로, 빨강과 파랑이 잠시 헷갈렸습니다.", "색깔 헷갈림 검사가 이름값을 제대로 했습니다."], ja: ["ただし色検査の不正解{bad}個で、赤と青が少し混ざりました。", "色まどわし検査が名前どおりの仕事をしました。"], en: ["That said, {bad} wrong answers — red and blue got mixed up for a moment.", "The color-confusion test lived up to its name."] },
  fly: { ko: ["다만 파리는 {catches}마리만 잡혀, 주방 위생이 걱정됩니다.", "파리 잡기에서 파리가 자유를 얻었습니다."], ja: ["ただしハエは{catches}匹だけで、キッチンの衛生が心配です。", "ハエたたきではハエが自由を手に入れました。"], en: ["That said, only {catches} flies caught — I'm worried about kitchen hygiene.", "In the fly test, the flies won their freedom."] },
};
const AGE_TXT = [
  [-99, -8, { ko: ["실제 나이보다 {gap}살 젊은 손가락을 갖고 계십니다.", "피지컬 시계가 {gap}년 거꾸로 돌고 있습니다."], ja: ["実年齢より{gap}歳若い指をお持ちです。", "フィジカル時計が{gap}年逆回転しています。"], en: ["Your fingers are {gap} years younger than you are.", "Your physical clock is running {gap} years backward."] }],
  [-7, 3, { ko: ["실제 나이와 피지컬 나이가 거의 같습니다. 정직한 손가락입니다.", "나이와 피지컬이 사이좋게 발맞춰 걷고 있습니다."], ja: ["実年齢とフィジカル年齢がほぼ同じです。正直な指です。", "年齢とフィジカルが仲良く足並みをそろえています。"], en: ["Your real age and physical age almost match. Honest fingers.", "Your age and your physique are walking in step."] }],
  [4, 12, { ko: ["피지컬이 실제보다 {gap}살 정도 먼저 달려갔습니다. 스트레칭이 필요합니다.", "손가락 연식이 {gap}년쯤 앞서 있습니다. 예열 후 재검사를 권합니다."], ja: ["フィジカルが実年齢より{gap}歳ほど先を走っています。ストレッチが必要です。", "指の年式が{gap}年ほど先行しています。ウォームアップ後の再検査をおすすめします。"], en: ["Your physique ran about {gap} years ahead. Time to stretch.", "Your fingers are about {gap} years ahead. Warm up and retest."] }],
  [13, 99, { ko: ["피지컬 나이가 {gap}살 앞서 있지만, 오늘 컨디션 탓일 가능성이 큽니다.", "검사 수치가 {gap}년 먼저 나이를 먹었습니다. 충분한 휴식 후 다시 오세요."], ja: ["フィジカル年齢が{gap}歳先行していますが、今日の体調のせいの可能性が高いです。", "検査数値が{gap}年先に年をとりました。十分休んでからまたどうぞ。"], en: ["Your physical age is {gap} years ahead, but today's condition is likely to blame.", "Your numbers aged {gap} years early. Rest up and come back."] }],
];
const RANK_TXT = {
  first: { ko: "함께 검사한 {of}명 중 1위. 오늘 이 병동의 주인공입니다.", ja: "一緒に検査した{of}人中1位。今日のこの病棟の主役です。", en: "#1 of {of}. You're the star of this ward today." },
  last: { ko: "함께 검사한 {of}명 중 {rank}위. 다음 회진 때 역전을 노려 봅시다.", ja: "一緒に検査した{of}人中{rank}位。次の回診で逆転を狙いましょう。", en: "#{rank} of {of}. Let's aim for a comeback at the next rounds." },
  mid: { ko: "함께 검사한 {of}명 중 {rank}위로 중간 이상의 존재감을 보였습니다.", ja: "一緒に検査した{of}人中{rank}位で、しっかり存在感を見せました。", en: "Placed #{rank} of {of} — a solid showing." },
  up: { ko: "지난 검사보다 {d}점 올랐습니다. 회복세가 뚜렷합니다.", ja: "前回より{d}点アップ。回復傾向がはっきりしています。", en: "Up {d} points from last time. Clear signs of recovery." },
  down: { ko: "지난 검사보다 {d}점 내려갔습니다. 컨디션 탓으로 보입니다.", ja: "前回より{d}点ダウン。コンディションのせいでしょう。", en: "Down {d} points from last time. Probably just an off day." },
};
const RX = {
  reaction: { ko: ["처방: 하루 3번 '기다렸다 누르기' 훈련, 식후 30분.", "처방: 신호등 앞에서 마음속으로 반응 연습하기."], ja: ["処方：1日3回「待ってから押す」訓練、食後30分。", "処方：信号待ちの間に心の中で反応練習。"], en: ["Rx: \"wait, then press\" drills, 3 times a day, 30 min after meals.", "Rx: practice reacting in your head at every traffic light."] },
  memory: { ko: ["처방: 매일 아침 전화번호 하나 외우기.", "처방: 상대 스킬 쿨타임을 소리 내어 세어 보기."], ja: ["処方：毎朝電話番号を1つ覚える。", "処方：相手のスキルのクールタイムを声に出して数える。"], en: ["Rx: memorize one phone number every morning.", "Rx: count enemy cooldowns out loud."] },
  dexterity: { ko: ["처방: 손가락 스트레칭 10회 후 연타 복용.", "처방: 키보드와 친해지는 시간 하루 10분."], ja: ["処方：指ストレッチ10回の後に連打を服用。", "処方：キーボードと仲良くなる時間を1日10分。"], en: ["Rx: 10 finger stretches, then take one dose of tapping.", "Rx: 10 minutes a day getting friendly with your keyboard."] },
  judgment: { ko: ["처방: 누르기 전에 반 박자 참기, 하루 20회.", "처방: '지금 들어가도 되나?' 세 번 묻고 진입하기."], ja: ["処方：押す前に半拍我慢、1日20回。", "処方：「今入っていい？」と3回自問してから突入。"], en: ["Rx: wait half a beat before pressing, 20 times a day.", "Rx: ask \"should I go in?\" three times before diving."] },
  focus: { ko: ["처방: 알림 끄고 한 판에만 집중하기.", "처방: 게임 중 간식 섭취 금지 (집중력 보호)."], ja: ["処方：通知をオフにして1試合に集中。", "処方：ゲーム中のおやつ禁止（集中力保護のため）。"], en: ["Rx: turn off notifications and focus on one match.", "Rx: no snacks during games (to protect your focus)."] },
  aim: { ko: ["처방: 마우스 감도 점검 및 패드 청소.", "처방: 에임 연습장 하루 5분 복용."], ja: ["処方：マウス感度の点検とマウスパッドの掃除。", "処方：エイム練習場を1日5分服用。"], en: ["Rx: check your mouse sensitivity and clean your pad.", "Rx: one 5-minute dose of aim training daily."] },
  rhythm: { ko: ["처방: 좋아하는 노래에 맞춰 책상 두드리기.", "처방: 메트로놈과 화해하기."], ja: ["処方：好きな曲に合わせて机をたたく。", "処方：メトロノームと仲直りする。"], en: ["Rx: drum on your desk to your favorite song.", "Rx: make peace with the metronome."] },
  evasion: { ko: ["처방: 날아오는 것은 일단 피하고 보기.", "처방: 무빙 연습 — 제자리 서 있기 금지."], ja: ["処方：飛んでくるものはとりあえず避ける。", "処方：ムーブ練習 — その場に立ち止まるの禁止。"], en: ["Rx: if it's flying at you, dodge first, ask later.", "Rx: movement practice — no standing still."] },
};
const GENRE = {
  reaction: { ko: ["격투 게임", "FPS"], ja: ["格闘ゲーム", "FPS"], en: ["Fighting games", "FPS"] },
  memory: { ko: ["퍼즐", "실시간 전략"], ja: ["パズル", "リアルタイムストラテジー"], en: ["Puzzle", "Real-time strategy"] },
  dexterity: { ko: ["MOBA", "리듬 게임"], ja: ["MOBA", "リズムゲーム"], en: ["MOBA", "Rhythm games"] },
  judgment: { ko: ["카드 전략", "턴제 전략"], ja: ["カードゲーム", "ターン制ストラテジー"], en: ["Card strategy", "Turn-based strategy"] },
  focus: { ko: ["로그라이크", "퍼즐"], ja: ["ローグライク", "パズル"], en: ["Roguelike", "Puzzle"] },
  aim: { ko: ["FPS", "슈팅"], ja: ["FPS", "シューティング"], en: ["FPS", "Shooters"] },
  rhythm: { ko: ["리듬 게임", "댄스"], ja: ["リズムゲーム", "ダンス"], en: ["Rhythm games", "Dance"] },
  evasion: { ko: ["탄막 슈팅", "액션 RPG"], ja: ["弾幕シューティング", "アクションRPG"], en: ["Bullet hell", "Action RPG"] },
};
const RETEST = {
  ko: ["충분히 자고 일어난 뒤 재검사하면 수치가 달라질 수 있습니다.", "따뜻한 손으로 다시 검사하면 숨은 피지컬이 깨어날 수 있습니다.", "1주일 뒤 같은 시간에 재검사를 권장합니다.", "친구와 함께 검사하면 승부욕 때문에 수치가 오르는 경향이 있습니다.", "커피 한 잔 후 재검사 시 반응속도 변화를 관찰해 보세요.", "오늘 기록을 기억해 두고 한 달 뒤 변화를 비교해 보세요.", "모바일과 PC 결과는 따로 비교하는 것이 정확합니다.", "기록 갱신은 보통 세 번째 검사에서 일어납니다."],
  ja: ["ぐっすり眠った後に再検査すると数値が変わるかもしれません。", "温かい手で再検査すると眠っていたフィジカルが目覚めるかもしれません。", "1週間後の同じ時間に再検査をおすすめします。", "友達と一緒に検査すると負けず嫌いで数値が上がる傾向があります。", "コーヒーを1杯飲んでから再検査して、反応速度の変化を観察してみてください。", "今日の記録を覚えておいて、1か月後と比べてみてください。", "モバイルとPCの結果は別々に比べるのが正確です。", "記録更新はたいてい3回目の検査で起こります。"],
  en: ["Retesting after a good night's sleep may change your numbers.", "Warm hands may awaken your hidden physique — try again.", "We recommend a retest one week from now, same time of day.", "Testing with friends tends to boost scores out of pure competitiveness.", "Try retesting after a cup of coffee and watch your reaction time.", "Remember today's record and compare it a month from now.", "Compare mobile and PC results separately for accuracy.", "Personal bests usually happen on the third try."],
};
const FLAG_RETEST = { ko: "일부 기록이 비정상 입력으로 감지되어 재검사를 권장합니다.", ja: "一部の記録が異常な入力として検出されたため、再検査をおすすめします。", en: "Some records were flagged as abnormal input — a retest is recommended." };
// 특이 기록: [템플릿 번호, 세기] — 글자는 HL_TX에서 언어별로
const HIGHLIGHT = {
  tap: (m) => m.tps >= 10 ? [0, m.tps] : m.tps <= 4 ? [1, -m.tps] : null,
  memory: (m) => m.span >= 8 ? [0, m.span] : m.span <= 3 ? [1, -3] : null,
  reaction: (m) => m.best && m.best <= 200 ? [0, 250 - m.best] : m.fs >= 2 ? [1, -m.fs] : null,
  qwer: (m) => m.combos >= 15 ? [0, m.combos] : m.acc && m.acc < 60 ? [1, -1] : null,
  lasthit: (m) => m.kills === m.of ? [0, 20] : m.kills <= 3 ? [1, -m.kills] : null,
  greenlight: (m) => m.comm === 0 && m.omit === 0 ? [0, 15] : m.comm >= 4 ? [1, -m.comm] : null,
  smash: (m) => m.perfect >= 4 ? [0, m.perfect * 3] : null,
  dodge: (m) => !m.dead && m.hits === 0 ? [0, 25] : m.graze >= 12 ? [1, m.graze] : m.dead && m.sec < 10 ? [2, -5] : null,
  rhythm: (m) => m.miss === 0 ? [0, 25] : m.pf >= 20 ? [1, m.pf] : null,
  aim: (m) => m.avg && m.avg <= 420 && m.hits >= 15 ? [0, 600 - m.avg] : m.miss >= 15 ? [1, -m.miss] : null,
  stroop: (m) => m.ok >= 30 && m.acc >= 95 ? [0, m.ok] : null,
  fly: (m) => m.catches >= 10 ? [0, m.catches] : m.catches === 0 ? [1, -3] : null,
};
const HL_TX = {
  tap: { ko: ["초당 {tps}회 연타", "10초에 {taps}번 연타 (절전 모드)"], ja: ["毎秒{tps}回の連打", "10秒で{taps}回の連打（省電力モード）"], en: ["{tps} taps per second", "{taps} taps in 10s (power-saving mode)"] },
  memory: { ko: ["{span}칸 순서 완벽 기억", "{span}칸에서 기억 로그아웃"], ja: ["{span}マスの順番を完璧に記憶", "{span}マスで記憶がログアウト"], en: ["Perfectly recalled {span} tiles", "Memory logged out at {span} tiles"] },
  reaction: { ko: ["최고 반응 {best}ms", "부정 출발 {fs}번"], ja: ["最速反応{best}ms", "フライング{fs}回"], en: ["Best reaction {best}ms", "{fs} false starts"] },
  qwer: { ko: ["20초에 스킬 콤보 {combos}개", "QWER 정확도 {acc}%"], ja: ["20秒でスキルコンボ{combos}個", "QWER精度{acc}%"], en: ["{combos} skill combos in 20s", "QWER accuracy {acc}%"] },
  lasthit: { ko: ["막타 {of}/{of} 전부 성공", "막타 {kills}개 (골드 기부)"], ja: ["ラストヒット{of}/{of}全成功", "ラストヒット{kills}回（ゴールド寄付）"], en: ["All {of}/{of} last hits", "Only {kills} last hits (gold donated)"] },
  greenlight: { ko: ["신호 판단 실수 0번", "빨간불 출발 {comm}번"], ja: ["信号判断ミス0回", "赤信号発進{comm}回"], en: ["Zero signal mistakes", "Ran {comm} red lights"] },
  smash: { ko: ["퍼펙트 강타 {perfect}번"], ja: ["パーフェクトスマイト{perfect}回"], en: ["{perfect} perfect smites"] },
  dodge: { ko: ["불꽃 무피격 완주", "아슬아슬 회피 {graze}번", "{sec}초 만에 전소"], ja: ["炎ノーダメージ完走", "ギリギリ回避{graze}回", "{sec}秒で燃え尽き"], en: ["Flawless — zero hits", "{graze} near-misses", "Burned out in {sec}s"] },
  rhythm: { ko: ["리듬 미스 0개 풀콤보", "퍼펙트 {pf}개"], ja: ["リズムミス0のフルコンボ", "パーフェクト{pf}個"], en: ["Full combo, zero misses", "{pf} perfects"] },
  aim: { ko: ["평균 {avg}ms 명중", "허공 사격 {miss}발"], ja: ["平均{avg}msで命中", "空中射撃{miss}発"], en: ["Hits in {avg}ms on average", "{miss} shots into thin air"] },
  stroop: { ko: ["색깔 {ok}개 정답 (정확도 {acc}%)"], ja: ["色{ok}個正解（精度{acc}%）"], en: ["{ok} colors right ({acc}% accuracy)"] },
  fly: { ko: ["파리 {catches}마리 포획", "파리 0마리 (파리 해방)"], ja: ["ハエ{catches}匹捕獲", "ハエ0匹（ハエ解放）"], en: ["{catches} flies caught", "Zero flies (fly liberation)"] },
};
export function hlText(h, lang) { return fill(pk(HL_TX[h.test], lang)[h.k], h.m); }

export function highlights(results, lang = "ko") {
  const out = [];
  for (const [tid, r] of Object.entries(results)) {
    const m = r.m || {};
    const h = HIGHLIGHT[tid]?.(m);
    if (h) out.push({ test: tid, k: h[0], m, power: h[1], text: fill(pk(HL_TX[tid], lang)[h[0]], m) });
  }
  return out.sort((a, b) => Math.abs(b.power) - Math.abs(a.power));
}

const pickI = (R, n) => Math.floor(R() * n);
/**
 * 진단 생성 — 같은 입력·같은 seed면 언어만 달라도 같은 선택(목록 순서가 세 언어 동일)
 * @param {object} o { results: {tid:{score,m,flags}}, age, gender, seed, rank?, of?, prev?: {total, phys}, lang? }
 */
export function diagnose(o) {
  const lang = lg(o.lang);
  const R = rng((o.seed >>> 0) ^ 0x9e3779b9);
  const res = o.results || {};
  const s = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.score]));
  const ids = Object.keys(s);
  const total = totalScore(s);
  const phys = physicalAge(total);
  const age = o.age;
  const diff = phys - age;
  const ab = abilities(s);
  const abSorted = ABILITY_IDS.filter((a) => ab[a] !== null).sort((a, b) => ab[b] - ab[a]);
  const sorted = [...ids].sort((a, b) => s[b] - s[a]);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const flags = ids.some((k) => res[k].flags?.length);
  const ctx = {
    s, total, n: ids.length, flags, rank: o.rank || 0, of: o.of || 0,
    delta: o.prev ? total - o.prev.total : 0,
    spread: ids.length ? s[best] - s[worst] : 0,
    has: (...k) => k.every((x) => Number.isFinite(s[x])),
  };
  // 진단명 후보
  const cand = [];
  for (const [cond, pr, names] of DX_SPECIAL) if (cond(ctx)) cand.push({ pr: pr + R() * 3, names });
  if (best && s[best] >= 82) cand.push({ pr: 60 + (s[best] - 82) + R() * 6, names: DX_TEST[best].hi });
  if (worst && s[worst] <= 42) cand.push({ pr: 58 + (42 - s[worst]) * 0.6 + R() * 6, names: DX_TEST[worst].lo });
  const ageRow = DX_AGE.find(([lo, hi]) => diff >= lo && diff <= hi);
  cand.push({ pr: 55 + Math.min(25, Math.abs(diff)) + R() * 6, names: ageRow[2] });
  cand.sort((a, b) => b.pr - a.pr);
  const ti = pickI(R, cand[0].names.ko.length);
  const title = pk(cand[0].names, lang)[ti];
  const titleKo = cand[0].names.ko[ti];
  let sub = null;
  if (cand[1]) {
    let si = pickI(R, cand[1].names.ko.length);
    if (cand[1].names === cand[0].names && si === ti) si = (si + 1) % cand[1].names.ko.length;
    sub = pk(cand[1].names, lang)[si];
  }
  const code = `G-${(hashSeed(titleKo) % 90 + 10)}.${Math.abs(diff) % 10}`;
  // 게이머 유형
  let type;
  if (total < 30 || !abSorted.length) { const t = pk(TYPE_LOW, lang); type = { name: t[0], desc: t[1], main: abSorted[0] || null }; }
  else {
    const a1 = abSorted[0], a2 = abSorted[1] || abSorted[0];
    const noun = pk(TYPE_NOUN[a1], lang), adj = TYPE_ADJ[a2][lang];
    type = { name: `${a1 === a2 ? "" : adj + (lang === "ja" ? "" : " ")}${noun[0]}`, desc: noun[1], main: a1 };
  }
  // 의사 소견
  const op = [];
  const openRow = OPEN.find(([lo]) => total >= lo)[1];
  op.push(pk(openRow, lang)[pickI(R, openRow.ko.length)]);
  if (best && s[best] >= 55) op.push(fill(pk(BEST_TXT[best], lang)[pickI(R, BEST_TXT[best].ko.length)], res[best].m));
  if (worst && worst !== best && s[worst] < 62) op.push(fill(pk(WORST_TXT[worst], lang)[pickI(R, WORST_TXT[worst].ko.length)], res[worst].m));
  const gap = Math.abs(diff);
  const ageTx = AGE_TXT.find(([lo, hi]) => diff >= lo && diff <= hi)[2];
  const ageLine = op.length;
  op.push(fill(pk(ageTx, lang)[pickI(R, ageTx.ko.length)], { gap }));
  if (o.rank && o.of >= 2) op.push(fill(RANK_TXT[o.rank === 1 ? "first" : o.rank === o.of ? "last" : "mid"][lang], { rank: o.rank, of: o.of }));
  if (o.prev && Math.abs(ctx.delta) >= 3) op.push(fill(RANK_TXT[ctx.delta > 0 ? "up" : "down"][lang], { d: Math.abs(ctx.delta) }));
  const weakAb = abSorted[abSorted.length - 1];
  if (weakAb) op.push(pk(RX[weakAb], lang)[pickI(R, RX[weakAb].ko.length)]);
  const genres = [];
  for (const a of abSorted.slice(0, 3)) for (const g of pk(GENRE[a], lang)) if (!genres.includes(g) && genres.length < 3) genres.push(g);
  const rIdx = pickI(R, RETEST.ko.length);
  const v = verdictOf(diff);
  return {
    total, phys, age, diff, verdict: { ...v, ...verdictText(v.key, lang) }, ab, scores: s,
    best: best ? { id: best, name: testName(best, lang), score: s[best] } : null,
    worst: worst ? { id: worst, name: testName(worst, lang), score: s[worst] } : null,
    title, sub, code, type, opinion: op, genres,
    retest: flags ? FLAG_RETEST[lang] : pk(RETEST, lang)[rIdx],
    highlights: highlights(res, lang).slice(0, 3).map((h) => h.text),
    flagged: flags, lang, ageLine,
    // 다른 언어로 다시 만들 때 필요한 값
    seed: o.seed >>> 0, rank: o.rank || 0, of: o.of || 0, prevTotal: o.prev ? o.prev.total : null,
  };
}

// 저장된 결과(row) → 보는 사람 언어의 진단문으로 다시 만들기 (숫자는 그대로)
export function localizeResult(r, lang) {
  if (!r?.diag || lg(lang) === (r.diag.lang || "ko")) return r;
  if (r.age == null || r.diag.seed == null) {   // 나이 비공개 등으로 다시 못 만들면 저장된 진단명·유형만 바꿈
    const t = r.diag.i18n?.[lg(lang)];
    return t ? { ...r, diag: { ...r.diag, title: t.title, sub: t.sub, type: { ...r.diag.type, name: t.type } } } : r;
  }
  const results = {};
  for (const [t, sc] of Object.entries(r.scores || {})) results[t] = { score: sc, m: r.metrics?.[t]?.m || {}, flags: r.metrics?.[t]?.flags || [] };
  const d = diagnose({ results, age: r.age, gender: r.gender, seed: r.diag.seed, rank: r.diag.rank, of: r.diag.of, prev: r.diag.prevTotal != null ? { total: r.diag.prevTotal } : null, lang });
  return { ...r, diag: d };
}

// =========================================================
// 5) 멀티 단체 분석 — players: [{id, nick, age, results:{tid:{score,m}}, total, phys}]
// =========================================================
const LAST_RX = {
  ko: ["꼴찌 특별 처방: 오늘 밤은 손가락에게 휴가를 주세요.", "꼴찌 특별 처방: 1위에게 비법을 전수받는 수업료는 음료 한 잔입니다.", "꼴찌 특별 처방: 다음 판은 '컨디션 핑계 쿠폰' 1장 사용 가능.", "꼴찌 특별 처방: 이 결과는 실력이 아니라 겸손함의 표현으로 기록합니다.", "꼴찌 특별 처방: 재검사 시 응원단 2명 동행을 허가합니다.", "꼴찌 특별 처방: 분위기 메이커 수당이 지급됩니다."],
  ja: ["最下位特別処方：今夜は指に休暇をあげてください。", "最下位特別処方：1位に秘訣を教わる授業料はジュース1杯です。", "最下位特別処方：次の試合は「体調のせいクーポン」を1枚使えます。", "最下位特別処方：この結果は実力ではなく謙虚さの表れとして記録します。", "最下位特別処方：再検査時、応援団2名の同行を許可します。", "最下位特別処方：ムードメーカー手当を支給します。"],
  en: ["Last-place Rx: give your fingers the night off.", "Last-place Rx: tuition for the winner's secrets is one drink.", "Last-place Rx: you get one \"bad day\" excuse coupon for the next round.", "Last-place Rx: we'll record this as humility, not skill.", "Last-place Rx: you may bring two cheerleaders to your retest.", "Last-place Rx: a mood-maker bonus has been issued."],
};
const WARD = [
  [80, { ko: ["프로게이머 특별 병동", "국가대표 훈련 병동"], ja: ["プロゲーマー特別病棟", "代表選手トレーニング病棟"], en: ["Pro Gamer Special Ward", "National Team Training Ward"] }],
  [60, { ko: ["현역 게이머 병동", "건강 피지컬 병동"], ja: ["現役ゲーマー病棟", "健康フィジカル病棟"], en: ["Active Gamer Ward", "Healthy Physique Ward"] }],
  [45, { ko: ["평균의 신 병동", "무난 운행 병동"], ja: ["平均の神病棟", "無難運行病棟"], en: ["Ward of the Average", "Smooth Operation Ward"] }],
  [0, { ko: ["예열 필요 병동", "절전 모드 병동"], ja: ["ウォームアップ必要病棟", "省電力モード病棟"], en: ["Warm-up Needed Ward", "Power-saving Ward"] }],
];
export function groupReport(players, tests, seed = 1, lang = "ko") {
  const R = rng(seed ^ 0x51ed27);
  const perTest = {};
  for (const tid of tests) {
    const rows = players.map((p) => ({ id: p.id, score: p.results?.[tid]?.score ?? 0 })).sort((a, b) => b.score - a.score);
    let rank = 0, prev = null;
    rows.forEach((r, i) => { if (r.score !== prev) rank = i + 1; r.rank = rank; prev = r.score; });
    perTest[tid] = { rows, mvp: rows[0] && rows[0].score > 0 ? rows[0].id : null };
  }
  const order = [...players].sort((a, b) => b.total - a.total || a.phys - b.phys);
  let rank = 0, prev = null;
  const ranking = order.map((p, i) => { if (p.total !== prev) rank = i + 1; prev = p.total; return { id: p.id, rank, total: p.total }; });
  let drama = null;
  for (const p of players) for (const h of highlights(p.results || {}, lang)) if (!drama || Math.abs(h.power) > Math.abs(drama.power)) drama = { ...h, id: p.id };
  let crush = null;
  for (const tid of tests) {
    const r = perTest[tid].rows;
    if (r.length >= 2 && r[0].score - r[1].score > (crush?.gap ?? 14)) crush = { test: tid, id: r[0].id, gap: r[0].score - r[1].score };
  }
  const avgTotal = Math.round(mean(players.map((p) => p.total)));
  const avgPhys = Math.round(mean(players.map((p) => p.phys)));
  const wardRow = WARD.find(([lo]) => avgTotal >= lo)[1];
  const wardIdx = pickI(R, wardRow.ko.length);
  const lastIdx = pickI(R, LAST_RX.ko.length);
  return {
    perTest, ranking, drama, crush, avgTotal, avgPhys, ward: pk(wardRow, lang)[wardIdx], wardIdx,
    lastRx: players.length >= 2 ? pk(LAST_RX, lang)[lastIdx] : null, lastIdx,
    lastId: players.length >= 2 ? ranking[ranking.length - 1].id : null,
  };
}
// 저장된 단체 보고서 글자만 보는 사람 언어로
export function localizeReport(rep, lang) {
  if (!rep) return rep;
  const L = lg(lang);
  const wardRow = WARD.find(([lo]) => rep.avgTotal >= lo)[1];
  return {
    ...rep,
    ward: rep.wardIdx != null ? pk(wardRow, L)[rep.wardIdx] : rep.ward,
    lastRx: rep.lastRx && rep.lastIdx != null ? pk(LAST_RX, L)[rep.lastIdx] : rep.lastRx,
    drama: rep.drama && rep.drama.k != null ? { ...rep.drama, text: hlText(rep.drama, L) } : rep.drama,
  };
}

// 유머 문구 개수 (검수용, 한국어 기준)
export function phraseCount() {
  let n = 0;
  for (const v of Object.values(DX_TEST)) n += v.hi.ko.length + v.lo.ko.length;
  for (const r of DX_AGE) n += r[2].ko.length;
  for (const r of DX_SPECIAL) n += r[2].ko.length;
  for (const r of OPEN) n += r[1].ko.length;
  for (const v of Object.values(BEST_TXT)) n += v.ko.length;
  for (const v of Object.values(WORST_TXT)) n += v.ko.length;
  for (const r of AGE_TXT) n += r[2].ko.length;
  for (const v of Object.values(RX)) n += v.ko.length;
  n += RETEST.ko.length + LAST_RX.ko.length + Object.keys(TYPE_NOUN).length;
  return n;
}
// 세 언어 목록 길이가 같은지 (같은 시드 = 같은 선택 보장) — 시험용
export function checkLangParity() {
  const bad = [];
  const chk = (name, o) => { const n = o.ko.length; for (const l of ["ja", "en"]) if (!Array.isArray(o[l]) || o[l].length !== n) bad.push(`${name}.${l}`); };
  for (const [k, v] of Object.entries(DX_TEST)) { chk(`DX_TEST.${k}.hi`, v.hi); chk(`DX_TEST.${k}.lo`, v.lo); }
  DX_AGE.forEach((r, i) => chk(`DX_AGE.${i}`, r[2]));
  DX_SPECIAL.forEach((r, i) => chk(`DX_SPECIAL.${i}`, r[2]));
  OPEN.forEach((r, i) => chk(`OPEN.${i}`, r[1]));
  for (const [k, v] of Object.entries(BEST_TXT)) chk(`BEST.${k}`, v);
  for (const [k, v] of Object.entries(WORST_TXT)) chk(`WORST.${k}`, v);
  AGE_TXT.forEach((r, i) => chk(`AGE.${i}`, r[2]));
  for (const [k, v] of Object.entries(RX)) chk(`RX.${k}`, v);
  for (const [k, v] of Object.entries(GENRE)) chk(`GENRE.${k}`, v);
  for (const [k, v] of Object.entries(TYPE_NOUN)) chk(`TYPE.${k}`, v);
  for (const [k, v] of Object.entries(HL_TX)) chk(`HL.${k}`, v);
  chk("RETEST", RETEST); chk("LAST_RX", LAST_RX); chk("TYPE_LOW", TYPE_LOW);
  WARD.forEach((r, i) => chk(`WARD.${i}`, r[1]));
  return bad;
}
