-- ============================================================
-- VIEW: audience_current_state
-- /current 1회 조회용 — polls + room_state + vote_agg 조인
-- Supabase SQL Editor에 붙여넣기 후 실행
-- ============================================================

CREATE OR REPLACE VIEW public.audience_current_state AS
SELECT
  p.room_code,
  p.enabled,
  s.round_key,
  s.vote_duration_sec,
  s.round_ends_at,
  COALESCE(a.left_votes,  0) AS left_votes,
  COALESCE(a.right_votes, 0) AS right_votes,
  COALESCE(a.total_votes, 0) AS total_votes,
  a.last_vote_at
FROM public.audience_polls p
LEFT JOIN public.audience_room_state s
  ON s.room_code = p.room_code
LEFT JOIN public.audience_vote_agg a
  ON  a.room_code = s.room_code
  AND a.round_key = s.round_key;
