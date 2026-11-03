-- 종합 능력 프로필: 대표 진단서로 상식 진단소(know) 허용 — 운영 적용 2026-11-03 (마이그레이션 ability_know_rep)
-- 허용 값만 넓힘 (기존 행 영향 없음). 되돌리기: 'know' 빼고 다시 만들기 (know 행이 있으면 먼저 null로)
alter table public.ability_profiles drop constraint if exists ability_profiles_rep_kind_check;
alter table public.ability_profiles add constraint ability_profiles_rep_kind_check check (rep_kind = any (array['clinic','iq','mind','sense','know']));
