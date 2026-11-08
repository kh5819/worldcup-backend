// 언어 진단소 서버 시험 — node scripts/test-lingo.mjs (실패하면 exit 1)
// 화면·서버 채점 파일 동일 · 문제은행 형식 · 출제(난이도 대역·중복·검사 분포) · 모든 문항 정답/오답 판정 · 정답 노출 · 타자(매크로·조합)
import fs from "fs";
import * as C from "../src/lingo-core.js";
import { validateItem } from "../src/lingo-validate.js";
import { BANK } from "../src/lingo-bank.js";
import { buildPlan, serve, judgeServed, revealOf, _lingoTest } from "../src/lingo.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("✗", m); } };
const { STORE } = _lingoTest;

// 1) 화면·서버 공용 파일이 같은지
ok(fs.readFileSync("src/lingo-core.js", "utf8") === fs.readFileSync("../홈페이지 제작/js/lingo/lingo-core.js", "utf8"), "lingo-core 화면·서버 파일이 다름");
// 화면 폴더에 문제은행이 없어야 함
ok(!fs.readdirSync("../홈페이지 제작/js/lingo").some((f) => /bank/.test(f)), "화면 폴더에 문제은행 파일이 있음");

// 2) 문제은행
for (const q of BANK) { const v = validateItem(q); ok(!v.errors.length, `${q.id} ${v.errors.join(",")}`); }
ok(new Set(BANK.map((q) => q.id)).size === BANK.length, "id 중복");
ok(STORE.pool.length === BANK.filter((q) => ["checked", "approved"].includes(q.status)).length, "출제 목록 수가 다름");

// 3) 출제
for (const L of C.LANGS) {
  const has = STORE.pool.some((q) => q.lang === L); if (!has) continue;
  for (const mode of ["full", "speed", "mix"]) for (const diff of C.DIFF_KEYS) for (const seed of [1, 2, 3]) {
    const p = buildPlan(mode, seed, { diff, lang: L }), qs = p.map((x) => STORE.all.get(x.id));
    ok(p.length === C.planN(mode), `${L} ${mode} ${diff} 문항 수 ${p.length}`);
    ok(new Set(p.map((x) => x.id)).size === p.length, `${L} ${mode} 중복 출제`);
    ok(qs.every((q) => q.lang === L), `${L} ${mode} 다른 언어 섞임`);
    ok(qs.filter((q) => C.inBand(diff, q.d)).length === p.length, `${L} ${mode} ${diff} 난이도 대역 밖 문항`);
    for (const [g, k] of Object.entries(C.PLANS[mode].games)) ok(qs.filter((q) => q.area === g).length === k, `${L} ${mode} ${g} ${k}문항이어야 함`);
  }
  // 최근 본 문제 줄이기: 같은 사람이 두 번 하면 겹치는 문항이 적어야 함
  const a = buildPlan("speed", 11, { diff: "normal", lang: L }), b = buildPlan("speed", 12, { diff: "normal", lang: L, recent: new Set(a.map((x) => x.id)) });
  const overlap = b.filter((x) => a.some((y) => y.id === x.id)).length; ok(overlap <= 6, `${L} 반복 플레이 겹침 ${overlap}`);
}

