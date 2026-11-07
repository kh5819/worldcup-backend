// =========================
// 플듀 감각 진단소 — 혼자 검사 서버 (feel:* 소켓 + /feel/* REST)
// 화면은 답 기록만 보냄 → 서버가 feel-core.js(화면과 같은 파일)로 문제를 다시 만들고 다시 채점. 클라 점수는 안 믿음
// 시간: 서버가 검사 시작 시각을 재고, 기록 속 시간이 그보다 길면 조작 → 40점 상한 + 랭킹 제외
// 건너뛴 검사는 0점이 아니라 '미측정'(scores에 아예 없음)
// DB: feel_results (sql/feel_tables.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./feel-core.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, userKey, device, resultId } from "./iq.js";

const SESS = new Map();
const SESS_TTL = 3 * 60 * 60 * 1000, MAX_SESS = 4, LOG_MAX_BYTES = 40000, TIME_SLACK = 2500;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const sweep = () => { const n = Date.now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); };

/** 제출 하나 채점 + 시간 검증 (멀티도 재사용) */
export function judgeSubmit(tid, seed, diff, log, elapsedMs) {
  let bytes = 0;
  try { bytes = JSON.stringify(log ?? {}).length; } catch { bytes = LOG_MAX_BYTES + 1; }
  if (bytes > LOG_MAX_BYTES) return { id: tid, score: 0, m: {}, flags: ["LOG_TOO_BIG"] };
  const r = C.scoreTest(tid, C.genSpec(tid, seed, diff), log || {});
  if (process.env.FEEL_DEV_TIME === "1") return r;   // 시험 서버 전용
  const cap = (f) => { r.flags = [...r.flags, f]; r.score = Math.min(r.score, 40); };
  if (Number.isFinite(elapsedMs) && C.logSpan(tid, log || {}) > elapsedMs + TIME_SLACK) cap("TIME");
  if (Number.isFinite(elapsedMs) && elapsedMs < C.nTrials(tid) * 250) cap("TOO_QUICK");
  return r;
}
export function buildRow({ id, key, me, prof, prefs, mode, diff, dev, plan, results, prev, rank, of, isPublic, avatarUrl }) {
  const scores = {}, metrics = {};
  plan.forEach((it, i) => { const r = results[i]; if (!r || r.skipped) return; scores[it.id] = r.score; metrics[it.id] = { m: r.m, flags: r.flags }; });
  const flagged = plan.some((_, i) => results[i]?.flags?.length);
  const diag = C.diagnose({ scores, prev, rank, of });
  return {
    id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null,
    mode, diff, set_ver: C.SET_VERSION, device: dev, scores, metrics, total: diag.total, areas: diag.areas, tier: diag.tier.id, style: diag.style.id, diag, done: diag.done,
    is_public: isPublic !== false, flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer, rank: rank || null, rank_of: of || null, created_at: new Date().toISOString(),
  };
}
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, age: owner || row.show_age ? row.age : null, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, diff: row.diff, setVer: row.set_ver, device: row.device,
    scores: row.scores, metrics: row.metrics, total: row.total, areas: row.areas, tier: row.tier, style: row.style, diag: row.diag, done: row.done, isPublic: row.is_public, flagged: row.flagged,
    rank: row.rank, of: row.rank_of, createdAt: row.created_at, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer,
  };
}
const insertRow = async (sb, row) => { const { error } = await sb.from("feel_results").insert(row); return { error }; };
async function prevResult(sb, key, mode, diff) {
  if (!sb) return null;
  try { const { data } = await sb.from("feel_results").select("total, tier, scores, created_at").eq("owner_key", key).eq("mode", mode).eq("diff", diff).order("created_at", { ascending: false }).limit(1).maybeSingle(); return data; } catch { return null; }
}
// 내 개인 최고(검사별, 같은 난이도) — 기록 갱신 알림용
async function personalBest(sb, key, diff) {
  if (!sb) return {};
  try { const { data } = await sb.from("feel_results").select("scores").eq("owner_key", key).eq("diff", diff).eq("flagged", false).order("created_at", { ascending: false }).limit(200); const best = {}; for (const r of data || []) for (const [t, v] of Object.entries(r.scores || {})) if (!(best[t] >= v)) best[t] = v; return best; } catch { return {}; }
}
async function rankOf(sb, diff, total) {
  if (!sb) return { rank: null, of: null };
  try {
    const base = () => sb.from("feel_results").select("id", { count: "exact", head: true }).eq("mode", "full").eq("diff", diff).eq("flagged", false);   // 검사 버전이 바뀌어도 기록 유지 (랭킹 초기화 없음)
    const [{ count: of }, { count: above }] = await Promise.all([base(), base().gt("total", total)]);
    return { rank: (above || 0) + 1, of: (of || 0) + 1 };
  } catch { return { rank: null, of: null }; }
}

