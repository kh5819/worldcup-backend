// =========================
// 게이머 에이징 커브 진단소 — 솔로 검사 서버
// 소켓 clinic:* (세션·검사 시작·제출·발급·기록) + REST /clinic/* (결과 보기·랭킹)
// 채점은 clinic-core.js(화면과 같은 파일)로 서버가 다시 계산 → 클라 점수는 안 믿음
// DB: clinic_results / clinic_best (sql/clinic_tables.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./clinic-core.js";

const SESS = new Map();          // sid → session
const SESS_TTL = 60 * 60 * 1000;
const MAX_SESS_PER_USER = 4;
const LOG_MAX_BYTES = 60000;
const TIME_SLACK = 2500;         // 기록 길이 vs 서버 경과 시간 허용 오차(ms)

function sid() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function resultId() {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = ""; for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const device = (d) => (d === "mobile" ? "mobile" : "pc");

// 기록 안의 가장 늦은 시각(ms) — 서버 경과 시간보다 길면 시간 조작
export function logSpan(tid, spec, log) {
  const mx = (a) => a.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
  try {
    switch (tid) {
      case "tap": case "greenlight": return mx(log.t || []);
      case "qwer": return mx((log.k || []).map((e) => e?.[1]));
      case "lasthit": return mx((log.a || []).map((e) => e?.[1]));
      case "rhythm": return mx((log.h || []).map((e) => e?.[1]));
      case "aim": return mx((log.c || []).map((e) => e?.[0]));
      case "stroop": return mx((log.a || []).map((e) => e?.[1]));
      case "dodge": return Math.floor((log.p || []).length / 2) * spec.tick;
      case "fly": return Math.floor((log.p || []).length / 3) * spec.tick;
      case "memory": return (log.r || []).reduce((s, r) => s + (Number(r?.ms) || 0), 0);
      case "smash": return (log.s || []).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
      case "reaction": return 0;
    }
  } catch {}
  return 0;
}

// 제출 하나 채점 + 시간 검증 (멀티도 재사용)
export function judgeSubmit(tid, seed, log, dev, elapsedMs) {
  const spec = C.genSpec(tid, seed);
  let bytes = 0;
  try { bytes = JSON.stringify(log ?? {}).length; } catch { bytes = LOG_MAX_BYTES + 1; }
  if (bytes > LOG_MAX_BYTES) return { id: tid, score: 0, m: {}, flags: ["LOG_TOO_BIG"], line: "기록 오류" };
  const r = C.scoreTest(tid, spec, log, { device: dev });
  if (Number.isFinite(elapsedMs) && logSpan(tid, spec, log || {}) > elapsedMs + TIME_SLACK) {
    r.flags = [...r.flags, "TIME"];
    r.score = Math.min(r.score, 40);
  }
  return r;
}

function userKey(me) { return me.isGuest ? `g:${me.id}` : `u:${me.id}`; }

function sweep() {
  const now = Date.now();
  for (const [k, s] of SESS) if (now - s.createdAt > SESS_TTL) SESS.delete(k);
}

async function saveResult(sb, row) {
  if (!sb) return null;
  try {
    const { error } = await sb.from("clinic_results").insert(row);
    if (error) { console.error("[clinic] save", error.message); return null; }
    return row.id;
  } catch (e) { console.error("[clinic] save", e?.message); return null; }
}

async function prevResult(sb, key) {
  if (!sb) return null;
  try {
    const { data } = await sb.from("clinic_results").select("total, phys, mode, created_at")
      .eq("owner_key", key).order("created_at", { ascending: false }).limit(1);
    return data?.[0] || null;
  } catch { return null; }
}

async function updateBest(sb, key, me, nick, tid, dev, r) {
  if (!sb || r.flags.length) return { isNewBest: false, best: null };
  try {
    const { data: ex } = await sb.from("clinic_best").select("score").eq("owner_key", key).eq("test_id", tid).eq("device", dev).maybeSingle();
    if (ex && ex.score >= r.score) return { isNewBest: false, best: ex.score };
    const row = { owner_key: key, user_id: me.isGuest ? null : me.id, nickname: nick || null, test_id: tid, device: dev, score: r.score, m: r.m, updated_at: new Date().toISOString() };
    const { error } = await sb.from("clinic_best").upsert(row, { onConflict: "owner_key,test_id,device" });
    if (error) { console.error("[clinic] best", error.message); return { isNewBest: false, best: ex?.score ?? null }; }
    return { isNewBest: true, best: r.score, prev: ex?.score ?? null };
  } catch { return { isNewBest: false, best: null }; }
}

// 결과 행 → 화면용 (개인정보: 공개 결과도 닉네임·성별·나이만, 소유 키는 절대 안 내보냄)
export function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  const showG = owner || row.show_gender !== false, showA = owner || row.show_age !== false;
  let diag = row.diag;
  if (!showA && diag) {   // 나이를 숨기면 나이 차이·그 문장도 숨김 (피지컬 나이 - 차이 = 실제 나이가 되므로)
    diag = { ...diag, age: null, diff: null, opinion: (diag.opinion || []).filter((_, i) => i !== diag.ageLine) };
  }
  return {
    id: row.id, nick: row.nickname, gender: showG ? row.gender : null, age: showA ? row.age : null, avatar: row.avatar, mode: row.mode, device: row.device,
    scores: row.scores, metrics: row.metrics, total: row.total, phys: row.phys, diff: showA ? row.diff : null, diag,
    isPublic: row.is_public, flagged: row.flagged, groupId: row.group_id || null, rank: row.rank, of: row.rank_of, createdAt: row.created_at,
    showGender: row.show_gender !== false, showAge: row.show_age !== false, isGuest: !row.user_id, mine: owner,
  };
}

