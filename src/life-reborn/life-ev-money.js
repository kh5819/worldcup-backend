// =========================
// 플듀 인생게임 REBORN — 사건 3차: 경제·재산·투자 (2026-11-23)
// 돈 효과는 '만원(한국 구매력)' 기준 — 엔진이 나라·시대 소득 배수(incomeMul)를 곱한다.
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const M = (id, meta, title, desc, choices) => EV.push(ev("mn_" + id, { area: "money", ...meta }, title, desc, choices));
const rich = (p) => p.stats.money >= 5000, broke = (p) => p.stats.money < 0;

M("piggy_bank", { age: [6, 12], emoji: "🐷", scene: "kidroom" }, ["돼지 저금통", "豚の貯金箱", "The Piggy Bank"], ["돼지 저금통이 묵직하다. 갖고 싶던 게임기 값이 거의 모였다.", "豚の貯金箱がずっしり重い。欲しかったゲーム機の値段がほぼ貯まった。", "The piggy bank is heavy. You've almost saved enough for that game console."], [
  ["break", "🔨", ["깨서 산다", "割って買う", "Smash it and buy"], { effects: { happy: 6, money: -10 }, n: ["동전을 세는 데 한 시간이 걸렸다. 그날 밤 잠이 안 왔다.", "小銭を数えるのに一時間かかった。その夜は眠れなかった。", "Counting the coins took an hour. I couldn't sleep that night."] }],
  ["wait", "⏳", ["조금 더 모은다", "もう少し貯める", "Save a bit more"], { grade: "good", effects: { money: 15, intel: 1 }, flag: { add: "saver_kid" }, n: ["한 달 뒤 할인할 때 사고 돈이 남았다. 기다리면 좋은 일이 생긴다는 걸 배웠다.", "一か月後のセールで買い、お金が余った。待てばいいことがあると学んだ。", "A month later it went on sale, with money left over. I learned waiting pays."] }],
]);
M("allowance_book", { age: [9, 14], emoji: "📒", scene: "kidroom" }, ["용돈 기입장", "おこづかい帳", "The Allowance Ledger"], ["엄마가 용돈 기입장을 주며 쓰는 걸 다 적어 보라고 한다.", "母がおこづかい帳をくれて、使ったものを全部書けと言う。", "Mom hands you a ledger and says to write down everything you spend."], [
  ["write", "✏️", ["꼬박꼬박 적는다", "きちんと書く", "Record everything"], { grade: "good", effects: { intel: 3, money: 10 }, flag: { add: "budget_habit" }, n: ["떡볶이에 쓴 돈이 한 달에 절반이었다. 충격이었다.", "トッポッキに使ったお金が一か月の半分だった。衝撃だった。", "Half my monthly money went to street snacks. Shocking."] }],
  ["skip", "🙃", ["사흘 쓰고 만다", "三日でやめる", "Quit after three days"], { effects: { happy: 1 }, n: ["기입장 뒤쪽은 낙서장이 됐다.", "帳面の後ろは落書き帳になった。", "The back pages became a doodle pad."] }],
]);
M("first_bank", { age: [10, 18], emoji: "🏦", scene: "street", fromYear: 1950 }, ["처음 만든 통장", "初めての通帳", "Your First Bank Account"], ["은행에서 내 이름으로 된 통장을 처음 만들었다.", "銀行で自分名義の通帳を初めて作った。", "You open your very first bank account in your own name."], [
  ["deposit", "💰", ["세뱃돈을 다 넣는다", "お年玉を全部入れる", "Deposit all your gift money"], { grade: "good", effects: { money: 30, intel: 1 }, n: ["찍힌 숫자를 몇 번이고 다시 봤다. 이자는 몇 원이었지만 뿌듯했다.", "印字された数字を何度も見た。利息は少しだったが誇らしかった。", "I kept looking at the printed number. The interest was tiny, but I was proud."] }],
  ["half", "🍦", ["반만 넣고 반은 쓴다", "半分入れて半分使う", "Deposit half, spend half"], { effects: { money: 15, happy: 2 }, n: ["아이스크림도 먹고 통장도 생겼다.", "アイスも食べて通帳もできた。", "Got ice cream and a bank account."] }],
]);
M("part_time_save", { age: [17, 24], emoji: "💵", scene: "convStore" }, ["첫 월급 봉투", "初めての給料袋", "Your First Paycheck"], ["아르바이트 첫 월급이 들어왔다.", "アルバイトの初給料が入った。", "Your first part-time paycheck came in."], [
  ["parents", "🎁", ["부모님 선물부터 산다", "まず親へのプレゼントを買う", "Buy your parents a gift first"], { grade: "good", effects: { money: -30, happy: 4, social: 2 }, n: ["엄마가 내복을 받고 한참 웃었다.", "母が下着を受け取って長いこと笑った。", "Mom laughed for a long time over the long johns."] }],
  ["save", "🏦", ["절반은 적금에", "半分は積立に", "Put half into savings"], { grade: "good", effects: { money: 60, intel: 1 }, n: ["1년 뒤 적금 만기 문자가 왔다. 첫 목돈이었다.", "一年後、積立満期のメールが来た。初めてのまとまったお金だった。", "A year later, the maturity notice came. My first real lump sum."] }],
  ["spend", "🛍️", ["다 쓴다", "全部使う", "Spend it all"], { effects: { happy: 5, money: -10 }, n: ["새 신발이 생겼다. 통장은 다시 0이었다.", "新しい靴を手に入れた。通帳はまた0だった。", "New shoes. The account was back to zero."] }],
]);
M("credit_card", { age: [19, 30], emoji: "💳", scene: "street", fromYear: 1980 }, ["첫 신용카드", "初めてのクレジットカード", "Your First Credit Card"], ["카드사 직원이 사은품을 준다며 카드를 만들라고 한다.", "カード会社の人が景品をあげるからカードを作れと言う。", "A card company rep offers a free gift if you sign up."], [
  ["careful", "📊", ["만들되 한도를 낮춘다", "作るが限度額を低くする", "Get it, but set a low limit"], { grade: "good", effects: { intel: 2, money: 20 }, flag: { add: "credit_good" }, n: ["매달 전액 결제했다. 신용 점수가 차곡차곡 올라갔다.", "毎月全額払った。信用スコアがこつこつ上がった。", "Paid in full every month. My credit score rose steadily."] }],
  ["spend", "🛒", ["한도까지 쓴다", "限度まで使う", "Max it out"], { grade: "bad", effects: { happy: 4, money: -500 }, flag: { add: "card_debt" }, n: ["리볼빙이라는 말을 그때 처음 배웠다. 비싸게.", "リボ払いという言葉をその時初めて覚えた。高くついた。", "That's when I learned what 'revolving credit' meant. Expensively."], next: { id: "mn_card_debt_late", after: 2 } }],
  ["no", "🙅", ["체크카드면 충분하다", "デビットカードで十分", "A debit card is enough"], { effects: { intel: 1 }, n: ["사은품 텀블러는 친구가 받았다.", "景品のタンブラーは友達がもらった。", "My friend got the free tumbler."] }],
]);
M("card_debt_late", { followup: true, emoji: "📉", scene: "home" }, ["카드값 독촉", "カードの督促", "Card Payment Overdue"], ["카드값 연체 문자가 사흘째 온다.", "カード延滞のメールが三日続いている。", "Three days of overdue-payment texts."], [
  ["plan", "📝", ["지출을 다 끊고 갚는다", "支出を全部止めて返す", "Cut all spending and pay it off"], { grade: "good", effects: { money: -300, happy: -3, intel: 2 }, flag: { remove: "card_debt" }, n: ["반년 동안 도시락을 싸 다녔다. 마지막 결제 날 혼자 치킨을 시켰다.", "半年間弁当を持っていった。最後の支払いの日、一人でチキンを頼んだ。", "Packed lunches for six months. On the final payment day, I ordered fried chicken for myself."] }],
  ["more", "🔁", ["다른 카드로 돌려 막는다", "別のカードで回す", "Juggle it with another card"], { grade: "bad", effects: { money: -700, happy: -5 }, n: ["빚이 빚을 낳았다.", "借金が借金を生んだ。", "Debt bred more debt."] }],
]);
M("savings_challenge", { age: [20, 40], emoji: "🎯", scene: "home" }, ["52주 적금 챌린지", "52週貯金チャレンジ", "The 52-Week Savings Challenge"], ["매주 저금액을 늘리는 1년 챌린지가 유행이다.", "毎週貯金額を増やす一年チャレンジが流行っている。", "A year-long challenge — save a little more each week — is trending."], [
  ["do", "📅", ["해 본다", "やってみる", "Try it"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { money: 700, happy: 4, intel: 1 }, flag: { add: "saver" }, n: ["52주째에 통장을 보고 소리를 질렀다.", "52週目に通帳を見て叫んだ。", "In week 52, I screamed at my balance."] },
    { chance: 0.5, grade: "mid", effects: { money: 250 }, n: ["30주째에 포기했지만 그래도 돈은 남았다.", "30週目で挫折したが、それでもお金は残った。", "Gave up at week 30, but the money stayed."] }] }],
  ["skip", "😅", ["나랑은 안 맞는다", "自分には合わない", "Not for me"], { effects: { happy: 1 }, n: ["친구들의 인증 사진을 구경만 했다.", "友達の報告写真を眺めるだけだった。", "I just watched my friends post their progress."] }],
]);
M("stock_first", { age: [20, 50], emoji: "📈", scene: "office", fromYear: 1975 }, ["첫 주식", "初めての株", "Your First Stock"], ["동료들이 점심마다 주식 이야기를 한다. 나도 계좌를 열어 볼까.", "同僚が毎昼株の話をしている。自分も口座を開こうか。", "Coworkers talk stocks every lunch. Maybe you should open an account."], [
  ["index", "🧺", ["지수 펀드에 조금씩", "インデックスファンドに少しずつ", "Small monthly index fund buys"], { grade: "good", effects: { money: 400, intel: 2 }, flag: { add: "investor" }, n: ["오르락내리락했지만 10년 뒤 보니 꽤 컸다.", "上がったり下がったりしたが、十年後に見るとかなり増えていた。", "It went up and down, but ten years later it had grown a lot."] }],
  ["hot", "🔥", ["친구가 찍어 준 종목에 몰빵", "友達が勧めた銘柄に全力", "Go all in on a friend's hot tip"], { outcomes: [
    { chance: 0.3, grade: "crit", effects: { money: 2500, happy: 6 }, n: ["세 배가 됐다. 운이었다는 건 나중에 알았다.", "三倍になった。運だったと後で知った。", "It tripled. I learned later it was luck."] },
    { chance: 0.7, grade: "bad", effects: { money: -1500, happy: -6 }, n: ["반 토막이 났다. 그 친구는 이미 팔고 나간 뒤였다.", "半値になった。その友はとっくに売り抜けていた。", "It halved. My friend had already sold."] }] }],
  ["no", "🙅", ["적금이 마음 편하다", "積立の方が安心", "Savings feel safer"], { effects: { money: 100 }, n: ["밤에 주가를 확인할 일은 없었다.", "夜に株価を確認することはなかった。", "I never checked prices at night."] }],
]);
M("crypto", { age: [18, 55], emoji: "🪙", scene: "home", fromYear: 2014 }, ["코인 열풍", "仮想通貨ブーム", "The Crypto Craze"], ["단톡방에 '이번엔 진짜 간다'는 코인 링크가 돈다.", "グループに「今度こそ上がる」というコインのリンクが回っている。", "A coin link is going around the group chat: 'This one's really going to moon.'"], [
  ["small", "🎲", ["잃어도 되는 만큼만", "失ってもいい分だけ", "Only what you can afford to lose"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { money: 600, happy: 3 }, n: ["두 배가 됐을 때 팔았다. 욕심을 버린 게 신의 한 수였다.", "二倍になった時に売った。欲を捨てたのが正解だった。", "Sold when it doubled. Letting go of greed was the winning move."] },
    { chance: 0.6, grade: "mid", effects: { money: -150, happy: -1 }, n: ["0에 가까워졌다. 수업료라고 생각했다.", "ゼロに近づいた。授業料だと思った。", "It sank to near zero. I called it tuition."] }] }],
  ["all", "🚀", ["대출까지 받아 넣는다", "借金してまで入れる", "Take out a loan and go all in"], { outcomes: [
    { chance: 0.15, grade: "crit", effects: { money: 9000, happy: 8 }, flag: { add: "crypto_win" }, n: ["열 배가 됐다. 자랑하지 않기로 했다.", "十倍になった。自慢しないことにした。", "It went 10x. I decided not to brag."] },
    { chance: 0.85, grade: "bad", effects: { money: -4000, happy: -9, health: -2 }, flag: { add: "crypto_loss" }, n: ["한 달 만에 휴지 조각이 됐다. 대출은 남았다.", "一か月で紙くずになった。借金は残った。", "Worthless in a month. The loan remained."] }] }],
  ["skip", "🙅", ["안 한다", "やらない", "Stay out"], { effects: { happy: 1 }, n: ["단톡방이 조용해진 날, 나는 평소처럼 잤다.", "グループが静かになった日、私はいつも通り眠った。", "The day the group chat went silent, I slept as usual."] }],
]);
M("phishing", { age: [18, 90], emoji: "🎣", scene: "home", fromYear: 2000 }, ["수상한 문자", "怪しいメッセージ", "A Suspicious Message"], ["'택배 주소 확인' 링크가 담긴 문자가 왔다.", "「配送先確認」のリンク付きメッセージが届いた。", "A text arrives: 'Confirm your delivery address' with a link."], [
  ["ignore", "🗑️", ["지운다", "削除する", "Delete it"], { grade: "good", effects: { intel: 1 }, n: ["다음 날 뉴스에 그 문자 사기가 나왔다.", "翌日のニュースにその詐欺が出た。", "The next day, that scam was on the news."] }],
  ["click", "👆", ["눌러 본다", "押してみる", "Tap the link"], { outcomes: [
    { chance: 0.5, grade: "mid", effects: { happy: -2 }, n: ["뭔가 이상해서 바로 닫고 비밀번호를 바꿨다.", "何かおかしいのですぐ閉じてパスワードを変えた。", "Something felt off; I closed it and changed my passwords."] },
    { chance: 0.5, grade: "bad", effects: { money: -600, happy: -5 }, flag: { add: "scammed" }, n: ["다음 날 통장에서 돈이 빠져나가 있었다.", "翌日、口座からお金が抜かれていた。", "The next day, money was gone from my account."] }] }],
]);
M("voice_scam", { age: [55, 95], emoji: "📞", scene: "home", fromYear: 2005 }, ["'엄마, 나야' 전화", "「母さん、僕だよ」電話", "'Mom, It's Me' Call"], ["자식 목소리 같은 사람이 급히 돈을 보내 달라고 한다.", "子どもの声に似た人が急いでお金を送ってほしいと言う。", "Someone who sounds like your child urgently asks you to wire money."], [
  ["check", "📱", ["끊고 자식에게 직접 전화한다", "切って子どもに直接電話する", "Hang up and call your child directly"], { grade: "crit", effects: { intel: 2, happy: 2 }, n: ["자식은 회사에서 멀쩡히 일하고 있었다.", "子どもは会社で普通に働いていた。", "My child was at work, perfectly fine."] }],
  ["send", "💸", ["급하다니 보낸다", "急ぎだというので送る", "It sounds urgent — send it"], { grade: "bad", effects: { money: -1200, happy: -8 }, flag: { add: "scammed" }, n: ["경찰서에서 같은 일을 당한 사람 셋을 만났다.", "警察署で同じ被害に遭った人三人に会った。", "At the police station, I met three others who'd been hit the same way."] }],
]);
M("house_deposit", { age: [27, 45], emoji: "🏠", scene: "home", cond: (p) => p.housing !== "own" }, ["내 집 마련 계획", "マイホーム計画", "Saving for a Home"], ["집값이 또 올랐다는 뉴스. 언제쯤 내 집을 가질 수 있을까.", "家の値段がまた上がったというニュース。いつになったら家を持てるのか。", "Home prices rose again on the news. When will you ever own a place?"], [
  ["save", "🐢", ["10년 계획으로 모은다", "十年計画で貯める", "Make a ten-year plan"], { grade: "good", effects: { money: 600, happy: -1, intel: 1 }, flag: { add: "house_plan" }, n: ["엑셀 파일 이름은 '우리 집'이었다.", "エクセルのファイル名は「わが家」だった。", "The spreadsheet was named 'Our Home.'"] }],
  ["loan", "🏦", ["대출을 최대로 받아 지금 산다", "ローンを最大限組んで今買う", "Max out a mortgage and buy now"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { money: 2000, happy: 5 }, life: { housing: "own" }, n: ["이자는 무거웠지만 집값이 올라 버텼다.", "利息は重かったが、家の値段が上がって持ちこたえた。", "The interest was heavy, but prices rose and I held on."] },
    { chance: 0.45, grade: "bad", effects: { money: -1200, happy: -4 }, life: { housing: "own" }, n: ["금리가 오르자 월급 절반이 이자로 나갔다.", "金利が上がると給料の半分が利息に消えた。", "When rates rose, half my paycheck went to interest."] }] }],
  ["rent", "🧳", ["평생 빌려 살아도 괜찮다", "一生賃貸でもいい", "Renting for life is fine"], { effects: { happy: 2, money: 200 }, n: ["대신 매년 여행을 다녔다.", "その代わり毎年旅行した。", "Instead, I traveled every year."] }],
]);
M("landlord_raise", { age: [22, 70], emoji: "📄", scene: "home", cond: (p) => p.housing === "rent" || p.housing === "jeonse" }, ["월세 인상 통보", "家賃値上げの通知", "Rent Increase Notice"], ["집주인이 다음 계약부터 월세를 20% 올린다고 한다.", "大家が次の契約から家賃を20%上げると言う。", "Your landlord says rent will go up 20% at the next renewal."], [
  ["negotiate", "🤝", ["협상한다", "交渉する", "Negotiate"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { money: 100, intel: 1 }, n: ["10%로 합의했다. 집주인은 '오래 살아 줘서'라고 했다.", "10%で合意した。大家は「長く住んでくれたから」と言った。", "We settled on 10%. The landlord said, 'Since you've been here so long.'"] },
    { chance: 0.5, grade: "mid", effects: { money: -200 }, n: ["안 된다고 했다. 그냥 올려 줬다.", "だめだと言われた。そのまま払った。", "They said no. I paid it."] }] }],
  ["move", "📦", ["더 싼 곳으로 이사한다", "安い所へ引っ越す", "Move somewhere cheaper"], { effects: { money: 150, happy: -2 }, n: ["출근길이 30분 길어졌다.", "通勤が三十分長くなった。", "My commute got thirty minutes longer."] }],
]);
M("inheritance_fight", { age: [40, 75], emoji: "⚖️", scene: "home" }, ["유산 정리", "遺産整理", "Settling the Estate"], ["부모님이 남긴 재산을 형제들과 나눠야 한다. 분위기가 심상치 않다.", "親が遺した財産をきょうだいで分けなければ。空気が不穏だ。", "You and your siblings must divide what your parents left. Tension is rising."], [
  ["fair", "⚖️", ["법대로 똑같이 나눈다", "法律通りに均等に分ける", "Split it equally, by the book"], { grade: "good", effects: { money: 800, social: 2 }, n: ["명절에 다 같이 모일 수 있었다. 그게 제일 큰 유산이었다.", "正月にみんなで集まれた。それが一番大きな遺産だった。", "We could still gather for holidays. That was the real inheritance."] }],
  ["give", "🎁", ["형편이 어려운 형제에게 양보한다", "苦しいきょうだいに譲る", "Give your share to a struggling sibling"], { grade: "good", effects: { social: 5, happy: 4 }, n: ["형제가 말없이 내 손을 잡았다.", "きょうだいが黙って私の手を握った。", "My sibling held my hand without a word."] }],
  ["fight", "🔥", ["내 몫을 더 주장한다", "自分の取り分を主張する", "Fight for a bigger share"], { outcomes: [
    { chance: 0.5, grade: "mid", effects: { money: 1500, social: -6, happy: -4 }, n: ["돈은 더 받았지만 형제와 10년 동안 말을 안 했다.", "お金は多くもらったが、きょうだいと十年口をきかなかった。", "Got more money, lost ten years of talking to my sibling."] },
    { chance: 0.5, grade: "bad", effects: { money: -300, social: -6, happy: -6 }, n: ["소송비가 유산보다 많이 나왔다.", "訴訟費用が遺産より多くかかった。", "The lawsuit cost more than the inheritance."] }] }],
]);
M("lottery", { age: [20, 90], emoji: "🎰", scene: "convStore" }, ["복권 한 장", "宝くじ一枚", "One Lottery Ticket"], ["꿈에 돼지가 나왔다. 편의점 앞을 지나간다.", "夢に豚が出てきた。コンビニの前を通る。", "You dreamed of a pig — lucky! You're passing a convenience store."], [
  ["buy", "🎟️", ["한 장 산다", "一枚買う", "Buy one ticket"], { outcomes: [
    { chance: 0.92, grade: "mid", effects: { money: -1, happy: 1 }, n: ["일주일 동안 행복한 상상을 했다. 그걸로 충분했다.", "一週間、幸せな想像をした。それで十分だった。", "A week of happy daydreams. That was enough."] },
    { chance: 0.075, grade: "good", effects: { money: 50, happy: 4 }, n: ["5만 원에 당첨됐다. 다 같이 고기를 먹었다.", "少額当選した。みんなで焼肉を食べた。", "A small win! We all went out for barbecue."] },
    { chance: 0.005, grade: "crit", effects: { money: 30000, happy: 10 }, flag: { add: "lottery_winner" }, n: ["번호를 열 번 맞춰 봤다. 손이 떨렸다.", "番号を十回確かめた。手が震えた。", "I checked the numbers ten times. My hands shook."] }] }],
  ["pass", "🚶", ["지나간다", "通り過ぎる", "Walk on by"], { effects: { money: 1 }, n: ["돼지꿈은 그냥 꿈이었다.", "豚の夢はただの夢だった。", "The pig dream was just a dream."] }],
]);
M("gamble_trip", { age: [21, 70], emoji: "🃏", scene: "street" }, ["카지노", "カジノ", "The Casino"], ["여행지에 카지노가 있다. 친구가 '딱 10만 원만'이라고 한다.", "旅先にカジノがある。友達が「ちょっとだけ」と言う。", "There's a casino at your travel spot. A friend says, 'Just a little.'"], [
  ["limit", "🪙", ["정한 금액만 쓰고 나온다", "決めた額だけ使って出る", "Spend only a set amount and leave"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { money: 30, happy: 4 }, n: ["조금 따고 바로 나왔다. 친구는 못 나왔다.", "少し勝ってすぐ出た。友達は出られなかった。", "Won a little and left. My friend couldn't."] },
    { chance: 0.6, grade: "mid", effects: { money: -10, happy: 2 }, n: ["정한 만큼 잃고 웃으며 나왔다.", "決めた分だけ負けて笑って出た。", "Lost exactly what I'd planned and walked out smiling."] }] }],
  ["chase", "😵", ["잃은 걸 되찾으려 계속한다", "負けを取り返そうと続ける", "Keep going to win it back"], { grade: "bad", effects: { money: -900, happy: -6 }, flag: { add: "gambler" }, n: ["새벽 다섯 시에 지갑이 비었다.", "朝五時に財布が空になった。", "By 5 a.m., my wallet was empty."] }],
  ["no", "🙅", ["구경만 한다", "見学だけ", "Just watch"], { effects: { happy: 1 }, n: ["무료 음료가 맛있었다.", "無料のドリンクがおいしかった。", "The free drinks were good."] }],
]);
M("budget_app", { age: [22, 60], emoji: "📊", scene: "home", fromYear: 2012 }, ["가계부 앱", "家計簿アプリ", "A Budgeting App"], ["가계부 앱이 지난달 지출을 분석해 보여 준다. 배달비가 1위다.", "家計簿アプリが先月の支出を分析した。出前代が一位だ。", "Your budgeting app analyzes last month. Takeout is number one."], [
  ["cut", "✂️", ["구독 서비스부터 정리한다", "サブスクから整理する", "Start by cutting subscriptions"], { grade: "good", effects: { money: 120, intel: 1 }, n: ["안 보는 구독이 네 개였다.", "見ていないサブスクが四つあった。", "Four subscriptions I never used."] }],
  ["close", "📵", ["앱을 지운다", "アプリを消す", "Delete the app"], { effects: { happy: 1 }, n: ["모르는 게 약이었다.", "知らぬが仏だった。", "Ignorance was bliss."] }],
]);
M("side_income", { age: [22, 60], emoji: "🧺", scene: "market" }, ["중고 거래", "フリマ", "Selling Secondhand"], ["집에 안 쓰는 물건이 가득하다. 중고로 팔아 볼까.", "家に使わない物がいっぱい。フリマで売ってみようか。", "Your home is full of unused stuff. Maybe sell it secondhand?"], [
  ["sell", "📦", ["사진 찍어 올린다", "写真を撮って出品する", "Photograph and list everything"], { grade: "good", effects: { money: 80, happy: 3, social: 1 }, n: ["물건이 줄고 통장이 늘었다. 거래 상대가 귤을 덤으로 줬다.", "物が減って通帳が増えた。取引相手がみかんをおまけにくれた。", "Fewer things, more money. One buyer threw in some tangerines."] }],
  ["give", "🤲", ["필요한 사람에게 그냥 준다", "必要な人にあげる", "Just give it away"], { effects: { happy: 4, social: 2 }, n: ["아이 장난감을 받은 엄마가 고맙다며 쿠키를 구워 왔다.", "子どものおもちゃを受け取った母親がお礼にクッキーを焼いてきた。", "A mom who got the toys baked cookies to say thanks."] }],
]);
M("emergency_fund", { age: [25, 55], emoji: "🧯", scene: "home" }, ["비상금", "非常用資金", "An Emergency Fund"], ["갑자기 보일러가 고장 났다. 수리비가 만만치 않다.", "突然ボイラーが壊れた。修理費がばかにならない。", "The boiler suddenly breaks. Repairs aren't cheap."], [
  ["fund", "🏦", ["모아 둔 비상금으로 낸다", "貯めておいた非常金で払う", "Pay from your emergency fund"], { grade: "good", effects: { money: -100, happy: 1 }, n: ["비상금이 있어서 다행이었다. 다시 채우기 시작했다.", "非常金があって助かった。また貯め始めた。", "Thank goodness for the emergency fund. I started refilling it."] }],
  ["card", "💳", ["카드 할부로 긁는다", "カード分割で払う", "Put it on the card in installments"], { effects: { money: -140, happy: -1 }, n: ["12개월 동안 보일러가 매달 생각났다.", "十二か月、毎月ボイラーを思い出した。", "For twelve months, I remembered the boiler every billing day."] }],
]);
M("wedding_cost", { age: [25, 40], emoji: "💒", scene: "wedding", married: false, cond: (p) => !!p.relations?.romance }, ["결혼식 비용", "結婚式の費用", "Wedding Costs"], ["결혼 이야기가 나오자 견적서가 쌓이기 시작했다.", "結婚の話が出ると見積書が積み上がり始めた。", "Talk of marriage begins — and so do the quotes."], [
  ["small", "🌿", ["작은 결혼식", "小さな結婚式", "A small wedding"], { grade: "good", effects: { money: -200, happy: 4 }, n: ["가족과 친한 친구만 불렀다. 남은 돈으로 오래 쓸 가구를 샀다.", "家族と親しい友だけを招いた。残ったお金で長く使える家具を買った。", "Just family and close friends. We spent the savings on furniture that lasted."] }],
  ["big", "🎊", ["남들 하는 만큼", "人並みに", "The full traditional wedding"], { effects: { money: -1200, happy: 3, social: 3 }, n: ["축의금으로 절반은 돌아왔다. 나머지 절반은 할부로 갚았다.", "ご祝儀で半分は戻った。残りの半分は分割で払った。", "Gifts covered half. We paid off the rest in installments."] }],
]);
M("kid_education_fund", { age: [28, 50], emoji: "🎓", scene: "home", hasKid: true }, ["아이 교육비", "子どもの教育費", "Saving for the Kids' Education"], ["아이 학원비와 대학 등록금 계산을 해 보니 아찔하다.", "子どもの塾代と大学の学費を計算してみると、くらくらする。", "You add up tutoring and future tuition. It's dizzying."], [
  ["plan", "🐢", ["교육 적금을 일찍 시작한다", "教育積立を早めに始める", "Start an education fund early"], { grade: "good", effects: { money: 300, intel: 1 }, n: ["매달 조금씩. 아이가 스무 살이 되자 그 돈이 날개가 됐다.", "毎月少しずつ。子どもが二十歳になるとそのお金が翼になった。", "A little each month. When my child turned twenty, it became their wings."] }],
  ["now", "📚", ["지금 학원에 다 쓴다", "今の塾に全部使う", "Spend it all on tutoring now"], { effects: { money: -600, intel: 1, happy: -1 }, n: ["아이는 지쳤고 나도 지쳤다.", "子どもは疲れ、私も疲れた。", "My child was exhausted. So was I."] }],
]);
M("retirement_plan", { age: [35, 55], emoji: "🌅", scene: "office" }, ["노후 준비", "老後の準備", "Planning for Retirement"], ["회사에서 노후 설계 강의를 들었다. 지금 모은 걸로는 부족하다고 한다.", "会社で老後設計の講義を聞いた。今の貯えでは足りないという。", "A retirement seminar at work says your savings aren't enough."], [
  ["pension", "🏦", ["연금 저축을 늘린다", "年金積立を増やす", "Increase pension savings"], { grade: "good", effects: { money: 500, happy: -1, intel: 1 }, flag: { add: "pension_plus" }, n: ["지금의 커피 한 잔이 미래의 밥 한 끼가 됐다.", "今のコーヒー一杯が未来のご飯一食になった。", "Today's coffee became a future meal."] }],
  ["yolo", "🍹", ["지금을 즐긴다", "今を楽しむ", "Enjoy life now"], { effects: { happy: 4, money: -200 }, n: ["후회는 없었다. 아직은.", "後悔はなかった。まだ今のところは。", "No regrets. Not yet, anyway."] }],
]);
M("pension_life", { age: [62, 95], emoji: "🧾", scene: "retire" }, ["연금 통장", "年金の通帳", "The Pension Account"], ["매달 들어오는 연금으로 한 달 살림을 꾸려야 한다.", "毎月の年金で暮らしをやりくりしなければ。", "You have to make the monthly pension cover everything."], [
  ["thrift", "🧮", ["알뜰하게 산다", "質素に暮らす", "Live frugally"], { grade: "good", effects: { money: 80, happy: 1 }, n: ["손주 용돈 줄 만큼은 남았다.", "孫におこづかいをあげる分は残った。", "There was always enough left for the grandkids' pocket money."] }],
  ["work", "🧹", ["소일거리를 찾는다", "小さな仕事を探す", "Find a small job"], { grade: "good", effects: { money: 150, health: 1, social: 2 }, n: ["아파트 경비 일을 시작했다. 주민들과 인사하는 재미가 생겼다.", "マンションの警備の仕事を始めた。住民と挨拶する楽しみができた。", "I started as a building guard. Greeting residents became a joy."] }],
]);
M("friend_guarantee", { age: [28, 65], emoji: "✍️", scene: "office" }, ["보증 서 달라는 부탁", "保証人の頼み", "Asked to Co-sign a Loan"], ["오래 알고 지낸 사람이 대출 보증을 서 달라고 한다.", "長い付き合いの人がローンの保証人になってほしいと言う。", "Someone you've known for years asks you to co-sign their loan."], [
  ["sign", "🖊️", ["믿고 서 준다", "信じて引き受ける", "Trust them and sign"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 3 }, n: ["무사히 갚았다. 그 사람은 평생 고마워했다.", "無事に返済された。その人は一生感謝した。", "They repaid it. They were grateful for life."] },
    { chance: 0.4, grade: "bad", effects: { money: -3000, happy: -8, social: -4 }, flag: { add: "guarantor_loss" }, n: ["연락이 끊겼다. 빚은 내 이름으로 남았다.", "連絡が途絶えた。借金は私の名義で残った。", "They vanished. The debt stayed in my name."] }] }],
  ["no", "🙅", ["거절한다", "断る", "Decline"], { effects: { social: -2 }, n: ["서운해했지만, 우리 집 가훈이 '보증 서지 마라'였다.", "がっかりされたが、我が家の家訓は「保証人になるな」だった。", "They were hurt, but our family motto was 'Never co-sign.'"] }],
]);
M("raise_negotiation", { age: [25, 55], emoji: "💼", scene: "office", cond: (p) => !!p.job }, ["연봉 협상", "年収交渉", "Salary Negotiation"], ["연봉 협상 시즌이다. 이번 해 성과는 괜찮았다.", "年収交渉の季節だ。今年の成果は悪くなかった。", "It's salary negotiation season. Your year went well."], [
  ["ask", "📈", ["근거를 정리해 당당히 요구한다", "根拠をまとめて堂々と求める", "Prepare evidence and ask confidently"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 400, happy: 4 }, life: { raise: 1.1 }, n: ["팀장이 표를 한참 보더니 고개를 끄덕였다.", "上司が表をじっと見てうなずいた。", "My manager studied the chart, then nodded."] },
    { chance: 0.4, grade: "mid", effects: { happy: -1 }, n: ["올해는 어렵다고 했다. 대신 내년을 약속받았다.", "今年は難しいと言われた。代わりに来年を約束された。", "Not this year, they said — but next year was promised."] }] }],
  ["accept", "🙂", ["제시한 대로 받는다", "提示通り受け入れる", "Accept the offer as is"], { effects: { money: 100 }, n: ["무난하게 지나갔다.", "無難に過ぎた。", "It passed without fuss."] }],
]);
M("tax_return", { age: [22, 80], emoji: "🧾", scene: "home" }, ["세금 환급", "税金の還付", "A Tax Refund"], ["연말정산을 꼼꼼히 했더니 환급금이 나온다고 한다.", "年末調整をきちんとしたら還付金が出るという。", "You did your year-end tax filing carefully — there's a refund."], [
  ["save", "🏦", ["그대로 저축한다", "そのまま貯金する", "Save it"], { grade: "good", effects: { money: 60, intel: 1 }, n: ["작은 돈이지만 한 해의 보너스 같았다.", "小さなお金だが一年のボーナスのようだった。", "Small, but it felt like a bonus."] }],
  ["treat", "🍣", ["가족과 외식한다", "家族と外食する", "Treat the family to dinner"], { effects: { happy: 4, social: 1 }, n: ["'세금으로 먹는 초밥'이라며 다 같이 웃었다.", "「税金で食べる寿司」とみんなで笑った。", "'Tax-refund sushi,' we joked."] }],
]);
M("inflation", { age: [25, 90], emoji: "🛒", scene: "market" }, ["장바구니 물가", "買い物かごの物価", "Grocery Prices"], ["같은 장바구니인데 작년보다 계산이 훨씬 많이 나온다.", "同じ買い物かごなのに去年よりずっと高い。", "Same basket of groceries, much higher total than last year."], [
  ["plan", "📝", ["장보기 목록을 쓰고 시장을 돈다", "買い物リストを書いて市場を回る", "Make a list and shop the market"], { grade: "good", effects: { money: 50, intel: 1, health: 1 }, n: ["시장 할머니가 덤을 주셨다.", "市場のおばあさんがおまけをくれた。", "The market grandma threw in extras."] }],
  ["same", "😩", ["그냥 산다", "そのまま買う", "Buy it anyway"], { effects: { money: -60, happy: -1 }, n: ["영수증을 접어서 주머니 깊이 넣었다.", "レシートを折ってポケットの奥にしまった。", "I folded the receipt deep into my pocket."] }],
]);
M("gold_buy", { age: [30, 80], emoji: "🥇", scene: "market" }, ["금 한 돈", "金を少し", "A Little Gold"], ["경기가 불안하다며 다들 금을 산다고 한다.", "景気が不安で、みんな金を買っているという。", "With the economy shaky, everyone's buying gold."], [
  ["buy", "🪙", ["조금 사 둔다", "少し買っておく", "Buy a little"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 200 }, n: ["몇 년 뒤 꽤 올라 있었다.", "数年後かなり上がっていた。", "Years later, it had climbed nicely."] },
    { chance: 0.4, grade: "mid", effects: { money: -50 }, n: ["한동안 제자리였다. 서랍 속에서 반짝이기만 했다.", "しばらく横ばいだった。引き出しの中で光っているだけだった。", "Flat for years. It just glittered in a drawer."] }] }],
  ["no", "🙅", ["관심 없다", "興味ない", "Not interested"], { effects: { happy: 1 }, n: ["뉴스가 금값을 말할 때마다 채널을 돌렸다.", "ニュースが金の値段を伝えるたびにチャンネルを変えた。", "I changed the channel whenever gold prices came up."] }],
]);
M("car_buy", { age: [24, 55], emoji: "🚙", scene: "street", fromYear: 1965 }, ["첫 차 계약", "初めての車の契約", "Buying a Car"], ["영업사원이 '이번 달 특가'라며 새 차를 권한다.", "営業マンが「今月の特価」と新車を勧める。", "A salesperson pitches a new car: 'This month only!'"], [
  ["new", "✨", ["새 차를 할부로", "新車をローンで", "New car on installments"], { effects: { happy: 6, money: -900 }, n: ["새 차 냄새가 좋았다. 할부는 5년이었다.", "新車の匂いがよかった。ローンは五年だった。", "Loved the new-car smell. The loan ran five years."] }],
  ["used", "🔧", ["믿을 만한 중고차", "信頼できる中古車", "A reliable used car"], { grade: "good", effects: { happy: 3, money: -300, intel: 1 }, n: ["10년을 잘 탔다. 문콕 걱정도 없었다.", "十年快調に乗った。ドアパンチの心配もなかった。", "Drove it ten good years, never worried about dings."] }],
  ["transit", "🚇", ["대중교통이 낫다", "公共交通で十分", "Public transit is better"], { effects: { money: 100, health: 1 }, n: ["지하철에서 책을 많이 읽었다.", "地下鉄でたくさん本を読んだ。", "I read a lot of books on the subway."] }],
]);
M("fraud_investment", { age: [35, 80], emoji: "🐍", scene: "office" }, ["확정 수익 보장", "確定利回り保証", "'Guaranteed Returns'"], ["지인이 '월 5% 확정 수익'이라는 투자를 소개했다.", "知人が「月5%確定利回り」の投資を紹介した。", "An acquaintance pitches an investment with 'guaranteed 5% monthly returns.'"], [
  ["check", "🔍", ["금융 당국에 업체를 조회한다", "金融当局で業者を照会する", "Look the company up with regulators"], { grade: "crit", effects: { intel: 3, happy: 2 }, n: ["등록되지 않은 업체였다. 몇 달 뒤 대표가 잠적했다는 뉴스가 났다.", "未登録の業者だった。数か月後、代表が失踪したとのニュースが出た。", "Unregistered. Months later, the CEO vanished, per the news."] }],
  ["in", "💰", ["넣는다", "投資する", "Invest"], { outcomes: [
    { chance: 0.25, grade: "mid", effects: { money: 300 }, n: ["몇 달 이자가 들어왔다. 그리고 멈췄다. 원금은 겨우 건졌다.", "数か月利息が入った。そして止まった。元本はなんとか取り戻した。", "Interest came for a few months, then stopped. I barely recovered the principal."] },
    { chance: 0.75, grade: "bad", effects: { money: -3500, happy: -9 }, flag: { add: "scammed" }, n: ["다단계 사기였다. 같은 동네 사람들이 단체 소송을 했다.", "マルチ商法の詐欺だった。近所の人たちが集団訴訟をした。", "It was a pyramid scheme. The whole neighborhood filed a class action."] }] }],
]);
M("frugal_month", { age: [20, 60], emoji: "🥫", scene: "kitchen" }, ["무지출 챌린지", "無支出チャレンジ", "No-Spend Month"], ["이번 달은 꼭 필요한 것 외에는 하나도 안 사 보기로 했다.", "今月は必要なもの以外は一切買わないと決めた。", "This month: buy nothing but essentials."], [
  ["do", "💪", ["끝까지 해낸다", "最後までやり切る", "See it through"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { money: 120, intel: 1, happy: 2 }, n: ["냉장고 파먹기 요리 실력이 늘었다.", "冷蔵庫の残り物料理の腕が上がった。", "My leftover-cooking skills leveled up."] },
    { chance: 0.45, grade: "mid", effects: { money: 40, happy: -1 }, n: ["20일째에 무너졌다. 보상 소비로 다 썼다.", "二十日目で崩れた。反動で全部使った。", "Cracked on day 20 and splurged it all back."] }] }],
  ["week", "📆", ["일주일만 해 본다", "一週間だけやってみる", "Just try one week"], { effects: { money: 30, happy: 1 }, n: ["일주일은 할 만했다. 작은 성공이었다.", "一週間ならできた。小さな成功だった。", "One week was doable. A small win."] }],
]);
M("bank_run", { age: [25, 85], emoji: "🏚️", scene: "street", fromYear: 1950 }, ["은행이 흔들린다", "銀行が揺らぐ", "A Bank in Trouble"], ["돈을 맡긴 은행이 위험하다는 소문이 돈다. 지점 앞에 줄이 생겼다.", "預けている銀行が危ないという噂。支店の前に行列ができた。", "Rumors say your bank is in trouble. A line forms outside the branch."], [
  ["line", "🏃", ["줄 서서 돈을 뺀다", "並んでお金を下ろす", "Get in line and withdraw"], { effects: { money: -20, happy: -2 }, n: ["네 시간을 기다렸다. 결국 은행은 무사했다.", "四時間待った。結局銀行は無事だった。", "Four hours in line. The bank survived anyway."] }],
  ["calm", "🧘", ["예금 보호 한도를 확인하고 기다린다", "預金保護の上限を確認して待つ", "Check deposit insurance and wait"], { grade: "good", effects: { intel: 2 }, n: ["보호 한도 안이었다. 소문은 일주일 만에 잦아들었다.", "保護上限内だった。噂は一週間で収まった。", "I was within the insured limit. The rumor died in a week."] }],
]);
M("chit_fund", { age: [25, 65], emoji: "👥", scene: "home", country: ["KR", "IN", "JP"], era: ["early", "past", "modern"] }, ["동네 계모임", "頼母子講", "A Neighborhood Savings Circle"], ["동네 사람들끼리 돈을 모아 순서대로 타는 모임에 들어오라고 한다.", "近所の人たちでお金を出し合い、順番に受け取る講に誘われた。", "Neighbors invite you into a rotating savings circle."], [
  ["join", "🤝", ["들어간다", "入る", "Join"], { outcomes: [
    { chance: 0.75, grade: "good", effects: { money: 300, social: 4 }, n: ["내 차례가 왔을 때 그 돈으로 가게 보증금을 냈다. 모임은 20년을 갔다.", "自分の番が来た時、そのお金で店の保証金を払った。講は二十年続いた。", "When my turn came, it paid my shop deposit. The circle lasted twenty years."] },
    { chance: 0.25, grade: "bad", effects: { money: -500, social: -2, happy: -4 }, n: ["계주가 돈을 들고 사라졌다.", "取りまとめ役がお金を持って消えた。", "The organizer disappeared with the money."] }] }],
  ["no", "🙅", ["은행이 낫다", "銀行がいい", "Stick with the bank"], { effects: { money: 50 }, n: ["모임 수다 소식은 엘리베이터에서 들었다.", "講の噂話はエレベーターで聞いた。", "I heard the circle's gossip in the elevator."] }],
]);
M("401k", { age: [22, 45], emoji: "📑", scene: "office", country: ["US", "GB", "AU", "CA"], fromYear: 1980 }, ["회사 퇴직연금 매칭", "会社の退職金マッチング", "The Retirement Match"], ["회사가 퇴직연금에 넣는 만큼 같은 금액을 더 넣어 준다고 한다.", "会社が退職年金に入れた分と同額を上乗せしてくれるという。", "Your employer matches whatever you put into the retirement plan."], [
  ["max", "📈", ["매칭 최대로 넣는다", "マッチング上限まで入れる", "Contribute up to the full match"], { grade: "good", effects: { money: 600, intel: 1 }, flag: { add: "pension_plus" }, n: ["회사가 공짜 돈을 줬다. 30년 뒤 그 숫자가 놀라웠다.", "会社がただでお金をくれた。三十年後、その数字に驚いた。", "Free money from my employer. Thirty years later, the number was astonishing."] }],
  ["skip", "🙃", ["월급이 줄어서 싫다", "手取りが減るのは嫌だ", "Don't want a smaller paycheck"], { effects: { money: 50 }, n: ["몇 년 뒤 동료가 그 계산을 보여 줬다. 아팠다.", "数年後、同僚がその計算を見せてくれた。痛かった。", "Years later, a coworker showed me the math. Ouch."] }],
]);
M("remittance", { age: [20, 55], emoji: "💸", scene: "airport", country: ["IN", "MX", "EG", "BR", "CN"] }, ["가족에게 보내는 돈", "家族への仕送り", "Sending Money Home"], ["도시(외국)에서 번 돈을 고향 가족에게 보내 달라는 연락이 왔다.", "都会(外国)で稼いだお金を故郷の家族に送ってほしいと連絡が来た。", "Family back home asks you to send money from your city (or overseas) wages."], [
  ["send", "📤", ["매달 보낸다", "毎月送る", "Send some every month"], { grade: "good", effects: { money: -300, social: 4, happy: 3 }, n: ["동생이 그 돈으로 학교를 마쳤다. 졸업 사진이 메시지로 왔다.", "弟妹がそのお金で学校を出た。卒業写真がメッセージで届いた。", "My sibling finished school on that money. Their graduation photo arrived by message."] }],
  ["save", "🏦", ["내 미래를 먼저 생각한다", "自分の将来を先に考える", "Put your own future first"], { effects: { money: 200, social: -2, happy: -1 }, n: ["전화 너머 어머니 목소리가 조금 작아졌다.", "電話越しの母の声が少し小さくなった。", "Mother's voice on the phone got a little quieter."] }],
]);
M("microloan", { age: [20, 55], emoji: "🧵", scene: "shop", country: ["IN", "BR", "MX", "EG"] }, ["작은 대출", "小口融資", "A Microloan"], ["마을 여성 조합이 작은 가게를 열 수 있게 소액 대출을 해 준다고 한다.", "村の女性組合が小さな店を開けるよう小口融資をしてくれるという。", "A village cooperative offers a small loan to open a little shop."], [
  ["open", "🏪", ["대출받아 가게를 연다", "融資を受けて店を開く", "Take it and open a stall"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 500, social: 3, happy: 4 }, n: ["작은 가게가 동네 사랑방이 됐다. 대출은 1년 만에 갚았다.", "小さな店が町の社交場になった。融資は一年で返した。", "The little shop became the neighborhood hangout. Repaid the loan in a year."] },
    { chance: 0.4, grade: "mid", effects: { money: -150, intel: 2 }, n: ["장사는 어려웠지만 셈법은 확실히 배웠다.", "商売は難しかったが、計算は確かに身についた。", "Business was tough, but I really learned to do the math."] }] }],
  ["no", "🙅", ["아직은 겁이 난다", "まだ怖い", "Too scared for now"], { effects: { happy: -1 }, n: ["옆집이 그 대출로 국수 가게를 열었다.", "隣がその融資で麺屋を開いた。", "My neighbor opened a noodle stall with it."] }],
]);
M("property_tax", { age: [35, 85], emoji: "🏘️", scene: "home", cond: (p) => p.housing === "own" }, ["집값이 올랐다", "家の値段が上がった", "Your Home's Value Went Up"], ["내 집 시세가 많이 올랐다. 팔까, 계속 살까.", "我が家の相場がかなり上がった。売るか、住み続けるか。", "Your home's value has jumped. Sell, or stay?"], [
  ["stay", "🏡", ["계속 산다", "住み続ける", "Stay"], { grade: "good", effects: { happy: 3 }, n: ["숫자가 올랐어도 우리 집은 그냥 우리 집이었다.", "数字が上がっても、我が家はただの我が家だった。", "Numbers aside, home was just home."] }],
  ["sell", "💰", ["팔고 작은 집으로", "売って小さな家へ", "Sell and downsize"], { effects: { money: 3000, happy: -1 }, life: { housing: "rent" }, n: ["통장이 두둑해졌다. 대신 아이들 키 재던 문틀을 두고 왔다.", "通帳が厚くなった。代わりに子どもの背を測った柱を置いてきた。", "The bank account swelled. But I left behind the doorframe where we marked the kids' heights."] }],
]);
M("donate", { age: [25, 95], emoji: "💝", scene: "street", cond: (p) => p.stats.money >= 1000 }, ["기부 요청", "寄付のお願い", "A Donation Request"], ["재난 지역 돕기 모금 방송이 나온다.", "被災地支援の募金番組が流れている。", "A telethon for a disaster area is on TV."], [
  ["give", "🤲", ["넉넉히 기부한다", "たっぷり寄付する", "Donate generously"], { grade: "good", effects: { money: -200, happy: 5, social: 2 }, flag: { add: "donor" }, n: ["감사 문자 한 통이 그날 하루를 따뜻하게 했다.", "感謝のメッセージ一通がその日を温かくした。", "One thank-you text warmed the whole day."] }],
  ["small", "🪙", ["조금만", "少しだけ", "Give a little"], { effects: { money: -20, happy: 2 }, n: ["적은 돈이었지만 마음은 보냈다.", "少額だったが気持ちは送った。", "Small, but my heart was in it."] }],
  ["no", "📺", ["채널을 돌린다", "チャンネルを変える", "Change the channel"], { effects: { happy: -1 }, n: ["다음 날 길에서 모금함을 보고 동전을 넣었다.", "翌日道で募金箱を見て小銭を入れた。", "The next day I dropped coins in a street collection box."] }],
]);
M("teach_kids_money", { age: [30, 60], emoji: "🧒", scene: "kitchen", hasKid: true }, ["아이에게 돈 가르치기", "子どもにお金を教える", "Teaching Your Kid About Money"], ["아이가 친구들은 다 있다며 비싼 물건을 사 달라고 조른다.", "子どもが友達はみんな持っていると高い物をねだる。", "Your kid begs for something expensive: 'Everyone has one!'"], [
  ["earn", "🧹", ["집안일로 용돈을 벌게 한다", "家事でおこづかいを稼がせる", "Let them earn it with chores"], { grade: "good", effects: { happy: 2, intel: 1 }, n: ["석 달 만에 스스로 샀다. 그 물건을 정말 아꼈다.", "三か月で自分で買った。その物をとても大切にした。", "They bought it themselves in three months — and treasured it."] }],
  ["buy", "🛍️", ["그냥 사 준다", "そのまま買ってあげる", "Just buy it"], { effects: { happy: 2, money: -50 }, n: ["일주일 뒤 그건 서랍에 들어갔다.", "一週間後、それは引き出しにしまわれた。", "A week later, it was in a drawer."] }],
  ["no", "✋", ["안 된다고 한다", "だめだと言う", "Say no"], { effects: { happy: -1 }, n: ["아이는 울었고, 다음 주엔 잊었다.", "子どもは泣いて、翌週には忘れていた。", "They cried, then forgot by the next week."] }],
]);
M("old_debt_paid", { age: [30, 70], emoji: "🎉", scene: "home", cond: (p) => p.stats.money > 0 && (p.minMoney ?? 0) < -500 }, ["빚 청산", "借金完済", "Debt-Free at Last"], ["마지막 대출 상환 버튼만 누르면 된다.", "最後のローン返済ボタンを押すだけだ。", "One button left: the final loan payment."], [
  ["press", "✅", ["누른다", "押す", "Press it"], { grade: "crit", effects: { happy: 9, health: 1 }, flag: { add: "debt_free" }, n: ["화면에 '잔액 0원'이 떴다. 한참 동안 그 화면을 캡처해 두었다.", "画面に「残高0」と出た。しばらくその画面をスクショした。", "'Balance: 0' appeared. I screenshotted it, then just stared."] }],
  ["party", "🎉", ["누르고 가족과 파티한다", "押して家族とパーティーする", "Press it and throw a family party"], { grade: "good", effects: { happy: 8, social: 3, money: -50 }, flag: { add: "debt_free" }, n: ["케이크에 '빚 끝'이라고 썼다. 아이들이 무슨 뜻이냐고 물었다.", "ケーキに「借金おわり」と書いた。子どもたちが意味を聞いた。", "We wrote 'DEBT FREE' on a cake. The kids asked what it meant."] }],
]);
M("windfall_choice", { age: [25, 70], emoji: "💌", scene: "home" }, ["뜻밖의 보너스", "思いがけないボーナス", "An Unexpected Bonus"], ["예상 못 한 보너스가 들어왔다.", "思いがけないボーナスが入った。", "An unexpected bonus lands in your account."], [
  ["invest", "📈", ["투자한다", "投資する", "Invest it"], { effects: { money: 300, intel: 1 }, n: ["몇 년 뒤 조금 불어 있었다.", "数年後、少し増えていた。", "A few years later, it had grown a bit."] }],
  ["family", "👨‍👩‍👧", ["가족 여행", "家族旅行", "A family trip"], { grade: "good", effects: { happy: 6, social: 2, money: -100 }, flag: { add: "travel" }, n: ["돈은 사라졌지만 사진은 남았다.", "お金は消えたが写真は残った。", "The money vanished; the photos remained."] }],
  ["debt", "🧾", ["빚부터 갚는다", "借金から返す", "Pay down debt"], { grade: "good", effects: { money: 200, happy: 2 }, n: ["이자가 줄어드는 게 눈에 보였다.", "利息が減っていくのが目に見えた。", "I could see the interest shrinking."] }],
]);
M("rich_friend_lifestyle", { age: [25, 50], emoji: "🥂", scene: "restaurant" }, ["비싼 모임", "高い集まり", "An Expensive Crowd"], ["새로 사귄 사람들은 한 끼에 내 일주일 식비를 쓴다.", "新しくできた仲間は一食で私の一週間の食費を使う。", "Your new friends spend a week of your food budget on one dinner."], [
  ["match", "💳", ["맞춰서 쓴다", "合わせて使う", "Keep up with them"], { grade: "bad", effects: { money: -500, social: 3, happy: 1 }, n: ["인스타 사진은 화려했고 통장은 텅 비었다.", "インスタの写真は華やかで、通帳は空っぽだった。", "My photos looked amazing. My account was empty."] }],
  ["honest", "🙂", ["솔직하게 말하고 다른 걸 제안한다", "正直に言って別の案を出す", "Be honest and suggest something else"], { grade: "good", effects: { social: 2, happy: 2 }, n: ["몇 명은 멀어졌다. 남은 사람들과 한강에서 컵라면을 먹었다.", "何人かは離れた。残った人と川辺でカップ麺を食べた。", "A few drifted away. With the rest, I ate cup noodles by the river."] }],
]);
M("estate_will", { age: [60, 95], emoji: "📜", scene: "home" }, ["유언장", "遺言書", "Writing a Will"], ["주변에서 유언장을 미리 써 두라고 한다.", "周りから遺言書を早めに書いておくよう言われる。", "People suggest you write a will while you can."], [
  ["write", "🖋️", ["가족과 상의해 쓴다", "家族と相談して書く", "Write it with the family"], { grade: "good", effects: { happy: 3, social: 2 }, flag: { add: "will_written" }, n: ["돈 이야기를 하다가 옛날이야기를 더 많이 했다.", "お金の話から始めて、昔話の方が多くなった。", "We started with money and ended up mostly telling old stories."] }],
  ["later", "⏳", ["아직 이르다", "まだ早い", "It's too early"], { effects: { happy: 1 }, n: ["달력에 '다음 달'이라고 적어 두었다.", "カレンダーに「来月」と書いておいた。", "I wrote 'next month' on the calendar."] }],
]);
M("reverse_mortgage", { age: [65, 95], emoji: "🏠", scene: "retire", cond: (p) => p.housing === "own" && p.stats.money < 3000 }, ["집으로 받는 연금", "住宅担保年金", "Living Off Your Home"], ["집을 담보로 매달 연금을 받는 상품이 있다고 한다.", "家を担保に毎月年金を受け取る商品があるという。", "There's a plan that pays you monthly using your house as collateral."], [
  ["take", "🔑", ["가입한다", "加入する", "Sign up"], { grade: "good", effects: { money: 600, happy: 3 }, n: ["매달 들어오는 돈으로 손주 학비를 조금 보탰다.", "毎月入るお金で孫の学費を少し助けた。", "The monthly payments helped cover a bit of my grandkid's tuition."] }],
  ["keep", "🏡", ["집은 자식에게 물려준다", "家は子に遺す", "Leave the house to the children"], { effects: { happy: 1, money: -50 }, n: ["아끼며 살았지만 집은 지켰다.", "節約して暮らしたが家は守った。", "Lived frugally, but kept the house."] }],
]);
M("small_biz_tax", { age: [28, 70], emoji: "🧮", scene: "shop", cond: (p) => p.career === "business" }, ["세무 조사 통지", "税務調査の通知", "A Tax Audit Notice"], ["가게에 세무 조사 안내문이 왔다.", "店に税務調査の案内が届いた。", "Your business receives a tax audit notice."], [
  ["clean", "📂", ["장부를 그대로 보여 준다", "帳簿をそのまま見せる", "Show the books as they are"], { outcomes: [
    { chance: 0.7, grade: "good", effects: { happy: 2, intel: 1 }, n: ["깨끗했다. 조사관이 장부를 칭찬했다.", "きれいだった。調査官が帳簿を褒めた。", "All clean. The auditor complimented my bookkeeping."] },
    { chance: 0.3, grade: "mid", effects: { money: -300 }, n: ["실수가 몇 개 있었다. 가산세를 냈다.", "ミスがいくつかあった。加算税を払った。", "A few mistakes. I paid the penalty."] }] }],
  ["accountant", "🧑‍💼", ["세무사를 고용한다", "税理士を雇う", "Hire an accountant"], { grade: "good", effects: { money: -80, happy: 1 }, n: ["그 뒤로 매년 그 세무사와 일했다.", "それ以来毎年その税理士と仕事をした。", "I worked with that accountant every year after."] }],
]);
M("coupon_master", { age: [30, 80], emoji: "✂️", scene: "market" }, ["쿠폰 달인", "クーポンの達人", "The Coupon Master"], ["마트 전단지를 보니 쿠폰이 잔뜩이다.", "スーパーのチラシにクーポンがいっぱい。", "The supermarket flyer is packed with coupons."], [
  ["clip", "✂️", ["다 오려서 계획을 짠다", "全部切り抜いて計画を立てる", "Clip them all and plan the trip"], { grade: "good", effects: { money: 40, intel: 1, happy: 2 }, n: ["계산대에서 금액이 쭉쭉 내려갔다. 뒤에 선 사람이 박수를 쳤다.", "レジで金額がどんどん下がった。後ろの人が拍手した。", "The total kept dropping at the register. The person behind me clapped."] }],
  ["skip", "🗑️", ["귀찮다", "面倒だ", "Too much effort"], { effects: { happy: 1 }, n: ["전단지는 냄비 받침이 됐다.", "チラシは鍋敷きになった。", "The flyer became a pot holder."] }],
]);
M("fx_travel", { age: [20, 70], emoji: "💱", scene: "airport", fromYear: 1989 }, ["환전 타이밍", "両替のタイミング", "When to Exchange Money"], ["해외여행을 앞두고 환율이 매일 바뀐다.", "海外旅行を前に為替が毎日変わる。", "Your overseas trip is coming, and exchange rates change daily."], [
  ["split", "📅", ["나눠서 환전한다", "分けて両替する", "Exchange in batches"], { grade: "good", effects: { money: 20, intel: 1 }, n: ["평균값으로 바꿨다. 마음이 편했다.", "平均値で両替した。気が楽だった。", "Got an average rate. Peace of mind."] }],
  ["gamble", "🎯", ["더 오를 때까지 버틴다", "もっと上がるまで粘る", "Wait for a better rate"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { money: 40, happy: 2 }, n: ["딱 좋은 날 바꿨다.", "ちょうどいい日に両替できた。", "Nailed the perfect day."] },
    { chance: 0.5, grade: "mid", effects: { money: -30 }, n: ["출발 전날 제일 비쌀 때 바꿨다.", "出発前日、一番高い時に両替した。", "Exchanged the day before, at the worst rate."] }] }],
]);
M("kid_first_salary_gift", { age: [48, 75], emoji: "🎁", scene: "home", hasKid: true }, ["아이의 첫 월급 선물", "子どもの初給料のプレゼント", "Your Child's First-Paycheck Gift"], ["아이가 첫 월급으로 선물을 사 왔다.", "子どもが初給料でプレゼントを買ってきた。", "Your child bought you a gift with their first paycheck."], [
  ["cry", "🥹", ["울컥한다", "胸がいっぱいになる", "Get choked up"], { grade: "crit", effects: { happy: 8 }, n: ["포장지까지 버리지 못하고 서랍에 넣었다.", "包装紙まで捨てられず引き出しにしまった。", "I couldn't even throw away the wrapping paper. It went in a drawer."] }],
  ["save", "🏦", ["그 돈 아껴 쓰라고 잔소리한다", "そのお金を大事にしろと小言を言う", "Lecture them about saving"], { effects: { happy: 4 }, n: ["잔소리하면서도 그 선물을 매일 썼다.", "小言を言いながらも、そのプレゼントを毎日使った。", "I nagged, but used that gift every single day."] }],
]);
M("unemployment_benefit", { age: [22, 60], emoji: "📋", scene: "jobhunt", cond: (p) => !p.job, fromYear: 1995 }, ["실업 급여", "失業手当", "Unemployment Benefits"], ["회사를 그만두고 나니 실업 급여를 신청할 수 있다고 한다.", "会社を辞めると失業手当を申請できるという。", "Now that you've left your job, you can apply for unemployment benefits."], [
  ["apply", "📝", ["신청하고 구직 활동을 한다", "申請して求職活動をする", "Apply and job-hunt"], { grade: "good", effects: { money: 400, intel: 1 }, n: ["매달 구직 활동 서류를 내면서 이력서도 다듬어졌다.", "毎月求職活動の書類を出すうちに履歴書も磨かれた。", "Filing monthly job-search reports polished my résumé too."] }],
  ["skip", "🙅", ["창피해서 안 한다", "恥ずかしくて申請しない", "Too embarrassed to apply"], { effects: { happy: -2, money: -100 }, n: ["나중에 알고 보니 당연한 권리였다.", "後で知ったら当然の権利だった。", "I later learned it was simply my right."] }],
]);
M("kid_wedding_support", { age: [52, 80], emoji: "💒", scene: "wedding", hasKid: true }, ["자녀 결혼 비용", "子どもの結婚費用", "Helping with Your Child's Wedding"], ["아이가 결혼한다. 집 마련을 도와 달라는 눈치다.", "子どもが結婚する。住まいの援助を期待しているようだ。", "Your child is getting married and seems to hope you'll help with housing."], [
  ["help", "🏠", ["노후 자금 일부를 보탠다", "老後資金の一部を出す", "Contribute part of your retirement savings"], { effects: { money: -2000, happy: 4, social: 2 }, n: ["신혼집 열쇠를 받는 아이 얼굴을 봤다. 노후는 조금 빠듯해졌다.", "新居の鍵を受け取る子の顔を見た。老後は少し苦しくなった。", "I saw my child's face as they got the keys. Retirement got a little tighter."] }],
  ["talk", "🗣️", ["형편을 솔직히 말하고 조금만", "懐事情を正直に話して少しだけ", "Be honest and give a little"], { grade: "good", effects: { money: -500, happy: 2, intel: 1 }, n: ["아이는 '괜찮아, 우리가 할게'라고 했다. 대견했다.", "子どもは「大丈夫、自分たちでやる」と言った。頼もしかった。", "They said, 'It's okay, we'll manage.' I was proud."] }],
]);
M("savings_compound", { age: [25, 35], emoji: "🌱", scene: "office" }, ["복리의 마법", "複利の魔法", "The Magic of Compounding"], ["선배가 냅킨에 복리 계산을 해 보여 줬다. 일찍 시작하라고.", "先輩がナプキンに複利の計算をして見せた。早く始めろと。", "A senior scribbles compound interest on a napkin. 'Start early.'"], [
  ["start", "🌱", ["오늘부터 자동이체", "今日から自動積立", "Set up auto-saving today"], { grade: "good", effects: { money: 800, intel: 2 }, flag: { add: "investor" }, n: ["잊고 지냈다. 20년 뒤 그 냅킨이 생각났다.", "忘れて過ごした。二十年後、あのナプキンを思い出した。", "I forgot about it. Twenty years later, I thought of that napkin."] }],
  ["later", "⏰", ["월급 오르면", "給料が上がったら", "When I get a raise"], { effects: { happy: 1 }, n: ["월급은 올랐고, 시작은 계속 미뤄졌다.", "給料は上がり、始めるのはずっと先延ばしになった。", "The raises came; the start kept slipping."] }],
]);
M("black_market_era", { age: [16, 60], emoji: "🎒", scene: "market", era: ["early", "past"], calYear: [1945, 1965] }, ["암시장", "闇市", "The Black Market"], ["전쟁 뒤라 물건이 귀하다. 암시장에서 장사를 하면 돈이 된다고 한다.", "戦後で物が乏しい。闇市で商売をすれば儲かるという。", "After the war, goods are scarce. Trading on the black market pays."], [
  ["trade", "📦", ["보따리 장사를 한다", "担ぎ屋をする", "Become a street trader"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 300, social: 2 }, n: ["새벽마다 짐을 졌다. 그 돈으로 동생들을 먹였다.", "毎朝荷を担いだ。そのお金で弟妹を食べさせた。", "I hauled goods every dawn. That money fed my siblings."] },
    { chance: 0.4, grade: "bad", effects: { money: -150, happy: -3 }, n: ["단속에 걸려 물건을 다 빼앗겼다.", "取り締まりで品物を全部没収された。", "A crackdown took everything I had."] }] }],
  ["honest", "🧱", ["공사장 날품을 판다", "工事現場の日雇いをする", "Do day labor at construction sites"], { effects: { money: 120, health: -2, power: 2 }, n: ["손에 굳은살이 박였다. 그래도 떳떳했다.", "手にタコができた。それでも胸を張れた。", "My hands grew calluses. But I could hold my head up."] }],
]);

export const MONEY_EVENTS = EV;
