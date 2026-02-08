-- ============================================================
-- fix_profiles_for_oauth.sql
-- 목적: Kakao OAuth 로그인 시 profiles upsert 400 에러 완전 제거
--
-- profiles 스키마 (확정):
--   id          uuid  PK  (= auth.users.id)
--   nickname    text
--   role        text
--   created_at  timestamptz
--   updated_at  timestamptz
--
-- ⚠ user_id 컬럼은 존재하지 않음!
--    프론트에서 onConflict:'id' + payload { id: user.id } 사용
--
-- 실행: Supabase Dashboard > SQL Editor 에서 순서대로 실행
-- ============================================================


-- ── STEP 1: 현재 스키마 확인 (읽기 전용, 안전) ──────────────
-- id가 PK인지, user_id 컬럼이 없는지 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- PK/UNIQUE 제약 조건 확인
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'profiles';


-- ── STEP 2: RLS 활성화 ─────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- ── STEP 3: RLS 정책 확인/보정 ──────────────────────────────
-- ⚠ 기존에 user_id = auth.uid() 로 된 정책이 있으면 삭제 후 재생성

-- SELECT: 전체 허용 (닉네임 조회용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_all'
  ) THEN
    CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
    RAISE NOTICE 'profiles_select_all 생성 완료';
  ELSE
    RAISE NOTICE 'profiles_select_all 이미 존재 — 스킵';
  END IF;
END $$;

-- INSERT: 본인만 (id = auth.uid())
-- 기존 user_id 기반 정책이 있을 수 있으므로 삭제 후 재생성
DO $$
BEGIN
  -- 기존 정책 삭제 시도 (없으면 무시)
  BEGIN
    DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());
  RAISE NOTICE 'profiles_insert_own 생성 완료 (id = auth.uid())';
END $$;

-- UPDATE: 본인만 (id = auth.uid())
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
    USING (id = auth.uid());
  RAISE NOTICE 'profiles_update_own 생성 완료 (id = auth.uid())';
END $$;


-- ── STEP 4: 검증 ───────────────────────────────────────────
-- 컬럼 목록 (user_id가 없어야 함)
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles';

-- RLS 정책 (id = auth.uid() 확인)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- PK 확인 (id가 PK)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema='public' AND table_name = 'profiles';
