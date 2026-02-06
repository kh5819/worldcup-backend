-- ================================================================
-- schema_quiz_stats.sql — 퀴즈 통계 (quiz_attempts + quiz_question_attempts)
-- DUO 퀴즈 리포트 기능용
-- ================================================================

-- 1) quiz_attempts: 한 번의 퀴즈 완주 기록
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id        UUID NULL,  -- 비로그인 허용
  mode           TEXT NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'multi')),
  correct_count  INT NOT NULL DEFAULT 0,
  total_count    INT NOT NULL DEFAULT 0,
  accuracy       NUMERIC(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_count > 0 THEN correct_count::NUMERIC / total_count ELSE 0 END
  ) STORED,
  duration_ms    INT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id
  ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id
  ON quiz_attempts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created
  ON quiz_attempts(quiz_id, created_at DESC);

-- 2) quiz_question_attempts: 문항별 정답/오답 기록
CREATE TABLE IF NOT EXISTS quiz_question_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id     UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  quiz_id        UUID NOT NULL,
  question_id    UUID NOT NULL,
  is_correct     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qqa_attempt_id
  ON quiz_question_attempts(attempt_id);
CREATE INDEX IF NOT EXISTS idx_qqa_quiz_question
  ON quiz_question_attempts(quiz_id, question_id);

-- 3) 뷰: quiz_id별 전체 통계 (평균 정답률, 플레이 수)
CREATE OR REPLACE VIEW quiz_overall_stats_v AS
SELECT
  quiz_id,
  COUNT(*)::INT                          AS attempt_count,
  ROUND(AVG(accuracy) * 100, 1)         AS avg_accuracy_pct,
  ROUND(MIN(accuracy) * 100, 1)         AS min_accuracy_pct,
  ROUND(MAX(accuracy) * 100, 1)         AS max_accuracy_pct,
  ROUND(AVG(duration_ms)::NUMERIC / 1000, 1) AS avg_duration_sec
FROM quiz_attempts
GROUP BY quiz_id;

-- 4) 뷰: quiz_id + question_id별 정답률/시도 수
CREATE OR REPLACE VIEW quiz_question_stats_v AS
SELECT
  quiz_id,
  question_id,
  COUNT(*)::INT                                           AS attempt_count,
  COUNT(*) FILTER (WHERE is_correct)::INT                 AS correct_count,
  COUNT(*) FILTER (WHERE NOT is_correct)::INT             AS wrong_count,
  ROUND(
    COUNT(*) FILTER (WHERE is_correct)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  )                                                       AS accuracy_pct
FROM quiz_question_attempts
GROUP BY quiz_id, question_id;

-- 5) RLS 정책
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_attempts ENABLE ROW LEVEL SECURITY;

-- quiz_attempts: 누구나 INSERT 가능 (비로그인 대비, 백엔드 service role 사용)
-- SELECT: 집계 뷰는 service role로 접근, 본인 기록은 본인만
CREATE POLICY "quiz_attempts_insert_all"
  ON quiz_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "quiz_attempts_select_own"
  ON quiz_attempts FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- quiz_question_attempts: INSERT는 자유, SELECT는 집계 뷰를 통해서만
CREATE POLICY "quiz_question_attempts_insert_all"
  ON quiz_question_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "quiz_question_attempts_select_via_attempt"
  ON quiz_question_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts a
      WHERE a.id = quiz_question_attempts.attempt_id
      AND (a.user_id = auth.uid() OR a.user_id IS NULL)
    )
  );

-- 6) RPC: 퀴즈 전체 통계 조회 (service role 없이도 사용 가능)
CREATE OR REPLACE FUNCTION get_quiz_stats(p_quiz_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_overall JSON;
  v_questions JSON;
BEGIN
  -- 전체 통계
  SELECT json_build_object(
    'attempt_count', COALESCE(s.attempt_count, 0),
    'avg_accuracy_pct', COALESCE(s.avg_accuracy_pct, 0),
    'min_accuracy_pct', COALESCE(s.min_accuracy_pct, 0),
    'max_accuracy_pct', COALESCE(s.max_accuracy_pct, 0),
    'avg_duration_sec', COALESCE(s.avg_duration_sec, 0)
  )
  INTO v_overall
  FROM quiz_overall_stats_v s
  WHERE s.quiz_id = p_quiz_id;

  IF v_overall IS NULL THEN
    v_overall := '{"attempt_count":0,"avg_accuracy_pct":0,"min_accuracy_pct":0,"max_accuracy_pct":0,"avg_duration_sec":0}'::JSON;
  END IF;

  -- 문항별 통계 (정답률 낮은 순 = 가장 많이 틀린 순)
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.accuracy_pct ASC NULLS LAST), '[]'::JSON)
  INTO v_questions
  FROM (
    SELECT
      qs.question_id,
      qs.attempt_count,
      qs.correct_count,
      qs.wrong_count,
      qs.accuracy_pct,
      qq.prompt,
      qq.type,
      qq.sort_order
    FROM quiz_question_stats_v qs
    LEFT JOIN quiz_questions qq ON qq.id = qs.question_id
    WHERE qs.quiz_id = p_quiz_id
  ) t;

  RETURN json_build_object(
    'overall', v_overall,
    'questions', v_questions
  );
END;
$$;
