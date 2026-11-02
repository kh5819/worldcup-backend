// =========================
// 플듀 심리전 능력 진단소 — 서버·화면 공용 (이 파일은 js/mind/mind-core.js와 똑같아야 함: test-mind-games가 검사)
// 게임 정보 · 튜토리얼 · 점수식 · 유형 30종 · 멘트 150종 · 칭호
// 정답·AI·시나리오 생성은 서버 전용(mind-games.js)이라 여기 없음
// 게임 내 가상 칩·포인트만 쓰며, 실제 거짓말 탐지·심리 능력 측정이 아님
// =========================
export const CORE_VERSION = 1;
export const SET_VERSION = "m1";

export const AREAS = ["predict", "bluff", "analyze", "negotiate", "risk"];
export const AREA_NAME = { predict: "상대 예측력", bluff: "블러핑", analyze: "정보 분석", negotiate: "협상 전략", risk: "위험 판단" };
export const AREA_SHORT = { predict: "예측", bluff: "블러핑", analyze: "분석", negotiate: "협상", risk: "위험" };
export const AREA_COL = { predict: "#3ee6f0", bluff: "#ff5fd2", analyze: "#46e08a", negotiate: "#ffd35a", risk: "#ff7a59" };
export const AREA_DESC = {
  predict: "상대의 다음 수와 패턴을 얼마나 읽었나", bluff: "상대가 내 수를 못 읽게 했나, 허세가 통했나",
  analyze: "진술·단서·힌트의 모순을 얼마나 찾았나", negotiate: "협력·거래에서 얼마나 실속을 챙겼나", risk: "걸어야 할 때 걸고 빠져야 할 때 빠졌나",
};
// 종합 점수 = 다섯 영역 가중 합 × 90% + 승리 보너스 10%
export const AREA_WEIGHT = { predict: 0.25, bluff: 0.2, analyze: 0.25, negotiate: 0.15, risk: 0.15 };
export const WIN_SHARE = 0.1;
export const LEVELS = [
  { id: 1, name: "보통", mul: 0.9, desc: "AI가 전략을 섞고 내 습관을 조금 읽어요" },
  { id: 2, name: "어려움", mul: 1, desc: "AI가 전략을 바꾸고 습관을 파고들어요" },
  { id: 3, name: "전문가", mul: 1.08, desc: "기억과 전략 혼합이 가장 정교해요. 보이는 정보만 쓰는 건 같아요" },
];
export const levelOf = (lv) => LEVELS[Math.min(3, Math.max(1, lv | 0)) - 1];
// AI 라이벌 12명 — 이름만 다른 게 아니라 mind-games.js의 PERSONA로 실제 수가 달라짐
export const RIVALS = {
  luna: { name: "루나", title: "냉정한 분석가", col: "#45e5e0", style: "내 패턴을 오래 기억해요" },
  zero: { name: "제로", title: "변칙의 화신", col: "#eaf6ff", style: "무작위와 변칙으로 읽기 어려워요" },
  kain: { name: "카인", title: "공격적 허풍쟁이", col: "#ff6078", style: "약한 패로도 크게 질러요" },
  mira: { name: "미라", title: "상처받기 쉬운 협력가", col: "#46e08a", style: "협력을 좋아하지만 배신하면 끝이에요" },
  raven: { name: "레이븐", title: "기록 수집가", col: "#9775fa", style: "내 직전 선택을 파고들어요" },
  neon: { name: "네온", title: "위험 중독자", col: "#ff6fd0", style: "비싸게 지르고 콜도 잘해요" },
  iris: { name: "아이리스", title: "신중한 관찰자", col: "#5aa8ff", style: "정보를 모은 뒤 움직이고 무리하지 않아요" },
  black: { name: "블랙", title: "거짓 정보 상인", col: "#8a93c4", style: "거짓 선언과 약속 파기가 특기예요" },
  echo: { name: "에코", title: "거울 인간", col: "#7ee05a", style: "내 행동을 그대로 따라 해요" },
  sera: { name: "세라", title: "장기 투자자", col: "#f4c76a", style: "당장보다 긴 이득을 봐요" },
  crow: { name: "크로우", title: "압박 전문가", col: "#ff9a4a", style: "앞서면 더 세게 몰아붙여요" },
  omega: { name: "오메가", title: "최종 상대", col: "#ffffff", style: "앞의 전략을 섞어 상황마다 바꿔요" },
};
export const RIVAL_POOL = { liar: ["luna", "iris", "raven"], bluff: ["kain", "black", "crow", "zero"], predict: ["raven", "luna", "echo", "zero"], rps: ["echo", "raven", "zero", "crow"], auction: ["neon", "iris", "sera"], contract: ["mira", "black", "echo", "sera"], suspect: ["iris", "luna", "raven"], nego: ["sera", "crow", "kain"], trap: ["crow", "neon", "luna"], maze: ["zero", "raven", "black"], fake: ["black", "iris", "luna"], final: ["omega"] };

