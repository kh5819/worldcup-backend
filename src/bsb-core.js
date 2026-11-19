// =========================
// DUO 플듀 베이스볼 — 공통 야구 엔진 (2026-11-19)
// ※ 서버(worldcup-backend/src/bsb-core.js)와 화면(홈페이지 제작/js/baseball/bsb-core.js)이 같은 파일 — 고치면 둘 다 복사 (시험이 같은지 확인)
// · 투구(구종 6종 + 특수 궤적), 스윙 판정, 타구 물리(고정 1/60초), 자동 수비(타구 예측·추적·송구), 득점 표, 보스 6종 패턴, 증강 40종 정의
// · 판정·결과는 서버만 계산. 화면은 같은 함수로 공 궤적·타구 비행을 그리기만 함
// · 같은 입력 + 같은 시드면 같은 결과 (난수는 rng(seed)로만)
// 좌표: 존 단위 x(−1~1 = 홈플레이트 폭), y(−1~1 = 스트라이크존 높이). 경기장 m 단위: x 오른쪽(1루 쪽) +, y 중견수 쪽 +, z 위 +, 홈플레이트가 원점
// =========================
export const VER = 1;
export const SLOW = 1.8;                 // 게임 시간 배율 (실제 구속 표시는 그대로, 공은 1.8배 느리게 날아옴)
export const DIST = 16.9;                // 손에서 놓는 곳 → 홈플레이트 (m)
export const SWING_LAG = 40;             // 누른 뒤 배트가 공 맞는 자리까지 (ms)
export const WIN = { perfect: 15, good: 36, fair: 68, max: 108 }; // 타이밍 허용 (ms, 늦거나 빠른 정도)
export const R_CONTACT = 0.62, R_GOOD = 0.36, R_SWEET = 0.2;     // 배트 위치 허용 (존 단위)
export const BALL_R = 0.14;              // 스트라이크 판정 공 반지름 (존 단위)
export const MAX_LAG = 300, FUTURE_TOL = 140; // 지연 보정 상한 (이보다 늦게 온 스윙은 늦은 스윙으로) · 미래 스윙 허용 오차
export const REL = { x: 0.35, y: 3.6 };  // 손에서 놓는 위치 (존 단위)
export const ZONE_M = { hx: 0.215, cz: 0.78, hz: 0.3 }; // 존 → m
export const WINDUP = 900;               // 투구 동작 (ms)
export const BASES = [[19.4, 19.4], [0, 38.8], [-19.4, 19.4], [0, 0]]; // 1루 2루 3루 홈 (m)
export const WALL_H = 3.2;
export const fenceDist = (deg) => { const a = Math.min(1, Math.abs(deg) / 45); return 95 + 21 * (1 - a * a); }; // 좌우 95m, 가운데 116m (캐주얼 구장)
export const MAX_AUGS = 5, PICK_MS = 12_000;

// ---------- 난수 (결정적) ----------
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const mixSeed = (...xs) => { let h = 2166136261 >>> 0; for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9e37; h = Math.imul(h, 2246822507) >>> 0; } return h >>> 0; };
const gauss = (r) => (r() + r() + r() - 1.5) / 0.5;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const round2 = (v) => Math.round(v * 100) / 100;

// ---------- 구종 ----------
// spd 구속 범위(km/h) · bx/by 공 끝 변화(존 단위, 마지막에 휘는 양) · k 휘는 시점(클수록 늦게) · hump 처음에 떠오르는 양 · ctrl 제구 흔들림
export const PT = {
  fb: { name: "직구", col: "#ffffff", spd: [138, 154], bx: 0.05, by: 0.22, k: 2.0, hump: 0, ctrl: 0.11 },
  cu: { name: "커브", col: "#6fd4ff", spd: [108, 122], bx: 0.38, by: -1.3, k: 2.2, hump: 0.5, ctrl: 0.16 },
  sl: { name: "슬라이더", col: "#c49bff", spd: [126, 139], bx: -0.95, by: -0.35, k: 2.9, hump: 0, ctrl: 0.15 },
  ch: { name: "체인지업", col: "#8fe07b", spd: [116, 130], bx: 0.42, by: -0.68, k: 2.3, hump: 0.04, ctrl: 0.14 },
  fk: { name: "포크볼", col: "#ffb24a", spd: [126, 139], bx: 0.02, by: -1.32, k: 3.8, hump: 0, ctrl: 0.17 },
  si: { name: "싱커", col: "#ff8fc0", spd: [136, 148], bx: 0.62, by: -0.62, k: 2.4, hump: 0, ctrl: 0.13 },
  hv: { name: "천상의 마구", col: "#fff3a8", spd: [146, 152], bx: 0.9, by: -0.9, k: 4.2, hump: 0.3, ctrl: 0.08, special: true }, // 전설 증강 전용 (S자로 두 번 꺾임)
};
export const PITCH_TYPES = ["fb", "cu", "sl", "ch", "fk", "si"];
export const flightMs = (kmh) => Math.round(DIST / (kmh / 3.6) * 1000 * SLOW);
export const isStrike = (x, y) => Math.abs(x) <= 1 + BALL_R && Math.abs(y) <= 1 + BALL_R;

/**
 * 투구 만들기 (서버). sel = { type, x, y (노린 공 끝 위치), pw 0~1 (세기) }, m = 투수 능력(증강) { spd, fbSpd, brk, wobble, decoys, fade, ctrl }
 * 결과 공 끝(fx,fy)에 제구 흔들림이 더해짐. 세게 던질수록 빠르지만 더 흔들림.
 */
