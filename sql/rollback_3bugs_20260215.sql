-- ============================================================
-- rollback_3bugs_20260215.sql
-- fix_3bugs_20260215.sql 롤백
-- ============================================================

BEGIN;

-- 1) 유니크 인덱스 제거
DROP INDEX IF EXISTS idx_ce_finish_session_dedup;

-- 2) auto_increment_complete_count → 단순 버전 (dedup 없음, user_id 체크 없음)
CREATE OR REPLACE FUNCTION public.auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'finish' THEN
    IF NEW.content_type IN ('worldcup', 'quiz') THEN
      UPDATE contents
         SET complete_count = complete_count + 1
       WHERE id = NEW.content_id::uuid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
CREATE TRIGGER trg_auto_increment_complete
  AFTER INSERT ON content_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_complete_count();

-- 3) bump_tier_play_count RPC 제거
DROP FUNCTION IF EXISTS public.bump_tier_play_count(uuid) CASCADE;

-- 4) VIEW 복원 (동일 구조)
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id, c.mode AS type, c.title, c.description,
    c.thumbnail_url, c.thumbnail_version, c.category, c.tags,
    c.play_count, c.complete_count, c.timer_enabled, c.item_count,
    c.created_at, c.updated_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false);

COMMIT;