// 게임별 영역 가중치 (합 1) — 게임이 낸 영역 성과 perf[영역](0~1)에 곱함
export const GAMES = {
  liar: { name: "거짓말 탐지실", en: "Lie Lab", icon: "liar", room: "interrogation", op: "dok", w: { analyze: 0.75, risk: 0.25 }, min: 3,
    desc: "진술과 증거의 모순을 찾아요", how: ["증거 보드와 용의자 진술 4개를 읽어요.", "증거와 모순되는 진술을 하나 고르고, 확신도를 정해요.", "확신을 크게 걸면 맞았을 때 더 얻고, 틀리면 잃어요."], ctl: "진술을 누르고 ‘조금 확신 / 크게 확신’을 눌러요. PC는 숫자키 1~4." },
  bluff: { name: "블러핑 포커", en: "Bluff Poker", icon: "cards", room: "arena", op: "fox", w: { bluff: 0.5, predict: 0.3, risk: 0.2 }, min: 3,
    desc: "가상 칩으로 허세와 간파 대결", how: ["1~9 중 카드 한 장씩 받고, 높은 카드가 이겨요. 칩은 게임 안에서만 쓰는 가상 칩이에요.", "체크 또는 베팅(작게 2 · 크게 5). 상대가 베팅하면 콜 또는 폴드예요.", "약한 패로도 크게 베팅해 상대를 접게 만들 수 있어요."], ctl: "버튼을 눌러요. PC는 숫자키 1~3." },
  predict: { name: "다음 행동 예측", en: "Next Move", icon: "eye", room: "lab", op: "ori", w: { predict: 0.85, analyze: 0.15 }, min: 2,
    desc: "상대의 선택 패턴을 읽어요", how: ["상대는 매번 공격·방어·교란 중 하나를 골라요.", "상대의 다음 행동을 맞혀요. 지난 기록이 힌트예요.", "끝나면 상대의 규칙이 무엇이었는지 맞히는 문제가 나와요."], ctl: "세 버튼 중 하나를 눌러요. PC는 숫자키 1~3." },
  rps: { name: "심리 가위바위보", en: "Mind RPS", icon: "rps", room: "arena", op: "rin", w: { predict: 0.45, bluff: 0.3, risk: 0.25 }, min: 2,
    desc: "반복 습관과 전략 변화 싸움", how: ["15판 가위바위보예요. 상대는 내 습관을 계속 분석해요.", "상대는 가끔 ‘다음에 낼 손’을 선언해요. 진짜일 수도 거짓일 수도 있어요.", "이기는 것만큼 내 패턴을 읽히지 않는 것도 점수예요."], ctl: "손을 눌러요. PC는 숫자키 1~3." },
  auction: { name: "비밀 경매", en: "Secret Auction", icon: "coin", room: "negotiation", op: "gold", w: { risk: 0.5, predict: 0.5 }, min: 3,
    desc: "가상 포인트로 몰래 입찰", how: ["가상 포인트 100으로 물건 6개에 몰래 입찰해요. 가장 높게 쓴 사람이 낙찰돼요.", "내가 아는 ‘감정가’와 낙찰가의 차이가 이익이에요.", "경쟁자 최고 입찰가도 예상해 적어요. 가까울수록 점수예요."], ctl: "＋/− 버튼이나 슬라이더로 입찰가를 정하고 ‘봉인’을 눌러요." },
  contract: { name: "배신의 계약", en: "Betrayal Pact", icon: "contract", room: "negotiation", op: "vera", w: { negotiate: 0.5, predict: 0.2, risk: 0.15, bluff: 0.15 }, min: 2,
    desc: "협력할까, 배신할까", how: ["매 라운드 협력 또는 배신을 몰래 골라요. 둘 다 협력 3·3, 혼자 배신 5·0, 둘 다 배신 1·1.", "먼저 약속을 할 수 있어요. 약속은 지켜도 되고 어겨도 돼요.", "라운드 수는 비밀이에요. 끝나면 상대 유형을 맞혀요."], ctl: "약속 여부를 고르고 협력/배신을 눌러요. PC는 C / D 키." },
  suspect: { name: "표정 없는 용의자", en: "Blank Suspect", icon: "mask", room: "interrogation", op: "dok", w: { analyze: 0.6, predict: 0.2, risk: 0.2 }, min: 3,
    desc: "단서로 진술을 검증해요", how: ["용의자들은 한 마디씩 해요. 거짓말쟁이 수는 화면에 나와요.", "그 조건에 맞는 범인은 딱 한 명이에요. 범인과 거짓말쟁이를 지목해요.", "단서를 열면 쉬워지지만 그 사건 점수가 줄어요."], ctl: "범인 카드와 거짓 진술을 누르고 ‘지목’을 눌러요." },
  nego: { name: "최후의 협상", en: "Final Deal", icon: "deal", room: "negotiation", op: "vera", w: { negotiate: 0.7, predict: 0.15, risk: 0.15 }, min: 3,
    desc: "숨겨진 목표를 품고 협상해요", how: ["물건 세 종류를 나눠요. 물건 가치와 숨은 목표는 서로 달라요.", "제안·수락·결렬 중 고를 수 있어요. 3턴이 지나면 매 턴 가치가 줄어요.", "결렬되면 각자 기본 점수만 받아요. 합의가 결렬보다 나아야 이득이에요."], ctl: "＋/−로 내가 가질 양을 정해 제안하거나, 상대 제안을 수락해요." },
  trap: { name: "다수의 함정", en: "Crowd Trap", icon: "crowd", room: "arena", op: "ori", w: { predict: 0.6, analyze: 0.2, risk: 0.2 }, min: 2,
    desc: "군중의 선택을 예측해요", how: ["40명의 참가자와 동시에 골라요. 라운드마다 이기는 규칙이 달라요.", "다수 맞히기 · 소수파 · 두 번째 인기 · 평균의 2/3 맞히기가 나와요.", "지난 라운드를 보고 군중의 쏠림을 읽어요."], ctl: "선택지를 누르거나 숫자를 정해요. PC는 숫자키." },
  maze: { name: "심리 미로", en: "Mind Maze", icon: "maze", room: "maze", op: "rin", w: { predict: 0.7, analyze: 0.2, risk: 0.1 }, min: 2,
    desc: "상대 이동 경로를 예측해요", how: ["도망자가 출구로 달려요. 갈림길마다 도망자가 고를 칸을 예측해 덫을 놓아요.", "덫은 미로마다 1개뿐이에요. 빗나간 덫은 도망자가 피해 가요.", "도망자는 가짜 출구를 향하는 척할 수 있어요. 아끼다가 확신이 들 때 쓰세요."], ctl: "도망자 옆 칸을 누르거나, 덫을 아끼려면 ‘지켜보기’를 눌러요." },
  fake: { name: "가짜 힌트", en: "Fake Hint", icon: "hint", room: "lab", op: "gold", w: { analyze: 0.7, predict: 0.1, risk: 0.2 }, min: 3,
    desc: "조작된 정보를 찾아내요", how: ["보물은 16칸 중 한 칸에 있어요. 정보원들의 힌트 중 가짜가 섞여 있어요.", "가짜 개수는 화면에 나와요. 그 조건에 맞는 칸은 딱 하나예요.", "가짜 힌트와 보물 칸을 고르세요. 검증권을 쓰면 힌트 하나를 확인할 수 있지만 점수가 줄어요."], ctl: "힌트를 누르고 칸을 누른 뒤 ‘제출’을 눌러요." },
  final: { name: "마지막 심리전", en: "Last Mind Game", icon: "crown", room: "arena", op: "master", w: { predict: 0.25, bluff: 0.2, analyze: 0.1, negotiate: 0.2, risk: 0.25 }, min: 3,
    desc: "모든 기술을 쓰는 결승전", how: ["마스터 AI와 칩 15개로 맞붙어요. 라운드마다 경매·허세·계약·간파 중 하나가 나와요.", "칩이 0이 되거나 7라운드가 끝나면 끝나요. 많이 가진 쪽이 이겨요.", "정밀검사에서는 앞 게임에서 보인 내 습관을 마스터가 참고해요."], ctl: "라운드마다 나오는 버튼을 눌러요. PC는 숫자키." },
  // 멀티 전용 (사람끼리 직접 겨룸)
  mcontract: { name: "배신의 계약 (대결)", en: "Betrayal Pact", icon: "contract", room: "negotiation", op: "vera", group: true, w: { negotiate: 0.5, bluff: 0.2, predict: 0.15, risk: 0.15 }, min: 2,
    desc: "모두 몰래 협력·배신, 동시 공개", how: ["모두 몰래 협력 또는 배신을 고르고, 다 내면 동시에 공개돼요.", "협력자는 협력 인원만큼 나눠 벌어요. 배신자는 더 벌지만, 절반을 넘으면 배신자 모두 0점이에요.", "다음 라운드에 복수당할 수 있어요."], ctl: "협력/배신을 누르면 잠겨요." },
  mtrap: { name: "다수의 함정 (대결)", en: "Crowd Trap", icon: "crowd", room: "arena", op: "ori", group: true, w: { predict: 0.7, analyze: 0.15, risk: 0.15 }, min: 2,
    desc: "가장 많이 고를 답을 맞혀요", how: ["가장 많이 선택될 답을 예측해 골라요.", "마감 전에는 누가 무엇을 골랐는지 아무도 몰라요.", "가장 많이 나온 답을 고른 사람이 점수를 얻어요."], ctl: "답을 누르면 잠겨요." },
  mduel: { name: "블러핑 대결", en: "Bluff Duel", icon: "cards", room: "arena", op: "fox", group: true, w: { bluff: 0.5, predict: 0.4, risk: 0.1 }, min: 2,
    desc: "비밀 카드로 허세와 간파", how: ["각자 다른 비밀 카드(1~9)를 받아요. 내 카드는 나만 봐요.", "‘높음(6 이상)’ 또는 ‘낮음’이라고 선언해요. 거짓말해도 돼요.", "그다음 지정된 상대의 선언이 진실인지 허세인지 판정해요. 맞히면 +2, 내 허세가 속이면 +2."], ctl: "선언 → 판정 순서로 눌러요." },
  mauction: { name: "비밀 경매 (대결)", en: "Secret Auction", icon: "coin", room: "negotiation", op: "gold", group: true, w: { risk: 0.6, predict: 0.4 }, min: 2,
    desc: "참가자끼리 몰래 입찰", how: ["가상 포인트 100으로 물건마다 몰래 입찰해요.", "감정가는 모두 같아요. 가장 높게 쓴 사람이 낙찰돼요.", "감정가 − 낙찰가가 이익이에요. 비기면 아무도 못 가져가요."], ctl: "입찰가를 정하고 ‘봉인’을 눌러요." },
};
export const PLANS = {
  quick: ["liar", "bluff", "rps", "auction", "contract", "trap"],
  full: ["liar", "bluff", "predict", "rps", "auction", "contract", "suspect", "nego", "trap", "maze", "fake", "final"],
};
// 멀티: 라운드 수 선택. group=사람끼리, 나머지=모두 같은 시나리오·같은 AI 조건으로 동시에
export const MULTI_PLANS = {
  m5: ["mtrap", "liar", "mduel", "mauction", "mcontract"],
  m10: ["mtrap", "liar", "mduel", "rps", "mauction", "suspect", "predict", "fake", "maze", "mcontract"],
  m12: ["liar", "mduel", "predict", "rps", "mauction", "mcontract", "suspect", "nego", "mtrap", "maze", "fake", "final"],
};
export const MODE_NAME = { quick: "빠른검사", full: "정밀검사", practice: "연습", m5: "8인 대결 5라운드", m10: "8인 대결 10라운드", m12: "8인 대결 전체" };
export const modeName = (m) => MODE_NAME[m] || m;
export const isMultiMode = (m) => /^m(5|10|12)$/.test(String(m));