export function makePitch(id, sel, m = {}, r = Math.random, o = {}) {
  const d = PT[sel.type] || PT.fb, pw = clamp(Number(sel.pw) || 0, 0, 1);
  let spd = d.spd[0] + (d.spd[1] - d.spd[0]) * pw + (m.spd || 0) + (sel.type === "fb" ? (m.fbSpd || 0) : 0);
  spd = clamp(spd * (o.spdMul || 1), 70, 172);
  const noise = d.ctrl * (0.55 + pw * 0.75) * (m.ctrl || 1) * (o.ctrlMul || 1);
  const fx = round2(clamp((Number(sel.x) || 0) + gauss(r) * noise, -2.4, 2.4));
  const fy = round2(clamp((Number(sel.y) || 0) + gauss(r) * noise, -2.4, 2.4));
  const brk = (m.brk || 1) * (o.brkMul || 1) * (sel.type === "fb" ? 1 : 1);
  const p = { id, type: sel.type in PT ? sel.type : "fb", spd: Math.round(spd), T: flightMs(Math.round(spd)), fx, fy, rx: REL.x, ry: o.ry ?? REL.y,
    bx: round2(d.bx * brk * (o.flipX ? -1 : 1)), by: round2(d.by * (sel.type === "fb" ? 1 : brk) * (o.flipY ? -1 : 1)), k: d.k, hump: d.hump * (o.humpMul || 1) };
  if (m.wobble && sel.type !== "fb") p.wob = round2(m.wobble);                        // 회오리: 늦게 반대로 한 번 더 꺾임
  if (sel.type === "hv") p.wob = 0.55;
  p.strike = isStrike(fx, fy);
  if (m.decoys) p.decoys = makeDecoys(p, m.decoys, m.fade ?? 0.72, r);
  return p;
}
/** 가짜 공(분신): 진짜와 같이 출발해서 다른 곳으로 가다 fade 지점부터 사라짐 */
export function makeDecoys(p, n, fade, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = PITCH_TYPES[Math.floor(r() * PITCH_TYPES.length)], d = PT[t];
    out.push({ fx: round2(clamp(p.fx + (r() - 0.5) * 1.6, -1.6, 1.6)), fy: round2(clamp(p.fy + (r() - 0.5) * 1.6, -1.6, 1.6)), bx: d.bx, by: d.by, k: d.k, hump: d.hump, rx: p.rx, ry: p.ry, fade });
  }
  return out;
}
/** 시간(ms) → 진행도 s (0~1). prof = [[시간비율, 거리비율]...] 가 있으면 감속·시간 왜곡 */
export function progress(p, ms) {
  const f = ms / p.T; if (!p.prof) return f;
  let pt = 0, ps = 0;
  for (const [tf, sf] of p.prof) { if (f <= tf) return ps + (sf - ps) * ((f - pt) / Math.max(1e-6, tf - pt)); pt = tf; ps = sf; }
  return ps + (f - pt) * ((1 - ps) / Math.max(1e-6, 1 - pt));
}
/** 진행도 s 에서 공 위치 (존 단위) — 공 끝에서 휘는 양만큼 처음엔 다른 곳을 향함 */
export function posAt(p, s) {
  const k = p.k || 2, sk = s <= 0 ? 0 : Math.pow(s, k), hump = (p.hump || 0) * 4 * (s - s * s);
  let x = p.rx + (p.fx - p.bx - p.rx) * s + p.bx * sk, y = p.ry + (p.fy - p.by - p.ry) * s + p.by * sk + hump;
  if (p.wob) { const w = s > 0.55 ? (s - 0.55) / 0.45 : 0; x += -p.wob * (w * (1 - w)) * 3.2 * Math.sign(p.bx || 1); }
  if (p.tp && s < p.tp.s) { x -= p.tp.dx; y -= p.tp.dy; }
  return { x, y, z: DIST * (1 - s) };
}

// ---------- 스윙 판정 ----------
/**
 * sw = { dt: 공을 놓은 뒤 누른 시간(ms), x, y: 배트 위치(존 단위), pw: 파워 스윙 }
 * m = 타자 능력 { win(배율), rad(배율), late(늦은 쪽 추가 ms), ev, la, ... }
 * → { contact, e(타이밍 오차 ms: −빠름 +늦음), d(위치 오차), grade: perfect|good|fair|weak, q 0~1 }
 */
export function judgeSwing(p, sw, m = {}) {
  let e = (Number(sw.dt) || 0) + SWING_LAG - p.T;
  if (e > 0 && m.late) e = Math.max(0, e - m.late);
  const wm = (m.win || 1) * (sw.pw ? 0.78 : 1);
  const W = { perfect: WIN.perfect * wm, good: WIN.good * wm, fair: WIN.fair * wm, max: WIN.max * wm };
  const rm = (m.rad || 1) * (sw.pw ? 0.86 : 1), R = R_CONTACT * rm;
  const d = Math.hypot((Number(sw.x) || 0) - p.fx, (Number(sw.y) || 0) - p.fy);
  if (Math.abs(e) > W.max) return { contact: false, why: e < 0 ? "early" : "late", e: Math.round(e), d: round2(d), W, R };
  if (d > R) return { contact: false, why: "miss", e: Math.round(e), d: round2(d), W, R };
  const qt = 1 - Math.abs(e) / W.max, qs = 1 - d / R, q = 0.55 * qt + 0.45 * qs;
  const grade = Math.abs(e) <= W.perfect && d <= R_SWEET * rm ? "perfect" : Math.abs(e) <= W.good && d <= R_GOOD * rm ? "good" : Math.abs(e) <= W.fair ? "fair" : "weak";
  return { contact: true, e: Math.round(e), d: round2(d), q: round2(q), qt: round2(qt), qs: round2(qs), grade, W, R };
}
/** 맞은 공 → 타구 속도(km/h)·발사각(도)·방향(도, −왼쪽 +오른쪽). 빠르게 치면 당겨침, 늦으면 밀어침. 배트가 공 아래면 뜬공 */
export function launch(p, j, sw, m = {}, r = Math.random) {
  const R = j.R;
  let ev = 78 + 100 * Math.pow(j.q, 0.8) + (p.spd - 130) * 0.16 + (sw.pw ? 11 : 0) + (m.ev || 0) + (j.grade === "perfect" ? 6 : 0) + (r() - 0.5) * 6;
  if (j.grade === "weak") ev *= 0.72;
  ev = clamp(ev, 40, m.evCap || 185);
  let la = 16 + ((p.fy - (Number(sw.y) || 0)) / R) * 46 + (sw.pw ? 5 : 0) + (m.la || 0) + (r() - 0.5) * 9;
  if (j.grade === "perfect") la = la * 0.4 + 28 * 0.6; else if (j.grade === "good") la = la * 0.75 + 24 * 0.25; // 정타는 이상적인 각도 쪽으로
  la = clamp(la, -35, 82);
  let sp = (j.e / j.W.max) * 50 - ((Number(sw.x) || 0) - p.fx) * 7 + (r() - 0.5) * 8;
  sp = clamp(sp, -70, 70);
  const foul = Math.abs(sp) > 45 || (j.grade === "weak" && r() < 0.4);
  return { ev: Math.round(ev), la: Math.round(la), sp: Math.round(sp), foul };
}

