import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ── Security headers (helmet) ──
app.use(helmet({
  contentSecurityPolicy: false,   // CSP는 프론트가 CDN 스크립트 다수 사용하므로 비활성
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // OG 이미지 프록시 허용
}));

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

// ★ CORS를 rate limiter보다 먼저 적용 — 429 응답에도 CORS 헤더 포함
app.use(cors({
  origin: checkOrigin,
  credentials: true
}));

// ── REST Rate limiting (IP 기준) ──
const restLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 120,             // IP당 120 req/min (admin 다건 호출 대응)
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "RATE_LIMITED" },
});
app.use(restLimiter);

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

// =========================
// JWKS 기반 JWT 검증 (Supabase access_token)
// =========================

// ⚠️ SUPABASE_URL 정규화 (끝 슬래시 제거, 실수로 /auth/v1 붙은 경우 제거)
const SUPABASE_URL_RAW = process.env.SUPABASE_URL || "";
const SUPABASE_URL_CLEAN = SUPABASE_URL_RAW
  .replace(/\/+$/, "")           // 끝 슬래시 제거
  .replace(/\/auth\/v1\/?$/, ""); // 혹시 /auth/v1 붙어있으면 제거

const JWKS_URL = `${SUPABASE_URL_CLEAN}/auth/v1/.well-known/jwks.json`;
const JWT_ISSUER = `${SUPABASE_URL_CLEAN}/auth/v1`;

console.log("[AUTH] SUPABASE_URL_RAW:", SUPABASE_URL_RAW);
console.log("[AUTH] SUPABASE_URL_CLEAN:", SUPABASE_URL_CLEAN);
console.log("[AUTH] JWKS_URL:", JWKS_URL);
console.log("[AUTH] JWT_ISSUER:", JWT_ISSUER);

let jwks = null;
try {
  jwks = createRemoteJWKSet(new URL(JWKS_URL));
  console.log("[AUTH] ✅ JWKS 초기화 성공");
} catch (e) {
  console.error("[AUTH] ❌ JWKS 초기화 실패:", e.message);
}
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
      .select("id, type, title, thumbnail_url, creator_name, play_count, complete_count, created_at")
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
      q = q.order("complete_count", { ascending: false }).order("created_at", { ascending: false });
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

// =========================
// OG 메타 미리보기 (카톡/디코/트위터 공유용)
// GET /og/content/:id → SSR HTML 반환
// =========================
const DEFAULT_OG_IMAGE = "https://playduo.kr/og-default.png";
const SITE_NAME = "DUO";
const SITE_URL = "https://playduo.kr";

app.get("/og/content/:id", async (req, res) => {
  try {
    const contentId = req.params.id;
    if (!contentId) {
      return res.status(400).send("Bad Request: Missing content ID");
    }

    // DB에서 콘텐츠 정보 조회
    const { data: content, error } = await supabaseAdmin
      .from("contents")
      .select("id, mode, title, description, thumbnail_url, play_count, complete_count, created_at, owner_id")
      .eq("id", contentId)
      .single();

    if (error || !content) {
      // 콘텐츠 없으면 기본 OG로 폴백
      return res.send(generateOgHtml({
        title: "DUO — 이상형 월드컵 & 퀴즈",
        description: "누구나 만들고 함께 즐기는 이상형 월드컵 & 퀴즈 플랫폼",
        image: DEFAULT_OG_IMAGE,
        url: SITE_URL,
        redirectUrl: SITE_URL
      }));
    }

    // 후보/문제 수 조회
    let itemCount = 0;
    if (content.mode === "worldcup") {
      const { count } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId);
      itemCount = count || 0;
    } else if (content.mode === "quiz") {
      const { count } = await supabaseAdmin
        .from("quiz_questions")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId);
      itemCount = count || 0;
    }

    // creator_name 조회 (profiles 테이블)
    let creatorName = "";
    if (content.owner_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nickname")
        .eq("user_id", content.owner_id)
        .single();
      creatorName = profile?.nickname || "";
    }

    // 타입별 설명 생성
    const typeLabel = content.mode === "worldcup" ? "이상형 월드컵" : "퀴즈";
    const bracketText = itemCount > 0 ? `${itemCount}${content.mode === "worldcup" ? "강" : "문제"}` : "";

    let description = content.description || "";
    if (!description || description.length < 10) {
      if (content.mode === "worldcup") {
        description = `${content.title} — DUO에서 ${bracketText} 이상형월드컵 플레이!`;
      } else {
        description = `${content.title} — 퀴즈 도전! ${bracketText} 정답률을 올려보자 🎯`;
      }
    }
    if (creatorName) {
      description += ` | 제작자: ${creatorName}`;
    }
    // 길이 제한 (120자)
    if (description.length > 120) {
      description = description.slice(0, 117) + "...";
    }

    // 썸네일 URL 처리 (없으면 기본 이미지)
    let ogImage = content.thumbnail_url || DEFAULT_OG_IMAGE;
    // Supabase Storage 상대경로면 절대경로로 변환
    if (ogImage && !ogImage.startsWith("http")) {
      ogImage = `${process.env.SUPABASE_URL}/storage/v1/object/public/thumbnails/${ogImage}`;
    }

    // 실제 플레이 페이지 URL
    const playUrl = `${SITE_URL}/play.html?solo=1&type=${content.mode}&id=${contentId}`;
    const ogUrl = `${SITE_URL}/og/content/${contentId}`;

    const html = generateOgHtml({
      title: `${content.title} — ${typeLabel} | DUO`,
      description,
      image: ogImage,
      url: ogUrl,
      redirectUrl: playUrl,
      type: content.mode
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1시간 캐시
    return res.send(html);

  } catch (err) {
    console.error("GET /og/content/:id error:", err);
    return res.send(generateOgHtml({
      title: "DUO — 이상형 월드컵 & 퀴즈",
      description: "누구나 만들고 함께 즐기는 이상형 월드컵 & 퀴즈 플랫폼",
      image: DEFAULT_OG_IMAGE,
      url: SITE_URL,
      redirectUrl: SITE_URL
    }));
  }
});

// OG HTML 생성 함수
function generateOgHtml({ title, description, image, url, redirectUrl, type = "website" }) {
  // HTML 이스케이프
  const esc = (str) => String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${esc(url)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <!-- 기본 meta -->
  <meta name="description" content="${esc(description)}">

  <!-- 사람용: 0.3초 후 실제 페이지로 리다이렉트 -->
  <meta http-equiv="refresh" content="0;url=${esc(redirectUrl)}">
  <link rel="canonical" href="${esc(redirectUrl)}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #16142a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .loading {
      font-size: 18px;
      opacity: 0.8;
    }
    a { color: #7c6aff; }
  </style>
</head>
<body>
  <div class="loading">
    <p>DUO로 이동 중...</p>
    <p><a href="${esc(redirectUrl)}">바로 이동하기</a></p>
  </div>
  <script>
    // JS 지원 브라우저는 즉시 이동
    window.location.replace("${redirectUrl.replace(/"/g, '\\"')}");
  </script>
</body>
</html>`;
}

// =========================
// OG 이미지 프록시 (선택적: Storage 권한 문제 해결용)
// GET /og/image/:id → 이미지 프록시/리다이렉트
// =========================
app.get("/og/image/:id", async (req, res) => {
  try {
    const contentId = req.params.id;

    const { data: content } = await supabaseAdmin
      .from("contents")
      .select("thumbnail_url")
      .eq("id", contentId)
      .single();

    let imageUrl = content?.thumbnail_url || DEFAULT_OG_IMAGE;

    // Storage 경로면 publicUrl 생성
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/thumbnails/${imageUrl}`;
    }

    // 리다이렉트 (캐시 허용)
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24시간 캐시
    return res.redirect(302, imageUrl);

  } catch (err) {
    console.error("GET /og/image/:id error:", err);
    return res.redirect(302, DEFAULT_OG_IMAGE);
  }
});

// =========================
// 플레이 히스토리 API
// =========================

