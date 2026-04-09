-- ============================================================
-- content_comments: 우승자 칩(게임 종료 댓글) 컬럼
-- ============================================================
-- 게임 종료 후 댓글방(content_comments)에서 작성된 댓글에만
-- 우승자 정보가 함께 저장됩니다.
--
-- - winner_candidate_id : 우승 후보 id (멀티는 null일 수 있음)
-- - winner_label        : 우승자 표시 텍스트 (200자 제한, 클라에서 trim/slice)
-- - winner_thumb_url    : 우승자 썸네일 URL (선택)
--
-- 멱등(idempotent): 이미 존재하는 컬럼은 건너뜀.
-- 한줄평 작성 흐름은 winner_* 를 INSERT 하지 않으므로 안전.
-- ============================================================

ALTER TABLE content_comments
  ADD COLUMN IF NOT EXISTS winner_candidate_id uuid,
  ADD COLUMN IF NOT EXISTS winner_label        text,
  ADD COLUMN IF NOT EXISTS winner_thumb_url    text;

-- 검색 최적화 — 칩 통계/필터 시 활용 (옵션)
CREATE INDEX IF NOT EXISTS idx_content_comments_winner_candidate
  ON content_comments (winner_candidate_id)
  WHERE winner_candidate_id IS NOT NULL;
