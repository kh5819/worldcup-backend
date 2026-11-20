-- 플듀 붕어빵 장사 진단소 (2026-11-20) — 서버 전용 표 (RLS 켬 · 정책 0 → 공개 키로 못 읽음)
begin;
create table if not exists public.bb_results (
  id          text primary key,
  owner_key   text not null,
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int null,
  avatar      jsonb null,
  avatar_url  text null,
  mode        text not null check (mode in ('normal','daily','bc','multi')),
  set_key     text null,
  device      text not null check (device in ('pc','mobile')),
  core_ver    int not null default 1,
  seed        bigint not null,
  months      int not null,
  survived    boolean not null default false,
  cash        bigint not null,
  profit      bigint not null,
  score       int not null,
  cause       text null,
  type_id     text not null,
  abil        jsonb not null,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false,
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  bc_id       text null,
  group_id    text null,
  created_at  timestamptz not null default now()
);
create index if not exists bb_results_owner_idx on public.bb_results (owner_key, created_at desc);
create index if not exists bb_results_rank_idx on public.bb_results (mode, set_key, score desc) where is_public and not flagged;

create table if not exists public.bb_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  seed          bigint not null,
  core_ver      int not null default 1,
  status        text not null default 'open' check (status in ('open','final')),
  closes_at     timestamptz not null,
  final_stats   jsonb null,
  finalized_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists bb_broadcasts_owner_idx on public.bb_broadcasts (owner_key, created_at desc);

create table if not exists public.bb_bc_entries (
  bc_id       text not null references public.bb_broadcasts(id) on delete cascade,
  owner_key   text not null,
  user_id     uuid null references auth.users(id) on delete set null,
  result_id   text null,
  nickname    text not null,
  show_name   boolean not null default true,
  is_member   boolean not null default false,
  is_streamer boolean not null default false,
  device      text not null check (device in ('pc','mobile')),
  months      int not null,
  survived    boolean not null default false,
  profit      bigint not null,
  score       int not null,
  cause       text null,
  type_id     text not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);
create table if not exists public.bb_bc_predictions (
  bc_id       text not null references public.bb_broadcasts(id) on delete cascade,
  owner_key   text not null,
  nickname    text not null,
  guess       numeric(4,1) not null check (guess between 1 and 12),
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);
alter table public.bb_results        enable row level security;
alter table public.bb_broadcasts     enable row level security;
alter table public.bb_bc_entries     enable row level security;
alter table public.bb_bc_predictions enable row level security;
commit;
-- 되돌리기: drop table public.bb_bc_predictions, public.bb_bc_entries, public.bb_broadcasts, public.bb_results;

-- 종합 능력 프로필: 대표 진단서로 붕어빵 장사 기록도 고를 수 있게 (기존 행은 그대로)
alter table public.ability_profiles drop constraint if exists ability_profiles_rep_kind_check;
alter table public.ability_profiles add constraint ability_profiles_rep_kind_check check (rep_kind = any (array['clinic','iq','mind','sense','know','feel','lingo','gamelab','zombie','bungeo']));
