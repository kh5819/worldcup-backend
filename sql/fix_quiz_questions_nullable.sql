-- ============================================================
-- DUO: quiz_questions start_sec / duration_sec NOT NULL 수정
-- 실행 순서: Supabase SQL Editor에서 이 파일을 통째로 실행
-- ============================================================

-- 1) start_sec: NULL 허용 + 기본값 0
ALTER TABLE quiz_questions
  ALTER COLUMN start_sec DROP NOT NULL;

ALTER TABLE quiz_questions
  ALTER COLUMN start_sec SET DEFAULT 0;

-- 2) duration_sec: NULL 허용 + 기본값 10
ALTER TABLE quiz_questions
  ALTER COLUMN duration_sec DROP NOT NULL;

ALTER TABLE quiz_questions
  ALTER COLUMN duration_sec SET DEFAULT 10;

-- 3) 기존 NULL 행이 있으면 0/10으로 채우기 (안전장치)
UPDATE quiz_questions SET start_sec = 0 WHERE start_sec IS NULL;
UPDATE quiz_questions SET duration_sec = 10 WHERE duration_sec IS NULL;
