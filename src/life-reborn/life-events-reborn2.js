// =========================
// 플듀 인생게임 REBORN — 새 사건 2차 (2026-11-22): 사랑·결혼 · 자녀(나이별) · 직장 · 어린 시절·10대 · 노년
// 형식: life-ev-kit.js 의 ev() (한국어 원문 + 일본어·영어 번역)
// =========================
import { ev, kidIn } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const L = (id, meta, title, desc, choices) => EV.push(ev("rb2_" + id, meta, title, desc, choices));

// ---------- 사랑 · 결혼 ----------
L("blind_date", { age: [24, 40], emoji: "☕", repeat: 4, weight: 1.6, married: false, relationRequired: { noRomance: true } }, ["소개팅", "紹介", "A Blind Date"], ["친구가 '진짜 괜찮은 사람'이라며 소개팅을 잡아 주었다.", "友人が「本当にいい人だから」と紹介をセッティングしてくれた。", "A friend sets you up with 'someone really great.'"], [
  ["go", "💐", ["나간다", "行く", "Go"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { happy: 7, social: 2 }, relation: { romance: true }, flag: { add: "dating" }, n: ["대화가 끊기지 않았다. 헤어지고 나서도 자꾸 휴대폰을 보았다.", "会話が途切れなかった。別れたあとも何度もスマホを見た。", "The conversation never stalled. Afterward you kept checking your phone."] },
    { chance: 0.6, grade: "mid", effects: { happy: -1, money: -10 }, n: ["좋은 사람이었지만 설렘은 없었다. 커피값은 반씩 냈다.", "いい人だったがときめきはなかった。コーヒー代は割り勘にした。", "A nice person, but no spark. You split the coffee bill."] }] }],
  ["no", "🙅", ["정중히 사양한다", "丁重に断る", "Politely decline"], { effects: { happy: 1 }, n: ["지금은 혼자가 편했다.", "今は一人が気楽だった。", "Being alone felt easier for now."] }],
]);
L("anniv", { age: [25, 85], emoji: "💍", repeat: 5, married: true }, ["결혼기념일", "結婚記念日", "Wedding Anniversary"], ["달력에 동그라미가 쳐져 있다. 오늘은 {spouse}와 결혼한 날이다.", "カレンダーに丸がついている。今日は{spouse}と結婚した日だ。", "There's a circle on the calendar. Today is your anniversary with {spouse}."], [
  ["dinner", "🍷", ["근사한 저녁을 예약한다", "素敵な夕食を予約する", "Book a nice dinner"], { grade: "good", effects: { happy: 6, money: -30 }, n: ["{spouse}가 처음 만난 날 이야기를 꺼냈다. 둘 다 웃었다.", "{spouse}が初めて会った日の話をした。二人とも笑った。", "{spouse} brought up the day you first met. You both laughed."] }],
  ["letter", "✉️", ["손편지를 쓴다", "手紙を書く", "Write a letter"], { grade: "good", effects: { happy: 5 }, n: ["편지를 읽던 {spouse}의 눈가가 붉어졌다.", "手紙を読む{spouse}の目が赤くなった。", "{spouse}'s eyes reddened as they read it."] }],
  ["forgot", "😅", ["깜빡 잊는다", "うっかり忘れる", "Forget it"], { grade: "bad", effects: { happy: -5 }, n: ["밤 11시에야 생각났다. 그날 밤은 길었다.", "夜11時になって思い出した。長い夜だった。", "You remembered at 11 p.m. It was a long night."] }],
]);
L("couple_fight", { age: [26, 75], emoji: "💢", repeat: 6, married: true }, ["부부싸움", "夫婦げんか", "A Marital Spat"], ["사소한 설거지 문제로 시작된 말다툼이 점점 커졌다.", "皿洗いのささいなことから始まった口論がだんだん大きくなった。", "An argument that began over the dishes keeps growing."], [
  ["sorry", "🤝", ["먼저 사과한다", "先に謝る", "Apologize first"], { grade: "good", effects: { happy: 3 }, n: ["'나도 미안해.' 둘이 같이 설거지를 했다.", "「私もごめん」。二人で一緒に皿を洗った。", "'I'm sorry too.' You did the dishes together."] }],
  ["win", "🗯️", ["끝까지 따진다", "最後まで言い張る", "Argue to the end"], { grade: "bad", effects: { happy: -6 }, n: ["이겼지만 집 안이 사흘 동안 조용했다.", "勝ったが、家の中は三日間静かだった。", "You won, but the house was silent for three days."] }],
  ["walk", "🚶", ["산책하며 머리를 식힌다", "散歩して頭を冷やす", "Take a walk to cool off"], { effects: { happy: 1, health: 1 }, n: ["돌아오니 식탁에 따뜻한 차가 놓여 있었다.", "戻ると食卓に温かいお茶が置いてあった。", "When you came back, there was warm tea on the table."] }],
]);
L("spouse_dream", { age: [30, 60], emoji: "🌠", weight: 0.8, married: true }, ["배우자의 꿈", "配偶者の夢", "Your Spouse's Dream"], ["{spouse}가 조심스럽게 말했다. '사실 나, 늦었지만 해 보고 싶은 게 있어.'", "{spouse}が遠慮がちに言った。「実は私、遅いけどやってみたいことがあるの」", "{spouse} says carefully, 'Actually, there's something I want to try, even if it's late.'"], [
  ["support", "💪", ["전적으로 밀어준다", "全面的に応援する", "Back them all the way"], { grade: "good", effects: { happy: 6, money: -600 }, n: ["{spouse}가 다시 학생이 됐다. 저녁은 내가 차렸다.", "{spouse}がまた学生になった。夕食は私が作った。", "{spouse} became a student again. You took over dinner."] }],
  ["talk", "🧮", ["현실적으로 같이 계획한다", "現実的に一緒に計画する", "Plan it out together"], { effects: { happy: 3, intel: 1 }, n: ["가계부를 펴 놓고 밤늦게까지 이야기했다.", "家計簿を広げて夜遅くまで話した。", "You opened the household budget and talked late into the night."] }],
  ["no", "✋", ["지금은 어렵다고 말한다", "今は難しいと言う", "Say now isn't the time"], { grade: "bad", effects: { happy: -4 }, n: ["{spouse}는 고개를 끄덕였지만 한동안 말이 적었다.", "{spouse}はうなずいたが、しばらく口数が少なかった。", "{spouse} nodded, but was quiet for a while."] }],
]);
L("in_laws", { age: [28, 60], emoji: "🏮", repeat: 4, married: true }, ["명절", "お正月", "The Holidays"], ["명절이다. 양가 어디를 먼저 갈지 정해야 한다.", "正月だ。どちらの実家に先に行くか決めなければ。", "It's the holidays. You have to decide whose family to visit first."], [
  ["both", "🚗", ["하루씩 나눠 간다", "一日ずつ分けて行く", "Split the days"], { grade: "good", effects: { happy: 2, money: -50, health: -1 }, n: ["고속도로에서 여섯 시간을 보냈다. 그래도 다들 반가워했다.", "高速道路で六時間過ごした。それでもみんな喜んでくれた。", "Six hours on the highway, but everyone was glad to see you."] }],
  ["trip", "🧳", ["이번엔 둘이 여행 간다", "今回は二人で旅行する", "Take a trip, just you two"], { effects: { happy: 5, money: -200, social: -2 }, n: ["전화로 인사를 드렸다. 조금 미안했지만 오랜만에 쉬었다.", "電話で挨拶した。少し申し訳なかったが久しぶりに休めた。", "You called to say hello. A little guilty, but finally rested."] }],
]);
L("grow_old_together", { age: [65, 92], emoji: "🌇", weight: 1.2, married: true }, ["둘이서 산책", "二人で散歩", "A Walk for Two"], ["저녁마다 {spouse}와 동네를 한 바퀴 돈다. 오늘은 노을이 유난히 붉다.", "毎晩{spouse}と町をひと回りする。今日は夕焼けがひときわ赤い。", "Every evening you circle the neighborhood with {spouse}. Tonight the sunset is especially red."], [
  ["hand", "🤲", ["손을 잡는다", "手をつなぐ", "Hold hands"], { grade: "good", effects: { happy: 6, health: 1 }, n: ["주름진 손이 따뜻했다. 오십 년 전과 같은 온도였다.", "しわだらけの手が温かかった。五十年前と同じ温度だった。", "The wrinkled hand was warm — the same warmth as fifty years ago."] }],
  ["talk", "💬", ["옛날 이야기를 한다", "昔話をする", "Talk about the old days"], { grade: "good", effects: { happy: 5 }, n: ["같은 이야기를 백 번째 했지만, 백 번째도 웃겼다.", "同じ話を百回目にしたが、百回目も笑えた。", "The same story for the hundredth time — still funny."] }],
]);
L("single_life", { age: [38, 70], emoji: "🏡", weight: 0.9, married: false }, ["혼자의 저녁", "一人の夜", "An Evening Alone"], ["주말 저녁, 혼자 사는 집이 조용하다.", "週末の夜、一人暮らしの家は静かだ。", "A weekend evening; your one-person home is quiet."], [
  ["cook", "🍲", ["나를 위해 요리한다", "自分のために料理する", "Cook for yourself"], { grade: "good", effects: { happy: 4, health: 2 }, n: ["좋아하는 음악을 틀고 천천히 먹었다. 꽤 괜찮은 저녁이었다.", "好きな音楽をかけてゆっくり食べた。なかなかいい夜だった。", "You put on your favorite music and ate slowly. A pretty good evening."] }],
  ["club", "🎲", ["동호회 모임에 나간다", "サークルの集まりに出る", "Go to a club meetup"], { effects: { happy: 4, social: 4, money: -30 }, n: ["새 얼굴이 여럿 있었다. 단체 대화방이 하나 늘었다.", "新しい顔が何人もいた。グループチャットが一つ増えた。", "Plenty of new faces. One more group chat on your phone."] }],
  ["lonely", "🌧️", ["조금 외로워한다", "少しさみしく思う", "Feel a little lonely"], { effects: { happy: -3 }, n: ["창밖 불빛들을 오래 보았다. 그래도 내일은 또 올 것이다.", "窓の外の明かりを長く眺めた。それでも明日はまた来る。", "You watched the city lights for a long time. Tomorrow will come anyway."] }],
]);

