// =========================
// DUO GAME ZONE / 인생게임 v3 시스템 — 기억 · 인간관계 · 장기 목표 · 학력/승진 · 시대 · 업적 · 멀티 상호작용
// - 솔로(브라우저)·멀티(서버) 공용. lifegame-core.js 가 createSystems(api)로 붙인다(코어에는 훅만 있음)
// - 프론트가 원본 → worldcup-backend/scripts/sync-lifegame-data.js 가 백엔드로 복사
// - 글자는 전부 키(k)+값(v)으로 남긴다 → 화면이 언어에 맞게 번역(lifegame-tr-src/sys.js). 한국어 원문은 TX
// =========================

// ===== 한국어 원문 =====
export const TX = {
  // 해마다 일기 줄
  parent_died: "{who}가 {n}세로 세상을 떠나셨다.",
  sibling_died: "{who}가 먼저 세상을 떠났다. 같이 자란 날들이 떠올랐다.",
  friend_died: "오랜 친구 {who}의 부고를 받았다.",
  spouse_died: "{who}가 {n}세로 먼저 떠났다. 오랜 세월 곁에 있던 사람이었다.",
  drift: "{who}와 연락이 끊겼다. 언제부터였는지도 모르겠다.",
  new_friend_child: "같은 반 {who}와 단짝이 되었다.",
  new_friend_teen: "{who}와 마음이 통하는 친구가 되었다.",
  new_friend_adult: "{who}와 친구가 되었다. 어른이 되어 사귄 친구는 귀하다.",
  new_colleague: "새 동료 {who}와 함께 일하게 되었다.",
  edu_college: "대학에 진학했다. 캠퍼스 생활이 시작됐다.",
  edu_high: "대학 대신 사회로 나왔다.",
  promoted: "{job}{으로} 승진했다.",
  pay_raise: "경력이 쌓여 연봉이 업계 수준으로 올랐다.",
  goal_new: "🎯 새 목표가 생겼다 — {goal}",
  goal_done: "🎯 목표 달성 — {goal}!",
  goal_paused: "{goal}의 꿈은 잠시 접어 두었다.",
  goal_retry: "🎯 접어 두었던 꿈을 다시 꺼냈다 — {goal}",
  layoff_crisis: "경제 위기로 회사가 구조조정을 했다. 내 자리도 사라졌다.",
  layoff_ai: "AI 자동화로 부서가 통째로 없어졌다.",
  tech_dev: "AI 붐으로 개발자 몸값이 뛰었다.",
  edu_entry_block: "",
  // 시대 소식
  econ_boom: "📈 경기 호황이 시작됐다. 어딜 가나 돈 이야기다.",
  econ_recession: "📉 경기 불황. 기업들이 채용을 줄이고 연봉을 동결했다.",
  econ_crisis: "🌀 경제 위기! 주가가 폭락하고 실업자가 늘었다.",
  econ_normal: "🌤️ 경기가 제자리를 찾았다.",
  stock_soar: "🚀 주식시장이 크게 올랐다.",
  stock_crash: "💥 주식시장이 폭락했다.",
  house_soar: "🏘️ 집값이 크게 뛰었다.",
  house_drop: "🏚️ 집값이 떨어졌다.",
  tech_ai: "🤖 AI 비서가 모두의 일상이 됐다. 사라지는 일자리, 새로 생기는 일자리.",
  tech_auto: "🚗 자율주행차가 도로를 달린다. 교통사고가 크게 줄었다.",
  tech_robot: "🦾 돌봄 로봇이 집집마다 들어왔다. 간병비 부담이 줄었다.",
  tech_space: "🛰️ 우주여행이 상용화됐다. 부자들의 새 취미가 생겼다.",
  tech_longevity: "🧬 노화를 늦추는 치료가 나왔다. 백세 시대가 성큼 다가왔다.",
  trend_retro: "📼 요즘 레트로가 유행이다. 옛날 노래가 다시 차트에 올랐다.",
  trend_camping: "⛺ 캠핑 열풍. 주말마다 고속도로가 막힌다.",
  trend_shortform: "📱 숏폼 영상이 세상을 집어삼켰다.",
  trend_fitness: "🏋️ 운동 열풍. 동네마다 헬스장이 생겼다.",
  trend_petboom: "🐾 반려동물 붐. 펫 카페가 줄을 섰다.",
  trend_invest: "💹 너도나도 투자 이야기. 점심시간마다 차트를 본다.",
  trend_minimal: "🧺 미니멀 라이프 유행. 덜 사고 덜 쓰는 게 멋이 됐다.",
  trend_kwave: "🌏 한류 열풍. 한국 콘텐츠가 세계를 휩쓴다.",
  // 평범한 해(관계·목표·시대가 묻어나는 한 줄)
  q_parent_visit: "부모님 댁에 들러 밥을 먹고 왔다. 반찬을 한 아름 싸 주셨다.",
  q_parent_call: "{who}와 통화했다. '밥은 잘 챙겨 먹니.'",
  q_friend_meet: "{who}와 오랜만에 만나 밤늦게까지 수다를 떨었다.",
  q_friend_kid: "{who}와 놀이터에서 해 질 때까지 놀았다.",
  q_colleague: "{who}와 점심을 먹으며 회사 이야기를 했다.",
  q_sibling: "명절에 {who}와 만나 옛날이야기를 했다.",
  q_goal: "{goal}을 향해 조금씩 준비한 한 해였다.",
  q_trend: "요즘은 어딜 가나 {trend} 이야기다.",
  q_grave: "{who}의 기일에 산소에 다녀왔다.",
  q_kid_grown: "{who}가 벌써 {n}살이다. 시간이 빠르다.",
  q_spouse_walk: "{who}와 손을 잡고 동네를 한 바퀴 걸었다.",
  q_rival: "{who}의 소식을 들었다. 괜히 신경이 쓰였다.",
  // 기억(사진첩·결산)
  m_lover: "{who}와 연애를 시작했다",
  m_breakup: "{who}와 헤어졌다",
  m_marry: "{who}와 결혼했다",
  m_kid: "{who}가 태어났다",
  m_divorce: "{who}와 이혼했다",
  m_widow: "{who}를 먼저 떠나보냈다",
  m_parent_died: "{who}와 마지막 인사를 했다",
  m_friend: "{who}와 친구가 되었다",
  m_drift: "{who}와 멀어졌다",
  m_reconcile: "{who}와 화해했다",
  m_conflict: "{who}와 크게 다퉜다",
  m_career: "{job}{으로} 첫발을 뗐다",
  m_career_end: "{job} 일을 내려놓았다",
  m_peak: "{job} — 정점에 섰다",
  m_promoted: "{job}{으로} 승진했다",
  m_fired: "직장을 잃었다",
  m_goal_done: "목표를 이뤘다 — {goal}",
  m_goal_fail: "{goal}에 도전했다가 넘어졌다",
  m_goal_drop: "{goal}의 꿈을 접었다",
  m_edu: "대학에 진학했다",
  m_rival_win: "{who}와의 경쟁에서 이겼다",
  m_rival_lose: "{who}와의 경쟁에서 졌다",
  m_partner: "{who}와 동업을 시작했다",
  m_helped: "{who}의 도움을 받았다",
  m_help: "{who}를 도왔다",
  // 멀티 상호작용 줄
  mp_friend: "🤝 {who}와 친구가 되었다.",
  mp_lover: "💞 {who}와 사귀기 시작했다.",
  mp_marry: "💍 {who}와 결혼했다! 같은 세상을 사는 사람과.",
  mp_partner: "🤝 {who}와 동업 계약서에 사인했다.",
  mp_partner_profit: "📈 {who}와의 사업이 잘 돼 수익을 나눴다.",
  mp_partner_loss: "📉 {who}와의 사업이 적자를 냈다.",
  mp_partner_end: "{who}와의 동업이 끝났다.",
  mp_rival_win: "🏆 {who}와의 맞대결에서 이겼다.",
  mp_rival_lose: "😤 {who}와의 맞대결에서 졌다. 다음엔 꼭.",
  mp_declined: "{who}와의 인연은 이번엔 닿지 않았다.",
  mp_heal: "🩺 의사 {who}에게 치료를 받았다. 몸이 한결 가볍다.",
  mp_healer: "🩺 아픈 {who}를 치료해 줬다.",
  mp_legal: "⚖️ 변호사 {who}가 억울한 일을 해결해 줬다.",
  mp_legaler: "⚖️ {who}의 법률 문제를 도와줬다.",
  mp_shout: "📣 {who}의 방송에 소개되어 유명해졌다.",
  mp_shouter: "📣 방송에서 {who}를 소개했다.",
  mp_policy: "🏛️ {who}가 만든 정책 덕분에 지원금을 받았다.",
  mp_policer: "🏛️ 내가 만든 정책이 친구들에게도 닿았다.",
  mp_lost: "🕯️ {who}가 세상을 떠났다. 함께한 시간을 기억한다.",
  mp_divorced: "📄 {who}와 이혼했다. 같은 세상에서 각자의 길로.",
  mp_breakup: "💔 {who}와 헤어졌다.",
  mp_left: "🚪 {who}가 우리 세상을 떠나 멀리 갔다.",
  mp_kid: "👶 {who}와의 아이가 태어났다.",
  mp_widow: "🕯️ 배우자 {who}가 먼저 세상을 떠났다.",
};

// ===== 관계 이름(일반 명칭) =====
export const REL = { father: "아버지", mother: "어머니", sibling: "형제자매", friend: "친구", lover: "연인", spouse: "배우자", ex: "전 배우자", exlover: "옛 연인", kid: "자녀", colleague: "동료", rival: "라이벌", partner: "동업자" };

// ===== 이름 풀(번역 표는 lifegame-i18n.js NAME) =====
const SIB_M = ["민호", "태준", "현우", "지훈", "성민"], SIB_F = ["지은", "예린", "다은", "수아", "나연"];
const FRIEND_N = ["준우", "은우", "건우", "하준", "도윤", "서준", "지민", "채원", "유진", "소율", "하린", "지우", "하은", "서연"];

