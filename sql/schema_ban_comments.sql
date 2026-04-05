-- ========== Ban check triggers for comment tables ==========
-- Prevents banned users from creating comments

-- 1) content_comments (worldcup / quiz)
CREATE OR REPLACE FUNCTION fn_check_ban_on_content_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bans
    WHERE user_id = NEW.user_id
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION '정지된 계정입니다. 댓글을 작성할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ban_check_content_comment ON content_comments;
CREATE TRIGGER trg_ban_check_content_comment
  BEFORE INSERT ON content_comments
  FOR EACH ROW EXECUTE FUNCTION fn_check_ban_on_content_comment();

-- 2) tier_instance_comments
DROP TRIGGER IF EXISTS trg_ban_check_tier_comment ON tier_instance_comments;
CREATE TRIGGER trg_ban_check_tier_comment
  BEFORE INSERT ON tier_instance_comments
  FOR EACH ROW EXECUTE FUNCTION fn_check_ban_on_content_comment();

-- 3) notice_comments
DROP TRIGGER IF EXISTS trg_ban_check_notice_comment ON notice_comments;
CREATE TRIGGER trg_ban_check_notice_comment
  BEFORE INSERT ON notice_comments
  FOR EACH ROW EXECUTE FUNCTION fn_check_ban_on_content_comment();

-- Also add ban check on tier_templates creation
CREATE OR REPLACE FUNCTION fn_check_ban_on_tier_template()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bans
    WHERE user_id = NEW.creator_id
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION '정지된 계정입니다. 콘텐츠를 생성할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ban_check_tier_template ON tier_templates;
CREATE TRIGGER trg_ban_check_tier_template
  BEFORE INSERT ON tier_templates
  FOR EACH ROW EXECUTE FUNCTION fn_check_ban_on_tier_template();
