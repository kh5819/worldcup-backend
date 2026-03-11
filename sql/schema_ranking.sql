-- ============================================================
-- DUO 주간 랭킹 시스템 + 명예의 전당
-- 작성일: 2026-03-12 | 수정: 2026-03-12 (idempotent migration)
-- 의존: profiles, contents, tier_templates, content_events
--
-- ★ 이 스크립트는 여러 번 실행해도 에러 없이 동작합니다 (idempotent)
-- ============================================================


-- ============================================================
-- 1. ranking_points 테이블 (포인트 원장)
-- - 모든 포인트 이력을 week_start 기준으로 보존
-- - 주간 초기화 = 삭제가 아닌 week_start 필터 조회
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ranking_points (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid        NOT NULL,        -- 포인트 수령자
  point_type      text        NOT NULL,        -- 'play' | 'creator'
  content_id      text        NOT NULL,        -- content_events.content_id와 동일 (TEXT)
  content_type    text        NOT NULL,        -- 'worldcup' | 'quiz' | 'tier'
  source_user_id  uuid        NOT NULL,        -- play=본인, creator=플레이어
  week_start      date        NOT NULL,        -- ISO주 월요일
  day_date        date        NOT NULL,        -- 일별 cap 검증용
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- 제약: point_type은 play 또는 creator만
  CONSTRAINT rp_point_type_chk CHECK (point_type IN ('play', 'creator')),
  -- 제약: content_type은 worldcup/quiz/tier만
  CONSTRAINT rp_content_type_chk CHECK (content_type IN ('worldcup', 'quiz', 'tier')),

  -- 같은 플레이어가 같은 콘텐츠를 같은 날 플레이해도 point_type별 1회만
  CONSTRAINT rp_dedup_uq UNIQUE (user_id, point_type, content_id, source_user_id, day_date)
);

-- 주간 랭킹 집계용 (GROUP BY user_id WHERE week_start = ?)
CREATE INDEX IF NOT EXISTS idx_rp_week_user
  ON public.ranking_points (week_start, user_id);

-- daily cap 검증용 (COUNT WHERE user_id=? AND point_type=? AND day_date=?)
CREATE INDEX IF NOT EXISTS idx_rp_daily_cap
  ON public.ranking_points (user_id, point_type, day_date);

-- RLS 활성화 (직접 client 접근 차단, 함수 통해서만 접근)
ALTER TABLE public.ranking_points ENABLE ROW LEVEL SECURITY;

-- ★ DROP 먼저 → CREATE (재실행 안전)
DROP POLICY IF EXISTS rp_service_insert ON public.ranking_points;
CREATE POLICY rp_service_insert ON public.ranking_points
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS rp_service_select ON public.ranking_points;
CREATE POLICY rp_service_select ON public.ranking_points
  FOR SELECT TO service_role USING (true);

-- anon/authenticated는 직접 접근 불가 (RPC 함수가 SECURITY DEFINER로 조회)
-- 명시적으로 차단 정책은 불필요 (RLS ON + 허용 정책 없음 = 자동 차단)


