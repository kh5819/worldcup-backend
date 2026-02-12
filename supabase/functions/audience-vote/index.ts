// ============================================================
// Supabase Edge Function: audience-vote
// 시청자 투표 모드 — 월드컵 멀티 전용
//
// 엔드포인트:
//   GET  /audience-vote/current       — 현재 상태 + 집계 (auto-init)
//   POST /audience-vote/cast          — 투표 저장
//   POST /audience-vote/host/start    — 방송 시작 (room 생성 + enabled=true)
//   POST /audience-vote/host/end      — 방송 종료 (enabled=false)
//   POST /audience-vote/host/enabled  — ON/OFF (레거시)
//   POST /audience-vote/host/round    — 라운드 설정
//   POST /audience-vote/host/state    — 라운드 상태 직접 upsert (play.js용)
//
// ⚠️  배포 체크리스트:
//   1. Supabase Dashboard → Edge Functions → audience-vote → Settings
//      "Verify JWT" 토글을 반드시 OFF 로 설정할 것!
//      ON이면 apikey+anon Bearer만으로는 401이 남.
//      시청자(audience.js)는 로그인 세션이 없으므로 Verify JWT=OFF 필수.
//   2. host/* 엔드포인트는 Verify JWT OFF 환경에서도 동작.
//      host/state는 Authorization Bearer 토큰으로 호스트 인증 (getUser).
//      나머지 host/* + cast/current는 인증 없이 동작.
//   3. 배포 명령:
//      supabase functions deploy audience-vote --no-verify-jwt \
//        --project-ref irqhgsusfzvytpgirwdo
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGIN = "https://playduo.kr";

// ---- room_code별 1초 인메모리 캐시 (/current용) ----
const CACHE_TTL_MS = 1000;
const _currentCache = new Map<string, { ts: number; payload: Record<string, unknown> }>();

function corsHeaders(origin?: string | null) {
  // Allow playduo.kr and localhost for dev
  const allowed =
    origin === ALLOWED_ORIGIN ||
    origin?.startsWith("http://localhost") ||
    origin?.startsWith("http://127.0.0.1");
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
  };
}

function json(data: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400, origin?: string | null) {
  return json({ ok: false, error: msg }, status, origin);
}

// ---- Auto-init: ensure rows exist for room_code ----
async function ensureRoom(room_code: string) {
  // audience_polls
  await sb
    .from("audience_polls")
    .upsert({ room_code }, { onConflict: "room_code", ignoreDuplicates: true });
  // audience_room_state
  await sb
    .from("audience_room_state")
    .upsert({ room_code }, { onConflict: "room_code", ignoreDuplicates: true });
}

// ============================================================
// GET /current?room=XXXXXX
// VIEW 1회 조회 + room_code별 1초 인메모리 캐시
// ============================================================
async function handleCurrent(
  params: URLSearchParams,
  origin?: string | null
) {
  const room_code = params.get("room") || params.get("room_code");
  if (!room_code) return err("room required", 400, origin);

  const now = Date.now();

  // ---- 1초 캐시 히트 체크 ----
  const cached = _currentCache.get(room_code);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return json({ ...cached.payload, now: new Date().toISOString() }, 200, origin);
  }

  // Auto-init if missing
  await ensureRoom(room_code);

  // ---- VIEW 1회 조회 ----
  const { data: row, error: viewErr } = await sb
    .from("audience_current_state")
    .select("*")
    .eq("room_code", room_code)
    .maybeSingle();

  if (viewErr) {
    console.error("/current view error:", viewErr);
    return err("query failed", 500, origin);
  }

  const payload = {
    ok: true as const,
    enabled: row?.enabled ?? false,
    round_key: row?.round_key ?? null,
    vote_duration_sec: row?.vote_duration_sec ?? 12,
    round_ends_at: row?.round_ends_at ?? null,
    left_votes: row?.left_votes ?? 0,
    right_votes: row?.right_votes ?? 0,
    total_votes: row?.total_votes ?? 0,
  };

  // ---- 캐시 저장 ----
  _currentCache.set(room_code, { ts: now, payload });

  return json({ ...payload, now: new Date().toISOString() }, 200, origin);
}

