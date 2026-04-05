DROP FUNCTION IF EXISTS get_quiz_stats(UUID);

CREATE FUNCTION get_quiz_stats(p_quiz_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_overall JSON;
  v_questions JSON;
BEGIN
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

  SELECT COALESCE(
    json_agg(row_to_json(sub) ORDER BY sub.accuracy_pct ASC NULLS LAST),
    '[]'::JSON
  )
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
      qq.sort_order,
      qq.answer,
      qq.choices,
      qq.media_url,
      qq.media_type
    FROM quiz_question_stats_v qs
    INNER JOIN quiz_questions qq ON qq.id = qs.question_id
    WHERE qs.quiz_id = p_quiz_id
  ) sub;

  RETURN json_build_object(
    'overall', v_overall,
    'questions', v_questions
  );
END;
$fn$;
