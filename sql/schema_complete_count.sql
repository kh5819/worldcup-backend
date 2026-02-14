-- ============================================================
-- complete_count 마이그레이션
-- 2026-02-14
-- "완주 수"를 contents / tier_templates에 추가
-- content_events WHERE event_type='finish'를 단일 소스로 사용
-- ============================================================

-- 1. complete_count 컬럼 추가
ALTER TABLE contents ADD COLUMN IF NOT EXISTS complete_count bigint NOT NULL DEFAULT 0;
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS complete_count bigint NOT NULL DEFAULT 0;

-- 2. 기존 데이터 백필 (content_events에서 finish 이벤트 집계)

-- worldcup + quiz
UPDATE contents SET complete_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT content_id, COUNT(*) as cnt
  FROM content_events
  WHERE event_type = 'finish'
  GROUP BY content_id
) sub
WHERE contents.id::text = sub.content_id;

-- tier
UPDATE tier_templates SET complete_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT content_id, COUNT(*) as cnt
  FROM content_events
  WHERE event_type = 'finish' AND content_type = 'tier'
  GROUP BY content_id
) sub
WHERE tier_templates.id::text = sub.content_id;

-- 3. 원자적 증가 RPC (SECURITY DEFINER — anon/authenticated에서 호출 불가, service_role만)
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_content_type = 'tier' THEN
    UPDATE tier_templates
       SET complete_count = complete_count + 1
     WHERE id = p_content_id::uuid;
  ELSE
    UPDATE contents
       SET complete_count = complete_count + 1
     WHERE id = p_content_id::uuid;
  END IF;
END;
$$;

-- 4. dedup 인덱스 (user_id 기반 finish 이벤트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_ce_dedup_user
  ON content_events (content_id, event_type, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- 5. public_contents_list VIEW 재생성 (complete_count 추가)
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.thumbnail_version,
    c.category,
    c.tags,
    c.play_count,
    c.complete_count,
    c.timer_enabled,
    c.item_count,
    c.created_at,
    c.updated_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.play_count DESC, c.created_at DESC;
