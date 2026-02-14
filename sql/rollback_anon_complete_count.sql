-- ============================================================
-- rollback_anon_complete_count.sql
-- fix_anon_complete_count.sql 롤백 — 이전 상태로 복원
-- (익명 finish도 complete_count 증가하는 원래 동작으로 복귀)
-- ============================================================

-- PART A: auto_increment_complete_count → 원래 버전 (user_id 체크 없음)
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
AS $$
BEGIN
  -- finish 이벤트만 처리
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

-- 트리거 재생성
DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
CREATE TRIGGER trg_auto_increment_complete
  AFTER INSERT ON content_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_complete_count();

-- PART B: increment_complete_count → 원래 no-op (auth.uid 체크 없음)
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- no-op: content_events INSERT 트리거가 자동 처리
  NULL;
END;
$$;
