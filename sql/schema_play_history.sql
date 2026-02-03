-- =============================================
-- play_history 테이블 (플레이 기록)
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- 1) play_history 테이블 생성
CREATE TABLE IF NOT EXISTS play_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id      UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  content_type    TEXT NOT NULL CHECK (content_type IN ('worldcup', 'quiz')),
  mode            TEXT NOT NULL CHECK (mode IN ('solo', 'multi')),
  played_at       TIMESTAMPTZ DEFAULT now(),
  result_json     JSONB DEFAULT '{}',

  -- 중복 방지용 (같은 유저가 같은 콘텐츠를 10초 내 중복 기록 방지)
  idempotency_key TEXT DEFAULT NULL
);

-- 2) 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_play_history_user_played
  ON play_history(user_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_play_history_user_type_played
  ON play_history(user_id, content_type, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_play_history_user_content
  ON play_history(user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_play_history_idempotency
  ON play_history(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3) RLS 정책
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;

-- 자기 기록만 읽기 가능
CREATE POLICY "play_history_select_own"
  ON play_history FOR SELECT
  USING (user_id = auth.uid());

-- 자기 기록만 쓰기 가능
CREATE POLICY "play_history_insert_own"
  ON play_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 자기 기록만 삭제 가능 (필요시)
CREATE POLICY "play_history_delete_own"
  ON play_history FOR DELETE
  USING (user_id = auth.uid());

-- 4) public_contents_list 뷰 업데이트 (creator_name 추가)
DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    c.id,
    c.mode AS type,
    c.title,
    c.description,
    c.thumbnail_url,
    c.category,
    c.tags,
    c.play_count,
    c.created_at,
    -- 후보 수 (월드컵) 또는 문제 수 (퀴즈)
    CASE
      WHEN c.mode = 'worldcup' THEN (SELECT COUNT(*) FROM worldcup_candidates wc WHERE wc.content_id = c.id)
      WHEN c.mode = 'quiz' THEN (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.content_id = c.id)
      ELSE 0
    END AS item_count,
    -- creator_name (profiles 테이블이 있다면 조인, 없으면 'Unknown')
    COALESCE(
      (SELECT p.nickname FROM profiles p WHERE p.user_id = c.owner_id LIMIT 1),
      'Unknown'
    ) AS creator_name
  FROM contents c
  WHERE c.visibility = 'public'
    AND (c.is_hidden IS NULL OR c.is_hidden = false)
  ORDER BY c.play_count DESC, c.created_at DESC;

-- 5) 콘텐츠별 통계 집계용 함수 (퀴즈 최고 기록)
CREATE OR REPLACE FUNCTION get_user_quiz_best(p_user_id UUID)
RETURNS TABLE (
  best_accuracy NUMERIC,
  best_score INT,
  total_plays INT,
  avg_accuracy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    MAX((result_json->>'accuracy')::NUMERIC) AS best_accuracy,
    MAX((result_json->>'score')::INT) AS best_score,
    COUNT(*)::INT AS total_plays,
    AVG((result_json->>'accuracy')::NUMERIC) AS avg_accuracy
  FROM play_history
  WHERE user_id = p_user_id
    AND content_type = 'quiz';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) 월드컵 통계 집계용 함수
CREATE OR REPLACE FUNCTION get_user_worldcup_best(p_user_id UUID)
RETURNS TABLE (
  total_plays INT,
  win_count INT,
  recent_champion TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_plays,
    COUNT(*) FILTER (WHERE result_json->>'champion_candidate_id' IS NOT NULL)::INT AS win_count,
    (
      SELECT result_json->>'champion_name'
      FROM play_history ph2
      WHERE ph2.user_id = p_user_id
        AND ph2.content_type = 'worldcup'
        AND ph2.result_json->>'champion_candidate_id' IS NOT NULL
      ORDER BY ph2.played_at DESC
      LIMIT 1
    ) AS recent_champion
  FROM play_history
  WHERE user_id = p_user_id
    AND content_type = 'worldcup';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7) profiles 테이블이 없으면 생성 (닉네임용)
CREATE TABLE IF NOT EXISTS profiles (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname  TEXT DEFAULT 'Player',
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());
