// =========================
// 상식 진단소 문제 관리 (관리자 전용 REST) — 기존 requireAdmin(관리자 이메일 확인) 뒤에서만 동작
// 문제 등록·수정·비활성화·분야/난이도/정답/해설/출처 수정·검수 상태 · 중복 확인 · 오류 신고 · 사용 통계 · 검증 보고서
// 저장 전 validateItem 통과 필수. 저장은 know_questions(DB) → 문제은행 다시 만들기(진행 중 검사는 이미 받은 문항 그대로)
// =========================
import * as C from "./know-core.js";
import { STORE, rebuild, loadDb, rowToItem, bankVersion } from "./know-store.js";
import { validateItem, findDupes, toSchema, STATUSES } from "./know-validate.js";

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/[<>]/g, "").trim().slice(0, n);
// 관리자 입력 → 문항 (허용한 칸만 받음)
export function sanitizeQuestion(id, b, prev = null) {
  const q = {
    id, area: b.area, sub: b.sub ? clean(b.sub, 30) : null, game: b.game, kind: b.kind, d: Number(b.d) | 0,
    q: clean(b.q, 200), exp: clean(b.exp, 500), fun: b.fun ? clean(b.fun, 200) : null,
    src: Array.isArray(b.src) ? b.src.slice(0, 5).map((s) => ({ t: clean(s?.t, 80), u: clean(s?.u, 300) })) : [],
    checked: /^\d{4}-\d\d-\d\d$/.test(b.checked || "") ? b.checked : C.dayKey(), by: "op", ver: (prev?.ver || 0) + 1,
    status: STATUSES.includes(b.status) ? b.status : "draft", tags: Array.isArray(b.tags) ? b.tags.slice(0, 6).map((t) => clean(t, 20)) : [],
    assets: [], lab: b.lab ? clean(b.lab, 20) : null, art: b.art ? clean(b.art, 20) : null,
    volatile: !!b.volatile, asOf: b.asOf ? clean(b.asOf, 10) : null,
  };
  const S = (a, n = 4, len = 80) => (Array.isArray(a) ? a.slice(0, n).map((x) => clean(x, len)) : null);
  if (q.kind === "mcq" || q.kind === "reveal") q.opts = S(b.opts);
  if (q.kind === "reveal") q.clues = S(b.clues, 5, 120);
  if (q.kind === "map") q.codes = S(b.codes, 6, 3)?.map((c) => c.toUpperCase());
  if (q.kind === "ox") q.ans = b.ans === true || b.ans === "true";
  if (q.kind === "order") q.events = Array.isArray(b.events) ? b.events.slice(0, 6).map((e) => (e?.[2] ? [clean(e[0], 80), Number(e[1]), clean(e[2], 20)] : [clean(e?.[0], 80), Number(e?.[1])])) : null;
  if (q.kind === "pair") q.pairs = Array.isArray(b.pairs) ? b.pairs.slice(0, 5).map((p) => [clean(p?.[0], 40), clean(p?.[1], 40)]) : null;
  if (q.kind === "fake") q.stmts = Array.isArray(b.stmts) ? b.stmts.slice(0, 4).map((x) => [clean(x?.[0], 140), x?.[1] === true || x?.[1] === "true"]) : null;
  if (q.kind === "num") { const n = b.n || {}; q.n = { v: Number(n.v), tol: Number(n.tol), far: Number(n.far), abs: !!n.abs, unit: clean(n.unit, 10), min: Number(n.min), max: Number(n.max), step: Number(n.step) || 1 }; }
  if (!q.fun) delete q.fun; if (!q.lab) delete q.lab; if (!q.art) delete q.art; if (!q.volatile) { delete q.volatile; delete q.asOf; }
  return q;
}

