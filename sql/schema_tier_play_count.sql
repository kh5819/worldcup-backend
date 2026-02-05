-- ============================================================
-- DUO: 티어 플레이 카운트 (schema_tier_play_count.sql)
--
-- 1) play_count 컬럼 (tier_templates)
-- 2) tier_instance_plays 테이블 (인스턴스당 1회 dedup)
-- 3) count_tier_play RPC (원자적 insert + increment)
--
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1) play_count 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS play_count bigint NOT NULL DEFAULT 0;

-- 2) 중복 방지 테이블: 인스턴스당 1회만 기록
CREATE TABLE IF NOT EXISTS public.tier_instance_plays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES public.tier_instances(id) ON DELETE CASCADE,
  template_id  uuid NOT NULL REFERENCES public.tier_templates(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instance_id)  -- 핵심: 인스턴스당 1회만 카운트
);

-- RLS
ALTER TABLE public.tier_instance_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own play" ON public.tier_instance_plays;
CREATE POLICY "insert own play" ON public.tier_instance_plays
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "read plays" ON public.tier_instance_plays;
CREATE POLICY "read plays" ON public.tier_instance_plays
  FOR SELECT USING (true);

-- 3) 원자적 RPC: insert 성공 시에만 play_count +1
CREATE OR REPLACE FUNCTION public.count_tier_play(
  p_instance_id uuid,
  p_template_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tier_instance_plays(instance_id, template_id, user_id)
  VALUES (p_instance_id, p_template_id, auth.uid())
  ON CONFLICT (instance_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.tier_templates
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = p_template_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_tier_play(uuid, uuid) TO authenticated;

-- (선택) 기존 함수 제거 — 프론트에서 더 이상 사용하지 않음
-- DROP FUNCTION IF EXISTS public.increment_tier_template_play_count(uuid);
