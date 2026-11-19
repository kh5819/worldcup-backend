// =========================
// DUO 플듀 베이스볼 — 증강 효과 (서버 전용, 2026-11-19)
// · 카드 정의는 bsb-core.js AUGS, 여기서는 효과 계산만
// · 지속형: batMods/pitchMods/fieldMods 가 매 투구 계산 · 발동형: afterContact/afterOutcome 에서 확인 · 사용형: useAug
// · 무한 방지: 배율 상한(점수·피해 ×6), 타구 속도 상한 185, 타이밍 배율 상한 ×2.2, 배트 범위 상한 ×1.7, 사용형은 횟수·재사용 확인
// =========================
import { AUGS, AUG, MAX_AUGS } from "./bsb-core.js";

export const CAP = { win: 2.2, rad: 1.7, ev: 185, mul: 6, dmg: 6 };
const W = { common: 55, rare: 30, epic: 12, legendary: 4 };

export const st = (P, id) => P.augs.find(a => a.id === id)?.st || 0;
export const has = (P, id) => P.augs.some(a => a.id === id);
const aug = (P, id) => P.augs.find(a => a.id === id);

export function newAugHolder() { return { augs: [], buf: {}, pn: 0, offer: null, offerUntil: 0, picks: 0, used: {} }; }

/** 이 모드에서 고를 수 있는 카드 (겹침 최대·모드 아닌 카드·전설(첫 고르기) 제외) */
export function poolFor(P, mode, o = {}) {
  return AUGS.filter(a => a.modes.includes(mode) && st(P, a.id) < (a.max || 1) && (a.rarity !== "legendary" || o.legendOk) && !(o.exclude || []).includes(a.id));
}
export function rollOffer(P, mode, r, o = {}) {
  if (P.augs.length >= MAX_AUGS && !P.augs.some(a => st(P, a.id) < (AUG[a.id].max || 1))) return null;
  let pool = poolFor(P, mode, o);
  if (P.augs.length >= MAX_AUGS) pool = pool.filter(a => has(P, a.id));    // 5개면 이미 있는 카드 겹치기만
  const out = [];
  for (let k = 0; k < 3 && pool.length; k++) {
    let tot = 0; for (const a of pool) tot += W[a.rarity];
    let x = r() * tot, pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { x -= W[pool[i].rarity]; if (x <= 0) { pick = i; break; } }
    out.push(pool[pick].id); pool.splice(pick, 1);
  }
  return out.length ? out : null;
}
export function addAug(P, id) {
  const d = AUG[id]; if (!d) return false;
  const a = aug(P, id);
  if (a) { if (a.st >= (d.max || 1)) return false; a.st++; if (d.uses) a.ch += d.uses; return true; }
  if (P.augs.length >= MAX_AUGS) return false;
  P.augs.push({ id, st: 1, ch: d.uses ?? null, cd: 0 }); return true;
}
/** 시너지: 같은 역할 카드 수 */
export function synergy(P) { const c = { bat: 0, pitch: 0, field: 0, support: 0 }; for (const a of P.augs) c[AUG[a.id].role]++; return c; }

/**
 * 타격 능력. ctx = { mode, team:[같은 팀 P...], trailing, gaugeLow, bottomHalf, last30, twoStrikes, streak, teamStreak, pitch, pm(투수 능력) }
 */
