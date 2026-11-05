// =========================
// 플듀 IQ 테스트 진단소 — 문제 생성기 + 정답 확인 (브라우저·서버 동일 파일)
// gen(type, d, seed) → { type, d, area, lim, view, key, exp, hint }
//   view = 화면에 보내는 것(정답 없음) · key = 정답(서버만) · exp = 해설 재료 · hint = 힌트 재료
// check(item, answer, st) → { ok, part }   (part: 0~1 부분 점수, 기억 문항만)
// 서버 사본: worldcup-backend/src/iq-gen.js  ↔  홈페이지 제작/js/iq/gen.js (시험이 같은지 검사)
// 외부 import 금지
// =========================

export const GEN_VERSION = 4;   // 3: 문제해결 난이도 상향 — 길찾기 판·별↑, 원판 횟수 제한 (2026-11-06 사용자 '문제해결 너무 쉽다')
// 이전: GEN_VERSION 2   // 2: 패턴·공간·언어 난이도 상향 (2026-11-01 사용자 '너무 쉽다')

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
  f.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return f;
}
export function hashSeed(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isInt = (v) => Number.isInteger(v);
const range = (n) => Array.from({ length: n }, (_, i) => i);

// =========================================================
// 유형 목록 — area: 8개 영역 · kind: mcq(보기 선택) | input(숫자) | play(조작) · lim: 난이도별 제한시간(초)
// =========================================================
export const AREAS = ["logic", "pattern", "spatial", "numeric", "verbal", "memory", "problem", "creative"];
export const TYPES = {
  matrix:    { area: "pattern",  kind: "mcq",   lim: [50, 60, 70, 80, 90], from: null },
  figseq:    { area: "pattern",  kind: "mcq",   lim: [40, 45, 55, 65, 75], from: null },
  series:    { area: "numeric",  kind: "input", lim: [45, 55, 65, 75, 85], from: "number" },
  symbols:   { area: "numeric",  kind: "input", lim: [50, 60, 75, 85, 95], from: "cipher" },
  clock:     { area: "numeric",  kind: "play",  lim: [45, 55, 65, 75, 75], from: "clock" },
  liar:      { area: "logic",    kind: "mcq",   lim: [60, 70, 80, 95, 110], from: "contradiction" },
  order:     { area: "logic",    kind: "play",  lim: [60, 75, 90, 105, 120], from: "order" },
  lock:      { area: "logic",    kind: "play",  lim: [70, 80, 95, 110, 120], from: "lock" },
  scale:     { area: "logic",    kind: "play",  lim: [40, 60, 75, 85, 110], from: "weights" },
  rotate:    { area: "spatial",  kind: "mcq",   lim: [35, 40, 45, 55, 65], from: "jigsaw" },
  circuit:   { area: "spatial",  kind: "play",  lim: [45, 60, 75, 100, 130], from: "circuit" },
  mirror:    { area: "spatial",  kind: "play",  lim: [45, 60, 75, 90, 110], from: "mirror" },
  gears:     { area: "spatial",  kind: "mcq",   lim: [30, 35, 45, 55, 65], from: "gears" },
  analogy:   { area: "verbal",   kind: "mcq",   lim: [30, 35, 40, 45, 50], from: null },
  oddword:   { area: "verbal",   kind: "mcq",   lim: [25, 30, 35, 40, 45], from: null },
  syllogism: { area: "verbal",   kind: "mcq",   lim: [45, 55, 65, 75, 85], from: "grid" },
  bells:     { area: "memory",   kind: "play",  lim: [40, 45, 50, 55, 60], from: "melody" },
  span:      { area: "memory",   kind: "input", lim: [35, 40, 45, 50, 55], from: null },
  gridmem:   { area: "memory",   kind: "play",  lim: [30, 30, 35, 35, 40], from: "hidden" },
  slide:     { area: "problem",  kind: "play",  lim: [60, 75, 90, 110, 130], from: "slide" },
  path:      { area: "problem",  kind: "play",  lim: [50, 60, 75, 75, 85], from: "path" },
  rings:     { area: "problem",  kind: "play",  lim: [50, 60, 75, 110, 130], from: "rings" },
  match:     { area: "creative", kind: "play",  lim: [60, 75, 90, 100, 110], from: null },
  make:      { area: "creative", kind: "play",  lim: [60, 75, 90, 100, 120], from: null },
};
export const TYPE_IDS = Object.keys(TYPES);

// =========================================================
// 1) 도형 규칙 (3×3 행렬) · 도형 수열 — 도형 = {s 모양, n 개수, f 채움, o 방향(45° 단위)}
// =========================================================
// 모양: 0원 1네모 2세모 3마름모 4육각 5별 6화살 7깃발  (2·6·7은 방향이 보임)
const ORIENTED = [2, 6, 7];
const SHAPES_ALL = [0, 1, 2, 3, 4, 5, 6, 7];
function latinRow(vals, r) { return vals.map((_, c) => vals[(c + r) % vals.length]); }
function genMatrix(R, d) {
  for (let tries = 0; tries < 60; tries++) {
    const nVary = [2, 2, 3, 3, 4][d - 1];
    let attrs = R.shuffle(["s", "n", "f", "o"]).slice(0, nVary);
    if (d >= 5 && !attrs.includes("o")) attrs[attrs.length - 1] = "o";
    const rules = {};
    const base = { s: R.pick(attrs.includes("o") ? ORIENTED : SHAPES_ALL), n: R.int(1, 3), f: R.int(0, 2), o: attrs.includes("o") ? 0 : 0 };
    for (const a of attrs) {
      const opts = a === "s" ? ["row", "latin", "col"] : a === "n" ? ["prog", "latin", "row"] : a === "f" ? ["prog", "latin", "row"] : ["prog", "latin"];
      rules[a] = R.pick(opts);
    }
    // 보통 이상: 줄 안에서 바뀌는 규칙(prog·latin)이 꼭 있어야 함 — 줄마다 똑같은 그림이면 너무 쉬움. 어려움 이상은 2개 이상
    const moving = attrs.filter((a) => rules[a] === "prog" || rules[a] === "latin").length;
    if (moving < Math.min(attrs.length, d >= 4 ? 3 : d >= 2 ? 2 : 1)) continue;
    const pool = {
      s: R.shuffle(attrs.includes("o") ? ORIENTED : SHAPES_ALL).slice(0, 3),
      n: [1, 2, 3], f: R.shuffle([0, 1, 2]), o: R.shuffle([0, 2, 4, 6]).slice(0, 3),
    };
    const oStep = R.pick([2, 6]);   // 90° 또는 -90°
    const cell = (r, c) => {
      const x = { ...base };
      for (const a of attrs) {
        const rule = rules[a], vs = pool[a];
        if (rule === "row") x[a] = vs[r];
        else if (rule === "col") x[a] = vs[c];
        else if (rule === "latin") x[a] = latinRow(vs, r)[c];
        else if (rule === "prog") x[a] = a === "n" ? 1 + c : a === "f" ? c : (pool.o[r] + oStep * c) % 8;
      }
      if (!attrs.includes("o") && ORIENTED.includes(x.s)) x.o = 0;
      return x;
    };
    const grid = range(9).map((i) => cell(Math.floor(i / 3), i % 3));
    const ans = grid[8];
    // 보기: 정답 + 한 가지(어려우면 두 가지) 속성만 다른 것
    const opts = [ans];
    const key = (x) => `${x.s}|${x.n}|${x.f}|${x.o}`;
    const seen = new Set([key(ans)]);
    const tempt = [grid[7], grid[5], grid[4]];
    for (const t of tempt) if (!seen.has(key(t)) && opts.length < 3) { opts.push(t); seen.add(key(t)); }
    const vary = attrs.concat(R.shuffle(["s", "n", "f", "o"].filter((a) => !attrs.includes(a))).slice(0, 1));
    for (let k = 0; k < 200 && opts.length < 6; k++) {
      const x = { ...ans };
      const nChange = d >= 4 && R() < 0.4 ? 2 : 1;
      for (const a of R.shuffle(vary).slice(0, nChange)) {
        if (a === "s") x.s = R.pick(attrs.includes("o") || ORIENTED.includes(ans.s) ? ORIENTED : SHAPES_ALL);
        else if (a === "n") x.n = R.int(1, 3);
        else if (a === "f") x.f = R.int(0, 2);
        else if (a === "o") { if (ORIENTED.includes(x.s)) x.o = R.pick([0, 2, 4, 6]); }
      }
      if (!ORIENTED.includes(x.s)) x.o = 0;
      if (!seen.has(key(x))) { seen.add(key(x)); opts.push(x); }
    }
    if (opts.length < 6) continue;
    const order = R.shuffle(range(6));
    const shown = order.map((i) => opts[i]);
    const keyIdx = order.indexOf(0);
    return { view: { cells: grid.slice(0, 8), opts: shown }, key: keyIdx, exp: { rules: attrs.map((a) => ({ a, r: rules[a] })), ans }, hint: { a: attrs[0], r: rules[attrs[0]] } };
  }
  throw new Error("matrix gen");
}
function genFigseq(R, d) {
  for (let tries = 0; tries < 60; tries++) {
    const nVary = [1, 2, 2, 3, 3][d - 1];
    const attrs = R.shuffle(["o", "n", "f", "s"]).slice(0, nVary);
    const shapeA = R.pick(attrs.includes("o") ? ORIENTED : SHAPES_ALL);
    let shapeB = R.pick((attrs.includes("o") ? ORIENTED : SHAPES_ALL).filter((x) => x !== shapeA));
    const p = {
      o: { step: R.pick(d <= 1 ? [2, 6] : [1, 3, 5, 7, 3]), start: R.int(0, 7) },
      n: { kind: R.pick(d <= 1 ? ["up"] : ["up", "cycle", "cycle"]), start: R.int(1, 2) },
      f: { period: R.pick([2, 3]), start: R.int(0, 2) },
      s: { period: R.pick([2, 3]) },
    };
    const shapes = [shapeA, shapeB, R.pick(SHAPES_ALL.filter((x) => x !== shapeA && x !== shapeB && (!attrs.includes("o") || ORIENTED.includes(x))))];
    const at = (i) => {
      const x = { s: shapeA, n: 1, f: 2, o: 0 };
      if (attrs.includes("o")) x.o = (p.o.start + p.o.step * i) % 8;
      if (attrs.includes("n")) x.n = p.n.kind === "up" ? p.n.start + i : 1 + ((p.n.start - 1 + i) % 4);
      if (attrs.includes("f")) x.f = (p.f.start + i) % p.f.period;
      if (attrs.includes("s")) x.s = shapes[i % p.s.period];
      if (!ORIENTED.includes(x.s)) x.o = 0;
      return x;
    };
    const seq = range(5).map(at), ans = at(5);
    if (ans.n > 6) continue;
    const key = (x) => `${x.s}|${x.n}|${x.f}|${x.o}`;
    const opts = [ans], seen = new Set([key(ans)]);
    for (const t of [seq[4], seq[3], at(6)]) if (t.n <= 6 && !seen.has(key(t)) && opts.length < 3) { opts.push(t); seen.add(key(t)); }
    for (let k = 0; k < 200 && opts.length < 5; k++) {
      const x = { ...ans };
      const a = R.pick(attrs.concat(["f"]));
      if (a === "o" && ORIENTED.includes(x.s)) x.o = (x.o + R.pick([1, 2, 4, 6, 7])) % 8;
      else if (a === "n") x.n = Math.max(1, Math.min(6, x.n + R.pick([-1, 1, 2])));
      else if (a === "f") x.f = (x.f + R.int(1, 2)) % 3;
      else if (a === "s") x.s = R.pick(shapes);
      if (!ORIENTED.includes(x.s)) x.o = 0;
      if (!seen.has(key(x))) { seen.add(key(x)); opts.push(x); }
    }
    if (opts.length < 5) continue;
    const order = R.shuffle(range(5));
    return { view: { seq, opts: order.map((i) => opts[i]) }, key: order.indexOf(0), exp: { attrs, p, ans }, hint: { a: attrs[0] } };
  }
  throw new Error("figseq gen");
}

// =========================================================
// 2) 수열 (미스터리 '숫자 규칙'을 매번 새로)
// =========================================================
function genSeries(R, d) {
  const kinds = [["arith", "geom"], ["inc", "alt2"], ["lin", "sq", "fib"], ["altop", "dbl", "tri"], ["lin2", "mix", "cube"]][d - 1];
  for (let tries = 0; tries < 80; tries++) {
    const k = R.pick(kinds);
    const n = 7;
    let s = [], p = {};
    if (k === "arith") { p = { a: R.int(1, 20), k: R.int(2, 9) * R.pick([1, 1, 1, -1]) }; if (p.k < 0) p.a += 60; s = range(n).map((i) => p.a + p.k * i); }
    else if (k === "geom") { p = { a: R.int(1, 4), r: R.pick([2, 3]) }; s = range(n).map((i) => p.a * p.r ** i); }
    else if (k === "inc") { p = { a: R.int(1, 10), k: R.int(1, 4), s: R.int(1, 3) }; s = [p.a]; for (let i = 1; i < n; i++) s.push(s[i - 1] + p.k + p.s * (i - 1)); }
    else if (k === "alt2") { p = { a: R.int(1, 9), x: R.int(2, 5), b: R.int(10, 30), y: -R.int(1, 3) }; s = range(n).map((i) => (i % 2 ? p.b + p.y * ((i - 1) / 2) : p.a + p.x * (i / 2))); }
    else if (k === "lin") { p = { a: R.int(1, 5), m: 2, c: R.pick([-1, 1, 2, 3]) }; s = [p.a]; for (let i = 1; i < n; i++) s.push(s[i - 1] * p.m + p.c); }
    else if (k === "sq") { p = { a: R.int(1, 4), c: R.int(-3, 5) }; s = range(n).map((i) => (i + p.a) ** 2 + p.c); }
    else if (k === "fib") { p = { a: R.int(1, 4), b: R.int(1, 6) }; s = [p.a, p.b]; for (let i = 2; i < n; i++) s.push(s[i - 1] + s[i - 2]); }
    else if (k === "altop") { p = { a: R.int(1, 5), x: R.int(2, 6), m: R.pick([2, 3]) }; s = [p.a]; for (let i = 1; i < n; i++) s.push(i % 2 ? s[i - 1] + p.x : s[i - 1] * p.m); }
    else if (k === "dbl") { p = { a: R.int(1, 10), k: R.int(1, 3) }; s = [p.a]; for (let i = 1; i < n; i++) s.push(s[i - 1] + p.k * 2 ** (i - 1)); }
    else if (k === "tri") { p = { a: 1, b: R.int(1, 2), c: R.int(2, 3) }; s = [p.a, p.b, p.c]; for (let i = 3; i < n; i++) s.push(s[i - 1] + s[i - 2] + s[i - 3]); }
    else if (k === "lin2") { p = { a: R.int(2, 5), m: 3, c: -R.int(1, 4) }; s = [p.a]; for (let i = 1; i < n; i++) s.push(s[i - 1] * p.m + p.c); }
    else if (k === "mix") { p = { a: R.int(1, 3), m: 2, b: R.int(20, 40), x: R.int(3, 7) }; s = range(n).map((i) => (i % 2 ? p.b + p.x * ((i - 1) / 2) : p.a * p.m ** (i / 2))); }
    else if (k === "cube") { p = { a: R.int(0, 2), c: R.int(-2, 3) }; s = range(n).map((i) => (i + p.a) ** 3 + p.c); }
    if (s.some((v) => !isInt(v) || Math.abs(v) > 99999) || new Set(s).size < 5) continue;
    return { view: { shown: s.slice(0, 6) }, key: s[6], exp: { k, p, next: s[6] }, hint: { k, diffs: s.slice(1, 6).map((v, i) => v - s[i]) } };
  }
  throw new Error("series gen");
}

// =========================================================
// 3) 기호 계산 (미스터리 '암호' → 기호마다 숫자)
// =========================================================
function genSymbols(R, d) {
  for (let tries = 0; tries < 200; tries++) {
    const m = [2, 3, 3, 4, 4][d - 1];
    const syms = R.shuffle(range(12)).slice(0, m);
    const vals = R.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, m);
    const V = (i) => vals[i];
    const eqs = [];
    // 첫 식: A ○ A (○ A) = 값
    const op0 = R.pick(d <= 1 ? ["+"] : ["+", "×"]);
    const cnt0 = op0 === "+" ? R.pick([2, 3]) : 2;
    eqs.push({ t: Array(cnt0).fill(0), ops: Array(cnt0 - 1).fill(op0), v: op0 === "+" ? V(0) * cnt0 : V(0) * V(0) });
    for (let i = 1; i < m; i++) {
      const op = R.pick(["+", "+", "−", "×"]);
      const j = R.int(0, i - 1);
      let left = [j, i], v;
      if (op === "−") { if (V(j) > V(i)) v = V(j) - V(i); else { left = [i, j]; v = V(i) - V(j); } }
      else v = op === "+" ? V(j) + V(i) : V(j) * V(i);
      eqs.push({ t: left, ops: [op], v });
    }
    // 묻는 것
    let q;
    if (d <= 2) q = { t: [m - 1], ops: [] };
    else if (d === 3) q = { t: [0, m - 1], ops: ["+"] };
    else if (d === 4) q = { t: [0, 1, m - 1], ops: ["×", "−"] };
    else q = { t: [0, 1, 2, 3], ops: ["+", "×", "−"], paren: true };   // (A + B) × C − D
    const evalQ = () => {
      const t = q.t.map(V);
      if (q.paren) return (t[0] + t[1]) * t[2] - t[3];
      if (q.ops.length === 0) return t[0];
      if (q.ops.length === 1) return t[0] + t[1];
      return t[0] * t[1] - t[2];
    };
    const ans = evalQ();
    if (!isInt(ans) || ans < 0 || ans > 200) continue;
    if (eqs.some((e) => e.v > 90)) continue;
    return { view: { syms, eqs: eqs.map((e) => ({ t: e.t.map((i) => syms[i]), ops: e.ops, v: e.v })), q: { t: q.t.map((i) => syms[i]), ops: q.ops, paren: !!q.paren } }, key: ans, exp: { vals: syms.map((s, i) => [s, vals[i]]), ans }, hint: { sym: syms[0], v: vals[0] } };
  }
  throw new Error("symbols gen");
}

