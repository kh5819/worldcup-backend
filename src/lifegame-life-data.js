// =========================
// DUO GAME ZONE / 인생게임 v2 데이터 — 시기·스탯·평범한 해·마일스톤·사망원인·직업 + 신규 이벤트/엔딩 병합
// buildLife(LEG): LEG = 구 lifegame-events.js 의 export(STAT_DEFS, EVENTS, ENDINGS, ANALYSIS_LINES ...)
// =========================
import { EVENTS_YOUNG } from "./lifegame-events-young.js";
import { EVENTS_FAMILY } from "./lifegame-events-family.js";
import { EVENTS_LATER } from "./lifegame-events-later.js";
import { EVENTS_PETS } from "./lifegame-events-pets.js";
import { EVENTS_CAREERS, CAREERS, TITLE_CAREER, ENDINGS_CAREERS } from "./lifegame-events-careers.js";
import { ENDINGS_V2, ANALYSIS_V2 } from "./lifegame-endings-v2.js";
import { EVENTS_V3, ENDINGS_V3, ANALYSIS_V3 } from "./lifegame-events-v3.js";
import { SYS_TITLES } from "./lifegame-systems.js";

// v3: 부모님이 살아 계실 때만(사람 목록이 없는 예전 데이터는 orphaned 플래그로)
const parentLives = p => p.people ? p.people.some(x => (x.rel === "father" || x.rel === "mother") && x.status === "active") : !p.flags.has("orphaned");

export const STAGES_V2 = [
  { id: "infant",  label: "유아기",   emoji: "👶", ageStart: 1,  ageEnd: 6,   eventRate: 0.62, maxGap: 3 },
  { id: "child",   label: "초등학생", emoji: "🧒", ageStart: 7,  ageEnd: 12,  eventRate: 0.72, maxGap: 3 },
  { id: "teen",    label: "중고등",   emoji: "🧑", ageStart: 13, ageEnd: 18,  eventRate: 0.82, maxGap: 2 },
  { id: "adult",   label: "청년·성인", emoji: "🎓", ageStart: 19, ageEnd: 34,  eventRate: 0.84, maxGap: 2 },
  { id: "midlife", label: "중년",     emoji: "🧑‍💼", ageStart: 35, ageEnd: 59,  eventRate: 0.74, maxGap: 3 },
  { id: "senior",  label: "노년",     emoji: "👴", ageStart: 60, ageEnd: 79,  eventRate: 0.68, maxGap: 3 },
  { id: "elder",   label: "황혼",     emoji: "🌇", ageStart: 80, ageEnd: 110, eventRate: 0.62, maxGap: 4 },
];

export const MINI_AGES = [9, 17, 28, 42, 58];      // 이 나이가 된 해에 미니게임(살아있는 사람만) — 5종 한 번씩

const HEALTH_DEF = { key: "health", label: "건강", emoji: "🩺", initial: 75 };

export const MILESTONES = {
  1: { emoji: "🎂", text: "첫 번째 생일. 인생이 시작됐다." },
  3: { emoji: "🏫", text: "어린이집에 처음 갔다." },
  7: { emoji: "🎒", text: "초등학교 입학. 인생 첫 사회생활." },
  10: { emoji: "🔟", text: "두 자리 나이가 되었다." },
  13: { emoji: "🏫", text: "중학교 입학. 교복이 커서 어색하다." },
  16: { emoji: "📚", text: "고등학교에 들어갔다." },
  19: { emoji: "📝", text: "수능을 치르고 성인이 되는 해." },
  20: { emoji: "🍺", text: "스무 살. 합법적으로 술을 살 수 있다." },
  25: { emoji: "🎓", text: "사회에서 첫 발을 뗄 나이." },
  30: { emoji: "3️⃣", text: "서른. 앞자리가 바뀌었다." },
  35: { emoji: "🧑‍💼", text: "서른다섯. 이제 중견이라고 불린다." },
  40: { emoji: "4️⃣", text: "마흔. 불혹이라는데 흔들리는 건 많다." },
  50: { emoji: "5️⃣", text: "쉰. 반백 년을 살았다." },
  55: { emoji: "🕰️", text: "정년이 눈앞에 보이기 시작한다." },
  60: { emoji: "🎉", text: "환갑. 정년을 맞고 새 시기가 열린다." },
  65: { emoji: "🚇", text: "지하철이 공짜가 되는 나이." },
  70: { emoji: "🎊", text: "칠순. 친구들 부고가 늘어간다." },
  77: { emoji: "🎐", text: "희수(喜壽). 오래 살았다." },
  80: { emoji: "🌇", text: "팔순. 하루하루가 선물이다." },
  88: { emoji: "🍚", text: "미수(米壽). 쌀 미 자처럼 여든여덟." },
  90: { emoji: "🌅", text: "구순. 가장 오래된 친구는 이제 사진 속에 있다." },
  100: { emoji: "💯", text: "백 살. 신문에 났다." },
};

export const JOBS = [
  { title: "편의점 아르바이트", salary: 2000, min: 0 },
  { title: "물류센터 근로자", salary: 2700, min: 45 },
  { title: "중소기업 사무직", salary: 3100, min: 75 },
  { title: "영업직", salary: 3400, min: 88 },
  { title: "공무원", salary: 3700, min: 108 },
  { title: "중견기업 대리", salary: 4000, min: 105 },
  { title: "대기업 사원", salary: 5200, min: 125 },
  { title: "개발자", salary: 5800, min: 135 },
  { title: "전문직(회계·법무)", salary: 8000, min: 155 },
];

