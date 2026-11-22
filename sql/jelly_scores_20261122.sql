-- 2026-11-22 DUO 증강 젤리 매치 랭킹 (2048·벽돌깨기와 같은 모양) — 판 종류(board)마다 사람당 최고 기록 1줄
-- board: classic|augment _ m30(이동 30번) | t120(2분)
-- 서버(비밀 키)만 읽고 씀 (RLS 켜고 정책 없음). 기존 표·멀티·채팅에는 손대지 않음 (새 표 1개)
-- 되돌리기: drop table if exists public.jelly_scores;
create table if not exists public.jelly_scores (
  board text not null,
  player_key text not null,                 -- 회원이면 user_id, 게스트면 guest_id
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  nickname text,
  score bigint not null default 0,
  max_chain integer not null default 0,     -- 가장 긴 연쇄
  moves integer not null default 0,
  augs text[] not null default '{}',
  source text not null default 'solo',      -- solo(서버가 다시 돌려 확인) / multi(게임 서버 확정)
  plays integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (board, player_key),
  check (user_id is not null or guest_id is not null)
);
create index if not exists idx_jelly_scores_rank on public.jelly_scores (board, score desc, updated_at);
alter table public.jelly_scores enable row level security;
