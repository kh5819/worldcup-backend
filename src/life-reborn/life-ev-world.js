// =========================
// 플듀 인생게임 REBORN — 사건 3차: 나라마다 다른 삶 (세계 모드) 2026-11-23
// 그 나라에서만 있는 학교·시험·명절·생활·사회 사건. country 로 그 나라 인생에서만 나온다 (fromYear 로 시대도 맞춤).
// 문화는 존중하는 시선으로, 고정관념 없이 '그 나라 사람의 평범한 하루'로 쓴다.
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const W = (id, meta, title, desc, choices) => EV.push(ev("wd_" + id, { area: "world", weight: 1.6, ...meta }, title, desc, choices));
const S = (id, meta, title, desc, choices) => EV.push(ev("wd_" + id, { area: "school", weight: 2, prio: 0.5, ...meta }, title, desc, choices));
const exam = (good, mid, bad) => [
  ["study", "📚", ["마지막까지 공부한다", "最後まで勉強する", "Study to the very end"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { intel: 5, happy: 8 }, flag: { add: ["good_csat", "exam_pass"] }, n: good },
    { chance: 0.35, grade: "mid", effects: { intel: 2, happy: 1 }, flag: { add: "exam_pass" }, n: mid },
    { chance: 0.15, grade: "bad", effects: { happy: -6 }, flag: { add: "retake" }, n: bad }] }],
  ["calm", "🧘", ["잘 자고 담담하게 본다", "よく寝て淡々と受ける", "Sleep well and take it calmly"], { outcomes: [
    { chance: 0.45, grade: "good", effects: { intel: 3, happy: 6, health: 1 }, flag: { add: ["good_csat", "exam_pass"] }, n: good },
    { chance: 0.45, grade: "mid", effects: { happy: 2 }, flag: { add: "exam_pass" }, n: mid },
    { chance: 0.1, grade: "bad", effects: { happy: -4 }, n: bad }] }],
];

// ---------- 일본 ----------
S("jp_juken", { country: ["JP"], age: [17, 19], emoji: "📝", scene: "classroom", fromYear: 1949 }, ["대학 입시", "大学受験", "University Entrance Exams"], ["겨울, 입시 날이 밝았다. 합격 부적을 가방에 달았다.", "冬、受験の日がやってきた。合格祈願のお守りを鞄につけた。", "Winter. Exam day has arrived. A good-luck charm hangs from your bag."], exam(
  ["합격자 게시판에서 내 번호를 찾았다. 엄마와 끌어안았다.", "合格発表の掲示板で自分の番号を見つけた。母と抱き合った。", "I found my number on the results board. Mom and I hugged."],
  ["원하던 곳은 아니었지만 붙었다. 새 도시가 기다렸다.", "第一志望ではなかったが受かった。新しい街が待っていた。", "Not my first choice, but I got in. A new city awaited."],
  ["떨어졌다. 1년 더 공부하기로 했다.", "落ちた。もう一年浪人することにした。", "I didn't make it. I decided to study one more year."]) );
