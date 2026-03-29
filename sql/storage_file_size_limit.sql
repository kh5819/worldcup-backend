-- =============================================
-- Supabase Storage: 파일 크기 제한
-- ugc-media 버킷: 10MB (MP4 지원), 나머지: 5MB
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ugc-media 버킷: 10MB 제한 (MP4 최대 10MB 지원)
UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10 * 1024 * 1024 = 10MB
WHERE id = 'ugc-media';

-- thumbnails 버킷: 5MB 제한
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'thumbnails';

-- candidate-images 버킷 (레거시): 5MB 제한
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'candidate-images';