// =========================================================
// 4) 시계 (미스터리 시계 조작)
// =========================================================
const toMin = (h, m) => ((h % 12) * 60 + m + 720) % 720;
function genClock(R, d) {
  const h = R.int(1, 12), m = R.int(0, 11) * 5;
  if (d <= 3) {
    const sub = d === 3 && R() < 0.6;
    const dm = d === 1 ? R.pick([60, 90, 120, 150, 180]) : R.int(4, 40) * 5 + R.pick([0, 60, 120]);
    const t = toMin(h, m) + (sub ? -dm : dm);
    const a = ((t % 720) + 720) % 720;
    return { view: { kind: sub ? "sub" : "add", h, m, dm }, key: { h: Math.floor(a / 60) || 12, m: a % 60 }, exp: { kind: sub ? "sub" : "add", h, m, dm }, hint: { dm } };
  }
  if (d === 4) {   // 거울에 비친 시계
    const a = (720 - toMin(h, m)) % 720, sh = Math.floor(a / 60) || 12, sm = a % 60; // 거울 속 바늘 위치
    return { view: { kind: "mirror", h: sh, m: sm }, key: { h, m }, exp: { kind: "mirror", h: sh, m: sm }, hint: { kind: "mirror" } };
  }
  // 두 바늘 사이 각도
  let ang = Math.abs(30 * (h % 12) - 5.5 * m); if (ang > 180) ang = 360 - ang;
  const opts = new Set([ang]);
  const cands = [Math.abs(30 * (h % 12) - 6 * m), ang + 15, Math.abs(ang - 15), ang + 30, Math.abs(ang - 30), 360 - ang, ang + 2.5, Math.abs(ang - 2.5)].map((x) => (x > 180 ? 360 - x : x));
  for (const c of R.shuffle(cands)) { if (opts.size >= 4) break; if (c >= 0 && c <= 180) opts.add(c); }
  const list = R.shuffle([...opts]);
  return { view: { kind: "angle", h, m, opts: list }, key: list.indexOf(ang), exp: { kind: "angle", h, m, ang }, hint: { kind: "angle" } };
}

