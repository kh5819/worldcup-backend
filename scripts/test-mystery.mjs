// 플듀 미스터리 EP.01 검증: 데이터 무결성 + 퍼즐 풀이 가능성 + 처음~엔딩 자동 플레이 (3개 엔딩)
// 실행: node scripts/test-mystery.mjs
import { EP01 as C } from "../src/mystery-ep01.js";
import { createSession, act, snapshot, startEvents, publicCaseInfo, traceBeam, serializeSession, restoreSession } from "../src/mystery-engine.js";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error("  ✗", msg); } };
const section = (t) => console.log("\n■ " + t);

// ---------- 1. 데이터 무결성 ----------
section("데이터 무결성");
for (const [sid, s] of Object.entries(C.scenes)) {
  for (const h of s.hotspots) {
    const a = h.action;
    if (a.type === "talk") ok(C.dialogues[a.dialogue], `${sid}/${h.id}: 대화 ${a.dialogue} 없음`);
    if (a.type === "puzzle") ok(C.puzzles[a.puzzle], `${sid}/${h.id}: 퍼즐 ${a.puzzle} 없음`);
    if (a.after) ok(C.dialogues[a.after], `${sid}/${h.id}: after ${a.after} 없음`);
  }
  for (const e of s.exits) ok(C.scenes[e.to], `${sid}: 출구 ${e.to} 없음`);
}
const allGive = [];
for (const vs of Object.values(C.dialogues)) for (const v of vs) { allGive.push(...(v.give || [])); for (const l of v.lines) ok(C.characters[l[0]], `대사 화자 ${l[0]} 없음`); }
for (const p of Object.values(C.puzzles)) { allGive.push(...(p.onSolve.give || [])); ok(p.hints.length === 3, `${p.title}: 힌트 3단계 아님`); }
for (const it of Object.values(C.interrogations || {})) for (const st of it.statements) allGive.push(...(st.contradiction?.give || []));
for (const id of allGive) ok(C.evidence[id], `증거 ${id} 정의 없음`);
for (const id of Object.keys(C.evidence)) ok(allGive.includes(id), `증거 ${id}를 얻는 방법이 없음`);
for (const d of C.deductions) for (const e of d.cards) ok(C.evidence[e], `${d.id}: 카드 ${e} 없음`);
const mainCount = Object.values(C.puzzles).filter((p) => !p.hidden && !p.optional).length;
const hiddenCount = Object.values(C.puzzles).filter((p) => p.hidden).length;
const optCount = Object.values(C.puzzles).filter((p) => p.optional).length;
ok(mainCount === 17, `필수 퍼즐 17개 (지금 ${mainCount})`);
ok(Object.values(C.puzzles).every((p) => p.difficulty >= 1 && p.difficulty <= 5), "난이도는 1~5");
console.log(`  선택 조사 퍼즐 ${optCount}개`);
ok(hiddenCount === 3, `숨김 퍼즐 ${hiddenCount}개 (3개여야 함)`);
ok(Object.keys(C.evidence).length >= 15, "증거 15개 미만");
console.log(`  퍼즐 ${mainCount}+${hiddenCount}, 증거 ${Object.keys(C.evidence).length}, 추리 ${C.deductions.length}`);

// ---------- 2. 퍼즐별 풀이 계산 + 유일성/초기 미해결 확인 ----------
section("퍼즐 풀이 계산");
const rotMask = (m, k) => { let r = m; for (let i = 0; i < k; i++) r = ((r << 1) | (r >> 3)) & 15; return r; };
const ANS = {};

// P01: 경로 칸의 필요한 모양 → 회전값 계산
{
  const need = { "2,1": 14, "2,2": 11, "1,2": 5, "2,3": 10, "2,4": 13, "1,4": 5, "3,4": 5, "3,1": 5 };
  const t = C.puzzles.P01.public.tiles;
  const rot = t.map((row, r) => row.map((x, c) => {
    const k = `${r},${c}`;
    if (x.fixed) return 0;
    if (need[k] === undefined) return x.r;
    const kk = [0, 1, 2, 3].find((q) => rotMask(x.m, q) === need[k]);
    ok(kk !== undefined, `P01 ${k}: 모양 ${x.m}로 ${need[k]}를 만들 수 없음`);
    return kk;
  }));
  ANS.P01 = { rot };
  const init = t.map((row) => row.map((x) => x.r));
  const s = createSession(C); s.flags.add("met_isabel");
  const r0 = act(C, s, { type: "solve", puzzle: "P01", answer: { rot: init } });
  ok(r0.correct === false, "P01 초기 상태가 이미 풀려 있음");
}

