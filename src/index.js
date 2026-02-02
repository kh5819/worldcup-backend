import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));


// ── CORS 허용 Origin 목록 ──
// 환경변수 FRONTEND_ORIGINS (쉼표 구분)로 관리, 하드코딩 폴백 포함
const ALLOWED_ORIGINS = new Set([
  "https://worldcup-frontend.pages.dev",
  "https://playduo.kr",
  "https://www.playduo.kr",
]);
// 환경변수에서 추가 (FRONTEND_ORIGINS 우선, legacy FRONTEND_ORIGIN도 지원)
const envOrigins = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "";
envOrigins.split(",").forEach((o) => {
  const trimmed = o.trim();
  if (trimmed) ALLOWED_ORIGINS.add(trimmed);
});

console.log("[CORS] 허용 origin 목록:", [...ALLOWED_ORIGINS]);

/**
 * origin 검사 함수 — Express cors + Socket.IO cors 공용
 * 핵심: callback(null, origin) 으로 "요청 origin 그대로" 1개만 반환.
 *       callback(null, true) 는 credentials 환경에서 다중 헤더 문제를 일으킴.
 */
function checkOrigin(origin, callback) {
  // origin 없는 요청(Postman, 서버간, React Native 등) 허용
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.has(origin)) return callback(null, origin);
  console.error(`[CORS] 차단된 origin: "${origin}"  허용 목록: [${[...ALLOWED_ORIGINS].join(", ")}]`);
  callback(new Error(`CORS: origin '${origin}' is not allowed`));
}

app.use(cors({
  origin: checkOrigin,
  credentials: true
}));

