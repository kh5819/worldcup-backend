-- 플듀 상식 레벨 진단소 (2026-11-03) — 운영 적용: 2026-11-03 (사용자 "db는 너가 알아서 생성해")
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 프로필은 진단소 공용 iq_profiles 를 그대로 씀 (새 프로필 테이블 없음)
-- 되돌리기: 맨 아래 drop 문
begin;

-- 검사 결과
create table if not exists public.know_results (
  id          text primary key,
  owner_key   text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id     uuid null references auth.users(id) on delete set null,
  nickname    text not null,
  age         int  null check (age is null or age between 7 and 99),
  avatar      jsonb not null default '{}',
  avatar_url  text null,
  mode        text not null check (mode in ('quick','full','area','daily','weak','multi','bc')),
  area        text null,                     -- 분야별 검사의 분야
  set_key     text null,                     -- 오늘의 챌린지 날짜
  core_ver    int  not null,                 -- 채점식 버전 (다르면 같은 순위에 안 섞음)
  bank_ver    text not null,                 -- 문제은행 버전 (기록용)
  device      text not null check (device in ('pc','mobile')),
  plan        jsonb not null,                -- 문항 id 목록 (복습·중복 출제 방지)
  items       jsonb not null,                -- 문항별 결과 [{id,game,kind,area,d,part,c,ms,lim,timeout,stage}]
  total       int  not null check (total between 0 and 100),
  lv          int  not null check (lv between 1 and 10),
  acc         real not null,
  correct     int  not null,
  areas       jsonb not null,
  type_id     text not null,
  diag        jsonb not null,
  is_public   boolean not null default true,
  flagged     boolean not null default false, -- 순위 제외 (같은 챌린지 두 번째 기록 등)
  show_age    boolean not null default false,
  is_streamer boolean not null default false,
  group_id    text null,
  bc_id       text null,
  created_at  timestamptz not null default now()
);
create index if not exists know_results_owner_idx on public.know_results (owner_key, created_at desc);
create index if not exists know_results_rank_idx on public.know_results (mode, core_ver, total desc) where is_public and not flagged;
create index if not exists know_results_area_idx on public.know_results (mode, area, total desc) where is_public and not flagged and area is not null;
create index if not exists know_results_set_idx on public.know_results (mode, set_key, total desc) where is_public and not flagged and set_key is not null;
create index if not exists know_results_created_idx on public.know_results (created_at desc);
create index if not exists know_results_user_idx on public.know_results (user_id);

-- 문제은행 (관리자 등록·수정분). 서버 시작 때 코드 문제은행(know-bank.js) 위에 덮어씀. 정답 포함 → 절대 공개 금지
create table if not exists public.know_questions (
  id            text primary key,              -- questionId (예: H0013)
  data          jsonb not null,                -- 문항 전체 (정답·해설·출처 포함)
  category      text not null,                 -- 분야
  subcategory   text null,
  game          text not null,
  kind          text not null,
  difficulty    int  not null check (difficulty between 1 and 4),
  review_status text not null default 'draft' check (review_status in ('draft','checked','approved','hold','disabled')),
  content_ver   int  not null default 1,
  updated_by    text null,                     -- 관리자 이메일
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists know_questions_cat_idx on public.know_questions (category, review_status);

-- 오류 신고 (이용자 → 관리자)
create table if not exists public.know_reports (
  id          bigint generated always as identity primary key,
  question_id text not null,
  owner_key   text not null,
  reason      text not null check (reason in ('wrong_answer','ambiguous','outdated','typo','offensive','other')),
  note        text null check (note is null or length(note) <= 300),
  status      text not null default 'open' check (status in ('open','fixed','rejected')),
  admin_note  text null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz null
);
create unique index if not exists know_reports_once_idx on public.know_reports (question_id, owner_key) where status = 'open';
create index if not exists know_reports_status_idx on public.know_reports (status, created_at desc);

-- 문항 사용 통계 (서버가 모아서 1분마다 더함)
create table if not exists public.know_qstats (
  question_id text primary key,
  used        int  not null default 0,
  correct     int  not null default 0,
  part_sum    real not null default 0,
  timeouts    int  not null default 0,
  ms_sum      bigint not null default 0,
  updated_at  timestamptz not null default now()
);
-- 통계 더하기 (여러 문항 한 번에, 경쟁 없이)
create or replace function public.know_qstats_add(rows jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.know_qstats as s (question_id, used, correct, part_sum, timeouts, ms_sum, updated_at)
  select r->>'id', (r->>'used')::int, (r->>'correct')::int, (r->>'part')::real, (r->>'timeouts')::int, (r->>'ms')::bigint, now()
  from jsonb_array_elements(rows) r
  on conflict (question_id) do update set used = s.used + excluded.used, correct = s.correct + excluded.correct, part_sum = s.part_sum + excluded.part_sum,
    timeouts = s.timeouts + excluded.timeouts, ms_sum = s.ms_sum + excluded.ms_sum, updated_at = now();
$$;
revoke all on function public.know_qstats_add(jsonb) from public, anon, authenticated;

alter table public.know_results enable row level security;
alter table public.know_questions enable row level security;
alter table public.know_reports enable row level security;
alter table public.know_qstats enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가, 백엔드(service_role)만

commit;

-- 되돌리기:
-- drop function if exists public.know_qstats_add(jsonb);
-- drop table if exists public.know_qstats; drop table if exists public.know_reports; drop table if exists public.know_questions; drop table if exists public.know_results;

-- 스트리머 실시간 퀴즈쇼 방송 (2026-11-03 운영 적용, 마이그레이션 know_broadcasts). 진행 중 표는 서버 메모리, 최종 요약만 저장
create table if not exists public.know_broadcasts (
  id text primary key, owner_key text not null, user_id uuid null references auth.users(id) on delete set null,
  title text not null, streamer_nick text not null, status text not null default 'live' check (status in ('live','final','closed')),
  rounds int not null default 10, summary jsonb null, created_at timestamptz not null default now(), finished_at timestamptz null
);
create index if not exists know_broadcasts_owner_idx on public.know_broadcasts (owner_key, created_at desc);
create index if not exists know_broadcasts_final_idx on public.know_broadcasts (status, created_at desc);
alter table public.know_broadcasts enable row level security;
-- 되돌리기: drop table if exists public.know_broadcasts;
