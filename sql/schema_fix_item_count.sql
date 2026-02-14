-- ============================================================
-- schema_fix_item_count.sql — item_count 실체 컬럼 추가 + 백필 + 트리거
-- Supabase Dashboard > SQL Editor 에서 전체 실행
-- 2026-02-15
--
-- 문제: public_contents_list VIEW가 c.item_count 참조하지만
--       contents 테이블에 item_count 컬럼이 없어서 항상 NULL → "약 1~3분"
-- 해결: 실체 컬럼 추가 + 기존 데이터 백필 + INSERT/DELETE 트리거
-- ============================================================

BEGIN;

-- ─── A) contents 테이블에 item_count 컬럼 추가 ───
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS item_count integer NOT NULL DEFAULT 0;

-- ─── B) 백필: worldcup_candidates → item_count ───
UPDATE public.contents c
SET item_count = COALESCE(x.cnt, 0)
FROM (
  SELECT content_id, COUNT(*)::int AS cnt
  FROM public.worldcup_candidates
  GROUP BY content_id
) x
WHERE c.id = x.content_id
  AND c.mode = 'worldcup';

-- ─── C) 백필: quiz_questions → item_count ───
UPDATE public.contents c
SET item_count = COALESCE(x.cnt, 0)
FROM (
  SELECT content_id, COUNT(*)::int AS cnt
  FROM public.quiz_questions
  GROUP BY content_id
) x
WHERE c.id = x.content_id
  AND c.mode = 'quiz';

-- ─── D) 트리거 함수: item_count 자동 동기화 ───
CREATE OR REPLACE FUNCTION public.sync_item_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contents SET item_count = item_count + 1
     WHERE id = NEW.content_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contents SET item_count = GREATEST(item_count - 1, 0)
     WHERE id = OLD.content_id;
    RETURN OLD;
  ELSIF TG_OP = 'TRUNCATE' THEN
    -- TRUNCATE 시 전체 리카운트 (안전장치)
    UPDATE contents c
    SET item_count = 0
    WHERE c.mode IN ('worldcup', 'quiz');
    RETURN NULL;
  END IF;
  RETURN NULL;
END;
$$;

-- ─── E) worldcup_candidates 트리거 ───
DROP TRIGGER IF EXISTS trg_sync_item_count_wc_ins ON public.worldcup_candidates;
CREATE TRIGGER trg_sync_item_count_wc_ins
  AFTER INSERT ON public.worldcup_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_count();

DROP TRIGGER IF EXISTS trg_sync_item_count_wc_del ON public.worldcup_candidates;
CREATE TRIGGER trg_sync_item_count_wc_del
  AFTER DELETE ON public.worldcup_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_count();

-- ─── F) quiz_questions 트리거 ───
DROP TRIGGER IF EXISTS trg_sync_item_count_qq_ins ON public.quiz_questions;
CREATE TRIGGER trg_sync_item_count_qq_ins
  AFTER INSERT ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_count();

DROP TRIGGER IF EXISTS trg_sync_item_count_qq_del ON public.quiz_questions;
CREATE TRIGGER trg_sync_item_count_qq_del
  AFTER DELETE ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_count();

-- ─── G) VIEW는 이미 c.item_count 참조 중이므로 변경 불필요 ───
-- public_contents_list VIEW에 c.item_count 이미 포함됨
-- (schema_likes.sql, fix_count_regression_20260215.sql 등)

COMMIT;