export const DEATH_CAUSES = [
  { id: "accident", label: "교통사고로", emoji: "🚑", age: [3, 70], weight: 2.2, line: "아침에 나간 길이 마지막이 되었다." },
  { id: "disease", label: "큰 병으로", emoji: "🏥", age: [20, 85], weight: 3, line: "오랜 투병 끝에 눈을 감았다." },
  { id: "sudden", label: "갑작스러운 심장마비로", emoji: "💔", age: [30, 80], weight: 2.5, line: "아무도 예상하지 못한 순간이었다." },
  { id: "stroke", label: "뇌졸중으로", emoji: "🧠", age: [55, 95], weight: 2, line: "쓰러진 뒤 다시 일어나지 못했다." },
  { id: "pneumonia", label: "폐렴으로", emoji: "😷", age: [70, 105], weight: 2, line: "환절기 감기가 끝내 폐렴이 되었다." },
  { id: "overwork", label: "과로로", emoji: "🌙", age: [25, 55], weight: 1.4, cond: p => p.stats.health < 45, line: "마지막 야근이었다. 아무도 그가 그렇게 지쳤는지 몰랐다." },
  { id: "natural", label: "노환으로", emoji: "🕊️", age: [75, 110], weight: 6, line: "가족이 둘러앉은 가운데 평화롭게 잠들었다." },
  { id: "infant_ill", label: "어린 나이에 병으로", emoji: "🕯️", age: [1, 19], weight: 2, line: "너무 이른 이별이었다." },
  { id: "crime", label: "불의의 사건으로", emoji: "🕯️", age: [18, 80], weight: 0, cond: () => false, line: "너무 갑작스러운 이별이었다." },   // 운명 사건으로만
  { id: "adventure", label: "무모한 도전 중 사고로", emoji: "🧗", age: [14, 60], weight: 0.4, cond: p => p.stats.power > 70, line: "마지막까지 하고 싶은 걸 하다 떠났다." },
];

