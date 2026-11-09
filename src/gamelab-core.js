// =========================
// 플듀 게임 종합 진단소 — 미션 표·채점 (화면·서버 공용, 게임 코드 의존 없음)
// 수치를 고칠 곳은 MISSIONS 한곳. 백엔드 src/gamelab-core.js 와 같은 파일이어야 함
// 점수: 미션 100점. 성공 60~100 / 실패 0~59 / AI 승 60~100, 미결 20~59, 패 0~30
// =========================
export const VER = "gl1";
export const DIFFS = ["normal", "hard", "expert"];
export const DIFF_NAME = { normal: "보통", hard: "어려움", expert: "전문가" };
export const AREAS = {
  physical: { name: "피지컬", col: "#ff6078", icon: "⚡" },
  precision: { name: "정밀 조작", col: "#3ee6f0", icon: "🎯" },
  puzzle: { name: "퍼즐 두뇌", col: "#46e08a", icon: "🧩" },
  reading: { name: "수 읽기", col: "#c77dff", icon: "♟️" },
  strategy: { name: "전략", col: "#ffdf7a", icon: "👑" },
};
// kind: survive 버티기 | reach 목표 달성 | golf 타수 | ai AI 승부
// server: 승패를 서버가 판정하는 미션
export const MISSIONS = [
  { id: "dodge", name: "피해피해", icon: "🔫", col: "#ff6078", page: "dodge.html", kind: "survive", area: "physical", quick: 1,
    goalText: (c) => `${c.goal}초 버티고 보스 잡기`, rule: "탄막을 피하며 끝까지 살아남고, 중간에 나오는 보스를 쓰러뜨리세요. 공격은 자동이에요. 보스를 못 잡으면 입힌 피해만큼만 점수를 받아요.", ctl: "PC: WASD·방향키 / 폰: 화면 조이스틱",
    diff: { normal: { goal: 30, limit: 30, bossHp: 200, bossIdx: 0 }, hard: { goal: 45, limit: 45, bossHp: 340, bossIdx: 1 }, expert: { goal: 60, limit: 60, bossHp: 520, bossIdx: 3 } } },
  { id: "apple", name: "사과게임", icon: "🍎", col: "#ff8a5c", page: "apple.html", kind: "reach", area: "puzzle", quick: 1,
    goalText: (c) => `${c.limit}초 안에 ${c.goal}점`, rule: "사과를 드래그로 묶어 합을 10으로 만들면 사라져요. 빨리 목표를 넘길수록 점수가 높아요.", ctl: "마우스·손가락 드래그",
    diff: { normal: { goal: 30, limit: 60 }, hard: { goal: 50, limit: 60 }, expert: { goal: 80, limit: 60 } } },
  { id: "br", name: "블록로얄", icon: "🧱", col: "#7ab8ff", page: "blockroyale.html", kind: "reach", area: "physical", quick: 1,
    goalText: (c) => `${c.goal}줄 빠르게 지우기`, rule: "떨어지는 블록을 쌓아 가로줄을 지우세요. 10줄을 빨리 지울수록 점수가 높아요.", ctl: "PC: 방향키·스페이스 / 폰: 화면 버튼",
    diff: { normal: { goal: 10, limit: 120, lv: 1 }, hard: { goal: 10, limit: 120, lv: 3 }, expert: { goal: 10, limit: 120, lv: 5 } } },
  { id: "bb", name: "블록블래스트", icon: "🟦", col: "#5b8cff", page: "blockblast.html", kind: "reach", area: "puzzle", quick: 1,
    goalText: (c) => `${c.goal}줄 지우기`, rule: "블록 3개를 판에 놓아 가로·세로 줄을 채우면 지워져요. 놓을 곳이 없으면 끝나요.", ctl: "마우스·손가락 드래그",
    diff: { normal: { goal: 5, limit: 120 }, hard: { goal: 8, limit: 120 }, expert: { goal: 12, limit: 120 } } },
  { id: "merge", name: "수라상", icon: "🍚", col: "#f4c76a", page: "merge.html", kind: "reach", area: "puzzle", quick: 1,
    goalText: (c) => `${c.limit}초 안에 ${c.goal}점`, rule: "같은 음식을 부딪쳐 합치세요. 넘치지 않게 쌓으면서 목표 점수를 빨리 넘기세요.", ctl: "좌우로 움직여 떨어뜨리기",
    diff: { normal: { goal: 5000, limit: 60 }, hard: { goal: 8000, limit: 60 }, expert: { goal: 12000, limit: 60 } } },   // 측정: 1.1초에 한 개 2600점 · 0.7초 6300점 · 0.65초 연타 6800점
  { id: "golf", name: "굴려굴려", icon: "⛳", col: "#46e08a", page: "golf.html", kind: "golf", area: "precision",
    goalText: (c) => `${c.holes}홀을 적은 타수로`, rule: "공을 당겨 쏴서 3개 홀에 넣으세요. 기준 타수보다 적게 칠수록 점수가 높아요.", ctl: "공을 드래그해 쏘기",
    diff: { normal: { holes: 3, limit: 180, mode: "normal" }, hard: { holes: 3, limit: 180, mode: "hard" }, expert: { holes: 3, limit: 180, mode: "extreme" } } },
  { id: "omok", name: "오목", icon: "⚫", col: "#c9d2ee", page: "omok.html", kind: "ai", area: "reading", server: 1,
    goalText: () => "AI와 5목 대결", rule: "먼저 다섯 개를 이으면 이겨요. 시간이 다 되면 판의 형세로 채점해요.", ctl: "칸을 눌러 두기 (한 수 30초)",
    diff: { normal: { ai: "easy", limit: 300, turn: 30 }, hard: { ai: "normal", limit: 300, turn: 30 }, expert: { ai: "hard", limit: 300, turn: 30 } } },
  { id: "suspect", name: "수상한 카드", icon: "🕵️", col: "#c77dff", page: "suspect-multi.html", kind: "ai", area: "reading",
    goalText: () => "AI 탐정과 1:1 추리", rule: "상대의 숨은 카드 숫자를 맞혀 먼저 모두 공개시키면 이겨요. 시간이 다 되면 남은 카드 차이로 채점해요.", ctl: "상대 카드를 눌러 숫자 추리",
    diff: { normal: { ai: "easy", limit: 300 }, hard: { ai: "normal", limit: 300 }, expert: { ai: "hard", limit: 300 } } },
  { id: "card", name: "난장 카드", icon: "🃏", col: "#ff9fd0", page: "cardgame-multi.html", kind: "ai", area: "strategy", server: 1,
    goalText: () => "AI와 1:1 카드 대결", rule: "카드로 공격·방어·역전을 주고받아 상대 체력을 0으로 만드세요. 시간이 다 되면 체력 차이로 채점해요.", ctl: "카드를 눌러 사용 (한 턴 30초)",
    diff: { normal: { ai: "easy", limit: 300, turn: 30 }, hard: { ai: "normal", limit: 300, turn: 30 }, expert: { ai: "hard", limit: 300, turn: 30 } } },
  { id: "raising", name: "플듀 키우기", icon: "🐲", col: "#ffdf7a", page: "gamelab-raising.html", kind: "ai", area: "strategy",
    goalText: () => "라인업을 짜서 1경기", rule: "몬스터 40종 중 5마리를 골라 AI 감독과 겨뤄요. 저장된 키우기 기록에는 아무 영향이 없어요.", ctl: "5마리 고르기 → 경기 중 작전 지시",
    diff: { normal: { lv: 9, speed: 4 }, hard: { lv: 14, speed: 4 }, expert: { lv: 20, speed: 4 } } },   // 내 팀 Lv10. 측정 승률: 상대 Lv8~10 50~90% · 13~16 38% · 20 25%
];
export const byId = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const QUICK = MISSIONS.filter((m) => m.quick).map((m) => m.id);
export const FULL = MISSIONS.map((m) => m.id);
export const plan = (mode) => (mode === "full" ? [...FULL] : mode === "quick" ? [...QUICK] : []);
export const cfgOf = (id, diff) => (byId[id]?.diff[DIFFS.includes(diff) ? diff : "normal"]) || null;
/** 방장이 정한 제한시간 배율을 적용한 설정 (피해피해는 버티기 목표라 그대로). 키우기는 제한시간 없음 */
export const TIME_SCALES = { short: 0.75, normal: 1, long: 1.25 };
export function liveCfg(id, diff, scale = 1) { const c = cfgOf(id, diff); if (!c || !c.limit || scale === 1 || byId[id]?.kind === "survive") return c; return { ...c, limit: Math.round(c.limit * scale) }; }
export const TIERS = [
  { id: "SSS", min: 950, col: "#ffdf7a", emb: "challenger" },
  { id: "SS", min: 880, col: "#ff6078", emb: "grandmaster" },
  { id: "S", min: 790, col: "#c77dff", emb: "master" },
  { id: "A", min: 660, col: "#7ab8ff", emb: "diamond" },
  { id: "B", min: 520, col: "#46e08a", emb: "emerald" },
  { id: "C", min: 360, col: "#f4c76a", emb: "gold" },
  { id: "D", min: 0, col: "#8a8f9e", emb: "silver" },
];
export const UNRATED = "N", MIN_RATE = 0.6;   // 빠른 3개·전체 6개 이상 측정해야 등급을 줌
export const tierOf = (t) => TIERS.find((x) => t >= x.min) || TIERS[TIERS.length - 1];
export const TYPES = { physical: "반사신경 파이터", precision: "한 끗 장인", puzzle: "퍼즐 마스터", reading: "수 읽는 승부사", strategy: "판을 짜는 감독", all: "만능 게이머" };

