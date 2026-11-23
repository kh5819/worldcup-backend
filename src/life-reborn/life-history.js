// =========================
// 플듀 인생게임 REBORN — 역사 사건 시스템 HistoricalEvent (2026-11-23)
// 실제로 일어난 일은 날짜·발생 여부를 바꾸지 않는다. 개인이 받는 영향(가상)만 게임이 계산한다.
// 항목: id · country(나라) · region(지역 — 영향이 특히 큰 곳, 없으면 전국) · year(시작 연도) · until(기간 끝, 없으면 그 해) · areas(영향 분야) · src(참고한 출처 종류) · real:true
//   eff(p) → { d: 수치 변화, o: 개인 결과 문장 키 }  ← 개인 결과는 가상의 시뮬레이션
// 처음 범위: 대한민국 1900~2026 (일본·미국 등은 life-worldev.js 의 주요 사건부터, 같은 구조로 늘리면 됨)
// 출처 표기: 사건 자체(연도·내용)를 확인할 수 있는 공공 백과·기관 이름. 게임 속 수치(돈·행복 변화)는 출처 없는 게임 계산이다.
// 아픈 역사(식민 지배·전쟁·참사)는 사실만 담담하게 — 자극적인 묘사는 하지 않는다.
// =========================

const T = (ko, ja, en) => ({ ko, ja, en });
const SRC = {
  encykorea: T("한국민족문화대백과사전", "韓国民族文化大百科事典", "Encyclopedia of Korean Culture"),
  history: T("국사편찬위원회 우리역사넷", "国史編纂委員会「ウリ歴史ネット」", "National Institute of Korean History"),
  archives: T("국가기록원", "国家記録院", "National Archives of Korea"),
  kosis: T("통계청 국가통계포털(KOSIS)", "統計庁KOSIS", "Statistics Korea (KOSIS)"),
  bok: T("한국은행 경제통계", "韓国銀行 経済統計", "Bank of Korea statistics"),
  who: T("세계보건기구(WHO)", "世界保健機関(WHO)", "World Health Organization"),
  ioc: T("국제올림픽위원회·FIFA 기록", "IOC・FIFAの記録", "IOC / FIFA records"),
};
const has = (p, ...c) => c.includes(p.career);
const adult = (p) => p.age >= 18, kid = (p) => p.age < 13, man = (p) => p.gender === "M";
const north = (p) => ["seoul", "gyeonggi", "gangwon", "incheon"].includes(p.region);   // 6·25 초기 영향이 컸던 곳 (게임 단순화)
const rural = (p) => ["jeolla", "chungcheong", "gangwon", "gyeongsang", "jeju"].includes(p.region);

// 개인 결과 문장 키는 life-worldev.js 의 OUT 을 같이 쓴다 (+ 여기서 더함)
export const HIST_OUT = {
  hard: T("살림이 몹시 어려워졌다. 그래도 가족이 서로 기대어 버텼다.", "暮らしがひどく苦しくなった。それでも家族で支え合って耐えた。", "Life got very hard. Still, the family leaned on each other and endured."),
  flee: T("짐을 싸서 남쪽으로 피란을 떠났다.", "荷物をまとめて南へ避難した。", "We packed up and fled south."),
  hope: T("앞으로는 나아질 거라는 희망이 생겼다.", "これからは良くなるという希望が生まれた。", "Hope appeared that things would get better."),
  street: T("거리로 나가 사람들과 함께했다.", "通りに出て人々と一緒にいた。", "I went out into the streets with everyone."),
  quiet: T("숨죽이며 그 시절을 지나갔다.", "息を潜めてその時代を過ごした。", "I got through those days quietly, holding my breath."),
  work: T("일자리가 늘었다. 열심히 하면 될 것 같았다.", "仕事が増えた。頑張ればなんとかなりそうだった。", "Jobs multiplied. It felt like hard work would pay off."),
  mourn: T("온 나라가 함께 슬퍼했다.", "国中が一緒に悲しんだ。", "The whole country grieved together."),
};

