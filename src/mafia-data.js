// =========================
// 플듀 마피아 — 시청자 마을 : 직업 17종 · 특별 사건 22종 · 구성 검증
// 서버 전용. 비밀 정보는 여기서 만들어지고, 클라이언트에는 본인 몫만 나간다.
// =========================

export const TEAM = { TOWN: "town", MAFIA: "mafia", NEUTRAL: "neutral" };

// act: 밤 행동(null=없음) · uses: 쓸 수 있는 횟수(없으면 무제한) · day: 낮 능력
// 능력 처리 순서(서버 고정): 1 위장 → 2 보호(의무관·경호원·생존자 방탄) → 3 습격 → 4 정보(수사관·탐정·정보원·감시자·기자·분석가) → 5 진영 변경(배신자)
export const ROLES = {
  // ── 시민 진영 8 ──
  citizen:      { team: "town",    name: "방송국 스태프", act: null,       desc: "능력은 없지만 사건 조사와 토론, 투표의 핵심입니다. 추리 미니게임 정답을 맞히면 검증된 단서를 받습니다." },
  investigator: { team: "town",    name: "수사관",        act: "check",    desc: "밤에 한 명의 진영(시민/조작단)을 조사합니다. 위장 전문가에게 교란당할 수 있습니다." },
  medic:        { team: "town",    name: "의무관",        act: "protect",  desc: "밤에 한 명을 습격에서 보호합니다. 같은 사람을 이틀 연속 보호할 수 없습니다." },
  reporter:     { team: "town",    name: "기자",          act: "follow",   desc: "밤에 한 명을 미행해 누구를 찾아갔는지 알아냅니다. 사건 조사 때 단서를 하나 더 받고, 한 번 '단독 보도'로 알아낸 사실을 공개할 수 있습니다." },
  bodyguard:    { team: "town",    name: "경호원",        act: "guard",    desc: "밤에 한 명을 경호합니다. 그 사람이 습격당하면 대신 쓰러지고 그 사람은 살아남습니다." },
  analyst:      { team: "town",    name: "분석가",        act: "analyze",  desc: "밤에 한 명을 분석해 위장·증거 조작의 흔적(그 사람이 위장당했거나, 위장·조작을 했는지)을 찾아냅니다." },
  watcher:      { team: "town",    name: "감시자",        act: "watch",    desc: "밤에 한 명을 감시해 그 사람을 찾아온 출연자 명단을 확인합니다." },
  detective:    { team: "town",    name: "탐정",          act: "compare",  desc: "밤에 두 명을 골라 같은 진영인지 비교합니다. 사건 조사 때 조작된 증거에 '수상한 흔적' 표시가 보입니다." },
  // ── 조작단(마피아) 5 ──
  mafia:        { team: "mafia",   name: "조작단",        act: "kill",     desc: "밤마다 동료와 함께 퇴장시킬 출연자를 고릅니다. 낮에는 스태프인 척하세요." },
  informant:    { team: "mafia",   name: "정보원",        act: "spy",      desc: "밤에 한 명의 정확한 직업을 알아냅니다. 조작단 동료를 알고 있습니다." },
  disguiser:    { team: "mafia",   name: "위장 전문가",   act: "disguise", desc: "밤에 한 명을 위장시켜, 그날 밤 수사관·탐정의 결과를 반대로 보이게 합니다. 분석가에게 흔적이 들킬 수 있습니다." },
  forger:       { team: "mafia",   name: "증거 조작범",   act: null,       uses: 1, desc: "사건 조사 중 한 번, 손에 든 증거 하나를 조작해 공개할 수 있습니다. 탐정·분석가·재수사에 들킬 수 있습니다." },
  negotiator:   { team: "mafia",   name: "협상가",        act: null,       uses: 2, desc: "투표 시간에 두 번까지 '뒷거래'로 한 명의 표를 무효로 만듭니다(누가 했는지는 공개되지 않음)." },
  // ── 중립 4 ──
  survivor:     { team: "neutral", name: "생존자",        act: "vest",     uses: 2, desc: "게임이 끝날 때 살아 있으면 개인 승리합니다. 밤에 두 번까지 방탄조끼로 자신을 지킬 수 있습니다." },
  opportunist:  { team: "neutral", name: "기회주의자",    act: null,       desc: "비밀 목표 인물이 낮 투표로 하차하면(본인이 살아 있을 때) 개인 승리합니다." },
  traitor:      { team: "neutral", name: "배신자",        act: null,       desc: "처음엔 시민팀으로 계산됩니다. 조작단이 1명만 남으면 조작단으로 넘어가 동료가 되고 습격에 참여합니다." },
  tipster:      { team: "neutral", name: "익명 제보자",   act: null,       uses: 1, desc: "사건 조사 때 진실 메모(결백한 용의자 1명)를 받습니다. 사건이 해결될 때 살아 있으면 개인 목표 달성. 한 번 '익명 증언'을 할 수 있습니다." },
};
export const ROLE_IDS = Object.keys(ROLES);
export const OPTIONAL_ROLES = ROLE_IDS.filter((r) => !["citizen", "investigator", "medic", "mafia"].includes(r));

