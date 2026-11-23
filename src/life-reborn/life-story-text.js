// =========================
// 플듀 인생게임 REBORN — 결말·자서전 문장 사전 (한·日·EN 같은 분량) 2026-11-22
// 문법: {x} 값 넣기 · {x|을} 한국어 조사 자동(을/를·이/가·은/는·과/와·으로/로·이라/라·아/야·이랑/랑)
// 각 키는 갈래 여러 개 → 인생마다 다른 갈래가 골라진다(같은 인생은 늘 같은 문장). 사실은 모두 기록에서 온 값만 넣는다.
// =========================
const V = (ko, ja, en) => ({ ko, ja, en });

export const PH = {
  // ---------- 장 제목 ----------
  "ch.0": V(["태어나서 여섯 살까지"], ["生まれてから六歳まで"], ["From Birth to Six"]),
  "ch.1": V(["일곱 살부터 열두 살까지"], ["七歳から十二歳まで"], ["Seven to Twelve"]),
  "ch.2": V(["열세 살부터 열여덟 살까지"], ["十三歳から十八歳まで"], ["Thirteen to Eighteen"]),
  "ch.3": V(["열아홉에서 스물아홉"], ["十九歳から二十九歳"], ["Nineteen to Twenty-Nine"]),
  "ch.4": V(["서른에서 마흔넷"], ["三十歳から四十四歳"], ["Thirty to Forty-Four"]),
  "ch.5": V(["마흔다섯에서 쉰아홉"], ["四十五歳から五十九歳"], ["Forty-Five to Fifty-Nine"]),
  "ch.6": V(["예순에서 일흔넷"], ["六十歳から七十四歳"], ["Sixty to Seventy-Four"]),
  "ch.7": V(["일흔다섯 이후"], ["七十五歳から"], ["Seventy-Five and Beyond"]),
  "chsub.0": V(["유년기 — 세상을 처음 만난 시간"], ["幼年期 — 世界と初めて出会った時間"], ["Early Childhood — First Meeting the World"]),
  "chsub.1": V(["어린 시절 — 학교와 친구와 첫 꿈"], ["子ども時代 — 学校と友達と最初の夢"], ["Childhood — School, Friends, a First Dream"]),
  "chsub.2": V(["청소년기 — 나를 찾아 헤맨 시간"], ["思春期 — 自分を探した時間"], ["Adolescence — Searching for Myself"]),
  "chsub.3": V(["청년기 — 혼자 서기 시작한 시간"], ["青年期 — 一人で立ち始めた時間"], ["Young Adulthood — Learning to Stand Alone"]),
  "chsub.4": V(["삶의 한가운데 — 일과 가족 사이"], ["人生の真ん中 — 仕事と家族のあいだ"], ["The Middle of Life — Between Work and Family"]),
  "chsub.5": V(["중년 — 쌓아 온 것과 흔들린 것"], ["中年 — 積み上げたものと揺らいだもの"], ["Midlife — What Was Built, What Was Shaken"]),
  "chsub.6": V(["새로운 시작 — 일을 내려놓은 뒤"], ["新しい始まり — 仕事を降りたあと"], ["A New Start — After Setting Work Down"]),
  "chsub.7": V(["노년 — 기억을 쓰다듬는 시간"], ["老年 — 記憶をなでる時間"], ["Old Age — Time for Tending Memories"]),

  // ---------- 장 첫 문장 (사실: 나이·장소·집안) ----------
  "intro.0": V(
    ["{year}년, {region}의 {family}에서 {name|이가} 태어났다. {body} {talent}", "{name|은} {year}년 {region}에서 첫울음을 터뜨렸다. 태어난 곳은 {family|이었}다. {body} {talent}", "이야기는 {year}년 {region}, {family}에서 시작한다. 갓 태어난 {name|은} 아직 아무것도 몰랐다. {body} {talent}"],
    ["{year}年、{region}の{family}に{name}は生まれた。{body}{talent}", "{name}は{year}年、{region}で産声をあげた。生まれた家は{family}だった。{body}{talent}", "物語は{year}年の{region}、{family}から始まる。生まれたばかりの{name}はまだ何も知らなかった。{body}{talent}"],
    ["{name} was born in {year} in {region}, into {family}. {body} {talent}", "In {year}, in {region}, {name} let out a first cry. The home was {family}. {body} {talent}", "The story begins in {year}, in {region}, in {family}. Newborn {name} knew nothing yet. {body} {talent}"]),
  "intro.1": V(
    ["일곱 살, {name|은} 학교라는 새 세상에 들어섰다.", "초등학교에 들어가면서 {name}의 하루는 집 밖으로 넓어졌다.", "열두 살이 될 때까지의 시간은 운동장과 교실 사이에서 흘렀다."],
    ["七歳、{name}は学校という新しい世界に足を踏み入れた。", "小学校に入って、{name}の一日は家の外へと広がった。", "十二歳になるまでの時間は、校庭と教室のあいだで流れた。"],
    ["At seven, {name} stepped into the new world called school.", "Starting elementary school, {name}'s days stretched beyond the front door.", "The years up to twelve passed between the playground and the classroom."]),
  "intro.2": V(
    ["열세 살, 몸도 마음도 하루가 다르게 변하던 때였다.", "중학교와 고등학교의 여섯 해 동안 {name|은} 자신이 누구인지 묻기 시작했다.", "청소년기의 {name}에게는 고민이 많았다. 그 고민들이 조금씩 사람을 만들었다."],
    ["十三歳、体も心も日ごとに変わっていく頃だった。", "中学と高校の六年間、{name}は自分が誰なのかを問い始めた。", "思春期の{name}には悩みが多かった。その悩みが少しずつ人をつくった。"],
    ["Thirteen — body and mind changed by the day.", "Through six years of middle and high school, {name} began asking who they were.", "Teenage {name} had plenty of worries, and those worries slowly shaped a person."]),
  "intro.3": V(
    ["열아홉, 어른이라는 말이 처음으로 {name}의 몫이 되었다.", "스무 살 무렵, 세상은 넓었고 정해진 길은 없었다.", "청년기의 열한 해 동안 {name|은} 혼자 서는 법을 배웠다."],
    ["十九歳、「大人」という言葉が初めて{name}のものになった。", "二十歳の頃、世界は広く、決まった道はなかった。", "青年期の十一年間、{name}は一人で立つことを学んだ。"],
    ["At nineteen, the word 'adult' belonged to {name} for the first time.", "Around twenty, the world was wide and no path was set.", "Over eleven years of young adulthood, {name} learned how to stand alone."]),
  "intro.4": V(
    ["서른. 해야 할 일과 하고 싶은 일이 동시에 몰려오던 시기였다.", "삼십 대의 {name|은} 일과 사람 사이에서 균형을 찾으려 애썼다.", "서른에서 마흔넷까지, 인생의 굵은 줄기가 이 시기에 정해졌다."],
    ["三十歳。やるべきこととやりたいことが同時に押し寄せた時期だった。", "三十代の{name}は、仕事と人とのあいだでバランスを探そうとした。", "三十歳から四十四歳まで、人生の太い幹はこの時期に決まった。"],
    ["Thirty. Things to do and things wanted arrived all at once.", "In their thirties, {name} kept trying to balance work and people.", "From thirty to forty-four, the main trunk of this life took shape."]),
  "intro.5": V(
    ["마흔다섯, 지나온 길이 앞으로 남은 길만큼 길어 보이기 시작했다.", "오십 대 문턱의 {name}에게는 지켜야 할 것이 많았다.", "중년의 시간은 빠르게 흘렀고, 그 속에서 몇 번 크게 흔들렸다."],
    ["四十五歳、歩いてきた道がこれからの道と同じくらい長く見え始めた。", "五十代の入り口に立つ{name}には、守るべきものが多かった。", "中年の時間は速く流れ、その中で何度か大きく揺れた。"],
    ["At forty-five, the road behind began to look as long as the road ahead.", "On the threshold of fifty, {name} had a great deal to protect.", "Midlife ran fast, and more than once it shook hard."]),
  "intro.6": V(
    ["예순, 일의 무게를 내려놓고 다른 하루를 살기 시작했다.", "육십 대의 {name|은} 오래 미뤄 둔 것들을 하나씩 꺼내 보았다.", "예순 이후, 시간은 다시 {name}의 것이 되었다."],
    ["六十歳、仕事の重さを下ろして違う一日を生き始めた。", "六十代の{name}は、長く後回しにしてきたものを一つずつ取り出してみた。", "六十歳を過ぎて、時間はまた{name}のものになった。"],
    ["At sixty, the weight of work was set down and a different kind of day began.", "In their sixties, {name} took out the things long put off, one by one.", "After sixty, time belonged to {name} again."]),
  "intro.7": V(
    ["일흔다섯을 넘기며 {name|은} 지난날을 자주 떠올렸다.", "노년의 날들은 조용했고, 그 조용함 속에 오래된 얼굴들이 있었다.", "마지막 시기, {name}의 하루는 느리고 깊어졌다."],
    ["七十五歳を過ぎて、{name}は昔のことをよく思い出すようになった。", "老年の日々は静かで、その静けさの中に懐かしい顔があった。", "最後の時期、{name}の一日はゆっくりと深くなった。"],
    ["Past seventy-five, {name} often thought back on the old days.", "The days of old age were quiet, and in that quiet were familiar faces.", "In the final years, {name}'s days grew slow and deep."]),

  // ---------- 사건 문장 ----------
  "ev.open": V(
    ["{age}살, {title}.", "{age}살이 되던 해에는 {title}.", "{age}살 무렵의 일이다. {title}.", "{age}살. {title}.", "그리고 {age}살, {title}."],
    ["{age}歳、{title}。", "{age}歳になった年には、{title}。", "{age}歳の頃のことだ。{title}。", "{age}歳。{title}。", "そして{age}歳、{title}。"],
    ["At {age}: {title}.", "The year {name} turned {age}: {title}.", "Around age {age}: {title}.", "Age {age}. {title}.", "Then, at {age}: {title}."]),
  "ev.choice": V(
    ["{name|은} '{choice}'{choiceJosa} 골랐다.", "그때의 선택은 {choice|q이었}다.", "고민 끝에 '{choice}'.", "{name}의 대답은 {choice|q이었}다."],
    ["{name}は「{choice}」を選んだ。", "そのときの選択は「{choice}」だった。", "悩んだ末に「{choice}」。", "{name}の答えは「{choice}」だった。"],
    ["{name} chose: \"{choice}\".", "The choice then was \"{choice}\".", "After some thought: \"{choice}\".", "{name}'s answer was \"{choice}\"."]),
  "ev.fate": V(
    ["{age}살에는 고를 수 없는 일이 찾아왔다. {title} — {text}", "{age}살, 예고 없이 {title}. {text}"],
    ["{age}歳には、選べない出来事がやって来た。{title} — {text}", "{age}歳、前触れもなく{title}。{text}"],
    ["At {age}, something unchosen arrived: {title} — {text}", "At {age}, without warning: {title}. {text}"]),
  "ev.milestone": V(["{age}살, {text}", "{text} ({age}살)"], ["{age}歳、{text}", "{text}({age}歳)"], ["At {age}: {text}", "{text} (age {age})"]),

  // ---------- 삶의 변화 (기록에서 찾은 사실) ----------
  "fx.job": V(["{age}살, {job|으로} 일을 시작했다.", "{age}살부터 {name}의 명함에는 '{job}'{jobJosa} 적혔다."], ["{age}歳、{job}として働き始めた。", "{age}歳から、{name}の名刺には「{job}」と書かれた。"], ["At {age}, {name} started work as {job}.", "From {age}, {name}'s business card read \"{job}\"."]),
  "fx.jobchange": V(["{age}살, '{from}'에서 {to|q으로} 자리를 옮겼다.", "{age}살에 {from} 일을 접고 {to}의 길로 들어섰다."], ["{age}歳、「{from}」から「{to}」へと移った。", "{age}歳で{from}の仕事をたたみ、{to}の道へ進んだ。"], ["At {age}, {name} moved from \"{from}\" to \"{to}\".", "At {age}, {name} closed the chapter as {from} and took the road of {to}."]),
  "fx.jobless": V(["{age}살, 일을 내려놓았다.", "{age}살부터 한동안 일이 없는 날들이 이어졌다."], ["{age}歳、仕事を手放した。", "{age}歳から、しばらく仕事のない日々が続いた。"], ["At {age}, {name} set work down.", "From {age}, there was a stretch of days without work."]),
  "fx.marry": V(["{age}살, {spouse|과} 결혼했다.", "{age}살에 {spouse|과} 한집에 살기 시작했다. 결혼이었다."], ["{age}歳、{spouse}と結婚した。", "{age}歳で{spouse}と一つ屋根の下で暮らし始めた。結婚だった。"], ["At {age}, {name} married {spouse}.", "At {age}, {name} and {spouse} began sharing one home. It was a marriage."]),
  "fx.kid": V(["{age}살, {kid|이가} 태어났다.", "{age}살에 {kid|이라는} 이름의 아이가 가족이 되었다."], ["{age}歳、{kid}が生まれた。", "{age}歳で、{kid}という名の子が家族になった。"], ["At {age}, {kid} was born.", "At {age}, a child named {kid} joined the family."]),
  "fx.divorce": V(["{age}살, {spouse|과} 각자의 길을 가기로 했다.", "{age}살에 결혼 생활이 끝났다."], ["{age}歳、{spouse}とそれぞれの道を行くことにした。", "{age}歳で結婚生活が終わった。"], ["At {age}, {name} and {spouse} chose separate roads.", "At {age}, the marriage ended."]),
  "fx.widow": V(["{age}살, 곁에 있던 사람을 먼저 보냈다.", "{age}살에 배우자와 작별했다."], ["{age}歳、そばにいた人を先に見送った。", "{age}歳で伴侶と別れを告げた。"], ["At {age}, {name} said goodbye to the person beside them.", "At {age}, {name} parted with their spouse for the last time."]),
  "fx.pet": V(["{age}살, {pet|이가} 식구가 되었다.", "{age}살에 {pet|과} 함께 살기 시작했다."], ["{age}歳、{pet}が家族になった。", "{age}歳で{pet}と暮らし始めた。"], ["At {age}, {pet} became part of the household.", "At {age}, {name} began living with {pet}."]),
  "fx.petgone": V(["{age}살, {pet|과} 작별했다. 함께한 시간은 {n}년이었다.", "{age}살에 {pet|이가} 떠났다. {n}년을 곁에 있었다."], ["{age}歳、{pet}とお別れした。一緒にいたのは{n}年だった。", "{age}歳で{pet}が旅立った。{n}年そばにいてくれた。"], ["At {age}, {name} said goodbye to {pet}, after {n} years together.", "At {age}, {pet} passed away, having stayed close for {n} years."]),
  "fx.parentgone": V(["{age}살, {who|을} 떠나보냈다.", "{age}살에 {who}의 장례를 치렀다."], ["{age}歳、{who}を見送った。", "{age}歳で{who}の葬儀を終えた。"], ["At {age}, {name} said goodbye to {who}.", "At {age}, {name} held the funeral for {who}."]),
  "fx.house": V(["{age}살, 사는 곳이 {house|으로} 바뀌었다.", "{age}살부터는 {house}에서 살았다."], ["{age}歳、住まいが{house}に変わった。", "{age}歳からは{house}で暮らした。"], ["At {age}, home became {house}.", "From {age}, {name} lived in {house}."]),
  "fx.retire": V(["{age}살, 긴 일을 마치고 은퇴했다.", "{age}살에 일터를 떠났다. 정년이었다."], ["{age}歳、長い仕事を終えて引退した。", "{age}歳で職場を去った。定年だった。"], ["At {age}, after long years of work, {name} retired.", "At {age}, {name} left the workplace at retirement age."]),

  // ---------- 해 흐름 요약 (숫자는 기록에서) ----------
  "flow.happyUp": V(["이 시기 행복은 {from}에서 {to|으로} 올랐다.", "돌아보면 이때 마음이 한결 가벼워졌다 — 행복 {from} → {to}."], ["この時期、幸福は{from}から{to}へ上がった。", "振り返れば、この頃は心が軽くなっていた — 幸福{from} → {to}。"], ["Happiness rose from {from} to {to} in these years.", "Looking back, the heart grew lighter then — happiness {from} → {to}."]),
  "flow.happyDown": V(["이 시기 행복은 {from}에서 {to|으로} 내려갔다.", "마음이 무거운 해가 많았다 — 행복 {from} → {to}."], ["この時期、幸福は{from}から{to}へ下がった。", "心の重い年が多かった — 幸福{from} → {to}。"], ["Happiness fell from {from} to {to} in these years.", "Many of these years sat heavy — happiness {from} → {to}."]),
  "flow.moneyUp": V(["가진 것은 {from}에서 {to|으로} 늘었다.", "재산은 {from}에서 {to}까지 불어났다."], ["財産は{from}から{to}へ増えた。", "資産は{from}から{to}まで膨らんだ。"], ["Net worth grew from {from} to {to}.", "Savings swelled from {from} to {to}."]),
  "flow.moneyDown": V(["가진 것은 {from}에서 {to|으로} 줄었다.", "재산은 {from}에서 {to}까지 줄어들었다."], ["財産は{from}から{to}へ減った。", "資産は{from}から{to}まで縮んだ。"], ["Net worth shrank from {from} to {to}.", "Savings dwindled from {from} to {to}."]),
  "flow.focus": V(["이 시기 가장 많이 마음을 쏟은 곳은 {focus|q이었}다({n}년).", "{n}년 동안 '{focus}'에 무게를 두었다."], ["この時期いちばん心を注いだのは「{focus}」だった({n}年)。", "{n}年間、「{focus}」に重きを置いた。"], ["The focus of these years was \"{focus}\" ({n} years).", "For {n} years, \"{focus}\" carried the weight."]),
  "flow.quiet": V(["특별한 일 없이 지나간 해도 있었다. {text}", "{age}살은 조용히 흘렀다. {text}"], ["特別なことのない年もあった。{text}", "{age}歳は静かに流れた。{text}"], ["Some years passed with nothing remarkable. {text}", "Age {age} passed quietly. {text}"]),
  "flow.empty": V(["이 시기에 대해서는 기록이 많지 않다. 조용히 지나간 시간이었다.", "남은 기록은 적다. 그래도 그 시간 역시 {name}의 삶이었다."], ["この時期の記録は多くない。静かに過ぎた時間だった。", "残る記録は少ない。それでもその時間も{name}の人生だった。"], ["Few records remain from this period; it was a quiet time.", "Little is recorded here. Still, that time was {name}'s life too."]),

  // ---------- 내가 쓴 말 다시 부르기 ----------
  "recall.dream_teen": V(["열여섯의 {name|은} 문득 예전에 적어 둔 꿈을 떠올렸다. '{t}'.", "그 무렵, 어릴 적 꿈 {t|q이} 아직 마음 한쪽에 남아 있었다."], ["十六歳の{name}は、ふと昔書いた夢を思い出した。「{t}」。", "その頃、子どもの頃の夢「{t}」はまだ心の片隅にあった。"], ["At sixteen, {name} suddenly remembered the dream once written down: \"{t}\".", "Back then, the childhood dream \"{t}\" still lived in a corner of the heart."]),
  "recall.dream_30": V(["서른 살, '{t}'{tJosa} 꿈꾸던 아이는 어디쯤 와 있을까 생각했다.", "서른에 다시 펼쳐 본 꿈 — '{t}'."], ["三十歳、「{t}」を夢見ていた子はどこまで来ただろうかと考えた。", "三十歳でもう一度ひらいた夢 — 「{t}」。"], ["At thirty, {name} wondered how far the child who dreamed \"{t}\" had come.", "A dream reopened at thirty: \"{t}\"."]),
  "recall.q10_25": V(["열 살 때 '어른이 되면' 하고 적었던 말 — '{t}' — 이 스물여섯에 다시 떠올랐다."], ["十歳のとき「大人になったら」と書いた言葉 — 「{t}」 — が二十六歳でまた浮かんだ。"], ["The words written at ten about growing up — \"{t}\" — came back at twenty-six."]),
  "recall.q18_35": V(["서른다섯, 열여덟에 품었던 꿈 '{t}'{tJosa} 떠올리며 지금을 돌아보았다."], ["三十五歳、十八歳で抱いた夢「{t}」を思い出し、今を振り返った。"], ["At thirty-five, {name} remembered the dream held at eighteen — \"{t}\" — and looked at the present."]),
  "recall.q25_45": V(["스물다섯에 '성공이란 {t}'라고 썼던 {name|은}, 마흔일곱에 그 말을 다시 곱씹었다."], ["二十五歳で「成功とは{t}」と書いた{name}は、四十七歳でその言葉をかみしめ直した。"], ["Having written at twenty-five that success meant \"{t}\", {name} chewed on it again at forty-seven."]),
  "recall.q40_55": V(["마흔에 털어놓았던 후회 — '{t}' — 는 쉰다섯에도 가끔 마음을 건드렸다."], ["四十歳で打ち明けた後悔 — 「{t}」 — は五十五歳でも時々心に触れた。"], ["The regret confessed at forty — \"{t}\" — still brushed the heart now and then at fifty-five."]),
  "recall.q60_70": V(["일흔둘, 예순에 젊은 날의 자신에게 남긴 말 '{t}'{tJosa} 다시 읽었다."], ["七十二歳、六十歳で若い頃の自分に残した言葉「{t}」を読み返した。"], ["At seventy-two, {name} reread the words left at sixty for a younger self: \"{t}\"."]),
  "recall.wish_first_job": V(["처음 일을 시작하던 날, 오래전 적어 둔 장래희망 {t|q이} 생각났다."], ["初めて仕事を始めた日、昔書いた将来の夢「{t}」を思い出した。"], ["On the first day of work, the old wish \"{t}\" came to mind."]),
  "recall.dream_kid": V(["아이를 처음 안던 날, {name|은} 자신의 꿈 '{t}'{tJosa} 아이에게 이야기해 주고 싶었다."], ["初めて子どもを抱いた日、{name}は自分の夢「{t}」を子に話してあげたくなった。"], ["The day {name} first held the baby, they wanted to tell the child about their own dream: \"{t}\"."]),
  "recall.thought_old": V(["예순여섯, 오래전 남겨 둔 메모를 발견했다. '{t}'"], ["六十六歳、昔残したメモを見つけた。「{t}」"], ["At sixty-six, {name} found an old note: \"{t}\""]),
  "quote.prompt": V(["{age}살의 {name|은} 이렇게 적었다. '{t}'", "그때 남긴 말 — '{t}'"], ["{age}歳の{name}はこう書いた。「{t}」", "そのとき残した言葉 — 「{t}」"], ["At {age}, {name} wrote: \"{t}\"", "Words left then: \"{t}\""]),
  "quote.q10": V(["어른이 되면 무엇을 하고 싶냐는 물음에 {name|은} {t|q이라고} 답했다.", "열 살의 {name|은} 장래를 묻는 말에 {t|q이라고} 적었다."], ["大人になったら何がしたいかと聞かれ、{name}は「{t}」と答えた。", "十歳の{name}は、将来を聞かれて「{t}」と書いた。"], ["Asked what they wanted to be when grown up, {name} answered \"{t}\".", "At ten, asked about the future, {name} wrote \"{t}\"."]),
  "quote.q18": V(["가장 이루고 싶은 꿈을 묻자 {name|은} {t|q을} 꼽았다.", "열여덟의 {name|이} 가장 바란 것은 {t|q이었}다."], ["いちばん叶えたい夢を聞かれ、{name}は「{t}」を挙げた。", "十八歳の{name}がいちばん願ったのは「{t}」だった。"], ["Asked for the dream they wanted most, {name} chose \"{t}\".", "What {name} wanted most at eighteen was \"{t}\"."]),
  "quote.q25": V(["{name}에게 성공이란 {t|q이었}다.", "성공이 뭐냐는 물음에 {name|은} {t|q이라고} 답했다."], ["{name}にとって成功とは「{t}」だった。", "成功とは何かと聞かれ、{name}は「{t}」と答えた。"], ["To {name}, success meant \"{t}\".", "Asked what success was, {name} said \"{t}\"."]),
  "quote.q40": V(["가장 후회되는 선택을 묻자 {name|은} {t|q이라고} 적었다.", "마흔의 {name|은} 가장 큰 후회로 {t|q을} 꼽았다."], ["いちばん後悔している選択を聞かれ、{name}は「{t}」と書いた。", "四十歳の{name}は、いちばんの後悔に「{t}」を挙げた。"], ["Asked about the choice they most regretted, {name} wrote \"{t}\".", "At forty, {name} named \"{t}\" as the biggest regret."]),
  "quote.q60": V(["젊은 날의 자신에게 {name|은} {t|q이라고} 말해 주고 싶다고 했다.", "예순의 {name|은} 지난날의 자신에게 {t|q이라고} 전했다."], ["若い日の自分に、{name}は「{t}」と伝えたいと言った。", "六十歳の{name}は、昔の自分へ「{t}」と言葉を送った。"], ["To their younger self, {name} wanted to say \"{t}\".", "At sixty, {name} sent these words back to their past self: \"{t}\"."]),
  "quote.thought": V(["{age}살의 메모: '{t}'"], ["{age}歳のメモ:「{t}」"], ["A note at {age}: \"{t}\""]),

  // ---------- 꿈 ----------
  "dream.done": V(["어릴 적 적어 둔 꿈 '{t}'. {name|은} 결국 {career}의 길을 걸었다. 꿈은 이루어졌다.", "'{t}' — 이 꿈은 이루어졌다. {name|은} {career}{careerJosa} 되었다."], ["子どもの頃に書いた夢「{t}」。{name}は結局{career}の道を歩いた。夢は叶った。", "「{t}」 — この夢は叶った。{name}は{career}になった。"], ["The childhood dream: \"{t}\". In the end, {name} walked the road of {career}. The dream came true.", "\"{t}\" — this dream came true. {name} became {career}."]),
  "dream.miss": V(["어릴 적 꿈 '{t}'{tJosa} 이루어지지 않았다. 대신 {name|은} {career}{careerJosa} 살았다. 기록에는 그 꿈을 다시 떠올린 순간이 {n}번 남아 있다.", "'{t}' — 이 꿈과는 다른 길을 걸었다. 그 길의 이름은 {career|이었}다."], ["子どもの頃の夢「{t}」は叶わなかった。代わりに{name}は{career}として生きた。記録にはその夢を思い出した瞬間が{n}回残っている。", "「{t}」 — この夢とは違う道を歩いた。その道の名は{career}だった。"], ["The childhood dream \"{t}\" did not come true. Instead, {name} lived as {career}. The records hold {n} moments when that dream came back to mind.", "\"{t}\" — a different road was taken. Its name was {career}."]),
  "dream.free": V(["'{t}' — 직업으로 맞춰 볼 수 없는 꿈이었다. 이루었는지는 숫자가 아니라 마지막에 남긴 말이 대신 말해 준다.", "꿈은 {t|q이었}다. 이 꿈은 직업의 이름이 아니라서, 게임은 판정하지 않는다."], ["「{t}」 — 職業では測れない夢だった。叶ったかどうかは、数字ではなく最後に残した言葉が語ってくれる。", "夢は「{t}」だった。職業の名前ではないので、ゲームは判定しない。"], ["\"{t}\" — a dream no job title could measure. Whether it came true is told not by numbers but by the last words left behind.", "The dream was \"{t}\". It isn't the name of a job, so the game does not judge it."]),
  "dream.none": V(["{name|은} 꿈을 글로 남기지 않았다. 대신 선택들이 그 자리를 채웠다."], ["{name}は夢を言葉で残さなかった。代わりに選択がその場所を埋めた。"], ["{name} never wrote a dream down. The choices filled that space instead."]),

  // ---------- 결말 머리 ----------
  "life.title": V(
    ["{epithet}, {name}의 {years}년", "{name} — {epithet}", "{epithet}의 기록", "{years}년을 산 {name}의 이야기", "{name}, {epithet}"],
    ["{epithet}、{name}の{years}年", "{name} — {epithet}", "{epithet}の記録", "{years}年を生きた{name}の物語", "{name}、{epithet}"],
    ["{epithet}: {name}'s {years} Years", "{name} — {epithet}", "A Record of {epithet}", "The Story of {name}, Who Lived {years} Years", "{name}, {epithet}"]),
  "life.title2": V(
    ["{epithet} — {epithet2}", "{name}, {epithet}이자 {epithet2}", "{birth}년생 {name}: {epithet}", "{epithet2}, 그리고 {epithet}", "{name}의 {years}년 — {epithet2}"],
    ["{epithet} — {epithet2}", "{name}、{epithet}にして{epithet2}", "{birth}年生まれの{name}:{epithet}", "{epithet2}、そして{epithet}", "{name}の{years}年 — {epithet2}"],
    ["{epithet} — {epithet2}", "{name}: {epithet}, {epithet2}", "{name}, Born {birth}: {epithet}", "{epithet2}, and {epithet}", "{name}'s {years} Years — {epithet2}"]),
  "life.sub": V(["{birth}년에 태어나 {death}년에 떠난 사람", "{region}에서 시작해 {age}살까지"], ["{birth}年に生まれ、{death}年に旅立った人", "{region}から始まり{age}歳まで"], ["Born {birth}, departed {death}", "From {region} to age {age}"]),
  "death.line": V(["{age}살, {cause}.", "{name|은} {age}살에 세상을 떠났다. {cause}."], ["{age}歳、{cause}。", "{name}は{age}歳でこの世を去った。{cause}。"], ["Age {age}: {cause}.", "{name} departed this world at {age}. {cause}."]),

  // ---------- 섹션 문장 ----------
  "sec.glance": V(["{name|은} {age}년을 살았다. 결정 {dec}번, 그중 삶을 크게 바꾼 결정이 {maj}번이었다. 일한 해는 {work}년. {fam}", "{age}년의 삶. 고른 길 {dec}번, 고를 수 없던 일 {fate}번. {fam}"], ["{name}は{age}年を生きた。決断は{dec}回、そのうち人生を大きく変えた決断は{maj}回。働いた年は{work}年。{fam}", "{age}年の人生。選んだ道{dec}回、選べなかった出来事{fate}回。{fam}"], ["{name} lived {age} years: {dec} decisions, {maj} of them life-changing. {work} years of work. {fam}", "A life of {age} years: {dec} chosen roads, {fate} unchosen events. {fam}"]),
  "fam.none": V(["혼자의 시간을 스스로 꾸린 삶이었다."], ["一人の時間を自分で形づくった人生だった。"], ["It was a life that shaped its own solitude."]),
  "fam.spouse": V(["{spouse|과} 함께한 {n}년"], ["{spouse}と共にした{n}年"], ["{n} years with {spouse}"]),
  "fam.kids": V(["아이 {n}명"], ["子ども{n}人"], ["{n} children"]),
  "fam.pets": V(["반려동물 {n}마리"], ["ペット{n}匹"], ["{n} pets"]),

  "career.none": V(["{name|은} 정해진 직업 없이 그때그때의 일을 했다. 그것도 하나의 일하는 방식이었다."], ["{name}は決まった職業を持たず、その時々の仕事をした。それも一つの働き方だった。"], ["{name} worked whatever came, without one fixed profession. That too is a way of working."]),
  "career.list": V(["{name}의 직업 이력은 {n}개의 자리로 이어졌다.", "일의 길은 {n}번 이름을 바꾸었다."], ["{name}の職歴は{n}つの場所へとつながった。", "仕事の道は{n}回名前を変えた。"], ["{name}'s working life passed through {n} positions.", "The road of work changed its name {n} times."]),
  "career.peak": V(["가장 높이 올라간 때는 {career}에서 {step}단계에 이른 {age}살 무렵이었다.", "{career}의 길에서 {step}단계까지 올라섰다."], ["最も高く上ったのは、{career}で{step}段階に達した{age}歳の頃だった。", "{career}の道で{step}段階まで上り詰めた。"], ["The highest point came around {age}, reaching stage {step} as {career}.", "On the road of {career}, {name} climbed to stage {step}."]),

  "money.sum": V(["평생 번 돈은 {total}, 가장 많이 가졌던 때는 {peakAge}살의 {peak|이었}다. 가장 어려웠던 때는 {lowAge}살, {low}. 마지막에 남은 것은 {final}.", "총소득 {total}. 최고 자산 {peak}({peakAge}살), 최저 {low}({lowAge}살), 마지막 {final}."], ["生涯の収入は{total}、最も多く持っていたのは{peakAge}歳の{peak}。最も苦しかったのは{lowAge}歳の{low}。最後に残ったのは{final}。", "総収入{total}。最高資産{peak}({peakAge}歳)、最低{low}({lowAge}歳)、最後{final}。"], ["Lifetime income: {total}. Peak wealth: {peak} at {peakAge}. Lowest: {low} at {lowAge}. What remained at the end: {final}.", "Total income {total}. Highest {peak} (age {peakAge}), lowest {low} (age {lowAge}), final {final}."]),
  "money.debt": V(["빚을 진 채 보낸 해가 {n}년 있었다.", "{n}년은 빚과 함께였다."], ["借金を抱えて過ごした年が{n}年あった。", "{n}年は借金と共にあった。"], ["{n} years were spent in debt.", "Debt came along for {n} years."]),
  "money.bigdecision": V(["가장 큰 돈이 오간 결정은 {age}살의 '{title}' — {choice|q이었}다. 그 선택으로 {v}{dir}.", "재산을 가장 크게 움직인 건 {age}살 때 '{choice}'{choiceJosa} 고른 일이었다({v} {dir})."], ["最も大きなお金が動いた決断は{age}歳の「{title}」 — 「{choice}」だった。その選択で{v}{dir}。", "財産を最も大きく動かしたのは{age}歳で「{choice}」を選んだことだった({v}{dir})。"], ["The decision that moved the most money: \"{title}\" at {age} — \"{choice}\". It {dir} {v}.", "The biggest swing in wealth came from choosing \"{choice}\" at {age} ({dir} {v})."]),
  "dir.up": V(["을 얻었다"], ["を得た"], ["gained"]), "dir.down": V(["을 잃었다"], ["を失った"], ["lost"]),

  "people.intro": V(["{name}의 삶에는 {n}명의 이름이 남아 있다.", "기록에 남은 사람은 {n}명이다."], ["{name}の人生には{n}人の名前が残っている。", "記録に残る人は{n}人だ。"], ["{n} names remain in {name}'s life.", "The records hold {n} people."]),
  "people.line": V(["{who}({rel}) — {state}", "{who}, {rel}. {state}"], ["{who}({rel}) — {state}", "{who}、{rel}。{state}"], ["{who} ({rel}) — {state}", "{who}, {rel}. {state}"]),
  "pstate.active": V(["끝까지 곁에 있었다"], ["最後までそばにいた"], ["stayed until the end"]),
  "pstate.dead": V(["먼저 떠났다"], ["先に旅立った"], ["passed away first"]),
  "pstate.gone": V(["멀어졌다"], ["疎遠になった"], ["drifted away"]),
  "pstate.other": V(["기록에 이름이 남았다"], ["記録に名前が残った"], ["their name remains in the records"]),

  // ---------- 순간 · 숨은 이야기 ----------
  "top.happy": V(["{age}살 — {title}: '{choice}' (행복 +{v})"], ["{age}歳 — {title}:「{choice}」(幸福 +{v})"], ["Age {age} — {title}: \"{choice}\" (happiness +{v})"]),
  "top.hard": V(["{age}살 — {title}: '{choice}' (행복 {v})"], ["{age}歳 — {title}:「{choice}」(幸福 {v})"], ["Age {age} — {title}: \"{choice}\" (happiness {v})"]),
  "top.fate": V(["{age}살 — {title}"], ["{age}歳 — {title}"], ["Age {age} — {title}"]),
  "hidden.route": V(["{age1}살의 선택 '{choice}'{choiceJosa} 남긴 길은 {age2}살의 {career}{careerJosa} 이어졌다. 그때는 알 수 없었다.", "{age1}살에 고른 '{choice}' — 이 작은 선택이 {age2}살에 {career}의 길을 열었다."], ["{age1}歳の選択「{choice}」が残した道は、{age2}歳の{career}へとつながった。そのときは知る由もなかった。", "{age1}歳で選んだ「{choice}」 — この小さな選択が{age2}歳で{career}への道を開いた。"], ["The path left by the choice \"{choice}\" at {age1} led to {career} at {age2}. There was no way to know then.", "\"{choice}\", chosen at {age1} — that small choice opened the road to {career} at {age2}."]),
  "hidden.meet": V(["{age1}살에 처음 만난 {who|은} {age2}살에 {rel}{relJosa} 되었다. 한 번의 만남이 인생의 방향을 바꾸었다."], ["{age1}歳で初めて出会った{who}は、{age2}歳で{rel}になった。一度の出会いが人生の向きを変えた。"], ["{who}, first met at {age1}, became {rel} at {age2}. One meeting turned the course of a life."]),
  "hidden.success": V(["가장 큰 재산({peakAge}살)의 바탕에는 {age}살의 결정 '{choice}'{choiceJosa} 있었다. 그때 늘어난 돈이 이후의 흐름을 만들었다."], ["最大の資産({peakAge}歳)の土台には、{age}歳の決断「{choice}」があった。そのとき増えたお金がその後の流れをつくった。"], ["Behind the peak wealth at {peakAge} lay a decision at {age}: \"{choice}\". The money it brought shaped what followed."]),
  "hidden.missed": V(["{age}살, '{title}'에서 {name|은} '{alt}'{altJosa} 고르지 않았다. 다른 선택을 따라가 본 가상 인생 {n}개에서는 {result}."], ["{age}歳の「{title}」で、{name}は「{alt}」を選ばなかった。別の選択をたどった仮想の人生{n}本では{result}。"], ["At {age}, at \"{title}\", {name} did not choose \"{alt}\". In {n} simulated lives that took the other road, {result}."]),
  "hidden.persona": V(["스무 살의 {name|은} {from}{fromJosa} 사람이었고, 예순의 {name|은} {to}{toJosa} 사람이었다. ({stat} {a} → {b})"], ["二十歳の{name}は{from}人で、六十歳の{name}は{to}人だった。({stat} {a} → {b})"], ["At twenty, {name} was {from}; at sixty, {to}. ({stat} {a} → {b})"]),

  // ---------- 가상 인생 ----------
  "whatif.res.longer": V(["평균 {d}년 더 오래 살았다"], ["平均で{d}年長く生きた"], ["they lived {d} years longer on average"]),
  "whatif.res.shorter": V(["평균 {d}년 일찍 떠났다"], ["平均で{d}年早く旅立った"], ["they departed {d} years earlier on average"]),
  "whatif.res.richer": V(["마지막 재산이 평균 {v} 더 많았다"], ["最後の財産が平均{v}多かった"], ["their final wealth averaged {v} more"]),
  "whatif.res.poorer": V(["마지막 재산이 평균 {v} 적었다"], ["最後の財産が平均{v}少なかった"], ["their final wealth averaged {v} less"]),
  "whatif.res.happier": V(["행복 평균이 {v} 높았다"], ["幸福の平均が{v}高かった"], ["average happiness was {v} higher"]),
  "whatif.res.sadder": V(["행복 평균이 {v} 낮았다"], ["幸福の平均が{v}低かった"], ["average happiness was {v} lower"]),
  "whatif.res.same": V(["삶의 큰 줄기는 거의 같았다"], ["人生の大きな流れはほとんど同じだった"], ["the broad shape of life stayed nearly the same"]),
  "whatif.note": V(["가상 인생은 같은 시점에서 다른 선택을 한 뒤 나머지를 자동으로 살아 본 결과예요. 실제로 일어난 일이 아니에요."], ["仮想の人生は、同じ時点で別の選択をし、残りを自動で生きてみた結果です。実際に起きたことではありません。"], ["Simulated lives take the other choice at the same moment and live the rest automatically. They did not actually happen."]),

  // ---------- 마지막 장 · 평가 ----------
  "last.intro": V(["마지막 몇 해, {name}의 하루는 이렇게 흘렀다.", "삶의 끝자락에 남은 기록은 이렇다."], ["最後の数年、{name}の一日はこう流れた。", "人生の終わりに残る記録はこうだ。"], ["In the final years, {name}'s days went like this.", "These are the records from the edge of life."]),
  "last.words": V(["마지막으로 남긴 한 문장 — '{t}'", "{name}의 마지막 말: '{t}'"], ["最後に残した一文 — 「{t}」", "{name}の最後の言葉:「{t}」"], ["The last sentence left behind: \"{t}\"", "{name}'s last words: \"{t}\""]),
  "verdict.fact": V(["[기록] 수명 {age}세 · 평균 행복 {happy} · 결정 {dec}번 · 일한 해 {work}년 · 마지막 재산 {final}"], ["[記録] 寿命{age}歳・平均幸福{happy}・決断{dec}回・働いた年{work}年・最後の財産{final}"], ["[Record] Lifespan {age} · average happiness {happy} · {dec} decisions · {work} working years · final wealth {final}"]),
  "verdict.view": V(["[해석] 이 인생을 한 줄로 말하면 {epithet|q이다}. 다만 이 해석은 기록을 읽는 한 가지 방법일 뿐, 좋은 삶과 나쁜 삶을 가르지 않는다.", "[해석] 숫자는 삶의 일부만 말해 준다. 기록이 가리키는 결은 {epithet|q이지만}, 이 삶의 값은 {name} 자신만이 매길 수 있다."], ["[解釈] この人生を一言で言えば「{epithet}」。ただしこれは記録の読み方の一つにすぎず、良い人生と悪い人生を分けるものではない。", "[解釈] 数字は人生の一部しか語らない。記録が指す筋目は「{epithet}」だが、この人生の値打ちを決められるのは{name}自身だけだ。"], ["[Interpretation] In a word, this life reads as \"{epithet}\". This is just one way to read the records — it does not sort lives into good and bad.", "[Interpretation] Numbers tell only part of a life. The records point to \"{epithet}\", but only {name} can say what this life was worth."]),
  "respect.plain": V(["눈에 띄는 큰 사건이 없는 삶도 하나의 완성된 삶이다. 하루하루를 지나온 것만으로도 충분했다."], ["目立つ大事件のない人生も、一つの完成した人生だ。一日一日を越えてきたことだけで十分だった。"], ["A life without headline events is still a complete life. Getting through each day was enough."]),
  "respect.alone": V(["혼자 산다는 것은 무언가 빠진 삶이 아니다. {name|은} 자기만의 방식으로 하루를 채웠다."], ["一人で生きることは、何かが欠けた人生ではない。{name}は自分なりのやり方で一日を満たした。"], ["Living alone is not a life with something missing. {name} filled the days in their own way."]),
  "respect.poor": V(["넉넉하지 않은 형편 속에서도 삶은 이어졌다. 그 버팀은 숫자로 다 담기지 않는다."], ["豊かではない暮らしの中でも、人生は続いた。その踏ん張りは数字には収まらない。"], ["Life went on even when means were tight. That endurance cannot be held in numbers."]),
  "respect.short": V(["짧은 삶이었다. 그러나 {age}년의 모든 날은 온전히 {name}의 것이었다."], ["短い人生だった。けれど{age}年のすべての日は、まるごと{name}のものだった。"], ["It was a short life. Yet every day of those {age} years belonged wholly to {name}."]),

  // ---------- 책 ----------
  "book.cover": V(["{name}의 자서전"], ["{name}の自伝"], ["The Autobiography of {name}"]),
  "book.prologue": V(["이 책은 {name|이가} 살아 낸 {age}년의 기록이다. 여기에 적힌 일은 모두 실제로 지나온 일이고, 따옴표 안의 말은 {name|이가} 직접 쓴 말이다.", "여기 한 사람의 {age}년이 있다. 모든 장면은 기록에서 왔고, 따옴표 속 문장은 {name}의 손으로 쓰였다."], ["この本は{name}が生き抜いた{age}年の記録だ。ここに書かれたことはすべて実際に過ぎてきたことで、かぎかっこの中の言葉は{name}が自分で書いた言葉だ。", "ここに一人の{age}年がある。すべての場面は記録から来ており、かぎかっこの文は{name}の手で書かれた。"], ["This book records the {age} years {name} lived. Everything here truly happened, and the words in quotation marks were written by {name}.", "Here are one person's {age} years. Every scene comes from the record, and every quoted line was written by {name}'s own hand."]),
  "book.letter": V(["마지막 편지 — {to}에게"], ["最後の手紙 — {to}へ"], ["A Last Letter — to {to}"]),
  "book.noletter": V(["{name|은} 편지를 남기지 않았다. 대신 이 책이 남았다."], ["{name}は手紙を残さなかった。代わりにこの本が残った。"], ["{name} left no letter. This book remains instead."]),
  "book.end": V(["— 끝 —", "{name}, {birth}–{death}"], ["— 完 —", "{name}、{birth}–{death}"], ["— The End —", "{name}, {birth}–{death}"]),
  "user.orig": V(["(직접 쓴 말 · 원문)"], ["(本人が書いた言葉・原文)"], ["(written by the player · original)"]),
};