// ---------- 타구 물리 ----------
const DRAG = 0.0042, G = 9.81, STEP = 1 / 60;
/** 타구 비행: 고정 1/60초. pts 는 1/30초마다 [t, x, y, z]. 펜스 넘으면 hr. 바운드·굴러감·펜스 맞고 튐 */
export function flight(L, o = {}) {
  const a = L.la * Math.PI / 180, sp = L.sp * Math.PI / 180, v0 = L.ev / 3.6 * (o.distMul || 1);
  let vh = v0 * Math.cos(a), vz = v0 * Math.sin(a), dx = Math.sin(sp), dy = Math.cos(sp);
  let x = 0, y = 0.6, z = 0.9, t = 0, landed = false, hr = false, carry = 0, hang = 0, wall = false, stopped = false;
  const fd = fenceDist(L.sp), pts = [[0, 0, 0.6, 0.9]];
  for (let i = 1; i <= 60 * 9; i++) {
    const v = Math.hypot(vh, vz); vh -= DRAG * v * vh * STEP; vz -= (G + DRAG * v * vz) * STEP; t = i * STEP;
    if (landed && z <= 0.001 && Math.abs(vz) < 1.2) { vz = 0; z = 0; vh = Math.max(0, vh - 5.5 * STEP); }
    x += vh * dx * STEP; y += vh * dy * STEP; z += vz * STEP;
    const rr = Math.hypot(x, y);
    if (!wall && !hr && rr >= fd && !o.noFence) {
      if (z > WALL_H) hr = true;
      else { wall = true; dx = -dx; dy = -dy; vh *= 0.32; const k = (fd - 0.3) / rr; x *= k; y *= k; }
    }
    if (z <= 0) {
      z = 0;
      if (!landed) { landed = true; carry = Math.hypot(x, y); hang = t; if (hr) { pts.push([round2(t), round2(x), round2(y), 0]); break; } }
      if (vz < 0) { vz = -vz * 0.36; vh *= 0.62; if (vz < 1.2) vz = 0; }
    }
    if (i % 2 === 0) pts.push([round2(t), round2(x), round2(y), round2(z)]);
    if (landed && vh <= 0.05 && z <= 0) { stopped = true; break; }
  }
  if (!landed) { carry = Math.hypot(x, y); hang = t; }
  if (hr && !carry) carry = Math.hypot(x, y);
  return { pts, hr, carry: Math.round(carry * 10) / 10, hang: round2(hang), wall, stopped };
}

// ---------- 자동 수비 ----------
// 투수 포수 1루 2루 유격 3루 좌익 중견 우익 — 기본 위치(m)
export const FIELDERS = [
  { id: "P", x: 0, y: 18.4, inf: true }, { id: "C", x: 0, y: -1.2, inf: true }, { id: "1B", x: 16.5, y: 26, inf: true }, { id: "2B", x: 9, y: 39, inf: true },
  { id: "SS", x: -9.5, y: 39, inf: true }, { id: "3B", x: -16.5, y: 26, inf: true }, { id: "LF", x: -30, y: 76, inf: false }, { id: "CF", x: 0, y: 90, inf: false }, { id: "RF", x: 30, y: 76, inf: false },
];
export const RUN_T = [4.25, 8.0, 11.75, 15.5]; // 타자 주자 도착 시간 (1루·2루·3루·홈, 초)
/**
 * 수비 판정: 수비수마다 "반응 시간 + 거리/속도" 로 공(높이 2.6m 아래)에 닿을 수 있는 첫 순간을 찾음 (상태 머신 = 대기→추적→포구/처리→송구)
 * D = 수비 능력 { spd 배율, react −초, catchR 배율, rob: 펜스 넘는 공 잡기 }
 * → { kind: hr|ihr|single|double|triple|groundout|flyout|lineout|popout, f: 수비수 번호, t, x, y, bases }
 */
export function fielding(fl, L, D = {}, rr = Math.random) {
  if (fl.hr) {
    // 완벽한 수비: 펜스를 살짝 넘는 공을 잡아냄
    if (D.rob) { const p = fl.pts.find(q => Math.hypot(q[1], q[2]) >= fenceDist(L.sp) - 0.5); if (p && p[3] < WALL_H + 1.4) return { kind: "flyout", f: L.sp < -15 ? 6 : L.sp > 15 ? 8 : 7, t: p[0], x: p[1], y: p[2], bases: 0, robbed: true }; }
    return { kind: "hr", f: -1, t: fl.hang, x: fl.pts[fl.pts.length - 1][1], y: fl.pts[fl.pts.length - 1][2], bases: 4, dist: fl.carry };
  }
  const spd = 6.4 * (D.spd || 1), catchR = 1.15 * (D.catchR || 1);
  let firstLand = Infinity; for (const p of fl.pts) if (p[0] > 0.1 && p[3] <= 0.01) { firstLand = p[0]; break; }
  for (const p of fl.pts) {
    const [t, x, y, z] = p; if (t < 0.12) continue;
    const inAir = t < firstLand;
    if (z > (inAir ? 2.3 : 1.0)) continue;
    let best = -1, bestT = Infinity;
    FIELDERS.forEach((f, i) => {
      if (i === 1 && Math.hypot(x, y) > 9) return;               // 포수는 홈 근처 뜬공만
      const react = (f.inf ? 0.5 : 0.95) - (D.react || 0);
      const reach = Math.max(0, t - react) * spd + catchR;
      const dist = Math.hypot(f.x - x, f.y - y);
      if (dist <= reach && t < bestT) { best = i; bestT = t; }
    });
    if (best < 0) continue;
    const f = FIELDERS[best];
    if (inAir) { const kind = L.la >= 50 ? "popout" : L.la < 20 ? "lineout" : "flyout"; return { kind, f: best, t, x, y, bases: 0 }; }
    // 땅에 닿은 공: 내야에서 잡으면 1루 송구 시합
    const r = Math.hypot(x, y);
    if (f.inf && r < 46) {
      const tThrow = t + 0.45 + Math.hypot(x - BASES[0][0], y - BASES[0][1]) / 30;
      const runner = RUN_T[0] + (D.runner || 0);
      if (tThrow < runner) return { kind: "groundout", f: best, t, x, y, bases: 0, quick: t < 2.1 };
      return { kind: "single", f: best, t, x, y, bases: 1, infield: true };
    }
    return hitByRetrieve(best, t, x, y, D);
  }
  // 아무도 못 닿았으면 공이 멈춘 곳에서 가장 가까운 외야수가 주움
  const last = fl.pts[fl.pts.length - 1]; let best = 6, bd = Infinity;
  for (let i = 6; i < 9; i++) { const d = Math.hypot(FIELDERS[i].x - last[1], FIELDERS[i].y - last[2]); if (d < bd) { bd = d; best = i; } }
  return hitByRetrieve(best, Math.max(last[0], 0.42 + bd / spd), last[1], last[2], D);
}
function hitByRetrieve(fi, t, x, y, D) {
  let bases = 1;
  for (let b = 2; b <= 4; b++) {
    const throwT = t + 0.55 + Math.hypot(x - BASES[b - 1][0], y - BASES[b - 1][1]) / 28 + (b === 4 ? 0.4 : 0);
    if (RUN_T[b - 1] + (D.runner || 0) + 0.35 < throwT) bases = b; else break;
  }
  return { kind: ["single", "double", "triple", "ihr"][bases - 1], f: fi, t, x, y, bases };
}
/** 결과 한 번에 (서버): 판정 → 발사 → 비행 → 수비 */
export function playBall(L, D = {}, r = Math.random, o = {}) {
  if (L.foul) return { kind: "foul", fl: null };
  const fl = flight(L, o); const play = fielding(fl, L, D, r);
  return { kind: play.kind, fl, play, dist: fl.hr ? fl.carry : Math.round(Math.hypot(play.x, play.y) * 10) / 10 };
}
export const HIT_KINDS = new Set(["single", "double", "triple", "hr", "ihr"]);
export const OUT_KINDS = new Set(["groundout", "flyout", "lineout", "popout"]);
export const KIND_NAME = { single: "안타", double: "2루타", triple: "3루타", hr: "홈런", ihr: "그라운드 홈런", groundout: "땅볼 아웃", flyout: "뜬공 아웃", lineout: "직선타 아웃", popout: "내야 뜬공", foul: "파울", whiff: "헛스윙", ball: "볼", strike: "스트라이크", walk: "볼넷", k: "삼진", dp: "병살" };

