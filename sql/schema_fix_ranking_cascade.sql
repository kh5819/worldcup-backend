-- ============================================================
-- schema_fix_ranking_cascade.sql
-- 월드컵 후보 편집 시 랭킹 초기화 버그 수정
-- Supabase Dashboard > SQL Editor 에서 전체 실행
-- 2026-02-15
--
-- 문제:
--   1) winner_candidate_id / champion_candidate_id FK가 ON DELETE CASCADE
--      → 후보 삭제 시 해당 후보가 이긴 매치/우승 기록이 전부 삭제됨
--      → 다른 후보의 랭킹 데이터도 연쇄 손상
--   2) 후보 삭제가 hard delete → CASCADE 발동
--
-- 해결:
--   A) worldcup_candidates에 is_active 컬럼 추가 (soft delete)
--   B) winner_candidate_id FK를 CASCADE → SET NULL로 변경 (안전장치)
--   C) champion_candidate_id FK를 CASCADE → SET NULL로 변경 (안전장치)
--   D) 랭킹 View에서 is_active=true 후보만 표시
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- A) worldcup_candidates: is_active 컬럼 추가
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.worldcup_candidates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- is_active 인덱스 (play/feed 조회 성능)
CREATE INDEX IF NOT EXISTS idx_wc_candidates_active
  ON public.worldcup_candidates(content_id, is_active)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════
-- B) worldcup_matches.winner_candidate_id: CASCADE → SET NULL
-- ═══════════════════════════════════════════════════════════

-- B-1) NOT NULL 제약 해제 (SET NULL 위해 nullable 필요)
ALTER TABLE public.worldcup_matches
  ALTER COLUMN winner_candidate_id DROP NOT NULL;

-- B-2) 기존 FK 제거 후 재생성
--      (Supabase 자동 생성 이름 패턴 두 가지 모두 시도)
ALTER TABLE public.worldcup_matches
  DROP CONSTRAINT IF EXISTS worldcup_matches_winner_candidate_id_fkey;
ALTER TABLE public.worldcup_matches
  DROP CONSTRAINT IF EXISTS worldcup_matches_winner_candidate_id_fkey1;

ALTER TABLE public.worldcup_matches
  ADD CONSTRAINT worldcup_matches_winner_candidate_id_fkey
  FOREIGN KEY (winner_candidate_id)
  REFERENCES public.worldcup_candidates(id)
  ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════
-- C) worldcup_runs.champion_candidate_id: CASCADE → SET NULL
-- ═══════════════════════════════════════════════════════════

-- C-1) NOT NULL 제약 해제
ALTER TABLE public.worldcup_runs
  ALTER COLUMN champion_candidate_id DROP NOT NULL;

-- C-2) 기존 FK 제거 후 재생성
ALTER TABLE public.worldcup_runs
  DROP CONSTRAINT IF EXISTS worldcup_runs_champion_candidate_id_fkey;
ALTER TABLE public.worldcup_runs
  DROP CONSTRAINT IF EXISTS worldcup_runs_champion_candidate_id_fkey1;

ALTER TABLE public.worldcup_runs
  ADD CONSTRAINT worldcup_runs_champion_candidate_id_fkey
  FOREIGN KEY (champion_candidate_id)
  REFERENCES public.worldcup_candidates(id)
  ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════
-- D) 랭킹 View 재생성 (is_active=true 필터)
-- ═══════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.worldcup_candidate_stats_v;

CREATE VIEW public.worldcup_candidate_stats_v AS
SELECT
  c.content_id,
  c.id          AS candidate_id,
  c.name,
  c.media_type,
  c.media_url,
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

-- ═══════════════════════════════════════════════════════════
-- E) item_count 동기화: soft delete 시 카운트 조정
--    is_active 변경 시 contents.item_count ±1
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_item_count_on_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- is_active가 true → false (비활성화): -1
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE contents SET item_count = GREATEST(item_count - 1, 0)
     WHERE id = NEW.content_id;
  -- is_active가 false → true (재활성화): +1
  ELSIF OLD.is_active = false AND NEW.is_active = true THEN
    UPDATE contents SET item_count = item_count + 1
     WHERE id = NEW.content_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_item_count_wc_active ON public.worldcup_candidates;
CREATE TRIGGER trg_sync_item_count_wc_active
  AFTER UPDATE OF is_active ON public.worldcup_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_count_on_active();

COMMIT;
