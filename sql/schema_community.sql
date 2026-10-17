-- ============================================================
-- DUO 커뮤니티: 게시글(사진) + 좋아요/싫어요 + 댓글/대댓글
-- 실행 대상: Supabase SQL Editor (한 번만 실행, 재실행 안전)
--
-- 설계:
--   - 읽기: 누구나 (테이블 SELECT 정책)
--   - 쓰기: 전부 SECURITY DEFINER RPC 경유 (로그인/비로그인 공용)
--       · 로그인  → user_id = auth.uid(), 알림 대상
--       · 비로그인 → guest_name + 비밀번호(bcrypt) 로 작성/삭제, 알림 없음
--   - 비회원 비밀번호·IP해시는 community_secrets (정책 0 = anon 완전 차단)
--   - 도배 방지: IP(또는 유저) 기준 글 3개/5분, 댓글 10개/1분
--   - 신규 테이블만 추가 → 기존 멀티·채팅·제작 영향 0
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1. 게시글 ──
CREATE TABLE IF NOT EXISTS public.community_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name     text,
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body           text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  image_urls     text[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(image_urls, 1), 0) <= 5),
  like_count     int NOT NULL DEFAULT 0,
  dislike_count  int NOT NULL DEFAULT 0,
  comment_count  int NOT NULL DEFAULT 0,
  view_count     int NOT NULL DEFAULT 0,
  is_deleted     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts(user_id);
-- 말머리(선택): none=없음(기본), free=자유, question=질문, recommend=추천, multi=멀티구인
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'none';
ALTER TABLE public.community_posts ALTER COLUMN category SET DEFAULT 'none';
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_category_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('none', 'free', 'question', 'recommend', 'multi'));
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category, created_at DESC) WHERE NOT is_deleted;
-- 목록 탭 정렬 (인기순=좋아요, 조회수순)
CREATE INDEX IF NOT EXISTS idx_community_posts_likes ON public.community_posts(like_count DESC, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_posts_views ON public.community_posts(view_count DESC, created_at DESC) WHERE NOT is_deleted;

-- ── 2. 댓글 (parent_id NULL = 댓글, NOT NULL = 대댓글, 1단계만) ──
CREATE TABLE IF NOT EXISTS public.community_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name  text,
  body        text NOT NULL CHECK (char_length(body) <= 1000),
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user ON public.community_comments(user_id);

-- ── 3. 투표 (voter_key = 'u:<uid>' 또는 'ip:<hash>') ──
CREATE TABLE IF NOT EXISTS public.community_post_votes (
  post_id     uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  voter_key   text NOT NULL,
  vote_type   text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, voter_key)
);

