// =========================
// 플듀 인생게임 REBORN — 사건 3차: 노년·인생의 마무리 (2026-11-23)
// 늙어 가는 것을 슬프게만 그리지 않는다 — 배움·사랑·유머·정리·작별. 죽음은 담담하게.
// =========================
import { ev } from "./life-ev-kit.js?v=20261122_rb2";
const EV = [];
const O = (id, meta, title, desc, choices) => EV.push(ev("od_" + id, { area: "old", ...meta }, title, desc, choices));

O("retire_day", { age: [58, 70], emoji: "🎉", scene: "retire", cond: (p) => !!p.job }, ["은퇴 날짜", "退職の日", "Retirement Date"], ["회사에서 은퇴 날짜를 정하자고 한다.", "会社から退職日を決めようと言われた。", "Your company asks you to set a retirement date."], [
  ["now", "🌅", ["예정대로 은퇴한다", "予定通り退職する", "Retire as planned"], { grade: "good", effects: { happy: 5, health: 2 }, life: { careerEnd: true }, flag: { add: "retired" }, n: ["마지막 날 책상 위에 후배들이 쓴 쪽지가 수북했다.", "最終日、机の上に後輩たちの手紙が山積みだった。", "On my last day, notes from juniors covered my desk."] }],
  ["extend", "📎", ["몇 년 더 일한다", "数年延長して働く", "Work a few more years"], { effects: { money: 600, health: -1 }, n: ["일이 아직 즐거웠다. 대신 손주 운동회를 놓쳤다.", "仕事はまだ楽しかった。代わりに孫の運動会を逃した。", "Work was still fun. But I missed my grandkid's sports day."] }],
]);
O("retire_first_week", { age: [58, 75], emoji: "🛋️", scene: "home", cond: (p) => p.flags?.has?.("retired") }, ["은퇴 첫 주", "退職最初の週", "The First Week of Retirement"], ["알람 없는 아침이다. 이상하게 여섯 시에 눈이 떠진다.", "目覚ましのない朝。なぜか六時に目が覚める。", "No alarm. Somehow you wake at six anyway."], [
  ["plan", "📅", ["하루 시간표를 짠다", "一日の時間割を作る", "Make a daily schedule"], { grade: "good", effects: { happy: 4, health: 2, intel: 1 }, n: ["오전엔 운동, 오후엔 도서관, 저녁엔 요리. 회사 다닐 때보다 바빴다.", "午前は運動、午後は図書館、夜は料理。会社員の頃より忙しかった。", "Mornings: exercise. Afternoons: library. Evenings: cooking. Busier than when I worked."] }],
  ["rest", "😴", ["그냥 쉰다", "ただ休む", "Just rest"], { effects: { happy: 2, health: 1 }, n: ["한 달은 좋았다. 두 달째에 좀이 쑤셨다.", "一か月はよかった。二か月目にうずうずしてきた。", "The first month was great. By the second, I was restless."] }],
]);
O("second_career", { age: [60, 75], emoji: "🧑‍🏫", scene: "classroom" }, ["인생 2막", "人生の第二幕", "A Second Act"], ["평생 해 온 일을 젊은이들에게 가르쳐 달라는 제안이 왔다.", "一生続けた仕事を若者に教えてほしいと頼まれた。", "You're asked to teach young people the work you did all your life."], [
  ["teach", "📚", ["강단에 선다", "教壇に立つ", "Take the podium"], { grade: "crit", effects: { happy: 7, social: 4, money: 200 }, flag: { add: "elder_teacher" }, n: ["학생들이 내 실패담을 가장 좋아했다.", "学生たちは私の失敗談を一番喜んだ。", "My students loved my failure stories the most."] }],
  ["no", "🙅", ["이제는 쉬고 싶다", "もう休みたい", "I just want to rest now"], { effects: { happy: 2 }, n: ["대신 후배들이 가끔 찾아와 물어봤다.", "代わりに後輩が時々訪ねてきて相談した。", "Instead, juniors dropped by now and then to ask questions."] }],
]);
O("smartphone_class", { age: [60, 95], emoji: "📱", scene: "seniorCenter", fromYear: 2010 }, ["스마트폰 교실", "スマホ教室", "Smartphone Class"], ["복지관에서 스마트폰 쓰는 법을 가르친다.", "福祉館でスマホの使い方を教えている。", "The senior center offers smartphone lessons."], [
  ["learn", "✍️", ["꼼꼼히 배운다", "しっかり学ぶ", "Study hard"], { grade: "good", effects: { internet: 6, happy: 4, social: 2 }, n: ["손주에게 처음으로 영상 통화를 걸었다. 화면에 얼굴이 반만 나왔다.", "孫に初めてビデオ通話をかけた。画面に顔が半分しか映らなかった。", "I video-called my grandkid for the first time. Only half my face fit on screen."] }],
  ["ask", "👶", ["필요할 때 손주에게 묻는다", "必要な時に孫に聞く", "Just ask the grandkids when needed"], { effects: { happy: 2, social: 2 }, n: ["손주가 '또?' 하면서도 친절하게 알려 줬다.", "孫が「また?」と言いながらも親切に教えてくれた。", "My grandkid sighed 'Again?' but explained kindly."] }],
]);
O("memoir", { age: [60, 100], emoji: "📖", scene: "library" }, ["자서전을 써 볼까", "自伝を書こうか", "Writing a Memoir"], ["살아온 이야기를 글로 남겨 보고 싶다.", "生きてきた物語を文章に残したい。", "You want to put your life story into words."], [
  ["write", "🖋️", ["매일 한 쪽씩 쓴다", "毎日一ページずつ書く", "Write one page a day"], { grade: "crit", effects: { happy: 6, intel: 3 }, flag: { add: "wrote_memoir" }, n: ["1년 뒤 300쪽이 됐다. 가족들이 돌려 가며 읽었다.", "一年後、三百ページになった。家族が回し読みした。", "A year later, it was 300 pages. My family passed it around."] }],
  ["talk", "🎙️", ["손주에게 녹음해 달라고 한다", "孫に録音してもらう", "Have a grandkid record you talking"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["녹음 파일이 스무 개가 됐다. 목소리가 그대로 남았다.", "録音ファイルが二十個になった。声がそのまま残った。", "Twenty recordings. My voice, preserved."] }],
]);
O("bucket_list", { age: [60, 90], emoji: "📝", scene: "home" }, ["버킷 리스트", "バケットリスト", "A Bucket List"], ["죽기 전에 꼭 해 보고 싶은 것 열 가지를 적었다.", "死ぬまでにやりたいことを十個書いた。", "You write down ten things to do before you die."], [
  ["start", "✅", ["하나씩 지운다", "一つずつ消していく", "Start crossing them off"], { grade: "good", effects: { happy: 6, health: 1, money: -200 }, flag: { add: "bucket_list" }, n: ["열기구를 탔고, 피아노를 배웠고, 바다에서 해돋이를 봤다. 일곱 개를 지웠다.", "熱気球に乗り、ピアノを習い、海で日の出を見た。七つ消した。", "Rode a hot air balloon, learned piano, watched a sunrise at sea. Seven crossed off."] }],
  ["keep", "🗂️", ["적어 둔 것만으로 설렌다", "書いただけでわくわくする", "Writing it was thrilling enough"], { effects: { happy: 3 }, n: ["가끔 꺼내 보며 웃었다.", "時々取り出して眺めて笑った。", "I'd take it out sometimes and smile."] }],
]);
O("downsizing", { age: [65, 90], emoji: "📦", scene: "home" }, ["작은 집으로", "小さな家へ", "Downsizing"], ["아이들이 떠난 큰 집이 관리하기 버겁다.", "子どもたちが出た大きな家の管理がきつい。", "The big house, empty of kids, is hard to keep up."], [
  ["move", "🚚", ["작은 집으로 옮긴다", "小さな家に移る", "Move somewhere smaller"], { grade: "good", effects: { money: 800, happy: 1, health: 1 }, n: ["물건의 3분의 2를 정리했다. 남은 건 정말 소중한 것뿐이었다.", "物の三分の二を整理した。残ったのは本当に大切なものだけだった。", "I let go of two-thirds of my things. What remained truly mattered."] }],
  ["stay", "🏡", ["추억이 담긴 집에 남는다", "思い出の家に残る", "Stay in the house full of memories"], { effects: { happy: 2, health: -1 }, n: ["계단은 힘들었지만 문틀의 키 재기 자국은 그대로였다.", "階段はきつかったが、柱の背比べの跡はそのままだった。", "The stairs were hard, but the height marks on the doorframe stayed."] }],
]);
O("care_home", { age: [78, 105], emoji: "🏥", scene: "seniorCenter" }, ["요양원 이야기", "老人ホームの話", "Talk of a Care Home"], ["가족들이 조심스럽게 요양원 이야기를 꺼냈다.", "家族が慎重に老人ホームの話を切り出した。", "Your family carefully brings up the idea of a care home."], [
  ["visit", "🔍", ["직접 둘러보고 고른다", "自分で見学して選ぶ", "Tour them and choose yourself"], { grade: "good", effects: { happy: 2, social: 3, health: 2 }, n: ["창가에 텃밭이 있는 곳을 골랐다. 첫 주에 바둑 친구가 생겼다.", "窓辺に菜園がある所を選んだ。最初の週に囲碁仲間ができた。", "I chose one with a garden by the window. Made a Go buddy the first week."] }],
  ["home", "🏠", ["집에서 지내고 싶다고 말한다", "家で過ごしたいと伝える", "Say you want to stay home"], { effects: { happy: 3, health: -1 }, n: ["방문 요양사가 오기 시작했다. 낯설었지만 곧 정이 들었다.", "訪問ヘルパーが来始めた。最初は慣れなかったが、すぐ親しくなった。", "A home caregiver started visiting. Strange at first, then dear."] }],
]);
O("driving_license_return", { age: [72, 95], emoji: "🚗", scene: "street", fromYear: 1970 }, ["운전면허 반납", "運転免許の返納", "Giving Up Your License"], ["며칠 전 주차하다 벽을 긁었다. 가족이 면허 반납 이야기를 한다.", "数日前、駐車中に壁をこすった。家族が免許返納の話をする。", "You scraped a wall while parking last week. Your family mentions giving up your license."], [
  ["return", "🪪", ["반납한다", "返納する", "Turn it in"], { grade: "good", effects: { happy: -1, health: 1 }, flag: { add: "no_driving" }, n: ["버스 노선을 외웠다. 버스 기사와 친해졌다.", "バス路線を覚えた。運転手と仲良くなった。", "I memorized the bus routes and befriended the drivers."] }],
  ["keep", "🔑", ["아직은 괜찮다", "まだ大丈夫", "I'm still fine"], { outcomes: [
    { chance: 0.6, grade: "mid", effects: { happy: 2 }, n: ["낮에만, 가까운 곳만 다녔다.", "昼間だけ、近所だけを運転した。", "Only daytime, only short trips."] },
    { chance: 0.4, grade: "bad", effects: { health: -5, money: -200, happy: -4 }, flag: { add: "no_driving" }, n: ["작은 사고가 났다. 다친 사람은 없었지만, 그날 면허를 반납했다.", "小さな事故を起こした。けが人はいなかったが、その日免許を返した。", "A small accident. No one was hurt, but I turned in my license that day."] }] }],
]);
O("dance_class", { age: [60, 90], emoji: "💃", scene: "seniorCenter" }, ["노인 댄스 교실", "シニアダンス教室", "Senior Dance Class"], ["복지관에서 라인 댄스 수업 신청을 받는다.", "福祉館でラインダンスの受講者を募集している。", "The senior center is signing people up for line dancing."], [
  ["join", "🕺", ["신청한다", "申し込む", "Sign up"], { grade: "good", effects: { happy: 6, health: 3, social: 3 }, n: ["발은 늘 반 박자 늦었지만 웃음은 제일 컸다.", "足はいつも半拍遅れたが、笑いは一番大きかった。", "Always half a beat behind, but always laughing loudest."] }],
  ["watch", "👏", ["구경하며 박수만 친다", "見物して拍手だけする", "Just watch and clap"], { effects: { happy: 2 }, n: ["다음 학기엔 결국 등록했다.", "次の学期には結局申し込んだ。", "I signed up the next term anyway."] }],
]);
O("choir", { age: [55, 95], emoji: "🎶", scene: "musicRoom" }, ["합창단", "合唱団", "The Choir"], ["동네 합창단에서 단원을 모집한다.", "地域の合唱団が団員を募集している。", "The local choir is recruiting."], [
  ["sing", "🎤", ["오디션을 본다", "オーディションを受ける", "Audition"], { grade: "good", effects: { happy: 6, social: 3, health: 1 }, flag: { add: "choir" }, n: ["알토 맨 끝자리. 연말 공연에 가족들이 꽃을 들고 왔다.", "アルトの一番端。年末の公演に家族が花を持って来た。", "Last seat in the altos. At the year-end concert, my family brought flowers."] }],
  ["no", "🙊", ["노래는 자신 없다", "歌は自信がない", "Not confident singing"], { effects: { happy: 1 }, n: ["공연 날 객석 맨 앞에 앉았다.", "公演の日、客席の最前列に座った。", "I sat in the front row on concert day."] }],
]);
O("late_degree", { age: [60, 90], emoji: "🎓", scene: "campus" }, ["늦깎이 대학생", "シニア大学生", "College at Sixty-Plus"], ["못 다 한 공부가 마음에 걸린다. 방송통신대학 입학 안내문이 보인다.", "やり残した勉強が気になる。通信制大学の入学案内が目に入った。", "Unfinished studies have always nagged you. An open-university brochure catches your eye."], [
  ["enroll", "📝", ["입학한다", "入学する", "Enroll"], { outcomes: [
    { chance: 0.6, grade: "crit", effects: { happy: 8, intel: 5, money: -100 }, flag: { add: "late_graduate" }, n: ["4년 만에 졸업 가운을 입었다. 손주들이 학사모를 던져 줬다.", "四年で卒業ガウンを着た。孫たちが帽子を投げてくれた。", "Four years later, I wore a graduation gown. My grandkids tossed my cap."] },
    { chance: 0.4, grade: "good", effects: { happy: 4, intel: 3, money: -60 }, n: ["졸업은 못 했지만 배운 건 다 남았다.", "卒業はできなかったが、学んだことは全部残った。", "Didn't graduate, but everything I learned stayed."] }] }],
  ["read", "📚", ["혼자 책으로 공부한다", "独学で本を読む", "Study on your own with books"], { effects: { intel: 3, happy: 2 }, n: ["도서관 사서가 내 이름을 외웠다.", "図書館の司書が私の名前を覚えた。", "The librarian learned my name."] }],
]);
O("grandkid_care", { age: [55, 80], emoji: "🧸", scene: "home", cond: (p) => p.flags?.has?.("grandparent") }, ["손주 돌봄", "孫の世話", "Looking After the Grandkids"], ["맞벌이 자식이 손주를 봐 달라고 부탁한다.", "共働きの子が孫を見てほしいと頼む。", "Your working child asks you to babysit the grandkids."], [
  ["yes", "🤗", ["맡는다", "引き受ける", "Take it on"], { grade: "good", effects: { happy: 5, health: -2, social: 2 }, n: ["허리는 아팠지만 손주의 첫 단어가 '할머니(할아버지)'였다.", "腰は痛かったが、孫の最初の言葉が「ばあば(じいじ)」だった。", "My back ached, but the grandkid's first word was 'Grandma' (or 'Grandpa')."] }],
  ["part", "📅", ["일주일에 사흘만", "週三日だけ", "Only three days a week"], { effects: { happy: 3 }, n: ["나머지 날엔 내 시간을 지켰다. 서로 좋았다.", "残りの日は自分の時間を守った。お互いによかった。", "I kept the other days for myself. Good for everyone."] }],
]);
O("old_photo_box", { age: [60, 100], emoji: "🗃️", scene: "home" }, ["사진 상자", "写真の箱", "The Box of Photos"], ["벽장에서 흑백 사진이 든 상자를 찾았다.", "押し入れから白黒写真の箱を見つけた。", "You find a box of black-and-white photos in the closet."], [
  ["scan", "🖼️", ["손주와 디지털로 옮긴다", "孫とデジタル化する", "Digitize them with a grandkid"], { grade: "good", effects: { happy: 5, social: 2, internet: 2 }, n: ["사진마다 이야기를 들려줬다. 손주가 제목을 달았다.", "写真ごとに話をした。孫がタイトルをつけた。", "I told a story for each photo. My grandkid added captions."] }],
  ["look", "🔎", ["혼자 천천히 넘겨 본다", "一人でゆっくりめくる", "Look through them slowly alone"], { effects: { happy: 3 }, n: ["이름이 생각나지 않는 얼굴도 있었다. 그래도 웃는 얼굴이었다.", "名前が思い出せない顔もあった。それでも笑顔だった。", "Some faces I couldn't name anymore. But they were smiling."] }],
]);
O("hometown_return", { age: [60, 95], emoji: "🏞️", scene: "countryside" }, ["고향에 가 보다", "故郷を訪ねる", "Visiting Your Hometown"], ["태어난 동네에 수십 년 만에 가 보고 싶다.", "生まれた町を何十年ぶりに訪ねたい。", "You want to visit the place you were born, decades later."], [
  ["go", "🚌", ["다녀온다", "行ってくる", "Go"], { grade: "good", effects: { happy: 6, social: 1 }, n: ["골목은 사라졌지만 그 언덕 위 나무는 아직 있었다.", "路地はなくなっていたが、あの丘の木はまだあった。", "The alleys were gone, but the tree on that hill was still there."] }],
  ["map", "🗺️", ["지도로 찾아본다", "地図で探してみる", "Look it up on a map"], { effects: { happy: 2, internet: 1 }, n: ["위성 사진 속 학교 지붕을 오래 확대해 봤다.", "衛星写真の学校の屋根を長いこと拡大して見た。", "I zoomed in on my old school roof for a long time."] }],
]);
O("last_trip_abroad", { age: [65, 90], emoji: "✈️", scene: "abroad" }, ["가 보고 싶던 나라", "行きたかった国", "The Country You Always Wanted to See"], ["평생 가 보고 싶었던 나라가 있다. 다리가 성할 때 가야 한다.", "一生行きたかった国がある。足が動くうちに行かねば。", "There's a country you've always wanted to see. Better go while your legs still work."], [
  ["go", "🧳", ["간다", "行く", "Go"], { grade: "crit", effects: { happy: 9, health: -1, money: -300 }, flag: { add: "travel" }, n: ["사진으로만 보던 곳 앞에 섰다. 생각보다 훨씬 컸다.", "写真でしか見たことのない場所の前に立った。思ったよりずっと大きかった。", "I stood before the place I'd only seen in photos. It was so much bigger."] }],
  ["docu", "📺", ["다큐멘터리로 대신한다", "ドキュメンタリーで代わりにする", "Watch documentaries instead"], { effects: { happy: 2, intel: 1 }, n: ["화면으로 봐도 가슴이 뛰었다.", "画面越しでも胸が躍った。", "Even on screen, my heart raced."] }],
]);
O("pet_old_age", { age: [65, 95], emoji: "🐕", scene: "home", hasPet: false }, ["노년의 반려동물", "老後のペット", "A Pet in Old Age"], ["혼자 있는 시간이 길다. 보호소의 나이 든 강아지를 데려올까.", "一人の時間が長い。保護施設の老犬を迎えようか。", "Long days alone. Maybe adopt an older dog from the shelter."], [
  ["adopt", "🐶", ["데려온다", "迎える", "Adopt"], { grade: "crit", effects: { happy: 8, health: 2, social: 1 }, life: { pet: { kind: "dog", startAge: 7 } }, n: ["둘 다 느릿느릿 걸었다. 산책 속도가 딱 맞았다.", "二人ともゆっくり歩いた。散歩のペースがぴったりだった。", "We both walked slowly. Our pace matched perfectly."] }],
  ["cat", "🐱", ["고양이가 낫겠다", "猫がいい", "A cat would be better"], { grade: "good", effects: { happy: 6 }, life: { pet: { kind: "cat", startAge: 6 } }, n: ["무릎 위가 늘 따뜻했다.", "膝の上がいつも温かかった。", "My lap was always warm."] }],
]);
O("health_decline", { age: [75, 105], emoji: "🩺", scene: "hospital" }, ["몸이 예전 같지 않다", "体が昔のようにいかない", "The Body Isn't What It Was"], ["의사가 앞으로는 무리하지 말라고 한다.", "医者がこれからは無理をしないようにと言う。", "The doctor says no more overdoing it from now on."], [
  ["accept", "🍃", ["몸에 맞춰 천천히 산다", "体に合わせてゆっくり暮らす", "Live slowly, at your body's pace"], { grade: "good", effects: { happy: 3, health: 2 }, n: ["느려진 만큼 더 많은 게 보였다. 꽃이 피는 순서 같은 것.", "遅くなった分、多くのものが見えた。花が咲く順番のようなもの。", "Slowing down, I noticed more — like the order flowers bloom in."] }],
  ["fight", "💪", ["재활 운동을 열심히 한다", "リハビリを頑張る", "Work hard at rehab"], { grade: "good", effects: { health: 4, happy: 2 }, n: ["지팡이 없이 공원 한 바퀴를 돌았다. 다들 박수를 쳤다.", "杖なしで公園を一周した。みんなが拍手した。", "I walked a lap of the park without my cane. Everyone clapped."] }],
]);
O("friend_funeral_old", { age: [65, 100], emoji: "🕯️", scene: "funeral" }, ["친구의 부고", "友の訃報", "News of a Friend's Death"], ["오랜 친구의 부고 문자가 왔다.", "古い友の訃報が届いた。", "A message: an old friend has passed."], [
  ["go", "🖤", ["먼 길이지만 간다", "遠くても行く", "Go, despite the distance"], { grade: "good", effects: { happy: -3, social: 3, health: -1 }, n: ["친구의 손주가 '할아버지가 늘 이야기하던 분이시죠?'라고 물었다.", "友の孫が「祖父がいつも話していた方ですよね?」と聞いた。", "My friend's grandchild asked, 'You're the one Grandpa always talked about, right?'"] }],
  ["letter", "✉️", ["편지로 마음을 전한다", "手紙で気持ちを伝える", "Send a letter of condolence"], { effects: { happy: -2, social: 1 }, n: ["편지에 둘이 처음 만난 날을 적었다.", "手紙に二人が初めて会った日のことを書いた。", "I wrote about the day we first met."] }],
]);
O("living_will", { age: [65, 100], emoji: "📄", scene: "clinic" }, ["마지막 치료에 대한 결정", "最期の治療についての意思", "Deciding About End-of-Life Care"], ["연명 치료에 대한 의향서를 미리 써 둘 수 있다고 한다.", "延命治療についての意思表示書を前もって書けるという。", "You can write down your wishes about life-sustaining treatment in advance."], [
  ["write", "🖊️", ["가족과 이야기하고 쓴다", "家族と話して書く", "Talk with family and write it"], { grade: "good", effects: { happy: 3, social: 2 }, flag: { add: "living_will" }, n: ["무거운 이야기였지만 다 하고 나니 오히려 가벼웠다.", "重い話だったが、話し終えるとかえって軽くなった。", "A heavy talk — but afterward, everything felt lighter."] }],
  ["later", "⏳", ["아직은 생각하기 싫다", "まだ考えたくない", "Don't want to think about it yet"], { effects: { happy: -1 }, n: ["안내문을 서랍에 넣었다.", "案内を引き出しにしまった。", "I put the pamphlet in a drawer."] }],
]);
O("knowledge_pass", { age: [65, 100], emoji: "🍲", scene: "kitchen" }, ["집안의 맛", "家の味", "The Family Recipe"], ["자식들이 엄마(아빠) 음식 맛을 배우고 싶다고 한다.", "子どもたちが母(父)の味を習いたいと言う。", "Your children want to learn how you make the family dishes."], [
  ["teach", "👩‍🍳", ["손맛을 전수한다", "味を伝える", "Pass on the recipes"], { grade: "crit", effects: { happy: 7, social: 3 }, flag: { add: "family_recipe" }, n: ["'적당히'를 숫자로 바꾸느라 다들 애먹었다. 결국 공책 한 권이 됐다.", "「適量」を数字にするのに皆苦労した。結局ノート一冊になった。", "Translating 'just enough' into numbers was hard. It filled a whole notebook."] }],
  ["cook", "🍳", ["그냥 해 먹인다", "ただ作って食べさせる", "Just keep cooking for them"], { effects: { happy: 5 }, n: ["가르쳐 주지는 않았다. 대신 매주 반찬을 보냈다.", "教えはしなかった。代わりに毎週おかずを送った。", "I never taught them. I just sent dishes every week."] }],
]);
O("volunteer_elder", { age: [62, 90], emoji: "🤝", scene: "seniorCenter" }, ["어르신이 어르신을", "高齢者が高齢者を", "Elders Helping Elders"], ["혼자 사는 더 나이 든 어르신들에게 도시락을 배달하는 봉사가 있다.", "一人暮らしのさらに高齢の方に弁当を届けるボランティアがある。", "There's a volunteer program delivering lunches to older seniors living alone."], [
  ["join", "🍱", ["함께한다", "参加する", "Join"], { grade: "good", effects: { happy: 6, social: 4, health: 1 }, n: ["아흔 살 할머니가 매번 사탕 하나를 쥐여 주셨다.", "九十歳のおばあさんが毎回飴を一つ握らせてくれた。", "A ninety-year-old pressed a candy into my hand every time."] }],
  ["donate", "💝", ["후원금만 낸다", "寄付だけする", "Just donate"], { effects: { happy: 2, money: -30 }, n: ["매달 감사 편지가 왔다.", "毎月お礼の手紙が届いた。", "A thank-you letter came every month."] }],
]);
O("reconcile_child", { age: [60, 95], emoji: "🫂", scene: "home", hasKid: true }, ["자식과의 서먹함", "子とのぎこちなさ", "Distance with Your Child"], ["오래전 다툰 뒤로 자식과 사이가 서먹하다.", "昔の喧嘩以来、子との関係がぎこちない。", "Ever since an old fight, things have been distant with your child."], [
  ["first", "📞", ["먼저 전화한다", "先に電話する", "Call first"], { grade: "crit", effects: { happy: 8, social: 3 }, n: ["'아빠(엄마), 나도 미안했어.' 십 년이 한 통화로 녹았다.", "「お父さん(お母さん)、私もごめん」十年が一本の電話で溶けた。", "'Dad (Mom), I'm sorry too.' Ten years melted in one call."] }],
  ["letter", "✉️", ["편지를 쓴다", "手紙を書く", "Write a letter"], { grade: "good", effects: { happy: 5, social: 2 }, n: ["답장 대신 손주 손을 잡고 찾아왔다.", "返事の代わりに孫の手を引いて訪ねてきた。", "Instead of replying, they showed up holding my grandkid's hand."] }],
]);
O("garden_legacy", { age: [60, 100], emoji: "🌳", scene: "park" }, ["나무 한 그루", "一本の木", "Planting a Tree"], ["손주 이름으로 나무를 한 그루 심고 싶다.", "孫の名前で木を一本植えたい。", "You want to plant a tree in your grandchild's name."], [
  ["plant", "🌱", ["함께 심는다", "一緒に植える", "Plant it together"], { grade: "crit", effects: { happy: 7, social: 2 }, flag: { add: "planted_tree" }, n: ["나무 옆에 작은 팻말을 세웠다. 몇십 년 뒤에도 거기 서 있을 것이다.", "木の横に小さな札を立てた。何十年後もそこに立っているだろう。", "We put a small sign beside it. It'll stand there for decades."] }],
  ["pot", "🪴", ["화분에 심어 선물한다", "鉢に植えて贈る", "Give it in a pot"], { effects: { happy: 4 }, n: ["손주가 그 화분에 매일 물을 줬다고 한다.", "孫がその鉢に毎日水をやっていたそうだ。", "I heard my grandkid watered it every day."] }],
]);
O("aging_body_humor", { age: [70, 105], emoji: "😂", scene: "home" }, ["돋보기", "老眼鏡", "Reading Glasses"], ["돋보기를 찾느라 온 집을 뒤졌다. 머리 위에 있었다.", "老眼鏡を家中探した。頭の上にあった。", "You searched the whole house for your reading glasses. They were on your head."], [
  ["laugh", "😆", ["크게 웃는다", "大笑いする", "Laugh out loud"], { grade: "good", effects: { happy: 5 }, n: ["가족 단톡방에 올렸더니 다들 웃는 이모티콘을 보냈다.", "家族グループに送ったら、みんな笑いの絵文字を返した。", "I posted it in the family chat. Everyone sent laughing emojis."] }],
  ["chain", "📿", ["안경 줄을 산다", "眼鏡チェーンを買う", "Buy a glasses chain"], { effects: { happy: 2, intel: 1 }, n: ["그 뒤로 안경을 잃어버린 적이 없다.", "それ以来眼鏡をなくしたことはない。", "Never lost them again."] }],
]);
O("youth_reflection", { age: [70, 105], emoji: "🪞", scene: "retire" }, ["젊은 날의 나에게", "若い日の自分へ", "To My Younger Self"], ["거울 속 주름진 얼굴을 보다가 스무 살의 내가 떠올랐다.", "鏡の中のしわだらけの顔を見て、二十歳の自分を思い出した。", "Looking at your wrinkled face in the mirror, you remember yourself at twenty."], [
  ["proud", "🌟", ["'잘 살았다'고 말해 준다", "「よく生きた」と言ってあげる", "Tell yourself 'You did well'"], { grade: "good", effects: { happy: 6 }, n: ["거울 속 얼굴이 조금 웃었다.", "鏡の中の顔が少し笑った。", "The face in the mirror smiled a little."] }],
  ["regret", "🌧️", ["못 해 본 게 떠오른다", "やれなかったことを思い出す", "Think of what you never did"], { effects: { happy: -2, intel: 1 }, n: ["그래도 아직 늦지 않은 것 하나를 찾아냈다.", "それでも、まだ遅くないことを一つ見つけた。", "Still, I found one thing that wasn't too late."] }],
]);
O("hospital_friend", { age: [75, 105], emoji: "🛏️", scene: "hospital" }, ["병실 옆 침대", "病室の隣のベッド", "The Bed Next to Yours"], ["입원한 병실 옆 침대에 비슷한 나이의 사람이 있다.", "入院先の病室の隣のベッドに同じくらいの年の人がいる。", "In the hospital, the patient in the next bed is about your age."], [
  ["talk", "💬", ["말을 건다", "話しかける", "Strike up a conversation"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["같은 해에 태어났다. 서로 어린 시절 이야기로 밤을 새웠다.", "同じ年の生まれだった。互いの子ども時代の話で夜を明かした。", "We were born the same year. We swapped childhood stories all night."] }],
  ["quiet", "🤫", ["조용히 쉰다", "静かに休む", "Rest quietly"], { effects: { health: 2 }, n: ["커튼 너머로 라디오 소리가 들렸다. 그것도 위로가 됐다.", "カーテン越しにラジオの音が聞こえた。それも慰めになった。", "A radio murmured through the curtain. It was comforting too."] }],
]);
O("final_gathering", { age: [80, 110], emoji: "👨‍👩‍👧‍👦", scene: "home" }, ["가족이 모인 날", "家族が集まった日", "The Day the Family Gathered"], ["생일이라며 가족들이 모두 모였다. 다 모인 게 몇 년 만이다.", "誕生日だと家族全員が集まった。全員揃うのは何年ぶりだ。", "Everyone gathers for your birthday. It's been years since all of you were together."], [
  ["speech", "🎤", ["한마디 한다", "一言話す", "Say a few words"], { grade: "crit", effects: { happy: 9, social: 3 }, n: ["'다들 고맙다.' 그 말밖에 안 나왔는데, 다들 울었다.", "「みんな、ありがとう」それしか言えなかったが、みんな泣いた。", "'Thank you, all of you.' That's all I could say. Everyone cried."] }],
  ["listen", "👂", ["아이들 웃음소리를 듣는다", "子どもたちの笑い声を聞く", "Just listen to the kids laughing"], { grade: "good", effects: { happy: 7 }, n: ["시끄러운 거실 한가운데서 꾸벅 졸았다. 가장 행복한 낮잠이었다.", "騒がしいリビングの真ん中でうとうとした。一番幸せな昼寝だった。", "I dozed off in the middle of the noisy living room. The happiest nap of my life."] }],
]);
O("last_spring", { age: [85, 110], emoji: "🌸", scene: "park" }, ["올해의 벚꽃", "今年の桜", "This Year's Cherry Blossoms"], ["창밖에 벚꽃이 피었다. 몇 번을 더 볼 수 있을까.", "窓の外に桜が咲いた。あと何回見られるだろう。", "Cherry blossoms outside the window. How many more springs?"], [
  ["out", "🦯", ["부축을 받아서라도 나간다", "支えてもらっても外へ出る", "Go out, even with help"], { grade: "good", effects: { happy: 7, health: -1 }, n: ["꽃잎 하나가 손등에 내려앉았다.", "花びらが一枚、手の甲に舞い降りた。", "A single petal landed on the back of my hand."] }],
  ["window", "🪟", ["창가에 의자를 놓는다", "窓辺に椅子を置く", "Pull a chair to the window"], { effects: { happy: 4 }, n: ["하루 종일 꽃을 봤다. 바람이 불 때마다 숨을 참았다.", "一日中花を眺めた。風が吹くたびに息を止めた。", "I watched the blossoms all day, holding my breath whenever the wind blew."] }],
]);
O("legacy_donation", { age: [70, 105], emoji: "🏛️", scene: "office", cond: (p) => p.stats.money >= 5000 }, ["남기고 싶은 것", "遺したいもの", "What to Leave Behind"], ["재산 일부를 장학금으로 남기고 싶다는 생각이 든다.", "財産の一部を奨学金として遺したいと思う。", "You think about leaving part of your estate as a scholarship."], [
  ["fund", "🎓", ["내 이름의 장학금을 만든다", "自分の名の奨学金を作る", "Create a scholarship in your name"], { grade: "crit", effects: { money: -2000, happy: 8, social: 3 }, flag: { add: "scholarship_founder" }, n: ["첫 장학생이 감사 편지를 보내왔다. 나와 같은 동네 출신이었다.", "最初の奨学生が感謝の手紙を送ってきた。私と同じ町の出身だった。", "The first scholar sent a thank-you letter. They were from my old neighborhood."] }],
  ["family", "🏡", ["가족에게 남긴다", "家族に遺す", "Leave it all to family"], { effects: { happy: 2 }, n: ["아이들이 그 돈을 어떻게 쓸지 이야기하는 걸 들었다. 좋은 생각들이었다.", "子どもたちがそのお金をどう使うか話すのを聞いた。いい考えだった。", "I overheard my kids planning how to use it. Good ideas."] }],
]);
O("tech_scared", { age: [70, 100], emoji: "🤖", scene: "convStore", fromYear: 2018 }, ["무인 계산대", "セルフレジ", "The Self-Checkout"], ["가게 계산대가 기계로 바뀌었다. 뒤에 줄이 길어진다.", "店のレジが機械になった。後ろの列が長くなる。", "The store's register is now a machine. The line behind you grows."], [
  ["ask", "🙋", ["직원에게 도와 달라고 한다", "店員に助けを求める", "Ask a staff member for help"], { grade: "good", effects: { happy: 2, internet: 1 }, n: ["친절한 학생이 천천히 알려 줬다. 다음엔 혼자 해냈다.", "親切な学生がゆっくり教えてくれた。次は一人でできた。", "A kind student walked me through it. Next time, I did it alone."] }],
  ["leave", "🚪", ["그냥 나온다", "そのまま出る", "Just leave"], { effects: { happy: -3 }, n: ["사람이 있는 시장으로 갔다. 거기가 더 좋았다.", "人のいる市場へ行った。そこの方がよかった。", "I went to the market with real people. I liked it better."] }],
]);
O("anniversary_alone_meal", { age: [70, 105], emoji: "🍚", scene: "kitchen", married: false }, ["혼자 차린 생일상", "一人の誕生日の食卓", "A Birthday Meal for One"], ["생일인데 다들 바쁘다고 한다. 혼자 미역국을 끓였다.", "誕生日なのにみんな忙しいという。一人でわかめスープを作った。", "It's your birthday, but everyone's busy. You cook yourself birthday soup."], [
  ["enjoy", "🕯️", ["초를 켜고 혼자 축하한다", "ろうそくを灯して一人で祝う", "Light a candle and celebrate yourself"], { grade: "good", effects: { happy: 4 }, n: ["저녁에 현관 벨이 울렸다. 손주가 케이크를 들고 서 있었다.", "夕方玄関のベルが鳴った。孫がケーキを持って立っていた。", "That evening the doorbell rang. My grandkid stood there with a cake."] }],
  ["call", "📞", ["먼저 전화를 돌린다", "自分から電話をかける", "Call everyone yourself"], { effects: { happy: 3, social: 2 }, n: ["다들 미안하다며 주말에 오겠다고 했다.", "みんな申し訳ないと週末に来ると言った。", "They all apologized and promised to come on the weekend."] }],
]);
O("goodbye_pet_old", { age: [70, 105], emoji: "🌈", scene: "cemetery", hasPet: true, petMinAge: 10 }, ["늙은 반려동물", "年老いたペット", "An Aging Pet"], ["반려동물이 많이 늙었다. 나와 함께 늙었다.", "ペットがすっかり年をとった。私と一緒に年をとった。", "Your pet has grown very old. Grown old alongside you."], [
  ["promise", "🤍", ["남은 날을 매일 함께한다", "残りの日を毎日一緒に過ごす", "Spend every remaining day together"], { grade: "good", effects: { happy: 3, health: 1 }, n: ["햇볕 드는 창가에서 같이 낮잠을 잤다. 매일.", "日の当たる窓辺で一緒に昼寝した。毎日。", "We napped together in the sunny window. Every day."] }],
  ["find", "🏠", ["내가 먼저 떠날 경우를 위해 새 가족을 정해 둔다", "自分が先に逝く場合に備え、新しい家族を決めておく", "Arrange a new home in case you go first"], { grade: "good", effects: { happy: 2, intel: 1 }, n: ["손주가 '내가 꼭 돌볼게'라고 약속했다.", "孫が「必ず面倒を見る」と約束した。", "My grandkid promised, 'I'll take care of them.'"] }],
]);
O("history_witness", { age: [75, 110], emoji: "📜", scene: "classroom" }, ["시대의 증인", "時代の証人", "A Witness to History"], ["학교에서 '옛날 이야기를 들려줄 어르신'을 초대했다.", "学校が「昔の話をしてくれるお年寄り」を招いた。", "A school invites elders to tell students about the old days."], [
  ["go", "🗣️", ["내가 겪은 시대를 이야기한다", "自分が生きた時代を語る", "Tell them about the times you lived through"], { grade: "crit", effects: { happy: 7, social: 4, intel: 1 }, n: ["아이들이 교과서 속 일이 진짜였냐고 물었다. '진짜였지. 나 거기 있었어.'", "子どもたちが教科書の出来事は本当かと聞いた。「本当さ。私はそこにいた」", "The kids asked if the textbook stuff really happened. 'It did. I was there.'"] }],
  ["shy", "🙈", ["말주변이 없다며 사양한다", "話下手だと辞退する", "Decline — not a good speaker"], { effects: { happy: 1 }, n: ["대신 손주에게 조용히 이야기해 주었다.", "代わりに孫に静かに話してあげた。", "I told my grandkid instead, quietly."] }],
]);
O("good_morning_ritual", { age: [65, 105], emoji: "☀️", scene: "retire" }, ["아침 의식", "朝の習慣", "A Morning Ritual"], ["요즘 아침이 길다. 뭔가 매일 하는 일을 만들고 싶다.", "最近朝が長い。何か毎日することを作りたい。", "Mornings feel long these days. You want a daily ritual."], [
  ["diary", "📔", ["감사 일기를 쓴다", "感謝日記をつける", "Keep a gratitude diary"], { grade: "good", effects: { happy: 5, intel: 1 }, n: ["매일 세 줄. 비 온 날에도 쓸 게 있었다.", "毎日三行。雨の日にも書くことがあった。", "Three lines a day. Even rainy days had something."] }],
  ["tea", "🍵", ["차를 우려 창밖을 본다", "お茶を淹れて窓の外を見る", "Brew tea and watch the window"], { effects: { happy: 4, health: 1 }, n: ["같은 참새가 매일 같은 가지에 앉았다.", "同じスズメが毎日同じ枝にとまった。", "The same sparrow sat on the same branch every day."] }],
]);
O("will_change", { age: [70, 105], emoji: "✍️", scene: "office", cond: (p) => p.flags?.has?.("will_written") }, ["유언장 고치기", "遺言書の書き直し", "Revising Your Will"], ["몇 년 전 써 둔 유언장을 다시 읽었다. 바꾸고 싶은 게 생겼다.", "数年前の遺言書を読み直した。変えたいことができた。", "You reread the will you wrote years ago. Some things need changing."], [
  ["add", "➕", ["고마운 사람을 추가한다", "感謝したい人を加える", "Add someone you're grateful to"], { grade: "good", effects: { happy: 4, social: 2 }, n: ["간병해 준 요양사의 이름을 넣었다.", "介護してくれたヘルパーの名前を入れた。", "I added the name of the caregiver who looked after me."] }],
  ["letter", "💌", ["유언장 대신 편지를 덧붙인다", "遺言書に手紙を添える", "Attach letters instead"], { grade: "good", effects: { happy: 5 }, n: ["재산보다 편지가 더 길어졌다.", "財産のことより手紙の方が長くなった。", "The letters ended up longer than the will."] }],
]);
O("sunset_walk", { age: [70, 110], emoji: "🌇", scene: "river" }, ["노을 산책", "夕焼けの散歩", "A Sunset Walk"], ["강가에 노을이 진다. 오늘은 걷고 싶다.", "川辺に夕日が沈む。今日は歩きたい。", "The sun sets over the river. Today you feel like walking."], [
  ["walk", "🚶", ["천천히 걷는다", "ゆっくり歩く", "Walk slowly"], { grade: "good", effects: { happy: 5, health: 1 }, n: ["자전거 탄 아이들이 '안녕하세요!' 하고 지나갔다.", "自転車の子どもたちが「こんにちは!」と通り過ぎた。", "Kids on bikes shouted 'Hello!' as they passed."] }],
  ["bench", "🪑", ["벤치에 앉아 본다", "ベンチに座る", "Sit on a bench"], { effects: { happy: 4 }, n: ["해가 완전히 질 때까지 앉아 있었다.", "日が完全に沈むまで座っていた。", "I sat until the sun was completely gone."] }],
]);
O("old_rival", { age: [70, 100], emoji: "🎲", scene: "seniorCenter" }, ["경로당 바둑 라이벌", "老人会の囲碁ライバル", "Your Senior Center Rival"], ["경로당에 나만큼 지기 싫어하는 노인이 있다.", "老人会に私と同じくらい負けず嫌いな老人がいる。", "There's someone at the senior center who hates losing as much as you do."], [
  ["duel", "⚫", ["매일 한 판", "毎日一局", "One game every day"], { grade: "good", effects: { happy: 6, intel: 2, social: 3 }, flag: { add: "rival_friend" }, n: ["승률은 정확히 반반이었다. 어느 날 그가 안 나오자 걱정이 됐다.", "勝率はちょうど五分五分だった。ある日彼が来ないと心配になった。", "Exactly fifty-fifty. The day they didn't show up, I worried."] }],
  ["avoid", "🙄", ["피해 다닌다", "避ける", "Avoid them"], { effects: { happy: 1 }, n: ["그래도 매일 그 사람 바둑판을 곁눈질했다.", "それでも毎日その人の碁盤を横目で見た。", "Still, I glanced at their board every day."] }],
]);
O("grandkid_question_old", { age: [65, 105], emoji: "🧒", scene: "home", cond: (p) => p.flags?.has?.("grandparent") }, ["손주의 질문", "孫の質問", "A Grandkid's Question"], ["손주가 묻는다. '할머니(할아버지)는 언제가 제일 행복했어?'", "孫が聞く。「おばあちゃん(おじいちゃん)はいつが一番幸せだった?」", "Your grandkid asks, 'When were you happiest?'"], [
  ["now", "🥰", ["'지금'이라고 말한다", "「今」と答える", "Say 'Right now'"], { grade: "crit", effects: { happy: 8 }, n: ["손주가 '에이, 거짓말'이라며 웃었다. 진짜였는데.", "孫が「えー、うそ」と笑った。本当なのに。", "They laughed, 'No way!' But it was true."] }],
  ["story", "📖", ["젊은 날 이야기를 한다", "若い頃の話をする", "Tell a story from your youth"], { grade: "good", effects: { happy: 6, social: 2 }, n: ["이야기가 길어졌다. 손주는 끝까지 들었다.", "話が長くなった。孫は最後まで聞いてくれた。", "The story got long. They listened to the end."] }],
]);
O("final_letter_prep", { age: [80, 110], emoji: "🗒️", scene: "home" }, ["미리 써 두는 편지", "前もって書く手紙", "Letters Written in Advance"], ["언젠가를 위해 가족 한 명 한 명에게 편지를 써 두고 싶다.", "いつかのために、家族一人ひとりに手紙を書いておきたい。", "For someday, you want to write a letter to each family member."], [
  ["write", "✉️", ["한 사람씩 쓴다", "一人ずつ書く", "Write one for each"], { grade: "crit", effects: { happy: 6 }, flag: { add: "letters_ready" }, n: ["봉투마다 이름을 적어 상자에 넣었다. 마음이 고요해졌다.", "封筒ごとに名前を書いて箱に入れた。心が静かになった。", "I wrote a name on each envelope and boxed them. My heart grew quiet."] }],
  ["say", "🗣️", ["편지 대신 지금 말한다", "手紙の代わりに今言う", "Say it now instead"], { grade: "good", effects: { happy: 6, social: 3 }, n: ["전화를 돌려 '사랑한다'고 했다. 다들 무슨 일 있냐고 물었다.", "電話をかけて「愛してる」と言った。みんな何かあったのかと聞いた。", "I called around saying 'I love you.' Everyone asked if something was wrong."] }],
]);
O("hundredth", { age: [99, 101], emoji: "💯", scene: "home" }, ["백 번째 생일", "百歳の誕生日", "Your 100th Birthday"], ["백 번째 생일이다. 시청에서 축하 카드가 왔다.", "百歳の誕生日だ。役所からお祝いのカードが届いた。", "Your hundredth birthday. The city sent a congratulations card."], [
  ["party", "🎂", ["온 동네 잔치를 연다", "町を挙げてお祝いする", "Throw a neighborhood party"], { grade: "crit", effects: { happy: 10, social: 5 }, n: ["백 개의 초는 불 수 없어서 숫자 초 두 개를 꽂았다. 다 같이 불었다.", "百本のろうそくは吹けないので数字のろうそくを二本。みんなで吹いた。", "A hundred candles was too many, so we used number candles. Everyone blew together."] }],
  ["quiet", "🍰", ["가족끼리 조용히", "家族だけで静かに", "Quietly, with family"], { grade: "good", effects: { happy: 8 }, n: ["증손주가 '백 살이면 공룡 봤어요?'라고 물었다.", "ひ孫が「百歳なら恐竜見た?」と聞いた。", "My great-grandchild asked, 'If you're a hundred, did you see dinosaurs?'"] }],
]);
O("slow_cooking", { age: [65, 100], emoji: "🥘", scene: "kitchen" }, ["천천히 만드는 음식", "ゆっくり作る料理", "Slow Cooking"], ["시간이 많아졌다. 오래 걸리는 음식을 만들어 볼까.", "時間ができた。時間のかかる料理を作ってみようか。", "You have time now. Maybe make something that takes all day."], [
  ["make", "⏲️", ["하루 종일 끓인다", "一日中煮込む", "Simmer it all day"], { grade: "good", effects: { happy: 5, health: 1 }, n: ["냄새를 맡고 옆집에서 그릇을 들고 왔다.", "匂いにつられて隣が器を持って来た。", "The smell brought the neighbor over, bowl in hand."] }],
  ["share", "🥡", ["많이 만들어 나눈다", "たくさん作って分ける", "Make a big batch to share"], { grade: "good", effects: { happy: 4, social: 3 }, n: ["경로당 냉장고가 내 반찬으로 찼다.", "老人会の冷蔵庫が私のおかずでいっぱいになった。", "The senior center fridge filled up with my cooking."] }],
]);
O("loneliness", { age: [70, 105], emoji: "🌫️", scene: "home" }, ["조용한 집", "静かな家", "A Quiet House"], ["하루 종일 아무와도 말하지 않은 날이 늘었다.", "一日中誰とも話さない日が増えた。", "More and more days go by without speaking to anyone."], [
  ["out", "🚪", ["무조건 하루 한 번 밖에 나간다", "必ず一日一回外に出る", "Go out at least once every day"], { grade: "good", effects: { happy: 4, health: 2, social: 2 }, n: ["가게 주인, 버스 기사, 공원 비둘기. 하루 세 번은 인사를 했다.", "店主、バス運転手、公園の鳩。一日三回は挨拶した。", "The shopkeeper, the bus driver, the park pigeons. Three hellos a day."] }],
  ["radio", "📻", ["라디오에 사연을 보낸다", "ラジオに投稿する", "Write in to a radio show"], { grade: "good", effects: { happy: 5, social: 1 }, n: ["DJ가 내 사연을 읽었다. 같은 동네 사람이 전화를 걸어 왔다.", "DJが私の投稿を読んだ。同じ町の人から電話が来た。", "The DJ read my letter on air. Someone from my neighborhood called."] }],
]);
O("teach_grandkid_skill", { age: [60, 95], emoji: "🧶", scene: "kidroom", cond: (p) => p.flags?.has?.("grandparent") }, ["손주에게 가르치기", "孫に教える", "Teaching a Grandkid"], ["손주가 내가 하는 걸 신기하게 쳐다본다.", "孫が私のすることを不思議そうに見ている。", "Your grandkid watches what you do, fascinated."], [
  ["teach", "🪡", ["뜨개질(목공·바둑)을 가르친다", "編み物(木工・囲碁)を教える", "Teach knitting (woodwork, Go)"], { grade: "good", effects: { happy: 6, social: 2 }, n: ["삐뚤빼뚤한 첫 작품을 손주가 내게 선물했다.", "がたがたの最初の作品を孫がプレゼントしてくれた。", "My grandkid gave me their wobbly first creation."] }],
  ["learn", "🎮", ["대신 손주에게 게임을 배운다", "代わりに孫にゲームを教わる", "Have them teach you a game instead"], { effects: { happy: 5, internet: 2 }, n: ["매번 졌다. 손주는 매번 신났다.", "毎回負けた。孫は毎回大喜びだった。", "I lost every time. They were thrilled every time."] }],
]);
O("look_back_era", { age: [75, 110], emoji: "📻", scene: "retire" }, ["세상이 변했다", "世の中が変わった", "The World Has Changed"], ["텔레비전 속 세상이 내가 어릴 때와 너무 다르다.", "テレビの中の世界が子どもの頃とあまりに違う。", "The world on TV is nothing like the one you grew up in."], [
  ["curious", "🔭", ["새 세상이 궁금하다", "新しい世界が気になる", "Be curious about it"], { grade: "good", effects: { happy: 4, intel: 2, internet: 1 }, n: ["손주에게 요즘 유행어를 배웠다. 쓸 때마다 다들 웃었다.", "孫に今の流行語を習った。使うたびにみんな笑った。", "I learned slang from my grandkid. Everyone laughed whenever I used it."] }],
  ["miss", "🕰️", ["옛날이 그립다", "昔が懐かしい", "Miss the old days"], { effects: { happy: 2 }, n: ["옛날 노래를 틀어 놓고 따라 불렀다.", "昔の歌をかけて一緒に歌った。", "I played old songs and sang along."] }],
]);
O("peaceful_day", { age: [80, 110], emoji: "🍃", scene: "home" }, ["아무 일 없는 하루", "何事もない一日", "A Day When Nothing Happened"], ["오늘은 아무 일도 없었다. 날씨가 좋았고, 밥이 맛있었다.", "今日は何もなかった。天気がよく、ご飯がおいしかった。", "Nothing happened today. The weather was nice; the food was good."], [
  ["grateful", "🙏", ["그것으로 충분하다고 생각한다", "それで十分だと思う", "Think: that's enough"], { grade: "good", effects: { happy: 5 }, n: ["젊을 땐 몰랐다. 이런 날이 가장 귀하다는 걸.", "若い頃は知らなかった。こんな日が一番尊いということを。", "I didn't know when I was young: days like this are the most precious."] }],
  ["note", "📝", ["일기에 '좋은 날'이라고 적는다", "日記に「いい日」と書く", "Write 'a good day' in your diary"], { effects: { happy: 4, intel: 1 }, n: ["일기장에 '좋은 날'이 점점 늘었다.", "日記帳に「いい日」がどんどん増えた。", "The 'good day' entries kept growing."] }],
]);
O("organ_donor", { age: [50, 90], emoji: "💗", scene: "clinic" }, ["장기 기증 서약", "臓器提供の意思表示", "Organ Donor Pledge"], ["병원 게시판에 장기 기증 서약 안내가 붙어 있다.", "病院の掲示板に臓器提供の意思表示の案内が貼ってある。", "A hospital notice board invites you to pledge as an organ donor."], [
  ["sign", "🖊️", ["서약한다", "意思表示する", "Sign the pledge"], { grade: "good", effects: { happy: 4, social: 2 }, flag: { add: "donor_pledge" }, n: ["지갑 속 카드를 가족에게 보여 줬다. 다들 고개를 끄덕였다.", "財布のカードを家族に見せた。みんなうなずいた。", "I showed the card in my wallet to my family. They all nodded."] }],
  ["think", "🤔", ["조금 더 생각해 본다", "もう少し考える", "Think it over"], { effects: { intel: 1 }, n: ["안내문을 집에 가져왔다.", "案内を家に持ち帰った。", "I brought the pamphlet home."] }],
]);
O("old_couple_fight", { age: [65, 100], emoji: "🥢", scene: "kitchen", married: true }, ["50년째 같은 다툼", "五十年同じ口げんか", "The Same Argument for Fifty Years"], ["{spouse}와 또 반찬 간 때문에 투닥거린다.", "{spouse}とまたおかずの味付けで言い合いだ。", "You and {spouse} bicker over seasoning — again."], [
  ["laugh", "😂", ["웃음이 터진다", "笑いが止まらなくなる", "Burst out laughing"], { grade: "good", effects: { happy: 6 }, n: ["50년째 같은 이유로 싸우는 게 웃겼다. 둘 다 웃다가 국이 식었다.", "五十年同じ理由でけんかしているのがおかしかった。二人とも笑ってスープが冷めた。", "Fifty years, same fight. We laughed until the soup went cold."] }],
  ["win", "😤", ["이번엔 꼭 이긴다", "今回こそ勝つ", "Win it this time"], { effects: { happy: 2 }, n: ["졌다. 50년째 지고 있다.", "負けた。五十年負け続けている。", "Lost. Fifty years and still losing."] }],
]);
O("photo_album_end", { age: [80, 110], emoji: "📚", scene: "home" }, ["인생 앨범 정리", "人生アルバムの整理", "Organizing Your Life Album"], ["흩어진 사진들을 한 권의 앨범으로 정리하고 싶다.", "散らばった写真を一冊のアルバムにまとめたい。", "You want to gather all your scattered photos into one album."], [
  ["make", "📖", ["연도별로 정리한다", "年ごとに整理する", "Arrange them by year"], { grade: "good", effects: { happy: 6, intel: 1 }, n: ["마지막 쪽은 비워 두었다. 아직 찍을 사진이 있을 것 같아서.", "最後のページは空けておいた。まだ撮る写真がありそうで。", "I left the last page blank. There might still be photos to take."] }],
  ["give", "🎁", ["가족별로 나눠 준다", "家族ごとに分けて渡す", "Make one for each family member"], { grade: "good", effects: { happy: 5, social: 3 }, n: ["각자 자기가 나온 사진을 받고 신기해했다.", "それぞれ自分が写った写真を受け取って驚いていた。", "Each got the photos they appeared in, and loved it."] }],
]);
O("snow_old", { age: [70, 110], emoji: "❄️", scene: "street" }, ["첫눈", "初雪", "First Snow"], ["첫눈이 온다. 어릴 적 눈사람을 만들던 생각이 난다.", "初雪だ。子どもの頃雪だるまを作ったことを思い出す。", "The first snow. You remember building snowmen as a kid."], [
  ["small", "⛄", ["작은 눈사람을 만든다", "小さな雪だるまを作る", "Build a tiny snowman"], { grade: "good", effects: { happy: 6 }, n: ["손바닥만 한 눈사람을 현관 앞에 세웠다. 지나가던 아이가 하나 더 만들어 줬다.", "手のひらほどの雪だるまを玄関に置いた。通りがかった子がもう一つ作ってくれた。", "I put a palm-sized snowman by the door. A passing kid made it a friend."] }],
  ["warm", "♨️", ["따뜻한 방에서 바라본다", "暖かい部屋から眺める", "Watch from a warm room"], { effects: { happy: 4, health: 1 }, n: ["유리창에 김이 서렸다. 손가락으로 이름을 써 봤다.", "窓ガラスが曇った。指で名前を書いてみた。", "The window fogged up. I traced my name with a finger."] }],
]);

export const OLD_EVENTS = EV;
