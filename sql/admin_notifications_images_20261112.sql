-- 운영 알림 사진 첨부 (2026-11-12)
-- 빈 칸 하나 추가만 함 → 기존 알림·다른 기능 영향 없음
ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT NULL
  CHECK (image_urls IS NULL OR cardinality(image_urls) <= 4);
