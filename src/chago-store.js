// =========================
// 차고차고 — DB 저장·조회 (서버 전용). service_role 로만 접근한다.
//   · 테이블이 아직 없으면(SQL 미적용) 게임은 그대로 돌고 기록만 건너뛴다. 60초마다 다시 확인하므로 SQL 적용 후 재시작이 필요 없다.
//   · 경기 기록 + 레이팅 증감은 DB 함수 chago_apply_match() 한 번으로 처리(중복 기록 방지, 동시성 안전).
// =========================

const RECHECK_MS = 60_000;

function isMissing(err) {
  const c = String(err?.code || ""), m = String(err?.message || "");
  return c === "42P01" || c === "PGRST205" || c === "42883" || c === "PGRST202" || /does not exist|schema cache|Could not find/i.test(m);
}

export function createStore(db, log = console) {
  let downUntil = 0, warned = false;
  const up = () => Date.now() >= downUntil;
  function markDown(err) {
    downUntil = Date.now() + RECHECK_MS;
    if (!warned) { warned = true; log.warn("[chago-store] DB 테이블/함수가 없어 기록을 건너뜁니다 (sql/schema_chago.sql 적용 전). 60초마다 재확인:", err?.message || err); }
  }
  async function run(fn, fallback) {
    if (!db || !up()) return fallback;
    try {
      const r = await fn(db);
      if (r && r.error) {
        if (isMissing(r.error)) { markDown(r.error); return fallback; }
        log.error("[chago-store]", r.error.message || r.error);
        return fallback;
      }
      warned = false;
      return r ? r.data ?? fallback : fallback;
    } catch (e) {
      if (isMissing(e)) markDown(e); else log.error("[chago-store] exception", e?.message || e);
      return fallback;
    }
  }

  async function names(uids) {
    const out = {};
    const ids = [...new Set(uids.filter(Boolean))];
    if (!ids.length || !db) return out;
    try {
      const { data } = await db.from("profiles").select("id, nickname, avatar_url").in("id", ids);
      for (const r of data || []) out[r.id] = { nickname: r.nickname, avatar_url: r.avatar_url };
    } catch {}
    return out;
  }

  return {
    get enabled() { return up(); },

    async loadRatings(uids, season) {
      const ids = [...new Set(uids.filter(Boolean))];
      if (!ids.length) return {};
      const rows = await run((d) => d.from("chago_ratings").select("user_id, rating, ranked_games").eq("season", season).in("user_id", ids), []);
      const out = {};
      for (const r of rows) out[r.user_id] = { rating: r.rating, ranked_games: r.ranked_games };
      return out;
    },

    // 한 경기 기록 + 레이팅 반영. 이미 기록된 경기면 null.
    async recordMatch(m, players) {
      const id = await run((d) => d.rpc("chago_apply_match", { m, pl: players }), null);
      return id || null;
    },

    async leaderboard(season, limit = 50) {
      const rows = await run((d) => d.from("chago_ratings").select("user_id, rating, peak, ranked_games, wins, losses, goals, assists, mvps")
        .eq("season", season).gte("ranked_games", 3).order("rating", { ascending: false }).order("wins", { ascending: false }).limit(Math.min(200, limit)), []);
      const nm = await names(rows.map((r) => r.user_id));
      return rows.map((r, i) => ({ rank: i + 1, ...r, nickname: nm[r.user_id]?.nickname || "(익명)", avatar_url: nm[r.user_id]?.avatar_url || null }));
    },

    async me(uid, season) {
      const rows = await run((d) => d.from("chago_ratings").select("*").eq("season", season).eq("user_id", uid).limit(1), []);
      const mine = rows[0] || null;
      let rank = null;
      if (mine && mine.ranked_games >= 3) {
        try {
          const r = await db.from("chago_ratings").select("user_id", { count: "exact", head: true }).eq("season", season).gte("ranked_games", 3).gt("rating", mine.rating);
          if (!r.error && typeof r.count === "number") rank = r.count + 1;
        } catch {}
      }
      return { stats: mine, rank };
    },

    async history(uid, limit = 10) {
      const rows = await run((d) => d.from("chago_match_players").select("match_id, team, goals, assists, saves, perf, mvp, rating_delta, abandoned, chago_matches(mode, team_size, score_a, score_b, winner, end_reason, ended_at, season)")
        .eq("user_id", uid).order("match_id", { ascending: false }).limit(Math.min(50, limit)), []);
      return rows;
    },

    async createReport(r) {
      const row = await run((d) => d.from("chago_reports").insert(r).select("id").single(), null);
      return row ? row.id : null;
    },

    // ----- 관리자 -----
    async listReports(status = "pending", limit = 200) {
      const rows = await run((d) => {
        let q = d.from("chago_reports").select("*").order("created_at", { ascending: false }).limit(limit);
        if (status !== "all") q = q.eq("status", status);
        return q;
      }, []);
      const nm = await names(rows.flatMap((r) => [r.reporter_id, r.target_user_id]));
      return rows.map((r) => ({ ...r, reporter_name: nm[r.reporter_id]?.nickname || null, target_nick: nm[r.target_user_id]?.nickname || null }));
    },
    async updateReport(id, status, note) {
      const patch = { status, reviewed_at: new Date().toISOString() };
      if (note != null) patch.note = String(note).slice(0, 500);
      const row = await run((d) => d.from("chago_reports").update(patch).eq("id", id).select("id").single(), null);
      return !!row;
    },
    async recentMatches(limit = 40) {
      const ms = await run((d) => d.from("chago_matches").select("*").order("ended_at", { ascending: false }).limit(Math.min(200, limit)), []);
      if (!ms.length) return [];
      const ps = await run((d) => d.from("chago_match_players").select("match_id, eid, team, user_id, name, bot, goals, assists, saves, perf, mvp, abandoned, late, flags, rating_delta").in("match_id", ms.map((m) => m.id)), []);
      const nm = await names(ps.map((p) => p.user_id));
      const by = {};
      for (const p of ps) (by[p.match_id] ||= []).push({ ...p, nickname: nm[p.user_id]?.nickname || null });
      return ms.map((m) => ({ ...m, players: (by[m.id] || []).sort((a, b) => a.team - b.team || a.eid - b.eid) }));
    },
    async setRating(season, uid, rating) {
      const r = Math.max(0, Math.min(5000, Math.round(Number(rating))));
      const row = await run((d) => d.from("chago_ratings").upsert({ season, user_id: uid, rating: r, peak: r, updated_at: new Date().toISOString() }, { onConflict: "season,user_id" }).select("rating").single(), null);
      return row ? row.rating : null;
    },
    async deleteRating(season, uid) {
      const rows = await run((d) => d.from("chago_ratings").delete().eq("season", season).eq("user_id", uid).select("user_id"), []);
      return rows.length > 0;
    },
    async counts() {
      if (!db || !up()) return { enabled: false };
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const head = async (q) => { try { const r = await q; if (r.error) { if (isMissing(r.error)) markDown(r.error); return null; } return r.count; } catch { return null; } };
      const [total, week, pending] = await Promise.all([
        head(db.from("chago_matches").select("id", { count: "exact", head: true })),
        head(db.from("chago_matches").select("id", { count: "exact", head: true }).gte("ended_at", since)),
        head(db.from("chago_reports").select("id", { count: "exact", head: true }).eq("status", "pending")),
      ]);
      return { enabled: up() && total != null, matches: total, matches7d: week, pendingReports: pending };
    },
  };
}
