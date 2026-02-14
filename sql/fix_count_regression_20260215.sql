-- ============================================================
-- fix_count_regression_20260215.sql
-- 집계(완주수/저장·발행수) 회귀 복구 — 통합 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-02-15
--
-- 변경 내용:
-- PART A: auto_increment_complete_count 트리거 — user_id 필수
-- PART B: increment_complete_count RPC — no-op + auth 가드
-- PART C: protect_play_count — complete_count도 보호
-- PART D: bump_tier_play_count RPC — 3분 쿨타임 신규 생성
-- PART E: 기존 trg_bump_tier_publish_count 트리거 제거 (충돌 방지)
-- PART F: public_contents_list VIEW 재생성
-- PART G: 검증 쿼리
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- PART A: content_events AFTER INSERT 트리거 — 로그인 유저만
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET role = 'service_role'
AS $$
BEGIN
  -- finish + 로그인 유저(user_id NOT NULL)만 complete_count +1
  IF NEW.event_type = 'finish' AND NEW.user_id IS NOT NULL THEN
    IF NEW.content_type IN ('worldcup', 'quiz') THEN
      UPDATE contents
         SET complete_count = complete_count + 1
       WHERE id = NEW.content_id::uuid;
    END IF;
    -- 티어 finish는 무시 (play_count는 bump_tier_play_count RPC가 담당)
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
-- PART B: increment_complete_count RPC — no-op (안전장치)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- no-op: 트리거가 자동 처리. 혹시 호출돼도 아무것도 안 함.
  IF auth.uid() IS NULL THEN RETURN; END IF;
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART C: protect_play_count — play_count + complete_count 보호
-- service_role/postgres/supabase_admin만 변경 허용
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION protect_play_count()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.play_count := OLD.play_count;
    NEW.complete_count := OLD.complete_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_play_count ON contents;
CREATE TRIGGER trg_protect_play_count
  BEFORE UPDATE ON contents
  FOR EACH ROW
  EXECUTE FUNCTION protect_play_count();

-- ═══════════════════════════════════════════════════════════
-- PART D: bump_tier_play_count RPC — 3분 쿨타임
-- 티어 "저장/발행" 시 프론트에서 호출
-- ═══════════════════════════════════════════════════════════

-- D-1) last_play_count_at 컬럼 추가 (쿨타임 추적용)
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS last_play_count_at timestamptz;

-- D-2) RPC 함수 생성
CREATE OR REPLACE FUNCTION public.bump_tier_play_count(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_creator_id uuid;
  v_last_at timestamptz;
  v_new_count bigint;
BEGIN
  -- 1) 로그인 확인
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_LOGGED_IN');
  END IF;

  -- 2) 템플릿 존재 + creator 확인
  SELECT creator_id, last_play_count_at
    INTO v_creator_id, v_last_at
    FROM tier_templates
   WHERE id = p_template_id;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TEMPLATE_NOT_FOUND');
  END IF;

  IF v_creator_id != v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_OWNER');
  END IF;

  -- 3) 3분 쿨타임 체크
  IF v_last_at IS NOT NULL AND v_last_at > now() - interval '3 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'COOLDOWN',
      'retry_after', extract(epoch from (v_last_at + interval '3 minutes' - now()))::int);
  END IF;

  -- 4) play_count +1, last_play_count_at 갱신
  UPDATE tier_templates
     SET play_count = COALESCE(play_count, 0) + 1,
         last_play_count_at = now()
   WHERE id = p_template_id
  RETURNING play_count INTO v_new_count;

  RETURN jsonb_build_object('ok', true, 'play_count', v_new_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_tier_play_count(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- PART E: 기존 충돌 트리거 제거
-- trg_bump_tier_publish_count가 존재하면 play_count를 이중으로
-- 건드릴 수 있으므로 안전하게 제거
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_bump_tier_publish_count ON tier_templates;
-- 함수도 정리 (존재하면)
DROP FUNCTION IF EXISTS bump_tier_publish_count() CASCADE;

-- ═══════════════════════════════════════════════════════════
-- PART F: public_contents_list VIEW 재생성
-- complete_count 포함, complete_count DESC 정렬
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

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- PART G: 검증 쿼리 (COMMIT 후 별도 실행)
-- ═══════════════════════════════════════════════════════════

-- G-1) content_events 트리거 확인
SELECT tgname, pg_get_triggerdef(t.oid, true) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'content_events' AND NOT t.tgisinternal;

-- G-2) contents 트리거 확인
SELECT tgname, pg_get_triggerdef(t.oid, true) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'contents' AND NOT t.tgisinternal;

-- G-3) tier_templates 트리거 확인 (trg_bump_tier_publish_count 없어야 함)
SELECT tgname, pg_get_triggerdef(t.oid, true) AS def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'tier_templates' AND NOT t.tgisinternal;

-- G-4) auto_increment_complete_count 함수 정의
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'auto_increment_complete_count'
  AND pronamespace = 'public'::regnamespace;

-- G-5) bump_tier_play_count 함수 정의
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'bump_tier_play_count'
  AND pronamespace = 'public'::regnamespace;

-- G-6) tier_templates에 last_play_count_at 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tier_templates'
  AND column_name IN ('play_count', 'last_play_count_at');

-- G-7) 최근 complete_count 상위 콘텐츠
SELECT id, title, play_count, complete_count
FROM contents
WHERE complete_count > 0
ORDER BY complete_count DESC
LIMIT 10;

-- G-8) 최근 finish 이벤트 (익명 vs 로그인)
SELECT
  event_type,
  CASE WHEN user_id IS NULL THEN 'anon' ELSE 'logged_in' END AS auth_status,
  count(*)
FROM content_events
WHERE event_type = 'finish'
  AND created_at > now() - interval '7 days'
GROUP BY 1, 2;
