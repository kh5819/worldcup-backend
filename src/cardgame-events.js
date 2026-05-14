// =========================
// DUO GAME ZONE — 난장 카드게임 랜덤 이벤트 v20260515_1
// 일정 턴마다 발동되는 방송각 이벤트
// =========================

export const EVENTS = [
  {
    id: "ev_meteor",
    emoji: "☄️",
    title: "운석 낙하",
    desc: "랜덤 2명에게 4 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      ctx.shuffle(alive);
      const hits = alive.slice(0, 2);
      hits.forEach(p => ctx.damage(p.userId, 4, "운석 낙하"));
      return { affected: hits.map(p => p.userId), msg: `☄️ 운석이 ${hits.map(p => p.name).join(", ")}을(를) 강타!` };
    },
  },
  {
    id: "ev_santa",
    emoji: "🎁",
    title: "산타 등장",
    desc: "전원 카드 +1",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.drawCards(p.userId, 1));
      return { affected: alive.map(p => p.userId), msg: "🎁 산타가 전원에게 카드 1장씩!" };
    },
  },
  {
    id: "ev_plague",
    emoji: "🧟",
    title: "감염 확산",
    desc: "랜덤 플레이어 1명에게 독(3턴)",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "감염될 대상이 없다" };
      ctx.shuffle(alive);
      const target = alive[0];
      ctx.applyStatus(target.userId, { poison: 3 });
      return { affected: [target.userId], msg: `🧟 ${target.name}이(가) 감염! 독 3턴` };
    },
  },
  {
    id: "ev_rage",
    emoji: "⚔️",
    title: "난투 발생",
    desc: "이번 라운드 모두에게 1 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damage(p.userId, 1, "난투"));
      return { affected: alive.map(p => p.userId), msg: "⚔️ 난투! 전원 1 데미지" };
    },
  },
  {
    id: "ev_blessing",
    emoji: "🌟",
    title: "치유의 빛",
    desc: "체력 최하 1명 +5 HP",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => a.hp - b.hp);
      const target = alive[0];
      ctx.heal(target.userId, 5);
      return { affected: [target.userId], msg: `🌟 ${target.name}이(가) 치유의 빛으로 +5 HP` };
    },
  },
];

const EV_MAP = new Map(EVENTS.map(e => [e.id, e]));
export function getEvent(id) { return EV_MAP.get(id); }
export function pickRandomEvent(rng) {
  const i = Math.floor((rng ?? Math.random()) * EVENTS.length);
  return EVENTS[Math.max(0, Math.min(EVENTS.length - 1, i))];
}

export function publicEventList() {
  return EVENTS.map(e => ({ id: e.id, emoji: e.emoji, title: e.title, desc: e.desc }));
}
