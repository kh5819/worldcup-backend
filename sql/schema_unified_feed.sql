-- ============================================================
-- unified_feed VIEW — 홈 피드 통합 뷰
-- 2026-04-13
-- public_contents_list(월드컵/퀴즈) + tier_templates(티어)를
-- UNION ALL로 합쳐 단일 쿼리로 정렬·페이지네이션하는 뷰
-- ============================================================

-- 기존 뷰가 있으면 제거
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
  -- 수동 썸네일 없을 때 첫 카드 이미지를 auto fallback으로 사용
  t.cards -> 0 ->> 'image_url'   AS auto_thumbnail_url,
  NULL                            AS auto_thumb_media_type,
  t.thumbnail_version,
  NULL                            AS category,
  t.tags,
  t.play_count,
  t.complete_count,
  t.like_count,
  jsonb_array_length(COALESCE(t.cards, '[]'::jsonb))  AS item_count,
  t.created_at,
  t.updated_at,
  t.creator_id              AS owner_id,
  COALESCE(NULLIF(p.nickname, ''), '익명') AS creator_name,
  p.avatar_url              AS creator_avatar
FROM tier_templates t
LEFT JOIN profiles p ON p.id = t.creator_id
WHERE t.is_public = true
  AND (t.is_hidden IS NULL OR t.is_hidden = false)
  AND t.deleted_at IS NULL;

-- ============================================================
-- 인덱스 (UNION ALL 뷰 자체에는 인덱스 불가 — 원본 테이블에 추가)
-- 인기순 / 최신순 정렬 성능 최적화
-- ============================================================

-- 월드컵/퀴즈: play_count DESC + created_at DESC
CREATE INDEX IF NOT EXISTS idx_contents_feed_popular
  ON contents (play_count DESC, created_at DESC)
  WHERE visibility = 'public' AND (is_hidden IS NULL OR is_hidden = false);

-- 월드컵/퀴즈: created_at DESC (최신순)
CREATE INDEX IF NOT EXISTS idx_contents_feed_recent
  ON contents (created_at DESC)
  WHERE visibility = 'public' AND (is_hidden IS NULL OR is_hidden = false);

-- 티어: play_count DESC + created_at DESC
CREATE INDEX IF NOT EXISTS idx_tier_feed_popular
  ON tier_templates (play_count DESC, created_at DESC)
  WHERE is_public = true AND (is_hidden IS NULL OR is_hidden = false) AND deleted_at IS NULL;

-- 티어: created_at DESC (최신순)
CREATE INDEX IF NOT EXISTS idx_tier_feed_recent
  ON tier_templates (created_at DESC)
  WHERE is_public = true AND (is_hidden IS NULL OR is_hidden = false) AND deleted_at IS NULL;

-- ============================================================
-- 적용 방법
-- Supabase Dashboard > SQL Editor 에서 이 파일 전체를 실행
-- ============================================================
