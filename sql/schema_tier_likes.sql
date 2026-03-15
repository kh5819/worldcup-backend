-- ============================================================
-- schema_tier_likes.sql — 티어 좋아요 시스템
-- content_likes와 동일 패턴, tier_templates 대상
-- 실행 순서: A→G 순서대로 실행
-- ============================================================

BEGIN;

-- ─── A) tier_templates 테이블에 like_count 컬럼 추가 ───
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- ─── B) tier_template_likes 테이블 생성 ───
CREATE TABLE IF NOT EXISTS public.tier_template_likes (
  template_id uuid    NOT NULL,
  user_id     uuid    NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tier_template_likes_pkey PRIMARY KEY (template_id, user_id)
);

-- ─── C) FK: 템플릿 삭제 시 likes도 CASCADE 삭제 ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tier_template_likes_template_fk'
      AND table_name = 'tier_template_likes'
  ) THEN
    ALTER TABLE public.tier_template_likes
      ADD CONSTRAINT tier_template_likes_template_fk
      FOREIGN KEY (template_id) REFERENCES public.tier_templates(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- ─── D) 인덱스 ───
CREATE INDEX IF NOT EXISTS idx_tier_template_likes_template
  ON public.tier_template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_tier_template_likes_user
  ON public.tier_template_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_templates_like_count
  ON public.tier_templates(like_count DESC, created_at DESC);

-- ─── E) 트리거 함수 + 트리거 ───
CREATE OR REPLACE FUNCTION public.sync_tier_like_count_inc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tier_templates
  SET like_count = like_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tier_like_count_dec()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tier_templates
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.template_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tier_like_inc ON public.tier_template_likes;
CREATE TRIGGER trg_tier_like_inc
  AFTER INSERT ON public.tier_template_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tier_like_count_inc();

DROP TRIGGER IF EXISTS trg_tier_like_dec ON public.tier_template_likes;
CREATE TRIGGER trg_tier_like_dec
  AFTER DELETE ON public.tier_template_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tier_like_count_dec();

-- ─── F) RLS ───
ALTER TABLE public.tier_template_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: 공개
DROP POLICY IF EXISTS "tier_template_likes_select" ON public.tier_template_likes;
CREATE POLICY "tier_template_likes_select"
  ON public.tier_template_likes
  FOR SELECT
  USING (true);

-- INSERT: 로그인 + 본인 user_id만
DROP POLICY IF EXISTS "tier_template_likes_insert_own" ON public.tier_template_likes;
CREATE POLICY "tier_template_likes_insert_own"
  ON public.tier_template_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: 로그인 + 본인 것만
DROP POLICY IF EXISTS "tier_template_likes_delete_own" ON public.tier_template_likes;
CREATE POLICY "tier_template_likes_delete_own"
  ON public.tier_template_likes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- UPDATE 금지
REVOKE UPDATE ON public.tier_template_likes FROM anon, authenticated;

COMMIT;
