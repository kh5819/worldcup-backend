-- 종합 능력 프로필: 대표 진단서로 게임 종합 진단소(gamelab)도 고를 수 있게 (2026-11-09) — 운영 DB 적용 완료 (11-09)
-- 기존 행·다른 테이블은 건드리지 않음. 제약 조건 하나만 바꿈. 여러 번 실행해도 안전
-- 함께 고침: 운영 제약에 lingo가 빠져 있어 언어 진단소를 대표로 못 고르던 문제 (11-09 운영 확인)
alter table public.ability_profiles drop constraint if exists ability_profiles_rep_kind_check;
alter table public.ability_profiles add constraint ability_profiles_rep_kind_check check (rep_kind = any (array['clinic','iq','mind','sense','know','feel','lingo','gamelab']));
