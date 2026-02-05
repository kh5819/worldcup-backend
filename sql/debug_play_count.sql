-- ============================================================
-- DUO: play_count 디버깅 (debug_play_count.sql)
-- Supabase Dashboard > SQL Editor 에서 순서대로 실행
-- ============================================================

-- ============================================================
-- [진단 1] 최근 tier_instance_plays 10건
-- ============================================================
SELECT instance_id, template_id, user_id, created_at
FROM public.tier_instance_plays
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- [진단 2] 위에서 나온 template_id로 play_count 확인
-- (결과에서 template_id를 복사해서 아래 WHERE에 넣어야 함)
-- ============================================================
-- SELECT id, title, play_count
-- FROM public.tier_templates
-- WHERE id = '<여기에 template_id 붙여넣기>';

-- ============================================================
-- [진단 3] 전체 템플릿의 play_count vs 실제 plays row 수 비교
-- → play_count=0인데 plays_count>0이면 UPDATE가 안 먹는 것
-- ============================================================
SELECT
  tt.id,
  tt.title,
  tt.play_count AS stored_play_count,
  COALESCE(p.actual_plays, 0) AS actual_plays_rows,
  CASE
    WHEN tt.play_count != COALESCE(p.actual_plays, 0)
    THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END AS status
FROM public.tier_templates tt
LEFT JOIN (
  SELECT template_id, COUNT(*) AS actual_plays
  FROM public.tier_instance_plays
  GROUP BY template_id
) p ON p.template_id = tt.id
ORDER BY COALESCE(p.actual_plays, 0) DESC
LIMIT 20;

-- ============================================================
-- [진단 4] 트리거 확인 (tier_templates / tier_instance_plays)
-- ============================================================
SELECT tgname, relname, tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE relname IN ('tier_templates', 'tier_instance_plays')
  AND NOT t.tgisinternal;

-- ============================================================
-- [진단 5] 현재 배포된 count_tier_play 함수 소스 확인
-- → UPDATE 로직이 포함되어 있는지 반드시 확인!
-- ============================================================
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'count_tier_play'
  AND n.nspname = 'public';