// P02: BFS로 최단 풀이
{
  const pub = C.puzzles.P02.public;
  const key = (ps) => ps.map((p) => `${p.r},${p.c}`).join("|");
  const occ = (ps, r, c, skip) => ps.some((q, i) => i !== skip && (q.dir === "h" ? q.r === r && c >= q.c && c < q.c + q.len : q.c === c && r >= q.r && r < q.r + q.len));
  const start = pub.pieces.map((p) => ({ ...p }));
  const seen = new Map([[key(start), null]]);
  const q = [start]; let goal = null;
  while (q.length && !goal) {
    const ps = q.shift();
    for (let i = 0; i < ps.length && !goal; i++) for (const d of [-1, 1]) {
      const p = ps[i]; const np = { ...p };
      if (p.dir === "h") np.c += d; else np.r += d;
      const head = p.dir === "h" ? [np.r, d > 0 ? np.c + np.len - 1 : np.c] : [d > 0 ? np.r + np.len - 1 : np.r, np.c];
      if (head[0] < 0 || head[1] < 0 || head[0] >= pub.h || head[1] >= pub.w || occ(ps, head[0], head[1], i)) continue;
      const nps = ps.map((x, j) => (j === i ? np : x)); const k = key(nps);
      if (seen.has(k)) continue;
      seen.set(k, { prev: key(ps), mv: { id: p.id, d } }); q.push(nps);
      const t = nps.find((x) => x.id === pub.target);
      if (t.r === pub.exitRow && t.c + t.len === pub.w) goal = k;
    }
  }
  ok(goal, "P02 풀 수 없음");
  const moves = []; let k = goal;
  while (seen.get(k)) { moves.unshift(seen.get(k).mv); k = seen.get(k).prev; }
  ANS.P02 = { moves };
  console.log(`  P02 최단 ${moves.length}칸 이동`);
}

{ const n = C.puzzles.P03.public.cols * C.puzzles.P03.public.rows; ANS.P03 = { slots: [...Array(n).keys()], rots: Array(n).fill(0) }; ok(n === 12, "P03 12조각"); }
ANS.P04 = { text: "탑 아래에서 기다린다" };
{ // P04 해독 확인
  const pub = C.puzzles.P04.public;
  const dec = pub.cipher.map((n) => pub.disc[n - 3 - 1]).join("");
  ok(dec === "탑아래에서기다린다", `P04 해독 결과 불일치: ${dec}`);
}

