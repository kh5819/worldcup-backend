// 상식 문항 번역 묶음 4 (know-bank-i18n.js가 합침) — 형식: 문항ID: { ja: {...}, en: {...} } · 배열 순서는 원문과 같음
export default {
  E0005: {
    ja: { q: "一国の中で一定期間に新しく生み出された商品・サービスの価値をすべて合計した「国内総生産」の略称は？", exp: "GDP（Gross Domestic Product）です。CPIは消費者物価指数、IMFは国際通貨基金です。", opts: ["GDP", "GNP", "CPI", "IMF"] },
    en: { q: "What's the abbreviation for 'gross domestic product' — the total value of goods and services a country produces in a period?", exp: "GDP (Gross Domestic Product). CPI is the Consumer Price Index; the IMF is the International Monetary Fund.", opts: ["GDP", "GNP", "CPI", "IMF"] },
  },
  E0006: {
    ja: { q: "消費者が買う商品・サービスの価格変動を示す「消費者物価指数」の略称は？", exp: "CPI（Consumer Price Index）です。PPIは生産者物価指数、PERは株価収益率です。", opts: ["CPI", "GDP", "PPI", "PER"] },
    en: { q: "What's the abbreviation for the index that tracks prices of goods and services consumers buy?", exp: "CPI (Consumer Price Index). PPI is the Producer Price Index; PER is the price-to-earnings ratio.", opts: ["CPI", "GDP", "PPI", "PER"] },
  },
  E0007: {
    ja: { q: "コンピューターの「頭脳」の役割をする中央処理装置の略称は？", exp: "CPU（Central Processing Unit）です。GPUは画像処理、RAMは一時記憶、SSDは記憶装置です。", opts: ["CPU", "GPU", "RAM", "SSD"] },
    en: { q: "What's the abbreviation for the central processing unit, the computer's 'brain'?", exp: "CPU (Central Processing Unit). The GPU handles graphics, RAM is working memory, and an SSD is storage.", opts: ["CPU", "GPU", "RAM", "SSD"] },
  },
  E0008: {
    ja: { q: "昔のデンマーク王のあだ名「青い歯」から名付けられた近距離無線接続技術は？", exp: "Bluetoothは10世紀のデンマーク王ハーラル・ブロタン（ハーラル青歯王）のあだ名に由来します。", opts: ["Bluetooth", "Wi-Fi", "NFC", "LTE"] },
    en: { q: "Which short-range wireless technology is named after an old Danish king's nickname?", exp: "Bluetooth is named after 10th-century Danish king Harald 'Bluetooth' Gormsson.", opts: ["Bluetooth", "Wi-Fi", "NFC", "LTE"] },
  },
  E0009: {
    ja: { q: "1989年にワールド・ワイド・ウェブ（WWW）を初めて提案したのは？", exp: "CERNで働いていたティム・バーナーズ＝リーが1989年に提案しました。", opts: ["ティム・バーナーズ＝リー", "ビル・ゲイツ", "スティーブ・ジョブズ", "アラン・チューリング"] },
    en: { q: "Who first proposed the World Wide Web in 1989?", exp: "Tim Berners-Lee proposed it in 1989 while working at CERN.", opts: ["Tim Berners-Lee", "Bill Gates", "Steve Jobs", "Alan Turing"] },
  },
  E0010: {
    ja: { q: "機械が人間のように考えるかを調べるテストに名前が付いたイギリスの数学者は？", exp: "チューリング・テストは1950年にアラン・チューリングが提案しました。彼はコンピューター科学の父と呼ばれます。", opts: ["アラン・チューリング", "ジョン・フォン・ノイマン", "チャールズ・バベッジ", "クロード・シャノン"] },
    en: { q: "Which British mathematician gave his name to a test of whether a machine can think like a human?", exp: "Alan Turing proposed the Turing test in 1950. He's called the father of computer science.", opts: ["Alan Turing", "John von Neumann", "Charles Babbage", "Claude Shannon"] },
  },
  E0011: {
    ja: { q: "インターネット・通信の出来事を古い順に並べてください。", exp: "電子メール 1971年 → TCP/IP移行 1983年 → WWW提案 1989年 → iPhone 2007年。", events: ["初のネットワーク電子メール送信（レイ・トムリンソン）", "ARPANETがTCP/IPに移行", "ワールド・ワイド・ウェブの提案", "初代iPhone発表"] },
    en: { q: "Put these internet and communication events in order, oldest first.", exp: "Email 1971 → switch to TCP/IP 1983 → WWW proposed 1989 → iPhone 2007.", events: ["First networked email sent (Ray Tomlinson)", "ARPANET switches to TCP/IP", "World Wide Web proposed", "First iPhone unveiled"] },
  },
  E0012: {
    ja: { q: "お金の常識のうちフェイクを選んでください。", exp: "預金保険制度は1つの金融機関につき決まった上限額までしか保護しません。上限を超える分は戻らないことがあります。", stmts: ["クレジットカードで支払うと、お金を後で返すことになる。", "預金保険制度は、銀行がつぶれても預けたお金を金額の上限なく全額返してくれる。", "自国通貨が安くなると、同じ1ドルを買うのに多くの自国通貨が必要になる。"] },
    en: { q: "Which money fact is fake?", exp: "Deposit insurance only covers up to a set limit per institution. Money above the limit may not be returned.", stmts: ["Paying by credit card means you pay the money back later.", "If a bank fails, deposit insurance returns all your money with no limit.", "When your currency weakens, buying one US dollar costs more of it."] },
  },
  E0101: {
    ja: { q: "QRコードは日本の会社デンソーウェーブが最初に開発した。", exp: "QRコードは1994年にデンソーウェーブが自動車部品の管理用に開発しました。" },
    en: { q: "The QR code was first developed by the Japanese company Denso Wave.", exp: "Denso Wave developed the QR code in 1994 to track automotive parts." },
  },
  E0013: {
    ja: { q: "株価が長く大きく上がる相場を動物にたとえた呼び方は？", exp: "雄牛が角を突き上げる姿にたとえて上昇相場をブル・マーケット、熊が前足を振り下ろす姿にたとえて下落相場をベア・マーケットといいます。", opts: ["ブル・マーケット（雄牛）", "ベア・マーケット（熊）", "シカ相場", "カメ相場"] },
    en: { q: "What animal-themed name is given to a market where stock prices rise strongly for a long time?", exp: "A rising market is a bull market (a bull thrusts its horns up); a falling one is a bear market (a bear swipes down).", opts: ["Bull market", "Bear market", "Deer market", "Turtle market"] },
  },
  E0014: {
    ja: { q: "スマートフォンのOS「Android」を主導してきた会社は？", exp: "Androidは2005年にGoogleが買収した後、開発を続けてきました。AppleのiPhoneはiOSを使います。", opts: ["Google", "Apple", "Microsoft", "Nokia"] },
    en: { q: "Which company has led the development of the Android smartphone OS?", exp: "Google acquired Android in 2005 and has developed it since. Apple's iPhone uses iOS.", opts: ["Google", "Apple", "Microsoft", "Nokia"] },
  },
  M0001: {
    ja: { q: "次のうちフェイクを選んでください。", exp: "オリンピックの五輪旗の輪は5つで、5つの大陸の結びつきを表します。", stmts: ["虹は太陽の光が水滴で屈折・反射してできる。", "オリンピックの五輪旗の輪は6つである。", "1週間は7日である。"] },
    en: { q: "Which of these is fake?", exp: "The Olympic flag has five rings, standing for the union of five continents.", stmts: ["A rainbow forms when sunlight is bent and reflected by water droplets.", "The Olympic flag has six rings.", "A week has seven days."] },
  },
  M0101: {
    ja: { q: "バナナは木ではなく、大きな草（多年草）に実る。", exp: "バナナの「木」の幹に見える部分は、葉柄が何重にも巻いた偽茎です。そのため植物学的には草です。" },
    en: { q: "Bananas grow on a giant herb (perennial plant), not a tree.", exp: "What looks like a banana 'trunk' is a pseudostem of tightly rolled leaf stalks, so botanically it's an herb." },
  },
  M0201: {
    ja: { q: "1年はおよそ何週でしょう？（整数）", exp: "365日 ÷ 7日 ≈ 52.1なので、1年は約52週です。", unit: "週" },
    en: { q: "About how many weeks are in a year? (whole number)", exp: "365 days ÷ 7 ≈ 52.1, so a year is about 52 weeks.", unit: "weeks" },
  },
  M0202: {
    ja: { q: "チェスを始めるとき、1人が持つ駒は全部で何個でしょう？", exp: "ポーン8個、ルーク・ナイト・ビショップ各2個、クイーン1個、キング1個で16個です。", unit: "個" },
    en: { q: "How many pieces does each player start with in chess?", exp: "8 pawns, 2 each of rooks, knights and bishops, 1 queen and 1 king — 16 pieces.", unit: "pieces" },
  },
  M0006: {
    ja: { q: "次のうち哺乳類でないものは？", exp: "サメはえらで呼吸する魚（軟骨魚類）です。クジラ・イルカ・アザラシは子を産んで乳で育てる哺乳類です。", opts: ["サメ", "クジラ", "イルカ", "アザラシ"] },
    en: { q: "Which of these is NOT a mammal?", exp: "Sharks are fish (cartilaginous fish) that breathe with gills. Whales, dolphins and seals give birth and nurse their young.", opts: ["Shark", "Whale", "Dolphin", "Seal"] },
  },
  M0003: {
    ja: { q: "プッチーニのオペラ「トゥーランドット」の舞台となる国は？", exp: "「トゥーランドット」は昔の中国・北京を舞台にしたオペラです。アリア「誰も寝てはならぬ」が有名です。", opts: ["中国", "日本", "ペルシャ", "インド"] },
    en: { q: "In which country is Puccini's opera Turandot set?", exp: "Turandot is set in old Peking (Beijing), China. Its aria 'Nessun dorma' is famous.", opts: ["China", "Japan", "Persia", "India"] },
  },
  M0004: {
    ja: { q: "二十四節気の「立春」は、どの季節が始まるという意味でしょう？", exp: "立春は春の始まりという意味で、2月4日ごろです。立夏は夏、立秋は秋、立冬は冬の始まりです。", opts: ["春", "夏", "秋", "冬"] },
    en: { q: "In the East Asian 24 solar terms, 'Lichun' marks the start of which season?", exp: "Lichun means 'beginning of spring', around February 4. Lixia, Liqiu and Lidong mark the start of summer, autumn and winter.", opts: ["Spring", "Summer", "Autumn", "Winter"] },
  },
  M0005: {
    ja: { q: "チリとアルゼンチンの公用語は？", exp: "両国ともスペイン語を使います。南米ではブラジルがポルトガル語を使います。", opts: ["スペイン語", "ポルトガル語", "英語", "フランス語"] },
    en: { q: "What is the official language of Chile and Argentina?", exp: "Both use Spanish. In South America, Brazil speaks Portuguese.", opts: ["Spanish", "Portuguese", "English", "French"] },
  },
  W0009: {
    ja: { q: "世界で最も人口が多い大陸は？", exp: "アジアには世界人口の半分以上が住んでいます。インドと中国が人口の最も多い2か国です。", opts: ["アジア", "アフリカ", "ヨーロッパ", "南アメリカ"] },
    en: { q: "Which continent has the largest population?", exp: "More than half the world's people live in Asia. India and China are the two most populous countries.", opts: ["Asia", "Africa", "Europe", "South America"] },
  },
  W0010: {
    ja: { q: "日本の首都はどこでしょう？", exp: "日本の首都は東京です。京都は昔の都（約千年間）でした。", opts: ["東京", "大阪", "京都", "横浜"] },
    en: { q: "What is the capital of Japan?", exp: "Japan's capital is Tokyo. Kyoto was the old capital for about a thousand years.", opts: ["Tokyo", "Osaka", "Kyoto", "Yokohama"] },
  },
  W0011: {
    ja: { q: "アメリカの首都はどこでしょう？", exp: "アメリカの首都はワシントンD.C.です。最大の都市はニューヨークです。", opts: ["ワシントンD.C.", "ニューヨーク", "ロサンゼルス", "シカゴ"] },
    en: { q: "What is the capital of the United States?", exp: "The US capital is Washington, D.C. The largest city is New York.", opts: ["Washington, D.C.", "New York", "Los Angeles", "Chicago"] },
  },
  W0012: {
    ja: { q: "世界で最も長い川とよく言われるアフリカの川は？", exp: "ナイル川は約6,650kmで、最も長い川とよく言われます。アマゾン川は流れる水の量が最も多い川です。", opts: ["ナイル川", "アマゾン川", "長江", "ミシシッピ川"] },
    en: { q: "Which African river is usually named the longest in the world?", exp: "The Nile, about 6,650 km, is usually named the longest. The Amazon carries the most water.", opts: ["Nile", "Amazon", "Yangtze", "Mississippi"] },
  },
  W0013: {
    ja: { q: "世界で最も大きい島は？（オーストラリア大陸を除く）", exp: "グリーンランドが約217万㎢で最大の島です。デンマークに属する自治領です。", opts: ["グリーンランド", "ボルネオ島", "マダガスカル島", "ニューギニア島"] },
    en: { q: "What is the largest island in the world? (not counting Australia)", exp: "Greenland, about 2.17 million km², is the largest island. It's an autonomous territory of Denmark.", opts: ["Greenland", "Borneo", "Madagascar", "New Guinea"] },
  },
  W0014: {
    ja: { q: "南アメリカの西側に沿って長く延びる、世界で最も長い山脈は？", exp: "アンデス山脈は約7,000kmで、陸上で最も長い山脈です。", opts: ["アンデス山脈", "ロッキー山脈", "アルプス山脈", "ヒマラヤ山脈"] },
    en: { q: "Which mountain range, running along western South America, is the longest in the world?", exp: "The Andes, about 7,000 km long, are the longest mountain range on land.", opts: ["Andes", "Rocky Mountains", "Alps", "Himalayas"] },
  },
  W0015: {
    ja: { q: "イタリア・ローマの中にある、世界で最も小さい国は？", exp: "バチカン市国は面積約0.44㎢で最も小さい国です。ローマ教皇がいる場所です。", opts: ["バチカン市国", "モナコ", "サンマリノ", "リヒテンシュタイン"] },
    en: { q: "What is the smallest country in the world, located inside Rome, Italy?", exp: "Vatican City, about 0.44 km², is the smallest country — home of the Pope.", opts: ["Vatican City", "Monaco", "San Marino", "Liechtenstein"] },
  },
  W0016: {
    ja: { q: "南アメリカで海に面していない内陸国は？", exp: "南アメリカの内陸国はボリビアとパラグアイの2か国です。", opts: ["ボリビア", "ペルー", "チリ", "コロンビア"] },
    en: { q: "Which of these South American countries is landlocked?", exp: "South America's landlocked countries are Bolivia and Paraguay.", opts: ["Bolivia", "Peru", "Chile", "Colombia"] },
  },
  W0020: {
    ja: { q: "経度0°の本初子午線が通る天文台があるロンドンの地区は？", exp: "1884年の国際会議で、グリニッジ天文台を通る線が経度0°と定められました。", opts: ["グリニッジ", "オックスフォード", "ケンブリッジ", "エディンバラ"] },
    en: { q: "The prime meridian (0° longitude) runs through an observatory in which part of London?", exp: "An 1884 international conference set the line through the Greenwich observatory as 0° longitude.", opts: ["Greenwich", "Oxford", "Cambridge", "Edinburgh"] },
  },
  W0021: {
    ja: { q: "世界で最も深い海の谷（海溝）は？", exp: "太平洋西部のマリアナ海溝にあるチャレンジャー海淵は深さ約11,000mです。", opts: ["マリアナ海溝", "プエルトリコ海溝", "日本海溝", "ジャワ海溝"] },
    en: { q: "What is the deepest ocean trench in the world?", exp: "The Challenger Deep in the Mariana Trench, western Pacific, is about 11,000 m deep.", opts: ["Mariana Trench", "Puerto Rico Trench", "Japan Trench", "Java Trench"] },
  },
  W0022: {
    ja: { q: "アフリカで最も高い山は？", exp: "タンザニアのキリマンジャロ（約5,895m）です。モンブランはアルプス、アコンカグアは南アメリカの最高峰です。", opts: ["キリマンジャロ", "ケニア山", "モンブラン", "アコンカグア"] },
    en: { q: "What is the highest mountain in Africa?", exp: "Tanzania's Kilimanjaro (about 5,895 m). Mont Blanc tops the Alps, and Aconcagua is South America's highest.", opts: ["Kilimanjaro", "Mount Kenya", "Mont Blanc", "Aconcagua"] },
  },
  W0023: {
    ja: { q: "面積で世界最大の湖で、名前に「海」がつくのは？", exp: "カスピ海は海水のように塩辛いものの、海とつながっていない湖です。面積は約37万㎢です。", opts: ["カスピ海", "死海", "バイカル湖", "スペリオル湖"] },
    en: { q: "The world's largest lake by area has 'Sea' in its name. Which is it?", exp: "The Caspian Sea is salty like the ocean but not connected to it — it's a lake of about 370,000 km².", opts: ["Caspian Sea", "Dead Sea", "Lake Baikal", "Lake Superior"] },
  },
  W0024: {
    ja: { q: "世界で最も深く古い湖として知られるロシアの湖は？", exp: "シベリアのバイカル湖は深さが約1,600mを超え、最も深い湖です。", opts: ["バイカル湖", "タンガニーカ湖", "ラドガ湖", "オネガ湖"] },
    en: { q: "Which Russian lake is known as the deepest and oldest in the world?", exp: "Siberia's Lake Baikal is over about 1,600 m deep — the deepest lake.", opts: ["Lake Baikal", "Lake Tanganyika", "Lake Ladoga", "Lake Onega"] },
  },
  W0106: { ja: { q: "地図でブラジルを探してタップしてください。", exp: "ブラジルは南アメリカ東部の最も広い国です。" }, en: { q: "Find Brazil on the map and tap it.", exp: "Brazil is the largest country, on the east side of South America." } },
  W0107: { ja: { q: "地図でインドを探してタップしてください。", exp: "インドは南アジアの大きな半島の国で、西にパキスタン、東にバングラデシュがあります。" }, en: { q: "Find India on the map and tap it.", exp: "India is a large peninsula nation in South Asia, with Pakistan to the west and Bangladesh to the east." } },
  W0108: { ja: { q: "地図でトルコを探してタップしてください。", exp: "トルコはアジアとヨーロッパにまたがる国で、黒海と地中海の間にあります。" }, en: { q: "Find Türkiye on the map and tap it.", exp: "Türkiye spans Asia and Europe, between the Black Sea and the Mediterranean." } },
  W0109: { ja: { q: "地図でケニアを探してタップしてください。", exp: "ケニアはアフリカ東部の、赤道が通る国です。北にエチオピアがあります。" }, en: { q: "Find Kenya on the map and tap it.", exp: "Kenya is in East Africa, on the equator, with Ethiopia to the north." } },
  W0110: { ja: { q: "地図でメキシコを探してタップしてください。", exp: "メキシコはアメリカのすぐ南、北アメリカ南部にあります。" }, en: { q: "Find Mexico on the map and tap it.", exp: "Mexico is directly south of the United States, in southern North America." } },
  W0111: { ja: { q: "地図でポーランドを探してタップしてください。", exp: "ポーランドはドイツの東、ウクライナの西にある中央ヨーロッパの国です。" }, en: { q: "Find Poland on the map and tap it.", exp: "Poland is in central Europe, east of Germany and west of Ukraine." } },
  W0112: { ja: { q: "地図でモンゴルを探してタップしてください。", exp: "モンゴルは中国とロシアの間にある海のない国です。" }, en: { q: "Find Mongolia on the map and tap it.", exp: "Mongolia is a landlocked country between China and Russia." } },
  W0113: { ja: { q: "地図でペルーを探してタップしてください。", exp: "ペルーは南アメリカ西部、エクアドルの南・チリの北にあります。" }, en: { q: "Find Peru on the map and tap it.", exp: "Peru is in western South America, south of Ecuador and north of Chile." } },
  W0114: { ja: { q: "地図でウズベキスタンを探してタップしてください。", exp: "ウズベキスタンは中央アジアにあり、北にカザフスタンがあります。" }, en: { q: "Find Uzbekistan on the map and tap it.", exp: "Uzbekistan is in Central Asia, with Kazakhstan to the north." } },
  W0115: { ja: { q: "地図でナイジェリアを探してタップしてください。", exp: "ナイジェリアはアフリカ西部のギニア湾に面した国で、アフリカで最も人口が多い国です。" }, en: { q: "Find Nigeria on the map and tap it.", exp: "Nigeria is in West Africa on the Gulf of Guinea — Africa's most populous country." } },
  W0203: {
    ja: { q: "国と首都を正しく結んでください。", exp: "タイ＝バンコク、ベトナム＝ハノイ（最大の都市はホーチミン）、インド＝ニューデリー、エジプト＝カイロです。", pairs: [["タイ", "バンコク"], ["ベトナム", "ハノイ"], ["インド", "ニューデリー"], ["エジプト", "カイロ"]] },
    en: { q: "Match each country with its capital.", exp: "Thailand = Bangkok, Vietnam = Hanoi (largest city: Ho Chi Minh City), India = New Delhi, Egypt = Cairo.", pairs: [["Thailand", "Bangkok"], ["Vietnam", "Hanoi"], ["India", "New Delhi"], ["Egypt", "Cairo"]] },
  },
  W0204: {
    ja: { q: "川・山脈とそれがある大陸を結んでください。", exp: "アマゾン川は南アメリカ、ナイル川はアフリカ、アルプス山脈はヨーロッパ、ロッキー山脈は北アメリカにあります。", pairs: [["アマゾン川", "南アメリカ"], ["ナイル川", "アフリカ"], ["アルプス山脈", "ヨーロッパ"], ["ロッキー山脈", "北アメリカ"]] },
    en: { q: "Match each river or mountain range with its continent.", exp: "The Amazon is in South America, the Nile in Africa, the Alps in Europe and the Rockies in North America.", pairs: [["Amazon River", "South America"], ["Nile River", "Africa"], ["Alps", "Europe"], ["Rocky Mountains", "North America"]] },
  },
  W0301: { ja: { q: "オーストラリアは南半球にある。", exp: "オーストラリアは赤道の南、南半球にあるので12月が夏です。" }, en: { q: "Australia is in the Southern Hemisphere.", exp: "Australia lies south of the equator, so December is summer there." } },
  W0302: { ja: { q: "ロシアはヨーロッパとアジアにまたがっている。", exp: "ウラル山脈を境に、西はヨーロッパ、東（シベリア）はアジアです。" }, en: { q: "Russia spans both Europe and Asia.", exp: "The Ural Mountains divide it: west is Europe, east (Siberia) is Asia." } },
  W0303: { ja: { q: "カナダはアメリカより国土面積が広い。", exp: "カナダは約998万㎢でロシアに次いで広い国です。アメリカは約983万㎢です。" }, en: { q: "Canada has a larger total area than the United States.", exp: "Canada, about 9.98 million km², is second only to Russia. The US is about 9.83 million km²." } },
  W0501: {
    ja: { q: "地理の話のうちフェイクを選んでください。", exp: "アルプス山脈はヨーロッパ（フランス・スイス・イタリア・オーストリアなど）にあります。", stmts: ["パナマ運河は大西洋と太平洋を結ぶ。", "スエズ運河は地中海と紅海を結ぶ。", "アルプス山脈は南アメリカにある。"] },
    en: { q: "Which geography fact is fake?", exp: "The Alps are in Europe (France, Switzerland, Italy, Austria and more).", stmts: ["The Panama Canal links the Atlantic and Pacific oceans.", "The Suez Canal links the Mediterranean and the Red Sea.", "The Alps are in South America."] },
  },
  S0011: {
    ja: { q: "水の化学式は？", exp: "水は水素原子2個と酸素原子1個でできていてH2Oです。CO2は二酸化炭素、NaClは食塩（塩化ナトリウム）です。", opts: ["H2O", "CO2", "O2", "NaCl"] },
    en: { q: "What is the chemical formula for water?", exp: "Water is two hydrogen atoms and one oxygen atom: H2O. CO2 is carbon dioxide; NaCl is table salt.", opts: ["H2O", "CO2", "O2", "NaCl"] },
  },
  S0012: {
    ja: { q: "地球が太陽の周りを1周するのにかかる時間は？", exp: "地球の公転周期は約365.25日、つまり1年です。自分で回る自転は約1日です。", opts: ["約1年", "約1か月", "約1日", "約10年"] },
    en: { q: "How long does Earth take to go around the Sun once?", exp: "Earth's orbit takes about 365.25 days — one year. Its spin on its axis takes about a day.", opts: ["About a year", "About a month", "About a day", "About 10 years"] },
  },
  S0013: {
    ja: { q: "太陽系で太陽に最も近い惑星は？", exp: "水星が最も近く、次に金星、地球、火星の順です。", opts: ["水星", "金星", "火星", "地球"] },
    en: { q: "Which planet is closest to the Sun?", exp: "Mercury is closest, followed by Venus, Earth and Mars.", opts: ["Mercury", "Venus", "Mars", "Earth"] },
  },
  S0014: {
    ja: { q: "赤い土のため「赤い惑星」と呼ばれる惑星は？", exp: "火星の表面の酸化鉄（さびた鉄）の成分のため赤く見えます。", opts: ["火星", "金星", "木星", "水星"] },
    en: { q: "Which planet is called the 'Red Planet' because of its red soil?", exp: "Iron oxide (rust) on Mars's surface makes it look red.", opts: ["Mars", "Venus", "Jupiter", "Mercury"] },
  },
  S0015: {
    ja: { q: "植物の細胞で光合成が行われる場所は？", exp: "葉緑体の中の葉緑素が光を受けて光合成をします。ミトコンドリアはエネルギーを作る場所です。", opts: ["葉緑体", "ミトコンドリア", "核", "細胞壁"] },
    en: { q: "Where in a plant cell does photosynthesis happen?", exp: "Chlorophyll inside chloroplasts captures light for photosynthesis. Mitochondria produce energy.", opts: ["Chloroplast", "Mitochondrion", "Nucleus", "Cell wall"] },
  },
  S0016: {
    ja: { q: "1953年にDNAの二重らせん構造を明らかにした科学者たちは？", exp: "ジェームズ・ワトソンとフランシス・クリックが発表し、1962年にモーリス・ウィルキンスとともにノーベル賞を受賞しました。", opts: ["ワトソンとクリック", "メンデルとダーウィン", "キュリー夫妻", "パスツールとコッホ"] },
    en: { q: "Which scientists revealed the double-helix structure of DNA in 1953?", exp: "James Watson and Francis Crick published it and shared the 1962 Nobel Prize with Maurice Wilkins.", opts: ["Watson and Crick", "Mendel and Darwin", "The Curies", "Pasteur and Koch"] },
  },
  S0017: {
    ja: { q: "「万有引力の法則」を発表した科学者は？", exp: "ニュートンが1687年に『プリンキピア』で発表しました。", opts: ["アイザック・ニュートン", "ガリレオ・ガリレイ", "アルベルト・アインシュタイン", "ヨハネス・ケプラー"] },
    en: { q: "Which scientist published the law of universal gravitation?", exp: "Newton published it in his Principia in 1687.", opts: ["Isaac Newton", "Galileo Galilei", "Albert Einstein", "Johannes Kepler"] },
  },
  S0018: {
    ja: { q: "1928年に青カビから抗生物質ペニシリンを発見した科学者は？", exp: "フレミングが発見し、1945年にフローリー、チェーンとともにノーベル生理学・医学賞を受賞しました。", opts: ["アレクサンダー・フレミング", "ルイ・パスツール", "エドワード・ジェンナー", "ロベルト・コッホ"] },
    en: { q: "Which scientist discovered penicillin in mold in 1928?", exp: "Fleming discovered it and shared the 1945 Nobel Prize in Physiology or Medicine with Florey and Chain.", opts: ["Alexander Fleming", "Louis Pasteur", "Edward Jenner", "Robert Koch"] },
  },
  S0019: {
    ja: { q: "天然痘を防ぐ種痘（牛痘接種）を初めて開発したのは？", exp: "イギリスの医師エドワード・ジェンナーが1796年に開発しました。池錫永（チ・ソギョン）は朝鮮に種痘を広めた人物です。", opts: ["エドワード・ジェンナー", "ルイ・パスツール", "アレクサンダー・フレミング", "池錫永"] },
    en: { q: "Who first developed vaccination against smallpox (using cowpox)?", exp: "English doctor Edward Jenner developed it in 1796. Ji Seok-young later spread smallpox vaccination in Korea.", opts: ["Edward Jenner", "Louis Pasteur", "Alexander Fleming", "Ji Seok-young"] },
  },
  S0020: {
    ja: { q: "水が凍って氷になると、体積はどうなるでしょう？", exp: "水は凍ると体積が約9%増えます。だから氷は水に浮き、凍った瓶が割れることもあります。", opts: ["増える", "減る", "変わらない", "半分になる"] },
    en: { q: "When water freezes into ice, what happens to its volume?", exp: "Water expands by about 9% when it freezes. That's why ice floats and frozen bottles can crack.", opts: ["It increases", "It decreases", "It stays the same", "It halves"] },
  },
  S0021: {
    ja: { q: "空気中に最も多く含まれている気体は？", exp: "空気の約78%が窒素、約21%が酸素です。", opts: ["窒素", "酸素", "二酸化炭素", "アルゴン"] },
    en: { q: "Which gas makes up most of the air?", exp: "Air is about 78% nitrogen and about 21% oxygen.", opts: ["Nitrogen", "Oxygen", "Carbon dioxide", "Argon"] },
  },
  S0022: {
    ja: { q: "稲妻が光った後、雷鳴が遅れて聞こえる理由は？", exp: "稲妻と雷鳴は同時に起こりますが、光は1秒に約30万km、音は約340m進むので、音が遅れて届きます。", opts: ["光が音よりはるかに速いから", "音が光より速いから", "雷鳴が稲妻よりずっと後に起こるから", "耳が目より遅く反応するから"] },
    en: { q: "Why do you hear thunder after you see lightning?", exp: "They happen at the same moment, but light travels about 300,000 km per second and sound only about 340 m, so the sound arrives later.", opts: ["Light is much faster than sound", "Sound is faster than light", "Thunder happens long after lightning", "Ears react slower than eyes"] },
  },
  S0023: {
    ja: { q: "金（gold）の元素記号は？", exp: "金はラテン語aurumからAuです。Agは銀、Alはアルミニウムです。", opts: ["Au", "Ag", "Al", "Gd"] },
    en: { q: "What is the chemical symbol for gold?", exp: "Gold is Au, from the Latin aurum. Ag is silver and Al is aluminum.", opts: ["Au", "Ag", "Al", "Gd"] },
  },
  S0024: {
    ja: { q: "地震が出したエネルギーの大きさを表す値は？", exp: "マグニチュードは地震そのもののエネルギーの大きさ、震度は場所ごとの揺れや被害の程度です。震源は地中の発生地点、震央はその真上の地表です。", opts: ["マグニチュード", "震度", "震央", "震源"] },
    en: { q: "Which value measures the energy released by an earthquake?", exp: "Magnitude is the quake's energy; intensity is how strongly each place shakes. The focus is the underground origin; the epicenter is the surface point above it.", opts: ["Magnitude", "Intensity", "Epicenter", "Focus"] },
  },
  S0025: {
    ja: { q: "次のうち光の三原色でないものは？", exp: "光の三原色は赤・緑・青（RGB）です。3つすべてを混ぜると白い光になります。", opts: ["黄", "赤", "緑", "青"] },
    en: { q: "Which of these is NOT one of the three primary colors of light?", exp: "The primary colors of light are red, green and blue (RGB). Mixed together, they make white light.", opts: ["Yellow", "Red", "Green", "Blue"] },
  },
  S0026: {
    ja: { q: "原子を作る粒子のうち、マイナスの電気を帯びているのは？", exp: "電子はマイナス、陽子はプラス、中性子は電気を帯びていません。原子核は陽子と中性子でできています。", opts: ["電子", "陽子", "中性子", "原子核"] },
    en: { q: "Which particle in an atom carries a negative charge?", exp: "Electrons are negative, protons positive, and neutrons neutral. The nucleus is made of protons and neutrons.", opts: ["Electron", "Proton", "Neutron", "Nucleus"] },
  },
  S0027: {
    ja: { q: "約6,600万年前、恐竜の大部分が姿を消して終わった地質時代は？", exp: "白亜紀末の大量絶滅で、鳥類を除く恐竜が絶滅しました。", opts: ["白亜紀", "ジュラ紀", "三畳紀", "カンブリア紀"] },
    en: { q: "Which geological period ended about 66 million years ago when most dinosaurs died out?", exp: "The end-Cretaceous mass extinction wiped out all dinosaurs except birds.", opts: ["Cretaceous", "Jurassic", "Triassic", "Cambrian"] },
  },
  S0101: { ja: { q: "クジラはえらで呼吸する。", exp: "クジラは哺乳類なので肺で呼吸します。頭の上の噴気孔から水面で空気を吸い込みます。" }, en: { q: "Whales breathe through gills.", exp: "Whales are mammals and breathe with lungs, taking in air at the surface through the blowhole on top of the head." } },
  S0102: { ja: { q: "音は空気中より水中のほうが速く伝わる。", exp: "音は空気中では1秒に約340m、水中では約1,500m進みます。" }, en: { q: "Sound travels faster in water than in air.", exp: "Sound covers about 340 m per second in air and about 1,500 m in water." } },
  S0103: { ja: { q: "太陽系で最も熱い惑星は、太陽に最も近い水星ではなく金星である。", exp: "金星は厚い二酸化炭素の大気による温室効果で、表面が約460℃を超え最も熱い惑星です。" }, en: { q: "The hottest planet in the Solar System is Venus, not Mercury, which is closest to the Sun.", exp: "Venus's thick carbon-dioxide atmosphere traps heat, pushing its surface above about 460 °C — the hottest planet." } },
  S0104: { ja: { q: "月には空気（大気）がほとんどない。", exp: "月は重力が弱く大気をつなぎとめられないため、空気がほとんどありません。そのため音も伝わりません。" }, en: { q: "The Moon has almost no air (atmosphere).", exp: "The Moon's gravity is too weak to hold an atmosphere, so there's almost no air — and sound can't travel there." } },
  S0105: { ja: { q: "昆虫の脚は6本である。", exp: "昆虫は頭・胸・腹に分かれ、胸に3対、合わせて6本の脚があります。" }, en: { q: "Insects have six legs.", exp: "An insect's body has a head, thorax and abdomen, with three pairs — six legs — on the thorax." } },
  S0106: { ja: { q: "クモは昆虫である。", exp: "クモは脚が8本で体が2つに分かれるクモ類です。昆虫の脚は6本です。" }, en: { q: "Spiders are insects.", exp: "Spiders are arachnids with eight legs and two body parts. Insects have six legs." } },
  S0201: {
    ja: { q: "人の心臓はいくつの部屋（心房・心室）でできているでしょう？", exp: "左心房・右心房・左心室・右心室の4つです。", unit: "つ" },
    en: { q: "How many chambers (atria and ventricles) does the human heart have?", exp: "Four: left atrium, right atrium, left ventricle and right ventricle.", unit: "chambers" },
  },
  S0202: {
    ja: { q: "地球が自分で1回転する（自転）のにかかる時間は約何時間でしょう？", exp: "地球の自転周期は約24時間（正確には約23時間56分）なので、昼と夜ができます。", unit: "時間" },
    en: { q: "About how many hours does Earth take to spin once on its axis?", exp: "Earth's rotation takes about 24 hours (precisely about 23 h 56 min), giving us day and night.", unit: "hours" },
  },
  S0203: {
    ja: { q: "1気圧で水が沸騰する温度は何℃でしょう？", exp: "1気圧では水は100℃で沸騰し、0℃で凍ります。" },
    en: { q: "At 1 atmosphere, at what temperature (°C) does water boil?", exp: "At 1 atmosphere, water boils at 100 °C and freezes at 0 °C." },
  },
  S0301: {
    ja: { q: "科学の話のうちフェイクを選んでください。", exp: "乳酸菌のように体に良い細菌もたくさんいます。腸内細菌は消化や免疫を助けます。", stmts: ["植物は主に根から水を吸い上げる。", "細菌はすべて人にとって有害である。", "月の形が変わって見えるのは、日光を受ける部分が違って見えるからである。"] },
    en: { q: "Which science statement is fake?", exp: "Many bacteria, like lactobacilli, are good for us. Gut bacteria help with digestion and immunity.", stmts: ["Plants mainly take up water through their roots.", "All bacteria are harmful to people.", "The Moon seems to change shape because we see different sunlit parts of it."] },
  },
  S0401: {
    ja: { q: "手がかりを見てどの動物か当ててください。", exp: "ゾウは陸上で最も大きい動物です。アフリカゾウは体重が6トンを超えることもあります。", opts: ["ゾウ", "カバ", "サイ", "キリン"], clues: ["アフリカとアジアにすんでいます。", "陸上動物の中で体が最も大きいです。", "大きな耳をぱたぱたさせて体の熱を冷まします。", "長い鼻で水を飲み、物をつかみます。"] },
    en: { q: "Use the clues to guess the animal.", exp: "Elephants are the largest land animals. African elephants can weigh more than 6 tonnes.", opts: ["Elephant", "Hippo", "Rhino", "Giraffe"], clues: ["It lives in Africa and Asia.", "It's the biggest of all land animals.", "It flaps its huge ears to cool down.", "It drinks and grabs things with its long trunk."] },
  },
};
