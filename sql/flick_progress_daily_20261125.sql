-- 2026-11-25 증강 알까기 2차: 업적·칭호·도전 모드 별(flick_progress) + 오늘의 도전 랭킹(flick_daily)
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 표는 건드리지 않음.
-- 되돌리기: drop table if exists public.flick_progress; drop table if exists public.flick_daily;
create table if not exists public.flick_progress (
  player_key text primary key,              -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  stats jsonb not null default '{}'::jsonb, -- 누적 기록 + 도전 모드 단계별 별 (flick-data.js achApply)
  unlocked text[] not null default '{}',    -- 깬 업적 id
  equip jsonb not null default '{}'::jsonb, -- 쓰는 칭호 { t: 업적 id }
  ach_count integer not null default 0,
  plays integer not null default 0,
  stars integer not null default 0,         -- 도전 모드 별 합 (별 랭킹)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_flick_progress_user on public.flick_progress (user_id);
create index if not exists idx_flick_progress_stars on public.flick_progress (stars desc, ach_count desc);
alter table public.flick_progress enable row level security;

create table if not exists public.flick_daily (
  day date not null,
  player_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  best integer not null default 0,
  win boolean not null default false,
  tries integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, player_key),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_flick_daily_rank on public.flick_daily (day, best desc);
alter table public.flick_daily enable row level security;
