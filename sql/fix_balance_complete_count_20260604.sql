-- ============================================================
-- 2026-06-04: 발견 탭 밸런스 미노출 + complete_count 더블 카운트 수정
-- ★ 이미 Supabase에 적용 완료 (migration: fix_balance_complete_count_and_dedup_trigger)
--
-- 문제 1: finish 트리거(auto_increment_complete_count)가
--         content_type IN ('worldcup','quiz')만 처리
--         → balance는 complete_count가 영원히 0
--         → /explore/popular(complete_count 정렬)·/explore/rising(>=1 필터)에서 탈락
--         → 급상승(content_events 48h RPC)에만 노출되는 증상
--
-- 문제 2: trg_apply_finish_to_contents(로그인 finish +1)와
--         trg_auto_increment_complete(전체 finish +1)가 동시 활성
--         → 로그인 완주 시 complete_count +2 (더블 카운트)
--         → 검증: 불일치 343건 전수 = finish_total + finish_login 패턴,
--            이벤트 없이 count>0인 행 0건 (이벤트가 정확한 원본)
-- ============================================================

BEGIN;

-- 1) 중복 트리거 제거 (로그인 finish 더블 카운트 원인)
DROP TRIGGER IF EXISTS trg_apply_finish_to_contents ON public.content_events;
DROP FUNCTION IF EXISTS public.apply_finish_to_contents();

-- 2) finish 트리거에 balance 포함
CREATE OR REPLACE FUNCTION public.auto_increment_complete_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- finish 이벤트만 처리 (로그인/비로그인 모두)
  IF NEW.event_type = 'finish' THEN
    IF NEW.content_type IN ('worldcup', 'quiz', 'balance') THEN
      UPDATE contents
         SET complete_count = complete_count + 1
       WHERE id = NEW.content_id::uuid;
    END IF;
    -- 티어 finish는 여기서 무시 (tier_templates는 별도 RPC가 담당)
  END IF;
  RETURN NEW;
END;
$$;

-- 3) 재계산: complete_count = 실제 finish 이벤트 수
--    updated_at 오염 방지 + admin variant 가드 통과를 위해 관련 트리거 일시 비활성
ALTER TABLE public.contents DISABLE TRIGGER trg_contents_bump_thumbver;
ALTER TABLE public.contents DISABLE TRIGGER trg_contents_thumbver;
ALTER TABLE public.contents DISABLE TRIGGER trg_contents_enforce_admin_variant;

UPDATE public.contents c
SET complete_count = e.finish_cnt
FROM (
  SELECT content_id, COUNT(*) AS finish_cnt
  FROM public.content_events
  WHERE event_type = 'finish'
  GROUP BY content_id
) e
WHERE c.id::text = e.content_id
  AND c.mode IN ('worldcup', 'quiz', 'balance')
  AND c.complete_count IS DISTINCT FROM e.finish_cnt;

ALTER TABLE public.contents ENABLE TRIGGER trg_contents_bump_thumbver;
ALTER TABLE public.contents ENABLE TRIGGER trg_contents_thumbver;
ALTER TABLE public.contents ENABLE TRIGGER trg_contents_enforce_admin_variant;

COMMIT;

-- ============================================================
-- 적용 후 검증 결과 (2026-06-04):
--   · balance 5건 백필 완료 (가능충 테스트 64 등)
--   · worldcup/quiz/balance 전체 불일치 0건
--   · content_events 트리거 2개만 활성 (auto_increment + ranking_points)
--   · contents 트리거 전부 재활성 확인
-- ============================================================
