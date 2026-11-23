// =========================
// 플듀 인생게임 REBORN — 사건 4차: 취미·여행·반려동물 + 건강·학교·사랑·세계·노년 보충 (2026-11-23)
// 형식: life-ev-kit.js 의 ev()
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const H = (id, meta, title, desc, choices) => EV.push(ev("hb_" + id, { area: "hobby", ...meta }, title, desc, choices));
const X = (area, id, meta, title, desc, choices) => EV.push(ev("hb_" + id, { area, ...meta }, title, desc, choices));

// ---------- 취미 ----------
H("guitar_start", { age: [13, 60], emoji: "🎸", scene: "kidroom" }, ["중고 기타", "中古ギター", "A Secondhand Guitar"], ["중고 장터에서 기타를 싸게 판다.", "フリマでギターが安く売られている。", "A guitar is going cheap at the flea market."], [
  ["buy", "🎸", ["사서 독학한다", "買って独学する", "Buy it and teach yourself"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 6, intel: 1, money: -20 }, flag: { add: "plays_guitar" }, n: ["손끝에 굳은살이 생길 즈음 첫 곡을 완주했다.", "指先にタコができる頃、初めて一曲弾き切った。", "By the time calluses formed, I could play my first full song."] },
    { chance: 0.5, grade: "mid", effects: { happy: 2, money: -20 }, n: ["코드 세 개까지 배웠다. 기타는 방 구석의 장식이 됐다.", "コード三つまで覚えた。ギターは部屋の隅の飾りになった。", "Learned three chords. The guitar became corner decor."] }] }],
  ["pass", "🚶", ["지나친다", "通り過ぎる", "Walk past"], { effects: { money: 5 }, n: ["가끔 그 기타가 생각났다.", "時々あのギターを思い出した。", "I thought about that guitar sometimes."] }],
]);
H("photography", { age: [15, 80], emoji: "📷", scene: "park", fromYear: 1950 }, ["사진 찍기", "写真撮影", "Taking Photographs"], ["오래된 카메라를 물려받았다.", "古いカメラを譲り受けた。", "You inherit an old camera."], [
  ["shoot", "🌅", ["주말마다 들고 나간다", "毎週末持ち出す", "Take it out every weekend"], { grade: "good", effects: { happy: 5, intel: 2 }, flag: { add: "photographer" }, n: ["같은 골목을 계절마다 찍었다. 사진전에 한 장이 걸렸다.", "同じ路地を季節ごとに撮った。写真展に一枚が飾られた。", "I photographed the same alley every season. One shot made it into an exhibition."] }],
  ["shelf", "🗄️", ["장식장에 둔다", "飾り棚に置く", "Put it on a shelf"], { effects: { happy: 1 }, n: ["가끔 먼지를 털었다.", "時々ほこりを払った。", "I dusted it now and then."] }],
]);
H("board_games", { age: [8, 85], emoji: "🎲", scene: "home" }, ["보드게임의 밤", "ボードゲームの夜", "Board Game Night"], ["친구들이 매주 금요일 보드게임 모임을 하자고 한다.", "友達が毎週金曜にボードゲーム会をしようと言う。", "Friends propose a weekly Friday board game night."], [
  ["host", "🏠", ["우리 집에서 연다", "うちで開く", "Host it at your place"], { grade: "good", effects: { social: 5, happy: 5, intel: 1 }, n: ["모임은 6년을 갔다. 게임보다 그 시간이 좋았다.", "会は六年続いた。ゲームよりその時間が好きだった。", "It lasted six years. I loved the time more than the games."] }],
  ["sometimes", "🎲", ["가끔 간다", "時々行く", "Join sometimes"], { effects: { social: 2, happy: 3 }, n: ["갈 때마다 새 규칙을 배웠다.", "行くたびに新しいルールを覚えた。", "Every time, I learned a new game."] }],
]);
H("knitting", { age: [10, 95], emoji: "🧶", scene: "home" }, ["뜨개질", "編み物", "Knitting"], ["겨울을 앞두고 목도리를 직접 떠 볼까.", "冬を前にマフラーを編んでみようか。", "Winter's coming. Why not knit a scarf yourself?"], [
  ["knit", "🧣", ["뜬다", "編む", "Knit it"], { grade: "good", effects: { happy: 5, intel: 1 }, n: ["코가 몇 개 빠졌지만 선물받은 사람은 매년 그 목도리를 했다.", "目がいくつか飛んだが、贈った相手は毎年それを巻いてくれた。", "A few dropped stitches, but the person I gave it to wore it every winter."] }],
  ["buy", "🛍️", ["그냥 산다", "そのまま買う", "Just buy one"], { effects: { money: -10, happy: 1 }, n: ["따뜻했다. 그걸로 됐다.", "暖かかった。それでよかった。", "It was warm. Good enough."] }],
]);
H("fishing", { age: [10, 90], emoji: "🎣", scene: "river" }, ["낚시", "釣り", "Fishing"], ["새벽 강가에 낚싯대를 드리우는 사람들이 있다.", "夜明けの川辺で釣り糸を垂らす人たちがいる。", "At dawn, people cast their lines by the river."], [
  ["go", "🐟", ["나도 해 본다", "自分もやってみる", "Give it a try"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { happy: 6, health: 1 }, n: ["팔뚝만 한 놈을 낚았다. 사진을 백 장 찍었다.", "腕ほどの大物を釣った。写真を百枚撮った。", "Caught one as big as my forearm. Took a hundred photos."] },
    { chance: 0.6, grade: "mid", effects: { happy: 4, health: 1 }, n: ["한 마리도 못 잡았다. 그래도 물안개가 좋았다.", "一匹も釣れなかった。それでも川霧がよかった。", "Caught nothing. But the river mist was lovely."] }] }],
  ["watch", "👀", ["옆에서 구경만 한다", "横で見ているだけ", "Just watch"], { effects: { happy: 2 }, n: ["낚시꾼 아저씨가 커피를 나눠 줬다.", "釣り人のおじさんがコーヒーを分けてくれた。", "An old angler shared his coffee."] }],
]);
H("solo_trip", { age: [20, 80], emoji: "🎒", scene: "abroad" }, ["첫 혼자 여행", "初めての一人旅", "Your First Solo Trip"], ["처음으로 혼자 여행을 떠나 볼까.", "初めて一人旅に出てみようか。", "Try traveling alone for the first time?"], [
  ["go", "🗺️", ["떠난다", "出発する", "Go"], { grade: "crit", effects: { happy: 7, intel: 2, social: 1, money: -150 }, flag: { add: "travel" }, n: ["길을 잃었고, 덕분에 아무도 모르는 골목 식당을 찾았다.", "道に迷い、おかげで誰も知らない路地の食堂を見つけた。", "I got lost — and found a tiny alley restaurant no guidebook knew about."] }],
  ["group", "👫", ["아직은 친구와 함께", "まだ友達と一緒に", "Not yet — go with a friend"], { effects: { happy: 4, social: 2, money: -120 }, n: ["즐거웠다. 혼자 여행은 버킷리스트에 적었다.", "楽しかった。一人旅はバケットリストに書いた。", "Fun! I added solo travel to my bucket list."] }],
]);
H("backpacking", { age: [19, 32], emoji: "🌍", scene: "abroad", fromYear: 1970 }, ["배낭여행", "バックパック旅行", "Backpacking"], ["한 달 동안 배낭 하나로 여러 나라를 돌 기회가 생겼다.", "一か月、リュック一つで何か国も回るチャンスができた。", "A chance to backpack through several countries for a month."], [
  ["go", "🎒", ["간다", "行く", "Go"], { grade: "crit", effects: { happy: 8, social: 4, intel: 3, money: -300 }, flag: { add: ["travel", "abroad"] }, n: ["기차에서 만난 친구들과 지금도 연락한다.", "列車で出会った友達と今も連絡を取っている。", "I'm still in touch with friends I met on those trains."] }],
  ["work", "💼", ["일을 쉴 수 없다", "仕事を休めない", "Can't take time off"], { effects: { money: 100, happy: -1 }, n: ["대신 사진집을 샀다.", "代わりに写真集を買った。", "I bought a photo book instead."] }],
]);
H("hiking_club", { age: [25, 80], emoji: "⛰️", scene: "mountain" }, ["주말 등산", "週末登山", "Weekend Hiking"], ["주말 등산 모임에서 정상까지 가자고 한다.", "週末登山の会で山頂まで行こうと言う。", "The weekend hiking club is going for the summit."], [
  ["summit", "🏔️", ["정상까지", "山頂まで", "Go to the top"], { grade: "good", effects: { health: 4, happy: 5, social: 2 }, n: ["정상에서 먹은 컵라면이 인생 라면이었다.", "山頂で食べたカップ麺が人生最高の一杯だった。", "Cup noodles at the summit — the best meal of my life."] }],
  ["half", "🌳", ["중턱 약수터까지", "中腹の湧き水まで", "Just to the halfway spring"], { effects: { health: 2, happy: 3 }, n: ["약수 한 바가지가 꿀맛이었다.", "湧き水一杯が格別だった。", "One ladle of spring water tasted like honey."] }],
]);
H("pet_dog_adopt", { age: [20, 70], emoji: "🐕", scene: "vetClinic", hasPet: false }, ["유기견 보호소", "保護犬施設", "The Dog Shelter"], ["보호소에 나이 많은 개가 오래 입양을 기다리고 있다.", "保護施設で年老いた犬が長く里親を待っている。", "At the shelter, an older dog has been waiting a long time for a home."], [
  ["adopt", "🏡", ["데려온다", "迎える", "Take them home"], { grade: "crit", effects: { happy: 8, social: 1 }, life: { pet: { kind: "dog", startAge: 6 } }, n: ["첫날 밤, 개가 내 발밑에서 처음으로 깊이 잤다.", "最初の夜、犬が私の足元で初めて深く眠った。", "The first night, the dog finally slept deeply at my feet."] }],
  ["volunteer", "🦮", ["산책 봉사만 한다", "散歩ボランティアだけする", "Volunteer as a dog walker"], { grade: "good", effects: { happy: 4, health: 2 }, n: ["매주 토요일 그 개가 나를 알아보고 꼬리를 흔들었다.", "毎週土曜、その犬が私を見つけて尻尾を振った。", "Every Saturday, the dog recognized me and wagged."] }],
]);
H("pet_trick", { age: [8, 80], emoji: "🐾", scene: "park", hasPet: true }, ["반려동물 훈련", "ペットのしつけ", "Training Your Pet"], ["반려동물에게 새로운 재주를 가르쳐 볼까.", "ペットに新しい芸を教えてみようか。", "Teach your pet a new trick?"], [
  ["train", "🦴", ["간식으로 매일 연습", "おやつで毎日練習", "Practice daily with treats"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 5, intel: 1 }, n: ["'손!' 한 달 만에 성공했다. 온 가족이 박수를 쳤다.", "「お手!」一か月で成功した。家族みんなが拍手した。", "'Paw!' Success after a month. The whole family applauded."] },
    { chance: 0.4, grade: "mid", effects: { happy: 3, money: -5 }, n: ["간식만 사라졌다. 그래도 귀여웠다.", "おやつだけが消えた。それでも可愛かった。", "Only the treats disappeared. Still adorable."] }] }],
  ["free", "😺", ["그냥 그대로가 좋다", "そのままがいい", "They're perfect as they are"], { effects: { happy: 3 }, n: ["재주는 없었지만 무릎 위에선 일등이었다.", "芸はなかったが、膝の上では一番だった。", "No tricks, but number one on my lap."] }],
]);
H("pet_vet", { age: [10, 85], emoji: "🏥", scene: "vetClinic", hasPet: true }, ["동물병원", "動物病院", "The Vet"], ["반려동물이 밥을 안 먹는다. 동물병원에 가 봐야 할까.", "ペットがご飯を食べない。動物病院に行くべきか。", "Your pet won't eat. Should you see the vet?"], [
  ["go", "🚗", ["바로 간다", "すぐ行く", "Go right away"], { grade: "good", effects: { happy: 2, money: -50 }, n: ["가벼운 장염이었다. 약을 먹고 이틀 만에 기운을 차렸다.", "軽い腸炎だった。薬を飲んで二日で元気になった。", "Mild gastritis. Medicine had them bouncing back in two days."] }],
  ["wait", "⏳", ["하루 지켜본다", "一日様子を見る", "Wait a day"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: { happy: 1 }, n: ["다음 날 밥그릇을 싹 비웠다.", "翌日ご飯をきれいに平らげた。", "The next day, they cleaned the bowl."] },
    { chance: 0.4, grade: "bad", effects: { happy: -4, money: -120 }, n: ["더 나빠져서 입원했다. 다음엔 바로 가기로 했다.", "悪化して入院した。次はすぐ行くと決めた。", "It got worse; they were hospitalized. Next time, I'd go straight away."] }] }],
]);
H("concert_ticket", { age: [14, 60], emoji: "🎤", scene: "stage" }, ["좋아하는 가수의 공연", "好きな歌手のライブ", "Your Favorite Artist's Concert"], ["좋아하는 가수의 공연 예매가 오늘 저녁 8시다.", "好きな歌手のライブのチケット発売が今夜八時だ。", "Tickets for your favorite artist go on sale at 8 p.m. tonight."], [
  ["click", "🖱️", ["8시 정각에 광클", "八時ちょうどに連打", "Click frantically at exactly 8"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { happy: 9, money: -60 }, n: ["성공! 공연 날 목이 쉬도록 따라 불렀다.", "成功!ライブの日、声が枯れるまで歌った。", "Success! At the concert, I sang until I lost my voice."] },
    { chance: 0.6, grade: "mid", effects: { happy: -3 }, n: ["대기 번호 4만 번. 다음 투어를 기약했다.", "待ち番号四万番。次のツアーに期待した。", "Queue number 40,000. Next tour, then."] }] }],
  ["stream", "📺", ["중계로 본다", "配信で見る", "Watch the livestream"], { effects: { happy: 4, money: -10 }, n: ["거실에서 형광봉을 흔들었다.", "リビングでペンライトを振った。", "I waved a light stick in my living room."] }],
]);
H("cooking_class", { age: [18, 80], emoji: "🍳", scene: "kitchen" }, ["요리 교실", "料理教室", "A Cooking Class"], ["동네 요리 교실에서 세계 요리 과정을 연다.", "地域の料理教室で世界の料理コースが開かれる。", "The community kitchen is offering a world cuisine course."], [
  ["join", "🧑‍🍳", ["등록한다", "申し込む", "Sign up"], { grade: "good", effects: { happy: 5, health: 2, social: 2 }, flag: { add: "good_cook" }, n: ["집들이에서 배운 요리를 냈다. 친구들이 레시피를 물었다.", "新居祝いで習った料理を出した。友達がレシピを聞いた。", "I served what I learned at a housewarming. Friends asked for the recipe."] }],
  ["video", "📹", ["영상 보고 따라 한다", "動画を見てまねする", "Follow online videos"], { effects: { happy: 3, money: -5 }, n: ["두 번 태우고 세 번째에 성공했다.", "二回焦がして三回目に成功した。", "Burned it twice, nailed it the third time."] }],
]);
H("collecting", { age: [8, 85], emoji: "🪙", scene: "kidroom" }, ["수집", "コレクション", "Collecting"], ["동전(우표·카드)을 모으기 시작했다.", "コイン(切手・カード)を集め始めた。", "You've started collecting coins (or stamps, or cards)."], [
  ["serious", "📒", ["체계적으로 모은다", "体系的に集める", "Collect seriously"], { outcomes: [
    { chance: 0.3, grade: "crit", effects: { happy: 6, money: 500, intel: 2 }, n: ["몇십 년 뒤 그중 하나가 꽤 비싼 물건이 돼 있었다.", "何十年後、その中の一つがかなり高価なものになっていた。", "Decades later, one piece turned out to be quite valuable."] },
    { chance: 0.7, grade: "good", effects: { happy: 5, intel: 2 }, n: ["앨범이 세 권이 됐다. 손주가 그걸 보며 눈을 반짝였다.", "アルバムが三冊になった。孫がそれを見て目を輝かせた。", "Three albums full. My grandkid's eyes sparkled looking through them."] }] }],
  ["casual", "🙂", ["재미로만", "楽しむだけ", "Just for fun"], { effects: { happy: 3 }, n: ["서랍 하나가 추억으로 찼다.", "引き出し一つが思い出でいっぱいになった。", "One drawer filled up with memories."] }],
]);
H("dance_hobby", { age: [16, 70], emoji: "💃", scene: "gym" }, ["춤 배우기", "ダンスを習う", "Learning to Dance"], ["회사 근처 댄스 학원에서 성인 초보반을 모집한다.", "会社近くのダンス教室で大人の初心者クラスを募集している。", "A dance studio near work is recruiting adult beginners."], [
  ["join", "🕺", ["등록한다", "申し込む", "Join"], { grade: "good", effects: { happy: 6, health: 3, social: 2 }, n: ["거울 속의 나는 어설펐지만 웃고 있었다. 연말 발표회에도 섰다.", "鏡の中の自分はぎこちなかったが笑っていた。年末の発表会にも立った。", "Clumsy in the mirror, but smiling. I even performed at the year-end recital."] }],
  ["home", "🏠", ["집에서 혼자 춘다", "家で一人で踊る", "Dance alone at home"], { effects: { happy: 4, health: 1 }, n: ["아무도 안 볼 때 나는 최고의 댄서였다.", "誰も見ていない時、私は最高のダンサーだった。", "When no one was watching, I was a star."] }],
]);
H("volunteer_abroad", { age: [20, 60], emoji: "🌏", scene: "abroad", fromYear: 1970 }, ["해외 봉사", "海外ボランティア", "Volunteering Abroad"], ["해외 학교 짓기 봉사단에서 사람을 모은다.", "海外で学校を建てるボランティア団が人を募集している。", "A volunteer group is recruiting to build a school overseas."], [
  ["go", "🧱", ["참여한다", "参加する", "Join"], { grade: "crit", effects: { happy: 7, social: 4, power: 2, money: -200 }, flag: { add: ["travel", "abroad", "volunteer_abroad"] }, n: ["벽돌을 나르던 아이들이 이름을 불러 줬다. 학교 현판에 우리 봉사단 이름이 새겨졌다.", "レンガを運ぶ子どもたちが名前を呼んでくれた。学校の看板に私たちの名前が刻まれた。", "The kids carrying bricks called my name. Our group's name went on the school's plaque."] }],
  ["fund", "💝", ["후원금을 보낸다", "支援金を送る", "Send a donation"], { effects: { money: -50, happy: 2 }, n: ["완공 사진이 메일로 왔다.", "完成写真がメールで届いた。", "Photos of the finished school arrived by email."] }],
]);
H("garden_plant", { age: [25, 95], emoji: "🪴", scene: "home" }, ["반려 식물", "観葉植物", "A Houseplant"], ["친구가 이사 선물로 화분을 줬다.", "友達が引っ越し祝いに鉢植えをくれた。", "A friend gives you a potted plant as a housewarming gift."], [
  ["care", "💧", ["정성껏 키운다", "丁寧に育てる", "Care for it lovingly"], { grade: "good", effects: { happy: 4, health: 1 }, n: ["10년 뒤 천장까지 자랐다. 이름도 붙였다.", "十年後、天井まで育った。名前もつけた。", "Ten years later, it reached the ceiling. It had a name by then."] }],
  ["forget", "🥀", ["가끔 생각날 때 물을 준다", "思い出した時に水をやる", "Water it whenever you remember"], { effects: { happy: 1 }, n: ["의외로 잘 버텼다. 강한 친구였다.", "意外とよく耐えた。強いやつだった。", "Surprisingly, it survived. A tough little thing."] }],
]);
H("craft_market", { age: [20, 80], emoji: "🧺", scene: "market" }, ["플리마켓에 나가 보기", "フリマに出店", "Selling at a Craft Market"], ["손으로 만든 물건을 플리마켓에서 팔아 볼까.", "手作りの品をフリマで売ってみようか。", "Sell your handmade things at a craft market?"], [
  ["sell", "🛍️", ["가판대를 연다", "出店する", "Set up a stall"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 6, money: 60, social: 3 }, n: ["다 팔렸다. 단골이 생겼다.", "完売した。常連さんができた。", "Sold out. I even got regulars."] },
    { chance: 0.5, grade: "mid", effects: { happy: 2, social: 2 }, n: ["세 개 팔았다. 옆 가판대 사람과 친구가 됐다.", "三つ売れた。隣の出店者と友達になった。", "Sold three. Became friends with the stall next door."] }] }],
  ["gift", "🎁", ["팔지 않고 선물한다", "売らずに贈る", "Give them as gifts instead"], { effects: { happy: 4, social: 3 }, n: ["받은 사람들이 매일 그걸 썼다.", "もらった人たちは毎日それを使ってくれた。", "Everyone used them every day."] }],
]);
H("camping_family", { age: [25, 70], emoji: "⛺", scene: "camping", fromYear: 1980 }, ["첫 캠핑", "初めてのキャンプ", "First Time Camping"], ["캠핑 장비를 빌려 첫 캠핑을 가 본다.", "キャンプ道具を借りて初めてのキャンプへ。", "You borrow gear and go camping for the first time."], [
  ["tent", "⛺", ["텐트를 직접 친다", "テントを自分で張る", "Pitch the tent yourself"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 6, power: 2, health: 1 }, n: ["별이 쏟아졌다. 모닥불 냄새가 옷에 배었다.", "星が降るようだった。焚き火の匂いが服に染みた。", "A sky full of stars. My clothes smelled of campfire for days."] },
    { chance: 0.5, grade: "mid", effects: { happy: 3, health: -1 }, n: ["밤새 비가 샜다. 그래도 다들 웃었다.", "一晩中雨漏りした。それでもみんな笑っていた。", "It leaked all night. We laughed anyway."] }] }],
  ["glamp", "🛖", ["글램핑으로", "グランピングで", "Go glamping instead"], { effects: { happy: 5, money: -100 }, n: ["편했다. 별도 보였다.", "快適だった。星も見えた。", "Comfortable. And stars too."] }],
]);
H("marathon_volunteer", { age: [15, 70], emoji: "🥤", scene: "street" }, ["마라톤 물 나눠 주기", "マラソンの給水ボランティア", "Handing Out Water at a Marathon"], ["마라톤 대회에서 급수 봉사자를 모집한다.", "マラソン大会で給水ボランティアを募集している。", "The city marathon needs volunteers at the water stations."], [
  ["help", "💧", ["참여한다", "参加する", "Volunteer"], { grade: "good", effects: { social: 3, happy: 4 }, n: ["물컵을 받던 사람들이 '고마워요!'를 외쳤다. 다음 해엔 나도 달렸다.", "紙コップを受け取る人が「ありがとう!」と叫んだ。翌年は自分も走った。", "Runners shouted 'Thank you!' as they grabbed cups. The next year, I ran too."] }],
  ["cheer", "📣", ["길가에서 응원만", "沿道で応援だけ", "Just cheer from the sidelines"], { effects: { happy: 3 }, n: ["모르는 사람 이름을 소리 높여 불렀다.", "知らない人の名前を大声で呼んだ。", "I shouted strangers' names written on their bibs."] }],
]);
H("old_car_hobby", { age: [30, 80], emoji: "🚙", scene: "street", fromYear: 1970 }, ["옛날 차 고치기", "旧車いじり", "Restoring an Old Car"], ["폐차 직전의 오래된 차를 싸게 살 수 있다.", "廃車寸前の古い車を安く買える。", "You could buy an old car that's nearly scrap, dirt cheap."], [
  ["buy", "🔧", ["사서 고친다", "買って直す", "Buy it and restore it"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { happy: 8, intel: 3, money: -300 }, n: ["3년 만에 시동이 걸렸다. 동네 아이들이 구경하러 왔다.", "三年がかりでエンジンがかかった。近所の子どもが見に来た。", "Three years later, it roared to life. The neighborhood kids came to look."] },
    { chance: 0.6, grade: "mid", effects: { happy: 2, intel: 2, money: -400 }, n: ["부품값이 차값을 넘었다. 그래도 차고에서 보낸 시간은 좋았다.", "部品代が車代を超えた。それでもガレージでの時間はよかった。", "Parts cost more than the car. But the garage hours were good."] }] }],
  ["no", "🙅", ["상상만 한다", "想像だけする", "Just dream about it"], { effects: { happy: 1 }, n: ["자동차 잡지를 정기 구독했다.", "車の雑誌を定期購読した。", "I subscribed to a car magazine."] }],
]);
H("pet_second", { age: [20, 75], emoji: "🐈‍⬛", scene: "home", hasPet: true }, ["둘째 반려동물", "二匹目のペット", "A Second Pet"], ["지금 키우는 아이가 외로워 보인다. 둘째를 들일까.", "今いる子が寂しそうだ。二匹目を迎えようか。", "Your pet seems lonely. Get a second one?"], [
  ["adopt", "🐾", ["데려온다", "迎える", "Adopt another"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 6, money: -50 }, life: { pet: {} }, n: ["처음 일주일은 하악질, 한 달 뒤엔 꼭 붙어 잤다.", "最初の一週間は威嚇、一か月後にはくっついて寝ていた。", "A week of hissing, then a month later they slept curled together."] },
    { chance: 0.4, grade: "mid", effects: { happy: 2, money: -50, health: -1 }, life: { pet: {} }, n: ["서로 영역 싸움을 했다. 집이 두 구역으로 나뉘었다.", "縄張り争いをした。家が二つの領域に分かれた。", "Turf wars. The house split into two territories."] }] }],
  ["play", "🧶", ["대신 더 많이 놀아 준다", "代わりにもっと遊んであげる", "Play with them more instead"], { grade: "good", effects: { happy: 4, health: 1 }, n: ["매일 저녁 30분 놀이 시간이 생겼다.", "毎晩三十分の遊び時間ができた。", "Thirty minutes of playtime every evening."] }],
]);
H("stargazing", { age: [8, 90], emoji: "🔭", scene: "rooftop" }, ["별 보기", "星を見る", "Stargazing"], ["오늘 밤 유성우가 쏟아진다고 한다.", "今夜は流星群が見られるらしい。", "There's a meteor shower tonight."], [
  ["out", "🌠", ["도시 밖으로 나간다", "街の外へ出る", "Drive out of the city"], { grade: "crit", effects: { happy: 8, intel: 1 }, n: ["새벽 두 시, 하나가 하늘을 가로질렀다. 소원을 빌 틈도 없었다.", "午前二時、一つが空を横切った。願い事をする暇もなかった。", "At 2 a.m., one streaked across the sky. No time to make a wish."] }],
  ["roof", "🏢", ["옥상에서 본다", "屋上から見る", "Watch from the rooftop"], { effects: { happy: 4 }, n: ["도시 불빛 때문에 두 개만 봤다. 그래도 좋았다.", "街の灯りのせいで二つしか見えなかった。それでもよかった。", "City lights meant I only saw two. Still worth it."] }],
]);
H("puzzle_hobby", { age: [8, 95], emoji: "🧩", scene: "home" }, ["천 조각 퍼즐", "千ピースのパズル", "A 1,000-Piece Puzzle"], ["천 조각짜리 퍼즐을 선물받았다.", "千ピースのパズルをもらった。", "You received a 1,000-piece jigsaw puzzle."], [
  ["finish", "🧩", ["끝까지 맞춘다", "最後まで完成させる", "Finish it"], { grade: "good", effects: { intel: 2, happy: 5 }, n: ["마지막 한 조각이 소파 밑에 있었다. 액자에 넣어 걸었다.", "最後の一ピースはソファの下にあった。額に入れて飾った。", "The last piece was under the couch. I framed the finished puzzle."] }],
  ["family", "👨‍👩‍👧", ["가족과 함께 맞춘다", "家族と一緒に作る", "Do it together as a family"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["식탁이 일주일 동안 퍼즐 차지였다. 밥은 거실에서 먹었다.", "食卓が一週間パズルに占領された。ご飯はリビングで食べた。", "The table was puzzle territory for a week. We ate in the living room."] }],
]);
H("trip_parents", { age: [25, 60], emoji: "🧳", scene: "abroad" }, ["부모님과 여행", "両親と旅行", "Traveling with Your Parents"], ["부모님이 해외여행을 한 번도 못 가 보셨다고 한다.", "両親が海外旅行に一度も行ったことがないという。", "Your parents have never been abroad."], [
  ["go", "✈️", ["모시고 간다", "連れて行く", "Take them"], { grade: "crit", effects: { happy: 8, social: 3, money: -250 }, flag: { add: "travel" }, n: ["엄마가 비행기 창밖 구름을 사진으로 백 장 찍었다.", "母が飛行機の窓から雲の写真を百枚撮った。", "Mom took a hundred photos of clouds from the plane window."] }],
  ["later", "📅", ["나중에 꼭", "いつか必ず", "Someday, for sure"], { effects: { happy: -1 }, n: ["'나중에'가 쌓여 갔다.", "「いつか」が積み重なっていった。", "'Someday' kept piling up."] }],
]);
H("art_museum", { age: [10, 95], emoji: "🖼️", scene: "library" }, ["미술관", "美術館", "The Art Museum"], ["유명한 화가의 전시가 열렸다.", "有名な画家の展覧会が開かれた。", "A famous painter's exhibition opens."], [
  ["slow", "🚶", ["한 작품 앞에 오래 머문다", "一つの作品の前に長くとどまる", "Linger in front of one painting"], { grade: "good", effects: { happy: 4, intel: 3 }, n: ["그림 속 노란색이 며칠 동안 눈에 남았다.", "絵の中の黄色が何日も目に残った。", "That yellow stayed in my eyes for days."] }],
  ["shop", "🛍️", ["엽서를 잔뜩 산다", "ポストカードをたくさん買う", "Buy lots of postcards"], { effects: { happy: 3, money: -10 }, n: ["냉장고가 작은 미술관이 됐다.", "冷蔵庫が小さな美術館になった。", "My fridge became a tiny gallery."] }],
]);
H("pet_old_walk", { age: [15, 90], emoji: "🦮", scene: "park", hasPet: true, petMinAge: 8 }, ["느려진 산책", "ゆっくりになった散歩", "Slower Walks"], ["반려동물의 걸음이 예전 같지 않다. 산책이 짧아졌다.", "ペットの歩みが昔のようではない。散歩が短くなった。", "Your pet's steps aren't what they were. Walks have gotten shorter."], [
  ["slow", "🐢", ["속도를 맞춰 천천히", "ペースを合わせてゆっくり", "Slow down to match their pace"], { grade: "good", effects: { happy: 4, health: 1 }, n: ["같은 길이었는데 처음 보는 꽃이 많았다.", "同じ道なのに初めて見る花がたくさんあった。", "Same path, but so many flowers I'd never noticed."] }],
  ["stroller", "🛒", ["반려동물 유모차를 산다", "ペットカートを買う", "Buy a pet stroller"], { effects: { happy: 4, money: -30 }, n: ["유모차에서 바깥 냄새를 맡으며 행복해했다.", "カートから外の匂いを嗅いで嬉しそうだった。", "They sniffed the breeze happily from the stroller."] }],
]);

