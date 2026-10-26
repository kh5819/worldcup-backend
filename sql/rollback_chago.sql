-- 차고차고 스키마 롤백: 새로 만든 것만 지운다 (기존 테이블 영향 없음). 기록된 경기·랭킹 데이터도 함께 사라진다.
drop function if exists public.chago_apply_match(jsonb, jsonb);
drop table if exists chago_reports;
drop table if exists chago_ratings;
drop table if exists chago_match_players;
drop table if exists chago_matches;