// ===== 직업 장기 목표: s=이 목표가 이뤄지는 직업 단계 · t/sal=그때 직함·연봉 · years=그 직업 n년차부터 · st=능력치 · pre=선행 사건 플래그 =====
const G = (id, s, name, o = {}) => ({ id, s, name, ...o });
export const GOALS = {
  politics: [G("pol1", 2, "첫 당선", { t: "구의원", sal: 4800, years: 2, st: { social: 55 } }), G("pol2", 3, "국회의원 배지", { t: "국회의원", sal: 15500, years: 5, st: { social: 62, intel: 50 }, pre: "pol_local_win" }), G("pol3", 5, "대통령의 꿈", { t: "대통령", sal: 25000, years: 14, st: { social: 75, intel: 62, luck: 45 }, pre: "pol_mp" })],
  writer: [G("wr1", 2, "첫 히트작", { t: "인기 웹소설 작가", sal: 4500, years: 2, st: { intel: 50 } }), G("wr2", 3, "베스트셀러", { t: "베스트셀러 작가", sal: 9000, years: 4, st: { intel: 60 } }), G("wr3", 5, "세계가 읽는 작가", { t: "세계적인 작가", sal: 20000, years: 12, st: { intel: 72, happy: 45 }, pre: "wr_best" })],
  corporate: [G("co1", 3, "부장 승진", { t: "대기업 부장", sal: 11000, years: 9, st: { intel: 55, social: 52 } }), G("co2", 4, "임원(별) 달기", { t: "대기업 상무", sal: 20000, years: 15, st: { intel: 62, social: 60 } }), G("co3", 5, "사장 자리", { t: "대기업 사장", sal: 40000, years: 21, st: { intel: 68, social: 68, luck: 48 }, pre: "co_exec" })],
  worker: [G("wk1", 2, "과장 승진", { t: "중소기업 과장", sal: 5000, years: 5, st: { intel: 45 } }), G("wk2", 3, "이사 자리", { t: "중소기업 이사", sal: 7000, years: 12, st: { intel: 52, social: 55 } }), G("wk3", 5, "회사 대표", { t: "중소기업 대표", sal: 11000, years: 18, st: { intel: 58, social: 62, luck: 45 } })],
  civil: [G("cv1", 2, "6급 승진", { t: "6급 주무관", sal: 4800, years: 7, st: { intel: 48 } }), G("cv2", 4, "5급 사무관", { t: "5급 사무관", sal: 6500, years: 14, st: { intel: 58, social: 50 } }), G("cv3", 5, "4급 서기관", { t: "4급 서기관", sal: 8000, years: 20, st: { intel: 64, social: 58 }, pre: "cv_chief" })],
  developer: [G("dv1", 2, "빅테크 입사", { t: "빅테크 개발자", sal: 8000, years: 3, st: { intel: 60 } }), G("dv2", 3, "개발 팀장", { t: "개발 팀장", sal: 10000, years: 7, st: { intel: 64, social: 48 } }), G("dv3", 5, "CTO", { t: "CTO", sal: 18000, years: 13, st: { intel: 72, social: 58 } })],
  doctor: [G("dr1", 2, "전문의 취득", { t: "전문의", sal: 13000, years: 5, st: { intel: 72 } }), G("dr2", 3, "내 병원 개원", { t: "개원의", sal: 20000, years: 9, st: { intel: 72, social: 55 } }), G("dr3", 5, "의학의 새 길", { t: "의대 교수", sal: 22000, years: 16, st: { intel: 82 } })],
  lawyer: [G("lw1", 2, "로펌 입성", { t: "로펌 변호사", sal: 9000, years: 2, st: { intel: 68 } }), G("lw2", 4, "파트너 변호사", { t: "파트너 변호사", sal: 20000, years: 9, st: { intel: 72, social: 58 } }), G("lw3", 5, "이름을 건 법률사무소", { t: "법률사무소 대표", sal: 25000, years: 15, st: { intel: 76, social: 62 } })],
  teacher: [G("tc1", 1, "정교사 임용", { t: "정교사", sal: 4000, years: 1, st: { intel: 55 } }), G("tc2", 4, "교감 승진", { t: "교감", sal: 7000, years: 18, st: { intel: 60, social: 58 } }), G("tc3", 5, "교장 선생님", { t: "교장", sal: 8000, years: 24, st: { intel: 62, social: 62 } })],
  idol: [G("id1", 2, "정식 데뷔", { t: "신인 가수", sal: 3000, years: 2, st: { social: 58 } }), G("id2", 3, "음원 차트 1위", { t: "인기 가수", sal: 12000, years: 4, st: { social: 64, internet: 52 } }), G("id3", 5, "톱스타", { t: "톱스타", sal: 40000, years: 9, st: { social: 72, internet: 62, luck: 50 } })],
  business: [G("bz1", 1, "첫 매장 열기", { t: "사장", sal: 4000, years: 1, st: { social: 45 } }), G("bz2", 3, "투자 유치·법인 대표", { t: "기업 대표", sal: 12000, years: 5, st: { intel: 58, social: 58 } }), G("bz3", 5, "그룹 회장", { t: "그룹 회장", sal: 50000, years: 14, st: { intel: 66, social: 66, luck: 52 } })],
  athlete: [G("at1", 1, "프로 데뷔", { t: "프로 선수", sal: 5000, years: 1, st: { power: 60 } }), G("at2", 3, "국가대표 메달", { years: 5, st: { power: 72, luck: 45 } }), G("at3", 5, "명장 감독", { t: "감독", sal: 9000, years: 14, st: { intel: 55, social: 58 } })],
  artist: [G("ar1", 2, "첫 개인전", { years: 3, st: { happy: 45, intel: 50 } }), G("ar2", 4, "세계적인 미술가", { t: "세계적인 미술가", sal: 15000, years: 9, st: { intel: 62, luck: 48 } }), G("ar3", 5, "거장의 반열", { years: 16, st: { intel: 68, happy: 50 } })],
  streamer: [G("st1", 2, "구독자 10만", { t: "인기 유튜버", sal: 6000, years: 2, st: { internet: 58 } }), G("st2", 4, "방송계 고정 출연", { years: 5, st: { internet: 66, social: 58 } }), G("st3", 5, "골드 버튼", { t: "100만 유튜버", sal: 20000, years: 8, st: { internet: 72, luck: 48 } })],
  gamer: [G("gm1", 1, "프로 데뷔", { t: "프로게이머", sal: 5000, years: 1, st: { internet: 58 } }), G("gm2", 3, "리그 우승", { years: 3, st: { internet: 66, intel: 50 } }), G("gm3", 4, "명문팀 코치", { t: "e스포츠 코치", sal: 6000, years: 7, st: { intel: 55, social: 52 } })],
};
export const GOAL_BY_ID = Object.fromEntries(Object.entries(GOALS).flatMap(([k, l]) => l.map(g => [g.id, { ...g, career: k }])));
const GOAL_STAT = { politics: "social", writer: "intel", corporate: "intel", worker: "intel", civil: "intel", developer: "intel", doctor: "intel", lawyer: "intel", teacher: "social", idol: "social", business: "social", athlete: "power", artist: "happy", streamer: "internet", gamer: "internet" };

// ===== 평범한 직장 승진 사다리(직함·연봉, 단계 0~5) + 전문직 연봉 바닥선 =====
export const LADDER = {
  worker: [["회사원", 3200], ["중소기업 대리", 3900], ["중소기업 과장", 5000], ["중소기업 이사", 7000], ["중소기업 전무", 8500], ["중소기업 대표", 11000]],
  corporate: [["대기업 사원", 5200], ["대기업 대리", 6300], ["대기업 과장", 7600], ["대기업 부장", 11000], ["대기업 상무", 20000], ["대기업 사장", 40000]],
  civil: [["9급 공무원", 3300], ["7급 주무관", 3900], ["6급 주무관", 4800], ["6급 팀장", 5600], ["5급 사무관", 6500], ["4급 서기관", 8000]],
};
const LADDER_YEARS = [0, 3, 7, 12];          // 자동 승진은 3단계(차장급)까지. 그 위는 장기 목표로
const PAY_FLOOR = {
  developer: [3800, 5000, 7000, 9000, 11000, 15000], doctor: [0, 4500, 11000, 15000, 18000, 22000], lawyer: [0, 6000, 8500, 12000, 18000, 24000],
  teacher: [3000, 3800, 4600, 5500, 6500, 7500], politics: [2600, 3500, 4800, 15500, 15500, 25000],
};
export const SYS_TITLES = { "중소기업 대리": "worker", "중소기업 전무": "worker", "중소기업 대표": "worker", "대기업 대리": "corporate", "대기업 과장": "corporate", "7급 주무관": "civil", "6급 팀장": "civil", "4급 서기관": "civil" };

// ===== 학력 → 직업 진입 조건 =====
//   edu: none(미정) · high(고졸) · college(대졸) · grad(대학원) · med(의대) · law(로스쿨)
const DEGREE = new Set(["college", "grad", "med", "law"]);
export const ENTRY_REQ = {
  doctor: p => !p.flags.has("no_college") && p.stats.intel >= 72,
  lawyer: p => DEGREE.has(p.edu) && p.stats.intel >= 66,
  teacher: p => DEGREE.has(p.edu) && p.stats.intel >= 50,
  developer: p => DEGREE.has(p.edu) || p.stats.internet >= 62 || p.stats.intel >= 66,
  corporate: p => DEGREE.has(p.edu) || p.stats.intel >= 70,
  civil: p => p.stats.intel >= 40,
  politics: p => p.age >= 20 && (p.stats.social >= 45 || p.stats.intel >= 60),
  business: p => p.age >= 19 && (p.stats.money >= 300 || p.stats.social >= 55 || p.careerHist?.length > 0),
  streamer: p => p.stats.internet >= 35 || p.stats.social >= 55,
};
// 진입 성공률: 관련 능력치 + 비슷한 경력 + 학력
const ENTRY_STAT = { doctor: ["intel"], lawyer: ["intel"], teacher: ["intel", "social"], developer: ["intel", "internet"], corporate: ["intel", "social"], civil: ["intel"], politics: ["social", "intel"], business: ["social", "luck"], streamer: ["internet", "social"], idol: ["social", "power"], athlete: ["power"], gamer: ["internet"], writer: ["intel"], artist: ["happy", "intel"], worker: ["intel"] };
const RELATED = { corporate: ["worker", "developer"], developer: ["worker", "corporate", "gamer"], business: ["corporate", "worker", "developer", "streamer"], politics: ["lawyer", "civil", "teacher", "writer"], writer: ["teacher", "streamer", "artist"], streamer: ["gamer", "idol", "writer"], teacher: ["civil", "writer"], lawyer: ["civil"], gamer: ["streamer"], worker: ["corporate", "civil"] };

