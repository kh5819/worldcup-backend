-- =============================================
-- Supabase SQL: contents + worldcup_candidates
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- 1) contents 테이블
CREATE TABLE IF NOT EXISTS contents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode        TEXT NOT NULL CHECK (mode IN ('worldcup', 'quiz')),
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id    UUID NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'unlisted', 'private')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2) worldcup_candidates 테이블
CREATE TABLE IF NOT EXISTS worldcup_candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  media_type  TEXT NOT NULL DEFAULT 'image'
                CHECK (media_type IN ('image', 'gif', 'youtube', 'mp4', 'url')),
  media_url   TEXT DEFAULT '',
  start_sec   INT,
  sort_order  INT NOT NULL DEFAULT 0
);

-- 3) RLS + 읽기 허용 정책
--    서버는 SERVICE_ROLE_KEY로 접근하므로 RLS를 bypass하지만,
--    프론트에서 직접 조회할 경우를 대비해 SELECT 정책 추가
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldcup_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contents_select_all"
  ON contents FOR SELECT
  USING (true);

CREATE POLICY "candidates_select_all"
  ON worldcup_candidates FOR SELECT
  USING (true);

-- 4) 인덱스
CREATE INDEX IF NOT EXISTS idx_candidates_content_id
  ON worldcup_candidates(content_id, sort_order);

-- =============================================
-- 샘플 데이터
-- ⚠️ owner_id를 실제 Supabase Auth 사용자 UUID로 교체하세요
-- =============================================
INSERT INTO contents (id, mode, title, description, owner_id, visibility) VALUES
  ('11111111-1111-1111-1111-111111111111',
   'worldcup',
   '최고의 과일 월드컵',
   '8강 과일 이상형 월드컵!',
   '00000000-0000-0000-0000-000000000000',   -- ← 실제 user id로 교체
   'public');

INSERT INTO worldcup_candidates (content_id, name, media_type, media_url, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', '사과',   'image', 'https://via.placeholder.com/200?text=Apple',      1),
  ('11111111-1111-1111-1111-111111111111', '바나나', 'image', 'https://via.placeholder.com/200?text=Banana',     2),
  ('11111111-1111-1111-1111-111111111111', '딸기',   'image', 'https://via.placeholder.com/200?text=Strawberry', 3),
  ('11111111-1111-1111-1111-111111111111', '포도',   'image', 'https://via.placeholder.com/200?text=Grape',      4),
  ('11111111-1111-1111-1111-111111111111', '수박',   'image', 'https://via.placeholder.com/200?text=Watermelon', 5),
  ('11111111-1111-1111-1111-111111111111', '망고',   'image', 'https://via.placeholder.com/200?text=Mango',      6),
  ('11111111-1111-1111-1111-111111111111', '체리',   'image', 'https://via.placeholder.com/200?text=Cherry',     7),
  ('11111111-1111-1111-1111-111111111111', '키위',   'image', 'https://via.placeholder.com/200?text=Kiwi',       8);