-- ── 4. 비공개 비밀값 (비회원 비번 해시 + IP 해시, 도배 판정용) ──
CREATE TABLE IF NOT EXISTS public.community_secrets (
  target_type  text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id    uuid NOT NULL,
  pw_hash      text,
  actor_key    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_community_secrets_actor ON public.community_secrets(actor_key, target_type, created_at DESC);

-- ── 5. 관리자 차단 (비회원=IP해시, 회원=계정) ──
CREATE TABLE IF NOT EXISTS public.community_bans (
  actor_key   text PRIMARY KEY,
  reason      text,
  sample      text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──
ALTER TABLE public.community_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_secrets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_bans       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_select_all" ON public.community_posts;
CREATE POLICY "community_posts_select_all" ON public.community_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_comments_select_all" ON public.community_comments;
CREATE POLICY "community_comments_select_all" ON public.community_comments FOR SELECT USING (true);
-- votes / secrets: 정책 없음 = 직접 접근 차단 (RPC만)

-- ── 내부 헬퍼: 요청자 키 ──
CREATE OR REPLACE FUNCTION public._community_actor_key()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_headers json;
  v_ip text;
BEGIN
  IF v_uid IS NOT NULL THEN RETURN 'u:' || v_uid::text; END IF;
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN v_headers := NULL;
  END;
  v_ip := coalesce(nullif(trim(v_headers ->> 'cf-connecting-ip'), ''),
                   nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
                   nullif(trim(v_headers ->> 'x-real-ip'), ''));
  v_ip := nullif(trim(coalesce(v_ip, '')), '');
  IF v_ip IS NULL THEN RETURN 'ip:unknown'; END IF;
  RETURN 'ip:' || md5(v_ip || ':duo-community');
END $$;

-- ── 내부 헬퍼: 차단 여부 ──
CREATE OR REPLACE FUNCTION public._community_assert_not_banned(p_key text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM community_bans WHERE actor_key = p_key) THEN
    RAISE EXCEPTION 'banned';
  END IF;
END $$;

-- ── 글 작성 ──
DROP FUNCTION IF EXISTS public.community_create_post(text, text, text[], text, text);
CREATE OR REPLACE FUNCTION public.community_create_post(
  p_title text, p_body text, p_image_urls text[] DEFAULT '{}',
  p_guest_name text DEFAULT NULL, p_guest_pw text DEFAULT NULL,
  p_category text DEFAULT 'none'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := public._community_actor_key();
  v_id uuid;
BEGIN
  PERFORM public._community_assert_not_banned(v_key);
  IF (SELECT count(*) FROM community_secrets
      WHERE actor_key = v_key AND target_type = 'post' AND created_at > now() - interval '5 minutes') >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF v_uid IS NULL THEN
    IF char_length(trim(coalesce(p_guest_name, ''))) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'guest_name_required'; END IF;
    IF char_length(coalesce(p_guest_pw, '')) < 4 THEN RAISE EXCEPTION 'guest_pw_required'; END IF;
    -- 비회원은 사진 업로드 불가(Storage가 로그인 전용) → 외부 URL 주입도 차단
    p_image_urls := '{}';
  END IF;
  -- 사진은 우리 Storage(ugc-media/community/<본인>/)에 올린 것만 허용 (외부 URL 주입 차단)
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_image_urls, '{}')) u
             WHERE left(u, length('https://irqhgsusfzvytpgirwdo.supabase.co/storage/v1/object/public/ugc-media/community/' || v_uid::text || '/'))
                   <> 'https://irqhgsusfzvytpgirwdo.supabase.co/storage/v1/object/public/ugc-media/community/' || v_uid::text || '/') THEN
    RAISE EXCEPTION 'invalid_image_url';
  END IF;

  IF coalesce(p_category, 'none') NOT IN ('none', 'free', 'question', 'recommend', 'multi') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  INSERT INTO community_posts (user_id, guest_name, title, body, image_urls, category)
  VALUES (v_uid, CASE WHEN v_uid IS NULL THEN trim(p_guest_name) END,
          trim(p_title), coalesce(p_body, ''), coalesce(p_image_urls, '{}'), coalesce(p_category, 'none'))
  RETURNING id INTO v_id;

  INSERT INTO community_secrets (target_type, target_id, pw_hash, actor_key)
  VALUES ('post', v_id,
          CASE WHEN v_uid IS NULL THEN crypt(p_guest_pw, gen_salt('bf')) END, v_key);
  RETURN v_id;
END $$;

