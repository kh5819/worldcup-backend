-- ============================================================
-- DUO: play_count 일괄 보정 (fix_play_count_sync.sql)
--
-- 원인: 이전 버전 함수로 INSERT만 되고 UPDATE 누락된 상태에서
--       새 함수로 교체해도 ON CONFLICT DO NOTHING 때문에
--       기존 인스턴스는 play_count +1을 받지 못함
--
-- 해결: tier_instance_plays의 실제 row 수로 play_count를 동기화
--
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- [확인용] 보정 전 현재 상태 조회
SELECT
  tt.id,
  tt.title,
  tt.play_count AS current_count,
  COALESCE(p.actual, 0) AS actual_plays,
  COALESCE(p.actual, 0) - tt.play_count AS diff
FROM public.tier_templates tt
LEFT JOIN (
  SELECT template_id, COUNT(*) AS actual
  FROM public.tier_instance_plays
  GROUP BY template_id
) p ON p.template_id = tt.id
WHERE COALESCE(p.actual, 0) != tt.play_count;

-- [실행] 실제 row 수 기준으로 play_count 보정
UPDATE public.tier_templates tt
SET play_count = COALESCE(sub.actual, 0)
FROM (
  SELECT template_id, COUNT(*) AS actual
  FROM public.tier_instance_plays
  GROUP BY template_id
) sub
WHERE sub.template_id = tt.id
  AND tt.play_count != sub.actual;

-- [확인용] 보정 후 불일치 확인 (0건이면 성공)
SELECT
  tt.id,
  tt.title,
  tt.play_count AS synced_count,
  COALESCE(p.actual, 0) AS actual_plays
FROM public.tier_templates tt
LEFT JOIN (
  SELECT template_id, COUNT(*) AS actual
  FROM public.tier_instance_plays
  GROUP BY template_id
) p ON p.template_id = tt.id
WHERE COALESCE(p.actual, 0) != tt.play_count;
