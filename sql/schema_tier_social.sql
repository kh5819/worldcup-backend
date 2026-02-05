-- ============================================================
-- DUO 티어메이커 소셜 기능: 투표 + 댓글 테이블
-- 실행 순서: schema_tier.sql 이후
-- ============================================================

-- 1a. tier_instances SELECT RLS 업데이트
--     기존: 자기 것만 조회 → 변경: 자기 것 OR published
DROP POLICY IF EXISTS "tier_instances_select_own" ON public.tier_instances;
CREATE POLICY "tier_instances_select_own_or_published"
  ON public.tier_instances FOR SELECT
  USING (user_id = auth.uid() OR status = 'published');

-- ============================================================
-- 1b. tier_instance_votes (투표)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tier_instance_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES public.tier_instances(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  vote_type    text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

ALTER TABLE public.tier_instance_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나
CREATE POLICY "tier_votes_select_all"
  ON public.tier_instance_votes FOR SELECT
  USING (true);

-- INSERT: 로그인 유저, 자기 user_id만
CREATE POLICY "tier_votes_insert_own"
  ON public.tier_instance_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 자기 투표만
CREATE POLICY "tier_votes_update_own"
  ON public.tier_instance_votes FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: 자기 투표만
CREATE POLICY "tier_votes_delete_own"
  ON public.tier_instance_votes FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 1c. tier_instance_comments (댓글)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tier_instance_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES public.tier_instances(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  author_name  text NOT NULL,
  body         text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 200),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tier_instance_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나
CREATE POLICY "tier_comments_select_all"
  ON public.tier_instance_comments FOR SELECT
  USING (true);

-- INSERT: 로그인 유저, 자기 user_id만
CREATE POLICY "tier_comments_insert_own"
  ON public.tier_instance_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: 자기 댓글만
CREATE POLICY "tier_comments_delete_own"
  ON public.tier_instance_comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 1d. tier_instances에 카운트 컬럼 추가
-- ============================================================
ALTER TABLE public.tier_instances
  ADD COLUMN IF NOT EXISTS vote_up_count   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vote_down_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count   int NOT NULL DEFAULT 0;

-- ============================================================
-- 1e. 투표 카운트 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_tier_vote_count_update()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.tier_instances SET
      vote_up_count   = (SELECT count(*) FROM public.tier_instance_votes WHERE instance_id = NEW.instance_id AND vote_type = 'up'),
      vote_down_count = (SELECT count(*) FROM public.tier_instance_votes WHERE instance_id = NEW.instance_id AND vote_type = 'down')
    WHERE id = NEW.instance_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tier_instances SET
      vote_up_count   = (SELECT count(*) FROM public.tier_instance_votes WHERE instance_id = OLD.instance_id AND vote_type = 'up'),
      vote_down_count = (SELECT count(*) FROM public.tier_instance_votes WHERE instance_id = OLD.instance_id AND vote_type = 'down')
    WHERE id = OLD.instance_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tier_vote_count ON public.tier_instance_votes;
CREATE TRIGGER trg_tier_vote_count
  AFTER INSERT OR UPDATE OR DELETE ON public.tier_instance_votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_tier_vote_count_update();

-- ============================================================
-- 1f. 댓글 카운트 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_tier_comment_count_update()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tier_instances SET
      comment_count = (SELECT count(*) FROM public.tier_instance_comments WHERE instance_id = NEW.instance_id)
    WHERE id = NEW.instance_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tier_instances SET
      comment_count = (SELECT count(*) FROM public.tier_instance_comments WHERE instance_id = OLD.instance_id)
    WHERE id = OLD.instance_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tier_comment_count ON public.tier_instance_comments;
CREATE TRIGGER trg_tier_comment_count
  AFTER INSERT OR DELETE ON public.tier_instance_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_tier_comment_count_update();
