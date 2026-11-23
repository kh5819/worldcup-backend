// =========================
// 플듀 인생게임 REBORN — 결말 유형(인생의 결) 엔진 2026-11-22
// · 기본 유형 + 희귀 유형을 '실제 기록' 조건으로 판정, 한 인생에 여러 개가 동시에 붙는다.
// · 유형마다: 별칭(epithet, 제목에 쓰임) + 문단(그 유형이 왜 붙었는지 기록 수치를 넣어 설명) · 한·日·EN
// · 결말 = 옛 엔진 엔딩(대표) + 여기 유형들(점수 순) + 사용자가 쓴 말 → 조합 수는 수만 가지 이상
// =========================
const V = (ko, ja, en) => ({ ko, ja, en });

export const CAREER_NAME = {
  politics: V("정치인", "政治家", "a politician"), writer: V("작가", "作家", "a writer"), corporate: V("대기업 직장인", "大企業の会社員", "a corporate employee"), worker: V("직장인", "会社員", "an office worker"),
  civil: V("공무원", "公務員", "a civil servant"), developer: V("개발자", "開発者", "a developer"), doctor: V("의사", "医師", "a doctor"), lawyer: V("변호사", "弁護士", "a lawyer"),
  teacher: V("교사", "教師", "a teacher"), idol: V("연예인", "芸能人", "an entertainer"), business: V("사업가", "事業家", "an entrepreneur"), athlete: V("운동선수", "スポーツ選手", "an athlete"),
  artist: V("예술가", "芸術家", "an artist"), streamer: V("유튜버", "YouTuber", "a YouTuber"), gamer: V("프로게이머", "プロゲーマー", "a pro gamer"),
};
const CAREER_BARE = { // 관사 없는 영어 (제목용)
  politics: "Politician", writer: "Writer", corporate: "Corporate Worker", worker: "Office Worker", civil: "Civil Servant", developer: "Developer", doctor: "Doctor", lawyer: "Lawyer",
  teacher: "Teacher", idol: "Entertainer", business: "Entrepreneur", athlete: "Athlete", artist: "Artist", streamer: "YouTuber", gamer: "Pro Gamer",
};

// 직업 × 결과 5가지
const CAREER_OUT = {
  peak: { rare: 0, test: (X, c) => X.careerMax[c] >= 4 ? 40 + X.careerMax[c] * 6 : 0,
    ep: (c) => V(`정점에 선 ${CAREER_NAME[c].ko}`, `頂点に立った${CAREER_NAME[c].ja}`, `The ${CAREER_BARE[c]} at the Summit`),
    tx: (c) => V(`${CAREER_NAME[c].ko}의 길에서 {step}단계까지 올라섰다. {years}년 동안 쌓은 일이 마침내 정점에 닿았다.`, `${CAREER_NAME[c].ja}の道で{step}段階まで上り詰めた。{years}年かけて積み上げた仕事が、ついに頂点に届いた。`, `On the road as ${CAREER_NAME[c].en}, {name} climbed to stage {step}. Work built over {years} years finally reached its peak.`) },
  steady: { rare: 0, test: (X, c) => X.careerYears[c] >= 15 ? 30 + Math.min(30, X.careerYears[c]) : 0,
    ep: (c) => V(`한길을 걸은 ${CAREER_NAME[c].ko}`, `一筋の道を歩んだ${CAREER_NAME[c].ja}`, `The Steadfast ${CAREER_BARE[c]}`),
    tx: (c) => V(`{years}년을 ${CAREER_NAME[c].ko}로 살았다. 화려하지 않아도 오래 버틴 시간이 그 자체로 이력이 되었다.`, `{years}年を${CAREER_NAME[c].ja}として生きた。華やかでなくても、長く続けた時間そのものが経歴になった。`, `{name} spent {years} years as ${CAREER_NAME[c].en}. Not always glamorous, but the long endurance itself became the résumé.`) },
  short: { rare: 0, test: (X, c) => X.careerYears[c] > 0 && X.careerYears[c] < 4 && X.careerN >= 2 ? 22 : 0,
    ep: (c) => V(`잠시 ${CAREER_NAME[c].ko}였던 사람`, `一時期${CAREER_NAME[c].ja}だった人`, `Briefly a ${CAREER_BARE[c]}`),
    tx: (c) => V(`${CAREER_NAME[c].ko}였던 시간은 {years}년으로 짧았다. 짧았지만 그 경험은 다음 길의 밑거름이 되었다.`, `${CAREER_NAME[c].ja}だった時間は{years}年と短かった。短くても、その経験は次の道の肥やしになった。`, `The time as ${CAREER_NAME[c].en} lasted only {years} years — short, yet it fed the road that came next.`) },
  fallen: { rare: 0, test: (X, c) => X.careerFell[c] ? 34 : 0,
    ep: (c) => V(`꺾였던 ${CAREER_NAME[c].ko}`, `挫折した${CAREER_NAME[c].ja}`, `The ${CAREER_BARE[c]} Who Fell`),
    tx: (c) => V(`${CAREER_NAME[c].ko}의 길은 뜻대로 끝나지 않았다. 그 길을 내려놓은 것은 {age}살 무렵이었다. 그러나 삶은 거기서 끝나지 않았다.`, `${CAREER_NAME[c].ja}の道は思い通りには終わらなかった。その道を降りたのは{age}歳の頃だった。けれど人生はそこで終わらなかった。`, `The road as ${CAREER_NAME[c].en} did not end as hoped; it was set down around age {age}. But life did not end there.`) },
  late: { rare: 0, test: (X, c) => X.careerStart[c] >= 40 ? 36 : 0,
    ep: (c) => V(`늦게 시작한 ${CAREER_NAME[c].ko}`, `遅れて始めた${CAREER_NAME[c].ja}`, `The Late-Blooming ${CAREER_BARE[c]}`),
    tx: (c) => V(`${CAREER_NAME[c].ko}의 길을 {age}살에야 시작했다. 늦었다고 말하는 사람도 있었지만, {name|은} 그 길을 걸었다.`, `${CAREER_NAME[c].ja}の道を{age}歳でようやく始めた。遅いと言う人もいたが、{name}はその道を歩いた。`, `{name} only began as ${CAREER_NAME[c].en} at {age}. Some called it late; {name} walked the road anyway.`) },
};

