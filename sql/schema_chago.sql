-- ============================================================
-- 차고차고 (DUO Chago) — 경기 기록 · 시즌 랭킹 · 신고 스키마
-- 2026-10-26
-- 원칙
--   · 새 테이블만 만든다 (기존 테이블 변경 0). 모든 테이블 RLS 켜고 service_role 만 접근.
--   · 경기 기록 + 레이팅 갱신은 chago_apply_match() 한 번(한 트랜잭션)으로 처리. 레이팅은 "증감(delta)"을 더하므로
--     동시에 끝난 경기 두 개가 같은 사람에게 반영돼도 서로 덮어쓰지 않는다.
--   · 함수는 public/anon/authenticated 실행 금지, service_role 만 (record_ranking_points 구멍 사고 재발 방지).
--   · 롤백: sql/rollback_chago.sql
-- ============================================================

create table if not exists chago_matches (
  id            uuid primary key default gen_random_uuid(),
  room_id       text not null,
  mode          text not null check (mode in ('friendly','ranked')),
  team_size     int  not null check (team_size between 1 and 4),
  duration_sec  int  not null,
  season        text not null,                      -- 'YYYY-MM' (한국 시간)
  score_a       int  not null default 0,
  score_b       int  not null default 0,
  winner        int  check (winner in (0,1)),       -- null = 무승부
  end_reason    text,
  overtime      boolean not null default false,
  shootout      jsonb,
  ranked        boolean not null default false,     -- 레이팅이 반영된 경기인가
  started_at    timestamptz not null,
  ended_at      timestamptz not null default now()
);
-- 같은 방의 같은 경기 중복 기록 방지
create unique index if not exists ux_chago_matches_room_start on chago_matches (room_id, started_at);
create index if not exists idx_chago_matches_season on chago_matches (season, ended_at desc);

create table if not exists chago_match_players (
  match_id      uuid not null references chago_matches(id) on delete cascade,
  eid           int  not null,
  team          int  not null check (team in (0,1)),
  slot          int  not null default 0,
  user_id       uuid references auth.users(id) on delete set null,
  guest         boolean not null default false,
  bot           boolean not null default false,
  name          text,
  goals int not null default 0, assists int not null default 0,
  shots int not null default 0, on_target int not null default 0, perfect int not null default 0,
  passes int not null default 0, pass_ok int not null default 0,
  saves int not null default 0, super_saves int not null default 0,
  tackles int not null default 0, tackle_hits int not null default 0, own_goals int not null default 0,
  perf          numeric(6,1) not null default 0,    -- 경기 내 평점
  mvp           boolean not null default false,
  abandoned     boolean not null default false,     -- 끝까지 못 돌아온 이탈
  late          boolean not null default false,     -- 중도 입장(레이팅 제외)
  flags         jsonb,                              -- 부정행위 의심 판정 결과
  rating_before int,
  rating_delta  int,
  primary key (match_id, eid)
);
create index if not exists idx_chago_mp_user on chago_match_players (user_id, match_id) where user_id is not null;

create table if not exists chago_ratings (
  season        text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rating        int  not null default 1000 check (rating >= 0),
  peak          int  not null default 1000,
  games         int  not null default 0,
  ranked_games  int  not null default 0,
  wins          int  not null default 0,
  losses        int  not null default 0,
  draws         int  not null default 0,
  goals         int  not null default 0,
  assists       int  not null default 0,
  saves         int  not null default 0,
  mvps          int  not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (season, user_id)
);
create index if not exists idx_chago_ratings_board on chago_ratings (season, rating desc, wins desc) where ranked_games >= 3;

create table if not exists chago_reports (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid references chago_matches(id) on delete set null,
  room_id        text,
  kind           text not null default 'manual' check (kind in ('manual','auto')),
  reporter_id    uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_name    text,
  reason         text not null,
  detail         text,
  status         text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,
  note           text
);
create index if not exists idx_chago_reports_status on chago_reports (status, created_at desc);
-- 같은 사람이 같은 경기에서 같은 상대를 중복 신고하지 못하게
create unique index if not exists ux_chago_reports_once on chago_reports (reporter_id, match_id, target_user_id) where kind = 'manual' and reporter_id is not null;

-- ---------- RLS: service_role 만 ----------
alter table chago_matches enable row level security;
alter table chago_match_players enable row level security;
alter table chago_ratings enable row level security;
alter table chago_reports enable row level security;
do $rls$
declare t text;
begin
  foreach t in array array['chago_matches','chago_match_players','chago_ratings','chago_reports'] loop
    execute format('drop policy if exists %I on %I', t || '_service_all', t);
    execute format('create policy %I on %I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_all', t);
  end loop;
end
$rls$;

