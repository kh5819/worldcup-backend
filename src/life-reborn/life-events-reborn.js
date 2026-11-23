// =========================
// 플듀 인생게임 REBORN — 새 사건 (2026-11-22): 꿈 사슬 12갈래 × 5단계 + 생활 사건
// · 꿈 사슬: 나만의 인생에서 쓴 꿈·장래희망(직업 낱말) 또는 고른 관심사가 있으면 그 갈래가 열림
//   1단계(7~12살 첫 만남) → 2단계(13~18살 연습·대회) → 3단계(19~24살 갈림길: 직업으로·취미로·내려놓기)
//   → 4단계(32~46살 "아직 하고 있나") → 5단계(60~78살 직접 쓴 꿈 {dream} 회상)
// · 사건 형식은 옛 엔진(v2)과 같음. 글은 한국어 원문 + 아래 TR(일본어·영어)을 번역 사전에 끼워 넣음
// =========================

import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const has = (f) => (p) => p.flags.has(f);
const theme = (career, interest) => (p) => (p.dreamKeys || []).includes(career) || (interest && (p.interests || []).includes(interest));

// ---------- 꿈 사슬 ----------
// 갈래: [키, 직업 키, 관심사, 이모지, 이름(ko/ja/en), 1~5단계 글]
const CHAINS = [
  ["music", "idol", "music", "🎵",
    { t1: ["학교 음악실의 피아노", "学校の音楽室のピアノ", "The Piano in the Music Room"], d1: ["방과 후 음악실, 아무도 없는 피아노 앞에 앉았다. 손가락이 저절로 건반을 눌렀다.", "放課後の音楽室、誰もいないピアノの前に座った。指が勝手に鍵盤を押した。", "After school, alone at the music room piano, your fingers pressed the keys on their own."],
      t2: ["교내 음악 경연 대회", "校内音楽コンクール", "The School Music Contest"], d2: ["음악 선생님이 경연 대회에 나가 보라고 했다. 무대는 처음이다.", "音楽の先生がコンクールに出てみろと言った。舞台は初めてだ。", "Your music teacher suggests entering the contest. It would be your first stage."],
      t3: ["음악으로 먹고살 수 있을까", "音楽で食べていけるだろうか", "Can Music Pay the Bills?"], d3: ["오디션 공고와 취업 공고가 나란히 떠 있다. 어느 쪽 창을 먼저 닫을까.", "オーディションの告知と求人情報が並んでいる。どちらの画面を先に閉じる?", "An audition notice and a job listing sit side by side. Which tab do you close first?"],
      t4: ["오래된 악기 케이스", "古い楽器ケース", "An Old Instrument Case"], d4: ["창고 정리를 하다 먼지 쌓인 악기 케이스를 찾았다.", "倉庫を片付けていて、ほこりをかぶった楽器ケースを見つけた。", "Clearing out storage, you find a dusty instrument case."],
      d5: ["손주뻘 아이가 노래를 흥얼거린다. 오래전 적어 둔 꿈이 떠오른다 — '{dream}'.", "孫ほどの子が歌を口ずさむ。昔書いた夢を思い出す — 「{dream}」。", "A child about your grandchild's age hums a tune. The dream you once wrote comes back: \"{dream}\"."] }],
  ["art", "artist", "art", "🎨",
    { t1: ["크레파스 한 상자", "クレヨンひと箱", "A Box of Crayons"], d1: ["새 크레파스 한 상자를 선물 받았다. 하얀 도화지가 넓어 보였다.", "新しいクレヨンをもらった。白い画用紙が広く見えた。", "You get a new box of crayons. The blank paper looks enormous."],
      t2: ["미술 대회 출품", "美術コンクールへの出品", "Entering an Art Contest"], d2: ["미술 선생님이 내 그림을 대회에 내 보자고 했다.", "美術の先生が私の絵をコンクールに出そうと言った。", "Your art teacher wants to enter your painting in a contest."],
      t3: ["그림을 직업으로", "絵を仕事に", "Painting for a Living"], d3: ["포트폴리오를 들고 서 있다. 이 길로 가면 돌아오기 어렵다.", "ポートフォリオを抱えて立っている。この道を行けば引き返しにくい。", "You stand holding your portfolio. This road is hard to come back from."],
      t4: ["다시 붓을 들까", "もう一度筆を取るか", "Pick Up the Brush Again?"], d4: ["문화센터 수채화 강좌 전단지가 우편함에 꽂혀 있다.", "カルチャーセンターの水彩画講座のチラシが郵便受けに挟まっている。", "A flyer for a watercolor class is tucked into your mailbox."],
      d5: ["창밖 풍경이 그림처럼 보이는 오후. 어린 시절의 꿈 '{dream}'이 생각났다.", "窓の外の景色が絵のように見える午後。子どもの頃の夢「{dream}」を思い出した。", "An afternoon when the view looks like a painting. You remember your childhood dream: \"{dream}\"."] }],
  ["sports", "athlete", "sports", "⚽",
    { t1: ["운동장 끝까지 달리기", "グラウンドの端まで走る", "Running to the Far End of the Field"], d1: ["체육 시간, 반에서 제일 빨리 달렸다. 숨이 차는 게 좋았다.", "体育の時間、クラスで一番速く走った。息が切れるのが気持ちよかった。", "In PE you ran faster than anyone. You loved being out of breath."],
      t2: ["선수부 제안", "選手部への誘い", "An Invitation to the Team"], d2: ["코치가 학교 선수부에 들어오라고 했다. 매일 새벽 훈련이다.", "コーチが学校の選手部に入れと言った。毎日早朝練習だ。", "The coach invites you onto the school team. Training is every dawn."],
      t3: ["프로냐 대학이냐", "プロか大学か", "Pro or College?"], d3: ["실업팀 입단 제안과 대학 합격 통지가 같은 주에 왔다.", "実業団からの誘いと大学の合格通知が同じ週に届いた。", "A pro team offer and a college acceptance arrive the same week."],
      t4: ["동네 조기축구회", "町の早朝サッカー会", "The Neighborhood Morning League"], d4: ["주말 아침, 동네 조기축구회에서 사람이 모자라다고 연락이 왔다.", "週末の朝、町の早朝サッカー会から人が足りないと連絡が来た。", "On a weekend morning, the local league calls: they're one player short."],
      d5: ["공원에서 공 차는 아이들을 오래 바라보았다. '{dream}' — 그 시절의 꿈이었다.", "公園でボールを蹴る子どもたちを長く眺めた。「{dream}」 — あの頃の夢だった。", "You watch kids kick a ball in the park for a long time. \"{dream}\" — that was the dream back then."] }],
  ["code", "developer", "tech", "💻",
    { t1: ["처음 만든 게임", "初めて作ったゲーム", "My First Game"], d1: ["학교 컴퓨터 시간에 블록 코딩으로 간단한 게임을 만들었다.", "学校のパソコンの時間に、ブロックコーディングで簡単なゲームを作った。", "In computer class you build a simple game with block coding."],
      t2: ["코딩 대회", "プログラミング大会", "A Coding Contest"], d2: ["청소년 코딩 대회 공고를 봤다. 밤새 문제를 풀어야 한다.", "青少年プログラミング大会の告知を見た。徹夜で問題を解くことになる。", "You see a youth coding contest. It means solving problems all night."],
      t3: ["개발자가 될까", "開発者になるか", "Become a Developer?"], d3: ["부트캠프 합격 메일이 왔다. 6개월이면 인생이 바뀔 수도 있다.", "ブートキャンプ合格のメールが来た。6か月で人生が変わるかもしれない。", "A bootcamp acceptance email arrives. Six months could change your life."],
      t4: ["사이드 프로젝트", "サイドプロジェクト", "A Side Project"], d4: ["퇴근 후 머릿속에 떠오른 앱 아이디어가 떠나지 않는다.", "退勤後に浮かんだアプリのアイデアが頭から離れない。", "An app idea from your commute won't leave your head."],
      d5: ["손녀가 태블릿으로 게임을 만든다며 보여 줬다. 오래전 꿈 '{dream}'이 떠올랐다.", "孫娘がタブレットでゲームを作ったと見せてくれた。昔の夢「{dream}」がよみがえった。", "Your granddaughter shows you a game she made on a tablet. Your old dream, \"{dream}\", comes back."] }],
  ["write", "writer", "books", "📖",
    { t1: ["일기장 한 권", "日記帳一冊", "One Diary"], d1: ["새 일기장을 샀다. 첫 장을 무엇으로 채울까.", "新しい日記帳を買った。最初のページを何で埋めよう。", "You buy a new diary. What should fill the first page?"],
      t2: ["백일장", "作文コンクール", "A Writing Contest"], d2: ["교내 백일장 주제가 '나의 꿈'이다.", "校内作文コンクールのテーマは「私の夢」だ。", "The school writing contest topic is 'My Dream'."],
      t3: ["글로 살아 볼까", "文章で生きてみるか", "Live by Writing?"], d3: ["습작 원고가 서랍 가득이다. 투고를 할까, 접을까.", "習作原稿が引き出しいっぱいだ。投稿するか、しまっておくか。", "Your drawer is full of drafts. Submit them, or put them away?"],
      t4: ["다시 펜을 들다", "再びペンを取る", "Picking Up the Pen Again"], d4: ["오랜만에 연 블로그에 마지막 글은 10년 전 날짜였다.", "久しぶりに開いたブログの最後の記事は10年前だった。", "You open your old blog. The last post is ten years old."],
      d5: ["책장 정리를 하다 어릴 적 일기장을 찾았다. 첫 장에 적혀 있다 — '{dream}'.", "本棚を整理していて幼い頃の日記帳を見つけた。最初のページにこう書いてある — 「{dream}」。", "Sorting the bookshelf, you find your childhood diary. The first page says: \"{dream}\"."] }],
  ["med", "doctor", "science", "🩺",
    { t1: ["장난감 청진기", "おもちゃの聴診器", "A Toy Stethoscope"], d1: ["병원 놀이 세트를 받았다. 인형들이 줄줄이 진찰을 기다린다.", "お医者さんごっこセットをもらった。人形たちが順番に診察を待っている。", "You get a toy doctor kit. A line of dolls waits for a checkup."],
      t2: ["과학 동아리", "科学部", "The Science Club"], d2: ["생물 실험 동아리에서 회원을 모집한다. 개구리 해부도 한다고 한다.", "生物実験の部が部員を募集している。カエルの解剖もするらしい。", "The biology club is recruiting. Rumor says they dissect frogs."],
      t3: ["의대 입시", "医学部受験", "Medical School Exams"], d3: ["의대 원서 마감이 내일이다. 재수까지 각오해야 할 수도 있다.", "医学部の願書締め切りは明日だ。浪人も覚悟しなければならないかもしれない。", "The medical school deadline is tomorrow. It might take another year of study."],
      t4: ["봉사 진료", "ボランティア診療", "Volunteer Clinic"], d4: ["지역 의료 봉사단에서 주말 일손이 필요하다고 한다.", "地域の医療ボランティア団体が週末の人手を求めている。", "A local medical volunteer group needs weekend help."],
      d5: ["진료실에 앉아 오래된 장난감 청진기를 떠올렸다. 꿈은 '{dream}'이었다.", "診察室に座り、古いおもちゃの聴診器を思い出した。夢は「{dream}」だった。", "Sitting in a clinic, you remember that toy stethoscope. The dream was \"{dream}\"."] }],
  ["teach", "teacher", "people", "🍎",
    { t1: ["선생님 놀이", "先生ごっこ", "Playing Teacher"], d1: ["동생들을 앉혀 놓고 칠판 대신 벽에 글씨를 썼다.", "弟たちを座らせて、黒板の代わりに壁に字を書いた。", "You sat the little ones down and wrote on the wall like a blackboard."],
      t2: ["멘토링", "メンタリング", "Mentoring"], d2: ["학교에서 후배 공부 도우미를 뽑는다.", "学校で後輩の勉強サポーターを募集している。", "The school is picking study mentors for younger students."],
      t3: ["교사의 길", "教師の道", "The Teaching Path"], d3: ["교육대학 원서와 일반 대학 원서가 책상 위에 나란히 있다.", "教育大学と一般大学の願書が机の上に並んでいる。", "Applications for a teachers' college and a regular university lie side by side."],
      t4: ["가르치는 기쁨", "教える喜び", "The Joy of Teaching"], d4: ["주민센터에서 아이들 공부방 자원봉사자를 찾는다.", "住民センターが子ども学習室のボランティアを探している。", "The community center needs volunteers for a kids' study room."],
      d5: ["예전 제자에게서 편지가 왔다. 어릴 적 꿈 '{dream}'이 생각나 웃었다.", "昔の教え子から手紙が届いた。子どもの頃の夢「{dream}」を思い出して笑った。", "A letter arrives from a former student. Remembering your childhood dream, \"{dream}\", you smile."] }],
  ["biz", "business", "money", "💼",
    { t1: ["학교 앞 문구점 놀이", "学校前の文房具屋ごっこ", "Running a Pretend Shop"], d1: ["친구들과 쓰지 않는 장난감을 모아 벼룩시장을 열었다.", "友達と使わないおもちゃを集めてフリーマーケットを開いた。", "You and your friends gather old toys and open a flea market."],
      t2: ["첫 장사", "初めての商売", "First Business"], d2: ["축제 때 반에서 먹거리 장사를 하기로 했다. 총무를 맡을까.", "文化祭でクラスが屋台を出すことになった。会計を引き受けるか。", "Your class is running a food stall at the festival. Take charge of the money?"],
      t3: ["창업이냐 취업이냐", "起業か就職か", "Start Up or Sign On?"], d3: ["사업 아이템 노트가 벌써 세 권째다. 합격 통보 전화도 왔다.", "事業アイデアのノートはもう三冊目だ。内定の電話も来た。", "Your notebook of business ideas is on volume three. A job offer call just came in."],
      t4: ["다시 사업을", "もう一度事業を", "Business, Again?"], d4: ["오랜 친구가 같이 가게를 해 보자고 한다.", "古い友人が一緒に店をやろうと言う。", "An old friend asks you to open a shop together."],
      d5: ["시장 골목을 걷다 어릴 적 벼룩시장이 생각났다. 꿈은 '{dream}'이었다.", "市場の路地を歩いていて、幼い頃のフリーマーケットを思い出した。夢は「{dream}」だった。", "Walking a market alley, you remember your childhood flea market. The dream was \"{dream}\"."] }],
  ["stream", "streamer", "games", "🎥",
    { t1: ["처음 찍은 영상", "初めて撮った動画", "My First Video"], d1: ["엄마 휴대폰으로 장난감 리뷰 영상을 찍어 봤다.", "母のスマホでおもちゃのレビュー動画を撮ってみた。", "You film a toy review on your mom's phone."],
      t2: ["채널 개설", "チャンネル開設", "Opening a Channel"], d2: ["친구들이 게임하는 걸 방송해 보라고 부추긴다.", "友達がゲーム配信をしてみろとそそのかす。", "Friends egg you on to stream your gaming."],
      t3: ["전업 방송인", "専業配信者", "Full-Time Creator"], d3: ["구독자는 늘고 있지만 수입은 들쭉날쭉하다. 전업으로 갈까.", "登録者は増えているが収入は不安定だ。専業になるか。", "Subscribers are growing but income is spotty. Go full-time?"],
      t4: ["다시 카메라 앞에", "再びカメラの前に", "Back in Front of the Camera"], d4: ["잠자던 채널에 '요즘 뭐 하세요?'라는 댓글이 달렸다.", "眠っていたチャンネルに「最近何してますか?」とコメントがついた。", "A comment appears on your dormant channel: 'What are you up to these days?'"],
      d5: ["오래된 채널의 첫 영상을 다시 틀었다. 어린 내가 말한다. 꿈은 '{dream}'.", "古いチャンネルの最初の動画を再生した。幼い自分が話している。夢は「{dream}」。", "You replay the first video on your old channel. Your young self speaks. The dream: \"{dream}\"."] }],
  ["cook", "business", "cooking", "🍳",
    { t1: ["첫 계란 프라이", "初めての目玉焼き", "My First Fried Egg"], d1: ["부엌에서 혼자 계란 프라이를 해 봤다. 노른자가 터졌다.", "台所で一人で目玉焼きを作ってみた。黄身が割れた。", "You try frying an egg alone. The yolk breaks."],
      t2: ["요리 동아리", "料理部", "The Cooking Club"], d2: ["요리 동아리 축제 메뉴를 내가 정하게 됐다.", "料理部の文化祭メニューを私が決めることになった。", "You get to choose the cooking club's festival menu."],
      t3: ["요리 학교", "料理学校", "Culinary School"], d3: ["조리 학교 입학 원서를 들고 망설인다.", "調理学校の入学願書を手に迷っている。", "You hesitate, holding a culinary school application."],
      t4: ["나만의 식당", "自分の食堂", "A Restaurant of My Own"], d4: ["골목 끝 작은 가게 자리가 비었다는 소식을 들었다.", "路地の奥の小さな店舗が空いたと聞いた。", "You hear a little shop at the end of the alley is vacant."],
      d5: ["가족 모두를 불러 상을 차렸다. 어릴 적 꿈 '{dream}'을 이야기했다.", "家族みんなを呼んで食卓を整えた。子どもの頃の夢「{dream}」を話した。", "You set a table for the whole family and tell them your childhood dream: \"{dream}\"."] }],
  ["travel", "writer", "travel", "✈️",
    { t1: ["지구본", "地球儀", "The Globe"], d1: ["지구본을 돌리다 손가락이 멈춘 나라에 꼭 가 보고 싶어졌다.", "地球儀を回して指が止まった国に、どうしても行ってみたくなった。", "You spin the globe; wherever your finger stops, you long to go."],
      t2: ["첫 배낭여행 계획", "初めてのバックパック旅行の計画", "Planning a First Backpacking Trip"], d2: ["방학 동안 모은 용돈으로 혼자 여행을 떠나 볼까.", "休み中に貯めたお小遣いで一人旅に出てみるか。", "Use your saved-up allowance for a solo trip over the break?"],
      t3: ["워킹홀리데이", "ワーキングホリデー", "A Working Holiday"], d3: ["워킹홀리데이 비자가 나왔다. 1년을 낯선 나라에서 살 수 있다.", "ワーキングホリデーのビザが下りた。1年間を見知らぬ国で暮らせる。", "Your working holiday visa came through: a year abroad is possible."],
      t4: ["한 달 살기", "1か月暮らし", "A Month Living Abroad"], d4: ["한 달 동안 다른 도시에서 살아 보는 프로그램 광고를 봤다.", "1か月だけ別の都市で暮らすプログラムの広告を見た。", "You see an ad for spending a month living in another city."],
      d5: ["낡은 여권의 도장들을 하나씩 세어 보았다. 꿈은 '{dream}'이었다.", "古いパスポートのスタンプを一つずつ数えた。夢は「{dream}」だった。", "You count the stamps in your worn passport one by one. The dream was \"{dream}\"."] }],
  ["nature", "civil", "nature", "🌱",
    { t1: ["화분 하나", "鉢植えひとつ", "One Flowerpot"], d1: ["학교에서 받은 강낭콩을 화분에 심었다.", "学校でもらったインゲン豆を鉢に植えた。", "You plant a bean from school in a little pot."],
      t2: ["환경 동아리", "環境部", "The Environment Club"], d2: ["하천 정화 활동에 나갈 사람을 모은다.", "川の清掃活動に参加する人を集めている。", "They're gathering volunteers to clean up the river."],
      t3: ["자연과 일하기", "自然と働く", "Working with Nature"], d3: ["국립공원 관리 공단 채용 공고를 봤다.", "国立公園管理団の採用情報を見た。", "You spot a job posting for the national park service."],
      t4: ["주말 텃밭", "週末の家庭菜園", "A Weekend Garden"], d4: ["도시 텃밭 분양 추첨에 당첨됐다.", "市民農園の抽選に当たった。", "You win a plot in the city's community garden lottery."],
      d5: ["마당의 나무가 어느새 지붕보다 커졌다. 어릴 적 꿈 '{dream}'이 생각났다.", "庭の木がいつの間にか屋根より大きくなった。幼い頃の夢「{dream}」を思い出した。", "The tree in the yard has outgrown the roof. You think of your childhood dream: \"{dream}\"."] }],
];
const EV = [];
for (const [k, career, interest, emo, T] of CHAINS) {
  const on = theme(career, interest), F = (n) => `chain_${k}_${n}`;
  EV.push(ev(F(1), { age: [7, 12], emoji: emo, weight: 3, chain: true, cond: (p) => on(p) && !p.flags.has(F("seen1")) }, T.t1, T.d1, [
    ["dive", "✨", ["푹 빠진다", "夢中になる", "Dive right in"], { grade: "good", effects: { happy: 4, intel: 2 }, flag: { add: [F(1), F("seen1")] }, n: ["시간 가는 줄 몰랐다. 그날부터 이게 제일 좋아졌다.", "時間を忘れた。その日からこれが一番好きになった。", "Time vanished. From that day, this was your favorite thing."] }],
    ["bit", "🙂", ["조금만 해 본다", "少しだけやってみる", "Try a little"], { effects: { happy: 2 }, flag: { add: [F(1), F("seen1")] }, n: ["재미있었다. 가끔 생각날 것 같다.", "楽しかった。ときどき思い出しそうだ。", "It was fun. You'll think of it now and then."] }],
    ["no", "🙅", ["별로 관심 없다", "あまり興味がない", "Not interested"], { effects: {}, flag: { add: F("seen1") }, n: ["다른 놀이가 더 재미있었다.", "ほかの遊びのほうが楽しかった。", "Other games were more fun."] }],
  ]));
  EV.push(ev(F(2), { age: [13, 18], emoji: emo, weight: 3, chain: true, cond: (p) => p.flags.has(F(1)) && !p.flags.has(F("seen2")) }, T.t2, T.d2, [
    ["all", "🔥", ["제대로 해 본다", "本気でやってみる", "Give it everything"], { grade: "good", route: career, flag: { add: [F(2), F("seen2")] }, outcomes: [
      { chance: 0.55, grade: "crit", effects: { happy: 8, intel: 3, social: 2 }, n: ["상을 받았다. 처음으로 '재능 있다'는 말을 들었다.", "賞をもらった。初めて「才能がある」と言われた。", "You won a prize. For the first time someone called you talented."] },
      { chance: 0.45, grade: "mid", effects: { happy: -2, power: 2 }, n: ["결과는 아쉬웠지만, 더 잘하고 싶어졌다.", "結果は残念だったが、もっとうまくなりたくなった。", "The result stung, but you wanted to get better."] }] }],
    ["light", "🎈", ["즐기는 정도로만", "楽しむ程度に", "Just for fun"], { effects: { happy: 3 }, flag: { add: [F(2), F("seen2"), F("hobby")] }, n: ["부담 없이 즐겼다. 그게 오래 가는 비결 같았다.", "気負わず楽しんだ。それが長続きの秘訣のようだった。", "You enjoyed it without pressure. Maybe that's the secret to keeping at it."] }],
    ["study", "📚", ["공부에 집중한다", "勉強に集中する", "Focus on studies"], { effects: { intel: 3, happy: -2 }, flag: { add: F("seen2") }, n: ["한동안 잊고 지냈다. 가끔 서랍 속에서 꺼내 보았다.", "しばらく忘れていた。ときどき引き出しから取り出して眺めた。", "You set it aside for a while, taking it out of the drawer now and then."] }],
  ]));
  EV.push(ev(F(3), { age: [18, 27], emoji: emo, weight: 4, chain: true, cond: (p) => p.flags.has(F(2)) && !p.flags.has(F("seen3")) }, T.t3, T.d3, [
    ["pro", "🚀", ["이 길로 간다", "この道を行く", "Go for it"], { grade: "good", career, flag: { add: [F("pro"), F("seen3")] }, effects: { happy: 6 }, n: ["두려웠지만 이 길을 택했다. 어릴 적의 내가 박수를 쳤다.", "怖かったが、この道を選んだ。幼い頃の自分が拍手していた。", "It was scary, but you chose this road. Your younger self was clapping."] }],
    ["hobby", "🌙", ["일은 따로, 이건 취미로", "仕事は別に、これは趣味で", "Keep it as a hobby"], { effects: { happy: 2 }, flag: { add: [F("hobby"), F("seen3")] }, n: ["안정된 길을 고르고 이건 주말의 몫으로 남겼다.", "安定した道を選び、これは週末の楽しみに残した。", "You chose the steady road and kept this for weekends."] }],
    ["drop", "🍂", ["이제는 내려놓는다", "もう手放す", "Let it go"], { effects: { happy: -3, intel: 1 }, flag: { add: [F("drop"), F("seen3")] }, n: ["상자에 넣어 창고에 올려 두었다. 언젠가 다시 열지도 모른다.", "箱に入れて倉庫の棚に上げた。いつかまた開けるかもしれない。", "You boxed it up and put it on a high shelf. Maybe you'll open it again someday."] }],
  ]));
  EV.push(ev(F(4), { age: [32, 46], emoji: emo, weight: 4, chain: true, cond: (p) => (p.flags.has(F("hobby")) || p.flags.has(F("drop")) || p.flags.has(F("pro"))) && !p.flags.has(F("seen4")) }, T.t4, T.d4, [
    ["back", "🔁", ["다시 시작한다", "もう一度始める", "Start again"], { grade: "good", effects: { happy: 7, power: -1 }, flag: { add: [F("back"), F("seen4")] }, n: ["손이 기억하고 있었다. 오랜만에 마음이 두근거렸다.", "手が覚えていた。久しぶりに胸が高鳴った。", "Your hands remembered. Your heart raced for the first time in years."] }],
    ["share", "🤲", ["아이들에게 가르쳐 준다", "子どもたちに教える", "Teach it to kids"], { grade: "good", effects: { happy: 5, social: 3 }, flag: { add: [F("taught"), F("seen4")] }, n: ["내가 좋아했던 걸 누군가에게 건넸다. 그 아이의 눈이 반짝였다.", "自分が好きだったものを誰かに手渡した。その子の目が輝いた。", "You passed on something you loved. The child's eyes lit up."] }],
    ["later", "⏳", ["나중에 한다", "あとでやる", "Some other time"], { effects: { happy: -1 }, flag: { add: F("seen4") }, n: ["'언젠가'라는 말을 또 한 번 했다.", "「いつか」という言葉をもう一度言った。", "You said 'someday' one more time."] }],
  ]));
  EV.push(ev(F(5), { age: [60, 78], emoji: emo, weight: 5, chain: true, cond: (p) => p.flags.has(F(1)) && !p.flags.has(F("seen5")) }, [`'{dream}'`, `「{dream}」`, `"{dream}"`], T.d5 ? T.d5 : T.d4, [
    ["play", "🎉", ["지금이라도 다시 해 본다", "今からでもやってみる", "Try it again, even now"], { grade: "good", effects: { happy: 9, power: -2 }, flag: { add: [F("late"), F("seen5")] }, n: ["서툴렀지만 행복했다. 어릴 적 나와 다시 만난 기분이었다.", "ぎこちなかったが幸せだった。幼い自分と再会した気分だった。", "Clumsy, but happy. It felt like meeting your younger self again."] }],
    ["tell", "💬", ["누군가에게 이야기해 준다", "誰かに話して聞かせる", "Tell someone about it"], { grade: "good", effects: { happy: 5, social: 2 }, flag: { add: F("seen5") }, n: ["이야기를 듣던 아이가 '나도 그거 할래요'라고 했다.", "話を聞いていた子が「僕もそれやりたい」と言った。", "The child listening said, 'I want to do that too.'"] }],
    ["smile", "🙂", ["그냥 미소 짓는다", "ただ微笑む", "Just smile"], { effects: { happy: 3 }, flag: { add: F("seen5") }, n: ["이루었든 아니든, 그 꿈이 있어서 여기까지 왔다.", "叶っても叶わなくても、その夢があったからここまで来た。", "Fulfilled or not, that dream carried you this far."] }],
  ]));
}

