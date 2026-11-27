// =========================
// 격리구역: 제로 — 콘텐츠 데이터: 시설 15종 · 장비 30종 · 특성 추가 · 사건 30개 · 공명 10종 · 직원 후보 · 캠페인 이야기 · 엔딩
// 효과는 모두 zero-core가 실제로 계산 (설명 문구 = 실제 수치)
// =========================
const l = (ko, ja, en) => [ko, ja, en];

// ---------- 건설 가능한 시설 (빈 구역에 짓기) ----------
export const BUILD = {
  contain: { cost: 400, ic: "🔒" },
  lab: { cost: 350, ic: "🧪", name: l("연구실", "研究室", "Research Lab"), desc: l("모든 연구 데이터 +15% (여러 개면 더해짐)", "全研究データ+15%（複数で加算）", "+15% research data (stacks)") },
  security: { cost: 300, ic: "🛡️", name: l("보안실", "警備室", "Security Office"), desc: l("보안요원 이동 +30%, 제압 피해 +25%", "警備員の移動+30%、鎮圧ダメージ+25%", "Security staff move +30%, suppression damage +25%") },
  archive: { cost: 300, ic: "🗄️", name: l("기록보관소", "記録保管所", "Archive"), desc: l("가설을 맞히면 데이터 +15 더, 틀려도 잠기지 않아요", "仮説正解でデータ+15追加、外れてもロックされない", "+15 extra data per correct hypothesis; wrong calls don't lock") },
  storage: { cost: 250, ic: "📦", name: l("물류창고", "物流倉庫", "Storage"), desc: l("하루가 끝날 때 자금 +80, 장비 값 −20%", "1日の終わりに資金+80、装備価格−20%", "+80 funds each day, equipment −20%") },
  cafeteria: { cost: 250, ic: "🍱", name: l("식당", "食堂", "Cafeteria"), desc: l("아침마다 모든 직원 스트레스 −15, 체력 +10", "毎朝全職員のストレス−15、体力+10", "Every morning: all staff stress −15, HP +10") },
  dorm: { cost: 300, ic: "🛏️", name: l("직원 숙소", "職員宿舎", "Dormitory"), desc: l("직원 정원 +2", "職員の定員+2", "+2 staff capacity") },
  counsel: { cost: 300, ic: "🛋️", name: l("심리상담실", "心理相談室", "Counseling Room"), desc: l("여기서 쉬면 스트레스가 휴게실보다 2배 빨리 내려가요. 패닉 직원은 여기로 와요", "ここで休むとストレスが休憩室の2倍速く下がる。パニックの職員はここへ来る", "Stress drops twice as fast as the lounge. Panicking staff come here") },
  backup: { cost: 400, ic: "🔋", name: l("비상 발전기", "非常用発電機", "Backup Generator"), desc: l("발전기가 고장 나도 전력이 55%까지는 유지돼요", "発電機が故障しても電力55%を維持", "Keeps power at 55% when the generator fails") },
  battery: { cost: 350, ic: "⚡", name: l("에너지 저장실", "エネルギー貯蔵室", "Power Storage"), desc: l("전력이 20% 아래로 안 떨어지고, 비상 전력 하루 1번 무료", "電力が20%を下回らず、非常電力が1日1回無料", "Power never drops below 20%; one free emergency power a day") },
  workshop: { cost: 300, ic: "🛠️", name: l("장비 제작실", "装備製作室", "Workshop"), desc: l("이변체 연구로 해금한 특수 장비를 만들 수 있어요", "異変体研究で解禁した特殊装備を作れる", "Lets you craft special gear unlocked through anomaly research") },
};
export const BUILD_IDS = Object.keys(BUILD);

