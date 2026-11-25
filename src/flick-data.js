// =========================
// DUO 증강 알까기 — 보스 · 도전 모드 30단계 · 업적 (2026-11-25)
// · 보스: 큰 알 1개(+부하 알). 보스 알의 보호막 = 체력. 판 밖(구멍)으로 나가면 체력 1 깎이고 가운데로 돌아옴, 체력 0에서 나가면 처치
// · 보스 차례: 기술(돌진·발 구르기·눈보라·블랙홀·분화·소환) ↔ 평범한 발사. 체력이 절반 이하면 '분노' — 매번 기술 + 더 빠름
// · 도전 모드: 혼자 AI와 30단계. 별 = ★ 이기기 · ★★ 내 알 절반 이상 남기고 이기기 · ★★★ 정한 발사 수 안에 이기기
// · 업적: 판이 끝나면 서버가 확정한 결과로만 기록 (flick-progress.js). 보상 = 칭호
// =========================
export const BOSSES = {
  golem: { name: "바위 거인", col: "#a08a6a", icon: "🗿", skills: ["charge", "stomp"], minions: 1, desc: "무겁게 돌진하고, 발을 굴러 주변 알을 날려요" },
  ice: { name: "얼음 여왕", col: "#7fd6ff", icon: "❄️", skills: ["blizzard", "iceShot"], minions: 1, desc: "눈보라로 판 전체 알을 한쪽으로 밀어요" },
  slime: { name: "분열 대왕 슬라임", col: "#6fdc6f", icon: "🟢", skills: ["summon", "bombShot"], minions: 2, desc: "부하 슬라임을 계속 불러내요" },
  void: { name: "블랙홀 마왕", col: "#a06bff", icon: "🌀", skills: ["hole", "charge"], minions: 1, desc: "판 가장자리에 블랙홀을 열어 알을 빨아들여요" },
  magma: { name: "화산 거인", col: "#ff6a3c", icon: "🌋", skills: ["erupt", "bombShot"], minions: 1, desc: "분화로 넓은 범위 알을 튕겨 내요" },
  king: { name: "알까기 대마왕", col: "#ffcf3a", icon: "👑", skills: ["charge", "hole", "erupt", "summon", "blizzard"], minions: 2, desc: "모든 보스의 기술을 번갈아 써요" },
};
export const BOSS_IDS = Object.keys(BOSSES);
export const SKILL_NAME = { charge: "돌진", stomp: "발 구르기", blizzard: "눈보라", iceShot: "얼음 발사", summon: "부하 소환", bombShot: "폭발 발사", hole: "블랙홀", erupt: "분화" };

