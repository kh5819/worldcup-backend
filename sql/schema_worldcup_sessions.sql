-- worldcup_sessions: 솔로 월드컵 이어하기 세션 저장
-- tier_instances 패턴 참고 (status + JSONB state + RLS)
CREATE TABLE IF NOT EXISTS worldcup_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'finished', 'abandoned')),
  initial_candidates JSONB NOT NULL DEFAULT '[]',
  choices JSONB NOT NULL DEFAULT '[]',
  match_logs JSONB NOT NULL DEFAULT '[]',
  content_title TEXT,
  thumbnail_url TEXT,
  timer_enabled BOOLEAN DEFAULT false,
  timer_sec INTEGER DEFAULT 45,
  round_size INTEGER,
  pick_mode TEXT DEFAULT 'random',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 유저당 콘텐츠당 활성 세션은 1개만 허용
CREATE UNIQUE INDEX idx_wc_session_active
  ON worldcup_sessions (user_id, content_id)
  WHERE status = 'playing';

-- 조회 성능용 인덱스
CREATE INDEX idx_wc_session_user_status
  ON worldcup_sessions (user_id, status, updated_at DESC);

-- RLS 활성화
ALTER TABLE worldcup_sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 자기 소유만 CRUD
CREATE POLICY "wc_sessions_select_own" ON worldcup_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wc_sessions_insert_own" ON worldcup_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wc_sessions_update_own" ON worldcup_sessions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "wc_sessions_delete_own" ON worldcup_sessions
  FOR DELETE USING (user_id = auth.uid());
