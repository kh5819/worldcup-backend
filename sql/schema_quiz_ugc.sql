-- ============================================================
-- DUO: 퀴즈 UGC 마이그레이션
-- 실행: Supabase SQL Editor에서 전체 실행
-- ============================================================

-- 1) quiz_questions 테이블
--    백엔드(loadQuizQuestions)와 칼럼명 일치:
--    type, prompt, choices, answer, media_type, media_url, start_sec, duration_sec
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    uuid        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  sort_order    int         NOT NULL,
  type          text        NOT NULL CHECK (type IN ('mcq','short','audio_youtube')),
  prompt        text        NOT NULL,
  choices       text[]      NULL,           -- MCQ: 보기 배열
  answer        text[]      NOT NULL DEFAULT '{}',
    -- MCQ: ['정답인덱스(0-based)']  예) ['2']
    -- SHORT/AUDIO: ['정답', '동의어1', '동의어2', ...]
  media_type    text        NULL,           -- 'youtube' 등
  media_url     text        NULL,           -- 유튜브 URL 또는 videoId
  start_sec     int         NULL DEFAULT 0,
  duration_sec  int         NULL DEFAULT 10,
  created_at    timestamptz DEFAULT now()
);

-- 2) 인덱스
CREATE INDEX IF NOT EXISTS idx_quiz_questions_content_sort
  ON quiz_questions(content_id, sort_order);

-- 3) RLS
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

-- SELECT: contents의 visibility가 public/unlisted이면 누구나, private이면 owner만
CREATE POLICY quiz_questions_select ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = quiz_questions.content_id
      AND (
        c.visibility IN ('public','unlisted')
        OR c.owner_id = auth.uid()
      )
    )
  );

-- INSERT: contents의 owner만
CREATE POLICY quiz_questions_insert ON quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = quiz_questions.content_id
      AND c.owner_id = auth.uid()
    )
  );

-- UPDATE: contents의 owner만
CREATE POLICY quiz_questions_update ON quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = quiz_questions.content_id
      AND c.owner_id = auth.uid()
    )
  );

-- DELETE: contents의 owner만
CREATE POLICY quiz_questions_delete ON quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM contents c
      WHERE c.id = quiz_questions.content_id
      AND c.owner_id = auth.uid()
    )
  );

-- 4) 퀴즈 공개 리스트 뷰
CREATE OR REPLACE VIEW public_quiz_list AS
SELECT c.id, c.mode AS type, c.title, c.thumbnail_url,
       c.play_count, c.created_at
FROM contents c
WHERE c.visibility = 'public' AND c.mode = 'quiz'
ORDER BY c.play_count DESC, c.created_at DESC;
