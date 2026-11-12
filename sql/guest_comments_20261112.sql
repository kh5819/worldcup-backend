-- ============================================================
-- 비회원(게스트) 댓글 + IP 기록·차단 + 비회원 신고 (2026-11-12)
--  - 월드컵/퀴즈 댓글(content_comments), 티어 댓글(tier_instance_comments)
--  - 게스트 쓰기/삭제는 SECURITY DEFINER RPC 로만 (직접 INSERT 정책 그대로)
--  - IP·비밀번호는 비공개 테이블 guest_comment_meta (정책 0 → 관리자 서버만 읽음)
--  - 기존 회원 댓글·정책·트리거는 그대로 (추가만)
-- ============================================================

ALTER TABLE content_comments       ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tier_instance_comments ALTER COLUMN user_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS guest_comment_meta (
  comment_table text NOT NULL CHECK (comment_table IN ('content_comments','tier_instance_comments','community_comments')),
  comment_id    uuid NOT NULL,
  ip            text NOT NULL,
  pw_hash       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_table, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_guest_comment_meta_ip ON guest_comment_meta (ip, created_at DESC);
ALTER TABLE guest_comment_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guest_comment_meta FROM anon, authenticated;

-- 비회원 신고: reporter_user_id 없이 IP 로 1회 제한
ALTER TABLE comment_reports ALTER COLUMN reporter_user_id DROP NOT NULL;
ALTER TABLE comment_reports ADD COLUMN IF NOT EXISTS reporter_ip text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comment_reports_guest_ip
  ON comment_reports (comment_id, comment_table, reporter_ip) WHERE reporter_user_id IS NULL;

-- 요청 IP (커뮤니티 _community_actor_key 와 같은 순서)
CREATE OR REPLACE FUNCTION public._request_ip()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_headers json; v_ip text;
BEGIN
  BEGIN v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN RETURN NULL; END;
  v_ip := coalesce(nullif(trim(v_headers ->> 'cf-connecting-ip'), ''),
                   nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
                   nullif(trim(v_headers ->> 'x-real-ip'), ''));
  RETURN nullif(trim(coalesce(v_ip, '')), '');
END $$;
REVOKE ALL ON FUNCTION public._request_ip() FROM anon, authenticated, public;

-- 게스트 댓글 쓰기
CREATE OR REPLACE FUNCTION public.guest_add_comment(
  p_table text, p_target_id uuid, p_body text, p_name text, p_pw text DEFAULT NULL,
  p_content_type text DEFAULT NULL, p_parent_id uuid DEFAULT NULL,
  p_winner_candidate_id uuid DEFAULT NULL, p_winner_label text DEFAULT NULL, p_winner_thumb_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE
  v_ip text := public._request_ip();
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
BEGIN
  IF v_ip IS NULL THEN RAISE EXCEPTION 'ip_unknown'; END IF;
  IF EXISTS (SELECT 1 FROM ip_bans WHERE ip = v_ip AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'ip_banned';
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'guest_name_required'; END IF;
  IF v_name ~* '(운영|관리자|admin|플듀|playduo)' THEN RAISE EXCEPTION 'name_not_allowed'; END IF;
  IF p_pw IS NOT NULL AND p_pw <> '' AND char_length(p_pw) NOT BETWEEN 4 AND 64 THEN RAISE EXCEPTION 'guest_pw_invalid'; END IF;
  IF (SELECT count(*) FROM guest_comment_meta WHERE ip = v_ip AND created_at > now() - interval '1 minute') >= 5
     OR (SELECT count(*) FROM guest_comment_meta WHERE ip = v_ip AND created_at > now() - interval '1 hour') >= 40 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF p_table = 'content_comments' THEN
    IF char_length(v_body) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_body'; END IF;
    IF p_content_type NOT IN ('worldcup','quiz','balance') THEN RAISE EXCEPTION 'invalid_type'; END IF;
    IF NOT EXISTS (SELECT 1 FROM contents WHERE id = p_target_id) THEN RAISE EXCEPTION 'not_found'; END IF;
    INSERT INTO content_comments (content_id, content_type, user_id, author_name, body,
                                  winner_candidate_id, winner_label, winner_thumb_url)
    VALUES (p_target_id, p_content_type, NULL, v_name, v_body,
            p_winner_candidate_id,
            nullif(left(trim(coalesce(p_winner_label, '')), 200), ''),
            CASE WHEN p_winner_thumb_url ~* '^https://' THEN left(p_winner_thumb_url, 1000) END)
    RETURNING id INTO v_id;
  ELSIF p_table = 'tier_instance_comments' THEN
    IF char_length(v_body) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_body'; END IF;
    IF NOT EXISTS (SELECT 1 FROM tier_instances WHERE id = p_target_id) THEN RAISE EXCEPTION 'not_found'; END IF;
    IF p_parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM tier_instance_comments WHERE id = p_parent_id AND instance_id = p_target_id) THEN
      RAISE EXCEPTION 'invalid_parent';
    END IF;
    INSERT INTO tier_instance_comments (instance_id, user_id, author_name, body, parent_id)
    VALUES (p_target_id, NULL, v_name, v_body, p_parent_id)
    RETURNING id INTO v_id;
  ELSE
    RAISE EXCEPTION 'invalid_table';
  END IF;

  INSERT INTO guest_comment_meta (comment_table, comment_id, ip, pw_hash)
  VALUES (p_table, v_id, v_ip,
          CASE WHEN coalesce(p_pw, '') <> '' THEN crypt(p_pw, gen_salt('bf')) END);
  RETURN v_id;
END $$;

-- 게스트 댓글 삭제 (비밀번호)
CREATE OR REPLACE FUNCTION public.guest_delete_comment(p_table text, p_comment_id uuid, p_pw text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_hash text;
BEGIN
  IF p_table NOT IN ('content_comments','tier_instance_comments') THEN RAISE EXCEPTION 'invalid_table'; END IF;
  SELECT pw_hash INTO v_hash FROM guest_comment_meta WHERE comment_table = p_table AND comment_id = p_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'no_password'; END IF;
  IF p_pw IS NULL OR crypt(p_pw, v_hash) <> v_hash THEN RAISE EXCEPTION 'wrong_password'; END IF;
  IF p_table = 'content_comments' THEN
    DELETE FROM content_comments WHERE id = p_comment_id AND user_id IS NULL;
  ELSE
    DELETE FROM tier_instance_comments WHERE id = p_comment_id AND user_id IS NULL;
  END IF;
  UPDATE comment_reports SET status = 'resolved'
   WHERE comment_table = p_table AND comment_id = p_comment_id AND status = 'open';
END $$;

REVOKE ALL ON FUNCTION public.guest_add_comment(text, uuid, text, text, text, text, uuid, uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.guest_delete_comment(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.guest_add_comment(text, uuid, text, text, text, text, uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_delete_comment(text, uuid, text) TO anon, authenticated;

-- ============================================================
-- (2) 비회원 신고 — 마이그레이션 guest_reports_20261112 (운영 DB 적용됨)
--   reports / tier_reports / bingo_reports / ptest_reports / comment_reports
--   reporter_ip 로 같은 대상 1회. 자동 숨김 집계(fn_on_report_insert, fn_on_tier_report_insert)는
--   회원 신고만 셈 (NEW.reporter_user_id IS NULL 이면 기록만).
-- ============================================================
