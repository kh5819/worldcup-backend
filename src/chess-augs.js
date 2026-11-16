// =========================
// 플듀 증강 체스 — 증강 40종 (2026-11-16)
// 체스 엔진(chess-core.js)은 그대로 두고, 여기서 ① 이동 보너스(mods) ② 고를 때 바로 적용 ③ 차례를 쓰는 행동(action) 을 정의
// 공통 원칙(서버 검증): 킹은 잡을 수 없음 · 행동 뒤 내 킹이 체크면 불가 · 배치·순간이동형 행동으로는 체크를 걸 수 없음 · 킹에는 보호막·무적 불가
// kind: passive(자동) · instant(고르는 순간 적용) · action(내 차례를 써서 사용) · arm(켜 두면 다음 수에 발동, 차례 안 씀)
// =========================
import { W, B, opp, fileOf, rankOf, VALUE, kingSq, inCheck, attacked, cloneState, mkPiece } from "./chess-core.js";

export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
const A = (id, rarity, art, name, kind, charges, cond, effect, duration, extra = {}) => ({ id, rarity, art, name, kind, charges, cond, effect, duration, ...extra });
export const AUGS = [
  // ---------- 일반 ----------
  A("assaultPawn", "common", "pawn-dash", "돌격 폰", "passive", null, "3랭크(흑은 6랭크) 폰", "한 번 더 2칸 전진할 수 있음", "판 전체"),
  A("retreatOrder", "common", "pawn-back", "후퇴 명령", "action", 2, "내 폰 (2랭크까지)", "폰 1개를 1칸 뒤로", "즉시 (2회)", { target: "ownPawn" }),
  A("knightBoost", "common", "knight-star", "강화 나이트", "passive", 1, "내 나이트", "3·1칸 낙타 점프 1회 (잡기 가능, 점프로 체크는 불가)", "1회"),
  A("bishopBless", "common", "bishop-cross", "비숍의 축복", "passive", null, "내 비숍", "가로·세로 1칸 이동 가능 (잡기 불가)", "판 전체"),
  A("ironRook", "common", "rook-shield", "철벽 룩", "instant", null, "고르는 순간 내 룩 전부", "보호막 1 (한 번 잡히는 걸 막음)", "보호막이 깨질 때까지"),
  A("fastPromo", "common", "pawn-crown", "빠른 승진", "passive", null, "내 폰", "7랭크(흑은 2랭크)에 닿아도 승진", "판 전체"),
  A("scout", "common", "eye", "정찰", "passive", null, "항상", "상대가 숨긴 함정과 상대의 다음 증강 후보가 보임", "판 전체"),
  A("guardian", "common", "shield", "수호자", "action", 2, "킹이 아닌 내 기물", "보호막 1 (최대 2)", "즉시 (2회)", { target: "ownPiece" }),
  A("royalGuard", "common", "king-guard", "왕실 경비", "instant", null, "고르는 순간 킹 주변 8칸의 내 기물", "보호막 1", "보호막이 깨질 때까지"),
  A("lastPawn", "common", "pawn-last", "마지막 폰", "passive", null, "내 폰이 2개 이하일 때", "어느 랭크에서든 2칸 전진", "조건 동안"),
  // ---------- 희귀 ----------
  A("revive", "rare", "revive", "부활", "action", 1, "6수 이후, 잡힌 내 폰·나이트·비숍", "1랭크 빈칸(폰은 2랭크)에 되살림 (체크 불가)", "즉시", { target: "lost+square", minFull: 6 }),
  A("rookJump", "rare", "rook-jump", "룩 점프", "passive", 2, "내 룩", "기물 하나를 뛰어넘어 이동·잡기 (점프로 체크는 불가)", "2회"),
  A("bishopLeap", "rare", "bishop-jump", "비숍 도약", "passive", 2, "내 비숍", "기물 하나를 뛰어넘어 이동·잡기 (점프로 체크는 불가)", "2회"),
  A("swapOwn", "rare", "swap", "자리 바꾸기", "action", 1, "킹이 아닌 내 기물 2개", "두 기물 자리 교환 (체크 불가)", "즉시", { target: "ownPiece+ownPiece" }),
  A("trap", "rare", "trap", "함정 설치", "action", 2, "빈칸 (상대 킹 옆 제외)", "숨긴 함정: 상대 기물이 밟으면 2턴 얼어붙음", "12수 동안 (2회)", { target: "emptySquare" }),
  A("tacticalSwap", "rare", "swap-x", "전술 교환", "action", 1, "내 기물 옆의 같거나 낮은 가치 상대 기물", "두 기물 자리 교환 (체크 불가)", "즉시", { target: "ownPiece+enemyAdj" }),
  A("defenseFormation", "rare", "formation", "방어 진형", "action", 1, "내 기물 하나", "그 기물과 가로·세로로 붙은 내 기물에 보호막 1", "즉시", { target: "ownPiece" }),
  A("pawnLegion", "rare", "pawn-legion", "폰 군단", "passive", null, "내 폰", "앞 대각선 빈칸으로도 이동 가능", "판 전체"),
  A("knightOrder", "rare", "knight-shield", "기사단", "instant", null, "고르는 순간 내 나이트 전부", "보호막 1", "보호막이 깨질 때까지"),
  A("redeploy", "rare", "redeploy", "재배치", "action", 2, "내 나이트·비숍·룩", "2칸 안 빈칸으로 바로 이동 (체크 불가)", "즉시 (2회)", { target: "ownPiece+square" }),
  // ---------- 영웅 ----------
  A("queenBless", "epic", "queen-aura", "퀸의 축복", "action", 1, "내 나이트·비숍·룩", "내 차례 3번 동안 퀸처럼도 움직임", "3턴", { target: "ownPiece" }),
  A("doubleAction", "epic", "double", "이중 행동", "arm", 1, "내 차례 시작에 켬", "이번 수 뒤에 한 수 더 (두 번째 수는 잡기·체크 불가)", "이번 차례"),
  A("rewind", "epic", "rewind", "시간 되감기", "action", 1, "상대가 방금 일반 수를 뒀을 때", "그 수를 취소 — 상대는 같은 수를 다시 둘 수 없음", "즉시"),
  A("battleLord", "epic", "banner", "전장의 지배자", "action", 1, "내 기물 하나", "그 주변 3×3 칸의 내 기물에 보호막 1", "즉시", { target: "ownPiece" }),
  A("royalRevive", "epic", "crown-revive", "왕실 부활", "action", 1, "15수 이후, 잡힌 내 룩·비숍·나이트", "1랭크 빈칸에 되살림 (체크 불가)", "즉시", { target: "lost+square", minFull: 15 }),
  A("dimension", "epic", "portal", "차원 이동", "action", 1, "킹이 아닌 내 기물", "3칸 안 빈칸으로 순간이동 (체크 불가)", "즉시", { target: "ownPiece+square" }),
  A("prisonerSwap", "epic", "chains", "포로 교환", "action", 1, "양쪽 다 잡힌 기물이 있을 때", "서로 가장 비싼 잡힌 기물(퀸 제외)을 1랭크에 되살림", "즉시"),
  A("forceRetreat", "epic", "push", "강제 후퇴", "action", 2, "킹이 아닌 상대 기물 (무적 제외)", "상대 진영 쪽으로 1칸 밀어냄 (체크 불가)", "즉시 (2회)", { target: "enemyPiece" }),
  A("evolve", "epic", "evolve", "기물 진화", "action", 1, "4랭크(흑 5랭크)까지 온 내 폰", "나이트나 비숍으로 바꿈 (체크 불가)", "즉시", { target: "ownPawn+kind" }),
  A("kingShield", "epic", "king-shield", "왕의 방패", "action", 1, "킹 주변 8칸의 내 기물", "보호막 1씩", "즉시"),
  // ---------- 전설 ----------
  A("secondQueen", "legendary", "queen-crown", "두 번째 퀸", "action", 1, "12수 이후, 5랭크(흑 4랭크)까지 온 내 폰", "퀸으로 진화 (체크 불가)", "즉시", { target: "ownPawn", minFull: 12 }),
  A("godMove", "legendary", "hand", "신의 한 수", "arm", 1, "기물 점수가 3점 이상 뒤질 때 켬", "이번 수 뒤에 한 수 더 (두 번째 수도 잡기 가능, 체크는 불가)", "이번 차례"),
  A("timeMaster", "legendary", "hourglass", "시간 지배자", "action", 1, "내가 방금 둔 수와 상대 응수가 있을 때", "두 수를 되돌리고 내가 다시 둠", "즉시"),
  A("spaceWarp", "legendary", "warp", "공간 왜곡", "action", 1, "킹이 아닌 내 기물", "내 진영(1~4랭크) 어느 빈칸으로든 이동 (체크 불가)", "즉시", { target: "ownPiece+square" }),
  A("occupy", "legendary", "flag", "점령", "action", 1, "내가 공격 중이고 상대가 지키지 않는 상대 폰", "그 폰을 내 편으로 (체크 불가)", "즉시", { target: "enemyPawn" }),
  A("kingWrath", "legendary", "king-fire", "왕의 분노", "passive", 2, "내 킹", "나이트처럼 뛸 수 있음 (체크 칸 불가)", "2회"),
  A("immortalKnight", "legendary", "knight-wing", "불사의 기사", "instant", null, "고르는 순간 내 나이트 전부", "보호막 2", "보호막이 깨질 때까지"),
  A("absoluteDefense", "legendary", "fortress", "절대 방어", "action", 1, "킹이 아닌 내 기물", "상대 3수 동안 잡히지 않음", "6수", { target: "ownPiece" }),
  A("chaos", "legendary", "chaos", "혼돈의 전장", "action", 1, "상대 나이트와 비숍이 함께 있을 때", "상대 나이트·비숍 자리를 무작위로 섞음 (체크 불가)", "즉시"),
  A("fateReverse", "legendary", "fate", "운명 역전", "passive", 1, "내 차례 시작에 기물 점수 6점 이상 뒤질 때 (1회)", "내 폰 전부 보호막 1 + 가장 비싼 나이트·비숍·룩이 3턴 퀸 이동", "1회"),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const WEIGHTS = [
  { common: 60, rare: 30, epic: 9, legendary: 1 },
  { common: 30, rare: 40, epic: 24, legendary: 6 },
  { common: 12, rare: 33, epic: 37, legendary: 18 },
];
export function rollOffer(pickIdx, owned = [], rng = Math.random, n = 3, exclude = []) {
  const w = WEIGHTS[Math.min(pickIdx, WEIGHTS.length - 1)];
  const pool = AUGS.filter(a => !owned.includes(a.id) && !exclude.includes(a.id));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let tot = 0; for (const a of pool) tot += w[a.rarity];
    let x = rng() * tot, i = 0;
    for (; i < pool.length - 1; i++) { x -= w[pool[i].rarity]; if (x <= 0) break; }
    out.push(pool[i].id); pool.splice(i, 1);
  }
  return out;
}

