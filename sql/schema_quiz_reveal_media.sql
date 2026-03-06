-- =============================================
-- quiz_questions: 정답공개용 미디어 컬럼 추가
-- 기존 media_type/media_url = 문제 표시용
-- 새 reveal_media_type/reveal_media_url = 정답 공개용
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS reveal_media_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reveal_media_url  TEXT DEFAULT NULL;

COMMENT ON COLUMN quiz_questions.reveal_media_type IS '정답 공개 화면 전용 미디어 타입 (image/gif/mp4). NULL이면 문제용 미디어를 fallback으로 사용';
COMMENT ON COLUMN quiz_questions.reveal_media_url  IS '정답 공개 화면 전용 미디어 URL. NULL이면 문제용 미디어를 fallback으로 사용';
