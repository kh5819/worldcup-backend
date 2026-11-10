// =========================
// 플듀 마피아 — 추리 미니게임 8종 생성기 · 판정
// 모든 사건: 진실(범인·동선)을 먼저 만들고 → 종류별 단서·퍼즐을 뽑는다 → 논리적으로 정답이 하나인지 검사.
// 범인은 참가자 또는 NPC(외부 업체 직원)일 수 있다. 서버만 정답(answer)을 안다.
// clue: { id, kind, title, public?, ...data } — 참가자에게 나눠 주고, 본인이 공개(공유)할 수 있다.
// =========================
export const ROOMS = ["스튜디오 A", "편집실", "분장실", "회의실", "옥상 정원", "음향 부스", "로비"];
export const ADJ = { "스튜디오 A": ["분장실", "음향 부스", "로비"], "편집실": ["회의실", "음향 부스"], "분장실": ["스튜디오 A", "로비"], "회의실": ["편집실", "옥상 정원", "로비"], "옥상 정원": ["회의실"], "음향 부스": ["스튜디오 A", "편집실"], "로비": ["스튜디오 A", "분장실", "회의실"] };
export const TIMES = ["22:00", "22:30", "23:00", "23:30"];
export const ITEMS = [
  { id: "lipbalm", name: "보라색 립밤" }, { id: "battery", name: "스티커 붙은 보조배터리" }, { id: "pen", name: "빨간 볼펜" }, { id: "badge", name: "구겨진 출입증 끈" },
  { id: "earbud", name: "한쪽 무선 이어폰" }, { id: "coffee", name: "식은 아메리카노 컵" }, { id: "usb", name: "검은 USB" }, { id: "scarf", name: "체크무늬 머플러" },
];
export const NPC = { id: "npc", nick: "외부 업체 직원", npc: true };
const DEPTS = [{ d: "예능국", seal: "Y-7" }, { d: "보도국", seal: "B-2" }, { d: "기술국", seal: "T-4" }, { d: "편성국", seal: "P-9" }, { d: "외주팀", seal: "O-1" }];
const QUIRKS = [
  { id: "yong", label: "말끝 '~용'", s: (t) => (/요[.!?]?$/.test(t) ? t.replace(/요([.!?]?)$/, "용$1") : t.replace(/[.!?]?$/, "") + "용") },
  { id: "kkkk", label: "'ㅋㅋㅋㅋ' 네 번", s: (t) => t + " ㅋㅋㅋㅋ" },
  { id: "dots", label: "말줄임표 '…'", s: (t) => t.replace(/[.!]?$/, "…") },
  { id: "typo", label: "'됬다' 맞춤법", s: (t) => (t.includes("됐") ? t.replace(/됐/g, "됬") : t.replace(/[.!?]$/, "") + ", 다 됬다") },
  { id: "tilde", label: "물결 '~~'", s: (t) => t.replace(/[.!]?$/, "~~") },
  { id: "space", label: "띄어쓰기 없음", s: (t) => t.replace(/ /g, "") },
];
const POSTS = ["이 방송 진짜 망했어요.", "출연자들 다 연기하는 거 티 나요.", "제작진 일 처리 끝났어요.", "오늘 방송 사고 났다던데요.", "투표 조작 확실해요."];
const SAMPLES = ["오늘 리허설 잘 됐어요.", "커피 사러 갈 사람 있어요?", "대본 수정본 올렸어요.", "조명 다시 확인해 주세요.", "회의 끝나고 봐요."];

const KIND_INFO = {
  chat: { title: "SNS 악성 게시글", scene: "방송국 공식 계정에 익명 악플이 연달아 올라왔다." },
  location: { title: "수상한 출입 기록", scene: "통제 구역 문이 열린 기록은 없는데 서버실 장비가 사라졌다." },
  document: { title: "위조 문서", scene: "제출된 서류 중 하나가 위조된 것으로 의심된다." },
  statement: { title: "가짜 뉴스", scene: "어젯밤 상황에 대한 진술 중 하나가 거짓이다." },
  contradiction: { title: "증거 훼손", scene: "현장 증거 일부가 훼손됐다. 남은 증거끼리 맞지 않는 곳이 있다." },
  account: { title: "비밀 메시지", scene: "익명 계정이 밤새 내부 정보를 흘렸다." },
  timeline: { title: "알리바이 충돌", scene: "출연자들의 동선 진술이 서로 엇갈린다." },
  cctv: { title: "결정적 증거 발견", scene: "삭제됐던 CCTV 영상이 복구됐다. 다만 시간 표시가 지워져 있다." },
};

