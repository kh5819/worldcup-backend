-- 자동 대표 썸네일 fallback
-- 수동 thumbnail_url이 없는 월드컵 콘텐츠에 대해
-- 랭킹 1위 후보의 썸네일을 auto_thumbnail_url에 저장 (하루 1회 갱신)

-- 1) 컬럼 추가
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_thumbnail_url TEXT DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS auto_thumb_updated_at TIMESTAMPTZ DEFAULT NULL;

-- 2) 뷰 재생성 (auto_thumbnail_url 포함)
DROP VIEW IF EXISTS public_contents_list;

CREATE VIEW public_contents_list AS
SELECT c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.auto_thumbnail_url,
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