// ===== 시대 =====
export const TECH = [{ id: "ai", year: 2032 }, { id: "auto", year: 2042 }, { id: "robot", year: 2052 }, { id: "space", year: 2065 }, { id: "longevity", year: 2080 }];
export const TRENDS = ["retro", "camping", "shortform", "fitness", "petboom", "invest", "minimal", "kwave"];
export const TREND_NAME = { retro: "레트로", camping: "캠핑", shortform: "숏폼", fitness: "운동", petboom: "반려동물", invest: "투자", minimal: "미니멀 라이프", kwave: "한류" };
export const ECON = ["boom", "normal", "recession", "crisis"];
const STOCK_RET = { boom: .12, normal: .05, recession: -.08, crisis: -.24 };
const HOUSE_RET = { boom: .07, normal: .03, recession: -.03, crisis: -.08 };
const RAISE = { boom: 1.02, normal: 1, recession: .99, crisis: .975 };

// ===== 업적(도감). hidden: 이루기 전엔 ??? · rare: 특별 칭호 =====
const A = (id, emoji, name, desc, o = {}) => ({ id, emoji, name, desc, ...o });
export const ACHIEVEMENTS = [
  A("first_love", "💘", "첫사랑", "처음으로 연애를 시작했다"),
  A("married", "💍", "평생의 약속", "결혼했다"),
  A("golden_wedding", "🥇", "금혼식", "한 사람과 50년을 함께했다", { rare: true }),
  A("big_family", "👨‍👩‍👧‍👦", "대가족", "자녀를 셋 이상 두었다"),
  A("grandparent", "👶", "할머니·할아버지", "손주를 봤다"),
  A("age90", "🐢", "구순", "90세까지 살았다"),
  A("age100", "💯", "백세 인생", "100세를 넘겼다", { rare: true }),
  A("young_rich", "💸", "영앤리치", "40세 전에 순자산 10억을 모았다"),
  A("billionaire", "🏦", "100억 자산가", "순자산 100억을 넘겼다", { rare: true }),
  A("comeback_money", "📈", "빚에서 부자로", "빚 5천만 원을 지고도 순자산 5억을 만들었다", { hidden: true }),
  A("goal_first", "🎯", "첫 목표", "직업의 장기 목표를 처음 이뤘다"),
  A("goal_all", "🏔️", "끝까지 올라간 사람", "한 직업의 목표를 모두 이뤘다", { rare: true }),
  A("seven_falls", "🔥", "칠전팔기", "두 번 넘게 실패한 목표를 끝내 이뤘다", { hidden: true }),
  A("late_bloomer", "🌸", "늦게 핀 꽃", "55세가 넘어 목표를 이뤘다", { hidden: true }),
  A("career3", "🔀", "N번째 인생", "세 가지 이상의 직업을 거쳤다"),
  A("career_peak", "👑", "정점", "한 직업의 정점(마지막 단계)에 섰다"),
  A("career_return", "↩️", "돌아온 자리", "예전 직업으로 돌아갔다"),
  A("degree", "🎓", "학사모", "대학을 졸업했다"),
  A("reconciled", "🕊️", "화해", "멀어졌던 사람과 화해했다"),
  A("true_friends", "🤝", "진짜 친구들", "친밀도 높은 친구가 셋 이상"),
  A("lifelong_friend", "🫶", "평생 친구", "어릴 적 친구와 70세가 넘어서도 함께였다", { hidden: true }),
  A("filial", "🌷", "효도", "부모님과 아주 가까운 사이로 지냈다", { hidden: true }),
  A("pet_family", "🐾", "동물 가족", "반려동물을 셋 이상 키웠다"),
  A("lotto", "🎰", "로또 1등", "로또 1등에 당첨됐다", { hidden: true, rare: true }),
  A("survivor", "💪", "기적의 회복", "건강 10 이하에서 50 이상으로 회복했다", { hidden: true }),
  A("crisis_survivor", "⛈️", "위기를 넘은 사람", "경제 위기를 두 번 겪고도 빚 없이 살았다"),
  A("tech_witness", "🛰️", "시대의 증인", "기술 변화 다섯 가지를 모두 지켜봤다", { hidden: true }),
  A("calm_life", "🍵", "무사태평", "대박도 쪽박도 없이 80세를 넘겼다", { hidden: true }),
  A("mp_friend", "🫂", "같은 세상의 친구", "멀티에서 다른 플레이어와 친구가 되었다"),
  A("mp_spouse", "💒", "운명의 상대", "멀티에서 다른 플레이어와 결혼했다", { hidden: true, rare: true }),
  A("mp_rival", "⚔️", "영원한 라이벌", "다른 플레이어와의 맞대결에서 세 번 이겼다"),
  A("mp_partner", "🤝", "동업자", "다른 플레이어와 함께 사업했다"),
];
export const ACHV_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// ===== 비슷한 사건 묶음(같은 묶음은 3년 안에 잘 안 나온다) =====
const THEMES = [
  ["checkup", /건강검진|검진|checkup/i], ["invest", /주식|코인|투자|재테크|invest|crypto|stock/i],
  ["travel", /여행|travel|trip/i], ["reunion", /동창|동문|reunion/i], ["jobhunt", /면접|취업|이직|구직|interview|job_/i], ["exam", /시험|수능|자격증|exam|cert/i],
  ["house", /이사|집 |전세|월세|내 집|house|move/i], ["party", /회식|파티|축제|party/i], ["sns", /SNS|인스타|유튜브|바이럴|viral|sns/i],
];

