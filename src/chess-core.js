// =========================
// 플듀 증강 체스 — 체스 규칙 엔진 (2026-11-16)
// · 칸 번호 sq = rank*8 + file (rank 0 = 백의 1랭크, file 0 = a)
// · 상태는 매 수 새로 만듦(되돌리기·AI 탐색용). 증강은 mods(색별 이동 보너스)·말 상태(보호막 sh·무적 inv·얼림 frz·퀸 이동 qm)로만 끼어듦
// · 기본 체스는 mods 없이 완전한 표준 규칙 (perft 검증: chess-test.mjs)
// =========================
export const W = "w", B = "b";
export const opp = (c) => (c === W ? B : W);
export const fileOf = (s) => s & 7, rankOf = (s) => s >> 3;
export const sqName = (s) => "abcdefgh"[s & 7] + ((s >> 3) + 1);
export const nameSq = (n) => (n.charCodeAt(0) - 97) + (Number(n[1]) - 1) * 8;
export const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const N_OFF = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const CAMEL = [[1, 3], [3, 1], [3, -1], [1, -3], [-1, -3], [-3, -1], [-3, 1], [-1, 3]];
const K_OFF = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

let PID = 0;
export function mkPiece(t, c, extra) { return { id: c + t + (++PID), t, c, ...extra }; }
export function initialState() {
  const b = Array(64).fill(null);
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let f = 0; f < 8; f++) {
    b[f] = mkPiece(back[f], W, { home: f }); b[8 + f] = mkPiece("p", W, { home: 8 + f });
    b[48 + f] = mkPiece("p", B, { home: 48 + f }); b[56 + f] = mkPiece(back[f], B, { home: 56 + f });
  }
  return { b, turn: W, castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, half: 0, full: 1, ply: 0, lost: { w: [], b: [] }, traps: [] };
}
/** FEN 읽기 (시험용) */
export function fromFen(fen) {
  const [pos, turn, cas, ep, half, full] = fen.trim().split(/\s+/);
  const b = Array(64).fill(null);
  pos.split("/").forEach((row, i) => { let f = 0; const r = 7 - i; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { const c = ch === ch.toUpperCase() ? W : B; b[r * 8 + f] = mkPiece(ch.toLowerCase(), c); f++; } } });
  return { b, turn: turn || W, castle: { wK: cas?.includes("K"), wQ: cas?.includes("Q"), bK: cas?.includes("k"), bQ: cas?.includes("q") }, ep: ep && ep !== "-" ? nameSq(ep) : null, half: +half || 0, full: +full || 1, ply: 0, lost: { w: [], b: [] }, traps: [] };
}
export function toFen(S) {
  let out = "";
  for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = S.b[r * 8 + f]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } out += p.c === W ? p.t.toUpperCase() : p.t; } if (e) out += e; if (r) out += "/"; }
  const cas = (S.castle.wK ? "K" : "") + (S.castle.wQ ? "Q" : "") + (S.castle.bK ? "k" : "") + (S.castle.bQ ? "q" : "") || "-";
  return `${out} ${S.turn} ${cas} ${S.ep !== null ? sqName(S.ep) : "-"} ${S.half} ${S.full}`;
}
export function clonePiece(p) { return p ? { ...p } : null; }
export function cloneState(S) { return { ...S, b: S.b.map(clonePiece), castle: { ...S.castle }, lost: { w: S.lost.w.slice(), b: S.lost.b.slice() }, traps: S.traps.map(t => ({ ...t })) }; }
export const kingSq = (S, c) => S.b.findIndex(p => p && p.t === "k" && p.c === c);
const frozen = (S, p) => p.frz && p.frz > S.ply;
const invuln = (S, p) => p.inv && p.inv > S.ply;
const hasQm = (S, p) => p.qm && p.qm > S.ply;

/** sq 가 by 편에게 공격받나 (킹 안전 판정용; 얼린 말은 공격 못 함)
 *  밸런스: 증강 점프(룩 점프·비숍 도약·낙타·왕의 분노)는 킹을 공격하지 않음 = 점프로는 체크를 못 걸고, 킹이 그 칸으로 가는 것도 막지 않음 */
