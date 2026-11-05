-- 플듀 블록로얄 시즌 기록 (새 테이블, 기존 게임에 영향 없음). 서버(비밀 키)만 읽고 씀
create table if not exists public.br_records (
  season text not null,            -- 'all' 또는 '2026-11'
  mode text not null,              -- battle / score / team
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  games int not null default 0, wins int not null default 0, top3 int not null default 0,
  kos int not null default 0, points int not null default 0,
  best_score bigint not null default 0, best_combo int not null default 0, best_kos int not null default 0,
  best_survival_sec int not null default 0, best_lines int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (season, mode, user_id)
);
alter table public.br_records enable row level security;
create index if not exists br_records_points on public.br_records (season, mode, points desc);
