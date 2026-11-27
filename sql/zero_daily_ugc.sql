-- 격리구역: 제로 — 일일 도전 순위(zero_daily) + 이변체 제작소 공유(zero_ugc)
-- 새 테이블만 만듦. 기존 테이블·멀티·채팅 영향 없음. 서버(service role)만 읽고 씀 → RLS 켜고 정책 없음.
create table if not exists public.zero_daily (
  id bigserial primary key,
  day date not null,
  owner_key text not null,
  nickname text,
  score int not null,
  energy int not null default 0,
  met boolean not null default false,
  summary jsonb,
  created_at timestamptz not null default now()
);
create index if not exists zero_daily_day_score on public.zero_daily (day, score desc);
alter table public.zero_daily enable row level security;

create table if not exists public.zero_ugc (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  nickname text,
  def jsonb not null,
  likes int not null default 0,
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists zero_ugc_new on public.zero_ugc (created_at desc) where not hidden;
create index if not exists zero_ugc_top on public.zero_ugc (likes desc) where not hidden;
create index if not exists zero_ugc_owner on public.zero_ugc (owner_key, created_at desc);
alter table public.zero_ugc enable row level security;

-- 좋아요·신고는 한 사람당 한 번
create table if not exists public.zero_ugc_marks (
  ugc_id uuid not null references public.zero_ugc(id) on delete cascade,
  owner_key text not null,
  kind text not null check (kind in ('like', 'report')),
  primary key (ugc_id, owner_key, kind)
);
alter table public.zero_ugc_marks enable row level security;

create or replace function public.zero_ugc_mark(p_id uuid, p_owner text, p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into zero_ugc_marks (ugc_id, owner_key, kind) values (p_id, p_owner, p_kind) on conflict do nothing;
  if found then
    if p_kind = 'like' then update zero_ugc set likes = likes + 1 where id = p_id;
    else update zero_ugc set reports = reports + 1, hidden = (reports + 1 >= 5) where id = p_id; end if;
  end if;
  select likes into n from zero_ugc where id = p_id;
  return coalesce(n, 0);
end $$;
revoke all on function public.zero_ugc_mark(uuid, text, text) from public, anon, authenticated;
grant execute on function public.zero_ugc_mark(uuid, text, text) to service_role;