// ============================================================
// POST /cast
// body: { room_code, round_key, choice (1|2), device_key }
// ============================================================
async function handleCast(
  body: Record<string, unknown>,
  origin?: string | null
) {
  const { room_code, round_key, choice, device_key } = body;
  if (!room_code || !round_key || !choice || !device_key) {
    return err("missing fields", 400, origin);
  }
  if (choice !== 1 && choice !== 2) return err("choice must be 1 or 2", 400, origin);

  // Check: enabled?
  const { data: poll } = await sb
    .from("audience_polls")
    .select("enabled")
    .eq("room_code", room_code)
    .maybeSingle();

  if (!poll?.enabled) return err("voting disabled", 403, origin);

  // Check: round key matches + not expired
  const { data: state } = await sb
    .from("audience_room_state")
    .select("round_key, round_ends_at")
    .eq("room_code", room_code)
    .maybeSingle();

  if (state) {
    if (state.round_key && state.round_key !== round_key) {
      return err("round mismatch", 409, origin);
    }
    if (state.round_ends_at && new Date(state.round_ends_at) < new Date()) {
      return err("voting closed", 403, origin);
    }
  }

  const { error } = await sb.from("audience_votes").insert({
    room_code,
    round_key,
    choice: Number(choice),
    device_key,
  });

  if (error) {
    if (error.code === "23505") return err("already voted", 409, origin);
    console.error("vote insert error:", error);
    return err("insert failed", 500, origin);
  }

  return json({ ok: true }, 200, origin);
}

// ============================================================
// POST /host/enabled
// body: { room_code, enabled }
// ============================================================
async function handleHostEnabled(
  body: Record<string, unknown>,
  origin?: string | null
) {
  const { room_code, enabled } = body;
  if (!room_code) return err("room_code required", 400, origin);

  await ensureRoom(room_code);

  const { error } = await sb
    .from("audience_polls")
    .upsert(
      { room_code, enabled: !!enabled, updated_at: new Date().toISOString() },
      { onConflict: "room_code" }
    );

  if (error) {
    console.error("host/enabled error:", error);
    return err("toggle failed", 500, origin);
  }

  return json({ ok: true, enabled: !!enabled }, 200, origin);
}

