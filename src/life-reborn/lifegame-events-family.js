// =========================
// 인생게임 v2 이벤트 — 연애·결혼·출산·육아·부모님·이혼·사별 (money=만원)
// 결혼 상태: life.marry / divorce / widow, 자녀: life.child. 이벤트 조건: married:true|false, hasKid
// =========================
const E = o => ({ v: 2, type: "normal", ...o });
const kidAge = p => p.kids.length ? p.age - p.kids[0].born : -1;

export const EVENTS_FAMILY = [
  // ===================== 연애 =====================
  E({
    id: "v2_blind_date", repeat: 3, stage: "adult", age: [22, 38], emoji: "☕", title: "소개팅 제안",
    desc: "친구가 '진짜 괜찮은 사람 있다'며 사진을 보여 준다.", weight: 3,
    married: false, relationRequired: { noRomance: true }, flagBanned: ["no_marriage"],
    choices: [
      { id: "go", emoji: "😊", text: "만나 본다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, social: +4 }, narrative: "세 시간이 30분처럼 지나갔다. 다음 약속을 잡았다.", relation: { romance: true }, flag: { add: ["dating"] } },
          { chance: 0.5, effects: { happy: -3, money: -10 }, narrative: "파스타값만 나갔다. 대화가 끊길 때마다 물을 마셨다." },
        ] },
      { id: "app", emoji: "📲", text: "차라리 데이팅 앱", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { happy: +8, internet: +3 }, narrative: "매칭된 사람과 대화가 잘 통했다. 실제로도 좋았다.", relation: { romance: true }, flag: { add: ["dating"] } },
          { chance: 0.65, effects: { happy: -4, internet: +4 }, narrative: "사진과 다른 사람이 나왔다. 서로." },
        ] },
      { id: "no", emoji: "🙅", text: "지금은 혼자가 편하다", grade: "mid", effects: { happy: +2, intel: +2 }, narratives: ["주말에 혼자 영화를 봤다. 팝콘이 맛있었다."] },
    ],
  }),
  E({
    id: "v2_dating_trouble", repeat: 4, stage: "adult", age: [21, 40], emoji: "💬", title: "연인과의 갈등",
    desc: "{spouse}와 사소한 일로 크게 싸웠다. 연락이 끊긴 지 사흘째.",
    married: false, relationRequired: { romance: true },
    choices: [
      { id: "sorry", emoji: "🙏", text: "먼저 사과한다", grade: "good", effects: { happy: +5, social: +3 }, narratives: ["꽃을 들고 찾아갔다. 둘 다 울고 웃었다."] },
      { id: "wait", emoji: "📵", text: "연락 올 때까지 버틴다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +2 }, narrative: "결국 상대가 먼저 연락했다. 이긴 건지 모르겠다." },
          { chance: 0.5, effects: { happy: -10 }, narrative: "그대로 끝났다. 자존심이 뭐라고.", relation: { breakup: true }, flag: { remove: ["dating"] } },
        ] },
      { id: "end", emoji: "💔", text: "헤어지자", grade: "bad", effects: { happy: -8, intel: +2 }, relation: { breakup: true }, flag: { remove: ["dating"] }, narratives: ["사진첩을 정리하는 데 한 달이 걸렸다."] },
    ],
  }),
  E({
    id: "v2_propose", repeat: 3, stage: "*", age: [24, 50], emoji: "💍", title: "결혼 이야기",
    desc: "{spouse}와 만난 지 몇 년. 친구들이 '언제 국수 먹여 주냐'고 묻는다.", weight: 6,
    married: false, relationRequired: { romance: true }, flagBanned: ["no_marriage"],
    choices: [
      { id: "propose", emoji: "💍", text: "반지를 준비한다", grade: "crit",
        outcomes: [
          { chance: 0.8, effects: { happy: +14, social: +5, money: -400 }, narrative: "\"응.\" 그 한 마디에 세상이 환해졌다.", life: { marry: true } },
          { chance: 0.2, effects: { happy: -18, social: -4, money: -400 }, narrative: "\"미안해, 난 아직...\" 반지는 서랍에 남았다.", relation: { breakup: true } },
        ] },
      { id: "later", emoji: "⏳", text: "돈 모으고 나중에", grade: "mid", effects: { money: +300, happy: -2 }, narratives: ["'나중에'가 몇 번째인지 모르겠다고 상대가 말했다."] },
      { id: "nomarry", emoji: "🏡", text: "결혼 대신 오래 함께", sub: "비혼 동거", grade: "mid", effects: { happy: +6, money: +200 }, flag: { add: ["cohabit", "no_marriage"] }, narratives: ["서류는 없어도 함께 장을 보고 함께 늙어 간다."] },
    ],
  }),
  E({
    id: "v2_wedding", stage: "*", age: [24, 55], emoji: "👰", title: "결혼식 준비",
    desc: "{spouse}와 결혼한다! 그런데 예식장 견적서를 보니 숫자가 어지럽다.", weight: 8,
    married: true, flagBanned: ["wedding_done"],
    choices: [
      { id: "big", emoji: "💒", text: "호텔 예식", sub: "약 8,000만원", grade: "mid", effects: { money: -8000, happy: +8, social: +6 }, flag: { add: ["wedding_done"] }, life: { bond: +3 }, narratives: ["샹들리에 아래 하객 400명. 축의금으로 절반은 돌아왔다.", "인생 사진을 건졌다. 카드값은 1년 동안 갚았다."] },
      { id: "normal", emoji: "⛪", text: "일반 예식장", sub: "약 3,000만원", grade: "good", effects: { money: -3000, happy: +6, social: +4 }, flag: { add: ["wedding_done"] }, narratives: ["뷔페가 맛있었다고 다들 칭찬했다. 그거면 됐다."] },
      { id: "small", emoji: "🌿", text: "스몰웨딩", sub: "약 800만원", grade: "good", effects: { money: -800, happy: +7 }, flag: { add: ["wedding_done"] }, life: { bond: +5 }, narratives: ["가족과 가장 친한 친구들만. 모두가 울었다."] },
      { id: "none", emoji: "📝", text: "혼인신고만", grade: "mid", effects: { money: +500, happy: +2, social: -3 }, flag: { add: ["wedding_done"] }, narratives: ["구청에서 서류를 내고 짜장면을 먹었다. 소박해서 오래 기억난다."] },
    ],
  }),
  E({
    id: "v2_newlywed_home", stage: "*", age: [24, 55], emoji: "🏠", title: "신혼집",
    desc: "신혼집을 구해야 한다. 서울 아파트 시세를 보고 둘 다 말이 없어졌다.", weight: 4,
    married: true, flagBanned: ["home_decided"],
    choices: [
      { id: "buy", emoji: "🏢", text: "영끌해서 아파트 매매", sub: "대출 3억", grade: "mid", effects: { money: -3000, happy: +6 }, life: { housing: "own" }, flag: { add: ["home_decided", "homeowner", "mortgage"] },
        outcomes: [
          { chance: 0.55, effects: { money: +15000 }, narrative: "몇 년 뒤 집값이 올랐다. 그 시절 결단에 건배.", grade: "crit" },
          { chance: 0.45, effects: { happy: -6, health: -2 }, narrative: "금리가 올랐다. 월급의 절반이 이자로 나간다.", grade: "bad" },
        ] },
      { id: "jeonse", emoji: "📄", text: "전세로 시작", grade: "good", effects: { money: -500, happy: +3 }, life: { housing: "jeonse" }, flag: { add: ["home_decided"] }, narratives: ["2년마다 이사를 걱정하지만 아직은 괜찮다."] },
      { id: "parents", emoji: "👵", text: "양가 부모님 집 근처 빌라", grade: "mid", effects: { money: +300, happy: -2, social: +3 }, life: { housing: "rent" }, flag: { add: ["home_decided"] }, narratives: ["반찬은 해결됐다. 사생활은 조금 포기했다."] },
    ],
  }),
  E({
    id: "v2_baby_plan", repeat: 3, stage: "*", age: [25, 44], emoji: "🍼", title: "아이 계획",
    desc: "{spouse}가 조심스럽게 물었다. '우리… 아이 가질까?'", weight: 5,
    married: true, hasKid: false, flagBanned: ["childfree"],
    choices: [
      { id: "yes", emoji: "👶", text: "갖자", grade: "crit",
        outcomes: [
          { chance: 0.75, effects: { happy: +14, money: -400, health: -2 }, narrative: "작은 심장 소리를 처음 들었다. 열 달 뒤, {kid}가 태어났다.", life: { child: 1, bond: +5 }, route: "parent" },
          { chance: 0.25, effects: { happy: -8, money: -800 }, narrative: "쉽게 찾아오지 않았다. 병원을 다니며 기다리기로 했다.", flag: { add: ["infertility"] } },
        ] },
      { id: "later", emoji: "⏰", text: "몇 년 뒤에", grade: "mid", effects: { money: +400, happy: +1 }, narratives: ["둘만의 시간을 조금 더 즐기기로 했다."] },
      { id: "childfree", emoji: "🐕", text: "우리 둘이면 충분해", sub: "딩크", grade: "mid", effects: { happy: +5, money: +800 }, flag: { add: ["childfree"] }, life: { pet: { kind: "dog", name: "두부" } }, narratives: ["강아지를 입양했다. 이름은 '두부'.", "주말마다 여행을 다녔다."] },
    ],
  }),
  E({
    id: "v2_ivf", repeat: 2, stage: "*", age: [28, 46], emoji: "🏥", title: "난임 병원",
    desc: "주사, 대기실, 결과 전화. 몇 번째 시도인지 세지 않기로 했다.", weight: 2,
    married: true, hasKid: false, flagRequired: ["infertility"],
    choices: [
      { id: "again", emoji: "🙏", text: "한 번 더 시도한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +18, money: -500 }, narrative: "양성. 두 줄을 보고 둘이 부둥켜 울었다.", life: { child: 1, bond: +8 }, flag: { remove: ["infertility"] }, route: "parent" },
          { chance: 0.5, effects: { happy: -10, health: -4, money: -500 }, narrative: "이번에도 아니었다. 서로의 손을 꼭 잡았다." },
        ] },
      { id: "adopt", emoji: "🤲", text: "입양을 알아본다", grade: "good", effects: { happy: +12, money: -300, social: +4 }, life: { child: 1, bond: +6 }, flag: { remove: ["infertility"], add: ["adopted_child"] }, narratives: ["처음 만난 날, 아이가 내 손가락을 쥐었다. 가족이 됐다."] },
      { id: "stop", emoji: "🌅", text: "그만하고 둘이 살자", grade: "mid", effects: { happy: +2, health: +3 }, flag: { remove: ["infertility"], add: ["childfree"] }, life: { bond: +4 }, narratives: ["슬펐지만 홀가분했다. 서로가 있으니까."] },
    ],
  }),
  E({
    id: "v2_second_child", repeat: 3, stage: "*", age: [28, 44], emoji: "👨‍👩‍👧‍👦", title: "둘째 고민",
    desc: "{kid}가 '동생 낳아 줘'라고 졸랐다. 통장 잔고를 떠올렸다.", weight: 1.6,
    married: true, hasKid: true, cond: p => p.kids.length === 1 && kidAge(p) >= 2,
    choices: [
      { id: "yes", emoji: "👶", text: "둘째를 갖는다", grade: "good", effects: { happy: +10, money: -500, health: -2 }, life: { child: 1 }, narratives: ["집이 두 배로 시끄러워졌다. 두 배로 웃는다."] },
      { id: "no", emoji: "✋", text: "하나만 잘 키우자", grade: "mid", effects: { money: +500 }, narratives: ["{kid}에게 사랑을 몰아줬다."] },
      { id: "twins", emoji: "🎲", text: "하늘에 맡긴다", grade: "mid",
        outcomes: [
          { chance: 0.15, effects: { happy: +15, money: -1500, health: -5 }, narrative: "쌍둥이였다!!! 기저귀를 박스째 샀다.", life: { child: 2 } },
          { chance: 0.45, effects: { happy: +10, money: -500 }, narrative: "둘째가 찾아왔다.", life: { child: 1 } },
          { chance: 0.4, effects: { happy: +1 }, narrative: "인연이 아니었나 보다. 그래도 지금이 좋다." },
        ] },
    ],
  }),
  E({
    id: "v2_parental_leave", repeat: 4, stage: "*", age: [25, 46], emoji: "🧸", title: "육아휴직",
    desc: "아이가 어리다. 둘 중 누가 휴직할지 정해야 한다.", weight: 2.2,
    married: true, hasKid: true, cond: p => kidAge(p) <= 2 && !!p.job,
    choices: [
      { id: "me", emoji: "🙋", text: "내가 쉰다", grade: "good", effects: { happy: +8, money: -1200, social: -2 }, life: { bond: +8 }, narratives: ["{kid}의 첫 걸음을 직접 봤다. 그 장면을 평생 잊지 못할 것이다."] },
      { id: "spouse", emoji: "🤝", text: "{spouse}가 쉰다", grade: "mid", effects: { money: -600, happy: +2 }, life: { bond: +2 }, narratives: ["퇴근하고 오면 지친 얼굴이 기다린다. 주말 육아는 내가 맡았다."] },
      { id: "grandma", emoji: "👵", text: "할머니 찬스", grade: "mid", effects: { money: -300, happy: +2 }, narratives: ["할머니가 매일 오셨다. 아이가 할머니 사투리를 쓴다."] },
    ],
  }),
  E({
    id: "v2_couple_fight", repeat: 6, stage: "*", age: [28, 70], emoji: "⚡", title: "부부싸움",
    desc: "설거지에서 시작해 10년 전 일까지 나왔다. 오늘따라 {spouse}가 낯설다.", weight: 1.3,
    married: true,
    choices: [
      { id: "talk", emoji: "🗣️", text: "밤새 이야기한다", grade: "good", effects: { happy: +4, social: +2 }, life: { bond: +6 }, narratives: ["새벽 세 시, 둘 다 웃고 있었다. 이게 부부인가 보다."] },
      { id: "silent", emoji: "🧊", text: "냉전 돌입", grade: "bad", effects: { happy: -6, health: -2 }, life: { bond: -8 }, narratives: ["일주일 동안 카톡으로만 대화했다. 같은 집에서."] },
      { id: "counsel", emoji: "🧑‍⚕️", text: "부부 상담을 받는다", grade: "good", effects: { money: -100, happy: +3 }, life: { bond: +10 }, narratives: ["몰랐던 서로의 상처를 알게 됐다."] },
      { id: "out", emoji: "🍶", text: "친구 불러 술 마신다", grade: "mid", effects: { social: +3, health: -2, happy: +1 }, life: { bond: -3 }, narratives: ["친구가 '너도 잘한 거 없다'고 했다."] },
    ],
  }),
  E({
    id: "v2_divorce_crisis", stage: "*", age: [30, 75], emoji: "📄", title: "이혼 서류",
    desc: "{spouse}가 테이블 위에 서류를 올려놓았다. 오래 고민한 얼굴이다.", weight: 3,
    married: true, cond: p => p.spouse && p.spouse.bond < 35,
    choices: [
      { id: "sign", emoji: "✍️", text: "도장을 찍는다", grade: "bad", effects: { happy: -10, money: -4000, social: -3 }, life: { divorce: true }, narratives: ["재산을 나눴다. 추억은 나눌 수 없었다."] },
      { id: "hold", emoji: "🙏", text: "한 번만 기회를 달라", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +6 }, narrative: "다시 해 보기로 했다. 매주 금요일은 둘만의 저녁.", life: { bond: +25 } },
          { chance: 0.5, effects: { happy: -12, money: -4000 }, narrative: "이미 늦었다. 결국 각자의 길로.", life: { divorce: true } },
        ] },
      { id: "kids", emoji: "🧒", text: "아이들 다 클 때까지만", grade: "mid", effects: { happy: -5 }, life: { bond: +8 }, narratives: ["한 지붕 아래 룸메이트처럼 살기로 했다."] },
    ],
  }),
  E({
    id: "v2_remarry", repeat: 6, stage: "*", age: [35, 80], emoji: "🌷", title: "다시 찾아온 인연",
    desc: "동호회에서 만난 사람이 자꾸 생각난다. 이 나이에 설렘이라니.", weight: 1.4,
    married: false, flagRequired: [], cond: p => p.flags.has("divorced") || p.flags.has("widowed"),
    choices: [
      { id: "date", emoji: "💐", text: "용기 내 본다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +14, social: +5 }, narrative: "두 번째 봄이 왔다. 이번엔 서두르지 않았다.", life: { marry: true, bond: 75 }, flag: { add: ["remarried"] } },
          { chance: 0.4, effects: { happy: -4 }, narrative: "좋은 친구로 남기로 했다.", relation: { friend: "동호회 친구", delta: +30 } },
        ] },
      { id: "alone", emoji: "🍵", text: "혼자가 편하다", grade: "mid", effects: { happy: +3, intel: +2 }, narratives: ["혼자 마시는 차도 따뜻하다."] },
    ],
  }),
  E({
    id: "v2_single_life", repeat: 5, stage: "*", age: [36, 48], emoji: "🧳", title: "결혼 안 해?",
    desc: "명절마다 듣는 질문. 올해도 친척들이 묻는다.", weight: 1.3,
    married: false, relationRequired: { noRomance: true }, cond: p => !p.flags.has("divorced") && !p.flags.has("widowed"),
    choices: [
      { id: "free", emoji: "🗽", text: "혼자 사는 게 행복하다고 답한다", grade: "good", effects: { happy: +6, money: +500 }, flag: { add: ["no_marriage"] }, narratives: ["나만의 루틴, 나만의 집, 나만의 여행. 충분히 좋다."] },
      { id: "try", emoji: "💌", text: "결혼정보회사에 가입한다", grade: "mid", effects: { money: -300 },
        outcomes: [
          { chance: 0.5, effects: { happy: +10 }, narrative: "조건 말고 웃음이 맞는 사람을 만났다.", relation: { romance: true } },
          { chance: 0.5, effects: { happy: -5 }, narrative: "내가 '상품'이 된 것 같았다. 탈퇴했다." },
        ] },
      { id: "pet", emoji: "🐈", text: "고양이를 들인다", grade: "good", effects: { happy: +8, money: -150 }, flag: { add: ["adopted_pet", "pet_lover"] }, life: { pet: { kind: "cat", startAge: 2 } }, narratives: ["퇴근하면 반겨 주는 존재가 생겼다. 집사의 삶."] },
    ],
  }),

  // ===================== 자녀 키우기 =====================
  E({
    id: "v2_kid_school", stage: "*", age: [30, 60], emoji: "🎒", title: "{kid} 입학",
    desc: "{kid}가 초등학교에 들어간다. 학군지로 이사 가야 한다는 말이 들린다.", weight: 3,
    hasKid: true, cond: p => { const a = kidAge(p); return a >= 6 && a <= 8; }, flagBanned: ["kid_school_done"],
    choices: [
      { id: "daechi", emoji: "🏙️", text: "학군지로 이사", grade: "mid", effects: { money: -2500, happy: -2 }, flag: { add: ["kid_school_done", "edu_parent"] }, narratives: ["학원 셔틀이 동네를 메웠다. {kid}는 친구를 금방 사귀었다."] },
      { id: "stay", emoji: "🏡", text: "지금 동네에서 자유롭게", grade: "good", effects: { happy: +4 }, flag: { add: ["kid_school_done"] }, narratives: ["{kid}는 학교 끝나면 놀이터로 직행한다."] },
      { id: "alt", emoji: "🌳", text: "대안학교", grade: "mid", effects: { money: -1200, happy: +3 }, flag: { add: ["kid_school_done"] }, narratives: ["{kid}가 텃밭에서 상추를 길러 왔다."] },
    ],
  }),
  E({
    id: "v2_kid_teen", stage: "*", age: [38, 65], emoji: "🎧", title: "{kid}의 사춘기",
    desc: "{kid}가 방문을 잠그기 시작했다. 대화는 '몰라', '됐어' 두 마디.", weight: 2.5,
    hasKid: true, cond: p => { const a = kidAge(p); return a >= 13 && a <= 16; },
    choices: [
      { id: "wait", emoji: "⏳", text: "기다려 준다", grade: "good", effects: { happy: +2, intel: +2 }, narratives: ["어느 날 {kid}가 먼저 '배고파'라고 말했다. 눈물이 날 뻔했다."] },
      { id: "strict", emoji: "📏", text: "규칙을 엄하게", grade: "mid", effects: { happy: -4 }, life: { bond: -2 }, narratives: ["성적은 올랐지만 집이 조용해졌다."] },
      { id: "trip", emoji: "🏕️", text: "둘이 캠핑을 간다", grade: "good", effects: { happy: +6, money: -100, health: +2 }, narratives: ["모닥불 앞에서 {kid}가 처음으로 고민을 털어놨다."] },
    ],
  }),
  E({
    id: "v2_kid_college", stage: "*", age: [42, 70], emoji: "🎓", title: "{kid} 입시",
    desc: "{kid}의 수능이 끝났다. 결과보다 그 아이의 표정이 더 신경 쓰인다.", weight: 3,
    hasKid: true, cond: p => kidAge(p) === 18 || kidAge(p) === 19, flagBanned: ["kid_college_done"],
    choices: [
      { id: "proud", emoji: "🎉", text: "어디든 잘했다고 안아 준다", grade: "good", effects: { happy: +8, money: -2000 }, flag: { add: ["kid_college_done"] }, narratives: ["{kid}가 등록금 고지서를 보고 '꼭 갚을게'라고 했다."] },
      { id: "retake", emoji: "🔁", text: "재수를 권한다", grade: "mid", effects: { money: -2500, happy: -3 }, flag: { add: ["kid_college_done"] },
        outcomes: [
          { chance: 0.5, effects: { happy: +10 }, narrative: "1년 뒤 원하던 학교에 붙었다!" },
          { chance: 0.5, effects: { happy: -5 }, narrative: "결과는 비슷했다. 그래도 {kid}는 한 뼘 자랐다." },
        ] },
      { id: "abroad", emoji: "✈️", text: "유학을 보낸다", grade: "mid", effects: { money: -8000, happy: +4 }, flag: { add: ["kid_college_done", "kid_abroad"] }, narratives: ["공항에서 손을 흔들었다. 집이 너무 넓어졌다."] },
    ],
  }),
  E({
    id: "v2_kid_wedding", stage: "*", age: [50, 85], emoji: "💐", title: "{kid}의 결혼",
    desc: "{kid}가 결혼할 사람을 데려왔다. 긴장한 얼굴이 귀엽다.", weight: 3,
    hasKid: true, cond: p => kidAge(p) >= 27 && kidAge(p) <= 40, flagBanned: ["kid_married"],
    choices: [
      { id: "bless", emoji: "🥂", text: "진심으로 축복한다", grade: "good", effects: { happy: +10, social: +4, money: -3000 }, flag: { add: ["kid_married"] }, narratives: ["식장에서 {kid}의 손을 넘겨줬다. 왜 그렇게 눈물이 나던지."] },
      { id: "house", emoji: "🏠", text: "신혼집 보태 준다", grade: "good", effects: { happy: +8, money: -10000 }, flag: { add: ["kid_married"] }, narratives: ["노후 자금이 줄었지만 {kid}의 웃음이 더 컸다."] },
      { id: "doubt", emoji: "🤨", text: "좀 더 생각해 보라고 한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: -3 }, narrative: "{kid}가 서운해했지만 결국 결혼했다. 사위·며느리와 한동안 어색했다.", flag: { add: ["kid_married"] } },
          { chance: 0.5, effects: { happy: -8, social: -3 }, narrative: "{kid}와 크게 다퉜다. 몇 달 동안 연락이 끊겼다.", flag: { add: ["kid_married", "kid_rift"] } },
        ] },
    ],
  }),
  E({
    id: "v2_grandchild", stage: "*", age: [52, 90], emoji: "👶", title: "손주가 태어났다",
    desc: "병원 신생아실 유리창 너머, 작은 얼굴이 꼼지락거린다.", weight: 3,
    hasKid: true, flagRequired: ["kid_married"], flagBanned: ["grandparent"],
    choices: [
      { id: "care", emoji: "🍼", text: "손주 육아를 돕는다", grade: "good", effects: { happy: +12, health: -3, social: +3 }, flag: { add: ["grandparent", "grand_carer"] }, narratives: ["허리가 아프다. 그런데 웃음이 멈추질 않는다."] },
      { id: "visit", emoji: "🎁", text: "주말마다 놀러 간다", grade: "good", effects: { happy: +10, money: -300 }, flag: { add: ["grandparent"] }, narratives: ["할머니·할아버지 소리에 지갑이 열린다."] },
      { id: "far", emoji: "📞", text: "영상통화로 만난다", grade: "mid", effects: { happy: +5, internet: +3 }, flag: { add: ["grandparent"] }, narratives: ["화면 너머로 '안녕' 하고 손을 흔든다."] },
    ],
  }),

  // ===================== 부모님 =====================
  E({
    id: "v2_parent_ill", stage: "*", age: [38, 62], emoji: "🏥", title: "부모님이 쓰러지셨다",
    desc: "새벽에 걸려 온 전화. 아버지가 응급실에 계신다.", weight: 2.6,
    flagBanned: ["parent_ill_done"],
    choices: [
      { id: "care", emoji: "🤲", text: "직접 간병한다", grade: "good", effects: { happy: -6, health: -5, money: -1500, social: +2 }, flag: { add: ["parent_ill_done", "filial"] }, narratives: ["병실 보조침대에서 석 달을 잤다. 아버지가 처음으로 '고맙다'고 하셨다."] },
      { id: "nurse", emoji: "🧑‍⚕️", text: "간병인을 쓴다", grade: "mid", effects: { money: -3000, happy: -2 }, flag: { add: ["parent_ill_done"] }, narratives: ["매일 퇴근 후 병원에 들렀다. 돈으로 다 되지는 않았다."] },
      { id: "sibling", emoji: "📞", text: "형제들과 나눈다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { money: -1000, social: +3 }, narrative: "돌아가며 병원을 지켰다. 오랜만에 형제들이 모였다.", flag: { add: ["parent_ill_done"] } },
          { chance: 0.5, effects: { money: -800, happy: -6, social: -4 }, narrative: "누가 더 했는지로 싸웠다. 단톡방이 조용해졌다.", flag: { add: ["parent_ill_done", "sibling_rift"] } },
        ] },
    ],
  }),
  E({
    id: "v2_parent_death", stage: "*", age: [45, 72], emoji: "🕯️", title: "부모님과의 이별",
    desc: "장례식장에 영정 사진이 걸렸다. 사진 속 엄마가 젊다.", weight: 2.4,
    flagBanned: ["orphaned"],
    choices: [
      { id: "cry", emoji: "😢", text: "실컷 운다", grade: "mid", effects: { happy: -10, social: +3 }, flag: { add: ["orphaned"] }, narratives: ["어른이 된 줄 알았는데, 그날 나는 다시 아이였다."] },
      { id: "letter", emoji: "✉️", text: "하지 못한 말을 편지로", grade: "good", effects: { happy: -6, intel: +3 }, flag: { add: ["orphaned"] }, narratives: ["관 위에 편지를 올렸다. '다음 생에도 엄마 아들·딸로.'"] },
      { id: "inherit", emoji: "📜", text: "유산 정리", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { money: +8000, happy: -6 }, narrative: "부모님이 평생 모은 돈이 통장에 들어왔다. 쓸 수가 없었다.", flag: { add: ["orphaned"] } },
          { chance: 0.4, effects: { money: +3000, happy: -12, social: -6 }, narrative: "형제끼리 유산으로 다퉜다. 부모님이 보셨으면 슬퍼하셨을 거다.", flag: { add: ["orphaned", "sibling_rift"] } },
        ] },
    ],
  }),
  E({
    id: "v2_holiday", repeat: 6, stage: "*", age: [30, 60], emoji: "🧧", title: "명절 대이동",
    desc: "고속도로 귀성길 8시간. 시댁·처가 어디부터 갈지가 문제다.", weight: 1.2,
    married: true,
    choices: [
      { id: "both", emoji: "🚗", text: "양쪽 다 들른다", grade: "mid", effects: { happy: -3, health: -2, money: -100, social: +4 }, life: { bond: +2 }, narratives: ["휴게소 호두과자로 버텼다. 효도는 체력전이다."] },
      { id: "trip", emoji: "✈️", text: "해외여행 간다", grade: "mid", effects: { happy: +8, money: -500, social: -3 }, narratives: ["공항이 명절 인파로 터질 것 같았다. 그래도 바다는 좋았다."] },
      { id: "fight", emoji: "😤", text: "이번엔 우리 집 먼저!", grade: "bad", effects: { happy: -5 }, life: { bond: -6 }, narratives: ["차 안 공기가 얼어붙었다. 8시간 동안."] },
    ],
  }),

  // ===================== 배우자·노년 =====================
  E({
    id: "v2_spouse_ill", stage: "*", age: [55, 95], emoji: "📋", title: "{spouse}의 투병",
    desc: "{spouse}가 큰 병 진단을 받았다. 의사의 목소리가 멀게 들린다.", weight: 1.8,
    married: true, flagBanned: ["spouse_ill_done"],
    choices: [
      { id: "all", emoji: "💪", text: "모든 걸 걸고 치료한다", grade: "good", effects: { money: -5000, health: -4 }, flag: { add: ["spouse_ill_done"] },
        outcomes: [
          { chance: 0.6, effects: { happy: +6 }, narrative: "1년의 치료 끝에 완치 판정. 병원 앞에서 둘이 손을 잡았다.", life: { bond: +15 } },
          { chance: 0.4, effects: { happy: -20 }, narrative: "마지막까지 손을 잡고 있었다. {spouse}는 '고마웠어'라고 했다.", life: { widow: true } },
        ] },
      { id: "travel", emoji: "🌊", text: "남은 시간 함께 여행한다", grade: "good", effects: { money: -1500, happy: +4 }, flag: { add: ["spouse_ill_done"] },
        outcomes: [
          { chance: 0.35, effects: { happy: +10 }, narrative: "기적처럼 병세가 멈췄다. 매년 바다에 가기로 했다.", life: { bond: +20 } },
          { chance: 0.65, effects: { happy: -14 }, narrative: "바닷가 노을 앞에서 {spouse}가 웃었다. 그게 마지막 여행이었다.", life: { widow: true } },
        ] },
    ],
  }),
  E({
    id: "v2_late_divorce", stage: "senior", age: [60, 78], emoji: "🍂", title: "황혼의 결심",
    desc: "{spouse}가 말했다. '남은 인생은 나를 위해 살고 싶어.'", weight: 1.2,
    married: true, cond: p => p.spouse && p.spouse.bond < 45,
    choices: [
      { id: "accept", emoji: "🤝", text: "그 마음을 받아들인다", grade: "mid", effects: { happy: -6, money: -5000, intel: +3 }, life: { divorce: true }, narratives: ["30년 만에 혼자 밥을 지었다. 서툴렀다."] },
      { id: "change", emoji: "🌱", text: "이제라도 달라지겠다", grade: "good", effects: { happy: +4 }, life: { bond: +20 }, narratives: ["처음으로 {spouse}에게 아침을 차려 줬다. 계란이 탔다."] },
    ],
  }),
  E({
    id: "v2_anniversary", repeat: 8, stage: "*", age: [45, 100], emoji: "💞", title: "결혼기념일",
    desc: "결혼 몇 주년인지 셈하다 웃음이 났다. 오늘은 {spouse}와의 기념일.", weight: 1.2,
    married: true, cond: p => p.spouse && p.age - p.spouse.since >= 15,
    choices: [
      { id: "letter", emoji: "💌", text: "손편지를 쓴다", grade: "good", effects: { happy: +6 }, life: { bond: +8 }, narratives: ["{spouse}가 편지를 지갑에 넣고 다닌다."] },
      { id: "trip", emoji: "🏝️", text: "신혼여행지 다시 가기", grade: "good", effects: { happy: +9, money: -600, health: +2 }, life: { bond: +10 }, narratives: ["그 해변은 그대로였다. 우리만 조금 변했다."] },
      { id: "forgot", emoji: "😅", text: "...잊어버렸다", grade: "bad", effects: { happy: -4 }, life: { bond: -10 }, narratives: ["저녁상에 미역국이 없었다. 불길했다."] },
    ],
  }),
];
