// =========================
// 격리구역: 제로 — 게임 데이터 (화면·서버 공용, DOM 없음)
// 글자는 [한, 日, EN] 세 칸. 규칙(숨은 규칙·가설)은 실제 계산은 zero-core.js에 있고 여기엔 설명과 수치만 둠.
// =========================
export const VERSION = "z2";
const l = (ko, ja, en) => [ko, ja, en];
import { ANOMS as A2 } from "./zero-anoms.js?v=20261127_z2";
import { BUILD, TRAITS2 } from "./zero-content.js?v=20261127_z2";

// ---------- 시간·크기 ----------
export const TICK = 10;                 // 초당 시뮬레이션 횟수
export const DAY_MIN = 600;              // 08:00 ~ 18:00 (게임 분)
export const MIN_PER_TICK = 0.2;         // 1배속에서 실제 1초 = 게임 2분 → 하루 5분
export const FLOOR_H = 128;              // 층 높이(원본 픽셀)
export const T = 16;                     // 타일

// ---------- 시설 종류 (1단계 5종 + 기반 시설) ----------
export const ROOM_TYPES = {
  contain: { name: l("격리실", "収容室", "Containment Cell"), desc: l("이변체를 가두는 방. 문은 작업할 때만 열려요.", "異変体を閉じ込める部屋。扉は作業時だけ開きます。", "Holds an anomaly. The door only opens for work."), col: "#3a4150" },
  control: { name: l("중앙통제실", "中央制御室", "Central Control"), desc: l("직원이 근무하면 연구 데이터 +15%, 이변체 불안정 경고가 일찍 떠요.", "職員が勤務すると研究データ+15%、異変体の不安定警告が早く出ます。", "While staffed: research data +15% and earlier instability warnings."), col: "#1f3346" },
  lounge: { name: l("직원 휴게실", "職員休憩室", "Staff Lounge"), desc: l("쉬면 스트레스·피로가 빨리 내려가요.", "休むとストレス・疲労が早く下がります。", "Resting here quickly lowers stress and fatigue."), col: "#3e3226" },
  medbay: { name: l("의료실", "医務室", "Medical Bay"), desc: l("부상 직원의 체력이 회복돼요. 의료요원이 있으면 두 배.", "負傷職員の体力が回復。医療員がいれば2倍。", "Restores injured staff. Twice as fast with a medic."), col: "#24403f" },
  generator: { name: l("발전실", "発電室", "Generator Room"), desc: l("시설 전력을 만들어요. 고장 나면 기술자가 고쳐야 해요.", "施設の電力を作ります。故障したら技術者が修理します。", "Produces facility power. A technician must fix faults."), col: "#40321f" },
  corridor: { name: l("복도", "廊下", "Corridor"), desc: l("", "", ""), col: "#2b2f36" },
  elevator: { name: l("엘리베이터", "エレベーター", "Elevator"), desc: l("층을 오가요.", "階を移動します。", "Moves between floors."), col: "#23262b" },
  lot: { name: l("빈 구역", "空き区画", "Empty Lot"), desc: l("준비 시간에 시설을 지을 수 있어요.", "準備時間に施設を建てられます。", "Build a facility here during the morning briefing."), col: "#1c1d21" },
};

// 시설 배치 (층 0 = 가장 위). x는 타일 단위
// 시설 배치 (층 0 = 가장 위). x는 타일 단위. 층 3은 4일차, 층 4는 7일차에 열림
export const LAYOUT = [
  { f: 0, rooms: [["control", 0, 15], ["corridor", 15, 22], ["elevator", 22, 27], ["lounge", 27, 43], ["medbay", 43, 57], ["lot", 57, 71]] },
  { f: 1, rooms: [["contain", 0, 15, "lamp"], ["corridor", 15, 22], ["elevator", 22, 27], ["corridor", 27, 37], ["contain", 37, 52, "garden"], ["lot", 52, 66]] },
  { f: 2, rooms: [["generator", 0, 15], ["corridor", 15, 22], ["elevator", 22, 27], ["corridor", 27, 37], ["contain", 37, 54], ["lot", 54, 68]] },
  { f: 3, rooms: [["lot", 0, 15], ["corridor", 15, 22], ["elevator", 22, 27], ["corridor", 27, 37], ["contain", 37, 54], ["lot", 54, 68]], open: 4 },
  { f: 4, rooms: [["contain", 0, 17], ["corridor", 17, 22], ["elevator", 22, 27], ["corridor", 27, 37], ["contain", 37, 54], ["lot", 54, 68]], open: 7 },
];
export const STAFF_CAP = 6;

