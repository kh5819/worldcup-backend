-- 플듀 감각 진단소: 친구와 대결 + 스트리머 모드 (2026-11-07) — 승인 후 실행
-- 새 테이블 3개 + feel_results에 칸 2개(group_id·bc_id, 비어 있어도 됨) 추가. 기존 행·다른 테이블은 그대로
-- RLS 켬 + 정책 0 = 백엔드(service_role) 전용. 여러 번 실행해도 안전
begin;
alter table public.feel_results add column if not exists group_id text null;
alter table public.feel_results add column if not exists bc_id text null;
create index if not exists feel_results_group_idx on public.feel_results (group_id) where group_id is not null;

create table if not exists public.feel_groups (
  id          text primary key,
  host_key    text not null,
  diff        text not null,
  tests       jsonb not null,
  players     jsonb not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists feel_groups_created_idx on public.feel_groups (created_at desc);

create table if not exists public.feel_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  diff          text not null check (diff in ('normal','hard','expert')),
  set_ver       text not null,
  status        text not null default 'open' check (status in ('wait','open','final')),
  closes_at     timestamptz not null,
  settings      jsonb not null default '{}',
  final_stats   jsonb null,
  finalized_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists feel_broadcasts_owner_idx on public.feel_broadcasts (owner_key, created_at desc);
create index if not exists feel_broadcasts_final_idx on public.feel_broadcasts (diff, finalized_at desc) where status = 'final';

create table if not exists public.feel_bc_entries (
  bc_id       text not null references public.feel_broadcasts(id) on delete cascade,
  owner_key   text not null,
  user_id     uuid null references auth.users(id) on delete set null,
  result_id   text null,
  nickname    text not null,
  show_name   boolean not null default true,
  is_member   boolean not null default false,
  is_streamer boolean not null default false,
  device      text not null check (device in ('pc','mobile')),
  total       int  not null,
  tier        text not null,
  style       text null,
  areas       jsonb not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);
create index if not exists feel_bc_entries_rank_idx on public.feel_bc_entries (bc_id, total desc);

alter table public.feel_groups enable row level security;
alter table public.feel_broadcasts enable row level security;
alter table public.feel_bc_entries enable row level security;
commit;
-- 되돌리기: drop table if exists public.feel_bc_entries; drop table if exists public.feel_broadcasts; drop table if exists public.feel_groups; alter table public.feel_results drop column if exists group_id, drop column if exists bc_id;
