-- 플듀 게임 종합 진단소 (2026-11-09) — 운영 DB 적용 완료 (11-09)
-- 새 테이블 1개만 추가. 기존 테이블·행·정책은 건드리지 않음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 여러 번 실행해도 안전(if not exists). 되돌리기: 맨 아래 drop 문
begin;
create table if not exists public.gamelab_results (
  id           text primary key,
  owner_key    text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id      uuid null references auth.users(id) on delete set null,
  nickname     text not null,
  mode         text not null check (mode in ('quick','full','single')),
  diff         text not null check (diff in ('normal','hard','expert')),
  ver          text not null,
  plan         jsonb not null,                -- 이 검사의 미션 순서
  scores       jsonb not null,                -- 측정한 미션만 0~100 (건너뛰면 없음 = 미측정)
  raws         jsonb not null default '{}',   -- 게임이 보고한 원자료 (재채점·검증용)
  flags        jsonb not null default '{}',   -- 미션별 이상 사유
  total        int  not null check (total between 0 and 1000),
  tier         text not null,
  type         text not null,
  areas        jsonb not null,
  done         int  not null default 0,
  of_count     int  not null default 0,
  is_public    boolean not null default true,
  is_streamer  boolean not null default false,
  flagged      boolean not null default false,
  verified     boolean not null default false, -- 서버가 게임 전체를 검증한 기록 (2단계 이후)
  duration_ms  bigint not null default 0,
  group_id     text null,                      -- 4단계 친구 대결용 (지금은 비어 있음)
  bc_id        text null,                      -- 4단계 스트리머 방송용 (지금은 비어 있음)
  created_at   timestamptz not null default now()
);
create index if not exists gamelab_results_owner_idx on public.gamelab_results (owner_key, created_at desc);
create index if not exists gamelab_results_rank_idx on public.gamelab_results (diff, mode, total desc) where is_public and not flagged;
create index if not exists gamelab_results_user_idx on public.gamelab_results (user_id);
create index if not exists gamelab_results_streamer_idx on public.gamelab_results (created_at desc) where is_streamer;
alter table public.gamelab_results enable row level security;
commit;
-- 되돌리기: drop table if exists public.gamelab_results;
