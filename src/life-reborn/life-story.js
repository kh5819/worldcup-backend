// =========================
// 플듀 인생게임 REBORN — 결말·자서전 조립 엔진 2026-11-22
// 입력: 끝난 세션(S: 엔진 상태 p + 기록 rec + 직접 쓴 말 texts)  출력: 한 언어의 결말 백과사전(섹션·장·통계·책 페이지)
// 원칙: ① 기록에 있는 일만 쓴다(없는 사건을 지어내지 않음) ② 숫자는 기록에서 계산 ③ [기록]과 [해석]을 나눈다
//       ④ 같은 인생은 늘 같은 문장, 다른 인생은 다른 갈래 문장 ⑤ 직접 쓴 말은 원문 그대로(번역하지 않고 '원문' 표시)
// =========================
import * as I from "./lifegame-i18n.js?v=20261122_rb1";
import { regionName, countryName, moneyLocal } from "./life-world.js?v=20261123_w1";
import { PH, LABEL, STAT_LABEL, FOCUS_NAME, REGION_NAME, HOUSE_NAME, REL_NAME, PERSONA_NAME, VALUE_NAME, INTEREST_NAME, STAT_NAME, SHIFT_NAME } from "./life-story-text.js?v=20261122_rb1";
// 태어난 곳 이름 (한국은 13개 지역, 다른 나라는 세계 모드 지역) — REBORN 11-23
const REG = (region, country, lang) => country && country !== "KR" ? (regionName(country, region, lang) || countryName(country, lang)) : L(REGION_NAME[region], lang);
import { TRAITS, CAREER_NAME } from "./life-traits.js?v=20261122_rb1";
import { core, LIFE, keyBranches, branchFrom, autoLive, careerMatchesDream } from "./life-engine.js?v=20261122_rb1";
import { wordsStory } from "./life-words-story.js?v=20261122_rb3";
// 편지 받는 사람 (문장 속 이름꼴)
const LETTER_TO = { family: { ko: "가족", ja: "家族", en: "the family" }, friends: { ko: "친구들", ja: "友人たち", en: "friends" }, young: { ko: "어린 시절의 자신", ja: "幼い頃の自分", en: "their younger self" }, world: { ko: "세상", ja: "世界", en: "the world" } };