// AI 상대 8종 (게임에 배정, 대사·표정은 화면에서)
export const OPPONENTS = {
  dok: { name: "독 수사관", title: "차가운 조사관", col: "#3ee6f0", say: { start: "진술부터 들어볼까요.", win: "제가 먼저 찾았군요.", lose: "…이번엔 인정하죠." } },
  fox: { name: "여우 K", title: "허세의 달인", col: "#ff7a59", say: { start: "패는 표정에 안 써 있어요.", win: "속았네요, 후후.", lose: "어머, 읽혔나?" } },
  ori: { name: "오리 박사", title: "행동 패턴 연구원", col: "#46e08a", say: { start: "데이터는 거짓말을 안 해요.", win: "예측 범위 안이에요.", lose: "흥미로운 이상치군요." } },
  rin: { name: "린", title: "미로의 도망자", col: "#ff5fd2", say: { start: "잡을 수 있으면 잡아 봐요.", win: "또 빗나갔네요!", lose: "어떻게 알았죠?!" } },
  gold: { name: "골드 경", title: "경매장의 주인", col: "#ffd35a", say: { start: "값어치를 아는 분인가요?", win: "제 입찰이 한 수 위였군요.", lose: "좋은 안목이십니다." } },
  vera: { name: "베라", title: "협상 대리인", col: "#9a7bff", say: { start: "서로 좋은 거래를 해 보죠.", win: "계약서는 잘 읽으셔야죠.", lose: "훌륭한 협상이었어요." } },
  bolt: { name: "볼트", title: "경비 로봇", col: "#5aa8ff", say: { start: "규칙을 지키십시오.", win: "계산대로입니다.", lose: "오차를 기록합니다." } },
  master: { name: "마스터 M", title: "심리전 연구소장", col: "#eaf6ff", say: { start: "지금까지의 당신을 다 봤습니다.", win: "역시 예상대로군요.", lose: "…연구소를 맡겨도 되겠어요." } },
  neuro: { name: "미라", title: "안내 연구원", col: "#3ee6f0", say: { start: "연구소에 오신 걸 환영해요.", win: "좋은 데이터예요!", lose: "다음엔 더 잘할 거예요." } },
};

