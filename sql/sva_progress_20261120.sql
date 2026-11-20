-- 2026-11-20 증강 서바이벌 아레나: 업적·해금 기록 (회원 + 게스트)
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 표는 건드리지 않음.
-- 되돌리기: drop table if exists public.sva_progress;
create table if not exists public.sva_progress (
  player_key text primary key,              -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  stats jsonb not null default '{}'::jsonb, -- 누적·한 판 최고 기록 (sva-data.js achApply)
  unlocked text[] not null default '{}',    -- 깬 업적 id
  equip jsonb not null default '{}'::jsonb, -- 쓰는 꾸미기 { c: 색 id, t: 칭호 업적 id }
  ach_count integer not null default 0,
  plays integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_sva_progress_user on public.sva_progress (user_id);
create index if not exists idx_sva_progress_ach on public.sva_progress (ach_count desc, updated_at);
alter table public.sva_progress enable row level security;
