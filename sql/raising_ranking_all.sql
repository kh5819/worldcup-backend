-- 플듀 키우기 랭킹: 우승자만 → 대회를 끝낸 모든 사람(우승·탈락)을 최고 성적 순으로 (2026-11-10)
-- 순서: 우승 > 결승 > 4강 > 8강 > 스위스, 같으면 승수 많은 순, 그다음 서버가 잰 시간이 짧은 순. 1인(로그인 계정 또는 기기) 최고 기록 1개.
-- 기존 우승 기록·함수 시그니처(raising_run_start / raising_run_finish)는 그대로 → 옛 화면도 계속 동작.
-- 새로 만드는 것: 열 2개(stage, losses), 함수 raising_run_end(탈락 기록), raising_claim_runs(화면이 이미 부르는데 DB에 없던 것).
-- raising_ranking은 돌려주는 열이 늘어서 DROP 후 다시 만듦.

begin;

alter table public.raising_runs add column if not exists stage text, add column if not exists losses integer;
update public.raising_runs set stage = 'champion', losses = greatest(0, coalesce(games, 0) - coalesce(wins, 0)) where status = 'cleared' and stage is null;

-- 우승: 기존과 같고 stage·losses만 함께 저장
create or replace function public.raising_run_finish(p_run uuid, p_client text, p_name text, p_emblem text, p_games integer, p_wins integer, p_spec text, p_team jsonb, p_client_ms bigint)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare r raising_runs; v_ms bigint; v_name text; v_rank int; v_uid uuid := auth.uid();
begin
  select * into r from raising_runs where id = p_run for update;
  if not found or r.client_id <> p_client then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if r.status <> 'running' then return json_build_object('ok', false, 'reason', 'already'); end if;
  v_ms := (extract(epoch from (now() - r.started_at)) * 1000)::bigint;
  v_name := left(trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 14);
  if length(v_name) < 1 then v_name := 'DUO'; end if;
  if p_games is null or p_wins is null or p_games < 10 or p_games > 16 or p_wins < 10 or p_wins > p_games then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_record');
  end if;
  if v_ms < 120000 or v_ms > 2592000000::bigint then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_time');
  end if;
  if p_client_ms is not null and p_client_ms > v_ms + 10000 then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'time_mismatch');
  end if;
  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) <> 5 or length(p_team::text) > 2000 then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_team');
  end if;
  update raising_runs set status = 'cleared', stage = 'champion', finished_at = now(), team_name = v_name, emblem = left(coalesce(p_emblem, ''), 8),
    games = p_games, wins = p_wins, losses = p_games - p_wins, spec = left(coalesce(p_spec, ''), 12), team = p_team, elapsed_ms = v_ms, client_ms = p_client_ms, user_id = v_uid
  where id = p_run;
  select rk into v_rank from public.raising_rank_rows() where k = coalesce(v_uid::text, p_client);
  return json_build_object('ok', true, 'rank', v_rank, 'elapsed_ms', v_ms);
end $function$;

-- 순위 계산 공용 (1인 최고 기록 → 순위). 내부용
create or replace function public.raising_rank_rows()
 returns table(k text, id uuid, sr int, rk int) language sql stable security definer set search_path to 'public' as $function$
  with best as (
    select distinct on (coalesce(r.user_id::text, r.client_id)) coalesce(r.user_id::text, r.client_id) k, r.id,
      (case coalesce(r.stage, case when r.status = 'cleared' then 'champion' end) when 'champion' then 5 when 'final' then 4 when 'sf' then 3 when 'qf' then 2 else 1 end) sr,
      coalesce(r.wins, 0) w, r.elapsed_ms
    from raising_runs r where r.status in ('cleared', 'out')
    order by coalesce(r.user_id::text, r.client_id), 3 desc, coalesce(r.wins, 0) desc, r.elapsed_ms asc)
  select b.k, b.id, b.sr, (row_number() over (order by b.sr desc, b.w desc, b.elapsed_ms asc))::int from best b;
$function$;
revoke all on function public.raising_rank_rows() from public, anon, authenticated;

