-- ============================================================
-- fix_complete_count.sql — 완주수 증가 회귀 복구
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-02-14
--
-- 가설1: trg_protect_play_count가 complete_count도 막고 있음
-- 가설2: increment_complete_count RPC가 없거나, content_events insert가 안됨
-- 가설3: public_contents_list 뷰에 complete_count가 없어서 안 보임
--
-- 이 SQL은 3가지 모두를 한번에 해결한다.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART A: contents.complete_count 컬럼 보장
-- ═══════════════════════════════════════════════════════════
ALTER TABLE contents ADD COLUMN IF NOT EXISTS complete_count bigint NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════
-- PART B: trg_protect_play_count 수정
-- — play_count + complete_count 둘 다 보호하되,
--   service_role / postgres / supabase_admin은 허용
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION protect_play_count()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role(또는 postgres)이 아니면 play_count/complete_count 변경 무시
  IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.play_count := OLD.play_count;
    NEW.complete_count := OLD.complete_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (이미 존재하면 교체)
DROP TRIGGER IF EXISTS trg_protect_play_count ON contents;
CREATE TRIGGER trg_protect_play_count
  BEFORE UPDATE ON contents
  FOR EACH ROW
  EXECUTE FUNCTION protect_play_count();

-- ═══════════════════════════════════════════════════════════
-- PART C: increment_complete_count RPC 재생성
-- — SECURITY DEFINER로 service_role 권한으로 실행
-- — 티어는 tier_templates에 complete_count가 없으므로 무시(no-op)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
AS $$
BEGIN
  IF p_content_type IN ('worldcup', 'quiz') THEN
    UPDATE contents
       SET complete_count = complete_count + 1
     WHERE id = p_content_id::uuid;
  END IF;
  -- 티어는 play_count(저장/발행 수)를 사용하므로 여기서 처리하지 않음
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART D: content_events AFTER INSERT 트리거
-- — POST /events에서 finish insert 성공 시 자동으로 complete_count +1
-- — 백엔드 RPC 호출 실패에 대한 안전망 (이중 증가 방지 포함)
-- ═══════════════════════════════════════════════════════════
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
    -- 티어 finish는 여기서 무시 (play_count는 count_tier_play RPC가 담당)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
CREATE TRIGGER trg_auto_increment_complete
  AFTER INSERT ON content_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_complete_count();

-- ═══════════════════════════════════════════════════════════
-- PART E: 백엔드 RPC 중복 증가 방지
-- — PART D 트리거가 자동으로 올리므로, 백엔드 RPC 호출은 제거해야 함
-- — 하지만 RPC 함수는 남겨두되 no-op으로 만듦 (호출해도 이중 증가 안됨)
-- — ※ 주의: 이 SQL 실행 후 백엔드 코드에서 RPC 호출을 제거해야 함
-- ═══════════════════════════════════════════════════════════

-- increment_complete_count를 no-op으로 교체
-- (트리거가 이미 증가시키므로 RPC가 또 올리면 이중 증가)
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- no-op: content_events INSERT 트리거(trg_auto_increment_complete)가 자동 처리
  -- 백엔드 코드에서 이 RPC 호출을 제거한 뒤, 이 함수도 DROP 가능
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART F: public_contents_list VIEW 재생성
-- — complete_count 포함, 정렬은 complete_count DESC
-- ═══════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.thumbnail_version,
    c.category,
    c.tags,
    c.play_count,
    c.complete_count,
    c.timer_enabled,
    c.item_count,
    c.created_at,
    c.updated_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.complete_count DESC, c.created_at DESC;

-- ═══════════════════════════════════════════════════════════
-- PART G: 기존 데이터 백필 (content_events → complete_count 동기화)
-- ═══════════════════════════════════════════════════════════
UPDATE contents SET complete_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT content_id, COUNT(*) as cnt
  FROM content_events
  WHERE event_type = 'finish' AND content_type IN ('worldcup', 'quiz')
  GROUP BY content_id
) sub
WHERE contents.id::text = sub.content_id
  AND contents.complete_count IS DISTINCT FROM COALESCE(sub.cnt, 0);

-- ═══════════════════════════════════════════════════════════
-- PART H: dedup 인덱스
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ce_dedup_user
  ON content_events (content_id, event_type, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 검증
-- ═══════════════════════════════════════════════════════════

-- 1) 트리거 확인
SELECT tgname, pg_get_triggerdef(t.oid, true) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname IN ('contents', 'content_events')
  AND NOT t.tgisinternal;

-- 2) 함수 확인
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname IN ('protect_play_count', 'increment_complete_count', 'auto_increment_complete_count')
  AND pronamespace = 'public'::regnamespace;

-- 3) complete_count 상태
SELECT id, title, play_count, complete_count
FROM contents
WHERE play_count > 0 OR complete_count > 0
ORDER BY complete_count DESC
LIMIT 10;
