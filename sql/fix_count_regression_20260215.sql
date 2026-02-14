-- ============================================================
-- fix_count_regression_20260215.sql  (v2 — 최종본)
-- 집계 회귀 복구 + "제작자만 제한" 제거
-- Supabase Dashboard > SQL Editor 에서 전체 실행
-- 2026-02-15
--
-- 정책:
--   월드컵/퀴즈: 로그인 유저 finish → complete_count +1 (3분 dedup)
--   티어: 로그인 유저 저장/발행 → play_count +1 (3분 쿨타임)
--   익명 = 카운트 0, 제작자만 제한 없음 (누구든 +1)
--
-- 변경 PART:
--   A) auto_increment_complete_count 트리거 (3분 dedup 내장)
--   B) increment_complete_count RPC (no-op 안전장치)
--   C) protect_play_count 트리거 (contents.play_count/complete_count 보호)
--   D) bump_tier_play_count RPC (NOT_OWNER 제거, 3분 쿨타임)
--   E) 기존 trg_bump_tier_publish_count 트리거 제거
--   F) public_contents_list VIEW 보장 (기존과 동일 구조 유지)
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- PART A: content_events AFTER INSERT 트리거
-- 조건: event_type='finish' AND user_id IS NOT NULL
--       AND content_type IN ('worldcup','quiz')
-- 3분 dedup: 같은 user_id + content_id에 3분 내 finish가 또 있으면 skip
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_exists boolean;
BEGIN
  -- finish + 로그인 유저만
  IF NEW.event_type = 'finish' AND NEW.user_id IS NOT NULL THEN
    IF NEW.content_type IN ('worldcup', 'quiz') THEN
      -- 3분 dedup: 같은 user_id + content_id + finish가 3분 내 존재하면 skip
      SELECT EXISTS(
        SELECT 1 FROM content_events
        WHERE content_id = NEW.content_id
          AND event_type = 'finish'
          AND user_id = NEW.user_id
          AND id != NEW.id
          AND created_at > now() - interval '3 minutes'
      ) INTO v_recent_exists;

      IF NOT v_recent_exists THEN
        UPDATE contents
           SET complete_count = complete_count + 1
         WHERE id = NEW.content_id::uuid;
      END IF;
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

-- ═══════════════════════════════════════════════════════════
-- PART B: increment_complete_count RPC — no-op (안전장치)
-- 혹시 어딘가에서 직접 호출해도 이중 증가 방지
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- no-op: 트리거가 자동 처리
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART C: protect_play_count — play_count + complete_count 보호
-- service_role / postgres / supabase_admin 만 변경 허용
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
-- PART D: bump_tier_play_count RPC
-- ★ NOT_OWNER 제거 — 로그인한 유저 누구든 +1
-- ★ 3분 쿨타임: template_id 단위, last_play_count_at 기준
-- ★ SECURITY DEFINER — RLS 우회하여 직접 UPDATE
-- ═══════════════════════════════════════════════════════════

-- D-1) 쿨타임 추적 컬럼 보장
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS last_play_count_at timestamptz;

-- D-2) RPC 함수
CREATE OR REPLACE FUNCTION public.bump_tier_play_count(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_last_at timestamptz;
  v_new_count bigint;
BEGIN
  -- 1) 로그인 확인
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_LOGGED_IN');
  END IF;

  -- 2) 템플릿 존재 확인 + 쿨타임 조회
  SELECT last_play_count_at
    INTO v_last_at
    FROM tier_templates
   WHERE id = p_template_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TEMPLATE_NOT_FOUND');
  END IF;

  -- ★ NOT_OWNER 체크 없음 — 로그인 유저 누구든 카운트 가능

  -- 3) 3분 쿨타임
  IF v_last_at IS NOT NULL AND v_last_at > now() - interval '3 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'COOLDOWN',
      'retry_after', extract(epoch from (v_last_at + interval '3 minutes' - now()))::int);
  END IF;

  -- 4) play_count +1
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
-- PART E: 기존 충돌 트리거/함수 제거
-- trg_bump_tier_publish_count 가 play_count를 이중으로 건드릴 수 있음
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_bump_tier_publish_count ON tier_templates;
DROP FUNCTION IF EXISTS bump_tier_publish_count() CASCADE;

-- ═══════════════════════════════════════════════════════════
-- PART F: public_contents_list VIEW
-- 기존 필드 유지 + complete_count 포함
-- ★ 정렬은 VIEW에서 하지 않음 (백엔드 .order() 가 결정)
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
    AND (c.is_hidden IS NULL OR c.is_hidden = false);

COMMIT;