W("jp_seijin", { country: ["JP"], age: [19, 20], emoji: "👘", scene: "ceremony", fromYear: 1949 }, ["성인식", "成人式", "Coming-of-Age Day"], ["성인의 날이다. 기모노(정장)를 입고 동창들을 만난다.", "成人の日。振袖(スーツ)を着て同級生に会う。", "Coming-of-Age Day. You put on a kimono (or suit) to see old classmates."], [
  ["go", "📸", ["다 같이 사진을 찍는다", "みんなで写真を撮る", "Take photos with everyone"], { grade: "good", effects: { happy: 5, social: 4 }, n: ["중학교 담임 선생님이 우리 이름을 다 기억하고 계셨다.", "中学の担任が私たちの名前を全部覚えていた。", "Our junior high teacher remembered every one of our names."] }],
  ["family", "🏠", ["가족과 조용히 축하한다", "家族と静かに祝う", "Celebrate quietly with family"], { effects: { happy: 3 }, n: ["할머니가 축하금 봉투를 손에 쥐여 주셨다.", "祖母がお祝いの封筒を握らせてくれた。", "Grandma pressed a gift envelope into my hand."] }],
]);
W("jp_shukatsu", { country: ["JP"], age: [21, 23], emoji: "👔", scene: "jobhunt", fromYear: 1960 }, ["취업 활동", "就活", "Job Hunting Season"], ["모두가 같은 검정 정장을 입고 회사 설명회를 돈다.", "みんなが同じ黒いスーツで会社説明会を回る。", "Everyone wears the same black suit and makes the rounds of company info sessions."], [
  ["big", "🏢", ["큰 회사만 노린다", "大企業だけを狙う", "Aim only for big companies"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { happy: 6, money: 200 }, life: { job: { title: "대기업 사원", salary: 4800 } }, n: ["내정 통지를 받았다. 정장을 세탁소에 맡기며 웃었다.", "内定通知をもらった。スーツをクリーニングに出しながら笑った。", "I got the offer. I laughed as I dropped my suit at the cleaner's."] },
    { chance: 0.6, grade: "mid", effects: { happy: -3 }, n: ["불합격 메일이 스무 통 쌓였다.", "お祈りメールが二十通たまった。", "Twenty rejection emails piled up."] }] }],
  ["fit", "🧭", ["하고 싶은 일을 찾는다", "やりたい仕事を探す", "Look for work you actually want"], { grade: "good", effects: { happy: 4, intel: 1 }, n: ["작은 회사였지만 면접 때 처음으로 웃었다.", "小さな会社だったが、面接で初めて笑えた。", "A small company, but it was the first interview where I smiled."] }],
]);
W("jp_hanami", { country: ["JP"], age: [6, 95], emoji: "🌸", scene: "park" }, ["꽃놀이", "お花見", "Cherry Blossom Viewing"], ["벚꽃이 만개했다. 회사 막내가 새벽부터 자리를 잡으러 갔다.", "桜が満開だ。新人が朝から場所取りに行った。", "The cherry blossoms are in full bloom. The newest employee went at dawn to claim a spot."], [
  ["join", "🍶", ["꽃 아래서 다 같이 먹고 마신다", "桜の下でみんなで飲み食いする", "Eat and drink under the trees with everyone"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["꽃잎이 도시락 위로 떨어졌다.", "花びらが弁当の上に落ちた。", "Petals drifted onto our lunch boxes."] }],
  ["walk", "🚶", ["밤 벚꽃을 혼자 걷는다", "夜桜を一人で歩く", "Walk alone under night blossoms"], { effects: { happy: 4 }, n: ["등불 아래 벚꽃이 조용했다.", "提灯の下の桜は静かだった。", "Under the lanterns, the blossoms were silent."] }],
]);
W("jp_bosai", { country: ["JP"], age: [6, 90], emoji: "🎒", scene: "classroom" }, ["방재 훈련", "防災訓練", "Disaster Drill"], ["지진 대비 훈련 날이다. 방재 가방도 점검하라고 한다.", "地震の防災訓練の日。防災バッグも点検しろと言われた。", "Earthquake drill day. You're told to check your emergency kit too."], [
  ["serious", "⛑️", ["진지하게 참여하고 가방을 채운다", "真剣に参加しバッグを整える", "Take it seriously and restock your kit"], { grade: "good", effects: { intel: 2, health: 1 }, flag: { add: "prepared" }, n: ["물과 건빵, 손전등을 새로 넣었다.", "水と乾パン、懐中電灯を入れ替えた。", "Fresh water, hardtack, and a flashlight went in."] }],
  ["lazy", "🥱", ["대충 한다", "適当にやる", "Go through the motions"], { effects: { happy: 1 }, n: ["가방 속 건빵 유통기한이 3년 지나 있었다.", "バッグの乾パンの賞味期限が三年過ぎていた。", "The hardtack in my kit had expired three years earlier."] }],
]);
// ---------- 미국 ----------
S("us_college", { country: ["US"], age: [17, 18], emoji: "📨", scene: "kidroom", fromYear: 1930 }, ["대학 지원", "大学出願", "College Applications"], ["지원서 에세이를 쓴다. 'Who are you?'라는 질문 앞에서 막혔다.", "出願エッセイを書く。「あなたは誰か」という問いに詰まった。", "College essays. You're stuck on the prompt: 'Who are you?'"], [
  ["honest", "✍️", ["진짜 내 이야기를 쓴다", "本当の自分の話を書く", "Write your real story"], { outcomes: [
    { chance: 0.55, grade: "crit", effects: { intel: 4, happy: 8 }, flag: { add: ["good_csat", "exam_pass"] }, n: ["두꺼운 봉투가 왔다. 'Congratulations!'", "分厚い封筒が届いた。「Congratulations!」", "A thick envelope arrived: 'Congratulations!'"] },
    { chance: 0.45, grade: "mid", effects: { intel: 2, happy: 2 }, flag: { add: "exam_pass" }, n: ["대기자 명단에 올랐다가 결국 주립대로 갔다. 거기서 평생 친구를 만났다.", "補欠になり、結局州立大へ。そこで一生の友に出会った。", "Waitlisted, then off to the state school — where I met lifelong friends."] }] }],
  ["community", "🏫", ["커뮤니티 칼리지부터", "コミュニティカレッジから", "Start at community college"], { grade: "good", effects: { money: 200, intel: 2 }, flag: { add: "exam_pass" }, n: ["학비를 아끼고 2년 뒤 편입했다.", "学費を節約し、二年後に編入した。", "Saved on tuition and transferred two years later."] }],
]);
W("us_prom", { country: ["US"], age: [16, 18], emoji: "💃", scene: "stage" }, ["프롬", "プロム", "Prom Night"], ["졸업 무도회다. 같이 갈 사람을 정해야 한다.", "卒業ダンスパーティー。一緒に行く相手を決めなきゃ。", "It's prom. You need to decide who to go with."], [
  ["ask", "🌹", ["좋아하는 사람에게 묻는다", "好きな人を誘う", "Ask your crush"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 7, social: 3 }, relation: { romance: true }, n: ["'Yes!' 코르사주가 손목에서 흔들렸다.", "「Yes!」コサージュが手首で揺れた。", "'Yes!' The corsage swayed on their wrist."] },
    { chance: 0.5, grade: "mid", effects: { happy: -1, social: 2 }, n: ["이미 약속이 있었다. 친구들과 단체로 갔고, 그게 더 재밌었다.", "もう相手がいた。友達とグループで行き、そっちの方が楽しかった。", "They already had a date. I went with friends — honestly more fun."] }] }],
  ["friends", "🕺", ["친구들과 단체로", "友達とグループで", "Go as a group"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["리무진 대신 친구 아빠의 미니밴을 탔다.", "リムジンの代わりに友達の父のミニバンに乗った。", "Instead of a limo, we rode in a friend's dad's minivan."] }],
]);
W("us_thanksgiving", { country: ["US"], age: [5, 95], emoji: "🦃", scene: "home" }, ["추수감사절", "感謝祭", "Thanksgiving"], ["온 가족이 모였다. 칠면조를 굽다 연기 경보기가 울렸다.", "家族全員が集まった。七面鳥を焼いていたら煙探知機が鳴った。", "The whole family's here. The turkey sets off the smoke alarm."], [
  ["grace", "🙏", ["고마운 것 하나씩 말하기", "感謝を一つずつ言う", "Go around sharing what you're thankful for"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["할아버지가 '너희 모두'라고 말하자 조용해졌다.", "祖父が「お前たちみんなだ」と言うと静かになった。", "When Grandpa said, 'All of you,' the room went quiet."] }],
  ["football", "🏈", ["경기 보며 파이 먹기", "試合を見ながらパイを食べる", "Watch football and eat pie"], { effects: { happy: 4, health: -1 }, n: ["세 번째 파이 조각에서 멈췄어야 했다.", "三切れ目のパイで止めるべきだった。", "I should've stopped at the third slice of pie."] }],
]);
W("us_road_trip", { country: ["US"], age: [18, 70], emoji: "🚗", scene: "street", fromYear: 1950 }, ["대륙 횡단 여행", "大陸横断ドライブ", "Cross-Country Road Trip"], ["친구가 동부에서 서부까지 차로 가자고 한다.", "友達が東海岸から西海岸まで車で行こうと言う。", "A friend wants to drive coast to coast."], [
  ["go", "🛣️", ["간다", "行く", "Go"], { grade: "crit", effects: { happy: 8, social: 3, money: -150 }, flag: { add: "travel" }, n: ["사막의 모텔, 끝없는 옥수수밭, 바다. 그 2주를 평생 이야기했다.", "砂漠のモーテル、果てしないトウモロコシ畑、海。その二週間を一生語った。", "Desert motels, endless cornfields, the ocean. I talked about those two weeks forever."] }],
  ["no", "🏠", ["일 때문에 못 간다", "仕事で行けない", "Can't — work"], { effects: { happy: -1, money: 50 }, n: ["친구가 매일 엽서를 보냈다.", "友達が毎日絵葉書を送ってきた。", "My friend sent a postcard every day."] }],
]);
W("us_student_loan", { country: ["US"], age: [22, 40], emoji: "🎓", scene: "home", fromYear: 1965, cond: (p) => p.flags?.has?.("exam_pass") || p.flags?.has?.("college_done") }, ["학자금 대출", "学資ローン", "Student Loans"], ["졸업하자마자 학자금 대출 상환 고지서가 왔다.", "卒業してすぐ学資ローンの返済通知が届いた。", "Right after graduation, the student loan bills arrive."], [
  ["aggressive", "💪", ["허리띠를 졸라매고 빨리 갚는다", "節約して早く返す", "Live lean and pay it off fast"], { grade: "good", effects: { money: -600, happy: -2, intel: 1 }, flag: { add: "debt_free" }, n: ["7년 만에 다 갚았다. 마지막 날 친구들과 피자를 먹었다.", "七年で完済した。最後の日に友達とピザを食べた。", "Paid off in seven years. We had pizza on the last day."] }],
  ["minimum", "🐌", ["최소 금액만 낸다", "最低額だけ払う", "Pay only the minimum"], { effects: { money: -200, happy: -1 }, n: ["마흔이 넘어서도 고지서가 왔다.", "四十を過ぎても請求書が届いた。", "The bills kept coming past forty."] }],
]);
// ---------- 영국 ----------
S("gb_alevels", { country: ["GB"], age: [17, 18], emoji: "📄", scene: "classroom", fromYear: 1951 }, ["A레벨 결과 발표", "Aレベルの結果発表", "A-Level Results Day"], ["A레벨 결과가 든 봉투를 받았다.", "Aレベルの結果の封筒を受け取った。", "You're handed the envelope with your A-level results."], exam(
  ["원하던 대학 조건을 넘겼다. 운동장에서 친구들과 뛰었다.", "志望大学の条件を超えた。校庭で友達と跳ね回った。", "I beat my offer grades. We jumped around the schoolyard."],
  ["조건에 살짝 모자랐지만 다른 대학이 받아 줬다.", "条件に少し届かなかったが、別の大学が受け入れてくれた。", "Just missed my offer, but another university took me."],
  ["결과가 나빴다. 1년 쉬며 다시 준비하기로 했다.", "結果が悪かった。一年休んで準備し直すことにした。", "Bad results. I took a year to prepare again."]) );
