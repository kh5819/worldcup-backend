// =========================
// 플듀 미스터리 — 사건 진행 엔진 (순수 로직, 소켓 무관)
// - 서버가 상태의 유일한 주인. 정답 판정·진행 잠금은 전부 여기서.
// - 클라이언트에는 snapshot()/이벤트로 "지금 보여도 되는 것"만 내보낸다.
// - 솔로·멀티 모두 같은 세션 구조를 쓴다 (멀티는 세션 하나를 방 전체가 공유).
// =========================

const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const BIT = { N: 1, E: 2, S: 4, W: 8 };
const OPP = { N: "S", E: "W", S: "N", W: "E" };

// ---------- 보는 사람 기준 정보 (멀티 역할 · 정보 분산) ----------
// 솔로는 기본값: 모든 역할 능력 + 분산 없음. 멀티는 플레이어마다 다른 값을 넘긴다.
// 엔진은 동기 실행이라 act/snapshot 한 번 동안만 이 값을 쓴다.
export const ROLES = ["detective", "observer", "cryptographer", "archivist", "psychologist", "engineer", "investigator", "reasoner"];
const DEFAULT_VIEW = { roles: ROLES, split: { index: 0, count: 1 } };
let VIEW = DEFAULT_VIEW;
function withView(opts, fn) {
  const prev = VIEW;
  VIEW = { roles: opts?.roles || DEFAULT_VIEW.roles, split: opts?.split || DEFAULT_VIEW.split };
  try { return fn(); } finally { VIEW = prev; }
}
const hasRole = (r) => VIEW.roles.includes(r);
const MECH_TYPES = new Set(["gears", "circuit", "slide", "clock", "weights", "mirror", "rings"]);
const CODE_TYPES = new Set(["cipher", "lock", "number"]);

