// =========================
// 플듀 인생게임 REBORN — 사건 4차: 출생·유년기 / 학교·교육 (2026-11-23)
// 형식: life-ev-kit.js 의 ev(). 시대에 맞지 않는 물건은 fromYear 로 막는다.
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const C = (id, meta, title, desc, choices) => EV.push(ev("cy_" + id, { area: "child", ...meta }, title, desc, choices));
const S = (id, meta, title, desc, choices) => EV.push(ev("sc_" + id, { area: "school", ...meta }, title, desc, choices));

// ===================== 출생·유년기 =====================
C("first_word", { age: [1, 2], emoji: "🗣️", scene: "nursery" }, ["첫 단어", "はじめての言葉", "Your First Word"], ["입에서 무언가 말이 나오려 한다. 가족 모두가 숨을 죽였다.", "口から何か言葉が出そうだ。家族全員が息をのんだ。", "A word is about to come out. The whole family holds its breath."], [
  ["mama", "👩", ["'엄마'", "「ママ」", "'Mama'"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["엄마가 울었고, 아빠는 조금 서운해했다.", "母は泣き、父は少し寂しがった。", "Mom cried. Dad was a little jealous."] }],
  ["dada", "👨", ["'아빠'", "「パパ」", "'Dada'"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["아빠가 회사에 가서 하루 종일 자랑했다.", "父が会社で一日中自慢した。", "Dad bragged about it all day at work."] }],
  ["food", "🍚", ["'맘마(밥)'", "「まんま」", "'Food'"], { effects: { happy: 3, power: 1 }, n: ["역시 먹는 게 최고였다.", "やっぱり食べるのが一番だった。", "Food first, clearly."] }],
]);
C("bath_time", { age: [1, 4], emoji: "🛁", scene: "home" }, ["목욕 시간", "お風呂の時間", "Bath Time"], ["목욕이 싫다며 거실을 뛰어다닌다.", "お風呂が嫌でリビングを走り回る。", "You refuse the bath and run laps around the living room."], [
  ["toy", "🦆", ["오리 장난감이 있으면 간다", "アヒルのおもちゃがあれば入る", "Agree if the rubber duck comes"], { grade: "good", effects: { happy: 4, health: 1 }, n: ["오리와 한 시간을 놀았다. 손가락이 쭈글쭈글해졌다.", "アヒルと一時間遊んだ。指がしわしわになった。", "An hour with the duck. My fingers went pruney."] }],
  ["run", "🏃", ["끝까지 도망친다", "最後まで逃げる", "Keep running"], { effects: { power: 2, happy: 2, health: -1 }, n: ["결국 잡혔다. 그래도 즐거웠다.", "結局捕まった。それでも楽しかった。", "Got caught eventually. Still fun."] }],
]);
C("lost_in_market", { age: [3, 7], emoji: "😢", scene: "market" }, ["시장에서 길을 잃다", "市場で迷子", "Lost in the Market"], ["엄마 손을 놓쳤다. 사방에 낯선 다리뿐이다.", "母の手を離してしまった。周りは知らない人の足ばかり。", "You let go of Mom's hand. All you can see are strangers' legs."], [
  ["stay", "🧍", ["그 자리에서 기다린다", "その場で待つ", "Stay put and wait"], { grade: "good", effects: { intel: 2, happy: -1 }, n: ["10분 뒤 엄마가 달려왔다. '잘했어, 거기 있어서.'", "十分後、母が駆けつけた。「えらいね、そこにいて」", "Ten minutes later Mom came running. 'Good job staying put.'"] }],
  ["cry", "😭", ["크게 운다", "大声で泣く", "Cry loudly"], { effects: { happy: -2, social: 1 }, n: ["떡집 아주머니가 떡을 쥐여 주고 엄마를 찾아 줬다.", "餅屋のおばさんが餅を握らせて母を探してくれた。", "The rice-cake lady gave me a treat and found my mom."] }],
]);
C("kindergarten_first", { age: [4, 6], emoji: "🎒", scene: "classroom" }, ["유치원 첫날", "幼稚園の初日", "First Day of Kindergarten"], ["유치원 문 앞에서 엄마(아빠) 다리를 꼭 붙잡았다.", "幼稚園の門の前で母(父)の足にしがみついた。", "At the kindergarten gate, you cling to your parent's leg."], [
  ["brave", "🦁", ["손을 흔들고 들어간다", "手を振って入る", "Wave and walk in"], { grade: "good", effects: { social: 3, happy: 2, power: 1 }, n: ["점심때쯤엔 엄마 생각을 잊었다.", "お昼頃には母のことを忘れていた。", "By lunch, I'd forgotten to miss Mom."] }],
  ["cry", "😢", ["울면서 버틴다", "泣きながら耐える", "Cry but stay"], { effects: { happy: -1, social: 1 }, n: ["선생님이 하루 종일 안아 주셨다. 그 선생님을 오래 좋아했다.", "先生が一日中抱っこしてくれた。その先生をずっと好きだった。", "The teacher held me all day. I adored that teacher for years."] }],
]);
C("pet_fish_kid", { age: [5, 10], emoji: "🐟", scene: "kidroom", hasPet: false }, ["축제에서 받은 금붕어", "お祭りの金魚", "A Goldfish from the Fair"], ["동네 축제에서 금붕어 한 마리를 받았다.", "町のお祭りで金魚を一匹もらった。", "You won a goldfish at the neighborhood fair."], [
  ["care", "🫧", ["어항을 사서 정성껏 키운다", "水槽を買って大事に育てる", "Buy a tank and care for it"], { grade: "good", effects: { happy: 5, intel: 1 }, life: { pet: { kind: "fish" } }, n: ["이름을 '반짝이'라고 지었다. 매일 아침 인사를 했다.", "名前を「キラキラ」とつけた。毎朝挨拶した。", "I named it Sparkle and said good morning every day."] }],
  ["bowl", "🥣", ["그냥 그릇에 둔다", "そのままお椀に入れておく", "Leave it in a bowl"], { effects: { happy: 1 }, n: ["엄마가 몰래 어항을 사 왔다.", "母がこっそり水槽を買ってきた。", "Mom secretly bought a tank."], life: { pet: { kind: "fish" } } }],
]);
C("bedtime_story", { age: [3, 8], emoji: "📖", scene: "kidroom" }, ["잠들기 전 이야기", "寝る前のお話", "A Bedtime Story"], ["자기 전에 이야기를 하나만 더 해 달라고 조른다.", "寝る前にもう一つお話をとせがむ。", "You beg for just one more story before bed."], [
  ["more", "📚", ["한 권 더!", "もう一冊!", "One more book!"], { grade: "good", effects: { intel: 3, happy: 3 }, n: ["아빠가 먼저 잠들었다. 혼자 그림을 보며 이야기를 지어냈다.", "父が先に寝てしまった。一人で絵を見ながらお話を作った。", "Dad fell asleep first. I made up my own story from the pictures."] }],
  ["tell", "🗣️", ["내가 이야기를 지어 들려준다", "自分でお話を作って聞かせる", "Tell your own made-up story"], { grade: "good", effects: { intel: 2, social: 2, happy: 3 }, flag: { add: "storyteller" }, n: ["공룡과 공주가 우주에 가는 이야기였다. 엄마가 받아 적었다.", "恐竜とお姫様が宇宙へ行く話だった。母が書き留めた。", "A dinosaur and a princess went to space. Mom wrote it down."] }],
]);
C("doctor_play", { age: [4, 9], emoji: "🩺", scene: "kidroom" }, ["병원 놀이", "お医者さんごっこ", "Playing Doctor"], ["장난감 청진기로 인형들을 진찰한다.", "おもちゃの聴診器でぬいぐるみを診察する。", "You examine your stuffed animals with a toy stethoscope."], [
  ["serious", "🧸", ["진지하게 다 치료해 준다", "真剣に全部治してあげる", "Treat every patient seriously"], { grade: "good", effects: { intel: 2, happy: 3 }, n: ["곰 인형 팔에 반창고가 세 개 붙었다.", "クマのぬいぐるみの腕に絆創膏が三枚貼られた。", "The teddy bear ended up with three bandages."] }],
  ["shop", "🏪", ["가게 놀이로 바꾼다", "お店ごっこに変える", "Switch to playing shop"], { effects: { social: 2, happy: 3 }, n: ["나뭇잎이 돈이었다. 부자가 됐다.", "葉っぱがお金だった。お金持ちになった。", "Leaves were money. I got rich."] }],
]);
C("rainy_puddle", { age: [3, 9], emoji: "☔", scene: "street" }, ["물웅덩이", "水たまり", "Puddles"], ["비가 그친 길에 커다란 물웅덩이가 있다. 새 신발을 신었다.", "雨上がりの道に大きな水たまり。新しい靴を履いている。", "A huge puddle after the rain. You're wearing new shoes."], [
  ["jump", "💦", ["뛰어든다", "飛び込む", "Jump in"], { effects: { happy: 6, health: -1 }, n: ["물이 무릎까지 튀었다. 엄마 표정은 잊을 수 없다.", "水が膝まで跳ねた。母の顔は忘れられない。", "Water splashed to my knees. I'll never forget Mom's face."] }],
  ["around", "🚶", ["돌아간다", "よけて通る", "Walk around it"], { grade: "good", effects: { intel: 1, happy: 1 }, n: ["새 신발은 깨끗했다. 조금 아쉬웠다.", "新しい靴はきれいだった。少し物足りなかった。", "Clean new shoes. Slightly disappointing."] }],
]);
C("lie_vase", { age: [5, 10], emoji: "🏺", scene: "home" }, ["깨진 꽃병", "割れた花瓶", "The Broken Vase"], ["공놀이를 하다 꽃병을 깼다. 동생이 옆에 있었다.", "ボール遊びで花瓶を割ってしまった。弟妹がそばにいた。", "Playing ball, you broke a vase. Your little sibling was right there."], [
  ["truth", "🙇", ["내가 했다고 말한다", "自分がやったと言う", "Admit it was you"], { grade: "good", effects: { social: 2, happy: -1 }, flag: { add: "honest" }, n: ["혼났지만, 엄마가 '솔직해서 고맙다'고 했다.", "叱られたが、母は「正直に言ってくれてありがとう」と言った。", "I got scolded, but Mom said, 'Thank you for being honest.'"] }],
  ["blame", "👉", ["동생 탓을 한다", "弟妹のせいにする", "Blame your sibling"], { grade: "bad", effects: { happy: -3, social: -2 }, n: ["동생이 울면서 억울해했다. 그 눈빛이 오래 남았다.", "弟妹が泣いて悔しがった。その目が長く残った。", "My sibling cried, wronged. That look stayed with me."] }],
]);
C("first_bike", { age: [5, 10], emoji: "🚲", scene: "park" }, ["보조 바퀴 떼기", "補助輪を外す", "Training Wheels Off"], ["아빠가 보조 바퀴를 떼자고 한다. 뒤에서 잡아 준단다.", "父が補助輪を外そうと言う。後ろで支えてくれるらしい。", "Dad wants to take off the training wheels. He'll hold on from behind."], [
  ["try", "🚴", ["도전한다", "挑戦する", "Give it a go"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 7, power: 2 }, n: ["돌아보니 아빠는 저 멀리 서 있었다. 혼자 타고 있었다!", "振り向くと父はずっと後ろに立っていた。一人で乗れていた!", "I looked back — Dad was way behind me. I was riding on my own!"] },
    { chance: 0.4, grade: "mid", effects: { health: -1, power: 2, happy: 2 }, n: ["무릎이 까졌다. 다음 날 다시 탔다.", "膝をすりむいた。次の日またトライした。", "Scraped my knee. Tried again the next day."] }] }],
  ["wait", "🛑", ["아직 무섭다", "まだ怖い", "Too scared still"], { effects: { happy: -1 }, n: ["동생이 먼저 성공했다. 그게 자극이 됐다.", "弟妹が先に成功した。それが刺激になった。", "My younger sibling did it first. That lit a fire."] }],
]);
C("dream_draw", { age: [6, 10], emoji: "🖍️", scene: "classroom" }, ["장래 희망 그림", "将来の夢の絵", "Drawing Your Future"], ["미술 시간, '커서 되고 싶은 것'을 그리라고 한다.", "図工の時間、「大きくなったらなりたいもの」を描けと言われた。", "Art class: draw what you want to be when you grow up."], [
  ["big", "🚀", ["우주 비행사", "宇宙飛行士", "An astronaut"], { effects: { happy: 4, intel: 1 }, n: ["로켓을 종이 밖까지 그렸다. 선생님이 벽에 붙였다.", "ロケットを紙からはみ出すほど描いた。先生が壁に貼った。", "My rocket went off the edge of the paper. The teacher pinned it up."] }],
  ["parent", "👩‍👧", ["엄마(아빠)처럼", "ママ(パパ)みたいに", "Like Mom (or Dad)"], { grade: "good", effects: { happy: 3, social: 2 }, n: ["그림을 본 엄마가 냉장고에 1년 동안 붙여 두었다.", "絵を見た母が一年間冷蔵庫に貼っておいた。", "Mom kept that drawing on the fridge for a year."] }],
  ["animal", "🐕", ["강아지가 되고 싶다", "子犬になりたい", "I want to be a puppy"], { effects: { happy: 5 }, n: ["반 아이들이 다 웃었다. 나도 웃었다.", "クラスのみんなが笑った。私も笑った。", "The whole class laughed. So did I."] }],
]);
C("chore_reward", { age: [6, 11], emoji: "🧹", scene: "home" }, ["심부름 용돈", "お手伝いのお小遣い", "Chores for Pocket Money"], ["엄마가 집안일을 도우면 용돈을 주겠다고 한다.", "母が家事を手伝ったらお小遣いをくれると言う。", "Mom offers pocket money for helping with chores."], [
  ["work", "💪", ["열심히 돕는다", "一生懸命手伝う", "Work hard"], { grade: "good", effects: { money: 10, power: 1, happy: 2 }, flag: { add: "hard_worker" }, n: ["처음으로 내 손으로 번 돈이었다. 쓰기가 아까웠다.", "初めて自分で稼いだお金だった。使うのがもったいなかった。", "My first earned money. I didn't want to spend it."] }],
  ["half", "😴", ["대충 한다", "適当にやる", "Do it halfway"], { effects: { money: 3, happy: 1 }, n: ["엄마가 다시 했다. 용돈도 반이었다.", "母がやり直した。お小遣いも半分だった。", "Mom redid it. Half the pay, too."] }],
]);
C("talent_show", { age: [6, 12], emoji: "🎤", scene: "stage" }, ["학예회", "学芸会", "The School Talent Show"], ["학예회에서 무엇을 할지 정해야 한다.", "学芸会で何をするか決めなければ。", "You need to pick what to do for the school talent show."], [
  ["solo", "🎵", ["혼자 노래한다", "一人で歌う", "Sing solo"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 7, social: 4, internet: 1 }, n: ["박수가 끝나지 않았다. 할머니가 녹화한 영상을 평생 보셨다.", "拍手が鳴りやまなかった。祖母は録画を一生見返した。", "The applause wouldn't stop. Grandma watched the recording for the rest of her life."] },
    { chance: 0.4, grade: "mid", effects: { happy: -1, social: 2 }, n: ["가사를 까먹었다. 친구들이 객석에서 같이 불러 줬다.", "歌詞を忘れた。友達が客席から一緒に歌ってくれた。", "I forgot the lyrics. Friends sang along from the audience."] }] }],
  ["group", "🕺", ["친구들과 춤", "友達とダンス", "Dance with friends"], { grade: "good", effects: { happy: 5, social: 4 }, n: ["한 박자 늦었지만 제일 신났다.", "一拍遅れたが一番楽しかった。", "Half a beat behind, but having the most fun."] }],
  ["back", "🎨", ["무대 뒤 배경 그리기", "舞台裏の背景を描く", "Paint the backdrop"], { effects: { intel: 2, happy: 3 }, n: ["무대가 내 그림으로 꽉 찼다. 아무도 몰랐지만 나는 알았다.", "舞台が私の絵で埋まった。誰も知らなかったが私は知っていた。", "My painting filled the stage. No one knew, but I did."] }],
]);
C("stray_kitten", { age: [6, 12], emoji: "🐈", scene: "street" }, ["골목의 아기 고양이", "路地の子猫", "A Kitten in the Alley"], ["학교 가는 길에 비에 젖은 아기 고양이를 발견했다.", "通学路で雨に濡れた子猫を見つけた。", "On the way to school, you find a soaked kitten."], [
  ["home", "🏠", ["집에 데려가 부모님을 설득한다", "家に連れて帰って親を説得する", "Take it home and plead with your parents"], { outcomes: [
    { chance: 0.55, grade: "crit", effects: { happy: 8, social: 1 }, life: { pet: { kind: "cat" } }, n: ["아빠가 한숨을 쉬더니 '이름은 뭐로 할래?'라고 물었다.", "父がため息をついて「名前は何にする?」と聞いた。", "Dad sighed and asked, 'So what are we naming it?'"] },
    { chance: 0.45, grade: "mid", effects: { happy: -2, social: 2 }, n: ["안 된다고 했다. 대신 이웃집에서 키우기로 했다. 매일 보러 갔다.", "だめと言われた。代わりに隣の家で飼うことになった。毎日会いに行った。", "They said no. The neighbors took it in. I visited every day."] }] }],
  ["shelter", "📞", ["보호소에 연락한다", "保護施設に連絡する", "Call a shelter"], { grade: "good", effects: { happy: 3, intel: 1 }, n: ["며칠 뒤 좋은 가족에게 입양됐다는 연락을 받았다.", "数日後、いい家族に引き取られたと連絡が来た。", "A few days later I heard it was adopted by a good family."] }],
]);
C("dark_fear", { age: [4, 9], emoji: "🌑", scene: "kidroom" }, ["어둠이 무섭다", "暗闇が怖い", "Afraid of the Dark"], ["불을 끄자 옷장 그림자가 괴물처럼 보인다.", "電気を消すとクローゼットの影が怪物に見える。", "With the lights off, the closet's shadow looks like a monster."], [
  ["light", "💡", ["작은 등을 켜 달라고 한다", "小さな明かりをつけてもらう", "Ask for a nightlight"], { grade: "good", effects: { happy: 3, health: 1 }, n: ["별 모양 등이 천장에 별을 띄웠다.", "星形のライトが天井に星を映した。", "A star-shaped light covered the ceiling in stars."] }],
  ["face", "🗡️", ["이불을 뒤집어쓰고 용감하게 확인한다", "布団をかぶって勇敢に確かめる", "Bravely check under the blanket-armor"], { effects: { power: 2, happy: 2 }, n: ["괴물은 걸어 둔 외투였다. 다음 날 친구들에게 무용담을 늘어놓았다.", "怪物はかけてあったコートだった。翌日友達に武勇伝を語った。", "The monster was a hanging coat. I bragged about my bravery the next day."] }],
]);
C("grandpa_lap", { age: [3, 10], emoji: "👴", scene: "home" }, ["할아버지 무릎", "祖父の膝", "Grandpa's Lap"], ["할아버지가 무릎에 앉혀 옛날 노래를 가르쳐 준다.", "祖父が膝に座らせて昔の歌を教えてくれる。", "Grandpa sits you on his lap and teaches you an old song."], [
  ["learn", "🎶", ["따라 부른다", "一緒に歌う", "Sing along"], { grade: "good", effects: { happy: 5, social: 2 }, flag: { add: "grandpa_song" }, n: ["어른이 돼서도 그 노래 가사를 다 기억했다.", "大人になってもその歌詞を全部覚えていた。", "I remembered every word of that song as an adult."] }],
  ["play", "🏃", ["놀러 나간다", "遊びに出る", "Run off to play"], { effects: { happy: 3, power: 1 }, n: ["할아버지는 혼자 노래를 끝까지 불렀다.", "祖父は一人で最後まで歌った。", "Grandpa sang the rest of the song alone."] }],
]);
C("sick_day_kid", { age: [5, 12], emoji: "🤒", scene: "kidroom" }, ["학교를 쉬는 날", "学校を休む日", "A Sick Day"], ["열이 나서 학교를 쉬었다. 엄마가 죽을 끓여 준다.", "熱が出て学校を休んだ。母がおかゆを作ってくれる。", "You're home sick with a fever. Mom makes you porridge."], [
  ["rest", "🛌", ["푹 잔다", "ぐっすり寝る", "Sleep it off"], { grade: "good", effects: { health: 3, happy: 2 }, n: ["자고 일어나니 엄마가 옆에서 졸고 있었다.", "目覚めると、母がそばでうとうとしていた。", "I woke to find Mom dozing beside me."] }],
  ["tv", "📺", ["만화를 몰아 본다", "アニメを一気に見る", "Binge cartoons"], { effects: { happy: 4, health: 1 }, n: ["아픈 날이 가장 행복한 날이었다.", "具合の悪い日が一番幸せな日だった。", "The sick day was secretly the best day."] }],
]);
C("moving_house_kid", { age: [5, 12], emoji: "🚚", scene: "street" }, ["이사 가는 날", "引っ越しの日", "Moving Day"], ["다른 동네로 이사를 간다. 친구들과 헤어져야 한다.", "別の町に引っ越す。友達と別れなければならない。", "You're moving to a new neighborhood. You have to say goodbye to friends."], [
  ["letter", "✉️", ["친구들에게 편지를 쓴다", "友達に手紙を書く", "Write letters to your friends"], { grade: "good", effects: { social: 3, happy: -1 }, n: ["새 주소를 적어 줬다. 몇 명은 정말 답장을 보냈다.", "新しい住所を書いて渡した。何人かは本当に返事をくれた。", "I gave them my new address. A few actually wrote back."] }],
  ["explore", "🗺️", ["새 동네를 탐험한다", "新しい町を探検する", "Explore the new neighborhood"], { grade: "good", effects: { happy: 3, social: 2, power: 1 }, n: ["새 동네 놀이터에서 첫날 친구가 생겼다.", "新しい町の公園で初日に友達ができた。", "I made a friend at the new playground on day one."] }],
]);
C("magic_belief", { age: [5, 9], emoji: "🎅", scene: "home" }, ["선물을 주는 사람", "プレゼントをくれる人", "Who Brings the Presents?"], ["친구가 '선물은 사실 엄마 아빠가 주는 거야'라고 했다.", "友達が「プレゼントは本当はママとパパがくれるんだよ」と言った。", "A friend says, 'Actually, your parents bring the presents.'"], [
  ["believe", "✨", ["그래도 믿는다", "それでも信じる", "Keep believing anyway"], { grade: "good", effects: { happy: 4 }, n: ["그해에도 양말을 걸었다. 다음 날 아침 양말이 묵직했다.", "その年も靴下を下げた。翌朝、靴下が重かった。", "I hung my stocking again. The next morning it was heavy."] }],
  ["ask", "🕵️", ["부모님께 직접 묻는다", "親に直接聞く", "Ask your parents directly"], { effects: { intel: 2, happy: 1 }, n: ["엄마가 웃으며 '믿는 사람에게만 온대'라고 했다.", "母が笑って「信じる人にだけ来るんだって」と言った。", "Mom smiled: 'It only comes to those who believe.'"] }],
]);
C("hide_and_seek", { age: [4, 11], emoji: "🙈", scene: "playground" }, ["숨바꼭질", "かくれんぼ", "Hide and Seek"], ["술래가 열을 세기 시작했다.", "鬼が十を数え始めた。", "The seeker starts counting to ten."], [
  ["clever", "🧠", ["아무도 모르는 곳에 숨는다", "誰も知らない場所に隠れる", "Hide somewhere no one would think of"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { intel: 2, happy: 5 }, n: ["끝까지 못 찾았다. 이겼지만 조금 외로웠다.", "最後まで見つからなかった。勝ったけど少し寂しかった。", "They never found me. I won — a little lonely, though."] },
    { chance: 0.5, grade: "mid", effects: { happy: 3 }, n: ["재채기 때문에 들켰다.", "くしゃみでばれた。", "A sneeze gave me away."] }] }],
  ["seek", "👀", ["내가 술래를 한다", "自分が鬼をやる", "Volunteer to be 'it'"], { grade: "good", effects: { social: 3, happy: 4 }, n: ["다 찾아냈다. 놀이터의 영웅이 됐다.", "全員見つけた。公園のヒーローになった。", "Found everyone. Playground hero."] }],
]);
C("snow_day_kid", { age: [4, 12], emoji: "⛄", scene: "park" }, ["눈 오는 날", "雪の日", "A Snow Day"], ["밤새 눈이 쌓였다. 학교가 쉰다고 한다!", "一晩で雪が積もった。学校が休みだって!", "It snowed all night. School's canceled!"], [
  ["snowman", "⛄", ["눈사람을 만든다", "雪だるまを作る", "Build a snowman"], { grade: "good", effects: { happy: 6, power: 1 }, n: ["당근 코와 아빠 목도리. 눈사람은 일주일을 버텼다.", "にんじんの鼻と父のマフラー。雪だるまは一週間もった。", "A carrot nose and Dad's scarf. It lasted a week."] }],
  ["fight", "❄️", ["눈싸움", "雪合戦", "Snowball fight"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["볼이 빨개질 때까지 던졌다. 코코아가 기다리고 있었다.", "頬が赤くなるまで投げた。ココアが待っていた。", "We threw until our cheeks were red. Hot cocoa waited inside."] }],
]);
C("tooth_fairy", { age: [5, 8], emoji: "🦷", scene: "kidroom" }, ["빠진 이", "抜けた歯", "A Lost Tooth"], ["흔들리던 앞니가 드디어 빠졌다.", "ぐらぐらしていた前歯がついに抜けた。", "The wobbly front tooth finally came out."], [
  ["roof", "🏠", ["지붕 위로 던진다", "屋根に投げる", "Toss it on the roof"], { effects: { happy: 4 }, n: ["까치에게 새 이를 달라고 빌었다.", "カササギに新しい歯をくださいと願った。", "I asked the magpies for a new tooth."] }],
  ["pillow", "🛏️", ["베개 밑에 둔다", "枕の下に置く", "Put it under the pillow"], { effects: { happy: 4, money: 2 }, n: ["아침에 동전이 놓여 있었다.", "朝、硬貨が置かれていた。", "In the morning, there was a coin."] }],
]);
C("photo_booth_family", { age: [3, 10], emoji: "📷", scene: "home", fromYear: 1960 }, ["가족 나들이 사진", "家族のお出かけ写真", "A Family Outing Photo"], ["주말에 온 가족이 동물원에 갔다. 사진 찍을 때 자꾸 눈을 감는다.", "週末、家族で動物園に行った。写真を撮るたびに目をつぶってしまう。", "A weekend trip to the zoo. You keep blinking in every photo."], [
  ["funny", "😜", ["웃긴 표정을 짓는다", "変顔をする", "Make a silly face"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["그 사진이 가족 앨범에서 제일 유명해졌다.", "その写真が家族アルバムで一番有名になった。", "That photo became the most famous one in the family album."] }],
  ["animals", "🦒", ["기린에 정신이 팔린다", "キリンに夢中になる", "Get distracted by the giraffes"], { effects: { happy: 4, intel: 1 }, n: ["사진엔 내 뒤통수만 나왔다. 기린은 멋있었다.", "写真には私の後頭部だけ写った。キリンはかっこよかった。", "Only the back of my head made it into the photo. The giraffes were great."] }],
]);
C("kid_cooking", { age: [6, 12], emoji: "🥞", scene: "kitchen" }, ["처음 해 본 요리", "はじめての料理", "Your First Cooking"], ["엄마 생일, 몰래 아침밥을 만들어 보기로 했다.", "母の誕生日、こっそり朝ごはんを作ることにした。", "It's Mom's birthday — you decide to secretly make breakfast."], [
  ["cook", "🍳", ["계란프라이에 도전한다", "目玉焼きに挑戦する", "Attempt a fried egg"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 7, social: 2 }, n: ["모양은 이상했지만 엄마는 '세상에서 제일 맛있다'고 했다.", "形は変だったが、母は「世界一おいしい」と言った。", "It looked weird, but Mom said it was the best in the world."] },
    { chance: 0.5, grade: "mid", effects: { happy: 3 }, n: ["연기 경보기가 울렸다. 엄마가 웃으며 일어났다.", "煙探知機が鳴った。母が笑いながら起きてきた。", "The smoke alarm went off. Mom got up laughing."] }] }],
  ["card", "💌", ["카드를 만든다", "カードを作る", "Make a card instead"], { grade: "good", effects: { happy: 5 }, n: ["삐뚤빼뚤한 글씨였다. 엄마는 그 카드를 지갑에 넣고 다녔다.", "がたがたの字だった。母はそのカードを財布に入れて持ち歩いた。", "Wobbly handwriting. Mom kept it in her wallet."] }],
]);
C("swim_learn", { age: [5, 11], emoji: "🏊", scene: "beach" }, ["수영 배우기", "水泳を習う", "Learning to Swim"], ["수영장에서 물에 얼굴을 담그는 게 무섭다.", "プールで顔を水につけるのが怖い。", "At the pool, putting your face in the water is scary."], [
  ["try", "🫧", ["눈을 꼭 감고 담근다", "目をぎゅっとつぶってつける", "Squeeze your eyes shut and dunk"], { grade: "good", effects: { health: 3, power: 2, happy: 3 }, flag: { add: "can_swim" }, n: ["숨을 참고 셋을 셌다. 다음 달엔 25미터를 갔다.", "息を止めて三つ数えた。翌月には25メートル泳いだ。", "I held my breath and counted to three. Next month, I swam 25 meters."] }],
  ["float", "🦆", ["튜브만 탄다", "浮き輪だけ", "Stick to the float ring"], { effects: { happy: 3 }, n: ["물놀이는 좋았다. 수영은 다음 해로.", "水遊びは楽しかった。水泳は来年に。", "Water fun, yes. Swimming, next year."] }],
]);
C("old_village_play", { age: [5, 12], emoji: "🪁", scene: "countryside", era: ["early", "past"] }, ["연날리기", "凧揚げ", "Flying a Kite"], ["겨울 들판, 동네 아이들이 직접 만든 연을 날린다.", "冬の野原で、村の子どもたちが手作りの凧を揚げる。", "In the winter fields, the village kids fly homemade kites."], [
  ["make", "🪁", ["대나무로 직접 만든다", "竹で自分で作る", "Make your own from bamboo"], { grade: "good", effects: { intel: 2, happy: 5, power: 1 }, n: ["내 연이 제일 높이 올라갔다. 실이 끊겨 멀리 날아갔지만 그것도 좋았다.", "私の凧が一番高く上がった。糸が切れて飛んでいったが、それもよかった。", "My kite flew highest. The string snapped and it soared away — that was fine too."] }],
  ["watch", "👀", ["형들 걸 구경한다", "年上の子のを見る", "Watch the older kids'"], { effects: { happy: 3, social: 2 }, n: ["형이 실 끝을 잡게 해 줬다.", "年上の子が糸の端を持たせてくれた。", "An older kid let me hold the string."] }],
]);
C("radio_drama_kid", { age: [6, 12], emoji: "📻", scene: "home", era: ["early", "past"], calYear: [1930, 1975] }, ["라디오 연속극", "ラジオドラマ", "The Radio Serial"], ["저녁마다 온 가족이 라디오 앞에 모여 연속극을 듣는다.", "毎晩家族全員がラジオの前に集まってドラマを聞く。", "Every evening, the whole family gathers around the radio for the serial."], [
  ["listen", "👂", ["숨죽이고 듣는다", "息をひそめて聞く", "Listen breathlessly"], { grade: "good", effects: { happy: 5, intel: 1, social: 2 }, n: ["'다음 회에 계속'이 세상에서 제일 미운 말이었다.", "「次回に続く」が世界で一番憎い言葉だった。", "'To be continued' was the cruelest phrase in the world."] }],
  ["act", "🎭", ["다음 날 친구들과 따라 한다", "翌日友達と真似する", "Act it out with friends the next day"], { effects: { happy: 4, social: 3 }, n: ["골목에서 악당 역은 늘 내 차지였다.", "路地での悪役はいつも私の役だった。", "In the alley, I always got the villain role."] }],
]);
C("handmedown", { age: [6, 13], emoji: "👕", scene: "kidroom" }, ["물려받은 옷", "お下がりの服", "Hand-Me-Downs"], ["사촌 형(언니)에게 물려받은 옷이 조금 크다.", "いとこからのお下がりの服が少し大きい。", "The clothes handed down from your older cousin are a bit big."], [
  ["wear", "🙂", ["소매를 걷어 입는다", "袖をまくって着る", "Roll up the sleeves and wear it"], { grade: "good", effects: { happy: 2, intel: 1 }, n: ["1년 뒤 딱 맞았다. 그 옷이 제일 편했다.", "一年後ぴったりになった。その服が一番楽だった。", "A year later it fit perfectly. My comfiest shirt."] }],
  ["sulk", "😤", ["새 옷을 사 달라고 조른다", "新しい服をねだる", "Beg for new clothes"], { effects: { happy: -1, money: -5 }, n: ["엄마가 한숨을 쉬었다. 새 옷은 한 벌만 생겼다.", "母がため息をついた。新しい服は一着だけ。", "Mom sighed. I got just one new shirt."] }],
]);
C("kid_garden", { age: [5, 12], emoji: "🌱", scene: "countryside" }, ["강낭콩 키우기", "インゲン豆の観察", "Growing a Bean Plant"], ["과학 숙제로 강낭콩을 키워 관찰 일기를 쓴다.", "理科の宿題でインゲン豆を育てて観察日記をつける。", "For science homework, you grow a bean plant and keep a diary."], [
  ["daily", "📔", ["매일 꼼꼼히 기록한다", "毎日きちんと記録する", "Record it carefully every day"], { grade: "good", effects: { intel: 3, happy: 2 }, flag: { add: "nature_kid" }, n: ["떡잎이 나온 날, 일기에 별을 세 개 그렸다.", "双葉が出た日、日記に星を三つ描いた。", "The day the sprout appeared, I drew three stars in the diary."] }],
  ["forget", "🥀", ["물 주는 걸 깜빡한다", "水やりを忘れる", "Forget to water it"], { effects: { happy: -1, intel: 1 }, n: ["시들어 버렸다. 엄마가 몰래 새 콩을 심어 줬다.", "枯れてしまった。母がこっそり新しい豆を植えてくれた。", "It wilted. Mom secretly planted a new bean."] }],
]);
C("cousin_visit", { age: [4, 12], emoji: "👧", scene: "home" }, ["사촌들이 온 날", "いとこが来た日", "The Cousins Visit"], ["명절이라 사촌들이 놀러 왔다. 집이 시끌벅적하다.", "休みでいとこたちが遊びに来た。家がにぎやかだ。", "The cousins are visiting for the holiday. The house is buzzing."], [
  ["play", "🎲", ["다 같이 보드게임", "みんなでボードゲーム", "Board games with everyone"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["밤 열두 시까지 놀다 어른들한테 혼났다.", "夜十二時まで遊んで大人に叱られた。", "We played till midnight and got scolded by the grown-ups."] }],
  ["share", "🧸", ["내 장난감을 나눠 준다", "自分のおもちゃを分けてあげる", "Share your toys"], { grade: "good", effects: { social: 4, happy: 3 }, n: ["사촌 동생이 돌아갈 때 내 인형을 꼭 안고 갔다. 아깝지 않았다.", "いとこが帰る時、私のぬいぐるみを抱えて行った。惜しくなかった。", "My little cousin left hugging my stuffed animal. I didn't mind."] }],
]);