L("meet", { age: [20, 42], emoji: "🌸", repeat: 2, weight: 3.2, married: false, relationRequired: { noRomance: true }, flagBanned: ["no_marriage"] }, ["뜻밖의 만남", "思いがけない出会い", "An Unexpected Meeting"], ["비 오는 날 같은 우산 밑에 서게 된 사람과 이야기가 이어졌다.", "雨の日、同じ傘の下に立った人と話が弾んだ。", "On a rainy day you end up under the same umbrella as someone, and the conversation keeps going."], [
  ["number", "📱", ["연락처를 묻는다", "連絡先を聞く", "Ask for their number"], { grade: "good", outcomes: [
    { chance: 0.65, grade: "good", effects: { happy: 8, social: 2 }, relation: { romance: true }, flag: { add: "dating" }, n: ["다음 주말, 둘은 다시 만났다. 그다음 주말도.", "次の週末、二人はまた会った。その次の週末も。", "You met again the next weekend. And the one after that."] },
    { chance: 0.35, grade: "mid", effects: { happy: -2 }, n: ["답장은 오지 않았다. 우산만 돌려받았다.", "返事は来なかった。傘だけが返ってきた。", "No reply came. Only the umbrella was returned."] }] }],
  ["let", "🌂", ["좋은 추억으로 둔다", "いい思い出にしておく", "Leave it as a nice memory"], { effects: { happy: 1 }, n: ["비가 그치자 각자의 길로 걸어갔다.", "雨がやむと、それぞれの道へ歩いていった。", "When the rain stopped, you each walked your own way."] }],
]);
L("baby_talk", { age: [26, 42], emoji: "🍼", repeat: 3, weight: 2.6, married: true, hasKid: false, flagBanned: ["no_kids", "infertility"] }, ["아이 이야기", "子どもの話", "Talking About Kids"], ["{spouse}가 조카 사진을 보다가 물었다. '우리도… 아이 생각해 볼까?'", "{spouse}が姪の写真を見ながら聞いた。「私たちも…子どものこと考えてみる?」", "Looking at a photo of your niece, {spouse} asks, 'Should we… think about kids too?'"], [
  ["yes", "👶", ["그러자고 한다", "そうしようと言う", "Say yes"], { grade: "good", outcomes: [
    { chance: 0.7, grade: "crit", effects: { happy: 12, money: -400, health: -1 }, life: { child: 1, bond: 5 }, n: ["열 달 뒤, {kid}가 태어났다. 작은 울음소리에 둘 다 울었다.", "十か月後、{kid}が生まれた。小さな産声に二人とも泣いた。", "Ten months later {kid} was born. At that tiny cry, you both wept."] },
    { chance: 0.3, grade: "mid", effects: { happy: -3 }, n: ["쉽게 찾아오지 않았다. 서두르지 않기로 했다.", "なかなか授からなかった。焦らないことにした。", "It didn't come easily. You decided not to rush."] }] }],
  ["later", "⏳", ["조금 더 둘이 지내자고 한다", "もう少し二人で過ごそうと言う", "Suggest more time as two"], { effects: { happy: 2, money: 200 }, n: ["둘만의 여행을 한 번 더 다녀왔다.", "二人だけの旅行にもう一度行った。", "You took one more trip, just the two of you."] }],
  ["no", "🌿", ["아이 없이 살자고 한다", "子どもなしで生きようと言う", "Choose a life without kids"], { effects: { happy: 3 }, flag: { add: "no_kids" }, n: ["둘이서도 충분히 가족이라고, 서로 고개를 끄덕였다.", "二人でも十分家族だと、互いにうなずいた。", "You agreed that two is a family too."] }],
]);