// ---------- 화면 제목·통계 이름 ----------
export const LABEL = {
  "s.title": V("인생의 제목", "人生のタイトル", "Life Title"), "s.profile": V("최종 프로필", "最終プロフィール", "Final Profile"), "s.glance": V("한눈에 보기", "ひと目で見る", "At a Glance"),
  "s.story": V("자서전", "自伝", "Autobiography"), "s.chapters": V("연령대별 이야기", "年代別の物語", "Stories by Age"), "s.timeline": V("전체 타임라인", "全体タイムライン", "Full Timeline"),
  "s.career": V("직업과 업적", "仕事と業績", "Work & Achievements"), "s.economy": V("경제적 인생", "経済的な人生", "Life in Money"), "s.love": V("사랑과 결혼", "恋と結婚", "Love & Marriage"),
  "s.family": V("가족과 자녀", "家族と子ども", "Family & Children"), "s.people": V("인생에서 만난 사람들", "人生で出会った人々", "People Met Along the Way"), "s.health": V("건강과 생활", "健康と暮らし", "Health & Habits"),
  "s.growth": V("배움과 능력", "学びと能力", "Learning & Abilities"), "s.dream": V("꿈과 목표", "夢と目標", "Dreams & Goals"), "s.topHappy": V("가장 행복했던 순간 TOP 10", "最も幸せだった瞬間 TOP 10", "Happiest Moments — Top 10"),
  "s.topHard": V("가장 힘들었던 순간 TOP 10", "最もつらかった瞬間 TOP 10", "Hardest Moments — Top 10"), "s.topChoice": V("가장 중요한 선택 TOP 10", "最も重要な選択 TOP 10", "Most Important Choices — Top 10"),
  "s.notTaken": V("선택하지 않은 길", "選ばなかった道", "The Roads Not Taken"), "s.hidden": V("숨겨진 이야기", "隠された物語", "Hidden Stories"), "s.values": V("가치관의 변화", "価値観の変化", "How Values Changed"),
  "s.words": V("직접 쓴 말 모음", "自分で書いた言葉", "In My Own Words"), "s.regret": V("후회와 미련", "後悔と未練", "Regrets"), "s.legacy": V("남긴 것", "残したもの", "What Was Left Behind"),
  "s.last": V("인생의 마지막 장", "人生の最終章", "The Final Chapter"), "s.stats": V("인생 통계", "人生の統計", "Life Statistics"), "s.special": V("특별 결말", "特別な結末", "Special Endings"),
  "s.traits": V("이 인생의 결", "この人生の筋目", "The Grain of This Life"), "s.verdict": V("최종 평가", "最終評価", "Final Assessment"), "s.companions": V("같은 날 태어난 사람들", "同じ日に生まれた人たち", "Born the Same Day"),
  "s.letter": V("마지막 편지", "最後の手紙", "A Last Letter"), "s.album": V("추억 앨범", "思い出アルバム", "Memory Album"),
};
export const STAT_LABEL = {
  age: V("수명", "寿命", "Lifespan"), days: V("산 날", "生きた日数", "Days lived"), birthYear: V("태어난 해", "生まれた年", "Birth year"), deathYear: V("떠난 해", "旅立った年", "Year of death"),
  decisions: V("내린 결정", "下した決断", "Decisions made"), major: V("삶을 바꾼 결정", "人生を変えた決断", "Life-changing decisions"), fates: V("고를 수 없던 일", "選べなかった出来事", "Unchosen events"),
  fatesGood: V("뜻밖의 행운", "思いがけない幸運", "Unexpected luck"), fatesBad: V("뜻밖의 불운", "思いがけない不運", "Unexpected misfortune"), crit: V("크게 잘된 선택", "大成功の選択", "Great outcomes"),
  good: V("잘된 선택", "うまくいった選択", "Good outcomes"), mid: V("그저 그런 선택", "まずまずの選択", "So-so outcomes"), bad: V("꼬인 선택", "裏目に出た選択", "Bad outcomes"),
  workYears: V("일한 해", "働いた年数", "Working years"), jobsN: V("거친 일자리", "経験した仕事", "Jobs held"), longestJob: V("가장 오래 한 일", "最も長く続けた仕事", "Longest job"),
  careerStep: V("직업 최고 단계", "職業の最高段階", "Highest career stage"), totalIncome: V("평생 소득", "生涯収入", "Lifetime income"), peakMoney: V("최고 자산", "最高資産", "Peak wealth"),
  lowMoney: V("최저 자산", "最低資産", "Lowest wealth"), finalMoney: V("마지막 재산", "最後の財産", "Final wealth"), debtYears: V("빚진 해", "借金のあった年", "Years in debt"),
  happyAvg: V("평균 행복", "平均幸福", "Average happiness"), happyMax: V("최고 행복", "最高幸福", "Peak happiness"), happyMin: V("최저 행복", "最低幸福", "Lowest happiness"),
  healthMin: V("가장 약했던 건강", "最も弱った健康", "Lowest health"), healthEnd: V("마지막 건강", "最後の健康", "Final health"), intelMax: V("최고 지능", "最高知能", "Peak intelligence"),
  socialMax: V("최고 사회성", "最高社交性", "Peak sociability"), powerMax: V("최고 체력", "最高体力", "Peak stamina"), fameMax: V("최고 명성", "最高名声", "Peak fame"),
  stressAvg: V("평균 스트레스", "平均ストレス", "Average stress"), achieveMax: V("최고 성취도", "最高達成度", "Peak achievement"), married: V("결혼", "結婚", "Marriages"),
  marriedYears: V("결혼 생활", "結婚生活", "Years married"), divorced: V("이혼", "離婚", "Divorces"), kids: V("자녀", "子ども", "Children"),
  pets: V("반려동물", "ペット", "Pets"), friends: V("친구", "友達", "Friends"), foes: V("앙숙", "犬猿の仲", "Rivals"), people: V("기록된 사람", "記録された人", "People recorded"),
  peopleLost: V("먼저 보낸 사람", "先に見送った人", "People lost"), moves: V("사는 곳이 바뀐 횟수", "住まいが変わった回数", "Home changes"), thoughts: V("남긴 메모", "残したメモ", "Notes written"),
  wordsWritten: V("직접 쓴 글자", "自分で書いた文字数", "Characters written"), recalls: V("다시 떠올린 말", "思い出した言葉", "Words recalled"), achv: V("업적", "実績", "Achievements"),
  goals: V("이룬 목표", "達成した目標", "Goals achieved"), bestYear: V("가장 행복한 해", "最も幸せな年", "Happiest year"), worstYear: V("가장 힘든 해", "最もつらい年", "Hardest year"),
  focusTop: V("가장 많이 둔 초점", "最も多く置いた焦点", "Most common focus"), richYear: V("가장 부유한 해", "最も裕福な年", "Wealthiest year"), firstJobAge: V("첫 일을 시작한 나이", "初めて働いた年齢", "Age at first job"),
  marryAge: V("결혼한 나이", "結婚した年齢", "Age at marriage"), firstKidAge: V("첫 아이를 만난 나이", "初めての子に出会った年齢", "Age at first child"), retireAge: V("은퇴한 나이", "引退した年齢", "Retirement age"),
  lifeScore: V("종합 점수(게임)", "総合点(ゲーム)", "Overall score (game)"), dreamDone: V("어릴 적 꿈", "子どもの頃の夢", "Childhood dream"), specialN: V("특별 결말", "特別な結末", "Special endings"),
  traitsN: V("인생의 결", "人生の筋目", "Life traits"), lifeExp: V("이 게임 속 평균 수명 대비", "このゲームの平均寿命比", "vs. game average lifespan"), cause: V("떠난 이유", "旅立った理由", "Cause"),
};
export const FOCUS_NAME = {
  study: V("공부", "勉強", "Study"), work: V("일", "仕事", "Work"), love: V("사랑·인연", "恋・縁", "Love"), family: V("가족", "家族", "Family"), health: V("건강", "健康", "Health"),
  money: V("돈 모으기", "お金をためる", "Saving"), play: V("즐기기·취미", "遊び・趣味", "Fun & Hobbies"), friends: V("사람들", "人づきあい", "Friends"), rest: V("쉼", "休息", "Rest"),
};
export const REGION_NAME = {
  seoul: V("서울", "ソウル", "Seoul"), busan: V("부산", "釜山", "Busan"), incheon: V("인천", "仁川", "Incheon"), daegu: V("대구", "大邱", "Daegu"), daejeon: V("대전", "大田", "Daejeon"),
  gwangju: V("광주", "光州", "Gwangju"), ulsan: V("울산", "蔚山", "Ulsan"), gyeonggi: V("경기도", "京畿道", "Gyeonggi"), gangwon: V("강원도", "江原道", "Gangwon"), chungcheong: V("충청도", "忠清道", "Chungcheong"),
  jeolla: V("전라도", "全羅道", "Jeolla"), gyeongsang: V("경상도", "慶尚道", "Gyeongsang"), jeju: V("제주", "済州", "Jeju"),
};
export const HOUSE_NAME = { parents: V("부모님 집", "実家", "the family home"), rent: V("월셋집", "賃貸の部屋", "a rented room"), jeonse: V("전셋집", "チョンセの家", "a lease-deposit home"), own: V("내 집", "自分の家", "a home of their own") };
export const REL_NAME = {
  father: V("아버지", "父", "father"), mother: V("어머니", "母", "mother"), sibling: V("형제자매", "きょうだい", "sibling"), friend: V("친구", "友達", "friend"), bestfriend: V("단짝", "親友", "best friend"),
  lover: V("연인", "恋人", "partner"), spouse: V("배우자", "配偶者", "spouse"), exlover: V("옛 연인", "元恋人", "former partner"), child: V("자녀", "子ども", "child"), coworker: V("동료", "同僚", "coworker"),
  mentor: V("스승", "師", "mentor"), rival: V("라이벌", "ライバル", "rival"), cofounder: V("동업자", "共同創業者", "co-founder"), boss: V("상사", "上司", "boss"),
};
export const PERSONA_NAME = {
  bold: V("대담한", "大胆な", "bold"), calm: V("차분한", "落ち着いた", "calm"), curious: V("호기심 많은", "好奇心旺盛な", "curious"), warm: V("다정한", "やさしい", "warm"),
  stubborn: V("고집 센", "頑固な", "stubborn"), dreamy: V("꿈 많은", "夢見がちな", "dreamy"), careful: V("신중한", "慎重な", "careful"), funny: V("유쾌한", "愉快な", "funny"),
};
export const VALUE_NAME = {
  family: V("가족", "家族", "family"), freedom: V("자유", "自由", "freedom"), success: V("성공", "成功", "success"), love: V("사랑", "愛", "love"), health: V("건강", "健康", "health"),
  wealth: V("부", "富", "wealth"), friends: V("우정", "友情", "friendship"), knowledge: V("배움", "学び", "knowledge"), contribution: V("기여", "貢献", "contribution"), fun: V("즐거움", "楽しさ", "fun"),
};
export const INTEREST_NAME = {
  art: V("그림", "絵", "art"), music: V("음악", "音楽", "music"), sports: V("운동", "スポーツ", "sports"), science: V("과학", "科学", "science"), books: V("책", "本", "books"), games: V("게임", "ゲーム", "games"),
  travel: V("여행", "旅行", "travel"), cooking: V("요리", "料理", "cooking"), nature: V("자연", "自然", "nature"), money: V("돈 공부", "お金の勉強", "investing"), people: V("사람", "人", "people"), tech: V("기술", "技術", "technology"),
};
// 능력치 이름 (결말 문장·성격 변화)
export const STAT_NAME = { happy: V("행복", "幸福", "happiness"), intel: V("지능", "知能", "intelligence"), social: V("사회성", "社交性", "sociability"), power: V("체력", "体力", "stamina"), internet: V("인터넷력", "ネット力", "online savvy"), luck: V("운", "運", "luck"), health: V("건강", "健康", "health") };
// 성격 변화 묘사 (능력치가 크게 오른/내린 쪽)
export const SHIFT_NAME = {
  "social+": V("사람 곁을 좋아하는", "人のそばが好きな", "someone who loved being around people"), "social-": V("혼자가 편한", "一人が楽な", "someone at ease alone"),
  "intel+": V("생각이 깊어진", "思慮深くなった", "someone grown thoughtful"), "intel-": V("머리보다 몸으로 사는", "頭より体で生きる", "someone who lived by doing rather than thinking"),
  "happy+": V("웃음이 많은", "笑顔の多い", "someone who smiled often"), "happy-": V("말수가 줄어든", "口数の減った", "someone who had grown quieter"),
  "power+": V("단단해진", "たくましくなった", "someone grown sturdy"), "power-": V("조금 지친", "少し疲れた", "someone a little worn"),
  "internet+": V("세상 소식에 밝은", "世の中に明るい", "someone always plugged in"), "internet-": V("화면과 멀어진", "画面から離れた", "someone who drifted from screens"),
};
