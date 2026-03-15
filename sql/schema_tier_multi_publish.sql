-- ============================================================
-- Multi Tier Publish: published_at column + increment RPC
-- Idempotent: 재실행해도 에러 없음
-- ============================================================

-- 1) tier_multi_results에 published_at 컬럼 추가 (중복 발행 방지용)
ALTER TABLE public.tier_multi_results
  ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT NULL;

-- 2) service_role 전용 atomic play_count increment RPC
--    auth.uid() 체크 없음 (백엔드 service_role에서만 호출)
--    쿨다운 없음 (중복 방지는 published_at으로 이미 처리됨)
CREATE OR REPLACE FUNCTION public.increment_tier_play_count(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count bigint;
BEGIN
  UPDATE tier_templates
     SET play_count = COALESCE(play_count, 0) + 1
   WHERE id = p_template_id
  RETURNING play_count INTO v_new_count;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TEMPLATE_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('ok', true, 'play_count', v_new_count);
END;
$$;

-- service_role만 호출 가능 (authenticated에는 기존 bump_tier_play_count 사용)
REVOKE EXECUTE ON FUNCTION public.increment_tier_play_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_tier_play_count(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_tier_play_count(uuid) TO service_role;
