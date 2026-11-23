// =========================
// 플듀 인생게임 REBORN — 세계 모드 데이터 (2026-11-23)
// 나라 12 × 시대 3. 나라·시대가 바꾸는 것: 출생 지역·가정 형편 분포·학제 이름·소득 수준·물가·통화 표기·기대수명·이름·건물/옷 색·명절·음식·그 나라만의 사건(life-events-world.js)·세계 사건(life-worldev.js)
// 숫자는 모두 "게임용 어림값"이다 (실제 통계를 그대로 옮긴 것이 아님 — 화면에 그렇게 표시한다).
//   income: 한국 현대 = 1 기준 구매력 어림 (실제 1인당 소득 비율을 게임이 쓰기 좋게 완만하게 줄인 값)
//   le: 그 시대에 태어난 사람의 기대수명 어림 (가까운 미래는 가상의 시나리오)
//   ppp: 게임 돈 1만원(한국 구매력)을 그 나라 돈으로 바꿀 때의 어림 배수 (환율 아님)
// 브라우저·Node 공용 (서버 멀티도 같은 파일을 복사해 쓴다)
// =========================

export const ERAS = [
  { id: "early", icon: "🕰️", years: [1900, 1949], real: true, name: { ko: "격동의 근대", ja: "激動の近代", en: "The Turbulent Early Century" }, sub: { ko: "1900~1949년생 · 실제 역사", ja: "1900〜1949年生まれ・実際の歴史", en: "Born 1900–1949 · real history" } },
  { id: "past", icon: "📻", years: [1950, 1979], real: true, name: { ko: "지난 시대", ja: "昔の時代", en: "The Past" }, sub: { ko: "1950~1979년생 · 실제 역사", ja: "1950〜1979年生まれ・実際の歴史", en: "Born 1950–1979 · real history" } },
  { id: "modern", icon: "📱", years: [1980, 2012], real: true, name: { ko: "지금 시대", ja: "現代", en: "The Present" }, sub: { ko: "1980~2012년생 · 2026년까지 실제 역사, 그 뒤는 가상", ja: "1980〜2012年生まれ・2026年まで実際の歴史、その後は架空", en: "Born 1980–2012 · real history until 2026, fiction after" } },
  { id: "future", icon: "🛸", years: [2030, 2050], real: false, name: { ko: "가까운 미래", ja: "近い未来", en: "Near Future" }, sub: { ko: "2030~2050년생 · 가상의 미래 (실제 아님)", ja: "2030〜2050年生まれ・架空の未来(現実ではない)", en: "Born 2030–2050 · fictional future (not real)" } },
];
export const ERA_BY_ID = Object.fromEntries(ERAS.map(e => [e.id, e]));
export const eraOfYear = (y) => y < 1950 ? "early" : y < 1980 ? "past" : y < 2026 ? "modern" : "future";

