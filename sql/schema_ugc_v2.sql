-- =============================================
-- UGC v2 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) contents 컬럼 확장 ==========

ALTER TABLE contents ADD COLUMN IF NOT EXISTS category      TEXT DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS tags          TEXT[] DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS play_count    INT  DEFAULT 0;

-- mode 컬럼이 이미 type 역할을 하므로 별도 type 컬럼 불필요
-- (mode = 'worldcup' | 'quiz')

-- ========== 2) worldcup_candidates 컬럼 확장 ==========
-- media_type, media_url, start_sec은 이미 존재
-- duration_sec만 추가

ALTER TABLE worldcup_candidates ADD COLUMN IF NOT EXISTS duration_sec INT DEFAULT NULL;

-- ========== 3) RLS 정책 강화 ==========

-- 기존 "모두 SELECT 가능" 정책 제거 후 재생성
DROP POLICY IF EXISTS "contents_select_all" ON contents;

-- public/unlisted: 누구나 SELECT 가능
-- private: owner_id = 현재 유저만 SELECT 가능
CREATE POLICY "contents_select_visibility"
  ON contents FOR SELECT
  USING (
    visibility IN ('public', 'unlisted')
    OR owner_id = auth.uid()
  );

-- INSERT: 로그인 유저만, owner_id = 자기 자신
DROP POLICY IF EXISTS "contents_insert_auth" ON contents;
CREATE POLICY "contents_insert_auth"
  ON contents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- UPDATE: owner만
DROP POLICY IF EXISTS "contents_update_owner" ON contents;
CREATE POLICY "contents_update_owner"
  ON contents FOR UPDATE
  USING (owner_id = auth.uid());

-- DELETE: owner만
DROP POLICY IF EXISTS "contents_delete_owner" ON contents;
CREATE POLICY "contents_delete_owner"
  ON contents FOR DELETE
  USING (owner_id = auth.uid());

-- worldcup_candidates: 소속 콘텐츠 가시성 따라감
DROP POLICY IF EXISTS "candidates_select_all" ON worldcup_candidates;
CREATE POLICY "candidates_select_by_content"
  ON worldcup_candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = content_id
        AND (c.visibility IN ('public', 'unlisted') OR c.owner_id = auth.uid())
    )
  );

-- candidates INSERT: 로그인 유저만
DROP POLICY IF EXISTS "candidates_insert_auth" ON worldcup_candidates;
CREATE POLICY "candidates_insert_auth"
  ON worldcup_candidates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========== 4) 홈 리스트용 View ==========
-- public만 노출, unlisted/private 제외, play_count 내림차순

DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    id,
    mode AS type,
    title,
    description,
    thumbnail_url,
    category,
    tags,
    play_count,
    created_at
  FROM contents
  WHERE visibility = 'public'
  ORDER BY play_count DESC, created_at DESC;

-- ========== 5) Storage: thumbnails 버킷 ==========
-- 아래는 Supabase Dashboard > Storage 에서 수동 생성하거나,
-- supabase CLI로 실행:
--
--   버킷 이름: thumbnails
--   public: true (공개 읽기)
--
-- Storage RLS 정책 (SQL로 설정):

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- 업로드: 로그인 유저만, 자기 폴더에만 (thumbnails/<userId>/*)
CREATE POLICY "thumbnails_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 수정: 자기 파일만
CREATE POLICY "thumbnails_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 삭제: 자기 파일만
CREATE POLICY "thumbnails_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 읽기: 공개 버킷이므로 별도 SELECT 정책 불필요
-- (public=true이면 누구나 URL로 접근 가능)
