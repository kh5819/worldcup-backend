-- =============================================
-- Supabase SQL: quiz_questions 테이블
-- contents 테이블(mode='quiz')을 재활용하며,
-- 이 테이블은 개별 문제를 저장한다.
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- 1) quiz_questions 테이블
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,

  -- 문제 유형: 객관식 / 주관식 / 유튜브 소리퀴즈
  type          TEXT NOT NULL DEFAULT 'mcq'
                  CHECK (type IN ('mcq', 'short', 'audio_youtube')),

  -- 문제 텍스트 (예: "이 노래의 제목은?")
  prompt        TEXT NOT NULL DEFAULT '',

  -- 객관식 보기 (JSON 배열, 예: ["서울","부산","대구","인천"])
  -- mcq일 때만 사용, short/audio_youtube는 null 가능
  choices       JSONB DEFAULT '[]',

  -- 정답 (JSON 배열, 동의어 지원)
  -- mcq: [0] (정답 인덱스)
  -- short: ["뉴욕", "newyork", "New York"]
  -- audio_youtube: ["곡제목", "별칭"]
  answer        JSONB NOT NULL DEFAULT '[]',

  -- 미디어 (유튜브 소리퀴즈용)
  media_type    TEXT NOT NULL DEFAULT 'none'
                  CHECK (media_type IN ('none', 'youtube')),
  media_url     TEXT DEFAULT '',          -- youtube URL 또는 videoId
  start_sec     INT DEFAULT 0,            -- 재생 시작 지점 (초)
  duration_sec  INT DEFAULT 10,           -- 재생 길이 (초)

  -- 정렬 순서
  sort_order    INT NOT NULL DEFAULT 0
);

-- 2) RLS + 읽기 허용
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_questions_select_all"
  ON quiz_questions FOR SELECT
  USING (true);

-- 프론트에서 직접 INSERT 허용 (로그인 유저만)
CREATE POLICY "quiz_questions_insert_auth"
  ON quiz_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) 인덱스
CREATE INDEX IF NOT EXISTS idx_quiz_questions_content_id
  ON quiz_questions(content_id, sort_order);

-- =============================================
-- 샘플 데이터 (테스트용)
-- ⚠️ owner_id를 실제 Supabase Auth 사용자 UUID로 교체하세요
-- =============================================

-- 퀴즈 콘텐츠 (contents 테이블에 mode='quiz'로 삽입)
INSERT INTO contents (id, mode, title, description, owner_id, visibility) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'quiz',
   '종합 퀴즈 테스트',
   '객관식 + 주관식 + 소리퀴즈 샘플',
   '00000000-0000-0000-0000-000000000000',   -- ← 실제 user id로 교체
   'public');

-- 문제 1: 객관식(mcq)
INSERT INTO quiz_questions (content_id, type, prompt, choices, answer, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'mcq',
   '대한민국의 수도는?',
   '["서울", "부산", "대구", "인천"]',
   '[0]',
   1);

-- 문제 2: 주관식(short)
INSERT INTO quiz_questions (content_id, type, prompt, choices, answer, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'short',
   '미국에서 가장 인구가 많은 도시는?',
   '[]',
   '["뉴욕", "newyork", "new york", "NYC"]',
   2);

-- 문제 3: 유튜브 소리퀴즈(audio_youtube)
INSERT INTO quiz_questions (content_id, type, prompt, choices, answer, media_type, media_url, start_sec, duration_sec, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222',
   'audio_youtube',
   '이 노래의 제목은?',
   '[]',
   '["Dynamite", "다이너마이트"]',
   'youtube',
   'gdZLi9oWNZg',
   30,
   10,
   3);