// 진단명·유형을 세 언어로 (랭킹·단체 결과에서 보는 사람 언어로 바로 보여 주려고)
export function withI18n(diag, args) {
  const out = { ...diag, i18n: {} };
  for (const lang of ["ja", "en"]) {
    try { const d = C.diagnose({ ...args, lang }); out.i18n[lang] = { title: d.title, sub: d.sub, type: d.type.name }; } catch {}
  }
  return out;
}

// 회원 프로필(플레이듀오 profiles) — 읽기만, 절대 수정 안 함
const memberCache = new Map();
export async function memberProfile(sb, me) {
  if (!sb || me.isGuest) return null;
  const c = memberCache.get(me.id);
  if (c && Date.now() - c.at < 60000) return c.v;
  let v = null;
  try { const { data } = await sb.from("profiles").select("nickname, avatar_url").eq("id", me.id).maybeSingle(); if (data) v = { nickname: data.nickname || null, avatar_url: data.avatar_url || null }; } catch {}
  memberCache.set(me.id, { at: Date.now(), v });
  if (memberCache.size > 5000) memberCache.clear();
  return v;
}
// 진단소 전용 접수 정보(성별·나이·캐릭터·공개 설정) — clinic_profiles
export function sanitizePrefs(p) { return { showGender: p?.showGender !== false, showAge: p?.showAge !== false, shareMulti: !!p?.shareMulti }; }
async function loadClinicProfile(sb, key) {
  if (!sb) return null;
  try { const { data } = await sb.from("clinic_profiles").select("nickname, gender, age, avatar, prefs, updated_at").eq("owner_key", key).maybeSingle(); return data || null; } catch { return null; }
}
async function saveClinicProfile(sb, key, me, prof, prefs) {
  if (!sb) return false;
  try {
    const now = new Date().toISOString();
    const { error } = await sb.from("clinic_profiles").upsert({ owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, gender: prof.gender, age: prof.age, avatar: prof.avatar, prefs, updated_at: now }, { onConflict: "owner_key" });
    return !error;
  } catch { return false; }
}