const N = (ko, ja, en) => ({ ko, ja, en });
// 이름: 한국어 표기(엔진 안 이름) → [일본어, 영어] 표기는 아래 NAMES_TR 로 등록
export const COUNTRIES = [
  { id: "KR", flag: "🇰🇷", name: N("한국", "韓国", "South Korea"), map: [57, 9], cur: { sym: "₩", code: "KRW", ppp: 10000, dec: 0, big: "kr" },
    income: { early: 0.12, past: 0.45, modern: 1, future: 1.15 }, le: { early: 42, past: 74, modern: 83, future: 87 }, poor: { early: 3.0, past: 1.6, modern: 1, future: 0.9 },
    regions: [], // 한국은 기존 13개 지역(life-engine REGIONS_KR)을 그대로 쓴다
    school: { ele: N("초등학교", "小学校", "elementary school"), mid: N("중학교", "中学校", "middle school"), high: N("고등학교", "高校", "high school"), uni: N("대학교", "大学", "university"), exam: N("수능", "修能(大学入試)", "the CSAT") },
    holiday: N("추석", "秋夕(チュソク)", "Chuseok"), food: N("김치찌개", "キムチチゲ", "kimchi stew"), style: { roof: "#3b4a6b", wall: "#d9d2c3", accent: "#c8102e", cloth: ["#2f5aa8", "#e04b5a", "#f2f2f2"], mark: "apt" } },
  { id: "JP", flag: "🇯🇵", name: N("일본", "日本", "Japan"), map: [60, 9], cur: { sym: "¥", code: "JPY", ppp: 1250, dec: 0 },
    income: { early: 0.3, past: 0.7, modern: 0.95, future: 1.0 }, le: { early: 46, past: 77, modern: 85, future: 88 }, poor: { early: 2.2, past: 1.2, modern: 0.95, future: 0.95 },
    regions: [{ id: "tokyo", n: N("도쿄", "東京", "Tokyo"), w: 30 }, { id: "osaka", n: N("오사카", "大阪", "Osaka"), w: 18 }, { id: "nagoya", n: N("나고야", "名古屋", "Nagoya"), w: 10 }, { id: "fukuoka", n: N("후쿠오카", "福岡", "Fukuoka"), w: 9 }, { id: "sapporo", n: N("삿포로", "札幌", "Sapporo"), w: 8 }, { id: "sendai", n: N("센다이", "仙台", "Sendai"), w: 6 }, { id: "okinawa", n: N("오키나와", "沖縄", "Okinawa"), w: 4 }, { id: "kyoto", n: N("교토", "京都", "Kyoto"), w: 7 }],
    school: { ele: N("소학교", "小学校", "elementary school"), mid: N("중학교", "中学校", "junior high"), high: N("고등학교", "高校", "high school"), uni: N("대학", "大学", "university"), exam: N("대학 입시(공통 테스트)", "共通テスト", "the national entrance test") },
    holiday: N("오본", "お盆", "Obon"), food: N("라멘", "ラーメン", "ramen"), style: { roof: "#4a3a33", wall: "#efe6d6", accent: "#bc002d", cloth: ["#22325c", "#f0f0f0", "#bc002d"], mark: "torii" } },
  { id: "US", flag: "🇺🇸", name: N("미국", "アメリカ", "United States"), map: [12, 6], cur: { sym: "$", code: "USD", ppp: 11, dec: 0 },
    income: { early: 0.62, past: 1.05, modern: 1.3, future: 1.3 }, le: { early: 58, past: 73, modern: 78, future: 81 }, poor: { early: 1.4, past: 1.0, modern: 1.05, future: 1.05 },
    regions: [{ id: "ny", n: N("뉴욕", "ニューヨーク", "New York"), w: 14 }, { id: "ca", n: N("캘리포니아", "カリフォルニア", "California"), w: 20 }, { id: "tx", n: N("텍사스", "テキサス", "Texas"), w: 16 }, { id: "fl", n: N("플로리다", "フロリダ", "Florida"), w: 11 }, { id: "il", n: N("시카고", "シカゴ", "Chicago"), w: 8 }, { id: "oh", n: N("오하이오", "オハイオ", "Ohio"), w: 8 }, { id: "wa", n: N("시애틀", "シアトル", "Seattle"), w: 5 }, { id: "ga", n: N("애틀랜타", "アトランタ", "Atlanta"), w: 6 }],
    school: { ele: N("초등학교", "小学校", "elementary school"), mid: N("중학교", "中学校", "middle school"), high: N("고등학교", "ハイスクール", "high school"), uni: N("대학(칼리지)", "大学(カレッジ)", "college"), exam: N("SAT", "SAT", "the SAT") },
    holiday: N("추수감사절", "感謝祭", "Thanksgiving"), food: N("햄버거", "ハンバーガー", "burgers"), style: { roof: "#6b4a3a", wall: "#c9b8a3", accent: "#3c3b6e", cloth: ["#1f4e8c", "#b22234", "#d8c8a8"], mark: "barn" } },
  { id: "GB", flag: "🇬🇧", name: N("영국", "イギリス", "United Kingdom"), map: [25, 4], cur: { sym: "£", code: "GBP", ppp: 7.6, dec: 0 },
    income: { early: 0.6, past: 0.85, modern: 1.08, future: 1.08 }, le: { early: 57, past: 74, modern: 81, future: 84 }, poor: { early: 1.5, past: 1.15, modern: 1, future: 1 },
    regions: [{ id: "london", n: N("런던", "ロンドン", "London"), w: 22 }, { id: "manchester", n: N("맨체스터", "マンチェスター", "Manchester"), w: 12 }, { id: "birmingham", n: N("버밍엄", "バーミンガム", "Birmingham"), w: 12 }, { id: "liverpool", n: N("리버풀", "リバプール", "Liverpool"), w: 8 }, { id: "edinburgh", n: N("에든버러", "エディンバラ", "Edinburgh"), w: 9 }, { id: "cardiff", n: N("카디프", "カーディフ", "Cardiff"), w: 6 }, { id: "belfast", n: N("벨파스트", "ベルファスト", "Belfast"), w: 5 }],
    school: { ele: N("프라이머리 스쿨", "プライマリースクール", "primary school"), mid: N("세컨더리 스쿨", "セカンダリースクール", "secondary school"), high: N("식스폼(A레벨)", "シックスフォーム(Aレベル)", "sixth form"), uni: N("대학", "大学", "university"), exam: N("A레벨 시험", "Aレベル試験", "A-level exams") },
    holiday: N("크리스마스", "クリスマス", "Christmas"), food: N("피시 앤 칩스", "フィッシュ&チップス", "fish and chips"), style: { roof: "#5a4a4a", wall: "#a8553f", accent: "#012169", cloth: ["#2b3a55", "#7a2e2e", "#8c8c8c"], mark: "brick" } },
  { id: "FR", flag: "🇫🇷", name: N("프랑스", "フランス", "France"), map: [26, 6], cur: { sym: "€", code: "EUR", ppp: 8.4, dec: 0 },
    income: { early: 0.5, past: 0.85, modern: 1.08, future: 1.08 }, le: { early: 54, past: 74, modern: 83, future: 86 }, poor: { early: 1.6, past: 1.1, modern: 0.95, future: 0.95 },
    regions: [{ id: "paris", n: N("파리", "パリ", "Paris"), w: 20 }, { id: "lyon", n: N("리옹", "リヨン", "Lyon"), w: 10 }, { id: "marseille", n: N("마르세유", "マルセイユ", "Marseille"), w: 10 }, { id: "bordeaux", n: N("보르도", "ボルドー", "Bordeaux"), w: 7 }, { id: "lille", n: N("릴", "リール", "Lille"), w: 7 }, { id: "nice", n: N("니스", "ニース", "Nice"), w: 5 }, { id: "brittany", n: N("브르타뉴", "ブルターニュ", "Brittany"), w: 7 }],
    school: { ele: N("에콜(초등)", "エコール(小学校)", "école primaire"), mid: N("콜레주", "コレージュ", "collège"), high: N("리세", "リセ", "lycée"), uni: N("대학·그랑제콜", "大学・グランゼコール", "university"), exam: N("바칼로레아", "バカロレア", "the baccalauréat") },
    holiday: N("혁명 기념일", "革命記念日", "Bastille Day"), food: N("바게트", "バゲット", "baguettes"), style: { roof: "#5c6a7a", wall: "#e8dcc4", accent: "#0055a4", cloth: ["#0055a4", "#ef4135", "#f2f2f2"], mark: "tower" } },
  { id: "DE", flag: "🇩🇪", name: N("독일", "ドイツ", "Germany"), map: [28, 5], cur: { sym: "€", code: "EUR", ppp: 8.6, dec: 0 },
    income: { early: 0.5, past: 0.9, modern: 1.2, future: 1.2 }, le: { early: 54, past: 73, modern: 81, future: 84 }, poor: { early: 1.7, past: 1.1, modern: 0.9, future: 0.9 },
    regions: [{ id: "berlin", n: N("베를린", "ベルリン", "Berlin"), w: 12 }, { id: "munich", n: N("뮌헨", "ミュンヘン", "Munich"), w: 12 }, { id: "hamburg", n: N("함부르크", "ハンブルク", "Hamburg"), w: 9 }, { id: "cologne", n: N("쾰른", "ケルン", "Cologne"), w: 10 }, { id: "frankfurt", n: N("프랑크푸르트", "フランクフルト", "Frankfurt"), w: 9 }, { id: "leipzig", n: N("라이프치히", "ライプツィヒ", "Leipzig"), w: 7 }, { id: "stuttgart", n: N("슈투트가르트", "シュトゥットガルト", "Stuttgart"), w: 8 }],
    school: { ele: N("그룬트슐레", "基礎学校(グルントシューレ)", "Grundschule"), mid: N("레알슐레·김나지움", "実科学校・ギムナジウム", "Realschule / Gymnasium"), high: N("김나지움 상급반", "ギムナジウム上級", "upper Gymnasium"), uni: N("대학", "大学", "university"), exam: N("아비투어", "アビトゥーア", "the Abitur") },
    holiday: N("크리스마스 마켓", "クリスマスマーケット", "the Christmas market"), food: N("소시지와 감자", "ソーセージとじゃがいも", "sausages and potatoes"), style: { roof: "#8a3b2e", wall: "#efe3cf", accent: "#000000", cloth: ["#3a3a3a", "#dd0000", "#ffce00"], mark: "timber" } },
  { id: "CN", flag: "🇨🇳", name: N("중국", "中国", "China"), map: [50, 8], cur: { sym: "¥", code: "CNY", ppp: 45, dec: 0, label: "元" },
    income: { early: 0.1, past: 0.18, modern: 0.62, future: 0.9 }, le: { early: 36, past: 64, modern: 78, future: 83 }, poor: { early: 3.5, past: 2.6, modern: 1.3, future: 1.0 },
    regions: [{ id: "beijing", n: N("베이징", "北京", "Beijing"), w: 10 }, { id: "shanghai", n: N("상하이", "上海", "Shanghai"), w: 12 }, { id: "guangdong", n: N("광둥", "広東", "Guangdong"), w: 16 }, { id: "sichuan", n: N("쓰촨", "四川", "Sichuan"), w: 14 }, { id: "harbin", n: N("하얼빈", "ハルビン", "Harbin"), w: 8 }, { id: "xian", n: N("시안", "西安", "Xi'an"), w: 8 }, { id: "yunnan", n: N("윈난", "雲南", "Yunnan"), w: 9 }],
    school: { ele: N("소학", "小学", "primary school"), mid: N("초중", "初中", "junior middle school"), high: N("고중", "高中", "senior high school"), uni: N("대학", "大学", "university"), exam: N("가오카오", "高考", "the gaokao") },
    holiday: N("춘절", "春節", "Spring Festival"), food: N("만두", "餃子", "dumplings"), style: { roof: "#8c2a1f", wall: "#e3d4b5", accent: "#de2910", cloth: ["#1f3b73", "#de2910", "#ffde00"], mark: "pagoda" } },
  { id: "IN", flag: "🇮🇳", name: N("인도", "インド", "India"), map: [44, 11], cur: { sym: "₹", code: "INR", ppp: 250, dec: 0 },
    income: { early: 0.08, past: 0.14, modern: 0.33, future: 0.55 }, le: { early: 31, past: 52, modern: 70, future: 76 }, poor: { early: 3.8, past: 3.2, modern: 2.0, future: 1.5 },
    regions: [{ id: "mumbai", n: N("뭄바이", "ムンバイ", "Mumbai"), w: 12 }, { id: "delhi", n: N("델리", "デリー", "Delhi"), w: 12 }, { id: "bengaluru", n: N("벵갈루루", "ベンガルール", "Bengaluru"), w: 9 }, { id: "kolkata", n: N("콜카타", "コルカタ", "Kolkata"), w: 9 }, { id: "chennai", n: N("첸나이", "チェンナイ", "Chennai"), w: 8 }, { id: "punjab", n: N("펀자브", "パンジャーブ", "Punjab"), w: 10 }, { id: "kerala", n: N("케랄라", "ケララ", "Kerala"), w: 7 }, { id: "up", n: N("우타르프라데시의 마을", "ウッタル・プラデーシュの村", "a village in Uttar Pradesh"), w: 20 }],
    school: { ele: N("초등학교", "小学校", "primary school"), mid: N("중학교", "中学校", "middle school"), high: N("고등학교(12학년)", "高校(12年生)", "higher secondary"), uni: N("대학", "大学", "college"), exam: N("보드 시험·JEE", "ボード試験・JEE", "board exams & JEE") },
    holiday: N("디왈리", "ディワリ", "Diwali"), food: N("커리와 짜이", "カレーとチャイ", "curry and chai"), style: { roof: "#b5651d", wall: "#f0c987", accent: "#ff9933", cloth: ["#ff9933", "#138808", "#f5f5f5"], mark: "dome" } },
  { id: "BR", flag: "🇧🇷", name: N("브라질", "ブラジル", "Brazil"), map: [20, 17], cur: { sym: "R$", code: "BRL", ppp: 30, dec: 0 },
    income: { early: 0.2, past: 0.3, modern: 0.45, future: 0.55 }, le: { early: 40, past: 60, modern: 75, future: 79 }, poor: { early: 3.0, past: 2.4, modern: 1.8, future: 1.5 },
    regions: [{ id: "saopaulo", n: N("상파울루", "サンパウロ", "São Paulo"), w: 22 }, { id: "rio", n: N("리우데자네이루", "リオデジャネイロ", "Rio de Janeiro"), w: 14 }, { id: "bahia", n: N("바이아", "バイーア", "Bahia"), w: 12 }, { id: "minas", n: N("미나스제라이스", "ミナスジェライス", "Minas Gerais"), w: 12 }, { id: "amazon", n: N("아마조나스", "アマゾナス", "Amazonas"), w: 6 }, { id: "recife", n: N("헤시피", "レシフェ", "Recife"), w: 8 }, { id: "porto", n: N("포르투알레그리", "ポルトアレグレ", "Porto Alegre"), w: 7 }],
    school: { ele: N("초등 과정", "初等教育", "ensino fundamental I"), mid: N("중등 과정", "中等教育", "ensino fundamental II"), high: N("고등 과정", "高等教育(エンシノ・メジオ)", "ensino médio"), uni: N("대학", "大学", "university"), exam: N("ENEM(대입 시험)", "ENEM(大学入試)", "the ENEM") },
    holiday: N("카니발", "カーニバル", "Carnival"), food: N("페이조아다", "フェイジョアーダ", "feijoada"), style: { roof: "#c2703d", wall: "#f2d16b", accent: "#009c3b", cloth: ["#009c3b", "#ffdf00", "#002776"], mark: "favela" } },
  { id: "MX", flag: "🇲🇽", name: N("멕시코", "メキシコ", "Mexico"), map: [11, 11], cur: { sym: "$", code: "MXN", ppp: 115, dec: 0, label: "MXN" },
    income: { early: 0.2, past: 0.32, modern: 0.46, future: 0.55 }, le: { early: 38, past: 62, modern: 75, future: 79 }, poor: { early: 3.0, past: 2.3, modern: 1.7, future: 1.5 },
    regions: [{ id: "cdmx", n: N("멕시코시티", "メキシコシティ", "Mexico City"), w: 20 }, { id: "guadalajara", n: N("과달라하라", "グアダラハラ", "Guadalajara"), w: 12 }, { id: "monterrey", n: N("몬테레이", "モンテレイ", "Monterrey"), w: 11 }, { id: "oaxaca", n: N("오악사카", "オアハカ", "Oaxaca"), w: 9 }, { id: "yucatan", n: N("유카탄", "ユカタン", "Yucatán"), w: 7 }, { id: "puebla", n: N("푸에블라", "プエブラ", "Puebla"), w: 9 }],
    school: { ele: N("프리마리아", "プリマリア(小学校)", "primaria"), mid: N("세쿤다리아", "セクンダリア(中学校)", "secundaria"), high: N("프레파라토리아", "プレパラトリア(高校)", "preparatoria"), uni: N("대학", "大学", "university"), exam: N("대학 입학시험", "大学入学試験", "the university entrance exam") },
    holiday: N("망자의 날", "死者の日", "Día de Muertos"), food: N("타코", "タコス", "tacos"), style: { roof: "#a8442a", wall: "#f2a65a", accent: "#006847", cloth: ["#006847", "#ce1126", "#f2e3c6"], mark: "adobe" } },
  { id: "EG", flag: "🇪🇬", name: N("이집트", "エジプト", "Egypt"), map: [32, 10], cur: { sym: "E£", code: "EGP", ppp: 160, dec: 0 },
    income: { early: 0.15, past: 0.18, modern: 0.36, future: 0.48 }, le: { early: 38, past: 54, modern: 72, future: 76 }, poor: { early: 3.2, past: 2.8, modern: 1.9, future: 1.6 },
    regions: [{ id: "cairo", n: N("카이로", "カイロ", "Cairo"), w: 26 }, { id: "alexandria", n: N("알렉산드리아", "アレクサンドリア", "Alexandria"), w: 14 }, { id: "giza", n: N("기자", "ギザ", "Giza"), w: 12 }, { id: "luxor", n: N("룩소르", "ルクソール", "Luxor"), w: 6 }, { id: "aswan", n: N("아스완", "アスワン", "Aswan"), w: 5 }, { id: "delta", n: N("나일 삼각주 마을", "ナイル・デルタの村", "a Nile Delta village"), w: 20 }],
    school: { ele: N("초등학교", "小学校", "primary school"), mid: N("예비학교", "準備学校(中学)", "preparatory school"), high: N("고등학교", "高校", "secondary school"), uni: N("대학", "大学", "university"), exam: N("타나위야 아마(졸업 시험)", "タナウェイヤ・アンマ(修了試験)", "the Thanaweya Amma") },
    holiday: N("라마단 뒤의 축제", "ラマダン明けの祭り", "Eid after Ramadan"), food: N("코샤리", "コシャリ", "koshari"), style: { roof: "#c8a26b", wall: "#e8d2a6", accent: "#c8102e", cloth: ["#f5f0e1", "#c8102e", "#2b2b2b"], mark: "dome" } },
  { id: "AU", flag: "🇦🇺", name: N("호주", "オーストラリア", "Australia"), map: [57, 18], cur: { sym: "A$", code: "AUD", ppp: 15, dec: 0, label: "A$" },
    income: { early: 0.62, past: 0.95, modern: 1.22, future: 1.22 }, le: { early: 60, past: 74, modern: 83, future: 86 }, poor: { early: 1.3, past: 1.0, modern: 0.9, future: 0.9 },
    regions: [{ id: "sydney", n: N("시드니", "シドニー", "Sydney"), w: 22 }, { id: "melbourne", n: N("멜버른", "メルボルン", "Melbourne"), w: 20 }, { id: "brisbane", n: N("브리즈번", "ブリスベン", "Brisbane"), w: 11 }, { id: "perth", n: N("퍼스", "パース", "Perth"), w: 9 }, { id: "adelaide", n: N("애들레이드", "アデレード", "Adelaide"), w: 6 }, { id: "outback", n: N("아웃백 마을", "アウトバックの町", "an outback town"), w: 4 }],
    school: { ele: N("프라이머리 스쿨", "プライマリースクール", "primary school"), mid: N("하이스쿨 저학년", "ハイスクール低学年", "junior high"), high: N("하이스쿨(12학년)", "ハイスクール(12年生)", "senior high"), uni: N("대학", "大学", "university"), exam: N("ATAR 시험", "ATAR試験", "the ATAR exams") },
    holiday: N("크리스마스 바비큐", "クリスマスのバーベキュー", "a Christmas barbecue"), food: N("미트 파이", "ミートパイ", "meat pies"), style: { roof: "#8a8a8a", wall: "#efe2c8", accent: "#00008b", cloth: ["#2b6cb0", "#f2c230", "#f2f2f2"], mark: "beach" } },
];
export const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
// 세계 모드에서 무작위로 태어날 때의 가중치 (게임용 어림 — 인구가 많은 곳에서 더 자주)
export const BIRTH_W = { KR: 3, JP: 5, US: 9, GB: 3, FR: 3, DE: 4, CN: 22, IN: 26, BR: 8, MX: 6, EG: 5, AU: 2 };

