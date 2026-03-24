-- ============================================================
-- 티어 댓글 대댓글(답글) 지원: parent_id 컬럼 추가
-- 실행 대상: Supabase SQL Editor (한 번만 실행)
-- ============================================================

-- 1) parent_id 컬럼 추가 (NULL = 부모 댓글, NOT NULL = 답글)
ALTER TABLE public.tier_instance_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.tier_instance_comments(id) ON DELETE CASCADE
    DEFAULT NULL;

-- 2) 답글 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_tier_comments_parent
  ON public.tier_instance_comments(parent_id)
  WHERE parent_id IS NOT NULL;

-- 3) 답글의 답글 방지 트리거 (1단계 답글만 허용)
CREATE OR REPLACE FUNCTION fn_tier_comment_no_nested_reply()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tier_instance_comments
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'nested replies not allowed (max 1 depth)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tier_comment_no_nested_reply ON public.tier_instance_comments;
CREATE TRIGGER trg_tier_comment_no_nested_reply
  BEFORE INSERT ON public.tier_instance_comments
  FOR EACH ROW
  EXECUTE FUNCTION fn_tier_comment_no_nested_reply();