-- 탈락 기록: 어디서 졌는지(swiss/qf/sf/final)와 승패가 그 단계에서 가능한 값인지 검사
create or replace function public.raising_run_end(p_run uuid, p_client text, p_name text, p_emblem text, p_where text, p_games integer, p_wins integer, p_spec text, p_team jsonb, p_client_ms bigint)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare r raising_runs; v_ms bigint; v_name text; v_rank int; v_uid uuid := auth.uid(); v_min int; v_max int;
begin
  select * into r from raising_runs where id = p_run for update;
  if not found or r.client_id <> p_client then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if r.status <> 'running' then return json_build_object('ok', false, 'reason', 'already'); end if;
  v_ms := (extract(epoch from (now() - r.started_at)) * 1000)::bigint;
  v_name := left(trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 14);
  if length(v_name) < 1 then v_name := 'DUO'; end if;
  -- 단계별 가능한 누적 승수 (스위스 3승 진출 → 8강 2승 → 4강 2승 → 결승 3승)
  v_min := case p_where when 'swiss' then 0 when 'qf' then 3 when 'sf' then 5 when 'final' then 7 else null end;
  v_max := case p_where when 'swiss' then 2 when 'qf' then 4 when 'sf' then 6 when 'final' then 9 else null end;
  if v_min is null or p_games is null or p_wins is null or p_games < 0 or p_games > 16 or p_wins < v_min or p_wins > v_max or p_wins > p_games or p_games - p_wins > 9 then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_record');
  end if;
  if v_ms < 20000 or v_ms > 2592000000::bigint then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_time');
  end if;
  if p_client_ms is not null and p_client_ms > v_ms + 10000 then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'time_mismatch');
  end if;
  if p_team is not null and (jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) > 5 or length(p_team::text) > 2000) then
    update raising_runs set status = 'void' where id = p_run; return json_build_object('ok', false, 'reason', 'invalid_team');
  end if;
  update raising_runs set status = 'out', stage = p_where, finished_at = now(), team_name = v_name, emblem = left(coalesce(p_emblem, ''), 8),
    games = p_games, wins = p_wins, losses = p_games - p_wins, spec = left(coalesce(p_spec, ''), 12), team = coalesce(p_team, '[]'::jsonb), elapsed_ms = v_ms, client_ms = p_client_ms, user_id = v_uid
  where id = p_run;
  select rk into v_rank from public.raising_rank_rows() where k = coalesce(v_uid::text, p_client);
  return json_build_object('ok', true, 'rank', v_rank, 'elapsed_ms', v_ms);
end $function$;

-- 랭킹 목록: 성적·승패 열 추가
drop function if exists public.raising_ranking(integer, text);
create function public.raising_ranking(p_limit integer default 50, p_client text default null)
 returns table(team_name text, emblem text, elapsed_ms bigint, games integer, wins integer, losses integer, stage text, spec text, team jsonb, finished_at timestamptz, nickname text, avatar_url text, mine boolean, rank integer)
 language sql stable security definer set search_path to 'public' as $function$
  select r.team_name, r.emblem, r.elapsed_ms, r.games, r.wins, coalesce(r.losses, greatest(0, coalesce(r.games, 0) - coalesce(r.wins, 0))),
    coalesce(r.stage, case when r.status = 'cleared' then 'champion' end), r.spec, r.team, r.finished_at, pr.nickname, pr.avatar_url,
    coalesce((r.user_id is not null and r.user_id = auth.uid()) or (p_client is not null and r.client_id = p_client), false), x.rk
  from public.raising_rank_rows() x join raising_runs r on r.id = x.id left join profiles pr on pr.id = r.user_id
  where x.rk <= least(greatest(coalesce(p_limit, 50), 1), 100)
     or (r.user_id is not null and r.user_id = auth.uid()) or (p_client is not null and r.client_id = p_client)
  order by x.rk;
$function$;

-- 로그인 전에 이 기기에서 올린 기록을 내 계정에 연결 (화면이 이미 부르고 있었는데 DB에 없던 함수)
create or replace function public.raising_claim_runs(p_client text)
 returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  if auth.uid() is null or p_client is null or length(p_client) < 6 then return 0; end if;
  update raising_runs set user_id = auth.uid() where client_id = p_client and user_id is null and status in ('cleared', 'out');
  get diagnostics n = row_count; return n;
end $function$;

grant execute on function public.raising_run_end(uuid, text, text, text, text, integer, integer, text, jsonb, bigint) to anon, authenticated;
grant execute on function public.raising_ranking(integer, text) to anon, authenticated;
grant execute on function public.raising_claim_runs(text) to anon, authenticated;

commit;
