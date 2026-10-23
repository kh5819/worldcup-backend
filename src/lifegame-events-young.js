// =========================
// 인생게임 v2 이벤트 — 유아기~청년기 (v:2 → money는 만원 단위, health 직접 지정)
// 필드: age:[min,max], married/hasKid, flagRequired/flagBanned, statMin/statMax, cond(p), life:{job,housing,quit,raise,marry,child,divorce,widow,bond}
// =========================
const E = o => ({ v: 2, type: "normal", ...o });

export const EVENTS_YOUNG = [
  // ===================== 유아기 =====================
  E({
    id: "v2_doljabi", stage: "infant", age: [1, 2], emoji: "🎂", title: "돌잡이",
    desc: "첫돌 잔칫상 위에 물건이 놓였다. 아기의 손이 향한 곳은?", weight: 3,
    choices: [
      { id: "pencil", emoji: "✏️", text: "연필", sub: "공부 잘하겠네", grade: "good", effects: { intel: +7, happy: +2 }, narratives: ["할아버지가 '판사 되겠다'며 봉투를 하나 더 꺼냈다."] },
      { id: "money", emoji: "💵", text: "돈", sub: "부자 되겠네", grade: "good", effects: { money: +50, luck: +4 }, narratives: ["잡은 오만 원짜리를 끝까지 놓지 않았다. 돌잔치 축의금이 통장에 들어갔다."] },
      { id: "mic", emoji: "🎤", text: "마이크", sub: "연예인?", grade: "mid", effects: { social: +6, internet: +3 }, narratives: ["마이크를 잡고 옹알이 공연을 했다. 영상이 가족 단톡방을 돌았다."] },
      { id: "stetho", emoji: "🩺", text: "청진기", sub: "의사 선생님", grade: "good", effects: { intel: +4, health: +4 }, narratives: ["엄마가 그날 밤 의대 입시 정보를 검색했다."] },
      { id: "nothing", emoji: "🍰", text: "케이크를 집어 먹는다", sub: "본능에 충실", grade: "mid", effects: { happy: +7, power: +2 }, narratives: ["얼굴이 크림 범벅이 됐다. 올해의 사진이 탄생했다."] },
    ],
  }),
  E({
    id: "v2_infant_fever", stage: "infant", age: [1, 5], emoji: "🤒", title: "열이 펄펄",
    desc: "새벽 두 시, 체온계가 39.5도를 찍었다. 부모님이 당황했다.",
    choices: [
      { id: "er", emoji: "🚑", text: "응급실로 달린다", grade: "good", effects: { health: +4, money: -15 }, narratives: ["대기만 세 시간. 해열제 한 번에 열이 내렸다."] },
      { id: "home", emoji: "🧊", text: "집에서 해열제·물수건으로 버틴다", grade: "mid",
        outcomes: [
          { chance: 0.75, effects: { health: +1, power: +2 }, narrative: "아침이 되자 언제 그랬냐는 듯 뛰어다녔다." },
          { chance: 0.25, effects: { health: -8, happy: -3 }, narrative: "폐렴으로 번져 일주일 입원했다. 부모님이 많이 울었다." },
        ] },
      { id: "grandma", emoji: "👵", text: "할머니 민간요법", sub: "배를 문질러 준다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +4, health: +1 }, narrative: "할머니 손은 약손이었다. 신기하게 잠이 들었다." },
          { chance: 0.5, effects: { health: -4 }, narrative: "결국 아침에 병원에 갔다. 의사가 한숨을 쉬었다." },
        ] },
    ],
  }),
  E({
    id: "v2_sibling", stage: "infant", age: [2, 6], emoji: "👶", title: "동생이 생겼다",
    desc: "엄마 품에 작은 아기가 안겨 있다. 이제 내가 형·누나·오빠·언니라고 한다.",
    flagBanned: ["has_sibling"],
    choices: [
      { id: "love", emoji: "🥰", text: "볼에 뽀뽀해 준다", grade: "good", effects: { social: +6, happy: +3 }, flag: { add: ["has_sibling"] }, narratives: ["평생 같은 편이 하나 생겼다."] },
      { id: "jealous", emoji: "😤", text: "엄마는 내 거야!", grade: "mid", effects: { happy: -4, power: +3 }, flag: { add: ["has_sibling"] }, narratives: ["동생 장난감을 몰래 숨겼다. 사춘기까지 앙숙이 됐다."] },
      { id: "ignore", emoji: "🙄", text: "관심 없다", grade: "mid", effects: { intel: +2 }, flag: { add: ["has_sibling"] }, narratives: ["블록 놀이에 더 집중했다. 혼자 노는 법을 배웠다."] },
    ],
  }),
  E({
    id: "v2_moving", stage: "infant", age: [3, 6], emoji: "🚚", title: "이사 가는 날",
    desc: "아빠 회사 때문에 다른 동네로 이사를 간다. 정든 놀이터와 작별이다.",
    choices: [
      { id: "cry", emoji: "😭", text: "가기 싫다고 운다", grade: "mid", effects: { happy: -3, social: +2 }, narratives: ["놀이터 친구와 '꼭 다시 만나자'고 약속했다. 지켜지진 않았다."] },
      { id: "excited", emoji: "🤩", text: "새 집이 궁금하다", grade: "good", effects: { happy: +4, luck: +2 }, narratives: ["내 방이 생겼다! 벽지는 공룡 무늬다."] },
      { id: "pack", emoji: "📦", text: "장난감을 직접 챙긴다", grade: "good", effects: { intel: +3, power: +1 }, narratives: ["상자 하나를 끝까지 혼자 들었다. 어른스럽다는 칭찬을 들었다."] },
    ],
  }),

  // ===================== 초등 =====================
  E({
    id: "v2_hagwon", stage: "child", age: [7, 12], emoji: "🏫", title: "학원 몇 개?",
    desc: "옆집 아이는 학원을 다섯 개 다닌다고 한다. 엄마가 고민 중이다.", weight: 1.5,
    choices: [
      { id: "five", emoji: "📚", text: "영어·수학·논술·피아노·태권도", sub: "풀코스", grade: "mid", effects: { intel: +9, happy: -7, health: -2, money: -80 }, narratives: ["저녁은 학원 차 안에서 컵밥으로 먹었다."] },
      { id: "one", emoji: "✏️", text: "수학 하나만", grade: "good", effects: { intel: +5, happy: +1, money: -20 }, narratives: ["남는 시간엔 놀이터에서 놀았다. 균형이 잡혔다."] },
      { id: "sports", emoji: "🥋", text: "운동만 시켜 주세요", grade: "good", effects: { power: +7, health: +5, money: -15 }, narratives: ["태권도 품띠를 땄다. 밥을 두 공기씩 먹는다."] },
      { id: "none", emoji: "🛝", text: "학원은 됐고 논다", grade: "mid", effects: { happy: +7, social: +3, intel: -3 }, narratives: ["동네 골목대장이 됐다. 해 질 녘까지 숨바꼭질."] },
    ],
  }),
  E({
    id: "v2_class_president", stage: "child", age: [9, 12], emoji: "🗳️", title: "반장 선거",
    desc: "담임 선생님이 반장 후보를 받는다. 손을 들까?",
    choices: [
      { id: "run", emoji: "🙋", text: "출마한다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { social: +8, happy: +5 }, narrative: "한 표 차이로 당선! 피자를 쐈다(엄마 카드로)." , flag: { add: ["leader"] } },
          { chance: 0.5, effects: { social: +3, happy: -4 }, narrative: "낙선했다. 내 표는 내가 찍었는데 한 표뿐이었다." },
        ] },
      { id: "nominate", emoji: "👉", text: "친한 친구를 추천한다", grade: "mid", effects: { social: +5 }, narratives: ["친구가 반장이 됐다. 의리의 1등 공신."] },
      { id: "hide", emoji: "🫣", text: "고개를 숙인다", grade: "mid", effects: { intel: +2 }, narratives: ["선생님과 눈이 마주칠까 봐 필통만 봤다."] },
    ],
  }),
  E({
    id: "v2_first_phone", stage: "child", age: [8, 12], emoji: "📱", title: "첫 스마트폰",
    desc: "반에서 폰 없는 사람이 나 혼자다. 부모님을 조를까?",
    choices: [
      { id: "beg", emoji: "🥺", text: "울면서 조른다", grade: "mid", effects: { internet: +10, happy: +5, intel: -2 }, narratives: ["드디어 생겼다. 단톡방에 들어가 첫 이모티콘을 보냈다."] },
      { id: "kid_phone", emoji: "⌚", text: "키즈폰으로 타협", grade: "good", effects: { internet: +3, intel: +2 }, narratives: ["엄마가 위치를 실시간으로 본다. 자유는 제한적이다."] },
      { id: "no", emoji: "📖", text: "없어도 된다", grade: "good", effects: { intel: +5, internet: -3, social: -2 }, narratives: ["대신 도서관 단골이 됐다. 다만 반 유행어는 늘 한 박자 늦었다."] },
    ],
  }),
  E({
    id: "v2_bullied", stage: "child", age: [9, 13], emoji: "😞", title: "따돌림",
    desc: "반 아이들이 나만 빼고 노는 것 같다. 단톡방에서도 답이 없다.",
    choices: [
      { id: "tell", emoji: "🗣️", text: "선생님과 부모님께 털어놓는다", grade: "good", effects: { happy: +3, social: +2 }, narratives: ["어른들이 나서 줬다. 무섭지만 말하길 잘했다."] },
      { id: "endure", emoji: "😶", text: "혼자 견딘다", grade: "bad", effects: { happy: -9, intel: +4, health: -3 }, narratives: ["책 속으로 숨었다. 그 해 겨울은 길었다."], flag: { add: ["lonely_child"] } },
      { id: "new_friend", emoji: "🤝", text: "다른 반 친구를 사귄다", grade: "good", effects: { social: +6, happy: +4 }, relation: { friend: "옆반 친구", delta: +30 }, narratives: ["쉬는 시간마다 옆 반으로 갔다. 진짜 친구는 한 명이면 됐다."] },
      { id: "fight", emoji: "👊", text: "주동자와 맞붙는다", grade: "mid", effects: { power: +5, social: -2, happy: +2 }, narratives: ["둘 다 교무실에 불려 갔다. 이후로 아무도 건드리지 않았다."] },
    ],
  }),
  E({
    id: "v2_allowance", stage: "child", age: [10, 13], emoji: "🐷", title: "세뱃돈 30만 원",
    desc: "설날에 세뱃돈이 30만 원이나 모였다. 엄마가 '맡아 줄게'라고 한다.",
    choices: [
      { id: "mom", emoji: "👩", text: "엄마에게 맡긴다", grade: "mid", effects: { happy: -3 }, narratives: ["그 돈의 행방은 아직도 미스터리다."] },
      { id: "bank", emoji: "🏦", text: "내 통장을 만든다", grade: "good", effects: { money: +30, intel: +3 }, flag: { add: ["saver"] }, narratives: ["통장에 찍힌 숫자를 하루에 세 번 봤다. 저축의 맛을 알았다."] },
      { id: "spend", emoji: "🎮", text: "게임기를 산다", grade: "mid", effects: { happy: +8, internet: +4 }, narratives: ["친구들이 우리 집에 모였다. 인기 폭발."] },
      { id: "stock", emoji: "📈", text: "어린이 주식 계좌", sub: "엄마 명의 빌려서", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { money: +60, intel: +4 }, narrative: "산 주식이 두 배가 됐다. 꼬마 투자자 탄생." },
          { chance: 0.5, effects: { money: +10, happy: -2 }, narrative: "반토막. 인생 첫 손절을 배웠다." },
        ] },
    ],
  }),
  E({
    id: "v2_swim", stage: "child", age: [7, 12], emoji: "🏊", title: "여름방학 수영 강습",
    desc: "동네 수영장에서 방학 특강을 한다. 물이 좀 무섭긴 하다.",
    choices: [
      { id: "go", emoji: "🏊", text: "도전한다", grade: "good", effects: { power: +5, health: +5, happy: +2, money: -10 }, narratives: ["자유형 25미터를 완주했다. 평생 써먹을 기술."] },
      { id: "skip", emoji: "🍉", text: "집에서 수박 먹으며 쉰다", grade: "mid", effects: { happy: +5, health: -1 }, narratives: ["에어컨 아래가 천국이었다."] },
    ],
  }),

  // ===================== 중고등 =====================
  E({
    id: "v2_puberty", stage: "teen", age: [13, 16], emoji: "🌋", title: "사춘기 폭발",
    desc: "모든 게 짜증 난다. 엄마의 '밥 먹어'도 잔소리로 들린다.",
    choices: [
      { id: "door", emoji: "🚪", text: "방문을 쾅 닫는다", grade: "mid", effects: { happy: -2, power: +2, social: -2 }, narratives: ["문 경첩이 헐거워졌다. 아빠가 말없이 고쳤다."] },
      { id: "music", emoji: "🎧", text: "음악에 빠진다", grade: "good", effects: { happy: +5, internet: +3 }, narratives: ["가사 한 줄 한 줄이 내 얘기 같았다."] },
      { id: "talk", emoji: "🤗", text: "엄마와 밤새 이야기", grade: "good", effects: { happy: +6, social: +4 }, narratives: ["처음으로 엄마도 열다섯 살이었다는 걸 알았다."] },
      { id: "dye", emoji: "💇", text: "몰래 머리를 염색한다", grade: "mid", effects: { happy: +4, social: +3, luck: -2 }, narratives: ["학생부 선생님과 아침마다 눈이 마주친다."] },
    ],
  }),
  E({
    id: "v2_track", stage: "teen", age: [15, 17], emoji: "🧭", title: "문과? 이과? 예체능?",
    desc: "진로 선택서를 내야 한다. 이게 인생을 가른다고 다들 겁을 준다.", weight: 2.5,
    flagBanned: ["track_set"],
    choices: [
      { id: "sci", emoji: "🔬", text: "이과", sub: "취업은 이과지", grade: "good", effects: { intel: +6, happy: -2 }, flag: { add: ["track_set", "track_sci"] }, narratives: ["수학 문제집이 세 권 늘었다."] },
      { id: "lib", emoji: "📜", text: "문과", sub: "좋아하는 걸로", grade: "good", effects: { intel: +4, social: +3 }, flag: { add: ["track_set", "track_lib"] }, narratives: ["국어 시간이 제일 좋았다. 그걸로 됐다."] },
      { id: "art", emoji: "🎨", text: "예체능", sub: "꿈을 따라", grade: "mid", effects: { happy: +6, money: -60 }, flag: { add: ["track_set", "track_art"] }, route: "artist", narratives: ["입시 미술 학원비가 만만치 않다. 그래도 붓을 잡으면 행복하다."] },
      { id: "voc", emoji: "🔧", text: "특성화고·기술", sub: "빨리 돈 번다", grade: "good", effects: { power: +3, intel: +2 }, flag: { add: ["track_set", "track_voc"] }, narratives: ["자격증을 세 개 땄다. 선배가 대기업 생산직에 붙었다고 한다."] },
    ],
  }),
  E({
    id: "v2_csat", stage: "teen", age: [18, 18], emoji: "📝", title: "수능 날",
    desc: "11월 셋째 주 목요일. 수험표를 쥔 손에 땀이 찬다.", weight: 6,
    flagBanned: ["track_voc"],
    choices: [
      { id: "calm", emoji: "🧘", text: "평소처럼 차분하게", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { intel: +6, happy: +8 }, narrative: "모의고사보다 잘 봤다. 엄마가 교문 앞에서 울었다.", flag: { add: ["good_csat"] } },
          { chance: 0.4, effects: { intel: +2 }, narrative: "평소 실력대로 나왔다. 나쁘지 않다." },
          { chance: 0.15, effects: { happy: -8 }, narrative: "국어에서 시간이 모자랐다. 마킹을 다 못 했다." },
        ] },
      { id: "cram", emoji: "📖", text: "쉬는 시간마다 오답노트", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { intel: +5, health: -2 }, narrative: "본 거 나왔다! 짜릿했다.", flag: { add: ["good_csat"] } },
          { chance: 0.5, effects: { happy: -5, health: -2 }, narrative: "본 건 안 나오고 머리만 복잡해졌다." },
        ] },
      { id: "luck", emoji: "🍀", text: "찍신이 강림하길", grade: "mid",
        outcomes: [
          { chance: 0.25, effects: { luck: +8, happy: +10 }, narrative: "찍은 게 다 맞았다. 인생 운을 여기서 다 썼다.", flag: { add: ["good_csat"] } },
          { chance: 0.75, effects: { happy: -6 }, narrative: "찍신은 오지 않았다." },
        ] },
    ],
  }),
  E({
    id: "v2_parttime_teen", stage: "teen", age: [16, 18], emoji: "🍔", title: "첫 아르바이트",
    desc: "친구가 패스트푸드점 알바 자리를 소개해 줬다. 시급은 최저시급.",
    choices: [
      { id: "work", emoji: "🍟", text: "한다", grade: "good", effects: { money: +150, social: +4, intel: -2, health: -1 }, narratives: ["첫 월급으로 부모님 내복을 샀다. 엄마가 웃었다."] },
      { id: "study", emoji: "📚", text: "공부에 집중한다", grade: "mid", effects: { intel: +4 }, narratives: ["친구가 사 준 햄버거가 유독 맛있었다."] },
      { id: "youtube", emoji: "🎬", text: "유튜브로 돈 벌어 본다", grade: "mid",
        outcomes: [
          { chance: 0.2, effects: { internet: +10, money: +80 }, narrative: "쇼츠 하나가 100만 뷰를 찍었다!", route: "streamer" },
          { chance: 0.8, effects: { internet: +5, happy: -2 }, narrative: "구독자 37명. 그중 10명은 가족과 친구." },
        ] },
    ],
  }),

  // ===================== 청년 =====================
  E({
    id: "v2_university", stage: "adult", age: [19, 20], emoji: "🎓", title: "대학 원서",
    desc: "원서를 어디에 쓸까. 담임 선생님은 '안정'을, 엄마는 '상향'을 말한다.", weight: 5,
    flagBanned: ["college_done"],
    choices: [
      { id: "top", emoji: "🏛️", text: "인서울 상위권 도전", grade: "good", statRequired: { intel: 65 },
        outcomes: [
          { chance: 0.6, effects: { intel: +6, happy: +10, money: -600 }, narrative: "합격! 과잠을 입고 동네를 한 바퀴 돌았다.", flag: { add: ["college_done", "college_top"] } },
          { chance: 0.4, effects: { happy: -10 }, narrative: "전부 떨어졌다. 재수 학원 상담을 받았다.", flag: { add: ["retake"] } },
        ] },
      { id: "local", emoji: "🏫", text: "지방 국립대", sub: "등록금이 싸다", grade: "good", effects: { intel: +4, money: -300, happy: +3 }, flag: { add: ["college_done"] }, narratives: ["캠퍼스가 넓고 하늘이 높다. 동기들이 좋다."] },
      { id: "job", emoji: "🏭", text: "대학 안 가고 바로 취업", grade: "mid", effects: { money: +300, intel: -1, power: +3 }, flag: { add: ["college_done", "no_college"] }, life: { job: { title: "생산직 사원", salary: 3000 } }, narratives: ["또래보다 4년 빨리 돈을 번다. 가끔 캠퍼스가 부럽다."] },
      { id: "retake", emoji: "🔁", text: "재수한다", grade: "mid", effects: { intel: +5, happy: -8, money: -1500 }, flag: { add: ["retake"] }, narratives: ["노량진의 겨울은 춥다. 컵밥이 맛있다."] },
    ],
  }),
  E({
    id: "v2_military", stage: "adult", age: [20, 23], emoji: "🪖", title: "입영 통지서",
    desc: "우편함에 병무청 봉투가 꽂혀 있다. 드디어 왔다.", weight: 5,
    genderRequired: "M", flagBanned: ["military_done"],
    choices: [
      { id: "army", emoji: "🎖️", text: "육군 현역", sub: "18개월", grade: "good", effects: { power: +8, health: +4, social: +5, happy: -6, money: +800 }, flag: { add: ["military_done"] }, narratives: ["전역 날, 부대 정문 앞에서 엄마가 손을 흔들었다. 적금도 꽤 모였다."] },
      { id: "airforce", emoji: "✈️", text: "공군 지원", sub: "21개월, 꿀이라던데", grade: "good", effects: { intel: +4, power: +4, happy: -3, money: +900 }, flag: { add: ["military_done"] }, narratives: ["꿀은 없었다. 대신 자격증을 두 개 땄다."] },
      { id: "public", emoji: "🏢", text: "사회복무요원", grade: "mid", effects: { happy: +2, social: +2, money: +600 }, flag: { add: ["military_done"] }, narratives: ["구청에서 민원 서류를 떼 줬다. 어른들의 세계를 엿봤다."] },
      { id: "delay", emoji: "⏳", text: "최대한 미룬다", grade: "mid", effects: { happy: +3, luck: -3 }, narratives: ["대학원 핑계로 미뤘다. 문제는 해결되지 않았다."] },
    ],
  }),
  E({
    id: "v2_first_job", stage: "adult", age: [23, 30], emoji: "💼", title: "첫 직장",
    desc: "취업 시즌. 합격 문자가 몇 통 왔다. 어디로 갈까? 인생의 경제가 여기서 정해진다.", weight: 6,
    cond: p => !p.job,
    choices: [
      { id: "big", emoji: "🏢", text: "대기업 공채", sub: "연봉 5,200만원", grade: "crit", statRequired: { intel: 60 },
        outcomes: [
          { chance: 0.55, effects: { happy: +10, social: +3 }, narrative: "최종 합격! 사원증을 목에 걸고 셀카를 찍었다.", life: { job: { title: "대기업 사원", salary: 5200 } }, route: "corporate", flag: { add: ["corp_track"] } },
          { chance: 0.45, effects: { happy: -8 }, narrative: "최종 면접에서 떨어졌다. 결국 중견기업에 들어갔다.", life: { job: { title: "중견기업 사원", salary: 3800 } } },
        ] },
      { id: "civil", emoji: "🏛️", text: "공무원 시험 준비", sub: "2~3년 각오", grade: "good", effects: { intel: +5, happy: -6, money: -1200 },
        outcomes: [
          { chance: 0.55, effects: { happy: +12 }, narrative: "합격 수기를 쓸 차례다. 연금이 든든하다.", life: { job: { title: "9급 공무원", salary: 3300 } } },
          { chance: 0.45, effects: { happy: -10, health: -3 }, narrative: "또 떨어졌다. 노량진을 떠나 작은 회사에 들어갔다.", life: { job: { title: "중소기업 사무직", salary: 2900 } } },
        ] },
      { id: "small", emoji: "🏪", text: "중소기업 바로 입사", sub: "연봉 2,900만원", grade: "mid", effects: { happy: +3, social: +3 }, life: { job: { title: "중소기업 사무직", salary: 2900 } }, route: "worker", narratives: ["사장님이 '가족 같은 회사'라고 했다. 불안하다."] },
      { id: "startup", emoji: "🚀", text: "친구와 창업", grade: "mid", effects: { money: -2000, happy: +6 },
        outcomes: [
          { chance: 0.2, effects: { money: +15000, happy: +15 }, narrative: "투자 유치에 성공했다! 기사에 이름이 나왔다.", life: { job: { title: "스타트업 대표", salary: 7000 } }, flag: { add: ["founder"] } },
          { chance: 0.8, effects: { happy: -10, health: -4 }, narrative: "2년 만에 폐업. 빚 2천만 원과 교훈이 남았다.", life: { job: { title: "스타트업 경력직", salary: 3600 } } },
        ] },
      { id: "free", emoji: "💻", text: "프리랜서", grade: "mid", effects: { happy: +5, internet: +4 }, life: { job: { title: "프리랜서", salary: 3000 } }, narratives: ["카페가 사무실이다. 수입은 들쭉날쭉하다."] },
    ],
  }),
  E({
    id: "v2_move_out", stage: "adult", age: [21, 33], emoji: "🔑", title: "독립",
    desc: "부모님 집을 나올 때가 된 것 같다. 보증금은 어떻게 마련하지?",
    cond: p => p.housing === "parents",
    choices: [
      { id: "oneroom", emoji: "🏠", text: "원룸 월세", sub: "보증금 500/월 50", grade: "good", effects: { happy: +7, money: -500, social: +2 }, life: { housing: "rent" }, narratives: ["내 공간이다! 라면을 끓여 먹다 냄비째 먹었다."] },
      { id: "jeonse", emoji: "📄", text: "전세 대출 받아 투룸", grade: "good", effects: { happy: +5, money: -1500 }, life: { housing: "jeonse" }, narratives: ["전세 사기 뉴스를 볼 때마다 등기부등본을 다시 뗐다."] },
      { id: "stay", emoji: "🛋️", text: "아직은 캥거루족", grade: "mid", effects: { money: +600, happy: -3, social: -2 }, narratives: ["엄마 밥이 최고다. 다만 연애하기가 어렵다."] },
    ],
  }),
  E({
    id: "v2_burnout", repeat: 6, stage: "adult", age: [25, 34], emoji: "🔥", title: "번아웃",
    desc: "아침에 눈을 뜨는 게 무섭다. 회사 앞에서 발이 안 떨어진다.",
    cond: p => !!p.job,
    choices: [
      { id: "quit", emoji: "🚪", text: "사표를 던진다", grade: "mid", effects: { happy: +8, health: +4, money: -500 }, life: { quit: true }, narratives: ["홀가분했다. 통장 잔고를 보기 전까지는."] },
      { id: "leave", emoji: "🏖️", text: "휴직하고 쉰다", grade: "good", effects: { happy: +6, health: +6, money: -800 }, narratives: ["제주도에서 한 달을 살았다. 다시 걸을 힘이 생겼다."] },
      { id: "push", emoji: "☕", text: "커피로 버틴다", grade: "bad", effects: { health: -8, happy: -6, money: +300 }, flag: { add: ["overworker"] }, narratives: ["위가 아프다. 그래도 성과급은 나왔다."] },
      { id: "therapy", emoji: "🧑‍⚕️", text: "상담을 받는다", grade: "good", effects: { happy: +5, health: +3, money: -150 }, narratives: ["'괜찮지 않아도 괜찮다'는 말에 울었다."] },
    ],
  }),
  E({
    id: "v2_invest_20s", stage: "adult", age: [24, 34], emoji: "📊", title: "모두가 투자하는 시대",
    desc: "회사 동기들이 점심마다 주식 얘기다. 나만 뒤처지는 것 같다.",
    choices: [
      { id: "index", emoji: "📈", text: "적립식 ETF", sub: "매달 50만 원", grade: "good", effects: { money: +900, intel: +3 }, flag: { add: ["saver"] }, narratives: ["지루하지만 꾸준히 불어났다. 복리는 배신하지 않았다."] },
      { id: "coin", emoji: "🪙", text: "코인 올인", grade: "mid",
        outcomes: [
          { chance: 0.15, effects: { money: +20000, happy: +15 }, narrative: "10배가 났다! 손이 떨려 화장실에서 매도했다.", route: "crypto" },
          { chance: 0.5, effects: { money: -1500, happy: -8 }, narrative: "-70%. 앱을 지웠다가 다시 깔았다.", route: "crypto" },
          { chance: 0.35, effects: { money: -3000, happy: -14, health: -4 }, narrative: "상장폐지. 잠이 오지 않는다.", route: "crypto" },
        ] },
      { id: "save", emoji: "🏦", text: "예적금만 한다", grade: "mid", effects: { money: +500, happy: -1 }, narratives: ["이자가 물가를 못 따라간다. 그래도 잃진 않았다."] },
      { id: "self", emoji: "📚", text: "나에게 투자(자격증)", grade: "good", effects: { intel: +6, money: -200 }, life: { raise: 1.08 }, narratives: ["자격증 수당이 붙었다. 연봉이 8% 올랐다."] },
    ],
  }),
  E({
    id: "v2_checkup_young", stage: "adult", age: [26, 34], emoji: "🩺", title: "첫 건강검진",
    desc: "회사에서 보내 준 건강검진. 결과지에 빨간 글씨가 몇 개 보인다.",
    choices: [
      { id: "gym", emoji: "🏋️", text: "헬스장 1년 등록", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { power: +6, health: +7, money: -80 }, narrative: "주 3회를 지켰다. 수치가 정상으로 돌아왔다.", flag: { add: ["healthy_habit"] } },
          { chance: 0.45, effects: { money: -80, happy: -2 }, narrative: "세 번 가고 기부천사가 됐다." },
        ] },
      { id: "diet", emoji: "🥗", text: "야식·술을 끊는다", grade: "good", effects: { health: +6, happy: -3 }, narratives: ["치킨 냄새에 괴로웠지만 버텼다."] },
      { id: "ignore", emoji: "🙈", text: "젊으니까 괜찮다", grade: "bad", effects: { health: -4, happy: +2 }, narratives: ["결과지는 서랍 깊숙이 들어갔다."] },
    ],
  }),
  E({
    id: "v2_job_change", repeat: 5, stage: "adult", age: [27, 34], emoji: "🔁", title: "이직 제안",
    desc: "헤드헌터에게 연락이 왔다. 연봉 20% 인상 조건이다. 단, 야근이 많기로 유명한 곳.",
    cond: p => !!p.job,
    choices: [
      { id: "move", emoji: "🏃", text: "옮긴다", grade: "good", effects: { happy: +3, health: -3 }, life: { raise: 1.2 }, narratives: ["연봉은 올랐고 퇴근은 늦어졌다."] },
      { id: "nego", emoji: "🤝", text: "제안서로 현 회사와 협상", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +6 }, narrative: "회사가 붙잡았다. 연봉 10% 인상!", life: { raise: 1.1 } },
          { chance: 0.5, effects: { happy: -6, social: -3 }, narrative: "'그럼 가세요.' 팀장의 대답에 얼어붙었다." },
        ] },
      { id: "stay", emoji: "🌿", text: "지금이 편하다", grade: "mid", effects: { happy: +2, health: +2 }, narratives: ["칼퇴가 연봉 20%보다 소중하다."] },
    ],
  }),
  E({
    id: "v2_jobless_25", repeat: 3, stage: "adult", age: [25, 32], emoji: "📮", title: "취업 준비 3년 차",
    desc: "자소서만 200개를 썼다. 부모님의 눈치가 따갑다.",
    cond: p => !p.job,
    choices: [
      { id: "lower", emoji: "🎯", text: "눈을 낮춰 아무 데나", grade: "good", effects: { happy: +3 }, life: { job: { title: "중소기업 사무직", salary: 2800 } }, narratives: ["드디어 4대 보험이 생겼다."] },
      { id: "academy", emoji: "💻", text: "국비 코딩 학원", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { intel: +7, happy: +6 }, narrative: "6개월 만에 개발자로 취업했다!", life: { job: { title: "주니어 개발자", salary: 3800 } } },
          { chance: 0.4, effects: { intel: +3, happy: -4 }, narrative: "수료는 했는데 취업 시장이 얼어붙었다." },
        ] },
      { id: "give_up", emoji: "🛌", text: "잠시 쉬기로 한다", grade: "bad", effects: { happy: +2, social: -4 }, route: "neet", narratives: ["낮과 밤이 바뀌었다."] },
    ],
  }),
];
