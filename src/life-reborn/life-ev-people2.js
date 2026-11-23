// =========================
// 플듀 인생게임 REBORN — 사건 4차: 친구·인간관계 2 (2026-11-23)
// 직장·이웃·온라인·세대 사이·작은 인연들. 형식: life-ev-kit.js 의 ev()
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const P = (id, meta, title, desc, choices) => EV.push(ev("p2_" + id, { area: "people", ...meta }, title, desc, choices));

P("lunch_alone", { age: [12, 18], emoji: "🍱", scene: "classroom" }, ["혼자 먹는 점심", "一人の昼食", "Eating Lunch Alone"], ["새 학년, 점심시간에 같이 먹을 사람이 없다.", "新学年、昼食を一緒に食べる人がいない。", "New school year, and no one to eat lunch with."], [
  ["ask", "🙋", ["'같이 먹어도 돼?'라고 묻는다", "「一緒に食べていい?」と聞く", "Ask, 'Can I sit here?'"], { grade: "good", effects: { social: 5, happy: 4 }, n: ["'당연하지.' 그 대답 하나로 1년이 달라졌다.", "「もちろん」その一言で一年が変わった。", "'Of course.' That one answer changed the whole year."] }],
  ["library", "📚", ["도서관에서 책을 읽는다", "図書館で本を読む", "Read in the library"], { effects: { intel: 3, happy: -1 }, n: ["사서 선생님과 친해졌다. 추천 책이 다 좋았다.", "司書の先生と仲良くなった。おすすめの本はどれもよかった。", "I befriended the librarian. Every book they recommended was great."] }],
]);
P("class_president_vote", { age: [10, 17], emoji: "🗳️", scene: "classroom" }, ["반장 선거 공약", "学級委員の公約", "Class Election Promises"], ["친구가 반장 선거에 나간다며 선거 운동을 도와 달라고 한다.", "友達が学級委員に立候補するので選挙運動を手伝ってと言う。", "A friend is running for class rep and asks you to help campaign."], [
  ["help", "📢", ["포스터를 만들어 준다", "ポスターを作ってあげる", "Make posters for them"], { grade: "good", effects: { social: 4, happy: 2 }, n: ["친구가 당선됐다. 첫 공약은 '급식 순서 바꾸기'였다.", "友達が当選した。最初の公約は「給食の順番を変える」だった。", "My friend won. First promise kept: rotating the lunch line."] }],
  ["run", "🙋", ["나도 나간다", "自分も立候補する", "Run against them"], { outcomes: [
    { chance: 0.45, grade: "good", effects: { social: 3, happy: 4, power: 1 }, n: ["한 표 차이로 이겼다. 친구는 부반장이 됐다. 우리는 좋은 팀이었다.", "一票差で勝った。友達は副委員に。いいチームだった。", "Won by one vote. My friend became vice-rep. We made a great team."] },
    { chance: 0.55, grade: "mid", effects: { social: -1, happy: -2 }, n: ["졌다. 축하한다고 말하는 게 생각보다 어려웠다.", "負けた。おめでとうと言うのは思ったより難しかった。", "I lost. Saying congratulations was harder than I thought."] }] }],
]);
P("sleepover", { age: [8, 15], emoji: "🛏️", scene: "kidroom" }, ["친구 집에서 자기", "友達の家にお泊まり", "A Sleepover"], ["친구 부모님이 하룻밤 자고 가도 된다고 했다.", "友達の親が一晩泊まっていいと言った。", "Your friend's parents said you can stay the night."], [
  ["stay", "🌙", ["잔다", "泊まる", "Stay over"], { grade: "good", effects: { happy: 6, social: 4 }, n: ["이불 속에서 손전등을 켜고 비밀 이야기를 했다.", "布団の中で懐中電灯をつけて秘密の話をした。", "Under the blanket with a flashlight, we told secrets."] }],
  ["home", "🏠", ["밤엔 집에 간다", "夜は家に帰る", "Go home for the night"], { effects: { happy: 1 }, n: ["다음 날 친구가 밤새 웃긴 일이 있었다고 했다.", "翌日、友達が夜中に面白いことがあったと言った。", "The next day my friend said something hilarious happened overnight."] }],
]);
P("gang_pressure", { age: [13, 19], emoji: "😈", scene: "street" }, ["무리의 압박", "グループの圧力", "Peer Pressure"], ["어울리는 무리가 편의점에서 물건을 몰래 가져오자고 한다.", "つるんでいる仲間がコンビニで万引きしようと言う。", "Your crowd wants to shoplift from the convenience store."], [
  ["no", "🙅", ["싫다고 하고 빠진다", "嫌だと言って抜ける", "Say no and walk away"], { grade: "good", effects: { social: -2, happy: 2, power: 2 }, flag: { add: "stood_up" }, n: ["며칠은 따돌림을 당했다. 그 무리는 몇 달 뒤 경찰서에 갔다.", "数日仲間外れにされた。そのグループは数か月後に警察に行った。", "I got the cold shoulder for a few days. Months later, that group ended up at the police station."] }],
  ["join", "😬", ["분위기에 휩쓸린다", "雰囲気に流される", "Go along with it"], { outcomes: [
    { chance: 0.5, grade: "bad", effects: { happy: -4, social: 1 }, flag: { add: "small_lie" }, n: ["안 걸렸다. 그런데 그날 밤 잠이 안 왔다.", "見つからなかった。でもその夜眠れなかった。", "We didn't get caught. But I couldn't sleep that night."] },
    { chance: 0.5, grade: "bad", effects: { happy: -6, social: -3 }, flag: { add: "caught_shoplifting" }, n: ["걸렸다. 엄마가 가게 주인에게 고개를 숙이는 걸 봤다.", "見つかった。母が店主に頭を下げるのを見た。", "We got caught. I watched Mom bow to the shop owner."] }] }],
]);
P("tutor_younger", { age: [14, 25], emoji: "✏️", scene: "library" }, ["동생 과외", "年下の家庭教師", "Tutoring a Younger Kid"], ["이웃집 아이 공부를 봐 달라는 부탁을 받았다.", "近所の子の勉強を見てほしいと頼まれた。", "A neighbor asks you to help their kid with schoolwork."], [
  ["teach", "📐", ["열심히 가르친다", "熱心に教える", "Teach wholeheartedly"], { grade: "good", effects: { intel: 2, social: 3, money: 30 }, n: ["아이 성적이 오르자 그 집에서 김치를 보내왔다.", "子どもの成績が上がると、その家からキムチが届いた。", "When the kid's grades rose, the family sent over homemade food."] }],
  ["no", "🙅", ["바빠서 거절한다", "忙しくて断る", "Decline — too busy"], { effects: { happy: 1 }, n: ["대신 다른 학생을 소개해 줬다.", "代わりに別の学生を紹介した。", "I recommended another student instead."] }],
]);
P("military_buddy", { age: [19, 30], emoji: "🪖", scene: "field", country: ["KR"], genderRequired: "M", flagRequired: "served" }, ["전우", "戦友", "Army Buddy"], ["군대에서 같은 내무반을 쓴 동기가 전역 후 연락해 왔다.", "軍で同じ内務班だった同期が除隊後に連絡してきた。", "Someone from your army barracks reaches out after discharge."], [
  ["meet", "🍻", ["만나서 그 시절 이야기", "会ってあの頃の話", "Meet and relive those days"], { grade: "good", effects: { social: 4, happy: 4 }, n: ["힘들었던 기억이 웃음거리가 돼 있었다.", "つらかった記憶が笑い話になっていた。", "The hard memories had turned into jokes."] }],
  ["later", "📱", ["메시지만 주고받는다", "メッセージだけやり取りする", "Just exchange messages"], { effects: { social: 1 }, n: ["매년 전역일에 '살아 있냐' 문자가 왔다.", "毎年除隊日に「生きてるか」とメールが来た。", "Every discharge anniversary: 'You alive?'"] }],
]);
P("intern_friend", { age: [21, 28], emoji: "🧑‍💼", scene: "office" }, ["인턴 동기", "インターン同期", "Fellow Interns"], ["인턴 동기들과 단톡방이 생겼다. 정규직은 두 명뿐이라고 한다.", "インターン同期とグループができた。正社員は二人だけだという。", "The interns start a group chat. Only two will get full-time offers."], [
  ["team", "🤝", ["서로 돕는다", "互いに助け合う", "Help each other out"], { grade: "good", effects: { social: 5, happy: 3 }, n: ["결과와 상관없이 그 단톡방은 10년을 갔다.", "結果に関係なく、そのグループは十年続いた。", "Whatever the outcome, that group chat lasted ten years."] }],
  ["compete", "🏁", ["나만 살아남는다", "自分だけが生き残る", "Look out only for yourself"], { outcomes: [
    { chance: 0.5, grade: "mid", effects: { money: 200, social: -3 }, n: ["정규직이 됐다. 단톡방에서는 나왔다.", "正社員になった。グループからは抜けた。", "Got the job. Left the group chat."] },
    { chance: 0.5, grade: "bad", effects: { social: -3, happy: -3 }, n: ["둘 다 놓쳤다. 자리도, 동기들도.", "両方失った。ポストも、同期も。", "Lost both: the job and the friends."] }] }],
]);
P("workplace_gossip", { age: [24, 60], emoji: "🗣️", scene: "office" }, ["탕비실 뒷담화", "給湯室の陰口", "Break Room Gossip"], ["탕비실에서 동료 험담이 한창이다. 나를 보더니 '그치?' 한다.", "給湯室で同僚の悪口が盛り上がっている。私を見て「でしょ?」と言う。", "Break room gossip is in full swing. They turn to you: 'Right?'"], [
  ["neutral", "☕", ["웃으며 커피만 타고 나온다", "笑ってコーヒーだけ入れて出る", "Smile, make coffee, and leave"], { grade: "good", effects: { social: 1, happy: 1 }, n: ["나중에 그 동료가 '넌 그런 말 안 한다며'라고 고마워했다.", "後でその同僚に「あなたはそういうこと言わないって」と感謝された。", "Later, that coworker thanked me: 'I heard you don't talk like that.'"] }],
  ["join", "🙊", ["맞장구친다", "相づちを打つ", "Agree along"], { grade: "bad", effects: { social: -2, happy: -1 }, n: ["그 말이 돌고 돌아 당사자 귀에 들어갔다.", "その話は回り回って本人の耳に入った。", "It went around and reached the person's ears."] }],
]);
P("boss_dinner", { age: [24, 55], emoji: "🍖", scene: "restaurant", cond: (p) => !!p.job }, ["상사의 저녁 초대", "上司の夕食の誘い", "The Boss's Dinner Invitation"], ["상사가 주말에 집으로 저녁을 먹으러 오라고 한다.", "上司が週末に家へ夕食に来いと言う。", "Your boss invites you to dinner at their home this weekend."], [
  ["go", "🍷", ["와인을 사 들고 간다", "ワインを持って行く", "Go with a bottle of wine"], { grade: "good", effects: { social: 4, happy: 2, money: -20 }, n: ["회사에서는 몰랐던 다정한 사람이었다. 그 집 강아지와 친해졌다.", "会社では知らなかった優しい人だった。その家の犬と仲良くなった。", "A kinder person than I knew at work. I befriended their dog."] }],
  ["excuse", "🙇", ["선약이 있다고 한다", "先約があると言う", "Say you have plans"], { effects: { happy: 1 }, n: ["월요일 회의가 조금 어색했다.", "月曜の会議が少し気まずかった。", "Monday's meeting was a little awkward."] }],
]);
P("retire_colleague", { age: [30, 60], emoji: "🎁", scene: "office" }, ["선배의 퇴직", "先輩の退職", "A Senior Colleague Retires"], ["나를 가르쳐 준 선배가 퇴직한다. 송별회 준비를 맡았다.", "自分を育ててくれた先輩が退職する。送別会の準備を任された。", "The senior who trained you is retiring, and you're organizing the farewell."], [
  ["video", "🎞️", ["동료들 영상 편지를 모은다", "同僚のビデオメッセージを集める", "Collect video messages from coworkers"], { grade: "crit", effects: { social: 5, happy: 4 }, n: ["선배가 영상을 보다 안경을 벗고 눈을 훔쳤다.", "先輩が映像を見ながら眼鏡を外して目をぬぐった。", "Watching the video, they took off their glasses and wiped their eyes."] }],
  ["simple", "🍰", ["케이크와 꽃으로 간단히", "ケーキと花で簡単に", "Keep it simple with cake and flowers"], { effects: { social: 2, happy: 2 }, n: ["선배가 마지막으로 내 어깨를 두 번 두드렸다.", "先輩が最後に私の肩を二度叩いた。", "On the way out, they patted my shoulder twice."] }],
]);
P("old_classmate_famous", { age: [28, 60], emoji: "📺", scene: "home" }, ["텔레비전 속 동창", "テレビの中の同級生", "A Classmate on TV"], ["텔레비전에 초등학교 짝꿍이 나왔다. 꽤 유명해졌다.", "テレビに小学校の隣の席の子が出ていた。かなり有名になっている。", "Your elementary school seatmate is on TV — and pretty famous now."], [
  ["msg", "💬", ["축하 메시지를 보낸다", "お祝いのメッセージを送る", "Send a congratulations message"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { happy: 5, social: 3 }, n: ["답장이 왔다. '너 지우개 아직 기억나!'", "返事が来た。「君の消しゴムまだ覚えてるよ!」", "They replied: 'I still remember your eraser!'"] },
    { chance: 0.5, grade: "mid", effects: { happy: 1 }, n: ["답은 없었다. 바쁘겠지 했다.", "返事はなかった。忙しいんだろうと思った。", "No reply. They must be busy."] }] }],
  ["brag", "😎", ["주변에 자랑한다", "周りに自慢する", "Brag to everyone"], { effects: { happy: 3, social: 1 }, n: ["아무도 안 믿었다. 졸업 앨범을 꺼내야 했다.", "誰も信じなかった。卒業アルバムを出す羽目になった。", "No one believed me. I had to dig out the yearbook."] }],
]);
P("neighbor_kid", { age: [30, 80], emoji: "🧒", scene: "street" }, ["옆집 아이", "隣の子", "The Kid Next Door"], ["옆집 아이가 혼자 대문 앞에 앉아 있다. 열쇠를 잃어버렸단다.", "隣の子が一人で門の前に座っている。鍵をなくしたらしい。", "The neighbor's kid is sitting alone by the gate. They lost their key."], [
  ["care", "🍪", ["집에서 기다리게 한다", "家で待たせてあげる", "Let them wait at your place"], { grade: "good", effects: { social: 4, happy: 3 }, n: ["간식을 먹으며 숙제를 봐 줬다. 그 뒤로 아이가 인사를 크게 했다.", "おやつを食べながら宿題を見てあげた。それから大きな声で挨拶するようになった。", "We had snacks and did homework. After that, they always greeted me loudly."] }],
  ["call", "📞", ["부모에게 연락만 해 준다", "親に連絡だけしてあげる", "Just call their parents"], { effects: { social: 2 }, n: ["부모가 금방 왔다. 고맙다며 귤을 주고 갔다.", "親がすぐ来た。お礼にみかんを置いていった。", "The parent came quickly and left tangerines as thanks."] }],
]);
P("landlord_kind", { age: [20, 40], emoji: "🔑", scene: "home", cond: (p) => p.housing === "rent" }, ["집주인 할머니", "大家のおばあさん", "The Landlady"], ["혼자 사는 집주인 할머니가 반찬이 남았다며 문을 두드린다.", "一人暮らしの大家のおばあさんが、おかずが余ったとドアを叩く。", "Your elderly landlady knocks with leftover side dishes."], [
  ["chat", "🫖", ["차 한잔 같이 한다", "一緒にお茶を飲む", "Have tea together"], { grade: "good", effects: { social: 4, happy: 4, health: 1 }, n: ["할머니의 젊은 시절 이야기는 소설보다 재미있었다.", "おばあさんの若い頃の話は小説より面白かった。", "Her stories from her youth were better than novels."] }],
  ["thanks", "🙏", ["감사 인사만 한다", "お礼だけ言う", "Just say thanks"], { effects: { health: 1 }, n: ["반찬통을 씻어서 돌려드렸다. 다음 주에 또 왔다.", "容器を洗って返した。翌週また来た。", "I washed and returned the containers. More came the next week."] }],
]);
P("online_hate", { age: [15, 50], emoji: "💻", scene: "home", fromYear: 2000 }, ["악플", "誹謗中傷のコメント", "Hateful Comments"], ["내가 올린 글에 모르는 사람들이 악플을 달기 시작했다.", "自分の投稿に知らない人たちが中傷コメントを書き始めた。", "Strangers start leaving nasty comments on something you posted."], [
  ["ignore", "🔇", ["차단하고 로그아웃한다", "ブロックしてログアウトする", "Block and log off"], { grade: "good", effects: { happy: 2 }, n: ["산책을 다녀오니 다 별것 아니었다.", "散歩から戻ると全部どうでもよくなっていた。", "After a walk, none of it mattered."] }],
  ["fight", "⌨️", ["하나하나 반박한다", "一つ一つ反論する", "Rebut every single one"], { grade: "bad", effects: { happy: -4, health: -1 }, n: ["새벽 세 시까지 싸웠다. 아무도 설득되지 않았다.", "午前三時まで言い争った。誰も説得されなかった。", "I argued until 3 a.m. No one was convinced."] }],
  ["friends", "🫂", ["친구에게 털어놓는다", "友達に打ち明ける", "Talk to a friend about it"], { grade: "good", effects: { happy: 3, social: 2 }, n: ["친구가 '그 사람들은 너를 몰라'라고 했다. 맞는 말이었다.", "友達が「その人たちはあなたを知らない」と言った。その通りだった。", "My friend said, 'They don't know you.' True."] }],
]);
P("helping_hand_move", { age: [20, 60], emoji: "📦", scene: "street" }, ["이삿짐 부탁", "引っ越しの手伝い", "Help Me Move?"], ["친구가 이사를 도와 달라고 한다. 엘리베이터 없는 5층이다.", "友達が引っ越しを手伝ってと言う。エレベーターのない五階だ。", "A friend asks for help moving. Fifth floor, no elevator."], [
  ["help", "💪", ["간다", "行く", "Go help"], { grade: "good", effects: { social: 4, health: -1, power: 1 }, n: ["끝나고 먹은 짜장면이 세상에서 제일 맛있었다.", "終わってから食べたジャージャー麺が世界一おいしかった。", "The noodles afterward were the best food on earth."] }],
  ["pay", "💵", ["대신 이사 비용을 보탠다", "代わりに引っ越し代を出す", "Chip in for movers instead"], { effects: { social: 2, money: -50 }, n: ["친구는 고마워했지만 조금 서운해 보였다.", "友達は感謝したが、少し寂しそうだった。", "My friend was grateful but looked a little disappointed."] }],
]);
P("best_man", { age: [25, 45], emoji: "🤵", scene: "wedding" }, ["들러리 부탁", "付き添い人の依頼", "Asked to Be in the Wedding Party"], ["단짝이 결혼식 들러리(사회)를 서 달라고 한다.", "親友が結婚式の付き添い(司会)を頼んできた。", "Your best friend asks you to be in the wedding party."], [
  ["yes", "🎩", ["기꺼이 맡는다", "喜んで引き受ける", "Gladly accept"], { grade: "good", effects: { social: 5, happy: 5, money: -50 }, n: ["반지를 잃어버릴까 봐 식 내내 주머니를 만졌다.", "指輪をなくさないか、式の間ずっとポケットを触っていた。", "I patted my pocket the whole ceremony, terrified of losing the ring."] }],
  ["shy", "😰", ["부담스러워 사양한다", "負担で辞退する", "Decline — too nervous"], { effects: { social: -1 }, n: ["하객석에서 누구보다 크게 박수를 쳤다.", "客席で誰よりも大きく拍手した。", "From the seats, I clapped louder than anyone."] }],
]);
P("community_garden", { age: [25, 85], emoji: "🥕", scene: "countryside" }, ["공동 텃밭", "共同菜園", "The Community Garden"], ["구청에서 공동 텃밭 분양을 한다. 옆 칸은 모르는 사람이다.", "区役所が共同菜園を分譲している。隣の区画は知らない人だ。", "The city is renting community garden plots. A stranger has the plot next to yours."], [
  ["share", "🌱", ["씨앗을 나누며 친해진다", "種を分け合って仲良くなる", "Share seeds and make friends"], { grade: "good", effects: { social: 4, health: 2, happy: 3 }, n: ["상추가 너무 많이 열려 온 동네에 나눴다.", "レタスがたくさん採れて町中に配った。", "So much lettuce we shared it with the whole neighborhood."] }],
  ["solo", "🧑‍🌾", ["내 밭만 열심히", "自分の畑だけ頑張る", "Focus on your own plot"], { effects: { health: 2, happy: 2 }, n: ["고추가 매웠다. 뿌듯했다.", "唐辛子が辛かった。誇らしかった。", "The peppers were spicy. I was proud."] }],
]);
P("church_temple", { age: [15, 90], emoji: "⛪", scene: "ceremony" }, ["모임 공동체", "信仰の集まり", "A Faith Community"], ["친구가 다니는 종교 모임에 한번 같이 가자고 한다.", "友達が通う信仰の集まりに一度一緒に行こうと誘う。", "A friend invites you to their religious community."], [
  ["go", "🕊️", ["가 본다", "行ってみる", "Go once"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { social: 4, happy: 3 }, flag: { add: "faith_group" }, n: ["따뜻한 사람들이 많았다. 매주 나가게 됐다.", "温かい人が多かった。毎週通うようになった。", "Lots of warm people. I started going weekly."] },
    { chance: 0.5, grade: "mid", effects: { social: 1 }, n: ["나와는 맞지 않았지만 친구의 세계를 조금 알게 됐다.", "自分には合わなかったが、友達の世界を少し知った。", "Not for me, but I understood my friend a bit better."] }] }],
  ["no", "🙂", ["정중히 사양한다", "丁重に断る", "Politely decline"], { effects: { happy: 1 }, n: ["친구는 웃으며 '언제든'이라고 했다.", "友達は笑って「いつでも」と言った。", "My friend smiled: 'Anytime.'"] }],
]);
P("reunion_first_love", { age: [35, 75], emoji: "💭", scene: "cafe" }, ["첫사랑의 소식", "初恋の人の消息", "News of Your First Love"], ["동창 모임에서 첫사랑의 근황을 들었다.", "同窓会で初恋の人の近況を聞いた。", "At a reunion, you hear how your first love is doing."], [
  ["glad", "🙂", ["잘 산다니 다행이라고 생각한다", "元気でよかったと思う", "Be glad they're doing well"], { grade: "good", effects: { happy: 3 }, n: ["그 시절의 나에게 '괜찮았어'라고 말해 줬다.", "あの頃の自分に「よかったよ」と言ってあげた。", "I told my younger self, 'It was okay.'"] }],
  ["contact", "📱", ["연락처를 받아 둔다", "連絡先をもらっておく", "Get their number"], { effects: { happy: 1, social: 1 }, n: ["끝내 누르지 않았다. 그래도 저장은 해 두었다.", "結局かけなかった。それでも登録はしておいた。", "I never called. But I saved the number."] }],
]);
P("feud_neighbors", { age: [30, 85], emoji: "🌳", scene: "home" }, ["나무 한 그루 분쟁", "木一本の紛争", "The Tree Dispute"], ["옆집 나무가 우리 마당으로 넘어와 낙엽이 쌓인다.", "隣の木がうちの庭に伸びて落ち葉がたまる。", "The neighbor's tree hangs over your yard, dropping leaves everywhere."], [
  ["talk", "🍂", ["함께 가지치기하자고 한다", "一緒に剪定しようと言う", "Suggest pruning it together"], { grade: "good", effects: { social: 4, happy: 2 }, n: ["가지를 치다 친해졌다. 가을엔 그 나무 감을 나눠 먹었다.", "剪定するうちに仲良くなった。秋にはその木の柿を分け合った。", "We became friends pruning. In autumn we shared persimmons from that tree."] }],
  ["complain", "📝", ["관리실에 민원을 넣는다", "管理事務所に苦情を出す", "File a complaint"], { effects: { social: -3, happy: -1 }, n: ["나무는 잘렸고, 인사도 끊겼다.", "木は切られ、挨拶もなくなった。", "The tree was cut — and so were the greetings."] }],
]);
P("mentor_kid", { age: [25, 70], emoji: "🧭", scene: "classroom" }, ["멘토링 봉사", "メンタリングボランティア", "Mentoring a Kid"], ["보호 시설 아이와 한 달에 두 번 만나는 멘토 봉사가 있다.", "児童施設の子と月二回会うメンターボランティアがある。", "There's a program to mentor a kid from a care home twice a month."], [
  ["join", "🤝", ["시작한다", "始める", "Sign up"], { grade: "crit", effects: { social: 5, happy: 5 }, flag: { add: "mentor" }, n: ["처음엔 말이 없던 아이가 1년 뒤 꿈을 이야기했다.", "最初は無口だった子が一年後に夢を語った。", "The kid barely spoke at first. A year later, they told me their dream."] }],
  ["donate", "💝", ["시간이 없어 후원만 한다", "時間がないので寄付だけ", "Donate instead — no time"], { effects: { money: -30, happy: 2 }, n: ["아이들이 그린 감사 카드가 왔다.", "子どもたちが描いた感謝のカードが届いた。", "A thank-you card drawn by the kids arrived."] }],
]);
P("coworker_grief", { age: [25, 65], emoji: "🖤", scene: "office" }, ["동료의 상", "同僚の不幸", "A Coworker's Loss"], ["옆자리 동료가 부모님을 잃었다고 한다.", "隣の席の同僚が親を亡くしたという。", "The coworker next to you has lost a parent."], [
  ["visit", "🕯️", ["조문을 간다", "弔問に行く", "Pay your respects in person"], { grade: "good", effects: { social: 4 }, n: ["동료는 나중에 '그날 와 줘서 버텼다'고 했다.", "同僚は後に「あの日来てくれたから耐えられた」と言った。", "Later they said, 'You coming that day got me through.'"] }],
  ["cover", "📂", ["그 사람 업무를 대신 맡는다", "その人の仕事を代わりに引き受ける", "Cover their workload"], { grade: "good", effects: { social: 3, health: -1 }, n: ["돌아온 날 책상 위에 일이 정리돼 있는 걸 보고 울었다.", "戻った日、机の上の仕事が片付いているのを見て泣いた。", "When they returned and saw their desk sorted, they cried."] }],
]);
P("new_boss_young", { age: [40, 62], emoji: "👶", scene: "office", cond: (p) => !!p.job }, ["어린 상사", "年下の上司", "A Younger Boss"], ["열다섯 살 어린 상사가 새로 왔다.", "十五歳年下の上司が新しく来た。", "Your new boss is fifteen years younger than you."], [
  ["support", "🤝", ["경험으로 돕는다", "経験で支える", "Support them with your experience"], { grade: "good", effects: { social: 4, happy: 2 }, n: ["상사가 회의에서 내 이름을 자주 불렀다. 좋은 팀이 됐다.", "上司が会議で私の名前をよく呼んだ。いいチームになった。", "They often called on me in meetings. We became a great team."] }],
  ["resist", "😤", ["속으로 무시한다", "内心見下す", "Quietly resent them"], { grade: "bad", effects: { happy: -3, social: -2 }, n: ["점점 회의에 내 자리가 없어졌다.", "だんだん会議に自分の席がなくなった。", "Slowly, my seat in meetings disappeared."] }],
]);
P("stranger_train", { age: [16, 90], emoji: "🚆", scene: "subway" }, ["기차 옆자리", "列車の隣の席", "The Seat Next to You on a Train"], ["긴 기차 여행, 옆자리 사람이 말을 건다.", "長い列車の旅、隣の人が話しかけてくる。", "On a long train ride, the person beside you starts chatting."], [
  ["talk", "💬", ["이야기를 나눈다", "話をする", "Chat with them"], { grade: "good", effects: { social: 3, happy: 4, intel: 1 }, n: ["세 시간 동안 서로의 인생을 들었다. 내릴 때 이름도 모르는 채 손을 흔들었다.", "三時間、互いの人生を聞いた。降りる時、名前も知らないまま手を振った。", "Three hours of life stories. We waved goodbye without ever learning each other's names."] }],
  ["earphones", "🎧", ["이어폰을 낀다", "イヤホンをつける", "Put in earphones"], { effects: { happy: 1 }, n: ["창밖 풍경을 보며 음악을 들었다.", "窓の外を見ながら音楽を聞いた。", "I watched the scenery and listened to music."] }],
]);
P("lost_wallet", { age: [12, 85], emoji: "👛", scene: "street" }, ["주운 지갑", "拾った財布", "A Found Wallet"], ["길에서 두툼한 지갑을 주웠다. 신분증이 들어 있다.", "道で分厚い財布を拾った。身分証が入っている。", "You find a thick wallet on the street. There's an ID inside."], [
  ["return", "📮", ["주인에게 돌려준다", "持ち主に返す", "Return it to the owner"], { grade: "good", effects: { social: 3, happy: 4 }, flag: { add: "honest" }, n: ["주인이 사례금을 내밀었다. 사양하자 그는 대신 밥을 샀다.", "持ち主がお礼を差し出した。断ると代わりにご飯をおごってくれた。", "The owner offered a reward. When I refused, they bought me a meal instead."] }],
  ["police", "👮", ["경찰서에 맡긴다", "交番に届ける", "Hand it to the police"], { grade: "good", effects: { social: 1, happy: 2 }, n: ["며칠 뒤 감사 문자가 왔다.", "数日後、お礼のメッセージが届いた。", "A thank-you text came a few days later."] }],
]);
P("teacher_crush_advice", { age: [30, 70], emoji: "💌", scene: "cafe" }, ["친구의 연애 상담", "友の恋愛相談", "A Friend's Love Advice"], ["친구가 새벽에 전화해 연애 고민을 털어놓는다.", "友が夜明けに電話してきて恋の悩みを打ち明ける。", "A friend calls at dawn with romance troubles."], [
  ["listen", "📞", ["끝까지 들어 준다", "最後まで聞く", "Listen till the end"], { grade: "good", effects: { social: 4, health: -1 }, n: ["해가 뜰 무렵 친구가 '고마워, 이제 잘게'라고 했다.", "日が昇る頃、友は「ありがとう、もう寝る」と言った。", "As the sun came up, they said, 'Thanks. I can sleep now.'"] }],
  ["direct", "🗡️", ["냉정하게 조언한다", "冷静に助言する", "Give blunt advice"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 2, intel: 1 }, n: ["친구가 내 말대로 했다. 잘 풀렸다.", "友は私の言う通りにした。うまくいった。", "They took my advice. It worked out."] },
    { chance: 0.4, grade: "mid", effects: { social: -2 }, n: ["친구가 서운해하며 전화를 끊었다.", "友は傷ついて電話を切った。", "They hung up, hurt."] }] }],
]);
P("anniversary_friend", { age: [30, 90], emoji: "🎂", scene: "restaurant" }, ["우정 20주년", "友情20周年", "Twenty Years of Friendship"], ["친구가 '우리 만난 지 20년'이라며 저녁을 사겠다고 한다.", "友が「出会って二十年」と夕食をおごると言う。", "A friend says, 'It's been twenty years since we met,' and offers to buy dinner."], [
  ["go", "🍽️", ["간다", "行く", "Go"], { grade: "good", effects: { social: 5, happy: 5 }, n: ["둘 다 그날 무슨 옷을 입었는지까지 기억했다.", "二人ともあの日何を着ていたかまで覚えていた。", "We both remembered what we wore that first day."] }],
  ["gift", "🎁", ["나도 선물을 준비한다", "自分もプレゼントを用意する", "Bring a gift too"], { grade: "good", effects: { social: 5, happy: 4, money: -30 }, n: ["같은 선물을 사 왔다. 둘 다 배를 잡고 웃었다.", "同じプレゼントを買ってきていた。二人とも腹を抱えて笑った。", "We'd bought each other the same gift. We doubled over laughing."] }],
]);
P("ex_colleague_job", { age: [30, 60], emoji: "📞", scene: "office" }, ["옛 동료의 스카우트", "元同僚のスカウト", "An Ex-Coworker Recruits You"], ["예전 회사 동료가 자기 회사로 오라고 연락했다.", "前の会社の同僚が自分の会社に来ないかと連絡してきた。", "A former coworker asks you to join their company."], [
  ["move", "🚀", ["옮긴다", "移る", "Make the move"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { money: 500, happy: 3, social: 2 }, life: { raise: 1.15 }, n: ["아는 얼굴이 있어 적응이 빨랐다.", "知った顔がいて馴染むのが早かった。", "A familiar face made settling in easy."] },
    { chance: 0.4, grade: "mid", effects: { happy: -2 }, n: ["친구일 땐 좋았는데 같이 일하니 달랐다.", "友達の時はよかったが、一緒に働くと違った。", "Great as friends, different as coworkers."] }] }],
  ["stay", "🏢", ["지금 회사에 남는다", "今の会社に残る", "Stay where you are"], { effects: { happy: 1, social: 1 }, n: ["옛 동료는 '언제든 연락해'라고 했다.", "元同僚は「いつでも連絡して」と言った。", "They said, 'Call me anytime.'"] }],
]);
P("game_guild", { age: [14, 50], emoji: "⚔️", scene: "pcbang", fromYear: 2000 }, ["게임 길드", "ゲームギルド", "The Game Guild"], ["게임 길드장이 바빠져서 나에게 길드를 맡아 달라고 한다.", "ギルドマスターが忙しくなり、私にギルドを任せたいと言う。", "Your guild leader is too busy and asks you to take over."], [
  ["lead", "👑", ["맡는다", "引き受ける", "Take it on"], { grade: "good", effects: { social: 4, internet: 3, happy: 3 }, n: ["새벽 레이드 공지에 서른 명이 '참석'을 눌렀다.", "夜明けのレイド告知に三十人が「参加」を押した。", "Thirty people hit 'attending' on my dawn raid announcement."] }],
  ["no", "🙅", ["부담스럽다", "負担だ", "Too much responsibility"], { effects: { happy: 1 }, n: ["길드는 다른 사람이 맡았고 나는 편하게 놀았다.", "ギルドは他の人が引き継ぎ、私は気楽に遊んだ。", "Someone else took over, and I just played for fun."] }],
]);
P("foreign_neighbor", { age: [15, 85], emoji: "🌐", scene: "street" }, ["외국에서 온 이웃", "外国から来た隣人", "A Neighbor from Abroad"], ["다른 나라에서 온 가족이 옆집으로 이사 왔다. 말이 잘 안 통한다.", "外国から来た家族が隣に越してきた。言葉があまり通じない。", "A family from another country moves in next door. Communication is tricky."], [
  ["welcome", "🍰", ["음식을 들고 환영 인사를 간다", "料理を持って挨拶に行く", "Welcome them with food"], { grade: "good", effects: { social: 5, happy: 4, intel: 1 }, n: ["손짓 발짓으로 이야기했다. 다음 날 그 나라 음식이 돌아왔다.", "身振り手振りで話した。翌日、その国の料理が届いた。", "We talked with gestures. The next day, a dish from their country arrived."] }],
  ["nod", "🙂", ["인사만 한다", "挨拶だけする", "Just nod hello"], { effects: { social: 1 }, n: ["그 집 아이가 우리말로 '안녕하세요'를 배웠다.", "その家の子がこちらの言葉で挨拶を覚えた。", "Their kid learned to say hello in our language."] }],
]);
P("support_group", { age: [25, 85], emoji: "🫂", scene: "seniorCenter" }, ["같은 아픔을 가진 사람들", "同じ痛みを持つ人たち", "People Who've Been Through It Too"], ["힘든 일을 겪은 사람들의 모임이 있다는 걸 알았다.", "つらい経験をした人たちの集まりがあると知った。", "You learn there's a support group for people who've been through what you have."], [
  ["go", "🚪", ["용기 내서 가 본다", "勇気を出して行ってみる", "Work up the courage to go"], { grade: "good", effects: { happy: 5, social: 4, health: 1 }, n: ["누군가 내 이야기를 '나도 그랬어'라고 받아 주었다.", "誰かが私の話を「私もそうだった」と受け止めてくれた。", "Someone answered my story with, 'Me too.'"] }],
  ["read", "📖", ["후기만 읽어 본다", "体験談だけ読む", "Just read people's stories online"], { effects: { happy: 2 }, n: ["혼자가 아니라는 걸 알게 됐다.", "一人じゃないと分かった。", "I learned I wasn't alone."] }],
]);
P("hometown_shop_owner", { age: [20, 90], emoji: "🏪", scene: "convStore" }, ["단골 가게 사장님", "行きつけの店の店主", "The Shop Owner Who Knows You"], ["어릴 때부터 다닌 동네 가게가 문을 닫는다고 한다.", "子どもの頃から通った町の店が閉まるという。", "The neighborhood shop you've gone to since childhood is closing."], [
  ["visit", "💐", ["마지막 날 인사를 간다", "最終日に挨拶に行く", "Visit on the last day"], { grade: "good", effects: { happy: 2, social: 3 }, n: ["사장님이 '너 이만할 때부터 왔지' 하며 손으로 허리 높이를 가리켰다.", "店主が「こんなに小さい頃から来てたな」と腰の高さを手で示した。", "The owner held a hand at waist height: 'You've been coming since you were this tall.'"] }],
  ["photo", "📷", ["가게 사진을 찍어 둔다", "店の写真を撮っておく", "Take a photo of the shop"], { effects: { happy: 1 }, n: ["간판 사진이 앨범에 남았다.", "看板の写真がアルバムに残った。", "A photo of the sign stayed in my album."] }],
]);
P("introduce_friends", { age: [18, 60], emoji: "🔗", scene: "restaurant" }, ["친구끼리 소개", "友達同士の紹介", "Introducing Your Friends"], ["서로 다른 무리의 친구들을 한자리에 불러 볼까.", "別々のグループの友達を一緒に呼んでみようか。", "Should you bring friends from different circles together?"], [
  ["mix", "🎉", ["다 같이 부른다", "みんなを呼ぶ", "Invite everyone"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 5, happy: 4 }, n: ["둘이 사업 파트너가 됐다. 나를 '창업 공신'이라 불렀다.", "二人が事業パートナーになった。私を「創業の功労者」と呼んだ。", "Two of them became business partners. They called me the 'co-founder of the friendship.'"] },
    { chance: 0.4, grade: "mid", effects: { social: 1, happy: -1 }, n: ["어색한 침묵이 길었다. 그날 술값은 내가 냈다.", "気まずい沈黙が長かった。その日の飲み代は私が払った。", "Long awkward silences. I paid the tab."] }] }],
  ["separate", "🧩", ["따로따로 만난다", "別々に会う", "Keep them separate"], { effects: { social: 2 }, n: ["각자와의 시간이 편했다.", "それぞれとの時間が楽だった。", "Time with each group felt easier."] }],
]);
P("social_battery", { age: [16, 70], emoji: "🔋", scene: "home" }, ["약속이 너무 많다", "予定が多すぎる", "Too Many Plans"], ["이번 주 약속이 일곱 개다. 사람은 좋은데 지친다.", "今週の予定が七つ。人は好きだけど疲れた。", "Seven plans this week. You like people, but you're drained."], [
  ["cancel", "🛋️", ["몇 개를 정중히 미룬다", "いくつか丁寧に延期する", "Politely postpone a few"], { grade: "good", effects: { happy: 3, health: 2, social: -1 }, n: ["친구들은 이해했다. 다음 주에 더 반갑게 만났다.", "友達は理解してくれた。翌週、もっと嬉しく会えた。", "My friends understood. We were even happier to meet the next week."] }],
  ["all", "🏃", ["다 나간다", "全部出る", "Go to all of them"], { effects: { social: 4, health: -2, happy: -1 }, n: ["일요일 밤, 소파에서 일어날 수 없었다.", "日曜の夜、ソファから起き上がれなかった。", "Sunday night, I couldn't get off the couch."] }],
]);
P("estranged_parent", { age: [20, 60], emoji: "🚪", scene: "home" }, ["연락이 끊긴 부모", "疎遠な親", "An Estranged Parent"], ["오랫동안 연락하지 않은 부모님에게서 전화가 왔다.", "長く連絡していなかった親から電話が来た。", "A call comes from a parent you haven't spoken to in years."], [
  ["answer", "📞", ["받는다", "出る", "Answer"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { happy: 5, social: 3 }, n: ["둘 다 한참 말이 없었다. 그리고 '밥은 먹고 다니니?'", "二人ともしばらく黙っていた。そして「ちゃんと食べてるか?」", "Neither of us spoke for a while. Then: 'Are you eating properly?'"] },
    { chance: 0.4, grade: "mid", effects: { happy: -2 }, n: ["대화는 어색하게 끝났다. 그래도 다음 달 또 전화가 왔다.", "会話はぎこちなく終わった。それでも翌月また電話が来た。", "It ended awkwardly. But another call came the next month."] }] }],
  ["ignore", "📵", ["받지 않는다", "出ない", "Don't answer"], { effects: { happy: -3 }, n: ["음성 메시지를 몇 번이고 다시 들었다.", "留守電を何度も聞き直した。", "I replayed the voicemail again and again."] }],
]);
P("team_dinner_toast", { age: [24, 60], emoji: "🥂", scene: "restaurant", cond: (p) => !!p.job }, ["건배사", "乾杯の挨拶", "Giving the Toast"], ["팀 회식에서 갑자기 건배사를 하라고 한다.", "チームの飲み会で急に乾杯の挨拶を振られた。", "At a team dinner, you're suddenly asked to give a toast."], [
  ["funny", "🎤", ["재치 있게 한다", "気の利いた挨拶をする", "Make it witty"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 5, happy: 3 }, n: ["다들 빵 터졌다. 그 건배사가 팀 구호가 됐다.", "みんな爆笑した。その挨拶がチームの合言葉になった。", "Everyone burst out laughing. It became the team's catchphrase."] },
    { chance: 0.4, grade: "mid", effects: { social: -1 }, n: ["썰렁했다. 다들 잔만 부딪쳤다.", "すべった。みんなグラスを合わせただけだった。", "It flopped. Everyone just clinked glasses."] }] }],
  ["short", "🙂", ["'건강하게!' 한마디", "「健康に!」の一言", "Just say 'To health!'"], { effects: { social: 2 }, n: ["무난하게 넘어갔다.", "無難に終わった。", "It went fine."] }],
]);
P("viral_kindness", { age: [16, 80], emoji: "💖", scene: "street", fromYear: 2010 }, ["찍힌 선행", "撮られた善行", "Your Kindness Went Viral"], ["길에서 노인을 도운 장면을 누군가 찍어 올렸다. 화제가 됐다.", "道でお年寄りを助ける場面を誰かが撮って投稿した。話題になった。", "Someone filmed you helping an elderly person on the street. It's trending."], [
  ["humble", "🙏", ["인터뷰를 사양한다", "取材を断る", "Decline interviews"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["얼굴은 끝까지 안 알려졌다. 그게 좋았다.", "顔は最後まで知られなかった。それでよかった。", "My face never got out. I liked it that way."] }],
  ["share", "📺", ["방송에 나가 이야기한다", "番組に出て話す", "Go on a show and talk about it"], { effects: { social: 4, internet: 4, happy: 3 }, n: ["그 할머니와 함께 출연했다. 둘이 친구가 됐다.", "そのおばあさんと一緒に出演した。二人は友達になった。", "I appeared on the show with the grandmother. We became friends."] }],
]);
P("old_letters_friend", { age: [40, 95], emoji: "📬", scene: "home" }, ["친구의 옛 편지", "友の古い手紙", "Old Letters from a Friend"], ["이사하다 학창 시절 친구가 보낸 편지 뭉치를 찾았다.", "引っ越しの最中に学生時代の友からの手紙の束を見つけた。", "While moving, you find a bundle of letters from a school friend."], [
  ["call", "📞", ["그 친구를 찾아 연락한다", "その友を探して連絡する", "Track down that friend and call"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 7, social: 4 }, n: ["친구도 내 편지를 간직하고 있었다.", "友も私の手紙をとっておいてくれた。", "My friend had kept my letters too."] },
    { chance: 0.4, grade: "mid", effects: { happy: 1 }, n: ["연락이 닿지 않았다. 편지를 다시 상자에 넣었다.", "連絡はつかなかった。手紙をまた箱に戻した。", "I couldn't reach them. The letters went back in the box."] }] }],
  ["read", "📖", ["밤새 다시 읽는다", "一晩中読み返す", "Reread them all night"], { effects: { happy: 4 }, n: ["열여섯 살의 고민이 귀여웠다.", "十六歳の悩みが可愛らしかった。", "My sixteen-year-old worries were adorable."] }],
]);
P("family_friend_gather", { age: [30, 80], emoji: "🍖", scene: "park" }, ["가족끼리 친구", "家族ぐるみの付き合い", "Family Friends"], ["친구 가족과 함께 캠핑을 가자는 이야기가 나왔다.", "友達の家族と一緒にキャンプに行こうという話が出た。", "Your friend's family suggests going camping together."], [
  ["go", "⛺", ["간다", "行く", "Go"], { grade: "good", effects: { happy: 6, social: 4, money: -60 }, n: ["아이들끼리 친해지고 어른들끼리 밤새 이야기했다.", "子ども同士が仲良くなり、大人たちは夜通し話した。", "The kids bonded; the adults talked through the night."] }],
  ["dinner", "🍽️", ["저녁 한 끼로", "夕食一回で", "Just do dinner"], { effects: { happy: 3, social: 2 }, n: ["다음엔 꼭 캠핑을 가자고 했다.", "次は必ずキャンプに行こうと言った。", "We promised camping next time."] }],
]);
P("charity_run_team", { age: [18, 65], emoji: "🎽", scene: "street" }, ["자선 달리기 팀", "チャリティーランのチーム", "Charity Run Team"], ["회사(동네)에서 자선 달리기 팀을 꾸린다.", "会社(地域)でチャリティーランのチームを作る。", "Your workplace (or neighborhood) is forming a charity run team."], [
  ["join", "👟", ["팀에 들어간다", "チームに入る", "Join the team"], { grade: "good", effects: { social: 4, health: 3, happy: 3 }, n: ["같은 티셔츠를 입은 사람들과 결승선을 넘었다.", "同じTシャツの仲間とゴールした。", "I crossed the finish line with people in matching shirts."] }],
  ["sponsor", "💝", ["후원만 한다", "協賛だけする", "Sponsor instead"], { effects: { money: -20, social: 1, happy: 2 }, n: ["결승선에서 물을 나눠 줬다.", "ゴールで水を配った。", "I handed out water at the finish."] }],
]);
P("doorman_friend", { age: [25, 90], emoji: "🧑‍✈️", scene: "home" }, ["경비 아저씨", "マンションの管理人さん", "The Building Guard"], ["아파트 경비 아저씨가 늘 먼저 인사를 한다.", "マンションの管理人さんがいつも先に挨拶してくれる。", "The building guard always greets you first."], [
  ["gift", "🍊", ["명절에 작은 선물을 드린다", "祝日に小さな贈り物をする", "Bring a small holiday gift"], { grade: "good", effects: { social: 3, happy: 3 }, n: ["아저씨가 택배를 늘 따로 챙겨 주셨다.", "管理人さんがいつも荷物を別に取っておいてくれた。", "They always set my packages aside for me."] }],
  ["chat", "💬", ["오가며 이야기를 나눈다", "行き来しながら話す", "Chat whenever you pass"], { effects: { social: 2, happy: 2 }, n: ["아저씨의 손주 이야기를 다 알게 됐다.", "管理人さんの孫の話を全部知るようになった。", "I learned all about their grandkids."] }],
]);
P("unlikely_friend", { age: [20, 90], emoji: "🧓", scene: "park" }, ["세대를 넘은 친구", "世代を超えた友", "A Friend Across Generations"], ["공원 벤치에서 매일 마주치는 사람이 있다. 나이 차이가 마흔 살이다.", "公園のベンチで毎日会う人がいる。年の差は四十歳だ。", "Someone you see on the park bench every day — forty years apart in age."], [
  ["talk", "☕", ["커피를 건네며 말을 건다", "コーヒーを渡して話しかける", "Offer a coffee and say hello"], { grade: "crit", effects: { social: 5, happy: 5, intel: 1 }, flag: { add: "intergen_friend" }, n: ["매일 10분의 대화가 하루 중 가장 좋은 시간이 됐다.", "毎日十分の会話が一日で一番いい時間になった。", "Ten minutes of conversation became the best part of my day."] }],
  ["nod", "🙂", ["목례만 한다", "会釈だけする", "Just nod"], { effects: { happy: 1 }, n: ["어느 날 벤치가 비어 있었다. 이상하게 허전했다.", "ある日ベンチが空いていた。妙に寂しかった。", "One day the bench was empty. It felt strangely lonely."] }],
]);
P("rumor_victim", { age: [14, 60], emoji: "🌀", scene: "office" }, ["나에 대한 소문", "自分についての噂", "A Rumor About You"], ["나에 대한 사실이 아닌 소문이 돌고 있다.", "自分について事実でない噂が流れている。", "A false rumor about you is going around."], [
  ["face", "🗣️", ["소문의 시작을 찾아 정면으로 이야기한다", "噂の出所を探して正面から話す", "Find the source and talk to them directly"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 3, happy: 3, power: 1 }, n: ["오해였다. 상대가 사과했고 소문은 사그라들었다.", "誤解だった。相手が謝り、噂は消えた。", "A misunderstanding. They apologized, and the rumor died down."] },
    { chance: 0.4, grade: "mid", effects: { social: -1, happy: -2 }, n: ["인정하지 않았다. 그래도 아는 사람들은 알았다.", "認めなかった。それでも分かる人は分かっていた。", "They denied it. But the people who mattered knew."] }] }],
  ["wait", "⏳", ["시간이 해결하게 둔다", "時間に任せる", "Let time handle it"], { effects: { happy: -2 }, n: ["몇 달 뒤 다들 잊었다. 나만 빼고.", "数か月後、みんな忘れた。私以外は。", "Months later everyone forgot. Except me."] }],
]);
P("buddy_system", { age: [6, 12], emoji: "🤝", scene: "classroom", area: "people" }, ["짝꿍 정하기", "席替え", "Choosing Seatmates"], ["선생님이 이번 달 짝꿍을 마음대로 정하라고 한다.", "先生が今月の隣の席を自由に決めていいと言う。", "The teacher says you can pick your own seatmate this month."], [
  ["new", "🆕", ["안 친한 아이 옆에 앉는다", "あまり話さない子の隣に座る", "Sit next to someone you don't know well"], { grade: "good", effects: { social: 4, happy: 3 }, n: ["그 아이는 공룡 박사였다. 한 달 내내 공룡 이야기를 들었다.", "その子は恐竜博士だった。一か月ずっと恐竜の話を聞いた。", "They were a dinosaur expert. I heard dinosaur facts all month."] }],
  ["best", "😊", ["단짝 옆에 앉는다", "親友の隣に座る", "Sit with your best friend"], { effects: { happy: 4, intel: -1 }, n: ["수업 시간에 너무 웃어서 둘 다 혼났다.", "授業中に笑いすぎて二人とも叱られた。", "We laughed so much in class we both got scolded."] }],
]);
P("graduation_promise", { age: [17, 23], emoji: "🎓", scene: "graduation" }, ["졸업식의 약속", "卒業式の約束", "A Graduation Promise"], ["졸업식 날, 친구들과 10년 뒤 이 자리에서 다시 만나자고 약속한다.", "卒業式の日、友達と十年後にここで会おうと約束する。", "On graduation day, you and your friends promise to meet here again in ten years."], [
  ["capsule", "⏳", ["타임캡슐을 묻는다", "タイムカプセルを埋める", "Bury a time capsule"], { grade: "good", effects: { happy: 5, social: 4 }, flag: { add: "time_capsule" }, n: ["각자 10년 뒤 자신에게 쓴 편지를 넣었다.", "それぞれ十年後の自分への手紙を入れた。", "We each put in a letter to our future selves."], next: { id: "p2_capsule_open", after: 10 } }],
  ["photo", "📷", ["단체 사진만 찍는다", "集合写真だけ撮る", "Just take a group photo"], { effects: { happy: 3, social: 2 }, n: ["사진 속 우리는 다들 눈을 감고 있었다.", "写真の私たちはみんな目を閉じていた。", "In the photo, everyone had their eyes closed."] }],
]);
P("capsule_open", { followup: true, emoji: "📦", scene: "park" }, ["타임캡슐을 여는 날", "タイムカプセルを開ける日", "Opening the Time Capsule"], ["10년 전 약속한 날이다. 몇 명이나 올까.", "十年前に約束した日だ。何人来るだろう。", "It's the day you promised ten years ago. How many will show up?"], [
  ["go", "🗝️", ["간다", "行く", "Go"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 8, social: 5 }, n: ["다섯 명이 왔다. 편지 속 꿈을 읽으며 울다 웃었다.", "五人来た。手紙の夢を読んで泣き笑いした。", "Five came. We laughed and cried reading our old dreams."] },
    { chance: 0.4, grade: "mid", effects: { happy: 3, social: 2 }, n: ["둘뿐이었다. 그래서 더 오래 이야기했다.", "二人だけだった。だからこそ長く話した。", "Just two of us. So we talked even longer."] }] }],
  ["forgot", "😅", ["깜빡했다", "うっかり忘れた", "Forgot all about it"], { effects: { happy: -3 }, n: ["친구들이 내 편지를 사진으로 보내 줬다.", "友達が私の手紙を写真で送ってくれた。", "My friends sent me a photo of my letter."] }],
]);
P("hobby_club_leader", { age: [25, 75], emoji: "📣", scene: "library" }, ["독서 모임 만들기", "読書会を作る", "Starting a Book Club"], ["같은 책을 읽은 사람들과 이야기하고 싶다. 모임을 만들어 볼까.", "同じ本を読んだ人と話したい。会を作ってみようか。", "You want to talk with people who've read the same books. Start a club?"], [
  ["start", "📚", ["만든다", "作る", "Start one"], { grade: "good", effects: { social: 5, intel: 3, happy: 3 }, flag: { add: "club_founder" }, n: ["첫 모임엔 세 명, 1년 뒤엔 스무 명이 됐다.", "最初の会は三人、一年後には二十人になった。", "Three people at the first meeting; twenty a year later."] }],
  ["join", "🙋", ["있는 모임에 들어간다", "既存の会に入る", "Join an existing one"], { effects: { social: 3, intel: 2 }, n: ["매달 마지막 주 토요일이 기다려졌다.", "毎月最終土曜日が待ち遠しくなった。", "I started looking forward to the last Saturday of every month."] }],
]);
P("thank_teacher_old", { age: [40, 90], emoji: "✉️", scene: "home" }, ["은사님의 부고", "恩師の訃報", "Your Old Teacher Has Passed"], ["어릴 적 나를 믿어 준 선생님이 돌아가셨다는 소식을 들었다.", "幼い頃信じてくれた先生が亡くなったと聞いた。", "You hear that the teacher who believed in you as a child has died."], [
  ["go", "🕯️", ["장례식에 간다", "葬儀に行く", "Attend the funeral"], { grade: "good", effects: { happy: -2, social: 3 }, n: ["같은 반 친구들이 많이 와 있었다. 다들 선생님 이야기를 하나씩 했다.", "同じクラスの友がたくさん来ていた。みんな先生の思い出を一つずつ話した。", "Many classmates came. Each of us shared a story about our teacher."] }],
  ["write", "📝", ["가족에게 편지를 보낸다", "遺族に手紙を送る", "Write to their family"], { effects: { happy: -1, social: 2 }, n: ["선생님이 내 이야기를 자주 하셨다는 답장이 왔다.", "先生がよく私の話をしていたという返事が来た。", "The reply said my teacher used to talk about me often."] }],
]);
P("matchmaking_neighbor", { age: [25, 45], emoji: "👵", scene: "market", cond: (p) => !p.spouse }, ["중매 서는 이웃", "お節介な隣人", "The Matchmaking Neighbor"], ["시장 아주머니가 '좋은 사람 있다'며 사진을 보여 준다.", "市場のおばさんが「いい人がいる」と写真を見せる。", "The lady at the market shows you a photo: 'I know someone perfect for you.'"], [
  ["meet", "☕", ["한번 만나 본다", "一度会ってみる", "Agree to meet once"], { outcomes: [
    { chance: 0.4, grade: "good", effects: { happy: 6, social: 2 }, relation: { romance: true }, n: ["아주머니 말이 맞았다. 결혼식에 맨 앞자리를 드렸다.", "おばさんの言う通りだった。結婚式で最前列に座ってもらった。", "She was right. She got a front-row seat at our wedding."] },
    { chance: 0.6, grade: "mid", effects: { happy: -1, social: 1 }, n: ["좋은 사람이었지만 인연은 아니었다. 아주머니는 다음 사진을 꺼냈다.", "いい人だったが縁はなかった。おばさんは次の写真を出した。", "Nice person, not the one. She pulled out the next photo."] }] }],
  ["no", "🙅", ["웃으며 사양한다", "笑って断る", "Smile and decline"], { effects: { happy: 1 }, n: ["그날 덤으로 사과를 하나 더 받았다.", "その日はおまけにりんごを一つもらった。", "I got an extra apple that day anyway."] }],
]);
P("chat_group_old", { age: [55, 95], emoji: "📱", scene: "home", fromYear: 2010 }, ["동창 단톡방", "同窓会のグループ", "The Alumni Group Chat"], ["동창 단톡방에 매일 아침 꽃 사진과 좋은 글이 올라온다.", "同窓会のグループに毎朝花の写真といい言葉が投稿される。", "Every morning, the alumni group chat fills with flower photos and inspirational quotes."], [
  ["reply", "🌺", ["나도 꽃 사진으로 답한다", "自分も花の写真で返す", "Reply with a flower photo of your own"], { grade: "good", effects: { social: 3, happy: 3, internet: 1 }, n: ["아침 인사가 생존 확인이 됐다. 하루라도 안 올라오면 다들 전화했다.", "朝の挨拶が安否確認になった。一日でも投稿がないとみんな電話した。", "Morning greetings became a check-in. Miss one day, and everyone called."] }],
  ["mute", "🔕", ["알림을 끈다", "通知を切る", "Mute the chat"], { effects: { happy: 1 }, n: ["가끔 몰아서 읽었다. 다들 잘 지냈다.", "時々まとめて読んだ。みんな元気だった。", "I'd catch up now and then. Everyone was doing fine."] }],
]);

export const PEOPLE_EVENTS2 = EV;