// 평범한 해 한 줄. stage/age/married/hasKid/flag/cond 로 걸러진다. 문구: {spouse}{kid}{job}{age}
const Q = (stage, text, extra = {}) => ({ stage, text, ...extra });
export const QUIET = [
  // 유아기
  Q("infant", "걸음마를 떼고, 넘어지고, 또 일어났다.", { emoji: "👣" }),
  Q("infant", "아무거나 입에 넣다가 엄마한테 혼났다.", { emoji: "🍼" }),
  Q("infant", "밤마다 잠투정이 심했다. 부모님 눈 밑이 어두워졌다.", { emoji: "🌙" }),
  Q("infant", "뽀로로를 틀어 달라고 떼를 썼다.", { emoji: "📺" }),
  Q("infant", "처음 보는 동물 앞에서 한참을 쳐다봤다.", { emoji: "🐶" }),
  Q("infant", "감기에 걸려 병원에 다녀왔다. 주사는 울면서 맞았다.", { emoji: "🩺" }),
  Q("infant", "어린이집에서 친구와 장난감을 두고 다퉜다.", { emoji: "🧸", age: [3, 6] }),
  Q("infant", "한글을 조금씩 읽기 시작했다.", { emoji: "🔤", age: [5, 6] }),
  // 초등
  Q("child", "방학 숙제를 개학 전날 몰아서 했다.", { emoji: "📓" }),
  Q("child", "학교 끝나고 학원 셔틀에 올랐다. 학원은 세 곳.", { emoji: "🚌" }),
  Q("child", "운동장에서 해가 질 때까지 놀았다.", { emoji: "⚽" }),
  Q("child", "짝꿍이 바뀌어 한 학기가 달라졌다.", { emoji: "🪑" }),
  Q("child", "받아쓰기 시험에서 100점을 받았다.", { emoji: "💯" }),
  Q("child", "문방구 앞 뽑기 기계에 용돈을 다 썼다.", { emoji: "🎰" }),
  Q("child", "소풍 가서 김밥을 친구와 나눠 먹었다.", { emoji: "🍙" }),
  Q("child", "키가 부쩍 컸다. 바지가 짧아졌다.", { emoji: "📏" }),
  Q("child", "엄마 몰래 게임을 하다가 걸렸다.", { emoji: "🎮" }),
  // 중고등
  Q("teen", "야자를 하다 졸았다. 눈을 뜨니 칠판 글씨가 바뀌어 있었다.", { emoji: "😴" }),
  Q("teen", "시험 기간엔 편의점 삼각김밥이 주식이었다.", { emoji: "🍙" }),
  Q("teen", "친구들과 노래방에서 목이 쉴 때까지 놀았다.", { emoji: "🎤" }),
  Q("teen", "이어폰을 끼고 등하굣길을 걸었다. 그 시절 노래가 평생 남을 것이다.", { emoji: "🎧" }),
  Q("teen", "수행평가에 치이며 한 학기를 보냈다.", { emoji: "📝" }),
  Q("teen", "반에서 한 명쯤은 좋아했던 것 같다.", { emoji: "💘" }),
  Q("teen", "부모님과 사소한 일로 크게 다퉜다. 그러곤 아무 일 없던 듯 밥을 먹었다.", { emoji: "🍚" }),
  Q("teen", "학교 축제 때 부스를 만들었다. 재밌었다.", { emoji: "🎪", age: [14, 18] }),
  Q("teen", "진로 상담에서 아직 모르겠다고 답했다.", { emoji: "🧭", age: [15, 18] }),
  // 청년·성인
  Q("adult", "월세 내는 날이 너무 빨리 돌아온다.", { emoji: "🏠", cond: p => p.housing !== "parents" }),
  Q("adult", "아침에 눈 떠서 출근하고 저녁에 눈 감았다. 그렇게 한 해가 갔다.", { emoji: "🚇", cond: p => !!p.job }),
  Q("adult", "회식 자리가 길어져 막차를 놓쳤다.", { emoji: "🍻", cond: p => !!p.job }),
  Q("adult", "퇴근길 편의점 맥주가 하루의 전부였다.", { emoji: "🍺", cond: p => !!p.job }),
  Q("adult", "연말정산에서 돌려받은 돈으로 소소한 사치를 했다.", { emoji: "🧾", cond: p => !!p.job }),
  Q("adult", "친구들 결혼 소식이 줄줄이 들려왔다. 축의금 통장이 얇아졌다.", { emoji: "💌", age: [27, 34], married: false }),
  Q("adult", "스터디카페에서 한 해를 보냈다. 커피값이 학원비만큼 들었다.", { emoji: "☕", age: [19, 28], cond: p => !p.job }),
  Q("adult", "자취방 보일러가 고장 나 겨울을 담요로 버텼다.", { emoji: "🥶", cond: p => p.housing !== "parents" }),
  Q("adult", "넷플릭스를 정주행하다 주말이 사라졌다.", { emoji: "📺" }),
  Q("adult", "배달앱 VIP가 되었다.", { emoji: "🛵" }),
  Q("adult", "{spouse}와 소소한 데이트로 한 해를 채웠다.", { emoji: "💑", married: true, age: [22, 40] }),
  Q("adult", "{kid}가 첫 돌을 맞았다. 사진첩이 가득 찼다.", { emoji: "🍼", hasKid: true, age: [24, 38] }),
  // 중년
  Q("midlife", "월급은 통장을 스치고 카드값으로 갔다.", { emoji: "💳", cond: p => !!p.job }),
  Q("midlife", "건강검진 결과표를 한참 들여다봤다.", { emoji: "📋" }),
  Q("midlife", "퇴근 후 막내 숙제를 봐주다 같이 졸았다.", { emoji: "📚", hasKid: true }),
  Q("midlife", "{kid}의 학부모 상담에 다녀왔다. 생각보다 어른스러워졌다.", { emoji: "🏫", hasKid: true, age: [38, 55] }),
  Q("midlife", "주말마다 등산을 다녔다. 무릎이 먼저 알아챘다.", { emoji: "⛰️" }),
  Q("midlife", "친구들 모임에서 건강 이야기가 늘었다.", { emoji: "💊" }),
  Q("midlife", "동창 단톡방에 부고가 올라왔다.", { emoji: "🕯️", age: [45, 59] }),
  Q("midlife", "{spouse}와 말없이 TV를 보는 저녁이 길어졌다.", { emoji: "📺", married: true }),
  Q("midlife", "새 팀장이 왔다. 나보다 어리다.", { emoji: "🧑‍💼", cond: p => !!p.job, age: [42, 58] }),
  Q("midlife", "집값, 대출, 학원비. 숫자에 짓눌려 한 해를 보냈다.", { emoji: "🏦", hasKid: true }),
  Q("midlife", "대출 이자와 관리비. 숫자에 짓눌려 한 해를 보냈다.", { emoji: "🏦", cond: p => p.housing !== "parents" && (p.housing === "rent" || (p.stats?.money ?? 0) < 30000) }),
  Q("midlife", "새벽에 눈이 일찍 떠진다. 아침이 길다.", { emoji: "🌅", age: [50, 59] }),
  // 노년
  Q("senior", "공원 벤치에서 오전을 보냈다.", { emoji: "🌳" }),
  Q("senior", "경로당에서 장기를 두며 소식을 나눴다.", { emoji: "♟️" }),
  Q("senior", "손주 사진을 지갑에서 꺼내 자랑했다.", { emoji: "👶", hasKid: true, age: [62, 79] }),
  Q("senior", "병원 가는 날이 달력에 늘어났다.", { emoji: "🏥" }),
  Q("senior", "스마트폰 사용법을 손주에게 배웠다. 세 번째로.", { emoji: "📱", hasKid: true }),
  Q("senior", "스마트폰 사용법을 주민센터에서 배웠다. 메시지 보내기 성공!", { emoji: "📱" }),
  Q("senior", "TV를 켜놓고 졸았다. 그것도 나쁘지 않다.", { emoji: "😴" }),
  Q("senior", "{spouse}와 느린 산책으로 아침을 시작했다.", { emoji: "🚶", married: true }),
  Q("senior", "혼자 먹는 밥상이 익숙해졌다.", { emoji: "🍚", married: false }),
  Q("senior", "연금 입금일을 기다리는 일이 하루의 낙이 되었다.", { emoji: "💰" }),
  Q("senior", "오래된 앨범을 펼쳐 보다 하루가 갔다.", { emoji: "📸" }),
  // 황혼
  Q("elder", "창밖 계절이 바뀌는 걸 천천히 바라봤다.", { emoji: "🍂" }),
  Q("elder", "이름이 헷갈리는 날이 늘었다. 얼굴은 다 기억나는데.", { emoji: "🧠" }),
  Q("elder", "가족들이 번갈아 찾아와 밥을 차려줬다.", { emoji: "🍲", hasKid: true }),
  Q("elder", "동네 친구들이 한 명씩 보이지 않는다.", { emoji: "🕯️" }),
  Q("elder", "햇볕 드는 자리에서 낮잠을 잤다. 꿈에 젊은 날이 나왔다.", { emoji: "☀️" }),
  Q("elder", "손주가 대학에 합격했다는 소식에 눈물이 났다.", { emoji: "🎓", hasKid: true }),
  Q("elder", "라디오 속 옛 노래를 따라 흥얼거렸다.", { emoji: "📻" }),
  Q("elder", "하루가 길고 한 해는 짧다.", { emoji: "⏳" }),
];

