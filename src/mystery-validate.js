// =========================
// 플듀 미스터리 — 사건 데이터 검사기
// 새 사건을 만들 때 오타·끊긴 연결을 미리 잡는다 (서버 시작과는 무관, 스크립트에서만 사용).
//   node scripts/validate-cases.mjs
// 검사: 없는 장소·퍼즐·대화·증거·인물을 가리키는지, 쓰이는데 아무 데서도 켜지지 않는 플래그,
//       수첩·연출(presentation) 참조, 최종 추리 정답 근거.
// 실제로 끝까지 풀리는지는 사건별 자동 플레이 테스트(scripts/test-mystery.mjs 형식)로 확인한다.
// =========================

const FLAG_USE_KEYS = new Set(["requires", "hideIf", "when", "not", "show"]);

export function validateCase(c) {
  const errors = [], warns = [];
  const err = (m) => errors.push(m), warn = (m) => warns.push(m);
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const P = c.presentation || {};

  for (const k of ["id", "title", "startScene", "characters", "evidence", "scenes", "dialogues", "puzzles", "final"]) if (!c[k]) err(`필수 항목 없음: ${k}`);
  if (errors.length) return { errors, warns };
  if (!has(c.scenes, c.startScene)) err(`startScene "${c.startScene}" 장소 없음`);
  if (c.introDialogue && !has(c.dialogues, c.introDialogue)) err(`introDialogue "${c.introDialogue}" 대화 없음`);

  // 켜질 수 있는 플래그 모음
  const setFlags = new Set();
  for (const id of Object.keys(c.evidence)) setFlags.add(`got_${id}`);
  for (const id of Object.keys(c.characters)) setFlags.add(`seen_${id}`);
  for (const a of c.autoFlags || []) setFlags.add(a.set);
  for (const it of Object.values(c.interrogations || {})) if (it.done) setFlags.add(it.done);
  const used = []; // [flag, where]

  // 데이터 전체를 훑으며 참조를 모은다
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const at = `${path}.${k}`;
      if (k === "set") (Array.isArray(v) ? v : [v]).forEach((f) => typeof f === "string" && setFlags.add(f));
      else if (FLAG_USE_KEYS.has(k) && Array.isArray(v) && v.every((x) => typeof x === "string")) v.forEach((f) => used.push([f, at]));
      else if (k === "give") { for (const e of v) if (!has(c.evidence, e)) err(`${at}: 없는 증거 ${e}`); }
      else if ((k === "puzzle" || k === "solves") && typeof v === "string" && !has(c.puzzles, v)) err(`${at}: 없는 퍼즐 ${v}`);
      else if (k === "dialogue" && typeof v === "string" && !has(c.dialogues, v)) err(`${at}: 없는 대화 ${v}`);
      else if (k === "lines" && Array.isArray(v)) for (const l of v) {
        if (!Array.isArray(l) || l.length < 3) { err(`${at}: 대사 형식은 [인물, 표정, 문장]`); continue; }
        if (!has(c.characters, l[0])) err(`${at}: 없는 인물 ${l[0]}`);
      }
      if (k !== "presentation") walk(v, at);
    }
  };
  walk({ scenes: c.scenes, dialogues: c.dialogues, puzzles: c.puzzles, interrogations: c.interrogations, hypotheses: c.hypotheses, relations: c.relations, deductions: c.deductions, autoFlags: c.autoFlags, final: c.final }, c.id);

  // 장소 · 조사 지점
  for (const [sid, sc] of Object.entries(c.scenes)) {
    const ids = new Set();
    for (const hs of sc.hotspots || []) {
      if (ids.has(hs.id)) err(`장소 ${sid}: 조사 지점 id 중복 ${hs.id}`);
      ids.add(hs.id);
      const a = hs.action || {};
      if (a.type === "move" && !has(c.scenes, a.to)) err(`${sid}.${hs.id}: 없는 장소로 이동 ${a.to}`);
      if (a.type === "interrogate" && !has(c.interrogations, a.id)) err(`${sid}.${hs.id}: 없는 심문 ${a.id}`);
      if (hs.npc && !has(c.characters, hs.npc)) err(`${sid}.${hs.id}: 없는 인물 ${hs.npc}`);
      for (const k of ["x", "y", "w", "h"]) if (typeof hs[k] === "number" && (hs[k] < 0 || hs[k] > 1)) warn(`${sid}.${hs.id}: ${k}=${hs[k]} 는 0~1 범위 밖`);
    }
  }
  // 심문
  for (const [iid, it] of Object.entries(c.interrogations || {})) {
    if (!has(c.characters, it.character)) err(`심문 ${iid}: 없는 인물 ${it.character}`);
    const sids = new Set((it.statements || []).map((s) => s.id));
    for (const s of it.statements || []) {
      for (const r of [...(s.press?.reveal || []), ...(s.contradiction?.reveal || [])]) if (!sids.has(r)) err(`심문 ${iid}.${s.id}: 없는 증언 ${r} 공개`);
      for (const e of s.contradiction?.evidence || []) if (!has(c.evidence, e)) err(`심문 ${iid}.${s.id}: 없는 증거 ${e}`);
    }
  }
  // 추리 보드
  for (const d of c.deductions || []) {
    for (const e of d.cards || []) if (!has(c.evidence, e)) err(`추리 ${d.id}: 없는 증거 ${e}`);
    if ((d.cards || []).length !== 3) warn(`추리 ${d.id}: 카드가 3장이 아님`);
  }
  for (const r of c.relations || []) for (const x of [r.a, r.b]) if (!has(c.characters, x)) err(`관계 ${r.a}-${r.b}: 없는 인물 ${x}`);

  // 최종 추리
  const qids = new Set((c.final.questions || []).map((q) => q.id));
  for (const [qid, sol] of Object.entries(c.final.solution || {})) {
    if (!qids.has(qid)) err(`최종 정답 ${qid}: 질문 없음`);
    const q = c.final.questions.find((x) => x.id === qid);
    if (q && !q.options.some((o) => o.id === sol.answer)) err(`최종 정답 ${qid}: 보기 중에 ${sol.answer} 없음`);
    for (const e of sol.evidence || []) if (!has(c.evidence, e)) err(`최종 정답 ${qid}: 없는 증거 ${e}`);
  }
  for (const q of c.final.questions || []) if (!has(c.final.solution, q.id)) err(`최종 질문 ${q.id}: 정답 없음`);
  for (const k of ["true", "normal", "bad"]) if (!c.final.endings?.[k]) err(`엔딩 ${k} 없음`);

  // 화면 연출 · 수첩
  if (!P.episode) warn("presentation.episode 없음 (사건 목록에 id 가 대신 보임)");
  for (const k of Object.keys(P.cinematics || {})) if (!has(c.puzzles, k)) err(`presentation.cinematics: 없는 퍼즐 ${k}`);
  for (const t of P.timeline || []) {
    if (!has(c.evidence, t.ev)) err(`presentation.timeline: 없는 증거 ${t.ev}`);
    if (t.falseWhen) used.push([t.falseWhen, "presentation.timeline"]);
  }
  for (const q of P.openQuestions || []) { used.push([q.until, "presentation.openQuestions"]); if (q.from) used.push([q.from, "presentation.openQuestions"]); }
  for (const x of P.chapters || []) if (!x.end) used.push([x.until, "presentation.chapters"]);
  for (const o of P.objectives || []) {
    if (!o.until.startsWith("__")) used.push([o.until, "presentation.objectives"]);
    if (o.from) used.push([o.from, "presentation.objectives"]);
    if (o.scene && !has(c.scenes, o.scene)) err(`presentation.objectives: 없는 장소 ${o.scene}`);
    if (o.hotspot && !(c.scenes[o.scene]?.hotspots || []).some((h) => h.id === o.hotspot)) err(`presentation.objectives: ${o.scene} 에 조사 지점 ${o.hotspot} 없음`);
  }
  for (const s of P.suspects || []) {
    if (!has(c.characters, s.id)) err(`presentation.suspects: 없는 인물 ${s.id}`);
    for (const col of ["motive", "alibi", "note", "verdict"]) for (const r of s[col] || []) for (const f of r[0]) used.push([f, `presentation.suspects.${s.id}.${col}`]);
  }
  for (const id of Object.keys(P.notes || {})) if (!has(c.characters, id)) err(`presentation.notes: 없는 인물 ${id}`);
  for (const id of Object.keys(P.relationLayout || {})) if (!has(c.characters, id)) err(`presentation.relationLayout: 없는 인물 ${id}`);
  for (const r of c.relations || []) for (const x of [r.a, r.b]) if (P.relationLayout && !P.relationLayout[x]) warn(`relationLayout 에 ${x} 자리 없음 (관계도 위쪽에 임시로 놓임)`);
  for (const f of P.artFlags || []) used.push([f, "presentation.artFlags"]);

  // 쓰이는데 켜질 곳이 없는 플래그
  const missing = new Map();
  for (const [f, at] of used) if (!setFlags.has(f) && !missing.has(f)) missing.set(f, at);
  for (const [f, at] of missing) err(`플래그 "${f}" 는 ${at} 에서 쓰이지만 어디서도 켜지지 않음`);

  return { errors, warns };
}
