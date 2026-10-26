// =========================
// 차고차고 — 랭킹(Elo) · 시즌 · 부정행위 의심 판정 (서버 전용, 순수 함수)
//   · 경쟁전(ranked)에서 "로그인한 사람 vs 로그인한 사람"이 양 팀에 있을 때만 레이팅이 바뀐다 (봇만 상대하는 파밍 방지)
//   · 시즌은 한 달(한국 시간 기준). 레이팅은 시즌마다 1000에서 새로 시작한다
//   · 중도 이탈(경기 끝까지 못 돌아온 사람)은 팀이 이겨도 패배로 처리 + 추가 감점
// =========================

export const RATING = Object.freeze({ start: 1000, kProvisional: 32, k: 20, provisionalGames: 10, mvpBonus: 2, abandonPenalty: 8, minRankedGames: 3 });

const KST_MS = 9 * 3600 * 1000;
export function seasonId(ms = Date.now()) {
  const d = new Date(ms + KST_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function seasonRange(id) {          // [시작 ms, 끝 ms) (한국 시간 달력 기준)
  const [y, m] = id.split("-").map(Number);
  return [Date.UTC(y, m - 1, 1) - KST_MS, Date.UTC(y, m, 1) - KST_MS];
}

export const expectedScore = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
const avg = (a, dflt) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : dflt);

// 부정행위 의심: 입력 폭주, 퍼펙트 슛이 비정상적으로 많음(매크로), 거의 모든 슛이 유효슈팅이면서 퍼펙트
export function assessSuspicion({ dropped = 0, shots = 0, perfect = 0, onTarget = 0, seconds = 0 }) {
  const flags = [];
  let score = 0;
  if (dropped >= 400) { flags.push("input_flood"); score += 3; } else if (dropped >= 150) { flags.push("input_burst"); score += 1; }
  if (shots >= 10) {
    const pr = perfect / shots;
    if (pr >= 0.9) { flags.push("perfect_macro"); score += 3; } else if (pr >= 0.7) { flags.push("perfect_high"); score += 1; }
    if (perfect >= 8 && onTarget / shots >= 0.98) { flags.push("aim_bot"); score += 2; }
  }
  return { flags, score, blocked: score >= 3 };      // blocked 면 레이팅 반영 제외 + 자동 신고 등록
}

// summary.players: [{ eid, team, uid, isGuest, bot, late, abandoned, blocked, mvp }]
export function rankedEligible(summary) {
  if (summary.mode !== "ranked") return false;
  if (!["time", "golden_goal", "shootout"].includes(summary.reason)) return false;
  if (summary.winner !== 0 && summary.winner !== 1) return false;
  const ok = (t) => summary.players.some((p) => p.team === t && !p.bot && !p.isGuest && p.uid && !p.late && !p.blocked);
  return ok(0) && ok(1);
}

// current: { [uid]: { rating, ranked_games } }  → [{ uid, eid, before, delta, after, won }]
export function computeRatingChanges(summary, current) {
  const eligible = rankedEligible(summary);
  if (!eligible) return [];
  const humans = summary.players.filter((p) => !p.bot && !p.isGuest && p.uid && !p.late && !p.blocked);
  const ratingOf = (p) => (current[p.uid] ? current[p.uid].rating : RATING.start);
  const out = [];
  for (const p of humans) {
    const opp = humans.filter((q) => q.team !== p.team);
    const before = ratingOf(p), games = current[p.uid] ? current[p.uid].ranked_games || 0 : 0;
    const oppAvg = avg(opp.map(ratingOf), RATING.start);
    const won = p.team === summary.winner && !p.abandoned;
    const k = games < RATING.provisionalGames ? RATING.kProvisional : RATING.k;
    let delta = k * ((won ? 1 : 0) - expectedScore(before, oppAvg));
    if (won && p.mvp) delta += RATING.mvpBonus;
    if (p.abandoned) delta -= RATING.abandonPenalty;
    delta = Math.round(delta);
    if (won && delta < 1) delta = 1;                     // 이기면 최소 +1
    const after = Math.max(0, before + delta);
    out.push({ uid: p.uid, eid: p.eid, before, delta: after - before, after, won });
  }
  return out;
}

// 리더보드 정렬 키: 레이팅 → 승수 → 경기 수 적은 순
export function sortBoard(rows) {
  return [...rows].sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.ranked_games - b.ranked_games);
}
