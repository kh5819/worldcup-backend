-- ============================================================
-- DUO: tier_templates play_count (schema_tier_play_count.sql)
-- - tier_templates에 play_count 컬럼 추가
-- - 원자적 증가 RPC 함수 (SECURITY DEFINER → RLS 우회)
-- - anon/authenticated 모두 실행 가능
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1) play_count 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS play_count bigint NOT NULL DEFAULT 0;

-- 2) 원자적 증가 RPC 함수
CREATE OR REPLACE FUNCTION public.increment_tier_template_play_count(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- RLS 우회: 본인 소유 아닌 템플릿도 카운트 증가 허용
SET search_path = public  -- 보안 권장
AS $$
BEGIN
  UPDATE public.tier_templates
  SET play_count = play_count + 1
  WHERE id = p_template_id;
END;
$$;

-- 3) 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.increment_tier_template_play_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_tier_template_play_count(uuid) TO anon;