// 도전 모드 30단계 — bots: AI 난이도 목록, my/their: 알 개수, goal: ★★★ 발사 수, boss: { kind, hp }
const S = (n, name, map, bots, my, their, mode, goal, boss = null) => ({ n, name, map, bots, my, their, mode, goal, boss });
export const STAGES = [
  S(1, "첫 튕기기", "classic", ["easy"], 3, 2, "classic", 5),
  S(2, "미끄러운 얼음", "ice", ["easy"], 3, 3, "classic", 7),
  S(3, "증강 맛보기", "classic", ["easy"], 3, 3, "augment", 7),
  S(4, "기둥 사이로", "ruins", ["normal"], 3, 3, "augment", 8),
  S(5, "보스: 바위 거인", "classic", [], 4, 0, "augment", 9, { kind: "golem", hp: 2 }),
  S(6, "용암 조심", "volcano", ["normal"], 3, 3, "augment", 7),
  S(7, "범퍼 놀이터", "toy", ["easy", "easy"], 3, 2, "augment", 8),
  S(8, "바람 부는 날", "cloud", ["normal"], 3, 3, "augment", 8),
  S(9, "레이저 벽", "neon", ["normal", "easy"], 4, 3, "augment", 10),
  S(10, "보스: 얼음 여왕", "ice", [], 4, 0, "augment", 10, { kind: "ice", hp: 3 }),
  S(11, "소용돌이", "space", ["normal", "normal"], 3, 3, "augment", 9),
  S(12, "기둥 난전", "ruins", ["normal", "normal"], 4, 3, "augment", 10),
  S(13, "불리한 싸움", "classic", ["normal"], 2, 4, "augment", 8),
  S(14, "화산 난투", "volcano", ["normal", "normal"], 3, 3, "augment", 9),
  S(15, "보스: 분열 대왕 슬라임", "toy", [], 4, 0, "augment", 11, { kind: "slime", hp: 3 }),
  S(16, "빙판 대결", "ice", ["hard"], 3, 3, "augment", 8),
  S(17, "바람과 기둥", "cloud", ["normal", "hard"], 4, 3, "augment", 10),
  S(18, "넷이서", "neon", ["normal", "normal", "normal"], 3, 3, "augment", 11),
  S(19, "소수 정예", "space", ["hard"], 2, 3, "augment", 8),
  S(20, "보스: 블랙홀 마왕", "space", [], 5, 0, "augment", 12, { kind: "void", hp: 4 }),
  S(21, "용암 지옥", "volcano", ["hard", "normal"], 3, 3, "augment", 9),
  S(22, "고수의 판", "classic", ["hard"], 3, 3, "augment", 8),
  S(23, "범퍼 난전", "toy", ["hard", "hard"], 4, 3, "augment", 11),
  S(24, "폭풍", "cloud", ["hard", "hard"], 3, 3, "augment", 10),
  S(25, "보스: 화산 거인", "volcano", [], 5, 0, "augment", 12, { kind: "magma", hp: 4 }),
  S(26, "기둥 미로", "ruins", ["hard", "hard", "hard"], 3, 3, "augment", 12),
  S(27, "얼음 지옥", "ice", ["hard", "hard"], 3, 4, "augment", 11),
  S(28, "레이저 결투", "neon", ["hard"], 2, 2, "augment", 6),
  S(29, "마지막 연습", "space", ["hard", "hard", "hard"], 4, 3, "augment", 13),
  S(30, "보스: 알까기 대마왕", "random", [], 5, 0, "augment", 14, { kind: "king", hp: 5 }),
];
export const MAX_STARS = STAGES.length * 3;
/** 별 계산: 이겼을 때만. stones = 남은 내 알(기본 알 기준), start = 시작 알, shots = 내 발사 수 */
export function starsOf(st, { win, stones, start, shots }) { if (!win) return 0; let s = 1; if (stones * 2 >= start) s++; if (shots <= st.goal) s++; return s; }

