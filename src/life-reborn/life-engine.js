// =========================
// 플듀 인생게임 REBORN — 기록 엔진 (2026-11-22)
// 옛 엔진(lifegame-core)으로 해마다 인생을 진행하면서, 결말·자서전이 쓸 '실제 기록'을 빠짐없이 남긴다.
// · 올해의 초점·성격·가치 → 사건 확률(엔진 연결 고리 focusWeight)과 해마다 작은 변화
// · 자유 입력(꿈·장래희망·질문 답·생각·마지막 편지)은 다듬어 저장하고, 이후 회상 문장과 결말에 다시 나온다
// · 중요한 선택 직전 상태를 저장 → "그때 다른 선택을 했다면?"
// · 같은 날 태어난 4명(자동으로 사는 인생)
// 브라우저·Node 공용 (화면 의존 없음). 글자는 한국어 원문 + 번역 키(src)로 남기고, 화면·결말이 그때 언어로 바꾼다.
// =========================
import { makeCore, LIFE, formatWon } from "./lifegame-life.js?v=20261122_rb1";
import { COUNTRY_BY_ID, ERA_BY_ID, NAMES as WNAMES, lifeParams, pickCountry, pickRegion, pickBirthYear, eraOfYear } from "./life-world.js?v=20261123_w1";
import { worldEventsOf, applyWorldEvent, worldEventById } from "./life-worldev.js?v=20261123_w1";
import { CAREER_FROM, periodOf } from "./life-history.js?v=20261123_w1";
export { periodOf };
export { COUNTRY_BY_ID, ERA_BY_ID };

export const VERSION = 1;
export { formatWon, LIFE };

// ---------- 올해의 초점 ----------
// eff: 해마다 능력치 변화 · cat: 이 분류 사건이 더 자주 (배수) · from/to: 고를 수 있는 나이
export const FOCUS = [
  { id: "study", icon: "📚", from: 7, to: 30, eff: { intel: 1.4, happy: -0.3 }, cat: { growth: 1.7, career: 1.2 } },
  { id: "work", icon: "💼", from: 16, to: 75, eff: { intel: 0.4, power: -0.4, happy: -0.2 }, cat: { career: 1.7, money: 1.3 } },
  { id: "love", icon: "💞", from: 14, to: 110, eff: { social: 0.6, happy: 0.5 }, cat: { love: 2.2, people: 1.3 } },
  { id: "family", icon: "🏡", from: 7, to: 110, eff: { happy: 0.7, social: 0.3 }, cat: { family: 2.0, people: 1.4 } },
  { id: "health", icon: "🏃", from: 7, to: 110, eff: { power: 1.3, health: 1.2, happy: 0.2 }, cat: { health: 2.2 } },
  { id: "money", icon: "💰", from: 18, to: 110, eff: { happy: -0.3, intel: 0.3 }, cat: { money: 2.0, career: 1.2 }, money: 0.012 },
  { id: "play", icon: "🎮", from: 5, to: 110, eff: { happy: 1.1, internet: 0.8, intel: -0.2 }, cat: { life: 1.5, special: 1.4 } },
  { id: "friends", icon: "🤝", from: 7, to: 110, eff: { social: 1.4, happy: 0.4 }, cat: { people: 2.0, growth: 1.1 } },
  { id: "rest", icon: "🌿", from: 30, to: 110, eff: { health: 0.8, happy: 0.6, power: 0.3 }, cat: {} },
];
export const FOCUS_BY_ID = Object.fromEntries(FOCUS.map(f => [f.id, f]));
export const focusOk = (f, age) => age >= f.from && age <= f.to;
export const defaultFocus = (age) => age < 7 ? null : age < 19 ? "study" : age < 60 ? "work" : "family";

// ---------- 나만의 인생: 성격·관심사·가치 ----------
// 사건 확률(분류 배수)과 출발 능력치에 반영 · 결말 문장이 다시 부른다
export const PERSONA = [
  { id: "bold", icon: "🔥", st: { luck: 3, social: 2 }, cat: { special: 1.3, money: 1.2 } },
  { id: "calm", icon: "🌙", st: { health: 3, happy: 2 }, cat: { health: 1.2, family: 1.1 } },
  { id: "curious", icon: "🔭", st: { intel: 4 }, cat: { growth: 1.3, special: 1.2 } },
  { id: "warm", icon: "☀️", st: { social: 4, happy: 1 }, cat: { people: 1.4, family: 1.2 } },
  { id: "stubborn", icon: "🪨", st: { power: 3, intel: 1 }, cat: { career: 1.3 } },
  { id: "dreamy", icon: "☁️", st: { happy: 3, internet: 2 }, cat: { special: 1.4, life: 1.2 } },
  { id: "careful", icon: "🧮", st: { intel: 2, luck: 1 }, cat: { money: 1.3, health: 1.1 } },
  { id: "funny", icon: "😄", st: { social: 3, internet: 2 }, cat: { people: 1.3, love: 1.2 } },
];
export const INTERESTS = [
  { id: "art", icon: "🎨" }, { id: "music", icon: "🎵" }, { id: "sports", icon: "⚽" }, { id: "science", icon: "🔬" }, { id: "books", icon: "📖" },
  { id: "games", icon: "🎮" }, { id: "travel", icon: "✈️" }, { id: "cooking", icon: "🍳" }, { id: "nature", icon: "🌳" }, { id: "money", icon: "📈" },
  { id: "people", icon: "🫂" }, { id: "tech", icon: "💻" },
];
export const VALUES = [
  { id: "family", icon: "🏡", cat: { family: 1.4 } }, { id: "freedom", icon: "🕊️", cat: { special: 1.3, life: 1.2 } }, { id: "success", icon: "🏆", cat: { career: 1.4 } },
  { id: "love", icon: "💗", cat: { love: 1.5 } }, { id: "health", icon: "🫀", cat: { health: 1.4 } }, { id: "wealth", icon: "💎", cat: { money: 1.5 } },
  { id: "friends", icon: "🤝", cat: { people: 1.5 } }, { id: "knowledge", icon: "🧠", cat: { growth: 1.4 } }, { id: "contribution", icon: "🌍", cat: { people: 1.2, career: 1.1 } },
  { id: "fun", icon: "🎉", cat: { special: 1.3, life: 1.3 } },
];
const byId = (L) => Object.fromEntries(L.map(x => [x.id, x]));
export const PERSONA_BY_ID = byId(PERSONA), INTEREST_BY_ID = byId(INTERESTS), VALUE_BY_ID = byId(VALUES);

