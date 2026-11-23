// =========================
// 플듀 인생게임 REBORN — 사건 만들기 도구 (3개 언어 한 번에)
// ev(id, meta, [제목 ko,ja,en], [본문 ko,ja,en], [[선택 id, 이모지, [글 ko,ja,en], {effects, grade, flag, life, career, route, sub, n:[3], outcomes:[{chance, grade, effects, flag, life, n:[3]}]}], ...])
// 번역은 전역 __lifeTrExtra 에 넣고 lifegame-i18n.js 의 ensureLang 이 합친다 (모듈 주소 ?v 가 달라도 안전)
// =========================
const TR = { ja: { ev: {} }, en: { ev: {} } };
{ const X = (globalThis.__lifeTrExtra ||= { ja: [], en: [] }); X.ja.push(TR.ja); X.en.push(TR.en); }

export function ev(id, meta, title, desc, choices) {
  const out = { v: 2, type: "normal", stage: "*", id, ...meta, title: title[0], desc: desc[0], choices: [] };
  const tj = [title[1], desc[1], {}], te = [title[2], desc[2], {}];
  for (const [cid, emoji, text, o = {}] of choices) {
    const ch = { id: cid, emoji, text: text[0], grade: o.grade || "mid", effects: o.effects || {} };
    for (const k of ["flag", "career", "route", "life", "relation", "next", "longTerm"]) if (o[k] != null) ch[k] = o[k];
    if (o.sub) ch.sub = o.sub[0];
    if (o.n) ch.narratives = [o.n[0]];
    if (o.outcomes) ch.outcomes = o.outcomes.map(x => ({ chance: x.chance, grade: x.grade || "mid", effects: x.effects || {}, ...(x.flag ? { flag: x.flag } : {}), ...(x.life ? { life: x.life } : {}), ...(x.career ? { career: x.career } : {}), ...(x.relation ? { relation: x.relation } : {}), ...(x.next ? { next: x.next } : {}), narrative: x.n[0] }));
    out.choices.push(ch);
    tj[2][cid] = [text[1], o.sub ? o.sub[1] : null, o.n ? [o.n[1]] : [], (o.outcomes || []).map(x => x.n[1])];
    te[2][cid] = [text[2], o.sub ? o.sub[2] : null, o.n ? [o.n[2]] : [], (o.outcomes || []).map(x => x.n[2])];
  }
  TR.ja.ev[id] = tj; TR.en.ev[id] = te;
  return out;
}
export const kidAge = (p) => p.kids?.length ? p.age - (p.kids[0].born ?? p.age) : -1;
export const kidIn = (lo, hi) => (p) => { const a = kidAge(p); return a >= lo && a <= hi; };