// ---------- 자녀 (나이별) ----------
L("kid_first_word", { age: [20, 60], emoji: "🍼", hasKid: true, cond: kidIn(1, 2) }, ["첫 말", "初めての言葉", "First Words"], ["{kid}가 입을 오물거린다. 곧 무언가 말할 것 같다.", "{kid}が口をもぐもぐさせている。もうすぐ何か言いそうだ。", "{kid} is moving their mouth. Any moment now, a word."], [
  ["wait", "📹", ["카메라를 켜고 기다린다", "カメラを回して待つ", "Start filming and wait"], { grade: "good", effects: { happy: 8 }, n: ["'엄마… 아빠?' 영상은 가족 단체방에서 백 번 재생되었다.", "「ママ…パパ?」動画は家族のグループで百回再生された。", "'Mama… Dada?' The video was replayed a hundred times in the family chat."] }],
  ["teach", "🗣️", ["내 이름부터 가르친다", "自分の呼び名から教える", "Teach them your name first"], { effects: { happy: 6 }, n: ["첫 말은 '멍멍'이었다. 다들 웃었다.", "最初の言葉は「わんわん」だった。みんな笑った。", "The first word was 'woof.' Everyone laughed."] }],
]);
L("kid_night", { age: [20, 60], emoji: "🌙", hasKid: true, cond: kidIn(0, 1) }, ["밤샘 육아", "夜通しの育児", "Sleepless Nights"], ["새벽 3시, {kid}가 또 운다. 오늘만 네 번째다.", "午前3時、{kid}がまた泣く。今日だけで四回目だ。", "3 a.m. {kid} is crying again — the fourth time tonight."], [
  ["me", "🫂", ["내가 일어난다", "私が起きる", "Get up yourself"], { effects: { happy: 2, health: -2 }, n: ["작은 몸을 안고 거실을 서성였다. 해가 뜰 무렵 잠이 들었다.", "小さな体を抱いてリビングを歩き回った。夜が明ける頃に眠った。", "You paced the living room with the tiny body. It fell asleep around sunrise."] }],
  ["turns", "🔁", ["번갈아 보기로 정한다", "交代で見ることにする", "Agree to take turns"], { grade: "good", effects: { happy: 3, health: -1 }, n: ["당번표를 냉장고에 붙였다. 조금 숨통이 트였다.", "当番表を冷蔵庫に貼った。少し楽になった。", "You stuck a schedule on the fridge. It helped a little."] }],
]);
L("kid_school_first", { age: [24, 65], emoji: "🎒", hasKid: true, cond: kidIn(6, 7) }, ["입학식", "入学式", "The First Day of School"], ["{kid}가 큰 가방을 메고 교문 앞에 섰다.", "{kid}が大きなランドセルを背負って校門の前に立った。", "{kid} stands at the school gate with an enormous backpack."], [
  ["photo", "📸", ["사진을 백 장 찍는다", "写真を百枚撮る", "Take a hundred photos"], { grade: "good", effects: { happy: 6 }, n: ["뒤돌아 손을 흔드는 모습이 오래 남았다.", "振り返って手を振る姿がいつまでも残った。", "The way they turned and waved stayed with you."] }],
  ["work", "💼", ["일 때문에 못 간다", "仕事で行けない", "Miss it for work"], { grade: "bad", effects: { happy: -4, money: 30 }, n: ["점심시간에 받은 사진을 몇 번이고 확대해 보았다.", "昼休みに届いた写真を何度も拡大して見た。", "At lunch you zoomed in on the photo again and again."] }],
]);
L("kid_hobby", { age: [26, 70], emoji: "🎻", hasKid: true, cond: kidIn(8, 12) }, ["아이의 학원", "子どもの習い事", "The Kids' Classes"], ["{kid}가 학원을 하나 더 다니고 싶다고 한다. 이미 세 군데다.", "{kid}がもう一つ習い事をしたいと言う。もう三つ通っている。", "{kid} wants one more after-school class. They already have three."], [
  ["yes", "✅", ["보내 준다", "通わせる", "Sign them up"], { effects: { money: -300, happy: 2 }, n: ["{kid}의 하루가 더 바빠졌다. 그래도 눈이 반짝였다.", "{kid}の一日がさらに忙しくなった。それでも目が輝いていた。", "{kid}'s days got busier, but their eyes sparkled."] }],
  ["play", "🛝", ["대신 놀 시간을 준다", "代わりに遊ぶ時間をあげる", "Give them playtime instead"], { grade: "good", effects: { happy: 4 }, n: ["놀이터에서 해 질 때까지 놀았다. 둘 다 흙투성이였다.", "暗くなるまで公園で遊んだ。二人とも泥だらけだった。", "You played at the playground until dark. Both of you were covered in dirt."] }],
  ["talk", "💬", ["왜 하고 싶은지 묻는다", "なぜやりたいのか聞く", "Ask why they want it"], { grade: "good", effects: { happy: 3, intel: 1 }, n: ["'친구가 거기 다녀서.' 솔직한 대답에 웃음이 났다.", "「友達が通ってるから」。正直な答えに笑ってしまった。", "'Because my friend goes there.' The honesty made you laugh."] }],
]);
L("kid_teen_door", { age: [30, 75], emoji: "🚪", hasKid: true, cond: kidIn(13, 17) }, ["닫힌 방문", "閉ざされたドア", "The Closed Door"], ["{kid}의 방문이 요즘 늘 닫혀 있다. 대답도 짧아졌다.", "{kid}の部屋のドアが最近いつも閉まっている。返事も短くなった。", "{kid}'s door is always closed lately, and the answers have gotten short."], [
  ["knock", "🍕", ["좋아하는 음식을 들고 노크한다", "好物を持ってノックする", "Knock with their favorite food"], { grade: "good", outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 6 }, n: ["문이 열렸다. 피자를 먹으며 한 시간을 이야기했다.", "ドアが開いた。ピザを食べながら一時間話した。", "The door opened. You talked for an hour over pizza."] },
    { chance: 0.4, grade: "mid", effects: { happy: -1 }, n: ["'나중에.' 음식만 들어갔다. 그래도 접시는 비어서 나왔다.", "「あとで」。食べ物だけ中に入った。それでも皿は空で戻ってきた。", "'Later.' Only the food went in — but the plate came back empty."] }] }],
  ["wait", "⏳", ["그냥 기다려 준다", "ただ待ってあげる", "Just give them time"], { effects: { happy: 1 }, n: ["며칠 뒤, {kid}가 먼저 고민을 털어놓았다.", "数日後、{kid}が自分から悩みを打ち明けた。", "A few days later, {kid} opened up on their own."] }],
  ["force", "📵", ["휴대폰을 압수한다", "スマホを取り上げる", "Confiscate the phone"], { grade: "bad", effects: { happy: -5 }, n: ["방문이 더 세게 닫혔다.", "ドアがもっと強く閉められた。", "The door slammed harder."] }],
]);
L("kid_exam", { age: [34, 80], emoji: "📝", hasKid: true, cond: kidIn(17, 19) }, ["아이의 입시", "子どもの受験", "Your Child's Exams"], ["{kid}의 시험이 내일이다. 집 안 공기가 무겁다.", "{kid}の試験は明日だ。家の中の空気が重い。", "{kid}'s big exam is tomorrow. The house feels heavy."], [
  ["cheer", "🍱", ["도시락을 싸 준다", "お弁当を作る", "Pack them a lunch"], { grade: "good", effects: { happy: 4 }, n: ["도시락 뚜껑 안에 쪽지를 붙였다. '결과보다 네가 더 소중해.'", "弁当のふたの裏にメモを貼った。「結果より、あなたのほうが大切」", "You taped a note inside the lid: 'You matter more than any result.'"] }],
  ["pray", "🙏", ["밤새 잠을 못 잔다", "一晩中眠れない", "Lie awake all night"], { effects: { health: -2, happy: -1 }, n: ["{kid}보다 내가 더 떨렸다.", "{kid}より私のほうが緊張していた。", "You were more nervous than {kid}."] }],
]);
L("kid_leave", { age: [40, 85], emoji: "🧳", hasKid: true, cond: kidIn(19, 26) }, ["독립", "独り立ち", "Leaving the Nest"], ["{kid}가 독립하겠다고 한다. 짐 상자가 거실에 쌓였다.", "{kid}が独り立ちすると言う。荷物の箱がリビングに積まれた。", "{kid} is moving out. Boxes pile up in the living room."], [
  ["help", "🚚", ["이삿짐을 같이 나른다", "引っ越しを手伝う", "Help them move"], { grade: "good", effects: { happy: 4, health: -1, money: -100 }, n: ["새 집 냉장고를 반찬으로 가득 채워 주고 왔다.", "新しい家の冷蔵庫をおかずでいっぱいにしてきた。", "You filled their new fridge with side dishes before you left."] }],
  ["miss", "🥲", ["빈 방에 한참 앉아 있는다", "空いた部屋にしばらく座る", "Sit in the empty room"], { effects: { happy: -2 }, n: ["벽에 키를 잰 연필 자국이 그대로 있었다.", "壁に身長を測った鉛筆の跡がそのまま残っていた。", "The pencil marks of their height were still on the wall."] }],
]);
L("kid_wedding", { age: [48, 90], emoji: "💒", hasKid: true, cond: kidIn(26, 40), weight: 0.8 }, ["아이의 결혼식", "子どもの結婚式", "Your Child's Wedding"], ["{kid}가 결혼한다. 혼주석에 앉게 되었다.", "{kid}が結婚する。親族席に座ることになった。", "{kid} is getting married. You'll sit in the parents' seats."], [
  ["speech", "🎤", ["축사를 한다", "スピーチをする", "Give a speech"], { grade: "good", effects: { happy: 9, social: 2 }, n: ["세 줄째에서 목이 메었다. 하객들이 박수로 기다려 주었다.", "三行目で声が詰まった。招待客が拍手で待ってくれた。", "Your voice cracked on the third line. The guests clapped and waited."] }],
  ["quiet", "😌", ["조용히 지켜본다", "静かに見守る", "Watch quietly"], { grade: "good", effects: { happy: 7 }, n: ["버진로드를 걷는 뒷모습이 어릴 적 그 아이와 겹쳐 보였다.", "バージンロードを歩く後ろ姿が、幼い頃のあの子と重なって見えた。", "Walking down the aisle, they looked just like the little child they once were."] }],
]);
L("grandkid", { age: [55, 95], emoji: "👶", hasKid: true, cond: (p) => kidIn(28, 60)(p) && !p.flags.has("rb2_grand"), weight: 1.1 }, ["손주", "孫", "A Grandchild"], ["{kid}에게서 전화가 왔다. '나 아기 생겼어.'", "{kid}から電話が来た。「赤ちゃんができたの」", "{kid} calls: 'We're having a baby.'"], [
  ["joy", "🎉", ["바로 달려간다", "すぐに駆けつける", "Rush over"], { grade: "crit", effects: { happy: 10 }, flag: { add: "rb2_grand" }, n: ["작은 손가락이 내 손가락을 꽉 쥐었다. 세상이 다시 처음 같았다.", "小さな指が私の指をぎゅっと握った。世界がまた初めてのように見えた。", "A tiny hand gripped your finger. The world felt brand new again."] }],
  ["help", "🧺", ["육아를 돕겠다고 한다", "育児を手伝うと言う", "Offer to help raise them"], { grade: "good", effects: { happy: 7, health: -2 }, flag: { add: "rb2_grand" }, n: ["평일엔 손주를 맡았다. 허리는 아팠지만 웃을 일이 많았다.", "平日は孫を預かった。腰は痛かったが笑うことが多かった。", "You watched the grandchild on weekdays. Your back ached, but you laughed a lot."] }],
]);