// P05: 모든 배치 탐색
{
  const pub = C.puzzles.P05.public;
  const opts = [null, ...pub.gears.map((g) => g.id)];
  const sols = [];
  const rec = (i, place, used) => {
    if (i === pub.pegs.length) {
      const s = createSession(C); s.scene = "workshop"; s.flags.add("d1"); s.flags.add("isabel_clock");
      const r = act(C, s, { type: "solve", puzzle: "P05", answer: { place } });
      if (r.correct) sols.push({ ...place });
      return;
    }
    for (const o of opts) {
      if (o && used.has(o)) continue;
      const np = { ...place }; if (o) np[pub.pegs[i].id] = o;
      rec(i + 1, np, o ? new Set([...used, o]) : used);
    }
  };
  rec(0, {}, new Set());
  ok(sols.length >= 1, "P05 풀 수 없음");
  console.log(`  P05 정답 배치 ${sols.length}개:`, JSON.stringify(sols));
  ANS.P05 = { place: sols[0] };
}
// T1: 모든 배치 탐색 — 맞물리는 '핵심' 배치가 하나뿐인지 (맞물리지 않는 군더더기 톱니는 같은 풀이로 본다)
{
  const pub = C.puzzles.T1.public;
  const opts = [null, ...pub.gears.map((g) => g.id)];
  const sols = [];
  const rec = (i, place, used) => {
    if (i === pub.pegs.length) {
      const s = createSession(C); s.flags.add("tower_open"); s.scene = "tower_back";
      if (act(C, s, { type: "solve", puzzle: "T1", answer: { place } }).correct) sols.push({ ...place });
      return;
    }
    for (const o of opts) { if (o && used.has(o)) continue; const np = { ...place }; if (o) np[pub.pegs[i].id] = o; rec(i + 1, np, o ? new Set([...used, o]) : used); }
  };
  rec(0, {}, new Set());
  const core = new Set(sols.map((x) => `${x.A}|${x.B}|${x.C}`));
  ok(sols.length >= 1 && core.size === 1, `T1 핵심 배치 1개여야 함 (${[...core].join(" / ")})`);
  console.log(`  T1 정답 배치 ${sols.length}개 (핵심 ${core.size}개)`);
  ANS.T1 = { place: sols[0] };
}
{ // T2: 4원판 계산 + 힌트 숫자 확인
  const { init, steps, rings } = C.puzzles.T2.public;
  const cnt = []; let carry = 0;
  for (let i = 0; i < rings; i++) { const c = (((steps - init[i] - carry) % steps) + steps) % steps; cnt.push(c); carry = c; }
  ANS.T2 = { ops: cnt.flatMap((c, i) => Array(c).fill(i)) };
  ok(cnt.join(",") === "6,4,1,2", `T2 횟수가 힌트와 다름 (${cnt})`);
  const s = createSession(C); s.scene = "tower"; s.flags.add("t1"); ok(act(C, s, { type: "solve", puzzle: "T2", answer: { ops: [] } }).correct === false, "T2 초기 상태가 이미 풀려 있음");
}
{ // C1: 다섯 시간 더하기 해독
  const pub = C.puzzles.C1.public;
  const dec = pub.cipher.map((n) => pub.disc[((n + 5 - 1) % 12)]).join("");
  ok(dec === "일지는종뒤에", `C1 해독 결과 불일치: ${dec}`);
  ANS.C1 = { text: "일지는 종 뒤에" };
  ok(pub.cipher.map((n) => pub.disc[n - 1]).join("") !== dec, "C1 숫자를 그대로 읽어도 풀리면 안 됨");
}
ANS.C2 = { order: C.puzzles.C2.solution.order };
ANS.C3 = { statement: "s3", evidence: "E25" };
ANS.P06 = { order: C.puzzles.P06.solution.order };
ANS.P07 = { text: "4:20" };
ANS.P08 = { map: C.puzzles.P08.solution.map };
ANS.P09 = { statement: "s3", evidence: "E01" };
ANS.P11 = { h: 3, m: 15 };

// P12: 거울 2^n 전수
{
  const pub = C.puzzles.P12.public;
  const n = pub.mirrors.length; const sols = [];
  for (let b = 0; b < 1 << n; b++) {
    const st = pub.mirrors.map((_, i) => ((b >> i) & 1 ? "/" : "\\"));
    if (traceBeam(pub, st).hit) sols.push(st.join(""));
  }
  ok(sols.length >= 1, "P12 풀 수 없음");
  ok(!traceBeam(pub, pub.mirrors.map((m) => m.s)).hit, "P12 초기 상태가 이미 풀려 있음");
  console.log(`  P12 정답 거울 조합 ${sols.length}개 / ${1 << n}`);
  ANS.P12 = { states: sols[0].split("") };
}
ANS.H1 = { seq: [5, 3, 4, 2, 1] };
ANS.S1 = { digits: [5, 3, 8, 1] };
{ // S1: 쪽지 규칙(빨간 점 시계의 시침, 왼쪽부터)이 정답과 일치하는지
  const code = C.puzzles.S1.public.clocks.filter((c) => c.dot).map((c) => c.h % 10);
  ok(code.join("") === C.puzzles.S1.solution.code.join(""), `S1 쪽지 규칙 = 비밀번호 (${code.join("")})`);
}
{ // S3: 10칸 이내 · B/H 회피 경로를 전부 센다 (의도한 정답이 하나인지)
  const g = C.puzzles.S3.public.grid; const max = C.puzzles.S3.public.maxSteps;
  let s0; g.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "S") s0 = [r, c]; }));
  const sols = [];
  const dfs = (path) => {
    const [r, c] = path[path.length - 1];
    if (g[r][c] === "T") { sols.push(path.slice()); return; }
    if (path.length - 1 >= max) return;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc, ch = g[nr]?.[nc];
      if (!ch || "#BH".includes(ch) || path.some(([a, b]) => a === nr && b === nc)) continue;
      path.push([nr, nc]); dfs(path); path.pop();
    }
  };
  dfs([s0]);
  ok(sols.length >= 1, "S3 풀 수 있음");
  console.log(`  S3 조건을 만족하는 경로 ${sols.length}개 (최단 ${Math.min(...sols.map((x) => x.length - 1))}칸)`);
  ANS.S3 = { path: sols[0] };
}
{ // H2: 계산
  const { init, steps } = C.puzzles.H2.public;
  const a = (steps - init[0]) % steps, b = (((steps - init[1] - a) % steps) + steps) % steps, c = (((steps - init[2] - b) % steps) + steps) % steps;
  ANS.H2 = { ops: [...Array(a).fill(0), ...Array(b).fill(1), ...Array(c).fill(2)] };
  console.log(`  H2 바깥 ${a} · 가운데 ${b} · 안쪽 ${c}`);
}
{ // H3: 미로 BFS
  const g = C.puzzles.H3.public.grid;
  let s, t; g.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "S") s = [r, c]; if (ch === "T") t = [r, c]; }));
  const prev = new Map([[s.join(), null]]); const q = [s];
  while (q.length) { const [r, c] = q.shift(); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = r + dr, nc = c + dc; if (!g[nr]?.[nc] || g[nr][nc] === "#" || prev.has(`${nr},${nc}`)) continue; prev.set(`${nr},${nc}`, [r, c]); q.push([nr, nc]); } }
  ok(prev.has(t.join()), "H3 미로 출구 없음");
  const path = []; let k = t; while (k) { path.unshift(k); k = prev.get(k.join()); }
  ANS.H3 = { path };
  console.log(`  H3 경로 ${path.length}칸`);
}

