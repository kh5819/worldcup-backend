-- =============================================
-- 콘텐츠 다국어 — language 컬럼 추가 (2026-05-28)
-- contents / tier_templates / bingos / personality_tests
-- default 'ko' — 기존 데이터 영향 0
-- =============================================

-- 1) contents (월드컵 + 퀴즈)
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ko'
    CHECK (language IN ('ko', 'ja', 'en'));

CREATE INDEX IF NOT EXISTS idx_contents_language
  ON contents (language)
  WHERE is_hidden = false;

-- 2) tier_templates (티어메이커)
ALTER TABLE tier_templates
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ko'
    CHECK (language IN ('ko', 'ja', 'en'));

CREATE INDEX IF NOT EXISTS idx_tier_templates_language
  ON tier_templates (language)
  WHERE is_hidden = false;

-- 3) bingos (빙고)
ALTER TABLE bingos
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ko'
    CHECK (language IN ('ko', 'ja', 'en'));

CREATE INDEX IF NOT EXISTS idx_bingos_language
  ON bingos (language)
  WHERE is_hidden = false AND deleted_at IS NULL;

-- 4) personality_tests (심리테스트)
ALTER TABLE personality_tests
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ko'
    CHECK (language IN ('ko', 'ja', 'en'));

CREATE INDEX IF NOT EXISTS idx_personality_tests_language
  ON personality_tests (language)
  WHERE is_hidden = false AND deleted_at IS NULL;

-- 검증
SELECT 'contents' AS t, language, COUNT(*) FROM contents GROUP BY language
UNION ALL
SELECT 'tier_templates', language, COUNT(*) FROM tier_templates GROUP BY language
UNION ALL
SELECT 'bingos', language, COUNT(*) FROM bingos GROUP BY language
UNION ALL
SELECT 'personality_tests', language, COUNT(*) FROM personality_tests GROUP BY language;