// ---------------- 도우미 ----------------
export const material = (S, c) => S.b.reduce((s, p) => s + (p && p.c === c ? VALUE[p.t] : 0), 0);
const rel = (c, s) => (c === W ? rankOf(s) : 7 - rankOf(s)); // 내 쪽에서 본 랭크 (0 = 내 1랭크)
const cheb = (a, b) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
const own = (S, s, c) => S.b[s] && S.b[s].c === c;
const isEmpty = (S, s) => !S.b[s];
const addShield = (p, n = 1, max = 3) => { if (p && p.t !== "k") p.sh = Math.min(max, (p.sh || 0) + n); };
const backSquares = (c, t) => { const r = t === "p" ? (c === W ? 1 : 6) : (c === W ? 0 : 7); return Array.from({ length: 8 }, (_, f) => r * 8 + f); };
const pawnLastRankOk = (c, s, t) => t !== "p" || (rel(c, s) >= 1 && rel(c, s) <= 6);

/** 고르는 순간 적용 */
export function applyInstant(S, c, id) {
  if (id === "ironRook") for (const p of S.b) if (p && p.c === c && p.t === "r") addShield(p);
  if (id === "knightOrder") for (const p of S.b) if (p && p.c === c && p.t === "n") addShield(p);
  if (id === "immortalKnight") for (const p of S.b) if (p && p.c === c && p.t === "n") addShield(p, 2);
  if (id === "royalGuard") { const k = kingSq(S, c); for (let s = 0; s < 64; s++) if (s !== k && own(S, s, c) && cheb(s, k) === 1) addShield(S.b[s]); }
}
/** 이 색의 이동 보너스 (augs: [{id, charges}]) */
export function modsFor(augs) {
  const m = {}; const has = (id) => augs.find(a => a.id === id && (a.charges === null || a.charges > 0));
  for (const id of ["assaultPawn", "bishopBless", "fastPromo", "pawnLegion", "lastPawn"]) if (has(id)) m[id] = true;
  if (has("rookJump")) m.rookJump = true;
  if (has("bishopLeap")) m.bishopLeap = true;
  if (has("knightBoost")) m.camel = true;
  if (has("kingWrath")) m.kingKnight = true;
  return m;
}
export const MOVE_AUG = { knightBoost: "knightBoost", rookJump: "rookJump", bishopLeap: "bishopLeap", kingWrath: "kingWrath" }; // 이동에 붙은 aug 표시 → 횟수 깎음