const LANGS = { ko: 0, ja: 1, en: 2 };
// ---------- 글자 도구 ----------
function hash(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const lastCh = (w) => { const s = String(w ?? "").replace(/[\s'"」』”’)\]]+$/, ""); return s[s.length - 1] || ""; };
function batchim(w) {
  const c = lastCh(w), code = c.charCodeAt(0) - 0xac00;
  if (code >= 0 && code < 11172) { const j = code % 28; return j === 0 ? 0 : j === 8 ? 2 : 1; } // 2 = ㄹ
  if (/[0-9]/.test(c)) return "013678".includes(c) ? 1 : c === "1" || c === "7" || c === "8" ? 2 : 0;
  if (/[a-zA-Z]/.test(c)) return /[lmnrbkpt]/i.test(c) ? 1 : 0;
  return 0;
}
const JOSA = { "이라고": ["이라고", "라고"], "을": ["을", "를"], "를": ["을", "를"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "과": ["과", "와"], "와": ["과", "와"], "이라": ["이라", "라"], "아": ["아", "야"], "이랑": ["이랑", "랑"], "이라는": ["이라는", "라는"], "이가": ["이", "가"], "으로": ["으로", "로"], "로": ["으로", "로"], "이었": ["이었", "였"], "이다": ["이다", "다"], "이지만": ["이지만", "지만"] };
function josa(w, j) {
  const b = batchim(w);
  if (j === "으로" || j === "로") return b === 1 ? "으로" : "로";
  const pair = JOSA[j]; if (!pair) return j;
  return b ? pair[0] : pair[1];
}
/** 틀 채우기: {x} · {x|을}(한국어 조사) · {x|q을}(따옴표로 감싼 뒤 조사) */
export function fmt(str, v = {}, lang = "ko") {
  return String(str).replace(/\{(\w+)(?:\|(q?)([가-힣]+))?\}/g, (_, k, q, j) => {
    let val = v[k]; if (val == null) val = "";
    val = String(val);
    const shown = q ? (lang === "ko" ? `'${val}'` : lang === "ja" ? `「${val}」` : `"${val}"`) : val;
    if (!j) return shown;
    return lang === "ko" ? shown + josa(val, j) : shown;
  });
}
/** 사전 문장 고르기: 같은 인생 + 같은 자리 = 같은 갈래 */
function P(key, lang, seed, v, alt = "") {
  const e = PH[key]; if (!e) return "";
  const arr = e[lang] || e.ko; const i = hash(seed + "|" + key + "|" + alt) % arr.length;
  return fmt(arr[i], v, lang);
}
const L = (obj, lang) => obj ? (obj[lang] ?? obj.ko) : "";
const lab = (k, lang) => L(LABEL[k], lang);
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
/** 돈(만원 단위) → 언어별 표기 */
// 세계 모드: 그 나라 돈으로 (구매력 어림 환산) — setMoneyCountry 로 바꿈
let MONEY_C = "KR";
export function setMoneyCountry(c) { MONEY_C = c || "KR"; }
export function money(man, lang) {
  if (MONEY_C !== "KR") { const x = moneyLocal(man, MONEY_C, lang); if (x) return x; }
  const v = Math.round(man || 0), neg = v < 0, a = Math.abs(v);
  if (lang === "en") { const won = a * 10000; const s = won >= 1e12 ? (won / 1e12).toFixed(1) + "T" : won >= 1e9 ? (won / 1e9).toFixed(1) + "B" : won >= 1e6 ? (won / 1e6).toFixed(won >= 1e8 ? 0 : 1) + "M" : won.toLocaleString("en-US"); return (neg ? "−" : "") + "₩" + s.replace(/\.0(?=[MBT])/, ""); }
  if (lang === "ja") { let s; if (a >= 10000) { const ok = Math.floor(a / 10000), r = a % 10000; s = `${ok.toLocaleString("ja-JP")}億${r ? r.toLocaleString("ja-JP") + "万" : ""}ウォン`; } else s = `${a.toLocaleString("ja-JP")}万ウォン`; return (neg ? "−" : "") + s; }
  let s; if (a >= 10000) { const eok = Math.floor(a / 10000), r = a % 10000; s = `${eok.toLocaleString("ko-KR")}억${r ? " " + r.toLocaleString("ko-KR") + "만" : ""}원`; } else s = `${a.toLocaleString("ko-KR")}만원`;
  return (neg ? "-" : "") + s;
}
const num = (n, lang) => Number(n || 0).toLocaleString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "ko-KR");
const ageTxt = (a, lang) => lang === "ko" ? `${a}살` : lang === "ja" ? `${a}歳` : `age ${a}`;

// ---------- 엔진 글자 번역 ----------
const BAND = [[0, 6], [7, 12], [13, 18], [19, 29], [30, 44], [45, 59], [60, 74], [75, 200]];
const bandOf = (a) => BAND.findIndex(([x, y]) => a >= x && a <= y);
const STAGE_OF_BAND = ["infant", "child", "teen", "adult", "midlife", "midlife", "senior", "elder"];
function evText(d, ctx) {
  return { title: I.tEventTitle(d.id, d.t, ctx), choice: I.tChoiceText(d.id, d.cid, d.c, ctx), narr: I.tNarr(d.src, d.n, ctx) };
}
const birthOf = (g, id) => { const d = (LIFE.BIRTH?.[g] || []).find(x => x.id === id); return d ? I.tBirth(g, d) : { label: "", text: "" }; };
const causeOf = (id) => { const c = (LIFE.DEATH_CAUSES || []).find(x => x.id === id); return c ? I.tDeath(c) : { label: id || "", line: "" }; };
const jobName = (t) => I.tJob(t) || t;
const careerName = (k, lang) => CAREER_NAME[k] ? L(CAREER_NAME[k], lang) : (LIFE.CAREERS?.[k]?.label || k || "");
const careerBare = (k, lang) => { const s = careerName(k, lang); return lang === "en" ? s.replace(/^(a|an) /, "") : s; };

// =========================
// 특징 X (결말 유형 판정·문장 값)
// =========================
export function features(S) {
  const p = S.p, R = S.rec, F = R.final, Y = R.years.filter(y => y.a > 0), D = R.decisions;
  const age = p.deathAge ?? p.age;
  const hist = (p.careerHist || []).map(h => ({ ...h })); if (p.career) hist.push({ key: p.career, step: p.careerStep || 0, from: p.careerSince || 0, to: age, state: "NOW", why: "now" });
  const careerMax = {}, careerYears = {}, careerFell = {}, careerStart = {}; let bizTries = 0;
  for (const h of hist) { careerMax[h.key] = Math.max(careerMax[h.key] || 0, h.step || 0); careerYears[h.key] = (careerYears[h.key] || 0) + Math.max(0, h.to - h.from); if (h.why === "fired" || (h.why === "quit" && (h.step || 0) <= 1 && h.to - h.from < 5)) careerFell[h.key] = h.to; if (careerStart[h.key] == null) careerStart[h.key] = h.from; if (h.key === "business") bizTries++; }
  const mainCareer = Object.entries(careerYears).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const people = p.people || [];
  const rel = (r) => people.filter(x => x.rel === r);
  const parents = people.filter(x => x.rel === "father" || x.rel === "mother");
  const st = (k) => Y.map(y => y.st[k]);
  const max = (a) => a.length ? Math.max(...a) : 0, min = (a) => a.length ? Math.min(...a) : 0, avg = (a) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
  const health = st("health"); const hMin = min(health); const hMinAge = Y[health.indexOf(hMin)]?.a ?? 0;
  const at = (a) => Y.find(y => y.a === a) || null;
  const s20 = at(20) || Y[Math.min(Y.length - 1, 19)], s60 = at(60) || Y[Y.length - 1];
  const shift = {}; for (const k of ["happy", "intel", "social", "power", "internet", "luck", "health"]) shift[k] = s20 && s60 ? s60.st[k] - s20.st[k] : 0;
  const loves = D.filter(d => d.cat === "love");
  const marryYears = Y.filter(y => y.sp).length;
  const spouseChanges = []; let prevSp = null; for (const y of Y) { if (y.sp && y.sp !== prevSp) spouseChanges.push({ a: y.a, name: y.sp }); prevSp = y.sp; }
  const famId = R.profile.birth?.family || p.birth?.family?.id || "normal";
  const famBase = { gold: 40000, silver: 15000, normal: 5000, dirt: 1000, struggle: 500 }[famId] || 5000;
  const money = Y.map(y => y.m);
  const after50 = Y.filter(y => y.a >= 50).map(y => y.m);
  const houses = []; let ph = null; for (const y of Y) { if (y.house !== ph) houses.push({ a: y.a, h: y.house }); ph = y.house; }
  const rep = F.report || {};
  const stageTag = (t) => (rep.stages || []).find(s => s.tag === t)?.id || null;
  const focus = { ...(p.focusYears || {}) }; const focusTop = Object.entries(focus).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const words = [S.texts.dream, S.texts.wish, S.texts.q10, S.texts.q18, S.texts.q25, S.texts.q40, S.texts.q60, S.texts.last, S.texts.letter?.text, ...(S.texts.thoughts || []).map(t => t.text)].filter(Boolean).join("");
  const stats60 = s60?.st || {};
  const fates = Y.filter(y => y.fate);
  return {
    name: p.nickname, age, region: R.profile.region, country: R.profile.country || "KR", famId, famBase, final: F.money.final, first: F.money.first, peak: F.money.peak, peakAge: F.money.peakAge, low: F.money.low, lowAge: F.money.lowAge, debtYears: F.money.debtYears,
    totalIncome: F.money.totalIncome, happyAvg: F.happyAvg, careerMax, careerYears, careerFell, careerStart, careerN: hist.length, careerMaxAny: max(Object.values(careerMax)), mainCareer, bizTries,
    climb: (famId === "dirt" || famId === "struggle") && F.money.peak >= 100000, friendsN: F.friends.length, foesN: F.foes.length, spouse: F.spouse?.name || null, everMarried: spouseChanges.length > 0, marriedTwice: spouseChanges.length >= 2,
    marriedYears: marryYears, marryAge: spouseChanges[0]?.a || 0, divorced: (p.flags?.has?.("divorced") || p.spouseEnd?.why === "divorce") ? 1 : 0, divorceAge: p.spouseEnd?.why === "divorce" ? p.spouseEnd.age : 0, widowed: p.spouseEnd?.why === "widow" ? 1 : 0, widowAge: p.spouseEnd?.why === "widow" ? p.spouseEnd.age : 0,
    kidsN: p.kids.length, firstKidAge: p.kids[0]?.born || 0, kid: p.kids[0]?.name || "", petsN: (p.pets || []).length, dogN: (p.pets || []).filter(x => x.kind === "dog").length, catN: (p.pets || []).filter(x => x.kind === "cat").length, smallN: (p.pets || []).filter(x => x.kind !== "dog" && x.kind !== "cat").length,
    peopleN: people.length, peopleLost: people.filter(x => x.status === "dead").length, parentsLost: parents.filter(x => x.status === "dead").length, parentsLostBefore30: parents.length >= 1 && parents.every(x => x.status === "dead" && (x.endAt ?? 99) < 30) ? 1 : 0,
    parentClose: parents.length ? Math.round(Math.max(...parents.map(x => x.close || 0))) : 0, siblingClose: rel("sibling").length ? Math.round(Math.max(...rel("sibling").map(x => x.close || 0))) : 0,
    loveDec: loves.length, loveBad: loves.filter(d => d.g === "bad").length, focus, focusTop, persona: R.profile.persona || [], values: R.profile.values || [], interests: R.profile.interests || [], shift,
    powerMax: max(st("power")), intelMax: max(st("intel")), intelTopYears: Y.filter(y => (y.st?.intel ?? 0) >= 95).length, socialAvg: avg(st("social")), healthMin: hMin, healthMinAge: hMinAge, healthEnd: Y[Y.length - 1]?.st.health ?? 0, stressAvg: avg(Y.map(y => y.stress)), fameMax: max(Y.map(y => y.fame)), achieveMax: max(Y.map(y => y.achieve)),
    dreamDone: F.dreamDone, noDream: !S.texts.dream && !S.texts.q10 && !S.texts.q18, dreamText: S.texts.dream || S.texts.q10 || S.texts.q18 || S.texts.wish || "", recallsN: R.recalls.length, wordsN: [...words].length,
    housing: p.housing, parentsHomeUntil: (houses.find(h => h.h !== "parents") || { a: age }).a, moves: Math.max(0, houses.length - 1), houses,
    fatesGood: fates.filter(y => y.fate.good === true).length, fatesBad: fates.filter(y => y.fate.good === false).length, crit: rep.grades?.crit || 0, bad: rep.grades?.bad || 0, majorN: F.majorN, decisions: F.decisions,
    minAfter50: after50.length ? Math.min(...after50) : 0, longestJobYears: Math.max(0, ...F.jobs.map(j => j.to - j.from + 1)), longestJob: F.jobs.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from))[0]?.t || "", jobsN: F.jobs.length,
    balancedAt60: !!s60 && age >= 60 && ["happy", "intel", "social", "power", "health"].every(k => (stats60[k] ?? 0) >= 75), // 11-22: 68→75 (약 3%)
    allPrompts: ["q10", "q18", "q25", "q40", "q60"].every(k => S.texts[k]) && age >= 61, goldStages: (rep.stages || []).filter(s => s.tag === "gold").length, darkStages: (rep.stages || []).filter(s => s.tag === "dark").length,
    goldStage: stageTag("gold"), darkStage: stageTag("dark"), cause: F.cause, bigMoneyAbs: Math.abs(F.biggestMoney?.v || 0), bigMoney: F.biggestMoney, money, years: Y, spouseChanges,
  };
}

// =========================
// 결말 유형 고르기
// =========================
export function pickTraits(X) {
  const hits = [];
  for (const t of TRAITS) { let s = 0; try { s = t.test(X) || 0; } catch (_) { s = 0; } if (s > 0) hits.push({ t, s: s + (hash(X.name + t.id) % 7) }); }
  hits.sort((a, b) => b.s - a.s);
  // 같은 계열(직업 하나에 결과 여러 개 등)은 대표 하나만
  const seen = new Set(), out = [];
  for (const h of hits) { const fam = h.t.career ? "c_" + h.t.career : h.t.id.replace(/_(kept|changed)_.*/, "").replace(/^(gold|dark|rg|fo|in)_.*/, "$1"); if (seen.has(fam)) continue; seen.add(fam); out.push(h); }
  return out;
}
function traitVars(t, X, lang) {
  const c = t.career;
  const pv = (X.persona || []).find(id => t.id.endsWith("_" + id)) || X.persona[0];
  const vv = (X.values || []).find(id => t.id.endsWith("_" + id)) || X.values[0];
  const iv = (X.interests || []).find(id => t.id.endsWith("_" + id)) || X.interests[0];
  const fam = birthOf("family", X.famId).label;
  const v = {
    name: X.name, age: X.age, final: money(X.final, lang), peak: money(X.peak, lang), peakAge: X.peakAge, happy: X.happyAvg, debt: X.debtYears, family: fam, familyCap: cap(fam),
    spouse: I.nameOf(X.spouse || ""), kid: I.nameOf(X.kid || ""), friends: X.friendsN, people: X.peopleN, dream: X.dreamText, job: jobName(X.longestJob), region: REG(X.region, X.country, lang),
    focus: L(FOCUS_NAME[X.focusTop], lang), persona: L(PERSONA_NAME[pv], lang), personaCap: cap(L(PERSONA_NAME[pv], lang)), value: L(VALUE_NAME[vv], lang), valueCap: cap(L(VALUE_NAME[vv], lang)),
    interest: L(INTEREST_NAME[iv], lang), interestCap: cap(L(INTEREST_NAME[iv], lang)), stage: I.tStage((t.id.split("_")[1]) || "", (LIFE.STAGES.find(s => s.id === t.id.split("_")[1]) || {}).label || ""),
  };
  v.valueJosa = lang === "ko" ? josa(v.value, "을") : ""; v.interestJosa = lang === "ko" ? josa(v.interest, "을") : "";
  if (c) { v.step = X.careerMax[c]; v.years = X.careerYears[c]; v.age = t.id.endsWith("_fallen") ? X.careerFell[c] : t.id.endsWith("_late") ? X.careerStart[c] : X.age; }
  const id = t.id;
  if (id === "m_gambler") { v.age = X.bigMoney?.a; v.v = money(Math.abs(X.bigMoney?.v || 0), lang); }
  if (id === "f_long_marriage") v.n = X.marriedYears;
  if (id === "f_late_marriage" || id === "f_early_marriage") v.age = X.marryAge;
  if (id === "f_divorced") v.age = X.divorceAge; if (id === "f_widowed") v.age = X.widowAge;
  if (id === "f_many_kids") v.n = X.kidsN; if (id === "f_family_first") v.n = X.focus.family; if (id === "f_parent_close") v.v = X.parentClose;
  if (id === "f_pets" || id === "r_many_pets") v.n = X.petsN;
  if (id === "l_many") v.n = X.loveDec; if (id === "l_bitter") v.n = X.loveBad; if (id === "l_romantic") v.n = X.focus.love;
  if (id === "h_strong") v.v = X.powerMax; if (id === "h_keeper") v.n = X.focus.health; if (id === "h_rest") v.n = X.focus.rest;
  if (id === "h_overcome" || id === "r_comeback_health") { v.a = X.healthMinAge; v.v = X.healthMin; v.n = X.age - X.healthMinAge; }
  if (id === "h_healthy_end") v.v = X.healthEnd; if (id === "h_stress" || id === "h_light") v.v = X.stressAvg;
  if (id === "p_many") v.n = X.peopleN; if (id === "p_friends") v.n = X.friendsN; if (id === "p_rivals") v.n = X.foesN; if (id === "p_social") v.v = X.socialAvg; if (id === "p_friends_focus") v.n = X.focus.friends; if (id === "p_lost_many") v.n = X.peopleLost;
  if (id === "d_recalled") v.n = X.recallsN; if (id === "d_writer_words") v.n = X.wordsN;
  if (id === "h_parents_long") v.a = X.parentsHomeUntil; if (id === "h_moves") v.n = X.moves;
  if (id === "x_lucky") v.n = X.fatesGood; if (id === "x_storms" || id === "r_survivor") v.n = X.fatesBad; if (id === "x_bold_choices") v.n = X.crit; if (id === "x_tangled") v.n = X.bad; if (id === "x_ordinary" || id === "x_turbulent") v.n = X.majorN;
  if (id === "r_three_falls") v.n = X.bizTries; if (id === "r_one_job") v.n = X.longestJobYears; if (id === "r_influence") v.v = X.fameMax; if (id === "r_scholar") v.v = X.intelMax; if (id === "r_grand_family") { v.n = X.kidsN; v.m = X.marriedYears; }
  if (id.startsWith("fo_")) v.n = X.focus[id.slice(3)] || 0; if (id.startsWith("in_")) v.n = (X.focus.play || 0) + (X.focus.study || 0);
  if (id.startsWith("gold_") || id.startsWith("dark_")) { const sid = id.split("_")[1]; const sd = LIFE.STAGES.find(s => s.id === sid); v.stage = I.tStage(sid, sd?.label || sid); }
  return v;
}

// =========================
// 결말 만들기
// =========================
export async function buildEnding(S, opts = {}) {
  setMoneyCountry(S.p?.country || S.rec?.profile?.country || "KR");
  const lang = LANGS[opts.lang] != null ? opts.lang : "ko";
  await I.ensureLang(lang);
  const p = S.p, R = S.rec, F = R.final || {}, X = features(S);
  const seed = `${X.name}|${R.profile.birthYear}|${X.age}|${X.decisions}|${F.cause}`;
  const ctx = I.ctxOf(p);
  const v0 = { name: X.name, age: X.age };
  const detail = opts.detail !== false;
  const wrapUser = (t) => ({ user: true, text: t }); // 직접 쓴 말: 원문 그대로 (화면이 '원문' 표시)

  // ---- 결말 유형 ----
  const traits = pickTraits(X);
  const old = p.ending ? I.tEnding(p.ending) : null;
  const traitCards = traits.slice(0, 8).map(h => ({ id: h.t.id, rare: !!h.t.rare, ep: fmt(L(h.t.ep, lang), traitVars(h.t, X, lang), lang), text: fmt(L(h.t.tx, lang), traitVars(h.t, X, lang), lang) }));
  const special = traits.filter(h => h.t.rare).map(h => ({ id: h.t.id, ep: fmt(L(h.t.ep, lang), traitVars(h.t, X, lang), lang), text: fmt(L(h.t.tx, lang), traitVars(h.t, X, lang), lang) }));
  if (old && (p.ending.rarity === "rare" || p.ending.rarity === "hidden")) special.unshift({ id: "end_" + p.ending.id, ep: old.title, text: old.quote || "", old: 1 });
  const epithet = traitCards[0]?.ep || old?.title || "";
  // 두 번째 결: 실제 특성 2~4위 중에서 (같은 조합 제목이 겹치지 않게) — 모두 이 인생의 실제 특성
  const k2 = traitCards.length > 2 ? 1 + (Math.abs(Number(String(seed).replace(/\D/g, "").slice(-6)) || 0) % Math.min(3, traitCards.length - 1)) : 1;
  const epithet2 = traitCards[k2]?.ep || traitCards[1]?.ep || (old && old.title !== epithet ? old.title : "") || "";

  // ---- 제목·프로필 ----
  const birthYear = R.profile.birthYear, deathYear = (birthYear || 0) + X.age;
  // 제목: 결이 둘 이상이면 두 결을 함께(겹침 줄이기), 하나면 이름·나이와
  const title = epithet2 ? P("life.title2", lang, seed, { epithet, epithet2, name: X.name, years: X.age, birth: R.profile.birthYear }) : P("life.title", lang, seed, { epithet, name: X.name, years: X.age });
  const sub = P("life.sub", lang, seed, { birth: birthYear, death: deathYear, region: REG(X.region, X.country, lang), age: X.age });
  const cz = causeOf(F.cause);
  const deathLine = P("death.line", lang, seed, { ...v0, cause: cz.label });
  const lastJob = F.jobs[F.jobs.length - 1];
  const profile = {
    name: X.name, gender: R.profile.gender, birthYear, deathYear, age: X.age, region: REG(X.region, X.country, lang), country: countryName(X.country || "KR", lang),
    job: lastJob ? jobName(lastJob.t) : null, career: X.mainCareer ? careerName(X.mainCareer, lang) : null, family: birthOf("family", X.famId).label, cause: cz.label, causeLine: cz.line,
    spouse: X.spouse ? I.nameOf(X.spouse) : null, kids: X.kidsN, mode: R.profile.mode, persona: X.persona.map(id => L(PERSONA_NAME[id], lang)), values: X.values.map(id => L(VALUE_NAME[id], lang)), interests: X.interests.map(id => L(INTEREST_NAME[id], lang)),
    ending: old ? { title: old.title, quote: old.quote, rarity: p.ending.rarity || null, emoji: p.ending.emoji || "" } : null,
  };
  const famBits = []; if (X.spouse) famBits.push(P("fam.spouse", lang, seed, { spouse: I.nameOf(X.spouse), n: X.marriedYears })); if (X.kidsN) famBits.push(P("fam.kids", lang, seed, { n: X.kidsN })); if (X.petsN) famBits.push(P("fam.pets", lang, seed, { n: X.petsN }));
  const glance = P("sec.glance", lang, seed, { ...v0, dec: X.decisions, maj: X.majorN, work: F.jobs.reduce((s, j) => s + (j.to - j.from + 1), 0), fam: famBits.length ? famBits.join(lang === "ko" ? ", " : lang === "ja" ? "、" : ", ") + (lang === "ja" ? "。" : ".") : P("fam.none", lang, seed, {}), fate: X.fatesGood + X.fatesBad });

  // ---- 장별 이야기 (자서전 본문) ----
  const chapters = buildChapters(S, X, lang, seed, ctx, detail);

  // ---- 섹션 ----
  const sec = {};
  sec.career = careerSection(S, X, lang, seed);
  sec.economy = { text: [P("money.sum", lang, seed, { total: money(X.totalIncome, lang), peak: money(X.peak, lang), peakAge: X.peakAge, low: money(X.low, lang), lowAge: X.lowAge, final: money(X.final, lang) })], series: X.years.map(y => [y.a, y.m]), income: X.years.map(y => [y.a, y.inc]) };
  if (X.debtYears) sec.economy.text.push(P("money.debt", lang, seed, { n: X.debtYears }));
  if (X.bigMoney) { const d = R.decisions.find(x => x.a === X.bigMoney.a && x.id === X.bigMoney.id); if (d) { const e = evText(d, ctx); sec.economy.text.push(P("money.bigdecision", lang, seed, { age: d.a, title: e.title, choice: e.choice, choiceJosa: lang === "ko" ? josa(e.choice, "을") : "", v: money(Math.abs(X.bigMoney.v), lang), dir: P(X.bigMoney.v >= 0 ? "dir.up" : "dir.down", lang, seed, {}) })); } }
  sec.love = loveSection(S, X, lang, seed, ctx);
  sec.family = familySection(S, X, lang, seed);
  sec.people = peopleSection(S, X, lang, seed);
  sec.health = { series: X.years.map(y => [y.a, y.st.health, y.stress]), min: X.healthMin, minAge: X.healthMinAge, end: X.healthEnd, stressAvg: X.stressAvg, cause: cz.label, causeLine: cz.line, focusHealth: X.focus.health || 0 };
  sec.growth = { series: X.years.map(y => [y.a, y.st.intel, y.st.social, y.st.power, y.st.happy]), shift: X.shift, persona: personaShift(X, lang, seed) };
  sec.dream = dreamSection(S, X, lang, seed);
  const tops = topMoments(S, X, lang, ctx);
  sec.topHappy = tops.happy; sec.topHard = tops.hard; sec.topChoice = tops.choice;
  sec.notTaken = opts.whatIf === false ? [] : notTaken(S, lang, seed, ctx, opts.whatIfN ?? 3);
  sec.hidden = hiddenStories(S, X, lang, seed, ctx, sec.notTaken);
  sec.values = valuesSection(X, lang);
  sec.words = myWords(S, X, lang);
  { // 직접 쓴 말 → 이야기 (목록 대신)
    const ys = S.rec.years, lastHappy = ys.length ? (ys[ys.length - 1].st?.happy ?? 50) : 50, lt = S.texts.letter;
    const car = X.mainCareer || S.p.career;
    sec.wordsStory = wordsStory(S, { lang, seed, name: X.name, age: X.age, dreamDone: X.dreamDone ?? null, career: car ? (lang === "en" ? careerName(car, lang) : careerBare(car, lang)) : "", final: money(X.final, lang), lastHappy,
      letterTo: lt ? (LETTER_TO[lt.toKey]?.[lang] || lt.to || "") : "" });
  }
  sec.regret = regrets(S, X, lang, seed, ctx, tops);
  sec.legacy = legacy(S, X, lang, seed);
  sec.last = lastChapter(S, X, lang, seed, ctx);
  sec.stats = statsList(S, X, lang);
  sec.timeline = timeline(S, X, lang, ctx);
  sec.companions = (S.companions || []).map(C => companionLine(C, lang));
  const facts = P("verdict.fact", lang, seed, { age: X.age, happy: X.happyAvg, dec: X.decisions, work: F.jobs.reduce((s, j) => s + (j.to - j.from + 1), 0), final: money(X.final, lang) });
  const respect = [];
  if (X.majorN <= 4) respect.push(P("respect.plain", lang, seed, v0)); if (!X.everMarried && X.age >= 40) respect.push(P("respect.alone", lang, seed, v0)); if (X.final < 3000) respect.push(P("respect.poor", lang, seed, v0)); if (X.age < 40) respect.push(P("respect.short", lang, seed, v0));
  sec.verdict = { fact: facts, view: P("verdict.view", lang, seed, { epithet, name: X.name }), respect, score: F.score };

  const out = { lang, title, sub, epithet, deathLine, profile, glance, traits: traitCards, special, chapters, sec, letter: S.texts.letter || null, last: S.texts.last || "", seed };
  out.book = bookPages(out, S, X, lang, seed);
  out.chars = countChars(out);
  return out;
}

// ---------- 장 ----------
function buildChapters(S, X, lang, seed, ctx, detail) {
  const R = S.rec, Y = X.years, D = R.decisions, p = S.p, T = S.texts;
  const prompts = { 10: T.q10, 18: T.q18, 25: T.q25, 40: T.q40, 60: T.q60 }, PKEY = { 10: "q10", 18: "q18", 25: "q25", 40: "q40", 60: "q60" };
  const out = [];
  for (let b = 0; b < BAND.length; b++) {
    const [lo, hi] = BAND[b]; if (lo > X.age) break;
    const ys = Y.filter(y => y.a >= lo && y.a <= hi); if (!ys.length && b > 0) break;
    const v = { name: X.name, age: lo };
    const paras = [];
    if (b === 0) { const fam = birthOf("family", X.famId), body = birthOf("body", R.profile.birth?.body), tal = birthOf("talent", R.profile.birth?.talent); paras.push(P("intro.0", lang, seed, { name: X.name, year: R.profile.birthYear, region: REG(X.region, X.country, lang), family: fam.label, body: body.text || "", talent: tal.text || "" })); }
    else paras.push(P("intro." + b, lang, seed, v));
    // 이 시기 일들을 나이 순서로
    const items = [];
    const decs = D.filter(d => d.a >= lo && d.a <= hi);
    const pickDecs = detail ? decs : decs.slice().sort((a, b2) => weightOf(b2) - weightOf(a)).slice(0, 4).sort((a, b2) => a.a - b2.a);
    for (const d of pickDecs) items.push({ a: d.a, o: 1, kind: "dec", d });
    for (const y of ys) {
      if (y.fate) items.push({ a: y.a, o: 0, kind: "fate", y });
      for (const r of y.recall || []) items.push({ a: y.a, o: 3, kind: "recall", id: r });
      for (const t of y.th || []) items.push({ a: y.a, o: 4, kind: "thought", t });
      if (prompts[y.a]) items.push({ a: y.a, o: 5, kind: "prompt", t: prompts[y.a], key: PKEY[y.a] });
    }
    for (const c of changeItems(S, X, lo, hi, lang, seed)) items.push(c);
    if (detail) { const q = ys.filter(y => !y.ev && !y.fate && y.quiet && (y.quiet.text || y.quiet.k || y.quiet.sys)); let lastQ = -9; for (const y of q) { if (y.a - lastQ < 4) continue; const t = I.tQuiet(y.quiet, ctx); if (t) { items.push({ a: y.a, o: 6, kind: "quiet", t }); lastQ = y.a; } } }
    items.sort((a, b2) => a.a - b2.a || a.o - b2.o);
    let lastQuiet = 0;
    const sentences = [];
    for (const it of items) {
      if (it.kind === "dec") { const e = evText(it.d, ctx); sentences.push(P("ev.open", lang, seed, { age: it.a, title: stripDot(e.title), name: X.name }, it.d.id) + " " + P("ev.choice", lang, seed, { name: X.name, choice: e.choice, choiceJosa: lang === "ko" ? josa(e.choice, "을") : "" }, it.d.id) + " " + (e.narr || "")); }
      else if (it.kind === "fate") { const f = I.tFate({ id: it.y.fate.id, title: it.y.fate.t, text: it.y.fate.x }, ctx); sentences.push(P("ev.fate", lang, seed, { age: it.a, title: stripDot(f.title), text: f.text || "" }, it.y.fate.id)); }
      else if (it.kind === "recall") { const R0 = recallText(S, it.id, X, lang, seed); if (R0) sentences.push(R0); }
      else if (it.kind === "thought") sentences.push(P("quote.thought", lang, seed, { age: it.a, t: it.t }, it.t));
      else if (it.kind === "prompt") sentences.push(P(PH["quote." + it.key] ? "quote." + it.key : "quote.prompt", lang, seed, { age: it.a, name: X.name, t: it.t }, it.t));
      else if (it.kind === "change") sentences.push(it.text);
      else if (it.kind === "quiet") sentences.push(P("flow.quiet", lang, seed, { age: it.a, text: it.t }, String(it.a)));
    }
    // 문단으로 나누기 (4문장씩)
    for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join(" "));
    if (sentences.length === 0) paras.push(P("flow.empty", lang, seed, v));
    // 흐름 요약 (숫자)
    if (ys.length >= 3) {
      const h0 = ys[0].st.happy, h1 = ys[ys.length - 1].st.happy, m0 = ys[0].m, m1 = ys[ys.length - 1].m;
      const flow = [];
      if (Math.abs(h1 - h0) >= 8) flow.push(P(h1 > h0 ? "flow.happyUp" : "flow.happyDown", lang, seed, { from: h0, to: h1 }, String(b)));
      if (b >= 3 && Math.abs(m1 - m0) >= 3000) flow.push(P(m1 > m0 ? "flow.moneyUp" : "flow.moneyDown", lang, seed, { from: money(m0, lang), to: money(m1, lang) }, String(b)));
      const fc = {}; for (const y of ys) if (y.foc) fc[y.foc] = (fc[y.foc] || 0) + 1; const top = Object.entries(fc).sort((a2, b2) => b2[1] - a2[1])[0];
      if (top && top[1] >= 3) flow.push(P("flow.focus", lang, seed, { focus: L(FOCUS_NAME[top[0]], lang), n: top[1] }, String(b)));
      if (flow.length) paras.push(flow.join(" "));
    }
    out.push({ band: b, from: lo, to: Math.min(hi, X.age), title: P("ch." + b, lang, seed, {}), sub: P("chsub." + b, lang, seed, {}), paras, n: items.length, happy: ys.length ? Math.round(ys.reduce((s, y) => s + y.st.happy, 0) / ys.length) : null });
  }
  return out;
}
const stripDot = (s) => String(s || "").replace(/[.。!！?？\s]+$/, "");
const weightOf = (d) => { let w = d.maj ? 30 : 0; for (const [k, v] of Object.entries(d.d || {})) w += k === "money" ? Math.min(30, Math.log10(1 + Math.abs(v)) * 8) : Math.abs(v); return w; };
function recallText(S, id, X, lang, seed) {
  const need = { dream_teen: "dream", dream_30: "dream", q10_25: "q10", q18_35: "q18", q25_45: "q25", q40_55: "q40", q60_70: "q60", wish_first_job: "wish", dream_kid: "dream", thought_old: "thought" }[id];
  const t = need === "thought" ? (S.texts.thoughts?.[0]?.text || "") : S.texts[need]; if (!t) return "";
  return P("recall." + id, lang, seed, { name: X.name, t, tJosa: lang === "ko" ? josa(t, "을") : "" });
}
/** 해마다 기록을 비교해 찾은 삶의 변화 (직업·결혼·아이·이혼·사별·반려동물·부모님·집·은퇴) */
function changeItems(S, X, lo, hi, lang, seed) {
  const out = [], Y = X.years, p = S.p;
  let prev = Y.find(y => y.a === lo - 1) || null;
  for (const y of Y) {
    if (y.a < lo || y.a > hi) { prev = y; continue; }
    const v = { name: X.name, age: y.a };
    if (y.job?.t && (!prev || !prev.job || prev.job.t !== y.job.t)) {
      if (prev?.job?.t) out.push({ a: y.a, o: 2, kind: "change", text: P("fx.jobchange", lang, seed, { ...v, from: jobName(prev.job.t), to: jobName(y.job.t), toJosa: "" }, "jc" + y.a) });
      else out.push({ a: y.a, o: 2, kind: "change", text: P("fx.job", lang, seed, { ...v, job: jobName(y.job.t), jobJosa: lang === "ko" ? josa(jobName(y.job.t), "이") : "" }, "j" + y.a) });
    } else if (prev?.job?.t && !y.job && y.a < 75) out.push({ a: y.a, o: 2, kind: "change", text: P(y.a >= 55 ? "fx.retire" : "fx.jobless", lang, seed, v, "jl" + y.a) });
    if (y.sp && (!prev || prev.sp !== y.sp)) out.push({ a: y.a, o: 2, kind: "change", text: P("fx.marry", lang, seed, { ...v, spouse: I.nameOf(y.sp) }, "m" + y.a) });
    if (prev?.sp && !y.sp) out.push({ a: y.a, o: 2, kind: "change", text: P(p.spouseEnd?.why === "widow" && p.spouseEnd.age === y.a ? "fx.widow" : "fx.divorce", lang, seed, { ...v, spouse: I.nameOf(prev.sp) }, "d" + y.a) });
    if (prev && y.kids > prev.kids) for (const k of p.kids.filter(k => k.born === y.a)) out.push({ a: y.a, o: 2, kind: "change", text: P("fx.kid", lang, seed, { ...v, kid: I.nameOf(k.name) }, "k" + k.name) });
    if (prev && y.house !== prev.house && y.a >= 19) out.push({ a: y.a, o: 2, kind: "change", text: P("fx.house", lang, seed, { ...v, house: L(HOUSE_NAME[y.house], lang) }, "h" + y.a) });
    prev = y;
  }
  for (const pet of p.pets || []) {
    if (pet.born >= lo && pet.born <= hi) out.push({ a: pet.born, o: 2, kind: "change", text: P("fx.pet", lang, S.rec.profile.name, { name: X.name, age: pet.born, pet: I.nameOf(pet.name) }, "p" + pet.name) });
    if (pet.diedAt != null && pet.diedAt >= lo && pet.diedAt <= hi) out.push({ a: pet.diedAt, o: 2, kind: "change", text: P("fx.petgone", lang, S.rec.profile.name, { name: X.name, age: pet.diedAt, pet: I.nameOf(pet.name), n: Math.max(1, pet.diedAt - pet.born) }, "pg" + pet.name) });
  }
  for (const x of p.people || []) if ((x.rel === "father" || x.rel === "mother" || x.rel === "sibling") && x.status === "dead" && x.endAt >= lo && x.endAt <= hi && x.endAt > 0) out.push({ a: x.endAt, o: 2, kind: "change", text: P("fx.parentgone", lang, S.rec.profile.name, { name: X.name, age: x.endAt, who: I.nameOf(x.name), whoJosa: "" }, "pd" + x.id) });
  return out;
}

// ---------- 섹션들 ----------
function careerSection(S, X, lang, seed) {
  const F = S.rec.final, jobs = F.jobs.map(j => ({ title: jobName(j.t), from: j.from, to: j.to, years: j.to - j.from + 1, career: j.car ? careerName(j.car, lang) : null }));
  const text = [];
  if (!jobs.length) text.push(P("career.none", lang, seed, { name: X.name }));
  else text.push(P("career.list", lang, seed, { name: X.name, n: jobs.length }));
  const best = Object.entries(X.careerMax).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) { const h = (S.p.careerHist || []).concat(S.p.career ? [{ key: S.p.career, step: S.p.careerStep, from: S.p.careerSince, to: X.age }] : []).filter(x => x.key === best[0]).sort((a, b) => b.step - a.step)[0]; text.push(P("career.peak", lang, seed, { name: X.name, career: careerBare(best[0], lang), step: best[1], age: h ? h.to : X.age })); }
  const hist = (S.p.careerHist || []).map(h => ({ career: careerName(h.key, lang), step: h.step, from: h.from, to: h.to, why: h.why }));
  const achv = (S.rec.final.achv || []).map(id => { const a = I.tAchv(id); return { id, emoji: a.emoji, name: a.name, desc: a.desc }; });
  return { jobs, hist, text, achv };
}
function loveSection(S, X, lang, seed, ctx) {
  const D = S.rec.decisions.filter(d => d.cat === "love").map(d => { const e = evText(d, ctx); return { a: d.a, title: e.title, choice: e.choice, narr: e.narr, g: d.g }; });
  return { moments: D, spouse: X.spouse ? I.nameOf(X.spouse) : null, marryAge: X.marryAge, marriedYears: X.marriedYears, divorced: !!X.divorced, divorceAge: X.divorceAge, widowed: !!X.widowed, widowAge: X.widowAge, partners: X.spouseChanges.map(s => ({ a: s.a, name: I.nameOf(s.name) })) };
}
function familySection(S, X, lang, seed) {
  const p = S.p;
  const parents = (p.people || []).filter(x => ["father", "mother", "sibling"].includes(x.rel)).map(x => ({ name: I.nameOf(x.name), rel: L(REL_NAME[x.rel], lang) || x.rel, alive: x.status !== "dead", lostAt: x.status === "dead" ? x.endAt : null, close: Math.round(x.close || 0) }));
  const kids = p.kids.map(k => ({ name: I.nameOf(k.name), born: k.born, ageAtEnd: X.age - k.born, g: k.gender }));
  const pets = (p.pets || []).map(x => ({ name: I.nameOf(x.name), kind: x.kind, breed: x.breed, from: x.born, to: x.diedAt ?? null, years: (x.diedAt ?? X.age) - x.born, alive: x.alive }));
  return { parents, kids, pets, birthFamily: birthOf("family", X.famId) };
}
function peopleSection(S, X, lang, seed) {
  const L0 = (S.p.people || []).slice().sort((a, b) => (b.close || 0) - (a.close || 0)).slice(0, 30).map(x => {
    const state = x.status === "dead" ? "dead" : x.status === "active" ? "active" : x.status === "ended" ? "gone" : "other";
    return { name: I.nameOf(x.name), rel: L(REL_NAME[x.rel], lang) || I.tRel(x.rel), since: x.since, until: x.endAt ?? null, close: Math.round(x.close || 0), conflict: Math.round(x.conflict || 0), age: x.off != null ? X.age + x.off : null, state, stateText: P("pstate." + state, lang, seed, {}), notes: (x.notes || []).map(n => n.a) };
  });
  return { intro: P("people.intro", lang, seed, { name: X.name, n: (S.p.people || []).length }), list: L0, friends: S.rec.final.friends.map(n => I.nameOf(n)), foes: S.rec.final.foes.map(n => I.nameOf(n)) };
}
function personaShift(X, lang, seed) {
  const ks = Object.entries(X.shift).filter(([k]) => SHIFT_NAME[k + "+"]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const top = ks[0]; if (!top || Math.abs(top[1]) < 8 || X.age < 60) return null;
  const [k, d] = top; const sign = d > 0 ? "+" : "-"; const opp = d > 0 ? "-" : "+";
  return P("hidden.persona", lang, seed, { name: X.name, from: L(SHIFT_NAME[k + opp], lang), to: L(SHIFT_NAME[k + sign], lang), fromJosa: "", toJosa: "", stat: L(STAT_NAME[k], lang), a: X.years.find(y => y.a === 20)?.st[k] ?? "", b: X.years.find(y => y.a === 60)?.st[k] ?? "" });
}
function dreamSection(S, X, lang, seed) {
  const T = S.texts, t = X.dreamText;
  const lines = [];
  if (!t) lines.push(P("dream.none", lang, seed, { name: X.name }));
  else if (X.dreamDone === true) lines.push(P("dream.done", lang, seed, { name: X.name, t, career: careerBare(X.mainCareer, lang), careerJosa: lang === "ko" ? josa(careerBare(X.mainCareer, lang), "이") : "" }));
  else if (X.dreamDone === false) lines.push(P("dream.miss", lang, seed, { name: X.name, t, tJosa: lang === "ko" ? josa(t, "은") : "", career: careerBare(X.mainCareer || S.p.career, lang) || (lang === "ko" ? "자신의 방식" : lang === "ja" ? "自分なりのやり方" : "their own way"), careerJosa: lang === "ko" ? josa(careerBare(X.mainCareer, lang) || "방식", "으로") : "", n: X.recallsN }));
  else lines.push(P("dream.free", lang, seed, { t }));
  const goals = (S.rec.final.goalsDone || []).map(id => I.tGoal(id));
  const answers = [["dream", 0], ["wish", 0], ["q10", 10], ["q18", 18], ["q25", 25], ["q40", 40], ["q60", 60]].filter(([k]) => T[k]).map(([k, a]) => ({ k, a, text: T[k], user: true }));
  return { text: lines, goals, answers, done: X.dreamDone };
}
function topMoments(S, X, lang, ctx) {
  const D = S.rec.decisions;
  const mk = (d, k) => { const e = evText(d, ctx); return { a: d.a, title: stripDot(e.title), choice: e.choice, narr: e.narr, v: d.d?.happy || 0, cat: d.cat, emoji: d.emoji }; };
  const happy = D.filter(d => (d.d?.happy || 0) > 0).sort((a, b) => (b.d.happy - a.d.happy) || (b.maj - a.maj)).slice(0, 10).map(d => mk(d)).sort((a, b) => a.a - b.a);
  const hardD = D.filter(d => (d.d?.happy || 0) < 0 || d.g === "bad").sort((a, b) => ((a.d?.happy || 0) - (b.d?.happy || 0)) || (b.maj - a.maj)).slice(0, 10).map(d => mk(d));
  const hardF = X.years.filter(y => y.fate && y.fate.good === false).map(y => { const f = I.tFate({ id: y.fate.id, title: y.fate.t, text: y.fate.x }, ctx); return { a: y.a, title: stripDot(f.title), choice: "", narr: f.text, v: 0, cat: "fate", fate: 1 }; });
  const hard = hardD.concat(hardF).slice(0, 10).sort((a, b) => a.a - b.a);
  const choice = D.slice().sort((a, b) => weightOf(b) - weightOf(a)).slice(0, 10).map(d => ({ ...mk(d), alts: (d.alts || []).map(a => typeof a === "string" ? a : I.tChoiceText(d.id, a.id, a.text, ctx)) })).sort((a, b) => a.a - b.a);
  return { happy, hard, choice };
}
/** 선택하지 않은 길: 중요한 분기 3곳에서 다른 선택을 하고 나머지를 자동으로 살아 본 가상 인생과 비교 */
function notTaken(S, lang, seed, ctx, perBranch = 3) {
  if (!S.branches?.length) return [];
  const kb = keyBranches(S, 3), F = S.rec.final;
  const baseHappy = F.happyAvg;
  return kb.map(b => {
    const alt = b.alts[0]; if (!alt) return null;
    const runs = [];
    for (let i = 0; i < perBranch; i++) { try { const N = branchFrom(S, b.idx, alt.id); if (!N) break; autoLive(N); if (N.done) runs.push(N.rec.final); } catch (_) { break; } }
    if (!runs.length) return null;
    const avg = (f) => Math.round(runs.reduce((s, r) => s + f(r), 0) / runs.length);
    const dAge = avg(r => r.deathAge) - F.deathAge, dMoney = avg(r => r.money.final) - F.money.final, dHappy = avg(r => r.happyAvg) - baseHappy;
    const res = [];
    if (Math.abs(dAge) >= 3) res.push(P(dAge > 0 ? "whatif.res.longer" : "whatif.res.shorter", lang, seed, { d: Math.abs(dAge) }));
    if (Math.abs(dMoney) >= 5000) res.push(P(dMoney > 0 ? "whatif.res.richer" : "whatif.res.poorer", lang, seed, { v: money(Math.abs(dMoney), lang) }));
    if (Math.abs(dHappy) >= 4) res.push(P(dHappy > 0 ? "whatif.res.happier" : "whatif.res.sadder", lang, seed, { v: Math.abs(dHappy) }));
    if (!res.length) res.push(P("whatif.res.same", lang, seed, {}));
    const evTitle = I.tEventTitle(b.evId, b.title, ctx);
    const chosen = I.tChoiceText(b.evId, b.chosen, b.choiceText, ctx), altText = I.tChoiceText(b.evId, alt.id, alt.text, ctx);
    const endings = runs.map(r => r.ending?.id).filter(Boolean);
    return { idx: b.idx, age: b.age, title: stripDot(evTitle), chosen, alt: altText, altId: alt.id, alts: b.alts.map(a => ({ id: a.id, text: I.tChoiceText(b.evId, a.id, a.text, ctx) })), n: runs.length, result: res.join(lang === "ko" ? ", " : lang === "ja" ? "、" : "; "), dAge, dMoney, dHappy, endings: endings.map(id => I.tEnding(LIFE.ENDINGS.find(e => e.id === id) || { id, title: id }).title), note: P("whatif.note", lang, seed, {}) };
  }).filter(Boolean);
}
function hiddenStories(S, X, lang, seed, ctx, notTakenList) {
  const out = [], D = S.rec.decisions, p = S.p;
  // ① 어릴 때(18살 이하) 고른 길이 뒤에 그 직업으로 이어짐 (사건 정의의 route/career로 추적)
  const EV = new Map(LIFE.EVENTS.map(e => [e.id, e]));
  const hist = (p.careerHist || []).concat(p.career ? [{ key: p.career, from: p.careerSince }] : []);
  for (const d of D.filter(d => d.a <= 18)) {
    const ev = EV.get(d.id); const ch = ev?.choices?.find(c => c.id === d.cid); if (!ch) continue;
    const rt = ch.career || ch.route || (ch.outcomes || []).map(o => o.career || o.route).find(Boolean); if (!rt) continue;
    const ck = LIFE.CAREERS[rt] ? rt : Object.keys(LIFE.CAREERS).find(k => LIFE.CAREERS[k].route === rt || (LIFE.CAREERS[k].alias || []).includes(rt));
    const h = hist.find(x => x.key === ck && x.from > d.a); if (!h) continue;
    const e = evText(d, ctx);
    out.push({ k: "route", text: P("hidden.route", lang, seed, { age1: d.a, age2: h.from, choice: e.choice, choiceJosa: lang === "ko" ? josa(e.choice, "이") : "", career: careerBare(ck, lang), careerJosa: lang === "ko" ? josa(careerBare(ck, lang), "으로") : "" }, d.id) });
    if (out.length >= 2) break;
  }
  // ② 만남이 관계로 이어짐 (사람 기록: 처음 만난 나이 → 배우자·동업자)
  for (const x of (p.people || []).filter(x => ["spouse", "cofounder", "bestfriend"].includes(x.rel) && x.notes?.length)) {
    const first = x.since, became = (x.notes.find(n => ["marry", "partner", "cofound", "best"].some(k => String(n.k).includes(k))) || x.notes[x.notes.length - 1]).a;
    if (became > first) { out.push({ k: "meet", text: P("hidden.meet", lang, seed, { age1: first, age2: became, who: I.nameOf(x.name), rel: L(REL_NAME[x.rel], lang), relJosa: lang === "ko" ? josa(L(REL_NAME[x.rel], lang), "이") : "" }, x.name) }); break; }
  }
  // ③ 최고 재산의 바탕이 된 결정 (최고점 이전 10년 안에서 돈을 가장 크게 늘린 선택)
  if (X.peak > 20000 && X.peakAge) { const d = D.filter(d => d.a <= X.peakAge && d.a >= X.peakAge - 12 && (d.d?.money || 0) > 0).sort((a, b) => b.d.money - a.d.money)[0]; if (d) { const e = evText(d, ctx); out.push({ k: "success", text: P("hidden.success", lang, seed, { peakAge: X.peakAge, age: d.a, choice: e.choice, choiceJosa: lang === "ko" ? josa(e.choice, "이") : "" }) }); } }
  // ④ 놓친 기회 (가상 인생 결과가 더 좋았던 분기)
  for (const n of notTakenList || []) { if (n.dMoney > 5000 || n.dHappy > 4 || n.dAge > 3) { out.push({ k: "missed", text: P("hidden.missed", lang, seed, { age: n.age, title: n.title, name: X.name, alt: n.alt, altJosa: lang === "ko" ? josa(n.alt, "을") : "", n: n.n, result: n.result }) }); break; } }
  // ⑤ 성격 변화
  const ps = personaShift(X, lang, seed); if (ps) out.push({ k: "persona", text: ps });
  return out;
}
function valuesSection(X, lang) {
  const chosen = X.values.map(id => ({ id, name: L(VALUE_NAME[id], lang) }));
  // 실제로 시간을 쓴 곳 (초점 연수)
  const spent = Object.entries(X.focus).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: L(FOCUS_NAME[id], lang), years: n }));
  // 시기별 초점
  const byBand = BAND.map(([lo, hi], b) => { const fc = {}; for (const y of X.years) if (y.a >= lo && y.a <= hi && y.foc) fc[y.foc] = (fc[y.foc] || 0) + 1; const top = Object.entries(fc).sort((a, b2) => b2[1] - a[1])[0]; return top ? { band: b, focus: L(FOCUS_NAME[top[0]], lang), years: top[1] } : null; }).filter(Boolean);
  return { chosen, spent, byBand };
}
function myWords(S, X, lang) {
  const T = S.texts, out = [];
  const K = [["dream", 0], ["wish", 0], ["q10", 10], ["q18", 18], ["q25", 25], ["q40", 40], ["q60", 60]];
  for (const [k, a] of K) if (T[k]) out.push({ k, a, text: T[k] });
  for (const t of T.thoughts || []) out.push({ k: "thought", a: t.a, text: t.text });
  if (T.last) out.push({ k: "last", a: X.age, text: T.last });
  if (T.letter?.text) out.push({ k: "letter", a: X.age, text: T.letter.text, to: T.letter.to || "" });
  return out.sort((a, b) => a.a - b.a);
}
function regrets(S, X, lang, seed, ctx, tops) {
  const out = [];
  if (S.texts.q40) out.push({ user: true, a: 40, text: S.texts.q40 });
  const worst = tops.hard.slice().sort((a, b) => a.v - b.v)[0]; if (worst) out.push({ a: worst.a, text: `${worst.title}${worst.choice ? " — " + worst.choice : ""}` });
  const unfulfilled = X.dreamDone === false ? X.dreamText : null;
  return { items: out, dream: unfulfilled };
}
function legacy(S, X, lang, seed) {
  const F = S.rec.final;
  return { inheritance: money(Math.max(0, X.final), lang), kids: S.p.kids.map(k => I.nameOf(k.name)), achv: F.achv.length, fame: X.fameMax, careerPeak: X.careerMaxAny, mainCareer: X.mainCareer ? careerName(X.mainCareer, lang) : null, goals: F.goalsDone.length, people: X.peopleN };
}
function lastChapter(S, X, lang, seed, ctx) {
  const from = Math.max(0, X.age - 5);
  const evs = S.rec.decisions.filter(d => d.a >= from).map(d => { const e = evText(d, ctx); return { a: d.a, title: stripDot(e.title), choice: e.choice, narr: e.narr }; });
  const quiet = X.years.filter(y => y.a >= from && !y.ev && y.quiet).map(y => ({ a: y.a, text: I.tQuiet(y.quiet, ctx) })).filter(x => x.text);
  const lines = [P("last.intro", lang, seed, { name: X.name })];
  if (S.texts.last) lines.push(P("last.words", lang, seed, { name: X.name, t: S.texts.last }));
  return { intro: lines, events: evs, quiet, lastWords: S.texts.last || "", cause: causeOf(S.rec.final.cause) };
}
function timeline(S, X, lang, ctx) {
  const out = [];
  for (const y of X.years) {
    const items = [];
    const d = y.dec != null ? S.rec.decisions[y.dec] : null;
    if (d) { const e = evText(d, ctx); items.push({ k: "dec", title: stripDot(e.title), choice: e.choice, maj: d.maj, emoji: d.emoji, g: d.g }); }
    if (y.fate) { const f = I.tFate({ id: y.fate.id, title: y.fate.t, text: y.fate.x }, ctx); items.push({ k: "fate", title: stripDot(f.title), good: y.fate.good }); }
    if (!d && !y.fate && y.quiet) items.push({ k: "quiet", title: I.tQuiet(y.quiet, ctx) || "" });
    for (const t of y.th || []) items.push({ k: "thought", title: t, user: true });
    out.push({ a: y.a, y: y.y, happy: y.st.happy, health: y.st.health, money: y.m, job: y.job ? jobName(y.job.t) : null, items });
  }
  return out;
}
function companionLine(C, lang) {
  const p = C.p;
  return { name: I.nameOf(p.nickname) || p.nickname, region: REG(C.rec.profile.region, C.rec.profile.country, lang), age: p.deathAge ?? p.age, alive: p.alive, job: p.job ? jobName(p.job.title) : (C.rec.final?.jobs?.slice(-1)[0] ? jobName(C.rec.final.jobs.slice(-1)[0].t) : null), money: money(p.stats.money, lang), happy: Math.round(p.stats.happy), kids: p.kids.length, married: !!p.spouse || !!C.rec.final?.spouse, ending: p.ending ? I.tEnding(p.ending).title : null, cause: p.cause ? causeOf(p.cause.id).label : null };
}
function statsList(S, X, lang) {
  const F = S.rec.final, rep = F.report || {}, Y = X.years;
  const happyY = Y.map(y => y.st.happy), best = Y[happyY.indexOf(Math.max(...happyY))], worst = Y[happyY.indexOf(Math.min(...happyY))];
  const richY = Y[Y.map(y => y.m).indexOf(Math.max(...Y.map(y => y.m)))];
  const workYears = F.jobs.reduce((s, j) => s + (j.to - j.from + 1), 0);
  const retire = Y.find(y => y.a >= 50 && !y.job && Y.find(z => z.a === y.a - 1)?.job);
  const st = (k, v, unit = "") => ({ k, label: L(STAT_LABEL[k], lang), v, unit });
  const yr = (a) => lang === "ko" ? `${a}살` : lang === "ja" ? `${a}歳` : `age ${a}`;
  const days = Math.round(X.age * 365.25);
  const focusTop = X.focusTop ? `${L(FOCUS_NAME[X.focusTop], lang)} (${X.focus[X.focusTop]})` : "—";
  const avgLife = 79; // 이 게임 기록 엔진 1,000번 시뮬 평균(약 77~80세) — 실제 통계 아님
  return [
    st("age", X.age), st("days", num(days, lang)), st("birthYear", S.rec.profile.birthYear), st("deathYear", (S.rec.profile.birthYear || 0) + X.age), st("cause", causeOf(F.cause).label),
    st("lifeExp", (X.age - avgLife >= 0 ? "+" : "") + (X.age - avgLife)), st("decisions", X.decisions), st("major", X.majorN), st("fates", X.fatesGood + X.fatesBad), st("fatesGood", X.fatesGood), st("fatesBad", X.fatesBad),
    st("crit", rep.grades?.crit || 0), st("good", rep.grades?.good || 0), st("mid", rep.grades?.mid || 0), st("bad", rep.grades?.bad || 0),
    st("workYears", workYears), st("jobsN", X.jobsN), st("longestJob", X.longestJob ? `${jobName(X.longestJob)} (${X.longestJobYears})` : "—"), st("careerStep", X.careerMaxAny), st("firstJobAge", F.jobs[0] ? yr(F.jobs[0].from) : "—"), st("retireAge", retire ? yr(retire.a) : "—"),
    st("totalIncome", money(X.totalIncome, lang)), st("peakMoney", money(X.peak, lang)), st("lowMoney", money(X.low, lang)), st("finalMoney", money(X.final, lang)), st("debtYears", X.debtYears), st("richYear", richY ? yr(richY.a) : "—"),
    st("happyAvg", X.happyAvg), st("happyMax", Math.max(...happyY)), st("happyMin", Math.min(...happyY)), st("bestYear", best ? yr(best.a) : "—"), st("worstYear", worst ? yr(worst.a) : "—"),
    st("healthMin", X.healthMin), st("healthEnd", X.healthEnd), st("intelMax", X.intelMax), st("socialMax", Math.max(...Y.map(y => y.st.social))), st("powerMax", X.powerMax), st("fameMax", X.fameMax), st("stressAvg", X.stressAvg), st("achieveMax", X.achieveMax),
    st("married", X.spouseChanges.length), st("marriedYears", X.marriedYears), st("divorced", X.divorced), st("marryAge", X.marryAge ? yr(X.marryAge) : "—"), st("kids", X.kidsN), st("firstKidAge", X.firstKidAge ? yr(X.firstKidAge) : "—"),
    st("pets", X.petsN), st("friends", X.friendsN), st("foes", X.foesN), st("people", X.peopleN), st("peopleLost", X.peopleLost), st("moves", X.moves),
    st("thoughts", (S.texts.thoughts || []).length), st("wordsWritten", num(X.wordsN, lang)), st("recalls", X.recallsN), st("achv", F.achv.length), st("goals", F.goalsDone.length), st("focusTop", focusTop),
    st("dreamDone", X.dreamDone === true ? "✔" : X.dreamDone === false ? "✗" : "—"), st("lifeScore", F.score),
  ];
}