// ---------- 직장 ----------
L("overtime", { age: [24, 58], emoji: "🌃", repeat: 4, cond: (p) => !!p.job }, ["야근", "残業", "Working Late"], ["퇴근 10분 전, 상사가 '이것만 오늘 끝내자'며 서류를 내밀었다.", "退勤10分前、上司が「これだけ今日終わらせよう」と書類を差し出した。", "Ten minutes before quitting time, your boss hands you a file: 'Just finish this today.'"], [
  ["stay", "💻", ["남아서 끝낸다", "残って終わらせる", "Stay and finish"], { effects: { money: 30, health: -2, happy: -2 }, n: ["마지막 지하철을 탔다. 창에 비친 얼굴이 피곤해 보였다.", "終電に乗った。窓に映る顔が疲れて見えた。", "You caught the last train. The face in the window looked tired."] }],
  ["no", "🙋", ["내일 하겠다고 말한다", "明日やると言う", "Say you'll do it tomorrow"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 4 }, n: ["의외로 '그래요'라는 대답이 돌아왔다.", "意外にも「いいですよ」と返ってきた。", "Surprisingly, the answer was 'Sure.'"] },
    { chance: 0.4, grade: "bad", effects: { happy: -2, social: -2 }, n: ["다음 날 회의 분위기가 묘하게 차가웠다.", "翌日の会議の雰囲気が妙に冷たかった。", "The next day's meeting felt strangely chilly."] }] }],
]);
L("promotion_offer", { age: [30, 55], emoji: "📈", weight: 0.8, cond: (p) => !!p.job }, ["팀장 제안", "チームリーダーの打診", "A Team Lead Offer"], ["팀을 맡아 달라는 제안이 왔다. 월급은 오르지만 책임도 커진다.", "チームを任せたいという打診が来た。給料は上がるが責任も重くなる。", "You're asked to lead a team. More pay, more responsibility."], [
  ["yes", "🧭", ["맡는다", "引き受ける", "Accept"], { grade: "good", effects: { money: 400, happy: 3, health: -2, social: 2 }, flag: { add: "rb2_lead" }, n: ["첫 팀 회의에서 손이 떨렸다. 그래도 끝까지 해냈다.", "初めてのチーム会議で手が震えた。それでも最後までやり遂げた。", "Your hands shook in your first team meeting, but you got through it."] }],
  ["no", "🧘", ["지금 일에 만족한다", "今の仕事に満足している", "You're happy where you are"], { effects: { happy: 2 }, n: ["욕심을 내려놓으니 저녁이 길어졌다.", "欲を手放すと夜が長くなった。", "Letting go of ambition gave you longer evenings."] }],
]);
L("burnout", { age: [27, 58], emoji: "🔥", repeat: 8, cond: (p) => !!p.job && p.stats.happy < 45 }, ["번아웃", "燃え尽き", "Burnout"], ["아침에 눈을 떴는데 몸이 움직이지 않는다. 출근 생각만 해도 숨이 막힌다.", "朝目が覚めても体が動かない。出勤を考えるだけで息が詰まる。", "You wake up and can't move. Just thinking about work makes it hard to breathe."], [
  ["leave", "🏖️", ["휴직한다", "休職する", "Take a leave of absence"], { grade: "good", effects: { happy: 7, health: 4, money: -800 }, n: ["석 달을 쉬었다. 하늘을 오래 보는 법을 다시 배웠다.", "三か月休んだ。空を長く見上げることを思い出した。", "You took three months off and relearned how to stare at the sky."] }],
  ["counsel", "🗨️", ["상담을 받는다", "カウンセリングを受ける", "See a counselor"], { grade: "good", effects: { happy: 4, money: -100 }, n: ["'잘하고 싶은 마음이 너무 컸네요.' 그 말에 울컥했다.", "「頑張りたい気持ちが大きすぎたんですね」。その言葉に胸が詰まった。", "'You wanted to do well so badly.' Those words hit hard."] }],
  ["push", "🪫", ["그냥 버틴다", "そのまま耐える", "Push through"], { grade: "bad", effects: { health: -6, happy: -3 }, n: ["버텼다. 대신 주말 내내 잠만 잤다.", "耐えた。その代わり週末はずっと寝ていた。", "You endured — and slept through every weekend."] }],
]);
L("coworker_friend", { age: [23, 60], emoji: "🍜", repeat: 10, cond: (p) => !!p.job }, ["점심 친구", "昼ごはん仲間", "A Lunch Buddy"], ["옆자리 신입이 혼자 점심을 먹는 걸 봤다.", "隣の席の新人が一人で昼食をとっているのを見た。", "You notice the new hire next to you eating lunch alone."], [
  ["invite", "🍱", ["같이 먹자고 한다", "一緒に食べようと誘う", "Invite them along"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["그 뒤로 매일 같이 먹었다. 회사에 갈 이유가 하나 늘었다.", "それから毎日一緒に食べた。会社に行く理由が一つ増えた。", "You ate together every day after that — one more reason to go to work."] }],
  ["leave", "🙂", ["그냥 둔다", "そっとしておく", "Leave them be"], { effects: {}, n: ["혼자가 편한 사람도 있으니까.", "一人が楽な人もいるから。", "Some people like being alone."] }],
]);
L("layoff", { age: [35, 60], emoji: "📉", weight: 0.5, cond: (p) => !!p.job }, ["구조조정 소문", "リストラのうわさ", "Layoff Rumors"], ["회사에 구조조정 소문이 돈다. 명단이 있다는 말도 들린다.", "会社にリストラのうわさが流れている。名簿があるという話も聞こえる。", "Rumors of layoffs spread. Some say there's already a list."], [
  ["prepare", "📋", ["이직 준비를 시작한다", "転職準備を始める", "Start job hunting"], { grade: "good", effects: { intel: 2, happy: -1 }, n: ["이력서를 다시 썼다. 생각보다 해 온 일이 많았다.", "履歴書を書き直した。思ったよりたくさんの仕事をしてきた。", "You rewrote your résumé. You'd done more than you thought."] }],
  ["work", "💼", ["더 열심히 일한다", "もっと頑張って働く", "Work even harder"], { effects: { health: -2, money: 50 }, n: ["매일 가장 먼저 출근했다. 소문은 몇 달 뒤 잦아들었다.", "毎日一番に出勤した。うわさは数か月後に静まった。", "You were first in every morning. The rumors faded months later."] }],
]);
L("side_hustle", { age: [25, 55], emoji: "🛍️", weight: 0.8 }, ["부업", "副業", "A Side Hustle"], ["주말에 할 수 있는 부업 이야기를 들었다. 한 달에 몇십만 원은 된다고 한다.", "週末にできる副業の話を聞いた。月に数万円にはなるらしい。", "You hear about a weekend side gig — a few hundred extra a month."], [
  ["do", "💰", ["해 본다", "やってみる", "Try it"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 600, happy: 2, health: -1 }, n: ["주말이 사라졌지만 통장이 조금 두꺼워졌다.", "週末はなくなったが、口座は少し厚くなった。", "The weekends vanished, but the bank account grew a little."] },
    { chance: 0.4, grade: "bad", effects: { money: -200, happy: -3 }, n: ["재료비만 날렸다. 쉬운 돈은 없었다.", "材料費だけが消えた。楽なお金などなかった。", "You lost the cost of supplies. There's no easy money."] }] }],
  ["rest", "🛋️", ["주말은 쉬는 날이다", "週末は休む日だ", "Weekends are for rest"], { effects: { happy: 2, health: 1 }, n: ["쉬는 것도 일이라고 생각했다.", "休むのも仕事だと思った。", "Rest is work too, you decided."] }],
]);
L("mentor_junior", { age: [40, 65], emoji: "🧑‍🏫", repeat: 10, cond: (p) => !!p.job }, ["후배의 고민", "後輩の悩み", "A Junior's Worries"], ["후배가 퇴근길에 따라 나와 고민을 털어놓았다. '이 일이 저한테 맞는지 모르겠어요.'", "後輩が帰り道についてきて悩みを打ち明けた。「この仕事が自分に合っているかわかりません」", "A junior follows you out after work: 'I don't know if this job is right for me.'"], [
  ["listen", "👂", ["끝까지 들어 준다", "最後まで話を聞く", "Hear them out"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["나도 그 나이에 똑같은 고민을 했다고 말해 주었다.", "私もその年頃に同じことで悩んだと話した。", "You told them you'd worried about the same thing at their age."] }],
  ["advice", "📌", ["현실적인 조언을 한다", "現実的な助言をする", "Give practical advice"], { effects: { intel: 1, social: 2 }, n: ["몇 년 뒤, 그 후배가 고맙다는 메시지를 보냈다.", "数年後、その後輩からお礼のメッセージが届いた。", "Years later, that junior sent a thank-you message."] }],
]);
L("retire_party", { age: [58, 70], emoji: "🎊", weight: 1.3, cond: (p) => !!p.job && !p.flags.has("rb2_retparty") }, ["마지막 출근", "最後の出勤", "The Last Day at Work"], ["내일부터는 출근하지 않는다. 책상 위 짐이 생각보다 적다.", "明日からはもう出勤しない。机の上の荷物は思ったより少ない。", "Starting tomorrow, no more commute. Your desk holds less than you expected."], [
  ["speech", "🎤", ["작별 인사를 한다", "別れの挨拶をする", "Say goodbye"], { grade: "good", effects: { happy: 6, social: 2 }, flag: { add: "rb2_retparty" }, n: ["'수고 많으셨습니다.' 꽃다발이 무거웠다.", "「お疲れさまでした」。花束が重かった。", "'Thank you for everything.' The bouquet felt heavy in your arms."] }],
  ["quiet", "🚪", ["조용히 나온다", "静かに出ていく", "Slip out quietly"], { effects: { happy: 2 }, flag: { add: "rb2_retparty" }, n: ["엘리베이터 문이 닫히는 순간, 수십 년이 지나갔다.", "エレベーターの扉が閉まる瞬間、何十年が過ぎていった。", "As the elevator doors closed, decades flashed by."] }],
]);