// ===== 출생 운: 태어나 보니 =====
export const BIRTH = {
  family: [
    { id: "gold", label: "금수저", emoji: "🥄", weight: 6, flag: "rich_family", text: "강남 아파트에서 태어났다. 돌잔치는 호텔이었다.", effects: { money: +3000, happy: +4, intel: +3, luck: +3 } },
    { id: "silver", label: "은수저", emoji: "🍴", weight: 18, flag: "comfy_family", text: "대기업 다니는 아빠, 교사인 엄마. 넉넉하진 않아도 부족함은 없다.", effects: { money: +800, intel: +2 } },
    { id: "normal", label: "평범한 집", emoji: "🏠", weight: 46, text: "맞벌이 부모님, 작은 아파트. 대한민국 평균 그 자체.", effects: {} },
    { id: "dirt", label: "흙수저", emoji: "🥄", weight: 22, flag: "poor_family", text: "단칸방에서 태어났다. 부모님은 늘 바쁘셨다.", effects: { happy: -3, power: +3, social: +2 } },
    { id: "struggle", label: "어려운 집", emoji: "🌧️", weight: 8, flag: "hard_family", text: "아빠는 일찍 떠났고 엄마는 밤낮으로 일하셨다.", effects: { happy: -6, power: +5, luck: -3, social: +3 } },
  ],
  body: [
    { id: "iron", label: "강철 체질", emoji: "🦾", weight: 12, flag: "strong_gene", text: "잔병치레 없이 자랄 몸을 타고났다.", effects: { health: +12, power: +4 } },
    { id: "normal", label: "보통 체질", emoji: "🙂", weight: 60, text: "평범하게 건강한 아기.", effects: {} },
    { id: "weak", label: "약한 체질", emoji: "🌱", weight: 22, flag: "weak_gene", text: "태어날 때부터 몸이 약했다. 병원이 익숙하다.", effects: { health: -12, power: -3 } },
    { id: "long", label: "장수 집안", emoji: "🐢", weight: 6, flag: "longevity_gene", text: "증조할머니가 103세까지 사셨다고 한다.", effects: { health: +8, luck: +2 } },
  ],
  talent: [
    { id: "brain", label: "머리가 좋다", emoji: "🧠", weight: 14, text: "책을 한 번 보면 기억했다.", effects: { intel: +12 } },
    { id: "body", label: "운동 신경", emoji: "⚡", weight: 14, text: "누구보다 빨리 뛰고 높이 뛰었다.", effects: { power: +10, health: +3 } },
    { id: "charm", label: "사람을 끄는 매력", emoji: "✨", weight: 14, text: "어딜 가나 사람들이 먼저 말을 걸었다.", effects: { social: +12 } },
    { id: "lucky", label: "타고난 행운", emoji: "🍀", weight: 8, text: "네잎클로버가 이상하게 잘 보였다.", effects: { luck: +15 } },
    { id: "art", label: "예술 감각", emoji: "🎨", weight: 10, text: "크레파스를 쥐면 시간 가는 줄 몰랐다.", effects: { happy: +6, intel: +4 } },
    { id: "digital", label: "디지털 감각", emoji: "💾", weight: 10, text: "말보다 스와이프를 먼저 배웠다.", effects: { internet: +12 } },
    { id: "none", label: "특별한 건 없다", emoji: "🌿", weight: 30, text: "특별한 재능은 없다. 대신 무엇이든 될 수 있다.", effects: { happy: +2 } },
  ],
};