// ---------- 책 ----------
function bookPages(E, S, X, lang, seed) {
  const pages = [];
  pages.push({ k: "cover", title: P("book.cover", lang, seed, { name: X.name }), lifeTitle: E.title, sub: E.sub, years: `${E.profile.birthYear}–${E.profile.deathYear}` });
  pages.push({ k: "prologue", title: "", paras: [P("book.prologue", lang, seed, { name: X.name, age: X.age }), E.glance] });
  for (const c of E.chapters) pages.push({ k: "chapter", title: c.title, sub: c.sub, paras: c.paras, band: c.band });
  pages.splice(2, 0, { k: "profile", title: lab("s.profile", lang), profile: E.profile, traits: E.traits.slice(0, 4), special: E.special.slice(0, 3) });
  if (E.sec.people.list.length) pages.push({ k: "people", title: lab("s.people", lang), paras: [E.sec.people.intro], list: E.sec.people.list.slice(0, 12) });
  pages.push({ k: "moments", title: lab("s.topChoice", lang), list: E.sec.topChoice.slice(0, 6) });
  if (E.sec.notTaken.length) pages.push({ k: "notTaken", title: lab("s.notTaken", lang), list: E.sec.notTaken });
  if (E.sec.companions.length) pages.push({ k: "companions", title: lab("s.companions", lang), list: E.sec.companions });
  pages.push({ k: "stats", title: lab("s.stats", lang), list: E.sec.stats.slice(0, 24) });
  if (E.sec.wordsStory?.paras.length) pages.push({ k: "words", title: lab("s.words", lang), story: E.sec.wordsStory });
  if (E.sec.hidden.length) pages.push({ k: "hidden", title: lab("s.hidden", lang), paras: E.sec.hidden.map(h => h.text) });
  const L2 = S.texts.letter;
  pages.push({ k: "letter", title: L2?.text ? P("book.letter", lang, seed, { to: L2.to || "" }) : lab("s.letter", lang), letter: L2?.text || null, paras: L2?.text ? [] : [P("book.noletter", lang, seed, { name: X.name })] });
  pages.push({ k: "end", title: P("book.end", lang, seed, { name: X.name, birth: E.profile.birthYear, death: E.profile.deathYear }, "e"), paras: [E.deathLine, E.sec.verdict.view] });
  // 짧은 인생: 10쪽 미만이면 한눈에 보기·가치·마지막 장을 따로 펼침 / 긴 인생: 20쪽을 넘으면 순간·통계 쪽부터 접음
  const extra = [{ k: "glance", title: lab("s.glance", lang), paras: [E.glance, ...E.traits.slice(0, 3).map(t => t.text)] }, { k: "last", title: lab("s.last", lang), paras: E.sec.last.intro, list: E.sec.last.events }, { k: "values", title: lab("s.values", lang), values: E.sec.values }];
  while (pages.length < 10 && extra.length) pages.splice(pages.length - 2, 0, extra.shift());
  while (pages.length > 20) { const i = pages.findIndex(p => p.k === "stats" || p.k === "moments" || p.k === "companions"); if (i < 0) break; pages.splice(i, 1); }
  return pages;
}
function countChars(E) {
  let n = 0; const add = (s) => { if (typeof s === "string") n += [...s.replace(/\s+/g, "")].length; };
  for (const c of E.chapters) c.paras.forEach(add);
  for (const k of ["economy"]) (E.sec[k].text || []).forEach(add);
  E.sec.hidden.forEach(h => add(h.text)); E.traits.forEach(t => add(t.text)); E.sec.dream.text.forEach(add); add(E.glance); add(E.sec.verdict.fact); add(E.sec.verdict.view);
  return n;
}
export { changeItems };