// ---------- 3. 자동 플레이 ----------
function play(ending) {
  const s = createSession(C, 0);
  const log = [];
  const ev = startEvents(C, s);
  ok(ev.some((e) => e.type === "dialogue"), "인트로 대사 없음");
  const step = (action, label) => {
    const r = act(C, s, action, 1000);
    if (!r.ok) { fails++; console.error(`  ✗ [${label}] ${JSON.stringify(action)} → ${r.error} (장면 ${s.scene})`); }
    log.push(r);
    return r;
  };
  const go = (to) => step({ type: "move", to }, `이동 ${to}`);
  const look = (h) => step({ type: "inspect", hotspot: h }, `조사 ${h}`);
  const solve = (pid, hs) => {
    if (hs) look(hs);
    const r = step({ type: "solve", puzzle: pid, answer: ANS[pid] }, `풀이 ${pid}`);
    if (r.ok && !r.correct) { fails++; console.error(`  ✗ ${pid} 정답이 오답 처리됨:`, r.events.map((e) => e.msg).join()); }
  };
  const deduce = (cards) => {
    const r = step({ type: "deduce", cards }, `추리 ${cards}`);
    if (!r.correct) { fails++; console.error("  ✗ 추리 실패", cards, r.events); }
  };
  // 수첩: 처음엔 비어 있고, 정답 문구가 미리 새지 않는다
  const nb0 = snapshot(C, s, 1000).notebook;
  ok(nb0.timeline.length === 0, "시작 시 타임라인 비어 있어야 함");
  ok(nb0.suspects.every((x) => nb0.people.some((p) => p.id === x.id)), "만난 사람만 용의자 분석에 나와야 함");
  ok(nb0.openQuestions.length === C.presentation.openQuestions.filter((q) => !q.from).length, "시작 시 기본 의문만 보여야 함");
  const pub = JSON.stringify(publicCaseInfo(C));
  ok(!pub.includes("범인 공개") && !pub.includes("\"timeline\"") && !pub.includes("\"suspects\""), "공개 정보에 범인 공개·수첩 원본이 섞이면 안 됨");
  // 광장
  look("sq_clocks"); look("sq_plaque"); look("sq_isabel"); look("sq_basil" in {} ? "" : "sq_bakery");
  solve("P01", "sq_box");
  solve("H2", "sq_fountain");
  // 작업실
  go("workshop_out"); look("wo_isabel"); solve("P02", "wo_door"); go("workshop");
  look("ws_bolt"); look("ws_floor"); look("ws_isabel");
  solve("P03", "ws_watch"); solve("P04", "ws_letter");
  solve("S1", "ws_drawer");
  // 잘못된 추리 피드백 확인
  const bad = act(C, s, { type: "deduce", cards: ["E03", "E04", "E05"] }, 1000);
  ok(bad.events.some((e) => e.type === "deduce_wrong" && e.msg), "오답 추리에 피드백 없음");
  deduce(["E03", "E04", "E07"]);
  ok(!act(C, s, { type: "inspect", hotspot: "ws_gears" }).ok, "이자벨 심문 전엔 진자 칸이 안 열림");
  look("ws_clock");
  ok(s.evidence.includes("E22"), "D1 뒤 괘종시계에서 손자국(E22)");
  look("ws_ask_isabel");
  const wi = act(C, s, { type: "present", id: "isabel", statement: "i1", evidence: "E22" }, 1000);
  ok(wi.events.some((e) => e.type === "inter_wrong"), "이자벨: 엉뚱한 증언에 손자국 → 실패");
  step({ type: "press", id: "isabel", statement: "i1" }, "이자벨 추궁 i1");
  step({ type: "press", id: "isabel", statement: "i3" }, "이자벨 새 증언 i3");
  ok(step({ type: "present", id: "isabel", statement: "i2", evidence: "E22" }, "이자벨 반박").correct && s.flags.has("isabel_clock"), "손자국으로 이자벨 반박 → 진자 칸");
  solve("P05", "ws_gears");
  ok(s.flags.has("twist1"), "반전 1 미발생");
  ok(log.at(-1).events.some((e) => e.type === "cinematic" && e.t === "밀실이 아니었다"), "P05 반전 연출 이벤트 없음");
  {
    const nb = snapshot(C, s, 1000).notebook;
    ok(nb.suspects.find((x) => x.id === "isabel")?.verdict === "clear", "D1 뒤 이자벨 혐의 없음");
    ok(!nb.openQuestions.includes(C.presentation.openQuestions[0].text), "D1 뒤 첫 의문은 사라져야 함");
    ok(nb.timeline.some((x) => x.tm === "23:47") && nb.people.some((x) => x.id === "isabel"), "타임라인·등장인물 갱신 안 됨");
  }
  // 서재
  go("workshop_out"); go("square"); go("library");
  solve("P06", "lb_cards"); solve("P07", "lb_shelf"); solve("H3", "lb_book");
  // 시청
  go("square"); go("townhall"); look("th_mayor"); look("th_penelope"); look("th_plan");
  ok(!s.evidence.includes("E15"), "비서는 처음엔 메모를 숨김");
  look("th_desk");
  look("th_ask_penelope");
  ok(step({ type: "present", id: "penelope", statement: "n2", evidence: "E24" }, "비서 반박").correct && s.evidence.includes("E15"), "빈 상자로 비서 반박 → 메모(E15)");
  step({ type: "press", id: "penelope", statement: "n3" }, "비서 새 증언 n3");
  ok(s.flags.has("heard_lucien_desk"), "비서: 루시앙이 자리에 혼자 있었음");
  deduce(["E05", "E06", "E15"]);
  // 시장 심문: 추궁 → 틀린 반박(기회 감소) → 메모로 반박 → 열쇠
  look("th_ask_mayor");
  step({ type: "press", id: "mayor", statement: "m3" }, "시장 추궁 m3");
  const wm = act(C, s, { type: "present", id: "mayor", statement: "m1", evidence: "E15" }, 1000);
  ok(wm.events.some((e) => e.type === "inter_wrong") && !s.flags.has("tower_key"), "엉뚱한 증언에 증거를 내면 실패 + 반응");
  const rm = step({ type: "present", id: "mayor", statement: "m2", evidence: "E15" }, "시장 반박");
  ok(rm.correct && s.flags.has("tower_key"), "시장 심문 반박 → 시계탑 열쇠");
  // 여관
  go("square"); go("inn"); look("in_veronica"); look("in_lucien");
  solve("S3", "in_map");
  ok(!act(C, s, { type: "inspect", hotspot: "in_board" }).ok, "베로니카 심문 전엔 알리바이 표가 안 열림");
  look("in_ask_veronica");
  step({ type: "press", id: "veronica", statement: "v2" }, "베로니카 추궁 v2");
  ok(step({ type: "present", id: "veronica", statement: "v1", evidence: "E21" }, "베로니카 반박").correct && s.flags.has("veronica_confessed"), "바실의 증언으로 베로니카 반박");
  step({ type: "press", id: "veronica", statement: "v3" }, "새 증언 v3 추궁");
  solve("P08", "in_board");
  deduce(["E01", "E11", "E12"]);
  // 루시앙 심문: 추궁으로 숨은 증언 열기 → 오답 → 멈춘 시계로 반박 (= P09)
  look("in_confront");
  const pl2 = step({ type: "press", id: "lucien", statement: "l2" }, "루시앙 추궁 l2");
  ok(pl2.events.some((e) => e.type === "inter_reveal" && e.statement === "l4"), "추궁하면 숨은 증언이 열림");
  const w9 = act(C, s, { type: "present", id: "lucien", statement: "l3", evidence: "E05" }, 1000);
  ok(w9.events.some((e) => e.type === "inter_wrong"), "맞는 증언 + 틀린 증거 → 실패 안내");
  step({ type: "present", id: "lucien", statement: "l3", evidence: "E01" }, "루시앙 결정적 반박");
  ok(s.solved.P09, "루시앙 반박 → 증언 모순(P09) 해결");
  ok(s.flags.has("twist2"), "반전 2 미발생");
  {
    const t = snapshot(C, s, 1000).notebook.timeline.find((x) => x.doubt);
    ok(t?.tag === "false", "P09 뒤 루시앙 주장은 '거짓으로 밝혀짐'");
    ok(snapshot(C, s, 1000).artFlags.includes("lucien_fled"), "그림용 플래그 lucien_fled 없음");
  }
  deduce(["E02", "E09", "E10"]);
  ok(s.flags.has("tower_open"), "시계탑 개방 안 됨");
  // 시계탑
  go("square");
  ok(!act(C, s, { type: "move", to: "tower" }).ok, "광장에서 탑 안으로 바로 갈 수 없음");
  go("tower_back"); look("tb_ground"); look("tb_hook");
  solve("T1", "tb_door");
  ok(s.evidence.includes("E25") && log.at(-1).events.some((e) => e.type === "cinematic"), "T1 → 탑 아래 문 빗장(E25) + 연출");
  go("tower"); look("tw_stairs");
  ok(!act(C, s, { type: "inspect", hotspot: "tw_lift" }).ok, "철문(T2) 전엔 승강대 안 보임");
  solve("T2", "tw_gate");
  deduce(["E05", "E16", "E25"]);
  look("tw_lift");
  // 천칭: 3-3-3 전략으로 실제 풀이
  const w1 = step({ type: "weigh", puzzle: "P10", left: [1, 2, 3], right: [4, 5, 6] }, "천칭1").events.find((e) => e.type === "weigh");
  const g = w1.heavier === "equal" ? [7, 8, 9] : w1.heavier === "left" ? [4, 5, 6] : [1, 2, 3];
  const w2 = step({ type: "weigh", puzzle: "P10", left: [g[0]], right: [g[1]] }, "천칭2").events.find((e) => e.type === "weigh");
  const fake = w2.heavier === "equal" ? g[2] : w2.heavier === "left" ? g[1] : g[0];
  const pk = step({ type: "weigh", puzzle: "P10", pick: fake }, "가짜 추 지목");
  ok(pk.correct, "P10 논리 풀이 실패");
  go("tower_top"); look("tt_gears");
  // S2 숨은 물건: 빗나간 곳 연타 → 잠시 막힘, 그다음 정답 5곳
  look("tt_floor");
  let cool = false;
  for (let i = 0; i < 6; i++) { const r = act(C, s, { type: "probe", puzzle: "S2", x: 5, y: 5 + i }, 1000 + i); if (r.events.some((e) => e.cooldown)) cool = true; }
  ok(cool, "S2 아무 데나 연타하면 잠시 막힘");
  for (const [x, y] of Object.values(C.puzzles.S2.solution.targets).map(([a, b]) => [a + 3, b - 2])) act(C, s, { type: "probe", puzzle: "S2", x, y }, 20000);
  ok(s.solved.S2, "S2 다섯 곳 모두 찾으면 해결");
  const w11 = act(C, s, { type: "solve", puzzle: "P11", answer: { h: 11, m: 47 } }, 1000);
  ok(w11.events.some((e) => e.type === "puzzle_wrong"), "P11 오답(11:47) 피드백 없음");
  solve("P11", "tt_master");
  go("underground"); solve("P12", "ug_mirrors"); look("ug_oskar"); solve("H1", "ug_vault");
  // 힌트
  const hr = act(C, s, { type: "hint", puzzle: "P01" }, 1000);
  ok(hr.events[0]?.type === "hint", "힌트 동작 안 함");
  ok(!act(C, s, { type: "inspect", hotspot: "ug_final" }).ok, "마지막 기록 전엔 최종 추리 안 열림");
  const w1c = act(C, s, { type: "solve", puzzle: "C1", answer: { text: "밤일별지탑는" } }, 1000);
  ok(w1c.ok === false || w1c.events.some((e) => e.type === "puzzle_wrong"), "C1 오답 처리");
  solve("C1", "ug_wall"); solve("C2", "ug_niche");
  const w3 = act(C, s, { type: "solve", puzzle: "C3", answer: { statement: "s3", evidence: "E16" } }, 1000);
  ok(w3.events?.some((e) => e.type === "puzzle_wrong"), "C3 맞는 문장 + 엉뚱한 증거 → 실패");
  solve("C3", "ug_page");
  ok(s.evidence.includes("E26"), "C3 → 끼워 넣은 한 장(E26)");
  look("ug_final");
  const TRUE = { when: { option: "a", evidence: "E04" }, stop: { option: "a", evidence: "E05" }, lock: { option: "c", evidence: "E03" }, where: { option: "b", evidence: "E08" }, culprit: { option: "lucien", evidence: "E11" }, motive: { option: "vault", evidence: "E10" } };
  const answers = ending === "true" ? TRUE
    : ending === "normal" ? { ...TRUE, motive: { option: "masterpiece", evidence: "E13" } }
      : { ...TRUE, culprit: { option: "mayor", evidence: "E06" } };
  const fin = step({ type: "final", answers }, "최종 추리");
  const e = fin.events.find((x) => x.type === "ending");
  ok(e?.ending === ending, `엔딩 ${ending} 기대, 실제 ${e?.ending}`);
  ok(ending === "bad" ? !e?.reveal : e?.reveal?.t === "골동품상 루시앙", "범인 공개는 진/보통 엔딩에만");
  ok(e?.result.chapters?.length === 5 && e.result.chapters.every((x) => x.sec >= 0), `구간별 시간 5개 (${JSON.stringify(e?.result.chapters)})`);
  ok(e?.result.puzzles?.length >= 17, "퍼즐별 기록");
  const snap = snapshot(C, s, 2000);
  ok(snap.stats.evidence === Object.keys(C.evidence).length, `증거 ${snap.stats.evidence}/${Object.keys(C.evidence).length}만 수집`);
  // 직렬화 왕복
  const back = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))));
  ok(back.flags.has("rescued") && back.evidence.length === s.evidence.length, "세션 저장/복원 실패");
  console.log(`  엔딩 ${ending}: ${e?.title} · 정확도 ${e?.result.accuracy} · 칭호 ${e?.result.titles.join(", ") || "-"} · 퍼즐 ${snap.stats.solvedMain}/${snap.stats.totalMain} + 숨김 ${snap.stats.solvedHidden}`);
}
section("자동 플레이");
play("true"); play("normal"); play("bad");
{
  // 답은 모두 맞혀도 근거 증거가 엉뚱하면 진 엔딩이 아니다
  const s = createSession(C); s.flags.add("rescued"); s.flags.add("c3"); s.scene = "underground"; s.flags.add("p12");
  s.evidence.push(...Object.keys(C.evidence));
  const ans = { when: { option: "a", evidence: "E13" }, stop: { option: "a", evidence: "E13" }, lock: { option: "c", evidence: "E13" }, where: { option: "b", evidence: "E13" }, culprit: { option: "lucien", evidence: "E13" }, motive: { option: "vault", evidence: "E13" } };
  const r = act(C, s, { type: "final", answers: ans });
  ok(r.events.find((e) => e.type === "ending")?.ending === "normal", "답은 맞아도 근거가 틀리면 보통 엔딩");
}

