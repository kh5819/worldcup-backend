// =========================
// 막아막아 — 스테이지 / 캐릭터(유닛) / 몬스터 데이터
// 서버 전용 정의. 클라이언트는 id 만 받아 자체 표(이름/이모지)로 표시한다.
// 좌표는 [row, col]. 몬스터/바위는 90° 회전 대칭 배치(4면 공평).
// =========================

// 몬스터가 없는 정통 규칙 (옵션 stages=1)
export const CLASSIC_STAGE = {
  id: "classic", name: "클래식", emoji: "🧱", desc: "몬스터 없는 정통 규칙",
  rocks: [], portals: [], monsters: [],
};

// 스테이지 모드 (옵션 stages=3): 1 → 2 → 3 순서
export const STAGES = [
  {
    id: "field", name: "슬라임 초원", emoji: "🌿",
    desc: "말랑한 슬라임이 보드를 돌아다녀요",
    rocks: [], portals: [],
    monsters: [
      { type: "slime", row: 3, col: 3 }, { type: "slime", row: 3, col: 5 },
      { type: "slime", row: 5, col: 5 }, { type: "slime", row: 5, col: 3 },
    ],
  },
  {
    id: "canyon", name: "바위 협곡", emoji: "🪨",
    desc: "바위는 지나갈 수 없어요. 박쥐·거미, 그리고 보스 화염룡!",
    rocks: [[4, 4], [4, 2], [2, 4], [4, 6], [6, 4]],
    portals: [],
    monsters: [
      { type: "bat", row: 2, col: 2 }, { type: "bat", row: 2, col: 6 },
      { type: "bat", row: 6, col: 6 }, { type: "bat", row: 6, col: 2 },
      { type: "spider", row: 3, col: 3 }, { type: "spider", row: 5, col: 5 },
      { type: "dragon", row: 5, col: 4, boss: true },
    ],
  },
  {
    id: "maze", name: "순간이동 미궁", emoji: "🌀",
    desc: "포탈을 밟으면 반대편으로! 유령·골렘, 그리고 보스 거인왕!",
    rocks: [[4, 4]],
    portals: [[[2, 2], [6, 6]], [[2, 6], [6, 2]]],
    monsters: [
      { type: "ghost", row: 2, col: 4 }, { type: "ghost", row: 4, col: 6 },
      { type: "ghost", row: 6, col: 4 }, { type: "ghost", row: 4, col: 2 },
      { type: "golem", row: 3, col: 5 }, { type: "golem", row: 5, col: 3 },
      { type: "giant", row: 4, col: 3, boss: true },
    ],
  },
];

// skill.target: "cell"(칸 선택) | "wall"(설치된 벽 선택) | "none"(대상 없음)
export const UNITS = {
  ranger:  { name: "레인저",   emoji: "🏹", desc: "균형형 · 벽 +1", wallBonus: 1, skill: null },
  knight:  { name: "기사",     emoji: "🛡️", desc: "벽 +2 · 몬스터 기절 면역", wallBonus: 2, immuneStun: true, skill: null },
  sprinter:{ name: "질주자",   emoji: "🏃", desc: "돌진: 직선 2칸 이동", wallBonus: 0, skill: { id: "dash",  name: "돌진",     target: "cell" } },
  mage:    { name: "마법사",   emoji: "🔮", desc: "순간이동: 반경 2칸 어디든 (벽 무시)", wallBonus: 0, skill: { id: "blink", name: "순간이동", target: "cell" } },
  breaker: { name: "파괴자",   emoji: "🔨", desc: "벽 파괴: 설치된 벽 1개 제거", wallBonus: 0, skill: { id: "smash", name: "벽 파괴",  target: "wall" } },
  ninja:   { name: "닌자",     emoji: "🥷", desc: "벽 통과: 벽 너머 인접 칸으로", wallBonus: 0, skill: { id: "phase", name: "벽 통과",  target: "cell" } },
  thief:   { name: "도적",     emoji: "🏴‍☠️", desc: "벽 훔치기: 상대 벽 2개를 내 것으로", wallBonus: 0, skill: { id: "steal", name: "벽 훔치기", target: "none" } },
  frost:   { name: "빙결술사", emoji: "🧊", desc: "빙결: 3칸 이내 적 1턴 정지", wallBonus: 0, skill: { id: "freeze", name: "빙결", target: "cell" } },
  bomber:  { name: "폭파병",   emoji: "💣", desc: "넉백: 인접한 적을 한 칸 밀어내기", wallBonus: 0, skill: { id: "knock", name: "넉백",     target: "cell" } },
  builder: { name: "건축가",   emoji: "🏗️", desc: "이중 설치: 이번 턴 벽 2개 설치", wallBonus: 0, skill: { id: "dwall", name: "이중 설치", target: "none" } },
  trapper: { name: "함정사",   emoji: "🪤", desc: "함정: 2칸 이내에 설치, 밟은 적 기절", wallBonus: 0, skill: { id: "trap",  name: "함정",     target: "cell" } },
};
export const UNIT_IDS = Object.keys(UNITS);
export const DEFAULT_UNIT = "ranger";

// ai: random(무작위 1칸) | chase(가장 가까운 말을 추적) | guard(제자리)
// every: N번째 틱마다 이동, steps: 이동 칸 수, stun: 접촉 시 기절 턴, wallPass: 벽 통과
// special: { every, kind } 보스 고유 패턴
export const MONSTER_DEFS = {
  slime:  { name: "슬라임", emoji: "🟢", ai: "random", steps: 1, every: 1, stun: 0 },
  bat:    { name: "박쥐",   emoji: "🦇", ai: "chase",  steps: 2, every: 1, stun: 1 },
  spider: { name: "거미",   emoji: "🕷️", ai: "guard",  steps: 0, every: 1, stun: 1 },
  ghost:  { name: "유령",   emoji: "👻", ai: "chase",  steps: 1, every: 1, stun: 1, wallPass: true },
  golem:  { name: "골렘",   emoji: "🗿", ai: "chase",  steps: 1, every: 2, stun: 2 },
  dragon: { name: "화염룡", emoji: "🐉", ai: "chase",  steps: 1, every: 1, stun: 1, boss: true, special: { every: 3, kind: "fire" } },
  giant:  { name: "거인왕", emoji: "👹", ai: "chase",  steps: 1, every: 1, stun: 1, boss: true, special: { every: 3, kind: "quake" } },
};
export const MONSTER_TYPES = Object.keys(MONSTER_DEFS);

export const BOT_NAMES = ["로봇 아리", "로봇 볼트", "로봇 코코", "로봇 디디", "로봇 에코", "로봇 핀", "로봇 지지"];