// ---------- 홈런더비 점수 (설정) ----------
export const DERBY = {
  score: { single: 100, double: 200, triple: 300, ihr: 400, hr: 500, out: 0 },
  longHr: [[130, 150], [145, 350]],   // 비거리 130m 이상 +150, 145m 이상 +350
  combo: 100,                          // 연속 홈런 1번 이어질 때마다 +100 (2연속 +100, 3연속 +200 …)
  comboCap: 1000, perfect: 50, golden: 3, evBonus: 7,
  times: [60, 120, 180], pitchLimits: [20, 30], practiceCap: 10 * 60, augAt: [1500, 4000, 8000, 14000], augAtPitch: [6, 12, 18, 24],
};

// ---------- 보스 6종 ----------
// 패턴: gen(r, phase, enr) → 투구 설정. md = 놓치면 팀 방어 게이지 감소량 기준, hm = 맞혔을 때 피해 배율
export const BOSSES = {
  slime: { loss: 0.55, name: "슬라임 투수", diff: "쉬움", star: 1, hp: 700, phases: [0.5], time: 300, col: "#7be07b", pats: [["slow", 4], ["split", 3], ["sticky", 2], ["fake", 2]], pats2: [["slow", 2], ["split", 4], ["sticky", 2], ["fake", 3]], spd: 0.78 },
  dragon: { loss: 1, name: "화염 드래곤", diff: "보통", star: 2, hp: 1000, phases: [0.5], time: 300, col: "#ff6b3c", pats: [["fireball", 4], ["fcurve", 3], ["explode", 2], ["meteor", 1]], pats2: [["fireball", 3], ["fcurve", 2], ["explode", 3], ["meteor", 3]], spd: 0.9 },
  witch: { loss: 0.85, name: "얼음 마녀", diff: "보통", star: 2, hp: 950, phases: [0.5], time: 300, col: "#8fd8ff", pats: [["iceball", 4], ["decel", 3], ["icedrop", 2], ["freeze", 1]], pats2: [["iceball", 2], ["decel", 3], ["icedrop", 3], ["freeze", 2]], spd: 0.88 },
  mech: { loss: 0.9, name: "기계 투수", diff: "어려움", star: 3, hp: 1100, phases: [0.5], time: 300, col: "#9aa8c0", shield: 6, pats: [["rocket", 4], ["laser", 2], ["mbreak", 3], ["multi", 1]], pats2: [["rocket", 3], ["laser", 3], ["mbreak", 3], ["multi", 2]], spd: 1.0 },
  goblin: { loss: 0.9, name: "도깨비 야구왕", diff: "어려움", star: 3, hp: 1550, phases: [0.5], time: 300, col: "#ff5a7a", stunNeed: 3, pats: [["golden", 2], ["teleport", 3], ["prank", 3], ["club", 2]], pats2: [["golden", 2], ["teleport", 3], ["prank", 3], ["club", 3]], spd: 0.95 },
  cosmic: { loss: 0.9, name: "우주의 투수", diff: "최상", star: 4, hp: 2150, phases: [0.66, 0.33], time: 360, col: "#b48cff", pats: [["gravity", 3], ["blackhole", 3], ["warp", 2], ["clones", 2]], pats2: [["gravity", 2], ["blackhole", 3], ["warp", 3], ["clones", 3]], pats3: [["gravity", 2], ["blackhole", 3], ["warp", 3], ["clones", 3], ["nova", 2]], spd: 1.02 },
};
export const BOSS_IDS = Object.keys(BOSSES);
export const BOSS_STATES = ["IDLE", "WINDUP", "PITCH", "ATTACK", "RECOVERY", "STUNNED", "PHASE_CHANGE", "ENRAGED", "DEFEATED"];
// 패턴 이름·예고(대응 방법)
export const PATS = {
  slow: { name: "느린 공", hint: "천천히 와요 — 충분히 기다렸다 치세요", atk: false },
  split: { name: "분열 공", hint: "공이 여러 개로 갈라져요 — 그림자가 있는 진짜 공만 맞아요", atk: true },
  sticky: { name: "점액 공", hint: "끈적한 공 — 맞히기 범위가 좁아요, 가운데를 노리세요", atk: false },
  fake: { name: "가짜 공", hint: "도중에 사라질 수도 있어요 — 사라지면 치지 마세요!", atk: true },
  fireball: { name: "불꽃 강속구", hint: "아주 빨라요 — 일찍 준비! 놓치면 방어 게이지가 크게 줄어요", atk: true },
  fcurve: { name: "화염 커브", hint: "크게 떨어지는 커브 — 낮게 노리세요", atk: false },
  explode: { name: "폭발 공", hint: "놓치면 폭발! 맞히면 큰 피해를 돌려줘요", atk: true },
  meteor: { name: "메테오 투구", hint: "하늘에서 떨어져요 — 아주 낮게, 늦게 치세요", atk: true },
  iceball: { name: "얼음 공", hint: "단단한 얼음 공 — 정타만 아프게 들어가요", atk: false },
  decel: { name: "급감속", hint: "빠르게 오다 갑자기 느려져요 — 한 박자 늦게!", atk: false },
  icedrop: { name: "낙차 얼음", hint: "끝에서 뚝 떨어져요", atk: false },
  freeze: { name: "배트 빙결", hint: "못 치면 배트가 얼어요 (연속으로 맞히면 녹아요)", atk: true },
  rocket: { name: "초고속 직구", hint: "160km/h 넘는 직구 — 공이 손을 떠나자마자!", atk: false },
  laser: { name: "레이저 공", hint: "곧게 날아오는 광선 — 놓치면 아파요", atk: true },
  mbreak: { name: "기계 변화구", hint: "마지막에 어디로 꺾일지 몰라요", atk: false },
  multi: { name: "다중 투구", hint: "두 개가 연달아 와요!", atk: true },
  golden: { name: "황금 야구공", hint: "맞히면 큰 피해 + 기절 게이지 (팀이 3번 맞히면 기절)", atk: false },
  teleport: { name: "순간이동 마구", hint: "도중에 순간이동해요 — 끝까지 보세요", atk: false },
  prank: { name: "장난 공", hint: "반대로 휘어요!", atk: false },
  club: { name: "도깨비 방망이", hint: "큰 공 — 놓치면 크게 아프고, 맞히면 기절 게이지", atk: true },
  gravity: { name: "중력 변화구", hint: "위로 솟아올라요 — 높게 노리세요", atk: false },
  blackhole: { name: "블랙홀 공", hint: "가운데로 빨려들었다 튕겨 나가요", atk: true },
  warp: { name: "시간 왜곡", hint: "느렸다가 갑자기 빨라져요", atk: false },
  clones: { name: "다중 분신 공", hint: "분신 여러 개 — 그림자 있는 진짜만!", atk: true },
  nova: { name: "초신성 투구", hint: "광폭화 필살기 — 놓치면 게이지가 크게 줄어요", atk: true },
  stun: { name: "기절", hint: "보스가 기절했어요! 지금 마음껏 치세요 (피해 2배)", atk: false },
};
/** 보스 투구 만들기: 패턴 → 투구 (서버). 전부 같은 공을 모두에게 */
export function bossPitch(id, boss, pat, phase, r, o = {}) {
  const B = BOSSES[boss], spdMul = (B?.spd || 1) * (o.enraged ? 1.08 : 1) * (1 + (phase - 1) * 0.04) * (o.diff || 1);
  const zone = () => ({ x: (r() - 0.5) * 1.7, y: (r() - 0.5) * 1.7 });
  const ballish = () => r() < 0.18 ? { x: (r() < 0.5 ? -1 : 1) * (1.35 + r() * 0.4), y: (r() - 0.5) * 2 } : zone();
  let sel = { type: "fb", pw: 0.5, ...ballish() }, m = {}, op = { spdMul }, ex = { md: 6, hm: 1 };
  switch (pat) {
    case "slow": sel = { ...sel, type: "ch", pw: 0.1 }; op.spdMul *= 0.82; ex.md = 4; break;
    case "split": sel = { ...sel, type: "fb", pw: 0.3, ...zone() }; m.decoys = 2 + (phase > 1 ? 1 : 0); m.fade = 0.8; ex.md = 6; ex.shadow = true; break;
    case "sticky": sel = { ...sel, type: "si", pw: 0.3 }; ex.radMul = 0.78; ex.md = 5; break;
    case "fake": sel = { ...sel, type: "fb", pw: 0.4, ...zone() }; if (r() < 0.5) { ex.fake = true; ex.vanish = 0.66; } ex.md = 7; break;
    case "fireball": sel = { ...sel, type: "fb", pw: 1, ...zone() }; op.spdMul *= 1.04; ex.md = 9; ex.vfx = "fire"; break;
    case "fcurve": sel = { ...sel, type: "cu", pw: 0.8 }; op.brkMul = 1.2; ex.vfx = "fire"; break;
    case "explode": sel = { ...sel, type: "sl", pw: 0.7, ...zone() }; ex.md = 14; ex.hm = 1.4; ex.vfx = "bomb"; break;
    case "meteor": sel = { ...sel, type: "fk", pw: 0.6, x: (r() - 0.5) * 1.4, y: -0.3 - r() * 0.6 }; op.ry = 9; op.brkMul = 1.3; ex.md = 11; ex.vfx = "meteor"; break;
    case "iceball": sel = { ...sel, type: "fb", pw: 0.8 }; ex.vfx = "ice"; ex.weakMul = 0.5; break;
    case "decel": sel = { ...sel, type: "fb", pw: 0.9, ...zone() }; ex.prof = [[0.3, 0.55], [0.8, 0.82]]; ex.vfx = "ice"; break;
    case "icedrop": sel = { ...sel, type: "fk", pw: 0.7 }; op.brkMul = 1.25; ex.vfx = "ice"; break;
    case "freeze": sel = { ...sel, type: "ch", pw: 0.8, ...zone() }; ex.freeze = 2; ex.md = 6; ex.vfx = "ice"; break;
    case "rocket": sel = { ...sel, type: "fb", pw: 1 }; op.spdMul *= 1.1; ex.vfx = "mech"; break;
    case "laser": sel = { ...sel, type: "fb", pw: 1, ...zone() }; op.spdMul *= 1.13; ex.straight = true; ex.md = 10; ex.vfx = "laser"; break;
    case "mbreak": { const t = ["sl", "cu", "fk", "si", "ch"][Math.floor(r() * 5)]; sel = { ...sel, type: t, pw: 0.9 }; op.brkMul = 1.35; op.flipX = r() < 0.5; ex.vfx = "mech"; break; }
    case "multi": sel = { ...sel, type: "fb", pw: 0.8, ...zone() }; ex.multi = 1; ex.md = 7; ex.vfx = "mech"; break;
    case "golden": sel = { ...sel, type: "ch", pw: 0.6, ...zone() }; ex.golden = true; ex.hm = 2.5; ex.stun = 1; ex.vfx = "gold"; break;
    case "teleport": sel = { ...sel, type: "fb", pw: 0.7, ...zone() }; ex.tp = { s: 0.52, dx: round2((r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.5)), dy: round2((r() - 0.5) * 0.8) }; ex.vfx = "magic"; break;
    case "prank": { const t = ["sl", "cu", "si"][Math.floor(r() * 3)]; sel = { ...sel, type: t, pw: 0.7 }; op.flipX = true; op.flipY = t === "cu"; ex.vfx = "magic"; break; }
    case "club": sel = { ...sel, type: "fb", pw: 0.9, ...zone() }; ex.big = true; ex.md = 13; ex.stun = 1; ex.hm = 1.5; ex.vfx = "club"; break;
    case "gravity": sel = { ...sel, type: "cu", pw: 0.8, y: (r() - 0.2) * 1.4 }; op.flipY = true; op.humpMul = -0.6; ex.vfx = "space"; break;
    case "blackhole": sel = { ...sel, type: "sl", pw: 0.8, ...zone() }; op.brkMul = 1.5; op.humpMul = 0; ex.wob = 0.7; ex.md = 9; ex.vfx = "hole"; break;
    case "warp": sel = { ...sel, type: "fb", pw: 0.9, ...zone() }; ex.prof = [[0.45, 0.22], [0.75, 0.55]]; ex.vfx = "space"; break;
    case "clones": sel = { ...sel, type: "fb", pw: 0.8, ...zone() }; m.decoys = 3 + (phase > 2 ? 1 : 0); m.fade = 0.84; ex.shadow = true; ex.md = 8; ex.vfx = "space"; break;
    case "nova": sel = { ...sel, type: "fk", pw: 1, ...zone() }; op.spdMul *= 1.06; m.decoys = 2; m.fade = 0.86; ex.shadow = true; ex.md = 16; ex.vfx = "nova"; break;
    case "stun": sel = { type: "fb", pw: 0, x: (r() - 0.5) * 0.8, y: (r() - 0.5) * 0.8 }; op.spdMul = 0.7; ex.md = 0; break;
  }
  const p = makePitch(id, sel, m, r, op);
  if (ex.prof) { p.prof = ex.prof; }
  if (ex.tp) p.tp = ex.tp;
  if (ex.wob) p.wob = ex.wob;
  if (ex.straight) { p.bx = 0; p.by = 0; p.hump = 0; }
  p.pat = pat; p.md = ex.md; p.hm = ex.hm;
  for (const k of ["fake", "vanish", "golden", "freeze", "multi", "stun", "big", "vfx", "shadow", "radMul", "weakMul"]) if (ex[k] !== undefined) p[k] = ex[k];
  if (p.fake) p.strike = false;
  return p;
}

