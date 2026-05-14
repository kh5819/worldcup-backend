// =========================
// DUO GAME ZONE — 보드파티 보드 정의 (40칸 정사각형 외곽) v20260515_1
// =========================

export const BOARD_GRID_N = 11;                      // 11x11 grid
export const BOARD_SIDE = BOARD_GRID_N - 1;          // 10
export const BOARD_TOTAL = BOARD_SIDE * 4;           // 40칸

// 칸 종류:
//   start    — 시작 (효과 없음)
//   coin     — 코인 + (예: +3, +5)
//   minus    — 코인 - (예: -2, -3)
//   event    — 랜덤 이벤트 발동
//   item     — 아이템 카드 1장
//   penalty  — 벌칙 칸 (해당 플레이어가 게임 종료 시 꼴지면 벌칙 카운트+1)
//   safe     — 효과 없음 (휴식)
//   mini     — 미니게임 (Phase 6+)

export const TILES = [
  // top row (idx 0~9)
  { kind: "start",   emoji: "🏁", label: "시작",     payload: {} },
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "minus",   emoji: "💸", label: "-2",       payload: { coin: -2 } },
  { kind: "safe",    emoji: "💤", label: "휴식",     payload: {} },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "penalty", emoji: "🍺", label: "벌칙",     payload: {} },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  // right col (idx 10~19)
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "mini",    emoji: "🎮", label: "미니",     payload: {} },
  { kind: "coin",    emoji: "💰", label: "+5",       payload: { coin: 5 } },
  { kind: "minus",   emoji: "💸", label: "-3",       payload: { coin: -3 } },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "safe",    emoji: "💤", label: "휴식",     payload: {} },
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "penalty", emoji: "🍺", label: "벌칙",     payload: {} },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  // bottom row (idx 20~29)
  { kind: "mini",    emoji: "🎮", label: "미니",     payload: {} },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "minus",   emoji: "💸", label: "-2",       payload: { coin: -2 } },
  { kind: "safe",    emoji: "💤", label: "휴식",     payload: {} },
  { kind: "coin",    emoji: "💰", label: "+5",       payload: { coin: 5 } },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "penalty", emoji: "🍺", label: "벌칙",     payload: {} },
  // left col (idx 30~39)
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "minus",   emoji: "💸", label: "-3",       payload: { coin: -3 } },
  { kind: "mini",    emoji: "🎮", label: "미니",     payload: {} },
  { kind: "coin",    emoji: "💰", label: "+3",       payload: { coin: 3 } },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
  { kind: "item",    emoji: "🎴", label: "아이템",   payload: {} },
  { kind: "safe",    emoji: "💤", label: "휴식",     payload: {} },
  { kind: "event",   emoji: "❓", label: "이벤트",   payload: {} },
];

// 보드 정보를 클라이언트로 보낼 때 사용
export function publicBoard() {
  return {
    gridN: BOARD_GRID_N,
    total: BOARD_TOTAL,
    tiles: TILES.map((t, i) => ({ idx: i, kind: t.kind, emoji: t.emoji, label: t.label })),
  };
}

export function getTile(idx) {
  return TILES[((idx % BOARD_TOTAL) + BOARD_TOTAL) % BOARD_TOTAL];
}