// 손으로 쓴 유형: [id, rare, 점수 함수(X), 별칭, 문단]
const T = (id, rare, test, ep, tx) => ({ id, rare, test, ep, tx });
const HAND = [
  // ---- 돈 (14) ----
  T("m_selfmade", 0, X => X.climb ? 70 : 0, V("맨손으로 일군 사람", "裸一貫で築いた人", "The Self-Made"), V("{family}에서 태어나 최고 {peak}까지 일구었다. 출발선은 낮았지만 도착한 곳은 달랐다.", "{family}に生まれ、最高{peak}まで築き上げた。スタートは低かったが、たどり着いた場所は違った。", "Born into {family}, {name} built up to a peak of {peak}. The starting line was low; the destination was not.")),
  T("m_kept_rich", 0, X => X.famId === "gold" && X.final >= X.first ? 40 : 0, V("물려받은 것을 지킨 사람", "受け継いだものを守った人", "Keeper of an Inheritance"), V("넉넉한 집에서 태어나 그 넉넉함을 끝까지 지켰다. 마지막 재산은 {final}.", "裕福な家に生まれ、その豊かさを最後まで守った。最後の財産は{final}。", "Born comfortable, {name} kept that comfort to the end. Final wealth: {final}.")),
  T("m_lost_rich", 0, X => ["gold", "silver"].includes(X.famId) && X.final < 0 ? 55 : 0, V("가진 것을 잃은 사람", "持っていたものを失った人", "One Who Lost It All"), V("넉넉하게 시작했지만 마지막에는 {final}. 무엇이 흘러갔는지는 경제 기록에 남아 있다.", "豊かに始まったが、最後は{final}。何が流れ出たのかは経済の記録に残っている。", "It began comfortably but ended at {final}. Where it went is written in the money records.")),
  T("m_saver", 0, X => X.peak > 30000 && X.final >= X.peak * 0.8 ? 35 : 0, V("차곡차곡 모은 사람", "こつこつ貯めた人", "The Patient Saver"), V("최고 자산 {peak} 가운데 대부분을 끝까지 지켰다.", "最高資産{peak}のほとんどを最後まで守った。", "Most of the {peak} peak was still there at the end.")),
  T("m_spender", 0, X => X.peak > 30000 && X.final < X.peak * 0.3 ? 38 : 0, V("아낌없이 쓴 사람", "惜しまず使った人", "The Generous Spender"), V("{peakAge}살에 {peak}까지 모았지만, 마지막에는 {final}. 쓰는 데 망설임이 없었다.", "{peakAge}歳で{peak}まで貯めたが、最後は{final}。使うことにためらいがなかった。", "{name} gathered {peak} by {peakAge} but ended with {final}, never shy about spending.")),
  T("m_debt_escape", 0, X => X.debtYears >= 5 && X.final > 0 ? 50 : 0, V("빚을 이겨 낸 사람", "借金に打ち勝った人", "One Who Beat Debt"), V("{debt}년을 빚과 함께 살았지만, 마지막에는 {final}을 남겼다.", "{debt}年を借金と共に過ごしたが、最後には{final}を残した。", "{debt} years were lived in debt, yet {name} left {final} in the end.")),
  T("m_debt_life", 0, X => X.final < 0 ? 42 : 0, V("빚을 안고 간 사람", "借金を抱えて去った人", "Carried Debt to the End"), V("마지막 재산은 {final|이었}다. 형편은 어려웠지만 삶은 끝까지 이어졌다.", "最後の財産は{final}だった。暮らしは苦しくても、人生は最後まで続いた。", "Final wealth was {final}. Times were hard, but life carried on to the end.")),
  T("m_late_wealth", 0, X => X.peakAge >= 60 && X.peak > 20000 ? 40 : 0, V("늦게 넉넉해진 사람", "遅れて豊かになった人", "Comfortable at Last"), V("가장 넉넉했던 때는 {peakAge}살. 삶의 후반에 가장 많이 가졌다.", "最も豊かだったのは{peakAge}歳。人生の後半に最も多く持った。", "The most comfortable year was {peakAge} — wealth came late in life.")),
  T("m_early_peak", 0, X => X.peakAge > 0 && X.peakAge < 40 && X.final < X.peak * 0.5 && X.peak > 20000 ? 40 : 0, V("일찍 정점을 찍은 사람", "早く頂点を迎えた人", "An Early Peak"), V("{peakAge}살에 가장 많이 가졌고, 그 뒤로는 천천히 내려왔다.", "{peakAge}歳で最も多く持ち、その後はゆっくりと下っていった。", "Wealth peaked at {peakAge} and slowly eased down after.")),
  T("m_middle", 0, X => X.final > 0 && X.peak < 80000 && X.debtYears === 0 ? 20 : 0, V("빚 없이 산 사람", "借金なしで生きた人", "Never in Debt"), V("평생 한 해도 빚을 지지 않았다. 크지 않아도 단단한 살림이었다.", "生涯一年も借金をしなかった。大きくはなくても、しっかりした暮らしだった。", "Not a single year in debt. Not big, but a sturdy household.")),
  T("m_poor_happy", 0, X => X.final < 15000 && X.happyAvg >= 62 ? 48 : 0, V("가진 것보다 웃음이 많았던 사람", "持ち物より笑顔が多かった人", "Richer in Laughter than Money"), V("마지막 재산은 {final}, 평균 행복은 {happy}. 숫자 두 개가 서로 다른 이야기를 한다.", "最後の財産は{final}、平均幸福は{happy}。二つの数字は別々の物語を語っている。", "Final wealth {final}, average happiness {happy} — two numbers telling different stories.")),
  T("m_rich_lonely", 0, X => X.peak > 100000 && X.friendsN <= 1 && !X.spouse ? 52 : 0, V("부유했지만 외로웠던 사람", "裕福だったが孤独だった人", "Wealthy but Lonely"), V("최고 {peak}까지 가졌지만, 기록에 남은 친구는 {friends}명이었다.", "最高{peak}まで持ったが、記録に残る友達は{friends}人だった。", "{name} held as much as {peak}, yet the records show {friends} friends.")),
  T("m_poor_people", 0, X => X.final < 20000 && X.peopleN >= 8 ? 46 : 0, V("가난했지만 사람이 많았던 사람", "貧しくても人に恵まれた人", "Poor in Money, Rich in People"), V("재산은 {final}이었지만 곁에는 {people}명의 이름이 있었다.", "財産は{final}だったが、そばには{people}人の名前があった。", "Wealth was {final}, but {people} names stood alongside.")),
  T("m_gambler", 0, X => X.bigMoneyAbs >= 30000 ? 34 : 0, V("크게 걸었던 사람", "大きく賭けた人", "One Who Bet Big"), V("{age}살, 한 번의 결정으로 {v}의 돈이 오갔다.", "{age}歳、一度の決断で{v}のお金が動いた。", "At {age}, a single decision moved {v}.")),
  // ---- 가족 (18) ----
  T("f_long_marriage", 0, X => X.marriedYears >= 40 ? 60 : 0, V("한 사람과 평생을 함께한 사람", "一人の人と生涯を共にした人", "A Lifelong Partnership"), V("{spouse|과} {n}년을 함께 살았다.", "{spouse}と{n}年を共に暮らした。", "{name} and {spouse} shared {n} years.")),
  T("f_late_marriage", 0, X => X.marryAge >= 40 ? 40 : 0, V("늦게 만난 짝", "遅く出会った伴侶", "Love Found Late"), V("{age}살에 결혼했다. 늦었지만 서두르지 않은 만남이었다.", "{age}歳で結婚した。遅くても、急がなかった出会いだった。", "Married at {age} — late, but unhurried.")),
  T("f_early_marriage", 0, X => X.marryAge > 0 && X.marryAge < 26 ? 34 : 0, V("일찍 가정을 꾸린 사람", "早くに家庭を築いた人", "Settled Down Young"), V("{age}살, 이른 나이에 가정을 꾸렸다.", "{age}歳、早くに家庭を築いた。", "At {age}, {name} started a family early.")),
  T("f_divorced", 0, X => X.divorced ? 36 : 0, V("다시 혼자가 된 사람", "再び一人になった人", "Single Again"), V("{age}살, 결혼 생활을 마쳤다. 그 뒤의 삶도 {name}의 것이었다.", "{age}歳、結婚生活を終えた。その後の人生も{name}のものだった。", "At {age}, the marriage ended. The life after was still {name}'s own.")),
  T("f_widowed", 0, X => X.widowed ? 44 : 0, V("먼저 보낸 사람을 기억하는 사람", "先に見送った人を想う人", "One Who Outlived a Spouse"), V("{age}살에 곁의 사람을 먼저 보냈다. 그 뒤의 날들에는 늘 한 사람의 빈자리가 있었다.", "{age}歳でそばの人を先に見送った。その後の日々には、いつも一人分の空席があった。", "At {age}, {name} lost the person beside them; the days after always held one empty seat.")),
  T("f_many_kids", 0, X => X.kidsN >= 3 ? 50 : 0, V("북적이는 집의 주인", "にぎやかな家の主", "Head of a Bustling Home"), V("아이 {n}명과 함께한 집은 늘 시끄러웠다.", "子ども{n}人と過ごした家はいつもにぎやかだった。", "A home with {n} children was never quiet.")),
  T("f_one_kid", 0, X => X.kidsN === 1 ? 28 : 0, V("한 아이의 부모", "一人の子の親", "Parent of One"), V("{kid|이라는} 한 아이를 키웠다.", "{kid}という一人の子を育てた。", "{name} raised one child, {kid}.")),
  T("f_childfree", 0, X => X.kidsN === 0 && X.spouse && X.age >= 50 ? 30 : 0, V("둘이서 꾸린 삶", "二人で築いた暮らし", "A Life for Two"), V("아이 없이 {spouse|과} 둘이 살았다. 둘만의 방식으로 충분한 가족이었다.", "子どもを持たず、{spouse}と二人で暮らした。二人なりのやり方で十分な家族だった。", "No children — just {name} and {spouse}, a complete family in their own way.")),
  T("f_single", 0, X => !X.everMarried && X.age >= 45 ? 40 : 0, V("혼자서도 온전했던 사람", "一人でも満ちていた人", "Whole on Their Own"), V("평생 결혼하지 않았다. 혼자의 시간을 스스로 채운 삶이었다.", "生涯結婚しなかった。一人の時間を自分で満たした人生だった。", "{name} never married — a life that filled its own solitude.")),
  T("f_family_first", 0, X => (X.focus.family || 0) >= 15 ? 46 : 0, V("가족을 위해 산 사람", "家族のために生きた人", "Family Came First"), V("{n}년 동안 가족에 가장 큰 무게를 두었다.", "{n}年間、家族に最も大きな重みを置いた。", "For {n} years, family carried the greatest weight.")),
  T("f_parent_close", 0, X => X.parentClose >= 75 ? 34 : 0, V("부모와 가까웠던 사람", "親と近かった人", "Close to Their Parents"), V("부모님과의 친밀도가 끝까지 {v|이었}다.", "両親との親密度は最後まで{v}だった。", "Closeness with their parents stayed at {v} to the end.")),
  T("f_sibling", 0, X => X.siblingClose >= 70 ? 30 : 0, V("형제와 함께 늙은 사람", "きょうだいと共に年を重ねた人", "Grew Old with Siblings"), V("형제자매와의 정은 오래 이어졌다.", "きょうだいとの情は長く続いた。", "The bond with siblings lasted a long time.")),
  T("f_grand_age", 0, X => X.kidsN > 0 && X.age >= 75 && X.firstKidAge > 0 && X.age - X.firstKidAge >= 45 ? 32 : 0, V("아이의 중년을 본 부모", "子の中年を見届けた親", "Saw Their Child Grow Old"), V("첫 아이가 마흔을 넘기는 것까지 지켜보았다.", "最初の子が四十を過ぎるところまで見届けた。", "{name} lived to see their first child pass forty.")),
  T("f_pets", 0, X => X.petsN >= 3 ? 40 : 0, V("동물들과 산 사람", "動物たちと暮らした人", "A Life Among Animals"), V("반려동물 {n}마리와 시간을 나눴다.", "ペット{n}匹と時間を分かち合った。", "{name} shared their years with {n} pets.")),
  T("f_dog", 0, X => X.dogN >= 1 && X.catN === 0 ? 22 : 0, V("개와 걸은 사람", "犬と歩いた人", "Walked with Dogs"), V("산책길에는 늘 개가 함께였다.", "散歩道にはいつも犬がいた。", "There was always a dog on the walk.")),
  T("f_cat", 0, X => X.catN >= 1 && X.dogN === 0 ? 22 : 0, V("고양이와 산 사람", "猫と暮らした人", "Lived with Cats"), V("창가에는 늘 고양이가 있었다.", "窓辺にはいつも猫がいた。", "There was always a cat by the window.")),
  T("f_small", 0, X => X.smallN >= 1 && X.dogN === 0 && X.catN === 0 ? 22 : 0, V("작은 친구와 산 사람", "小さな友と暮らした人", "Lived with Little Friends"), V("어항 속 물소리, 쳇바퀴 소리, 작은 숨소리가 늘 곁에 있었다.", "水槽の音、回し車の音、小さな寝息がいつもそばにあった。", "The bubbling tank, the squeaky wheel, a tiny breath — always nearby."), "family"),
  T("f_orphan", 0, X => X.parentsLostBefore30 ? 44 : 0, V("일찍 홀로 선 사람", "早くに一人立ちした人", "Stood Alone Early"), V("서른이 되기 전에 부모님을 떠나보냈다.", "三十歳になる前に両親を見送った。", "{name} said goodbye to their parents before thirty.")),
  T("f_caregiver", 0, X => X.parentsLost >= 2 && (X.focus.family || 0) >= 8 ? 30 : 0, V("곁을 지킨 사람", "そばを守った人", "One Who Stayed Close"), V("부모님의 마지막을 곁에서 지켰다.", "両親の最期をそばで見守った。", "{name} stayed beside their parents at the end.")),
  // ---- 사랑 (10) ----
  T("l_many", 0, X => X.loveDec >= 8 ? 44 : 0, V("사랑을 여러 번 한 사람", "何度も恋をした人", "Loved More than Once"), V("사랑과 인연에 관한 결정만 {n}번 내렸다.", "恋と縁にまつわる決断を{n}回下した。", "{n} decisions in this life were about love.")),
  T("l_first", 0, X => X.marryAge > 0 && X.marryAge <= 27 && !X.divorced ? 34 : 0, V("첫사랑과 걸어간 사람", "初恋と歩いた人", "Walked On with a First Love"), V("젊은 날 만난 사람과 끝까지 함께했다.", "若い日に出会った人と最後まで共にした。", "{name} stayed with someone met in their youth.")),
  T("l_none", 0, X => X.loveDec === 0 && X.age >= 40 ? 26 : 0, V("사랑보다 다른 것을 본 사람", "恋より別のものを見た人", "Eyes on Other Things"), V("사랑에 관한 결정은 기록에 없다. 마음은 다른 곳에 있었다.", "恋に関する決断は記録にない。心は別の場所にあった。", "No decisions about love appear in the records; the heart was elsewhere.")),
  T("l_bitter", 0, X => X.loveBad >= 3 ? 34 : 0, V("사랑에 아팠던 사람", "恋に傷ついた人", "Hurt by Love"), V("사랑의 선택 가운데 {n}번이 뜻대로 되지 않았다.", "恋の選択のうち{n}回は思い通りにならなかった。", "{n} choices about love did not go as hoped.")),
  T("l_romantic", 0, X => (X.focus.love || 0) >= 10 ? 36 : 0, V("인연을 좇은 사람", "縁を追った人", "Chaser of Connection"), V("{n}년 동안 사랑과 인연에 마음을 쏟았다.", "{n}年間、恋と縁に心を注いだ。", "For {n} years, love and connection came first.")),
  T("l_remarry", 0, X => X.marriedTwice ? 46 : 0, V("두 번째 사랑을 만난 사람", "二度目の愛に出会った人", "Found Love Again"), V("한 번의 끝 뒤에 다시 누군가와 삶을 나눴다.", "一度の終わりのあと、もう一度誰かと人生を分かち合った。", "After one ending, {name} shared life with someone again.")),
  // ---- 수명·건강 (16) ----
  T("a_100", 1, X => X.age >= 100 ? 95 : 0, V("백 년을 산 사람", "百年を生きた人", "A Century Lived"), V("{age}살. 한 세기를 넘겨 살았다.", "{age}歳。一世紀を越えて生きた。", "{age} years — more than a century.")),
  T("a_90", 0, X => X.age >= 90 && X.age < 100 ? 55 : 0, V("아흔을 넘긴 사람", "九十を越えた人", "Past Ninety"), V("{age}살까지 살았다.", "{age}歳まで生きた。", "{name} lived to {age}.")),
  T("a_80", 0, X => X.age >= 80 && X.age < 90 ? 30 : 0, V("긴 세월을 건넌 사람", "長い歳月を渡った人", "Crossed the Long Years"), V("여든을 넘겨 {age}살까지 살았다.", "八十を越えて{age}歳まで生きた。", "Past eighty, to {age}.")),
  T("a_young", 0, X => X.age < 40 && X.age >= 20 ? 60 : 0, V("너무 이르게 떠난 사람", "早すぎる旅立ちの人", "Gone Too Soon"), V("{age}살. 너무 이른 작별이었다.", "{age}歳。早すぎる別れだった。", "{age}. A goodbye that came too soon.")),
  T("a_child", 0, X => X.age < 20 ? 80 : 0, V("짧게 머문 아이", "短くとどまった子", "A Brief Stay"), V("{age}년을 머물다 갔다.", "{age}年とどまって旅立った。", "{name} stayed for {age} years.")),
  T("h_strong", 0, X => X.powerMax >= 90 ? 34 : 0, V("단단한 몸으로 산 사람", "丈夫な体で生きた人", "Strong in Body"), V("체력이 한때 {v}까지 올랐다.", "体力が一時{v}まで上がった。", "Stamina once reached {v}.")),
  T("h_keeper", 0, X => (X.focus.health || 0) >= 12 ? 38 : 0, V("건강을 돌본 사람", "健康を大切にした人", "Tended Their Health"), V("{n}년을 건강에 마음을 썼다.", "{n}年、健康に気を配った。", "{n} years spent caring for health.")),
  T("h_overwork", 0, X => X.cause === "overwork" ? 60 : 0, V("일에 모든 것을 건 사람", "仕事にすべてを懸けた人", "Gave Everything to Work"), V("떠난 이유는 과로였다. 일은 끝까지 {name}의 곁에 있었다.", "旅立った理由は過労だった。仕事は最後まで{name}のそばにあった。", "The cause was overwork; work stayed beside {name} to the very end.")),
  T("h_overcome", 0, X => X.healthMin < 25 && X.age - X.healthMinAge >= 15 ? 52 : 0, V("아픔을 넘어선 사람", "病を越えた人", "Came Through Illness"), V("{a}살에 건강이 {v}까지 떨어졌지만, 그 뒤로 {n}년을 더 살았다.", "{a}歳で健康が{v}まで落ちたが、その後{n}年を生きた。", "Health fell to {v} at {a}, yet {name} lived {n} more years.")),
  T("h_healthy_end", 0, X => X.age >= 80 && X.healthEnd >= 55 ? 40 : 0, V("끝까지 정정했던 사람", "最後まで元気だった人", "Hale to the End"), V("{age}살에도 건강은 {v|이었}다.", "{age}歳でも健康は{v}だった。", "Even at {age}, health stood at {v}.")),
  T("h_fragile_long", 0, X => X.healthMin < 35 && X.age >= 80 ? 46 : 0, V("약했지만 오래 산 사람", "弱くても長く生きた人", "Frail Yet Long-Lived"), V("몸은 약했지만 {age}살까지 살았다.", "体は弱かったが{age}歳まで生きた。", "Never strong, yet {name} lived to {age}.")),
  T("h_rest", 0, X => (X.focus.rest || 0) >= 10 ? 28 : 0, V("쉼을 아는 사람", "休むことを知る人", "Knew How to Rest"), V("{n}년을 쉼에 두었다.", "{n}年を休息に充てた。", "{n} years given to rest.")),
  T("h_stress", 0, X => X.stressAvg >= 60 ? 36 : 0, V("늘 무언가를 짊어진 사람", "いつも何かを背負っていた人", "Always Carrying Something"), V("평균 스트레스가 {v|이었}다. 쉬운 날은 많지 않았다.", "平均ストレスは{v}だった。楽な日は多くなかった。", "Average stress was {v}; easy days were few.")),
  T("h_light", 0, X => X.stressAvg <= 30 ? 34 : 0, V("가볍게 산 사람", "身軽に生きた人", "Lived Lightly"), V("평균 스트레스는 {v}. 마음이 가벼운 날이 많았다.", "平均ストレスは{v}。心の軽い日が多かった。", "Average stress: {v}. Most days, the heart was light.")),
  // ---- 사람 (10) ----
  T("p_many", 0, X => X.peopleN >= 12 ? 40 : 0, V("사람 부자", "人に恵まれた人", "Rich in People"), V("기록에 남은 사람이 {n}명이었다.", "記録に残る人は{n}人だった。", "{n} people appear in the records.")),
  T("p_friends", 0, X => X.friendsN >= 5 ? 38 : 0, V("친구가 많았던 사람", "友達の多かった人", "Many Friends"), V("{n}명의 친구가 있었다.", "{n}人の友達がいた。", "{name} had {n} friends.")),
  T("p_rivals", 0, X => X.foesN >= 2 ? 30 : 0, V("앙숙도 있었던 사람", "犬猿の仲もいた人", "Had Rivals Too"), V("{n}명과는 끝내 화해하지 못했다.", "{n}人とは最後まで和解できなかった。", "{name} never made peace with {n} people.")),
  T("p_lone", 0, X => X.friendsN === 0 && X.age >= 30 ? 32 : 0, V("혼자 걸은 사람", "一人で歩いた人", "Walked Alone"), V("기록에 남은 친구는 없었다. 혼자 걷는 길도 길이었다.", "記録に残る友達はいなかった。一人で歩く道も道だった。", "No friends appear in the records. A solitary road is still a road.")),
  T("p_social", 0, X => X.socialAvg >= 72 ? 34 : 0, V("사람을 좋아한 사람", "人が好きだった人", "A People Person"), V("평균 사회성 {v}. 사람 곁이 편했다.", "平均社交性{v}。人のそばが心地よかった。", "Average sociability {v}; being around people felt right.")),
  T("p_friends_focus", 0, X => (X.focus.friends || 0) >= 10 ? 32 : 0, V("우정을 쌓은 사람", "友情を積み重ねた人", "Builder of Friendships"), V("{n}년을 사람들에게 마음을 썼다.", "{n}年、人づきあいに心を砕いた。", "{n} years devoted to friends.")),
  T("p_lost_many", 0, X => X.peopleLost >= 5 ? 36 : 0, V("많은 이별을 겪은 사람", "多くの別れを経た人", "Saw Many Goodbyes"), V("먼저 떠나보낸 사람이 {n}명이었다.", "先に見送った人は{n}人だった。", "{name} said goodbye to {n} people.")),
  // ---- 꿈 (6) ----
  T("d_done", 1, X => X.dreamDone === true ? 88 : 0, V("어릴 적 꿈을 이룬 사람", "子どもの頃の夢を叶えた人", "The Childhood Dream, Fulfilled"), V("'{dream}'. 이 꿈은 이루어졌다.", "「{dream}」。この夢は叶った。", "\"{dream}\" — this dream came true.")),
  T("d_miss_happy", 0, X => X.dreamDone === false && X.happyAvg >= 60 ? 44 : 0, V("다른 길에서 행복을 찾은 사람", "別の道で幸せを見つけた人", "Found Happiness Elsewhere"), V("꿈 '{dream}'과는 다른 길을 걸었지만 평균 행복은 {happy|이었}다.", "夢「{dream}」とは違う道を歩いたが、平均幸福は{happy}だった。", "The road differed from the dream \"{dream}\", yet average happiness was {happy}.")),
  T("d_miss", 0, X => X.dreamDone === false && X.happyAvg < 60 ? 38 : 0, V("꿈을 마음에 품고 산 사람", "夢を胸に抱いて生きた人", "Carried the Dream Inside"), V("'{dream}' — 이루지 못한 꿈은 끝까지 마음 한쪽에 있었다.", "「{dream}」 — 叶わなかった夢は最後まで心の片隅にあった。", "\"{dream}\" — the unfulfilled dream stayed in a corner of the heart.")),
  T("d_recalled", 0, X => X.recallsN >= 4 ? 34 : 0, V("자신의 말을 잊지 않은 사람", "自分の言葉を忘れなかった人", "Remembered Their Own Words"), V("직접 남긴 말이 삶 속에서 {n}번 다시 떠올랐다.", "自分で残した言葉が人生の中で{n}回よみがえった。", "Words {name} wrote came back {n} times over the years.")),
  T("d_writer_words", 0, X => X.wordsN >= 300 ? 30 : 0, V("기록하는 사람", "書き残す人", "One Who Wrote Things Down"), V("삶 동안 직접 쓴 글자가 {n}자였다.", "生涯で自分で書いた文字は{n}字だった。", "{n} characters written in their own hand.")),
  T("d_nodream", 0, X => X.noDream && X.age >= 30 ? 20 : 0, V("오늘을 산 사람", "今日を生きた人", "Lived for Today"), V("꿈을 적지 않았다. 그날그날의 선택이 곧 삶이 되었다.", "夢を書かなかった。その日その日の選択がそのまま人生になった。", "No dream was written; each day's choices became the life.")),
  // ---- 집 (6) ----
  T("h_own", 0, X => X.housing === "own" ? 26 : 0, V("내 집을 가진 사람", "自分の家を持った人", "Owned a Home"), V("마지막에는 자기 집에 살았다.", "最後は自分の家に住んでいた。", "In the end, {name} lived in a home of their own.")),
  T("h_parents_long", 0, X => X.parentsHomeUntil >= 33 ? 26 : 0, V("오래 부모님 곁에 산 사람", "長く親元で暮らした人", "Long at the Family Home"), V("{a}살까지 부모님 집에 살았다.", "{a}歳まで実家で暮らした。", "{name} lived at the family home until {a}.")),
  T("h_renter", 0, X => X.housing === "rent" && X.age >= 55 ? 26 : 0, V("셋집을 옮겨 다닌 사람", "借家を移り住んだ人", "A Lifetime of Renting"), V("마지막까지 셋집에 살았다.", "最後まで借家に住んだ。", "{name} rented to the end.")),
  T("h_moves", 0, X => X.moves >= 3 ? 24 : 0, V("자주 짐을 싼 사람", "よく荷造りした人", "Often Packing Boxes"), V("사는 곳이 {n}번 바뀌었다.", "住まいが{n}回変わった。", "Home changed {n} times.")),
  // ---- 운·운명 (6) ----
  T("x_lucky", 0, X => X.fatesGood >= 4 ? 34 : 0, V("운이 따른 사람", "運に恵まれた人", "Favored by Luck"), V("뜻밖의 행운이 {n}번 찾아왔다.", "思いがけない幸運が{n}回訪れた。", "Unexpected luck arrived {n} times.")),
  T("x_storms", 0, X => X.fatesBad >= 4 ? 40 : 0, V("폭풍을 견딘 사람", "嵐に耐えた人", "Weathered the Storms"), V("고를 수 없는 불운이 {n}번 닥쳤지만 견뎠다.", "選べない不運が{n}回襲ったが、耐えた。", "Unchosen misfortune struck {n} times, and {name} endured.")),
  T("x_bold_choices", 0, X => X.crit >= 6 ? 34 : 0, V("큰 선택이 통한 사람", "大きな選択が実った人", "Bold Choices Paid Off"), V("크게 잘된 선택이 {n}번 있었다.", "大成功の選択が{n}回あった。", "{n} choices turned out brilliantly.")),
  T("x_tangled", 0, X => X.bad >= 8 ? 34 : 0, V("꼬인 매듭을 풀며 산 사람", "もつれを解きながら生きた人", "Untangled Many Knots"), V("{n}번의 선택이 꼬였지만, 삶은 계속되었다.", "{n}回の選択が裏目に出たが、人生は続いた。", "{n} choices went wrong, and life went on.")),
  T("x_ordinary", 0, X => X.majorN <= 3 && X.age >= 60 ? 40 : 0, V("평범함을 끝까지 지킨 사람", "平凡を最後まで守った人", "Kept to an Ordinary Life"), V("삶을 뒤흔든 결정은 {n}번뿐이었다. 큰 파도 없이 오래 이어진 삶이었다.", "人生を揺るがす決断は{n}回だけだった。大きな波のない、長く続いた人生だった。", "Only {n} decisions shook this life — a long life without great waves.")),
  T("x_turbulent", 0, X => X.majorN >= 14 ? 40 : 0, V("굴곡이 많았던 사람", "起伏の多かった人", "A Life of Many Turns"), V("삶을 바꾼 결정이 {n}번이었다.", "人生を変えた決断は{n}回だった。", "{n} decisions changed the course of this life.")),
  // ---- 희귀 (특별 결말) ----
  T("r_dirt_to_rich", 1, X => X.famId === "dirt" && X.peak >= 200000 ? 92 : 0, V("극적인 신분 상승", "劇的な成り上がり", "A Dramatic Rise"), V("가장 어려운 집에서 태어나 {peak}까지 올랐다.", "最も厳しい家に生まれ、{peak}まで上り詰めた。", "Born into the hardest circumstances, {name} rose to {peak}.")),
  T("r_late_reversal", 1, X => X.minAfter50 < 0 && X.final >= 50000 ? 88 : 0, V("인생 후반의 대역전", "人生後半の大逆転", "The Late-Life Comeback"), V("쉰 이후에도 빚이 있었지만, 마지막에는 {final}을 남겼다.", "五十歳を過ぎても借金があったが、最後には{final}を残した。", "Still in debt past fifty, {name} ended with {final}.")),
  T("r_three_falls", 1, X => X.bizTries >= 3 && X.careerMax.business >= 4 ? 90 : 0, V("세 번 넘어지고 일어선 사업가", "三度倒れて立ち上がった事業家", "Fell Three Times, Rose Again"), V("사업에 {n}번 도전한 끝에 정점에 섰다.", "事業に{n}回挑んだ末に頂点に立った。", "After {n} attempts at business, {name} reached the top.")),
  T("r_one_job", 1, X => X.longestJobYears >= 36 && X.jobsN <= 2 ? 86 : 0 /* 11-22: 32→36 (약 4%) */, V("평생 한 가지 일", "生涯ひとつの仕事", "One Job for a Lifetime"), V("'{job}'으로 {n}년을 일했다.", "「{job}」として{n}年働いた。", "{n} years as \"{job}\".")),
  T("r_influence", 1, X => X.fameMax >= 80 ? 86 : 0, V("많은 사람의 삶에 닿은 사람", "多くの人の人生に触れた人", "Touched Many Lives"), V("명성이 {v}까지 올랐다. 이름이 많은 사람에게 닿았다.", "名声が{v}まで上がった。名前が多くの人に届いた。", "Fame reached {v}; the name reached many people.")),
  T("r_balance", 1, X => X.balancedAt60 ? 84 : 0, V("모든 것을 고르게 가꾼 사람", "すべてを均等に育てた人", "Everything in Balance"), V("예순에 모든 능력치가 고르게 높았다.", "六十歳ですべての能力値が均等に高かった。", "At sixty, every ability stood evenly high.")),
  T("r_survivor", 1, X => X.fatesBad >= 12 && X.age >= 80 ? 86 : 0 /* 11-22: 6→12 (약 5%만, 희귀 유지) */, V("모든 폭풍을 지나온 사람", "すべての嵐を越えた人", "Survived Every Storm"), V("불운 {n}번을 지나 {age}살까지 살았다.", "不運{n}回を越えて{age}歳まで生きた。", "Through {n} misfortunes, {name} lived to {age}.")),
  T("r_happy_life", 1, X => X.happyAvg >= 88 ? 90 : 0 /* 11-22: 78→88 (상위 4%만) */, V("행복으로 가득했던 삶", "幸せに満ちた人生", "A Life Full of Happiness"), V("평생 평균 행복이 {happy|이었}다.", "生涯の平均幸福は{happy}だった。", "Lifetime average happiness: {happy}.")),
  T("r_all_words", 1, X => X.allPrompts ? 80 : 0, V("모든 물음에 답한 사람", "すべての問いに答えた人", "Answered Every Question"), V("삶이 던진 모든 질문에 직접 답을 적었다.", "人生が投げかけたすべての問いに、自分で答えを書いた。", "{name} wrote an answer to every question life asked.")),
  T("r_grand_family", 1, X => X.kidsN >= 4 && X.marriedYears >= 40 ? 88 : 0, V("큰 나무 같은 집안", "大樹のような一家", "A Family Like a Great Tree"), V("아이 {n}명, 결혼 생활 {m}년.", "子ども{n}人、結婚生活{m}年。", "{n} children and {m} years of marriage.")),
  T("r_many_pets", 1, X => X.petsN >= 5 ? 82 : 0, V("동물들의 오랜 친구", "動物たちの古い友", "Old Friend to Many Animals"), V("반려동물 {n}마리와 생을 함께했다.", "ペット{n}匹と生涯を共にした。", "{n} pets shared this life.")),
  T("r_scholar", 1, X => X.intelTopYears >= 40 ? 82 : 0 /* 11-22: 지능 95 이상으로 40년 (최고치 100이 흔해져서) */, V("앎을 끝까지 좇은 사람", "知を最後まで追った人", "Pursued Knowledge to the End"), V("지능이 {v}까지 올랐다.", "知能が{v}まで上がった。", "Intelligence reached {v}.")),
  T("r_comeback_health", 1, X => X.healthMin < 15 && X.age >= 75 ? 86 : 0, V("기적처럼 회복한 사람", "奇跡のように回復した人", "A Miraculous Recovery"), V("건강이 {v}까지 떨어졌지만 {age}살까지 살았다.", "健康が{v}まで落ちたが、{age}歳まで生きた。", "Health fell to {v}, yet {name} lived to {age}.")),
  T("r_every_stage_gold", 1, X => X.goldStages >= 1 && X.darkStages === 0 && X.age >= 85 && X.happyAvg >= 84 && X.healthMin >= 40 ? 80 : 0 /* 11-22: 더 희귀하게 */, V("시련기 없는 삶", "試練のなかった人生", "A Life Without a Dark Age"), V("어느 시기도 나쁜 일이 좋은 일보다 많지 않았다.", "どの時期も悪いことが良いことより多くはならなかった。", "In no period did the bad outnumber the good.")),
];