// 엔진: 초점·성격·가치 배수를 곱한다 (사건 하나에 너무 크게 쏠리지 않게 상한 3)
export const core = makeCore({
  focusWeight: (p, ev, cat) => {
    let w = 1;
    const f = p.focus && FOCUS_BY_ID[p.focus]; if (f?.cat?.[cat]) w *= f.cat[cat];
    for (const id of p.persona || []) { const x = PERSONA_BY_ID[id]; if (x?.cat?.[cat]) w *= 1 + (x.cat[cat] - 1) * 0.6; }
    for (const id of p.values || []) { const x = VALUE_BY_ID[id]; if (x?.cat?.[cat]) w *= 1 + (x.cat[cat] - 1) * 0.6; }
    return Math.min(3, w);
  },
  // 시대에 없던 직업은 못 가짐 (예: 1950년대 유튜버·프로게이머)
  careerExists: (p, key) => { const y = CAREER_FROM[key]; return !y || (p.birthYear || 2000) + p.age >= y; },
  // 세계 모드: 나라·시대에 따라 가난한 집/넉넉한 집 비중이 다름
  familyWeight: (p, f) => { const k = p.poorMul || 1; if (k === 1) return 1; return f.id === "dirt" || f.id === "struggle" ? k : f.id === "gold" || f.id === "silver" ? 1 / k : 1; },
});
/** 엔진의 이름 목록을 이 사람 나라로 (세계 모드) */
export function namesFor(S) { const c = S?.p?.country || S?.rec?.profile?.country; core.setNames(c && c !== "KR" ? WNAMES[c] : null); }

// ---------- 자유 입력 질문 (나이 → 키) ----------
export const PROMPTS = [
  { key: "q10", age: 10 }, { key: "q18", age: 18 }, { key: "q25", age: 25 }, { key: "q40", age: 40 }, { key: "q60", age: 60 },
];
export const PROMPT_AT = Object.fromEntries(PROMPTS.map(x => [x.age, x.key]));
export const TEXT_MAX = { name: 12, dream: 80, wish: 40, q: 160, thought: 160, last: 120, letter: 1200, epitaph: 60, to: 20 };

/** 자유 입력 다듬기: 제어문자·꺾쇠 제거, 길이 제한, 이메일·전화번호 가리기 (화면은 늘 글자로만 넣으므로 HTML 실행 없음) */
export function cleanText(s, max = 160) {
  let t = String(s ?? "").replace(/<\/?[a-z][^>]*>/gi, "").replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/g, "").replace(/[<>]/g, "").replace(/\r\n?/g, "\n");
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "▒▒▒").replace(/(\+?\d[\d\s-]{8,}\d)/g, "▒▒▒");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return [...t].slice(0, max).join("");
}

