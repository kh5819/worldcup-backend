// 방송국 서바이벌(15인) — 역할·지표·행동·비밀 미션·계약·파벌·여론·엔딩 데이터. 판정은 lifebc-sv-core.js. 모든 인물·사건은 게임 속 허구.
export const L = (ko, ja, en) => ({ ko, ja: ja ?? ko, en: en ?? ko });

export const DIFF = {
  normal: { name: L("보통", "普通", "Normal"), money: 3200, up: 0.96, rev: 1.03, urgent: 0.55, sev: 0.94, rec: 1.06, doom: 3, crime: 0.85 },
  hard: { name: L("어려움", "難しい", "Hard"), money: 3000, up: 1, rev: 1, urgent: 0.62, sev: 1, rec: 1, doom: 2, crime: 1 },
  expert: { name: L("전문가", "エキスパート", "Expert"), money: 2900, up: 1.02, rev: 0.99, urgent: 0.68, sev: 1.04, rec: 0.97, doom: 2, crime: 1.1 },
};
export const METRICS = {
  money: { ic: "💰", name: L("방송국 자금", "放送局の資金", "Funds") }, trust: { ic: "🤍", name: L("시청자 신뢰", "視聴者の信頼", "Viewer trust") }, rating: { ic: "📈", name: L("시청률", "視聴率", "Ratings") }, unity: { ic: "🤝", name: L("내부 결속", "内部の結束", "Unity") },
  stab: { ic: "🔧", name: L("방송 안정성", "放送の安定性", "Stability") }, ctrv: { ic: "🔥", name: L("논란 수위", "炎上度", "Controversy"), inv: 1 }, fat: { ic: "😮‍💨", name: L("출연진 피로도", "出演者の疲労", "Fatigue"), inv: 1 }, ad: { ic: "🏢", name: L("광고주 신뢰", "広告主の信頼", "Sponsor trust") },
};
export const ROLES = {
  director: { ic: "👑", name: L("방송국장", "放送局長", "Station Chief"), desc: L("공식 대응 방향을 정하고 안건에 2표를 행사", "公式対応を決め、議題で2票を持つ", "Sets official response; 2 votes on agendas") },
  pd: { ic: "🎬", name: L("메인 PD", "メインPD", "Lead PD"), desc: L("오늘의 편성과 방송 강행·중단을 결정", "今日の編成と放送の強行・中断を決める", "Decides programming, push or halt") },
  pr: { ic: "📣", name: L("홍보 담당", "広報担当", "PR Lead"), desc: L("소문과 여론에 공식 입장을 낸다", "噂と世論に公式見解を出す", "Issues official statements on rumors") },
  finance: { ic: "🧾", name: L("재무 담당", "財務担当", "Finance Lead"), desc: L("긴급 자금과 광고주 계약을 맡는다", "緊急資金と広告契約を担う", "Handles emergency funds and sponsors") },
  tech: { ic: "🔧", name: L("기술 감독", "技術監督", "Tech Director"), desc: L("송출 장비와 사고 복구를 맡는다", "送出機材と事故復旧を担う", "Runs equipment and recovery") },
  legal: { ic: "⚖️", name: L("법무 담당", "法務担当", "Legal Counsel"), desc: L("계약과 분쟁을 검토한다", "契約と紛争を検討する", "Reviews contracts and disputes") },
  writer: { ic: "✍️", name: L("메인 작가", "メイン作家", "Head Writer"), desc: L("대본과 사과문을 쓴다", "台本と謝罪文を書く", "Writes scripts and statements") },
  hr: { ic: "🫂", name: L("매니저", "マネージャー", "Cast Manager"), desc: L("출연진 피로와 불만을 돌본다", "出演者の疲労と不満をケアする", "Looks after cast fatigue") },
  cast: { ic: "🌟", name: L("출연진", "出演者", "Cast Member"), desc: L("방송에 나가 인기를 얻고 사과·해명을 직접 한다", "放送で人気を得て、謝罪・釈明を直接行う", "Performs on air, apologizes or explains") },
};
// 인원별 역할 구성. 필수 역할 5개는 사람이 없으면 NPC가 맡는다
export const STATION_SIZE = (humans) => (humans <= 4 ? 6 : humans <= 8 ? 8 : Math.max(12, humans));
export const ROLE_ORDER = ["director", "pd", "pr", "finance", "tech", "cast", "cast", "legal", "cast", "hr", "writer", "cast", "cast", "cast", "cast"];
export const NPC_NAMES = [L("서하린", "ソ・ハリン", "Seo Harin"), L("도윤재", "ド・ユンジェ", "Do Yunjae"), L("민가온", "ミン・ガオン", "Min Gaon"), L("강태오", "カン・テオ", "Kang Taeo"), L("윤세아", "ユン・セア", "Yoon Sea"), L("백지훈", "ペク・ジフン", "Baek Jihun"), L("한소이", "ハン・ソイ", "Han Soi"), L("차민호", "チャ・ミンホ", "Cha Minho"), L("오나라", "オ・ナラ", "Oh Nara"), L("임도현", "イム・ドヒョン", "Lim Dohyun"), L("정유나", "チョン・ユナ", "Jung Yuna"), L("류시온", "リュ・シオン", "Ryu Sion"), L("남기범", "ナム・ギボム", "Nam Gibeom"), L("문채원", "ムン・チェウォン", "Moon Chaewon"), L("장하람", "チャン・ハラム", "Jang Haram")];

