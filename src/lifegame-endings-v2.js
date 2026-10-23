// =========================
// 인생게임 v2 엔딩·분석 — 1살~사망 인생 전체를 보고 결말을 정한다
// match(s, r, ctx): s=스탯(s.money는 구 단위=순자산/150), ctx.rawMoney=순자산(만원), ctx.age=사망 나이,
//   ctx.cause/spouse/kids/kidsCount/married/marriedYears/careerTitle/careerYears/housing/birth/flags
// first = 구 엔딩보다 먼저(인생을 통째로 규정), mid = 구 well_balanced 바로 앞
// =========================
const N = (id, emoji, title, badge, rarity, quote, match, prio) => ({ id, emoji, title, badge, rarity, quote, match, prio });
const has = (ctx, f) => !!ctx?.flags?.has(f);

// prio: 대표 결말 우선순위(높을수록 먼저). 지정 안 하면 코어가 rarity로 정한다(hidden 5·rare 4·common 2)
export const ENDINGS_V2 = {
  first: [
    N("v2_little_star", "🌟", "작은 별", "LITTLE STAR", "rare", "너무 일찍 떠났지만, 짧은 생은 모두의 기억 속에서 오래 빛났다.", (s, r, c) => c.age < 13),
    N("v2_youth_flame", "🕯️", "청춘의 불꽃", "YOUNG FLAME", "rare", "다 피지 못한 꽃. 그래도 가장 뜨거웠던 계절을 살았다.", (s, r, c) => c.age < 30),
    N("v2_centenarian", "💯", "백세 인생", "CENTURY", "hidden", "한 세기를 살았다. 세상이 몇 번 바뀌는 동안 그는 자리를 지켰다.", (s, r, c) => c.age >= 100),
    N("v2_lotto_life", "🎰", "인생 역전 로또", "JACKPOT", "hidden", "번호 여섯 개가 인생을 바꿨다. 남은 건 그 돈으로 무엇을 했느냐였다.", (s, r, c) => has(c, "fate_lotto_big")),
    N("v2_chaebol", "🏰", "재벌의 탄생", "TYCOON", "rare", "통장에 찍힌 동그라미 개수를 세다 잠든 인생. 후손들은 그 이름을 건물에서 본다.", (s, r, c) => c.rawMoney >= 500000),
    N("v2_dirt_to_dragon", "🐉", "개천에서 용 났다", "SELF-MADE", "rare", "단칸방에서 시작해 빌딩 꼭대기까지. 출발선은 핑계가 아니었다.", (s, r, c) => (has(c, "poor_family") || has(c, "hard_family")) && c.rawMoney >= 200000),
    N("v2_spoon_wasted", "🥄", "금수저 탕진기", "SPOON LOST", "rare", "물려받은 건 많았다. 남긴 건 빚과 무용담뿐.", (s, r, c) => has(c, "rich_family") && c.rawMoney < 0),
    N("v2_debt_mountain", "🧾", "빚더미 인생", "IN DEBT", "common", "숫자 앞에 마이너스가 붙은 채로 끝났다. 그래도 웃은 날은 있었다.", (s, r, c) => c.rawMoney <= -30000),
    N("v2_overwork", "🌙", "일에 바친 인생", "WORKAHOLIC", "rare", "사무실 불은 늘 그가 껐다. 마지막 퇴근은 너무 이르게 찾아왔다.", (s, r, c) => c.cause === "overwork"),
    N("v2_adventurer", "🧗", "모험가의 최후", "NO LIMITS", "hidden", "하고 싶은 건 다 하다 갔다. 묘비에는 '후회 없음'.", (s, r, c) => c.cause === "adventure"),
  ],
  mid: [
    N("v2_golden_couple", "💛", "금혼식 부부", "50 YEARS", "rare", "50년을 한 사람과. 손을 잡으면 아직도 따뜻했다.", (s, r, c) => c.married && c.marriedYears >= 50),
    N("v2_big_family", "👨‍👩‍👧‍👦", "대가족의 기둥", "BIG FAMILY", "rare", "명절이면 집이 미어터졌다. 그 소란이 인생 최고의 음악이었다.", (s, r, c) => c.kidsCount >= 3),
    N("v2_grandparent", "🧸", "손주 바보", "GRANDPA/MA", "common", "지갑 속 손주 사진이 닳도록 꺼내 봤다. 남은 생의 이유였다.", (s, r, c) => has(c, "grandparent") && s.happy >= 55),
    N("v2_second_spring", "🌷", "두 번째 봄", "SECOND SPRING", "rare", "한 번 무너졌던 마음에 다시 꽃이 폈다. 사랑은 나이를 묻지 않았다.", (s, r, c) => has(c, "remarried")),
    N("v2_missing_you", "🕊️", "그리움을 안고", "IN MEMORY", "rare", "먼저 간 사람의 자리를 매일 아침 닦았다. 사랑은 끝나지 않았다.", (s, r, c) => has(c, "widowed") && !c.married && s.happy >= 40),
    N("v2_divorce_free", "🦋", "이혼 후 진짜 나", "REBORN", "common", "도장을 찍은 날부터 진짜 인생이 시작됐다.", (s, r, c) => has(c, "divorced") && !c.married && s.happy >= 60),
    N("v2_dink", "🐕", "둘이면 충분했던", "JUST US", "common", "아이 대신 서로를, 그리고 강아지 두부를. 여행 사진이 앨범 열 권.", (s, r, c) => has(c, "childfree") && c.married),
    N("v2_solo_master", "🗽", "혼자서도 완벽", "SOLO MASTER", "common", "결혼은 선택이었다. 그는 자기 자신과 평생 연애했다.", (s, r, c) => has(c, "no_marriage") && s.happy >= 55),
    N("v2_lonely_end", "🌫️", "쓸쓸한 마지막", "ALONE", "common", "마지막 몇 해, 찾아오는 이가 없었다. 창밖 비둘기만 그를 기억한다.", (s, r, c) => !c.married && c.kidsCount === 0 && s.social < 40 && c.age >= 70),
    N("v2_survivor", "🎗️", "병을 이긴 사람", "SURVIVOR", "common", "암을 이기고 덤으로 얻은 시간. 그는 그 시간을 하루도 허투루 쓰지 않았다.", (s, r, c) => has(c, "cancer_survivor") && c.age >= 70),
    N("v2_donor", "💝", "나눔의 인생", "GIVER", "rare", "모은 것을 나누고 떠났다. 장학금 받은 아이들이 그의 이름을 기억한다.", (s, r, c) => has(c, "donor")),
    N("v2_founder", "🚀", "창업 신화", "FOUNDER", "rare", "차고에서 시작한 회사가 빌딩이 됐다. 실패담마저 강연 소재가 됐다.", (s, r, c) => has(c, "founder") && c.rawMoney >= 50000),
    N("v2_shop_owner", "🍗", "동네 사장님", "LOCAL HERO", "common", "골목 사람들은 모두 그의 단골이었다. 간판 불이 꺼진 날 동네가 울었다.", (s, r, c) => has(c, "shop_owner")),
    N("v2_farmer", "🌾", "흙과 함께", "BACK TO SOIL", "common", "도시를 떠나 밭을 일궜다. 마지막 수확은 이웃과 나눴다.", (s, r, c) => has(c, "farmer") && s.happy >= 50),
    N("v2_late_traveler", "🧳", "늦깎이 여행가", "LATE BLOOMER", "common", "은퇴하고 나서야 세계를 봤다. 여권 도장이 인생 후반의 일기장.", (s, r, c) => has(c, "late_traveler") && s.happy >= 55),
    N("v2_civil_servant", "🏛️", "철밥통 정년퇴직", "PUBLIC SERVANT", "common", "정시 출근 정시 퇴근 30년. 연금이 그의 성실함을 증명했다.", (s, r, c) => /공무원/.test(c.careerTitle) && c.careerYears >= 25),
    N("v2_corp_lifer", "🏢", "회사에 바친 30년", "CORP LIFER", "common", "사원증 사진이 세 번 바뀌는 동안 같은 회사였다. 퇴직 선물은 금 열 돈.", (s, r, c) => /대기업|팀장|임원/.test(c.careerTitle) && c.careerYears >= 28),
    N("v2_memory_lost", "🧠", "기억을 잃어도", "FORGET-ME-NOT", "common", "이름은 잊어도 사랑했던 마음은 남아 있었다. 손을 잡으면 웃었다.", (s, r, c) => has(c, "dementia")),
    N("v2_reconciled", "🤝", "화해로 끝난 인생", "AT PEACE", "rare", "마지막에 먼저 손을 내밀었다. 응어리 없이 떠난 홀가분한 얼굴.", (s, r, c) => has(c, "reconciled")),
    N("v2_weak_but_long", "🌱", "약하게 태어나 오래", "TOUGH SPROUT", "rare", "병원이 집 같던 아이가 여든을 넘겼다. 의사들이 고개를 저었다.", (s, r, c) => has(c, "weak_gene") && c.age >= 85),
    N("v2_healthy_long", "🏃", "건강하게 오래오래", "VITAL", "common", "아흔에도 아침 산책을 빼먹지 않았다. 동네 최고령 운동왕.", (s, r, c) => c.age >= 90 && s.health >= 35),
    N("v2_homeowner", "🏠", "내 집 마련의 꿈", "HOMEOWNER", "common", "전세, 월세, 대출을 지나 마침내 내 집. 문패에 이름을 걸던 날을 잊지 못한다.", (s, r, c) => has(c, "homeowner") && c.careerYears >= 25 && s.happy >= 45),
    N("v2_ordinary_happy", "🌻", "평범해서 행복했던", "ORDINARY JOY", "common", "대단한 일은 없었다. 출근하고, 밥 먹고, 가족과 웃었다. 그게 전부였고 충분했다.", (s, r, c) => c.careerYears >= 20 && c.married && c.kidsCount >= 1 && s.happy >= 50),
    N("v2_pet_life", "🐾", "반려동물과 함께한 일생", "PAW FAMILY", "common", "여러 아이를 키우고 떠나보냈다. 그때마다 마음 한 칸이 발자국 모양으로 남았다.", (s, r, c) => (c.petsTotal >= 3 || (c.petsTotal >= 2 && c.kidsCount === 0)) && s.happy >= 55),
    N("v2_parent_life", "👪", "자식 농사", "PARENT", "common", "인생의 절반을 아이들에게 줬다. 아이들은 그걸 다 알고 있었다.", (s, r, c) => c.kidsCount >= 1 && s.happy >= 45),
  ],
};

