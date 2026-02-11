// ============================================================
// Supabase Edge Function: audience-vote
// 시청자 투표 모드 — 월드컵 멀티 전용
//
// 엔드포인트:
//   POST /audience-vote/vote       — 투표 저장
//   GET  /audience-vote/agg        — 집계 조회
//   POST /audience-vote/toggle     — ON/OFF
//   POST /audience-vote/set-round  — 현재 라운드 설정 (+ 마감 시각 자동 계산)
//   POST /audience-vote/set-config — 투표 제한시간 설정
//   GET  /audience-vote/current    — 현재 라운드 상태 조회
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// ---- route: POST /vote ----
async function handleVote(body: Record<string, unknown>) {
  const { room_code, round_key, choice, device_key } = body;
  if (!room_code || !round_key || !choice || !device_key) {
    return err("missing fields");
  }
  if (choice !== 1 && choice !== 2) return err("choice must be 1 or 2");

  // 서버 측 마감 체크
  const { data: state } = await supabase
    .from("audience_room_state")
    .select("round_key, round_ends_at")
    .eq("room_code", room_code)
    .maybeSingle();

  if (state) {
    // 라운드 키 불일치 → 이미 지난 라운드
    if (state.round_key && state.round_key !== round_key) {
      return err("round mismatch", 409);
    }
    // 마감 시간 지남
    if (state.round_ends_at && new Date(state.round_ends_at) < new Date()) {
      return err("voting closed", 403);
    }
  }

  const { error } = await supabase
    .from("audience_votes")
    .insert({
      room_code,
      round_key,
      choice: Number(choice),
      device_key,
    });

  if (error) {
    // unique constraint violation = 중복 투표
    if (error.code === "23505") return err("already voted", 409);
    console.error("vote insert error:", error);
    return err("insert failed", 500);
  }

  return json({ ok: true });
}

// ---- route: GET /agg ----
async function handleAgg(params: URLSearchParams) {
  let room_code = params.get("room_code");
  let round_key = params.get("round_key");

  if (!room_code) return err("room_code required");

  // round_key 없으면 현재 라운드에서 가져오기
  if (!round_key) {
    const { data: state } = await supabase
      .from("audience_room_state")
      .select("round_key")
      .eq("room_code", room_code)
      .maybeSingle();
    round_key = state?.round_key || null;
  }

  if (!round_key) {
    return json({ ok: true, left_votes: 0, right_votes: 0, total_votes: 0, round_key: null });
  }

  const { data, error } = await supabase
    .from("audience_vote_agg")
    .select("*")
    .eq("room_code", room_code)
    .eq("round_key", round_key)
    .maybeSingle();

  if (error) {
    console.error("agg query error:", error);
    return err("query failed", 500);
  }

  return json({
    ok: true,
    round_key,
    left_votes: data?.left_votes ?? 0,
    right_votes: data?.right_votes ?? 0,
    total_votes: data?.total_votes ?? 0,
  });
}

// ---- route: POST /toggle ----
async function handleToggle(body: Record<string, unknown>) {
  const { room_code, enabled } = body;
  if (!room_code) return err("room_code required");

  const { error } = await supabase
    .from("audience_polls")
    .upsert({ room_code, enabled: !!enabled }, { onConflict: "room_code" });

  if (error) {
    console.error("toggle error:", error);
    return err("toggle failed", 500);
  }

  // audience_room_state도 함께 초기화(없으면 생성)
  await supabase
    .from("audience_room_state")
    .upsert({ room_code }, { onConflict: "room_code" });

  return json({ ok: true, enabled: !!enabled });
}

// ---- route: POST /set-round ----
// 멀티 타이머 연동: timer_enabled + timer_sec을 프론트에서 전달받음
// timer_enabled=true → effective_sec = timer_sec
// timer_enabled=false → effective_sec = 12 (기본값)
async function handleSetRound(body: Record<string, unknown>) {
  const { room_code, round_key, timer_enabled, timer_sec } = body;
  if (!room_code || !round_key) return err("room_code and round_key required");

  const effectiveSec = timer_enabled ? Math.max(5, Math.min(300, Number(timer_sec) || 45)) : 12;

  // round_ends_at = now() + effectiveSec seconds
  const endsAt = new Date(Date.now() + effectiveSec * 1000).toISOString();

  const { error } = await supabase
    .from("audience_room_state")
    .upsert(
      { room_code, round_key, round_ends_at: endsAt, vote_duration_sec: effectiveSec },
      { onConflict: "room_code" }
    );

  if (error) {
    console.error("set-round error:", error);
    return err("set-round failed", 500);
  }

  return json({ ok: true, round_key, round_ends_at: endsAt, vote_duration_sec: effectiveSec });
}

// ---- route: GET /current ----
async function handleCurrent(params: URLSearchParams) {
  const room_code = params.get("room_code");
  if (!room_code) return err("room_code required");

  const { data: state } = await supabase
    .from("audience_room_state")
    .select("round_key, vote_duration_sec, round_ends_at, updated_at")
    .eq("room_code", room_code)
    .maybeSingle();

  const { data: poll } = await supabase
    .from("audience_polls")
    .select("enabled")
    .eq("room_code", room_code)
    .maybeSingle();

  return json({
    ok: true,
    enabled: poll?.enabled ?? false,
    round_key: state?.round_key ?? null,
    vote_duration_sec: state?.vote_duration_sec ?? 12,
    round_ends_at: state?.round_ends_at ?? null,
  });
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Path: /audience-vote/vote, /audience-vote/agg, etc.
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 1]; // last segment

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      switch (action) {
        case "vote":
          return await handleVote(body);
        case "toggle":
          return await handleToggle(body);
        case "set-round":
          return await handleSetRound(body);
        default:
          return err("unknown action: " + action, 404);
      }
    }

    if (req.method === "GET") {
      const params = url.searchParams;

      switch (action) {
        case "agg":
          return await handleAgg(params);
        case "current":
          return await handleCurrent(params);
        default:
          return err("unknown action: " + action, 404);
      }
    }

    return err("method not allowed", 405);
  } catch (e) {
    console.error("unhandled error:", e);
    return err("internal error", 500);
  }
});
