// =========================
// 인생게임 v2 이벤트 — 중년·노년·황혼 (money=만원, death:"원인id" 로 사건 사망 가능)
// =========================
const E = o => ({ v: 2, type: "normal", ...o });

export const EVENTS_LATER = [
  // ===================== 중년: 일 =====================
  E({
    id: "v2_promotion", repeat: 5, stage: "midlife", age: [35, 52], emoji: "📈", title: "승진 심사",
    desc: "팀장 자리가 하나 비었다. 후보는 나와 입사 동기.", weight: 1.6,
    cond: p => !!p.job,
    choices: [
      { id: "push", emoji: "🔥", text: "주말까지 반납하고 성과를 낸다", grade: "good", effects: { health: -5, happy: -3 },
        outcomes: [
          { chance: 0.6, effects: { happy: +10, social: +3 }, narrative: "팀장이 됐다. 명함이 바뀌었다.", life: { raise: 1.25 }, flag: { add: ["manager"] } },
          { chance: 0.4, effects: { happy: -8 }, narrative: "동기가 됐다. 축하한다는 말이 목에 걸렸다." },
        ] },
      { id: "network", emoji: "🍶", text: "임원과 골프를 친다", grade: "mid", effects: { money: -300, social: +4, health: -1 },
        outcomes: [
          { chance: 0.5, effects: { happy: +8 }, narrative: "'자네 같은 사람이 필요해.' 승진했다.", life: { raise: 1.2 }, flag: { add: ["manager"] } },
          { chance: 0.5, effects: { happy: -4 }, narrative: "공만 잃어버렸다." },
        ] },
      { id: "yield", emoji: "🌿", text: "욕심 내지 않는다", grade: "mid", effects: { happy: +3, health: +3 }, narratives: ["저녁이 있는 삶을 택했다. 후회는 없다."] },
    ],
  }),
  E({
    id: "v2_layoff", stage: "midlife", age: [45, 58], emoji: "📦", title: "희망퇴직 명단",
    desc: "회사 구조조정. 인사팀에서 면담하자는 메일이 왔다.", weight: 1.5,
    cond: p => !!p.job && !p.flags.has("founder"),
    choices: [
      { id: "take", emoji: "💰", text: "위로금 받고 나간다", grade: "mid", effects: { money: +8000, happy: -6 }, life: { quit: true }, flag: { add: ["laid_off"] }, narratives: ["짐 상자를 들고 엘리베이터를 탔다. 24년이 상자 하나에 들어갔다."] },
      { id: "stay", emoji: "🧱", text: "버틴다", grade: "mid", effects: { happy: -8, health: -3 }, life: { raise: 0.9 }, narratives: ["창가 자리로 옮겨졌다. 그래도 월급은 나온다."] },
      { id: "chicken", emoji: "🍗", text: "퇴직금으로 치킨집 창업", grade: "mid", effects: { money: -5000 }, life: { quit: true, job: { title: "치킨집 사장", salary: 3500 } },
        outcomes: [
          { chance: 0.3, effects: { money: +6000, happy: +10 }, narrative: "동네 맛집으로 소문났다. 배달앱 별점 4.9.", flag: { add: ["shop_owner"] } },
          { chance: 0.7, effects: { money: -3000, happy: -10, health: -4 }, narrative: "2년 만에 문을 닫았다. 골목에 치킨집이 일곱 개였다.", life: { quit: true } },
        ] },
    ],
  }),
  E({
    id: "v2_side_business", stage: "midlife", age: [35, 55], emoji: "🛒", title: "부업 유혹",
    desc: "유튜브에서 '월 300 버는 스마트스토어' 영상을 봤다.", weight: 1.1,
    choices: [
      { id: "try", emoji: "📦", text: "퇴근 후 해 본다", grade: "mid", effects: { health: -3, internet: +4 },
        outcomes: [
          { chance: 0.3, effects: { money: +4000, happy: +6 }, narrative: "효자 상품 하나가 터졌다. 진짜 월 300이 됐다.", flag: { add: ["side_hustle"] } },
          { chance: 0.7, effects: { money: -300, happy: -3 }, narrative: "재고만 거실에 쌓였다." },
        ] },
      { id: "course", emoji: "🎓", text: "강의부터 산다", sub: "299만원", grade: "bad", effects: { money: -299, happy: -4 }, narratives: ["강의를 판 사람만 월 300을 벌었다."] },
      { id: "no", emoji: "🛋️", text: "쉬는 게 남는 거다", grade: "mid", effects: { happy: +3, health: +2 } },
    ],
  }),
  E({
    id: "v2_house_buy", stage: "midlife", age: [35, 55], emoji: "🏘️", title: "내 집 마련",
    desc: "전셋값이 또 올랐다. 이번 기회에 집을 살까?", weight: 1.8,
    cond: p => p.housing !== "own",
    choices: [
      { id: "buy", emoji: "🏠", text: "대출 끼고 산다", grade: "good", effects: { money: -2000, happy: +6 }, life: { housing: "own" }, flag: { add: ["homeowner"] },
        outcomes: [
          { chance: 0.5, effects: { money: +20000 }, narrative: "10년 뒤 집값이 두 배가 됐다. 운이 좋았다.", grade: "crit" },
          { chance: 0.35, effects: { money: +3000 }, narrative: "집값은 제자리. 그래도 이사 걱정이 사라졌다." },
          { chance: 0.15, effects: { money: -6000, happy: -8 }, narrative: "샀더니 떨어졌다. 대출 이자만 남았다.", grade: "bad" },
        ] },
      { id: "wait", emoji: "⏳", text: "떨어질 때까지 기다린다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: -6 }, narrative: "안 떨어졌다. 벼락거지가 됐다." },
          { chance: 0.5, effects: { money: +1000, happy: +3 }, narrative: "조정장이 왔다. 그 돈으로 투자를 했다." },
        ] },
      { id: "rural", emoji: "🌾", text: "외곽 전원주택", grade: "good", effects: { money: -1000, happy: +8, health: +4 }, life: { housing: "own" }, flag: { add: ["homeowner"] }, narratives: ["출퇴근은 길어졌지만 마당에 상추가 자란다."] },
    ],
  }),
  E({
    id: "v2_midlife_crisis", stage: "midlife", age: [40, 55], emoji: "🏍️", title: "중년의 위기",
    desc: "거울 속 내가 낯설다. 이대로 늙어도 되나?", weight: 1.2,
    choices: [
      { id: "bike", emoji: "🏍️", text: "오토바이를 산다", grade: "mid", effects: { happy: +8, money: -2500 },
        outcomes: [
          { chance: 0.85, effects: { power: +2 }, narrative: "주말마다 바람을 가른다. 살아 있는 기분." },
          { chance: 0.15, effects: { health: -25, happy: -10 }, narrative: "빗길에 미끄러졌다. 석 달을 병원에 누워 있었다." },
        ] },
      { id: "study", emoji: "📚", text: "대학원에 간다", grade: "good", effects: { intel: +7, money: -2000, happy: +4 }, flag: { add: ["old_dream"] }, narratives: ["스무 살 동기들 사이에서 반장이 됐다."] },
      { id: "marathon", emoji: "🏃", text: "마라톤을 시작한다", grade: "good", effects: { health: +8, power: +6, happy: +4 }, flag: { add: ["healthy_habit"] }, narratives: ["첫 하프 완주. 결승선에서 울었다."] },
      { id: "affair", emoji: "💋", text: "옛 연인에게 연락한다", grade: "bad", married: true,
        outcomes: [
          { chance: 0.6, effects: { happy: -6 }, narrative: "답이 없었다. 다행이었다." },
          { chance: 0.4, effects: { happy: -15, money: -3000 }, narrative: "{spouse}가 알게 됐다. 모든 게 무너졌다.", life: { bond: -40 } },
        ] },
    ],
  }),

  // ===================== 중년: 건강 =====================
  E({
    id: "v2_checkup_mid", repeat: 6, stage: "midlife", age: [40, 59], emoji: "📋", title: "건강검진 재검",
    desc: "'재검 요망'. 결과지의 그 네 글자가 하루 종일 맴돈다.", weight: 1.8,
    choices: [
      { id: "go", emoji: "🏥", text: "바로 정밀 검사", grade: "good", effects: { money: -80 },
        outcomes: [
          { chance: 0.6, effects: { happy: +6, health: +2 }, narrative: "다행히 별것 아니었다. 그날 저녁 밥맛이 꿀맛이었다." },
          { chance: 0.3, effects: { health: -4, happy: -4 }, narrative: "초기 당뇨. 약을 먹기 시작했다. 일찍 알아서 다행이다.", flag: { add: ["chronic"] } },
          { chance: 0.1, effects: { health: -10, money: -1500, happy: -8 }, narrative: "초기 암이었다. 수술은 잘 됐다. 조기 발견이 살렸다.", flag: { add: ["cancer_survivor"] } },
        ] },
      { id: "later", emoji: "🗓️", text: "바쁘니까 나중에", grade: "bad",
        outcomes: [
          { chance: 0.6, effects: { happy: +1 }, narrative: "괜찮겠지. 아마도." },
          { chance: 0.4, effects: { health: -16, money: -3000, happy: -10 }, narrative: "1년 뒤 쓰러졌다. 그때 갈걸.", flag: { add: ["chronic"] } },
        ] },
    ],
  }),
  E({
    id: "v2_big_illness", stage: "*", age: [45, 90], emoji: "🎗️", title: "암 진단",
    desc: "의사가 차트를 넘기며 조심스럽게 말을 꺼냈다. '암입니다.'", weight: 0.8,
    cond: p => p.stats.health < 48,
    choices: [
      { id: "surgery", emoji: "🔪", text: "수술과 항암을 견딘다", grade: "good", effects: { money: -2500, happy: -8 },
        outcomes: [
          { chance: 0.65, effects: { health: +10 }, narrative: "5년 뒤, 완치 판정. 다시 태어난 기분이다.", flag: { add: ["cancer_survivor"] } },
          { chance: 0.25, effects: { health: -18 }, narrative: "재발했다. 싸움이 길어진다.", flag: { add: ["chronic"] } },
          { chance: 0.1, effects: {}, narrative: "치료를 끝까지 견뎠지만, 몸이 버티지 못했다.", death: "disease" },
        ] },
      { id: "natural", emoji: "🌲", text: "산속에서 자연치유", grade: "mid", effects: { money: -500, happy: +4 },
        outcomes: [
          { chance: 0.3, effects: { health: +6 }, narrative: "기적처럼 좋아졌다. 의사도 놀랐다." },
          { chance: 0.45, effects: { health: -20 }, narrative: "결국 병원으로 돌아왔다. 시간을 잃었다." },
          { chance: 0.25, effects: {}, narrative: "숲속 오두막에서 조용히 눈을 감았다.", death: "disease" },
        ] },
      { id: "family", emoji: "👨‍👩‍👧", text: "가족에게 먼저 알린다", grade: "good", effects: { social: +4, money: -2000 },
        outcomes: [
          { chance: 0.6, effects: { health: +6, happy: +4 }, narrative: "가족이 매일 곁에 있었다. 이겨 냈다.", flag: { add: ["cancer_survivor"] } },
          { chance: 0.3, effects: { health: -14 }, narrative: "치료는 길고 힘들다. 그래도 혼자가 아니다." },
          { chance: 0.1, effects: {}, narrative: "가족 모두의 손을 잡고 떠났다.", death: "disease" },
        ] },
    ],
  }),
  E({
    id: "v2_habit", stage: "midlife", age: [35, 59], emoji: "🚬", title: "끊을 것인가",
    desc: "술자리에서 동료가 담배를 권한다. 요즘 스트레스가 심하다.", weight: 1.1,
    choices: [
      { id: "quit", emoji: "🙅", text: "끊은 지 3년째다", grade: "good", effects: { health: +6, happy: -1 }, flag: { add: ["healthy_habit"] }, narratives: ["대신 껌을 씹었다. 폐가 고마워한다."] },
      { id: "one", emoji: "🚬", text: "한 대만", grade: "bad", effects: { health: -6, happy: +2 }, flag: { add: ["smoker"] }, narratives: ["한 대가 한 갑이 됐다."] },
      { id: "drink", emoji: "🍻", text: "대신 술을 더 마신다", grade: "bad", effects: { health: -5, social: +4 }, narratives: ["2차, 3차. 다음 날 기억이 없다."] },
    ],
  }),
  E({
    id: "v2_invest_mid", stage: "midlife", age: [38, 59], emoji: "💹", title: "노후 자금",
    desc: "은퇴까지 얼마 안 남았다. 모아 둔 돈을 어떻게 굴릴까?", weight: 1.4,
    cond: p => p.stats.money > 3000,
    choices: [
      { id: "pension", emoji: "🧓", text: "연금저축·IRP", grade: "good", effects: { money: +2000, intel: +2 }, flag: { add: ["saver"] }, narratives: ["세액공제도 받고 노후도 챙겼다. 재미는 없다."] },
      { id: "stock", emoji: "📈", text: "우량주 장기투자", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { money: +8000 }, narrative: "10년 버틴 보람이 있었다.", grade: "good" },
          { chance: 0.45, effects: { money: -3000, happy: -5 }, narrative: "하필 그 회사가 분식회계로 터졌다.", grade: "bad" },
        ] },
      { id: "friend", emoji: "🤝", text: "친구의 '확실한' 사업에 투자", grade: "bad",
        outcomes: [
          { chance: 0.15, effects: { money: +15000 }, narrative: "진짜 확실했다! 친구에게 큰절을 했다.", grade: "crit" },
          { chance: 0.85, effects: { money: -8000, happy: -12, social: -5 }, narrative: "친구는 연락이 끊겼다. 돈도 친구도 잃었다.", relation: { foe: "그 친구" }, grade: "bad" },
        ] },
    ],
  }),
  E({
    id: "v2_reunion", stage: "midlife", age: [40, 59], emoji: "🍻", title: "동창회",
    desc: "30년 만의 동창회 공지. 다들 어떻게 살고 있을까?", weight: 1,
    choices: [
      { id: "go", emoji: "🙌", text: "간다", grade: "good", effects: { happy: +6, social: +6, money: -20 }, relation: { friend: "옛 단짝", delta: +40 }, flag: { add: ["close_friends"] }, narratives: ["반장은 대머리가 됐고 짝꿍은 그대로였다. 새벽까지 웃었다."] },
      { id: "show", emoji: "🚗", text: "외제차 빌려 타고 간다", grade: "mid", effects: { money: -80, social: +2, happy: -2 }, narratives: ["아무도 차를 신경 쓰지 않았다. 다들 무릎 얘기만 했다."] },
      { id: "skip", emoji: "🏠", text: "안 간다", grade: "mid", effects: { happy: +1 }, narratives: ["단톡방 사진으로 대신했다."] },
    ],
  }),

  // ===================== 노년 =====================
  E({
    id: "v2_retire_plan", stage: "senior", age: [60, 66], emoji: "🌅", title: "은퇴 후 첫 아침",
    desc: "알람이 울리지 않는 아침. 오늘 뭘 하지?", weight: 4,
    flagBanned: ["retire_plan_done"],
    choices: [
      { id: "rework", emoji: "🔧", text: "재취업한다", grade: "good", effects: { happy: +3, social: +3 }, life: { job: { title: "경비·관리직", salary: 2200 } }, flag: { add: ["retire_plan_done"] }, narratives: ["아파트 관리사무소에서 일한다. 일이 있다는 게 좋다."] },
      { id: "farm", emoji: "🌾", text: "귀농·귀촌", grade: "good", effects: { health: +6, happy: +5, money: -3000 }, flag: { add: ["retire_plan_done", "farmer"] }, narratives: ["첫해 고추 농사는 망했다. 둘째 해엔 이웃에게 나눠 줬다."] },
      { id: "travel", emoji: "🧳", text: "세계 일주", grade: "good", effects: { happy: +10, money: -4000, health: +2 }, flag: { add: ["retire_plan_done", "late_traveler"] }, route: "traveler", narratives: ["산티아고 순례길을 걸었다. 젊을 때 왜 못 했나 싶다."] },
      { id: "tv", emoji: "📺", text: "그냥 쉰다", grade: "mid", effects: { happy: +2, health: -3, social: -3 }, flag: { add: ["retire_plan_done"] }, narratives: ["리모컨이 가장 친한 친구가 됐다."] },
    ],
  }),
  E({
    id: "v2_scam", stage: "senior", age: [62, 90], emoji: "☎️", title: "수상한 전화",
    desc: "'아들이 사고를 쳤다'는 전화가 왔다. 목소리가 다급하다.", weight: 1.2,
    choices: [
      { id: "hang", emoji: "📵", text: "끊고 직접 확인한다", grade: "good", effects: { intel: +3 }, narratives: ["보이스피싱이었다. 경찰서에 신고하고 동네에 알렸다."] },
      { id: "send", emoji: "💸", text: "급히 돈을 보낸다", grade: "bad", statRequired: {},
        outcomes: [
          { chance: 0.85, effects: { money: -3000, happy: -15, health: -4 }, narrative: "사기였다. 노후 자금 일부가 사라졌다." },
          { chance: 0.15, effects: { money: -50, happy: -2 }, narrative: "은행 직원이 이상하다며 막아 줬다. 은인이다." },
        ] },
      { id: "prank", emoji: "😏", text: "역으로 사기꾼을 놀린다", grade: "mid", effects: { happy: +5, internet: +3 }, narratives: ["30분 동안 붙잡아 뒀다. 손주가 영상으로 올려 화제가 됐다."] },
    ],
  }),
  E({
    id: "v2_senior_friend_loss", stage: "senior", age: [65, 79], emoji: "🕯️", title: "친구의 부고",
    desc: "40년 지기 친구의 부고 문자가 왔다. 지난달에도 통화했는데.", weight: 1.3,
    choices: [
      { id: "go", emoji: "🖤", text: "장례식장을 지킨다", grade: "good", effects: { happy: -6, social: +3, health: -2 }, narratives: ["밤새 친구의 젊은 날 이야기를 했다. 웃다가 울었다."] },
      { id: "call", emoji: "📞", text: "남은 친구들에게 전화한다", grade: "good", effects: { happy: -2, social: +6 }, relation: { friend: "남은 친구", delta: +30 }, narratives: ["'우리 자주 보자.' 이번엔 진심이었다."] },
      { id: "alone", emoji: "🍶", text: "혼자 술잔을 기울인다", grade: "mid", effects: { happy: -8, health: -3 }, narratives: ["빈 잔 하나를 더 채웠다."] },
    ],
  }),
  E({
    id: "v2_dementia_check", stage: "senior", age: [68, 79], emoji: "🧠", title: "깜빡깜빡",
    desc: "가스 불을 또 켜 두고 나왔다. 가족들이 걱정스러운 눈치다.", weight: 1.3,
    choices: [
      { id: "test", emoji: "🏥", text: "치매 검사를 받는다", grade: "good",
        outcomes: [
          { chance: 0.82, effects: { happy: +5 }, narrative: "정상이었다. 그냥 나이 탓이란다." },
          { chance: 0.18, effects: { intel: -6, happy: -6, money: -500 }, narrative: "초기 치매. 약으로 늦출 수 있다고 한다.", flag: { add: ["dementia"] } },
        ] },
      { id: "brain", emoji: "🧩", text: "매일 스도쿠와 일기", grade: "good", effects: { intel: +4, happy: +2 }, narratives: ["일기장이 다섯 권째다. 손주 이름은 절대 안 잊는다."] },
      { id: "deny", emoji: "🙅", text: "난 멀쩡하다", grade: "mid", effects: { happy: +1 },
        outcomes: [
          { chance: 0.75, effects: {}, narrative: "정말 멀쩡했다. 가족들이 머쓱해했다." },
          { chance: 0.25, effects: { intel: -10, health: -5 }, narrative: "치료 시기를 놓쳤다.", flag: { add: ["dementia"] } },
        ] },
    ],
  }),
  E({
    id: "v2_senior_youtube", stage: "senior", age: [62, 85], emoji: "📹", title: "실버 유튜버",
    desc: "손주가 '할머니·할아버지 유튜브 하면 대박 나요!'라고 한다.", weight: 0.9,
    choices: [
      { id: "do", emoji: "🎥", text: "해 본다", grade: "mid", effects: { internet: +12, happy: +5 },
        outcomes: [
          { chance: 0.15, effects: { money: +5000, social: +10 }, narrative: "먹방 하나가 떡상했다. 구독자 50만! 광고 문의가 쏟아진다.", route: "influencer" },
          { chance: 0.85, effects: { social: +3 }, narrative: "구독자 120명. 댓글은 다 다정하다." },
        ] },
      { id: "no", emoji: "🙅", text: "됐다, 난 라디오가 좋다", grade: "mid", effects: { happy: +2 } },
    ],
  }),
  E({
    id: "v2_inheritance_plan", stage: "senior", age: [65, 85], emoji: "📜", title: "재산 정리",
    desc: "아이들에게 재산을 어떻게 나눌지 정해 둬야 할 것 같다.", weight: 1.6,
    hasKid: true, cond: p => p.stats.money > 5000, flagBanned: ["will_done"],
    choices: [
      { id: "now", emoji: "🎁", text: "살아 있을 때 미리 나눠 준다", grade: "mid", effects: { money: -10000, happy: +6, social: +4 }, flag: { add: ["will_done"] },
        outcomes: [
          { chance: 0.7, effects: { happy: +4 }, narrative: "아이들이 집을 마련했다. 자주 찾아온다." },
          { chance: 0.3, effects: { happy: -10 }, narrative: "돈을 받고 나니 발길이 뜸해졌다. 서운하다.", flag: { add: ["kid_rift"] } },
        ] },
      { id: "will", emoji: "✍️", text: "유언장을 쓴다", grade: "good", effects: { intel: +2, happy: +2 }, flag: { add: ["will_done"] }, narratives: ["공증까지 받았다. 마음이 가벼워졌다."] },
      { id: "donate", emoji: "💝", text: "절반은 기부한다", grade: "good", effects: { money: -8000, happy: +10, social: +8 }, flag: { add: ["will_done", "donor"] }, narratives: ["모교에 장학금이 생겼다. 내 이름이 붙었다."] },
      { id: "spend", emoji: "🛳️", text: "다 쓰고 간다", grade: "mid", effects: { money: -6000, happy: +10 }, flag: { add: ["will_done"] }, narratives: ["크루즈를 탔다. 아이들은 '잘하셨어요'라고 했다. 아마도 진심으로."] },
    ],
  }),
  E({
    id: "v2_fall", stage: "senior", age: [70, 79], emoji: "🦴", title: "빙판길",
    desc: "아파트 앞 빙판길에서 미끄러졌다. 고관절이 아프다.", weight: 1.1,
    choices: [
      { id: "rehab", emoji: "🏥", text: "수술하고 재활을 열심히", grade: "good", effects: { money: -800, health: -6, power: +2 }, narratives: ["보행기를 짚고 복도를 열 바퀴씩 걸었다. 다시 걷게 됐다."] },
      { id: "rest", emoji: "🛏️", text: "누워서 쉰다", grade: "bad", effects: { money: -500, health: -14, power: -6 }, narratives: ["근육이 빠졌다. 침대에서 보내는 시간이 길어졌다."] },
    ],
  }),
  E({
    id: "v2_late_hobby", stage: "senior", age: [60, 79], emoji: "🎨", title: "늦게 찾은 취미",
    desc: "주민센터에서 노인 강좌를 연다. 뭘 배워 볼까?", weight: 1.1,
    choices: [
      { id: "paint", emoji: "🖌️", text: "수채화", grade: "good", effects: { happy: +7, intel: +2 }, flag: { add: ["old_dream"] }, narratives: ["첫 개인전을 동네 카페에서 열었다."] },
      { id: "dance", emoji: "💃", text: "스포츠댄스", grade: "good", effects: { health: +6, social: +6, happy: +4 }, narratives: ["차차차를 추면 무릎이 덜 아프다. 신기하다."] },
      { id: "english", emoji: "🔤", text: "영어 회화", grade: "good", effects: { intel: +6, happy: +3 }, narratives: ["손주 영어 숙제를 봐줬다. 존경의 눈빛을 받았다."] },
      { id: "go", emoji: "⚫", text: "바둑", grade: "mid", effects: { intel: +4, social: +2 }, narratives: ["1급이 됐다. 공원 바둑판의 강자."] },
    ],
  }),
  E({
    id: "v2_care_home", stage: "elder", age: [80, 100], emoji: "🏡", title: "요양원 이야기",
    desc: "혼자 지내기가 버거워졌다. 가족들이 조심스레 요양원 이야기를 꺼낸다.", weight: 2,
    flagBanned: ["care_decided"],
    choices: [
      { id: "home", emoji: "🏠", text: "내 집에서 지낸다", grade: "mid", effects: { happy: +4, health: -4 }, flag: { add: ["care_decided"] }, narratives: ["요양보호사가 하루 세 시간 온다. 익숙한 이불이 좋다."] },
      { id: "facility", emoji: "🏥", text: "좋은 요양원에 간다", grade: "good", effects: { health: +6, money: -3000, happy: -3, social: +4 }, flag: { add: ["care_decided"] }, narratives: ["말벗이 생겼다. 화투 실력이 늘었다."] },
      { id: "kid", emoji: "👨‍👩‍👧", text: "자식 집에 들어간다", grade: "mid", hasKid: true, effects: { happy: +5, social: +2 }, flag: { add: ["care_decided"] },
        outcomes: [
          { chance: 0.6, effects: { happy: +4 }, narrative: "손주들과 매일 저녁을 먹는다. 행복하다." },
          { chance: 0.4, effects: { happy: -6 }, narrative: "며느리·사위 눈치가 보인다. 방문을 조용히 닫는다." },
        ] },
    ],
  }),
  E({
    id: "v2_last_trip", stage: "elder", age: [80, 105], emoji: "🌸", title: "마지막 여행",
    desc: "다리에 힘이 남아 있을 때 꼭 가 보고 싶은 곳이 있다.", weight: 1.6,
    flagBanned: ["last_trip"],
    choices: [
      { id: "hometown", emoji: "🏘️", text: "어릴 적 고향", grade: "good", effects: { happy: +10, health: -2 }, flag: { add: ["last_trip"] }, narratives: ["학교는 사라졌지만 그 느티나무는 그대로였다. 나무를 안고 한참 서 있었다."] },
      { id: "sea", emoji: "🌊", text: "처음 데이트한 바다", grade: "good", effects: { happy: +9, money: -200 }, flag: { add: ["last_trip"] }, narratives: ["파도 소리가 그날과 똑같았다."] },
      { id: "no", emoji: "🪑", text: "그냥 집 앞 벤치", grade: "mid", effects: { happy: +4, health: +1 }, flag: { add: ["last_trip"] }, narratives: ["오가는 아이들을 보는 것도 여행이다."] },
    ],
  }),
  E({
    id: "v2_reconcile", stage: "elder", age: [80, 105], emoji: "🕊️", title: "화해",
    desc: "오래 연락이 끊긴 사람이 떠오른다. 지금이 아니면 영영 못 할 것 같다.", weight: 1.4,
    cond: p => (p.relations.foes || []).length > 0 || p.flags.has("kid_rift") || p.flags.has("sibling_rift"),
    choices: [
      { id: "call", emoji: "📞", text: "먼저 전화한다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { happy: +14, social: +6 }, narrative: "수화기 너머 목소리가 떨렸다. '나도 미안했어.'", flag: { remove: ["kid_rift", "sibling_rift"], add: ["reconciled"] } },
          { chance: 0.3, effects: { happy: -3 }, narrative: "받지 않았다. 그래도 마음은 전해졌을 거라 믿는다." },
        ] },
      { id: "letter", emoji: "✉️", text: "편지를 남긴다", grade: "good", effects: { happy: +6 }, flag: { add: ["reconciled"] }, narratives: ["'내가 떠난 뒤에 열어 보렴.'"] },
      { id: "no", emoji: "🧱", text: "그냥 둔다", grade: "mid", effects: { happy: -4 } },
    ],
  }),
  E({
    id: "v2_centenarian", stage: "elder", age: [97, 104], emoji: "📰", title: "백 세 인터뷰",
    desc: "지역 신문 기자가 찾아왔다. '장수 비결이 뭔가요?'", weight: 3,
    flagBanned: ["interviewed"],
    choices: [
      { id: "eat", emoji: "🍚", text: "삼시 세끼 꼬박꼬박", grade: "good", effects: { happy: +6, social: +4 }, flag: { add: ["interviewed"] }, narratives: ["기사 제목: '밥심으로 백 년'."] },
      { id: "laugh", emoji: "😂", text: "많이 웃는 것", grade: "good", effects: { happy: +8 }, flag: { add: ["interviewed"] }, narratives: ["기자도 따라 웃었다. 사진 속 얼굴이 환하다."] },
      { id: "secret", emoji: "🤫", text: "비밀이다", grade: "mid", effects: { luck: +6, internet: +4 }, flag: { add: ["interviewed"] }, narratives: ["'비밀이라는 백세 노인' 기사가 인터넷에서 화제가 됐다."] },
    ],
  }),
  E({
    id: "v2_elder_day", repeat: 3, stage: "elder", age: [80, 110], emoji: "☀️", title: "볕 좋은 오후",
    desc: "오늘은 몸이 가볍다. 무엇을 할까?", weight: 1,
    choices: [
      { id: "walk", emoji: "🚶", text: "동네 한 바퀴", grade: "good", effects: { health: +3, happy: +3 } },
      { id: "family", emoji: "📞", text: "가족에게 전화", grade: "good", effects: { happy: +5, social: +3 }, narratives: ["'밥은 먹었니?' 평생 해 온 말이 오늘도 제일 중요하다."] },
      { id: "album", emoji: "📸", text: "사진첩 정리", grade: "good", effects: { happy: +4, intel: +2 }, narratives: ["사진 뒤에 이름과 날짜를 적었다. 언젠가 누군가 볼 테니."] },
    ],
  }),
  E({
    id: "v2_hospital_bed", stage: "elder", age: [82, 110], emoji: "🛏️", title: "병상에서",
    desc: "기운이 많이 떨어졌다. 의사가 가족들을 불렀다.", weight: 2.5,
    cond: p => p.stats.health < 30,
    choices: [
      { id: "fight", emoji: "💪", text: "아직 할 일이 남았다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { health: +12, happy: +4 }, narrative: "기적처럼 털고 일어났다. 의사가 고개를 저었다(좋은 의미로)." },
          { chance: 0.5, effects: {}, narrative: "마지막 순간까지 의연했다.", death: "natural" },
        ] },
      { id: "peace", emoji: "🕊️", text: "편안하게 받아들인다", grade: "good", effects: { happy: +8 },
        outcomes: [
          { chance: 0.35, effects: { health: +6 }, narrative: "마음이 편해지자 오히려 기운이 돌았다." },
          { chance: 0.65, effects: {}, narrative: "가족들의 손을 하나씩 잡아 주고, 편안히 잠들었다.", death: "natural" },
        ] },
      { id: "words", emoji: "💬", text: "가족에게 마지막 말을 남긴다", grade: "good", effects: { happy: +6, social: +4 },
        outcomes: [
          { chance: 0.3, effects: { health: +4 }, narrative: "말을 남기고 나니 며칠 더 기운이 났다. 덤으로 받은 시간이다." },
          { chance: 0.7, effects: {}, narrative: "'잘 살았다. 고마웠다.' 그게 마지막 말이었다.", death: "natural" },
        ] },
    ],
  }),

  // ===================== 노년·황혼 보강 =====================
  E({
    id: "v2_late_romance", repeat: 6, stage: "senior", age: [62, 79], emoji: "🌹", title: "황혼의 설렘",
    desc: "노인복지관 탁구 모임에 늘 먼저 와 있는 사람이 있다. 오늘은 커피를 두 잔 뽑아 왔다.", weight: 1.4,
    married: false, relationRequired: { noRomance: true },
    choices: [
      { id: "accept", emoji: "☕", text: "고맙게 받아 마신다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +12, health: +3, social: +5 }, narrative: "매주 화요일이 기다려진다. 이 나이에도 가슴이 뛴다.", relation: { romance: true } },
          { chance: 0.4, effects: { happy: +5, social: +4 }, narrative: "좋은 탁구 친구가 생겼다. 그걸로 충분하다.", relation: { friend: "탁구 친구", delta: +35 } },
        ] },
      { id: "shy", emoji: "🙈", text: "괜히 쑥스러워 피한다", grade: "mid", effects: { happy: -2 }, narratives: ["집에 와서 하루 종일 그 커피 생각을 했다."] },
      { id: "kids_no", emoji: "📵", text: "자식들 눈치가 보인다", grade: "mid", hasKid: true, effects: { happy: -4, social: -1 }, narratives: ["'이 나이에 무슨 연애야' 소리를 들을까 봐 그만뒀다."] },
    ],
  }),
  E({
    id: "v2_senior_job", stage: "senior", age: [62, 74], emoji: "🦺", title: "노인 일자리",
    desc: "주민센터에 노인 일자리 공고가 붙었다. 하루 3시간, 한 달 30만 원.", weight: 1.2,
    cond: p => !p.job,
    choices: [
      { id: "guide", emoji: "🚸", text: "등굣길 교통 지도", grade: "good", effects: { happy: +6, social: +5, money: +360, health: +2 }, narratives: ["아이들이 꾸벅 인사하고 지나간다. 하루가 환해진다."] },
      { id: "library", emoji: "📚", text: "작은 도서관 정리", grade: "good", effects: { intel: +4, happy: +4, money: +360 }, narratives: ["반납된 동화책을 꽂다가 옛날 생각이 났다."] },
      { id: "rest", emoji: "🛋️", text: "일은 할 만큼 했다", grade: "mid", effects: { happy: +2, health: -1 } },
    ],
  }),
  E({
    id: "v2_separation", stage: "senior", age: [62, 80], emoji: "🏠", title: "졸혼 이야기",
    desc: "{spouse}가 말했다. '이혼은 말고… 각자 살고 싶은 대로 살아 보면 어때?'", weight: 0.9,
    married: true, cond: p => p.spouse && p.spouse.bond < 55,
    choices: [
      { id: "ok", emoji: "🤝", text: "좋아, 따로 또 같이", grade: "mid", effects: { happy: +5, money: -1500 }, life: { bond: +6 }, flag: { add: ["sep_living"] }, narratives: ["주말에만 만나 밥을 먹는다. 오히려 사이가 좋아졌다."] },
      { id: "no", emoji: "🙅", text: "같이 늙어 가자", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +4 }, narrative: "{spouse}가 웃으며 손을 잡았다. '그래, 그러자.'", life: { bond: +12 } },
          { chance: 0.5, effects: { happy: -6 }, narrative: "대화는 거기서 끝났다. 냉랭한 겨울이 지나갔다.", life: { bond: -10 } },
        ] },
    ],
  }),
  E({
    id: "v2_grandkid_wedding", stage: "elder", age: [80, 100], emoji: "💐", title: "손주의 결혼식",
    desc: "손주가 청첩장을 들고 왔다. '꼭 맨 앞에 앉아 주세요.'", weight: 2,
    flagRequired: ["grandparent"], flagBanned: ["grandkid_wed"],
    choices: [
      { id: "go", emoji: "👔", text: "제일 좋은 옷을 입고 간다", grade: "good", effects: { happy: +12, social: +4, health: -2 }, flag: { add: ["grandkid_wed"] }, narratives: ["식장 맨 앞줄에서 손주의 뒷모습을 봤다. 언제 이렇게 컸나."] },
      { id: "speech", emoji: "🎤", text: "축사를 한다", grade: "crit", effects: { happy: +15, social: +6 }, flag: { add: ["grandkid_wed"] }, narratives: ["떨리는 목소리로 세 문장을 말했다. 하객 모두가 울었다."] },
      { id: "video", emoji: "📱", text: "몸이 힘들어 영상 축하", grade: "mid", effects: { happy: +5, internet: +3 }, flag: { add: ["grandkid_wed"] }, narratives: ["영상 속 손주가 화면에 대고 큰절을 했다."] },
    ],
  }),
  E({
    id: "v2_great_grandchild", stage: "elder", age: [82, 105], emoji: "👶", title: "증손주",
    desc: "증손주가 태어났다. 4대가 한 장의 사진에 들어갈 수 있게 됐다.", weight: 2,
    flagRequired: ["grandkid_wed"], flagBanned: ["great_grand"],
    choices: [
      { id: "hold", emoji: "🤲", text: "조심스럽게 안아 본다", grade: "crit", effects: { happy: +16, health: +2 }, flag: { add: ["great_grand"] }, narratives: ["그 작은 손이 내 주름진 손가락을 꼭 쥐었다. 인생이 한 바퀴 더 돌았다."] },
      { id: "photo", emoji: "📸", text: "4대 가족사진을 찍는다", grade: "good", effects: { happy: +12, social: +4 }, flag: { add: ["great_grand"] }, narratives: ["사진관 주인이 '이런 사진은 처음 찍어 봐요'라고 했다."] },
    ],
  }),
  E({
    id: "v2_palsun", stage: "elder", age: [80, 81], emoji: "🎊", title: "팔순 잔치",
    desc: "여든 살 생일. 가족들이 잔치를 하자고 한다.", weight: 5,
    flagBanned: ["palsun"],
    choices: [
      { id: "big", emoji: "🎉", text: "온 동네 다 부른다", grade: "good", effects: { happy: +10, social: +8, money: -500 }, flag: { add: ["palsun"] }, narratives: ["트로트 메들리를 세 곡 연달아 불렀다. 아직 정정하다."] },
      { id: "family", emoji: "🍲", text: "가족끼리 조촐하게", grade: "good", effects: { happy: +8 }, flag: { add: ["palsun"] }, narratives: ["미역국 한 그릇이면 충분하다. 다 모였으니까."] },
      { id: "trip", emoji: "🚌", text: "효도 관광", grade: "good", effects: { happy: +9, health: -2, money: -300 }, flag: { add: ["palsun"] }, narratives: ["버스 안에서 노래 한 자락. 휴게소 호두과자는 변함없이 맛있다."] },
    ],
  }),
  E({
    id: "v2_memoir", stage: "elder", age: [80, 105], emoji: "📖", title: "회고록",
    desc: "기억이 흐려지기 전에 내 인생을 적어 두고 싶다.", weight: 1.3,
    flagBanned: ["memoir"],
    choices: [
      { id: "write", emoji: "✍️", text: "손으로 직접 쓴다", grade: "good", effects: { happy: +8, intel: +4 }, flag: { add: ["memoir"] }, narratives: ["공책 세 권을 채웠다. 첫 줄은 '나는 {age}년을 살았다.'"] },
      { id: "voice", emoji: "🎙️", text: "손주가 녹음해 준다", grade: "good", hasKid: true, effects: { happy: +9, social: +4 }, flag: { add: ["memoir"] }, narratives: ["녹음 파일이 가족 단톡방에 올라왔다. 다들 밤새 들었다고 한다."] },
      { id: "no", emoji: "🤐", text: "기억은 내 안에 둔다", grade: "mid", effects: { happy: +1 } },
    ],
  }),
  E({
    id: "v2_portrait", stage: "elder", age: [80, 105], emoji: "🖼️", title: "장수사진",
    desc: "동네 사진관이 어르신 장수사진을 무료로 찍어 준다고 한다.", weight: 1.2,
    flagBanned: ["portrait"],
    choices: [
      { id: "smile", emoji: "😁", text: "환하게 웃으며 찍는다", grade: "good", effects: { happy: +6 }, flag: { add: ["portrait"] }, narratives: ["사진 속 내가 참 잘 늙었다. 마음에 든다."] },
      { id: "dress", emoji: "👘", text: "한복 차려입고 곱게", grade: "good", effects: { happy: +7, social: +2 }, flag: { add: ["portrait"] }, narratives: ["사진관 주인이 '모델 하셔도 되겠어요'라고 했다."] },
      { id: "no", emoji: "🙅", text: "아직은 이르다", grade: "mid", effects: { happy: +2, health: +1 }, flag: { add: ["portrait"] }, narratives: ["백 살 되면 찍겠다고 했다. 다들 웃었다."] },
    ],
  }),
  E({
    id: "v2_last_friend", stage: "elder", age: [80, 105], emoji: "👴", title: "마지막 동창",
    desc: "초등학교 동창 중 살아 있는 사람이 이제 단 한 명. 그 친구에게서 전화가 왔다.", weight: 1.3,
    flagBanned: ["last_friend"],
    choices: [
      { id: "meet", emoji: "🚶", text: "지팡이 짚고 만나러 간다", grade: "good", effects: { happy: +10, health: -2, social: +4 }, flag: { add: ["last_friend"] }, narratives: ["팔십 년 전 운동장 얘기를 하다 둘 다 소리 내어 웃었다."] },
      { id: "call", emoji: "📞", text: "한 시간 통화한다", grade: "good", effects: { happy: +7 }, flag: { add: ["last_friend"] }, narratives: ["'우리 둘이 끝까지 남았네.' 수화기 너머로 웃음이 들렸다."] },
    ],
  }),
  E({
    id: "v2_old_song", repeat: 6, stage: "elder", age: [80, 110], emoji: "📻", title: "그 시절 노래",
    desc: "라디오에서 젊을 때 듣던 노래가 흘러나왔다.", weight: 1,
    choices: [
      { id: "sing", emoji: "🎵", text: "따라 부른다", grade: "good", effects: { happy: +7, health: +1 }, narratives: ["가사가 하나도 안 틀렸다. 몸이 기억한다."] },
      { id: "dance", emoji: "💃", text: "일어나 한 소절 춤춘다", grade: "good", effects: { happy: +9, power: -1 }, narratives: ["다리는 후들거렸지만 신났다. 옆에서 박수가 터졌다."] },
      { id: "cry", emoji: "😢", text: "조용히 눈물이 난다", grade: "mid", effects: { happy: +3 }, narratives: ["그 노래를 같이 듣던 사람들이 떠올랐다."] },
    ],
  }),
  E({
    id: "v2_last_wish", stage: "elder", age: [85, 110], emoji: "🌠", title: "마지막 소원",
    desc: "가족들이 물었다. '지금 제일 하고 싶은 게 뭐예요?'", weight: 1.5,
    flagBanned: ["last_wish"],
    choices: [
      { id: "together", emoji: "🍽️", text: "다 같이 밥 한 끼", grade: "good", effects: { happy: +12, social: +4 }, flag: { add: ["last_wish"] }, narratives: ["오랜만에 식탁이 꽉 찼다. 수저 소리가 음악 같았다."] },
      { id: "sea", emoji: "🌊", text: "바다가 보고 싶다", grade: "good", effects: { happy: +10, health: -3 }, flag: { add: ["last_wish"] }, narratives: ["휠체어를 밀어 준 가족 덕분에 파도 앞까지 갔다."] },
      { id: "nothing", emoji: "😌", text: "이미 다 이뤘다", grade: "crit", effects: { happy: +14 }, flag: { add: ["last_wish"] }, narratives: ["그 대답에 가족들이 한참 아무 말도 못 했다."] },
    ],
  }),
  E({
    id: "v2_pet_old", stage: "*", age: [20, 105], emoji: "🐕", title: "늙은 반려동물",
    desc: "오래 함께한 {pet}가 요즘 부쩍 잠이 많다.", weight: 1.5,
    hasPet: true, petMinAge: 11, repeat: 4,
    choices: [
      { id: "care", emoji: "🩺", text: "병원에 데려가 끝까지 돌본다", grade: "good", effects: { money: -300, happy: -4 }, life: { petFarewell: true }, narratives: ["마지막 날, 내 무릎에 머리를 기대고 잠들었다. 고마웠다, 친구야."] },
      { id: "walk", emoji: "🌳", text: "좋아하던 공원을 천천히 걷는다", grade: "good", effects: { happy: +3, health: +2 }, narratives: ["꼬리를 천천히 흔들며 걸었다. 오늘을 오래 기억할 것이다."] },
    ],
  }),
  // ----- 특별 사건 추가(2026-10-24) -----
  E({
    id: "v2_sp_classmate_ceo", stage: "midlife", age: [38, 55], emoji: "🤝", title: "동창이 회장님",
    desc: "동창회에서 만난 친구가 지금은 대기업 회장이다. 같이 일하자고 한다.", weight: 0.6, type: "special",
    choices: [
      { id: "join", emoji: "🏢", text: "제안을 받는다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { money: +3000, social: +6, happy: +6 }, grade: "crit", narrative: "임원이 됐다. 연봉 협상 자리에서 친구가 윙크했다." },
          { chance: 0.5, effects: { money: -500, happy: -5, social: -3 }, grade: "bad", narrative: "낙하산 소리를 들으며 버티다 1년 만에 그만뒀다. 전 직장으로도 못 돌아가고 우정도 끝났다." },
        ] },
      { id: "decline", emoji: "🙂", text: "친구로 남는다", grade: "good", effects: { social: +4, happy: +3 }, narratives: ["일 얘기 대신 옛날 얘기를 했다. 그날 술이 제일 맛있었다."] },
    ],
  }),
  E({
    id: "v2_sp_land", stage: "midlife", age: [40, 59], emoji: "🏗️", title: "시골 땅 재개발",
    desc: "잊고 있던 시골 땅에 신도시가 들어선다는 소식이 왔다.", weight: 0.6, type: "special",
    choices: [
      { id: "hold", emoji: "⏳", text: "끝까지 버틴다", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { money: +8000, luck: +6, happy: +8 }, grade: "crit", narrative: "보상금이 세 배로 뛰었다. 족보에 남을 결정이었다." },
          { chance: 0.45, effects: { money: +500, happy: -3, social: -4 }, grade: "mid", narrative: "사업이 늦어지며 몇 년을 마음고생했다. 보상금은 생각보다 적었고 이웃과도 틀어졌다." },
          { chance: 0.2, effects: { money: -1000, happy: -8, social: -3 }, grade: "bad", narrative: "신도시 계획이 통째로 무산됐다. 그사이 낸 세금과 소송비만 1천만 원이 남았다." },
        ] },
      { id: "sell", emoji: "💰", text: "바로 판다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { money: +2500, happy: +5 }, grade: "good", narrative: "깔끔하게 정리했다. 부모님 집 대출을 다 갚아 드렸다." },
          { chance: 0.3, effects: { money: -800, happy: -8, social: -2 }, grade: "bad", narrative: "급하게 판다는 걸 노린 기획부동산에 걸렸다. 계약금과 수수료만 날렸다." },
        ] },
    ],
  }),
  E({
    id: "v2_sp_quiz_show", stage: "midlife", age: [35, 59], emoji: "🏆", title: "퀴즈 프로그램 출연",
    desc: "퀴즈 프로그램 예선을 통과했다. 마지막 문제, 상금이 걸려 있다.", weight: 0.6, type: "special",
    choices: [
      { id: "answer", emoji: "💡", text: "확신을 갖고 답한다", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { money: +5000, intel: +6, happy: +10, social: +5 }, grade: "crit", narrative: "정답! 우승 상금 5천만 원. 동네에 현수막이 걸렸다." },
          { chance: 0.65, effects: { intel: +3, happy: -3, internet: +4, money: -50 }, grade: "bad", narrative: "한 글자 차이로 틀렸다. 준비하느라 쓴 책값·교통비·연차만 남았다. 그 문제는 평생 잊지 못한다." },
        ] },
      { id: "stop", emoji: "🛑", text: "여기서 멈추고 상금을 챙긴다", grade: "good", effects: { money: +1000, happy: +4 }, narratives: ["1천만 원을 들고 내려왔다. 마지막 문제 답은 알고 있었다. 비밀이다."] },
    ],
  }),
  E({
    id: "v2_sp_senior_model", stage: "senior", age: [60, 79], emoji: "👗", title: "시니어 모델 데뷔",
    desc: "손주가 몰래 보낸 사진으로 시니어 모델 제안이 왔다.", weight: 0.6, type: "special",
    choices: [
      { id: "walk", emoji: "🚶", text: "런웨이에 선다", grade: "mid",
        outcomes: [
          { chance: 0.4, effects: { social: +10, internet: +10, happy: +10, money: +500 }, grade: "crit", narrative: "패션위크 런웨이에 섰다. 잡지 표지에 '나이는 숫자'라고 실렸다." },
          { chance: 0.6, effects: { social: +5, happy: +6, health: +2 }, grade: "good", narrative: "광고 두 편을 찍었다. 경로당에서 사인을 해 줬다." },
        ] },
      { id: "no", emoji: "😊", text: "손주에게 고맙다고만 한다", grade: "mid", effects: { happy: +3 }, narratives: ["사진은 액자에 넣었다. 그걸로 충분했다."] },
    ],
  }),
  E({
    id: "v2_sp_silver_youtube", stage: "senior", age: [62, 79], emoji: "📹", title: "손주와 유튜브",
    desc: "손주가 '할머니·할아버지 요리 채널'을 같이 하자고 조른다.", weight: 0.6, type: "special",
    choices: [
      { id: "start", emoji: "🍲", text: "같이 찍는다", grade: "mid",
        outcomes: [
          { chance: 0.3, effects: { internet: +15, money: +1000, happy: +10, social: +6 }, grade: "crit", narrative: "구독자 100만! 실버 버튼을 받았다. 레시피 책도 나왔다." },
          { chance: 0.7, effects: { internet: +5, happy: +7, social: +4, money: -100 }, grade: "good", narrative: "조명·카메라 장비값만 100만 원. 구독자는 300명이지만 손주와 매주 만나는 핑계가 생겼다." },
        ] },
      { id: "teach", emoji: "📖", text: "카메라 없이 요리만 가르친다", grade: "good", effects: { happy: +5, social: +3 }, narratives: ["손주가 내 김치 맛을 그대로 배웠다. 그게 진짜 유산이다."] },
    ],
  }),
  E({
    id: "v2_sp_memoir", stage: "elder", age: [80, 105], emoji: "📖", title: "자서전 출간 제의",
    desc: "출판사에서 내 인생 이야기를 책으로 내고 싶다고 연락이 왔다.", weight: 0.6, type: "special",
    choices: [
      { id: "write", emoji: "✍️", text: "솔직하게 다 쓴다", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { happy: +10, social: +8, money: +300, intel: +3 }, grade: "crit", narrative: "베스트셀러가 됐다. 북토크에 손주들이 맨 앞줄에 앉았다." },
          { chance: 0.65, effects: { happy: +7, intel: +3 }, grade: "good", narrative: "가족들만 읽었다. 그래도 모두가 울었다." },
        ] },
      { id: "letters", emoji: "💌", text: "책 대신 가족에게 편지를 쓴다", grade: "good", effects: { happy: +6, social: +4 }, narratives: ["한 사람 한 사람에게 편지를 남겼다. 가장 소중한 책이 됐다."] },
    ],
  }),
  E({
    id: "v2_sp_first_love", stage: "elder", age: [80, 105], emoji: "🌸", title: "첫사랑의 편지",
    desc: "60년 만에 첫사랑에게서 편지가 왔다. '아직 그 노래를 기억하나요?'", weight: 0.6, type: "special",
    choices: [
      { id: "meet", emoji: "☕", text: "만나러 간다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +12, health: +2 }, grade: "crit", narrative: "둘 다 그 노래를 끝까지 불렀다. 찻잔이 식는 줄도 몰랐다." },
          { chance: 0.4, effects: { happy: +5, intel: +2 }, grade: "good", narrative: "서로 너무 변해 있었다. 그래도 웃으며 헤어졌다." },
        ] },
      { id: "reply", emoji: "✉️", text: "답장만 보낸다", grade: "good", effects: { happy: +7 }, narratives: ["'기억해요.' 그 한 줄을 쓰는 데 한 시간이 걸렸다."] },
    ],
  }),
  // ----- 특별 사건 2차(2026-10-24) -----
  E({
    id: "v2_sp_hole_in_one", stage: "midlife", age: [40, 59], emoji: "⛳", title: "홀인원",
    desc: "거래처 골프 모임. 7번 홀, 공이 그대로 컵으로 굴러간다…!", weight: 0.5, type: "special",
    choices: [
      { id: "celebrate", emoji: "🍾", text: "관례대로 크게 한턱낸다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { social: +10, happy: +8, money: -300, luck: +6 }, grade: "crit", narrative: "홀인원 기념패가 사무실에 걸렸다. 거래처마다 그 이야기를 꺼냈다." },
          { chance: 0.4, effects: { social: +6, money: -500, happy: +3 }, grade: "good", narrative: "축하 비용이 생각보다 많이 나왔다. 그래도 평생 자랑거리다." },
        ] },
      { id: "humble", emoji: "🙂", text: "조용히 기념사진만 찍는다", grade: "good", effects: { luck: +5, happy: +5 }, narratives: ["사진 속 표정이 아이처럼 해맑았다."] },
    ],
  }),
  E({
    id: "v2_sp_ufo", stage: "midlife", age: [35, 59], emoji: "🛸", title: "UFO를 찍었다",
    desc: "퇴근길 밤하늘에 빛나는 물체가 지그재그로 움직인다. 휴대폰을 들었다.", weight: 0.5, type: "special",
    choices: [
      { id: "post", emoji: "📤", text: "인터넷에 올린다", grade: "mid",
        outcomes: [
          { chance: 0.3, effects: { internet: +15, social: +6, happy: +8, money: +200 }, grade: "crit", narrative: "해외 뉴스에까지 나왔다. 다큐멘터리 인터뷰를 했다." },
          { chance: 0.7, effects: { internet: +5, happy: -2 }, grade: "mid", narrative: "'드론이네요' 댓글 300개. 그래도 나는 안다." },
        ] },
      { id: "keep", emoji: "🤫", text: "혼자만의 비밀로 한다", grade: "mid", effects: { happy: +4, intel: +2 }, narratives: ["그날 이후 밤하늘을 자주 올려다보게 됐다."] },
    ],
  }),
  E({
    id: "v2_sp_late_college", stage: "senior", age: [60, 79], emoji: "🎓", title: "늦깎이 대학생",
    desc: "평생 미뤄 둔 대학 공부. 만학도 전형 합격 통지서가 왔다.", weight: 0.5, type: "special",
    choices: [
      { id: "enroll", emoji: "📚", text: "입학한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { intel: +10, social: +8, happy: +10 }, grade: "crit", narrative: "수석 졸업! 졸업식에서 손주가 꽃다발을 건넸다." },
          { chance: 0.5, effects: { intel: +6, social: +5, happy: +5, health: -2 }, grade: "good", narrative: "과제는 버거웠지만 스무 살 동기들이 '선배님'이라 불렀다." },
        ] },
      { id: "library", emoji: "📖", text: "도서관에서 혼자 공부한다", grade: "good", effects: { intel: +5, happy: +3 }, narratives: ["하루 세 시간, 평생 궁금했던 것들을 읽었다."] },
    ],
  }),
  E({
    id: "v2_sp_singing_contest", stage: "senior", age: [60, 79], emoji: "🎶", title: "전국 노래자랑",
    desc: "동네에 노래자랑 녹화가 왔다. 예심에 나가 볼까?", weight: 0.5, type: "special",
    choices: [
      { id: "sing", emoji: "🎤", text: "한 곡 뽑는다", grade: "mid",
        outcomes: [
          { chance: 0.3, effects: { happy: +12, social: +10, internet: +8, money: +100 }, grade: "crit", narrative: "인기상을 탔다. 사회자와 덩실덩실 춤춘 장면이 화제가 됐다." },
          { chance: 0.5, effects: { happy: +7, social: +5 }, grade: "good", narrative: "'땡'은 받았지만 객석이 제일 크게 웃었다." },
          { chance: 0.2, effects: { happy: -3, health: -1 }, grade: "mid", narrative: "긴장해서 가사를 잊었다. 그래도 끝까지 웃었다." },
        ] },
      { id: "cheer", emoji: "👏", text: "객석에서 응원한다", grade: "good", effects: { happy: +5, social: +3 }, narratives: ["카메라에 박수 치는 모습이 잡혔다. 가족 단톡방이 난리가 났다."] },
    ],
  }),
  E({
    id: "v2_sp_time_capsule", stage: "elder", age: [80, 105], emoji: "⏳", title: "60년 전 타임캡슐",
    desc: "모교 공사 중에 초등학교 때 묻은 타임캡슐이 나왔다. 내 편지도 있다.", weight: 0.5, type: "special",
    choices: [
      { id: "read", emoji: "📜", text: "동창들과 함께 연다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +12, social: +8 }, grade: "crit", narrative: "'꿈을 이뤘나요?' 어린 내가 묻고 있었다. 다 같이 울고 웃었다." },
          { chance: 0.4, effects: { happy: +6, social: +4 }, grade: "good", narrative: "나온 동창은 셋뿐이었다. 그래서 더 소중했다." },
        ] },
      { id: "alone", emoji: "🕯️", text: "혼자 조용히 읽는다", grade: "good", effects: { happy: +8, intel: +2 }, narratives: ["삐뚤빼뚤한 글씨를 한참 쓰다듬었다. 그 아이에게 답장을 썼다."] },
    ],
  }),
  E({
    id: "v2_sp_great_grandchild", stage: "elder", age: [80, 105], emoji: "👶", title: "증손주가 태어났다",
    desc: "증손주가 태어났다는 소식이 왔다. 4대가 한자리에 모인다.", weight: 0.5, type: "special", hasKid: true,
    choices: [
      { id: "hold", emoji: "🤱", text: "직접 안아 본다", grade: "mid",
        outcomes: [
          { chance: 0.7, effects: { happy: +14, health: +2 }, grade: "crit", narrative: "작은 손가락이 내 손가락을 꽉 쥐었다. 4대 가족사진을 찍었다." },
          { chance: 0.3, effects: { happy: +8 }, grade: "good", narrative: "팔이 떨려 금방 내려놓았다. 그래도 그 무게를 잊지 못한다." },
        ] },
      { id: "name", emoji: "✍️", text: "이름을 지어 준다", grade: "good", effects: { happy: +9, social: +3 }, narratives: ["며칠을 고민해 지은 이름을 가족이 그대로 썼다."] },
    ],
  }),
];