W("gb_gap_year", { country: ["GB", "AU"], age: [18, 19], emoji: "🎒", scene: "abroad", fromYear: 1970 }, ["갭 이어", "ギャップイヤー", "A Gap Year"], ["대학에 가기 전 1년 동안 세계를 돌아볼까.", "大学の前に一年間世界を回ろうか。", "Take a year to see the world before university?"], [
  ["go", "🌏", ["떠난다", "旅立つ", "Go"], { grade: "good", effects: { happy: 7, social: 4, intel: 2, money: -300 }, flag: { add: ["travel", "abroad"] }, n: ["농장에서 일하고 호스텔에서 잤다. 돌아왔을 때 다른 사람이 돼 있었다.", "農場で働きホステルに泊まった。帰ってきたら別人になっていた。", "I worked on farms and slept in hostels. I came back a different person."] }],
  ["straight", "🎓", ["바로 대학에 간다", "すぐ大学に行く", "Go straight to university"], { effects: { intel: 1 }, n: ["친구들의 여행 사진을 보며 도서관에 있었다.", "友達の旅行写真を見ながら図書館にいた。", "I scrolled friends' travel photos from the library."] }],
]);
W("gb_pub_quiz", { country: ["GB"], age: [18, 85], emoji: "🍺", scene: "restaurant" }, ["펍 퀴즈의 밤", "パブクイズの夜", "Pub Quiz Night"], ["화요일마다 동네 펍에서 퀴즈 대회가 열린다.", "毎週火曜、近所のパブでクイズ大会がある。", "Every Tuesday, the local pub hosts a quiz night."], [
  ["team", "🧠", ["팀을 꾸려 매주 나간다", "チームを組んで毎週出る", "Form a team and go every week"], { grade: "good", effects: { social: 4, intel: 2, happy: 3 }, n: ["팀 이름은 매주 바뀌었다. 3년 만에 처음 우승했다.", "チーム名は毎週変わった。三年目に初優勝した。", "Our team name changed every week. We won for the first time in year three."] }],
  ["once", "😅", ["한 번 가 본다", "一度行ってみる", "Try it once"], { effects: { social: 1, happy: 2 }, n: ["음악 문제에서 전부 틀렸다.", "音楽問題で全部外した。", "Got every music question wrong."] }],
]);
W("gb_bonfire", { country: ["GB"], age: [4, 90], emoji: "🎆", scene: "park" }, ["불꽃놀이의 밤", "ボンファイア・ナイト", "Bonfire Night"], ["11월 5일, 공원에 큰 모닥불과 불꽃놀이가 열린다.", "11月5日、公園で大きな焚き火と花火がある。", "November 5th: a big bonfire and fireworks in the park."], [
  ["go", "🔥", ["장갑 끼고 나간다", "手袋をして出かける", "Bundle up and go"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["손에 쥔 스파클러로 이름을 썼다.", "手に持った線香花火で名前を書いた。", "I wrote my name in the air with a sparkler."] }],
  ["home", "🏠", ["창밖으로 본다", "窓から見る", "Watch from the window"], { effects: { happy: 2 }, n: ["따뜻한 차를 마시며 하늘을 봤다.", "温かいお茶を飲みながら空を見た。", "I watched the sky with a warm cup of tea."] }],
]);
// ---------- 프랑스 ----------
S("fr_bac", { country: ["FR"], age: [17, 18], emoji: "📜", scene: "classroom", fromYear: 1900 }, ["바칼로레아 철학 시험", "バカロレア哲学試験", "The Baccalauréat Philosophy Exam"], ["바칼로레아 첫날, 철학 문제가 나왔다. '행복은 이성의 문제인가?'", "バカロレア初日、哲学の問題。「幸福は理性の問題か?」", "First day of the bac. The philosophy prompt: 'Is happiness a matter of reason?'"], exam(
  ["네 시간을 꽉 채워 썼다. '매우 우수' 판정을 받았다.", "四時間ぎっしり書いた。「優秀」の評価をもらった。", "I wrote for the full four hours. 'Mention très bien.'"],
  ["무난하게 통과했다. 그날 밤 친구들과 광장에서 춤을 췄다.", "無難に合格した。その夜、友達と広場で踊った。", "Passed without fuss. We danced in the square that night."],
  ["재시험 대상이 됐다. 7월 내내 다시 공부했다.", "追試の対象になった。七月はずっと勉強し直した。", "I had to resit. All of July went to studying again."]) );
