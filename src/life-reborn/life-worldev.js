// =========================
// 플듀 인생게임 REBORN — 세계 공동 사건 (2026-11-23)
// 같은 세계(같은 world 객체)에 사는 모두가 같은 해에 같은 사건을 겪는다. 다만 나라·나이·직업·재산·건강에 따라 받는 영향이 다르다.
// · real: 실제 역사 (연도·나라 실제) — 화면에 "실제 역사" 표시
// · fiction: 가상의 미래 — 화면에 "가상" 표시 (2026년 이후 사건은 모두 가상/예상)
// · 무작위 사건(자연재해·유행)은 세계 씨앗(w.seed)+연도로 정해져 같은 방이면 모두 같은 결과
// 문장은 한국어 원문 + 일본어·영어를 같이 적는다.
// =========================

import { HIST_KR, HIST_OUT, SRC_OF } from "./life-history.js?v=20261123_w1";
const T = (ko, ja, en) => ({ ko, ja, en });
const has = (p, ...c) => c.includes(p.career);
const rich = (p) => p.stats.money >= 30000, broke = (p) => p.stats.money < 0;
const old = (p) => p.age >= 65, kid = (p) => p.age < 13, teen = (p) => p.age >= 13 && p.age < 20;
const ASIA = ["KR", "JP", "CN", "IN"];

// 개인 결과 문장 (공용)
const OUT = {
  hit: T("내 삶에도 그 여파가 왔다.", "私の暮らしにもその余波が来た。", "The ripples reached my life too."),
  hitJob: T("회사가 흔들렸다. 내 자리도 안전하지 않았다.", "会社が揺れた。私の席も安全ではなかった。", "The company shook. My job wasn't safe either."),
  hitRich: T("모아 둔 자산이 크게 줄었다.", "貯めていた資産が大きく減った。", "My savings took a big hit."),
  safe: T("나는 크게 흔들리지 않았지만, 주변은 그렇지 않았다.", "私は大きく揺れなかったが、周りはそうではなかった。", "I wasn't shaken much, but people around me were."),
  kidSaw: T("어린 나는 어른들의 표정으로 그 해를 기억한다.", "幼い私は大人たちの表情でその年を覚えている。", "As a child, I remember that year by the look on adults' faces."),
  gain: T("뜻밖에 기회가 생겼다.", "思いがけずチャンスが生まれた。", "An unexpected opportunity opened up."),
  joy: T("모두와 같이 환호했다.", "みんなと一緒に歓声を上げた。", "I cheered along with everyone."),
  watch: T("텔레비전 앞에서 숨을 죽이고 지켜봤다.", "テレビの前で息をのんで見守った。", "I held my breath in front of the TV."),
  learn: T("새로운 것을 배우느라 바빴다.", "新しいことを覚えるのに忙しかった。", "I was busy learning something new."),
  lost: T("한동안 일상이 멈췄다.", "しばらく日常が止まった。", "Daily life stopped for a while."),
  sick: T("나도 앓아누웠다. 다행히 회복했다.", "私も寝込んだ。幸い回復した。", "I fell ill too. Thankfully I recovered."),
  far: T("먼 나라의 일이었지만, 뉴스를 보며 마음이 무거웠다.", "遠い国の出来事だったが、ニュースを見て心が重かった。", "It happened far away, but the news weighed on me."),
};

