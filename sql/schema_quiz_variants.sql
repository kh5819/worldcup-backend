-- =========================================================
-- DUO: Quiz Variants 마이그레이션 (2026-05-04)
-- 목적: 관리자가 동일 tier에서 variant별 다중 quiz 생성 가능
--       일반 유저는 기존 1:1 동작 유지
--
-- 실행:
--   Supabase SQL Editor 에서 한 번에 실행 (트랜잭션)
--   실패 시 자동 ROLLBACK
--
-- 검증:
--   COMMIT 직후 본 파일 하단 SELECT 들을 실행하여 무결성 확인
--
-- 롤백:
--   rollback_quiz_variants.sql 사용
-- =========================================================

BEGIN;

-- 0) 안전장치: 사전 상태 검증
DO $$
DECLARE
  v_unique_count int;
BEGIN
  SELECT count(*) INTO v_unique_count
  FROM pg_indexes
  WHERE schemaname='public'
    AND tablename='contents'
    AND indexname='idx_contents_source_tier';

  IF v_unique_count = 0 THEN
    RAISE EXCEPTION 'Pre-check failed: idx_contents_source_tier 인덱스가 없음. 사전 상태가 다름. 중단.';
  END IF;
END $$;

-- 1) 컬럼 추가 (둘 다 nullable / default → 기존 row 영향 없음)
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS variant_type     text,
  ADD COLUMN IF NOT EXISTS is_admin_variant boolean NOT NULL DEFAULT false;

-- 2) variant_type CHECK (NULL 허용)
ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_variant_type_check;
ALTER TABLE public.contents
  ADD CONSTRAINT contents_variant_type_check
  CHECK (
    variant_type IS NULL
    OR variant_type = ANY (ARRAY['multiple_choice','short_answer','silhouette'])
  );

-- 3) 기존 1:1 UNIQUE 인덱스 제거
--    (idx_contents_source_tier_lookup 일반 인덱스는 그대로 유지)
DROP INDEX IF EXISTS public.idx_contents_source_tier;

-- 4) 일반 유저용 1:1 강제 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contents_source_tier_user
  ON public.contents (source_tier_id)
  WHERE source_tier_id IS NOT NULL AND is_admin_variant = false;

-- 5) 관리자용 (tier, variant) 단위 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contents_source_tier_variant_admin
  ON public.contents (source_tier_id, variant_type)
  WHERE source_tier_id IS NOT NULL AND is_admin_variant = true;

-- 6) admin variant 권한 강제 트리거 (RLS와 belt+suspenders)
CREATE OR REPLACE FUNCTION public.enforce_admin_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_admin_variant = true AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can create admin variant quizzes'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.is_admin_variant = true AND NEW.variant_type IS NULL THEN
      RAISE EXCEPTION 'is_admin_variant=true requires variant_type'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.is_admin_variant = true AND NEW.source_tier_id IS NULL THEN
      RAISE EXCEPTION 'is_admin_variant=true requires source_tier_id'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.is_admin_variant = true OR OLD.is_admin_variant = true)
       AND NOT public.is_admin()
       AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Insufficient privilege to modify admin variant row'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.variant_type IS DISTINCT FROM OLD.variant_type
       AND NEW.is_admin_variant = false
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Non-admin cannot change variant_type'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contents_enforce_admin_variant ON public.contents;
CREATE TRIGGER trg_contents_enforce_admin_variant
  BEFORE INSERT OR UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_variant();

-- 7) lookup 성능 인덱스 (variant 조회 가속)
CREATE INDEX IF NOT EXISTS idx_contents_tier_variant_lookup
  ON public.contents (source_tier_id, variant_type)
  WHERE source_tier_id IS NOT NULL;

COMMIT;

-- =========================================================
-- 검증 SQL (마이그레이션 직후 실행)
-- =========================================================

-- a) 컬럼 추가 확인 (기대: 2 rows)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='contents'
  AND column_name IN ('variant_type','is_admin_variant');

-- b) 인덱스 상태 (기대: 3 rows)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='contents'
  AND indexname IN (
    'uniq_contents_source_tier_user',
    'uniq_contents_source_tier_variant_admin',
    'idx_contents_tier_variant_lookup'
  );

-- c) 옛 1:1 UNIQUE 제거 확인 (기대: 0)
SELECT count(*) AS legacy_idx_count
FROM pg_indexes
WHERE schemaname='public' AND tablename='contents'
  AND indexname='idx_contents_source_tier';

-- d) 기존 데이터 무결성 (기대: legacy_rows = legacy_safe = legacy_variant_null = 197)
SELECT count(*) AS legacy_rows,
       count(*) FILTER (WHERE is_admin_variant = false) AS legacy_safe,
       count(*) FILTER (WHERE variant_type IS NULL) AS legacy_variant_null
FROM public.contents
WHERE source_tier_id IS NOT NULL;

-- e) 트리거 확인 (기대: 1 row)
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname='trg_contents_enforce_admin_variant';

-- f) CHECK 확인 (기대: 1 row, multiple_choice/short_answer/silhouette 포함)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname='contents_variant_type_check';
