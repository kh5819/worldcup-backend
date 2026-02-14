-- ============================================================
-- rollback_count_regression_20260215.sql
-- fix_count_regression_20260215.sql 롤백
-- ============================================================

BEGIN;

-- PART A 롤백: auto_increment_complete_count → user_id 체크 없는 원래 버전
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
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

-- PART B 롤백: increment_complete_count → 원래 no-op
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NULL;
END;
$$;

-- PART D 롤백: bump_tier_play_count RPC 제거
DROP FUNCTION IF EXISTS public.bump_tier_play_count(uuid) CASCADE;
-- last_play_count_at 컬럼은 남겨둠 (데이터 유실 방지, 필요시 수동 삭제)

COMMIT;
