-- ============================================================
-- hotfix_set_role_error.sql
-- 긴급: "cannot set parameter 'role' within security-definer function" 해결
-- Supabase SQL Editor에서 즉시 실행
-- 2026-02-15
--
-- 원인: auto_increment_complete_count() 함수에 "SET role = 'service_role'" 있음
--       → Supabase에서 SECURITY DEFINER 함수 내 SET role 금지
-- 해결: SET role 제거, SET search_path = public 으로 대체
--       SECURITY DEFINER만으로 함수 소유자(postgres) 권한으로 실행됨
-- ============================================================

-- ★ 이것만 실행하면 /events INSERT 즉시 복구됨
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- finish + 로그인 유저만 complete_count +1
  IF NEW.event_type = 'finish' AND NEW.user_id IS NOT NULL THEN
    IF NEW.content_type IN ('worldcup', 'quiz') THEN
      UPDATE contents
         SET complete_count = complete_count + 1
       WHERE id = NEW.content_id::uuid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거 재연결 (안전)
DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
CREATE TRIGGER trg_auto_increment_complete
  AFTER INSERT ON content_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_complete_count();

-- 검증: 함수 정의에 SET role 없는지 확인
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'auto_increment_complete_count'
  AND pronamespace = 'public'::regnamespace;