// ===== 운명: 선택 없이 닥치는 일 (good:true 좋은 일 / false 나쁜 일 → 운 스탯이 비율 조정) =====
const F = (o) => o;
export const FATES = [
  // 어린 시절
  F({ id: "kid_found_money", age: [6, 14], good: true, emoji: "💵", title: "길에서 주운 돈", text: "길에서 만 원짜리를 주웠다. 경찰서에 갖다줬더니 칭찬 스티커와 함께 돌려받았다.", effects: { luck: +3, happy: +3 } }),
  F({ id: "kid_injury", age: [4, 15], good: false, emoji: "🩹", title: "깁스", text: "놀이터 정글짐에서 떨어져 팔에 깁스를 했다. 친구들이 깁스에 낙서를 해 줬다.", effects: { health: -4, power: -2, social: +2 } }),
  F({ id: "kid_teacher", age: [7, 17], good: true, emoji: "👩‍🏫", title: "좋은 선생님", text: "인생을 바꿔 줄 선생님을 만났다. '넌 할 수 있어'라는 말을 오래 기억했다.", effects: { intel: +5, happy: +4 } }),
  F({ id: "kid_parent_divorce", age: [5, 16], good: false, once: true, emoji: "💔", title: "부모님의 이혼", text: "부모님이 따로 살게 됐다. 주말마다 아빠를 만나러 간다.", effects: { happy: -8, social: -2, intel: +2 } }),
  F({ id: "kid_family_bankrupt", age: [6, 18], good: false, once: true, noFlag: "rich_family", emoji: "📉", title: "집안의 부도", text: "아빠 사업이 망했다. 작은 집으로 이사했고 학원을 끊었다.", effects: { happy: -8, money: -500, intel: -2, power: +3 } }),
  F({ id: "kid_scout", age: [10, 17], good: true, once: true, emoji: "📸", title: "길거리 캐스팅", text: "명동에서 기획사 명함을 받았다. 엄마가 '공부나 해'라며 명함을 버렸다.", effects: { social: +5, happy: +4, luck: +2 } }),
  F({ id: "rich_tuition", age: [15, 19], good: true, flag: "rich_family", emoji: "💳", title: "부모님 카드", text: "부모님이 1:1 과외를 붙여 주셨다. 성적이 쭉 올랐다.", effects: { intel: +6 } }),
  F({ id: "poor_parttime", age: [15, 19], flag: "poor_family", emoji: "🧾", title: "생활비 보태기", text: "집안 형편 때문에 방학마다 알바를 했다. 일찍 철이 들었다.", effects: { intel: -2, power: +3, social: +3, money: +100 } }),

  // 청년
  F({ id: "lotto_small", age: [20, 90], good: true, emoji: "🎟️", title: "로또 3등", text: "로또 3등에 당첨됐다! 150만 원. 그날 치킨은 두 마리였다.", effects: { money: +150, happy: +5, luck: +3 } }),
  F({ id: "lotto_big", age: [20, 90], good: true, weight: 0.025, once: true, emoji: "🎰", title: "로또 1등!!!", text: "로또 1등에 당첨됐다. 세금 떼고 18억. 손이 떨려 은행 창구에서 서류를 세 번 다시 썼다.", effects: { money: +180000, happy: +20, luck: +10 } }),
  F({ id: "rich_house_help", age: [27, 40], good: true, flag: "rich_family", once: true, emoji: "🏠", title: "부모님 찬스", text: "부모님이 집 사는 데 3억을 보태 주셨다. 출발선이 달랐다.", effects: { money: +30000, happy: +6 } }),
  F({ id: "poor_parent_support", age: [30, 55], flag: "poor_family", cond: p => parentLives(p), emoji: "👪", title: "부모님 생활비", text: "부모님 생활비를 매달 보내 드린다. 내 노후는 그 다음이다.", effects: { money: -2400, happy: -2 } }),
  F({ id: "recession", age: [22, 59], good: false, emoji: "📉", title: "경기 불황", text: "경제 위기가 터졌다. 회사가 연봉을 동결했고 주식이 반토막 났다.", effects: { money: p => -Math.max(0, p.stats.money) * 0.2, happy: -5 }, life: { raise: 0.92 } }),
  F({ id: "boom", age: [22, 70], good: true, emoji: "🚀", title: "호황", text: "경기가 좋아졌다. 성과급이 터지고 갖고 있던 주식이 올랐다.", effects: { money: p => Math.max(500, p.stats.money * 0.15), happy: +4 }, life: { raise: 1.06 } }),
  F({ id: "jeonse_fraud", age: [23, 45], good: false, once: true, cond: p => p.housing === "jeonse" || p.housing === "rent", emoji: "🚨", title: "전세 사기", text: "집주인이 잠적했다. 보증금이 사라졌다. 뉴스 속 이야기가 내 이야기가 됐다.", effects: { money: -8000, happy: -12, health: -4 } }),
  F({ id: "layoff_sudden", age: [30, 58], good: false, cond: p => !!p.job && ["worker", "corporate"].includes(p.career), emoji: "📭", title: "갑작스러운 해고", text: "회사가 문을 닫았다. 어제까지 내 자리였던 책상이 비었다.", effects: { happy: -8, money: -500 }, life: { quit: true } }),
  F({ id: "headhunted", age: [28, 55], good: true, cond: p => !!p.job && ["worker", "corporate", "developer"].includes(p.career), emoji: "📞", title: "스카우트 제의", text: "경쟁사에서 스카우트 제의가 왔다. 연봉 30% 인상!", effects: { happy: +6 }, life: { raise: 1.3 } }),
  F({ id: "car_accident", age: [18, 80], good: false, emoji: "🚗", title: "교통사고", text: "신호 위반 차량에 받혔다. 몇 달 동안 재활했다.", effects: { health: -14, money: -500, happy: -5 } }),
  F({ id: "fatal_accident", age: [18, 85], good: false, weight: 0.05, emoji: "🚑", title: "사고", text: "평범한 하루였다. 그날 오후, 돌아오지 못했다.", effects: {}, death: "accident" }),
  F({ id: "meet_by_chance", age: [22, 45], good: true, cond: p => !p.spouse && !p.relations.romance && !p.flags.has("no_marriage"), emoji: "🌧️", title: "우연한 만남", text: "비 오는 날 우산을 같이 쓴 사람과 연락을 주고받게 됐다.", effects: { happy: +6 }, life: { romance: true } }),
  F({ id: "surprise_baby", age: [25, 42], good: true, cond: p => !!p.spouse && p.kids.length < 3 && !p.flags.has("childfree"), emoji: "🎁", title: "예상치 못한 선물", text: "계획에 없던 아이가 찾아왔다. 놀랐지만 기뻤다.", effects: { happy: +8, money: -300 }, life: { child: true } }),
  F({ id: "viral", age: [16, 60], good: true, emoji: "📱", title: "얼떨결에 떡상", text: "올린 영상이 알고리즘을 탔다. 하룻밤에 조회수 300만.", effects: { internet: +8, social: +4, money: +200, happy: +5 } }),
  F({ id: "stolen_phone", age: [15, 80], good: false, emoji: "📵", title: "소매치기", text: "지하철에서 지갑과 휴대폰을 잃어버렸다. 사진이 백업이 안 돼 있었다.", effects: { money: -150, happy: -4 } }),
  F({ id: "covid", age: [5, 95], good: false, once: true, emoji: "😷", title: "전염병 유행", text: "전 세계에 전염병이 돌았다. 2년 동안 마스크를 썼고 사람을 못 만났다.", effects: { social: -5, internet: +6, health: -3, happy: -4 } }),
  F({ id: "stock_jackpot", age: [25, 75], good: true, weight: 0.4, cond: p => p.stats.money > 2000, emoji: "📈", title: "잊고 있던 주식", text: "10년 전 사 두고 잊은 주식이 열 배가 되어 있었다.", effects: { money: p => Math.max(3000, p.stats.money * 0.4), happy: +8 } }),
  F({ id: "unknown_inherit", age: [30, 85], good: true, weight: 0.25, once: true, emoji: "📜", title: "먼 친척의 유산", text: "얼굴도 모르는 먼 친척이 유산을 남겼다. 시골 땅이 개발 예정지였다.", effects: { money: +12000, happy: +6, luck: +4 } }),
  F({ id: "fire", age: [20, 90], good: false, weight: 0.4, emoji: "🔥", title: "화재", text: "아랫집에서 불이 번졌다. 사람은 다치지 않았지만 많은 걸 잃었다.", effects: { money: -3000, happy: -8 } }),
  F({ id: "good_friend", age: [15, 85], good: true, emoji: "🤝", title: "평생 친구", text: "우연히 같은 취미를 가진 사람과 친해졌다. 오래갈 인연이다.", effects: { social: +5, happy: +5 } }),
  F({ id: "betrayal", age: [20, 70], good: false, emoji: "🗡️", title: "배신", text: "믿었던 사람에게 돈을 빌려줬다. 그 사람은 사라졌다.", effects: { money: -1500, social: -4, happy: -6 } }),
  F({ id: "house_up", age: [30, 85], good: true, cond: p => p.housing === "own", emoji: "🏘️", title: "집값 상승", text: "동네에 지하철역이 생긴다는 발표가 났다. 집값이 뛰었다.", effects: { money: +10000, happy: +5 } }),
  F({ id: "house_down", age: [30, 85], good: false, cond: p => p.housing === "own", emoji: "🏚️", title: "집값 폭락", text: "부동산 시장이 얼어붙었다. 산 값보다 1억 낮게 거래된다.", effects: { money: -8000, happy: -5 } }),

  // 중년 이후 건강·가족
  F({ id: "hidden_illness", age: [40, 95], good: false, emoji: "🩺", title: "숨어 있던 병", text: "몸이 이상해 병원에 갔더니 오래 키운 병이 있었다.", effects: { health: p => p.flags.has("weak_gene") ? -16 : -10, happy: -4, money: -500 } }),
  F({ id: "good_gene_shine", age: [55, 100], good: true, flag: "longevity_gene", emoji: "🐢", title: "장수 유전자", text: "또래 친구들이 아플 때 혼자 멀쩡하다. 집안 내력인가 보다.", effects: { health: +8 } }),
  F({ id: "strong_body", age: [40, 90], good: true, flag: "strong_gene", emoji: "🦾", title: "타고난 몸", text: "건강검진 결과가 또래보다 10년 젊다고 나왔다.", effects: { health: +6 } }),
  F({ id: "spouse_sudden", age: [50, 95], good: false, weight: 0.5, cond: p => !!p.spouse, emoji: "🕯️", title: "갑작스러운 이별", text: "{spouse}가 갑자기 쓰러졌다. 작별 인사도 하지 못했다.", effects: { happy: -20, health: -6 }, life: { widow: true } }),
  F({ id: "kid_success", age: [45, 90], good: true, cond: p => p.kids.length > 0 && p.age - p.kids[0].born >= 25, emoji: "🎉", title: "자식 자랑", text: "{kid}가 회사에서 크게 인정받았다는 소식. 동창 모임에서 자랑했다.", effects: { happy: +8, social: +2 } }),
  F({ id: "kid_trouble", age: [45, 90], good: false, cond: p => p.kids.length > 0 && p.age - p.kids[0].born >= 20, emoji: "😓", title: "자식 걱정", text: "{kid}가 사업에 실패해 빚을 졌다. 모아 둔 돈을 보태 줬다.", effects: { money: -5000, happy: -6 } }),
  F({ id: "grandkid_visit", age: [60, 105], good: true, flag: "grandparent", emoji: "🧒", title: "손주 방문", text: "손주가 방학이라 놀러 왔다. 집이 시끌벅적하다.", effects: { happy: +6, health: +1 } }),
  F({ id: "lonely_winter", age: [70, 105], good: false, cond: p => !p.spouse && p.kids.length === 0, emoji: "❄️", title: "외로운 겨울", text: "아무도 찾아오지 않는 겨울. 텔레비전 소리만 집을 채웠다.", effects: { happy: -6, health: -3 } }),
  F({ id: "old_friend_call", age: [60, 100], good: true, emoji: "☎️", title: "반가운 전화", text: "50년 전 친구에게서 전화가 왔다. 목소리는 그대로였다.", effects: { happy: +6, social: +3 } }),
  F({ id: "elder_cold", age: [75, 110], good: false, emoji: "🤧", title: "독한 감기", text: "환절기 감기가 한 달을 갔다. 기력이 많이 떨어졌다.", effects: { health: -8 } }),
  // 돈 손해·갑작스러운 불행 (2026-10-26 — 너무 돈이 잘 불어서 / 갑작스러운 죽음도)
  F({ id: "voice_phishing", age: [35, 88], good: false, emoji: "☎️", title: "보이스피싱", text: "'검찰청입니다'라는 전화에 속아 통장 돈을 '안전 계좌'로 옮겼다. 전화가 끊기고 나서야 알았다.", effects: { money: p => -Math.min(20000, Math.max(300, p.stats.money * 0.12)), happy: -8 } }),
  F({ id: "invest_scam", age: [28, 75], good: false, weight: 0.6, cond: p => p.stats.money > 3000, emoji: "🕳️", title: "투자 사기", text: "'원금 보장, 월 10%'. 지인이 소개한 투자처가 하루아침에 사라졌다.", effects: { money: p => -Math.max(0, p.stats.money) * 0.3, happy: -8, social: -3 } }),
  F({ id: "crypto_crash", age: [22, 60], good: false, weight: 0.6, cond: p => p.stats.money > 1000, emoji: "🪙", title: "코인 폭락", text: "자고 일어나니 들고 있던 코인이 상장폐지됐다. 차트가 절벽이었다.", effects: { money: p => -Math.max(0, p.stats.money) * 0.2, happy: -6 } }),
  F({ id: "big_surgery", age: [40, 90], good: false, emoji: "🏥", title: "큰 수술", text: "건강검진에서 혹이 발견됐다. 수술은 잘 끝났지만 병원비가 만만치 않았다.", effects: { health: -8, money: -2500, happy: -4 } }),
  F({ id: "guarantor", age: [30, 65], good: false, once: true, emoji: "✍️", title: "빚보증", text: "친척 부탁으로 서 준 보증이 터졌다. 갚을 사람은 나뿐이었다.", effects: { money: -6000, happy: -10, social: -2 } }),
  F({ id: "parent_care", age: [40, 65], good: false, once: true, cond: p => !p.flags.has("orphaned") && parentLives(p), emoji: "🧓", title: "부모님 간병", text: "부모님이 쓰러지셨다. 요양병원비와 간병비가 매달 빠져나갔다.", effects: { money: -3000, happy: -6, health: -3 } }),
  F({ id: "lawsuit", age: [28, 75], good: false, weight: 0.6, emoji: "⚖️", title: "소송", text: "억울한 일로 소송에 휘말렸다. 이기긴 했지만 변호사비가 남았다.", effects: { money: -1500, happy: -6, health: -2 } }),
  F({ id: "kid_bailout", age: [55, 85], good: false, cond: p => p.kids.length > 0 && p.age - p.kids[0].born >= 25, emoji: "👨‍👦", title: "자식 사업 자금", text: "{kid}의 사업이 어려워졌다. 노후 자금을 털어 막아 줬다.", effects: { money: p => -Math.max(3000, p.stats.money * 0.2), happy: -4 } }),
  F({ id: "rare_disease", age: [20, 80], good: false, weight: 0.5, emoji: "🧬", title: "갑작스러운 병", text: "멀쩡하던 몸에 이름도 어려운 병이 찾아왔다. 긴 치료가 시작됐다.", effects: { health: -20, money: -2000, happy: -8 } }),
  F({ id: "fatal_drunk_driver", age: [10, 85], good: false, weight: 0.03, emoji: "🚑", title: "음주운전 차량", text: "횡단보도를 건너던 중, 음주운전 차량이 덮쳤다. 그날 집에 돌아가지 못했다.", effects: {}, death: "accident" }),
  F({ id: "fatal_cancer", age: [30, 85], good: false, weight: 0.04, emoji: "🏥", title: "말기 판정", text: "괜찮겠지 하고 넘긴 통증이었다. 진단은 이미 말기였고, 그해를 넘기지 못했다.", effects: {}, death: "disease" }),
  F({ id: "fatal_heart", age: [35, 85], good: false, weight: 0.03, emoji: "💔", title: "출근길에 쓰러지다", text: "출근길 지하철에서 가슴을 움켜쥐고 쓰러졌다. 다시 눈을 뜨지 못했다.", effects: {}, death: "sudden" }),
  F({ id: "fatal_crime", age: [18, 80], good: false, weight: 0.006, emoji: "🕯️", title: "불의의 사건", text: "늦은 밤 귀갓길, 낯선 사람의 범죄에 휘말렸다. 돌아오지 못했다.", effects: {}, death: "crime" }),
];