// ---------- 장비 30종 (slot: hand 손 / body 몸 / acc 장신구) ----------
// fx: st(능력치+) fight(제압 배) armor(받는 피해 배) stressRes(스트레스 배) noise dark(어둠 면역=빛) data energy move repair work fat xp calm sleepRes see(가짜 식별) method:[방식,+]
export const GEAR = {
  e_baton: { slot: "hand", w: 1, cost: 120, name: l("진압봉", "鎮圧棒", "Riot Baton"), fx: { fight: 1.4 } },
  e_taser: { slot: "hand", w: 1, cost: 220, name: l("테이저", "テーザー", "Taser"), fx: { fight: 1.8, st: { cmb: 1 } } },
  e_clip: { slot: "hand", cost: 150, name: l("전자 기록판", "電子記録板", "Data Slate"), fx: { st: { obs: 1 }, data: 1.1 } },
  e_scanner: { slot: "hand", cost: 200, name: l("정밀 스캐너", "精密スキャナー", "Precision Scanner"), fx: { st: { foc: 1 }, method: ["analyze", 2] } },
  e_toolkit: { slot: "hand", cost: 160, name: l("공구함", "工具箱", "Toolkit"), fx: { repair: 1.5, st: { tec: 1 } } },
  e_vest: { slot: "body", cost: 180, name: l("방호 조끼", "防護ベスト", "Protective Vest"), fx: { armor: 0.7 } },
  e_suit: { slot: "body", cost: 240, name: l("격리복", "隔離服", "Hazmat Suit"), fx: { armor: 0.8, stressRes: 0.9 } },
  e_coat: { slot: "body", cost: 160, name: l("방음 코트", "防音コート", "Sound-Dampening Coat"), fx: { noise: 1 } },
  e_flash: { slot: "acc", cost: 100, name: l("손전등", "懐中電灯", "Flashlight"), fx: { dark: 1 } },
  e_radio: { slot: "acc", cost: 140, name: l("무전기", "無線機", "Radio"), fx: { move: 1.15 } },
  // 이변체 연구(3단계)로 해금 + 장비 제작실 필요
  g_petal: { slot: "acc", cost: 280, from: "garden", name: l("정원 보호 꽃잎", "庭の守り花びら", "Garden Ward Petal"), fx: { stressRes: 0.8 } },
  g_cushion: { slot: "acc", cost: 260, from: "chair", name: l("따뜻한 방석", "温かい座布団", "Warm Cushion"), fx: { fat: 0.7 } },
  g_crown: { slot: "acc", cost: 280, from: "paper", name: l("종이 왕관", "紙の王冠", "Paper Crown"), fx: { st: { emp: 1 }, method: ["talk", 1] } },
  g_stamp: { slot: "acc", cost: 260, from: "letter", name: l("내일의 우표", "明日の切手", "Tomorrow's Stamp"), fx: { data: 1.15 } },
  g_thermos: { slot: "acc", cost: 240, from: "fridge", name: l("차가운 보온병", "冷たい魔法瓶", "Cold Thermos"), fx: { fat: 0.6 } },
  g_bulb: { slot: "acc", cost: 300, from: "lamp", name: l("웃는 전구", "笑う電球", "Grinning Bulb"), fx: { dark: 1, st: { obs: 1 } } },
  g_tuner: { slot: "hand", cost: 320, from: "clock", name: l("시간 조율기", "時間調律器", "Time Tuner"), fx: { work: 1.2 } },
  g_whale: { slot: "acc", cost: 340, from: "whale", name: l("유리 고래의 공명 장치", "ガラス鯨の共鳴装置", "Whale Resonator"), fx: { calm: 0.25 } },
  g_locket: { slot: "acc", cost: 300, from: "box", name: l("기억의 목걸이", "記憶のロケット", "Memory Locket"), fx: { xp: 1.5 } },
  g_baton_sig: { slot: "hand", w: 1, cost: 320, from: "signal", name: l("신호 진압봉", "信号鎮圧棒", "Signal Baton"), fx: { fight: 1.6, move: 1.1 } },
  g_earplug: { slot: "acc", cost: 280, from: "music", name: l("합창 차단기", "合唱遮断器", "Chorus Blocker"), fx: { noise: 1, sleepRes: 1 } },
  g_umbrella: { slot: "body", cost: 340, from: "umbrella", name: l("우산 망토", "傘のマント", "Umbrella Cloak"), fx: { armor: 0.6 } },
  g_silencer: { slot: "acc", cost: 340, from: "choir", name: l("침묵의 악보", "沈黙の楽譜", "Silent Score"), fx: { noise: 1, stressRes: 0.85 } },
  g_lens: { slot: "acc", cost: 360, from: "mimic", name: l("그림자 탐지기", "影探知機", "Shadow Detector"), fx: { see: 1, st: { obs: 2 } } },
  g_bookmark: { slot: "hand", cost: 340, from: "library", name: l("끝나지 않는 책갈피", "終わらない栞", "Endless Bookmark"), fx: { data: 1.25 } },
  g_key: { slot: "acc", cost: 320, from: "city", name: l("도시의 열쇠", "街の鍵", "Key to the City"), fx: { energy: 1.1, st: { cou: 1 } } },
  g_lantern: { slot: "acc", cost: 340, from: "shadow", name: l("그림자 등불", "影の灯", "Shadow Lantern"), fx: { dark: 1, st: { foc: 1 } } },
  g_needle: { slot: "hand", w: 1, cost: 360, from: "thread", name: l("붉은 바늘", "赤い針", "Red Needle"), fx: { fight: 1.7 } },
  g_prism: { slot: "acc", cost: 380, from: "window", name: l("가능성의 프리즘", "可能性のプリズム", "Prism of Possibility"), fx: { stressRes: 0.75 } },
  g_compass: { slot: "acc", cost: 360, from: "stairs", name: l("층을 아는 나침반", "階を知る羅針盤", "Floor Compass"), fx: { move: 1.25 } },
};
export const GEAR_IDS = Object.keys(GEAR);
export const SLOT_NAME = { hand: l("손", "手", "Hand"), body: l("몸", "体", "Body"), acc: l("장신구", "装身具", "Accessory") };
export function gearDesc(fx, L) {
  const S = { obs: ["관찰력", "観察力", "Observation"], emp: ["공감력", "共感力", "Empathy"], foc: ["집중력", "集中力", "Focus"], cou: ["용기", "勇気", "Courage"], cmb: ["전투", "戦闘", "Combat"], tec: ["기술", "技術", "Tech"] };
  const M = { analyze: ["행동 분석", "行動分析", "Analysis"], talk: ["대화", "対話", "Dialogue"] };
  const out = [], pct = (v) => (v >= 1 ? "+" : "−") + Math.round(Math.abs(v - 1) * 100) + "%";
  const t = (ko, ja, en) => [ko, ja, en][L];
  if (fx.st) for (const k in fx.st) out.push(`${S[k][L]} +${fx.st[k]}`);
  if (fx.fight) out.push(t("제압 피해 ", "鎮圧ダメージ", "Suppression ") + pct(fx.fight));
  if (fx.armor) out.push(t("받는 피해 ", "被ダメージ", "Damage taken ") + pct(fx.armor));
  if (fx.stressRes) out.push(t("스트레스 ", "ストレス", "Stress ") + pct(fx.stressRes));
  if (fx.noise) out.push(t("소음 무시", "騒音無効", "Ignores noise"));
  if (fx.dark) out.push(t("어둠 무시(불빛)", "暗闇無効（灯り）", "Ignores darkness (light)"));
  if (fx.data) out.push(t("연구 데이터 ", "研究データ", "Research data ") + pct(fx.data));
  if (fx.energy) out.push(t("에너지 ", "エネルギー", "Energy ") + pct(fx.energy));
  if (fx.move) out.push(t("이동 ", "移動", "Movement ") + pct(fx.move));
  if (fx.repair) out.push(t("수리 ", "修理", "Repair ") + pct(fx.repair));
  if (fx.work) out.push(t("작업 속도 ", "作業速度", "Work speed ") + pct(fx.work));
  if (fx.fat) out.push(t("피로 ", "疲労", "Fatigue ") + pct(fx.fat));
  if (fx.xp) out.push(t("경험치 ", "経験値", "XP ") + pct(fx.xp));
  if (fx.calm) out.push(t("주변 직원 스트레스↓", "周囲の職員のストレス↓", "Calms nearby staff"));
  if (fx.sleepRes) out.push(t("잠재우기 면역", "眠り無効", "Immune to sleep"));
  if (fx.see) out.push(t("가짜 직원 식별", "偽職員を識別", "Spots impostors"));
  if (fx.method) out.push(`${M[fx.method[0]][L]} +${fx.method[1]}`);
  return out.join(" · ");
}

// ---------- 추가 특성 5종 (zero-data TRAITS에 합침) ----------
export const TRAITS2 = {
  loner: { name: l("외톨이", "一匹狼", "Loner"), desc: l("같은 방에 아무도 없으면 작업 +20%, 북적이면 스트레스↑", "同じ部屋に誰もいないと作業+20%、混むとストレス↑", "+20% work speed when alone in the room; crowds stress them"), good: 0 },
  optimist: { name: l("낙천적", "楽天的", "Optimist"), desc: l("스트레스가 저절로 조금씩 내려가요", "ストレスが自然に少しずつ下がる", "Stress slowly drains on its own"), good: 1 },
  sharp: { name: l("뛰어난 기억력", "記憶力抜群", "Sharp Memory"), desc: l("연구 데이터 +10%, 경험치 +20%", "研究データ+10%、経験値+20%", "+10% research data, +20% XP"), good: 1 },
  athletic: { name: l("운동선수 출신", "元アスリート", "Athletic"), desc: l("이동 속도 +25%", "移動速度+25%", "+25% movement speed"), good: 1 },
  tough: { name: l("튼튼함", "頑丈", "Tough"), desc: l("최대 체력 +25%", "最大体力+25%", "+25% max HP"), good: 1 },
};