export function registerFeel(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  const sb = supabaseAdmin;

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.FEEL_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const resPub = (r) => (r ? { id: r.id, score: r.score, m: r.m, flags: r.flags, skipped: !!r.skipped } : null);

    // mode: full(준비된 검사 전부) | single(검사 하나 — 기록·검사별 랭킹 O)
    on("feel:begin", async (p, reply) => {
      const diff = C.okDiff(p.diff);
      let tests;
      if (p.mode === "single") { if (!C.TESTS[p.test]?.ready) return reply({ ok: false, error: "BAD_TEST" }); tests = [p.test]; }
      else if (p.mode === "full") tests = [...C.READY];
      else return reply({ ok: false, error: "BAD_MODE" });
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode: p.mode, diff, device: device(p.device), createdAt: Date.now(), plan: tests.map((t) => ({ id: t, seed: newSeed() })), started: {}, results: {}, finished: null };
      SESS.set(id, s);
      reply({ ok: true, sid: id, mode: s.mode, diff, plan: s.plan, device: s.device, setVer: C.SET_VERSION });
    });
    on("feel:resume", (p, reply) => {
      const s = mySess(p.sid);
      if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" });
      const results = s.plan.map((_, i) => resPub(s.results[i]));
      const idx = results.findIndex((x) => !x);
      reply({ ok: true, mode: s.mode, diff: s.diff, plan: s.plan, results, idx: idx < 0 ? s.plan.length : idx });
    });
    on("feel:testStart", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (!s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: false, error: "ALREADY_DONE" });
      if (s.plan.slice(0, i).some((_, j) => !s.results[j])) return reply({ ok: false, error: "BAD_ORDER" });
      s.started[i] = Date.now();   // 새로고침 뒤 다시 시작하면 시간도 새로 잼 (같은 문제)
      reply({ ok: true });
    });
    on("feel:submit", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0, item = s.plan[i];
      if (!item) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: true, result: resPub(s.results[i]), dup: true });   // 중복 제출 = 처음 결과 그대로
      if (s.plan.slice(0, i).some((_, j) => !s.results[j])) return reply({ ok: false, error: "BAD_ORDER" });
      if (p.skip) { if (s.mode !== "full") return reply({ ok: false, error: "BAD_MODE" }); s.results[i] = { id: item.id, skipped: true, score: null, m: {}, flags: [] }; }
      else { if (!s.started[i]) return reply({ ok: false, error: "NOT_STARTED" }); s.results[i] = judgeSubmit(item.id, item.seed, s.diff, p.log, Date.now() - s.started[i]); }
      reply({ ok: true, result: resPub(s.results[i]), allDone: s.plan.every((_, j) => s.results[j]) });
    });
    on("feel:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (s.plan.some((_, i) => !s.results[i])) return reply({ ok: false, error: "NOT_COMPLETE" });
      if (s.plan.every((_, i) => s.results[i].skipped)) return reply({ ok: false, error: "NOTHING_MEASURED" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(sb, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs), [prev, best] = await Promise.all([prevResult(sb, key, s.mode, s.diff), personalBest(sb, key, s.diff)]);
      const tmp = buildRow({ id: "", key, me, prof, prefs, mode: s.mode, diff: s.diff, dev: s.device, plan: s.plan, results: s.results, prev });
      const rk = tmp.flagged || s.mode !== "full" ? { rank: null, of: null } : await rankOf(sb, s.diff, tmp.total);
      const row = buildRow({ id: resultId(), key, me, prof, prefs, mode: s.mode, diff: s.diff, dev: s.device, plan: s.plan, results: s.results, prev, ...rk, isPublic: p.isPublic !== false, avatarUrl: mp?.avatar_url });
      const newBest = Object.entries(row.scores).filter(([t, v]) => !row.flagged && v > (best[t] ?? -1) && best[t] != null).map(([t]) => t);
      let saved = null;
      if (sb) { const { error } = await insertRow(sb, row); if (error) console.error("[feel] save", error.message); else saved = row.id; }
      // 스트리머가 쓴 기록 → admin 📺 스트리머 탭에 "감각"으로 (접수에서 '📺 스트리머예요' 체크한 경우만, 저장된 결과 1건당 1줄)
      if (saved && prefs.streamer && sb) {
        const title = `감각 진단소 · ${C.modeName(s.mode)}${s.mode === "single" ? ` · ${C.TESTS[s.plan[0].id]?.name || ""}` : ""} · ${C.diffName(s.diff)} · ${row.total}점 ${row.tier}`;
        sb.from("streamer_chat_log").insert({ platform: "feel", channel_id: saved, nickname: prof.nick, content_id: null, content_title: title, content_mode: s.mode, room_code: saved, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error: le }) => { if (le) console.error("[feel] streamer log", le.message); }, () => {});
      }
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prev: prev ? { total: prev.total, tier: prev.tier, scores: prev.scores, at: prev.created_at } : null, best, newBest };
      reply({ ok: true, ...s.finished });
    });
    on("feel:setPublic", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("feel_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("feel:history", async (_p, reply) => {
      if (!sb) return reply({ ok: true, rows: [] });
      const { data } = await sb.from("feel_results").select("id, mode, diff, device, total, tier, style, scores, done, is_public, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(60);
      reply({ ok: true, rows: data || [] });
    });
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-iq-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/feel/result/:id", async (req, res) => {
    try {
      if (!sb) return res.status(503).json({ ok: false, error: "NO_DB" });
      const { data: row, error } = await sb.from("feel_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      res.json({ ok: true, result: publicRow(row, { owner: mine }) });
    } catch (e) { console.error("[feel/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 랭킹: 영구 유지(초기화·기간 탭 없음, 검사가 추가돼도 지난 기록 그대로) · 난이도별로만 · 종합은 전체 검사 · 검사별은 개별/전체 검사 모두 · 의심 기록 제외 · 사람당 최고 1개
  // 기기 영향이 큰 검사(dev)는 화면에서 기기별 보기를 기본으로 권장
  const rankCache = new Map();
  app.get("/feel/ranking", async (req, res) => {
    try {
      if (!sb) return res.status(503).json({ ok: false, error: "NO_DB" });
      const diff = C.okDiff(req.query.diff), board = ["total", "test", "streamer"].includes(req.query.board) ? req.query.board : "total";
      const test = C.TESTS[req.query.test]?.ready ? req.query.test : C.READY[0];
      const period = ["week", "month", "all"].includes(req.query.period) ? req.query.period : "all";
      const dev = ["pc", "mobile"].includes(req.query.device) ? req.query.device : null;
      const ck = JSON.stringify([diff, board, test, period, dev]);
      const hit = rankCache.get(ck); if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      let q = sb.from("feel_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, total, tier, style, scores, done, device, is_streamer, created_at").eq("diff", diff).eq("is_public", true).eq("flagged", false);
      if (board === "test") q = q.not(`scores->${test}`, "is", null).order(`scores->${test}`, { ascending: false }).order("created_at", { ascending: true });
      else { q = q.eq("mode", "full"); if (board === "streamer") q = q.eq("is_streamer", true); q = q.order("total", { ascending: false }).order("created_at", { ascending: true }); }
      if (dev) q = q.eq("device", dev);
      const since = period === "week" ? Date.now() - 7 * 864e5 : period === "month" ? Date.now() - 30 * 864e5 : null;
      if (since) q = q.gte("created_at", new Date(since).toISOString());
      const { data, error } = await q.limit(800);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, total: r.total, tier: r.tier, style: r.style, score: board === "test" ? r.scores?.[test] ?? null : null, done: r.done, device: r.device, isGuest: !r.user_id, isStreamer: !!r.is_streamer, at: r.created_at }); if (rows.length >= 100) break; }
      const body = { ok: true, diff, board, test, period, device: dev, setVer: C.SET_VERSION, devSensitive: board === "test" && !!C.TESTS[test].dev, rows };
      rankCache.set(ck, { at: Date.now(), body }); if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[feel/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _feelTest = { SESS };
