-- 플듀 감각 진단소 (2026-11-07) — 아직 운영 DB에 적용 안 함 (승인 후 실행)
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 여러 번 실행해도 안전(if not exists). 되돌리기: 맨 아래 drop 문
begin;
create table if not exists public.feel_results (
  id          text primary key,
  owner_key   text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),
  avatar      jsonb not null default '{}',
  avatar_url  text null,
  mode        text not null check (mode in ('full','single')),
  diff        text not null check (diff in ('normal','hard','expert')),   -- 난이도별로만 순위 (섞지 않음)
  set_ver     text not null,                 -- 검사 구성·채점 버전 (종합 순위는 같은 버전끼리만)
  device      text not null check (device in ('pc','mobile')),
  scores      jsonb not null,                -- 측정한 검사만 0~100 (건너뛴 검사는 없음 = 미측정)
  metrics     jsonb not null,
  total       int  not null check (total between 0 and 1000),
  areas       jsonb not null,
  tier        text not null,                 -- SSS~D
  style       text not null,
  diag        jsonb not null,
  done        int  not null default 0,       -- 측정한 검사 수
  is_public   boolean not null default true,
  flagged     boolean not null default false,   -- 기록 이상 → 랭킹 제외
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  rank        int null,
  rank_of     int null,
  created_at  timestamptz not null default now()
);
create index if not exists feel_results_owner_idx on public.feel_results (owner_key, created_at desc);
create index if not exists feel_results_rank_idx on public.feel_results (diff, mode, set_ver, total desc) where is_public and not flagged;
create index if not exists feel_results_created_idx on public.feel_results (created_at desc);
create index if not exists feel_results_user_idx on public.feel_results (user_id);
alter table public.feel_results enable row level security;
commit;
-- 되돌리기: drop table if exists public.feel_results;
