-- ============================================================
-- 피해피해 (DUO Dodge) — 점수 / 랭킹 스키마
-- 2026-05-16
-- 솔로 무한 도전 — 로그인 유저만 공식 랭킹 (게스트는 로컬 베스트)
-- ============================================================

create table if not exists dodge_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,                       -- 비로그인 식별자
  nickname        text,                       -- 노출용 닉네임 (스냅샷)
  score           int not null check (score >= 0),
  kills           int not null default 0 check (kills >= 0),
  level_max       int not null default 1 check (level_max >= 1),
  duration_sec    int not null check (duration_sec >= 0),
  flagged         boolean default false,      -- sanity 위반
  room_id         text,                       -- 멀티 대회 진행 시
  client_run_id   text,                       -- 1회 게임 식별자
  created_at      timestamptz default now()
);

-- UNIQUE: 1회 게임 중복 제출 방어
create unique index if not exists ux_dodge_scores_client_run_id
  on dodge_scores (client_run_id) where client_run_id is not null;

-- 인덱스
create index if not exists idx_dodge_scores_score_desc
  on dodge_scores (score desc, created_at desc) where flagged = false;

create index if not exists idx_dodge_scores_daily
  on dodge_scores (created_at desc) where flagged = false;

create index if not exists idx_dodge_scores_user_id
  on dodge_scores (user_id) where user_id is not null;

-- RLS: service_role만 INSERT/SELECT
alter table dodge_scores enable row level security;

drop policy if exists "dodge_scores select service" on dodge_scores;
create policy "dodge_scores select service" on dodge_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "dodge_scores insert service" on dodge_scores;
create policy "dodge_scores insert service" on dodge_scores
  for insert with check (auth.role() = 'service_role');
