-- =============================================
-- 순서 퀴즈(ordering) 문제 타입 추가
-- quiz_questions.type CHECK 제약 확장
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- 기존 CHECK 제약 제거 후 ordering 포함하여 재생성
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_type_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_type_check
  CHECK (type IN ('mcq', 'short', 'audio_youtube', 'ordering'));

-- ordering 타입 설명:
-- type = 'ordering'
-- choices = JSONB 배열: 항목들을 정답 순서대로 저장 (예: ["1번째","2번째","3번째","4번째"])
-- answer = JSONB 배열: 정답 인덱스 순서 [0,1,2,...,n-1] (choices가 정답 순서이므로 항상 순차)
-- media_type, media_url: 문제 이미지 (선택)
-- reveal_media_type, reveal_media_url: 정답 공개 이미지 (선택)