// ---------- 유틸 ----------
const has = (st, f) => st.flags.has(f);
const allFlags = (st, list) => !list || list.every((f) => st.flags.has(f));
const noneFlags = (st, list) => !list || !list.some((f) => st.flags.has(f));
const norm = (s) => String(s ?? "").normalize("NFC").replace(/[\s.,!?'"·~\-:]/g, "").toLowerCase();
const digits = (s) => String(s ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");

function rotMask(m, k) {
  let r = m & 15;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) r = ((r << 1) | (r >> 3)) & 15;
  return r;
}

// ---------- 세션 ----------
export function createSession(caseData, now = Date.now()) {
  return {
    caseId: caseData.id,
    scene: caseData.startScene,
    flags: new Set(),
    evidence: [],
    solved: {},
    hints: {},
    wrong: {},
    deductions: [],
    deduceWrong: 0,
    weigh: null,
    ending: null,
    finalAnswers: null,
    startedAt: now,
    finishedAt: null,
    lastActive: now,
    log: [],
  };
}

export function serializeSession(st) {
  return { ...st, flags: [...st.flags] };
}
export function restoreSession(obj) {
  return { ...obj, flags: new Set(obj.flags || []) };
}

// ---------- 공개 정보 ----------
export function publicCaseInfo(caseData) {
  const P = caseData.presentation || {};
  return {
    id: caseData.id,
    title: caseData.title,
    subtitle: caseData.subtitle,
    characters: caseData.characters,
    // 스포일러가 없는 연출 정보만 (타임라인·용의자 분석 등은 스냅샷에서 진행도만큼 계산)
    presentation: {
      episode: P.episode || caseData.id.toUpperCase(), label: P.label || "", playtime: P.playtime || "",
      summary: P.summary || "", tips: P.tips || [], prologue: P.prologue || [], finalCine: P.finalCine || null,
      finalScene: P.finalScene || null, relationLayout: P.relationLayout || {}, artModule: P.artModule || null,
    },
    totals: {
      main: Object.values(caseData.puzzles).filter((p) => !p.hidden && !p.optional).length,
      optional: Object.values(caseData.puzzles).filter((p) => p.optional).length,
      hidden: Object.values(caseData.puzzles).filter((p) => p.hidden).length,
      evidence: Object.keys(caseData.evidence).length,
      deductions: caseData.deductions.length,
    },
  };
}

function hotspotVisible(st, h) {
  return allFlags(st, h.requires) && noneFlags(st, h.hideIf);
}

function hotspotState(c, st, h) {
  const a = h.action;
  if (a.type === "puzzle") {
    if (st.solved[a.puzzle]) return "done";
    return c.puzzles[a.puzzle].hidden ? "hidden" : c.puzzles[a.puzzle].optional ? "optional" : "puzzle";
  }
  if (a.type === "final") return "final";
  if (a.type === "interrogate") return st.flags.has(c.interrogations?.[a.id]?.done) ? "done" : "interrogate";
  if (a.type === "talk" && h.npc) return "npc";
  return "look";
}

export function sceneView(c, st) {
  const s = c.scenes[st.scene];
  return {
    id: st.scene,
    name: s.name,
    art: s.art,
    bgm: s.bgm,
    hotspots: s.hotspots.filter((h) => hotspotVisible(st, h)).map((h) => ({
      id: h.id, label: h.label, x: h.x, y: h.y, w: h.w, h: h.h, npc: h.npc || null, state: hotspotState(c, st, h),
    })),
    exits: s.exits.filter((e) => allFlags(st, e.requires)).map((e) => ({ to: e.to, label: e.label, name: c.scenes[e.to].name })),
  };
}

function evidenceView(c, id) {
  const e = c.evidence[id];
  return { id, name: e.name, desc: e.desc, icon: e.icon, key: !!e.key };
}

export function stats(c, st, now = Date.now()) {
  const main = Object.entries(c.puzzles).filter(([, p]) => !p.hidden && !p.optional);
  const hidden = Object.entries(c.puzzles).filter(([, p]) => p.hidden);
  const optional = Object.entries(c.puzzles).filter(([, p]) => p.optional);
  return {
    elapsedSec: Math.round(((st.finishedAt || now) - st.startedAt) / 1000),
    solvedMain: main.filter(([id]) => st.solved[id]).length,
    totalMain: main.length,
    solvedHidden: hidden.filter(([id]) => st.solved[id]).length,
    totalHidden: hidden.length,
    solvedOptional: optional.filter(([id]) => st.solved[id]).length,
    totalOptional: optional.length,
    assists: Object.values(st.solved).filter((x) => x.assisted).length,
    hintsUsed: Object.values(st.hints).reduce((a, b) => a + b, 0),
    wrongAnswers: Object.values(st.wrong).reduce((a, b) => a + b, 0) + st.deduceWrong,
    evidence: st.evidence.length,
    totalEvidence: Object.keys(c.evidence).length,
    deductions: st.deductions.length,
    totalDeductions: c.deductions.length,
  };
}

export function snapshot(c, st, now = Date.now(), opts) {
  return withView(opts, () => snapshotInner(c, st, now));
}
function snapshotInner(c, st, now) {
  const ready = c.deductions.filter((d) => !st.deductions.includes(d.id) && d.cards.every((x) => st.evidence.includes(x)));
  return {
    // 추론가: 연결할 수 있는 추리의 카드 한 장만 귀띔
    reasonerCard: hasRole("reasoner") && ready.length ? ready[0].cards[0] : null,
    scene: sceneView(c, st),
    evidence: st.evidence.map((id) => evidenceView(c, id)),
    deductions: st.deductions.map((id) => {
      const d = c.deductions.find((x) => x.id === id);
      return { id, title: d.title, conclusion: d.conclusion, cards: d.cards };
    }),
    solved: Object.keys(st.solved),
    hypotheses: hypothesesView(c, st),
    notebook: notebookView(c, st),
    artFlags: (c.presentation?.artFlags || []).filter((f) => st.flags.has(f)),
    objective: objectiveView(c, st),
    // 카드가 모두 모였지만 아직 연결하지 않은 추리 수 (정답 조합은 알려 주지 않는다)
    deductionReady: c.deductions.filter((d) => !st.deductions.includes(d.id) && d.cards.every((x) => st.evidence.includes(x))).length,
    relations: (c.relations || []).filter((r) => allFlags(st, r.when)).map(({ a, b, kind, label }) => ({ a, b, kind, label })),
    stats: stats(c, st, now),
    ending: st.ending,
    result: st.ending ? buildResult(c, st, now) : null,
  };
}

// ---------- 지금 할 일 (presentation.objectives) ----------
// 첫 미완료 목표 + 지금 장소에서 그 장소로 가는 첫 이동 버튼(열린 출구만 따라 BFS)
function objectiveView(c, st) {
  if (st.ending) return null;
  const o = (c.presentation?.objectives || []).find((x) => (!x.from || st.flags.has(x.from)) && !st.flags.has(x.until));
  if (!o) return null;
  let exit = null;
  if (o.scene && o.scene !== st.scene && c.scenes[o.scene]) {
    const prev = new Map([[st.scene, null]]);
    const q = [st.scene];
    while (q.length && !prev.has(o.scene)) {
      const cur = q.shift();
      for (const e of c.scenes[cur]?.exits || []) if (!prev.has(e.to) && allFlags(st, e.requires)) { prev.set(e.to, cur); q.push(e.to); }
    }
    if (prev.has(o.scene)) { let n = o.scene; while (prev.get(n) !== st.scene) n = prev.get(n); exit = n; }
  }
  return { text: o.text, hotspot: o.scene === st.scene || !o.scene ? o.hotspot || null : null, exit, board: !!o.board };
}

// ---------- 수첩 (사건 데이터의 presentation 을 진행도만큼 계산) ----------
function pickRule(st, list) {
  let out = null;
  for (const r of list || []) if (allFlags(st, r[0])) out = r;
  return out;
}
function notebookView(c, st) {
  const P = c.presentation || {};
  const seen = Object.keys(c.characters).filter((id) => st.flags.has(`seen_${id}`));
  return {
    summary: P.summary || "",
    people: seen.map((id) => ({ id, note: P.notes?.[id] || "" })),
    openQuestions: (P.openQuestions || []).filter((q) => (!q.from || st.flags.has(q.from)) && !st.flags.has(q.until)).map((q) => q.text),
    timeline: (P.timeline || []).filter((x) => st.evidence.includes(x.ev)).map((x) => {
      const tag = x.kind === "doubt" ? (x.falseWhen && st.flags.has(x.falseWhen) ? ["false", "거짓으로 밝혀짐"] : ["claim", "주장"]) : x.kind === "claim" ? ["claim", "증언"] : ["fact", "확정"];
      return { tm: x.tm, t: x.t, tag: tag[0], label: tag[1], doubt: x.kind === "doubt" };
    }),
    suspects: (P.suspects || []).filter((x) => st.flags.has(`seen_${x.id}`)).map((x) => {
      const v = pickRule(st, x.verdict) || [[], "open", "조사 중"];
      return { id: x.id, motive: pickRule(st, x.motive)?.[1] || "?", alibi: pickRule(st, x.alibi)?.[1] || "?", note: pickRule(st, x.note)?.[1] || "", verdict: v[1], verdictLabel: v[2] };
    }),
  };
}

// ---------- 가설 ----------
export const HYP_LABELS = { unverified: "미검증", possible: "가능성 있음", contradicted: "모순 발견", confirmed: "확인됨", rejected: "기각됨" };
function hypothesesView(c, st) {
  return (c.hypotheses || []).filter((h) => allFlags(st, h.show)).map((h) => {
    let status = "unverified";
    for (const r of h.rules) if (allFlags(st, r.when)) status = r.status;
    return { id: h.id, text: h.text, status, label: HYP_LABELS[status] };
  });
}

// ---------- 심문 ----------
function interState(st, iid) {
  st.inter = st.inter || {};
  return st.inter[iid] || (st.inter[iid] = { revealed: null, pressed: [], broken: [], mistakes: 0, lockedAt: null });
}
// 대답 거부: 기회를 다 쓰면 새 증거를 찾거나 잠시(INTER_LOCK_MS) 기다리면 풀린다.
// (새 증거만으로 풀리게 하면, 남은 증거가 전부 이 심문 뒤에 있을 때 영영 막힌다)
const INTER_LOCK_MS = 30_000;
function interLockLeft(I, S, st, now) {
  if (S.mistakes < I.maxMistakes) return 0;
  const left = S.lockedAt === st.evidence.length ? INTER_LOCK_MS - (now - (S.lockedTs || 0)) : 0;
  if (left > 0) return left;
  S.mistakes = 0; S.lockedAt = null; S.lockedTs = null; // 풀리면 기회를 다시 채운다
  return 0;
}
function interView(c, st, iid, now = Date.now()) {
  const I = c.interrogations[iid];
  const S = interState(st, iid);
  if (!S.revealed) S.revealed = I.statements.filter((x) => !I.statements.some((y) => (y.press?.reveal || []).includes(x.id) || (y.contradiction?.reveal || []).includes(x.id))).map((x) => x.id);
  const lockLeft = interLockLeft(I, S, st, now);
  const locked = lockLeft > 0;
  return {
    id: iid, character: I.character, title: I.title,
    statements: I.statements.filter((x) => S.revealed.includes(x.id)).map((x) => ({
      id: x.id, text: x.text, pressed: S.pressed.includes(x.id), broken: S.broken.includes(x.id), canPress: !!x.press,
      suspicious: hasRole("psychologist") && !!x.contradiction && !S.broken.includes(x.id),
    })),
    mistakes: S.mistakes, maxMistakes: I.maxMistakes, locked, lockSec: Math.ceil(lockLeft / 1000), done: st.flags.has(I.done),
  };
}
function interReachable(c, st, iid) {
  const s2 = c.scenes[st.scene];
  return s2.hotspots.some((h) => h.action.type === "interrogate" && h.action.id === iid && hotspotVisible(st, h));
}
const REACTIONS = {
  lucien: [["lucien", "smile", "하! 그게 증거라고 내미는 거요?"], ["lucien", "suspicious", "그 물건이 내 말과 무슨 상관이오."], ["lucien", "angry", "시간 낭비 그만하시오."]],
  mayor: [["mayor", "angry", "그게 지금 이 말과 무슨 상관이오!"], ["mayor", "suspicious", "엉뚱한 걸 들이밀지 마시오."]],
  veronica: [["veronica", "nervous", "네? 그건… 무슨 뜻인지 모르겠어요."], ["veronica", "sad", "그걸로 저를 의심하시는 거예요?"]],
};
function interrogationAction(c, st, a, events, now) {
  const iid = a.id; const I = c.interrogations?.[iid];
  if (!I) return { ok: false, error: "NO_INTERROGATION" };
  if (!interReachable(c, st, iid)) return { ok: false, error: "LOCKED" };
  const S = interState(st, iid);
  const view = () => interView(c, st, iid, now);
  view();
  if (a.type === "interrogate") { events.push({ type: "interrogation", view: view(), intro: I.intro }); return { ok: true }; }
  const stmt = I.statements.find((x) => x.id === a.statement && S.revealed.includes(x.id));
  if (!stmt) return { ok: false, error: "NO_STATEMENT" };
  // 끝난 심문도 추궁(더 묻기)은 할 수 있다 — 새로 열린 증언 확인용. 반박만 막는다.
  if (st.flags.has(I.done) && a.type === "present") return { ok: true, already: true };
  if (a.type === "press") {
    if (!stmt.press) return { ok: false, error: "NO_PRESS" };
    if (!S.pressed.includes(stmt.id)) S.pressed.push(stmt.id);
    events.push({ type: "dialogue", lines: stmt.press.lines });
    for (const f of stmt.press.set || []) st.flags.add(f);
    for (const r of stmt.press.reveal || []) if (!S.revealed.includes(r)) { S.revealed.push(r); events.push({ type: "inter_reveal", statement: r }); }
    events.push({ type: "interrogation_update", view: view() });
    return { ok: true };
  }
  // present: 증거로 반박
  const left = interLockLeft(I, S, st, now);
  if (left > 0) {
    events.push({ type: "dialogue", lines: [[I.character, "angry", "더는 대답하지 않겠소. 확실한 걸 찾아오시오."]] });
    events.push({ type: "inter_wrong", msg: `${Math.ceil(left / 1000)}초 뒤에 다시 물어볼 수 있다. 그동안 수첩의 증거를 다시 읽어 보자.` });
    events.push({ type: "interrogation_update", view: view() });
    return { ok: true, correct: false, locked: true };
  }
  if (!st.evidence.includes(a.evidence)) return { ok: false, error: "NOT_OWNED" };
  const con = stmt.contradiction;
  if (con && con.evidence.includes(a.evidence)) {
    S.broken.push(stmt.id);
    events.push({ type: "inter_break", statement: stmt.id, evidence: a.evidence });
    if (con.lines?.length) events.push({ type: "dialogue", lines: con.lines });
    for (const f of con.set || []) st.flags.add(f);
    giveEvidence(c, st, con.give, events);
    for (const r of con.reveal || []) if (!S.revealed.includes(r)) { S.revealed.push(r); events.push({ type: "inter_reveal", statement: r }); }
    if (con.solves && !st.solved[con.solves]) solvePuzzle(c, st, con.solves, events, now);
    events.push({ type: "interrogation_update", view: view() });
    return { ok: true, correct: true };
  }
  // 틀린 반박: 반응 + 기회 감소. 다 쓰면 새 증거를 찾을 때까지 대답 거부 (무작위 제출 방지)
  S.mistakes++;
  st.wrong[`int_${iid}`] = (st.wrong[`int_${iid}`] || 0) + 1;
  const R = REACTIONS[I.character] || [[I.character, "neutral", "…"]];
  events.push({ type: "inter_wrong", msg: con ? "증언의 약점은 맞다. 하지만 그 증거로는 반박이 안 된다." : "이 증언 자체에는 모순이 없어 보인다." });
  events.push({ type: "dialogue", lines: [R[S.mistakes % R.length]] });
  if (S.mistakes >= I.maxMistakes) {
    S.lockedAt = st.evidence.length; S.lockedTs = now;
    events.push({ type: "dialogue", lines: [[I.character, "angry", "그만하시오. 더 할 말 없소."]] });
    events.push({ type: "inter_wrong", msg: `잠시 대답을 거부한다. ${INTER_LOCK_MS / 1000}초 뒤에 다시 물어보거나, 새 증거를 찾아오자.` });
  }
  events.push({ type: "interrogation_update", view: view() });
  return { ok: true, correct: false };
}

// ---------- 효과 적용 ----------
function giveEvidence(c, st, ids, events) {
  for (const id of ids || []) {
    if (!c.evidence[id] || st.evidence.includes(id)) continue;
    st.evidence.push(id);
    st.flags.add(`got_${id}`);
    events.push({ type: "evidence", evidence: evidenceView(c, id) });
  }
}

function applyEffects(c, st, eff, events) {
  if (!eff) return;
  if (eff.lines?.length) {
    events.push({ type: "dialogue", lines: eff.lines });
    for (const l of eff.lines) if (l[0] !== "narrator" && l[0] !== "detective") st.flags.add(`seen_${l[0]}`);
  }
  for (const f of eff.set || []) st.flags.add(f);
  giveEvidence(c, st, eff.give, events);
}

function runAutoFlags(c, st, events) {
  for (const a of c.autoFlags || []) {
    if (!has(st, a.set) && allFlags(st, a.when)) {
      st.flags.add(a.set);
      if (a.lines) events.push({ type: "dialogue", lines: a.lines });
      events.push({ type: "unlock", flag: a.set });
    }
  }
}

function pickDialogue(c, st, id) {
  const variants = c.dialogues[id] || [];
  return variants.find((v) => allFlags(st, v.when) && noneFlags(st, v.not)) || null;
}

export function startEvents(c, st) {
  const events = [];
  if (c.introDialogue && !has(st, "intro_done")) applyEffects(c, st, pickDialogue(c, st, c.introDialogue), events);
  return events;
}

// ---------- 퍼즐 공개 정보 ----------
function puzzleReachable(c, st, pid) {
  const p = c.puzzles[pid];
  if (!p || !allFlags(st, p.requires)) return false;
  const s = c.scenes[st.scene];
  return s.hotspots.some((h) => h.action.type === "puzzle" && h.action.puzzle === pid && hotspotVisible(st, h));
}

function puzzleView(c, st, pid) {
  const p = c.puzzles[pid];
  const pub = { ...p.public };
  if (p.type === "weights") pub.weighsLeft = st.weigh?.pid === pid ? p.public.maxWeighs - st.weigh.used : p.public.maxWeighs;
  if (p.type === "hidden") pub.found = foundView(p, st, pid);
  // 협동 정보 분산: 여러 명이면 각자 일부만 본다 (혼자면 전부). 정답 판정은 늘 전체 데이터로.
  const { index, count } = VIEW.split;
  let splitNote = null;
  if (p.split && count > 1) {
    if (p.split === "cipher") { pub.cipher = pub.cipher.map((n, i) => (i % count === index ? n : null)); splitNote = `숫자 ${pub.cipher.filter((x) => x !== null).length}개만 읽을 수 있다. 나머지는 동료가 가진 편지 조각에 있다.`; }
    if (p.split === "clues") { pub.clues = pub.clues.filter((_, i) => i % count === index); splitNote = `내가 들은 증언은 ${pub.clues.length}개뿐. 나머지 증언은 동료에게 물어보자.`; }
    if (p.split === "map" && index !== 0) { pub.grid = pub.grid.map((row) => row.replace(/[BH]/g, ".")); splitNote = "이 지도엔 빵집·시청 표시가 없다. 지도를 가진 동료(조사관)에게 피해야 할 곳을 물어보자."; }
  }
  const roleHint = (hasRole("engineer") && MECH_TYPES.has(p.type)) || (hasRole("cryptographer") && CODE_TYPES.has(p.type)) ? p.hints[0] : null;
  return {
    splitNote, roleHint, roleHintBy: roleHint ? (MECH_TYPES.has(p.type) ? "기술자" : "암호 전문가") : null,
    id: pid, title: p.title, type: p.type, difficulty: p.difficulty, difficultyName: DIFF_NAMES[p.difficulty] || "", desc: p.desc,
    hidden: !!p.hidden, optional: !!p.optional,
    public: pub, hintsUsed: st.hints[pid] || 0, hintsTotal: p.hints.length,
    hints: p.hints.slice(0, st.hints[pid] || 0),
    attempts: st.wrong[pid] || 0, assistable: canAssist(p, st, pid),
  };
}

export const DIFF_NAMES = { 1: "입문", 2: "쉬움", 3: "보통", 4: "어려움", 5: "전문가" };
// 최종 도움: 필수 퍼즐에서 힌트를 모두 보고도 두 번 이상 틀렸으면 넘어갈 수 있다 (진행 불능 방지)
const ASSIST_MIN_WRONG = 2;
function canAssist(p, st, pid) {
  return !p.hidden && !p.optional && (st.hints[pid] || 0) >= p.hints.length && (st.wrong[pid] || 0) >= ASSIST_MIN_WRONG;
}
function foundView(p, st, pid) {
  const f = st.found?.[pid] || [];
  return f.map((id) => ({ id, x: p.solution.targets[id][0], y: p.solution.targets[id][1] }));
}

// ---------- 퍼즐 판정 ----------
// 반환: { ok: true } 또는 { ok: false, msg }
const VALIDATORS = {
  circuit(p, ans) {
    const { size, tiles } = p.public;
    const rot = ans?.rot;
    if (!Array.isArray(rot) || rot.length !== size) return { ok: false, msg: "배선판 상태를 읽을 수 없다." };
    const mask = tiles.map((row, r) => row.map((t, c2) => (t.fixed ? t.m : rotMask(t.m, Number(rot[r]?.[c2]) || 0))));
    const [sr, sc] = p.solution.source;
    const seen = new Set([`${sr},${sc}`]);
    const q = [[sr, sc]];
    while (q.length) {
      const [r, c2] = q.shift();
      for (const d of Object.keys(DIRS)) {
        if (!(mask[r][c2] & BIT[d])) continue;
        const nr = r + DIRS[d][0], nc = c2 + DIRS[d][1];
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (!(mask[nr][nc] & BIT[OPP[d]])) continue;
        const k = `${nr},${nc}`;
        if (!seen.has(k)) { seen.add(k); q.push([nr, nc]); }
      }
    }
    const reached = p.solution.targets.filter(([r, c2]) => seen.has(`${r},${c2}`)).length;
    if (reached === p.solution.targets.length) return { ok: true };
    return { ok: false, msg: reached ? `시계 ${reached}개에는 신호가 닿았다. 아직 ${p.solution.targets.length - reached}개가 끊겨 있다.` : "탑의 신호가 어느 시계에도 닿지 않는다. 탑 단자에서부터 길을 이어 보자." };
  },

  slide(p, ans) {
    const { w, h, pieces, target } = p.public;
    const moves = ans?.moves;
    if (!Array.isArray(moves) || moves.length > 400) return { ok: false, msg: "움직임 기록을 읽을 수 없다." };
    const ps = pieces.map((x) => ({ ...x }));
    const occ = (r, c2, skip) => ps.some((q) => q !== skip && (q.dir === "h" ? q.r === r && c2 >= q.c && c2 < q.c + q.len : q.c === c2 && r >= q.r && r < q.r + q.len));
    for (const mv of moves) {
      const pc = ps.find((x) => x.id === mv?.id);
      const d = Math.sign(Number(mv?.d) || 0);
      const n = Math.abs(Number(mv?.d) || 0);
      if (!pc || !d || n > 6) return { ok: false, msg: "그 상자는 그렇게 움직일 수 없다." };
      for (let i = 0; i < n; i++) {
        const nr = pc.dir === "v" ? pc.r + d : pc.r;
        const nc = pc.dir === "h" ? pc.c + d : pc.c;
        const head = pc.dir === "h" ? (d > 0 ? [nr, nc + pc.len - 1] : [nr, nc]) : (d > 0 ? [nr + pc.len - 1, nc] : [nr, nc]);
        if (head[0] < 0 || head[1] < 0 || head[0] >= h || head[1] >= w || occ(head[0], head[1], pc)) return { ok: false, msg: "상자끼리 부딪힌다. 길이 막혀 있다." };
        pc.r = nr; pc.c = nc;
      }
    }
    const t = ps.find((x) => x.id === target);
    if (t.r === p.public.exitRow && t.c + t.len === w) return { ok: true };
    return { ok: false, msg: "고리가 아직 빗장 레버에 닿지 않았다." };
  },

  jigsaw(p, ans) {
    const n = p.public.cols * p.public.rows;
    const slots = ans?.slots, rots = ans?.rots;
    if (!Array.isArray(slots) || !Array.isArray(rots) || slots.length !== n) return { ok: false, msg: "조각이 모두 놓이지 않았다." };
    if (slots.some((x) => x === null || x === undefined)) return { ok: false, msg: "빈자리가 남아 있다." };
    const wrongPlace = slots.filter((pi, i) => Number(pi) !== i).length;
    const wrongRot = slots.filter((pi, i) => Number(pi) === i && ((Number(rots[i]) % 4) + 4) % 4 !== 0).length;
    if (!wrongPlace && !wrongRot) return { ok: true };
    if (wrongPlace) return { ok: false, generic: false, msg: `제자리에 놓인 조각은 ${n - wrongPlace}개. 그림이 아직 이어지지 않는다.` };
    return { ok: false, generic: false, msg: `자리는 맞는데, ${wrongRot}조각의 방향이 뒤틀려 있다.` };
  },

  cipher(p, ans) {
    const v = norm(ans?.text);
    if (p.solution.answers.some((a) => norm(a) === v)) return { ok: true };
    if (!v) return { ok: false, msg: "해독한 문장을 적어야 한다." };
    return { ok: false, msg: "말이 되지 않는다. 원판의 숫자를 그대로 읽은 건 아닌지, 편지 첫 줄의 '바늘' 이야기를 다시 읽어 보자." };
  },

  gears(p, ans) {
    const place = ans?.place || {};
    const { driver, lock, pegs, gears, lockDir } = p.public;
    const used = new Set();
    const nodes = [{ id: "driver", x: driver.x, y: driver.y, r: driver.r }];
    for (const pg of pegs) {
      const gid = place[pg.id];
      if (!gid) continue;
      const g = gears.find((x) => x.id === gid);
      if (!g || used.has(gid)) return { ok: false, msg: "같은 톱니를 두 번 쓸 수는 없다." };
      used.add(gid);
      nodes.push({ id: pg.id, x: pg.x, y: pg.y, r: g.r });
    }
    nodes.push({ id: "lock", x: lock.x, y: lock.y, r: lock.r });
    const mesh = (a, b) => Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - (a.r + b.r)) < 0.5;
    const overlap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 0.5;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if (overlap(nodes[i], nodes[j])) return { ok: false, msg: "톱니끼리 너무 겹쳐서 돌지 않는다." };
    }
    const dir = { driver: 1 };
    const q = ["driver"];
    while (q.length) {
      const id = q.shift();
      const a = nodes.find((x) => x.id === id);
      for (const b of nodes) {
        if (b.id === id || !mesh(a, b)) continue;
        const want = -dir[id];
        if (dir[b.id] === undefined) { dir[b.id] = want; q.push(b.id); } else if (dir[b.id] !== want) return { ok: false, msg: "톱니들이 서로 반대로 돌려다 맞물려 버렸다. 꼼짝도 하지 않는다." };
      }
    }
    if (dir.lock === undefined) return { ok: false, msg: "힘이 자물쇠 톱니까지 전해지지 않는다." };
    if (dir.lock !== lockDir) return { ok: false, msg: "자물쇠 톱니가 돌긴 하는데 시계 방향이다. 반대로 돌아야 한다." };
    return { ok: true };
  },

  order(p, ans) {
    const o = ans?.order;
    const sol = p.solution.order;
    if (!Array.isArray(o) || o.length !== sol.length) return { ok: false, msg: "카드가 모두 놓이지 않았다." };
    const right = o.filter((x, i) => x === sol[i]).length;
    if (right === sol.length) return { ok: true };
    return { ok: false, generic: false, msg: `순서가 어긋난다. 제자리에 있는 카드는 ${right}장.` };
  },

  number(p, ans) {
    const v = digits(ans?.text);
    if (p.solution.answers.includes(v)) return { ok: true };
    return { ok: false, msg: "그 시각의 책은 이 자리에 맞지 않는다. 시침과 분침의 관계를 보자." };
  },

  grid(p, ans) {
    const m = ans?.map || {};
    const sol = p.solution.map;
    const keys = Object.keys(sol);
    if (keys.some((k) => !m[k])) return { ok: false, msg: "아직 정하지 않은 사람이 있다." };
    const vals = keys.map((k) => m[k]);
    if (new Set(vals).size !== vals.length) return { ok: false, msg: "한 장소에 두 사람을 두면 증언과 어긋난다. 네 사람은 모두 다른 곳에 있었다." };
    const right = keys.filter((k) => m[k] === sol[k]).length;
    if (right === keys.length) return { ok: true };
    return { ok: false, msg: `${keys.length - right}명의 자리가 증언과 맞지 않는다.` };
  },

  contradiction(p, ans, st) {
    if (!ans?.statement || !ans?.evidence) return { ok: false, msg: "진술 하나와 증거 하나를 골라야 한다." };
    if (!st.evidence.includes(ans.evidence)) return { ok: false, msg: "가지고 있지 않은 증거다." };
    if (ans.statement !== p.solution.statement) return { ok: false, msg: "그 말 자체는 다른 증언과 어긋나지 않는다." };
    if (!p.solution.evidence.includes(ans.evidence)) return { ok: false, msg: "진술은 수상하지만, 그 증거로는 반박할 수 없다." };
    return { ok: true };
  },

  clock(p, ans) {
    const hh = ((Number(ans?.h) % 12) + 12) % 12;
    const mm = Number(ans?.m);
    const sh = p.solution.h % 12;
    if (hh === sh && mm === p.solution.m) return { ok: true };
    if (hh === sh) return { ok: false, msg: "시침은 맞는 것 같다. 분침이 가리키는 '날'을 다시 생각해 보자." };
    return { ok: false, msg: "쇠문은 움직이지 않는다. 도면의 '창건의 달'과 '창건의 날'은 어디에 적혀 있었나?" };
  },

  mirror(p, ans) {
    const { w, h, source, target, walls, mirrors } = p.public;
    const states = ans?.states;
    if (!Array.isArray(states) || states.length !== mirrors.length) return { ok: false, msg: "거울 상태를 읽을 수 없다." };
    const res = traceBeam(p.public, states.map((s) => (s === "/" ? "/" : "\\")));
    if (res.hit) return { ok: true };
    return { ok: false, msg: res.blocked ? "빛이 벽에 막혀 사라진다." : "빛이 감지판을 비켜 어둠 속으로 빠져나간다." };
    void w; void h; void source; void target; void walls;
  },

  melody(p, ans) {
    const s = ans?.seq;
    const sol = p.solution.seq;
    if (Array.isArray(s) && s.length === sol.length && s.every((x, i) => Number(x) === sol[i])) return { ok: true };
    return { ok: false, msg: "종소리가 어긋났다. 오스카가 알려 준 가락을 떠올려 보자." };
  },

  rings(p, ans) {
    const ops = ans?.ops;
    const { rings, steps, init } = p.public;
    if (!Array.isArray(ops) || ops.length > 300) return { ok: false, msg: "원판 기록을 읽을 수 없다." };
    const v = init.slice();
    for (const o of ops) {
      const i = Number(o);
      if (!(i >= 0 && i < rings)) return { ok: false, msg: "없는 원판이다." };
      v[i] = (v[i] + 1) % steps;
      if (i + 1 < rings) v[i + 1] = (v[i + 1] + 1) % steps;
    }
    if (v.every((x) => x === 0)) return { ok: true };
    return { ok: false, msg: "별 문양이 아직 한 줄로 서지 않았다." };
  },

  lock(p, ans) {
    const d = ans?.digits;
    const code = p.solution.code;
    if (!Array.isArray(d) || d.length !== code.length) return { ok: false, msg: "다이얼을 모두 맞춰야 한다." };
    if (d.every((x, i) => Number(x) === code[i])) return { ok: true };
    return { ok: false, msg: "자물쇠는 꿈쩍도 하지 않는다. 쪽지의 말을 다시 읽어 보자." };
  },

  path(p, ans) {
    const g = p.public.grid;
    const path = ans?.path;
    if (!Array.isArray(path) || path.length < 2 || path.length > 100) return { ok: false, msg: "길이 그려지지 않았다." };
    const at = (r, c2) => g[r]?.[c2];
    if (at(...path[0]) !== "S") return { ok: false, msg: "길은 여관(S)에서 시작해야 한다." };
    for (let i = 1; i < path.length; i++) {
      const [pr, pc] = path[i - 1], [r, c2] = path[i];
      if (Math.abs(pr - r) + Math.abs(pc - c2) !== 1) return { ok: false, msg: "길이 끊겨 있다." };
      const ch = at(r, c2);
      if (!ch || ch === "#") return { ok: false, msg: "건물을 뚫고 지나갈 수는 없다." };
      if (ch === "B") return { ok: false, msg: "빵집 앞을 지났다면 바실이 봤을 것이다. 바실은 여자 손님 하나만 봤다." };
      if (ch === "H") return { ok: false, msg: "시청 앞은 회의로 불이 켜져 있었다. 비서가 봤을 것이다." };
    }
    if (at(...path[path.length - 1]) !== "T") return { ok: false, msg: "길이 탑 아래 문(T)까지 닿지 않았다." };
    const steps = path.length - 1;
    if (steps > p.public.maxSteps) return { ok: false, msg: `들키지는 않았지만 ${steps}분이 걸린다. 11시 50분까지는 닿지 못한다.` };
    return { ok: true };
  },

  maze(p, ans) {
    const g = p.public.grid;
    const path = ans?.path;
    if (!Array.isArray(path) || path.length < 2 || path.length > 200) return { ok: false, msg: "길이 그려지지 않았다." };
    const at = (r, c2) => g[r]?.[c2];
    const [r0, c0] = path[0];
    if (at(r0, c0) !== "S") return { ok: false, msg: "길은 시계(S)에서 시작해야 한다." };
    for (let i = 1; i < path.length; i++) {
      const [pr, pc] = path[i - 1], [r, c2] = path[i];
      if (Math.abs(pr - r) + Math.abs(pc - c2) !== 1) return { ok: false, msg: "길이 끊겨 있다." };
      if (!at(r, c2) || at(r, c2) === "#") return { ok: false, msg: "벽을 뚫고 지나갈 수는 없다." };
    }
    const [rl, cl] = path[path.length - 1];
    if (at(rl, cl) === "T") return { ok: true };
    return { ok: false, msg: "길이 탑(T)까지 닿지 않았다." };
  },
};

