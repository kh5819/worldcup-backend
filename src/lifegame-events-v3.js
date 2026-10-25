// =========================
// 인생게임 v3 사건 — 인간관계 · 장기 목표 도전 · 기억 · 시대
// 사건 표시(lifegame-systems.js 가 판정):
//   who{rel,status,why,minClose,maxClose,minConflict,age,sameCareer,noPlayer,minYears} = 등장 인물이 있어야 나오고, 본문 {who}가 그 사람
//   parentAlive(true|"father"|"mother") · memReq/memBan(기억) · eduReq · worldReq(시대) · memoFrom({memo}=오래전 큰 사건) · killWho(그 부모님이 떠나심)
// 선택/결과: rel2{close,conflict,reconcile,end,coop,help,helped} = 그 사람과의 관계 변화 · sysGoal(win|fail|prep|drop) = 장기 목표
// 번역 원본: lifegame-tr-src/ev-v3-systems.js
// =========================
const E = o => ({ v: 2, type: "normal", stage: "*", ...o });
const PARENTS = ["father", "mother"];

export const EVENTS_V3 = [
  // ===== 장기 목표 도전(무작위로는 안 나오고, 조건이 되면 시스템이 부른다) =====
  E({
    id: "sys_goal_push", emoji: "🎯", title: "{goal}에 도전할까", followup: true,
    desc: "오래 꿈꿔 온 목표, {goal}. 준비는 충분할까? 지금이 기회일지도 모른다.",
    choices: [
      { id: "go", emoji: "🔥", text: "도전한다", grade: "good",
        outcomes: [
          { chance: 0.5, grade: "crit", sysGoal: "win", effects: { happy: +10, social: +3 }, narrative: "해냈다. {goal}. 오래 그려 온 장면 속에 내가 서 있다. 인생은 여기서 끝나지 않는다 — 다음 장이 시작될 뿐." },
          { chance: 0.5, grade: "bad", sysGoal: "fail", effects: { happy: -6 }, narrative: "이번엔 닿지 않았다. 아쉽지만 무엇이 모자랐는지 알게 됐다. 다음엔 더 가까워질 것이다." },
        ] },
      { id: "prep", emoji: "📚", text: "1년 더 준비한다", sub: "다음 도전 성공률 ↑", grade: "mid", sysGoal: "prep", effects: { intel: +1 }, narratives: ["서두르지 않기로 했다. 부족한 부분을 하나씩 메웠다."] },
      { id: "drop", emoji: "🍃", text: "이 꿈은 내려놓는다", grade: "mid", sysGoal: "drop", effects: { happy: +2 }, narratives: ["어깨가 가벼워졌다. 언젠가 다시 꺼낼지도 모르지만, 지금은 아니다."] },
    ],
  }),

  // ===== 부모님 =====
  E({
    id: "sys_rel_parent_call", age: [22, 65], repeat: 6, emoji: "📞", title: "{who}의 전화", who: { rel: PARENTS },
    desc: "{who}에게서 전화가 왔다. '요즘 얼굴 보기 힘들구나. 이번 주말에 올 수 있니?'",
    choices: [
      { id: "visit", emoji: "🚗", text: "주말에 찾아간다", grade: "good", effects: { happy: +4, money: -30 }, rel2: { close: +10 }, narratives: ["맛있는 걸 잔뜩 먹고 왔다. 돌아오는 길, 차에 반찬통이 가득했다."] },
      { id: "busy", emoji: "📵", text: "바쁘다고 다음에 간다", grade: "mid", effects: {}, rel2: { close: -6, conflict: +5 }, narratives: ["'그래, 바쁘지.' 수화기 너머 목소리가 조금 쓸쓸했다."] },
      { id: "trip", emoji: "🧳", text: "모시고 여행을 간다", grade: "good", effects: { happy: +6, money: -300 }, rel2: { close: +16 }, narratives: ["처음으로 단둘이 여행을 갔다. 사진 속 {who}가 아이처럼 웃었다."] },
    ],
  }),
  E({
    id: "sys_rel_parent_fight", age: [14, 30], repeat: 8, emoji: "💢", title: "{who}와의 말다툼", who: { rel: PARENTS },
    desc: "진로 이야기를 꺼냈다가 {who}와 언성이 높아졌다. '다 너 잘되라고 하는 소리야!'",
    choices: [
      { id: "argue", emoji: "🗯️", text: "할 말은 한다", grade: "mid", effects: { happy: -3, social: +1 }, rel2: { conflict: +25, close: -6 }, narratives: ["문을 쾅 닫고 방에 들어갔다. 그날 밤 식탁엔 아무도 말이 없었다."] },
      { id: "talk", emoji: "🫖", text: "차분히 내 생각을 설명한다", grade: "good",
        outcomes: [
          { chance: 0.6, grade: "good", effects: { intel: +2, happy: +3 }, rel2: { close: +8, conflict: -10 }, narrative: "끝까지 들어 준 {who}가 '네 인생이니까'라고 했다." },
          { chance: 0.4, grade: "mid", effects: { happy: -2 }, rel2: { conflict: +8 }, narrative: "대화는 평행선이었다. 그래도 내 마음은 전했다." },
        ] },
      { id: "obey", emoji: "🙇", text: "일단 참는다", grade: "mid", effects: { happy: -4 }, rel2: { close: +2 }, narratives: ["고개를 끄덕였지만 마음속엔 다른 길이 그려져 있었다."] },
    ],
  }),

  // ===== 화해 · 오래된 인연 =====
  E({
    id: "sys_rel_reconcile", age: [16, 95], repeat: 6, emoji: "🕊️", title: "{who}와 화해할까",
    who: { rel: ["father", "mother", "sibling", "friend", "rival", "colleague"], status: ["active", "ended"], minConflict: 40, noPlayer: true },
    desc: "{who}와 사이가 틀어진 지 꽤 됐다. 문득 휴대폰을 들었다가 내려놓기를 몇 번째.",
    choices: [
      { id: "call", emoji: "📱", text: "먼저 연락한다", grade: "good",
        outcomes: [
          { chance: 0.65, grade: "crit", effects: { happy: +8, social: +3 }, rel2: { reconcile: true }, narrative: "'나도 미안했어.' 그 한마디에 몇 년이 녹아내렸다." },
          { chance: 0.35, grade: "bad", effects: { happy: -4 }, rel2: { conflict: +5 }, narrative: "답장은 오지 않았다. 그래도 먼저 손을 내민 건 후회하지 않는다." },
        ] },
      { id: "wait", emoji: "⏳", text: "아직은 아니다", grade: "mid", effects: {}, narratives: ["시간이 해결해 주겠지. 아마도."] },
    ],
  }),
  E({
    id: "sys_rel_old_friend", age: [25, 90], repeat: 8, emoji: "☎️", title: "연락이 끊겼던 {who}",
    who: { rel: ["friend"], status: ["ended"], why: ["drift"], minYears: 3, noPlayer: true },
    desc: "모르는 번호로 전화가 왔다. '나야, {who}. 기억나?'",
    choices: [
      { id: "meet", emoji: "🍻", text: "당장 만나자고 한다", grade: "good",
        outcomes: [
          { chance: 0.7, grade: "crit", effects: { happy: +8, social: +3 }, rel2: { reconcile: true, close: +20 }, narrative: "몇 년 만인데 어제 본 것 같았다. 그날 새벽까지 이야기가 끝나지 않았다." },
          { chance: 0.3, grade: "mid", effects: { happy: +2 }, rel2: { close: +5 }, narrative: "반가웠지만 서로 많이 변해 있었다. 그래도 연락처를 다시 저장했다." },
        ] },
      { id: "polite", emoji: "🙂", text: "반갑게 인사만 한다", grade: "mid", effects: { happy: +1 }, rel2: { close: +4 }, narratives: ["'언제 밥 한번 먹자.' 진심이었으면 좋겠다."] },
    ],
  }),
  E({
    id: "sys_rel_ex_news", age: [28, 80], repeat: 15, emoji: "💌", title: "옛사람의 소식",
    who: { rel: ["exlover", "ex"], status: ["ended"], minYears: 5, noPlayer: true },
    desc: "SNS에 {who}의 근황이 떴다. 오래전 그 계절이 잠깐 떠올랐다.",
    choices: [
      { id: "wish", emoji: "🌙", text: "마음속으로 행복을 빈다", grade: "good", effects: { happy: +3, intel: +1 }, narratives: ["그때의 나도, 그 사람도 최선이었다. 이제는 웃으며 떠올릴 수 있다."] },
      { id: "msg", emoji: "💬", text: "안부 메시지를 보낸다", grade: "mid",
        outcomes: [
          { chance: 0.5, grade: "good", effects: { happy: +4, social: +2 }, rel2: { close: +10, conflict: -20 }, narrative: "'잘 지내지?' 짧은 대화가 오래된 매듭을 풀어 줬다." },
          { chance: 0.5, grade: "mid", effects: { happy: -2 }, narrative: "읽음 표시만 떴다. 그걸로 됐다." },
        ] },
      { id: "scroll", emoji: "👆", text: "모른 척 넘긴다", grade: "mid", effects: {}, narratives: ["엄지를 올려 화면을 넘겼다. 지난 일은 지난 일."] },
    ],
  }),

  // ===== 친구 =====
  E({
    id: "sys_rel_friend_money", age: [24, 70], repeat: 10, emoji: "💸", title: "{who}의 부탁", who: { rel: ["friend"], minClose: 45 },
    desc: "{who}가 어렵게 말을 꺼냈다. '정말 미안한데… 돈 좀 빌려줄 수 있어? 꼭 갚을게.'",
    choices: [
      { id: "lend", emoji: "🤝", text: "빌려준다", sub: "500만 원", grade: "good",
        outcomes: [
          { chance: 0.6, grade: "good", effects: { happy: +4 }, rel2: { close: +15, help: true }, narrative: "석 달 뒤, {who}가 이자까지 얹어 돌려줬다. '네 덕분에 살았어.'" },
          { chance: 0.4, grade: "bad", effects: { money: -500, happy: -6 }, rel2: { close: -25, conflict: +30 }, narrative: "연락이 점점 뜸해졌다. 돈도, 친구도 잃었다." },
        ] },
      { id: "part", emoji: "🎁", text: "조금만 보탠다", sub: "100만 원", grade: "mid", effects: { money: -100, happy: +2 }, rel2: { close: +6, help: true }, narratives: ["'이거라도 보태.' 큰돈은 아니지만 마음은 전해졌다."] },
      { id: "refuse", emoji: "🙏", text: "정중히 거절한다", grade: "mid", effects: {}, rel2: { close: -8 }, narratives: ["'그래, 이해해.' {who}의 웃음이 조금 어색했다."] },
    ],
  }),
  E({
    id: "sys_rel_friend_coop", age: [25, 60], repeat: 12, emoji: "🛠️", title: "{who}와 함께 해 볼까", who: { rel: ["friend"], minClose: 50 },
    desc: "{who}가 주말 사이드 프로젝트를 같이 하자고 한다. '우리 둘이면 뭔가 될 것 같지 않아?'",
    choices: [
      { id: "join", emoji: "🚀", text: "같이 해 보자", grade: "good",
        outcomes: [
          { chance: 0.5, grade: "crit", effects: { money: +1500, happy: +6, social: +3 }, rel2: { close: +12, coop: true }, narrative: "작은 온라인 가게가 입소문을 탔다. 둘이 나눠 가진 첫 수익에 건배했다." },
          { chance: 0.5, grade: "mid", effects: { money: -300, happy: +2 }, rel2: { close: +6, coop: true }, narrative: "돈은 못 벌었지만 주말마다 웃었다. 남은 건 추억과 재고 상자." },
        ] },
      { id: "no", emoji: "🙅", text: "지금은 여유가 없다", grade: "mid", effects: {}, rel2: { close: -3 }, narratives: ["'다음에 기회 되면.' 서로 아쉬운 웃음."] },
    ],
  }),

  // ===== 형제 =====
  E({
    id: "sys_rel_sibling_care", age: [40, 70], repeat: 10, emoji: "🧓", title: "부모님을 누가 모실까", who: { rel: ["sibling"] }, parentAlive: true,
    desc: "부모님이 혼자 지내시기 힘들어지셨다. {who}와 앞으로를 의논하는 자리.",
    choices: [
      { id: "me", emoji: "🏠", text: "내가 모신다", grade: "good", effects: { happy: +2, money: -1500, health: -2 }, rel2: { close: +10 }, narratives: ["집이 좁아졌지만 저녁 식탁이 시끌벅적해졌다."] },
      { id: "split", emoji: "⚖️", text: "{who}와 비용을 반반 나눈다", grade: "good", effects: { money: -800 }, rel2: { close: +5, coop: true }, narratives: ["역할을 나누니 짐이 가벼워졌다. 형제란 이럴 때 있는 거였다."] },
      { id: "push", emoji: "🙈", text: "{who}에게 미룬다", grade: "mid", effects: { happy: -2 }, rel2: { close: -15, conflict: +30 }, narratives: ["'넌 늘 그런 식이야.' 전화가 거칠게 끊겼다."] },
    ],
  }),

  // ===== 직장 동료 =====
  E({
    id: "sys_rel_colleague", age: [22, 60], repeat: 6, emoji: "🧑‍💼", title: "동료 {who}", who: { rel: ["colleague"], sameCareer: true },
    desc: "마감 직전. {who}가 내 아이디어를 자기 것처럼 발표하려 한다.",
    choices: [
      { id: "confront", emoji: "🗣️", text: "따로 불러 바로잡는다", grade: "mid",
        outcomes: [
          { chance: 0.6, grade: "good", effects: { social: +3, happy: +3 }, rel2: { conflict: +10 }, narrative: "'내가 착각했네, 미안.' 그날 이후 {who}는 공을 꼭 나눴다." },
          { chance: 0.4, grade: "bad", effects: { happy: -4, social: -2 }, rel2: { conflict: +30, close: -15 }, narrative: "분위기가 싸늘해졌다. 앙금이 남았다." },
        ] },
      { id: "team", emoji: "🤜", text: "함께 발표하자고 제안한다", grade: "good", effects: { social: +4 }, rel2: { close: +12, coop: true }, narratives: ["둘이 함께 발표했다. 윗사람이 '좋은 콤비'라고 했다."] },
      { id: "let", emoji: "😮‍💨", text: "그냥 넘어간다", grade: "mid", effects: { happy: -3 }, rel2: { close: -4 }, narratives: ["속은 쓰렸지만 다음을 기약했다."] },
    ],
  }),

  // ===== 연인 · 배우자 · 자녀 =====
  E({
    id: "sys_rel_lover_parents", age: [22, 40], emoji: "🍽️", title: "{who}를 부모님께", who: { rel: ["lover"] }, married: false, parentAlive: true,
    desc: "{who}를 처음으로 부모님께 소개하는 날. 식당 예약까지 마쳤다.",
    choices: [
      { id: "go", emoji: "💐", text: "떨리지만 간다", grade: "good",
        outcomes: [
          { chance: 0.65, grade: "good", effects: { happy: +6 }, rel2: { close: +10 }, narrative: "'참 괜찮은 사람이구나.' 돌아오는 길, {who}가 내 손을 꼭 잡았다." },
          { chance: 0.35, grade: "mid", effects: { happy: -3 }, rel2: { conflict: +10 }, narrative: "분위기가 어색했다. {who}가 '나 마음에 안 드시나 봐'라며 한숨을 쉬었다." },
        ] },
      { id: "later", emoji: "🕰️", text: "아직 이르다", grade: "mid", effects: {}, rel2: { close: -3 }, narratives: ["'언젠가는'이라는 말만 남겼다."] },
    ],
  }),
  E({
    id: "sys_rel_spouse_rough", age: [28, 80], repeat: 6, emoji: "🌧️", title: "{who}와 멀어진 마음", who: { rel: ["spouse"], noPlayer: true }, married: true, cond: p => !!p.spouse && p.spouse.bond < 45,
    desc: "같은 집에 살지만 대화가 사라졌다. 오늘도 {who}와 각자의 방에서 휴대폰만 봤다.",
    choices: [
      { id: "counsel", emoji: "🛋️", text: "부부 상담을 받아 본다", grade: "good",
        outcomes: [
          { chance: 0.65, grade: "good", effects: { happy: +6, money: -200 }, life: { bond: +20 }, rel2: { close: +12, conflict: -20 }, narrative: "처음으로 서로의 서운함을 끝까지 들었다. 돌아오는 길, 손을 잡았다." },
          { chance: 0.35, grade: "bad", effects: { happy: -4, money: -200 }, life: { bond: -5 }, narrative: "상담실에서도 서로 다른 이야기만 했다." },
        ] },
      { id: "trip", emoji: "✈️", text: "둘만의 여행을 간다", grade: "good", effects: { money: -300, happy: +4 }, life: { bond: +12 }, rel2: { close: +8 }, narratives: ["낯선 도시에서 처음 만났을 때처럼 웃었다."] },
      { id: "apart", emoji: "🚪", text: "각자의 시간을 갖자고 한다", grade: "mid",
        outcomes: [
          { chance: 0.6, grade: "mid", effects: { happy: +1 }, life: { bond: -4 }, narrative: "거리를 두니 조금 숨통이 트였다." },
          { chance: 0.4, grade: "bad", effects: { happy: -8, money: -3000 }, life: { divorce: true }, narrative: "별거는 이혼 서류가 되었다. 각자의 길을 가기로 했다." },
        ] },
    ],
  }),
  E({
    id: "sys_rel_kid_talk", age: [35, 80], repeat: 7, emoji: "🧑‍🎓", title: "{who}의 고민", who: { rel: ["kid"], age: [14, 32] },
    desc: "{who}가 오랜만에 진지하게 말을 꺼냈다. '나, 하고 싶은 게 생겼어. 근데 다들 반대해.'",
    choices: [
      { id: "support", emoji: "🙌", text: "네가 하고 싶은 걸 해", grade: "good", effects: { happy: +5, money: -500 }, rel2: { close: +12 }, narratives: ["{who}의 눈이 반짝였다. '역시 우리 집이 최고야.'"] },
      { id: "advice", emoji: "🧭", text: "현실적인 조언을 해 준다", grade: "mid",
        outcomes: [
          { chance: 0.5, grade: "good", effects: { intel: +2 }, rel2: { close: +5 }, narrative: "잔소리처럼 들렸겠지만 {who}는 끝까지 들었다. 몇 년 뒤, 그때 고마웠다고 했다." },
          { chance: 0.5, grade: "mid", effects: { happy: -3 }, rel2: { conflict: +15, close: -5 }, narrative: "'내 맘은 아무도 몰라.' 방문이 닫혔다." },
        ] },
      { id: "story", emoji: "📖", text: "내 젊은 날 이야기를 들려준다", grade: "good", effects: { happy: +4, social: +2 }, rel2: { close: +8 }, narratives: ["실패했던 이야기에 {who}가 웃었다. 그리고 조금 용기를 얻은 얼굴이었다."] },
    ],
  }),

  // ===== 기억 =====
  E({
    id: "sys_mem_crossroad", age: [30, 95], repeat: 12, emoji: "🧭", title: "그때 그 선택", memoFrom: true,
    desc: "오래된 일기장을 펼쳤다. '{memo}' — 그해의 내가 거기 있었다.",
    choices: [
      { id: "grateful", emoji: "🌱", text: "그 덕에 지금의 내가 있다", grade: "good", effects: { happy: +5, intel: +2 }, narratives: ["좋은 일도 나쁜 일도 결국 길이 되었다. 일기장을 덮으며 웃었다."] },
      { id: "regret", emoji: "🌫️", text: "다르게 했다면 어땠을까", grade: "mid", effects: { happy: -2, intel: +3 }, narratives: ["가지 않은 길을 잠시 걸어 봤다. 그리고 지금의 길로 돌아왔다."] },
      { id: "share", emoji: "🗨️", text: "누군가에게 그 이야기를 들려준다", grade: "good", effects: { social: +4, happy: +3 }, narratives: ["내 이야기에 누군가 고개를 끄덕였다. 지난 일이 비로소 의미가 됐다."] },
    ],
  }),
  E({
    id: "sys_mentor", age: [35, 70], repeat: 10, emoji: "🧑‍🏫", title: "후배의 고민 상담", memReq: ["m_goal_fail"], weight: 0.6, cond: p => !!p.career && p.careerStep >= 3,
    desc: "후배가 찾아왔다. '선배는 실패했을 때 어떻게 버텼어요?'",
    choices: [
      { id: "honest", emoji: "🫶", text: "넘어졌던 이야기를 솔직하게", grade: "good", effects: { social: +5, happy: +4 }, narratives: ["실패담을 듣던 후배가 '선배도 그랬구나' 하며 웃었다. 넘어진 경험이 누군가의 지팡이가 됐다."] },
      { id: "tough", emoji: "🪨", text: "버티는 게 답이라고 말한다", grade: "mid", effects: { social: +1 }, narratives: ["'그냥 버텨.' 말해 놓고 보니 예전 선배가 내게 한 말이었다."] },
    ],
  }),

  // ===== 시대 =====
  E({
    id: "sys_era_ai", age: [28, 58], emoji: "🤖", title: "AI 시대의 갈림길", weight: 0.35, cond: p => !!p.career, worldReq: w => w.tech.includes("ai"),
    desc: "일터에 AI가 들어온 뒤 일하는 방식이 송두리째 바뀌었다. 나는 어떻게 할까?",
    choices: [
      { id: "learn", emoji: "🧠", text: "AI를 배운다", grade: "good", effects: { intel: +5, internet: +5, money: -200 }, life: { raise: 1.1 }, narratives: ["밤마다 강의를 들었다. 어느새 AI를 제일 잘 쓰는 사람이 됐다."] },
      { id: "resist", emoji: "✋", text: "내 방식대로 버틴다", grade: "mid",
        outcomes: [
          { chance: 0.5, grade: "mid", effects: { happy: +1 }, narrative: "손으로 하는 일의 가치를 알아주는 사람도 있었다." },
          { chance: 0.5, grade: "bad", effects: { happy: -4 }, life: { raise: 0.92 }, narrative: "점점 일이 줄었다. 시대가 너무 빨리 변했다." },
        ] },
    ],
  }),
  E({
    id: "sys_era_crash", age: [25, 75], repeat: 15, emoji: "🌀", title: "폭락장", worldReq: w => w.econ === "crisis", statMin: { money: 3000 },
    desc: "경제 위기로 주가가 반토막 났다. 뉴스마다 공포다. 내 돈은 어떻게 할까?",
    choices: [
      { id: "buy", emoji: "🛒", text: "지금이 기회 — 산다", grade: "mid",
        outcomes: [
          { chance: 0.55, grade: "crit", effects: { money: +6000, happy: +5 }, narrative: "공포에 샀다. 몇 년 뒤 그 주식이 효자가 됐다." },
          { chance: 0.45, grade: "bad", effects: { money: -3000, happy: -5 }, narrative: "바닥 밑에 지하실이 있었다." },
        ] },
      { id: "hold", emoji: "🧘", text: "그냥 버틴다", grade: "mid", effects: { happy: -2 }, narratives: ["앱을 지웠다. 보지 않으니 덜 아팠다."] },
      { id: "sell", emoji: "🏃", text: "전부 판다", grade: "mid", effects: { money: -1500, happy: +1 }, narratives: ["손해를 확정했다. 그래도 잠은 잘 잤다."] },
    ],
  }),
  E({
    id: "sys_era_boom_house", age: [28, 60], repeat: 10, emoji: "🏠", title: "호황기의 내 집 마련", worldReq: w => w.econ === "boom", statMin: { money: 15000 }, cond: p => p.housing !== "own",
    desc: "집값이 하루가 다르게 오른다. 지금이라도 사야 할까?",
    choices: [
      { id: "buy", emoji: "🔑", text: "영끌해서 산다", grade: "mid",
        outcomes: [
          { chance: 0.6, grade: "good", effects: { money: -2000, happy: +6 }, life: { housing: "own" }, narrative: "열쇠를 받던 날 손이 떨렸다. 이제 내 집이다." },
          { chance: 0.4, grade: "bad", effects: { money: -6000, happy: -3 }, life: { housing: "own" }, narrative: "산 직후가 꼭지였다. 그래도 내 집은 내 집이다." },
        ] },
      { id: "wait", emoji: "⏸️", text: "거품이다, 기다린다", grade: "mid", effects: { happy: -1 }, narratives: ["조급함을 참았다. 시간이 답을 줄 것이다."] },
    ],
  }),
  E({
    id: "sys_era_space", age: [30, 88], emoji: "🚀", title: "우주여행 추첨", worldReq: w => w.tech.includes("space"), statMin: { money: 20000 }, weight: 0.6,
    desc: "민간 우주선 탑승권 추첨에 당첨됐다! 단, 경비가 2억.",
    choices: [
      { id: "go", emoji: "🌌", text: "간다, 우주로!", grade: "crit", effects: { money: -20000, happy: +15 }, narratives: ["무중력 속에서 지구를 봤다. 저 파란 점 위에 내 인생이 다 있었다."] },
      { id: "sell", emoji: "🎫", text: "탑승권을 판다", grade: "good", effects: { money: +5000, happy: +2 }, narratives: ["부자에게 표를 팔았다. 우주는 TV로 봐도 충분히 아름다웠다."] },
    ],
  }),
];

