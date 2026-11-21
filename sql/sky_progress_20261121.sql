-- 2026-11-21 증강 공중전: 업적·꾸미기 기록 (회원 + 게스트)
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 표는 건드리지 않음.
-- 되돌리기: drop table if exists public.sky_progress;
create table if not exists public.sky_progress (
  player_key text primary key,              -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  stats jsonb not null default '{}'::jsonb, -- 누적·한 판 최고 기록 (sky-data.js achApply)
  unlocked text[] not null default '{}',    -- 깬 업적 id
  equip jsonb not null default '{}'::jsonb, -- 쓰는 꾸미기 { c: 색 id, t: 칭호 업적 id }
  ach_count integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_sky_progress_user on public.sky_progress (user_id);
create index if not exists idx_sky_progress_ach on public.sky_progress (ach_count desc, updated_at);
alter table public.sky_progress enable row level security;
