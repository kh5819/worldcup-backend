-- 증강 모드 랭킹 (2026-11-16) — 사과게임·블록블래스트 증강 점수 전용 새 테이블.
-- 기존 apple_scores / blockblast_scores 는 건드리지 않음. 서버(비밀 키)만 읽고 씀(RLS 켜고 정책 없음).
create table if not exists public.apple_aug_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  score integer not null default 0,
  apples_cleared integer not null default 0,
  max_combo integer not null default 0,
  duration_sec integer,
  augs text[] not null default '{}',
  flagged boolean not null default false,
  client_run_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_apple_aug_scores_user on public.apple_aug_scores (user_id);
create index if not exists idx_apple_aug_scores_score on public.apple_aug_scores (score desc, created_at) where flagged = false;
alter table public.apple_aug_scores enable row level security;

create table if not exists public.blockblast_aug_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  score integer not null default 0,
  lines_cleared integer not null default 0,
  blocks_placed integer not null default 0,
  max_combo integer not null default 0,
  duration_sec integer,
  augs text[] not null default '{}',
  flagged boolean not null default false,
  client_run_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_blockblast_aug_scores_user on public.blockblast_aug_scores (user_id);
create index if not exists idx_blockblast_aug_scores_score on public.blockblast_aug_scores (score desc, created_at) where flagged = false;
alter table public.blockblast_aug_scores enable row level security;

-- (같은 날 추가) 비로그인(게스트)도 증강 랭킹에: user_id 비워도 되게 + 게스트 번호 칸
alter table public.apple_aug_scores alter column user_id drop not null, add column if not exists guest_id text;
create unique index if not exists ux_apple_aug_scores_guest on public.apple_aug_scores (guest_id) where guest_id is not null;
alter table public.blockblast_aug_scores alter column user_id drop not null, add column if not exists guest_id text;
create unique index if not exists ux_blockblast_aug_scores_guest on public.blockblast_aug_scores (guest_id) where guest_id is not null;
