-- ============================================================
-- 콘텐츠 파생 연결 구조: 티어 → 퀴즈 1:1 링킹
--
-- 목적: 티어 템플릿 1개 → 파생 퀴즈 1개 (1:1 보장)
--       퀴즈 문제 → 원본 티어 카드 식별자 연결 (문제별 upsert)
--
-- 기존 월드컵→티어 연결: tier_templates.source_worldcup_id (이미 존재)
-- 이 마이그레이션: 티어→퀴즈 연결 추가
-- ============================================================

-- 1) contents 테이블에 source_tier_id 추가
--    tier_templates.id를 참조, 해당 티어에서 파생된 퀴즈임을 표시
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS source_tier_id uuid;

-- 2) UNIQUE 제약: 티어 1개당 파생 퀴즈 1개만
CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_source_tier
  ON public.contents (source_tier_id)
  WHERE source_tier_id IS NOT NULL;

-- 3) 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_contents_source_tier_lookup
  ON public.contents (source_tier_id)
  WHERE source_tier_id IS NOT NULL;

-- 4) quiz_questions 테이블에 source_card_id 추가
--    tier cards JSONB 내 카드 id를 저장, 문제별 upsert 키로 사용
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS source_card_id text;

-- 5) source_card_id 조회 인덱스 (content_id + source_card_id 복합)
CREATE INDEX IF NOT EXISTS idx_quiz_questions_source_card
  ON public.quiz_questions (content_id, source_card_id)
  WHERE source_card_id IS NOT NULL;