export function attacked(S, sq, by, mods = {}) {
  const m = mods[by] || {};
  const f0 = fileOf(sq), r0 = rankOf(sq), b = S.b;
  const isA = (p, ...ts) => p && p.c === by && ts.includes(p.t) && !frozen(S, p);
  // 폰
  const pr = by === W ? r0 - 1 : r0 + 1;
  for (const df of [-1, 1]) if (on(f0 + df, pr) && isA(b[pr * 8 + f0 + df], "p")) return true;
  // 나이트 (+킹의 분노)
  for (const [df, dr] of N_OFF) { if (!on(f0 + df, r0 + dr)) continue; if (isA(b[(r0 + dr) * 8 + f0 + df], "n")) return true; }
  // 킹
  for (const [df, dr] of K_OFF) if (on(f0 + df, r0 + dr) && isA(b[(r0 + dr) * 8 + f0 + df], "k")) return true;
  // 슬라이드 (+퀸 이동 상태, 룩 점프·비숍 도약은 막는 말 하나 건너뜀)
  const ray = (dirs, types, jumpType) => {
    for (const [df, dr] of dirs) {
      let f = f0 + df, r = r0 + dr, jumped = false;
      while (on(f, r)) {
        const p = b[r * 8 + f];
        if (p) {
          if (p.c === by && !frozen(S, p) && (types.includes(p.t) || hasQm(S, p)) && (!jumped || p.t === jumpType)) return true;
          if (jumpType && !jumped && p.t !== "k") { jumped = true; f += df; r += dr; continue; }
          break;
        }
        f += df; r += dr;
      }
    }
    return false;
  };
  if (ray(ORTHO, ["r", "q"], null)) return true;
  if (ray(DIAG, ["b", "q"], null)) return true;
  void m;
  return false;
}
export const inCheck = (S, c, mods) => { const k = kingSq(S, c); return k >= 0 && attacked(S, k, opp(c), mods); };

/**
 * 의사 합법 수 (킹 안전 검사 전)
 * move: { from, to, promo?, cap?(잡는 칸), castle?, ep?, dbl?, block?(보호막 깨기: 공격자는 제자리), aug?(쓴 이동 증강 id) }
 */
