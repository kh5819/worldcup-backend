-- ============================================================
-- 수라상 (한식 진화형 합성 게임) — 점수 / 랭킹 스키마
-- 2026-05-15
-- 솔로 + (추후) 멀티 모두 이 테이블 사용
-- ============================================================

create table if not exists merge_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,                       -- 비로그인 식별자
  nickname        text,                       -- 노출용 닉네임 (스냅샷)
  score           int not null,
  max_stage       int not null check (max_stage between 1 and 11),
  duration_sec    int not null check (duration_sec >= 0),
  combo_max       numeric(3,1) default 1.0,
  season          text default 'spring2026',
  flagged         boolean default false,      -- sanity 위반(부정의심)
  room_id         text,                       -- 멀티 대회 진행 시 (솔로=null)
  created_at      timestamptz default now()
);

-- 인덱스
create index if not exists idx_merge_scores_score_desc
  on merge_scores (score desc, created_at desc) where flagged = false;

create index if not exists idx_merge_scores_daily
  on merge_scores (created_at desc) where flagged = false;

create index if not exists idx_merge_scores_user_id
  on merge_scores (user_id) where user_id is not null;

create index if not exists idx_merge_scores_room_id
  on merge_scores (room_id) where room_id is not null;

-- RLS: service_role만 INSERT/SELECT
alter table merge_scores enable row level security;

drop policy if exists "merge_scores select service" on merge_scores;
create policy "merge_scores select service" on merge_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "merge_scores insert service" on merge_scores;
create policy "merge_scores insert service" on merge_scores
  for insert with check (auth.role() = 'service_role');

-- 사용자별 BEST 점수 view (리더보드용)
-- distinct on (식별자) + score desc → 한 명당 한 행
create or replace view merge_top_scores_v as
select distinct on (coalesce(user_id::text, guest_id))
  id, user_id, guest_id, nickname, score, max_stage,
  combo_max, duration_sec, season, room_id, created_at
from merge_scores
where flagged = false
  and (user_id is not null or guest_id is not null)
order by coalesce(user_id::text, guest_id), score desc, created_at asc;