W("fr_vacances", { country: ["FR"], age: [5, 90], emoji: "🏖️", scene: "beach", fromYear: 1936 }, ["8월의 바캉스", "八月のヴァカンス", "August Vacances"], ["8월, 도시가 텅 빈다. 다들 남쪽 바다로 떠난다.", "八月、街が空っぽになる。みんな南の海へ向かう。", "August. The city empties out as everyone heads for the southern coast."], [
  ["south", "🚙", ["캠핑카로 남부 해변에", "キャンピングカーで南の海へ", "Camper van to the south coast"], { grade: "good", effects: { happy: 7, health: 2, money: -150 }, flag: { add: "travel" }, n: ["고속도로는 막혔지만 바다는 기다려 줬다.", "高速道路は渋滞したが、海は待っていてくれた。", "The highway was jammed, but the sea waited for us."] }],
  ["city", "🏙️", ["텅 빈 파리를 즐긴다", "空っぽのパリを楽しむ", "Enjoy the empty city"], { effects: { happy: 4, money: 50 }, n: ["단골 빵집도 문을 닫았다. 그래도 거리가 조용해 좋았다.", "行きつけのパン屋も閉まっていた。それでも静かな街がよかった。", "Even my bakery was closed. But the quiet streets were lovely."] }],
]);
W("fr_greve", { country: ["FR"], age: [16, 70], emoji: "🪧", scene: "subway", fromYear: 1950 }, ["파업 날의 출근", "ストの日の通勤", "Commuting on a Strike Day"], ["대중교통 파업이다. 출근을 어떻게 할까.", "公共交通のストだ。どう通勤しよう。", "Public transit is on strike. How will you get to work?"], [
  ["bike", "🚲", ["자전거로 간다", "自転車で行く", "Ride a bike"], { grade: "good", effects: { health: 3, happy: 2 }, n: ["파업이 끝난 뒤에도 자전거를 계속 탔다.", "ストが終わっても自転車に乗り続けた。", "I kept cycling even after the strike ended."] }],
  ["join", "📣", ["시위에 합류한다", "デモに加わる", "Join the demonstration"], { effects: { social: 3, happy: 1 }, n: ["낯선 사람들과 같은 구호를 외쳤다.", "知らない人たちと同じスローガンを叫んだ。", "I chanted the same slogans with strangers."] }],
]);
W("fr_apero", { country: ["FR"], age: [20, 90], emoji: "🥖", scene: "restaurant" }, ["아페로", "アペロ", "Apéro Hour"], ["이웃이 저녁 전에 한잔하자며 아페로에 초대했다.", "隣人が夕食前に一杯どうかとアペロに誘った。", "Your neighbor invites you over for an early-evening apéro."], [
  ["go", "🧀", ["치즈를 들고 간다", "チーズを持って行く", "Bring cheese and go"], { grade: "good", effects: { social: 4, happy: 4 }, n: ["한 시간이 세 시간이 됐다. 저녁은 건너뛰었다.", "一時間が三時間になった。夕食は抜いた。", "One hour became three. We skipped dinner."] }],
  ["busy", "📚", ["다음에 가겠다고 한다", "また今度と言う", "Say next time"], { effects: { intel: 1 }, n: ["다음 주에 또 초대가 왔다.", "翌週また誘いが来た。", "Another invitation came the next week."] }],
]);
// ---------- 독일 ----------
S("de_track", { country: ["DE"], age: [10, 11], emoji: "🔀", scene: "classroom", fromYear: 1950 }, ["김나지움이냐 레알슐레냐", "ギムナジウムか実科学校か", "Gymnasium or Realschule?"], ["열 살, 선생님이 진학할 학교를 추천하는 시기다.", "十歳、先生が進学先を推薦する時期だ。", "At ten, your teacher recommends which school track you should take."], [
  ["gym", "📖", ["김나지움 (대학 진학 과정)", "ギムナジウム(大学進学コース)", "Gymnasium (university track)"], { grade: "good", effects: { intel: 4, happy: -1 }, flag: { add: "academic_track" }, n: ["숙제가 많았지만 라틴어가 의외로 재밌었다.", "宿題は多かったが、ラテン語が意外と面白かった。", "Lots of homework, but Latin was surprisingly fun."] }],
  ["real", "🔧", ["레알슐레 (실무 과정)", "実科学校(実務コース)", "Realschule (practical track)"], { grade: "good", effects: { power: 2, intel: 2, happy: 2 }, flag: { add: "vocational_track" }, n: ["손으로 만드는 수업이 좋았다. 나중에 직업 훈련으로 이어졌다.", "手を動かす授業が好きだった。後に職業訓練につながった。", "I loved hands-on classes. They led to an apprenticeship later."] }],
]);
S("de_ausbildung", { country: ["DE"], age: [16, 20], emoji: "🛠️", scene: "office", fromYear: 1950 }, ["직업 훈련(아우스빌둥)", "職業訓練(アウスビルドゥング)", "Apprenticeship (Ausbildung)"], ["회사에서 일하며 학교도 다니는 3년 과정 자리가 났다.", "会社で働きながら学校にも通う三年課程の枠が空いた。", "A three-year apprenticeship opens up — work at a company and attend school."], [
  ["take", "🤝", ["시작한다", "始める", "Start it"], { grade: "good", effects: { money: 200, power: 2, intel: 2 }, flag: { add: ["college_done", "exam_pass"] }, n: ["첫 월급은 적었지만 3년 뒤 정식 기술자가 됐다.", "最初の給料は少なかったが、三年後に正式な技術者になった。", "The first paychecks were small, but three years later I was a certified professional."] }],
  ["abitur", "🎓", ["아비투어를 보고 대학으로", "アビトゥーアを受けて大学へ", "Take the Abitur and go to university"], { grade: "good", effects: { intel: 4 }, flag: { add: "exam_pass" }, n: ["시험 준비로 1년이 빠르게 지나갔다.", "試験準備で一年があっという間に過ぎた。", "Exam prep made the year fly by."] }],
]);
W("de_schultuete", { country: ["DE"], age: [6, 6], emoji: "🎁", scene: "classroom", area: "child" }, ["입학 선물 고깔", "入学のシュールテューテ", "The School Cone"], ["입학식 날, 내 키만 한 고깔 선물(슐튀테)을 받았다.", "入学式の日、自分の背丈ほどのシュールテューテをもらった。", "First day of school — you get a gift cone (Schultüte) almost as tall as you."], [
  ["open", "🍬", ["바로 열어 본다", "すぐ開ける", "Open it right away"], { grade: "good", effects: { happy: 6 }, n: ["사탕, 연필, 작은 곰 인형. 첫날이 무섭지 않았다.", "飴、鉛筆、小さなクマのぬいぐるみ。初日が怖くなかった。", "Candy, pencils, a little teddy. The first day wasn't scary at all."] }],
  ["share", "🤝", ["옆자리 아이와 나눈다", "隣の子と分ける", "Share with the kid next to you"], { grade: "good", effects: { happy: 4, social: 4 }, n: ["그 아이와 4년 내내 짝이었다.", "その子とは四年間ずっと隣同士だった。", "We were seatmates for all four years."] }],
]);
W("de_weihnachtsmarkt", { country: ["DE", "FR"], age: [4, 95], emoji: "🎄", scene: "market" }, ["크리스마스 마켓", "クリスマスマーケット", "The Christmas Market"], ["광장에 크리스마스 마켓이 열렸다. 따뜻한 와인 냄새가 난다.", "広場にクリスマスマーケットが開かれた。ホットワインの香りがする。", "The Christmas market is open in the square. It smells of mulled wine."], [
  ["go", "🍷", ["친구들과 간다", "友達と行く", "Go with friends"], { grade: "good", effects: { happy: 5, social: 3, money: -15 }, n: ["컵을 기념품으로 가져왔다. 찬장에 그 컵이 해마다 늘었다.", "マグを記念に持ち帰った。棚にそのマグが毎年増えた。", "I kept the mug as a souvenir. My cupboard gained one every year."] }],
  ["craft", "🕯️", ["수공예품 가게에서 선물을 고른다", "手工芸の店で贈り物を選ぶ", "Pick gifts at the craft stalls"], { effects: { happy: 3, money: -25, social: 1 }, n: ["손으로 깎은 나무 장식을 가족에게 선물했다.", "手彫りの木の飾りを家族に贈った。", "I gave my family hand-carved wooden ornaments."] }],
]);
// ---------- 중국 ----------
S("cn_gaokao", { country: ["CN"], age: [17, 19], emoji: "📝", scene: "classroom", fromYear: 1977 }, ["가오카오", "高考", "The Gaokao"], ["6월 7일. 온 가족의 기대가 이틀짜리 시험에 걸려 있다.", "6月7日。家族全員の期待が二日間の試験にかかっている。", "June 7th. The whole family's hopes rest on a two-day exam."], exam(
  ["점수가 나오자 할머니가 동네에 자랑을 다니셨다.", "点数が出ると、祖母が近所中に自慢して回った。", "When the scores came out, Grandma went around bragging to the whole neighborhood."],
  ["무난한 점수였다. 다른 도시의 대학으로 가게 됐다.", "まずまずの点数だった。別の都市の大学へ行くことになった。", "A decent score. I'd be going to a university in another city."],
  ["기대보다 낮았다. 1년 더 하기로 했다.", "期待より低かった。もう一年やることにした。", "Lower than hoped. I decided to try again next year."]) );