// 하루 행동(하루 1번). loc은 범인 찾기 알리바이의 실제 위치 기록
export const ACTIONS = {
  meeting: { roles: ["director"], ic: "🗣️", name: L("전체 회의", "全体会議", "All-hands"), desc: L("결속↑ 피로↑", "結束↑ 疲労↑", "Unity up, fatigue up"), d: { unity: 7, fat: 1 }, loc: "office" },
  produce: { roles: ["pd"], ic: "🎥", name: L("제작 집중", "制作に集中", "Focus production"), desc: L("시청률↑ 피로↑", "視聴率↑ 疲労↑", "Ratings up, fatigue up"), d: { rating: 6, fat: 3 }, loc: "studio" },
  rehearse: { roles: ["pd"], ic: "📋", name: L("리허설 강화", "リハ強化", "Extra rehearsal"), desc: L("안정성↑ 사고 위험↓", "安定性↑ 事故リスク↓", "Stability up, accident risk down"), d: { stab: 5 }, clear: { maint: 1 }, loc: "studio" },
  campaign: { roles: ["pr"], ic: "📰", name: L("여론 관리", "世論管理", "Public relations"), desc: L("논란↓ 신뢰↑", "炎上↓ 信頼↑", "Controversy down, trust up"), d: { ctrv: -7, trust: 3, money: -80 }, clear: { fans: 1 }, loc: "pr" },
  monitor: { roles: ["pr"], ic: "🔎", name: L("여론 모니터링", "世論モニタリング", "Monitor rumors"), desc: L("소문 하나의 진위 단서", "噂一つの真偽の手がかり", "Clue on one rumor's truth"), d: {}, loc: "pr" },
  sponsor: { roles: ["finance"], ic: "🤝", name: L("광고 영업", "広告営業", "Sell sponsorships"), desc: L("자금↑ 광고주 신뢰↑", "資金↑ 広告主の信頼↑", "Funds and sponsor trust up"), d: { money: 330, ad: 3 }, clear: { ads: 1 }, loc: "meeting" },
  audit: { roles: ["finance"], ic: "📒", name: L("회계 감사", "会計監査", "Audit books"), desc: L("회계 증거 확보 가능. 미지급 위험↓", "会計の証拠確保。未払いリスク↓", "May find evidence; lowers arrears risk"), d: {}, clear: { unpaid: 1 }, evidence: "ledger", loc: "office" },
  maint: { roles: ["tech"], ic: "🛠️", name: L("장비 점검", "機材点検", "Maintain gear"), desc: L("안정성↑↑ 비용", "安定性↑↑ コスト", "Big stability up, costs funds"), d: { stab: 9, money: -150 }, clear: { maint: 2 }, loc: "control" },
  backup: { roles: ["tech"], ic: "💽", name: L("예비 회선 준비", "予備回線の準備", "Prepare backup line"), desc: L("다음 기술 사고 피해 절반", "次の技術事故の被害半減", "Halves next tech accident"), d: { money: -110 }, flag: "backup", loc: "control" },
  review: { roles: ["legal"], ic: "📑", name: L("계약 검토", "契約検討", "Contract review"), desc: L("광고주 신뢰↑ 논란↓", "広告主の信頼↑ 炎上↓", "Sponsor trust up, controversy down"), d: { ad: 4, ctrv: -3 }, loc: "office" },
  script: { roles: ["writer"], ic: "📝", name: L("대본 수정", "台本修正", "Polish scripts"), desc: L("시청률↑ 약간의 논란 위험", "視聴率↑ 少し炎上リスク", "Ratings up, slight controversy risk"), d: { rating: 5, ctrv: 1 }, loc: "studio" },
  care: { roles: ["hr"], ic: "🌿", name: L("출연진 케어", "出演者ケア", "Care for cast"), desc: L("피로↓↓ 결속↑", "疲労↓↓ 結束↑", "Big fatigue down, unity up"), d: { fat: -9, unity: 3, money: -70 }, clear: { grudge: 1 }, loc: "lounge" },
  perform: { roles: ["cast"], ic: "🎤", name: L("방송 활약", "放送で活躍", "Shine on air"), desc: L("내 인기↑ 시청률↑ 피로↑", "自分の人気↑ 視聴率↑ 疲労↑", "Your fame and ratings up, fatigue up"), d: { rating: 3, fat: 2 }, fame: 6, loc: "studio" },
  fanmeet: { roles: ["cast"], ic: "💌", name: L("팬 소통", "ファン交流", "Fan outreach"), desc: L("신뢰↑ 내 인기↑", "信頼↑ 自分の人気↑", "Trust and your fame up"), d: { trust: 3, ctrv: -2, fat: 1 }, fame: 3, clear: { fans: 1 }, loc: "lounge" },
  rest: { roles: null, ic: "😴", name: L("쉬기", "休む", "Rest"), desc: L("피로↓ 하지만 일은 밀린다", "疲労↓ だが仕事は滞る", "Less fatigue, but work piles up"), d: { fat: -4 }, loc: "lounge" },
  network: { roles: null, ic: "☕", name: L("친분 쌓기", "親交を深める", "Bond with someone"), desc: L("상대와 관계↑ 내 평판↑", "相手との関係↑ 自分の評判↑", "Better bond, reputation up"), target: "seat", d: { unity: 1 }, loc: "lounge" },
  investigate: { roles: null, ic: "🕵️", name: L("내부 조사", "内部調査", "Investigate"), desc: L("숨겨진 증거를 찾을 수 있다", "隠れた証拠を探せる", "May uncover hidden evidence"), d: {}, evidence: "any", loc: "archive" },
  revenge: { grudge: 1, ic: "🔥", name: L("복수의 폭로", "復讐の暴露", "Revenge leak"), desc: L("복수권을 써서 상대 평판↓↓ 논란↑ · 내 평판 일부 회복", "復讐権で相手の評判↓↓ 炎上↑・自分の評判を一部回復", "Spend your grudge: target's reputation drops, controversy rises, you recover some standing"), target: "seat", d: { ctrv: 3 }, loc: "archive" },
  // 스파이 전용. 다른 사람에게는 '내부 조사'처럼 보인다
  spy_leak: { spy: 1, ic: "📡", name: L("경쟁사에 정보 전달", "競合に情報提供", "Leak to rival"), desc: L("비용 90 · 공작금·경쟁사 점수↑ · 증거 흔적·발각 위험", "費用90・工作金と競合点↑・証拠の痕跡と発覚の危険", "Cost 90; rival points up; leaves traces, may expose you"), coin: -90, d: { ad: -3 }, loc: "archive" },
  spy_deal: { spy: 1, ic: "🕴️", name: L("계약 개입", "契約に介入", "Interfere with deal"), desc: L("비용 140 · 경쟁사 점수↑↑ · 광고주 신뢰↓ · 발각 위험 큼", "費用140・競合点↑↑・広告主の信頼↓・発覚の危険大", "Cost 140; big rival points; sponsors shaken; high exposure"), coin: -140, d: { ad: -6 }, loc: "meeting" },
  spy_lay: { spy: 1, ic: "🧥", name: L("잠복", "潜伏", "Lie low"), desc: L("의심↓ 흔적 일부 정리", "疑い↓ 痕跡を一部整理", "Lowers suspicion, cleans some traces"), d: {}, loc: "lounge" },
  spy_exec: { spy: 1, ic: "🤝", name: L("경쟁사 거래 성사", "競合との取引成立", "Close the rival deal"), desc: L("경쟁사 점수 충분 + 방송국 가치 유지 시 스파이 엔딩", "競合点が十分＋局の価値維持でスパイエンディング", "Enough rival points and intact station value triggers the spy ending"), d: {}, loc: "meeting" },
};
export const PROGRAMS = {
  safe: { ic: "🛡️", name: L("안전 편성", "安全編成", "Safe lineup"), desc: L("사고↓ 시청률↓", "事故↓ 視聴率↓", "Fewer accidents, lower ratings"), rating: -3, stab: 3, fat: -2, ctrv: -1, rev: 0.9 },
  normal: { ic: "📺", name: L("기본 편성", "基本編成", "Standard lineup"), desc: L("무난", "無難", "Balanced"), rating: 1, stab: 0, fat: 0, ctrv: 0, rev: 1 },
  bold: { ic: "🔥", name: L("공격 편성", "攻撃編成", "Bold lineup"), desc: L("시청률↑↑ 논란·피로·사고↑", "視聴率↑↑ 炎上・疲労・事故↑", "Big ratings; more controversy, fatigue, accidents"), rating: 6, stab: -3, fat: 4, ctrv: 4, rev: 1.15 },
  sponsor: { ic: "🏷️", name: L("광고 특집", "広告特集", "Sponsor special"), desc: L("수익↑ 신뢰↓", "収益↑ 信頼↓", "More income, less trust"), rating: 0, stab: 0, fat: 1, ctrv: 1, rev: 1.3, trust: -2, ad: 3 },
};
// 오늘의 안건(매일 하나, 긴급 아님): 다수결, 국장 2표
export const AGENDAS = [
  { id: "a_bonus", t: L("스태프가 밀린 수당 지급을 요청합니다.", "スタッフが未払い手当の支給を求めています。", "Staff request their overdue allowance."), o: [{ t: L("지급한다", "支給する", "Pay it"), d: { money: -180, unity: 6 }, clear: { unpaid: 1 } }, { t: L("다음 달로 미룬다", "来月に延ばす", "Delay it"), d: { unity: -4 }, risk: { unpaid: 1 } }] },
  { id: "a_collab", t: L("인기 웹예능이 합동 방송을 제안했습니다.", "人気ウェブ番組が合同放送を提案してきました。", "A hot web show proposes a joint broadcast."), o: [{ t: L("수락", "受諾", "Accept"), d: { rating: 5, fat: 3, ctrv: 1 } }, { t: L("거절", "拒否", "Decline"), d: { stab: 1 } }] },
  { id: "a_sleep", t: L("출연진이 촬영 시간 단축을 요구합니다.", "出演者が撮影時間の短縮を求めています。", "Cast demand shorter shooting hours."), o: [{ t: L("단축", "短縮", "Shorten"), d: { fat: -6, rating: -2 } }, { t: L("유지", "維持", "Keep"), d: { fat: 2, unity: -2 }, risk: { grudge: 1 } }] },
  { id: "a_gear", t: L("장비 교체 시기를 넘겼다는 보고가 올라왔습니다.", "機材交換の時期を過ぎたとの報告です。", "Gear replacement is overdue, says a report."), o: [{ t: L("교체", "交換", "Replace"), d: { money: -240, stab: 8 }, clear: { maint: 2 } }, { t: L("더 버틴다", "まだ使う", "Hold out"), risk: { maint: 1 } }] },
  { id: "a_viewer", t: L("시청자 간담회를 열자는 의견이 나왔습니다.", "視聴者懇談会を開こうとの声が出ました。", "Someone suggests a viewer town hall."), o: [{ t: L("연다", "開く", "Hold it"), d: { trust: 5, money: -100, fat: 2 }, clear: { fans: 1 } }, { t: L("안 연다", "開かない", "Skip it"), d: { trust: -1 }, risk: { fans: 1 } }] },
  { id: "a_ad", t: L("광고주가 방송 중 제품 노출 확대를 요구합니다.", "広告主が放送中の製品露出拡大を求めています。", "A sponsor wants more on-air product exposure."), o: [{ t: L("받아들인다", "受け入れる", "Accept"), d: { money: 220, ad: 3, trust: -3 } }, { t: L("거절한다", "断る", "Refuse"), d: { ad: -3, trust: 1 } }] },
  { id: "a_rest", t: L("이번 주 하루를 재방송으로 채우자는 안입니다.", "今週の1日を再放送で埋める案です。", "Proposal: fill one day this week with reruns."), o: [{ t: L("재방송", "再放送", "Reruns"), d: { fat: -7, rating: -3, stab: 2 } }, { t: L("본방 유지", "本放送維持", "Stay live"), d: { rating: 1, fat: 1 } }] },
  { id: "a_rumorbox", t: L("익명 건의함을 설치하자는 제안입니다.", "匿名意見箱を設置する提案です。", "Proposal to install an anonymous suggestion box."), o: [{ t: L("설치", "設置", "Install"), d: { unity: 2, ctrv: 1 }, flag: "tipbox" }, { t: L("보류", "保留", "Hold off"), d: {} }] },
  { id: "a_rookie", t: L("신인 출연자를 추가로 뽑을까요?", "新人出演者を追加で採用しますか？", "Hire an extra rookie cast member?"), o: [{ t: L("뽑는다", "採用", "Hire"), d: { money: -160, fat: -4, rating: 1 } }, { t: L("안 뽑는다", "採用しない", "No"), d: {} }] },
  { id: "a_loan", t: L("은행이 단기 대출을 제안했습니다. 나중에 갚아야 합니다.", "銀行が短期融資を提案。後で返済が必要です。", "A bank offers a short-term loan you must repay later."), o: [{ t: L("빌린다", "借りる", "Borrow"), d: { money: 500 }, debt: 620 }, { t: L("거절", "断る", "Decline"), d: {} }] },
  { id: "a_dinner", t: L("휴식 겸 전체 회식을 열까요?", "休息を兼ねて全体会食を開きますか？", "Hold a team dinner as a break?"), o: [{ t: L("연다", "開く", "Yes"), d: { unity: 5, fat: -3, money: -130 }, clear: { grudge: 1 } }, { t: L("다음에", "次の機会に", "Later"), d: {} }] },
  { id: "a_press", t: L("기자가 방송국 다큐 취재를 요청했습니다.", "記者が放送局のドキュメンタリー取材を求めています。", "A reporter wants to film a documentary on the station."), o: [{ t: L("허가", "許可", "Allow"), d: { trust: 3, rating: 2, ctrv: 2 } }, { t: L("거절", "拒否", "Refuse"), d: { ctrv: -1 } }] },
];
// 소문: truth true=실제 폭로, false=헛소문, forged=조작, mis=오해에서 시작. 말만 보고는 알 수 없음
export const RUMORS = [
  { id: "r_pay", t: L("[익명] 플듀 방송국, 스태프 수당 또 밀렸다는 얘기 있음", "[匿名] プルドゥ放送局、スタッフ手当がまた未払いらしい", "[Anon] PlayDuo Station is behind on staff pay again?"), key: L("#수당체불", "#手当未払い", "#UnpaidStaff") },
  { id: "r_script", t: L("[커뮤니티] 그 리얼 예능, 사실 전부 대본이었다고?", "[掲示板] あのリアル番組、実は全部台本だった？", "[Forum] That reality show was fully scripted?"), key: L("#대본논란", "#台本疑惑", "#ScriptGate") },
  { id: "r_quit", t: L("[연예 뉴스] 간판 출연자 하차설… 방송국은 침묵", "[芸能ニュース] 看板出演者に降板説…局は沈黙", "[Ent News] Star cast member rumored to quit; station silent"), key: L("#하차설", "#降板説", "#QuitRumor") },
  { id: "r_ad", t: L("[속보?] 메인 광고주가 계약을 끊는다는 문서가 돌고 있다", "[速報？] メイン広告主の契約打ち切り文書が出回っている", "[Breaking?] A document says the main sponsor is pulling out"), key: L("#광고철수", "#広告撤退", "#SponsorExit") },
  { id: "r_chief", t: L("[익명] 방송국장이 제작비를 개인적으로 썼다는 제보", "[匿名] 局長が制作費を私的に使ったとの情報", "[Anon] Tip says the chief spent production funds personally"), key: L("#제작비의혹", "#制作費疑惑", "#FundsDoubt") },
  { id: "r_fight", t: L("[커뮤니티] 대기실에서 출연자끼리 크게 싸웠다던데", "[掲示板] 控室で出演者同士が大げんかしたらしい", "[Forum] Heard the cast had a huge fight backstage"), key: L("#대기실싸움", "#控室喧嘩", "#GreenRoomFight") },
  { id: "r_clip", t: L("[영상] 방송 편집본에 왜곡 자막이 있었다는 비교 영상 확산", "[動画] 編集版に歪曲字幕があったとの比較動画が拡散", "[Video] Comparison clip claims misleading captions"), key: L("#왜곡자막", "#歪曲字幕", "#CaptionGate") },
  { id: "r_rig", t: L("[익명] 시청자 투표 결과가 조작됐다는 캡처", "[匿名] 視聴者投票が操作されたとのキャプチャ", "[Anon] Screenshot claims the viewer vote was rigged"), key: L("#투표조작", "#投票操作", "#VoteRigged") },
  { id: "r_sale", t: L("[경제 뉴스] 플듀 방송국 매각설 솔솔", "[経済ニュース] プルドゥ放送局に売却説", "[Biz News] Talk of PlayDuo Station being sold"), key: L("#매각설", "#売却説", "#SaleTalk") },
  { id: "r_rival", t: L("[커뮤니티] 내부에 경쟁 방송국과 내통하는 사람이 있다?", "[掲示板] 内部に競合と通じている人がいる？", "[Forum] A mole inside, talking to the rival network?"), key: L("#내통설", "#内通説", "#MoleRumor") },
  { id: "r_safety", t: L("[제보] 촬영장 안전 수칙을 무시했다는 사진", "[情報] 撮影現場で安全規則を無視したという写真", "[Tip] Photo allegedly shows ignored set safety rules"), key: L("#안전불감", "#安全軽視", "#SafetyLapse") },
  { id: "r_doc", t: L("[커뮤니티] 방송국 내부 문서라며 올라온 파일, 진짜일까", "[掲示板] 局の内部文書とされるファイル、本物か", "[Forum] A 'leaked internal file' is going around; real?"), key: L("#내부문서", "#内部文書", "#LeakedFile") },
];
export const REACTIONS = {
  good: [L("요즘 여기 방송 볼만해졌네", "最近ここの放送面白くなった", "This station's actually good lately"), L("사과 제대로 하는 건 인정", "ちゃんと謝るのは認める", "Credit for a proper apology"), L("오늘 방송 레전드였음", "今日の放送は神回", "Today's broadcast was legendary"), L("출연진 케미 좋다", "出演者の相性いいね", "Great cast chemistry")],
  bad: [L("또 사고냐 진짜 왜 이래", "また事故？本当にどうした", "Another accident? Seriously?"), L("해명 좀 해라 언제까지 침묵?", "釈明してよ、いつまで沈黙？", "Explain yourselves. Why the silence?"), L("광고만 늘고 방송은 망가짐", "広告ばかり増えて番組は崩壊", "More ads, worse shows"), L("이 방송국 곧 문 닫을 듯", "この局、もうすぐ潰れそう", "This station's about to close")],
  mid: [L("일단 공식 입장 나올 때까지 기다려 보자", "公式見解が出るまで待とう", "Let's wait for an official statement"), L("소문은 많은데 확인된 건 없음", "噂は多いが確認された話はない", "Lots of rumors, nothing confirmed"), L("근데 출처가 어디임?", "で、ソースはどこ？", "But what's the source?"), L("오늘 편성표 바뀐 거 맞죠?", "今日の編成変わったよね？", "Did today's lineup change?")],
};