export function pseudoMoves(S, c, mods = {}) {
  const m = mods[c] || {}, b = S.b, out = [];
  const trapFor = (sq) => S.traps.some(t => t.sq === sq && t.owner !== c && t.until > S.ply);
  const promoRank = c === W ? 7 : 0, fastRank = c === W ? 6 : 1;
  const pushPawn = (from, to, extra = {}) => {
    const r = rankOf(to);
    if (r === promoRank || (m.fastPromo && r === fastRank)) for (const pr of ["q", "r", "b", "n"]) out.push({ from, to, promo: pr, ...extra });
    else out.push({ from, to, ...extra });
  };
  const target = (to) => { const q = b[to]; if (!q) return "empty"; if (q.c === c) return "own"; if (q.t === "k") return "king"; if (invuln(S, q)) return "inv"; return "enemy"; };
  const capMove = (from, to, extra = {}) => { const q = b[to]; if (q.sh > 0) out.push({ from, to, block: true, cap: to, ...extra }); else out.push({ from, to, cap: to, ...extra }); };
  let pawns = 0; for (const p of b) if (p && p.c === c && p.t === "p") pawns++;
  for (let s = 0; s < 64; s++) {
    const p = b[s]; if (!p || p.c !== c || frozen(S, p)) continue;
    const f = fileOf(s), r = rankOf(s);
    if (p.t === "p") {
      const dir = c === W ? 1 : -1, start = c === W ? 1 : 6;
      const one = s + dir * 8;
      if (on(f, r + dir) && !b[one]) {
        if (rankOf(one) === promoRank || (m.fastPromo && rankOf(one) === fastRank)) pushPawn(s, one); else out.push({ from: s, to: one });
        const two = s + dir * 16;
        const dblOk = r === start || (m.assaultPawn && r === start + dir) || (m.lastPawn && pawns <= 2);
        if (dblOk && on(f, r + 2 * dir) && !b[two]) { const ex = r === start ? {} : { aug: m.assaultPawn && r === start + dir ? "assaultPawn" : "lastPawn" }; if (rankOf(two) === promoRank || (m.fastPromo && rankOf(two) === fastRank)) pushPawn(s, two, { dbl: true, ...ex }); else out.push({ from: s, to: two, dbl: true, ...ex }); }
      }
      for (const df of [-1, 1]) {
        if (!on(f + df, r + dir)) continue;
        const to = s + dir * 8 + df, tg = target(to);
        if (tg === "enemy") { if (b[to].sh > 0) out.push({ from: s, to, block: true, cap: to }); else pushPawn(s, to, { cap: to }); }
        else if (tg === "empty" && S.ep === to) { const cs = to - dir * 8; if (b[cs] && b[cs].c !== c && b[cs].t === "p") out.push({ from: s, to, ep: true, cap: cs }); }
        else if (tg === "empty" && m.pawnLegion) pushPawn(s, to, { aug: "pawnLegion" });
      }
      continue;
    }
    const steps = (offs, extra = {}, quietOnly = false) => { for (const [df, dr] of offs) { if (!on(f + df, r + dr)) continue; const to = (r + dr) * 8 + f + df, tg = target(to); if (tg === "empty") out.push({ from: s, to, ...extra }); else if (tg === "enemy" && !quietOnly) capMove(s, to, extra); } };
    const slide = (dirs, jumpAug) => {
      for (const [df, dr] of dirs) {
        let ff = f + df, rr = r + dr, jumped = false;
        while (on(ff, rr)) {
          const to = rr * 8 + ff, tg = target(to);
          const ex = jumped ? { aug: jumpAug } : {};
          if (tg === "empty") out.push({ from: s, to, ...ex });
          else { if (tg === "enemy") capMove(s, to, ex); if (jumpAug && !jumped && tg !== "king") { jumped = true; ff += df; rr += dr; continue; } break; }
          ff += df; rr += dr;
        }
      }
    };
    const qm = hasQm(S, p);
    if (p.t === "n") { steps(N_OFF); if (m.camel) steps(CAMEL, { aug: "knightBoost" }); if (qm) { slide(ORTHO); slide(DIAG); } }
    else if (p.t === "b") { slide(DIAG, m.bishopLeap ? "bishopLeap" : null); if (m.bishopBless) steps(ORTHO, { aug: "bishopBless" }, true); if (qm) slide(ORTHO); }
    else if (p.t === "r") { slide(ORTHO, m.rookJump ? "rookJump" : null); if (qm) slide(DIAG); }
    else if (p.t === "q") { slide(ORTHO); slide(DIAG); }
    else if (p.t === "k") {
      steps(K_OFF);
      if (m.kingKnight) steps(N_OFF, { aug: "kingWrath" });
      // 캐슬링
      const home = c === W ? 4 : 60;
      if (s === home && !inCheck(S, c, mods)) {
        const ks = c === W ? "wK" : "bK", qs = c === W ? "wQ" : "bQ";
        const rk = b[home + 3], rq = b[home - 4];
        if (S.castle[ks] && rk && rk.t === "r" && rk.c === c && !b[home + 1] && !b[home + 2] && !attacked(S, home + 1, opp(c), mods) && !attacked(S, home + 2, opp(c), mods)) out.push({ from: s, to: home + 2, castle: "K" });
        if (S.castle[qs] && rq && rq.t === "r" && rq.c === c && !b[home - 1] && !b[home - 2] && !b[home - 3] && !attacked(S, home - 1, opp(c), mods) && !attacked(S, home - 2, opp(c), mods)) out.push({ from: s, to: home - 2, castle: "Q" });
      }
    }
  }
  // 함정 칸 표시 (이동은 되지만 밟으면 얼어붙음)
  for (const mv of out) if (!mv.block && trapFor(mv.to)) mv.trap = true;
  return out;
}

/** 수 두기 → 새 상태 (차례 넘김). hooks.onCapture(S, piece) 로 증강 층이 끼어듦 */
export function applyMove(S0, mv, hooks = {}) {
  const S = cloneState(S0), b = S.b, p = b[mv.from], c = p.c;
  let capture = null, reset = p.t === "p";
  S.ep = null;
  if (mv.block) {
    // 보호막: 공격자는 제자리, 보호막만 깨짐
    const q = b[mv.to]; q.sh = (q.sh || 0) - 1; reset = true;
  } else if (mv.castle) {
    b[mv.to] = p; b[mv.from] = null;
    const home = c === W ? 4 : 60;
    if (mv.castle === "K") { b[home + 1] = b[home + 3]; b[home + 3] = null; } else { b[home - 1] = b[home - 4]; b[home - 4] = null; }
  } else {
    if (mv.cap !== undefined) { capture = b[mv.cap]; b[mv.cap] = null; reset = true; }
    b[mv.to] = p; b[mv.from] = null;
    if (mv.promo) { b[mv.to] = { ...p, t: mv.promo, promoted: true }; }
    if (mv.dbl) S.ep = (mv.from + mv.to) >> 1;
    if (mv.trap) { b[mv.to].frz = S.ply + 4; S.traps = S.traps.filter(t => t.sq !== mv.to); S.trapHit = { sq: mv.to, piece: b[mv.to].id }; }
  }
  if (capture) { S.lost[capture.c].push({ t: capture.promoted ? "p" : capture.t, id: capture.id }); hooks.onCapture?.(S, capture, p); }
  // 캐슬링 권리
  const touch = (sq) => { if (sq === 4) { S.castle.wK = S.castle.wQ = false; } if (sq === 60) { S.castle.bK = S.castle.bQ = false; } if (sq === 0) S.castle.wQ = false; if (sq === 7) S.castle.wK = false; if (sq === 56) S.castle.bQ = false; if (sq === 63) S.castle.bK = false; };
  if (!mv.block) { touch(mv.from); touch(mv.to); }
  S.half = reset ? 0 : S.half + 1;
  if (c === B) S.full++;
  S.turn = opp(c); S.ply++;
  return S;
}

