-- ============================================================
-- 스트리머 채팅연동 사용 로그 (운영자 전용)
-- 솔로 시청자 채팅투표(치지직/SOOP)를 켠 스트리머를 admin에서 확인
--   · 치지직: channel_id = channelId, nickname = 채널명
--   · SOOP  : channel_id = bjId,      nickname = BJNICK(있으면)
-- 채팅연동은 채널 연결 없이는 작동 불가 → 사용 시 스트리머 신원이 100% 기록됨
-- 비로그인 개방 후에도 host_user_id 만 null 이고 채널 식별자는 그대로 남음
-- ============================================================

CREATE TABLE IF NOT EXISTS streamer_chat_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text NOT NULL,                 -- 'chzzk' | 'soop'
  channel_id    text,                          -- chzzk channelId | soop bjId
  nickname      text,                          -- chzzk 채널명 | soop BJNICK
  content_id    text,                          -- contents.id (uuid 문자열) 또는 null
  content_title text,
  content_mode  text,                          -- worldcup | quiz | balance | tier
  room_code     text,
  host_user_id  uuid,                          -- DUO 로그인 유저 (게스트면 null)
  host_nick     text,                          -- 호스트 표시 닉
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streamer_chat_log_created
  ON streamer_chat_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streamer_chat_log_platform
  ON streamer_chat_log (platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streamer_chat_log_channel
  ON streamer_chat_log (platform, channel_id);

-- RLS: 백엔드(service_role)만 접근. 공개 정책 없음 → service_role 이 우회.
ALTER TABLE streamer_chat_log ENABLE ROW LEVEL SECURITY;
