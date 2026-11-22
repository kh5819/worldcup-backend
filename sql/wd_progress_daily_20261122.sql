-- 2026-11-22 플듀 끝말잇기 2차: 업적·꾸미기(wd_progress) + 오늘의 도전 랭킹(wd_daily). 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음)
-- 기존 표·멀티·채팅에는 손대지 않음 (새 표 2개만)
-- 되돌리기: drop table if exists public.wd_progress; drop table if exists public.wd_daily;
create table if not exists public.wd_progress (
  player_key text primary key, user_id uuid references auth.users(id) on delete cascade, guest_id text, nickname text,
  stats jsonb not null default '{}'::jsonb, unlocked text[] not null default '{}', equip jsonb not null default '{}'::jsonb,
  ach_count integer not null default 0, plays integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_wd_progress_user on public.wd_progress (user_id);
alter table public.wd_progress enable row level security;
create table if not exists public.wd_daily (
  day date not null, player_key text not null, user_id uuid references auth.users(id) on delete cascade, guest_id text, nickname text,
  best integer not null default 0, words integer not null default 0, tries integer not null default 0, updated_at timestamptz not null default now(),
  primary key (day, player_key), check (user_id is not null or guest_id is not null)
);
create index if not exists idx_wd_daily_rank on public.wd_daily (day, best desc);
alter table public.wd_daily enable row level security;