export function makeCase(mg, suspects, culpritId, rnd = Math.random, opt = {}) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ids = suspects.map((s) => s.id), inn = shuffle(ids.filter((id) => id !== culpritId));
  const nick = (id) => suspects.find((s) => s.id === id)?.nick || "?";
  const K = KIND_INFO[mg];
  const crimeRoom = pick(ROOMS.filter((r) => r !== "옥상 정원")), crimeTime = pick(TIMES.slice(1, 3));
  const camRooms = ROOMS.filter((r) => r !== "옥상 정원" && r !== crimeRoom);
  const base = { mg, title: K.title, scene: K.scene, crimeRoom, crimeTime, suspects: suspects.map((s) => ({ id: s.id, nick: s.nick, npc: !!s.npc })), culpritId };
  const clues = []; let puzzle = {}, answer = null, solveKind = "pick", truthMemo = pick(inn);
  // 공통 동선: 진범은 사건 시각 현장, 결백한 사람은 카메라 있는 방
  const tl = {}; for (const id of ids) { tl[id] = {}; for (const t of TIMES) tl[id][t] = pick(camRooms); }
  tl[culpritId][crimeTime] = crimeRoom;
  const cctvAt = (t) => camRooms.map((r) => ({ room: r, seen: ids.filter((id) => tl[id][t] === r) }));

  if (mg === "cctv") {
    // 시간 표시가 지워진 프레임 4장(같은 카메라: 로비 시계가 비침) → 순서 맞추기 → 보상: 사건 시각 전체 CCTV(검증)
    const frames = shuffle(TIMES.map((t, i) => ({ fid: "f" + i, time: t, clock: { h: Number(t.slice(0, 2)) % 12, m: Number(t.slice(3)) }, coffee: 100 - i * 30, room: "로비" })));
    puzzle = { frames: frames.map((f) => ({ fid: f.fid, clock: f.clock, coffee: f.coffee, room: f.room })), hint: "로비 벽시계와 커피잔을 보고 오래된 순서대로 놓으세요." };
    answer = TIMES.map((t) => frames.find((f) => f.time === t).fid); solveKind = "order";
    const item = pick(ITEMS); const bagOwners = [culpritId, inn[0]];
    for (const id of ids) clues.push({ id: "bag_" + id, kind: "bag", title: "소지품 검사", who: id, items: bagOwners.includes(id) ? [item.id, pick(ITEMS.filter((x) => x.id !== item.id)).id] : shuffle(ITEMS.filter((x) => x.id !== item.id)).slice(0, 2).map((x) => x.id) });
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 현장", text: `${K.scene} 현장(${crimeRoom})에서 '${item.name}'이(가) 발견됐다. 사건 시각 ${crimeTime}.`, item: item.id });
    // inn[0](증거물 공유자)은 사건 시각 CCTV에 찍혀 있어야 함
    base.reward = { id: "rw_cctv", kind: "cctvset", title: "복구된 CCTV (검증됨)", verified: true, time: crimeTime, cams: cctvAt(crimeTime) };
    base.keyItem = item.id;
  } else if (mg === "statement" || mg === "contradiction") {
    // 진술(알리바이) vs 사건 시각 CCTV. 진범은 카메라 있는 방을 댔지만 그 방 CCTV엔 없다
    const lie = pick(camRooms);
    const alibi = {}; for (const id of ids) alibi[id] = id === culpritId ? lie : tl[id][crimeTime];
    for (const c of cctvAt(crimeTime)) clues.push({ id: "cam_" + c.room, kind: "cctv", title: `CCTV · ${c.room}`, time: crimeTime, room: c.room, seen: c.seen });
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 개요", text: `${K.scene} 사건 시각은 ${crimeTime}, 장소는 ${crimeRoom}(카메라 사각지대).` });
    if (mg === "statement") {
      puzzle = { statements: shuffle(ids.map((id) => ({ sid: "s_" + id, who: id, text: `"${crimeTime}에 저는 ${alibi[id]}에 있었어요."` }))), hint: "CCTV 기록과 맞지 않는 진술 하나를 고르세요." };
      answer = "s_" + culpritId;
      base.reward = { id: "rw_stmt", kind: "verdict", verified: true, title: "거짓 진술 확인", who: culpritId, text: `${nick(culpritId)}의 진술은 CCTV와 맞지 않는다.` };
    } else {
      for (const id of ids) clues.push({ id: "alibi_" + id, kind: "alibi", title: "알리바이 진술", who: id, room: alibi[id], time: crimeTime });
      puzzle = { hint: "서로 맞지 않는 증거 두 장을 골라 제출하세요. (모든 증거는 공개된 것과 각자 손에 든 것을 합쳐 보세요)", cards: clues.filter((c) => c.kind !== "scene").map((c) => c.id) };
      answer = ["alibi_" + culpritId, "cam_" + lie].sort(); solveKind = "pair";
      base.reward = { id: "rw_pair", kind: "verdict", verified: true, title: "모순 확인", who: culpritId, text: `${nick(culpritId)}는 ${crimeTime}에 ${lie}에 있었다고 했지만 그 방 CCTV에 없다.` };
    }
  } else if (mg === "timeline") {
    // CCTV 카드(시간 포함)를 격자(용의자×시간)에 배치 → 사건 시각에 기록이 없는 단 한 명
    const cards = [];
    for (const id of ids) for (const t of TIMES) if (!(id === culpritId && t === crimeTime)) cards.push({ cid: `${id}_${t}`, who: id, time: t, room: tl[id][t] });
    const sh = shuffle(cards);
    sh.forEach((c, i) => clues.push({ id: "tc_" + c.cid, kind: "tcard", title: "동선 기록", who: c.who, time: c.time, room: c.room }));
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 개요", text: `${K.scene} 사건은 ${crimeTime} ${crimeRoom}에서. 모든 동선 기록을 표에 맞춰 넣으면 빈칸이 보인다.` });
    puzzle = { rows: ids, times: TIMES, hint: "모두가 가진 동선 기록을 모아 표를 채우세요. 사건 시각에 기록이 없는 사람은?" };
    answer = culpritId;
    base.reward = { id: "rw_tl", kind: "verdict", verified: true, title: "타임라인 재구성 완료", who: culpritId, text: `${crimeTime}에 기록이 없는 사람은 ${nick(culpritId)}뿐이다.` };
  } else if (mg === "chat") {
    // 익명 게시글 말버릇 2개 = 진범의 평소 말버릇. 다른 사람은 겹쳐도 하나뿐
    const qs = shuffle(QUIRKS), q1 = qs[0], q2 = qs[1];
    const own = {}; own[culpritId] = [q1.id, q2.id];
    inn.forEach((id, i) => { own[id] = [i % 2 ? q1.id : q2.id, qs[2 + (i % (qs.length - 2))].id]; });
    const apply = (t, qids) => qids.reduce((s, qid) => QUIRKS.find((q) => q.id === qid).s(s), t);
    puzzle = { posts: shuffle(POSTS).slice(0, 3).map((t) => apply(t, own[culpritId])), quirkList: QUIRKS.map((q) => ({ id: q.id, label: q.label })), hint: "익명 게시글의 말버릇 두 가지를 모두 가진 사람이 범인입니다." };
    for (const id of ids) clues.push({ id: "talk_" + id, kind: "talk", title: "평소 메시지", who: id, lines: shuffle(SAMPLES).slice(0, 2).map((t) => apply(t, own[id])), quirks: own[id] });
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 개요", text: K.scene });
    answer = culpritId;
    base.reward = { id: "rw_chat", kind: "verdict", verified: true, title: "말투 분석 완료", who: culpritId, text: `게시글 말버릇(${q1.label}·${q2.label})이 ${nick(culpritId)}와 일치한다.` };
  } else if (mg === "location") {
    // 출입 카드: 진범은 사건 전·후 모두 현장 '옆방'에서 찍힘. 다른 사람은 사건 전후 중 한 번은 먼 방
    const nb = ADJ[crimeRoom], far = ROOMS.filter((r) => r !== crimeRoom && !nb.includes(r));
    const pre = crimeTime === "22:30" ? "22:20" : "22:50", post = crimeTime === "22:30" ? "22:40" : "23:10";
    for (const id of ids) {
      const taps = id === culpritId ? [{ t: pre, room: pick(nb) }, { t: post, room: pick(nb) }] : (rnd() < 0.5 ? [{ t: pre, room: pick(far.length ? far : nb) }, { t: post, room: pick(nb) }] : [{ t: pre, room: pick(nb) }, { t: post, room: pick(far.length ? far : nb) }]);
      if (id !== culpritId && !far.length) taps[0].room = "옥상 정원";
      clues.push({ id: "tap_" + id, kind: "tap", title: "출입 카드 기록", who: id, taps });
    }
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 개요", text: `${K.scene} 사건은 ${crimeTime} ${crimeRoom}. 10분 안에는 바로 옆방까지만 갈 수 있다.` });
    puzzle = { map: ADJ, crimeRoom, crimeTime, hint: "사건 10분 전과 10분 후 모두 현장 옆방에 있었던 사람만 현장에 갈 수 있었습니다." };
    answer = culpritId;
    base.reward = { id: "rw_loc", kind: "verdict", verified: true, title: "위치 추적 완료", who: culpritId, text: `사건 전후로 현장에 닿을 수 있었던 사람은 ${nick(culpritId)}뿐이다.` };
  } else if (mg === "document") {
    // 부서별 직인 규칙(공개) + 발급 마감일. 위조 문서는 정확히 하나(직인 불일치 또는 마감 후 발급)
    const deadline = 7;
    const docs = ids.map((id) => { const d = pick(DEPTS); return { did: "doc_" + id, who: id, dept: d.d, seal: d.seal, day: 1 + Math.floor(rnd() * deadline) }; });
    const f = docs.find((d) => d.who === culpritId);
    if (rnd() < 0.5) f.seal = pick(DEPTS.filter((x) => x.d !== f.dept)).seal; else f.day = deadline + 1 + Math.floor(rnd() * 3);
    for (const d of docs) clues.push({ id: d.did, kind: "doc", title: "제출 서류", who: d.who, dept: d.dept, seal: d.seal, day: d.day });
    clues.push({ id: "scene", kind: "scene", public: true, title: "서류 규정", text: `발급은 매월 ${deadline}일까지만. 부서 직인: ${DEPTS.map((d) => d.d + " " + d.seal).join(", ")}` });
    puzzle = { depts: DEPTS, deadline, hint: "규정에 맞지 않는 서류 하나를 찾으세요." };
    answer = "doc_" + culpritId;
    base.reward = { id: "rw_doc", kind: "verdict", verified: true, title: "위조 판별 완료", who: culpritId, text: `${nick(culpritId)}의 서류가 위조됐다.` };
  } else if (mg === "account") {
    // 익명 계정 글 시간 3개. 진범만 세 시간 모두 일정이 비어 있음
    const slots = ["22:05", "22:35", "23:05", "23:35"], posts = shuffle(slots).slice(0, 3).sort();
    for (const id of ids) {
      const busy = id === culpritId ? slots.filter((s) => !posts.includes(s)) : [pick(posts), ...(rnd() < 0.5 ? [pick(slots)] : [])];
      clues.push({ id: "sch_" + id, kind: "schedule", title: "업무 일정표", who: id, busy: [...new Set(busy)].sort() });
    }
    puzzle = { posts, hint: "익명 계정이 글을 쓴 세 시간에 모두 일정이 비어 있던 사람은? (일정 중엔 휴대폰 사용 금지)" };
    clues.push({ id: "scene", kind: "scene", public: true, title: "사건 개요", text: `${K.scene} 글 작성 시각: ${posts.join(", ")}` });
    answer = culpritId;
    base.reward = { id: "rw_acc", kind: "verdict", verified: true, title: "활동 기록 비교 완료", who: culpritId, text: `세 시간 모두 비어 있던 사람은 ${nick(culpritId)}뿐이다.` };
  }
  // 정답이 하나인지 검사 (종류별)
  if (!verifyUnique(mg, base, clues, puzzle, answer)) return makeCase(mg, suspects, culpritId, rnd, opt);
  return { ...base, clues, puzzle, answer, solveKind, truthMemo, extraClue: null };
}

