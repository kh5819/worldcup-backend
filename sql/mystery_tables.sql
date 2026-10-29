-- 플듀 미스터리: 진행 저장 + 클리어 기록 (2026-10-29)
-- 서버(service_role)만 읽고 쓴다. RLS 켜고 정책 0개 = 프론트(anon/authenticated) 접근 불가.
-- user_key = 로그인 사용자 uuid 또는 게스트 id("guest_...")

create table if not exists public.mystery_progress (
  user_key   text not null,
  case_id    text not null,
  state      jsonb not null,
  ended      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_key, case_id)
);
alter table public.mystery_progress enable row level security;
create index if not exists mystery_progress_updated_idx on public.mystery_progress (updated_at);

create table if not exists public.mystery_results (
  id          uuid primary key default gen_random_uuid(),
  user_key    text not null,
  case_id     text not null,
  ending      text not null check (ending in ('true', 'normal', 'bad')),
  accuracy    int not null,
  elapsed_sec int not null,
  hints_used  int not null,
  solved_main int not null,
  solved_hidden int not null,
  titles      text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.mystery_results enable row level security;
create index if not exists mystery_results_user_idx on public.mystery_results (user_key, case_id);

-- 되돌리기: drop table public.mystery_results; drop table public.mystery_progress;
