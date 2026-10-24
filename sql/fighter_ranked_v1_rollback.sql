-- 플듀 파이터 랭크전 v1 롤백 — fighter_ranked_v1.sql 이 만든 것만 지움(기존 profiles·auth 등은 손대지 않음)
-- ⚠ 랭크 기록이 모두 사라짐. 지우기 전에 남기려면 먼저:
--   create table public._backup_fighter_rating_history as table public.fighter_rating_history;  (만든 뒤 바로 RLS 켜거나 용도 끝나면 DROP)
begin;
drop policy   if exists fm_own on public.fighter_matches;   -- 이 정책이 참가자 표를 참조하므로 먼저
drop view    if exists public.fighter_leaderboard_v;
drop function if exists public.fighter_season_rollover(smallint, text, timestamptz, timestamptz);
drop function if exists public.fighter_record_match(text, smallint, text, integer, smallint[], uuid, text, uuid, text, boolean, bigint);
drop function if exists public.fighter_tier(integer, smallint);
drop table    if exists public.fighter_rating_history;
drop table    if exists public.fighter_rank_rewards;
drop table    if exists public.fighter_season_stats;
drop table    if exists public.fighter_player_ratings;
drop table    if exists public.fighter_match_players;
drop table    if exists public.fighter_matches;
drop table    if exists public.fighter_seasons;
commit;
