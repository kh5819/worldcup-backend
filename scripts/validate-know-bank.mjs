// 상식 진단소 문제은행 검증 — 형식·정답 존재/유일성·보기 중복·중복/유사 문항·해설·출처·검수 상태·난이도·유형 적합성·출제 시뮬레이션
// 사용: node scripts/validate-know-bank.mjs   (보고서: docs/know-bank-report.md)
// 자동 검사는 "형식과 일관성"만 확인. 사실관계는 근거 자료 대조 기록(by: ai-ref/op)으로 관리 — 자동 통과 ≠ 사실 검증
import fs from "fs";
import * as C from "../src/know-core.js";
import { BANK } from "../src/know-bank.js";
import { validateItem, findDupes, toSchema, LIVE_STATUS } from "../src/know-validate.js";
import { STORE, rebuild } from "../src/know-store.js";
import { serve, buildPlan, localize, hasLang, poolFor } from "../src/know.js";
import { I18N, LOCAL } from "../src/know-bank-i18n.js";
import { norm } from "../src/know-validate.js";

const world = JSON.parse(fs.readFileSync(new URL("../../홈페이지 제작/assets/know/world110.json", import.meta.url), "utf8"));
const worldCodes = new Set(Object.keys(world.c));
const errs = [], warns = [];
const ids = new Map();
for (const q of BANK) {
  if (ids.has(q.id)) errs.push(`${q.id}: id 중복`); ids.set(q.id, q);
  const v = validateItem(q, { worldCodes });
  for (const e of v.errors) errs.push(`${q.id}: ${e}`);
  for (const w of v.warns) warns.push(`${q.id}: ${w}`);
}
// 중복·유사
const dupes = findDupes(BANK);
for (const d of dupes) warns.push(`${d.a} ↔ ${d.b}: ${d.why} (${d.sim})`);

// 출제 시뮬레이션: 정답 입력 = 만점, 화면 정보에 정답 재료 없음, 찍기 기대 점수
const live = BANK.filter((q) => LIVE_STATUS.has(q.status));
const LEAK = /"(exp|src|ans|years|truth|key|value|clues|events":\[\[)"?:/;
let guessSum = 0, guessN = 0;
const randAns = (pub, r) => {
  switch (pub.kind) { case "mcq": case "reveal": return Math.floor(r() * pub.opts.length); case "map": return Math.floor(r() * pub.codes.length); case "ox": return r() < 0.5; case "fake": return Math.floor(r() * pub.stmts.length); case "order": return C.shuffle(pub.events.map((_, i) => i), r); case "pair": return C.shuffle(pub.left.map((_, i) => i), r); case "num": return pub.num.min + r() * (pub.num.max - pub.num.min); }
};
for (const q of live) for (let s = 1; s <= 30; s++) {
  const sv = serve(q, s * 7919), pubJ = JSON.stringify(sv.pub);
  if (/"(exp|src|ans|years|truth|value)":/.test(pubJ) || (q.kind === "reveal" && pubJ.includes(q.clues[1]))) errs.push(`${q.id}: 화면 정보에 정답 재료가 섞임`);
  if (C.judge(q.kind, sv.pub, q.kind === "num" ? sv.key.v : sv.key, sv.key, { stage: 1 }) !== 1) errs.push(`${q.id}: 정답 입력이 만점이 아님 (seed ${s})`);
  const r = C.rng(s * 31 + 5); guessSum += C.judge(q.kind, sv.pub, randAns(sv.pub, r), sv.key, { stage: 4 }); guessN++;
}
// 모드별 출제 가능 여부·균형
const planRep = [];
rebuild();
for (const m of ["quick", "full", "daily"]) {
  try {
    const areaCnt = {}, diffCnt = {}, gameCnt = {}; let ok = 0;
    for (let s = 1; s <= 200; s++) { const p = buildPlan(m, s); if (new Set(p.map((x) => x.id)).size !== p.length) errs.push(`${m}: seed ${s} 문항 중복`); ok++; for (const x of p) { const q = STORE.all.get(x.id); areaCnt[q.area] = (areaCnt[q.area] || 0) + 1; diffCnt[q.d] = (diffCnt[q.d] || 0) + 1; gameCnt[q.game] = (gameCnt[q.game] || 0) + 1; } }
    const tot = ok * C.PLANS[m].n, pct = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((100 * v) / tot)]));
    planRep.push(`- ${C.PLANS[m].ko}(${C.PLANS[m].n}문항): 200세트 출제 성공. 분야 % ${JSON.stringify(pct(areaCnt))} · 난이도 % ${JSON.stringify(pct(diffCnt))}`);
  } catch (e) { planRep.push(`- ${C.PLANS[m].ko}: 출제 불가 (${e.message} ${JSON.stringify(e.detail || {})})`); }
}
for (const a of C.AREAS) { try { buildPlan("area", 3, { area: a }); planRep.push(`- 분야별 ${C.AREA[a].ko}: 출제 가능`); } catch (e) { planRep.push(`- 분야별 ${C.AREA[a].ko}: 출제 불가 — ${e.message} (필요 ${e.detail?.need} · 있음 ${e.detail?.have})`); } }

