// =========================
// DUO GAME ZONE / 인생게임 코어 v2 — 1살부터 사망까지 해마다 흐르는 인생
// - 솔로(브라우저)·멀티(서버) 공용. 데이터는 createCore(data)로 주입(경로 의존 없음)
// - 프론트가 원본: worldcup-backend/scripts/sync-lifegame-data.js 가 백엔드로 복사
// - 돈(money)은 "순자산, 만원 단위". 구 이벤트(v2 아님)의 money 효과는 ×LEGACY_MONEY_MUL 로 환산
// =========================

import { createSystems, GOAL_BY_ID, TREND_NAME, TX, txFill } from "./lifegame-systems.js";

export const LEGACY_MONEY_MUL = 30;      // 구 이벤트 money +100 → 3,000만원
export const LEGACY_MONEY_DIV = 150;     // 구 엔딩 조건용: 순자산(만원)/150 → 구 단위
export const MAX_AGE = 110;

const NAMES_M = ["민준", "서준", "도윤", "하준", "지호", "준우", "현우", "지훈", "성민", "태양", "은우", "건우"];
// 반려동물 이름·품종·수명
const PET_NAMES = ["콩이", "보리", "두부", "초코", "감자", "호두", "망고", "나비", "루비", "까미", "별이", "구름", "모카", "쿠키", "솜이", "단비"];
export const PET_BREEDS = { dog: ["shiba", "retriever", "poodle", "corgi", "maltese"], cat: ["cheese", "mackerel", "tuxedo", "calico", "siamese"] };
const PET_LIFE = { dog: [12, 16], cat: [14, 19] };
const NAMES_F = ["서연", "지우", "하은", "수아", "지민", "예린", "채원", "다은", "유진", "소율", "하린", "나연"];