// ---------- 4. 잠금 우회 차단 ----------
section("잠금 우회 차단");
{
  const s = createSession(C);
  ok(!act(C, s, { type: "move", to: "tower" }).ok, "잠긴 시계탑으로 이동됨");
  ok(!act(C, s, { type: "solve", puzzle: "P11", answer: ANS.P11 }).ok, "다른 장소 퍼즐이 풀림");
  ok(!act(C, s, { type: "final", answers: { culprit: "lucien", motive: "vault" } }).ok, "최종 추리가 바로 열림");
  ok(!act(C, s, { type: "deduce", cards: ["E03", "E04", "E07"] }).ok, "없는 증거로 추리됨");
  ok(!act(C, s, { type: "inspect", hotspot: "sq_box" }).ok, "숨겨진 조사 지점이 눌림");
}

section("심문 · 가설 · 관계도 · 근거");
{
  const s = createSession(C); startEvents(C, s);
  ["twist1", "talked_mayor", "got_E06"].forEach((f) => s.flags.add(f)); s.scene = "townhall";
  s.evidence.push("E01", "E02", "E03"); s.flags.add("got_E03");
  act(C, s, { type: "inspect", hotspot: "th_ask_mayor" });
  for (let i = 0; i < 4; i++) act(C, s, { type: "present", id: "mayor", statement: "m1", evidence: "E01" });
  const lk = act(C, s, { type: "present", id: "mayor", statement: "m2", evidence: "E02" });
  ok(lk.locked, "추궁 기회를 다 쓰면 대답 거부 (무작위 제출 방지)");
  s.evidence.push("E15");
  const un = act(C, s, { type: "present", id: "mayor", statement: "m2", evidence: "E15" });
  ok(un.correct, "새 증거를 얻으면 다시 심문 가능");
  const snap = snapshot(C, s);
  ok(snap.hypotheses.find((h) => h.id === "h_mayor")?.status === "rejected", "가설: 시장 편지 → 기각됨");
  ok(snap.hypotheses.find((h) => h.id === "h_kidnap")?.status === "possible", "가설: 납치 → 가능성 있음 (빗장 증거만 있을 때)");
  ok(snap.relations.some((r) => r.a === "lucien" && r.b === "mayor"), "관계도: 시장 심문 후 '편지지로 누명' 관계 공개");
  ok(!snap.relations.some((r) => r.label.includes("감금")), "관계도: 아직 드러나지 않은 관계는 숨김");
}