-- ---------- 경기 기록 + 레이팅 반영 (한 트랜잭션) ----------
-- m  : 경기 요약 jsonb, pl : 선수 배열 jsonb. 이미 기록된 경기면 null 을 돌려주고 아무것도 바꾸지 않는다.
create or replace function public.chago_apply_match(m jsonb, pl jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  mid uuid;
  p jsonb;
  v_uid uuid;
  v_delta int;
  v_rated boolean;
  v_res text;
begin
  insert into chago_matches (room_id, mode, team_size, duration_sec, season, score_a, score_b, winner, end_reason, overtime, shootout, ranked, started_at, ended_at)
  values (
    m->>'room_id', m->>'mode', (m->>'team_size')::int, (m->>'duration_sec')::int, m->>'season',
    coalesce((m->>'score_a')::int, 0), coalesce((m->>'score_b')::int, 0), nullif(m->>'winner', '')::int,
    m->>'end_reason', coalesce((m->>'overtime')::boolean, false), m->'shootout', coalesce((m->>'ranked')::boolean, false),
    (m->>'started_at')::timestamptz, coalesce((m->>'ended_at')::timestamptz, now())
  )
  on conflict (room_id, started_at) do nothing
  returning id into mid;
  if mid is null then return null; end if;

  for p in select * from jsonb_array_elements(pl) loop
    v_uid := nullif(p->>'uid', '')::uuid;
    v_delta := coalesce((p->>'rating_delta')::int, 0);
    v_rated := coalesce((p->>'rated')::boolean, false);
    v_res := coalesce(p->>'result', 'draw');

    insert into chago_match_players (match_id, eid, team, slot, user_id, guest, bot, name,
      goals, assists, shots, on_target, perfect, passes, pass_ok, saves, super_saves, tackles, tackle_hits, own_goals,
      perf, mvp, abandoned, late, flags, rating_before, rating_delta)
    values (mid, (p->>'eid')::int, (p->>'team')::int, coalesce((p->>'slot')::int, 0),
      case when exists (select 1 from auth.users u where u.id = v_uid) then v_uid else null end,
      coalesce((p->>'guest')::boolean, false), coalesce((p->>'bot')::boolean, false), left(p->>'name', 30),
      coalesce((p->>'goals')::int, 0), coalesce((p->>'assists')::int, 0), coalesce((p->>'shots')::int, 0), coalesce((p->>'on_target')::int, 0),
      coalesce((p->>'perfect')::int, 0), coalesce((p->>'passes')::int, 0), coalesce((p->>'pass_ok')::int, 0), coalesce((p->>'saves')::int, 0),
      coalesce((p->>'super_saves')::int, 0), coalesce((p->>'tackles')::int, 0), coalesce((p->>'tackle_hits')::int, 0), coalesce((p->>'own_goals')::int, 0),
      coalesce((p->>'perf')::numeric, 0), coalesce((p->>'mvp')::boolean, false), coalesce((p->>'abandoned')::boolean, false),
      coalesce((p->>'late')::boolean, false), p->'flags', (p->>'rating_before')::int, case when v_rated then v_delta else null end);

    -- 로그인한 사람(봇·게스트 제외)만 시즌 통계에 누적
    if v_uid is not null and not coalesce((p->>'bot')::boolean, false) and not coalesce((p->>'guest')::boolean, false)
       and exists (select 1 from auth.users u where u.id = v_uid) then
      insert into chago_ratings (season, user_id, rating, peak, games, ranked_games, wins, losses, draws, goals, assists, saves, mvps)
      values (m->>'season', v_uid, greatest(0, 1000 + case when v_rated then v_delta else 0 end), greatest(1000, 1000 + case when v_rated then v_delta else 0 end),
        1, case when v_rated then 1 else 0 end, case when v_res = 'win' then 1 else 0 end, case when v_res = 'loss' then 1 else 0 end, case when v_res = 'draw' then 1 else 0 end,
        coalesce((p->>'goals')::int, 0), coalesce((p->>'assists')::int, 0), coalesce((p->>'saves')::int, 0), case when coalesce((p->>'mvp')::boolean, false) then 1 else 0 end)
      on conflict (season, user_id) do update set
        rating = greatest(0, chago_ratings.rating + case when v_rated then v_delta else 0 end),
        peak = greatest(chago_ratings.peak, greatest(0, chago_ratings.rating + case when v_rated then v_delta else 0 end)),
        games = chago_ratings.games + 1,
        ranked_games = chago_ratings.ranked_games + case when v_rated then 1 else 0 end,
        wins = chago_ratings.wins + case when v_res = 'win' then 1 else 0 end,
        losses = chago_ratings.losses + case when v_res = 'loss' then 1 else 0 end,
        draws = chago_ratings.draws + case when v_res = 'draw' then 1 else 0 end,
        goals = chago_ratings.goals + coalesce((p->>'goals')::int, 0),
        assists = chago_ratings.assists + coalesce((p->>'assists')::int, 0),
        saves = chago_ratings.saves + coalesce((p->>'saves')::int, 0),
        mvps = chago_ratings.mvps + case when coalesce((p->>'mvp')::boolean, false) then 1 else 0 end,
        updated_at = now();
    end if;

    -- 부정행위 의심(차단) 판정은 자동 신고로 남긴다
    if coalesce((p->'flags'->>'blocked')::boolean, false) then
      insert into chago_reports (match_id, room_id, kind, target_user_id, target_name, reason, detail)
      values (mid, m->>'room_id', 'auto',
        case when exists (select 1 from auth.users u where u.id = v_uid) then v_uid else null end,
        left(p->>'name', 30), 'auto_suspicion', left(p->'flags'->>'list', 200));
    end if;
  end loop;
  return mid;
end
$fn$;

revoke all on function public.chago_apply_match(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.chago_apply_match(jsonb, jsonb) to service_role;