// =========================================================
// 5) 거짓말쟁이 찾기 (미스터리 '증언 모순')
// statement: {k:"is",x} 범인이다 · {k:"not",x} 범인이 아니다 · {k:"me"} 나는 아니다 · {k:"lie",x} x는 거짓말 · {k:"true",x} x는 진실
// =========================================================
function stTrue(st, culprit, liars) {
  if (st.k === "is") return culprit === st.x;
  if (st.k === "not") return culprit !== st.x;
  if (st.k === "me") return culprit !== st.self;
  if (st.k === "lie") return liars.has(st.x);
  if (st.k === "true") return !liars.has(st.x);
  return false;
}
function combos(n, k) { const out = []; const rec = (s, a) => { if (a.length === k) { out.push(new Set(a)); return; } for (let i = s; i < n; i++) rec(i + 1, [...a, i]); }; rec(0, []); return out; }
export function liarSolutions(n, stmts, nLiars) {
  const sols = [];
  for (let c = 0; c < n; c++) for (const L of combos(n, nLiars)) {
    if (stmts.every((st, p) => stTrue({ ...st, self: p }, c, L) === !L.has(p))) sols.push({ c, liars: [...L] });
  }
  return sols;
}
function genLiar(R, d) {
  const n = d <= 3 ? 4 : 5;
  const nLiars = d === 5 ? n - 1 : 1;
  for (let tries = 0; tries < 400; tries++) {
    const culprit = R.int(0, n - 1);
    const liars = new Set(R.shuffle(range(n)).slice(0, nLiars));
    const kinds = d <= 1 ? ["is", "not", "me"] : ["is", "not", "me", "lie", "true"];
    const stmts = [];
    for (let p = 0; p < n; p++) {
      let st = null;
      for (let k = 0; k < 40; k++) {
        const kk = R.pick(kinds);
        const x = R.pick(range(n).filter((q) => q !== p));
        const cand = kk === "me" ? { k: "me" } : { k: kk, x };
        if (stTrue({ ...cand, self: p }, culprit, liars) === !liars.has(p)) { st = cand; break; }
      }
      if (!st) break;
      stmts.push(st);
    }
    if (stmts.length < n) continue;
    const sols = liarSolutions(n, stmts, nLiars);
    if (!sols.length || sols.some((s) => s.c !== culprit)) continue;
    if (d >= 3 && !stmts.some((s) => s.k === "lie" || s.k === "true")) continue;
    return { view: { n, stmts, nLiars, mode: d === 5 ? "oneTruth" : "oneLiar" }, key: culprit, exp: { culprit, liars: sols[0].liars, sols: sols.length }, hint: d === 5 ? { truth: range(n).find((q) => !liars.has(q)) } : { liar: [...liars][0] } };
  }
  throw new Error("liar gen");
}

// =========================================================
// 6) 순서 추리 (미스터리 '순서 배열' + '알리바이 표')
// clue: {k:"before",a,b} a가 b보다 먼저 · {k:"next",a,b} a는 b 바로 다음 · {k:"pos",a,p} · {k:"notpos",a,p} · {k:"gap",a,b,g} 사이에 g명 · {k:"notedge",a}
// =========================================================
function perms(arr) { if (arr.length <= 1) return [arr.slice()]; const out = []; arr.forEach((x, i) => { for (const p of perms(arr.filter((_, j) => j !== i))) out.push([x, ...p]); }); return out; }
function clueOk(c, pos, n) {
  if (c.k === "before") return pos[c.a] < pos[c.b];
  if (c.k === "next") return pos[c.a] === pos[c.b] + 1;
  if (c.k === "pos") return pos[c.a] === c.p;
  if (c.k === "notpos") return pos[c.a] !== c.p;
  if (c.k === "gap") return Math.abs(pos[c.a] - pos[c.b]) === c.g + 1;
  if (c.k === "notedge") return pos[c.a] !== 0 && pos[c.a] !== n - 1;
  return false;
}
export function orderSolutions(n, clues) {
  const out = [];
  for (const P of perms(range(n))) {   // P[등수] = 사람
    const pos = []; P.forEach((who, i) => (pos[who] = i));
    if (clues.every((c) => clueOk(c, pos, n))) out.push(P);
  }
  return out;
}
function genOrder(R, d) {
  const n = [4, 4, 5, 5, 6][d - 1];
  for (let tries = 0; tries < 60; tries++) {
    const P = R.shuffle(range(n)); const pos = []; P.forEach((w, i) => (pos[w] = i));
    const pool = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) {
      if (pos[a] < pos[b]) pool.push({ k: "before", a, b });
      if (pos[a] === pos[b] + 1) pool.push({ k: "next", a, b });
      if (a < b && Math.abs(pos[a] - pos[b]) - 1 >= 1) pool.push({ k: "gap", a, b, g: Math.abs(pos[a] - pos[b]) - 1 });
    }
    for (let a = 0; a < n; a++) {
      if (d <= 2) pool.push({ k: "pos", a, p: pos[a] });
      for (let p = 0; p < n; p++) if (p !== pos[a]) pool.push({ k: "notpos", a, p });
      if (pos[a] !== 0 && pos[a] !== n - 1) pool.push({ k: "notedge", a });
    }
    const w = (c) => (c.k === "pos" ? (d <= 1 ? 1 : 0.3) : c.k === "before" ? 1.2 : c.k === "notpos" ? 0.6 : 1);
    const pickW = () => { const tot = pool.reduce((s, c) => s + w(c), 0); let x = R() * tot; for (const c of pool) { x -= w(c); if (x <= 0) return c; } return pool[pool.length - 1]; };
    let clues = [];
    for (let k = 0; k < 40; k++) {
      const c = pickW();
      if (clues.includes(c)) continue;
      clues.push(c);
      if (orderSolutions(n, clues).length === 1) break;
    }
    if (orderSolutions(n, clues).length !== 1) continue;
    for (const c of R.shuffle(clues.slice())) { const rest = clues.filter((x) => x !== c); if (orderSolutions(n, rest).length === 1) clues = rest; }
    if (clues.length > [4, 5, 6, 7, 8][d - 1] + 1) continue;
    const start = R.shuffle(range(n));
    if (same(start, P)) continue;
    return { view: { n, clues: R.shuffle(clues), start, q: R.pick(["race", "line"]) }, key: P, exp: { order: P }, hint: { first: P[0] } };
  }
  throw new Error("order gen");
}

// =========================================================
// 7) 자물쇠 추리 (미스터리 자물쇠 다이얼) — 단서: 추측 숫자 + (자리까지 맞은 개수 A, 숫자만 맞은 개수 B)
// =========================================================
function lockFb(code, g) { let a = 0, b = 0; g.forEach((x, i) => { if (code[i] === x) a++; else if (code.includes(x)) b++; }); return [a, b]; }
function allCodes(m) { const out = []; const rec = (a) => { if (a.length === m) { out.push(a.slice()); return; } for (let x = 0; x < 10; x++) if (!a.includes(x)) { a.push(x); rec(a); a.pop(); } }; rec([]); return out; }
const CODES = { 3: null, 4: null };
export function lockSolutions(m, clues) {
  if (!CODES[m]) CODES[m] = allCodes(m);
  return CODES[m].filter((c) => clues.every((k) => { const [a, b] = lockFb(c, k.g); return a === k.a && b === k.b; }));
}
function genLock(R, d) {
  const m = d <= 3 ? 3 : 4;
  const maxClues = [5, 5, 5, 6, 6][d - 1];
  for (let tries = 0; tries < 80; tries++) {
    const code = R.shuffle(range(10)).slice(0, m);
    let clues = [];
    let zeroUsed = false;
    for (let k = 0; k < 60 && clues.length < 10; k++) {
      // 정답과 1~2개 겹치는 추측을 주로 (정보가 있는 단서)
      const g = R.shuffle(range(10)).slice(0, m);
      const [a, b] = lockFb(code, g);
      if (a + b === 0) { if (zeroUsed) continue; zeroUsed = true; }
      if (a + b >= m) continue;
      if (clues.some((c) => same(c.g, g))) continue;
      clues.push({ g, a, b });
      if (lockSolutions(m, clues).length === 1) break;
    }
    if (lockSolutions(m, clues).length !== 1) continue;
    for (const c of R.shuffle(clues.slice())) { const rest = clues.filter((x) => x !== c); if (lockSolutions(m, rest).length === 1) clues = rest; }
    if (clues.length > maxClues || clues.length < 3) continue;
    return { view: { m, clues: R.shuffle(clues) }, key: code, exp: { code }, hint: { pos: 0, digit: code[0] } };
  }
  throw new Error("lock gen");
}

// =========================================================
// 8) 저울 추리 (미스터리 천칭) — 무거운 가짜 1개, 저울질은 서버가 대답 (정답이 화면에 없음)
// 정답 조건: 저울질 결과만으로 가짜가 하나로 좁혀졌고 그걸 고름 (찍기 방지)
// =========================================================
const SCALE_P = [[3, 1], [6, 2], [9, 2], [8, 2], [12, 3]];
function genScale(R, d) {
  const [n, k] = SCALE_P[d - 1];
  const heavy = R.int(1, n);
  return { view: { n, maxW: k }, key: heavy, exp: { heavy, n, k }, hint: { n, k }, secret: { heavy } };
}
export function scaleWeigh(item, st, L, Rt) {
  const n = item.view.n;
  const ok = (a) => Array.isArray(a) && a.length >= 1 && a.length <= n && a.every((x) => isInt(x) && x >= 1 && x <= n) && new Set(a).size === a.length;
  if (!ok(L) || !ok(Rt) || L.some((x) => Rt.includes(x))) return { ok: false, error: "BAD_WEIGH" };
  st.w = st.w || [];
  if (st.w.length >= item.view.maxW) return { ok: false, error: "NO_WEIGH_LEFT" };
  const h = item.key;
  const wl = L.length + (L.includes(h) ? 0.5 : 0), wr = Rt.length + (Rt.includes(h) ? 0.5 : 0);
  const res = wl > wr ? "L" : wl < wr ? "R" : "=";
  st.w.push({ L: L.slice(), R: Rt.slice(), res });
  return { ok: true, res, left: item.view.maxW - st.w.length };
}
export function scaleCandidates(n, ws) {
  const out = [];
  for (let h = 1; h <= n; h++) {
    if ((ws || []).every((w) => {
      const wl = w.L.length + (w.L.includes(h) ? 0.5 : 0), wr = w.R.length + (w.R.includes(h) ? 0.5 : 0);
      return (wl > wr ? "L" : wl < wr ? "R" : "=") === w.res;
    })) out.push(h);
  }
  return out;
}

