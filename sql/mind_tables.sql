-- 플듀 심리전 능력 진단소 + 종합 능력 프로필 (2026-11-02)
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 여러 번 실행해도 안전(if not exists). 되돌리기: 맨 아래 drop 문
begin;

create table if not exists public.mind_results (
  id          text primary key,
  owner_key   text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),   -- 선택 정보 (점수 계산에 안 씀)
  avatar      jsonb not null default '{}',
  avatar_url  text null,
  mode        text not null check (mode in ('quick','full','m5','m10','m12')),
  lv          int  not null check (lv between 0 and 3),   -- 난이도 (다르면 같은 순위에 안 섞음)
  set_ver     text not null,                 -- 채점 버전 (다르면 같은 순위에 안 섞음)
  device      text not null check (device in ('pc','mobile')),
  items       jsonb not null,                -- 게임별 결과 [{g,lv,perf,win,detail,timeouts}]
  total       int  not null,
  areas       jsonb not null,
  wins        int  not null default 0,
  n           int  not null default 0,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false,
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  group_id    text null,
  bc_id       text null,
  rank        int null,
  rank_of     int null,
  created_at  timestamptz not null default now()
);
create index if not exists mind_results_owner_idx on public.mind_results (owner_key, created_at desc);
create index if not exists mind_results_rank_idx on public.mind_results (mode, lv, set_ver, total desc) where is_public and not flagged;
create index if not exists mind_results_created_idx on public.mind_results (created_at desc);
create index if not exists mind_results_user_idx on public.mind_results (user_id);

create table if not exists public.mind_groups (
  id          text primary key,
  host_key    text not null,
  mode        text not null,
  lv          int  not null,
  players     jsonb not null,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists mind_groups_created_idx on public.mind_groups (created_at desc);

create table if not exists public.mind_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  mode          text not null check (mode in ('quick','full')),
  lv            int  not null default 1,
  set_ver       text not null,
  status        text not null default 'open' check (status in ('open','final')),
  closes_at     timestamptz not null,
  settings      jsonb not null default '{}',  -- showQr, hideNicks, hideScores
  rounds        jsonb not null default '[]',  -- 공개가 끝난 투표 라운드 집계 (진행 중 표는 서버 메모리에만 봉인)
  final_stats   jsonb null,
  finalized_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists mind_broadcasts_owner_idx on public.mind_broadcasts (owner_key, created_at desc);
create index if not exists mind_broadcasts_final_idx on public.mind_broadcasts (mode, lv, set_ver, finalized_at desc) where status = 'final';

create table if not exists public.mind_bc_entries (
  bc_id       text not null references public.mind_broadcasts(id) on delete cascade,
  owner_key   text not null,                 -- 한 방송에 한 사람 1개 (첫 완료 기록)
  user_id     uuid null references auth.users(id) on delete set null,
  result_id   text null,
  nickname    text not null,
  show_name   boolean not null default true,
  is_member   boolean not null default false,
  is_streamer boolean not null default false,
  device      text not null check (device in ('pc','mobile')),
  total       int not null,
  areas       jsonb not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

create table if not exists public.mind_bc_voters (
  bc_id       text not null references public.mind_broadcasts(id) on delete cascade,
  owner_key   text not null,
  nickname    text not null,
  show_name   boolean not null default true,
  pts         int not null default 0,
  votes       int not null default 0,
  hits        int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

create table if not exists public.mind_bc_predictions (
  bc_id       text not null references public.mind_broadcasts(id) on delete cascade,
  owner_key   text not null,
  nickname    text not null,
  guess       numeric(5,1) not null check (guess between 0 and 100),
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

-- 플듀 종합 능력 프로필: 대표 진단서 (세 진단소 공통)
create table if not exists public.ability_profiles (
  owner_key   text primary key,
  user_id     uuid null references auth.users(id) on delete cascade,
  rep_kind    text null check (rep_kind in ('clinic','iq','mind')),
  rep_id      text null,
  rep_title   text null,
  updated_at  timestamptz not null default now()
);
create index if not exists ability_profiles_user_idx on public.ability_profiles (user_id);

alter table public.mind_results        enable row level security;
alter table public.mind_groups         enable row level security;
alter table public.mind_broadcasts     enable row level security;
alter table public.mind_bc_entries     enable row level security;
alter table public.mind_bc_voters      enable row level security;
alter table public.mind_bc_predictions enable row level security;
alter table public.ability_profiles    enable row level security;

commit;

-- 되돌리기:
-- drop table public.ability_profiles, public.mind_bc_predictions, public.mind_bc_voters, public.mind_bc_entries, public.mind_broadcasts, public.mind_groups, public.mind_results;