// ---------- 꿈 ↔ 직업 맞춰 보기 (어릴 적 꿈 이룸 판정) ----------
// 직업 키 → 그 직업을 뜻하는 말들 (한국어·일본어·영어 입력 모두)
export const DREAM_WORDS = {
  doctor: ["의사", "간호", "약사", "医者", "看護", "doctor", "nurse", "medic"],
  lawyer: ["변호사", "판사", "검사", "법조", "弁護士", "裁判", "検事", "lawyer", "judge", "attorney"],
  developer: ["개발", "프로그래", "코딩", "엔지니어", "プログラ", "エンジニア", "developer", "programmer", "engineer", "coder"],
  streamer: ["유튜버", "스트리머", "방송", "크리에이터", "ユーチューバー", "配信", "youtuber", "streamer", "creator"],
  idol: ["아이돌", "가수", "연예인", "배우", "アイドル", "歌手", "俳優", "芸能", "idol", "singer", "actor", "actress", "celebrity"],
  athlete: ["운동선수", "축구", "야구", "농구", "선수", "スポーツ選手", "サッカー", "野球", "athlete", "soccer", "football", "baseball", "basketball"],
  teacher: ["선생", "교사", "교수", "先生", "教師", "教授", "teacher", "professor"],
  artist: ["화가", "웹툰", "만화", "디자이너", "음악가", "미술", "画家", "漫画", "音楽家", "デザイナー", "artist", "painter", "designer", "musician"],
  writer: ["작가", "소설", "시인", "작사", "作家", "小説", "詩人", "writer", "author", "novelist", "poet"],
  business: ["사장", "사업", "창업", "대표", "CEO", "社長", "起業", "経営", "business", "founder", "entrepreneur"],
  politics: ["대통령", "정치", "국회", "시장", "大統領", "政治", "president", "politician", "mayor"],
  civil: ["공무원", "경찰", "소방", "군인", "公務員", "警察", "消防", "police", "firefighter", "civil servant", "soldier"],
  corporate: ["회사원", "직장인", "대기업", "会社員", "サラリーマン", "office worker", "employee"],
  gamer: ["프로게이머", "게이머", "e스포츠", "プロゲーマー", "pro gamer", "gamer", "esports"],
};
/** 꿈 글에서 떠올린 직업 키들 */
export function dreamKeys(text) {
  const t = String(text || "").toLowerCase(); if (!t) return [];
  return Object.entries(DREAM_WORDS).filter(([, ws]) => ws.some(w => t.includes(w.toLowerCase()))).map(([k]) => k);
}
/** 직업 키를 꿈 키와 맞춰 보기 (같은 계열도 인정) */
const CAREER_FAMILY = { idol: ["idol", "artist"], streamer: ["streamer", "idol", "gamer"], artist: ["artist", "writer", "streamer"], writer: ["writer", "artist"], business: ["business"], lawyer: ["lawyer", "politics"], developer: ["developer", "business"], gamer: ["gamer", "streamer"], corporate: ["corporate", "worker"] };
export function careerMatchesDream(careerKey, keys) {
  if (!careerKey || !keys?.length) return false;
  return keys.some(k => k === careerKey || (CAREER_FAMILY[k] || []).includes(careerKey) || (CAREER_FAMILY[careerKey] || []).includes(k));
}

// ---------- 게임 지표 (0~100, 게임 안에서 계산한 값 — 실제 통계 아님) ----------
const PUBLIC_CAREER = new Set(["idol", "streamer", "athlete", "politics", "artist", "business", "writer", "gamer"]);
export function metrics(p) {
  const s = p.stats, step = p.careerStep || 0;
  const fame = Math.round(Math.max(0, Math.min(100, s.internet * 0.35 + (PUBLIC_CAREER.has(p.career) ? step * 13 : step * 4) + (p.achv?.length || 0) * 1.5)));
  const stress = Math.round(Math.max(0, Math.min(100, 100 - s.happy * 0.55 - (s.health ?? 60) * 0.25 + (p.job ? 8 : 0) + (s.money < 0 ? 14 : 0) + (p.focus === "work" ? 6 : p.focus === "rest" ? -8 : 0))));
  const achieve = Math.round(Math.max(0, Math.min(100, step * 14 + (p.goalsDone?.length || 0) * 9 + (p.achv?.length || 0) * 1.2 + (p.kids?.length ? 6 : 0))));
  return { fame, stress, achieve };
}

// ---------- 회상: 내가 쓴 말이 나중에 다시 나온다 ----------
// 키 → [나이 조건, 원문 키] · 문장은 화면/결말 번역 사전(life-text)의 "recall.<id>"
export const RECALLS = [
  { id: "dream_teen", at: 16, need: "dream" }, { id: "dream_30", at: 30, need: "dream" }, { id: "q10_25", at: 26, need: "q10" },
  { id: "q18_35", at: 35, need: "q18" }, { id: "q25_45", at: 47, need: "q25" }, { id: "q40_55", at: 55, need: "q40" },
  { id: "q60_70", at: 72, need: "q60" }, { id: "wish_first_job", need: "wish", when: "job" }, { id: "dream_kid", need: "dream", when: "kid" },
  { id: "thought_old", at: 66, need: "thought" },
];

// =========================
// 세션
// =========================
let RAND = Math.random;
const rint = (a, b) => Math.floor(a + RAND() * (b - a + 1));
const NAMES = { M: ["민준", "서준", "도윤", "하준", "지호", "준우", "현우", "지훈", "성민", "태양", "은우", "건우", "민호", "태준"], F: ["서연", "지우", "하은", "수아", "지민", "예린", "채원", "다은", "유진", "소율", "하린", "나연", "지은"] };
export const REGIONS_KR = ["seoul", "busan", "incheon", "daegu", "daejeon", "gwangju", "ulsan", "gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang", "jeju"];
const REGION_W = [19, 7, 6, 5, 3, 3, 2, 26, 3, 8, 7, 9, 2]; // 대략적인 인구 비중(게임용 어림값)