// 비밀 미션: 본인에게만 보임. 판정은 core의 MISSION_CHECK
export const MISSIONS = {
  ally: { tier: 2, text: L("{target:와} 동맹을 유지하라 (관계 40 이상)", "{target}と同盟を維持せよ（関係40以上）", "Keep an alliance with {target} (bond 40+)"), reward: 30, needTarget: 1 },
  money: { tier: 2, text: L("끝날 때 방송국 자금 3,500 이상 확보", "終了時に局の資金3,500以上", "End with 3,500+ station funds"), reward: 30 },
  program: { tier: 1, text: L("공격 편성 방송을 3번 성공시켜라", "攻撃編成を3回成功させよ", "Air 3 successful bold lineups"), reward: 20 },
  replace: { tier: 3, text: L("불신임을 통과시켜 방송국장을 교체하라", "不信任を通して局長を交代させよ", "Replace the chief through no-confidence"), reward: 40 },
  popular: { tier: 2, text: L("끝날 때 {target}보다 높은 인기", "終了時に{target}より高い人気", "End more famous than {target}"), reward: 25, needTarget: 1 },
  secret: { tier: 2, text: L("비밀 계약을 5일 넘게 들키지 않고 유지", "秘密契約を5日超、発覚せず維持", "Keep a secret contract 5+ days undetected"), reward: 30 },
  truth: { tier: 2, text: L("증거 또는 수사로 진실을 2번 밝혀라", "証拠または捜査で真実を2回明らかに", "Reveal the truth twice via evidence or investigation"), reward: 30 },
  rescue: { tier: 2, text: L("마지막 기회·비상사태에서 방송국을 3번 구하라", "最後の機会・非常事態で局を3回救え", "Save the station 3 times in last-chance or emergencies"), reward: 30 },
  ownership: { tier: 3, text: L("끝날 때 방송국장 자리에 앉아 있어라", "終了時に局長の座にいろ", "Be the chief when it ends"), reward: 45 },
  driveout: { tier: 3, text: L("{target}의 평판을 25 이하로 떨어뜨려라", "{target}の評判を25以下に落とせ", "Drop {target}'s reputation to 25 or below"), reward: 35, needTarget: 1 },
  clean: { tier: 1, text: L("계약을 한 번도 어기지 말고 공개 망신도 당하지 마라", "契約を一度も破らず公の恥もかくな", "Never break a contract or get publicly shamed"), reward: 20 },
  coin: { tier: 1, text: L("끝날 때 개인 자금 500 이상", "終了時に個人資金500以上", "End with 500+ personal funds"), reward: 20 },
  fallback: { tier: 1, text: L("(대체 목표) 끝까지 평판 50 이상 유지", "（代替目標）最後まで評判50以上を維持", "(Replacement) End with reputation 50+"), reward: 15 },
};
// 공개 목표: 역할별로 모두가 볼 수 있다
export const PUBLIC_GOALS = {
  director: L("방송국을 30일까지 이끌고 신뢰 50 유지", "局を30日まで率い、信頼50を維持", "Lead to day 30 with trust 50+"), pd: L("시청률 60 이상을 한 번 이상 달성", "視聴率60以上を一度以上達成", "Reach ratings of 60 at least once"), pr: L("논란 수위 40 이하로 마무리", "炎上度40以下で終える", "End with controversy 40 or less"), finance: L("자금이 마이너스인 날 없이 마무리", "資金がマイナスの日なく終える", "Never end a day below zero"), tech: L("안정성 50 이상으로 마무리", "安定性50以上で終える", "End with stability 50+"), legal: L("광고주 신뢰 50 이상으로 마무리", "広告主の信頼50以上で終える", "End with sponsor trust 50+"), writer: L("시청률 50 이상으로 마무리", "視聴率50以上で終える", "End with ratings 50+"), hr: L("피로도 50 이하로 마무리", "疲労50以下で終える", "End with fatigue 50 or less"), cast: L("인기 60 이상 달성", "人気60以上を達成", "Reach fame of 60+"),
};
export const CONTRACTS = {
  revshare: { ic: "💰", bind: 1, name: L("수익 분배", "収益分配", "Revenue share"), desc: L("매일 밤 상대에게 내 수당의 일부 지급", "毎晩相手に手当の一部を支払う", "Pay the partner part of your earnings nightly") },
  show: { ic: "🎭", name: L("공동 프로그램 출연", "共同番組出演", "Joint show"), desc: L("기간 안에 함께 방송 활동. 인기↑", "期間内に共に放送活動。人気↑", "Work on air together in the term; fame up") },
  support: { ic: "🗳️", name: L("후보 지지", "候補支持", "Back a candidate"), desc: L("다음 선거에서 지목한 후보에게 투표", "次の選挙で指名候補に投票", "Vote for the named candidate next election"), target: 1 },
  info: { ic: "🔐", name: L("비밀 정보 교환", "秘密情報の交換", "Swap secrets"), desc: L("체결 즉시 서로 비밀 미션 종류 공개", "締結時に秘密任務の種類を相互公開", "Reveal your mission type to each other immediately") },
  protect: { ic: "🛡️", name: L("출연진 보호 협약", "出演者保護協定", "Protection pact"), desc: L("서로 폭로·지목하지 않기", "互いに暴露・指名しない", "Never expose or accuse each other") },
};
export const EVIDENCE_KINDS = {
  contract: { ic: "📄", name: L("계약서", "契約書", "Contract") }, chat: { ic: "💬", name: L("내부 메신저 기록(허구)", "内部メッセンジャー記録（架空）", "Internal message log (fictional)") }, ledger: { ic: "📒", name: L("회계 기록", "会計記録", "Ledger") }, log: { ic: "🖥️", name: L("방송 사고 로그", "放送事故ログ", "Incident log") }, memo: { ic: "📝", name: L("내부 메모", "内部メモ", "Internal memo") }, tip: { ic: "✉️", name: L("익명 제보", "匿名情報", "Anonymous tip") }, tape: { ic: "📼", name: L("방송 녹화 자료", "放送録画資料", "Broadcast tape") },
};
export const LOCATIONS = { office: L("국장실", "局長室", "Chief's office"), studio: L("스튜디오", "スタジオ", "Studio"), pr: L("홍보실", "広報室", "PR room"), meeting: L("회의실", "会議室", "Meeting room"), control: L("송출실", "送出室", "Control room"), lounge: L("휴게실", "休憩室", "Lounge"), archive: L("자료실", "資料室", "Archive") };

