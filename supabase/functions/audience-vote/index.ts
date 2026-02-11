// ============================================================
// Supabase Edge Function: audience-vote
// 시청자 투표 모드 — 월드컵 멀티 전용
//
// 엔드포인트:
//   GET  /audience-vote/current       — 현재 상태 + 집계 (auto-init)
//   POST /audience-vote/cast          — 투표 저장
//   POST /audience-vote/host/enabled  — ON/OFF
//   POST /audience-vote/host/round    — 라운드 설정
//
// ⚠️  배포 체크리스트:
//   1. Supabase Dashboard → Edge Functions → audience-vote → Settings
//      "Verify JWT" 토글을 반드시 OFF 로 설정할 것!
//      ON이면 apikey+anon Bearer만으로는 401이 남.
//      시청자(audience.js)는 로그인 세션이 없으므로 Verify JWT=OFF 필수.
//   2. host/* 엔드포인트는 auth 없이 동작 (Verify JWT OFF).
//      service_role로 DB 직접 접근하므로 별도 인증 불필요.
//   3. 배포 명령:
//      supabase functions deploy audience-vote --no-verify-jwt \
//        --project-ref irqhgsusfzvytpgirwdo
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALLOWED_ORIGIN = "https://playduo.kr";

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
// GET /current?room=XXXXXX&round=...
// 통합 응답: enabled + round state + 집계 + server time
// round 쿼리가 있으면 해당 라운드 집계, 없으면 DB state의 round_key 사용
// ============================================================
async function handleCurrent(
  params: URLSearchParams,
  origin?: string | null
) {
  const room_code = params.get("room") || params.get("room_code");
  if (!room_code) return err("room required", 400, origin);

  const queryRound = params.get("round") || null;

  // Auto-init if missing
  await ensureRoom(room_code);

  // Parallel queries
  const [pollRes, stateRes] = await Promise.all([
    sb
      .from("audience_polls")
      .select("enabled")
      .eq("room_code", room_code)
      .maybeSingle(),
    sb
      .from("audience_room_state")
      .select("round_key, vote_duration_sec, round_ends_at, updated_at")
      .eq("room_code", room_code)
      .maybeSingle(),
  ]);

  const enabled = pollRes.data?.enabled ?? false;
  // 클라이언트가 보낸 round 우선, 없으면 DB state
  const round_key = queryRound || stateRes.data?.round_key || null;

  // Aggregate votes for current round
  let left_votes = 0,
    right_votes = 0,
    total_votes = 0;

  if (round_key) {
    const { data: agg } = await sb
      .from("audience_vote_agg")
      .select("*")
      .eq("room_code", room_code)
      .eq("round_key", round_key)
      .maybeSingle();

    if (agg) {
      left_votes = agg.left_votes ?? 0;
      right_votes = agg.right_votes ?? 0;
      total_votes = agg.total_votes ?? 0;
    }
  }

  return json(
    {
      ok: true,
      now: new Date().toISOString(),
      enabled,
      round_key,
      vote_duration_sec: stateRes.data?.vote_duration_sec ?? 12,
      round_ends_at: stateRes.data?.round_ends_at ?? null,
      left_votes,
      right_votes,
      total_votes,
    },
    200,
    origin
  );
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
  const { room_code, round_key, timer_enabled, timer_sec } = body;
  if (!room_code || !round_key) {
    return err("room_code and round_key required", 400, origin);
  }

  const effectiveSec = timer_enabled
    ? Math.max(5, Math.min(300, Number(timer_sec) || 45))
    : 12;
  const endsAt = new Date(Date.now() + effectiveSec * 1000).toISOString();

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
        case "host/enabled":
          return await handleHostEnabled(body, origin);
        case "host/round":
          return await handleHostRound(body, origin);
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