export function newLife(o = {}) {
  const gender = o.gender === "M" || o.gender === "F" ? o.gender : (RAND() < 0.5 ? "M" : "F");
  // 세계 모드: 나라·시대 (없으면 한국·지금 시대 — 예전과 같음)
  const country = o.country === "random" ? pickCountry(RAND) : COUNTRY_BY_ID[o.country] ? o.country : "KR";
  let wantYear = Number.isInteger(o.birthYear) && o.birthYear >= 1900 && o.birthYear <= 2050 ? o.birthYear : null;
  const era = ERA_BY_ID[o.era] ? o.era : o.era === "random" ? ["early", "past", "modern", "modern", "future"][Math.floor(RAND() * 5)] : wantYear ? eraOfYear(wantYear) : "modern";
  if (!wantYear && (o.era || country !== "KR")) wantYear = pickBirthYear(era, RAND);
  const world = country !== "KR" || era !== "modern" || !!o.world;
  core.setNames(country !== "KR" ? WNAMES[country] : null);
  const pool = country !== "KR" ? WNAMES[country] : NAMES;
  const name = cleanText(o.name, TEXT_MAX.name) || pool[gender][Math.floor(RAND() * pool[gender].length)];
  const p = core.createPlayer(name, { gender, recent: o.recent || [] });
  { const lp = lifeParams(country, era); p.country = country; p.era = era; p.lifeMul = lp.lifeMul; p.incomeMul = lp.incomeMul; p.poorMul = lp.poor; }
  p.persona = (o.persona || []).filter(id => PERSONA_BY_ID[id]).slice(0, 3);
  p.values = (o.values || []).filter(id => VALUE_BY_ID[id]).slice(0, 3);
  p.interests = (o.interests || []).filter(id => INTEREST_BY_ID[id]).slice(0, 4);
  for (const id of p.persona) for (const [k, v] of Object.entries(PERSONA_BY_ID[id].st)) if (typeof p.stats[k] === "number") p.stats[k] = Math.max(0, Math.min(100, p.stats[k] + v));
  const texts = { dream: cleanText(o.dream, TEXT_MAX.dream), wish: cleanText(o.wish, TEXT_MAX.wish), thoughts: [] };
  p.dreamText = texts.dream || texts.wish || ""; p.dreamKeys = dreamKeys(texts.dream + " " + texts.wish);
  const region = country === "KR" ? (o.region && REGIONS_KR.includes(o.region) ? o.region : pickW(REGIONS_KR, REGION_W)) : (COUNTRY_BY_ID[country].regions.some(r => r.id === o.region) ? o.region : pickRegion(country, RAND));
  const birthYear = wantYear;
  const S = {
    v: VERSION, world, mode: o.mode === "custom" ? "custom" : "random", p, texts,
    rec: { profile: { name, gender, region, country, era, world, mode: o.mode === "custom" ? "custom" : "random", persona: p.persona.slice(), values: p.values.slice(), interests: p.interests.slice(), dreamKeys: dreamKeys(texts.dream + " " + texts.wish) }, years: [], decisions: [], recalls: [], peopleSeen: {} },
    branches: [], pending: null, prompt: null, done: false, companions: [], birthYearWanted: birthYear,
  };
  return S;
}
function pickW(arr, w) { let r = RAND() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r < 0) return arr[i]; } return arr[arr.length - 1]; }

/** 태어남 (0살 기록 + 1살 시작) */
export function begin(S, world = null) {
  const p = S.p; namesFor(S);
  const w = world || (S.birthYearWanted ? core.createWorld(S.birthYearWanted) : null);
  const r = core.beginLife(p, w);
  if (p.incomeMul && p.incomeMul !== 1 && p.stats.money) p.stats.money = Math.round(p.stats.money * p.incomeMul);   // 태어난 집 돈도 그 나라 수준
  S.rec.profile.birthYear = p.birthYear; S.rec.profile.birth = p.birth ? { family: p.birth.family.id, body: p.birth.body.id, talent: p.birth.talent.id } : null;
  S.rec.years.push(snapYear(S, { age: 0, lines: [], milestone: null, birth: r.birth }, null));
  return afterYear(S, r);
}
/** 한 해 보내기 */
export function nextYear(S) {
  if (S.done || S.pending || S.prompt) return null;
  const p = S.p; namesFor(S);
  applyFocus(p);
  const r = core.advanceYear(p);
  if (!r) return null;
  return afterYear(S, r);
}
function applyFocus(p) {
  const f = p.focus && FOCUS_BY_ID[p.focus];
  if (!f || !focusOk(f, p.age + 1)) return;
  for (const [k, v] of Object.entries(f.eff)) { if (typeof p.stats[k] !== "number") continue; const nv = p.stats[k] + v * (0.6 + RAND() * 0.8); p.stats[k] = Math.max(0, Math.min(100, Math.round(nv * 10) / 10)); }
  if (f.money && p.stats.money > 0 && p.age >= 18) p.stats.money = Math.round(p.stats.money * (1 + f.money * (0.5 + RAND())));
  (p.focusYears ||= {})[f.id] = (p.focusYears[f.id] || 0) + 1;
}
function afterYear(S, r) {
  const p = S.p;
  const y = snapYear(S, r, r.event);
  S.rec.years.push(y);
  if (!r.death && p.age > 0) worldYear(S, y);
  if (r.death) { y.death = { id: p.cause?.id }; finish(S, r); return { year: y, raw: r, death: true, pending: null, prompt: S.prompt }; } // 죽는 해에도 그해 기록을 돌려줌 (화면이 마지막 해 카드를 그림)
  if (r.event) S.pending = { ev: r.event, pub: core.publicEvent(p, r.event), age: p.age };
  if (PROMPT_AT[p.age] && !S.texts[PROMPT_AT[p.age]]) S.prompt = { key: PROMPT_AT[p.age], age: p.age };
  recallCheck(S, y);
  return { year: y, raw: r, pending: S.pending, prompt: S.prompt };
}
function snapYear(S, r, ev) {
  const p = S.p, st = {};
  for (const k of ["happy", "intel", "social", "power", "internet", "luck", "health"]) st[k] = Math.round(p.stats[k] ?? 0);
  const m = metrics(p);
  const y = {
    a: r.age ?? p.age, y: (p.birthYear || 2000) + (r.age ?? p.age), st, m: Math.round(p.stats.money), fame: m.fame, stress: m.stress, achieve: m.achieve,
    job: p.job ? { t: p.job.title, s: p.job.salary } : null, car: p.career || null, stp: p.careerStep || 0, house: p.housing, sp: p.spouse?.name || null, rom: p.relations?.romance || null,
    kids: p.kids.length, foc: p.focus || null, inc: r.economy?.income || 0, net: r.economy?.net || 0,
    ms: r.milestone ? 1 : 0, lines: (r.lineKeys || []).slice(0, 6), linesKo: (r.lines || []).slice(0, 6),
    quiet: r.quiet ? { k: r.quiet.k || null, sys: r.quiet.sys || null, v: r.quiet.v || null, text: r.quiet.text || "" } : null,
    fate: r.fate ? { id: r.fate.id, t: r.fate.title, x: r.fate.text, good: r.fate.good ?? null } : null,
    news: r.news ? (Array.isArray(r.news) ? r.news : [r.news]).slice(0, 2) : null,
    ev: ev ? { id: ev.id, t: core.publicEvent(p, ev).title, cat: core.categoryOf(ev), maj: core.isMajor(ev) ? 1 : 0, emoji: ev.emoji || "" } : null,
    th: [],
  };
  if (r.birth) y.birth = { family: r.birth.family?.id, body: r.birth.body?.id, talent: r.birth.talent?.id };
  return y;
}

