-- =====================================================
-- content_comments: 콘텐츠별 댓글/커뮤니티 기능
-- Supabase SQL Editor에 그대로 붙여넣기
-- =====================================================

-- 1) 테이블 생성
CREATE TABLE IF NOT EXISTS public.content_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   uuid        NOT NULL,
  content_type text        NOT NULL CHECK (content_type IN ('worldcup', 'quiz')),
  user_id      uuid        NOT NULL,
  author_name  text        NOT NULL,
  body         text        NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 300),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) 인덱스
CREATE INDEX IF NOT EXISTS idx_content_comments_lookup
  ON public.content_comments (content_type, content_id, created_at);

-- 3) RLS 활성화
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

-- 4) RLS 정책

-- SELECT: 누구나 허용 (public read)
CREATE POLICY "comments_select_public"
  ON public.content_comments
  FOR SELECT
  USING (true);

-- INSERT: 로그인 사용자 본인만 (auth.uid() = user_id)
CREATE POLICY "comments_insert_own"
  ON public.content_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 댓글만 삭제
CREATE POLICY "comments_delete_own"
  ON public.content_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- UPDATE는 정책 없음 → 사실상 차단