export const STAFF_LOOKS = ["작가", "카메라 감독", "음향 감독", "메이크업", "FD", "조명 감독", "편집자", "MC 지망생", "인턴", "무대 감독"];

/** 인원별 직업 구성 + 균형 검증. disabled: 끈 직업 Set */
export function buildRoles(n, disabled = new Set()) {
  const on = (r) => !disabled.has(r);
  const mafN = n <= 7 ? 1 : n <= 9 ? 2 : n < 15 ? Math.round(n * 0.2) : Math.round(n * 0.17);   // 시뮬레이션으로 조정(11-10): 24%는 조작단 압승
  const neuN = n < 8 ? 0 : n < 11 ? 1 : n < 15 ? 2 : n < 20 ? 3 : 4;
  const maf = ["mafia"];
  const mafSupport = [["informant", 8], ["disguiser", 10], ["forger", 12], ["negotiator", 15]];
  for (const [r, min] of mafSupport) if (maf.length < mafN && n >= min && on(r)) maf.push(r);
  while (maf.length < mafN) maf.push("mafia");
  const neu = [];
  for (const [r, min] of [["survivor", 8], ["tipster", 9], ["opportunist", 11], ["traitor", 13]]) if (neu.length < neuN && n >= min && on(r)) neu.push(r);
  const town = ["investigator", "medic"];
  const hasTrick = maf.includes("disguiser") || maf.includes("forger");
  const townPool = [["reporter", 6], ["watcher", 8], ["bodyguard", 9], ["analyst", 10], ["detective", 10]];
  for (const [r, min] of townPool) if (n >= min && on(r) && maf.length + neu.length + town.length < n) town.push(r);
  // 큰 판: 정보 직업 추가(시뮬레이션 11-10 — 사람 수에 비해 정보가 부족해 조작단 압승)
  for (const [r, min] of [["investigator", 18], ["medic", 22], ["watcher", 26]]) if (n >= min && maf.length + neu.length + town.length < n) town.push(r);
  if (hasTrick && !town.includes("analyst") && !town.includes("detective") && on("analyst") && n >= 10) town.push("analyst");   // 교란 직업엔 반드시 대응 직업
  const list = [...maf, ...neu, ...town];
  while (list.length < n) list.push("citizen");
  const out = list.slice(0, n);
  const v = validateRoles(out);
  if (!v.ok) throw new Error("ROLE_BALANCE " + v.why + " " + out.join(","));
  return out;
}
export function validateRoles(list) {
  const t = (r) => ROLES[r].team;
  const maf = list.filter((r) => t(r) === "mafia").length, town = list.filter((r) => t(r) === "town").length;
  if (!list.includes("mafia")) return { ok: false, why: "no_mafia" };
  if (!list.includes("investigator") || !list.includes("medic")) return { ok: false, why: "no_core_town" };
  if (maf * 2 >= list.length) return { ok: false, why: "mafia_too_many" };
  if (town <= maf) return { ok: false, why: "town_too_few" };
  if (list.length >= 10 && (list.includes("disguiser") || list.includes("forger")) && !list.includes("analyst") && !list.includes("detective")) return { ok: false, why: "no_counter" };
  return { ok: true };
}

