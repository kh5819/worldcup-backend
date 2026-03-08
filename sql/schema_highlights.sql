-- ============================================================
-- 하이라이트관 (플레이 영상 모음) 스키마
-- 수정: RLS service_role 명시 + 공용 touch_updated_at() 재사용
-- ============================================================

CREATE TABLE IF NOT EXISTS highlights (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform         text NOT NULL CHECK (platform IN ('youtube','soop','chzzk','twitch','other')),
  video_url        text NOT NULL,
  title            text NOT NULL,
  channel_name     text NOT NULL DEFAULT '',
  content_id       uuid REFERENCES contents(id) ON DELETE SET NULL,
  tier_template_id uuid REFERENCES tier_templates(id) ON DELETE SET NULL,
  thumbnail_url    text,
  description      text,
  status           text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  is_public        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  admin_note       text,
  submitted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_highlights_status ON highlights(status);
CREATE INDEX IF NOT EXISTS idx_highlights_content ON highlights(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_highlights_tier ON highlights(tier_template_id) WHERE tier_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_highlights_public ON highlights(is_public, status);

-- RLS 활성화
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- 공개 읽기: 승인 + 공개인 항목만 (anon/authenticated 포함 모든 역할)
CREATE POLICY highlights_select_public ON highlights
  FOR SELECT USING (status = 'approved' AND is_public = true);

-- service_role 전용: 관리자 백엔드에서 모든 작업 가능
CREATE POLICY highlights_service_select ON highlights
  FOR SELECT TO service_role USING (true);

CREATE POLICY highlights_service_insert ON highlights
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY highlights_service_update ON highlights
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY highlights_service_delete ON highlights
  FOR DELETE TO service_role USING (true);

-- updated_at 자동 갱신: 기존 공용 함수 touch_updated_at() 재사용
CREATE TRIGGER trg_highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
