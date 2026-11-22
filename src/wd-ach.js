// =========================
// 플듀 끝말잇기 — 업적 26종 · 기차 색 11 · 칭호 15 (2026-11-22)
// · 서버 src/wd-ach.js 와 화면 js/wordchain/wd-ach.js 는 같은 파일 (고치면 둘 다 복사)
// · 판이 끝나면 서버가 확정한 값(run)만 더함 → achApply / achDone / achEquip
// =========================
// 기차 칸 색: a = 위(밝은 색), b = 아래, d = 테두리, s = 바닥 그림자, t = 글자
export const CAR_COLORS = {
  cherry: { a: "#ffe3e3", b: "#ff8787", d: "#e03131", s: "#8a1c1c", t: "#3d0a0a", name: ["체리", "チェリー", "Cherry"] },
  mint: { a: "#e6fcf5", b: "#63e6be", d: "#0ca678", s: "#08664a", t: "#05301f", name: ["민트", "ミント", "Mint"] },
  lemon: { a: "#fff9db", b: "#ffd43b", d: "#f08c00", s: "#8a5200", t: "#3b2300", name: ["레몬", "レモン", "Lemon"] },
  sky: { a: "#e7f5ff", b: "#4dabf7", d: "#1864ab", s: "#0b3a66", t: "#06213b", name: ["하늘", "空", "Sky"] },
  grape: { a: "#f3f0ff", b: "#9775fa", d: "#6741d9", s: "#3b2386", t: "#1c0f45", name: ["포도", "ぶどう", "Grape"] },
  sakura: { a: "#fff0f6", b: "#faa2c1", d: "#d6336c", s: "#7d1a40", t: "#3d0a1f", name: ["벚꽃", "桜", "Sakura"] },
  forest: { a: "#d3f9d8", b: "#2f9e44", d: "#1b5e20", s: "#0d3311", t: "#f1fff3", name: ["숲", "森", "Forest"] },
  night: { a: "#5c677d", b: "#212529", d: "#000000", s: "#000000", t: "#f8f9fa", name: ["한밤", "真夜中", "Midnight"] },
  gold: { a: "#fff3bf", b: "#fab005", d: "#b77b00", s: "#6b4500", t: "#2b1b00", name: ["황금", "黄金", "Gold"] },
  neon: { a: "#3ff0ff", b: "#ff4fd8", d: "#a61e8d", s: "#4a0d40", t: "#1a0016", name: ["네온", "ネオン", "Neon"] },
  rainbow: { a: "#ffd43b", b: "#74c0fc", d: "#9c36b5", s: "#4a1a5c", t: "#1b1030", rainbow: true, name: ["무지개", "虹", "Rainbow"] },
};
// k = 기록 이름, n = 목표, rw = ["c", 색] 또는 ["t"] (칭호 = 업적 이름)
export const ACHS = [
  { id: "w01", k: "plays", n: 1, rw: ["t"], icon: "🚂", name: ["첫 기차", "初めての汽車", "First Train"], desc: ["첫 판 끝내기", "初めての1回を終える", "Finish your first game"] },
  { id: "w02", k: "plays", n: 10, rw: ["c", "sky"], icon: "🎫", name: ["단골 승객", "常連の乗客", "Regular Rider"], desc: ["10판 끝내기", "10回終える", "Finish 10 games"] },
  { id: "w03", k: "plays", n: 50, rw: ["t"], icon: "🧳", name: ["기차 여행가", "汽車の旅人", "Rail Traveler"], desc: ["50판 끝내기", "50回終える", "Finish 50 games"] },
  { id: "w04", k: "words", n: 100, rw: ["c", "mint"], icon: "📝", name: ["단어 백 개", "単語100個", "Hundred Words"], desc: ["단어 모두 100개 내기", "単語を合計100個出す", "Play 100 words in total"] },
  { id: "w05", k: "words", n: 1000, rw: ["t"], icon: "📚", name: ["걸어 다니는 사전", "歩く辞書", "Walking Dictionary"], desc: ["단어 모두 1,000개 내기", "単語を合計1,000個出す", "Play 1,000 words in total"] },
  { id: "w06", k: "bLen", n: 5, rw: ["t"], icon: "📏", name: ["다섯 글자", "5文字", "Five Letters"], desc: ["5글자 이상 단어 내기", "5文字以上の単語を出す", "Play a word of 5+ letters"] },
  { id: "w07", k: "bLen", n: 7, rw: ["c", "grape"], icon: "📐", name: ["긴 단어 장인", "長い単語の職人", "Long-Word Crafter"], desc: ["7글자 이상 단어 내기", "7文字以上の単語を出す", "Play a word of 7+ letters"] },
  { id: "w08", k: "bLen", n: 9, rw: ["t"], icon: "🦕", name: ["공룡 단어", "恐竜級の単語", "Dinosaur Word"], desc: ["9글자 이상 단어 내기", "9文字以上の単語を出す", "Play a word of 9+ letters"] },
  { id: "w09", k: "kills", n: 1, rw: ["t"], icon: "💥", name: ["한방 펀치", "一撃パンチ", "One-Hit Punch"], desc: ["한방단어 내기", "一撃単語を出す", "Play a dead-end word"] },
  { id: "w10", k: "kills", n: 20, rw: ["c", "cherry"], icon: "🥊", name: ["한방 사냥꾼", "一撃ハンター", "Dead-End Hunter"], desc: ["한방단어 모두 20번", "一撃単語を合計20回", "Play 20 dead-end words in total"] },
  { id: "w11", k: "wins", n: 1, rw: ["t"], icon: "🏆", name: ["끝말잇기 왕", "しりとり王", "Word Chain King"], desc: ["2명 이상 판에서 1등", "2人以上で1位", "Win a game with 2+ players"] },
  { id: "w12", k: "wins", n: 20, rw: ["c", "gold"], icon: "👑", name: ["왕중왕", "王の中の王", "King of Kings"], desc: ["1등 모두 20번", "1位を合計20回", "Win 20 games in total"] },
  { id: "w13", k: "hardWins", n: 1, rw: ["t"], icon: "🤖", name: ["로봇 사냥꾼", "ロボットハンター", "Robot Hunter"], desc: ["어려움 AI가 있는 판에서 1등", "難しいAIがいる回で1位", "Win a game with a Hard AI"] },
  { id: "w14", k: "hardWins", n: 10, rw: ["c", "night"], icon: "🦾", name: ["AI 정복자", "AI征服者", "AI Conqueror"], desc: ["어려움 AI 판 1등 10번", "難しいAIの回で1位10回", "Win 10 games with a Hard AI"] },
  { id: "w15", k: "bChain", n: 30, rw: ["t"], icon: "🛤️", name: ["긴 선로", "長い線路", "Long Track"], desc: ["30칸째 이어진 단어 내기", "30両目の単語を出す", "Play the 30th word of a chain"] },
  { id: "w16", k: "bChain", n: 60, rw: ["c", "forest"], icon: "🚄", name: ["고속 열차", "高速列車", "Bullet Train"], desc: ["60칸째 이어진 단어 내기", "60両目の単語を出す", "Play the 60th word of a chain"] },
  { id: "w17", k: "bScore", n: 1000, rw: ["t"], icon: "💯", name: ["천 점 돌파", "千点突破", "1,000 Club"], desc: ["한 판 1,000점", "1回で1,000点", "Score 1,000 in one game"] },
  { id: "w18", k: "bScore", n: 3000, rw: ["c", "neon"], icon: "🌟", name: ["삼천 점 스타", "三千点スター", "3,000 Star"], desc: ["한 판 3,000점", "1回で3,000点", "Score 3,000 in one game"] },
  { id: "w19", k: "bWords", n: 20, rw: ["t"], icon: "🗣️", name: ["말잇기 폭주", "しりとり暴走", "Word Spree"], desc: ["한 판에 단어 20개", "1回で単語20個", "Play 20 words in one game"] },
  { id: "w20", k: "fast", n: 30, rw: ["t"], icon: "⚡", name: ["번개 손", "稲妻の手", "Lightning Hands"], desc: ["2.5초 안에 내기 모두 30번", "2.5秒以内に出す 合計30回", "Answer within 2.5s 30 times"] },
  { id: "w21", k: "fast", n: 200, rw: ["c", "lemon"], icon: "🌩️", name: ["빛의 속도", "光の速さ", "Speed of Light"], desc: ["2.5초 안에 내기 모두 200번", "2.5秒以内に出す 合計200回", "Answer within 2.5s 200 times"] },
  { id: "w22", k: "dueum", n: 10, rw: ["t"], icon: "🔤", name: ["두음법칙 박사", "頭音法則博士", "Initial-Sound Expert"], desc: ["두음법칙 글자로 10번 잇기", "頭音法則の文字で10回つなぐ", "Use the initial-sound rule 10 times"] },
  { id: "w23", k: "long6", n: 50, rw: ["t"], icon: "🧵", name: ["긴 단어 수집가", "長い単語コレクター", "Long-Word Collector"], desc: ["6글자 이상 단어 모두 50개", "6文字以上の単語を合計50個", "Play 50 words of 6+ letters"] },
  { id: "w24", k: "flawless", n: 1, rw: ["c", "sakura"], icon: "💖", name: ["무결점 승리", "ノーミス勝利", "Flawless Win"], desc: ["하트를 하나도 안 잃고 1등", "ハートを失わずに1位", "Win without losing a heart"] },
  { id: "w25", k: "daily", n: 1, rw: ["t"], icon: "📅", name: ["오늘의 도전자", "今日の挑戦者", "Daily Challenger"], desc: ["오늘의 도전 끝내기", "今日の挑戦を終える", "Finish a Daily Challenge"] },
  { id: "w26", k: "daily", n: 7, rw: ["c", "rainbow"], icon: "🌈", name: ["매일 출발", "毎日出発", "Daily Departure"], desc: ["오늘의 도전 모두 7번", "今日の挑戦を合計7回", "Finish 7 Daily Challenges"] },
];
// ---------- 오늘의 도전 (서버·화면 같은 계산) ----------
/** 한국 날짜 (YYYY-MM-DD) */
export const todayKst = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
/** 날짜 → 씨앗 */
export const daySeed = (day) => { let h = 2166136261; for (const ch of "duo-wd-" + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** 오늘의 규칙 (날마다 6가지 중 하나) */
export function dailyRules(day) {
  return [
    { turn: 15, minLen: 2, noKill: false, tag: "basic" },
    { turn: 10, minLen: 2, noKill: false, tag: "fast" },
    { turn: 15, minLen: 3, noKill: false, tag: "long" },
    { turn: 15, minLen: 2, noKill: true, tag: "nokill" },
    { turn: 20, minLen: 3, noKill: true, tag: "hard" },
    { turn: 10, minLen: 3, noKill: false, tag: "speedlong" },
  ][daySeed(day) % 6];
}
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
export const achHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const SUM = ["plays", "words", "kills", "wins", "hardWins", "fast", "dueum", "long6", "flawless", "daily"];
const MAX = ["bLen", "bChain", "bScore", "bWords"];
/** 한 판 결과(run)를 쌓인 기록(st)에 더함 */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" && !Array.isArray(st) ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const add = { plays: 1, words: num(run.words), kills: num(run.kills), wins: run.win ? 1 : 0, hardWins: run.win && run.hard ? 1 : 0, fast: num(run.fast), dueum: num(run.dueum), long6: num(run.long6), flawless: run.win && !num(run.miss) ? 1 : 0, daily: run.daily ? 1 : 0 };
  for (const k of SUM) s[k] = num(s[k]) + (add[k] || 0);
  const best = { bLen: num(run.len), bChain: num(run.chain), bScore: num(run.score), bWords: num(run.words) };
  for (const k of MAX) s[k] = Math.max(num(s[k]), best[k]);
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
/** 고른 꾸미기 중 깬 업적 것만 남김 → { c: 색 | null, t: 칭호 업적 id | null } */
export function achEquip(unlocked, want) {
  const u = new Set(unlocked || []), out = { c: null, t: null }, str = (v) => (typeof v === "string" ? v : ""), c = str(want?.c), t = str(want?.t); // 글자만 받음 (이상한 값이 오면 빈칸)
  if (achHas(CAR_COLORS, c) && ACHS.some(a => a.rw[0] === "c" && a.rw[1] === c && u.has(a.id))) out.c = c;
  if (achHas(ACH, t) && ACH[t].rw[0] === "t" && u.has(t)) out.t = t;
  return out;
}
