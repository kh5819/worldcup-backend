-- ============================================
-- 공지사항 (notices) + 댓글 (notice_comments)
-- ============================================

-- 1. notices 테이블
CREATE TABLE IF NOT EXISTS notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  author_id   uuid NOT NULL,
  is_pinned   boolean NOT NULL DEFAULT false,
  comment_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_created ON notices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_pinned  ON notices (is_pinned DESC, created_at DESC);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 (비로그인 포함)
CREATE POLICY "notices_select_all" ON notices
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE 는 service_role (백엔드 requireAdmin) 전용
-- anon/authenticated 유저는 직접 CUD 불가

-- 2. notice_comments 테이블
CREATE TABLE IF NOT EXISTS notice_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id   uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  author_name text NOT NULL,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notice_comments_notice
  ON notice_comments (notice_id, created_at ASC);

ALTER TABLE notice_comments ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기
CREATE POLICY "notice_comments_select_all" ON notice_comments
  FOR SELECT USING (true);

-- 로그인 유저 작성
CREATE POLICY "notice_comments_insert_auth" ON notice_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 본인 삭제
CREATE POLICY "notice_comments_delete_own" ON notice_comments
  FOR DELETE USING (user_id = auth.uid());

-- 3. 댓글 수 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_notice_comment_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE notices SET comment_count = comment_count + 1
      WHERE id = NEW.notice_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE notices SET comment_count = GREATEST(comment_count - 1, 0)
      WHERE id = OLD.notice_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notice_comment_count
  AFTER INSERT OR DELETE ON notice_comments
  FOR EACH ROW EXECUTE FUNCTION update_notice_comment_count();
