-- ============================================================
-- admin_notifications — 관리자 → 유저 운영 알림
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  message           text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  type              text NOT NULL DEFAULT 'notice'
                    CHECK (type IN ('warning','report','request','notice')),
  related_url       text DEFAULT NULL,
  is_read           boolean NOT NULL DEFAULT false,
  sent_by_admin_id  uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 수신자별 최신순 조회
CREATE INDEX IF NOT EXISTS idx_admin_noti_recipient
  ON admin_notifications (recipient_user_id, created_at DESC);

-- 안읽은 알림 빠른 카운트
CREATE INDEX IF NOT EXISTS idx_admin_noti_unread
  ON admin_notifications (recipient_user_id)
  WHERE is_read = false;

-- RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- 사용자: 자기 알림만 조회
CREATE POLICY "Users read own admin notifications"
  ON admin_notifications FOR SELECT
  USING (auth.uid() = recipient_user_id);

-- 사용자: 자기 알림만 읽음 처리 (is_read만 변경 가능)
CREATE POLICY "Users mark own admin notifications read"
  ON admin_notifications FOR UPDATE
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- service_role은 RLS bypass이므로 INSERT 별도 정책 불필요
