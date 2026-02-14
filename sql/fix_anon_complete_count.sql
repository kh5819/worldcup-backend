-- ============================================================
-- fix_anon_complete_count.sql
-- 익명(비로그인) 유저의 finish 이벤트로 complete_count가
-- 증가하지 않도록 수정
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-02-15
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART A: auto_increment_complete_count 트리거 함수 수정
-- — NEW.user_id IS NOT NULL 조건 추가
-- — 익명(user_id=NULL) finish 이벤트는 카운트 증가 안 함
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
AS $$
BEGIN
  -- finish 이벤트 + 로그인 유저만 처리
  IF NEW.event_type = 'finish' AND NEW.user_id IS NOT NULL THEN
    IF NEW.content_type IN ('worldcup', 'quiz') THEN
      UPDATE contents
         SET complete_count = complete_count + 1
       WHERE id = NEW.content_id::uuid;
    END IF;
    -- 티어 finish는 여기서 무시 (play_count는 bump_tier_publish_count RPC가 담당)
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거 재생성 (안전하게 DROP + CREATE)
DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
CREATE TRIGGER trg_auto_increment_complete
  AFTER INSERT ON content_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_complete_count();

-- ═══════════════════════════════════════════════════════════
-- PART B: increment_complete_count RPC도 동일하게 보호
-- — 현재 no-op이지만, 혹시 호출되더라도 auth.uid() 체크
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- no-op: content_events INSERT 트리거가 자동 처리
  -- 혹시 직접 호출되더라도 로그인 유저만 허용
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  -- 트리거가 이미 처리하므로 여기서는 아무것도 안 함
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════

-- 1) 트리거 함수 정의 확인
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'auto_increment_complete_count'
  AND pronamespace = 'public'::regnamespace;

-- 2) 트리거 확인
SELECT tgname, pg_get_triggerdef(t.oid, true) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'content_events'
  AND NOT t.tgisinternal;

-- 3) 최근 익명 finish 이벤트 확인 (이 이벤트들은 이제 카운트에 반영 안 됨)
SELECT id, content_id, content_type, event_type, user_id, session_id, created_at
FROM content_events
WHERE event_type = 'finish' AND user_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 4) 특정 콘텐츠 complete_count 상태 확인
SELECT id, title, play_count, complete_count
FROM contents
WHERE play_count > 0 OR complete_count > 0
ORDER BY complete_count DESC
LIMIT 10;
