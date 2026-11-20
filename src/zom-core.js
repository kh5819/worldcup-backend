// =========================
// 플듀 좀비 생존 진단소 — 엔진 (서버 전용, 순수 함수)
// 하루 = 낮 사건 1개 + 밤(사건 또는 조용한 밤) → 하루 정리(식량·체력·정신력·소음·동료) → 다음 날
// 숨은 것: 결과 확률, 동료의 '몰래 물림', 손 작업 정답(무전 주파수 제외)
// 같은 씨앗 + 같은 선택 = 같은 결과 (오늘의 좀비 사태·방송 진단소는 모두 같은 씨앗)
// =========================
import { ITEMS, COMPS, EVENTS, FORCED, TYPES, ABIL, DEFAULT_CAUSE, STARVE_CAUSES, MAD_CAUSES } from "./zom-data.js";

export const CORE_VERSION = 1;
export const MAX_DAY = 30;
const EV = new Map(EVENTS.map((e) => [e.id, e]));
for (const k of Object.keys(FORCED)) EV.set(FORCED[k].id, FORCED[k]);

// ---------- 난수 (상태를 st.rs에 저장 → 세션 저장·재개 가능) ----------
export function rnd(st) {
  let t = (st.rs = (st.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const dayKey = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);   // 한국 날짜
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;
const pickW = (st, arr) => { const tot = arr.reduce((s, x) => s + (x.w ?? 1), 0); let r = rnd(st) * tot; for (const x of arr) { r -= x.w ?? 1; if (r < 0) return x; } return arr[arr.length - 1]; };

export function newRun(seed) {
  return {
    v: CORE_VERSION, seed: seed >>> 0, rs: seed >>> 0, day: 1, ph: "day", hp: 100, food: 4, noise: 10, san: 100,
    items: {}, comps: [], flags: {}, used: {}, cur: null, over: null, lastCause: null, starve: 0, noiseSum: 0, n: 0,
    met: { g: [], b: [], task: {} }, log: [], keys: [], hist: [{ d: 1, hp: 100, food: 4, san: 100, noise: 10 }],
  };
}

// ---------- 조건 ----------
const alive = (st) => st.comps.filter((c) => c.alive);
function cond(st, s) {
  if (!s) return true;
  return String(s).split("&").every((p0) => {
    const neg = p0.startsWith("!"), p = neg ? p0.slice(1) : p0;
    let v;
    const m = p.match(/^(noise|food|hp|san|day)([<>])(\d+(?:\.\d+)?)$/);
    if (m) { const x = st[m[1]], n = Number(m[3]); v = m[2] === "<" ? x < n : x > n; }
    else if (p === "comp") v = alive(st).length >= 1;
    else if (p === "comp2") v = alive(st).length >= 2;
    else if (p.startsWith("flag:")) v = !!st.flags[p.slice(5)];
    else v = !!st.items[p];
    return neg ? !v : v;
  });
}

// ---------- 다음 장면 고르기 ----------
function compName(st, id) { const c = st.comps.find((x) => x.id === id); return c ? COMPS[c.role].n : "동료"; }
function setScene(st, id, extra = {}) {
  const ev = EV.get(id);
  const vis = ev.c.map((c, i) => (cond(st, c.need) ? i : -1)).filter((i) => i >= 0);
  st.cur = { id, vis, ...extra };
  if (ev.once || !FORCED_IDS.has(id)) st.used[id] = (st.used[id] || 0) + 1;
}
const FORCED_IDS = new Set(Object.values(FORCED).map((f) => f.id));
const FOOD_EV = new Set(["mart", "conv", "school", "gas", "flood_food", "kimchi", "loot_bag", "bike", "rain", "subway", "church_bell", "gamble_box", "quiet_day"]);
export function nextScene(st) {
  if (st.over || st.cur) return;
  if (st.ph === "day") {
    if (st.day === 1 && !st.used.start) return setScene(st, "start");
    if (st.day >= MAX_DAY) return setScene(st, st.flags.evac ? FORCED.rescue.id : FORCED.lastday.id);
    const pool = EVENTS.filter((e) => e.ph === "day" && e.w > 0 && st.day >= e.min && st.day <= e.max && cond(st, e.need) && !(e.once && st.used[e.id]));
    let fresh = pool.filter((e) => !st.used[e.id]);
    if (!fresh.length) fresh = pool;
    // 최근 3일 안에 나온 사건은 빼기 (다시 나오더라도 간격 두기)
    // 식량이 바닥나면 먹을 걸 구할 수 있는 사건이 더 자주 (굶어 죽기만 하는 판 줄이기)
    const hungry = st.food < foodNeed(st) * 1.6;
    const ev = pickW(st, fresh.map((e) => ({ id: e.id, w: e.w * (hungry && FOOD_EV.has(e.id) ? 3 : 1) })));
    return setScene(st, ev.id);
  }
  // 밤: 물린 동료가 변함 → 소리 듣고 무리 → 밤 사건 / 조용한 밤
  const turner = alive(st).find((c) => c.bitten && c.bitten <= st.day);
  if (turner) return setScene(st, FORCED.turn.id, { comp: turner.id });
  const hordeAt = st.flags.fort ? 80 : 65;
  if (st.noise >= hordeAt) return setScene(st, FORCED.horde.id);
  if (rnd(st) < 0.55) {
    const pool = EVENTS.filter((e) => e.ph === "night" && st.day >= e.min && st.day <= e.max && cond(st, e.need));
    let fresh = pool.filter((e) => !st.used[e.id]); if (!fresh.length) fresh = pool;
    if (fresh.length) return setScene(st, pickW(st, fresh).id);
  }
  return null;   // 조용한 밤 → 호출한 쪽에서 하루 정리
}

// ---------- 화면에 보내는 것 ----------
const fill = (st, s) => String(s || "").replaceAll("{c}", st.cur?.comp ? compName(st, st.cur.comp) : "동료");
export function publicState(st) {
  return {
    day: st.day, ph: st.ph, hp: Math.round(st.hp), food: r1(st.food), noise: Math.round(st.noise), san: Math.round(st.san),
    need: r1(foodNeed(st)),
    items: Object.keys(st.items).filter((k) => st.items[k]).map((k) => ({ id: k, n: ITEMS[k].n, ic: ITEMS[k].ic, d: ITEMS[k].d })),
    comps: alive(st).map((c) => ({ id: c.id, role: c.role, n: COMPS[c.role].n, ic: COMPS[c.role].ic, d: COMPS[c.role].d, trust: Math.round(c.trust) })),
    contact: !!st.flags.contact, evac: !!st.flags.evac, fort: !!st.flags.fort,
  };
}
export function publicScene(st) {
  if (!st.cur) return null;
  const ev = EV.get(st.cur.id);
  return {
    id: ev.id, day: st.day, ph: ev.ph, loc: ev.loc, fx: ev.fx || null, t: fill(st, ev.t), n: st.n,
    choices: st.cur.vis.map((i) => { const c = ev.c[i]; return { i, t: fill(st, c.t), task: c.task || null, need: needLabel(c.need) }; }),
    task: st.cur.task ? publicTask(st.cur.task) : null,
  };
}
function needLabel(s) {
  if (!s) return null;
  const parts = String(s).split("&").filter((p) => !p.startsWith("!") && ITEMS[p]);
  return parts.length ? parts.map((p) => `${ITEMS[p].ic} ${ITEMS[p].n}`).join(" · ") : null;
}

// ---------- 선택 ----------
export function choose(st, ci, now = Date.now()) {
  if (st.over) return { ok: false, error: "OVER" };
  if (!st.cur) return { ok: false, error: "NO_SCENE" };
  if (st.cur.task) return { ok: false, error: "IN_TASK" };
  ci = Number(ci);
  if (!st.cur.vis.includes(ci)) return { ok: false, error: "BAD_CHOICE" };
  const ev = EV.get(st.cur.id), c = ev.c[ci];
  st.met.g.push(c.g || 0); if (c.b) st.met.b.push(c.b);
  if (c.task) {
    const spec = makeTask(st, c.task, c.d || 1);
    st.cur.task = { ci, kind: c.task, d: c.d || 1, spec, at: now };
    return { ok: true, task: publicTask(st.cur.task) };
  }
  return { ok: true, ...resolve(st, c.o) };
}
export function finishTask(st, res, now = Date.now()) {
  if (!st.cur?.task) return { ok: false, error: "NO_TASK" };
  const tk = st.cur.task, ev = EV.get(st.cur.id), c = ev.c[tk.ci];
  const ms = now - tk.at;
  const j = judgeTask(tk.spec, res || {}, ms);
  (st.met.task[tk.kind] ||= []).push(j.score);
  const tier = j.score >= 0.75 ? "ok" : j.score >= 0.4 ? "mid" : "bad";
  const pre = [];
  if (j.gain) {   // 배낭: 고른 물건이 바로 들어옴
    if (j.gain.food) { st.food += j.gain.food; pre.push(`식량 +${r1(j.gain.food)}일`); }
    if (j.gain.san) st.san = clamp(st.san + j.gain.san, 0, 100);
    for (const it of j.gain.items) if (!st.items[it]) { st.items[it] = 1; pre.push(`${ITEMS[it].ic} ${ITEMS[it].n}`); }
  }
  const out = resolve(st, c[tier]);
  out.out.task = { kind: tk.kind, score: Math.round(j.score * 100), tier, reveal: j.reveal, got: pre };
  return { ok: true, ...out };
}

// ---------- 결과 적용 ----------
function resolve(st, outs) {
  const ev = EV.get(st.cur.id);
  const cand = (outs || []).filter((o) => cond(st, o.when));
  const o = pickW(st, cand.length ? cand : outs);
  const before = { hp: st.hp, food: st.food, noise: st.noise, san: st.san };
  const notes = [];
  let msg = fill(st, o.m);
  const e = o.e || {};
  if (e.foodHalf) st.food = r1(st.food / 2);
  if (e.food) st.food = Math.max(0, r1(st.food + e.food));
  if (e.noise) st.noise = clamp(st.noise + e.noise, 0, 100);
  if (e.san) st.san = clamp(st.san + e.san, 0, 100);
  for (const it of e.add || []) if (ITEMS[it] && !st.items[it]) st.items[it] = 1;
  for (const it of e.rm || []) delete st.items[it];
  if (e.flag) st.flags[e.flag] = 1;
  if (e.garden) st.flags.garden = 1;
  if (e.trust) for (const c of alive(st)) c.trust = clamp(c.trust + e.trust, 0, 100);
  if (e.join) {
    const role = e.join.replace("!", ""), bitten = e.join.endsWith("!");
    if (alive(st).length >= 3) notes.push(`${COMPS[role].n}은(는) 자리가 없어 따로 가기로 했다.`);
    else { st.comps.push({ id: `${role}${st.comps.length}`, role, trust: 60, alive: true, bitten: bitten ? st.day + 1 + Math.floor(rnd(st) * 3) : 0 }); notes.push(`${COMPS[role].ic} ${COMPS[role].n} 합류!`); keyEvent(st, COMPS[role].ic, `${COMPS[role].n} 합류`); }
  }
  if (e.leave) { const a = alive(st).sort((x, y) => x.trust - y.trust)[0]; if (a) { a.alive = false; notes.push(`${COMPS[a.role].n}이(가) 떠났다.`); } }
  if (e.check) {
    const b = alive(st).find((c) => c.bitten);
    if (b) { b.alive = false; st.san = clamp(st.san - 12, 0, 100); msg = `${COMPS[b.role].n}의 팔에 이빨 자국이 있었다. 한참 울더니 스스로 떠났다. 문을 잠갔다.`; keyEvent(st, "🦷", `${COMPS[b.role].n}의 물린 자국 발견`); }
    else { for (const c of alive(st)) c.trust = clamp(c.trust - 12, 0, 100); msg = "아무 상처도 없었다. 괜히 의심해서 미안하다. 분위기가 싸해졌다."; }
  }
  if (st.cur.comp && ev.id === FORCED.turn.id) { const t = st.comps.find((c) => c.id === st.cur.comp); if (t) { t.alive = false; keyEvent(st, "🧟", `${COMPS[t.role].n}이(가) 좀비로 변함`); } }
  const hadContact = !!st.flags.contact, hadEvac = !!st.flags.evac, hpBefore = st.hp;
  if (e.hp) {
    if (e.hp < 0) {
      let k = 1;
      if (st.items.bat) k *= 0.8;
      if (alive(st).some((c) => COMPS[c.role].dmg)) k *= COMPS.fighter.dmg;
      if (ev.ph === "night" && st.flags.fort) k *= 0.85;
      if (ev.ph === "night" && alive(st).some((c) => COMPS[c.role].guard)) k *= 0.85;
      st.hp -= Math.round(-e.hp * k);
      if (o.cause) st.lastCause = fill(st, o.cause);
    } else st.hp = Math.min(100, st.hp + e.hp);
  }
  if (o.kill) { st.hp = 0; st.lastCause = fill(st, o.kill); }
  if (st.hp > 0 && st.hp < 20 && hpBefore >= 20 && !st.flags._near) { st.flags._near = 1; keyEvent(st, "💔", `체력 ${Math.round(st.hp)} — 죽을 뻔했다`); }
  if (st.hp > 0 && st.hp < 30 && st.items.medkit) { st.hp = Math.min(100, st.hp + 35); delete st.items.medkit; notes.push("🩹 구급상자로 응급처치했다 (+35)"); }
  if (!hadContact && st.flags.contact) keyEvent(st, "📻", "군 무전 교신 성공");
  if (!hadEvac && st.flags.evac) keyEvent(st, "🚁", "30일째 구조 약속을 받음");
  if (e.garden) keyEvent(st, "🥬", "옥상 텃밭을 가꾸기 시작");
  if (ev.id === FORCED.horde.id && st.hp > 0) keyEvent(st, "🪵", "밤새 몰려온 무리를 버텨 냄");
  if (ev.id === "m_day10") keyEvent(st, "🔟", "10일째 생존");
  if (ev.id === "m_day20") keyEvent(st, "🎖️", "20일째 생존");
  if (e.rescued) st.over = { rescued: true };
  logLine(st, msg);
  const out = { m: msg, ev: ev.id, notes, d: { hp: Math.round(st.hp - before.hp), food: r1(st.food - before.food), noise: Math.round(st.noise - before.noise), san: Math.round(st.san - before.san) } };
  st.cur = null; st.n++;
  checkDeath(st);
  let report = null;
  if (!st.over) {
    if (ev.ph === "day") { st.ph = "night"; nextScene(st); if (!st.cur) report = endDay(st); }
    else report = endDay(st);
  }
  return { out, report, scene: publicScene(st), st: publicState(st), over: st.over ? overInfo(st) : null };
}
// 생존 타임라인: 결과창에 날짜별로 보여 줄 큰 사건 (최대 14개)
function keyEvent(st, ic, t) { st.keys ||= []; if (st.keys.length < 14) st.keys.push({ d: st.day, ic, t }); }
function logLine(st, m) { if (m) { st.log.push({ d: st.day, m }); if (st.log.length > 60) st.log.shift(); } }
function checkDeath(st) {
  if (st.over) return;
  if (st.hp <= 0) { st.hp = 0; st.over = { dead: true, cause: st.lastCause || DEFAULT_CAUSE.hurt }; }
  else if (st.san <= 0) st.over = { dead: true, cause: MAD_CAUSES[(st.seed + st.day) % MAD_CAUSES.length] };
}

// ---------- 하루 정리 ----------
export function foodNeed(st) {
  let need = 0.85; for (const c of alive(st)) need += COMPS[c.role].food * 0.8;
  if (alive(st).some((c) => c.role === "cook")) need *= 0.8;
  return need;
}
export function endDay(st) {
  const lines = [];
  const need = foodNeed(st);
  if (st.food + 1e-9 >= need) {
    st.food = r1(st.food - need);
    let heal = 3; for (const c of alive(st)) heal += COMPS[c.role].heal || 0;
    st.hp = Math.min(100, st.hp + heal);
    lines.push(`🍚 식량 ${r1(need)}일치를 먹었다${heal > 3 ? ` · 🧑‍⚕️ 치료 +${heal}` : ""}`);
  } else {
    st.food = 0; st.starve++; if (st.starve === 1) keyEvent(st, "🍽️", "처음으로 굶음");
    st.hp -= 10; st.san = clamp(st.san - 5, 0, 100);
    for (const c of alive(st)) c.trust = clamp(c.trust - 8, 0, 100);
    lines.push("😵 먹을 게 모자랐다 (체력 -10, 정신력 -5)");
    if (st.hp <= 0) st.lastCause = STARVE_CAUSES[(st.seed + st.day) % STARVE_CAUSES.length];
  }
  if (st.flags.garden) { st.food = r1(st.food + 0.2); lines.push("🥬 옥상 텃밭에서 채소를 땄다 (+0.2일)"); }
  let san = -1; for (const c of alive(st)) san += COMPS[c.role].san || 0;
  if (!alive(st).length) san -= 1;
  st.san = clamp(st.san + san, 0, 100);
  let nz = -12; for (const c of alive(st)) nz += COMPS[c.role].noise || 0;
  st.noise = clamp(st.noise + nz, 0, 100);
  for (const c of alive(st)) if (c.trust < 15) { c.alive = false; lines.push(`🚪 ${COMPS[c.role].n}이(가) 말없이 떠났다`); keyEvent(st, "🚪", `${COMPS[c.role].n}이(가) 떠남`); }
  st.noiseSum += st.noise;
  checkDeath(st);
  if (!st.over) {
    st.day++; st.ph = "day";
    st.hist.push({ d: st.day, hp: Math.round(st.hp), food: r1(st.food), san: Math.round(st.san), noise: Math.round(st.noise) });
    nextScene(st);
  }
  return { day: st.day, lines };
}

// ---------- 손 작업 ----------
const PACK = [
  { k: "can", n: "통조림 묶음", ic: "🥫", w: 3, food: 2, d: "식량 +2일" },
  { k: "water", n: "생수 6병", ic: "💧", w: 4, food: 2, d: "식량 +2일" },
  { k: "ramen", n: "컵라면 박스", ic: "🍜", w: 3, food: 2, d: "식량 +2일" },
  { k: "rice", n: "쌀 5kg", ic: "🍚", w: 5, food: 3.5, d: "식량 +3.5일" },
  { k: "choco", n: "초콜릿 한 봉", ic: "🍫", w: 1, food: 0.5, san: 3, d: "식량 +0.5일 · 기분 좋아짐" },
  { k: "medkit", n: "구급상자", ic: "🩹", w: 2, item: "medkit", d: "크게 다치면 자동 치료" },
  { k: "bat", n: "야구방망이", ic: "🏏", w: 3, item: "bat", d: "맞을 때 피해 줄어듦" },
  { k: "flashlight", n: "손전등", ic: "🔦", w: 1, item: "flashlight", d: "어두운 곳 탐색" },
  { k: "batteries", n: "건전지", ic: "🔋", w: 1, item: "batteries", d: "손전등·무전기용" },
  { k: "opener", n: "통조림 따개", ic: "🥄", w: 1, item: "opener", d: "통조림을 조용히" },
  { k: "lighter", n: "라이터", ic: "🔥", w: 1, item: "lighter", d: "불 피우기·신호" },
  { k: "painkiller", n: "진통제", ic: "💊", w: 1, item: "painkiller", d: "잠 못 드는 밤에" },
  { k: "crowbar", n: "쇠지렛대", ic: "🔧", w: 3, item: "crowbar", d: "문을 조용히 엶" },
  { k: "tv", n: "55인치 TV", ic: "📺", w: 9, junk: 1, d: "정전인데…?" },
  { k: "gold", n: "금괴", ic: "🪙", w: 6, junk: 1, d: "이제 무슨 소용이지" },
  { k: "tissue", n: "두루마리 휴지 30롤", ic: "🧻", w: 4, san: 4, d: "마음의 평화" },
  { k: "massage", n: "안마 의자 리모컨", ic: "🎮", w: 1, junk: 1, d: "의자는 없다" },
  { k: "dumbbell", n: "아령 20kg", ic: "🏋️", w: 8, junk: 1, d: "운동은 중요하니까" },
];
function packValue(st, p) {
  if (p.junk) return 0;
  let v = 0;
  if (p.food) v += p.food * (st.food < 2 ? 2.4 : 1.6);
  if (p.item) v += st.items[p.item] ? 0.4 : ({ medkit: 4, bat: 3.2, crowbar: 2.6, flashlight: 2, batteries: st.items.radio || st.items.flashlight ? 2 : 1, opener: 1.8, lighter: 1.8, painkiller: 1.6 }[p.item] || 1.5);
  if (p.san) v += p.san / 4;
  return Math.round(v * 10);
}
const shuffle = (st, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const AID = [
  { n: "팔이 깊게 베였다", steps: ["상처를 꾹 눌러 지혈", "깨끗한 물로 씻기", "소독약 바르기", "붕대 감기"], bad: ["상처에 된장 바르기", "입으로 빨아내기"] },
  { n: "발목을 삐었다", steps: ["움직이지 말고 쉬기", "차가운 것으로 찜질", "압박 붕대 감기", "다리를 높이 올리기"], bad: ["뜨거운 물에 담그기", "억지로 걸어 보기"] },
  { n: "손에 화상을 입었다", steps: ["찬물로 오래 식히기", "반지·시계 빼기", "깨끗한 천으로 덮기", "물집은 터뜨리지 않기"], bad: ["치약 바르기", "얼음을 바로 대기"] },
  { n: "동료가 피를 많이 흘린다", steps: ["눕히고 다리 올리기", "상처를 세게 눌러 지혈", "상처 위를 붕대로 감기", "몸을 따뜻하게 덮기"], bad: ["물을 잔뜩 먹이기", "일으켜 세우기"] },
];
const CLUE_BAD = ["신음 소리가 들린다", "바닥에 끌린 핏자국", "썩은 냄새가 진하다", "무언가 문을 긁는다", "깨진 유리문이 혼자 흔들린다", "질질 끄는 발소리", "까마귀가 잔뜩 앉아 있다", "휴대폰 벨소리가 계속 울린다"];
const CLUE_OK = ["바람이 통한다", "고양이가 태연히 지나간다", "비상구 초록불이 켜져 있다", "발자국이 밖으로 나 있다", "빨래가 걸려 있다", "새들이 지저귄다", "물웅덩이에 하늘이 비친다", "누군가 '이쪽 안전' 분필 표시"];
export function makeTask(st, kind, d) {
  d = clamp(d | 0 || 1, 1, 3);
  if (kind === "pack") {
    const want = shuffle(st, PACK.filter((p) => !p.junk)).slice(0, 6), junk = shuffle(st, PACK.filter((p) => p.junk)).slice(0, d >= 2 ? 3 : 2);
    const list = shuffle(st, [...want, ...junk]).map((p) => ({ ...p, v: packValue(st, p) }));
    return { kind, cap: [12, 11, 10][d - 1], lim: [26000, 22000, 18000][d - 1], list };
  }
  if (kind === "barricade") {
    const rounds = 5, w = [0.22, 0.17, 0.13][d - 1];
    return { kind, rounds, speed: [0.85, 1.1, 1.35][d - 1], zones: Array.from({ length: rounds }, () => ({ c: Math.round((0.18 + rnd(st) * 0.64) * 1000) / 1000, w })), lim: 25000 };
  }
  if (kind === "sneak") {
    const looks = []; let t = 1.6;
    while (t < 40) { const calm = 1.1 + rnd(st) * (d === 3 ? 1.6 : 2.2), look = 0.9 + rnd(st) * (0.6 + d * 0.35); looks.push([r1(t + calm), r1(look)]); t += calm + look; }
    return { kind, len: 100, speed: 24, warn: [0.7, 0.55, 0.42][d - 1], looks, lim: 40000 };
  }
  if (kind === "radio") {
    const target = Math.round((88.5 + rnd(st) * 19) * 10) / 10, peaks = [{ f: target, s: 1 }];
    for (let i = 0; i < d; i++) { let f; do f = Math.round((88.2 + rnd(st) * 19.6) * 10) / 10; while (Math.abs(f - target) < 2.2); peaks.push({ f, s: 0.55 + rnd(st) * 0.2 }); }
    return { kind, peaks: shuffle(st, peaks), width: [0.9, 0.7, 0.55][d - 1], lim: [24000, 20000, 16000][d - 1], target };
  }
  if (kind === "aid") {
    const a = AID[Math.floor(rnd(st) * AID.length)];
    const opts = [...a.steps.map((s, i) => ({ s, ord: i })), ...(d >= 2 ? a.bad.slice(0, d - 1).map((s) => ({ s, ord: -1 })) : [])];
    return { kind, n: a.n, opts: shuffle(st, opts).map((o, i) => ({ id: i, s: o.s, ord: o.ord })), steps: a.steps.length, lim: [18000, 15000, 13000][d - 1] };
  }
  if (kind === "crank") {   // 발전기: 막대를 초록 칸에 유지 (탭 1번 = +충전, 시간마다 내려감)
    const lo = [0.45, 0.5, 0.55][d - 1], hi = lo + [0.3, 0.24, 0.18][d - 1];
    return { kind, dur: 10000, band: [r1(lo * 100) / 100, r1(hi * 100) / 100], push: [0.075, 0.07, 0.065][d - 1], decay: [0.32, 0.36, 0.42][d - 1], lim: 15000 };
  }
  if (kind === "throw") {   // 깡통 던지기: 포물선 착지점이 목표 칸 안 (서버가 같은 공식으로 다시 계산)
    const c = Math.round((55 + rnd(st) * 30) * 10) / 10, w = [14, 10, 7][d - 1];
    return { kind, target: [r1(c - w / 2), r1(c + w / 2)], tries: [3, 2, 2][d - 1], wind: d >= 2 ? r1((rnd(st) - 0.5) * 6) : 0, lim: 25000 };
  }
  if (kind === "spot") {    // 감염자 찾기: 12명 중 감염 징후가 있는 사람만
    const n = 12, inf = [2, 3, 4][d - 1], tellsAll = ["pale", "limp", "bandage", "eyes"], who = new Set(shuffle(st, [...Array(n).keys()]).slice(0, inf));
    const people = [...Array(n).keys()].map((i) => {
      const z = who.has(i), tells = z ? shuffle(st, tellsAll.slice()).slice(0, d === 3 ? 1 : 2) : (rnd(st) < 0.25 ? [["bandage", "limp"][Math.floor(rnd(st) * 2)]] : []);   // 사람도 다쳐서 붕대·절뚝 (헷갈리게) — 감염자는 창백·하얀 눈 중 하나는 꼭
      if (z && !tells.some((t) => t === "pale" || t === "eyes")) tells[0] = rnd(st) < 0.5 ? "pale" : "eyes";
      return { z, tells, skin: Math.floor(rnd(st) * 3), shirt: Math.floor(rnd(st) * 6), hair: Math.floor(rnd(st) * 4) };
    });
    return { kind, people, inf, lim: [22000, 18000, 15000][d - 1] };
  }
  if (kind === "lockpick") { // 자물쇠: 누르는 동안 픽이 돌고, 떨림 구간에서 놓기 × 핀 3개
    const pins = Array.from({ length: 3 }, () => ({ a: Math.round(25 + rnd(st) * 130), w: [16, 12, 9][d - 1] }));
    return { kind, pins, speed: [70, 85, 100][d - 1], lim: 25000 };
  }
  if (kind === "escape") {
    const n = [3, 4, 5][d - 1], jx = [];
    for (let k = 0; k < n; k++) {
      const safeN = d === 1 ? 2 : 1, ways = [0, 1, 2], safe = new Set(shuffle(st, ways.slice()).slice(0, safeN));
      const bad = shuffle(st, CLUE_BAD.slice()), ok = shuffle(st, CLUE_OK.slice());
      jx.push(ways.map((w, i) => ({ clue: safe.has(w) ? ok[i] : bad[i], safe: safe.has(w) })));
    }
    return { kind, jx, per: [5, 4.2, 3.6][d - 1], lim: n * 6000 + 3000 };
  }
  throw new Error("BAD_TASK");
}
// 화면에 보낼 손 작업 (정답 숨김. 무전은 신호 세기를 그려야 해서 봉우리 정보를 보냄 — 어느 게 진짜인지는 세기로만 구분)
export function publicTask(tk) {
  const s = tk.spec, base = { kind: s.kind, d: tk.d, lim: s.lim };
  if (s.kind === "pack") return { ...base, cap: s.cap, list: s.list.map((p, i) => ({ i, n: p.n, ic: p.ic, w: p.w, d: p.d })) };
  if (s.kind === "barricade") return { ...base, rounds: s.rounds, speed: s.speed, zones: s.zones };
  if (s.kind === "sneak") return { ...base, len: s.len, speed: s.speed, warn: s.warn, looks: s.looks };
  if (s.kind === "radio") return { ...base, peaks: s.peaks, width: s.width };
  if (s.kind === "aid") return { ...base, n: s.n, steps: s.steps, opts: s.opts.map((o) => ({ id: o.id, s: o.s })) };
  if (s.kind === "escape") return { ...base, per: s.per, jx: s.jx.map((ways) => ways.map((w) => ({ clue: w.clue }))) };
  if (s.kind === "crank") return { ...base, dur: s.dur, band: s.band, push: s.push, decay: s.decay };
  if (s.kind === "throw") return { ...base, target: s.target, tries: s.tries, wind: s.wind, g: THROW_G };
  if (s.kind === "spot") return { ...base, inf: s.inf, people: s.people.map((p) => ({ tells: p.tells, skin: p.skin, shirt: p.shirt, hair: p.hair })) };
  if (s.kind === "lockpick") return { ...base, pins: s.pins, speed: s.speed };
  return base;
}
// 깡통 던지기 물리 — 화면(tasks.js)과 같은 공식. 각도(도)·힘(0~1)·바람 → 착지 거리(m)
export const THROW_G = 9.8;
export function throwDist(angle, power, wind = 0) {
  const v = 12 + power * 22, a = (angle * Math.PI) / 180, t = (2 * v * Math.sin(a)) / THROW_G;
  return v * Math.cos(a) * t + wind * t;
}
function knap(items, cap) { const dp = new Array(cap + 1).fill(0); for (const it of items) for (let c = cap; c >= it.w; c--) dp[c] = Math.max(dp[c], dp[c - it.w] + it.v); return dp[cap]; }
export function judgeTask(s, res, ms) {
  const late = ms > s.lim + 4000;
  if (s.kind === "pack") {
    const pick = [...new Set((Array.isArray(res.pick) ? res.pick : []).map((x) => x | 0))].filter((i) => i >= 0 && i < s.list.length).slice(0, 12);
    const w = pick.reduce((a, i) => a + s.list[i].w, 0);
    const best = knap(s.list, s.cap) || 1;
    if (w > s.cap || ms < 1200) return { score: 0, gain: null, reveal: { best, val: 0, over: w > s.cap } };
    const val = pick.reduce((a, i) => a + s.list[i].v, 0);
    const gain = { food: 0, san: 0, items: [] };
    for (const i of pick) { const p = s.list[i]; gain.food += p.food || 0; gain.san += p.san || 0; if (p.item) gain.items.push(p.item); }
    gain.food = r1(gain.food);
    return { score: clamp(val / best, 0, 1), gain, reveal: { best, val, junk: pick.filter((i) => s.list[i].junk).map((i) => s.list[i].n) } };
  }
  if (s.kind === "barricade") {
    const stops = Array.isArray(res.stops) ? res.stops.slice(0, s.rounds) : [];
    if (ms < s.rounds * 350) return { score: 0, reveal: { hits: 0 } };
    let hits = 0; const per = s.zones.map((z, i) => { const v = Number(stops[i]); const ok = Number.isFinite(v) && Math.abs(v - z.c) <= z.w / 2; if (ok) hits++; return ok; });
    return { score: hits / s.rounds, reveal: { hits, per } };
  }
  if (s.kind === "sneak") {
    const minMs = (s.len / s.speed) * 1000 - 300;
    const prog = clamp(Number(res.prog) || 0, 0, 1);
    if (res.done && !res.caught && !late && ms >= minMs) return { score: 1, reveal: { done: true } };
    if (res.done && ms < minMs) return { score: 0, reveal: { fast: true } };
    return { score: clamp(prog * (res.caught ? 0.6 : 0.5), 0, 0.7), reveal: { caught: !!res.caught, prog } };
  }
  if (s.kind === "radio") {
    const f = Number(res.f), gap = Number.isFinite(f) ? Math.abs(f - s.target) : 99;
    if (ms < 900) return { score: 0, reveal: { target: s.target } };
    const score = late ? 0 : gap <= 0.3 ? 1 : gap <= 0.7 ? 0.65 : gap <= 1.2 ? 0.35 : 0;
    return { score, reveal: { target: s.target, f: Number.isFinite(f) ? r1(f) : null } };
  }
  if (s.kind === "aid") {
    const taps = (Array.isArray(res.taps) ? res.taps : []).slice(0, 12).map((x) => x | 0);
    const byId = new Map(s.opts.map((o) => [o.id, o]));
    let k = 0, mis = 0;
    for (const id of taps) { const o = byId.get(id); if (!o) continue; if (o.ord === k) k++; else if (o.ord !== -1 && o.ord < k) continue; else mis++; if (k >= s.steps) break; }
    if (ms < s.steps * 250) return { score: 0, reveal: { order: s.opts.filter((o) => o.ord >= 0).sort((a, b) => a.ord - b.ord).map((o) => o.s) } };
    const score = late ? Math.min(0.3, k / s.steps) : clamp(k / s.steps - mis * 0.2, 0, 1);
    return { score, reveal: { done: k, mis, order: s.opts.filter((o) => o.ord >= 0).sort((a, b) => a.ord - b.ord).map((o) => o.s) } };
  }
  if (s.kind === "crank") {
    const inBand = clamp(Number(res.inBand) || 0, 0, 1), over = clamp(Number(res.over) || 0, 0, 1);
    if (ms < s.dur - 500) return { score: 0, reveal: { fast: true } };
    const score = clamp(inBand * 1.15 - over * 0.6, 0, 1);
    return { score, reveal: { inBand: Math.round(inBand * 100), over: Math.round(over * 100) } };
  }
  if (s.kind === "throw") {
    const shots = (Array.isArray(res.shots) ? res.shots : []).slice(0, s.tries).map((x) => ({ a: clamp(Number(x?.a) || 0, 5, 85), p: clamp(Number(x?.p) || 0, 0, 1) }));
    if (ms < 800 * Math.max(1, shots.length)) return { score: 0, reveal: { target: s.target, lands: [] } };
    const c = (s.target[0] + s.target[1]) / 2, half = (s.target[1] - s.target[0]) / 2;
    const lands = shots.map((x) => r1(throwDist(x.a, x.p, s.wind)));
    const hitAt = lands.findIndex((x) => x >= s.target[0] && x <= s.target[1]);
    const best = lands.length ? Math.min(...lands.map((x) => Math.abs(x - c))) : 99;
    const score = hitAt >= 0 ? (hitAt === 0 ? 1 : 0.8) : clamp(1 - (best - half) / 20, 0, 0.55);
    return { score, reveal: { target: s.target, lands, hit: hitAt >= 0 } };
  }
  if (s.kind === "spot") {
    const picks = [...new Set((Array.isArray(res.picks) ? res.picks : []).map((x) => x | 0))].filter((i) => i >= 0 && i < s.people.length).slice(0, s.people.length);
    if (ms < 1500) return { score: 0, reveal: { zombies: s.people.map((p, i) => (p.z ? i : -1)).filter((i) => i >= 0) } };
    const right = picks.filter((i) => s.people[i].z).length, wrong = picks.length - right;
    const score = late ? Math.min(0.3, right / s.inf) : clamp(right / s.inf - wrong * 0.25, 0, 1);
    return { score, reveal: { right, wrong, zombies: s.people.map((p, i) => (p.z ? i : -1)).filter((i) => i >= 0) } };
  }
  if (s.kind === "lockpick") {
    const rel = (Array.isArray(res.rel) ? res.rel : []).slice(0, s.pins.length);
    if (ms < s.pins.length * 500) return { score: 0, reveal: { pins: 0 } };
    const per = s.pins.map((p, i) => { const v = Number(rel[i]); return Number.isFinite(v) && Math.abs(v - p.a) <= p.w / 2; });
    const n = per.filter(Boolean).length;
    return { score: late ? Math.min(0.3, n / 3) : n / s.pins.length, reveal: { pins: n, per } };
  }
  if (s.kind === "escape") {
    const picks = Array.isArray(res.picks) ? res.picks.slice(0, s.jx.length) : [];
    if (ms < s.jx.length * 300) return { score: 0, reveal: { per: s.jx.map(() => false), safe: s.jx.map((w) => w.map((x) => x.safe)) } };
    const per = s.jx.map((ways, k) => { const p = picks[k]; return Number.isInteger(p) && p >= 0 && p < ways.length && ways[p].safe; });
    return { score: per.filter(Boolean).length / s.jx.length, reveal: { per, safe: s.jx.map((w) => w.map((x) => x.safe)) } };
  }
  return { score: 0 };
}

// ---------- 결과 ----------
const avg = (a) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export function overInfo(st) { return st.over ? { rescued: !!st.over.rescued, dead: !!st.over.dead, cause: st.over.cause || null, day: st.day } : null; }
export function abilities(st) {
  const g = st.met.g, b = st.met.b, T = st.met.task;
  const judge = g.length ? ((g.reduce((s, x) => s + x, 0) + g.length) / (2 * g.length)) * 100 : 50;
  const tk = (ks) => { const v = ks.flatMap((k) => T[k] || []); return v.length ? avg(v) * 100 : null; };
  const calm = tk(["sneak", "escape", "spot"]), hands = tk(["barricade", "aid", "radio", "crank", "throw", "lockpick"]), pack = tk(["pack"]);
  const days = Math.max(1, st.day);
  const supply = (pack ?? 55) * 0.6 + (1 - Math.min(1, st.starve / Math.max(3, days * 0.5))) * 40;
  const bond = clamp(50 + (b.length >= 2 ? (45 * b.reduce((s, x) => s + x, 0)) / Math.max(4, b.length) : 0) + alive(st).length * 4, 0, 100);
  const out = { judge, calm: calm ?? 50, hands: hands ?? 50, supply, bond };
  for (const k of Object.keys(out)) out[k] = Math.round(clamp(out[k], 0, 100));
  out.none = { calm: calm == null, hands: hands == null };
  return out;
}
export function survivalDays(st) { return st.over?.rescued ? MAX_DAY : st.day; }
export function scoreOf(st) {
  const days = survivalDays(st), rescued = !!st.over?.rescued;
  const tasks = Object.values(st.met.task).flat();
  return days * 1000 + (rescued ? 500 + Math.round(st.hp) * 2 : 0) + alive(st).length * 40 + Math.round((avg(tasks) ?? 0.5) * 100) + Math.min(10, Math.floor(st.food)) * 5;
}
export function typeOf(st, ab) {
  const days = survivalDays(st), rescued = !!st.over?.rescued, noiseAvg = st.noiseSum / Math.max(1, st.day - 1);
  if (!rescued && days <= 3) return "extra";
  if (noiseAvg >= 52) return "youtuber";
  if (ab.judge < 42) return "reckless";
  if (!rescued && days < 20 && ab.bond >= 80 && st.met.b.filter((x) => x > 0).length >= 3) return "shield";
  if (rescued && ab.bond >= 66) return "leader";
  const top = [["shadow", ab.none.calm ? 0 : ab.calm], ["hands", ab.none.hands ? 0 : ab.hands], ["hoarder", ab.supply]].sort((x, y) => y[1] - x[1])[0];
  if (top[1] >= 72) return top[0];
  if (ab.bond <= 38) return "wolf";
  if (rescued && ab.bond >= 55) return "leader";
  return "citizen";
}
export function titlesOf(st, typeId) {
  const days = survivalDays(st), rescued = !!st.over?.rescued, out = [];
  if (rescued) out.push(st.flags.evac ? "🚁 헬기 구조 성공" : "🚚 30일 생존 구조");
  else if (days >= 20) out.push("🧟 20일 생존자"); else if (days >= 10) out.push("🧟 10일 생존자");
  if (days <= 1 && !rescued) out.push("🎬 오프닝 퇴장");
  if (st.starve === 0 && days >= 10) out.push("🍚 한 번도 굶지 않음");
  if (alive(st).length >= 3) out.push("👥 셋이 함께");
  if (st.noiseSum / Math.max(1, st.day - 1) < 18 && days >= 8) out.push("🤫 무소음 생존");
  if (st.flags.contact) out.push("📻 군 무전 교신");
  out.push(`${TYPES[typeId].ic} ${TYPES[typeId].n}`);
  return out;
}
// 이번 판 행동을 근거로 한 맞춤 분석 (실제 기록으로만 문장을 만듦)
const TASK_KO = { pack: "배낭 싸기", barricade: "바리케이드", sneak: "몰래 지나가기", radio: "무전 맞추기", aid: "응급처치", escape: "도망 길 고르기", crank: "발전기 돌리기", throw: "깡통 던지기", spot: "감염자 찾기", lockpick: "자물쇠 따기" };
const ABIL_KO = { judge: "판단력", calm: "침착함", hands: "손재주", supply: "자원 관리", bond: "동료애" };
function analysisOf(st, ab) {
  const out = [], g = st.met.g, b = st.met.b, T = st.met.task;
  const reck = g.filter((x) => x < 0).length, wise = g.filter((x) => x > 0).length, help = b.filter((x) => x > 0).length, self = b.filter((x) => x < 0).length;
  if (g.length) {
    if (reck >= 3) out.push(`위험한 선택을 ${reck}번 했어요. 문을 열고, 소리를 내고, 먼저 뛰어들었죠.`);
    else if (wise >= Math.max(3, g.length * 0.5)) out.push(`${g.length}번의 선택 중 ${wise}번이 신중한 선택이었어요. 쉽게 미끼를 물지 않았어요.`);
    else out.push(`${g.length}번의 선택에서 무모함과 신중함 사이를 오갔어요.`);
  }
  if (help + self) out.push(help > self ? (self ? `남을 돕는 선택을 ${help}번 했어요. 냉정하게 외면한 건 ${self}번.` : `남을 돕는 선택을 ${help}번 했어요. 한 번도 외면하지 않았어요.`) : `자기 몸을 먼저 챙긴 선택이 ${self}번, 남을 도운 건 ${help}번이었어요.`);
  const tk = Object.entries(T).map(([k, v]) => [k, v.reduce((x, y) => x + y, 0) / v.length]).sort((x, y) => y[1] - x[1]);
  if (tk.length) {
    if (tk[0][1] >= 0.5) out.push(`손 작업 중 「${TASK_KO[tk[0][0]]}」을(를) 가장 잘했어요 (${Math.round(tk[0][1] * 100)}점).`);
    else out.push("손 작업은 전반적으로 쉽지 않았어요. 손보다 머리로 버틴 생존이었어요.");
    const w = tk[tk.length - 1];
    if (tk.length > 1 && w[1] < 0.5 && tk[0][1] >= 0.5) out.push(`「${TASK_KO[w[0]]}」은(는) 약했어요 (${Math.round(w[1] * 100)}점). 다음엔 여기서 살아남는 법을 연습해 보세요.`);
  }
  const noiseAvg = st.noiseSum / Math.max(1, st.day - 1);
  out.push(noiseAvg < 20 ? "소음을 거의 내지 않았어요. 좀비들은 당신이 있는 줄도 몰랐을 거예요." : noiseAvg >= 45 ? `평균 소음이 ${Math.round(noiseAvg)}으로 꽤 시끄러웠어요. 밤마다 무리가 근처를 맴돌았어요.` : "소음은 적당히 관리했어요.");
  if (st.starve) out.push(`굶은 날이 ${st.starve}일 있었어요. 식량이 생존 일수를 갉아먹었어요.`); else if (st.day >= 8) out.push("한 번도 굶지 않았어요. 식량 관리는 완벽했어요.");
  const met = st.comps.length, alv = st.comps.filter((c) => c.alive).length;
  if (met) out.push(st.comps.some((c) => c.bitten && !c.alive) ? `동료 ${met}명을 만났고 ${alv}명이 끝까지 곁에 남았어요. 물린 걸 숨긴 동료도 있었죠.` : `동료 ${met}명을 만났고 ${alv}명이 끝까지 곁에 남았어요.`);
  else out.push("끝까지 혼자였어요. 외로움도 적이었을 거예요.");
  const top = Object.entries(ab).filter(([k]) => ABIL_KO[k]).sort((x, y) => y[1] - x[1])[0];
  if (top) out.push(`가장 높은 생존 능력: ${ABIL_KO[top[0]]}(${top[1]}점)`);
  return out;
}
/** 진단 결과 (저장용) */
export function diagnose(st) {
  const ab = abilities(st), typeId = typeOf(st, ab), T = TYPES[typeId];
  const days = survivalDays(st), rescued = !!st.over?.rescued;
  const cause = rescued ? null : st.over?.cause || DEFAULT_CAUSE.hurt;
  const headline = rescued ? `${days}일 생존 — 구조 성공!` : `${days}일째 사망`;
  return {
    v: CORE_VERSION, days, rescued, cause, headline, typeId, type: { n: T.n, ic: T.ic, d: T.d, good: TYPES[T.good].n, bad: TYPES[T.bad].n, long: T.long, strong: T.strong, weak: T.weak, movie: T.movie, life: T.life, tip: T.tip },
    analysis: analysisOf(st, ab),
    abil: ab, abilNames: ABIL, titles: titlesOf(st, typeId), score: scoreOf(st),
    diary: st.log.slice(-6).map((x) => ({ d: x.d, m: x.m })),
    timeline: [{ d: 1, ic: "📱", t: "재난 문자 — 좀비 사태 시작" }, ...(st.keys || []), rescued ? { d: days, ic: "🚁", t: "구조 성공" } : { d: days, ic: "💀", t: cause }],
    graph: st.hist.map((h) => [h.d, h.hp, h.san, h.food]),
    comps: alive(st).map((c) => COMPS[c.role].n), lost: st.comps.filter((c) => !c.alive).map((c) => COMPS[c.role].n),
    items: Object.keys(st.items).map((k) => ITEMS[k].ic), starve: st.starve, choices: st.met.g.length,
  };
}
export { ITEMS, COMPS, TYPES, ABIL };
