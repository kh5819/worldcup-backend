// =========================
// 플듀 증강 윷놀이 확장전 (mode "expand") — 특수 윷판 5종 · 말 진화 · 함정 10종 · 팀 능력 5종 · 보스 3종 · 확장 증강 40종
// · 일반("classic")·기존 증강("augment") 모드에서는 이 파일이 아예 쓰이지 않음 (YutGame 이 mode==="expand" 일 때만 new Expansion)
// · 모든 판정은 서버. 상태는 this.st(JSON) + 말 객체의 x* 필드 → 시간 역행 저장/복원이 쉬움
// · 무한 방지: 한 이동에서 칸·함정 연쇄 최대 3번, 이벤트 덤 던지기 차례당 1번, 이동 칸 수 최대 12, 경험치 차례당 6·최대 3단계,
//   함정 판 위 최대 12개(팀당 4), 분신 하나, 증강 횟수 제한
// · 보스·함정·칸 효과는 말을 집으로 보내거나 완주시키지 않음 (뒤로 밀기는 출발 칸 1까지) → 승패 판정을 흔들지 않음
// =========================
import { HOME, DONE, EDGES, forwardPaths, distLeft, nextOptions, throwSticks } from "./yut-core.js";

const clone = (o) => JSON.parse(JSON.stringify(o));
export const FORK_NODES = [5, 10, 15, 22];
const DIAG = [20, 21, 23, 24, 25, 26, 27, 28];
const SPOTS = Array.from({ length: 29 }, (_, i) => i).filter(n => n !== 0 && !FORK_NODES.includes(n)); // 특수 칸·함정 놓을 수 있는 칸 (출발·도착점과 모서리·방 제외)
const NEIGH = (() => { const m = {}; for (const [a, b] of EDGES) { (m[a] ||= new Set()).add(b); (m[b] ||= new Set()).add(a); } return m; })();
const MAX_CHAIN = 3, MAX_STEPS = 12, XP_TURN_CAP = 6, MAX_TRAPS = 12, TEAM_TRAPS = 4, TRAP_TTL = 5;
const XP_LV = [0, 5, 12]; // 2단계 5, 3단계 12

// ---------------- 데이터 (화면 META 로도 나감) ----------------
export const MAPS = {
  classic: { icon: "🎋", name: "클래식 변이 윷판", desc: "전통 윷판에 ❓ 이벤트 칸 4개. 3바퀴마다 이벤트 칸 자리가 바뀌어요." },
  volcano: { icon: "🌋", name: "화산 윷판", desc: "🔥 용암 칸 5개(멈추면 경험치 +2). 3바퀴마다 화산 폭발 — 용암 칸 위 말은 3칸 뒤로 (한 바퀴 전에 예고, 방패로 막을 수 있음)." },
  ice: { icon: "🧊", name: "얼음 윷판", desc: "🧊 빙판 칸(멈추면 1칸 더 미끄러짐) 5개, ❄️ 빙결 칸(다음 차례 못 움직임) 2개, 🌿 회복 칸 1개(빙결·느려짐 해제)." },
  forest: { icon: "🌲", name: "신비의 숲 윷판", desc: "🌿 회복 칸 2개, 🌀 순간이동 칸 한 쌍(서로 연결), 🛡 보호 칸 2개(그 위 말은 잡히지 않음). 4바퀴마다 숲의 정령이 나타나요 — 먼저 닿으면 큰 보상." },
  chaos: { icon: "🌀", name: "혼돈의 윷판", desc: "매 바퀴 특수 칸 6개가 새로 섞이고, 지름길이 열리거나 닫혀요. 매 바퀴 무작위 축복·저주가 한 명에게 떨어져요." },
};
export const TILES = {
  q: { icon: "❓", name: "이벤트 칸", desc: "멈추면 무작위 이벤트 (경험치 +3 30% · 한 번 더 던지기 15% · 방패 15% · 1칸 앞으로 15% · 1칸 뒤로 15% · 빙결 10%)" },
  lava: { icon: "🔥", name: "용암 칸", desc: "멈추면 경험치 +2. 화산이 폭발하면 이 칸 위 말은 3칸 뒤로" },
  ice: { icon: "🧊", name: "빙판 칸", desc: "멈추면 기본 길로 1칸 더 미끄러짐 (잡기 가능)" },
  frost: { icon: "❄️", name: "빙결 칸", desc: "멈추면 다음 내 차례에 그 말 무리는 못 움직임" },
  heal: { icon: "🌿", name: "회복 칸", desc: "멈추면 빙결·느려짐·혼란이 풀리고 경험치 +2" },
  portal: { icon: "🌀", name: "순간이동 칸", desc: "멈추면 짝이 되는 순간이동 칸으로 이동 (잡기 가능)" },
  sanct: { icon: "🛡", name: "보호 칸", desc: "이 칸 위 말은 잡히지 않고, 함정도 놓을 수 없어요" },
  boost: { icon: "⚡", name: "질풍 칸", desc: "멈추면 다음 이동 +1칸" },
  curse: { icon: "💀", name: "저주 칸", desc: "멈추면 다음 이동 −1칸" },
  fire: { icon: "🔥", name: "불꽃 칸", desc: "불꽃 장승이 만든 칸. 다음 바퀴에 폭발해 위 말이 3칸 뒤로" },
};
export const TRAPS = {
  bomb: { icon: "💣", name: "폭탄 함정", desc: "4칸 뒤로 + 경험치 −2" },
  frost: { icon: "🧊", name: "얼음 함정", desc: "다음 내 차례에 그 말 무리는 못 움직임" },
  back: { icon: "↩️", name: "뒤로 함정", desc: "3칸 뒤로" },
  warp: { icon: "🌀", name: "순간이동 함정", desc: "비어 있는 다른 칸(뒤쪽 절반)으로 날아감" },
  seal: { icon: "🔒", name: "윷 봉인", desc: "그 팀의 다음 차례에는 윷·모가 나와도 한 번 더 던지지 못함" },
  split: { icon: "✂️", name: "말 분리", desc: "업힌 말의 절반이 떨어져 2칸 뒤로" },
  shieldBreak: { icon: "💔", name: "보호막 해제", desc: "그 무리의 보호막·보호가 모두 사라짐" },
  slow: { icon: "🐌", name: "이동 방해", desc: "그 무리의 다음 이동 −2칸 (최소 1칸)" },
  confuse: { icon: "😵", name: "혼란", desc: "그 무리의 다음 이동은 갈림길에서 반대쪽 길로만" },
  chain: { icon: "⛓️", name: "함정 연쇄", desc: "1칸 뒤로 + 이웃 칸 함정이 한꺼번에 터짐 (그 칸 위 말이 맞음, 더 번지지 않음)" },
};
export const EVO = {
  charge: { icon: "⚔️", name: "돌격형", lv2: "도·개로 이동할 때 +1칸", lv3: "앞으로 가는 모든 이동 +1칸" },
  guard: { icon: "🛡️", name: "수호형", lv2: "진화할 때 보호막 1개 (잡기 1번 버팀)", lv3: "보호막 1개 더 + 함정·위험 칸 피해 면역" },
  mobile: { icon: "🏇", name: "기동형", lv2: "지나가는 모서리·방에서도 지름길로 꺾을 수 있음", lv3: "+ 모서리 앞 칸(4·9)에서 바로 지름길로" },
  luck: { icon: "🍀", name: "행운형", lv2: "❓ 이벤트를 두 번 굴려 좋은 쪽", lv3: "❓ 이벤트는 늘 좋은 결과 + 이동할 때 경험치 +1" },
  hinder: { icon: "😈", name: "방해형", lv2: "멈춘 칸 앞 1~2칸의 상대 말: 다음 이동 −1칸", lv3: "+ 그 말들을 1칸 뒤로" },
};
export const ABIL = {
  attack: { icon: "🗡️", name: "공격형", passive: "잡으면 경험치 +2 · 우리 함정의 뒤로 밀기 +1칸", active: "약점 노출: 상대 말 무리의 보호막·보호를 없앰", target: "oppPiece", cd: 4 },
  defense: { icon: "🛡️", name: "방어형", passive: "시작할 때 잡기 1번 막음 · 함정·위험 칸으로 뒤로 밀리는 칸 절반 · 빙결 안 걸림", active: "수호 결계: 내 말 무리 하나를 상대 한 바퀴 동안 보호", target: "myPiece", cd: 4 },
  move: { icon: "💨", name: "이동형", passive: "지름길 칸(대각선)에서 출발하는 이동 +1칸", active: "자리 교환: 우리 말 두 무리 자리 바꾸기", target: "myPiece+myPiece2", cd: 4 },
  luck: { icon: "🍀", name: "행운형", passive: "증강 고르기 새로고침 +1 · ❓ 이벤트를 두 번 굴려 좋은 쪽", active: "재굴림: 던진 결과 하나 다시 던지기 (윷·모 제외)", target: "result", cd: 3 },
  strategy: { icon: "🧠", name: "전략형", passive: "숨긴 함정이 모두 보임 · 상대가 켜 둔 증강이 보임", active: "함정 해체: 고른 칸의 함정이나 위험 칸(용암·빙결·저주·불꽃)을 없앰", target: "anyNode", cd: 3 },
};
export const BOSSES = {
  dokkaebi: { icon: "👹", name: "도깨비 대왕", desc: "도깨비 함정을 깔고, 모서리에 충격파(그 칸과 이웃 칸 말 2칸 뒤로)를 날려요" },
  tiger: { icon: "🐯", name: "얼음 호랑이", desc: "한 줄을 얼려 그 위 말을 묶고, 지름길 하나를 막아요" },
  jangseung: { icon: "🗿", name: "불꽃 장승", desc: "불꽃 칸을 만들고 다음 바퀴에 터뜨려요 (위 말 3칸 뒤로, 방패로 막음)" },
};
export const BOSS_RULE = "6바퀴째에 보스 등장(한 바퀴 전 예고), 3바퀴 동안 바퀴가 끝날 때마다 행동. ⭐ 약점 칸(바퀴마다 3곳)에 말을 멈추면 보스 체력 −1 — 2번(5팀 이상이면 3번) 맞히면 격파! 맞힌 팀은 경험치 +3·다음 차례 '걸' 하나. 보스가 떠나고 6바퀴 뒤 다시 등장. 보스는 말을 집으로 보내거나 완주를 막지 않아요.";