-- ============================================================
-- 2. ranking_hall_of_fame 테이블 (명예의 전당)
-- - 매주 1위만 영구 기록 (스냅샷)
-- - week_start UNIQUE로 주차당 1명만
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ranking_hall_of_fame (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid        NOT NULL,
  nickname        text        NOT NULL,        -- 우승 당시 닉네임 스냅샷
  avatar_url      text,                        -- 우승 당시 아바타 스냅샷
  total_points    integer     NOT NULL,
  play_points     integer     NOT NULL DEFAULT 0,
  creator_points  integer     NOT NULL DEFAULT 0,
  week_start      date        NOT NULL UNIQUE, -- 주차별 1명만
  week_end        date        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ranking_hall_of_fame ENABLE ROW LEVEL SECURITY;

-- ★ DROP 먼저 → CREATE (재실행 안전)
DROP POLICY IF EXISTS hof_select_public ON public.ranking_hall_of_fame;
CREATE POLICY hof_select_public ON public.ranking_hall_of_fame
  FOR SELECT USING (true);

DROP POLICY IF EXISTS hof_service_insert ON public.ranking_hall_of_fame;
CREATE POLICY hof_service_insert ON public.ranking_hall_of_fame
  FOR INSERT TO service_role WITH CHECK (true);


-- ============================================================
-- 3. record_ranking_points() — 핵심 포인트 기록 함수
-- - content_events AFTER INSERT 트리거에서 호출
-- - SECURITY DEFINER: 내부에서 profiles, contents 등 조회 가능
-- - 일일 최대: play 30, creator 100
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_ranking_points(
  p_player_id    uuid,
  p_content_id   text,
  p_content_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_creator_id  uuid;
  v_week_start  date;
  v_day         date;
  v_play_today  int;
  v_creator_today int;
BEGIN
  -- 비로그인이면 무시
  IF p_player_id IS NULL THEN
    RETURN;
  END IF;

  -- 콘텐츠 제작자 조회
  IF p_content_type IN ('worldcup', 'quiz') THEN
    SELECT owner_id INTO v_creator_id
    FROM public.contents
    WHERE id = p_content_id::uuid;
  ELSIF p_content_type = 'tier' THEN
    SELECT creator_id INTO v_creator_id
    FROM public.tier_templates
    WHERE id = p_content_id::uuid;
  END IF;

  -- 제작자를 찾을 수 없으면 무시
  IF v_creator_id IS NULL THEN
    RETURN;
  END IF;

  -- 자기 콘텐츠 플레이 → 포인트 없음
  IF p_player_id = v_creator_id THEN
    RETURN;
  END IF;

  v_week_start := date_trunc('week', now())::date;  -- ISO Monday
  v_day        := current_date;

  -- ── 플레이 포인트 (플레이어에게 +1) ──
  SELECT COUNT(*) INTO v_play_today
  FROM public.ranking_points
  WHERE user_id = p_player_id
    AND point_type = 'play'
    AND day_date = v_day;

  IF v_play_today < 30 THEN
    INSERT INTO public.ranking_points
      (user_id, point_type, content_id, content_type, source_user_id, week_start, day_date)
    VALUES
      (p_player_id, 'play', p_content_id, p_content_type, p_player_id, v_week_start, v_day)
    ON CONFLICT ON CONSTRAINT rp_dedup_uq DO NOTHING;
  END IF;

  -- ── 제작자 포인트 (제작자에게 +1) ──
  SELECT COUNT(*) INTO v_creator_today
  FROM public.ranking_points
  WHERE user_id = v_creator_id
    AND point_type = 'creator'
    AND day_date = v_day;

  IF v_creator_today < 100 THEN
    INSERT INTO public.ranking_points
      (user_id, point_type, content_id, content_type, source_user_id, week_start, day_date)
    VALUES
      (v_creator_id, 'creator', p_content_id, p_content_type, p_player_id, v_week_start, v_day)
    ON CONFLICT ON CONSTRAINT rp_dedup_uq DO NOTHING;
  END IF;
END;
$function$;


-- ============================================================
-- 4. 트리거 함수 + 트리거
-- - content_events에 finish INSERT 시 자동 포인트 기록
-- - 기존 트리거(trg_apply_finish_to_contents)와 병렬 실행, 충돌 없음
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_fn_record_ranking_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- finish 이벤트 + 로그인 유저만 처리
  IF NEW.event_type = 'finish' AND NEW.user_id IS NOT NULL THEN
    PERFORM record_ranking_points(NEW.user_id, NEW.content_id, NEW.content_type);
  END IF;
  RETURN NEW;
END;
$function$;

-- ★ DROP 먼저 → CREATE (재실행 안전)
DROP TRIGGER IF EXISTS trg_ranking_points_on_finish ON public.content_events;
CREATE TRIGGER trg_ranking_points_on_finish
  AFTER INSERT ON public.content_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_record_ranking_points();


-- ============================================================
-- 5. get_weekly_ranking() — 주간 랭킹 조회 RPC
-- - 프론트에서 호출: supabase.rpc('get_weekly_ranking', { ... })
-- - 또는 백엔드에서 supabaseAdmin.rpc(...)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_weekly_ranking(
  p_week_start date DEFAULT NULL,
  p_limit      int  DEFAULT 50,
  p_offset     int  DEFAULT 0
)
RETURNS TABLE (
  rank         bigint,
  user_id      uuid,
  nickname     text,
  avatar_url   text,
  total_points bigint,
  play_points  bigint,
  creator_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_week date;
BEGIN
  v_week := COALESCE(p_week_start, date_trunc('week', now())::date);

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY sub.total DESC, sub.play DESC, sub.last_at ASC, sub.uid) AS rank,
    sub.uid         AS user_id,
    COALESCE(p.nickname, '익명') AS nickname,
    p.avatar_url    AS avatar_url,
    sub.total       AS total_points,
    sub.play        AS play_points,
    sub.creator     AS creator_points
  FROM (
    SELECT
      rp.user_id AS uid,
      COUNT(*)                                          AS total,
      COUNT(*) FILTER (WHERE rp.point_type = 'play')    AS play,
      COUNT(*) FILTER (WHERE rp.point_type = 'creator') AS creator,
      MAX(rp.created_at)                                AS last_at
    FROM public.ranking_points rp
    WHERE rp.week_start = v_week
    GROUP BY rp.user_id
  ) sub
  LEFT JOIN public.profiles p ON p.id = sub.uid
  ORDER BY sub.total DESC, sub.play DESC, sub.last_at ASC, sub.uid
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;


-- ============================================================
-- 6. get_ranking_top1() — 홈 티저용 현재 주 1위
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ranking_top1()
RETURNS TABLE (
  user_id        uuid,
  nickname       text,
  avatar_url     text,
  total_points   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sub.uid         AS user_id,
    COALESCE(p.nickname, '익명') AS nickname,
    p.avatar_url    AS avatar_url,
    sub.total       AS total_points
  FROM (
    SELECT
      rp.user_id AS uid,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE rp.point_type = 'play') AS play,
      MAX(rp.created_at) AS last_at
    FROM public.ranking_points rp
    WHERE rp.week_start = date_trunc('week', now())::date
    GROUP BY rp.user_id
    ORDER BY total DESC, play DESC, last_at ASC, rp.user_id
    LIMIT 1
  ) sub
  LEFT JOIN public.profiles p ON p.id = sub.uid;
END;
$function$;


-- ============================================================
-- 7. get_hall_of_fame() — 명예의 전당 조회
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_hall_of_fame(
  p_limit  int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  user_id        uuid,
  nickname       text,
  avatar_url     text,
  total_points   integer,
  play_points    integer,
  creator_points integer,
  week_start     date,
  week_end       date,
  created_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    h.user_id,
    h.nickname,
    h.avatar_url,
    h.total_points,
    h.play_points,
    h.creator_points,
    h.week_start,
    h.week_end,
    h.created_at
  FROM public.ranking_hall_of_fame h
  ORDER BY h.week_start DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;


-- ============================================================
-- 8. archive_weekly_champion() — 이전 주 1위를 명예의 전당에 기록
-- - 멱등(idempotent): 이미 기록된 주차면 SKIP
-- - 백엔드에서 주기적으로 호출하거나, GET /ranking/weekly 시 자동 체크
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_weekly_champion(
  p_target_week date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_week_start  date;
  v_week_end    date;
  v_champ_id    uuid;
  v_total       bigint;
  v_play        bigint;
  v_creator     bigint;
  v_nick        text;
  v_avatar      text;
BEGIN
  -- 기본값: 직전 주 (현재 주 월요일 - 7)
  v_week_start := COALESCE(p_target_week, date_trunc('week', now())::date - 7);
  v_week_end   := v_week_start + 6;

  -- 이미 아카이브됐으면 스킵
  IF EXISTS (SELECT 1 FROM public.ranking_hall_of_fame WHERE week_start = v_week_start) THEN
    RETURN jsonb_build_object('ok', true, 'action', 'already_archived', 'week_start', v_week_start);
  END IF;

  -- 해당 주 1위 조회 (타이브레이커: total → play → 먼저 도달 → uid)
  SELECT
    rp.user_id,
    COUNT(*),
    COUNT(*) FILTER (WHERE rp.point_type = 'play'),
    COUNT(*) FILTER (WHERE rp.point_type = 'creator')
  INTO v_champ_id, v_total, v_play, v_creator
  FROM public.ranking_points rp
  WHERE rp.week_start = v_week_start
  GROUP BY rp.user_id
  ORDER BY COUNT(*) DESC,
           COUNT(*) FILTER (WHERE rp.point_type = 'play') DESC,
           MAX(rp.created_at) ASC,
           rp.user_id
  LIMIT 1;

  -- 해당 주에 포인트가 아무도 없으면
  IF v_champ_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'action', 'no_data', 'week_start', v_week_start);
  END IF;

  -- 프로필 스냅샷
  SELECT COALESCE(p.nickname, '익명'), p.avatar_url
  INTO v_nick, v_avatar
  FROM public.profiles p
  WHERE p.id = v_champ_id;

  v_nick := COALESCE(v_nick, '익명');

  -- 명예의 전당 INSERT
  INSERT INTO public.ranking_hall_of_fame
    (user_id, nickname, avatar_url, total_points, play_points, creator_points, week_start, week_end)
  VALUES
    (v_champ_id, v_nick, v_avatar, v_total::int, v_play::int, v_creator::int, v_week_start, v_week_end);

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'archived',
    'week_start', v_week_start,
    'champion', v_nick,
    'total_points', v_total
  );
END;
$function$;


-- ============================================================
-- 9. get_my_ranking_points() — 내 현재 주 포인트 요약 (선택)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_ranking_points()
RETURNS TABLE (
  total_points   bigint,
  play_points    bigint,
  creator_points bigint,
  play_today     bigint,
  creator_today  bigint,
  current_rank   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid;
  v_week_start date;
  v_total      bigint := 0;
  v_play       bigint := 0;
  v_creator    bigint := 0;
  v_play_td    bigint := 0;
  v_creator_td bigint := 0;
  v_rank       bigint := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_week_start := date_trunc('week', now())::date;

  -- 이번 주 합계
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE point_type = 'play'),
    COUNT(*) FILTER (WHERE point_type = 'creator')
  INTO v_total, v_play, v_creator
  FROM public.ranking_points
  WHERE user_id = v_uid AND week_start = v_week_start;

  -- 오늘 사용량
  SELECT
    COUNT(*) FILTER (WHERE point_type = 'play'),
    COUNT(*) FILTER (WHERE point_type = 'creator')
  INTO v_play_td, v_creator_td
  FROM public.ranking_points
  WHERE user_id = v_uid AND day_date = current_date;

  -- 현재 등수 (타이브레이커: total → play → 먼저 도달 → uid)
  SELECT r INTO v_rank
  FROM (
    SELECT
      rp2.user_id AS uid,
      ROW_NUMBER() OVER (
        ORDER BY COUNT(*) DESC,
                 COUNT(*) FILTER (WHERE rp2.point_type = 'play') DESC,
                 MAX(rp2.created_at) ASC,
                 rp2.user_id
      ) AS r
    FROM public.ranking_points rp2
    WHERE rp2.week_start = v_week_start
    GROUP BY rp2.user_id
  ) sub
  WHERE sub.uid = v_uid;

  total_points   := v_total;
  play_points    := v_play;
  creator_points := v_creator;
  play_today     := v_play_td;
  creator_today  := v_creator_td;
  current_rank   := COALESCE(v_rank, 0);

  RETURN NEXT;
END;
$function$;


-- ============================================================
-- 완료! 롤백 시 아래 순서로 실행:
--
-- DROP TRIGGER IF EXISTS trg_ranking_points_on_finish ON public.content_events;
-- DROP FUNCTION IF EXISTS trg_fn_record_ranking_points();
-- DROP FUNCTION IF EXISTS record_ranking_points(uuid, text, text);
-- DROP FUNCTION IF EXISTS get_weekly_ranking(date, int, int);
-- DROP FUNCTION IF EXISTS get_ranking_top1();
-- DROP FUNCTION IF EXISTS get_hall_of_fame(int, int);
-- DROP FUNCTION IF EXISTS archive_weekly_champion(date);
-- DROP FUNCTION IF EXISTS get_my_ranking_points();
-- DROP TABLE IF EXISTS ranking_points;
-- DROP TABLE IF EXISTS ranking_hall_of_fame;
-- ============================================================
