-- ============================================================
-- DUO: Tier Maker Schema (schema_tier.sql)
-- - 기존 테이블 수정 없음 (tier_ prefix 신규 테이블만)
-- - Supabase Postgres, public 스키마
-- - 실행 순서: 1) 테이블 → 2) 트리거 → 3) RLS 정책
-- ============================================================

-- 0) UUID 확장 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) tier_templates: 티어메이커 템플릿(주제)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tier_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid        NOT NULL,
  title         text        NOT NULL,
  description   text,
  tags          text[],
  cards         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- cards 예: [{"id":"c1","image_url":"...","label":"..."}]
  base_tiers    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- base_tiers 예: [{"id":"s","name":"S"},{"id":"a","name":"A"},...]
  is_public     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tier_templates_creator
  ON public.tier_templates (creator_id);
CREATE INDEX IF NOT EXISTS idx_tier_templates_public
  ON public.tier_templates (is_public) WHERE is_public = true;

-- ============================================================
-- 2) tier_instances: 유저 플레이 인스턴스 (저장/이어하기 핵심)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tier_instances (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL,
  template_id       uuid        NOT NULL
                                REFERENCES public.tier_templates(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'published')),
  tiers             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  placements        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  pool              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  added_cards       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- 플레이 중 추가한 이미지 카드 (템플릿 오염 방지)
  vote_up_count     int         NOT NULL DEFAULT 0,
  vote_down_count   int         NOT NULL DEFAULT 0,
  comment_count     int         NOT NULL DEFAULT 0,
  controversy_score numeric     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tier_instances_user
  ON public.tier_instances (user_id);
CREATE INDEX IF NOT EXISTS idx_tier_instances_template
  ON public.tier_instances (template_id);
CREATE INDEX IF NOT EXISTS idx_tier_instances_user_status
  ON public.tier_instances (user_id, status);

-- ============================================================
-- 3) updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_tier_instance()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_tier_instance ON public.tier_instances;
CREATE TRIGGER trg_touch_tier_instance
  BEFORE UPDATE ON public.tier_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_tier_instance();

-- ============================================================
-- 4) RLS 정책
-- ============================================================

-- ── tier_templates ──
ALTER TABLE public.tier_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: 공개 템플릿은 누구나, 비공개는 creator만
DROP POLICY IF EXISTS "tier_templates_select_public" ON public.tier_templates;
CREATE POLICY "tier_templates_select_public"
  ON public.tier_templates FOR SELECT
  USING (is_public = true OR creator_id = auth.uid());

-- INSERT: 자기 것만
DROP POLICY IF EXISTS "tier_templates_insert_own" ON public.tier_templates;
CREATE POLICY "tier_templates_insert_own"
  ON public.tier_templates FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- UPDATE: 자기 것만
DROP POLICY IF EXISTS "tier_templates_update_own" ON public.tier_templates;
CREATE POLICY "tier_templates_update_own"
  ON public.tier_templates FOR UPDATE
  USING (creator_id = auth.uid());

-- DELETE: 자기 것만
DROP POLICY IF EXISTS "tier_templates_delete_own" ON public.tier_templates;
CREATE POLICY "tier_templates_delete_own"
  ON public.tier_templates FOR DELETE
  USING (creator_id = auth.uid());

-- ── tier_instances ──
ALTER TABLE public.tier_instances ENABLE ROW LEVEL SECURITY;

-- SELECT: 자기 것만
DROP POLICY IF EXISTS "tier_instances_select_own" ON public.tier_instances;
CREATE POLICY "tier_instances_select_own"
  ON public.tier_instances FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: 자기 것만
DROP POLICY IF EXISTS "tier_instances_insert_own" ON public.tier_instances;
CREATE POLICY "tier_instances_insert_own"
  ON public.tier_instances FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 자기 것만
DROP POLICY IF EXISTS "tier_instances_update_own" ON public.tier_instances;
CREATE POLICY "tier_instances_update_own"
  ON public.tier_instances FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: 자기 것만
DROP POLICY IF EXISTS "tier_instances_delete_own" ON public.tier_instances;
CREATE POLICY "tier_instances_delete_own"
  ON public.tier_instances FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 적용 방법
-- ============================================================
-- Supabase Dashboard > SQL Editor 에서 이 파일 전체를 실행하거나,
-- supabase db push 또는 psql로 직접 실행:
--   psql $DATABASE_URL -f schema_tier.sql
-- ============================================================