W("cn_chunyun", { country: ["CN"], age: [18, 70], emoji: "🚄", scene: "airport", fromYear: 1980 }, ["춘절 귀성", "春運", "Going Home for Spring Festival"], ["춘절 기차표 전쟁이다. 몇 년째 고향에 못 갔다.", "春節の切符争奪戦だ。何年も故郷に帰っていない。", "The Spring Festival ticket war. You haven't been home in years."], [
  ["stand", "🎫", ["입석이라도 탄다", "立ち席でも乗る", "Take it even if it's standing room"], { grade: "good", effects: { happy: 6, health: -2, social: 2 }, n: ["열여섯 시간을 서서 갔다. 문을 열자 엄마가 만두를 빚고 있었다.", "十六時間立ちっぱなしで帰った。ドアを開けると母が餃子を包んでいた。", "Sixteen hours standing. I opened the door and Mom was folding dumplings."] }],
  ["video", "📱", ["영상 통화로 인사한다", "ビデオ通話で挨拶する", "Greet the family by video call"], { effects: { happy: 1, social: 1 }, n: ["화면 너머로 폭죽 소리가 들렸다.", "画面の向こうで爆竹の音が聞こえた。", "I heard firecrackers through the screen."] }],
]);
W("cn_hongbao", { country: ["CN"], age: [4, 90], emoji: "🧧", scene: "home" }, ["홍바오", "紅包", "Red Envelopes"], ["설날, 어른들이 붉은 봉투(홍바오)를 건넨다.", "春節、大人たちが紅包を手渡す。", "Spring Festival — elders hand out red envelopes."], [
  ["save", "🐷", ["모아서 저금한다", "集めて貯金する", "Save it all"], { grade: "good", effects: { money: 30, intel: 1 }, n: ["봉투는 버리지 않고 모아 두었다.", "封筒は捨てずに取っておいた。", "I kept every envelope."] }],
  ["give", "🧧", ["(어른이라면) 나도 아이들에게 준다", "(大人なら)自分も子どもたちに渡す", "(If grown) hand out envelopes yourself"], { effects: { social: 3, happy: 3, money: -30 }, n: ["조카들이 '감사합니다!'를 합창했다.", "甥や姪が「ありがとう!」を合唱した。", "My nieces and nephews chorused, 'Thank you!'"] }],
]);
W("cn_square_dance", { country: ["CN"], age: [50, 90], emoji: "💃", scene: "park", fromYear: 1990 }, ["광장 춤", "広場ダンス", "Square Dancing"], ["저녁마다 광장에서 음악에 맞춰 춤추는 이웃들이 함께하자고 한다.", "毎晩広場で音楽に合わせて踊る近所の人が一緒にと誘う。", "Every evening, neighbors dance in the square — and invite you to join."], [
  ["join", "🎵", ["맨 뒷줄에서 따라 한다", "最後列でまねする", "Join from the back row"], { grade: "good", effects: { health: 3, happy: 4, social: 3 }, n: ["석 달 뒤엔 맨 앞줄에 서 있었다.", "三か月後には最前列に立っていた。", "Three months later, I was front row."] }],
  ["watch", "🪑", ["벤치에서 구경한다", "ベンチで見る", "Watch from a bench"], { effects: { happy: 2 }, n: ["발끝이 저절로 박자를 탔다.", "つま先が自然とリズムを刻んだ。", "My toes tapped along on their own."] }],
]);
W("cn_city_move", { country: ["CN"], age: [17, 35], emoji: "🏙️", scene: "subway", fromYear: 1980, cond: (p) => ["sichuan", "yunnan", "harbin", "xian"].includes(p.region) }, ["대도시로", "大都市へ", "To the Big City"], ["친척이 남쪽 대도시 공장에 일자리가 있다고 한다.", "親戚が南の大都市の工場に仕事があると言う。", "A relative says there's factory work in a big southern city."], [
  ["go", "🎒", ["떠난다", "出ていく", "Go"], { grade: "good", effects: { money: 500, happy: -2, social: 2 }, flag: { add: "moved_city" }, n: ["기숙사 2층 침대 위에서 고향 사진을 붙였다.", "寮の二段ベッドの上に故郷の写真を貼った。", "I taped a photo of home above my dorm bunk."] }],
  ["stay", "🏡", ["고향에 남는다", "故郷に残る", "Stay home"], { effects: { happy: 2, money: -50 }, n: ["해마다 떠나는 친구들이 늘었다.", "毎年出ていく友達が増えた。", "More friends left every year."] }],
]);
// ---------- 인도 ----------
S("in_board", { country: ["IN"], age: [15, 18], emoji: "📚", scene: "classroom", fromYear: 1950 }, ["보드 시험", "ボード試験", "Board Exams"], ["12학년 보드 시험이다. 친척들이 벌써 점수를 물어본다.", "12年生のボード試験だ。親戚がもう点数を聞いてくる。", "Class 12 board exams. Relatives are already asking about your marks."], exam(
  ["90점이 넘었다. 사탕 상자가 온 동네에 돌았다.", "九十点を超えた。お菓子の箱が近所中に配られた。", "Over ninety percent. Boxes of sweets went around the whole neighborhood."],
  ["괜찮은 점수였다. 원하는 과에 들어갔다.", "まずまずの点数だった。希望の学科に入れた。", "Good enough marks. I got into the course I wanted."],
  ["점수가 낮았다. 엄마가 '괜찮아, 다시 하면 돼'라고 했다.", "点数が低かった。母が「大丈夫、またやればいい」と言った。", "Low marks. Mom said, 'It's okay, you can try again.'"]) );
