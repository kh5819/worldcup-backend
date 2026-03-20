-- ============================================================
-- fix_anon_finish_complete_count.sql
-- 비로그인 유저의 finish 이벤트도 complete_count에 반영
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-03-20
--
-- 변경 사항:
-- 1) auto_increment_complete_count: user_id IS NOT NULL 조건 제거
--    → 비로그인 완주도 complete_count +1
-- 2) 랭킹 포인트(trg_fn_record_ranking_points)는 변경 없음
--    → user_id IS NOT NULL 조건 유지 = 로그인 유저만 포인트
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART A: auto_increment_complete_count 트리거 함수 수정
-- — user_id 조건 제거: 비로그인 finish도 complete_count 증가
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
AS $$
BEGIN
  -- finish 이벤트만 처리 (로그인/비로그인 모두)
  IF NEW.event_type = 'finish' THEN
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
-- PART B: 비로그인 finish dedup 인덱스
-- — session_id 기반 dedup 쿼리 최적화
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ce_dedup_anon_finish
  ON content_events (content_id, event_type, session_id, created_at DESC)
  WHERE user_id IS NULL AND event_type = 'finish';

-- ═══════════════════════════════════════════════════════════
-- PART C: 랭킹 포인트 트리거 확인 (변경 없음, 검증용)
-- — user_id IS NOT NULL 조건이 유지되는지 확인
-- ═══════════════════════════════════════════════════════════

-- 검증: 랭킹 트리거 함수 정의 확인
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'trg_fn_record_ranking_points'
  AND pronamespace = 'public'::regnamespace;

-- ═══════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════

-- 1) auto_increment_complete_count 함수 정의 확인
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

-- 3) 비로그인 finish dedup 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'content_events'
  AND indexname = 'idx_ce_dedup_anon_finish';
