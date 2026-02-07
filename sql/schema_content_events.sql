-- =====================================================
-- DUO content_events — 콘텐츠 이벤트 로그
-- 완주(finish) / 공유(share) / 플레이(play) 이벤트 통합 기록
-- 제작자 성과 모달(stats.js)에서 집계에 사용
-- =====================================================

-- 1) 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS public.content_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id  TEXT        NOT NULL,   -- contents.id (UUID) 또는 tier_templates.id (UUID)
  content_type TEXT       NOT NULL    -- 'worldcup' | 'quiz' | 'tier'
    CHECK (content_type IN ('worldcup', 'quiz', 'tier')),
  event_type  TEXT        NOT NULL    -- 'play' | 'finish' | 'share'
    CHECK (event_type IN ('play', 'finish', 'share')),
  session_id  TEXT,                   -- 프론트 세션 ID (dedup 키)
  user_id     UUID,                   -- 로그인 유저 (NULL = 게스트)
  meta        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) 인덱스
-- 집계용: content_id + event_type
CREATE INDEX IF NOT EXISTS idx_ce_content_event
  ON public.content_events (content_id, event_type);

-- 7일 집계용: content_id + created_at
CREATE INDEX IF NOT EXISTS idx_ce_content_created
  ON public.content_events (content_id, created_at DESC);

-- dedup용: session + content + event (10분 이내 중복 방지)
CREATE INDEX IF NOT EXISTS idx_ce_dedup
  ON public.content_events (content_id, event_type, session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- 3) RLS
ALTER TABLE public.content_events ENABLE ROW LEVEL SECURITY;

-- service_role(백엔드)만 INSERT 가능
CREATE POLICY ce_insert_service ON public.content_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 읽기: service_role만 (stats API가 백엔드 경유)
CREATE POLICY ce_select_service ON public.content_events
  FOR SELECT TO service_role
  USING (true);

-- 4) 집계 뷰 (content_metrics_v)
-- 콘텐츠별 완주 수 / 공유 수 / 최근 7일 플레이 수
CREATE OR REPLACE VIEW public.content_metrics_v AS
SELECT
  content_id,
  content_type,
  COUNT(*) FILTER (WHERE event_type = 'finish')  AS finishes_total,
  COUNT(*) FILTER (WHERE event_type = 'share')   AS shares_total,
  COUNT(*) FILTER (
    WHERE event_type = 'play'
      AND created_at > now() - INTERVAL '7 days'
  ) AS plays_last_7d,
  COUNT(*) FILTER (WHERE event_type = 'play')    AS plays_total
FROM public.content_events
GROUP BY content_id, content_type;

-- 뷰 읽기 권한 (service_role 전용)
GRANT SELECT ON public.content_metrics_v TO service_role;

-- =====================================================
-- 사용법:
-- INSERT (백엔드 POST /events):
--   supabaseAdmin.from('content_events').insert({
--     content_id, content_type, event_type, session_id, user_id, meta
--   })
--
-- SELECT (백엔드 GET /content-metrics/:contentId):
--   supabaseAdmin.from('content_metrics_v')
--     .select('*').eq('content_id', contentId).single()
-- =====================================================