export function buildLife(LEG) {
  const stats = [...LEG.STAT_DEFS];
  const pi = stats.findIndex(s => s.key === "power");
  stats.splice(pi + 1, 0, HEALTH_DEF);

  // 구 이벤트 중 가족을 전제로 한 것들은 실제 가족이 있을 때만 나오게
  const LEGACY_PATCH = {
    midlife_kids: { hasKid: true }, midlife_kids_teen: { hasKid: true }, midlife_kid_exam: { hasKid: true },
    midlife_child_career: { hasKid: true }, adult_marriage: { married: false },
  };
  // 구 데이터에 같은 id가 두 번 쓰인 이벤트(teen_first_love·teen_part_time)는 뒤의 것을 _2로 — 번역·'이미 본 사건' 판정이 섞이지 않게
  const seenIds = new Set();
  const legacy = LEG.EVENTS.map(e => {
    let x = LEGACY_PATCH[e.id] ? { ...e, ...LEGACY_PATCH[e.id] } : e;
    if (seenIds.has(x.id)) x = { ...x, id: x.id + "_2" };
    seenIds.add(x.id);
    return x;
  });
  // 직업 루트 표시(2026-10-26): 일반 사건 중 '입사·데뷔' 성격은 careerEntry, 회사 생활 전제는 office —
  //   정치인·작가처럼 특별한 직업이 있으면 '대기업 입사?' 같은 질문이 끼어들지 않고, 무직이면 회사 생활 사건이 안 나온다
  const CAREER_TAGS = {
    adult_first_job: { careerEntry: "job" }, v2_first_job: { careerEntry: "job" }, v2_jobless_25: { careerEntry: "job" },
    v2_job_interview: { careerEntry: "job" }, v2_cert_exam: { careerEntry: "job" }, adult_grad_school: { careerEntry: "job" },
    v2_working_holiday: { careerEntry: "job" },
    adult_political: { careerEntry: "politics" }, adult_chzzk_offer: { careerEntry: "streamer" }, adult_viral_post: { careerEntry: "streamer" },
    midlife_career_pivot: { careerEntry: "streamer" }, adult_startup_offer: { careerEntry: "business" }, adult_ai_business: { careerEntry: "business" },
    v2_sp_app_hit: { careerEntry: "business" },
    adult_dinner_party: { office: true }, adult_burnout: { office: true }, v2_burnout: { office: true }, v2_job_change: { office: true },
    v2_promotion: { office: true }, v2_layoff: { office: true }, adult_remote_work: { office: true }, adult_meme_viral: { office: true },
    midlife_hiking: { office: true }, v2_marathon: { office: true }, v2_invest_20s: { office: true }, v2_checkup_young: { office: true },
    v2_retire_plan: { cond: p => !p.career },               // '은퇴 후 첫 아침'은 정말 일을 놓았을 때만
    // 군대는 한 번만, 20대 초중반에 — 30대 정치인·변호사가 갑자기 입대하던 문제
    adult_military: { age: [20, 28], cond: p => !p.seenEventIds.has("v2_military") },
    v2_military: { cond: p => !p.seenEventIds.has("adult_military") },
    // v3: 부모님이 나오는 사건은 그분이 살아 계실 때만 — 돌아가신 부모님이 다시 등장하는 모순 방지
    midlife_parents: { parentAlive: true }, adult_marriage: { parentAlive: true }, v2_jobless_25: { parentAlive: true },
    v2_parent_ill: { parentAlive: "father" }, v2_parent_death: { parentAlive: "mother", killWho: "mother" }, v2_university: { parentAlive: "mother" },
  };
  const CHOICE_TAGS = { "adult_first_job.samsung": { career: "corporate" } };   // 옛 데이터의 '대기업' 선택지는 직장인이 아니라 대기업 루트
  const tag = e => {
    const t = CAREER_TAGS[e.id];
    let x = t ? { ...e, ...t, cond: t.cond && e.cond ? (p => t.cond(p) && e.cond(p)) : (t.cond || e.cond) } : e;
    if (x.choices?.some(c => CHOICE_TAGS[x.id + "." + c.id])) x = { ...x, choices: x.choices.map(c => CHOICE_TAGS[x.id + "." + c.id] ? { ...c, ...CHOICE_TAGS[x.id + "." + c.id] } : c) };
    return x;
  };
  const EVENTS = [...legacy, ...EVENTS_YOUNG, ...EVENTS_FAMILY, ...EVENTS_LATER, ...EVENTS_PETS].map(tag).concat(EVENTS_CAREERS, EVENTS_V3);
  // 엔딩은 위에서부터 첫 매칭 → 인생 전체를 규정하는 v2 엔딩(요절·백세 등)이 맨 앞, 가족·직업 엔딩은 well_balanced 앞
  const wb = LEG.ENDINGS.findIndex(e => e.id === "well_balanced");
  const cut = wb >= 0 ? wb : LEG.ENDINGS.length - 1;
  const ENDINGS = [...ENDINGS_CAREERS, ...ENDINGS_V3, ...ENDINGS_V2.first, ...LEG.ENDINGS.slice(0, cut), ...ENDINGS_V2.mid, ...LEG.ENDINGS.slice(cut)];
  const ANALYSIS_LINES = [...ANALYSIS_V3, ...ANALYSIS_V2, ...LEG.ANALYSIS_LINES];
  return { STAGES: STAGES_V2, STAT_DEFS: stats, EVENTS, ENDINGS, ANALYSIS_LINES, QUIET, MILESTONES, DEATH_CAUSES, JOBS, MINI_AGES, BIRTH, FATES, CAREERS, TITLE_CAREER: { ...TITLE_CAREER, ...SYS_TITLES } };
}