// 4) 모든 문항: 정답이면 만점, 오답이면 0점 근처, 화면에 정답 정보 없음
for (const q of STORE.pool) {
  for (const seed of [5, 77]) {
    const sv = serve(q, seed), st = { at: Date.now() - 4000 }, pubS = JSON.stringify(sv.pub);
    let good, bad;
    switch (q.kind) {
      case "mcq": good = sv.key; bad = (sv.key + 1) % 4; break;
      case "ox": good = sv.key; bad = !sv.key; break;
      case "order": good = sv.key.slice(); bad = sv.key.slice().reverse(); break;
      case "spot": good = sv.key; bad = (sv.key + 1) % sv.pub.tokens.length; break;
      case "link": good = sv.key.slice(); bad = sv.key.map((_, i) => sv.key[(i + 1) % sv.key.length]); break;
      case "sort": good = sv.key.slice(); bad = sv.key.map((k) => (k + 1) % q.bins.length); break;
      case "type": good = q.text; bad = "아무말"; break;
    }
    const r1 = judgeServed(q, sv, good, st), r2 = judgeServed(q, sv, bad, st);
    ok(q.kind === "type" ? r1.part > 0.3 : r1.part === 1, `${q.id} 정답 판정 ${r1.part}`);
    ok(r2.part < 0.5, `${q.id} 오답 판정 ${r2.part}`);
    if (q.kind === "spot") ok(!sv.pub.tokens.includes(q.fix) && !("fix" in sv.pub), `${q.id} 고친 말이 화면에 보임`);
    if (q.kind === "mcq") ok(!("ans" in sv.pub) && sv.pub.opts.length === 4, `${q.id} 보기`);
    if (q.kind === "order") ok(sv.pub.parts.join("|") !== q.parts.join("|"), `${q.id} 조각이 안 섞임`);
    ok(!/"exp"|"src"|"key"|"wrong"|"fix"/.test(pubS), `${q.id} 화면 정보에 정답·해설 필드`);
    const rv = revealOf(q, sv); ok(rv.exp && rv.src.length, `${q.id} 해설·근거`);
  }
  // 시간 초과는 0점
  const sv = serve(q, 3); const late = judgeServed(q, sv, q.kind === "type" ? q.text : sv.key, { at: Date.now() - sv.pub.lim - 5000 }); ok(late.part === 0 && late.timeout, `${q.id} 시간 초과인데 점수`);
}

// 5) 타자: 정확·속도·매크로·조합 중 글자
const T = "작은 습관이 모여 큰 변화를 만든다.";
const human = C.typeScore(T, T, 7000, "ko"), slow = C.typeScore(T, T, 30000, "ko"), bot = C.typeScore(T, T, 600, "ko"), typo = C.typeScore(T, "작은 습관이 모여 큰 변하를 만든다.", 7000, "ko"), half = C.typeScore(T, "작은 습관이", 7000, "ko");
ok(human.part > 0.6 && !human.bot, `사람 속도 만점 근처 ${JSON.stringify(human)}`);
ok(slow.part > 0 && slow.part < human.part, `느리면 점수 낮음 ${slow.part}`);
ok(bot.part === 0 && bot.bot, `매크로 속도 0점 ${JSON.stringify(bot)}`);
ok(typo.part < human.part && typo.part > 0, `오타 한 글자 감점 ${typo.part}`);
ok(half.part === 0, `반만 치면 0점 ${half.part}`);
ok(C.strokes("닭볶음탕", "ko") === 13 && C.strokes("hello", "en") === 5, "타수 셈");
ok(C.typeScore("テスト入力です", "テスト入力です", 6000, "ja").part > 0, "일본어 타자");
ok(C.typeScore("The quick brown fox jumps.", "The quick brown fox jumps.", 6000, "en").part > 0.5, "영어 타자");
// NFD(맥 한글 조합)로 와도 같게
ok(C.typeScore(T, T.normalize("NFD"), 7000, "ko").acc === 100, "NFD 입력 정규화");

// 6) 점수·등급
const all = (part) => STORE.pool.filter((q) => q.lang === "ko").slice(0, 26).map((q) => ({ id: q.id, game: q.area, kind: q.kind, area: q.area, d: 2, part, c: C.chanceOf(q.kind, 4), ms: 5000, lim: 15000 }));
ok(C.diagnose(all(1)).grade.id === "SSS" && C.diagnose(all(1)).total === 100, "다 맞히면 100점 SSS");
ok(C.diagnose(all(0)).total <= 10 && C.diagnose(all(0)).grade.id === "D", "다 틀리면 D");
ok(C.GRADES.map((g) => g.id).join() === "SSS,SS,S,A,B,C,D", "등급 순서");
ok(C.diagnose([{ game: "spell", kind: "mcq", area: "spell", d: 2, part: 1, c: 0.25, ms: 1, lim: 9 }]).areas.typing === null, "안 한 검사는 미측정(null)");

console.log(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