// 나라별 이름 (엔진 안에선 한국어 표기로 저장, 화면이 일본어·영어 표기로 바꿈)
export const NAMES = {
  JP: { M: ["하루토", "소타", "유토", "렌", "히로시", "다쿠야", "겐타", "쇼"], F: ["유이", "하나", "사쿠라", "아오이", "유키", "미오", "나쓰미", "에리"] },
  US: { M: ["제임스", "마이클", "이선", "노아", "타일러", "브랜든", "케빈", "루카스"], F: ["에마", "올리비아", "소피아", "에이버리", "매디슨", "케이티", "레이철", "그레이스"] },
  GB: { M: ["올리버", "해리", "조지", "잭", "찰리", "토머스", "윌리엄", "알피"], F: ["아멜리아", "이슬라", "에밀리", "포피", "샬럿", "제시카", "루시", "엘리"] },
  FR: { M: ["루이", "가브리엘", "위고", "레오", "쥘", "앙투안", "마티스", "피에르"], F: ["클로에", "마농", "카미유", "레아", "줄리", "이네스", "아델", "소피"] },
  DE: { M: ["루카스", "펠릭스", "막시밀리안", "요나스", "레온", "토비아스", "클라우스", "니클라스"], F: ["한나", "레나", "미아", "엠마", "율리아", "자라", "클라라", "리자"] },
  CN: { M: ["웨이", "하오", "쥔", "레이", "밍", "제", "타오", "펑"], F: ["리나", "팡", "징", "샤오메이", "옌", "팅팅", "후이", "쉐"] },
  IN: { M: ["아라브", "비하안", "로한", "아르준", "라훌", "비크람", "산제이", "아미트"], F: ["프리야", "아난야", "디야", "카비야", "네하", "푸자", "사니야", "메라"] },
  BR: { M: ["주앙", "페드루", "가브리에우", "마테우스", "루카스", "하파에우", "치아구", "브루누"], F: ["아나", "줄리아", "베아트리스", "라리사", "카밀라", "페르난다", "마리아", "이자벨라"] },
  MX: { M: ["산티아고", "마테오", "디에고", "알레한드로", "카를로스", "호세", "미겔", "루이스"], F: ["시메나", "발렌티나", "다니엘라", "카밀라", "구아달루페", "루시아", "소피아", "마리아나"] },
  EG: { M: ["아흐메드", "무함마드", "오마르", "유세프", "카림", "마흐무드", "하산", "타리크"], F: ["파티마", "누르", "마리암", "살마", "야스민", "하나", "라일라", "아미라"] },
  AU: { M: ["잭", "윌리엄", "쿠퍼", "리엄", "오스카", "헨리", "맥스", "라클런"], F: ["샬럿", "올리비아", "아일라", "밀라", "조이", "루비", "케이틀린", "엠마"] },
};
// 한국어 표기 → [일본어, 영어]
export const NAMES_TR = {
  "하루토": ["ハルト", "Haruto"], "소타": ["ソウタ", "Sota"], "유토": ["ユウト", "Yuto"], "렌": ["レン", "Ren"], "히로시": ["ひろし", "Hiroshi"], "다쿠야": ["たくや", "Takuya"], "겐타": ["けんた", "Kenta"], "쇼": ["しょう", "Sho"],
  "유이": ["ゆい", "Yui"], "하나": ["はな", "Hana"], "사쿠라": ["さくら", "Sakura"], "아오이": ["あおい", "Aoi"], "유키": ["ゆき", "Yuki"], "미오": ["みお", "Mio"], "나쓰미": ["なつみ", "Natsumi"], "에리": ["えり", "Eri"],
  "제임스": ["ジェームズ", "James"], "마이클": ["マイケル", "Michael"], "이선": ["イーサン", "Ethan"], "노아": ["ノア", "Noah"], "타일러": ["タイラー", "Tyler"], "브랜든": ["ブランドン", "Brandon"], "케빈": ["ケビン", "Kevin"], "루카스": ["ルーカス", "Lucas"],
  "에마": ["エマ", "Emma"], "올리비아": ["オリビア", "Olivia"], "소피아": ["ソフィア", "Sofia"], "에이버리": ["エイヴリー", "Avery"], "매디슨": ["マディソン", "Madison"], "케이티": ["ケイティ", "Katie"], "레이철": ["レイチェル", "Rachel"], "그레이스": ["グレース", "Grace"],
  "올리버": ["オリバー", "Oliver"], "해리": ["ハリー", "Harry"], "조지": ["ジョージ", "George"], "잭": ["ジャック", "Jack"], "찰리": ["チャーリー", "Charlie"], "토머스": ["トーマス", "Thomas"], "윌리엄": ["ウィリアム", "William"], "알피": ["アルフィー", "Alfie"],
  "아멜리아": ["アメリア", "Amelia"], "이슬라": ["アイラ", "Isla"], "에밀리": ["エミリー", "Emily"], "포피": ["ポピー", "Poppy"], "샬럿": ["シャーロット", "Charlotte"], "제시카": ["ジェシカ", "Jessica"], "루시": ["ルーシー", "Lucy"], "엘리": ["エリー", "Ellie"],
  "루이": ["ルイ", "Louis"], "가브리엘": ["ガブリエル", "Gabriel"], "위고": ["ユゴー", "Hugo"], "레오": ["レオ", "Léo"], "쥘": ["ジュール", "Jules"], "앙투안": ["アントワーヌ", "Antoine"], "마티스": ["マティス", "Mathis"], "피에르": ["ピエール", "Pierre"],
  "클로에": ["クロエ", "Chloé"], "마농": ["マノン", "Manon"], "카미유": ["カミーユ", "Camille"], "레아": ["レア", "Léa"], "줄리": ["ジュリー", "Julie"], "이네스": ["イネス", "Inès"], "아델": ["アデル", "Adèle"], "소피": ["ソフィー", "Sophie"],
  "펠릭스": ["フェリックス", "Felix"], "막시밀리안": ["マクシミリアン", "Maximilian"], "요나스": ["ヨナス", "Jonas"], "레온": ["レオン", "Leon"], "토비아스": ["トビアス", "Tobias"], "클라우스": ["クラウス", "Klaus"], "니클라스": ["ニクラス", "Niklas"],
  "한나": ["ハンナ", "Hannah"], "레나": ["レナ", "Lena"], "미아": ["ミア", "Mia"], "엠마": ["エマ", "Emma"], "율리아": ["ユリア", "Julia"], "자라": ["ザラ", "Sarah"], "클라라": ["クララ", "Clara"], "리자": ["リザ", "Lisa"],
  "웨이": ["ウェイ", "Wei"], "하오": ["ハオ", "Hao"], "쥔": ["ジュン", "Jun"], "레이": ["レイ", "Lei"], "밍": ["ミン", "Ming"], "제": ["ジエ", "Jie"], "타오": ["タオ", "Tao"], "펑": ["フォン", "Feng"],
  "리나": ["リナ", "Lina"], "팡": ["ファン", "Fang"], "징": ["ジン", "Jing"], "샤오메이": ["シャオメイ", "Xiaomei"], "옌": ["イェン", "Yan"], "팅팅": ["ティンティン", "Tingting"], "후이": ["フイ", "Hui"], "쉐": ["シュエ", "Xue"],
  "아라브": ["アーラヴ", "Aarav"], "비하안": ["ヴィハーン", "Vihaan"], "로한": ["ローハン", "Rohan"], "아르준": ["アルジュン", "Arjun"], "라훌": ["ラフル", "Rahul"], "비크람": ["ヴィクラム", "Vikram"], "산제이": ["サンジャイ", "Sanjay"], "아미트": ["アミット", "Amit"],
  "프리야": ["プリヤ", "Priya"], "아난야": ["アナニャ", "Ananya"], "디야": ["ディヤ", "Diya"], "카비야": ["カーヴィヤ", "Kavya"], "네하": ["ネハ", "Neha"], "푸자": ["プージャ", "Pooja"], "사니야": ["サーニヤ", "Saanvi"], "메라": ["ミーラ", "Meera"],
  "주앙": ["ジョアン", "João"], "페드루": ["ペドロ", "Pedro"], "가브리에우": ["ガブリエウ", "Gabriel"], "마테우스": ["マテウス", "Mateus"], "하파에우": ["ハファエウ", "Rafael"], "치아구": ["チアゴ", "Thiago"], "브루누": ["ブルーノ", "Bruno"],
  "아나": ["アナ", "Ana"], "줄리아": ["ジュリア", "Júlia"], "베아트리스": ["ベアトリス", "Beatriz"], "라리사": ["ラリッサ", "Larissa"], "카밀라": ["カミラ", "Camila"], "페르난다": ["フェルナンダ", "Fernanda"], "마리아": ["マリア", "Maria"], "이자벨라": ["イザベラ", "Isabela"],
  "산티아고": ["サンティアゴ", "Santiago"], "마테오": ["マテオ", "Mateo"], "디에고": ["ディエゴ", "Diego"], "알레한드로": ["アレハンドロ", "Alejandro"], "카를로스": ["カルロス", "Carlos"], "호세": ["ホセ", "José"], "미겔": ["ミゲル", "Miguel"], "루이스": ["ルイス", "Luis"],
  "시메나": ["シメナ", "Ximena"], "발렌티나": ["バレンティナ", "Valentina"], "다니엘라": ["ダニエラ", "Daniela"], "구아달루페": ["グアダルーペ", "Guadalupe"], "루시아": ["ルシア", "Lucía"], "마리아나": ["マリアナ", "Mariana"],
  "아흐메드": ["アフメド", "Ahmed"], "무함마드": ["ムハンマド", "Mohamed"], "오마르": ["オマル", "Omar"], "유세프": ["ユーセフ", "Youssef"], "카림": ["カリーム", "Karim"], "마흐무드": ["マフムード", "Mahmoud"], "하산": ["ハサン", "Hassan"], "타리크": ["ターリク", "Tarek"],
  "파티마": ["ファティマ", "Fatima"], "누르": ["ヌール", "Nour"], "마리암": ["マリアム", "Mariam"], "살마": ["サルマ", "Salma"], "야스민": ["ヤスミン", "Yasmin"], "라일라": ["ライラ", "Laila"], "아미라": ["アミラ", "Amira"],
  "쿠퍼": ["クーパー", "Cooper"], "리엄": ["リアム", "Liam"], "오스카": ["オスカー", "Oscar"], "헨리": ["ヘンリー", "Henry"], "맥스": ["マックス", "Max"], "라클런": ["ラクラン", "Lachlan"],
  "밀라": ["ミラ", "Mila"], "조이": ["ゾーイ", "Zoe"], "루비": ["ルビー", "Ruby"], "케이틀린": ["ケイトリン", "Caitlin"],
};