// POST /history — 플레이 기록 저장
app.post("/history", requireAuth, async (req, res) => {
  console.log("[POST /history] 요청 수신");
  console.log("[POST /history] user_id:", req.user?.id);
  console.log("[POST /history] body:", JSON.stringify(req.body));

  try {
    const { content_id, content_type, mode, result_json, idempotency_key } = req.body;

    // 필수 필드 검증
    if (!content_id || !content_type || !mode) {
      console.warn("[POST /history] 필수 필드 누락");
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }
    if (!["worldcup", "quiz"].includes(content_type)) {
      console.warn("[POST /history] 잘못된 content_type:", content_type);
      return res.status(400).json({ ok: false, error: "INVALID_CONTENT_TYPE" });
    }
    if (!["solo", "multi"].includes(mode)) {
      console.warn("[POST /history] 잘못된 mode:", mode);
      return res.status(400).json({ ok: false, error: "INVALID_MODE" });
    }

    // 중복 방지 (idempotency_key가 있으면 체크)
    if (idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from("play_history")
        .select("id")
        .eq("idempotency_key", idempotency_key)
        .single();

      if (existing) {
        console.log("[POST /history] 중복 요청 (idempotency):", existing.id);
        return res.json({ ok: true, duplicate: true, id: existing.id });
      }
    }

    // 기록 저장
    console.log("[POST /history] INSERT 시도:", {
      user_id: req.user.id,
      content_id,
      content_type,
      mode,
      idempotency_key
    });

    const { data, error } = await supabaseAdmin
      .from("play_history")
      .insert({
        user_id: req.user.id,
        content_id,
        content_type,
        mode,
        result_json: result_json || {},
        idempotency_key: idempotency_key || null
      })
      .select("id")
      .single();

    if (error) {
      console.error("[POST /history] ❌ INSERT 실패:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    }

    console.log("[POST /history] ✅ INSERT 성공, id:", data.id);
    return res.json({ ok: true, id: data.id });

  } catch (err) {
    console.error("POST /history internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /history — 최근 플레이 목록
app.get("/history", requireAuth, async (req, res) => {
  // 캐시 무효화 (304 방지)
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  try {
    const type = req.query.type || "all"; // all | worldcup | quiz
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    console.log(`[GET /history] user_id=${req.user.id}, type=${type}, limit=${limit}, offset=${offset}`);

    let query = supabaseAdmin
      .from("play_history")
      .select(`
        id,
        content_id,
        content_type,
        mode,
        played_at,
        result_json,
        contents (
          id,
          title,
          mode,
          thumbnail_url,
          play_count,
          updated_at
        )
      `)
      .eq("user_id", req.user.id)
      .order("played_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type !== "all") {
      query = query.eq("content_type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /history error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    console.log(`[GET /history] rows fetched: ${data?.length || 0}`);

    // 응답 가공 (contents 조인 데이터 평탄화)
    const history = (data || []).map(h => ({
      id: h.id,
      content_id: h.content_id,
      content_type: h.content_type,
      mode: h.mode,
      played_at: h.played_at,
      result_json: h.result_json,
      // 콘텐츠 메타
      content_title: h.contents?.title || "삭제된 콘텐츠",
      thumbnail_url: h.contents?.thumbnail_url || null,
      updated_at: h.contents?.updated_at || null,
      content_play_count: h.contents?.play_count || 0
    }));

    return res.json({ ok: true, history });

  } catch (err) {
    console.error("GET /history internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /history/best — 최고 기록
app.get("/history/best", requireAuth, async (req, res) => {
  // 캐시 무효화 (304 방지)
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  try {
    const type = req.query.type || "all"; // all | worldcup | quiz
    console.log(`[GET /history/best] user_id=${req.user.id}, type=${type}`);

    const result = { quiz: null, worldcup: null };

    // 퀴즈 최고 기록
    if (type === "all" || type === "quiz") {
      const { data: quizData } = await supabaseAdmin
        .from("play_history")
        .select("result_json, played_at, content_id, contents(title)")
        .eq("user_id", req.user.id)
        .eq("content_type", "quiz")
        .order("played_at", { ascending: false });

      if (quizData && quizData.length > 0) {
        let bestAccuracy = 0;
        let bestScore = 0;
        let totalPlays = quizData.length;

        quizData.forEach(h => {
          const acc = parseFloat(h.result_json?.accuracy) || 0;
          const score = parseInt(h.result_json?.score) || 0;
          if (acc > bestAccuracy) bestAccuracy = acc;
          if (score > bestScore) bestScore = score;
        });

        result.quiz = {
          best_accuracy: Math.round(bestAccuracy * 100),
          best_score: bestScore,
          total_plays: totalPlays,
          recent_title: quizData[0]?.contents?.title || null
        };
      }
    }

    // 월드컵 최고 기록
    if (type === "all" || type === "worldcup") {
      const { data: wcData } = await supabaseAdmin
        .from("play_history")
        .select("result_json, played_at, content_id, contents(title)")
        .eq("user_id", req.user.id)
        .eq("content_type", "worldcup")
        .order("played_at", { ascending: false });

      if (wcData && wcData.length > 0) {
        const winCount = wcData.filter(h => h.result_json?.champion_candidate_id).length;
        const recentWin = wcData.find(h => h.result_json?.champion_name);

        result.worldcup = {
          total_plays: wcData.length,
          win_count: winCount,
          recent_champion: recentWin?.result_json?.champion_name || null,
          recent_title: wcData[0]?.contents?.title || null
        };
      }
    }

    return res.json({ ok: true, ...result });

  } catch (err) {
    console.error("GET /history/best internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /content/:id — 단일 콘텐츠 상세 (OG용 + 일반용)
app.get("/content/:id", async (req, res) => {
  try {
    const contentId = req.params.id;

    const { data: content, error } = await supabaseAdmin
      .from("contents")
      .select("id, mode, title, description, thumbnail_url, play_count, complete_count, created_at, owner_id, visibility")
      .eq("id", contentId)
      .single();

    if (error || !content) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    // visibility 체크 (private은 owner만)
    if (content.visibility === "private") {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const user = await verify(token);
      if (!user || user.id !== content.owner_id) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    // 후보/문제 수
    let itemCount = 0;
    if (content.mode === "worldcup") {
      const { count } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId);
      itemCount = count || 0;
    } else {
      const { count } = await supabaseAdmin
        .from("quiz_questions")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId);
      itemCount = count || 0;
    }

    // creator name
    let creatorName = "";
    if (content.owner_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nickname")
        .eq("user_id", content.owner_id)
        .single();
      creatorName = profile?.nickname || "";
    }

    return res.json({
      ok: true,
      content: {
        ...content,
        type: content.mode,
        item_count: itemCount,
        creator_name: creatorName
      }
    });

  } catch (err) {
    console.error("GET /content/:id internal:", err);
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



// =========================
// JWKS 기반 JWT 검증 함수
// =========================

// JWT payload를 디코딩 (검증 없이 - 디버그용)
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

async function verifyJWT(accessToken) {
  if (!accessToken) {
    console.log("[AUTH] 토큰 없음");
    return null;
  }
  if (!jwks) {
    console.error("[AUTH] JWKS가 초기화되지 않음");
    return null;
  }

  // 디버그: 토큰 앞 16자만 출력 (보안)
  const tokenPreview = accessToken.substring(0, 16) + "...";
  console.log("[AUTH] 토큰 검증 시작:", tokenPreview);

  // 디버그: 토큰의 실제 issuer/audience 확인 (검증 전)
  const decoded = decodeJwtPayload(accessToken);
  if (decoded) {
    console.log("[AUTH] 토큰 iss:", decoded.iss);
    console.log("[AUTH] 토큰 aud:", decoded.aud);
    console.log("[AUTH] 기대 iss:", JWT_ISSUER);
    console.log("[AUTH] iss 일치:", decoded.iss === JWT_ISSUER);
  }

  try {
    // ⚠️ 1단계: issuer만 검증 (audience 임시 제거하여 원인 분리)
    const { payload } = await jwtVerify(accessToken, jwks, {
      issuer: JWT_ISSUER
      // audience는 일시 제거 - 원인 분리 후 복원 예정
    });

    const userId = payload.sub;
    const email = payload.email || "";

    console.log("[AUTH] ✅ 검증 성공 - user_id:", userId, "email:", email);

    // 관리자 체크
    const isAdmin = (email && process.env.ADMIN_EMAIL
      && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase())
      || (process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID);

    return { id: userId, email, isAdmin };

  } catch (e) {
    // 에러 상세 로그 (토큰 전체는 출력 안 함)
    console.error("[AUTH] ❌ JWT 검증 실패");
    console.error("[AUTH] error.code:", e.code);
    console.error("[AUTH] error.message:", e.message);
    console.error("[AUTH] error.claim:", e.claim); // issuer/audience mismatch 시 어떤 claim인지
    return null;
  }
}

// 기존 verify 함수 (하위 호환용 - 다른 곳에서 사용 중일 수 있음)
async function verify(accessToken) {
  return verifyJWT(accessToken);
}

// =========================
// Express 미들웨어: 인증 / 관리자
// =========================
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  // Bearer 토큰 파싱 (trim으로 공백 제거)
  let token = null;
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    console.log("[AUTH] Authorization 헤더 없거나 Bearer 토큰 없음");
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "NO_TOKEN" });
  }

  const user = await verifyJWT(token);
  if (!user) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "INVALID_TOKEN" });
  }

  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";

  let token = null;
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "NO_TOKEN" });
  }

  const user = await verifyJWT(token);
  if (!user) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "INVALID_TOKEN" });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  req.user = user;
  next();
}

// =========================
// 현재 유저 정보 API (관리자 플래그 포함)
// =========================
app.get("/me", requireAuth, (req, res) => {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const userEmail = String(req.user?.email || "").toLowerCase().trim();
  const isAdmin = !!adminEmail && userEmail === adminEmail;

  console.log(`[ME] email=${req.user?.email} is_admin=${isAdmin}`);

  return res.json({
    ok: true,
    user_id: req.user?.id,
    email: req.user?.email,
    is_admin: isAdmin,
  });
});

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
// 티어 신고 API
// =========================
app.post("/tier-reports", requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, reason, detail } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }
    if (!["tier_battle", "tier_template"].includes(targetType)) {
      return res.status(400).json({ ok: false, error: "INVALID_TARGET_TYPE" });
    }

    const { error } = await supabaseAdmin.from("tier_reports").insert({
      target_type: targetType,
      target_id: targetId,
      reporter_user_id: req.user.id,
      reason,
      detail: detail || null,
    });

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ ok: false, error: "ALREADY_REPORTED" });
      }
      console.error("POST /tier-reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /tier-reports internal:", err);
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

// 관리자 본인 확인 API
app.get("/admin/me", requireAdmin, async (req, res) => {
  return res.json({ ok: true, isAdmin: true, email: req.user.email, userId: req.user.id });
});

// 관리자 콘텐츠 목록 (필터/검색/페이지네이션/profiles 조인)
app.get("/admin/contents", requireAdmin, async (req, res) => {
  try {
    const {
      type,        // worldcup | quiz | all
      q,           // 검색어 (제목/태그)
      sort,        // newest | popular | reports
      hidden,      // true | false | all
      reported,    // true (report_count > 0만)
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // 기본 쿼리 빌드
    let query = supabaseAdmin
      .from("contents")
      .select("id, title, mode, visibility, is_hidden, hidden_reason, report_count, owner_id, play_count, complete_count, thumbnail_url, description, category, tags, created_at, updated_at", { count: "exact" });

    // 타입 필터
    if (type && type !== "all") {
      query = query.eq("mode", type);
    }

    // 숨김 필터
    if (hidden === "true") {
      query = query.eq("is_hidden", true);
    } else if (hidden === "false") {
      query = query.eq("is_hidden", false);
    }

    // 신고된 콘텐츠만
    if (reported === "true") {
      query = query.gt("report_count", 0);
    }

    // 검색어 (제목 또는 태그)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      query = query.or(`title.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`);
    }

    // 정렬
    if (sort === "popular") {
      query = query.order("complete_count", { ascending: false });
    } else if (sort === "reports") {
      query = query.order("report_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // 페이지네이션
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("GET /admin/contents query error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // owner_id로 profiles에서 creator_name 조회
    // profiles PK는 id (= auth.users.id), user_id 컬럼은 존재하지 않음
    const ownerIds = [...new Set((data || []).map(c => c.owner_id).filter(Boolean))];
    let profilesMap = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .in("id", ownerIds);
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p.nickname; });
      }
    }

    // 응답 데이터에 creator_name 추가
    // 우선순위: profiles.nickname → owner_id 앞 8자리 → (알 수 없음)
    const items = (data || []).map(c => ({
      ...c,
      type: c.mode,
      creator_name: profilesMap[c.owner_id] || c.owner_id?.slice(0, 8) || "(알 수 없음)",
    }));

    return res.json({
      ok: true,
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
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

// 관리자 콘텐츠 일반 수정 (title, description, category, tags, visibility, is_hidden, hidden_reason)
app.patch("/admin/contents/:id", requireAdmin, async (req, res) => {
  try {
    const { title, description, category, tags, visibility, is_hidden, hidden_reason } = req.body;

    // 해당 콘텐츠 존재 확인
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("contents")
      .select("id, title")
      .eq("id", req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    // 업데이트할 필드만 모음
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description || null;
    if (category !== undefined) updates.category = category || null;
    if (tags !== undefined) updates.tags = tags || [];
    if (visibility !== undefined && ["public", "private"].includes(visibility)) {
      updates.visibility = visibility;
    }
    if (is_hidden !== undefined) updates.is_hidden = !!is_hidden;
    if (hidden_reason !== undefined) updates.hidden_reason = hidden_reason || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "NO_UPDATES" });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("contents")
      .update(updates)
      .eq("id", req.params.id);

    if (updateErr) {
      console.error("PATCH /admin/contents/:id update error:", updateErr);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // 관리자 액션 로그
    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "edit",
      target_type: "content",
      target_id: req.params.id,
      detail: JSON.stringify(updates),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/contents/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 신고 카운트 초기화
app.post("/admin/contents/:id/reset-reports", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("contents")
      .update({ report_count: 0 })
      .eq("id", req.params.id);

    if (error) {
      console.error("POST /admin/contents/:id/reset-reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // reports 테이블에서도 해당 콘텐츠 신고 기록 삭제 (선택적)
    await supabaseAdmin
      .from("reports")
      .delete()
      .eq("content_id", req.params.id);

    // 관리자 액션 로그
    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "reset_reports",
      target_type: "content",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/contents/:id/reset-reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 특정 콘텐츠의 신고 상세 목록
app.get("/admin/contents/:id/reports", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id, reason, detail, reporter_user_id, created_at")
      .eq("content_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /admin/contents/:id/reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true, items: data || [] });
  } catch (err) {
    console.error("GET /admin/contents/:id/reports:", err);
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
// 티어메이커 관리자 API
// =========================

// 티어 템플릿 목록 (관리자)
app.get("/admin/tier-templates", requireAdmin, async (req, res) => {
  try {
    const {
      q,
      visibility,   // public | private | all
      hidden,        // all | true | false
      reported,      // "true" → report_count > 0
      sort,          // newest | popular | reports
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("tier_templates")
      .select("id, title, description, tags, cards, is_public, creator_id, play_count, report_count, is_hidden, hidden_reason, deleted_at, created_at, updated_at", { count: "exact" });

    if (visibility === "public") {
      query = query.eq("is_public", true);
    } else if (visibility === "private") {
      query = query.eq("is_public", false);
    }

    if (hidden === "true") {
      query = query.eq("is_hidden", true);
    } else if (hidden === "false") {
      query = query.eq("is_hidden", false);
    }

    if (reported === "true") {
      query = query.gt("report_count", 0);
    }

    if (q && q.trim()) {
      query = query.ilike("title", `%${q.trim()}%`);
    }

    if (sort === "popular") {
      query = query.order("play_count", { ascending: false });
    } else if (sort === "reports") {
      query = query.order("report_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("GET /admin/tier-templates query error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // creator_id → profiles 닉네임 조회
    // profiles PK는 id (= auth.users.id), user_id 컬럼은 존재하지 않음
    const creatorIds = [...new Set((data || []).map(t => t.creator_id).filter(Boolean))];
    let profilesMap = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .in("id", creatorIds);
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p.nickname; });
      }
    }

    // 우선순위: profiles.nickname → creator_id 앞 8자리 → (알 수 없음)
    const items = (data || []).map(t => ({
      ...t,
      creator_name: profilesMap[t.creator_id] || t.creator_id?.slice(0, 8) || "(알 수 없음)",
    }));

    return res.json({
      ok: true,
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error("GET /admin/tier-templates:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 템플릿 공개 상태 토글 (관리자)
app.patch("/admin/tier-templates/:id", requireAdmin, async (req, res) => {
  try {
    const { is_public } = req.body;
    if (typeof is_public !== "boolean") {
      return res.status(400).json({ ok: false, error: "is_public must be boolean" });
    }

    const { error } = await supabaseAdmin
      .from("tier_templates")
      .update({ is_public })
      .eq("id", req.params.id);

    if (error) {
      console.error("PATCH /admin/tier-templates/:id error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: is_public ? "tier_make_public" : "tier_make_private",
      target_type: "tier_template",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/tier-templates/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 템플릿 숨김/해제 (관리자)
app.patch("/admin/tier-templates/:id/hide", requireAdmin, async (req, res) => {
  try {
    const { is_hidden, hidden_reason } = req.body;
    if (typeof is_hidden !== "boolean") {
      return res.status(400).json({ ok: false, error: "is_hidden must be boolean" });
    }

    const update = { is_hidden };
    if (is_hidden) {
      update.hidden_reason = hidden_reason || "관리자 숨김 처리";
    } else {
      update.hidden_reason = null;
    }

    const { error } = await supabaseAdmin
      .from("tier_templates")
      .update(update)
      .eq("id", req.params.id);

    if (error) {
      console.error("PATCH /admin/tier-templates/:id/hide error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: is_hidden ? "tier_template_hide" : "tier_template_unhide",
      target_type: "tier_template",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/tier-templates/:id/hide:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 템플릿 신고 내역 조회 (관리자)
app.get("/admin/tier-templates/:id/reports", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tier_reports")
      .select("id, reason, detail, status, reporter_user_id, created_at")
      .eq("target_type", "tier_template")
      .eq("target_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /admin/tier-templates/:id/reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // reporter_user_id → nickname lookup (profiles PK = id)
    const reporterIds = [...new Set((data || []).map(r => r.reporter_user_id).filter(Boolean))];
    let profilesMap = {};
    if (reporterIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .in("id", reporterIds);
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p.nickname; });
      }
    }

    const items = (data || []).map(r => ({
      ...r,
      reporter_name: profilesMap[r.reporter_user_id] || r.reporter_user_id?.slice(0, 8) || "-",
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /admin/tier-templates/:id/reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 템플릿 신고 초기화 (관리자)
app.post("/admin/tier-templates/:id/reset-reports", requireAdmin, async (req, res) => {
  try {
    // 신고 레코드 삭제
    const { error: delErr } = await supabaseAdmin
      .from("tier_reports")
      .delete()
      .eq("target_type", "tier_template")
      .eq("target_id", req.params.id);

    if (delErr) {
      console.error("POST /admin/tier-templates/:id/reset-reports delete error:", delErr);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // report_count 0으로 리셋
    const { error: updErr } = await supabaseAdmin
      .from("tier_templates")
      .update({ report_count: 0 })
      .eq("id", req.params.id);

    if (updErr) {
      console.error("POST /admin/tier-templates/:id/reset-reports update error:", updErr);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "tier_template_reset_reports",
      target_type: "tier_template",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /admin/tier-templates/:id/reset-reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 템플릿 삭제 (관리자) — FK CASCADE로 instances/plays 자동 정리
app.delete("/admin/tier-templates/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("tier_templates")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      console.error("DELETE /admin/tier-templates/:id error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "delete",
      target_type: "tier_template",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/tier-templates/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 티어 신고 관리자 API
// =========================

// 티어 신고 목록 (그룹화: target_id별)
app.get("/admin/tier-reports", requireAdmin, async (req, res) => {
  try {
    const { targetType, status: filterStatus } = req.query;

    let query = supabaseAdmin
      .from("tier_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (targetType) query = query.eq("target_type", targetType);
    if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, error } = await query;
    if (error) {
      console.error("GET /admin/tier-reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // target_id별 그룹화 + 요약
    const groups = {};
    for (const r of (data || [])) {
      const key = `${r.target_type}:${r.target_id}`;
      if (!groups[key]) {
        groups[key] = {
          target_type: r.target_type,
          target_id: r.target_id,
          report_count: 0,
          first_reported_at: r.created_at,
          last_reported_at: r.created_at,
          statuses: [],
          reports: [],
        };
      }
      groups[key].report_count++;
      groups[key].reports.push(r);
      groups[key].statuses.push(r.status);
      if (new Date(r.created_at) < new Date(groups[key].first_reported_at)) {
        groups[key].first_reported_at = r.created_at;
      }
      if (new Date(r.created_at) > new Date(groups[key].last_reported_at)) {
        groups[key].last_reported_at = r.created_at;
      }
    }

    // 대상 정보 가져오기
    const battleIds = [];
    const templateIds = [];
    for (const g of Object.values(groups)) {
      if (g.target_type === "tier_battle") battleIds.push(g.target_id);
      else if (g.target_type === "tier_template") templateIds.push(g.target_id);
    }

    // 싸움터 (tier_instances) 미리보기
    let instancesMap = {};
    if (battleIds.length > 0) {
      const { data: instances } = await supabaseAdmin
        .from("tier_instances")
        .select("id, template_id, user_id, tiers, placements, is_hidden, deleted_at, created_at, tier_templates(id, title, cards)")
        .in("id", battleIds);
      if (instances) {
        for (const inst of instances) instancesMap[inst.id] = inst;
      }
    }

    // 템플릿 미리보기
    let templatesMap = {};
    if (templateIds.length > 0) {
      const { data: templates } = await supabaseAdmin
        .from("tier_templates")
        .select("id, title, cards, creator_id, is_public, report_count, created_at")
        .in("id", templateIds);
      if (templates) {
        for (const t of templates) templatesMap[t.id] = t;
      }
    }

    // 프로필 닉네임 조회
    const userIds = new Set();
    for (const inst of Object.values(instancesMap)) if (inst.user_id) userIds.add(inst.user_id);
    for (const t of Object.values(templatesMap)) if (t.creator_id) userIds.add(t.creator_id);
    for (const r of (data || [])) if (r.reporter_user_id) userIds.add(r.reporter_user_id);

    let profilesMap = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .in("id", [...userIds]);
      if (profiles) {
        for (const p of profiles) profilesMap[p.id] = p.nickname;
      }
    }

    // 최종 조합
    const items = Object.values(groups).map(g => {
      let preview = null;
      if (g.target_type === "tier_battle") {
        const inst = instancesMap[g.target_id];
        if (inst) {
          preview = {
            template_title: inst.tier_templates?.title || "",
            template_cards: inst.tier_templates?.cards || [],
            tiers: inst.tiers,
            placements: inst.placements,
            creator_name: profilesMap[inst.user_id] || inst.user_id?.slice(0, 8) || "-",
            is_hidden: inst.is_hidden,
            deleted_at: inst.deleted_at,
            created_at: inst.created_at,
          };
        }
      } else if (g.target_type === "tier_template") {
        const tpl = templatesMap[g.target_id];
        if (tpl) {
          preview = {
            title: tpl.title,
            cards: tpl.cards,
            creator_name: profilesMap[tpl.creator_id] || tpl.creator_id?.slice(0, 8) || "-",
            is_public: tpl.is_public,
            report_count: tpl.report_count,
            created_at: tpl.created_at,
          };
        }
      }

      // 개별 신고에 닉네임 추가
      const reports = g.reports.map(r => ({
        ...r,
        reporter_name: profilesMap[r.reporter_user_id] || r.reporter_user_id?.slice(0, 8) || "-",
      }));

      // 그룹 상태: open이 하나라도 있으면 open
      const groupStatus = g.statuses.includes("open") ? "open" : (g.statuses.includes("resolved") ? "resolved" : "ignored");

      return { ...g, reports, preview, group_status: groupStatus };
    });

    // open 먼저, 그 다음 최근 신고순
    items.sort((a, b) => {
      if (a.group_status === "open" && b.group_status !== "open") return -1;
      if (a.group_status !== "open" && b.group_status === "open") return 1;
      return new Date(b.last_reported_at) - new Date(a.last_reported_at);
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /admin/tier-reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 신고 상태 변경 (resolve/ignore)
app.patch("/admin/tier-reports/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["open", "resolved", "ignored"].includes(status)) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }

    const { error } = await supabaseAdmin
      .from("tier_reports")
      .update({ status })
      .eq("id", req.params.id);

    if (error) {
      console.error("PATCH /admin/tier-reports/:id/status error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: `tier_report_${status}`,
      target_type: "tier_report",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/tier-reports/:id/status:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 티어 신고 일괄 상태 변경 (target 기준)
app.patch("/admin/tier-reports/batch-status", requireAdmin, async (req, res) => {
  try {
    const { targetType, targetId, status } = req.body;
    if (!targetType || !targetId || !["open", "resolved", "ignored"].includes(status)) {
      return res.status(400).json({ ok: false, error: "INVALID_PARAMS" });
    }

    const { error } = await supabaseAdmin
      .from("tier_reports")
      .update({ status })
      .eq("target_type", targetType)
      .eq("target_id", targetId);

    if (error) {
      console.error("PATCH /admin/tier-reports/batch-status error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: `tier_report_batch_${status}`,
      target_type: targetType,
      target_id: targetId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/tier-reports/batch-status:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 싸움터(인스턴스) 숨김/해제
app.patch("/admin/tier-instances/:id/hide", requireAdmin, async (req, res) => {
  try {
    const { is_hidden, hidden_reason } = req.body;
    if (typeof is_hidden !== "boolean") {
      return res.status(400).json({ ok: false, error: "is_hidden must be boolean" });
    }

    const update = { is_hidden };
    if (is_hidden) {
      update.hidden_reason = hidden_reason || "관리자 숨김 처리";
    } else {
      update.hidden_reason = null;
    }

    const { error } = await supabaseAdmin
      .from("tier_instances")
      .update(update)
      .eq("id", req.params.id);

    if (error) {
      console.error("PATCH /admin/tier-instances/:id/hide error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: is_hidden ? "tier_instance_hide" : "tier_instance_unhide",
      target_type: "tier_instance",
      target_id: req.params.id,
      detail: hidden_reason || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/tier-instances/:id/hide:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 싸움터(인스턴스) soft delete
app.delete("/admin/tier-instances/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("tier_instances")
      .update({ deleted_at: new Date().toISOString(), is_hidden: true, hidden_reason: "관리자 삭제" })
      .eq("id", req.params.id);

    if (error) {
      console.error("DELETE /admin/tier-instances/:id error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    await supabaseAdmin.from("admin_actions").insert({
      admin_user_id: req.user.id,
      action_type: "tier_instance_delete",
      target_type: "tier_instance",
      target_id: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/tier-instances/:id:", err);
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
      .select("id, title, mode, visibility, play_count, complete_count, timer_enabled, category, tags, thumbnail_url, description, created_at, updated_at")
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

    // 후보 수정: 기존 ID 유지 (랭킹/전적 보존)
    if (existing.mode === "worldcup" && candidates && Array.isArray(candidates)) {
      // 1) 기존 후보 ID 조회
      const { data: existingCands } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("id")
        .eq("content_id", req.params.id);
      const existingIds = new Set((existingCands || []).map(r => r.id));

      // incoming에서 유효한 기존 ID만 추출
      const incomingIds = new Set(
        candidates.filter(c => c.id && existingIds.has(c.id)).map(c => c.id)
      );

      // 2) 삭제: DB에 있지만 incoming에 없는 후보만 삭제
      const toDelete = [...existingIds].filter(id => !incomingIds.has(id));
      if (toDelete.length > 0) {
        const { error: dErr } = await supabaseAdmin
          .from("worldcup_candidates")
          .delete()
          .in("id", toDelete);
        if (dErr) console.error("후보 삭제 실패:", dErr);
      }

      // 3) 수정: 기존 후보 UPDATE (id 유지 → 랭킹 보존)
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.id && existingIds.has(c.id)) {
          const { error: uErr } = await supabaseAdmin
            .from("worldcup_candidates")
            .update({
              name: c.name,
              media_type: c.media_type || "image",
              media_url: c.media_url || "",
              start_sec: c.start_sec || null,
              duration_sec: c.duration_sec || null,
              sort_order: i + 1,
            })
            .eq("id", c.id)
            .eq("content_id", req.params.id);
          if (uErr) console.error("후보 수정 실패:", uErr);
        }
      }

      // 4) 추가: id가 없거나 DB에 없는 새 후보 INSERT
      const newRows = candidates
        .map((c, i) => ({ ...c, _sort: i + 1 }))
        .filter(c => !c.id || !existingIds.has(c.id))
        .map(c => ({
          content_id: req.params.id,
          name: c.name,
          media_type: c.media_type || "image",
          media_url: c.media_url || "",
          start_sec: c.start_sec || null,
          duration_sec: c.duration_sec || null,
          sort_order: c._sort,
        }));
      if (newRows.length > 0) {
        const { error: iErr } = await supabaseAdmin.from("worldcup_candidates").insert(newRows);
        if (iErr) console.error("후보 추가 실패:", iErr);
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
// 퀴즈 통계 (Quiz Stats)
// =========================

// POST /quiz/finish — 퀴즈 완주 기록 (attempt + 문항별 결과)
// 인증 선택적: 로그인 시 user_id 저장, 비로그인도 통계에 반영
app.post("/quiz/finish", async (req, res) => {
  try {
    // 선택적 인증 (실패해도 진행)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && jwks) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const { payload } = await jwtVerify(token, jwks, { issuer: JWT_ISSUER });
        userId = payload.sub || null;
      } catch (_) { /* 비로그인 — 무시 */ }
    }

    const { quizId, mode, correctCount, totalCount, durationMs, questionResults } = req.body;

    // 필수 필드 검증 (구체적 에러 메시지)
    const missing = [];
    if (!quizId) missing.push("quizId");
    if (totalCount == null) missing.push("totalCount");
    if (correctCount == null) missing.push("correctCount");
    if (missing.length) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_FIELDS",
        message: `필수 필드 누락: ${missing.join(", ")}`,
        received: { quizId, mode, correctCount, totalCount },
      });
    }

    // questionResults: 선택적 (멀티 퀴즈는 문항별 추적 없음)
    const hasQuestionResults = Array.isArray(questionResults) && questionResults.length > 0;

    // 1) quiz_attempts insert
    const { data: attempt, error: aErr } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({
        quiz_id: quizId,
        user_id: userId,
        mode: mode === "multi" ? "multi" : "solo",
        correct_count: Math.max(0, Number(correctCount) || 0),
        total_count: Math.max(1, Number(totalCount) || 1),
        duration_ms: durationMs ? Number(durationMs) : null,
      })
      .select("id")
      .single();

    if (aErr) {
      console.error("[POST /quiz/finish] quiz_attempts insert error:", aErr);
      return res.status(500).json({ ok: false, error: "DB_INSERT_FAIL", message: aErr.message });
    }

    // 2) quiz_question_attempts bulk insert (있을 때만)
    if (hasQuestionResults) {
      const rows = questionResults.map(qr => ({
        attempt_id: attempt.id,
        quiz_id: quizId,
        question_id: qr.questionId,
        is_correct: !!qr.isCorrect,
      }));

      const { error: qErr } = await supabaseAdmin
        .from("quiz_question_attempts")
        .insert(rows);

      if (qErr) {
        console.warn("[POST /quiz/finish] quiz_question_attempts insert error:", qErr);
        // attempt은 이미 저장됨 — 문항 상세만 실패, 응답은 성공 처리
      }
    }

    console.log(`[POST /quiz/finish] recorded: quizId=${quizId} user=${userId || "anon"} ${correctCount}/${totalCount}`);
    return res.json({ ok: true, attemptId: attempt.id });
  } catch (err) {
    console.error("[POST /quiz/finish] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /quiz/stats/:quizId — 퀴즈 통계 조회 (공개 집계)
app.get("/quiz/stats/:quizId", async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!quizId) {
      return res.status(400).json({ ok: false, error: "MISSING_QUIZ_ID" });
    }

    // RPC로 한 번에 조회 (전체 통계 + 문항별 통계)
    const { data, error } = await supabaseAdmin.rpc("get_quiz_stats", { p_quiz_id: quizId });

    if (error) {
      console.error("[GET /quiz/stats] RPC error:", error);
      // RPC 실패 시 빈 데이터 반환 (테이블이 아직 없을 수도 있으므로)
      return res.json({
        ok: true,
        overall: { attempt_count: 0, avg_accuracy_pct: 0, min_accuracy_pct: 0, max_accuracy_pct: 0, avg_duration_sec: 0 },
        questions: []
      });
    }

    return res.json({
      ok: true,
      overall: data?.overall || { attempt_count: 0, avg_accuracy_pct: 0 },
      questions: data?.questions || []
    });
  } catch (err) {
    console.error("[GET /quiz/stats] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 콘텐츠 이벤트 로그 (content_events)
// =========================

const CE_DEDUP_SEC = 600; // 10분 dedup (play/share)
const CE_FINISH_DEDUP_SEC = 180; // 3분 dedup (finish — 완주)

// POST /events — 이벤트 기록 (play/finish/share)
// ★ finish 이벤트는 로그인 유저만 허용 (complete_count 집계 정책)
// ★ play/share 이벤트는 익명도 허용 (카운트에 반영되지 않는 로그)
app.post("/events", async (req, res) => {
  try {
    // ── 1) 인증 (토큰이 있으면 검증) ──
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (!jwks) {
        console.warn("[POST /events] JWKS 미초기화 — 인증 불가");
        return res.status(401).json({ ok: false, error: "AUTH_UNAVAILABLE" });
      }
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const { payload } = await jwtVerify(token, jwks, { issuer: JWT_ISSUER });
        userId = payload.sub || null;
      } catch (jwtErr) {
        console.warn("[POST /events] JWT 검증 실패:", jwtErr.code || jwtErr.message);
        return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
      }
    }

    // ── 2) 요청 바디 검증 ──
    const { contentId, contentType, eventType, sessionId, meta } = req.body;
    if (!contentId || !contentType || !eventType) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }
    const validTypes = ["worldcup", "quiz", "tier"];
    const validEvents = ["play", "finish", "share"];
    if (!validTypes.includes(contentType) || !validEvents.includes(eventType)) {
      return res.status(400).json({ ok: false, error: "INVALID_TYPE" });
    }

    // ── 3) finish 이벤트는 로그인 필수 ──
    const isFinish = eventType === "finish";
    if (isFinish && !userId) {
      return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED_FOR_FINISH" });
    }

    // ── 4) dedup (중복 방지) ──
    const dedupSec = isFinish ? CE_FINISH_DEDUP_SEC : CE_DEDUP_SEC;
    const threshold = new Date(Date.now() - dedupSec * 1000).toISOString();

    if (isFinish && userId && sessionId) {
      // 로그인 유저 finish: session_id 단위 dedup (DB 유니크 인덱스가 최종 방어)
      const { data: recent, error: dedupErr } = await supabaseAdmin
        .from("content_events")
        .select("id")
        .eq("content_id", contentId)
        .eq("event_type", "finish")
        .eq("user_id", userId)
        .eq("session_id", sessionId)
        .limit(1);

      if (dedupErr) {
        console.error("[POST /events] dedup query error:", dedupErr.message);
      } else if (recent && recent.length > 0) {
        return res.json({ ok: true, dedup: true });
      }
    } else if (!isFinish && sessionId) {
      // play/share: session_id + 시간 기반 dedup
      const { data: recent, error: dedupErr } = await supabaseAdmin
        .from("content_events")
        .select("id")
        .eq("content_id", contentId)
        .eq("event_type", eventType)
        .eq("session_id", sessionId)
        .gte("created_at", threshold)
        .limit(1);

      if (dedupErr) {
        console.error("[POST /events] dedup query error:", dedupErr.message);
      } else if (recent && recent.length > 0) {
        return res.json({ ok: true, dedup: true });
      }
    }

    // ── 5) content_events INSERT ──
    // finish + 로그인: DB 유니크 인덱스(content_id, user_id, event_type, session_id)가
    // 중복을 막아줌 → 23505 에러 시 dedup 처리
    const { error: insertErr } = await supabaseAdmin.from("content_events").insert({
      content_id: contentId,
      content_type: contentType,
      event_type: eventType,
      session_id: sessionId || null,
      user_id: userId,
      meta: meta || {},
    });

    if (insertErr) {
      // 유니크 인덱스 위반 = 세션 내 중복 finish → dedup 정상 처리
      if (insertErr.code === "23505") {
        console.log(`[POST /events] dedup(unique) ${contentType}/${eventType} cid=${contentId} uid=${userId}`);
        return res.json({ ok: true, dedup: true });
      }
      console.error("[POST /events] insert error:", insertErr.message, insertErr.details, insertErr.hint);
      return res.status(400).json({ ok: false, error: "DB_INSERT_FAIL", detail: insertErr.message });
    }

    // complete_count 증가는 DB 트리거(trg_auto_increment_complete)가 자동 처리
    // — INSERT 성공(중복 아님) 시에만 트리거 실행 → +1

    console.log(`[POST /events] OK ${contentType}/${eventType} cid=${contentId} uid=${userId || "anon"}`);
    return res.json({ ok: true });
  } catch (err) {
    // ★ 예상치 못한 에러도 상세 로그 + 400 반환 (절대 500 금지)
    console.error("[POST /events] unexpected error:", err?.message || err, err?.stack);
    return res.status(400).json({ ok: false, error: "UNEXPECTED_ERROR", detail: String(err?.message || err) });
  }
});

// GET /content-metrics/:contentId — 콘텐츠 이벤트 집계
app.get("/content-metrics/:contentId", async (req, res) => {
  try {
    const { contentId } = req.params;
    if (!contentId) {
      return res.status(400).json({ ok: false, error: "MISSING_CONTENT_ID" });
    }

    // content_metrics_v 뷰에서 조회
    const { data, error } = await supabaseAdmin
      .from("content_metrics_v")
      .select("*")
      .eq("content_id", contentId)
      .maybeSingle();

    if (error) {
      console.error("[GET /content-metrics] view error:", error.message);
      // 뷰 미생성 시 빈 데이터 반환
      return res.json({
        ok: true,
        metrics: { finishes_total: 0, shares_total: 0, plays_last_7d: 0, plays_total: 0 }
      });
    }

    return res.json({
      ok: true,
      metrics: data || { finishes_total: 0, shares_total: 0, plays_last_7d: 0, plays_total: 0 }
    });
  } catch (err) {
    console.error("[GET /content-metrics] error:", err);
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
const MAX_PLAYERS = 4;
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
    players: playersList,
    // ✅ 월드컵 강수/선발방식 옵션
    wcRound: room.wcRound || 0,
    wcPick: room.wcPick || "random",
    // ✅ 타이머 설정 (로비 배지 + 클라이언트 동기화용)
    timerEnabled: !!room.timerEnabled,
    timerSec: room.timerSec || 45,
    // ✅ 동률 시 재투표 옵션
    revoteEnabled: room.revoteEnabled !== false,
    revoteCount: room.revoteCount || 0,
    maxRevotes: 2
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

  // ✅ 전체 후보 반환 (강수 선택은 selectCandidatesForRoom에서 처리)
  const mapped = rows.map(c => ({
    id: c.id,
    name: c.name,
    mediaType: c.media_type || "image",
    mediaUrl: c.media_url || "",
    startSec: c.start_sec || 0,
    durationSec: c.duration_sec || 0
  }));
  // ✅ 디버그: 첫 3개 후보의 미디어 정보 출력
  console.log(`[loadCandidates] contentId=${contentId} total=${mapped.length}`);
  mapped.slice(0, 3).forEach((c, i) => {
    console.log(`  [${i}] name="${c.name}" mediaUrl="${(c.mediaUrl || "").slice(0, 80)}" mediaType="${c.mediaType}"`);
  });
  return {
    content: { id: content.id, title: content.title, visibility: content.visibility, timerEnabled: content.timer_enabled !== false },
    candidates: mapped
  };
}

// ✅ 월드컵 후보 선발 함수 (랜덤 / 랭킹)
async function selectCandidatesForRoom(candidates, contentId, round, pick) {
  const total = candidates.length;
  const targetCount = round > 0 ? Math.min(round, total) : total;

  console.log(`[selectCandidates] total=${total}, round=${round}, pick=${pick}, target=${targetCount}`);

  // Fisher-Yates 셔플
  function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  if (pick === "ranked") {
    // 랭킹 기준 선발 (worldcup_candidate_stats_v 뷰 사용)
    const { data: stats, error } = await supabaseAdmin
      .from("worldcup_candidate_stats_v")
      .select("candidate_id, champion_count, win_rate, games")
      .eq("content_id", contentId);

    if (error) {
      console.error("[selectCandidates] 랭킹 조회 실패:", error);
      // 실패 시 랜덤으로 폴백
      return shuffle(candidates).slice(0, targetCount);
    }

    // candidate_id를 키로 하는 Map 생성
    const statsMap = new Map();
    (stats || []).forEach(row => {
      statsMap.set(row.candidate_id, {
        championCount: row.champion_count || 0,
        winRate: parseFloat(row.win_rate) || 0,
        games: row.games || 0
      });
    });

    // 정렬: champion_count DESC → win_rate DESC → games DESC → id ASC
    const sorted = [...candidates].sort((a, b) => {
      const sa = statsMap.get(a.id) || { championCount: 0, winRate: 0, games: 0 };
      const sb = statsMap.get(b.id) || { championCount: 0, winRate: 0, games: 0 };

      if (sb.championCount !== sa.championCount) return sb.championCount - sa.championCount;
      if (sb.winRate !== sa.winRate) return sb.winRate - sa.winRate;
      if (sb.games !== sa.games) return sb.games - sa.games;
      return (a.id || "").localeCompare(b.id || "");
    });

    const selected = sorted.slice(0, targetCount);
    console.log(`[selectCandidates] 랭킹 선발:`, selected.map(c => c.name).slice(0, 5), "...");

    // 선발된 후보들을 셔플 (매치업 랜덤화)
    return shuffle(selected);
  } else {
    // 랜덤 선발
    const shuffled = shuffle(candidates);
    const selected = shuffled.slice(0, targetCount);
    console.log(`[selectCandidates] 랜덤 선발:`, selected.map(c => c.name).slice(0, 5), "...");
    return selected;
  }
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
    A: {
      name: candA.name,
      media_url: candA.mediaUrl || "",
      media_type: candA.mediaType || "image",
      start_sec: candA.startSec || 0
    },
    B: {
      name: candB.name,
      media_url: candB.mediaUrl || "",
      media_type: candB.mediaType || "image",
      start_sec: candB.startSec || 0
    },
    mediaA: { type: candA.mediaType || "image", url: candA.mediaUrl || "", startSec: candA.startSec || 0 },
    mediaB: { type: candB.mediaType || "image", url: candB.mediaUrl || "", startSec: candB.startSec || 0 }
  };
  console.log(`[nextMatch] ▶ A.media_url=${(room.currentMatch.A.media_url || "EMPTY").slice(0, 80)}`);
  console.log(`[nextMatch] ▶ B.media_url=${(room.currentMatch.B.media_url || "EMPTY").slice(0, 80)}`);
  console.log(`[nextMatch] ▶ mediaA.url=${(room.currentMatch.mediaA.url || "EMPTY").slice(0, 80)}`);
  console.log(`[nextMatch] ▶ mediaB.url=${(room.currentMatch.mediaB.url || "EMPTY").slice(0, 80)}`);
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
    // revoting 상태에서 타이머 만료 시 playing으로 전환 후 doReveal 호출
    if (room.phase === "revoting") {
      room.phase = "playing";
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
  // playing 또는 revoting 상태에서만 reveal 진행
  if (room.phase !== "playing" && room.phase !== "revoting") return;
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

  // ✅ 동률 시 재투표 처리
  const isTie = !roundWinner;
  if (isTie && room.revoteEnabled && room.revoteCount < 2) {
    room.revoteCount = (room.revoteCount || 0) + 1;
    room.phase = "revoting";

    // 플레이어 선택 초기화
    for (const [, pp] of room.players.entries()) {
      pp.choice = null;
    }
    room.committed.clear();

    // 타이머 재시작 (revotePayload 생성 전에 실행해야 roundEndsAt 값이 설정됨)
    if (room.timerEnabled) {
      startRoundTimer(room);
    }

    const revotePayload = {
      picks,
      percent: {
        A: activePicks.length > 0 ? Math.round((aCount / total) * 100) : 0,
        B: activePicks.length > 0 ? Math.round((bCount / total) * 100) : 0
      },
      revoteCount: room.revoteCount,
      maxRevotes: 2,
      match: room.currentMatch,
      matchCands: {
        A: { id: room._matchCands.A.id, name: room._matchCands.A.name },
        B: { id: room._matchCands.B.id, name: room._matchCands.B.name }
      },
      timer: room.timerEnabled ? { enabled: true, sec: room.timerSec } : null
    };

    console.log(`[재투표] room=${room.id} revoteCount=${room.revoteCount}`);
    io.to(room.id).emit("worldcup:revote", revotePayload);
    io.to(room.id).emit("room:state", publicRoom(room));
    return;
  }

  // 재투표 없이 진행 → revoteCount 초기화
  room.revoteCount = 0;

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
    // 재투표 불가 (횟수 초과 또는 비활성화) → 랜덤 진출
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
    // 재투표 초과로 인한 랜덤 진출 여부
    revoteExhausted: !roundWinner && room.revoteEnabled,
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
  const s = String(urlOrId).trim();
  // bare 11-char video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  // not a URL — return as-is (legacy)
  if (!s.includes("/") && !s.includes(".")) return s;
  try {
    const url = new URL(s);
    const host = url.hostname.replace("www.", "").replace("m.", "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/")[1];
      return id || null;
    }
    const v = url.searchParams.get("v");
    if (v) return v;
    // /shorts/ID, /embed/ID, /v/ID
    const parts = url.pathname.split("/").filter(Boolean);
    for (const key of ["shorts", "embed", "v"]) {
      const idx = parts.indexOf(key);
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].split("?")[0];
    }
    return null;
  } catch {
    return null;
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
// Socket.IO 이벤트 rate-limit (IP 기준, 슬라이딩 윈도)
// =========================
const SOCKET_RATE_WINDOW = 10_000; // 10초
const SOCKET_RATE_MAX = 30;        // 10초당 30 이벤트
const _socketHits = new Map();     // ip → { ts[], blocked }

function socketRateLimited(socket) {
  const ip = socket.handshake.address;
  let bucket = _socketHits.get(ip);
  if (!bucket) { bucket = { ts: [], blocked: false }; _socketHits.set(ip, bucket); }
  const now = Date.now();
  bucket.ts = bucket.ts.filter(t => now - t < SOCKET_RATE_WINDOW);
  bucket.ts.push(now);
  if (bucket.ts.length > SOCKET_RATE_MAX) {
    if (!bucket.blocked) {
      bucket.blocked = true;
      console.warn(`[RATE] socket rate-limited ip=${ip} userId=${socket.user?.id}`);
    }
    return true;
  }
  bucket.blocked = false;
  return false;
}
// 주기적 정리 (5분마다 오래된 버킷 삭제)
setInterval(() => {
  const cutoff = Date.now() - SOCKET_RATE_WINDOW * 2;
  for (const [ip, b] of _socketHits) {
    if (!b.ts.length || b.ts[b.ts.length - 1] < cutoff) _socketHits.delete(ip);
  }
}, 300_000);

// =========================
// safeOn: socket.on 래퍼 — 예외 방어 + rate-limit
// =========================
function safeOn(socket, event, handler) {
  socket.on(event, async (...args) => {
    // rate-limit 체크 (ping/disconnect 제외)
    if (event !== "disconnect" && event !== "room:ping" && socketRateLimited(socket)) {
      const cb = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      return cb?.({ ok: false, error: "RATE_LIMITED" });
    }
    try {
      await handler(...args);
    } catch (err) {
      console.error(`[SOCKET] unhandled error in "${event}":`, err);
      const cb = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      cb?.({ ok: false, error: "INTERNAL_ERROR" });
    }
  });
}

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

  safeOn(socket, "room:create", async (payload, cb) => {
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
      // ✅ 월드컵 강수/선발방식 옵션
      wcRound: parseInt(payload?.round, 10) || 0,   // 0이면 전체
      wcPick: payload?.pick === "ranked" ? "ranked" : "random",
      // ✅ 퀴즈 문제 수 옵션
      questionCount: parseInt(payload?.questionCount, 10) || 0, // 0이면 전체
      // ✅ 동률 시 재투표 옵션
      revoteEnabled: payload?.revoteEnabled !== false,  // 기본값 true
      revoteCount: 0,  // 현재 매치에서 재투표 횟수
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

  safeOn(socket, "room:join", (payload, cb) => {
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
      // ── MAX_PLAYERS 초과 시 입장 거절 ──
      if (room.players.size >= MAX_PLAYERS) {
        return cb?.({ ok: false, error: "ROOM_FULL" });
      }
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

  safeOn(socket, "room:leave", (payload, cb) => {
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

  safeOn(socket, "room:ping", () => {});

  // =========================
  // 월드컵 이벤트 (기존 그대로)
  // =========================

  safeOn(socket, "game:start", async (payload, cb) => {
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
        // ✅ 타이머: 호스트가 room:create에서 설정한 값 유지 (월드컵과 동일 — DB 값으로 덮어쓰지 않음)

        // ✅ 문제 수 제한: questionCount > 0이면 랜덤 N문제 추출
        let quizQuestions = loaded.questions;
        if (room.questionCount > 0 && room.questionCount < quizQuestions.length) {
          // Fisher-Yates shuffle 후 앞에서 N개 slice
          const shuffled = quizQuestions.slice();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          quizQuestions = shuffled.slice(0, room.questionCount);
          console.log(`[game:start] quiz question limit: ${room.questionCount}/${loaded.questions.length} → ${quizQuestions.length} selected`);
        }
        initQuizState(room, quizQuestions);

        console.log(`[game:start] quiz started — questions=${quizQuestions.length} → quiz:question broadcast`);
        advanceQuizQuestion(room);
        return cb?.({ ok: true, totalQuestions: quizQuestions.length });
      }

      // ── 월드컵 모드 ──
      if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

      const loaded = await loadCandidates(contentId, me.id, me.isAdmin);
      if (loaded.error) {
        console.log(`[game:start] worldcup load FAILED: ${loaded.error}`);
        return cb?.({ ok: false, error: loaded.error });
      }

      // ✅ 강수/선발방식에 따른 후보 선발
      const selectedCandidates = await selectCandidatesForRoom(
        loaded.candidates,
        contentId,
        room.wcRound || 0,
        room.wcPick || "random"
      );
      console.log(`[game:start] 선발된 후보: ${selectedCandidates.length}명 (round=${room.wcRound}, pick=${room.wcPick})`);

      room.content = loaded.content;
      initBracket(room, selectedCandidates);

      room.roundIndex = 1;
      room.phase = "playing";
      room.committed.clear();
      for (const p of room.players.values()) delete p.choice;
      for (const userId of room.players.keys()) room.scores[userId] = 0;

      nextMatch(room);

      const timerInfo = { enabled: room.timerEnabled, sec: room.timerSec };
      // ✅ worldcup:round로 통일 (프론트가 이 이벤트를 핸들링함)
      console.log(`[game:start] EMIT worldcup:round match=`, JSON.stringify(room.currentMatch).slice(0, 300));
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

  safeOn(socket, "worldcup:commit", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    // playing 또는 revoting 상태에서만 투표 가능
    if (room.phase !== "playing" && room.phase !== "revoting") return cb?.({ ok: false, error: "NOT_PLAYING" });

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

  safeOn(socket, "worldcup:next", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
    if (room.phase !== "revealed") return cb?.({ ok: false, error: "NOT_REVEALED" });

    if (room.champion) {
      room.phase = "finished";
      const scores = buildScores(room);
      // ✅ worldcup:finished (프론트가 이 이벤트를 핸들링함)
      const _champMedia = room.champion ? {
        type: room.champion.mediaType || "image",
        url: room.champion.mediaUrl || "",
        startSec: room.champion.startSec || 0
      } : null;
      console.log("[worldcup:finished] champion=", room.champion?.name, "championMedia=", JSON.stringify(_champMedia));
      io.to(room.id).emit("worldcup:finished", {
        roomId: room.id,
        champion: room.champion?.name || room.champion,
        championMedia: _champMedia,
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
    console.log(`[worldcup:next] EMIT worldcup:round match=`, JSON.stringify(room.currentMatch).slice(0, 300));
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
  safeOn(socket, "quiz:start", async (payload, cb) => {
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

      // ✅ 타이머: 호스트가 room:create에서 설정한 값 유지 (payload 오버라이드만 허용)
      if (payload?.timerEnabled !== undefined) {
        room.timerEnabled = !!payload.timerEnabled;
      }
      if (payload?.timerSec) room.timerSec = Math.min(180, Math.max(10, Number(payload.timerSec)));

      room.content = loaded.content;
      room.contentId = quizId;

      // ✅ 문제 수 제한: questionCount > 0이면 랜덤 N문제 추출
      let quizQs = loaded.questions;
      if (room.questionCount > 0 && room.questionCount < quizQs.length) {
        const shuffled = quizQs.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        quizQs = shuffled.slice(0, room.questionCount);
        console.log(`[quiz:start] question limit: ${room.questionCount}/${loaded.questions.length} → ${quizQs.length} selected`);
      }
      initQuizState(room, quizQs);

      console.log(`퀴즈 시작: 방=${room.id}, 문제=${quizQs.length}개`);

      advanceQuizQuestion(room);
      cb?.({ ok: true, totalQuestions: quizQs.length });
    } catch (err) {
      console.error("quiz:start 에러:", err);
      cb?.({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  // ── quiz:ready (각 유저 — 유튜브 재생 준비 완료) ──
  safeOn(socket, "quiz:ready", (payload, cb) => {
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
  safeOn(socket, "quiz:submit", (payload, cb) => {
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
  safeOn(socket, "quiz:next", (payload, cb) => {
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
  safeOn(socket, "quiz:playClicked", (payload) => {
    // 분석/로그용 — 별도 로직 없음
    const room = rooms.get(payload?.roomId);
    if (room) {
      console.log(`유튜브 재생 클릭: 방=${room.id}, 유저=${me.id}`);
    }
  });

  // =========================
  // 재접속 유예 (disconnect)
  // =========================

  safeOn(socket, "disconnect", async () => {
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
