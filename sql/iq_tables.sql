-- 플듀 IQ 테스트 진단소 (2026-11-01)
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 되돌리기: 맨 아래 drop 문
begin;

create table if not exists public.iq_results (
  id          text primary key,
  owner_key   text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),   -- 선택 정보 (점수 계산에 안 씀)
  avatar      jsonb not null default '{}',
  avatar_url  text null,
  mode        text not null check (mode in ('quick','full','daily','weekly')),
  set_key     text null,                     -- 오늘의 챌린지 날짜 / 주간 시작일
  set_ver     text not null,                 -- 채점·문제 생성 버전 (다르면 같은 순위에 안 섞음)
  device      text not null check (device in ('pc','mobile')),
  plan        jsonb not null,                -- [{type,d,seed}] 복습용 (문제 다시 만들기)
  items       jsonb not null,                -- 문항별 결과 [{type,d,area,ok,part,ms,lim,hint,timeout}]
  total       int  not null,
  iq          int  not null,
  areas       jsonb not null,
  correct     int  not null,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false, -- 순위 제외 (같은 챌린지 두 번째 기록 등)
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  group_id    text null,
  rank        int null,
  rank_of     int null,
  created_at  timestamptz not null default now()
);
create index if not exists iq_results_owner_idx on public.iq_results (owner_key, created_at desc);
create index if not exists iq_results_rank_idx on public.iq_results (mode, set_ver, total desc) where is_public and not flagged;
create index if not exists iq_results_set_idx on public.iq_results (mode, set_key, total desc) where is_public and not flagged;
create index if not exists iq_results_created_idx on public.iq_results (created_at desc);
create index if not exists iq_results_user_idx on public.iq_results (user_id);

create table if not exists public.iq_profiles (
  owner_key   text primary key,
  user_id     uuid null references auth.users(id) on delete cascade,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),
  avatar      jsonb not null default '{}',
  prefs       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists iq_profiles_user_idx on public.iq_profiles (user_id);

create table if not exists public.iq_groups (
  id          text primary key,
  host_key    text not null,
  mode        text not null,
  players     jsonb not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists iq_groups_created_idx on public.iq_groups (created_at desc);

create table if not exists public.iq_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  mode          text not null check (mode in ('quick','full')),
  set_ver       text not null,
  status        text not null default 'open' check (status in ('open','final')),
  closes_at     timestamptz not null,
  final_stats   jsonb null,
  finalized_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists iq_broadcasts_owner_idx on public.iq_broadcasts (owner_key, created_at desc);
create index if not exists iq_broadcasts_final_idx on public.iq_broadcasts (mode, set_ver, finalized_at desc) where status = 'final';

create table if not exists public.iq_bc_entries (
  bc_id       text not null references public.iq_broadcasts(id) on delete cascade,
  owner_key   text not null,                 -- 한 방송에 한 사람 1개 (첫 완료 기록)
  user_id     uuid null references auth.users(id) on delete set null,
  result_id   text null,
  nickname    text not null,
  show_name   boolean not null default true,
  is_member   boolean not null default false,
  is_streamer boolean not null default false,
  device      text not null check (device in ('pc','mobile')),
  total       int not null,
  iq          int not null,
  areas       jsonb not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

create table if not exists public.iq_bc_predictions (
  bc_id       text not null references public.iq_broadcasts(id) on delete cascade,
  owner_key   text not null,
  nickname    text not null,
  guess       numeric(5,1) not null check (guess between 60 and 150),
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

alter table public.iq_results        enable row level security;
alter table public.iq_profiles       enable row level security;
alter table public.iq_groups         enable row level security;
alter table public.iq_broadcasts     enable row level security;
alter table public.iq_bc_entries     enable row level security;
alter table public.iq_bc_predictions enable row level security;

commit;

-- 되돌리기:
-- drop table public.iq_bc_predictions, public.iq_bc_entries, public.iq_broadcasts, public.iq_groups, public.iq_profiles, public.iq_results;