// ---------- 세계 공동 사건 (같은 world 객체 = 같은 세상) ----------
function worldYear(S, y) {
  const p = S.p, w = p.world; if (!w) return;
  const cal = (p.birthYear || 2000) + p.age;
  const ctrs = w.countries?.length ? w.countries : [p.country || "KR"];
  const list = worldEventsOf(w, cal, ctrs);
  for (const wid of list) {
    const e = worldEventById(wid);
    const r = applyWorldEvent(p, wid, core.addStat); if (!r) continue;
    (y.wev ||= []).push(r); (S.rec.wev ||= []).push({ a: p.age, y: cal, ...r });
    if (e?.econ && e.scope === "*" && w.econForced !== cal) { w.econForced = cal; w.econ = e.econ; w.econLeft = 2; }
  }
  if (y.wev) { const st = y.st; for (const k of Object.keys(st)) st[k] = Math.round(p.stats[k] ?? st[k]); y.m = Math.round(p.stats.money); }
}

/** 결정 카드에서 고르기 — 중요한 사건이면 고르기 직전 상태를 저장(다른 선택 다시 해 보기용) */
export function choose(S, cid, opts = {}) {
  if (!S.pending) return null;
  namesFor(S);
  const p = S.p, { ev, pub } = S.pending;
  const major = core.isMajor(ev) || pub.choices.length >= 2 && (ev.type === "special");
  if (!opts.noBranch && pub.choices.filter(c => !c.locked).length >= 2) S.branches.push({ age: p.age, evId: ev.id, title: pub.title, chosen: cid, alts: pub.choices.filter(c => !c.locked && c.id !== cid).map(c => ({ id: c.id, text: c.text })), choiceText: pub.choices.find(c => c.id === cid)?.text || "", snap: JSON.parse(JSON.stringify(core.serialize(p))), /* 깊은 복사: 얕게 두면 원래 인생이 늙으며 분기점도 같이 바뀜 */ yearsN: S.rec.years.length, decN: S.rec.decisions.length, major: major ? 1 : 0, texts: JSON.parse(JSON.stringify(S.texts)) });
  if (S.branches.length > 60) S.branches.splice(0, S.branches.length - 60);
  const res = core.applyChoice(p, ev, cid);
  S.pending = null;
  if (!res) return null;
  const y = S.rec.years[S.rec.years.length - 1];
  const dec = { a: p.age, id: ev.id, t: pub.title, cid, c: res.choiceText, n: res.narrative, src: res.src, g: res.grade, cat: core.categoryOf(ev), maj: major ? 1 : 0, d: res.deltas, emoji: ev.emoji || "", auto: opts.auto ? 1 : 0, alts: pub.choices.filter(c => c.id !== cid).map(c => ({ id: c.id, text: c.text })).slice(0, 3) };
  S.rec.decisions.push(dec);
  if (y) { y.dec = S.rec.decisions.length - 1; y.m = Math.round(p.stats.money); y.job = p.job ? { t: p.job.title, s: p.job.salary } : null; y.car = p.career || null; y.stp = p.careerStep || 0; y.sp = p.spouse?.name || null; y.kids = p.kids.length; }
  if (res.death) { y.death = { id: p.cause?.id }; return { ...res, end: finish(S, { age: p.age, death: res.death }) }; }
  if (p.job && !S._firstJobRecalled && S.texts.wish) { S._firstJobRecalled = 1; addRecall(S, "wish_first_job", "wish"); }
  return res;
}
/** 자유 입력 답 (질문·생각·편지·묘비) */
export function writeText(S, key, text) {
  const max = key === "letter" ? TEXT_MAX.letter : key === "last" ? TEXT_MAX.last : key === "epitaph" ? TEXT_MAX.epitaph : key === "dream" ? TEXT_MAX.dream : key === "wish" ? TEXT_MAX.wish : TEXT_MAX.q;
  const t = cleanText(text, max);
  if (key === "thought") { if (!t) return null; const th = { a: S.p.age, text: t }; S.texts.thoughts.push(th); if (S.texts.thoughts.length > 60) S.texts.thoughts.shift(); const y = S.rec.years[S.rec.years.length - 1]; if (y) y.th.push(t); return th; }
  S.texts[key] = t;
  if (S.prompt && S.prompt.key === key) S.prompt = null;
  if (key === "dream" || key === "wish") S.rec.profile.dreamKeys = dreamKeys(S.texts.dream + " " + S.texts.wish + " " + (S.texts.q10 || "") + " " + (S.texts.q18 || ""));
  if (key === "q10" || key === "q18") S.rec.profile.dreamKeys = dreamKeys((S.texts.dream || "") + " " + (S.texts.wish || "") + " " + (S.texts.q10 || "") + " " + (S.texts.q18 || ""));
  if (["dream", "wish", "q10", "q18"].includes(key)) { S.p.dreamKeys = S.rec.profile.dreamKeys || []; if (!S.p.dreamText && t) S.p.dreamText = t; }
  return t;
}
export function skipPrompt(S) { if (S.prompt) { S.texts[S.prompt.key] = ""; S.prompt = null; } }
export function setFocus(S, id) { const f = FOCUS_BY_ID[id]; if (!f || !focusOk(f, S.p.age)) return false; S.p.focus = id; return true; }

