// =========================
// 플듀 IQ 테스트 진단소 — 공용 핵심 (브라우저·서버 동일 파일)
// 검사 구성(문항 배분) · 채점식(공개) · 플듀 게임 IQ 지수 · 두뇌 유형 · 칭호 · 진단문(한/日/英) · 단체 분석
// 서버 사본: worldcup-backend/src/iq-core.js ↔ 홈페이지 제작/js/iq/core.js (시험이 같은지 검사)
// ※ 공인 IQ 검사가 아님. 인구 백분위·연령 표준치·성별 보정 없음. 같은 검사를 한 사람끼리만 비교.
// =========================
import { TYPES, AREAS, hashSeed, rng, GEN_VERSION } from "./iq-gen.js?v=g4";
export { TYPES, AREAS, hashSeed, rng };

export const CORE_VERSION = 4;          // 채점식·구성 버전 (기록에 함께 저장, 랭킹은 버전이 바뀌어도 유지 · 방송 대항전만 같은 버전끼리) — 2: 점수 환산 엄격·배분 조정(11-01)
export const SET_VERSION = `${CORE_VERSION}.${GEN_VERSION}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---------- 검사 구성 ----------
// [유형, 난이도 1~5] — 정밀 30문항: 8개 영역 모두 (논리4·패턴4·공간4·수리4·언어4·기억3·문제해결4·창의3), 뒤로 갈수록 어려움
export const PLANS = {
  full: [
    ["series", 2], ["rotate", 3], ["span", 2], ["liar", 3], ["order", 4], ["symbols", 4], ["circuit", 5], ["analogy", 5], ["bells", 3], ["make", 3],
    ["lock", 3], ["gears", 4], ["match", 3], ["clock", 4], ["figseq", 5], ["scale", 3], ["mirror", 4], ["syllogism", 5], ["span", 3], ["gridmem", 5],
    ["liar", 5], ["path", 5], ["series", 4], ["rings", 5], ["make", 4], ["matrix", 5], ["oddword", 5], ["match", 4], ["rotate", 5], ["slide", 5],
  ],
  quick: [["matrix", 3], ["series", 2], ["liar", 3], ["rotate", 3], ["lock", 3], ["span", 3], ["symbols", 3], ["slide", 4], ["match", 3], ["analogy", 3]],
  // 오늘의 챌린지: 날짜마다 모두 같은 10문항 / 주간 특별검사: 주마다 모두 같은 20문항(어려움)
  daily: [["figseq", 3], ["series", 3], ["order", 3], ["gears", 4], ["syllogism", 4], ["gridmem", 3], ["symbols", 3], ["path", 4], ["make", 3], ["matrix", 4]],
  weekly: [
    ["matrix", 4], ["series", 4], ["liar", 4], ["circuit", 4], ["analogy", 4], ["bells", 4], ["symbols", 4], ["slide", 4], ["match", 4], ["oddword", 4],
    ["rotate", 5], ["lock", 4], ["mirror", 4], ["syllogism", 5], ["clock", 4], ["rings", 5], ["scale", 4], ["figseq", 5], ["make", 5], ["liar", 5],
  ],
};
export const MODES = Object.keys(PLANS);
export const MODE_TX = {
  quick: { ko: ["빠른검사", "10문항 · 약 6분"], ja: ["クイック検査", "10問 · 約6分"], en: ["Quick Test", "10 items · ~6 min"] },
  full: { ko: ["정밀검사", "30문항 · 약 25분"], ja: ["精密検査", "30問 · 約25分"], en: ["Full Test", "30 items · ~25 min"] },
  daily: { ko: ["오늘의 챌린지", "모두 같은 10문항"], ja: ["今日のチャレンジ", "全員同じ10問"], en: ["Daily Challenge", "Same 10 items for all"] },
  weekly: { ko: ["주간 특별검사", "이번 주 20문항 · 어려움"], ja: ["週間特別検査", "今週の20問・難しい"], en: ["Weekly Special", "This week's 20 · hard"] },
};
const lg = (lang) => (lang === "ja" || lang === "en" ? lang : "ko");
const LI = { ko: 0, ja: 1, en: 2 };
export function modeName(m, lang) { return MODE_TX[m]?.[lg(lang)]?.[0] || m; }
export function modeSub(m, lang) { return MODE_TX[m]?.[lg(lang)]?.[1] || ""; }

// 날짜·주 키 (한국 시간 기준)
export function dayKey(t = Date.now()) { const d = new Date(t + 9 * 3600e3); return d.toISOString().slice(0, 10); }
export function weekKey(t = Date.now()) {
  const d = new Date(t + 9 * 3600e3); const day = (d.getUTCDay() + 6) % 7;   // 월요일 시작
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return mon.toISOString().slice(0, 10);
}
/** 검사 계획: [{type, d, seed}] — daily/weekly는 setKey로 모두 같은 시드 */
export function buildPlan(mode, seed, setKey) {
  const p = PLANS[mode]; if (!p) return null;
  const base = mode === "daily" || mode === "weekly" ? hashSeed(`${mode}:${setKey}:${SET_VERSION}`) : seed >>> 0;
  return p.map(([type, d], i) => ({ type, d, seed: (hashSeed(`${base}:${i}`) ^ (base * 31 + i)) >>> 0 }));
}

// ---------- 영역 ----------
export const AREA_TX = {
  logic: { ko: ["논리 추론", "논리", "논리왕"], ja: ["論理推論", "論理", "論理王"], en: ["Logical Reasoning", "Logic", "Logic King"] },
  pattern: { ko: ["패턴 인식", "패턴", "패턴왕"], ja: ["パターン認識", "パターン", "パターン王"], en: ["Pattern Recognition", "Pattern", "Pattern King"] },
  spatial: { ko: ["공간 지각", "공간", "공간지각왕"], ja: ["空間認識", "空間", "空間認識王"], en: ["Spatial Reasoning", "Spatial", "Spatial King"] },
  numeric: { ko: ["수리 추론", "수리", "수리왕"], ja: ["数理推論", "数理", "数理王"], en: ["Numerical Reasoning", "Numeric", "Number King"] },
  verbal: { ko: ["언어 추론", "언어", "언어왕"], ja: ["言語推論", "言語", "言語王"], en: ["Verbal Reasoning", "Verbal", "Word King"] },
  memory: { ko: ["작업 기억", "기억", "기억력왕"], ja: ["作業記憶", "記憶", "記憶力王"], en: ["Working Memory", "Memory", "Memory King"] },
  problem: { ko: ["문제 해결", "해결", "문제해결왕"], ja: ["問題解決", "解決", "問題解決王"], en: ["Problem Solving", "Solving", "Solver King"] },
  creative: { ko: ["창의적 추론", "창의", "발상왕"], ja: ["創造的推論", "創造", "発想王"], en: ["Creative Reasoning", "Creative", "Idea King"] },
};
export function areaName(a, lang, short = false) { const x = AREA_TX[a]?.[lg(lang)]; return x ? x[short ? 1 : 0] : a; }
export function areaKing(a, lang) { return AREA_TX[a]?.[lg(lang)]?.[2] || a; }

// =========================================================
// 채점 (공개 규칙 — 결과 화면 "점수 계산 방식"에 그대로 보여 줌)
//  문항 점수 = 난이도 가중치 × 정답(기억 문항은 부분 점수 ×0.8) × 시간 계수 × 힌트 계수
//  난이도 가중치: 쉬움1 · 보통1.4 · 어려움1.8 · 전문가2.3 · 최고난도2.8
//  시간 계수: 제한시간의 25% 안에 풀면 1.0, 그 뒤로 줄어 제한시간 끝에 0.6
//  힌트 계수: 힌트를 보면 0.6
//  종합 점수 = 받은 점수 합 ÷ 가중치 합 × 100 (0~100)
//  플듀 게임 IQ 지수 = 종합 점수를 꺾은선 표로 바꿈 (0→60 · 30→80 · 55→100 · 70→110 · 85→124 · 95→137 · 100→145), 이 게임 안에서만 쓰는 점수
// =========================================================
export const WEIGHT = [1, 1.4, 1.8, 2.3, 2.8];
export function speedFactor(ms, lim) { const x = ms / lim; return x <= 0.25 ? 1 : clamp(1 - 0.4 * ((x - 0.25) / 0.75), 0.6, 1); }
export function itemPoints(d, res) {
  if (!res) return 0;
  const w = WEIGHT[d - 1];
  const q = res.ok ? 1 : (res.part || 0) * 0.8;
  if (q <= 0) return 0;
  return w * q * speedFactor(res.ms || 0, res.lim || 60000) * (res.hint ? 0.6 : 1);
}
/** results: [{type, d, area, ok, part, ms, lim, hint}] (계획 순서) */
export function scoreAll(results) {
  let got = 0, max = 0;
  const per = {}; for (const a of AREAS) per[a] = { got: 0, max: 0, n: 0, ok: 0 };
  for (const r of results) {
    const w = WEIGHT[r.d - 1], p = itemPoints(r.d, r);
    got += p; max += w;
    const A = per[r.area]; A.got += p; A.max += w; A.n++; if (r.ok) A.ok++;
  }
  const total = max ? Math.round((got / max) * 100) : 0;
  const areas = {};
  for (const a of AREAS) areas[a] = per[a].max ? Math.round((per[a].got / per[a].max) * 100) : null;
  const correct = results.filter((r) => r.ok).length;
  return { total, iq: gameIQ(total), areas, correct, n: results.length, hints: results.filter((r) => r.hint).length, ms: results.reduce((s, r) => s + (r.ms || 0), 0) };
}
export const IQ_CURVE = [[0, 60], [30, 80], [55, 100], [70, 110], [85, 124], [95, 137], [100, 145]];
export function gameIQ(total) {
  const t = clamp(total, 0, 100);
  for (let i = 1; i < IQ_CURVE.length; i++) { const [x0, y0] = IQ_CURVE[i - 1], [x1, y1] = IQ_CURVE[i]; if (t <= x1) return Math.round(y0 + ((y1 - y0) * (t - x0)) / (x1 - x0)); }
  return 145;
}
// IQ 지수 구간 (게임 내 등급 — 인구 분포 아님)
export const TIERS = [
  [138, "legend", "#f2c230"], [128, "genius", "#b07cff"], [118, "sharp", "#3ec8e8"], [102, "good", "#2fae58"], [88, "warm", "#e8a23c"], [0, "sleep", "#e8463c"],
];
const TIER_TX = {
  legend: { ko: ["전설의 두뇌", "전설"], ja: ["伝説の頭脳", "伝説"], en: ["Legendary Brain", "LEGEND"] },
  genius: { ko: ["천재 판정", "천재"], ja: ["天才判定", "天才"], en: ["Genius Verdict", "GENIUS"] },
  sharp: { ko: ["명석 판정", "명석"], ja: ["明晰判定", "明晰"], en: ["Sharp Mind", "SHARP"] },
  good: { ko: ["우수 판정", "우수"], ja: ["優秀判定", "優秀"], en: ["Solid Mind", "SOLID"] },
  warm: { ko: ["예열 중 판정", "예열"], ja: ["ウォームアップ判定", "予熱"], en: ["Warming Up", "WARMING"] },
  sleep: { ko: ["절전 모드 판정", "절전"], ja: ["省電力モード判定", "省電力"], en: ["Power-Saving Mode", "SLEEP"] },
};
export function tierOf(iq, lang) { const t = TIERS.find(([lo]) => iq >= lo); const x = TIER_TX[t[1]][lg(lang)]; return { key: t[1], color: t[2], name: x[0], stamp: x[1] }; }

// =========================================================
// 진단문 (유머) — 세 언어 목록은 같은 길이·같은 순서 (같은 시드 = 같은 선택)
// =========================================================
const fill = (tpl, m) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (m?.[k] ?? "?"));
const pk = (pool, lang) => pool[lg(lang)] || pool.ko;

// 진단명 — 가장 강한 영역(hi) / 가장 약한 영역(lo)
const DX_AREA = {
  logic: {
    hi: { ko: ["걸어 다니는 추리 소설", "논리 회로 과열 증후군", "셜록 증후군 말기", "반박 불가 판정", "알리바이 파괴자"], ja: ["歩く推理小説", "論理回路オーバーヒート症候群", "シャーロック症候群・末期", "反論不可能判定", "アリバイ破壊者"], en: ["Walking Detective Novel", "Logic Circuit Overheat", "Terminal Sherlock Syndrome", "Irrefutable Verdict", "Alibi Destroyer"] },
    lo: { ko: ["직감 100% 운전자", "추리보다 촉 신봉자", "범인은 늘 집사 증후군", "결론부터 지르는 타입"], ja: ["直感100%ドライバー", "推理より勘信者", "犯人はいつも執事症候群", "結論から突っ込むタイプ"], en: ["100% Gut-feel Driver", "Hunch Over Logic", "'The Butler Did It' Syndrome", "Conclusion-First Type"] },
  },
  pattern: {
    hi: { ko: ["숨은 규칙 탐지기", "패턴 중독 증세", "다음 칸 예언자", "도형 속독가", "모자이크 투시안"], ja: ["隠れルール探知機", "パターン中毒", "次のマス予言者", "図形速読家", "モザイク透視眼"], en: ["Hidden Rule Detector", "Pattern Addiction", "Next-Cell Prophet", "Shape Speed-Reader", "Mosaic X-ray Eyes"] },
    lo: { ko: ["도형과 서먹한 사이", "규칙보다 자유 영혼", "세모 네모 동그라미 혼돈", "패턴 대신 감성파"], ja: ["図形とぎこちない仲", "ルールより自由な魂", "三角四角丸カオス", "パターンより感性派"], en: ["Awkward With Shapes", "Free Spirit Over Rules", "Triangle-Square Chaos", "Vibes Over Patterns"] },
  },
  spatial: {
    hi: { ko: ["머릿속 3D 엔진 탑재", "회전 장인", "공간 지배자", "전선 정리의 신", "거울 미로 탈출 전문가"], ja: ["脳内3Dエンジン搭載", "回転職人", "空間支配者", "配線整理の神", "鏡の迷路脱出のプロ"], en: ["Built-in 3D Engine", "Rotation Artisan", "Master of Space", "God of Cable Management", "Mirror-Maze Escapist"] },
    lo: { ko: ["지도 거꾸로 들기 장인", "왼쪽 오른쪽 협상 중", "회전하면 어지러운 타입", "주차는 세 번에 나눠서"], ja: ["地図逆さ持ち職人", "左右と交渉中", "回すと目が回るタイプ", "駐車は三回に分けて"], en: ["Upside-down Map Expert", "Still Negotiating Left & Right", "Dizzy When Rotating", "Parks in Three Attempts"] },
  },
  numeric: {
    hi: { ko: ["인간 계산기", "숫자 속삭이는 사람", "암산 과다 증후군", "더치페이 정산왕", "수열 해커"], ja: ["人間電卓", "数字のささやき手", "暗算過多症候群", "割り勘精算王", "数列ハッカー"], en: ["Human Calculator", "Number Whisperer", "Mental-Math Overdose", "Bill-Splitting Champion", "Sequence Hacker"] },
    lo: { ko: ["계산기 의존 증후군", "숫자 알레르기 경증", "손가락 계산 장인", "더치페이는 남에게"], ja: ["電卓依存症候群", "数字アレルギー軽症", "指折り計算職人", "割り勘は人任せ"], en: ["Calculator Dependency", "Mild Number Allergy", "Finger-Counting Artisan", "Lets Others Split the Bill"] },
  },
  verbal: {
    hi: { ko: ["말맛 감별사", "걸어 다니는 사전", "비유의 달인", "삼단논법 마스터", "단어 연결 천재"], ja: ["言葉の味鑑定士", "歩く辞書", "たとえの達人", "三段論法マスター", "言葉つなぎの天才"], en: ["Word Sommelier", "Walking Dictionary", "Master of Analogy", "Syllogism Master", "Word-Link Genius"] },
    lo: { ko: ["말보다 행동파", "이심전심 신봉자", "단어가 혀끝에 맴도는 병", "줄임말 전문가"], ja: ["言葉より行動派", "以心伝心信者", "言葉が舌先で止まる病", "略語専門家"], en: ["Actions Over Words", "Believer in Telepathy", "Tip-of-the-Tongue Syndrome", "Abbreviation Specialist"] },
  },
  memory: {
    hi: { ko: ["인간 블랙박스", "한 번 본 건 저장 완료", "기억의 궁전 건축가", "순서 기억 괴물", "종소리 녹음기"], ja: ["人間ブラックボックス", "一度見たら保存完了", "記憶の宮殿建築家", "順番記憶モンスター", "鐘の音レコーダー"], en: ["Human Black Box", "Seen Once, Saved Forever", "Memory Palace Architect", "Sequence Memory Monster", "Bell-Sound Recorder"] },
    lo: { ko: ["금붕어 3초 동호회", "방금 뭐 하려고 했지 증후군", "메모장 필수 탑재형", "기억은 클라우드에"], ja: ["金魚3秒同好会", "今何しようとしたっけ症候群", "メモ帳必須タイプ", "記憶はクラウドに"], en: ["Goldfish 3-Second Club", "'Why Did I Come Here?' Syndrome", "Notepad-Required Model", "Memory Stored in the Cloud"] },
  },
  problem: {
    hi: { ko: ["탈출 게임 단골손님", "막힌 길 뚫는 사람", "퍼즐 해체 전문가", "최단 경로 내비게이션", "장치 작동 장인"], ja: ["脱出ゲームの常連", "行き止まりを突破する人", "パズル解体の専門家", "最短ルートナビ", "装置作動の職人"], en: ["Escape-Room Regular", "Dead-End Breaker", "Puzzle Demolition Expert", "Shortest-Route GPS", "Machine Whisperer"] },
    lo: { ko: ["일단 다 밀어 보는 타입", "출구는 마음속에", "블록과 대치 중", "돌아가는 길 애호가"], ja: ["とりあえず全部押すタイプ", "出口は心の中に", "ブロックとにらみ合い中", "回り道愛好家"], en: ["Push-Everything-First Type", "The Exit Is in Your Heart", "In a Standoff With Blocks", "Scenic-Route Enthusiast"] },
  },
  creative: {
    hi: { ko: ["발상의 전환 장인", "성냥개비 마술사", "틀 밖 사고 중독", "엉뚱한데 정답", "아이디어 발전소"], ja: ["発想の転換職人", "マッチ棒マジシャン", "枠外思考中毒", "変だけど正解", "アイデア発電所"], en: ["Lateral-Thinking Artisan", "Matchstick Magician", "Out-of-the-Box Addict", "Weird but Right", "Idea Power Plant"] },
    lo: { ko: ["정석 지킴이", "교과서 그대로파", "성냥은 불 붙이는 용도", "발상보다 성실파"], ja: ["定石の守り人", "教科書どおり派", "マッチは火をつけるもの", "発想より真面目派"], en: ["Guardian of the Textbook", "By-the-Book Type", "Matches Are for Fire", "Diligence Over Ideas"] },
  },
};
// 지수 구간별 진단명
const DX_TIER = {
  legend: { ko: ["연구소 블랙리스트 등재(너무 잘해서)", "두뇌 오버클럭 확인", "측정기 고장 의심 판정", "인간 슈퍼컴퓨터"], ja: ["研究所ブラックリスト入り（優秀すぎて）", "頭脳オーバークロック確認", "測定器故障の疑い", "人間スーパーコンピューター"], en: ["Lab Blacklisted (Too Good)", "Brain Overclock Confirmed", "Suspected Meter Malfunction", "Human Supercomputer"] },
  genius: { ko: ["연구원 스카우트 대상", "두뇌 풀가동 상태", "퍼즐계 유망주", "회색 뇌세포 과다"], ja: ["研究員スカウト対象", "頭脳フル稼働", "パズル界の有望株", "灰色の脳細胞過多"], en: ["Scouted by the Lab", "Brain at Full Power", "Puzzle Prodigy", "Excess Little Grey Cells"] },
  sharp: { ko: ["두뇌 컨디션 맑음", "똑똑함 새어 나오는 중", "뇌 주름 정상 영업", "반짝 두뇌 판정"], ja: ["頭脳コンディション快晴", "賢さが漏れ出し中", "脳のしわ通常営業", "キラリ頭脳判定"], en: ["Brain Forecast: Clear", "Smartness Leaking Out", "Brain Wrinkles Open for Business", "Sparkling Mind"] },
  good: { ko: ["건강한 두뇌 시민", "평균 이상 안정 운행", "무난 탄탄 두뇌", "생각 엔진 정상"], ja: ["健康な頭脳市民", "平均以上の安定運行", "無難で堅実な頭脳", "思考エンジン正常"], en: ["Healthy Brain Citizen", "Steady Above-Average Cruise", "Solid & Reliable Brain", "Thinking Engine OK"] },
  warm: { ko: ["두뇌 예열 중", "아직 부팅 중", "커피 한 잔 필요 판정", "생각 로딩 중..."], ja: ["頭脳予熱中", "まだ起動中", "コーヒー1杯必要判定", "思考ロード中..."], en: ["Brain Warming Up", "Still Booting", "Needs One Coffee", "Thinking... Loading..."] },
  sleep: { ko: ["두뇌 절전 모드", "오늘은 쉬는 날 뇌", "생각 휴가 중", "뇌가 퇴근함"], ja: ["頭脳省電力モード", "今日は休みの日の脳", "思考休暇中", "脳が退勤した"], en: ["Brain in Power-Saving Mode", "Brain's Day Off", "Thoughts on Vacation", "Brain Clocked Out"] },
};
// 특별 상황
const DX_SPECIAL = [
  [(c) => c.correct === c.n && c.n >= 10, 99, { ko: ["만점 괴물 출현", "연구소 기록 갈아엎음"], ja: ["満点モンスター出現", "研究所の記録を塗り替え"], en: ["Perfect-Score Monster", "Rewrote the Lab Records"] }],
  [(c) => c.hints >= 4, 70, { ko: ["힌트 VIP 회원", "힌트와 절친 사이"], ja: ["ヒントVIP会員", "ヒントと大親友"], en: ["Hint VIP Member", "Best Friends With Hints"] }],
  [(c) => c.fast && c.total >= 70, 75, { ko: ["번개 두뇌", "생각보다 손이 빠른데 정답"], ja: ["稲妻頭脳", "考えより手が速いのに正解"], en: ["Lightning Brain", "Hands Faster Than Thought — Still Right"] }],
  [(c) => c.spread >= 55, 68, { ko: ["극과 극 두뇌", "한 우물만 판 천재"], ja: ["極端な頭脳", "一点集中型の天才"], en: ["Brain of Extremes", "One-Trick Genius"] }],
  [(c) => c.spread <= 15 && c.total >= 55, 64, { ko: ["육각형 두뇌", "빈틈없는 올라운더"], ja: ["六角形の頭脳", "隙のないオールラウンダー"], en: ["Hexagon Brain", "Flawless All-Rounder"] }],
  [(c) => c.timeouts >= 4, 66, { ko: ["시간 여행자(늘 늦음)", "느긋한 사색가"], ja: ["時間旅行者（いつも遅刻）", "のんびり思索家"], en: ["Time Traveler (Always Late)", "Leisurely Philosopher"] }],
];
// 두뇌 유형 = 가장 강한 영역(명사) + 두 번째(형용사)
const TYPE_NOUN = {
  logic: { ko: ["탐정형 두뇌", "단서를 엮어 결론을 내는 타입. 말싸움에서 지는 법이 없어요."], ja: ["探偵型頭脳", "手がかりを結んで結論を出すタイプ。口げんかで負け知らず。"], en: ["Detective Brain", "Connects clues into conclusions. Never loses an argument."] },
  pattern: { ko: ["관찰자형 두뇌", "남들이 못 본 규칙을 먼저 봐요. 숨은그림찾기는 늘 1등."], ja: ["観察者型頭脳", "人が見落とすルールを先に見つけます。"], en: ["Observer Brain", "Spots rules others miss. Always first at hidden-object games."] },
  spatial: { ko: ["건축가형 두뇌", "머릿속에서 모양을 돌리고 쌓는 타입. 가구 조립 설명서가 필요 없어요."], ja: ["建築家型頭脳", "頭の中で形を回して積むタイプ。家具の説明書いらず。"], en: ["Architect Brain", "Rotates and stacks shapes in your head. Skips furniture manuals."] },
  numeric: { ko: ["회계사형 두뇌", "숫자 사이 관계가 보이는 타입. 영수증 계산은 맡겨 주세요."], ja: ["会計士型頭脳", "数字の関係が見えるタイプ。レシート計算はお任せ。"], en: ["Accountant Brain", "Sees how numbers relate. Hand them the receipt."] },
  verbal: { ko: ["작가형 두뇌", "말과 개념을 자유롭게 엮어요. 비유 하나로 분위기를 바꿔요."], ja: ["作家型頭脳", "言葉と概念を自由につなぎます。"], en: ["Writer Brain", "Weaves words and ideas freely. One metaphor changes the room."] },
  memory: { ko: ["기록관형 두뇌", "한 번 들은 건 놓치지 않는 타입. 단톡방 공지 요약 담당."], ja: ["記録官型頭脳", "一度聞いたことは逃さないタイプ。"], en: ["Archivist Brain", "Never forgets what you heard once. The group chat's memory."] },
  problem: { ko: ["엔지니어형 두뇌", "막히면 뚫는 타입. 고장 난 건 일단 당신에게 와요."], ja: ["エンジニア型頭脳", "詰まったら突破するタイプ。壊れた物はまずあなたへ。"], en: ["Engineer Brain", "Hits a wall, breaks through. Broken things find their way to you."] },
  creative: { ko: ["발명가형 두뇌", "정답으로 가는 엉뚱한 지름길을 찾아요."], ja: ["発明家型頭脳", "正解への突飛な近道を見つけます。"], en: ["Inventor Brain", "Finds odd shortcuts to the right answer."] },
};
const TYPE_ADJ = {
  logic: { ko: "냉철한", ja: "冷静な", en: "Cool-headed" }, pattern: { ko: "눈썰미 좋은", ja: "目ざとい", en: "Sharp-eyed" }, spatial: { ko: "입체적인", ja: "立体的な", en: "Three-dimensional" },
  numeric: { ko: "계산 빠른", ja: "計算の速い", en: "Quick-counting" }, verbal: { ko: "말 잘하는", ja: "弁の立つ", en: "Silver-tongued" }, memory: { ko: "기억력 좋은", ja: "記憶力抜群の", en: "Sharp-memoried" },
  problem: { ko: "끈질긴", ja: "粘り強い", en: "Relentless" }, creative: { ko: "엉뚱한", ja: "ユニークな", en: "Quirky" },
};
const TYPE_LOW = { ko: ["잠자는 사자형 두뇌", "아직 실력을 숨기고 있는 타입. 다음 검사에서 깨어날지도?"], ja: ["眠れる獅子型頭脳", "まだ実力を隠しているタイプ。次の検査で目覚めるかも？"], en: ["Sleeping Lion Brain", "Still hiding your power. Maybe it wakes up next time?"] };

// 연구원 소견
const OPEN = [
  [80, { ko: ["검사 장비가 당신 때문에 잠깐 과열됐어요.", "연구소장님이 당신 기록을 보고 안경을 고쳐 썼어요.", "오늘 연구소 최고의 손님이에요."], ja: ["あなたのせいで検査装置が少し過熱しました。", "所長があなたの記録を見て眼鏡をかけ直しました。", "今日の研究所で最高のお客様です。"], en: ["Our equipment overheated for a moment because of you.", "The lab director adjusted their glasses at your record.", "You're the best visitor in the lab today."] }],
  [60, { ko: ["두뇌 엔진이 부드럽게 돌아가고 있어요.", "생각의 속도와 정확도가 모두 안정적이에요.", "꽤 많은 문제에서 연구원들이 고개를 끄덕였어요."], ja: ["頭脳エンジンが滑らかに回っています。", "思考の速さも正確さも安定しています。", "多くの問題で研究員たちがうなずいていました。"], en: ["Your brain engine is running smoothly.", "Both speed and accuracy look stable.", "Researchers nodded at many of your answers."] }],
  [40, { ko: ["잘하는 분야와 쉬는 분야가 뚜렷해요.", "실력의 반은 꺼내 놓고, 반은 아껴 둔 느낌이에요.", "몇몇 문제에서는 번뜩임이 보였어요."], ja: ["得意分野とお休み分野がはっきりしています。", "実力の半分は出して、半分はとっておいた感じです。", "いくつかの問題でひらめきが見えました。"], en: ["Your strong and resting areas are clear.", "Feels like you showed half your power and saved the rest.", "We saw flashes of insight on several items."] }],
  [0, { ko: ["오늘 두뇌는 아직 이불 속에 있는 것 같아요.", "검사기가 '로딩 중' 표시를 띄웠어요.", "연구원이 조용히 사탕을 하나 건넸어요."], ja: ["今日の頭脳はまだ布団の中のようです。", "検査機が「ロード中」と表示しました。", "研究員がそっと飴をひとつ渡しました。"], en: ["Your brain seems to still be under the blanket today.", "The scanner displayed 'Loading...'.", "A researcher quietly handed you a candy."] }],
];
const BEST_TXT = {
  logic: { ko: ["{area} {s}점 — 거짓말쟁이는 당신 앞에서 버티지 못해요.", "{area} {s}점 — 조건이 많을수록 오히려 신나는 타입이에요."], ja: ["{area} {s}点 — 嘘つきはあなたの前では持ちこたえられません。", "{area} {s}点 — 条件が多いほど燃えるタイプです。"], en: ["{area} {s} — liars don't stand a chance against you.", "{area} {s} — the more conditions, the more fun for you."] },
  pattern: { ko: ["{area} {s}점 — 도형들이 당신에게 비밀을 털어놨어요.", "{area} {s}점 — 다음 칸이 뭔지 보기도 전에 알았죠?"], ja: ["{area} {s}点 — 図形たちがあなたに秘密を打ち明けました。", "{area} {s}点 — 次のマスを見る前にわかっていましたね？"], en: ["{area} {s} — the shapes told you their secrets.", "{area} {s} — you knew the next cell before looking, right?"] },
  spatial: { ko: ["{area} {s}점 — 머릿속 회전 속도가 거의 게임 엔진급이에요.", "{area} {s}점 — 전선과 거울이 당신 말을 잘 들어요."], ja: ["{area} {s}点 — 頭の中の回転速度がほぼゲームエンジン級です。", "{area} {s}点 — 配線と鏡があなたの言うことをよく聞きます。"], en: ["{area} {s} — your mental rotation runs at game-engine speed.", "{area} {s} — wires and mirrors obey you."] },
  numeric: { ko: ["{area} {s}점 — 숫자들이 줄 서서 정답을 알려 줬어요.", "{area} {s}점 — 계산기를 꺼낼 필요가 없었네요."], ja: ["{area} {s}点 — 数字たちが列になって正解を教えてくれました。", "{area} {s}点 — 電卓を出す必要がありませんでした。"], en: ["{area} {s} — the numbers lined up to tell you the answer.", "{area} {s} — no calculator needed."] },
  verbal: { ko: ["{area} {s}점 — 단어 사이의 숨은 끈을 정확히 잡았어요.", "{area} {s}점 — 말장난 같은 논리도 꿰뚫어 봤어요."], ja: ["{area} {s}点 — 言葉の間の見えない糸を正確につかみました。", "{area} {s}点 — 言葉遊びのような論理も見抜きました。"], en: ["{area} {s} — you caught the hidden thread between words.", "{area} {s} — you saw through wordplay logic."] },
  memory: { ko: ["{area} {s}점 — 종소리 순서를 녹음기처럼 재생했어요.", "{area} {s}점 — 사라진 숫자도 당신 머릿속엔 남아 있었어요."], ja: ["{area} {s}点 — 鐘の順番を録音機のように再生しました。", "{area} {s}点 — 消えた数字もあなたの頭には残っていました。"], en: ["{area} {s} — you replayed the bells like a recorder.", "{area} {s} — vanished digits stayed in your head."] },
  problem: { ko: ["{area} {s}점 — 막힌 블록 사이로 길을 냈어요.", "{area} {s}점 — 장치들이 당신 손에서 술술 풀렸어요."], ja: ["{area} {s}点 — 詰まったブロックの間に道を作りました。", "{area} {s}点 — 装置があなたの手でするすると解けました。"], en: ["{area} {s} — you carved a path through jammed blocks.", "{area} {s} — machines unraveled in your hands."] },
  creative: { ko: ["{area} {s}점 — 성냥 하나로 세상을 바꿨어요.", "{area} {s}점 — 남들이 안 보는 쪽에서 답을 찾았어요."], ja: ["{area} {s}点 — マッチ1本で世界を変えました。", "{area} {s}点 — 人が見ない方向から答えを見つけました。"], en: ["{area} {s} — one matchstick changed the world.", "{area} {s} — you found answers where others don't look."] },
};
const WORST_TXT = {
  logic: { ko: ["{area}은 조금 쉬어 갔어요. 조건을 하나씩 지우면서 풀면 금방 올라요."], ja: ["{area}は少しお休み。条件を一つずつ消していけばすぐ上がります。"], en: ["{area} took a break. Cross out conditions one by one and it'll climb fast."] },
  pattern: { ko: ["{area}은 아직 서먹해요. 가로줄·세로줄을 따로 보면 규칙이 보여요."], ja: ["{area}はまだぎこちない。横と縦を別々に見るとルールが見えます。"], en: ["{area} is still shy. Check rows and columns separately to see rules."] },
  spatial: { ko: ["{area}은 오늘 어지러웠나 봐요. 손가락으로 돌려 보는 상상을 해 보세요."], ja: ["{area}は今日目が回ったようです。指で回す想像をしてみてください。"], en: ["{area} got dizzy today. Try imagining turning it with your finger."] },
  numeric: { ko: ["{area}은 숨 고르기 중. 앞뒤 숫자 차이부터 적어 보면 쉬워져요."], ja: ["{area}は息を整え中。前後の差から書き出すと楽になります。"], en: ["{area} is catching its breath. Write down the differences first."] },
  verbal: { ko: ["{area}은 말이 엉켰어요. 두 낱말의 관계를 한 문장으로 말해 보세요."], ja: ["{area}は言葉が絡まりました。2語の関係を一文で言ってみましょう。"], en: ["{area} got tangled. Say the relationship between the two words as a sentence."] },
  memory: { ko: ["{area}은 저장 공간 정리 중. 덩어리로 묶어서 외우면 훨씬 편해요."], ja: ["{area}は保存容量を整理中。かたまりで覚えるとずっと楽です。"], en: ["{area} is clearing storage. Chunking makes it much easier."] },
  problem: { ko: ["{area}은 길을 잃었어요. 목표에서 거꾸로 생각해 보세요."], ja: ["{area}は道に迷いました。ゴールから逆に考えてみましょう。"], en: ["{area} got lost. Try thinking backward from the goal."] },
  creative: { ko: ["{area}은 아직 정석파. '규칙을 바꿔도 되나?'부터 의심해 보세요."], ja: ["{area}はまだ定石派。「ルールを変えてもいい？」と疑ってみましょう。"], en: ["{area} is still by-the-book. Start by asking 'can I bend this rule?'"] },
};
const SPEED_TXT = {
  fast: { ko: ["풀이 속도가 아주 빨라요. 생각이 손보다 먼저 도착해요.", "검사 시간이 남아서 연구원이 당황했어요."], ja: ["解く速度がとても速いです。", "検査時間が余って研究員が戸惑いました。"], en: ["You solve very fast — thoughts arrive before your hands.", "You had so much time left the researchers got flustered."] },
  slow: { ko: ["천천히 확실하게 푸는 타입이에요. 제한시간과 조금만 친해지면 점수가 확 올라요.", "꼼꼼함은 최고예요. 다만 시계도 가끔 봐 주세요."], ja: ["ゆっくり確実に解くタイプ。制限時間と少し仲良くなれば点数が一気に上がります。", "丁寧さは最高。ただ時計もたまに見てください。"], en: ["You solve slowly and surely. Make friends with the timer and your score will jump.", "Thoroughness is top-notch — just glance at the clock sometimes."] },
};
const HINT_TXT = { ko: ["힌트를 {n}번 썼어요. 다음엔 힌트 없이 한 번 도전해 보세요!"], ja: ["ヒントを{n}回使いました。次はヒントなしで挑戦してみましょう！"], en: ["You used {n} hints. Try one run without hints next time!"] };
const RANK_TXT = {
  first: { ko: "함께 검사한 {of}명 중 1위! 오늘의 두뇌 왕이에요.", ja: "一緒に検査した{of}人中1位！今日の頭脳王です。", en: "1st of {of}! Today's brain champion." },
  mid: { ko: "함께 검사한 {of}명 중 {rank}위예요.", ja: "一緒に検査した{of}人中{rank}位です。", en: "Ranked {rank} of {of}." },
  last: { ko: "함께 검사한 {of}명 중 {rank}위. 분위기 메이커 역할은 확실히 했어요.", ja: "一緒に検査した{of}人中{rank}位。ムードメーカーは確実に果たしました。", en: "Ranked {rank} of {of} — you nailed the mood-maker role." },
  up: { ko: "지난 검사보다 {d}점 올랐어요. 두뇌가 자라는 중!", ja: "前回より{d}点アップ。頭脳が成長中！", en: "Up {d} points from last time — your brain is growing!" },
  down: { ko: "지난 검사보다 {d}점 내려갔어요. 오늘은 컨디션 탓으로 해 둘게요.", ja: "前回より{d}点ダウン。今日は体調のせいにしておきましょう。", en: "Down {d} points from last time. Let's blame today's condition." },
};
const RETEST = { ko: ["푹 자고 내일 다시 오면 다른 결과가 나올지도 몰라요.", "친구를 데려와서 같이 검사해 보세요. 비교하는 재미가 있어요.", "약한 영역만 개별 연습으로 다시 해 보세요."], ja: ["ぐっすり寝て明日また来ると違う結果になるかも。", "友達を連れて一緒に検査してみましょう。", "苦手な領域だけ個別練習でもう一度。"], en: ["Sleep well and come back tomorrow — results may differ.", "Bring a friend and compare your results.", "Practice just your weakest area again."] };

// 칭호 (달성 조건이 분명한 것만)
export const TITLES = {
  perfect: { ko: ["만점의 신", "모든 문항 정답"], ja: ["満点の神", "全問正解"], en: ["God of Perfection", "All items correct"] },
  nohint: { ko: ["힌트 없는 탐구자", "힌트 없이 정답률 80% 이상"], ja: ["ヒントなし探究者", "ヒントなしで正答率80%以上"], en: ["Hintless Explorer", "80%+ correct without hints"] },
  speed: { ko: ["번개 두뇌", "정답의 절반 이상을 제한시간 25% 안에"], ja: ["稲妻頭脳", "正解の半分以上を制限時間25%以内に"], en: ["Lightning Brain", "Half of correct answers within 25% of the limit"] },
  allround: { ko: ["육각형 두뇌", "모든 영역 60점 이상"], ja: ["六角形の頭脳", "全領域60点以上"], en: ["Hexagon Brain", "Every area 60+"] },
  master: { ko: ["{area} 마스터", "한 영역 100점"], ja: ["{area}マスター", "ある領域で100点"], en: ["{area} Master", "100 in one area"] },
  comeback: { ko: ["역전의 두뇌", "후반 10문항 정답률이 전반보다 30%p 이상 높음"], ja: ["逆転の頭脳", "後半10問の正答率が前半より30pt以上高い"], en: ["Comeback Brain", "Last 10 items 30pp better than first 10"] },
  memory9: { ko: ["인간 녹음기", "기억 문항 모두 정답"], ja: ["人間レコーダー", "記憶問題すべて正解"], en: ["Human Recorder", "All memory items correct"] },
  expert: { ko: ["전문가 문항 정복자", "최고난도 문항 정답"], ja: ["最難関制覇者", "最高難度の問題に正解"], en: ["Expert Conqueror", "Solved a top-difficulty item"] },
};
export function titleText(t, lang) { const x = TITLES[t.k]?.[lg(lang)]; return x ? { name: fill(x[0], { area: t.a ? areaName(t.a, lang, true) : "" }), desc: x[1] } : { name: t.k, desc: "" }; }
export function earnTitles(results, sc) {
  const out = [];
  if (sc.correct === sc.n && sc.n >= 10) out.push({ k: "perfect" });
  const noH = results.filter((r) => !r.hint); if (sc.hints === 0 && sc.correct / sc.n >= 0.8) out.push({ k: "nohint" });
  const ok = results.filter((r) => r.ok); if (ok.length >= 5 && ok.filter((r) => r.ms <= r.lim * 0.25).length >= ok.length / 2) out.push({ k: "speed" });
  const av = Object.values(sc.areas).filter((v) => v !== null); if (av.length >= 6 && av.every((v) => v >= 60)) out.push({ k: "allround" });
  for (const [a, v] of Object.entries(sc.areas)) if (v === 100) out.push({ k: "master", a });
  if (results.length >= 20) { const f = results.slice(0, 10).filter((r) => r.ok).length, b = results.slice(-10).filter((r) => r.ok).length; if (b - f >= 3) out.push({ k: "comeback" }); }
  const mem = results.filter((r) => r.area === "memory"); if (mem.length >= 2 && mem.every((r) => r.ok)) out.push({ k: "memory9" });
  if (results.some((r) => r.d >= 5 && r.ok)) out.push({ k: "expert" });
  void noH;
  return out.slice(0, 4);
}

const pickI = (R, n) => Math.floor(R() * n);
/**
 * 진단 — o: { results:[...], seed, rank?, of?, prev?: {total}, lang? }
 * 같은 입력·같은 시드면 언어만 달라도 같은 선택
 */
export function diagnose(o) {
  const lang = lg(o.lang);
  const R = rng((o.seed >>> 0) ^ 0x2545f491);
  const res = o.results || [];
  const sc = scoreAll(res);
  const ids = Object.keys(sc.areas).filter((a) => sc.areas[a] !== null);
  const sorted = ids.slice().sort((a, b) => sc.areas[b] - sc.areas[a]);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const okRes = res.filter((r) => r.ok);
  const ctx = {
    total: sc.total, correct: sc.correct, n: sc.n, hints: sc.hints,
    spread: ids.length ? sc.areas[best] - sc.areas[worst] : 0,
    fast: okRes.length >= 3 && okRes.filter((r) => r.ms <= r.lim * 0.25).length >= okRes.length * 0.6,
    timeouts: res.filter((r) => r.timeout).length,
  };
  const tier = tierOf(sc.iq, lang);
  const cand = [];
  for (const [cond, pr, names] of DX_SPECIAL) if (cond(ctx)) cand.push({ pr: pr + R() * 3, names });
  if (best && sc.areas[best] >= 80) cand.push({ pr: 60 + (sc.areas[best] - 80) + R() * 6, names: DX_AREA[best].hi });
  if (worst && sc.areas[worst] <= 35) cand.push({ pr: 57 + (35 - sc.areas[worst]) * 0.5 + R() * 6, names: DX_AREA[worst].lo });
  cand.push({ pr: 55 + Math.abs(sc.total - 55) * 0.4 + R() * 6, names: DX_TIER[tier.key] });
  cand.sort((a, b) => b.pr - a.pr);
  const ti = pickI(R, cand[0].names.ko.length);
  const title = pk(cand[0].names, lang)[ti];
  let sub = null;
  if (cand[1]) { let si = pickI(R, cand[1].names.ko.length); if (cand[1].names === cand[0].names && si === ti) si = (si + 1) % cand[1].names.ko.length; sub = pk(cand[1].names, lang)[si]; }
  const code = `IQ-${(hashSeed(cand[0].names.ko[ti]) % 90) + 10}.${sc.iq % 10}`;
  let type;
  if (sc.total < 25 || !sorted.length) { const t = pk(TYPE_LOW, lang); type = { name: t[0], desc: t[1], main: sorted[0] || null }; }
  else { const a1 = sorted[0], a2 = sorted[1] || a1; const noun = pk(TYPE_NOUN[a1], lang); type = { name: `${a1 === a2 ? "" : TYPE_ADJ[a2][lang] + (lang === "ja" ? "" : " ")}${noun[0]}`, desc: noun[1], main: a1 }; }
  const op = [];
  const openRow = OPEN.find(([lo]) => sc.total >= lo)[1];
  op.push(pk(openRow, lang)[pickI(R, openRow.ko.length)]);
  if (best && sc.areas[best] >= 55) op.push(fill(pk(BEST_TXT[best], lang)[pickI(R, BEST_TXT[best].ko.length)], { area: areaName(best, lang), s: sc.areas[best] }));
  if (worst && worst !== best && sc.areas[worst] < 60) op.push(fill(pk(WORST_TXT[worst], lang)[0], { area: areaName(worst, lang) }));
  if (ctx.fast) op.push(pk(SPEED_TXT.fast, lang)[pickI(R, 2)]);
  else if (ctx.timeouts >= 3) op.push(pk(SPEED_TXT.slow, lang)[pickI(R, 2)]);
  if (sc.hints >= 2) op.push(fill(pk(HINT_TXT, lang)[0], { n: sc.hints }));
  if (o.rank && o.of >= 2) op.push(fill(RANK_TXT[o.rank === 1 ? "first" : o.rank === o.of ? "last" : "mid"][lang], { rank: o.rank, of: o.of }));
  const delta = o.prev ? sc.total - o.prev.total : 0;
  if (o.prev && Math.abs(delta) >= 3) op.push(fill(RANK_TXT[delta > 0 ? "up" : "down"][lang], { d: Math.abs(delta) }));
  const titles = earnTitles(res, sc);
  return {
    total: sc.total, iq: sc.iq, areas: sc.areas, correct: sc.correct, n: sc.n, hints: sc.hints,
    tier, title, sub, code, type, opinion: op, titles: titles.map((t) => ({ ...t, ...titleText(t, lang) })),
    best: best ? { id: best, name: areaName(best, lang), score: sc.areas[best] } : null,
    worst: worst ? { id: worst, name: areaName(worst, lang), score: sc.areas[worst] } : null,
    retest: pk(RETEST, lang)[pickI(R, RETEST.ko.length)], lang,
    seed: o.seed >>> 0, rank: o.rank || 0, of: o.of || 0, prevTotal: o.prev ? o.prev.total : null,
  };
}
// 저장된 결과를 보는 사람 언어로 다시 (점수는 그대로)
export function localizeDiag(row, lang) {
  if (!row?.diag || lg(lang) === (row.diag.lang || "ko") || !Array.isArray(row.items)) return row;
  const d = diagnose({ results: row.items, seed: row.diag.seed, rank: row.diag.rank, of: row.diag.of, prev: row.diag.prevTotal != null ? { total: row.diag.prevTotal } : null, lang });
  return { ...row, diag: d };
}

// =========================================================
// 단체 분석 (8인 멀티·방송) — players: [{id, total, iq, areas, items}]
// =========================================================
const LAST_RX = {
  ko: ["꼴찌 특별 처방: 오늘 밤은 뇌에게 휴가를 주세요.", "꼴찌 특별 처방: 1위에게 비법 강의를 듣는 수업료는 음료 한 잔.", "꼴찌 특별 처방: 다음 판 '컨디션 핑계 쿠폰' 1장 지급.", "꼴찌 특별 처방: 이 결과는 겸손함으로 기록합니다.", "꼴찌 특별 처방: 재검사 때 응원단 2명 동행 허가."],
  ja: ["最下位特別処方：今夜は脳に休暇を。", "最下位特別処方：1位の秘訣講座の受講料はジュース1杯。", "最下位特別処方：次の試合「体調のせいクーポン」1枚支給。", "最下位特別処方：この結果は謙虚さとして記録します。", "最下位特別処方：再検査時、応援団2名の同行を許可。"],
  en: ["Last-place Rx: give your brain the night off.", "Last-place Rx: the winner's masterclass costs one drink.", "Last-place Rx: one 'bad day' excuse coupon for next round.", "Last-place Rx: we'll record this as humility.", "Last-place Rx: you may bring two cheerleaders to your retest."],
};
const WARD = [
  [75, { ko: ["두뇌 올림픽 국가대표실", "천재들의 휴게실"], ja: ["頭脳オリンピック代表室", "天才たちの休憩室"], en: ["Brain Olympics Team Room", "Geniuses' Lounge"] }],
  [55, { ko: ["명석한 두뇌 연구실", "반짝이는 생각 실험실"], ja: ["明晰な頭脳研究室", "きらめく思考実験室"], en: ["Bright Minds Lab", "Sparkling Thoughts Lab"] }],
  [40, { ko: ["평균의 신 연구실", "무난한 생각 공방"], ja: ["平均の神研究室", "無難な思考工房"], en: ["Lab of the Average", "Steady Thinking Workshop"] }],
  [0, { ko: ["두뇌 예열 대기실", "절전 모드 휴게실"], ja: ["頭脳予熱待合室", "省電力モード休憩室"], en: ["Brain Warm-up Room", "Power-Saving Lounge"] }],
];
export function groupReport(players, seed = 1, lang = "ko") {
  const R = rng(seed ^ 0x51ed27);
  const order = [...players].sort((a, b) => b.total - a.total || (a.ms || 0) - (b.ms || 0));
  let rank = 0, prev = null;
  const ranking = order.map((p, i) => { if (p.total !== prev) rank = i + 1; prev = p.total; return { id: p.id, rank, total: p.total, iq: p.iq }; });
  // 영역별 1위 (논리왕·기억력왕…)
  const kings = {};
  for (const a of AREAS) {
    let best = null;
    for (const p of players) { const v = p.areas?.[a]; if (v == null) continue; if (!best || v > best.v) best = { id: p.id, v }; }
    if (best && best.v > 0) kings[a] = best;
  }
  const avgTotal = Math.round(mean(players.map((p) => p.total)));
  const avgIq = Math.round(mean(players.map((p) => p.iq)));
  const wardRow = WARD.find(([lo]) => avgTotal >= lo)[1];
  const wardIdx = pickI(R, wardRow.ko.length), lastIdx = pickI(R, LAST_RX.ko.length);
  return { ranking, kings, avgTotal, avgIq, ward: pk(wardRow, lang)[wardIdx], wardIdx, lastRx: players.length >= 2 ? pk(LAST_RX, lang)[lastIdx] : null, lastIdx, lastId: players.length >= 2 ? ranking[ranking.length - 1].id : null };
}
export function localizeReport(rep, lang) {
  if (!rep) return rep;
  const wardRow = WARD.find(([lo]) => rep.avgTotal >= lo)[1];
  return { ...rep, ward: rep.wardIdx != null ? pk(wardRow, lang)[rep.wardIdx] : rep.ward, lastRx: rep.lastRx && rep.lastIdx != null ? pk(LAST_RX, lg(lang))[rep.lastIdx] : rep.lastRx };
}

// ---------- 시험용 ----------
export function phraseCount() {
  let n = 0;
  for (const v of Object.values(DX_AREA)) n += v.hi.ko.length + v.lo.ko.length;
  for (const v of Object.values(DX_TIER)) n += v.ko.length;
  for (const r of DX_SPECIAL) n += r[2].ko.length;
  for (const r of OPEN) n += r[1].ko.length;
  for (const v of Object.values(BEST_TXT)) n += v.ko.length;
  for (const v of Object.values(WORST_TXT)) n += v.ko.length;
  n += SPEED_TXT.fast.ko.length + SPEED_TXT.slow.ko.length + RETEST.ko.length + LAST_RX.ko.length + Object.keys(TYPE_NOUN).length + Object.keys(TITLES).length;
  for (const r of WARD) n += r[1].ko.length;
  return n;
}
export function checkLangParity() {
  const bad = [];
  const chk = (name, o) => { const n = o.ko.length; for (const l of ["ja", "en"]) if (!Array.isArray(o[l]) || o[l].length !== n) bad.push(`${name}.${l}`); };
  for (const [k, v] of Object.entries(DX_AREA)) { chk(`DX.${k}.hi`, v.hi); chk(`DX.${k}.lo`, v.lo); }
  for (const [k, v] of Object.entries(DX_TIER)) chk(`TIER.${k}`, v);
  DX_SPECIAL.forEach((r, i) => chk(`SP.${i}`, r[2]));
  OPEN.forEach((r, i) => chk(`OPEN.${i}`, r[1]));
  for (const [k, v] of Object.entries(BEST_TXT)) chk(`BEST.${k}`, v);
  for (const [k, v] of Object.entries(WORST_TXT)) chk(`WORST.${k}`, v);
  for (const [k, v] of Object.entries(TYPE_NOUN)) chk(`TYPE.${k}`, v);
  for (const [k, v] of Object.entries(TITLES)) chk(`TITLE.${k}`, v);
  chk("RETEST", RETEST); chk("LAST_RX", LAST_RX); chk("SPEED.fast", SPEED_TXT.fast); chk("SPEED.slow", SPEED_TXT.slow); chk("HINT", HINT_TXT); chk("TYPE_LOW", TYPE_LOW);
  WARD.forEach((r, i) => chk(`WARD.${i}`, r[1]));
  return bad;
}
void LI;
