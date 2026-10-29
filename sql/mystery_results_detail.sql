-- 플듀 미스터리: 결과에 구간·퍼즐별 시간 저장 (선택 적용)
-- 적용 전에도 서버는 동작한다 (detail 열이 없으면 빼고 저장). 미스터리 전용 테이블이라 다른 기능 영향 없음.
alter table public.mystery_results add column if not exists detail jsonb;
