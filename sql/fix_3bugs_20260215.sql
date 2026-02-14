-- ============================================================
-- fix_3bugs_20260215.sql
-- 버그 3건 동시 수정 — Supabase SQL Editor에서 전체 실행
-- 2026-02-15
--
-- [버그1] bump_tier_play_count 404 → 함수 생성
-- [버그2] complete_count 2씩 증가 → 세션 단위 유니크 인덱스
-- [버그3] SET role 에러 → SET search_path로 교체
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1) finish dedup 유니크 인덱스
-- 같은 세션에서 같은 유저가 같은 콘텐츠에 finish를 중복 INSERT 불가
-- ═══════════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS idx_ce_finish_session_dedup
  ON public.content_events (content_id, user_id, event_type, session_id)
  WHERE event_type = 'finish'
    AND user_id IS NOT NULL
    AND session_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 2) auto_increment_complete_count 트리거 함수
-- ★ SET role 제거 → SET search_path = public
-- ★ user_id IS NOT NULL + content_type IN ('worldcup','quiz') 만 +1
-- ★ 유니크 인덱스가 중복 INSERT를 막으므로 트리거는 1번만 실행됨
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'finish'
     AND NEW.user_id IS NOT NULL
     AND NEW.content_type IN ('worldcup', 'quiz')
  THEN
    UPDATE contents
       SET complete_count = complete_count + 1
     WHERE id = NEW.content_id::uuid;
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
-- 3) increment_complete_count RPC — no-op 안전장치
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 4) protect_play_count — contents.play_count/complete_count 보호
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.protect_play_count()
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
-- 5) bump_tier_play_count RPC
-- ★ SET role 없음 — SET search_path = public 만 사용
-- ★ NOT_OWNER 체크 없음 — 로그인 유저 누구든 +1
-- ★ 3분 쿨타임
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS last_play_count_at timestamptz;

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
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_LOGGED_IN');
  END IF;

  SELECT last_play_count_at
    INTO v_last_at
    FROM tier_templates
   WHERE id = p_template_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TEMPLATE_NOT_FOUND');
  END IF;

  IF v_last_at IS NOT NULL AND v_last_at > now() - interval '3 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'COOLDOWN',
      'retry_after', extract(epoch from (v_last_at + interval '3 minutes' - now()))::int);
  END IF;

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
-- 6) 기존 충돌 트리거/함수 제거
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_bump_tier_publish_count ON tier_templates;
DROP FUNCTION IF EXISTS bump_tier_publish_count() CASCADE;

-- ═══════════════════════════════════════════════════════════
-- 7) public_contents_list VIEW 보장
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
