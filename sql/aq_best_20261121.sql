-- 2026-11-21 증강 물고기 키우기: 최고 크기 랭킹 (회원 + 게스트, 사람당 1줄)
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 표는 건드리지 않음.
-- 되돌리기: drop table if exists public.aq_best;
create table if not exists public.aq_best (
  player_key text primary key,              -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  best integer not null default 0,          -- 한 판 최고 크기 (서버 확정값)
  eats integer not null default 0,          -- 그 판에 먹은 물고기
  games integer not null default 0,         -- 한 판 수
  mode text,
  best_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_aq_best_rank on public.aq_best (best desc, best_at);
create index if not exists idx_aq_best_user on public.aq_best (user_id);
alter table public.aq_best enable row level security;