// ---------- 직원 이름 후보 (언어별) ----------
export const NAMES = [
  l("김하준", "キム・ハジュン", "Hajun Kim"), l("이서연", "イ・ソヨン", "Seoyeon Lee"), l("박지호", "パク・ジホ", "Jiho Park"), l("최유나", "チェ・ユナ", "Yuna Choi"), l("정민재", "チョン・ミンジェ", "Minjae Jung"),
  l("윤아린", "ユン・アリン", "Arin Yoon"), l("임태성", "イム・テソン", "Taesung Lim"), l("송하늘", "ソン・ハヌル", "Haneul Song"), l("다카하시 렌", "高橋レン", "Ren Takahashi"), l("이토 미오", "伊藤ミオ", "Mio Ito"),
  l("야마다 소라", "山田ソラ", "Sora Yamada"), l("엘레나 로시", "エレナ・ロッシ", "Elena Rossi"), l("노아 피셔", "ノア・フィッシャー", "Noah Fischer"), l("아마라 오코예", "アマラ・オコイエ", "Amara Okoye"), l("루카스 모로", "ルーカス・モロー", "Lucas Moreau"),
  l("프리야 난다", "プリヤ・ナンダ", "Priya Nanda"), l("마테오 실바", "マテオ・シルバ", "Mateo Silva"), l("한나 베르그", "ハンナ・ベリ", "Hanna Berg"), l("오마르 하산", "オマル・ハッサン", "Omar Hassan"), l("린 웨이", "リン・ウェイ", "Lin Wei"),
  l("조은별", "チョ・ウンビョル", "Eunbyeol Cho"), l("강시우", "カン・シウ", "Siwoo Kang"), l("서다온", "ソ・ダオン", "Daon Seo"), l("나카무라 유키", "中村ユキ", "Yuki Nakamura"),
];

