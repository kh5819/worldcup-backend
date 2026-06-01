-- =============================================
-- 유튜브 소리퀴즈 → 월드컵 연결 (1:1) — 운영자 변환
-- _handleAdminMakeSoundQuiz(월드컵→소리퀴즈)의 역방향
-- =============================================

-- 월드컵(contents) → 소스 소리퀴즈(contents) 연결용
-- 기존: contents.source_worldcup_id (월드컵→소리/영상퀴즈)
-- 기존: contents.source_tier_id (티어→퀴즈)
-- 신규: contents.source_quiz_id (소리퀴즈→월드컵)
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS source_quiz_id UUID
    REFERENCES contents(id) ON DELETE SET NULL;

-- UNIQUE 인덱스: 소스 퀴즈 1개당 월드컵 1개만 허용 (중복 변환 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_source_quiz_id
  ON contents(source_quiz_id)
  WHERE source_quiz_id IS NOT NULL;

-- 후보 단위 연결: 재변환 시 후보↔문제 매칭으로 운영자 손편집(후보명) 보존
-- 후보(worldcup_candidates) → 소스 문제(quiz_questions.id)
ALTER TABLE worldcup_candidates
  ADD COLUMN IF NOT EXISTS source_question_id UUID;

-- 조회 인덱스 (content_id + source_question_id 복합)
CREATE INDEX IF NOT EXISTS idx_wc_candidates_source_question_id
  ON worldcup_candidates(content_id, source_question_id)
  WHERE source_question_id IS NOT NULL;

-- RLS: 기존 contents / worldcup_candidates 정책 그대로 적용 (별도 추가 불필요)
