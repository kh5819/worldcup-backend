-- 진단소 「우리 방송 피지컬 평균」 (2026-10-31) — 새 테이블 2개만, 기존 변경 없음. RLS 켬 + 정책 0 = 서버 전용
create table if not exists public.clinic_broadcasts (
  id           text primary key,
  owner_key    text not null,
  user_id      uuid null references auth.users(id) on delete set null,
  title        text not null,
  streamer_nick text not null,
  avatar_url   text null,
  mode         text not null check (mode in ('full','quick')),
  core_ver     int  not null,
  status       text not null default 'open' check (status in ('open','final')),
  closes_at    timestamptz not null,
  final_stats  jsonb null,          -- 확정 결과 (마감 후 그대로 보관)
  finalized_at timestamptz null,
  created_at   timestamptz not null default now()
);
create index if not exists clinic_broadcasts_owner_idx on public.clinic_broadcasts (owner_key, created_at desc);

create table if not exists public.clinic_bc_entries (
  bc_id       text not null references public.clinic_broadcasts(id) on delete cascade,
  owner_key   text not null,          -- 한 방송에 한 사람 1개 (첫 완료 기록)
  user_id     uuid null references auth.users(id) on delete set null,
  result_id   text null,
  nickname    text not null,
  show_name   boolean not null default true,
  is_member   boolean not null default false,
  is_streamer boolean not null default false,
  device      text not null check (device in ('pc','mobile')),
  total       int not null,
  phys        int not null,
  age_group   text null,               -- 실제 나이 대신 연령대만 (나이 비공개면 null)
  scores      jsonb not null,
  flagged     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (bc_id, owner_key)
);

alter table public.clinic_broadcasts enable row level security;
alter table public.clinic_bc_entries enable row level security;
-- 되돌리기: drop table public.clinic_bc_entries, public.clinic_broadcasts;