// eff(p) → { d: 수치 변화, o: OUT 키 } · 나라가 범위 밖이면 near(가까운 나라)/far(먼 나라) 효과
export const WORLD_EVENTS = [
  // ---------- 실제 역사 ----------
  { id: "w_armistice", real: 1953, scope: ["KR"], kind: "social", emoji: "🕊️", t: T("전쟁이 멈췄다", "戦争が止まった", "The War Stops"), x: T("휴전 협정이 맺어졌다. 폐허 속에서 모두가 다시 살아갈 준비를 했다.", "休戦協定が結ばれた。廃墟の中、みんながもう一度生きる準備をした。", "An armistice is signed. Amid the ruins, everyone prepares to live again."), eff: (p) => ({ d: { happy: 3, health: -2 }, o: "kidSaw" }) },
  { id: "w_tv_age", real: 1960, scope: "*", kind: "tech", emoji: "📺", t: T("텔레비전이 집 안으로", "テレビが家の中に", "TV Comes Home"), x: T("동네에 텔레비전이 한두 대씩 들어왔다. 저녁마다 한 집에 모여 봤다.", "町にテレビが一、二台ずつ入ってきた。夕方になると一軒に集まって見た。", "TVs start arriving in the neighborhood. Every evening, people gather at one house to watch."), eff: (p) => ({ d: { happy: 2, internet: 2 }, o: "watch" }) },
  { id: "w_econ_plan", real: 1962, scope: ["KR"], kind: "econ", emoji: "🏭", t: T("공장이 세워지는 나라", "工場が建つ国", "A Country of New Factories"), x: T("경제 개발이 시작됐다. 도시마다 공장 굴뚝이 올라갔다.", "経済開発が始まった。都市ごとに工場の煙突が立った。", "Economic development begins. Factory chimneys rise in every city."), eff: (p) => ({ d: { money: p.age >= 18 ? 300 : 0, happy: 1 }, o: p.age >= 18 ? "gain" : "kidSaw" }) },
  { id: "w_tokyo64", real: 1964, scope: ["JP"], near: "*", kind: "culture", emoji: "🏟️", t: T("도쿄 올림픽", "東京オリンピック", "The Tokyo Olympics"), x: T("도쿄에서 올림픽이 열렸다. 신칸센이 처음 달렸다.", "東京でオリンピックが開かれた。新幹線が初めて走った。", "The Olympics come to Tokyo. The bullet train runs for the first time."), eff: (p) => p.country === "JP" ? { d: { happy: 6, social: 2 }, o: "joy" } : { d: { happy: 1 }, o: "watch" } },
  { id: "w_civil_rights", real: 1964, scope: ["US"], kind: "social", emoji: "✊", t: T("민권법 통과", "公民権法の成立", "The Civil Rights Act"), x: T("차별을 금지하는 법이 통과됐다. 오랜 싸움의 한 걸음이었다.", "差別を禁じる法律が成立した。長い闘いの一歩だった。", "A law banning discrimination passes — one step in a long struggle."), eff: (p) => ({ d: { happy: 2, social: 2 }, o: "watch" }) },
  { id: "w_eng66", real: 1966, scope: ["GB"], kind: "culture", emoji: "⚽", t: T("잉글랜드, 월드컵 우승", "イングランド、W杯優勝", "England Win the World Cup"), x: T("웸블리에서 잉글랜드가 월드컵을 들어 올렸다. 온 나라가 거리로 나왔다.", "ウェンブリーでイングランドがW杯を掲げた。国中が街に出た。", "England lift the World Cup at Wembley. The whole country spills into the streets."), eff: (p) => ({ d: { happy: 7 }, o: "joy" }) },
  { id: "w_cn_school_close", real: 1966, scope: ["CN"], kind: "social", emoji: "📕", t: T("멈춰 버린 교실", "止まった教室", "Classrooms Fall Silent"), x: T("문화대혁명이 시작되며 많은 학교가 오랫동안 문을 닫았다.", "文化大革命が始まり、多くの学校が長く閉じた。", "The Cultural Revolution begins, and many schools close for years."), eff: (p) => ({ d: p.age < 25 ? { intel: -5, happy: -4 } : { happy: -4, social: -2 }, o: p.age < 13 ? "kidSaw" : "lost" }) },
  { id: "w_may68", real: 1968, scope: ["FR"], kind: "social", emoji: "📢", t: T("68년 5월", "1968年5月", "May '68"), x: T("학생과 노동자들이 거리를 메웠다. 파리의 봄은 뜨거웠다.", "学生と労働者が通りを埋めた。パリの春は熱かった。", "Students and workers fill the streets. A hot spring in Paris."), eff: (p) => ({ d: p.age >= 16 ? { social: 3, happy: 1 } : { happy: 1 }, o: p.age >= 16 ? "learn" : "kidSaw" }) },
  { id: "w_moon", real: 1969, scope: "*", kind: "tech", emoji: "🌕", t: T("사람이 달에 내렸다", "人類が月に降り立った", "A Person Walks on the Moon"), x: T("흑백 화면 속에서 사람이 달 위를 걸었다. 온 세상이 같은 장면을 봤다.", "白黒の画面の中で人が月を歩いた。世界中が同じ場面を見た。", "On a black-and-white screen, a human walks on the Moon. The whole world watches the same scene."), eff: (p) => ({ d: { happy: 3, intel: kid(p) || teen(p) ? 3 : 1 }, o: "watch" }) },
  { id: "w_oil73", real: 1973, scope: "*", kind: "econ", emoji: "🛢️", t: T("석유 파동", "オイルショック", "The Oil Shock"), x: T("기름값이 몇 배로 뛰었다. 주유소마다 줄이 늘어섰다.", "石油価格が何倍にも跳ね上がった。ガソリンスタンドに行列ができた。", "Oil prices multiply. Lines form at every gas station."), econ: "recession", eff: (p) => p.age < 18 ? { d: { happy: -1 }, o: "kidSaw" } : { d: { money: -Math.round(400 + Math.max(0, p.stats.money) * 0.04), happy: -3 }, o: p.job ? "hitJob" : "hit" } },
  { id: "w_cn_reform", real: 1978, scope: ["CN"], kind: "econ", emoji: "🏗️", t: T("개혁개방", "改革開放", "Reform and Opening Up"), x: T("나라가 문을 열었다. 작은 장사가 허락되고 도시가 빠르게 자랐다.", "国が門を開いた。小さな商売が許され、都市が急速に育った。", "The country opens its doors. Small businesses are allowed, and cities grow fast."), econ: "boom", eff: (p) => ({ d: p.age >= 18 ? { money: 400, happy: 3 } : { happy: 2 }, o: p.age >= 18 ? "gain" : "kidSaw" }) },
  { id: "w_walkman", real: 1979, scope: "*", kind: "culture", emoji: "🎧", t: T("걸으면서 듣는 음악", "歩きながら聴く音楽", "Music on the Move"), x: T("주머니에 들어가는 카세트 플레이어가 나왔다. 길거리에 헤드폰이 넘쳤다.", "ポケットに入るカセットプレーヤーが出た。街にヘッドホンがあふれた。", "A pocket cassette player appears. Headphones fill the streets."), eff: (p) => ({ d: { happy: p.age < 35 ? 3 : 1 }, o: "joy" }) },
  { id: "w_pc", real: 1982, scope: "*", kind: "tech", emoji: "🖥️", t: T("개인용 컴퓨터", "パソコンの時代", "The Personal Computer"), x: T("집집마다 컴퓨터가 하나둘 들어오기 시작했다.", "家々にパソコンが少しずつ入り始めた。", "Computers start appearing in homes."), eff: (p) => ({ d: { intel: kid(p) || teen(p) ? 3 : 1, internet: 3 }, o: "learn" }) },
  { id: "w_mx85", real: 1985, scope: ["MX"], kind: "disaster", emoji: "🏚️", t: T("멕시코시티 지진", "メキシコシティ地震", "The Mexico City Earthquake"), x: T("큰 지진이 수도를 흔들었다. 이웃들이 맨손으로 서로를 구했다.", "大地震が首都を揺らした。隣人たちが素手で互いを救った。", "A great earthquake shakes the capital. Neighbors rescue each other with bare hands."), eff: (p) => ({ d: { happy: -6, health: -3, social: 3, money: p.housing === "own" ? -800 : -150 }, o: "lost" }) },
  { id: "w_mx86", real: 1986, scope: ["MX"], kind: "culture", emoji: "⚽", t: T("멕시코 월드컵", "メキシコW杯", "The Mexico World Cup"), x: T("두 번째 월드컵이 멕시코에서 열렸다. 경기장마다 파도타기 응원이 일었다.", "二度目のW杯がメキシコで開かれた。スタジアムごとにウェーブが起きた。", "Mexico hosts its second World Cup. The wave rolls through every stadium."), eff: (p) => ({ d: { happy: 5 }, o: "joy" }) },
  { id: "w_seoul88", real: 1988, scope: ["KR"], kind: "culture", emoji: "🏟️", t: T("서울 올림픽", "ソウルオリンピック", "The Seoul Olympics"), x: T("서울에서 올림픽이 열렸다. 굴렁쇠 소년이 운동장을 가로질렀다.", "ソウルでオリンピックが開かれた。輪回しの少年が競技場を横切った。", "The Olympics open in Seoul. A boy with a hoop crosses the stadium."), eff: (p) => ({ d: { happy: 6, social: 2 }, o: "joy" }) },
  { id: "w_wall", real: 1989, scope: ["DE"], near: "*", kind: "social", emoji: "🧱", t: T("베를린 장벽이 무너졌다", "ベルリンの壁崩壊", "The Berlin Wall Falls"), x: T("사람들이 망치를 들고 장벽 위에 올라섰다. 갈라졌던 도시가 하나가 됐다.", "人々がハンマーを手に壁の上に立った。分かれていた街がひとつになった。", "People climb the wall with hammers. A divided city becomes one."), eff: (p) => p.country === "DE" ? { d: { happy: 9, social: 3 }, o: "joy" } : { d: { happy: 1 }, o: "watch" } },
  { id: "w_jp_bubble", real: 1991, scope: ["JP"], kind: "econ", emoji: "🫧", t: T("거품이 꺼졌다", "バブル崩壊", "The Bubble Bursts"), x: T("치솟던 땅값과 주가가 무너졌다. '잃어버린 시간'이 시작됐다.", "高騰した地価と株価が崩れた。「失われた時代」が始まった。", "Soaring land and stock prices collapse. A 'lost' era begins."), econ: "recession", eff: (p) => p.age < 18 ? { d: { happy: -1 }, o: "kidSaw" } : { d: { money: -Math.round(Math.max(0, p.stats.money) * 0.18 + 300), happy: -4 }, o: rich(p) ? "hitRich" : "hitJob" } },
  { id: "w_in_reform", real: 1991, scope: ["IN"], kind: "econ", emoji: "📈", t: T("시장이 열렸다", "市場が開かれた", "The Economy Opens"), x: T("경제 자유화가 시작됐다. 새 회사와 새 일자리가 생겨났다.", "経済自由化が始まった。新しい会社と仕事が生まれた。", "Economic liberalization begins. New companies and jobs appear."), econ: "boom", eff: (p) => ({ d: p.age >= 18 ? { money: 250, happy: 3 } : { happy: 1 }, o: p.age >= 18 ? "gain" : "kidSaw" }) },
  { id: "w_br_real", real: 1994, scope: ["BR"], kind: "econ", emoji: "💵", t: T("새 돈, 헤알", "新通貨レアル", "A New Currency: the Real"), x: T("하루가 다르게 오르던 물가가 드디어 멈췄다.", "日ごとに上がっていた物価がようやく止まった。", "Prices that rose day by day finally stop climbing."), eff: (p) => ({ d: { happy: 4, money: p.age >= 18 ? 200 : 0 }, o: "gain" }) },
  { id: "w_nafta", real: 1994, scope: ["MX"], kind: "econ", emoji: "🚚", t: T("국경 너머의 공장", "国境の向こうの工場", "Factories at the Border"), x: T("새 무역 협정으로 북쪽 국경에 공장이 늘었다.", "新しい貿易協定で北の国境に工場が増えた。", "A new trade deal fills the northern border with factories."), eff: (p) => ({ d: p.age >= 18 ? { money: 150, happy: 1 } : {}, o: "gain" }) },
  { id: "w_internet", real: 1996, scope: "*", kind: "tech", emoji: "🌐", t: T("인터넷 시대", "インターネットの時代", "The Internet Age"), x: T("'삐-삐삐-' 전화선으로 세상과 연결됐다. 이메일 주소를 처음 만들었다.", "「ピーヒョロロ」電話回線で世界とつながった。初めてメールアドレスを作った。", "'Beep-screech!' The phone line connects you to the world. You make your first email address."), eff: (p) => ({ d: { internet: 5, intel: p.age < 30 ? 2 : 1, happy: 1 }, o: "learn" }) },
  { id: "w_imf", real: 1997, scope: ["KR"], near: ASIA, kind: "econ", emoji: "📉", t: T("외환 위기", "通貨危機", "The Financial Crisis"), x: T("나라 곳간이 비었다. 회사들이 쓰러지고 사람들은 금반지를 모았다.", "国の蔵が空になった。会社が倒れ、人々は金の指輪を集めた。", "The nation's reserves run dry. Companies collapse and people donate gold rings."), econ: "crisis", eff: (p) => p.country !== "KR" ? { d: { money: p.age >= 18 ? -150 : 0 }, o: "far" } : p.age < 18 ? { d: { happy: -3 }, o: "kidSaw" } : { d: { money: -Math.round(600 + Math.max(0, p.stats.money) * 0.15), happy: -7 }, o: p.job && !has(p, "civil", "teacher", "doctor") ? "hitJob" : "hit" } },
  { id: "w_fr98", real: 1998, scope: ["FR"], kind: "culture", emoji: "🏆", t: T("프랑스, 월드컵 우승", "フランス、W杯優勝", "France Win the World Cup"), x: T("개선문 위로 '지주'의 얼굴이 비쳤다. 샹젤리제가 사람으로 가득 찼다.", "凱旋門に「ジズー」の顔が映し出された。シャンゼリゼが人で埋まった。", "Zizou's face is projected on the Arc de Triomphe. The Champs-Élysées overflows."), eff: (p) => ({ d: { happy: 7 }, o: "joy" }) },
  { id: "w_sydney", real: 2000, scope: ["AU"], kind: "culture", emoji: "🏊", t: T("시드니 올림픽", "シドニーオリンピック", "The Sydney Olympics"), x: T("항구 위로 불꽃이 쏟아졌다. 온 나라가 축제였다.", "港の上に花火が降り注いだ。国中がお祭りだった。", "Fireworks rain over the harbor. The whole country is a party."), eff: (p) => ({ d: { happy: 6 }, o: "joy" }) },
  { id: "w_911", real: 2001, scope: ["US"], near: "*", kind: "social", emoji: "🕯️", t: T("세계가 멈춘 아침", "世界が止まった朝", "The Morning the World Stopped"), x: T("뉴욕에서 일어난 테러로 세계가 충격에 빠졌다. 사람들은 서로의 안부를 물었다.", "ニューヨークで起きたテロに世界が衝撃を受けた。人々は互いの安否を尋ねた。", "An attack in New York shocks the world. People call to check on each other."), eff: (p) => p.country === "US" ? { d: { happy: -8, social: 3 }, o: "lost" } : { d: { happy: -2 }, o: "far" } },
  { id: "w_wc2002", real: 2002, scope: ["KR", "JP"], kind: "culture", emoji: "⚽", t: T("한일 월드컵", "日韓ワールドカップ", "The Korea-Japan World Cup"), x: T("두 나라가 함께 월드컵을 열었다. 거리마다 붉은 옷과 파란 옷이 넘쳤다.", "二つの国が一緒にW杯を開いた。街は赤と青のユニフォームであふれた。", "Two nations co-host the World Cup. The streets overflow with red and blue jerseys."), eff: (p) => ({ d: { happy: p.country === "KR" ? 9 : 6, social: 3 }, o: "joy" }) },
  { id: "w_tsunami04", real: 2004, scope: ["IN"], near: "*", kind: "disaster", emoji: "🌊", t: T("인도양 쓰나미", "インド洋津波", "The Indian Ocean Tsunami"), x: T("거대한 파도가 해안 마을들을 덮쳤다. 세계가 함께 도왔다.", "巨大な波が海辺の村々を襲った。世界が一緒に助けた。", "A giant wave strikes coastal villages. The world comes together to help."), eff: (p) => p.country === "IN" ? { d: { happy: -5, social: 3, money: -100 }, o: "lost" } : { d: { happy: -1, social: 1 }, o: "far" } },
  { id: "w_de06", real: 2006, scope: ["DE"], kind: "culture", emoji: "⚽", t: T("독일 월드컵, 여름 동화", "ドイツW杯、夏のおとぎ話", "Germany's Summer Fairytale"), x: T("월드컵이 열린 여름, 온 나라가 국기를 흔들었다.", "W杯の夏、国中が国旗を振った。", "The World Cup summer — the whole country waves the flag."), eff: (p) => ({ d: { happy: 6 }, o: "joy" }) },
  { id: "w_smartphone", real: 2007, scope: "*", kind: "tech", emoji: "📱", t: T("손안의 컴퓨터", "手のひらのコンピューター", "A Computer in Your Pocket"), x: T("터치로 움직이는 휴대폰이 나왔다. 몇 년 뒤엔 모두가 고개를 숙이고 걸었다.", "タッチで動く携帯が出た。数年後にはみんながうつむいて歩いていた。", "A touch-screen phone arrives. A few years later, everyone walks with their head down."), eff: (p) => ({ d: { internet: 6, happy: 1 }, o: "learn" }) },
  { id: "w_gfc", real: 2008, scope: "*", kind: "econ", emoji: "🏦", t: T("세계 금융 위기", "世界金融危機", "The Global Financial Crisis"), x: T("큰 은행이 무너졌다. 전 세계 주식이 한꺼번에 곤두박질쳤다.", "大銀行が倒れた。世界中の株が一斉に急落した。", "A major bank collapses. Stock markets plunge worldwide at once."), econ: "crisis", eff: (p) => p.age < 18 ? { d: { happy: -1 }, o: "kidSaw" } : { d: { money: -Math.round(Math.max(0, p.stats.money) * (p.country === "US" ? 0.22 : 0.14) + 200), happy: -5 }, o: rich(p) ? "hitRich" : p.job ? "hitJob" : "hit" } },
  { id: "w_beijing", real: 2008, scope: ["CN"], kind: "culture", emoji: "🏟️", t: T("베이징 올림픽", "北京オリンピック", "The Beijing Olympics"), x: T("새 둥지 경기장에서 2008명이 북을 쳤다.", "鳥の巣スタジアムで2008人が太鼓を叩いた。", "2,008 drummers perform in the Bird's Nest stadium."), eff: (p) => ({ d: { happy: 6, social: 1 }, o: "joy" }) },
  { id: "w_tohoku", real: 2011, scope: ["JP"], near: "*", kind: "disaster", emoji: "🌊", t: T("동일본 대지진", "東日本大震災", "The Great East Japan Earthquake"), x: T("거대한 지진과 해일이 동북 지방을 덮쳤다. 모두가 서로를 걱정했다.", "巨大地震と津波が東北を襲った。みんなが互いを心配した。", "A massive earthquake and tsunami strike the northeast. Everyone worries for each other."), eff: (p) => p.country === "JP" ? { d: { happy: -8, health: -2, social: 3, money: p.housing === "own" ? -600 : -150 }, o: "lost" } : { d: { happy: -2, social: 1 }, o: "far" } },
  { id: "w_arab_spring", real: 2011, scope: ["EG"], kind: "social", emoji: "📢", t: T("타흐리르 광장", "タハリール広場", "Tahrir Square"), x: T("수많은 사람이 광장에 모였다. 나라가 크게 바뀌는 해였다.", "大勢の人が広場に集まった。国が大きく変わる年だった。", "Huge crowds gather in the square. A year of great change for the country."), eff: (p) => ({ d: p.age >= 16 ? { social: 3, happy: -2, money: -100 } : { happy: -1 }, o: p.age >= 16 ? "learn" : "kidSaw" }) },
  { id: "w_london12", real: 2012, scope: ["GB"], kind: "culture", emoji: "🏅", t: T("런던 올림픽", "ロンドンオリンピック", "The London Olympics"), x: T("세 번째 올림픽이 런던에서 열렸다. 금메달 소식이 이어졌다.", "三度目のオリンピックがロンドンで開かれた。金メダルの知らせが続いた。", "London hosts its third Olympics. Gold medal news keeps coming."), eff: (p) => ({ d: { happy: 5 }, o: "joy" }) },
  { id: "w_br14", real: 2014, scope: ["BR"], kind: "culture", emoji: "⚽", t: T("브라질 월드컵", "ブラジルW杯", "The Brazil World Cup"), x: T("축구의 나라에서 월드컵이 열렸다. 결과는… 다들 그 경기를 말하지 않으려 했다.", "サッカーの国でW杯が開かれた。結果は…みんなあの試合の話をしたがらなかった。", "The World Cup comes to the land of football. The result… nobody wants to talk about that match."), eff: (p) => ({ d: { happy: 2, social: 2 }, o: "watch" }) },
  { id: "w_brexit", real: 2016, scope: ["GB"], kind: "social", emoji: "🗳️", t: T("유럽을 떠나는 투표", "EU離脱の国民投票", "The Brexit Vote"), x: T("국민투표 결과, 나라가 유럽연합을 떠나기로 했다. 식탁마다 의견이 갈렸다.", "国民投票の結果、国はEUを離れることになった。食卓ごとに意見が割れた。", "The referendum decides to leave the EU. Every dinner table splits."), eff: (p) => ({ d: p.age >= 18 ? { social: -2, happy: -1 } : {}, o: "learn" }) },
  { id: "w_rio16", real: 2016, scope: ["BR"], kind: "culture", emoji: "🏟️", t: T("리우 올림픽", "リオオリンピック", "The Rio Olympics"), x: T("남미 첫 올림픽이 리우에서 열렸다.", "南米初のオリンピックがリオで開かれた。", "South America's first Olympics open in Rio."), eff: (p) => ({ d: { happy: 5 }, o: "joy" }) },
  { id: "w_bushfire", real: 2020, scope: ["AU"], kind: "disaster", emoji: "🔥", t: T("검은 여름", "ブラックサマー", "The Black Summer"), x: T("거대한 산불이 몇 달 동안 이어졌다. 하늘이 주황색이었다.", "巨大な山火事が何か月も続いた。空がオレンジ色だった。", "Huge bushfires burn for months. The sky turns orange."), eff: (p) => ({ d: { happy: -5, health: -2, social: 2 }, o: "lost" }) },
  { id: "w_pandemic", real: 2020, scope: "*", kind: "disaster", emoji: "😷", t: T("세계적 대유행", "世界的大流行", "The Pandemic"), x: T("새 감염병이 전 세계로 퍼졌다. 학교와 가게가 문을 닫고, 마스크가 일상이 됐다.", "新しい感染症が世界中に広がった。学校と店が閉まり、マスクが日常になった。", "A new disease spreads worldwide. Schools and shops close; masks become normal."), econ: "recession", eff: (p) => { const d = { happy: -5, social: -4 }; let o = "lost"; if (old(p) || p.stats.health < 35) { d.health = -8; o = "sick"; } if (p.age >= 18 && p.age < 65) { if (has(p, "developer", "streamer")) { d.money = 400; o = "gain"; } else if (has(p, "business", "artist", "idol") || !p.job) { d.money = -700; o = "hitJob"; } else if (has(p, "doctor")) { d.health = -3; d.happy = -8; o = "hitJob"; } } return { d, o }; } },
  { id: "w_gen_ai", real: 2023, scope: "*", kind: "tech", emoji: "🤖", t: T("말하는 인공지능", "話すAI", "AI That Talks Back"), x: T("묻는 말에 술술 대답하는 인공지능이 나왔다. 일하는 방식이 바뀌기 시작했다.", "質問にすらすら答えるAIが登場した。働き方が変わり始めた。", "An AI that answers anything appears. The way people work starts to change."), eff: (p) => ({ d: { internet: 4, intel: p.age < 40 ? 2 : 1, money: has(p, "developer") ? 300 : has(p, "writer", "artist") ? -200 : 0 }, o: has(p, "writer", "artist") ? "hitJob" : "learn" }) },
  // ---------- 가상의 미래 (실제 아님) ----------
  { id: "w_f_ai_coworker", fiction: 2034, scope: "*", kind: "tech", emoji: "🦾", t: T("[가상] 인공지능 동료", "[架空] AIの同僚", "[Fiction] AI Coworkers"), x: T("회사마다 인공지능 동료가 생겼다. 어떤 일은 사라지고, 어떤 일은 새로 생겼다.", "会社ごとにAIの同僚ができた。消えた仕事もあれば、新しく生まれた仕事もあった。", "Every company gets AI coworkers. Some jobs vanish; new ones appear."), eff: (p) => p.age < 20 ? { d: { intel: 2 }, o: "learn" } : { d: has(p, "worker", "corporate") ? { money: -400, happy: -3, intel: 2 } : has(p, "developer", "business") ? { money: 500, happy: 2 } : { intel: 2 }, o: has(p, "worker", "corporate") ? "hitJob" : "gain" } },
  { id: "w_f_heat", fiction: 2038, scope: "*", kind: "disaster", emoji: "🌡️", t: T("[가상] 가장 뜨거운 여름", "[架空] 最も暑い夏", "[Fiction] The Hottest Summer"), x: T("기록적인 더위가 몇 주 동안 이어졌다. 낮에는 거리가 텅 비었다.", "記録的な暑さが何週間も続いた。昼間は通りが空っぽだった。", "Record heat lasts for weeks. The streets are empty at noon."), eff: (p) => ({ d: old(p) || kid(p) ? { health: -5, happy: -3 } : { health: -2, happy: -2 }, o: old(p) ? "sick" : "lost" }) },
  { id: "w_f_4day", fiction: 2041, scope: "*", kind: "social", emoji: "🗓️", t: T("[가상] 주 4일 근무", "[架空] 週休3日制", "[Fiction] The Four-Day Week"), x: T("일주일에 나흘만 일하는 나라가 늘었다. 사람들은 남은 하루로 뭘 할지 고민했다.", "週4日だけ働く国が増えた。人々は残りの一日で何をするか悩んだ。", "More countries adopt a four-day week. People wonder what to do with the extra day."), eff: (p) => ({ d: p.job ? { happy: 6, health: 2 } : { happy: 1 }, o: p.job ? "gain" : "watch" }) },
  { id: "w_f_moon_trip", fiction: 2046, scope: "*", kind: "tech", emoji: "🚀", t: T("[가상] 달 여행 상품", "[架空] 月旅行ツアー", "[Fiction] Moon Tours"), x: T("일반인도 표를 사서 달에 갈 수 있게 됐다. 값은 아직 어마어마했다.", "一般人もチケットを買って月に行けるようになった。値段はまだとんでもなかった。", "Ordinary people can now buy tickets to the Moon. Still astronomically expensive."), eff: (p) => ({ d: { happy: 3, intel: 1 }, o: "watch" }) },
  { id: "w_f_climate_move", fiction: 2051, scope: "*", kind: "social", emoji: "🧳", t: T("[가상] 기후 이주", "[架空] 気候移住", "[Fiction] Climate Migration"), x: T("바닷가 도시들이 높은 곳으로 옮겨 가기 시작했다.", "海辺の都市が高台へ移り始めた。", "Coastal cities begin moving to higher ground."), eff: (p) => ({ d: { happy: -3, social: 2, money: p.housing === "own" ? -500 : -100 }, o: "hit" }) },
  { id: "w_f_longevity", fiction: 2057, scope: "*", kind: "tech", emoji: "🧬", t: T("[가상] 노화를 늦추는 치료", "[架空] 老化を遅らせる治療", "[Fiction] Slower Aging"), x: T("노화를 늦추는 치료가 처음 승인됐다. 백 살이 더 이상 꿈이 아니었다.", "老化を遅らせる治療が初めて承認された。百歳はもう夢ではなかった。", "The first treatment to slow aging is approved. A hundred is no longer a dream."), eff: (p) => ({ d: p.age >= 50 ? { health: 6, happy: 3, money: rich(p) ? -300 : 0 } : { happy: 1 }, o: p.age >= 50 ? "gain" : "watch" }) },
  { id: "w_f_robot_care", fiction: 2063, scope: "*", kind: "tech", emoji: "🤖", t: T("[가상] 돌봄 로봇", "[架空] 介護ロボット", "[Fiction] Care Robots"), x: T("집집마다 돌봄 로봇이 들어왔다. 할머니는 로봇에게 이름을 지어 줬다.", "家々に介護ロボットが入ってきた。おばあちゃんはロボットに名前をつけた。", "Care robots arrive in homes. Grandma gives hers a name."), eff: (p) => ({ d: old(p) ? { health: 4, happy: 3 } : { happy: 1 }, o: old(p) ? "gain" : "watch" }) },
  { id: "w_f_ocean_city", fiction: 2072, scope: "*", kind: "culture", emoji: "🏙️", t: T("[가상] 바다 위 도시", "[架空] 海上都市", "[Fiction] A City on the Sea"), x: T("바다 위에 떠 있는 첫 도시가 문을 열었다.", "海に浮かぶ最初の都市が開かれた。", "The first floating city opens on the ocean."), eff: (p) => ({ d: { happy: 2 }, o: "watch" }) },
];

