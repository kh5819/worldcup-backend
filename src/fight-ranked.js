// =========================
// 플듀 파이터 — 랭크전 결과 저장 (7단계 초안 · 아직 어디에도 연결 안 함)
// 연결 방법(승인 뒤): fight-multi.js finalize() 끝에서
//   if (room.ranked) recordRanked(supabaseAdmin, rec, room.players).catch(() => {});
// 원칙
//  · 서버가 경기 기록을 재현해 확인한 결과(verified)만 저장. 기권(left/disconnect)은 서버 판정이라 허용
//  · 로그인 회원끼리만(게스트 불가) · 같은 경기는 match_key 로 한 번만 저장(재시도 안전)
//  · DB 쓰기는 service_role 로 RPC fighter_record_match 하나만 호출 — 점수 계산·잠금은 DB 안에서 한 트랜잭션
// =========================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAR_IDS = ["hanbit", "yuna", "gangcheol", "rei"];
const REASONS = ["ko", "time", "disconnect", "left"];

/** 저장해도 되는 결과인지 — 안 되면 이유 문자열 */
export function rankedReject(rec, players) {
  if (!rec || (rec.winner !== 0 && rec.winner !== 1)) return "NO_WINNER";   // 무승부·판정 불가는 랭크 반영 안 함
  if (!REASONS.includes(rec.reason)) return "BAD_REASON";
  if (!rec.verified && (rec.reason === "ko" || rec.reason === "time")) return "UNVERIFIED";
  if (!Array.isArray(rec.players) || rec.players.length !== 2 || rec.players[0] === rec.players[1]) return "BAD_PLAYERS";
  if (!rec.players.every((id) => UUID.test(String(id)))) return "GUEST";
  if ((players || []).some((p) => p.isGuest)) return "GUEST";
  if (!rec.chars.every((c) => CHAR_IDS.includes(c))) return "BAD_CHAR";
  return null;
}

/** 확정 결과 1건을 DB에 저장. 실패해도 게임 진행엔 영향 없음(호출 쪽에서 catch) */
export async function recordRanked(db, rec, players, { tries = 3 } = {}) {
  const why = rankedReject(rec, players);
  if (why) return { ok: false, skipped: why };
  const args = {
    p_match_key: `${rec.room}:${rec.game}`, p_winner_side: rec.winner, p_reason: rec.reason, p_frames: rec.frames ?? null,
    p_wins: rec.wins && rec.wins.length === 2 ? rec.wins : rec.winner === 0 ? [1, 0] : [0, 1],
    p_user0: rec.players[0], p_char0: rec.chars[0], p_user1: rec.players[1], p_char1: rec.chars[1],
    p_verified: !!rec.verified, p_replay_hash: null,
  };
  let last = null;
  for (let i = 0; i < tries; i++) {
    const { data, error } = await db.rpc("fighter_record_match", args);
    if (!error) return { ok: true, ...data };
    last = error;
    if (/UNVERIFIED|BAD_|NO_ACTIVE_SEASON|violates/.test(error.message || "")) break;   // 다시 해도 같은 결과
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  console.warn("[fight-ranked] 저장 실패", args.p_match_key, last?.message);
  return { ok: false, error: last?.message || "UNKNOWN" };
}
