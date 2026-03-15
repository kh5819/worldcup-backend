-- 후보별 대표 썸네일 URL 저장
-- 치지직/mp4 등 영상형 콘텐츠의 대표 이미지를 한 번 해석 후 저장
-- 렌더링 시 매번 외부 프록시 호출 없이 직접 사용

-- 1) 컬럼 추가
ALTER TABLE worldcup_candidates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

-- 2) 랭킹 뷰 재생성 (thumbnail_url 포함)
DROP VIEW IF EXISTS public.worldcup_candidate_stats_v;

CREATE VIEW public.worldcup_candidate_stats_v AS
SELECT
  c.content_id,
  c.id          AS candidate_id,
  c.name,
  c.media_type,
  c.media_url,
  c.thumbnail_url,
  c.start_sec,
  COALESCE(ms.games, 0)   AS games,
  COALESCE(ms.wins, 0)    AS wins,
  CASE
    WHEN COALESCE(ms.games, 0) > 0
    THEN ROUND(COALESCE(ms.wins, 0)::numeric / ms.games * 100, 2)
    ELSE 0
  END AS win_rate,
  COALESCE(rs.champion_count, 0) AS champion_count
FROM public.worldcup_candidates c
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS games,
    COUNT(*) FILTER (WHERE m.winner_candidate_id = c.id)::int AS wins
  FROM public.worldcup_matches m
  WHERE m.content_id = c.content_id
    AND (m.candidate_a_id = c.id OR m.candidate_b_id = c.id)
) ms ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS champion_count
  FROM public.worldcup_runs r
  WHERE r.content_id = c.content_id
    AND r.champion_candidate_id = c.id
) rs ON true
WHERE c.is_active = true;

GRANT SELECT ON public.worldcup_candidate_stats_v TO anon, authenticated;

-- 3) 기존 YouTube 후보에 ytimg 썸네일 자동 채우기
UPDATE worldcup_candidates
SET thumbnail_url = 'https://i.ytimg.com/vi/' ||
  CASE
    WHEN media_url ~ '^[A-Za-z0-9_-]{11}$' THEN media_url
    WHEN media_url ~ 'youtu\.be/([A-Za-z0-9_-]{11})' THEN (regexp_match(media_url, 'youtu\.be/([A-Za-z0-9_-]{11})'))[1]
    WHEN media_url ~ '[?&]v=([A-Za-z0-9_-]{11})' THEN (regexp_match(media_url, '[?&]v=([A-Za-z0-9_-]{11})'))[1]
    WHEN media_url ~ '/(?:embed|shorts|v)/([A-Za-z0-9_-]{11})' THEN (regexp_match(media_url, '/(?:embed|shorts|v)/([A-Za-z0-9_-]{11})'))[1]
    ELSE NULL
  END || '/hqdefault.jpg'
WHERE media_type = 'youtube'
  AND thumbnail_url IS NULL
  AND (
    media_url ~ '^[A-Za-z0-9_-]{11}$'
    OR media_url ~ 'youtu\.be/[A-Za-z0-9_-]{11}'
    OR media_url ~ '[?&]v=[A-Za-z0-9_-]{11}'
    OR media_url ~ '/(?:embed|shorts|v)/[A-Za-z0-9_-]{11}'
  );
