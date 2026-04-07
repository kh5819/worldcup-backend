-- =============================================
-- Quiz 이미지 표현 옵션 (crop)
-- 추가일: 2026-04-07
--
-- 원본 이미지는 그대로 두고, "어떻게 보여줄지"만 metadata로 저장한다.
-- v1 모드: 'original' (그대로) | 'crop' (정사각 영역만 보이게)
--
-- 데이터 흐름:
--   media_url            : 원본 이미지 URL (변경 없음)
--   media_display_mode   : 'original' | 'crop'
--   media_display_option : crop 모드일 때 { "crop": {"x":0~1, "y":0~1, "w":0~1, "h":0~1} }
--                          (x,y,w,h는 모두 normalized 0~1 좌표)
--
-- 정답 공개:
--   reveal_media_url 있으면 그 이미지 그대로 표시
--   없으면 같은 media_url을 transform 해제하고 표시 (= 원본 노출 = 줌아웃 효과)
-- =============================================

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS media_display_mode TEXT NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS media_display_option JSONB NOT NULL DEFAULT '{}'::jsonb;

-- CHECK 제약은 별도로 (IF NOT EXISTS 미지원이라 DROP 후 ADD)
ALTER TABLE quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_media_display_mode_check;

ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_media_display_mode_check
  CHECK (media_display_mode IN ('original', 'crop'));

COMMENT ON COLUMN quiz_questions.media_display_mode IS
  '문제용 이미지 표시 방식. original=그대로, crop=일부 영역만 (정사각). 정답 공개 시에는 무조건 원본 노출.';

COMMENT ON COLUMN quiz_questions.media_display_option IS
  'crop 모드일 때 영역 좌표. {"crop":{"x":0.42,"y":0.18,"w":0.25,"h":0.25}} 형식, 모두 normalized 0~1.';
