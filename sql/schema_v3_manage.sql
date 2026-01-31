-- =============================================
-- DUO v3: 콘텐츠 관리 + play_count + 타이머 + 이미지 업로드
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) contents: timer_enabled 컬럼 ==========
ALTER TABLE contents ADD COLUMN IF NOT EXISTS timer_enabled BOOLEAN DEFAULT true;

-- ========== 2) play_count: 서버(service_role)만 업데이트 가능하도록 RLS 강화 ==========
-- 기존 contents_update_owner 정책은 owner가 자기 콘텐츠 수정 가능
-- play_count는 서버(service_role)만 업데이트하므로 RLS bypass됨 (service_role은 RLS 무시)
-- 추가 보안: anon/authenticated 유저가 play_count를 직접 수정 못하도록
-- → contents_update_owner 정책을 유지하되, play_count 컬럼은 trigger로 방어

-- play_count 변조 방지 트리거: 일반 유저가 play_count를 변경하면 무시
CREATE OR REPLACE FUNCTION protect_play_count()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role(또는 postgres)이 아니면 play_count 변경 무시
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

-- ========== 3) CASCADE DELETE: 후보/문제 자동 삭제 ==========
-- worldcup_candidates.content_id → contents.id (CASCADE)
-- 기존 FK가 있으면 제거 후 재생성

DO $$
BEGIN
  -- worldcup_candidates FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'worldcup_candidates_content_id_fkey'
      AND table_name = 'worldcup_candidates'
  ) THEN
    ALTER TABLE worldcup_candidates DROP CONSTRAINT worldcup_candidates_content_id_fkey;
  END IF;

  ALTER TABLE worldcup_candidates
    ADD CONSTRAINT worldcup_candidates_content_id_fkey
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE;

  -- quiz_questions FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quiz_questions_content_id_fkey'
      AND table_name = 'quiz_questions'
  ) THEN
    ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_content_id_fkey;
  END IF;

  ALTER TABLE quiz_questions
    ADD CONSTRAINT quiz_questions_content_id_fkey
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE;
END $$;

-- ========== 4) quiz_questions RLS: owner의 수정/삭제 허용 ==========
DROP POLICY IF EXISTS "quiz_questions_update_owner" ON quiz_questions;
CREATE POLICY "quiz_questions_update_owner"
  ON quiz_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = content_id AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "quiz_questions_delete_owner" ON quiz_questions;
CREATE POLICY "quiz_questions_delete_owner"
  ON quiz_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = content_id AND c.owner_id = auth.uid()
    )
  );

-- worldcup_candidates도 동일
DROP POLICY IF EXISTS "candidates_update_owner" ON worldcup_candidates;
CREATE POLICY "candidates_update_owner"
  ON worldcup_candidates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = content_id AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "candidates_delete_owner" ON worldcup_candidates;
CREATE POLICY "candidates_delete_owner"
  ON worldcup_candidates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = content_id AND c.owner_id = auth.uid()
    )
  );

-- ========== 5) Storage: candidate-images 버킷 ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-images', 'candidate-images', true)
ON CONFLICT (id) DO NOTHING;

-- 업로드: 로그인 유저만, 자기 폴더
CREATE POLICY "candidate_images_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 수정: 자기 파일만
CREATE POLICY "candidate_images_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'candidate-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 삭제: 자기 파일만
CREATE POLICY "candidate_images_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candidate-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== 6) public_contents_list 뷰 업데이트 (creator_name 추가) ==========
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.category,
    c.tags,
    c.play_count,
    c.timer_enabled,
    c.created_at,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email, '익명') AS creator_name
  FROM contents c
  LEFT JOIN auth.users u ON u.id = c.owner_id
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.play_count DESC, c.created_at DESC;
