// 진단소 시험용 메모리 가짜 Supabase (쓰는 기능만)
// ---------- 가짜 Supabase (쓰는 기능만) ----------
export const DB = { profiles: [{ id: "u_marin", nickname: "마린", avatar_url: "https://example.com/m.png" }, { id: "u_lemur", nickname: "레무르", avatar_url: null }], clinic_results: [], clinic_best: [], clinic_profiles: [], clinic_groups: [] };
function project(row, cols) {
  if (!cols || cols.trim() === "*") return { ...row };
  const o = {};
  for (let c of cols.split(",")) {
    c = c.trim();
    let m, alias = null;
    if ((m = c.match(/^(\w+):(.+)$/))) { alias = m[1]; c = m[2]; }
    if (alias) { const [x, y] = c.split(/->>?/); o[alias] = y ? row[x]?.[y] ?? null : row[x]; continue; }
    if ((m = c.match(/^(\w+)->>(\w+)$/))) o[m[2]] = row[m[1]]?.[m[2]] == null ? null : String(row[m[1]][m[2]]);
    else if ((m = c.match(/^(\w+)->(\w+)$/))) o[m[2]] = row[m[1]]?.[m[2]] ?? null;
    else o[c] = row[c];
  }
  return o;
}
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = "select"; this.cols = "*"; this.lim = null; this.ord = []; this.one = null; this.opts = {}; this.retSel = null; }
  select(cols = "*", opts = {}) { if (this.op === "select") { this.cols = cols; this.opts = opts; } else this.retSel = cols; return this; }
  insert(rows) { this.op = "insert"; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  update(v) { this.op = "update"; this.val = v; return this; }
  upsert(row, o = {}) { this.op = "upsert"; this.rows = Array.isArray(row) ? row : [row]; this.conf = (o.onConflict || "id").split(","); return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.f.push((r) => r[c] === v); return this; }
  neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
  gte(c, v) { this.f.push((r) => r[c] >= v); return this; }
  gt(c, v) { this.f.push((r) => r[c] > v); return this; }
  lt(c, v) { this.f.push((r) => r[c] < v); return this; }
  not(c, op, v) { if (op === "is" && v === null) this.f.push((r) => r[c] != null); return this; }
  order(c, o = {}) { this.ord.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  single() { this.one = "single"; return this; }
  run() {
    const T = DB[this.t] || (DB[this.t] = []);
    const match = (r) => this.f.every((fn) => fn(r));
    if (this.op === "insert") { for (const r of this.rows) { if (T.some((x) => x.id && x.id === r.id)) return { error: { code: "23505" } }; T.push({ ...r }); } return { error: null }; }
    if (this.op === "upsert") { for (const r of this.rows) { const ex = T.find((x) => this.conf.every((k) => x[k] === r[k])); if (ex) Object.assign(ex, r); else T.push({ ...r }); } return { error: null }; }
    if (this.op === "update") { const hit = T.filter(match); hit.forEach((r) => Object.assign(r, this.val)); return { error: null, data: this.retSel ? hit.map((r) => project(r, this.retSel)) : null }; }
    if (this.op === "delete") { const keep = T.filter((r) => !match(r)); DB[this.t] = keep; return { error: null }; }
    let rows = T.filter(match);
    const val = (r, c) => { const [x, y] = c.split(/->>?/); return y ? r[x]?.[y] : r[c]; };
    for (const [c, asc] of [...this.ord].reverse()) rows.sort((a, b) => { const A = val(a, c), B = val(b, c); return (A < B ? -1 : A > B ? 1 : 0) * (asc ? 1 : -1); });
    if (this.opts.head) return { error: null, count: rows.length, data: null };
    if (this.lim != null) rows = rows.slice(0, this.lim);
    const data = rows.map((r) => project(r, this.cols));
    if (this.one) return { error: this.one === "single" && !data.length ? { code: "PGRST116" } : null, data: data[0] || null };
    return { error: null, data, count: this.opts.count ? rows.length : undefined };
  }
  then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
}
export const sb = { from: (t) => new Q(t) };