section("최종 도움 (진행 불능 방지)");
{
  const s = createSession(C); s.flags.add("met_isabel");
  act(C, s, { type: "inspect", hotspot: "sq_box" });
  ok(!act(C, s, { type: "assist", puzzle: "P01" }).ok, "힌트를 다 보기 전엔 도움 불가");
  for (let i = 0; i < 3; i++) act(C, s, { type: "hint", puzzle: "P01" });
  ok(!act(C, s, { type: "assist", puzzle: "P01" }).ok, "오답 2번 전엔 도움 불가");
  const bad = { rot: C.puzzles.P01.public.tiles.map((row) => row.map((t) => t.r)) };
  act(C, s, { type: "solve", puzzle: "P01", answer: bad }); act(C, s, { type: "solve", puzzle: "P01", answer: bad });
  const r = act(C, s, { type: "assist", puzzle: "P01" });
  ok(r.ok && s.solved.P01?.assisted && s.evidence.includes("E02"), "조건을 채우면 도움으로 해결 + 보상 증거 지급");
  ok(snapshot(C, s).stats.assists === 1, "도움 사용이 기록됨");
  s.flags.add("twist1"); s.scene = "library";
  act(C, s, { type: "inspect", hotspot: "lb_book" });
  for (let i = 0; i < 3; i++) act(C, s, { type: "hint", puzzle: "H3" });
  act(C, s, { type: "solve", puzzle: "H3", answer: { path: [[0, 0], [0, 1]] } }); act(C, s, { type: "solve", puzzle: "H3", answer: { path: [[0, 0], [0, 1]] } });
  ok(!act(C, s, { type: "assist", puzzle: "H3" }).ok, "숨겨진 퍼즐은 도움 불가");
}

console.log(fails ? `\n✗ 실패 ${fails}건` : "\n✓ 전부 통과");
process.exit(fails ? 1 : 0);