W("in_diwali", { country: ["IN"], age: [4, 95], emoji: "🪔", scene: "home" }, ["디왈리", "ディワリ", "Diwali"], ["빛의 축제다. 집집마다 등잔을 켜고 단 과자를 나눈다.", "光の祭りだ。家々に灯明をともし、甘いお菓子を分け合う。", "The festival of lights. Every home lights lamps and shares sweets."], [
  ["light", "🪔", ["등잔을 줄지어 켠다", "灯明を並べて灯す", "Light rows of lamps"], { grade: "good", effects: { happy: 6, social: 2 }, n: ["골목 전체가 반짝였다. 옆집과 과자 상자를 바꿨다.", "路地全体が輝いた。隣の家とお菓子の箱を交換した。", "The whole lane sparkled. We swapped sweet boxes with the neighbors."] }],
  ["rangoli", "🎨", ["문 앞에 랑골리를 그린다", "玄関にランゴーリーを描く", "Draw a rangoli at the door"], { grade: "good", effects: { happy: 5, intel: 1 }, n: ["색 가루가 손톱 밑에 사흘 동안 남았다.", "色粉が三日間爪の間に残った。", "The colored powder stayed under my nails for three days."] }],
]);
W("in_cricket", { country: ["IN", "GB", "AU"], age: [6, 80], emoji: "🏏", scene: "field" }, ["골목 크리켓", "路地のクリケット", "Street Cricket"], ["골목에서 크리켓 시합이 열렸다. 타자가 한 명 모자라다.", "路地でクリケットの試合。打者が一人足りない。", "A street cricket match is on — they're one batter short."], [
  ["bat", "🏏", ["배트를 잡는다", "バットを握る", "Pick up the bat"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 6, social: 3, power: 1 }, n: ["공이 지붕을 넘어갔다. 아이들이 환호했다. 창문 하나도 깨졌다.", "ボールが屋根を越えた。子どもたちが歓声を上げた。窓も一枚割れた。", "The ball flew over a roof. Everyone cheered. A window broke too."] },
    { chance: 0.5, grade: "mid", effects: { happy: 2, social: 2 }, n: ["첫 공에 아웃됐다. 그래도 저녁까지 같이 놀았다.", "初球でアウト。それでも夕方まで一緒に遊んだ。", "Out on the first ball. Still played till dusk."] }] }],
  ["tv", "📺", ["국가대표 경기를 본다", "代表戦をテレビで見る", "Watch the national team on TV"], { effects: { happy: 4, social: 2 }, n: ["골목 전체가 한 텔레비전 앞에 모였다.", "路地中の人が一台のテレビの前に集まった。", "The whole lane crowded around one TV."] }],
]);
W("in_monsoon", { country: ["IN"], age: [5, 90], emoji: "🌧️", scene: "street" }, ["몬순", "モンスーン", "Monsoon"], ["첫 몬순 비가 쏟아졌다. 거리가 금세 강이 됐다.", "最初のモンスーンの雨が降り注いだ。通りがすぐに川になった。", "The first monsoon rains pour down. The streets become rivers."], [
  ["dance", "💃", ["빗속에서 뛰어논다", "雨の中で遊ぶ", "Play in the rain"], { grade: "good", effects: { happy: 6, health: -1 }, n: ["더위가 한 번에 씻겨 나갔다.", "暑さが一気に洗い流された。", "The heat washed away all at once."] }],
  ["chai", "☕", ["창가에서 짜이와 튀김을 먹는다", "窓辺でチャイと揚げ物", "Have chai and fritters by the window"], { grade: "good", effects: { happy: 5 }, n: ["빗소리가 가장 좋은 음악이었다.", "雨音が一番の音楽だった。", "The rain was the best music."] }],
]);
// ---------- 브라질 ----------
S("br_enem", { country: ["BR"], age: [17, 19], emoji: "📝", scene: "classroom", fromYear: 1998 }, ["ENEM", "ENEM", "The ENEM Exam"], ["전국 대입 시험 ENEM 날이다. 시험장 문이 닫히기 직전에 뛰어 들어간다.", "全国大学入試ENEMの日。試験会場の門が閉まる直前に駆け込む。", "ENEM day — you sprint through the gates just before they close."], exam(
  ["연방 대학 합격! 친구들이 날계란과 밀가루를 던졌다.", "連邦大学に合格!友達が卵と小麦粉を投げてきた。", "Into a federal university! My friends pelted me with eggs and flour."],
  ["사립 대학 장학금을 받았다.", "私立大学の奨学金をもらった。", "I got a scholarship to a private university."],
  ["점수가 모자랐다. 낮엔 일하고 밤엔 공부했다.", "点数が足りなかった。昼は働き夜は勉強した。", "Not enough points. I worked days and studied nights."]) );
W("br_carnaval", { country: ["BR"], age: [8, 85], emoji: "🎭", scene: "street" }, ["카니발", "カーニバル", "Carnaval"], ["카니발이 시작됐다. 동네 블로코(거리 행렬)가 지나간다.", "カーニバルが始まった。近所のブロコ(パレード)が通る。", "Carnaval begins. The neighborhood bloco parades past."], [
  ["dance", "🥁", ["의상을 입고 함께 춤춘다", "衣装を着て一緒に踊る", "Costume up and dance along"], { grade: "crit", effects: { happy: 8, social: 4, health: -1 }, n: ["나흘 동안 잠을 거의 안 잤다. 목은 쉬었고 마음은 가벼웠다.", "四日間ほとんど寝なかった。声は枯れ、心は軽かった。", "Barely slept for four days. Hoarse voice, light heart."] }],
  ["rest", "🏖️", ["조용한 바닷가로 피한다", "静かな海辺に避難する", "Escape to a quiet beach"], { effects: { happy: 4, health: 1 }, n: ["멀리서 북소리가 들렸다.", "遠くから太鼓の音が聞こえた。", "Distant drums carried over the water."] }],
]);
W("br_pelada", { country: ["BR"], age: [7, 70], emoji: "⚽", scene: "field" }, ["동네 축구(펠라다)", "草サッカー(ペラーダ)", "Street Football (Pelada)"], ["해 질 녘 공터에서 맨발 축구가 시작됐다.", "夕暮れの空き地で裸足のサッカーが始まった。", "Barefoot football starts on the empty lot at sunset."], [
  ["play", "🏃", ["뛰어든다", "飛び込む", "Jump in"], { grade: "good", effects: { happy: 6, health: 2, social: 3 }, n: ["발재간 좋은 꼬마에게 계속 공을 뺏겼다. 웃음이 멈추지 않았다.", "足技のうまい子どもに何度もボールを奪われた。笑いが止まらなかった。", "A kid with fancy footwork kept stealing the ball. I couldn't stop laughing."] }],
  ["cheer", "📣", ["담장에 앉아 응원한다", "塀に座って応援する", "Cheer from the wall"], { effects: { happy: 3, social: 1 }, n: ["골이 들어갈 때마다 함께 소리쳤다.", "ゴールのたびに一緒に叫んだ。", "I yelled along with every goal."] }],
]);
W("br_festa_junina", { country: ["BR"], age: [4, 90], emoji: "🌽", scene: "market" }, ["6월 축제", "六月祭り", "Festa Junina"], ["학교 마당에 6월 축제가 열렸다. 옥수수 요리와 시골풍 춤이 있다.", "校庭で六月祭りが開かれた。トウモロコシ料理と田舎風ダンスがある。", "Festa Junina in the schoolyard — corn treats and country-style dancing."], [
  ["quadrilha", "👒", ["콰드릴랴 춤을 춘다", "クアドリーリャを踊る", "Dance the quadrilha"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["밀짚모자를 쓰고 짝과 팔짱을 꼈다.", "麦わら帽子をかぶりパートナーと腕を組んだ。", "Straw hat on, arm in arm with my partner."] }],
  ["eat", "🍮", ["옥수수 푸딩을 먹는다", "トウモロコシのプディングを食べる", "Eat corn pudding"], { effects: { happy: 4 }, n: ["세 그릇째에서 멈췄다.", "三杯目で止めた。", "I stopped at the third bowl."] }],
]);
// ---------- 멕시코 ----------
S("mx_exam", { country: ["MX"], age: [17, 19], emoji: "📝", scene: "classroom", fromYear: 1950 }, ["대학 입학시험", "大学入学試験", "University Entrance Exam"], ["국립대 입학시험이다. 수만 명이 같은 날 시험을 본다.", "国立大学の入学試験。何万人もが同じ日に受ける。", "The national university entrance exam. Tens of thousands test on the same day."], exam(
  ["합격자 명단에 이름이 있었다. 할머니가 성당에 촛불을 켜러 가셨다.", "合格者名簿に名前があった。祖母が教会にろうそくを灯しに行った。", "My name was on the list. Grandma went to light a candle at church."],
  ["다른 캠퍼스에 배정됐다. 버스로 두 시간이었다.", "別のキャンパスに配属された。バスで二時間だった。", "Assigned to another campus. Two hours by bus."],
  ["떨어졌다. 다음 해에 다시 도전했다.", "落ちた。翌年また挑戦した。", "I didn't get in. I tried again the next year."]) );
