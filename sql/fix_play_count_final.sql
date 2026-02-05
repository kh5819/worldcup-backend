-- ============================================================
-- DUO: play_count 최종 수정 (fix_play_count_final.sql)
--
-- 원인: tier_instance_plays에 UNIQUE(instance_id) 제약이 없음
--       → ON CONFLICT (instance_id) DO NOTHING 이 42P10 에러
--       → play_count가 절대 증가하지 않음
--
-- Supabase Dashboard > SQL Editor 에서 한 번에 실행
-- ============================================================

-- ─── 1) UNIQUE 제약 추가 ─────────────────────────────────────
-- 이미 존재하면 무시 (IF NOT EXISTS)
-- 중복 row가 있을 수 있으므로 먼저 정리

-- 1a) 혹시 중복 instance_id row가 있으면 최신 1건만 남기고 삭제
DELETE FROM public.tier_instance_plays a
USING public.tier_instance_plays b
WHERE a.instance_id = b.instance_id
  AND a.created_at < b.created_at;

-- 1b) UNIQUE 제약 추가
ALTER TABLE public.tier_instance_plays
  DROP CONSTRAINT IF EXISTS tier_instance_plays_instance_id_key;

ALTER TABLE public.tier_instance_plays
  ADD CONSTRAINT tier_instance_plays_instance_id_key UNIQUE (instance_id);

-- ─── 2) play_count 컬럼 보장 ─────────────────────────────────
ALTER TABLE public.tier_templates
  ADD COLUMN IF NOT EXISTS play_count bigint NOT NULL DEFAULT 0;

-- ─── 3) RPC 함수 재생성 (디버그용 returns json) ──────────────
-- 원인 확정 후 returns void로 변경 가능
CREATE OR REPLACE FUNCTION public.count_tier_play(
  p_instance_id uuid,
  p_template_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_rows int := 0;
BEGIN
  -- 인스턴스당 1회만 INSERT (UNIQUE 제약으로 중복 방지)
  INSERT INTO public.tier_instance_plays(instance_id, template_id, user_id)
  VALUES (p_instance_id, p_template_id, auth.uid())
  ON CONFLICT (instance_id) DO NOTHING
  RETURNING id INTO v_id;

  -- INSERT 성공 시에만 play_count +1
  IF v_id IS NOT NULL THEN
    UPDATE public.tier_templates
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = p_template_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'inserted', v_id IS NOT NULL,
    'updated_rows', v_rows,
    'instance_id', p_instance_id,
    'template_id', p_template_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_tier_play(uuid, uuid) TO authenticated;

-- ─── 4) 기존 play_count 보정 (실제 row 수 기준으로 동기화) ──
UPDATE public.tier_templates tt
SET play_count = sub.cnt
FROM (
  SELECT template_id, COUNT(*) AS cnt
  FROM public.tier_instance_plays
  GROUP BY template_id
) sub
WHERE sub.template_id = tt.id
  AND tt.play_count IS DISTINCT FROM sub.cnt;

-- ─── 5) RLS 정책 보장 ───────────────────────────────────────
ALTER TABLE public.tier_instance_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own play" ON public.tier_instance_plays;
CREATE POLICY "insert own play" ON public.tier_instance_plays
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "read plays" ON public.tier_instance_plays;
CREATE POLICY "read plays" ON public.tier_instance_plays
  FOR SELECT USING (true);

-- ─── 6) 검증 ────────────────────────────────────────────────
-- UNIQUE 제약 확인
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.tier_instance_plays'::regclass
  AND contype = 'u';

-- play_count 현재 상태
SELECT tt.id, tt.title, tt.play_count,
       COALESCE(p.cnt, 0) AS actual_rows
FROM public.tier_templates tt
LEFT JOIN (
  SELECT template_id, COUNT(*) AS cnt
  FROM public.tier_instance_plays
  GROUP BY template_id
) p ON p.template_id = tt.id
ORDER BY tt.play_count DESC
LIMIT 10;
