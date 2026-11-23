// =========================
// 플듀 인생게임 REBORN — 사건 3차: 친구·인간관계 (2026-11-23)
// 형식: life-ev-kit.js 의 ev() — 한국어 원문 + 일본어·영어. area·scene 은 지시서 분류·장면 정보.
// 후속 사건(next)은 followup:true 로 앞 사건이 불러야만 나온다.
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const P = (id, meta, title, desc, choices) => EV.push(ev("pp_" + id, { area: "people", ...meta }, title, desc, choices));

// ---------- 어린 시절 친구 ----------
P("new_kid", { age: [6, 11], emoji: "🧒", scene: "classroom" }, ["전학 온 아이", "転校生", "The New Kid"], ["반에 전학생이 왔다. 쉬는 시간에 혼자 창밖만 본다.", "クラスに転校生が来た。休み時間、一人で窓の外ばかり見ている。", "A new kid joins the class. At recess, they just stare out the window alone."], [
  ["talk", "👋", ["먼저 말을 건다", "先に話しかける", "Say hi first"], { grade: "good", effects: { social: 5, happy: 3 }, flag: { add: "helped_new_kid" }, n: ["'너 어디서 왔어?' 그 한마디로 단짝이 생겼다.", "「どこから来たの?」その一言で親友ができた。", "'Where'd you move from?' That one line made a best friend."], next: { id: "pp_new_kid_later", after: 12 } }],
  ["watch", "👀", ["지켜만 본다", "見ているだけ", "Just watch"], { effects: { happy: -1 }, n: ["며칠 뒤 그 아이는 다른 무리와 어울렸다.", "数日後、その子は別のグループと仲良くなった。", "A few days later, they found another group."] }],
]);
P("new_kid_later", { followup: true, emoji: "📞", scene: "cafe" }, ["그때 그 전학생", "あの時の転校生", "That New Kid, Years Later"], ["모르는 번호로 연락이 왔다. '나 기억해? 네가 처음 말 걸어 준 애.'", "知らない番号から連絡が来た。「覚えてる?最初に話しかけてくれたのが君だった」", "A message from an unknown number: 'Remember me? You were the first to talk to me.'"], [
  ["meet", "☕", ["만나서 옛날 얘기를 한다", "会って昔話をする", "Meet and reminisce"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["그 애는 그날 덕분에 학교를 버텼다고 했다. 별것 아닌 말이 누군가에겐 컸다.", "あの日のおかげで学校を乗り切れたと言われた。何気ない一言が誰かには大きかった。", "They said that day got them through school. A small word had been big to someone."] }],
  ["busy", "📵", ["바빠서 나중에 보자고 한다", "忙しいので後でと言う", "Say you're busy"], { effects: { happy: -1 }, n: ["'나중에'는 오지 않았다.", "「後で」は来なかった。", "'Later' never came."] }],
]);
P("secret_base", { age: [7, 12], emoji: "🏚️", scene: "park" }, ["비밀 기지", "秘密基地", "The Secret Base"], ["친구들이 공터에 박스로 비밀 기지를 짓자고 한다.", "友達が空き地に段ボールで秘密基地を作ろうと言う。", "Friends want to build a cardboard secret base in the empty lot."], [
  ["build", "📦", ["대장 노릇을 한다", "隊長になる", "Be the leader"], { grade: "good", effects: { social: 4, happy: 5, power: 1 }, n: ["비가 오면 무너졌지만 다음 날 또 지었다.", "雨が降ると崩れたが、次の日また作った。", "It collapsed in the rain, and we rebuilt it the next day."] }],
  ["guard", "🔦", ["보초를 선다", "見張りをする", "Stand guard"], { effects: { social: 2, happy: 3 }, n: ["암호는 '바나나'였다. 아무도 쳐들어오지 않았다.", "合言葉は「バナナ」だった。誰も攻めてこなかった。", "The password was 'banana.' No one ever attacked."] }],
  ["home", "🏠", ["집에서 숙제한다", "家で宿題をする", "Do homework at home"], { effects: { intel: 2, social: -2 }, n: ["창밖으로 친구들 웃음소리가 들렸다.", "窓の外から友達の笑い声が聞こえた。", "I could hear my friends laughing outside."] }],
]);
P("borrowed_toy", { age: [5, 10], emoji: "🧸", scene: "kidroom" }, ["망가진 장난감", "壊れたおもちゃ", "The Broken Toy"], ["친구에게 빌린 장난감을 실수로 망가뜨렸다.", "友達に借りたおもちゃをうっかり壊してしまった。", "You accidentally broke a toy you borrowed from a friend."], [
  ["truth", "🙇", ["솔직하게 말한다", "正直に言う", "Tell the truth"], { grade: "good", effects: { social: 3, happy: -1 }, n: ["친구는 울었지만 다음 날 다시 같이 놀았다.", "友達は泣いたが、次の日また一緒に遊んだ。", "My friend cried, but we played together again the next day."] }],
  ["hide", "🙈", ["모른 척 돌려준다", "知らないふりで返す", "Return it and say nothing"], { grade: "bad", effects: { social: -3, happy: -2 }, flag: { add: "small_lie" }, n: ["친구는 끝까지 이유를 몰랐다. 나는 그게 오래 마음에 걸렸다.", "友達は最後まで理由を知らなかった。私はそれがずっと気になった。", "My friend never knew why. It bothered me for a long time."] }],
]);
P("best_friend_move", { age: [9, 15], emoji: "🚚", scene: "street" }, ["단짝의 이사", "親友の引っ越し", "Your Best Friend Moves Away"], ["단짝이 먼 도시로 이사를 간다고 한다.", "親友が遠い街へ引っ越すという。", "Your best friend is moving to a faraway city."], [
  ["letter", "✉️", ["편지를 주고받기로 약속한다", "手紙を書くと約束する", "Promise to write letters"], { grade: "good", effects: { happy: -2, social: 2 }, flag: { add: "penpal" }, n: ["처음엔 일주일에 한 통, 나중엔 일 년에 한 통. 그래도 끊기지 않았다.", "最初は週に一通、後には年に一通。それでも途切れなかった。", "First one a week, later one a year. But it never stopped."] }],
  ["gift", "🎁", ["아끼던 물건을 선물한다", "大切な物を贈る", "Give away something precious"], { effects: { happy: -1, social: 3 }, n: ["친구는 그 물건을 어른이 돼서도 가지고 있었다.", "友達は大人になってもそれを持っていた。", "My friend kept it even as an adult."] }],
  ["sulk", "😤", ["말도 안 하고 삐친다", "口もきかずにすねる", "Sulk and refuse to talk"], { grade: "bad", effects: { happy: -5 }, n: ["트럭이 떠난 뒤에야 손을 흔들지 못한 게 후회됐다.", "トラックが去ってから、手を振れなかったことを後悔した。", "Only after the truck left did I regret not waving."] }],
]);
P("bully_witness", { age: [9, 16], emoji: "😟", scene: "classroom" }, ["괴롭힘을 본 날", "いじめを見た日", "The Day You Saw Bullying"], ["몇몇 아이들이 한 친구를 둘러싸고 놀리고 있다.", "何人かの子が一人の子を囲んでからかっている。", "A few kids have surrounded a classmate and are mocking them."], [
  ["stop", "✋", ["그만하라고 말한다", "やめろと言う", "Tell them to stop"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { social: 4, happy: 3, power: 2 }, flag: { add: "stood_up" }, n: ["아이들이 흩어졌다. 그 친구가 조용히 '고마워'라고 했다.", "子どもたちは散った。その子が小さく「ありがとう」と言った。", "They scattered. The kid quietly said, 'Thanks.'"] },
    { chance: 0.4, grade: "mid", effects: { happy: -3, social: 2, health: -1 }, flag: { add: "stood_up" }, n: ["나까지 표적이 됐다. 그래도 그 친구와는 진짜 친구가 됐다.", "自分まで標的になった。それでもその子とは本当の友達になった。", "I became a target too. But that kid became a real friend."] }] }],
  ["teacher", "🧑‍🏫", ["선생님께 알린다", "先生に伝える", "Tell a teacher"], { grade: "good", effects: { social: 1, intel: 1 }, n: ["다음 날 반 전체가 남아서 이야기를 들었다.", "次の日、クラス全員が残って話を聞いた。", "The next day, the whole class stayed after to talk."] }],
  ["away", "🚶", ["못 본 척 지나간다", "見なかったふりをする", "Walk past"], { grade: "bad", effects: { happy: -4 }, n: ["그 장면이 이상하게 오래 떠올랐다.", "その場面が不思議と長く思い出された。", "That scene kept coming back for years."] }],
]);
P("club_choice", { age: [12, 17], emoji: "🏸", scene: "field" }, ["동아리 고르기", "部活選び", "Choosing a Club"], ["동아리를 정해야 한다. 친한 애들은 축구부, 마음은 연극부.", "部活を決めなければ。仲のいい子はサッカー部、心は演劇部。", "Time to pick a club. Your friends are in soccer; your heart says drama."], [
  ["friends", "⚽", ["친구들 따라 축구부", "友達とサッカー部", "Follow friends to soccer"], { effects: { social: 4, power: 3 }, n: ["벤치에 오래 앉아 있었지만 친구들과의 시간은 좋았다.", "ベンチが長かったが、友達との時間はよかった。", "Lots of bench time, but the time with friends was good."] }],
  ["heart", "🎭", ["혼자 연극부", "一人で演劇部", "Join drama alone"], { grade: "good", effects: { social: 3, happy: 4, internet: 1 }, flag: { add: "drama_club" }, n: ["처음엔 어색했지만, 무대 위에서 새로운 친구들을 만났다.", "最初はぎこちなかったが、舞台で新しい友達に出会った。", "Awkward at first, but I met new friends on stage."] }],
]);
P("group_chat", { age: [13, 19], emoji: "💬", scene: "kidroom", fromYear: 2010 }, ["단체방의 뒷말", "グループチャットの陰口", "Gossip in the Group Chat"], ["단체방에서 한 친구 험담이 오가고 있다. 나도 한마디 하라는 분위기다.", "グループチャットで一人の悪口が飛び交っている。自分も何か言えという空気だ。", "The group chat is trashing one friend. Everyone's waiting for you to chime in."], [
  ["no", "🛑", ["'그만하자'라고 쓴다", "「やめよう」と書く", "Type 'let's stop'"], { grade: "good", effects: { social: 2, happy: 2 }, n: ["몇 명이 방을 나갔다. 남은 친구들이 진짜였다.", "何人か抜けた。残った友達が本物だった。", "A few people left the chat. The ones who stayed were real."] }],
  ["join", "😈", ["같이 웃어 넘긴다", "一緒に笑う", "Laugh along"], { grade: "bad", effects: { social: -2, happy: -2 }, n: ["캡처가 돌았다. 그 친구 얼굴을 볼 수가 없었다.", "スクショが回った。その子の顔を見られなかった。", "Screenshots spread. I couldn't look that friend in the eye."] }],
  ["leave", "🚪", ["조용히 나간다", "静かに退出する", "Quietly leave"], { effects: { social: -1 }, n: ["알림이 끊기니 마음이 편했다.", "通知が止まって気が楽になった。", "With the notifications gone, I felt lighter."] }],
]);
P("first_betrayal", { age: [14, 22], emoji: "🗡️", scene: "street" }, ["비밀이 새어 나갔다", "秘密が漏れた", "Your Secret Got Out"], ["가장 친한 친구에게만 말한 비밀을 반 애들이 다 알고 있다.", "一番の親友にだけ話した秘密を、クラス中が知っている。", "The secret you told only your best friend — the whole class knows."], [
  ["confront", "😠", ["정면으로 따진다", "正面から問い詰める", "Confront them"], { outcomes: [
    { chance: 0.5, grade: "mid", effects: { social: 1, happy: -2 }, n: ["친구는 실수였다며 울었다. 우리는 천천히 다시 가까워졌다.", "友達はミスだったと泣いた。私たちはゆっくりまた近づいた。", "They cried and said it was a mistake. Slowly, we grew close again."] },
    { chance: 0.5, grade: "bad", effects: { social: -3, happy: -5 }, n: ["변명만 늘어놓았다. 그날로 끝이었다.", "言い訳ばかりだった。その日で終わった。", "Only excuses. That was the end of it."] }] }],
  ["cold", "🧊", ["말없이 멀어진다", "黙って距離を置く", "Drift away silently"], { effects: { happy: -4, social: -2 }, flag: { add: "trust_issue" }, n: ["그 뒤로 비밀은 일기장에만 적었다.", "それ以来、秘密は日記にだけ書いた。", "After that, I kept secrets only in my diary."] }],
]);
// ---------- 청년 ----------
P("roommate", { age: [18, 26], emoji: "🛏️", scene: "dorm" }, ["룸메이트", "ルームメイト", "The Roommate"], ["새 룸메이트는 새벽 세 시에 라면을 끓이고 기타를 친다.", "新しいルームメイトは午前三時にラーメンを作り、ギターを弾く。", "Your new roommate cooks ramen and plays guitar at 3 a.m."], [
  ["rules", "📝", ["규칙을 정하자고 한다", "ルールを決めようと言う", "Propose house rules"], { grade: "good", effects: { social: 3, happy: 2 }, n: ["냉장고에 규칙표가 붙었다. 이상하게 그때부터 친해졌다.", "冷蔵庫にルール表が貼られた。不思議とそこから仲良くなった。", "A rule sheet went up on the fridge. Oddly, that's when we became friends."] }],
  ["join", "🎸", ["같이 라면을 먹는다", "一緒にラーメンを食べる", "Join the ramen session"], { effects: { happy: 4, health: -2, social: 3 }, n: ["밤새 노래를 불렀다. 다음 날 수업은 망했다.", "一晩中歌った。翌日の授業は散々だった。", "We sang all night. The next day's class was a disaster."] }],
  ["move", "📦", ["방을 옮긴다", "部屋を替える", "Change rooms"], { effects: { money: -60, happy: 1 }, n: ["조용한 방이 생겼지만 조금 심심했다.", "静かな部屋になったが、少し寂しかった。", "Quiet room, but a little lonely."] }],
]);
P("friend_debt", { age: [20, 50], emoji: "💸", scene: "cafe" }, ["친구가 돈을 빌려 달라고 한다", "友達がお金を貸してと言う", "A Friend Asks for a Loan"], ["오랜 친구가 급하다며 큰돈을 빌려 달라고 한다.", "古い友達が急ぎだと言って大金を貸してほしいと言う。", "An old friend urgently asks to borrow a large sum."], [
  ["lend", "🤝", ["빌려준다", "貸す", "Lend it"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { social: 4, happy: 2 }, n: ["1년 뒤 친구는 이자까지 얹어 갚았다. 우정은 더 단단해졌다.", "一年後、友達は利子をつけて返した。友情はさらに固くなった。", "A year later they paid it back with interest. The friendship grew stronger."] },
    { chance: 0.45, grade: "bad", effects: { money: -800, happy: -6, social: -3 }, flag: { add: "lost_friend_money" }, n: ["돈도, 친구도 잃었다. 연락처를 지우는 데 오래 걸렸다.", "お金も友達も失った。連絡先を消すのに時間がかかった。", "I lost the money and the friend. Deleting their number took a long time."] }] }],
  ["part", "🪙", ["줄 수 있는 만큼만 준다 (안 받기로)", "返さなくていい額だけ渡す", "Give what you can, as a gift"], { grade: "good", effects: { money: -200, social: 3, happy: 1 }, n: ["'갚지 마'라고 했다. 마음은 오히려 편했다.", "「返さなくていい」と言った。むしろ気が楽だった。", "I said, 'Don't pay me back.' It felt better that way."] }],
  ["no", "🙅", ["거절한다", "断る", "Refuse"], { effects: { social: -2, happy: -1 }, n: ["친구는 알겠다고 했지만, 한동안 연락이 뜸했다.", "友達は分かったと言ったが、しばらく連絡が途絶えた。", "They said they understood, but went quiet for a while."] }],
]);
P("wedding_speech", { age: [25, 45], emoji: "🎤", scene: "wedding" }, ["친구 결혼식 축사", "友人の結婚式のスピーチ", "Best Friend's Wedding Speech"], ["친구가 결혼식 축사를 부탁했다. 하객은 삼백 명.", "友達に結婚式のスピーチを頼まれた。招待客は三百人。", "Your friend asked you to give the wedding speech. Three hundred guests."], [
  ["funny", "😂", ["웃긴 일화로 간다", "笑えるエピソードでいく", "Go with funny stories"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { social: 6, happy: 5 }, n: ["식장이 웃음바다가 됐다. 신랑 어머니까지 웃었다.", "会場が笑いの渦に。新郎の母まで笑った。", "The hall roared. Even the groom's mother laughed."] },
    { chance: 0.4, grade: "bad", effects: { social: -2, happy: -3 }, n: ["한 일화가 선을 넘었다. 정적이 길었다.", "一つの話が一線を越えた。長い沈黙が流れた。", "One story crossed the line. The silence was long."] }] }],
  ["warm", "🥹", ["진심을 담은 편지를 읽는다", "心を込めた手紙を読む", "Read a heartfelt letter"], { grade: "good", effects: { social: 4, happy: 4 }, n: ["친구가 단상 앞에서 울었다. 나도 울었다.", "友達が壇上で泣いた。私も泣いた。", "My friend cried at the front. So did I."] }],
]);
P("neighbor_noise", { age: [22, 80], emoji: "🔊", scene: "home" }, ["층간 소음", "上の階の騒音", "Noise from Upstairs"], ["위층에서 매일 밤 쿵쿵 소리가 난다.", "上の階から毎晩ドンドンと音がする。", "Every night, thumping from the apartment above."], [
  ["visit", "🍊", ["귤 한 봉지 들고 올라간다", "みかんを持って上がる", "Go up with a bag of tangerines"], { grade: "good", effects: { social: 4, happy: 2, money: -10 }, n: ["아이가 셋이었다. 매트를 깔겠다고 했고, 다음 명절엔 떡이 내려왔다.", "子どもが三人いた。マットを敷くと言い、次の祝日には餅が届いた。", "Three kids lived there. They promised mats, and at the next holiday, rice cakes came down."] }],
  ["note", "📄", ["쪽지를 붙인다", "張り紙をする", "Leave a note"], { effects: { happy: -1 }, n: ["답장 쪽지가 붙었다. 쪽지 전쟁이 시작됐다.", "返事の張り紙が貼られた。張り紙戦争が始まった。", "A reply note appeared. The note war began."] }],
  ["endure", "🎧", ["귀마개를 산다", "耳栓を買う", "Buy earplugs"], { effects: { happy: -2, health: -1 }, n: ["잠은 잤지만 늘 조금 피곤했다.", "眠れはしたが、いつも少し疲れていた。", "I slept, but always a little tired."] }],
]);
P("online_friend", { age: [14, 45], emoji: "🎮", scene: "pcbang", fromYear: 1998 }, ["게임 속 친구", "ゲームの中の友達", "A Friend from the Game"], ["몇 년째 같이 게임하는 친구가 오프라인에서 만나자고 한다.", "何年も一緒にゲームしている友達が、オフで会おうと言う。", "Someone you've gamed with for years wants to meet in person."], [
  ["meet", "🤝", ["만나 본다 (사람 많은 곳에서)", "会ってみる(人の多い所で)", "Meet up (somewhere public)"], { grade: "good", effects: { social: 5, happy: 5 }, n: ["목소리랑 똑같은 사람이 손을 흔들었다. 처음 만났는데 오래 안 사이 같았다.", "声そのままの人が手を振った。初対面なのに昔からの知り合いみたいだった。", "Someone who looked exactly like their voice waved. First meeting, but it felt like old friends."] }],
  ["online", "🖥️", ["온라인 친구로 남는다", "オンラインの友達のままで", "Stay online friends"], { effects: { social: 1, happy: 1 }, n: ["얼굴은 몰라도 생일은 꼬박꼬박 챙겼다.", "顔は知らなくても誕生日は毎年祝った。", "Never saw their face, but never missed a birthday."] }],
]);
P("coworker_rival", { age: [24, 55], emoji: "⚔️", scene: "office" }, ["동기의 견제", "同期の牽制", "A Rival Coworker"], ["입사 동기가 내 아이디어를 자기 것처럼 발표했다.", "同期が私のアイデアを自分のもののように発表した。", "A coworker from your intake presented your idea as their own."], [
  ["confront", "🗣️", ["회의 자리에서 바로잡는다", "会議で訂正する", "Correct it in the meeting"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { social: 2, happy: 3 }, n: ["메일 기록을 보여 줬다. 팀장이 고개를 끄덕였다.", "メールの記録を見せた。課長がうなずいた。", "I showed the email trail. The manager nodded."] },
    { chance: 0.5, grade: "mid", effects: { social: -2, happy: -2 }, n: ["분위기가 싸해졌다. 맞는 말이어도 피곤했다.", "空気が凍った。正しくても疲れた。", "The room went cold. Being right was still exhausting."] }] }],
  ["ally", "🤝", ["같이 하자고 제안한다", "一緒にやろうと持ちかける", "Offer to work on it together"], { grade: "good", effects: { social: 4, intel: 1 }, n: ["둘이 함께 맡은 프로젝트가 잘 됐다. 경쟁자가 동료가 됐다.", "二人で担当したプロジェクトがうまくいった。ライバルが仲間になった。", "Our joint project succeeded. A rival became a teammate."] }],
  ["let", "😶", ["그냥 넘어간다", "そのまま流す", "Let it go"], { effects: { happy: -3 }, n: ["다음 아이디어부터는 메일로 먼저 보냈다.", "次のアイデアからは先にメールで送った。", "From then on, I emailed my ideas first."] }],
]);
P("friend_success", { age: [25, 60], emoji: "🏆", scene: "restaurant" }, ["잘나가는 친구", "成功した友達", "A Friend's Big Success"], ["친구가 크게 성공했다는 소식이 들렸다. 축하 모임에 초대받았다.", "友達が大成功したという知らせ。お祝いの集まりに招かれた。", "A friend has hit it big. You're invited to the celebration."], [
  ["go", "🥂", ["진심으로 축하한다", "心から祝う", "Celebrate sincerely"], { grade: "good", effects: { social: 4, happy: 3 }, n: ["친구가 '네가 와서 제일 좋다'고 했다.", "友達が「君が来てくれたのが一番嬉しい」と言った。", "They said, 'You being here means the most.'"] }],
  ["envy", "😒", ["배가 아파서 핑계를 댄다", "妬ましくて言い訳する", "Make an excuse out of envy"], { grade: "bad", effects: { happy: -4, social: -2 }, n: ["SNS의 단체 사진에 내 자리만 비어 있었다.", "SNSの集合写真に自分の場所だけ空いていた。", "In the group photo online, only my spot was empty."] }],
]);
P("old_friend_sick", { age: [40, 85], emoji: "🏥", scene: "hospital" }, ["친구의 입원", "友人の入院", "A Friend in the Hospital"], ["오랜 친구가 큰 수술을 받는다고 한다.", "古い友人が大きな手術を受けるという。", "An old friend is having major surgery."], [
  ["visit", "💐", ["병문안을 간다", "お見舞いに行く", "Visit them"], { grade: "good", effects: { social: 4, happy: 1 }, n: ["친구가 '너 오니까 살 것 같다'고 웃었다.", "友達が「君が来て生き返った」と笑った。", "They laughed, 'Seeing you, I feel alive again.'"] }],
  ["call", "📞", ["전화로 응원한다", "電話で励ます", "Call to cheer them on"], { effects: { social: 2 }, n: ["수술 전날 밤 한 시간 동안 수다를 떨었다.", "手術の前夜、一時間おしゃべりした。", "We chatted for an hour the night before surgery."] }],
  ["fund", "💳", ["병원비를 보탠다", "治療費を援助する", "Help with the bills"], { grade: "good", effects: { money: -300, social: 5, happy: 2 }, n: ["친구는 끝내 받지 않으려 했지만, 봉투를 베개 밑에 두고 나왔다.", "友達は受け取ろうとしなかったが、封筒を枕の下に置いて帰った。", "They refused, so I left the envelope under the pillow."] }],
]);
P("mentor_found", { age: [20, 35], emoji: "🧭", scene: "office" }, ["멘토", "メンター", "A Mentor"], ["존경하던 선배가 '밥 한번 먹자'고 했다.", "尊敬していた先輩が「ご飯でも行こう」と言った。", "A senior you admire says, 'Let's grab a meal.'"], [
  ["ask", "📒", ["궁금했던 걸 다 묻는다", "聞きたかったことを全部聞く", "Ask everything you wanted to"], { grade: "good", effects: { intel: 4, social: 2 }, flag: { add: "had_mentor" }, n: ["수첩 세 쪽이 가득 찼다. 그 수첩을 오래 들고 다녔다.", "手帳三ページがびっしり埋まった。その手帳を長く持ち歩いた。", "Three notebook pages filled up. I carried that notebook for years."], next: { id: "pp_mentor_later", after: 20 } }],
  ["shy", "😳", ["긴장해서 밥만 먹는다", "緊張して食べるだけ", "Too nervous to talk"], { effects: { happy: 1 }, n: ["선배가 계산하며 '다음엔 질문 준비해 와'라고 했다.", "先輩が会計しながら「次は質問を準備しておいで」と言った。", "Paying the bill, they said, 'Bring questions next time.'"] }],
]);
P("mentor_later", { followup: true, emoji: "🧭", scene: "cafe" }, ["이번엔 내가 선배", "今度は自分が先輩", "Now I'm the Senior"], ["후배가 조심스럽게 밥을 먹자고 한다. 수첩을 든 그 모습이 어딘가 익숙하다.", "後輩が遠慮がちにご飯に誘う。手帳を持つ姿にどこか見覚えがある。", "A junior nervously asks you to lunch, notebook in hand. It looks familiar."], [
  ["give", "🍚", ["옛날 선배처럼 다 알려 준다", "昔の先輩のように全部教える", "Teach everything, like your mentor did"], { grade: "crit", effects: { social: 5, happy: 5 }, n: ["계산하면서 그 말을 그대로 했다. '다음엔 질문 준비해 와.'", "会計しながら同じ言葉を言った。「次は質問を準備しておいで」", "Paying the bill, I said the same words: 'Bring questions next time.'"] }],
]);
P("hometown_friend", { age: [28, 70], emoji: "🏘️", scene: "countryside" }, ["고향 친구", "故郷の友", "The Friend Back Home"], ["고향에 남은 친구가 오랜만에 내려오라고 한다.", "故郷に残った友が、久しぶりに帰ってこいと言う。", "A friend who stayed in your hometown asks you to come visit."], [
  ["go", "🚌", ["주말에 내려간다", "週末に帰る", "Go down for the weekend"], { grade: "good", effects: { happy: 5, social: 3, money: -40 }, n: ["둘이 다니던 문방구는 편의점이 됐지만 친구는 그대로였다.", "二人で通った文房具屋はコンビニになったが、友は変わらなかった。", "Our old stationery shop was now a convenience store, but my friend hadn't changed."] }],
  ["later", "📅", ["다음 명절에 보자고 한다", "次の休みに会おうと言う", "Say 'next holiday'"], { effects: { happy: -1 }, n: ["명절은 몇 번 지나갔다.", "休みは何度も過ぎていった。", "Several holidays came and went."] }],
]);
P("group_trip_plan", { age: [20, 40], emoji: "🗺️", scene: "cafe" }, ["친구들 여행 계획", "友達との旅行計画", "Planning a Trip with Friends"], ["다섯 명의 일정이 맞는 날이 딱 하루 생겼다.", "五人の予定が合う日がたった一日できた。", "There's exactly one day when all five friends are free."], [
  ["plan", "📋", ["총무를 맡는다", "幹事を引き受ける", "Volunteer to organize"], { grade: "good", effects: { social: 5, happy: 3, intel: 1 }, n: ["엑셀 표까지 만들었다. 친구들이 '역시'라고 했다.", "エクセル表まで作った。友達が「さすが」と言った。", "I even made a spreadsheet. Everyone said, 'Of course you did.'"] }],
  ["ride", "😎", ["따라만 간다", "ついていくだけ", "Just tag along"], { effects: { happy: 4, social: 2, money: -100 }, n: ["가장 편한 여행이었다. 사진은 제일 많이 찍혔다.", "一番楽な旅行だった。写真は一番撮られた。", "The easiest trip ever. I ended up in the most photos."] }],
  ["skip", "🛋️", ["이번엔 빠진다", "今回は抜ける", "Sit this one out"], { effects: { social: -2 }, n: ["단톡방에 올라온 사진들을 한참 넘겨 봤다.", "グループに上がった写真を長いこと眺めた。", "I scrolled through their photos for a long time."] }],
]);
P("ex_friend_reunion", { age: [30, 70], emoji: "🕊️", scene: "street" }, ["싸우고 멀어진 친구", "喧嘩別れした友", "The Friend You Fell Out With"], ["10년 전 크게 싸운 친구를 길에서 마주쳤다.", "十年前に大げんかした友と道でばったり会った。", "You bump into a friend you had a huge fight with ten years ago."], [
  ["sorry", "🫂", ["먼저 미안하다고 한다", "先に謝る", "Apologize first"], { grade: "crit", effects: { happy: 7, social: 4 }, flag: { add: "reconciled_old" }, n: ["친구도 같은 말을 하려던 참이었다. 둘 다 웃었다.", "友も同じことを言うところだった。二人とも笑った。", "They were about to say the same thing. We both laughed."] }],
  ["nod", "🙂", ["가볍게 목례만 한다", "軽く会釈する", "Just nod"], { effects: { happy: -1 }, n: ["뒤돌아서고 나서야 할 말이 떠올랐다.", "振り返ってから言うべきことを思いついた。", "The right words came only after I turned away."] }],
]);
P("community", { age: [30, 75], emoji: "🏘️", scene: "market" }, ["동네 모임", "町内会", "The Neighborhood Group"], ["동네 사람들이 반상회를 열었다. 쓰레기 문제로 시끄럽다.", "町内会が開かれた。ゴミ問題で騒がしい。", "A neighborhood meeting is called. Everyone's arguing about trash."], [
  ["lead", "📣", ["해결책을 내고 정리한다", "解決策を出してまとめる", "Propose a fix and lead"], { grade: "good", effects: { social: 5, intel: 1 }, n: ["분리수거 당번표가 생겼다. 다들 내 이름을 알게 됐다.", "分別当番表ができた。みんなが私の名前を覚えた。", "A recycling rota appeared. Everyone learned my name."] }],
  ["quiet", "🤐", ["조용히 듣기만 한다", "静かに聞くだけ", "Just listen"], { effects: { social: 1 }, n: ["회의는 두 시간 걸렸고 결론은 다음 회의였다.", "会議は二時間かかり、結論は次の会議だった。", "Two hours of meeting; the conclusion was another meeting."] }],
]);
P("stranger_help", { age: [12, 90], emoji: "🆘", scene: "subway" }, ["쓰러진 사람", "倒れた人", "A Stranger Collapses"], ["지하철에서 누군가 갑자기 쓰러졌다. 다들 쳐다보기만 한다.", "地下鉄で誰かが突然倒れた。みんな見ているだけだ。", "Someone suddenly collapses on the subway. Everyone just stares."], [
  ["help", "🚑", ["달려가서 119(구급차)를 부른다", "駆け寄って救急車を呼ぶ", "Rush over and call an ambulance"], { grade: "crit", effects: { social: 4, happy: 4 }, flag: { add: "saved_stranger" }, n: ["며칠 뒤 그분의 가족에게서 감사 편지가 왔다.", "数日後、その方の家族から感謝の手紙が届いた。", "Days later, a thank-you letter arrived from their family."] }],
  ["call", "📱", ["역무원을 부른다", "駅員を呼ぶ", "Call the station staff"], { grade: "good", effects: { social: 2 }, n: ["역무원이 금방 왔다. 내 몫은 했다고 생각했다.", "駅員がすぐ来た。自分の役目は果たしたと思った。", "Staff arrived quickly. I felt I'd done my part."] }],
]);
// ---------- 중년·노년 ----------
P("friend_divorce", { age: [35, 65], emoji: "🍶", scene: "restaurant" }, ["친구의 이혼", "友の離婚", "A Friend's Divorce"], ["친구가 술자리에서 이혼했다고 털어놓았다.", "友が飲みの席で離婚したと打ち明けた。", "Over drinks, a friend confesses they got divorced."], [
  ["listen", "👂", ["밤새 들어 준다", "一晩中話を聞く", "Listen all night"], { grade: "good", effects: { social: 4, health: -1 }, n: ["해 뜰 무렵 친구가 '이제 좀 살겠다'고 했다.", "夜明け頃、友が「少し楽になった」と言った。", "Near dawn, they said, 'I can breathe again.'"] }],
  ["advice", "🧠", ["현실적인 조언을 한다", "現実的な助言をする", "Give practical advice"], { effects: { social: 2, intel: 1 }, n: ["변호사 번호를 알려 줬다. 친구는 고맙다고 했다.", "弁護士の番号を教えた。友は感謝した。", "I passed along a lawyer's number. They were grateful."] }],
]);
P("class_reunion_50", { age: [48, 62], emoji: "🎒", scene: "restaurant" }, ["졸업 30주년", "卒業30周年", "30-Year Class Reunion"], ["졸업 30주년 모임 초대장이 왔다. 반장이 아직도 반장이다.", "卒業30周年の招待状が届いた。学級委員がまだ仕切っている。", "An invitation to the 30-year reunion. The class president is still running things."], [
  ["go", "🍻", ["간다", "行く", "Go"], { grade: "good", effects: { happy: 6, social: 4 }, n: ["얼굴은 변했는데 목소리는 그대로였다. 30년이 한순간에 접혔다.", "顔は変わっても声はそのままだった。30年が一瞬で縮んだ。", "Faces had changed, but voices hadn't. Thirty years folded into a moment."] }],
  ["skip", "🏠", ["안 간다", "行かない", "Skip it"], { effects: { social: -1 }, n: ["단체 사진을 확대해서 한 명 한 명 이름을 떠올려 봤다.", "集合写真を拡大して一人ずつ名前を思い出した。", "I zoomed in on the group photo and tried to name everyone."] }],
]);
P("lonely_neighbor", { age: [50, 90], emoji: "🚪", scene: "home" }, ["혼자 사는 옆집 어르신", "一人暮らしの隣人", "The Elderly Neighbor Living Alone"], ["옆집 어르신의 신문이 사흘째 문 앞에 쌓여 있다.", "隣のお年寄りの新聞が三日分、戸口にたまっている。", "Three days of newspapers are piled outside your elderly neighbor's door."], [
  ["knock", "✊", ["문을 두드린다", "ドアをノックする", "Knock on the door"], { outcomes: [
    { chance: 0.7, grade: "good", effects: { social: 4, happy: 2 }, n: ["감기로 누워 계셨다. 죽을 끓여 드렸고, 그 뒤로 서로 안부를 묻게 됐다.", "風邪で寝込んでいた。おかゆを作り、それから互いに声をかけ合うようになった。", "They were down with a cold. I made porridge, and we started checking on each other."] },
    { chance: 0.3, grade: "crit", effects: { social: 5, happy: 4 }, flag: { add: "saved_stranger" }, n: ["쓰러져 계셨다. 구급차를 불렀고, 늦지 않았다.", "倒れていた。救急車を呼び、間に合った。", "They had collapsed. I called an ambulance — just in time."] }] }],
  ["skip", "🚶", ["여행 가셨겠지 한다", "旅行だろうと思う", "Assume they're traveling"], { effects: { happy: -1 }, n: ["며칠 뒤 구급차가 왔다는 이야기를 들었다.", "数日後、救急車が来たと聞いた。", "Days later, I heard an ambulance had come."] }],
]);
P("old_friends_trip", { age: [60, 85], emoji: "🚐", scene: "abroad" }, ["친구들과 마지막 여행?", "友との最後の旅?", "One Last Trip with Friends?"], ["친구들이 '다리 성할 때 한 번 더 가자'며 여행을 제안했다.", "友達が「足が丈夫なうちにもう一度行こう」と旅行を提案した。", "Friends propose a trip — 'one more, while our legs still work.'"], [
  ["go", "🧳", ["간다", "行く", "Go"], { grade: "crit", effects: { happy: 9, social: 4, health: -1, money: -200 }, flag: { add: "travel" }, n: ["무릎은 아팠지만 웃느라 배가 더 아팠다.", "膝は痛かったが、笑いすぎてお腹の方が痛かった。", "My knees hurt, but my stomach hurt more from laughing."] }],
  ["photo", "📸", ["못 가지만 사진을 부탁한다", "行けないが写真を頼む", "Can't go, but ask for photos"], { effects: { happy: 1 }, n: ["매일 밤 사진이 열 장씩 왔다. 나도 거기 있는 것 같았다.", "毎晩写真が十枚ずつ届いた。自分もそこにいるようだった。", "Every night ten photos arrived. It felt like I was there."] }],
]);
P("last_friend", { age: [75, 100], emoji: "☕", scene: "seniorCenter" }, ["남은 친구", "残った友", "The Friend Who Remains"], ["어릴 적 친구들 중 이제 연락되는 건 한 명뿐이다.", "幼なじみの中で、今連絡が取れるのは一人だけだ。", "Of all your childhood friends, only one is still around."], [
  ["daily", "📞", ["매일 아침 전화하기로 한다", "毎朝電話すると決める", "Agree to call every morning"], { grade: "good", effects: { happy: 6, health: 1 }, n: ["'살아 있냐?' '살아 있다.' 그게 인사였다.", "「生きてるか?」「生きてる」それが挨拶だった。", "'Still alive?' 'Still alive.' That was our hello."] }],
  ["visit", "🚶", ["한 달에 한 번 만난다", "月に一度会う", "Meet once a month"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["같은 국밥집, 같은 자리. 주인이 알아서 두 그릇을 내왔다.", "同じ食堂の同じ席。店主が黙って二杯出してくれた。", "Same diner, same seats. The owner brought two bowls without asking."] }],
]);
P("grandkid_friend", { age: [65, 95], emoji: "🧒", scene: "park", hasKid: true }, ["손주 친구들", "孫の友達", "Your Grandkid's Friends"], ["손주가 친구들을 데리고 놀러 왔다. 다들 나를 신기하게 본다.", "孫が友達を連れて遊びに来た。みんな不思議そうに私を見る。", "Your grandkid brings friends over. They stare at you curiously."], [
  ["story", "📚", ["옛날이야기를 해 준다", "昔話をしてあげる", "Tell old stories"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["'진짜 그땐 휴대폰이 없었어요?' 아이들 눈이 동그래졌다.", "「本当にその頃は携帯がなかったの?」子どもたちの目が丸くなった。", "'Really, no phones back then?' Their eyes went wide."] }],
  ["game", "🎮", ["같이 게임을 배워 본다", "一緒にゲームを習う", "Learn their game"], { effects: { happy: 4, internet: 3 }, n: ["한 판도 못 이겼지만 아이들이 나를 '최고 할머니(할아버지)'라고 불렀다.", "一度も勝てなかったが、子どもたちに「最高のおばあちゃん(おじいちゃん)」と呼ばれた。", "I lost every round, but they called me 'the best grandparent.'"] }],
]);
// ---------- 다양한 관계 ----------
P("teacher_visit", { age: [20, 50], emoji: "🍎", scene: "classroom" }, ["은사님 찾아뵙기", "恩師を訪ねる", "Visiting an Old Teacher"], ["초등학교 담임 선생님이 곧 은퇴하신다는 소식을 들었다.", "小学校の担任の先生がもうすぐ退職すると聞いた。", "You hear your elementary school teacher is about to retire."], [
  ["visit", "💐", ["꽃을 들고 찾아간다", "花を持って訪ねる", "Visit with flowers"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["선생님은 내 이름을 기억하고 계셨다. 내가 쓴 글까지.", "先生は私の名前を覚えていた。私が書いた作文まで。", "My teacher remembered my name — and something I'd written."] }],
  ["letter", "✉️", ["편지를 쓴다", "手紙を書く", "Write a letter"], { effects: { happy: 3 }, n: ["몇 주 뒤 반듯한 글씨로 답장이 왔다.", "数週間後、きちんとした字で返事が来た。", "Weeks later, a reply came in neat handwriting."] }],
]);
P("sibling_fight", { age: [8, 60], emoji: "👊", scene: "home" }, ["형제와의 다툼", "きょうだい喧嘩", "Fight with a Sibling"], ["형제와 사소한 일로 크게 다퉜다. 서로 말을 안 한 지 일주일.", "きょうだいとささいなことで大げんか。口をきかなくなって一週間。", "A small thing turned into a big fight with your sibling. A week of silence."], [
  ["first", "🍜", ["좋아하는 음식을 사 들고 간다", "好物を買って行く", "Show up with their favorite food"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["말없이 같이 먹었다. 그걸로 끝났다.", "黙って一緒に食べた。それで終わった。", "We ate together in silence. That settled it."] }],
  ["wait", "⏳", ["먼저 연락 올 때까지 기다린다", "向こうから連絡が来るまで待つ", "Wait for them to reach out"], { effects: { happy: -3 }, n: ["둘 다 기다렸다. 부모님이 중간에서 고생했다.", "二人とも待った。親が間で苦労した。", "We both waited. Our parents were caught in the middle."] }],
]);
P("volunteer_friend", { age: [16, 80], emoji: "🤲", scene: "seniorCenter" }, ["봉사하다 만난 사람", "ボランティアで出会った人", "Someone You Met Volunteering"], ["주말 봉사 활동에서 늘 같은 시간에 오는 사람이 있다.", "週末のボランティアにいつも同じ時間に来る人がいる。", "At weekend volunteering, the same person always shows up at the same time."], [
  ["talk", "☕", ["끝나고 차 한잔하자고 한다", "終わったらお茶に誘う", "Invite them for tea afterward"], { grade: "good", effects: { social: 5, happy: 4 }, n: ["봉사보다 그 뒤의 차 한잔을 더 기다리게 됐다.", "ボランティアより、その後のお茶の方が楽しみになった。", "I started looking forward to the tea more than the volunteering."] }],
  ["focus", "🧤", ["묵묵히 일만 한다", "黙々と作業する", "Just focus on the work"], { effects: { social: 1, happy: 2 }, n: ["몇 년 뒤 그 사람이 봉사 단체 대표가 돼 있었다.", "数年後、その人がボランティア団体の代表になっていた。", "Years later, they were running the whole volunteer group."] }],
]);
P("pen_friend_abroad", { age: [12, 40], emoji: "🌏", scene: "home" }, ["외국 펜팔", "海外のペンパル", "A Pen Pal Abroad"], ["다른 나라에 사는 또래와 편지를 주고받을 기회가 생겼다.", "外国に住む同年代と手紙をやりとりする機会ができた。", "A chance to exchange letters with someone your age in another country."], [
  ["write", "✍️", ["사전을 펴고 쓴다", "辞書を引きながら書く", "Write with a dictionary open"], { grade: "good", effects: { intel: 3, social: 3, happy: 2 }, flag: { add: "penpal_abroad" }, n: ["철자는 엉망이었지만 답장이 왔다. 사진도 한 장.", "綴りはめちゃくちゃだったが返事が来た。写真も一枚。", "My spelling was a mess, but a reply came — with a photo."], next: { id: "pp_penpal_meet", after: 15 } }],
  ["no", "📭", ["귀찮아서 안 한다", "面倒でやめる", "Too much effort"], { effects: { happy: 1 }, n: ["그 반에서 펜팔을 한 건 세 명뿐이었다.", "そのクラスでペンパルをしたのは三人だけだった。", "Only three kids in class did it."] }],
]);
P("penpal_meet", { followup: true, emoji: "✈️", scene: "airport" }, ["펜팔과의 첫 만남", "ペンパルとの初対面", "Meeting Your Pen Pal"], ["15년 동안 편지만 주고받던 친구가 공항에 나와 있다고 한다.", "15年間手紙だけの友達が空港に迎えに来ているという。", "The pen pal you've written to for fifteen years is waiting at the airport."], [
  ["hug", "🤗", ["달려가 안는다", "駆け寄って抱きしめる", "Run over and hug"], { grade: "crit", effects: { happy: 9, social: 5 }, flag: { add: "travel" }, n: ["편지 속 글씨체와 똑같은 웃음이었다.", "手紙の字と同じような笑顔だった。", "Their smile looked just like their handwriting."] }],
]);
P("ghosted", { age: [16, 40], emoji: "👻", scene: "kidroom" }, ["읽고 답이 없다", "既読スルー", "Left on Read"], ["가장 친하다고 생각했던 친구가 몇 주째 답장이 없다.", "一番の親友だと思っていた友達から何週間も返事がない。", "The friend you thought was closest hasn't replied in weeks."], [
  ["ask", "📨", ["무슨 일 있냐고 묻는다", "何かあったか聞く", "Ask if something's wrong"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 3, happy: 2 }, n: ["힘든 시기였다고 했다. 물어봐 줘서 고맙다고.", "つらい時期だったと言った。聞いてくれてありがとうと。", "They'd been going through a hard time. Thanks for asking, they said."] },
    { chance: 0.4, grade: "mid", effects: { happy: -2 }, n: ["짧은 답이 왔다. 우리는 그렇게 멀어지는 중이었다.", "短い返事が来た。私たちはそうして離れつつあった。", "A short reply. We were drifting apart."] }] }],
  ["let", "🍃", ["그냥 둔다", "そっとしておく", "Let it be"], { effects: { happy: -2 }, n: ["몇 년 뒤 결혼식 청첩장이 왔다.", "数年後、結婚式の招待状が届いた。", "Years later, a wedding invitation arrived."] }],
]);
P("friend_kids", { age: [30, 55], emoji: "👶", scene: "park" }, ["친구 아이의 돌", "友の子の一歳", "A Friend's Baby"], ["친구가 아이를 낳았다. 사진을 하루에 열 장씩 보낸다.", "友に子どもが生まれた。写真を一日に十枚送ってくる。", "Your friend had a baby and sends ten photos a day."], [
  ["visit", "🍼", ["선물을 들고 찾아간다", "プレゼントを持って訪ねる", "Visit with a gift"], { grade: "good", effects: { happy: 4, social: 3, money: -50 }, n: ["아기가 내 손가락을 꼭 잡았다.", "赤ちゃんが私の指をぎゅっと握った。", "The baby gripped my finger tight."] }],
  ["like", "👍", ["사진마다 좋아요를 누른다", "写真に毎回いいねする", "Like every photo"], { effects: { social: 1 }, n: ["친구는 그것만으로도 고마워했다.", "友はそれだけでも喜んでくれた。", "Even that made them happy."] }],
]);
P("boss_friend", { age: [30, 60], emoji: "👔", scene: "office", cond: (p) => !!p.job }, ["친구가 상사가 됐다", "友が上司になった", "Your Friend Became Your Boss"], ["입사 동기이자 친구가 내 팀장이 됐다.", "同期で友人の人が、私の上司になった。", "Your friend from the same hiring class is now your team lead."], [
  ["support", "🤝", ["공과 사를 나누고 돕는다", "公私を分けて支える", "Keep it professional and support them"], { grade: "good", effects: { social: 3, happy: 2 }, n: ["회사에선 '팀장님', 퇴근하면 이름. 둘 다 편해졌다.", "会社では「課長」、退社後は名前。二人とも楽になった。", "'Boss' at work, first names after. It worked for both of us."] }],
  ["jealous", "😒", ["속이 쓰려 멀어진다", "悔しくて距離を置く", "Pull away out of jealousy"], { grade: "bad", effects: { happy: -4, social: -2 }, n: ["점심을 따로 먹기 시작했다.", "昼食を別々に食べ始めた。", "We started eating lunch separately."] }],
]);
P("cat_neighbor", { age: [20, 80], emoji: "🐈", scene: "street" }, ["길고양이 밥 주는 이웃", "野良猫に餌をやる隣人", "The Neighbor Who Feeds Strays"], ["골목에서 길고양이 밥을 챙기는 이웃이 다른 주민과 다투고 있다.", "路地で野良猫に餌をやる隣人が、別の住人と口論している。", "A neighbor who feeds stray cats is arguing with another resident."], [
  ["mediate", "⚖️", ["둘 사이를 중재한다", "仲裁する", "Mediate"], { grade: "good", effects: { social: 4, intel: 1 }, n: ["밥자리를 구석으로 옮기기로 했다. 둘 다 조금씩 양보했다.", "餌場を隅に移すことにした。二人とも少しずつ譲った。", "We moved the feeding spot to a corner. Both gave a little."] }],
  ["help", "🐾", ["고양이 편을 든다", "猫の味方をする", "Take the cats' side"], { effects: { social: 1, happy: 2 }, n: ["그날부터 나도 밥 당번이 됐다.", "その日から私も餌当番になった。", "From that day, I was on cat-feeding duty too."] }],
]);
P("apology_letter", { age: [40, 95], emoji: "✉️", scene: "home" }, ["보내지 못한 사과", "送れなかった謝罪", "The Apology Never Sent"], ["젊은 시절 상처를 준 사람이 떠올랐다. 아직 사과하지 못했다.", "若い頃傷つけた人を思い出した。まだ謝れていない。", "You think of someone you hurt when you were young. You never apologized."], [
  ["send", "📮", ["수소문해서 편지를 보낸다", "探して手紙を送る", "Track them down and send a letter"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 8, social: 3 }, n: ["'오래전 일이야. 고마워.' 짧은 답장에 오래 울었다.", "「昔のことだよ。ありがとう」短い返事に長く泣いた。", "'It was long ago. Thank you.' I cried over that short reply for a long time."] },
    { chance: 0.4, grade: "mid", effects: { happy: 2 }, n: ["답장은 없었다. 그래도 보낸 것으로 충분했다.", "返事はなかった。それでも送っただけで十分だった。", "No reply came. Sending it was enough."] }] }],
  ["keep", "🗄️", ["서랍에 넣어 둔다", "引き出しにしまう", "Keep it in a drawer"], { effects: { happy: -2 }, n: ["편지는 서랍 속에서 누렇게 변했다.", "手紙は引き出しの中で黄ばんでいった。", "The letter yellowed in the drawer."] }],
]);
P("new_town_friend", { age: [25, 75], emoji: "🏙️", scene: "street", cond: (p) => p.age > 25 }, ["낯선 동네", "知らない町", "A New Town"], ["이사 온 동네에 아는 사람이 하나도 없다.", "引っ越した町に知り合いが一人もいない。", "You've moved somewhere you don't know a single person."], [
  ["club", "🏓", ["동네 동호회에 들어간다", "地域のサークルに入る", "Join a local club"], { grade: "good", effects: { social: 5, happy: 3, health: 1 }, n: ["탁구는 늘 졌지만 끝나고 먹는 국수가 맛있었다.", "卓球はいつも負けたが、終わった後の麺がおいしかった。", "I always lost at table tennis, but the noodles after were great."] }],
  ["regular", "☕", ["단골 가게를 만든다", "行きつけの店を作る", "Become a regular somewhere"], { effects: { social: 3, happy: 2, money: -30 }, n: ["사장님이 내 주문을 외웠다. 그게 이 동네의 첫 인사였다.", "店主が私の注文を覚えた。それがこの町での最初の挨拶だった。", "The owner memorized my order. That was my first hello in this town."] }],
  ["alone", "🏠", ["혼자가 편하다", "一人が楽だ", "Prefer being alone"], { effects: { happy: -1, intel: 1 }, n: ["책은 많이 읽었다. 주말이 조금 길었다.", "本はたくさん読んだ。週末が少し長かった。", "I read a lot. Weekends felt long."] }],
]);
P("secret_kept", { age: [15, 70], emoji: "🤫", scene: "cafe" }, ["지켜 달라는 비밀", "守ってほしい秘密", "A Secret to Keep"], ["친구가 아무에게도 말하지 말라며 큰 비밀을 털어놓았다.", "友が誰にも言わないでと大きな秘密を打ち明けた。", "A friend tells you a big secret and begs you not to tell anyone."], [
  ["keep", "🔒", ["무덤까지 가져간다", "墓まで持っていく", "Take it to the grave"], { grade: "good", effects: { social: 4 }, flag: { add: "kept_secret" }, n: ["친구는 그 뒤로 무슨 일이 생기면 나부터 찾았다.", "友はそれ以来、何かあるとまず私を頼った。", "From then on, I was the first one they came to."] }],
  ["hint", "💬", ["다른 친구에게 살짝 흘린다", "他の友達にほのめかす", "Hint at it to someone else"], { grade: "bad", effects: { social: -5, happy: -3 }, n: ["비밀은 사흘 만에 퍼졌다. 친구의 눈빛을 잊을 수 없다.", "秘密は三日で広まった。友の目つきが忘れられない。", "It spread in three days. I'll never forget the look on their face."] }],
]);
P("team_sports_friend", { age: [25, 65], emoji: "⚽", scene: "field" }, ["조기 축구 친구들", "早朝サッカー仲間", "Weekend League Buddies"], ["일요일 아침 동네 팀에 사람이 모자라 불려 나갔다.", "日曜朝の地域チームに人が足りず呼び出された。", "The Sunday morning neighborhood team is short a player and calls you in."], [
  ["play", "🏃", ["뛴다", "走る", "Play"], { grade: "good", effects: { health: 3, social: 4, happy: 3 }, n: ["실력은 없었지만 '또 와'라는 말을 들었다.", "下手だったが「また来いよ」と言われた。", "I was terrible, but they said, 'Come again.'"] }],
  ["sleep", "😴", ["못 일어난다", "起きられない", "Can't wake up"], { effects: { happy: 1 }, n: ["단톡방에 '다음 주는 꼭'이라고 썼다.", "グループに「来週は必ず」と書いた。", "I typed 'definitely next week' in the group chat."] }],
]);
P("kind_words", { age: [10, 90], emoji: "💌", scene: "street" }, ["누군가의 한마디", "誰かの一言", "Someone's Kind Words"], ["힘든 날, 모르는 사람이 '오늘 옷 멋지네요'라고 했다.", "つらい日に、知らない人が「今日の服すてきですね」と言った。", "On a hard day, a stranger says, 'I love your outfit today.'"], [
  ["smile", "😊", ["웃으며 고맙다고 한다", "笑ってお礼を言う", "Smile and say thanks"], { grade: "good", effects: { happy: 6 }, n: ["하루가 달라졌다. 나도 언젠가 그 말을 누군가에게 하기로 했다.", "一日が変わった。いつか自分も誰かに言おうと決めた。", "It changed the whole day. I decided to say that to someone someday."] }],
  ["pay", "🔁", ["다음 사람에게 똑같이 해 준다", "次の人に同じことをする", "Pass it on to the next person"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["편의점 직원이 깜짝 놀라더니 활짝 웃었다.", "コンビニの店員が驚いて、にっこり笑った。", "The convenience store clerk looked surprised, then beamed."] }],
]);
P("friend_startup_invite", { age: [25, 45], emoji: "💡", scene: "office", cond: (p) => !!p.job }, ["친구의 창업 제안", "友の起業の誘い", "A Friend's Startup Offer"], ["대학 친구가 같이 회사를 차리자고 한다. 월급은 지금의 절반.", "大学の友が一緒に会社を作ろうと言う。給料は今の半分。", "A college friend wants you to co-found a company. Half your current salary."], [
  ["join", "🚀", ["회사를 그만두고 합류한다", "会社を辞めて合流する", "Quit and join"], { outcomes: [
    { chance: 0.35, grade: "crit", effects: { money: 4000, happy: 8, social: 4 }, career: "business", flag: { add: "cofounder" }, n: ["3년 차에 큰 투자를 받았다. 친구와 사무실에서 소리를 질렀다.", "三年目に大きな投資を受けた。友と事務所で叫んだ。", "In year three we landed big funding. We screamed in the office."] },
    { chance: 0.65, grade: "bad", effects: { money: -1500, happy: -5, social: -1 }, career: "business", flag: { add: "cofounder" }, n: ["2년 만에 문을 닫았다. 친구와는 한동안 어색했다.", "二年で店じまいした。友とはしばらく気まずかった。", "We shut down after two years. Things were awkward with my friend for a while."] }] }],
  ["side", "🌙", ["퇴근 후에만 돕는다", "退社後だけ手伝う", "Help only after work"], { effects: { money: 200, health: -2, social: 2 }, n: ["친구는 고마워했지만 '다 걸지는 않는구나'라고 했다.", "友は感謝したが「全部は賭けないんだね」と言った。", "They were grateful, but said, 'So you won't go all in.'"] }],
  ["no", "🙅", ["응원만 한다", "応援だけする", "Just cheer them on"], { effects: { happy: 1 }, n: ["몇 년 뒤 뉴스에서 그 회사 이름을 봤다.", "数年後、ニュースでその会社名を見た。", "Years later, I saw that company's name in the news."] }],
]);
P("caregiver_friend", { age: [45, 80], emoji: "🫶", scene: "home" }, ["간병하는 친구", "介護する友", "A Friend Who's a Caregiver"], ["부모님을 간병하는 친구가 너무 지쳐 보인다.", "親の介護をしている友がひどく疲れて見える。", "A friend caring for their parent looks completely worn out."], [
  ["cover", "🛋️", ["하루 대신 맡아 준다", "一日代わりに見る", "Cover for them for a day"], { grade: "crit", effects: { social: 5, happy: 3, health: -1 }, n: ["친구는 그날 열네 시간을 잤다고 했다.", "友はその日十四時間眠ったと言った。", "They said they slept fourteen hours that day."] }],
  ["food", "🍱", ["반찬을 만들어 보낸다", "おかずを作って送る", "Send home-cooked side dishes"], { grade: "good", effects: { social: 3, money: -30 }, n: ["빈 통이 돌아왔다. 안에 쪽지가 들어 있었다.", "空の容器が戻ってきた。中にメモが入っていた。", "The empty containers came back with a note inside."] }],
]);
P("enemy_to_friend", { age: [16, 60], emoji: "🔄", scene: "field" }, ["앙숙과 한 팀", "犬猿の仲と同じチーム", "Teamed Up with Your Nemesis"], ["사사건건 부딪치던 사람과 한 팀이 됐다.", "何かとぶつかっていた人と同じチームになった。", "You've been put on a team with the person you always clash with."], [
  ["try", "🤝", ["이번엔 맞춰 본다", "今回は合わせてみる", "Try to make it work"], { grade: "good", effects: { social: 5, happy: 3 }, flag: { add: "rival_friend" }, n: ["알고 보니 둘 다 지는 걸 싫어했을 뿐이었다. 최고의 팀이 됐다.", "実は二人とも負けず嫌いなだけだった。最高のチームになった。", "Turns out we both just hated losing. We became the best team."] }],
  ["clash", "💥", ["또 싸운다", "また衝突する", "Clash again"], { grade: "bad", effects: { happy: -3, social: -1 }, n: ["결과는 꼴찌였다. 둘 다 서로 탓을 했다.", "結果は最下位。お互いのせいにした。", "We came in last and blamed each other."] }],
]);
P("thank_you_list", { age: [55, 95], emoji: "📜", scene: "home" }, ["고마운 사람 목록", "感謝する人のリスト", "A List of People to Thank"], ["문득 살면서 고마웠던 사람들을 적어 보고 싶어졌다.", "ふと、人生で感謝した人を書き出したくなった。", "You suddenly want to write down everyone you're grateful to."], [
  ["write", "🖊️", ["한 명씩 적고 연락한다", "一人ずつ書いて連絡する", "Write them down and reach out"], { grade: "crit", effects: { happy: 8, social: 4 }, n: ["스무 명을 적었다. 그중 열둘에게 전화를 걸었다. 다들 울었다.", "二十人書いた。そのうち十二人に電話した。みんな泣いた。", "I wrote twenty names and called twelve of them. Everyone cried."] }],
  ["think", "💭", ["마음속으로만 떠올린다", "心の中で思い浮かべる", "Just remember them quietly"], { effects: { happy: 3 }, n: ["얼굴 하나하나가 떠올랐다. 생각보다 길었다.", "顔が一人ずつ浮かんだ。思ったより長いリストだった。", "Face after face came to mind. The list was longer than I thought."] }],
]);
P("social_media_fame", { age: [15, 40], emoji: "📈", scene: "studio", fromYear: 2010 }, ["갑자기 늘어난 팔로워", "急に増えたフォロワー", "Sudden Followers"], ["올린 글 하나가 퍼져서 모르는 사람들이 친구 신청을 한다.", "投稿が拡散して知らない人から友達申請が来る。", "One post went viral, and strangers are sending friend requests."], [
  ["enjoy", "🌟", ["즐긴다", "楽しむ", "Enjoy it"], { effects: { internet: 5, happy: 3, social: 2 }, n: ["일주일 동안 유명인이 된 기분이었다. 그리고 조용해졌다.", "一週間有名人の気分だった。そして静かになった。", "For a week, I felt famous. Then it went quiet."] }],
  ["private", "🔒", ["계정을 비공개로 바꾼다", "アカウントを非公開にする", "Make the account private"], { effects: { happy: 1 }, n: ["진짜 친구들만 남았다. 그게 좋았다.", "本当の友達だけが残った。それがよかった。", "Only real friends remained. I liked that."] }],
]);
P("jury_duty", { age: [20, 70], emoji: "⚖️", scene: "courtroom", noCountry: ["KR", "CN", "EG", "IN", "MX", "BR"] }, ["배심원 소환", "陪審員の呼び出し", "Jury Duty"], ["배심원으로 법정에 나오라는 통지가 왔다.", "陪審員として出廷するよう通知が来た。", "A notice summons you to serve on a jury."], [
  ["serve", "🧑‍⚖️", ["성실히 참여한다", "誠実に参加する", "Serve faithfully"], { grade: "good", effects: { intel: 3, social: 3 }, n: ["열한 명의 낯선 사람과 사흘을 보냈다. 생각보다 많은 걸 배웠다.", "十一人の他人と三日間過ごした。思ったより多くを学んだ。", "Three days with eleven strangers. I learned more than I expected."] }],
  ["excuse", "📝", ["사정을 대고 빠진다", "事情を話して免除してもらう", "Ask to be excused"], { effects: { happy: 1 }, n: ["다음 소환장은 몇 년 뒤 다시 왔다.", "次の呼び出しは数年後にまた来た。", "The next summons came years later."] }],
]);
P("matchmaker", { age: [28, 60], emoji: "💘", scene: "cafe" }, ["친구들 소개팅 주선", "友達の紹介を仕切る", "Playing Matchmaker"], ["외로워 보이는 두 친구가 떠올랐다. 둘이 잘 어울릴 것 같다.", "寂しそうな二人の友が思い浮かんだ。お似合いな気がする。", "Two lonely friends come to mind. They'd be perfect together."], [
  ["set", "💞", ["자리를 만든다", "場を作る", "Set them up"], { outcomes: [
    { chance: 0.4, grade: "crit", effects: { happy: 6, social: 5 }, flag: { add: "matchmaker" }, n: ["2년 뒤 결혼식 사회를 내가 봤다.", "二年後、結婚式の司会を私がした。", "Two years later, I emceed their wedding."] },
    { chance: 0.6, grade: "mid", effects: { social: -1, happy: -1 }, n: ["둘 다 '좋은 사람이던데…'라고만 했다.", "二人とも「いい人だったけど…」とだけ言った。", "Both just said, 'They seemed nice…'"] }] }],
  ["stay", "🙊", ["괜히 나서지 않는다", "余計なことはしない", "Stay out of it"], { effects: { happy: 1 }, n: ["두 사람은 몇 년 뒤 다른 모임에서 우연히 만났다고 한다.", "二人は数年後、別の集まりで偶然出会ったらしい。", "Years later, I heard they met by chance at some other gathering."] }],
]);
P("passing_on_house", { age: [70, 100], emoji: "🔑", scene: "home" }, ["물건 정리", "持ち物の整理", "Giving Things Away"], ["집에 물건이 너무 많다. 하나씩 사람들에게 나눠 주고 싶어졌다.", "家に物が多すぎる。一つずつ人に分けたくなった。", "Your home is full of things. You want to start giving them to people."], [
  ["give", "🎁", ["물건마다 주인을 정해 직접 건넨다", "一つずつ渡す相手を決めて手渡す", "Choose who gets each thing, hand it over"], { grade: "crit", effects: { happy: 6, social: 4 }, n: ["물건마다 얽힌 이야기를 들려줬다. 받는 사람들이 그 이야기를 더 좋아했다.", "一つ一つにまつわる話をした。受け取る人たちはその話の方を喜んだ。", "I told the story behind each item. People loved the stories more than the things."] }],
  ["keep", "🧺", ["아직은 곁에 둔다", "まだそばに置いておく", "Keep them for now"], { effects: { happy: 1 }, n: ["오래된 물건 사이에 앉아 있으면 마음이 편했다.", "古い物に囲まれていると心が落ち着いた。", "Sitting among old things felt comforting."] }],
]);

export const PEOPLE_EVENTS = EV;