// 해마다 무작위로 생기는 일 (가상 — 나라에 따라 확률이 다름). 같은 세상(같은 씨앗)이면 같은 해 같은 결과
export const RANDOM_WORLD = [
  { id: "wr_typhoon", kind: "disaster", emoji: "🌀", p: { KR: 0.05, JP: 0.07, CN: 0.05, IN: 0.04, US: 0.04, MX: 0.04, AU: 0.03 }, t: T("큰 태풍", "大型台風", "A Major Storm"), x: T("큰 태풍이 지나갔다. 지붕이 날아간 집도 있었다.", "大型台風が通り過ぎた。屋根が飛んだ家もあった。", "A major storm passes through. Some roofs are torn off."), eff: (p) => ({ d: { happy: -2, money: p.housing === "own" ? -300 : -50 }, o: "hit" }) },
  { id: "wr_quake", kind: "disaster", emoji: "🏚️", p: { JP: 0.05, MX: 0.03, CN: 0.02, IN: 0.02, US: 0.015 }, t: T("지진", "地震", "An Earthquake"), x: T("땅이 크게 흔들렸다. 다행히 이웃들이 서로를 챙겼다.", "大地が大きく揺れた。幸い近所の人が互いを気遣った。", "The ground shakes hard. Luckily, neighbors look out for each other."), eff: (p) => ({ d: { happy: -3, social: 2, money: p.housing === "own" ? -250 : -40 }, o: "lost" }) },
  { id: "wr_flood", kind: "disaster", emoji: "🌧️", p: { IN: 0.06, CN: 0.04, BR: 0.04, DE: 0.02, GB: 0.02, EG: 0.01, KR: 0.03 }, t: T("홍수", "洪水", "A Flood"), x: T("며칠 동안 비가 그치지 않았다. 낮은 동네가 물에 잠겼다.", "何日も雨が止まなかった。低い地区が水に浸かった。", "The rain doesn't stop for days. Low-lying neighborhoods flood."), eff: (p) => ({ d: { happy: -2, health: -1, money: -100 }, o: "hit" }) },
  { id: "wr_heat", kind: "disaster", emoji: "☀️", p: { IN: 0.05, EG: 0.06, AU: 0.05, FR: 0.02, US: 0.02, MX: 0.03 }, t: T("폭염", "猛暑", "A Heat Wave"), x: T("숨 막히는 더위가 이어졌다.", "息苦しい暑さが続いた。", "Suffocating heat drags on."), eff: (p) => ({ d: old(p) ? { health: -4 } : { health: -1, happy: -1 }, o: old(p) ? "sick" : "hit" }) },
  { id: "wr_fest", kind: "culture", emoji: "🎉", p: { "*": 0.05 }, t: T("나라 전체가 들뜬 날", "国中が浮かれた日", "A Day the Whole Country Celebrated"), x: T("국가대표 팀이 큰 대회에서 이겼다. 모르는 사람끼리도 하이파이브를 했다.", "代表チームが大きな大会で勝った。知らない人同士でもハイタッチした。", "The national team wins a big tournament. Strangers high-five in the street."), eff: (p) => ({ d: { happy: 4, social: 1 }, o: "joy" }) },
  { id: "wr_flu", kind: "disaster", emoji: "🤧", p: { "*": 0.03 }, t: T("독감 유행", "インフルエンザ流行", "A Flu Season"), x: T("독한 감기가 돌았다. 교실과 사무실이 반쯤 비었다.", "ひどい風邪が流行った。教室も職場も半分空いた。", "A nasty flu goes around. Classrooms and offices are half empty."), eff: (p) => ({ d: old(p) || p.stats.health < 40 ? { health: -5 } : { health: -1 }, o: old(p) || p.stats.health < 40 ? "sick" : "hit" }) },
];

