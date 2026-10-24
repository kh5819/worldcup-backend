// =========================
// DUO GAME ZONE / 인생게임 코어 v2 — 1살부터 사망까지 해마다 흐르는 인생
// - 솔로(브라우저)·멀티(서버) 공용. 데이터는 createCore(data)로 주입(경로 의존 없음)
// - 프론트가 원본: worldcup-backend/scripts/sync-lifegame-data.js 가 백엔드로 복사
// - 돈(money)은 "순자산, 만원 단위". 구 이벤트(v2 아님)의 money 효과는 ×LEGACY_MONEY_MUL 로 환산
// =========================

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
  const { STAGES, STAT_DEFS, EVENTS: RAW_EVENTS, ENDINGS, ANALYSIS_LINES, QUIET = [], MILESTONES = {}, DEATH_CAUSES = [], JOBS = [], BIRTH = null, FATES = [] } = DATA;
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
  const pickByChance = (outs, p, legacy) => {
    const tilt = p ? (p.stats.luck - 50) / 70 : 0;          // 운 0 → -0.71, 100 → +0.71
    const ws = outs.map(o => {
      const c = o.chance || 0, v = outcomeValue(o, legacy);
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
    };
  }

  // ===== 본문 치환: {spouse} {kid} {age} {job} {name} — 뒤 조사는 이름 받침에 맞춰 고친다(민준와→민준과) =====
  const JOSA = { "와의": ["과의", "와의"], "과의": ["과의", "와의"], "와": ["과", "와"], "과": ["과", "와"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "을": ["을", "를"], "를": ["을", "를"], "이랑": ["이랑", "랑"], "랑": ["이랑", "랑"], "아": ["아", "야"], "야": ["아", "야"] };
  const batchim = w => { const c = (w || "").charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; };
  function fill(p, s) {
    if (typeof s !== "string" || s.indexOf("{") < 0) return s;
    const val = {
      spouse: p.spouse?.name || p.relations.romance || "그 사람",
      kid: p.kids[0]?.name || "아이",
      age: String(p.age),
      job: p.job?.title || "무직",
      name: p.nickname,
      pet: alivePets(p)[0]?.name || p.pets[p.pets.length - 1]?.name || "반려동물",
    };
    return s.replace(/\{(spouse|kid|age|job|name|pet)\}(이랑|와의|과의|와|과|이|가|은|는|을|를|랑|아|야)?(?![가-힣])|\{(spouse|kid|age|job|name|pet)\}/g, (m, k1, j, k2) => {
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
    return true;
  }

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

  // ===== 이벤트 추첨 =====
  function pickEvent(p) {
    for (let i = 0; i < p.longTerm.length; i++) {
      const lt = p.longTerm[i];
      if (lt.fireAtAge <= p.age) {
        const ev = EVENT_BY_ID.get(lt.resultEventId);
        p.longTerm.splice(i, 1);
        if (ev) return ev;
        i--;
      }
    }
    const cands = EVENTS.filter(ev => eligible(p, ev));
    if (!cands.length) return null;
    return pickWeighted(cands, ev => {
      let w = ev.weight != null ? ev.weight : 1;
      if (ev.routeRequired) w *= 2;
      if (ev.type === "special") w *= 0.7;
      if (ev.age) w *= 1.6;                 // 나이에 딱 맞는 사건 우대
      if (ev.flagRequired || ev.married === true) w *= 1.8;   // 내 인생 맥락이 있는 사건 우대
      return w;
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
    let c = baseMortality(p.age) * mult;
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
    const retired = p.age >= 60;
    if (p.job && !retired) {
      p.careerYears++;
      const g = 1 + 0.015 + Math.max(0, (p.stats.intel + p.stats.social - 100)) / 5000;
      p.job.salary = Math.round(p.job.salary * g);
      income += afterTax(p.job.salary);
    } else if (retired) {
      if (p.job && !p.flags.has("retired")) { lines.push("정년을 맞았다."); p.flags.add("retired"); p.job = null; }
      else if (p.job) income += afterTax(p.job.salary);              // 재취업
      if (p.careerYears > 0) income += Math.min(1800, 420 + p.careerYears * 36);    // 국민연금
      else income += 400;                                             // 기초연금
    } else if (p.age >= 20 && p.age < 60) {
      income += 1100;                                                 // 직장 없을 때 알바·단기 일
    }
    if (p.spouse && p.spouse.salary && p.age < 62) income += afterTax(p.spouse.salary);
    if (p.age >= 19) {
      const parentsHome = p.housing === "parents" && !p.flags.has("orphaned");
      if (parentsHome && p.age >= 29 && rng() < 0.22) { p.housing = "rent"; lines.push("부모님 집을 나와 독립했다."); }
      const spend = Math.max(0, income - 2400);
      cost += p.housing === "parents" && !p.flags.has("orphaned") ? 650 + spend * 0.42 : 1700 + spend * 0.62;
      cost += p.housing === "rent" ? 650 : p.housing === "jeonse" ? 280 : p.housing === "own" ? 180 : 0;
      if (p.spouse) cost += 700;
      for (const k of p.kids) { const ka = p.age - k.born; if (ka >= 0 && ka < 25) cost += ka < 7 ? 700 : ka < 19 ? 1100 : 1400; }
      if (p.age >= 70) cost += 300;                                   // 의료비
    }
    if (p.stats.money > 0) income += Math.round(p.stats.money * 0.015);        // 이자·투자
    else if (p.stats.money < 0) cost += Math.round(-p.stats.money * 0.04);     // 빚 이자
    const net = Math.round(income - cost);
    p.stats.money = Math.round(p.stats.money + net);
    p.lastNet = net;
    return { income: Math.round(income), cost: Math.round(cost), net, lines };
  }

  // 직업 자동 배정(이벤트로 안 정해졌을 때)
  function autoJob(p) {
    if (p.job || p.age < 26 || p.age >= 58) return;
    if (p.routes.has("neet") || p.flags.has("jobless")) return;
    const tier = p.stats.intel + p.stats.social * .6 + p.stats.luck * .3;
    const pool = JOBS.filter(j => tier >= j.min).sort((a, b) => b.min - a.min);
    const j = pool.length ? pickWeighted(pool.slice(0, 3)) : { title: "아르바이트", salary: 1900 };
    p.job = { title: j.title, salary: j.salary, since: p.age }; p.careerTitle = j.title;
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
  function beginLife(p) {
    p.age = 1;
    p.sinceEvent = 9;
    const birth = rollBirth(p);
    return { age: 1, lines: [], milestone: MILESTONES[1] || null, birth, event: pickFirstEvent(p), death: null, economy: null };
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
    const pool = FATES.filter(f => !(p.fateLast[f.id] && p.age - p.fateLast[f.id] < 10) && (!f.age || (p.age >= f.age[0] && p.age <= f.age[1])) && (!f.flag || p.flags.has(f.flag)) && (!f.noFlag || !p.flags.has(f.noFlag)) && (!f.cond || f.cond(p)) && !(f.once && p.flags.has("fate_" + f.id)));
    if (!pool.length) return null;
    const lk = (p.stats.luck - 50) / 50;                      // -1 ~ +1
    const f = pickWeighted(pool, x => (x.weight || 1) * (x.good ? 1 + lk * 0.8 : x.good === false ? 1 - lk * 0.8 : 1));
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
      if (L.quit) p.job = null;
      if (L.widow && p.spouse) { p.flags.add("widowed"); p.flags.delete("married"); p.spouse = null; }
      if (L.child) { const g = rng() < .5 ? "M" : "F"; p.kids.push({ name: randomName(g), born: p.age, gender: g }); p.flags.add("has_kid"); }
      if (L.romance && !p.spouse && !p.relations.romance) p.relations.romance = randomName(oppositeGender(p.gender));
    }
    const text = fill(p, typeof f.text === "function" ? f.text(p) : f.text);
    p.history.push({ age: p.age, eventTitle: f.title || "운명", eventEmoji: f.emoji, choiceText: "", narrative: text, deltas, grade: f.good ? "crit" : f.good === false ? "bad" : "mid", fate: true, src: { fate: f.id } });
    return { id: f.id, emoji: f.emoji, title: f.title || "운명", text, deltas, good: f.good, death: f.death || null };
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
    rec.economy = economy(p);
    rec.lines.push(...rec.economy.lines);
    rec.lineKeys = rec.economy.lines.map(t => ({ k: t }));       // 번역 키 = 한국어 원문(고정 문장)
    if (p._driftLine) { rec.lines.push(p._driftLine.text); rec.lineKeys.push({ k: "drift", name: p._driftLine.name }); p._driftLine = null; }
    if (p._petLines) { for (const pl of p._petLines) { rec.lines.push(pl.text); rec.lineKeys.push({ k: pl.k, name: pl.name, n: pl.n }); } rec.petGone = p._petLines.map(x => x.name); p._petLines = null; }
    rec.fate = rollFate(p);
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
      const ev = pickEvent(p);
      if (ev) { rec.event = ev; p.sinceEvent = 0; p.lastEventAge = p.age; }
    }
    if (!rec.event) rec.quiet = quietLine(p, rec);
    p.yearLog.push({ age: p.age, text: rec.quiet?.text || rec.event?.title });
    if (p.yearLog.length > 12) p.yearLog.shift();
    return rec;
  }

  // ===== 선택지 적용 =====
  function applyChoice(p, event, choiceId) {
    const choice = choicesFor(p, event).find(c => c.id === choiceId);
    if (!choice) return null;
    let outcome = null, baseEffects = choice.effects || {}, narrative = "";
    if (choice.outcomes && choice.outcomes.length) outcome = pickByChance(choice.outcomes, p, isLegacy(event));

    if (choice.statRequired) {
      let met = true;
      for (const k of Object.keys(choice.statRequired)) if ((p.stats[k] ?? 0) < choice.statRequired[k]) { met = false; break; }
      if (!met) {
        narrative = "조건이 부족해 일이 꼬였다. ";
        baseEffects = { ...baseEffects };
        for (const k of Object.keys(baseEffects)) baseEffects[k] = k === "money" ? Math.round(baseEffects[k] * 0.5) : Math.round(baseEffects[k] * 0.5);
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
      if (L.divorce && p.spouse) { p.flags.add("divorced"); p.flags.delete("married"); p.spouse = null; }
      if (L.widow && p.spouse) { p.flags.add("widowed"); p.flags.delete("married"); p.spouse = null; }
      if (L.bond && p.spouse && !L.marry) p.spouse.bond = Math.max(0, Math.min(100, p.spouse.bond + L.bond));
      if (L.child) {
        const n = typeof L.child === "number" ? L.child : 1;
        for (let i = 0; i < n; i++) { const g = rng() < .5 ? "M" : "F"; p.kids.push({ name: randomName(g), born: p.age, gender: g }); }
        p.flags.add("has_kid");
      }
      if (L.job) { p.job = { title: L.job.title, salary: L.job.salary, since: p.age }; p.careerTitle = L.job.title; }
      if (L.raise && p.job) p.job.salary = Math.round(p.job.salary * L.raise);
      if (L.quit) { p.job = null; }
      if (L.housing) p.housing = L.housing;
      if (L.pet) adoptPet(p, L.pet);
      if (L.petFarewell) { const old = alivePets(p).sort((a, b) => petAge(p, b) - petAge(p, a))[0]; if (old) { old.alive = false; old.diedAt = p.age; p.flags.add("pet_farewell"); } }
    };
    applyLife(choice.life); applyLife(outcome?.life);

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

    p.history.push({
      age: p.age, stageId: stageOfAge(p.age).id, stageEmoji: stageOfAge(p.age).emoji,
      eventEmoji: event.emoji, eventTitle: fill(p, event.title), eventType: event.type || "normal",
      choiceText: fill(p, choice.text), deltas, narrative, grade, src,
    });
    if (event.type === "special") p.seenSpecialIds.add(event.id); else p.seenEventIds.add(event.id);
    (p.seenAt ||= {})[event.id] = p.age;

    // 사건으로 인한 사망
    let death = null;
    const dd = outcome?.death || choice.death;
    if (dd) death = die(p, typeof dd === "string" ? dd : null, narrative);

    return { choiceId: choice.id, choiceText: fill(p, choice.text), choiceEmoji: choice.emoji, deltas, narrative, grade, outcome, death, src };
  }

  // ===== 사망·결말 =====
  function die(p, forcedCause, lastNarrative) {
    p.alive = false; p.finished = true; p.deathAge = p.age;
    const c = pickCause(p, forcedCause);
    p.cause = { id: c.id, label: c.label, emoji: c.emoji, line: c.line ? fill(p, c.line) : null };
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
      kidsCount: p.kids.length, petsTotal: p.pets.length, petsAlive: alivePets(p).length, married: !!p.spouse, marriedYears: p.spouse ? p.age - p.spouse.since : 0,
    };
  }
  function computeEnding(p) {
    const s = legacyStats(p), r = { has: k => p.routes.has(k) }, ctx = endingCtx(p);
    const hits = ENDINGS.filter(e => { try { return e.match(s, r, ctx); } catch (_) { return false; } });
    const fallback = ENDINGS[ENDINGS.length - 1];
    const prio = e => e.prio != null ? e.prio : e.rarity === "hidden" ? 5 : e.rarity === "rare" ? 4 : 2;
    hits.sort((x, y) => prio(y) - prio(x));          // 안정 정렬: 같은 우선순위면 목록 순서
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
    return {
      id: ev.id, stage: ev.stage, type: ev.type || "normal", emoji: ev.emoji,
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
    stageOfAge, deathChance, computeEnding, lifeScore, lifeReport, relationsSummary, HOUSING_LABEL, alivePets, petAge, adoptPet,
    die, eligible,
  };
}

export function formatWon(man) {
  const v = Math.round(man), neg = v < 0, a = Math.abs(v);
  let s;
  if (a >= 10000) { const eok = Math.floor(a / 10000), rest = a % 10000; s = `${eok.toLocaleString("ko-KR")}억${rest ? " " + rest.toLocaleString("ko-KR") + "만" : ""}원`; }
  else s = `${a.toLocaleString("ko-KR")}만원`;
  return (neg ? "-" : "") + s;
}