// ---------- 점수식 ----------
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
/** 게임 하나의 점수: 100 × (85% 영역 성과 + 15% 승리) × 난이도 계수 (시간 초과가 많으면 성과가 깎임) */
export function gameScore(gid, perf, win, lv) {
  const w = GAMES[gid].w; let sum = 0;
  for (const a of Object.keys(w)) sum += w[a] * clamp01(perf[a]);
  return Math.min(100, Math.round(100 * (0.85 * sum + 0.15 * (win ? 1 : 0)) * levelOf(lv).mul * 10) / 10);
}
/** 전체 합산 — 영역 점수·종합 점수. results: [{g, perf, win, lv}] */
export function scoreAll(results) {
  const areas = {}, games = {}; let winN = 0, mulSum = 0;
  for (const a of AREAS) {
    let n = 0, d = 0;
    for (const r of results) { const w = GAMES[r.g]?.w?.[a]; if (!w) continue; n += w * clamp01(r.perf?.[a]) * levelOf(r.lv).mul; d += w; }
    areas[a] = d ? Math.min(100, Math.round((n / d) * 100)) : null;
  }
  for (const r of results) { games[r.g] = gameScore(r.g, r.perf || {}, r.win, r.lv); if (r.win) winN++; mulSum += levelOf(r.lv).mul; }
  let wSum = 0, tSum = 0;
  for (const a of AREAS) if (areas[a] != null) { wSum += AREA_WEIGHT[a]; tSum += AREA_WEIGHT[a] * areas[a]; }
  const winPart = results.length ? (winN / results.length) * (mulSum / results.length) * 100 : 0;
  const total = Math.round((wSum ? tSum / wSum : 0) * (1 - WIN_SHARE) + winPart * WIN_SHARE);
  return { total: Math.max(0, Math.min(100, total)), areas, games, wins: winN, n: results.length };
}
export const FORMULA = [
  "게임 점수 = 100 × (85% × 영역 성과 가중 합 + 15% × 승리) × 난이도 계수 (보통 0.90 · 어려움 1.00 · 전문가 1.08, 최대 100)",
  "영역 점수 = 게임별 영역 성과의 가중 평균 × 난이도 계수 × 100 (시나리오 어려움은 게임 안 가중치로 반영)",
  "종합 점수 = 90% × (예측 25% · 블러핑 20% · 분석 25% · 협상 15% · 위험 15%) + 10% × 승률 × 난이도 계수",
  "승률은 종합의 10%뿐이에요. 져도 상대를 잘 읽었거나 위험을 잘 판단했다면 점수를 받아요.",
  "빠른검사·정밀검사·난이도·채점 버전이 다르면 랭킹을 섞지 않아요.",
];
export const DISCLAIMER = "심리전 점수는 이 게임 안의 선택과 가상 칩·포인트로 계산한 오락용 점수예요. 실제 거짓말 탐지 능력이나 심리 상태를 측정·진단하지 않으며, 실제 돈이나 환금 가능한 보상은 쓰지 않아요.";

// ---------- 등급 ----------
export const TIERS = [
  { id: "legend", min: 85, name: "심리전 그랜드마스터", stamp: "S", color: "#ffd35a" },
  { id: "ace", min: 72, name: "연구소 에이스", stamp: "A", color: "#3ee6f0" },
  { id: "good", min: 58, name: "노련한 승부사", stamp: "B", color: "#46e08a" },
  { id: "warm", min: 42, name: "성장 중인 전략가", stamp: "C", color: "#9a7bff" },
  { id: "new", min: 0, name: "순수한 신입", stamp: "D", color: "#ff7a59" },
];
export const tierOf = (t) => TIERS.find((x) => t >= x.min) || TIERS[TIERS.length - 1];

