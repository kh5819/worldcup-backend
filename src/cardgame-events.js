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
  {
    id: "ev_shuffle",
    emoji: "🤡",
    title: "카드 셔플",
    desc: "전원 손패 랜덤 재분배",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      ctx.shuffleHands(alive.map(p => p.userId));
      return { affected: alive.map(p => p.userId), msg: "🤡 모두의 손패가 뒤섞임!" };
    },
  },
  {
    id: "ev_robbery",
    emoji: "💸",
    title: "삥뜯기",
    desc: "랜덤 플레이어 카드 1장 손실",
    apply: (ctx) => {
      const alive = ctx.alivePlayers().filter(p => p.hand && p.hand.length > 0);
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const target = alive[0];
      ctx.discardRandomFromHand(target.userId, 1);
      return { affected: [target.userId], msg: `💸 ${target.name}의 카드 1장이 사라짐` };
    },
  },
  {
    id: "ev_berserk",
    emoji: "⚔️",
    title: "광전 모드",
    desc: "전원 다음 공격 +3 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.applyStatus(p.userId, { rage: 2 }));
      return { affected: alive.map(p => p.userId), msg: "⚔️ 모두에게 광기! 다음 공격 +3" };
    },
  },
  {
    id: "ev_topkill",
    emoji: "💀",
    title: "죽창",
    desc: "체력 최고 플레이어 5 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => b.hp - a.hp);
      const target = alive[0];
      ctx.damage(target.userId, 5, "죽창");
      return { affected: [target.userId], msg: `💀 1등 ${target.name}에게 죽창!` };
    },
  },
  {
    id: "ev_dice",
    emoji: "🎲",
    title: "운명의 주사위",
    desc: "랜덤 효과 발동",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      const roll = Math.floor(Math.random() * 6) + 1;
      const tgt = alive[Math.floor(Math.random() * alive.length)];
      if (roll <= 2) {
        ctx.damage(tgt.userId, 3, "주사위");
        return { affected: [tgt.userId], msg: `🎲 주사위 ${roll}: ${tgt.name} 3 데미지` };
      } else if (roll <= 4) {
        ctx.heal(tgt.userId, 4);
        return { affected: [tgt.userId], msg: `🎲 주사위 ${roll}: ${tgt.name} +4 HP` };
      } else if (roll === 5) {
        alive.forEach(p => ctx.drawCards(p.userId, 1));
        return { affected: alive.map(p => p.userId), msg: `🎲 주사위 5: 전원 카드 +1` };
      } else {
        ctx.applyStatus(tgt.userId, { stun: 1 });
        return { affected: [tgt.userId], msg: `🎲 주사위 6: ${tgt.name} 기절!` };
      }
    },
  },
  {
    id: "ev_suicide",
    emoji: "🧨",
    title: "자폭 버튼",
    desc: "전원 2 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damage(p.userId, 2, "자폭"));
      return { affected: alive.map(p => p.userId), msg: "🧨 누군가 자폭 버튼을 누름! 전원 2 데미지" };
    },
  },
  {
    id: "ev_cardrain",
    emoji: "🃏",
    title: "카드 비",
    desc: "전원 카드 +2",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.drawCards(p.userId, 2));
      return { affected: alive.map(p => p.userId), msg: "🃏 카드 비가 쏟아진다! 전원 카드 +2" };
    },
  },
  {
    id: "ev_swap",
    emoji: "🔄",
    title: "교환의 신",
    desc: "옆 사람과 손패 1장 교환",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length < 2) return { affected: [], msg: "" };
      const affected = [];
      // 짝수 페어만 처리 (홀수 인원 마지막 한 명은 스킵 — 자기 자신과 swap 방지)
      for (let i = 0; i + 1 < alive.length; i += 2) {
        const a = alive[i], b = alive[i + 1];
        ctx.swapRandomCard(a.userId, b.userId);
        affected.push(a.userId, b.userId);
      }
      return { affected, msg: "🔄 교환의 신이 손패를 섞는다!" };
    },
  },
  {
    id: "ev_mist",
    emoji: "☠️",
    title: "독안개",
    desc: "전원 즉시 -2 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damage(p.userId, 2, "독안개"));
      return { affected: alive.map(p => p.userId), msg: "☠️ 자욱한 독안개! 전원 -2" };
    },
  },
  {
    id: "ev_opportunity",
    emoji: "✨",
    title: "기회의 빛",
    desc: "전원 다음 턴 카드 사용 +1회",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.applyStatus(p.userId, { extraPlayNext: 1 }));
      return { affected: alive.map(p => p.userId), msg: "✨ 기회의 빛! 다음 턴 카드 +1회 사용" };
    },
  },
  {
    id: "ev_coinflip",
    emoji: "🪙",
    title: "운명의 동전",
    desc: "랜덤 1명: 50% 회복 / 50% 데미지",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      const tgt = alive[Math.floor(Math.random() * alive.length)];
      if (Math.random() < 0.5) {
        ctx.heal(tgt.userId, 6);
        return { affected: [tgt.userId], msg: `🪙 동전 앞면: ${tgt.name} +6 HP` };
      } else {
        ctx.damage(tgt.userId, 6, "운명");
        return { affected: [tgt.userId], msg: `🪙 동전 뒷면: ${tgt.name} -6 데미지` };
      }
    },
  },
  {
    id: "ev_silence_all",
    emoji: "🤐",
    title: "침묵의 시간",
    desc: "전원 1턴 특수 카드 봉인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.applyStatus(p.userId, { silence: 1 }));
      return { affected: alive.map(p => p.userId), msg: "🤐 침묵! 1턴 동안 특수 카드 X" };
    },
  },
  {
    id: "ev_treasure",
    emoji: "💎",
    title: "보물 상자",
    desc: "HP 최하 1명 +8 HP + 카드 +1",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => a.hp - b.hp);
      const target = alive[0];
      ctx.heal(target.userId, 8);
      ctx.drawCards(target.userId, 1);
      return { affected: [target.userId], msg: `💎 ${target.name}이(가) 보물 상자를 열었다! +8 HP, 카드 +1` };
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