export function registerClinic(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  setInterval(sweep, 5 * 60 * 1000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const key = userKey(me);
    // 자체 속도 제한: 10초에 40회
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 40; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });

    // 검사 세션 시작 — mode: full | quick | practice(test 하나)
    on("clinic:begin", (p, reply) => {
      let tests;
      if (p.mode === "practice") {
        if (!C.TESTS[p.test]) return reply({ ok: false, error: "BAD_TEST" });
        tests = [p.test];
      } else if (C.MODES[p.mode]) tests = C.MODES[p.mode].tests;
      else return reply({ ok: false, error: "BAD_MODE" });
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS_PER_USER) SESS.delete(mine.shift()[0]);
      const id = sid();
      const s = { key, mode: p.mode, device: device(p.device), createdAt: Date.now(), plan: tests.map((t) => ({ id: t, seed: newSeed() })), started: {}, results: {}, finished: false };
      SESS.set(id, s);
      reply({ ok: true, sid: id, plan: s.plan, device: s.device, coreVersion: C.CORE_VERSION });
    });

    // 새로고침 후 이어하기: 내 세션이면 계획·결과 돌려줌 (진행 중이던 검사는 다시 시작)
    on("clinic:resume", (p, reply) => {
      const s = SESS.get(p.sid);
      if (!s || s.key !== key || s.finished || s.mode === "practice") return reply({ ok: false, error: "NO_SESSION" });
      const results = s.plan.map((_, i) => s.results[i] || null);
      const idx = results.findIndex((x) => !x);
      reply({ ok: true, mode: s.mode, plan: s.plan, results, idx: idx < 0 ? s.plan.length : idx });
    });

    on("clinic:testStart", (p, reply) => {
      const s = SESS.get(p.sid);
      if (!s || s.key !== key) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      if (!s.plan[i]) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: false, error: "ALREADY_DONE" });
      if (s.plan.slice(0, i).some((_, j) => !s.results[j])) return reply({ ok: false, error: "BAD_ORDER" });   // 순서 건너뛰기 금지
      s.started[i] = Date.now();
      reply({ ok: true });
    });

    on("clinic:submit", async (p, reply) => {
      const s = SESS.get(p.sid);
      if (!s || s.key !== key) return reply({ ok: false, error: "NO_SESSION" });
      const i = p.idx | 0;
      const item = s.plan[i];
      if (!item) return reply({ ok: false, error: "BAD_IDX" });
      if (s.results[i]) return reply({ ok: true, result: s.results[i], dup: true });
      if (!s.started[i]) return reply({ ok: false, error: "NOT_STARTED" });
      const r = judgeSubmit(item.id, item.seed, p.log, s.device, Date.now() - s.started[i]);
      s.results[i] = r;
      let best = null;
      if (s.mode === "practice") best = await updateBest(supabaseAdmin, key, me, String(p.nick || "").slice(0, 12), item.id, s.device, r);
      reply({ ok: true, result: r, best });
    });

    // 진단서 발급 — 모든 검사 제출 후
    on("clinic:finish", async (p, reply) => {
      const s = SESS.get(p.sid);
      if (!s || s.key !== key) return reply({ ok: false, error: "NO_SESSION" });
      if (s.mode === "practice") return reply({ ok: false, error: "PRACTICE" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      const prof = C.sanitizeProfile(p.profile);
      if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(supabaseAdmin, me);
      if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);   // 회원 = 플레이듀오 프로필 닉네임
      const prefs = sanitizePrefs(p.prefs);
      if (s.plan.some((_, i) => !s.results[i])) return reply({ ok: false, error: "NOT_COMPLETE" });
      const results = {};
      s.plan.forEach((it, i) => { results[it.id] = s.results[i]; });
      const prev = await prevResult(supabaseAdmin, key);
      const seed = C.hashSeed(p.sid);
      const dArgs = { results, age: prof.age, gender: prof.gender, seed, prev: prev && prev.mode === s.mode ? prev : null };
      const diag = withI18n(C.diagnose(dArgs), dArgs);
      const id = resultId();
      const row = {
        id, owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, gender: prof.gender, age: prof.age, avatar: prof.avatar,
        mode: s.mode, device: s.device,
        scores: diag.scores, metrics: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { m: v.m, line: v.line, flags: v.flags }])),
        total: diag.total, phys: diag.phys, diff: diag.diff, diag, is_public: p.isPublic !== false, flagged: diag.flagged,
        show_gender: prefs.showGender, show_age: prefs.showAge, avatar_url: mp?.avatar_url || null,
        created_at: new Date().toISOString(),
      };
      const saved = await saveResult(supabaseAdmin, row);
      s.finished = { id: saved, result: publicRow(row, { owner: true }), prev: prev ? { total: prev.total, phys: prev.phys, at: prev.created_at } : null };
      reply({ ok: true, ...s.finished });
    });

    on("clinic:me", async (p, reply) => {
      const mp = await memberProfile(supabaseAdmin, me);
      const saved = await loadClinicProfile(supabaseAdmin, key);
      let guestRecords = 0;
      const g = String(p.guestId || "");
      if (!me.isGuest && supabaseAdmin && /^guest_[a-z0-9]{6,40}$/.test(g)) {
        try { const { count } = await supabaseAdmin.from("clinic_results").select("id", { count: "exact", head: true }).eq("owner_key", `g:${g}`); guestRecords = count || 0; } catch {}
      }
      reply({ ok: true, isGuest: !!me.isGuest, member: mp, saved, guestRecords });
    });

    on("clinic:profile:save", async (p, reply) => {
      const prof = C.sanitizeProfile(p.profile);
      if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(supabaseAdmin, me);
      if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const ok = await saveClinicProfile(supabaseAdmin, key, me, prof, sanitizePrefs(p.prefs));
      reply({ ok: true, saved: ok, nick: prof.nick });
    });

    // 게스트 기록 → 회원 계정으로 (본인 확인 후 클라가 요청). 같은 결과를 두 번 옮기지 않음(owner_key 조건)
    on("clinic:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!supabaseAdmin) return reply({ ok: false, error: "NO_DB" });
      const g = String(p.guestId || "");
      if (!/^guest_[a-z0-9]{6,40}$/.test(g)) return reply({ ok: false, error: "BAD_GUEST" });
      const from = `g:${g}`;
      const mp = await memberProfile(supabaseAdmin, me);
      const { data: moved, error } = await supabaseAdmin.from("clinic_results").update({ owner_key: key, user_id: me.id, ...(mp?.nickname ? { nickname: String(mp.nickname).slice(0, 12) } : {}) }).eq("owner_key", from).select("id");
      if (error) return reply({ ok: false, error: "UPDATE_FAIL" });
      // 검사별 최고 기록: 더 높은 쪽만 남김
      const { data: gb } = await supabaseAdmin.from("clinic_best").select("test_id, device, score, m, updated_at").eq("owner_key", from);
      for (const b of gb || []) {
        const { data: ex } = await supabaseAdmin.from("clinic_best").select("score").eq("owner_key", key).eq("test_id", b.test_id).eq("device", b.device).maybeSingle();
        if (!ex || b.score > ex.score) await supabaseAdmin.from("clinic_best").upsert({ owner_key: key, user_id: me.id, nickname: mp?.nickname || null, test_id: b.test_id, device: b.device, score: b.score, m: b.m, updated_at: b.updated_at }, { onConflict: "owner_key,test_id,device" });
      }
      await supabaseAdmin.from("clinic_best").delete().eq("owner_key", from);
      // 접수 정보: 회원 쪽이 없을 때만 가져옴
      const mineP = await loadClinicProfile(supabaseAdmin, key);
      if (!mineP) { const gp = await loadClinicProfile(supabaseAdmin, from); if (gp) await supabaseAdmin.from("clinic_profiles").upsert({ ...gp, owner_key: key, user_id: me.id }, { onConflict: "owner_key" }); }
      await supabaseAdmin.from("clinic_profiles").delete().eq("owner_key", from);
      reply({ ok: true, moved: moved?.length || 0 });
    });

    on("clinic:setPrivacy", async (p, reply) => {
      if (!supabaseAdmin) return reply({ ok: false, error: "NO_DB" });
      const prefs = sanitizePrefs(p);
      const { error } = await supabaseAdmin.from("clinic_results").update({ show_gender: prefs.showGender, show_age: prefs.showAge }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });

    on("clinic:setPublic", async (p, reply) => {
      if (!supabaseAdmin) return reply({ ok: false, error: "NO_DB" });
      const { error } = await supabaseAdmin.from("clinic_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });

    on("clinic:history", async (_p, reply) => {
      if (!supabaseAdmin) return reply({ ok: true, rows: [], best: [] });
      const [{ data: rows }, { data: best }] = await Promise.all([
        supabaseAdmin.from("clinic_results").select("id, mode, device, total, phys, diff, age, diag->>title, is_public, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(30),
        supabaseAdmin.from("clinic_best").select("test_id, device, score, m, updated_at").eq("owner_key", key),
      ]);
      reply({ ok: true, rows: rows || [], best: best || [] });
    });
  });

  if (!app) return;

  // 결과 보기 (공유 링크) — 비공개는 주인만
  app.get("/clinic/result/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16);
      const { data: row, error } = await supabaseAdmin.from("clinic_results").select("*").eq("id", id).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const user = getOptionalUser ? await getOptionalUser(req) : null;
      const g = String(req.headers["x-clinic-guest"] || "");
      const mine = (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      let group = null;
      if (row.group_id) {
        const { data: gr } = await supabaseAdmin.from("clinic_groups").select("id, tests, players, report, created_at").eq("id", row.group_id).maybeSingle();
        group = gr || null;
      }
      res.json({ ok: true, result: publicRow(row, { owner: mine }), group });
    } catch (e) { console.error("[clinic/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });

  app.get("/clinic/group/:id", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from("clinic_groups").select("id, tests, players, report, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!data) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      res.json({ ok: true, group: data });
    } catch { res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });

  // 랭킹: board=total(종합) | young(피지컬 나이 차이) | test(검사별 최고) · period=day|week|all · device=pc|mobile · age=10~60(연령대)
  const rankCache = new Map();
  app.get("/clinic/ranking", async (req, res) => {
    try {
      const board = ["total", "young", "test"].includes(req.query.board) ? req.query.board : "total";
      const period = ["day", "week", "all"].includes(req.query.period) ? req.query.period : "all";
      const dev = device(req.query.device);
      const test = C.TESTS[req.query.test] ? req.query.test : "tap";
      const ageG = [10, 20, 30, 40, 50, 60].includes(Number(req.query.age)) ? Number(req.query.age) : null;
      const ck = JSON.stringify([board, period, dev, test, ageG]);
      const hit = rankCache.get(ck);
      if (hit && Date.now() - hit.at < 30000) return res.json(hit.body);
      const since = period === "day" ? new Date(Date.now() - 864e5) : period === "week" ? new Date(Date.now() - 7 * 864e5) : null;
      let rows = [];
      if (board === "test") {
        let q = supabaseAdmin.from("clinic_best").select("owner_key, user_id, nickname, score, m, updated_at").eq("test_id", test).eq("device", dev);
        if (since) q = q.gte("updated_at", since.toISOString());
        const { data, error } = await q.order("score", { ascending: false }).order("updated_at", { ascending: true }).limit(50);
        if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
        rows = (data || []).map((r) => ({ nick: r.nickname || "익명", score: r.score, m: r.m, at: r.updated_at, isGuest: !r.user_id }));
      } else {
        let q = supabaseAdmin.from("clinic_results").select("owner_key, user_id, nickname, age, avatar, avatar_url, total, phys, diff, show_age, diag->>title, diag->i18n, created_at, id")
          .eq("mode", "full").eq("device", dev).eq("is_public", true).eq("flagged", false);
        if (since) q = q.gte("created_at", since.toISOString());
        if (ageG || board === "young") q = q.eq("show_age", true);   // 나이 비공개 결과는 나이 관련 랭킹에서 제외
        if (ageG) q = ageG === 60 ? q.gte("age", 60) : ageG === 10 ? q.lt("age", 20) : q.gte("age", ageG).lt("age", ageG + 10);
        q = board === "young" ? q.order("diff", { ascending: true }).order("total", { ascending: false }) : q.order("total", { ascending: false }).order("created_at", { ascending: true });
        const { data, error } = await q.limit(400);
        if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
        const seen = new Set();
        for (const r of data || []) {
          if (seen.has(r.owner_key)) continue;   // 사람당 최고 기록 1개
          seen.add(r.owner_key);
          const showA = r.show_age !== false;
          rows.push({ id: r.id, nick: r.nickname, ageGroup: showA ? C.ageGroup(r.age) : null, avatar: r.avatar, avatarUrl: r.avatar_url || null, total: r.total, phys: r.phys, diff: showA ? r.diff : null, title: r.title, i18n: r.i18n || null, isGuest: !r.user_id, at: r.created_at });
          if (rows.length >= 50) break;
        }
      }
      const body = { ok: true, board, period, device: dev, test, age: ageG, rows };
      rankCache.set(ck, { at: Date.now(), body });
      if (rankCache.size > 300) rankCache.clear();
      res.json(body);
    } catch (e) { console.error("[clinic/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });

  // 전체 통계 — 연령대 백분위는 그 연령대 표본이 충분할 때(100명 이상)만
  app.get("/clinic/percentile", async (req, res) => {
    try {
      const total = Math.round(Number(req.query.total));
      const age = Math.round(Number(req.query.age));
      const dev = device(req.query.device);
      if (!(total >= 0 && total <= 100) || !(age >= 7 && age <= 99)) return res.status(400).json({ ok: false });
      const lo = age < 20 ? 0 : age >= 60 ? 60 : Math.floor(age / 10) * 10, hi = age < 20 ? 20 : age >= 60 ? 200 : lo + 10;
      const base = () => supabaseAdmin.from("clinic_results").select("id", { count: "exact", head: true }).eq("mode", "full").eq("device", dev).eq("flagged", false).gte("age", lo).lt("age", hi);
      const [{ count: n }, { count: below }] = await Promise.all([base(), base().lt("total", total)]);
      if (!n || n < 100) return res.json({ ok: true, enough: false, n: n || 0 });
      res.json({ ok: true, enough: true, n, top: Math.max(1, Math.round(100 - (below / n) * 100)), group: C.ageGroup(age) });
    } catch { res.status(500).json({ ok: false }); }
  });
}
