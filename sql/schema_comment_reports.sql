-- =============================================
-- 댓글 신고 테이블 (comment_reports)
-- 대상: content_comments + tier_instance_comments
-- =============================================

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id      uuid NOT NULL,
  comment_table   text NOT NULL CHECK (comment_table IN ('content_comments', 'tier_instance_comments')),
  reporter_user_id uuid NOT NULL,
  reason          text NOT NULL CHECK (char_length(reason) >= 1 AND char_length(reason) <= 100),
  detail          text CHECK (detail IS NULL OR char_length(detail) <= 500),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- 1인 1댓글 1신고
  UNIQUE (comment_id, comment_table, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON public.comment_reports (status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON public.comment_reports (comment_table, comment_id);

-- RLS
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- 누구나 자기 신고만 INSERT
CREATE POLICY "comment_reports_insert_own"
  ON public.comment_reports FOR INSERT
  WITH CHECK (reporter_user_id = auth.uid());

-- 자기 신고만 SELECT
CREATE POLICY "comment_reports_select_own"
  ON public.comment_reports FOR SELECT
  USING (reporter_user_id = auth.uid());

-- service_role은 모든 작업 가능 (관리자 백엔드)
