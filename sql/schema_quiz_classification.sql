-- ============================================================
-- schema_quiz_classification.sql
-- quiz_questions.type CHECK 제약에 'classification' 추가
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-03-11
-- ============================================================

-- 기존 CHECK 제약 제거 후 classification 포함하여 재생성
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_type_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_type_check
  CHECK (type IN ('mcq', 'short', 'audio_youtube', 'ordering', 'classification'));
