-- ============================================================
-- rollback_complete_count.sql — fix_complete_count.sql 되돌리기
-- 문제 발생 시 실행
-- ============================================================

-- 1) content_events 트리거 제거
DROP TRIGGER IF EXISTS trg_auto_increment_complete ON content_events;
DROP FUNCTION IF EXISTS auto_increment_complete_count();

-- 2) protect_play_count를 원래 버전(play_count만 보호)으로 복원
CREATE OR REPLACE FUNCTION protect_play_count()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.play_count := OLD.play_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_play_count ON contents;
CREATE TRIGGER trg_protect_play_count
  BEFORE UPDATE ON contents
  FOR EACH ROW
  EXECUTE FUNCTION protect_play_count();

-- 3) increment_complete_count 원래 버전으로 복원
CREATE OR REPLACE FUNCTION increment_complete_count(p_content_id text, p_content_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_content_type = 'tier' THEN
    UPDATE tier_templates
       SET complete_count = complete_count + 1
     WHERE id = p_content_id::uuid;
  ELSE
    UPDATE contents
       SET complete_count = complete_count + 1
     WHERE id = p_content_id::uuid;
  END IF;
END;
$$;

-- 4) public_contents_list VIEW를 play_count 기준으로 복원
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.thumbnail_version,
    c.category,
    c.tags,
    c.play_count,
    c.complete_count,
    c.timer_enabled,
    c.item_count,
    c.created_at,
    c.updated_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.play_count DESC, c.created_at DESC;

-- ※ complete_count 컬럼 자체는 남겨둠 (DROP하면 데이터 손실)
-- 필요 시: ALTER TABLE contents DROP COLUMN complete_count;
