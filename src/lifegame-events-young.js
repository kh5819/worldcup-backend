// =========================
// 인생게임 v2 이벤트 — 유아기~청년기 (v:2 → money는 만원 단위, health 직접 지정)
// 필드: age:[min,max], married/hasKid, flagRequired/flagBanned, statMin/statMax, cond(p), life:{job,housing,quit,raise,marry,child,divorce,widow,bond}
// =========================
const E = o => ({ v: 2, type: "normal", ...o });

export const EVENTS_YOUNG = [
  // ===================== 유아기 =====================
  E({
    id: "v2_doljabi", stage: "infant", age: [1, 2], emoji: "🎂", title: "돌잡이",
    desc: "첫돌 잔칫상 위에 물건이 놓였다. 아기의 손이 향한 곳은?", weight: 1.5,
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

  // ----- 유아기 추가(2026-10-24): 첫해 다양화·운으로 갈리는 결과 -----
  E({
    id: "v2_100days", stage: "infant", age: [1, 1], emoji: "📸", title: "백일 사진 촬영",
    desc: "사진관 조명이 번쩍. 사진사가 딸랑이를 흔든다.",
    choices: [
      { id: "smile", emoji: "😄", text: "활짝 웃는다", grade: "good", effects: { happy: +4, social: +3 }, narratives: ["액자가 할머니 댁 거실 한가운데 걸렸다.", "사진관이 샘플 사진으로 써도 되냐고 물었다."] },
      { id: "cry", emoji: "😭", text: "자지러지게 운다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: -2, power: +3 }, grade: "mid", narrative: "울다 지쳐 잠든 사진만 남았다. 그것도 귀여웠다." },
          { chance: 0.4, effects: { social: +4, internet: +3 }, grade: "good", narrative: "우는 얼굴 사진이 '레전드 짤'이 돼 친척들 사이에 돌았다." },
        ] },
      { id: "sleep", emoji: "😴", text: "그냥 잠든다", grade: "mid", effects: { health: +3, happy: +1 }, narratives: ["두 시간 기다리다 잠든 채로 찍었다. 천사 같다는 평.", "깨우자마자 기저귀가 터졌다. 촬영은 다음 주로."] },
    ],
  }),
  E({
    id: "v2_vaccine", stage: "infant", age: [1, 2], emoji: "💉", title: "예방주사 맞는 날",
    desc: "간호사 선생님이 주사기를 들었다. 엄마가 꼭 안아 준다.",
    choices: [
      { id: "brave", emoji: "😤", text: "울지 않고 버틴다", grade: "good", effects: { power: +3, happy: +2, health: +3 }, narratives: ["간호사 선생님이 '이런 아기 처음 봐요'라며 스티커를 두 장 줬다.", "주사 맞는 순간 오히려 웃었다. 의사 선생님이 당황했다."] },
      { id: "cry", emoji: "😭", text: "병원이 떠나가라 운다", grade: "mid",
        outcomes: [
          { chance: 0.7, effects: { health: +3, happy: -3 }, grade: "mid", narrative: "울음소리에 대기실 아기들이 줄줄이 따라 울었다." },
          { chance: 0.3, effects: { health: +3, social: +3 }, grade: "good", narrative: "울다가 옆 침대 아기와 눈이 마주쳐 같이 웃었다. 첫 친구다." },
        ] },
      { id: "kick", emoji: "🦵", text: "발로 간호사를 찬다", grade: "bad", effects: { power: +5, social: -3 }, narratives: ["주사 바늘이 두 번 들어갔다. 엄마가 대신 사과했다."] },
    ],
  }),
  E({
    id: "v2_crawl_race", stage: "infant", age: [1, 2], emoji: "🏁", title: "아기 기어가기 대회",
    desc: "문화센터 기어가기 대회. 결승선에서 엄마가 장난감을 흔든다.",
    choices: [
      { id: "dash", emoji: "🏃", text: "직진 전력 질주", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { power: +5, happy: +5, money: +10 }, grade: "crit", narrative: "1등! 상품으로 기저귀 한 박스를 받았다." },
          { chance: 0.55, effects: { power: +3 }, grade: "mid", narrative: "결승선 바로 앞에서 갑자기 앉아 박수를 쳤다." },
        ] },
      { id: "detour", emoji: "🧸", text: "옆 아기 장난감에 한눈판다", grade: "mid", effects: { social: +4, happy: +2 }, narratives: ["경주는 잊고 옆 아기와 딸랑이를 나눴다.", "다른 엄마 품으로 기어가 버렸다. 객석이 뒤집어졌다."] },
      { id: "reverse", emoji: "↩️", text: "뒤로 기어간다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { internet: +6, happy: +3 }, grade: "good", narrative: "역주행 영상이 맘카페에서 화제가 됐다." },
          { chance: 0.5, effects: { happy: -2, power: +2 }, grade: "mid", narrative: "출발선 밖으로 나가 실격. 본인은 아주 만족했다." },
        ] },
    ],
  }),
  E({
    id: "v2_picky_eater", stage: "infant", age: [2, 5], emoji: "🥦", title: "브로콜리의 습격",
    desc: "식판 위에 초록색 덩어리가 올라왔다. 엄마는 '한 입만'을 외친다.",
    choices: [
      { id: "eat", emoji: "😋", text: "꾹 참고 먹는다", grade: "good", effects: { health: +5, power: +2 }, narratives: ["의외로 맛있었다. 이날부터 '채소 먹는 아이'로 소문났다.", "삼키자마자 엄마가 박수를 쳤다. 칭찬 스티커 하나 획득."] },
      { id: "throw", emoji: "🤾", text: "바닥에 던진다", grade: "bad", effects: { happy: +3, social: -3 }, narratives: ["강아지가 대신 먹었다. 강아지도 뱉었다.", "벽에 초록 자국이 남았다. 이사 갈 때까지 지워지지 않았다."] },
      { id: "deal", emoji: "🤝", text: "디저트랑 거래한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { intel: +5, happy: +3 }, grade: "good", narrative: "브로콜리 세 개에 요구르트 하나. 협상의 기초를 배웠다." },
          { chance: 0.4, effects: { intel: +2, happy: -3 }, grade: "mid", narrative: "엄마가 협상에 응하지 않았다. 브로콜리만 두 배가 됐다." },
        ] },
    ],
  }),
  E({
    id: "v2_daycare", stage: "infant", age: [3, 4], emoji: "🎒", title: "어린이집 첫 등원",
    desc: "어린이집 문 앞. 엄마 손을 놓아야 할 시간이다.",
    choices: [
      { id: "cling", emoji: "😢", text: "엄마 다리에 매달린다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: -4, social: +2 }, grade: "mid", narrative: "일주일 내내 울며 등원했다. 2주 차엔 엄마가 더 울었다." },
          { chance: 0.4, effects: { happy: +2, social: +3 }, grade: "good", narrative: "선생님 품에 안기자 3분 만에 울음을 그쳤다." },
        ] },
      { id: "run_in", emoji: "🏃", text: "뒤도 안 보고 뛰어 들어간다", grade: "good", effects: { social: +6, power: +2 }, narratives: ["엄마는 서운해서 차에서 좀 울었다.", "첫날부터 블록 코너를 점령했다."] },
      { id: "observe", emoji: "👀", text: "구석에서 지켜본다", grade: "mid", effects: { intel: +4, social: -1 }, narratives: ["한 달 동안 관찰만 했다. 그 뒤로 반 아이들 이름을 전부 외웠다."] },
    ],
  }),
  E({
    id: "v2_lost_mart", stage: "infant", age: [3, 6], emoji: "🛒", title: "마트에서 미아",
    desc: "시식 코너에 정신 팔린 사이, 엄마가 사라졌다.",
    choices: [
      { id: "stay", emoji: "🧍", text: "그 자리에서 기다린다", grade: "good", effects: { intel: +4, luck: +2 }, narratives: ["배운 대로 했다. 엄마가 3분 만에 돌아와 꼭 안아 줬다."] },
      { id: "ask", emoji: "🙋", text: "직원에게 도와 달라고 한다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { social: +5, happy: +2 }, grade: "good", narrative: "안내 방송에 내 이름이 나왔다. 왠지 유명해진 기분." },
          { chance: 0.3, effects: { social: +3, happy: +4, money: +3 }, grade: "crit", narrative: "직원 누나가 기다리는 동안 사탕을 한 봉지 줬다." },
        ] },
      { id: "search", emoji: "🏃", text: "직접 찾으러 돌아다닌다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { power: +3, happy: -5 }, grade: "bad", narrative: "주차장까지 갔다가 경비 아저씨에게 발견됐다. 엄마 얼굴이 하얬다." },
          { chance: 0.5, effects: { power: +3, luck: +3 }, grade: "good", narrative: "장난감 코너에서 엄마를 찾았다. 엄마도 거기서 날 찾고 있었다." },
        ] },
      { id: "toy", emoji: "🧸", text: "그냥 장난감 코너에서 논다", grade: "mid", effects: { happy: +5, intel: -1 }, narratives: ["엄마가 찾았을 때 나는 장난감 자동차를 운전 중이었다."] },
    ],
  }),
  E({
    id: "v2_crayon_wall", stage: "infant", age: [2, 5], emoji: "🖍️", title: "거실 벽은 도화지",
    desc: "새로 도배한 거실 벽. 손에는 크레파스가 들려 있다.",
    choices: [
      { id: "draw", emoji: "🎨", text: "대작을 그린다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { intel: +3, happy: +5 }, grade: "good", narrative: "아빠가 혼내려다 그림을 보고 사진을 찍었다. 지금도 그 사진이 배경화면이다." },
          { chance: 0.5, effects: { happy: +3, money: -20 }, grade: "bad", narrative: "도배를 다시 했다. 20만 원이 날아갔다." },
        ] },
      { id: "paper", emoji: "📄", text: "종이를 달라고 한다", grade: "good", effects: { intel: +4, social: +2 }, narratives: ["스케치북 한 권을 다 채웠다. 냉장고가 전시장이 됐다.", "엄마가 '천재 아니야?'라며 미술학원을 검색했다."] },
      { id: "eat", emoji: "😋", text: "크레파스를 먹어 본다", grade: "bad", effects: { health: -3, happy: +1 }, narratives: ["무지개색 혀가 됐다. 맛은 별로였다."] },
    ],
  }),
  E({
    id: "v2_santa", stage: "infant", age: [3, 6], emoji: "🎅", title: "산타 할아버지는 있을까?",
    desc: "크리스마스이브. 머리맡에 양말을 걸어야 할까?",
    choices: [
      { id: "believe", emoji: "🧦", text: "양말을 걸고 일찍 잔다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { happy: +7, luck: +2 }, grade: "good", narrative: "아침에 양말 속에 원하던 장난감이 있었다!" },
          { chance: 0.3, effects: { happy: +3, intel: +2 }, grade: "mid", narrative: "양말 속에 학습지가 들어 있었다. 산타도 교육열이 있었다." },
        ] },
      { id: "stake", emoji: "🕵️", text: "밤새 잠복한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { intel: +4, happy: -2 }, grade: "mid", narrative: "새벽 2시, 산타 옷을 입은 아빠를 목격했다. 비밀을 지켜 주기로 했다." },
          { chance: 0.5, effects: { happy: +4, health: -2 }, grade: "good", narrative: "끝까지 버티다 잠들었다. 아침엔 선물이 있었다. 산타는 진짜다." },
        ] },
      { id: "letter", emoji: "✉️", text: "산타에게 편지를 쓴다", grade: "good", effects: { intel: +3, happy: +4 }, narratives: ["'게임기 주세요. 착하게 살게요.' 부모님이 편지를 몰래 읽고 고민에 빠졌다.", "동생 것도 같이 부탁했다. 산타가 감동했는지 선물이 두 개였다."] },
    ],
  }),
  E({
    id: "v2_first_haircut", stage: "infant", age: [2, 4], emoji: "💇", title: "생애 첫 미용실",
    desc: "미용실 의자에 앉았다. 가위 소리가 무섭다.",
    choices: [
      { id: "still", emoji: "🧘", text: "얌전히 앉아 있는다", grade: "good", effects: { intel: +2, social: +3 }, narratives: ["사탕 하나에 30분을 버텼다. 미용사가 '역대급 손님'이라고 했다."] },
      { id: "squirm", emoji: "🌀", text: "고개를 이리저리 돌린다", grade: "bad",
        outcomes: [
          { chance: 0.6, effects: { happy: -4, social: -2 }, grade: "bad", narrative: "앞머리가 삐뚤게 잘렸다. 유치원 사진이 그 머리로 남았다." },
          { chance: 0.4, effects: { internet: +4, happy: +2 }, grade: "mid", narrative: "삐뚤어진 앞머리가 오히려 귀엽다며 미용실 SNS에 올라갔다." },
        ] },
      { id: "dad", emoji: "👨", text: "아빠가 집에서 자른다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +2, money: +3 }, grade: "mid", narrative: "생각보다 괜찮았다. 아빠가 미용 유튜브를 구독했다." },
          { chance: 0.5, effects: { happy: -5, social: -3 }, grade: "bad", narrative: "바가지 머리가 됐다. 엄마가 아빠를 한참 노려봤다." },
        ] },
    ],
  }),
  E({
    id: "v2_baby_model", stage: "infant", age: [2, 5], emoji: "📷", title: "아역 모델 제의",
    desc: "길에서 명함을 받았다. 유아복 광고 모델을 찾는다고 한다.", weight: 0.8,
    choices: [
      { id: "accept", emoji: "🌟", text: "촬영해 본다", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { money: +80, social: +5, internet: +6 }, grade: "crit", narrative: "광고가 버스 정류장에 걸렸다. 동네 스타가 됐다." },
          { chance: 0.4, effects: { money: +20, happy: +2 }, grade: "good", narrative: "카탈로그 한 귀퉁이에 실렸다. 출연료로 적금을 들었다." },
          { chance: 0.25, effects: { happy: -4, money: -10 }, grade: "bad", narrative: "알고 보니 프로필 사진값만 받는 업체였다. 부모님이 신고했다." },
        ] },
      { id: "decline", emoji: "🙅", text: "평범하게 자란다", grade: "good", effects: { happy: +3, health: +2 }, narratives: ["놀이터에서 흙장난하는 게 더 좋았다."] },
    ],
  }),
  E({
    id: "v2_dream_job", stage: "infant", age: [4, 6], emoji: "🦖", title: "커서 뭐 될래?",
    desc: "유치원 선생님이 장래희망을 물었다.",
    choices: [
      { id: "dino", emoji: "🦖", text: "공룡!", grade: "mid", effects: { happy: +5, intel: +1 }, narratives: ["직업이 아니라고 하자 '그럼 공룡 박사'로 바꿨다. 꽤 합리적이다.", "반 친구 절반이 따라서 공룡이 되겠다고 했다."] },
      { id: "president", emoji: "🏛️", text: "대통령", grade: "good", effects: { social: +4, intel: +2 }, narratives: ["할아버지가 그 말을 30년 동안 자랑했다."] },
      { id: "youtuber", emoji: "📱", text: "유튜버", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { internet: +6, happy: +2 }, grade: "good", narrative: "그날 저녁 장난감 리뷰를 찍었다. 조회수 12. 전부 가족이었다." },
          { chance: 0.5, effects: { internet: +3, happy: -2 }, grade: "mid", narrative: "선생님이 '다른 건 없니?' 하고 웃었다. 조금 서운했다." },
        ] },
      { id: "rich", emoji: "💰", text: "건물주", grade: "mid", effects: { money: +5, luck: +3, social: -1 }, narratives: ["선생님이 잠시 말을 잃었다. 엄마가 상담에 불려 갔다."] },
    ],
  }),
  E({
    id: "v2_hide_seek", stage: "infant", age: [4, 6], emoji: "🙈", title: "숨바꼭질",
    desc: "술래가 열을 센다. 어디에 숨을까?",
    choices: [
      { id: "closet", emoji: "🚪", text: "장롱 속", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { intel: +3, happy: +4 }, grade: "good", narrative: "아무도 못 찾았다. 결국 나와서 '나 여기 있어!' 하고 승리를 선언했다." },
          { chance: 0.4, effects: { happy: -3, health: +1 }, grade: "mid", narrative: "숨어 있다 잠들었다. 저녁에 온 가족이 집을 뒤졌다." },
        ] },
      { id: "curtain", emoji: "🪟", text: "커튼 뒤 (발은 보임)", grade: "mid", effects: { happy: +4, social: +3 }, narratives: ["발이 보여서 바로 잡혔다. 다들 웃느라 놀이가 끝났다."] },
      { id: "seeker", emoji: "👀", text: "술래를 자청한다", grade: "good", effects: { intel: +4, social: +3 }, narratives: ["다섯 명을 다 찾아냈다. 관찰력 하나는 타고났다."] },
    ],
  }),
  E({
    id: "v2_kinder_play", stage: "infant", age: [5, 6], emoji: "🎭", title: "유치원 학예회",
    desc: "학예회 연극 '흥부와 놀부'. 무슨 역할을 맡을까?",
    choices: [
      { id: "lead", emoji: "⭐", text: "주인공 흥부", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +6, happy: +5 }, grade: "good", narrative: "대사를 하나도 안 틀렸다. 객석에서 할머니가 기립 박수를 쳤다." },
          { chance: 0.4, effects: { social: +2, happy: -4 }, grade: "mid", narrative: "무대에 서자마자 머릿속이 하얘졌다. 친구가 대사를 대신 해 줬다." },
        ] },
      { id: "villain", emoji: "😈", text: "놀부", grade: "mid", effects: { social: +4, power: +3 }, narratives: ["악역 연기가 너무 실감 나서 동생이 울었다.", "놀부 웃음소리가 유치원 유행어가 됐다."] },
      { id: "tree", emoji: "🌳", text: "나무 1", grade: "mid",
        outcomes: [
          { chance: 0.7, effects: { happy: +2, health: +1 }, grade: "mid", narrative: "가만히 서 있는 게 생각보다 힘들었다. 그래도 끝까지 나무였다." },
          { chance: 0.3, effects: { internet: +5, happy: +5 }, grade: "crit", narrative: "나무가 갑자기 춤을 췄다. 그 영상이 학예회 최고 조회수를 찍었다." },
        ] },
      { id: "swallow", emoji: "🐦", text: "제비 (박씨 배달)", grade: "good", effects: { power: +3, happy: +3 }, narratives: ["무대를 날아다니다 박을 떨어뜨렸다. 박이 굴러 객석까지 갔다."] },
    ],
  }),
  E({
    id: "v2_country_grandma", stage: "infant", age: [3, 6], emoji: "🌾", title: "시골 할머니 댁",
    desc: "여름휴가, 시골 할머니 댁에 왔다. 마당에 닭이 있다.",
    choices: [
      { id: "chicken", emoji: "🐔", text: "닭을 쫓아다닌다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { power: +4, happy: +4 }, grade: "good", narrative: "결국 한 마리를 안았다. 할머니가 달걀을 꺼내 주셨다." },
          { chance: 0.4, effects: { health: -3, happy: -2 }, grade: "bad", narrative: "닭에게 쪼였다. 그 뒤로 치킨을 더 맛있게 먹게 됐다." },
        ] },
      { id: "garden", emoji: "🍅", text: "텃밭에서 토마토를 딴다", grade: "good", effects: { health: +4, happy: +3 }, narratives: ["처음 따 본 토마토는 마트 것보다 달았다.", "할아버지가 내 이름 붙은 고추 모종을 하나 심어 주셨다."] },
      { id: "tv", emoji: "📺", text: "에어컨 틀고 TV만 본다", grade: "mid", effects: { happy: +2, internet: +3, power: -2 }, narratives: ["할머니가 '도시 애들은 다 저렇다'며 수박만 계속 잘라 주셨다."] },
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

  // ----- 초등 추가(2026-10-24) -----
  E({
    id: "v2_dictation", stage: "child", age: [7, 8], emoji: "✏️", title: "받아쓰기 시험",
    desc: "선생님이 문장을 부르신다. '닭이 꼬끼오 하고 울었습니다.'",
    choices: [
      { id: "study", emoji: "📚", text: "전날 밤 열심히 연습했다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { intel: +5, happy: +3 }, grade: "good", narrative: "100점! 엄마가 시험지를 코팅했다." },
          { chance: 0.3, effects: { intel: +3, happy: -2 }, grade: "mid", narrative: "딱 한 글자를 틀려 90점. 그 한 글자가 한이 됐다." },
        ] },
      { id: "wing", emoji: "🎲", text: "감으로 쓴다", grade: "mid",
        outcomes: [
          { chance: 0.4, effects: { luck: +4, happy: +3 }, grade: "good", narrative: "운 좋게 다 맞았다. 이상하게 자신감만 커졌다." },
          { chance: 0.6, effects: { intel: -2, happy: -3 }, grade: "bad", narrative: "40점. '꼬끼오'를 '꼬끼요'로 쓴 게 시작이었다." },
        ] },
      { id: "peek", emoji: "👀", text: "짝꿍 걸 슬쩍 본다", grade: "bad",
        outcomes: [
          { chance: 0.5, effects: { intel: +1, social: -4 }, grade: "bad", narrative: "짝꿍이 손으로 가렸다. 그리고 선생님께 일렀다." },
          { chance: 0.5, effects: { luck: +2, intel: -2 }, grade: "mid", narrative: "짝꿍도 틀린 답이었다. 둘이 똑같이 틀렸다." },
        ] },
    ],
  }),
  E({
    id: "v2_picnic", stage: "child", age: [7, 12], emoji: "🍙", title: "소풍 도시락",
    desc: "내일은 소풍날! 도시락은 뭘 싸 갈까?",
    choices: [
      { id: "kimbap", emoji: "🍙", text: "엄마표 김밥", grade: "good", effects: { happy: +5, social: +3 }, narratives: ["친구들이 꼬다리를 노렸다. 나눠 주니 인기가 올랐다.", "김밥에서 엄마 사랑 맛이 났다. 시금치가 두 배였다."] },
      { id: "convenience", emoji: "🏪", text: "편의점 삼각김밥", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +2, intel: +1 }, grade: "mid", narrative: "삼각김밥 포장을 혼자 뜯는 데 성공했다. 작은 독립이었다." },
          { chance: 0.4, effects: { happy: -3, social: +1 }, grade: "bad", narrative: "포장을 잘못 뜯어 김이 다 찢어졌다. 친구가 자기 김밥을 하나 줬다." },
        ] },
      { id: "snack", emoji: "🍫", text: "과자만 잔뜩", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { social: +5, health: -2 }, grade: "good", narrative: "과자 파티의 주인공이 됐다. 오후 내내 인기 만점." },
          { chance: 0.5, effects: { health: -4, happy: -2 }, grade: "bad", narrative: "점심에 과자만 먹고 버스에서 멀미를 했다." },
        ] },
    ],
  }),
  E({
    id: "v2_sports_day", stage: "child", age: [8, 12], emoji: "🏃", title: "운동회 계주",
    desc: "청군 백군 계주, 마지막 주자가 나다. 바통이 다가온다.",
    choices: [
      { id: "sprint", emoji: "⚡", text: "온 힘을 다해 달린다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { power: +6, social: +5, happy: +5 }, grade: "crit", narrative: "역전승! 반 친구들이 헹가래를 쳐 줬다." },
          { chance: 0.35, effects: { power: +4, happy: +1 }, grade: "good", narrative: "한 명을 제쳤다. 1등은 못 했지만 박수를 받았다." },
          { chance: 0.2, effects: { health: -4, happy: -4 }, grade: "bad", narrative: "결승선 앞에서 넘어졌다. 무릎에 영광의 상처가 남았다." },
        ] },
      { id: "baton", emoji: "🤲", text: "바통부터 확실히 받는다", grade: "good", effects: { intel: +3, power: +3 }, narratives: ["바통 터치가 교과서 같았다. 선생님이 시범으로 보여 줬다."] },
      { id: "cheer", emoji: "📣", text: "응원단장을 맡는다", grade: "good", effects: { social: +6, happy: +3 }, narratives: ["목이 쉬도록 응원했다. 다음 날 목소리가 안 나왔다.", "응원 구호를 직접 지었다. 그해 운동회 유행어가 됐다."] },
    ],
  }),
  E({
    id: "v2_science_fair", stage: "child", age: [9, 12], emoji: "🔬", title: "과학의 날 대회",
    desc: "물로켓·발명품 중 하나로 대회에 나가야 한다.",
    choices: [
      { id: "rocket", emoji: "🚀", text: "물로켓", grade: "mid",
        outcomes: [
          { chance: 0.4, effects: { intel: +5, happy: +5, luck: +2 }, grade: "crit", narrative: "운동장 끝까지 날아갔다! 금상을 받았다." },
          { chance: 0.6, effects: { intel: +3, happy: -2 }, grade: "mid", narrative: "발사 직후 옆으로 꺾여 교장 선생님 쪽으로 날아갔다." },
        ] },
      { id: "invent", emoji: "💡", text: "발명품", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { intel: +7, social: +2 }, grade: "good", narrative: "'자동 실내화 정리기'로 은상. 아빠가 특허를 검색해 봤다." },
          { chance: 0.5, effects: { intel: +4 }, grade: "mid", narrative: "전날 밤 아빠가 거의 다 만들었다. 심사위원도 눈치챘다." },
        ] },
      { id: "skip", emoji: "🙃", text: "그냥 참가상", grade: "mid", effects: { happy: +2 }, narratives: ["참가상 연필 한 자루를 받았다. 끝까지 아껴 썼다."] },
    ],
  }),
  E({
    id: "v2_slime", stage: "child", age: [8, 11], emoji: "🧪", title: "슬라임 대유행",
    desc: "반 친구들이 전부 슬라임을 만진다. 나도 갖고 싶다.",
    choices: [
      { id: "buy", emoji: "💸", text: "용돈으로 산다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +5, money: -1 }, grade: "good", narrative: "반짝이 슬라임으로 쉬는 시간 주인공이 됐다." },
          { chance: 0.4, effects: { happy: -3, money: -1 }, grade: "bad", narrative: "이틀 만에 굳어 버렸다. 용돈만 날렸다." },
        ] },
      { id: "make", emoji: "🧪", text: "직접 만든다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { intel: +5, happy: +4 }, grade: "good", narrative: "물풀과 렌즈 세척액의 황금 비율을 찾아냈다. 친구들 주문이 밀려들었다." },
          { chance: 0.5, effects: { happy: -2, intel: +2 }, grade: "mid", narrative: "카펫에 붙어서 안 떨어졌다. 엄마의 비명이 들렸다." },
        ] },
      { id: "sell", emoji: "🏷️", text: "만들어서 판다", grade: "mid",
        outcomes: [
          { chance: 0.4, effects: { money: +1, social: +4, intel: +3 }, grade: "crit", narrative: "반에서 슬라임 장사로 만 원을 벌었다. 첫 사업 성공!" },
          { chance: 0.6, effects: { social: -3, happy: -2 }, grade: "bad", narrative: "선생님께 걸려 장사가 금지됐다. 재고만 잔뜩 남았다." },
        ] },
    ],
  }),
  E({
    id: "v2_crush_note", stage: "child", age: [10, 12], emoji: "💌", title: "짝꿍에게 쪽지",
    desc: "짝꿍이 자꾸 신경 쓰인다. 수업 시간에 쪽지를 써 볼까?",
    choices: [
      { id: "send", emoji: "📝", text: "용기 내서 건넨다", grade: "mid",
        outcomes: [
          { chance: 0.4, effects: { happy: +7, social: +4 }, grade: "good", narrative: "답장이 왔다. '나도 ㅎㅎ' 세상이 핑크색이 됐다." },
          { chance: 0.35, effects: { happy: -2, social: +2 }, grade: "mid", narrative: "답장은 '?' 한 글자였다. 그래도 친구로는 잘 지냈다." },
          { chance: 0.25, effects: { happy: -5, social: -3 }, grade: "bad", narrative: "중간에 다른 친구가 가로채 읽었다. 반 전체가 알게 됐다." },
        ] },
      { id: "hide", emoji: "🤐", text: "마음속에만 간직한다", grade: "mid", effects: { intel: +2, happy: -1 }, narratives: ["졸업식 날까지 말 못 했다. 앨범에서 그 아이 사진에만 동그라미를 쳤다."] },
      { id: "candy", emoji: "🍬", text: "말 대신 사탕을 준다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +4, happy: +3 }, grade: "good", narrative: "다음 날 짝꿍이 젤리를 줬다. 말없이 통하는 사이가 됐다." },
          { chance: 0.4, effects: { happy: -2 }, grade: "mid", narrative: "짝꿍이 사탕을 반 친구들과 나눠 먹었다." },
        ] },
    ],
  }),
  E({
    id: "v2_found_wallet", stage: "child", age: [8, 12], emoji: "👛", title: "길에서 지갑을 주웠다",
    desc: "학교 가는 길, 두툼한 지갑이 떨어져 있다.",
    choices: [
      { id: "police", emoji: "🚓", text: "경찰서에 가져다준다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +5, happy: +4, money: +1 }, grade: "good", narrative: "주인 아저씨가 고맙다며 문화상품권을 줬다." },
          { chance: 0.4, effects: { social: +4, luck: +5 }, grade: "crit", narrative: "학교에 감사 편지가 왔다. 조회 시간에 상을 받았다." },
        ] },
      { id: "keep", emoji: "💸", text: "현금만 슬쩍한다", grade: "bad",
        outcomes: [
          { chance: 0.5, effects: { money: +5, happy: -4 }, grade: "bad", narrative: "그날 밤 잠이 안 왔다. 과자를 사 먹었는데 맛이 없었다." },
          { chance: 0.5, effects: { social: -6, money: -5 }, grade: "bad", narrative: "CCTV에 찍혀 있었다. 부모님과 함께 사과하러 갔다." },
        ] },
      { id: "teacher", emoji: "🧑‍🏫", text: "선생님께 드린다", grade: "good", effects: { social: +4, intel: +2 }, narratives: ["선생님이 칭찬 스티커를 줬다. 같은 반 친구들이 부러워했다."] },
    ],
  }),
  E({
    id: "v2_baby_tooth", stage: "child", age: [7, 9], emoji: "🦷", title: "이가 흔들린다",
    desc: "앞니가 흔들흔들. 어떻게 뺄까?",
    choices: [
      { id: "thread", emoji: "🧵", text: "실에 묶고 문을 쾅", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { power: +3, happy: +3 }, grade: "good", narrative: "한 번에 쏙! 이를 지붕 위로 던지며 소원을 빌었다." },
          { chance: 0.4, effects: { happy: -4, health: -1 }, grade: "mid", narrative: "문이 안 닫혔다. 세 번 시도 끝에 울면서 치과에 갔다." },
        ] },
      { id: "dentist", emoji: "🏥", text: "치과에 간다", grade: "good", effects: { health: +4, happy: -1 }, narratives: ["마취 주사가 이 뽑는 것보다 아팠다. 대신 풍선을 받았다."] },
      { id: "wait", emoji: "⏳", text: "저절로 빠질 때까지 둔다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { luck: +3, happy: +2 }, grade: "mid", narrative: "점심 먹다 빠졌다. 이는 무사히 챙겼다." },
          { chance: 0.5, effects: { happy: -2, health: -1 }, grade: "bad", narrative: "빵을 먹다 이를 삼켰다. 이빨 요정에게 미안했다." },
        ] },
    ],
  }),
  E({
    id: "v2_vacation_diary", stage: "child", age: [8, 12], emoji: "📓", title: "방학 일기 몰아 쓰기",
    desc: "개학 하루 전. 방학 일기 30일 치가 비어 있다.",
    choices: [
      { id: "all_night", emoji: "🌙", text: "밤새 지어서 쓴다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { intel: +4, happy: -2 }, grade: "mid", narrative: "날씨를 전부 '맑음'으로 썼다. 선생님이 장마 기간을 지적했다." },
          { chance: 0.5, effects: { intel: +5, internet: +2 }, grade: "good", narrative: "상상력이 폭발했다. 선생님이 '소설가 해도 되겠다'고 했다." },
        ] },
      { id: "honest", emoji: "🙇", text: "솔직하게 못 썼다고 한다", grade: "good", effects: { social: +3, intel: +1 }, narratives: ["선생님이 의외로 웃으셨다. 정직함에 보너스 점수."] },
      { id: "mom", emoji: "👩", text: "엄마에게 도움을 청한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +3, social: +2 }, grade: "good", narrative: "엄마가 사진첩을 꺼내 날짜를 맞춰 줬다. 둘이 웃으며 썼다." },
          { chance: 0.5, effects: { happy: -5 }, grade: "bad", narrative: "엄마의 잔소리 3시간과 함께 썼다." },
        ] },
    ],
  }),
  E({
    id: "v2_piano_recital", stage: "child", age: [7, 11], emoji: "🎹", title: "피아노 학원 발표회",
    desc: "강당 무대 위 그랜드 피아노. 연습한 곡은 '엘리제를 위하여'.",
    choices: [
      { id: "play", emoji: "🎼", text: "연습한 대로 친다", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { intel: +3, social: +4, happy: +4 }, grade: "good", narrative: "한 번도 안 틀렸다. 꽃다발을 세 개나 받았다." },
          { chance: 0.3, effects: { happy: -3, social: +1 }, grade: "mid", narrative: "중간에 한 마디를 건너뛰었다. 아무도 몰랐다. 나만 알았다." },
          { chance: 0.15, effects: { happy: +6, internet: +5 }, grade: "crit", narrative: "틀린 부분을 즉흥 연주로 넘겼다. 원장 선생님이 재능이라며 놀랐다." },
        ] },
      { id: "quit", emoji: "🚪", text: "발표회 전에 학원을 그만둔다", grade: "mid", effects: { happy: +3, intel: -2 }, narratives: ["체르니 30번에서 멈춘 손가락. 어른이 돼서 조금 후회했다."] },
      { id: "stage_fright", emoji: "😰", text: "무대 공포증으로 숨는다", grade: "bad", effects: { happy: -3, health: -1 }, narratives: ["화장실에 숨어 있다 순서를 놓쳤다. 엄마가 꽃다발을 들고 서 있었다."] },
    ],
  }),
  E({
    id: "v2_rainy_day", stage: "child", age: [7, 12], emoji: "☔", title: "갑자기 비가 온다",
    desc: "하교 시간, 우산이 없다. 비가 쏟아진다.",
    choices: [
      { id: "run", emoji: "🏃", text: "비 맞고 뛰어간다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +5, power: +2 }, grade: "good", narrative: "물웅덩이를 일부러 밟으며 갔다. 인생 최고의 하굣길." },
          { chance: 0.4, effects: { health: -5 }, grade: "bad", narrative: "다음 날 감기에 걸려 학교를 쉬었다." },
        ] },
      { id: "share", emoji: "☂️", text: "친구 우산을 같이 쓴다", grade: "good", effects: { social: +6, happy: +2 }, narratives: ["한쪽 어깨가 다 젖었지만 친구와 더 친해졌다.", "우산 속에서 비밀 이야기를 나눴다."] },
      { id: "wait", emoji: "🏫", text: "엄마가 오길 기다린다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +3, health: +1 }, grade: "good", narrative: "엄마가 장화까지 챙겨 왔다. 따뜻한 어묵도 사 줬다." },
          { chance: 0.5, effects: { happy: -3 }, grade: "mid", narrative: "엄마는 회사였다. 비가 그칠 때까지 교실에서 혼자 기다렸다." },
        ] },
    ],
  }),
  E({
    id: "v2_coding_class", stage: "child", age: [9, 12], emoji: "💻", title: "방과후 코딩 교실",
    desc: "방과후 수업 신청서. 코딩 반에 자리가 하나 남았다.",
    choices: [
      { id: "join", emoji: "🖥️", text: "코딩 반 신청", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { intel: +6, internet: +4 }, grade: "good", narrative: "고양이가 걸어가는 게임을 만들었다. 엄마가 '취업 걱정 끝'이라고 했다." },
          { chance: 0.5, effects: { intel: +3, happy: -2 }, grade: "mid", narrative: "반복문에서 막혀 버렸다. 그래도 끝까지 다녔다." },
        ] },
      { id: "soccer", emoji: "⚽", text: "축구 교실로", grade: "good", effects: { power: +6, social: +3 }, narratives: ["코딩 대신 골 결정력을 키웠다. 점심시간의 영웅이 됐다."] },
      { id: "none", emoji: "🏠", text: "집에서 게임", grade: "mid", effects: { happy: +4, internet: +3, intel: -2 }, narratives: ["게임 속 레벨은 반에서 1등이었다. 현실 레벨은 그대로였다."] },
    ],
  }),
  E({
    id: "v2_gacha_toy", stage: "child", age: [7, 10], emoji: "🎰", title: "문방구 뽑기",
    desc: "문방구 앞 뽑기 기계. 주머니엔 천 원이 있다.",
    choices: [
      { id: "one", emoji: "🪙", text: "딱 한 번만", grade: "mid",
        outcomes: [
          { chance: 0.25, effects: { happy: +6, luck: +4 }, grade: "crit", narrative: "한 번에 1등 '황금 팽이'가 나왔다! 반에서 전설이 됐다." },
          { chance: 0.75, effects: { happy: +1 }, grade: "mid", narrative: "꽝 대신 작은 지우개 하나. 나름 만족했다." },
        ] },
      { id: "all", emoji: "💸", text: "용돈을 다 쓴다", grade: "bad",
        outcomes: [
          { chance: 0.3, effects: { happy: +5, money: -2 }, grade: "good", narrative: "열 번 만에 원하던 걸 뽑았다. 엄마에겐 비밀이다." },
          { chance: 0.7, effects: { happy: -4, money: -2, luck: -2 }, grade: "bad", narrative: "지우개만 일곱 개. 도박의 무서움을 일찍 배웠다." },
        ] },
      { id: "save", emoji: "🐷", text: "돼지 저금통에 넣는다", grade: "good", effects: { money: +3, intel: +2 }, narratives: ["저금통이 묵직해졌다. 이유 없이 뿌듯했다."] },
    ],
  }),
  E({
    id: "v2_family_camping", stage: "child", age: [7, 12], emoji: "⛺", title: "가족 캠핑",
    desc: "아빠가 큰맘 먹고 캠핑 장비를 샀다. 첫 캠핑이다.",
    choices: [
      { id: "tent", emoji: "🏕️", text: "텐트 치기를 돕는다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { power: +4, social: +3 }, grade: "good", narrative: "아빠와 둘이서 텐트를 세웠다. 아빠가 '다 컸네' 했다." },
          { chance: 0.4, effects: { happy: -2, power: +2 }, grade: "mid", narrative: "텐트가 거꾸로 섰다. 결국 옆자리 캠핑족 아저씨가 도와줬다." },
        ] },
      { id: "stars", emoji: "🌌", text: "밤하늘 별을 본다", grade: "good", effects: { happy: +6, intel: +2 }, narratives: ["난생처음 은하수를 봤다. 그날 우주를 좋아하게 됐다.", "별똥별에 빈 소원은 아직 비밀이다."] },
      { id: "bugs", emoji: "🦟", text: "모기와 전쟁", grade: "bad",
        outcomes: [
          { chance: 0.6, effects: { health: -2, happy: -3 }, grade: "bad", narrative: "모기에 스무 군데 물렸다. 다음 캠핑은 없었다." },
          { chance: 0.4, effects: { happy: +3, power: +2 }, grade: "mid", narrative: "모기향을 들고 텐트를 지켰다. 가족들이 나를 '캠핑 보안관'이라 불렀다." },
        ] },
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
