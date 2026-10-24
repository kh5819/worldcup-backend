-- =========================================================
-- 플듀 파이터 랭크전 v1 (7단계) — 마이그레이션
-- ✅ 운영 DB 적용 완료(2026-10-24, 사용자 승인 "B"). 로컬(PGlite) 검증: fight-tests/ranked-db.test.mjs
-- 롤백: fighter_ranked_v1_rollback.sql
--
-- 원칙
--  · 회원 = 기존 auth.users / profiles(id) 그대로. 새 회원 테이블 없음. 게스트는 랭크전 불가.
--  · 쓰기는 전부 서버(service_role)만. 그것도 RPC fighter_record_match 하나로만(원자적·중복 방지).
--  · 서버는 "경기 기록 재현으로 확인된(verified)" 결과만 넘긴다. 클라이언트 보고는 쓰지 않는다.
--  · 읽기: 시즌·순위·전적 요약은 공개, 경기 상세·점수 변화 기록은 본인만.
-- =========================================================

-- 1) 시즌
create table if not exists public.fighter_seasons (
  id          smallint primary key,
  name        text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_active   boolean not null default false,
  soft_reset  numeric(3,2) not null default 0.50,   -- 다음 시즌 MMR = 1200 + (이전-1200) × soft_reset
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (soft_reset between 0 and 1)
);
create unique index if not exists fighter_seasons_one_active on public.fighter_seasons (is_active) where is_active;

-- 2) 경기(서버가 확인한 결과 1건 = 1행). match_key = 서버 방ID:게임번호 → 같은 경기 두 번 기록 불가
create table if not exists public.fighter_matches (
  id          bigint generated always as identity primary key,
  season_id   smallint not null references public.fighter_seasons(id),
  match_key   text not null unique,
  mode        text not null default 'ranked' check (mode in ('ranked')),
  winner_side smallint not null check (winner_side in (0, 1)),
  reason      text not null check (reason in ('ko', 'time', 'disconnect', 'left')),
  frames      integer check (frames is null or frames between 0 and 200000),
  wins        smallint[] not null check (array_length(wins, 1) = 2),
  verified    boolean not null,
  replay_hash bigint,
  created_at  timestamptz not null default now()
);
create index if not exists fighter_matches_season on public.fighter_matches (season_id, created_at desc);

-- 3) 경기 참가자(경기당 2행)
create table if not exists public.fighter_match_players (
  match_id    bigint not null references public.fighter_matches(id) on delete cascade,
  side        smallint not null check (side in (0, 1)),
  user_id     uuid not null references auth.users(id) on delete cascade,
  char_id     text not null check (char_id in ('hanbit', 'yuna', 'gangcheol', 'rei')),
  result      text not null check (result in ('win', 'loss')),
  mmr_before  integer not null, mmr_after integer not null,
  rp_before   integer not null, rp_after  integer not null,
  primary key (match_id, side),
  unique (match_id, user_id)
);
create index if not exists fighter_match_players_user on public.fighter_match_players (user_id, match_id desc);

-- 4) 시즌별 실력 점수(숨김 MMR) + 공개 점수(RP)
create table if not exists public.fighter_player_ratings (
  season_id   smallint not null references public.fighter_seasons(id),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mmr         integer not null default 1200 check (mmr between 0 and 5000),
  rp          integer not null default 0 check (rp >= 0),
  placements  smallint not null default 0 check (placements >= 0),   -- 배치 경기 수(5판 전까지 순위 숨김)
  streak      smallint not null default 0,                          -- +연승 / -연패
  updated_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index if not exists fighter_ratings_board on public.fighter_player_ratings (season_id, rp desc, mmr desc) where placements >= 5;

-- 5) 시즌 전적 요약(캐릭터별 포함)
create table if not exists public.fighter_season_stats (
  season_id   smallint not null references public.fighter_seasons(id),
  user_id     uuid not null references auth.users(id) on delete cascade,
  char_id     text not null,                    -- 'all' = 전체 합계
  wins        integer not null default 0 check (wins >= 0),
  losses      integer not null default 0 check (losses >= 0),
  primary key (season_id, user_id, char_id)
);

-- 6) 시즌 보상(시즌 종료 때 최고 티어 기록)
create table if not exists public.fighter_rank_rewards (
  season_id   smallint not null references public.fighter_seasons(id),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tier        text not null,
  final_rp    integer not null,
  final_rank  integer,
  granted_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);