// ---------- 사건 30개 ----------
// who: 등장 역할 (a = 일할 수 있는 직원, b = 다른 직원, x = 격리 중인 이변체). cond: 조건. ch: 선택지 { t 글, fx 효과, r 결과 글 }
// 효과: money energy stressAll stressA stressB hpA relAB data(x에) stab(x에) power fat quota flag gear(장비 하나 받기) trait(a에게 특성) xpA genFix
export const EVENTS = [
  // ── 직원 10 ──
  { id: "ev_first", cat: "staff", who: "a", w: 1.2, day: [1, 3], title: l("첫 근무의 떨림", "初勤務の震え", "First-Day Jitters"), text: l("{a}이(가) 손을 떨며 말한다. \"솔직히… 무서워요.\"", "{a}が手を震わせて言う。「正直…怖いです」", "{a}'s hands are shaking. \"Honestly… I'm scared.\""),
    ch: [{ t: l("함께 커피 한잔 하자", "一緒にコーヒーを飲もう", "Let's grab a coffee together"), fx: { stressA: -15, money: -20 }, r: l("{a}의 표정이 한결 편해졌다", "{a}の表情が和らいだ", "{a} looks much calmer") }, { t: l("익숙해질 거야, 일하자", "慣れるさ、働こう", "You'll get used to it. Back to work"), fx: { stressA: 5, xpA: 10 }, r: l("{a}이(가) 이를 악물고 돌아갔다", "{a}は歯を食いしばって戻った", "{a} grits their teeth and goes back") }] },
  { id: "ev_argue", cat: "staff", who: "ab", w: 1, title: l("연구원의 의견 충돌", "研究員の意見衝突", "A Heated Disagreement"), text: l("{a}과(와) {b}이(가) 연구 방식을 두고 언성을 높인다.", "{a}と{b}が研究方法をめぐって声を荒げている。", "{a} and {b} are arguing loudly over research methods."),
    ch: [{ t: l("{a}의 편을 든다", "{a}の味方をする", "Side with {a}"), fx: { stressA: -5, stressB: 12, relAB: -12 }, r: l("{b}이(가) 씩씩대며 나갔다", "{b}はむっとして出て行った", "{b} storms off") }, { t: l("둘 다 맞다고 중재한다", "どちらも正しいと仲裁する", "Mediate: you're both right"), fx: { stressA: 4, stressB: 4, relAB: 8 }, r: l("둘은 어색하게 악수했다", "二人はぎこちなく握手した", "They shake hands, awkwardly") }] },
  { id: "ev_discovery", cat: "staff", who: "ax", w: 1, need: "researcher", title: l("특별한 발견", "特別な発見", "A Special Discovery"), text: l("{a}이(가) {x}의 기록에서 이상한 패턴을 찾았다고 한다.", "{a}が{x}の記録から妙なパターンを見つけたという。", "{a} says they found a strange pattern in {x}'s records."),
    ch: [{ t: l("밤새 분석하게 한다", "徹夜で分析させる", "Let them analyze all night"), fx: { data: 18, fat: 35, stressA: 8 }, r: l("{x}에 대한 데이터가 크게 늘었다", "{x}のデータが大きく増えた", "A big jump in data on {x}") }, { t: l("내일 함께 보자", "明日一緒に見よう", "Let's look at it tomorrow"), fx: { data: 6 }, r: l("메모만 남겨 두었다", "メモだけ残した", "They left a note for later") }] },
  { id: "ev_promote", cat: "staff", who: "a", w: 0.8, cond: [["lvA>=", 2]], title: l("승진 요청", "昇進の要請", "A Promotion Request"), text: l("{a}이(가) 그동안의 공로를 인정해 달라고 한다.", "{a}がこれまでの功績を認めてほしいと言う。", "{a} asks for recognition of their work."),
    ch: [{ t: l("승진시킨다 (자금 −150)", "昇進させる（資金−150）", "Promote them (−150 funds)"), fx: { money: -150, stressA: -20, xpA: 30 }, r: l("{a}이(가) 활짝 웃었다", "{a}は満面の笑みを浮かべた", "{a} beams") }, { t: l("아직은 이르다", "まだ早い", "Not yet"), fx: { stressA: 12 }, r: l("{a}이(가) 실망한 얼굴로 돌아섰다", "{a}は落胆して背を向けた", "{a} turns away, disappointed") }] },
  { id: "ev_birthday", cat: "staff", who: "a", w: 0.9, title: l("깜짝 생일", "サプライズ誕生日", "Surprise Birthday"), text: l("오늘은 {a}의 생일이다. 동료들이 몰래 케이크를 준비했다.", "今日は{a}の誕生日。同僚がこっそりケーキを用意した。", "It's {a}'s birthday. The team secretly got a cake."),
    ch: [{ t: l("잠깐 다 같이 축하한다", "少しみんなで祝う", "Celebrate together for a moment"), fx: { stressAll: -10, energy: -4 }, r: l("시설에 오랜만에 웃음소리가 퍼졌다", "施設に久しぶりに笑い声が広がった", "Laughter fills the facility for once") }, { t: l("근무 끝나고 하자", "勤務後にしよう", "After the shift"), fx: { stressA: 3 }, r: l("케이크는 냉장고로 들어갔다", "ケーキは冷蔵庫へ", "The cake goes in the fridge") }] },
  { id: "ev_insomnia", cat: "staff", who: "a", w: 0.9, cond: [["stressA>=", 40]], title: l("잠 못 든 밤", "眠れない夜", "A Sleepless Night"), text: l("{a}이(가) 어젯밤 한숨도 못 잤다고 한다.", "{a}が昨夜一睡もできなかったという。", "{a} says they didn't sleep a wink last night."),
    ch: [{ t: l("오전 내내 쉬게 한다", "午前中休ませる", "Let them rest all morning"), fx: { fat: -50, stressA: -10, energy: -5 }, r: l("{a}이(가) 휴게실에서 곯아떨어졌다", "{a}は休憩室で爆睡した", "{a} passes out in the lounge") }, { t: l("커피로 버틴다", "コーヒーで乗り切る", "Power through with coffee"), fx: { fat: 25 }, r: l("{a}의 눈 밑이 더 어두워졌다", "{a}の目の下のくまが濃くなった", "The circles under {a}'s eyes darken") }] },
  { id: "ev_mentor", cat: "staff", who: "ab", w: 0.8, title: l("선배의 조언", "先輩の助言", "A Mentor's Advice"), text: l("{a}이(가) {b}에게 노하우를 알려 주고 싶어 한다.", "{a}が{b}にノウハウを教えたがっている。", "{a} wants to show {b} the ropes."),
    ch: [{ t: l("한 시간 시간을 준다", "1時間時間を与える", "Give them an hour"), fx: { relAB: 15, xpB: 20, energy: -3 }, r: l("{b}이(가) 열심히 받아 적었다", "{b}は熱心にメモを取った", "{b} takes careful notes") }, { t: l("일이 먼저다", "仕事が先だ", "Work comes first"), fx: {}, r: l("둘은 각자 자리로 돌아갔다", "二人は持ち場へ戻った", "They return to their posts") }] },
  { id: "ev_family", cat: "staff", who: "a", w: 0.7, title: l("가족의 전화", "家族からの電話", "A Call from Home"), text: l("{a}의 가족이 급히 연락을 해 왔다. 이 일을 계속해도 되냐고 묻는다.", "{a}の家族から急な連絡。この仕事を続けていいのかと聞いている。", "{a}'s family called urgently, asking if they should keep doing this job."),
    ch: [{ t: l("통화 시간을 충분히 준다", "通話の時間を十分に与える", "Give them time to talk"), fx: { stressA: -18, energy: -3 }, r: l("{a}이(가) 마음을 다잡았다", "{a}は気持ちを立て直した", "{a} pulls themselves together") }, { t: l("보안상 통화를 끊는다", "保安上、通話を切る", "Cut the call for security"), fx: { stressA: 20, relAll: -3 }, r: l("{a}의 눈빛이 차가워졌다", "{a}の目が冷たくなった", "{a}'s eyes go cold") }] },
  { id: "ev_hero", cat: "staff", who: "a", w: 0.7, cond: [["breachToday"]], title: l("숨은 영웅", "隠れた英雄", "Unsung Hero"), text: l("직원들이 {a}이(가) 오늘 사고 때 동료를 끌어냈다고 말한다.", "職員たちは{a}が今日の事故で仲間を助け出したと言う。", "The staff say {a} pulled a colleague out during today's incident."),
    ch: [{ t: l("모두 앞에서 칭찬한다", "皆の前で称える", "Praise them publicly"), fx: { stressA: -15, stressAll: -5, xpA: 20 }, r: l("박수가 쏟아졌다", "拍手が沸き起こった", "Applause breaks out") }, { t: l("보너스를 준다 (자금 −100)", "ボーナスを渡す（資金−100）", "Give a bonus (−100 funds)"), fx: { money: -100, stressA: -25, trait: "brave" }, r: l("{a}이(가) 강심장 특성을 얻었다", "{a}は「度胸」を得た", "{a} gained Steel Nerves") }] },
  { id: "ev_quit", cat: "staff", who: "a", w: 0.6, cond: [["stressA>=", 60]], title: l("사직서", "辞表", "A Resignation Letter"), text: l("{a}이(가) 사직서를 내밀었다. \"더는 못 하겠어요.\"", "{a}が辞表を差し出した。「もう無理です」", "{a} hands you a letter. \"I can't do this anymore.\""),
    ch: [{ t: l("휴가를 주고 붙잡는다 (자금 −120)", "休暇を与えて引き留める（資金−120）", "Offer leave to keep them (−120 funds)"), fx: { money: -120, stressA: -40, fat: -40 }, r: l("{a}이(가) 조금 더 버텨 보기로 했다", "{a}はもう少し頑張ることにした", "{a} agrees to stay a little longer") }, { t: l("설득한다 (공감력 판정)", "説得する（共感力判定）", "Talk them out of it (Empathy check)"), fx: { check: ["emp", 6], ok: { stressA: -20, relAll: 3 }, bad: { stressA: 15 } }, r: l("대화가 끝났다", "話が終わった", "The talk is over") }] },
  // ── 이변체 8 ──
  { id: "ev_hum", cat: "anom", who: "x", w: 1, title: l("격리실의 콧노래", "収容室の鼻歌", "Humming from the Cell"), text: l("{x}의 격리실에서 누군가 콧노래를 부르는 소리가 들린다.", "{x}の収容室から誰かの鼻歌が聞こえる。", "Someone is humming inside {x}'s cell."),
    ch: [{ t: l("녹음해서 분석한다", "録音して分析する", "Record and analyze it"), fx: { data: 10, stab: -8 }, r: l("녹음 파일에는 다른 목소리가 섞여 있었다", "録音には別の声が混じっていた", "Another voice is mixed into the recording") }, { t: l("못 들은 척한다", "聞こえないふりをする", "Pretend you didn't hear"), fx: { stressAll: 3 }, r: l("콧노래는 저녁까지 이어졌다", "鼻歌は夕方まで続いた", "The humming continues until evening") }] },
  { id: "ev_gift", cat: "anom", who: "ax", w: 0.9, title: l("이변체의 선물", "異変体の贈り物", "A Gift from the Cell"), text: l("{x}의 격리실 앞에 작은 물건이 놓여 있다. {a}이(가) 주우려 한다.", "{x}の収容室の前に小さな物が置かれている。{a}が拾おうとしている。", "A small object lies outside {x}'s cell. {a} reaches for it."),
    ch: [{ t: l("가지게 둔다", "持たせておく", "Let them keep it"), fx: { gear: 1, stressA: 6 }, r: l("그것은 쓸 만한 장비였다", "それは使える装備だった", "It turns out to be useful gear") }, { t: l("즉시 폐기한다", "直ちに廃棄する", "Destroy it immediately"), fx: { stab: 6 }, r: l("{x}이(가) 조용해졌다", "{x}は静かになった", "{x} goes quiet") }] },
  { id: "ev_restless", cat: "anom", who: "x", w: 1, title: l("불안한 밤사이", "不穏な夜の間に", "A Restless Night"), text: l("밤사이 {x}의 격리 수치가 크게 흔들렸다.", "夜の間に{x}の収容値が大きく揺れた。", "Overnight, {x}'s containment readings swung wildly."),
    ch: [{ t: l("긴급 점검 (자금 −80)", "緊急点検（資金−80）", "Emergency inspection (−80 funds)"), fx: { money: -80, stab: 15 }, r: l("수치가 안정을 되찾았다", "数値が安定を取り戻した", "The readings settle") }, { t: l("지켜본다", "様子を見る", "Keep watching"), fx: { stab: -15, data: 5 }, r: l("흔들림 속에서 새 데이터를 얻었다", "揺れの中から新データを得た", "You gather new data from the fluctuations") }] },
  { id: "ev_mirror", cat: "anom", who: "ax", w: 0.8, title: l("격리실 유리에 비친 것", "収容室のガラスに映ったもの", "Reflection in the Glass"), text: l("{a}이(가) {x}의 격리실 유리에 자기가 아닌 얼굴이 비쳤다고 한다.", "{a}が{x}の収容室のガラスに自分ではない顔が映ったという。", "{a} says a face that wasn't theirs appeared in {x}'s glass."),
    ch: [{ t: l("상담을 받게 한다", "カウンセリングを受けさせる", "Send them to counseling"), fx: { stressA: -12, energy: -3 }, r: l("{a}이(가) 진정했다", "{a}は落ち着いた", "{a} calms down") }, { t: l("자세히 보고하게 한다", "詳しく報告させる", "Have them write it up"), fx: { data: 12, stressA: 14 }, r: l("보고서는 길고 불안했다", "報告書は長く不穏だった", "The report is long and unsettling") }] },
  { id: "ev_feed", cat: "anom", who: "x", w: 0.8, title: l("이상한 요구", "奇妙な要求", "A Strange Demand"), text: l("{x}의 격리실 벽에 글자가 떠올랐다. \"더 많은 사람.\"", "{x}の収容室の壁に文字が浮かんだ。「もっと多くの人を」", "Words appear on {x}'s cell wall: \"MORE PEOPLE.\""),
    ch: [{ t: l("무시한다", "無視する", "Ignore it"), fx: { stab: -10 }, r: l("글자는 천천히 사라졌다", "文字はゆっくり消えた", "The words slowly fade") }, { t: l("직원 둘이 오늘 한 번씩 방문하게 한다", "職員二人に今日一度ずつ訪問させる", "Have two staff visit it today"), fx: { stab: 10, stressAll: 4 }, r: l("{x}이(가) 만족한 듯 조용해졌다", "{x}は満足したように静かになった", "{x} seems satisfied") }] },
  { id: "ev_leak", cat: "anom", who: "x", w: 0.8, title: l("에너지 누출", "エネルギー漏出", "Energy Leak"), text: l("{x}의 격리실에서 특수 에너지가 새어 나오고 있다.", "{x}の収容室から特殊エネルギーが漏れ出している。", "Special energy is leaking from {x}'s cell."),
    ch: [{ t: l("모아서 저장한다", "集めて貯める", "Collect it"), fx: { energy: 14, stab: -12 }, r: l("에너지는 챙겼지만 격리가 흔들렸다", "エネルギーは得たが収容が揺らいだ", "Energy gained — but the containment wobbled") }, { t: l("즉시 막는다", "直ちに塞ぐ", "Seal it at once"), fx: { stab: 8 }, r: l("누출이 멈췄다", "漏出が止まった", "The leak stops") }] },
  { id: "ev_calm", cat: "anom", who: "x", w: 0.9, title: l("고요한 아침", "静かな朝", "A Quiet Morning"), text: l("{x}이(가) 유난히 조용하다. 연구하기 좋은 날일지도.", "{x}がいつになく静かだ。研究日和かもしれない。", "{x} is unusually calm today. A good day for research, maybe."),
    ch: [{ t: l("오늘의 연구 대상으로 정한다", "今日の研究対象にする", "Make it today's focus"), fx: { stab: 12, data: 6 }, r: l("{x}의 기록이 순조롭다", "{x}の記録は順調だ", "Research on {x} goes smoothly") }] },
  { id: "ev_wrong", cat: "anom", who: "x", w: 0.6, cond: [["anyBreachEver"]], title: l("재격리 뒤의 흔적", "再収容後の痕跡", "Traces of the Breach"), text: l("지난 탈출 때 {x}이(가) 지나간 자리에 이상한 자국이 남아 있다.", "前回の脱走時に{x}が通った跡に奇妙な痕が残っている。", "Strange marks remain where {x} passed during a breach."),
    ch: [{ t: l("채취해서 분석한다", "採取して分析する", "Sample and analyze"), fx: { data: 15, stressAll: 3 }, r: l("새로운 단서를 얻었다", "新たな手がかりを得た", "A new clue") }, { t: l("깨끗이 청소한다 (자금 −40)", "きれいに掃除する（資金−40）", "Clean it up (−40 funds)"), fx: { money: -40, stressAll: -4 }, r: l("직원들이 안도했다", "職員たちは安堵した", "The staff relax") }] },
  // ── 시설 6 ──
  { id: "ev_genwarn", cat: "fac", w: 1, title: l("발전기 경고등", "発電機の警告灯", "Generator Warning Light"), text: l("발전기 계기판에 노란 경고등이 켜졌다.", "発電機の計器に黄色い警告灯が点いた。", "A yellow warning light comes on at the generator."),
    ch: [{ t: l("미리 정비한다 (자금 −90)", "先に整備する（資金−90）", "Service it now (−90 funds)"), fx: { money: -90, faultDelay: 1 }, r: l("오늘 발전기 고장 걱정은 없다", "今日の発電機故障の心配はない", "No generator faults today") }, { t: l("괜찮겠지", "大丈夫だろう", "It'll be fine"), fx: { faultSoon: 1 }, r: l("경고등은 계속 깜빡였다", "警告灯は点滅し続けた", "The light keeps blinking") }] },
  { id: "ev_leakpipe", cat: "fac", w: 0.9, title: l("배관 누수", "配管の漏水", "Leaking Pipe"), text: l("복도 천장에서 물이 떨어진다.", "廊下の天井から水が垂れている。", "Water is dripping from the corridor ceiling."),
    ch: [{ t: l("바로 고친다 (자금 −60)", "すぐ直す（資金−60）", "Fix it now (−60 funds)"), fx: { money: -60 }, r: l("누수가 멈췄다", "漏水が止まった", "The leak stops") }, { t: l("양동이를 받쳐 둔다", "バケツを置いておく", "Put a bucket under it"), fx: { stressAll: 4, power: -15 }, r: l("배선에 물이 닿아 전력이 출렁였다", "配線に水がかかり電力が揺らいだ", "Water hits the wiring; power flickers") }] },
  { id: "ev_vending", cat: "fac", w: 0.8, title: l("자판기 고장", "自販機の故障", "Broken Vending Machine"), text: l("휴게실 자판기가 동전만 먹고 아무것도 안 준다.", "休憩室の自販機が硬貨を飲み込むだけで何も出さない。", "The lounge vending machine eats coins and gives nothing."),
    ch: [{ t: l("새 자판기 (자금 −70)", "新しい自販機（資金−70）", "New machine (−70 funds)"), fx: { money: -70, stressAll: -6 }, r: l("직원들이 환호했다", "職員たちは歓声を上げた", "The staff cheer") }, { t: l("발로 차 본다", "蹴ってみる", "Give it a kick"), fx: { coin: 1 }, r: l("…결과는 운에 달렸다", "…結果は運次第", "…results may vary") }] },
  { id: "ev_power_surge", cat: "fac", w: 0.8, title: l("전력 서지", "電力サージ", "Power Surge"), text: l("발전기 출력이 갑자기 치솟았다.", "発電機の出力が急に跳ね上がった。", "The generator output suddenly spikes."),
    ch: [{ t: l("에너지로 저장한다", "エネルギーとして蓄える", "Store it as energy"), fx: { energy: 8, power: -20 }, r: l("에너지를 조금 얻었다", "エネルギーを少し得た", "A little energy gained") }, { t: l("안전하게 흘려보낸다", "安全に逃がす", "Vent it safely"), fx: {}, r: l("서지가 지나갔다", "サージは過ぎ去った", "The surge passes") }] },
  { id: "ev_drill", cat: "fac", w: 0.7, title: l("비상 훈련", "非常訓練", "Emergency Drill"), text: l("안전 규정상 오늘 비상 훈련을 해야 한다.", "安全規定上、今日は非常訓練をしなければならない。", "Safety rules call for an emergency drill today."),
    ch: [{ t: l("실시한다", "実施する", "Run the drill"), fx: { energy: -6, stressAll: -5, xpAll: 8 }, r: l("모두 대피 경로를 몸에 익혔다", "全員が避難経路を体で覚えた", "Everyone learns the evacuation routes") }, { t: l("서류만 작성한다", "書類だけ作成する", "Just file the paperwork"), fx: { flag: "skipDrill" }, r: l("서류에 '실시함'이라고 적었다", "書類に「実施済み」と書いた", "You write 'completed' on the form") }] },
  { id: "ev_cam", cat: "fac", w: 0.7, title: l("감시 카메라 사각지대", "監視カメラの死角", "Camera Blind Spot"), text: l("녹화 영상에서 3초가 통째로 비어 있다.", "録画映像から3秒が丸ごと抜けている。", "Three seconds are missing from the security footage."),
    ch: [{ t: l("원인을 조사한다 (자금 −50)", "原因を調査する（資金−50）", "Investigate (−50 funds)"), fx: { money: -50, dataAny: 10 }, r: l("영상 속 그림자 하나가 단서가 되었다", "映像の影の一つが手がかりになった", "A shadow in the footage becomes a clue") }, { t: l("기계 오류로 처리한다", "機械の誤作動として処理する", "Log it as a glitch"), fx: { stressAll: 2 }, r: l("찜찜함이 남았다", "もやもやが残った", "An uneasy feeling lingers") }] },
  // ── 기관 4 ──
  { id: "ev_inspect", cat: "org", w: 0.9, day: [3, 99], title: l("본부 감사", "本部監査", "HQ Inspection"), text: l("본부 감사관이 오늘 시설을 둘러보겠다고 통보했다.", "本部の監査官が今日施設を視察すると通知してきた。", "An HQ inspector announces a visit today."),
    ch: [{ t: l("성과를 부풀려 보고한다", "成果を誇張して報告する", "Pad the numbers"), fx: { money: 200, flag: "lied" }, r: l("감사관이 만족했다… 지금은", "監査官は満足した…今のところは", "The inspector is satisfied… for now") }, { t: l("있는 그대로 보여 준다", "ありのまま見せる", "Show things as they are"), fx: { money: 80, flag: "honest" }, r: l("감사관이 고개를 끄덕였다", "監査官はうなずいた", "The inspector nods") }] },
  { id: "ev_budget", cat: "org", w: 0.8, title: l("예산 삭감 통보", "予算削減の通知", "Budget Cut Notice"), text: l("본부가 이번 주 예산을 줄이겠다고 한다.", "本部が今週の予算を削ると言ってきた。", "HQ plans to cut this week's budget."),
    ch: [{ t: l("받아들인다", "受け入れる", "Accept it"), fx: { money: -150 }, r: l("허리띠를 졸라맸다", "ベルトを締め直した", "Time to tighten belts") }, { t: l("오늘 목표를 올리는 조건으로 막는다", "今日の目標を上げる条件で防ぐ", "Block it by raising today's quota"), fx: { quota: 30 }, r: l("예산은 지켰지만 오늘 목표가 늘었다", "予算は守ったが今日の目標が増えた", "Budget saved, but today's quota grew") }] },
  { id: "ev_contract", cat: "org", w: 0.7, title: l("특수 계약", "特殊契約", "Special Contract"), text: l("외부 기업이 특수 에너지를 웃돈을 주고 사겠다고 한다.", "外部企業が特殊エネルギーを割増で買いたいという。", "An outside company wants to buy special energy at a premium."),
    ch: [{ t: l("에너지 20을 판다", "エネルギー20を売る", "Sell 20 energy"), fx: { energy: -20, money: 220, flag: "sold" }, r: l("거래가 끝났다. 그들이 무엇에 쓸지는 모른다", "取引は終わった。彼らが何に使うかは分からない", "The deal is done. What they'll use it for, you don't know") }, { t: l("거절한다", "断る", "Decline"), fx: {}, r: l("그들은 명함을 두고 갔다", "彼らは名刺を置いて行った", "They leave a business card") }] },
  { id: "ev_hiring", cat: "org", w: 0.6, day: [2, 99], title: l("파견 인력", "派遣人員", "A Temp Worker"), text: l("본부가 하루짜리 파견 연구원을 보내 주겠다고 한다.", "本部が一日だけの派遣研究員を送ってくれるという。", "HQ offers a temp researcher for the day."),
    ch: [{ t: l("받는다 (자금 −100)", "受け入れる（資金−100）", "Accept (−100 funds)"), fx: { money: -100, energy: 12 }, r: l("파견 연구원이 하루 동안 성과를 냈다", "派遣研究員が一日で成果を出した", "The temp produced results") }, { t: l("사양한다", "辞退する", "No thanks"), fx: {}, r: l("본부가 아쉬워했다", "本部は残念がった", "HQ shrugs") }] },
  // ── 비밀 2 ──
  { id: "ev_oldlog", cat: "secret", w: 0.6, day: [4, 99], once: 1, title: l("전임 관리자의 기록", "前任管理者の記録", "The Previous Manager's Log"), text: l("{a}이(가) 환풍구 안에서 낡은 수첩을 찾았다. 전임 관리자의 것이다.", "{a}が換気口の中で古い手帳を見つけた。前任管理者のものだ。", "{a} finds an old notebook in a vent. It belonged to the previous manager."),
    who: "a", ch: [{ t: l("읽는다", "読む", "Read it"), fx: { flag: "secret1", dataAny: 20, stressA: 8 }, r: l("「ZERO는 이변체를 가두는 곳이 아니다. 기르는 곳이다.」", "「ZEROは異変体を閉じ込める場所ではない。育てる場所だ」", "\"ZERO doesn't contain anomalies. It cultivates them.\"") }, { t: l("본부에 넘긴다", "本部に渡す", "Hand it to HQ"), fx: { money: 150, flag: "loyal" }, r: l("본부는 수첩을 받고 아무 말도 하지 않았다", "本部は手帳を受け取り何も言わなかった", "HQ takes the notebook without a word") }] },
  { id: "ev_door13", cat: "secret", w: 0.5, day: [6, 99], once: 1, title: l("기록에 없는 격리실", "記録にない収容室", "A Cell Not on the Map"), text: l("도면에 없는 문이 B3 복도 끝에서 발견되었다. 안에서 무언가 두드린다.", "図面にない扉がB3廊下の端で見つかった。中から何かが叩いている。", "A door not on any blueprint turns up at the end of the B3 corridor. Something knocks from inside."),
    ch: [{ t: l("연다", "開ける", "Open it"), fx: { flag: "secret2", dataAll: 8, stressAll: 10 }, r: l("빈 방이었다. 벽에는 이 시설의 직원 이름이 모두 적혀 있었다 — 아직 고용하지 않은 사람까지", "空の部屋だった。壁にはこの施設の職員名が全て書かれていた — まだ雇っていない者まで", "It's empty. Every staff name is written on the wall — including people you haven't hired yet") }, { t: l("용접해 버린다 (자금 −60)", "溶接してしまう（資金−60）", "Weld it shut (−60 funds)"), fx: { money: -60, stressAll: -3 }, r: l("두드리는 소리는 이틀 동안 이어졌다", "叩く音は二日間続いた", "The knocking continues for two days") }] },
];