function verifyUnique(mg, base, clues, puzzle, answer) {
  const ids = base.suspects.map((s) => s.id), cul = base.culpritId;
  const C = (k) => clues.filter((c) => c.kind === k);
  if (mg === "cctv") {
    const seen = new Set(base.reward.cams.flatMap((c) => c.seen));
    const cand = ids.filter((id) => !seen.has(id) && C("bag").find((b) => b.who === id).items.includes(base.keyItem));
    return cand.length === 1 && cand[0] === cul;
  }
  if (mg === "statement" || mg === "contradiction") {
    const cams = C("cctv"); const bad = ids.filter((id) => { const room = mg === "contradiction" ? C("alibi").find((a) => a.who === id).room : puzzle.statements.find((s) => s.who === id).text.match(/저는 (.+)에 있었어요/)[1]; const cam = cams.find((c) => c.room === room); return cam && !cam.seen.includes(id); });
    return bad.length === 1 && bad[0] === cul;
  }
  if (mg === "timeline") { const missing = ids.filter((id) => !C("tcard").some((c) => c.who === id && c.time === base.crimeTime)); return missing.length === 1 && missing[0] === cul; }
  if (mg === "chat") { const need = clues.find((c) => c.id === "talk_" + cul).quirks; const cand = C("talk").filter((t) => need.every((q) => t.quirks.includes(q))); return cand.length === 1 && cand[0].who === cul; }
  if (mg === "location") { const nb = ADJ[base.crimeRoom]; const cand = C("tap").filter((t) => t.taps.every((x) => nb.includes(x.room))); return cand.length === 1 && cand[0].who === cul; }
  if (mg === "document") { const p = puzzle; const bad = C("doc").filter((d) => d.day > p.deadline || p.depts.find((x) => x.d === d.dept).seal !== d.seal); return bad.length === 1 && bad[0].who === cul; }
  if (mg === "account") { const cand = C("schedule").filter((s) => puzzle.posts.every((p) => !s.busy.includes(p))); return cand.length === 1 && cand[0].who === cul; }
  return false;
}

