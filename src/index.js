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
import ioClient from "socket.io-client";

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
// GET /contents?type=worldcup|quiz|all&sort=popular|newest|likes&limit=24&offset=0
// =========================
app.get("/contents", async (req, res) => {
  try {
    // 1) 쿼리 파라미터 받기
    const type = String(req.query.type || "all");      // worldcup | quiz | all
    const sort = String(req.query.sort || "popular");  // popular | newest | likes
    const limitRaw = Number(req.query.limit || 24);
    const limit = Math.min(60, Math.max(1, limitRaw)); // 1~60 제한
    const offsetRaw = Number(req.query.offset || 0);
    const offset = Math.max(0, offsetRaw);

    // 2) 기본 쿼리: public_contents_list(View)에서 읽기
    let q = supabaseAdmin
      .from("public_contents_list")
      .select("id, type, title, thumbnail_url, creator_name, play_count, complete_count, like_count, item_count, created_at")
      .range(offset, offset + limit - 1);

    // 3) type 필터 적용
    if (type === "worldcup" || type === "quiz") {
      q = q.eq("type", type);
    }

    // 4) 정렬 적용
    if (sort === "newest") {
      q = q.order("created_at", { ascending: false });
    } else if (sort === "likes") {
      q = q.order("like_count", { ascending: false }).order("created_at", { ascending: false });
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

    // 6) 응답 (hasMore: 다음 페이지 존재 여부)
    const items = data || [];
    return res.json({ ok: true, items, hasMore: items.length === limit });
  } catch (err) {
    console.error("GET /contents internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 콘텐츠 검색 (하이라이트 연결용 등)
// GET /content-search?q=키워드 → 월드컵/퀴즈/티어 통합 검색
// =========================
app.get("/content-search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 1) return res.json({ ok: true, items: [] });
    const like = `%${q}%`;

    // 1) contents (월드컵/퀴즈)
    const { data: cData } = await supabaseAdmin
      .from("contents")
      .select("id, title, mode, created_at")
      .ilike("title", like)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(10);

    // 2) tier_templates
    const { data: tData } = await supabaseAdmin
      .from("tier_templates")
      .select("id, title, created_at")
      .ilike("title", like)
      .eq("is_hidden", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const items = [];
    for (const c of (cData || [])) {
      items.push({ id: c.id, title: c.title, type: c.mode === "quiz" ? "퀴즈" : "월드컵", linkField: "content_id", created_at: c.created_at });
    }
    for (const t of (tData || [])) {
      items.push({ id: t.id, title: t.title, type: "티어", linkField: "tier_template_id", created_at: t.created_at });
    }
    // 최신순 정렬, 최대 15개
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return res.json({ ok: true, items: items.slice(0, 15) });
  } catch (err) {
    console.error("GET /content-search:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 콘텐츠 ID로 제목 조회 (하이라이트 연결 표시용)
app.get("/content-lookup/:id", async (req, res) => {
  try {
    const id = req.params.id;
    // contents 먼저
    const { data: c } = await supabaseAdmin.from("contents").select("id, title, mode").eq("id", id).maybeSingle();
    if (c) return res.json({ ok: true, item: { id: c.id, title: c.title, type: c.mode === "quiz" ? "퀴즈" : "월드컵", linkField: "content_id" } });
    // tier_templates
    const { data: t } = await supabaseAdmin.from("tier_templates").select("id, title").eq("id", id).maybeSingle();
    if (t) return res.json({ ok: true, item: { id: t.id, title: t.title, type: "티어", linkField: "tier_template_id" } });
    return res.json({ ok: true, item: null });
  } catch (err) {
    console.error("GET /content-lookup:", err);
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

    // 후보/문제 수 조회 (활성 후보만)
    let itemCount = 0;
    if (content.mode === "worldcup") {
      const { count } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId)
        .eq("is_active", true);
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
// 외부 영상 썸네일 프록시 (CHZZK / SOOP)
// =========================

const _ogThumbCache = new Map(); // url → { thumb: string|null, ts: number }
const OG_THUMB_TTL = 3600_000;   // 1시간

const _BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
};

// 소셜 미디어 봇 UA — CSR 사이트(CHZZK 등)가 og:image 포함 SSR HTML을 반환하도록 유도
const _BOT_UA_LIST = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "kakaotalk-scrap/1.0 (+https://devtalk.kakao.com/)",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
];

/** CHZZK 클립 ID 추출 */
function _extractChzzkClipId(url) {
  const m = url.match(/chzzk\.naver\.com\/(?:embed\/)?clips?\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** HTML에서 og:image 추출 */
function _extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

/** HTML에서 모든 이미지 URL 후보 추출 (CHZZK 전용) */
function _extractAllImageCandidates(html) {
  const candidates = [];
  // og:image
  const og = _extractOgImage(html);
  if (og) candidates.push({ src: og, tag: "og:image" });
  // twitter:image
  const tw = html.match(/<meta[^>]+(?:name|property)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image["']/i);
  if (tw) candidates.push({ src: tw[1], tag: "twitter:image" });
  // thumbnailImageUrl in JSON
  const tjson = html.match(/"thumbnailImageUrl"\s*:\s*"(https?:[^"]+)"/);
  if (tjson) candidates.push({ src: tjson[1], tag: "json:thumbnailImageUrl" });
  // clipThumbnailImageUrl
  const ctjson = html.match(/"clipThumbnailImageUrl"\s*:\s*"(https?:[^"]+)"/);
  if (ctjson) candidates.push({ src: ctjson[1], tag: "json:clipThumbnailImageUrl" });
  // poster in JSON
  const poster = html.match(/"poster"\s*:\s*"(https?:[^"]+)"/);
  if (poster) candidates.push({ src: poster[1], tag: "json:poster" });
  // Naver CDN (pstatic.net) image URLs
  const cdnRe = /https?:\/\/[a-z0-9-]+\.pstatic\.net\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi;
  let cdnMatch;
  while ((cdnMatch = cdnRe.exec(html)) !== null) {
    candidates.push({ src: cdnMatch[0], tag: "cdn:pstatic" });
  }
  // nng-phinf (CHZZK-specific CDN)
  const nngRe = /https?:\/\/nng-phinf\.pstatic\.net\/[^"'\s<>]+/gi;
  let nngMatch;
  while ((nngMatch = nngRe.exec(html)) !== null) {
    if (!candidates.some(c => c.src === nngMatch[0])) {
      candidates.push({ src: nngMatch[0], tag: "cdn:nng-phinf" });
    }
  }
  return candidates;
}

/**
 * CHZZK 썸네일 가져오기 — 봇 UA 전략
 *
 * 핵심 원인: CHZZK는 CSR(Client-Side Rendering) SPA이므로
 * 일반 브라우저 UA로 요청 시 빈 HTML 셸(~1800bytes, favicon만 포함)을 반환.
 * 하지만 소셜 미디어 봇(카카오톡/트위터/페이스북) UA로 요청하면
 * og:image가 포함된 SSR 프리렌더 HTML을 반환함.
 *
 * 전략 순서:
 * 1. 봇 UA로 clips 페이지 (og:image SSR 유도) ← 핵심 전략
 * 2. 봇 UA로 embed 페이지
 * 3. CHZZK API (v1, v2)
 * 4. 일반 UA fallback (거의 실패하지만 보험)
 */
async function _fetchChzzkThumb(clipId) {
  const clipsUrl = `https://chzzk.naver.com/clips/${clipId}`;
  const embedUrl = `https://chzzk.naver.com/embed/clip/${clipId}`;

  // ── 전략 1: 봇 UA로 clips 페이지 요청 (핵심) ──
  for (const botUA of _BOT_UA_LIST) {
    try {
      const botName = botUA.split("/")[0];
      console.log(`[og-thumb] CHZZK strategy 1: clips + bot UA (${botName})`);
      const resp = await fetch(clipsUrl, {
        headers: {
          "User-Agent": botUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      console.log(`[og-thumb] CHZZK clips+${botName}: status=${resp.status}`);
      if (resp.ok) {
        const html = await resp.text();
        console.log(`[og-thumb] CHZZK clips+${botName}: HTML length=${html.length}`);
        const candidates = _extractAllImageCandidates(html);
        // favicon 필터: favicon.png/ico 등은 제외
        const real = candidates.filter(c =>
          !c.src.includes("favicon") && !c.src.endsWith(".ico")
        );
        if (real.length) {
          console.log(`[og-thumb] CHZZK clips+${botName} HIT:`, real.map(c => `${c.tag}=${c.src.slice(0, 80)}`).join(" | "));
          return real[0].src;
        }
        // 디버그: HTML이 충분히 긴데 이미지가 없으면 head 스니펫 출력
        if (html.length > 2000 && !real.length) {
          const headSnippet = html.match(/<head[^>]*>([\s\S]{0,800})/i);
          console.log(`[og-thumb] CHZZK clips+${botName}: long HTML but no real candidates. head:`, headSnippet?.[1]?.slice(0, 400) || "(no head)");
        }
      }
    } catch (e) { console.log(`[og-thumb] CHZZK clips+bot error:`, e.message); }
  }

  // ── 전략 2: 봇 UA로 embed 페이지 ──
  for (const botUA of _BOT_UA_LIST.slice(0, 2)) { // Facebook, Twitter만 시도
    try {
      const botName = botUA.split("/")[0];
      console.log(`[og-thumb] CHZZK strategy 2: embed + bot UA (${botName})`);
      const resp = await fetch(embedUrl, {
        headers: {
          "User-Agent": botUA,
          "Accept": "text/html,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const html = await resp.text();
        console.log(`[og-thumb] CHZZK embed+${botName}: HTML length=${html.length}`);
        const candidates = _extractAllImageCandidates(html);
        const real = candidates.filter(c => !c.src.includes("favicon") && !c.src.endsWith(".ico"));
        if (real.length) {
          console.log(`[og-thumb] CHZZK embed+${botName} HIT:`, real[0].src.slice(0, 80));
          return real[0].src;
        }
      }
    } catch (e) { console.log(`[og-thumb] CHZZK embed+bot error:`, e.message); }
  }

  // ── 전략 3: CHZZK API (v1, v2) ──
  for (const ver of ["v1", "v2"]) {
    try {
      const apiUrl = `https://api.chzzk.naver.com/service/${ver}/clips/${clipId}`;
      console.log(`[og-thumb] CHZZK strategy 3: API ${ver}`);
      const resp = await fetch(apiUrl, {
        headers: {
          "User-Agent": _BROWSER_HEADERS["User-Agent"],
          "Accept": "application/json",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Referer": "https://chzzk.naver.com/",
          "Origin": "https://chzzk.naver.com",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[og-thumb] CHZZK API ${ver}: status=${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        const c = data?.content || data?.data || data;
        const thumb = c?.thumbnailImageUrl || c?.clipThumbnailImageUrl
                   || c?.thumbnail || c?.posterImageUrl || c?.thumbnailUrl;
        if (thumb) { console.log(`[og-thumb] CHZZK API ${ver} HIT:`, thumb.slice(0, 80)); return thumb; }
        else { console.log(`[og-thumb] CHZZK API ${ver} keys:`, Object.keys(c || {}).slice(0, 20).join(",")); }
      }
    } catch (e) { console.log(`[og-thumb] CHZZK API ${ver} error:`, e.message); }
  }

  // ── 전략 4: 일반 브라우저 UA (보험) ──
  try {
    console.log("[og-thumb] CHZZK strategy 4: browser UA fallback");
    const resp = await fetch(clipsUrl, {
      headers: { ..._BROWSER_HEADERS, "Referer": "https://chzzk.naver.com/" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const html = await resp.text();
      const candidates = _extractAllImageCandidates(html);
      const real = candidates.filter(c => !c.src.includes("favicon") && !c.src.endsWith(".ico"));
      if (real.length) {
        console.log("[og-thumb] CHZZK browser UA HIT:", real[0].src.slice(0, 80));
        return real[0].src;
      }
    }
  } catch (e) { console.log("[og-thumb] CHZZK browser fallback error:", e.message); }

  console.log("[og-thumb] CHZZK all strategies failed for clip:", clipId);
  return null;
}

app.get("/api/og-thumb", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "url required" });

  // 보안: 허용 도메인 (CHZZK / SOOP / 네이버 비디오)
  const ALLOWED = /^https?:\/\/(chzzk\.naver\.com|vod\.sooplive\.co\.kr|serviceapi\.nmv\.naver\.com|nmv\.naver\.com)\//i;
  if (!ALLOWED.test(url)) return res.status(403).json({ error: "domain not allowed" });

  // 캐시 확인 (nocache=1로 우회 가능)
  if (req.query.nocache !== "1") {
    const cached = _ogThumbCache.get(url);
    if (cached && Date.now() - cached.ts < OG_THUMB_TTL) {
      if (cached.thumb) {
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.redirect(302, cached.thumb);
      }
      return res.status(404).json({ error: "no thumbnail (cached)" });
    }
  }

  try {
    let thumb = null;

    // ── CHZZK ──
    const chzzkId = _extractChzzkClipId(url);
    if (chzzkId) {
      thumb = await _fetchChzzkThumb(chzzkId);
    } else {
      // ── 네이버 비디오 / SOOP: og:image 추출 (서버 렌더 HTML, 봇 UA 불필요) ──
      try {
        const resp = await fetch(url, { headers: _BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(5000) });
        thumb = _extractOgImage(await resp.text());
      } catch {}
    }

    _ogThumbCache.set(url, { thumb, ts: Date.now() });

    if (thumb) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, thumb);
    }
    return res.status(404).json({ error: "no thumbnail" });
  } catch (err) {
    console.error("[og-thumb] fetch error:", url, err.message);
    return res.status(502).json({ error: "fetch failed" });
  }
});

// GET /api/og-thumb/debug — CHZZK 썸네일 디버그 (배포 후 확인용)
app.get("/api/og-thumb/debug", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "url required" });

  const ALLOWED = /^https?:\/\/(chzzk\.naver\.com|vod\.sooplive\.co\.kr|serviceapi\.nmv\.naver\.com|nmv\.naver\.com)\//i;
  if (!ALLOWED.test(url)) return res.status(403).json({ error: "domain not allowed" });

  const chzzkId = _extractChzzkClipId(url);
  const results = { url, chzzkId, strategies: [] };

  if (chzzkId) {
    const clipsUrl = `https://chzzk.naver.com/clips/${chzzkId}`;
    const embedUrl = `https://chzzk.naver.com/embed/clip/${chzzkId}`;

    // ── 봇 UA로 clips 페이지 (핵심 전략) ──
    for (const botUA of _BOT_UA_LIST) {
      const botName = botUA.split("/")[0];
      try {
        const resp = await fetch(clipsUrl, {
          headers: { "User-Agent": botUA, "Accept": "text/html,*/*;q=0.8", "Accept-Language": "ko-KR,ko;q=0.9" },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        const html = resp.ok ? await resp.text() : "";
        const candidates = resp.ok ? _extractAllImageCandidates(html) : [];
        const real = candidates.filter(c => !c.src.includes("favicon") && !c.src.endsWith(".ico"));
        results.strategies.push({
          name: `clips_bot_${botName}`,
          status: resp.status,
          htmlLength: html.length,
          allCandidates: candidates.map(c => ({ tag: c.tag, src: c.src.slice(0, 150) })),
          realCandidates: real.map(c => ({ tag: c.tag, src: c.src.slice(0, 150) })),
          headSnippet: html.length < 3000 ? html.match(/<head[^>]*>([\s\S]{0,600})/i)?.[1]?.slice(0, 400) || "" : "(large HTML, skipped)",
        });
      } catch (e) { results.strategies.push({ name: `clips_bot_${botName}`, error: e.message }); }
    }

    // ── 일반 브라우저 UA (비교용) ──
    try {
      const resp = await fetch(clipsUrl, {
        headers: { ..._BROWSER_HEADERS, "Referer": "https://chzzk.naver.com/" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      const html = resp.ok ? await resp.text() : "";
      const candidates = resp.ok ? _extractAllImageCandidates(html) : [];
      results.strategies.push({
        name: "clips_browser_ua",
        status: resp.status,
        htmlLength: html.length,
        candidates: candidates.map(c => ({ tag: c.tag, src: c.src.slice(0, 150) })),
      });
    } catch (e) { results.strategies.push({ name: "clips_browser_ua", error: e.message }); }

    // ── API v1, v2 ──
    for (const ver of ["v1", "v2"]) {
      try {
        const resp = await fetch(`https://api.chzzk.naver.com/service/${ver}/clips/${chzzkId}`, {
          headers: {
            "User-Agent": _BROWSER_HEADERS["User-Agent"],
            "Accept": "application/json",
            "Referer": "https://chzzk.naver.com/",
            "Origin": "https://chzzk.naver.com",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        });
        let body = null;
        if (resp.ok) {
          const data = await resp.json();
          const c = data?.content || data?.data || data;
          body = {
            keys: Object.keys(c || {}),
            thumbnailImageUrl: c?.thumbnailImageUrl || null,
            clipThumbnailImageUrl: c?.clipThumbnailImageUrl || null,
            thumbnail: c?.thumbnail || null,
            posterImageUrl: c?.posterImageUrl || null,
            thumbnailUrl: c?.thumbnailUrl || null,
          };
        }
        results.strategies.push({ name: `api_${ver}`, status: resp.status, body });
      } catch (e) { results.strategies.push({ name: `api_${ver}`, error: e.message }); }
    }
  } else {
    // SOOP
    try {
      const resp = await fetch(url, { headers: _BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(5000) });
      const html = resp.ok ? await resp.text() : "";
      results.strategies.push({
        name: "soop_og",
        status: resp.status,
        htmlLength: html.length,
        ogImage: resp.ok ? _extractOgImage(html) : null,
      });
    } catch (e) { results.strategies.push({ name: "soop_og", error: e.message }); }
  }

  res.json(results);
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

    // 후보/문제 수 (활성 후보만)
    let itemCount = 0;
    if (content.mode === "worldcup") {
      const { count } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("*", { count: "exact", head: true })
        .eq("content_id", contentId)
        .eq("is_active", true);
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
// 댓글 신고 API
// =========================
app.post("/comment-reports", requireAuth, async (req, res) => {
  try {
    const { commentId, commentTable, reason, detail } = req.body;
    if (!commentId || !commentTable || !reason) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }
    if (!["content_comments", "tier_instance_comments"].includes(commentTable)) {
      return res.status(400).json({ ok: false, error: "INVALID_COMMENT_TABLE" });
    }

    const VALID_REASONS = ["욕설/비방", "도배/광고", "음란/부적절", "기타"];
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ ok: false, error: "INVALID_REASON" });
    }

    // 댓글 존재 확인
    const { data: comment, error: commentErr } = await supabaseAdmin
      .from(commentTable)
      .select("id, user_id")
      .eq("id", commentId)
      .maybeSingle();

    if (commentErr || !comment) {
      return res.status(404).json({ ok: false, error: "COMMENT_NOT_FOUND" });
    }

    // 자기 댓글 신고 방지
    if (comment.user_id === req.user.id) {
      return res.status(400).json({ ok: false, error: "CANNOT_REPORT_OWN" });
    }

    const { error } = await supabaseAdmin.from("comment_reports").insert({
      comment_id: commentId,
      comment_table: commentTable,
      reporter_user_id: req.user.id,
      reason,
      detail: detail || null,
    });

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ ok: false, error: "ALREADY_REPORTED" });
      }
      console.error("POST /comment-reports error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /comment-reports internal:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// =========================
// 관리자 API
// =========================

// 관리자: 댓글 신고 목록
app.get("/admin/comment-reports", requireAdmin, async (req, res) => {
  try {
    const { status, sort } = req.query;

    let query = supabaseAdmin
      .from("comment_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: reports, error } = await query;
    if (error) {
      console.error("GET /admin/comment-reports DB error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    if (!reports || reports.length === 0) {
      return res.json({ ok: true, items: [] });
    }

    // 댓글별로 그룹핑
    const groupMap = new Map();
    for (const r of reports) {
      const key = `${r.comment_table}::${r.comment_id}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          comment_id: r.comment_id,
          comment_table: r.comment_table,
          report_count: 0,
          group_status: "open",
          first_reported_at: r.created_at,
          last_reported_at: r.created_at,
          reports: [],
        });
      }
      const g = groupMap.get(key);
      g.report_count++;
      g.reports.push(r);
      if (new Date(r.created_at) < new Date(g.first_reported_at)) g.first_reported_at = r.created_at;
      if (new Date(r.created_at) > new Date(g.last_reported_at)) g.last_reported_at = r.created_at;
      // group_status: open if any open
      if (r.status === "open") g.group_status = "open";
    }

    // Determine group status more accurately
    for (const g of groupMap.values()) {
      const hasOpen = g.reports.some(r => r.status === "open");
      const allResolved = g.reports.every(r => r.status === "resolved");
      if (hasOpen) g.group_status = "open";
      else if (allResolved) g.group_status = "resolved";
      else g.group_status = "ignored";
    }

    // 댓글 원문 조회
    const contentCommentIds = [];
    const tierCommentIds = [];
    for (const g of groupMap.values()) {
      if (g.comment_table === "content_comments") contentCommentIds.push(g.comment_id);
      else tierCommentIds.push(g.comment_id);
    }

    const commentMap = new Map();

    if (contentCommentIds.length > 0) {
      const { data: ccRows } = await supabaseAdmin
        .from("content_comments")
        .select("id, content_id, content_type, user_id, author_name, body, created_at")
        .in("id", contentCommentIds);
      if (ccRows) {
        for (const c of ccRows) {
          commentMap.set(c.id, { ...c, _table: "content_comments" });
        }
      }
    }

    if (tierCommentIds.length > 0) {
      const { data: tcRows } = await supabaseAdmin
        .from("tier_instance_comments")
        .select("id, instance_id, user_id, author_name, body, created_at")
        .in("id", tierCommentIds);
      if (tcRows) {
        for (const c of tcRows) {
          commentMap.set(c.id, { ...c, _table: "tier_instance_comments" });
        }
      }
    }

    // 프로필 조회 (댓글 작성자 + 신고자)
    const allUserIds = new Set();
    for (const c of commentMap.values()) {
      if (c.user_id) allUserIds.add(c.user_id);
    }
    for (const r of reports) {
      if (r.reporter_user_id) allUserIds.add(r.reporter_user_id);
    }

    const profileMap = new Map();
    if (allUserIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", [...allUserIds]);
      if (profiles) {
        for (const p of profiles) profileMap.set(p.id, p);
      }
    }

    // 콘텐츠 제목 조회 (content_comments의 content_id)
    const contentIds = new Set();
    for (const c of commentMap.values()) {
      if (c._table === "content_comments" && c.content_id) contentIds.add(c.content_id);
    }
    const contentTitleMap = new Map();
    if (contentIds.size > 0) {
      const { data: contents } = await supabaseAdmin
        .from("contents")
        .select("id, title")
        .in("id", [...contentIds]);
      if (contents) {
        for (const c of contents) contentTitleMap.set(c.id, c.title);
      }
    }

    // 티어 인스턴스 → 템플릿 제목 조회
    const instanceIds = new Set();
    for (const c of commentMap.values()) {
      if (c._table === "tier_instance_comments" && c.instance_id) instanceIds.add(c.instance_id);
    }
    const instanceTitleMap = new Map();
    if (instanceIds.size > 0) {
      const { data: instances } = await supabaseAdmin
        .from("tier_instances")
        .select("id, template_id")
        .in("id", [...instanceIds]);
      if (instances) {
        const tplIds = [...new Set(instances.map(i => i.template_id).filter(Boolean))];
        if (tplIds.length > 0) {
          const { data: templates } = await supabaseAdmin
            .from("tier_templates")
            .select("id, title")
            .in("id", tplIds);
          const tplMap = new Map();
          if (templates) for (const t of templates) tplMap.set(t.id, t.title);
          for (const inst of instances) {
            instanceTitleMap.set(inst.id, tplMap.get(inst.template_id) || "티어");
          }
        }
      }
    }

    // 최종 응답 조립
    const items = [];
    for (const g of groupMap.values()) {
      const comment = commentMap.get(g.comment_id);
      const authorProfile = comment?.user_id ? profileMap.get(comment.user_id) : null;

      let contentTitle = "-";
      let contentLink = null;
      if (comment?._table === "content_comments" && comment.content_id) {
        contentTitle = contentTitleMap.get(comment.content_id) || "-";
        contentLink = { type: comment.content_type, id: comment.content_id };
      } else if (comment?._table === "tier_instance_comments" && comment.instance_id) {
        contentTitle = instanceTitleMap.get(comment.instance_id) || "티어";
        contentLink = { type: "tier", id: comment.instance_id };
      }

      items.push({
        ...g,
        comment: comment ? {
          id: comment.id,
          body: comment.body,
          author_name: authorProfile?.nickname || comment.author_name || "알 수 없음",
          author_avatar: authorProfile?.avatar_url || null,
          user_id: comment.user_id,
          created_at: comment.created_at,
        } : null,
        content_title: contentTitle,
        content_link: contentLink,
        reports: g.reports.map(r => ({
          ...r,
          reporter_name: profileMap.get(r.reporter_user_id)?.nickname || "알 수 없음",
        })),
      });
    }

    // 정렬: open first, then by report_count desc, then by last_reported_at desc
    items.sort((a, b) => {
      if (a.group_status === "open" && b.group_status !== "open") return -1;
      if (a.group_status !== "open" && b.group_status === "open") return 1;
      if (b.report_count !== a.report_count) return b.report_count - a.report_count;
      return new Date(b.last_reported_at) - new Date(a.last_reported_at);
    });

    if (sort === "newest") {
      items.sort((a, b) => new Date(b.last_reported_at) - new Date(a.last_reported_at));
    }

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /admin/comment-reports:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 관리자: 댓글 신고 일괄 상태 변경 (batch-status MUST come before :id/status)
app.patch("/admin/comment-reports/batch-status", requireAdmin, async (req, res) => {
  try {
    const { commentId, commentTable, status: newStatus } = req.body;
    if (!commentId || !commentTable || !["open", "resolved", "ignored"].includes(newStatus)) {
      return res.status(400).json({ ok: false, error: "INVALID_PARAMS" });
    }

    const { error } = await supabaseAdmin
      .from("comment_reports")
      .update({ status: newStatus })
      .eq("comment_id", commentId)
      .eq("comment_table", commentTable);

    if (error) {
      console.error("PATCH /admin/comment-reports/batch-status error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/comment-reports/batch-status:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 관리자: 댓글 신고 개별 상태 변경
app.patch("/admin/comment-reports/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    if (!["open", "resolved", "ignored"].includes(newStatus)) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }

    const { error } = await supabaseAdmin
      .from("comment_reports")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("PATCH /admin/comment-reports/:id/status error:", error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/comment-reports/:id/status:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 관리자: 신고된 댓글 삭제 (hard delete)
app.delete("/admin/comments/:commentTable/:commentId", requireAdmin, async (req, res) => {
  try {
    const { commentTable, commentId } = req.params;
    if (!["content_comments", "tier_instance_comments"].includes(commentTable)) {
      return res.status(400).json({ ok: false, error: "INVALID_TABLE" });
    }

    // 댓글 삭제
    const { error } = await supabaseAdmin
      .from(commentTable)
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error(`DELETE /admin/comments/${commentTable}/${commentId} error:`, error);
      return res.status(500).json({ ok: false, error: "DB_ERROR" });
    }

    // 관련 신고 → resolved 처리
    await supabaseAdmin
      .from("comment_reports")
      .update({ status: "resolved" })
      .eq("comment_id", commentId)
      .eq("comment_table", commentTable);

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/comments:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

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
      .select("id, title, mode, visibility, is_hidden, hidden_reason, report_count, owner_id, play_count, complete_count, thumbnail_url, auto_thumbnail_url, description, category, tags, created_at, updated_at", { count: "exact" });

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
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`);
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

// 관리자 콘텐츠 일반 수정 (title, description, category, tags, visibility, is_hidden, hidden_reason, thumbnail_url)
app.patch("/admin/contents/:id", requireAdmin, async (req, res) => {
  try {
    const { title, description, category, tags, visibility, is_hidden, hidden_reason, thumbnail_url } = req.body;

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
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url || null;

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
      const searchTerm = q.trim();
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`);
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
// 하이라이트 관리 API (Admin)
// =========================

// 목록 조회
app.get("/admin/highlights", requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 30, status: st, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin.from("highlights").select("*", { count: "exact" });
    if (st && st !== "all") query = query.eq("status", st);
    if (q && q.trim()) {
      const s = q.trim();
      query = query.or(`title.ilike.%${s}%,channel_name.ilike.%${s}%`);
    }
    query = query.order("created_at", { ascending: false }).range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) });
  } catch (err) {
    console.error("GET /admin/highlights:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 등록
app.post("/admin/highlights", requireAdmin, async (req, res) => {
  try {
    const { platform, video_url, title, channel_name, content_id, tier_template_id, thumbnail_url, description, status, is_public, sort_order, admin_note } = req.body;
    if (!platform || !video_url || !title) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

    const row = {
      platform, video_url, title,
      channel_name: channel_name || "",
      content_id: (content_id && content_id.trim()) || null,
      tier_template_id: (tier_template_id && tier_template_id.trim()) || null,
      thumbnail_url: thumbnail_url || null,
      description: description || null,
      status: status || "approved",
      is_public: is_public !== false,
      sort_order: sort_order || 0,
      admin_note: admin_note || null,
    };
    const { data, error } = await supabaseAdmin.from("highlights").insert(row).select().single();
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    return res.json({ ok: true, item: data });
  } catch (err) {
    console.error("POST /admin/highlights:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 수정
app.patch("/admin/highlights/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = ["platform", "video_url", "title", "channel_name", "content_id", "tier_template_id", "thumbnail_url", "description", "status", "is_public", "sort_order", "admin_note"];
    const uuidFields = new Set(["content_id", "tier_template_id"]);
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates[k] = uuidFields.has(k) ? ((req.body[k] && String(req.body[k]).trim()) || null) : req.body[k];
      }
    }

    const { error } = await supabaseAdmin.from("highlights").update(updates).eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/highlights/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 삭제
app.delete("/admin/highlights/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from("highlights").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/highlights/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// ==============================
// 공지사항 관리 (Admin)
// ==============================

// 공지 목록 (관리자)
app.get("/admin/notices", requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin.from("notices").select("*", { count: "exact" });
    if (q && q.trim()) {
      query = query.ilike("title", `%${q.trim()}%`);
    }
    query = query.order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    return res.json({ ok: true, items: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) });
  } catch (err) {
    console.error("GET /admin/notices:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 공지 작성
app.post("/admin/notices", requireAdmin, async (req, res) => {
  try {
    const { title, body, is_pinned } = req.body;
    if (!title || !body) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

    const row = {
      title: title.trim(),
      body: body.trim(),
      author_id: req.user.id,
      is_pinned: !!is_pinned,
    };
    const { data, error } = await supabaseAdmin.from("notices").insert(row).select().single();
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    return res.json({ ok: true, item: data });
  } catch (err) {
    console.error("POST /admin/notices:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 공지 수정
app.patch("/admin/notices/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = ["title", "body", "is_pinned"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates[k] = typeof req.body[k] === "string" ? req.body[k].trim() : req.body[k];
      }
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from("notices").update(updates).eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR", detail: error.message });
    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /admin/notices/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 공지 삭제
app.delete("/admin/notices/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from("notices").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/notices/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 관리자 댓글 삭제 (RLS 우회)
app.delete("/admin/notice-comments/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from("notice_comments").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /admin/notice-comments/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// ==============================
// 공지사항 공개 API (비로그인 접근 가능)
// ==============================

// 공지 목록 (공개)
app.get("/notices", async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, error, count } = await supabaseAdmin.from("notices")
      .select("id, title, is_pinned, comment_count, created_at", { count: "exact" })
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) });
  } catch (err) {
    console.error("GET /notices:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 공지 상세 (공개)
app.get("/notices/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("notices")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, item: data });
  } catch (err) {
    console.error("GET /notices/:id:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 공개 하이라이트 목록 (비로그인 접근 가능)
app.get("/highlights", async (req, res) => {
  try {
    const { page = 1, limit = 20, content_id, platform } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin.from("highlights").select("*", { count: "exact" })
      .eq("status", "approved").eq("is_public", true);
    if (content_id) query = query.or(`content_id.eq.${content_id},tier_template_id.eq.${content_id}`);
    if (platform && platform !== "all") query = query.eq("platform", platform);
    query = query.order("sort_order", { ascending: false }).order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true, items: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) });
  } catch (err) {
    console.error("GET /highlights:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// 하이라이트 제보 (비로그인도 가능, 승인 대기로 저장)
app.post("/highlights/submit", async (req, res) => {
  try {
    const { video_url, channel_name, content_id, tier_template_id, memo } = req.body;
    if (!video_url || !video_url.trim()) return res.status(400).json({ ok: false, error: "MISSING_URL" });

    // 플랫폼 자동 감지
    let platform = "other";
    const urlLower = (video_url || "").toLowerCase();
    if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) platform = "youtube";
    else if (urlLower.includes("soop.co") || urlLower.includes("sooplive")) platform = "soop";
    else if (urlLower.includes("chzzk.naver")) platform = "chzzk";
    else if (urlLower.includes("twitch.tv")) platform = "twitch";

    // 유튜브 썸네일 자동 추출
    let thumbnail_url = null;
    if (platform === "youtube") {
      try {
        const u = new URL(video_url);
        let ytId = null;
        if (u.hostname.includes("youtu.be")) ytId = u.pathname.slice(1).split("/")[0];
        else if (u.hostname.includes("youtube")) ytId = u.searchParams.get("v");
        if (ytId) thumbnail_url = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      } catch { /* ignore */ }
    }

    const row = {
      platform,
      video_url: video_url.trim(),
      title: "(제보) " + (channel_name || "").trim().slice(0, 50),
      channel_name: (channel_name || "").trim(),
      content_id: (content_id && String(content_id).trim()) || null,
      tier_template_id: (tier_template_id && String(tier_template_id).trim()) || null,
      thumbnail_url,
      description: (memo || "").trim().slice(0, 300) || null,
      status: "pending",
      is_public: false,
      sort_order: 0,
      admin_note: null,
    };

    const { error } = await supabaseAdmin.from("highlights").insert(row);
    if (error) return res.status(500).json({ ok: false, error: "DB_ERROR" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /highlights/submit:", err);
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
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      children = data || [];
    } else if (content.mode === "quiz") {
      const { data } = await supabaseAdmin
        .from("quiz_questions")
        .select("*")
        .eq("content_id", content.id)
        .order("sort_order", { ascending: true });
      children = (data || []).map(q => ({ ...q, choices: _normalizeChoices(q.choices || []) }));
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

    // 후보 수정: 기존 ID 유지 (랭킹/전적 보존), soft delete
    if (existing.mode === "worldcup" && candidates && Array.isArray(candidates)) {
      // 1) 기존 활성 후보 ID 조회
      const { data: existingCands } = await supabaseAdmin
        .from("worldcup_candidates")
        .select("id")
        .eq("content_id", req.params.id)
        .eq("is_active", true);
      const existingIds = new Set((existingCands || []).map(r => r.id));

      // incoming에서 유효한 기존 ID만 추출
      const incomingIds = new Set(
        candidates.filter(c => c.id && existingIds.has(c.id)).map(c => c.id)
      );

      // 2) soft delete: DB에 있지만 incoming에 없는 후보 → is_active=false
      const toDeactivate = [...existingIds].filter(id => !incomingIds.has(id));
      if (toDeactivate.length > 0) {
        const { error: dErr } = await supabaseAdmin
          .from("worldcup_candidates")
          .update({ is_active: false })
          .in("id", toDeactivate);
        if (dErr) console.error("후보 비활성화 실패:", dErr);
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
      const rows = questions.map((q, i) => {
        const row = {
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
          reveal_media_type: q.reveal_media_type || null,
          reveal_media_url: q.reveal_media_url || null,
        };
        if (row.reveal_media_url) {
          console.log(`[REVEAL-MEDIA] PUT q${i}: reveal_media_url=${row.reveal_media_url}, reveal_media_type=${row.reveal_media_type}`);
        }
        return row;
      });
      if (rows.length > 0) {
        const { error: iErr } = await supabaseAdmin.from("quiz_questions").insert(rows);
        if (iErr) console.error("문제 재삽입 실패:", iErr);
        else console.log(`[REVEAL-MEDIA] PUT ${req.params.id}: ${rows.length} questions re-inserted, reveal count=${rows.filter(r => r.reveal_media_url).length}`);
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
// 주간 랭킹 API
// =========================

// GET /ranking/weekly — 현재 주(또는 지정 주) 랭킹
app.get("/ranking/weekly", async (req, res) => {
  try {
    const { week_start, limit = 50, offset = 0 } = req.query;
    const params = {
      p_limit: Math.min(parseInt(limit) || 50, 100),
      p_offset: parseInt(offset) || 0,
    };
    if (week_start) params.p_week_start = week_start;

    // 직전 주 명예의 전당 아카이브 자동 체크 (lazy)
    try {
      await supabaseAdmin.rpc("archive_weekly_champion");
    } catch (_) { /* ignore */ }

    const { data, error } = await supabaseAdmin.rpc("get_weekly_ranking", params);
    if (error) {
      console.error("[GET /ranking/weekly] rpc error:", error.message);
      return res.status(500).json({ ok: false, error: "RPC_FAIL" });
    }
    return res.json({ ok: true, ranking: data || [] });
  } catch (err) {
    console.error("[GET /ranking/weekly] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /ranking/top1 — 홈 티저용 현재 주 1위
app.get("/ranking/top1", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc("get_ranking_top1");
    if (error) {
      console.error("[GET /ranking/top1] rpc error:", error.message);
      return res.status(500).json({ ok: false, error: "RPC_FAIL" });
    }
    return res.json({ ok: true, top1: data && data.length > 0 ? data[0] : null });
  } catch (err) {
    console.error("[GET /ranking/top1] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /ranking/hall-of-fame — 명예의 전당
app.get("/ranking/hall-of-fame", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { data, error } = await supabaseAdmin.rpc("get_hall_of_fame", {
      p_limit: Math.min(parseInt(limit) || 20, 50),
      p_offset: parseInt(offset) || 0,
    });
    if (error) {
      console.error("[GET /ranking/hall-of-fame] rpc error:", error.message);
      return res.status(500).json({ ok: false, error: "RPC_FAIL" });
    }
    return res.json({ ok: true, entries: data || [] });
  } catch (err) {
    console.error("[GET /ranking/hall-of-fame] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// POST /ranking/archive — 수동 아카이브 (관리자 전용)
app.post("/ranking/archive", requireAdmin, async (req, res) => {
  try {
    const { week_start } = req.body;
    const params = {};
    if (week_start) params.p_target_week = week_start;

    const { data, error } = await supabaseAdmin.rpc("archive_weekly_champion", params);
    if (error) {
      console.error("[POST /ranking/archive] rpc error:", error.message);
      return res.status(500).json({ ok: false, error: "RPC_FAIL" });
    }
    return res.json({ ok: true, result: data });
  } catch (err) {
    console.error("[POST /ranking/archive] error:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// GET /ranking/me — 내 현재 주 랭킹 포인트 (로그인 필요)
app.get("/ranking/me", requireAuth, async (req, res) => {
  try {
    // auth.uid()를 사용하는 RPC이므로 유저 토큰으로 호출
    const token = req.headers.authorization?.replace("Bearer ", "");
    const { createClient } = await import("@supabase/supabase-js");
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error } = await userSupabase.rpc("get_my_ranking_points");
    if (error) {
      console.error("[GET /ranking/me] rpc error:", error.message);
      return res.status(500).json({ ok: false, error: "RPC_FAIL" });
    }
    return res.json({ ok: true, stats: data && data.length > 0 ? data[0] : null });
  } catch (err) {
    console.error("[GET /ranking/me] error:", err);
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
const MAX_PLAYERS = 6;
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
      quizMode: room.quizMode || "normal",
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
        speedSolver: q.speedSolver || null,
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
        if (room.quizMode === "speed") {
          if (q.speedSolver?.userId === userId) status = "정답!";
          else if (q.answers.has(userId)) status = "제출 완료";
          else status = "도전 중…";
        } else {
          status = q.answers.has(userId) ? "제출 완료" : "답변 중…";
        }
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
    return { userId, name: p.name, status, isGuest: !!p.isGuest };
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
    maxRevotes: 2,
    // ✅ 재접속 시 유튜브 구간 재생 복원용
    quizYoutube: room.quiz?.youtube || null,
    // ✅ 퀴즈 모드 (normal / speed)
    quizMode: room.quizMode || "normal"
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
    .eq("is_active", true)
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

  const winningSide = winnerCand === matchCands.A ? "A" : "B";
  const loserCand = winningSide === "A" ? matchCands.B : matchCands.A;
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

  // ── 멀티 + 플레이어 1명 이하: 결과 공개 스킵 → 바로 다음 라운드 ──
  // (스트리머/스피드 모드는 멀티 전용이므로 혼자 멀티 플레이 케이스 지원)
  if (room.players.size <= 1) {
    console.log(`[doReveal] 플레이어 ${room.players.size}명 → 결과 공개 스킵`);

    if (room.champion) {
      // 마지막 라운드: 바로 종료 처리
      room.phase = "finished";
      const _champMedia = room.champion ? {
        type: room.champion.mediaType || "image",
        url: room.champion.mediaUrl || "",
        startSec: room.champion.startSec || 0
      } : null;
      io.to(room.id).emit("worldcup:finished", {
        roomId: room.id,
        champion: room.champion?.name || room.champion,
        championMedia: _champMedia,
        scores,
        picksHistory: room.picksHistory
      });
      recordWorldcupRun(room, room.champion).catch(() => {});
      if (!room.alreadyCounted && room.contentId && room.hostUserId) {
        room.alreadyCounted = true;
        recordPlayOnce({ contentId: room.contentId, userId: room.hostUserId, mode: "multi", gameType: "worldcup" }).catch(() => {});
      }
      return;
    }

    // 다음 라운드 자동 진행 (worldcup:next 핸들러와 동일 로직)
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
    return;
  }

  const revealPayload = {
    picks,
    percent: {
      A: activePicks.length > 0 ? Math.round((aCount / total) * 100) : 0,
      B: activePicks.length > 0 ? Math.round((bCount / total) * 100) : 0
    },
    roundWinner,
    winningSide,
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
    questions: rows.map(q => {
      const rawStart = q.start_sec;
      const rawDur = q.duration_sec;
      const startSec = (typeof rawStart === "number" && rawStart >= 0) ? rawStart : 0;
      const durationSec = (typeof rawDur === "number" && rawDur > 0) ? rawDur : 10;
      if (rawStart !== null && rawStart !== undefined && rawStart !== startSec) {
        console.warn(`[QUIZ] startSec parse: raw=${JSON.stringify(rawStart)} → ${startSec} (qId=${q.id})`);
      }
      if (rawDur !== null && rawDur !== undefined && rawDur !== durationSec) {
        console.warn(`[QUIZ] durationSec parse: raw=${JSON.stringify(rawDur)} → ${durationSec} (qId=${q.id})`);
      }
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        choices: _normalizeChoices(q.choices || []),
        answer: q.answer || [],
        mediaType: q.media_type,
        mediaUrl: q.media_url,
        startSec,
        durationSec,
        sortOrder: q.sort_order,
        revealMediaType: q.reveal_media_type || null,
        revealMediaUrl: q.reveal_media_url || null,
      };
    })
  };
}

/** text[] 컬럼에서 객체가 문자열화된 경우 다시 파싱 */
function _normalizeChoices(choices) {
  if (!Array.isArray(choices)) return choices;
  return choices.map(c => {
    if (typeof c === "string" && c.startsWith("{") && c.endsWith("}")) {
      try { return JSON.parse(c); } catch { /* not JSON, keep as string */ }
    }
    return c;
  });
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

  if (question.type === "ordering") {
    // 순서 퀴즈: 완전 일치만 true (부분 점수는 getOrderingScore에서 별도 처리)
    if (!Array.isArray(userAnswer)) return false;
    const total = question.choices?.length || 0;
    if (userAnswer.length !== total) return false;
    return userAnswer.every((v, i) => Number(v) === i);
  }

  if (question.type === "classification") {
    // 분류퀴즈: 모든 카드가 올바른 카테고리에 → true
    if (typeof userAnswer !== "object" || userAnswer === null) return false;
    const total = question.choices?.length || 0;
    let correct = 0;
    (question.choices || []).forEach((item, i) => {
      const expected = typeof item === "string" ? "" : (item?.category || "");
      if (userAnswer[String(i)] === expected) correct++;
    });
    return correct === total;
  }

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

// 순서 퀴즈 부분 점수 계산
function getOrderingScore(question, userAnswer) {
  const total = question.choices?.length || 0;
  if (!Array.isArray(userAnswer) || total === 0) return { score: 0, correctCount: 0, totalItems: total };
  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (i < userAnswer.length && Number(userAnswer[i]) === i) correct++;
  }
  return { score: Math.round((correct / total) * 100) / 100, correctCount: correct, totalItems: total };
}

// 분류퀴즈 부분 점수 계산
function getClassificationScore(question, userAnswer) {
  const total = question.choices?.length || 0;
  if (typeof userAnswer !== "object" || userAnswer === null || total === 0) return { score: 0, correctCount: 0, totalItems: total };
  let correct = 0;
  (question.choices || []).forEach((item, i) => {
    const expected = typeof item === "string" ? "" : (item?.category || "");
    if (userAnswer[String(i)] === expected) correct++;
  });
  return { score: Math.round((correct / total) * 100) / 100, correctCount: correct, totalItems: total };
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
  if (q.type === "ordering") {
    payload.choices = q.choices; // 정답 순서 그대로 전달 (클라이언트에서 셔플)
  }
  if (q.type === "classification") {
    payload.choices = q.choices; // [{text, category}] 전달 (클라이언트에서 셔플)
    // 카테고리 목록만 별도 전달 (answer 배열 = 카테고리 리스트)
    payload.categories = q.answer; // ["CatA","CatB",...]
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
    // 스피드 모드 전용
    speedSolver: null,          // { userId, name } — 선착 정답자
    speedAttempts: new Map(),   // userId → { lastWrongAt, wrongCount }
    // 건너뛰기 투표
    skipVotes: new Set(),       // 건너뛰기 요청한 userId 집합
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
  // 스피드 모드 리셋
  q.speedSolver = null;
  q.speedAttempts.clear();
  // 건너뛰기 리셋
  q.skipVotes.clear();

  const questionPayload = safeQuestion(question, q.questionIndex, q.questions.length);
  io.to(room.id).emit("quiz:question", questionPayload);
  io.to(room.id).emit("room:state", publicRoom(room));

  if (question.type === "audio_youtube") {
    // 유튜브: 즉시 answering 전환 (클라이언트에서 플레이어 준비 후 자동재생)
    room.quizShowTimer = setTimeout(() => {
      room.quizShowTimer = null;
      startQuizAnswering(room);
    }, 500);
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
    youtubePayload = {
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
    quizMode: room.quizMode || "normal",
  });
  io.to(room.id).emit("room:state", publicRoom(room));

  startQuizTimer(room);
}

function startQuizTimer(room) {
  if (room.quizTimer) { clearTimeout(room.quizTimer); room.quizTimer = null; }
  if (!room.timerEnabled) {
    room.roundEndsAt = null;
    // 스피드 모드: 타이머 비활성이어도 최대 시간 제한 (120초)
    if (room.quizMode === "speed") {
      const SPEED_MAX_SEC = 120;
      room.roundEndsAt = Date.now() + SPEED_MAX_SEC * 1000;
      room.quizTimer = setTimeout(() => {
        room.quizTimer = null;
        room.roundEndsAt = null;
        for (const [userId] of room.players.entries()) {
          if (!room.quiz.answers.has(userId)) {
            room.quiz.answers.set(userId, { submitted: true, answer: null, isCorrect: false });
          }
        }
        io.to(room.id).emit("room:state", publicRoom(room));
        doQuizReveal(room);
      }, SPEED_MAX_SEC * 1000);
    }
    return;
  }

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

  const isSpeedMode = room.quizMode === "speed";

  for (const [userId, p] of room.players.entries()) {
    const entry = q.answers.get(userId) || { submitted: false, answer: null, isCorrect: false };

    if (isSpeedMode) {
      // 스피드 모드: 이미 submit 시점에 isCorrect + score 처리됨
      // entry.isCorrect 그대로 사용
    } else if (question.type === "ordering") {
      // 순서 퀴즈: 부분 점수
      if (entry.submitted && entry.answer !== null) {
        const orderResult = getOrderingScore(question, entry.answer);
        entry.isCorrect = orderResult.correctCount === orderResult.totalItems;
        entry.orderingScore = orderResult.score;
        entry.orderingCorrectCount = orderResult.correctCount;
        entry.orderingTotalItems = orderResult.totalItems;
        q.scores[userId] = (q.scores[userId] || 0) + orderResult.score;
      } else {
        entry.isCorrect = false;
        entry.orderingScore = 0;
        entry.orderingCorrectCount = 0;
        entry.orderingTotalItems = question.choices?.length || 0;
      }
    } else if (question.type === "classification") {
      // 분류퀴즈: 부분 점수
      if (entry.submitted && entry.answer !== null) {
        const clResult = getClassificationScore(question, entry.answer);
        entry.isCorrect = clResult.correctCount === clResult.totalItems;
        entry.classifyScore = clResult.score;
        entry.classifyCorrectCount = clResult.correctCount;
        entry.classifyTotalItems = clResult.totalItems;
        q.scores[userId] = (q.scores[userId] || 0) + clResult.score;
      } else {
        entry.isCorrect = false;
        entry.classifyScore = 0;
        entry.classifyCorrectCount = 0;
        entry.classifyTotalItems = question.choices?.length || 0;
      }
    } else {
      // 일반 모드: reveal 시점에 정답 판정 + 점수 부여
      if (entry.submitted && entry.answer !== null) {
        entry.isCorrect = checkAnswer(question, entry.answer);
      } else {
        entry.isCorrect = false;
      }
      if (entry.isCorrect) {
        q.scores[userId] = (q.scores[userId] || 0) + 1;
      }
    }

    const resultEntry = {
      userId,
      name: p.name,
      answer: entry.answer,
      isCorrect: entry.isCorrect,
      submitted: entry.submitted,
    };
    if (question.type === "ordering") {
      resultEntry.orderingScore = entry.orderingScore || 0;
      resultEntry.orderingCorrectCount = entry.orderingCorrectCount || 0;
      resultEntry.orderingTotalItems = entry.orderingTotalItems || 0;
    }
    if (question.type === "classification") {
      resultEntry.classifyScore = entry.classifyScore || 0;
      resultEntry.classifyCorrectCount = entry.classifyCorrectCount || 0;
      resultEntry.classifyTotalItems = entry.classifyTotalItems || 0;
    }
    results.push(resultEntry);
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

  const correctAnswer = question.type === "ordering"
    ? _normalizeChoices(question.choices).map(c => typeof c === "string" ? c : (c?.text || "")).join(" → ")
    : question.type === "classification"
      ? _normalizeChoices(question.choices).map(c => typeof c === "string" ? c : `${c?.text || ""}→${c?.category || ""}`).join(", ")
      : question.type === "mcq"
        ? question.choices[question.answer[0]]
        : question.answer[0];

  const scores = buildQuizScores(room);

  // 정답 공개용 미디어: reveal > question fallback
  // 표시 가능한 미디어 타입만 허용 (youtube/none 등 제외)
  const _displayable = new Set(["image", "gif", "mp4", "webp", "video"]);
  let revealMedia = null;
  const qIdx = q.questionIndex;

  if (question.type === "audio_youtube") {
    console.log(`[REVEAL-MEDIA] multi q${qIdx}: skip because youtube type`);
  } else if (question.revealMediaUrl) {
    // 1순위: reveal_media_url 사용
    const rType = question.revealMediaType || "image";
    if (_displayable.has(rType)) {
      revealMedia = { media_type: rType, media_url: question.revealMediaUrl };
      console.log(`[REVEAL-MEDIA] multi q${qIdx}: resolved from reveal_media_url`);
    } else {
      console.log(`[REVEAL-MEDIA] multi q${qIdx}: skip because unsupported reveal media_type=${rType}`);
    }
  } else if (question.mediaUrl && question.mediaType) {
    // 2순위: question media fallback (displayable만)
    if (_displayable.has(question.mediaType)) {
      revealMedia = { media_type: question.mediaType, media_url: question.mediaUrl };
      console.log(`[REVEAL-MEDIA] multi q${qIdx}: resolved from question media fallback`);
    } else {
      console.log(`[REVEAL-MEDIA] multi q${qIdx}: fallback rejected because invalid media_type=${question.mediaType}`);
    }
  }

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
    revealMedia,
    // 스피드 모드 전용
    speedSolver: q.speedSolver || null,
    quizMode: room.quizMode || "normal",
    // 순서 퀴즈 전용: 정답 순서 (choices 배열)
    orderingChoices: question.type === "ordering" ? question.choices : undefined,
    // 분류퀴즈 전용: choices + categories
    classifyChoices: question.type === "classification" ? question.choices : undefined,
    classifyCategories: question.type === "classification" ? question.answer : undefined,
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
    if (token) {
      const user = await verify(token);
      if (!user) return next(new Error("UNAUTHORIZED"));
      socket.user = user;
    } else {
      // 게스트 모드: 토큰 없으면 guestId 기반으로 연결 허용
      const guestId = socket.handshake.auth?.guestId;
      if (!guestId || typeof guestId !== "string" || !guestId.startsWith("guest_")) {
        return next(new Error("UNAUTHORIZED"));
      }
      socket.user = { id: guestId, isGuest: true, isAdmin: false };
    }
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
    // 게스트는 방 생성 불가
    if (me.isGuest) {
      return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
    }

    const room = {
      id: roomId,
      inviteCode,
      hostUserId: me.id,
      mode: payload?.mode === "quiz" ? "quiz" : "worldcup",
      contentId: payload?.contentId || null,
      players: new Map(),
      committed: new Set(),
      disconnected: new Map(),
      banned: new Set(), // 강퇴된 유저 ID 목록
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
      // ✅ 퀴즈 스피드 모드
      quizMode: payload?.quizMode === "speed" ? "speed" : "normal",
    };
    rooms.set(roomId, room);
    inviteCodeMap.set(inviteCode, roomId);

    const hostNick = pickNick(socket, payload);
    room.players.set(me.id, { name: hostNick, isGuest: false, joinedAt: Date.now() });
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

    // 강퇴된 유저 재입장 차단
    if (room.banned && room.banned.has(me.id)) {
      return cb?.({ ok: false, error: "BANNED_FROM_ROOM" });
    }

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
      room.players.set(me.id, { name: pickNick(socket, payload), isGuest: !!me.isGuest, joinedAt: Date.now() });
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
        room.quiz.skipVotes.delete(me.id);
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
  // 호스트 강퇴 기능
  // =========================
  safeOn(socket, "room:kick", (payload, cb) => {
    const roomId = payload?.roomId;
    const targetUserId = payload?.targetUserId;
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "ONLY_HOST" });
    if (targetUserId === me.id) return cb?.({ ok: false, error: "CANNOT_KICK_SELF" });
    if (!room.players.has(targetUserId)) return cb?.({ ok: false, error: "PLAYER_NOT_FOUND" });

    // banned Set에 추가 (재입장 차단)
    if (!room.banned) room.banned = new Set();
    room.banned.add(targetUserId);

    // 플레이어 제거
    room.players.delete(targetUserId);
    room.committed.delete(targetUserId);
    if (room.quiz) {
      room.quiz.answers.delete(targetUserId);
      room.quiz.readyPlayers.delete(targetUserId);
      room.quiz.skipVotes.delete(targetUserId);
    }
    const disc = room.disconnected?.get(targetUserId);
    if (disc) { clearTimeout(disc.timeoutId); room.disconnected.delete(targetUserId); }
    userRoomMap.delete(targetUserId);

    // 강퇴 대상에게 알림
    io.to(roomId).emit("room:kicked", { targetUserId });

    // 방 상태 업데이트
    io.to(roomId).emit("room:state", publicRoom(room));

    console.log(`[강퇴] roomId=${roomId} host=${me.id} kicked=${targetUserId}`);
    cb?.({ ok: true });

    // 전원 제출/committed 체크 (강퇴 후 자동 진행)
    if (room.mode !== "quiz" && room.phase === "playing" && room.players.size > 0
        && room.committed.size === room.players.size) {
      doReveal(room);
    }
    if (room.mode === "quiz" && room.quiz?.phase === "answering" && room.players.size > 0) {
      const allSubmitted = Array.from(room.players.keys()).every(uid => room.quiz.answers.has(uid));
      if (allSubmitted) {
        doQuizReveal(room);
      } else if (room.quiz.skipVotes.size >= room.players.size && !room.quiz.speedSolver) {
        // 강퇴로 인해 남은 전원이 건너뛰기 상태 → 정답 공개
        for (const [uid] of room.players.entries()) {
          if (!room.quiz.answers.has(uid)) {
            room.quiz.answers.set(uid, { submitted: true, answer: null, isCorrect: false });
          }
        }
        doQuizReveal(room);
      }
    }

    // 퀴즈: show 단계 유튜브 — 전원 ready면 진행 (강퇴 후 자동 진행)
    if (room.mode === "quiz" && room.quiz?.phase === "show" && room.players.size > 0) {
      if (room.quiz.readyPlayers.size >= room.players.size) {
        startQuizAnswering(room);
      }
    }

    maybeCleanupRoom(roomId, "EMPTY");
  });

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

        // ✅ Fisher-Yates 셔플: 항상 문제 순서를 랜덤화
        let quizQuestions = loaded.questions.slice();
        for (let i = quizQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [quizQuestions[i], quizQuestions[j]] = [quizQuestions[j], quizQuestions[i]];
        }
        // 문제 수 제한: questionCount > 0이면 앞에서 N개만 선택
        if (room.questionCount > 0 && room.questionCount < quizQuestions.length) {
          console.log(`[game:start] quiz question limit: ${room.questionCount}/${quizQuestions.length}`);
          quizQuestions = quizQuestions.slice(0, room.questionCount);
        }
        console.log(`[game:start] quiz shuffled order: [${quizQuestions.slice(0, 5).map(q => q.id?.slice(0, 6)).join(",")}${quizQuestions.length > 5 ? ",…" : ""}]`);
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

      // ✅ Fisher-Yates 셔플: 항상 문제 순서를 랜덤화
      let quizQs = loaded.questions.slice();
      for (let i = quizQs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizQs[i], quizQs[j]] = [quizQs[j], quizQs[i]];
      }
      // 문제 수 제한: questionCount > 0이면 앞에서 N개만 선택
      if (room.questionCount > 0 && room.questionCount < quizQs.length) {
        console.log(`[quiz:start] question limit: ${room.questionCount}/${quizQs.length}`);
        quizQs = quizQs.slice(0, room.questionCount);
      }
      console.log(`[quiz:start] quiz shuffled order: [${quizQs.slice(0, 5).map(q => q.id?.slice(0, 6)).join(",")}${quizQs.length > 5 ? ",…" : ""}]`);
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

    // ── 스피드 모드 분기 ──
    if (room.quizMode === "speed") {
      const q = room.quiz;
      const question = q.questions[q.questionIndex];

      // 이미 누가 풀었으면 거부
      if (q.speedSolver) return cb?.({ ok: false, error: "ALREADY_SOLVED" });

      // 이미 정답 맞힌 본인이면 거부 (안전장치)
      if (q.answers.has(me.id)) return cb?.({ ok: false, error: "ALREADY_SUBMITTED" });

      // 쿨다운 체크 (오답 후 2초)
      const attempt = q.speedAttempts.get(me.id);
      const COOLDOWN_MS = 2000;
      if (attempt?.lastWrongAt) {
        const elapsed = Date.now() - attempt.lastWrongAt;
        if (elapsed < COOLDOWN_MS) {
          return cb?.({ ok: false, error: "COOLDOWN", remainMs: COOLDOWN_MS - elapsed });
        }
      }

      const userAnswer = payload?.answer ?? null;
      const isCorrect = checkAnswer(question, userAnswer);

      if (isCorrect) {
        // ✅ 선착 정답자!
        q.speedSolver = { userId: me.id, name: p.name };
        q.skipVotes.clear(); // 건너뛰기 무효화
        q.answers.set(me.id, { submitted: true, answer: userAnswer, isCorrect: true });
        q.scores[me.id] = (q.scores[me.id] || 0) + 1;

        // 전원에게 선착 정답자 알림
        io.to(room.id).emit("quiz:speed-solved", {
          solverId: me.id,
          solverName: p.name,
        });

        cb?.({ ok: true, correct: true });

        // 1.5초 후 reveal (정답자 표시 시간)
        if (room.quizTimer) { clearTimeout(room.quizTimer); room.quizTimer = null; }
        room.quizTimer = setTimeout(() => {
          room.quizTimer = null;
          // 미정답자 → 오답 처리
          for (const [userId] of room.players.entries()) {
            if (!q.answers.has(userId)) {
              q.answers.set(userId, { submitted: true, answer: null, isCorrect: false });
            }
          }
          doQuizReveal(room);
        }, 1500);
      } else {
        // ❌ 오답 → 쿨다운 설정, 재시도 허용
        q.speedAttempts.set(me.id, {
          lastWrongAt: Date.now(),
          wrongCount: (attempt?.wrongCount || 0) + 1,
        });
        cb?.({ ok: true, correct: false, cooldownMs: COOLDOWN_MS });
      }
      return;
    }

    // ── 일반 모드 (기존 로직) ──
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

  // ── quiz:skip (전원 건너뛰기 → 정답 공개) ──
  safeOn(socket, "quiz:skip", (payload, cb) => {
    const room = rooms.get(payload?.roomId);
    if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (!room.quiz) return cb?.({ ok: false, error: "NOT_QUIZ" });
    if (room.quiz.phase !== "answering") return cb?.({ ok: false, error: "NOT_ANSWERING" });
    // 이미 정답 나온 상태면 무시
    if (room.quiz.speedSolver) return cb?.({ ok: false, error: "ALREADY_SOLVED" });

    const q = room.quiz;
    q.skipVotes.add(me.id);
    console.log(`[quiz:skip] room=${room.id} user=${me.id} skipVotes=${q.skipVotes.size}/${room.players.size}`);

    // 현재 active player 수 계산 (이미 제출한 사람 포함한 전체 플레이어)
    const totalActive = room.players.size;
    const skipCount = q.skipVotes.size;

    // 전원에게 skip 현황 브로드캐스트
    io.to(room.id).emit("quiz:skip-status", {
      skipCount,
      totalActive,
      allSkipped: skipCount >= totalActive,
    });

    cb?.({ ok: true, skipCount, totalActive });

    // 전원 건너뛰기 → 미제출자를 오답 처리 후 정답 공개
    if (skipCount >= totalActive) {
      for (const [userId] of room.players.entries()) {
        if (!q.answers.has(userId)) {
          q.answers.set(userId, { submitted: true, answer: null, isCorrect: false });
        }
      }
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
        room.quiz.skipVotes.delete(me.id);
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
        if (allSubmitted) {
          doQuizReveal(room);
        } else if (room.quiz.skipVotes.size >= room.players.size && !room.quiz.speedSolver) {
          // 이탈로 남은 전원이 건너뛰기 상태 → 정답 공개
          for (const [uid] of room.players.entries()) {
            if (!room.quiz.answers.has(uid)) {
              room.quiz.answers.set(uid, { submitted: true, answer: null, isCorrect: false });
            }
          }
          doQuizReveal(room);
        }
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

// =============================================
// 자동 대표 썸네일 (Auto Thumbnail Fallback)
// - 수동 thumbnail_url이 없는 월드컵 콘텐츠에 대해
//   우승수 기준 1위 후보의 media_url + media_type을 저장
// - 프론트엔드 getThumbUrl(media_url, media_type)이 렌더 담당
//   (기존 후보 썸네일 로직 그대로 재사용)
// - 하루 1회만 갱신
// =============================================
const AUTO_THUMB_INTERVAL = 24 * 60 * 60 * 1000; // 24시간

/**
 * 모든 대상 월드컵 콘텐츠의 auto_thumbnail_url(=후보 media_url)을 갱신
 * 우승수(champion_count) 기준 1위 후보의 원본 media_url + media_type 저장
 */
async function refreshAutoThumbnails() {
  console.log("[AUTO_THUMB] Starting auto-thumbnail refresh...");

  try {
    // 수동 썸네일이 없는 월드컵 콘텐츠 조회
    const { data: targets, error } = await supabaseAdmin
      .from("contents")
      .select("id, auto_thumb_updated_at")
      .eq("mode", "worldcup")
      .or("thumbnail_url.is.null,thumbnail_url.eq.");

    if (error) {
      console.error("[AUTO_THUMB] Query error:", error.message);
      return;
    }
    if (!targets || !targets.length) {
      console.log("[AUTO_THUMB] No targets (all have manual thumbnails).");
      return;
    }

    // 24시간 미경과 → 건너뛰기
    const cutoff = Date.now() - AUTO_THUMB_INTERVAL;
    const needRefresh = targets.filter(t =>
      !t.auto_thumb_updated_at ||
      new Date(t.auto_thumb_updated_at).getTime() < cutoff
    );

    if (!needRefresh.length) {
      console.log(`[AUTO_THUMB] ${targets.length} target(s) all up-to-date, skipping.`);
      return;
    }

    console.log(`[AUTO_THUMB] Refreshing ${needRefresh.length} content(s)...`);

    for (const t of needRefresh) {
      try {
        // 우승수(champion_count) 기준 상위 3명 후보 조회
        const { data: candidates } = await supabaseAdmin
          .from("worldcup_candidate_stats_v")
          .select("candidate_id, name, media_type, media_url, champion_count, win_rate, games")
          .eq("content_id", t.id)
          .order("champion_count", { ascending: false })
          .order("win_rate", { ascending: false })
          .order("games", { ascending: false })
          .limit(3);

        // media_url이 있는 첫 번째 후보 선택
        let chosen = null;
        for (const cand of candidates || []) {
          if (cand.media_url && String(cand.media_url).trim()) {
            chosen = cand;
            break;
          }
        }

        // DB 업데이트: 가능하면 실제 썸네일 이미지 URL로 해석하여 저장
        // CHZZK/SOOP 등 외부 영상은 런타임 프록시 의존 제거 → CDN 직접 URL 저장
        let thumbUrl = chosen ? String(chosen.media_url).trim() : null;
        let thumbType = chosen ? chosen.media_type : null;

        if (chosen && thumbUrl) {
          // YouTube → ytimg 직접 URL
          const ytMatch = thumbUrl.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/)
                       || (/^[A-Za-z0-9_-]{11}$/.test(thumbUrl) ? [null, thumbUrl] : null);
          if (ytMatch && ytMatch[1]) {
            thumbUrl = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            thumbType = "image";
          }
          // CHZZK 클립 → 봇 UA로 실제 썸네일 해석
          else if (/chzzk\.naver\.com/i.test(thumbUrl)) {
            const clipId = _extractChzzkClipId(thumbUrl);
            if (clipId) {
              try {
                const resolved = await _fetchChzzkThumb(clipId);
                if (resolved) {
                  console.log(`[AUTO_THUMB] CHZZK resolved: ${resolved.slice(0, 80)}`);
                  thumbUrl = resolved;
                  thumbType = "image";
                }
              } catch (e) { console.log(`[AUTO_THUMB] CHZZK resolve failed:`, e.message); }
            }
          }
          // 네이버 비디오 → og:image 해석 (서버 렌더 HTML, 봇 UA 불필요)
          else if (/serviceapi\.nmv\.naver\.com|nmv\.naver\.com/i.test(thumbUrl)) {
            try {
              const resp = await fetch(thumbUrl, { headers: _BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) });
              if (resp.ok) {
                const ogImg = _extractOgImage(await resp.text());
                if (ogImg) {
                  console.log(`[AUTO_THUMB] Naver video resolved: ${ogImg.slice(0, 80)}`);
                  thumbUrl = ogImg;
                  thumbType = "image";
                }
              }
            } catch (e) { console.log(`[AUTO_THUMB] Naver video resolve failed:`, e.message); }
          }
          // SOOP VOD → og:image 해석
          else if (/vod\.sooplive\.co\.kr/i.test(thumbUrl)) {
            try {
              const resp = await fetch(thumbUrl, { headers: _BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) });
              if (resp.ok) {
                const ogImg = _extractOgImage(await resp.text());
                if (ogImg) {
                  console.log(`[AUTO_THUMB] SOOP resolved: ${ogImg.slice(0, 80)}`);
                  thumbUrl = ogImg;
                  thumbType = "image";
                }
              }
            } catch (e) { console.log(`[AUTO_THUMB] SOOP resolve failed:`, e.message); }
          }
        }

        const updateData = {
          auto_thumbnail_url: thumbUrl,
          auto_thumb_media_type: thumbType,
          auto_thumb_updated_at: new Date().toISOString(),
        };

        await supabaseAdmin
          .from("contents")
          .update(updateData)
          .eq("id", t.id);

        if (chosen) {
          console.log(`[AUTO_THUMB] ${t.id} → "${chosen.name}" (${chosen.media_type}, champ=${chosen.champion_count}): ${String(chosen.media_url).slice(0, 80)}`);
        } else {
          console.log(`[AUTO_THUMB] ${t.id} → no candidate with media_url`);
        }

      } catch (e) {
        console.error(`[AUTO_THUMB] Failed for ${t.id}:`, e.message);
      }
    }

    console.log("[AUTO_THUMB] Refresh complete.");
  } catch (e) {
    console.error("[AUTO_THUMB] Unexpected error:", e.message);
  }
}

// 서버 시작 30초 후 1회 실행 + 24시간 주기 반복
setTimeout(() => {
  refreshAutoThumbnails();
  setInterval(refreshAutoThumbnails, AUTO_THUMB_INTERVAL);
}, 30_000);

// ===================================================
// 치지직 OAuth 토큰 교환
// ===================================================
const CHZZK_CLIENT_ID     = process.env.CHZZK_CLIENT_ID;
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET;
const CHZZK_REDIRECT_URI  = process.env.CHZZK_REDIRECT_URI;

// 연동된 세션 보관 (roomCode → { accessToken, refreshToken, expiresAt, channelId, nickname })
const chzzkSessions = new Map();

app.post("/chzzk/token", async (req, res) => {
  try {
    const { code, state, roomCode } = req.body;
    if (!code || !state) {
      return res.status(400).json({ ok: false, error: "MISSING_PARAMS", message: "code와 state가 필요합니다" });
    }
    if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) {
      console.error("[CHZZK] 환경변수 CHZZK_CLIENT_ID / CHZZK_CLIENT_SECRET 미설정");
      return res.status(500).json({ ok: false, error: "SERVER_CONFIG", message: "치지직 설정이 완료되지 않았습니다" });
    }

    // 1) code → accessToken 교환
    const tokenBody = {
      grantType: "authorization_code",
      clientId: CHZZK_CLIENT_ID,
      clientSecret: CHZZK_CLIENT_SECRET,
      code,
      state,
    };

    // 치지직 토큰 엔드포인트 — 공식: openapi.chzzk.naver.com
    const TOKEN_URL = "https://openapi.chzzk.naver.com/auth/v1/token";

    let tokenData = null;
    let tokenError = null;

    // ★ 단일 URL (공식), Client-Id/Client-Secret 헤더 필수
    try {
      console.log(`[CHZZK] 토큰 교환 시도: ${TOKEN_URL}`);
      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Id": CHZZK_CLIENT_ID,
          "Client-Secret": CHZZK_CLIENT_SECRET,
        },
        body: JSON.stringify(tokenBody),
      });
      const raw = await tokenRes.text();
      console.log(`[CHZZK] 토큰 응답: status=${tokenRes.status} body=${raw.slice(0, 300)}`);

      if (tokenRes.ok) {
        const parsed = JSON.parse(raw);
        // 치지직 API 응답: { code: 200, content: { accessToken, refreshToken, ... } }
        if (parsed.content?.accessToken) {
          tokenData = parsed.content;
        } else if (parsed.accessToken || parsed.access_token) {
          tokenData = parsed.accessToken
            ? parsed
            : { accessToken: parsed.access_token, refreshToken: parsed.refresh_token, expiresIn: parsed.expires_in };
        } else {
          tokenError = `응답에 accessToken 없음: ${raw.slice(0, 200)}`;
        }
      } else {
        tokenError = `${TOKEN_URL} → ${tokenRes.status}: ${raw.slice(0, 200)}`;
      }
    } catch (e) {
      tokenError = `${TOKEN_URL} → fetch 실패: ${e.message}`;
      console.warn("[CHZZK]", tokenError);
    }

    if (!tokenData) {
      console.error("[CHZZK] 토큰 교환 실패:", tokenError);
      return res.status(502).json({ ok: false, error: "TOKEN_EXCHANGE_FAILED", message: tokenError });
    }

    const { accessToken, refreshToken, expiresIn } = tokenData;
    console.log(`[CHZZK] 토큰 교환 성공: expiresIn=${expiresIn}`);

    // 2) accessToken으로 내 채널 정보 조회
    let channelId = null;
    let nickname = null;

    // User API 또는 Channel API로 본인 정보 조회 시도
    const meUrls = [
      "https://openapi.chzzk.naver.com/open/v1/users/me",
      "https://openapi.chzzk.naver.com/open/v1/channels/me",
    ];

    for (const meUrl of meUrls) {
      try {
        console.log(`[CHZZK] 사용자 정보 조회: ${meUrl}`);
        const meRes = await fetch(meUrl, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Client-Id": CHZZK_CLIENT_ID,
          },
        });
        const meRaw = await meRes.text();
        console.log(`[CHZZK] 사용자 응답 (${meUrl}): status=${meRes.status} body=${meRaw.slice(0, 300)}`);

        if (meRes.ok) {
          const meParsed = JSON.parse(meRaw);
          const content = meParsed.content || meParsed;
          channelId = content.channelId || content.channel_id || content.id || null;
          nickname = content.channelName || content.nickname || content.name || null;
          if (channelId) break;
        }
      } catch (e) {
        console.warn(`[CHZZK] ${meUrl} 실패:`, e.message);
      }
    }

    console.log(`[CHZZK] 사용자: channelId=${channelId}, nickname=${nickname}`);

    // 3) 서버 메모리에 세션 보관
    if (roomCode) {
      chzzkSessions.set(roomCode, {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (Number(expiresIn) || 86400) * 1000,
        channelId,
        nickname,
      });
      console.log(`[CHZZK] 세션 저장: roomCode=${roomCode}`);
    }

    return res.json({
      ok: true,
      channelId: channelId || null,
      nickname: nickname || null,
    });

  } catch (err) {
    console.error("[CHZZK] /chzzk/token 예외:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err.message });
  }
});

// 세션 조회 (디버그/상태확인용)
app.get("/chzzk/status", (req, res) => {
  const roomCode = req.query.room;
  if (!roomCode) return res.status(400).json({ ok: false, error: "MISSING_ROOM" });
  const sess = chzzkSessions.get(roomCode);
  if (!sess) return res.json({ ok: true, linked: false });
  return res.json({
    ok: true,
    linked: true,
    channelId: sess.channelId,
    nickname: sess.nickname,
    expiresAt: new Date(sess.expiresAt).toISOString(),
  });
});

// ===================================================
// 채팅 연동형 시청자모드 — ChatBridge + API
// ===================================================
const CHZZK_API_BASE = "https://openapi.chzzk.naver.com";

/**
 * ChatBridge — roomCode별 치지직 채팅 연결 + !1/!2 집계
 * 서버 메모리에서만 관리 (DB 불필요 — 라운드 단위 휘발성 데이터)
 */
class ChatBridge {
  constructor(roomCode, accessToken, channelId) {
    this.roomCode = roomCode;
    this.accessToken = accessToken;
    this.channelId = channelId;
    this.socket = null;
    this.sessionKey = null;
    this.currentRoundKey = null;
    this.roundEndsAt = null;         // Date | null
    this.votes = new Map();          // senderChannelId → { choice: 1|2, nickname, timestamp }
    this.status = "idle";            // idle | connecting | connected | error | stopped
    this.errorCode = null;           // 구체적 에러 코드
    this.errorMsg = null;
    this.totalMessagesProcessed = 0;
    this._rawDumpCount = 0;          // 처음 N개 이벤트 raw dump용
    this._voteLogCount = 0;          // 투표 로그 카운트
    this.connectedAt = null;         // 연결 시각
    this.lastEventAt = null;         // 마지막 이벤트 수신 시각
    this._allEventNames = new Set(); // 수신된 모든 이벤트 타입
  }

  /** 1) Session API로 WebSocket URL 획득 → 연결 → CHAT 구독 */
  async connect() {
    this.status = "connecting";
    this.errorMsg = null;

    try {
      // (A) Session Auth — WebSocket URL 획득
      const sessionApiUrl = `${CHZZK_API_BASE}/open/v1/sessions/auth`;
      const sessionHeaders = {
        "Authorization": `Bearer ${this.accessToken}`,
        "Client-Id": CHZZK_CLIENT_ID,
      };
      console.log(`[CHAT_BRIDGE:${this.roomCode}] Session Auth 요청: ${sessionApiUrl}`);
      console.log(`[CHAT_BRIDGE:${this.roomCode}]   헤더: Authorization=Bearer ${this.accessToken.slice(0, 16)}..., Client-Id=${CHZZK_CLIENT_ID}`);

      const sessionRes = await fetch(sessionApiUrl, { headers: sessionHeaders });
      const sessionRaw = await sessionRes.text();
      console.log(`[CHAT_BRIDGE:${this.roomCode}] Session Auth 응답:`);
      console.log(`[CHAT_BRIDGE:${this.roomCode}]   status: ${sessionRes.status}`);
      console.log(`[CHAT_BRIDGE:${this.roomCode}]   headers: content-type=${sessionRes.headers.get("content-type")}`);
      console.log(`[CHAT_BRIDGE:${this.roomCode}]   body(raw): ${sessionRaw.slice(0, 500)}`);

      if (!sessionRes.ok) {
        const errDetail = sessionRaw.slice(0, 300);
        if (sessionRes.status === 401) {
          this.errorCode = "TOKEN_INVALID";
          throw new Error(`Session Auth 401 — 토큰 만료 또는 무효: ${errDetail}`);
        }
        if (sessionRes.status === 403) {
          this.errorCode = "SCOPE_INSUFFICIENT";
          throw new Error(`Session Auth 403 — scope 부족 (세션 권한 필요): ${errDetail}`);
        }
        this.errorCode = "SESSION_AUTH_FAILED";
        throw new Error(`Session Auth 실패: ${sessionRes.status} ${errDetail}`);
      }

      const sessionParsed = JSON.parse(sessionRaw);
      console.log(`[CHAT_BRIDGE:${this.roomCode}] Session Auth parsed 키:`, Object.keys(sessionParsed));
      if (sessionParsed.content) {
        console.log(`[CHAT_BRIDGE:${this.roomCode}]   content 키:`, Object.keys(sessionParsed.content));
      }

      // socketUrl 탐색 — 여러 가능한 경로 시도
      const c = sessionParsed.content || {};
      const socketUrl = c.socketUrl || c.socket_url || c.url || c.wsUrl || c.ws_url
                      || sessionParsed.socketUrl || sessionParsed.socket_url || sessionParsed.url || null;

      if (!socketUrl) {
        console.error(`[CHAT_BRIDGE:${this.roomCode}] ❌ socketUrl을 찾을 수 없음!`);
        console.error(`[CHAT_BRIDGE:${this.roomCode}]   전체 응답: ${sessionRaw.slice(0, 800)}`);
        this.errorCode = "CHAT_CONNECT_FAILED";
        throw new Error(`socketUrl이 응답에 없음 — parsed keys: [${Object.keys(sessionParsed)}], content keys: [${Object.keys(c)}]`);
      }
      console.log(`[CHAT_BRIDGE:${this.roomCode}] ✅ socketUrl 발견: ${socketUrl.slice(0, 80)}...`);

      // (B) Socket.IO v1~2 프로토콜로 연결
      console.log(`[CHAT_BRIDGE:${this.roomCode}] WebSocket 연결: ${socketUrl.slice(0, 60)}...`);
      this.socket = ioClient(socketUrl, {
        reconnection: false,
        timeout: 5000,
        transports: ["websocket"],
      });

      // 연결 완료 대기 (최대 10초)
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebSocket 연결 타임아웃")), 10000);

        this.socket.on("connect", () => {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] WebSocket 연결됨`);
          clearTimeout(timer);
          resolve();
        });

        this.socket.on("connect_error", (err) => {
          console.error(`[CHAT_BRIDGE:${this.roomCode}] connect_error:`, err.message, err.description || "");
          this.errorCode = "WS_CONNECT_FAILED";
          clearTimeout(timer);
          reject(new Error(`WebSocket 연결 실패: ${err.message}`));
        });

        this.socket.on("error", (err) => {
          console.error(`[CHAT_BRIDGE:${this.roomCode}] socket error:`, err);
        });

        // 시스템 메시지에서 sessionKey 추출
        this.socket.on("connected", (data) => {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] ★ "connected" 시스템 메시지 (full):`, JSON.stringify(data).slice(0, 500));
          this.sessionKey = data?.sessionKey || data?.content?.sessionKey || null;
          console.log(`[CHAT_BRIDGE:${this.roomCode}]   → sessionKey=${this.sessionKey ? this.sessionKey.slice(0, 16) + "..." : "null"}`);
        });

        // CHAT 이벤트 수신
        this.socket.on("CHAT", (data) => this._onChatEvent(data));

        // DONATION / SUBSCRIPTION 등 다른 이벤트도 로깅
        this.socket.on("DONATION", (data) => {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] DONATION 이벤트 수신 (무시):`, JSON.stringify(data).slice(0, 200));
        });
        this.socket.on("SUBSCRIPTION", (data) => {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] SUBSCRIPTION 이벤트 수신 (무시):`, JSON.stringify(data).slice(0, 200));
        });

        // 알 수 없는 이벤트 catch-all
        const origOnEvent = this.socket.onevent?.bind(this.socket);
        if (origOnEvent) {
          this.socket.onevent = (packet) => {
            const eventName = packet.data?.[0];
            if (eventName && !this._allEventNames.has(eventName)) {
              this._allEventNames.add(eventName);
              console.log(`[CHAT_BRIDGE:${this.roomCode}] ★ 새 이벤트 타입 발견: "${eventName}"`, JSON.stringify(packet.data?.slice(1)).slice(0, 300));
            }
            origOnEvent(packet);
          };
        }

        this.socket.on("disconnect", (reason) => {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] WebSocket 끊김: ${reason}`);
          if (this.status === "connected") {
            this.status = "error";
            this.errorCode = "WS_DISCONNECTED";
            this.errorMsg = `연결 끊김: ${reason}`;
          }
        });
      });

      // (C) sessionKey 대기 (이미 받았을 수 있음, 최대 5초 추가 대기)
      if (!this.sessionKey) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 5000);
          const check = setInterval(() => {
            if (this.sessionKey) { clearInterval(check); clearTimeout(timer); resolve(); }
          }, 200);
        });
      }

      if (!this.sessionKey) {
        console.warn(`[CHAT_BRIDGE:${this.roomCode}] sessionKey를 받지 못함 — 구독 없이 진행`);
      }

      // (D) CHAT 이벤트 구독
      if (this.sessionKey && this.channelId) {
        console.log(`[CHAT_BRIDGE:${this.roomCode}] CHAT 구독 요청: channelId=${this.channelId}`);
        const subRes = await fetch(`${CHZZK_API_BASE}/open/v1/sessions/events/subscribe/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.accessToken}`,
            "Client-Id": CHZZK_CLIENT_ID,
          },
          body: JSON.stringify({
            sessionKey: this.sessionKey,
            channelId: this.channelId,
          }),
        });
        const subRaw = await subRes.text();
        console.log(`[CHAT_BRIDGE:${this.roomCode}] CHAT 구독 응답: ${subRes.status} ${subRaw.slice(0, 200)}`);

        if (!subRes.ok) {
          const subError = subRaw.slice(0, 300);
          if (subRes.status === 403) {
            this.errorCode = "CHAT_SUBSCRIBE_SCOPE";
            console.error(`[CHAT_BRIDGE:${this.roomCode}] ❌ CHAT 구독 403 — scope 부족: ${subError}`);
            console.error(`[CHAT_BRIDGE:${this.roomCode}]   → 치지직 앱 설정에서 "채팅" scope이 활성화되어 있는지 확인하세요`);
          } else {
            this.errorCode = "CHAT_SUBSCRIBE_FAILED";
            console.error(`[CHAT_BRIDGE:${this.roomCode}] ❌ CHAT 구독 실패 (${subRes.status}): ${subError}`);
          }
          // 구독 실패해도 연결은 유지 — 이벤트가 올 수도 있음
        } else {
          console.log(`[CHAT_BRIDGE:${this.roomCode}] ✅ CHAT 구독 성공`);
        }
      }

      this.status = "connected";
      this.connectedAt = new Date();
      console.log(`[CHAT_BRIDGE:${this.roomCode}] 채팅 연결 완료 ✅ sessionKey=${this.sessionKey ? "있음" : "없음"}, channelId=${this.channelId}`);

    } catch (err) {
      this.status = "error";
      this.errorMsg = err.message;
      console.error(`[CHAT_BRIDGE:${this.roomCode}] 연결 실패:`, err.message);
      this.disconnect();
      throw err;
    }
  }

  /** CHAT 이벤트 콜백 — !1 / !2 필터링 + 집계 */
  _onChatEvent(data) {
    this.lastEventAt = new Date();
    try {
      // ★ 처음 5개 이벤트는 raw payload 전체 덤프 (구조 검증용)
      if (this._rawDumpCount < 5) {
        this._rawDumpCount++;
        console.log(`[CHAT_BRIDGE:${this.roomCode}] ★ RAW CHAT #${this._rawDumpCount}:`,
          JSON.stringify(data).slice(0, 800));
        console.log(`[CHAT_BRIDGE:${this.roomCode}]   type=${typeof data}, isArray=${Array.isArray(data)}, keys=${data && typeof data === "object" ? Object.keys(data).join(",") : "N/A"}`);
      }

      // 치지직 CHAT 이벤트 구조 — 공식 문서 기준:
      //   { channelId, senderChannelId, profile: { nickname, badges, verifiedMark }, content, messageTime, userRoleCode, emojis }
      // 실제 응답이 다를 수 있으므로 여러 경로 탐색
      const events = Array.isArray(data) ? data : [data];

      for (const evt of events) {
        // content 필드가 문자열(메시지)일 수도, 객체(래핑)일 수도 있음
        const msg = (typeof evt.content === "object" && evt.content !== null) ? evt.content : evt;

        const senderChannelId = msg.senderChannelId || evt.senderChannelId || null;
        const nickname = msg.profile?.nickname || evt.profile?.nickname || "익명";
        const messageTime = msg.messageTime || evt.messageTime || Date.now();

        // content 추출: 문자열 직접 or msg.content 문자열
        let content = null;
        if (typeof evt.content === "string") content = evt.content;
        else if (typeof msg.content === "string") content = msg.content;
        else if (typeof msg.message === "string") content = msg.message;  // 대체 필드명
        else if (typeof msg.text === "string") content = msg.text;        // 대체 필드명

        if (!content || !senderChannelId) {
          // 파싱 실패 로그 (처음 3개만)
          if (this._rawDumpCount <= 5) {
            console.warn(`[CHAT_BRIDGE:${this.roomCode}] ⚠ 파싱 실패: content=${content}, sender=${senderChannelId}, keys=[${Object.keys(evt).join(",")}]`);
          }
          continue;
        }

        this.totalMessagesProcessed++;

        // !1 또는 !2만 (정확히)
        const match = content.trim().match(/^!([12])$/);
        if (!match) continue;

        // 라운드 진행 중이 아니면 무시
        if (!this.currentRoundKey) {
          if (this._voteLogCount < 3) console.log(`[CHAT_BRIDGE:${this.roomCode}] !${match[1]} 수신 but 라운드 없음 (무시)`);
          continue;
        }

        // 타이머 만료 확인
        if (this.roundEndsAt && Date.now() > this.roundEndsAt.getTime()) continue;

        const choice = parseInt(match[1]);

        // 마지막 입력 기준: Map.set으로 덮어쓰기
        const prevVote = this.votes.get(senderChannelId);
        this.votes.set(senderChannelId, { choice, nickname, timestamp: messageTime });

        // 투표 로그 (처음 20개 + 이후 50개마다)
        this._voteLogCount++;
        if (this._voteLogCount <= 20 || this._voteLogCount % 50 === 0) {
          const action = prevVote ? `변경 !${prevVote.choice}→!${choice}` : `투표 !${choice}`;
          console.log(`[CHAT_BRIDGE:${this.roomCode}] 🗳 #${this._voteLogCount} ${nickname}(${senderChannelId.slice(0, 8)}) ${action} | round=${this.currentRoundKey} | 현재: L=${this.votes.size > 0 ? [...this.votes.values()].filter(v => v.choice === 1).length : 0} R=${this.votes.size > 0 ? [...this.votes.values()].filter(v => v.choice === 2).length : 0}`);
        }
      }
    } catch (err) {
      console.warn(`[CHAT_BRIDGE:${this.roomCode}] 메시지 처리 오류:`, err.message, err.stack?.split("\n")[1]);
    }
  }

  /** 라운드 변경 */
  setRound(roundKey, endsAt) {
    this.currentRoundKey = roundKey;
    this.roundEndsAt = endsAt ? new Date(endsAt) : null;
    this.votes.clear(); // 이전 집계 초기화
    console.log(`[CHAT_BRIDGE:${this.roomCode}] 라운드 변경: ${roundKey}, 마감: ${endsAt || "없음"}, 집계 초기화`);
  }

  /** 집계 조회 */
  getAggregates() {
    let left = 0, right = 0;
    const recentVoters = [];

    for (const [id, v] of this.votes) {
      if (v.choice === 1) left++;
      else right++;
      recentVoters.push({ nickname: v.nickname, choice: v.choice, timestamp: v.timestamp });
    }

    // 최근 투표자 20명 (타임스탬프 역순)
    recentVoters.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return {
      left,
      right,
      total: left + right,
      recentVoters: recentVoters.slice(0, 20),
    };
  }

  /** 연결 해제 */
  disconnect() {
    if (this.socket) {
      try { this.socket.disconnect(); } catch (e) {}
      this.socket = null;
    }
    this.sessionKey = null;
    this.currentRoundKey = null;
    this.roundEndsAt = null;
    this.votes.clear();
    if (this.status !== "error") this.status = "stopped";
    console.log(`[CHAT_BRIDGE:${this.roomCode}] 연결 해제됨`);
  }
}

// roomCode → ChatBridge 인스턴스
const chatBridges = new Map();

// --- POST /chat-audience/start ---
app.post("/chat-audience/start", requireAuth, async (req, res) => {
  try {
    const { roomCode } = req.body;
    console.log(`[CHAT_AUD] POST /start roomCode=${roomCode} userId=${req.user?.id}`);
    if (!roomCode) return res.status(400).json({ ok: false, error: "MISSING_ROOM_CODE" });

    // 이미 연결 중이면 상태 반환
    const existing = chatBridges.get(roomCode);
    if (existing && existing.status === "connected") {
      console.log(`[CHAT_AUD] /start — 이미 연결됨: ${roomCode}`);
      return res.json({ ok: true, status: "already_connected", channelId: existing.channelId, errorCode: null });
    }

    // chzzkSessions에서 토큰 조회
    const sess = chzzkSessions.get(roomCode);
    if (!sess || !sess.accessToken) {
      console.warn(`[CHAT_AUD] /start — NO_CHZZK_SESSION: roomCode=${roomCode}, sessions=[${[...chzzkSessions.keys()].join(",")}]`);
      return res.status(400).json({ ok: false, error: "NO_CHZZK_SESSION", message: "먼저 치지직 계정을 연동하세요" });
    }

    // 토큰 만료 확인
    if (sess.expiresAt < Date.now()) {
      console.warn(`[CHAT_AUD] /start — TOKEN_EXPIRED: expiresAt=${new Date(sess.expiresAt).toISOString()}`);
      return res.status(401).json({ ok: false, error: "TOKEN_EXPIRED", message: "치지직 토큰이 만료되었습니다. 다시 연동하세요" });
    }

    if (!sess.channelId) {
      console.warn(`[CHAT_AUD] /start — NO_CHANNEL_ID`);
      return res.status(400).json({ ok: false, error: "NO_CHANNEL_ID", message: "치지직 채널 정보가 없습니다" });
    }

    console.log(`[CHAT_AUD] /start — 연결 시도: channelId=${sess.channelId}, tokenExpires=${new Date(sess.expiresAt).toISOString()}`);

    // 기존 브릿지 정리
    if (existing) existing.disconnect();

    const bridge = new ChatBridge(roomCode, sess.accessToken, sess.channelId);
    chatBridges.set(roomCode, bridge);

    try {
      await bridge.connect();
    } catch (err) {
      console.error(`[CHAT_AUD] /start — 연결 실패: errorCode=${bridge.errorCode}, msg=${err.message}`);
      return res.status(502).json({
        ok: false,
        error: "CHAT_CONNECT_FAILED",
        errorCode: bridge.errorCode || "UNKNOWN",
        message: err.message,
      });
    }

    console.log(`[CHAT_AUD] /start — 성공 ✅ status=${bridge.status}, errorCode=${bridge.errorCode || "none"}`);
    return res.json({
      ok: true,
      status: bridge.status,
      channelId: sess.channelId,
      errorCode: bridge.errorCode || null,
      connectedAt: bridge.connectedAt?.toISOString(),
    });

  } catch (err) {
    console.error("[CHAT_AUD] /start 예외:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: err.message });
  }
});

// --- POST /chat-audience/round ---
app.post("/chat-audience/round", requireAuth, async (req, res) => {
  try {
    const { roomCode, roundKey, endsAt } = req.body;
    console.log(`[CHAT_AUD] POST /round roomCode=${roomCode} roundKey=${roundKey} endsAt=${endsAt}`);
    if (!roomCode || !roundKey) {
      return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });
    }

    const bridge = chatBridges.get(roomCode);
    if (!bridge) {
      console.warn(`[CHAT_AUD] /round — NO_BRIDGE: bridges=[${[...chatBridges.keys()].join(",")}]`);
      return res.status(404).json({ ok: false, error: "NO_BRIDGE", message: "채팅 연결이 없습니다" });
    }

    const prevVotes = bridge.votes.size;
    bridge.setRound(roundKey, endsAt || null);
    console.log(`[CHAT_AUD] /round OK — 이전 투표 ${prevVotes}개 초기화, bridge.status=${bridge.status}`);
    return res.json({ ok: true, bridgeStatus: bridge.status });

  } catch (err) {
    console.error("[CHAT_AUD] /round 예외:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

// --- GET /chat-audience/votes ---
app.get("/chat-audience/votes", (req, res) => {
  const roomCode = req.query.room;
  if (!roomCode) return res.status(400).json({ ok: false, error: "MISSING_ROOM" });

  const bridge = chatBridges.get(roomCode);
  if (!bridge) {
    return res.json({ ok: true, left: 0, right: 0, total: 0, recentVoters: [], status: "no_bridge", errorCode: null });
  }

  const agg = bridge.getAggregates();
  return res.json({
    ok: true,
    ...agg,
    status: bridge.status,
    errorCode: bridge.errorCode || null,
    errorMsg: bridge.errorMsg || null,
    roundKey: bridge.currentRoundKey,
    messagesProcessed: bridge.totalMessagesProcessed,
    connectedAt: bridge.connectedAt?.toISOString() || null,
    lastEventAt: bridge.lastEventAt?.toISOString() || null,
  });
});

// --- POST /chat-audience/stop ---
app.post("/chat-audience/stop", requireAuth, async (req, res) => {
  try {
    const { roomCode } = req.body;
    console.log(`[CHAT_AUD] POST /stop roomCode=${roomCode}`);
    if (!roomCode) return res.status(400).json({ ok: false, error: "MISSING_ROOM_CODE" });

    const bridge = chatBridges.get(roomCode);
    if (bridge) {
      console.log(`[CHAT_AUD] /stop — 총 메시지 ${bridge.totalMessagesProcessed}개 처리, 투표 ${bridge._voteLogCount}개`);
      bridge.disconnect();
      chatBridges.delete(roomCode);
    }

    // chzzk 세션도 정리
    chzzkSessions.delete(roomCode);

    console.log(`[CHAT_AUD] /stop OK — 세션+브릿지 정리 완료`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[CHAT_AUD] /stop 예외:", err);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

server.listen(process.env.PORT || 3001, () => {
  console.log(`Backend listening on http://localhost:${process.env.PORT || 3001}`);
});