// 확장 증강 40종 (id 는 모두 x_ 로 시작 — 기존 증강과 겹치지 않음)
export const XAUGS = [
  // 일반
  { id: "x_quickFoot", rarity: "common", icon: "🌬️", name: "바람 발걸음", kind: "passive", cond: "특수 칸에서 출발하는 이동", effect: "+1칸", duration: "판 전체 (최대 6번)", cap: 6 },
  { id: "x_safeStart", rarity: "common", icon: "🧷", name: "든든한 출발", kind: "passive", cond: "집에서 새 말이 나올 때", effect: "보호막 1개 (잡기 1번 버팀)", duration: "최대 3번", cap: 3 },
  { id: "x_trapSense", rarity: "common", icon: "🔍", name: "함정 감별사", kind: "passive", cond: "내 말 3칸 안의 함정", effect: "숨긴 함정도 보임 + 함정·위험 칸에 뒤로 밀리는 칸 −1", duration: "판 전체" },
  { id: "x_luckyStick", rarity: "common", icon: "🎐", name: "행운의 윷", kind: "passive", cond: "도가 나오면", effect: "자동으로 한 번 다시 던짐", duration: "최대 3번", cap: 3 },
  { id: "x_xpCollector", rarity: "common", icon: "📿", name: "경험치 수집가", kind: "passive", cond: "말이 경험치를 얻을 때", effect: "경험치 +1 더", duration: "판 전체" },
  { id: "x_smallShield", rarity: "common", icon: "🧱", name: "작은 방패", kind: "passive", cond: "함정·위험 칸·보스 공격을 받을 때", effect: "피해 1번 무효", duration: "2번", cap: 2 },
  { id: "x_shortcutPro", rarity: "common", icon: "🛤️", name: "지름길 전문가", kind: "passive", cond: "지름길 칸(대각선)에서 출발하는 이동", effect: "+1칸", duration: "판 전체 (최대 6번)", cap: 6 },
  { id: "x_dokkaebiGift", rarity: "common", icon: "🎁", name: "도깨비의 선물", kind: "passive", cond: "❓ 이벤트·숲의 정령·보스 보상", effect: "좋은 보상 2배", duration: "판 전체" },
  { id: "x_trainer", rarity: "common", icon: "🐴", name: "말 조련사", kind: "passive", cond: "말 진화", effect: "진화에 필요한 경험치 −2 (2단계 3, 3단계 10)", duration: "판 전체" },
  { id: "x_steady", rarity: "common", icon: "🧭", name: "안정적인 이동", kind: "passive", cond: "느려짐·혼란·빙결", effect: "걸리지 않음", duration: "판 전체" },
  // 희귀
  { id: "x_doubleMove", rarity: "rare", icon: "👣", name: "이중 이동", kind: "active", charges: 1, target: "result", cond: "남은 도·개·걸 결과", effect: "그 결과를 하나 더 받음", duration: "즉시" },
  { id: "x_setTrap", rarity: "rare", icon: "🧨", name: "함정 설치", kind: "active", charges: 2, target: "node+trap", cond: "빈 일반 칸 (출발점·모서리·방·보호 칸 제외)", effect: "고른 칸에 함정 (폭탄·얼음·뒤로·이동 방해·혼란 중 고름)", duration: "5바퀴" },
  { id: "x_teleport", rarity: "rare", icon: "🚪", name: "도깨비 길", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말", effect: "앞쪽 6칸 안의 가장 가까운 특수 칸으로 순간이동 (잡기 가능)", duration: "즉시" },
  { id: "x_clone", rarity: "rare", icon: "🌑", name: "그림자 분신", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말 (분신은 하나만)", effect: "진화 단계까지 똑같은 분신 생성 (상대를 잡을 수 있음, 내 차례 4번 유지, 승리 조건엔 안 셈)", duration: "내 차례 4번" },
  { id: "x_steelShield", rarity: "rare", icon: "🔩", name: "강철 방패", kind: "active", charges: 2, target: "myPiece", cond: "판 위 내 말", effect: "그 무리 말마다 보호막 1개 (잡기 1번 버팀)", duration: "보호막을 쓸 때까지" },
  { id: "x_xpBurst", rarity: "rare", icon: "💫", name: "경험치 폭발", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말", effect: "그 무리 말마다 경험치 +5", duration: "즉시" },
  { id: "x_resultShift", rarity: "rare", icon: "🎚️", name: "윷 결과 변환", kind: "active", charges: 2, target: "result+shift", cond: "남은 도·개·걸·윷 결과", effect: "1 올리거나 내림 (모로는 못 바꿈, 바꾼 윷은 덤 던지기 없음)", duration: "즉시" },
  { id: "x_swap", rarity: "rare", icon: "🔀", name: "자리 바꿈술", kind: "active", charges: 1, target: "myPiece+myPiece2", cond: "판 위 내 말 무리 둘", effect: "두 무리 자리 바꾸기", duration: "즉시" },
  { id: "x_trapReflect", rarity: "rare", icon: "⤴️", name: "함정 반사", kind: "passive", cond: "상대 함정에 걸리면", effect: "효과를 함정 주인의 가장 앞선 말에게 돌려보냄", duration: "2번", cap: 2 },
  { id: "x_teamSupport", rarity: "rare", icon: "🤲", name: "팀 지원", kind: "active", charges: 2, target: "myPiece", cond: "판 위 우리 팀 말", effect: "그 무리를 상대 한 바퀴 동안 보호 (잡히지 않음)", duration: "상대 한 바퀴" },
  // 영웅
  { id: "x_rampage", rarity: "epic", icon: "🐗", name: "폭주 이동", kind: "passive", cond: "상대 말을 잡으면", effect: "그 무리가 바로 1칸 더 감 (또 잡을 수 있음)", duration: "차례마다 1번" },
  { id: "x_perfectDefense", rarity: "epic", icon: "🏯", name: "완벽한 방어", kind: "active", charges: 1, cond: "내 차례", effect: "상대 한 바퀴 동안 우리 모든 말이 잡히지 않고 함정·위험 칸 피해도 없음", duration: "상대 한 바퀴" },
  { id: "x_massTrap", rarity: "epic", icon: "🕸️", name: "대규모 함정", kind: "active", charges: 1, target: "anyNode", cond: "고른 칸 둘레", effect: "고른 칸과 이웃 칸에 뒤로 함정 최대 3개", duration: "5바퀴" },
  { id: "x_evoBoost", rarity: "epic", icon: "🧬", name: "진화 가속", kind: "active", charges: 1, target: "myPiece", cond: "판 위 내 말", effect: "그 무리 말마다 진화 한 단계", duration: "즉시" },
  { id: "x_prank", rarity: "epic", icon: "🎭", name: "도깨비 장난", kind: "active", charges: 2, target: "oppPiece", cond: "판 위 상대 말", effect: "그 무리 다음 이동 −2칸 + 혼란 (보호 중이면 안 됨)", duration: "상대 다음 이동" },
  { id: "x_rebuild", rarity: "epic", icon: "🏗️", name: "윷판 재구성", kind: "active", charges: 1, cond: "내 차례", effect: "특수 칸 배치를 새로 뽑고 상대 함정을 모두 없앰", duration: "즉시" },
  { id: "x_revive", rarity: "epic", icon: "🕯️", name: "말 부활", kind: "active", charges: 1, target: "homePiece", cond: "잡혀서 집에 있는 내 말", effect: "잡혔던 칸으로 돌아옴 (상대 말이 있으면 그 뒤 빈칸)", duration: "즉시" },
  { id: "x_rewind", rarity: "epic", icon: "🧿", name: "되감기 부적", kind: "active", charges: 1, cond: "지난 상대 차례에 밀리거나 잡힌 우리 말", effect: "그 말들을 상대 차례 전 자리로 되돌림 (상대 말이 서 있는 칸은 제외)", duration: "즉시" },
  { id: "x_teamAwaken", rarity: "epic", icon: "📯", name: "팀 각성", kind: "active", charges: 1, cond: "내 차례", effect: "팀 능력 재사용 대기 즉시 끝 + 판 위 우리 말 경험치 +2", duration: "즉시" },
  { id: "x_fateFan", rarity: "epic", icon: "🔮", name: "점쟁이의 부채", kind: "arm", charges: 2, cond: "켜 두면", effect: "다음에 내 말이 받는 ❓ 이벤트는 가장 좋은 결과 (한 번 더 던지기 + 경험치 +3)", duration: "다음 이벤트 1번" },
  // 전설
  { id: "x_yutGod", rarity: "legendary", icon: "🎋", name: "윷놀이의 신", kind: "passive", cond: "앞으로 가는 모든 이동", effect: "+1칸 (도는 +2칸)", duration: "판 전체" },
  { id: "x_guardian", rarity: "legendary", icon: "🗿", name: "수호신 장승", kind: "passive", cond: "우리 말이 잡히거나 함정·위험 칸 피해를 받을 때", effect: "잡기 2번 무효 + 피해 2번 무효", duration: "각 2번" },
  { id: "x_summon", rarity: "legendary", icon: "👺", name: "도깨비 소환", kind: "active", charges: 1, cond: "판 위 상대 말", effect: "상대 팀마다 가장 앞선 무리 바로 앞 칸에 내 폭탄 함정", duration: "5바퀴" },
  { id: "x_reversal", rarity: "legendary", icon: "♻️", name: "운명 역전", kind: "passive", cond: "우리 남은 거리 합이 1등보다 10칸 이상 많을 때", effect: "모든 이동 +2칸 + 얻는 경험치 2배", duration: "조건 동안" },
  { id: "x_portalGate", rarity: "legendary", icon: "🌌", name: "차원문", kind: "active", charges: 1, target: "myPiece+zone", cond: "판 위 내 말", effect: "그 무리를 지름길 칸(대각선) 아무 곳으로 순간이동 (잡기 가능)", duration: "즉시" },
  { id: "x_goldStick", rarity: "legendary", icon: "💰", name: "금빛 윷가락", kind: "passive", cond: "윷·모가 나오면", effect: "그 차례 모든 이동 +1칸 + 경험치 +1", duration: "최대 3번", cap: 3 },
  { id: "x_legion", rarity: "legendary", icon: "🐎", name: "말의 군단", kind: "active", charges: 1, cond: "집에 있는 내 말", effect: "집 말 최대 2개를 개 자리(2)로 바로 출동 (잡기 가능)", duration: "즉시" },
  { id: "x_chaos", rarity: "legendary", icon: "🌪️", name: "대혼돈", kind: "active", charges: 1, cond: "내 차례", effect: "특수 칸을 혼돈 배치로 다시 깔고, 모든 함정을 없애고, 상대 말 무리 둘을 1칸 뒤로", duration: "즉시" },
  { id: "x_miracle", rarity: "legendary", icon: "🌠", name: "최후의 기적", kind: "passive", cond: "상대가 말 하나만 남기고 완주 5칸 안에 올 때 (그 상대 차례가 끝나면)", effect: "그 말을 3칸 뒤로 + 다음 내 차례에 '걸' 하나", duration: "1번", cap: 1 },
  { id: "x_overlord", rarity: "legendary", icon: "👑", name: "윷판 지배자", kind: "passive", cond: "특수 칸에 멈출 때", effect: "좋은 효과 2배, 나쁜 효과(빙결·저주·용암 폭발) 무시 + 이동할 때 경험치 +1", duration: "판 전체" },
];
export const XAUG = Object.fromEntries(XAUGS.map(a => [a.id, { stack: false, charges: null, cap: null, target: null, exp: true, ...a, desc: `${a.cond} → ${a.effect}` }]));
for (const a of XAUGS) Object.assign(a, XAUG[a.id]);
// 기존 증강과 같이 가질 수 없는 짝 (비슷한 효과가 겹쳐 너무 세지는 것 방지)
export const EXCLUSIVE = [["quickStep", "x_quickFoot"], ["safeStart", "x_safeStart"], ["teleport", "x_teleport"], ["clone", "x_clone"], ["timeRewind", "x_rewind"], ["fateChoice", "x_fateFan"], ["absoluteDefense", "x_guardian"], ["dimension", "x_portalGate"], ["spaceRule", "x_portalGate"], ["goldenYut", "x_goldStick"], ["comeback", "x_reversal"], ["finalDash", "x_reversal"]];
export function blockedBy(owned) { const s = new Set(); for (const [a, b] of EXCLUSIVE) { if (owned.includes(a)) s.add(b); if (owned.includes(b)) s.add(a); } return [...s]; }

// 이벤트 표 (❓) — 확률 %
const EVENT_TABLE = [["xp", 30], ["throw", 15], ["shield", 15], ["fwd", 15], ["back", 15], ["freeze", 10]];
const GOOD_RANK = { throw: 6, xp: 5, shield: 4, fwd: 3, back: 1, freeze: 0 };

export class Expansion {
  constructor(g, opts = {}) {
    this.g = g;
    const mapKeys = Object.keys(MAPS);
    const map = mapKeys.includes(opts.map) ? opts.map : mapKeys[Math.floor(g.rng() * mapKeys.length)];
    this.st = {
      map, tiles: {}, portal: null, traps: [], trapSeq: 0, hidden: opts.traps === "hidden",
      boss: null, nextBoss: 6, bossCount: 0, eruptAt: 3, closed: [], gate: false, spirit: null, chaosMsg: null,
      abil: {}, sealed: {}, perfect: {}, hsh: {}, pre: null, turnBonus: 0, rampUsed: false, gold: 0, lastFx: null,
    };
    this.depth = 0;
  }
  // ---------------- 기본 ----------------
  get rng() { return this._rng || this.g.rng; } // 시험에서 _rng 로 따로 줄 수 있음
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  emit(type, d) { this.g.emit("x", { k: type, ...d }); }
  teamHas(team, id) { return this.g.teamHas(team, id); }
  ownerOf(team, id) { for (const p of this.g.players.values()) if (p.team === team && p.augs.some(a => a.id === id)) return p; return null; }
  abilityOf(team) { return this.st.abil[team]?.id || null; }
  snapshot() { return clone(this.st); }
  restore(s) { this.st = s; }
  piecesAt(node) { return this.g.pieces.filter(p => p.pos === node); }
  lvNeed(team, lv) { const t = this.teamHas(team, "x_trainer") ? 2 : 0; return XP_LV[lv - 1] - t; }

  onStart() { this.layTiles(this.st.map); this.emit("map", { map: this.st.map }); }
  layTiles(kind) {
    const st = this.st; st.tiles = {}; st.portal = null;
    const free = this.shuffle(SPOTS);
    const put = (type, n) => { for (let i = 0; i < n && free.length; i++) st.tiles[free.shift()] = type; };
    if (kind === "classic") put("q", 4);
    else if (kind === "volcano") { put("lava", 5); put("q", 2); }
    else if (kind === "ice") { put("ice", 5); put("frost", 2); put("heal", 1); }
    else if (kind === "forest") {
      put("heal", 2); put("sanct", 2);
      // 순간이동 한 쌍: 앞쪽(바깥 1~9) ↔ 뒤쪽(바깥 11~19)
      const a = free.find(n => n < 10), b = free.find(n => n > 10 && n < 20);
      if (a && b) { st.tiles[a] = "portal"; st.tiles[b] = "portal"; st.portal = [a, b]; free.splice(free.indexOf(a), 1); free.splice(free.indexOf(b), 1); }
    } else { // chaos
      for (let i = 0; i < 6 && free.length; i++) st.tiles[free.shift()] = this.pick(["q", "q", "ice", "heal", "boost", "curse", "lava"]);
    }
    // 함정이 있는 칸·보호 칸 정리
    st.traps = st.traps.filter(t => st.tiles[t.node] !== "sanct");
  }

  // ---------------- 고르기 ----------------
  setAbility(uid, id) {
    const p = this.g.players.get(uid);
    if (!p || !ABIL[id]) return { ok: false, error: "BAD_ABILITY" };
    if (this.st.abil[p.team]) return { ok: false, error: "ABILITY_SET" };
    this.st.abil[p.team] = { id, cd: 0, by: uid };
    if (id === "defense") this.g.teams[p.team].defense += 1;
    if (id === "luck") for (const q of this.g.players.values()) if (q.team === p.team) q.refresh += 1;
    this.emit("ability", { team: p.team, uid, id });
    return { ok: true };
  }
  needAbility(uid) { const p = this.g.players.get(uid); return p && !this.st.abil[p.team] && this.g.teams[p.team].members[0] === uid; }
  /** 팀 능력 자동 (onlyTeam 을 주면 그 팀만 — 봇이 먼저 골라도 사람 팀 능력은 대신 정하지 않음) */
  autoAbilities(onlyTeam = null) {
    const pref = ["attack", "luck", "move", "defense", "strategy"];
    for (const t of this.g.teams) if (!this.st.abil[t.id] && (onlyTeam === null || t.id === onlyTeam)) this.setAbility(t.members[0], this.pick(pref));
  }
  onPick(p, id) {
    if (id === "x_guardian") { this.g.teams[p.team].defense += 2; this.addHsh(p.team, 2); }
    if (id === "x_smallShield") this.addHsh(p.team, 2);
  }
  addHsh(team, n) { this.st.hsh[team] = (this.st.hsh[team] || 0) + n; }

  // ---------------- 차례 ----------------
  onTurnStart(team) {
    const st = this.st;
    st.turnBonus = 0; st.rampUsed = false; st.gold = 0;
    st.prevPre = st.pre || null;
    // 빙결: 이 팀 차례 시작에 묶음 (차례 끝에 엔진이 blocked 풀어 줌)
    for (const pc of this.g.pieces) { if (pc.team === team) pc.xpTurn = 0; if (pc.team === team && pc.frozen > 0 && pc.pos !== HOME && pc.pos !== DONE) { pc.blocked = true; pc.frozen--; } }
    // 되감기 부적용: 이 차례 시작 자리 (다음 팀이 되감을 수 있게)
    st.pre = { team, turnNo: this.g.turnNo, pos: Object.fromEntries(this.g.pieces.filter(p => !p.clone).map(p => [p.id, { pos: p.pos, hist: p.hist.slice() }])) };
  }
  onTurnEnd(team) {
    const st = this.st;
    // 진화 고르기를 안 했으면 자동
    for (const pc of this.g.pieces) if (pc.team === team && pc.evoPick) this.autoEvo(pc);
    // 상대 한 바퀴짜리 효과 줄이기
    for (const t of Object.keys(st.perfect)) if (+t !== team && st.perfect[t] > 0) st.perfect[t]--;
    if (st.sealed[team] !== undefined && st.sealed[team] <= this.g.teams[team].turns) delete st.sealed[team];
    // 최후의 기적: 방금 차례를 마친 팀이 거의 다 왔으면
    const real = this.g.pieces.filter(p => p.team === team && !p.clone);
    const left = real.filter(p => p.pos !== DONE);
    if (real.length > 1 && left.length === 1) {
      const pc = left[0];
      if (pc.pos !== HOME && distLeft(pc.pos, this.g.prevOf(pc)) <= 5) {
        for (const p of this.g.players.values()) {
          if (p.team === team || !p.augs.some(a => a.id === "x_miracle") || !this.g.capLeft(p, "x_miracle", 1)) continue;
          this.g.capUse(p, "x_miracle");
          this.pushBack(this.g.groupOf(pc), 3, "miracle");
          this.g.teams[p.team].reserve.push(3);
          this.g.impact(p, "x_miracle", 8);
          this.emit("miracle", { uid: p.id, piece: pc.id });
          break;
        }
      }
    }
  }
  /** 바퀴가 끝날 때 (팀 순서가 처음으로 돌아올 때). round 는 새 바퀴 번호 */
  onRoundEnd(round) {
    const st = this.st;
    for (const t of st.traps) t.ttl--;
    const gone = st.traps.filter(t => t.ttl <= 0); st.traps = st.traps.filter(t => t.ttl > 0);
    if (gone.length) this.emit("trapsExpire", { nodes: gone.map(t => t.node) });
    for (const a of Object.values(st.abil)) if (a.cd > 0) a.cd--;
    if (st.spirit != null && round % 4 === 2) st.spirit = null; // 정령은 두 바퀴 머묾
    // 맵 사건
    const m = st.map;
    if (m === "classic" && round % 3 === 1) { this.layTiles("classic"); this.emit("reshuffle", { map: m }); }
    if (m === "volcano") {
      if (round === st.eruptAt - 1) this.emit("warn", { what: "erupt", nodes: Object.keys(st.tiles).filter(n => st.tiles[n] === "lava").map(Number) });
      if (round === st.eruptAt) { st.eruptAt += 3; this.explode(Object.keys(st.tiles).filter(n => st.tiles[n] === "lava").map(Number), 3, "erupt"); }
    }
    if (m === "forest" && round % 4 === 0) {
      const free = SPOTS.filter(n => !this.piecesAt(n).length && !st.tiles[n]);
      if (free.length) { st.spirit = this.pick(free); this.emit("spirit", { node: st.spirit }); }
    }
    if (m === "chaos") {
      this.layTiles("chaos");
      st.gate = this.rng() < 0.35; st.closed = !st.gate && this.rng() < 0.4 ? [this.pick([20, 25])] : [];
      // 무작위 축복·저주 한 팀
      const t = this.pick(this.g.teams).id, good = this.rng() < 0.5;
      const grp = this.leadGroup(t);
      if (grp) { if (good) { for (const p of grp) p.boost = 1; } else if (!this.immune(grp, "slow")) { for (const p of grp) p.slow = Math.max(p.slow || 0, 1); } }
      st.chaosMsg = { team: t, good, gate: st.gate, closed: st.closed };
      this.emit("chaos", st.chaosMsg);
    } else if (!st.boss || st.boss.type !== "tiger") st.closed = [];
    this.bossTick(round);
  }

  // ---------------- 보스 ----------------
  bossTick(round) {
    const st = this.st, b = st.boss;
    if (!b) {
      if (round === st.nextBoss - 1) this.emit("bossWarn", { boss: this.bossTypeNext() });
      if (round === st.nextBoss) {
        const type = this.bossTypeNext();
        const hp = this.g.teams.length > 4 ? 3 : 2;
        st.boss = { type, hp, maxHp: hp, act: 0, weak: [], plan: null, hits: {}, fire: [] };
        st.bossCount++;
        this.newWeak(); this.planBoss();
        this.emit("bossAppear", { boss: type, hp });
      }
      return;
    }
    // 행동
    this.doBoss();
    b.act++;
    if (b.act >= 3) this.bossLeave(false);
    else { this.newWeak(); this.planBoss(); }
  }
  bossTypeNext() {
    const st = this.st;
    if (!st.nextType) st.nextType = st.map === "volcano" ? "jangseung" : st.map === "ice" ? "tiger" : st.map === "chaos" ? this.pick(Object.keys(BOSSES)) : st.bossCount % 2 ? this.pick(["tiger", "jangseung"]) : "dokkaebi";
    return st.nextType;
  }
  newWeak() {
    const b = this.st.boss; const occ = new Set(this.g.pieces.map(p => p.pos));
    const cands = this.shuffle(SPOTS.filter(n => !occ.has(n) && this.st.tiles[n] !== "portal"));
    b.weak = cands.slice(0, 3);
  }
  planBoss() {
    const b = this.st.boss;
    if (b.type === "dokkaebi") b.plan = b.act === 1 ? { kind: "shock", node: this.pick([5, 10, 15]) } : { kind: "traps" };
    else if (b.type === "tiger") { const sides = [[1, 2, 3, 4], [6, 7, 8, 9], [11, 12, 13, 14], [16, 17, 18, 19]]; b.plan = { kind: "freeze", nodes: this.pick(sides), close: this.pick([20, 25]) }; }
    else { // 장승: 0번째 행동은 불꽃 깔기만, 그 뒤엔 터뜨리고 새로 깔기
      b.plan = { kind: b.act === 0 ? "fireLay" : b.act === 2 ? "fireBlast" : "fireBoth", nodes: this.shuffle(SPOTS).slice(0, 4) };
    }
    this.emit("bossPlan", { plan: b.plan });
  }
  doBoss() {
    const st = this.st, b = st.boss, p = b.plan; if (!p) return;
    if (b.type === "dokkaebi") {
      if (p.kind === "traps") {
        const kinds = ["back", "confuse", "warp", "slow"];
        const free = this.shuffle(SPOTS.filter(n => !st.traps.some(t => t.node === n) && st.tiles[n] !== "sanct"));
        for (let i = 0; i < 3 && free.length; i++) this.addTrap(free.shift(), this.pick(kinds), -1);
        this.emit("bossAct", { boss: b.type, kind: "traps" });
      } else {
        const nodes = [p.node, ...(NEIGH[p.node] || [])];
        this.emit("bossAct", { boss: b.type, kind: "shock", nodes });
        this.explode(nodes, 2, "shock");
      }
    } else if (b.type === "tiger") {
      st.closed = [p.close];
      this.emit("bossAct", { boss: b.type, kind: "freeze", nodes: p.nodes, close: p.close });
      for (const grp of this.groupsOn(p.nodes)) if (!this.hazardBlocked(grp, "freeze")) { for (const x of grp) x.frozen = Math.max(x.frozen || 0, 1); this.emit("hit", { pieces: grp.map(x => x.id), what: "freeze", node: grp[0].pos }); }
    } else {
      if (p.kind !== "fireLay") { const nodes = Object.keys(st.tiles).filter(n => st.tiles[n] === "fire").map(Number); this.emit("bossAct", { boss: b.type, kind: "blast", nodes }); this.explode(nodes, 3, "blast"); for (const n of nodes) delete st.tiles[n]; }
      if (p.kind !== "fireBlast") { for (const n of p.nodes) if (!st.tiles[n] || st.tiles[n] === "q") st.tiles[n] = "fire"; this.emit("bossAct", { boss: b.type, kind: "fire", nodes: p.nodes }); }
    }
  }
  bossLeave(defeated) {
    const st = this.st, b = st.boss; if (!b) return;
    for (const n of Object.keys(st.tiles)) if (st.tiles[n] === "fire") delete st.tiles[n];
    if (b.type === "tiger") st.closed = [];
    st.traps = st.traps.filter(t => t.owner !== -1);
    if (defeated) {
      for (const [team, hits] of Object.entries(b.hits)) {
        const t = +team, gift = this.teamHas(t, "x_dokkaebiGift") ? 2 : 1;
        for (const pc of this.g.pieces) if (pc.team === t && pc.pos !== HOME && pc.pos !== DONE) this.gainXp(pc, 3 * gift, true);
        for (let i = 0; i < gift; i++) this.g.teams[t].reserve.push(3);
        void hits;
      }
    }
    this.emit("bossLeave", { boss: b.type, defeated, hits: b.hits });
    st.boss = null; st.nextBoss = this.g.round + 6; st.nextType = null;
  }
  hitBoss(team, node, pieces) {
    const b = this.st.boss; if (!b || !b.weak.includes(node)) return;
    b.weak = b.weak.filter(n => n !== node); b.hp--;
    b.hits[team] = (b.hits[team] || 0) + 1;
    for (const p of pieces) this.gainXp(p, 2);
    this.emit("bossHit", { team, node, hp: b.hp });
    if (b.hp <= 0) this.bossLeave(true);
  }

  // ---------------- 함정 ----------------
  trapOk(node) { return SPOTS.includes(node) && this.st.tiles[node] !== "sanct" && !this.st.traps.some(t => t.node === node); }
  addTrap(node, type, owner) {
    const st = this.st;
    if (!this.trapOk(node) || !TRAPS[type]) return false;
    if (owner >= 0) { const mine = st.traps.filter(t => t.owner === owner); if (mine.length >= TEAM_TRAPS) st.traps.splice(st.traps.indexOf(mine[0]), 1); }
    if (st.traps.length >= MAX_TRAPS) { const old = st.traps.findIndex(t => t.owner !== -1); st.traps.splice(old >= 0 ? old : 0, 1); }
    st.traps.push({ id: ++st.trapSeq, node, type, owner, ttl: TRAP_TTL, seen: owner === -1 || !st.hidden });
    this.emit("trap", { node, trap: type, owner, hidden: owner !== -1 && st.hidden });
    return true;
  }

  // ---------------- 보호·피해 ----------------
  /** 이 무리가 해로운 효과를 피하나 (피하면 소모되는 것도 처리) */
  hazardBlocked(grp, what) {
    if (!grp.length) return true;
    const team = grp[0].team;
    if ((this.st.perfect[team] || 0) > 0) { this.emit("blocked", { node: grp[0].pos, why: "perfect" }); return true; }
    if (grp.some(p => p.evo === "guard" && p.lv >= 3)) { this.emit("blocked", { node: grp[0].pos, why: "evo" }); return true; }
    if (this.st.tiles[grp[0].pos] === "sanct" && grp[0].pos !== HOME) { this.emit("blocked", { node: grp[0].pos, why: "sanct" }); return true; }
    if (["slow", "confuse", "freeze"].includes(what) && this.teamHas(team, "x_steady")) { this.emit("blocked", { node: grp[0].pos, why: "steady" }); return true; }
    if (what === "freeze" && this.abilityOf(team) === "defense") { this.emit("blocked", { node: grp[0].pos, why: "defense" }); return true; }
    if ((this.st.hsh[team] || 0) > 0) { this.st.hsh[team]--; const who = this.ownerOf(team, "x_guardian") ? "x_guardian" : "x_smallShield"; const o = this.ownerOf(team, who); if (o) this.g.impact(o, who, 4); this.emit("blocked", { node: grp[0].pos, why: "shield" }); return true; }
    return false;
  }
  immune(grp, what) { return this.hazardBlocked(grp, what); }
  backAmount(team, k, ownerTeam = -1) {
    let n = k;
    if (ownerTeam >= 0 && this.abilityOf(ownerTeam) === "attack") n += 1;
    if (this.abilityOf(team) === "defense") n = Math.max(1, Math.floor(n / 2));
    if (this.teamHas(team, "x_trapSense")) n = Math.max(1, n - 1);
    return n;
  }
  /** 무리를 k칸 뒤로 (출발 칸 1보다 더 뒤로는 안 감 — 참먹이로 밀려 바로 완주하는 것 방지). 잡기 없음 */
  pushBack(grp, k, why) {
    if (!grp.length) return;
    const from = grp[0].pos; if (from === HOME || from === DONE) return;
    const lead = grp[0];
    let to = from, n = 0;
    for (; n < k; n++) { if (lead.hist.length <= 1) break; to = lead.hist[lead.hist.length - 1]; for (const x of grp) x.hist.pop(); }
    if (to === from) return;
    for (const x of grp) x.pos = to;
    for (const p of this.g.pieces) if (p.team === lead.team && p.pos === to && !grp.includes(p) && !!p.clone === !!lead.clone) p.hist = lead.hist.slice();
    this.g.emit("move", { uid: null, team: lead.team, pieces: grp.map(x => x.id), from, to, steps: [to], back: true, captured: 0, blocked: 0, pushed: true, why });
  }
  canonHist(node) {
    // 출발점에서 node 까지 가장 짧은 길 (모서리·방에서 꺾기 허용) — 순간이동한 말의 '지나온 길'
    if (node === 1) return [0];
    const q = [[1, 0, [0, 1]]]; const seen = new Set(); // 0(참먹이)에서는 완주로만 가므로 1번 칸부터
    while (q.length) {
      const [n, pv, path] = q.shift();
      if (n === node && path.length > 1) return path.slice(0, -1);
      const k = n + ":" + pv; if (seen.has(k)) continue; seen.add(k);
      for (const nx of nextOptions(n, pv, true, { passTurn: true })) if (nx !== DONE) q.push([nx, n, [...path, nx]]);
    }
    return [0];
  }
  /** 무리를 node 로 순간이동 (capture=true 면 잡기 가능) */
  teleport(me, grp, node, capture = true) {
    const from = grp[0].pos;
    if (!capture && this.g.pieces.some(p => p.team !== grp[0].team && p.pos === node)) return false;
    this.g.relocate(me, grp, node, [node], false);
    const h = this.canonHist(node);
    for (const p of this.g.pieces) if (p.team === grp[0].team && p.pos === node) p.hist = h.slice();
    void from;
    return true;
  }
  forward(me, grp, k) {
    const lead = grp[0];
    const path = forwardPaths(lead.pos, this.g.prevOf(lead), k).filter(p => !this.closedPath(lead, p))[0];
    if (!path) return;
    this.g.relocate(me, grp, path.to, path.steps, false);
  }
  explode(nodes, k, why) {
    for (const grp of this.groupsOn(nodes)) {
      const own = this.ownerOf(grp[0].team, "x_overlord");
      if (own && why === "erupt") { this.emit("blocked", { node: grp[0].pos, why: "overlord" }); continue; }
      if (this.hazardBlocked(grp, "back")) continue;
      this.emit("hit", { pieces: grp.map(x => x.id), what: why, node: grp[0].pos });
      this.pushBack(grp, this.backAmount(grp[0].team, k), why);
    }
  }
  groupsOn(nodes) {
    const out = [], seen = new Set();
    for (const p of this.g.pieces) {
      if (!nodes.includes(p.pos) || p.pos === HOME || p.pos === DONE) continue;
      const k = p.team + ":" + p.pos + ":" + !!p.clone; if (seen.has(k)) continue; seen.add(k);
      out.push(this.g.groupOf(p));
    }
    return out;
  }
  leadGroup(team) {
    const on = this.g.pieces.filter(p => p.team === team && p.pos !== HOME && p.pos !== DONE && !p.clone);
    if (!on.length) return null;
    on.sort((a, b) => distLeft(a.pos, this.g.prevOf(a)) - distLeft(b.pos, this.g.prevOf(b)));
    return this.g.groupOf(on[0]);
  }

  // ---------------- 경험치·진화 ----------------
  gainXp(pc, n, bypass = false) {
    if (!pc) return;
    if (pc.pos === HOME || pc.pos === DONE) return;
    if ((pc.lv || 1) >= 3) return;
    let v = n;
    if (v > 0 && this.teamHas(pc.team, "x_xpCollector")) v += 1;
    if (v > 0 && this.teamHas(pc.team, "x_reversal") && this.g.isBehind(pc.team, 10)) v *= 2;
    if (!bypass && v > 0) { v = Math.min(v, XP_TURN_CAP - (pc.xpTurn || 0)); if (v <= 0) return; pc.xpTurn = (pc.xpTurn || 0) + v; }
    pc.xp = Math.max(0, (pc.xp || 0) + v);
    pc.lv = pc.lv || 1;
    while (pc.lv < 3 && pc.xp >= this.lvNeed(pc.team, pc.lv + 1)) this.levelUp(pc);
    if (pc.lv >= 3) pc.xp = Math.max(pc.xp, this.lvNeed(pc.team, 3));
  }
  levelUp(pc) {
    pc.lv = (pc.lv || 1) + 1;
    if (pc.lv === 2 && !pc.evo) pc.evoPick = true;
    if (pc.evo === "guard") pc.shield = (pc.shield || 0) + 1;
    this.emit("evolve", { piece: pc.id, lv: pc.lv, evo: pc.evo || null, node: pc.pos });
  }
  chooseEvo(uid, pieceId, type) {
    const p = this.g.players.get(uid), pc = this.g.pieces.find(x => x.id === pieceId);
    if (!p || !pc || pc.team !== p.team) return { ok: false, error: "BAD_PIECE" };
    if (!pc.evoPick) return { ok: false, error: "NO_EVO" };
    if (!EVO[type]) return { ok: false, error: "BAD_EVO" };
    pc.evo = type; pc.evoPick = false;
    if (type === "guard") pc.shield = (pc.shield || 0) + (pc.lv >= 3 ? 2 : 1);
    this.emit("evoChosen", { piece: pc.id, evo: type, uid });
    return { ok: true };
  }
  autoEvo(pc) {
    const order = ["charge", "guard", "mobile", "hinder", "luck"];
    const type = order[(pc.id.charCodeAt(pc.id.length - 1) + this.g.turnNo) % order.length];
    pc.evo = type; pc.evoPick = false;
    if (type === "guard") pc.shield = (pc.shield || 0) + (pc.lv >= 3 ? 2 : 1);
    this.emit("evoChosen", { piece: pc.id, evo: type, auto: true });
  }
  /** 잡힌 말: 한 단계 내려감 (최소 1), 경험치는 그 단계 바닥 */
  onCapturedPiece(v) {
    const lv = Math.max(1, (v.lv || 1) - 1);
    v.lv = lv; v.xp = lv === 1 ? 0 : this.lvNeed(v.team, lv);
    if (lv < 2) { v.evo = null; v.evoPick = false; }
    v.frozen = 0; v.slow = 0; v.confused = 0; v.boost = 0;
  }
  onCapture(me, attackers, victims) {
    const team = attackers[0]?.team;
    const bonus = this.abilityOf(team) === "attack" ? 2 : 0;
    for (const a of attackers) this.gainXp(a, 3 + bonus);
    for (const v of victims) if (!v.clone) this.onCapturedPiece(v);
    // 폭주 이동
    if (me && this.g.hasAug(me, "x_rampage") && !this.st.rampUsed && this.g.cur?.team === team && this.depth < MAX_CHAIN) {
      this.st.rampUsed = true; this.depth++;
      this.emit("rampage", { uid: me.id });
      this.g.impact(me, "x_rampage", 3);
      this.forward(me, attackers, 1);
    }
  }
  captureImmune(victims, atkTeam) {
    const vt = victims[0].team;
    if ((this.st.perfect[vt] || 0) > 0) return "perfect";
    if (this.st.tiles[victims[0].pos] === "sanct") return "sanct";
    void atkTeam; return null;
  }
  onEnterFromHome(pc) {
    const own = this.ownerOf(pc.team, "x_safeStart");
    if (own && this.g.capLeft(own, "x_safeStart", 3)) { this.g.capUse(own, "x_safeStart"); pc.shield = (pc.shield || 0) + 1; this.g.emit("fx", { kind: "shield", piece: pc.id }); }
  }

  // ---------------- 이동 계산 ----------------
  pathFlags(pc, me) {
    const grp = this.g.groupOf(pc);
    const f = {};
    const mob = Math.max(0, ...grp.map(p => p.evo === "mobile" ? p.lv || 1 : 0));
    if (mob >= 2) f.passTurn = true;
    if (mob >= 3 || this.st.gate) f.gate15 = true;
    void me; return f;
  }
  closedPath(pc, path) {
    for (const c of this.st.closed) {
      const zone = c === 20 ? [20, 21] : [25, 26];
      if (path.steps.includes(c) && !zone.includes(pc.pos)) return true;
    }
    return false;
  }
  filterPaths(pc, paths) {
    let out = paths.filter(p => !this.closedPath(pc, p));
    if (!out.length) out = paths.slice(-1);
    if (this.g.groupOf(pc).some(p => p.confused) && out.length > 1) out = out.slice(-1);
    return out;
  }
  bonus(pc, r, me, group, n, notes) {
    if (r < 1 || !me) return { n, notes };
    const team = pc.team;
    let add = 0;
    const lvOf = (type) => Math.max(0, ...group.map(p => p.evo === type ? p.lv || 1 : 0));
    const ch = lvOf("charge");
    if ((ch >= 2 && r <= 2) || ch >= 3) { add++; notes.push("evo_charge"); }
    if (group.some(p => p.boost > 0)) { add++; notes.push("boost"); }
    if (pc.pos !== HOME && this.st.tiles[pc.pos] && this.g.hasAug(me, "x_quickFoot") && this.g.capLeft(me, "x_quickFoot", 6)) { add++; notes.push("x_quickFoot"); }
    const onDiag = DIAG.includes(pc.pos);
    if (onDiag && this.g.hasAug(me, "x_shortcutPro") && this.g.capLeft(me, "x_shortcutPro", 6)) { add++; notes.push("x_shortcutPro"); }
    if (onDiag && this.abilityOf(team) === "move") { add++; notes.push("ab_move"); }
    if (this.g.hasAug(me, "x_yutGod")) { add += r === 1 ? 2 : 1; notes.push("x_yutGod"); }
    if (this.st.gold > 0) { add++; notes.push("x_goldStick"); }
    if (this.g.hasAug(me, "x_reversal") && this.g.isBehind(team, 10)) { add += 2; notes.push("x_reversal"); }
    let total = n + add;
    const slow = Math.max(0, ...group.map(p => p.slow || 0));
    if (slow) { total = Math.max(1, total - slow); notes.push("slow"); }
    return { n: Math.max(1, Math.min(MAX_STEPS, total)), notes };
  }

  // ---------------- 이동 뒤 ----------------
  afterMove(me, group, path, pr) {
    // 다음 이동 1번짜리 효과 소모
    for (const p of group) { p.slow = 0; p.confused = 0; p.boost = 0; }
    for (const nt of path.notes || []) if (nt === "x_quickFoot" || nt === "x_shortcutPro") { this.g.capUse(me, nt); this.g.impact(me, nt, 1); }
    if (group[0].pos === DONE) return;
    // 이동 경험치
    for (const p of group) {
      let v = 1;
      if (p.evo === "luck" && p.lv >= 3) v++;
      if (this.teamHas(p.team, "x_overlord")) v++;
      if (this.st.gold > 0) v++;
      this.gainXp(p, v);
    }
    void pr;
    this.depth = 0;
    this.land(me, group);
  }
  /** 무리가 멈춘 칸의 효과 (연쇄 최대 3번) */
  land(me, group) {
    const lead = group[0];
    if (!lead || lead.pos === HOME || lead.pos === DONE) return;
    const st = this.st, node = lead.pos, team = lead.team;
    // 보스 약점
    if (st.boss?.weak.includes(node)) this.hitBoss(team, node, group);
    // 숲의 정령
    if (st.spirit === node) {
      st.spirit = null;
      const gift = this.teamHas(team, "x_dokkaebiGift") ? 2 : 1;
      for (const p of group) { this.gainXp(p, 4 * gift, true); p.shield = (p.shield || 0) + 1; }
      if (this.g.cur?.team === team && st.turnBonus < 1) { st.turnBonus++; this.g.cur.throws++; }
      this.emit("spiritGet", { team, node });
    }
    if (this.depth >= MAX_CHAIN) return;
    // 함정
    const trap = st.traps.find(t => t.node === node && t.owner !== team);
    if (trap) {
      st.traps.splice(st.traps.indexOf(trap), 1);
      this.depth++;
      if (this.reflect(trap, group)) return;
      this.triggerTrap(trap, group, me);
      const g2 = this.g.groupOf(group[0]);
      if (g2[0].pos !== node && g2[0].pos !== DONE && g2[0].pos !== HOME) return this.land(me, g2);
      return;
    }
    // 특수 칸
    const tile = st.tiles[node]; if (!tile) return;
    const over = this.teamHas(team, "x_overlord");
    const gift = (this.teamHas(team, "x_dokkaebiGift") ? 2 : 1) * (over ? 2 : 1);
    if (tile === "q") { this.depth++; return this.event(me, group, gift); }
    if (tile === "lava") { for (const p of group) this.gainXp(p, 2 * (over ? 2 : 1)); this.emit("tile", { tile, node, team }); return; }
    if (tile === "heal") { for (const p of group) { p.frozen = 0; p.slow = 0; p.confused = 0; this.gainXp(p, 2 * (over ? 2 : 1)); } this.emit("tile", { tile, node, team }); return; }
    if (tile === "boost") { for (const p of group) p.boost = 1; this.emit("tile", { tile, node, team }); return; }
    if (tile === "curse") { if (!over && !this.hazardBlocked(group, "slow")) { for (const p of group) p.slow = Math.max(p.slow || 0, 1); this.emit("tile", { tile, node, team }); } return; }
    if (tile === "frost") { if (!over && !this.hazardBlocked(group, "freeze")) { for (const p of group) p.frozen = Math.max(p.frozen || 0, 1); this.emit("tile", { tile, node, team }); } return; }
    if (tile === "ice") {
      this.depth++; this.emit("tile", { tile, node, team });
      this.forward(me, group, over ? 2 : 1);
      const g2 = this.g.groupOf(group[0]); if (g2[0].pos !== node) this.land(me, g2);
      return;
    }
    if (tile === "portal" && st.portal) {
      const dest = st.portal[0] === node ? st.portal[1] : st.portal[0];
      this.depth++; this.emit("tile", { tile, node, team, to: dest });
      this.teleport(me, group, dest, true);
      // 순간이동해 도착한 칸은 다시 순간이동하지 않음 (함정·약점만)
      const g2 = this.g.groupOf(group[0]);
      if (st.boss?.weak.includes(dest)) this.hitBoss(team, dest, g2);
      return;
    }
  }
  reflect(trap, group) {
    const team = group[0].team;
    if (trap.owner < 0) return false;
    const own = this.ownerOf(team, "x_trapReflect");
    if (!own || !this.g.capLeft(own, "x_trapReflect", 2)) return false;
    this.g.capUse(own, "x_trapReflect"); this.g.impact(own, "x_trapReflect", 4);
    const tgt = this.leadGroup(trap.owner);
    this.emit("reflect", { uid: own.id, trap: trap.type, node: trap.node, to: tgt ? tgt[0].pos : null });
    if (tgt) this.applyTrap(trap.type, tgt, -1, null);
    return true;
  }
  triggerTrap(trap, group, me) {
    this.emit("trapHit", { node: trap.node, trap: trap.type, owner: trap.owner, team: group[0].team, pieces: group.map(x => x.id) });
    if (trap.owner >= 0) { const o = [...this.g.players.values()].find(p => p.team === trap.owner && p.augs.some(a => ["x_setTrap", "x_massTrap", "x_summon"].includes(a.id))); if (o) this.g.impact(o, "x_setTrap", 3); }
    this.applyTrap(trap.type, group, trap.owner, me);
  }
  applyTrap(type, group, owner, me) {
    const team = group[0].team;
    if (type === "chain") {
      // 이웃 칸 함정을 한꺼번에 터뜨림 (더 번지지 않음)
      const near = [...(NEIGH[group[0].pos] || [])];
      const hits = this.st.traps.filter(t => near.includes(t.node));
      this.st.traps = this.st.traps.filter(t => !hits.includes(t));
      if (!this.hazardBlocked(group, "back")) this.pushBack(group, this.backAmount(team, 1, owner), "trap");
      for (const t of hits) { this.emit("trapHit", { node: t.node, trap: t.type, owner: t.owner, chain: true }); for (const grp of this.groupsOn([t.node])) if (grp[0].team !== t.owner && t.type !== "chain") this.applyTrap(t.type, grp, t.owner, null); }
      return;
    }
    const what = type === "frost" ? "freeze" : type === "slow" ? "slow" : type === "confuse" ? "confuse" : "back";
    if (this.hazardBlocked(group, what)) return;
    switch (type) {
      case "bomb": for (const p of group) p.xp = Math.max(0, (p.lv || 1) > 1 ? this.lvNeed(team, p.lv) : 0, (p.xp || 0) - 2); this.pushBack(group, this.backAmount(team, 4, owner), "bomb"); break;
      case "back": this.pushBack(group, this.backAmount(team, 3, owner), "trap"); break;
      case "frost": for (const p of group) p.frozen = Math.max(p.frozen || 0, 1); break;
      case "slow": for (const p of group) p.slow = Math.max(p.slow || 0, 2); break;
      case "confuse": for (const p of group) p.confused = 1; break;
      case "seal": { const t = this.g.teams[team]; this.st.sealed[team] = this.g.cur?.team === team ? t.turns + 1 : t.turns; break; }
      case "shieldBreak": for (const p of group) { p.shield = 0; p.guard = 0; } break;
      case "split": {
        if (group.length < 2) break;
        const off = group.slice(Math.ceil(group.length / 2));
        for (const p of off) p.hist = group[0].hist.slice();
        this.pushBack(off, 2, "split");
        break;
      }
      case "warp": {
        const occ = new Set(this.g.pieces.filter(p => p.team !== team).map(p => p.pos));
        const back = SPOTS.filter(n => n !== group[0].pos && !occ.has(n) && distLeft(n) > distLeft(group[0].pos, this.g.prevOf(group[0])));
        if (back.length) this.teleport(me, group, this.pick(back), false);
        break;
      }
    }
  }
  /** ❓ 이벤트 */
  event(me, group, gift) {
    const team = group[0].team;
    const lk = Math.max(0, ...group.map(p => p.evo === "luck" ? p.lv || 1 : 0));
    const owner = [...this.g.players.values()].find(p => p.team === team && p.armed.x_fateFan);
    const roll = () => { let r = this.rng() * 100; for (const [k, w] of EVENT_TABLE) { r -= w; if (r <= 0) return k; } return "xp"; };
    let k;
    if (owner) { owner.armed.x_fateFan = false; this.g.useCount(owner, "x_fateFan"); this.g.impact(owner, "x_fateFan", 4); k = "best"; }
    else if (lk >= 3 || this.teamHas(team, "x_overlord")) k = this.pick(["throw", "xp", "shield", "fwd"]);
    else if (lk >= 2 || this.abilityOf(team) === "luck") { const a = roll(), b = roll(); k = GOOD_RANK[a] >= GOOD_RANK[b] ? a : b; }
    else k = roll();
    this.emit("event", { node: group[0].pos, team, res: k });
    const canThrow = this.g.cur?.team === team && this.st.turnBonus < 1;
    switch (k) {
      case "best": for (const p of group) this.gainXp(p, 3 * gift, true); if (canThrow) { this.st.turnBonus++; this.g.cur.throws++; } break;
      case "xp": for (const p of group) this.gainXp(p, 3 * gift, true); break;
      case "throw": if (canThrow) { this.st.turnBonus++; this.g.cur.throws++; } else for (const p of group) this.gainXp(p, 2, true); break;
      case "shield": for (const p of group) p.shield = (p.shield || 0) + Math.min(2, gift); break;
      case "fwd": { this.forward(me, group, gift > 1 ? 2 : 1); const g2 = this.g.groupOf(group[0]); if (g2[0].pos !== DONE) this.land(me, g2); break; }
      case "back": if (!this.hazardBlocked(group, "back")) this.pushBack(group, 1, "event"); break;
      case "freeze": if (!this.hazardBlocked(group, "freeze")) for (const p of group) p.frozen = Math.max(p.frozen || 0, 1); break;
    }
  }
  /** 방해형 진화: 멈춘 뒤 앞 1~2칸 상대 */
  hinder(group) {
    const lv = Math.max(0, ...group.map(p => p.evo === "hinder" ? p.lv || 1 : 0));
    if (lv < 2 || group[0].pos === DONE || group[0].pos === HOME) return;
    const lead = group[0], ahead = new Set();
    for (const k of [1, 2]) for (const p of forwardPaths(lead.pos, this.g.prevOf(lead), k)) if (p.to !== DONE) ahead.add(p.to);
    for (const grp of this.groupsOn([...ahead])) {
      if (grp[0].team === lead.team || grp.some(x => x.guard > 0)) continue;
      if (this.hazardBlocked(grp, "slow")) continue;
      for (const x of grp) x.slow = Math.max(x.slow || 0, 1);
      this.emit("hit", { pieces: grp.map(x => x.id), what: "hinder", node: grp[0].pos });
      if (lv >= 3) this.pushBack(grp, 1, "hinder");
    }
  }

  // ---------------- 던지기 ----------------
  /** 던진 직후: 행운의 윷(도 → 다시), 금빛 윷가락 */
  adjustThrow(me, t) {
    if (t.result === 1 && this.g.hasAug(me, "x_luckyStick") && this.g.capLeft(me, "x_luckyStick", 3)) {
      this.g.capUse(me, "x_luckyStick"); this.g.impact(me, "x_luckyStick", 1);
      this.emit("reroll", { uid: me.id, from: 1 });
      t = throwSticks(this.rng, { backdo: this.g.backdo });
    }
    if ((t.result === 4 || t.result === 5) && this.g.hasAug(me, "x_goldStick") && this.g.capLeft(me, "x_goldStick", 3)) { this.g.capUse(me, "x_goldStick"); this.st.gold = 1; this.g.impact(me, "x_goldStick", 2); }
    return t;
  }
  sealed(team) { return this.st.sealed[team] !== undefined && this.st.sealed[team] === this.g.teams[team].turns; }

  // ---------------- 팀 능력 (버튼) ----------------
  useAbility(uid, pl = {}) {
    const g = this.g, c = g.cur, me = g.players.get(uid);
    if (!g.isTurn(uid)) return { ok: false, error: "NOT_YOUR_TURN" };
    if (c.choice) return { ok: false, error: "CHOOSE_FIRST" };
    const ab = this.st.abil[me.team]; if (!ab) return { ok: false, error: "NO_ABILITY" };
    if (ab.cd > 0) return { ok: false, error: "COOLDOWN" };
    const myPiece = (id) => { const p = g.pieces.find(x => x.id === id); return p && p.team === c.team && p.pos !== HOME && p.pos !== DONE && !g.groupBlocked(p) ? p : null; };
    switch (ab.id) {
      case "attack": {
        const p = g.pieces.find(x => x.id === pl.targetId);
        if (!p || p.team === c.team || p.pos === HOME || p.pos === DONE) return { ok: false, error: "BAD_TARGET" };
        const grp = g.groupOf(p); if (!grp.some(x => x.shield > 0 || x.guard > 0)) return { ok: false, error: "NO_SHIELD" };
        for (const x of grp) { x.shield = 0; x.guard = 0; }
        break;
      }
      case "defense": { const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" }; for (const x of g.groupOf(p)) x.guard = Math.max(x.guard || 0, g.teams.length - 1); break; }
      case "move": {
        const a = myPiece(pl.pieceId), b = myPiece(pl.pieceId2);
        if (!a || !b || a.pos === b.pos) return { ok: false, error: "BAD_TARGET" };
        this.swapGroups(uid, g.groupOf(a), g.groupOf(b)); c.snap = null;
        break;
      }
      case "luck": {
        const i = Number.isInteger(pl.ri) ? pl.ri : -1, pr = c.pending[i];
        if (!pr || pr.r === 4 || pr.r === 5) return { ok: false, error: "BAD_RESULT" };
        c.pending.splice(i, 1); c.throws++; c.phase = "throw"; c.snap = null;
        break;
      }
      case "strategy": {
        const n = Number(pl.node);
        const ti = this.st.traps.findIndex(t => t.node === n);
        if (ti >= 0) this.st.traps.splice(ti, 1);
        else if (["lava", "frost", "curse", "fire"].includes(this.st.tiles[n])) delete this.st.tiles[n];
        else return { ok: false, error: "NOTHING_THERE" };
        break;
      }
    }
    ab.cd = ABIL[ab.id].cd;
    g.useCount(me, "ab_" + ab.id, false);
    this.emit("abilityUse", { uid, id: ab.id, team: me.team, ...pickPl(pl) });
    g.settle();
    return { ok: true };
  }
  swapGroups(uid, g1, g2) {
    const s1 = { pos: g1[0].pos, hist: g1[0].hist.slice() }, s2 = { pos: g2[0].pos, hist: g2[0].hist.slice() };
    for (const x of g1) { x.pos = s2.pos; x.hist = s2.hist.slice(); }
    for (const x of g2) { x.pos = s1.pos; x.hist = s1.hist.slice(); }
    this.g.emit("swap", { uid, a: g1.map(x => x.id), b: g2.map(x => x.id), aTo: s2.pos, bTo: s1.pos });
  }

  // ---------------- 확장 증강 (버튼) ----------------
  /** 반환 { ok, error?, ...화면용 } — 횟수 깎기·사건·승리 확인은 엔진 useAug 가 공통으로 */
  useAug(me, id, pl) {
    const g = this.g, c = g.cur, st = this.st;
    const myPiece = (pid) => { const p = g.pieces.find(x => x.id === pid); return p && p.team === c.team && p.pos !== HOME && p.pos !== DONE && !g.groupBlocked(p) ? p : null; };
    const oppPiece = () => { const p = g.pieces.find(x => x.id === pl.targetId); return p && p.team !== c.team && p.pos !== HOME && p.pos !== DONE ? p : null; };
    switch (id) {
      case "x_fateFan": {
        if (me.armed.x_fateFan) { me.armed.x_fateFan = false; return { ok: true, armed: false, noCharge: true }; }
        me.armed.x_fateFan = true; return { ok: true, armed: true, noCharge: true };
      }
      case "x_doubleMove": {
        const pr = c.pending[pl.ri]; if (!pr || ![1, 2, 3].includes(pr.r)) return { ok: false, error: "BAD_RESULT" };
        c.pending.push({ r: pr.r, src: "xdouble" }); c.snap = null; g.impact(me, id, pr.r); return { ok: true };
      }
      case "x_setTrap": {
        const types = ["bomb", "frost", "back", "slow", "confuse"];
        const n = Number(pl.node), type = types[Number(pl.value)] || "back";
        if (g.pieces.some(p => p.pos === n) || !this.trapOk(n)) return { ok: false, error: "BAD_NODE" };
        this.addTrap(n, type, c.team); return { ok: true, trap: type };
      }
      case "x_massTrap": {
        const n = Number(pl.node);
        const nodes = [n, ...(NEIGH[n] || [])].filter(x => this.trapOk(x) && !g.pieces.some(p => p.pos === x && p.team === c.team)).slice(0, 3);
        if (!nodes.length) return { ok: false, error: "BAD_NODE" };
        for (const x of nodes) this.addTrap(x, "back", c.team);
        return { ok: true };
      }
      case "x_teleport": {
        const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" };
        for (let k = 1; k <= 6; k++) {
          const path = forwardPaths(p.pos, g.prevOf(p), k)[0];
          if (!path || path.to === DONE) break;
          if (st.tiles[path.to] && st.tiles[path.to] !== "frost" && st.tiles[path.to] !== "curse") { g.relocate(me, g.groupOf(p), path.to, path.steps, false); c.snap = null; this.depth = 0; this.land(me, g.groupOf(p)); return { ok: true, steps: k }; }
        }
        return { ok: false, error: "NO_TILE_AHEAD" };
      }
      case "x_clone": {
        const p = myPiece(pl.pieceId); if (!p || p.clone) return { ok: false, error: "BAD_TARGET" };
        if (g.pieces.some(x => x.team === c.team && x.clone)) return { ok: false, error: "ONE_CLONE" };
        const cl = { id: `t${c.team}c${++g.cloneSeq}`, team: c.team, pos: p.pos, hist: p.hist.slice(), clone: true, ttl: 5, shield: 0, guard: 0, blocked: false, wasCaptured: false, lv: p.lv || 1, xp: p.xp || 0, evo: p.evo || null };
        g.pieces.push(cl); g.emit("fx", { kind: "clone", piece: cl.id, from: p.id, node: p.pos }); c.snap = null;
        return { ok: true };
      }
      case "x_steelShield": { const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" }; for (const x of g.groupOf(p)) x.shield = (x.shield || 0) + 1; g.emit("fx", { kind: "shield", piece: p.id }); return { ok: true }; }
      case "x_teamSupport": { const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" }; for (const x of g.groupOf(p)) x.guard = Math.max(x.guard || 0, g.teams.length - 1); g.emit("fx", { kind: "shield", piece: p.id }); return { ok: true }; }
      case "x_xpBurst": { const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" }; for (const x of g.groupOf(p)) this.gainXp(x, 5, true); g.impact(me, id, 4); return { ok: true }; }
      case "x_evoBoost": {
        const p = myPiece(pl.pieceId); if (!p) return { ok: false, error: "BAD_TARGET" };
        const grp = g.groupOf(p); if (grp.every(x => (x.lv || 1) >= 3)) return { ok: false, error: "MAX_LEVEL" };
        for (const x of grp) if ((x.lv || 1) < 3) { x.xp = this.lvNeed(x.team, (x.lv || 1) + 1); this.levelUp(x); }
        g.impact(me, id, 5); return { ok: true };
      }
      case "x_resultShift": {
        const pr = c.pending[pl.ri], d = Number(pl.value) > 0 ? 1 : -1;
        if (!pr || pr.r < 1 || pr.r > 4) return { ok: false, error: "BAD_RESULT" };
        const v = pr.r + d; if (v < 1 || v > 4) return { ok: false, error: "BAD_VALUE" };
        pr.r = v; pr.src = "shift"; c.snap = null; return { ok: true, to: v };
      }
      case "x_swap": {
        const a = myPiece(pl.pieceId), b = myPiece(pl.pieceId2);
        if (!a || !b || a.pos === b.pos) return { ok: false, error: "BAD_TARGET" };
        this.swapGroups(me.id, g.groupOf(a), g.groupOf(b)); c.snap = null; return { ok: true };
      }
      case "x_perfectDefense": st.perfect[c.team] = g.teams.length - 1; g.emit("fx", { kind: "perfect", team: c.team }); return { ok: true };
      case "x_prank": {
        const p = oppPiece(); if (!p) return { ok: false, error: "BAD_TARGET" };
        const grp = g.groupOf(p); if (grp.some(x => x.guard > 0)) return { ok: false, error: "GUARDED" };
        if (this.hazardBlocked(grp, "slow")) return { ok: true, blocked: true };
        for (const x of grp) { x.slow = Math.max(x.slow || 0, 2); x.confused = 1; }
        g.impact(me, id, 3); return { ok: true };
      }
      case "x_rebuild": {
        this.layTiles(st.map === "chaos" ? "chaos" : st.map);
        st.traps = st.traps.filter(t => t.owner === c.team);
        this.emit("reshuffle", { map: st.map, by: me.id }); return { ok: true };
      }
      case "x_chaos": {
        this.layTiles("chaos"); st.traps = [];
        const opp = this.shuffle(this.groupsOn(SPOTS.concat(FORK_NODES)).filter(gr => gr[0].team !== c.team && !gr.some(x => x.guard > 0))).slice(0, 2);
        this.emit("reshuffle", { map: "chaos", by: me.id });
        for (const gr of opp) if (!this.hazardBlocked(gr, "back")) this.pushBack(gr, 1, "chaos");
        g.impact(me, id, 5); return { ok: true };
      }
      case "x_revive": {
        const home = g.pieces.filter(p => p.team === c.team && p.pos === HOME && p.wasCaptured && !p.clone && p.capAt != null);
        const p = home.find(x => x.id === pl.pieceId) || home[0];
        if (!p) return { ok: false, error: "NO_TARGET" };
        let node = p.capAt, hist = (p.capHist || this.canonHist(node)).slice();
        while (g.pieces.some(o => o.team !== c.team && o.pos === node) && hist.length > 1) node = hist.pop();
        if (g.pieces.some(o => o.team !== c.team && o.pos === node)) return { ok: false, error: "NO_TARGET" };
        p.pos = node; p.hist = hist; p.wasCaptured = false; p.capAt = null;
        for (const q of g.pieces) if (q.team === c.team && q.pos === node && q !== p && !q.clone) q.hist = hist.slice();
        g.emit("move", { uid: me.id, team: c.team, pieces: [p.id], from: HOME, to: node, steps: [node], back: false, captured: 0, blocked: 0, revive: true });
        g.impact(me, id, 8); c.snap = null; return { ok: true };
      }
      case "x_rewind": {
        // st.pre 는 지금 차례 시작 자리, st.prevPre 는 바로 전 (상대) 차례 시작 자리
        const snap = st.prevPre; if (!snap || snap.team === c.team) return { ok: false, error: "NOTHING_TO_UNDO" };
        let n = 0;
        for (const p of g.pieces) {
          if (p.team !== c.team || p.clone || p.pos === DONE) continue;
          const was = snap.pos[p.id]; if (!was || was.pos === p.pos || was.pos === DONE) continue;
          if (was.pos === HOME) continue;
          const dWas = distLeft(was.pos, was.hist.length ? was.hist[was.hist.length - 1] : null), dNow = p.pos === HOME ? 99 : distLeft(p.pos, g.prevOf(p));
          if (dWas >= dNow) continue; // 그때보다 뒤로 밀린 말만
          if (g.pieces.some(o => o.team !== c.team && o.pos === was.pos)) continue;
          const from = p.pos;
          p.pos = was.pos; p.hist = was.hist.slice(); p.wasCaptured = false; n++;
          for (const q of g.pieces) if (q !== p && q.team === p.team && q.pos === p.pos && !q.clone) q.hist = p.hist.slice(); // 같은 칸 우리 말과 지나온 길 맞춤
          g.emit("move", { uid: me.id, team: c.team, pieces: [p.id], from, to: p.pos, steps: [p.pos], back: false, captured: 0, blocked: 0, revive: true });
        }
        if (!n) return { ok: false, error: "NOTHING_TO_UNDO" };
        g.impact(me, id, 4 * n); c.snap = null; return { ok: true, n };
      }
      case "x_teamAwaken": {
        const ab = st.abil[c.team]; if (ab) ab.cd = 0;
        for (const p of g.pieces) if (p.team === c.team) this.gainXp(p, 2, true);
        return { ok: true };
      }
      case "x_summon": {
        let n = 0;
        for (const t of g.teams) {
          if (t.id === c.team) continue;
          const grp = this.leadGroup(t.id); if (!grp) continue;
          for (let k = 1; k <= 3; k++) { const p = forwardPaths(grp[0].pos, g.prevOf(grp[0]), k)[0]; if (p && p.to !== DONE && this.trapOk(p.to)) { this.addTrap(p.to, "bomb", c.team); n++; break; } }
        }
        if (!n) return { ok: false, error: "NO_TARGET" };
        return { ok: true };
      }
      case "x_portalGate": {
        const p = myPiece(pl.pieceId), node = Number(pl.node);
        if (!p || !DIAG.includes(node) || p.pos === node) return { ok: false, error: "BAD_TARGET" };
        this.teleport(me, g.groupOf(p), node, true); c.snap = null; this.depth = 0; this.land(me, g.groupOf(p)); return { ok: true };
      }
      case "x_legion": {
        const home = g.pieces.filter(p => p.team === c.team && p.pos === HOME && !p.clone).slice(0, 2);
        if (!home.length) return { ok: false, error: "NO_TARGET" };
        g.relocate(me, home, 2, [1, 2], false); c.snap = null;
        g.impact(me, id, 2 * home.length); return { ok: true };
      }
    }
    return { ok: false, error: "NO_AUG" };
  }

  // ---------------- AI ----------------
  scoreMove(m, pc, team) {
    let s = 0; const st = this.st;
    if (m.to === DONE) return 0;
    const trap = st.traps.find(t => t.node === m.to && t.owner !== team && (t.seen || t.owner === -1 || this.abilityOf(team) === "strategy"));
    if (trap) s -= 22;
    const tile = st.tiles[m.to];
    if (tile === "q" || tile === "heal" || tile === "boost") s += 6;
    if (tile === "portal" || tile === "ice") s += 4;
    if (tile === "frost" || tile === "curse") s -= 8;
    if (tile === "fire" || (tile === "lava" && st.map === "volcano" && this.g.round >= st.eruptAt - 1)) s -= 10;
    if (tile === "lava") s += 2;
    if (tile === "sanct") s += 5;
    if (st.boss?.weak.includes(m.to)) s += 18;
    if (st.spirit === m.to) s += 15;
    void pc; return s;
  }
  aiAbility(me) {
    const g = this.g, c = g.cur, ab = this.st.abil[me.team]; if (!ab || ab.cd > 0) return null;
    const mine = g.pieces.filter(p => p.team === c.team && p.pos >= 0 && p.pos !== DONE && !g.groupBlocked(p) && !p.clone);
    const opp = g.pieces.filter(p => p.team !== c.team && p.pos >= 0 && p.pos !== DONE);
    if (ab.id === "attack") { const t = opp.find(p => p.shield > 0 || p.guard > 0); if (t) return { ability: true, targetId: t.id }; }
    if (ab.id === "defense" && c.phase === "move") { const m = mine.find(p => this.g.groupOf(p).length > 1 || distLeft(p.pos, g.prevOf(p)) < 8); if (m && !(m.guard > 0)) return { ability: true, pieceId: m.id }; }
    if (ab.id === "luck" && c.phase === "move") { const i = c.pending.findIndex(p => p.r === 1 || p.r === -1); if (i >= 0) return { ability: true, ri: i }; }
    if (ab.id === "strategy") { const t = this.st.traps.find(t => t.owner !== c.team && (t.seen || t.owner === -1) && mine.some(m => forwardPaths(m.pos, g.prevOf(m), 3).some(p => p.steps.includes(t.node)))); if (t) return { ability: true, node: t.node }; }
    if (ab.id === "move" && mine.length >= 2) { const a = mine.slice().sort((x, y) => distLeft(y.pos, g.prevOf(y)) - distLeft(x.pos, g.prevOf(x))); const far = a[0], near = a.at(-1); if (far.pos !== near.pos && this.g.groupOf(far).length > this.g.groupOf(near).length && distLeft(far.pos) - distLeft(near.pos) > 6) return { ability: true, pieceId: far.id, pieceId2: near.id }; }
    return null;
  }
  aiAug(me) {
    const g = this.g, c = g.cur;
    const has = (id) => { const a = me.augs.find(x => x.id === id); return a && (a.charges === null || a.charges > 0); };
    const mine = g.pieces.filter(p => p.team === c.team && p.pos >= 0 && p.pos !== DONE && !p.clone && !g.groupBlocked(p));
    const lead = (arr) => arr.slice().sort((a, b) => distLeft(a.pos, g.prevOf(a)) - distLeft(b.pos, g.prevOf(b)))[0];
    const ab = this.aiAbility(me); if (ab && this.rng() < 0.7) return ab;
    if (c.phase === "throw" && c.throws > 0) {
      if (has("x_fateFan") && !me.armed.x_fateFan) return { id: "x_fateFan" };
      if (has("x_perfectDefense") && mine.some(p => distLeft(p.pos, g.prevOf(p)) <= 6)) return { id: "x_perfectDefense" };
      if (has("x_legion") && g.pieces.filter(p => p.team === c.team && p.pos === HOME && !p.clone).length >= 2) return { id: "x_legion" };
      if (has("x_revive") && g.pieces.some(p => p.team === c.team && p.pos === HOME && p.wasCaptured && p.capAt != null)) return { id: "x_revive" };
      if (has("x_rewind") && this.st.prevPre && this.rng() < 0.5) return { id: "x_rewind" };
      if (has("x_summon") && g.teams.some(t => t.id !== c.team && this.leadGroup(t.id))) return { id: "x_summon" };
      if (has("x_teamAwaken") && this.st.abil[c.team]?.cd > 1) return { id: "x_teamAwaken" };
      if (has("x_chaos") && g.rng() < 0.3) return { id: "x_chaos" };
      if (has("x_rebuild") && this.st.traps.some(t => t.owner !== c.team && t.owner !== -1) && g.rng() < 0.5) return { id: "x_rebuild" };
      if (mine.length) {
        const m = lead(mine);
        if (has("x_evoBoost") && (m.lv || 1) < 3) return { id: "x_evoBoost", pieceId: m.id };
        if (has("x_xpBurst") && (m.lv || 1) < 3) return { id: "x_xpBurst", pieceId: m.id };
        if (has("x_steelShield") && !(m.shield > 0) && g.rng() < 0.6) return { id: "x_steelShield", pieceId: m.id };
        if (has("x_teamSupport") && !(m.guard > 0) && g.rng() < 0.4) return { id: "x_teamSupport", pieceId: m.id };
        if (has("x_clone") && !g.pieces.some(p => p.team === c.team && p.clone)) return { id: "x_clone", pieceId: m.id };
        const far = mine.slice().sort((a, b) => distLeft(b.pos, g.prevOf(b)) - distLeft(a.pos, g.prevOf(a)))[0];
        if (has("x_portalGate") && distLeft(far.pos, g.prevOf(far)) > 10) return { id: "x_portalGate", pieceId: far.id, node: 27 };
        if (has("x_teleport") && g.rng() < 0.5) return { id: "x_teleport", pieceId: far.id };
        if (has("x_swap") && mine.length >= 2) { const a = far, b = m; if (a.pos !== b.pos && g.groupOf(a).length > g.groupOf(b).length) return { id: "x_swap", pieceId: a.id, pieceId2: b.id }; }
      }
      const opp = g.pieces.filter(p => p.team !== c.team && p.pos >= 0 && p.pos !== DONE && !(p.guard > 0));
      if (has("x_prank") && opp.length && g.rng() < 0.5) return { id: "x_prank", targetId: lead(opp).id };
      if ((has("x_setTrap") || has("x_massTrap")) && opp.length) {
        const t = lead(opp);
        for (let k = 1; k <= 4; k++) { const p = forwardPaths(t.pos, g.prevOf(t), k)[0]; if (p && p.to !== DONE && this.trapOk(p.to) && !g.pieces.some(q => q.pos === p.to)) return has("x_setTrap") ? { id: "x_setTrap", node: p.to, value: g.rng() < 0.5 ? 0 : 2 } : { id: "x_massTrap", node: p.to }; }
      }
    }
    if (c.phase === "move" && c.pending.length) {
      if (has("x_doubleMove")) { const i = c.pending.findIndex(p => p.r === 3 || p.r === 2); if (i >= 0) return { id: "x_doubleMove", ri: i }; }
      if (has("x_resultShift")) { const i = c.pending.findIndex(p => p.r === 3); if (i >= 0 && g.rng() < 0.5) return { id: "x_resultShift", ri: i, value: 1 }; }
    }
    return null;
  }

  // ---------------- 공개 상태 ----------------
  publicState(viewerTeam, spectator) {
    const st = this.st;
    // 관전자에게도 숨긴 함정은 안 보임 (방송·옆자리로 새지 않게) — 전략형 팀만 전부 봄
    const seeAll = viewerTeam != null && this.abilityOf(viewerTeam) === "strategy"; void spectator;
    const sense = viewerTeam != null && this.teamHas(viewerTeam, "x_trapSense");
    const near = new Set();
    if (sense) for (const p of this.g.pieces) if (p.team === viewerTeam && p.pos >= 0 && p.pos !== DONE) for (let k = 1; k <= 3; k++) for (const q of forwardPaths(p.pos, this.g.prevOf(p), k)) near.add(q.to);
    return {
      map: st.map, tiles: st.tiles, portal: st.portal, hidden: st.hidden,
      traps: st.traps.filter(t => !st.hidden || t.seen || t.owner === -1 || t.owner === viewerTeam || seeAll || near.has(t.node)).map(t => ({ node: t.node, type: t.type, owner: t.owner, ttl: t.ttl })),
      hiddenCount: st.hidden ? st.traps.filter(t => !t.seen && t.owner !== viewerTeam).length : 0,
      boss: st.boss ? { type: st.boss.type, hp: st.boss.hp, maxHp: st.boss.maxHp, act: st.boss.act, weak: st.boss.weak, plan: st.boss.plan } : null,
      nextBoss: st.boss ? null : st.nextBoss, nextBossType: st.boss ? null : (this.g.round >= st.nextBoss - 1 ? this.bossTypeNext() : null),
      eruptAt: st.map === "volcano" ? st.eruptAt : null, closed: st.closed, gate: st.gate, spirit: st.spirit, chaos: st.map === "chaos" ? st.chaosMsg : null,
      abil: Object.fromEntries(Object.entries(st.abil).map(([t, a]) => [t, { id: a.id, cd: a.cd }])),
      sealed: Object.keys(st.sealed).filter(t => this.sealed(+t)).map(Number), perfect: Object.keys(st.perfect).filter(t => st.perfect[t] > 0).map(Number),
      hsh: st.hsh, seeArmed: seeAll, gold: st.gold, lvNeed: this.g.teams.map(t => [this.lvNeed(t.id, 2), this.lvNeed(t.id, 3)]),
    };
  }
}
function pickPl(pl) { const o = {}; for (const k of ["pieceId", "targetId", "pieceId2", "node", "ri"]) if (pl[k] !== undefined && pl[k] !== null && !Number.isNaN(pl[k])) o[k] = pl[k]; return o; }
export const X_META = { maps: MAPS, tiles: TILES, traps: TRAPS, evo: EVO, abil: ABIL, bosses: BOSSES, bossRule: BOSS_RULE, events: EVENT_TABLE, xpLv: XP_LV, exclusive: EXCLUSIVE };
