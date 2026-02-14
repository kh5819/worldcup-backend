-- ============================================================
-- debug_complete_count.sql — 완주수 증가 회귀 원인 조사
-- Supabase Dashboard > SQL Editor 에서 실행
-- 2026-02-14
-- ============================================================

-- ■ 1) contents 컬럼 확인 (complete_count 존재 여부)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contents'
  AND column_name IN ('play_count', 'complete_count', 'updated_at')
ORDER BY ordinal_position;

-- ■ 2) tier_templates 컬럼 확인 (complete_count 존재 여부)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tier_templates'
  AND column_name IN ('play_count', 'complete_count', 'updated_at')
ORDER BY ordinal_position;

-- ■ 3) play_history 컬럼 확인 (타임스탬프 컬럼명 정확히 확인)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'play_history'
ORDER BY ordinal_position;

-- ■ 4) content_plays 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'content_plays'
ORDER BY ordinal_position;

-- ■ 5) content_events 컬럼 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'content_events'
ORDER BY ordinal_position;

-- ■ 6) contents 테이블의 모든 트리거 + 함수 정의
SELECT
  t.tgname AS trigger_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ORIGIN (enabled)'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
  END AS trigger_status,
  pg_get_triggerdef(t.oid, true) AS trigger_definition,
  pg_get_functiondef(p.oid) AS function_source
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relname = 'contents'
  AND NOT t.tgisinternal;

-- ■ 7) tier_templates 테이블의 모든 트리거 + 함수 정의
SELECT
  t.tgname AS trigger_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ORIGIN (enabled)'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
  END AS trigger_status,
  pg_get_triggerdef(t.oid, true) AS trigger_definition,
  pg_get_functiondef(p.oid) AS function_source
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relname = 'tier_templates'
  AND NOT t.tgisinternal;

-- ■ 8) increment_complete_count 함수 존재 여부 + 정의
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'increment_complete_count'
  AND n.nspname = 'public';

-- ■ 9) protect_play_count 함수 정확한 소스 (실제 배포본)
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'protect_play_count'
  AND n.nspname = 'public';

-- ■ 10) public_contents_list 뷰 정의 (complete_count 포함 여부)
SELECT pg_get_viewdef('public_contents_list'::regclass, true) AS view_definition;

-- ■ 11) 최근 finish 이벤트 확인 (content_events에 기록되고 있는지)
SELECT id, content_id, content_type, event_type, session_id, user_id, created_at
FROM content_events
WHERE event_type = 'finish'
ORDER BY created_at DESC
LIMIT 10;

-- ■ 12) complete_count 현재 값 vs content_events finish 카운트 비교
SELECT
  c.id,
  c.title,
  c.play_count,
  c.complete_count,
  COALESCE(e.finish_count, 0) AS actual_finishes,
  CASE
    WHEN c.complete_count != COALESCE(e.finish_count, 0) THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END AS status
FROM contents c
LEFT JOIN (
  SELECT content_id, COUNT(*) AS finish_count
  FROM content_events
  WHERE event_type = 'finish'
  GROUP BY content_id
) e ON c.id::text = e.content_id
WHERE c.play_count > 0 OR c.complete_count > 0 OR COALESCE(e.finish_count, 0) > 0
ORDER BY COALESCE(e.finish_count, 0) DESC
LIMIT 20;