W("mx_muertos", { country: ["MX"], age: [4, 95], emoji: "💀", scene: "home" }, ["망자의 날 제단", "死者の日の祭壇", "Day of the Dead Altar"], ["가족이 망자의 날 제단(오프렌다)을 차린다.", "家族が死者の日の祭壇(オフレンダ)を飾る。", "The family builds an ofrenda for the Day of the Dead."], [
  ["build", "🌼", ["금잔화와 사진으로 꾸민다", "マリーゴールドと写真で飾る", "Decorate with marigolds and photos"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["할아버지가 좋아하던 빵을 올렸다. 이야기가 밤늦게까지 이어졌다.", "祖父が好きだったパンを供えた。話は夜遅くまで続いた。", "We placed Grandpa's favorite bread. Stories ran late into the night."] }],
  ["cemetery", "🕯️", ["묘지에서 밤을 지새운다", "墓地で夜を明かす", "Keep vigil at the cemetery"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["촛불 수천 개가 언덕을 밝혔다. 슬프지 않았다.", "何千ものろうそくが丘を照らした。悲しくはなかった。", "Thousands of candles lit the hillside. It didn't feel sad."] }],
]);
W("mx_quince", { country: ["MX"], age: [15, 15], emoji: "👗", scene: "wedding", genderRequired: "F" }, ["킨세아녜라", "キンセアニェーラ", "Quinceañera"], ["열다섯 번째 생일 파티 준비가 한창이다.", "十五歳の誕生日パーティーの準備が進んでいる。", "Your fifteenth birthday celebration is being planned."], [
  ["big", "💃", ["드레스를 입고 성대하게", "ドレスを着て盛大に", "A big party with the dress"], { grade: "good", effects: { happy: 7, social: 4, money: -200 }, n: ["아빠와 왈츠를 출 때 하객들이 박수를 쳤다.", "父とワルツを踊ると招待客が拍手した。", "When I waltzed with Dad, the guests applauded."] }],
  ["trip", "✈️", ["파티 대신 여행", "パーティーの代わりに旅行", "A trip instead of a party"], { effects: { happy: 6, intel: 1, money: -150 }, flag: { add: "travel" }, n: ["처음 본 바다 앞에서 생일 케이크 대신 아이스크림을 먹었다.", "初めて見た海の前でケーキの代わりにアイスを食べた。", "Ice cream instead of cake, in front of the first ocean I'd ever seen."] }],
]);
W("mx_posadas", { country: ["MX"], age: [4, 90], emoji: "🪅", scene: "street" }, ["포사다", "ポサダ", "Las Posadas"], ["크리스마스 전 아흐레 동안 이웃들이 집집마다 노래하며 다닌다.", "クリスマス前の九日間、近所の人が家々を歌いながら回る。", "For nine nights before Christmas, neighbors go house to house singing."], [
  ["pinata", "🪅", ["피냐타를 깬다", "ピニャータを割る", "Take a swing at the piñata"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["눈가리개를 하고 세 번 헛스윙. 네 번째에 사탕이 쏟아졌다.", "目隠しで三回空振り。四回目にお菓子が降り注いだ。", "Blindfolded, three misses. The fourth swing rained candy."] }],
  ["sing", "🎶", ["행렬에서 노래한다", "行列で歌う", "Sing in the procession"], { effects: { happy: 4, social: 2 }, n: ["추운 밤이었지만 펀치가 따뜻했다.", "寒い夜だったが、ポンチェは温かかった。", "A cold night, but the warm punch helped."] }],
]);
// ---------- 이집트 ----------
S("eg_thanaweya", { country: ["EG"], age: [17, 18], emoji: "📝", scene: "classroom", fromYear: 1950 }, ["타나위야 아마", "タナウェイヤ・アンマ", "Thanaweya Amma"], ["고등학교 졸업 시험이다. 이 점수가 갈 수 있는 대학을 정한다.", "高校卒業試験。この点数で行ける大学が決まる。", "The secondary-school exam. Your score decides which universities you can attend."], exam(
  ["점수가 높아 원하던 학부에 들어갔다. 집에서 잔치가 열렸다.", "点数が高く希望の学部に入れた。家で祝宴が開かれた。", "High marks — into the faculty I wanted. We threw a feast at home."],
  ["괜찮은 학부에 배정됐다.", "まずまずの学部に配属された。", "Placed in a decent faculty."],
  ["점수가 모자랐다. 아버지가 '다음 해가 있다'고 했다.", "点数が足りなかった。父が「来年がある」と言った。", "Not enough. Father said, 'There's next year.'"]) );
W("eg_iftar", { country: ["EG"], age: [5, 95], emoji: "🌙", scene: "kitchen" }, ["라마단 이프타르", "ラマダンのイフタール", "Ramadan Iftar"], ["해가 진다. 동네 사람들이 길에 긴 식탁을 펴고 함께 금식을 깬다.", "日が沈む。近所の人が通りに長い食卓を広げ、一緒に断食を明ける。", "The sun sets. Neighbors set up long tables in the street to break the fast together."], [
  ["table", "🍽️", ["거리 식탁에 함께 앉는다", "通りの食卓に一緒に座る", "Join the street table"], { grade: "good", effects: { happy: 6, social: 4 }, n: ["처음 보는 사람이 대추야자를 건넸다.", "初めて会う人がナツメヤシを差し出した。", "A stranger offered me dates."] }],
  ["cook", "🍲", ["음식을 만들어 나눈다", "料理を作って分ける", "Cook and share food"], { grade: "good", effects: { happy: 5, social: 3, money: -20 }, n: ["냄비가 빈 채로 돌아왔다. 그게 칭찬이었다.", "鍋が空になって戻ってきた。それが褒め言葉だった。", "The pot came back empty — the highest compliment."] }],
]);
W("eg_nile", { country: ["EG"], age: [10, 85], emoji: "⛵", scene: "river" }, ["나일강의 돛단배", "ナイル川の帆船", "A Felucca on the Nile"], ["친구들이 해 질 녘 나일강에서 돛단배(펠루카)를 타자고 한다.", "友達が夕暮れのナイル川でフェルーカに乗ろうと誘う。", "Friends suggest a sunset felucca ride on the Nile."], [
  ["sail", "⛵", ["탄다", "乗る", "Sail"], { grade: "good", effects: { happy: 6, social: 3, money: -10 }, n: ["물 위에서 도시 불빛이 하나둘 켜졌다.", "水の上から街の灯りが一つずつ灯っていった。", "From the water, the city lights flickered on one by one."] }],
  ["bank", "🌅", ["강가에서 차를 마신다", "川辺でお茶を飲む", "Have tea on the bank"], { effects: { happy: 4 }, n: ["민트 차가 달았다.", "ミントティーが甘かった。", "The mint tea was sweet."] }],
]);
W("eg_dig", { country: ["EG"], age: [18, 70], emoji: "🏺", scene: "lab" }, ["발굴 현장", "発掘現場", "The Dig Site"], ["룩소르 근처 발굴단이 현지 일손을 구한다.", "ルクソール近くの発掘隊が地元の働き手を募集している。", "An excavation team near Luxor is hiring local hands."], [
  ["join", "⛏️", ["참여한다", "参加する", "Join"], { grade: "good", effects: { money: 150, intel: 3, health: -1 }, n: ["모래 속에서 3천 년 전 항아리 조각을 직접 꺼냈다.", "砂の中から三千年前の壺のかけらを自分の手で取り出した。", "I pulled a 3,000-year-old pottery shard from the sand with my own hands."] }],
  ["no", "🏠", ["더위가 무섭다", "暑さが怖い", "Too hot"], { effects: { happy: 1 }, n: ["대신 박물관에 가서 그 항아리를 봤다.", "代わりに博物館でその壺を見た。", "I saw the finds at the museum instead."] }],
]);
// ---------- 호주 ----------
S("au_atar", { country: ["AU"], age: [17, 18], emoji: "📝", scene: "classroom", fromYear: 2009 }, ["ATAR 점수", "ATARスコア", "ATAR Results"], ["12학년 마지막 시험 결과, ATAR 점수가 나오는 날이다.", "12年生最後の試験結果、ATARスコアが出る日だ。", "Results day: your Year 12 ATAR score comes out."], exam(
  ["원하던 대학 과정 점수를 넘겼다. 해변에서 친구들과 소리를 질렀다.", "希望の大学課程の点数を超えた。ビーチで友達と叫んだ。", "Beat the cutoff for my course. We screamed on the beach."],
  ["두 번째 선택 과정에 들어갔다. 나쁘지 않았다.", "第二希望の課程に入った。悪くなかった。", "Got my second-choice course. Not bad."],
  ["낮게 나왔다. 기술 학교(TAFE)로 방향을 틀었다.", "低かった。職業学校(TAFE)へ方向転換した。", "Low score. I switched direction to TAFE."]) );
