-- ============================================================
-- schema_likes.sql — 좋아요(content_likes) 시스템
-- 실행 순서: A→G 순서대로 실행
-- 대상 테이블: contents (worldcup/quiz)
-- ============================================================

BEGIN;

-- ─── A) contents 테이블에 like_count 컬럼 추가 ───
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- ─── B) content_likes 테이블 생성 ───
CREATE TABLE IF NOT EXISTS public.content_likes (
  content_id uuid    NOT NULL,
  user_id    uuid    NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_likes_pkey PRIMARY KEY (content_id, user_id)
);

-- ─── C) FK: 콘텐츠 삭제 시 likes도 CASCADE 삭제 ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'content_likes_content_fk'
      AND table_name = 'content_likes'
  ) THEN
    ALTER TABLE public.content_likes
      ADD CONSTRAINT content_likes_content_fk
      FOREIGN KEY (content_id) REFERENCES public.contents(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- ─── D) 인덱스 ───
CREATE INDEX IF NOT EXISTS idx_content_likes_content
  ON public.content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_user
  ON public.content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_like_count
  ON public.contents(like_count DESC, created_at DESC);

-- ─── E) 백필 (기존 likes → like_count 정합성) ───
UPDATE public.contents c
SET like_count = COALESCE(x.cnt, 0)
FROM (
  SELECT content_id, COUNT(*)::int AS cnt
  FROM public.content_likes
  GROUP BY content_id
) x
WHERE c.id = x.content_id
  AND c.like_count IS DISTINCT FROM COALESCE(x.cnt, 0);

-- likes 없는 콘텐츠는 0 보정
UPDATE public.contents
SET like_count = 0
WHERE like_count IS NULL;

-- ─── F) 트리거 함수 + 트리거 ───
CREATE OR REPLACE FUNCTION public.sync_like_count_inc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contents
  SET like_count = like_count + 1
  WHERE id = NEW.content_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_like_count_dec()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contents
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.content_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_inc ON public.content_likes;
CREATE TRIGGER trg_like_inc
  AFTER INSERT ON public.content_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_like_count_inc();

DROP TRIGGER IF EXISTS trg_like_dec ON public.content_likes;
CREATE TRIGGER trg_like_dec
  AFTER DELETE ON public.content_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_like_count_dec();

-- ─── G) RLS ───
ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: 공개 (피드에서 like_count 표시 필요)
DROP POLICY IF EXISTS "content_likes_select" ON public.content_likes;
CREATE POLICY "content_likes_select"
  ON public.content_likes
  FOR SELECT
  USING (true);

-- INSERT: 로그인 + 본인 user_id만
DROP POLICY IF EXISTS "content_likes_insert_own" ON public.content_likes;
CREATE POLICY "content_likes_insert_own"
  ON public.content_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: 로그인 + 본인 것만
DROP POLICY IF EXISTS "content_likes_delete_own" ON public.content_likes;
CREATE POLICY "content_likes_delete_own"
  ON public.content_likes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- UPDATE 금지 (정책 없으면 기본 거부)
REVOKE UPDATE ON public.content_likes FROM anon, authenticated;

-- ─── H) public_contents_list VIEW 재생성 (like_count 포함) ───
DROP VIEW IF EXISTS public.public_contents_list;
CREATE VIEW public.public_contents_list AS
  SELECT
    c.id,
    c.mode          AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.thumbnail_version,
    c.category,
    c.tags,
    c.play_count,
    c.complete_count,
    c.like_count,
    c.timer_enabled,
    c.item_count,
    c.created_at,
    c.updated_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false);

COMMIT;