export function traceBeam(pub, states) {
  const { w, h, source, target, walls, mirrors } = pub;
  const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`));
  const mir = new Map(mirrors.map((m, i) => [`${m.r},${m.c}`, states[i]]));
  let r = source.r, c = source.c, d = source.dir;
  const path = [];
  for (let step = 0; step < 200; step++) {
    r += DIRS[d][0]; c += DIRS[d][1];
    if (r < 0 || c < 0 || r >= h || c >= w) return { hit: false, blocked: false, path };
    const k = `${r},${c}`;
    if (wallSet.has(k)) return { hit: false, blocked: true, path };
    path.push([r, c]);
    if (r === target.r && c === target.c) return { hit: true, path };
    const m = mir.get(k);
    if (m === "/") d = { E: "N", N: "E", W: "S", S: "W" }[d];
    else if (m === "\\") d = { E: "S", S: "E", W: "N", N: "W" }[d];
  }
  return { hit: false, blocked: false, path };
}

// ---------- 추리 보드 ----------
function deduce(c, st, cards, events) {
  if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3) return { ok: false, error: "NEED_3_CARDS", msg: "증거 카드 세 장을 골라야 한다." };
  if (cards.some((id) => !st.evidence.includes(id))) return { ok: false, error: "NOT_OWNED", msg: "가지고 있지 않은 증거가 섞여 있다." };
  const set = new Set(cards);
  const match = c.deductions.find((d) => d.cards.length === 3 && d.cards.every((x) => set.has(x)));
  if (match) {
    if (st.deductions.includes(match.id)) return { ok: true, already: true, msg: "이미 정리한 추리다." };
    st.deductions.push(match.id);
    for (const f of match.set || []) st.flags.add(f);
    events.push({ type: "deduction", deduction: { id: match.id, title: match.title, conclusion: match.conclusion, cards: match.cards } });
    if (match.lines) events.push({ type: "dialogue", lines: match.lines });
    return { ok: true };
  }
  st.deduceWrong++;
  // 정답을 말하지 않고, 왜 이어지지 않는지만 짚는다
  let best = null, bestN = 0;
  for (const d of c.deductions) {
    if (st.deductions.includes(d.id)) continue;
    const n = d.cards.filter((x) => set.has(x)).length;
    if (n > bestN) { bestN = n; best = d; }
  }
  const nm = (id) => c.evidence[id].name;
  if (bestN === 2) {
    const odd = cards.find((x) => !best.cards.includes(x));
    return { ok: false, msg: `'${nm(cards.filter((x) => x !== odd)[0])}'와(과) '${nm(cards.filter((x) => x !== odd)[1])}'는 같은 이야기를 하고 있다. 하지만 '${nm(odd)}'는 그 이야기와 이어지지 않는다.` };
  }
  const topics = cards.map((id) => new Set(c.evidence[id].topic));
  const shared = [...topics[0]].filter((t) => topics[1].has(t) && topics[2].has(t));
  if (!shared.length) return { ok: false, msg: "세 증거가 가리키는 대상이 서로 다르다. 같은 질문(언제? 어디서? 누가? 왜?)에 답하는 증거끼리 모아 보자." };
  return { ok: false, msg: "같은 주제의 증거들이지만, 함께 놓아도 새로운 사실이 드러나지 않는다." };
}

// ---------- 최종 추리 / 결과 ----------
// 답 형식: { qid: { option, evidence } } (예전 형식 { qid: option } 도 받는다)
export function normalizeFinal(c, raw) {
  const out = {};
  for (const q of c.final.questions) {
    const v = raw?.[q.id];
    const option = typeof v === "string" ? v : v?.option;
    if (!q.options.some((o) => o.id === option)) return null;
    out[q.id] = { option, evidence: typeof v === "object" && v?.evidence ? String(v.evidence) : null };
  }
  return out;
}
function finalScore(c, answers) {
  const sol = c.final.solution;
  let correct = 0, backed = 0;
  for (const q of c.final.questions) {
    const a = answers?.[q.id]; const sq = sol[q.id];
    if (!a || a.option !== sq.answer) continue;
    correct++;
    if (a.evidence && sq.evidence.includes(a.evidence)) backed++;
  }
  return { correct, backed, total: c.final.questions.length };
}
function decideEnding(c, answers) {
  const sol = c.final.solution;
  if (answers.culprit?.option !== sol.culprit.answer) return "bad";
  const f = finalScore(c, answers);
  const rule = c.final.trueRule || { allCorrect: true, minEvidence: 0 };
  if ((!rule.allCorrect || f.correct === f.total) && f.backed >= rule.minEvidence) return "true";
  return "normal";
}

export function buildResult(c, st, now = Date.now()) {
  const s = stats(c, st, now);
  const f = finalScore(c, st.finalAnswers);
  const deduceAcc = st.deductions.length / Math.max(1, st.deductions.length + st.deduceWrong);
  // 최종 추리 정답 60 + 근거 20 + 추리 보드 정확도 20 − 도움 사용
  let accuracy = Math.max(0, Math.round((f.correct / f.total) * 60 + (f.backed / f.total) * 20 + deduceAcc * 20) - s.assists * 5);
  if (st.ending === "bad") accuracy = Math.min(accuracy, 40); // 범인을 틀리면 다른 답이 맞아도 40%까지
  const correct = f.correct;
  const titles = (c.titles || []).filter((t) => {
    const w = t.when;
    if (w.ending && w.ending !== st.ending) return false;
    if (w.hintsMax !== undefined && (s.hintsUsed > w.hintsMax || s.assists > 0)) return false;
    if (w.optionalMin !== undefined && s.solvedOptional < w.optionalMin) return false;
    if (w.hiddenMin !== undefined && s.solvedHidden < w.hiddenMin) return false;
    return true;
  }).map((t) => t.name);
  return { ending: st.ending, endingTitle: c.final.endings[st.ending].title, accuracy, finalCorrect: correct, finalTotal: f.total, finalBacked: f.backed, titles, chapters: chapterTimes(c, st), puzzles: puzzleTimes(st), ...s };
}

// 구간(장) 끝난 시각 기록: presentation.chapters 의 until 플래그가 처음 켜진 순간 / end = 엔딩
function stampChapters(c, st, now) {
  const ch = c.presentation?.chapters;
  if (!ch) return;
  st.chapters = st.chapters || {};
  ch.forEach((x, i) => { if (st.chapters[i] === undefined && (x.end ? !!st.ending : st.flags.has(x.until))) st.chapters[i] = now; });
}
function chapterTimes(c, st) {
  const ch = c.presentation?.chapters || [];
  let prev = st.startedAt;
  const out = [];
  ch.forEach((x, i) => {
    // 엔딩 구간은 결과를 만드는 순간(기록 전)에도 끝난 시각을 쓸 수 있게
    const t = st.chapters?.[i] ?? (x.end && st.ending ? st.finishedAt : undefined);
    if (t === undefined || t === null) return;
    out.push({ name: x.name, sec: Math.max(0, Math.round((t - prev) / 1000)) });
    prev = Math.max(prev, t);
  });
  return out;
}
function puzzleTimes(st) {
  return Object.entries(st.solved).map(([id, r]) => ({ id, ms: r.ms ?? null, wrong: st.wrong[id] || 0, hints: st.hints[id] || 0, assisted: !!r.assisted }));
}

// ---------- 행동 처리 (진입점) ----------
export function act(c, st, action, now = Date.now(), opts) {
  return withView(opts, () => {
    const events = [];
    st.lastActive = now;
    const res = dispatch(c, st, action || {}, events, now);
    if (res.ok) { runAutoFlags(c, st, events); stampChapters(c, st, now); }
    return { ...res, events };
  });
}

function dispatch(c, st, a, events, now) {
  if (st.ending && a.type !== "hint") return { ok: false, error: "CASE_CLOSED" };
  switch (a.type) {
    case "inspect": {
      const s = c.scenes[st.scene];
      const h = s.hotspots.find((x) => x.id === a.hotspot);
      if (!h || !hotspotVisible(st, h)) return { ok: false, error: "NO_HOTSPOT" };
      const ac = h.action;
      if (ac.type === "talk") {
        const v = pickDialogue(c, st, ac.dialogue);
        if (v) applyEffects(c, st, v, events);
        return { ok: true };
      }
      if (ac.type === "puzzle") {
        const p = c.puzzles[ac.puzzle];
        if (st.solved[ac.puzzle]) {
          const v = ac.after ? pickDialogue(c, st, ac.after) : null;
          events.push({ type: "dialogue", lines: v?.lines || [["detective", "", `「${p.title}」은(는) 이미 풀었다.`]] });
          return { ok: true };
        }
        if (!allFlags(st, p.requires)) {
          events.push({ type: "dialogue", lines: [["detective", "", "아직은 무엇을 해야 할지 모르겠다. 단서를 더 모아 보자."]] });
          return { ok: true };
        }
        if (p.type === "weights" && st.weigh?.pid !== ac.puzzle) st.weigh = newWeigh(ac.puzzle, p);
        st.opened = st.opened || {};
        if (!st.opened[ac.puzzle]) st.opened[ac.puzzle] = now;
        events.push({ type: "puzzle", puzzle: puzzleView(c, st, ac.puzzle) });
        return { ok: true };
      }
      if (ac.type === "interrogate") return interrogationAction(c, st, { type: "interrogate", id: ac.id }, events, now);
      if (ac.type === "final") {
        if (!allFlags(st, c.final.requires)) return { ok: false, error: "LOCKED" };
        events.push({ type: "final", intro: c.final.intro, questions: c.final.questions });
        return { ok: true };
      }
      return { ok: false, error: "BAD_ACTION" };
    }
    case "move": {
      const s = c.scenes[st.scene];
      const e = s.exits.find((x) => x.to === a.to);
      if (!e || !allFlags(st, e.requires)) return { ok: false, error: "LOCKED" };
      st.scene = e.to;
      events.push({ type: "scene" });
      return { ok: true };
    }
    case "solve": {
      const pid = a.puzzle;
      const p = c.puzzles[pid];
      if (!p) return { ok: false, error: "NO_PUZZLE" };
      if (st.solved[pid]) return { ok: true, already: true };
      if (!puzzleReachable(c, st, pid)) return { ok: false, error: "LOCKED" };
      if (p.type === "weights") return { ok: false, error: "USE_WEIGH" };
      if (p.type === "hidden") return { ok: false, error: "USE_PROBE" };
      const v = VALIDATORS[p.type]?.(p, a.answer, st);
      if (!v) return { ok: false, error: "NO_VALIDATOR" };
      if (!v.ok) {
        st.wrong[pid] = (st.wrong[pid] || 0) + 1;
        // 사건 데이터의 wrongMsg 가 있으면 그 문구 (사건마다 다른 말투·소재)
        events.push({ type: "puzzle_wrong", puzzle: pid, msg: (v.generic !== false && p.wrongMsg) || v.msg });
        return { ok: true, correct: false };
      }
      solvePuzzle(c, st, pid, events, now);
      return { ok: true, correct: true };
    }
    case "weigh": return weighAction(c, st, a, events, now);
    case "probe": return probeAction(c, st, a, events, now);
    case "press":
    case "present": return interrogationAction(c, st, a, events, now);
    case "assist": {
      const pid = a.puzzle; const p = c.puzzles[pid];
      if (!p) return { ok: false, error: "NO_PUZZLE" };
      if (st.solved[pid]) return { ok: true, already: true };
      if (!puzzleReachable(c, st, pid)) return { ok: false, error: "LOCKED" };
      if (!canAssist(p, st, pid)) return { ok: false, error: "NOT_ASSISTABLE" };
      solvePuzzle(c, st, pid, events, now, true);
      return { ok: true, correct: true, assisted: true };
    }
    case "hint": {
      const p = c.puzzles[a.puzzle];
      if (!p) return { ok: false, error: "NO_PUZZLE" };
      const n = st.hints[a.puzzle] || 0;
      if (n >= p.hints.length) return { ok: false, error: "NO_MORE_HINTS" };
      st.hints[a.puzzle] = n + 1;
      events.push({ type: "hint", puzzle: a.puzzle, index: n, text: p.hints[n], left: p.hints.length - n - 1 });
      return { ok: true };
    }
    case "deduce": {
      const r = deduce(c, st, a.cards, events);
      if (!r.ok && r.msg && !r.error) { events.push({ type: "deduce_wrong", msg: r.msg }); return { ok: true, correct: false }; }
      if (r.msg) events.push({ type: "deduce_info", msg: r.msg });
      return { ok: r.ok, error: r.error, correct: r.ok };
    }
    case "final": {
      if (!allFlags(st, c.final.requires)) return { ok: false, error: "LOCKED" };
      const ans = normalizeFinal(c, a.answers);
      if (!ans) return { ok: false, error: "INCOMPLETE" };
      // 가지고 있지 않은 증거를 근거로 내면 근거 없음으로 처리
      for (const q of c.final.questions) if (ans[q.id].evidence && !st.evidence.includes(ans[q.id].evidence)) ans[q.id].evidence = null;
      st.finalAnswers = ans;
      st.ending = decideEnding(c, st.finalAnswers);
      st.finishedAt = now;
      const e = c.final.endings[st.ending];
      events.push({ type: "ending", ending: st.ending, title: e.title, lines: e.lines, reveal: e.reveal || null, result: buildResult(c, st, now) });
      return { ok: true };
    }
    default: return { ok: false, error: "BAD_ACTION" };
  }
}

function solvePuzzle(c, st, pid, events, now, assisted = false) {
  const p = c.puzzles[pid];
  st.solved[pid] = { at: now, hints: st.hints[pid] || 0, wrong: st.wrong[pid] || 0, assisted, ms: st.opened?.[pid] ? now - st.opened[pid] : null };
  events.push({ type: "puzzle_solved", puzzle: pid, title: p.title, hidden: !!p.hidden, optional: !!p.optional, ptype: p.type, assisted });
  const cine = c.presentation?.cinematics?.[pid];
  if (cine) events.push({ type: "cinematic", ...cine });
  applyEffects(c, st, p.onSolve, events);
}

// ---------- 숨은 물건: 누른 좌표를 서버가 판정 (정답 위치는 클라이언트에 보내지 않는다) ----------
const PROBE_WINDOW_MS = 6000, PROBE_MAX_MISS = 5, PROBE_COOLDOWN_MS = 3000;
function probeAction(c, st, a, events, now) {
  const pid = a.puzzle; const p = c.puzzles[pid];
  if (!p || p.type !== "hidden") return { ok: false, error: "NO_PUZZLE" };
  if (st.solved[pid]) return { ok: true, already: true };
  if (!puzzleReachable(c, st, pid)) return { ok: false, error: "LOCKED" };
  const x = Number(a.x), y = Number(a.y);
  if (!(x >= 0 && x <= p.public.w && y >= 0 && y <= p.public.h)) return { ok: false, error: "BAD_PROBE" };
  st.probe = st.probe || {};
  const pr = st.probe[pid] || (st.probe[pid] = { misses: [], until: 0 });
  if (now < pr.until) { events.push({ type: "probe", puzzle: pid, hit: null, cooldown: pr.until - now }); return { ok: true }; }
  st.found = st.found || {};
  const found = st.found[pid] || (st.found[pid] = []);
  const hit = Object.entries(p.solution.targets).find(([id, [tx, ty, r]]) => !found.includes(id) && Math.hypot(tx - x, ty - y) <= r);
  if (hit) {
    found.push(hit[0]);
    events.push({ type: "probe", puzzle: pid, hit: hit[0], name: p.public.targets.find((t) => t.id === hit[0]).name, x: hit[1][0], y: hit[1][1], left: p.public.targets.length - found.length });
    if (found.length === p.public.targets.length) solvePuzzle(c, st, pid, events, now);
    return { ok: true, correct: found.length === p.public.targets.length };
  }
  pr.misses = pr.misses.filter((t) => now - t < PROBE_WINDOW_MS);
  pr.misses.push(now);
  st.wrong[pid] = (st.wrong[pid] || 0) + 1;
  // 아무 데나 연타하면 잠시 막는다 (무작위 클릭 방지)
  if (pr.misses.length >= PROBE_MAX_MISS) { pr.until = now + PROBE_COOLDOWN_MS; pr.misses = []; events.push({ type: "probe", puzzle: pid, hit: null, cooldown: PROBE_COOLDOWN_MS }); }
  else events.push({ type: "probe", puzzle: pid, hit: null, x, y });
  return { ok: true, correct: false };
}

// ---------- P10 천칭 (서버가 가짜 추를 숨기고 판정) ----------
function newWeigh(pid, p) {
  return { pid, fake: 1 + Math.floor(Math.random() * p.public.count), used: 0 };
}

function weighAction(c, st, a, events, now) {
  const pid = a.puzzle;
  const p = c.puzzles[pid];
  if (!p || p.type !== "weights") return { ok: false, error: "NO_PUZZLE" };
  if (st.solved[pid]) return { ok: true, already: true };
  if (!puzzleReachable(c, st, pid)) return { ok: false, error: "LOCKED" };
  if (st.weigh?.pid !== pid) st.weigh = newWeigh(pid, p);
  const W = st.weigh;
  const n = p.public.count;
  const valid = (arr) => Array.isArray(arr) && arr.every((x) => Number.isInteger(x) && x >= 1 && x <= n);
  if (a.pick !== undefined) {
    const pick = Number(a.pick);
    if (!(pick >= 1 && pick <= n)) return { ok: false, error: "BAD_PICK" };
    // 찍어서 맞히는 걸 막기 위해 천칭을 정해진 횟수만큼 다 쓴 뒤에만 지목할 수 있다
    if (W.used < p.public.maxWeighs) {
      events.push({ type: "puzzle_wrong", puzzle: pid, msg: `아직 확신할 수 없다. 천칭을 ${p.public.maxWeighs}번 모두 써서 가짜 추를 좁혀 보자.` });
      return { ok: true, correct: false, needWeigh: true };
    }
    if (pick === W.fake) { st.weigh = null; solvePuzzle(c, st, pid, events, now); return { ok: true, correct: true }; }
    st.wrong[pid] = (st.wrong[pid] || 0) + 1;
    st.weigh = newWeigh(pid, p);
    events.push({ type: "puzzle_wrong", puzzle: pid, msg: "그 추는 진짜였다. 승강대가 기울어 추가 모두 바닥에 쏟아졌다. 다시 섞어서 처음부터." , reset: true });
    return { ok: true, correct: false };
  }
  const L = a.left, R = a.right;
  if (!valid(L) || !valid(R) || !L.length || !R.length) return { ok: false, error: "BAD_WEIGH" };
  if (new Set([...L, ...R]).size !== L.length + R.length) return { ok: false, error: "BAD_WEIGH" };
  if (W.used >= p.public.maxWeighs) return { ok: false, error: "NO_WEIGHS", msg: "천칭은 더 쓸 수 없다. 가짜 추를 골라야 한다." };
  W.used++;
  const wl = L.length * 10 - (L.includes(W.fake) ? 1 : 0);
  const wr = R.length * 10 - (R.includes(W.fake) ? 1 : 0);
  const result = wl === wr ? "equal" : wl > wr ? "left" : "right"; // 무거운 쪽
  events.push({ type: "weigh", puzzle: pid, left: L, right: R, heavier: result, weighsLeft: p.public.maxWeighs - W.used });
  return { ok: true };
}
