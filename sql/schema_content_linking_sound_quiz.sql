-- =============================================
-- 유튜브 월드컵 → 소리퀴즈 연결 (1:1)
-- contents.source_worldcup_id 컬럼 추가
-- =============================================

-- 월드컵(contents) → 소리퀴즈(contents) 연결용
-- 기존: tier_templates.source_worldcup_id (월드컵→티어)
-- 기존: contents.source_tier_id (티어→퀴즈)
-- 신규: contents.source_worldcup_id (유튜브 월드컵→소리퀴즈)
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS source_worldcup_id UUID
    REFERENCES contents(id) ON DELETE SET NULL;

-- UNIQUE 인덱스: 월드컵 1개당 소리퀴즈 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_source_worldcup_id
  ON contents(source_worldcup_id)
  WHERE source_worldcup_id IS NOT NULL;

-- RLS: 기존 contents 정책 그대로 적용 (별도 추가 불필요)
