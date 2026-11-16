// =========================
// DUO TERRITORY — 증강 40종 (2026-11-16, 사용자 기획서 목록)
// kind: passive(지속형) · trigger(발동형: 조건이 맞으면 저절로) · active(사용형: 버튼, 재사용 대기 cd 초 / 횟수 charges)
// 같은 증강은 두 번 못 가짐(중첩 = 서로 다른 증강끼리만). 속도 배율은 모두 곱하고 최대 2.2배, 최소 0.5배
// 전설 사용형은 warn 초 동안 모두에게 경고 표시 뒤 발동 (상대가 피할 시간)
// tags: 시너지 표시용 계열 (speed·capture·defense·move·disrupt)
// =========================
export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
const A = (id, rarity, icon, name, kind, o, desc, cond, dur, tags) => ({ id, rarity, icon, name, kind, cd: o.cd || 0, charges: o.ch ?? null, warn: o.warn || 0, desc, cond, dur, tags });
export const AUGS = [
  // ---------- 일반 10 ----------
  A("swiftStep", "common", "👟", "빠른 발걸음", "passive", {}, "이동속도 +8%", "항상", "경기 내내", ["speed"]),
  A("expander", "common", "📐", "영토 확장가", "passive", {}, "점령 성공 시 얻는 점수 +10%", "점령할 때", "경기 내내", ["capture"]),
  A("safeReturn", "common", "🏠", "안전 귀환", "trigger", {}, "궤적을 그리다 내 영토로 돌아오면 1.5초 동안 이동속도 +30%", "내 영토로 돌아올 때", "1.5초", ["speed"]),
  A("tailSense", "common", "👀", "꼬리 감지", "passive", {}, "주변 12칸 안의 적 궤적이 밝게 강조돼요", "항상", "경기 내내", ["disrupt"]),
  A("explorer", "common", "🧭", "영역 탐험가", "passive", {}, "내 영토 밖에서 이동속도 +6%", "영토 밖에 있을 때", "경기 내내", ["speed"]),
  A("firstCapture", "common", "🥇", "첫 점령 보너스", "trigger", {}, "증강 고르기 사이(45초)마다 첫 점령에 +40점", "구간마다 첫 점령", "구간마다 1번", ["capture"]),
  A("shortSprint", "common", "💨", "짧은 질주", "active", { cd: 10 }, "1.2초 동안 이동속도 +40%", "언제든", "1.2초 · 재사용 10초", ["speed"]),
  A("guardian", "common", "🛡️", "영토 수호자", "passive", {}, "내 영토 안에서 이동속도 +12%", "내 영토 안", "경기 내내", ["speed", "defense"]),
  A("dangerSense", "common", "🔔", "위험 감지", "passive", {}, "적이 내 궤적 5칸 안으로 다가오면 경고", "궤적이 있을 때", "경기 내내", ["defense"]),
  A("combo", "common", "🔥", "연속 점령", "trigger", {}, "8초 안에 연속으로 점령하면 점수 +15%씩 (최대 +45%)", "8초 안 연속 점령", "연속이 끊길 때까지", ["capture"]),
  // ---------- 희귀 10 ----------
  A("shield", "rare", "🔰", "보호막", "trigger", { ch: 1 }, "적이 내 궤적을 끊으면 1번 막아요 (그 칸 궤적만 사라짐)", "궤적을 공격받을 때", "1회", ["defense"]),
  A("dash", "rare", "⚡", "순간 대시", "active", { cd: 8 }, "앞으로 4칸 순식간에 이동 (지나간 칸도 궤적·충돌 판정)", "앞이 막히지 않았을 때", "즉시 · 재사용 8초", ["move", "speed"]),
  A("trailCamo", "rare", "🌫️", "꼬리 위장", "active", { cd: 20 }, "5초 동안 내 궤적이 상대에게 희미하게 보여요", "언제든", "5초 · 재사용 20초", ["defense", "disrupt"]),
  A("raider", "rare", "🏴‍☠️", "영토 강탈", "passive", {}, "상대 영토를 점령한 칸은 점수 +60%", "상대 땅을 점령할 때", "경기 내내", ["capture", "disrupt"]),
  A("emergencyReturn", "rare", "🆘", "긴급 귀환", "active", { cd: 30 }, "가장 가까운 내 영토로 순간 복귀 (궤적은 사라지고 점령은 안 됨)", "궤적이 있을 때", "즉시 · 재사용 30초", ["defense", "move"]),
  A("decoyTrail", "rare", "🎭", "분신 궤적", "active", { cd: 18 }, "6초 동안 내 뒤로 가짜 궤적이 생겨요 (밟아도 아무 일 없음)", "언제든", "6초 · 재사용 18초", ["disrupt"]),
  A("recover", "rare", "♻️", "영토 회복", "active", { cd: 30 }, "최근 10초 안에 잃은 땅 중 지금 중립인 칸을 최대 40칸 되찾음", "잃은 땅이 중립일 때", "즉시 · 재사용 30초", ["capture", "defense"]),
  A("safeZone", "rare", "⛺", "안전 지대", "active", { cd: 25 }, "내 자리에 5×5 보호 구역 5초: 그 안의 내 궤적은 끊기지 않아요", "언제든", "5초 · 재사용 25초", ["defense"]),
  A("chaser", "rare", "🐺", "추격자", "passive", {}, "적 궤적 6칸 안에 있으면 이동속도 +15%", "적 궤적 근처", "경기 내내", ["speed", "disrupt"]),
  A("accel", "rare", "🚀", "영역 가속", "trigger", {}, "점령 직후 2초 동안 이동속도 +25%", "점령 직후", "2초", ["speed", "capture"]),
  // ---------- 영웅 10 ----------
  A("territoryBlast", "epic", "💥", "영토 폭발", "active", { cd: 30 }, "앞 4칸 지점 7×7 안의 상대 영토를 중립으로", "언제든", "즉시 · 재사용 30초", ["disrupt"]),
  A("dimensionShift", "epic", "🌀", "차원 이동", "active", { cd: 15 }, "앞으로 6칸 순간이동 (지나는 칸은 궤적이 되지만 충돌하지 않음)", "앞에 공간이 있을 때", "즉시 · 재사용 15초", ["move"]),
  A("doubleTrail", "epic", "〰️", "이중 궤적", "active", { cd: 30 }, "8초 동안 점령할 때 궤적 양옆 칸까지 함께 점령", "언제든", "8초 · 재사용 30초", ["capture"]),
  A("absoluteDefense", "epic", "🧱", "절대 방어", "active", { cd: 40 }, "4초 동안 내 궤적이 끊기지 않고 내 궤적을 밟아도 안전", "언제든", "4초 · 재사용 40초", ["defense"]),
  A("absorb", "epic", "🧲", "영토 흡수", "trigger", {}, "점령할 때 새 땅에 붙은 상대 영토 2칸 두께까지 최대 60칸 추가", "점령할 때", "경기 내내", ["capture", "disrupt"]),
  A("shadowClone", "epic", "👥", "그림자 분신", "active", { cd: 30 }, "6초 동안 혼자 움직이는 분신이 나와 상대를 헷갈리게 해요", "언제든", "6초 · 재사용 30초", ["disrupt"]),
  A("chainCapture", "epic", "⛓️", "연쇄 점령", "trigger", {}, "25칸 이상 점령하면 10초 안 다음 점령 점수 ×1.5", "25칸 이상 점령 뒤", "10초", ["capture"]),
  A("barrier", "epic", "🚧", "영토 장벽", "active", { cd: 25 }, "앞 3칸 지점에 가로 5칸 벽 6초 — 상대는 지나갈 수 없음", "언제든", "6초 · 재사용 25초", ["disrupt", "defense"]),
  A("rulerStep", "epic", "👑", "지배자의 발걸음", "active", { cd: 35 }, "5초 동안 이동속도 +30%, 점령 점수 ×1.5", "언제든", "5초 · 재사용 35초", ["speed", "capture"]),
  A("replicate", "epic", "🪞", "영역 복제", "active", { cd: 40 }, "최근 점령한 모양(최대 50칸)을 내 자리에 복사 — 중립 칸에만", "내 영토 안에서 · 최근 점령이 있을 때", "즉시 · 재사용 40초", ["capture"]),
  // ---------- 전설 10 (경고 후 발동·횟수 제한) ----------
  A("divineLand", "legendary", "✨", "신의 영토", "active", { ch: 1, warn: 1.5 }, "1.5초 경고 뒤 내 주변 반지름 7칸의 중립 땅을 전부 점령", "언제든", "1회", ["capture"]),
  A("timeRewind", "legendary", "⏪", "시간 역행", "active", { ch: 2 }, "마지막으로 내 영토에 있던 자리로 돌아감 (궤적 사라짐) + 1.5초 무적", "궤적이 있을 때", "2회", ["defense", "move"]),
  A("megaBlast", "legendary", "☄️", "영토 대폭발", "active", { ch: 1, warn: 2 }, "2초 경고 뒤 앞 6칸 지점 13×13 안 상대 영토를 중립으로", "언제든", "1회", ["disrupt"]),
  A("infiniteSprint", "legendary", "🌪️", "무한 질주", "active", { cd: 45 }, "3초 동안 이동속도 +80%", "언제든", "3초 · 재사용 45초", ["speed"]),
  A("conversion", "legendary", "🔄", "영토 전환", "active", { ch: 1, warn: 2 }, "2초 경고 뒤 앞 5칸 지점 9×9 안 상대 영토를 내 영토로", "언제든", "1회", ["capture", "disrupt"]),
  A("survive", "legendary", "💖", "절대 생존", "trigger", { ch: 1 }, "탈락하는 순간 1번 살아남아 가장 안전한 내 땅으로 + 2초 무적", "탈락할 때", "1회", ["defense"]),
  A("cloneArmy", "legendary", "🫂", "분신 군단", "active", { ch: 1, warn: 1 }, "6초 동안 분신 4명이 사방으로 흩어져 궤적을 그려요 (가짜)", "언제든", "1회", ["disrupt"]),
  A("spaceRule", "legendary", "🌌", "공간 지배", "active", { cd: 25 }, "한 번 누르면 지금 자리 표시, 15초 안 다시 누르면 그 자리로 이동 (궤적 사라짐)", "표시 뒤 15초 안", "재사용 25초", ["move"]),
  A("lastComeback", "legendary", "🔱", "최후의 역전", "passive", {}, "내 점령률이 1등의 40% 미만이면 점령 점수 ×2 + 붙은 상대 땅 2칸 흡수", "1등보다 크게 뒤질 때", "조건 동안", ["capture"]),
  A("territoryKing", "legendary", "🏰", "영토의 왕", "active", { ch: 1, warn: 1 }, "8초 동안 이동속도 +20%, 궤적이 끊기지 않고 점령 점수 ×1.5", "언제든", "1회", ["speed", "defense", "capture"]),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const WEIGHTS = [
  { common: 58, rare: 30, epic: 10, legendary: 2 },
  { common: 40, rare: 34, epic: 20, legendary: 6 },
  { common: 26, rare: 34, epic: 28, legendary: 12 },
  { common: 16, rare: 30, epic: 34, legendary: 20 },
];
export function rollOffer(pickIdx, owned = [], rng = Math.random, n = 3, exclude = []) {
  const w = WEIGHTS[Math.min(pickIdx, WEIGHTS.length - 1)];
  const pool = AUGS.filter(a => !owned.includes(a.id) && !exclude.includes(a.id));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    let tot = 0; for (const a of pool) tot += w[a.rarity];
    let x = rng() * tot, i = 0;
    for (; i < pool.length - 1; i++) { x -= w[pool[i].rarity]; if (x <= 0) break; }
    out.push(pool[i].id); pool.splice(i, 1);
  }
  return out;
}