-- 7) 점수 변화 기록(감사용 — 수정·삭제 없이 쌓기만)
create table if not exists public.fighter_rating_history (
  id          bigint generated always as identity primary key,
  season_id   smallint not null references public.fighter_seasons(id),
  user_id     uuid not null references auth.users(id) on delete cascade,
  match_id    bigint references public.fighter_matches(id) on delete set null,
  kind        text not null check (kind in ('match', 'season_reset', 'admin')),
  mmr_delta   integer not null, rp_delta integer not null,
  mmr_after   integer not null, rp_after integer not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists fighter_rating_history_user on public.fighter_rating_history (user_id, created_at desc);

-- ===== 티어(RP 기준, 화면 표시용) =====
create or replace function public.fighter_tier(p_rp integer, p_placements smallint)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case when p_placements < 5 then 'unranked'
              when p_rp >= 3000 then 'master' when p_rp >= 2500 then 'diamond' when p_rp >= 2000 then 'platinum'
              when p_rp >= 1500 then 'gold'   when p_rp >= 1000 then 'silver'  else 'bronze' end
$$;

-- ===== 경기 결과 기록(원자적) =====
-- 서버(service_role)만 호출. 한 트랜잭션 안에서: 중복 확인 → 두 사람 점수 행 잠금(항상 같은 순서) → 계산 → 6개 테이블 갱신.
create or replace function public.fighter_record_match(
  p_match_key text, p_winner_side smallint, p_reason text, p_frames integer, p_wins smallint[],
  p_user0 uuid, p_char0 text, p_user1 uuid, p_char1 text, p_verified boolean, p_replay_hash bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s_id smallint; mid bigint; r0 public.fighter_player_ratings; r1 public.fighter_player_ratings;
  exp0 numeric; k0 int; k1 int; d0 int; d1 int; rp0 int; rp1 int; w0 boolean;
  b_mmr0 int; b_mmr1 int; b_rp0 int; b_rp1 int;
begin
  if p_user0 is null or p_user1 is null or p_user0 = p_user1 then raise exception 'BAD_PLAYERS'; end if;
  if p_winner_side not in (0, 1) then raise exception 'BAD_WINNER'; end if;
  -- 확인 안 된 KO/시간 결과는 랭크에 반영하지 않음(기권은 서버가 직접 판정한 것이라 허용)
  if not p_verified and p_reason in ('ko', 'time') then raise exception 'UNVERIFIED'; end if;

  select id into s_id from public.fighter_seasons where is_active and now() between starts_at and ends_at;
  if s_id is null then raise exception 'NO_ACTIVE_SEASON'; end if;

  -- 같은 경기 재기록 방지(재시도해도 안전)
  insert into public.fighter_matches (season_id, match_key, winner_side, reason, frames, wins, verified, replay_hash)
  values (s_id, p_match_key, p_winner_side, p_reason, p_frames, p_wins, p_verified, p_replay_hash)
  on conflict (match_key) do nothing returning id into mid;
  if mid is null then return jsonb_build_object('ok', true, 'duplicate', true); end if;

  insert into public.fighter_player_ratings (season_id, user_id) values (s_id, p_user0), (s_id, p_user1) on conflict do nothing;
  -- 교착 방지: user_id 순서로 잠금
  perform 1 from public.fighter_player_ratings where season_id = s_id and user_id in (p_user0, p_user1) order by user_id for update;
  select * into r0 from public.fighter_player_ratings where season_id = s_id and user_id = p_user0;
  select * into r1 from public.fighter_player_ratings where season_id = s_id and user_id = p_user1;

  b_mmr0 := r0.mmr; b_mmr1 := r1.mmr; b_rp0 := r0.rp; b_rp1 := r1.rp;
  -- MMR: 엘로. 배치 5판 동안은 K=64, 이후 32
  w0 := p_winner_side = 0;
  exp0 := 1 / (1 + power(10::numeric, (r1.mmr - r0.mmr) / 400.0));
  k0 := case when r0.placements < 5 then 64 else 32 end;
  k1 := case when r1.placements < 5 then 64 else 32 end;
  d0 := round(k0 * ((case when w0 then 1 else 0 end) - exp0));
  d1 := round(k1 * ((case when w0 then 0 else 1 end) - (1 - exp0)));
  -- RP: 이기면 +18~+30(MMR가 RP보다 높을수록 더), 지면 -12~-24, 0 밑으로 안 내려감. 배치 중엔 RP 대신 MMR만
  rp0 := case when r0.placements < 5 then 0 when w0 then 24 + least(6, greatest(-6, (r0.mmr - 1200 - r0.rp / 3) / 100)) else -(18 - least(6, greatest(-6, (r0.mmr - 1200 - r0.rp / 3) / 100))) end;
  rp1 := case when r1.placements < 5 then 0 when not w0 then 24 + least(6, greatest(-6, (r1.mmr - 1200 - r1.rp / 3) / 100)) else -(18 - least(6, greatest(-6, (r1.mmr - 1200 - r1.rp / 3) / 100))) end;
  -- 배치 마지막(5번째) 경기에서 첫 RP 부여: MMR 기준
  if r0.placements = 4 then rp0 := greatest(0, (r0.mmr + d0 - 900) * 2); end if;
  if r1.placements = 4 then rp1 := greatest(0, (r1.mmr + d1 - 900) * 2); end if;

  update public.fighter_player_ratings set mmr = least(5000, greatest(0, mmr + d0)), rp = greatest(0, rp + rp0), placements = least(placements + 1, 100),
    streak = case when w0 then greatest(streak, 0) + 1 else least(streak, 0) - 1 end, updated_at = now()
  where season_id = s_id and user_id = p_user0 returning * into r0;
  update public.fighter_player_ratings set mmr = least(5000, greatest(0, mmr + d1)), rp = greatest(0, rp + rp1), placements = least(placements + 1, 100),
    streak = case when not w0 then greatest(streak, 0) + 1 else least(streak, 0) - 1 end, updated_at = now()
  where season_id = s_id and user_id = p_user1 returning * into r1;

  -- 실제 변화량(0·5000 경계에서 잘린 값)으로 기록
  d0 := r0.mmr - b_mmr0; d1 := r1.mmr - b_mmr1; rp0 := r0.rp - b_rp0; rp1 := r1.rp - b_rp1;
  insert into public.fighter_match_players (match_id, side, user_id, char_id, result, mmr_before, mmr_after, rp_before, rp_after) values
    (mid, 0, p_user0, p_char0, case when w0 then 'win' else 'loss' end, b_mmr0, r0.mmr, b_rp0, r0.rp),
    (mid, 1, p_user1, p_char1, case when w0 then 'loss' else 'win' end, b_mmr1, r1.mmr, b_rp1, r1.rp);

  insert into public.fighter_season_stats (season_id, user_id, char_id, wins, losses) values
    (s_id, p_user0, p_char0, case when w0 then 1 else 0 end, case when w0 then 0 else 1 end),
    (s_id, p_user0, 'all',   case when w0 then 1 else 0 end, case when w0 then 0 else 1 end),
    (s_id, p_user1, p_char1, case when w0 then 0 else 1 end, case when w0 then 1 else 0 end),
    (s_id, p_user1, 'all',   case when w0 then 0 else 1 end, case when w0 then 1 else 0 end)
  on conflict (season_id, user_id, char_id) do update set wins = fighter_season_stats.wins + excluded.wins, losses = fighter_season_stats.losses + excluded.losses;

  insert into public.fighter_rating_history (season_id, user_id, match_id, kind, mmr_delta, rp_delta, mmr_after, rp_after) values
    (s_id, p_user0, mid, 'match', d0, rp0, r0.mmr, r0.rp), (s_id, p_user1, mid, 'match', d1, rp1, r1.mmr, r1.rp);

  return jsonb_build_object('ok', true, 'match_id', mid, 'season', s_id,
    'p0', jsonb_build_object('mmr', r0.mmr, 'mmr_delta', d0, 'rp', r0.rp, 'tier', public.fighter_tier(r0.rp, r0.placements)),
    'p1', jsonb_build_object('mmr', r1.mmr, 'mmr_delta', d1, 'rp', r1.rp, 'tier', public.fighter_tier(r1.rp, r1.placements)));
end $$;

-- ===== 시즌 넘기기(소프트 리셋) — 서버/관리자만 =====
-- 이전 시즌 보상 기록 → 새 시즌 MMR = 1200 + (이전-1200)×soft_reset, RP 0, 배치 다시 5판
create or replace function public.fighter_season_rollover(p_new_id smallint, p_name text, p_starts timestamptz, p_ends timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare old public.fighter_seasons; n int := 0;
begin
  select * into old from public.fighter_seasons where is_active for update;
  if old.id is not null then
    insert into public.fighter_rank_rewards (season_id, user_id, tier, final_rp, final_rank)
    select old.id, user_id, public.fighter_tier(rp, placements), rp,
           case when placements >= 5 then rank() over (order by (placements >= 5) desc, rp desc, mmr desc) end
    from public.fighter_player_ratings where season_id = old.id
    on conflict (season_id, user_id) do nothing;
    update public.fighter_seasons set is_active = false where id = old.id;
  end if;
  insert into public.fighter_seasons (id, name, starts_at, ends_at, is_active, soft_reset)
  values (p_new_id, p_name, p_starts, p_ends, true, coalesce(old.soft_reset, 0.50));
  if old.id is not null then
    insert into public.fighter_player_ratings (season_id, user_id, mmr, rp, placements, streak)
    select p_new_id, user_id, round(1200 + (mmr - 1200) * old.soft_reset), 0, 0, 0
    from public.fighter_player_ratings where season_id = old.id;
    get diagnostics n = row_count;
    insert into public.fighter_rating_history (season_id, user_id, kind, mmr_delta, rp_delta, mmr_after, rp_after, note)
    select p_new_id, r.user_id, 'season_reset', r.mmr - o.mmr, -o.rp, r.mmr, 0, 'season ' || old.id || ' → ' || p_new_id
    from public.fighter_player_ratings r join public.fighter_player_ratings o on o.user_id = r.user_id and o.season_id = old.id
    where r.season_id = p_new_id;
  end if;
  return jsonb_build_object('ok', true, 'prev', old.id, 'new', p_new_id, 'carried', n);
end $$;

-- ===== 순위표(공개) — 배치 끝난 사람만, 닉네임은 profiles 에서 =====
create or replace view public.fighter_leaderboard_v with (security_invoker = true) as
select r.season_id, r.user_id, p.nickname, p.avatar_url, r.rp, r.placements, public.fighter_tier(r.rp, r.placements) as tier,
       s.wins, s.losses, rank() over (partition by r.season_id order by r.rp desc, r.mmr desc) as rank
from public.fighter_player_ratings r
join public.profiles p on p.id = r.user_id
left join public.fighter_season_stats s on s.season_id = r.season_id and s.user_id = r.user_id and s.char_id = 'all'
where r.placements >= 5;

-- ===== 권한(RLS) =====
alter table public.fighter_seasons        enable row level security;
alter table public.fighter_matches        enable row level security;
alter table public.fighter_match_players  enable row level security;
alter table public.fighter_player_ratings enable row level security;
alter table public.fighter_season_stats   enable row level security;
alter table public.fighter_rank_rewards   enable row level security;
alter table public.fighter_rating_history enable row level security;
-- 공개 읽기: 시즌·순위·전적 요약·보상 (MMR 숫자는 view 에 안 나감 — 테이블 직접 읽기는 본인 것만)
create policy fs_read  on public.fighter_seasons        for select using (true);
create policy fss_read on public.fighter_season_stats   for select using (true);
create policy frr_read on public.fighter_rank_rewards   for select using (true);
create policy fpr_read on public.fighter_player_ratings for select using (placements >= 5 or user_id = (select auth.uid()));
-- 본인만: 경기 상세·점수 변화 기록
create policy fmp_own  on public.fighter_match_players  for select using (user_id = (select auth.uid()));
create policy fm_own   on public.fighter_matches        for select using (exists (select 1 from public.fighter_match_players mp where mp.match_id = fighter_matches.id and mp.user_id = (select auth.uid())));
create policy frh_own  on public.fighter_rating_history for select using (user_id = (select auth.uid()));
-- 쓰기 정책 없음 = anon/authenticated 는 insert/update/delete 불가. 서버는 service_role(RLS 우회)로 RPC만 호출
revoke all on function public.fighter_record_match(text, smallint, text, integer, smallint[], uuid, text, uuid, text, boolean, bigint) from public, anon, authenticated;
revoke all on function public.fighter_season_rollover(smallint, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.fighter_record_match(text, smallint, text, integer, smallint[], uuid, text, uuid, text, boolean, bigint) to service_role;
grant execute on function public.fighter_season_rollover(smallint, text, timestamptz, timestamptz) to service_role;
grant select on public.fighter_leaderboard_v to anon, authenticated;
