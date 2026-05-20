-- ============================================================
-- 메모리 카드 (DUO Memory) — 점수 / 랭킹 스키마
-- 2026-05-21
-- 솔로: 난이도별(4x4/6x6/8x8) 분리 랭킹. 로그인 유저당 난이도별 최고점 1 row.
-- 점수 공식: 1000 - (시간*2) - (오답시도*5) + (최대콤보*20)
-- ============================================================

create table if not exists memory_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,
  nickname        text,
  difficulty      int not null check (difficulty in (4, 6, 8)),  -- 4x4/6x6/8x8
  score           int not null check (score >= 0 and score <= 9999),
  attempts        int not null check (attempts >= 0 and attempts <= 999),
  matches         int not null default 0 check (matches >= 0 and matches <= 50),
  max_combo       int not null default 0 check (max_combo >= 0 and max_combo <= 50),
  duration_sec    int not null check (duration_sec >= 0 and duration_sec <= 999),
  seed            bigint,
  flagged         boolean default false,
  client_run_id   text,
  created_at      timestamptz default now()
);

-- UNIQUE: 1회 게임 중복 제출 방어
create unique index if not exists ux_memory_scores_client_run_id
  on memory_scores (client_run_id) where client_run_id is not null;

-- UNIQUE: 유저당 난이도별 1 row (최고점 UPSERT)
create unique index if not exists ux_memory_scores_user_diff
  on memory_scores (user_id, difficulty) where user_id is not null;

-- 인덱스: 난이도별 랭킹
create index if not exists idx_memory_scores_diff_score
  on memory_scores (difficulty, score desc, created_at desc) where flagged = false;

-- 인덱스: 일일 랭킹
create index if not exists idx_memory_scores_diff_daily
  on memory_scores (difficulty, created_at desc) where flagged = false;

-- RLS: service_role만 INSERT/SELECT
alter table memory_scores enable row level security;

drop policy if exists "memory_scores select service" on memory_scores;
create policy "memory_scores select service" on memory_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "memory_scores insert service" on memory_scores;
create policy "memory_scores insert service" on memory_scores
  for insert with check (auth.role() = 'service_role');

drop policy if exists "memory_scores update service" on memory_scores;
create policy "memory_scores update service" on memory_scores
  for update using (auth.role() = 'service_role');
