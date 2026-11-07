-- 종합 능력 프로필: 대표 진단서로 감각 진단소(feel) 결과도 고를 수 있게 (2026-11-07) — 아직 운영 DB에 적용 안 함
-- 기존 행·다른 테이블은 건드리지 않음. 제약 조건 하나만 바꿈(기존 5개 + feel). 여러 번 실행해도 안전
alter table public.ability_profiles drop constraint if exists ability_profiles_rep_kind_check;
alter table public.ability_profiles add constraint ability_profiles_rep_kind_check check (rep_kind = any (array['clinic','iq','mind','sense','know','feel']));