const c01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** raw(게임이 보고한 값) → { score, status } · status: clear 성공 | fail 실패 | win 승 | lose 패 | timeout 미결 | quit 포기 */
export function scoreMission(id, diff, raw, cfg = null) {
  const m = byId[id], c = cfg || cfgOf(id, diff); if (!m || !c || !raw) return { score: 0, status: "fail" };
  let score = 0, status = "fail";
  if (m.kind === "survive") {
    const t = num(raw.t), lived = !!raw.survived && t >= c.goal - 0.5, ok = !!raw.ok && t >= c.goal - 0.5 && raw.boss === true;   // 성공 = 끝까지 생존 + 보스 처치
    score = ok ? 60 + 40 * c01(raw.hp) : lived ? 40 + 19 * c01(raw.bossDmg) : 39 * c01(t / c.goal) + (raw.boss === true ? 10 : 10 * c01(raw.bossDmg)); status = ok ? "clear" : "fail";
    if (c01(raw.moved) < 0.25) score = Math.min(score, 40);   // 가만히 서서 버틴 경우
  } else if (m.kind === "reach") {
    const v = num(raw.value), t = num(raw.t), ok = !!raw.ok && v >= c.goal;
    score = ok ? 60 + 40 * c01((c.limit - t) / (c.limit * 0.75)) : 59 * c01(v / c.goal); status = ok ? "clear" : "fail";
  } else if (m.kind === "golf") {
    const done = Math.max(0, Math.min(c.holes, num(raw.done))), ok = done >= c.holes;
    const over = num(raw.strokes) - num(raw.par);
    score = ok ? 100 - 5 * Math.max(0, over + 3) : 59 * (done / c.holes) * 0.9 + 5 * (done ? 1 : 0); status = ok ? "clear" : "fail";
    score = ok ? Math.max(60, score) : score;
  } else {
    const eff = c01(raw.eff);
    if (raw.win) { score = 60 + 40 * eff; status = "win"; }
    else if (raw.timeout) { score = 20 + 39 * c01((num(raw.adv) + 1) / 2); status = "timeout"; }
    else { score = 30 * eff; status = "lose"; }
  }
  if (raw.quit) { score = Math.min(score, 20); status = "quit"; }
  if (num(raw.inputs) === 0) score = 0;   // 아무 조작도 안 함
  return { score: Math.round(Math.max(0, Math.min(100, score))), status };
}