function addRecall(S, id, need) { if (S.rec.recalls.some(r => r.id === id)) return; S.rec.recalls.push({ id, a: S.p.age, need }); const y = S.rec.years[S.rec.years.length - 1]; if (y) (y.recall ||= []).push(id); }
function recallCheck(S, y) {
  const p = S.p;
  for (const R of RECALLS) {
    if (R.at && p.age !== R.at) continue;
    if (R.when === "kid" && !(p.kids.length === 1 && y.kids === 1 && !S._kidRecalled)) continue;
    if (R.when === "job") continue;
    const has = R.need === "thought" ? S.texts.thoughts.length > 0 : !!S.texts[R.need];
    if (!has) continue;
    if (R.when === "kid") S._kidRecalled = 1;
    addRecall(S, R.id, R.need);
  }
}

// ---------- 끝 ----------
function finish(S, r) {
  S.done = true; S.pending = null; S.prompt = { key: "last", age: S.p.deathAge ?? S.p.age, final: true };
  S.rec.final = summarize(S);
  return S.rec.final;
}
/** 인생 전체 요약 (결말 엔진이 쓰는 숫자·사실) — 모두 실제 기록에서 계산 */
export function summarize(S) {
  const p = S.p, Y = S.rec.years.filter(y => y.a > 0), D = S.rec.decisions;
  const money = Y.map(y => y.m);
  const peakI = money.indexOf(Math.max(...money)), lowI = money.indexOf(Math.min(...money));
  const happyAvg = Y.length ? Math.round(Y.reduce((s, y) => s + y.st.happy, 0) / Y.length) : 0;
  // 행복했던 때·힘들었던 때: 5년 이동 평균이 가장 높은/낮은 구간
  const win = (k) => { let best = null, worst = null; for (let i = 0; i + 4 < Y.length; i++) { const v = Y.slice(i, i + 5).reduce((s, y) => s + y.st[k], 0) / 5; if (!best || v > best.v) best = { v, from: Y[i].a, to: Y[i + 4].a }; if (!worst || v < worst.v) worst = { v, from: Y[i].a, to: Y[i + 4].a }; } return { best, worst }; };
  const hw = win("happy");
  const jobs = []; for (const y of Y) { const t = y.job?.t || null; if (t && (!jobs.length || jobs[jobs.length - 1].t !== t)) jobs.push({ t, from: y.a, to: y.a, car: y.car }); else if (t && jobs.length) jobs[jobs.length - 1].to = y.a; }
  const totalIncome = Y.reduce((s, y) => s + Math.max(0, y.inc || 0), 0);
  const dk = S.rec.profile.dreamKeys || [];
  const dreamDone = dk.length ? (p.careerHist || []).map(h => h.key).concat(p.career ? [p.career] : []).some(k => careerMatchesDream(k, dk)) : null;
  const firstMoney = money.find(v => v !== 0) ?? 0;
  const biggest = D.filter(d => d.d && typeof d.d.money === "number").sort((a, b) => Math.abs(b.d.money) - Math.abs(a.d.money))[0] || null;
  const turning = D.filter(d => d.maj).slice(0, 12).map(d => ({ a: d.a, id: d.id, t: d.t, c: d.c }));
  const peopleList = (p.people || []).map(x => ({ id: x.id, name: x.name, rel: x.rel, status: x.status, met: x.met ?? null, close: Math.round(x.close ?? 0), left: x.left ?? x.died ?? null }));
  const famStart = p.birth?.family?.id || null;
  const climb = (() => { const lowStart = ["poor", "struggle", "hard"].some(w => String(famStart || "").includes(w)); const rich = Math.max(...money) >= 100000; return lowStart && rich; })();
  return {
    deathAge: p.deathAge, deathYear: (p.birthYear || 2000) + (p.deathAge || 0), cause: p.cause?.id || null,
    ending: p.ending ? { id: p.ending.id, rarity: p.ending.rarity || null } : null, titles: (p.titles || []).map(t => t.id), analysisKeys: p.analysisKeys || [],
    report: core.lifeReport(p), score: core.lifeScore(p),
    money: { final: Math.round(p.stats.money), peak: money[peakI] ?? 0, peakAge: Y[peakI]?.a ?? null, low: money[lowI] ?? 0, lowAge: Y[lowI]?.a ?? null, totalIncome, debtYears: Y.filter(y => y.m < 0).length, first: firstMoney },
    happyAvg, happyBest: hw.best, happyWorst: hw.worst,
    jobs, careerHist: (p.careerHist || []).map(h => ({ key: h.key, step: h.step, from: h.from, to: h.to, state: h.state })), career: p.career || null, careerStep: p.careerStep || 0,
    spouse: p.spouse ? { name: p.spouse.name, since: p.spouse.since } : null, spouseEnd: p.spouseEnd || null, kids: p.kids.map(k => ({ name: k.name, born: k.born, g: k.gender })), pets: (p.pets || []).map(x => ({ name: x.name, kind: x.kind, born: x.born, alive: x.alive })),
    people: peopleList, friends: Object.keys(p.relations?.friends || {}), foes: [...new Set(p.relations?.foes || [])],
    achv: (p.achv || []).slice(), goalsDone: (p.goalsDone || []).slice(), memories: (p.memories || []).slice(-30), edu: p.edu || null,
    flags: [...(p.flags || [])].filter(f => /married|divorced|widowed|retired|orphaned|has_kid|startup|bankrupt|abroad|travel|famous|debt|sick|disab|immig|lotto|rich/i.test(f)),
    dreamDone, focusYears: { ...(p.focusYears || {}) }, decisions: D.length, majorN: D.filter(d => d.maj).length, biggestMoney: biggest ? { a: biggest.a, id: biggest.id, t: biggest.t, c: biggest.c, v: biggest.d.money } : null, turning,
    climb, housing: p.housing, birthFamily: famStart,
    country: p.country || "KR", era: p.era || "modern", wev: (S.rec.wev || []).slice(-60),
  };
}