// 업적 — k: 기록 이름, n: 목표. rw: ["t"] = 칭호
const A = (id, k, n, icon, name, desc) => ({ id, k, n, rw: ["t"], icon, name, desc });
export const ACHS = [
  A("k01", "plays", 1, "🥏", "첫 튕기기", "알까기 1판 끝내기"),
  A("k02", "plays", 20, "🎯", "알까기 단골", "20판 끝내기"),
  A("k03", "plays", 100, "🏟️", "알까기 장인", "100판 끝내기"),
  A("k04", "wins", 1, "🏆", "첫 승리", "1번 이기기"),
  A("k05", "wins", 20, "✌️", "승리의 손가락", "20번 이기기"),
  A("k06", "wins", 100, "👑", "전설의 손가락", "100번 이기기"),
  A("k07", "kills", 30, "💥", "떨어뜨리기 30", "상대 알 30개 떨어뜨리기"),
  A("k08", "kills", 300, "🧹", "판 청소부", "상대 알 300개 떨어뜨리기"),
  A("k09", "bKill", 2, "✨", "더블 아웃", "한 번 발사로 상대 알 2개 떨어뜨리기"),
  A("k10", "bKill", 3, "🔥", "트리플 아웃", "한 번 발사로 상대 알 3개 떨어뜨리기"),
  A("k11", "bKill", 5, "☄️", "몰살", "한 번 발사로 상대 알 5개 떨어뜨리기"),
  A("k12", "perfect", 1, "💎", "무결점", "내 알을 하나도 안 잃고 이기기"),
  A("k13", "comeback", 1, "🩹", "기사회생", "마지막 한 알로 이기기"),
  A("k14", "holes", 10, "🌋", "용암 요리사", "상대 알을 용암 구멍에 10개 빠뜨리기"),
  A("k15", "mapsWon", 8, "🗺️", "모든 경기장 정복", "8개 경기장에서 한 번씩 이기기"),
  A("k16", "stages", 5, "🚩", "도전자", "도전 모드 5단계 깨기"),
  A("k17", "stages", 15, "🧗", "숙련자", "도전 모드 15단계 깨기"),
  A("k18", "stages", 30, "🏁", "도전 모드 완주", "도전 모드 30단계 모두 깨기"),
  A("k19", "stars", 45, "⭐", "별 수집가", "도전 모드 별 45개"),
  A("k20", "stars", 90, "🌟", "별을 다 모은 자", "도전 모드 별 90개 (만점)"),
  A("k21", "bossKills", 1, "⚔️", "보스 사냥꾼", "보스 처치 1번"),
  A("k22", "bossKinds", 6, "📕", "보스 도감 완성", "보스 6종 모두 처치"),
  A("k23", "raidClears", 1, "🤝", "함께라면", "멀티 보스 레이드 깨기"),
  A("k24", "raidClears", 10, "🛡️", "레이드 베테랑", "멀티 보스 레이드 10번 깨기"),
  A("k25", "daily", 1, "📅", "오늘의 도전자", "오늘의 도전 1번"),
  A("k26", "daily", 7, "🗓️", "꾸준한 도전", "오늘의 도전 7번"),
  A("k27", "augs", 50, "🎴", "증강 마스터", "증강 50번 쓰기"),
  A("k28", "teamWins", 10, "🤜", "팀워크", "팀전·레이드에서 10번 이기기"),
];
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ACH_SUM = ["plays", "wins", "kills", "perfect", "comeback", "holes", "bossKills", "raidClears", "daily", "augs", "teamWins"];
const MAP_IDS = ["classic", "neon", "ice", "space", "volcano", "toy", "cloud", "ruins"];
/** 한 판 결과 더하기. run = { win, kills, bKill, perfect, comeback, holes, bossKill, bossKind, raidClear, daily, augs, teamWin, map, stage, stars } */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const add = { plays: 1, wins: run.win ? 1 : 0, kills: num(run.kills), perfect: run.perfect ? 1 : 0, comeback: run.comeback ? 1 : 0, holes: num(run.holes), bossKills: run.bossKill ? 1 : 0, raidClears: run.raidClear ? 1 : 0, daily: run.daily ? 1 : 0, augs: num(run.augs), teamWins: run.teamWin ? 1 : 0 };
  for (const k of ACH_SUM) s[k] = num(s[k]) + (add[k] || 0);
  s.bKill = Math.max(num(s.bKill), num(run.bKill));
  // 이긴 경기장·처치한 보스 (목록)
  const mw = new Set(Array.isArray(s.mw) ? s.mw.filter(m => MAP_IDS.includes(m)) : []); if (run.win && MAP_IDS.includes(run.map)) mw.add(run.map); s.mw = [...mw]; s.mapsWon = mw.size;
  const bk = new Set(Array.isArray(s.bk) ? s.bk.filter(b => has(BOSSES, b)) : []); if (run.bossKill && has(BOSSES, run.bossKind)) bk.add(run.bossKind); s.bk = [...bk]; s.bossKinds = bk.size;
  // 도전 모드 별 (단계별 최고)
  const stg = s.stg && typeof s.stg === "object" && !Array.isArray(s.stg) ? { ...s.stg } : {};
  const n = num(run.stage), stars = Math.min(3, num(run.stars));
  if (n >= 1 && n <= STAGES.length && stars > 0) stg[n] = Math.max(num(stg[n]), stars);
  for (const k of Object.keys(stg)) { if (!(+k >= 1 && +k <= STAGES.length) || String(+k) !== k) delete stg[k]; else stg[k] = Math.min(3, num(stg[k])); }
  s.stg = stg; s.stages = Object.values(stg).filter(v => v > 0).length; s.stars = Object.values(stg).reduce((a, v) => a + Math.min(3, num(v)), 0);
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
/** 칭호만 (색 꾸미기는 없음) */
export function achEquip(unlocked, want) { const u = new Set(unlocked || []), t = String(want?.t || ""); return { c: null, t: has(ACH, t) && u.has(t) ? t : null }; }
/** 단계 열림: 1단계 또는 바로 앞 단계를 깼을 때 */
export const stageOpen = (stats, n) => n === 1 || (Number(stats?.stg?.[n - 1]) || 0) > 0;

// 오늘의 도전: 날짜로 같은 판 (경기장·상대·알 수)
export const todayKst = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
export const daySeed = (day) => { let h = 2166136261; for (const ch of "duo-flick-" + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dailyCfg(day) {
  const s = daySeed(day);
  const map = MAP_IDS[s % 8], bots = [["normal", "hard"], ["hard", "hard"], ["normal", "normal", "hard"]][(s >>> 3) % 3];
  return { day, map, bots, my: 3, their: 3, mode: "augment", seed: s };
}
/** 오늘의 도전 점수 (서버 확정 값으로만) */
export function dailyScore({ win, kills, stones, shots, rank }) { return Math.max(0, (win ? 1000 : 0) + kills * 120 + stones * 150 - shots * 15 + (win ? 0 : Math.max(0, 4 - rank) * 80)); }