/** 미니게임 제출 판정 */
export function checkSolve(c, sol) {
  if (c.solveKind === "order") return Array.isArray(sol) && sol.length === c.answer.length && sol.every((x, i) => x === c.answer[i]);
  if (c.solveKind === "pair") return Array.isArray(sol) && sol.length === 2 && [...sol].sort().join("|") === c.answer.join("|");
  return String(sol) === String(c.answer);
}

/** 증거 조작범: 손에 든 단서를 그럴듯하게 바꿈 (결백한 사람에게 혐의가 가도록) */
export function forgeClue(clue, c, rnd = Math.random) {
  const inn = c.suspects.map((s) => s.id).filter((id) => id !== c.culpritId);
  const victim = inn[Math.floor(rnd() * inn.length)];
  const f = { ...clue, forged: true };
  if (f.seen) f.seen = f.seen.filter((id) => id !== victim);
  else if (f.items && c.keyItem) f.items = [...new Set([c.keyItem, ...f.items])].slice(0, 2);
  else if (f.kind === "alibi" || f.kind === "tcard") f.room = c.crimeRoom;
  else if (f.busy) f.busy = [];
  else if (f.kind === "doc") f.day = 9;
  else if (f.kind === "tap") f.taps = f.taps.map((t) => ({ ...t, room: (c.puzzle.map?.[c.crimeRoom] || [t.room])[0] }));
  else if (f.kind === "talk") f.lines = f.lines.map((l) => l + " ㅋㅋㅋㅋ");
  return f;
}