// ===== 조사 =====
const batchim = w => { const c = (w || "").charCodeAt((w || "").length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; };
const rieul = w => { const c = (w || "").charCodeAt((w || "").length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 === 8; };
const JO = { "와": ["과", "와"], "과": ["과", "와"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "을": ["을", "를"], "를": ["을", "를"], "의": ["의", "의"] };
/** 한국어 원문 채우기: {who}가 → 받침 맞춤, {job}{으로} → (으)로 */
export function txFill(s, v = {}) {
  if (!s) return "";
  return s.replace(/\{(\w+)\}(?:(\{으로\})|(와|과|이|가|은|는|을|를)(?![가-힣]))?/g, (m, k, r, j) => {
    const w = v[k] != null ? String(v[k]) : "";
    if (r) return w + (batchim(w) && !rieul(w) ? "으로" : "로");
    if (!j) return w;
    const pr = JO[j]; return w + (batchim(w) ? pr[0] : pr[1]);
  });
}
export const tx = (k, v) => txFill(TX[k] ?? k, v);

export function createSystems(api) {
  const { rng, rint, pickOne, pickWeighted, randomName, oppositeGender, addStat, baseMortality, CAREERS, careerOfJob, endCareer, alivePets } = api;
  const clamp100 = x => Math.max(0, Math.min(100, Math.round(x)));

  // ===== 호환: 예전 데이터(필드 없음)도 그대로 동작 =====
  function compat(p) {
    if (!p.people) { p.people = []; p._pid = 0; seedPeople(p, true); }
    if (!p.memories) p.memories = [];
    if (!p.goalsDone) p.goalsDone = [];
    if (!p.goalHist) p.goalHist = [];
    if (p.goal === undefined) p.goal = null;
    if (!p.goalMem) p.goalMem = {};
    if (!p.achv) p.achv = [];
    if (!p.themeAt) p.themeAt = {};
    if (p.edu === undefined) p.edu = p.flags?.has("college_done") ? (p.flags.has("no_college") ? "high" : "college") : "none";
    if (p.minMoney == null) p.minMoney = p.stats.money;
    if (p.minHealth == null) p.minHealth = p.stats.health;
  }

  // ===== 기억 =====
  function remember(p, k, v = {}, tone = 0, w = 1) {
    const last = p.memories[p.memories.length - 1];
    if (last && last.k === k && last.a === p.age && JSON.stringify(last.v) === JSON.stringify(v)) return;
    p.memories.push({ a: p.age, k, v, t: tone, w });
    if (p.memories.length > 120) {                                   // 너무 많으면 가벼운 기억부터 정리(중요한 건 영구)
      const i = p.memories.findIndex(m => m.w <= 1 && m.k === "ev");
      if (i >= 0) p.memories.splice(i, 1); else p.memories.shift();
    }
  }
  // 사건·운명 기억: {ev,c,g} 또는 {fate,g} — 화면이 사건 id로 제목을 번역한다
  function rememberEv(p, o, tone, w) { p.memories.push({ a: p.age, k: "ev", v: {}, t: tone, w, ...o }); if (p.memories.length > 120) { const i = p.memories.findIndex(m => m.w <= 1 && m.k === "ev"); p.memories.splice(i >= 0 ? i : 0, 1); } }
  const hasMem = (p, k) => p.memories.some(m => m.k === k);
  const memCount = (p, k) => p.memories.filter(m => m.k === k).length;

  // ===== 사람 =====
  const ageOf = (p, x) => p.age + x.off;
  const alive = x => x.status !== "dead";
  function addPerson(p, o) {
    const x = { id: ++p._pid, name: o.name, rel: o.rel, g: o.g || null, off: o.off || 0, close: o.close ?? 50, conflict: o.conflict || 0, status: o.status || "active", since: p.age, touch: p.age, notes: [] };
    if (o.career) x.career = o.career;
    if (o.pid) x.pid = o.pid;
    if (o.why) x.why = o.why;
    p.people.push(x);
    return x;
  }
  function note(p, x, k) { x.notes.push({ a: p.age, k }); if (x.notes.length > 8) x.notes.shift(); }
  function end(p, x, why, status = "ended") {
    if (x.status === "dead") return;
    x.status = status; x.why = why; x.endAt = p.age; note(p, x, why);
  }
  function seedPeople(p, fromOld) {
    const hard = p.flags?.has("hard_family");
    const dad = addPerson(p, { name: "아버지", rel: "father", g: "M", off: rint(27, 36), close: hard ? 30 : rint(55, 75) });
    addPerson(p, { name: "어머니", rel: "mother", g: "F", off: rint(25, 33), close: rint(60, 80) });
    if (hard) end(p, dad, "left");
    if (p.flags?.has("orphaned")) for (const x of p.people) if (x.rel === "father" || x.rel === "mother") { x.status = "dead"; x.endAt = p.age; }
    if (rng() < 0.55) {
      let off = rint(-6, 6); if (!off) off = 2;
      const g = rng() < .5 ? "M" : "F";
      addPerson(p, { name: pickOne(g === "M" ? SIB_M : SIB_F), rel: "sibling", g, off: fromOld ? off : off, close: rint(45, 70) });
    }
  }
  const parents = p => p.people.filter(x => (x.rel === "father" || x.rel === "mother"));
  const parentAlive = (p, which) => parents(p).some(x => x.status === "active" && (!which || x.rel === which));
  const activeOf = (p, rel) => p.people.filter(x => x.rel === rel && x.status === "active");

  // 코어의 가족 필드(spouse·romance·kids·friends)와 사람 목록을 맞춘다 — 끝난 관계가 '현재'로 남지 않게
  function sync(p) {
    // 배우자
    const spName = p.spouse?.name || null;
    for (const x of activeOf(p, "spouse")) if (x.name !== spName || !p.spouse) {
      const why = p.spouseEnd?.why === "widow" ? "widow" : "divorce";
      if (why === "widow") { x.status = "dead"; x.endAt = p.age; note(p, x, "widow"); remember(p, "m_widow", { who: x.name }, -1, 3); }
      else { x.rel = "ex"; end(p, x, "divorce"); remember(p, "m_divorce", { who: x.name }, -1, 3); }
    }
    if (p.spouse && !activeOf(p, "spouse").some(x => x.name === spName)) {
      const lv = activeOf(p, "lover").find(x => x.name === spName) || (p.spouse.pid && p.people.find(x => x.pid === p.spouse.pid && alive(x)));
      if (lv) { lv.rel = "spouse"; lv.status = "active"; lv.close = Math.max(lv.close, 75); note(p, lv, "marry"); }
      else addPerson(p, { name: spName, rel: "spouse", g: oppositeGender(p.gender), off: rint(-4, 4), close: 78, pid: p.spouse.pid });
      remember(p, "m_marry", { who: spName }, 1, 3);
    }
    // 연인
    const rom = !p.spouse ? (p.relations?.romance || null) : null;
    for (const x of activeOf(p, "lover")) if (x.name !== rom) { x.rel = "exlover"; end(p, x, "breakup"); remember(p, "m_breakup", { who: x.name }, -1, 1); }
    if (rom && !activeOf(p, "lover").some(x => x.name === rom)) {
      addPerson(p, { name: rom, rel: "lover", g: oppositeGender(p.gender), off: rint(-3, 3), close: 70, pid: p.romancePid || undefined });
      remember(p, "m_lover", { who: rom }, 1, 1);
    }
    // 자녀
    for (const k of p.kids || []) if (!p.people.some(x => x.rel === "kid" && x.name === k.name && x.off === -k.born)) {
      addPerson(p, { name: k.name, rel: "kid", g: k.gender, off: -k.born, close: 85 });
      remember(p, "m_kid", { who: k.name }, 1, 3);
    }
    // 친구·앙숙(코어 relations)
    const foes = new Set(p.relations?.foes || []);
    for (const [n, sc] of Object.entries(p.relations?.friends || {})) {
      if (foes.has(n)) continue;
      let x = p.people.find(y => y.rel === "friend" && y.name === n && alive(y));
      if (!x) { x = addPerson(p, { name: n, rel: "friend", off: rint(-2, 2), close: clamp100(50 + sc / 2) }); remember(p, "m_friend", { who: n }, 1, 1); }
      else if (x._sc !== sc) { x.close = clamp100(x.close + (sc - (x._sc ?? sc)) / 2); x.touch = p.age; if (x.status === "ended") { x.status = "active"; x.why = null; } }
      x._sc = sc;
    }
    for (const n of foes) {
      let x = p.people.find(y => y.name === n && alive(y) && (y.rel === "friend" || y.rel === "rival"));
      if (!x) addPerson(p, { name: n, rel: "rival", off: rint(-2, 2), close: 15, conflict: 70 });
      else if (x.rel === "friend") { x.rel = "rival"; x.conflict = Math.max(x.conflict, 60); x.close = Math.min(x.close, 25); note(p, x, "conflict"); }
    }
    // 직장 동료: 지금 직업이 아니면 '전 동료'로
    for (const x of activeOf(p, "colleague")) if (x.career !== p.career) end(p, x, "left");
    // 부모 둘 다 떠나면 orphaned(코어·사건이 쓰는 플래그)
    if (parents(p).length && parents(p).every(x => x.status === "dead")) p.flags.add("orphaned");
  }

  // ===== 학력·직업 =====
  function entryOk(p, key) { compat(p); const f = ENTRY_REQ[key]; return !f || f(p); }
  function entryMul(p, key) {
    if (!key) return 1;
    const sts = ENTRY_STAT[key] || [];
    let m = 1;
    for (const k of sts) m += ((p.stats[k] ?? 50) - 50) / 100;
    if ((RELATED[key] || []).some(r => p.careerHist?.some(h => h.key === r) || p.career === r)) m += 0.15;
    if (DEGREE.has(p.edu) && ["corporate", "developer", "teacher", "lawyer", "civil"].includes(key)) m += 0.1;
    if (p.edu === "high" && ["corporate", "lawyer", "teacher"].includes(key)) m -= 0.2;
    if (p.careerHist?.length >= 3) m -= 0.1;                               // 너무 자주 바꾸면 '한 우물'을 묻는다
    return Math.max(0.45, Math.min(1.7, m));
  }
  // 직업 사건의 일자리 직함 → 단계
  function ladderStep(key, title) { const l = LADDER[key]; return l ? l.findIndex(x => x[0] === title) : -1; }

  // ===== 목표 =====
  function goalReady(p, g) {
    if (p.age - (p.careerSince || 0) < (g.years || 1)) return false;
    if (p.careerStep < g.s - 2) return false;
    for (const [k, v] of Object.entries(g.st || {})) if ((p.stats[k] ?? 0) < v) return false;
    if (g.pre && !p.flags.has(g.pre) && p.careerStep < g.s - 1) return false;
    return true;
  }
  function goalLacks(p, g) {                // 화면 표시용: 아직 모자란 조건
    const out = [];
    const yrs = p.age - (p.careerSince || 0);
    if (yrs < (g.years || 1)) out.push({ k: "years", need: g.years, have: yrs });
    if (p.careerStep < g.s - 2) out.push({ k: "step", need: g.s - 2, have: p.careerStep });
    for (const [k, v] of Object.entries(g.st || {})) if ((p.stats[k] ?? 0) < v) out.push({ k: "stat", stat: k, need: v, have: p.stats[k] ?? 0 });
    if (g.pre && !p.flags.has(g.pre) && p.careerStep < g.s - 1) out.push({ k: "pre", flag: g.pre });
    return out;
  }
  function goalDone(p, g, out, how) {
    if (p.goalsDone.includes(g.id)) return;
    p.goalsDone.push(g.id);
    p.flags.add("goal_" + g.id);
    const gm = p.goalMem[g.id] || {};
    p.goalHist.push({ id: g.id, career: g.career || p.career, state: "done", at: p.age, fails: gm.fails || 0, how });
    remember(p, "m_goal_done", { goal: g.id }, 1, 3);
    out.lines.push({ k: "goal_done", v: { goal: g.id } });
    out.goalDone = g.id;
    if (p.goal?.id === g.id) p.goal = null;
  }
  // 직업이 있으면 다음 목표를 정하고, 이야기(직업 단계)로 이미 이룬 목표는 달성 처리
  /** 코어 endCareer 가 부른다: 그 직업의 목표는 바로 '중단'으로 */
  function careerEnded(p, key) {
    compat(p);
    if (p.goal && p.goal.career === key) {
      p.goalHist.push({ id: p.goal.id, career: key, state: "paused", at: p.age });
      (p._sysLines ||= []).push({ k: "goal_paused", v: { goal: p.goal.id } });
      p.goal = null;
    }
    for (const x of activeOf(p, "colleague")) if (x.career === key) end(p, x, "left");
  }
  const drainLines = (p, out) => { if (p._sysLines?.length) { out.lines.push(...p._sysLines); p._sysLines = null; } };
  function updateGoal(p, out) {
    if (p.goal && p.goal.career !== p.career) {                              // 직업이 바뀌었으면 목표는 중단
      p.goalHist.push({ id: p.goal.id, career: p.goal.career, state: "paused", at: p.age });
      out.lines.push({ k: "goal_paused", v: { goal: p.goal.id } });
      p.goal = null;
    }
    if (!p.career || !GOALS[p.career]) return;
    for (const g0 of GOALS[p.career]) {
      const g = { ...g0, career: p.career };
      if (!p.goalsDone.includes(g.id) && p.careerStep >= g.s) goalDone(p, g, out, "story");
    }
    if (p.goal && p.goal.dropUntil && p.age >= p.goal.dropUntil) {          // 접었던 꿈 다시
      p.goal.dropUntil = null; p.goal.next = p.age; out.lines.push({ k: "goal_retry", v: { goal: p.goal.id } });
    }
    if (!p.goal) {
      const g = GOALS[p.career].find(x => !p.goalsDone.includes(x.id) && p.careerStep < x.s);
      if (g) {
        const gm = p.goalMem[g.id] || (p.goalMem[g.id] = { fails: 0, prep: 0 });
        p.goal = { id: g.id, career: p.career, since: p.age, next: p.age + 1, dropUntil: null };
        out.lines.push({ k: "goal_new", v: { goal: g.id } });
        out.goalNew = g.id;
        void gm;
      }
    }
  }
  function goalChance(p, g) {
    const gm = p.goalMem[g.id] || { fails: 0, prep: 0 };
    let s = 0.42;
    for (const [k, v] of Object.entries(g.st || {})) s += Math.max(0, Math.min(15, (p.stats[k] ?? 0) - v)) * 0.008;
    s += Math.min(3, gm.prep) * 0.07 + Math.min(3, gm.fails) * 0.05;      // 준비·실패 경험이 다음 도전을 돕는다
    if (hasMem(p, "m_reconcile") || activeOf(p, "friend").some(x => x.close >= 75)) s += 0.03;   // 곁에 사람이 있으면 조금 더
    return Math.max(0.15, Math.min(0.85, s));
  }
  function goalEvent(p, template) {
    const g = p.goal && GOAL_BY_ID[p.goal.id];
    if (!template || !g) return null;
    const s = goalChance(p, g);
    return { ...template, sysGoal: g.id, choices: template.choices.map(c => c.outcomes ? { ...c, outcomes: [{ ...c.outcomes[0], chance: s }, { ...c.outcomes[1], chance: 1 - s }] } : c) };
  }

  // ===== 사건에 등장할 사람 고르기 =====
  function whoMatch(p, w, x) {
    if (!alive(x)) return false;
    if (w.rel && !w.rel.includes(x.rel)) return false;
    if (w.status && !w.status.includes(x.status)) return false;
    if (!w.status && x.status !== "active") return false;
    if (w.why && !w.why.includes(x.why)) return false;
    if (w.minClose != null && x.close < w.minClose) return false;
    if (w.maxClose != null && x.close > w.maxClose) return false;
    if (w.minConflict != null && x.conflict < w.minConflict) return false;
    if (w.age && (ageOf(p, x) < w.age[0] || ageOf(p, x) > w.age[1])) return false;
    if (w.sameCareer && x.career !== p.career) return false;
    if (w.noPlayer && x.pid) return false;
    if (w.minYears != null && p.age - (x.endAt ?? x.since) < w.minYears) return false;
    return true;
  }
  const whoList = (p, w) => p.people.filter(x => whoMatch(p, w, x));

  // ===== 시대 =====
  function createWorld(birthYear) {
    const by = birthYear || rint(1988, 2008);
    return { v: 1, birthYear: by, age: 0, econ: "normal", econLeft: rint(2, 5), house: 100, stock: 100, stockRet: 0, houseRet: 0, tech: TECH.filter(t => t.year <= by).map(t => t.id), trend: null, trendLeft: rint(2, 5), news: [], newsAge: -1, crises: 0, hist: [] };
  }
  function stepWorld(w) {
    w.age += 1;
    const cal = w.birthYear + w.age;
    const news = [];
    if (--w.econLeft <= 0) {
      const nextW = { normal: { boom: .35, recession: .3, normal: .35 }, boom: { normal: .6, recession: .3, crisis: .1 }, recession: { normal: .6, boom: .2, crisis: .2 }, crisis: { recession: .5, normal: .5 } }[w.econ];
      const opts = Object.keys(nextW); const nx = pickWeighted(opts, k => nextW[k]);
      if (nx !== w.econ) { const prev = w.econ; w.econ = nx; if (nx !== "normal" || prev === "crisis" || prev === "recession") news.push({ k: "econ_" + nx }); if (nx === "crisis") w.crises++; }
      w.econLeft = { boom: rint(3, 6), normal: rint(3, 7), recession: rint(2, 4), crisis: rint(1, 2) }[w.econ];
    }
    w.stockRet = STOCK_RET[w.econ] + (rng() - .5) * (w.trend === "invest" ? .3 : .2);
    w.houseRet = HOUSE_RET[w.econ] + (rng() - .5) * .06;
    w.stock = Math.round(w.stock * (1 + w.stockRet) * 10) / 10; w.house = Math.round(w.house * (1 + w.houseRet) * 10) / 10;
    if (w.stockRet > .22) news.push({ k: "stock_soar" }); else if (w.stockRet < -.3) news.push({ k: "stock_crash" });
    if (w.houseRet > .09) news.push({ k: "house_soar" }); else if (w.houseRet < -.1) news.push({ k: "house_drop" });
    for (const t of TECH) if (cal >= t.year && !w.tech.includes(t.id)) { w.tech.push(t.id); news.push({ k: "tech_" + t.id }); }
    if (--w.trendLeft <= 0) { w.trend = pickOne(TRENDS.filter(t => t !== w.trend)); w.trendLeft = rint(6, 10); news.push({ k: "trend_" + w.trend }); }
    w.news = news.slice(0, 3); w.newsAge = w.age;
    w.hist.push({ a: w.age, e: w.econ, s: Math.round(w.stock), h: Math.round(w.house) });
    if (w.hist.length > 120) w.hist.shift();
  }
  /** 세상을 이 나이까지 진행(멀티는 모두 같은 세상 → 처음 부른 사람만 실제로 진행) */
  function worldTo(w, age) { while (w.age < age) stepWorld(w); return w; }
  const hasTech = (w, id) => !!w?.tech?.includes(id);
  const WORLD_FATES = new Set(["recession", "boom", "house_up", "house_down"]);

  // 첫 목표를 55세가 넘어 이뤘다(늦게 핀 꽃)
  const lateFirst = p => { const d = p.goalHist.filter(h => h.state === "done"); return d.length > 0 && d[0].at >= 55; };
  // ===== 업적 =====
  function achvCheck(p, final = false) {
    const got = [];
    const give = id => { if (!p.achv.includes(id)) { p.achv.push(id); got.push(id); } };
    const fl = k => p.flags.has(k);
    if (p.people.some(x => x.rel === "lover" || x.rel === "exlover" || x.rel === "spouse") || p.relations?.romance) give("first_love");
    if (p.spouse || fl("married") || fl("divorced") || fl("widowed")) give("married");
    if (p.spouse && p.age - p.spouse.since >= 50) give("golden_wedding");
    if ((p.kids || []).length >= 3) give("big_family");
    if (fl("grandparent")) give("grandparent");
    if (p.age >= 90) give("age90");
    if (p.age >= 100) give("age100");
    if (p.age < 40 && p.stats.money >= 100000) give("young_rich");
    if (p.stats.money >= 1000000) give("billionaire");
    if (p.minMoney <= -5000 && p.stats.money >= 50000) give("comeback_money");
    if (p.goalsDone.length) give("goal_first");
    for (const [k, l] of Object.entries(GOALS)) if (l.every(g => p.goalsDone.includes(g.id))) { give("goal_all"); void k; break; }
    if (p.goalHist.some(h => h.state === "done" && h.fails >= 2)) give("seven_falls");
    if (lateFirst(p)) give("late_bloomer");
    const cs = new Set([...(p.careerHist || []).map(h => h.key), p.career].filter(Boolean));
    if (cs.size >= 3) give("career3");
    if (p.careerStep >= 5 || (p.careerHist || []).some(h => h.state === "COMPLETED")) give("career_peak");
    if (Object.values(p.careers || {}).some(c => c.times >= 2)) give("career_return");
    if (DEGREE.has(p.edu)) give("degree");
    if (hasMem(p, "m_reconcile")) give("reconciled");
    if (activeOf(p, "friend").filter(x => x.close >= 70).length >= 3) give("true_friends");
    if (p.age >= 70 && activeOf(p, "friend").some(x => x.since <= 12)) give("lifelong_friend");
    if (parents(p).length && parents(p).every(x => x.close >= 80)) give("filial");
    if ((p.pets || []).length >= 3) give("pet_family");
    if (fl("fate_lotto_big")) give("lotto");
    if (p.minHealth <= 10 && p.stats.health >= 50) give("survivor");
    if (p.world?.crises >= 2 && p.stats.money >= 0 && p.age >= 50) give("crisis_survivor");
    if (TECH.every(t => hasTech(p.world, t.id)) && p.worldSeen >= TECH.length) give("tech_witness");
    if (final && p.age >= 80 && !(p.history || []).some(h => h.grade === "crit" || h.grade === "bad")) give("calm_life");
    if (p.people.some(x => x.pid && x.rel === "friend")) give("mp_friend");
    if (p.spouse?.pid || p.people.some(x => x.pid && (x.rel === "spouse") )) give("mp_spouse");
    if ((p.mpRivalWins || 0) >= 3) give("mp_rival");
    if (p.people.some(x => x.pid && (x.partner || x.rel === "partner"))) give("mp_partner");
    return got;
  }

  // ===== 훅: 출생 =====
  function onBirth(p, world) {
    compat(p);
    p.world = world || p.world || createWorld();
    p.worldSeen = (p.world.tech || []).length;
    p.birthYear = p.world.birthYear;
  }

  // ===== 훅: 한 해 시작(노화 뒤, 경제 전) — 사람·학력·승진·시대 영향 =====
  function onYear(p) {
    compat(p);
    const w = p.world;
    const out = { lines: [], news: [], achv: [], goalNew: null, goalDone: null, notices: [] };
    drainLines(p, out);
    if (w) {
      const before = w.age;
      worldTo(w, p.age);
      if (w.newsAge === p.age) out.news = w.news.slice();
      if (w.age !== before || w.newsAge === p.age) p.worldSeen = Math.max(p.worldSeen || 0, w.tech.length);
    }
    p.minMoney = Math.min(p.minMoney, p.stats.money); p.minHealth = Math.min(p.minHealth, p.stats.health);

    // --- 사람: 나이 들고, 멀어지고, 떠난다 ---
    const lonevity = hasTech(w, "longevity") ? 0.85 : 1;
    for (const x of p.people) {
      if (!alive(x) || x.pid) continue;                     // 다른 플레이어는 그 사람의 인생이 정한다
      const a = ageOf(p, x);
      if (x.rel === "spouse") {
        if (a >= 70 && rng() < baseMortality(a) * 0.8 * lonevity && p.spouse && p.spouse.name === x.name) {
          p.spouse = null; p.flags.add("widowed"); p.flags.delete("married"); p.spouseEnd = { why: "widow", age: p.age };
          x.status = "dead"; x.endAt = p.age; note(p, x, "died");
          addStat(p, "happy", -15); addStat(p, "health", -4);
          out.lines.push({ k: "spouse_died", v: { who: x.name, n: a } });
          remember(p, "m_widow", { who: x.name }, -1, 3);
        }
        continue;
      }
      if (x.rel === "kid" || x.rel === "lover") continue;
      if (a >= 30 && rng() < baseMortality(a) * (x.rel === "father" || x.rel === "mother" ? 1 : 0.7) * lonevity) {
        x.status = "dead"; x.endAt = p.age; note(p, x, "died");
        if (x.rel === "father" || x.rel === "mother") { addStat(p, "happy", -6); out.lines.push({ k: "parent_died", v: { who: x.name, n: a } }); remember(p, "m_parent_died", { who: x.name }, -1, 3); }
        else if (x.rel === "sibling") { addStat(p, "happy", -6); out.lines.push({ k: "sibling_died", v: { who: x.name } }); remember(p, "m_parent_died", { who: x.name }, -1, 2); }
        else if (x.close >= 45 || x.rel === "friend") { addStat(p, "happy", -3); out.lines.push({ k: "friend_died", v: { who: x.name } }); }
        continue;
      }
      x.conflict = Math.max(0, x.conflict - 3);
      if (x.status === "active" && (x.rel === "friend" || x.rel === "colleague") && p.age - x.touch >= 4) {
        x.close = clamp100(x.close - rint(1, 3));
        if (x.close < 12 && x.rel === "friend") { end(p, x, "drift"); out.lines.push({ k: "drift", v: { who: x.name } }); remember(p, "m_drift", { who: x.name }, -1, 1); }
      }
      if ((x.rel === "father" || x.rel === "mother") && x.status === "active" && p.age >= 20 && p.age - x.touch >= 3) x.close = clamp100(x.close - 1);
    }
    // 새 친구(어린 시절·학창 시절·어른)
    const nf = (k, close) => { const g = rng() < .5 ? "M" : "F"; const used = new Set(p.people.map(x => x.name)); const name = pickOne(FRIEND_N.filter(n => !used.has(n))) || randomName(g); const x = addPerson(p, { name, rel: "friend", g, off: rint(-1, 1), close }); out.lines.push({ k, v: { who: name } }); remember(p, "m_friend", { who: name }, 1, 1); return x; };
    if (p.age === 8 && rng() < .75) nf("new_friend_child", 60);
    else if (p.age === 15 && rng() < .6) nf("new_friend_teen", 58);
    else if (p.age >= 22 && p.age <= 60 && activeOf(p, "friend").length < 2 && rng() < .12) nf("new_friend_adult", 50);
    // 직장 동료
    if (p.career && p.age >= 18 && !activeOf(p, "colleague").some(x => x.career === p.career) && rng() < .7) {
      const g = rng() < .5 ? "M" : "F"; const used = new Set(p.people.map(x => x.name));
      const name = pickOne(FRIEND_N.filter(n => !used.has(n))) || randomName(g);
      addPerson(p, { name, rel: "colleague", g, off: rint(-6, 6), close: 45, career: p.career });
      out.lines.push({ k: "new_colleague", v: { who: name } });
    }

    // --- 학력: 21살까지 대학 결정을 안 했으면 성적·집안에 따라 정해진다 ---
    if (p.edu === "none") {
      if (p.flags.has("college_done")) { p.edu = p.flags.has("no_college") ? "high" : "college"; if (p.edu === "college") remember(p, "m_edu", {}, 1, 1); }
      else if (p.age >= 21) {
        const c = Math.max(0.1, Math.min(0.95, 0.35 + (p.stats.intel - 40) / 70 + (p.flags.has("rich_family") ? .15 : p.flags.has("poor_family") ? -.1 : 0)));
        if (rng() < c) { p.edu = "college"; p.flags.add("college_done"); out.lines.push({ k: "edu_college" }); remember(p, "m_edu", {}, 1, 1); }
        else { p.edu = "high"; p.flags.add("college_done"); p.flags.add("no_college"); out.lines.push({ k: "edu_high" }); }
      }
    }
    if (p.career === "doctor" && p.edu !== "med") p.edu = "med";
    if (p.career === "lawyer" && p.edu !== "law" && p.edu !== "med") p.edu = "law";

    // --- 승진·연봉 구조 ---
    if (p.career && p.job) {
      const L = LADDER[p.career];
      const yrs = p.age - (p.careerSince || 0);
      if (L) {
        const si = ladderStep(p.career, p.job.title);
        if (si >= 0 && si > p.careerStep) p.careerStep = si;                          // 사건이 준 직함이 단계보다 높으면 맞춘다
        const nx = p.careerStep + 1;
        if (nx < LADDER_YEARS.length && yrs >= LADDER_YEARS[nx] && (si >= 0 || p.job.title === CAREERS[p.career]?.title)) {
          const chance = 0.35 + (p.stats.intel + p.stats.social - 100) / 250 + (p.stats.luck - 50) / 300;
          if (rng() < chance) {
            p.careerStep = nx;
            const [t, sal] = L[nx];
            p.job = { ...p.job, title: t, salary: Math.max(p.job.salary, sal) }; p.careerTitle = t;
            out.lines.push({ k: "promoted", v: { job: t } }); remember(p, "m_promoted", { job: t }, 1, 1);
            out.notices.push({ k: "promoted", job: t });
          }
        }
        const fl = L[Math.min(5, p.careerStep)][1];
        if (p.job.salary < fl * 0.85) { p.job.salary = Math.round(p.job.salary + (fl - p.job.salary) / 3); }
      } else if (PAY_FLOOR[p.career] && careerOfJob(p.job.title) === p.career) {
        const fl = PAY_FLOOR[p.career][Math.min(5, p.careerStep)];
        if (fl && p.job.salary < fl * 0.85) { p.job.salary = Math.round(p.job.salary + (fl - p.job.salary) / 2); if (rng() < .25) out.lines.push({ k: "pay_raise" }); }
      }
      if (p.careers?.[p.career]) p.careers[p.career].step = p.careerStep;
    }

    // --- 시대가 사람에게 닿는다 ---
    if (w) {
      const ord = ["worker", "corporate"].includes(p.career);
      if (ord && p.job && p.age < 58) {
        const r = w.econ === "crisis" ? .07 : w.econ === "recession" ? .025 : 0;
        const ai = hasTech(w, "ai") && p.career === "worker" ? .012 : 0;
        if (r + ai > 0 && rng() < r + ai) {
          const k = rng() < r / (r + ai) ? "layoff_crisis" : "layoff_ai";
          endCareer(p, "fired"); addStat(p, "happy", -7);
          out.lines.push({ k }); remember(p, "m_fired", {}, -1, 2); out.notices.push({ k: "fired" });
        }
      }
      if (out.news.some(n => n.k === "tech_ai") && p.career === "developer" && p.job) { p.job.salary = Math.round(p.job.salary * 1.15); out.lines.push({ k: "tech_dev" }); }
      const t = w.trend;
      if (t === "shortform" && p.stats.internet >= 55) addStat(p, "internet", 1);
      else if (t === "fitness" && rng() < .5) addStat(p, "power", 1);
      else if (t === "petboom" && alivePets(p).length) addStat(p, "happy", 1);
      else if (t === "retro" && p.age >= 40 && rng() < .5) addStat(p, "happy", 1);
      else if (t === "camping" && p.spouse && rng() < .5) addStat(p, "happy", 1);
      else if (t === "kwave" && ["idol", "streamer", "writer", "artist"].includes(p.career) && p.job) p.job.salary = Math.round(p.job.salary * 1.03);
    }

    updateGoal(p, out);
    sync(p);
    out.achv = achvCheck(p);
    return out;
  }

  // ===== 경제에 시대 반영: 연봉 인상률 배수, 투자(주식·집) 손익 =====
  function econ(p) {
    const w = p.world;
    if (!w) return { raise: 1, market: 0 };
    const m = Math.max(0, p.stats.money);
    let market = Math.round(m * 0.12 * w.stockRet);                    // 순자산 일부는 주식·펀드
    if (p.housing === "own") market += Math.round(m * 0.3 * w.houseRet);   // 집은 집값을 따라
    return { raise: RAISE[w.econ] || 1, market, medMul: hasTech(w, "robot") ? 0.75 : 1 };
  }
  const fateOk = (p, f) => {
    if (p.world && WORLD_FATES.has(f.id)) return false;                  // 경기·집값은 모두가 같은 시대를 겪는다
    if (p.spouse?.pid && f.id === "spouse_sudden") return false;          // 배우자가 다른 플레이어면 그 사람의 생사는 그 사람 인생이 정한다
    return true;
  };
  const fateWeight = (p, f) => (hasTech(p.world, "auto") && (f.id === "car_accident" || f.id === "fatal_accident" || f.id === "fatal_drunk_driver") ? 0.5 : 1);
  const mortalityMul = p => (hasTech(p.world, "longevity") && p.age >= 60 ? 0.85 : 1);

  // ===== 사건 자격(코어 eligible 뒤에 추가로) =====
  function eligible(p, ev) {
    compat(p);
    if (ev.who && !whoList(p, ev.who).length) return false;
    if (ev.parentAlive && !parentAlive(p, ev.parentAlive === true ? null : ev.parentAlive)) return false;
    if (ev.memReq && !ev.memReq.every(k => hasMem(p, k))) return false;
    if (ev.memBan && ev.memBan.some(k => hasMem(p, k))) return false;
    if (ev.eduReq && !ev.eduReq.includes(p.edu)) return false;
    if (ev.worldReq && !(p.world && ev.worldReq(p.world))) return false;
    if (ev.memoFrom && !p.memories.some(m => m.k === "ev" && m.ev && p.age - m.a >= 10 && (m.g === "bad" || m.g === "crit"))) return false;
    if (ev.careerEntry && ev.careerEntry !== "job" && !entryOk(p, ev.careerEntry)) return false;
    // 연인이 다른 플레이어면 결혼·이별은 둘의 동의로만(멀티 제안) — 혼자 결혼하거나 헤어지는 사건 X
    if (p.romancePid && p.relations?.romance && ev.relationRequired?.romance) return false;
    if (p.spouse?.pid && (ev.choices || []).some(c => [c, ...(c.outcomes || [])].some(o => o.life?.divorce || o.life?.widow))) return false;
    return true;
  }
  function themeOf(ev) {
    if (ev._theme !== undefined) return ev._theme;
    const s = ev.id + " " + (ev.title || "");
    const t = THEMES.find(([, re]) => re.test(s));
    try { ev._theme = t ? t[0] : null; } catch (_) {}
    return t ? t[0] : null;
  }
  // 비슷한 사건은 3년 안에 덜 나오게
  function weight(p, ev) {
    const th = themeOf(ev);
    if (th && p.themeAt[th] != null && p.age - p.themeAt[th] < 3) return 0.15;
    if (ev.relationRequired?.romance && !p.spouse) return 1.35;   // 새 사건이 자리를 나눠 가져도 연애→결혼 흐름은 예전만큼
    return 1;
  }
  /** 우선 사건: 장기 목표 도전 — 직업 사건·일반 사건보다 먼저(조건이 될 때 해마다 22%) */
  function storyEvent(p, EVENT_BY_ID) {
    if (!p.goal || p.goal.dropUntil) return null;
    const g = GOAL_BY_ID[p.goal.id];
    if (!g || g.career !== p.career || p.age < p.goal.next || !goalReady(p, g)) return null;
    if (rng() > 0.22) return null;
    return goalEvent(p, EVENT_BY_ID.get("sys_goal_push"));
  }
  /** 사건이 정해진 순간: 등장 인물을 고정한다({who}) */
  function onPick(p, ev) {
    if (!ev) return ev;
    const th = themeOf(ev); if (th) p.themeAt[th] = p.age;
    if (ev.who) {
      const l = whoList(p, ev.who);
      const x = ev.who.prefer === "close" ? [...l].sort((a, b) => b.close - a.close)[0] : pickOne(l);
      p.whoNow = x ? x.id : null;
    }
    if (ev.memoFrom) {                                        // '그때 그 선택' — 오래전 큰 사건 하나를 떠올린다
      const ms = p.memories.filter(m => m.k === "ev" && m.ev && p.age - m.a >= 10 && (m.g === "bad" || m.g === "crit"));
      p.memoNow = ms.length ? pickOne(ms) : null;
    }
    return ev;
  }
  const whoNow = p => p.people?.find(x => x.id === p.whoNow) || null;

  // ===== 훅: 선택 적용 뒤 — 관계 변화·목표·기억·업적 =====
  function onChoice(p, ev, choice, outcome, res) {
    compat(p);
    const out = { achv: [], notices: [], lines: [] };
    drainLines(p, out);
    const x = ev.who ? whoNow(p) : null;
    const applyR = r => {
      if (!r || !x) return;
      if (r.close) x.close = clamp100(x.close + r.close);
      if (r.conflict) x.conflict = clamp100(x.conflict + r.conflict);
      x.touch = p.age;
      if (r.conflict > 0 && x.conflict >= 50) { remember(p, "m_conflict", { who: x.name }, -1, 1); note(p, x, "conflict"); }
      if (r.reconcile) {
        x.conflict = 0; x.close = Math.max(x.close, 60);
        if (x.status === "ended" && (x.rel === "friend" || x.rel === "colleague" || x.rel === "rival" || x.rel === "sibling")) { x.status = "active"; x.why = null; }
        if (x.rel === "rival") x.rel = "friend";
        remember(p, "m_reconcile", { who: x.name }, 1, 2); note(p, x, "reconcile"); out.notices.push({ k: "reconcile", who: x.name });
      }
      if (r.end) { end(p, x, r.end); remember(p, r.end === "drift" ? "m_drift" : "m_conflict", { who: x.name }, -1, 1); out.notices.push({ k: "rel_end", who: x.name }); }
      if (r.coop) note(p, x, "coop");
      if (r.helped) remember(p, "m_helped", { who: x.name }, 1, 1);
      if (r.help) remember(p, "m_help", { who: x.name }, 1, 1);
    };
    applyR(choice.rel2); applyR(outcome?.rel2);
    // 부모님과의 이별 사건 → 그분은 정말 떠나신 것으로
    if (ev.killWho === "mother" || ev.killWho === "father" || ev.killWho === "parent") {
      const t = parents(p).filter(y => y.status === "active" && (ev.killWho === "parent" || y.rel === ev.killWho)).sort((a, b) => b.off - a.off)[0];
      if (t) { t.status = "dead"; t.endAt = p.age; note(p, t, "died"); remember(p, "m_parent_died", { who: t.name }, -1, 3); }
      if (parents(p).some(y => y.status === "active")) p.flags.delete("orphaned");
    }
    // 장기 목표 도전
    const gkey = ev.sysGoal || (ev.id === "sys_goal_push" && p.goal?.id);
    if (gkey) {
      const g = { ...GOAL_BY_ID[gkey] };
      const gm = p.goalMem[gkey] || (p.goalMem[gkey] = { fails: 0, prep: 0 });
      const act = outcome?.sysGoal || choice.sysGoal;
      if (act === "win") {
        if (p.career === g.career) {
          p.careerStep = Math.max(p.careerStep, g.s);
          if (g.t && p.job) { p.job = { ...p.job, title: g.t, salary: Math.max(p.job.salary, g.sal || 0) }; p.careerTitle = g.t; }
          if (p.careers?.[p.career]) p.careers[p.career].step = p.careerStep;
        }
        const o2 = { lines: out.lines };
        goalDone(p, g, o2, "push");
        out.goalDone = gkey;
        if (p.careerStep >= 5) { remember(p, "m_peak", { job: p.job?.title || "" }, 1, 3); }
      } else if (act === "fail") {
        gm.fails++; if (p.goal) p.goal.next = p.age + rint(2, 3);
        remember(p, "m_goal_fail", { goal: gkey }, -1, 2);
      } else if (act === "prep") {
        gm.prep++; if (p.goal) p.goal.next = p.age + 1;
        addStat(p, GOAL_STAT[g.career] || "intel", 3);
      } else if (act === "drop") {
        if (p.goal) { p.goal.dropUntil = p.age + 5; p.goal.next = p.age + 5; }
        p.goalHist.push({ id: gkey, career: g.career, state: "dropped", at: p.age });
        remember(p, "m_goal_drop", { goal: gkey }, -1, 1);
      }
    }
    // 직업 시작/끝 기억
    if (p.career && p.career !== p._lastCareer) {
      if (p.job?.title) remember(p, "m_career", { job: p.job.title }, 1, 2);
      out.notices.push({ k: "career", career: p.career, job: p.job?.title || null, from: p._lastCareer || null });
    } else if (!p.career && p._lastCareer) {
      remember(p, "m_career_end", { job: p._lastJob || "" }, 0, 2);
      out.notices.push({ k: "career_end", from: p._lastCareer });
    }
    p._lastCareer = p.career; p._lastJob = p.job?.title || p._lastJob;
    // 큰 사건은 기억으로
    if (res && ev.id !== "sys_goal_push" && (res.grade === "crit" || res.grade === "bad" || ev.type === "special")) rememberEv(p, { ev: ev.id, c: choice.id, g: res.grade, title: res.title, choice: res.choice }, res.grade === "bad" ? -1 : 1, res.grade === "crit" || ev.type === "special" ? 2 : 1);
    sync(p);
    const og = { lines: out.lines };
    updateGoal(p, og);
    if (og.goalDone) out.goalDone = og.goalDone;
    out.achv = achvCheck(p);
    return out;
  }
  /** 운명 사건 뒤(직업 잃음·사별 등) 동기화 */
  function afterFate(p, f) {
    compat(p);
    if (f && f.id === "lotto_big") rememberEv(p, { fate: f.id, g: "crit", title: f.title }, 1, 3);
    else if (f && f.good === false && /spouse_sudden|guarantor|jeonse_fraud|rare_disease|car_accident/.test(f.id)) rememberEv(p, { fate: f.id, g: "bad", title: f.title }, -1, 2);
    sync(p);
    return achvCheck(p);
  }

  // ===== 평범한 해 한 줄(관계·목표·시대) — 35% 확률로 코어 문구 대신 =====
  function quiet(p) {
    if (rng() > 0.35) return null;
    const c = [];
    const a = p.age;
    const par = parents(p).filter(x => x.status === "active");
    if (par.length && a >= 22 && a <= 62) { c.push({ k: "q_parent_visit", e: "🍲", w: 1 }); const x = pickOne(par); c.push({ k: "q_parent_call", e: "📞", w: 1, v: { who: x.name }, id: x.id }); }
    const fr = activeOf(p, "friend");
    if (fr.length) { const x = pickOne(fr); c.push({ k: a <= 12 ? "q_friend_kid" : "q_friend_meet", e: a <= 12 ? "🛝" : "🍻", w: 1.2, v: { who: x.name }, id: x.id }); }
    const co = activeOf(p, "colleague").filter(x => x.career === p.career);
    if (co.length && p.job) { const x = pickOne(co); c.push({ k: "q_colleague", e: "🍱", w: .8, v: { who: x.name }, id: x.id }); }
    const sb = activeOf(p, "sibling");
    if (sb.length && a >= 20) { const x = sb[0]; c.push({ k: "q_sibling", e: "🧧", w: .6, v: { who: x.name }, id: x.id }); }
    if (p.goal && !p.goal.dropUntil) c.push({ k: "q_goal", e: "🎯", w: 1, v: { goal: p.goal.id } });
    if (p.world?.trend && a >= 12) c.push({ k: "q_trend", e: "🗞️", w: .5, v: { trend: p.world.trend } });
    const gone = parents(p).filter(x => x.status === "dead" && x.endAt != null && a - x.endAt >= 1);
    if (gone.length && a < 90) { const x = pickOne(gone); c.push({ k: "q_grave", e: "🌼", w: .4, v: { who: x.name } }); }
    const kids = activeOf(p, "kid").filter(x => ageOf(p, x) >= 3 && ageOf(p, x) <= 30);
    if (kids.length) { const x = pickOne(kids); c.push({ k: "q_kid_grown", e: "📏", w: .6, v: { who: x.name, n: ageOf(p, x) } }); }
    if (p.spouse && a >= 60) c.push({ k: "q_spouse_walk", e: "🚶", w: .8, v: { who: p.spouse.name } });
    const rv = p.people.filter(x => x.rel === "rival" && alive(x));
    if (rv.length && a >= 15) { const x = pickOne(rv); c.push({ k: "q_rival", e: "👀", w: .3, v: { who: x.name } }); }
    if (!c.length) return null;
    const q = pickWeighted(c, x => x.w);
    if (q.id) { const x = p.people.find(y => y.id === q.id); if (x) { x.touch = p.age; x.close = clamp100(x.close + 1); } }
    return { emoji: q.e, text: tx(q.k, q.v || {}), k: "", sys: q.k, v: q.v || {} };
  }

  function onDeath(p) { compat(p); sync(p); return achvCheck(p, true); }

  // ===== 화면용 요약(공개 데이터) =====
  function peopleView(p) {
    compat(p);
    return p.people.map(x => ({ id: x.id, name: x.name, rel: x.rel, g: x.g, age: ageOf(p, x), deadAge: x.status === "dead" && x.endAt != null ? x.endAt + x.off : null, close: x.close, conflict: x.conflict, status: x.status, why: x.why || null, since: x.since, endAt: x.endAt ?? null, pid: x.pid || null, career: x.career || null, notes: x.notes.slice(-5) }));
  }
  function goalView(p) {
    compat(p);
    const g = p.goal && GOAL_BY_ID[p.goal.id];
    const cur = g ? { id: g.id, career: g.career, s: g.s, since: p.goal.since, dropped: !!p.goal.dropUntil, lacks: goalLacks(p, g), ready: goalReady(p, g), fails: p.goalMem[g.id]?.fails || 0, prep: p.goalMem[g.id]?.prep || 0, chance: goalReady(p, g) ? Math.round(goalChance(p, g) * 100) : null } : null;
    const list = p.career && GOALS[p.career] ? GOALS[p.career].map(x => ({ id: x.id, s: x.s, done: p.goalsDone.includes(x.id) })) : [];
    return { cur, list, done: p.goalsDone.slice(), hist: p.goalHist.slice(-12) };
  }
  function worldView(w) { return w ? { birthYear: w.birthYear, year: w.birthYear + w.age, econ: w.econ, stock: Math.round(w.stock), house: Math.round(w.house), tech: w.tech.slice(), trend: w.trend, hist: w.hist.slice(-40) } : null; }

  // ===== 멀티 상호작용(서버가 부른다) =====
  // 두 사람의 인생에 서로를 등록: kind friend|lover|partner|rival
  function link(pa, pb, kind, ids) {
    compat(pa); compat(pb);
    const one = (me, other, oid) => {
      let x = me.people.find(y => y.pid === oid && alive(y));
      if (kind === "lover") {
        if (me.spouse || me.relations.romance) return;
        me.relations.romance = other.nickname; me.romancePid = oid;
      }
      if (!x) { x = addPerson(me, { name: other.nickname, rel: kind === "lover" ? "lover" : kind === "partner" ? "friend" : kind, g: other.gender, off: other.age - me.age, close: kind === "rival" ? 30 : 65, pid: oid, conflict: kind === "rival" ? 40 : 0 }); if (kind === "partner") x.partner = true; }
      else if (kind === "lover") { x.rel = "lover"; x.close = Math.max(x.close, 70); }
      else if (kind === "partner") { x.partner = true; if (!["spouse", "lover", "friend"].includes(x.rel)) x.rel = "partner"; }
      else if (kind === "friend" && x.rel === "rival") { x.rel = "friend"; x.conflict = 0; }
      x.touch = me.age;
      if (kind === "partner") remember(me, "m_partner", { who: other.nickname }, 1, 2);
      else if (kind === "friend") remember(me, "m_friend", { who: other.nickname }, 1, 2);
      else if (kind === "lover") remember(me, "m_lover", { who: other.nickname }, 1, 2);
      sync(me);
    };
    one(pa, pb, ids[1]); one(pb, pa, ids[0]);
    const k = kind === "lover" ? "mp_lover" : kind === "partner" ? "mp_partner" : "mp_friend";
    return [{ k, v: { who: pb.nickname } }, { k, v: { who: pa.nickname } }];
  }
  function marry(pa, pb, ids) {
    const one = (me, other, oid) => {
      me.spouse = { name: other.nickname, bond: 80, since: me.age, salary: 0, pid: oid };
      me.relations.romance = null; me.flags.add("married"); me.flags.delete("dating");
      sync(me);
    };
    one(pa, pb, ids[1]); one(pb, pa, ids[0]);
    addStat(pa, "happy", 10); addStat(pb, "happy", 10);
    return [{ k: "mp_marry", v: { who: pb.nickname } }, { k: "mp_marry", v: { who: pa.nickname } }];
  }
  /** 다른 플레이어가 세상을 떠남 → 내 인생에서 그 사람은 '고인'으로. 배우자였다면 사별 */
  function playerDied(me, oid, name) {
    compat(me);
    const xs = me.people.filter(x => x.pid === oid && alive(x));
    if (!xs.length) return null;
    let line = { k: "mp_lost", v: { who: name } };
    for (const x of xs) { x.status = "dead"; x.endAt = me.age; note(me, x, "died"); }
    if (me.spouse?.pid === oid) {
      me.spouse = null; me.flags.add("widowed"); me.flags.delete("married"); me.spouseEnd = { why: "widow", age: me.age };
      addStat(me, "happy", -15); remember(me, "m_widow", { who: name }, -1, 3);
      line = { k: "mp_widow", v: { who: name } };
    } else { addStat(me, "happy", -4); }
    if (me.romancePid === oid && me.relations.romance === name) { me.relations.romance = null; me.romancePid = null; }
    sync(me);
    return line;
  }
  /** 다른 플레이어가 방을 나감 → 내 인생에선 멀리 떠난 사람(고인 아님) */
  function playerLeft(me, oid, name) {
    compat(me);
    const xs = me.people.filter(x => x.pid === oid && x.status === "active");
    if (!xs.length && me.spouse?.pid !== oid && me.romancePid !== oid) return null;
    for (const x of xs) { if (x.rel === "spouse") x.rel = "ex"; else if (x.rel === "lover") x.rel = "exlover"; end(me, x, "left"); x.pid = null; }
    if (me.spouse?.pid === oid) { me.spouse = null; me.flags.add("divorced"); me.flags.delete("married"); me.spouseEnd = { why: "divorce", age: me.age, name }; }
    if (me.romancePid === oid) { if (me.relations.romance === name) me.relations.romance = null; me.romancePid = null; }
    for (const x of me.people.filter(y => y.pid === oid)) x.pid = null;
    sync(me);
    return { k: "mp_left", v: { who: name } };
  }
  /** 플레이어 부부의 아이는 둘 다의 아이 */
  function shareKids(me, other) {
    compat(me); compat(other);
    const out = [];
    for (const k of me.kids) if (!other.kids.some(y => y.name === k.name && y.born === k.born)) { other.kids.push({ ...k }); out.push(k.name); }
    if (out.length) { other.flags.add("has_kid"); sync(other); }
    return out;
  }
  /** 다른 플레이어 배우자가 이혼을 겪음 → 나도 이혼(같은 결혼이니까) */
  function playerDivorced(me, oid, name) {
    compat(me);
    if (me.spouse?.pid !== oid) return null;
    me.spouse = null; me.flags.add("divorced"); me.flags.delete("married"); me.spouseEnd = { why: "divorce", age: me.age, pid: oid, name };
    addStat(me, "happy", -8);
    sync(me);
    return { k: "mp_divorced", v: { who: name } };
  }
  /** 연인이었던 플레이어와 헤어짐(그쪽 인생에서 연인이 바뀜) */
  function playerBrokeUp(me, oid, name) {
    compat(me);
    if (me.romancePid !== oid) return null;
    if (me.relations.romance === name) me.relations.romance = null;
    me.romancePid = null;
    sync(me);
    return { k: "mp_breakup", v: { who: name } };
  }
  /** 사람 사이 관계 상태(제안 가능한지) */
  const linkOf = (me, oid) => me.people?.find(x => x.pid === oid && alive(x)) || null;
  function proposalFor(pa, pb, ida, idb) {
    if (!pa.alive || !pb.alive) return null;
    compat(pa); compat(pb);
    const la = linkOf(pa, idb), lb = linkOf(pb, ida), age = Math.min(pa.age, pb.age);
    const single = q => !q.spouse && !q.relations.romance;
    if (la?.rel === "lover" && lb?.rel === "lover" && !pa.spouse && !pb.spouse && age >= 22 && age <= 60 && pa.age - la.since >= 1) return "marry";
    if (!la && !lb && age >= 8) return "friend";
    if (la?.rel === "friend" && lb?.rel === "friend" && la.close >= 55 && single(pa) && single(pb) && age >= 18 && age <= 50) return "lover";
    if (la && lb && ["friend", "lover", "spouse"].includes(la.rel) && !la.partner && age >= 25 && age <= 62 && (pa.career === "business" || pb.career === "business" || (pa.stats.money >= 3000 && pb.stats.money >= 3000))) return "partner";
    return null;
  }
  /** 동업 정산: 해마다 둘의 능력·운으로 손익(같은 금액을 나눈다) */
  function partnerYear(pa, pb, w) {
    const sk = (pa.stats.intel + pb.stats.intel + pa.stats.social + pb.stats.social) / 4 + (pa.stats.luck + pb.stats.luck) / 4 - 50;
    const base = (w ? STOCK_RET[w.econ] : .05) * 2 + sk / 200 + (rng() - .5) * .5;
    const amt = Math.round(base * 1500);
    pa.stats.money += amt; pb.stats.money += amt;
    return amt;
  }
  /** 같은 직업 둘이 맞붙는다(선거·차트·리그…) */
  function rivalry(pa, pb) {
    const sc = q => q.stats.intel * .3 + q.stats.social * .4 + q.stats.luck * .3 + q.careerStep * 4 + rng() * 30;
    const aWin = sc(pa) >= sc(pb);
    const [w, l] = aWin ? [pa, pb] : [pb, pa];
    addStat(w, "happy", 5); addStat(w, "social", 3); w.stats.money += 500; w.mpRivalWins = (w.mpRivalWins || 0) + 1;
    addStat(l, "happy", -4);
    remember(w, "m_rival_win", { who: l.nickname }, 1, 1); remember(l, "m_rival_lose", { who: w.nickname }, -1, 1);
    return aWin;
  }

  // ===== 저장/복원(솔로 이어하기) =====
  function serialize(p) {
    const o = { ...p };
    for (const k of ["routes", "flags", "seenEventIds", "seenSpecialIds"]) o[k] = Array.from(p[k] || []);
    o.__v = 3;
    return o;
  }
  function restore(o) {
    const p = { ...o };
    for (const k of ["routes", "flags", "seenEventIds", "seenSpecialIds"]) p[k] = new Set(o[k] || []);
    compat(p);
    return p;
  }

  return {
    compat, onBirth, onYear, careerEnded, drainLines, econ, fateOk, fateWeight, mortalityMul, eligible, weight, storyEvent, onPick, onChoice, afterFate, quiet, onDeath,
    whoNow, peopleView, goalView, goalEventFor: (p, events) => goalEvent(p, events.find(e => e.id === "sys_goal_push")), worldView, createWorld, worldTo, entryOk, entryMul, remember, hasMem, memCount, parentAlive,
    link, marry, playerDied, playerDivorced, playerBrokeUp, playerLeft, shareKids, linkOf, proposalFor, partnerYear, rivalry, serialize, restore, sync, achvCheck, ageOf,
  };
}
