-- ============================================================
-- 시청자 투표 (Audience Voting) 스키마
-- 월드컵 멀티 모드 전용 — Supabase SQL Editor에서 실행
-- ============================================================

-- 1) 방별 시청자 투표 ON/OFF
create table if not exists public.audience_polls (
  room_code text primary key,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 개별 투표 레코드
create table if not exists public.audience_votes (
  id bigserial primary key,
  room_code text not null,
  round_key text not null,
  choice smallint not null check (choice in (1,2)),
  device_key text not null,
  created_at timestamptz not null default now()
);

-- 디바이스당 같은 room+round_key에 1번만 투표
create unique index if not exists ux_audience_votes_once
on public.audience_votes(room_code, round_key, device_key);

-- 3) 집계 뷰
create or replace view public.audience_vote_agg as
select
  room_code,
  round_key,
  count(*) filter (where choice = 1) as left_votes,
  count(*) filter (where choice = 2) as right_votes,
  count(*) as total_votes,
  max(created_at) as last_vote_at
from public.audience_votes
group by room_code, round_key;

-- 4) 방 현재 라운드 상태 (round_key + 타이머)
create table if not exists public.audience_room_state (
  room_code text primary key,
  round_key text,
  vote_duration_sec int not null default 12,
  round_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 5) updated_at 자동 갱신 트리거
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tr_audience_polls_touch on public.audience_polls;
create trigger tr_audience_polls_touch
before update on public.audience_polls
for each row execute function public.touch_updated_at();

drop trigger if exists tr_audience_room_state_touch on public.audience_room_state;
create trigger tr_audience_room_state_touch
before update on public.audience_room_state
for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.audience_polls enable row level security;
alter table public.audience_votes enable row level security;
alter table public.audience_room_state enable row level security;

-- 읽기: 모두 허용 (시청자/호스트 모두 집계 조회)
drop policy if exists "audience_polls_read" on public.audience_polls;
create policy "audience_polls_read"
on public.audience_polls for select using (true);

drop policy if exists "audience_votes_read" on public.audience_votes;
create policy "audience_votes_read"
on public.audience_votes for select using (true);

drop policy if exists "audience_room_state_read" on public.audience_room_state;
create policy "audience_room_state_read"
on public.audience_room_state for select using (true);

-- 쓰기: 클라이언트 direct insert/update 차단 (Edge Function service_role만 허용)
drop policy if exists "audience_votes_no_client_insert" on public.audience_votes;
create policy "audience_votes_no_client_insert"
on public.audience_votes for insert with check (false);

drop policy if exists "audience_polls_no_client_write" on public.audience_polls;
create policy "audience_polls_no_client_write"
on public.audience_polls for all using (false) with check (false);

drop policy if exists "audience_room_state_no_client_write" on public.audience_room_state;
create policy "audience_room_state_no_client_write"
on public.audience_room_state for all using (false) with check (false);
