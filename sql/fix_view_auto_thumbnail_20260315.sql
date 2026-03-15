-- fix_view_auto_thumbnail_20260315.sql
-- 문제: fix_count_regression_20260215 / fix_3bugs_20260215 마이그레이션에서
--       public_contents_list VIEW를 재생성할 때 auto_thumbnail_url,
--       auto_thumb_media_type, like_count 컬럼이 누락됨
-- 수정: 전체 컬럼 포함하여 VIEW 재생성 (profiles JOIN 복원)

BEGIN;

DROP VIEW IF EXISTS public_contents_list;

CREATE VIEW public_contents_list AS
SELECT c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.auto_thumbnail_url,
    c.auto_thumb_media_type,
    c.thumbnail_version,
    c.category,
    c.tags,
    c.play_count,
    c.complete_count,
    c.like_count,
    c.timer_enabled,
    c.item_count,
    c.created_at,
    c.updated_at,
    COALESCE(NULLIF(p.nickname, ''), '익명') AS creator_name
FROM contents c
LEFT JOIN profiles p ON p.id = c.owner_id
WHERE c.visibility = 'public'
  AND (c.is_hidden IS NULL OR c.is_hidden = false);

COMMIT;
