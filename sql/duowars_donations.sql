-- 플듀 대전쟁 후원 기록 (중복 방지 + 처리 상태). 서버(service role)만 읽고 씀.
create table if not exists public.duowars_donations (
  id bigserial primary key,
  room_code text not null,
  platform text not null,               -- chzzk | cime | test
  event_key text not null unique,       -- 같은 후원 두 번 처리 방지
  donor text,
  amount integer not null,
  is_test boolean not null default false,
  status text not null default 'received', -- queued / applied / no_match / not_playing / game_over / queue_full / expired / invalid / disabled
  rule_name text,
  host_user_id uuid,
  channel_id text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists duowars_donations_room_idx on public.duowars_donations (room_code, created_at desc);
alter table public.duowars_donations enable row level security;
revoke all on public.duowars_donations from anon, authenticated;
