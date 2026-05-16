-- ============================================================
-- 지켜라 (가챠 TD) — 점수 / 랭킹 스키마
-- 2026-05-16
-- 솔로 전용 랭킹 — 로그인 유저만 공식 등록 (게스트는 로컬 베스트)
-- ============================================================

create table if not exists gachatd_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,                       -- 비로그인 식별자
  nickname        text,                       -- 노출용 닉네임 (스냅샷)
  score           int not null check (score >= 0),
  wave_max        int not null default 0 check (wave_max >= 0),
  kills           int not null default 0 check (kills >= 0),
  pulls           int not null default 0 check (pulls >= 0),
  leader_key      text,                       -- 'archer'|'aoe'|'slow'|'burst'|'gold'
  endless         boolean default false,      -- 엔드리스 모드 도달 여부
  duration_sec    int not null default 0,
  flagged         boolean default false,      -- sanity 위반
  client_run_id   text,                       -- 1회 게임 식별자
  created_at      timestamptz default now()
);

-- UNIQUE: 1회 게임 중복 제출 방어
create unique index if not exists ux_gachatd_scores_client_run_id
  on gachatd_scores (client_run_id) where client_run_id is not null;

-- 인덱스
create index if not exists idx_gachatd_scores_score_desc
  on gachatd_scores (score desc, created_at desc) where flagged = false;

create index if not exists idx_gachatd_scores_daily
  on gachatd_scores (created_at desc) where flagged = false;

create index if not exists idx_gachatd_scores_user_id
  on gachatd_scores (user_id) where user_id is not null;

-- RLS: service_role만 INSERT/SELECT
alter table gachatd_scores enable row level security;

drop policy if exists "gachatd_scores select service" on gachatd_scores;
create policy "gachatd_scores select service" on gachatd_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "gachatd_scores insert service" on gachatd_scores;
create policy "gachatd_scores insert service" on gachatd_scores
  for insert with check (auth.role() = 'service_role');