export function createCore(DATA, opts = {}) {
  const { STAGES, STAT_DEFS, EVENTS: RAW_EVENTS, ENDINGS, ANALYSIS_LINES, QUIET = [], MILESTONES = {}, DEATH_CAUSES = [], JOBS = [], BIRTH = null, FATES = [], CAREERS = {}, TITLE_CAREER = {} } = DATA;
  const STAT_KEYS = STAT_DEFS.map(s => s.key);
  const rng = opts.rng || Math.random;

  // ===== 유틸 =====
  const pickWeighted = (items, wf) => {
    if (!items.length) return null;
    const ws = items.map(it => Math.max(0.01, wf ? wf(it) : 1));
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  };
  // 결과 추첨: 운(luck)이 좋으면 좋은 결과 쪽으로, 나쁘면 나쁜 쪽으로 확률이 기운다
  const outcomeValue = (o, legacy) => {
    let v = 0;
    for (const [k, x] of Object.entries(o.effects || {})) v += k === "money" ? x / (legacy ? 4 : 400) : x;
    if (o.death) v -= 60;
    if (o.grade === "crit") v += 10; else if (o.grade === "bad") v -= 10;
    return v;
  };
  const pickByChance = (outs, p, legacy, ev) => {
    const tilt = p ? (p.stats.luck - 50) / 70 : 0;          // 운 0 → -0.71, 100 → +0.71
    // v3: 직업 진입(입학·입단·취업) 결과는 관련 능력치·경력·학력이 성공 확률을 바꾼다
    const entry = p && ev && ev.careerEntry ? (o => { const k = o.career || (o.life?.job ? careerOfJob(o.life.job.title) : null); return k ? SYS.entryMul(p, k) : 1; }) : null;
    const ws = outs.map(o => {
      const c = (o.chance || 0) * (entry ? entry(o) : 1), v = outcomeValue(o, legacy);
      const sgn = v > 2 ? 1 : v < -2 ? -1 : 0;
      return Math.max(0.0001, c * (1 + tilt * sgn));
    });
    let r = rng() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < outs.length; i++) { r -= ws[i]; if (r <= 0) return outs[i]; }
    return outs[outs.length - 1];
  };
  const clamp = (k, v) => k === "money" ? Math.round(v) : Math.max(0, Math.min(100, v));
  const rint = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const pickOne = arr => arr[Math.floor(rng() * arr.length)];
  const randomName = (g) => pickOne(g === "M" ? NAMES_M : g === "F" ? NAMES_F : (rng() < .5 ? NAMES_M : NAMES_F));
  const oppositeGender = g => g === "M" ? "F" : g === "F" ? "M" : (rng() < .5 ? "M" : "F");

  // ===== 이벤트 정규화(구 이벤트 환산) =====
  const EVENTS = RAW_EVENTS;
  const EVENT_BY_ID = new Map(EVENTS.map(e => [e.id, e]));
  const isLegacy = ev => ev.v !== 2;

  const stageOfAge = age => {
    for (let i = 0; i < STAGES.length; i++) if (age <= STAGES[i].ageEnd) return STAGES[i];
    return STAGES[STAGES.length - 1];
  };

  // ===== 반려동물 =====
  const alivePets = p => (p.pets || []).filter(x => x.alive);
  const petAge = (p, x) => (x.diedAt ?? p.age) - x.born + (x.startAge || 0);
  function adoptPet(p, o = {}) {
    const kind = o.kind === "dog" || o.kind === "cat" ? o.kind : (rng() < .5 ? "dog" : "cat");
    const breed = o.breed || pickOne(PET_BREEDS[kind]);
    const used = new Set(p.pets.map(x => x.name));
    const name = o.name || pickOne(PET_NAMES.filter(n => !used.has(n))) || pickOne(PET_NAMES);
    const [a, b] = PET_LIFE[kind];
    const pet = { kind, breed, name, born: p.age, startAge: o.startAge || 0, life: rint(a, b), alive: true };
    p.pets.push(pet);
    p.flags.add("has_pet");
    return pet;
  }

  // ===== 플레이어(=한 사람의 인생) 상태 =====
  function createPlayer(nickname, o = {}) {
    const stats = {};
    for (const d of STAT_DEFS) stats[d.key] = d.initial;
    return {
      nickname: nickname || "익명",
      gender: o.gender || null,
      age: 0,
      alive: true,
      stats,
      routes: new Set(),
      relations: { romance: null, friends: {}, foes: [] },
      flags: new Set(),
      longTerm: [],                  // [{resultEventId, fireAtAge, source}]
      history: [],
      spouse: null,                  // {name, bond, since}
      kids: [],                      // [{name, born, gender}]
      pets: [],                      // [{kind, breed, name, born(주인 나이), startAge, life, alive}]
      job: null,                     // {title, salary(만원/년), since}
      housing: "parents",            // parents | rent | jeonse | own
      careerYears: 0,
      career: null,                  // 직업 루트(CAREERS 키) — 정해지면 그 직업 사건이 이어지고 다른 입사 사건은 안 나온다
      careerStep: 0,                 // 그 직업의 단계: 0 입문 · 1 성장 · 2 성공/실패 · 3 위기 · 4 새 도전 · 5 정점
      careerSince: 0,                // 그 직업을 시작한 나이
      careerHist: [],                // 지난 직업 기록 [{key, step, from, to, state}]
      careers: {},                   // 직업별 상태 {key: {state: ACTIVE|INACTIVE|COMPLETED, step, years, times}} — 현재 직업 없음 = UNEMPLOYED
      jobless: null,                 // 직업을 놓은 나이(무직 상태 시작) — 처음 사회에 나오기 전엔 null
      seenEventIds: new Set(),
      seenSpecialIds: new Set(),
      sinceEvent: 9,
      lastEventAge: 0,
      yearLog: [],                   // 최근 해 요약
      finished: false,
      deathAge: null,
      cause: null,
      ending: null,
      titles: [],
      analysis: null,
      recentEnd: Array.isArray(o.recent) ? o.recent.slice(0, 12).map(String) : [],   // v3: 최근에 본 엔딩(같은 결말만 되풀이되지 않게)
    };
  }

  // ===== 본문 치환: {spouse} {kid} {age} {job} {name} — 뒤 조사는 이름 받침에 맞춰 고친다(민준와→민준과) =====
  const JOSA = { "와의": ["과의", "와의"], "과의": ["과의", "와의"], "와": ["과", "와"], "과": ["과", "와"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "을": ["을", "를"], "를": ["을", "를"], "이랑": ["이랑", "랑"], "랑": ["이랑", "랑"], "아": ["아", "야"], "야": ["아", "야"] };
  const batchim = w => { const c = (w || "").charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; };
  // '그때 그 선택'의 옛 사건 제목(그 제목 안의 {spouse} 등도 채운다)
  function memoTitle(p) { p._inMemo = true; try { return fill(p, EVENT_BY_ID.get(p.memoNow.ev)?.title || "그 일"); } finally { p._inMemo = false; } }
  function fill(p, s) {
    if (typeof s !== "string" || s.indexOf("{") < 0) return s;
    const val = {
      spouse: p.spouse?.name || p.relations.romance || "그 사람",
      kid: p.kids[0]?.name || "아이",
      age: String(p.age),
      job: p.job?.title || "무직",
      name: p.nickname,
      pet: alivePets(p)[0]?.name || p.pets[p.pets.length - 1]?.name || "반려동물",
      who: SYS.whoNow(p)?.name || "그 사람",
      goal: (p.goal && GOAL_BY_ID[p.goal.id]?.name) || "꿈",
      memo: p.memoNow?.ev && !p._inMemo ? memoTitle(p) : "그 일",
      trend: (p.world?.trend && TREND_NAME[p.world.trend]) || "유행",
    };
    return s.replace(/\{(spouse|kid|age|job|name|pet|who|goal|memo|trend)\}(이랑|와의|과의|와|과|이|가|은|는|을|를|랑|아|야)?(?![가-힣])|\{(spouse|kid|age|job|name|pet|who|goal|memo|trend)\}/g, (m, k1, j, k2) => {
      const k = k1 || k2, w = val[k];
      if (!j) return w + (m.length > k.length + 2 ? m.slice(k.length + 2) : "");
      const pair = JOSA[j];
      return w + (batchim(w) ? pair[0] : pair[1]);
    });
  }

  // ===== 조건 판정 =====
  const genderOk = (req, g) => !req || (Array.isArray(req) ? req.includes(g) : req === g);
  const flagsOk = (req, flags) => !req || (Array.isArray(req) ? req.every(f => flags.has(f)) : flags.has(req));
  const flagsBanned = (ban, flags) => !!ban && (Array.isArray(ban) ? ban : [ban]).some(f => flags.has(f));
  function relationOk(req, rel) {
    if (!req) return true;
    if (req.romance && !rel.romance) return false;
    if (req.noRomance && rel.romance) return false;
    if (req.friend && !(rel.friends && rel.friends[req.friend] != null)) return false;
    if (req.friendsMin && Object.keys(rel.friends || {}).length < req.friendsMin) return false;
    return true;
  }
  function eligible(p, ev) {
    if (ev.type === "longterm") return false;
    if (ev.stage !== "*" && ev.stage !== stageOfAge(p.age).id) return false;
    if (ev.age && (p.age < ev.age[0] || p.age > ev.age[1])) return false;
    if (ev.repeat) {                                       // 되풀이되는 사건: 마지막으로 겪고 repeat년 지나면 다시
      const last = p.seenAt?.[ev.id];
      if (last != null && p.age - last < ev.repeat) return false;
    } else if (ev.type === "special" ? p.seenSpecialIds.has(ev.id) : p.seenEventIds.has(ev.id)) return false;
    if (ev.routeRequired && !ev.routeRequired.some(r => p.routes.has(r))) return false;
    if (ev.followup) return false;                                   // 사슬 사건: 앞 사건이 불러야만 나온다
    if (!careerOk(p, ev)) return false;
    if (!genderOk(ev.genderRequired, p.gender)) return false;
    if (!flagsOk(ev.flagRequired, p.flags)) return false;
    if (flagsBanned(ev.flagBanned, p.flags)) return false;
    if (!relationOk(ev.relationRequired, p.relations)) return false;
    if (ev.married === true && !p.spouse) return false;
    if (ev.married === false && p.spouse) return false;
    if (ev.hasKid === true && !p.kids.length) return false;
    if (ev.hasPet === true && !alivePets(p).length) return false;
    if (ev.hasPet === false && alivePets(p).length) return false;
    if (ev.petMinAge != null && !alivePets(p).some(x => petAge(p, x) >= ev.petMinAge)) return false;
    if (ev.hasKid === false && p.kids.length) return false;
    if (ev.statMin) for (const k of Object.keys(ev.statMin)) if ((p.stats[k] ?? 0) < ev.statMin[k]) return false;
    if (ev.statMax) for (const k of Object.keys(ev.statMax)) if ((p.stats[k] ?? 0) > ev.statMax[k]) return false;
    if (ev.cond && !ev.cond(p)) return false;
    if (!SYS.eligible(p, ev)) return false;            // v3: 등장 인물·부모 생존·기억·학력·진입 조건
    return true;
  }

  // ===== 직업 루트 =====
  // 특별한 직업(정치인·작가·스트리머…)은 한 번 들어서면 쭉 그 길 — 다른 '입사/데뷔' 사건이 끼어들지 않는다.
  // 평범한 직장(worker·corporate)에서는 특별한 길로 갈아탈 수 있다.
  // 사건 쪽 표시: career(그 직업일 때만) · step[lo,hi](그 직업 단계) · minYears(그 직업 몇 년차부터) · prevCareer(전에 그 일을 했어야)
  //   careerEntry(입문 사건 — 특별한 직업이 이미 있으면 안 나옴, "job"=일반 입사) · office(회사 생활 — 평범한 직장에 다닐 때만)
  //   unemployed(무직일 때만) · anyCareer(무슨 일이든 하고 있을 때) · comeback(예전 직업으로 막 돌아왔을 때)
  // 직업 상태: p.career(지금 하는 일, 없으면 UNEMPLOYED) + p.careers[key].state ACTIVE / INACTIVE(그만둠) / COMPLETED(정점까지 감)
  const ORDINARY = new Set(["worker", "corporate", "civil"]);
  const special = p => !!p.career && !ORDINARY.has(p.career);
  function compat(p) {                                                       // 예전 데이터(직업 필드 없음) 호환
    if (!p.careerHist) p.careerHist = [];
    if (!p.careers) p.careers = {};
    if (p.careerStep == null) p.careerStep = 0;
    if (p.careerSince == null) p.careerSince = 0;
    if (p.jobless === undefined) p.jobless = null;
  }
  function careerStatus(p) { return p.career ? "ACTIVE" : "UNEMPLOYED"; }
  function careerOk(p, ev) {
    compat(p);
    if (ev.career) {
      const ks = [].concat(ev.career);
      if (!ks.includes(p.career)) return false;                              // 지금 하는 일이 아니면 그 직업 사건은 절대 X
      if (ev.step && (p.careerStep < ev.step[0] || p.careerStep > ev.step[1])) return false;
      if (ev.minYears && p.age - p.careerSince < ev.minYears) return false;
    }
    if (ev.anyCareer && (!p.career || (ev.minYears && p.age - p.careerSince < ev.minYears))) return false;
    if (ev.unemployed && (p.career || p.jobless == null || p.flags.has("retired") || p.age >= 60)) return false;
    if (ev.comeback && !(p.career && (p.careers[p.career]?.times || 0) >= 2 && p.age - p.careerSince <= 2)) return false;
    if (ev.prevCareer && !p.careerHist.some(h => h.key === ev.prevCareer)) return false;
    if (ev.careerEntry) {
      if (ev.careerEntry === "job") { if (p.career) return false; }          // 첫 취업·면접 같은 일반 입사 사건
      else if (p.career === ev.careerEntry || special(p)) return false;      // 이미 그 길이거나, 다른 특별한 직업이 있으면 X
      if (p.careers[ev.careerEntry]) return false;                           // 해 본 직업의 '입문'은 다시 안 나옴(돌아갈 땐 복귀 사건으로)
    }
    if (ev.office && !(p.career && ORDINARY.has(p.career))) return false;    // 회사 생활(승진·회식·희망퇴직…) — 무직·특별한 직업 X
    return true;
  }
  function careerOfJob(title) {
    if (!title) return null;
    if (TITLE_CAREER[title]) return TITLE_CAREER[title];
    for (const [k, c] of Object.entries(CAREERS)) if (c.title === title) return k;
    return "worker";
  }
  const careersOf = ev => [].concat(ev?.career || []);
  // 그 직업의 예약된 후속 사건을 지운다 — 대기열에 남은 옛 직업 질문이 나오지 않게
  const purgeChain = (p, key) => { p.longTerm = p.longTerm.filter(lt => !careersOf(EVENT_BY_ID.get(lt.resultEventId)).includes(key)); };
  // 직업 종료: ① 상태 저장(단계·연차) ② 후속 사건 정리 ③ 기록 보존 ④ 무직으로
  function endCareer(p, why) {
    compat(p);
    if (!p.career) return;
    const key = p.career, c = p.careers[key] || (p.careers[key] = { times: 1, years: 0 });
    const state = p.careerStep >= 5 ? "COMPLETED" : "INACTIVE";
    c.state = state; c.step = p.careerStep; c.years = (c.years || 0) + Math.max(0, p.age - p.careerSince);
    p.careerHist.push({ key, step: p.careerStep, from: p.careerSince, to: p.age, state, why: why || "quit" });
    p.flags.add("prev_career_" + key); p.flags.add("career_done_" + key);
    purgeChain(p, key);
    SYS.careerEnded(p, key);                                  // v3: 그 직업의 목표·동료도 바로 정리
    p.career = null; p.careerStep = 0; p.job = null; p.jobless = p.age;
  }
  // 직업 시작/전환: 지금 직업이 있으면 먼저 끝내고, 새 직업을 켠다. 예전에 했던 직업이면 그때 단계에서 이어서(본 사건은 다시 안 나옴)
  function setCareer(p, key, job) {
    compat(p);
    const c = CAREERS[key]; if (!c) return;
    if (p.career && p.career !== key) endCareer(p, "switch");
    if (p.career !== key) {
      const prev = p.careers[key];
      p.careers[key] = { state: "ACTIVE", step: prev ? Math.min(prev.step || 0, 4) : 0, years: prev?.years || 0, times: (prev?.times || 0) + 1 };
      if (prev) { p.flags.add("career_return_" + key); p.flags.delete("career_done_" + key); }
      p.career = key; p.careerStep = p.careers[key].step; p.careerSince = p.age; p.jobless = null;
    }
    p.flags.add("career_" + key); p.routes.add(c.route || key);
    if (job) { p.job = { title: job.title, salary: job.salary, since: p.age }; p.careerTitle = job.title; }
    else if (!p.job || careerOfJob(p.job.title) !== key) { p.job = { title: c.title, salary: c.salary, since: p.age }; p.careerTitle = c.title; }
  }
  // 출력 직전 검증: 직업 조건(지금 직업·단계·무직 여부)만 다시 본다. 후속 사건은 연차 조건 무시
  const checkEvent = (p, ev) => careerOk(p, { ...ev, minYears: 0 }) && !(ev.married === true && !p.spouse) && !(ev.hasKid === true && !p.kids.length) && (!ev.who || SYS.eligible(p, ev)) && (!ev.sysGoal || (p.goal?.id === ev.sysGoal && GOAL_BY_ID[ev.sysGoal]?.career === p.career));
  function returnCareer(p) {
    const last = [...(p.careerHist || [])].reverse().find(h => h.key !== p.career && h.state !== "COMPLETED");
    if (last) setCareer(p, last.key);
  }
  const retireAge = p => (p.career && CAREERS[p.career]?.retire) || 60;

  // 선택지 단위 조건(기혼만·자녀 있을 때만 보이는 선택지)
  function choiceOk(p, c) {
    if (c.married === true && !p.spouse) return false;
    if (c.married === false && p.spouse) return false;
    if (c.hasKid === true && !p.kids.length) return false;
    if (c.hasPet === true && !alivePets(p).length) return false;
    if (c.hasPet === false && alivePets(p).length) return false;
    if (c.genderRequired && !genderOk(c.genderRequired, p.gender)) return false;
    if (c.cond && !c.cond(p)) return false;
    return true;
  }
  const choicesFor = (p, ev) => { const l = ev.choices.filter(c => choiceOk(p, c)); return l.length ? l : ev.choices; };

  // ===== v3 시스템(기억·관계·목표·시대·업적) =====
  const SYS = createSystems({ rng, rint, pickOne, pickWeighted, randomName, oppositeGender, addStat: (p, k, v) => addStat(p, k, v), baseMortality, CAREERS, careerOfJob, endCareer: (p, why) => endCareer(p, why), alivePets });

  // 사건 분류(카드 색·아이콘): goal career people love family health money growth special life
  const RE_LOVE = /연애|고백|소개팅|프러포즈|결혼|썸|데이트|이별|첫사랑|미팅|연인|신혼/;
  const RE_FAM = /아이|육아|부모|가족|자녀|손주|반려|아기|임신|출산|명절|강아지|고양이|부부/;
  const RE_HEALTH = /병|건강|검진|수술|다이어트|운동|마라톤|입원|응급|헬스/;
  function categoryOf(ev) {
    if (ev._cat) return ev._cat;
    const t = (ev.title || "") + " " + (ev.desc || "");
    let c = "life";
    if (ev.id === "sys_goal_push") c = "goal";
    else if (ev.type === "special") c = "special";
    else if (ev.career || ev.careerEntry || ev.office || ev.anyCareer || ev.unemployed || ev.comeback) c = "career";
    else if (ev.who) c = ev.who.rel?.some(r => r === "lover" || r === "spouse" || r === "exlover") ? "love" : "people";
    else if (RE_LOVE.test(t) || ev.relationRequired?.romance) c = "love";
    else if (ev.married === true || ev.hasKid || ev.hasPet || RE_FAM.test(t)) c = "family";
    else if (RE_HEALTH.test(t)) c = "health";
    else if ((ev.choices || []).some(ch => [ch, ...(ch.outcomes || [])].some(o => Math.abs(o.effects?.money || 0) >= (isLegacy(ev) ? 40 : 1000)))) c = "money";
    else if (["infant", "child", "teen"].includes(ev.stage)) c = "growth";
    try { ev._cat = c; } catch (_) {}
    return c;
  }
  function isMajor(ev) {
    if (ev.type === "special" || ev.type === "longterm" || ev.followup || ev.id === "sys_goal_push") return true;
    return (ev.choices || []).some(ch => [ch, ...(ch.outcomes || [])].some(o => o.career || o.life?.marry || o.life?.divorce || o.life?.careerEnd || o.life?.step >= 3 || o.death));
  }

  // ===== 이벤트 추첨 =====
  function pickEvent(p) {
    for (let i = 0; i < p.longTerm.length; i++) {
      const lt = p.longTerm[i];
      if (lt.fireAtAge <= p.age) {
        const ev = EVENT_BY_ID.get(lt.resultEventId);
        p.longTerm.splice(i, 1);
        // 후속 사건 — 그새 직업이 바뀌었거나 단계가 안 맞으면 버린다(앞뒤 모순 방지)
        if (ev && (!ev.career || careerOk(p, { ...ev, minYears: 0 })) && !(ev.married === true && !p.spouse) && !(ev.hasKid === true && !p.kids.length) && (!ev.who || SYS.eligible(p, ev))) return ev;
        i--;
      }
    }
    const story = SYS.storyEvent(p, EVENT_BY_ID);       // v3: 장기 목표 도전은 무작위 사건보다 먼저
    if (story) return story;
    const cands = EVENTS.filter(ev => eligible(p, ev));
    if (!cands.length) return null;
    // 내 직업 이야기 우선: 직업 사건이 있으면 절반 넘게 그쪽에서 (노년엔 조금 덜). 무직이면 무직 사건(구직·자격증·창업·복귀…)이 그 자리
    const mine = p.career ? cands.filter(ev => ev.career || ev.anyCareer || ev.comeback) : cands.filter(ev => ev.unemployed);
    if (mine.length && rng() < (p.age >= 60 ? 0.4 : 0.6)) {
      return pickWeighted(mine, ev => (ev.weight != null ? ev.weight : 1) * (ev.step ? 1.5 : 1) * SYS.weight(p, ev));
    }
    return pickWeighted(cands, ev => {
      let w = ev.weight != null ? ev.weight : 1;
      if (ev.routeRequired) w *= 2;
      if (ev.type === "special") w *= 1.0;      // ✨ 특별한 순간 — 예전 0.7(한 판 평균 1번) → 더 자주
      if (ev.age) w *= 1.6;                 // 나이에 딱 맞는 사건 우대
      if (ev.flagRequired || ev.married === true) w *= 1.8;   // 내 인생 맥락이 있는 사건 우대
      if (ev.who || ev.memReq) w *= 1.3;                   // v3: 내 사람·내 기억과 이어지는 사건 우대
      return w * SYS.weight(p, ev);                        // v3: 비슷한 사건 연달아 X
    });
  }

  // ===== 일 년 보내기 =====
  function baseMortality(age) {
    if (age < 15) return 0.00025;
    if (age < 30) return 0.0006;
    if (age < 40) return 0.0012;
    if (age < 50) return 0.0028;
    if (age < 60) return 0.0065;
    if (age < 70) return 0.014;
    if (age < 80) return 0.034;
    if (age < 90) return 0.085;
    if (age < 100) return 0.20;
    return 0.38;
  }
  function deathChance(p) {
    const h = p.stats.health;
    const mult = Math.max(0.3, Math.min(5, Math.exp((50 - h) / 26)));
    let c = baseMortality(p.age) * mult * SYS.mortalityMul(p);
    if (h <= 8) c += 0.2;                // 위독
    else if (h <= 18) c += 0.04;
    return Math.min(0.95, c);
  }
  function pickCause(p, forced) {
    const pool = DEATH_CAUSES.filter(c => (!c.age || (p.age >= c.age[0] && p.age <= c.age[1])) && (!c.cond || c.cond(p)));
    const c = forced ? DEATH_CAUSES.find(d => d.id === forced) || pickWeighted(pool, d => d.weight || 1) : pickWeighted(pool, d => d.weight || 1);
    return c || { id: "unknown", label: "알 수 없는 이유로", emoji: "🕊️" };
  }

  function addStat(p, k, v) { if (v) p.stats[k] = clamp(k, (p.stats[k] || 0) + v); }

  // 경제: 세후 월급(+배우자 맞벌이) - 생활비(소득 따라 늘어남)·집·자녀 + 이자/빚이자, 은퇴 후 연금
  const afterTax = g => Math.round(g * (g < 3000 ? 0.9 : g < 6000 ? 0.84 : g < 10000 ? 0.78 : 0.7));
  function economy(p) {
    const lines = [];
    let income = 0, cost = 0;
    const W = SYS.econ(p);                                 // v3: 시대(경기·주식·집값)
    const retired = p.age >= retireAge(p);
    if (p.job && !retired) {
      p.careerYears++;
      const g = (1 + 0.015 + Math.max(0, (p.stats.intel + p.stats.social - 100)) / 5000) * W.raise;
      p.job.salary = Math.round(p.job.salary * g);
      income += afterTax(p.job.salary);
    } else if (retired) {
      if (p.job && !p.flags.has("retired")) { lines.push("정년을 맞았다."); p.flags.add("retired"); if (p.career) endCareer(p, "retire"); p.job = null; }
      else if (p.job) income += afterTax(p.job.salary);              // 재취업
      if (p.careerYears > 0) income += Math.min(1800, 420 + p.careerYears * 36);    // 국민연금
      else income += 400;                                             // 기초연금
    } else if (p.age >= 20 && p.age < 60) {
      income += 1100;                                                 // 직장 없을 때 알바·단기 일
    }
    if (p.spouse && p.spouse.salary && p.age < 62) income += afterTax(p.spouse.salary);
    if (p.stats.money > 0) income += Math.round(p.stats.money * (p.world ? 0.009 : 0.015));        // 이자(생활비 계산에 포함). v3: 주식·집값 손익은 아래 market
    if (p.age >= 19) {
      const parentsHome = p.housing === "parents" && !p.flags.has("orphaned");
      if (parentsHome && p.age >= 29 && rng() < 0.22) { p.housing = "rent"; lines.push("부모님 집을 나와 독립했다."); }
      const spend = Math.max(0, income - 2400);
      cost += p.housing === "parents" && !p.flags.has("orphaned") ? 650 + spend * 0.42 : 1700 + spend * 0.62;
      cost += p.housing === "rent" ? 650 : p.housing === "jeonse" ? 280 : p.housing === "own" ? 180 : 0;
      if (p.spouse) cost += 700;
      for (const k of p.kids) { const ka = p.age - k.born; if (ka >= 0 && ka < 25) cost += ka < 7 ? 700 : ka < 19 ? 1100 : 1400; }
      if (p.age >= 65) cost += Math.round((150 + (p.age - 65) * 25 + Math.max(0, 40 - p.stats.health) * 20) * (W.medMul || 1));   // 의료비(나이·건강, 돌봄 로봇 시대엔 덜)
      if (retired && p.stats.money > 0) cost += Math.round(p.stats.money * 0.012);  // 노후: 모은 돈 헐어 쓰기(여행·자녀 지원·간병)
    }
    if (p.stats.money < 0) cost += Math.round(-p.stats.money * 0.04);     // 빚 이자
    const market = p.age >= 20 ? (W.market || 0) : 0;
    const net = Math.round(income - cost + market);
    p.stats.money = Math.round(p.stats.money + net);
    p.lastNet = net;
    return { income: Math.round(income), cost: Math.round(cost), net, market, lines };
  }

  // 직업 자동 배정(이벤트로 안 정해졌을 때)
  function autoJob(p) {
    if (p.job || p.age < 26 || p.age >= 58) return;
    if (p.career) { setCareer(p, p.career); return; }          // 직업은 있는데 일자리가 비면 그 직업으로 채움
    if (p.routes.has("neet") || p.flags.has("jobless")) return;
    if (p.jobless != null && p.age - p.jobless < 4) return;    // 그만둔 뒤엔 바로 취업시키지 않음 — 무직 사건으로 고르게
    const tier = p.stats.intel + p.stats.social * .6 + p.stats.luck * .3;
    const jobOk = j => j.title === "개발자" ? SYS.entryOk(p, "developer") : j.title === "대기업 사원" ? SYS.entryOk(p, "corporate") : /^전문직/.test(j.title) ? ["college", "grad", "law"].includes(p.edu) : true;   // v3: 학력
    const pool = JOBS.filter(j => tier >= j.min && jobOk(j)).sort((a, b) => b.min - a.min);
    const j = pool.length ? pickWeighted(pool.slice(0, 3)) : { title: "아르바이트", salary: 1900 };
    p.job = { title: j.title, salary: j.salary, since: p.age }; p.careerTitle = j.title;
    setCareer(p, careerOfJob(j.title), j);
    p.history.push({ age: p.age, eventTitle: "취업", eventEmoji: "💼", choiceText: j.title, narrative: `${j.title}(연봉 ${j.salary.toLocaleString("ko-KR")}만원)으로 일을 시작했다.`, deltas: {}, grade: "mid", auto: true, src: { job: j.title } });
  }

  // 나이 들면서 자연 변화
  function aging(p) {
    const a = p.age;
    // 건강
    let dh = 0;
    if (a < 20) dh = 0.3;
    else if (a < 35) dh = -0.1;
    else if (a < 50) dh = -0.35;
    else if (a < 65) dh = -0.8;
    else if (a < 80) dh = -1.4;
    else dh = -2.2;
    dh += (p.stats.power - 50) / 45;               // 체력이 높으면 덜 닳는다
    dh += (p.stats.happy - 50) / 90;
    if (p.stats.money < 0) dh -= 0.4;
    dh += (rng() - .5) * 1.6;
    addStat(p, "health", Math.round(dh));
    // 체력(근력)
    if (a >= 35) addStat(p, "power", a < 60 ? (rng() < .55 ? -1 : 0) : -1);
    if (a >= 75) addStat(p, "intel", rng() < .35 ? -1 : 0);
    if (p.stats.money < 0) addStat(p, "happy", -1);
    if (p.stats.health < 30) addStat(p, "happy", -1);
    // 반려동물: 함께 나이 먹고, 곁에 있으면 행복·(강아지는 산책으로) 건강이 조금씩 오른다. 수명이 다하면 무지개다리
    for (const pet of alivePets(p)) {
      if (petAge(p, pet) >= pet.life) {
        pet.alive = false; pet.diedAt = p.age; p.flags.add("pet_farewell");
        addStat(p, "happy", -8);
        (p._petLines ||= []).push({ text: `🌈 ${pet.name}${batchim(pet.name) ? "이" : "가"} 무지개다리를 건넜다. ${petAge(p, pet)}년을 함께했다.`, k: "pet_gone", name: pet.name, n: petAge(p, pet) });
      } else {
        if (rng() < .5) addStat(p, "happy", 1);
        if (pet.kind === "dog" && rng() < .45) addStat(p, "health", 1);
      }
    }
    // 결혼 안 한 연애는 오래 가면 멀어지기도 한다
    if (p.relations.romance && !p.spouse) {
      if (p.romanceName !== p.relations.romance) { p.romanceName = p.relations.romance; p.romanceYears = 0; }
      p.romanceYears = (p.romanceYears || 0) + 1;
      if (p.romanceYears > 5 && rng() < 0.11 && !p.flags.has("cohabit")) {
        p._driftLine = { text: fill(p, "{spouse}와 자연스럽게 멀어졌다. 연락이 뜸해지더니 그렇게 끝났다."), name: p.relations.romance };
        p.relations.romance = null; p.romanceName = null; p.romanceYears = 0;
        addStat(p, "happy", -3);
      }
    }
    // 가족
    if (p.spouse) {
      p.spouse.bond = Math.max(0, Math.min(100, p.spouse.bond + rint(-3, 2) + (p.stats.happy > 60 ? 1 : 0) - (p.stats.money < 0 ? 2 : 0)));
    }
  }

  function quietLine(p, ctx) {
    const a = p.age, st = stageOfAge(a).id;
    const pool = QUIET.filter(q => {
      if (q.stage && q.stage !== st) return false;
      if (q.age && (a < q.age[0] || a > q.age[1])) return false;
      if (q.married === true && !p.spouse) return false;
      if (q.married === false && p.spouse) return false;
      if (q.hasKid === true && !p.kids.length) return false;
      if (q.flag && !p.flags.has(q.flag)) return false;
      if (q.cond && !q.cond(p, ctx)) return false;
      return true;
    });
    const q = pickWeighted(pool, x => x.weight || 1);
    return q ? { emoji: q.emoji || "📅", text: fill(p, q.text), k: q.text } : { emoji: "📅", text: "평범한 한 해가 지나갔다.", k: "" };
  }

  /** 첫해(1살) 시작 */
  function beginLife(p, world) {
    p.age = 1;
    p.sinceEvent = 9;
    const birth = rollBirth(p);
    SYS.onBirth(p, world);                                 // v3: 가족(부모·형제)·세상(출생 연도)
    if (birth) birth.year = p.birthYear;
    const ev = SYS.onPick(p, pickFirstEvent(p));
    return { age: 1, lines: [], milestone: MILESTONES[1] || null, birth, event: ev, death: null, economy: null, world: SYS.worldView(p.world) };
  }

  // ===== 출생 운: 집안·체질·재능 (태어나는 건 고를 수 없다) =====
  function rollBirth(p) {
    if (!BIRTH) return null;
    const fam = pickWeighted(BIRTH.family, f => f.weight);
    const body = pickWeighted(BIRTH.body, b => b.weight);
    const talent = pickWeighted(BIRTH.talent, t => t.weight);
    const deltas = {};
    const add = eff => { for (const [k, v] of Object.entries(eff || {})) { deltas[k] = (deltas[k] || 0) + v; addStat(p, k, v); } };
    add(fam.effects); add(body.effects); add(talent.effects);
    if (fam.flag) p.flags.add(fam.flag);
    if (body.flag) p.flags.add(body.flag);
    if (talent.flag) p.flags.add(talent.flag);
    p.birth = { family: { id: fam.id, label: fam.label, emoji: fam.emoji, text: fam.text }, body: { id: body.id, label: body.label, emoji: body.emoji, text: body.text }, talent: { id: talent.id, label: talent.label, emoji: talent.emoji, text: talent.text } };
    return { ...p.birth, deltas };
  }

  // ===== 운명: 선택 없이 닥치는 일 (운 스탯이 좋은 일/나쁜 일의 비율을 바꾼다) =====
  function rollFate(p) {
    const base = 0.16;
    if (rng() > base) return null;
    p.fateLast = p.fateLast || {};
    const pool = FATES.filter(f => SYS.fateOk(p, f) && !(p.fateLast[f.id] && p.age - p.fateLast[f.id] < 10) && (!f.age || (p.age >= f.age[0] && p.age <= f.age[1])) && (!f.flag || p.flags.has(f.flag)) && (!f.noFlag || !p.flags.has(f.noFlag)) && (!f.cond || f.cond(p)) && !(f.once && p.flags.has("fate_" + f.id)));
    if (!pool.length) return null;
    const lk = (p.stats.luck - 50) / 50;                      // -1 ~ +1
    const f = pickWeighted(pool, x => (x.weight || 1) * (x.good ? 1 + lk * 0.8 : x.good === false ? 1 - lk * 0.8 : 1) * SYS.fateWeight(p, x));
    if (!f) return null;
    if (f.once) p.flags.add("fate_" + f.id);
    p.fateLast[f.id] = p.age;
    const deltas = {};
    for (const [k, v0] of Object.entries(f.effects || {})) {
      const v = typeof v0 === "function" ? v0(p) : v0;
      deltas[k] = Math.round(v); addStat(p, k, Math.round(v));
    }
    if (f.flagAdd) p.flags.add(f.flagAdd);
    if (f.life) {
      const L = typeof f.life === "function" ? f.life(p) : f.life;
      if (L.raise && p.job) p.job.salary = Math.round(p.job.salary * L.raise);
      if (L.quit) endCareer(p, "fired");
      if (L.widow && p.spouse && !p.spouse.pid) { p.flags.add("widowed"); p.flags.delete("married"); p.spouse = null; p.spouseEnd = { why: "widow", age: p.age }; }
      if (L.child) { const g = rng() < .5 ? "M" : "F"; p.kids.push({ name: randomName(g), born: p.age, gender: g }); p.flags.add("has_kid"); }
      if (L.romance && !p.spouse && !p.relations.romance) p.relations.romance = randomName(oppositeGender(p.gender));
    }
    const text = fill(p, typeof f.text === "function" ? f.text(p) : f.text);
    p.history.push({ age: p.age, eventTitle: f.title || "운명", eventEmoji: f.emoji, choiceText: "", narrative: text, deltas, grade: f.good ? "crit" : f.good === false ? "bad" : "mid", fate: true, cat: "fate", src: { fate: f.id } });
    const achv = SYS.afterFate(p, f);
    return { id: f.id, emoji: f.emoji, title: f.title || "운명", text, deltas, good: f.good, death: f.death || null, achv };
  }
  function pickFirstEvent(p) {
    // 예전엔 늘 '첫마디' → 매판 똑같은 시작. 이제 1살에 맞는 사건(첫마디·돌잡이·백일 사진·예방주사·기어가기 대회 …) 중 랜덤
    const pool = EVENTS.filter(ev => ev.stage === "infant" && (ev.id === "infant_first_word" || (ev.age && ev.age[0] <= 1)) && eligible(p, ev));
    return pool.length ? pool[Math.floor(rng() * pool.length)] : pickEvent(p);
  }

  /**
   * 한 해를 보낸다(나이 +1). 반환: {age, lines, milestone, quiet, event, death, economy}
   * - 사망이면 death에 {cause, age} (이 경우 event는 null) — finalize는 호출자가 하거나 killNow가 이미 했다
   */
  function advanceYear(p) {
    if (!p.alive) return null;
    p.age += 1;
    const rec = { age: p.age, lines: [], milestone: MILESTONES[p.age] || null, quiet: null, event: null, death: null, economy: null };
    aging(p);
    autoJob(p);
    const sy = SYS.onYear(p);                              // v3: 사람(나이·이별·사망)·학력·승진·시대·목표
    rec.economy = economy(p);
    rec.lines.push(...rec.economy.lines);
    rec.lineKeys = rec.economy.lines.map(t => ({ k: t }));       // 번역 키 = 한국어 원문(고정 문장)
    for (const l of sy.lines) { rec.lines.push(txFill(TX[l.k] || "", l.v || {})); rec.lineKeys.push({ k: "sys", key: l.k, v: l.v || {} }); }
    rec.news = sy.news;                                    // 시대 소식(같은 방은 모두 같은 소식)
    rec.world = SYS.worldView(p.world);
    rec.achv = sy.achv; rec.notices = sy.notices; rec.goalNew = sy.goalNew; rec.goalDone = sy.goalDone;
    if (p._driftLine) { rec.lines.push(p._driftLine.text); rec.lineKeys.push({ k: "drift", name: p._driftLine.name }); p._driftLine = null; }
    if (p._petLines) { for (const pl of p._petLines) { rec.lines.push(pl.text); rec.lineKeys.push({ k: pl.k, name: pl.name, n: pl.n }); } rec.petGone = p._petLines.map(x => x.name); p._petLines = null; }
    rec.fate = rollFate(p);
    { const late = { lines: [] }; SYS.drainLines(p, late); for (const l of late.lines) { rec.lines.push(txFill(TX[l.k] || "", l.v || {})); rec.lineKeys.push({ k: "sys", key: l.k, v: l.v || {} }); } }   // 정년·해고로 직업이 끝난 해의 목표 중단 줄
    if (rec.fate?.death) { rec.death = die(p, rec.fate.death); return rec; }

    // 사망 판정
    if (p.age >= MAX_AGE || rng() < deathChance(p)) {
      rec.death = die(p, null);
      return rec;
    }

    // 사건 여부
    const stg = stageOfAge(p.age);
    p.sinceEvent += 1;
    let want = false;
    const due = p.longTerm.some(l => l.fireAtAge <= p.age);
    if (due) want = true;
    else if (p.sinceEvent >= (stg.maxGap || 4)) want = true;
    else if (p.sinceEvent >= 2 || rng() < 0.4) want = rng() < (stg.eventRate != null ? stg.eventRate : 0.6);
    if (want) {
      // 화면에 내보내기 직전 한 번 더 검증 — 지금 직업과 안 맞는 사건(대기열에 남은 옛 직업 질문 등)은 버리고 다시 뽑는다
      let ev = pickEvent(p);
      for (let t = 0; ev && !checkEvent(p, ev) && t < 4; t++) ev = pickEvent(p);
      if (ev && !checkEvent(p, ev)) ev = null;
      if (ev) { rec.event = SYS.onPick(p, ev); p.sinceEvent = 0; p.lastEventAge = p.age; }
    }
    if (!rec.event) rec.quiet = SYS.quiet(p) || quietLine(p, rec);
    p.yearLog.push({ age: p.age, text: rec.quiet?.text || rec.event?.title });
    if (p.yearLog.length > 12) p.yearLog.shift();
    return rec;
  }

  // ===== 선택지 적용 =====
  function applyChoice(p, event, choiceId) {
    const choice = choicesFor(p, event).find(c => c.id === choiceId);
    if (!choice) return null;
    let outcome = null, baseEffects = choice.effects || {}, narrative = "";
    if (choice.outcomes && choice.outcomes.length) outcome = pickByChance(choice.outcomes, p, isLegacy(event), event);

    if (choice.statRequired) {
      let met = true;
      for (const k of Object.keys(choice.statRequired)) if ((p.stats[k] ?? 0) < choice.statRequired[k]) { met = false; break; }
      if (!met) {
        narrative = "조건이 부족해 일이 꼬였다. ";
        baseEffects = { ...baseEffects };
        for (const k of Object.keys(baseEffects)) baseEffects[k] = k === "money" ? (baseEffects[k] > 0 ? 0 : baseEffects[k]) : Math.round(baseEffects[k] * 0.5);      // 일이 꼬였으면 돈 이득은 없고 손해는 그대로
        baseEffects.happy = (baseEffects.happy || 0) - 3;
      }
    }

    const deltas = {};
    for (const k of STAT_KEYS) deltas[k] = 0;
    const addEff = (eff) => { for (const [k, v] of Object.entries(eff || {})) if (k in deltas) deltas[k] += v; };
    addEff(baseEffects); if (outcome) addEff(outcome.effects);

    // 구 이벤트 환산: money ×30, 건강은 체력·행복 감소에서 파생
    if (isLegacy(event)) {
      deltas.money = Math.round(deltas.money * LEGACY_MONEY_MUL);
      if (!deltas.health) deltas.health = Math.round(0.4 * deltas.power + 0.15 * Math.min(0, deltas.happy));
    }

    const luckBonus = (p.stats.luck - 50) / 200;
    for (const k of STAT_KEYS) {
      if (k === "luck" || k === "money") continue;
      if (deltas[k] > 0) deltas[k] = Math.round(deltas[k] * (1 + luckBonus));
    }
    for (const [k, v] of Object.entries(deltas)) p.stats[k] = clamp(k, (p.stats[k] || 0) + v);

    if (choice.route) p.routes.add(choice.route);
    if (outcome?.route) p.routes.add(outcome.route);

    const applyRelation = (rel) => {
      if (!rel) return;
      if (rel.romance) p.relations.romance = rel.romance === true || /상대|그 사람|그때|누군가/.test(rel.romance) ? randomName(oppositeGender(p.gender)) : rel.romance;
      if (rel.breakup) p.relations.romance = null;
      if (rel.friend && rel.delta != null) {
        p.relations.friends[rel.friend] = (p.relations.friends[rel.friend] || 0) + rel.delta;
        if (p.relations.friends[rel.friend] <= -50) { p.relations.foes.push(rel.friend); delete p.relations.friends[rel.friend]; }
      }
      if (rel.foe) p.relations.foes.push(rel.foe);
    };
    applyRelation(choice.relation); applyRelation(outcome?.relation);

    const applyFlag = (fl) => {
      if (!fl) return;
      if (fl.add) (Array.isArray(fl.add) ? fl.add : [fl.add]).forEach(f => p.flags.add(f));
      if (fl.remove) (Array.isArray(fl.remove) ? fl.remove : [fl.remove]).forEach(f => p.flags.delete(f));
    };
    applyFlag(choice.flag); applyFlag(outcome?.flag);

    // 가족·직업·집
    const applyLife = (L) => {
      if (!L) return;
      if (L.marry) {
        let nm = typeof L.marry === "string" ? L.marry : p.relations.romance;
        if (!nm || /상대|그 사람|그때|누군가/.test(nm)) nm = randomName(oppositeGender(p.gender));
        const sp = rng();
        p.spouse = { name: nm, bond: L.bond || 70, since: p.age, salary: sp < 0.35 ? 0 : sp < 0.75 ? rint(2600, 4200) : rint(4200, 7000) };
        p.relations.romance = null; p.flags.add("married"); p.flags.delete("dating");
      }
      if (L.divorce && p.spouse) { p.flags.add("divorced"); p.flags.delete("married"); p.spouseEnd = { why: "divorce", age: p.age, pid: p.spouse.pid || null, name: p.spouse.name }; p.spouse = null; }
      if (L.widow && p.spouse && !p.spouse.pid) { p.flags.add("widowed"); p.flags.delete("married"); p.spouse = null; p.spouseEnd = { why: "widow", age: p.age }; }
      if (L.bond && p.spouse && !L.marry) p.spouse.bond = Math.max(0, Math.min(100, p.spouse.bond + L.bond));
      if (L.child) {
        const n = typeof L.child === "number" ? L.child : 1;
        for (let i = 0; i < n; i++) { const g = rng() < .5 ? "M" : "F"; p.kids.push({ name: randomName(g), born: p.age, gender: g }); }
        p.flags.add("has_kid");
      }
      if (L.quit || L.careerEnd) endCareer(p, L.careerEnd ? "end" : "quit");   // 퇴사·해고·은퇴 → 그 직업 이야기 끝, 무직으로
      if (L.job) { p.job = { title: L.job.title, salary: L.job.salary, since: p.age }; p.careerTitle = L.job.title; }
      if (L.raise && p.job) p.job.salary = Math.round(p.job.salary * L.raise);
      if (!switching && L.step != null && p.career) p.careerStep = L.step;     // 직업을 바꾸는 선택이면 단계는 새 직업에(아래에서)
      if (!switching && L.stepUp && p.career) p.careerStep = Math.min(5, p.careerStep + L.stepUp);
      if (L.housing) p.housing = L.housing;
      if (L.pet) adoptPet(p, L.pet);
      if (L.petFarewell) { const old = alivePets(p).sort((a, b) => petAge(p, b) - petAge(p, a))[0]; if (old) { old.alive = false; old.diedAt = p.age; p.flags.add("pet_farewell"); } }
    };
    const switching = !!(choice.career || outcome?.career || choice.careerReturn || outcome?.careerReturn);
    applyLife(choice.life); applyLife(outcome?.life);

    // 직업 루트 — 바뀌는 건 세 경우뿐: ① 직업 사건/입문 사건이 career로 직접 정함 ② 직업이 없거나 평범한 직장일 때 고른 길(route)
    //   ③ 이벤트가 정한 일자리(life.job)의 직업. 특별한 직업이 있는데 상관없는 일반 사건이 직업을 바꾸지는 않는다(맥락 없는 전환 금지)
    const L2 = { ...(choice.life || {}), ...(outcome?.life || {}) };
    const direct = outcome?.career || choice.career;
    const viaRoute = [outcome?.route, choice.route].map(r => r && (CAREERS[r] ? r : Object.keys(CAREERS).find(k => CAREERS[k].route === r || (CAREERS[k].alias || []).includes(r)))).find(Boolean);
    const allowed = event.career || event.careerEntry || !special(p);
    if (choice.careerReturn || outcome?.careerReturn) returnCareer(p);
    else if (direct && !L2.careerEnd) setCareer(p, direct, L2.job);
    else if (allowed && viaRoute && p.age >= 18 && !L2.careerEnd && SYS.entryOk(p, viaRoute)) setCareer(p, viaRoute, L2.job);   // v3: 의사·변호사 같은 길은 학력·자격이 있어야
    else if (L2.job && allowed) { const k = careerOfJob(L2.job.title); if (k !== p.career) setCareer(p, k, L2.job); }
    if (switching && p.career) {
      if (L2.step != null) p.careerStep = L2.step;
      if (L2.stepUp) p.careerStep = Math.min(5, p.careerStep + L2.stepUp);
    }
    if (p.career && p.careers[p.career]) p.careers[p.career].step = p.careerStep;
    // 사슬: next 로 후속 사건 예약(after 년 뒤, 기본 1~2년)
    for (const nx of [choice.next, outcome?.next].filter(Boolean)) {
      const n = typeof nx === "string" ? { id: nx } : nx;
      if (EVENT_BY_ID.has(n.id)) p.longTerm.push({ resultEventId: n.id, fireAtAge: p.age + (n.after ?? (1 + Math.floor(rng() * 2))), source: event.id });
    }

    // 구 이벤트 다리 놓기: married 플래그만 붙는 프러포즈 → 배우자 생성(거절로 연인이 사라졌으면 플래그 취소), parent → 첫 아이
    if (p.flags.has("married") && !p.spouse) {
      if (p.relations.romance) applyLife({ marry: true });
      else p.flags.delete("married");
    }
    if (p.flags.has("parent") && !p.kids.length) applyLife({ child: 1 });
    // 구 이벤트 '길고양이 입양'(adopted_pet) → 실제 고양이 '월급'
    if (p.flags.has("adopted_pet") && !p.pets.length) adoptPet(p, { kind: "cat", name: event.id === "adult_pet_adopt" ? "월급" : null });

    const schedule = choice.longTerm || outcome?.longTerm;
    if (schedule && schedule.resultEventId) {
      const afterYears = schedule.years != null ? Number(schedule.years) : Math.max(2, (Number(schedule.after) || 2) * 2);
      p.longTerm.push({ resultEventId: schedule.resultEventId, fireAtAge: p.age + afterYears, source: event.id });
    }

    // 번역용 출처: 어느 사건·선택지·결과(o)·서술(n)에서 나온 문장인지 (ja/en 화면이 같은 문장을 찾는다)
    const src = { ev: event.id, c: choice.id, o: outcome ? choice.outcomes.indexOf(outcome) : -1, n: -1, fail: !!narrative };
    const who0 = event.who ? SYS.whoNow(p) : null;                 // v3: 번역 화면이 그때의 등장 인물·목표로 다시 채우게
    if (who0 || event.sysGoal || (event.memoFrom && p.memoNow)) src.v = { who: who0?.name, goal: event.sysGoal || undefined, memo: (event.memoFrom && p.memoNow?.ev) || undefined };
    if (!narrative || src.fail) {
      let body;
      if (outcome?.narrative) body = outcome.narrative;
      else if (choice.narratives && choice.narratives.length) { src.n = Math.floor(rng() * choice.narratives.length); body = choice.narratives[src.n]; }
      else body = "그렇게 시간이 흘렀다.";
      narrative = src.fail ? narrative + body : body;
    }
    narrative = fill(p, narrative);

    let grade = choice.grade || "mid";
    if (outcome) {
      const pos = Object.values(outcome.effects || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0);
      const neg = Object.values(outcome.effects || {}).reduce((a, b) => a + (b < 0 ? b : 0), 0);
      if (event.v === 2) { /* v2는 outcome 합산 대신 명시 grade 우선 */ if (outcome.grade) grade = outcome.grade; }
      else if (pos > 30) grade = "crit"; else if (neg < -20) grade = "bad"; else if (pos > 0) grade = "good";
    }

    const careerBefore = p._lastCareer ?? null;
    p.history.push({
      age: p.age, stageId: stageOfAge(p.age).id, stageEmoji: stageOfAge(p.age).emoji,
      eventEmoji: event.emoji, eventTitle: fill(p, event.title), eventType: event.type || "normal",
      choiceText: fill(p, choice.text), deltas, narrative, grade, src, cat: categoryOf(event), career: p.career || null,
    });
    if (event.type === "special") p.seenSpecialIds.add(event.id); else p.seenEventIds.add(event.id);
    (p.seenAt ||= {})[event.id] = p.age;

    // 사건으로 인한 사망
    let death = null;
    const dd = outcome?.death || choice.death;
    if (dd) death = die(p, typeof dd === "string" ? dd : null, narrative);

    // v3: 관계 변화·목표·기억·업적 (사망했어도 기록은 남긴다)
    const sys = SYS.onChoice(p, event, choice, outcome, { grade, title: fill(p, event.title), choice: fill(p, choice.text) });
    if (sys.notices.some(n => n.k === "career" || n.k === "career_end")) p.history[p.history.length - 1].careerChange = { from: careerBefore, to: p.career || null };
    p.whoNow = null; p.memoNow = null;
    const sysOut = { achv: sys.achv, notices: sys.notices, goalDone: sys.goalDone || null, lines: sys.lines.map(l => ({ k: l.k, v: l.v || {}, text: txFill(TX[l.k] || "", l.v || {}) })) };
    return { choiceId: choice.id, choiceText: fill(p, choice.text), choiceEmoji: choice.emoji, deltas, narrative, grade, outcome, death, src, sys: sysOut };
  }

  // ===== 사망·결말 =====
  function die(p, forcedCause, lastNarrative) {
    p.alive = false; p.finished = true; p.deathAge = p.age;
    const c = pickCause(p, forcedCause);
    p.cause = { id: c.id, label: c.label, emoji: c.emoji, line: c.line ? fill(p, c.line) : null };
    p.finalAchv = SYS.onDeath(p);
    computeEnding(p);
    return { age: p.age, cause: p.cause, ending: p.ending };
  }

  function legacyStats(p) {
    const s = { ...p.stats };
    s.money = Math.round(p.stats.money / LEGACY_MONEY_DIV);
    return s;
  }
  function endingCtx(p) {
    return {
      gender: p.gender, age: p.deathAge ?? p.age, deathAge: p.deathAge, cause: p.cause?.id || null,
      flags: { has: k => p.flags.has(k) }, relations: p.relations, history: p.history,
      spouse: p.spouse, kids: p.kids, job: p.job, housing: p.housing, careerYears: p.careerYears,
      rawMoney: p.stats.money, health: p.stats.health, careerTitle: p.careerTitle || "", birth: p.birth || null,
      career: p.career, careerStep: p.careerStep || 0, careerHist: p.careerHist || [], careerYearsNow: p.career ? (p.deathAge ?? p.age) - (p.careerSince || 0) : 0,
      kidsCount: p.kids.length, petsTotal: p.pets.length, petsAlive: alivePets(p).length, married: !!p.spouse, marriedYears: p.spouse ? p.age - p.spouse.since : 0,
      crises: p.world?.crises || 0, people: p.people || [], memories: p.memories || [], goalsDone: p.goalsDone || [], goalHist: p.goalHist || [], achv: p.achv || [], edu: p.edu || "none",
      mem: k => (p.memories || []).some(m => m.k === k), memN: k => (p.memories || []).filter(m => m.k === k).length,
    };
  }
  function computeEnding(p) {
    const s = legacyStats(p), r = { has: k => p.routes.has(k) }, ctx = endingCtx(p);
    const hits = ENDINGS.filter(e => { try { return e.match(s, r, ctx); } catch (_) { return false; } });
    const fallback = ENDINGS[ENDINGS.length - 1];
    const prio = e => e.prio != null ? e.prio : e.rarity === "hidden" ? 5 : e.rarity === "rare" ? 4 : 2;
    hits.sort((x, y) => prio(y) - prio(x));          // 안정 정렬: 같은 우선순위면 목록 순서
    // v3: 최근에 본 엔딩이면 거의 같은 무게(0.6 이내)의 다른 결말을 대표로 — 같은 엔딩만 되풀이되지 않게
    if (hits.length > 1 && p.recentEnd?.includes(hits[0].id)) {
      const alt = hits.find(e => e !== fallback && !p.recentEnd.includes(e.id) && prio(e) >= prio(hits[0]) - 0.6);
      if (alt) { hits.splice(hits.indexOf(alt), 1); hits.unshift(alt); }
    }
    p.ending = hits[0] || fallback;
    // 칭호: 대표 결말 외에 함께 맞은 결말(최대 3개) — 같은 인생의 다른 얼굴
    p.titles = hits.filter(e => e !== p.ending && e !== fallback && !e.noTitle).slice(0, 3).map(e => ({ id: e.id, title: e.title, emoji: e.emoji, rarity: e.rarity }));
    const lines = [], keys = [];
    for (const a of ANALYSIS_LINES) {
      let ok = false; try { ok = a.when(s, r, ctx); } catch (_) {}
      if (ok) { lines.push(fill(p, a.text)); keys.push(a.text); }
      if (lines.length >= 7) break;
    }
    if (!lines.length) { lines.push("어느 한 쪽에 치우치지 않은 균형형. 그냥저냥 살아간다."); keys.push("어느 한 쪽에 치우치지 않은 균형형. 그냥저냥 살아간다."); }
    p.analysis = lines;
    p.analysisKeys = keys;      // 번역 키(치환 전 원문)
    return p.ending;
  }

  // ===== 인생 성적표(결산 화면용 자세한 분석) — 글자 없이 숫자·id만 → 화면에서 번역 =====
  function eventWeight(h) {
    let w = 0;
    for (const [k, v] of Object.entries(h.deltas || {})) {
      if (typeof v !== "number") continue;
      if (k === "money") w += Math.sign(v) * Math.min(30, Math.log10(1 + Math.abs(v) / 10) * 10);
      else w += v;
    }
    return w + (h.grade === "crit" ? 8 : h.grade === "bad" ? -8 : 0);
  }
  function lifeReport(p) {
    const H = p.history || [];
    const grades = { crit: 0, good: 0, mid: 0, bad: 0 }, fates = { good: 0, bad: 0 };
    const stages = STAGES.map(s => ({ id: s.id, emoji: s.emoji, label: s.label, n: 0, up: 0, down: 0, w: 0 }));
    let best = null, worst = null, bw = 0, ww = 0, choices = 0;
    for (const h of H) {
      if (h.fate) { if (h.grade === "crit") fates.good++; else if (h.grade === "bad") fates.bad++; }
      else { choices++; grades[grades[h.grade] != null ? h.grade : "mid"]++; }
      const st = stages.find(s => s.id === (h.stageId || stageOfAge(h.age).id));
      const w = eventWeight(h);
      if (st) { st.n++; st.w += w; if (h.grade === "crit" || h.grade === "good") st.up++; else if (h.grade === "bad") st.down++; }
      const pick = { age: h.age, eventEmoji: h.eventEmoji || "", eventTitle: h.eventTitle || "", choiceText: h.choiceText || "", grade: h.grade, src: h.src || null };
      if (w > bw) { bw = w; best = pick; }
      if (w < ww) { ww = w; worst = pick; }
    }
    const used = stages.filter(s => s.n);
    // 딱지는 화면에 보이는 ▲▼ 개수와 맞게: 황금기 = (좋은 일 − 나쁜 일) 최다, 시련기 = 나쁜 일이 좋은 일보다 많은 시기 중 최악
    const net = s => s.up - s.down;
    const goldS = used.length > 1 ? [...used].sort((a, b) => net(b) - net(a) || b.w - a.w)[0] : null;
    const goldId = goldS && net(goldS) > 0 ? goldS.id : null;
    const darkS = used.length > 1 ? [...used].filter(s => s.down > s.up && s.id !== goldId).sort((a, b) => net(a) - net(b) || a.w - b.w)[0] || null : null;
    const keys = STAT_DEFS.map(d => d.key).filter(k => k !== "money" && typeof p.stats[k] === "number");
    const top = keys.length ? [...keys].sort((a, b) => p.stats[b] - p.stats[a])[0] : null;
    const low = keys.length ? [...keys].sort((a, b) => p.stats[a] - p.stats[b])[0] : null;
    return {
      grades, fates, choices,
      stages: used.map(s => ({ id: s.id, emoji: s.emoji, label: s.label, n: s.n, up: s.up, down: s.down,
        tag: s.id === goldId ? "gold" : darkS && s.id === darkS.id ? "dark" : null })),
      best, worst,
      top: top ? { key: top, v: p.stats[top] } : null,
      low: low && low !== top ? { key: low, v: p.stats[low] } : null,
    };
  }

  // 순위용 종합 점수(오래·건강하게·잘 산 인생)
  function lifeScore(p) {
    const st = p.stats;
    const wealth = Math.max(-20, Math.min(40, Math.round(Math.sign(st.money) * Math.log10(1 + Math.abs(st.money) / 100) * 14)));
    const fam = (p.spouse ? 8 : 0) + Math.min(10, p.kids.length * 4) + Math.min(10, Object.keys(p.relations.friends || {}).length * 2);
    return Math.round(st.happy * 1.2 + st.intel * .5 + st.social * .6 + st.power * .3 + st.luck * .3 + st.internet * .2 + wealth + fam + Math.min(40, (p.deathAge ?? p.age) * .45));
  }

  function publicEvent(p, ev) {
    if (!ev) return null;
    const who = ev.who ? SYS.whoNow(p) : null;
    return {
      id: ev.id, stage: ev.stage, type: ev.type || "normal", emoji: ev.emoji, cat: categoryOf(ev), major: isMajor(ev),
      who: who ? { name: who.name, rel: who.rel, pid: who.pid || null } : null, goal: ev.sysGoal || null,
      v: { who: who?.name, goal: ev.sysGoal || undefined, memo: (ev.memoFrom && p.memoNow?.ev) || undefined },
      title: fill(p, ev.title), desc: fill(p, ev.desc),
      choices: choicesFor(p, ev).map(c => ({
        id: c.id, emoji: c.emoji, text: fill(p, c.text), sub: c.sub ? fill(p, c.sub) : null,
        hasOutcomes: !!c.outcomes, hasLongTerm: !!c.longTerm,
        locked: !!(c.statRequired && Object.keys(c.statRequired).some(k => (p.stats[k] ?? 0) < c.statRequired[k])),
        need: c.statRequired || null,
      })),
    };
  }

  function relationsSummary(p) {
    const out = [];
    if (p.spouse) out.push(`💍 ${p.spouse.name}`);
    else if (p.relations.romance) out.push(`💞 ${p.relations.romance}`);
    if (p.kids.length) out.push(`👶 ${p.kids.map(k => k.name).slice(0, 3).join(", ")}${p.kids.length > 3 ? " 외" : ""}`);
    const foes = [...new Set(p.relations.foes || [])];
    const fs = Object.entries(p.relations.friends || {}).filter(([n]) => !foes.includes(n)).sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [name, score] of fs) out.push(`${score >= 50 ? "🤝" : score >= 20 ? "🙂" : score <= -20 ? "😒" : "👤"} ${name}`);
    if (foes.length) out.push(`💢 ${foes.slice(0, 2).join(", ")}`);
    return out;
  }

  const HOUSING_LABEL = { parents: "부모님 집", rent: "월세", jeonse: "전세", own: "자가" };

  return {
    STAGES, STAT_DEFS, EVENTS, ENDINGS, ANALYSIS_LINES, MILESTONES,
    createPlayer, beginLife, advanceYear, applyChoice, pickEvent, publicEvent, fill, choicesFor,
    careerStatus, checkEvent, stageOfAge, deathChance, computeEnding, lifeScore, lifeReport, relationsSummary, HOUSING_LABEL, alivePets, petAge, adoptPet,
    die, eligible, categoryOf, isMajor, SYS,
    peopleView: p => SYS.peopleView(p), goalView: p => SYS.goalView(p), worldView: w => SYS.worldView(w), createWorld: by => SYS.createWorld(by), worldTo: (w, a) => SYS.worldTo(w, a),
    serialize: p => SYS.serialize(p), restore: o => SYS.restore(o), compat: p => SYS.compat(p),
  };
}

export function formatWon(man) {
  const v = Math.round(man), neg = v < 0, a = Math.abs(v);
  let s;
  if (a >= 10000) { const eok = Math.floor(a / 10000), rest = a % 10000; s = `${eok.toLocaleString("ko-KR")}억${rest ? " " + rest.toLocaleString("ko-KR") + "만" : ""}원`; }
  else s = `${a.toLocaleString("ko-KR")}만원`;
  return (neg ? "-" : "") + s;
}