/** 나라·시대 → 엔진 값 (기대수명 배수·소득 배수·가난 비중) */
export function lifeParams(countryId, eraId) {
  const C = COUNTRY_BY_ID[countryId] || COUNTRY_BY_ID.KR, e = ERA_BY_ID[eraId] ? eraId : "modern";
  const le = C.le[e];
  return {
    le, lifeMul: Math.round(Math.min(6, Math.exp((83 - le) / 14)) * 1000) / 1000,     // 83세 기준 사망 위험 배수 (어림, 최대 6배)
    incomeMul: Math.round(Math.pow(C.income[e], 0.75) * 1000) / 1000,     // 게임 재미를 위해 차이를 조금 줄임
    poor: C.poor[e],
  };
}
/** 게임 돈(만원, 한국 구매력) → 그 나라 돈 글자 (구매력 어림 환산, 환율 아님) */
export function moneyLocal(man, countryId, lang = "ko") {
  const C = COUNTRY_BY_ID[countryId] || COUNTRY_BY_ID.KR;
  if (C.id === "KR") return null;                    // 한국은 원래 표기(life-story money) 그대로
  const v = Math.round(man * C.cur.ppp), neg = v < 0, a = Math.abs(v);
  let s;
  if (lang === "ko") s = a >= 1e8 ? (a / 1e8).toFixed(a >= 1e9 ? 0 : 1) + "억" : a >= 1e4 ? (a / 1e4).toFixed(a >= 1e5 ? 0 : 1) + "만" : a.toLocaleString("ko-KR");
  else if (lang === "ja") s = a >= 1e8 ? (a / 1e8).toFixed(a >= 1e9 ? 0 : 1) + "億" : a >= 1e4 ? (a / 1e4).toFixed(a >= 1e5 ? 0 : 1) + "万" : a.toLocaleString("ja-JP");
  else s = a >= 1e9 ? (a / 1e9).toFixed(1) + "B" : a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M" : a >= 1e4 ? (a / 1e3).toFixed(0) + "K" : a.toLocaleString("en-US");
  return (neg ? "-" : "") + C.cur.sym + s;
}
export const countryName = (id, lang = "ko") => (COUNTRY_BY_ID[id]?.name[lang] || COUNTRY_BY_ID[id]?.name.ko || id);
export const regionName = (cid, rid, lang = "ko") => { const r = COUNTRY_BY_ID[cid]?.regions.find(x => x.id === rid); return r ? (r.n[lang] || r.n.ko) : null; };
export function pickCountry(rand = Math.random) { const ids = Object.keys(BIRTH_W); let r = rand() * ids.reduce((s, k) => s + BIRTH_W[k], 0); for (const k of ids) { r -= BIRTH_W[k]; if (r < 0) return k; } return "KR"; }
export function pickRegion(cid, rand = Math.random) { const L = COUNTRY_BY_ID[cid]?.regions || []; if (!L.length) return null; let r = rand() * L.reduce((s, x) => s + x.w, 0); for (const x of L) { r -= x.w; if (r < 0) return x.id; } return L[0].id; }
export function pickBirthYear(eraId, rand = Math.random) { const e = ERA_BY_ID[eraId] || ERA_BY_ID.modern; return e.years[0] + Math.floor(rand() * (e.years[1] - e.years[0] + 1)); }