// ---------- 생활 사건 ----------
const L = (id, meta, title, desc, choices) => EV.push(ev("rb_" + id, meta, title, desc, choices));
L("move_city", { age: [25, 55], emoji: "📦", repeat: 12 }, ["이사할까", "引っ越すか", "Move House?"], ["지금 집 계약이 끝나 간다. 조금 넓은 곳으로 옮길까, 그대로 있을까.", "今の家の契約がもうすぐ終わる。少し広いところへ移るか、このままか。", "Your lease is ending. Move somewhere a bit bigger, or stay put?"], [
  ["bigger", "🏠", ["넓은 집으로 간다", "広い家へ移る", "Move somewhere bigger"], { effects: { happy: 5, money: -1500 }, life: { housing: "jeonse" }, n: ["햇빛이 잘 드는 집이었다. 짐을 풀며 새 생활을 상상했다.", "日当たりのいい家だった。荷ほどきしながら新しい暮らしを思い描いた。", "The new place got lovely sunlight. You imagined a new life as you unpacked."] }],
  ["stay", "🛋️", ["그대로 산다", "このまま住む", "Stay"], { effects: { money: 300 }, n: ["익숙한 동네가 좋았다. 아낀 돈은 통장에 넣었다.", "慣れた町が好きだった。浮いたお金は口座に入れた。", "You love the familiar neighborhood, and the money saved went into the bank."] }],
  ["country", "🌾", ["시골로 내려간다", "田舎へ移る", "Move to the countryside"], { effects: { happy: 6, social: -3, money: -800 }, life: { housing: "own" }, n: ["창밖이 온통 초록이었다. 밤에는 별이 많았다.", "窓の外は一面の緑だった。夜は星が多かった。", "The view was all green, and the night sky full of stars."] }],
]);
L("abroad_trip", { age: [20, 75], emoji: "✈️", repeat: 8 }, ["해외여행", "海外旅行", "A Trip Abroad"], ["연휴가 길다. 비행기 표 가격이 내려갔다.", "連休が長い。航空券の値段が下がった。", "A long holiday is coming, and airfares have dropped."], [
  ["europe", "🏰", ["유럽으로 간다", "ヨーロッパへ行く", "Go to Europe"], { grade: "good", effects: { happy: 8, money: -500, intel: 2 }, flag: { add: "travel" }, n: ["오래된 돌길을 걸었다. 사진첩이 가득 찼다.", "古い石畳を歩いた。アルバムがいっぱいになった。", "You walked old cobblestone streets and filled a photo album."] }],
  ["beach", "🏝️", ["바다가 있는 나라로", "海のある国へ", "Somewhere with a beach"], { grade: "good", effects: { happy: 7, money: -350, health: 2 }, flag: { add: "travel" }, n: ["해변에서 아무것도 하지 않았다. 그게 좋았다.", "ビーチで何もしなかった。それがよかった。", "You did absolutely nothing on the beach. It was perfect."] }],
  ["home", "🏡", ["집에서 푹 쉰다", "家でゆっくり休む", "Rest at home"], { effects: { happy: 2, money: 50 }, n: ["밀린 잠을 잤다. 그것도 휴가였다.", "たまった睡眠をとった。それも休暇だった。", "You caught up on sleep. That was a vacation too."] }],
]);
L("emigrate", { age: [24, 45], emoji: "🌏", weight: 0.6 }, ["다른 나라에서 살아 볼까", "別の国で暮らしてみるか", "Live in Another Country?"], ["해외 지사 발령 제안이 왔다. 몇 년은 돌아오지 못한다.", "海外支社への転勤の打診が来た。数年は戻れない。", "You're offered a post at an overseas branch. It would mean years away."], [
  ["go", "🛫", ["떠난다", "行く", "Go"], { grade: "good", outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 7, intel: 4, social: -2, money: 1500 }, flag: { add: ["abroad", "travel"] }, n: ["낯선 말, 낯선 음식. 그래도 하루하루가 새로웠다.", "見知らぬ言葉、見知らぬ料理。それでも毎日が新鮮だった。", "Strange words, strange food — yet every day was new."] },
    { chance: 0.4, grade: "bad", effects: { happy: -6, health: -3 }, flag: { add: "abroad" }, n: ["외로움이 생각보다 컸다. 밤마다 고향 하늘을 떠올렸다.", "思ったより孤独だった。毎晩故郷の空を思い出した。", "The loneliness was bigger than expected. Every night you thought of home."] }] }],
  ["stay", "🏠", ["남는다", "残る", "Stay"], { effects: { social: 2 }, n: ["가족과 친구 곁을 택했다.", "家族と友人のそばを選んだ。", "You chose to stay near family and friends."] }],
]);
L("car", { age: [26, 60], emoji: "🚗", weight: 0.8, cond: (p) => p.stats.money > 2000 && !p.flags.has("car") }, ["첫 차", "初めての車", "A First Car"], ["출퇴근이 점점 힘들다. 중고차를 볼까, 새 차를 볼까.", "通勤がだんだんつらい。中古車にするか、新車にするか。", "The commute is wearing you down. Used car, or new?"], [
  ["new", "✨", ["새 차를 산다", "新車を買う", "Buy new"], { grade: "good", effects: { happy: 6, money: -3000 }, flag: { add: "car" }, n: ["새 차 냄새가 났다. 첫 드라이브는 바다였다.", "新車の匂いがした。初ドライブは海だった。", "It had that new-car smell. Your first drive was to the sea."] }],
  ["used", "🔧", ["중고차로 충분하다", "中古車で十分", "Used is fine"], { effects: { happy: 3, money: -900 }, flag: { add: "car" }, n: ["작은 흠집은 있었지만 잘 달렸다.", "小さな傷はあったがよく走った。", "A few scratches, but it ran great."] }],
  ["bus", "🚌", ["대중교통이 낫다", "公共交通のほうがいい", "Stick with transit"], { effects: { money: 200, health: 1 }, n: ["걷는 시간이 늘었다. 몸이 조금 가벼워졌다.", "歩く時間が増えた。体が少し軽くなった。", "You walked more, and felt a little lighter."] }],
]);
L("hospital", { age: [35, 85], emoji: "🏥", repeat: 10, cond: (p) => p.stats.health < 55 }, ["건강검진 결과", "健康診断の結果", "Checkup Results"], ["검진 결과지에 '재검사 필요'가 찍혀 있다.", "健診結果に「要再検査」と押されている。", "Your checkup results say 'Further testing needed.'"], [
  ["go", "🩺", ["바로 큰 병원에 간다", "すぐに大きな病院へ行く", "Go to a hospital right away"], { grade: "good", effects: { health: 8, money: -300, happy: -1 }, n: ["일찍 발견해서 다행이었다. 한동안 병원을 오갔다.", "早く見つかってよかった。しばらく病院に通った。", "Luckily it was caught early. You went back and forth to the hospital for a while."] }],
  ["wait", "🙈", ["괜찮겠지, 미룬다", "大丈夫だろうと先延ばし", "It's probably fine — wait"], { grade: "bad", outcomes: [
    { chance: 0.5, grade: "mid", effects: { health: -2 }, n: ["다행히 별일 없었다. 이번에는.", "幸い何事もなかった。今回は。", "Nothing came of it, luckily. This time."] },
    { chance: 0.5, grade: "bad", effects: { health: -12, money: -800, happy: -5 }, n: ["몇 달 뒤 입원했다. 병실 천장을 오래 보았다.", "数か月後に入院した。病室の天井を長く見つめた。", "Months later you were admitted. You stared at the hospital ceiling for a long time."] }] }],
  ["habit", "🥗", ["생활 습관부터 바꾼다", "生活習慣から変える", "Change your habits first"], { effects: { health: 5, happy: -1, power: 2 }, n: ["야식을 끊고 걷기 시작했다.", "夜食をやめて歩き始めた。", "You quit late-night snacks and started walking."] }],
]);
L("adopt_dog", { age: [10, 75], emoji: "🐕", weight: 0.9, hasPet: false }, ["유기견 보호소", "保護犬シェルター", "The Dog Shelter"], ["보호소 사진 속 강아지가 자꾸 눈에 밟힌다.", "シェルターの写真の子犬がどうしても気になる。", "A puppy from the shelter's photos keeps tugging at you."], [
  ["adopt", "🐶", ["데려온다", "連れて帰る", "Bring it home"], { grade: "good", effects: { happy: 9, money: -150 }, life: { pet: { kind: "dog" } }, n: ["집에 온 첫날 밤, 내 발치에서 잠들었다.", "家に来た最初の夜、足もとで眠った。", "The first night home, it fell asleep at your feet."] }],
  ["volunteer", "🧹", ["봉사만 간다", "ボランティアだけ行く", "Just volunteer"], { effects: { happy: 3, social: 2 }, n: ["주말마다 산책 봉사를 했다.", "毎週末、散歩ボランティアをした。", "You volunteered for dog walks every weekend."] }],
  ["no", "🙏", ["아직은 자신이 없다", "まだ自信がない", "Not ready yet"], { effects: {}, n: ["책임질 수 있을 때 다시 오기로 했다.", "責任を持てるときにまた来ることにした。", "You decided to come back when you could truly take responsibility."] }],
]);
L("adopt_cat", { age: [10, 80], emoji: "🐈", weight: 0.8, hasPet: false }, ["창밖의 고양이", "窓の外の猫", "The Cat at the Window"], ["며칠째 창문 밖에서 고양이가 울고 있다.", "何日も窓の外で猫が鳴いている。", "For days, a cat has been crying outside your window."], [
  ["adopt", "🐱", ["집 안으로 들인다", "家に入れる", "Let it in"], { grade: "good", effects: { happy: 8, money: -100 }, life: { pet: { kind: "cat" } }, n: ["이름을 지어 주었다. 그날부터 집의 주인이 바뀌었다.", "名前をつけた。その日から家の主が変わった。", "You gave it a name. From that day on, the house had a new boss."] }],
  ["feed", "🥫", ["밥만 챙겨 준다", "ごはんだけあげる", "Just feed it"], { effects: { happy: 3 }, n: ["매일 저녁 그릇이 비어 있었다.", "毎晩、器は空になっていた。", "Every evening, the bowl was empty."] }],
]);
L("reunion", { age: [30, 80], emoji: "📸", repeat: 15 }, ["동창회", "同窓会", "A Class Reunion"], ["졸업 후 처음 열리는 동창회 초대장이 왔다.", "卒業後初めての同窓会の招待状が来た。", "An invitation arrives for the first reunion since graduation."], [
  ["go", "🍻", ["간다", "行く", "Go"], { grade: "good", effects: { happy: 6, social: 4, money: -50 }, n: ["다들 조금씩 변했지만 웃음소리는 그대로였다.", "みんな少しずつ変わったが、笑い声は昔のままだった。", "Everyone had changed a little, but the laughter hadn't."] }],
  ["skip", "🏠", ["가지 않는다", "行かない", "Skip it"], { effects: { happy: -1 }, n: ["단체 사진 속 얼굴들을 오래 들여다보았다.", "集合写真の顔を長く見つめた。", "You studied the faces in the group photo for a long time."] }],
]);
L("invest", { age: [25, 65], emoji: "📈", repeat: 7, cond: (p) => p.stats.money > 3000 }, ["투자 권유", "投資の勧め", "An Investment Pitch"], ["친구가 '확실한' 투자처가 있다며 연락했다.", "友人が「確実な」投資先があると連絡してきた。", "A friend calls about a 'sure thing' investment."], [
  ["all", "💥", ["크게 넣는다", "大きく入れる", "Go big"], { outcomes: [
    { chance: 0.35, grade: "crit", effects: { money: 6000, happy: 6 }, n: ["정말로 올랐다. 그날 저녁은 근사했다.", "本当に上がった。その晩のごちそうは格別だった。", "It really went up. Dinner that night was something special."] },
    { chance: 0.65, grade: "bad", effects: { money: -5000, happy: -8 }, n: ["한 달 만에 반토막이 났다. 친구와도 서먹해졌다.", "1か月で半分になった。友人ともぎくしゃくした。", "It halved in a month, and things got awkward with your friend."] }] }],
  ["little", "🪙", ["조금만 넣는다", "少しだけ入れる", "Put in a little"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { money: 600, happy: 2 }, n: ["작게 벌었다. 딱 그만큼 기뻤다.", "少しもうかった。ちょうどそのぶんだけうれしかった。", "A small gain, and a small joy to match."] },
    { chance: 0.5, grade: "mid", effects: { money: -500 }, n: ["조금 잃었다. 수업료라고 생각했다.", "少し損をした。授業料だと思った。", "You lost a little. Call it tuition."] }] }],
  ["no", "🙅", ["거절한다", "断る", "Say no"], { effects: { intel: 1 }, n: ["확실한 건 없다고 생각했다.", "確実なものなどないと思った。", "You figured there's no such thing as a sure thing."] }],
]);
L("late_study", { age: [35, 70], emoji: "🎓", weight: 0.8 }, ["늦깎이 공부", "遅咲きの勉強", "Back to School, Late"], ["야간 대학 신입생 모집 공고를 봤다.", "夜間大学の新入生募集を見た。", "You see a night school admissions notice."], [
  ["enroll", "📚", ["등록한다", "入学する", "Enroll"], { grade: "good", effects: { intel: 6, happy: 4, money: -600, power: -2 }, flag: { add: "late_study" }, n: ["강의실 맨 앞줄에 앉았다. 젊은 동기들이 '선배님'이라 불렀다.", "講義室の最前列に座った。若い同期たちに「先輩」と呼ばれた。", "You sat in the front row. Your young classmates called you 'senior.'"] }],
  ["online", "💻", ["온라인 강의로 시작한다", "オンライン講座から始める", "Start with online classes"], { effects: { intel: 3 }, n: ["퇴근 후 한 강씩 들었다.", "退勤後に一講座ずつ聞いた。", "One lecture each night after work."] }],
  ["no", "🛋️", ["지금은 쉬고 싶다", "今は休みたい", "Rest for now"], { effects: { happy: 1 }, n: ["배움은 다음으로 미뤘다.", "学びは次に回した。", "Learning could wait."] }],
]);
L("marathon", { age: [25, 65], emoji: "🏃", weight: 0.7 }, ["첫 마라톤", "初めてのマラソン", "A First Marathon"], ["회사 동료가 하프 마라톤에 같이 나가자고 한다.", "同僚がハーフマラソンに一緒に出ようと言う。", "A coworker asks you to run a half marathon together."], [
  ["run", "🏅", ["나간다", "出る", "Run it"], { grade: "good", outcomes: [
    { chance: 0.7, grade: "good", effects: { power: 5, health: 4, happy: 6 }, n: ["결승선에서 다리가 풀렸지만 웃음이 났다.", "ゴールで足がふらついたが笑いがこみ上げた。", "Your legs gave out at the finish line, but you were laughing."] },
    { chance: 0.3, grade: "mid", effects: { power: 2, health: -2 }, n: ["완주는 못 했다. 그래도 내년에 다시 오기로 했다.", "完走はできなかった。それでも来年また来ることにした。", "You didn't finish, but you promised yourself next year."] }] }],
  ["cheer", "📣", ["응원만 간다", "応援だけ行く", "Just cheer"], { effects: { social: 2, happy: 2 }, n: ["결승선에서 동료를 안아 주었다.", "ゴールで同僚を抱きしめた。", "You hugged your coworker at the finish line."] }],
]);
L("volunteer", { age: [16, 85], emoji: "🤝", repeat: 12 }, ["봉사 활동", "ボランティア活動", "Volunteering"], ["동네 무료 급식소에 손이 모자란다고 한다.", "町の無料食堂が人手不足だという。", "The neighborhood soup kitchen is short-handed."], [
  ["go", "🍲", ["꾸준히 돕는다", "続けて手伝う", "Help regularly"], { grade: "good", effects: { happy: 5, social: 3 }, flag: { add: "volunteer" }, n: ["고맙다는 말을 하루에 열 번쯤 들었다.", "ありがとうを一日に十回ほど聞いた。", "You heard 'thank you' about ten times a day."] }],
  ["once", "🙂", ["한 번만 간다", "一度だけ行く", "Go once"], { effects: { happy: 2 }, n: ["생각보다 보람 있었다.", "思ったよりやりがいがあった。", "It was more rewarding than you expected."] }],
  ["donate", "💝", ["대신 기부한다", "代わりに寄付する", "Donate instead"], { effects: { happy: 3, money: -100 }, n: ["작은 금액이지만 매달 보내기로 했다.", "少額だが毎月送ることにした。", "Not much, but you set it up monthly."] }],
]);
L("old_friend_call", { age: [40, 90], emoji: "☎️", repeat: 10 }, ["오랜 친구의 전화", "古い友の電話", "A Call from an Old Friend"], ["20년 만에 친구에게서 전화가 왔다. '그냥, 생각나서.'", "20年ぶりに友人から電話が来た。「ただ、思い出して」", "A friend calls after twenty years. 'Just thought of you.'"], [
  ["meet", "☕", ["만나서 차 한잔한다", "会ってお茶をする", "Meet for tea"], { grade: "good", effects: { happy: 7, social: 3 }, n: ["몇 시간이 몇 분처럼 지나갔다.", "数時間が数分のように過ぎた。", "Hours passed like minutes."] }],
  ["chat", "📱", ["전화로 안부만 나눈다", "電話で近況だけ話す", "Just catch up by phone"], { effects: { happy: 3 }, n: ["목소리는 그대로였다.", "声は昔のままだった。", "The voice hadn't changed."] }],
]);
L("retire_new", { age: [60, 78], emoji: "🌅", weight: 1.2, cond: (p) => !p.job }, ["은퇴 후 새로운 일", "引退後の新しいこと", "Something New After Retirement"], ["하루가 길다. 무엇이든 새로 시작해 보고 싶다.", "一日が長い。何か新しく始めてみたい。", "The days are long. You want to start something new."], [
  ["shop", "🏪", ["작은 가게를 연다", "小さな店を開く", "Open a little shop"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 7, money: 800, social: 3 }, n: ["단골이 생겼다. 아침마다 가게 문을 여는 게 즐거웠다.", "常連ができた。毎朝店を開けるのが楽しかった。", "You gained regulars. Opening the shop each morning became a joy."] },
    { chance: 0.5, grade: "bad", effects: { money: -2000, happy: -4 }, n: ["1년 만에 문을 닫았다. 그래도 해 봐서 후회는 없었다.", "1年で店を閉めた。それでもやってみて悔いはなかった。", "It closed within a year. Still, no regrets for trying."] }] }],
  ["learn", "🎨", ["배우고 싶던 걸 배운다", "学びたかったことを学ぶ", "Learn what you always wanted"], { grade: "good", effects: { happy: 6, intel: 3 }, n: ["선생님보다 내가 더 신이 났다.", "先生より私のほうが張り切っていた。", "You were more excited than the teacher."] }],
  ["rest", "🍵", ["그냥 느긋하게 산다", "ただのんびり暮らす", "Simply take it easy"], { effects: { happy: 3, health: 2 }, n: ["오후의 낮잠이 하루의 큰 기쁨이 되었다.", "午後の昼寝が一日の大きな楽しみになった。", "An afternoon nap became the day's great pleasure."] }],
]);
L("diary_found", { age: [45, 85], emoji: "📔", weight: 1.5, cond: (p) => !!p.dreamText && !p.flags.has("rb_diary_seen") }, ["서랍 속 쪽지", "引き出しの中のメモ", "A Note in the Drawer"], ["오래된 서랍에서 어릴 적 글씨로 쓴 쪽지가 나왔다. '{dream}'", "古い引き出しから幼い字で書いたメモが出てきた。「{dream}」", "From an old drawer comes a note in childish handwriting: \"{dream}\""], [
  ["keep", "🖼️", ["액자에 넣어 둔다", "額に入れて飾る", "Frame it"], { grade: "good", effects: { happy: 6 }, flag: { add: "rb_diary_seen" }, n: ["거실 벽에 걸었다. 지나갈 때마다 눈이 갔다.", "居間の壁に飾った。通るたびに目が行った。", "You hung it in the living room. Your eyes went to it every time you passed."] }],
  ["tell", "💬", ["가족에게 보여 준다", "家族に見せる", "Show the family"], { grade: "good", effects: { happy: 5, social: 2 }, flag: { add: "rb_diary_seen" }, n: ["다들 처음 듣는 이야기라며 웃었다.", "みんな初めて聞く話だと笑った。", "Everyone laughed — they'd never heard this story."] }],
  ["back", "📦", ["다시 서랍에 넣는다", "また引き出しにしまう", "Put it back"], { effects: { happy: 1 }, flag: { add: "rb_diary_seen" }, n: ["조용히 서랍을 닫았다. 그 꿈은 그 자리에 있었다.", "そっと引き出しを閉めた。その夢はそこにあった。", "You quietly closed the drawer. The dream stayed where it was."] }],
]);
L("dream_crossroads", { age: [26, 40], emoji: "🧭", weight: 1.3, cond: (p) => !!p.dreamText && !p.flags.has("rb_dream_cross") }, ["꿈과 현실 사이", "夢と現実のあいだ", "Between Dream and Reality"], ["바쁜 하루 끝, 문득 예전에 품었던 꿈이 떠올랐다 — '{dream}'. 지금의 나는 어디쯤일까.", "忙しい一日の終わり、ふと昔の夢がよみがえった — 「{dream}」。今の自分はどのあたりだろう。", "At the end of a busy day, your old dream comes back: \"{dream}\". Where are you now?"], [
  ["chase", "🏃", ["지금이라도 쫓아간다", "今からでも追いかける", "Chase it, even now"], { grade: "good", outcomes: [
    { chance: 0.45, grade: "crit", effects: { happy: 10, money: -800 }, flag: { add: ["rb_dream_cross", "rb_chased"] }, n: ["모아 둔 돈을 털어 다시 시작했다. 가슴이 뛰었다.", "貯めたお金をはたいて再出発した。胸が高鳴った。", "You spent your savings to start again. Your heart was pounding."] },
    { chance: 0.55, grade: "mid", effects: { happy: 2, money: -1200, power: -2 }, flag: { add: ["rb_dream_cross", "rb_chased"] }, n: ["생각보다 어려웠다. 그래도 한 발 내디뎠다.", "思ったより難しかった。それでも一歩踏み出した。", "It was harder than you thought. Still, you took a step."] }] }],
  ["weekend", "🌙", ["주말에만 조금씩", "週末だけ少しずつ", "A little each weekend"], { effects: { happy: 4, power: -1 }, flag: { add: "rb_dream_cross" }, n: ["작게라도 이어 가기로 했다.", "小さくても続けることにした。", "You decided to keep it going, even in a small way."] }],
  ["now", "🏢", ["지금의 삶에 집중한다", "今の暮らしに集中する", "Focus on the life you have"], { effects: { intel: 1 }, flag: { add: "rb_dream_cross" }, n: ["꿈은 꿈대로, 오늘은 오늘대로 살기로 했다.", "夢は夢として、今日は今日として生きることにした。", "Let the dream be a dream, and today be today."] }],
]);

export const REBORN_EVENTS = EV;
