// =========================
// DUO GAME ZONE — 보드파티 랜덤 이벤트 v20260515_1 Phase 2
// 25종 = common 15 + rare 10
// =========================
//
// ctx 함수 (boardparty.js에서 주입):
//   alivePlayers()        → [{ userId, name, team, pos, coins }, ...]
//   shuffle(arr)          → in-place
//   damageCoin(uid, n, src)  → 코인 -n (0 미만 안 됨)
//   gainCoin(uid, n, src)    → 코인 +n
//   movePlayer(uid, delta)   → 위치 +delta (음수도 OK, 0~39 wrap)
//   teleportPlayer(uid, pos) → 특정 칸으로
//   applyStatus(uid, st)     → { jailed: 1 } 등
//   swapPositions(uidA, uidB)
//   shuffleTeams()           → 팀전 모드일 때만 동작 (개인전은 noop)
//   isTeamMode()             → boolean
//
// apply 함수는 { affected: [uids], msg: "...", emoji, title } 반환

export const EVENTS = [
  // ===== COMMON (15) =====
  {
    id: "ev_coin_rain", rarity: "common", emoji: "💰", title: "코인 비",
    desc: "전원 +2 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.gainCoin(p.userId, 2, "코인 비"));
      return { affected: alive.map(p => p.userId), msg: "💰 모두 +2 코인!" };
    },
  },
  {
    id: "ev_tax", rarity: "common", emoji: "💸", title: "세금 징수",
    desc: "전원 -2 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damageCoin(p.userId, 2, "세금"));
      return { affected: alive.map(p => p.userId), msg: "💸 전원 -2 코인" };
    },
  },
  {
    id: "ev_swap", rarity: "common", emoji: "🤝", title: "위치 교환",
    desc: "랜덤 2명 위치 바꿈",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length < 2) return { affected: [], msg: "교환할 사람이 부족" };
      ctx.shuffle(alive);
      const [a, b] = alive;
      ctx.swapPositions(a.userId, b.userId);
      return { affected: [a.userId, b.userId], msg: `🤝 ${a.name} ↔ ${b.name} 위치 교환` };
    },
  },
  {
    id: "ev_forward3", rarity: "common", emoji: "🌪️", title: "회오리 전진",
    desc: "모두 3칸 전진",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.movePlayer(p.userId, 3));
      return { affected: alive.map(p => p.userId), msg: "🌪️ 전원 3칸 전진" };
    },
  },
  {
    id: "ev_last_buff", rarity: "common", emoji: "💀", title: "꼴등 버프",
    desc: "최저 코인 1명 +5 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => a.coins - b.coins);
      const last = alive[0];
      ctx.gainCoin(last.userId, 5, "꼴등 버프");
      return { affected: [last.userId], msg: `💀 ${last.name} 꼴등 버프! +5 코인` };
    },
  },
  {
    id: "ev_top_snipe", rarity: "common", emoji: "🎯", title: "1등 저격",
    desc: "최고 코인 1명 -5 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => b.coins - a.coins);
      const top = alive[0];
      ctx.damageCoin(top.userId, 5, "저격");
      return { affected: [top.userId], msg: `🎯 1위 ${top.name} 저격! -5 코인` };
    },
  },
  {
    id: "ev_bonus", rarity: "common", emoji: "🎁", title: "보너스",
    desc: "랜덤 1명 +5 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.gainCoin(t.userId, 5, "보너스");
      return { affected: [t.userId], msg: `🎁 ${t.name} 보너스 +5 코인` };
    },
  },
  {
    id: "ev_gem", rarity: "common", emoji: "💎", title: "보석 발견",
    desc: "랜덤 1명 +4 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.gainCoin(t.userId, 4, "보석");
      return { affected: [t.userId], msg: `💎 ${t.name} 보석 발견! +4 코인` };
    },
  },
  {
    id: "ev_back2", rarity: "common", emoji: "⏪", title: "후퇴 명령",
    desc: "전원 2칸 후진",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.movePlayer(p.userId, -2));
      return { affected: alive.map(p => p.userId), msg: "⏪ 전원 2칸 후진" };
    },
  },
  {
    id: "ev_redistribute", rarity: "common", emoji: "🪙", title: "부의 재분배",
    desc: "1등 → 꼴등에게 코인 절반 이동",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length < 2) return { affected: [], msg: "" };
      alive.sort((a, b) => b.coins - a.coins);
      const top = alive[0], last = alive[alive.length - 1];
      const transfer = Math.floor(top.coins / 2);
      if (transfer <= 0) return { affected: [], msg: "💸 부의 재분배 실패 (1등 잔액 부족)" };
      ctx.damageCoin(top.userId, transfer, "재분배");
      ctx.gainCoin(last.userId, transfer, "재분배");
      return { affected: [top.userId, last.userId], msg: `🪙 ${top.name} → ${last.name} ${transfer} 코인 이동` };
    },
  },
  {
    id: "ev_luck", rarity: "common", emoji: "🍀", title: "행운의 별",
    desc: "랜덤 1명 +7 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.gainCoin(t.userId, 7, "행운");
      return { affected: [t.userId], msg: `🍀 ${t.name} 행운의 별 +7 코인` };
    },
  },
  {
    id: "ev_dice", rarity: "common", emoji: "🎲", title: "운명의 주사위",
    desc: "랜덤 효과 1d4",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      const roll = 1 + Math.floor(Math.random() * 4);
      ctx.shuffle(alive);
      const t = alive[0];
      if (roll === 1) {
        ctx.gainCoin(t.userId, 4, "주사위");
        return { affected: [t.userId], msg: `🎲 1번: ${t.name} +4 코인` };
      }
      if (roll === 2) {
        ctx.damageCoin(t.userId, 3, "주사위");
        return { affected: [t.userId], msg: `🎲 2번: ${t.name} -3 코인` };
      }
      if (roll === 3) {
        ctx.movePlayer(t.userId, 4);
        return { affected: [t.userId], msg: `🎲 3번: ${t.name} 4칸 전진` };
      }
      alive.forEach(p => ctx.gainCoin(p.userId, 1, "주사위"));
      return { affected: alive.map(p => p.userId), msg: `🎲 4번: 전원 +1 코인` };
    },
  },
  {
    id: "ev_gold", rarity: "common", emoji: "🪙", title: "황금 보급",
    desc: "전원 +3 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.gainCoin(p.userId, 3, "황금"));
      return { affected: alive.map(p => p.userId), msg: "🪙 모두 +3 코인!" };
    },
  },
  {
    id: "ev_rain", rarity: "common", emoji: "☔", title: "산성비",
    desc: "전원 -1 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damageCoin(p.userId, 1, "산성비"));
      return { affected: alive.map(p => p.userId), msg: "☔ 전원 -1 코인" };
    },
  },
  {
    id: "ev_boost", rarity: "common", emoji: "🚀", title: "가속 부스터",
    desc: "랜덤 1명 5칸 전진",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.movePlayer(t.userId, 5);
      return { affected: [t.userId], msg: `🚀 ${t.name} 5칸 점프!` };
    },
  },

  // ===== RARE (10) =====
  {
    id: "ev_meteor", rarity: "rare", emoji: "☄️", title: "운석 낙하",
    desc: "랜덤 2명 -3 코인",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      ctx.shuffle(alive);
      const hits = alive.slice(0, 2);
      hits.forEach(p => ctx.damageCoin(p.userId, 3, "운석"));
      return { affected: hits.map(p => p.userId), msg: `☄️ ${hits.map(p => p.name).join(", ")} 피격!` };
    },
  },
  {
    id: "ev_shuffle_pos", rarity: "rare", emoji: "🤡", title: "자리 셔플",
    desc: "모두의 위치를 랜덤으로",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      const positions = alive.map(p => p.pos);
      ctx.shuffle(positions);
      alive.forEach((p, i) => ctx.teleportPlayer(p.userId, positions[i]));
      return { affected: alive.map(p => p.userId), msg: "🤡 전원 자리 셔플!" };
    },
  },
  {
    id: "ev_brawl", rarity: "rare", emoji: "⚔️", title: "난투",
    desc: "전원 -2 코인 + 위치 셔플",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.damageCoin(p.userId, 2, "난투"));
      const positions = alive.map(p => p.pos);
      ctx.shuffle(positions);
      alive.forEach((p, i) => ctx.teleportPlayer(p.userId, positions[i]));
      return { affected: alive.map(p => p.userId), msg: "⚔️ 난투 발생! 전원 -2 + 자리 셔플" };
    },
  },
  {
    id: "ev_ghost", rarity: "rare", emoji: "👻", title: "유령 출몰",
    desc: "랜덤 1명 5칸 후진",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.movePlayer(t.userId, -5);
      return { affected: [t.userId], msg: `👻 ${t.name} 5칸 끌려감!` };
    },
  },
  {
    id: "ev_lucky_roulette", rarity: "rare", emoji: "🎰", title: "럭키 룰렛",
    desc: "랜덤 1명 +10 또는 -10",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      const win = Math.random() < 0.5;
      if (win) {
        ctx.gainCoin(t.userId, 10, "룰렛");
        return { affected: [t.userId], msg: `🎰 ${t.name} 잭팟! +10 코인` };
      } else {
        ctx.damageCoin(t.userId, 10, "룰렛");
        return { affected: [t.userId], msg: `🎰 ${t.name} 꽝! -10 코인` };
      }
    },
  },
  {
    id: "ev_jail", rarity: "rare", emoji: "⛓️", title: "감옥",
    desc: "랜덤 1명 다음 턴 스킵",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      ctx.shuffle(alive);
      const t = alive[0];
      ctx.applyStatus(t.userId, { jailed: 1 });
      return { affected: [t.userId], msg: `⛓️ ${t.name} 감옥! 다음 턴 스킵` };
    },
  },
  {
    id: "ev_rewind", rarity: "rare", emoji: "⏰", title: "시간 역행",
    desc: "모두 시작 칸으로",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      alive.forEach(p => ctx.teleportPlayer(p.userId, 0));
      return { affected: alive.map(p => p.userId), msg: "⏰ 시간 역행! 모두 시작칸으로" };
    },
  },
  {
    id: "ev_last_steal", rarity: "rare", emoji: "💀", title: "꼴등의 역습",
    desc: "꼴등이 1등 코인 절반 강탈",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length < 2) return { affected: [], msg: "" };
      alive.sort((a, b) => b.coins - a.coins);
      const top = alive[0], last = alive[alive.length - 1];
      const steal = Math.floor(top.coins / 2);
      if (steal <= 0) return { affected: [], msg: "💀 꼴등 역습 실패 (1등 잔액)" };
      ctx.damageCoin(top.userId, steal, "강탈");
      ctx.gainCoin(last.userId, steal, "강탈");
      return { affected: [top.userId, last.userId], msg: `💀 ${last.name} 강탈! ${top.name}의 ${steal} 코인 탈취` };
    },
  },
  {
    id: "ev_revive", rarity: "rare", emoji: "🔮", title: "부활의 빛",
    desc: "최저 코인 +10",
    apply: (ctx) => {
      const alive = ctx.alivePlayers();
      if (alive.length === 0) return { affected: [], msg: "" };
      alive.sort((a, b) => a.coins - b.coins);
      const t = alive[0];
      ctx.gainCoin(t.userId, 10, "부활");
      return { affected: [t.userId], msg: `🔮 ${t.name} 부활! +10 코인` };
    },
  },
  {
    id: "ev_team_shuffle", rarity: "rare", emoji: "🤹", title: "팀 셔플",
    desc: "팀 랜덤 재배정 (팀전 한정)",
    apply: (ctx) => {
      if (!ctx.isTeamMode()) {
        return { affected: [], msg: "🤹 팀전 모드가 아니라 발동 X — 다시!" };
      }
      ctx.shuffleTeams();
      const alive = ctx.alivePlayers();
      return { affected: alive.map(p => p.userId), msg: "🤹 팀 셔플! 동맹이 적으로..." };
    },
  },
];

// 희귀도별 분류
const BY_RARITY = {
  common: EVENTS.filter(e => e.rarity === "common"),
  rare:   EVENTS.filter(e => e.rarity === "rare"),
};

// eventIntensity별 가중치
const INTENSITY_WEIGHTS = {
  mild:   { common: 90, rare: 10 },
  normal: { common: 70, rare: 30 },
  chaos:  { common: 50, rare: 50 },
};

export function pickRandomEvent(intensity = "normal") {
  const w = INTENSITY_WEIGHTS[intensity] || INTENSITY_WEIGHTS.normal;
  const total = w.common + w.rare;
  const r = Math.floor(Math.random() * total);
  const pool = r < w.common ? BY_RARITY.common : BY_RARITY.rare;
  if (pool.length === 0) return BY_RARITY.common[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getEvent(id) {
  return EVENTS.find(e => e.id === id) || null;
}

export function publicEventList() {
  return EVENTS.map(e => ({ id: e.id, emoji: e.emoji, title: e.title, desc: e.desc, rarity: e.rarity }));
}
