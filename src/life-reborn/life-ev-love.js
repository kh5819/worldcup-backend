// =========================
// 플듀 인생게임 REBORN — 사건 3차: 연애·결혼·가족 (2026-11-23)
// 결혼하지 않는 삶·이혼·사별·한부모·입양도 그대로 존중한다. 형식: life-ev-kit.js 의 ev()
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const V = (id, meta, title, desc, choices) => EV.push(ev("lv_" + id, { area: "love", ...meta }, title, desc, choices));
const single = (p) => !p.spouse && !p.relations?.romance, dating = (p) => !p.spouse && !!p.relations?.romance;

// ---------- 첫 마음 ----------
V("crush_note", { age: [10, 15], emoji: "💌", scene: "classroom" }, ["책상 속 쪽지", "机の中の手紙", "A Note in Your Desk"], ["책상 서랍에 '좋아해'라고 적힌 쪽지가 있다. 이름은 없다.", "机の中に「好き」と書かれた手紙がある。名前はない。", "A note in your desk says 'I like you.' No name."], [
  ["find", "🕵️", ["글씨체로 범인을 찾는다", "筆跡で差出人を探す", "Match the handwriting"], { grade: "good", effects: { happy: 5, social: 2, intel: 1 }, n: ["짝꿍이었다. 둘 다 얼굴이 빨개져 일주일 동안 말을 못 했다.", "隣の席の子だった。二人とも真っ赤になって一週間話せなかった。", "It was my seatmate. We both turned red and didn't talk for a week."] }],
  ["keep", "📦", ["몰래 간직한다", "こっそりしまっておく", "Keep it secretly"], { effects: { happy: 3 }, n: ["그 쪽지는 이사할 때마다 따라왔다.", "その手紙は引っ越しのたびについてきた。", "That note came with me every time I moved."] }],
]);
V("school_crush", { age: [13, 18], emoji: "🌸", scene: "street", cond: single }, ["좋아하는 선배", "好きな先輩", "A Crush on an Upperclassman"], ["매일 같은 버스를 타는 선배에게 자꾸 눈이 간다.", "毎日同じバスに乗る先輩につい目が行く。", "You can't stop glancing at the upperclassman on your bus."], [
  ["say", "💬", ["용기 내서 말을 건다", "勇気を出して話しかける", "Work up the nerve to talk"], { outcomes: [
    { chance: 0.45, grade: "good", effects: { happy: 6, social: 3 }, relation: { romance: true }, n: ["선배가 웃으며 이어폰 한쪽을 건넸다.", "先輩が笑ってイヤホンの片方を差し出した。", "They smiled and handed me one earbud."] },
    { chance: 0.55, grade: "mid", effects: { happy: -2, social: 2 }, n: ["친절했지만 그게 다였다. 그래도 말해 본 게 좋았다.", "親切だったが、それだけだった。それでも話せてよかった。", "Kind, but that was all. Still, I was glad I spoke up."] }] }],
  ["watch", "👀", ["멀리서 본다", "遠くから見る", "Admire from afar"], { effects: { happy: 2 }, n: ["졸업식 날 선배가 떠나는 걸 봤다. 그날 버스 창밖이 흐렸다.", "卒業式の日、先輩が去るのを見た。その日のバスの窓は曇っていた。", "I watched them leave on graduation day. The bus window was foggy."] }],
]);
V("first_date", { age: [16, 30], emoji: "🎬", scene: "cafe", cond: dating }, ["첫 데이트", "初デート", "The First Date"], ["첫 데이트 날이다. 어디로 가야 할지 고민이다.", "初デートの日だ。どこへ行けばいいか悩む。", "It's your first date. Where should you go?"], [
  ["movie", "🍿", ["무난하게 영화", "無難に映画", "A safe movie"], { effects: { happy: 3, money: -10 }, n: ["팝콘 통에서 손이 닿았다. 영화 내용은 기억나지 않는다.", "ポップコーンの中で手が触れた。映画の内容は覚えていない。", "Our hands touched in the popcorn. I don't remember the movie."] }],
  ["walk", "🌆", ["걸으며 이야기", "歩きながら話す", "A long walk and talk"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["세 시간을 걸었다. 다리는 아팠는데 헤어지기 싫었다.", "三時間歩いた。足は痛かったが別れたくなかった。", "Three hours of walking. My feet hurt, but I didn't want it to end."] }],
  ["fancy", "🍷", ["비싼 레스토랑", "高いレストラン", "A fancy restaurant"], { effects: { happy: 2, money: -80 }, n: ["둘 다 긴장해서 포크만 만지작거렸다.", "二人とも緊張してフォークばかりいじっていた。", "We were both so nervous we just fiddled with our forks."] }],
]);
V("long_distance", { age: [18, 35], emoji: "📞", scene: "airport", cond: dating }, ["장거리 연애", "遠距離恋愛", "Long Distance"], ["연인이 다른 도시(나라)로 가게 됐다.", "恋人が別の街(国)へ行くことになった。", "Your partner is moving to another city (or country)."], [
  ["keep", "💞", ["매일 통화하며 버틴다", "毎日電話して乗り越える", "Call every day and make it work"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { happy: 3, social: 1 }, flag: { add: "ld_survived" }, n: ["시차 계산이 습관이 됐다. 우리는 버텼다.", "時差の計算が習慣になった。私たちは乗り越えた。", "Calculating time zones became a habit. We made it."] },
    { chance: 0.45, grade: "bad", effects: { happy: -6 }, relation: { breakup: true }, n: ["통화가 짧아지더니 어느 날 끊겼다.", "電話が短くなり、ある日途切れた。", "The calls got shorter, then one day stopped."] }] }],
  ["end", "🍂", ["좋을 때 헤어진다", "いいうちに別れる", "End it while it's still good"], { effects: { happy: -4 }, relation: { breakup: true }, n: ["공항에서 오래 안았다. 좋은 기억만 남기로 했다.", "空港で長く抱き合った。いい思い出だけ残すことにした。", "We held each other a long time at the airport. We kept only the good memories."] }],
]);
V("meet_parents", { age: [22, 45], emoji: "🍱", scene: "restaurant", cond: dating }, ["상대 부모님과의 첫 식사", "恋人の親との初食事", "Meeting the Parents"], ["연인의 부모님을 처음 뵙는다. 무엇을 사 가야 할까.", "恋人の親に初めて会う。何を持っていこう。", "You're meeting your partner's parents for the first time. What to bring?"], [
  ["fruit", "🍎", ["과일 바구니", "果物かご", "A fruit basket"], { grade: "good", effects: { social: 3, money: -15 }, n: ["아버님이 사과를 깎아 주셨다. 무사통과였다.", "お父さんがりんごをむいてくれた。無事合格だった。", "Their father peeled me an apple. I'd passed."] }],
  ["honest", "🗣️", ["빈손이지만 진심으로 대화한다", "手ぶらだが心から話す", "Arrive empty-handed but talk sincerely"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 4 }, n: ["어머님이 '말이 잘 통한다'며 웃으셨다.", "お母さんが「話が合うね」と笑った。", "Their mother laughed, 'We get along!'"] },
    { chance: 0.4, grade: "mid", effects: { social: -1, happy: -1 }, n: ["분위기가 조금 어색했다. 다음엔 꼭 뭔가 사 가기로 했다.", "少し気まずかった。次は必ず何か持っていこうと決めた。", "A bit awkward. Next time, I'd definitely bring something."] }] }],
]);
V("proposal_style", { age: [24, 45], emoji: "💍", scene: "park", cond: dating }, ["어떻게 청혼할까", "どうプロポーズする?", "How to Propose"], ["반지를 샀다. 이제 어떻게 말할지만 정하면 된다.", "指輪を買った。あとはどう言うか決めるだけだ。", "You've bought the ring. Now: how to ask?"], [
  ["simple", "🏠", ["집에서 조용히", "家で静かに", "Quietly at home"], { outcomes: [
    { chance: 0.8, grade: "crit", effects: { happy: 9 }, life: { marry: true }, n: ["설거지를 하다가 반지를 내밀었다. 상대가 고무장갑을 낀 채 울었다.", "皿洗いの途中で指輪を差し出した。相手はゴム手袋のまま泣いた。", "I offered the ring mid-dishwashing. They cried, still in rubber gloves."] },
    { chance: 0.2, grade: "mid", effects: { happy: -2 }, n: ["'조금만 더 생각할 시간을 줘.' 반지는 서랍으로 들어갔다.", "「もう少し考える時間をちょうだい」指輪は引き出しへ。", "'Give me a little more time.' The ring went into a drawer."] }] }],
  ["event", "🎆", ["친구들과 깜짝 이벤트", "友達とサプライズ", "A big surprise with friends"], { outcomes: [
    { chance: 0.65, grade: "crit", effects: { happy: 9, social: 3, money: -100 }, life: { marry: true }, n: ["풍선이 터지고 친구들이 튀어나왔다. 대답은 '응!'이었다.", "風船が割れ、友達が飛び出した。答えは「うん!」だった。", "Balloons popped, friends jumped out. The answer was 'Yes!'"] },
    { chance: 0.35, grade: "mid", effects: { happy: -3, money: -100 }, n: ["사람들 앞이라 부담스러워했다. 나중에 둘이서 다시 이야기했다.", "人前でプレッシャーだったようだ。後で二人で改めて話した。", "Too much pressure in public. We talked it over later, just us."] }] }],
]);
V("newlywed_chores", { age: [24, 50], emoji: "🧺", scene: "home", married: true, cond: (p) => p.age - (p.spouse?.since ?? p.age) <= 3 }, ["신혼의 집안일", "新婚の家事", "Newlywed Chores"], ["누가 설거지를 할지로 또 신경전이다.", "どっちが皿洗いをするかでまた火花が散る。", "Another standoff over who does the dishes."], [
  ["chart", "📋", ["당번표를 만든다", "当番表を作る", "Make a chore chart"], { grade: "good", effects: { happy: 3, intel: 1 }, n: ["냉장고에 붙은 표가 우리 집 헌법이 됐다.", "冷蔵庫に貼った表が我が家の憲法になった。", "The chart on the fridge became our household constitution."] }],
  ["rps", "✊", ["가위바위보로 정한다", "じゃんけんで決める", "Settle it with rock-paper-scissors"], { effects: { happy: 2 }, n: ["10년째 가위바위보를 하고 있다. 승률은 비슷하다.", "十年じゃんけんを続けている。勝率は同じくらい。", "Ten years of rock-paper-scissors. We're about even."] }],
]);
V("baby_name", { age: [24, 48], emoji: "🍼", scene: "hospitalBirth", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born <= 1) }, ["아이 이름 짓기", "子どもの名付け", "Naming the Baby"], ["아이 이름을 정해야 한다. 집안 어른들 의견이 다 다르다.", "子どもの名前を決めなければ。親族の意見がバラバラだ。", "Time to name the baby. Every relative has an opinion."], [
  ["ours", "✍️", ["우리 둘이 정한다", "二人で決める", "The two of you decide"], { grade: "good", effects: { happy: 4 }, n: ["밤새 사전을 뒤졌다. 그 이름을 부를 때마다 그 밤이 생각났다.", "一晩中辞書をめくった。その名前を呼ぶたびにあの夜を思い出した。", "We flipped through dictionaries all night. Every time I said the name, I remembered that night."] }],
  ["elder", "👴", ["어른들께 맡긴다", "年長者に任せる", "Let the elders choose"], { effects: { social: 2, happy: 1 }, n: ["할아버지가 지어 준 이름은 조금 옛날 느낌이었지만 뜻이 깊었다.", "祖父がつけた名前は少し古風だったが、意味が深かった。", "Grandpa's choice was a bit old-fashioned, but deeply meaningful."] }],
]);
V("sleepless_baby", { age: [24, 50], emoji: "😵", scene: "nursery", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born <= 1) }, ["밤샘 육아", "夜泣き", "Sleepless Nights with a Baby"], ["석 달째 두 시간 이상 자 본 적이 없다.", "三か月、二時間以上眠れた日がない。", "Three months without more than two hours of sleep."], [
  ["shift", "🔁", ["배우자와 교대로 잔다", "配偶者と交代で寝る", "Take turns with your partner"], { grade: "good", effects: { health: 1, happy: 2 }, married: true, n: ["밤 12시 교대. 서로 '수고했어'라고 속삭였다.", "夜十二時に交代。互いに「お疲れ」とささやいた。", "Midnight shift change. We whispered 'good job' to each other."] }],
  ["help", "👵", ["부모님께 SOS", "親にSOS", "Call your parents for help"], { effects: { health: 2, happy: 2, social: 1 }, n: ["어머니가 오셔서 아기를 안자 거짓말처럼 잠들었다. 나도.", "母が来て赤ちゃんを抱くと、嘘のように眠った。私も。", "Mom arrived, held the baby, and it fell asleep like magic. So did I."] }],
  ["alone", "🫠", ["혼자 버틴다", "一人で耐える", "Push through alone"], { grade: "bad", effects: { health: -3, happy: -2 }, n: ["커피를 두 잔 마시고 기저귀 가방을 냉장고에 넣었다.", "コーヒーを二杯飲んで、おむつバッグを冷蔵庫に入れた。", "Two coffees in, I put the diaper bag in the fridge."] }],
]);
V("first_steps", { age: [24, 52], emoji: "👣", scene: "home", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born === 1) }, ["첫걸음", "はじめの一歩", "First Steps"], ["아이가 소파를 잡고 일어서더니 한 발을 뗐다.", "子どもがソファにつかまって立ち、一歩踏み出した。", "Your child pulls up on the couch and takes a step."], [
  ["video", "📹", ["영상으로 남긴다", "動画に残す", "Catch it on video"], { grade: "good", effects: { happy: 6 }, n: ["가족 단톡방에 올렸다. 할머니가 열 번 돌려 봤다고 한다.", "家族グループに上げた。祖母が十回見返したそうだ。", "Posted it to the family chat. Grandma watched it ten times."] }],
  ["catch", "🤲", ["넘어질까 두 팔을 벌린다", "転ばないよう両手を広げる", "Open your arms to catch them"], { grade: "good", effects: { happy: 6, social: 1 }, n: ["세 걸음 만에 내 품에 안겼다.", "三歩で私の腕に飛び込んだ。", "Three steps, right into my arms."] }],
]);
V("kid_question", { age: [28, 55], emoji: "❓", scene: "kidroom", hasKid: true, cond: (p) => p.kids.some(k => { const a = p.age - k.born; return a >= 4 && a <= 8; }) }, ["아이의 질문", "子どもの質問", "Your Child's Question"], ["아이가 묻는다. '사람은 죽으면 어디로 가?'", "子どもが聞く。「人は死んだらどこへ行くの?」", "Your child asks, 'Where do people go when they die?'"], [
  ["honest", "🌙", ["솔직하게, 아이 눈높이로", "正直に、子どもの目線で", "Answer honestly, at their level"], { grade: "good", effects: { happy: 2, intel: 1 }, n: ["아이는 한참 생각하더니 '그럼 할머니한테 오래 잘해야겠다'고 했다.", "子どもはしばらく考えて「じゃあおばあちゃんに長く優しくしなきゃ」と言った。", "After thinking a while, they said, 'Then I should be nice to Grandma for a long time.'"] }],
  ["story", "⭐", ["별이 된다고 말한다", "星になると言う", "Say they become stars"], { effects: { happy: 3 }, n: ["그날 밤 아이는 창밖의 별을 세다 잠들었다.", "その夜、子どもは窓の外の星を数えながら眠った。", "That night, they fell asleep counting stars."] }],
]);
V("parent_teacher", { age: [30, 55], emoji: "🏫", scene: "classroom", hasKid: true, cond: (p) => p.kids.some(k => { const a = p.age - k.born; return a >= 7 && a <= 15; }) }, ["학부모 상담", "保護者面談", "Parent-Teacher Meeting"], ["담임 선생님이 아이가 수업 시간에 자꾸 딴짓을 한다고 한다.", "担任が、子どもが授業中によそ見ばかりすると言う。", "The teacher says your kid keeps getting distracted in class."], [
  ["listen", "👂", ["집에서 아이 이야기를 먼저 듣는다", "家でまず子の話を聞く", "Listen to your kid first at home"], { grade: "good", effects: { happy: 3, social: 1 }, n: ["창밖의 새를 그리느라 그랬다고 했다. 미술 학원을 알아봤다.", "窓の外の鳥を描いていたからだと言った。絵の教室を探した。", "They'd been drawing birds outside the window. I looked into art classes."] }],
  ["scold", "😠", ["혼낸다", "叱る", "Scold them"], { grade: "bad", effects: { happy: -3 }, n: ["아이는 그 뒤로 학교 이야기를 잘 안 했다.", "子どもはそれ以来学校の話をあまりしなくなった。", "After that, they stopped talking about school."] }],
]);
V("teen_kid_door", { age: [38, 65], emoji: "🚪", scene: "home", hasKid: true, cond: (p) => p.kids.some(k => { const a = p.age - k.born; return a >= 13 && a <= 18; }) }, ["닫힌 방문", "閉ざされたドア", "The Closed Door"], ["사춘기 아이 방문이 하루 종일 닫혀 있다.", "思春期の子の部屋のドアが一日中閉まっている。", "Your teenager's door stays shut all day."], [
  ["knock", "🍜", ["야식을 들고 노크한다", "夜食を持ってノックする", "Knock with a late-night snack"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["라면을 같이 먹으며 처음으로 좋아하는 가수 이야기를 들었다.", "ラーメンを一緒に食べながら、初めて好きな歌手の話を聞いた。", "Over ramen, I finally heard about their favorite singer."] }],
  ["wait", "🕰️", ["기다려 준다", "待ってあげる", "Give them space"], { effects: { happy: 1 }, n: ["몇 달 뒤 아이가 먼저 거실로 나와 앉았다.", "数か月後、子どもが自分からリビングに来て座った。", "Months later, they came out and sat in the living room on their own."] }],
]);
V("anniversary_forget", { age: [28, 80], emoji: "📅", scene: "home", married: true }, ["잊어버린 생일", "忘れた誕生日", "A Forgotten Birthday"], ["달력을 보니 어제가 배우자 생일이었다.", "カレンダーを見たら昨日が配偶者の誕生日だった。", "You check the calendar. Your spouse's birthday was yesterday."], [
  ["make", "🎂", ["오늘 두 배로 챙긴다", "今日は倍で祝う", "Make up for it double today"], { grade: "good", effects: { happy: 3, money: -50 }, n: ["{spouse}가 '어제보다 오늘이 더 좋네'라고 했다.", "{spouse}が「昨日より今日の方がいいね」と言った。", "{spouse} said, 'Today's even better than yesterday would've been.'"] }],
  ["joke", "😅", ["농담으로 넘긴다", "冗談でごまかす", "Laugh it off"], { grade: "bad", effects: { happy: -4 }, n: ["{spouse}는 웃지 않았다.", "{spouse}は笑わなかった。", "{spouse} did not laugh."] }],
]);
V("marriage_crisis", { age: [32, 65], emoji: "💔", scene: "home", married: true }, ["권태기", "倦怠期", "A Rough Patch"], ["{spouse}와 하루에 나누는 말이 '밥 먹었어?'뿐이다.", "{spouse}との会話が「ご飯食べた?」だけになった。", "The only thing you and {spouse} say all day is 'Did you eat?'"], [
  ["counsel", "🛋️", ["부부 상담을 받아 본다", "夫婦カウンセリングを受ける", "Try couples counseling"], { grade: "good", effects: { happy: 5, social: 2, money: -80 }, n: ["상담실에서 10년 만에 서로의 말을 끝까지 들었다.", "相談室で十年ぶりに互いの話を最後まで聞いた。", "In that office, we listened to each other fully for the first time in ten years."] }],
  ["trip", "🧳", ["둘이서만 여행 간다", "二人きりで旅行する", "Take a trip, just the two of you"], { grade: "good", effects: { happy: 5, money: -150 }, flag: { add: "travel" }, n: ["낯선 도시에서 연애 때처럼 손을 잡았다.", "知らない街で恋人時代のように手をつないだ。", "In a strange city, we held hands like we did when dating."] }],
  ["drift", "🌫️", ["그냥 산다", "そのまま暮らす", "Just keep going"], { grade: "bad", effects: { happy: -4 }, n: ["같은 집에 사는 룸메이트 같았다.", "同じ家に住むルームメイトのようだった。", "We were like roommates."] }],
]);
V("divorce_talk", { age: [30, 70], emoji: "📄", scene: "home", married: true, cond: (p) => (p.spouse?.bond ?? 60) < 35 }, ["이혼 이야기", "離婚の話", "Talking About Divorce"], ["{spouse}가 조용히 말했다. '우리, 여기까지인 것 같아.'", "{spouse}が静かに言った。「私たち、ここまでかもしれない」", "{spouse} says quietly, 'I think this is where we end.'"], [
  ["agree", "🤝", ["서로를 위해 헤어지기로 한다", "互いのために別れることにする", "Agree to part, for both your sakes"], { effects: { happy: -6 }, life: { divorce: true }, n: ["서류에 도장을 찍던 날, 둘 다 '고마웠어'라고 했다.", "書類に判を押した日、二人とも「ありがとう」と言った。", "The day we signed, we both said, 'Thank you for everything.'"] }],
  ["try", "🔁", ["한 번만 더 노력해 보자고 한다", "もう一度だけ頑張ろうと言う", "Ask to try one more time"], { outcomes: [
    { chance: 0.45, grade: "good", effects: { happy: 4 }, n: ["1년이 걸렸다. 다시 같은 쪽을 보게 됐다.", "一年かかった。また同じ方向を向けるようになった。", "It took a year. We found our way back to facing the same direction."] },
    { chance: 0.55, grade: "bad", effects: { happy: -7 }, life: { divorce: true }, n: ["노력은 했다. 그래도 끝은 왔다.", "努力はした。それでも終わりは来た。", "We tried. The end still came."] }] }],
]);
V("single_parent", { age: [25, 60], emoji: "🧑‍🍼", scene: "home", hasKid: true, married: false }, ["혼자 키우는 아이", "一人で育てる子", "Raising a Child Alone"], ["아침엔 등원, 낮엔 일, 밤엔 숙제. 혼자서 다 한다.", "朝は登園、昼は仕事、夜は宿題。全部一人でこなす。", "Drop-off in the morning, work all day, homework at night. All on your own."], [
  ["ask", "🫶", ["도움을 청한다", "助けを求める", "Ask for help"], { grade: "good", effects: { happy: 4, social: 3, health: 1 }, n: ["이웃이 일주일에 한 번 아이를 봐 주기로 했다. 처음으로 혼자 영화를 봤다.", "近所の人が週一で子どもを見てくれることになった。初めて一人で映画を見た。", "A neighbor offered to watch my kid once a week. I saw a movie alone for the first time."] }],
  ["strong", "💪", ["씩씩하게 혼자 해낸다", "たくましく一人でやり抜く", "Handle it all, head high"], { effects: { power: 3, health: -2, happy: 1 }, n: ["아이가 '엄마(아빠)는 슈퍼맨'이라고 그림을 그려 줬다.", "子どもが「ママ(パパ)はスーパーマン」という絵を描いてくれた。", "My kid drew me as a superhero."] }],
]);
V("adoption", { age: [30, 50], emoji: "🏡", scene: "home", hasKid: false }, ["입양을 생각하다", "養子縁組を考える", "Considering Adoption"], ["아이를 키우고 싶다. 입양 기관 상담을 받아 볼까.", "子どもを育てたい。養子縁組の相談を受けてみようか。", "You want to raise a child. Maybe talk to an adoption agency."], [
  ["adopt", "💛", ["긴 과정을 시작한다", "長い手続きを始める", "Begin the long process"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 9, social: 2, money: -300 }, life: { child: 1 }, flag: { add: "adopted_child" }, n: ["2년이 걸렸다. 처음 만난 날, 아이가 내 손가락을 꼭 쥐었다.", "二年かかった。初めて会った日、子どもが私の指をぎゅっと握った。", "Two years. The day we met, they squeezed my finger tight."] },
    { chance: 0.4, grade: "mid", effects: { happy: -2, intel: 1 }, n: ["기다림이 길어졌다. 대신 위탁 가정 봉사를 시작했다.", "待ちが長くなった。代わりに里親ボランティアを始めた。", "The wait stretched on. Meanwhile, I started volunteering with foster care."] }] }],
  ["later", "🌱", ["아직은 마음의 준비가 덜 됐다", "まだ心の準備ができていない", "Not ready yet"], { effects: { happy: -1 }, n: ["상담 책자를 책장에 꽂아 두었다.", "相談の冊子を本棚に差しておいた。", "I put the brochure on my bookshelf."] }],
]);
V("childfree", { age: [30, 45], emoji: "🌿", scene: "cafe", married: true, hasKid: false }, ["아이 없는 삶", "子どものいない人生", "A Child-Free Life"], ["명절마다 '아이는 언제?'라는 질문을 받는다.", "正月のたびに「子どもはいつ?」と聞かれる。", "Every holiday, someone asks, 'When are you having kids?'"], [
  ["clear", "🗣️", ["우리 선택이라고 분명히 말한다", "自分たちの選択だとはっきり言う", "Say clearly it's your choice"], { grade: "good", effects: { happy: 4 }, flag: { add: "childfree" }, n: ["친척들은 조용해졌다. {spouse}가 테이블 아래로 손을 잡았다.", "親戚は静かになった。{spouse}がテーブルの下で手を握った。", "The relatives went quiet. {spouse} held my hand under the table."] }],
  ["smile", "🙂", ["웃으며 넘긴다", "笑ってやり過ごす", "Smile and change the subject"], { effects: { happy: 1 }, n: ["올해도 무사히 지나갔다.", "今年も無事に過ぎた。", "Survived another year."] }],
]);
V("infertility", { age: [28, 45], emoji: "🩺", scene: "clinic", married: true, hasKid: false }, ["기다리는 아기", "待ちわびる赤ちゃん", "Waiting for a Baby"], ["아이를 원하지만 쉽게 생기지 않는다.", "子どもが欲しいが、なかなか授からない。", "You want a child, but it isn't happening easily."], [
  ["treat", "💉", ["병원의 도움을 받는다", "病院の助けを借りる", "Seek medical help"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 9, money: -500, health: -1 }, life: { child: 1 }, n: ["세 번째 시도에 두 줄을 봤다. 둘이 화장실 앞에서 울었다.", "三回目の挑戦で陽性が出た。二人でトイレの前で泣いた。", "On the third try, two lines. We cried outside the bathroom."] },
    { chance: 0.5, grade: "bad", effects: { happy: -6, money: -500, health: -2 }, n: ["몇 년을 노력했다. 끝내 둘이서 살기로 했다.", "何年も頑張った。最終的に二人で生きることにした。", "We tried for years. In the end, we chose a life for two."] }] }],
  ["accept", "🕊️", ["둘이서도 충분하다", "二人でも十分", "The two of us are enough"], { effects: { happy: 2 }, flag: { add: "childfree" }, n: ["강아지 한 마리를 들였다. 집이 다시 시끄러워졌다.", "子犬を一匹迎えた。家がまた賑やかになった。", "We adopted a puppy. The house got loud again."], life: { pet: { kind: "dog" } } }],
]);
V("kid_leaves_home", { age: [45, 75], emoji: "🧳", scene: "home", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born === 20) }, ["아이가 집을 떠난다", "子どもが家を出る", "Your Child Leaves Home"], ["아이가 독립한다며 짐을 싼다.", "子どもが独立すると荷造りしている。", "Your child is packing to move out on their own."], [
  ["help", "📦", ["이삿짐을 날라 준다", "引っ越しを手伝う", "Help them move"], { grade: "good", effects: { happy: 3, health: -1 }, n: ["새 집 냉장고를 반찬으로 가득 채워 주고 왔다.", "新居の冷蔵庫をおかずでいっぱいにして帰った。", "I filled their new fridge with home-cooked dishes before leaving."] }],
  ["room", "🛏️", ["빈방 앞에 오래 서 있는다", "空いた部屋の前に長く立つ", "Stand in the empty room a long time"], { effects: { happy: -3 }, n: ["벽에 키를 재던 연필 자국이 남아 있었다.", "壁に背を測った鉛筆の跡が残っていた。", "The pencil marks of their height were still on the wall."] }],
]);
V("empty_nest_couple", { age: [50, 75], emoji: "🍷", scene: "kitchen", married: true, hasKid: true }, ["둘만 남은 집", "二人だけの家", "Just the Two of You Again"], ["아이들이 모두 떠났다. 저녁 식탁에 의자 두 개만 남았다.", "子どもたちがみんな出ていった。夕食のテーブルには椅子が二つだけ。", "The kids are all gone. Just two chairs at the dinner table."], [
  ["hobby", "🎨", ["둘이 같이 할 취미를 찾는다", "二人でできる趣味を探す", "Find a hobby to share"], { grade: "good", effects: { happy: 6, social: 1 }, n: ["둘이 등산 동호회에 들었다. 신혼 때보다 대화가 많아졌다.", "二人で登山サークルに入った。新婚の頃より会話が増えた。", "We joined a hiking club. We talk more now than when we were newlyweds."] }],
  ["quiet", "🫖", ["조용함을 즐긴다", "静けさを楽しむ", "Enjoy the quiet"], { effects: { happy: 3, health: 1 }, n: ["차를 마시며 창밖을 봤다. 이것도 좋았다.", "お茶を飲みながら窓の外を見た。これも悪くなかった。", "We drank tea and watched the window. This was good too."] }],
]);
V("grandchild_born", { age: [48, 85], emoji: "👶", scene: "hospitalBirth", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born >= 26) }, ["손주가 태어났다", "孫が生まれた", "A Grandchild Is Born"], ["새벽에 전화가 왔다. '엄마(아빠), 나왔어!'", "明け方に電話が来た。「生まれたよ!」", "A call at dawn: 'The baby's here!'"], [
  ["rush", "🚕", ["택시 타고 달려간다", "タクシーで駆けつける", "Rush over by taxi"], { grade: "crit", effects: { happy: 9, social: 2 }, flag: { add: "grandparent" }, n: ["유리창 너머 작은 얼굴이 내 아이를 꼭 닮았다.", "ガラス越しの小さな顔が我が子にそっくりだった。", "The tiny face behind the glass looked just like my child once did."] }],
  ["cook", "🍲", ["미역국부터 끓인다", "産後のスープを作る", "Start cooking postpartum soup"], { grade: "good", effects: { happy: 7 }, flag: { add: "grandparent" }, n: ["큰 냄비 두 개를 끓여 들고 갔다.", "大鍋二つ分を作って持っていった。", "I brought two giant pots of soup."] }],
]);
V("late_marriage", { age: [40, 65], emoji: "💐", scene: "wedding", married: false, cond: dating }, ["늦은 결혼", "遅い結婚", "Marrying Later in Life"], ["마흔이 넘어 만난 사람과 결혼 이야기가 나왔다.", "四十を過ぎて出会った人と結婚の話が出た。", "Marriage comes up with someone you met after forty."], [
  ["yes", "💍", ["작게라도 식을 올린다", "小さくても式を挙げる", "Have a small ceremony"], { grade: "crit", effects: { happy: 8, social: 2 }, life: { marry: true }, n: ["하객은 스무 명. '늦었다'는 말보다 '잘했다'는 말을 더 많이 들었다.", "招待客は二十人。「遅い」より「よかったね」と多く言われた。", "Twenty guests. I heard 'Good for you' far more than 'Took you long enough.'"] }],
  ["together", "🏡", ["결혼 대신 함께 산다", "結婚せず一緒に暮らす", "Live together without marrying"], { effects: { happy: 5 }, n: ["서류보다 매일 저녁이 더 중요했다.", "書類より毎晩の食卓が大事だった。", "Every evening together mattered more than paperwork."] }],
]);
V("widowed_grief", { age: [50, 100], emoji: "🕯️", scene: "cemetery", cond: (p) => p.flags?.has?.("widowed") }, ["혼자 맞는 기념일", "一人で迎える記念日", "An Anniversary Alone"], ["먼저 간 배우자와의 결혼기념일이다.", "先に逝った配偶者との結婚記念日だ。", "It's your wedding anniversary — with a spouse who's gone."], [
  ["visit", "💐", ["꽃을 들고 찾아간다", "花を持って会いに行く", "Visit with flowers"], { grade: "good", effects: { happy: 2, social: 1 }, n: ["올해 있었던 일을 다 이야기해 주고 왔다.", "今年あったことを全部話して帰った。", "I told them everything that happened this year."] }],
  ["album", "📷", ["앨범을 넘겨 본다", "アルバムをめくる", "Look through the album"], { effects: { happy: 1 }, n: ["웃는 사진이 생각보다 많았다.", "笑っている写真が思ったより多かった。", "There were more smiling photos than I remembered."] }],
]);
V("second_love", { age: [55, 90], emoji: "🌷", scene: "park", married: false, cond: (p) => p.flags?.has?.("widowed") || p.flags?.has?.("divorced") }, ["두 번째 봄", "二度目の春", "A Second Spring"], ["산책 모임에서 자꾸 눈이 마주치는 사람이 있다.", "散歩会でよく目が合う人がいる。", "Someone at the walking club keeps catching your eye."], [
  ["tea", "🍵", ["차 한잔하자고 한다", "お茶に誘う", "Invite them for tea"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 8, social: 3 }, relation: { romance: true }, n: ["자식들이 놀라더니 이내 축하해 줬다.", "子どもたちは驚いたが、すぐに祝ってくれた。", "My kids were surprised, then quickly cheered me on."] },
    { chance: 0.4, grade: "mid", effects: { happy: 2, social: 2 }, n: ["좋은 친구가 됐다. 그것도 충분했다.", "いい友達になった。それで十分だった。", "We became good friends. That was enough too."] }] }],
  ["no", "🌙", ["마음에만 둔다", "心にしまう", "Keep it to yourself"], { effects: { happy: 1 }, n: ["봄이 지나갔다.", "春が過ぎていった。", "Spring passed."] }],
]);
V("cousins_reunion", { age: [20, 80], emoji: "👨‍👩‍👧‍👦", scene: "home" }, ["사촌들 모임", "いとこの集まり", "Cousins' Gathering"], ["어릴 때 명절마다 뛰어놀던 사촌들이 다 모인다고 한다.", "子どもの頃、休みのたびに遊んだいとこたちが集まるという。", "All the cousins you played with every holiday as kids are getting together."], [
  ["go", "🎉", ["간다", "行く", "Go"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["다들 부모님 얼굴을 닮아 가고 있었다.", "みんな親の顔に似てきていた。", "Everyone was starting to look like their parents."] }],
  ["call", "📞", ["못 가서 영상 통화로", "行けないのでビデオ通話で", "Join by video call"], { effects: { happy: 2, social: 1 }, n: ["화면 속에서 다 같이 건배를 했다.", "画面の中でみんなで乾杯した。", "We toasted together through the screen."] }],
]);
V("parent_remarry", { age: [15, 55], emoji: "💒", scene: "wedding" }, ["부모님의 재혼", "親の再婚", "A Parent Remarries"], ["홀로 지내던 아버지(어머니)가 재혼하겠다고 한다.", "一人だった父(母)が再婚すると言う。", "Your widowed (or divorced) parent announces they're remarrying."], [
  ["bless", "🙏", ["진심으로 축복한다", "心から祝福する", "Give your blessing"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["새 가족이 생겼다. 생각보다 따뜻한 사람이었다.", "新しい家族ができた。思ったより温かい人だった。", "A new family member — warmer than I expected."] }],
  ["cold", "🧊", ["받아들이기 어렵다", "受け入れがたい", "Find it hard to accept"], { effects: { happy: -3, social: -2 }, n: ["결혼식에서 웃지 못했다. 마음을 여는 데 몇 년이 걸렸다.", "結婚式で笑えなかった。心を開くまで何年もかかった。", "I couldn't smile at the wedding. It took years to open up."] }],
]);
V("in_law_care", { age: [40, 70], emoji: "🏥", scene: "hospital", married: true }, ["배우자 부모님의 병간호", "義理の親の看病", "Caring for Your In-Laws"], ["{spouse}의 부모님이 편찮으시다. 누가 돌볼지 의논해야 한다.", "{spouse}の親が具合が悪い。誰が面倒を見るか相談しなければ。", "{spouse}'s parent is ill. You need to decide who will care for them."], [
  ["share", "🤝", ["형제들과 순번을 정한다", "きょうだいと順番を決める", "Set up a rotation with siblings"], { grade: "good", effects: { social: 3, happy: 1, health: -1 }, n: ["표를 만들어 나눴다. 아무도 혼자 무너지지 않았다.", "表を作って分担した。誰も一人で倒れなかった。", "We made a schedule. Nobody broke down alone."] }],
  ["take", "💪", ["우리가 모신다", "うちで引き取る", "Take them in"], { effects: { social: 4, happy: -2, health: -2, money: -200 }, n: ["힘들었지만 {spouse}가 그 일을 평생 고마워했다.", "大変だったが、{spouse}はそのことを一生感謝した。", "It was hard, but {spouse} was grateful for the rest of their life."] }],
]);
V("family_photo", { age: [25, 90], emoji: "📸", scene: "home" }, ["가족사진", "家族写真", "Family Portrait"], ["사진관에서 가족사진을 찍자는 이야기가 나왔다.", "写真館で家族写真を撮ろうという話が出た。", "Someone suggests getting a professional family portrait."], [
  ["take", "📷", ["다 같이 찍는다", "みんなで撮る", "Everyone gets in the photo"], { grade: "good", effects: { happy: 5, social: 2, money: -30 }, n: ["액자는 거실 한가운데 걸렸다. 몇 년 뒤 그 사진이 가장 소중해졌다.", "額はリビングの真ん中に飾られた。数年後、その写真が一番の宝物になった。", "It hung in the middle of the living room. Years later, it was the most precious thing we owned."] }],
  ["later", "⏳", ["다들 바빠 다음에", "みんな忙しいので次回", "Everyone's busy — next time"], { effects: { happy: -1 }, n: ["'다음에'는 오지 않았다.", "「次回」は来なかった。", "'Next time' never came."] }],
]);
V("sibling_baby", { age: [3, 12], emoji: "🍼", scene: "home" }, ["동생이 생겼다", "弟妹ができた", "A New Baby Sibling"], ["엄마가 동생이 생긴다고 한다. 내 장난감을 나눠야 할까.", "母が弟か妹ができると言う。おもちゃを分けなきゃいけないのかな。", "Mom says a baby is coming. Do you have to share your toys?"], [
  ["happy", "🥳", ["언니(오빠, 형, 누나)가 될 준비를 한다", "お兄ちゃん(お姉ちゃん)になる準備をする", "Get ready to be the big sibling"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["아기에게 내가 제일 좋아하는 인형을 줬다.", "赤ちゃんに一番好きなぬいぐるみをあげた。", "I gave the baby my favorite stuffed animal."] }],
  ["jealous", "😤", ["질투가 난다", "やきもちを焼く", "Feel jealous"], { effects: { happy: -3 }, n: ["한동안 아기처럼 굴었다. 엄마가 꼭 안아 주었다.", "しばらく赤ちゃん返りした。母がぎゅっと抱きしめてくれた。", "I acted like a baby for a while. Mom held me tight."] }],
]);
V("parents_fight", { age: [6, 16], emoji: "🌧️", scene: "kidroom" }, ["부모님의 싸움", "親の喧嘩", "Parents Fighting"], ["방문 너머로 부모님이 크게 다투는 소리가 들린다.", "ドアの向こうで両親が大声で言い争っている。", "Through the door, you hear your parents arguing loudly."], [
  ["music", "🎧", ["이어폰을 끼고 동생을 달랜다", "イヤホンをして弟妹をなだめる", "Put on headphones and comfort your sibling"], { effects: { happy: -2, social: 2 }, n: ["그날 밤 동생과 같은 이불을 덮고 잤다.", "その夜、弟妹と同じ布団で寝た。", "That night, my sibling and I slept under the same blanket."] }],
  ["say", "🗣️", ["나가서 '그만해'라고 말한다", "出ていって「やめて」と言う", "Go out and say 'stop'"], { grade: "good", effects: { happy: -1, power: 2 }, n: ["부모님이 놀라 멈췄다. 다음 날 아침 두 분이 사과했다.", "親は驚いて止まった。翌朝、二人が謝った。", "They stopped, startled. The next morning, both apologized."] }],
]);
V("grandparent_story", { age: [5, 14], emoji: "👵", scene: "countryside" }, ["할머니 댁의 여름", "祖母の家の夏", "Summer at Grandma's"], ["방학이라 할머니 댁에 맡겨졌다. 휴대폰도 텔레비전도 잘 안 된다.", "休みで祖母の家に預けられた。携帯もテレビもあまり映らない。", "You're sent to Grandma's for the break. Barely any signal or TV."], [
  ["listen", "📖", ["할머니의 옛날이야기를 듣는다", "祖母の昔話を聞く", "Listen to Grandma's stories"], { grade: "good", effects: { happy: 4, intel: 2, social: 1 }, flag: { add: "grandma_stories" }, n: ["할머니가 어렸을 때 이야기는 역사책보다 생생했다.", "祖母の子どもの頃の話は歴史の本より生々しかった。", "Grandma's childhood stories were more vivid than any history book."] }],
  ["bored", "😑", ["심심해서 몸부림친다", "退屈で身もだえする", "Squirm with boredom"], { effects: { happy: -1, power: 2 }, n: ["결국 개울에서 가재를 잡으며 놀았다. 그것도 좋았다.", "結局小川でザリガニを捕って遊んだ。それも楽しかった。", "Ended up catching crayfish in the creek. That was fun too."] }],
]);
V("family_secret", { age: [20, 70], emoji: "🗝️", scene: "home" }, ["집안의 비밀", "家族の秘密", "A Family Secret"], ["오래된 서류 사이에서 몰랐던 가족 이야기를 발견했다.", "古い書類の間から知らなかった家族の話を見つけた。", "Among old papers, you discover a family story you never knew."], [
  ["ask", "🗣️", ["부모님께 조심스럽게 묻는다", "親にそっと聞く", "Gently ask your parents"], { grade: "good", effects: { intel: 2, social: 2, happy: 1 }, n: ["부모님이 오랫동안 미뤄 둔 이야기를 해 주셨다. 우리 가족이 조금 더 이해됐다.", "親が長く言えずにいた話をしてくれた。家族のことが少し分かった。", "My parents told me what they'd put off for years. I understood my family a little better."] }],
  ["keep", "🤐", ["모른 척 넣어 둔다", "知らないふりで戻す", "Put it back and say nothing"], { effects: { happy: -1 }, n: ["그 서류는 그 자리에 그대로 있었다.", "その書類はそのままの場所にあった。", "The papers stayed right where they were."] }],
]);
V("pet_as_family", { age: [25, 70], emoji: "🐶", scene: "home", hasPet: true }, ["가족사진 속 반려동물", "家族写真のペット", "The Pet in the Family Photo"], ["반려동물 생일이다. 케이크를 사야 할까.", "ペットの誕生日だ。ケーキを買うべきか。", "It's your pet's birthday. Should you get a cake?"], [
  ["party", "🎂", ["강아지(고양이)용 케이크를 산다", "ペット用ケーキを買う", "Buy a pet-safe cake"], { grade: "good", effects: { happy: 5, money: -10 }, n: ["고깔모자를 3초 쓰고 벗었다. 사진은 건졌다.", "とんがり帽子を三秒かぶって脱いだ。写真は撮れた。", "They wore the party hat for three seconds. Got the photo."] }],
  ["walk", "🦮", ["긴 산책을 선물한다", "長い散歩をプレゼントする", "Give them a long walk"], { grade: "good", effects: { happy: 4, health: 2 }, n: ["평소보다 두 배 멀리 걸었다. 그날 밤 둘 다 기절하듯 잤다.", "いつもの倍歩いた。その夜は二人とも気絶するように寝た。", "We walked twice as far as usual and both slept like rocks."] }],
]);
V("blended_family", { age: [30, 60], emoji: "🧩", scene: "home", married: true, cond: (p) => p.flags?.has?.("divorced") || p.flags?.has?.("widowed") }, ["새 가족 맞추기", "新しい家族", "A Blended Family"], ["재혼한 배우자의 아이가 아직 나를 어색해한다.", "再婚相手の子がまだ私によそよそしい。", "Your new spouse's child is still awkward around you."], [
  ["patient", "🐢", ["천천히 다가간다", "ゆっくり近づく", "Take it slow"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["3년째 되던 해, 아이가 처음으로 내게 고민을 털어놓았다.", "三年目のある日、子どもが初めて私に悩みを打ち明けた。", "In the third year, the child confided in me for the first time."] }],
  ["push", "🎁", ["선물로 마음을 산다", "プレゼントで気を引く", "Win them over with gifts"], { effects: { money: -100, happy: -1 }, n: ["선물은 받았지만 마음은 그대로였다.", "プレゼントは受け取ったが、心はそのままだった。", "The gifts were accepted. The distance wasn't."] }],
]);
V("couple_hobby", { age: [25, 75], emoji: "🎾", scene: "field", married: true }, ["부부 취미", "夫婦の趣味", "A Couple's Hobby"], ["{spouse}가 같이 테니스를 배우자고 한다.", "{spouse}が一緒にテニスを習おうと言う。", "{spouse} wants to take tennis lessons together."], [
  ["yes", "🎾", ["좋다고 한다", "いいよと言う", "Say yes"], { grade: "good", effects: { happy: 5, health: 3 }, n: ["복식 경기에서 처음 이긴 날 둘이 하이파이브를 했다.", "ダブルスで初めて勝った日、二人でハイタッチした。", "The day we won our first doubles match, we high-fived."] }],
  ["own", "📚", ["각자 취미가 좋다", "それぞれの趣味がいい", "Prefer separate hobbies"], { effects: { happy: 2, intel: 1 }, n: ["저녁에 서로의 하루를 이야기해 주는 재미가 있었다.", "夕方、互いの一日を話す楽しみがあった。", "Evenings were fun, trading stories of our separate days."] }],
]);
V("love_letter_old", { age: [60, 100], emoji: "💌", scene: "home", married: true }, ["오래된 연애편지", "古いラブレター", "An Old Love Letter"], ["이사 준비를 하다 연애 시절 편지 뭉치를 발견했다.", "引っ越し準備中に恋人時代の手紙の束を見つけた。", "Packing to move, you find a bundle of letters from your dating days."], [
  ["read", "📖", ["{spouse}와 소리 내어 읽는다", "{spouse}と声に出して読む", "Read them aloud with {spouse}"], { grade: "crit", effects: { happy: 8 }, n: ["맞춤법이 엉망이었다. 둘 다 눈물이 나도록 웃었다.", "誤字だらけだった。二人とも涙が出るほど笑った。", "The spelling was terrible. We laughed until we cried."] }],
  ["hide", "🙈", ["부끄러워 몰래 숨긴다", "恥ずかしくてこっそり隠す", "Hide them, embarrassed"], { effects: { happy: 3 }, n: ["며칠 뒤 {spouse}가 그걸 찾아 혼자 읽고 있었다.", "数日後、{spouse}がそれを見つけて一人で読んでいた。", "A few days later, {spouse} found them and was reading alone."] }],
]);
V("dating_app", { age: [20, 50], emoji: "📱", scene: "cafe", fromYear: 2012, cond: single }, ["소개팅 앱", "マッチングアプリ", "A Dating App"], ["친구가 소개팅 앱을 깔아 줬다.", "友達がマッチングアプリを入れてくれた。", "A friend installs a dating app on your phone."], [
  ["try", "👍", ["프로필을 정성껏 쓴다", "プロフィールを丁寧に書く", "Write a thoughtful profile"], { outcomes: [
    { chance: 0.35, grade: "good", effects: { happy: 6, social: 2 }, relation: { romance: true }, n: ["세 번째 만남에서 대화가 끝나지 않았다.", "三回目の出会いで会話が尽きなかった。", "On the third date, the conversation never ran out."] },
    { chance: 0.65, grade: "mid", effects: { happy: -1, internet: 2 }, n: ["대화는 많았는데 만남은 적었다.", "やりとりは多かったが、会うことは少なかった。", "Lots of chatting, few actual dates."] }] }],
  ["delete", "🗑️", ["바로 지운다", "すぐ消す", "Delete it immediately"], { effects: { happy: 1 }, n: ["운명은 서점에서 만나고 싶었다.", "運命の人には本屋で出会いたかった。", "I wanted to meet fate in a bookstore."] }],
]);
V("arranged_meeting", { age: [22, 35], emoji: "🍵", scene: "restaurant", era: ["early", "past"], cond: single }, ["중매", "お見合い", "An Arranged Meeting"], ["집안 어른들이 중매 자리를 마련했다.", "親戚がお見合いの席を用意した。", "Family elders have arranged a matchmaking meeting."], [
  ["go", "🙇", ["예의 바르게 나간다", "礼儀正しく出る", "Attend politely"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { happy: 5, social: 2 }, life: { marry: true }, n: ["차 한 잔을 마시는 동안 서로를 훔쳐봤다. 석 달 뒤 혼례를 올렸다.", "お茶一杯の間に互いをこっそり見た。三か月後に婚礼を挙げた。", "We stole glances over a cup of tea. Three months later, we were wed."] },
    { chance: 0.45, grade: "mid", effects: { happy: -1, social: 1 }, n: ["서로 예의만 차리다 끝났다.", "互いに礼儀を尽くすだけで終わった。", "We were politely formal, and that was that."] }] }],
  ["refuse", "🙅", ["내가 고르겠다고 버틴다", "自分で選ぶと言い張る", "Insist on choosing for yourself"], { effects: { happy: 2, social: -2 }, n: ["집안이 한동안 시끄러웠다.", "家の中がしばらく騒がしかった。", "The household was in an uproar for a while."] }],
]);
V("anniversary_25", { age: [45, 85], emoji: "🥈", scene: "restaurant", married: true, cond: (p) => p.age - (p.spouse?.since ?? p.age) >= 25 }, ["은혼식", "銀婚式", "Silver Anniversary"], ["{spouse}와 함께한 지 25년이다.", "{spouse}と共に二十五年。", "Twenty-five years with {spouse}."], [
  ["renew", "💍", ["다시 반지를 맞춘다", "指輪を作り直す", "Get new rings"], { grade: "crit", effects: { happy: 8, money: -100 }, n: ["안쪽에 날짜를 새겼다. 첫 반지보다 조금 컸다.", "内側に日付を刻んだ。最初の指輪より少し大きかった。", "We engraved the date inside. A size bigger than the first ones."] }],
  ["dinner", "🍽️", ["처음 데이트했던 곳에 간다", "初デートの場所へ行く", "Return to your first-date spot"], { grade: "good", effects: { happy: 6 }, n: ["가게는 바뀌었지만 창가 자리는 그대로였다.", "店は変わったが、窓際の席はそのままだった。", "The restaurant had changed, but the window seat was still there."] }],
]);
V("living_alone_choice", { age: [30, 70], emoji: "🏠", scene: "home", married: false, hasKid: false }, ["나 혼자 산다", "おひとりさま", "Living Solo"], ["혼자 사는 삶이 점점 편해진다. 친구는 걱정하지만.", "一人暮らしがどんどん楽になる。友達は心配するけれど。", "Living alone feels more and more comfortable. Your friends worry, though."], [
  ["own", "🌱", ["내 방식대로 산다", "自分のやり方で暮らす", "Live your own way"], { grade: "good", effects: { happy: 5, intel: 1 }, flag: { add: "single_life" }, n: ["주말 아침 빵 굽는 냄새가 집을 채웠다. 아무도 재촉하지 않았다.", "週末の朝、パンを焼く匂いが家を満たした。誰も急かさなかった。", "Weekend mornings, the smell of baking bread filled the house. No one rushed me."] }],
  ["community", "🤝", ["혼자지만 연결된 삶을 만든다", "一人でもつながる暮らしを作る", "Build a connected solo life"], { grade: "good", effects: { happy: 4, social: 4 }, n: ["동네 친구들과 반찬을 나누는 모임을 만들었다.", "近所の友とおかずを分け合う会を作った。", "I started a side-dish swap with neighborhood friends."] }],
]);
V("spouse_illness", { age: [50, 95], emoji: "🛏️", scene: "hospital", married: true }, ["배우자의 병", "配偶者の病気", "Your Spouse Falls Ill"], ["{spouse}가 큰 병 진단을 받았다.", "{spouse}が大きな病気の診断を受けた。", "{spouse} has been diagnosed with a serious illness."], [
  ["care", "🫶", ["곁을 지킨다", "そばにいる", "Stay by their side"], { grade: "good", effects: { happy: -3, health: -2, social: 2 }, n: ["병실 보조 침대에서 석 달을 잤다. {spouse}는 그 시간을 '두 번째 신혼'이라고 불렀다.", "病室の簡易ベッドで三か月寝た。{spouse}はそれを「二度目の新婚」と呼んだ。", "Three months on the hospital cot. {spouse} called it 'our second honeymoon.'"] }],
  ["plan", "📋", ["가족들과 돌봄 계획을 짠다", "家族とケア計画を立てる", "Make a care plan with family"], { grade: "good", effects: { happy: -2, social: 3, intel: 1 }, n: ["아이들이 번갈아 왔다. 집이 오랜만에 북적였다.", "子どもたちが交代で来た。家が久しぶりに賑やかになった。", "The kids took turns coming. The house was lively again."] }],
]);
V("kids_wedding_speech", { age: [50, 85], emoji: "🎤", scene: "wedding", hasKid: true, cond: (p) => p.kids.some(k => p.age - k.born >= 26) }, ["자녀 결혼식의 덕담", "子の結婚式の祝辞", "A Toast at Your Child's Wedding"], ["아이의 결혼식에서 한마디 해 달라고 한다.", "子の結婚式で一言頼まれた。", "You're asked to say a few words at your child's wedding."], [
  ["story", "🥹", ["아이가 어렸을 때 이야기를 한다", "子の幼い頃の話をする", "Tell a story from their childhood"], { grade: "crit", effects: { happy: 8, social: 2 }, n: ["첫걸음 이야기를 하다 목이 메었다. 하객들이 박수를 쳤다.", "初めての一歩の話で声が詰まった。招待客が拍手した。", "I choked up telling the story of their first steps. Everyone applauded."] }],
  ["short", "🙏", ["짧고 굵게", "短く力強く", "Keep it short and strong"], { grade: "good", effects: { happy: 6 }, n: ["'서로에게 다정하거라.' 그거면 충분했다.", "「互いに優しくな」それで十分だった。", "'Be kind to each other.' That was enough."] }],
]);
V("great_grandchild", { age: [75, 105], emoji: "🍼", scene: "home", cond: (p) => p.flags?.has?.("grandparent") }, ["증손주", "ひ孫", "A Great-Grandchild"], ["손주가 아기를 안고 찾아왔다. 4대가 한자리에 모였다.", "孫が赤ちゃんを抱いて訪ねてきた。四世代が一堂に会した。", "Your grandchild arrives holding a baby. Four generations in one room."], [
  ["hold", "🤲", ["아기를 안아 본다", "赤ちゃんを抱いてみる", "Hold the baby"], { grade: "crit", effects: { happy: 10 }, flag: { add: "great_grandparent" }, n: ["작은 몸이 생각보다 무거웠다. 4대가 함께 찍은 사진이 남았다.", "小さな体は思ったより重かった。四世代の写真が残った。", "Heavier than they looked. A four-generation photo remains."] }],
  ["song", "🎶", ["옛 자장가를 불러 준다", "昔の子守唄を歌う", "Sing an old lullaby"], { grade: "good", effects: { happy: 8, social: 2 }, flag: { add: "great_grandparent" }, n: ["내 어머니가 불러 주던 노래였다. 4대가 같은 노래를 들었다.", "母が歌ってくれた歌だった。四世代が同じ歌を聞いた。", "The song my own mother sang. Four generations heard the same lullaby."] }],
]);
V("teen_love_kid", { age: [40, 65], emoji: "💘", scene: "home", hasKid: true, cond: (p) => p.kids.some(k => { const a = p.age - k.born; return a >= 15 && a <= 19; }) }, ["아이의 첫 연애", "子の初恋", "Your Child's First Romance"], ["아이 휴대폰에 하트가 가득한 대화가 보였다.", "子の携帯にハートだらけの会話が見えた。", "You glimpse a message thread full of hearts on your kid's phone."], [
  ["cool", "😎", ["모르는 척 응원한다", "知らないふりで応援する", "Pretend not to notice and support quietly"], { grade: "good", effects: { happy: 3 }, n: ["몇 달 뒤 아이가 먼저 이야기를 꺼냈다.", "数か月後、子の方から話してくれた。", "Months later, they brought it up themselves."] }],
  ["talk", "🗣️", ["진지하게 이야기한다", "真剣に話す", "Have a serious talk"], { effects: { happy: -1, intel: 1 }, n: ["아이는 '알아서 할게'라고 했다. 그 말이 이상하게 든든했다.", "子は「自分でちゃんとやる」と言った。妙に頼もしかった。", "They said, 'I've got it.' Strangely reassuring."] }],
]);
V("move_for_love", { age: [22, 45], emoji: "🌍", scene: "airport", cond: dating }, ["사랑을 따라 이사", "愛を追って引っ越し", "Moving for Love"], ["연인이 다른 나라에서 일자리를 구했다. 같이 가자고 한다.", "恋人が外国で仕事を見つけた。一緒に来てほしいと言う。", "Your partner landed a job abroad and asks you to come."], [
  ["go", "✈️", ["모든 걸 두고 따라간다", "すべてを置いてついていく", "Leave everything and go"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 7, social: -2, intel: 2 }, flag: { add: ["abroad", "immigrant"] }, n: ["낯선 나라에서 둘이 기댈 건 서로뿐이었다. 그게 우리를 단단하게 했다.", "見知らぬ国で頼れるのは互いだけだった。それが二人を強くした。", "In a strange country, we only had each other. It made us strong."] },
    { chance: 0.4, grade: "bad", effects: { happy: -5, money: -500 }, relation: { breakup: true }, flag: { add: "abroad" }, n: ["외로움이 컸다. 1년 만에 혼자 돌아왔다.", "孤独が大きかった。一年で一人帰ってきた。", "The loneliness was crushing. I came back alone after a year."] }] }],
  ["stay", "🏠", ["남는다", "残る", "Stay"], { effects: { happy: -4 }, relation: { breakup: true }, n: ["공항에서 손을 흔들었다. 가끔 그 나라 뉴스를 찾아봤다.", "空港で手を振った。時々その国のニュースを探して見た。", "I waved at the airport. Sometimes I looked up news from that country."] }],
]);

export const LOVE_EVENTS = EV;
