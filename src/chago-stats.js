// =========================
// 차고차고 — 경기 통계 · 평점 · MVP (서버 전용, 순수 함수)
// 엔진·규칙이 내보내는 이벤트를 선수(eid)별로 누적한다. 승부차기 이벤트는 집계하지 않는다.
// =========================

export function newStats() {
  return { goals: 0, assists: 0, shots: 0, onTarget: 0, perfect: 0, passes: 0, passOk: 0, maxCombo: 0, tackles: 0, tackleHits: 0, saves: 0, superSaves: 0, own: 0, whiffs: 0 };
}

const ensure = (stats, id) => (stats[id] || (stats[id] = newStats()));

export function applyEvents(stats, evs) {
  for (const e of evs) {
    switch (e.type) {
      case "kick": {
        const s = ensure(stats, e.id);
        if (e.kind === "shot") { s.shots++; if (e.onTarget) s.onTarget++; if (e.perfect) s.perfect++; }
        else s.passes++;
        break;
      }
      case "combo": {
        ensure(stats, e.from).passOk++;
        const r = ensure(stats, e.id); r.maxCombo = Math.max(r.maxCombo, e.n);
        break;
      }
      case "tackle": ensure(stats, e.id).tackles++; break;
      case "tackleHit": ensure(stats, e.id).tackleHits++; break;
      case "whiff": ensure(stats, e.id).whiffs++; break;
      case "save": { const s = ensure(stats, e.id); s.saves++; if (e.super) s.superSaves++; break; }
      case "goal":
        if (e.own) { if (e.by != null) ensure(stats, e.by).own++; }
        else if (e.scorer != null) { ensure(stats, e.scorer).goals++; if (e.assist != null) ensure(stats, e.assist).assists++; }
        break;
    }
  }
}

// 평점 = 득점·도움·선방 중심 (공격/수비 역할 모두 보상)
export function rating(s) {
  return Math.round((s.goals * 10 + s.assists * 6 + s.saves * 4 + s.superSaves * 3 + s.onTarget * 1.5 + s.perfect * 1.5 + s.passOk * 0.6
    + (s.maxCombo >= 3 ? 2 : 0) + s.tackleHits * 1.2 - s.own * 8) * 10) / 10;
}

// players: [{eid, team}]. 이긴 팀 선수에게 +3 보너스(무승부면 없음). 동점이면 득점 > 도움 > 선방 순.
export function pickMvp(stats, players, winner) {
  let best = null, bestScore = -Infinity;
  for (const p of players) {
    const s = stats[p.eid] || newStats();
    const base = rating(s);
    if (base <= 0) continue;                                    // 기여가 없으면(득점·선방 등 0) MVP 후보가 될 수 없다
    const score = base + (winner != null && p.team === winner ? 3 : 0) + s.goals * 0.01 + s.assists * 0.001;
    if (score > bestScore) { bestScore = score; best = p.eid; }
  }
  return best;
}
