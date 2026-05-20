-- ============================================================
-- 블록 블래스트 (DUO BlockBlast / 1010!) — 점수 / 랭킹 스키마
-- 2026-05-21
-- 솔로 무한 점수 도전. 로그인 유저만 공식 랭킹. UPSERT (최고점만).
-- 게임 끝: 다음 3 블록 중 어느 것도 놓을 자리 없을 때
-- ============================================================

create table if not exists blockblast_scores (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  guest_id        text,
  nickname        text,
  score           int not null check (score >= 0 and score <= 999999),
  lines_cleared   int not null default 0 check (lines_cleared >= 0 and lines_cleared <= 9999),
  blocks_placed   int not null default 0 check (blocks_placed >= 0 and blocks_placed <= 9999),
  max_combo       int not null default 0 check (max_combo >= 0 and max_combo <= 50),
  duration_sec    int not null check (duration_sec >= 0 and duration_sec <= 7200),
  seed            bigint,
  flagged         boolean default false,
  client_run_id   text,
  created_at      timestamptz default now()
);

create unique index if not exists ux_blockblast_scores_client_run_id
  on blockblast_scores (client_run_id) where client_run_id is not null;

create unique index if not exists ux_blockblast_scores_user_id
  on blockblast_scores (user_id) where user_id is not null;

create index if not exists idx_blockblast_scores_score_desc
  on blockblast_scores (score desc, created_at desc) where flagged = false;

create index if not exists idx_blockblast_scores_daily
  on blockblast_scores (created_at desc) where flagged = false;

alter table blockblast_scores enable row level security;

drop policy if exists "blockblast_scores select service" on blockblast_scores;
create policy "blockblast_scores select service" on blockblast_scores
  for select using (auth.role() = 'service_role');

drop policy if exists "blockblast_scores insert service" on blockblast_scores;
create policy "blockblast_scores insert service" on blockblast_scores
  for insert with check (auth.role() = 'service_role');

drop policy if exists "blockblast_scores update service" on blockblast_scores;
create policy "blockblast_scores update service" on blockblast_scores
  for update using (auth.role() = 'service_role');
