-- =============================================
-- FIX: Storage 버킷 SELECT RLS 정책 추가
-- 원인: public=true 버킷이라도 INSERT/UPDATE/DELETE 정책이 존재하면
--       RLS가 활성화되어 SELECT 정책 없으면 읽기 차단됨
-- 실행: Supabase Dashboard > SQL Editor
-- =============================================

-- 0) 현재 상태 확인 (실행 전 먼저 돌려볼 것)
-- SELECT id, name, public, allowed_mime_types, file_size_limit
-- FROM storage.buckets
-- ORDER BY id;

-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE tablename = 'objects' AND schemaname = 'storage'
-- ORDER BY policyname;

-- =============================================
-- 1) thumbnails 버킷 — SELECT 정책 추가
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'thumbnails_public_read'
  ) THEN
    CREATE POLICY "thumbnails_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'thumbnails');
    RAISE NOTICE 'Created: thumbnails_public_read';
  ELSE
    RAISE NOTICE 'Already exists: thumbnails_public_read';
  END IF;
END $$;

-- =============================================
-- 2) candidate-images 버킷 — SELECT 정책 추가
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'candidate_images_public_read'
  ) THEN
    CREATE POLICY "candidate_images_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'candidate-images');
    RAISE NOTICE 'Created: candidate_images_public_read';
  ELSE
    RAISE NOTICE 'Already exists: candidate_images_public_read';
  END IF;
END $$;

-- =============================================
-- 3) ugc-media 버킷 — SELECT 정책 추가
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ugc_media_public_read'
  ) THEN
    CREATE POLICY "ugc_media_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'ugc-media');
    RAISE NOTICE 'Created: ugc_media_public_read';
  ELSE
    RAISE NOTICE 'Already exists: ugc_media_public_read';
  END IF;
END $$;

-- =============================================
-- 4) 확인: 모든 버킷의 정책 목록
-- =============================================
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