// ---------- 보고 ----------
const cnt = (arr, f) => { const o = {}; for (const q of arr) { const k = f(q); o[k] = (o[k] || 0) + 1; } return o; };
const byArea = cnt(live, (q) => q.area), byDiff = cnt(live, (q) => q.d), byGame = cnt(live, (q) => `${q.game}/${q.kind}`), byStatus = cnt(BANK, (q) => q.status), byBy = cnt(live, (q) => q.by);
const kr = live.filter((q) => q.tags?.includes("한국사")).length;

// ---------- 번역 (日本語 · English) ----------
// 배열 길이·빈칸·한글 남음·보기 중복·지역 문항 번역 금지·번역본 자동 검사·정답 위치가 원문과 같은지
const HAN = /[가-힣]/, i18nRep = [];
for (const [id, tr] of Object.entries(I18N)) {
  const q = ids.get(id);
  if (!q) { errs.push(`번역 ${id}: 문제은행에 없는 문항`); continue; }
  if (LOCAL.has(id) || (q.tags || []).includes("한국사")) { errs.push(`번역 ${id}: 한국사·한국 전용 문항은 번역하지 않음`); continue; }
  for (const L of ["ja", "en"]) {
    const t = tr[L], E = (m) => errs.push(`번역 ${id} ${L}: ${m}`);
    if (!t) { E("없음"); continue; }
    if (!t.q || !t.exp) E("문제·해설 빈칸");
    const texts = [t.q, t.exp, t.fun, t.unit || null, ...(t.opts || []), ...(t.clues || []), ...(t.stmts || []), ...(t.events || []), ...(t.yl || []).filter(Boolean), ...(t.pairs || []).flat()].filter((x) => x != null);
    if (texts.some((x) => typeof x !== "string" || !x.trim())) E("빈 글자");
    if (texts.some((x) => HAN.test(x))) E(`한글이 남음: ${texts.find((x) => HAN.test(x))}`);
    const same = (k, a) => { if ((a && !t[k]) || (!a && t[k])) E(`${k} 있음/없음 다름`); else if (a && a.length !== t[k].length) E(`${k} 개수 다름 (${a.length} vs ${t[k].length})`); };
    same("opts", q.opts); same("clues", q.clues); same("stmts", q.stmts); same("events", q.events); same("pairs", q.pairs);
    if (q.events?.some((e) => e[2]) && t.yl && t.yl.length !== q.events.length) E("yl 개수 다름");
    if (t.pairs?.some((x) => !Array.isArray(x) || x.length !== 2)) E("pairs 형식");
    if (t.opts && new Set(t.opts.map(norm)).size !== t.opts.length) E("보기 중복");
    if (q.n?.unit && HAN.test(q.n.unit) && t.unit == null) E("숫자 단위 번역 없음");
    if (!hasLang(q, L)) { E("출제 안 됨(ver 다름?)"); continue; }
    const lq = localize(q, L), v = validateItem(lq, { worldCodes });
    for (const e of v.errors) E(`자동 검사: ${e}`);
    for (let sd = 1; sd <= 3; sd++) if (JSON.stringify(serve(lq, sd).key) !== JSON.stringify(serve(q, sd).key)) E("정답 위치가 원문과 다름");
  }
}
for (const L of ["ja", "en"]) { const P = poolFor(L); const by = {}; for (const q of P) by[q.area] = (by[q.area] || 0) + 1; i18nRep.push(`- ${L}: 출제 ${P.length}문항 (${C.BANK_AREAS.map((a) => `${C.AREA[a].ko} ${by[a] || 0}`).join(" · ")})`); }
const transl = BANK.filter((q) => !LOCAL.has(q.id) && !(q.tags || []).includes("한국사"));
i18nRep.unshift(`- 번역 대상 ${transl.length}문항 (한국사·한국 전용 ${BANK.length - transl.length}문항 제외) · 번역 완료 ja ${transl.filter((q) => I18N[q.id]?.ja).length} · en ${transl.filter((q) => I18N[q.id]?.en).length}`);
const lines = [
  `# 상식 진단소 문제은행 검증 보고서`, ``, `생성: ${new Date().toISOString().slice(0, 16).replace("T", " ")} · 스키마 v${C.BANK_SCHEMA} · 채점 v${C.CORE_VERSION}`, ``,
  `## 요약`, `- 등록 ${BANK.length}문항 · 출제 중(checked+approved) ${live.length}문항 · 운영자 승인(approved) ${byStatus.approved || 0}문항 · 목표 ${Object.values(C.BANK_TARGET).reduce((a, b) => a + b, 0)}문항`,
  `- 검수 방식: ${Object.entries(byBy).map(([k, v]) => `${{ "ai-ref": "AI 근거 자료 대조", auto: "프로그램 검증", op: "운영자" }[k] || k} ${v}`).join(" · ")}`,
  `- **주의:** "AI 근거 자료 대조"는 사람이 검수한 것이 아니에요. 운영자 승인 전까지는 사실관계 최종 확인으로 보지 않아요.`,
  `- 자동 검사 오류 ${errs.length}건 · 주의 ${warns.length}건 · 무작위 찍기 평균 부분점수 ${(guessSum / guessN).toFixed(3)} (채점에서 찍기 보정 적용)`, ``,
  `## 분야별 (출제 중 / 목표)`, ...C.BANK_AREAS.map((a) => `- ${C.AREA[a].ko}: ${byArea[a] || 0} / ${C.BANK_TARGET[a]}`), `- (한국사 표시: ${kr} / ${C.KOREA_HISTORY_TARGET})`, ``,
  `## 난이도별`, ...[1, 2, 3, 4].map((d) => `- ${C.DIFF[d].ko}: ${byDiff[d] || 0} (${Math.round((100 * (byDiff[d] || 0)) / live.length)}% · 목표 ${C.DIFF_TARGET[d] * 100}%)`), ``,
  `## 미니게임/조작 방식별`, ...Object.entries(byGame).sort().map(([k, v]) => `- ${k}: ${v}`), ``,
  `## 출제 시뮬레이션`, ...planRep, ``,
  `## 번역 (日本語 · English)`, ...i18nRep, ``,
  `## 자동 검사 항목`, `스키마 · 정답 존재 · 보기 중복 · 정답 유일성('모두 정답' 금지, 거짓 문장 정확히 1개, 같은 연도 금지, 짝 중복 금지) · 문항 중복·유사도(내용 2-gram) · 해설 · 출처(https) · 검증일 · 검수 상태 · 난이도 1~4 · 게임 유형-조작 방식 적합성 · 지도 나라 존재 · 숫자 정답=만점/먼 답=0점 · 단서에 정답 이름 노출 금지 · 화면 정보에 정답 재료 없음 · 실제 출제(서버 serve)에서 정답 입력=만점`, ``,
  `## 오류`, ...(errs.length ? errs.map((e) => `- ✗ ${e}`) : ["- 없음"]), ``, `## 주의 (사람 확인 권장)`, ...(warns.length ? warns.map((w) => `- ⚠ ${w}`) : ["- 없음"]), ``,
  `## 문항 표준 필드 예시`, "```json", JSON.stringify(toSchema(live[0]), null, 1), "```",
];
fs.mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../docs/know-bank-report.md", import.meta.url), lines.join("\n"));
console.log(lines.slice(4, 22).join("\n")); console.log(i18nRep.join("\n"));
if (warns.length) { console.log(`\n주의 ${warns.length}건`); for (const w of warns.slice(0, 20)) console.log("  ⚠", w); }
if (errs.length) { console.log(`\n오류 ${errs.length}건`); for (const e of errs.slice(0, 50)) console.log("  ✗", e); process.exit(1); }
console.log("\n오류 0건 ✔  (보고서: docs/know-bank-report.md)");
