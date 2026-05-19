-- ============================================================
-- DUO: Bingo Schema (schema_bingo.sql)
-- - 새 카테고리 "테스트" 1번째 콘텐츠: 빙고
-- - 기존 테이블 수정 없음 (bingo_ prefix 신규만)
-- - 기존 패턴(tier_templates, contents) 일관성 맞춤:
--     · is_hidden + hidden_reason
--     · report_count, complete_count (bigint)
--     · play_count (bigint), thumbnail_version (bigint, default 1)
--     · 공용 touch_updated_at() 재사용
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) bingos: 빙고 콘텐츠 (메인)
-- ============================================================
-- 자유도 슬롯: cells JSONB 배열로 칸별 데이터 보존
-- 슬롯 크기 변경(3x3→5x5)에도 idx 기반 데이터 그대로 유지
CREATE TABLE IF NOT EXISTS public.bingos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        uuid        NOT NULL,
  title             text        NOT NULL,
  description       text,
  tags              text[]      NOT NULL DEFAULT '{}'::text[],
  thumbnail_url     text,
  thumbnail_version bigint      NOT NULL DEFAULT 1,

  -- 보드 설정
  size              int         NOT NULL DEFAULT 25
                                CHECK (size IN (9, 16, 25)),
  -- cells: [{idx, text, image_url, image_fit, bg_type, bg_value, text_color, font_weight}, ...]
  cells             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- theme: 전역 테마 키 (light/dark/neon/pastel/y2k/...)
  theme             text        NOT NULL DEFAULT 'light',
  -- bg: 전역 배경 {type: "color"|"gradient"|"image", value: "...", image_url: "..."}
  bg                jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- 공개/상태
  visibility        text        NOT NULL DEFAULT 'public'
                                CHECK (visibility IN ('public', 'private', 'unlisted')),
  status            text        NOT NULL DEFAULT 'published'
                                CHECK (status IN ('draft', 'published')),

  -- 집계 (기존 패턴 일치)
  play_count        bigint      NOT NULL DEFAULT 0,
  complete_count    bigint      NOT NULL DEFAULT 0,
  share_count       bigint      NOT NULL DEFAULT 0,
  like_count        int         NOT NULL DEFAULT 0,
  comment_count     int         NOT NULL DEFAULT 0,
  report_count      int         NOT NULL DEFAULT 0,

  -- 운영 (기존 패턴 일치)
  is_hidden         boolean     NOT NULL DEFAULT false,
  hidden_reason     text,
  deleted_at        timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bingos_creator
  ON public.bingos (creator_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bingos_public_recent
  ON public.bingos (created_at DESC)
  WHERE visibility = 'public' AND status = 'published'
    AND is_hidden = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bingos_public_popular
  ON public.bingos (play_count DESC, created_at DESC)
  WHERE visibility = 'public' AND status = 'published'
    AND is_hidden = false AND deleted_at IS NULL;

-- ============================================================
-- 2) bingo_plays: 플레이 dedup (play_count 정확도)
-- ============================================================
-- 같은 (bingo, user|session) 1회만 카운트
CREATE TABLE IF NOT EXISTS public.bingo_plays (
  id            bigserial PRIMARY KEY,
  bingo_id      uuid      NOT NULL REFERENCES public.bingos(id) ON DELETE CASCADE,
  user_id       uuid,
  session_id    text,
  finished      boolean   NOT NULL DEFAULT false,
  -- finished_grid: 사용자가 체크한 칸 idx 배열 (공유 캡처용)
  finished_grid jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,

  -- 둘 중 하나는 무조건 있어야 함
  CONSTRAINT bingo_plays_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- dedup: 같은 사용자/세션 1번만
CREATE UNIQUE INDEX IF NOT EXISTS idx_bingo_plays_user_uniq
  ON public.bingo_plays (bingo_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bingo_plays_session_uniq
  ON public.bingo_plays (bingo_id, session_id) WHERE user_id IS NULL AND session_id IS NOT NULL;

-- ============================================================
-- 3) updated_at 트리거 (공용 touch_updated_at 재사용)
-- ============================================================
DROP TRIGGER IF EXISTS trg_touch_bingos ON public.bingos;
CREATE TRIGGER trg_touch_bingos
  BEFORE UPDATE ON public.bingos
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 4) RLS 정책
-- ============================================================

