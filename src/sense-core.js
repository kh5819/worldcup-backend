// =========================
// 플듀 게임 센스 진단소 — 서버·화면 공용 (js/sense/sense-core.js 와 똑같아야 함: test-sense가 검사)
// 검사(시즌 2는 10종): 시드로 문제 생성(genSpec) → 화면은 입력만 기록(log) → 서버가 같은 규칙으로 다시 채점(scoreTest)
// 같은 시드 + 같은 입력 = 같은 점수 (결정적). 빠르게 누르기·찍기·반복으로는 점수가 안 오르게 설계
// 점수는 플레이듀오 게임 안의 능력 지표이며 실제 게임 실력·심리 능력을 인증하지 않음
// =========================
// s2 (2026-11-26 리뉴얼): 고르기형(정답이 애매한) 검사 빼고 손으로 하는 검사 10종으로. 규칙 한 줄 · 30초 안팎 · 라운드 4~5번
// 랭킹·순위·분포는 같은 SET_VERSION 기록끼리만 (예전 s1 기록은 지우지 않고 내 기록에 남음)
export const CORE_VERSION = 2;
export const SET_VERSION = "s2";

export function rng(seed) { let a = (seed >>> 0) || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const c01 = (v) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
const ri = (r, n) => Math.floor(r() * n);
const pick = (r, a) => a[ri(r, a.length)];
const shuffle = (r, a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = ri(r, i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const num = (v) => (Number.isFinite(+v) ? +v : NaN);
const arr = (v) => (Array.isArray(v) ? v : []);
/** 무작위·대충 하는 수준(base)을 0점, 완벽을 1로 다시 맞춤 */
const norm = (v, base) => c01((v - base) / (1 - base));

// ---------- 능력 6영역 ----------
export const AREAS = ["situ", "strat", "combat", "info", "crisis", "multi"];
export const AREA_NAME = { situ: "상황 판단력", strat: "전략적 사고력", combat: "전투 운영 능력", info: "정보 처리 능력", crisis: "위기 대응 능력", multi: "멀티태스킹 능력" };
export const AREA_SHORT = { situ: "판단", strat: "전략", combat: "전투", info: "정보", crisis: "위기", multi: "멀티" };
export const AREA_COL = { situ: "#3ee6f0", strat: "#9775fa", combat: "#ff6078", info: "#46e08a", crisis: "#f4c76a", multi: "#5aa8ff" };

// ---------- 검사 ----------
const T = (name, en, icon, abil, dur, desc, how, ctl) => ({ name, en, icon, abil, dur, desc, how, ctl });
// dur = 검사가 걸릴 수 있는 최대 시간(ms). 라운드형은 라운드 수 × (고민 제한 + 결과 연출) — 멀티 마감 시각에 씀
export const TESTS = {
  // ----- s2 검사 10종 (손으로 하는 검사) -----
  boss: T("보스 패턴 피하기", "Boss Dodge", "skull", { crisis: 0.6, info: 0.4 }, 36000, "빨간 칸을 피해 안전한 칸으로", ["보스가 때릴 칸이 빨갛게 표시돼요.", "떨어지기 전에 안전한 칸으로 옮기세요. 뒤로 갈수록 빨라져요."], "←→ 키 · 칸 누르기"),
  minimap: T("미니맵 경보", "Minimap Alert", "radar", { info: 0.6, multi: 0.4 }, 30000, "광석을 캐면서 미니맵도 보기", ["반짝이는 광석을 눌러 캐세요.", "미니맵에서 적(빨강)이 우리 타워에 붙으면 그 줄 경보를 누르세요."], "광석 누르기 · 경보: 1·2·3 키 또는 버튼"),
  snipe: T("타깃 저격", "Target Snipe", "target", { combat: 0.5, situ: 0.3, strat: 0.2 }, 30000, "다가오는 적을 닿기 전에", ["빨간 적이 내려와요. 닿기 전에 눌러서 잡으세요.", "파란 아군은 누르면 안 돼요. 번개 표시는 빠른 적이에요."], "적 누르기 · 클릭"),
  fake: T("페이크 간파", "Feint Read", "shield", { crisis: 0.5, situ: 0.5 }, 30000, "진짜 공격만 막아요", ["적이 칼을 휘두르는 척해요.", "무기가 빛날 때만 막기! 빛나지 않으면 가짜예요."], "스페이스 · 막기 버튼"),
  tug: T("교전 타이밍", "Engage Timing", "sword", { situ: 0.5, strat: 0.5 }, 42000, "가장 유리한 순간에 돌격", ["가운데 힘겨루기 막대가 왔다 갔다 해요.", "파랑(우리)이 가장 넓게 밀어붙였을 때 돌격! 라운드마다 한 번만."], "돌격 버튼 · 스페이스"),
  multitask: T("멀티태스킹 지휘관", "Multitask Commander", "grid", { multi: 0.7, crisis: 0.3 }, 30000, "세 칸을 동시에 챙겨요", ["세 칸 중 빨갛게 깜빡이는 칸을 눌러 처리하세요.", "아무 일 없는 칸을 누르면 실수예요."], "칸 누르기 · 1·2·3 키"),
  cooldown: T("스킬 타이밍", "Skill Timing", "clock", { combat: 0.6, strat: 0.4 }, 30000, "막을 때 막고, 칠 때 치기", ["보스가 빨갛게 돌진을 준비하면 막기.", "금색 약점이 보이면 필살기! 아무 때나 누르면 감점이에요."], "막기 W · 필살기 E · 버튼"),
  teamfight: T("한타 각 포착", "Teamfight Window", "burst", { combat: 0.4, strat: 0.4, situ: 0.2 }, 27000, "적이 가장 많이 모인 곳에 한 방", ["적들이 모였다 흩어져요.", "가장 많이 겹칠 때 그 자리를 누르세요. 라운드마다 한 번만."], "전장 누르기"),
  overload: T("정보 과부하", "Info Overload", "bell", { info: 0.5, multi: 0.5 }, 30000, "중요한 알림만 골라 누르기", ["알림이 쏟아져요. 빨간 위험 알림만 눌러요.", "회색 알림을 누르면 감점이에요."], "알림 누르기"),
  vision: T("시야 기억", "Vision Memory", "eye", { info: 0.5, situ: 0.5 }, 58000, "잠깐 본 적, 한 칸 뒤 어디?", ["적이 잠깐 보였다가 사라져요.", "화살표 쪽으로 1칸 간 자리를 적의 수만큼 누르세요."], "칸 누르기"),
  // ----- s1 검사 (예전 기록 보기용 · 지금 검사에선 안 씀) -----
  engage: T("교전 판단", "Engage Call", "sword", { situ: 0.6, strat: 0.2, crisis: 0.2 }, 90000, "싸울까, 빠질까, 기다릴까", ["양쪽 인원·체력·궁극기·지형을 보고 공격·후퇴·대기를 고르세요.", "전력이 확실히 앞서면 공격, 확실히 밀리면 후퇴가 이득이에요.", "상대 궁극기만 준비됐다면 기다리는 게 나을 수 있어요."], "버튼 또는 1·2·3 키"),
  target: T("타깃 우선순위", "Target Priority", "target", { combat: 0.6, situ: 0.4 }, 90000, "누구부터 잡아야 덜 맞을까", ["적 4명을 처치할 순서를 정하세요. 나는 초당 같은 피해를 줘요.", "살아 있는 적은 계속 나를 때리고, 힐러는 다른 적을 회복시켜요.", "체력 대비 위험한 적부터 잡을수록 받는 피해가 줄어요."], "적을 순서대로 누르기"),
  resource: T("자원 관리", "Resource Plan", "coin", { strat: 0.7, crisis: 0.3 }, 82000, "골드를 어디에 쓸까", ["웨이브 5개를 버텨요. 매 라운드 상점에서 하나를 사거나 아껴요.", "무기는 처치를 빠르게, 방어구는 받는 피해를 줄여요. 물약은 바로 회복해요.", "다음 웨이브를 보고 미리 준비하세요. 끝까지 살아남고 체력이 많을수록 좋아요."], "상점 버튼"),
  path: T("위험한 길 찾기", "Risky Route", "map", { strat: 0.6, situ: 0.4 }, 87000, "목표에 맞는 길을 골라요", ["길마다 걸리는 시간, 위험(실패 확률), 보상이 달라요.", "라운드마다 목표가 달라요: 제한 시간 안 최대 보상 · 생존 우선 · 보상 우선.", "목표에 맞춰 기대 가치가 가장 큰 길을 고르세요."], "길 누르기"),
  comeback: T("역전의 한 수", "Comeback Play", "crown", { strat: 0.5, situ: 0.3, crisis: 0.2 }, 89000, "불리한 판, 최선의 한 수", ["지고 있는 상황이 나와요. 할 수 있는 행동 4개 중 하나를 골라요.", "상황 정보를 보고 역전 확률이 가장 높은 수를 고르세요.", "무리한 한타가 늘 정답은 아니에요."], "선택지 누르기"),
  team: T("팀워크 지휘", "Team Command", "flag", { strat: 0.4, multi: 0.3, situ: 0.3 }, 89000, "팀원 3명에게 명령", ["팀원마다 체력·성향·상황이 달라요.", "공격·방어·지원·후퇴 중 각 팀원에게 맞는 명령을 고르세요.", "겁 많은 팀원에게 무리한 공격, 빈사 팀원에게 공격은 손해예요."], "팀원별 명령 버튼"),
  final: T("최종 종합 시뮬레이션", "Final Simulation", "trophy", { combat: 0.25, crisis: 0.2, multi: 0.25, situ: 0.15, strat: 0.15 }, 75000, "모든 센스를 한 판에", ["보스 전투를 75초 버티며 최대한 많은 피해를 줘요.", "전조 보고 이동 · 약점에 E · 쿨마다 Q · 위험할 때 물약 · 팀원 공격/방어 전환.", "팀원은 보스 약점 때 공격, 큰 공격 전조 때 방어가 좋아요."], "←→ 이동 · Q·E 스킬 · F 물약 · T 팀원 명령"),
};
export const TEST_IDS = Object.keys(TESTS);
export const MODES = {
  quick: { name: "빠른검사", tests: ["boss", "snipe", "fake", "tug", "minimap"], min: 3 },
  full: { name: "정밀검사", tests: ["boss", "minimap", "snipe", "fake", "tug", "multitask", "cooldown", "teamfight", "overload", "vision"], min: 7 },
};
export const modeName = (m) => MODES[m]?.name || (m === "practice" ? "연습" : m);

// ---------- 티어 ----------
export const TIERS = [
  { id: "challenger", min: 980, name: "챌린저", col: "#ffdf7a" }, { id: "grandmaster", min: 930, name: "그랜드마스터", col: "#ff6078" }, { id: "master", min: 850, name: "마스터", col: "#c77dff" },
  { id: "diamond", min: 750, name: "다이아몬드", col: "#7ab8ff" }, { id: "emerald", min: 650, name: "에메랄드", col: "#46e08a" }, { id: "platinum", min: 550, name: "플래티넘", col: "#5ee0c8" },
  { id: "gold", min: 450, name: "골드", col: "#f4c76a" }, { id: "silver", min: 350, name: "실버", col: "#c9d6ff" }, { id: "bronze", min: 200, name: "브론즈", col: "#d08a5a" }, { id: "iron", min: 0, name: "아이언", col: "#8a8f9e" },
];
export const tierOf = (t) => TIERS.find((x) => t >= x.min) || TIERS[TIERS.length - 1];

// =========================================================
// 1) 문제 생성
// =========================================================
const GEN = {
  minimap(r) {
    const ev = [], ores = []; let t = 3000;
    while (t < 27000) { const danger = r() < 0.62; ev.push({ t: Math.round(t), lane: ri(r, 3), danger }); t += 2100 + r() * 2000; }
    for (let k = 0, tt = 1000; tt < 28500; k++, tt += 2200 + r() * 600) ores.push({ id: k, t: Math.round(tt), x: 0.15 + r() * 0.7, y: 0.2 + r() * 0.55 });
    return { dur: 30000, win: 2600, life: 2500, ev, ores };
  },
  engage(r) {
    const sc = [];
    for (let i = 0; i < 8; i++) {
      const n1 = 2 + ri(r, 4), n2 = 2 + ri(r, 4);
      sc.push({ us: Array.from({ length: n1 }, () => 25 + ri(r, 76)), them: Array.from({ length: n2 }, () => 25 + ri(r, 76)), ultUs: r() < 0.45, ultThem: r() < 0.45, terrain: ri(r, 3) - 1, lim: 9000 });
    }
    return { sc };
  },
  target(r) {
    const rounds = [];
    for (let i = 0; i < 6; i++) {
      const en = Array.from({ length: 4 }, (_, k) => ({ hp: 60 + ri(r, 9) * 20, dps: 4 + ri(r, 13), heal: 0, id: k }));
      if (r() < 0.75) { const h = ri(r, 4); en[h].heal = 6 + ri(r, 7); en[h].dps = Math.max(2, Math.round(en[h].dps / 2)); }
      rounds.push({ en, dmg: 40, lim: 12000 });
    }
    return { rounds };
  },
  // s2: 막기(W)·필살기(E) 두 개만. 마나 없음, 버튼마다 0.9초 쿨타임
  cooldown(r) {
    const charges = [], weak = []; let t = 2500;
    while (t < 26500) { if (r() < 0.5) charges.push(Math.round(t)); else weak.push(Math.round(t)); t += 2600 + r() * 1600; }
    if (!charges.length) charges.push(weak.shift()); if (!weak.length) weak.push(charges.pop());
    return { dur: 30000, charges, weak, tell: 1300, weakLen: 2000, shield: 700, cd: 900 };
  },
  // 가만히 한 칸에 서 있어도 잘 피해지면 검사가 안 되므로, 어느 칸에 가만히 있어도 30% 넘게 맞게 될 때까지 다시 만듦
  boss(r) {
    const zones = 5, cols = ["#ff6078", "#f4c76a", "#9775fa", "#3ee6f0", "#46e08a"], shapes = ["slam", "sweep", "ring", "beam", "cross"];
    let out = null;
    for (let tr = 0; tr < 60; tr++) {
      const pats = shuffle(r, [[0, 1], [3, 4], [1, 2, 3], [0, 4], [0, 2, 4], [1, 3], [2, 3, 4], [0, 1, 2]]).slice(0, 5);
      const att = []; let t = 2500, k = 0;
      while (t < 34000) { const p = ri(r, 5), tell = Math.round(clamp(1400 - k * 40, 650, 1400)); att.push({ t: Math.round(t), p, tell }); t += tell + 800 + r() * 600; k++; }
      out = { dur: 36000, zones, start: 2, move: 170, phase2: 18000, pats: pats.map((z, i) => ({ z, col: cols[i], shape: shapes[i] })), att };
      const still = Math.max(...Array.from({ length: zones }, (_, z) => att.filter((a) => !pats[a.p].includes(z)).length / att.length));
      if (still <= 0.7) break;
    }
    return out;
  },
  // s2: 5×5 칸 · 적 2~3명 · 1칸 이동 · 벽 쪽을 보는 적은 없음 · 끝자리가 겹치지 않게
  vision(r) {
    const N = 5, D = [[0, -1], [1, 0], [0, 1], [-1, 0]], rounds = [];
    for (let i = 0; i < 5; i++) {
      const n = i < 2 ? 2 : 3; let en = [];
      for (let tr = 0; tr < 60; tr++) {
        en = []; const used = new Set();
        while (en.length < n) { const x = ri(r, N), y = ri(r, N), k = y * N + x; if (used.has(k)) continue; const ok = [0, 1, 2, 3].filter((d) => { const nx = x + D[d][0], ny = y + D[d][1]; return nx >= 0 && ny >= 0 && nx < N && ny < N; }); used.add(k); en.push({ x, y, d: pick(r, ok) }); }
        if (new Set(en.map((e) => visionEnd(N, e, 1))).size === n) break;
      }
      rounds.push({ en, show: 1600 - i * 80, lim: 8000 });
    }
    return { n: N, steps: 1, rounds };
  },
  resource(r) {
    let best = null;
    for (let tr = 0; tr < 40; tr++) {
      const waves = Array.from({ length: 5 }, (_, i) => { const brute = r() < 0.5; return brute ? { hp: 30 + i * 18 + ri(r, 12), atk: 9 + i * 4 + ri(r, 4), kind: "brute" } : { hp: 60 + i * 34 + ri(r, 16), atk: 5 + i * 2 + ri(r, 3), kind: "tank" }; });
      const s = { gold0: 20, income: 15, waves, shop: { sword: { cost: 12, atk: 4 }, armor: { cost: 12, def: 2 }, potion: { cost: 8, heal: 35 } }, hp0: 100, atk0: 10, def0: 0, lim: 14000, k: 0.4 };
      const b = resourceBounds(s), gap = (b.best - b.cst) / (b.best - b.worst || 1);
      if (!best || gap > best[0]) best = [gap, s];
      if (gap >= 0.35 && b.best > b.worst) break;
    }
    return best[1];
  },
  multitask(r) {
    const ev = [[], [], []];
    for (let p = 0; p < 3; p++) { let t = 1500 + r() * 2000; while (t < 27000) { ev[p].push(Math.round(t)); t += 2600 + r() * 3000; } }
    return { dur: 30000, win: [3000, 3000, 3000], early: [0, 0, 0], ev };
  },
  path(r) {
    const goals = shuffle(r, ["time", "time", "safe", "safe", "loot", "loot"]), rounds = [];
    for (const goal of goals) {
      const n = 3 + ri(r, 2), paths = Array.from({ length: n }, () => ({ time: 5 + ri(r, 11), risk: ri(r, 9) * 5, reward: 20 + ri(r, 9) * 10 }));
      rounds.push({ goal, limit: 10 + ri(r, 4), paths, lim: 12000 });
    }
    return { rounds };
  },
  teamfight(r) {
    const W = 100, H = 60, rounds = [];
    for (let i = 0; i < 4; i++) {
      const cx = 30 + r() * 40, cy = 20 + r() * 20, tc = 1200 + r() * 1800;   // 이 시각쯤 가장 모임
      const en = Array.from({ length: 5 }, () => { const sx = r() * W, sy = r() * H, ex = cx + (r() - 0.5) * 16, ey = cy + (r() - 0.5) * 12; const k = 1 + (r() < 0.4 ? 0.6 : 0); return { sx, sy, ex, ey, k }; });
      rounds.push({ en: en.map((e) => ({ x0: e.sx, y0: e.sy, vx: ((e.ex - e.sx) / tc) * 1000 * e.k, vy: ((e.ey - e.sy) / tc) * 1000 * e.k })), dur: 4200, rad: 12 });
    }
    return { W, H, rounds };
  },
  // s2: 단서 하나만 — 진짜는 무기가 빛남, 가짜는 빛나지 않음(발은 둘 다 내딛음)
  fake(r) {
    const sw = []; let t = 2000;
    while (t < 27500) { const real = r() < 0.55; sw.push({ t: Math.round(t), real, wind: 800, miss: real ? null : "glow" }); t += 1150 + r() * 900; }
    return { dur: 30000, sw, blockWin: 380, cd: 700 };
  },
  // s2: 중요(빨강) / 쓸모없음(회색) 두 가지. 알림 카드를 직접 눌러요 — 기록은 [시각, 알림 번호]
  overload(r) {
    const n = []; let t = 1200, k = 0;
    const NOISE = ["친구가 접속했어요", "상점 할인 중", "채팅: ㅋㅋㅋ", "업적 달성!", "새 스킨 출시", "골드 +5", "핑 32ms", "날씨 맑음", "관전자 +1", "미션 갱신"];
    const WARN = ["아군 위험!", "아군이 습격당함", "미드 아군 고립", "정글러 위험", "오브젝트 등장!", "드래곤 출현", "타워 공격받는 중", "기지 위험!"];
    while (t < 27500) { const warn = r() < 0.4; n.push({ id: k++, t: Math.round(t), type: warn ? "warn" : "noise", txt: warn ? pick(r, WARN) : pick(r, NOISE) }); t += 600 + r() * 700; }
    return { dur: 30000, life: 2800, n };
  },
  comeback(r) {
    const SC = [
      ["골드 -6천, 바론 등장 30초 전", [["바론 몰래 시도", 0.32], ["시야 잡고 끊어 먹기", 0.48], ["정면 한타", 0.18], ["타워 지키며 버티기", 0.3]]],
      ["4대5, 적 핵심 딜러 사망 직후", [["즉시 반격 한타", 0.52], ["후퇴해 정비", 0.24], ["반대편 타워 압박", 0.36], ["딜러 부활까지 대기", 0.2]]],
      ["체력 30%, 상대 2명 추격", [["물약 먹고 싸우기", 0.12], ["좁은 길로 유인", 0.46], ["점멸로 도주", 0.4], ["아군 쪽으로 끌고 가기", 0.55]]],
      ["점수 3:7, 남은 시간 2분", [["전원 정면 돌격", 0.22], ["상대 약한 라인 집중", 0.5], ["수비하며 반격 대기", 0.18], ["오브젝트 하나라도 먹기", 0.34]]],
      ["적이 궁극기 전부 사용, 우리는 2개 남음", [["바로 한타 열기", 0.58], ["궁극기 아끼고 후퇴", 0.16], ["오브젝트 먼저", 0.4], ["시야만 잡기", 0.22]]],
      ["딜러가 레벨 2 뒤처짐", [["딜러에게 몰아주기", 0.44], ["딜러 빼고 4명 한타", 0.2], ["탱커 중심 버티기", 0.3], ["로밍으로 상대 딜러 견제", 0.5]]],
      ["팀원 1명 연결 끊김, 상대 압박 중", [["4명이 한 곳에 뭉쳐 수비", 0.46], ["흩어져서 라인 관리", 0.18], ["무리해서 한타", 0.1], ["재접속까지 시간 끌기", 0.4]]],
      ["적 탱커 혼자 깊숙이 들어옴", [["4명이 탱커 무시하고 딜러 노림", 0.48], ["탱커부터 끊기", 0.3], ["후퇴", 0.14], ["탱커 묶고 시야 확보", 0.42]]],
      ["역전 기회: 적 3명 귀환 중", [["바로 타워 공략", 0.56], ["오브젝트 먼저", 0.46], ["적 정글 침투", 0.28], ["가만히 정비", 0.12]]],
      ["드래곤 4스택 위기, 우리 시야 없음", [["시야부터 확보", 0.5], ["무작정 드래곤 시도", 0.16], ["반대편 압박으로 교환", 0.38], ["포기하고 수비", 0.22]]],
    ];
    const rounds = shuffle(r, SC).slice(0, 6).map(([sit, ops]) => ({ sit, ops: shuffle(r, ops).map(([t, p]) => ({ t, p: clamp(p + (r() - 0.5) * 0.06, 0.03, 0.95) })), lim: 12000 }));
    return { rounds };
  },
  team(r) {
    const TR = ["aggr", "care", "steady"], rounds = [];
    for (let i = 0; i < 5; i++) rounds.push({ m: Array.from({ length: 3 }, () => ({ hp: 10 + ri(r, 10) * 10, trait: pick(r, TR), near: ri(r, 4), ally: ri(r, 3) })), lim: 15000 });
    return { rounds };
  },
  final(r) {
    const att = [], weak = []; let t = 4000, k = 0;
    while (t < 71000) { const p = ri(r, 4), tell = Math.round(clamp(1400 - k * 18, 800, 1400)); att.push({ t: Math.round(t), p, tell, big: r() < 0.3 }); t += tell + 1800 + r() * 1400; k++; }
    for (let x = 6000; x < 70000; x += 7000 + r() * 4000) weak.push(Math.round(x));
    return { dur: 75000, zones: 5, start: 2, move: 170, pats: [[0, 1], [3, 4], [1, 2, 3], [0, 4]], att, weak, weakLen: 3000, hp0: 100, pot: 3, potHeal: 35, hit: 22, bigHit: 34, q: { cd: 2000, dmg: 8 }, e: { cd: 8000, dmg: 30 } };
  },
  // s2 신규: 타깃 저격 — 위에서 내려오는 적을 닿기 전에 눌러 잡기 (u = 등장 시각·가로 위치·종류·내려오는 시간)
  snipe(r) {
    const u = []; let t = 900, k = 0;
    while (t < 26500) { const x = r(), kind = x < 0.2 ? "ally" : x < 0.45 ? "fast" : "norm", life = kind === "ally" ? 3000 : kind === "fast" ? Math.round(1900 - Math.min(400, k * 12)) : Math.round(3200 - Math.min(700, k * 20)); u.push({ id: k++, t: Math.round(t), x: Math.round((0.08 + r() * 0.84) * 1000) / 1000, kind, life }); t += 650 + r() * 700; }
    return { dur: 30000, u };
  },
  // s2 신규: 교전 타이밍 — 힘겨루기 막대가 한 번 크게 우리 쪽으로 밀렸다 돌아옴. 가장 밀린 순간에 돌격
  tug(r) {
    const rounds = [];
    for (let i = 0; i < 5; i++) {
      let rd = null;
      for (let tr = 0; tr < 40; tr++) {
        rd = { lim: 6000, tc: Math.round(1800 + r() * 3000), w: Math.round(600 + r() * 500), a: Math.round((0.9 + r() * 0.4) * 100) / 100, b0: Math.round((-0.35 - r() * 0.2) * 100) / 100, wa: Math.round((0.12 + r() * 0.08) * 100) / 100, wf: Math.round((0.6 + r() * 0.6) * 100) / 100, wp: Math.round(r() * 628) / 100 };
        const st = tugStats(rd); if (st.argmax >= 1500 && st.argmax <= 5200 && tugAdv(rd, 0) < st.mid && tugAdv(rd, rd.lim) < st.mid) break;
      }
      rounds.push(rd);
    }
    return { rounds, anim: 1700 };
  },
};
export function genSpec(tid, seed) { const g = GEN[tid]; if (!g) throw new Error("UNKNOWN_TEST"); return { tid, seed: seed >>> 0, ...g(rng(hashSeed(`${tid}:${seed >>> 0}`))) }; }

// =========================================================
// 2) 규칙 (화면 연출과 채점이 같이 씀)
// =========================================================
/** 교전: 전력비와 각 선택의 가치 */
export function engageValues(s) {
  const pow = (hp, ult) => hp.reduce((a, b) => a + b, 0) * (1 + (ult ? 0.3 : 0));
  const us = pow(s.us, s.ultUs) * (1 + 0.15 * s.terrain), them = pow(s.them, s.ultThem), ratio = us / them;
  const atk = clamp((ratio - 1) * 4, -2, 2), ret = clamp((1 - ratio) * 3, -1.5, 1.5);
  const wait = s.ultThem && !s.ultUs ? 1.2 : s.ultUs && !s.ultThem ? -0.6 : -0.1;
  return { ratio, v: [atk, ret, wait] };   // 0 공격 · 1 후퇴 · 2 대기
}
/** 타깃: 처치 순서대로 받는 총 피해 */
export function targetDamage(round, order) {
  const en = round.en.map((e) => ({ ...e, hp: e.hp, alive: true })); let taken = 0;
  for (const id of order) {
    const tgt = en[id]; if (!tgt || !tgt.alive) continue;
    while (tgt.hp > 0) {
      const heal = en.reduce((s, e) => s + (e.alive && e.id !== tgt.id ? e.heal : 0), 0);
      tgt.hp -= Math.max(4, round.dmg - heal);
      taken += en.reduce((s, e) => s + (e.alive ? e.dps : 0), 0);
    }
    tgt.alive = false;
  }
  return taken;
}
const PERMS4 = (() => { const out = []; const go = (a, rest) => { if (!rest.length) return out.push(a); rest.forEach((x, i) => go([...a, x], rest.filter((_, j) => j !== i))); }; go([], [0, 1, 2, 3]); return out; })();
export const targetBounds = (round) => { const v = PERMS4.map((o) => targetDamage(round, o)); return { best: Math.min(...v), worst: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length }; };
/** 쿨타임: 입력 재생 */
export function cooldownReplay(s, keys) {
  let mana = s.mana0, last = 0; const ready = { q: -1e9, w: -1e9, e: -1e9 }, shields = []; let dmg = 0, fails = 0, eWeak = 0, eTotal = 0;
  const ks = arr(keys).map((k) => [num(k?.[0]), String(k?.[1])]).filter((k) => k[0] >= 0 && k[0] <= s.dur && s.skills[k[1]]).sort((a, b) => a[0] - b[0]);
  for (const [t, k] of ks) {
    mana = Math.min(100, mana + ((t - last) / 1000) * s.regen); last = t;
    const sk = s.skills[k];
    if (t < ready[k] || mana < sk.mana) { fails++; continue; }
    mana -= sk.mana; ready[k] = t + sk.cd;
    if (k === "q") dmg += sk.dmg;
    if (k === "w") shields.push(t);
    if (k === "e") { const inW = s.weak.some((w) => t >= w && t <= w + s.weakLen); dmg += inW ? sk.dmg * 2 : sk.dmg; eTotal++; if (inW) eWeak++; }
  }
  const blocked = s.charges.filter((c) => shields.some((w) => w <= c + s.tell && w + s.shield >= c + s.tell)).length;
  return { dmg, fails, blocked, eWeak, eTotal, casts: ks.length - fails };
}
/** 보스: 입력(이동 목표 칸) 재생 → 각 공격 시점 위치 */
export function bossPos(s, moves, t) {
  let pos = s.start, from = s.start, at = 0, to = s.start;
  for (const [mt, z] of moves) { if (mt > t) break; const cur = posAt(from, to, at, mt, s.move); from = cur; to = z; at = mt; pos = cur; }
  return posAt(from, to, at, t, s.move);
  function posAt(f, tz, st, tt, mv) { const steps = Math.floor((tt - st) / mv); if (steps <= 0) return f; return f < tz ? Math.min(tz, f + steps) : Math.max(tz, f - steps); }
}
export function bossHits(s, log) {
  const mv = arr(log.z).map((m) => [num(m?.[0]), num(m?.[1])]).filter((m) => m[0] >= 0 && m[0] <= s.dur && Number.isInteger(m[1]) && m[1] >= 0 && m[1] < s.zones).sort((a, b) => a[0] - b[0]);
  return s.att.map((a) => { const hitT = a.t + a.tell, z = bossPos(s, mv, hitT); return { ...a, hitT, z, hit: s.pats[a.p].z.includes(z) }; });
}
/** 시야: 2칸 이동 후 위치 */
export const visionEnd = (n, e, steps) => { const D = [[0, -1], [1, 0], [0, 1], [-1, 0]][e.d]; let x = e.x, y = e.y; for (let i = 0; i < steps; i++) { const nx = x + D[0], ny = y + D[1]; if (nx < 0 || ny < 0 || nx >= n || ny >= n) break; x = nx; y = ny; } return y * n + x; };
/** 자원: 구매 계획 시뮬레이션 */
/** 자원: 한 라운드 (화면 연출과 채점이 같이 씀) */
export function resourceStep(s, st, i, o) {
  let { gold, hp, atk, def } = st; gold += i ? s.income : 0; let bought = 3;
  if (o === 0 && gold >= s.shop.sword.cost) { gold -= s.shop.sword.cost; atk += s.shop.sword.atk; bought = 0; }
  else if (o === 1 && gold >= s.shop.armor.cost) { gold -= s.shop.armor.cost; def += s.shop.armor.def; bought = 1; }
  else if (o === 2 && gold >= s.shop.potion.cost) { gold -= s.shop.potion.cost; hp = Math.min(s.hp0, hp + s.shop.potion.heal); bought = 2; }
  const w = s.waves[i], hits = Math.ceil(w.hp / atk), dmg = Math.round(Math.max(1, w.atk - def) * hits * s.k);
  hp -= dmg; const alive = hp > 0;
  return { gold, hp: Math.max(0, hp), atk, def, alive, dmg, hits, bought, gold0: st.gold + (i ? s.income : 0) };
}
export const resourceStart = (s) => ({ gold: s.gold0, hp: s.hp0, atk: s.atk0, def: s.def0 });
/** 자원: 구매 계획 시뮬레이션 */
export function resourceSim(s, plan) {
  let st = resourceStart(s), rounds = 0, alive = true;
  for (let i = 0; i < s.waves.length && alive; i++) { st = resourceStep(s, st, i, plan[i]); alive = st.alive; if (alive) rounds++; }
  return { hp: alive ? st.hp : 0, rounds, alive, value: rounds * 40 + (alive ? st.hp : 0) };
}
export const resourceBounds = (s) => { let best = -1, worst = 1e9, sum = 0, n = 0; for (let k = 0; k < 4 ** 5; k++) { const plan = [0, 1, 2, 3, 4].map((i) => Math.floor(k / 4 ** i) % 4), v = resourceSim(s, plan).value; best = Math.max(best, v); worst = Math.min(worst, v); sum += v; n++; } const cst = Math.max(...[0, 1, 2, 3].map((o) => resourceSim(s, [o, o, o, o, o]).value)); return { best, worst, mean: sum / n, cst }; };
/** 길: 목표별 기대 가치 */
export function pathValue(rd, p) {
  const ok = 1 - p.risk / 100;
  if (rd.goal === "time") return p.time <= rd.limit ? p.reward * ok : 0;
  if (rd.goal === "safe") return ok * 100 - p.time * 1.5 + p.reward * 0.1;
  return p.reward * ok - p.time * 0.5;
}
/** 한타: t초 (x,y)에 썼을 때 맞는 수 */
export const tfPos = (e, t) => ({ x: e.x0 + (e.vx * t) / 1000, y: e.y0 + (e.vy * t) / 1000 });
export const tfHits = (rd, t, x, y) => rd.en.filter((e) => { const p = tfPos(e, t); return (p.x - x) ** 2 + (p.y - y) ** 2 <= rd.rad ** 2; }).length;
export function tfBest(s, rd) { let best = 1; for (let t = 0; t <= rd.dur; t += 100) for (let x = 0; x <= s.W; x += 2) for (let y = 0; y <= s.H; y += 2) { const h = tfHits(rd, t, x, y); if (h > best) best = h; } return best; }
/** 교전 타이밍(s2): t ms 때 힘겨루기 값(+면 우리 쪽) */
export const tugAdv = (rd, t) => rd.b0 + rd.a * Math.exp(-(((t - rd.tc) / rd.w) ** 2)) + rd.wa * Math.sin((2 * Math.PI * rd.wf * t) / 1000 + rd.wp);
export function tugStats(rd) { let mx = -1e9, mn = 1e9, argmax = 0, sum = 0, n = 0; for (let t = 0; t <= rd.lim; t += 20) { const v = tugAdv(rd, t); if (v > mx) { mx = v; argmax = t; } if (v < mn) mn = v; sum += v; n++; } return { mx, mn, argmax, mean: sum / n, mid: (mx + mn) / 2 }; }
/** 교전 타이밍: 누른 순간의 질(0~1) — 가장 밀렸을 때 1, 가장 밀렸을 때 0 */
export const tugQ = (rd, t) => { const st = tugStats(rd); return c01((tugAdv(rd, t) - st.mn) / (st.mx - st.mn || 1)); };
/** 타깃 저격(s2): 화면 위→아래 진행도 0~1 (1 = 나에게 닿음). 범위 밖이면 null */
export const snipeK = (u, t) => { const k = (t - u.t) / u.life; return k < 0 || k > 1 ? null : k; };
/** 스킬 타이밍(s2): 입력 재생 — 화면 피드백과 채점이 같이 씀 */
export function cooldownJudge(s) {
  const ready = { w: -1e9, e: -1e9 }, bl = new Set(), wk = new Set(); let wasted = 0, fails = 0;
  return {
    press(t, k) {
      if (t < ready[k]) { fails++; return "cd"; } ready[k] = t + s.cd;
      if (k === "w") { const i = s.charges.findIndex((c, j) => !bl.has(j) && c + s.tell >= t && c + s.tell <= t + s.shield); if (i >= 0) { bl.add(i); return "block"; } wasted++; return "waste"; }
      const i = s.weak.findIndex((w, j) => !wk.has(j) && t >= w && t <= w + s.weakLen); if (i >= 0) { wk.add(i); return "weak"; } wasted++; return "waste";
    },
    blocked: (j) => bl.has(j), get res() { return { blocked: bl.size, eWeak: wk.size, wasted, fails }; },
  };
}
/** 팀 명령 가치 (0 공격 · 1 방어 · 2 지원 · 3 후퇴) */
export function teamValue(m, c) {
  const low = m.hp <= 30, mid = m.hp <= 60, danger = m.near >= 2, outn = m.near > m.ally + 1;
  let v = [0, 0, 0, 0];
  v[0] = (m.hp / 100) * 2 - m.near * 0.5 + m.ally * 0.4 + (m.trait === "aggr" ? 0.6 : m.trait === "care" ? -0.6 : 0);
  v[1] = (danger ? 1.2 : 0.3) + (m.trait === "steady" ? 0.5 : 0) - (low ? 0.4 : 0);
  v[2] = m.ally >= 1 ? 1 + (mid ? 0.3 : 0) : -0.5;
  v[3] = (low ? 2 : 0) + (outn ? 1 : -0.6) + (m.trait === "care" ? 0.3 : 0);
  return v[c];
}
/** 최종: 재생 */
export function finalReplay(s, log) {
  const mv = arr(log.z).map((m) => [num(m?.[0]), num(m?.[1])]).filter((m) => m[0] >= 0 && m[0] <= s.dur && Number.isInteger(m[1]) && m[1] >= 0 && m[1] < s.zones).sort((a, b) => a[0] - b[0]);
  const keys = arr(log.k).map((k) => [num(k?.[0]), String(k?.[1])]).filter((k) => k[0] >= 0 && k[0] <= s.dur && "qeft".includes(k[1]) && k[1].length === 1).sort((a, b) => a[0] - b[0]);
  const ev = [...s.att.map((a) => ({ t: a.t + a.tell, kind: "hit", a })), ...keys.map(([t, k]) => ({ t, kind: k }))].sort((a, b) => a.t - b.t || (a.kind === "hit" ? 1 : -1));
  let hp = s.hp0, pot = s.pot, mode = "atk", dmg = 0, dead = false, deadAt = null, qr = -1e9, er = -1e9, ePerfect = 0, eUse = 0, potGood = 0, potWaste = 0, dodged = 0, hits = 0, allyOk = 0, allyN = 0, fails = 0;
  const modeAt = []; // [t, mode]
  for (const e of ev) {
    if (dead) break;
    if (e.kind === "hit") {
      const z = bossPos(s, mv, e.t), hit = s.pats[e.a.p].includes(z);
      if (hit) { hp -= e.a.big ? s.bigHit : s.hit; hits++; } else dodged++;
      if (e.a.big) { allyN++; if (mode === "def") allyOk++; }
      if (hp <= 0) { dead = true; deadAt = e.t; }
    } else if (e.kind === "q") { if (e.t >= qr) { qr = e.t + s.q.cd; dmg += s.q.dmg * (mode === "atk" ? 1.2 : 1); } else fails++; }
    else if (e.kind === "e") { if (e.t >= er) { er = e.t + s.e.cd; const w = s.weak.some((x) => e.t >= x && e.t <= x + s.weakLen); dmg += s.e.dmg * (w ? 2 : 1); eUse++; if (w) ePerfect++; } else fails++; }
    else if (e.kind === "f") { if (pot > 0) { pot--; if (hp <= 55) potGood++; else potWaste++; hp = Math.min(s.hp0, hp + s.potHeal); } else fails++; }
    else if (e.kind === "t") { mode = mode === "atk" ? "def" : "atk"; modeAt.push([e.t, mode]); }
  }
  // 팀원 공격: 약점 시간 동안 공격 모드면 보너스
  for (const w of s.weak) { allyN++; let m = "atk"; for (const [t, md] of modeAt) { if (t <= w + 400) m = md; } if (m === "atk") { allyOk++; dmg += 15; } }
  return { hp: Math.max(0, hp), dead, deadAt, dmg: Math.round(dmg), ePerfect, eUse, potGood, potWaste, dodged, hits, allyOk, allyN, fails };
}

// =========================================================
// 3) 채점 — 0~100, 기록 이상하면 flags
// =========================================================
const SCORE = {
  minimap(s, log) {
    const a = arr(log.a).map((x) => [num(x?.[0]), String(x?.[1]), num(x?.[2])]).filter((x) => x[0] >= 0 && x[0] <= s.dur).sort((p, q) => p[0] - q[0]);
    const used = new Set(); let hits = 0, rtSum = 0, falses = 0, lastPing = -1e9, ore = 0; const oreHit = new Set();
    for (const [t, k, v] of a) {
      if (k === "p") {
        if (t - lastPing < 500) { falses++; continue; } lastPing = t;
        const e = s.ev.find((e, i) => !used.has(i) && e.danger && e.lane === v && t >= e.t && t <= e.t + s.win);
        if (e) { used.add(s.ev.indexOf(e)); hits++; rtSum += t - e.t; } else falses++;
      } else if (k === "o") { const o = s.ores.find((o) => o.id === v && t >= o.t && t <= o.t + s.life); if (o && !oreHit.has(v)) { oreHit.add(v); ore++; } }
    }
    const dangers = s.ev.filter((e) => e.danger).length || 1, hitR = hits / dangers, speed = hits ? c01(1 - (rtSum / hits - 500) / 1800) : 0, oreR = ore / (s.ores.length || 1);
    const score = 100 * c01(hitR * 0.62 + speed * 0.13 + oreR * 0.25 - falses * 0.07);
    return { score, m: { hits, dangers, falses, ore, ores: s.ores.length, rt: hits ? Math.round(rtSum / hits) : null }, flags: [] };
  },
  engage(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), ch = num(x?.[1]), ms = num(x?.[2]); if (Number.isInteger(i) && i >= 0 && i < s.sc.length && !c.has(i) && [0, 1, 2].includes(ch) && ms >= 0) c.set(i, { ch, ms }); }
    let sum = 0, right = 0; const flags = [];
    s.sc.forEach((sc, i) => { const { v } = engageValues(sc), mx = Math.max(...v), mn = Math.min(...v), x = c.get(i); if (!x || x.ms > sc.lim + 1500) return; if (x.ms < 250) flags.push("TOO_FAST"); const q = (v[x.ch] - mn) / (mx - mn || 1); sum += q; if (v[x.ch] === mx) right++; });
    const avg = sum / s.sc.length;
    return { score: 100 * norm(avg, 0.45), m: { right, n: s.sc.length }, flags: flags.length > 3 ? ["TOO_FAST"] : [] };
  },
  target(s, log) {
    const got = new Map(); for (const x of arr(log.o)) { const i = num(x?.[0]), o = arr(x?.[1]).map(num), ms = num(x?.[2]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !got.has(i) && o.length === 4 && new Set(o).size === 4 && o.every((v) => [0, 1, 2, 3].includes(v))) got.set(i, { o, ms }); }
    let sum = 0, best = 0;
    s.rounds.forEach((rd, i) => { const b = targetBounds(rd), x = got.get(i); if (!x || x.ms > rd.lim + 1500) return; const d = targetDamage(rd, x.o), q = (b.worst - d) / (b.worst - b.best || 1); sum += q; if (d === b.best) best++; });
    return { score: 100 * norm(sum / s.rounds.length, 0.5), m: { best, n: s.rounds.length }, flags: [] };
  },
  cooldown(s, log) {
    const J = cooldownJudge(s);
    for (const [t, k] of arr(log.k).map((k) => [num(k?.[0]), String(k?.[1])]).filter((k) => k[0] >= 0 && k[0] <= s.dur && (k[1] === "w" || k[1] === "e")).sort((a, b) => a[0] - b[0])) J.press(t, k);
    const r = J.res, bR = r.blocked / (s.charges.length || 1), eR = r.eWeak / (s.weak.length || 1);
    const score = 100 * c01(bR * 0.5 + eR * 0.5 - r.wasted * 0.06 - r.fails * 0.02);
    return { score, m: { blocked: r.blocked, charges: s.charges.length, eWeak: r.eWeak, weak: s.weak.length, fails: r.wasted, dmg: r.eWeak * 80 }, flags: [] };
  },
  boss(s, log) {
    const h = bossHits(s, log), wt = (i) => (i < h.length / 2 ? 1 : 1.5); let w = 0, ok = 0;
    h.forEach((a, i) => { w += wt(i); if (!a.hit) ok += wt(i); });
    const still = Math.max(...Array.from({ length: s.zones }, (_, z) => s.att.reduce((n, a, i) => n + (s.pats[a.p].z.includes(z) ? 0 : wt(i)), 0))) / (w || 1);
    return { score: 100 * norm(ok / (w || 1), Math.max(0.5, still)), m: { dodged: h.filter((a) => !a.hit).length, n: h.length }, flags: [] };
  },
  vision(s, log) {
    const got = new Map(); for (const x of arr(log.r)) { const i = num(x?.[0]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !got.has(i)) got.set(i, { c: [...new Set(arr(x?.[1]).map(num).filter((v) => Number.isInteger(v) && v >= 0 && v < s.n * s.n))], ms: num(x?.[2]) }); }
    let sum = 0, perfect = 0;
    s.rounds.forEach((rd, i) => { const ans = new Set(rd.en.map((e) => visionEnd(s.n, e, s.steps))), x = got.get(i); if (!x || x.ms > rd.lim + 1500) return; const c = x.c.slice(0, rd.en.length + 2), tp = c.filter((v) => ans.has(v)).length, prec = c.length ? tp / c.length : 0, rec = tp / ans.size, f = prec + rec ? (2 * prec * rec) / (prec + rec) : 0; sum += f; if (f === 1) perfect++; });
    return { score: 100 * norm(sum / s.rounds.length, 0.12), m: { perfect, n: s.rounds.length }, flags: [] };
  },
  resource(s, log) {
    const plan = [3, 3, 3, 3, 3]; for (const x of arr(log.c)) { const i = num(x?.[0]), o = num(x?.[1]); if (Number.isInteger(i) && i >= 0 && i < 5 && [0, 1, 2, 3].includes(o)) plan[i] = o; }
    const b = resourceBounds(s), r = resourceSim(s, plan);
    const span = b.best - b.worst || 1;
    return { score: 100 * norm((r.value - b.worst) / span, Math.max(b.mean, b.cst) - b.worst > 0 ? (Math.max(b.mean, b.cst) - b.worst) / span : 0), m: { rounds: r.rounds, hp: r.hp, alive: r.alive }, flags: [] };
  },
  multitask(s, log) {
    const a = arr(log.a).map((x) => [num(x?.[0]), num(x?.[1])]).filter((x) => x[0] >= 0 && x[0] <= s.dur && [0, 1, 2].includes(x[1])).sort((p, q) => p[0] - q[0]);
    const done = [new Set(), new Set(), new Set()]; let wrong = 0, ok = 0;
    for (const [t, p] of a) { const i = s.ev[p].findIndex((e, k) => !done[p].has(k) && t >= e + s.early[p] && t <= e + s.win[p]); if (i >= 0) { done[p].add(i); ok++; } else wrong++; }
    const tot = s.ev.reduce((n, e) => n + e.length, 0), per = done.map((d, p) => d.size / (s.ev[p].length || 1)), bal = Math.min(...per);
    return { score: 100 * c01((ok / tot) * 0.82 + bal * 0.18 - wrong * 0.05), m: { ok, tot, wrong }, flags: [] };
  },
  path(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), p = num(x?.[1]), ms = num(x?.[2]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !c.has(i) && Number.isInteger(p) && p >= 0 && p < s.rounds[i].paths.length) c.set(i, { p, ms }); }
    let sum = 0, right = 0;
    s.rounds.forEach((rd, i) => { const v = rd.paths.map((p) => pathValue(rd, p)), mx = Math.max(...v), mn = Math.min(...v), x = c.get(i); if (!x || x.ms > rd.lim + 1500) return; sum += (v[x.p] - mn) / (mx - mn || 1); if (v[x.p] === mx) right++; });
    return { score: 100 * norm(sum / s.rounds.length, 0.45), m: { right, n: s.rounds.length }, flags: [] };
  },
  teamfight(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), t = num(x?.[1]), px = num(x?.[2]), py = num(x?.[3]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !c.has(i) && t >= 0 && t <= s.rounds[i].dur && px >= 0 && px <= s.W && py >= 0 && py <= s.H) c.set(i, { t, x: px, y: py }); }
    let sum = 0, perfect = 0;
    s.rounds.forEach((rd, i) => { const x = c.get(i); if (!x) return; const best = tfBest(s, rd), h = tfHits(rd, x.t, x.x, x.y); sum += h / best; if (h >= best) perfect++; });
    return { score: 100 * norm(sum / s.rounds.length, 0.12), m: { perfect, n: s.rounds.length }, flags: [] };
  },
  fake(s, log) {
    const b = arr(log.b).map(num).filter((t) => t >= 0 && t <= s.dur).sort((p, q) => p - q);
    let last = -1e9, okReal = 0, badFake = 0, idle = 0; const used = new Set();
    for (const t of b) {
      if (t - last < s.cd) continue; last = t;
      const i = s.sw.findIndex((w, k) => !used.has(k) && t >= w.t + w.wind - s.blockWin && t <= w.t + w.wind + 60);
      if (i < 0) { idle++; continue; } used.add(i);
      if (s.sw[i].real) okReal++; else badFake++;
    }
    const reals = s.sw.filter((w) => w.real).length || 1, fakes = s.sw.length - reals || 1;
    return { score: 100 * c01(okReal / reals - (badFake / fakes) * 0.9 - idle * 0.04), m: { okReal, reals, badFake, fakes, idle }, flags: [] };
  },
  overload(s, log) {
    const a = arr(log.a).map((x) => [num(x?.[0]), num(x?.[1])]).filter((x) => x[0] >= 0 && x[0] <= s.dur).sort((p, q) => p[0] - q[0]);
    const done = new Set(); let ok = 0, wrong = 0;
    for (const [t, id] of a) { const n = Number.isInteger(id) ? s.n[id] : null; if (n && n.type !== "noise" && !done.has(id) && t >= n.t && t <= n.t + s.life) { done.add(id); ok++; } else wrong++; }
    const need = s.n.filter((x) => x.type !== "noise").length || 1;
    return { score: 100 * c01(ok / need - wrong * 0.06), m: { ok, need, wrong }, flags: [] };
  },
  comeback(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), p = num(x?.[1]), ms = num(x?.[2]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !c.has(i) && [0, 1, 2, 3].includes(p)) c.set(i, { p, ms }); }
    let sum = 0, right = 0;
    s.rounds.forEach((rd, i) => { const v = rd.ops.map((o) => o.p), mx = Math.max(...v), mn = Math.min(...v), x = c.get(i); if (!x || x.ms > rd.lim + 1500) return; sum += (v[x.p] - mn) / (mx - mn || 1); if (v[x.p] === mx) right++; });
    return { score: 100 * norm(sum / s.rounds.length, 0.45), m: { right, n: s.rounds.length }, flags: [] };
  },
  team(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), o = arr(x?.[1]).map(num), ms = num(x?.[2]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !c.has(i) && o.length === 3 && o.every((v) => [0, 1, 2, 3].includes(v))) c.set(i, { o, ms }); }
    let sum = 0, best = 0, n = 0;
    s.rounds.forEach((rd, i) => { const x = c.get(i); rd.m.forEach((m, k) => { n++; if (!x || x.ms > rd.lim + 1500) return; const v = [0, 1, 2, 3].map((q) => teamValue(m, q)), mx = Math.max(...v), mn = Math.min(...v); sum += (v[x.o[k]] - mn) / (mx - mn || 1); if (v[x.o[k]] === mx) best++; }); });
    return { score: 100 * norm(sum / (n || 1), 0.45), m: { best, n }, flags: [] };
  },
  snipe(s, log) {
    const a = arr(log.k).map((x) => [num(x?.[0]), num(x?.[1])]).filter((x) => x[0] >= 0 && x[0] <= s.dur).sort((p, q) => p[0] - q[0]);
    const dead = new Set(); let kills = 0, ally = 0, miss = 0;
    for (const [t, id] of a) { const u = Number.isInteger(id) && id >= 0 ? s.u[id] : null; if (!u || dead.has(id) || snipeK(u, t) == null) { miss++; continue; } dead.add(id); if (u.kind === "ally") ally++; else kills++; }
    const foes = s.u.filter((u) => u.kind !== "ally").length || 1;
    return { score: 100 * c01(kills / foes - ally * 0.12 - miss * 0.02), m: { kills, foes, ally, miss }, flags: [] };
  },
  tug(s, log) {
    const c = new Map(); for (const x of arr(log.c)) { const i = num(x?.[0]), ms = num(x?.[1]); if (Number.isInteger(i) && i >= 0 && i < s.rounds.length && !c.has(i) && ms >= 0) c.set(i, ms); }
    let sum = 0, great = 0;
    s.rounds.forEach((rd, i) => { const ms = c.get(i); if (ms == null || ms > rd.lim) return; const st = tugStats(rd), q = tugQ(rd, ms), base = (st.mean - st.mn) / (st.mx - st.mn || 1); sum += norm(q, base); if (q >= 0.9) great++; });
    return { score: 100 * (sum / s.rounds.length), m: { great, n: s.rounds.length }, flags: [] };
  },
  final(s, log) {
    const r = finalReplay(s, log), dmgR = c01(r.dmg / 520), surv = (r.dead ? r.deadAt / s.dur : 1) * Math.min(1, dmgR * 2), dodgeR = r.dodged / ((r.dodged + r.hits) || 1), allyR = r.allyN && arr(log.k).some((k) => k?.[1] === "t") ? r.allyOk / r.allyN : 0,
      still = Math.max(...Array.from({ length: s.zones }, (_, z) => s.att.filter((a) => !s.pats[a.p].includes(z)).length)) / (s.att.length || 1), eR = r.eUse ? r.ePerfect / r.eUse : 0, potR = r.potGood / s.pot;
    const score = 100 * c01(surv * 0.2 + norm(dodgeR, Math.max(0.5, still)) * 0.22 + dmgR * 0.25 + allyR * 0.15 + eR * 0.1 + potR * 0.08 - r.fails * 0.008 - r.potWaste * 0.03);
    return { score, m: { hp: r.hp, dead: r.dead, dmg: r.dmg, dodged: r.dodged, hits: r.hits, allyOk: r.allyOk, allyN: r.allyN }, flags: [] };
  },
};
export function scoreTest(tid, spec, log) {
  const f = SCORE[tid]; if (!f) throw new Error("UNKNOWN_TEST");
  let r; try { r = f(spec, log || {}); } catch { r = { score: 0, m: {}, flags: ["BAD_LOG"] }; }
  let score = Math.round(clamp(Number.isFinite(r.score) ? r.score : 0, 0, 100));
  if (r.flags.length) score = Math.min(score, 40);
  return { id: tid, score, m: r.m, flags: r.flags };
}

