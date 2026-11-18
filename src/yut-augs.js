// =========================
// 플듀 증강 윷놀이 — 증강 40종 정의 (데이터)
// kind: passive(자동) | active(버튼, 대상 고르기 있을 수 있음) | arm(켜 두면 다음 던지기/이동에 적용)
// target: 능동 증강이 고르는 대상 — myPiece(판 위 내 말) | oppPiece(판 위 상대 말) | myPiece+oppPiece | homePiece(잡혔던 집 말)
//         | result(남은 결과 하나) | node(주요 지점) | myPiece+steps | myPiece+myPiece2
// stack: 같은 증강 중첩 가능 여부 (전부 false — 같은 증강은 한 사람이 한 장만)
// fx: 화면 효과 이름 (yut-main.js 가 해석)
// 모든 효과의 실제 판정은 yut-engine.js 서버 쪽에서만 함
// =========================
export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };

export const AUGS = [
  // ---------------- 일반 ----------------
  { id: "quickStep", rarity: "common", icon: "👟", name: "빠른 발걸음", kind: "passive", cap: 6, cond: "도·개로 이동할 때", effect: "이동 +1칸", duration: "판 전체 (최대 6번)", fx: "dash" },
  { id: "safeStart", rarity: "common", icon: "🔰", name: "안전한 출발", kind: "passive", cond: "처음 출발하는 말", effect: "보호막 1회 (한 번 잡혀도 버팀)", duration: "보호막을 쓸 때까지", fx: "shield" },
  { id: "luckyDo", rarity: "common", icon: "🍀", name: "행운의 도", kind: "passive", cond: "도가 나오면", effect: "다음 이동 +2칸 (판 전체 최대 3번)", duration: "최대 3번", fx: "dash" },
  { id: "buddyPower", rarity: "common", icon: "🤝", name: "동료의 힘", kind: "passive", cond: "업은 말(2개 이상)로 이동할 때", effect: "이동 +2칸", duration: "판 전체", fx: "dash" },
  { id: "retry", rarity: "common", icon: "🔁", name: "재도전", kind: "active", charges: 3, target: "result", cond: "던진 결과가 남아 있을 때", effect: "그 결과를 버리고 다시 던짐 (윷·모 결과는 다시 못 던짐)", duration: "즉시 (3회)", fx: "throw" },
  { id: "escapeArtist", rarity: "common", icon: "💨", name: "도망 전문가", kind: "passive", cond: "상대 말이 내 말 뒤 1~3칸 안에 있을 때", effect: "그 말 이동 +1칸", duration: "판 전체", fx: "dash" },
  { id: "startSupport", rarity: "common", icon: "🚩", name: "출발 지원", kind: "passive", cond: "새 말이 출발할 때마다", effect: "다음 상대 차례가 끝날 때까지 잡히지 않음", duration: "상대 한 바퀴", fx: "shield" },
  { id: "lastDash", rarity: "common", icon: "🏁", name: "마지막 질주", kind: "passive", cond: "완주까지 5칸 이내인 말", effect: "이동 +1칸", duration: "판 전체", fx: "dash" },
  { id: "yutBlessing", rarity: "common", icon: "🌟", name: "윷의 축복", kind: "passive", cap: 3, cond: "윷이 나오면", effect: "도 결과 하나 더 받음", duration: "최대 3번", fx: "bless" },
  { id: "moBlessing", rarity: "common", icon: "✨", name: "모의 축복", kind: "passive", cap: 3, cond: "모가 나오면", effect: "개 결과 하나 더 받음", duration: "최대 3번", fx: "bless" },
  // ---------------- 희귀 ----------------
  { id: "teleport", rarity: "rare", icon: "🌀", name: "순간이동", kind: "active", charges: 1, target: "myPiece+steps", cond: "내 차례, 판 위 내 말", effect: "그 말(업힌 말 포함)을 1~3칸 앞으로 바로 이동 (잡기 가능)", duration: "즉시", fx: "teleport" },
  { id: "swapPos", rarity: "rare", icon: "🔄", name: "위치 교환", kind: "active", charges: 1, target: "myPiece+oppPiece", cond: "내 차례, 남은 거리 차이 6칸 이내", effect: "내 말 무리와 상대 말 무리 자리 바꾸기 (보호 중인 말 제외)", duration: "즉시", fx: "swap" },
  { id: "ironWall", rarity: "rare", icon: "🛡️", name: "철벽 방어", kind: "passive", cap: 1, cond: "우리 말이 잡힐 때", effect: "잡기 1회 무효", duration: "1번 막을 때까지", fx: "shield" },
  { id: "extraMove", rarity: "rare", icon: "➕", name: "추가 이동", kind: "active", charges: 1, cond: "내 차례", effect: "윷을 한 번 더 던짐", duration: "즉시", fx: "throw" },
  { id: "forkMaster", rarity: "rare", icon: "🔱", name: "갈림길 지배자", kind: "passive", cap: 2, cond: "모서리·방을 지나갈 때", effect: "멈추지 않고 지나가도 갈림길을 고를 수 있음", duration: "꺾을 때마다 1번, 최대 2번", fx: "path" },
  { id: "revengeStep", rarity: "rare", icon: "😤", name: "복수의 발걸음", kind: "passive", cond: "우리 말이 잡히면", effect: "다음 내 차례 모든 이동 +2칸", duration: "다음 차례 동안", fx: "dash" },
  { id: "split", rarity: "rare", icon: "✂️", name: "말 분리", kind: "arm", charges: 2, cond: "업은 말이 있을 때", effect: "다음 이동은 업힌 말 중 하나만 움직임", duration: "다음 이동 1번", fx: "split" },
  { id: "pushBack", rarity: "rare", icon: "↩️", name: "뒤로 가기", kind: "active", charges: 2, target: "oppPiece", cond: "판 위 상대 말 (보호 중 제외)", effect: "그 말 무리를 3칸 뒤로", duration: "즉시", fx: "push" },
  { id: "shortcutOpen", rarity: "rare", icon: "🚪", name: "지름길 개방", kind: "passive", cond: "모서리 바로 앞 칸(4·9)에 멈췄을 때", effect: "모서리를 건너뛰고 바로 지름길로 들어갈 수 있음", duration: "판 전체", fx: "path" },
  { id: "chaser", rarity: "rare", icon: "🐺", name: "추격자", kind: "passive", cond: "내 말 앞 1~5칸에 상대 말이 있을 때", effect: "그 말 이동 +2칸", duration: "판 전체", fx: "dash" },
  // ---------------- 영웅 ----------------
  { id: "clone", rarity: "epic", icon: "👥", name: "말 복제", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말", effect: "그 자리에 따로 움직이는 분신 생성 (상대를 잡을 수 있음, 내 차례 5번 유지, 잡히거나 완주하면 사라짐, 승리 조건엔 안 셈)", duration: "내 차례 5번", fx: "clone" },
  { id: "forceSwap", rarity: "epic", icon: "🔃", name: "강제 교환", kind: "active", charges: 1, target: "myPiece+oppPiece", cond: "판 위 상대 말 (보호 무시, 완주 4칸 이내 말은 제외)", effect: "거리 제한 없이 자리 바꾸기", duration: "즉시", fx: "swap" },
  { id: "chainChase", rarity: "epic", icon: "⛓️", name: "연쇄 추격", kind: "passive", cond: "상대 말을 잡으면", effect: "추가 던지기에 더해 걸 결과 하나 더", duration: "판 전체", fx: "bless" },
  { id: "goldenYut", rarity: "epic", icon: "🥇", name: "황금 윷", kind: "passive", cap: 2, cond: "걸이 나오면", effect: "윷으로 바뀜 (한 번 더 던짐)", duration: "최대 2번", fx: "gold" },
  { id: "fateChoice", rarity: "epic", icon: "🎴", name: "운명의 선택", kind: "arm", charges: 3, cond: "던지기 전에 켬", effect: "두 번 던져 마음에 드는 결과 하나 고르기", duration: "다음 던지기 1번", fx: "throw" },
  { id: "groupMove", rarity: "epic", icon: "🐎", name: "집단 이동", kind: "active", charges: 2, target: "myPiece+myPiece2", cond: "판 위에 내 말 무리가 둘 이상", effect: "다음 이동 때 고른 두 무리가 같은 결과로 함께 이동", duration: "다음 이동 1번", fx: "dash" },
  { id: "invincibleMarch", rarity: "epic", icon: "⚔️", name: "무적 행군", kind: "arm", charges: 2, cond: "이동 전에 켬", effect: "다음에 움직이는 말은 상대 두 바퀴 동안 잡히지 않음", duration: "상대 두 바퀴", fx: "shield" },
  { id: "blockade", rarity: "epic", icon: "⛓️‍💥", name: "상대 봉쇄", kind: "active", charges: 3, target: "oppPiece", cond: "판 위 상대 말", effect: "그 말 무리는 상대의 다음 차례에 움직일 수 없음", duration: "상대 다음 차례", fx: "block" },
  { id: "pathWarp", rarity: "epic", icon: "🌌", name: "경로 왜곡", kind: "arm", charges: 2, cond: "이동 전에 켬", effect: "이번 이동은 지나가는 갈림길·15번 모서리에서도 꺾을 수 있음", duration: "다음 이동 1번", fx: "path" },
  { id: "reviveMarch", rarity: "epic", icon: "🔥", name: "부활의 행군", kind: "active", charges: 1, target: "homePiece", cond: "잡혀서 집에 있는 내 말", effect: "그 말을 모 자리(5)에서 다시 출발 (잡기 가능)", duration: "즉시", fx: "revive" },
  // ---------------- 전설 ----------------
  { id: "godHand", rarity: "legendary", icon: "🖐️", name: "신의 손", kind: "active", charges: 2, target: "result", cond: "남은 결과가 있을 때", effect: "그 결과를 원하는 결과로 바꿈 (바꾼 윷·모는 추가 던지기 없음)", duration: "즉시", fx: "god" },
  { id: "timeRewind", rarity: "legendary", icon: "⏪", name: "시간 역행", kind: "active", charges: 2, cond: "이번 차례에 방금 한 이동 (그 뒤 던지기 전)", effect: "직전 이동을 되돌리고 그 결과를 돌려받음 (잡힌 말도 원래대로)", duration: "즉시", fx: "rewind" },
  { id: "kingReturn", rarity: "legendary", icon: "👑", name: "왕의 귀환", kind: "active", charges: 1, cond: "잡혀서 집에 있는 내 말이 있을 때", effect: "잡혔던 말 전부 모 자리(5)에서 다시 출발 (잡기 가능)", duration: "즉시", fx: "revive" },
  { id: "spaceRule", rarity: "legendary", icon: "🏯", name: "공간 지배", kind: "active", charges: 1, target: "myPiece+node", cond: "판 위 내 말", effect: "그 말 무리를 모서리(5·10·15)나 방(22)으로 이동 (잡기 가능)", duration: "즉시", fx: "teleport" },
  { id: "fateSteal", rarity: "legendary", icon: "🦹", name: "운명 강탈", kind: "arm", charges: 1, cond: "내 차례에 켬", effect: "다음 상대가 던진 첫 결과를 빼앗아 내 다음 차례에 씀", duration: "상대 첫 던지기", fx: "steal" },
  { id: "comeback", rarity: "legendary", icon: "🔥", name: "대역전", kind: "passive", cond: "우리 남은 거리 합이 1등보다 15칸 이상 많을 때", effect: "모든 이동 +2칸", duration: "조건 동안", fx: "dash" },
  { id: "legendYut", rarity: "legendary", icon: "🐉", name: "전설의 윷", kind: "arm", charges: 2, cond: "던지기 전에 켬", effect: "다음 던지기는 반드시 윷 또는 모", duration: "다음 던지기 1번", fx: "gold" },
  { id: "dimension", rarity: "legendary", icon: "🕳️", name: "차원 이동", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말", effect: "그 말 무리를 남은 거리의 3분의 2만큼 즉시 앞으로 (잡기 가능)", duration: "즉시", fx: "teleport" },
  { id: "absoluteDefense", rarity: "legendary", icon: "🏰", name: "절대 방어", kind: "passive", cap: 2, cond: "우리 말이 잡힐 때", effect: "잡기 2회 무효", duration: "2번 막을 때까지", fx: "shield" },
  { id: "finalDash", rarity: "legendary", icon: "🚀", name: "최후의 질주", kind: "passive", cond: "완주 못 한 말이 1개만 남았을 때", effect: "그 말 이동 칸 수 2배", duration: "조건 동안", fx: "dash" },
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, { stack: false, charges: null, cap: null, target: null, ...a, desc: `${a.cond} → ${a.effect}` }]));
for (const a of AUGS) Object.assign(a, AUG[a.id]);

// 고르기 차례별 희귀도 확률 — 뒤로 갈수록 좋은 카드
const RW = [
  { common: 58, rare: 30, epic: 10, legendary: 2 },
  { common: 40, rare: 35, epic: 19, legendary: 6 },
  { common: 26, rare: 34, epic: 27, legendary: 13 },
  { common: 18, rare: 30, epic: 32, legendary: 20 },
];
export function rollOffer(pickIdx, owned = [], rng = Math.random, n = 3, exclude = [], POOL = AUGS) {
  const w = RW[Math.min(pickIdx, RW.length - 1)];
  const taken = new Set([...owned, ...exclude]);
  const out = [];
  for (let k = 0; k < n; k++) {
    let r = rng() * 100, rar = "common";
    for (const [key, v] of Object.entries(w)) { r -= v; if (r <= 0) { rar = key; break; } }
    let pool = POOL.filter(a => a.rarity === rar && !taken.has(a.id));
    if (!pool.length) pool = POOL.filter(a => !taken.has(a.id));
    if (!pool.length) break;
    const a = pool[Math.floor(rng() * pool.length)];
    out.push(a.id); taken.add(a.id);
  }
  return out;
}