// Supabase (토큰 검증용)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Supabase (DB 조회용 — SERVICE_ROLE_KEY 권장, 없으면 ANON_KEY 폴백)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});
// =========================
// 홈 리스트 API
// GET /contents?type=worldcup|quiz|all&sort=popular|newest&limit=24
// =========================
app.get("/contents", async (req, res) => {
  try {
    // 1) 쿼리 파라미터 받기
    const type = String(req.query.type || "all");      // worldcup | quiz | all
    const sort = String(req.query.sort || "popular");  // popular | newest
    const limitRaw = Number(req.query.limit || 24);
    const limit = Math.min(60, Math.max(1, limitRaw)); // 1~60 제한

    // 2) 기본 쿼리: public_contents_list(View)에서 읽기
    //    (홈에서 공개용으로 만든 view라 이게 가장 안전/간단)
    let q = supabaseAdmin
      .from("public_contents_list")
      .select("id, type, title, thumbnail_url, creator_name, play_count, created_at")
      .limit(limit);

    // 3) type 필터 적용
    if (type === "worldcup" || type === "quiz") {
      q = q.eq("type", type);
    }

    // 4) 정렬 적용
    if (sort === "newest") {
      q = q.order("created_at", { ascending: false });
    } else {
      // 기본 popular
      q = q.order("play_count", { ascending: false }).order("created_at", { ascending: false });
    }

    // 5) 실행
    const { data, error } = await q;
    if (error) {
      console.error("GET /contents error:", error);
      return res.status(500).json({ ok: false, error: "DB_QUERY_FAILED" });
    }

    // 6) 응답
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /contents internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

const server = http.createServer(app);

// Socket.IO — Express와 동일한 origin 정책 적용
const io = new Server(server, {
  cors: {
    origin: checkOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});



async function verify(accessToken) {
  if (!accessToken) return null;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;

  const email = data.user.email || "";
  const isAdmin = (email && process.env.ADMIN_EMAIL
    && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase())
    || (process.env.ADMIN_USER_ID && data.user.id === process.env.ADMIN_USER_ID);

  return { id: data.user.id, email, isAdmin };
}

// =========================
// Express 미들웨어: 인증 / 관리자
// =========================
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = await verify(token);
  if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const user = await verify(token);
  if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  if (!user.isAdmin) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  req.user = user;
  next();
}

// =========================
// 신고 API
// =========================
app.post("/reports", requireAuth, async (req, res) => {
  try {
    const { contentId, reason, detail } = req.body;
    if (!contentId || !reason) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    const { error } = await supabaseAdmin.from("reports").insert({
      content_id: contentId,
      reporter_user_id: req.user.id,
      reason,
      detail: detail || null,
    });

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ ok: false, error: "ALREADY_REPORTED" });
      }
      console.error("POST /reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /reports internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 관리자 API
// =========================
app.get("/admin/reports", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("*, contents(id, title, is_hidden, report_count)")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /admin/reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.get("/admin/contents", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("contents")
      .select("id, title, mode, visibility, is_hidden, hidden_reason, report_count, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /admin/contents:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.patch("/admin/contents/:id/hide", requireAdmin, async (req, res) => {
  try {
    const { is_hidden, hidden_reason } = req.body;
    const { error } = await supabaseAdmin
      .from("contents")
      .update({ is_hidden: !!is_hidden, hidden_reason: hidden_reason || null })
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: is_hidden ? "hide" : "unhide",
      target_type: "content",
      target_id: req.params.id,
      detail: hidden_reason || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/contents/:id/hide:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.delete("/admin/contents/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("contents")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "delete",
      target_type: "content",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/contents/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.post("/admin/users/:userId/ban", requireAdmin, async (req, res) => {
  try {
    const { reason, expires_at } = req.body;
    const { error } = await supabaseAdmin.from("bans").insert({
      user_id: req.params.userId,
      reason: reason || null,
      expires_at: expires_at || null,
    });
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "ban",
      target_type: "user",
      target_id: req.params.userId,
      detail: reason || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/users/:userId/ban:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.delete("/admin/users/:userId/ban", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("bans")
      .delete()
      .eq("user_id", req.params.userId);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "unban",
      target_type: "user",
      target_id: req.params.userId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/users/:userId/ban:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

app.get("/admin/bans", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("bans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /admin/bans:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 내 콘텐츠 API (제작자 수정/삭제)
// =========================

// 내가 만든 콘텐츠 목록
app.get("/my/contents", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("contents")
      .select("id, title, mode, visibility, play_count, timer_enabled, category, tags, thumbnail_url, description, created_at")
      .eq("owner_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /my/contents:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 콘텐츠 상세 조회 (후보/문제 포함)
app.get("/my/contents/:id", requireAuth, async (req, res) => {
  try {
    const { data: content, error: cErr } = await supabaseAdmin
      .from("contents")
      .select("*")
      .eq("id", req.params.id)
      .eq("owner_id", req.user.id)
      .single();
    if (cErr || !content) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    let children = [];
    if (content.mode === "worldcup") {
      const { data } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("*")
        .eq("content_id", content.id)
        .order("sort_order", { ascending: true });
      children = data || [];
    } else if (content.mode === "quiz") {
      const { data } = await supabaseAdmin
        .from("quiz_questions")
        .select("*")
        .eq("content_id", content.id)
        .order("sort_order", { ascending: true });
      children = data || [];
    }

    return res.json({ ok: true, content, children });
  } catch (err) {
    console.error("GET /my/contents/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 콘텐츠 수정
app.put("/my/contents/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, visibility, category, tags, thumbnail_url, timer_enabled, candidates, questions } = req.body;

    // owner 확인
    const { data: existing, error: eErr } = await supabaseAdmin
      .from("contents")
      .select("id, owner_id, mode")
      .eq("id", req.params.id)
      .single();
    if (eErr || !existing) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (existing.owner_id !== req.user.id) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    // contents 업데이트
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description || null;
    if (visibility !== undefined) updates.visibility = visibility;
    if (category !== undefined) updates.category = category || null;
    if (tags !== undefined) updates.tags = tags && tags.length > 0 ? tags : null;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url || null;
    if (timer_enabled !== undefined) updates.timer_enabled = !!timer_enabled;

    if (Object.keys(updates).length > 0) {
      const { error: uErr } = await supabaseAdmin
        .from("contents")
        .update(updates)
        .eq("id", req.params.id);
      if (uErr) return res.status(500).json({ ok: false, error: "UPDATE_FAILED" });
    }

    // 후보/문제 교체 (전체 삭제 후 재삽입)
    if (existing.mode === "worldcup" && candidates && Array.isArray(candidates)) {
      await supabaseAdmin.from("worldcup_candidates").delete().eq("content_id", req.params.id);
      const rows = candidates.map((c, i) => ({
        content_id: req.params.id,
        name: c.name,
        media_type: c.media_type || "image",
        media_url: c.media_url || "",
        start_sec: c.start_sec || null,
        duration_sec: c.duration_sec || null,
        sort_order: i + 1,
      }));
      if (rows.length > 0) {
        const { error: iErr } = await supabaseAdmin.from("worldcup_candidates").insert(rows);
        if (iErr) console.error("후보 재삽입 실패:", iErr);
      }
    }

    if (existing.mode === "quiz" && questions && Array.isArray(questions)) {
      await supabaseAdmin.from("quiz_questions").delete().eq("content_id", req.params.id);
      const rows = questions.map((q, i) => ({
        content_id: req.params.id,
        sort_order: i + 1,
        type: q.type || "mcq",
        prompt: q.prompt,
        choices: q.choices || [],
        answer: q.answer || [],
        media_type: q.media_type || null,
        media_url: q.media_url || null,
        start_sec: q.start_sec || 0,
        duration_sec: q.duration_sec || 10,
      }));
      if (rows.length > 0) {
        const { error: iErr } = await supabaseAdmin.from("quiz_questions").insert(rows);
        if (iErr) console.error("문제 재삽입 실패:", iErr);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /my/contents/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 콘텐츠 삭제 (CASCADE로 후보/문제도 삭제됨)
app.delete("/my/contents/:id", requireAuth, async (req, res) => {
  try {
    const { data: existing, error: eErr } = await supabaseAdmin
      .from("contents")
      .select("id, owner_id")
      .eq("id", req.params.id)
      .single();
    if (eErr || !existing) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (existing.owner_id !== req.user.id) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const { error } = await supabaseAdmin
      .from("contents")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DELETE_FAILED" });

    console.log(`[콘텐츠 삭제] userId=${req.user.id} contentId=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /my/contents/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// play_count 증가 헬퍼 (서버 전용, 중복 방지)
// =========================
async function incrementPlayCount(contentId) {
  try {
    // service_role로 직접 업데이트 (RLS bypass)
    const { data: row } = await supabaseAdmin
      .from("contents")
      .select("play_count")
      .eq("id", contentId)
      .single();
    if (row) {
      await supabaseAdmin
        .from("contents")
        .update({ play_count: (row.play_count || 0) + 1 })
        .eq("id", contentId);
      console.log(`[play_count +1] contentId=${contentId} → ${(row.play_count || 0) + 1}`);
    }
  } catch (err) {
    console.error(`[play_count 증가 실패] contentId=${contentId}`, err);
    // 게임 종료 흐름은 깨지지 않게 에러만 로그
  }
}

// =========================
// play_count 정확 누적 — 완주 시점 기록 + 쿨다운 스팸 방지
// =========================
const PLAY_COOLDOWN_SEC = Number(process.env.PLAY_COOLDOWN_SEC) || 60;

/**
 * recordPlayOnce — 게임 완주 시 play_count +1 (쿨다운 내 중복 차단)
 * @param {object} opts
 * @param {string} opts.contentId - 콘텐츠 UUID
 * @param {string} opts.userId    - 유저 UUID
 * @param {"solo"|"multi"} opts.mode
 * @param {"worldcup"|"quiz"} opts.gameType
 */
async function recordPlayOnce({ contentId, userId, mode, gameType }) {
  try {
    if (!contentId || !userId) return;

    // 쿨다운 체크: 같은 유저+콘텐츠의 최근 기록
    const cooldownThreshold = new Date(Date.now() - PLAY_COOLDOWN_SEC * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("content_plays")
      .select("id")
      .eq("content_id", contentId)
      .eq("user_id", userId)
      .gte("created_at", cooldownThreshold)
      .limit(1);

    if (recent && recent.length > 0) {
      console.log(`[recordPlayOnce] 쿨다운 스킵 — contentId=${contentId} userId=${userId} (${PLAY_COOLDOWN_SEC}초 이내)`);
      return;
    }

    // content_plays 로그 삽입
    const { error: logErr } = await supabaseAdmin.from("content_plays").insert({
      content_id: contentId,
      user_id: userId,
      mode,
      game_type: gameType,
    });
    if (logErr) {
      console.warn(`[recordPlayOnce] content_plays insert error:`, logErr.message);
      return;
    }

    // play_count +1
    await incrementPlayCount(contentId);
    console.log(`[recordPlayOnce] OK — contentId=${contentId} userId=${userId} mode=${mode} type=${gameType}`);
  } catch (err) {
    console.error(`[recordPlayOnce] error:`, err);
    // fire-and-forget: 게임 흐름 깨뜨리지 않음
  }
}

// =========================
// 솔로 월드컵 결과 기록 API
// =========================
app.post("/worldcup/finish", requireAuth, async (req, res) => {
  try {
    const {
      contentId, content_id,
      mode,
      totalPlayers, total_players,
      championCandidateId, champion_candidate_id,
      matches,
    } = req.body;

    const cId = contentId || content_id;
    const champId = championCandidateId || champion_candidate_id;
    const players = totalPlayers || total_players || 1;

    if (!cId || !champId) {
      return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
    }

    // 1) worldcup_runs insert
    const { error: runErr } = await supabaseAdmin.from("worldcup_runs").insert({
      content_id: cId,
      room_id: null,
      total_players: players,
      champion_candidate_id: champId,
      meta: { mode: mode || "solo", user_id: req.user.id, inserted_matches: (matches || []).length },
    });
    if (runErr) {
      console.warn("[POST /worldcup/finish] worldcup_runs insert error:", runErr.message);
      return res.status(500).json({ ok: false, error: "RUN_INSERT_FAILED" });
    }

    // 2) worldcup_matches bulk insert
    if (Array.isArray(matches) && matches.length > 0) {
      const rows = matches.map((m) => ({
        content_id: cId,
        room_id: null,
        match_round: m.match_round || null,
        candidate_a_id: m.candidate_a_id || null,
        candidate_b_id: m.candidate_b_id || null,
        winner_candidate_id: m.winner_candidate_id || null,
        loser_candidate_id: m.loser_candidate_id || null,
        is_tie: !!m.is_tie,
        meta: m.meta || {},
      }));

      const { error: matchErr } = await supabaseAdmin.from("worldcup_matches").insert(rows);
      if (matchErr) {
        console.warn("[POST /worldcup/finish] worldcup_matches insert error:", matchErr.message);
      }
    }

    // play_count +1 (솔로 월드컵 완주 시점, fire-and-forget)
    recordPlayOnce({ contentId: cId, userId: req.user.id, mode: "solo", gameType: "worldcup" }).catch(() => {});

    console.log(`[POST /worldcup/finish] OK — userId=${req.user.id} contentId=${cId} champion=${champId} matches=${(matches || []).length}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[POST /worldcup/finish] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 솔로 퀴즈 완주 기록 API
// =========================
app.post("/plays/complete", requireAuth, async (req, res) => {
  try {
    const { contentId, gameType } = req.body;
    if (!contentId) {
      return res.status(400).json({ ok: false, error: "MISSING_CONTENT_ID" });
    }
    const type = gameType === "worldcup" ? "worldcup" : "quiz";

    // fire-and-forget 방식이지만 응답은 즉시 반환
    recordPlayOnce({ contentId, userId: req.user.id, mode: "solo", gameType: type }).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    console.error("[POST /plays/complete] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 월드컵 매치/판 기록 헬퍼
// =========================
async function recordWorldcupMatch(room, candA, candB, winner, loser, isTie, meta) {
  try {
    const { error } = await supabaseAdmin.from("worldcup_matches").insert({
      content_id: room.contentId,
      room_id: room.id || null,
      match_round: room._roundLabel || null,
      candidate_a_id: candA?.id || null,
      candidate_b_id: candB?.id || null,
      winner_candidate_id: winner.id,
      loser_candidate_id: loser?.id || null,
      is_tie: !!isTie,
      meta: meta || {},
    });
    if (error) console.warn("[worldcup_matches] insert error:", error.message);
    else console.log(`[worldcup_matches] recorded: ${winner.name} beat ${loser?.name} (${room._roundLabel})`);
  } catch (err) {
    console.warn("[worldcup_matches] insert failed:", err.message);
  }
}

async function recordWorldcupRun(room, championCand) {
  try {
    const { error } = await supabaseAdmin.from("worldcup_runs").insert({
      content_id: room.contentId,
      room_id: room.id || null,
      total_players: room.players.size,
      champion_candidate_id: championCand.id,
      meta: {},
    });
    if (error) console.warn("[worldcup_runs] insert error:", error.message);
    else console.log(`[worldcup_runs] recorded: champion=${championCand.name} contentId=${room.contentId}`);
  } catch (err) {
    console.warn("[worldcup_runs] insert failed:", err.message);
  }
}

// =========================
// 방 메모리
// =========================
const rooms = new Map();
const GRACE_MS = 15000;
const userRoomMap = new Map();
const inviteCodeMap = new Map(); // inviteCode → roomId

function generateInviteCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!inviteCodeMap.has(code)) return code;
  }
  // 충돌 50회 실패 시 7자리 폴백
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function isInviteCode(str) {
  return /^\d{6,7}$/.test(str);
}

/** 닉네임 확정: payload 우선순위 → handshake fallback → "player" */
function pickNick(socket, payload) {
  const raw = payload?.nickname || payload?.name || payload?.hostName
    || socket?.handshake?.auth?.nickname || "player";
  const trimmed = String(raw).trim().slice(0, 20);
  return trimmed || "player";
}

// =========================
// 타이머 정리 유틸
// =========================
function clearRoomTimers(room) {
  if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
  if (room.quizTimer) { clearTimeout(room.quizTimer); room.quizTimer = null; }
  if (room.quizShowTimer) { clearTimeout(room.quizShowTimer); room.quizShowTimer = null; }
}

// =========================
// 방 수명관리 상수
// =========================
const ROOM_HOST_POLICY = "END_ROOM"; // "END_ROOM" | "TRANSFER"
const EMPTY_ROOM_TTL_MS = 30_000;    // 방이 비면 30초 후 삭제

// =========================
// 방 삭제 / 정리 함수
// =========================

/** 방 완전 삭제 — 모든 타이머 정리, userRoomMap 정리, rooms Map 제거 */
function deleteRoom(roomId, reason = "UNKNOWN") {
  const room = rooms.get(roomId);
  if (!room) return;

  // 게임 타이머 정리
  clearRoomTimers(room);

  // emptyRoom TTL 타이머 정리
  if (room.emptyRoomTimer) {
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }

  // disconnect 유예 타이머 전부 정리
  if (room.disconnected) {
    for (const [, disc] of room.disconnected) {
      clearTimeout(disc.timeoutId);
    }
    room.disconnected.clear();
  }

  // 방 내 소켓에게 room:closed 알림
  io.to(roomId).emit("room:closed", { roomId, reason });

  // inviteCode 정리
  if (room.inviteCode) {
    inviteCodeMap.delete(room.inviteCode);
  }

  // userRoomMap 정리
  for (const userId of room.players.keys()) {
    if (userRoomMap.get(userId) === roomId) userRoomMap.delete(userId);
  }

  rooms.delete(roomId);
  console.log(`[방 삭제] roomId=${roomId} inviteCode=${room.inviteCode || "-"} 사유=${reason}`);
}

/** 조건부 방 정리 — players=0 AND disconnected=0 이면 TTL 타이머 시작 */
function maybeCleanupRoom(roomId, reason = "EMPTY") {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.players.size > 0 || (room.disconnected && room.disconnected.size > 0)) {
    // 아직 사람 있음 → emptyRoomTimer 취소 (재입장)
    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
      room.emptyRoomTimer = null;
    }
    return;
  }

  // 이미 타이머 걸려있으면 중복 방지
  if (room.emptyRoomTimer) return;

  room.emptyRoomTimer = setTimeout(() => {
    room.emptyRoomTimer = null;
    // 재확인
    if (room.players.size === 0 && (!room.disconnected || room.disconnected.size === 0)) {
      deleteRoom(roomId, reason);
    }
  }, EMPTY_ROOM_TTL_MS);
}

/** 호스트 퇴장 처리 — END_ROOM이면 방 종료, TRANSFER이면 승격 */
function handleHostLeave(room) {
  if (ROOM_HOST_POLICY === "END_ROOM") {
    deleteRoom(room.id, "HOST_LEFT");
    return true; // 방 삭제됨
  }

  // TRANSFER: 남은 플레이어 중 첫 번째를 호스트로 승격
  if (room.players.size > 0) {
    const nextHost = room.players.keys().next().value;
    room.hostUserId = nextHost;
    console.log(`[호스트 승격] roomId=${room.id} 새호스트=${nextHost}`);
    io.to(room.id).emit("room:state", publicRoom(room));
    return false;
  }

  // 남은 사람 없으면 삭제
  deleteRoom(room.id, "HOST_LEFT");
  return true;
}

// =========================
// 공통 Sync / Public 헬퍼
// =========================

function buildSyncPayload(room, userId) {
  // ── 퀴즈 모드 (quiz 진행 중) ──
  if (room.mode === "quiz" && room.quiz) {
    const q = room.quiz;
    const question = q.questions[q.questionIndex];
    const remainingSec = room.roundEndsAt
      ? Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000))
      : 0;

    return {
      roomId: room.id,
      mode: "quiz",
      phase: q.phase || "lobby",
      content: room.content || null,
      isHost: room.hostUserId === userId,
      quiz: {
        questionIndex: q.questionIndex,
        totalQuestions: q.questions.length,
        question: question ? safeQuestion(question, q.questionIndex, q.questions.length) : null,
        myAnswer: q.answers.get(userId)?.answer ?? null,
        submitted: q.answers.has(userId),
        scores: buildQuizScores(room),
        timer: { enabled: !!room.timerEnabled, sec: room.timerSec || 0, remainingSec },
        youtube: q.youtube || null,
        readyPlayers: Array.from(q.readyPlayers),
        lastReveal: q.lastReveal || null,
        lastScoreboard: q.lastScoreboard || null,
      }
    };
  }

  // ── 월드컵 모드 (기존) ──
  const player = room.players.get(userId);
  const remainingSec = room.roundEndsAt
    ? Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000))
    : 0;
  return {
    roomId: room.id,
    mode: room.mode || "worldcup",
    phase: room.phase || "lobby",
    roundIndex: room.roundIndex || 0,
    totalMatches: room.totalMatches || 0,
    currentMatch: room.currentMatch || null,
    content: room.content || null,
    timer: { enabled: !!room.timerEnabled, sec: room.timerSec || 0, remainingSec },
    myChoice: player?.choice || null,
    committed: room.committed.has(userId),
    scores: buildScores(room),
    isHost: room.hostUserId === userId,
    lastReveal: room.lastReveal || null
  };
}

function publicRoom(room) {
  const playersList = Array.from(room.players.entries()).map(([userId, p]) => {
    let status;
    if (room.disconnected?.has(userId)) {
      status = "재접속 대기…";
    } else if (room.mode === "quiz" && room.quiz) {
      const q = room.quiz;
      if (q.phase === "answering") {
        status = q.answers.has(userId) ? "제출 완료" : "답변 중…";
      } else if (q.phase === "show") {
        const curQ = q.questions[q.questionIndex];
        if (curQ?.type === "audio_youtube") {
          status = q.readyPlayers.has(userId) ? "준비 완료" : "준비 중…";
        } else {
          status = "대기 중…";
        }
      } else {
        status = "대기 중…";
      }
    } else {
      status = room.committed.has(userId) ? "선택 완료" : "선택 중…";
    }
    return { userId, name: p.name, status };
  });

  return {
    id: room.id,
    inviteCode: room.inviteCode || null,
    hostUserId: room.hostUserId,
    mode: room.mode || "worldcup",
    phase: room.mode === "quiz"
      ? (room.quiz?.phase || "lobby")
      : (room.phase || "lobby"),
    roundIndex: room.roundIndex || 0,
    totalMatches: room.totalMatches || 0,
    currentMatch: room.currentMatch || null,
    content: room.content || null,
    players: playersList
  };
}

// =========================
// 월드컵 헬퍼 (기존 그대로)
// =========================

async function loadCandidates(contentId, userId, isAdmin) {
  const { data: content, error: cErr } = await supabaseAdmin
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (cErr || !content) return { error: "CONTENT_NOT_FOUND" };
  if (content.is_hidden && !isAdmin) return { error: "CONTENT_HIDDEN" };
  if (content.mode !== "worldcup") return { error: "NOT_WORLDCUP" };

  if (content.visibility === "private") {
    if (content.owner_id !== userId && !isAdmin) {
      return { error: "NOT_ALLOWED" };
    }
  }

  const { data: rows, error: rErr } = await supabaseAdmin
    .from("worldcup_candidates")
    .select("*")
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true });

  if (rErr || !rows) return { error: "CANDIDATES_LOAD_FAILED" };
  if (rows.length < 2) return { error: "NOT_ENOUGH_CANDIDATES" };

  const clamped = rows.slice(0, 32);

  return {
    content: { id: content.id, title: content.title, visibility: content.visibility, timerEnabled: content.timer_enabled !== false },
    candidates: clamped.map(c => ({
      id: c.id,
      name: c.name,
      mediaType: c.media_type,
      mediaUrl: c.media_url,
      startSec: c.start_sec,
      durationSec: c.duration_sec
    }))
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initBracket(room, candidates) {
  const shuffled = shuffleArray(candidates);
  room.bracket = [...shuffled];
  room.nextBracket = [];
  room.matchIndex = 0;
  room.roundIndex = 0;
  room.scores = {};
  room.picksHistory = [];
  room.phase = "lobby";
  room.currentMatch = null;
  room.champion = null;
  room.totalMatches = candidates.length - 1;
  if (room.bracket.length % 2 !== 0) {
    room.nextBracket.push(room.bracket.pop());
  }
}

function nextMatch(room) {
  const idx = room.matchIndex;
  const candA = room.bracket[idx * 2];
  const candB = room.bracket[idx * 2 + 1];
  room._matchCands = { A: candA, B: candB };
  // 라운드 라벨 (랭킹 기록용)
  const bracketSize = room.bracket.length;
  if (bracketSize <= 2) room._roundLabel = "결승";
  else if (bracketSize <= 4) room._roundLabel = "준결승";
  else room._roundLabel = `${bracketSize}강`;
  room.currentMatch = {
    A: candA.name, B: candB.name,
    mediaA: { type: candA.mediaType, url: candA.mediaUrl, startSec: candA.startSec },
    mediaB: { type: candB.mediaType, url: candB.mediaUrl, startSec: candB.startSec }
  };
  return room.currentMatch;
}

function advanceBracket(room, winnerCandidate) {
  room.nextBracket.push(winnerCandidate);
  room.matchIndex++;
  if (room.matchIndex * 2 >= room.bracket.length) {
    room.bracket = [...room.nextBracket];
    room.nextBracket = [];
    room.matchIndex = 0;
    if (room.bracket.length > 1 && room.bracket.length % 2 !== 0) {
      room.nextBracket.push(room.bracket.pop());
    }
  }
  const remaining = room.bracket.length + room.nextBracket.length;
  if (remaining <= 1) {
    return { finished: true, champion: room.bracket[0] || winnerCandidate };
  }
  return { finished: false };
}

function startRoundTimer(room) {
  if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
  if (!room.timerEnabled) { room.roundEndsAt = null; return; }
  room.roundEndsAt = Date.now() + room.timerSec * 1000;
  room.roundTimer = setTimeout(() => {
    room.roundTimer = null;
    room.roundEndsAt = null;
    const policy = room.timeoutPolicy || "RANDOM";
    for (const [userId, p] of room.players.entries()) {
      if (!room.committed.has(userId)) {
        if (policy === "AUTO_PASS") {
          p.choice = null;
        } else {
          p.choice = Math.random() < 0.5 ? "A" : "B";
        }
        room.committed.add(userId);
      }
    }
    io.to(room.id).emit("room:state", publicRoom(room));
    doReveal(room);
  }, room.timerSec * 1000);
}

function buildScores(room) {
  return Object.entries(room.scores || {}).map(([userId, score]) => {
    const player = room.players.get(userId);
    return { userId, name: player?.name || userId.slice(0, 6), score };
  }).sort((a, b) => b.score - a.score);
}

function doReveal(room) {
  if (room.phase !== "playing") return;
  room.phase = "revealed";

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  room.roundEndsAt = null;

  const match = room.currentMatch;
  const picks = Array.from(room.players.entries()).map(([userId, pp]) => ({
    userId,
    name: pp.name,
    choice: pp.choice
  }));
  const activePicks = picks.filter(x => x.choice === "A" || x.choice === "B");
  const aCount = activePicks.filter(x => x.choice === "A").length;
  const bCount = activePicks.filter(x => x.choice === "B").length;
  const total = Math.max(1, activePicks.length);

  let roundWinner = null;
  if (aCount > bCount) roundWinner = "A";
  else if (bCount > aCount) roundWinner = "B";

  if (roundWinner) {
    for (const p of activePicks) {
      if (p.choice === roundWinner) {
        room.scores[p.userId] = (room.scores[p.userId] || 0) + 1;
      }
    }
  }

  const matchCands = room._matchCands;
  let winnerCand;
  if (roundWinner) {
    winnerCand = roundWinner === "A" ? matchCands.A : matchCands.B;
  } else {
    winnerCand = Math.random() < 0.5 ? matchCands.A : matchCands.B;
  }

  const loserCand = winnerCand === matchCands.A ? matchCands.B : matchCands.A;
  const result = advanceBracket(room, winnerCand);

  // 매치 결과 DB 기록 (fire-and-forget)
  recordWorldcupMatch(room, matchCands.A, matchCands.B, winnerCand, loserCand, !roundWinner, {
    aCount, bCount, totalPlayers: room.players.size,
    percentA: activePicks.length > 0 ? Math.round((aCount / total) * 100) : 0,
    percentB: activePicks.length > 0 ? Math.round((bCount / total) * 100) : 0,
  }).catch(() => {});

  room.picksHistory.push({
    roundIndex: room.roundIndex,
    match,
    picks: picks.map(p => ({ userId: p.userId, name: p.name, choice: p.choice })),
    aCount, bCount, roundWinner, winningCandidate: winnerCand.name
  });

  if (result.finished) {
    room.champion = result.champion;
  }

  const scores = buildScores(room);

  const revealPayload = {
    picks,
    percent: {
      A: activePicks.length > 0 ? Math.round((aCount / total) * 100) : 0,
      B: activePicks.length > 0 ? Math.round((bCount / total) * 100) : 0
    },
    roundWinner,
    winningCandidate: winnerCand.name,
    isTie: !roundWinner,
    scores,
    roundIndex: room.roundIndex,
    totalMatches: room.totalMatches,
    isLastRound: result.finished,
    timeoutPolicy: room.timeoutPolicy || "RANDOM"
  };
  room.lastReveal = revealPayload;
  io.to(room.id).emit("worldcup:reveal", revealPayload);
}

// =========================
// 퀴즈 헬퍼 (NEW)
// =========================

async function loadQuizQuestions(contentId, userId, isAdmin) {
  const { data: content, error: cErr } = await supabaseAdmin
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (cErr || !content) return { error: "CONTENT_NOT_FOUND" };
  if (content.is_hidden && !isAdmin) return { error: "CONTENT_HIDDEN" };
  if (content.mode !== "quiz") return { error: "NOT_QUIZ" };

  if (content.visibility === "private") {
    if (content.owner_id !== userId && !isAdmin) {
      return { error: "NOT_ALLOWED" };
    }
  }

  const { data: rows, error: rErr } = await supabaseAdmin
    .from("quiz_questions")
    .select("*")
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true });

  if (rErr || !rows) return { error: "QUESTIONS_LOAD_FAILED" };
  if (rows.length < 1) return { error: "NO_QUESTIONS" };

  return {
    content: { id: content.id, title: content.title, visibility: content.visibility, timerEnabled: content.timer_enabled !== false },
    questions: rows.map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices || [],
      answer: q.answer || [],
      mediaType: q.media_type,
      mediaUrl: q.media_url,
      startSec: q.start_sec || 0,
      durationSec: q.duration_sec || 10,
      sortOrder: q.sort_order
    }))
  };
}

function extractVideoId(urlOrId) {
  if (!urlOrId) return null;
  if (!urlOrId.includes("/") && !urlOrId.includes(".")) return urlOrId;
  try {
    const url = new URL(urlOrId);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    return url.searchParams.get("v") || urlOrId;
  } catch {
    return urlOrId;
  }
}

function checkAnswer(question, userAnswer) {
  if (userAnswer === null || userAnswer === undefined) return false;

  if (question.type === "mcq") {
    const correctIndex = question.answer[0];
    return Number(userAnswer) === Number(correctIndex);
  }

  // short / audio_youtube: 공백·대소문자 무시 + 동의어 배열
  const normalized = String(userAnswer).trim().toLowerCase().replace(/\s+/g, "");
  return question.answer.some(ans =>
    String(ans).trim().toLowerCase().replace(/\s+/g, "") === normalized
  );
}

// 클라이언트 전송용 문제 (정답 제외)
function safeQuestion(q, index, total) {
  const payload = {
    index,
    total,
    type: q.type,
    prompt: q.prompt,
  };
  if (q.type === "mcq") {
    payload.choices = q.choices;
  }
  if (q.type === "audio_youtube") {
    payload.mediaType = "youtube";
    payload.videoId = extractVideoId(q.mediaUrl);
    payload.startSec = q.startSec;
    payload.durationSec = q.durationSec;
  }
  // image/gif/mp4 미디어가 있으면 클라이언트에 전달 (audio_youtube 제외)
  if (q.type !== "audio_youtube" && q.mediaUrl && q.mediaType) {
    payload.media_type = q.mediaType;
    payload.media_url = q.mediaUrl;
  }
  return payload;
}

function initQuizState(room, questions) {
  room.quiz = {
    questions,
    questionIndex: 0,
    phase: "show",
    answers: new Map(),
    scores: {},
    readyPlayers: new Set(),
    lastReveal: null,
    lastScoreboard: null,
    youtube: null,
  };
  for (const userId of room.players.keys()) {
    room.quiz.scores[userId] = 0;
  }
}

function buildQuizScores(room) {
  const scores = room.quiz?.scores || {};
  return Object.entries(scores).map(([userId, score]) => {
    const player = room.players.get(userId);
    return { userId, name: player?.name || userId.slice(0, 6), score };
  }).sort((a, b) => b.score - a.score);
}

function advanceQuizQuestion(room) {
  const q = room.quiz;
  const question = q.questions[q.questionIndex];
  q.phase = "show";
  q.answers.clear();
  q.readyPlayers.clear();
  q.youtube = null;
  q.lastReveal = null;

  const questionPayload = safeQuestion(question, q.questionIndex, q.questions.length);
  io.to(room.id).emit("quiz:question", questionPayload);
  io.to(room.id).emit("room:state", publicRoom(room));

  if (question.type === "audio_youtube") {
    // 유튜브: 유저가 quiz:ready 보낼 때까지 대기
  } else {
    // 일반 문제: 2초 후 자동으로 answering 전환
    room.quizShowTimer = setTimeout(() => {
      room.quizShowTimer = null;
      startQuizAnswering(room);
    }, 2000);
  }
}

function startQuizAnswering(room) {
  const q = room.quiz;
  q.phase = "answering";

  const question = q.questions[q.questionIndex];
  let youtubePayload = null;

  if (question.type === "audio_youtube") {
    const startAt = Date.now() + 3000; // 3초 후 재생
    youtubePayload = {
      startAt,
      videoId: extractVideoId(question.mediaUrl),
      startSec: question.startSec,
      durationSec: question.durationSec,
    };
    q.youtube = youtubePayload;
  }

  io.to(room.id).emit("quiz:answering", {
    questionIndex: q.questionIndex,
    timer: { enabled: !!room.timerEnabled, sec: room.timerSec },
    youtube: youtubePayload,
  });
  io.to(room.id).emit("room:state", publicRoom(room));

  startQuizTimer(room);
}

function startQuizTimer(room) {
  if (room.quizTimer) { clearTimeout(room.quizTimer); room.quizTimer = null; }
  if (!room.timerEnabled) { room.roundEndsAt = null; return; }

  room.roundEndsAt = Date.now() + room.timerSec * 1000;
  room.quizTimer = setTimeout(() => {
    room.quizTimer = null;
    room.roundEndsAt = null;

    // 미제출자 → 자동 패스(오답)
    for (const [userId] of room.players.entries()) {
      if (!room.quiz.answers.has(userId)) {
        room.quiz.answers.set(userId, { submitted: true, answer: null, isCorrect: false });
      }
    }
    io.to(room.id).emit("room:state", publicRoom(room));
    doQuizReveal(room);
  }, room.timerSec * 1000);
}

function doQuizReveal(room) {
  const q = room.quiz;
  if (q.phase !== "answering") return;
  q.phase = "reveal";

  if (room.quizTimer) { clearTimeout(room.quizTimer); room.quizTimer = null; }
  room.roundEndsAt = null;

  const question = q.questions[q.questionIndex];
  const results = [];

  for (const [userId, p] of room.players.entries()) {
    const entry = q.answers.get(userId) || { submitted: false, answer: null, isCorrect: false };

    if (entry.submitted && entry.answer !== null) {
      entry.isCorrect = checkAnswer(question, entry.answer);
    } else {
      entry.isCorrect = false;
    }

    if (entry.isCorrect) {
      q.scores[userId] = (q.scores[userId] || 0) + 1;
    }

    results.push({
      userId,
      name: p.name,
      answer: entry.answer,
      isCorrect: entry.isCorrect,
      submitted: entry.submitted,
    });
  }

  // 객관식 통계
  let choiceStats = null;
  if (question.type === "mcq" && question.choices?.length > 0) {
    choiceStats = question.choices.map((label, i) => {
      const count = results.filter(r => Number(r.answer) === i).length;
      return {
        index: i,
        label,
        count,
        percent: results.length > 0 ? Math.round((count / results.length) * 100) : 0,
      };
    });
  }

  const correctAnswer = question.type === "mcq"
    ? question.choices[question.answer[0]]
    : question.answer[0];

  const scores = buildQuizScores(room);

  const revealPayload = {
    questionIndex: q.questionIndex,
    totalQuestions: q.questions.length,
    type: question.type,
    prompt: question.prompt,
    correctAnswer,
    correctAnswerRaw: question.answer,
    results,
    choiceStats,
    scores,
    isLastQuestion: q.questionIndex >= q.questions.length - 1,
  };

  q.lastReveal = revealPayload;
  io.to(room.id).emit("quiz:reveal", revealPayload);
  io.to(room.id).emit("room:state", publicRoom(room));
}

// =========================
// Socket Auth 미들웨어
// =========================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.accessToken;
    const user = await verify(token);
    if (!user) return next(new Error("UNAUTHORIZED"));
    socket.user = user;
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

// =========================
// Socket 연결 핸들러
// =========================

io.on("connection", (socket) => {
  const me = socket.user;

  // --- 재접속 자동 복구 ---
  const prevRoomId = userRoomMap.get(me.id);
  if (prevRoomId) {
    const prevRoom = rooms.get(prevRoomId);
    if (prevRoom && prevRoom.players.has(me.id)) {
      const disc = prevRoom.disconnected?.get(me.id);
      if (disc) {
        clearTimeout(disc.timeoutId);
        prevRoom.disconnected.delete(me.id);
      }
      // 빈 방 삭제 타이머 취소 (재접속)
      if (prevRoom.emptyRoomTimer) {
        clearTimeout(prevRoom.emptyRoomTimer);
        prevRoom.emptyRoomTimer = null;
      }
      socket.join(prevRoomId);
      socket.emit("room:sync", buildSyncPayload(prevRoom, me.id));
      io.to(prevRoomId).emit("room:state", publicRoom(prevRoom));
    } else {
      userRoomMap.delete(me.id);
    }
  }

  // =========================
  // 방 생성/입장/나가기 (mode 필드 추가)
  // =========================

  socket.on("room:create", async (payload, cb) => {
    // ban 체크
    try {
      const { data: banRows } = await supabaseAdmin
        .from("bans")
        .select("id")
        .eq("user_id", me.id)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .limit(1);
      if (banRows && banRows.length > 0) {
        return cb?.({ ok: false, error: "USER_BANNED" });
      }
    } catch (e) {
      console.error("ban check error:", e);
    }

    const roomId = uuidv4();
    const inviteCode = generateInviteCode();
    const room = {
      id: roomId,
      inviteCode,
      hostUserId: me.id,
      mode: payload?.mode === "quiz" ? "quiz" : "worldcup",
      contentId: payload?.contentId || null,
      players: new Map(),
      committed: new Set(),
      disconnected: new Map(),
      timerEnabled: !!payload?.timerEnabled,
      timerSec: Math.min(180, Math.max(10, Number(payload?.timerSec) || 45)),
      timeoutPolicy: payload?.timeoutPolicy === "AUTO_PASS" ? "AUTO_PASS" : "RANDOM",
      roundTimer: null,
      roundEndsAt: null,
      quizTimer: null,
      quizShowTimer: null,
      emptyRoomTimer: null,
      alreadyCounted: false,
    };
    rooms.set(roomId, room);
    inviteCodeMap.set(inviteCode, roomId);

    const hostNick = pickNick(socket, payload);
    room.players.set(me.id, { name: hostNick });
    socket.join(roomId);
    userRoomMap.set(me.id, roomId);

    console.log(`[방 생성] roomId=${roomId} inviteCode=${inviteCode} 호스트=${me.id}(${hostNick}) 모드=${room.mode} contentId=${room.contentId}`);
    io.to(roomId).emit("room:state", publicRoom(room));
    cb?.({ ok: true, roomId, inviteCode });
  });

  socket.on("room:join", (payload, cb) => {
    let roomId = payload?.roomId;
    // 초대코드(6~7자리 숫자) 또는 UUID가 아닌 입력 → inviteCodeMap에서 변환
    if (roomId && !rooms.has(roomId)) {
      // 숫자코드면 그대로, 영문이면 대문자로 시도 (레거시 호환)
      const resolved = inviteCodeMap.get(roomId) || inviteCodeMap.get(roomId.toUpperCase());
      if (resolved) roomId = resolved;
    }
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });

    // 빈 방 삭제 타이머 취소 (재입장)
    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
      room.emptyRoomTimer = null;
    }

    // 닉네임: 재접속이면 기존 이름 유지, 신규 입장이면 pickNick
    const existing = room.players.get(me.id);
    if (existing) {
      // 재접속 — 기존 이름 유지 (클라이언트가 새 이름을 명시했으면 갱신)
      const newNick = payload?.nickname || payload?.name;
      if (newNick && newNick.trim()) existing.name = newNick.trim().slice(0, 20);
    } else {
      // 신규 입장
      room.players.set(me.id, { name: pickNick(socket, payload) });
    }
    socket.join(roomId);
    userRoomMap.set(me.id, roomId);

    // 퀴즈 진행 중이면 점수 초기화
    if (room.quiz && room.quiz.scores[me.id] === undefined) {
      room.quiz.scores[me.id] = 0;
    }

    io.to(roomId).emit("room:state", publicRoom(room));
    cb?.({ ok: true, roomId, inviteCode: room.inviteCode || null });
  });

  socket.on("room:leave", (payload, cb) => {
    const roomId = payload?.roomId;
    const room = rooms.get(roomId);
    if (room) {
      const disc = room.disconnected?.get(me.id);
      if (disc) { clearTimeout(disc.timeoutId); room.disconnected.delete(me.id); }

      const wasHost = room.hostUserId === me.id;

      room.players.delete(me.id);
      room.committed.delete(me.id);
      if (room.quiz) {
        room.quiz.answers.delete(me.id);
        room.quiz.readyPlayers.delete(me.id);
      }
      userRoomMap.delete(me.id);

      // 호스트 퇴장 정책
      if (wasHost) {
        const deleted = handleHostLeave(room);
        if (!deleted) {
          io.to(roomId).emit("room:state", publicRoom(room));
        }
      } else {
        io.to(roomId).emit("room:state", publicRoom(room));
        maybeCleanupRoom(roomId, "EMPTY");
      }
    }
    socket.leave(roomId);
    cb?.({ ok: true });
  });

  socket.on("room:ping", () => {});

  // =========================
  // 월드컵 이벤트 (기존 그대로)
  // =========================

  socket.on("game:start", async (payload, cb) => {
    try {
      const room = rooms.get(payload?.roomId);
      if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });

      const contentId = room.contentId;
      if (!contentId) return cb?.({ ok: false, error: "NO_CONTENT_ID" });

      console.log(`[game:start] received — roomId=${room.id} host=${me.id} mode=${room.mode} contentId=${contentId}`);

      // ── 퀴즈 모드 → 퀴즈 시작 로직 ──
      if (room.mode === "quiz") {
        clearRoomTimers(room);

        const loaded = await loadQuizQuestions(contentId, me.id, me.isAdmin);
        if (loaded.error) {
          console.log(`[game:start] quiz load FAILED: ${loaded.error}`);
          return cb?.({ ok: false, error: loaded.error });
        }

        room.content = loaded.content;
        room.contentId = contentId;
        const contentTimerEnabled = loaded.content.timerEnabled !== false;
        room.timerEnabled = contentTimerEnabled;
        initQuizState(room, loaded.questions);

        console.log(`[game:start] quiz started — questions=${loaded.questions.length} → quiz:question broadcast`);
        advanceQuizQuestion(room);
        return cb?.({ ok: true, totalQuestions: loaded.questions.length });
      }

      // ── 월드컵 모드 ──
      if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

      const loaded = await loadCandidates(contentId, me.id, me.isAdmin);
      if (loaded.error) {
        console.log(`[game:start] worldcup load FAILED: ${loaded.error}`);
        return cb?.({ ok: false, error: loaded.error });
      }

      room.content = loaded.content;
      initBracket(room, loaded.candidates);

      room.roundIndex = 1;
      room.phase = "playing";
      room.committed.clear();
      for (const p of room.players.values()) delete p.choice;
      for (const userId of room.players.keys()) room.scores[userId] = 0;

      nextMatch(room);

      const timerInfo = { enabled: room.timerEnabled, sec: room.timerSec };
      // ✅ worldcup:round로 통일 (프론트가 이 이벤트를 핸들링함)
      io.to(room.id).emit("worldcup:round", {
        roomId: room.id,
        roundIndex: room.roundIndex,
        totalMatches: room.totalMatches,
        match: room.currentMatch,
        timer: timerInfo
      });
      io.to(room.id).emit("room:state", publicRoom(room));

      console.log(`[game:start] worldcup started — candidates=${loaded.candidates.length} → worldcup:round broadcast`);
      startRoundTimer(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("[game:start] error:", err);
      cb?.({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  socket.on("worldcup:commit", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.phase !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });

    const choice = payload?.choice;
    if (choice !== "A" && choice !== "B") return cb?.({ ok: false, error: "BAD_CHOICE" });

    const p = room.players.get(me.id);
    if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
    p.choice = choice;

    room.committed.add(me.id);

    io.to(room.id).emit("room:state", publicRoom(room));
    cb?.({ ok: true });

    if (room.committed.size === room.players.size) {
      doReveal(room);
    }
  });

  socket.on("worldcup:next", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
    if (room.phase !== "revealed") return cb?.({ ok: false, error: "NOT_REVEALED" });

    if (room.champion) {
      room.phase = "finished";
      const scores = buildScores(room);
      // ✅ worldcup:finished (프론트가 이 이벤트를 핸들링함)
      io.to(room.id).emit("worldcup:finished", {
        roomId: room.id,
        champion: room.champion?.name || room.champion,
        scores,
        picksHistory: room.picksHistory
      });

      // 판 기록 DB 저장 (fire-and-forget)
      recordWorldcupRun(room, room.champion).catch(() => {});

      // play_count +1 (멀티 월드컵 완주, 호스트 기준 1회, fire-and-forget)
      if (!room.alreadyCounted && room.contentId && room.hostUserId) {
        room.alreadyCounted = true;
        recordPlayOnce({ contentId: room.contentId, userId: room.hostUserId, mode: "multi", gameType: "worldcup" }).catch(() => {});
      }

      cb?.({ ok: true, finished: true });
      return;
    }

    room.committed.clear();
    for (const p of room.players.values()) delete p.choice;
    room.roundIndex++;
    room.phase = "playing";
    nextMatch(room);

    const timerInfo = { enabled: room.timerEnabled, sec: room.timerSec };
    io.to(room.id).emit("worldcup:round", {
      roomId: room.id,
      roundIndex: room.roundIndex,
      totalMatches: room.totalMatches,
      match: room.currentMatch,
      timer: timerInfo
    });
    io.to(room.id).emit("room:state", publicRoom(room));

    startRoundTimer(room);
    cb?.({ ok: true, finished: false });
  });

  // =========================
  // 퀴즈 이벤트 (NEW)
  // =========================

  // ── quiz:start (호스트) ──
  socket.on("quiz:start", async (payload, cb) => {
    try {
      const room = rooms.get(payload?.roomId);
      if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
      if (room.mode !== "quiz") return cb?.({ ok: false, error: "NOT_QUIZ_ROOM" });

      clearRoomTimers(room);

      const quizId = payload?.quizId || room.contentId;
      if (!quizId) return cb?.({ ok: false, error: "NO_QUIZ_ID" });

      const loaded = await loadQuizQuestions(quizId, me.id, me.isAdmin);
      if (loaded.error) return cb?.({ ok: false, error: loaded.error });

      // 타이머 설정: 콘텐츠 DB 설정 우선, payload 오버라이드 허용
      const contentTimerEnabled = loaded.content.timerEnabled !== false;
      if (payload?.timerEnabled !== undefined) {
        room.timerEnabled = !!payload.timerEnabled;
      } else {
        room.timerEnabled = contentTimerEnabled;
      }
      if (payload?.timerSec) room.timerSec = Math.min(180, Math.max(10, Number(payload.timerSec)));

      room.content = loaded.content;
      room.contentId = quizId;
      initQuizState(room, loaded.questions);

      console.log(`퀴즈 시작: 방=${room.id}, 문제=${loaded.questions.length}개`);

      advanceQuizQuestion(room);
      cb?.({ ok: true, totalQuestions: loaded.questions.length });
    } catch (err) {
      console.error("quiz:start 에러:", err);
      cb?.({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  // ── quiz:ready (각 유저 — 유튜브 재생 준비 완료) ──
  socket.on("quiz:ready", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (!room.quiz || room.quiz.phase !== "show") return cb?.({ ok: false, error: "NOT_SHOW_PHASE" });

    room.quiz.readyPlayers.add(me.id);
    io.to(room.id).emit("room:state", publicRoom(room));

    // 전체 상태 알림
    io.to(room.id).emit("quiz:status", {
      type: "ready",
      readyCount: room.quiz.readyPlayers.size,
      totalPlayers: room.players.size,
      allReady: room.quiz.readyPlayers.size >= room.players.size,
    });

    cb?.({ ok: true });

    // 전원 준비 → answering 전환
    if (room.quiz.readyPlayers.size >= room.players.size) {
      startQuizAnswering(room);
    }
  });

  // ── quiz:submit (답변 제출) ──
  socket.on("quiz:submit", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (!room.quiz || room.quiz.phase !== "answering") return cb?.({ ok: false, error: "NOT_ANSWERING" });

    const p = room.players.get(me.id);
    if (!p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });

    // 이미 제출했으면 거부
    if (room.quiz.answers.has(me.id)) return cb?.({ ok: false, error: "ALREADY_SUBMITTED" });

    room.quiz.answers.set(me.id, {
      submitted: true,
      answer: payload?.answer ?? null,
      isCorrect: false, // reveal 시 판정
    });

    io.to(room.id).emit("room:state", publicRoom(room));

    // 제출 상태 알림
    io.to(room.id).emit("quiz:status", {
      type: "submit",
      submittedCount: room.quiz.answers.size,
      totalPlayers: room.players.size,
    });

    cb?.({ ok: true });

    // 전원 제출 → 자동 reveal
    if (room.quiz.answers.size >= room.players.size) {
      doQuizReveal(room);
    }
  });

  // ── quiz:next (호스트: reveal→scoreboard→next/finished) ──
  socket.on("quiz:next", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
    if (!room.quiz) return cb?.({ ok: false, error: "NOT_QUIZ" });

    const q = room.quiz;

    // reveal → scoreboard
    if (q.phase === "reveal") {
      q.phase = "scoreboard";
      const scores = buildQuizScores(room);
      q.lastScoreboard = scores;
      io.to(room.id).emit("quiz:scoreboard", {
        scores,
        questionIndex: q.questionIndex,
        totalQuestions: q.questions.length,
        isLastQuestion: q.questionIndex >= q.questions.length - 1,
      });
      io.to(room.id).emit("room:state", publicRoom(room));
      cb?.({ ok: true });
      return;
    }

    // scoreboard → 다음 문제 또는 종료
    if (q.phase === "scoreboard") {
      if (q.questionIndex >= q.questions.length - 1) {
        q.phase = "finished";
        const scores = buildQuizScores(room);
        io.to(room.id).emit("quiz:finished", {
          scores,
          totalQuestions: q.questions.length,
        });
        io.to(room.id).emit("room:state", publicRoom(room));

        // play_count +1 (멀티 퀴즈 완주, 호스트 기준 1회, fire-and-forget)
        if (!room.alreadyCounted && room.contentId && room.hostUserId) {
          room.alreadyCounted = true;
          recordPlayOnce({ contentId: room.contentId, userId: room.hostUserId, mode: "multi", gameType: "quiz" }).catch(() => {});
        }

        cb?.({ ok: true, finished: true });
        return;
      }

      q.questionIndex++;
      advanceQuizQuestion(room);
      cb?.({ ok: true, finished: false });
      return;
    }

    cb?.({ ok: false, error: "INVALID_PHASE" });
  });

  // ── quiz:playClicked (각자 재생 버튼 클릭 기록 — 선택) ──
  socket.on("quiz:playClicked", (payload) => {
    // 분석/로그용 — 별도 로직 없음
    const room = rooms.get(payload?.roomId);
    if (room) {
      console.log(`유튜브 재생 클릭: 방=${room.id}, 유저=${me.id}`);
    }
  });

  // =========================
  // 재접속 유예 (disconnect)
  // =========================

  socket.on("disconnect", async () => {
    const roomId = userRoomMap.get(me.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players.has(me.id)) return;

    try {
      const sockets = await io.in(roomId).fetchSockets();
      if (sockets.some(s => s.user?.id === me.id)) return;
    } catch {}

    if (!room.disconnected) room.disconnected = new Map();
    const timeoutId = setTimeout(() => {
      room.disconnected.delete(me.id);

      const wasHost = room.hostUserId === me.id;

      room.players.delete(me.id);
      room.committed.delete(me.id);
      if (room.quiz) {
        room.quiz.answers.delete(me.id);
        room.quiz.readyPlayers.delete(me.id);
      }
      userRoomMap.delete(me.id);

      // 호스트 유예 만료 → 호스트 정책 적용
      if (wasHost) {
        const deleted = handleHostLeave(room);
        if (deleted) return; // 방이 삭제됨 → 이후 로직 불필요
        // TRANSFER 정책이면 아래 로직 계속
      }

      io.to(roomId).emit("room:state", publicRoom(room));

      // 월드컵: 남은 전원 committed → 자동 reveal
      if (room.mode !== "quiz" && room.phase === "playing" && room.players.size > 0
          && room.committed.size === room.players.size) {
        doReveal(room);
      }

      // 퀴즈: 남은 전원 제출 → 자동 reveal
      if (room.mode === "quiz" && room.quiz?.phase === "answering" && room.players.size > 0) {
        const allSubmitted = Array.from(room.players.keys()).every(uid => room.quiz.answers.has(uid));
        if (allSubmitted) doQuizReveal(room);
      }

      // 퀴즈: show 단계 유튜브 — 전원 ready면 진행
      if (room.mode === "quiz" && room.quiz?.phase === "show" && room.players.size > 0) {
        if (room.quiz.readyPlayers.size >= room.players.size) {
          startQuizAnswering(room);
        }
      }

      // 공통: 방 비었는지 확인 → 삭제 판정
      maybeCleanupRoom(roomId, "EMPTY");
    }, GRACE_MS);

    room.disconnected.set(me.id, { at: Date.now(), timeoutId });
    io.to(roomId).emit("room:state", publicRoom(room));
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`Backend listening on http://localhost:${process.env.PORT || 3001}`);
});
