-- 플듀 게임 센스 진단소 (2026-11-02)
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 여러 번 실행해도 안전(if not exists). 되돌리기: 맨 아래 drop 문
begin;

create table if not exists public.sense_results (
  id          text primary key,
  owner_key   text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),
  avatar      jsonb not null default '{}',
  avatar_url  text null,
  mode        text not null check (mode in ('quick','full')),   -- 빠른·정밀 따로 저장·순위
  set_ver     text not null,                 -- 채점 버전 (다르면 같은 순위에 안 섞음)
  device      text not null check (device in ('pc','mobile')),
  scores      jsonb not null,                -- 검사별 0~100
  metrics     jsonb not null,                -- 검사별 세부 기록·의심 표시
  total       int  not null check (total between 0 and 1000),
  areas       jsonb not null,                -- 6영역 0~100
  tier        text not null,
  style       text not null,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false,   -- 기록 이상 → 랭킹 제외
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  group_id    text null,
  bc_id       text null,
  rank        int null,
  rank_of     int null,
  created_at  timestamptz not null default now()
);
create index if not exists sense_results_owner_idx on public.sense_results (owner_key, created_at desc);
create index if not exists sense_results_rank_idx on public.sense_results (mode, set_ver, total desc) where is_public and not flagged;
create index if not exists sense_results_tier_idx on public.sense_results (mode, set_ver, tier) where not flagged;
create index if not exists sense_results_created_idx on public.sense_results (created_at desc);
create index if not exists sense_results_user_idx on public.sense_results (user_id);

create table if not exists public.sense_groups (
  id          text primary key,
  host_key    text not null,
  mode        text not null,
  players     jsonb not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists sense_groups_created_idx on public.sense_groups (created_at desc);

-- 스트리머 모드: 방송 진단소 · 시청자 기록 (한 방송에 한 사람 1개)
create table if not exists public.sense_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  mode          text not null check (mode in ('quick','full')),
  set_ver       text not null,
  status        text not null default 'open' check (status in ('wait','open','final')),   -- wait = 접수 대기(진행자가 시작 누르기 전)
  closes_at     timestamptz not null,
  settings      jsonb not null default '{}',
  final_stats   jsonb null,
  finalized_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists sense_broadcasts_owner_idx on public.sense_broadcasts (owner_key, created_at desc);
create index if not exists sense_broadcasts_final_idx on public.sense_broadcasts (mode, set_ver, finalized_at desc) where status = 'final';

create table if not exists public.sense_bc_entries (
  bc_id       text not null references public.sense_broadcasts(id) on delete cascade,
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
create index if not exists sense_bc_entries_rank_idx on public.sense_bc_entries (bc_id, total desc);

alter table public.sense_results enable row level security;
alter table public.sense_groups  enable row level security;
alter table public.sense_broadcasts enable row level security;
alter table public.sense_bc_entries enable row level security;

commit;

-- 되돌리기:
-- drop table if exists public.sense_bc_entries; drop table if exists public.sense_broadcasts; drop table if exists public.sense_groups; drop table if exists public.sense_results;
