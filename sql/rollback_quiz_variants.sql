-- =========================================================
-- ROLLBACK: schema_quiz_variants.sql
-- 데이터 보존 정책: admin 변형 row가 이미 생성되었을 수 있으므로
--                   컬럼은 남기고 권한/유니크만 원복.
--                   완전 제거가 필요하면 마지막 블록 주석 해제.
-- =========================================================

BEGIN;

-- 1) 트리거 + 함수 제거
DROP TRIGGER IF EXISTS trg_contents_enforce_admin_variant ON public.contents;
DROP FUNCTION IF EXISTS public.enforce_admin_variant();

-- 2) 신규 부분 유니크 인덱스 제거
DROP INDEX IF EXISTS public.uniq_contents_source_tier_variant_admin;
DROP INDEX IF EXISTS public.uniq_contents_source_tier_user;
DROP INDEX IF EXISTS public.idx_contents_tier_variant_lookup;

-- 3) 옛 1:1 UNIQUE 인덱스 복구
--    주의: admin variant row가 이미 생성되어 동일 source_tier_id에 다중 row가
--    존재한다면 이 단계가 실패함. 사전에 admin row 정리 필요.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contents_source_tier
  ON public.contents (source_tier_id)
  WHERE source_tier_id IS NOT NULL;

-- 4) CHECK 제약 제거
ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_variant_type_check;

-- 5) (선택) 컬럼 제거 - 데이터 영구 손실. 기본은 SKIP
-- ALTER TABLE public.contents
--   DROP COLUMN IF EXISTS variant_type,
--   DROP COLUMN IF EXISTS is_admin_variant;

COMMIT;