ENDINGS_V2.first.forEach(e => { e.prio = 10; });
ENDINGS_V2.mid.forEach(e => { e.prio = e.rarity === "rare" ? 6 : 3; });
// 흔한 사건에서 나오는 결말은 내리고, 가족 서사 결말은 구 희귀 엔딩(4)보다 살짝 위로
const PRIO = { v2_pet_life: 3.0, v2_survivor: 3.5, v2_memory_lost: 3.5, v2_grandparent: 4.5, v2_second_spring: 5.5, v2_dink: 4.2, v2_divorce_free: 4.2, v2_parent_life: 2.5, v2_ordinary_happy: 3.2 };
ENDINGS_V2.mid.forEach(e => { if (PRIO[e.id] != null) e.prio = PRIO[e.id]; });

export const ANALYSIS_V2 = [
  { when: (s, r, c) => c.birth?.family?.id === "gold", text: "금수저로 태어났다. 출발선이 남들보다 몇 걸음 앞이었다." },
  { when: (s, r, c) => c.birth?.family?.id === "dirt" || c.birth?.family?.id === "struggle", text: "가진 것 없이 태어났다. 그래서 하나하나가 다 자기 것이었다." },
  { when: (s, r, c) => has(c, "fate_lotto_big"), text: "로또 1등. 인생 최대의 운을 한 번에 몰아 썼다." },
  { when: (s, r, c) => c.married && c.marriedYears >= 40, text: "{spouse}와 40년 넘게 함께했다. 서로가 서로의 인생이었다." },
  { when: (s, r, c) => c.kidsCount >= 2, text: "아이 {kid}를 비롯해 여럿을 키워 냈다. 집은 늘 시끄러웠고 따뜻했다." },
  { when: (s, r, c) => has(c, "widowed"), text: "사랑하는 사람을 먼저 보냈다. 그 빈자리를 끝까지 안고 살았다." },
  { when: (s, r, c) => has(c, "divorced"), text: "한 번의 이혼. 끝이 아니라 방향을 바꾼 것이었다." },
  { when: (s, r, c) => c.rawMoney >= 200000, text: "숫자로 보면 성공한 인생. 통장이 그걸 증명한다." },
  { when: (s, r, c) => c.rawMoney < -5000, text: "빚을 남기고 떠났다. 돈 문제는 평생의 숙제였다." },
  { when: (s, r, c) => c.careerYears >= 30, text: "한평생 일했다. 출근 도장만 만 번이 넘는다." },
  { when: (s, r, c) => c.careerYears === 0 && c.age >= 40, text: "직장 없이 살았다. 자유였을까, 방황이었을까." },
  { when: (s, r, c) => has(c, "cancer_survivor"), text: "큰 병을 이겨 냈다. 그 뒤로 매일이 덤이었다." },
  { when: (s, r, c) => has(c, "dementia"), text: "말년에 기억이 흐려졌다. 그래도 가족의 손길은 알아봤다." },
  { when: (s, r, c) => c.age >= 90, text: "아흔을 넘겼다. 같은 시대를 산 사람 대부분보다 오래 살았다." },
  { when: (s, r, c) => c.age < 50 && c.age >= 13, text: "너무 빨리 떠났다. 하지 못한 일이 많아 더 아프다." },
  { when: (s, r, c) => s.health >= 70 && c.age >= 70, text: "나이에 비해 놀랄 만큼 건강했다. 몸 관리가 최고의 재테크." },
  { when: (s, r, c) => has(c, "grandparent"), text: "손주를 품에 안아 봤다. 인생이 한 바퀴 돈 기분이었다." },
  { when: (s, r, c) => c.petsTotal >= 3, text: "평생 여러 반려동물과 함께했다. 집에는 늘 털과 웃음이 굴러다녔다." },
  { when: (s, r, c) => c.petsTotal === 1, text: "한 아이와 끝까지 함께했다. 그 발소리를 평생 기억했다." },
  { when: (s, r, c) => has(c, "military_done"), text: "군대 이야기는 평생의 안줏거리였다." },
  { when: (s, r, c) => has(c, "laid_off"), text: "한창때 회사를 떠나야 했다. 그 상처가 오래갔다." },
  { when: (s, r, c) => c.housing === "own", text: "결국 내 집에서 생을 마쳤다." },
  { when: (s, r, c) => c.housing === "rent" && c.age >= 60, text: "평생 남의 집을 전전했다. 이사 짐 싸는 데는 달인이었다." },
];