// ---------- 그때 다른 선택을 했다면? ----------
/** 가장 크게 삶을 바꾼 선택 3개 (분기점) */
export function keyBranches(S, n = 3) {
  const D = S.rec.decisions;
  const scored = S.branches.map((b, i) => {
    const d = D[b.decN]; if (!d) return null;
    const delta = d.d || {}; let w = 0;
    for (const [k, v] of Object.entries(delta)) w += k === "money" ? Math.min(40, Math.log10(1 + Math.abs(v)) * 9) : Math.abs(v);
    if (d.maj) w += 30; if (d.cat === "love" || d.cat === "family") w += 8; if (d.cat === "career") w += 10;
    return { i, w, b, d };
  }).filter(Boolean).sort((x, y) => y.w - x.w);
  const out = []; for (const s of scored) { if (out.some(o => Math.abs(o.b.age - s.b.age) < 4)) continue; out.push(s); if (out.length >= n) break; }
  return out.sort((a, b) => a.b.age - b.b.age).map(s => ({ idx: s.i, age: s.b.age, evId: s.b.evId, title: s.b.title, chosen: s.b.chosen, choiceText: s.b.choiceText, alts: s.b.alts }));
}
/** 분기점에서 다른 선택으로 새 인생을 만든다 (그 앞까지의 기록은 그대로) */
export function branchFrom(S, idx, altCid) {
  const b = S.branches[idx]; if (!b || !b.alts.some(a => a.id === altCid)) return null;
  const p = core.restore(JSON.parse(JSON.stringify(b.snap)));
  const N = { ...S, p, texts: JSON.parse(JSON.stringify(b.texts)), rec: JSON.parse(JSON.stringify({ ...S.rec, years: S.rec.years.slice(0, b.yearsN), decisions: S.rec.decisions.slice(0, b.decN), recalls: S.rec.recalls.filter(r => r.a <= b.age), final: null })), branches: S.branches.slice(0, idx).map(x => x), pending: null, prompt: null, done: false, companions: [], whatIf: { from: b.age, evId: b.evId, orig: b.chosen, alt: altCid } };
  const ev = core.EVENTS.find(e => e.id === b.evId); if (!ev) return null;
  N.pending = { ev, pub: core.publicEvent(p, ev), age: p.age };
  choose(N, altCid, { noBranch: true });
  return N;
}

