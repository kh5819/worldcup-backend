// =========================
// 증강 모드 랭킹 (2026-11-16) — 사과게임·블록블래스트 증강 점수 전용
// 일반 랭킹(apple_scores / blockblast_scores)과 완전히 분리된 새 테이블 사용 (sql/aug_scores_20261116.sql)
// 회원은 user_id, 비로그인은 guest_id(브라우저 게스트 번호)로 사람당 최고점 1줄, TOP 50. 증강은 점수를 크게 올려 주므로 이상 점수 기준은 일반보다 넉넉함.
// =========================
const TOP = 50;
const GUEST_RE = /^guest_[a-z0-9]{6,24}$/;
const ipHits = new Map(); // 같은 IP 1분 20번까지 (게스트 도배 막기)
function tooMany(req) { const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim(), t = Date.now(), h = (ipHits.get(ip) || []).filter((x) => t - x < 60000); h.push(t); ipHits.set(ip, h); if (ipHits.size > 5000) ipHits.clear(); return h.length > 20; }
const GAMES = {
  apple: {
    table: "apple_aug_scores", cols: "user_id, guest_id, nickname, score, apples_cleared, max_combo, duration_sec, augs, created_at",
    row: (b) => ({ apples_cleared: clamp(b.applesCleared, 0, 170), max_combo: clamp(b.maxCombo, 0, 99) }),
    bad: (b, dur) => dur < 5 || dur > 175 || !(b.applesCleared >= 0 && b.applesCleared <= 170) || b.score > (b.applesCleared || 0) * 80 + 1000,
  },
  blockblast: {
    table: "blockblast_aug_scores", cols: "user_id, guest_id, nickname, score, lines_cleared, blocks_placed, max_combo, duration_sec, augs, created_at",
    row: (b) => ({ lines_cleared: clamp(b.linesCleared, 0, 9999), blocks_placed: clamp(b.blocksPlaced, 0, 9999), max_combo: clamp(b.maxCombo, 0, 99) }),
    bad: (b, dur) => dur < 3 || dur > 7200 || b.score > dur * 5000 + 5000 || (b.blocksPlaced || 0) > dur * 30 + 100,
  },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));

export function registerAugScores(app, supabaseAdmin, { getOptionalUser }) {
  async function withProfiles(rows) {
    const ids = rows.map((r) => r.user_id).filter(Boolean); for (const r of rows) { if (!r.user_id) r.is_guest = true; delete r.guest_id; } if (!ids.length) return rows;
    const { data } = await supabaseAdmin.from("profiles").select("id, nickname, avatar_url").in("id", ids);
    const m = new Map((data || []).map((p) => [p.id, p]));
    for (const r of rows) { const p = m.get(r.user_id); if (p) { if (p.nickname) r.nickname = p.nickname; r.avatar_url = p.avatar_url || null; } }
    return rows;
  }
  const rankOf = async (G, score) => { const { count } = await supabaseAdmin.from(G.table).select("user_id", { count: "exact", head: true }).eq("flagged", false).gt("score", score); const k = (count || 0) + 1; return k > TOP ? null : k; };

  for (const [game, G] of Object.entries(GAMES)) {
    app.post(`/${game}/aug/score`, async (req, res) => {
      try {
        const b = req.body || {}, score = Number(b.score), dur = Number(b.durationSec);
        if (!Number.isFinite(score) || score < 0 || score > 1e8) return res.status(400).json({ ok: false, error: "INVALID_SCORE" });
        if (!Number.isFinite(dur) || dur < 0) return res.status(400).json({ ok: false, error: "INVALID_DURATION" });
        if (tooMany(req)) return res.status(429).json({ ok: false, error: "TOO_FAST" });
        const user = await getOptionalUser(req), gid = !user?.id && GUEST_RE.test(String(b.guestId || "")) ? String(b.guestId) : null;
        if (!user?.id && !gid) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
        const key = user?.id ? ["user_id", user.id] : ["guest_id", gid];
        const prof = user?.id ? (await supabaseAdmin.from("profiles").select("nickname").eq("id", user.id).maybeSingle()).data : null;
        const nick = user?.id ? prof?.nickname || "익명" : "게스트·" + (String(b.guestName || "").replace(/[<>]/g, "").trim().slice(0, 8) || gid.slice(-4));
        const flagged = !!G.bad({ ...b, score }, dur);
        const augs = Array.isArray(b.augs) ? b.augs.slice(0, 8).map((x) => String(x).slice(0, 24)) : [];
        const payload = { user_id: user?.id || null, guest_id: gid, nickname: String(nick).slice(0, 14), score: Math.round(score), duration_sec: clamp(dur, 0, 7200), augs, flagged, client_run_id: b.clientRunId ? String(b.clientRunId).slice(0, 64) : null, created_at: new Date().toISOString(), ...G.row(b) };
        const { data: ex } = await supabaseAdmin.from(G.table).select("score, flagged").eq(key[0], key[1]).maybeSingle();
        const prev = ex && !ex.flagged ? ex.score : -1;
        // 이상 점수는 기존 정상 기록을 덮지 않음
        const isNewBest = !flagged && payload.score > prev;
        if (!ex) { const { error } = await supabaseAdmin.from(G.table).insert(payload); if (error && String(error.code) !== "23505") { console.error(`[${game}/aug/score] insert`, error.message); return res.status(500).json({ ok: false, error: "INSERT_FAIL" }); } }
        else if (isNewBest || (ex.flagged && !flagged)) { const { error } = await supabaseAdmin.from(G.table).update(payload).eq(key[0], key[1]); if (error) { console.error(`[${game}/aug/score] update`, error.message); return res.status(500).json({ ok: false, error: "UPDATE_FAIL" }); } }
        const best = isNewBest ? payload.score : Math.max(prev, flagged ? -1 : payload.score);
        res.json({ ok: true, isNewBest, bestScore: best, flagged, official: !flagged, globalRank: !flagged && best >= 0 ? await rankOf(G, best) : null });
      } catch (e) { console.error(`[${game}/aug/score]`, e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
    app.get(`/${game}/aug/leaderboard/global`, async (_req, res) => {
      try {
        const { data, error } = await supabaseAdmin.from(G.table).select(G.cols).eq("flagged", false).order("score", { ascending: false }).order("created_at", { ascending: true }).limit(TOP);
        if (error) { console.error(`[${game}/aug/leaderboard]`, error.message); return res.status(500).json({ ok: false, error: "QUERY_FAIL" }); }
        res.json({ ok: true, rows: await withProfiles(data || []) });
      } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
    app.get(`/${game}/aug/leaderboard/me`, async (req, res) => {
      try {
        const user = await getOptionalUser(req); if (!user?.id) return res.json({ ok: true, row: null });
        const { data, error } = await supabaseAdmin.from(G.table).select(G.cols).eq("flagged", false).eq("user_id", user.id).maybeSingle();
        if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
        const row = data ? (await withProfiles([data]))[0] : null; if (row) row.global_rank = await rankOf(G, row.score);
        res.json({ ok: true, row });
      } catch (e) { console.error(e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
  }
}