export const HIST_KR = [
  // ---------- 대한제국 · 일제강점기 ----------
  { id: "h_kr_1905", country: "KR", year: 1905, areas: ["social"], src: SRC.encykorea, kind: "social", emoji: "📜", t: T("을사늑약", "乙巳条約", "The Eulsa Treaty"), x: T("나라의 외교권을 빼앗는 조약이 맺어졌다. 어른들의 얼굴이 어두웠다.", "国の外交権を奪う条約が結ばれた。大人たちの顔が暗かった。", "A treaty strips the nation of its diplomatic rights. The adults' faces darken."), eff: (p) => ({ d: { happy: -3 }, o: kid(p) ? "kidSaw" : "quiet" }) },
  { id: "h_kr_1907", country: "KR", year: 1907, areas: ["econ", "social"], src: SRC.encykorea, kind: "social", emoji: "🪙", t: T("국채 보상 운동", "国債報償運動", "The National Debt Repayment Movement"), x: T("나랏빚을 갚자며 사람들이 담배를 끊고 반지를 내놓았다.", "国の借金を返そうと、人々は煙草をやめ指輪を差し出した。", "To repay the national debt, people quit smoking and gave up their rings."), eff: (p) => ({ d: adult(p) ? { money: -40, social: 3, happy: 1 } : { social: 1 }, o: adult(p) ? "street" : "kidSaw" }) },
  { id: "h_kr_1910", country: "KR", year: 1910, until: 1945, areas: ["social", "econ", "life"], src: SRC.history, kind: "social", emoji: "⛓️", t: T("나라를 잃다", "国を失う", "The Nation Is Lost"), x: T("8월, 나라가 일본에 강제로 병합됐다. 서른다섯 해의 식민 지배가 시작됐다.", "8月、国が日本に強制的に併合された。35年の植民地支配が始まった。", "In August, the country is forcibly annexed by Japan. Thirty-five years of colonial rule begin."), eff: (p) => ({ d: { happy: -6 }, o: kid(p) ? "kidSaw" : "quiet" }) },
  { id: "h_kr_1919", country: "KR", year: 1919, areas: ["social"], src: SRC.history, kind: "social", emoji: "🇰🇷", t: T("3·1 운동", "三・一独立運動", "The March 1st Movement"), x: T("3월 1일, 전국에서 '대한 독립 만세' 소리가 울려 퍼졌다.", "3月1日、全国で「大韓独立万歳」の声が響き渡った。", "On March 1st, cries of 'Long live Korean independence!' ring out nationwide."), eff: (p) => ({ d: adult(p) || p.age >= 12 ? { social: 4, happy: 2, health: -1 } : { social: 1 }, o: p.age >= 12 ? "street" : "kidSaw" }) },
  { id: "h_kr_1920", country: "KR", year: 1920, areas: ["life"], src: SRC.encykorea, kind: "culture", emoji: "📰", t: T("우리말 신문", "朝鮮語の新聞", "Korean-Language Newspapers"), x: T("우리말 신문들이 창간됐다. 글을 아는 사람이 신문을 소리 내어 읽어 주었다.", "朝鮮語の新聞が創刊された。字の読める人が声に出して読んでくれた。", "Korean-language newspapers are founded. Those who could read read them aloud to others."), eff: (p) => ({ d: { intel: p.age >= 8 ? 2 : 0, social: 1 }, o: "learn" }) },
  { id: "h_kr_1929", country: "KR", year: 1929, areas: ["social"], src: SRC.history, kind: "social", emoji: "🎒", t: T("광주 학생 항일 운동", "光州学生抗日運動", "The Gwangju Student Movement"), x: T("광주에서 시작된 학생들의 항일 운동이 전국 학교로 번졌다.", "光州で始まった学生の抗日運動が全国の学校に広がった。", "A student anti-colonial movement starting in Gwangju spreads to schools nationwide."), eff: (p) => ({ d: p.age >= 12 && p.age <= 25 ? { social: 3, happy: 1 } : {}, o: p.age >= 12 && p.age <= 25 ? "street" : "far" }) },
  { id: "h_kr_1930", country: "KR", year: 1930, until: 1934, areas: ["econ"], src: SRC.encykorea, kind: "econ", emoji: "🌾", t: T("쌀값이 무너지다", "米価の暴落", "Rice Prices Collapse"), x: T("세계 대공황의 여파로 쌀값이 크게 떨어졌다. 농사짓는 집들이 빚더미에 올랐다.", "世界恐慌の余波で米価が大きく下がった。農家は借金に追われた。", "In the wake of the Great Depression, rice prices plunge. Farming families sink into debt."), eff: (p) => ({ d: { money: rural(p) ? -250 : -80, happy: -3 }, o: rural(p) ? "hard" : "hit" }) },
  { id: "h_kr_1938", country: "KR", year: 1938, until: 1945, areas: ["life", "family", "job"], src: SRC.history, kind: "social", emoji: "🏭", t: T("전시 동원", "戦時動員", "Wartime Mobilization"), x: T("전쟁을 이유로 쌀과 쇠붙이를 빼앗기고, 많은 사람이 공장·탄광·전쟁터로 끌려갔다.", "戦争を理由に米や金属を取り上げられ、多くの人が工場・炭鉱・戦場へ連れて行かれた。", "In the name of war, rice and metal are seized, and many are taken to factories, mines, and battlefields."), eff: (p) => ({ d: { happy: -5, money: -100, health: man(p) && p.age >= 17 && p.age <= 40 ? -4 : -1 }, o: "hard" }) },
  { id: "h_kr_1940", country: "KR", year: 1940, areas: ["social", "family"], src: SRC.history, kind: "social", emoji: "📛", t: T("이름을 바꾸라는 명령", "創氏改名", "Ordered to Change Names"), x: T("일본식 이름으로 바꾸라는 강요가 시작됐다. 학교에선 우리말을 쓰면 벌을 받았다.", "日本式の名前に変えるよう強要が始まった。学校では朝鮮語を使うと罰を受けた。", "People are forced to adopt Japanese-style names. Speaking Korean at school is punished."), eff: (p) => ({ d: { happy: -3, social: -1 }, o: kid(p) ? "kidSaw" : "quiet" }) },
  { id: "h_kr_1945", country: "KR", year: 1945, areas: ["social", "life"], src: SRC.history, kind: "social", emoji: "🎉", t: T("광복", "光復(解放)", "Liberation"), x: T("8월 15일, 해방이 왔다. 사람들이 태극기를 들고 거리로 쏟아져 나왔다.", "8月15日、解放が訪れた。人々が太極旗を手に通りへあふれ出た。", "August 15th: liberation. People pour into the streets waving the national flag."), eff: (p) => ({ d: { happy: 10, social: 3 }, o: "street" }) },
  { id: "h_kr_1948", country: "KR", year: 1948, areas: ["social"], src: SRC.archives, kind: "social", emoji: "🏛️", t: T("대한민국 정부 수립", "大韓民国政府樹立", "The Republic of Korea Is Founded"), x: T("첫 총선거가 치러지고, 8월 15일 대한민국 정부가 세워졌다.", "初の総選挙が行われ、8月15日に大韓民国政府が樹立された。", "The first general election is held, and on August 15th the Republic of Korea government is established."), eff: (p) => ({ d: { happy: 3 }, o: "hope" }) },
  // ---------- 전쟁과 재건 ----------
  { id: "h_kr_1950", country: "KR", year: 1950, until: 1953, areas: ["life", "family", "health", "econ"], src: SRC.history, kind: "disaster", emoji: "💥", t: T("6·25 전쟁", "朝鮮戦争", "The Korean War"), x: T("6월 25일 새벽, 전쟁이 일어났다. 수많은 가족이 집을 떠나 피란길에 올랐다.", "6月25日未明、戦争が起きた。多くの家族が家を離れ避難の道に出た。", "Before dawn on June 25th, war breaks out. Countless families leave home as refugees."), eff: (p) => { const d = { happy: -12, health: -4, money: -Math.round(200 + Math.max(0, p.stats.money) * 0.35) }; if (north(p)) { d.health -= 3; d.happy -= 3; } p.flags?.add?.("war_refugee"); return { d, o: north(p) ? "flee" : kid(p) ? "kidSaw" : "hard" }; } },
  // 1953 휴전은 life-worldev.js 의 w_armistice
  { id: "h_kr_1955", country: "KR", year: 1955, until: 1960, areas: ["econ", "life"], src: SRC.encykorea, kind: "econ", emoji: "📦", t: T("원조 물자의 시절", "援助物資の時代", "The Years of Aid"), x: T("폐허 위에 판잣집이 들어섰다. 아이들은 구호품 우유 가루를 받아 왔다.", "廃墟の上にバラックが建った。子どもたちは救援物資の粉ミルクをもらってきた。", "Shacks rise over the ruins. Children bring home relief powdered milk."), eff: (p) => ({ d: { health: kid(p) ? 2 : 0, happy: -1, money: -30 }, o: kid(p) ? "kidSaw" : "hard" }) },
  { id: "h_kr_1960", country: "KR", year: 1960, areas: ["social"], src: SRC.history, kind: "social", emoji: "✊", t: T("4·19 혁명", "四・一九革命", "The April Revolution"), x: T("부정 선거에 맞서 학생과 시민들이 일어섰다. 정권이 물러났다.", "不正選挙に抗して学生と市民が立ち上がった。政権が退いた。", "Students and citizens rise against a rigged election. The government steps down."), eff: (p) => ({ d: p.age >= 15 && p.age <= 35 ? { social: 4, happy: 2 } : { happy: 1 }, o: p.age >= 15 && p.age <= 35 ? "street" : "watch" }) },
  { id: "h_kr_1961", country: "KR", year: 1961, areas: ["social"], src: SRC.history, kind: "social", emoji: "🪖", t: T("5·16 군사정변", "五・一六軍事クーデター", "The May 16 Coup"), x: T("군인들이 정권을 잡았다. 나라가 '경제 개발'을 향해 급하게 움직이기 시작했다.", "軍人が政権を握った。国が「経済開発」に向けて急いで動き始めた。", "The military seizes power. The country lurches toward 'economic development.'"), eff: (p) => ({ d: { happy: -1 }, o: "quiet" }) },
  // 1962 경제 개발은 life-worldev.js 의 w_econ_plan
  { id: "h_kr_1966", country: "KR", year: 1966, until: 1977, areas: ["job", "econ"], src: SRC.archives, kind: "econ", emoji: "⛏️", t: T("독일로 간 광부와 간호사", "ドイツへ渡った鉱夫と看護師", "Miners and Nurses to Germany"), x: T("많은 젊은이가 서독의 탄광과 병원으로 일하러 떠났다. 그들이 보낸 돈이 집안을 일으켰다.", "多くの若者が西ドイツの炭鉱や病院へ働きに出た。仕送りが家を支えた。", "Many young people leave to work in West German mines and hospitals. The money they send home lifts families."), eff: (p) => ({ d: { happy: 0 }, o: "watch" }) },
  { id: "h_kr_1970", country: "KR", year: 1970, areas: ["life", "econ"], src: SRC.archives, kind: "econ", emoji: "🛣️", t: T("경부고속도로 개통", "京釜高速道路開通", "The Seoul–Busan Expressway Opens"), x: T("서울과 부산이 고속도로로 이어졌다. 같은 해 '새마을 운동'도 시작됐다.", "ソウルと釜山が高速道路で結ばれた。同じ年、「セマウル運動」も始まった。", "An expressway now links Seoul and Busan. The same year, the New Village Movement begins."), eff: (p) => ({ d: rural(p) ? { money: 120, happy: 2 } : { happy: 2 }, o: "work" }) },
  { id: "h_kr_1975", country: "KR", year: 1975, until: 1982, areas: ["job", "econ"], src: SRC.encykorea, kind: "econ", emoji: "🏗️", t: T("중동 건설 붐", "中東建設ブーム", "The Middle East Construction Boom"), x: T("사막의 건설 현장으로 수많은 노동자가 떠났다. 달러를 벌어 집을 샀다는 이야기가 퍼졌다.", "砂漠の建設現場へ多くの労働者が旅立った。ドルを稼いで家を買ったという話が広まった。", "Workers head to desert construction sites. Stories spread of men who bought homes with dollars."), econ: "boom", eff: (p) => ({ d: adult(p) && p.age < 50 ? { money: 200, happy: 1 } : {}, o: "work" }) },
  { id: "h_kr_1979", country: "KR", year: 1979, areas: ["social"], src: SRC.history, kind: "social", emoji: "📻", t: T("10·26 사건", "十・二六事件", "The October 26 Incident"), x: T("대통령이 숨졌다는 소식이 라디오에서 흘러나왔다. 긴 시대가 갑자기 끝났다.", "大統領死去の知らせがラジオから流れた。長い時代が突然終わった。", "Radio news: the president is dead. A long era ends suddenly."), eff: (p) => ({ d: { happy: -1 }, o: "watch" }) },
  { id: "h_kr_1980", country: "KR", year: 1980, region: ["gwangju", "jeolla"], areas: ["social", "health"], src: SRC.history, kind: "social", emoji: "🕯️", t: T("5·18 광주 민주화 운동", "五・一八光州民主化運動", "The Gwangju Uprising"), x: T("광주의 시민들이 계엄군에 맞섰다. 많은 이가 목숨을 잃었고, 진실은 오래 가려졌다.", "光州の市民が戒厳軍に立ち向かった。多くの命が失われ、真実は長く隠された。", "Citizens of Gwangju stand against martial-law troops. Many lose their lives; the truth stays hidden for years."), eff: (p) => ["gwangju", "jeolla"].includes(p.region) ? { d: { happy: -10, social: 3, health: -2 }, o: "mourn" } : { d: { happy: -1 }, o: "quiet" } },
  { id: "h_kr_1986", country: "KR", year: 1986, areas: ["life"], src: SRC.ioc, kind: "culture", emoji: "🏅", t: T("서울 아시안게임", "ソウル・アジア大会", "The Seoul Asian Games"), x: T("서울에서 아시안게임이 열렸다. 2년 뒤엔 올림픽이었다.", "ソウルでアジア大会が開かれた。2年後はオリンピックだった。", "Seoul hosts the Asian Games. The Olympics are two years away."), eff: (p) => ({ d: { happy: 3 }, o: "joy" }) },
  { id: "h_kr_1987", country: "KR", year: 1987, areas: ["social"], src: SRC.history, kind: "social", emoji: "📣", t: T("6월 민주 항쟁", "六月民主抗争", "The June Democratic Struggle"), x: T("넥타이를 맨 회사원까지 거리로 나왔다. 대통령을 국민이 직접 뽑게 됐다.", "ネクタイ姿の会社員まで通りに出た。大統領を国民が直接選べるようになった。", "Even office workers in ties join the protests. Citizens win the right to directly elect the president."), eff: (p) => ({ d: p.age >= 17 && p.age <= 45 ? { social: 4, happy: 3 } : { happy: 2 }, o: p.age >= 17 && p.age <= 45 ? "street" : "hope" }) },
  { id: "h_kr_1989", country: "KR", year: 1989, areas: ["life"], src: SRC.archives, kind: "culture", emoji: "✈️", t: T("해외여행 자유화", "海外旅行自由化", "Overseas Travel Opens Up"), x: T("누구나 여권을 만들어 해외여행을 갈 수 있게 됐다.", "誰でもパスポートを作って海外旅行に行けるようになった。", "Anyone can now get a passport and travel abroad."), eff: (p) => ({ d: { happy: 2 }, o: "hope" }) },
  { id: "h_kr_1993", country: "KR", year: 1993, areas: ["econ"], src: SRC.archives, kind: "econ", emoji: "🏦", t: T("금융 실명제", "金融実名制", "The Real-Name Financial System"), x: T("어느 날 밤 갑자기, 모든 금융 거래를 실명으로 하라는 발표가 나왔다.", "ある夜突然、すべての金融取引を実名で行うよう発表された。", "One night, without warning, all financial transactions must use real names."), eff: (p) => ({ d: p.stats.money >= 50000 ? { money: -Math.round(p.stats.money * 0.03) } : {}, o: p.stats.money >= 50000 ? "hitRich" : "watch" }) },
  { id: "h_kr_1995", country: "KR", year: 1995, areas: ["life", "social"], src: SRC.archives, kind: "disaster", emoji: "🏚️", t: T("무너진 다리와 백화점", "崩れた橋と百貨店", "A Bridge and a Store Collapse"), x: T("한강 다리(1994)에 이어 백화점(1995)이 무너졌다. '빨리빨리'를 돌아보게 됐다.", "漢江の橋(1994年)に続き百貨店(1995年)が崩れた。「パルリパルリ」を見直すきっかけになった。", "After a Han River bridge (1994), a department store collapses (1995). The nation rethinks its rush."), eff: (p) => ({ d: { happy: -3 }, o: "mourn" }) },
  // 1997 외환 위기 = life-worldev.js 의 w_imf
  { id: "h_kr_1998", country: "KR", year: 1998, areas: ["econ", "social"], src: SRC.archives, kind: "social", emoji: "💍", t: T("금 모으기 운동", "金集め運動", "The Gold Collection Campaign"), x: T("나랏빚을 갚자며 수백만 명이 장롱 속 금반지를 들고 은행 앞에 줄을 섰다.", "国の借金を返そうと、数百万人がたんすの金の指輪を持って銀行に並んだ。", "Millions line up at banks with gold rings from their drawers to help repay the national debt."), eff: (p) => ({ d: adult(p) ? { money: -60, social: 3, happy: 2 } : { social: 1 }, o: adult(p) ? "street" : "kidSaw" }) },
  { id: "h_kr_1999", country: "KR", year: 1999, until: 2001, areas: ["job", "econ"], src: SRC.encykorea, kind: "tech", emoji: "💻", t: T("초고속 인터넷과 벤처 열풍", "高速インターネットとベンチャーブーム", "Broadband and the Venture Boom"), x: T("집집마다 인터넷 선이 들어오고, 골목마다 PC방이 생겼다. 벤처 회사가 쏟아졌다.", "家々にネット回線が引かれ、路地ごとにPC房ができた。ベンチャー企業が次々生まれた。", "Broadband reaches every home and PC cafés appear on every corner. Startups pop up everywhere."), eff: (p) => ({ d: has(p, "developer", "business") ? { money: 600, happy: 3 } : { internet: 4 }, o: has(p, "developer", "business") ? "gain" : "learn" }) },
  // 2002 월드컵 = w_wc2002
  { id: "h_kr_2004", country: "KR", year: 2004, areas: ["life", "job"], src: SRC.archives, kind: "social", emoji: "🚄", t: T("KTX와 주 5일제", "KTXと週休二日制", "High-Speed Rail and the Five-Day Week"), x: T("고속철도가 달리기 시작했고, 큰 회사부터 토요일에 쉬기 시작했다.", "高速鉄道が走り始め、大企業から土曜日が休みになり始めた。", "High-speed trains begin running, and big companies start taking Saturdays off."), eff: (p) => ({ d: p.job ? { happy: 4, health: 1 } : { happy: 1 }, o: p.job ? "gain" : "watch" }) },
  { id: "h_kr_2009", country: "KR", year: 2009, areas: ["life", "tech"], src: SRC.encykorea, kind: "tech", emoji: "📱", t: T("스마트폰 상륙", "スマートフォン上陸", "Smartphones Arrive"), x: T("스마트폰이 국내에 들어왔다. 지하철 풍경이 바뀌었다.", "スマートフォンが国内に入ってきた。地下鉄の風景が変わった。", "Smartphones launch in Korea. The subway looks different overnight."), eff: (p) => ({ d: { internet: 4 }, o: "learn" }) },
  { id: "h_kr_2012", country: "KR", year: 2012, areas: ["culture"], src: SRC.encykorea, kind: "culture", emoji: "🕺", t: T("말춤이 세계로", "馬ダンスが世界へ", "A Horse Dance Goes Global"), x: T("한국 노래 한 곡이 전 세계 조회수 기록을 갈아 치웠다. '한류'가 더 커졌다.", "韓国の歌一曲が世界の再生回数記録を塗り替えた。「韓流」がさらに大きくなった。", "A Korean song breaks global view records. The Korean Wave grows bigger."), eff: (p) => ({ d: { happy: 2, money: has(p, "idol", "streamer") ? 300 : 0 }, o: "joy" }) },
  { id: "h_kr_2014", country: "KR", year: 2014, areas: ["social"], src: SRC.archives, kind: "disaster", emoji: "🎗️", t: T("4월의 바다", "四月の海", "The April Sea"), x: T("수학여행 가던 학생들을 태운 배가 진도 앞바다에서 침몰했다. 온 나라가 노란 리본을 달았다.", "修学旅行の学生を乗せた船が珍島沖で沈没した。国中が黄色いリボンをつけた。", "A ferry carrying students on a school trip sinks off Jindo. The whole country wears yellow ribbons."), eff: (p) => ({ d: { happy: -5 }, o: "mourn" }) },
  { id: "h_kr_2016", country: "KR", year: 2016, until: 2017, areas: ["social"], src: SRC.archives, kind: "social", emoji: "🕯️", t: T("촛불 집회", "ろうそく集会", "The Candlelight Protests"), x: T("주말마다 광장에 촛불을 든 사람들이 모였다. 이듬해 대통령이 탄핵됐다.", "週末ごとに広場にろうそくを持った人々が集まった。翌年、大統領が罷免された。", "Every weekend, crowds with candles fill the squares. The next year, the president is removed from office."), eff: (p) => ({ d: p.age >= 16 ? { social: 3, happy: 1 } : {}, o: p.age >= 16 ? "street" : "watch" }) },
  { id: "h_kr_2018", country: "KR", year: 2018, areas: ["culture", "social"], src: SRC.ioc, kind: "culture", emoji: "⛷️", t: T("평창 올림픽과 판문점", "平昌五輪と板門店", "PyeongChang and Panmunjom"), x: T("평창에서 겨울 올림픽이 열렸고, 봄에는 남북 정상이 판문점에서 손을 잡았다.", "平昌で冬季五輪が開かれ、春には南北首脳が板門店で手を取り合った。", "PyeongChang hosts the Winter Olympics, and in spring the leaders of North and South shake hands at Panmunjom."), eff: (p) => ({ d: { happy: 3 }, o: "hope" }) },
  { id: "h_kr_2020_kpop", country: "KR", year: 2020, areas: ["culture"], src: SRC.encykorea, kind: "culture", emoji: "🎤", t: T("K팝, 빌보드 1위", "K-POP、ビルボード1位", "K-pop Tops the Billboard Hot 100"), x: T("한국 그룹의 노래가 미국 빌보드 싱글 차트 1위에 올랐다.", "韓国グループの曲が米ビルボードのシングルチャート1位になった。", "A Korean group's song reaches No. 1 on the US Billboard Hot 100."), eff: (p) => ({ d: { happy: 2, money: has(p, "idol") ? 400 : 0 }, o: "joy" }) },
];

