-- ============================================================
-- 탐색(Explore) 확장: 급상승 RPC + 추천 콘텐츠 테이블
-- ============================================================

-- 1) content_events 시간 기반 조회 인덱스 (급상승 계산용)
CREATE INDEX IF NOT EXISTS idx_ce_event_type_created
  ON content_events (event_type, created_at DESC);

-- 2) 급상승 콘텐츠 RPC
--    최근 48시간 finish 수 vs 이전 48시간 비교 → 증가폭 순
CREATE OR REPLACE FUNCTION get_trending_contents(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  content_id   TEXT,
  content_type TEXT,
  recent_count BIGINT,
  prev_count   BIGINT,
  growth       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH recent AS (
    SELECT content_id, content_type, COUNT(*) AS cnt
    FROM content_events
    WHERE event_type = 'finish'
      AND created_at >= now() - INTERVAL '48 hours'
    GROUP BY content_id, content_type
  ),
  prev AS (
    SELECT content_id, content_type, COUNT(*) AS cnt
    FROM content_events
    WHERE event_type = 'finish'
      AND created_at >= now() - INTERVAL '96 hours'
      AND created_at <  now() - INTERVAL '48 hours'
    GROUP BY content_id, content_type
  )
  SELECT
    r.content_id,
    r.content_type,
    r.cnt AS recent_count,
    COALESCE(p.cnt, 0) AS prev_count,
    r.cnt - COALESCE(p.cnt, 0) AS growth
  FROM recent r
  LEFT JOIN prev p USING (content_id, content_type)
  WHERE r.cnt >= 2
  ORDER BY (r.cnt - COALESCE(p.cnt, 0)) DESC, r.cnt DESC
  LIMIT p_limit;
$$;

-- 3) 추천(Featured) 콘텐츠 테이블 — 운영자가 수동 선정
CREATE TABLE IF NOT EXISTS featured_contents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id    TEXT NOT NULL,
  content_type  TEXT NOT NULL CHECK (content_type IN ('worldcup','quiz','tier')),
  sort_order    INT DEFAULT 0,
  memo          TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, content_type)
);

ALTER TABLE featured_contents ENABLE ROW LEVEL SECURITY;

-- 공개 읽기
CREATE POLICY "featured_select_all" ON featured_contents
  FOR SELECT USING (true);

-- service_role만 CUD
CREATE POLICY "featured_manage_service" ON featured_contents
  FOR ALL USING (auth.role() = 'service_role');