// 초점·가치·성격·관심·고향·황금기·시련기·출신 집안 (자동 생성 계열)
const AUTO = [];
const FOCUS_IDS = ["study", "work", "love", "family", "health", "money", "play", "friends", "rest"];
const FOCUS_EP = {
  study: V("배움에 빠졌던 사람", "学びに没頭した人", "Lost in Learning"), work: V("일에 몰두한 사람", "仕事に打ち込んだ人", "Devoted to Work"), love: V("사랑에 마음을 쓴 사람", "恋に心を注いだ人", "Heart Given to Love"),
  family: V("가족의 울타리", "家族の垣根", "The Family's Fence"), health: V("몸을 아낀 사람", "体をいたわった人", "Cared for the Body"), money: V("내일을 준비한 사람", "明日に備えた人", "Prepared for Tomorrow"),
  play: V("즐거움을 아는 사람", "楽しみを知る人", "Knew How to Enjoy"), friends: V("사람을 모은 사람", "人を集めた人", "Gathered People"), rest: V("천천히 걸은 사람", "ゆっくり歩いた人", "Walked Slowly"),
};
for (const f of FOCUS_IDS) AUTO.push(T("fo_" + f, 0, X => X.focusTop === f && (X.focus[f] || 0) >= 12 ? 26 + Math.min(14, X.focus[f] - 12) : 0, FOCUS_EP[f], V(`가장 오래 둔 초점은 '{focus}' — {n}년.`, `最も長く置いた焦点は「{focus}」 — {n}年。`, `The longest focus was "{focus}" — {n} years.`)));
const VALUE_IDS = ["family", "freedom", "success", "love", "health", "wealth", "friends", "knowledge", "contribution", "fun"];
const VALUE_LIVE = { family: X => X.kidsN > 0 || X.marriedYears >= 10 || (X.focus.family || 0) >= 8, freedom: X => !X.everMarried || X.moves >= 3 || (X.focus.play || 0) >= 8, success: X => X.careerMaxAny >= 4, love: X => X.everMarried || X.loveDec >= 4, health: X => X.age >= 80 || (X.focus.health || 0) >= 8, wealth: X => X.peak >= 80000, friends: X => X.friendsN >= 3, knowledge: X => X.intelMax >= 80 || (X.focus.study || 0) >= 8, contribution: X => X.fameMax >= 50 || ["teacher", "doctor", "civil"].includes(X.mainCareer), fun: X => X.happyAvg >= 60 || (X.focus.play || 0) >= 8 };
for (const v of VALUE_IDS) {
  AUTO.push(T("v_kept_" + v, 0, X => X.values.includes(v) && VALUE_LIVE[v](X) ? 42 : 0, V(`'{value}'{valueJosa} 지킨 사람`, `「{value}」を守った人`, `Held On to {valueCap}`), V(`처음 고른 가치 '{value}'. 기록을 보면 이 가치는 실제 삶에서도 지켜졌다.`, `最初に選んだ価値「{value}」。記録を見ると、この価値は実際の人生でも守られていた。`, `The value chosen at the start was "{value}". The records show it was lived out.`)));
  AUTO.push(T("v_changed_" + v, 0, X => X.values.includes(v) && !VALUE_LIVE[v](X) ? 34 : 0, V(`'{value}' 너머를 본 사람`, `「{value}」の先を見た人`, `Looked Beyond {valueCap}`), V(`처음엔 {value|q이} 가장 중요하다고 했지만, 삶은 다른 쪽으로 흘렀다. 가치관은 살아가며 바뀌었다.`, `初めは「{value}」が一番大切だと言ったが、人生は別の方へ流れた。価値観は生きる中で変わった。`, `At first "{value}" mattered most, but life flowed elsewhere; values changed along the way.`)));
}
const PERSONA_IDS = ["bold", "calm", "curious", "warm", "stubborn", "dreamy", "careful", "funny"];
const PERSONA_STAT = { bold: "luck", calm: "health", curious: "intel", warm: "social", stubborn: "power", dreamy: "happy", careful: "intel", funny: "social" };
for (const pz of PERSONA_IDS) {
  AUTO.push(T("ps_kept_" + pz, 0, X => X.persona.includes(pz) && X.shift[PERSONA_STAT[pz]] >= -5 ? 30 : 0, V(`끝까지 {persona} 사람`, `最後まで{persona}人`, `{personaCap} to the End`), V(`스스로를 '{persona}' 사람이라 했고, 그 결은 끝까지 남았다.`, `自分を「{persona}」人だと言い、その筋目は最後まで残った。`, `{name} called themself {persona}, and that grain remained to the end.`)));
  AUTO.push(T("ps_changed_" + pz, 0, X => X.persona.includes(pz) && X.shift[PERSONA_STAT[pz]] < -5 ? 36 : 0, V(`{persona} 아이가 자라서`, `{persona}子が大人になって`, `The {persona} Child, Grown`), V(`어릴 적엔 '{persona}' 사람이었지만, 세월이 그 모습을 바꾸었다.`, `幼い頃は「{persona}」人だったが、歳月がその姿を変えた。`, `Once {persona}, {name} was reshaped by the years.`)));
}
const INTEREST_IDS = ["art", "music", "sports", "science", "books", "games", "travel", "cooking", "nature", "money", "people", "tech"];
for (const it of INTEREST_IDS) AUTO.push(T("in_" + it, 0, X => X.interests.includes(it) && ((X.focus.play || 0) + (X.focus.study || 0)) >= 8 ? 30 : 0, V(`평생 {interest}{interestJosa} 곁에 둔 사람`, `生涯{interest}をそばに置いた人`, `A Lifelong Love of {interestCap}`), V(`처음 고른 관심사 '{interest}'. 즐기고 배우는 데 {n}년을 썼다.`, `最初に選んだ関心事「{interest}」。楽しみ学ぶのに{n}年を使った。`, `The interest chosen at the start was "{interest}"; {n} years went into enjoying and learning.`)));
const REGIONS = ["seoul", "busan", "incheon", "daegu", "daejeon", "gwangju", "ulsan", "gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang", "jeju"];
for (const rg of REGIONS) AUTO.push(T("rg_" + rg, 0, X => X.region === rg ? 12 : 0, V(`{region}의 아이`, `{region}の子`, `A Child of {region}`), V(`{region}에서 태어났다.`, `{region}で生まれた。`, `Born in {region}.`)));
const STAGES = ["infant", "child", "teen", "adult", "midlife", "senior", "elder"];
const STAGE_EP = { infant: V("빛나는 유년", "輝く幼年期", "A Radiant Childhood"), child: V("반짝이던 어린 시절", "きらめいた子ども時代", "A Sparkling Boyhood/Girlhood"), teen: V("뜨거웠던 십대", "熱かった十代", "A Blazing Adolescence"), adult: V("눈부신 청춘", "まぶしい青春", "A Dazzling Youth"), midlife: V("무르익은 중년", "熟した中年", "A Ripened Midlife"), senior: V("빛나는 은퇴 후", "輝く引退後", "A Golden Retirement"), elder: V("따뜻한 황혼", "温かな黄昏", "A Warm Twilight") };
const STAGE_DARK = { infant: V("힘겨웠던 유년", "苦しかった幼年期", "A Hard Early Childhood"), child: V("그늘진 어린 시절", "陰のある子ども時代", "A Shadowed Childhood"), teen: V("흔들리던 십대", "揺れた十代", "Turbulent Teens"), adult: V("버텨 낸 청춘", "耐え抜いた青春", "A Youth Endured"), midlife: V("시련의 중년", "試練の中年", "A Midlife of Trials"), senior: V("고단했던 노년 초입", "つらかった老年の入り口", "A Weary Early Retirement"), elder: V("쓸쓸했던 황혼", "寂しい黄昏", "A Lonely Twilight") };
for (const s of STAGES) {
  AUTO.push(T("gold_" + s, 0, X => X.goldStage === s ? 32 : 0, STAGE_EP[s], V(`가장 좋은 일이 많았던 시기는 {stage|q이었}다.`, `最も良いことが多かった時期は「{stage}」だった。`, `The period with the most good news was "{stage}".`)));
  AUTO.push(T("dark_" + s, 0, X => X.darkStage === s ? 34 : 0, STAGE_DARK[s], V(`가장 힘든 일이 몰렸던 시기는 {stage|q이었}다. 그래도 그 시기를 지나왔다.`, `つらいことが集中した時期は「{stage}」だった。それでもその時期を越えてきた。`, `Hard times gathered in "{stage}". Still, {name} came through.`)));
}
const FAMS = ["gold", "silver", "normal", "dirt", "struggle"];
const FAM_OUT = { up: X => X.final >= X.famBase * 4 && X.final > 30000, keep: X => X.final >= X.famBase * 0.5 && X.final < X.famBase * 4, down: X => X.final < X.famBase * 0.5 };
for (const fm of FAMS) for (const [o, fn] of Object.entries(FAM_OUT)) AUTO.push(T(`fam_${fm}_${o}`, 0, X => X.famId === fm && fn(X) ? 18 : 0,
  o === "up" ? V("{family}에서 더 멀리 간 사람", "{family}からさらに遠くへ行った人", "Went Further than {familyCap}") : o === "keep" ? V("{family}의 삶을 이어 간 사람", "{family}の暮らしを引き継いだ人", "Carried On {familyCap}") : V("{family}에서 출발해 내려온 사람", "{family}から出発して下った人", "Started in {familyCap}, Came Down"),
  V(`{family}에서 태어나 마지막 재산은 {final}.`, `{family}に生まれ、最後の財産は{final}。`, `Born into {family}; final wealth {final}.`)));

export const TRAITS = (() => {
  const out = [];
  for (const [c] of Object.entries(CAREER_NAME)) for (const [o, d] of Object.entries(CAREER_OUT)) out.push({ id: `c_${c}_${o}`, rare: d.rare, career: c, test: X => d.test(X, c), ep: d.ep(c), tx: d.tx(c) });
  return out.concat(HAND, AUTO);
})();
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t]));
export const traitCounts = () => ({ base: TRAITS.filter(t => !t.rare).length, rare: TRAITS.filter(t => t.rare).length });
