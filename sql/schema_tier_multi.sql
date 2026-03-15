-- ============================================================
-- Multi Tier v1: tier_multi_results
-- Idempotent: 재실행해도 에러 없음. 기존 테이블 ALTER 없음.
-- ============================================================

CREATE TABLE IF NOT EXISTS tier_multi_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES tier_templates(id),
  host_user_id  uuid NOT NULL REFERENCES auth.users(id),
  board         jsonb NOT NULL DEFAULT '{}'::jsonb,
  history       jsonb NOT NULL DEFAULT '[]'::jsonb,
  players       jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_count    int NOT NULL DEFAULT 0,
  player_count  int NOT NULL DEFAULT 0,
  duration_ms   int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- board JSON contract:
-- {
--   "tiers":    { [tierId]: [cardId, ...] },
--   "cardMap":  { [cardId]: { "id", "label", "image_url" } },
--   "tierMeta": [ { "id", "name" } ]
-- }
--
-- players JSON contract:
-- [
--   { "participantId": "uuid|guest_xxx", "nickname": "str",
--     "isHost": bool, "isGuest": bool,
--     "voteCount": int, "agreeCount": int }
-- ]

CREATE INDEX IF NOT EXISTS idx_tmr_template ON tier_multi_results(template_id);
CREATE INDEX IF NOT EXISTS idx_tmr_host     ON tier_multi_results(host_user_id);
CREATE INDEX IF NOT EXISTS idx_tmr_created  ON tier_multi_results(created_at DESC);

ALTER TABLE tier_multi_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tmr_select_all ON tier_multi_results;
CREATE POLICY tmr_select_all ON tier_multi_results
  FOR SELECT USING (true);

DROP POLICY IF EXISTS tmr_insert_service ON tier_multi_results;
CREATE POLICY tmr_insert_service ON tier_multi_results
  FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================
-- Rollback:
-- DROP POLICY IF EXISTS tmr_insert_service ON tier_multi_results;
-- DROP POLICY IF EXISTS tmr_select_all ON tier_multi_results;
-- DROP TABLE IF EXISTS tier_multi_results;
-- ============================================================
