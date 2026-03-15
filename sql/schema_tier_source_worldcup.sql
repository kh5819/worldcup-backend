-- ============================================================
-- tier_templates: source_worldcup_id 컬럼 추가
-- 월드컵 → 티어 템플릿 1:1 연결용
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS source_worldcup_id uuid;

-- 2) UNIQUE 제약 (월드컵 1개당 티어 템플릿 1개만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_templates_source_worldcup
  ON public.tier_templates (source_worldcup_id)
  WHERE source_worldcup_id IS NOT NULL;

-- 3) 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_tier_templates_source_wc_lookup
  ON public.tier_templates (source_worldcup_id)
  WHERE source_worldcup_id IS NOT NULL;
