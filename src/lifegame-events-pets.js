// =========================
// 인생게임 v2 이벤트 — 반려동물(입양·말썽·동물병원·산책 인연·생일·둘째 입양)
// life.pet: {kind:"dog"|"cat"|"any", name?, breed?, startAge?} 로 입양, life.petFarewell 로 가장 나이 든 아이와 이별
// 조건: hasPet true|false, petMinAge(살아 있는 아이 중 이 나이 이상). {pet} = 함께 사는 아이 이름
// =========================
const E = o => ({ v: 2, type: "normal", ...o });

export const EVENTS_PETS = [
  E({
    id: "v2_child_pet_beg", stage: "child", age: [7, 12], emoji: "🐶", title: "강아지 키우고 싶어요!",
    desc: "친구네 집 강아지를 보고 온 날, 저녁 밥상에서 폭탄 발언을 했다.", weight: 1.0,
    hasPet: false,
    choices: [
      { id: "beg", emoji: "🥺", text: "울면서 조른다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, social: +3 }, narrative: "아빠가 먼저 무너졌다. 주말에 보호소에서 꼬리 치는 아이를 데려왔다.", life: { pet: { kind: "dog" } }, grade: "crit" },
          { chance: 0.55, effects: { happy: -5 }, narrative: "'네가 다 돌볼 거 아니잖아.' 엄마의 단호한 한마디에 베개를 적셨다." },
        ] },
      { id: "plan", emoji: "📋", text: "돌봄 계획표를 만들어 설득한다", grade: "good", effects: { intel: +4 },
        outcomes: [
          { chance: 0.7, effects: { happy: +12 }, narrative: "산책·밥·목욕 당번표에 감동한 부모님이 허락했다. 새 가족이 생겼다.", life: { pet: { kind: "any" } }, grade: "crit" },
          { chance: 0.3, effects: { happy: -2 }, narrative: "'대학 가면 키우자.' 계획표는 냉장고에 붙어 있다." },
        ] },
      { id: "chick", emoji: "🐥", text: "학교 앞 병아리를 사 온다", grade: "mid", effects: { happy: +4, money: -1 }, narratives: ["삐약이는 일주일 만에 떠났다. 처음으로 이별을 배웠다.", "삐약이가 닭이 됐다! 할머니 댁 마당으로 이사 갔다."] },
      { id: "stuffed", emoji: "🧸", text: "인형으로 참는다", grade: "mid", effects: { happy: +1 }, narratives: ["인형에게 '멍멍이'라는 이름을 붙여 줬다."] },
    ],
  }),
  E({
    id: "v2_pet_adopt", repeat: 12, stage: "*", age: [22, 78], emoji: "🏠", title: "새 가족을 맞을까",
    desc: "유기동물 보호소 앞을 지나는데, 철장 너머 눈망울이 자꾸 밟힌다.", weight: 0.7,
    hasPet: false,
    choices: [
      { id: "dog", emoji: "🐕", text: "강아지를 입양한다", grade: "good", effects: { happy: +12, money: -80, health: +2 }, life: { pet: { kind: "dog", startAge: 1 } }, narratives: ["집에 온 첫날, 소파 밑에서 나오지 않던 아이가 사흘째 내 품에서 잠들었다.", "현관문을 열 때마다 꼬리가 프로펠러처럼 돈다."] },
      { id: "cat", emoji: "🐈", text: "고양이를 입양한다", grade: "good", effects: { happy: +12, money: -80 }, life: { pet: { kind: "cat", startAge: 1 } }, narratives: ["처음엔 하악질만 하더니, 한 달 뒤 내 배 위에서 골골송을 불렀다.", "키보드 위가 이 아이의 지정석이 됐다."] },
      { id: "shop", emoji: "🛍️", text: "펫숍에서 아기를 데려온다", grade: "mid", effects: { happy: +9, money: -250, social: -1 }, life: { pet: { kind: "any", startAge: 0 } }, narratives: ["손바닥만 한 아기가 왔다. 귀엽지만 마음 한구석이 조금 무겁다."] },
      { id: "volunteer", emoji: "🧤", text: "입양 대신 봉사부터", grade: "good", effects: { happy: +5, social: +5, health: +1 }, narratives: ["주말마다 산책 봉사를 한다. 다음 달엔 정말 데려올지도 모른다."] },
    ],
  }),
  E({
    id: "v2_pet_mischief", repeat: 4, stage: "*", age: [8, 105], emoji: "💥", title: "{pet}의 대형 사고",
    desc: "퇴근하고 문을 열었더니 거실이 전쟁터다. 범인은 해맑은 얼굴로 나를 반긴다.", weight: 1.3,
    hasPet: true,
    choices: [
      { id: "scold", emoji: "😠", text: "단호하게 혼낸다", grade: "mid", effects: { happy: -2 }, narratives: ["귀가 뒤로 접혔다. 3분 뒤 다시 꼬리를 흔들며 왔다. 졌다."] },
      { id: "photo", emoji: "📸", text: "일단 사진부터 찍는다", grade: "good",
        outcomes: [
          { chance: 0.25, effects: { internet: +8, social: +4, happy: +8, money: +100 }, narrative: "'범인 표정 좀 보세요' 게시물이 조회수 200만을 찍었다. 사료 협찬이 들어왔다.", grade: "crit" },
          { chance: 0.75, effects: { happy: +4, internet: +2 }, narrative: "가족 단톡방이 'ㅋㅋㅋ'로 도배됐다. 휴지는 내가 치웠다." },
        ] },
      { id: "train", emoji: "🎓", text: "훈련 교실에 등록한다", grade: "good", effects: { money: -60, happy: +3, intel: +2 }, narratives: ["'앉아'를 배웠다. '기다려'는 아직 철학의 영역이다."] },
      { id: "laugh", emoji: "😂", text: "같이 뒹굴며 웃는다", grade: "good", effects: { happy: +6 }, narratives: ["소파 쿠션 솜 위에서 둘이 한참 뒹굴었다. 세상에서 제일 비싼 놀이였다."] },
    ],
  }),
  E({
    id: "v2_pet_vet", repeat: 5, stage: "*", age: [8, 105], emoji: "🏥", title: "동물병원",
    desc: "{pet}가 밥을 안 먹고 기운이 없다. 수의사가 검사가 필요하다고 한다.", weight: 1.2,
    hasPet: true, petMinAge: 5,
    choices: [
      { id: "all", emoji: "💳", text: "할 수 있는 건 다 해 준다", grade: "good", effects: { money: -400, happy: +3 }, narratives: ["수술은 잘 끝났다. 회복실에서 나를 보자 꼬리를 힘없이 한 번 흔들었다. 그걸로 충분했다."] },
      { id: "basic", emoji: "💊", text: "약으로 지켜본다", grade: "mid",
        outcomes: [
          { chance: 0.7, effects: { money: -60, happy: +2 }, narrative: "일주일 만에 다시 밥그릇을 싹싹 비웠다. 안도의 한숨." },
          { chance: 0.3, effects: { money: -300, happy: -6 }, narrative: "결국 입원했다. 처음부터 검사할걸 그랬다." },
        ] },
      { id: "insurance", emoji: "📄", text: "이참에 펫보험을 든다", grade: "good", effects: { money: -120, intel: +2, happy: +2 }, narratives: ["병원비 영수증을 보고 보험에 감사했다. 어른의 소비였다."] },
    ],
  }),
  E({
    id: "v2_pet_walk_meet", repeat: 5, stage: "*", age: [20, 50], emoji: "🌳", title: "산책길의 인연",
    desc: "{pet}가 공원에서 다른 강아지랑 신나게 논다. 그 강아지 보호자가 웃으며 말을 건다.", weight: 1.3,
    hasPet: true, married: false, relationRequired: { noRomance: true },
    cond: p => p.pets.some(x => x.alive && x.kind === "dog"),
    choices: [
      { id: "talk", emoji: "😊", text: "같이 벤치에 앉아 이야기한다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +10, social: +4 }, narrative: "매일 저녁 7시 같은 공원. 강아지들보다 우리가 더 기다리게 됐다.", relation: { romance: true }, grade: "crit" },
          { chance: 0.45, effects: { happy: +4, social: +5 }, narrative: "좋은 산책 친구가 생겼다. 단톡방 이름은 '견주 모임'.", relation: { friend: "산책 친구", delta: +35 } },
        ] },
      { id: "nod", emoji: "🙇", text: "목례만 하고 지나간다", grade: "mid", effects: { happy: +1 }, narratives: ["{pet}가 아쉬운 듯 몇 번이나 뒤를 돌아봤다."] },
    ],
  }),
  E({
    id: "v2_kid_wants_pet", stage: "*", age: [28, 60], emoji: "🧒", title: "{kid}의 소원",
    desc: "{kid}가 생일 선물로 강아지나 고양이를 키우고 싶다고 한다. 눈빛이 진지하다.", weight: 1.6,
    hasKid: true, hasPet: false, cond: p => p.kids.some(k => { const a = p.age - k.born; return a >= 6 && a <= 13; }),
    choices: [
      { id: "yes", emoji: "🎁", text: "가족회의 끝에 입양한다", grade: "good", effects: { happy: +12, money: -100 }, life: { pet: { kind: "any", startAge: 1 } }, narratives: ["{kid}가 밤새 새 식구 옆에서 잤다. 사진첩에 같은 장면이 수백 장 쌓였다."] },
      { id: "fish", emoji: "🐠", text: "물고기부터 시작하자", grade: "mid", effects: { happy: +3, money: -20 }, narratives: ["어항 속 구피가 매일 늘어난다. {kid}는 그래도 강아지를 원한다."] },
      { id: "no", emoji: "🙅", text: "아직은 안 된다", grade: "mid", effects: { happy: -3 }, narratives: ["{kid}가 방문을 쾅 닫았다. 다음 날 아침엔 강아지 그림을 그려 냉장고에 붙였다."] },
    ],
  }),
  E({
    id: "v2_pet_birthday", repeat: 5, stage: "*", age: [10, 105], emoji: "🎂", title: "{pet}의 생일",
    desc: "오늘은 {pet}가 우리 집에 온 지 또 한 해가 된 날이다.", weight: 1,
    hasPet: true,
    choices: [
      { id: "party", emoji: "🎉", text: "고깔모자에 펫 케이크까지", grade: "good", effects: { happy: +7, money: -10, internet: +2 }, narratives: ["고깔모자를 쓴 채 케이크에 얼굴을 박았다. 올해 최고의 사진."] },
      { id: "walk", emoji: "🌸", text: "제일 좋아하는 길로 긴 산책", grade: "good", effects: { happy: +5, health: +2 }, narratives: ["해 질 녘까지 걸었다. 발자국이 나란히 찍혔다."] },
      { id: "photo", emoji: "📷", text: "함께 사진관에 간다", grade: "good", effects: { happy: +5, money: -15 }, narratives: ["액자 속 우리는 꽤 닮았다. 사람들이 그렇게 말한다."] },
    ],
  }),
  E({
    id: "v2_pet_second", repeat: 8, stage: "*", age: [24, 70], emoji: "🐾", title: "둘째 입양?",
    desc: "{pet}가 혼자 집을 지키는 게 안쓰럽다. 친구를 만들어 줄까?", weight: 0.9,
    hasPet: true, cond: p => p.pets.filter(x => x.alive).length === 1,
    choices: [
      { id: "dog", emoji: "🐕", text: "강아지 동생을 들인다", grade: "good", effects: { happy: +8, money: -100 }, life: { pet: { kind: "dog", startAge: 0 } }, narratives: ["처음엔 서로 냄새만 맡더니, 일주일 뒤 한 방석에서 포개져 잤다."] },
      { id: "cat", emoji: "🐈", text: "고양이 동생을 들인다", grade: "good", effects: { happy: +8, money: -100 }, life: { pet: { kind: "cat", startAge: 0 } }, narratives: ["서열 정리에 한 달. 지금은 서로 그루밍해 준다."] },
      { id: "no", emoji: "🛋️", text: "지금이 딱 좋다", grade: "mid", effects: { happy: +2 }, narratives: ["대신 퇴근을 30분 앞당겼다."] },
    ],
  }),
  E({
    id: "v2_pet_again", stage: "*", age: [20, 85], emoji: "🌈", title: "다시, 작은 발소리",
    desc: "무지개다리를 건넌 아이가 아직도 생각난다. 텅 빈 방석을 치우지 못했다.", weight: 0.9,
    hasPet: false, cond: p => p.pets.some(x => !x.alive) && p.pets.filter(x => !x.alive).every(x => p.age - x.diedAt >= 1),
    choices: [
      { id: "adopt", emoji: "🐾", text: "그 아이를 닮은 아이를 데려온다", grade: "good", effects: { happy: +10 }, life: { pet: { kind: "any", startAge: 2 } }, narratives: ["새 아이가 빈 방석 위에 자리를 잡았다. 떠난 아이가 보내 준 것 같았다."] },
      { id: "memory", emoji: "🖼️", text: "사진을 걸어 두고 추억한다", grade: "mid", effects: { happy: +3 }, narratives: ["사진 속 아이는 여전히 웃고 있다. 그걸로 됐다."] },
      { id: "volunteer", emoji: "🧤", text: "보호소 봉사를 시작한다", grade: "good", effects: { happy: +5, social: +4 }, narratives: ["다른 아이들 산책을 시키며 조금씩 마음이 나았다."] },
    ],
  }),
];