// ---------- 자동으로 살기 (같은 날 태어난 4명·다른 선택 빠르게 보기·시뮬) ----------
/** 성격에 맞춰 고르는 자동 선택 */
export function autoChoice(S) {
  const pub = S.pending?.pub; if (!pub) return null;
  const open = pub.choices.filter(c => !c.locked); const L = open.length ? open : pub.choices;
  // 사람처럼: 좋은 쪽을 조금 더 자주, 나쁜 쪽은 덜 (완전 무작위면 연애·결혼이 거의 안 이어짐)
  const W = { crit: 2.2, good: 2, mid: 1.2, bad: 0.5 }, ws = L.map(c => W[c.grade] || 1), tot = ws.reduce((a, b) => a + b, 0);
  let r = RAND() * tot; for (let i = 0; i < L.length; i++) { r -= ws[i]; if (r <= 0) return L[i].id; }
  return L[L.length - 1].id;
}
export function autoLive(S, maxYears = 130) {
  for (let i = 0; i < maxYears * 3 && !S.done; i++) {
    if (S.prompt && !S.prompt.final) { skipPrompt(S); continue; }
    if (S.pending) { choose(S, autoChoice(S), { auto: true, noBranch: true }); continue; }
    if (!S.p.focus || (S.p.age % 7 === 0)) { const ok = FOCUS.filter(f => focusOk(f, S.p.age + 1)); if (ok.length) S.p.focus = ok[Math.floor(RAND() * ok.length)].id; }
    nextYear(S);
  }
  return S;
}
export function makeCompanions(S, n = 4) {
  const out = [];
  const ctry = S.p.country || "KR";
  for (let i = 0; i < n; i++) {
    const g = RAND() < 0.5 ? "M" : "F";
    const persona = [PERSONA[Math.floor(RAND() * PERSONA.length)].id];
    const C = newLife({ gender: g, persona, country: ctry, era: S.p.era, birthYear: S.p.birthYear, region: ctry === "KR" ? REGIONS_KR[Math.floor(RAND() * REGIONS_KR.length)] : undefined });
    begin(C, S.p.world || core.createWorld(S.p.birthYear));   // 같은 세상 (같은 세계 사건)
    out.push(C);
  }
  S.companions = out; return out;
}
/** 동무들을 내 나이까지 (또는 끝까지) */
export function stepCompanions(S, toAge) {
  for (const C of S.companions) {
    namesFor(C);
    for (let k = 0; k < 400 && !C.done && C.p.age < toAge; k++) {
      if (C.prompt) { skipPrompt(C); continue; }
      if (C.pending) { choose(C, autoChoice(C), { auto: true, noBranch: true }); continue; }
      if (!C.p.focus || C.p.age % 6 === 0) { const ok = FOCUS.filter(f => focusOk(f, C.p.age + 1)); if (ok.length) C.p.focus = ok[Math.floor(RAND() * ok.length)].id; }
      nextYear(C);
    }
    if (C.pending && C.p.age >= toAge) { /* 결정은 다음 해에 */ }
  }
}
export function companionView(C) {
  const p = C.p, last = C.rec.years[C.rec.years.length - 1];
  const d = C.rec.decisions[C.rec.decisions.length - 1];
  return { name: p.nickname, gender: p.gender, region: C.rec.profile.region, age: p.age, alive: p.alive, job: p.job?.title || null, career: p.career || null, married: !!p.spouse, kids: p.kids.length, money: Math.round(p.stats.money), happy: Math.round(p.stats.happy), last: d ? { a: d.a, t: d.t, src: d.src } : null, deathAge: p.deathAge || null, cause: p.cause?.id || null, ending: p.ending?.id || null, persona: C.rec.profile.persona };
}

// ---------- 저장 / 이어하기 ----------
export function saveState(S) {
  return JSON.stringify({ v: VERSION, mode: S.mode, p: core.serialize(S.p), texts: S.texts, rec: S.rec, pending: S.pending ? { evId: S.pending.ev.id, age: S.pending.age } : null, prompt: S.prompt, done: S.done, branches: S.branches.slice(-25), companions: S.companions.map(C => ({ p: core.serialize(C.p), rec: { profile: C.rec.profile, years: C.rec.years.slice(-3), decisions: C.rec.decisions.slice(-3) }, done: C.done, texts: C.texts })), whatIf: S.whatIf || null });
}
export function loadState(json) {
  const o = typeof json === "string" ? JSON.parse(json) : json; if (!o || o.v !== VERSION) return null;
  const p = core.restore(o.p);
  const S = { v: VERSION, mode: o.mode, p, texts: o.texts, rec: o.rec, branches: o.branches || [], pending: null, prompt: o.prompt, done: o.done, companions: [], whatIf: o.whatIf || null };
  if (o.pending) { const ev = core.EVENTS.find(e => e.id === o.pending.evId); if (ev) S.pending = { ev, pub: core.publicEvent(p, ev), age: o.pending.age }; }
  S.companions = (o.companions || []).map(c => ({ v: VERSION, p: core.restore(c.p), texts: c.texts || { thoughts: [] }, rec: { profile: c.rec.profile, years: c.rec.years, decisions: c.rec.decisions, recalls: [] }, branches: [], pending: null, prompt: null, done: c.done, companions: [] }));
  return S;
}
// ---------- 같은 나를 다른 시대에 태어나게 했다면? (자동으로 살아 본 가상 인생 — 실제 기록 아님) ----------
export function eraWhatIf(S, eras = ["past", "modern", "future"]) {
  const pr = S.rec.profile, out = [];
  for (const era of eras) {
    if (era === (S.p.era || "modern")) continue;
    const C = newLife({ name: S.p.nickname, gender: S.p.gender, country: pr.country || "KR", era, persona: pr.persona, values: pr.values, interests: pr.interests, dream: S.texts.dream, wish: S.texts.wish });
    begin(C); autoLive(C);
    const F = C.rec.final || summarize(C);
    out.push({ era, birthYear: C.p.birthYear, deathAge: F.deathAge, money: F.money.final, peak: F.money.peak, happyAvg: F.happyAvg, job: F.jobs.slice(-1)[0]?.t || null, married: !!F.spouse || F.flags.includes("married"), kids: F.kids.length, dreamDone: F.dreamDone, ending: F.ending?.id || null, wev: (C.rec.wev || []).filter(x => x.mine && Object.keys(x.d).length).slice(0, 6).map(x => ({ id: x.id, a: x.a, y: x.y, real: x.real, fiction: x.fiction })) });
  }
  namesFor(S);
  return out;
}
export function setRandom(fn) { RAND = typeof fn === "function" ? fn : Math.random; }
