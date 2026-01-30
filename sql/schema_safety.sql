-- =============================================
-- DUO 운영/안전 시스템 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- =============================================

-- ========== 1) contents 테이블 컬럼 추가 ==========

ALTER TABLE contents ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS hidden_reason  TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS report_count   INT     NOT NULL DEFAULT 0;

-- ========== 2) reports 테이블 ==========

CREATE TABLE IF NOT EXISTS reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL,
  reason           TEXT NOT NULL,
  detail           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, reporter_user_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- reports RLS: 로그인 유저가 본인 reporter로만 INSERT
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
  ON reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_user_id = auth.uid()
  );

-- reports RLS: 본인 신고만 SELECT
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own"
  ON reports FOR SELECT
  USING (reporter_user_id = auth.uid());

-- ========== 3) bans 테이블 ==========

CREATE TABLE IF NOT EXISTS bans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  reason     TEXT,
  expires_at TIMESTAMPTZ,          -- NULL = 영구 밴
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

-- bans RLS: 본인 ban만 SELECT
DROP POLICY IF EXISTS "bans_select_own" ON bans;
CREATE POLICY "bans_select_own"
  ON bans FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE: service_role만 (정책 없음 = 차단)

-- ========== 4) admin_actions 테이블 ==========

CREATE TABLE IF NOT EXISTS admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action_type   TEXT NOT NULL,       -- 'hide' | 'unhide' | 'delete' | 'ban' | 'unban'
  target_type   TEXT NOT NULL,       -- 'content' | 'user'
  target_id     TEXT NOT NULL,
  detail        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
-- admin_actions: 정책 없음 → service_role만 접근

-- ========== 5) 트리거: 신고 누적 → 자동 비노출 ==========

CREATE OR REPLACE FUNCTION fn_on_report_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- report_count 증가
  UPDATE contents
    SET report_count = report_count + 1
  WHERE id = NEW.content_id;

  -- 3건 이상이면 자동 비노출
  UPDATE contents
    SET is_hidden = true,
        hidden_reason = COALESCE(hidden_reason, '자동: 신고 누적 3건 이상')
  WHERE id = NEW.content_id
    AND report_count >= 3
    AND is_hidden = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_report_insert ON reports;
CREATE TRIGGER trg_on_report_insert
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION fn_on_report_insert();

-- ========== 6) 금칙어 필터 (DB 레벨) ==========

CREATE OR REPLACE FUNCTION check_profanity(input_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  banned_words TEXT[] := ARRAY[
    '시발', '씨발', '개새끼', '병신', '지랄', '꺼져',
    '닥쳐', '미친놈', '미친년', '느금마', 'ㅅㅂ', 'ㅂㅅ',
    '좆', '씹', '엿먹어'
  ];
  w TEXT;
BEGIN
  IF input_text IS NULL THEN RETURN false; END IF;
  FOREACH w IN ARRAY banned_words LOOP
    IF position(w IN lower(input_text)) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- contents INSERT/UPDATE: title, description 검사
CREATE OR REPLACE FUNCTION fn_check_contents_profanity()
RETURNS TRIGGER AS $$
BEGIN
  IF check_profanity(NEW.title) THEN
    RAISE EXCEPTION '제목에 금지어가 포함되어 있습니다.';
  END IF;
  IF check_profanity(NEW.description) THEN
    RAISE EXCEPTION '설명에 금지어가 포함되어 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contents_profanity ON contents;
CREATE TRIGGER trg_contents_profanity
  BEFORE INSERT OR UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION fn_check_contents_profanity();

-- worldcup_candidates INSERT/UPDATE: name 검사
CREATE OR REPLACE FUNCTION fn_check_candidate_profanity()
RETURNS TRIGGER AS $$
BEGIN
  IF check_profanity(NEW.name) THEN
    RAISE EXCEPTION '후보 이름에 금지어가 포함되어 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidate_profanity ON worldcup_candidates;
CREATE TRIGGER trg_candidate_profanity
  BEFORE INSERT OR UPDATE ON worldcup_candidates
  FOR EACH ROW EXECUTE FUNCTION fn_check_candidate_profanity();

-- quiz_questions INSERT/UPDATE: prompt, choices 검사
CREATE OR REPLACE FUNCTION fn_check_quiz_profanity()
RETURNS TRIGGER AS $$
BEGIN
  IF check_profanity(NEW.prompt) THEN
    RAISE EXCEPTION '문제 내용에 금지어가 포함되어 있습니다.';
  END IF;
  IF check_profanity(array_to_string(NEW.choices, ' ')) THEN
    RAISE EXCEPTION '보기에 금지어가 포함되어 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quiz_profanity ON quiz_questions;
CREATE TRIGGER trg_quiz_profanity
  BEFORE INSERT OR UPDATE ON quiz_questions
  FOR EACH ROW EXECUTE FUNCTION fn_check_quiz_profanity();

-- ========== 7) 트리거: ban 유저 콘텐츠 생성 차단 ==========

CREATE OR REPLACE FUNCTION fn_check_ban_on_content()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bans
    WHERE user_id = NEW.owner_id
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION '정지된 계정입니다. 콘텐츠를 생성할 수 없습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ban_check_content ON contents;
CREATE TRIGGER trg_ban_check_content
  BEFORE INSERT ON contents
  FOR EACH ROW EXECUTE FUNCTION fn_check_ban_on_content();

-- ========== 8) 뷰 재생성 (is_hidden=false 조건) ==========

DROP VIEW IF EXISTS public_contents_list;
CREATE VIEW public_contents_list AS
  SELECT
    id,
    mode AS type,
    title,
    description,
    thumbnail_url,
    category,
    tags,
    play_count,
    created_at
  FROM contents
  WHERE visibility = 'public'
    AND is_hidden = false
  ORDER BY play_count DESC, created_at DESC;

DROP VIEW IF EXISTS public_quiz_list;
CREATE VIEW public_quiz_list AS
  SELECT c.id, c.mode AS type, c.title, c.thumbnail_url,
         c.play_count, c.created_at
  FROM contents c
  WHERE c.visibility = 'public'
    AND c.mode = 'quiz'
    AND c.is_hidden = false
  ORDER BY c.play_count DESC, c.created_at DESC;

-- ========== 9) contents SELECT RLS 정책 교체 ==========

DROP POLICY IF EXISTS "contents_select_visibility" ON contents;
CREATE POLICY "contents_select_visibility"
  ON contents FOR SELECT
  USING (
    (visibility IN ('public', 'unlisted') AND is_hidden = false)
    OR owner_id = auth.uid()
  );