// =========================
// 특별 사건 22종 — 모두 실제 게임 상태와 연결(엔진 applyIncident에서 효과 처리)
// cond: 등장 조건(엔진에서 확인), kind: info/rule/case/comeback, mg: 추리 미니게임 종류
// =========================
export const INCIDENTS = {
  sns_post:      { title: "SNS 악성 게시글",   kind: "case", mg: "chat",        w: 3, desc: "방송국 공식 계정에 악성 게시글이 올라왔습니다. 말투를 분석해 작성자를 찾으세요." },
  leak:          { title: "내부 정보 유출",    kind: "info", w: 2, desc: "내부 문서가 유출됐습니다. 남은 조작단 수가 공개됩니다." },
  threat:        { title: "익명 협박장",       kind: "rule", w: 2, desc: "한 출연자에게 협박장이 도착했습니다. 오늘 밤 그 사람은 의무관의 보호를 받을 수 없습니다." },
  cctv_broken:   { title: "방송국 CCTV 고장",  kind: "rule", w: 2, desc: "오늘 밤 감시자와 기자는 아무것도 볼 수 없습니다." },
  access_log:    { title: "수상한 출입 기록",  kind: "case", mg: "location",    w: 3, desc: "출입 카드 기록에 빈틈이 있습니다. 사건 당시 위치를 추적하세요." },
  anon_tip:      { title: "익명 제보",         kind: "info", w: 2, desc: "한 출연자가 조작단이 아니라는 제보가 확인됐습니다." },
  contract:      { title: "조작된 계약서",     kind: "case", mg: "document",    w: 2, desc: "출연 계약서 중 하나가 위조됐습니다. 위조 문서를 판별하세요." },
  broadcast_fail:{ title: "생방송 송출 사고",  kind: "rule", w: 2, desc: "오늘 투표는 누가 누구를 찍었는지 공개되지 않습니다." },
  missing:       { title: "출연진 실종",       kind: "rule", w: 2, desc: "한 출연자가 연락 두절됐습니다. 오늘 밤 그 사람은 행동할 수도, 대상이 될 수도 없습니다." },
  fake_news:     { title: "가짜 뉴스",         kind: "case", mg: "statement",   w: 3, desc: "어젯밤에 대한 보도 중 하나가 거짓입니다. 거짓 진술을 찾아내세요." },
  secret_meeting:{ title: "비밀 회의 포착",    kind: "info", w: 2, desc: "두 출연자가 몰래 만나는 장면이 찍혔습니다. 둘 중 정확히 한 명이 조작단입니다." },
  evidence_damage:{ title: "증거 훼손",        kind: "case", mg: "contradiction", w: 2, desc: "누군가 증거를 훼손했습니다. 증거 사이의 모순을 찾아내세요." },
  donation:      { title: "수상한 후원금",     kind: "info", w: 1, desc: "출처 불명의 후원금이 발견됐습니다. 협상가가 살아 있는지 공개됩니다." },
  whistle:       { title: "내부 고발",         kind: "info", w: 1, desc: "내부 고발로 살아 있는 중립 인원 수가 공개됩니다." },
  blackout:      { title: "방송국 정전",       kind: "rule", w: 2, desc: "오늘 밤 정전! 정보를 얻는 모든 능력이 결과를 얻지 못합니다." },
  fake_id:       { title: "위조 신분증",       kind: "case", mg: "document",    w: 2, desc: "위조 출입증으로 누군가 통제 구역에 들어갔습니다." },
  secret_msg:    { title: "비밀 메시지",       kind: "case", mg: "account",     w: 2, desc: "익명 계정으로 비밀 메시지가 오갔습니다. 계정 활동 시간을 비교하세요." },
  alibi_clash:   { title: "알리바이 충돌",     kind: "case", mg: "timeline",    w: 3, desc: "출연자들의 알리바이가 서로 충돌합니다. 사건 타임라인을 재구성하세요." },
  betrayal:      { title: "내부 배신",         kind: "rule", w: 1, desc: "조작단 내부에서 배신이 일어났습니다. 배신자가 지금 진영을 바꿉니다." },
  key_evidence:  { title: "결정적 증거 발견",  kind: "comeback", mg: "cctv",   w: 0, desc: "결정적인 CCTV 영상이 복구됐습니다. 시간 순서를 맞추면 진범(조작단)을 밝힐 수 있습니다." },
  hearing:       { title: "특별 청문회",       kind: "comeback", w: 0, desc: "오늘은 투표 대신 청문회! 한 명을 증인석에 세우고 과반이 찬성하면 그 사람의 진영이 공개됩니다." },
  reinvestigate: { title: "재수사 요청",       kind: "comeback", w: 0, desc: "지난 사건의 증거를 재수사합니다. 조작된 증거와 조작범이 드러납니다." },
};
export const INCIDENT_IDS = Object.keys(INCIDENTS);
export const MINIGAMES = { chat: "수상한 채팅 분석", location: "사건 당시 위치 추적", document: "위조 문서 판별", statement: "거짓 진술 찾기", contradiction: "증거 간 모순 발견", account: "익명 계정 활동 비교", timeline: "사건 타임라인 재구성", cctv: "CCTV 시간 순서 맞추기" };
