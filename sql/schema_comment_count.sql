-- schema_comment_count.sql
-- 제안: contents 테이블에 comment_count 컬럼 + 자동 업데이트 트리거
-- 향후 피드 카드에서 댓글 수를 표시할 때 사용
-- (현재 한줄평 미리보기는 Supabase count 쿼리로 충분하므로 즉시 적용 불필요)

-- 1) comment_count 컬럼 추가
ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0;

-- 2) 트리거 함수: INSERT/DELETE 시 자동 업데이트
CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contents SET comment_count = comment_count + 1
    WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contents SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) 트리거 연결
DROP TRIGGER IF EXISTS trg_content_comment_count ON content_comments;
CREATE TRIGGER trg_content_comment_count
  AFTER INSERT OR DELETE ON content_comments
  FOR EACH ROW EXECUTE FUNCTION update_content_comment_count();

-- 4) 기존 데이터 동기화 (1회성)
UPDATE contents c SET comment_count = sub.cnt
FROM (
  SELECT content_id, COUNT(*) AS cnt
  FROM content_comments
  GROUP BY content_id
) sub
WHERE c.id = sub.content_id;