export function registerKnowAdmin(app, sb, requireAdmin) {
  const statsOf = async () => {
    const out = new Map(); if (!sb) return out;
    try { const { data } = await sb.from("know_qstats").select("question_id, used, correct, part_sum, timeouts, ms_sum").limit(5000); for (const r of data || []) out.set(r.question_id, { used: r.used, correct: r.correct, timeouts: r.timeouts, avgMs: r.used ? Math.round(r.ms_sum / r.used) : null }); } catch {}
    try { const { data } = await sb.from("know_reports").select("question_id").eq("status", "open").limit(5000); for (const r of data || []) { const s = out.get(r.question_id) || { used: 0, correct: 0 }; s.reports = (s.reports || 0) + 1; out.set(r.question_id, s); } } catch {}
    return out;
  };
  const summary = () => {
    const by = (f) => { const o = {}; for (const q of STORE.pool) { const k = f(q); o[k] = (o[k] || 0) + 1; } return o; };
    return { total: STORE.all.size, live: STORE.pool.length, invalid: STORE.invalid, byArea: by((q) => q.area), byDiff: by((q) => q.d), byGame: by((q) => q.game), byStatus: (() => { const o = {}; for (const q of STORE.all.values()) o[q.status] = (o[q.status] || 0) + 1; return o; })(), target: C.BANK_TARGET, bankVer: bankVersion(), dbItems: STORE.dbIds.size };
  };

  app.get("/admin/know/summary", requireAdmin, (_req, res) => res.json({ ok: true, ...summary() }));
  app.get("/admin/know/questions", requireAdmin, async (req, res) => {
    try {
      const st = await statsOf(), qs = String(req.query.q || "").trim();
      let rows = [...STORE.all.values()];
      if (C.BANK_AREAS.includes(req.query.area)) rows = rows.filter((q) => q.area === req.query.area);
      if (STATUSES.includes(req.query.status)) rows = rows.filter((q) => q.status === req.query.status);
      if (C.GAMES[req.query.game]) rows = rows.filter((q) => q.game === req.query.game);
      if (qs) rows = rows.filter((q) => JSON.stringify(q).includes(qs));
      if (req.query.reported === "1") rows = rows.filter((q) => st.get(q.id)?.reports);
      res.json({ ok: true, rows: rows.slice(0, 1000).map((q) => ({ ...toSchema(q, st.get(q.id)), inDb: STORE.dbIds.has(q.id), errors: validateItem(q).errors })) });
    } catch (e) { console.error("[admin/know]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/admin/know/questions/:id", requireAdmin, async (req, res) => {
    const q = STORE.all.get(String(req.params.id)); if (!q) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const st = await statsOf();
    res.json({ ok: true, raw: q, schema: toSchema(q, st.get(q.id)), check: validateItem(q) });
  });
  // 등록·수정 (id가 없으면 새로). 자동 검사 오류가 있으면 저장 안 함. 사람이 저장하면 검수자 = op
  app.put("/admin/know/questions/:id", requireAdmin, async (req, res) => {
    try {
      const id = String(req.params.id || "").toUpperCase();
      if (!/^[A-Z]\d{4}$/.test(id)) return res.status(400).json({ ok: false, error: "BAD_ID" });
      const q = sanitizeQuestion(id, req.body || {}, STORE.all.get(id));
      const check = validateItem(q);
      if (check.errors.length) return res.status(400).json({ ok: false, error: "INVALID", check });
      const dupes = findDupes([...[...STORE.all.values()].filter((x) => x.id !== id), q], { only: id });
      if (dupes.length && req.body?.allowDupe !== true) return res.status(409).json({ ok: false, error: "DUPLICATE", dupes, check });
      if (!sb) return res.status(500).json({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("know_questions").upsert({ id, data: q, category: q.area, subcategory: q.sub, game: q.game, kind: q.kind, difficulty: q.d, review_status: q.status, content_ver: q.ver, updated_by: req.user?.email || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) return res.status(500).json({ ok: false, error: "SAVE_FAIL", detail: error.message });
      STORE.all.set(id, q); STORE.dbIds.add(id); rebuild();
      res.json({ ok: true, saved: toSchema(q), check, live: STORE.pool.some((x) => x.id === id) });
    } catch (e) { console.error("[admin/know put]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 검수 상태만 바꾸기 (승인·보류·비활성화). 코드 문제은행 문항도 DB 사본을 만들어 덮어씀
  app.patch("/admin/know/questions/:id/status", requireAdmin, async (req, res) => {
    const id = String(req.params.id || ""), q = STORE.all.get(id), status = req.body?.status;
    if (!q) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!STATUSES.includes(status)) return res.status(400).json({ ok: false, error: "BAD_STATUS" });
    if (!sb) return res.status(500).json({ ok: false, error: "NO_DB" });
    const nq = { ...q, status, ...(status === "approved" ? { by: "op", checked: C.dayKey() } : {}) };
    const { error } = await sb.from("know_questions").upsert({ id, data: nq, category: nq.area, subcategory: nq.sub || null, game: nq.game, kind: nq.kind, difficulty: nq.d, review_status: status, content_ver: nq.ver, updated_by: req.user?.email || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return res.status(500).json({ ok: false, error: "SAVE_FAIL" });
    STORE.all.set(id, nq); STORE.dbIds.add(id); rebuild();
    res.json({ ok: true, status, live: STORE.pool.some((x) => x.id === id) });
  });
  app.post("/admin/know/reload", requireAdmin, async (_req, res) => { const r = await loadDb(sb); res.json({ ok: r.ok, ...summary() }); });
  app.get("/admin/know/dupes", requireAdmin, (req, res) => { const th = Math.min(0.95, Math.max(0.3, Number(req.query.th) || 0.62)); res.json({ ok: true, th, pairs: findDupes([...STORE.all.values()], { th }) }); });
  app.get("/admin/know/reports", requireAdmin, async (req, res) => {
    if (!sb) return res.json({ ok: true, rows: [] });
    const status = ["open", "fixed", "rejected"].includes(req.query.status) ? req.query.status : "open";
    const { data, error } = await sb.from("know_reports").select("id, question_id, reason, note, status, admin_note, created_at, resolved_at").eq("status", status).order("created_at", { ascending: false }).limit(300);
    if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
    res.json({ ok: true, rows: (data || []).map((r) => ({ ...r, q: STORE.all.get(r.question_id)?.q || null })) });
  });
  app.patch("/admin/know/reports/:id", requireAdmin, async (req, res) => {
    if (!sb) return res.status(500).json({ ok: false, error: "NO_DB" });
    const status = ["fixed", "rejected", "open"].includes(req.body?.status) ? req.body.status : null; if (!status) return res.status(400).json({ ok: false, error: "BAD_STATUS" });
    const { error } = await sb.from("know_reports").update({ status, admin_note: req.body?.note ? clean(req.body.note, 300) : null, resolved_at: status === "open" ? null : new Date().toISOString() }).eq("id", Number(req.params.id) || 0);
    res.json(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
  });
}
export const _adminTest = { sanitizeQuestion, rowToItem };