// ---------- 증강 40종 (정의 — 효과 계산은 서버 bsb-augs.js) ----------
// modes: derby·pvb·mini·raid 중 나오는 곳 · role: bat 타자 / pitch 투수 / field 수비 / support 지원 · kind: passive 지속 / trigger 발동 / active 사용
// max: 겹침 최대 · uses: 사용 횟수 · cd: 재사용(투구 수) · dur: 지속(투구 수) · dm: 모드마다 다른 설명
const ALL = ["derby", "pvb", "mini", "raid"], MATCH = ["pvb", "mini"];
export const AUGS = [
  // 일반 10
  { id: "c_eye", name: "정확한 타격", rarity: "common", icon: "star", role: "bat", kind: "passive", modes: ALL, max: 3, n: { win: 0.12 }, desc: "타이밍 판정 범위 +12% (3번까지 겹침)" },
  { id: "c_power", name: "강한 배트", rarity: "common", icon: "amp", role: "bat", kind: "passive", modes: ALL, max: 3, n: { ev: 6 }, desc: "타구 속도 +6km/h (3번까지 겹침)" },
  { id: "c_quick", name: "빠른 스윙", rarity: "common", icon: "clock", role: "bat", kind: "passive", modes: ALL, max: 2, n: { late: 16 }, desc: "스윙이 0.016초 빨라져 늦은 스윙도 맞아요 (2번까지)" },
  { id: "c_stance", name: "안정된 자세", rarity: "common", icon: "cross", role: "bat", kind: "passive", modes: ALL, max: 2, n: { loss: 0.2, rad2: 0.2 }, desc: "실수 페널티 감소",
    dm: { derby: "헛스윙·아웃이어도 연속 홈런이 끊기지 않고 1만 줄어요", pvb: "2스트라이크 뒤 배트 맞히기 범위 +20%", mini: "2스트라이크 뒤 배트 맞히기 범위 +20%", raid: "놓쳤을 때 방어 게이지 손실 −20%" } },
  { id: "c_combo", name: "콤보 전문가", rarity: "common", icon: "combo", role: "bat", kind: "passive", modes: ALL, max: 2, n: { combo: 0.5, ev: 3 }, desc: "연속 성공 보너스 +50%",
    dm: { pvb: "연속 안타마다 타구 속도 +3 (최대 +9)", mini: "연속 안타마다 타구 속도 +3 (최대 +9)" } },
  { id: "c_heat", name: "강속구", rarity: "common", icon: "double", role: "pitch", kind: "passive", modes: MATCH, max: 2, n: { fb: 6 }, desc: "직구 구속 +6km/h (2번까지)" },
  { id: "c_breaker", name: "변화구 전문가", rarity: "common", icon: "rotate", role: "pitch", kind: "passive", modes: MATCH, max: 2, n: { brk: 0.18 }, desc: "변화구 휘는 양 +18% (2번까지)" },
  { id: "c_focus", name: "집중력", rarity: "common", icon: "eye", role: "bat", kind: "passive", modes: ALL, max: 1, n: { rad: 0.08 }, desc: "공이 도착할 곳을 미리 보여줘요 + 배트 범위 +8%" },
  { id: "c_lucky", name: "행운의 안타", rarity: "common", icon: "clover", role: "bat", kind: "trigger", modes: ALL, max: 2, n: { p: 0.25 }, desc: "약한 타구가 아웃될 때 25%로 바가지 안타",
    dm: { raid: "약하게 맞힌 공의 피해 ×2" } },
  { id: "c_cheer", name: "팀 응원", rarity: "common", icon: "plus", role: "support", kind: "passive", modes: ALL, max: 2, n: { ev: 3, win: 0.05 }, desc: "우리 팀 모두 타구 속도 +3·타이밍 +5% (혼자면 나만)" },
  // 희귀 10
  { id: "r_magnet", name: "자석 배트", rarity: "rare", icon: "magnet", role: "bat", kind: "passive", modes: ALL, max: 2, n: { rad: 0.18 }, desc: "배트에 맞는 범위 +18% (2번까지)" },
  { id: "r_goldbat", name: "황금 배트", rarity: "rare", icon: "gold", role: "bat", kind: "passive", modes: ALL, max: 1, n: { mul: 0.25, dist: 0.04 }, desc: "타격 점수 ×1.25",
    dm: { raid: "타격 피해 ×1.25", pvb: "타구 비거리 +4%", mini: "타구 비거리 +4%" } },
  { id: "r_thunder", name: "번개 스윙", rarity: "rare", icon: "wand", role: "bat", kind: "trigger", modes: ALL, max: 1, n: { ev: 20 }, desc: "퍼펙트 타이밍이면 번개! 타구 속도 +20km/h" },
  { id: "r_clone", name: "분신 마구", rarity: "rare", icon: "dice", role: "pitch", kind: "passive", modes: MATCH, max: 1, n: { decoys: 1 }, desc: "던질 때마다 가짜 공 1개가 같이 날아가요" },
  { id: "r_tornado", name: "회오리 변화구", rarity: "rare", icon: "swap", role: "pitch", kind: "passive", modes: MATCH, max: 1, n: { wob: 0.35 }, desc: "변화구가 끝에서 반대로 한 번 더 꺾여요" },
  { id: "r_fireball", name: "불꽃 강속구", rarity: "rare", icon: "burst", role: "pitch", kind: "passive", modes: MATCH, max: 1, n: { fb: 8, win: 0.12 }, desc: "직구 구속 +8km/h, 직구 상대 타자 타이밍 범위 −12%" },
  { id: "r_hrboom", name: "홈런 폭발", rarity: "rare", icon: "bomb", role: "bat", kind: "trigger", modes: ALL, max: 1, n: { pts: 300, dmg: 0.6, dist: 0.06, ev: 10 }, desc: "홈런 보너스",
    dm: { derby: "홈런마다 +300점", raid: "홈런 피해 +60%", pvb: "뜬공 비거리 +6%", mini: "홈런을 치면 다음 타석 타구 속도 +10" } },
  { id: "r_ghost", name: "유령 주자", rarity: "rare", icon: "eraser", role: "bat", kind: "trigger", modes: MATCH, max: 1, n: {}, desc: "이닝마다 한 번, 안타 때 주자들이 한 베이스 더 가요" },
  { id: "r_wall", name: "철벽 수비", rarity: "rare", icon: "shield", role: "field", kind: "passive", modes: MATCH, max: 1, n: { spd: 0.15, react: 0.08 }, desc: "우리 수비수 발 +15%, 반응 0.08초 빠르게" },
  { id: "r_heal", name: "회복의 타격", rarity: "rare", icon: "plus", role: "support", kind: "trigger", modes: ["raid"], max: 2, n: { good: 2, perfect: 4 }, desc: "좋은 타격마다 팀 방어 게이지 +2 (퍼펙트 +4)" },
  // 영웅 10
  { id: "e_meteor", name: "메테오 홈런", rarity: "epic", icon: "burst", role: "bat", kind: "trigger", modes: ALL, max: 1, n: { ev: 162, pts: 800, dmg: 1 }, desc: "타구 속도 162km/h 넘는 홈런은 메테오!",
    dm: { derby: "메테오 홈런 +800점", raid: "메테오 홈런 피해 ×2", pvb: "메테오 홈런 +1점 (이닝마다 한 번)", mini: "메테오 홈런 +1점 (이닝마다 한 번)" } },
  { id: "e_warp", name: "시간 왜곡", rarity: "epic", icon: "hourglass", role: "bat", kind: "active", modes: ALL, max: 1, uses: 2, cd: 6, dur: 4, n: { win: 0.6 }, desc: "사용: 다음 4구 동안 타이밍 범위 +60% (2번, 재사용 6구)" },
  { id: "e_triple", name: "삼중 타격", rarity: "epic", icon: "line", role: "bat", kind: "trigger", modes: ALL, max: 1, n: { pts: 300 }, desc: "3번 연속 맞히면 추가 공격",
    dm: { derby: "3연속 안타마다 +300점", raid: "3연속 타격마다 그 타격 피해 ×3", pvb: "3연속 안타면 주자 한 베이스 더", mini: "3연속 안타면 주자 한 베이스 더" } },
  { id: "e_storm", name: "폭풍 투구", rarity: "epic", icon: "rotate", role: "pitch", kind: "passive", modes: MATCH, max: 1, n: { brk: 0.4, spd: 4 }, desc: "변화구 휘는 양 +40%, 모든 공 +4km/h" },
  { id: "e_goldball", name: "황금 야구공", rarity: "epic", icon: "gold", role: "bat", kind: "trigger", modes: ["derby", "raid"], max: 1, n: { every: 5 }, desc: "5구마다 황금 공 (맞히면 점수·피해 ×3)" },
  { id: "e_perfectd", name: "완벽한 수비", rarity: "epic", icon: "shield", role: "field", kind: "passive", modes: MATCH, max: 1, n: { catchR: 0.35 }, desc: "수비 잡는 범위 +35%, 펜스를 살짝 넘는 홈런도 잡아요 (이닝마다 한 번)" },
  { id: "e_teamhr", name: "팀 합동 홈런", rarity: "epic", icon: "double", role: "support", kind: "trigger", modes: ["mini", "raid"], max: 1, n: { ev: 6, joint: 0.4 }, desc: "팀원이 이어서 치면 강해져요",
    dm: { mini: "팀원이 연속 안타를 치면 다음 타자 타구 속도 +6 (최대 +18)", raid: "합동 공격 피해 +40%" } },
  { id: "e_explode", name: "폭발 변화구", rarity: "epic", icon: "bomb", role: "pitch", kind: "passive", modes: MATCH, max: 1, n: { rad: 0.15 }, desc: "변화구가 끝에서 둘로 터져요 (가짜 1개) + 타자 배트 범위 −15%" },
  { id: "e_undying", name: "불사의 타자", rarity: "epic", icon: "phoenix", role: "support", kind: "trigger", modes: ["raid"], max: 1, n: {}, desc: "페이즈마다 한 번, 내 실수로 방어 게이지가 줄지 않아요" },
  { id: "e_comeback", name: "운명의 역전", rarity: "epic", icon: "swap", role: "bat", kind: "passive", modes: ALL, max: 1, n: { win: 0.25, ev: 8 }, desc: "불리할 때 타이밍 +25%·타구 속도 +8",
    dm: { derby: "순위가 아래쪽 절반이거나 마지막 30초면 타이밍 +25%·타구 속도 +8", pvb: "지고 있을 때 타이밍 +25%·타구 속도 +8", mini: "우리 팀이 지고 있을 때 타이밍 +25%·타구 속도 +8", raid: "방어 게이지가 40 아래일 때 타이밍 +25%·타구 속도 +8" } },
  // 전설 10
  { id: "l_god", name: "야구의 신", rarity: "legendary", icon: "crown", role: "bat", kind: "passive", modes: ALL, max: 1, n: { win: 0.25, rad: 0.2, ev: 10 }, desc: "타이밍 +25%, 배트 범위 +20%, 타구 속도 +10" },
  { id: "l_absolute", name: "절대 홈런", rarity: "legendary", icon: "star", role: "bat", kind: "trigger", modes: ALL, max: 1, cd: 5, n: {}, desc: "퍼펙트 타이밍 + 공 한가운데를 맞히면 무조건 홈런 (5구에 한 번)",
    dm: { pvb: "퍼펙트 타이밍 + 공 한가운데를 맞히면 무조건 홈런 (이닝마다 한 번)", mini: "퍼펙트 타이밍 + 공 한가운데를 맞히면 무조건 홈런 (이닝마다 한 번)" } },
  { id: "l_heaven", name: "천상의 마구", rarity: "legendary", icon: "sparkle", role: "pitch", kind: "active", modes: MATCH, max: 1, n: {}, desc: "타자마다 한 번 '천상의 마구'(S자로 두 번 꺾이는 빠른 공)를 던질 수 있어요" },
  { id: "l_rewind", name: "시간 역행", rarity: "legendary", icon: "rewind", role: "bat", kind: "active", modes: ALL, max: 1, uses: 1, n: {}, desc: "한 번: 방금 아웃·헛스윙을 없던 일로 하고 다시 쳐요",
    dm: { raid: "한 번: 방금 줄어든 방어 게이지를 되돌려요" } },
  { id: "l_frenzy", name: "황금 폭주", rarity: "legendary", icon: "gold", role: "bat", kind: "active", modes: ALL, max: 1, uses: 1, dur: 6, n: { mul: 1, ev: 12 }, desc: "한 번: 6구 동안 점수 ×2",
    dm: { raid: "한 번: 6구 동안 피해 ×2", pvb: "한 번: 6구 동안 타구 속도 +12", mini: "한 번: 6구 동안 타구 속도 +12" } },
  { id: "l_infinite", name: "무한 스윙", rarity: "legendary", icon: "clock", role: "bat", kind: "active", modes: ALL, max: 1, uses: 1, dur: 8, n: {}, desc: "한 번: 8구 동안 헛스윙해도 손해가 없어요",
    dm: { pvb: "한 번: 8구 동안 헛스윙이 스트라이크가 안 돼요", mini: "한 번: 8구 동안 헛스윙이 스트라이크가 안 돼요", raid: "한 번: 8구 동안 놓쳐도 방어 게이지가 안 줄어요" } },
  { id: "l_dragon", name: "드래곤 배트", rarity: "legendary", icon: "burst", role: "bat", kind: "passive", modes: ALL, max: 1, n: { ev: 12, dist: 0.08, dmg: 0.5 }, desc: "타구 속도 +12, 비거리 +8%",
    dm: { raid: "타구 속도 +12, 홈런 피해 ×1.5" } },
  { id: "l_dimension", name: "차원 변화구", rarity: "legendary", icon: "wand", role: "pitch", kind: "trigger", modes: MATCH, max: 1, n: {}, desc: "타자마다 한 번, 공이 도착 직전 순간이동해요" },
  { id: "l_miracle", name: "최후의 기적", rarity: "legendary", icon: "phoenix", role: "support", kind: "trigger", modes: ALL, max: 1, n: { gauge: 35, mul: 0.3 }, desc: "패배 직전에 한 번 살아나요",
    dm: { raid: "방어 게이지가 0이 될 때 한 번 35로 살아나요", pvb: "지고 있는 마지막 아웃을 한 번 없애요 (타자 1루로)", mini: "지고 있는 마지막 아웃을 한 번 없애요 (타자 1루로)", derby: "마지막 15초에 순위가 아래쪽 절반이면 점수 ×1.3" } },
  { id: "l_master", name: "베이스볼 마스터", rarity: "legendary", icon: "crown", role: "support", kind: "passive", modes: ALL, max: 1, n: { win: 0.1, ev: 6, brk: 0.15, spd: 3, fspd: 0.1, gauge: 1 }, desc: "타격(타이밍 +10%·타구 +6)·투구(변화 +15%·+3km/h)·수비(+10%)·지원(레이드 타격마다 게이지 +1)" },
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
export const RARITY = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" };
export const ROLE_LABEL = { bat: "타자", pitch: "투수", field: "수비", support: "지원" };
export const KIND_LABEL = { passive: "지속형", trigger: "발동형", active: "사용형" };
export const SYNERGY = {
  bat: { icon: "🏏", name: "타격 시너지", t2: "타구 속도 +3", t3: "타이밍 범위 +8%" },
  pitch: { icon: "⚾", name: "투구 시너지", t2: "구속 +2km/h", t3: "변화 +12%" },
  field: { icon: "🧤", name: "수비 시너지", t2: "수비 반응 0.05초 빠르게", t3: "" },
  support: { icon: "📣", name: "지원 시너지", t2: "레이드 방어 게이지 손실 −10%", t3: "합동 공격 +15%" },
};
export const augDesc = (a, mode) => (a.dm && a.dm[mode]) || a.desc;
export const MODE_NAME = { derby: "홈런더비", pvb: "투수 VS 타자", mini: "미니 야구", raid: "야구 보스 레이드" };
export const MODE_MAX = { derby: 50, pvb: 2, mini: 8, raid: 8 };
export const MODE_MIN = { derby: 1, pvb: 1, mini: 1, raid: 1 }; // 투수VS타자·미니야구 혼자면 AI 상대
