// ============================================================
// Supabase Edge Function: audience-vote
// 시청자 투표 모드 — 월드컵 멀티 전용
//
// 엔드포인트:
//   GET  /audience-vote/current       — 현재 상태 + 집계 (auto-init)
//   POST /audience-vote/vote          — 투표 저장
//   POST /audience-vote/host/enabled  — ON/OFF (호스트 전용, auth 필요)
//   POST /audience-vote/host/round    — 라운드 설정 (호스트 전용, auth 필요)
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

// ---- Auth helper (Bearer token → user) ----
async function getAuthUser(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  // Create a per-request client with the user's token to verify
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id };
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
// 통합 응답: enabled + round state + 집계 + server time
// ============================================================
async function handleCurrent(
  params: URLSearchParams,
  origin?: string | null
) {
  const room_code = params.get("room") || params.get("room_code");
  if (!room_code) return err("room required", 400, origin);

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
  const round_key = stateRes.data?.round_key ?? null;

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
// POST /vote
// body: { room_code, round_key, choice (1|2), device_key }
// ============================================================
async function handleVote(
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
// Auth required (Bearer token)
// ============================================================
async function handleHostEnabled(
  req: Request,
  body: Record<string, unknown>,
  origin?: string | null
) {
  const user = await getAuthUser(req);
  if (!user) return err("auth required", 401, origin);

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
// Auth required (Bearer token)
// ============================================================
async function handleHostRound(
  req: Request,
  body: Record<string, unknown>,
  origin?: string | null
) {
  const user = await getAuthUser(req);
  if (!user) return err("auth required", 401, origin);

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
  // Path: /audience-vote/vote, /audience-vote/host/round, etc.
  const segments = url.pathname.split("/").filter(Boolean);
  // segments example: ["audience-vote", "host", "round"]
  // action = everything after "audience-vote"
  const fnIndex = segments.indexOf("audience-vote");
  const actionParts = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];
  const action = actionParts.join("/"); // "vote", "current", "host/enabled", "host/round"

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
        case "vote":
          return await handleVote(body, origin);
        case "host/enabled":
          return await handleHostEnabled(req, body, origin);
        case "host/round":
          return await handleHostRound(req, body, origin);
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