// =========================================================
// 9) 도형 회전 (미스터리 '그림 조합' 회전 조각) — 폴리오미노
// =========================================================
const norm = (cells) => { const mr = Math.min(...cells.map((c) => c[0])), mc = Math.min(...cells.map((c) => c[1])); return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const rot90 = (cells) => norm(cells.map(([r, c]) => [c, -r]));
const flipH = (cells) => norm(cells.map(([r, c]) => [r, -c]));
const keyCells = (cells) => norm(cells).map((x) => x.join(",")).join(";");
function rotations(cells) { const out = []; let c = norm(cells); for (let i = 0; i < 4; i++) { out.push(c); c = rot90(c); } return out; }
function growPoly(R, k) {
  const cells = [[0, 0]]; const has = (r, c) => cells.some((x) => x[0] === r && x[1] === c);
  while (cells.length < k) {
    const [r, c] = R.pick(cells); const [dr, dc] = R.pick([[0, 1], [1, 0], [0, -1], [-1, 0]]);
    if (!has(r + dr, c + dc)) cells.push([r + dr, c + dc]);
  }
  return norm(cells);
}
function genRotate(R, d) {
  const k = [6, 7, 7, 8, 9][d - 1];
  for (let tries = 0; tries < 200; tries++) {
    const shape = growPoly(R, k);
    const rots = rotations(shape), rk = new Set(rots.map(keyCells));
    if (rk.size < 4) continue;   // 돌려도 같은 모양이 있으면 헷갈림
    const mir = rotations(flipH(shape));
    if (mir.some((m) => rk.has(keyCells(m)))) continue;   // 거울상 = 회전상이면 안 됨
    const turn = R.int(1, 3);
    const ans = rots[turn];
    const opts = [ans]; const seen = new Set([keyCells(ans)]);
    const decoys = [];
    const askTurn = d >= 3;
    if (askTurn) for (const r of R.shuffle(rots)) if (keyCells(r) !== keyCells(ans)) decoys.push(r);   // 다른 각도
    if (d >= 2) for (const m of R.shuffle(mir)) decoys.push(m);
    for (let j = 0; j < 30; j++) {   // 한 칸 옮긴 모양
      const c = shape.map((x) => x.slice()); const i = R.int(0, k - 1);
      const [r0, c0] = R.pick(c.filter((_, q) => q !== i)); const [dr, dc] = R.pick([[0, 1], [1, 0], [0, -1], [-1, 0]]);
      if (c.some((x) => x[0] === r0 + dr && x[1] === c0 + dc)) continue;
      c[i] = [r0 + dr, c0 + dc];
      const nc = norm(c);
      // 연결 확인
      const q = [nc[0]], vis = new Set([nc[0].join()]);
      while (q.length) { const [a, b] = q.pop(); for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) if (nc.some((z) => z[0] === x && z[1] === y) && !vis.has(`${x},${y}`)) { vis.add(`${x},${y}`); q.push([x, y]); } }
      if (vis.size !== k) continue;
      decoys.push(rotations(nc)[R.int(0, 3)]);
    }
    for (const dcy of decoys) {
      if (opts.length >= 4) break;
      const kk = keyCells(dcy);
      if (seen.has(kk) || (!askTurn && rk.has(kk))) continue;
      seen.add(kk); opts.push(dcy);
    }
    if (opts.length < 4) continue;
    const order = R.shuffle(range(4));
    return { view: { shape, opts: order.map((i) => opts[i]), q: askTurn ? "turn" : "same", turn: askTurn ? turn : null }, key: order.indexOf(0), exp: { turn }, hint: { mirrorTrap: d >= 2 } };
  }
  throw new Error("rotate gen");
}

// =========================================================
// 10) 회로 연결 (미스터리 배전함) — 전원에서 모든 전구까지 불 켜기
// =========================================================
const BIT = { N: 1, E: 2, S: 4, W: 8 };
const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const OPP = { N: "S", E: "W", S: "N", W: "E" };
export const rotMask = (m, k) => { let r = m & 15; for (let i = 0; i < ((k % 4) + 4) % 4; i++) r = ((r << 1) | (r >> 3)) & 15; return r; };
export function circuitLit(view, rot) {
  const { size, tiles } = view;
  const mask = tiles.map((row, r) => row.map((t, c) => (t.src ? t.m : rotMask(t.m, rot?.[r]?.[c] | 0))));
  let src = null; tiles.forEach((row, r) => row.forEach((t, c) => { if (t.src) src = [r, c]; }));
  const seen = new Set([src.join()]); const q = [src];
  while (q.length) {
    const [r, c] = q.shift();
    for (const d of Object.keys(DIRS)) {
      if (!(mask[r][c] & BIT[d])) continue;
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      if (nr < 0 || nc < 0 || nr >= size || nc >= size || !(mask[nr][nc] & BIT[OPP[d]])) continue;
      if (!seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); q.push([nr, nc]); }
    }
  }
  let bulbs = 0, on = 0;
  tiles.forEach((row, r) => row.forEach((t, c) => { if (t.bulb) { bulbs++; if (seen.has(`${r},${c}`)) on++; } }));
  return { seen, bulbs, on, solved: bulbs > 0 && on === bulbs };
}
function genCircuit(R, d) {
  const size = [4, 4, 5, 5, 6][d - 1];
  for (let tries = 0; tries < 50; tries++) {
    const m = range(size).map(() => Array(size).fill(0));
    const sr = R.int(0, size - 1), sc = R.int(0, size - 1);
    const vis = new Set([`${sr},${sc}`]); const stack = [[sr, sc]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const nb = R.shuffle(Object.keys(DIRS)).filter((dd) => { const nr = r + DIRS[dd][0], nc = c + DIRS[dd][1]; return nr >= 0 && nc >= 0 && nr < size && nc < size && !vis.has(`${nr},${nc}`); });
      if (!nb.length) { stack.pop(); continue; }
      const dd = nb[0]; const nr = r + DIRS[dd][0], nc = c + DIRS[dd][1];
      m[r][c] |= BIT[dd]; m[nr][nc] |= BIT[OPP[dd]];
      vis.add(`${nr},${nc}`); stack.push([nr, nc]);
    }
    const tiles = m.map((row, r) => row.map((mm, c) => {
      const isSrc = r === sr && c === sc;
      const deg = [1, 2, 4, 8].filter((b) => mm & b).length;
      return { m: mm, src: isSrc || undefined, bulb: !isSrc && deg === 1 ? true : undefined };
    }));
    const rot = tiles.map((row) => row.map((t) => (t.src ? 0 : R.int(0, 3))));
    // 화면용 시작 모양 = 정답을 돌려 놓은 것 → view.m 은 섞인 모양, 정답 회전은 key
    const view = { size, tiles: tiles.map((row, r) => row.map((t, c) => ({ m: t.src ? t.m : rotMask(t.m, rot[r][c]), src: t.src, bulb: t.bulb }))) };
    if (circuitLit(view, null).solved) continue;
    const bulbs = tiles.flat().filter((t) => t.bulb).length;
    if (bulbs < 2) continue;
    const keyRot = rot.map((row, r) => row.map((k, c) => (tiles[r][c].src ? 0 : (4 - k) % 4)));
    return { view, key: keyRot, exp: { bulbs }, hint: { r: sr, c: sc } };
  }
  throw new Error("circuit gen");
}

