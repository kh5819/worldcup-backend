-- ============================================================
-- fix_profiles_for_oauth.sql
-- 목적: Kakao OAuth 로그인 시 profiles upsert 400 에러 완전 제거
-- 실행: Supabase Dashboard > SQL Editor 에서 순서대로 실행
-- ============================================================

-- ── STEP 1: 현재 상태 확인 (읽기 전용, 안전) ──────────────
-- 중복 user_id가 있는지 확인
SELECT user_id, COUNT(*) AS cnt
FROM profiles
GROUP BY user_id
HAVING COUNT(*) > 1;
-- → 결과가 0행이면 중복 없음 (STEP 2 스킵 가능)
-- → 결과가 있으면 반드시 STEP 2 실행


-- ── STEP 2: 중복 제거 (중복이 있을 때만 실행) ─────────────
-- created_at 기준 가장 최신 1개만 유지, 나머지 삭제
DELETE FROM profiles
WHERE ctid NOT IN (
  SELECT DISTINCT ON (user_id) ctid
  FROM profiles
  ORDER BY user_id, created_at DESC NULLS LAST
);
-- 실행 후 STEP 1을 다시 실행해서 0행 확인


-- ── STEP 3: user_id에 UNIQUE 보장 ─────────────────────────
-- profiles.user_id가 PRIMARY KEY면 이미 UNIQUE 포함.
-- 혹시 PK가 아닌 상태라면 UNIQUE 추가.
-- (이미 PK/UNIQUE면 "already exists" 에러 → 무시해도 OK)
DO $$
BEGIN
  -- PK 존재 여부 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      AND constraint_name LIKE '%user_id%'
  ) THEN
    -- UNIQUE constraint 추가
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
    RAISE NOTICE 'profiles_user_id_unique 추가 완료';
  ELSE
    RAISE NOTICE 'user_id에 이미 PK/UNIQUE 존재 — 스킵';
  END IF;
END $$;


-- ── STEP 4: RLS 정책 확인/보정 ────────────────────────────
-- 이미 존재하면 에러 → DO 블록으로 안전 처리
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: 전체 허용 (닉네임 조회용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_all'
  ) THEN
    CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
  END IF;
END $$;

-- INSERT: 본인만 (user_id = auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- UPDATE: 본인만
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;


-- ── STEP 5: 검증 ──────────────────────────────────────────
-- PK/UNIQUE 확인
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'profiles';

-- RLS 정책 확인
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 중복 재확인 (0행이어야 함)
SELECT user_id, COUNT(*) FROM profiles GROUP BY user_id HAVING COUNT(*) > 1;