// ===== v3 엔딩(ctx: people·memories·goalsDone·goalHist·achv·mem()·crises) =====
const N = (id, emoji, title, badge, rarity, quote, match, prio) => ({ id, emoji, title, badge, rarity, quote, match, prio });
const friendsClose = ctx => (ctx.people || []).filter(x => x.rel === "friend" && x.status === "active" && x.close >= 70).length;
export const ENDINGS_V3 = [
  N("v3_mp_soulmate", "💒", "같은 세상의 반쪽", "SOULMATE", "hidden", "수많은 인생 중에 하필 같은 시대, 같은 방에서 만났다.", (s, r, ctx) => (ctx.people || []).some(x => x.pid && x.rel === "spouse"), 4.5),
  N("v3_dream_done", "🏔️", "꿈을 끝까지 이룬 사람", "SUMMIT", "rare", "하나씩, 끝까지. 오르고 나서도 삶은 계속됐다.", (s, r, ctx) => { const by = {}; for (const id of ctx.goalsDone || []) { const k = id.slice(0, 2); by[k] = (by[k] || 0) + 1; } return Object.values(by).some(n => n >= 3) && s.happy >= 40; }, 3.8),
  N("v3_seven_falls", "🔥", "칠전팔기의 인생", "NEVER GIVE UP", "rare", "넘어진 횟수만큼 일어났다. 마지막에 웃은 건 포기하지 않은 사람이었다.", (s, r, ctx) => (ctx.goalHist || []).some(h => h.state === "done" && h.fails >= 2), 3.6),
  N("v3_lonely_top", "🗻", "정상의 고독", "ALONE AT THE TOP", "rare", "가장 높은 곳에 올랐다. 내려다보니 곁에 아무도 없었다.", (s, r, ctx) => ctx.careerStep >= 5 && !ctx.married && friendsClose(ctx) === 0 && ctx.kidsCount === 0, 3.3),
  N("v3_late_dream", "🌸", "늦게 핀 꿈", "LATE BLOOM", "rare", "남들보다 늦었다. 그래서 더 오래 향기로웠다.", (s, r, ctx) => { const d = (ctx.goalHist || []).filter(h => h.state === "done"); return d.length > 0 && d[0].at >= 55; }, 3.2),
  N("v3_mp_rival", "⚔️", "평생의 라이벌", "RIVALS", "rare", "그 사람이 없었다면 여기까지 오지 못했을 것이다.", (s, r, ctx) => (ctx.memN("m_rival_win") + ctx.memN("m_rival_lose")) >= 4, 3.1),
  N("v3_crisis_rider", "⛈️", "위기를 기회로", "STORM RIDER", "rare", "폭풍이 올 때마다 돛을 고쳐 달았다.", (s, r, ctx) => (ctx.crises || 0) >= 2 && ctx.rawMoney >= 100000, 2.9),
  N("v3_reconciled", "🕊️", "다시 이어진 인연들", "RECONCILED", "common", "틀어진 실을 다시 잇는 데 평생이 걸렸다. 그래도 이어졌다.", (s, r, ctx) => ctx.memN("m_reconcile") >= 2 && s.happy >= 45, 2.8),
  N("v3_family_root", "🌳", "뿌리 깊은 가족", "FAMILY TREE", "common", "부모님께 받은 사랑을 아이들에게 그대로 물려주었다.", (s, r, ctx) => (ctx.people || []).filter(x => (x.rel === "father" || x.rel === "mother") && x.close >= 75).length >= 2 && ctx.kidsCount >= 2 && s.happy >= 50, 2.7),
  N("v3_true_friends", "🤝", "친구 부자", "FRIENDS", "common", "통장보다 연락처가 든든한 인생이었다.", (s, r, ctx) => friendsClose(ctx) >= 3 && s.happy >= 45, 2.6),
];
// 분석 줄(앞쪽일수록 먼저 보인다)
export const ANALYSIS_V3 = [
  { when: (s, r, ctx) => (ctx.goalsDone || []).length >= 2, text: "목표를 하나씩 이뤄 간 사람. 꿈은 계획이 되고, 계획은 현실이 됐다." },
  { when: (s, r, ctx) => ctx.memN("m_goal_fail") >= 2, text: "여러 번 넘어졌지만 그때마다 다시 일어났다." },
  { when: (s, r, ctx) => ctx.mem("m_reconcile"), text: "틀어진 관계를 다시 잇는 법을 알았다. 먼저 손을 내미는 쪽이었다." },
  { when: (s, r, ctx) => friendsClose(ctx) >= 3, text: "곁에 진짜 친구가 있었다. 그게 가장 큰 재산이었다." },
  { when: (s, r, ctx) => (ctx.people || []).some(x => (x.rel === "father" || x.rel === "mother") && x.close >= 80), text: "부모님과 끝까지 따뜻한 사이였다." },
  { when: (s, r, ctx) => (ctx.crises || 0) >= 2, text: "경제 위기를 여러 번 겪으며 단단해졌다." },
];