// ---------- 해마다 세계 사건 정하기 (씨앗 고정 → 같은 세상이면 같은 결과) ----------
function hash(a, b) { let h = 2166136261 ^ a; h = Math.imul(h ^ b, 16777619); h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
/** 그 해(달력)의 세계 사건 목록. countries: 이 세상에 사는 사람들의 나라 (무작위 사건 후보) */
export function worldEventsOf(w, cal, countries = ["KR"]) {
  if (!w) return [];
  w.seed ||= Math.floor(Math.random() * 1e9);
  w.wev ||= {};
  if (w.wev[cal]) return w.wev[cal];
  const out = [];
  for (const e of WORLD_EVENTS) if ((e.real === cal || e.fiction === cal) && (e.scope === "*" || e.scope.some(c => countries.includes(c)) || (e.near && (e.near === "*" || e.near.some(c => countries.includes(c)))))) out.push(e.id);
  let k = 0;
  for (const r of RANDOM_WORLD) { k++; const hit = countries.filter(c => { const pr = (r.p[c] ?? r.p["*"] ?? 0) * 0.55; return hash(w.seed + k * 7919, cal * 31 + c.charCodeAt(0) * 3 + c.charCodeAt(1)) < pr; }); if (hit.length && out.length < 3) out.push(r.id + ":" + hit.join(",")); }
  w.wev[cal] = out;
  // 너무 오래된 기록은 지움 (저장 크기)
  const ks = Object.keys(w.wev); if (ks.length > 140) for (const x of ks.slice(0, ks.length - 140)) delete w.wev[x];
  return out;
}
// 역사 사건(HistoricalEvent) → 같은 모양으로: 시작 연도에 한 번, 그 나라 사람에게 개인 영향
for (const h of HIST_KR) WORLD_EVENTS.push({ ...h, real: h.year, scope: [h.country] });
for (const e of WORLD_EVENTS) if (!e.src && SRC_OF[e.id]) e.src = SRC_OF[e.id];
Object.assign(OUT, HIST_OUT);
const BY_ID = Object.fromEntries([...WORLD_EVENTS, ...RANDOM_WORLD].map(e => [e.id, e]));
export const worldEventById = (id) => BY_ID[String(id).split(":")[0]] || null;
/** 한 사람에게 세계 사건 적용 → 기록 { id, d, o, mine } (이미 적용했으면 null) */
export function applyWorldEvent(p, wid, addStat) {
  const [id, list] = String(wid).split(":"); const e = BY_ID[id]; if (!e) return null;
  p.wevSeen ||= {}; const cal = (p.birthYear || 2000) + p.age; if (p.wevSeen[id] === cal) return null; p.wevSeen[id] = cal;
  const ctry = p.country || "KR";
  const local = list ? list.split(",").includes(ctry) : e.scope === "*" || e.scope.includes(ctry);
  let r;
  if (local) r = e.eff(p);
  else r = { d: {}, o: "far" };                         // 다른 나라에서 일어난 일: 소식만 (그 나라 친구가 있으면 화면이 따로 알려 줌)
  const d = {};
  for (const [k, v] of Object.entries(r.d || {})) { if (!v) continue; const vv = k === "money" ? Math.round(v * (p.incomeMul || 1)) : v; addStat(p, k, vv); d[k] = vv; }
  return { id, real: !!e.real && cal < 2026, fiction: !!e.fiction || cal >= 2026, emoji: e.emoji, kind: e.kind, d, o: r.o || "hit", mine: local, where: list ? list.split(",") : e.scope === "*" ? ["*"] : e.scope, areas: e.areas || null, until: e.until || null };
}
export const WORLD_OUT = OUT;
