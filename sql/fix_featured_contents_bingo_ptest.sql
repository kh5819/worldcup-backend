-- ============================================================
-- fix_featured_contents_bingo_ptest.sql
-- featured_contents.content_type CHECK 제약에 bingo/ptest 추가
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-05-20
--
-- 배경:
--   기존 schema_explore.sql 의 featured_contents CHECK는
--   ('worldcup','quiz','tier')만 허용 → 운영자가 추천에 빙고/심리 등록 불가
--   /explore/featured 엔드포인트는 이미 빙고/심리 enrich 지원.
--   CHECK만 풀면 /admin/featured POST에서 등록 가능
-- ============================================================

BEGIN;

-- 1) 기존 CHECK 제약 제거 (이름 자동 부여: featured_contents_content_type_check)
ALTER TABLE public.featured_contents
  DROP CONSTRAINT IF EXISTS featured_contents_content_type_check;

-- 2) 확장된 CHECK 재추가
ALTER TABLE public.featured_contents
  ADD CONSTRAINT featured_contents_content_type_check
  CHECK (content_type IN ('worldcup', 'quiz', 'tier', 'bingo', 'ptest'));

COMMIT;

-- ============================================================
-- 검증 쿼리
-- ============================================================
-- 1) CHECK 정의 확인
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.featured_contents'::regclass
  AND contype = 'c';

-- 2) bingo 등록 테스트 (수동)
-- INSERT INTO public.featured_contents (content_id, content_type, sort_order, memo, is_active)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'bingo', 0, 'test', false);
-- DELETE FROM public.featured_contents WHERE memo = 'test';
