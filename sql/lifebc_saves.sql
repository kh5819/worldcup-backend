-- 인생 방송국 — 서버 저장 (2026-11-05 작성, 아직 운영 DB에 적용 안 함)
-- 새 테이블 1개만 추가 — 기존 테이블·정책·함수 변경 없음. 멀티·채팅과 무관.
-- RLS 켬 + 정책 0 = 백엔드(service_role) 전용. 브라우저에서 직접 읽기/쓰기 불가.
-- 회원만 저장 (owner_key = 'u:<user id>'). 칸 0 = 아침 자동 저장, 1~3 = 직접 저장.
-- 여러 번 실행해도 안전(if not exists). 되돌리기: 맨 아래 drop 문
begin;

create table if not exists public.lifebc_saves (
  owner_key    text not null,
  slot         smallint not null check (slot between 0 and 3),
  user_id      uuid null references auth.users(id) on delete cascade,
  station_name text not null default '',
  mode         text not null default 'story' check (mode in ('story', 'free')),
  day          int  not null default 1 check (day between 1 and 100000),
  money        bigint not null default 0,
  ver          int  not null default 1,
  bytes        int  not null default 0,
  data         text not null,                      -- 게임 상태 JSON (서버에서 크기·형식 검사 후 저장, 최대 450KB)
  updated_at   timestamptz not null default now(),
  primary key (owner_key, slot)
);
create index if not exists lifebc_saves_user_idx on public.lifebc_saves (user_id);

alter table public.lifebc_saves enable row level security;
-- 정책을 만들지 않음 = anon/authenticated 키로는 접근 불가, service_role(백엔드)만 사용

commit;

-- 되돌리기:
-- drop table if exists public.lifebc_saves;
