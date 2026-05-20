-- ============================================================
-- 사과게임 (DUO Apple / Fruit Box) — 점수 / 랭킹 스키마
-- 2026-05-21
-- 솔로 2분 도전 — 로그인 유저만 공식 랭킹 (게스트는 로컬 베스트)
-- ============================================================

create table if not exists apple_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,                       -- 비로그인 식별자
  nickname        text,                       -- 노출용 닉네임 (스냅샷)
  score           int not null check (score >= 0 and score <= 9999),
  apples_cleared  int not null default 0 check (apples_cleared >= 0 and apples_cleared <= 170),
  max_combo       int not null default 0 check (max_combo >= 0 and max_combo <= 50),
  duration_sec    int not null check (duration_sec >= 0 and duration_sec <= 130),
  seed            bigint,                     -- 격자 시드 (검증/재현용)
  flagged         boolean default false,      -- sanity 위반
  client_run_id   text,                       -- 1회 게임 식별자 (중복 방어)
  created_at      timestamptz default now()
);

-- UNIQUE: 1회 게임 중복 제출 방어
create unique index if not exists ux_apple_scores_client_run_id
  on apple_scores (client_run_id) where client_run_id is not null;

-- 인덱스: 전체 랭킹
create index if not exists idx_apple_scores_score_desc
  on apple_scores (score desc, created_at desc) where flagged = false;

-- 인덱스: 일일 랭킹
create index if not exists idx_apple_scores_daily
  on apple_scores (created_at desc) where flagged = false;

-- 인덱스: 유저별 조회 (+ 유저당 1 row 강제 — UPSERT 패턴)
create unique index if not exists ux_apple_scores_user_id
  on apple_scores (user_id) where user_id is not null;

-- RLS: service_role만 INSERT/SELECT (백엔드 통해서만)
alter table apple_scores enable row level security;

drop policy if exists "apple_scores select service" on apple_scores;
create policy "apple_scores select service" on apple_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "apple_scores insert service" on apple_scores;
create policy "apple_scores insert service" on apple_scores
  for insert with check (auth.role() = 'service_role');
