// 시험용: 문항 정답 만들기 (서버만 아는 key + 풀이)
function solveMake(view) {
  const rec = (arr, steps) => {
    if (arr.length === 1) return arr[0][0] === view.target && arr[0][1] === 1 ? steps : null;
    for (let i = 0; i < arr.length; i++) for (let j = 0; j < arr.length; j++) if (i !== j) for (const op of ["+", "-", "*", "/"]) {
      const a = arr[i], b = arr[j]; let v;
      const fr = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = (x, y) => (y ? g(y, x % y) : Math.abs(x)); const k = g(n, d) || 1; return [n / k, d / k]; };
      if (op === "+") v = fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); else if (op === "-") v = fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); else if (op === "*") v = fr(a[0] * b[0], a[1] * b[1]); else { if (!b[0]) continue; v = fr(a[0] * b[1], a[1] * b[0]); }
      const rest = arr.filter((_, k) => k !== i && k !== j); rest.push(v);
      const r = rec(rest, [...steps, [i, op, j]]); if (r) return r;
    }
    return null;
  };
  return rec(view.nums.map((n) => [n, 1]), []);
}
function slideSolve(view) {   // BFS로 실제 이동 목록
  const W = 6, H = 6;
  const occ = (ps) => { const g = Array.from({ length: H }, () => Array(W).fill(-1)); for (const p of ps) for (let i = 0; i < p.len; i++) g[p.dir === "v" ? p.r + i : p.r][p.dir === "h" ? p.c + i : p.c] = p.id; return g; };
  const key = (ps) => ps.map((p) => (p.dir === "h" ? p.c : p.r)).join(",");
  const start = view.pieces.map((p) => ({ ...p }));
  const prev = new Map([[key(start), null]]); let q = [start];
  while (q.length) {
    const nq = [];
    for (const s of q) {
      if (s[0].c + s[0].len === W) { const mv = []; let k = key(s); while (prev.get(k)) { const [pk, m] = prev.get(k); mv.unshift(m); k = pk; } return mv; }
      const g = occ(s);
      s.forEach((p, i) => { for (const sg of [-1, 1]) for (let k = 1; k < 6; k++) {
        const r = p.dir === "v" ? (sg < 0 ? p.r - k : p.r + p.len - 1 + k) : p.r, c = p.dir === "h" ? (sg < 0 ? p.c - k : p.c + p.len - 1 + k) : p.c;
        if (r < 0 || c < 0 || r >= H || c >= W || g[r][c] !== -1) break;
        const n = s.map((x) => ({ ...x })); if (p.dir === "h") n[i].c += sg * k; else n[i].r += sg * k;
        const kk = key(n); if (prev.has(kk)) continue; prev.set(kk, [key(s), { id: p.id, d: sg * k }]); nq.push(n);
      } });
    }
    q = nq;
  }
  return null;
}
export function answerFor(it) {
  const v = it.view;
  switch (it.type) {
    case "rings": { const val = v.init.slice(), ops = []; for (let i = 0; i < v.n; i++) { const x = (v.steps - val[i]) % v.steps; for (let k = 0; k < x; k++) { ops.push(i); val[i] = (val[i] + 1) % v.steps; if (i + 1 < v.n) val[i + 1] = (val[i + 1] + (v.link || 1)) % v.steps; } } return ops; }
    case "slide": return slideSolve(v);
    case "path": return it.exp.route;
    case "make": return solveMake(v);
    case "match": return it.key;
    case "scale": return null;
    default: return it.key;
  }
}
