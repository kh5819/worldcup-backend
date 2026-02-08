-- =============================================
-- 티어메이커 신고 시스템 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) tier_reports 테이블 ==========
-- reports 테이블은 contents(id) FK가 있어 확장 불가 → 별도 테이블
CREATE TABLE IF NOT EXISTS tier_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type      TEXT NOT NULL CHECK (target_type IN ('tier_battle', 'tier_template')),
  target_id        UUID NOT NULL,
  reporter_user_id UUID NOT NULL,
  reason           TEXT NOT NULL,
  detail           TEXT,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id, reporter_user_id)
);

ALTER TABLE tier_reports ENABLE ROW LEVEL SECURITY;

-- RLS: 로그인 유저가 본인 reporter로만 INSERT
DROP POLICY IF EXISTS "tier_reports_insert_own" ON tier_reports;
CREATE POLICY "tier_reports_insert_own"
  ON tier_reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_user_id = auth.uid()
  );

-- RLS: 본인 신고만 SELECT
DROP POLICY IF EXISTS "tier_reports_select_own" ON tier_reports;
CREATE POLICY "tier_reports_select_own"
  ON tier_reports FOR SELECT
  USING (reporter_user_id = auth.uid());

-- ========== 2) tier_instances에 관리용 필드 추가 ==========
ALTER TABLE tier_instances ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tier_instances ADD COLUMN IF NOT EXISTS hidden_reason  TEXT;
ALTER TABLE tier_instances ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
ALTER TABLE tier_instances ADD COLUMN IF NOT EXISTS report_count   INT NOT NULL DEFAULT 0;

-- ========== 3) tier_templates에 report_count 필드 추가 ==========
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS report_count   INT NOT NULL DEFAULT 0;

-- ========== 4) 트리거: tier_reports INSERT 시 report_count 자동 증가 ==========
CREATE OR REPLACE FUNCTION fn_on_tier_report_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'tier_battle' THEN
    UPDATE tier_instances
      SET report_count = report_count + 1
    WHERE id = NEW.target_id;
    -- 3건 이상이면 자동 숨김
    UPDATE tier_instances
      SET is_hidden = true,
          hidden_reason = COALESCE(hidden_reason, '자동: 신고 누적 3건 이상')
    WHERE id = NEW.target_id
      AND report_count >= 3
      AND is_hidden = false;
  ELSIF NEW.target_type = 'tier_template' THEN
    UPDATE tier_templates
      SET report_count = report_count + 1
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_tier_report_insert ON tier_reports;
CREATE TRIGGER trg_on_tier_report_insert
  AFTER INSERT ON tier_reports
  FOR EACH ROW EXECUTE FUNCTION fn_on_tier_report_insert();

-- ========== 5) tier_instances SELECT RLS 갱신 (is_hidden 반영) ==========
-- 기존 정책 삭제 후 재생성: published + not hidden OR 본인
DROP POLICY IF EXISTS "tier_instances_select" ON tier_instances;
CREATE POLICY "tier_instances_select"
  ON tier_instances FOR SELECT
  USING (
    (status = 'published' AND is_hidden = false AND deleted_at IS NULL)
    OR user_id = auth.uid()
  );