// ---------- 심리전 유형 30종: 1위·2위 영역 조합 20 + 한 영역 몰빵 5 + 고른 형 5 ----------
const T = (id, name, desc, motif, col, npc) => ({ id, name, desc, motif, col, npc });
export const TYPES = [
  T("pr_bl", "심리 해커", "상대의 다음 수를 읽고, 내 수는 안 읽혀요. 판 전체가 내 시나리오예요.", "eye", "#3ee6f0", 3),
  T("pr_an", "행동 분석관", "기록과 패턴에서 답을 찾아요. 두 번 당하는 법이 없어요.", "chart", "#46e08a", 1),
  T("pr_ne", "수읽는 중재자", "상대가 뭘 원하는지 먼저 알고 테이블에 앉아요.", "deal", "#ffd35a", 5),
  T("pr_ri", "타이밍 사냥꾼", "상대가 움직일 순간을 알아채고 그때만 크게 걸어요.", "clock", "#ff7a59", 2),
  T("bl_pr", "포커페이스 사기꾼", "허세를 치면서 상대 반응까지 읽어요. 물론 게임 안에서만요.", "cards", "#ff5fd2", 4),
  T("bl_an", "연막 설계자", "일부러 흘린 정보로 상대의 추론을 원하는 쪽으로 끌고 가요.", "smoke", "#9a7bff", 6),
  T("bl_ne", "달변의 허풍선이", "약속과 허세를 섞어 거래를 내 쪽으로 기울여요.", "mic", "#ff9a4a", 7),
  T("bl_ri", "올인 도박사(가상 칩)", "약한 패로도 크게 지릅니다. 심장이 튼튼해요.", "chip", "#ff4d6d", 0),
  T("an_pr", "인간 CCTV", "작은 모순도 안 놓치고, 다음 행동까지 짚어 내요.", "cctv", "#46e08a", 1),
  T("an_bl", "역추적 공작원", "상대의 거짓을 뜯어보고 그 방식을 그대로 돌려줘요.", "mask", "#7ee05a", 3),
  T("an_ne", "계약서 정독가", "계약서 마지막 줄까지 읽어요. 빈틈은 곧 협상 카드예요.", "contract", "#5aa8ff", 5),
  T("an_ri", "냉정한 감정사", "근거가 모여야 걸어요. 감정가를 절대 넘기지 않아요.", "scale", "#3ee6f0", 2),
  T("ne_pr", "테이블의 지배자", "상대 속내를 읽고 양쪽이 웃는 조건을 내밀어요.", "table", "#ffd35a", 7),
  T("ne_bl", "미소 속의 칼", "웃으며 협력하다가 가장 비싼 순간에 계약을 뒤집어요.", "knife", "#ff5fd2", 4),
  T("ne_an", "조건 설계자", "조건을 쪼개 맞바꾸는 데 능해요. 파이부터 키워요.", "gear", "#46e08a", 6),
  T("ne_ri", "실속파 거래왕", "결렬도 카드로 쓸 줄 알아요. 손해 보는 거래는 안 해요.", "coin", "#ffd35a", 0),
  T("ri_pr", "역배 저격수", "남들과 반대로 갈 때를 압니다. 군중이 쏠리면 웃어요.", "target", "#ff7a59", 2),
  T("ri_bl", "강심장 승부사", "손해가 나도 표정 변화가 없어요. 끝까지 밀어붙여요.", "heart", "#ff4d6d", 3),
  T("ri_an", "손익 계산기", "기댓값이 플러스일 때만 움직여요. 낙찰가는 늘 적정가예요.", "calc", "#5aa8ff", 1),
  T("ri_ne", "안전장치 협상가", "최악을 막아 둔 뒤 협상해요. 잃지 않는 게 특기예요.", "shield", "#46e08a", 5),
  T("only_predict", "예언자", "오직 읽기 하나로 판을 뒤집어요. 상대가 소름 돋을 수준이에요.", "crystal", "#3ee6f0", 6),
  T("only_bluff", "전설의 허세꾼", "무슨 패든 왕의 패처럼 들고 있어요.", "crown", "#ff5fd2", 7),
  T("only_analyze", "모순 수집가", "진술의 틈을 보면 그냥 못 지나쳐요. 탐정 체질이에요.", "glass", "#46e08a", 1),
  T("only_negotiate", "평화 협정 전문가", "싸움 대신 거래로 끝내요. 적도 단골로 만들어요.", "dove", "#ffd35a", 5),
  T("only_risk", "칼날 위의 곡예사", "위험을 숫자로 느껴요. 걸 때와 접을 때가 칼같아요.", "tight", "#ff7a59", 0),
  T("bal_top", "완성형 전략가", "다섯 능력이 모두 높아요. 어느 판에 앉아도 주인공이에요.", "star", "#ffd35a", 3),
  T("bal_good", "만능 플레이어", "빠지는 구석이 없어요. 상대에 맞춰 얼굴을 바꿔요.", "puzzle", "#3ee6f0", 2),
  T("bal_mid", "눈치 빠른 현실파", "크게 튀진 않지만 크게 지지도 않아요. 오래 살아남아요.", "shoe", "#46e08a", 6),
  T("bal_low", "순수 영혼", "속이는 것도 의심도 아직 낯설어요. 사실 그게 무기일 때도 있어요.", "dove2", "#9a7bff", 4),
  T("bal_new", "신입 연구 대상", "연구소가 가장 눈여겨보는 신입이에요. 다음 판이 더 기대돼요.", "beaker", "#ff9a4a", 7),
];
export const typeById = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];
export function typeOf(areas) {
  const list = AREAS.filter((a) => areas?.[a] != null).map((a) => [a, areas[a]]).sort((x, y) => y[1] - x[1]);
  if (!list.length) return typeById("bal_new");
  const vals = list.map((x) => x[1]), hi = vals[0], lo = vals[vals.length - 1], avg = vals.reduce((p, c) => p + c, 0) / vals.length;
  if (hi - lo <= 14) return typeById(avg >= 72 ? "bal_top" : avg >= 55 ? "bal_good" : avg >= 38 ? "bal_mid" : avg >= 20 ? "bal_low" : "bal_new");
  const P = { predict: "pr", bluff: "bl", analyze: "an", negotiate: "ne", risk: "ri" };
  if (list.length > 1 && hi - vals[1] >= 22) return typeById(`only_${list[0][0]}`);
  return typeById(`${P[list[0][0]]}_${P[list[1]?.[0] || list[0][0]]}`);
}