// ===================== 학교·교육 =====================
S("first_exam", { age: [8, 10], emoji: "💯", scene: "classroom" }, ["첫 받아쓰기 시험", "はじめての書き取りテスト", "The First Spelling Test"], ["받아쓰기 시험지를 받았다. 빨간 동그라미가 몇 개일까.", "書き取りテストが返ってきた。赤い丸はいくつだろう。", "Your spelling test comes back. How many red circles?"], [
  ["show", "📄", ["집에 가서 자랑한다", "家に帰って自慢する", "Show it off at home"], { grade: "good", effects: { happy: 4, intel: 2 }, n: ["냉장고에 시험지가 붙었다.", "冷蔵庫にテストが貼られた。", "The test went up on the fridge."] }],
  ["hide", "🙈", ["틀린 게 많아 숨긴다", "間違いが多くて隠す", "Hide it — too many mistakes"], { effects: { happy: -2 }, n: ["가방 밑바닥에서 엄마가 찾았다. 같이 다시 공부했다.", "鞄の底から母が見つけた。一緒に勉強し直した。", "Mom found it at the bottom of my bag. We studied it together."] }],
]);
S("science_fair", { age: [10, 16], emoji: "🔬", scene: "lab" }, ["과학 경진 대회", "科学コンテスト", "The Science Fair"], ["과학 경진 대회에 나갈 주제를 골라야 한다.", "科学コンテストに出るテーマを選ばなければ。", "You need a topic for the science fair."], [
  ["volcano", "🌋", ["화산 폭발 모형", "火山噴火の模型", "A volcano model"], { effects: { happy: 4, intel: 2 }, n: ["거품이 심사위원 신발까지 튀었다. 장려상을 받았다.", "泡が審査員の靴まで飛んだ。奨励賞をもらった。", "The foam splashed a judge's shoes. Honorable mention."] }],
  ["original", "💡", ["직접 궁금한 걸 실험한다", "自分の疑問を実験する", "Test something you're genuinely curious about"], { outcomes: [
    { chance: 0.45, grade: "crit", effects: { intel: 6, happy: 6 }, flag: { add: "science_award" }, n: ["'어떤 음악을 들으면 식물이 잘 자랄까' — 금상이었다.", "「どんな音楽を聞くと植物はよく育つか」— 金賞だった。", "'What music makes plants grow best?' — First prize."] },
    { chance: 0.55, grade: "good", effects: { intel: 4, happy: 2 }, n: ["결과는 '차이 없음'이었다. 그래도 그게 과학이라고 선생님이 말했다.", "結果は「差なし」だった。それでもそれが科学だと先生は言った。", "Result: no difference. My teacher said that's science too."] }] }],
]);
S("math_struggle", { age: [10, 17], emoji: "➗", scene: "classroom" }, ["수학이 막혔다", "数学で詰まった", "Stuck on Math"], ["분수부터 모르겠다. 진도는 계속 나간다.", "分数から分からない。授業はどんどん進む。", "You got lost at fractions, and the class keeps moving on."], [
  ["ask", "🙋", ["선생님께 따로 질문한다", "先生に個別に質問する", "Ask the teacher one-on-one"], { grade: "good", effects: { intel: 4, happy: 2 }, n: ["방과 후 30분씩 세 번. 갑자기 다 이해됐다.", "放課後三十分を三回。突然全部分かった。", "Three thirty-minute sessions after school. Suddenly it all clicked."] }],
  ["friend", "👫", ["잘하는 친구에게 배운다", "得意な友達に教わる", "Learn from a friend who gets it"], { grade: "good", effects: { intel: 3, social: 2 }, n: ["친구는 선생님보다 쉽게 설명했다.", "友達は先生より分かりやすく説明してくれた。", "My friend explained it better than the teacher."] }],
  ["give", "🏳️", ["수학은 포기한다", "数学は諦める", "Give up on math"], { grade: "bad", effects: { intel: -2, happy: 1 }, n: ["한동안 편했다. 나중에 계산이 필요할 때마다 그날이 생각났다.", "しばらくは楽だった。後で計算が必要になるたびにあの日を思い出した。", "Easy for a while. Later, every time I needed math, I remembered that day."] }],
]);
S("cheating_chance", { age: [12, 20], emoji: "👀", scene: "classroom" }, ["커닝의 유혹", "カンニングの誘惑", "Tempted to Cheat"], ["시험 중, 앞자리 친구 답안지가 훤히 보인다.", "試験中、前の席の子の答案が丸見えだ。", "During the test, the answer sheet in front of you is in plain sight."], [
  ["own", "✏️", ["내 실력으로 푼다", "自分の力で解く", "Solve it yourself"], { grade: "good", effects: { intel: 1, happy: 2 }, flag: { add: "honest" }, n: ["점수는 평범했지만 떳떳했다.", "点数は普通だったが、胸を張れた。", "An average score, but an honest one."] }],
  ["peek", "🙊", ["슬쩍 본다", "ちらっと見る", "Sneak a look"], { outcomes: [
    { chance: 0.6, grade: "bad", effects: { happy: -2 }, flag: { add: "small_lie" }, n: ["점수는 올랐다. 그런데 그 점수가 기쁘지 않았다.", "点数は上がった。でもその点数は嬉しくなかった。", "My score went up. It didn't feel good."] },
    { chance: 0.4, grade: "bad", effects: { happy: -6, social: -3 }, n: ["선생님에게 걸렸다. 0점과 함께 부모님 상담.", "先生に見つかった。0点と親の呼び出し。", "Caught. A zero and a parent conference."] }] }],
]);
S("field_trip", { age: [8, 15], emoji: "🚌", scene: "abroad" }, ["현장 체험 학습", "校外学習", "The Field Trip"], ["박물관 견학을 갔다. 친구들은 기념품 가게에만 관심이 있다.", "博物館見学に行った。友達はお土産屋にしか興味がない。", "A museum field trip. Your friends only care about the gift shop."], [
  ["exhibit", "🏛️", ["전시를 꼼꼼히 본다", "展示をじっくり見る", "Study the exhibits"], { grade: "good", effects: { intel: 4, happy: 2 }, n: ["공룡 뼈 앞에서 한참 서 있었다. 그날 고고학자가 꿈이 됐다.", "恐竜の骨の前で長く立っていた。その日、考古学者が夢になった。", "I stood in front of the dinosaur bones for ages. Archaeology became my dream that day."] }],
  ["shop", "🎁", ["기념품 가게로", "お土産屋へ", "Head to the gift shop"], { effects: { happy: 4, money: -5, social: 2 }, n: ["친구들과 똑같은 열쇠고리를 샀다.", "友達とお揃いのキーホルダーを買った。", "Bought matching keychains with friends."] }],
]);
S("homework_forget", { age: [8, 16], emoji: "📒", scene: "classroom" }, ["숙제를 안 해 왔다", "宿題を忘れた", "Forgot Your Homework"], ["아침에 생각났다. 숙제를 안 했다.", "朝になって思い出した。宿題をやっていない。", "You remember in the morning: you didn't do your homework."], [
  ["honest", "🙇", ["솔직하게 말한다", "正直に言う", "Admit it"], { grade: "good", effects: { social: 1, intel: 1 }, n: ["벌로 청소를 했다. 그 뒤로 알림장을 꼭 확인했다.", "罰で掃除をした。それ以来、連絡帳を必ず確認した。", "Cleaning duty as punishment. After that, I always checked my planner."] }],
  ["rush", "✍️", ["쉬는 시간에 급하게 한다", "休み時間に急いでやる", "Rush it during break"], { effects: { intel: 1, happy: -1 }, n: ["글씨가 엉망이었다. 그래도 냈다.", "字がめちゃくちゃだった。それでも出した。", "Messy handwriting, but I turned it in."] }],
]);
S("school_band", { age: [10, 18], emoji: "🎺", scene: "musicRoom" }, ["학교 밴드부", "吹奏楽部", "The School Band"], ["밴드부에서 트럼펫 자리가 하나 비었다고 한다.", "吹奏楽部でトランペットの席が一つ空いたという。", "The school band has an open trumpet spot."], [
  ["join", "🎺", ["들어간다", "入る", "Join"], { grade: "good", effects: { happy: 5, social: 4, intel: 1 }, flag: { add: "band" }, n: ["처음엔 코끼리 소리가 났다. 졸업 공연에선 솔로를 했다.", "最初は象の鳴き声みたいだった。卒業公演ではソロを吹いた。", "I sounded like an elephant at first. At the graduation concert, I played a solo."] }],
  ["no", "🙅", ["연습이 힘들 것 같다", "練習が大変そう", "Practice seems too hard"], { effects: { happy: 1 }, n: ["운동장에서 밴드 연습 소리를 들었다.", "校庭で吹奏楽の練習の音を聞いた。", "I listened to the band practice from the field."] }],
]);
S("library_card", { age: [7, 14], emoji: "📚", scene: "library" }, ["도서관 대출 카드", "図書館カード", "Your Library Card"], ["처음으로 내 이름으로 된 도서관 카드를 만들었다.", "初めて自分名義の図書館カードを作った。", "You get your very own library card."], [
  ["many", "📖", ["한도까지 빌린다", "上限まで借りる", "Borrow the maximum"], { grade: "good", effects: { intel: 5, happy: 3 }, flag: { add: "bookworm" }, n: ["무거워서 엄마가 들어 줬다. 일주일 만에 다 읽었다.", "重くて母が持ってくれた。一週間で全部読んだ。", "So heavy Mom had to carry them. I read them all in a week."] }],
  ["comic", "🗯️", ["만화책만 빌린다", "漫画だけ借りる", "Borrow only comics"], { effects: { intel: 2, happy: 4 }, n: ["그래도 글자 읽는 게 빨라졌다.", "それでも字を読むのが速くなった。", "Still, my reading got faster."] }],
]);
S("sports_day", { age: [7, 15], emoji: "🏃", scene: "field" }, ["운동회 계주", "運動会のリレー", "Sports Day Relay"], ["운동회 계주 마지막 주자로 뽑혔다.", "運動会のリレーでアンカーに選ばれた。", "You've been picked as the anchor for the sports day relay."], [
  ["run", "🔥", ["전력 질주", "全力疾走", "Sprint all out"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { happy: 7, social: 4, power: 2 }, n: ["두 명을 제치고 1등으로 들어왔다. 반 전체가 나를 들어 올렸다.", "二人を抜いて一位でゴールした。クラス全員に胴上げされた。", "Passed two runners and finished first. The whole class lifted me up."] },
    { chance: 0.5, grade: "mid", effects: { happy: -1, power: 2, social: 2 }, n: ["바통을 떨어뜨렸다. 친구들이 '괜찮아'를 외쳤다.", "バトンを落とした。友達が「大丈夫」と叫んだ。", "I dropped the baton. My friends shouted, 'It's okay!'"] }] }],
  ["swap", "🤝", ["더 빠른 친구에게 양보한다", "もっと速い友達に譲る", "Give the spot to a faster friend"], { effects: { social: 3, happy: 1 }, n: ["친구가 이겼다. 나는 제일 크게 응원했다.", "友達が勝った。私は一番大きな声で応援した。", "My friend won. I cheered the loudest."] }],
]);
S("school_play_lead", { age: [10, 18], emoji: "🎭", scene: "stage" }, ["연극 주인공", "劇の主役", "The Lead in the School Play"], ["학교 연극 주인공 오디션이 있다.", "学校劇の主役オーディションがある。", "Auditions are open for the lead in the school play."], [
  ["audition", "🎤", ["오디션을 본다", "オーディションを受ける", "Audition"], { outcomes: [
    { chance: 0.45, grade: "crit", effects: { happy: 7, social: 4, internet: 1 }, flag: { add: "drama_club" }, n: ["주인공이 됐다. 공연 날 커튼콜에서 다리가 떨렸다.", "主役になった。公演の日、カーテンコールで足が震えた。", "I got the lead. At the curtain call, my legs were shaking."] },
    { chance: 0.55, grade: "good", effects: { happy: 2, social: 3 }, n: ["나무 1 역할이었다. 세상에서 가장 열정적인 나무였다.", "木その一の役だった。世界一情熱的な木だった。", "I was Tree #1 — the most passionate tree in history."] }] }],
  ["crew", "🔦", ["조명 담당", "照明係", "Run the lights"], { effects: { intel: 2, happy: 3 }, n: ["무대가 내 손끝에서 밝아지고 어두워졌다.", "舞台が私の指先で明るくなったり暗くなったりした。", "The stage brightened and dimmed at my fingertips."] }],
]);
S("exchange_student", { age: [15, 22], emoji: "🌍", scene: "airport", fromYear: 1960 }, ["교환 학생", "交換留学", "Exchange Student"], ["1년 동안 외국 학교에 다닐 교환 학생 모집 공고가 붙었다.", "一年間外国の学校に通う交換留学の募集が貼り出された。", "A notice: apply to study abroad as an exchange student for a year."], [
  ["apply", "✈️", ["지원한다", "応募する", "Apply"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { intel: 5, social: 5, happy: 6, money: -200 }, flag: { add: ["abroad", "exchange_student"] }, n: ["처음 석 달은 말이 안 통했다. 마지막 날엔 호스트 가족과 울며 헤어졌다.", "最初の三か月は言葉が通じなかった。最後の日、ホストファミリーと泣いて別れた。", "The first three months, no one understood me. On the last day, I cried saying goodbye to my host family."] },
    { chance: 0.5, grade: "mid", effects: { happy: -2, intel: 1 }, n: ["떨어졌다. 대신 그 나라 말을 혼자 공부하기 시작했다.", "落ちた。代わりにその国の言葉を独学し始めた。", "Didn't make it. I started learning the language on my own."] }] }],
  ["no", "🏠", ["가족 곁이 좋다", "家族のそばがいい", "Stay near family"], { effects: { happy: 1 }, n: ["교환 학생 친구의 엽서를 받았다.", "留学した友達から絵葉書が届いた。", "I got postcards from a friend who went."] }],
]);
S("study_group", { age: [14, 24], emoji: "📝", scene: "library" }, ["스터디 모임", "勉強会", "A Study Group"], ["시험 기간, 친구들이 같이 공부하자고 한다.", "試験期間、友達が一緒に勉強しようと言う。", "It's exam season. Friends want to study together."], [
  ["focus", "📚", ["진짜 공부만 한다", "本当に勉強だけする", "Actually study"], { grade: "good", effects: { intel: 4, social: 2 }, n: ["서로 문제를 내 주며 외웠다. 다 같이 성적이 올랐다.", "互いに問題を出し合って覚えた。みんな成績が上がった。", "We quizzed each other. Everyone's grades went up."] }],
  ["chat", "🍕", ["수다가 더 길다", "おしゃべりの方が長い", "Spend more time chatting"], { effects: { social: 4, happy: 3, intel: 1 }, n: ["공부는 반, 피자는 전부였다.", "勉強は半分、ピザは全部だった。", "Half studying, all pizza."] }],
]);
S("teacher_favorite", { age: [9, 18], emoji: "🍎", scene: "classroom" }, ["나를 믿어 준 선생님", "信じてくれた先生", "A Teacher Who Believed in You"], ["선생님이 '너는 글을 잘 쓰는구나'라며 대회 참가를 권한다.", "先生が「文章が上手だね」とコンテストへの参加を勧める。", "A teacher says, 'You're a good writer,' and encourages you to enter a contest."], [
  ["enter", "✍️", ["나가 본다", "出てみる", "Enter"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { intel: 4, happy: 7 }, flag: { add: "writing_award" }, n: ["상을 받았다. 선생님이 나보다 더 기뻐했다.", "賞をもらった。先生が私より喜んだ。", "I won. My teacher was happier than I was."] },
    { chance: 0.5, grade: "good", effects: { intel: 3, happy: 2 }, n: ["상은 못 받았지만 선생님이 내 글에 긴 편지를 써 주셨다.", "賞は取れなかったが、先生が私の作文に長い手紙を書いてくれた。", "No prize, but my teacher wrote me a long letter about my piece."] }] }],
  ["shy", "🙈", ["자신이 없다", "自信がない", "Not confident enough"], { effects: { happy: -1 }, n: ["선생님은 '언제든 생각이 바뀌면 말해'라고 했다.", "先生は「気が変わったらいつでも言って」と言った。", "My teacher said, 'Tell me if you change your mind.'"] }],
]);
S("school_uniform_rule", { age: [12, 18], emoji: "👔", scene: "classroom", fromYear: 1950 }, ["복장 규정", "服装規定", "The Dress Code"], ["학교가 머리 길이와 양말 색까지 정해 놓았다.", "学校が髪の長さや靴下の色まで決めている。", "The school even dictates hair length and sock color."], [
  ["petition", "📝", ["학생회에 바꾸자고 건의한다", "生徒会に変えようと提案する", "Petition the student council to change it"], { grade: "good", effects: { social: 4, intel: 2, power: 1 }, n: ["1년 걸렸다. 양말 규정이 없어졌다. 작은 승리였다.", "一年かかった。靴下の規定がなくなった。小さな勝利だった。", "It took a year, but the sock rule was dropped. A small victory."] }],
  ["follow", "✅", ["그냥 지킨다", "そのまま守る", "Just follow it"], { effects: { happy: -1 }, n: ["졸업 날 양말을 무지개색으로 신었다.", "卒業の日、靴下を虹色にした。", "On graduation day, I wore rainbow socks."] }],
]);
S("coding_class", { age: [10, 18], emoji: "💻", scene: "lab", fromYear: 1985 }, ["첫 코딩 수업", "はじめてのプログラミング授業", "Your First Coding Class"], ["컴퓨터 시간에 화면에 '안녕'을 띄우는 법을 배웠다.", "コンピューターの時間に画面に「こんにちは」を出す方法を習った。", "In computer class, you learn to make the screen say 'Hello.'"], [
  ["more", "⌨️", ["집에서 더 해 본다", "家でもっとやってみる", "Keep going at home"], { grade: "good", effects: { intel: 4, internet: 3 }, flag: { add: "coder_kid" }, n: ["밤새 간단한 게임을 만들었다. 동생이 첫 번째 사용자였다.", "一晩で簡単なゲームを作った。弟妹が最初のユーザーだった。", "I made a simple game overnight. My little sibling was the first player."] }],
  ["enough", "😐", ["재미는 있었다", "面白くはあった", "It was fun enough"], { effects: { intel: 1 }, n: ["가끔 그때 배운 걸 써먹었다.", "時々その時習ったことを使った。", "I used what I learned now and then."] }],
]);
S("career_day", { age: [13, 18], emoji: "👩‍🚒", scene: "classroom" }, ["직업 체험의 날", "職業体験の日", "Career Day"], ["직업 체험 날, 하루 동안 일해 볼 곳을 골라야 한다.", "職業体験の日、一日働いてみる場所を選ぶ。", "On career day, you pick a workplace to try for a day."], [
  ["fire", "🚒", ["소방서", "消防署", "The fire station"], { effects: { power: 2, happy: 4, social: 1 }, n: ["소방관이 헬멧을 씌워 줬다. 사진을 오래 간직했다.", "消防士がヘルメットをかぶせてくれた。写真を長く大事にした。", "A firefighter put their helmet on me. I kept that photo for years."] }],
  ["hospital", "🏥", ["병원", "病院", "A hospital"], { effects: { intel: 2, happy: 3 }, n: ["간호사의 하루가 생각보다 바빴다.", "看護師の一日は思ったより忙しかった。", "A nurse's day was busier than I imagined."] }],
  ["office", "🏢", ["방송국", "放送局", "A TV station"], { effects: { internet: 2, happy: 4 }, n: ["카메라 뒤가 앞보다 더 멋있었다.", "カメラの後ろの方が前よりかっこよかった。", "Behind the camera was cooler than in front of it."] }],
]);
S("bullied_study", { age: [12, 18], emoji: "🛡️", scene: "classroom" }, ["성적이 떨어졌다", "成績が落ちた", "Your Grades Dropped"], ["요즘 집중이 안 된다. 성적표를 보니 많이 떨어졌다.", "最近集中できない。成績表を見るとかなり下がった。", "You can't focus lately. Your report card shows a big drop."], [
  ["talk", "🗣️", ["상담 선생님과 이야기한다", "スクールカウンセラーと話す", "Talk to the school counselor"], { grade: "good", effects: { happy: 4, intel: 2 }, n: ["무엇이 나를 괴롭히는지 처음으로 말로 꺼냈다. 다음 학기에 회복했다.", "何が自分を苦しめているか初めて言葉にした。次の学期に回復した。", "For the first time, I put into words what was bothering me. I bounced back next term."] }],
  ["cram", "📚", ["밤새 공부해서 만회한다", "徹夜で挽回する", "Pull all-nighters to catch up"], { effects: { intel: 3, health: -3 }, n: ["성적은 올랐다. 몸이 먼저 지쳤다.", "成績は上がった。体が先に疲れた。", "My grades rose. My body gave out first."] }],
]);
S("graduation_speech", { age: [14, 23], emoji: "🎓", scene: "graduation" }, ["졸업식 답사", "卒業式の答辞", "The Graduation Speech"], ["졸업식에서 대표로 답사를 읽게 됐다.", "卒業式で代表として答辞を読むことになった。", "You've been chosen to give the graduation speech."], [
  ["heart", "💬", ["직접 쓴 글을 읽는다", "自分で書いた文を読む", "Read something you wrote yourself"], { grade: "crit", effects: { happy: 7, social: 4, intel: 1 }, n: ["선생님들 몇 분이 눈물을 훔쳤다.", "何人かの先生が涙をぬぐった。", "A few teachers wiped away tears."] }],
  ["standard", "📜", ["예년 원고대로 읽는다", "例年の原稿通りに読む", "Read the standard script"], { effects: { happy: 3, social: 2 }, n: ["무사히 끝났다. 학부모들이 박수를 쳤다.", "無事に終わった。保護者が拍手した。", "It went smoothly. The parents applauded."] }],
]);
S("major_choice", { age: [18, 21], emoji: "🧭", scene: "campus" }, ["전공 선택", "専攻選び", "Choosing a Major"], ["부모님은 취업 잘 되는 과를, 마음은 다른 과를 원한다.", "親は就職に有利な学科を、心は別の学科を望んでいる。", "Your parents want a practical major. Your heart wants something else."], [
  ["heart", "❤️", ["하고 싶은 걸 고른다", "やりたいことを選ぶ", "Follow your heart"], { grade: "good", effects: { happy: 6, intel: 2 }, flag: { add: "passion_major" }, n: ["수업이 즐거웠다. 부모님도 결국 내 졸업 작품을 자랑하고 다녔다.", "授業が楽しかった。両親も結局私の卒業制作を自慢して回った。", "I loved my classes. Eventually my parents bragged about my thesis."] }],
  ["safe", "🛡️", ["취업이 잘 되는 과", "就職に有利な学科", "Choose the practical one"], { effects: { intel: 3, money: 100, happy: -1 }, n: ["졸업하자마자 취업했다. 가끔 다른 과 수업을 몰래 들었다.", "卒業してすぐ就職した。時々他学科の授業にこっそり出た。", "Got a job right after graduation. Sometimes I snuck into other departments' lectures."] }],
  ["double", "🔀", ["복수 전공", "ダブルメジャー", "Double major"], { effects: { intel: 4, health: -2, happy: 1 }, n: ["두 배로 바빴다. 두 배로 많이 알게 됐다.", "倍忙しかった。倍多くを知った。", "Twice as busy. Twice as much learned."] }],
]);
S("dorm_allnighter", { age: [18, 25], emoji: "☕", scene: "dorm" }, ["밤샘 과제", "徹夜の課題", "The All-Nighter"], ["과제 마감이 내일 아침 9시다. 아직 반도 못 했다.", "課題の締め切りは明朝九時。まだ半分もできていない。", "The assignment is due at 9 a.m. You're not even halfway done."], [
  ["finish", "💪", ["밤을 새워 끝낸다", "徹夜で仕上げる", "Pull an all-nighter and finish"], { grade: "good", effects: { intel: 3, health: -2 }, n: ["8시 59분에 제출했다. 그대로 기숙사 침대에 쓰러졌다.", "八時五十九分に提出した。そのまま寮のベッドに倒れ込んだ。", "Submitted at 8:59. Collapsed straight onto my dorm bed."] }],
  ["extend", "📧", ["교수님께 연장을 부탁한다", "教授に延長を頼む", "Ask the professor for an extension"], { outcomes: [
    { chance: 0.5, grade: "good", effects: { intel: 2, health: 1 }, n: ["하루를 더 받았다. 더 나은 과제를 냈다.", "一日延長してもらった。もっといい課題を出せた。", "Got one more day. Turned in better work."] },
    { chance: 0.5, grade: "mid", effects: { intel: 1, happy: -2 }, n: ["안 된다고 했다. 반쪽짜리를 냈다.", "だめだと言われた。半分の出来で出した。", "No extension. I turned in half."] }] }],
]);
S("scholarship_exam", { age: [16, 24], emoji: "🏅", scene: "classroom" }, ["장학생 선발 시험", "奨学生選抜試験", "Scholarship Exam"], ["전액 장학금이 걸린 시험이 있다.", "全額奨学金がかかった試験がある。", "There's an exam for a full scholarship."], [
  ["prepare", "📚", ["석 달 준비한다", "三か月準備する", "Prepare for three months"], { outcomes: [
    { chance: 0.45, grade: "crit", effects: { money: 800, intel: 4, happy: 7 }, flag: { add: "scholar" }, n: ["합격 전화를 받고 부모님이 아무 말도 못 하셨다.", "合格の電話に、両親は言葉も出なかった。", "When the call came, my parents couldn't say a word."] },
    { chance: 0.55, grade: "mid", effects: { intel: 3, happy: -2 }, n: ["아깝게 떨어졌다. 공부한 건 남았다.", "惜しくも落ちた。勉強したことは残った。", "Just missed it. The studying stayed with me."] }] }],
  ["skip", "🙅", ["알바를 늘린다", "バイトを増やす", "Work more part-time instead"], { effects: { money: 200, intel: -1 }, n: ["통장은 늘었고 시간은 줄었다.", "通帳は増え、時間は減った。", "More money, less time."] }],
]);
S("dropout_thought", { age: [18, 25], emoji: "🚪", scene: "campus" }, ["학교를 그만둘까", "学校を辞めようか", "Thinking of Dropping Out"], ["학교 공부가 나와 맞지 않는 것 같다. 하고 싶은 일이 따로 있다.", "学校の勉強が自分に合わない気がする。やりたいことが別にある。", "School doesn't feel right. There's something else you want to do."], [
  ["leave", "🛤️", ["그만두고 내 길을 간다", "辞めて自分の道を行く", "Drop out and follow your own path"], { outcomes: [
    { chance: 0.45, grade: "good", effects: { happy: 6, intel: 1 }, flag: { add: "dropout" }, n: ["불안했지만 매일이 내 것이었다.", "不安だったが、毎日が自分のものだった。", "Anxious, but every day was mine."] },
    { chance: 0.55, grade: "mid", effects: { happy: -3, money: -100 }, flag: { add: "dropout" }, n: ["생각보다 어려웠다. 몇 년 뒤 다시 학교로 돌아갔다.", "思ったより難しかった。数年後また学校に戻った。", "Harder than I thought. Years later, I went back to school."] }] }],
  ["finish", "🎓", ["일단 졸업은 한다", "とりあえず卒業はする", "Finish the degree first"], { effects: { intel: 2, happy: -1 }, flag: { add: "college_done" }, n: ["졸업장을 받고 그날 바로 하고 싶던 일을 시작했다.", "卒業証書をもらって、その日すぐにやりたかったことを始めた。", "Diploma in hand, I started what I really wanted that very day."] }],
]);
S("language_study", { age: [12, 70], emoji: "🗣️", scene: "library" }, ["외국어 공부", "外国語の勉強", "Learning a Language"], ["좋아하는 노래 가사를 알아듣고 싶어 외국어 공부를 시작할까.", "好きな歌の歌詞を理解したくて、外国語の勉強を始めようか。", "You want to understand your favorite song's lyrics — time to learn the language?"], [
  ["daily", "📅", ["매일 30분씩", "毎日三十分ずつ", "Thirty minutes every day"], { grade: "good", effects: { intel: 4, happy: 3 }, flag: { add: "bilingual" }, n: ["1년 뒤 그 노래를 자막 없이 따라 불렀다.", "一年後、その歌を字幕なしで歌えた。", "A year later, I sang along without subtitles."] }],
  ["app", "📱", ["앱으로 가볍게", "アプリで軽く", "Casually with an app"], { effects: { intel: 2, happy: 1 }, n: ["연속 학습 기록이 87일에서 끊겼다.", "連続学習記録が87日で途切れた。", "My streak broke at 87 days."] }],
]);
S("adult_education", { age: [30, 65], emoji: "🎒", scene: "classroom" }, ["야간 강좌", "夜間講座", "Night Classes"], ["일 끝나고 다닐 수 있는 야간 강좌가 열렸다.", "仕事帰りに通える夜間講座が開かれた。", "Night classes open up — you could go after work."], [
  ["enroll", "📝", ["등록한다", "申し込む", "Enroll"], { grade: "good", effects: { intel: 4, happy: 3, health: -1 }, n: ["20대 학생들 사이에서 가장 열심히 필기했다.", "二十代の学生に交じって一番熱心にノートを取った。", "Among students in their twenties, I took the most diligent notes."] }],
  ["later", "⏰", ["피곤해서 다음에", "疲れているので次に", "Too tired — maybe later"], { effects: { health: 1 }, n: ["강좌 안내문을 다음 학기에도 받았다.", "講座の案内を次の学期にも受け取った。", "I got the course flyer again the next term."] }],
]);
S("thesis", { age: [21, 35], emoji: "📑", scene: "library", cond: (p) => ["college", "grad"].includes(p.edu) || p.flags?.has?.("college_done") }, ["졸업 논문", "卒業論文", "Your Thesis"], ["졸업 논문 주제를 정해야 한다.", "卒業論文のテーマを決めなければ。", "You need to choose a thesis topic."], [
  ["ambitious", "🔭", ["아무도 안 해 본 주제", "誰もやっていないテーマ", "Something no one's done before"], { outcomes: [
    { chance: 0.5, grade: "crit", effects: { intel: 6, happy: 5 }, flag: { add: "thesis_award" }, n: ["교수님이 학회 발표를 권했다.", "教授が学会発表を勧めた。", "My professor urged me to present it at a conference."] },
    { chance: 0.5, grade: "mid", effects: { intel: 3, health: -2 }, n: ["자료가 부족해 고생했다. 그래도 끝냈다.", "資料が足りず苦労した。それでも書き上げた。", "Not enough sources. A struggle, but I finished."] }] }],
  ["safe", "📘", ["무난한 주제", "無難なテーマ", "A safe topic"], { effects: { intel: 3, happy: 1 }, n: ["무사히 통과했다.", "無事に通った。", "Passed without trouble."] }],
]);
S("school_reform_era", { age: [7, 15], emoji: "🏫", scene: "classroom", era: ["early", "past"], calYear: [1946, 1970] }, ["콩나물 교실", "すし詰め教室", "The Packed Classroom"], ["한 반에 일흔 명이 넘는다. 오전반과 오후반으로 나뉘어 수업한다.", "一クラス七十人以上。午前と午後の二部制で授業をする。", "Over seventy kids per class. School runs in morning and afternoon shifts."], [
  ["front", "🙋", ["맨 앞자리를 차지한다", "最前列を確保する", "Grab a front-row seat"], { grade: "good", effects: { intel: 3, power: 1 }, n: ["칠판이 잘 보였다. 선생님이 내 이름을 기억했다.", "黒板がよく見えた。先生が私の名前を覚えてくれた。", "I could see the board. The teacher learned my name."] }],
  ["friends", "👫", ["친구들과 뒷자리에서", "友達と後ろの席で", "Sit in back with friends"], { effects: { social: 3, happy: 3 }, n: ["도시락을 나눠 먹으며 친해졌다.", "弁当を分け合って仲良くなった。", "We bonded over shared lunch boxes."] }],
]);
S("online_school", { age: [7, 18], emoji: "💻", scene: "kidroom", calYear: [2020, 2021] }, ["온라인 수업", "オンライン授業", "Online School"], ["학교 대신 화면으로 수업을 듣는다. 카메라를 꺼도 된다고 한다.", "学校の代わりに画面で授業を受ける。カメラを切ってもいいという。", "Classes are on a screen now. You're allowed to turn your camera off."], [
  ["on", "📹", ["카메라를 켜고 집중한다", "カメラをオンにして集中する", "Camera on, stay focused"], { grade: "good", effects: { intel: 3, social: 1 }, n: ["선생님이 내 이름을 자주 불렀다. 덕분에 버텼다.", "先生がよく私の名前を呼んだ。おかげで乗り切れた。", "The teacher called on me often. It kept me going."] }],
  ["off", "📴", ["끄고 게임한다", "オフにしてゲームする", "Camera off, gaming on"], { grade: "bad", effects: { intel: -2, happy: 3 }, n: ["등교 첫날 진도를 하나도 몰랐다.", "登校初日、授業の進みが全然分からなかった。", "On the first day back, I had no idea where we were."] }],
]);
S("tutor_or_self", { age: [13, 18], emoji: "📗", scene: "library" }, ["학원이냐 혼자냐", "塾か独学か", "Tutoring or Self-Study?"], ["친구들은 다 학원에 다닌다. 나는 어떻게 할까.", "友達はみんな塾に通っている。自分はどうしよう。", "All your friends go to cram school. What about you?"], [
  ["self", "🧠", ["혼자 계획을 세워 공부한다", "自分で計画を立てて勉強する", "Make your own study plan"], { grade: "good", effects: { intel: 4, happy: 1, money: 30 }, flag: { add: "self_study" }, n: ["스스로 공부하는 법을 알게 됐다. 대학에서 그게 가장 쓸모 있었다.", "自分で勉強する方法を身につけた。大学でそれが一番役立った。", "I learned how to teach myself. That mattered most in college."] }],
  ["academy", "🏫", ["학원에 다닌다", "塾に通う", "Go to cram school"], { effects: { intel: 3, money: -100, happy: -1, social: 2 }, n: ["밤 열 시 학원 버스에서 친구들과 졸았다.", "夜十時の塾のバスで友達と居眠りした。", "We dozed together on the 10 p.m. cram school bus."] }],
]);
S("history_class_question", { age: [12, 18], emoji: "📜", scene: "classroom" }, ["역사 시간의 질문", "歴史の時間の質問", "A Question in History Class"], ["역사 시간, 교과서 내용이 이해되지 않아 손을 들까 망설인다.", "歴史の時間、教科書の内容が腑に落ちず手を挙げるか迷う。", "In history class, something in the textbook doesn't add up. Raise your hand?"], [
  ["ask", "🙋", ["질문한다", "質問する", "Ask"], { grade: "good", effects: { intel: 3, social: 1 }, n: ["선생님이 수업을 멈추고 토론을 열었다. 그 시간이 가장 기억에 남았다.", "先生が授業を止めて討論を始めた。その時間が一番記憶に残った。", "The teacher paused the lesson and opened a debate. The most memorable class ever."] }],
  ["search", "🔍", ["나중에 혼자 찾아본다", "後で自分で調べる", "Look it up later on your own"], { effects: { intel: 2 }, n: ["도서관에서 책 세 권을 찾아 읽었다.", "図書館で本を三冊探して読んだ。", "I found and read three books in the library."] }],
]);
S("grad_school", { age: [22, 35], emoji: "🎓", scene: "campus", cond: (p) => ["college"].includes(p.edu) }, ["대학원 진학", "大学院進学", "Grad School"], ["교수님이 대학원에 와서 연구를 계속하라고 권한다.", "教授が大学院に来て研究を続けろと勧める。", "Your professor urges you to continue in graduate school."], [
  ["go", "🔬", ["진학한다", "進学する", "Go"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { intel: 6, happy: 3, money: -300 }, flag: { add: "grad_degree" }, n: ["논문 마지막 장에 가족 이름을 적었다.", "論文の最後のページに家族の名前を書いた。", "I wrote my family's names on the last page of my dissertation."] },
    { chance: 0.4, grade: "mid", effects: { intel: 3, happy: -3, money: -300 }, n: ["실험이 3년째 실패했다. 그래도 많이 배웠다.", "実験が三年失敗し続けた。それでも多くを学んだ。", "Three years of failed experiments. I still learned a lot."] }] }],
  ["work", "💼", ["바로 취업한다", "すぐ就職する", "Go straight to work"], { effects: { money: 300, happy: 1 }, n: ["가끔 연구실 사람들 소식을 들었다.", "時々研究室の人たちの消息を聞いた。", "I heard news from the lab now and then."] }],
]);

export const YOUNG_EVENTS = EV;