// 출처: 세계 사건(life-worldev.js)의 한국 관련 항목에도 출처를 붙여 둔다 (같은 키)
export const SRC_OF = {
  w_armistice: SRC.history, w_econ_plan: SRC.history, w_seoul88: SRC.ioc, w_imf: SRC.bok, w_wc2002: SRC.ioc, w_pandemic: SRC.who, w_gfc: SRC.bok,
};
export const HIST_SRC = SRC;

// 시대 구분 (화면 색·장면·결말 '내가 살아온 시대' 장 제목에 씀) — 한국 기준
export const PERIODS_KR = [
  { id: "empire", from: 1897, to: 1910, n: T("대한제국", "大韓帝国", "the Korean Empire") },
  { id: "colonial", from: 1910, to: 1945, n: T("일제강점기", "日本統治時代", "the Japanese colonial period") },
  { id: "liberation", from: 1945, to: 1950, n: T("해방 공간", "解放直後", "the liberation years") },
  { id: "war", from: 1950, to: 1953, n: T("6·25 전쟁", "朝鮮戦争", "the Korean War") },
  { id: "rebuild", from: 1953, to: 1962, n: T("전후 재건기", "戦後復興期", "postwar reconstruction") },
  { id: "industrial", from: 1962, to: 1987, n: T("산업화 시대", "産業化の時代", "the industrialization era") },
  { id: "democracy", from: 1987, to: 1997, n: T("민주화 이후", "民主化以後", "the post-democratization years") },
  { id: "imf", from: 1997, to: 2002, n: T("외환 위기와 회복", "通貨危機と回復", "the financial crisis and recovery") },
  { id: "digital", from: 2002, to: 2020, n: T("인터넷·스마트폰 시대", "ネット・スマホ時代", "the internet and smartphone era") },
  { id: "now", from: 2020, to: 2026, n: T("코로나 이후", "コロナ以後", "the post-pandemic years") },
  { id: "future", from: 2026, to: 2200, n: T("가상의 미래", "架空の未来", "the fictional future") },
];
export const periodOf = (cal, country = "KR") => country === "KR" ? (PERIODS_KR.find(x => cal >= x.from && cal < x.to) || PERIODS_KR[PERIODS_KR.length - 1]) : null;