// ============================================================
// POST /host/round
// body: { room_code, round_key, timer_enabled, timer_sec }
// ============================================================
async function handleHostRound(
  body: Record<string, unknown>,
  origin?: string | null
) {
  const { room_code, round_key, timer_enabled, timer_sec, vote_duration_sec } = body;
  if (!room_code || !round_key) {
    return err("room_code and round_key required", 400, origin);
  }

  const rawSec = Number(timer_sec || vote_duration_sec) || 45;
  const effectiveSec = timer_enabled !== false
    ? Math.max(5, Math.min(300, rawSec))
    : 12;
  const endsAt = new Date(Date.now() + effectiveSec * 1000).toISOString();

  // ★ audience_polls도 enabled=true로 upsert (라운드 설정 = 투표 활성화)
  await sb
    .from("audience_polls")
    .upsert(
      { room_code, enabled: true, updated_at: new Date().toISOString() },
      { onConflict: "room_code" }
    );

  const { error } = await sb.from("audience_room_state").upsert(
    {
      room_code,
      round_key,
      round_ends_at: endsAt,
      vote_duration_sec: effectiveSec,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_code" }
  );

  if (error) {
    console.error("host/round error:", error);
    return err("set-round failed", 500, origin);
  }

  return json(
    {
      ok: true,
      round_key,
      round_ends_at: endsAt,
      vote_duration_sec: effectiveSec,
    },
    200,
    origin
  );
}

// ============================================================
// POST /host/start
// body: { room, vote_duration_sec? }
// 방송 시작: room 생성 + enabled=true + state 초기화
// ============================================================
async function handleHostStart(
  body: Record<string, unknown>,
  origin?: string | null
) {
  const room_code = body.room || body.room_code;
  if (!room_code || typeof room_code !== "string") {
    return err("room required", 400, origin);
  }

  const voteSec = Math.max(5, Math.min(300, Number(body.vote_duration_sec) || 45));

  // 1) audience_polls: enabled=true
  const { error: pollErr } = await sb
    .from("audience_polls")
    .upsert(
      { room_code, enabled: true, updated_at: new Date().toISOString() },
      { onConflict: "room_code" }
    );
  if (pollErr) {
    console.error("host/start polls error:", pollErr);
    return err("start failed", 500, origin);
  }

  // 2) audience_room_state: round 초기화 (아직 라운드 시작 전)
  const { error: stateErr } = await sb
    .from("audience_room_state")
    .upsert(
      {
        room_code,
        round_key: null,
        round_ends_at: null,
        vote_duration_sec: voteSec,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code" }
    );
  if (stateErr) {
    console.error("host/start state error:", stateErr);
    return err("start failed", 500, origin);
  }

  return json(
    { ok: true, room_code, enabled: true, vote_duration_sec: voteSec },
    200,
    origin
  );
}

// ============================================================
// POST /host/end
// body: { room }
// 방송 종료: enabled=false
// ============================================================
async function handleHostEnd(
  body: Record<string, unknown>,
  origin?: string | null
) {
  const room_code = body.room || body.room_code;
  if (!room_code || typeof room_code !== "string") {
    return err("room required", 400, origin);
  }

  const { error } = await sb
    .from("audience_polls")
    .upsert(
      { room_code, enabled: false, updated_at: new Date().toISOString() },
      { onConflict: "room_code" }
    );

  if (error) {
    console.error("host/end error:", error);
    return err("end failed", 500, origin);
  }

  return json({ ok: true, room_code, enabled: false }, 200, origin);
}

// ============================================================
// POST /host/state  (★ 호스트 인증 필수)
// headers: Authorization: Bearer <access_token>
// body: { room, round_key, vote_duration_sec, round_ends_at }
// 라운드 상태 직접 upsert — play.js가 라운드 시작마다 호출
// ============================================================
async function handleHostState(
  body: Record<string, unknown>,
  req: Request,
  origin?: string | null
) {
  // ---- JWT 인증: 호스트(로그인 유저)만 허용 ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return err("authorization required", 401, origin);
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) {
    console.warn("host/state auth failed:", authErr?.message);
    return err("invalid or expired token", 401, origin);
  }
  // ---- 인증 통과 (user.id 로깅) ----

  const room_code = body.room || body.room_code;
  if (!room_code || typeof room_code !== "string") {
    return err("room required", 400, origin);
  }

  const round_key = body.round_key as string | null;
  if (!round_key) {
    return err("round_key required", 400, origin);
  }
  const vote_duration_sec = Math.max(5, Math.min(300, Number(body.vote_duration_sec) || 45));
  const round_ends_at = body.round_ends_at as string | null;

  // 1) enabled=true 보장
  const { error: pollErr } = await sb
    .from("audience_polls")
    .upsert(
      { room_code, enabled: true, updated_at: new Date().toISOString() },
      { onConflict: "room_code" }
    );
  if (pollErr) {
    console.error("host/state polls error:", pollErr);
    return err("state failed", 500, origin);
  }

  // 2) audience_room_state upsert (round_key는 위에서 검증됨 — 절대 null 아님)
  const effectiveEndsAt = round_ends_at || new Date(Date.now() + vote_duration_sec * 1000).toISOString();
  const { error: stateErr } = await sb
    .from("audience_room_state")
    .upsert(
      {
        room_code,
        round_key,
        vote_duration_sec,
        round_ends_at: effectiveEndsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code" }
    );
  if (stateErr) {
    console.error("host/state state error:", stateErr);
    return err("state failed", 500, origin);
  }

  // 3) /current 캐시 즉시 무효화 (라운드 변경 즉반영)
  _currentCache.delete(room_code as string);

  console.log("host/state OK: room=%s round=%s ends=%s user=%s", room_code, round_key, effectiveEndsAt, user.id);

  return json(
    { ok: true, room_code, round_key, vote_duration_sec, round_ends_at: effectiveEndsAt },
    200,
    origin
  );
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  // Path: /audience-vote/cast, /audience-vote/host/round, etc.
  const segments = url.pathname.split("/").filter(Boolean);
  // segments example: ["audience-vote", "host", "round"]
  // action = everything after "audience-vote"
  const fnIndex = segments.indexOf("audience-vote");
  const actionParts = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];
  const action = actionParts.join("/"); // "cast", "current", "host/enabled", "host/round"

  try {
    if (req.method === "GET") {
      switch (action) {
        case "current":
          return await handleCurrent(url.searchParams, origin);
        default:
          return err("unknown action: " + action, 404, origin);
      }
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      switch (action) {
        case "cast":
          return await handleCast(body, origin);
        case "host/start":
          return await handleHostStart(body, origin);
        case "host/end":
          return await handleHostEnd(body, origin);
        case "host/enabled":
          return await handleHostEnabled(body, origin);
        case "host/round":
          return await handleHostRound(body, origin);
        case "host/state":
          return await handleHostState(body, req, origin);
        default:
          return err("unknown action: " + action, 404, origin);
      }
    }

    return err("method not allowed", 405, origin);
  } catch (e) {
    console.error("unhandled error:", e);
    return err("internal error", 500, origin);
  }
});