// ---------- 결과 멘트 150종 (영역 5 × 높음·보통·낮음 3 × 10개) ----------
export const COMMENTS = {
  predict: {
    hi: ["상대가 입을 떼기 전에 다음 수를 알고 있었어요.", "오리 박사가 당신 기록을 논문에 쓰고 싶대요.", "이 정도면 상대 머릿속에 세 들어 살고 있어요.", "패턴이 보이면 망설이지 않았어요. 소름 주의.", "AI가 전략을 바꾸자마자 바로 따라갔어요.", "예측 적중률이 수상할 정도로 높아요. 칭찬이에요.", "상대의 습관을 메모장 없이 외우는 타입이에요.", "미로의 도망자가 당신 이름을 듣고 도망갔어요.", "‘그럴 줄 알았어’가 허세가 아닌 드문 사람이에요.", "한 수 앞이 아니라 두 수 앞을 봤어요."],
    mid: ["읽을 때는 잘 읽는데 가끔 내 생각에 빠져요.", "패턴을 알아채는 데 몇 판이 더 필요했어요.", "초반 예측은 흔들려도 후반에 따라잡았어요.", "감이 나쁘지 않아요. 기록을 보면 더 좋아져요.", "상대가 전략을 바꾸면 한 박자 늦었어요.", "반은 읽고 반은 찍은 것 같아요. 아주 사람다워요.", "결정적인 순간에 예측이 살아났어요.", "상대를 보는 눈이 슬슬 뜨이는 중이에요.", "맞힐 땐 멋졌고 틀릴 땐 더 멋있었어요. 아마도요.", "조금만 더 의심하면 다음 등급이 보여요."],
    lo: ["상대가 뭘 낼지 전혀 궁금하지 않았던 것 같아요.", "오늘의 예측은 대부분 소원에 가까웠어요.", "상대는 같은 수를 계속 뒀는데 못 알아챘어요. 괜찮아요.", "기록 칸을 한 번만 봐 주세요. 답이 적혀 있었어요.", "찍기 운도 오늘은 휴가를 갔어요.", "상대가 당황했어요. 너무 안 읽혀서가 아니라 너무 안 읽어서요.", "예측보다 믿음으로 플레이하셨군요.", "다음엔 상대 직전 행동부터 봐 보세요.", "AI가 일부러 쉽게 해 줬는데도 스쳐 갔어요.", "다행히 현실은 객관식이 아니에요."],
  },
  bluff: {
    hi: ["약한 패로 상대를 세 번이나 접게 만들었어요. 게임 안에서만 그러세요.", "표정 없는 용의자도 당신 표정은 못 읽어요.", "AI가 당신 패턴 분석을 포기했어요.", "허세와 진심을 섞는 비율이 예술이에요.", "상대가 콜할 때마다 손이 떨렸을 거예요.", "여우 K가 스카우트 제안을 보냈어요.", "읽히지 않는 게 이렇게 무서운 재능이에요.", "내 손 패가 뭐든 상관없어 보였어요.", "속인 뒤 표정 관리까지 완벽했어요. 아마도요.", "방송에서 하면 채팅창이 뒤집어질 플레이예요."],
    mid: ["가끔 지른 허세가 제법 통했어요.", "좋은 패일 때 티가 조금 나요.", "허세를 치긴 하는데 타이밍이 절반쯤 맞아요.", "AI가 패턴을 반쯤 읽었어요. 조금만 더 섞어 봐요.", "강할 때 약한 척, 약할 때 강한 척을 슬슬 배우는 중이에요.", "한 방은 있어요. 그 한 방을 더 비싸게 써 봐요.", "정직한 베팅이 많아요. 양심은 합격이에요.", "지른 횟수에 비해 성공률이 나쁘지 않아요.", "상대가 한 번쯤은 진심으로 고민했어요.", "포커페이스 수련 중이에요. 거울 앞에서 연습해 봐요."],
    lo: ["패가 좋으면 베팅, 나쁘면 체크. 너무 투명해요.", "AI가 당신 손패를 보는 줄 알았어요. 안 봤는데도요.", "허세라는 단어를 오늘 처음 본 사람처럼 플레이했어요.", "같은 손을 연달아 내서 AI가 민망해했어요.", "정직함은 미덕이지만 이 방에서는 약점이에요.", "약속을 지키는 건 좋지만 전부 지켰네요.", "상대가 당신 수를 받아쓰기하고 있었어요.", "한 번쯤 크게 질러 봐요. 가상 칩이잖아요.", "속이는 일엔 재능이 없어요. 인생엔 좋은 소식이에요.", "오늘의 표정 관리: 전부 입 밖으로 나왔어요."],
  },
  analyze: {
    hi: ["진술 네 줄에서 모순을 바로 집어냈어요.", "독 수사관이 자기 자리를 걱정하기 시작했어요.", "가짜 힌트가 당신 앞에서 진땀을 흘렸어요.", "단서를 거의 안 열고도 범인을 찾았어요.", "시간표와 이동 거리를 머릿속으로 맞췄어요.", "숫자와 말이 안 맞는 곳을 귀신같이 찾아요.", "증거 보드를 읽는 속도가 사람 같지 않아요.", "조작된 정보가 있으면 잠을 못 자는 타입이에요.", "거짓말쟁이 수까지 계산에 넣었어요. 깔끔해요.", "이 영역은 연구소도 할 말이 없어요."],
    mid: ["쉬운 모순은 잘 찾고, 이동 시간 계산에서 흔들렸어요.", "근거를 찾으면 정확한데 시간이 조금 모자랐어요.", "단서를 열면 정답률이 확 올랐어요. 자신감만 더하면 돼요.", "진술을 끝까지 읽으면 맞히고, 급하면 틀렸어요.", "힌트 하나만 잘못 믿으면 판이 기울었어요.", "기본기는 탄탄해요. 어려운 사건에서 한 번 더 확인해 봐요.", "증거와 진술을 나란히 놓는 습관이 생기고 있어요.", "반쯤 탐정이에요. 나머지 반은 내일 출근해요.", "모순을 찾고도 확신을 못 걸었어요.", "경험이 쌓이면 금방 올라갈 영역이에요."],
    lo: ["증거 보드를 배경 그림으로 보신 것 같아요.", "진술이 다 그럴듯해 보였군요. 착한 분이에요.", "가짜 힌트가 오늘 아주 뿌듯해해요.", "시간표를 먼저 보면 절반은 풀려요.", "독 수사관이 조용히 돋보기를 건넸어요.", "범인이 수사 협조 감사패를 준비하고 있어요.", "단서를 열어도 괜찮아요. 점수보다 범인이 먼저예요.", "시간 초과가 가장 큰 범인이었어요.", "읽기 전에 눌렀어요. 손이 더 빨랐어요.", "다음 판엔 숫자가 나오는 증거부터 봐 보세요."],
  },
  negotiate: {
    hi: ["상대도 웃고 나도 남는 거래를 만들었어요.", "베라가 ‘이 사람과는 계약서를 두 번 읽겠다’고 했어요.", "협력으로 판을 키우고 끝에 몫을 챙겼어요.", "결렬 카드를 쥐고도 먼저 꺼내지 않았어요.", "숨은 목표를 들키지 않고 손에 넣었어요.", "상대 유형을 파악하고 바로 태도를 바꿨어요.", "약속의 무게를 아주 정확히 저울질해요.", "협상 테이블이 당신 집 식탁 같아 보여요.", "상대에게 내준 건 값싼 것뿐이었어요.", "이 정도면 휴전 협정도 맡겨 볼 만해요."],
    mid: ["좋은 거래도 있었고 너무 빨리 수락한 거래도 있었어요.", "협력은 잘하는데 마지막 양보가 조금 컸어요.", "복수는 확실한데 용서가 조금 늦어요.", "제안을 한두 번 더 밀어 봐도 괜찮았어요.", "상대 속내를 절반쯤 파악했어요.", "결렬이 무서워서 합의한 순간이 보였어요.", "신뢰를 쌓는 건 잘해요. 그걸 쓰는 법만 남았어요.", "양쪽 다 나쁘지 않은 결론이에요. 조금 아쉬울 뿐.", "협상 근육이 붙는 중이에요.", "숨은 목표를 조금만 더 숨기면 좋아요."],
    lo: ["첫 제안을 바로 수락했어요. 상대가 놀랐어요.", "양보가 너무 후해서 베라가 미안해했어요.", "협력하자는 말을 믿고 끝까지 당했어요.", "반대로 전부 배신해서 판이 다 말라 버렸어요.", "결렬로 둘 다 빈손이 됐어요. 깨끗하긴 해요.", "제안 칸의 ＋/− 버튼도 한 번 눌러 봐요.", "상대가 뭘 원하는지 궁금해하지 않았어요.", "협상이라기보다 기부에 가까웠어요.", "약속이 공짜인 걸 몰랐거나, 너무 잘 알았어요.", "다음엔 한 번만 더 버텨 보세요. 상대가 먼저 움직여요."],
  },
  risk: {
    hi: ["걸어야 할 때만 크게 걸었어요. 가상 칩이 편안해해요.", "낙찰가가 감정가를 넘은 적이 거의 없어요.", "확신이 있을 때만 크게 확신했어요. 무서운 절제예요.", "군중이 쏠릴 때 조용히 반대로 갔어요.", "덫을 함부로 안 쓰고 결정적인 칸에 놓았어요.", "손해를 작게 끊고 이익은 길게 가져갔어요.", "칩 관리가 은행 금고 수준이에요.", "무리한 콜이 하나도 없어요. 재미는 좀 없지만 강해요.", "기댓값을 몸으로 느끼는 사람이에요.", "골드 경이 당신에게는 물건을 안 팔겠대요."],
    mid: ["대체로 침착했는데 한 번씩 크게 지르고 후회했어요.", "낙찰은 잘 받는데 가끔 좀 비싸게 샀어요.", "확신도를 조금 더 솔직하게 써 봐요.", "폴드를 조금만 일찍 했다면 칩이 남았어요.", "조심할 때와 지를 때가 절반쯤 맞았어요.", "큰 실수는 없어요. 큰 한 방도 없어요.", "덫을 초반에 써 버린 미로가 있었어요.", "위험 감각이 자리 잡는 중이에요.", "한 번만 더 계산했다면 이겼을 판이 있어요.", "칩이 오르락내리락, 심박수도 함께했어요."],
    lo: ["일단 지르고 생각하는 분이에요. 가상 칩이라 다행이에요.", "감정가보다 비싸게 사는 데 재능이 있어요.", "모든 판에 크게 확신했어요. 확신만은 1등이에요.", "칩이 사라지는 속도가 연구소 기록이에요.", "반대로 한 번도 안 걸었어요. 안전하긴 했어요.", "시간을 다 써 놓고 마지막에 급히 눌렀어요.", "덫 세 개를 첫 세 턴에 모두 썼어요. 시원했어요.", "질 때 크게 지고 이길 때 작게 이겼어요.", "실제 돈이 아니라서 정말 다행이에요.", "다음엔 베팅 전에 한 번만 패를 다시 봐요."],
  },
};
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const hashSeed = hash;
export const commentCount = () => AREAS.reduce((n, a) => n + COMMENTS[a].hi.length + COMMENTS[a].mid.length + COMMENTS[a].lo.length, 0);
const band = (v) => (v >= 66 ? "hi" : v >= 38 ? "mid" : "lo");