ALTER TABLE public.bingos ENABLE ROW LEVEL SECURITY;

-- SELECT: 공개+발행+숨김아님+삭제아님 OR 본인
DROP POLICY IF EXISTS "bingos_select_visible" ON public.bingos;
CREATE POLICY "bingos_select_visible"
  ON public.bingos FOR SELECT
  USING (
    (visibility IN ('public', 'unlisted')
      AND status = 'published'
      AND is_hidden = false
      AND deleted_at IS NULL)
    OR creator_id = auth.uid()
  );

-- INSERT: 자기 것만
DROP POLICY IF EXISTS "bingos_insert_own" ON public.bingos;
CREATE POLICY "bingos_insert_own"
  ON public.bingos FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- UPDATE: 자기 것만 (운영자는 service_role 사용)
DROP POLICY IF EXISTS "bingos_update_own" ON public.bingos;
CREATE POLICY "bingos_update_own"
  ON public.bingos FOR UPDATE
  USING (creator_id = auth.uid());

-- DELETE: 자기 것만
DROP POLICY IF EXISTS "bingos_delete_own" ON public.bingos;
CREATE POLICY "bingos_delete_own"
  ON public.bingos FOR DELETE
  USING (creator_id = auth.uid());

-- ── bingo_plays ──
ALTER TABLE public.bingo_plays ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 플레이 또는 익명 세션
DROP POLICY IF EXISTS "bingo_plays_select_own" ON public.bingo_plays;
CREATE POLICY "bingo_plays_select_own"
  ON public.bingo_plays FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- INSERT: 본인 user_id 또는 익명(session)
DROP POLICY IF EXISTS "bingo_plays_insert_any" ON public.bingo_plays;
CREATE POLICY "bingo_plays_insert_any"
  ON public.bingo_plays FOR INSERT
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL AND session_id IS NOT NULL)
  );

-- UPDATE: 본인 플레이 완료 처리
DROP POLICY IF EXISTS "bingo_plays_update_own" ON public.bingo_plays;
CREATE POLICY "bingo_plays_update_own"
  ON public.bingo_plays FOR UPDATE
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL)
  );

-- ============================================================
-- 5) RPC: count_bingo_play (dedup + play_count 증가)
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_bingo_play(
  p_bingo_id uuid,
  p_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted boolean := false;
BEGIN
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.bingo_plays (bingo_id, user_id)
    VALUES (p_bingo_id, v_user_id)
    ON CONFLICT (bingo_id, user_id) DO NOTHING
    RETURNING true INTO v_inserted;
  ELSIF p_session_id IS NOT NULL THEN
    INSERT INTO public.bingo_plays (bingo_id, session_id)
    VALUES (p_bingo_id, p_session_id)
    ON CONFLICT (bingo_id, session_id) DO NOTHING
    RETURNING true INTO v_inserted;
  END IF;

  IF v_inserted THEN
    UPDATE public.bingos
    SET play_count = play_count + 1
    WHERE id = p_bingo_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_bingo_play(uuid, text) TO anon, authenticated;

-- ============================================================
-- 6) RPC: finish_bingo (완료 표시 + complete_count 증가)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finish_bingo(
  p_bingo_id uuid,
  p_session_id text DEFAULT NULL,
  p_finished_grid jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int := 0;
BEGIN
  IF v_user_id IS NOT NULL THEN
    UPDATE public.bingo_plays
    SET finished = true,
        finished_grid = COALESCE(p_finished_grid, finished_grid),
        finished_at = now()
    WHERE bingo_id = p_bingo_id AND user_id = v_user_id AND finished = false;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_session_id IS NOT NULL THEN
    UPDATE public.bingo_plays
    SET finished = true,
        finished_grid = COALESCE(p_finished_grid, finished_grid),
        finished_at = now()
    WHERE bingo_id = p_bingo_id AND session_id = p_session_id AND finished = false;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  IF v_updated > 0 THEN
    UPDATE public.bingos
    SET complete_count = complete_count + 1
    WHERE id = p_bingo_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_bingo(uuid, text, jsonb) TO anon, authenticated;

-- ============================================================
-- 적용 방법
-- ============================================================
-- Supabase MCP apply_migration 또는 Dashboard > SQL Editor 에서 실행
-- ============================================================