export function batMods(P, ctx = {}) {
  const m = { win: 1, rad: 1, late: 0, ev: 0, la: 0, dist: 1, mul: 1, predict: false, evCap: CAP.ev };
  const s = (id) => st(P, id), n = (id) => AUG[id].n, mode = ctx.mode;
  m.win += s("c_eye") * n("c_eye").win;
  m.ev += s("c_power") * n("c_power").ev;
  m.late += s("c_quick") * n("c_quick").late;
  if (s("c_stance") && ctx.twoStrikes && (mode === "pvb" || mode === "mini")) m.rad += 0.2 * s("c_stance");
  if (s("c_combo") && (mode === "pvb" || mode === "mini")) m.ev += Math.min(9, 3 * (ctx.streak || 0)) * s("c_combo");
  if (s("c_focus")) { m.predict = true; m.rad += n("c_focus").rad; }
  // 팀 응원: 같은 팀 누군가(나 포함)가 가지고 있으면 (혼자면 나만)
  const cheer = (ctx.team && ctx.team.length ? ctx.team : [P]).reduce((t, q) => t + st(q, "c_cheer"), 0);
  if (cheer) { m.ev += 3 * Math.min(2, cheer); m.win += 0.05 * Math.min(2, cheer); }
  m.rad += s("r_magnet") * n("r_magnet").rad;
  if (s("r_goldbat")) { if (mode === "derby" || mode === "raid") m.mul *= 1.25; else m.dist *= 1.04; }
  if (s("r_hrboom") && mode === "pvb") m.dist *= 1.06;
  if (s("r_hrboom") && mode === "mini" && P.buf.hrNext) m.ev += 10;
  if (ctx.teamStreak && mode === "mini") { const th = (ctx.team || [P]).some(q => has(q, "e_teamhr")); if (th) m.ev += Math.min(18, 6 * ctx.teamStreak); }
  if (s("e_comeback")) { const bad = mode === "raid" ? ctx.gaugeLow : mode === "derby" ? (ctx.bottomHalf || ctx.last30) : ctx.trailing; if (bad) { m.win += 0.25; m.ev += 8; } }
  if (s("l_god")) { m.win += 0.25; m.rad += 0.2; m.ev += 10; }
  if (s("l_dragon")) { m.ev += 12; if (mode !== "raid") m.dist *= 1.08; }
  if (s("l_master")) { m.win += 0.1; m.ev += 6; }
  const syn = synergy(P); if (syn.bat >= 2) m.ev += 3; if (syn.bat >= 3) m.win += 0.08;
  // 사용형 지속 효과
  if (P.buf.warp > 0) m.win += 0.6;
  if (P.buf.frenzy > 0) { if (mode === "derby" || mode === "raid") m.mul *= 2; else m.ev += 12; }
  if (P.buf.donBuff > 0) { m.ev += 10; m.win += 0.2; }
  if (P.buf.donDebuff > 0) m.win -= 0.2;
  if (P.frozen > 0) m.win *= 0.7;
  // 투수 쪽 능력 (불꽃 강속구·폭발 변화구)
  const pm = ctx.pm || {}; if (pm.fbWin && ctx.pitch?.type === "fb") m.win -= pm.fbWin; if (pm.radDown && ctx.pitch && ctx.pitch.type !== "fb") m.rad -= pm.radDown;
  if (ctx.pitch?.radMul) m.rad *= ctx.pitch.radMul;
  m.win = Math.max(0.5, Math.min(CAP.win, m.win)); m.rad = Math.max(0.6, Math.min(CAP.rad, m.rad)); m.mul = Math.min(CAP.mul, m.mul);
  return m;
}
/** 투구 능력 → makePitch 의 m */
export function pitchMods(P, ctx = {}) {
  const m = { spd: 0, fbSpd: 0, brk: 1, wobble: 0, decoys: 0, fade: 0.72, fbWin: 0, radDown: 0 };
  const s = (id) => st(P, id);
  m.fbSpd += 6 * s("c_heat"); m.brk += 0.18 * s("c_breaker");
  if (s("r_clone")) m.decoys += 1;
  if (s("r_tornado")) m.wobble = 0.35;
  if (s("r_fireball")) { m.fbSpd += 8; m.fbWin = 0.12; }
  if (s("e_storm")) { m.brk += 0.4; m.spd += 4; }
  if (s("e_explode") && ctx.type && ctx.type !== "fb") { m.decoys += 1; m.fade = 0.86; m.radDown = 0.15; }
  if (s("l_master")) { m.brk += 0.15; m.spd += 3; }
  const syn = synergy(P); if (syn.pitch >= 2) m.spd += 2; if (syn.pitch >= 3) m.brk += 0.12;
  if (P.buf.donDebuff > 0) m.brk -= 0.15;
  m.brk = Math.min(2.2, m.brk); m.fbSpd = Math.min(16, m.fbSpd);
  return m;
}
/** 수비 능력 (수비 팀 전체 증강) */
export function fieldMods(team, usedRob = false) {
  const D = { spd: 1, react: 0, catchR: 1, rob: false };
  for (const P of team) {
    if (has(P, "r_wall")) { D.spd += 0.15; D.react += 0.08; }
    if (has(P, "e_perfectd")) { D.catchR += 0.35; if (!usedRob) D.rob = true; }
    if (has(P, "l_master")) D.spd += 0.1;
    if (synergy(P).field >= 2) D.react += 0.05;
  }
  D.spd = Math.min(1.5, D.spd); D.react = Math.min(0.25, D.react); D.catchR = Math.min(1.8, D.catchR);
  return D;
}
/** 맞은 직후 (발사 전): 번개 스윙·절대 홈런 */
export function afterContact(P, ctx, j, L) {
  const fx = [];
  if (has(P, "r_thunder") && j.grade === "perfect") { L.ev = Math.min(CAP.ev, L.ev + 20); fx.push("thunder"); }
  const ab = aug(P, "l_absolute");
  if (ab && j.grade === "perfect" && j.d <= 0.16 && !L.foul) {
    const ready = (ctx.mode === "pvb" || ctx.mode === "mini") ? !P.used.absInning : P.pn >= (ab.cd || 0);
    if (ready) { L.ev = Math.max(L.ev, 174); L.la = 29; L.sp = Math.max(-18, Math.min(18, L.sp)); L.forceHr = true; fx.push("absolute"); if (ctx.mode === "pvb" || ctx.mode === "mini") P.used.absInning = true; else ab.cd = P.pn + 5; }
  }
  return fx;
}
/** 행운의 안타: 약하게 맞힌 아웃 → 단타 */
export function luckyHit(P, j, kind, r) { const s = st(P, "c_lucky"); return s && (j.grade === "weak" || j.grade === "fair") && /out$/.test(kind) && r() < 0.25 * s; }
export const isMeteor = (P, L, kind) => has(P, "e_meteor") && (kind === "hr") && L.ev >= 162;