-- ── 글 삭제 (본인 / 비회원 비번 / 관리자) ──
CREATE OR REPLACE FUNCTION public.community_delete_post(p_post_id uuid, p_guest_pw text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_post community_posts%ROWTYPE;
  v_hash text;
BEGIN
  SELECT * INTO v_post FROM community_posts WHERE id = p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_admin() THEN
    IF v_post.user_id IS NOT NULL THEN
      IF v_post.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
    ELSE
      SELECT pw_hash INTO v_hash FROM community_secrets WHERE target_type = 'post' AND target_id = p_post_id;
      IF v_hash IS NULL OR p_guest_pw IS NULL OR crypt(p_guest_pw, v_hash) <> v_hash THEN
        RAISE EXCEPTION 'wrong_password';
      END IF;
    END IF;
  END IF;
  UPDATE community_posts SET is_deleted = true WHERE id = p_post_id;
  UPDATE community_reports SET status = 'resolved'
   WHERE target_type = 'post' AND target_id = p_post_id AND status = 'pending';
END $$;

-- ── 댓글/대댓글 작성 ──
CREATE OR REPLACE FUNCTION public.community_add_comment(
  p_post_id uuid, p_body text, p_parent_id uuid DEFAULT NULL,
  p_guest_name text DEFAULT NULL, p_guest_pw text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := public._community_actor_key();
  v_parent community_comments%ROWTYPE;
  v_id uuid;
BEGIN
  PERFORM public._community_assert_not_banned(v_key);
  IF char_length(trim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  IF NOT EXISTS (SELECT 1 FROM community_posts WHERE id = p_post_id AND NOT is_deleted) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF (SELECT count(*) FROM community_secrets
      WHERE actor_key = v_key AND target_type = 'comment' AND created_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF v_uid IS NULL THEN
    IF char_length(trim(coalesce(p_guest_name, ''))) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'guest_name_required'; END IF;
    IF char_length(coalesce(p_guest_pw, '')) < 4 THEN RAISE EXCEPTION 'guest_pw_required'; END IF;
  END IF;
  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM community_comments WHERE id = p_parent_id;
    IF NOT FOUND OR v_parent.post_id <> p_post_id THEN RAISE EXCEPTION 'invalid_parent'; END IF;
    -- 대댓글의 대댓글 → 최상위 댓글에 붙임 (1단계 유지)
    IF v_parent.parent_id IS NOT NULL THEN p_parent_id := v_parent.parent_id; END IF;
  END IF;

  INSERT INTO community_comments (post_id, parent_id, user_id, guest_name, body)
  VALUES (p_post_id, p_parent_id, v_uid, CASE WHEN v_uid IS NULL THEN trim(p_guest_name) END, trim(p_body))
  RETURNING id INTO v_id;

  INSERT INTO community_secrets (target_type, target_id, pw_hash, actor_key)
  VALUES ('comment', v_id,
          CASE WHEN v_uid IS NULL THEN crypt(p_guest_pw, gen_salt('bf')) END, v_key);

  UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = p_post_id;
  RETURN v_id;
END $$;

-- ── 댓글 삭제 (soft: 대댓글 보존 위해 내용만 비움) ──
CREATE OR REPLACE FUNCTION public.community_delete_comment(p_comment_id uuid, p_guest_pw text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_c community_comments%ROWTYPE;
  v_hash text;
BEGIN
  SELECT * INTO v_c FROM community_comments WHERE id = p_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_c.is_deleted THEN
    -- 자동숨김된 댓글을 관리자가 확정 삭제 (카운트는 숨김 때 이미 차감)
    IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_found'; END IF;
    UPDATE community_comments SET body = '' WHERE id = p_comment_id;
    UPDATE community_reports SET status = 'resolved'
     WHERE target_type = 'comment' AND target_id = p_comment_id AND status = 'pending';
    RETURN;
  END IF;
  IF NOT public.is_admin() THEN
    IF v_c.user_id IS NOT NULL THEN
      IF v_c.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
    ELSE
      SELECT pw_hash INTO v_hash FROM community_secrets WHERE target_type = 'comment' AND target_id = p_comment_id;
      IF v_hash IS NULL OR p_guest_pw IS NULL OR crypt(p_guest_pw, v_hash) <> v_hash THEN
        RAISE EXCEPTION 'wrong_password';
      END IF;
    END IF;
  END IF;
  UPDATE community_comments SET is_deleted = true, body = '' WHERE id = p_comment_id;
  UPDATE community_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = v_c.post_id;
  UPDATE community_reports SET status = 'resolved'
   WHERE target_type = 'comment' AND target_id = p_comment_id AND status = 'pending';
END $$;

-- ── 좋아요/싫어요 토글 (같은 버튼 다시 = 취소, 반대 = 전환) → 내 최종 상태 반환 ──
CREATE OR REPLACE FUNCTION public.community_vote(p_post_id uuid, p_vote text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := public._community_actor_key();
  v_prev text;
  v_result text;
BEGIN
  PERFORM public._community_assert_not_banned(v_key);
  IF p_vote NOT IN ('up', 'down') THEN RAISE EXCEPTION 'invalid_vote'; END IF;
  IF v_key = 'ip:unknown' THEN RAISE EXCEPTION 'login_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM community_posts WHERE id = p_post_id AND NOT is_deleted) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT vote_type INTO v_prev FROM community_post_votes WHERE post_id = p_post_id AND voter_key = v_key;
  IF v_prev = p_vote THEN
    DELETE FROM community_post_votes WHERE post_id = p_post_id AND voter_key = v_key;
    v_result := NULL;
  ELSIF v_prev IS NULL THEN
    INSERT INTO community_post_votes (post_id, voter_key, vote_type) VALUES (p_post_id, v_key, p_vote);
    v_result := p_vote;
  ELSE
    UPDATE community_post_votes SET vote_type = p_vote, created_at = now()
     WHERE post_id = p_post_id AND voter_key = v_key;
    v_result := p_vote;
  END IF;

  UPDATE community_posts SET
    like_count    = (SELECT count(*) FROM community_post_votes WHERE post_id = p_post_id AND vote_type = 'up'),
    dislike_count = (SELECT count(*) FROM community_post_votes WHERE post_id = p_post_id AND vote_type = 'down')
  WHERE id = p_post_id;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.community_my_vote(p_post_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vote_type FROM community_post_votes
   WHERE post_id = p_post_id AND voter_key = public._community_actor_key();
$$;

-- ── 조회수: 같은 사람(비회원=IP, 회원=계정)은 글당 하루(KST) 1회만 ──
CREATE TABLE IF NOT EXISTS public.community_post_views (
  post_id     uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  viewer_key  text NOT NULL,
  view_date   date NOT NULL,
  PRIMARY KEY (post_id, viewer_key, view_date)
);
CREATE INDEX IF NOT EXISTS idx_community_post_views_date ON public.community_post_views(view_date);
ALTER TABLE public.community_post_views ENABLE ROW LEVEL SECURITY;   -- 정책 없음 = RPC 전용

CREATE OR REPLACE FUNCTION public.community_view(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := public._community_actor_key();
BEGIN
  IF v_key = 'ip:unknown' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM community_posts WHERE id = p_post_id AND NOT is_deleted) THEN RETURN; END IF;
  INSERT INTO community_post_views (post_id, viewer_key, view_date)
  VALUES (p_post_id, v_key, (now() AT TIME ZONE 'Asia/Seoul')::date)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    UPDATE community_posts SET view_count = view_count + 1 WHERE id = p_post_id;
  END IF;
  -- 오래된 조회 기록 정리 (가끔만: 하루 단위 판정이라 3일 지난 건 불필요)
  IF random() < 0.01 THEN
    DELETE FROM community_post_views WHERE view_date < (now() AT TIME ZONE 'Asia/Seoul')::date - 2;
  END IF;
END $$;

-- ── 인기글(메인 박스): 최근 7일 좋아요순(동률=댓글수→최신), 부족하면 최신글로 채움 ──
CREATE OR REPLACE FUNCTION public.community_hot_posts(p_limit int DEFAULT 5)
RETURNS SETOF public.community_posts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH hot AS (
    SELECT p.*, 1 AS grp FROM community_posts p
     WHERE NOT p.is_deleted AND p.created_at > now() - interval '7 days'
     ORDER BY p.like_count DESC, p.comment_count DESC, p.created_at DESC
     LIMIT least(greatest(p_limit, 1), 20)
  ), fill AS (
    SELECT p.*, 2 AS grp FROM community_posts p
     WHERE NOT p.is_deleted AND p.id NOT IN (SELECT id FROM hot)
     ORDER BY p.created_at DESC
     LIMIT greatest(least(greatest(p_limit, 1), 20) - (SELECT count(*) FROM hot), 0)
  )
  SELECT id, user_id, guest_name, title, body, image_urls, like_count, dislike_count,
         comment_count, view_count, is_deleted, created_at, category
    FROM (SELECT * FROM hot UNION ALL SELECT * FROM fill) t
   ORDER BY grp, like_count DESC, comment_count DESC, created_at DESC;
$$;

-- ============================================================
-- 신고 (비회원도 가능, 같은 사람 같은 대상 1회) → /admin "📝 커뮤니티" 탭
-- 서로 다른 신고자 5명 이상이면 자동 숨김(관리자가 복구 가능)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type   text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id     uuid NOT NULL,
  post_id       uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reason        text NOT NULL CHECK (reason IN ('spam', 'offensive', 'sexual', 'violence', 'privacy', 'other')),
  detail        text CHECK (char_length(detail) <= 300),
  reporter_key  text NOT NULL,
  reporter_id   uuid,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, reporter_key)
);
CREATE INDEX IF NOT EXISTS idx_community_reports_status ON public.community_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_reports_post ON public.community_reports(post_id);
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reports_admin_select" ON public.community_reports;
CREATE POLICY "community_reports_admin_select" ON public.community_reports FOR SELECT USING ((select public.is_admin()));
DROP POLICY IF EXISTS "community_reports_admin_update" ON public.community_reports;
CREATE POLICY "community_reports_admin_update" ON public.community_reports FOR UPDATE USING ((select public.is_admin()));

-- 관리자: 숨김 복구 등 직접 수정
DROP POLICY IF EXISTS "community_posts_admin_update" ON public.community_posts;
CREATE POLICY "community_posts_admin_update" ON public.community_posts FOR UPDATE USING ((select public.is_admin()));
DROP POLICY IF EXISTS "community_comments_admin_update" ON public.community_comments;
CREATE POLICY "community_comments_admin_update" ON public.community_comments FOR UPDATE USING ((select public.is_admin()));

CREATE OR REPLACE FUNCTION public.community_report(
  p_target_type text, p_target_id uuid, p_reason text, p_detail text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := public._community_actor_key();
  v_post_id uuid;
  v_cnt int;
BEGIN
  PERFORM public._community_assert_not_banned(v_key);
  IF v_key = 'ip:unknown' THEN RAISE EXCEPTION 'login_required'; END IF;
  IF p_target_type = 'post' THEN
    SELECT id INTO v_post_id FROM community_posts WHERE id = p_target_id AND NOT is_deleted;
  ELSIF p_target_type = 'comment' THEN
    SELECT post_id INTO v_post_id FROM community_comments WHERE id = p_target_id AND NOT is_deleted;
  END IF;
  IF v_post_id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  INSERT INTO community_reports (target_type, target_id, post_id, reason, detail, reporter_key, reporter_id)
  VALUES (p_target_type, p_target_id, v_post_id, p_reason, nullif(trim(coalesce(p_detail, '')), ''), v_key, auth.uid())
  ON CONFLICT (target_type, target_id, reporter_key) DO NOTHING;
  IF NOT FOUND THEN RETURN 'already'; END IF;

  SELECT count(*) INTO v_cnt FROM community_reports
   WHERE target_type = p_target_type AND target_id = p_target_id AND status = 'pending';
  IF v_cnt >= 5 THEN
    IF p_target_type = 'post' THEN
      UPDATE community_posts SET is_deleted = true WHERE id = p_target_id;
    ELSE
      UPDATE community_comments SET is_deleted = true WHERE id = p_target_id AND NOT is_deleted;
      IF FOUND THEN
        UPDATE community_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = v_post_id;
      END IF;
    END IF;
  END IF;
  RETURN 'ok';
END $$;

-- 관리자: 숨김 복구 (내용이 남아 있는 자동숨김/삭제글만 의미 있음)
CREATE OR REPLACE FUNCTION public.community_admin_restore(p_target_type text, p_target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_target_type = 'post' THEN
    UPDATE community_posts SET is_deleted = false WHERE id = p_target_id;
  ELSE
    UPDATE community_comments SET is_deleted = false
     WHERE id = p_target_id AND is_deleted AND body <> ''
    RETURNING post_id INTO v_post_id;
    IF v_post_id IS NOT NULL THEN
      UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = v_post_id;
    END IF;
  END IF;
  UPDATE community_reports SET status = 'dismissed'
   WHERE target_type = p_target_type AND target_id = p_target_id AND status = 'pending';
END $$;

-- ============================================================
-- 내 알림 (로그인 유저만): 내 글에 달린 댓글 + 내 댓글에 달린 대댓글, 최신 30개
-- ============================================================
CREATE OR REPLACE FUNCTION public.community_my_notifications(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (id uuid, kind text, post_id uuid, post_title text, user_id uuid, guest_name text, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         CASE WHEN c.parent_id IS NOT NULL AND pc.user_id = auth.uid() THEN 'reply' ELSE 'comment' END,
         c.post_id, p.title, c.user_id, c.guest_name, c.body, c.created_at
    FROM community_comments c
    JOIN community_posts p ON p.id = c.post_id
    LEFT JOIN community_comments pc ON pc.id = c.parent_id
   WHERE auth.uid() IS NOT NULL
     AND NOT c.is_deleted AND NOT p.is_deleted
     AND c.user_id IS DISTINCT FROM auth.uid()
     AND (p.user_id = auth.uid() OR pc.user_id = auth.uid())
     AND (p_since IS NULL OR c.created_at > p_since)
   ORDER BY c.created_at DESC
   LIMIT 30;
$$;

-- ============================================================
-- 관리자 차단/해제 (/admin 커뮤니티 탭). p_purge=true면 그 사람 글·댓글 전부 숨김
-- ============================================================
DROP POLICY IF EXISTS "community_bans_admin_select" ON public.community_bans;
CREATE POLICY "community_bans_admin_select" ON public.community_bans FOR SELECT USING ((select public.is_admin()));

CREATE OR REPLACE FUNCTION public.community_admin_ban(p_target_type text, p_target_id uuid, p_reason text DEFAULT NULL, p_purge boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_sample text;
  v_posts int := 0;
  v_comments int := 0;
  r record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT actor_key INTO v_key FROM community_secrets WHERE target_type = p_target_type AND target_id = p_target_id;
  IF v_key IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_key = 'ip:unknown' THEN RAISE EXCEPTION 'unknown_actor'; END IF;
  IF v_key = 'u:' || auth.uid()::text THEN RAISE EXCEPTION 'cannot_ban_self'; END IF;

  IF p_target_type = 'post' THEN
    SELECT coalesce(guest_name, '회원') || ': ' || left(title, 40) INTO v_sample FROM community_posts WHERE id = p_target_id;
  ELSE
    SELECT coalesce(guest_name, '회원') || ': ' || left(body, 40) INTO v_sample FROM community_comments WHERE id = p_target_id;
  END IF;

  INSERT INTO community_bans (actor_key, reason, sample, created_by)
  VALUES (v_key, nullif(trim(coalesce(p_reason, '')), ''), v_sample, auth.uid())
  ON CONFLICT (actor_key) DO UPDATE SET reason = coalesce(EXCLUDED.reason, community_bans.reason);

  IF p_purge THEN
    UPDATE community_posts SET is_deleted = true
     WHERE NOT is_deleted AND id IN (SELECT target_id FROM community_secrets WHERE actor_key = v_key AND target_type = 'post');
    GET DIAGNOSTICS v_posts = ROW_COUNT;
    FOR r IN
      UPDATE community_comments SET is_deleted = true, body = ''
       WHERE NOT is_deleted AND id IN (SELECT target_id FROM community_secrets WHERE actor_key = v_key AND target_type = 'comment')
      RETURNING post_id
    LOOP
      UPDATE community_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = r.post_id;
      v_comments := v_comments + 1;
    END LOOP;
    UPDATE community_reports SET status = 'resolved'
     WHERE status = 'pending' AND target_id IN (SELECT target_id FROM community_secrets WHERE actor_key = v_key);
  END IF;
  RETURN json_build_object('actor', left(v_key, 9), 'posts', v_posts, 'comments', v_comments);
END $$;

CREATE OR REPLACE FUNCTION public.community_admin_unban(p_actor_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM community_bans WHERE actor_key = p_actor_key;
END $$;

-- 진단용: 요청자 식별이 IP로 되는지 확인 (해시 앞 6자만, 'ip:unknown'이면 비회원 투표·신고 불가 상태)
CREATE OR REPLACE FUNCTION public.community_whoami()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT left(public._community_actor_key(), 9);
$$;

-- ── 실행 권한 ──
GRANT EXECUTE ON FUNCTION public.community_whoami()                                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_report(text, uuid, text, text)               TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_my_notifications(timestamptz)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_admin_restore(text, uuid)                   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_my_notifications(timestamptz)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_admin_restore(text, uuid)                    TO authenticated;
REVOKE ALL ON FUNCTION public._community_actor_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._community_assert_not_banned(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_admin_ban(text, uuid, text, boolean)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_admin_unban(text)                           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_admin_ban(text, uuid, text, boolean)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_admin_unban(text)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_create_post(text, text, text[], text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_delete_post(uuid, text)                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_add_comment(uuid, text, uuid, text, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_delete_comment(uuid, text)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_vote(uuid, text)                             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_my_vote(uuid)                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_view(uuid)                                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_hot_posts(int)                               TO anon, authenticated;

-- 확인
SELECT 'community ready' AS status,
       (SELECT count(*) FROM pg_policies WHERE tablename LIKE 'community_%') AS policies;  -- 기대값 7
