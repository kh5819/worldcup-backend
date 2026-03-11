-- ============================================================
-- 시청자 투표 닉네임 지원 마이그레이션
-- audience_votes 테이블에 nickname 컬럼 추가
-- ============================================================

-- 1) nickname 컬럼 추가
ALTER TABLE audience_votes
ADD COLUMN IF NOT EXISTS nickname text;

-- 2) 인덱스: room_code + round_key + created_at DESC (최신 응답 조회용)
CREATE INDEX IF NOT EXISTS idx_audience_votes_recent
ON audience_votes (room_code, round_key, created_at DESC);