/** 사용형 증강 쓰기 → { ok, error, eff } (시간 역행은 모드가 되돌릴 수 있는지 먼저 확인) */
export function useAug(P, id, o = {}) {
  const d = AUG[id], a = aug(P, id);
  if (!d || !a) return { ok: false, error: "NO_AUG" };
  if (d.kind !== "active" || id === "l_heaven") return { ok: false, error: "NOT_ACTIVE" };
  if (a.ch !== null && a.ch <= 0) return { ok: false, error: "NO_CHARGES" };
  if (a.cd && P.pn < a.cd) return { ok: false, error: "COOLDOWN" };
  if (id === "e_warp") { if (P.buf.warp > 0) return { ok: false, error: "ALREADY" }; P.buf.warp = d.dur; a.cd = P.pn + d.cd; }
  else if (id === "l_frenzy") P.buf.frenzy = d.dur;
  else if (id === "l_infinite") P.buf.inf = d.dur;
  else if (id === "l_rewind") { if (!o.canRewind) return { ok: false, error: "CANT_REWIND" }; }
  if (a.ch !== null) a.ch--;
  return { ok: true, eff: id };
}
/** 공 하나 지나갈 때마다 (내가 타자로 상대한 공) */
export function passPitch(P) {
  P.pn++;
  for (const k of ["warp", "frenzy", "inf", "donBuff", "donDebuff"]) if (P.buf[k] > 0) P.buf[k]--;
}
/** 화면용 보유 증강 */
export const augView = (P) => P.augs.map(a => ({ id: a.id, st: a.st, ch: a.ch, cd: a.cd && a.cd > P.pn ? a.cd - P.pn : 0 }));
export const bufView = (P) => { const o = {}; for (const k in P.buf) if (P.buf[k]) o[k] = P.buf[k]; return o; };