// ---------- 어린 시절 · 10대 ----------
L("lost_tooth", { age: [6, 8], emoji: "🦷", weight: 1.2 }, ["흔들리는 이", "ぐらぐらの歯", "A Wobbly Tooth"], ["앞니가 흔들린다. 실로 묶어서 뺄까?", "前歯がぐらぐらしている。糸で結んで抜こうか?", "Your front tooth is loose. Tie it with string and pull?"], [
  ["pull", "🧵", ["눈을 꼭 감고 뺀다", "目をぎゅっとつぶって抜く", "Shut your eyes and pull"], { grade: "good", effects: { happy: 3, power: 1 }, n: ["뽑힌 이를 지붕 위로 던졌다. 까치가 새 이를 줄 거라고 했다.", "抜けた歯を屋根に投げた。新しい歯が生えてくるおまじないだ。", "You tossed the tooth onto the roof for good luck with the new one."] }],
  ["wait", "😬", ["무서워서 둔다", "怖くてそのままにする", "Too scared — leave it"], { effects: { happy: -1 }, n: ["며칠 뒤 사과를 먹다가 저절로 빠졌다.", "数日後、りんごを食べていたら自然に抜けた。", "A few days later it came out on its own in an apple."] }],
]);
L("bike", { age: [6, 10], emoji: "🚲", weight: 1 }, ["두발자전거", "補助輪なしの自転車", "A Two-Wheeler"], ["보조 바퀴를 떼었다. 뒤에서 잡아 준다는 말을 믿어도 될까.", "補助輪を外した。後ろで支えてくれるという言葉を信じていいのか。", "The training wheels are off. Can you trust them to hold on from behind?"], [
  ["go", "💨", ["페달을 밟는다", "ペダルを踏む", "Pedal"], { grade: "good", effects: { happy: 5, power: 2 }, n: ["뒤를 보니 아무도 없었다. 혼자 달리고 있었다.", "振り向くと誰もいなかった。一人で走っていた。", "You looked back — no one was holding on. You were riding alone."] }],
  ["fall", "🩹", ["넘어질까 봐 겁낸다", "転ぶのが怖い", "Worry about falling"], { effects: { happy: -1, health: -1 }, n: ["무릎이 까졌다. 다음 주에 다시 도전했다.", "ひざをすりむいた。翌週また挑戦した。", "You scraped your knee — and tried again the next week."] }],
]);
L("best_friend_move", { age: [8, 14], emoji: "👋", weight: 0.8 }, ["단짝의 전학", "親友の転校", "Your Best Friend Moves Away"], ["단짝이 다음 달에 먼 도시로 전학을 간다고 했다.", "親友が来月遠い町へ転校すると言った。", "Your best friend says they're moving to a faraway city next month."], [
  ["letter", "✉️", ["편지를 주고받자고 한다", "手紙を書き合おうと約束する", "Promise to write letters"], { grade: "good", effects: { happy: 2, social: 2 }, n: ["편지는 1년 동안 이어졌다. 마지막 편지는 아직 상자에 있다.", "手紙は一年続いた。最後の手紙はまだ箱の中にある。", "The letters kept coming for a year. The last one is still in a box."] }],
  ["cry", "😢", ["펑펑 운다", "わんわん泣く", "Cry your heart out"], { effects: { happy: -4 }, n: ["그날 밤 이불을 머리끝까지 덮었다.", "その夜、布団を頭までかぶった。", "That night you pulled the blanket over your head."] }],
]);
L("class_president", { age: [10, 17], emoji: "🏫", weight: 0.9 }, ["반장 선거", "学級委員選挙", "Class President Election"], ["친구들이 반장 선거에 나가 보라고 부추긴다.", "友達が学級委員選挙に出ろとけしかける。", "Your friends are pushing you to run for class president."], [
  ["run", "📣", ["나간다", "出る", "Run"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 6, social: 4 }, flag: { add: "rb2_leader" }, n: ["두 표 차로 당선되었다. 첫 공약은 급식 순서 바꾸기였다.", "二票差で当選した。最初の公約は給食の順番を変えることだった。", "You won by two votes. Your first promise: change the lunch line order."] },
    { chance: 0.5, grade: "mid", effects: { happy: -2, social: 2 }, n: ["떨어졌지만, 연설은 다들 기억해 주었다.", "落選したが、演説はみんな覚えていてくれた。", "You lost, but everyone remembered your speech."] }] }],
  ["no", "🙈", ["사양한다", "辞退する", "Pass"], { effects: {}, n: ["다른 친구를 열심히 응원했다.", "別の友達を一生懸命応援した。", "You cheered hard for another friend."] }],
]);
L("first_crush", { age: [12, 17], emoji: "💌", weight: 1 }, ["첫사랑", "初恋", "First Love"], ["같은 반 아이와 눈이 마주칠 때마다 얼굴이 뜨거워진다.", "同じクラスの子と目が合うたびに顔が熱くなる。", "Every time you lock eyes with a classmate, your face burns."], [
  ["confess", "💗", ["고백한다", "告白する", "Confess"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { happy: 9 }, n: ["'나도.' 그 한 단어로 일 년이 반짝였다.", "「私も」。その一言で一年が輝いた。", "'Me too.' Those two words lit up the whole year."] },
    { chance: 0.6, grade: "bad", effects: { happy: -5 }, n: ["'우리 그냥 친구 하자.' 그래도 말해서 후련했다.", "「友達でいよう」。それでも言えてすっきりした。", "'Let's just be friends.' At least you said it."] }] }],
  ["secret", "🤫", ["마음속에만 둔다", "心の中にしまう", "Keep it secret"], { effects: { happy: 1 }, n: ["졸업 앨범의 그 얼굴을 지금도 기억한다.", "卒業アルバムのあの顔を今も覚えている。", "You still remember that face from the yearbook."] }],
]);
L("game_night", { age: [11, 19], emoji: "🎮", repeat: 3 }, ["밤샘 게임", "徹夜ゲーム", "An All-Night Gaming Session"], ["시험 기간인데 친구들이 게임 한 판만 하자고 한다.", "試験期間なのに友達がゲームを一回だけやろうと言う。", "It's exam week, but your friends want 'just one game.'"], [
  ["play", "🕹️", ["한 판만 한다", "一回だけやる", "Just one"], { outcomes: [
    { chance: 0.5, grade: "mid", effects: { happy: 5, intel: -2 }, n: ["한 판은 열 판이 되었다. 해가 떴다.", "一回が十回になった。夜が明けた。", "One game became ten. The sun came up."] },
    { chance: 0.5, grade: "good", effects: { happy: 4 }, n: ["정말 한 판만 하고 책상 앞에 앉았다. 스스로가 대견했다.", "本当に一回だけで机に向かった。自分が誇らしかった。", "You really played one and went back to studying. You were proud of yourself."] }] }],
  ["study", "📚", ["공부한다", "勉強する", "Study"], { effects: { intel: 3, happy: -1 }, n: ["단체 대화방 알림을 끄고 문제집을 폈다.", "グループチャットの通知を切って問題集を開いた。", "You muted the group chat and opened your workbook."] }],
]);
L("part_time_job", { age: [16, 22], emoji: "🧾", weight: 1 }, ["첫 아르바이트", "初めてのアルバイト", "First Part-Time Job"], ["편의점 아르바이트 자리가 났다. 시급은 많지 않다.", "コンビニのアルバイトに空きが出た。時給は高くない。", "A convenience store job opens up. The pay isn't much."], [
  ["work", "🏪", ["해 본다", "やってみる", "Take it"], { grade: "good", effects: { money: 120, social: 2, happy: 2 }, flag: { add: "rb2_firstjob" }, n: ["첫 월급으로 부모님께 내복을 사 드렸다.", "初任給で両親に下着を贈った。", "With your first paycheck, you bought your parents thermal underwear — the classic first gift."] }],
  ["no", "📖", ["공부에 집중한다", "勉強に集中する", "Focus on school"], { effects: { intel: 2 }, n: ["용돈은 부족했지만 성적은 올랐다.", "お小遣いは足りなかったが成績は上がった。", "Pocket money was tight, but your grades went up."] }],
]);
L("graduation", { age: [17, 19], emoji: "🎓", weight: 1.4, cond: (p) => !p.flags.has("rb2_grad") }, ["졸업식", "卒業式", "Graduation Day"], ["교복을 입는 마지막 날이다. 친구들과 교문 앞에 모였다.", "制服を着る最後の日だ。友達と校門の前に集まった。", "Your last day in a school uniform. Friends gather at the gate."], [
  ["photo", "📸", ["다 같이 사진을 찍는다", "みんなで写真を撮る", "Take a group photo"], { grade: "good", effects: { happy: 6, social: 2 }, flag: { add: "rb2_grad" }, n: ["밀가루를 뒤집어쓴 얼굴들이 사진 속에서 영원히 웃고 있다.", "小麦粉まみれの顔が、写真の中で永遠に笑っている。", "Flour-covered faces, laughing forever in the photo."] }],
  ["letter", "📝", ["선생님께 편지를 드린다", "先生に手紙を渡す", "Give your teacher a letter"], { grade: "good", effects: { happy: 4 }, flag: { add: "rb2_grad" }, n: ["선생님이 안경을 벗고 눈을 비비셨다.", "先生が眼鏡を外して目をこすった。", "Your teacher took off their glasses and rubbed their eyes."] }],
]);

