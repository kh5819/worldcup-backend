-- ==========================================================
-- 월드컵 매치 로그 + 판 기록 + 랭킹 집계 View
-- Supabase SQL Editor에서 실행
-- ==========================================================

-- 1) worldcup_matches — 매치(라운드) 단위 기록
CREATE TABLE IF NOT EXISTS public.worldcup_matches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id           UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  room_id              UUID NULL,
  mode                 TEXT NOT NULL DEFAULT 'worldcup',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  match_round          TEXT NULL,            -- '32강','16강','8강','준결승','결승' 등
  candidate_a_id       UUID NULL REFERENCES public.worldcup_candidates(id) ON DELETE SET NULL,
  candidate_b_id       UUID NULL REFERENCES public.worldcup_candidates(id) ON DELETE SET NULL,
  winner_candidate_id  UUID NOT NULL REFERENCES public.worldcup_candidates(id) ON DELETE CASCADE,
  loser_candidate_id   UUID NULL REFERENCES public.worldcup_candidates(id) ON DELETE SET NULL,
  is_tie               BOOLEAN NOT NULL DEFAULT false,
  meta                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_wc_matches_content
  ON public.worldcup_matches(content_id);
CREATE INDEX IF NOT EXISTS idx_wc_matches_winner
  ON public.worldcup_matches(winner_candidate_id);
CREATE INDEX IF NOT EXISTS idx_wc_matches_a
  ON public.worldcup_matches(candidate_a_id);
CREATE INDEX IF NOT EXISTS idx_wc_matches_b
  ON public.worldcup_matches(candidate_b_id);

-- 2) worldcup_runs — 한 판(게임) 단위 기록
CREATE TABLE IF NOT EXISTS public.worldcup_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id             UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  room_id                UUID NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_players          INT NOT NULL DEFAULT 1,
  champion_candidate_id  UUID NOT NULL REFERENCES public.worldcup_candidates(id) ON DELETE CASCADE,
  meta                   JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wc_runs_content
  ON public.worldcup_runs(content_id);
CREATE INDEX IF NOT EXISTS idx_wc_runs_champion
  ON public.worldcup_runs(champion_candidate_id);

-- 3) RLS 정책
ALTER TABLE public.worldcup_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worldcup_runs    ENABLE ROW LEVEL SECURITY;

-- SELECT: 누구나 (랭킹 조회용)
DROP POLICY IF EXISTS "wc_matches_select_public" ON public.worldcup_matches;
CREATE POLICY "wc_matches_select_public"
  ON public.worldcup_matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "wc_runs_select_public" ON public.worldcup_runs;
CREATE POLICY "wc_runs_select_public"
  ON public.worldcup_runs FOR SELECT
  USING (true);

-- INSERT: 인증된 사용자만 (서버는 service_role로 bypass)
DROP POLICY IF EXISTS "wc_matches_insert_auth" ON public.worldcup_matches;
CREATE POLICY "wc_matches_insert_auth"
  ON public.worldcup_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "wc_runs_insert_auth" ON public.worldcup_runs;
CREATE POLICY "wc_runs_insert_auth"
  ON public.worldcup_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE/DELETE: 기본 차단 (필요 시 admin만 허용)

-- 4) 랭킹 집계 View
DROP VIEW IF EXISTS public.worldcup_candidate_stats_v;

CREATE VIEW public.worldcup_candidate_stats_v AS
SELECT
  c.content_id,
  c.id          AS candidate_id,
  c.name,
  c.media_url,
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
) rs ON true;

-- View에 대한 SELECT 권한 부여 (anon + authenticated)
GRANT SELECT ON public.worldcup_candidate_stats_v TO anon, authenticated;
