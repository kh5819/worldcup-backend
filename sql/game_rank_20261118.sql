-- 2026-11-18 랭킹: 증강 2048 · 증강 벽돌깨기 새 표 + 플듀 블록로얄 기록에 게스트 포함
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 게임 표는 건드리지 않음.

-- 증강 2048: 판 종류(board = classic|augment _ endless|t180|t300)마다 사람당 최고 1줄. 회원 user_id, 게스트 guest_id
create table if not exists public.ttfe_scores (
  board text not null,
  player_key text not null,                 -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  score bigint not null default 0,
  max_tile integer not null default 0,
  moves integer not null default 0,
  augs text[] not null default '{}',
  source text not null default 'solo',      -- solo(서버가 다시 돌려 확인) / multi(게임 서버 확정)
  plays integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (board, player_key),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_ttfe_scores_rank on public.ttfe_scores (board, score desc, updated_at);
alter table public.ttfe_scores enable row level security;

-- 증강 벽돌깨기: board = classic|augment _ endless|t300
create table if not exists public.brick_scores (
  board text not null,
  player_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  score bigint not null default 0,
  stage integer not null default 0,
  boss_kills integer not null default 0,
  max_combo integer not null default 0,
  augs text[] not null default '{}',
  source text not null default 'solo',
  plays integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (board, player_key),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_brick_scores_rank on public.brick_scores (board, score desc, updated_at);
alter table public.brick_scores enable row level security;

-- 플듀 블록로얄 시즌 기록에 게스트 포함
-- player_key = user_id 또는 guest_id (자동 계산). 옛 서버의 upsert(season,mode,user_id)도 계속 되도록 그 조합 고유 색인 유지
alter table public.br_records add column if not exists guest_id text;
alter table public.br_records add column if not exists player_key text generated always as (coalesce(user_id::text, guest_id)) stored;
create unique index if not exists br_records_user_uk on public.br_records (season, mode, user_id);
alter table public.br_records drop constraint if exists br_records_pkey;
alter table public.br_records alter column user_id drop not null;
alter table public.br_records add constraint br_records_pkey primary key (season, mode, player_key);
alter table public.br_records drop constraint if exists br_records_who;
alter table public.br_records add constraint br_records_who check (user_id is not null or guest_id is not null);