// ---------- 공명 10종 (두 이변체가 함께 격리돼 있을 때) ----------
// on tick: 초당 효과 / on work: 해당 이변체 작업 결과에 곱함
export const RESO = [
  { id: "r_photo", a: "lamp", b: "garden", name: l("인공 광합성", "人工光合成", "Artificial Photosynthesis"), desc: l("전력 80% 이상이면 정원이 전등 빛을 받아 안정돼요", "電力80%以上なら庭が電灯の光を浴びて安定", "With power ≥80%, the Garden basks in the lamp's light and steadies"), on: "tick", if: [["power>=", 80]], fx: { stab: { garden: 0.08 } } },
  { id: "r_lights", a: "lamp", b: "shadow", name: l("조명 이상", "照明異常", "Lighting Anomaly"), desc: l("전력 60% 아래면 그림자 없는 사람이 불안정해지고, 전등의 에너지는 +20%", "電力60%未満で影のない人が不安定に、電灯のエネルギー+20%", "Below 60% power the Shadowless Man destabilizes; the Lamp gives +20% energy"), on: "tick", if: [["power<", 60]], fx: { stab: { shadow: -0.12 } }, work: { lamp: { energy: 1.2 } } },
  { id: "r_voice", a: "choir", b: "library", name: l("음성 기록 변조", "音声記録の改ざん", "Altered Voice Records"), desc: l("도서관 행동 분석 데이터 ×1.5, 합창단은 조금씩 불안정", "図書館の行動分析データ×1.5、合唱団は少しずつ不安定", "Library Analysis data ×1.5; the Choir slowly destabilizes"), on: "tick", if: [], fx: { stab: { choir: -0.06 } }, work: { library: { data: 1.5, m: "analyze" } } },
  { id: "r_mind", a: "garden", b: "whale", name: l("마음의 정원", "心の庭", "Garden of the Mind"), desc: l("모든 직원의 스트레스가 천천히 내려가요", "全職員のストレスがゆっくり下がる", "Everyone's stress slowly falls"), on: "tick", if: [], fx: { stressAll: -0.08 } },
  { id: "r_future", a: "clock", b: "letter", name: l("미래 기록 혼선", "未来記録の混線", "Crossed Futures"), desc: l("시계 에너지 ×1.3, 편지는 조금씩 불안정", "時計のエネルギー×1.3、手紙は少しずつ不安定", "Clock energy ×1.3; the Letter slowly destabilizes"), on: "tick", if: [], fx: { stab: { letter: -0.05 } }, work: { clock: { energy: 1.3 } } },
  { id: "r_map", a: "paper", b: "city", name: l("새로운 탐사 지역", "新たな探査地域", "A New District"), desc: l("문 너머의 도시 탐사 에너지 ×1.4, 종이 왕국 데이터 ×1.3", "扉の向こうの街の探査エネルギー×1.4、紙の王国データ×1.3", "City exploration energy ×1.4; Paper Kingdom data ×1.3"), on: "tick", if: [], fx: {}, work: { city: { energy: 1.4 }, paper: { data: 1.3 } } },
  { id: "r_dis", a: "music", b: "choir", name: l("불협화음", "不協和音", "Dissonance"), desc: l("합창단이 불안정해지지만 오르골의 에너지 ×1.5", "合唱団が不安定になるがオルゴールのエネルギー×1.5", "The Choir destabilizes, but the Music Box gives ×1.5 energy"), on: "tick", if: [], fx: { stab: { choir: -0.1 } }, work: { music: { energy: 1.5 } } },
  { id: "r_names", a: "box", b: "chair", name: l("잊힌 이름", "忘れられた名", "Forgotten Names"), desc: l("레벨 2 이상 직원이 의자를 다루면 데이터 ×1.5", "レベル2以上の職員が椅子を扱うとデータ×1.5", "Level 2+ staff get ×1.5 data from the Chair"), on: "tick", if: [], fx: {}, work: { chair: { data: 1.5, lv: 2 } } },
  { id: "r_time", a: "window", b: "clock", name: l("시간의 창", "時の窓", "Window of Time"), desc: l("창문 에너지 ×1.4, 시계는 안정돼요", "窓のエネルギー×1.4、時計は安定", "Window energy ×1.4; the Clock steadies"), on: "tick", if: [], fx: { stab: { clock: 0.06 } }, work: { window: { energy: 1.4 } } },
  { id: "r_stitch", a: "thread", b: "mimic", name: l("꿰매진 얼굴", "縫われた顔", "The Stitched Face"), desc: l("이름 없는 동료가 불안정해지지만 실타래 데이터 ×1.3", "名もなき同僚が不安定になるが糸玉データ×1.3", "The Nameless Colleague destabilizes; Red Thread data ×1.3"), on: "tick", if: [], fx: { stab: { mimic: -0.1 } }, work: { thread: { data: 1.3 } } },
];

