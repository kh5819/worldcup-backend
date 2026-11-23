// =========================
// 플듀 인생게임 REBORN — 사건 3차: 건강·생활 (2026-11-23)
// 병·사고는 담담하게 (선정적 묘사 없음). 형식: life-ev-kit.js 의 ev()
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const H = (id, meta, title, desc, choices) => EV.push(ev("hl_" + id, { area: "health", ...meta }, title, desc, choices));

// ---------- 어린 시절·10대 ----------
H("chickenpox", { age: [3, 9], emoji: "🤒", scene: "kidroom" }, ["수두", "水ぼうそう", "Chickenpox"], ["온몸에 빨간 점이 돋았다. 너무 가렵다.", "体中に赤い発疹が出た。とてもかゆい。", "Red spots all over. So itchy."], [
  ["endure", "🧤", ["장갑을 끼고 참는다", "手袋をして我慢する", "Wear mittens and resist"], { grade: "good", effects: { health: 2, power: 1 }, n: ["흉터 하나 없이 나았다. 엄마가 대견해했다.", "跡ひとつなく治った。母が感心した。", "Healed without a single scar. Mom was proud."] }],
  ["scratch", "😖", ["몰래 긁는다", "こっそりかく", "Scratch secretly"], { effects: { health: -1, happy: 1 }, n: ["이마에 작은 자국이 남았다. 거울 볼 때마다 그 여름이 생각났다.", "額に小さな跡が残った。鏡を見るたびにあの夏を思い出した。", "A tiny mark stayed on my forehead. Every mirror reminded me of that summer."] }],
]);
H("glasses", { age: [7, 16], emoji: "👓", scene: "classroom" }, ["칠판 글씨가 흐리다", "黒板の字がぼやける", "The Blackboard Looks Blurry"], ["뒷자리에서 칠판 글씨가 안 보이기 시작했다.", "後ろの席から黒板の字が見えなくなってきた。", "From the back row, you can't read the board anymore."], [
  ["exam", "🏥", ["안과에 간다", "眼科に行く", "Go to the eye doctor"], { grade: "good", effects: { intel: 2, health: 1, money: -15 }, flag: { add: "glasses" }, n: ["안경을 쓰니 나뭇잎 하나하나가 보였다. 세상이 이렇게 선명했구나.", "眼鏡をかけたら葉っぱ一枚一枚が見えた。世界はこんなにくっきりしていたのか。", "With glasses, I could see every single leaf. The world was this sharp?"] }],
  ["squint", "😑", ["앞자리로 옮겨 달라고 한다", "前の席に替えてもらう", "Ask to move to the front"], { effects: { intel: 1 }, n: ["1년쯤 버티다 결국 안경을 썼다.", "一年ほど粘ったが結局眼鏡をかけた。", "I lasted about a year, then got glasses anyway."] }],
]);
H("broken_arm", { age: [6, 15], emoji: "🩹", scene: "hospital" }, ["팔에 깁스", "腕のギプス", "A Cast on Your Arm"], ["놀이터에서 떨어져 팔이 부러졌다. 6주 깁스.", "遊具から落ちて腕を骨折。ギプス6週間。", "You fell off the playground and broke your arm. Six weeks in a cast."], [
  ["sign", "🖊️", ["친구들에게 깁스에 낙서를 받는다", "友達にギプスに落書きしてもらう", "Get friends to sign the cast"], { grade: "good", effects: { social: 4, happy: 2 }, n: ["깁스는 반 전체의 사인으로 가득 찼다. 벗을 때 아까웠다.", "ギプスはクラス全員のサインで埋まった。外すのが惜しかった。", "The whole class signed it. I was sad to take it off."] }],
  ["left", "✍️", ["왼손으로 글씨 연습", "左手で字の練習", "Practice writing left-handed"], { effects: { intel: 2, power: 1 }, n: ["양손잡이가 됐다. 어른이 돼서도 쓸모가 있었다.", "両利きになった。大人になっても役に立った。", "I became ambidextrous. It stayed useful into adulthood."] }],
]);
H("dentist", { age: [6, 14], emoji: "🦷", scene: "clinic" }, ["충치", "虫歯", "A Cavity"], ["이가 시큰거린다. 사탕을 너무 먹었나 보다.", "歯がしみる。飴を食べすぎたらしい。", "Your tooth aches. Maybe too much candy."], [
  ["go", "🪥", ["치과에 간다", "歯医者に行く", "Go to the dentist"], { grade: "good", effects: { health: 2, happy: -2, money: -20 }, flag: { add: "good_teeth" }, n: ["윙윙 소리가 무서웠지만 그 뒤로 양치를 열심히 했다.", "ウィーンという音が怖かったが、それから歯磨きを頑張った。", "The whirring was scary, but I brushed diligently after that."] }],
  ["hide", "🍬", ["숨긴다", "隠す", "Hide it"], { grade: "bad", effects: { health: -3, happy: -2 }, n: ["볼이 퉁퉁 부어서야 들켰다.", "頬がぱんぱんに腫れてやっとばれた。", "Only when my cheek swelled up did anyone find out."] }],
]);
H("teen_sleep", { age: [13, 19], emoji: "🌙", scene: "kidroom" }, ["새벽 두 시", "午前二時", "2 A.M."], ["또 새벽 두 시다. 내일 1교시 시험이다.", "また午前二時だ。明日は一時間目にテストがある。", "It's 2 a.m. again. There's a test first period tomorrow."], [
  ["sleep", "😴", ["지금이라도 잔다", "今からでも寝る", "Go to sleep now"], { grade: "good", effects: { health: 2, intel: 1 }, n: ["머리가 맑았다. 생각보다 시험을 잘 봤다.", "頭がすっきりしていた。思ったよりテストができた。", "My head was clear. The test went better than expected."] }],
  ["more", "📱", ["조금만 더 본다", "もう少しだけ見る", "Just a bit more scrolling"], { grade: "bad", effects: { health: -2, intel: -1, happy: 1 }, n: ["1교시 내내 졸았다.", "一時間目ずっと居眠りした。", "I nodded off through all of first period."] }],
]);
H("diet_teen", { age: [13, 20], emoji: "🥗", scene: "kitchen" }, ["거울 앞에서", "鏡の前で", "In Front of the Mirror"], ["거울 속 내 모습이 마음에 안 든다. 굶어서라도 빼고 싶다.", "鏡に映る自分が気に入らない。食べなくてもいいから痩せたい。", "You don't like what you see in the mirror. You want to starve the weight off."], [
  ["healthy", "🏃", ["운동과 식단으로 천천히", "運動と食事でゆっくり", "Slowly, with exercise and good food"], { grade: "good", effects: { health: 4, happy: 3, power: 2 }, n: ["숫자보다 계단 오를 때 숨이 덜 차는 게 좋았다.", "数字より、階段で息が切れなくなったのが嬉しかった。", "Better than the number on the scale: stairs stopped winding me."] }],
  ["starve", "🚫", ["굶는다", "食べない", "Skip meals"], { grade: "bad", effects: { health: -6, happy: -3 }, n: ["체육 시간에 어지러워 주저앉았다. 그날 엄마와 오래 이야기했다.", "体育の時間にめまいで座り込んだ。その日母と長く話した。", "I got dizzy in gym class and sat down hard. Mom and I talked for a long time that night."] }],
  ["accept", "🪞", ["지금 모습도 괜찮다고 생각해 본다", "今の自分も悪くないと思ってみる", "Decide this body is fine"], { grade: "good", effects: { happy: 5 }, n: ["거울에 대고 웃어 봤다. 생각보다 괜찮았다.", "鏡に向かって笑ってみた。思ったより悪くなかった。", "I smiled at the mirror. Not bad at all."] }],
]);
H("sports_injury", { age: [14, 35], emoji: "🦵", scene: "field" }, ["무릎 부상", "膝のけが", "A Knee Injury"], ["운동하다 무릎이 꺾였다. 의사가 쉬라고 한다.", "運動中に膝をひねった。医者は休めと言う。", "You twisted your knee playing sports. The doctor says rest."], [
  ["rest", "🛋️", ["재활을 제대로 받는다", "リハビリをきちんと受ける", "Do proper rehab"], { grade: "good", effects: { health: 3, power: -1 }, n: ["석 달이 걸렸지만 무릎은 다시 튼튼해졌다.", "三か月かかったが膝はまた丈夫になった。", "Three months, but the knee came back strong."] }],
  ["play", "⚽", ["대회가 코앞이라 뛴다", "大会が近いので出場する", "Play anyway — the tournament's soon"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { happy: 6, social: 3 }, n: ["이겼다. 무릎은 버텨 주었다.", "勝った。膝は持ちこたえてくれた。", "We won. The knee held."] },
    { chance: 0.6, grade: "bad", effects: { health: -8, happy: -4 }, flag: { add: "bad_knee" }, n: ["더 크게 다쳤다. 비 오는 날마다 무릎이 쑤셨다.", "さらにひどく痛めた。雨の日はいつも膝がうずいた。", "I hurt it worse. It ached on every rainy day after."] }] }],
]);
// ---------- 청년·직장인 ----------
H("first_hangover", { age: [19, 30], emoji: "🥴", scene: "home" }, ["첫 숙취", "初めての二日酔い", "Your First Hangover"], ["눈을 떴는데 천장이 돈다. 어젯밤 기억이 반밖에 없다.", "目を覚ますと天井が回っている。昨夜の記憶が半分しかない。", "You wake up and the ceiling is spinning. You remember half of last night."], [
  ["learn", "💧", ["물을 마시며 다짐한다", "水を飲みながら誓う", "Drink water and make a vow"], { grade: "good", effects: { health: 1, intel: 1 }, flag: { add: "knows_limit" }, n: ["내 주량을 알게 됐다. 그 뒤로는 반 병에서 멈췄다.", "自分の酒量を知った。それ以降は半分で止めた。", "I learned my limit. After that, I stopped halfway."] }],
  ["again", "🍻", ["해장술로 이긴다", "迎え酒で乗り切る", "Fight it with more drinking"], { grade: "bad", effects: { health: -3, happy: 1 }, n: ["이틀을 날렸다.", "二日を棒に振った。", "I lost two days."] }],
]);
H("smoking", { age: [16, 40], emoji: "🚬", scene: "street" }, ["담배 한 대", "タバコ一本", "One Cigarette"], ["친구가 담배를 건넨다. '한 대만 펴 봐.'", "友達がタバコを差し出す。「一本だけ吸ってみなよ」", "A friend offers a cigarette. 'Just try one.'"], [
  ["no", "🙅", ["거절한다", "断る", "Say no"], { grade: "good", effects: { health: 2 }, n: ["몇 년 뒤 그 친구는 금연 패치를 붙이며 나를 부러워했다.", "数年後、その友は禁煙パッチを貼りながら私を羨ましがった。", "Years later, that friend envied me while wearing a nicotine patch."] }],
  ["try", "😶‍🌫️", ["한 대만 핀다", "一本だけ吸う", "Try just one"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: { health: -1 }, n: ["기침만 했다. 그걸로 끝이었다.", "咳き込んだだけ。それで終わった。", "I just coughed. That was the end of it."] },
    { chance: 0.4, grade: "bad", effects: { health: -4, money: -100 }, flag: { add: "smoker" }, n: ["한 대가 한 갑이 됐다.", "一本が一箱になった。", "One became a whole pack."], next: { id: "hl_quit_smoking", after: 12 } }] }],
]);
H("quit_smoking", { followup: true, emoji: "🚭", scene: "clinic" }, ["금연", "禁煙", "Quitting"], ["계단 두 층에 숨이 찬다. 의사가 담배를 끊으라고 한다.", "階段二階分で息が切れる。医者に禁煙を勧められた。", "Two flights of stairs leave you breathless. The doctor says quit."], [
  ["quit", "💪", ["끊는다", "やめる", "Quit"], { outcomes: [
    { chance: 0.55, grade: "crit", effects: { health: 8, happy: 3, money: 200 }, flag: { remove: "smoker" }, n: ["석 달째부터 음식 맛이 달라졌다. 아낀 돈으로 여행을 갔다.", "三か月目から食べ物の味が変わった。浮いたお金で旅行に行った。", "By month three, food tasted different. I spent the savings on a trip."] },
    { chance: 0.45, grade: "mid", effects: { health: 2, happy: -2 }, n: ["두 번 실패하고 세 번째에 겨우 줄였다.", "二度失敗し、三度目にやっと減らせた。", "Failed twice; cut down on the third try."] }] }],
  ["later", "🚬", ["나중에", "またあとで", "Later"], { grade: "bad", effects: { health: -4 }, n: ["'나중에'는 오지 않았다.", "「あとで」は来なかった。", "'Later' never came."] }],
]);
H("burnout_body", { age: [25, 55], emoji: "🫠", scene: "office", cond: (p) => !!p.job }, ["몸이 보내는 신호", "体からのサイン", "Your Body Sends a Warning"], ["두통이 2주째다. 회의 중에 손이 떨렸다.", "頭痛が二週間続いている。会議中に手が震えた。", "Two weeks of headaches. Your hand shook during a meeting."], [
  ["leave", "🌴", ["휴가를 낸다", "休暇を取る", "Take time off"], { grade: "good", effects: { health: 5, happy: 4, money: -100 }, n: ["일주일을 바다만 보며 보냈다. 두통이 사라졌다.", "一週間海だけを見て過ごした。頭痛が消えた。", "I spent a week just looking at the sea. The headaches vanished."] }],
  ["push", "☕", ["커피로 버틴다", "コーヒーで耐える", "Push through with coffee"], { grade: "bad", effects: { health: -6, happy: -3 }, n: ["결국 응급실에서 링거를 맞았다. 그제야 쉬었다.", "結局救急室で点滴を受けた。やっと休んだ。", "I ended up on an IV in the ER. Only then did I rest."] }],
]);
H("gym_join", { age: [20, 60], emoji: "🏋️", scene: "gym", fromYear: 1985 }, ["헬스장 1년 등록", "ジム一年契約", "A One-Year Gym Membership"], ["1년 등록하면 반값이라고 한다. 이번엔 진짜 다닐 것 같다.", "一年契約なら半額だという。今度こそ通えそうだ。", "Half price if you sign up for a year. This time you'll really go."], [
  ["go", "💪", ["등록하고 매일 간다", "契約して毎日行く", "Sign up and go daily"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { health: 6, power: 5, happy: 4, money: -60 }, flag: { add: "gym_habit" }, n: ["1년 뒤 사진을 비교했다. 다른 사람 같았다.", "一年後に写真を比べた。別人のようだった。", "A year later I compared photos. A different person."] },
    { chance: 0.6, grade: "mid", effects: { health: 1, money: -60, happy: -1 }, n: ["석 달 다니고 기부 회원이 됐다.", "三か月通って、あとは寄付会員になった。", "Three months in, I became a 'donor member.'"] }] }],
  ["walk", "🚶", ["돈 안 드는 걷기부터", "お金のかからない散歩から", "Start with free walking"], { grade: "good", effects: { health: 3, happy: 2 }, n: ["매일 저녁 만 보. 동네 고양이들과 친해졌다.", "毎晩一万歩。近所の猫と仲良くなった。", "Ten thousand steps every evening. I befriended the neighborhood cats."] }],
]);
H("checkup_30", { age: [30, 45], emoji: "📋", scene: "hospital" }, ["건강검진 결과", "健康診断の結果", "Checkup Results"], ["검진 결과지에 빨간 글씨가 세 줄 있다. '재검 요망'.", "健診結果に赤字が三行。「要再検査」。", "Three lines in red on your checkup report: 'Retest recommended.'"], [
  ["retest", "🔬", ["바로 재검사를 받는다", "すぐ再検査を受ける", "Get retested right away"], { outcomes: [
    { chance: 0.75, grade: "good", effects: { health: 3, happy: 3 }, n: ["별거 아니었다. 대신 생활 습관을 고치라는 숙제를 받았다.", "大したことはなかった。代わりに生活習慣を直す宿題をもらった。", "Nothing serious. I got homework instead: fix my habits."] },
    { chance: 0.25, grade: "mid", effects: { health: 2, happy: -3, money: -150 }, flag: { add: "early_catch" }, n: ["초기에 발견했다. 의사가 '일찍 와서 다행'이라고 했다.", "早期に見つかった。医者が「早く来てよかった」と言った。", "Caught early. The doctor said, 'Good thing you came in.'"] }] }],
  ["ignore", "🙈", ["바빠서 미룬다", "忙しくて後回しにする", "Too busy, put it off"], { grade: "bad", effects: { health: -4 }, n: ["다음 해 결과지엔 빨간 줄이 다섯 개였다.", "翌年の結果には赤字が五行になっていた。", "The next year's report had five red lines."] }],
]);
H("back_pain", { age: [28, 70], emoji: "🪑", scene: "office" }, ["허리 통증", "腰痛", "Back Pain"], ["의자에 오래 앉아 있었더니 허리가 끊어질 것 같다.", "長く座っていたら腰が割れそうだ。", "Hours in a chair, and your back feels like it might snap."], [
  ["stretch", "🧘", ["매시간 스트레칭한다", "毎時間ストレッチする", "Stretch every hour"], { grade: "good", effects: { health: 4, happy: 1 }, n: ["알람을 맞춰 두고 일어났다. 동료들도 따라 했다.", "アラームをセットして立ち上がった。同僚も真似をした。", "I set an alarm to stand up. My coworkers copied me."] }],
  ["chair", "💺", ["좋은 의자를 산다", "いい椅子を買う", "Buy a good chair"], { effects: { health: 2, money: -80 }, n: ["의자가 비쌌지만 허리는 고마워했다.", "椅子は高かったが腰は感謝した。", "Expensive chair, grateful back."] }],
  ["pills", "💊", ["진통제로 넘긴다", "鎮痛剤でやり過ごす", "Just take painkillers"], { grade: "bad", effects: { health: -2 }, n: ["약 기운이 떨어지면 다시 아팠다.", "薬が切れるとまた痛んだ。", "When the pills wore off, it hurt again."] }],
]);
H("insomnia", { age: [25, 80], emoji: "🌚", scene: "home" }, ["잠 못 드는 밤", "眠れない夜", "Sleepless Nights"], ["몇 주째 잠이 안 온다. 누우면 생각이 꼬리를 문다.", "何週間も眠れない。横になると考えが止まらない。", "Weeks of insomnia. Lie down and the thoughts won't stop."], [
  ["routine", "🛏️", ["휴대폰을 끄고 일정한 시간에 눕는다", "スマホを切って決まった時間に寝る", "Phone off, same bedtime every night"], { grade: "good", effects: { health: 4, happy: 2 }, n: ["2주가 걸렸지만 다시 잠들 수 있었다.", "二週間かかったが、また眠れるようになった。", "Two weeks, but I could sleep again."] }],
  ["doctor", "🩺", ["병원에서 상담받는다", "病院で相談する", "See a doctor"], { grade: "good", effects: { health: 3, happy: 3, money: -50 }, n: ["잠이 안 오는 이유는 잠이 아니었다. 이야기하니 조금 가벼워졌다.", "眠れない理由は睡眠ではなかった。話すと少し軽くなった。", "The problem wasn't sleep. Talking about it lightened things."] }],
  ["drink", "🍷", ["술 한잔으로 잔다", "寝酒で眠る", "Drink to fall asleep"], { grade: "bad", effects: { health: -3 }, n: ["잠은 들었지만 새벽마다 깼다.", "眠れはしたが、毎朝早く目が覚めた。", "I fell asleep, but woke at dawn every time."] }],
]);
H("counseling", { age: [18, 80], emoji: "🛋️", scene: "clinic" }, ["마음이 무거운 날들", "心が重い日々", "Heavy Days"], ["아무것도 하기 싫은 날이 한 달째 이어진다.", "何もしたくない日が一か月続いている。", "A month of days when you don't want to do anything."], [
  ["talk", "🗣️", ["상담을 받아 본다", "カウンセリングを受けてみる", "Try counseling"], { grade: "crit", effects: { happy: 7, health: 3, money: -80 }, flag: { add: "therapy" }, n: ["처음엔 무슨 말을 해야 할지 몰랐다. 여섯 번째 시간에 처음으로 울었다. 그리고 나아지기 시작했다.", "最初は何を話せばいいか分からなかった。六回目で初めて泣いた。そして良くなり始めた。", "At first I didn't know what to say. In session six I cried for the first time. Then things started to improve."] }],
  ["friend", "📞", ["친구에게 털어놓는다", "友に打ち明ける", "Open up to a friend"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["친구는 아무 말 없이 들어 줬다. 그게 필요했다.", "友は何も言わず聞いてくれた。それが必要だった。", "My friend just listened. That's what I needed."] }],
  ["alone", "🌧️", ["혼자 견딘다", "一人で耐える", "Endure it alone"], { grade: "bad", effects: { happy: -5, health: -2 }, n: ["봄이 오고서야 조금씩 괜찮아졌다.", "春が来てやっと少しずつ楽になった。", "Only when spring came did it slowly ease."] }],
]);
H("food_poison", { age: [10, 80], emoji: "🤢", scene: "restaurant" }, ["식중독", "食中毒", "Food Poisoning"], ["어제 먹은 회가 문제였던 것 같다. 밤새 화장실을 오갔다.", "昨日食べた刺身が原因らしい。一晩中トイレを往復した。", "Yesterday's raw fish was a mistake. You spent the night in the bathroom."], [
  ["rest", "🫖", ["죽만 먹고 쉰다", "おかゆだけ食べて休む", "Rest and eat only porridge"], { grade: "good", effects: { health: 1 }, n: ["사흘 만에 회복했다. 그 가게는 다시 가지 않았다.", "三日で回復した。あの店には二度と行かなかった。", "Recovered in three days. Never went back to that place."] }],
  ["work", "💼", ["그래도 출근한다", "それでも出勤する", "Go to work anyway"], { grade: "bad", effects: { health: -4, social: -1 }, n: ["회의 도중 세 번 자리를 떴다.", "会議中に三回席を立った。", "I left the meeting three times."] }],
]);
H("allergy", { age: [8, 60], emoji: "🤧", scene: "park" }, ["갑자기 생긴 알레르기", "突然のアレルギー", "A Sudden Allergy"], ["봄만 되면 눈이 가렵고 재채기가 멈추지 않는다.", "春になると目がかゆくてくしゃみが止まらない。", "Every spring, itchy eyes and endless sneezing."], [
  ["test", "🧪", ["알레르기 검사를 받는다", "アレルギー検査を受ける", "Get an allergy test"], { grade: "good", effects: { health: 3, money: -30 }, n: ["범인은 꽃가루였다. 약을 먹으니 봄이 다시 좋아졌다.", "犯人は花粉だった。薬を飲むと春がまた好きになった。", "Pollen was the culprit. With medicine, I loved spring again."] }],
  ["mask", "😷", ["마스크로 버틴다", "マスクで耐える", "Get by with a mask"], { effects: { health: 1, happy: -1 }, n: ["봄 사진에는 늘 마스크를 쓴 내가 있었다.", "春の写真にはいつもマスク姿の自分がいた。", "In every spring photo, I'm wearing a mask."] }],
]);
H("car_accident", { age: [20, 75], emoji: "🚗", scene: "street", fromYear: 1960 }, ["접촉 사고", "接触事故", "A Fender Bender"], ["신호 대기 중에 뒤차가 들이받았다. 목이 뻐근하다.", "信号待ちで後ろの車に追突された。首がこわばる。", "Rear-ended at a red light. Your neck feels stiff."], [
  ["hospital", "🏥", ["병원에서 검사받는다", "病院で検査を受ける", "Get checked at a hospital"], { grade: "good", effects: { health: 2, money: 100 }, n: ["가벼운 염좌였다. 보험 처리도 깔끔했다.", "軽い捻挫だった。保険の手続きもすっきりした。", "Just a mild sprain. Insurance handled everything."] }],
  ["ok", "🙂", ["괜찮다며 그냥 보낸다", "大丈夫だとそのまま帰す", "Say you're fine and let it go"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: { social: 2 }, n: ["상대 운전자가 몇 번이고 고개를 숙였다.", "相手の運転手が何度も頭を下げた。", "The other driver bowed again and again."] },
    { chance: 0.4, grade: "bad", effects: { health: -4 }, n: ["며칠 뒤 목이 돌아가지 않았다.", "数日後、首が回らなくなった。", "A few days later, I couldn't turn my neck."] }] }],
]);
H("marathon_first", { age: [25, 65], emoji: "🏃", scene: "street" }, ["첫 10km 마라톤", "初めての10kmマラソン", "Your First 10K"], ["회사 동료가 10km 마라톤에 같이 나가자고 한다.", "同僚が10kmマラソンに一緒に出ようと言う。", "A coworker wants you to run a 10K together."], [
  ["train", "👟", ["두 달 준비하고 나간다", "二か月準備して出る", "Train for two months, then run"], { grade: "crit", effects: { health: 6, happy: 6, power: 4 }, flag: { add: "runner" }, n: ["결승선에서 다리가 풀렸다. 메달이 생각보다 무거웠다.", "ゴールで脚の力が抜けた。メダルは思ったより重かった。", "My legs gave out at the finish line. The medal was heavier than I expected."] }],
  ["cheer", "📣", ["응원만 간다", "応援だけ行く", "Just go to cheer"], { effects: { happy: 2, social: 2 }, n: ["동료가 결승선에서 내 손을 잡고 뛰었다. 내년엔 같이 뛰기로 했다.", "同僚がゴールで私の手を取って走った。来年は一緒に走ることにした。", "My coworker grabbed my hand at the finish. Next year we'll run together."] }],
]);
H("vegetarian", { age: [16, 70], emoji: "🥦", scene: "kitchen" }, ["식습관 바꾸기", "食生活を変える", "Changing How You Eat"], ["다큐멘터리를 보고 나서 고기를 줄여 볼까 고민이다.", "ドキュメンタリーを見て、肉を減らそうか悩んでいる。", "After a documentary, you're thinking of cutting back on meat."], [
  ["try", "🥗", ["한 달 채식에 도전한다", "一か月菜食に挑戦する", "Try a month of vegetarian"], { grade: "good", effects: { health: 3, happy: 2, intel: 1 }, n: ["요리 실력이 늘었다. 몸이 가벼워진 느낌이었다.", "料理の腕が上がった。体が軽くなった気がした。", "My cooking improved. I felt lighter."] }],
  ["balance", "⚖️", ["골고루 먹기로 한다", "バランスよく食べることにする", "Aim for balance"], { effects: { health: 2 }, n: ["채소 반찬이 한 가지 늘었다.", "野菜のおかずが一品増えた。", "One more vegetable dish at every meal."] }],
]);
H("hospital_stay", { age: [30, 90], emoji: "🛏️", scene: "hospital" }, ["입원", "入院", "Hospitalized"], ["갑자기 배가 아파 응급실에 갔다. 맹장염이라고 한다.", "急にお腹が痛くなり救急へ。盲腸だという。", "Sudden stomach pain sends you to the ER. Appendicitis."], [
  ["surgery", "🩺", ["바로 수술받는다", "すぐ手術を受ける", "Have surgery right away"], { grade: "good", effects: { health: 2, money: -150, happy: -1 }, n: ["일주일 만에 퇴원했다. 병실 창밖 풍경이 오래 기억에 남았다.", "一週間で退院した。病室の窓からの景色が長く記憶に残った。", "Discharged in a week. The view from that hospital window stayed with me."] }],
  ["wait", "⏳", ["약으로 버텨 보겠다고 한다", "薬で様子を見たいと言う", "Ask to try medication first"], { outcomes: [
    { chance: 0.4, grade: "mid", effects: { health: -1, money: -40 }, n: ["다행히 가라앉았다. 의사는 고개를 저었다.", "幸い治まった。医者は首を振った。", "Luckily it settled. The doctor shook their head."] },
    { chance: 0.6, grade: "bad", effects: { health: -7, money: -250, happy: -3 }, n: ["이틀 뒤 결국 더 큰 수술을 받았다.", "二日後、結局もっと大きな手術を受けた。", "Two days later, I needed a bigger surgery."] }] }],
]);
H("tooth_lose", { age: [45, 85], emoji: "🦷", scene: "clinic" }, ["어금니", "奥歯", "A Molar"], ["어금니가 흔들린다. 치과에서 임플란트 견적을 받았다.", "奥歯がぐらつく。歯医者でインプラントの見積もりをもらった。", "A molar is loose. The dentist quotes you for an implant."], [
  ["implant", "🔩", ["임플란트를 한다", "インプラントにする", "Get the implant"], { grade: "good", effects: { health: 3, happy: 2, money: -300 }, n: ["다시 갈비를 뜯을 수 있었다.", "またカルビにかぶりつけるようになった。", "I could chew ribs again."] }],
  ["denture", "😬", ["틀니로 버틴다", "入れ歯でしのぐ", "Make do with dentures"], { effects: { health: 1, money: -60 }, n: ["딱딱한 건 피했지만 잘 지냈다.", "硬いものは避けたが、問題なく過ごした。", "I avoided hard foods but got along fine."] }],
]);
H("blood_pressure", { age: [40, 85], emoji: "🩸", scene: "clinic" }, ["혈압이 높다", "血圧が高い", "High Blood Pressure"], ["혈압이 높다며 약을 먹기 시작하라고 한다.", "血圧が高いので薬を飲み始めるよう言われた。", "The doctor says your blood pressure is high — time to start medication."], [
  ["habit", "🧂", ["약 + 짠 음식 줄이기", "薬+塩分を減らす", "Medication plus less salt"], { grade: "good", effects: { health: 5, happy: -1 }, flag: { add: "bp_managed" }, n: ["국물을 남기기 시작했다. 다음 검사 수치가 내려갔다.", "スープを残すようになった。次の検査で数値が下がった。", "I started leaving the soup. My next reading came down."] }],
  ["skip", "🙅", ["약은 싫다", "薬はいやだ", "Refuse medication"], { grade: "bad", effects: { health: -5 }, n: ["두통이 잦아졌다.", "頭痛が増えた。", "The headaches came more often."] }],
]);
H("diabetes", { age: [45, 85], emoji: "🍬", scene: "clinic" }, ["당뇨 전 단계", "糖尿病予備群", "Prediabetes"], ["혈당 수치가 경계선이라고 한다.", "血糖値が境界線だと言われた。", "Your blood sugar is borderline."], [
  ["walk", "🚶", ["식후 30분 걷기", "食後30分歩く", "Walk 30 minutes after meals"], { grade: "good", effects: { health: 5, happy: 1 }, n: ["저녁 산책이 하루의 낙이 됐다. 수치가 정상으로 돌아왔다.", "夕方の散歩が一日の楽しみになった。数値が正常に戻った。", "Evening walks became the best part of my day. My numbers went back to normal."] }],
  ["ignore", "🍰", ["케이크는 못 끊는다", "ケーキはやめられない", "Can't give up cake"], { grade: "bad", effects: { health: -5, happy: 2 }, n: ["몇 년 뒤 약이 하나 늘었다.", "数年後、薬が一つ増えた。", "A few years later, I had one more pill to take."] }],
]);
H("hearing", { age: [60, 95], emoji: "👂", scene: "home" }, ["잘 안 들린다", "聞こえにくい", "Hard of Hearing"], ["텔레비전 소리를 키워도 잘 안 들린다. 가족들이 크게 말한다.", "テレビの音を上げても聞こえにくい。家族が大声で話す。", "Even with the TV turned up, you can't hear it well. Family has to shout."], [
  ["aid", "🦻", ["보청기를 맞춘다", "補聴器を作る", "Get hearing aids"], { grade: "good", effects: { happy: 5, social: 3, money: -150 }, n: ["새소리가 들렸다. 몇 년 만이었다.", "鳥の声が聞こえた。何年ぶりだった。", "I heard birdsong. For the first time in years."] }],
  ["pretend", "🙂", ["알아들은 척한다", "分かったふりをする", "Pretend to understand"], { grade: "bad", effects: { social: -3, happy: -2 }, n: ["대화에서 점점 빠지게 됐다.", "会話から少しずつ外れていった。", "I slowly dropped out of conversations."] }],
]);
H("fall_old", { age: [70, 100], emoji: "🦯", scene: "home" }, ["미끄러짐", "転倒", "A Fall"], ["욕실에서 미끄러질 뻔했다.", "浴室で滑りそうになった。", "You almost slipped in the bathroom."], [
  ["fix", "🔧", ["손잡이와 미끄럼 방지를 설치한다", "手すりと滑り止めを付ける", "Install grab bars and non-slip mats"], { grade: "good", effects: { health: 3, money: -40 }, n: ["자식이 와서 하루 종일 공사를 했다. 집이 안전해졌다.", "子どもが来て一日中工事をした。家が安全になった。", "My child came and spent the whole day installing them. The house felt safe."] }],
  ["careful", "🐢", ["조심하면 된다", "気をつければいい", "Just be careful"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: {}, n: ["그럭저럭 지냈다.", "なんとか過ごせた。", "I managed."] },
    { chance: 0.4, grade: "bad", effects: { health: -10, happy: -4 }, n: ["결국 넘어져 고관절을 다쳤다. 회복이 오래 걸렸다.", "結局転んで股関節を痛めた。回復に時間がかかった。", "I fell and hurt my hip. Recovery took a long time."] }] }],
]);
H("memory_test", { age: [70, 100], emoji: "🧠", scene: "clinic" }, ["깜빡깜빡", "うっかり", "Forgetfulness"], ["열쇠를 냉장고에서 찾았다. 가족이 검사를 받아 보자고 한다.", "鍵を冷蔵庫で見つけた。家族が検査を受けようと言う。", "You found your keys in the fridge. Your family suggests a checkup."], [
  ["test", "📝", ["검사를 받는다", "検査を受ける", "Get tested"], { outcomes: [
    { chance: 0.7, grade: "good", effects: { happy: 3 }, n: ["나이에 맞는 건망증이라고 했다. 퍼즐과 산책을 권했다.", "年相応のもの忘れだと言われた。パズルと散歩を勧められた。", "Normal forgetfulness for my age. Puzzles and walks were recommended."] },
    { chance: 0.3, grade: "mid", effects: { happy: -3, intel: -2 }, flag: { add: "memory_care" }, n: ["초기라고 했다. 가족과 함께 천천히 준비하기로 했다.", "初期だと言われた。家族とゆっくり準備することにした。", "Early stage, they said. We decided to prepare slowly, together."] }] }],
  ["puzzle", "🧩", ["매일 일기와 퍼즐을 한다", "毎日日記とパズルをする", "Keep a diary and do puzzles daily"], { grade: "good", effects: { intel: 2, happy: 2 }, n: ["일기장이 세 권 쌓였다.", "日記帳が三冊たまった。", "Three diaries piled up."] }],
]);
H("night_walk", { age: [18, 90], emoji: "🌃", scene: "park" }, ["밤 산책", "夜の散歩", "A Night Walk"], ["저녁을 먹고 나니 바람이 좋다.", "夕食後、風が心地いい。", "After dinner, there's a nice breeze."], [
  ["walk", "🚶", ["한 바퀴 돈다", "一周する", "Take a walk"], { grade: "good", effects: { health: 2, happy: 3 }, n: ["달이 밝았다. 별것 없는 저녁이 좋았다.", "月が明るかった。何でもない夜がよかった。", "The moon was bright. An ordinary evening, and it was good."] }],
  ["couch", "📺", ["소파에 눕는다", "ソファに寝転ぶ", "Lie on the couch"], { effects: { happy: 1, health: -1 }, n: ["드라마를 세 편 봤다.", "ドラマを三話見た。", "I watched three episodes."] }],
]);
H("cold_shower", { age: [20, 60], emoji: "🚿", scene: "home" }, ["찬물 샤워 챌린지", "冷水シャワーチャレンジ", "The Cold Shower Challenge"], ["찬물 샤워가 몸에 좋다는 글을 읽었다.", "冷水シャワーが体にいいという記事を読んだ。", "You read that cold showers are good for you."], [
  ["try", "🥶", ["30일 해 본다", "30日やってみる", "Try it for 30 days"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { health: 3, happy: 2, power: 1 }, n: ["아침 잠이 확 깼다. 습관이 됐다.", "朝の眠気が吹き飛んだ。習慣になった。", "It jolted me awake every morning. It stuck."] },
    { chance: 0.5, grade: "mid", effects: { health: -1 }, n: ["사흘째 감기에 걸렸다.", "三日目に風邪をひいた。", "Caught a cold on day three."] }] }],
  ["no", "♨️", ["따뜻한 물이 최고다", "温かいお湯が一番", "Warm water is best"], { effects: { happy: 1 }, n: ["그날도 김이 서린 욕실에서 콧노래를 불렀다.", "その日も湯気の立つ浴室で鼻歌を歌った。", "I hummed in a steamy bathroom, as always."] }],
]);
H("screen_time", { age: [12, 60], emoji: "📱", scene: "home", fromYear: 2010 }, ["하루 9시간", "一日9時間", "Nine Hours a Day"], ["휴대폰 사용 시간 알림: 하루 평균 9시간.", "スマホ使用時間の通知:一日平均9時間。", "Screen time report: nine hours a day on average."], [
  ["detox", "🌿", ["주말 디지털 단식", "週末デジタル断食", "Weekend digital detox"], { grade: "good", effects: { happy: 4, health: 2, internet: -2 }, n: ["첫날은 손이 허전했다. 둘째 날엔 책 한 권을 다 읽었다.", "初日は手持ち無沙汰だった。二日目には本を一冊読み終えた。", "Day one, my hands felt empty. Day two, I finished a whole book."] }],
  ["shrug", "🤷", ["원래 다 그렇다", "みんなそうだ", "Everyone's like that"], { effects: { health: -1, internet: 2 }, n: ["알림을 끄는 버튼을 찾았다.", "通知をオフにするボタンを見つけた。", "I found the button to turn off the report."] }],
]);
H("yoga", { age: [20, 85], emoji: "🧘", scene: "gym", fromYear: 1985 }, ["요가 수업", "ヨガ教室", "A Yoga Class"], ["동네 문화센터에 요가 수업이 생겼다.", "地域のカルチャーセンターにヨガ教室ができた。", "The community center starts a yoga class."], [
  ["join", "🧘", ["등록한다", "申し込む", "Sign up"], { grade: "good", effects: { health: 4, happy: 3 }, n: ["몸은 뻣뻣했지만 마지막 누워 있는 시간이 좋았다.", "体は硬かったが、最後に横になる時間がよかった。", "I was stiff, but the lying-down part at the end was wonderful."] }],
  ["video", "📼", ["집에서 영상 보고 따라 한다", "家で動画を見てまねする", "Follow a video at home"], { effects: { health: 2 }, n: ["거실에서 자주 쥐가 났다.", "リビングでよく足がつった。", "I got cramps a lot in the living room."] }],
]);
H("flu_shot", { age: [5, 95], emoji: "💉", scene: "clinic", fromYear: 1960 }, ["독감 예방 주사", "インフルエンザ予防接種", "Flu Shot"], ["올겨울 독감이 심하다고 한다.", "今年の冬はインフルエンザがひどいらしい。", "This winter's flu is supposed to be bad."], [
  ["shot", "💉", ["맞는다", "受ける", "Get the shot"], { grade: "good", effects: { health: 2 }, n: ["팔이 하루 뻐근했다. 겨울을 무사히 넘겼다.", "腕が一日だるかった。冬を無事に越した。", "My arm was sore for a day. Got through winter just fine."] }],
  ["skip", "🙅", ["안 맞는다", "受けない", "Skip it"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: {}, n: ["운 좋게 넘어갔다.", "運よく乗り切った。", "Lucky — made it through."] },
    { chance: 0.4, grade: "bad", effects: { health: -5 }, n: ["일주일을 끙끙 앓았다.", "一週間うんうん唸って寝込んだ。", "I was flat on my back for a week."] }] }],
]);
H("caffeine", { age: [20, 60], emoji: "☕", scene: "cafe" }, ["하루 다섯 잔", "一日五杯", "Five Cups a Day"], ["커피를 하루 다섯 잔 마신다. 심장이 두근거린다.", "コーヒーを一日五杯飲んでいる。動悸がする。", "Five coffees a day. Your heart is racing."], [
  ["cut", "🍵", ["두 잔으로 줄인다", "二杯に減らす", "Cut down to two"], { grade: "good", effects: { health: 3 }, n: ["오후엔 보리차를 마셨다. 밤에 잠이 잘 왔다.", "午後は麦茶にした。夜よく眠れた。", "Barley tea in the afternoon. I slept better."] }],
  ["more", "⚡", ["일이 많아 더 마신다", "仕事が多くてもっと飲む", "Drink more — too much work"], { grade: "bad", effects: { health: -3, intel: 1 }, n: ["손이 떨렸다.", "手が震えた。", "My hands trembled."] }],
]);
H("health_nut", { age: [35, 70], emoji: "💊", scene: "kitchen" }, ["영양제 열 가지", "サプリ十種類", "Ten Supplements"], ["광고를 보고 영양제를 잔뜩 샀다.", "広告を見てサプリを大量に買った。", "After an ad, you bought a pile of supplements."], [
  ["ask", "🩺", ["의사에게 물어보고 정리한다", "医者に聞いて整理する", "Ask a doctor and trim it down"], { grade: "good", effects: { health: 2, money: 50, intel: 1 }, n: ["필요한 건 두 개뿐이었다. 나머지는 환불했다.", "必要なのは二つだけだった。残りは返品した。", "I only needed two. Returned the rest."] }],
  ["all", "🌈", ["다 먹는다", "全部飲む", "Take them all"], { effects: { money: -80, happy: 1 }, n: ["몸이 좋아졌는지는 모르겠지만 부엌 한 칸이 약국이 됐다.", "体に効いたかは分からないが、台所の一角が薬局になった。", "Not sure it helped, but one kitchen shelf became a pharmacy."] }],
]);
H("weight_gain", { age: [30, 60], emoji: "⚖️", scene: "home" }, ["바지가 안 맞는다", "ズボンが入らない", "Your Pants Don't Fit"], ["작년에 산 바지가 안 잠긴다.", "去年買ったズボンが閉まらない。", "Pants you bought last year won't button."], [
  ["move", "🚴", ["자전거 출퇴근을 시작한다", "自転車通勤を始める", "Start cycling to work"], { grade: "good", effects: { health: 4, happy: 2, money: 30 }, n: ["교통비도 아꼈다. 바지가 다시 맞았다.", "交通費も浮いた。ズボンがまた入った。", "Saved on transit too. The pants fit again."] }],
  ["buy", "👖", ["한 치수 큰 바지를 산다", "ワンサイズ大きいズボンを買う", "Buy a size up"], { effects: { money: -20, health: -1 }, n: ["편했다. 아주 편했다.", "楽だった。とても楽だった。", "Comfortable. Very comfortable."] }],
]);
H("dentist_fear", { age: [20, 70], emoji: "😨", scene: "clinic" }, ["스케일링", "歯石取り", "Dental Cleaning"], ["1년 넘게 치과를 안 갔다.", "一年以上歯医者に行っていない。", "It's been over a year since you saw a dentist."], [
  ["go", "🪥", ["예약한다", "予約する", "Book it"], { grade: "good", effects: { health: 2, money: -15 }, n: ["의사가 '관리 잘하셨네요'라고 했다. 뿌듯했다.", "医者に「よく手入れしてますね」と言われた。誇らしかった。", "The dentist said, 'You've taken good care.' I felt proud."] }],
  ["later", "🗓️", ["다음 달에", "来月に", "Next month"], { effects: { health: -1 }, n: ["다음 달은 계속 다음 달이었다.", "来月はずっと来月だった。", "Next month kept being next month."] }],
]);
H("sunscreen", { age: [15, 60], emoji: "🧴", scene: "beach" }, ["뜨거운 해변", "暑いビーチ", "A Scorching Beach"], ["햇볕이 따갑다. 친구들은 오일을 바르고 태운다.", "日差しが強い。友達はオイルを塗って焼いている。", "The sun is fierce. Your friends are oiling up to tan."], [
  ["block", "🧴", ["선크림을 꼼꼼히 바른다", "日焼け止めを丁寧に塗る", "Apply sunscreen carefully"], { grade: "good", effects: { health: 2 }, n: ["친구들이 밤새 화끈거릴 때 나는 멀쩡했다.", "友達が一晩中ヒリヒリしている時、私は平気だった。", "While my friends burned all night, I was fine."] }],
  ["tan", "☀️", ["같이 태운다", "一緒に焼く", "Tan with them"], { effects: { happy: 3, health: -2 }, n: ["사흘 동안 등에 손을 못 댔다. 사진은 멋졌다.", "三日間背中を触れなかった。写真はかっこよかった。", "Couldn't touch my back for three days. Great photos, though."] }],
]);
H("stairs", { age: [40, 80], emoji: "🪜", scene: "subway" }, ["계단이냐 엘리베이터냐", "階段かエレベーターか", "Stairs or Elevator?"], ["엘리베이터 앞에 줄이 길다. 옆에는 계단.", "エレベーターの前に長い列。横には階段。", "A long line for the elevator. The stairs are right there."], [
  ["stairs", "🪜", ["계단으로 간다 (앞으로도)", "階段で行く(これからも)", "Take the stairs (from now on)"], { grade: "good", effects: { health: 3, power: 2 }, flag: { add: "stairs_habit" }, n: ["작은 다짐이 습관이 됐다. 다리가 튼튼해졌다.", "小さな決意が習慣になった。脚が丈夫になった。", "A small promise became a habit. My legs got stronger."] }],
  ["wait", "🛗", ["기다린다", "待つ", "Wait"], { effects: { happy: 1 }, n: ["3분을 기다렸다.", "三分待った。", "I waited three minutes."] }],
]);
H("health_insurance", { age: [25, 55], emoji: "📑", scene: "office" }, ["보험 설계사", "保険の営業", "The Insurance Agent"], ["친척이 보험을 들라며 찾아왔다.", "親戚が保険に入れと訪ねてきた。", "A relative visits to sell you insurance."], [
  ["compare", "🔍", ["꼼꼼히 비교하고 하나만", "しっかり比較して一つだけ", "Compare carefully, pick just one"], { grade: "good", effects: { money: -40, intel: 2 }, flag: { add: "insured" }, n: ["필요한 보장만 골랐다. 몇 년 뒤 수술비를 보험이 냈다.", "必要な保障だけ選んだ。数年後、手術費を保険が払った。", "I picked only what I needed. Years later, it covered a surgery."] }],
  ["all", "😅", ["거절 못 해서 세 개 든다", "断れず三つ入る", "Can't say no, sign up for three"], { effects: { money: -150, happy: -1 }, n: ["매달 보험료가 월세만큼 나갔다.", "毎月の保険料が家賃ほどになった。", "My monthly premiums matched my rent."] }],
  ["no", "🙅", ["정중히 거절한다", "丁重に断る", "Politely decline"], { effects: { social: -1 }, n: ["명절마다 그 이야기가 다시 나왔다.", "正月ごとにその話が蒸し返された。", "It came up again every holiday."] }],
]);
H("sick_kid_night", { age: [25, 55], emoji: "🌡️", scene: "home", hasKid: true }, ["아이가 열이 난다", "子どもが熱を出した", "Your Child Has a Fever"], ["새벽 세 시, 아이 이마가 불덩이다.", "午前三時、子どもの額が火のように熱い。", "3 a.m. — your child's forehead is burning."], [
  ["er", "🚑", ["응급실로 간다", "救急へ行く", "Go to the ER"], { grade: "good", effects: { health: -1, happy: -1, money: -30 }, n: ["해열제를 맞고 아이가 웃었다. 나는 그제야 숨을 쉬었다.", "解熱剤を打たれて子どもが笑った。私はやっと息をついた。", "After the fever reducer, my child smiled. Only then could I breathe."] }],
  ["watch", "🧊", ["물수건으로 밤새 지킨다", "濡れタオルで一晩中見守る", "Watch over them all night with a cool cloth"], { grade: "good", effects: { health: -2, happy: 1 }, n: ["아침에 열이 내렸다. 나는 출근길에 졸았다.", "朝には熱が下がった。私は通勤中にうとうとした。", "The fever broke by morning. I dozed on the way to work."] }],
]);
H("covid_long", { age: [20, 80], emoji: "😷", scene: "home", calYear: [2020, 2022] }, ["확진", "感染", "Testing Positive"], ["검사 결과 양성이다. 일주일 격리.", "検査結果は陽性。一週間の隔離。", "You test positive. A week of isolation."], [
  ["rest", "🛌", ["푹 쉰다", "しっかり休む", "Rest properly"], { grade: "good", effects: { health: -2, happy: -1 }, n: ["문 앞에 친구들이 두고 간 죽과 과일이 쌓였다.", "ドアの前に友達が置いていったおかゆと果物が積まれた。", "Porridge and fruit from friends piled up at my door."] }],
  ["work", "💻", ["격리 중에도 일한다", "隔離中も仕事する", "Keep working from isolation"], { grade: "bad", effects: { health: -5 }, n: ["기침이 두 달 갔다.", "咳が二か月続いた。", "The cough lasted two months."] }],
]);
H("walking_buddy", { age: [55, 95], emoji: "🚶", scene: "park" }, ["아침 걷기 모임", "朝の散歩会", "The Morning Walking Club"], ["공원에서 매일 아침 걷는 어르신들이 같이 걷자고 한다.", "公園で毎朝歩くお年寄りたちが一緒に歩こうと誘う。", "Seniors who walk the park every morning invite you along."], [
  ["join", "👟", ["함께 걷는다", "一緒に歩く", "Join them"], { grade: "good", effects: { health: 4, social: 3, happy: 3 }, n: ["걷는 것보다 끝나고 마시는 요구르트가 더 기다려졌다.", "歩くことより、終わった後に飲むヨーグルトが楽しみになった。", "The yogurt drink afterward became the real reason I went."] }],
  ["solo", "🎧", ["혼자 걷는 게 좋다", "一人で歩くのがいい", "Prefer walking alone"], { effects: { health: 3 }, n: ["라디오를 들으며 걸었다.", "ラジオを聞きながら歩いた。", "I walked listening to the radio."] }],
]);
H("eye_surgery", { age: [20, 45], emoji: "👁️", scene: "clinic", fromYear: 1995, cond: (p) => p.flags?.has?.("glasses") }, ["시력 교정 수술", "視力矯正手術", "Laser Eye Surgery"], ["안경을 벗고 싶다. 친구가 라식을 했다고 한다.", "眼鏡を外したい。友達がレーシックをしたという。", "You want to ditch your glasses. A friend just had LASIK."], [
  ["do", "✨", ["한다", "受ける", "Do it"], { grade: "good", effects: { happy: 5, money: -150 }, flag: { remove: "glasses" }, n: ["아침에 눈을 떴는데 시계가 보였다. 손이 습관적으로 안경을 찾았다.", "朝目を開けると時計が見えた。手が習慣で眼鏡を探した。", "I woke and could read the clock. My hand still reached for glasses out of habit."] }],
  ["keep", "👓", ["안경이 내 얼굴이다", "眼鏡が自分の顔だ", "Glasses are part of my face"], { effects: { happy: 1 }, n: ["안경을 바꾸는 걸로 기분 전환을 했다.", "眼鏡を変えて気分転換した。", "I just got new frames for a change."] }],
]);
H("cooking_health", { age: [22, 80], emoji: "🍲", scene: "kitchen" }, ["배달 대신 요리", "出前の代わりに料理", "Cooking Instead of Takeout"], ["배달 음식 영수증이 한 달에 마흔 장이다.", "出前のレシートが一か月に四十枚。", "Forty takeout receipts this month."], [
  ["cook", "🥘", ["주 3회는 직접 해 먹는다", "週三回は自炊する", "Cook three times a week"], { grade: "good", effects: { health: 3, money: 100, happy: 2 }, n: ["된장찌개 하나는 자신 있게 됐다.", "味噌チゲだけは自信を持って作れるようになった。", "I got confident with at least one stew."] }],
  ["order", "📲", ["바쁜데 어쩔 수 없다", "忙しいから仕方ない", "Too busy — keep ordering"], { effects: { health: -1, money: -60 }, n: ["배달 기사님과 인사하는 사이가 됐다.", "配達員さんと挨拶する仲になった。", "I'm on greeting terms with the delivery driver now."] }],
]);
H("noise_hearing_young", { age: [15, 30], emoji: "🎧", scene: "subway" }, ["이어폰 최대 볼륨", "イヤホン最大音量", "Max Volume Earphones"], ["지하철 소음 때문에 이어폰 볼륨을 끝까지 올렸다.", "地下鉄の騒音でイヤホンの音量を最大にした。", "The subway's so loud you've cranked your earphones to max."], [
  ["lower", "🔉", ["노이즈 캔슬링을 산다", "ノイズキャンセリングを買う", "Buy noise-cancelling ones"], { grade: "good", effects: { health: 2, money: -50 }, n: ["작은 소리로도 다 들렸다.", "小さい音でも全部聞こえた。", "I could hear everything at low volume."] }],
  ["keep", "🔊", ["그냥 크게 듣는다", "そのまま大音量で聞く", "Keep it loud"], { grade: "bad", effects: { health: -2 }, n: ["가끔 귀에서 삐 소리가 났다.", "時々耳鳴りがした。", "Sometimes my ears rang."] }],
]);
H("hospital_bills", { age: [30, 75], emoji: "🧾", scene: "hospital", noCountry: ["KR", "JP", "GB", "FR", "DE", "AU"] }, ["병원비 청구서", "医療費の請求書", "A Medical Bill"], ["짧은 입원 뒤 날아온 청구서 금액이 믿기지 않는다.", "短い入院の後に届いた請求額が信じられない。", "After a short hospital stay, the bill is unbelievable."], [
  ["negotiate", "📞", ["병원과 분할 납부를 협상한다", "病院と分割払いを交渉する", "Negotiate a payment plan"], { grade: "good", effects: { money: -400, intel: 2 }, n: ["몇 번의 전화 끝에 금액이 줄었다. 그래도 몇 년을 나눠 갚았다.", "何度かの電話で金額が減った。それでも何年もかけて返した。", "After many calls, the amount came down. Still took years to pay off."] }],
  ["pay", "💳", ["카드로 한 번에 낸다", "カードで一括払い", "Put it all on a card"], { grade: "bad", effects: { money: -900, happy: -4 }, n: ["카드 빚이 한동안 따라다녔다.", "カードの借金がしばらくついて回った。", "That card debt followed me for a while."] }],
]);
H("public_health_free", { age: [40, 80], emoji: "🏥", scene: "clinic", country: ["KR", "JP", "GB", "FR", "DE", "AU"] }, ["무료 검진 안내", "無料健診の案内", "A Free Screening Notice"], ["나라에서 무료 암 검진 대상이라는 우편이 왔다.", "国から無料がん検診の対象だという郵便が届いた。", "A letter says you're eligible for a free national cancer screening."], [
  ["go", "✅", ["받는다", "受ける", "Go"], { grade: "good", effects: { health: 3 }, n: ["대기실에서 동네 사람 셋을 만났다. 결과는 깨끗했다.", "待合室で近所の人三人に会った。結果はきれいだった。", "Met three neighbors in the waiting room. Results were clear."] }],
  ["throw", "🗑️", ["그냥 버린다", "そのまま捨てる", "Toss the letter"], { effects: { health: -1 }, n: ["다음 해에도 같은 우편이 왔다.", "翌年も同じ郵便が来た。", "The same letter came the next year."] }],
]);
H("old_exercise", { age: [65, 95], emoji: "🏸", scene: "seniorCenter" }, ["경로당 체조 시간", "老人会の体操", "Senior Center Exercise Time"], ["경로당에 체조 강사가 왔다. 다들 쭈뼛거린다.", "老人会に体操の講師が来た。みんなもじもじしている。", "An exercise instructor came to the senior center. Everyone's hesitant."], [
  ["front", "🙋", ["맨 앞줄에 선다", "最前列に立つ", "Stand in the front row"], { grade: "good", effects: { health: 3, happy: 4, social: 3 }, n: ["뒤에서 다들 따라 했다. 나는 그날부터 '반장'이 됐다.", "後ろでみんなが真似した。その日から私は「班長」になった。", "Everyone behind me followed. From then on, I was 'the captain.'"] }],
  ["back", "🙂", ["뒤에서 천천히 따라 한다", "後ろでゆっくり真似する", "Follow slowly from the back"], { effects: { health: 2, happy: 1 }, n: ["팔이 덜 올라갔지만 끝까지 했다.", "腕はあまり上がらなかったが最後までやった。", "My arms didn't go up much, but I finished."] }],
]);
H("chronic_pain", { age: [45, 90], emoji: "🌧️", scene: "home" }, ["비 오면 쑤시는 무릎", "雨の日にうずく膝", "Knees That Ache in the Rain"], ["비 오는 날이면 무릎이 먼저 안다.", "雨の日は膝が先に気づく。", "Your knees know it's going to rain before the forecast does."], [
  ["swim", "🏊", ["수영을 시작한다", "水泳を始める", "Start swimming"], { grade: "good", effects: { health: 4, happy: 2, money: -30 }, n: ["물속에서는 무릎이 가벼웠다.", "水の中では膝が軽かった。", "In the water, my knees felt light."] }],
  ["accept", "☔", ["일기예보 대신 쓴다", "天気予報代わりにする", "Use them as a weather forecast"], { effects: { happy: 1 }, n: ["'내일 비 온다' — 늘 맞혔다.", "「明日は雨だ」— いつも当たった。", "'Rain tomorrow' — I was never wrong."] }],
]);
H("first_aid", { age: [16, 60], emoji: "⛑️", scene: "classroom" }, ["응급처치 교육", "応急手当講習", "First Aid Training"], ["회사(학교)에서 심폐소생술 교육이 있다.", "会社(学校)で心肺蘇生の講習がある。", "There's CPR training at work (or school)."], [
  ["learn", "🫀", ["열심히 배운다", "真剣に学ぶ", "Take it seriously"], { grade: "good", effects: { intel: 2, social: 1 }, flag: { add: "cpr_trained" }, n: ["마네킹 가슴을 서른 번 눌렀다. 숫자를 세는 법을 몸이 기억했다.", "マネキンの胸を三十回押した。数え方を体が覚えた。", "Thirty compressions on the dummy. My body memorized the count."] }],
  ["nap", "😪", ["뒤에서 존다", "後ろで居眠りする", "Doze in the back"], { effects: { health: 1 }, n: ["수료증은 받았다.", "修了証はもらった。", "I still got the certificate."] }],
]);
H("pandemic_mask", { age: [5, 95], emoji: "😷", scene: "street", calYear: [2020, 2021] }, ["마스크 줄", "マスクの行列", "The Mask Line"], ["약국 앞에 마스크를 사려는 줄이 길다.", "薬局の前にマスクを買う長い列。", "A long line outside the pharmacy for masks."], [
  ["line", "🚶", ["줄을 선다", "並ぶ", "Get in line"], { effects: { health: 1, happy: -1 }, n: ["한 시간을 기다려 다섯 장을 샀다. 그중 두 장을 옆집에 줬다.", "一時間待って五枚買った。そのうち二枚を隣にあげた。", "An hour in line for five masks. I gave two to my neighbor."] }],
  ["sew", "🧵", ["천 마스크를 만든다", "布マスクを作る", "Sew cloth masks"], { grade: "good", effects: { happy: 2, social: 2 }, n: ["가족 것까지 열 장을 만들었다.", "家族の分まで十枚作った。", "I made ten, enough for the whole family."] }],
]);
H("health_scare_parent", { age: [35, 65], emoji: "📞", scene: "hospital" }, ["부모님의 검사", "親の検査", "A Parent's Health Scare"], ["어머니(아버지)가 정밀 검사를 받는다고 한다.", "母(父)が精密検査を受けるという。", "Your mother (or father) is going in for detailed tests."], [
  ["with", "🚗", ["휴가를 내고 함께 간다", "休みを取って一緒に行く", "Take a day off and go with them"], { grade: "good", effects: { happy: 2, social: 2 }, n: ["대기실에서 오랜만에 둘이 이야기를 했다. 결과는 괜찮았다.", "待合室で久しぶりに二人で話した。結果は大丈夫だった。", "We talked in the waiting room for the first time in ages. The results were fine."] }],
  ["call", "📱", ["전화로 결과를 기다린다", "電話で結果を待つ", "Wait for the call"], { effects: { happy: -1 }, n: ["괜찮다는 전화를 받고 한참 앉아 있었다.", "大丈夫だという電話の後、しばらく座り込んでいた。", "After the 'all clear' call, I sat still for a long time."] }],
]);
H("good_sleep_old", { age: [70, 100], emoji: "😴", scene: "retire" }, ["낮잠", "昼寝", "Afternoon Nap"], ["점심을 먹고 나면 눈꺼풀이 무겁다.", "昼食後はまぶたが重い。", "After lunch, your eyelids are heavy."], [
  ["nap", "🛌", ["30분만 잔다", "三十分だけ寝る", "Nap for thirty minutes"], { grade: "good", effects: { health: 2, happy: 2 }, n: ["개운하게 일어났다. 오후 산책이 가벼웠다.", "すっきり起きた。午後の散歩が軽やかだった。", "Woke up refreshed. The afternoon walk felt easy."] }],
  ["long", "💤", ["푹 잔다", "ぐっすり寝る", "Sleep deeply"], { effects: { happy: 1, health: -1 }, n: ["눈을 떴더니 저녁이었다. 밤에 잠이 안 왔다.", "目が覚めたら夕方だった。夜眠れなかった。", "I woke up at dusk and couldn't sleep that night."] }],
]);
H("medical_volunteer_trial", { age: [25, 60], emoji: "🧪", scene: "lab" }, ["임상시험 모집", "治験の募集", "A Clinical Trial"], ["신약 임상시험 참가자를 모집한다. 사례비가 꽤 된다.", "新薬の治験参加者を募集している。謝礼がそこそこ出る。", "A new drug trial is recruiting. The compensation is decent."], [
  ["join", "📝", ["설명을 듣고 참여한다", "説明を聞いて参加する", "Hear the details and join"], { outcomes: [
    { chance: 0.85, grade: "good", effects: { money: 300, intel: 1 }, n: ["별일 없이 끝났다. 몇 년 뒤 그 약이 약국에 나왔다.", "何事もなく終わった。数年後、その薬が薬局に並んだ。", "It went smoothly. Years later, that drug hit pharmacy shelves."] },
    { chance: 0.15, grade: "mid", effects: { money: 300, health: -3 }, n: ["며칠 두통이 있었다. 기록지에 꼼꼼히 적었다.", "数日頭痛があった。記録用紙に丁寧に書いた。", "A few days of headaches. I logged them carefully."] }] }],
  ["no", "🙅", ["사양한다", "辞退する", "Pass"], { effects: { happy: 1 }, n: ["포스터는 다음 주에 떼어졌다.", "ポスターは翌週はがされた。", "The poster came down the next week."] }],
]);

export const HEALTH_EVENTS = EV;