// ---------- 노년 ----------
L("smartphone", { age: [65, 90], emoji: "📱", weight: 1 }, ["새 휴대폰", "新しいスマホ", "A New Phone"], ["자식들이 새 휴대폰을 사 주었다. 버튼이 하나도 없다.", "子どもたちが新しいスマホを買ってくれた。ボタンが一つもない。", "Your kids bought you a new phone. It has no buttons at all."], [
  ["learn", "🧓", ["복지관 강좌에서 배운다", "福祉館の講座で習う", "Learn at the senior center"], { grade: "good", effects: { intel: 3, happy: 4, social: 2 }, n: ["처음으로 영상 통화를 걸었다. 화면 속 손주가 손을 흔들었다.", "初めてビデオ通話をかけた。画面の中で孫が手を振った。", "You made your first video call. Your grandchild waved on the screen."] }],
  ["old", "☎️", ["옛 폰을 계속 쓴다", "古い電話を使い続ける", "Keep the old one"], { effects: { happy: 1 }, n: ["손에 익은 게 제일 편했다.", "手になじんだものが一番楽だった。", "What your hands already knew was easiest."] }],
]);
L("health_walk", { age: [60, 92], emoji: "🥾", repeat: 6 }, ["아침 산책", "朝の散歩", "A Morning Walk"], ["의사가 하루 30분씩 걸으라고 했다.", "医者が一日30分歩くように言った。", "Your doctor says to walk thirty minutes a day."], [
  ["walk", "🌳", ["매일 걷는다", "毎日歩く", "Walk every day"], { grade: "good", effects: { health: 5, happy: 3 }, n: ["공원 벤치마다 아는 얼굴이 생겼다.", "公園のベンチごとに顔見知りができた。", "Soon every park bench had a familiar face."] }],
  ["tv", "📺", ["텔레비전을 본다", "テレビを見る", "Watch TV"], { effects: { happy: 1, health: -2 }, n: ["드라마 다음 회가 더 궁금했다.", "ドラマの次回のほうが気になった。", "The next episode of the drama was more pressing."] }],
]);
L("memory_box", { age: [70, 95], emoji: "📦", weight: 1, cond: (p) => !p.flags.has("rb2_memorybox") }, ["추억 상자", "思い出の箱", "The Memory Box"], ["옷장 깊은 곳에서 오래된 상자가 나왔다. 사진과 편지가 가득하다.", "押し入れの奥から古い箱が出てきた。写真と手紙でいっぱいだ。", "Deep in the closet is an old box full of photos and letters."], [
  ["read", "📖", ["하나씩 다시 읽는다", "一つずつ読み返す", "Reread them one by one"], { grade: "good", effects: { happy: 6 }, flag: { add: "rb2_memorybox" }, n: ["한 장 한 장마다 그때의 냄새가 났다.", "一枚一枚にあの頃の匂いがした。", "Every page carried the scent of that time."] }],
  ["give", "🎁", ["가족에게 나눠 준다", "家族に分けてあげる", "Share them with family"], { grade: "good", effects: { happy: 5, social: 3 }, flag: { add: "rb2_memorybox" }, n: ["'이게 엄마 아빠 젊을 때야?' 다들 놀라 웃었다.", "「これが若い頃?」みんな驚いて笑った。", "'Is that what you looked like young?' Everyone laughed in surprise."] }],
]);
L("friend_funeral", { age: [65, 95], emoji: "🕯️", repeat: 8 }, ["친구의 부고", "友人の訃報", "A Friend's Passing"], ["오랜 친구의 부고 문자가 왔다.", "古い友人の訃報が届いた。", "A text arrives: an old friend has passed away."], [
  ["go", "🖤", ["먼 길이라도 간다", "遠くても行く", "Go, however far"], { grade: "good", effects: { happy: -3, social: 2, health: -1 }, n: ["영정 사진 속 친구는 스무 살 때처럼 웃고 있었다.", "遺影の友は二十歳の頃のように笑っていた。", "In the memorial photo, your friend was smiling like they did at twenty."] }],
  ["call", "📞", ["가족에게 전화로 위로한다", "家族に電話でお悔やみを伝える", "Call the family"], { effects: { happy: -3 }, n: ["전화를 끊고 한참 창밖을 보았다.", "電話を切ってしばらく窓の外を眺めた。", "After hanging up, you stared out the window for a long time."] }],
]);
L("will", { age: [72, 95], emoji: "📜", weight: 0.9, cond: (p) => !p.flags.has("rb2_will") }, ["유언장", "遺言書", "A Will"], ["변호사가 미리 유언장을 써 두는 게 좋다고 했다.", "弁護士が遺言書を書いておいたほうがいいと言った。", "A lawyer suggests writing a will in advance."], [
  ["write", "🖋️", ["차분히 쓴다", "落ち着いて書く", "Write it calmly"], { grade: "good", effects: { happy: 2, intel: 1 }, flag: { add: "rb2_will" }, n: ["재산보다 하고 싶은 말이 더 길었다.", "財産よりも伝えたい言葉のほうが長かった。", "The words you wanted to leave ran longer than the list of belongings."] }],
  ["later", "⏳", ["아직은 이르다", "まだ早い", "It's too early"], { effects: {}, n: ["'다음 봄에 쓰지 뭐.'", "「次の春に書こう」", "'I'll write it next spring.'"] }],
]);
L("hometown_visit", { age: [60, 90], emoji: "🏞️", weight: 0.9, cond: (p) => !p.flags.has("rb2_hometown") }, ["고향 방문", "故郷訪問", "Visiting Your Hometown"], ["어릴 적 살던 동네에 가 보고 싶어졌다.", "幼い頃に住んでいた町に行ってみたくなった。", "You suddenly want to see the neighborhood where you grew up."], [
  ["go", "🚆", ["기차를 탄다", "列車に乗る", "Take the train"], { grade: "good", effects: { happy: 7 }, flag: { add: "rb2_hometown" }, n: ["다니던 학교 자리엔 아파트가 섰다. 그래도 골목 냄새는 그대로였다.", "通っていた学校の跡にはマンションが建っていた。それでも路地の匂いは昔のままだった。", "Apartments stood where your school used to be — but the alleys smelled the same."] }],
  ["map", "🗺️", ["지도로만 둘러본다", "地図で見て回るだけ", "Just look on the map"], { effects: { happy: 2 }, flag: { add: "rb2_hometown" }, n: ["화면 속 거리에서 옛 가게 간판을 찾았다.", "画面の中の通りで昔の店の看板を見つけた。", "On the screen you spotted the sign of an old shop."] }],
]);
L("gardening", { age: [55, 90], emoji: "🪴", weight: 0.9 }, ["베란다 텃밭", "ベランダ菜園", "A Balcony Garden"], ["베란다에 상추와 방울토마토를 키워 볼까.", "ベランダでレタスとミニトマトを育ててみようか。", "Maybe grow lettuce and cherry tomatoes on the balcony?"], [
  ["grow", "🍅", ["씨를 뿌린다", "種をまく", "Plant the seeds"], { grade: "good", effects: { happy: 5, health: 2 }, n: ["첫 토마토가 빨갛게 익었다. 아까워서 한참을 바라보았다.", "最初のトマトが赤く実った。もったいなくてしばらく眺めた。", "The first tomato ripened red. It was too precious to eat right away."] }],
  ["no", "🛒", ["그냥 사 먹는다", "買って食べる", "Just buy them"], { effects: {}, n: ["시장 할머니의 상추가 제일 맛있었다.", "市場のおばあさんのレタスが一番おいしかった。", "The grandma at the market had the best lettuce anyway."] }],
]);
L("senior_love", { age: [65, 90], emoji: "🌹", weight: 0.6, married: false }, ["늦은 인연", "遅い縁", "Late-Blooming Romance"], ["복지관 노래 교실에서 자꾸 같은 사람과 눈이 마주친다.", "福祉館の歌の教室で何度も同じ人と目が合う。", "In the senior center's singing class, you keep catching the same person's eye."], [
  ["talk", "☕", ["차 한잔하자고 한다", "お茶に誘う", "Ask them for tea"], { grade: "good", outcomes: [
    { chance: 0.55, grade: "crit", effects: { happy: 10, social: 3 }, flag: { add: "rb2_lateLove" }, n: ["두 시간이 훌쩍 지났다. 다음 주에 또 만나기로 했다.", "二時間があっという間に過ぎた。来週また会うことにした。", "Two hours flew by. You agreed to meet again next week."] },
    { chance: 0.45, grade: "mid", effects: { happy: 2 }, n: ["좋은 친구가 생겼다. 그것도 충분했다.", "いい友達ができた。それで十分だった。", "You made a good friend. That was enough."] }] }],
  ["shy", "🙈", ["모른 척한다", "知らないふりをする", "Pretend not to notice"], { effects: { happy: -1 }, n: ["노래 교실에 갈 때마다 옷을 한 번 더 골랐다.", "歌の教室に行くたびに服を選び直した。", "You picked your clothes extra carefully before every class."] }],
]);
L("pass_on", { age: [70, 95], emoji: "🧶", weight: 1 }, ["물려줄 것", "受け継がせるもの", "Something to Pass On"], ["평생 익힌 솜씨가 하나 있다. 누군가에게 가르쳐 주고 싶다.", "一生かけて身につけた腕前がある。誰かに教えたい。", "There's one skill you've honed your whole life. You want to teach it to someone."], [
  ["teach", "👐", ["가족에게 가르친다", "家族に教える", "Teach your family"], { grade: "good", effects: { happy: 6, social: 2 }, n: ["손주가 서툴게 따라 했다. 그 모습이 예전의 나 같았다.", "孫がぎこちなく真似をした。その姿が昔の自分のようだった。", "Your grandchild clumsily copied you, looking just like you once did."] }],
  ["record", "🎥", ["영상으로 남긴다", "動画に残す", "Record a video"], { grade: "good", effects: { happy: 4, intel: 1 }, n: ["모르는 사람들이 댓글로 고맙다고 했다.", "知らない人たちがコメントでお礼を言ってくれた。", "Strangers left comments thanking you."] }],
]);

