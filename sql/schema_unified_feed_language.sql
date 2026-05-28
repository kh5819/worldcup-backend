-- ============================================================
-- unified_feed 뷰에 language 컬럼 추가 (2026-05-28)
-- ============================================================
-- 전제: schema_content_language.sql 먼저 실행 (contents/tier_templates/bingos/personality_tests에 language 컬럼 추가)
--
-- 본 마이그레이션:
--   기존 unified_feed 뷰를 DROP/CREATE
--   각 SELECT 절에 language 컬럼 추가 (default 'ko' fallback)
-- ============================================================

DROP VIEW IF EXISTS unified_feed;

CREATE VIEW unified_feed AS

-- ── A: 월드컵 / 퀴즈 ──
SELECT
  c.id,
  c.mode                    AS type,
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
  c.item_count,
  COALESCE(c.language, 'ko') AS language,
  c.created_at,
  c.updated_at,
  c.owner_id,
  COALESCE(NULLIF(p.nickname, ''), '익명') AS creator_name,
  p.avatar_url              AS creator_avatar
FROM contents c
LEFT JOIN profiles p ON p.id = c.owner_id
WHERE c.visibility = 'public'
  AND (c.is_hidden IS NULL OR c.is_hidden = false)

UNION ALL

-- ── B: 티어 ──
SELECT
  t.id,
  'tier'                    AS type,
  t.title,
  t.description,
  t.thumbnail_url,
  NULL                      AS auto_thumbnail_url,
  NULL                      AS auto_thumb_media_type,
  t.thumbnail_version,
  NULL                      AS category,
  t.tags,
  t.play_count,
  t.complete_count,
  t.like_count,
  COALESCE(jsonb_array_length(t.cards), 0) AS item_count,
  COALESCE(t.language, 'ko') AS language,
  t.created_at,
  t.updated_at,
  t.creator_id              AS owner_id,
  COALESCE(NULLIF(p2.nickname, ''), '익명') AS creator_name,
  p2.avatar_url             AS creator_avatar
FROM tier_templates t
LEFT JOIN profiles p2 ON p2.id = t.creator_id
WHERE t.is_public = true
  AND (t.is_hidden IS NULL OR t.is_hidden = false)

UNION ALL

-- ── C: 빙고 ──
SELECT
  b.id,
  'bingo'                   AS type,
  b.title,
  b.description,
  b.thumbnail_url,
  NULL                      AS auto_thumbnail_url,
  NULL                      AS auto_thumb_media_type,
  b.thumbnail_version,
  NULL                      AS category,
  b.tags,
  b.play_count,
  b.complete_count,
  b.like_count,
  b.size                    AS item_count,
  COALESCE(b.language, 'ko') AS language,
  b.created_at,
  b.updated_at,
  b.creator_id              AS owner_id,
  COALESCE(NULLIF(p3.nickname, ''), '익명') AS creator_name,
  p3.avatar_url             AS creator_avatar
FROM bingos b
LEFT JOIN profiles p3 ON p3.id = b.creator_id
WHERE b.visibility = 'public'
  AND b.status = 'published'
  AND (b.is_hidden IS NULL OR b.is_hidden = false)
  AND b.deleted_at IS NULL

UNION ALL

-- ── D: 심리테스트 ──
SELECT
  pt.id,
  'ptest'                   AS type,
  pt.title,
  pt.description,
  pt.thumbnail_url,
  NULL                      AS auto_thumbnail_url,
  NULL                      AS auto_thumb_media_type,
  pt.thumbnail_version,
  NULL                      AS category,
  pt.tags,
  pt.play_count,
  pt.complete_count,
  pt.like_count,
  COALESCE(jsonb_array_length(pt.questions), 0) AS item_count,
  COALESCE(pt.language, 'ko') AS language,
  pt.created_at,
  pt.updated_at,
  pt.creator_id             AS owner_id,
  COALESCE(NULLIF(p4.nickname, ''), '익명') AS creator_name,
  p4.avatar_url             AS creator_avatar
FROM personality_tests pt
LEFT JOIN profiles p4 ON p4.id = pt.creator_id
WHERE pt.visibility = 'public'
  AND pt.status = 'published'
  AND (pt.is_hidden IS NULL OR pt.is_hidden = false)
  AND pt.deleted_at IS NULL;
