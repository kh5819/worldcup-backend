-- ============================================================
-- 시청자 투표 퀴즈 확장 (Audience Voting — Quiz Extension)
-- 기존 월드컵 스키마 위에 최소 ALTER만 수행
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ─── 1) audience_room_state: 퀴즈 메타 컬럼 추가 ───
ALTER TABLE public.audience_room_state
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'wc',
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reveal_answer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correct_choice int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS correct_text text DEFAULT NULL;

-- ─── 2) audience_votes: 텍스트 답안 컬럼 추가 ───
ALTER TABLE public.audience_votes
  ADD COLUMN IF NOT EXISTS text_answer text DEFAULT NULL;

-- ─── 3) choice 제약 완화: 기존 CHECK (choice IN (1,2)) → 1~4 허용 ───
-- 먼저 기존 제약 삭제 후 새로 추가
ALTER TABLE public.audience_votes DROP CONSTRAINT IF EXISTS audience_votes_choice_check;
ALTER TABLE public.audience_votes
  ADD CONSTRAINT audience_votes_choice_check CHECK (choice >= 0 AND choice <= 4);
-- choice=0은 텍스트 전용 투표에 사용 (text_answer만 있을 때)

-- ─── 4) 집계 뷰 교체: 기존 left/right 유지 + 퀴즈 집계 추가 ───
CREATE OR REPLACE VIEW public.audience_vote_agg AS
SELECT
  room_code,
  round_key,
  -- 월드컵 (기존 호환)
  count(*) FILTER (WHERE choice = 1) AS left_votes,
  count(*) FILTER (WHERE choice = 2) AS right_votes,
  count(*) AS total_votes,
  -- 퀴즈 객관식 (choice 1~4)
  count(*) FILTER (WHERE choice = 1) AS choice1_votes,
  count(*) FILTER (WHERE choice = 2) AS choice2_votes,
  count(*) FILTER (WHERE choice = 3) AS choice3_votes,
  count(*) FILTER (WHERE choice = 4) AS choice4_votes,
  -- 퀴즈 텍스트 (text_answer IS NOT NULL)
  count(*) FILTER (WHERE text_answer IS NOT NULL) AS text_count,
  max(created_at) AS last_vote_at
FROM public.audience_votes
GROUP BY room_code, round_key;

-- ─── 5) 통합 현재 상태 뷰: 기존 필드 유지 + 퀴즈 확장 ───
CREATE OR REPLACE VIEW public.audience_current_state AS
SELECT
  p.room_code,
  p.enabled,
  s.round_key,
  s.vote_duration_sec,
  s.round_ends_at,
  -- 퀴즈 메타
  s.mode,
  s.question_type,
  s.prompt,
  s.options,
  s.reveal_answer,
  s.correct_choice,
  s.correct_text,
  -- 월드컵 집계 (기존 호환)
  COALESCE(a.left_votes,  0) AS left_votes,
  COALESCE(a.right_votes, 0) AS right_votes,
  COALESCE(a.total_votes, 0) AS total_votes,
  -- 퀴즈 집계
  COALESCE(a.choice1_votes, 0) AS choice1_votes,
  COALESCE(a.choice2_votes, 0) AS choice2_votes,
  COALESCE(a.choice3_votes, 0) AS choice3_votes,
  COALESCE(a.choice4_votes, 0) AS choice4_votes,
  COALESCE(a.text_count, 0)    AS text_count,
  a.last_vote_at
FROM public.audience_polls p
LEFT JOIN public.audience_room_state s
  ON s.room_code = p.room_code
LEFT JOIN public.audience_vote_agg a
  ON  a.room_code = s.room_code
  AND a.round_key = s.round_key;
