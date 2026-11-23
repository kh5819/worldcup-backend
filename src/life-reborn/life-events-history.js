// =========================
// 플듀 인생게임 REBORN — 역사 속 개인 사건 (한국 1900~2026) (2026-11-23)
// 실제 역사(life-history.js) 그 시기에, 그 일에 영향을 받을 만한 사람에게만 나오는 '가상의 개인 선택'.
// 역사 자체(연도·사실)는 바꾸지 않는다. 선택과 결과는 이 사람 인생의 가상 이야기다.
// meta: country · calYear[시작,끝] · age · hist(관련 역사 사건 id) · area · scene(장면 장소) · cond
// 형식: life-ev-kit.js 의 ev() (한국어 원문 + 일본어·영어)
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const H = (id, meta, title, desc, choices) => EV.push(ev("hk_" + id, { country: ["KR"], area: "world", weight: 2.2, prio: 0.35, ...meta }, title, desc, choices));
const rural = (p) => ["jeolla", "chungcheong", "gangwon", "gyeongsang", "jeju"].includes(p.region);

// ---------- 일제강점기 ----------
H("night_school", { calYear: [1920, 1937], age: [8, 30], hist: "h_kr_1920", scene: "classroom", emoji: "🕯️" }, ["야학", "夜学", "Night School"], ["동네 사랑방에서 밤마다 한글을 가르친다는 소문이 돌았다.", "村の離れで毎晩ハングルを教えているという噂が流れた。", "Word spreads that someone teaches Hangul every night in a village room."], [
  ["go", "📖", ["몰래 다닌다", "こっそり通う", "Sneak in and attend"], { grade: "good", effects: { intel: 6, social: 2 }, flag: { add: "literate" }, n: ["호롱불 아래서 처음으로 내 이름을 썼다.", "ランプの下で初めて自分の名前を書いた。", "By lamplight, I wrote my own name for the first time."] }],
  ["work", "🌾", ["일손이 모자라 못 간다", "人手が足りず行けない", "Too much work to go"], { effects: { power: 2, happy: -2 }, n: ["밤에도 새끼를 꼬았다. 글은 다음 생에 배우기로 했다.", "夜も縄をなった。字は来世で習うことにした。", "I twisted straw rope late into the night. Letters would have to wait."] }],
]);
H("manse", { calYear: [1919, 1919], age: [12, 70], hist: "h_kr_1919", scene: "market", emoji: "🇰🇷" }, ["장터의 만세 소리", "市場の万歳", "Cheers in the Marketplace"], ["장날, 누군가 품에서 태극기를 꺼냈다. 사람들이 웅성이기 시작했다.", "市の日、誰かが懐から太極旗を取り出した。人々がざわめき始めた。", "On market day, someone pulls a flag from their coat. The crowd begins to stir."], [
  ["shout", "📣", ["함께 만세를 부른다", "一緒に万歳を叫ぶ", "Join the cheers"], { outcomes: [
    { chance: 0.6, grade: "good", effects: { social: 5, happy: 4 }, flag: { add: "manse_1919" }, n: ["목이 쉬도록 외쳤다. 그날의 함성은 평생 귀에 남았다.", "声が枯れるまで叫んだ。あの日の歓声は一生耳に残った。", "I shouted until I was hoarse. That roar stayed with me for life."] },
    { chance: 0.4, grade: "bad", effects: { health: -6, happy: -2, social: 4 }, flag: { add: "manse_1919" }, n: ["끌려가 며칠을 갇혀 있었다. 그래도 후회하지 않았다.", "連行され数日閉じ込められた。それでも後悔しなかった。", "I was taken and held for days. I didn't regret it."] }] }],
  ["home", "🏠", ["가족을 데리고 집으로 간다", "家族を連れて家に帰る", "Take the family home"], { effects: { happy: -1 }, n: ["창호지 너머로 만세 소리가 밤늦게까지 들렸다.", "障子越しに万歳の声が夜遅くまで聞こえた。", "Through the paper doors, the cheers echoed late into the night."] }],
]);
H("name_change", { calYear: [1940, 1941], age: [10, 80], hist: "h_kr_1940", scene: "home", emoji: "📛" }, ["이름을 바꾸라는 통지", "改名の通知", "Ordered to Change Your Name"], ["면사무소에서 일본식 이름으로 바꾸라는 통지가 왔다. 따르지 않으면 불이익이 있다고 했다.", "役場から日本式の名前に変えるよう通知が来た。従わなければ不利益があるという。", "The local office orders families to adopt Japanese-style names, or face penalties."], [
  ["keep", "✊", ["끝까지 버틴다", "最後まで拒む", "Refuse to the end"], { grade: "good", effects: { happy: 2, money: -80, social: 2 }, flag: { add: "kept_name" }, n: ["배급이 줄었다. 그래도 족보 맨 끝에 내 이름을 그대로 적었다.", "配給が減った。それでも族譜の最後に自分の名前をそのまま書いた。", "Our rations shrank. Still, I wrote my real name at the end of the family register."] }],
  ["comply", "😶", ["가족을 위해 따른다", "家族のために従う", "Comply for the family"], { effects: { happy: -5 }, n: ["새 이름이 적힌 종이를 오래 들여다봤다. 집에서는 원래 이름으로 불렀다.", "新しい名前の紙を長い間見つめた。家では元の名前で呼び合った。", "I stared at the paper with the new name for a long time. At home, we used our real names."] }],
]);
H("mobilized", { calYear: [1939, 1945], age: [17, 40], genderRequired: "M", hist: "h_kr_1938", scene: "countryside", emoji: "🏭" }, ["동원 명단", "動員名簿", "On the Mobilization List"], ["면사무소 게시판에 내 이름이 붙었다. 먼 곳의 탄광과 공장으로 보낸다고 했다.", "役場の掲示板に自分の名前が貼り出された。遠い炭鉱や工場へ送るという。", "My name appears on the office notice board — to be sent to distant mines and factories."], [
  ["hide", "⛰️", ["산으로 숨는다", "山に隠れる", "Hide in the mountains"], { outcomes: [
    { chance: 0.55, grade: "mid", effects: { health: -3, happy: -3 }, n: ["몇 달을 산에서 버텼다. 해방 소식은 산 아래서 들었다.", "何か月も山で耐えた。解放の知らせは山の麓で聞いた。", "I held out in the mountains for months. I heard about liberation at the foot of the hill."] },
    { chance: 0.45, grade: "bad", effects: { health: -9, happy: -6, money: -100 }, flag: { add: "forced_labor" }, n: ["결국 붙잡혀 끌려갔다. 그곳의 일은 오래도록 말하지 않았다.", "結局捕まって連れて行かれた。そこでのことは長い間語らなかった。", "I was caught and taken away. For years, I didn't speak of it."] }] }],
  ["go", "🚂", ["가족을 지키려 따라간다", "家族を守るため従う", "Go, to protect the family"], { grade: "bad", effects: { health: -8, happy: -7, power: 3 }, flag: { add: "forced_labor" }, n: ["기차는 오래 달렸다. 돌아오기까지 몇 해가 걸렸다.", "汽車は長く走った。戻るまでに何年もかかった。", "The train ran for a long time. It was years before I came back."] }],
]);
H("liberation_day", { calYear: [1945, 1945], age: [5, 90], hist: "h_kr_1945", scene: "park", emoji: "🎉" }, ["해방의 날", "解放の日", "Liberation Day"], ["라디오에서 무슨 방송이 흘러나오더니, 골목마다 사람들이 뛰쳐나왔다.", "ラジオで何かの放送が流れると、路地ごとに人々が飛び出してきた。", "Something crackles on the radio, and people burst into every alley."], [
  ["run", "🏃", ["거리로 뛰어나간다", "通りへ駆け出す", "Run into the street"], { grade: "crit", effects: { happy: 10, social: 4 }, n: ["처음 보는 사람과 얼싸안고 울었다.", "初めて会う人と抱き合って泣いた。", "I hugged a stranger and wept."] }],
  ["family", "🫂", ["가족과 끌어안는다", "家族と抱き合う", "Hold the family close"], { grade: "good", effects: { happy: 8 }, n: ["어머니가 장롱 깊은 곳의 태극기를 꺼냈다.", "母がたんすの奥から太極旗を取り出した。", "Mother pulled the hidden flag from the back of the wardrobe."] }],
]);
// ---------- 전쟁 ----------
H("refuge", { calYear: [1950, 1951], age: [1, 90], hist: "h_kr_1950", scene: "countryside", emoji: "🎒", prio: 0.8 }, ["피란길", "避難の道", "The Road South"], ["포성이 가까워졌다. 지금 떠나야 했다.", "砲声が近づいてきた。今すぐ発たねばならなかった。", "The guns are getting closer. It's time to leave."], [
  ["south", "🚶", ["가족과 남쪽으로 걷는다", "家族と南へ歩く", "Walk south with the family"], { outcomes: [
    { chance: 0.75, grade: "mid", effects: { health: -4, happy: -6, social: 3 }, flag: { add: "war_refugee" }, n: ["부산 피란민촌의 판잣집에서 겨울을 났다.", "釜山の避難民村のバラックで冬を越した。", "We spent the winter in a shack in a Busan refugee camp."] },
    { chance: 0.25, grade: "bad", effects: { happy: -12, health: -4 }, flag: { add: ["war_refugee", "separated_family"] }, n: ["인파 속에서 가족 한 명의 손을 놓쳤다. 그 뒤로 오래 찾았다.", "人波の中で家族の一人の手を離してしまった。その後長く捜し続けた。", "In the crowd, I lost hold of a family member's hand. I searched for years."] }] }],
  ["stay", "🏚️", ["집을 지킨다", "家を守る", "Stay and guard the house"], { outcomes: [
    { chance: 0.55, grade: "mid", effects: { happy: -6, money: -150 }, n: ["숨죽인 채 석 달을 버텼다.", "息を潜めて三か月耐えた。", "We held our breath for three months."] },
    { chance: 0.45, grade: "bad", effects: { health: -8, happy: -8, money: -300 }, n: ["집은 반쯤 무너졌다. 그래도 가족은 살아 있었다.", "家は半分崩れた。それでも家族は生きていた。", "The house half-collapsed, but the family survived."] }] }],
]);
H("ration_milk", { calYear: [1953, 1962], age: [4, 12], hist: "h_kr_1955", scene: "classroom", emoji: "🥛" }, ["학교의 옥수수빵", "学校のトウモロコシパン", "Cornbread at School"], ["학교에서 구호품 옥수수빵을 나눠 줬다. 동생 생각이 났다.", "学校で救援物資のトウモロコシパンが配られた。弟妹のことを思い出した。", "School hands out relief cornbread. You think of your little sibling."], [
  ["share", "🍞", ["반을 남겨 동생에게 가져간다", "半分残して弟妹に持ち帰る", "Save half for your sibling"], { grade: "good", effects: { happy: 4, social: 2, health: -1 }, n: ["동생이 빵을 받아 들고 활짝 웃었다.", "弟妹がパンを受け取り満面の笑みを浮かべた。", "My sibling took the bread and beamed."] }],
  ["eat", "😋", ["다 먹는다", "全部食べる", "Eat it all"], { effects: { health: 2, happy: 2 }, n: ["배가 불렀다. 그 맛은 오래 잊히지 않았다.", "お腹がいっぱいになった。あの味は長く忘れられなかった。", "Finally full. I never forgot that taste."] }],
]);
H("april_student", { calYear: [1960, 1960], age: [15, 28], hist: "h_kr_1960", scene: "busStop", emoji: "✊" }, ["교문 앞", "校門の前", "At the School Gate"], ["선배들이 교문 앞에 모여 '부정 선거 다시 하라'고 외쳤다.", "先輩たちが校門前に集まり「不正選挙をやり直せ」と叫んだ。", "Older students gather at the gate, shouting 'Redo the rigged election!'"], [
  ["join", "📣", ["함께 거리로 나간다", "一緒に街へ出る", "March with them"], { grade: "good", effects: { social: 5, happy: 3, health: -2 }, flag: { add: "april_1960" }, n: ["경무대 앞까지 걸었다. 며칠 뒤 대통령이 물러났다.", "景武台の前まで歩いた。数日後、大統領が退いた。", "We marched all the way to the presidential residence. Days later, the president resigned."] }],
  ["class", "📚", ["교실에 남는다", "教室に残る", "Stay in class"], { effects: { intel: 2 }, n: ["창밖의 함성을 들으며 교과서를 넘겼다.", "窓の外の歓声を聞きながら教科書をめくった。", "I turned textbook pages to the sound of the crowd outside."] }],
]);
H("to_germany", { calYear: [1963, 1977], age: [20, 34], hist: "h_kr_1966", scene: "airport", emoji: "✈️", cond: (p) => !p.spouse && p.stats.money < 5000 }, ["서독 파견 모집", "西ドイツ派遣の募集", "Recruiting for West Germany"], ["신문에 광고가 났다. 서독 탄광·병원에서 일할 사람을 뽑는다고 했다. 월급이 여기의 몇 배였다.", "新聞に広告が出た。西ドイツの炭鉱・病院で働く人を募集している。給料はここの何倍もあった。", "A newspaper ad: workers wanted for West German mines and hospitals. The pay is several times higher than at home."], [
  ["go", "🧳", ["지원한다", "応募する", "Apply"], { outcomes: [
    { chance: 0.7, grade: "good", effects: { money: 1800, happy: -2, power: 3, social: 3 }, flag: { add: ["abroad", "germany_worker"] }, n: ["3년을 이국에서 일했다. 부친 돈으로 고향 집 지붕을 새로 얹었다.", "三年間異国で働いた。仕送りで故郷の家の屋根を新しくした。", "Three years abroad. The money I sent home put a new roof on the family house."] },
    { chance: 0.3, grade: "mid", effects: { money: 900, health: -5, happy: -3 }, flag: { add: ["abroad", "germany_worker"] }, n: ["몸이 많이 상했다. 그래도 동생들 학비는 해결했다.", "体をかなり壊した。それでも弟妹の学費はなんとかなった。", "My body took a beating, but my siblings' tuition was paid."] }] }],
  ["stay", "🏠", ["고향에 남는다", "故郷に残る", "Stay home"], { effects: { happy: 1 }, n: ["떠나는 친구를 김포에서 배웅했다.", "旅立つ友を金浦で見送った。", "I saw a friend off at Gimpo Airport."] }],
]);
H("vietnam", { calYear: [1965, 1972], age: [20, 26], genderRequired: "M", hist: null, scene: "airport", emoji: "🪖", cond: (p) => p.flags?.has?.("served") || p.age <= 24 }, ["파병 지원", "派兵への志願", "Volunteering for Deployment"], ["베트남으로 가는 부대에 지원하면 수당이 나온다고 했다. 실제로 많은 젊은이가 떠났다.", "ベトナムへ向かう部隊に志願すれば手当が出るという。実際に多くの若者が旅立った。", "Volunteers for units bound for Vietnam receive extra pay. Many young men really did go."], [
  ["go", "🚢", ["지원한다", "志願する", "Volunteer"], { outcomes: [
    { chance: 0.75, grade: "mid", effects: { money: 700, health: -4, happy: -4, power: 4 }, flag: { add: ["abroad", "vietnam_vet"] }, n: ["뜨거운 정글의 기억은 오래 꿈에 나왔다. 그 수당으로 동생이 학교를 마쳤다.", "熱いジャングルの記憶は長く夢に出た。その手当で弟妹が学校を出た。", "The jungle heat haunted my dreams for years. That pay put my sibling through school."] },
    { chance: 0.25, grade: "bad", effects: { health: -14, happy: -8, money: 400 }, flag: { add: ["abroad", "vietnam_vet", "war_injury"] }, n: ["다쳐서 돌아왔다. 비 오는 날이면 아직도 그 상처가 쑤셨다.", "負傷して戻った。雨の日には今もその傷が疼いた。", "I came back wounded. On rainy days, it still aches."] }] }],
  ["no", "🙅", ["가지 않는다", "行かない", "Don't go"], { effects: { happy: 1 }, n: ["떠나는 배를 부두에서 바라봤다.", "出ていく船を埠頭から見つめた。", "I watched the ship leave from the pier."] }],
]);
H("saemaul", { calYear: [1971, 1979], age: [16, 60], hist: "h_kr_1970", scene: "countryside", emoji: "🛖", cond: rural }, ["새마을 운동", "セマウル運動", "The New Village Movement"], ["마을에서 초가지붕을 슬레이트로 바꾸고 길을 넓히기로 했다.", "村でわら屋根をスレートに替え、道を広げることになった。", "The village decides to replace thatched roofs with slate and widen the roads."], [
  ["lead", "🧑‍🌾", ["앞장선다", "先頭に立つ", "Take the lead"], { grade: "good", effects: { social: 5, power: 2, money: 120 }, n: ["새벽마다 확성기 노래와 함께 일했다. 마을 이장이 되어 달라는 말을 들었다.", "毎朝スピーカーの歌とともに働いた。村長になってくれと言われた。", "We worked every dawn to songs from the loudspeaker. They asked me to become village head."] }],
  ["follow", "🔨", ["시키는 만큼 거든다", "言われた分だけ手伝う", "Pitch in as asked"], { effects: { power: 2, money: 60 }, n: ["지붕이 바뀌니 비 새는 일이 없어졌다.", "屋根が替わって雨漏りがなくなった。", "With the new roof, the leaks stopped."] }],
]);
H("mideast", { calYear: [1975, 1983], age: [24, 45], genderRequired: "M", hist: "h_kr_1975", scene: "airport", emoji: "🏗️" }, ["사막의 현장", "砂漠の現場", "A Desert Worksite"], ["중동 건설 현장에서 사람을 뽑는다. 2년이면 집 한 채 값을 번다는 말이 돌았다.", "中東の建設現場で人を募集している。二年で家一軒分稼げるという話だった。", "Middle East construction sites are hiring. Word is two years there buys a house."], [
  ["go", "🧳", ["떠난다", "旅立つ", "Go"], { outcomes: [
    { chance: 0.7, grade: "good", effects: { money: 2500, health: -4, happy: -2 }, flag: { add: ["abroad", "mideast_worker"] }, n: ["모래바람 속에서 2년을 보냈다. 돌아와 작은 집을 샀다.", "砂嵐の中で二年過ごした。戻って小さな家を買った。", "Two years in the sandstorms. I came back and bought a small house."], life: { housing: "own" } },
    { chance: 0.3, grade: "mid", effects: { money: 1200, health: -8 }, flag: { add: ["abroad", "mideast_worker"] }, n: ["더위에 몸이 상했다. 그래도 빚은 다 갚았다.", "暑さで体を壊した。それでも借金は全部返した。", "The heat wore me down, but every debt was paid."] }] }],
  ["stay", "🏠", ["가족 곁에 남는다", "家族のそばに残る", "Stay with the family"], { effects: { happy: 2 }, n: ["아이가 걸음마를 떼는 걸 직접 봤다.", "子どもが歩き始めるのをこの目で見た。", "I got to see my child's first steps."] }],
]);
H("june_tie", { calYear: [1987, 1987], age: [18, 50], hist: "h_kr_1987", scene: "subway", emoji: "👔" }, ["넥타이 부대", "ネクタイ部隊", "The Necktie Brigade"], ["퇴근길, 광장에서 사람들이 '호헌 철폐'를 외치고 있었다.", "帰り道、広場で人々がデモのスローガンを叫んでいた。", "On the way home, crowds in the square are chanting for democracy."], [
  ["join", "📣", ["넥타이를 풀고 합류한다", "ネクタイを緩めて加わる", "Loosen your tie and join"], { grade: "good", effects: { social: 4, happy: 4 }, flag: { add: "june_1987" }, n: ["모르는 사람들과 어깨를 걸었다. 그해 겨울, 처음으로 대통령을 직접 뽑았다.", "知らない人と肩を組んだ。その冬、初めて大統領を直接選んだ。", "I linked arms with strangers. That winter, I voted for president directly for the first time."] }],
  ["home", "🚌", ["버스를 타고 집으로 간다", "バスで家に帰る", "Take the bus home"], { effects: { happy: -1 }, n: ["버스 창밖으로 최루 가스 냄새가 났다.", "バスの窓の外から催涙ガスのにおいがした。", "Tear gas drifted through the bus window."] }],
]);
H("olympic_volunteer", { calYear: [1988, 1988], age: [15, 30], hist: "w_seoul88", scene: "field", emoji: "🏟️" }, ["올림픽 자원봉사", "五輪ボランティア", "Olympic Volunteer"], ["서울 올림픽 자원봉사자를 모집한다. 외국인들을 안내하는 일이다.", "ソウル五輪のボランティアを募集している。外国人を案内する仕事だ。", "The Seoul Olympics need volunteers to guide visitors from abroad."], [
  ["go", "🙋", ["지원한다", "応募する", "Sign up"], { grade: "good", effects: { social: 5, happy: 5, intel: 2 }, n: ["서툰 영어로 길을 알려 줬다. '땡큐'에 하루 피로가 다 풀렸다.", "つたない英語で道を教えた。「サンキュー」で一日の疲れが吹き飛んだ。", "I gave directions in shaky English. One 'thank you' melted the day's fatigue."] }],
  ["tv", "📺", ["집에서 중계를 본다", "家で中継を見る", "Watch it on TV"], { effects: { happy: 3 }, n: ["굴렁쇠 소년이 지나갈 때 온 가족이 박수를 쳤다.", "輪回しの少年が通り過ぎると家族全員が拍手した。", "The whole family clapped as the boy with the hoop crossed the field."] }],
]);
H("imf_list", { calYear: [1997, 1999], age: [30, 58], hist: "w_imf", scene: "office", emoji: "📋", prio: 0.7, cond: (p) => !!p.job && ["worker", "corporate"].includes(p.career) }, ["구조조정 명단", "リストラ名簿", "The Layoff List"], ["회사가 '희망퇴직'을 받는다고 했다. 부장이 조용히 나를 불렀다.", "会社が「希望退職」を募ると言った。部長が静かに私を呼んだ。", "The company announces 'voluntary retirement.' The manager quietly calls you in."], [
  ["stay", "🪑", ["버틴다", "耐える", "Hold on"], { outcomes: [
    { chance: 0.55, grade: "mid", effects: { happy: -6, health: -2 }, n: ["자리는 지켰다. 대신 옆자리 세 개가 비었다.", "席は守った。代わりに隣の三席が空いた。", "I kept my seat. Three desks around me went empty."] },
    { chance: 0.45, grade: "bad", effects: { happy: -10 }, life: { quit: true }, n: ["결국 짐을 쌌다. 아이들에게는 한동안 출근하는 척을 했다.", "結局荷物をまとめた。子どもたちにはしばらく出勤するふりをした。", "In the end I packed my things. For a while, I pretended to go to work for the kids."] }] }],
  ["take", "📦", ["퇴직금을 받고 나간다", "退職金をもらって辞める", "Take the package and go"], { grade: "mid", effects: { money: 1500, happy: -5 }, life: { quit: true }, flag: { add: "imf_layoff" }, n: ["퇴직금으로 뭘 할지, 밤새 계산기를 두드렸다.", "退職金で何をするか、夜通し電卓を叩いた。", "I spent the night punching numbers, wondering what to do with the severance."] }],
]);
H("gold_ring", { calYear: [1998, 1998], age: [20, 85], hist: "h_kr_1998", scene: "market", emoji: "💍" }, ["장롱 속 금반지", "たんすの金の指輪", "The Gold Ring in the Drawer"], ["은행 앞에 줄이 길다. 돌 반지, 결혼반지를 내놓는 사람들이다.", "銀行の前に長い列。初誕生日の指輪や結婚指輪を差し出す人たちだ。", "A long line outside the bank: people offering baby rings and wedding rings."], [
  ["give", "💛", ["아이 돌 반지를 내놓는다", "子どもの初誕生の指輪を差し出す", "Donate your child's ring"], { grade: "good", effects: { social: 4, happy: 3, money: -50 }, n: ["작은 반지가 저울 위에 올라갔다. 뿌듯하고 조금 아까웠다.", "小さな指輪が秤に乗った。誇らしく、少し惜しかった。", "The tiny ring went on the scale. Proud, and a little wistful."] }],
  ["keep", "🔒", ["간직한다", "大切にしまっておく", "Keep it"], { effects: { happy: -1 }, n: ["반지를 다시 장롱 깊숙이 넣었다.", "指輪をまたたんすの奥にしまった。", "I put the ring back deep in the drawer."] }],
]);
H("venture", { calYear: [1999, 2001], age: [24, 45], hist: "h_kr_1999", scene: "office", emoji: "💻" }, ["벤처 창업 제안", "ベンチャー起業の誘い", "A Startup Offer"], ["대학 동기가 '닷컴 회사'를 차리자고 했다. 투자자가 줄을 섰다는 시절이었다.", "大学の同期が「ドットコム企業」を作ろうと言った。投資家が列をなした時代だった。", "A college friend wants to start a 'dot-com.' Back then, investors were lining up."], [
  ["join", "🚀", ["뛰어든다", "飛び込む", "Jump in"], { outcomes: [
    { chance: 0.3, grade: "crit", effects: { money: 6000, happy: 8 }, career: "business", n: ["회사가 코스닥에 올랐다. 지분이 꽤 됐다.", "会社がKOSDAQに上場した。持ち株はかなりのものだった。", "The company listed on KOSDAQ. My stake was substantial."] },
    { chance: 0.7, grade: "bad", effects: { money: -1500, happy: -6 }, n: ["거품이 꺼지자 사무실 집기를 중고로 팔았다.", "バブルが弾けると事務所の備品を中古で売った。", "When the bubble burst, we sold the office furniture secondhand."] }] }],
  ["no", "🙅", ["다니던 곳에 남는다", "今の職場に残る", "Stay where you are"], { effects: { happy: 1 }, n: ["몇 년 뒤 그 회사 이름을 뉴스에서 다시 봤다.", "数年後、その会社の名前をニュースで再び見た。", "Years later, I saw that company's name in the news again."] }],
]);
H("street_cheer", { calYear: [2002, 2002], age: [7, 75], hist: "w_wc2002", scene: "park", emoji: "⚽" }, ["거리 응원", "街頭応援", "Cheering in the Streets"], ["오늘 저녁 경기다. 시청 앞 광장에 사람들이 모인다고 한다.", "今夜は試合だ。市庁前広場に人が集まるらしい。", "There's a match tonight. Crowds are gathering in front of City Hall."], [
  ["go", "🔴", ["붉은 옷을 입고 나간다", "赤い服を着て出かける", "Put on red and go"], { grade: "crit", effects: { happy: 9, social: 5 }, flag: { add: "street_cheer_2002" }, n: ["'대~한민국!' 처음 보는 사람과 하이파이브를 백 번은 했다.", "「テーハンミングック!」初対面の人と百回はハイタッチした。", "'Dae-han-min-guk!' I high-fived about a hundred strangers."] }],
  ["home", "📺", ["집에서 치킨과 본다", "家でチキンを食べながら見る", "Watch at home with fried chicken"], { grade: "good", effects: { happy: 6 }, n: ["골이 들어가자 아파트 단지 전체가 함께 소리쳤다.", "ゴールが決まるとマンション中が一斉に叫んだ。", "When the goal went in, the whole apartment complex screamed at once."] }],
]);
H("five_day", { calYear: [2004, 2006], age: [25, 58], hist: "h_kr_2004", scene: "park", emoji: "📅", cond: (p) => !!p.job }, ["첫 번째 토요일", "初めての土曜休み", "The First Free Saturday"], ["회사가 토요일에 쉬게 됐다. 이 하루를 어떻게 쓸까.", "会社が土曜休みになった。この一日をどう使おう。", "Your company now takes Saturdays off. What to do with the extra day?"], [
  ["hobby", "🎣", ["취미를 시작한다", "趣味を始める", "Start a hobby"], { grade: "good", effects: { happy: 5, health: 2 }, n: ["주말마다 낚싯대를 챙겼다. 사는 맛이 났다.", "週末ごとに釣り竿を持った。生きている実感があった。", "Every weekend, I packed a fishing rod. Life tasted good."] }],
  ["family", "🧺", ["가족과 나들이", "家族でお出かけ", "Family outing"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["아이가 '아빠 토요일에도 집에 있어?'라고 물었다.", "子どもが「土曜日も家にいるの?」と聞いた。", "My kid asked, 'You're home on Saturdays now?'"] }],
  ["side", "💼", ["부업을 한다", "副業をする", "Pick up side work"], { effects: { money: 300, health: -2 }, n: ["쉬는 날이 하나 더 생겼지만 쉬지는 않았다.", "休みが一日増えたが休まなかった。", "I got an extra day off, but I didn't rest."] }],
]);
H("first_smartphone", { calYear: [2009, 2012], age: [12, 80], hist: "h_kr_2009", scene: "convStore", emoji: "📱" }, ["첫 스마트폰", "初めてのスマホ", "Your First Smartphone"], ["매장 앞에 새 휴대폰 광고가 크게 붙어 있다. 손가락으로 넘기는 화면이라고 한다.", "店の前に新しい携帯の広告が大きく貼られている。指でめくる画面だという。", "A big poster for a new phone: a screen you swipe with your finger."], [
  ["buy", "📲", ["바로 바꾼다", "すぐ買い替える", "Switch right away"], { grade: "good", effects: { internet: 6, happy: 3, money: -80 }, n: ["지하철에서 고개를 숙인 사람 중 하나가 됐다.", "地下鉄でうつむく人の一人になった。", "I became one of those heads bowed on the subway."] }],
  ["wait", "☎️", ["쓰던 폰이 아직 멀쩡하다", "今の携帯でまだ十分", "Your old phone works fine"], { effects: { happy: 1 }, n: ["2년을 더 버텼다. 결국 단체방 때문에 바꿨다.", "あと二年粘った。結局グループチャットのために替えた。", "I held out two more years — then switched for the group chats."] }],
]);
H("covid_shop", { calYear: [2020, 2021], age: [25, 70], hist: "w_pandemic", scene: "shop", emoji: "😷", prio: 0.6, cond: (p) => p.career === "business" || p.flags?.has?.("startup") }, ["손님이 끊긴 가게", "客足が途絶えた店", "A Shop with No Customers"], ["감염병 때문에 거리가 텅 비었다. 가게 문을 열어도 아무도 오지 않는다.", "感染症で通りが空っぽになった。店を開けても誰も来ない。", "The streets are empty because of the pandemic. Even with the door open, no one comes in."], [
  ["online", "💻", ["배달·온라인으로 바꾼다", "デリバリー・オンラインに切り替える", "Pivot to delivery and online"], { outcomes: [
    { chance: 0.55, grade: "good", effects: { money: 600, happy: 3, internet: 4 }, n: ["밤새 사진을 찍어 올렸다. 주문 알림이 울리기 시작했다.", "夜通し写真を撮って載せた。注文通知が鳴り始めた。", "I shot and posted photos all night. Order notifications started pinging."] },
    { chance: 0.45, grade: "mid", effects: { money: -400, happy: -3 }, n: ["수수료를 빼니 남는 게 없었다.", "手数料を引くと何も残らなかった。", "After the platform fees, nothing was left."] }] }],
  ["hold", "🕯️", ["문을 열고 버틴다", "店を開けて耐える", "Stay open and endure"], { grade: "bad", effects: { money: -900, happy: -5 }, n: ["대출 상환일이 다가왔다. 단골들이 문 앞에 응원 쪽지를 붙였다.", "返済日が近づいた。常連が店の前に応援メッセージを貼ってくれた。", "The loan payment loomed. Regulars taped notes of support to the door."] }],
]);
H("remote_work", { calYear: [2020, 2021], age: [22, 60], hist: "w_pandemic", scene: "home", emoji: "🏠", cond: (p) => ["corporate", "developer", "worker"].includes(p.career) }, ["재택근무", "在宅勤務", "Working from Home"], ["회사가 당분간 집에서 일하라고 했다. 식탁이 책상이 됐다.", "会社がしばらく在宅勤務せよと言った。食卓が机になった。", "The company says to work from home for now. The dinner table becomes a desk."], [
  ["focus", "🎧", ["작업 공간을 꾸민다", "作業スペースを整える", "Set up a proper workspace"], { grade: "good", effects: { happy: 3, intel: 2, money: -100 }, n: ["출퇴근 두 시간이 사라졌다. 저녁이 생겼다.", "往復二時間の通勤が消えた。夕方ができた。", "Two hours of commuting vanished. I had evenings again."] }],
  ["lonely", "😶", ["혼자인 시간이 길어진다", "一人の時間が長くなる", "The days grow lonely"], { effects: { happy: -4, social: -3 }, n: ["며칠 동안 아무와도 말하지 않은 걸 깨달았다.", "何日も誰とも話していないことに気づいた。", "I realized I hadn't spoken to anyone in days."] }],
]);

export const HISTORY_EVENTS = EV;
