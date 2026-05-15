-- ============================================================
-- 수라상 (한식 진화형 합성 게임) — 점수 / 랭킹 스키마
-- 2026-05-15
-- 솔로(엔드리스/챌린지) + (추후) 멀티 모두 이 테이블 사용
-- 2026-05-15 (v2): mode 컬럼 추가 (엔드리스/챌린지 랭킹 분리)
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

-- mode 컬럼 추가 (재실행 안전)
alter table merge_scores add column if not exists mode text not null default 'endless';
alter table merge_scores drop constraint if exists merge_scores_mode_check;
alter table merge_scores add constraint merge_scores_mode_check check (mode in ('endless', 'challenge'));

-- client_run_id: 클라이언트 1회 게임 식별자 — pending score 중복 제출 방어
alter table merge_scores add column if not exists client_run_id text;
create unique index if not exists ux_merge_scores_client_run_id
  on merge_scores (client_run_id) where client_run_id is not null;

-- 인덱스
create index if not exists idx_merge_scores_score_desc
  on merge_scores (score desc, created_at desc) where flagged = false;

create index if not exists idx_merge_scores_daily
  on merge_scores (created_at desc) where flagged = false;

create index if not exists idx_merge_scores_user_id
  on merge_scores (user_id) where user_id is not null;

create index if not exists idx_merge_scores_room_id
  on merge_scores (room_id) where room_id is not null;

create index if not exists idx_merge_scores_mode_score
  on merge_scores (mode, score desc, created_at desc) where flagged = false;

-- RLS: service_role만 INSERT/SELECT
alter table merge_scores enable row level security;

drop policy if exists "merge_scores select service" on merge_scores;
create policy "merge_scores select service" on merge_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "merge_scores insert service" on merge_scores;
create policy "merge_scores insert service" on merge_scores
  for insert with check (auth.role() = 'service_role');

-- 사용자별 BEST 점수 view (리더보드용)
-- distinct on (mode, 식별자) + score desc → 한 모드/한 명당 한 행
create or replace view merge_top_scores_v as
select distinct on (mode, coalesce(user_id::text, guest_id))
  id, user_id, guest_id, nickname, score, max_stage,
  combo_max, duration_sec, season, room_id, mode, created_at
from merge_scores
where flagged = false
  and (user_id is not null or guest_id is not null)
order by mode, coalesce(user_id::text, guest_id), score desc, created_at asc;
