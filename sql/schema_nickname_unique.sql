-- ============================================================
-- schema_nickname_unique.sql
-- 목적: 닉네임 중복 방지 (normalize 기반 unique)
--
-- normalize 기준:
--   1) COALESCE(nickname, '') → NULL 안전
--   2) trim (앞뒤 공백 제거)
--   3) 연속 공백 → 단일 공백
--   4) lower (대소문자 무시)
--
-- 실행 순서:
--   STEP 0: 기존 중복 확인 (먼저 실행해서 결과 확인!)
--   STEP 1: nickname_normalized generated column 추가
--   STEP 2: 기존 중복 재확인 (generated column 기준)
--   STEP 3: unique index 생성 (STEP 2에서 중복 0건일 때만!)
--   STEP 4: 닉네임 사용 가능 여부 RPC
-- ============================================================


-- ── STEP 0: 기존 중복 닉네임 확인 ──────────────────────────────
-- ⚠ 먼저 이것만 실행해서 결과를 확인하세요!
-- 결과가 0건이면 바로 STEP 1~3 진행 가능
-- 결과가 있으면 중복 유저 정리 후 진행
SELECT
  lower(regexp_replace(trim(both from coalesce(nickname, '')), '\s+', ' ', 'g')) AS normalized,
  count(*) AS cnt,
  array_agg(id) AS user_ids,
  array_agg(nickname) AS nicknames
FROM profiles
WHERE nickname IS NOT NULL AND trim(nickname) != ''
GROUP BY normalized
HAVING count(*) > 1
ORDER BY cnt DESC;


-- ── STEP 1: nickname_normalized generated column 추가 ─────────
-- PostgreSQL 12+ GENERATED ALWAYS AS STORED
-- lower, trim, regexp_replace 모두 IMMUTABLE → generated column 사용 가능
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS nickname_normalized text
  GENERATED ALWAYS AS (
    lower(regexp_replace(trim(both from coalesce(nickname, '')), '\s+', ' ', 'g'))
  ) STORED;


-- ── STEP 2: generated column 기준 중복 재확인 ──────────────────
-- STEP 1 실행 후 이것으로 다시 확인
SELECT nickname_normalized, count(*) AS cnt,
       array_agg(id) AS user_ids, array_agg(nickname) AS nicknames
FROM profiles
WHERE nickname_normalized IS NOT NULL AND nickname_normalized != ''
GROUP BY nickname_normalized
HAVING count(*) > 1
ORDER BY cnt DESC;


-- ── STEP 3: UNIQUE INDEX 생성 ─────────────────────────────────
-- ⚠ STEP 2 결과가 0건일 때만 실행!
-- 빈 닉네임('')은 제외 (partial index) → NULL/빈 닉네임 유저는 중복 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nickname_normalized_unique
  ON profiles (nickname_normalized)
  WHERE nickname_normalized IS NOT NULL AND nickname_normalized != '';


-- ── STEP 4: 닉네임 사용 가능 여부 체크 RPC ────────────────────
-- 프론트/백엔드에서 호출: supabase.rpc('check_nickname_available', { p_nickname: '...', p_exclude_user_id: '...' })
-- 반환: { available: boolean }
CREATE OR REPLACE FUNCTION check_nickname_available(
  p_nickname text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized text;
  v_exists boolean;
BEGIN
  -- normalize: trim + collapse spaces + lower
  v_normalized := lower(regexp_replace(trim(both from coalesce(p_nickname, '')), '\s+', ' ', 'g'));

  IF v_normalized = '' THEN
    RETURN json_build_object('available', false, 'reason', 'EMPTY');
  END IF;

  IF p_exclude_user_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE nickname_normalized = v_normalized
        AND id != p_exclude_user_id
    ) INTO v_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE nickname_normalized = v_normalized
    ) INTO v_exists;
  END IF;

  IF v_exists THEN
    RETURN json_build_object('available', false, 'reason', 'DUPLICATE');
  END IF;

  RETURN json_build_object('available', true);
END;
$$;
