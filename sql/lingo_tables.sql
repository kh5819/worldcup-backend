-- 플듀 언어 진단소 LANGUAGE LAB (2026-11-08) — 운영 적용: 2026-11-08 (사용자 "다음 데이터베이스 적용해", 마이그레이션 lingo_tables_v1)
-- 새 테이블만 추가 — 기존 테이블·정책 변경 없음. RLS 켬 + 정책 0 = 백엔드(service_role) 전용
-- 프로필은 진단소 공용 iq_profiles 를 그대로 씀 (새 프로필 테이블 없음)
-- 문제은행은 코드(src/lingo-bank-*.js)에 있음 — 관리자 등록용 테이블은 다음 단계
-- 되돌리기: 맨 아래 drop 문
begin;

-- 검사 결과 (혼자 검사 · 친구 기록 도전)
create table if not exists public.lingo_results (
  id           text primary key,
  owner_key    text not null,                 -- u:<user id> | g:<guest id> (밖으로 안 내보냄)
  user_id      uuid null references auth.users(id) on delete set null,
  nickname     text not null,
  age          int  null check (age is null or age between 7 and 99),
  avatar       jsonb not null default '{}',
  avatar_url   text null,
  lang         text not null check (lang in ('ko','ja','en')),          -- 검사 언어 (랭킹 분리)
  diff         text not null check (diff in ('normal','hard','expert')), -- 난이도 (랭킹 분리)
  mode         text not null check (mode in ('full','speed','area','mix','retry','multi')),
  area         text null,                     -- 개별 검사의 검사 종류
  core_ver     int  not null,
  bank_ver     text not null,
  device       text not null check (device in ('pc','mobile')),
  challenge_of text null,                     -- 친구 기록 도전이면 원래 기록 id
  plan         jsonb not null,                -- 문항 id 목록 (복습·중복 출제 방지·친구 도전)
  items        jsonb not null,                -- 문항별 결과 [{id,game,kind,area,d,part,c,ms,lim,timeout,cpm,tacc}]
  total        int  not null check (total between 0 and 100),
  grade        text not null check (grade in ('SSS','SS','S','A','B','C','D')),
  acc          real not null,
  correct      int  not null,
  areas        jsonb not null,
  type_id      text not null,
  diag         jsonb not null,
  is_public    boolean not null default true,
  flagged      boolean not null default false, -- 순위 제외 (연습 등)
  show_age     boolean not null default false,
  is_streamer  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists lingo_results_owner_idx on public.lingo_results (owner_key, created_at desc);
create index if not exists lingo_results_rank_idx on public.lingo_results (lang, diff, mode, total desc) where is_public and not flagged;
create index if not exists lingo_results_area_idx on public.lingo_results (lang, diff, area, total desc) where is_public and not flagged and area is not null;
create index if not exists lingo_results_user_idx on public.lingo_results (user_id);

-- 오류 신고 (이용자 → 관리자)
create table if not exists public.lingo_reports (
  id          bigint generated always as identity primary key,
  question_id text not null,
  owner_key   text not null,
  reason      text not null check (reason in ('wrong_answer','ambiguous','outdated','typo','unnatural','other')),
  note        text null check (note is null or length(note) <= 300),
  status      text not null default 'open' check (status in ('open','fixed','rejected')),
  admin_note  text null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz null
);
create unique index if not exists lingo_reports_once_idx on public.lingo_reports (question_id, owner_key) where status = 'open';
create index if not exists lingo_reports_status_idx on public.lingo_reports (status, created_at desc);

-- 스트리머 방송 모드 (제목·최종 요약만 — 진행 중 표는 서버 메모리)
create table if not exists public.lingo_broadcasts (
  id            text primary key,
  owner_key     text not null,
  user_id       uuid null references auth.users(id) on delete set null,
  title         text not null,
  streamer_nick text not null,
  lang          text not null check (lang in ('ko','ja','en')),
  diff          text not null check (diff in ('normal','hard','expert')),
  rounds        int  not null check (rounds in (5,10,15)),
  status        text not null default 'live' check (status in ('live','final')),
  summary       jsonb null,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz null
);
create index if not exists lingo_broadcasts_owner_idx on public.lingo_broadcasts (owner_key, created_at desc);

alter table public.lingo_results enable row level security;
alter table public.lingo_reports enable row level security;
alter table public.lingo_broadcasts enable row level security;

commit;

-- 되돌리기:
-- drop table if exists public.lingo_broadcasts; drop table if exists public.lingo_reports; drop table if exists public.lingo_results;