// ---------- 칭호 ----------
export const TITLES = [
  { id: "liar_hunter", name: "거짓말 사냥꾼(게임 한정)", desc: "거짓말 탐지실 90점 이상", test: (x) => x.games.liar >= 90 * (x.mul || 1) },
  { id: "bluff_king", name: "허세왕", desc: "블러핑 영역 80점 이상", test: (x) => x.areas.bluff >= 80 },
  { id: "seer", name: "예언자의 눈", desc: "상대 예측력 80점 이상", test: (x) => x.areas.predict >= 80 },
  { id: "auditor", name: "진술 감사관", desc: "정보 분석 80점 이상", test: (x) => x.areas.analyze >= 80 },
  { id: "dealmaker", name: "딜메이커", desc: "협상 전략 80점 이상", test: (x) => x.areas.negotiate >= 80 },
  { id: "ice_blood", name: "얼음 심장", desc: "위험 판단 80점 이상", test: (x) => x.areas.risk >= 80 },
  { id: "hard_clear", name: "고수 돌파자", desc: "어려움 이상에서 절반 이상 승리", test: (x) => x.lv >= 2 && x.wins * 2 >= x.n },
  { id: "sweep", name: "전승 연구원", desc: "모든 게임 승리", test: (x) => x.n >= 5 && x.wins === x.n },
  { id: "no_timeout", name: "칼같은 결단", desc: "시간 초과 0회", test: (x) => x.n >= 5 && x.timeouts === 0 },
  { id: "balanced", name: "오각형 인간", desc: "다섯 영역 모두 60점 이상", test: (x) => AREAS.every((a) => x.areas[a] == null || x.areas[a] >= 60) && x.total >= 60 },
  { id: "underdog", name: "역전의 명수", desc: "승리는 적어도 종합 60점 이상", test: (x) => x.n >= 5 && x.wins * 2 < x.n && x.total >= 60 },
  { id: "pacifist", name: "평화주의자", desc: "배신의 계약에서 끝까지 협력", test: (x) => x.flags?.allCooperate },
  { id: "traitor", name: "배신의 아이콘", desc: "약속하고 어겨서 이득 3회 이상", test: (x) => (x.flags?.betrayGain || 0) >= 3 },
  { id: "final_boss", name: "연구소장을 넘은 자", desc: "어려움 이상 마지막 심리전 승리", test: (x) => x.lv >= 2 && x.flags?.finalWin },
  { id: "first_step", name: "첫 번째 피험자", desc: "검사 완료", test: () => true },
];

/** 진단 — 점수에서 유형·멘트·칭호·강점/약점 */
export function diagnose({ results, seed = 1, prev = null, rank = null, of = null }) {
  const sc = scoreAll(results);
  const type = typeOf(sc.areas), tier = tierOf(sc.total);
  const valid = AREAS.filter((a) => sc.areas[a] != null).sort((a, b) => sc.areas[b] - sc.areas[a]);
  const best = valid[0] || null, worst = valid[valid.length - 1] || null;
  const opinion = [];
  for (const a of [best, worst, valid[1]]) {
    if (!a || opinion.some((o) => o.a === a)) continue;
    const list = COMMENTS[a][band(sc.areas[a])];
    opinion.push({ a, t: list[(seed + hash(a)) % list.length] });
  }
  const lv = results[0]?.lv ?? 1;
  const timeouts = results.reduce((n, r) => n + (r.timeouts || 0), 0);
  const flags = Object.assign({}, ...results.map((r) => r.flags || {}));
  const x = { ...sc, lv, timeouts, flags, mul: levelOf(lv).mul };
  const titles = TITLES.filter((t) => { try { return t.test(x); } catch { return false; } }).map((t) => ({ id: t.id, name: t.name, desc: t.desc }));
  return {
    total: sc.total, areas: sc.areas, games: sc.games, wins: sc.wins, n: sc.n, lv,
    type: { id: type.id, name: type.name, desc: type.desc }, tier: { id: tier.id, name: tier.name, stamp: tier.stamp, color: tier.color },
    best, worst, opinion: opinion.map((o) => o.t), titles: titles.slice(0, 5), timeouts,
    prevDelta: prev ? sc.total - prev.total : null, rank, of,
  };
}
export const CODES = { types: TYPES.length };