// =========================================================
// 11) 빛과 거울 (미스터리 P12)
// =========================================================
export function traceBeam(view, states) {
  const { w, h, source, target, walls, mirrors } = view;
  const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`));
  const mir = new Map(mirrors.map((m, i) => [`${m.r},${m.c}`, states?.[i] ?? m.s]));
  let r = source.r, c = source.c, d = source.dir;
  const pts = [[r, c]];
  for (let s = 0; s < 200; s++) {
    r += DIRS[d][0]; c += DIRS[d][1];
    if (r < 0 || c < 0 || r >= h || c >= w) { pts.push([r, c]); return { hit: false, pts }; }
    if (wallSet.has(`${r},${c}`)) { pts.push([r, c, "wall"]); return { hit: false, pts }; }
    pts.push([r, c]);
    if (r === target.r && c === target.c) return { hit: true, pts };
    const m = mir.get(`${r},${c}`);
    if (m === "/") d = { E: "N", N: "E", W: "S", S: "W" }[d];
    else if (m === "\\") d = { E: "S", S: "E", W: "N", N: "W" }[d];
  }
  return { hit: false, pts };
}
function genMirror(R, d) {
  const [w, h] = [[5, 4], [6, 5], [6, 5], [7, 6], [7, 6]][d - 1];
  const turns = [2, 2, 3, 4, 4][d - 1];
  for (let tries = 0; tries < 300; tries++) {
    const sr = R.int(0, h - 1);
    let r = sr, c = 0, dir = "E";
    const path = [[r, c]]; const mirrors = [];
    const used = new Set([`${r},${c}`]);
    let ok = true;
    for (let t = 0; t <= turns && ok; t++) {
      const len = t === 0 ? R.int(0, 2) : R.int(1, 3);
      for (let s = 0; s < len; s++) {
        r += DIRS[dir][0]; c += DIRS[dir][1];
        if (r < 0 || c < 0 || r >= h || c >= w || used.has(`${r},${c}`)) { ok = false; break; }
        used.add(`${r},${c}`); path.push([r, c]);
      }
      if (!ok) break;
      if (t < turns) {
        const nd = R.pick(dir === "E" || dir === "W" ? ["N", "S"] : ["E", "W"]);
        const s = ({ E: { N: "/", S: "\\" }, W: { N: "\\", S: "/" }, N: { E: "/", W: "\\" }, S: { E: "\\", W: "/" } })[dir][nd];
        mirrors.push({ r, c, s }); dir = nd;
        // 다음 칸으로 한 칸은 꼭 진행
        r += DIRS[dir][0]; c += DIRS[dir][1];
        if (r < 0 || c < 0 || r >= h || c >= w || used.has(`${r},${c}`)) { ok = false; break; }
        used.add(`${r},${c}`); path.push([r, c]);
      }
    }
    if (!ok || mirrors.length !== turns) continue;
    const target = { r, c };
    if (mirrors.some((m) => m.r === r && m.c === c)) continue;
    const free = [];
    for (let rr = 0; rr < h; rr++) for (let cc = 0; cc < w; cc++) if (!used.has(`${rr},${cc}`)) free.push([rr, cc]);
    const fr = R.shuffle(free);
    const decoyN = [1, 1, 2, 3, 3][d - 1], wallN = [1, 2, 3, 3, 4][d - 1];
    const decoys = fr.slice(0, decoyN).map(([a, b]) => ({ r: a, c: b, s: R.pick(["/", "\\"]) }));
    const walls = fr.slice(decoyN, decoyN + wallN);
    const all = R.shuffle([...mirrors.map((m) => ({ ...m, real: true })), ...decoys]);
    const solution = all.map((m) => m.s);
    const start = all.map((m) => (m.real ? (R() < 0.75 ? (m.s === "/" ? "\\" : "/") : m.s) : R.pick(["/", "\\"])));
    const view = { w, h, source: { r: sr, c: -1, dir: "E" }, target, walls, mirrors: all.map((m, i) => ({ r: m.r, c: m.c, s: start[i] })) };
    if (traceBeam(view, start).hit) continue;
    if (!traceBeam(view, solution).hit) continue;
    if (d >= 3) view.shots = [3, 2, 2][d - 3]; // 어려운 단계: 빛은 '쏘기'로만 보임 (눌러 보며 맞추기 방지)
    return { view, key: solution, exp: { n: mirrors.length }, hint: { first: mirrors[0] } };
  }
  throw new Error("mirror gen");
}

// =========================================================
// 12) 톱니 방향 (미스터리 P05) — 육각 격자 톱니, 이웃이면 맞물림. 벨트(같은 방향/X자 반대)
// =========================================================
const HEX = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export function gearSolve(view) {
  const n = view.gears.length;
  const adj = range(n).map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = view.gears[i], b = view.gears[j];
    if (HEX.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r)) { adj[i].push([j, 1]); adj[j].push([i, 1]); }
  }
  for (const bl of view.belts || []) { const p = bl.cross ? 1 : 0; adj[bl.a].push([bl.b, p]); adj[bl.b].push([bl.a, p]); }
  const dir = Array(n).fill(null); dir[view.driver] = 0;
  const q = [view.driver]; let jam = false;
  while (q.length) {
    const i = q.shift();
    for (const [j, p] of adj[i]) {
      const want = dir[i] ^ p;
      if (dir[j] === null) { dir[j] = want; q.push(j); } else if (dir[j] !== want) jam = true;
    }
  }
  return { jam, dir };
}
function genGears(R, d) {
  const N = [5, 6, 7, 8, 9][d - 1];
  const wantJam = d >= 3 && R() < 0.34;
  for (let tries = 0; tries < 400; tries++) {
    const cells = [[0, 0]];
    const has = (q, r) => cells.some((x) => x[0] === q && x[1] === r);
    let guard = 0;
    while (cells.length < N && guard++ < 600) {
      const [q, r] = R.pick(cells); const [dq, dr] = R.pick(HEX);
      const nq = q + dq, nr = r + dr;
      if (Math.abs(nq) > 3 || Math.abs(nr) > 3 || Math.abs(nq + nr) > 3 || has(nq, nr)) continue;
      // 이른 단계는 삼각형(바로 멈춤) 피하기
      const touch = HEX.filter(([a, b]) => has(nq + a, nr + b)).length;
      if (!wantJam && touch > 1) continue;
      cells.push([nq, nr]);
    }
    if (cells.length < N) continue;   // 자리 못 찾음 → 처음부터
    const gears = cells.map(([q, r]) => ({ q, r }));
    const belts = [];
    if (d >= 3) {
      for (let k = 0; k < 6 && belts.length < (d >= 4 ? 2 : 1); k++) {
        const a = R.int(0, N - 1), b = R.int(0, N - 1);
        const A = gears[a], B = gears[b];
        if (a === b || HEX.some(([x, y]) => A.q + x === B.q && A.r + y === B.r)) continue;
        if (belts.some((bl) => (bl.a === a && bl.b === b) || (bl.a === b && bl.b === a))) continue;
        belts.push({ a, b, cross: R() < 0.5 });
      }
    }
    // 구동 톱니와 목표 톱니는 서로 멀리
    let best = null;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const dd = Math.abs(gears[i].q - gears[j].q) + Math.abs(gears[i].r - gears[j].r) + Math.abs(gears[i].q + gears[i].r - gears[j].q - gears[j].r); if (!best || dd > best[2]) best = [i, j, dd]; }
    const view = { gears, belts, driver: best[0], target: best[1], spin: R.pick(["cw", "ccw"]), opts: d >= 3 ? ["cw", "ccw", "jam"] : ["cw", "ccw"] };
    const sol = gearSolve(view);
    if (sol.dir[view.target] === null) continue;
    if (d >= 3 && sol.jam !== wantJam) continue;
    if (d < 3 && sol.jam) continue;
    const tdir = sol.jam ? "jam" : (sol.dir[view.target] === 0) === (view.spin === "cw") ? "cw" : "ccw";
    return { view, key: view.opts.indexOf(tdir), exp: { ans: tdir, jam: sol.jam }, hint: { rule: "alt" } };
  }
  throw new Error("gears gen");
}

// =========================================================
// 13) 언어 — 낱말 사전 (개념 id → 한/日/英). 화면은 id만 받고 보는 사람 언어로 그림
// =========================================================
export const LEX = {
  // 종류 (A는 B의 한 종류)
  apple: ["사과", "りんご", "apple"], grape: ["포도", "ぶどう", "grape"], banana: ["바나나", "バナナ", "banana"], peach: ["복숭아", "もも", "peach"], pear: ["배", "なし", "pear"], strawberry: ["딸기", "いちご", "strawberry"],
  carrot: ["당근", "にんじん", "carrot"], onion: ["양파", "たまねぎ", "onion"], cabbage: ["양배추", "キャベツ", "cabbage"], potato: ["감자", "じゃがいも", "potato"], spinach: ["시금치", "ほうれん草", "spinach"], cucumber: ["오이", "きゅうり", "cucumber"],
  dog: ["개", "犬", "dog"], cat: ["고양이", "猫", "cat"], cow: ["소", "牛", "cow"], horse: ["말", "馬", "horse"], tiger: ["호랑이", "トラ", "tiger"], rabbit: ["토끼", "うさぎ", "rabbit"], bear: ["곰", "クマ", "bear"],
  sparrow: ["참새", "スズメ", "sparrow"], eagle: ["독수리", "ワシ", "eagle"], penguin: ["펭귄", "ペンギン", "penguin"], owl: ["부엉이", "フクロウ", "owl"], swan: ["백조", "白鳥", "swan"], parrot: ["앵무새", "オウム", "parrot"],
  shark: ["상어", "サメ", "shark"], salmon: ["연어", "サケ", "salmon"], tuna: ["참치", "マグロ", "tuna"], mackerel: ["고등어", "サバ", "mackerel"],
  violin: ["바이올린", "バイオリン", "violin"], guitar: ["기타", "ギター", "guitar"], cello: ["첼로", "チェロ", "cello"], harp: ["하프", "ハープ", "harp"],
  flute: ["플루트", "フルート", "flute"], trumpet: ["트럼펫", "トランペット", "trumpet"], clarinet: ["클라리넷", "クラリネット", "clarinet"], saxophone: ["색소폰", "サックス", "saxophone"],
  bus: ["버스", "バス", "bus"], train: ["기차", "電車", "train"], taxi: ["택시", "タクシー", "taxi"], bicycle: ["자전거", "自転車", "bicycle"], truck: ["트럭", "トラック", "truck"],
  airplane: ["비행기", "飛行機", "airplane"], helicopter: ["헬리콥터", "ヘリコプター", "helicopter"], balloon: ["열기구", "熱気球", "hot-air balloon"], glider: ["글라이더", "グライダー", "glider"],
  soccer: ["축구", "サッカー", "soccer"], tennis: ["테니스", "テニス", "tennis"], baseball: ["야구", "野球", "baseball"], swimming: ["수영", "水泳", "swimming"], skiing: ["스키", "スキー", "skiing"],
  red: ["빨강", "赤", "red"], blue: ["파랑", "青", "blue"], green: ["초록", "緑", "green"], yellow: ["노랑", "黄色", "yellow"], purple: ["보라", "紫", "purple"],
  chair: ["의자", "椅子", "chair"], desk: ["책상", "机", "desk"], sofa: ["소파", "ソファ", "sofa"], bed: ["침대", "ベッド", "bed"], wardrobe: ["옷장", "タンス", "wardrobe"],
  rose: ["장미", "バラ", "rose"], tulip: ["튤립", "チューリップ", "tulip"], sunflower: ["해바라기", "ひまわり", "sunflower"], lily: ["백합", "ユリ", "lily"],
  fruit: ["과일", "果物", "fruit"], vegetable: ["채소", "野菜", "vegetable"], mammal: ["포유류", "哺乳類", "mammal"], bird: ["새", "鳥", "bird"], fish: ["물고기", "魚", "fish"], instrument: ["악기", "楽器", "instrument"], vehicle: ["탈것", "乗り物", "vehicle"], sport: ["운동", "スポーツ", "sport"], color: ["색", "色", "color"], furniture: ["가구", "家具", "furniture"], flower: ["꽃", "花", "flower"],
  // 새끼
  puppy: ["강아지", "子犬", "puppy"], kitten: ["새끼 고양이", "子猫", "kitten"], calf: ["송아지", "子牛", "calf"], foal: ["망아지", "子馬", "foal"], chick: ["병아리", "ひよこ", "chick"], hen: ["닭", "ニワトリ", "chicken"], frog: ["개구리", "カエル", "frog"], tadpole: ["올챙이", "オタマジャクシ", "tadpole"], butterfly: ["나비", "チョウ", "butterfly"], caterpillar: ["애벌레", "イモムシ", "caterpillar"],
  // 반대말
  hot: ["뜨겁다", "熱い", "hot"], cold: ["차갑다", "冷たい", "cold"], tall: ["높다", "高い", "high"], low: ["낮다", "低い", "low"], fast: ["빠르다", "速い", "fast"], slow: ["느리다", "遅い", "slow"], heavy: ["무겁다", "重い", "heavy"], light: ["가볍다", "軽い", "light"], bright: ["밝다", "明るい", "bright"], dark: ["어둡다", "暗い", "dark"], wide: ["넓다", "広い", "wide"], narrow: ["좁다", "狭い", "narrow"], full: ["가득하다", "満ちた", "full"], empty: ["비다", "空っぽ", "empty"], early: ["이르다", "早い", "early"], late: ["늦다", "遅れた", "late"],
  // 일하는 곳
  doctor: ["의사", "医者", "doctor"], hospital: ["병원", "病院", "hospital"], teacher: ["교사", "教師", "teacher"], school: ["학교", "学校", "school"], chef: ["요리사", "料理人", "chef"], kitchen: ["주방", "厨房", "kitchen"], pilot: ["조종사", "パイロット", "pilot"], cockpit: ["조종석", "操縦席", "cockpit"], firefighter: ["소방관", "消防士", "firefighter"], firestation: ["소방서", "消防署", "fire station"], farmer: ["농부", "農家", "farmer"], farm: ["농장", "農場", "farm"], judge: ["판사", "裁判官", "judge"], court: ["법원", "裁判所", "court"], librarian: ["사서", "司書", "librarian"], library: ["도서관", "図書館", "library"],
  // 도구 — 사용하는 사람
  brush: ["붓", "絵筆", "paintbrush"], painter: ["화가", "画家", "painter"], stethoscope: ["청진기", "聴診器", "stethoscope"], hammer: ["망치", "金づち", "hammer"], carpenter: ["목수", "大工", "carpenter"], scissors: ["가위", "はさみ", "scissors"], barber: ["미용사", "美容師", "hairdresser"], needle: ["바늘", "針", "needle"], tailor: ["재단사", "仕立て屋", "tailor"], baton: ["지휘봉", "指揮棒", "baton"], conductor: ["지휘자", "指揮者", "conductor"],
  // 부분 — 전체
  wheel: ["바퀴", "車輪", "wheel"], car: ["자동차", "自動車", "car"], wing: ["날개", "翼", "wing"], leaf: ["잎", "葉", "leaf"], tree: ["나무", "木", "tree"], page: ["쪽(페이지)", "ページ", "page"], book: ["책", "本", "book"], key: ["건반", "鍵盤", "key"], piano: ["피아노", "ピアノ", "piano"], finger: ["손가락", "指", "finger"], hand: ["손", "手", "hand"], lens: ["렌즈", "レンズ", "lens"], camera: ["카메라", "カメラ", "camera"],
  // 재료 — 만든 것
  bread: ["빵", "パン", "bread"], flour: ["밀가루", "小麦粉", "flour"], cheese: ["치즈", "チーズ", "cheese"], milk: ["우유", "牛乳", "milk"], wine: ["와인", "ワイン", "wine"], tofu: ["두부", "豆腐", "tofu"], soybean: ["콩", "大豆", "soybean"], paper: ["종이", "紙", "paper"], wood: ["나무(목재)", "木材", "wood"], glass: ["유리", "ガラス", "glass"], sand: ["모래", "砂", "sand"], jam: ["잼", "ジャム", "jam"],
};
// 관계: [쌍들, 이름]  (A→B)
const REL = {
  kind: [["apple", "fruit"], ["carrot", "vegetable"], ["tiger", "mammal"], ["eagle", "bird"], ["shark", "fish"], ["violin", "instrument"], ["bus", "vehicle"], ["tennis", "sport"], ["purple", "color"], ["sofa", "furniture"], ["rose", "flower"], ["strawberry", "fruit"], ["onion", "vegetable"], ["owl", "bird"], ["salmon", "fish"], ["trumpet", "instrument"]],
  young: [["dog", "puppy"], ["cat", "kitten"], ["cow", "calf"], ["horse", "foal"], ["hen", "chick"], ["frog", "tadpole"], ["butterfly", "caterpillar"]],
  opposite: [["hot", "cold"], ["tall", "low"], ["fast", "slow"], ["heavy", "light"], ["bright", "dark"], ["wide", "narrow"], ["full", "empty"], ["early", "late"]],
  workplace: [["doctor", "hospital"], ["teacher", "school"], ["chef", "kitchen"], ["pilot", "cockpit"], ["firefighter", "firestation"], ["farmer", "farm"], ["judge", "court"], ["librarian", "library"]],
  tool: [["brush", "painter"], ["stethoscope", "doctor"], ["hammer", "carpenter"], ["scissors", "barber"], ["needle", "tailor"], ["baton", "conductor"]],
  part: [["wheel", "car"], ["wing", "bird"], ["leaf", "tree"], ["page", "book"], ["key", "piano"], ["finger", "hand"], ["lens", "camera"]],
  material: [["bread", "flour"], ["cheese", "milk"], ["wine", "grape"], ["tofu", "soybean"], ["book", "paper"], ["glass", "sand"], ["jam", "strawberry"], ["desk", "wood"]],
};
const REL_BY_D = [["kind", "opposite", "young"], ["young", "workplace", "part"], ["workplace", "tool", "part", "material"], ["tool", "material", "part"], ["tool", "material"]];
function genAnalogy(R, d) {
  for (let tries = 0; tries < 100; tries++) {
    const rel = R.pick(REL_BY_D[d - 1]);
    const pairs = R.shuffle(REL[rel]);
    const [a, b] = pairs[0], [c, ans] = pairs[1];
    if (a === c || b === ans) continue;
    // 오답: 같은 관계의 다른 B (그럴듯) + C와 다른 관계로 엮인 낱말 (헷갈리게)
    const pool = [];
    for (const [x, y] of REL[rel]) if (y !== ans && x !== c && y !== b) pool.push(y);
    for (const r2 of Object.keys(REL)) if (r2 !== rel) for (const [x, y] of REL[r2]) { if (x === c && y !== ans) pool.push(y); if (y === c && x !== ans) pool.push(x); }
    const opts = [ans]; for (const w of R.shuffle(pool)) { if (opts.length >= 4) break; if (!opts.includes(w) && w !== c && w !== a && w !== b) opts.push(w); }
    if (opts.length < 4) continue;
    const order = R.shuffle(range(4));
    return { view: { a, b, c, opts: order.map((i) => opts[i]) }, key: order.indexOf(0), exp: { rel, ans }, hint: { rel } };
  }
  throw new Error("analogy gen");
}
const CAT = {
  fruit: ["apple", "grape", "banana", "peach", "pear", "strawberry"], vegetable: ["carrot", "onion", "cabbage", "potato", "spinach", "cucumber"],
  mammal: ["dog", "cat", "cow", "horse", "tiger", "rabbit", "bear"], bird: ["sparrow", "eagle", "penguin", "owl", "swan", "parrot"], fish: ["shark", "salmon", "tuna", "mackerel"],
  strings: ["violin", "guitar", "cello", "harp"], winds: ["flute", "trumpet", "clarinet", "saxophone"],
  land: ["bus", "train", "taxi", "bicycle", "truck"], air: ["airplane", "helicopter", "balloon", "glider"],
  ball: ["soccer", "tennis", "baseball"], color: ["red", "blue", "green", "yellow", "purple"], furniture: ["chair", "desk", "sofa", "bed", "wardrobe"], flower: ["rose", "tulip", "sunflower", "lily"],
};
const CAT_FAR = [["fruit", "furniture"], ["mammal", "color"], ["flower", "land"], ["vegetable", "air"], ["color", "fruit"], ["furniture", "bird"]];
const CAT_NEAR = [["fruit", "vegetable"], ["vegetable", "fruit"], ["mammal", "bird"], ["bird", "mammal"], ["bird", "fish"], ["strings", "winds"], ["winds", "strings"], ["land", "air"], ["air", "land"], ["fish", "mammal"]];
function genOddword(R, d) {
  const n = d <= 1 ? 4 : 5;
  const [main, other] = R.pick(d <= 1 ? CAT_FAR.concat(CAT_NEAR.slice(0, 2)) : CAT_NEAR);
  const words = R.shuffle(CAT[main]).slice(0, n - 1);
  const odd = R.pick(CAT[other]);
  const all = R.shuffle([...words, odd]);
  return { view: { words: all }, key: all.indexOf(odd), exp: { main, other, odd }, hint: { main } };
}

// =========================================================
// 14) 삼단 논법 (미스터리 '알리바이 표' 논리) — 벤 다이어그램 8구역 전부 따져서 판정
// 명제: {f:"A"|"E"|"I"|"O", x, y}  A 모든 x는 y · E 어떤 x도 y가 아님 · I 어떤 x는 y · O 어떤 x는 y가 아님
// =========================================================
function propHolds(p, model) {   // model: 8구역 비어있음 여부(bit i = 구역 i에 원소 있음). 구역 i: bit0=집합0, bit1=집합1, bit2=집합2
  const inX = (i) => (i >> p.x) & 1, inY = (i) => (i >> p.y) & 1;
  const regions = range(8).filter((i) => (model >> i) & 1);
  if (p.f === "A") return regions.every((i) => !inX(i) || inY(i));
  if (p.f === "E") return regions.every((i) => !(inX(i) && inY(i)));
  if (p.f === "I") return regions.some((i) => inX(i) && inY(i));
  if (p.f === "O") return regions.some((i) => inX(i) && !inY(i));
  return false;
}
export function syllogismVerdict(premises, concl) {
  let t = 0, f = 0;
  for (let model = 1; model < 256; model++) {
    const regions = range(8).filter((i) => (model >> i) & 1);
    if (![0, 1, 2].every((s) => regions.some((i) => (i >> s) & 1))) continue;   // 세 무리 모두 하나 이상 있음
    if (!premises.every((p) => propHolds(p, model))) continue;
    if (propHolds(concl, model)) t++; else f++;
  }
  if (t + f === 0) return null;
  return f === 0 ? "true" : t === 0 ? "false" : "unknown";
}
function genSyllogism(R, d) {
  const want = R.pick(["true", "false", "unknown"]);
  const forms = d <= 1 ? ["A", "E", "I", "O"] : ["A", "E", "I", "O", "O"];
  for (let tries = 0; tries < 500; tries++) {
    const prem = [{ f: R.pick(forms), x: 0, y: 1 }, { f: R.pick(forms), x: 1, y: 2 }];
    if (R() < 0.5) { const t = prem[1].x; prem[1].x = prem[1].y; prem[1].y = t; }
    if (d >= 3 && R() < (d >= 4 ? 0.8 : 0.5)) prem.push({ f: R.pick(forms), x: R.pick([0, 2]), y: 1 });
    const concl = { f: R.pick(["A", "E", "I", "O"]), x: R.pick([0, 2]), y: 0 }; concl.y = concl.x === 0 ? 2 : 0;
    const v = syllogismVerdict(prem, concl);
    if (v !== want) continue;
    const words = R.shuffle(range(8)).slice(0, 3);   // 꾸민 낱말 번호 (화면이 언어별로)
    return { view: { prem, concl, words, opts: ["true", "false", "unknown"] }, key: ["true", "false", "unknown"].indexOf(v), exp: { v }, hint: { v: v === "unknown" ? "unknown" : "draw" } };
  }
  throw new Error("syllogism gen");
}

// =========================================================
// 15) 기억 — 종소리(미스터리 H1) · 숫자 거꾸로 · 칸 위치
// =========================================================
function genBells(R, d) {
  const L = [4, 5, 6, 7, 8][d - 1], bells = d <= 3 ? 5 : 6;
  const seq = [];
  while (seq.length < L) { const x = R.int(1, bells); if (seq.length >= 2 && seq[seq.length - 1] === x && seq[seq.length - 2] === x) continue; seq.push(x); }
  return { view: { bells, seq, gap: [700, 650, 600, 560, 520][d - 1] }, key: seq, exp: { seq }, hint: null };
}
function genSpan(R, d) {
  const L = [4, 5, 5, 6, 7][d - 1], back = d >= 3;
  const dg = []; while (dg.length < L) { const x = R.int(0, 9); if (dg[dg.length - 1] === x) continue; dg.push(x); }
  return { view: { digits: dg, back, ms: 900 }, key: back ? dg.slice().reverse() : dg, exp: { digits: dg, back }, hint: null };
}
function genGridmem(R, d) {
  const size = d <= 2 ? 4 : 5, k = [4, 5, 6, 7, 8][d - 1];
  const cells = R.shuffle(range(size * size)).slice(0, k).sort((a, b) => a - b);
  return { view: { size, cells, ms: 2200 }, key: cells, exp: { cells }, hint: null };
}

// =========================================================
// 16) 블록 탈출 (미스터리 P02 슬라이딩) — 6×6, 출구 = 2행 오른쪽
// piece: {id, r, c, len, dir:"h"|"v"} · 목표 조각 id 0 (가로, 2행)
// =========================================================
const SW = 6, SH = 6, EXIT = 2;
function slideKey(ps) { return ps.map((p) => (p.dir === "h" ? p.c : p.r)).join(","); }
function slideOcc(ps) { const g = range(SH).map(() => Array(SW).fill(-1)); for (const p of ps) for (let i = 0; i < p.len; i++) { const r = p.dir === "v" ? p.r + i : p.r, c = p.dir === "h" ? p.c + i : p.c; g[r][c] = p.id; } return g; }
function slideMovesFrom(ps) {
  const g = slideOcc(ps), out = [];
  ps.forEach((p, i) => {
    for (const s of [-1, 1]) {
      for (let k = 1; k < 6; k++) {
        const r = p.dir === "v" ? (s < 0 ? p.r - k : p.r + p.len - 1 + k) : p.r;
        const c = p.dir === "h" ? (s < 0 ? p.c - k : p.c + p.len - 1 + k) : p.c;
        if (r < 0 || c < 0 || r >= SH || c >= SW || g[r][c] !== -1) break;
        const np = ps.map((q) => ({ ...q }));
        if (p.dir === "h") np[i].c += s * k; else np[i].r += s * k;
        out.push(np);
      }
    }
  });
  return out;
}
const slideSolved = (ps) => ps[0].c + ps[0].len === SW;
export function slideOptimal(start, cap = 25000) {
  const seen = new Map([[slideKey(start), 0]]); let frontier = [start];
  for (let depth = 0; frontier.length; depth++) {
    const next = [];
    for (const s of frontier) {
      if (slideSolved(s)) return depth;
      for (const n of slideMovesFrom(s)) { const k = slideKey(n); if (!seen.has(k)) { seen.set(k, depth + 1); next.push(n); if (seen.size > cap) return -1; } }
    }
    frontier = next;
  }
  return Infinity;
}
// 어려운 블록 탈출은 미리 만든 문제은행에서 꺼냄 (서버가 setSlideBank로 넣어 줌 — 생성이 1초 넘게 걸릴 수 있어서)
let SLIDE_BANK = null;
export function setSlideBank(b) { SLIDE_BANK = b; }
export function slideFromBank(row) { const [opt, ...nums] = row; const ps = []; for (let i = 0; i < nums.length; i += 4) ps.push({ id: i / 4, r: nums[i], c: nums[i + 1], len: nums[i + 2], dir: nums[i + 3] ? "v" : "h" }); return { ps, opt }; }
export function genSlideRaw(R, d, tries = 60) { return genSlideInner(R, d, tries); }
function genSlide(R, d) {
  if (d >= 3 && SLIDE_BANK?.[d]?.length) {
    const { ps, opt } = slideFromBank(SLIDE_BANK[d][Math.floor(R() * SLIDE_BANK[d].length)]);
    // 좌우 뒤집기 없이 그대로 (출구가 오른쪽 고정)
    return { view: { w: SW, h: SH, exitRow: EXIT, pieces: ps }, key: opt, exp: { opt }, hint: { opt } };
  }
  return genSlideInner(R, d, d >= 3 ? 12 : 60);
}
function genSlideInner(R, d, maxTries) {
  const want = [[2, 4], [4, 6], [6, 9], [8, 12], [11, 30]][d - 1];
  const nPieces = [5, 7, 8, 9, 10][d - 1];
  let best = null;
  for (let tries = 0; tries < maxTries; tries++) {
    const ps = [{ id: 0, r: EXIT, c: R.int(0, 2), len: 2, dir: "h" }];
    for (let k = 0; k < 80 && ps.length < nPieces + 1; k++) {
      const dir = R.pick(["h", "v"]), len = R() < 0.25 ? 3 : 2;
      const r = dir === "v" ? R.int(0, SH - len) : R.int(0, SH - 1), c = dir === "h" ? R.int(0, SW - len) : R.int(0, SW - 1);
      if (dir === "h" && r === EXIT) continue;
      const p = { id: ps.length, r, c, len, dir };
      const g = slideOcc(ps); let ok = true;
      for (let i = 0; i < len; i++) { const rr = dir === "v" ? r + i : r, cc = dir === "h" ? c + i : c; if (g[rr][cc] !== -1) ok = false; }
      if (ok) ps.push(p);
    }
    // 출구 쪽을 무언가가 막고 있어야 재미있음
    const opt = slideOptimal(ps, maxTries > 100 ? 60000 : 12000);
    if (opt < 0 || !Number.isFinite(opt) || opt === 0) continue;
    if (opt >= want[0] && opt <= want[1]) return { view: { w: SW, h: SH, exitRow: EXIT, pieces: ps }, key: opt, exp: { opt }, hint: { opt } };
    if (!best || Math.abs(opt - want[0]) < Math.abs(best.opt - want[0])) best = { ps, opt };
  }
  if (best) return { view: { w: SW, h: SH, exitRow: EXIT, pieces: best.ps }, key: best.opt, exp: { opt: best.opt }, hint: { opt: best.opt } };
  throw new Error("slide gen");
}
export function slideReplay(view, moves) {
  let ps = view.pieces.map((p) => ({ ...p }));
  if (!Array.isArray(moves) || moves.length > 400) return { ok: false };
  for (const mv of moves) {
    const p = ps.find((q) => q.id === mv?.id); const dd = Number(mv?.d);
    if (!p || !isInt(dd) || dd === 0 || Math.abs(dd) > 5) return { ok: false };
    for (let k = 0; k < Math.abs(dd); k++) {
      const s = Math.sign(dd); const g = slideOcc(ps);
      const r = p.dir === "v" ? (s < 0 ? p.r - 1 : p.r + p.len) : p.r, c = p.dir === "h" ? (s < 0 ? p.c - 1 : p.c + p.len) : p.c;
      if (r < 0 || c < 0 || r >= SH || c >= SW || g[r][c] !== -1) return { ok: false };
      if (p.dir === "h") p.c += s; else p.r += s;
    }
  }
  return { ok: true, solved: slideSolved(ps), n: moves.length };
}

// =========================================================
// 17) 지도 길찾기 (미스터리 지도 동선) — 별을 모두 지나 도착, 걸음 수 제한. 같은 칸 다시 지나기 없음
// =========================================================
function genPath(R, d) {
  const size = [5, 6, 7, 8, 8][d - 1], stars = [1, 2, 3, 4, 5][d - 1], slack = [2, 1, 1, 0, 0][d - 1], minOpt = [5, 8, 12, 18, 22][d - 1];
  for (let tries = 0; tries < 3000; tries++) { // 조건이 까다로워 못 만들면 조금씩 풀어 줌 (문제가 안 만들어지는 일은 없어야 함)
    const relax = tries < 1000 ? 0 : tries < 2000 ? 1 : 2, starsN = Math.max(1, stars - relax), needOpt = Math.max(size, minOpt - relax * 4);
    const g = range(size).map(() => Array(size).fill("."));
    const free = R.shuffle(range(size * size));
    const at = (i) => [Math.floor(i / size), i % size];
    const [sr, sc] = at(free[0]), [tr2, tc] = at(free[1]);
    if (Math.abs(sr - tr2) + Math.abs(sc - tc) < size - 1) continue;
    g[sr][sc] = "S"; g[tr2][tc] = "T";
    const st = free.slice(2, 2 + starsN).map(at); st.forEach(([r, c]) => (g[r][c] = "*"));
    const wallN = Math.floor(size * size * [0.18, 0.2, 0.22, 0.24, 0.26][d - 1]);
    free.slice(2 + starsN, 2 + starsN + wallN).map(at).forEach(([r, c]) => (g[r][c] = "#"));
    // (칸, 모은 별) BFS — 경로 복원해서 같은 칸을 다시 지나지 않는지 확인
    const sIdx = (r, c) => st.findIndex(([a, b]) => a === r && b === c);
    const full = (1 << starsN) - 1;
    const key = (r, c, m) => `${r},${c},${m}`;
    const prev = new Map([[key(sr, sc, 0), null]]); let q = [[sr, sc, 0]]; let end = null;
    for (let dep = 0; q.length && !end; dep++) {
      const nq = [];
      for (const [r, c, m] of q) {
        if (r === tr2 && c === tc && m === full) { end = [r, c, m, dep]; break; }
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= size || nc >= size || g[nr][nc] === "#") continue;
          if (g[r][c] === "T") continue;
          const si = sIdx(nr, nc); const nm = si >= 0 ? m | (1 << si) : m;
          const k = key(nr, nc, nm); if (prev.has(k)) continue;
          prev.set(k, key(r, c, m)); nq.push([nr, nc, nm]);
        }
      }
      q = nq;
    }
    if (!end) continue;
    const route = []; let k = key(end[0], end[1], end[2]);
    while (k) { const [r, c] = k.split(",").map(Number); route.unshift([r, c]); k = prev.get(k); }
    if (new Set(route.map((x) => x.join())).size !== route.length) continue;
    const opt = route.length - 1;
    if (opt < needOpt) continue;
    return { view: { grid: g.map((row) => row.join("")), maxSteps: opt + slack }, key: opt, exp: { opt, route }, hint: { first: route.slice(0, 3) } };
  }
  throw new Error("path gen");
}
export function pathCheck(view, path) {
  const g = view.grid, size = g.length;
  if (!Array.isArray(path) || path.length < 2 || path.length > size * size) return false;
  const cell = (p) => (Array.isArray(p) && isInt(p[0]) && isInt(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < size && p[1] < size ? g[p[0]][p[1]] : null);
  if (cell(path[0]) !== "S" || cell(path[path.length - 1]) !== "T") return false;
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const ch = cell(path[i]); if (!ch || ch === "#") return false;
    const k = path[i].join(); if (seen.has(k)) return false; seen.add(k);
    if (i && Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]) !== 1) return false;
    if (i < path.length - 1 && ch === "T") return false;
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g[r][c] === "*" && !seen.has(`${r},${c}`)) return false;
  return path.length - 1 <= view.maxSteps;
}

// =========================================================
// 18) 원판 맞추기 (미스터리 H2) — i번 원판을 돌리면 안쪽 원판도 한 칸 같이 돎
// =========================================================
function genRings(R, d) {
  const n = [3, 3, 4, 5, 5][d - 1], steps = [6, 8, 8, 8, 10][d - 1], k = [3, 5, 9, 14, 20][d - 1], minOps = [2, 4, 9, 14, 18][d - 1], slack = [null, null, 3, 1, 0][d - 1], link = [1, 1, 1, 2, 3][d - 1];
  for (let tries = 0; tries < 50; tries++) {
    const val = Array(n).fill(0);
    for (let i = 0; i < k; i++) { const op = R.int(0, n - 1); val[op] = (val[op] + steps - 1) % steps; if (op + 1 < n) val[op + 1] = (val[op + 1] + steps * 3 - link) % steps; }
    if (val.every((v) => v === 0)) continue;
    // 정답은 하나뿐: 바깥부터 순서대로 필요한 횟수 → 어려운 단계는 횟수 제한 (막 돌리면 못 풂)
    const sim = val.slice(); let opt = 0; for (let i = 0; i < n; i++) { const x = (steps - sim[i]) % steps; opt += x; sim[i] = 0; if (i + 1 < n) sim[i + 1] = (sim[i + 1] + x * link) % steps; }
    if (opt < minOps) continue;
    return { view: { n, steps, init: val, link, maxOps: slack == null ? null : opt + slack }, key: null, exp: { k, opt }, hint: { order: "outer" } };
  }
  throw new Error("rings gen");
}
export function ringsReplay(view, ops) {
  if (!Array.isArray(ops) || ops.length > 120) return false;
  if (view.maxOps != null && ops.length > view.maxOps) return false;
  const v = view.init.slice();
  const lk = view.link || 1; for (const op of ops) { if (!isInt(op) || op < 0 || op >= view.n) return false; v[op] = (v[op] + 1) % view.steps; if (op + 1 < view.n) v[op + 1] = (v[op + 1] + lk) % view.steps; }
  return v.every((x) => x === 0);
}

// =========================================================
// 19) 성냥개비 식 (창의) — 성냥 하나만 옮겨 식을 참으로
// 숫자 = 7획(a b c d e f g → 비트 0~6), 연산자: "+"(세로 성냥 있음) / "−"
// =========================================================
export const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const segDigit = (m) => SEG.indexOf(m);
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
export function matchEval(st) {   // st: { a:[mask..], op: 1(+)|0(−), b:[..], c:[..] }
  const num = (arr) => { let v = 0; for (const m of arr) { const dg = segDigit(m); if (dg < 0) return null; v = v * 10 + dg; } return v; };
  const A = num(st.a), B = num(st.b), Cc = num(st.c);
  if (A === null || B === null || Cc === null) return null;
  return (st.op ? A + B : A - B) === Cc;
}
function matchFlat(st) { return [...st.a, st.op ? 1 : 0, ...st.b, ...st.c]; }
function matchUnflat(tpl, flat) { const a = flat.slice(0, tpl.a.length), op = flat[tpl.a.length], b = flat.slice(tpl.a.length + 1, tpl.a.length + 1 + tpl.b.length), c = flat.slice(tpl.a.length + 1 + tpl.b.length); return { a, op, b, c }; }
function matchOneMoves(st) {   // 성냥 하나를 빼서 다른 빈자리에 꽂은 모든 상태
  const f = matchFlat(st), opIdx = st.a.length, out = [];
  const holes = (i) => (i === opIdx ? 1 : 7);
  for (let i = 0; i < f.length; i++) for (let s = 0; s < holes(i); s++) {
    if (!((f[i] >> s) & 1)) continue;
    const g = f.slice(); g[i] &= ~(1 << s);
    for (let j = 0; j < g.length; j++) for (let t = 0; t < holes(j); t++) {
      if ((g[j] >> t) & 1) continue;
      if (i === j && s === t) continue;
      const h = g.slice(); h[j] |= 1 << t;
      out.push(matchUnflat(st, h));
    }
  }
  return out;
}
export function matchIsOneMove(from, to) {
  const a = matchFlat(from), b = matchFlat(to);
  if (a.length !== b.length) return false;
  let removed = 0, added = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] & ~b[i], y = b[i] & ~a[i]; removed += bits(x); added += bits(y); }
  return removed === 1 && added === 1;
}
function genMatch(R, d) {
  for (let tries = 0; tries < 3000; tries++) {
    const two = d >= 4;
    const plus = R() < 0.5;
    let A, B, Cc;
    if (plus) { A = R.int(1, two ? 19 : 9); B = R.int(1, 9); Cc = A + B; if (!two && Cc > 9) continue; if (two && Cc < 10) continue; }
    else { A = R.int(two ? 10 : 2, two ? 19 : 9); B = R.int(1, Math.min(9, A)); Cc = A - B; }
    const dg = (v, w) => String(v).padStart(w, "?").split("").map((x) => (x === "?" ? null : SEG[Number(x)]));
    const wa = String(A).length, wc = String(Cc).length;
    const truth = { a: dg(A, wa), op: plus ? 1 : 0, b: dg(B, 1), c: dg(Cc, wc) };
    if ([...truth.a, ...truth.b, ...truth.c].some((x) => x === null)) continue;
    const cands = matchOneMoves(truth).filter((s) => matchEval(s) === false);
    if (!cands.length) continue;
    // 어려우면 숫자→다른 숫자로 옮긴 것 / 연산자 바꾼 것 우대
    const pick = R.pick(cands);
    // 정답이 여러 개여도 됨 (하나만 옮겨 참이면 정답)
    const sols = matchOneMoves(pick).filter((s) => matchEval(s) === true);
    if (!sols.length) continue;
    if (d <= 2 && sols.length > 3) { /* 쉬움: 정답 여러 개 OK */ }
    if (d >= 3 && sols.length !== 1) continue; // 어려운 단계는 정답이 하나뿐인 문제만
    return { view: { st: pick }, key: truth, exp: { truth, n: sols.length }, hint: { where: matchFlat(pick).findIndex((m, i) => m !== matchFlat(truth)[i]) } };
  }
  throw new Error("match gen");
}

// =========================================================
// 20) 숫자 만들기 (창의) — 숫자 카드 두 장씩 계산해 목표 수 만들기
// 답: steps [[i, op, j], ...] — 지금 남은 카드 목록의 번호, 계산 결과는 맨 뒤에 붙음
// =========================================================
const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = (x, y) => (y ? g(y, x % y) : Math.abs(x)); const k = g(n, d) || 1; return [n / k, d / k]; };
const fop = (a, op, b) => {
  if (op === "+") return frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  if (op === "-") return frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  if (op === "*") return frac(a[0] * b[0], a[1] * b[1]);
  if (op === "/") return b[0] === 0 ? null : frac(a[0] * b[1], a[1] * b[0]);
  return null;
};
function makeSolvable(nums, target) {
  const rec = (arr) => {
    if (arr.length === 1) return arr[0][0] === target && arr[0][1] === 1;
    for (let i = 0; i < arr.length; i++) for (let j = 0; j < arr.length; j++) if (i !== j) for (const op of ["+", "-", "*", "/"]) {
      const v = fop(arr[i], op, arr[j]); if (!v) continue;
      const rest = arr.filter((_, k) => k !== i && k !== j); rest.push(v);
      if (rec(rest)) return true;
    }
    return false;
  };
  return rec(nums.map((n) => [n, 1]));
}
function genMake(R, d) {
  for (let tries = 0; tries < 400; tries++) {
    const k = d <= 1 ? 3 : 4;
    const nums = range(k).map(() => R.int(1, d >= 5 ? 13 : 9));
    const target = d <= 1 ? R.int(10, 20) : d === 2 ? 10 : d <= 4 ? 24 : R.pick([24, 36, 48]);
    if (!makeSolvable(nums, target)) continue;
    // 너무 쉬운 것(전부 더하기) 피하기
    if (d >= 3 && nums.reduce((a, b) => a + b, 0) === target) continue;
    return { view: { nums, target }, key: target, exp: { target }, hint: { target } };
  }
  throw new Error("make gen");
}
export function makeReplay(view, steps) {
  if (!Array.isArray(steps) || steps.length !== view.nums.length - 1) return false;
  let arr = view.nums.map((n) => [n, 1]);
  for (const s of steps) {
    if (!Array.isArray(s) || s.length !== 3) return false;
    const [i, op, j] = s;
    if (!isInt(i) || !isInt(j) || i === j || i < 0 || j < 0 || i >= arr.length || j >= arr.length || !["+", "-", "*", "/"].includes(op)) return false;
    const v = fop(arr[i], op, arr[j]); if (!v) return false;
    arr = arr.filter((_, k) => k !== i && k !== j); arr.push(v);
  }
  return arr.length === 1 && arr[0][0] === view.target && arr[0][1] === 1;
}

// =========================================================
// 생성·정답 확인 진입점
// =========================================================
const GEN = { matrix: genMatrix, figseq: genFigseq, series: genSeries, symbols: genSymbols, clock: genClock, liar: genLiar, order: genOrder, lock: genLock, scale: genScale, rotate: genRotate, circuit: genCircuit, mirror: genMirror, gears: genGears, analogy: genAnalogy, oddword: genOddword, syllogism: genSyllogism, bells: genBells, span: genSpan, gridmem: genGridmem, slide: genSlide, path: genPath, rings: genRings, match: genMatch, make: genMake };

export function gen(type, d, seed) {
  const T = TYPES[type]; if (!T) throw new Error("UNKNOWN_TYPE");
  d = Math.max(1, Math.min(5, d | 0));
  const R = rng((seed >>> 0) ^ hashSeed(type + ":" + d));
  const g = GEN[type](R, d);
  return { type, d, area: T.area, kind: T.kind, lim: T.lim[d - 1] * 1000, view: g.view, key: g.key, exp: g.exp, hint: g.hint };
}

// 화면에 보내도 되는 부분만
export function publicItem(it) { return { type: it.type, d: it.d, area: it.area, kind: it.kind, lim: it.lim, view: it.view }; }

/** 정답 확인 — ans는 화면이 보낸 것(믿지 않음), st = 문항별 서버 상태(저울질 기록) */
export function check(it, ans, st = {}) {
  const v = it.view;
  try {
    switch (it.type) {
      case "matrix": case "figseq": case "rotate": case "gears": case "analogy": case "oddword": case "syllogism": case "liar":
        return { ok: Number(ans) === it.key, part: 0 };
      case "clock":
        if (v.kind === "angle") return { ok: Number(ans) === it.key, part: 0 };
        return { ok: !!ans && Number(ans.h) === it.key.h && Number(ans.m) === it.key.m, part: 0 };
      case "series": case "symbols":
        return { ok: String(ans ?? "").trim() !== "" && Number(ans) === it.key, part: 0 };
      case "order": return { ok: same((ans || []).map(Number), it.key), part: 0 };
      case "lock": return { ok: same((ans || []).map(Number), it.key), part: 0 };
      case "scale": {
        const c = scaleCandidates(v.n, st.w);
        return { ok: c.length === 1 && Number(ans) === c[0] && c[0] === it.key, part: 0 };
      }
      case "circuit": return { ok: circuitLit(v, ans).solved, part: 0 };
      case "mirror": return { ok: Array.isArray(ans) && ans.length === v.mirrors.length && ans.every((s) => s === "/" || s === "\\") && traceBeam(v, ans).hit, part: 0 };
      case "bells": case "span": {
        const a = (Array.isArray(ans) ? ans : String(ans ?? "").split("")).map(Number);
        let k = 0; while (k < it.key.length && a[k] === it.key[k]) k++;
        const ok = k === it.key.length && a.length === it.key.length;
        return { ok, part: ok ? 1 : k / it.key.length };
      }
      case "gridmem": {
        const a = [...new Set((ans || []).map(Number))];
        const hit = a.filter((x) => it.key.includes(x)).length, miss = a.length - hit;
        const ok = hit === it.key.length && miss === 0;
        return { ok, part: ok ? 1 : Math.max(0, (hit - miss) / it.key.length) };
      }
      case "slide": { const r = slideReplay(v, ans); return { ok: r.ok && r.solved, part: 0 }; }
      case "path": return { ok: pathCheck(v, ans), part: 0 };
      case "rings": return { ok: ringsReplay(v, ans), part: 0 };
      case "match": {
        const t = ans && { a: (ans.a || []).map(Number), op: ans.op ? 1 : 0, b: (ans.b || []).map(Number), c: (ans.c || []).map(Number) };
        return { ok: !!t && t.a.length === v.st.a.length && t.b.length === v.st.b.length && t.c.length === v.st.c.length && matchIsOneMove(v.st, t) && matchEval(t) === true, part: 0 };
      }
      case "make": return { ok: makeReplay(v, ans), part: 0 };
    }
  } catch { return { ok: false, part: 0 }; }
  return { ok: false, part: 0 };
}

// 해설용 정답 (제출 뒤에만 화면에 보냄)
export function revealOf(it) { return { key: it.key, exp: it.exp }; }