// ---------- 시대에 맞지 않는 것 막기 ----------
// 직업이 생겨난(그 나라에서 흔해진) 해 — 게임용 어림. 그 전에는 그 직업 사건·자동 취업이 나오지 않는다
export const CAREER_FROM = { developer: 1970, streamer: 2006, gamer: 1999, idol: 1960, corporate: 1962, civil: 1910, politics: 1948, athlete: 1920, lawyer: 1906, doctor: 1900, teacher: 1900, writer: 1900, artist: 1900, business: 1900, worker: 1900 };
// 사건 글에 나오는 물건·문화 → 그것이 흔해진 해 (어림). 사건 하나에 여러 개면 가장 늦은 해
export const THING_FROM = [
  [/스마트폰|앱 |앱을|어플|인스타|틱톡|숏폼|챌린지 영상|SNS|단톡|카톡|배달 앱|구독 서비스|넷플릭스/, 2010],
  [/유튜브|유튜버|스트리머|스트리밍|구독자|라이브 방송|조회수|밈|인플루언서|브이로그/, 2007],
  [/코인|비트코인|가상화폐|메타버스|NFT/, 2014], [/인공지능|챗봇|\bAI\b/, 2018],
  [/PC방|온라인 게임|e스포츠|프로게이머|게임 중독|롤 |배그/, 1999], [/인터넷|이메일|온라인|웹툰|웹소설|블로그|해킹|코딩|검색/, 1997],
  [/휴대폰|핸드폰|문자 메시지|문자를|삐삐/, 1995], [/컴퓨터|게임기|게임 한 판|밤샘 게임/, 1985], [/노래방/, 1991], [/찜질방/, 1996], [/편의점/, 1990], [/대형마트|마트/, 1994],
  [/KTX/, 2004], [/로스쿨/, 2009], [/수능/, 1994], [/전세 사기/, 2012], [/아이돌|연습생|K팝|한류|오디션 프로/, 1996],
  [/텔레비전|TV|티비|드라마|예능/, 1962], [/에어컨/, 1980], [/아파트/, 1965], [/자동차|운전|면허|드라이브|차를 샀|새 차/, 1965], [/비행기|해외여행|공항|여권/, 1975],
  [/헬스장|PT|필라테스|요가/, 1988], [/캠핑/, 1985], [/소개팅/, 1975], [/카페|커피/, 1960], [/햄버거|피자/, 1980], [/학원/, 1965], [/신용카드|카드값|대출/, 1980], [/주식|펀드|투자/, 1975],
];
/** 사건 글 → 가장 늦은 '흔해진 해' (없으면 0) */
export function thingYear(text) { let y = 0; for (const [rx, yr] of THING_FROM) if (rx.test(text)) y = Math.max(y, yr); return y; }