/** 합법 수 (자기 킹이 체크로 남지 않는 수) */
export function legalMoves(S, c = S.turn, mods = {}) {
  return pseudoMoves(S, c, mods).filter(mv => !inCheck(applyMove(S, mv), c, mods));
}

/** 기물 부족 무승부 */
export function insufficient(S) {
  const ps = S.b.map((p, s) => p && { ...p, s }).filter(p => p && p.t !== "k");
  if (!ps.length) return true;
  if (ps.some(p => ["p", "r", "q"].includes(p.t))) return false;
  if (ps.length === 1) return true; // 킹+나이트/비숍 대 킹
  if (ps.every(p => p.t === "b")) { const col = (s) => (fileOf(s) + rankOf(s)) & 1; return ps.every(p => col(p.s) === col(ps[0].s)); }
  return false;
}
/** 반복 판정용 열쇠 (위치 + 차례 + 캐슬링 + 잡을 수 있는 앙파상 + 말 상태) */
export function posKey(S, extra = "") {
  let k = "";
  for (let s = 0; s < 64; s++) { const p = S.b[s]; k += p ? (p.c === W ? p.t.toUpperCase() : p.t) + (p.sh ? "s" + p.sh : "") + (p.inv > S.ply ? "i" + (p.inv - S.ply) : "") + (p.frz > S.ply ? "f" + (p.frz - S.ply) : "") + (p.qm > S.ply ? "q" + (p.qm - S.ply) : "") : "."; }
  let ep = "-";
  if (S.ep !== null) { const dir = S.turn === W ? -8 : 8; const f = fileOf(S.ep); for (const df of [-1, 1]) { const s = S.ep + dir + df; if (on(f + df, rankOf(S.ep + dir)) && S.b[s]?.t === "p" && S.b[s].c === S.turn) ep = S.ep; } }
  return `${k}|${S.turn}|${+S.castle.wK}${+S.castle.wQ}${+S.castle.bK}${+S.castle.bQ}|${ep}|${S.traps.filter(t => t.until > S.ply).map(t => t.sq + t.owner).join(",")}|${extra}`;
}
/** 표기 (간단 SAN) */
export function san(S, mv, legal) {
  const p = S.b[mv.from]; if (!p) return "?";
  if (mv.castle) return mv.castle === "K" ? "O-O" : "O-O-O";
  let s = p.t === "p" ? "" : p.t.toUpperCase();
  if (p.t !== "p" && legal) { const amb = legal.filter(o => o.to === mv.to && o.from !== mv.from && S.b[o.from]?.t === p.t); if (amb.length) s += amb.some(o => fileOf(o.from) === fileOf(mv.from)) ? (amb.some(o => rankOf(o.from) === rankOf(mv.from)) ? sqName(mv.from) : sqName(mv.from)[1]) : sqName(mv.from)[0]; }
  if (mv.cap !== undefined) s += (p.t === "p" ? sqName(mv.from)[0] : "") + (mv.block ? "⛨" : "x");
  s += sqName(mv.to);
  if (mv.promo) s += "=" + mv.promo.toUpperCase();
  return s;
}
export function perft(S, d, mods) { if (!d) return 1; let n = 0; for (const mv of legalMoves(S, S.turn, mods)) n += d === 1 ? 1 : perft(applyMove(S, mv), d - 1, mods); return n; }