// ---------- 건강 보충 ----------
X("health", "sleep_apnea", { age: [35, 75], emoji: "😴", scene: "home" }, ["코골이", "いびき", "Snoring"], ["가족이 밤에 숨이 멈추는 것 같다며 걱정한다.", "家族が夜、息が止まっているようだと心配する。", "Your family worries you seem to stop breathing at night."], [
  ["test", "🩺", ["수면 검사를 받는다", "睡眠検査を受ける", "Get a sleep study"], { grade: "good", effects: { health: 4, happy: 2, money: -60 }, n: ["치료를 받자 아침이 개운해졌다. 가족도 잠을 잤다.", "治療を受けると朝がすっきりした。家族も眠れるようになった。", "With treatment, mornings felt fresh. My family finally slept too."] }],
  ["ignore", "🙉", ["별것 아니다", "大したことない", "It's nothing"], { grade: "bad", effects: { health: -3 }, n: ["낮에 자꾸 졸았다.", "昼間によく居眠りした。", "I kept nodding off during the day."] }],
]);
X("health", "posture", { age: [12, 40], emoji: "🦴", scene: "kidroom" }, ["거북목", "ストレートネック", "Text Neck"], ["거울을 보니 목이 앞으로 쭉 나와 있다.", "鏡を見ると首が前に突き出ている。", "In the mirror, your neck juts forward."], [
  ["fix", "🧘", ["스트레칭과 모니터 높이 조절", "ストレッチとモニターの高さ調整", "Stretch and raise your screen"], { grade: "good", effects: { health: 3 }, n: ["석 달 뒤 사진 속 자세가 달라졌다.", "三か月後、写真の姿勢が変わった。", "Three months later, my posture looked different in photos."] }],
  ["later", "📱", ["나중에", "あとで", "Later"], { effects: { health: -1 }, n: ["어깨가 늘 뭉쳐 있었다.", "肩がいつも凝っていた。", "My shoulders were always tight."] }],
]);
X("health", "water_habit", { age: [15, 85], emoji: "💧", scene: "office" }, ["물 마시기", "水を飲む", "Drinking Enough Water"], ["하루에 물을 한 잔도 안 마신 날이 많다.", "一日に水を一杯も飲まない日が多い。", "Many days, you don't drink a single glass of water."], [
  ["bottle", "🧴", ["물병을 들고 다닌다", "水筒を持ち歩く", "Carry a water bottle"], { grade: "good", effects: { health: 3, happy: 1 }, n: ["두통이 줄었다. 물병에 스티커가 늘었다.", "頭痛が減った。水筒にステッカーが増えた。", "Fewer headaches. More stickers on my water bottle."] }],
  ["coffee", "☕", ["커피면 됐다", "コーヒーで十分", "Coffee counts, right?"], { effects: { health: -1 }, n: ["오후마다 피곤했다.", "午後はいつも疲れていた。", "Every afternoon, I was tired."] }],
]);
X("health", "panic_attack", { age: [18, 60], emoji: "💓", scene: "subway" }, ["갑자기 숨이 막혔다", "突然息が苦しくなった", "Suddenly You Can't Breathe"], ["붐비는 지하철에서 갑자기 심장이 뛰고 숨이 막혔다.", "混んだ地下鉄で突然動悸がして息が苦しくなった。", "On a crowded train, your heart races and you can't catch your breath."], [
  ["help", "🩺", ["병원에서 진료받는다", "病院で診てもらう", "See a doctor"], { grade: "good", effects: { health: 3, happy: 3, money: -50 }, n: ["공황이라고 했다. 숨 쉬는 법을 배웠고, 점점 나아졌다.", "パニック発作だと言われた。呼吸法を学び、だんだん良くなった。", "Panic attacks, they said. I learned breathing techniques and slowly improved."] }],
  ["avoid", "🚶", ["지하철을 피한다", "地下鉄を避ける", "Avoid the subway"], { effects: { happy: -2, health: -1 }, n: ["출근길이 한 시간 길어졌다.", "通勤が一時間長くなった。", "My commute got an hour longer."] }],
]);
X("health", "dental_brace", { age: [11, 25], emoji: "😬", scene: "clinic" }, ["치아 교정", "歯列矯正", "Braces"], ["치과에서 교정을 권한다. 2년이 걸린다고 한다.", "歯医者が矯正を勧める。二年かかるという。", "The dentist recommends braces. Two years."], [
  ["do", "🦷", ["한다", "する", "Get them"], { grade: "good", effects: { happy: 2, money: -200, health: 1 }, n: ["2년 동안 사진에서 입을 다물었다. 풀던 날 거울 앞에서 계속 웃었다.", "二年間写真では口を閉じた。外した日、鏡の前で笑い続けた。", "Two years of closed-mouth photos. The day they came off, I couldn't stop smiling at the mirror."] }],
  ["skip", "🙂", ["지금 웃는 모습이 좋다", "今の笑顔でいい", "I like my smile as it is"], { effects: { happy: 3 }, n: ["삐뚤어진 송곳니가 매력이라는 말을 들었다.", "八重歯がチャームポイントだと言われた。", "People said my crooked tooth was charming."] }],
]);
X("health", "hike_injury", { age: [30, 75], emoji: "🩹", scene: "mountain" }, ["하산길 발목", "下山中の足首", "Ankle on the Way Down"], ["산에서 내려오다 발목을 접질렸다.", "下山中に足首をひねった。", "Coming down the mountain, you twist your ankle."], [
  ["rest", "🧊", ["바로 쉬고 냉찜질", "すぐ休んで冷やす", "Rest and ice it immediately"], { grade: "good", effects: { health: 1 }, n: ["일주일 만에 나았다. 등산화를 새로 샀다.", "一週間で治った。登山靴を新しくした。", "Healed in a week. I bought new hiking boots."] }],
  ["push", "🚶", ["참고 계속 걷는다", "我慢して歩き続ける", "Grit your teeth and keep walking"], { grade: "bad", effects: { health: -4 }, n: ["깁스를 6주 했다.", "ギプスを六週間した。", "Six weeks in a cast."] }],
]);
X("health", "eye_strain", { age: [20, 65], emoji: "👁️", scene: "office", fromYear: 1985 }, ["눈이 침침하다", "目がかすむ", "Tired Eyes"], ["하루 종일 화면을 봤더니 눈이 뻑뻑하다.", "一日中画面を見ていて目が乾く。", "Staring at screens all day, your eyes are dry and sore."], [
  ["rule", "⏱️", ["20분마다 먼 곳 보기", "二十分ごとに遠くを見る", "Look far away every 20 minutes"], { grade: "good", effects: { health: 2 }, n: ["창밖 나무를 보는 습관이 생겼다.", "窓の外の木を見る習慣ができた。", "Looking at the tree outside became a habit."] }],
  ["drops", "💧", ["인공눈물로 버틴다", "目薬でしのぐ", "Get by with eye drops"], { effects: { health: 1, money: -5 }, n: ["책상 서랍에 안약이 다섯 개 굴러다녔다.", "机の引き出しに目薬が五本転がっていた。", "Five bottles of eye drops rattled around my desk drawer."] }],
]);
X("health", "vitamin_d", { age: [20, 80], emoji: "🌞", scene: "park" }, ["햇볕 쬐기", "日光浴", "Getting Some Sun"], ["실내에만 있었더니 기운이 없다. 의사가 햇볕을 쬐라고 한다.", "屋内にばかりいて元気がない。医者に日光を浴びろと言われた。", "Stuck indoors, you feel drained. The doctor says get some sun."], [
  ["walk", "🚶", ["점심시간에 산책한다", "昼休みに散歩する", "Walk during lunch"], { grade: "good", effects: { health: 3, happy: 3 }, n: ["점심 산책이 하루 중 가장 좋은 시간이 됐다.", "昼の散歩が一日で一番好きな時間になった。", "The lunchtime walk became my favorite part of the day."] }],
  ["pill", "💊", ["영양제로 대신한다", "サプリで代用する", "Take a supplement instead"], { effects: { health: 1, money: -5 }, n: ["수치는 올랐다. 기분은 그대로였다.", "数値は上がった。気分は変わらなかった。", "The numbers improved. My mood didn't."] }],
]);
X("health", "therapy_dog", { age: [60, 100], emoji: "🐕‍🦺", scene: "seniorCenter" }, ["치료견 방문", "セラピー犬の訪問", "A Therapy Dog Visit"], ["복지관에 치료견이 찾아왔다.", "福祉館にセラピー犬が来た。", "A therapy dog visits the senior center."], [
  ["pet", "🤗", ["쓰다듬는다", "なでる", "Pet the dog"], { grade: "good", effects: { happy: 6, health: 1 }, n: ["따뜻한 털 아래 심장 소리가 느껴졌다. 웃음이 났다.", "温かい毛の下に心臓の音を感じた。笑みがこぼれた。", "I felt a heartbeat under the warm fur. I couldn't help smiling."] }],
  ["watch", "👀", ["멀리서 본다", "遠くから見る", "Watch from a distance"], { effects: { happy: 3 }, n: ["개가 먼저 다가와 손을 핥았다.", "犬の方から近寄って手をなめた。", "The dog came over and licked my hand."] }],
]);
X("health", "health_app", { age: [25, 70], emoji: "⌚", scene: "gym", fromYear: 2015 }, ["스마트워치", "スマートウォッチ", "A Smartwatch"], ["손목시계가 하루 걸음 수와 심박수를 알려 준다.", "腕時計が一日の歩数と心拍数を教えてくれる。", "Your watch tracks your steps and heart rate."], [
  ["goal", "🎯", ["목표 걸음 수를 채운다", "目標歩数を達成する", "Hit your step goal daily"], { grade: "good", effects: { health: 3, happy: 2 }, n: ["밤 11시에 거실을 돌며 마지막 300걸음을 채웠다.", "夜十一時にリビングを歩き回って最後の三百歩を稼いだ。", "At 11 p.m., I paced the living room for the last 300 steps."] }],
  ["ignore", "📵", ["알림을 끈다", "通知をオフにする", "Turn off the notifications"], { effects: { happy: 1 }, n: ["그냥 시계로 썼다.", "ただの時計として使った。", "It became just a watch."] }],
]);
X("health", "mental_break", { age: [18, 70], emoji: "🌿", scene: "countryside" }, ["마음의 휴가", "心の休暇", "A Mental Health Break"], ["몸은 멀쩡한데 마음이 지쳤다. 며칠 쉬어 갈까.", "体は大丈夫なのに心が疲れた。数日休もうか。", "Your body's fine, but your mind is exhausted. Take a few days off?"], [
  ["rest", "🏞️", ["휴가를 내고 시골로 간다", "休みを取って田舎へ行く", "Take leave and go to the countryside"], { grade: "good", effects: { happy: 6, health: 2, money: -50 }, n: ["아무것도 안 했다. 그게 제일 필요했다.", "何もしなかった。それが一番必要だった。", "I did nothing. That's what I needed most."] }],
  ["push", "💼", ["참고 일한다", "我慢して働く", "Keep working"], { grade: "bad", effects: { happy: -4, health: -2 }, n: ["한 달 뒤 더 크게 지쳤다.", "一か月後、もっとひどく疲れた。", "A month later, I was even more worn out."] }],
]);
X("health", "night_shift", { age: [20, 60], emoji: "🌙", scene: "office", cond: (p) => !!p.job }, ["야간 근무", "夜勤", "Night Shifts"], ["야간 근무 조로 바뀌었다. 수당은 많다.", "夜勤シフトに変わった。手当は多い。", "You've been moved to night shifts. The extra pay is good."], [
  ["adapt", "🛌", ["암막 커튼으로 낮잠 리듬을 만든다", "遮光カーテンで昼寝のリズムを作る", "Blackout curtains, strict sleep schedule"], { grade: "good", effects: { money: 200, health: -1 }, n: ["몸이 적응했다. 해 뜨는 퇴근길이 이상하게 좋았다.", "体が慣れた。朝日の中の帰り道が妙によかった。", "My body adjusted. The sunrise commute home felt oddly beautiful."] }],
  ["swap", "🔁", ["주간 근무로 돌려 달라고 한다", "日勤に戻してほしいと頼む", "Ask to go back to day shifts"], { effects: { health: 1, money: -50 }, n: ["몇 달 뒤 돌아왔다. 잠이 돌아왔다.", "数か月後に戻れた。眠りも戻った。", "Months later, I was back on days. Sleep came back too."] }],
]);

