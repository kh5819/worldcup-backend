// =========================
// DUO 증강 알까기 — 증강 40종 (2026-11-17)
// kind
//   passive  지속형: 고르는 순간부터 끝까지 물리 값이 바뀜(질량·마찰·탄성·충격 배율·발사 속도·오차)
//   shot     사용형(발사형): 발사 전에 켜면 이번 발사에 적용. 차례를 따로 쓰지 않음
//   pre      사용형(준비형): 발사 전에 바로 실행(위치 이동·부활·소환 등) — 이어서 그 차례에 발사
//   reaction 반응형: 조건이 되면 자동 발동 (횟수 제한)
// 한 차례에 사용형(shot/pre) 1개. 사용 뒤 재사용 대기(cd)는 '내 차례' 수 기준
// 반응형 순서 — 경기장 밖으로 나갈 때: 알 자체 보호막(황금 알·알까기의 신) → 보호막 증강 → 최후의 생존(마지막 알일 때)
//            세게 맞을 때: 절대 방어(통째로 흡수) → 아니면 반사 충격(일부 되돌림)
// target: own(내 알) · enemy(상대 알) · point(판 위 지점) · ownPoint(내 알 + 가까운 지점) · ownAny(내 알 + 판 위 아무 지점) · ownEnemy(내 알 + 상대 알) · curve(휘는 방향)
// =========================
export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
export const KIND_LABEL = { passive: "지속형", shot: "사용형 · 발사", pre: "사용형 · 준비", reaction: "반응형" };
export const SYNERGY = {
  power: { label: "파워 시너지", desc: "파워 증강 3개 이상: 발사 속도 +6%" },
  guard: { label: "방어 시너지", desc: "방어 증강 3개 이상: 받는 충격 -8%" },
  field: { label: "현상 시너지", desc: "현상(충격파·장) 증강 3개 이상: 충격파·장 세기 +20%" },
  stone: { label: "알 시너지", desc: "알 변형 증강 3개 이상: 내 알 질량 +10%" },
};
const A = (id, rarity, art, name, kind, charges, cd, desc, tags = [], extra = {}) => ({ id, rarity, art, name, kind, charges, cd, desc, tags, ...extra });
export const AUGS = [
  // ---------- 일반 10 ----------
  A("strongFinger", "common", "amp", "강한 손가락", "passive", null, 0, "발사 속도 +10%", ["power"]),
  A("preciseAim", "common", "eye", "정밀 조준", "passive", null, 0, "조준선이 첫 충돌 뒤 튕겨 나갈 방향까지 길게 보이고, 발사 오차 -30%", ["power"]),
  A("hardStone", "common", "shield", "단단한 알", "passive", null, 0, "내 알이 받는 충격 -15%", ["guard"]),
  A("lightStone", "common", "small", "가벼운 알", "passive", null, 0, "내 알의 마찰 -20% (더 멀리 미끄러짐)", ["stone"]),
  A("bouncy", "common", "rotate", "탄성 강화", "passive", null, 0, "내 알의 반발 계수 +0.1 (부딪히면 더 세게 튕김)", ["power"]),
  A("stance", "common", "plus", "안정적인 자세", "passive", null, 0, "발사 오차 -70%", ["power"]),
  A("lastStone", "common", "star", "마지막 한 알", "passive", null, 0, "내 알이 1개 남으면: 질량 ×1.4, 발사 속도 +12%, 받는 충격 -20%", ["guard"]),
  A("combo", "common", "combo", "연속 타격", "passive", null, 0, "상대 알을 맞히면 다음 내 발사 속도 +15% (연속으로 맞히면 계속)", ["power"]),
  A("guard", "common", "shield", "수비 태세", "passive", null, 0, "판 가장자리(알 2개 거리) 근처에 있는 내 알이 받는 충격 -30%", ["guard"]),
  A("precisionHit", "common", "cross", "정확한 타격", "passive", null, 0, "정면 충돌(20도 안)이면 상대가 받는 충격 ×1.3", ["power"]),
  // ---------- 희귀 10 ----------
  A("giant", "rare", "plus", "거대 알", "shot", 2, 1, "이번에 쏘는 알이 크기 ×1.45 · 질량 ×1.9 (멈추면 원래대로)", ["stone"]),
  A("tiny", "rare", "small", "작은 알", "passive", null, 0, "내 알 전부 크기 ×0.8 · 마찰 -15% · 질량 ×0.8 (맞히기 어려워짐)", ["stone"]),
  A("splitStone", "rare", "double", "분열 알", "shot", 2, 2, "쏜 알이 처음 부딪히는 순간 작은 알(내 알)이 하나 더 생겨요 (추가 알 한도 안에서)", ["stone"]),
  A("bombStone", "rare", "bomb", "폭탄 알", "shot", 2, 1, "처음 부딪히는 순간 작은 충격파 (반지름 알 3.6개)", ["field"]),
  A("magnetStone", "rare", "magnet", "자석 알", "shot", 2, 1, "쏜 알이 움직이는 동안 주변(알 5.5개 거리)의 상대 알을 끌어당김", ["field"]),
  A("pushOut", "rare", "swap", "밀어내기", "passive", null, 0, "내 알이 주는 충격 ×1.2", ["power"]),
  A("shield", "rare", "shield", "보호막", "reaction", 1, 0, "내 알이 경기장 밖으로 나가려 할 때 1번 튕겨서 막아요", ["guard"]),
  A("teleport", "rare", "sparkle", "순간 이동", "pre", 2, 1, "발사 전, 내 알 하나를 알 4개 거리 안의 빈 곳으로 옮겨요 (밖·가장자리 금지)", ["stone"], { target: "ownPoint", range: 4 }),
  A("iceStone", "rare", "wand", "얼음 알", "shot", 2, 1, "이번에 쏘는 알의 마찰 -55% (훨씬 멀리 미끄러짐)", ["stone"]),
  A("heavyStone", "rare", "gold", "무거운 알", "passive", null, 0, "내 알 전부 질량 ×1.5 (마찰 +5%)", ["stone", "guard"]),
  // ---------- 영웅 10 ----------
  A("tripleSplit", "epic", "burst", "삼중 분열", "shot", 1, 0, "처음 부딪히는 순간 작은 알 3개로 나뉘어 퍼져요 (추가 알 한도 안에서)", ["stone"]),
  A("megaBlast", "epic", "bomb", "대폭발", "shot", 1, 0, "처음 부딪히는 순간 큰 충격파 (반지름 알 7개)", ["field"]),
  A("gravity", "epic", "rotate", "중력 조작", "shot", 1, 0, "발사 후 1.2초 동안 다른 모든 알이 발사 방향으로 끌려가요", ["field"]),
  A("ironWall", "epic", "shield", "철벽 알", "pre", 2, 2, "내 알 하나가 다음 내 차례까지 철벽 (받는 충격 -65%, 충격파·자석에 안 밀림)", ["guard"], { target: "own" }),
  A("chainShock", "epic", "combo", "연쇄 충격", "shot", 1, 0, "이번 발사의 강한 충돌마다 작은 충격파 (최대 8번)", ["field"]),
  A("posSwap", "epic", "swap", "위치 교환", "pre", 1, 0, "발사 전, 내 알 하나와 상대 알 하나의 자리를 바꿔요", ["stone"], { target: "ownEnemy" }),
  A("revive", "epic", "phoenix", "알 부활", "pre", 1, 0, "떨어진 내 알 하나를 내 출발 자리 근처로 되살려요", ["guard"]),
  A("whirl", "epic", "rotate", "회오리 알", "shot", 2, 1, "쏜 알이 왼쪽/오른쪽으로 휘어 가고, 부딪힐 때 충격 ×1.15", ["power"], { target: "curve" }),
  A("reflectShock", "epic", "rewind", "반사 충격", "reaction", 3, 0, "상대 알에 세게 맞으면 충격의 45%를 민 알에 되돌려요 (3번)", ["guard"]),
  A("spaceMove", "epic", "sparkle", "공간 이동", "pre", 1, 0, "발사 전, 내 알 하나를 판 위 아무 빈 곳으로 옮겨요 (가장자리 알 2개 거리 금지)", ["stone"], { target: "ownAny" }),
  // ---------- 전설 10 (모두 1번 또는 1회 발동) ----------
  A("godFinger", "legendary", "star", "신의 손가락", "shot", 1, 0, "이번 발사: 속도 ×1.6 · 질량 ×2 · 주는 충격 ×1.3 · 오차 0", ["power"]),
  A("fateReversal", "legendary", "phoenix", "운명 역전", "reaction", 1, 0, "내 차례 시작에 알이 상대 최다의 절반 이하면 1번: 떨어진 알 1개 부활 + 내 알 질량 ×1.3 (끝까지)", ["guard"]),
  A("legion", "legendary", "crown", "알의 군단", "pre", 1, 0, "작은 군단 알 2개를 내 알 근처에 소환 (추가 알 한도 안에서)", ["stone"]),
  A("absDefense", "legendary", "shield", "절대 방어", "reaction", 1, 0, "내 알이 아주 세게 맞는 순간 1번: 충격을 통째로 흡수해 그 자리에 버팀", ["guard"]),
  A("timeRewind", "legendary", "rewind", "시간 역행", "pre", 1, 0, "발사 전, 판을 바로 앞 사람의 발사 전 상태로 되돌려요 (그 발사로 떨어진 알도 돌아옴)", ["field"]),
  A("blackHole", "legendary", "magnet", "블랙홀", "shot", 1, 0, "판 위 한 지점에 2.5초 동안 블랙홀 — 주변(알 7개 거리) 모든 알을 끌어당김", ["field"], { target: "point" }),
  A("earthquake", "legendary", "burst", "대지진", "shot", 1, 0, "발사와 동시에 판 위 모든 알이 제멋대로 흔들려요 (내 쏜 알 빼고)", ["field"]),
  A("goldenStone", "legendary", "gold", "황금 알", "pre", 1, 0, "내 알 하나가 황금 알로: 질량 ×1.7 · 크기 ×1.12 · 받는 충격 -25% · 주는 충격 +15% · 보호막 1", ["stone"], { target: "own" }),
  A("lastSurvival", "legendary", "phoenix", "최후의 생존", "reaction", 1, 0, "내 마지막 알이 떨어지려 할 때 1번: 판 가운데 근처 빈 곳으로 구해 냄", ["guard"]),
  A("flickGod", "legendary", "crown", "알까기의 신", "passive", null, 0, "발사 속도 +12% · 오차 0 · 주는 충격 +15% · 받는 충격 -15% · 고르는 순간 내 알 하나에 보호막 1", ["power", "guard"]),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const WEIGHTS = [
  { common: 62, rare: 28, epic: 9, legendary: 1 },
  { common: 45, rare: 35, epic: 16, legendary: 4 },
  { common: 30, rare: 38, epic: 24, legendary: 8 },
  { common: 20, rare: 36, epic: 30, legendary: 14 },
  { common: 14, rare: 32, epic: 34, legendary: 20 },
];
export const MAX_AUGS = 5;
export const PICK_EVERY = 2;
export function rollOffer(pickIdx, owned, { rng = Math.random, n = 3 } = {}) {
  const w = WEIGHTS[Math.min(pickIdx, WEIGHTS.length - 1)];
  const tags = new Set(owned.flatMap(id => AUG[id]?.tags || []));
  const pool = AUGS.filter(a => !owned.includes(a.id));
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    const wt = pool.map(a => (w[a.rarity] || 1) * (a.tags.some(t => tags.has(t)) ? 1.5 : 1));
    let r = rng() * wt.reduce((s, x) => s + x, 0), pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= wt[i]; if (r <= 0) { pick = i; break; } }
    out.push(pool[pick].id); pool.splice(pick, 1);
  }
  return out;
}
export function synergyOf(ids) {
  const c = {}; for (const id of ids) for (const t of AUG[id]?.tags || []) c[t] = (c[t] || 0) + 1;
  return Object.keys(SYNERGY).filter(t => (c[t] || 0) >= 3);
}
export const META_AUGS = AUGS.map(({ id, rarity, art, name, kind, charges, cd, desc, tags, target, range }) => ({ id, rarity, art, name, kind, charges, cd, desc, tags, target: target || null, range: range || null }));
