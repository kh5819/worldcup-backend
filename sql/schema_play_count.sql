-- =============================================
-- DUO: play_count 정확 누적 — content_plays 로그 테이블
-- play_count를 게임 완주 시점에만 +1, 쿨다운으로 스팸 방지
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) content_plays 로그 테이블 ==========
CREATE TABLE IF NOT EXISTS content_plays (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('solo', 'multi')),
  game_type   TEXT NOT NULL CHECK (game_type IN ('worldcup', 'quiz')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 2) 인덱스 ==========
-- 쿨다운 조회용: (content_id, user_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_content_plays_cooldown
  ON content_plays (content_id, user_id, created_at DESC);

-- 통계/집계용
CREATE INDEX IF NOT EXISTS idx_content_plays_content
  ON content_plays (content_id, created_at DESC);

-- ========== 3) RLS 활성화 ==========
ALTER TABLE content_plays ENABLE ROW LEVEL SECURITY;

-- 서비스 역할(service_role)만 INSERT 가능 — 일반 유저 직접 삽입 차단
-- service_role은 RLS를 bypass하므로 별도 INSERT 정책 불필요
-- authenticated 유저의 직접 INSERT 차단을 위해 빈 정책만 유지

-- 읽기: 본인 기록만 조회 가능 (선택)
DROP POLICY IF EXISTS "content_plays_select_own" ON content_plays;
CREATE POLICY "content_plays_select_own"
  ON content_plays FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: authenticated 유저 차단 (서비스 역할만 bypass)
-- RLS가 활성화되어 있고 허용 정책이 없으므로 자동 차단됨

-- ========== 4) 검증 쿼리 (실행 후 확인용) ==========
-- SELECT count(*) FROM content_plays;
-- SELECT content_id, count(*) as plays FROM content_plays GROUP BY content_id ORDER BY plays DESC LIMIT 10;