// ---------- 직업 (1단계 4종) ----------
for (const k in BUILD) if (BUILD[k].name) ROOM_TYPES[k] = { name: BUILD[k].name, desc: BUILD[k].desc, col: "#2a2d35" };

export const JOBS = {
  researcher: { name: l("연구원", "研究員", "Researcher"), duty: l("이변체 연구", "異変体研究", "Studies anomalies"), base: { obs: 6, emp: 5, foc: 6, cou: 4, cmb: 2, tec: 4 }, hp: 90 },
  security: { name: l("보안요원", "警備員", "Security"), duty: l("탈출 제압 (자동 출동)", "脱走鎮圧（自動出動）", "Suppresses breaches (auto-responds)"), base: { obs: 4, emp: 3, foc: 4, cou: 7, cmb: 7, tec: 3 }, hp: 130 },
  medic: { name: l("의료요원", "医療員", "Medic"), duty: l("부상자 치료 (자동)", "負傷者の治療（自動）", "Treats the injured (auto)"), base: { obs: 5, emp: 7, foc: 5, cou: 5, cmb: 3, tec: 4 }, hp: 100 },
  tech: { name: l("시설기술자", "施設技術者", "Technician"), duty: l("고장 수리 (자동)", "故障修理（自動）", "Repairs faults (auto)"), base: { obs: 4, emp: 4, foc: 5, cou: 5, cmb: 4, tec: 8 }, hp: 110 },
};
export const STATS = ["obs", "emp", "foc", "cou", "cmb", "tec"];
export const STAT_NAME = {
  obs: l("관찰력", "観察力", "Observation"), emp: l("공감력", "共感力", "Empathy"), foc: l("집중력", "集中力", "Focus"),
  cou: l("용기", "勇気", "Courage"), cmb: l("전투", "戦闘", "Combat"), tec: l("기술", "技術", "Tech"),
};

// ---------- 특성 (1단계 10종) — 실제 효과는 core의 traitMod ----------
export const TRAITS = {
  calm: { name: l("침착함", "冷静", "Calm"), desc: l("스트레스를 30% 덜 받아요", "ストレスを30%軽減", "Takes 30% less stress"), good: 1 },
  curious: { name: l("호기심", "好奇心", "Curious"), desc: l("연구 데이터 +20%, 위험 작업 스트레스 +15%", "研究データ+20%、危険作業のストレス+15%", "+20% research data, +15% stress on risky work"), good: 1 },
  perfect: { name: l("완벽주의", "完璧主義", "Perfectionist"), desc: l("작업이 20% 느리지만 실패가 적어요", "作業が20%遅いが失敗が少ない", "Works 20% slower but fails less"), good: 0 },
  social: { name: l("사교적", "社交的", "Sociable"), desc: l("대화 연구가 잘 되고 친해지는 속도 두 배", "対話研究が得意、親しくなる速度2倍", "Better at Dialogue, bonds twice as fast"), good: 1 },
  careful: { name: l("신중함", "慎重", "Careful"), desc: l("나쁜 결과가 덜 나와요", "悪い結果が出にくい", "Bad results are rarer"), good: 1 },
  rash: { name: l("충동적", "衝動的", "Impulsive"), desc: l("작업이 25% 빠르지만 실수가 잦아요", "作業が25%速いがミスが多い", "Works 25% faster but slips up more"), good: 0 },
  darkfear: { name: l("어둠 공포", "暗所恐怖", "Fear of the Dark"), desc: l("어두운 곳에서 스트레스 두 배", "暗い場所でストレス2倍", "Double stress in the dark"), good: -1 },
  noise: { name: l("소음 민감", "騒音過敏", "Noise-Sensitive"), desc: l("경보·노랫소리에 스트레스를 더 받아요", "警報や歌声でストレス増", "Alarms and singing stress them more"), good: -1 },
  mech: { name: l("기계 친화", "機械好き", "Mechanically Minded"), desc: l("수리·환경 조절이 40% 빨라요", "修理・環境調整が40%速い", "Repairs and Environment work 40% faster"), good: 1 },
  brave: { name: l("강심장", "度胸", "Steel Nerves"), desc: l("패닉에 잘 빠지지 않아요", "パニックになりにくい", "Rarely panics"), good: 1 },
};