// ---------- 스트리머 모드 문제 은행 (허구의 가상 포인트만) ----------
// kind: vote(실시간 심리전 투표) · streamer(스트리머 행동 예측) · majority(다수 선택 맞히기) · know(시청자를 얼마나 아는가)
export const BC_QUESTIONS = [
  { q: "가상 100만 포인트를 혼자 다 갖기 vs 시청자 모두와 나눠 갖기", o: ["혼자 다 갖는다", "나눠 갖는다"] },
  { q: "동료가 몰래 배신을 제안해요. 당신은?", o: ["같이 배신한다", "거절하고 신고한다", "거절만 한다"] },
  { q: "상금 게임 결승. 상대가 ‘우리 반씩 나누자’고 해요.", o: ["믿고 나눈다", "믿는 척 배신한다", "처음부터 거절"] },
  { q: "가상 동전 던지기. 확실한 50P vs 50% 확률로 120P", o: ["확실한 50P", "50%로 120P"] },
  { q: "약속을 어기면 가상 500P. 아무도 모른다면?", o: ["어긴다", "지킨다"] },
  { q: "포커에서 최악의 패를 받았어요. 당신은?", o: ["바로 접는다", "크게 허세", "작게 간 보기"] },
  { q: "팀원이 실수로 내 몫까지 가져갔어요.", o: ["바로 말한다", "모른 척 넘어간다", "다음에 되갚는다"] },
  { q: "무료 입장 경매. 감정가 100P 물건에 얼마까지?", o: ["50P 이하", "51~90P", "91~100P", "100P 초과도 OK"] },
  { q: "가장 믿을 수 없는 말은?", o: ["‘진짜 마지막이야’", "‘이번엔 진짜야’", "‘나만 믿어’", "‘손해 안 봐’"] },
  { q: "게임에서 지면 나는…", o: ["한 판 더!", "조용히 종료", "남 탓 먼저", "분석 시작"] },
  { q: "협상 상대가 먼저 큰 양보를 해 왔어요.", o: ["고맙게 받는다", "뭔가 수상하다", "더 요구한다"] },
  { q: "무인도에 시청자 한 명만 데려간다면 기준은?", o: ["생존 능력", "입담", "요리", "나를 안 배신할 것"] },
  { q: "이 방송에서 가장 허세가 심한 사람은?", o: ["스트리머", "채팅창", "매니저", "나"] },
  { q: "가상 복권: 10P로 1% 확률 800P, 사겠어요?", o: ["산다", "안 산다"] },
  { q: "다수결 게임에서 내 선택 기준은?", o: ["내 소신", "남들이 고를 것", "남들 반대", "찍기"] },
  { q: "친구가 내 비밀을 말해 버렸어요.", o: ["바로 따진다", "똑같이 갚는다", "그냥 넘어간다"] },
  { q: "게임 칩이 절반 남았어요. 다음 판은?", o: ["올인", "절반만", "아주 조금", "기권"] },
  { q: "거짓말을 들켰을 때 제일 많이 쓰는 말은?", o: ["‘장난이었어’", "‘오해야’", "‘미안해’", "‘증거 있어?’"] },
  { q: "상대가 ‘나 패 안 좋아’라고 해요. 믿나요?", o: ["믿는다", "반대로 믿는다", "무시한다"] },
  { q: "가상 500P를 지금 받기 vs 내일 800P 받기", o: ["지금 500P", "내일 800P"] },
  { q: "팀 게임 결승에서 한 명을 빼야 한다면?", o: ["가장 약한 사람", "가장 수상한 사람", "나", "못 뺀다"] },
  { q: "방송에서 들키면 안 되는 비밀이 있다면 방법은?", o: ["끝까지 잡아뗀다", "먼저 웃으며 고백", "화제를 돌린다"] },
  { q: "심리전에서 가장 강한 무기는?", o: ["침묵", "웃음", "질문", "자신감"] },
  { q: "최종 2인. 가상 상금을 어떻게 할까요?", o: ["공평하게", "실력대로 몰아주기", "가위바위보"] },
  { q: "수상한 카드 두 장. 어떤 걸 고를까요?", o: ["많이 추천받은 카드", "아무도 안 고른 카드"] },
  { q: "회의에서 틀린 의견이 대세가 됐어요.", o: ["바로 반박", "조용히 따른다", "나중에 따로 말한다"] },
  { q: "가상 칩 게임에서 연승 중. 다음 판은?", o: ["더 크게", "그대로", "줄인다", "그만둔다"] },
  { q: "게임 친구가 3연패 중. 나는?", o: ["일부러 져 준다", "더 세게 이긴다", "훈수 둔다"] },
  { q: "한 번만 쓸 수 있는 능력이라면?", o: ["상대 패 보기", "내 패 바꾸기", "상대 입 막기", "시간 되돌리기"] },
  { q: "시청자 전원이 배신하면 스트리머는 어떻게 될까요?", o: ["복수한다", "운다", "같이 배신했을 것", "이미 예상했다"] },
  { q: "수수께끼 상자: 그냥 100P vs 열어 보기(0~300P)", o: ["그냥 100P", "열어 본다"] },
  { q: "게임 규칙의 허점을 발견했어요.", o: ["몰래 쓴다", "운영자에게 알린다", "자랑한다"] },
];
export const BC_KINDS = {
  vote: { name: "실시간 심리전 투표", desc: "시청자가 투표하고, 스트리머는 가장 많이 나올 답을 예측해요" },
  streamer: { name: "스트리머 행동 예측", desc: "스트리머가 먼저 몰래 고르고, 시청자가 맞혀요" },
  majority: { name: "다수 선택 맞히기", desc: "시청자는 가장 많이 고를 답을 예측해요. 다수에 들면 점수" },
  know: { name: "서로 얼마나 알까?", desc: "스트리머는 시청자 비율을 맞히고, 시청자는 스트리머 선택을 맞혀요" },
};
