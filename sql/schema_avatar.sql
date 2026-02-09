-- ============================================================
-- 프로필 아바타 (avatar_url 컬럼 + avatars 스토리지 버킷)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1) profiles 테이블에 avatar_url 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) avatars 버킷 생성 (공개 읽기)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3) 스토리지 RLS: 누구나 읽기
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 4) 스토리지 RLS: 로그인 유저가 자신의 폴더에만 업로드
CREATE POLICY "avatars_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) 스토리지 RLS: 로그인 유저가 자신의 파일만 덮어쓰기
CREATE POLICY "avatars_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6) 스토리지 RLS: 로그인 유저가 자신의 파일만 삭제
CREATE POLICY "avatars_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
