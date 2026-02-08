-- =============================================
-- 티어 템플릿 신고 관리 확장 마이그레이션 (v2)
-- schema_tier_reports.sql 실행 후에 실행
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) tier_templates에 관리용 필드 추가 ==========
-- report_count는 schema_tier_reports.sql에서 이미 추가됨
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS hidden_reason  TEXT;
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

-- ========== 2) 트리거 업데이트: tier_template 신고 3건 이상 시 자동 숨김 ==========
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
    -- 3건 이상이면 자동 숨김
    UPDATE tier_templates
      SET is_hidden = true,
          hidden_reason = COALESCE(hidden_reason, '자동: 신고 누적 3건 이상')
    WHERE id = NEW.target_id
      AND report_count >= 3
      AND is_hidden = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== 3) tier_templates SELECT RLS 갱신 (is_hidden 반영) ==========
-- 공개 + 숨김되지 않은 것 OR 본인 작성
DROP POLICY IF EXISTS "tier_templates_select" ON tier_templates;
CREATE POLICY "tier_templates_select"
  ON tier_templates FOR SELECT
  USING (
    (is_public = true AND is_hidden = false AND deleted_at IS NULL)
    OR creator_id = auth.uid()
  );
