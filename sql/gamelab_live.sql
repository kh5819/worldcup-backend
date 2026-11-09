-- 게임 종합 진단소 스트리머 모드 (2026-11-09) — 아직 운영 DB에 적용 안 함 (승인 후 실행)
-- 새 테이블 1개 + gamelab_results에 인덱스 2개. 기존 행·다른 테이블은 건드리지 않음. RLS 켬 + 정책 0 = 백엔드 전용
-- 시청자 기록은 gamelab_results.bc_id, 친구 대결은 gamelab_results.group_id 를 씀 (칸은 이미 있음)
-- 여러 번 실행해도 안전. 되돌리기: 맨 아래
begin;
create table if not exists public.gamelab_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  avatar_url    text null,
  mode          text not null check (mode in ('quick','full')),
  diff          text not null check (diff in ('normal','hard','expert')),
  ver           text not null,
  status        text not null default 'open' check (status in ('wait','open','final')),
  closes_at     timestamptz not null,
  settings      jsonb not null default '{}',
  final_stats   jsonb null,
  created_at    timestamptz not null default now(),
  finalized_at  timestamptz null
);
create index if not exists gamelab_broadcasts_owner_idx on public.gamelab_broadcasts (owner_key, created_at desc);
alter table public.gamelab_broadcasts enable row level security;
-- 방송 한 곳에 한 사람 기록 하나 (서버가 동시에 두 번 받아도 DB가 막음)
create unique index if not exists gamelab_results_bc_owner_uq on public.gamelab_results (bc_id, owner_key) where bc_id is not null;
create index if not exists gamelab_results_group_idx on public.gamelab_results (group_id) where group_id is not null;
commit;
-- 되돌리기: drop index if exists public.gamelab_results_group_idx; drop index if exists public.gamelab_results_bc_owner_uq; drop table if exists public.gamelab_broadcasts;