export const REBORN_EVENTS2 = EV;

// ---------- 작은 반려동물 (11-22 동물 확장) ----------
const SMALL = [
  ["rabbit", "🐇", ["토끼 분양", "うさぎの譲渡", "A Rabbit Needs a Home"], ["이웃이 기르던 토끼를 맡아 줄 사람을 찾는다.", "近所の人が飼っていたうさぎの引き取り手を探している。", "A neighbor is looking for someone to take their rabbit."], ["집 안을 깡충깡충 뛰어다녔다. 당근을 줄 때마다 코를 씰룩였다.", "家の中をぴょんぴょん跳ね回った。にんじんをあげるたびに鼻をひくひくさせた。", "It hopped all over the house, twitching its nose at every carrot."]],
  ["hamster", "🐹", ["햄스터 한 마리", "ハムスター一匹", "One Little Hamster"], ["친구네 햄스터가 새끼를 낳았다며 한 마리 데려가라고 한다.", "友達のハムスターが子どもを産んだので、一匹もらってほしいと言う。", "A friend's hamster had babies — would you take one?"], ["밤마다 쳇바퀴 소리가 자장가가 되었다.", "毎晩、回し車の音が子守唄になった。", "Every night, the sound of the wheel became a lullaby."]],
  ["bird", "🦜", ["앵무새", "インコ", "A Parakeet"], ["새 가게 앞에서 앵무새가 '안녕' 하고 말을 걸었다.", "小鳥屋の前でインコが「こんにちは」と話しかけてきた。", "Outside a bird shop, a parakeet says 'Hello!'"], ["아침마다 내 이름을 불렀다. 알람보다 정확했다.", "毎朝私の名前を呼んだ。目覚ましより正確だった。", "It called your name every morning — more reliable than any alarm."]],
  ["turtle", "🐢", ["작은 거북이", "小さなカメ", "A Tiny Turtle"], ["축제에서 손바닥만 한 거북이를 받았다.", "お祭りで手のひらほどのカメをもらった。", "You get a palm-sized turtle at a festival."], ["느릿느릿 걸었지만, 생각보다 오래 함께했다.", "のろのろ歩いたが、思ったより長く一緒にいた。", "It moved slowly, but stayed with you far longer than expected."]],
  ["fish", "🐠", ["금붕어 어항", "金魚鉢", "A Goldfish Bowl"], ["문방구 앞 금붕어가 유난히 반짝였다.", "文房具屋の前の金魚がやけにきらきらしていた。", "The goldfish outside the stationery shop shimmered."], ["물방울 소리가 방을 조용하게 만들었다.", "水の泡の音が部屋を静かにした。", "The bubbling made the room feel calm."]],
  ["hedgehog", "🦔", ["고슴도치", "ハリネズミ", "A Hedgehog"], ["가시투성이 작은 친구가 손바닥 위에서 몸을 말았다.", "とげだらけの小さな友達が手のひらで丸まった。", "A prickly little friend curls up in your palm."], ["처음엔 따가웠지만, 곧 손바닥 위에서 잠들었다.", "最初はちくちくしたが、すぐに手のひらで眠った。", "Prickly at first — soon it was sleeping in your hand."]],
];
for (const [kind, emo, title, desc, n] of SMALL) {
  L("pet_" + kind, { age: [7, 80], emoji: emo, weight: 0.45, cond: (p) => !(p.pets || []).some(x => x.alive && x.kind === kind) && (p.pets || []).filter(x => x.alive).length < 3 }, title, desc, [
    ["yes", emo, ["데려온다", "連れて帰る", "Take it home"], { grade: "good", effects: { happy: 6, money: -40 }, life: { pet: { kind } }, n }],
    ["no", "🙏", ["마음만 받는다", "気持ちだけ受け取る", "Kindly decline"], { effects: {}, n: ["다른 좋은 주인을 만나길 바랐다.", "ほかのいい飼い主に出会えるよう願った。", "You hoped it would find another good home."] }],
  ]);
}
export const REBORN_EVENTS2_PETS = EV;