/**
 * 행동 후보 만들기 — G: 게임(상태·증강·기록), c: 색
 * 돌려주는 값: [{ ...params }] (검증 전). 너무 많으면 잘라 씀
 */
export function candidates(G, c, id) {
  const S = G.S, out = [], k = kingSq(S, c), ok = kingSq(S, opp(c));
  const mine = [], enemy = [], empties = [];
  for (let s = 0; s < 64; s++) { const p = S.b[s]; if (!p) empties.push(s); else if (p.c === c) mine.push(s); else enemy.push(s); }
  const minePieces = mine.filter(s => S.b[s].t !== "k");
  switch (id) {
    case "retreatOrder": for (const s of mine) if (S.b[s].t === "p") { const to = s + (c === W ? -8 : 8); if (to >= 0 && to < 64 && isEmpty(S, to) && rel(c, to) >= 1) out.push({ sq: s, to }); } break;
    case "guardian": for (const s of minePieces) if ((S.b[s].sh || 0) < 2) out.push({ sq: s }); break;
    case "revive": case "royalRevive": {
      const ts = id === "revive" ? ["p", "n", "b"] : ["r", "b", "n"];
      const lostT = [...new Set(S.lost[c].map(x => x.t))].filter(t => ts.includes(t));
      for (const t of lostT) for (const s of backSquares(c, t)) if (isEmpty(S, s)) out.push({ t, to: s });
      break;
    }
    case "swapOwn": for (const a of minePieces) for (const b of minePieces) if (a < b && S.b[a].t !== S.b[b].t && pawnLastRankOk(c, b, S.b[a].t) && pawnLastRankOk(c, a, S.b[b].t)) out.push({ sq: a, sq2: b }); break;
    case "trap": for (const s of empties) if (cheb(s, ok) > 1 && !S.traps.some(t => t.sq === s && t.until > S.ply)) out.push({ sq: s }); break;
    case "tacticalSwap": for (const a of minePieces) for (const b of enemy) { const q = S.b[b]; if (q.t === "k" || cheb(a, b) !== 1 || VALUE[q.t] > VALUE[S.b[a].t] || (q.inv > S.ply)) continue; if (pawnLastRankOk(c, b, S.b[a].t) && pawnLastRankOk(opp(c), a, q.t)) out.push({ sq: a, sq2: b }); } break;
    case "defenseFormation": case "battleLord": for (const s of minePieces) out.push({ sq: s }); break;
    case "redeploy": for (const s of minePieces) if ("nbr".includes(S.b[s].t)) for (const e of empties) if (cheb(s, e) <= 2) out.push({ sq: s, to: e }); break;
    case "queenBless": for (const s of minePieces) if ("nbr".includes(S.b[s].t)) out.push({ sq: s }); break;
    case "dimension": for (const s of minePieces) for (const e of empties) if (cheb(s, e) <= 3 && pawnLastRankOk(c, e, S.b[s].t)) out.push({ sq: s, to: e }); break;
    case "spaceWarp": for (const s of minePieces) for (const e of empties) if (rel(c, e) <= 3 && pawnLastRankOk(c, e, S.b[s].t) && cheb(s, e) > 1) out.push({ sq: s, to: e }); break;
    case "prisonerSwap": if (S.lost[c].some(x => x.t !== "q") && S.lost[opp(c)].some(x => x.t !== "q")) out.push({}); break;
    case "forceRetreat": for (const s of enemy) { const q = S.b[s]; if (q.t === "k" || q.inv > S.ply) continue; const to = s + (c === W ? 8 : -8); if (to >= 0 && to < 64 && isEmpty(S, to) && pawnLastRankOk(opp(c), to, q.t)) out.push({ sq: s, to }); } break;
    case "evolve": for (const s of mine) if (S.b[s].t === "p" && rel(c, s) >= 3) for (const t of ["n", "b"]) out.push({ sq: s, t }); break;
    case "kingShield": if (minePieces.some(s => cheb(s, k) === 1)) out.push({}); break;
    case "secondQueen": for (const s of mine) if (S.b[s].t === "p" && rel(c, s) >= 4) out.push({ sq: s }); break;
    case "occupy": for (const s of enemy) { const q = S.b[s]; if (q.t !== "p" || q.sh > 0 || q.inv > S.ply) continue; if (attacked(S, s, c, G.mods) && !defended(S, s, opp(c), G.mods)) out.push({ sq: s }); } break;
    case "absoluteDefense": for (const s of minePieces) out.push({ sq: s }); break;
    case "chaos": if (enemy.some(s => S.b[s].t === "n") && enemy.some(s => S.b[s].t === "b")) out.push({}); break; // 같은 종류끼리만 있으면 섞어도 그대로라 의미 없음
    case "rewind": if (G.canRewind(c)) out.push({}); break;
    case "timeMaster": if (G.canTimeMaster(c)) out.push({}); break;
    case "doubleAction": if (!G.armed[c]) out.push({}); break;
    case "godMove": if (!G.armed[c] && material(S, opp(c)) - material(S, c) >= 3) out.push({}); break;
  }
  return out;
}
function defended(S, sq, by, mods) {
  // 그 칸의 말을 잠깐 상대 색으로 바꾸고 by 가 공격하는지 봄
  const T = cloneState(S); const p = T.b[sq]; T.b[sq] = { ...p, c: opp(by) };
  return attacked(T, sq, by, mods);
}
/** 매개변수 검사 (후보에 들어 있나) */
export function paramsMatch(G, c, id, pl) {
  return candidates(G, c, id).find(x => Object.keys(x).every(k => x[k] === pl[k])) || null;
}
/** 행동을 새 상태에 적용 (차례 넘김 전). 결과 { S, fx } — 실패하면 null */
export function applyAction(G, c, id, pr, rng = Math.random) {
  const S = cloneState(G.S), b = S.b, fx = { id, c, squares: [] };
  const mark = (...s) => fx.squares.push(...s);
  switch (id) {
    case "retreatOrder": case "redeploy": case "dimension": case "spaceWarp": b[pr.to] = b[pr.sq]; b[pr.sq] = null; mark(pr.sq, pr.to); break;
    case "guardian": addShield(b[pr.sq], 1, 2); mark(pr.sq); break;
    case "revive": case "royalRevive": { const i = S.lost[c].findIndex(x => x.t === pr.t); if (i < 0) return null; S.lost[c].splice(i, 1); b[pr.to] = mkPiece(pr.t, c, { revived: true }); mark(pr.to); break; }
    case "swapOwn": case "tacticalSwap": { const t = b[pr.sq]; b[pr.sq] = b[pr.sq2]; b[pr.sq2] = t; mark(pr.sq, pr.sq2); break; }
    case "trap": S.traps.push({ sq: pr.sq, owner: c, until: S.ply + 12 }); mark(pr.sq); break;
    case "defenseFormation": { addShield(b[pr.sq]); mark(pr.sq); for (const d of [1, -1, 8, -8]) { const s = pr.sq + d; if (s < 0 || s > 63 || (Math.abs(d) === 1 && rankOf(s) !== rankOf(pr.sq))) continue; if (own(S, s, c)) { addShield(b[s]); mark(s); } } break; }
    case "battleLord": for (let s = 0; s < 64; s++) if (own(S, s, c) && cheb(s, pr.sq) <= 1) { addShield(b[s]); mark(s); } break;
    case "queenBless": b[pr.sq].qm = S.ply + 6; mark(pr.sq); break;
    case "prisonerSwap": {
      for (const side of [c, opp(c)]) {
        const best = S.lost[side].map((x, i) => ({ ...x, i })).filter(x => x.t !== "q").sort((x, y) => VALUE[y.t] - VALUE[x.t])[0]; if (!best) continue;
        const sq = backSquares(side, best.t).find(s => !b[s]); if (sq === undefined) continue;
        S.lost[side].splice(best.i, 1); b[sq] = mkPiece(best.t, side, { revived: true }); mark(sq);
      }
      break;
    }
    case "forceRetreat": b[pr.to] = b[pr.sq]; b[pr.sq] = null; mark(pr.sq, pr.to); break;
    case "evolve": b[pr.sq] = { ...b[pr.sq], t: pr.t, promoted: true }; mark(pr.sq); break;
    case "kingShield": { const k = kingSq(S, c); for (let s = 0; s < 64; s++) if (s !== k && own(S, s, c) && cheb(s, k) === 1) { addShield(b[s]); mark(s); } break; }
    case "secondQueen": b[pr.sq] = { ...b[pr.sq], t: "q", promoted: true }; mark(pr.sq); break;
    case "occupy": b[pr.sq] = { ...b[pr.sq], c, id: b[pr.sq].id + "o" }; mark(pr.sq); break;
    case "absoluteDefense": b[pr.sq].inv = S.ply + 6; mark(pr.sq); break;
    case "chaos": {
      const sqs = []; for (let s = 0; s < 64; s++) if (b[s] && b[s].c !== c && "nb".includes(b[s].t)) sqs.push(s);
      let done = false;
      for (let t = 0; t < 30 && !done; t++) {
        const ps = sqs.map(s => G.S.b[s]); for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
        if (ps.every((p, i) => p.t === G.S.b[sqs[i]].t)) continue; // 종류가 하나도 안 바뀌면 다시
        sqs.forEach((s, i) => (b[s] = { ...ps[i] }));
        if (!inCheck(S, opp(c), G.mods) && !inCheck(S, c, G.mods)) done = true;
      }
      if (!done) return null;
      mark(...sqs); break;
    }
    default: return null;
  }
  // 안전 검사: 내 킹 체크 금지, 상대에게 체크 거는 것 금지
  if (inCheck(S, c, G.mods)) return null;
  if (inCheck(S, opp(c), G.mods)) return null;
  return { S, fx };
}
