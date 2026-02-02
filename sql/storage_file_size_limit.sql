-- =============================================
-- Supabase Storage: 파일 크기 제한 (5MB)
-- ugc-media 버킷의 파일 업로드를 5MB로 제한
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ugc-media 버킷: 5MB 제한 (mp4 포함 모든 파일)
UPDATE storage.buckets
SET file_size_limit = 5242880  -- 5 * 1024 * 1024 = 5MB
WHERE id = 'ugc-media';

-- thumbnails 버킷: 5MB 제한
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'thumbnails';

-- candidate-images 버킷 (레거시): 5MB 제한
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'candidate-images';
