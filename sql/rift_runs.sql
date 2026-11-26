-- 운명의 균열 (Rift of Fate) 판 기록 — 서버 전용(RLS 켜고 정책 없음 = 서버 키만 읽고 씀)
-- 혼자 하기: 서버가 시드+행동 기록을 다시 돌려 확인한 결과만 저장 · 협동: 서버가 판정한 판 그대로 저장
create table if not exists public.rift_runs (
  id bigserial primary key,
  mode text not null check (mode in ('solo','coop','stream')),   -- stream: 스트리머 모드 판
  owner_key text,
  nickname text,
  chars text[] not null,
  diff text not null,
  win boolean not null default false,
  floor int not null default 0,
  turns int not null default 0,
  players int not null default 1,
  play_ms int,
  summary jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rift_runs_win_idx on public.rift_runs (win, created_at desc);
create index if not exists rift_runs_owner_idx on public.rift_runs (owner_key, created_at desc);
alter table public.rift_runs enable row level security;

-- 2026-11-26 5-D: 일일 도전(daily) · 덱 배틀(battle) 기록 추가 (운영 적용 완료)
alter table public.rift_runs drop constraint if exists rift_runs_mode_check;
alter table public.rift_runs add constraint rift_runs_mode_check check (mode in ('solo','coop','stream','daily','battle'));
create index if not exists rift_runs_daily_idx on public.rift_runs ((summary->>'daily')) where mode = 'daily';