W("au_xmas_beach", { country: ["AU"], age: [4, 90], emoji: "🎄", scene: "beach" }, ["한여름 크리스마스", "真夏のクリスマス", "A Summer Christmas"], ["크리스마스인데 기온이 35도다. 가족이 해변 바비큐를 계획한다.", "クリスマスなのに気温35度。家族がビーチでバーベキューを計画する。", "It's Christmas and 35°C. The family plans a beach barbecue."], [
  ["bbq", "🍤", ["새우를 굽는다", "エビを焼く", "Throw shrimp on the barbie"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["산타 모자를 쓴 채 바다에 뛰어들었다.", "サンタ帽をかぶったまま海に飛び込んだ。", "I ran into the sea still wearing a Santa hat."] }],
  ["cricket", "🏏", ["해변 크리켓", "ビーチクリケット", "Beach cricket"], { effects: { happy: 5, health: 1 }, n: ["삼촌이 공을 바다로 날렸다. 다 같이 주우러 뛰어갔다.", "叔父がボールを海に飛ばした。みんなで拾いに走った。", "My uncle hit the ball into the sea. We all ran to fetch it."] }],
]);
W("au_bushfire_volunteer", { country: ["AU"], age: [18, 65], emoji: "🚒", scene: "countryside", fromYear: 1950 }, ["소방 자원봉사", "消防ボランティア", "Volunteer Firefighting"], ["마을 소방 자원봉사대에서 대원을 모집한다.", "地域の消防ボランティア隊が隊員を募集している。", "The local volunteer fire brigade is recruiting."], [
  ["join", "🧯", ["훈련받고 들어간다", "訓練を受けて入る", "Train and join"], { grade: "good", effects: { social: 4, power: 3, happy: 3 }, flag: { add: "fire_volunteer" }, n: ["첫 출동은 작은 풀불이었다. 마을 사람들이 샌드위치를 들고 나왔다.", "初出動は小さな草火事だった。町の人がサンドイッチを持ってきた。", "My first callout was a small grass fire. Townsfolk brought sandwiches."] }],
  ["donate", "💝", ["후원만 한다", "寄付だけする", "Donate instead"], { effects: { money: -30, happy: 2 }, n: ["소방서 게시판에 이름이 올랐다.", "消防署の掲示板に名前が載った。", "My name went up on the station's board."] }],
]);
W("au_surf", { country: ["AU"], age: [8, 70], emoji: "🏄", scene: "beach" }, ["첫 서핑", "初サーフィン", "First Surf"], ["동네 해변에서 서핑 강습이 열렸다.", "近所のビーチでサーフィン教室が開かれた。", "A surf lesson is happening at the local beach."], [
  ["try", "🌊", ["보드에 오른다", "ボードに乗る", "Get on the board"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 8, health: 2 }, flag: { add: "surfer" }, n: ["세 번째 파도에 일어섰다. 2초였지만 영원 같았다.", "三本目の波で立てた。二秒だったが永遠のようだった。", "Stood up on the third wave. Two seconds that felt like forever."] },
    { chance: 0.5, grade: "mid", effects: { happy: 3, health: 1 }, n: ["바닷물을 한 바가지 마셨다. 그래도 또 하고 싶었다.", "海水をたっぷり飲んだ。それでもまたやりたかった。", "Swallowed half the ocean. Still wanted to go again."] }] }],
  ["watch", "🏖️", ["모래사장에서 구경한다", "砂浜で見る", "Watch from the sand"], { effects: { happy: 2 }, n: ["선크림을 두 번 덧발랐다.", "日焼け止めを二度塗り直した。", "Reapplied sunscreen twice."] }],
]);
// ---------- 한국 (더) ----------
W("kr_kimjang", { country: ["KR"], age: [6, 90], emoji: "🥬", scene: "kitchen" }, ["김장", "キムジャン", "Kimchi-Making Day"], ["겨울을 앞두고 온 가족이 모여 김장을 한다. 배추가 백 포기다.", "冬を前に家族総出でキムジャン。白菜が百株。", "Before winter, the whole family gathers to make kimchi. A hundred cabbages."], [
  ["help", "🧤", ["고무장갑을 끼고 돕는다", "ゴム手袋をして手伝う", "Glove up and help"], { grade: "good", effects: { happy: 4, social: 3, health: -1 }, n: ["보쌈을 먹으며 허리를 폈다. 김치통이 집집마다 나뉘었다.", "ポッサムを食べながら腰を伸ばした。キムチは家ごとに分けられた。", "We straightened our backs over boiled pork. The kimchi went home to every household."] }],
  ["taste", "😋", ["맛 보는 담당", "味見担当", "Be the official taster"], { effects: { happy: 3 }, n: ["'간이 딱 좋다'는 말 한마디로 일을 다 한 셈이었다.", "「塩加減ちょうどいい」の一言で仕事は終わったようなものだった。", "'Perfectly seasoned' — and that was my whole contribution."] }],
]);
W("kr_school_trip", { country: ["KR", "JP"], age: [15, 17], emoji: "🚌", scene: "abroad", area: "school" }, ["수학여행", "修学旅行", "The School Trip"], ["수학여행 버스에 탔다. 밤에 몰래 다른 방에 놀러 갈 계획이 있다.", "修学旅行のバスに乗った。夜こっそり他の部屋に遊びに行く計画がある。", "You're on the school trip bus. There's a plan to sneak into another room at night."], [
  ["sneak", "🤫", ["몰래 간다", "こっそり行く", "Sneak over"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 7, social: 4 }, n: ["새벽까지 무서운 이야기를 했다. 평생 기억에 남는 밤이었다.", "明け方まで怖い話をした。一生忘れられない夜だった。", "Ghost stories till dawn. A night I'd never forget."] },
    { chance: 0.5, grade: "mid", effects: { happy: 2, social: 3 }, n: ["선생님에게 걸려 복도에 서 있었다. 그것도 추억이 됐다.", "先生に見つかって廊下に立たされた。それも思い出になった。", "Caught by a teacher and made to stand in the hall. Also a memory now."] }] }],
  ["sleep", "😴", ["얌전히 잔다", "おとなしく寝る", "Go to sleep like a good kid"], { effects: { health: 1, happy: 1 }, n: ["다음 날 다른 애들 이야기를 들으며 조금 아쉬웠다.", "翌日、他の子の話を聞いて少し残念だった。", "Hearing everyone's stories the next day, I felt a little left out."] }],
]);

export const WORLD_COUNTRY_EVENTS = EV;