// 엔딩: tone fail/special/success. 조건은 core의 ENDING_CHECK(우선순위 순서). 후일담·통계 문구가 모두 다름
export const ENDINGS = {
  bankrupt: { tone: "fail", ic: "💸", name: L("방송국 파산", "放送局の破産", "Station Bankrupt"), news: L("플듀 방송국, 회생 실패로 파산 신청", "プルドゥ放送局、再建失敗で破産申請", "PlayDuo Station files for bankruptcy after failed rescue"), after: L("마지막 월급은 끝내 나가지 않았다. 스튜디오의 조명은 경매 번호표를 단 채 꺼졌다.", "最後の給料はついに出なかった。スタジオの照明は競売の札を付けたまま消えた。", "The last paycheck never came. Studio lights went dark with auction tags on them."), stat: "money" },
  trust: { tone: "fail", ic: "💔", name: L("시청자 신뢰 붕괴", "視聴者信頼の崩壊", "Trust Collapse"), news: L("시청자 등 돌렸다… 플듀 방송국 편성 전면 중단", "視聴者が背を向けた…編成全面中止", "Viewers walk away; all programming suspended"), after: L("사과문은 더 이상 읽히지 않았다. 마지막 방송의 동시 시청자는 스태프 가족뿐이었다.", "謝罪文はもう読まれなかった。最終放送の同時視聴者はスタッフの家族だけだった。", "No one read the apologies anymore. The last broadcast was watched by staff families alone."), stat: "trust" },
  ads: { tone: "fail", ic: "🏢", name: L("광고주 전면 철수", "広告主の全面撤退", "Sponsor Exodus"), news: L("광고주 연쇄 해지, 플듀 방송국 수익 '0'", "広告主の連鎖解約、収益ゼロ", "Chain of cancelled deals; revenue hits zero"), after: L("광고 시간엔 검은 화면만 흘렀다. 마지막 계약서는 팩스로 도착해 찢어졌다.", "CM枠には黒い画面だけが流れた。最後の契約書はFAXで届き破られた。", "Ad slots ran black. The last contract arrived by fax and was torn up."), stat: "ad" },
  walkout: { tone: "fail", ic: "🚶", name: L("출연진 집단 이탈", "出演者の集団離脱", "Mass Walkout"), news: L("출연진 전원 하차 선언… 생방송 무산", "出演者全員が降板宣言…生放送中止", "Entire cast quits; live show cancelled"), after: L("대기실엔 이름표만 남았다. 다음 날 그들은 각자의 채널에서 같은 말을 했다.", "控室には名札だけが残った。翌日、彼らはそれぞれのチャンネルで同じことを語った。", "Only name tags stayed in the green room. Next day they all said the same on their own channels."), stat: "fat" },
  blackout: { tone: "fail", ic: "📡", name: L("송출 시스템 완전 마비", "送出システム完全麻痺", "Total Blackout"), news: L("송출 복구 실패, 플듀 방송국 사흘째 정파", "送出復旧失敗、3日連続の停波", "Failed recovery; third straight day off air"), after: L("화면 조정 신호만 몇 날을 흘렀다. 아무도 그 신호를 끄러 오지 않았다.", "テストパターンだけが何日も流れた。誰も止めに来なかった。", "Test bars ran for days. No one came to switch them off."), stat: "stab" },
  split: { tone: "fail", ic: "🧨", name: L("방송국 내부 분열", "放送局の内部分裂", "Internal Split"), news: L("플듀 방송국 내분 폭발, 운영 불능", "内紛爆発、運営不能", "Infighting explodes; station unmanageable"), after: L("회의실은 둘로 나뉘었고 복도엔 서로의 이름이 적힌 탄원서가 붙었다.", "会議室は二つに割れ、廊下には互いの名の嘆願書が貼られた。", "The meeting room split in two; petitions naming each other lined the hall."), stat: "unity" },
  mgmt: { tone: "fail", ic: "🪑", name: L("방송국장 운영 실패", "局長の運営失敗", "Leadership Failure"), news: L("거듭된 국장 교체… 플듀 방송국 운영 체계 붕괴", "度重なる局長交代…運営体制崩壊", "Repeated chief changes break the station's leadership"), after: L("국장실 명패가 세 번 바뀌었다. 네 번째 명패는 아무도 주문하지 않았다.", "局長室の名札は三度変わった。四度目は誰も注文しなかった。", "The nameplate changed three times. No one ordered a fourth."), stat: "removed" },
  chain: { tone: "fail", ic: "⛓️", name: L("위기 대응 연속 실패", "危機対応の連続失敗", "Chain of Failures"), news: L("대응 실패가 또 대응 실패를… 플듀 방송국 결국 폐국", "対応失敗の連鎖…ついに閉局", "Failure after failure; station closes for good"), after: L("보고서엔 같은 문장이 반복됐다. '다음에는 더 잘 대응하겠습니다.'", "報告書には同じ文が繰り返された。「次はより良く対応します」", "Reports repeated one sentence: 'We will respond better next time.'"), stat: "streak" },
  scandal: { tone: "fail", ic: "🕳️", name: L("연쇄 범죄 미제 폐국", "連続事件未解決で閉局", "Unsolved Crime Spree"), news: L("내부 사건 또 미제… 경찰 수사 속 플듀 방송국 폐국", "内部事件また未解決…捜査の中で閉局", "Another unsolved inside job; station closes under investigation"), after: L("범인은 끝내 밝혀지지 않았다. 마지막 퇴근 카드는 누군가 몰래 찍고 나갔다.", "犯人はついに分からなかった。最後の退勤記録は誰かがこっそり押して出た。", "The culprit was never found. Someone quietly clocked out last."), stat: "crimes" },
  merged: { tone: "special", ic: "🤝", name: L("경쟁 방송국과 합병", "競合局と合併", "Rival Merger"), news: L("어제의 적과 손잡았다… 플듀·라이벌 전격 합병", "昨日の敵と手を結ぶ…電撃合併", "Yesterday's enemies join hands in a surprise merger"), after: L("간판은 바뀌었지만 방송은 계속됐다. 새 회의실 자리 배치 싸움은 이제 시작이다.", "看板は変わったが放送は続いた。新会議室の席争いはこれからだ。", "New sign, same broadcasts. The seating war in the new office is just beginning."), stat: "money" },
  sold: { tone: "special", ic: "🏦", name: L("대기업에 매각", "大企業へ売却", "Sold to a Conglomerate"), news: L("플듀 방송국, 대기업 품으로… 전격 매각", "大企業の傘下へ…電撃売却", "PlayDuo Station sold to a conglomerate"), after: L("빚은 사라졌고 자유도 사라졌다. 편성표는 이제 광고팀이 쓴다.", "借金は消え、自由も消えた。編成表は今や広告部が書く。", "Debts gone, freedom gone. The ad team writes the schedule now."), stat: "money" },
  indep: { tone: "special", ic: "🚪", name: L("출연진 독립 방송국", "出演者の独立放送局", "Indie Station"), news: L("출연진 독립 선언! 새 방송국 깃발 올렸다", "出演者が独立宣言！新放送局を旗揚げ", "Cast declare independence and launch a new station"), after: L("창고를 빌려 시작한 첫 방송. 장비는 낡았지만 웃음소리는 어느 때보다 컸다.", "倉庫を借りて始めた初放送。機材は古いが笑い声は誰よりも大きかった。", "First show from a rented warehouse. Old gear, biggest laughs yet."), stat: "fame" },
  regime: { tone: "special", ic: "🌅", name: L("새 방송국장 체제 출범", "新局長体制の発足", "New Regime"), news: L("교체 후 반등 성공… 새 국장 체제 안착", "交代後に反騰成功…新体制が定着", "Rebound after the change; new chief's era takes hold"), after: L("옛 명패는 창고로 갔다. 첫 회의 안건은 '우리가 왜 흔들렸는가'였다.", "古い名札は倉庫へ。最初の議題は「なぜ我々は揺らいだか」だった。", "The old nameplate went to storage. First agenda: why we faltered."), stat: "director" },
  viewer: { tone: "special", ic: "🙌", name: L("시청자 주도 방송국", "視聴者主導の放送局", "Viewer-Owned Station"), news: L("시청자가 주인 됐다! 플듀 방송국, 시민 지분 전환", "視聴者がオーナーに！市民持株へ転換", "Viewers take over; the station goes community-owned"), after: L("다음 편성은 투표로 정해졌다. 댓글창은 처음으로 회의실이 됐다.", "次の編成は投票で決まった。コメント欄は初めて会議室になった。", "The next lineup was voted on. The comments became the meeting room."), stat: "trust" },
  spy: { tone: "special", ic: "🕴️", name: L("이중 스파이의 승리", "二重スパイの勝利", "The Double Agent Wins"), news: L("충격! 핵심 인사, 경쟁사와 내통… 거래 전격 성사", "衝撃！幹部が競合と内通…取引成立", "Shock: an insider's deal with the rival goes through"), after: L("서류는 완벽했다. 그는 마지막 인사를 하고, 다음 날 경쟁사 출입증을 받았다.", "書類は完璧だった。別れの挨拶をして、翌日競合の入館証を受け取った。", "The paperwork was perfect. A last goodbye, then a rival badge the next day."), stat: "spy" },
  bigdeal: { tone: "special", ic: "📝", name: L("대형 계약 조기 체결", "大型契約の早期締結", "Mega Deal"), news: L("초대형 스폰서십! 플듀 방송국, 조기 시즌 완성", "超大型スポンサー！シーズン早期完成", "Mega sponsorship ends the season early"), after: L("계약금은 3년치 운영비였다. 다음 시즌 대본은 이미 쓰여 있었다.", "契約金は3年分の運営費。次シーズンの台本はもう書かれていた。", "The deal covered 3 years of costs. Next season's script was already written."), stat: "ad" },
  comeback: { tone: "special", ic: "🔥", name: L("위기 극복 후 재도약", "危機克服と再跳躍", "Back from the Brink"), news: L("망한다던 방송국의 대역전! 플듀 방송국 재도약", "潰れると言われた局の大逆転！", "The station everyone wrote off stages a huge comeback"), after: L("벼랑 끝의 그날을 모두가 기억했다. 다음 위기에도 아무도 먼저 도망치지 않을 것이다.", "崖っぷちのあの日を皆が覚えていた。次の危機でも誰も先に逃げないだろう。", "All remembered that day at the edge. Next time, no one will run first."), stat: "comeback" },
  detective: { tone: "special", ic: "🕵️", name: L("명탐정 방송국", "名探偵放送局", "Station of Detectives"), news: L("내부 사건 전부 해결… 수사 예능으로 시즌 최고 화제", "内部事件を全解決…捜査バラエティで話題", "Every inside case solved; a smash detective show is born"), after: L("사건 보고서를 그대로 방송했더니 최고 시청률이 나왔다. 다음 시즌 제목은 이미 정해졌다.", "事件報告書をそのまま放送すると最高視聴率に。次シーズンの題は決まった。", "They aired the case files and hit peak ratings. Next season's title is set."), stat: "crimes" },
  national: { tone: "success", ic: "🏆", name: L("국민 방송국 달성", "国民的放送局", "The Nation's Station"), news: L("신뢰와 인기 모두 잡았다! 올해의 국민 방송국", "信頼も人気も！今年の国民的放送局", "Trust and ratings both won: station of the year"), after: L("시상식 무대 뒤에서 모두가 서로의 이름을 불렀다. 그날은 아무도 비밀을 묻지 않았다.", "授賞式の舞台裏で皆が名を呼び合った。その日は誰も秘密を聞かなかった。", "Backstage everyone called each other's names. No one asked about secrets that day."), stat: "trust" },
  record: { tone: "success", ic: "📈", name: L("최고 시청률 신기록", "最高視聴率の新記録", "All-Time Ratings Record"), news: L("시청률 신기록! 플듀 방송국이 새 역사를 썼다", "視聴率新記録！新たな歴史", "New ratings record: PlayDuo Station makes history"), after: L("그래프는 화면 밖으로 나갔다. 다음 날 모두 그 그래프를 사진으로 뽑아 왔다.", "グラフは画面の外へ。翌日、皆がそのグラフを印刷して持ってきた。", "The chart went off the screen. Next day everyone brought a printout."), stat: "rating" },
  survive: { tone: "success", ic: "🎉", name: L("30일 무사 생존", "30日無事生存", "Survived 30 Days"), news: L("30일을 버텼다! 플듀 방송국 시즌 완주", "30日耐えた！シーズン完走", "Thirty days survived: the season is complete"), after: L("상처투성이의 30일. 그래도 내일 아침 방송 큐시트는 평소처럼 올라왔다.", "傷だらけの30日。それでも明日の朝のキューシートはいつも通り上がった。", "Thirty scarred days. Still, tomorrow's cue sheet went up as usual."), stat: "day" },
  legend: { tone: "success", ic: "🌟", name: L("전설적인 방송국", "伝説の放送局", "Legendary Station"), news: L("모든 지표 최상! 방송사에 남을 전설의 시즌", "全指標が最高！伝説のシーズン", "Every metric at the top: a season for the history books"), after: L("후배들은 이 시즌을 교본 삼아 공부한다. 그들이 몰래 한 거래만은 교본에 없다.", "後輩はこのシーズンを教本にする。彼らの裏取引だけは載っていない。", "Juniors study this season like a textbook. The backroom deals aren't in it."), stat: "all" },
  teamwork: { tone: "success", ic: "🫱", name: L("완벽한 팀워크", "完璧なチームワーク", "Perfect Teamwork"), news: L("배신 0건! 끝까지 함께한 플듀 방송국", "裏切り0件！最後まで共に", "Zero betrayals: they stuck together to the end"), after: L("모든 약속이 지켜졌다. 이 판에선 거짓말이 가장 비싼 물건이었다.", "全ての約束が守られた。この局では嘘が一番高価だった。", "Every promise was kept. Lies were the priciest item here."), stat: "unity" },
};