// ---------- 학교·사랑·세계·노년 보충 ----------
X("school", "lunch_box_era", { age: [7, 15], emoji: "🍱", scene: "classroom", era: ["early", "past"] }, ["도시락 검사", "弁当の検査", "Lunch Box Inspection"], ["선생님이 도시락에 잡곡이 섞였는지 검사한다.", "先生が弁当に雑穀が混ざっているか検査する。", "The teacher inspects lunch boxes to check for mixed grains."], [
  ["proud", "🍚", ["보리밥을 당당히 보여 준다", "麦飯を堂々と見せる", "Proudly show your barley rice"], { grade: "good", effects: { happy: 2, social: 1 }, n: ["칭찬받았다. 옆자리 친구와 반찬을 바꿔 먹었다.", "褒められた。隣の子とおかずを交換した。", "Got praised. Traded side dishes with my neighbor."] }],
  ["share", "🥢", ["도시락을 못 싸 온 친구와 나눈다", "弁当がない友達と分ける", "Share with a friend who has no lunch"], { grade: "good", effects: { social: 4, happy: 3, health: -1 }, n: ["친구는 그날을 어른이 돼서도 이야기했다.", "その友は大人になってもあの日のことを話した。", "My friend still talked about that day as an adult."] }],
]);
X("school", "chalk_eraser", { age: [8, 14], emoji: "🧽", scene: "classroom" }, ["칠판 지우개 당번", "黒板消し当番", "Blackboard Duty"], ["이번 주 칠판 지우개 당번이다.", "今週は黒板消し当番だ。", "You're on blackboard eraser duty this week."], [
  ["clean", "✨", ["창밖에서 털어 깨끗하게", "窓の外ではたいてきれいに", "Clap them out the window till spotless"], { grade: "good", effects: { social: 2, happy: 2 }, n: ["분필 가루가 해 질 녘 햇빛에 반짝였다.", "チョークの粉が夕日に光った。", "Chalk dust glittered in the late afternoon sun."] }],
  ["skip", "🏃", ["친구에게 미루고 놀러 간다", "友達に押し付けて遊びに行く", "Dump it on a friend and run off"], { effects: { happy: 2, social: -2 }, n: ["다음 주 당번표에 내 이름이 두 번 적혀 있었다.", "翌週の当番表に私の名前が二回書かれていた。", "My name was on next week's chart twice."] }],
]);
X("school", "school_newspaper", { age: [13, 22], emoji: "📰", scene: "library" }, ["학교 신문", "学校新聞", "The School Newspaper"], ["학교 신문 기자를 모집한다.", "学校新聞の記者を募集している。", "The school newspaper is looking for reporters."], [
  ["join", "✍️", ["기자가 된다", "記者になる", "Become a reporter"], { grade: "good", effects: { intel: 3, social: 3 }, flag: { add: "journalist_kid" }, n: ["급식 불만을 취재한 기사가 실렸다. 다음 달 메뉴가 바뀌었다.", "給食の不満を取材した記事が載った。翌月メニューが変わった。", "My article on cafeteria complaints ran. The menu changed the next month."] }],
  ["read", "📖", ["독자로 남는다", "読者でいる", "Stay a reader"], { effects: { intel: 1 }, n: ["매달 신문을 가장 먼저 읽었다.", "毎月新聞を一番に読んだ。", "I was always first to read each issue."] }],
]);
X("school", "vocational_pride", { age: [16, 22], emoji: "🔧", scene: "lab" }, ["기술을 배우는 학교", "技術を学ぶ学校", "A Vocational School"], ["대학 대신 기술 학교에 가겠다고 하자 친척들이 걱정한다.", "大学の代わりに技術学校へ行くと言うと親戚が心配する。", "You say you'll go to a trade school instead of college. Relatives worry."], [
  ["go", "🛠️", ["간다", "行く", "Go anyway"], { grade: "good", effects: { power: 2, intel: 2, money: 100 }, flag: { add: ["college_done", "vocational_track"] }, n: ["졸업 전에 취업이 됐다. 명절에 친척들 집 고장 난 걸 다 고쳐 줬다.", "卒業前に就職が決まった。正月に親戚の家の壊れた物を全部直した。", "I had a job before graduation. Over the holidays, I fixed everything broken in my relatives' homes."] }],
  ["college", "🎓", ["대학으로 바꾼다", "大学に変える", "Switch to college"], { effects: { intel: 2, happy: -1 }, n: ["가끔 그 학교 앞을 지나며 생각했다.", "時々その学校の前を通って考えた。", "Sometimes I'd pass that school and wonder."] }],
]);
X("school", "parents_night_school", { age: [6, 14], emoji: "🌙", scene: "classroom", era: ["early", "past"] }, ["엄마의 야학", "母の夜学", "Mom's Night School"], ["엄마가 밤마다 글을 배우러 다니신다. 숙제를 도와 달라고 하신다.", "母が毎晩字を習いに通っている。宿題を手伝ってと言う。", "Your mother attends night school to learn to read. She asks you to help with her homework."], [
  ["help", "✏️", ["가르쳐 드린다", "教えてあげる", "Teach her"], { grade: "crit", effects: { happy: 6, intel: 2, social: 2 }, n: ["엄마가 처음으로 내 이름을 써서 보여 주셨다.", "母が初めて私の名前を書いて見せてくれた。", "Mom wrote my name for the first time and showed me."] }],
  ["busy", "🏃", ["놀러 나간다", "遊びに出る", "Run off to play"], { effects: { happy: 1 }, n: ["엄마는 혼자서 늦게까지 공책을 채우셨다.", "母は一人で遅くまでノートを埋めていた。", "Mom filled her notebook alone, late into the night."] }],
]);
X("love", "love_letter_war", { age: [16, 30], emoji: "💌", scene: "street", era: ["early", "past"] }, ["손편지 연애", "手紙の恋", "Love by Letter"], ["전화도 귀한 시절, 좋아하는 사람과 편지를 주고받는다.", "電話も珍しい時代、好きな人と手紙をやり取りする。", "In an era when phones are rare, you exchange letters with someone you like."], [
  ["write", "✉️", ["밤마다 편지를 쓴다", "毎晩手紙を書く", "Write every night"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 7, intel: 1 }, relation: { romance: true }, n: ["편지가 상자 두 개를 채웠다. 그 상자는 평생 이사를 따라왔다.", "手紙が箱二つを埋めた。その箱は一生引っ越しについてきた。", "The letters filled two boxes. They followed me through every move."] },
    { chance: 0.5, grade: "mid", effects: { happy: -2, intel: 1 }, n: ["답장이 점점 늦어지더니 끊겼다. 마지막 편지는 부치지 못했다.", "返事がだんだん遅れ、途絶えた。最後の手紙は出せなかった。", "Replies slowed, then stopped. I never mailed the last letter."] }] }],
  ["shy", "🙈", ["부끄러워 못 보낸다", "恥ずかしくて送れない", "Too shy to send"], { effects: { happy: -1 }, n: ["서랍에 부치지 못한 편지가 쌓였다.", "引き出しに出せない手紙が積もった。", "Unsent letters piled up in my drawer."] }],
]);
X("love", "couple_finances", { age: [26, 55], emoji: "💑", scene: "home", married: true }, ["부부의 돈 관리", "夫婦のお金の管理", "Managing Money as a Couple"], ["{spouse}와 돈 관리를 어떻게 할지 정해야 한다.", "{spouse}とお金の管理をどうするか決めなければ。", "You and {spouse} need to decide how to manage money."], [
  ["joint", "🏦", ["통장을 합친다", "口座を一つにする", "Merge your accounts"], { grade: "good", effects: { money: 100, happy: 2 }, n: ["가계부를 같이 썼다. 목표가 하나가 됐다.", "家計簿を一緒につけた。目標が一つになった。", "We kept the budget together. One shared goal."] }],
  ["separate", "🔀", ["각자 관리하고 생활비만 나눈다", "各自管理して生活費だけ分ける", "Keep separate accounts, split expenses"], { effects: { happy: 2, intel: 1 }, n: ["서로의 지출에 간섭하지 않았다. 다툴 일이 줄었다.", "互いの支出に口を出さなかった。けんかが減った。", "We didn't police each other's spending. Fewer fights."] }],
]);
X("love", "date_night", { age: [28, 75], emoji: "🌃", scene: "restaurant", married: true, hasKid: true }, ["부부만의 저녁", "夫婦だけの夜", "Date Night"], ["아이들을 맡기고 {spouse}와 둘만의 저녁을 계획한다.", "子どもを預けて{spouse}と二人きりの夕食を計画する。", "You arrange childcare and plan a dinner alone with {spouse}."], [
  ["go", "🍷", ["오랜만에 데이트", "久しぶりのデート", "Go on a real date"], { grade: "good", effects: { happy: 6 }, n: ["아이 이야기는 안 하기로 했는데, 결국 아이 이야기만 했다.", "子どもの話はしないと決めたのに、結局子どもの話ばかりした。", "We promised not to talk about the kids. We talked about nothing else."] }],
  ["home", "🍜", ["집에서 라면 끓여 영화 보기", "家でラーメンと映画", "Ramen and a movie at home"], { effects: { happy: 4, money: 30 }, n: ["영화 시작 10분 만에 둘 다 잠들었다.", "映画が始まって十分で二人とも寝た。", "We both fell asleep ten minutes in."] }],
]);
X("love", "wedding_ring_lost", { age: [28, 85], emoji: "💍", scene: "beach", married: true }, ["잃어버린 결혼반지", "なくした結婚指輪", "The Lost Wedding Ring"], ["바닷가에서 결혼반지가 손가락에서 빠졌다.", "海辺で結婚指輪が指から抜けてしまった。", "At the beach, your wedding ring slips off your finger."], [
  ["search", "🔍", ["해가 질 때까지 찾는다", "日が暮れるまで探す", "Search until sunset"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { happy: 7 }, n: ["모래 속에서 반짝였다. {spouse}와 그 자리에서 다시 끼워 줬다.", "砂の中で光った。{spouse}とその場でもう一度はめ合った。", "It glinted in the sand. {spouse} slipped it back on right there."] },
    { chance: 0.6, grade: "mid", effects: { happy: -2 }, n: ["끝내 못 찾았다. {spouse}가 '반지보다 너'라고 했다.", "結局見つからなかった。{spouse}が「指輪より君だ」と言った。", "Never found it. {spouse} said, 'You matter more than the ring.'"] }] }],
  ["new", "💎", ["새로 맞추자고 한다", "新しく作ろうと言う", "Suggest getting new ones"], { effects: { happy: 3, money: -80 }, n: ["새 반지 안쪽에 '두 번째'라고 새겼다.", "新しい指輪の内側に「二度目」と刻んだ。", "We engraved 'Second' inside the new rings."] }],
]);
X("world", "election_day", { age: [18, 100], emoji: "🗳️", scene: "street", fromYear: 1948 }, ["선거일", "選挙の日", "Election Day"], ["투표하는 날이다. 날씨가 좋아 놀러 가고 싶다.", "投票日だ。天気がよくて遊びに行きたい。", "It's election day. The weather's perfect for an outing."], [
  ["vote", "✅", ["투표하고 나서 놀러 간다", "投票してから遊びに行く", "Vote first, then go out"], { grade: "good", effects: { social: 2, happy: 2 }, n: ["손등에 찍은 도장을 사진으로 남겼다.", "手の甲に押したスタンプを写真に残した。", "I took a photo of the stamp on my hand."] }],
  ["skip", "🏖️", ["그냥 놀러 간다", "そのまま遊びに行く", "Skip it and go out"], { effects: { happy: 2, social: -1 }, n: ["저녁 개표 방송을 보며 조금 찔렸다.", "夜の開票速報を見て少し後ろめたかった。", "Watching the results that night, I felt a little guilty."] }],
]);
X("world", "news_protest", { age: [16, 80], emoji: "📢", scene: "park", fromYear: 1960 }, ["거리의 목소리", "街の声", "Voices in the Street"], ["동네 공원이 개발로 사라진다며 주민 모임이 열렸다.", "地域の公園が開発でなくなるとして住民の集まりが開かれた。", "A residents' meeting is called: the neighborhood park may be bulldozed for development."], [
  ["join", "🌳", ["서명하고 모임에 나간다", "署名して集まりに出る", "Sign the petition and attend"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { social: 4, happy: 4 }, n: ["공원이 지켜졌다. 그 벤치에 작은 팻말이 붙었다.", "公園は守られた。そのベンチに小さな札がついた。", "The park was saved. A small plaque went on the bench."] },
    { chance: 0.5, grade: "mid", effects: { social: 3, happy: -2 }, n: ["공원은 줄었지만 나무 몇 그루는 남았다.", "公園は小さくなったが、何本かの木は残った。", "The park shrank, but a few trees survived."] }] }],
  ["stay", "🏠", ["관심 없다", "関心がない", "Not interested"], { effects: { happy: 1 }, n: ["1년 뒤 공원 자리에 공사 가림막이 섰다.", "一年後、公園の場所に工事の囲いが立った。", "A year later, construction barriers stood where the park had been."] }],
]);
X("old", "memory_lane_music", { age: [65, 105], emoji: "🎵", scene: "retire" }, ["젊은 날의 노래", "若き日の歌", "A Song from Your Youth"], ["라디오에서 스무 살 때 듣던 노래가 나온다.", "ラジオから二十歳の頃に聞いた歌が流れる。", "A song from when you were twenty comes on the radio."], [
  ["sing", "🎤", ["따라 부른다", "一緒に歌う", "Sing along"], { grade: "good", effects: { happy: 6 }, n: ["가사가 하나도 빠짐없이 기억났다. 놀라웠다.", "歌詞が一つ残らず思い出された。驚いた。", "I remembered every single word. Astonishing."] }],
  ["dance", "💃", ["거실에서 춤춘다", "リビングで踊る", "Dance in the living room"], { grade: "good", effects: { happy: 6, health: 1 }, n: ["손주가 영상을 찍어 가족 단톡방에 올렸다.", "孫が動画を撮って家族のグループに上げた。", "My grandkid filmed it and posted it to the family chat."] }],
]);
X("old", "elder_wisdom", { age: [70, 105], emoji: "🦉", scene: "seniorCenter" }, ["어르신의 지혜", "長老の知恵", "Elder Wisdom"], ["동네 젊은 부부가 고민을 털어놓으러 찾아왔다.", "近所の若い夫婦が悩みを打ち明けに来た。", "A young couple from the neighborhood comes to you for advice."], [
  ["listen", "👂", ["다 듣고 한마디만 한다", "全部聞いて一言だけ言う", "Listen fully, then say just one thing"], { grade: "crit", effects: { happy: 6, social: 4 }, n: ["'서로 이기려고 하지 마라.' 부부는 그 말을 냉장고에 붙였다고 했다.", "「互いに勝とうとするな」夫婦はその言葉を冷蔵庫に貼ったそうだ。", "'Don't try to win against each other.' They said they taped it to their fridge."] }],
  ["story", "📖", ["내 인생 이야기를 들려준다", "自分の人生の話をする", "Tell them your own life story"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["이야기가 길어졌다. 그들은 끝까지 들었다.", "話が長くなった。彼らは最後まで聞いた。", "The story ran long. They listened to the end."] }],
]);

export const HOBBY_EVENTS = EV;