// ---------- 캠페인 이야기 (등장인물: 운영 AI 에코 · 한 이사 · 수석 연구원 윤 박사) ----------
export const CAST = { echo: l("운영 AI 에코", "運営AI エコー", "ECHO, Facility AI"), han: l("한도윤 이사", "ハン・ドユン理事", "Director Han"), yoon: l("윤세라 수석 연구원", "ユン・セラ主任研究員", "Dr. Sera Yoon") };
export const STORY = {
  1: [["echo", l("ZERO 제7시설에 오신 것을 환영합니다, 관리자님. 전임자는… 기록상 '전보'되었습니다.", "ZERO第7施設へようこそ、管理者様。前任者は…記録上「異動」となっています。", "Welcome to ZERO Facility 7, Manager. Your predecessor was… 'transferred,' according to the records.")], ["han", l("에너지 목표만 맞춰 주게. 나머지는 묻지 말고.", "エネルギー目標さえ達成してくれ。他は聞くな。", "Just hit the energy quota. Don't ask about the rest.")]],
  2: [["yoon", l("이변체는 괴물이 아니에요. 규칙이 있을 뿐이죠. 그 규칙을 찾는 게 우리 일이에요.", "異変体は怪物じゃない。規則があるだけ。その規則を見つけるのが私たちの仕事よ。", "Anomalies aren't monsters. They just have rules. Finding those rules is our job.")]],
  3: [["echo", l("오늘부터 새 이변체가 자주 들어옵니다. 격리실이 모자라면 빈 구역에 지으세요.", "今日から新しい異変体が頻繁に来ます。収容室が足りなければ空き区画に建ててください。", "New anomalies will arrive more often now. Build cells in empty lots if you run short.")]],
  4: [["echo", l("지하 4층(B4) 굴착이 끝났습니다. …굴착 기록에 없는 공간이 하나 있었습니다.", "地下4階（B4）の掘削が完了しました。…掘削記録にない空間が一つありました。", "Excavation of B4 is complete. …There was one space not in the excavation records.")], ["han", l("그건 신경 쓰지 말게.", "それは気にするな。", "Pay that no mind.")]],
  5: [["yoon", l("관리자님, 이상해요. 이변체들이 서로 반응해요. 공명이라고 불러야 할까요?", "管理者、変です。異変体同士が反応してます。共鳴と呼ぶべきかしら。", "Manager, something's odd. The anomalies react to each other. Should we call it resonance?")]],
  6: [["echo", l("본부가 에너지 사용처를 공개하지 않습니다. 에코는 질문할 권한이 없습니다.", "本部はエネルギーの使い道を公開していません。エコーには質問する権限がありません。", "HQ won't disclose where the energy goes. ECHO has no authority to ask.")]],
  7: [["echo", l("B5가 열렸습니다. 가장 깊은 층입니다. 이곳의 이변체는 등급이 높습니다.", "B5が開きました。最も深い階です。ここの異変体は等級が高いです。", "B5 is open. The deepest level. The anomalies down here are high-grade.")], ["yoon", l("…전임 관리자도 여기까지 왔었겠죠.", "…前任の管理者もここまで来たんでしょうね。", "…The previous manager must have made it this far too.")]],
  8: [["han", l("마지막 평가가 다가오네. 숫자로 증명하게.", "最終評価が近いな。数字で証明しろ。", "Final review is coming. Prove yourself with numbers.")]],
  9: [["yoon", l("규칙을 다 알게 되면, 우린 이들을 가두는 걸까요, 이해하는 걸까요?", "規則を全部知ったら、私たちは彼らを閉じ込めるの？理解するの？", "Once we know all the rules — are we containing them, or understanding them?")]],
  10: [["echo", l("오늘이 평가일입니다. 관리자님의 기록이 이 시설의 미래를 정합니다.", "今日が評価日です。管理者様の記録がこの施設の未来を決めます。", "Today is review day. Your record will decide this facility's future.")]],
};
// ---------- 엔딩 ----------
export const ENDINGS = {
  closed: { ic: "🔒", name: l("폐쇄된 시설", "閉鎖された施設", "The Facility Closed"), text: l("본부는 제7시설의 폐쇄를 결정했다. 격리실의 불이 하나씩 꺼지는 동안, 직원들은 마지막으로 서로의 이름을 불렀다. 이변체들은 다른 시설로 옮겨졌다 — 그곳의 관리자가 누구인지는 아무도 알려 주지 않았다.", "本部は第7施設の閉鎖を決定した。収容室の灯が一つずつ消える間、職員たちは最後に互いの名を呼んだ。異変体は別の施設に移された — そこの管理者が誰かは誰も教えてくれなかった。", "HQ ordered Facility 7 closed. As the cell lights went out one by one, the staff called each other's names one last time. The anomalies were moved elsewhere — no one would say who manages them now.") },
  truth: { ic: "📖", name: l("진실의 기록자", "真実の記録者", "Keeper of Truth"), text: l("당신이 밝혀낸 규칙들은 본부의 기록과 맞지 않았다. 이변체는 '사고'가 아니라 누군가 설계한 결과였다. 윤 박사는 기록을 복사해 두었다. \"언젠가 이게 필요할 거예요.\" 에코는 처음으로 질문을 했다. \"관리자님, 우리는 무엇을 지키고 있었습니까?\"", "あなたが解き明かした規則は本部の記録と一致しなかった。異変体は「事故」ではなく、誰かが設計した結果だった。ユン博士は記録を複製した。「いつか必要になるわ」エコーは初めて質問した。「管理者様、私たちは何を守っていたのですか？」", "The rules you uncovered didn't match HQ's records. The anomalies weren't accidents — someone designed them. Dr. Yoon copied the files. \"We'll need these someday.\" For the first time, ECHO asked a question: \"Manager, what were we protecting?\"") },
  perfect: { ic: "🏅", name: l("완벽한 관리자", "完璧な管理者", "The Perfect Manager"), text: l("열흘 동안 단 한 명도 잃지 않았다. 목표는 거의 매일 넘겼다. 한 이사는 당신을 본부 정규직으로 추천했다. 휴게실 벽에는 직원들이 몰래 붙인 쪽지가 남았다 — \"우리 관리자, 고마워요.\"", "十日間、一人も失わなかった。目標はほぼ毎日超えた。ハン理事はあなたを本部の正職員に推薦した。休憩室の壁には職員がこっそり貼ったメモが残った —「管理者さん、ありがとう」", "Ten days, and not a single person lost. You beat the quota nearly every day. Director Han recommended you for a permanent HQ post. On the lounge wall, a note the staff secretly left: \"Thank you, boss.\"") },
  zero: { ic: "0️⃣", name: l("제로 프로젝트의 완성", "ゼロ計画の完成", "Project Zero, Complete"), text: l("다섯 개의 기밀 문서가 하나의 결론을 가리켰다. 이변체는 이 세계의 바깥에서 온 것이 아니었다 — 규칙을 모두 들켜 버린 사람들이 마지막에 남긴 모습이었다. 에코가 조용히 말했다. 「관리자님, 당신의 규칙은 아직 아무도 모릅니다.」 당신은 격리실의 문을 하나씩 열었다. 이번에는 가두기 위해서가 아니라, 돌려보내기 위해서.", "五つの機密文書は一つの結論を指していた。異変体はこの世界の外から来たのではなかった — 規則をすべて知られてしまった人々が最後に残した姿だった。エコーが静かに言った。「管理者様、あなたの規則はまだ誰も知りません」あなたは収容室の扉を一つずつ開けた。今度は閉じ込めるためではなく、帰すために。", "Five classified files pointed to one conclusion. The anomalies didn't come from outside this world — they were what remained of people whose every rule had been learned. ECHO said quietly, \"Manager, no one knows your rules yet.\" You opened the cells one by one. Not to contain them this time — to send them home.") },
  endless: { ic: "🔁", name: l("끝없는 근무", "終わりなき勤務", "The Endless Shift"), text: l("평가는 '보통'이었다. 본부는 계약을 연장했고, 내일도 같은 시각에 근무가 시작된다. 격리실의 이변체들은 오늘도 당신을 기다린다. 어쩌면 전임자도 이렇게 시작했을 것이다.", "評価は「普通」だった。本部は契約を延長し、明日も同じ時刻に勤務が始まる。収容室の異変体たちは今日もあなたを待っている。前任者もこうして始まったのかもしれない。", "The review came back 'adequate.' HQ extended your contract; tomorrow's shift starts at the same time. The anomalies in their cells are waiting for you. Maybe your predecessor started out this way too.") },
};
