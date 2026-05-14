// =========================
// DUO GAME ZONE — 보드파티 미니게임 v20260515_1 Phase 6
// 4종 — 전원 참여
//   reaction  — 반응속도 (빨강→초록, 첫 클릭)
//   guess     — 1~100 숫자 맞추기 (가장 가까운)
//   click     — 3초간 빠른 클릭 (최다 카운트)
//   nunchi    — 눈치게임 (1~N 안 겹치게)
// =========================

export const MINIGAMES = {
  reaction: {
    id: "reaction",
    name: "반응속도",
    emoji: "⚡",
    desc: "빨강이 초록으로 바뀌면 빨리 탭!",
    duration: 6000,           // 최대 게임 시간
    rewardTiers: [10, 5, 2],  // 1등/2등/3등
  },
  guess: {
    id: "guess",
    name: "숫자 맞추기",
    emoji: "🔢",
    desc: "1~100 비밀 숫자에 가장 가까운 사람!",
    duration: 8000,
    rewardTiers: [8, 5, 2],
  },
  click: {
    id: "click",
    name: "빠른 클릭",
    emoji: "👆",
    desc: "3초간 가장 많이 탭한 사람!",
    duration: 4000,           // 3초 클릭 + 카운트다운 0.5s + 결과 대기
    rewardTiers: [7, 4, 1],
  },
  nunchi: {
    id: "nunchi",
    name: "눈치게임",
    emoji: "👁️",
    desc: "1, 2, 3... 안 겹치게 외쳐라!",
    duration: 12000,
    rewardTiers: [10, 0, 0],  // 마지막 생존자만
  },
};

export function publicMinigameList() {
  return Object.values(MINIGAMES).map(m => ({ id: m.id, name: m.name, emoji: m.emoji, desc: m.desc }));
}

export function pickRandomMinigame() {
  const all = Object.values(MINIGAMES);
  return all[Math.floor(Math.random() * all.length)];
}

// ===== 결과 계산 (kind별) =====
// submissions: Map<uid, payload>
// players: [{ userId, name, ... }]
// 반환: [{ userId, rank, score, reward }] (rank: 1, 2, 3 ...)

export function computeReactionResult(submissions, players, startTs, goTs) {
  const results = [];
  for (const p of players) {
    const sub = submissions.get(p.userId);
    if (!sub) {
      results.push({ userId: p.userId, eliminated: true, reason: "미참여", score: Infinity });
    } else if (sub.foul) {
      results.push({ userId: p.userId, eliminated: true, reason: "성급함 (빨강에 클릭)", score: Infinity });
    } else {
      // sub.ts = 서버 수신 timestamp / sub.clientLatency 옵션
      const reactionMs = Math.max(0, sub.ts - (goTs || startTs));
      results.push({ userId: p.userId, score: reactionMs });
    }
  }
  // 점수 낮은 순 (빠른 순). eliminated는 끝으로.
  results.sort((a, b) => {
    if (a.eliminated && !b.eliminated) return 1;
    if (b.eliminated && !a.eliminated) return -1;
    return a.score - b.score;
  });
  return assignRanks(results, MINIGAMES.reaction.rewardTiers);
}

export function computeGuessResult(submissions, players, secret) {
  const results = [];
  for (const p of players) {
    const sub = submissions.get(p.userId);
    if (sub == null) {
      results.push({ userId: p.userId, eliminated: true, reason: "미참여", score: Infinity });
    } else {
      const v = Math.max(1, Math.min(100, Math.floor(sub.value || 0)));
      results.push({ userId: p.userId, score: Math.abs(v - secret), value: v });
    }
  }
  results.sort((a, b) => {
    if (a.eliminated && !b.eliminated) return 1;
    if (b.eliminated && !a.eliminated) return -1;
    return a.score - b.score;
  });
  return assignRanks(results, MINIGAMES.guess.rewardTiers);
}

export function computeClickResult(submissions, players) {
  const results = [];
  for (const p of players) {
    const sub = submissions.get(p.userId);
    const count = sub?.count || 0;
    results.push({ userId: p.userId, score: -count, count });
  }
  // 클릭 많을수록 우승 — score가 음수라 작은 순 = 큰 카운트
  results.sort((a, b) => a.score - b.score);
  return assignRanks(results, MINIGAMES.click.rewardTiers);
}

export function computeNunchiResult(eliminatedOrder, players) {
  // eliminatedOrder: 탈락 순서대로 uid 배열 (먼저 탈락 = 더 나쁜 순위)
  // 살아남은 사람들 = 우승 (보상 동일하게 +10)
  const elimSet = new Set(eliminatedOrder);
  const results = [];
  const survivors = [];
  for (const p of players) {
    if (elimSet.has(p.userId)) {
      const eIdx = eliminatedOrder.indexOf(p.userId);
      results.push({ userId: p.userId, eliminated: true, reason: "동시 외침", score: eIdx });
    } else {
      survivors.push(p.userId);
    }
  }
  // 생존자는 모두 1등 보상
  for (const uid of survivors) results.push({ userId: uid, score: -1, survivor: true });
  results.sort((a, b) => {
    if (a.survivor && !b.survivor) return -1;
    if (b.survivor && !a.survivor) return 1;
    if (a.eliminated && b.eliminated) return b.score - a.score; // 나중에 탈락한 사람이 더 좋음
    return 0;
  });
  // 생존자에게만 보상
  return results.map(r => ({
    userId: r.userId,
    rank: r.survivor ? 1 : null,
    reward: r.survivor ? MINIGAMES.nunchi.rewardTiers[0] : 0,
    eliminated: !!r.eliminated,
    reason: r.reason || null,
  }));
}

function assignRanks(sortedResults, rewardTiers) {
  // 동점 처리 없이 단순 1, 2, 3
  return sortedResults.map((r, i) => ({
    userId: r.userId,
    rank: r.eliminated ? null : (i + 1),
    reward: r.eliminated ? 0 : (rewardTiers[i] || 0),
    score: r.score,
    value: r.value,
    count: r.count,
    eliminated: !!r.eliminated,
    reason: r.reason || null,
  }));
}
