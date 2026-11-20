-- 플듀 눈치 진단소 (2026-11-20) — 서버 전용 표 (RLS 켬 · 정책 0 → 공개 키로 못 읽음)
create table if not exists public.nc_results (
  id text primary key, owner_key text not null, user_id uuid null references auth.users(id) on delete set null,
  nickname text not null, age int null, avatar jsonb null, avatar_url text null,
  mode text not null check (mode in ('normal','daily','bc','multi')), set_key text null,
  device text not null check (device in ('pc','mobile')), core_ver int not null default 1, seed bigint not null,
  total int not null, level int not null, type_id text not null, abil jsonb not null, diag jsonb not null,
  is_public boolean not null default true, flagged boolean not null default false, show_age boolean not null default false,
  is_streamer boolean not null default false, bc_id text null, group_id text null, created_at timestamptz not null default now()
);
create index if not exists nc_results_owner_idx on public.nc_results (owner_key, created_at desc);
create index if not exists nc_results_rank_idx on public.nc_results (mode, set_key, total desc) where is_public and not flagged;
create table if not exists public.nc_broadcasts (
  id text primary key, owner_key text not null, user_id uuid null references auth.users(id) on delete set null,
  title text not null, streamer_nick text not null, avatar_url text null, seed bigint not null, core_ver int not null default 1,
  status text not null default 'open' check (status in ('open','final')), closes_at timestamptz not null,
  final_stats jsonb null, finalized_at timestamptz null, created_at timestamptz not null default now()
);
create index if not exists nc_broadcasts_owner_idx on public.nc_broadcasts (owner_key, created_at desc);
create table if not exists public.nc_bc_entries (
  bc_id text not null references public.nc_broadcasts(id) on delete cascade, owner_key text not null,
  user_id uuid null references auth.users(id) on delete set null, result_id text null, nickname text not null,
  show_name boolean not null default true, is_member boolean not null default false, is_streamer boolean not null default false,
  device text not null check (device in ('pc','mobile')), total int not null, level int not null, type_id text not null, games jsonb null,
  flagged boolean not null default false, created_at timestamptz not null default now(), primary key (bc_id, owner_key)
);
create table if not exists public.nc_bc_predictions (
  bc_id text not null references public.nc_broadcasts(id) on delete cascade, owner_key text not null, nickname text not null,
  guess numeric(4,1) not null check (guess between 0 and 100), created_at timestamptz not null default now(), primary key (bc_id, owner_key)
);
-- 다수 예측: 지금까지 모든 사람이 고른 답 개수 (개인 정보 없음)
create table if not exists public.nc_crowd (q text not null, o int not null, n bigint not null default 0, primary key (q, o));
alter table public.nc_results enable row level security;
alter table public.nc_broadcasts enable row level security;
alter table public.nc_bc_entries enable row level security;
alter table public.nc_bc_predictions enable row level security;
alter table public.nc_crowd enable row level security;
-- 종합 능력 프로필 대표 진단서에 눈치 추가
alter table public.ability_profiles drop constraint if exists ability_profiles_rep_kind_check;
alter table public.ability_profiles add constraint ability_profiles_rep_kind_check check (rep_kind = any (array['clinic','iq','mind','sense','know','feel','lingo','gamelab','zombie','bungeo','nunchi']));
-- 회원탈퇴 함수: 운영 함수 원문에서 'bb' 뒤에 'nc', 'bb_results' 뒤에 'nc_results'만 추가해 다시 만듦 (적용할 때 운영 원문 기준으로)
-- 되돌리기: drop table public.nc_bc_predictions, public.nc_bc_entries, public.nc_broadcasts, public.nc_results, public.nc_crowd;
