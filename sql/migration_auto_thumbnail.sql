-- 자동 대표 썸네일 fallback
-- 수동 thumbnail_url이 없는 월드컵 콘텐츠에 대해
-- 우승수 기준 1위 후보의 원본 media_url + media_type을 저장
-- 프론트엔드 getThumbUrl(media_url, media_type)이 렌더 담당 (기존 후보 썸네일 로직 재사용)
-- 하루 1회 갱신

-- 1) 컬럼 추가
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_thumbnail_url TEXT DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_thumb_media_type TEXT DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_thumb_updated_at TIMESTAMPTZ DEFAULT NULL;

-- 2) 뷰 재생성 (auto_thumbnail_url + auto_thumb_media_type 포함)
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
    COALESCE(NULLIF(p.nickname, ''::text), '익명'::text) AS creator_name
FROM contents c
LEFT JOIN profiles p ON p.id = c.owner_id
WHERE c.visibility = 'public'::text AND (c.is_hidden IS NULL OR c.is_hidden = false);
