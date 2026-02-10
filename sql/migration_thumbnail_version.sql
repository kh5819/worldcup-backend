-- ============================================================
-- DUO: thumbnail_version + updated_at 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- ========== 1) contents 테이블 컬럼 추가 ==========
-- thumbnail_url 은 schema_ugc_v2.sql 에서 이미 추가됨

ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS thumbnail_version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ========== 2) tier_templates 테이블 컬럼 추가 ==========

ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS thumbnail_version BIGINT NOT NULL DEFAULT 1;

ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ========== 3) contents 트리거 ==========

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.touch_contents()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_contents ON public.contents;
CREATE TRIGGER trg_touch_contents
  BEFORE UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_contents();

-- thumbnail_version 자동 증가 (thumbnail_url 변경 시)
CREATE OR REPLACE FUNCTION public.bump_contents_thumb_version()
RETURNS trigger AS $$
BEGIN
  IF OLD.thumbnail_url IS DISTINCT FROM NEW.thumbnail_url THEN
    NEW.thumbnail_version = COALESCE(OLD.thumbnail_version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_contents_thumb_version ON public.contents;
CREATE TRIGGER trg_bump_contents_thumb_version
  BEFORE UPDATE ON public.contents
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_contents_thumb_version();

-- ========== 4) tier_templates 트리거 ==========

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.touch_tier_template()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_tier_template ON public.tier_templates;
CREATE TRIGGER trg_touch_tier_template
  BEFORE UPDATE ON public.tier_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_tier_template();

-- thumbnail_version 자동 증가 (thumbnail_url 변경 시)
CREATE OR REPLACE FUNCTION public.bump_tier_template_thumb_version()
RETURNS trigger AS $$
BEGIN
  IF OLD.thumbnail_url IS DISTINCT FROM NEW.thumbnail_url THEN
    NEW.thumbnail_version = COALESCE(OLD.thumbnail_version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_tier_template_thumb_version ON public.tier_templates;
CREATE TRIGGER trg_bump_tier_template_thumb_version
  BEFORE UPDATE ON public.tier_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_tier_template_thumb_version();

-- ========== 5) public_contents_list VIEW 재생성 ==========
-- thumbnail_version 추가

DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.thumbnail_version,
    c.updated_at,
    c.category,
    c.tags,
    c.play_count,
    c.created_at,
    CASE
      WHEN c.mode = 'worldcup' THEN (SELECT COUNT(*) FROM worldcup_candidates wc WHERE wc.content_id = c.id)
      WHEN c.mode = 'quiz'     THEN (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.content_id = c.id)
      ELSE 0
    END AS item_count,
    COALESCE(
      (SELECT p.nickname FROM profiles p WHERE p.user_id = c.owner_id LIMIT 1),
      'Unknown'
    ) AS creator_name
  FROM contents c
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.play_count DESC, c.created_at DESC;

-- ========== 6) 기존 데이터 1회성 캐시 버스팅 ==========
-- 썸네일이 있는 기존 콘텐츠의 버전을 2로 올려 즉시 캐시 무효화

UPDATE public.contents
  SET thumbnail_version = 2
  WHERE thumbnail_url IS NOT NULL;

-- ============================================================
-- 완료! 트리거로 thumbnail_url 변경 시 자동 버전 증가됩니다.
-- ============================================================
