-- 게이머 에이징 커브 진단소 (2026-10-31)
-- 새 테이블 3개만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
begin;

create table if not exists public.clinic_results (
  id          text primary key,
  owner_key   text not null,              -- u:<user id> | g:<guest id> (외부로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  gender      text not null check (gender in ('m','f')),
  age         int  not null check (age between 7 and 99),
  avatar      jsonb not null default '{}',
  mode        text not null check (mode in ('full','quick')),
  device      text not null check (device in ('pc','mobile')),
  scores      jsonb not null,
  metrics     jsonb not null,
  total       int  not null,
  phys        int  not null,
  diff        int  not null,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false,
  show_gender boolean not null default true,   -- 공유 링크·랭킹에 성별 표시
  show_age    boolean not null default true,   -- 공유 링크·랭킹에 실제 나이(·나이 차이) 표시
  avatar_url  text null,                       -- 회원 프로필 이미지 (플레이듀오 profiles에서 복사)
  group_id    text null,
  rank        int null,
  rank_of     int null,
  created_at  timestamptz not null default now()
);
create index if not exists clinic_results_owner_idx on public.clinic_results (owner_key, created_at desc);
create index if not exists clinic_results_rank_idx on public.clinic_results (mode, device, total desc) where is_public and not flagged;
create index if not exists clinic_results_created_idx on public.clinic_results (created_at desc);
create index if not exists clinic_results_user_idx on public.clinic_results (user_id);

create table if not exists public.clinic_best (
  owner_key   text not null,
  user_id     uuid null references auth.users(id) on delete cascade,
  nickname    text null,
  test_id     text not null,
  device      text not null check (device in ('pc','mobile')),
  score       int  not null,
  m           jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (owner_key, test_id, device)
);
create index if not exists clinic_best_rank_idx on public.clinic_best (test_id, device, score desc);
create index if not exists clinic_best_user_idx on public.clinic_best (user_id);

-- 진단소 전용 접수 정보 (회원 profiles 테이블은 건드리지 않음)
create table if not exists public.clinic_profiles (
  owner_key   text primary key,               -- u:<user id> | g:<guest id>
  user_id     uuid null references auth.users(id) on delete cascade,
  nickname    text not null,
  gender      text not null check (gender in ('m','f')),
  age         int  not null check (age between 7 and 99),
  avatar      jsonb not null default '{}',
  prefs       jsonb not null default '{}',     -- showGender / showAge / shareMulti
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists clinic_profiles_user_idx on public.clinic_profiles (user_id);

create table if not exists public.clinic_groups (
  id          text primary key,
  host_key    text not null,
  mode        text not null,
  tests       jsonb not null,
  players     jsonb not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists clinic_groups_created_idx on public.clinic_groups (created_at desc);

alter table public.clinic_results enable row level security;
alter table public.clinic_best    enable row level security;
alter table public.clinic_groups  enable row level security;
alter table public.clinic_profiles enable row level security;

commit;

-- 2026-10-31 추가: 스트리머 랭킹
alter table public.clinic_results add column if not exists is_streamer boolean not null default false;
create index if not exists clinic_results_streamer_idx on public.clinic_results (device, total desc) where is_streamer and is_public;

-- 되돌리기: drop table public.clinic_results, public.clinic_best, public.clinic_groups, public.clinic_profiles;
