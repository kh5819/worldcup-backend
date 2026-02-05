-- ============================================================
-- DUO: count_tier_play 디버그 버전 (returns json)
-- 원인 확정 후 다시 returns void로 되돌릴 것
--
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

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
  inserted_id uuid;
  updated_rows int := 0;
  old_count bigint;
  new_count bigint;
BEGIN
  -- 1) INSERT (중복이면 DO NOTHING)
  INSERT INTO public.tier_instance_plays(instance_id, template_id, user_id)
  VALUES (p_instance_id, p_template_id, auth.uid())
  ON CONFLICT (instance_id) DO NOTHING
  RETURNING id INTO inserted_id;

  -- 2) INSERT 성공 시에만 play_count +1
  IF inserted_id IS NOT NULL THEN
    -- 현재 play_count 확인
    SELECT play_count INTO old_count
    FROM public.tier_templates
    WHERE id = p_template_id;

    -- UPDATE 실행
    UPDATE public.tier_templates
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = p_template_id;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    -- UPDATE 후 play_count 확인
    SELECT play_count INTO new_count
    FROM public.tier_templates
    WHERE id = p_template_id;
  END IF;

  -- 3) 디버그 JSON 반환
  RETURN json_build_object(
    'inserted', inserted_id IS NOT NULL,
    'inserted_id', inserted_id,
    'updated_rows', updated_rows,
    'old_play_count', old_count,
    'new_play_count', new_count,
    'template_id', p_template_id,
    'instance_id', p_instance_id,
    'auth_uid', auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_tier_play(uuid, uuid) TO authenticated;