// ---------- 연구 방식 (1단계 4종) ----------
Object.assign(TRAITS, TRAITS2);

export const METHODS = {
  observe: { name: l("관찰", "観察", "Observe"), stat: "obs", icon: "eye", desc: l("거리를 두고 기록해요. 안전한 편.", "距離を置いて記録。比較的安全。", "Record from a distance. Fairly safe.") },
  talk: { name: l("대화", "対話", "Dialogue"), stat: "emp", icon: "talk", desc: l("말을 걸어 반응을 봐요.", "話しかけて反応を見る。", "Speak to it and watch the response.") },
  env: { name: l("환경 조절", "環境調整", "Environment"), stat: "tec", icon: "env", desc: l("빛·온도·소리를 바꿔 봐요.", "光・温度・音を変えてみる。", "Adjust light, temperature and sound.") },
  analyze: { name: l("행동 분석", "行動分析", "Analysis"), stat: "foc", icon: "scan", desc: l("깊이 분석해요. 데이터가 많지만 위험해요. (1단계 연구 후)", "深く分析。データは多いが危険。（研究段階1以降）", "Deep analysis. More data, more risk. (after research stage 1)"), need: 1 },
};

// 연구 단계: 누적 데이터 기준
export const STAGES = [0, 30, 90, 180, 320, 520];
export const STAGE_NAME = [l("미확인", "未確認", "Unknown"), l("기본 특성", "基本特性", "Basic Traits"), l("선호 연구", "好む研究", "Preferences"), l("위험 조건", "危険条件", "Risk Factors"), l("격리 규칙", "収容規則", "Containment Rules"), l("완전 분석", "完全分析", "Fully Analyzed")];
export const GRADE = ["", "I", "II", "III", "IV", "V"];
export const GRADE_NAME = ["", l("안정", "安定", "Stable"), l("주의", "注意", "Caution"), l("위험", "危険", "Danger"), l("재난", "災害", "Disaster"), l("종말", "終末", "Apocalypse")];

export const ANOMS = A2;

// ---------- 직원 (1단계 고정 5명, 이름은 언어별) ----------
export const START_STAFF = [
  { name: l("한서윤", "ハン・ソユン", "Seoyun Han"), job: "researcher", traits: ["curious", "calm"], look: { skin: 0, hair: 1, hc: 2, f: 1 }, bonus: { obs: 1 } },
  { name: l("마르코 벨리니", "マルコ・ベリーニ", "Marco Bellini"), job: "researcher", traits: ["perfect", "darkfear"], look: { skin: 1, hair: 0, hc: 0, f: 0 }, bonus: { foc: 1, emp: 1 } },
  { name: l("강도현", "カン・ドヒョン", "Dohyun Kang"), job: "security", traits: ["brave", "rash"], look: { skin: 0, hair: 3, hc: 0, f: 0 }, bonus: {} },
  { name: l("사토 유이", "佐藤ユイ", "Yui Sato"), job: "medic", traits: ["social", "careful"], look: { skin: 0, hair: 2, hc: 1, f: 1 }, bonus: { emp: 1 } },
  { name: l("오비 은켐", "オビ・ンケム", "Obi Nkem"), job: "tech", traits: ["mech", "noise"], look: { skin: 3, hair: 4, hc: 0, f: 0 }, bonus: {} },
];

// ---------- 난이도 ----------
export const DIFFS = {
  story: { name: l("이야기", "ストーリー", "Story"), quota: 0.7, stress: 0.7, fault: 0.6, stab: 0.7 },
  normal: { name: l("일반", "ノーマル", "Normal"), quota: 1, stress: 1, fault: 1, stab: 1 },
  hard: { name: l("어려움", "ハード", "Hard"), quota: 1.25, stress: 1.2, fault: 1.4, stab: 1.3 },
};
export const QUOTA = [0, 190, 290, 390, 490, 590, 690, 790, 890, 990, 1100];   // 일차별 에너지 목표
export const STRESS_STATE = [[25, "stable"], [50, "tense"], [70, "uneasy"], [85, "overload"], [101, "panic"]];
export const STATE_NAME = { stable: l("안정", "安定", "Stable"), tense: l("긴장", "緊張", "Tense"), uneasy: l("불안정", "不安定", "Uneasy"), overload: l("과부하", "過負荷", "Overloaded"), panic: l("패닉", "パニック", "Panic"), down: l("쓰러짐", "ダウン", "Down"), lost: l("순직", "殉職", "Lost") };