/** 측정한 미션 평균을 1000점으로 환산. 미측정은 평균에서 빠짐(0점 아님) */
export function summarize(plan, results) {
  const scored = plan.filter((id) => results[id] && Number.isFinite(results[id].score));
  const scores = Object.fromEntries(scored.map((id) => [id, results[id].score]));
  const total = scored.length ? Math.round(scored.reduce((s, id) => s + scores[id], 0) / scored.length * 10) : 0;
  const by = {}; for (const id of scored) (by[byId[id].area] ||= []).push(scores[id]);
  const areas = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
  const entries = Object.entries(areas).sort((a, b) => b[1] - a[1]);
  const spread = entries.length ? entries[0][1] - entries[entries.length - 1][1] : 0;
  const type = !entries.length ? "all" : entries.length >= 3 && spread <= 12 ? "all" : entries[0][0];
  const sorted = scored.slice().sort((a, b) => scores[b] - scores[a]);
  const rated = plan.length <= 1 || scored.length >= Math.ceil(plan.length * MIN_RATE);   // 건너뛴 게 많으면 등급 보류(N)
  return { total, tier: rated ? tierOf(total).id : UNRATED, rated, done: scored.length, of: plan.length, scores, areas, type, best: sorted[0] || null, worst: sorted[sorted.length - 1] || null };
}