// =========================================================
// 4) 종합: 영역 → 1000점 → 티어 → 유형
// =========================================================
// 분포 조정용 곡선 (시험 데이터로 바꿀 수 있게 따로 둠): 영역 평균(0~100) → 총점(0~1000)
export const CAL = [[0, 0], [20, 150], [35, 300], [50, 480], [65, 650], [78, 800], [88, 910], [95, 975], [100, 1000]];
const curve = (x, pts) => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); } return pts[pts.length - 1][1]; };
export function areaScores(scores) {
  const out = {};
  for (const a of AREAS) { let s = 0, w = 0; for (const [tid, sc] of Object.entries(scores)) { const ww = TESTS[tid]?.abil?.[a]; if (ww && Number.isFinite(sc)) { s += sc * ww; w += ww; } } out[a] = w ? Math.round(s / w) : null; }
  return out;
}
export function totalOf(scores) {
  const ar = areaScores(scores), v = AREAS.map((a) => ar[a]).filter((x) => x != null);
  if (!v.length) return 0;
  return Math.round(curve(v.reduce((a, b) => a + b, 0) / v.length, CAL));
}
// 게임 센스 유형 12종: 1·2위 영역과 고른 정도로
export const STYLES = [
  { id: "shotcaller", name: "샷콜러", desc: "판을 읽고 팀을 움직여요. 한 마디로 흐름을 바꾸는 오더형.", areas: ["strat", "situ"], col: "#9775fa" },
  { id: "carry", name: "한타 캐리머신", desc: "싸움이 열리면 가장 빛나요. 각을 보고 들어가는 전투형.", areas: ["combat", "situ"], col: "#ff6078" },
  { id: "radar", name: "인간 레이더", desc: "미니맵과 알림을 놓치지 않아요. 정보로 팀을 지키는 타입.", areas: ["info", "multi"], col: "#46e08a" },
  { id: "clutch", name: "클러치 장인", desc: "위기일수록 침착해요. 마지막 1%에서 판을 뒤집는 타입.", areas: ["crisis", "combat"], col: "#f4c76a" },
  { id: "macro", name: "운영의 신", desc: "자원과 시간을 아껴 써요. 큰 그림으로 이기는 운영형.", areas: ["strat", "multi"], col: "#5aa8ff" },
  { id: "analyst", name: "전장 분석가", desc: "상황 판단이 정확해요. 싸울 때와 빠질 때를 칼같이 압니다.", areas: ["situ", "info"], col: "#3ee6f0" },
  { id: "survivor", name: "생존 전문가", desc: "패턴을 금방 익히고 절대 안 죽어요. 끝까지 살아남는 타입.", areas: ["crisis", "info"], col: "#7ee05a" },
  { id: "juggler", name: "멀티 플레이어", desc: "세 가지 일을 동시에 굴려요. 손보다 머리가 바쁜 타입.", areas: ["multi", "crisis"], col: "#ff9a4a" },
  { id: "tactician", name: "전술가", desc: "싸움 전에 이미 계산이 끝나 있어요. 효율 중시 전략형.", areas: ["strat", "combat"], col: "#c77dff" },
  { id: "allround", name: "올라운더", desc: "여섯 능력이 고르게 높아요. 어느 포지션에서도 제 몫을 해요.", areas: [], col: "#ffdf7a", bal: "hi" },
  { id: "potential", name: "성장형 루키", desc: "아직 고르게 다듬는 중이에요. 다음 판이 가장 기대되는 타입.", areas: [], col: "#8a93c4", bal: "lo" },
  { id: "instinct", name: "본능형 플레이어", desc: "계산보다 감으로 움직여요. 맞을 땐 소름, 틀릴 땐 대참사.", areas: ["combat", "crisis"], col: "#ff5fd2", alt: true },
];
export function styleOf(areas) {
  const list = AREAS.filter((a) => areas?.[a] != null).map((a) => [a, areas[a]]).sort((x, y) => y[1] - x[1]);
  if (!list.length) return STYLES.find((s) => s.id === "potential");
  const vals = list.map((x) => x[1]), hi = vals[0], lo = vals[vals.length - 1], avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (hi - lo <= 15) return STYLES.find((s) => s.id === (avg >= 60 ? "allround" : "potential"));
  const top = [list[0][0], list[1]?.[0]];
  if ((top[0] === "combat" || top[0] === "crisis") && list[list.length - 1][0] === "strat" && hi - lo >= 30) return STYLES.find((s) => s.id === "instinct");
  const exact = STYLES.find((s) => s.areas.length && s.areas[0] === top[0] && s.areas[1] === top[1] && !s.alt);
  if (exact) return exact;
  const loose = STYLES.find((s) => s.areas.length && s.areas.includes(top[0]) && s.areas.includes(top[1]));
  if (loose) return loose;
  const first = STYLES.find((s) => s.areas[0] === top[0] && !s.alt);
  return first || STYLES.find((s) => s.id === "instinct");
}
const COMMENT = {
  situ: ["진짜와 가짜, 칠 때와 막을 때를 정확히 봤어요.", "판단은 좋은데 가끔 한 박자 늦었어요.", "판단이 흔들렸어요. 빛·색 같은 신호를 먼저 보고 움직여 보세요."],
  strat: ["가장 좋은 순간과 자리를 잘 골랐어요.", "타이밍은 좋은데 마지막 선택이 아쉬웠어요.", "급하게 누르기보다 가장 좋은 순간을 기다려 보세요."],
  combat: ["누구부터 잡을지, 언제 칠지 깔끔했어요.", "전투는 무난해요. 빠른 적부터 잡는 습관만 더!", "헛손질이 많았어요. 칠 때만 치는 연습을 해 보세요."],
  info: ["미니맵과 알림을 거의 놓치지 않았어요.", "중요한 정보는 잡는데 가끔 소음에 끌려갔어요.", "화면 구석의 정보를 더 자주 확인해 보세요."],
  crisis: ["위기에서도 침착하게 피하고 막았어요.", "위기 대응은 괜찮지만 마지막 순간이 아쉬워요.", "전조를 먼저 보고 움직이는 연습이 필요해요."],
  multi: ["여러 일을 동시에 놓치지 않았어요.", "두 가지까지는 완벽, 세 가지에서 흔들렸어요.", "급한 것부터 처리하는 순서를 정해 보세요."],
};
// 티어별 한 줄 평 (가볍고 놀리지 않는 말투) — 점수로 골라 같은 결과면 같은 문장
export const QUIPS = {
  iron: ["아직 튜토리얼 지역이에요. 그래도 첫걸음이 제일 어렵죠!", "센스는 근육처럼 붙어요. 연습 모드부터 가볍게!"],
  bronze: ["감은 왔어요. 이제 미니맵에 시선 한 번만 더!", "싸울 때를 알아보기 시작한 단계예요."],
  silver: ["평균의 벽 앞이에요. 한 판만 더 하면 넘을지도?", "기본기는 갖췄어요. 이제 판단 속도만!"],
  gold: ["듀오 하자고 연락 올 만한 센스예요.", "팀에 한 명 있으면 든든한 타입이에요."],
  platinum: ["게임을 읽기 시작했어요. 손보다 머리가 먼저 움직여요.", "남들이 놓치는 걸 보는 눈이 있어요."],
  emerald: ["판이 어떻게 흘러갈지 이미 보이는 사람이에요.", "팀원들이 핑 하나에 따라오는 센스예요."],
  diamond: ["상위권 센스! 운영과 교전을 모두 아는 플레이어예요.", "실수가 적고 선택이 정확해요."],
  master: ["이 정도면 코칭해도 돼요.", "판단·운영·전투가 고르게 날카로워요."],
  grandmaster: ["거의 모든 상황에서 최선의 수를 찾아요.", "팀의 두뇌 역할을 맡을 수 있는 수준이에요."],
  challenger: ["게임 센스 끝판왕. 이 진단서는 액자에 걸어야 해요.", "상대가 무엇을 할지 이미 알고 움직이는 사람이에요."],
};
export const DISCLAIMER = "게임 센스 점수는 플레이듀오 미니게임 안의 선택과 조작으로 계산한 오락용 지표예요. 실제 게임 실력이나 심리적 능력을 과학적으로 측정·인증하지 않아요.";
export function diagnose({ scores, prev = null, rank = null, of = null }) {
  const areas = areaScores(scores), total = totalOf(scores), tier = tierOf(total), style = styleOf(areas);
  const valid = AREAS.filter((a) => areas[a] != null).sort((a, b) => areas[b] - areas[a]);
  const best = valid[0] || null, worst = valid[valid.length - 1] || null;
  const band = (v) => (v >= 70 ? 0 : v >= 45 ? 1 : 2);
  const opinion = [best, worst].filter((a, i, l) => a && l.indexOf(a) === i).map((a) => COMMENT[a][band(areas[a])]);
  const tests = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const qs = QUIPS[tier.id] || QUIPS.iron, quip = qs[(total + Object.values(scores).reduce((a, b) => a + (b | 0), 0)) % qs.length];
  return { total, areas, quip, tier: { id: tier.id, name: tier.name, col: tier.col }, style: { id: style.id, name: style.name, desc: style.desc, col: style.col }, best, worst, opinion, bestTest: tests[0]?.[0] || null, worstTest: tests[tests.length - 1]?.[0] || null, prevDelta: prev ? total - prev.total : null, rank, of };
}
