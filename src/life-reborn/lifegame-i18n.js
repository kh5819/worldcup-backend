// =========================
// 인생게임 v2 — 게임 전용 번역(한·日·EN)
// 사이트 i18n.js(문장 통째 사전)로는 이름·숫자가 섞인 게임 문장을 못 바꾸므로, 사건·운명·엔딩은 id/키로 찾는다.
// 번역 데이터: lifegame-tr-ja.js / lifegame-tr-en.js (lifegame-tr-src/build.mjs 가 생성, 필요한 언어만 불러옴)
// 언어 = window.i18n.lang (사이트 토글). 바뀌면 document 'i18n:change' → onLangChange 콜백
// =========================
import { formatWon } from "./lifegame-core.js?v=20261026_5";
import { tx, GOAL_BY_ID, REL, TREND_NAME, ACHV_BY_ID } from "./lifegame-systems.js?v=20261026_5";
import { NAMES_TR } from "./life-world.js?v=20261123_w1";

const TR_VER = "20261101_fe1";
const cache = {};
let lang = "ko", TR = null;

export const curLang = () => { try { return window.i18n?.lang || "ko"; } catch (_) { return "ko"; } };
export const getLang = () => lang;
export const isKo = () => lang === "ko";

// REBORN: 새 사건 번역을 나중에 끼워 넣기 (lang → {ev:{...}})
// 주소(?v=)가 달라 모듈이 둘로 갈라져도 같은 곳에 모이게 전역에 둔다
const EXTRA = (globalThis.__lifeTrExtra ||= { ja: [], en: [] });
export function registerTr(l, obj) { if (EXTRA[l]) EXTRA[l].push(obj); } // 다음 ensureLang 때 합쳐짐
function mergeTr(T, obj) { for (const [k, v] of Object.entries(obj)) { if (v && typeof v === "object" && !Array.isArray(v)) T[k] = Object.assign(T[k] || {}, v); else T[k] = v; } }
export async function ensureLang(l = curLang()) {
  if (l !== "ja" && l !== "en") { lang = "ko"; TR = null; return; }
  if (!cache[l]) {
    try { cache[l] = (await import(`./lifegame-tr-${l}.js?v=${TR_VER}`)).default; }
    catch (e) { console.warn("[lifegame-i18n] 번역 파일을 못 불러왔어요", e); lang = "ko"; TR = null; return; }
  }
  { const T = cache[l], done = T.__extraN || 0; for (const x of EXTRA[l].slice(done)) mergeTr(T, x); T.__extraN = EXTRA[l].length; } // REBORN 새 사건 번역 합치기
  lang = l; TR = cache[l];
}
export function onLangChange(cb) {
  document.addEventListener("i18n:change", async (e) => { await ensureLang(e.detail?.lang || curLang()); cb(lang); });
}

// ===== 이름 표기(한국어 이름 → 일본어 가나 / 로마자) =====
const NAME = {
  "민준": ["ミンジュン", "Minjun"], "서준": ["ソジュン", "Seojun"], "도윤": ["ドユン", "Doyun"], "하준": ["ハジュン", "Hajun"],
  "지호": ["ジホ", "Jiho"], "준우": ["ジュヌ", "Junu"], "현우": ["ヒョヌ", "Hyunwoo"], "지훈": ["ジフン", "Jihun"],
  "성민": ["ソンミン", "Seongmin"], "태양": ["テヤン", "Taeyang"], "은우": ["ウヌ", "Eunwoo"], "건우": ["ゴヌ", "Geonwoo"],
  "서연": ["ソヨン", "Seoyeon"], "지우": ["ジウ", "Jiwoo"], "하은": ["ハウン", "Haeun"], "수아": ["スア", "Sua"],
  "지민": ["ジミン", "Jimin"], "예린": ["イェリン", "Yerin"], "채원": ["チェウォン", "Chaewon"], "다은": ["ダウン", "Daeun"],
  "유진": ["ユジン", "Yujin"], "소율": ["ソユル", "Soyul"], "하린": ["ハリン", "Harin"], "나연": ["ナヨン", "Nayeon"],
  "지은": ["ジウン", "Jieun"], "민호": ["ミノ", "Minho"], "태준": ["テジュン", "Taejun"],
  // 관계 이름(친구·연인·앙숙 표시용)
  "공동창업자": ["共同創業者", "Co-founder"], "절친": ["親友", "Best friend"], "소개팅 상대": ["紹介の相手", "Blind date"],
  "여행 크루": ["旅仲間", "Travel crew"], "그때 그 사람": ["あの頃の人", "That person from back then"], "탁구 친구": ["卓球仲間", "Ping-pong buddy"],
  "옛 단짝": ["昔の大親友", "Old best buddy"], "옆반 친구": ["隣のクラスの友達", "Friend from next door"], "동호회 친구": ["サークル仲間", "Club friend"],
  "남은 친구": ["残った友達", "Remaining friend"], "산책 친구": ["散歩仲間", "Walking buddy"],
  // 반려동물 이름
  "콩이": ["コンイ", "Kongi"], "보리": ["ボリ", "Bori"], "두부": ["トゥブ", "Tofu"], "초코": ["チョコ", "Choco"], "감자": ["カムジャ", "Potato"],
  "호두": ["ホドゥ", "Walnut"], "망고": ["マンゴー", "Mango"], "나비": ["ナビ", "Nabi"], "루비": ["ルビー", "Ruby"], "까미": ["カミ", "Kkami"],
  "별이": ["ピョリ", "Byeori"], "구름": ["クルム", "Cloud"], "모카": ["モカ", "Mocha"], "쿠키": ["クッキー", "Cookie"], "솜이": ["ソミ", "Somi"],
  ...NAMES_TR, // REBORN 세계 모드 이름
  "단비": ["タンビ", "Danbi"], "월급": ["給料", "Paycheck"], "아버지": ["父", "Dad"], "어머니": ["母", "Mom"], "반려동물": ["ペット", "your pet"], "그 친구": ["あの友達", "That friend"], "그 사람": ["あの人", "That person"], "아이": ["子ども", "the kid"],
};
export function nameOf(n) {
  if (!n || lang === "ko") return n;
  const x = NAME[n];
  return x ? x[lang === "ja" ? 0 : 1] : n;
}

/** 번역문 자리표시 채우기(ja/en은 조사가 없으니 그대로) */
export function fillT(str, ctx = {}) {
  if (typeof str !== "string" || str.indexOf("{") < 0) return str;
  return str.replace(/\{spouse\}/g, nameOf(ctx.spouse || "그 사람")).replace(/\{kid\}/g, nameOf(ctx.kid || "아이"))
    .replace(/\{age\}/g, String(ctx.age ?? "")).replace(/\{job\}/g, tJob(ctx.job || "")).replace(/\{name\}/g, ctx.name || "").replace(/\{pet\}/g, nameOf(ctx.pet || "반려동물"))
    .replace(/\{who\}/g, nameOf(ctx.who || "그 사람")).replace(/\{goal\}/g, tGoal(ctx.goal) || ui("goal_dream", {}, "꿈"))
    .replace(/\{memo\}/g, ctx.memo ? tEventTitle(ctx.memo, ctx.memo, ctx) : ui("that_day", {}, "그 일")).replace(/\{trend\}/g, tTrend(ctx.trend)).replace(/\{dream\}/g, ctx.dream || (lang === "ja" ? "子どもの頃の夢" : "a childhood dream"));
}
/** 사건·결과에 실려 온 그때의 등장 인물·목표(v)를 문맥에 덧씌운다 */
const withV = (ctx, v) => v ? { ...ctx, ...(v.who ? { who: v.who } : {}), ...(v.goal ? { goal: v.goal } : {}), ...(v.memo ? { memo: v.memo } : {}) } : ctx;
/** 플레이어(코어 상태 또는 공개 객체) → 치환용 문맥 */
export function ctxOf(p) {
  const L = p?.life || p || {};
  const pets = L.pets || [];
  const who = L.whoNow != null ? (L.people || []).find(x => x.id === L.whoNow)?.name : null;
  return { spouse: L.spouse?.name || L.relations?.romance, kid: L.kids?.[0]?.name, age: L.age, job: L.job?.title, name: p?.nickname || p?.name, pet: (pets.find(x => x.alive) || pets[pets.length - 1])?.name,
    who, goal: L.goal?.id || null, memo: L.memoNow?.ev || null, trend: L.world?.trend || null, dream: L.dreamText || null };
}

// ===== 사건 =====
export function tEvent(pub, ctx) {
  if (lang === "ko" || !pub) return pub;
  ctx = withV(ctx, pub.v);
  const t = TR?.ev?.[pub.id];
  if (!t) return pub;
  return {
    ...pub,
    title: fillT(t[0], ctx), desc: fillT(t[1], ctx),
    choices: pub.choices.map(c => { const x = t[2]?.[c.id]; return x ? { ...c, text: fillT(x[0], ctx), sub: x[1] ? fillT(x[1], ctx) : c.sub } : c; }),
  };
}
export function tEventTitle(evId, fallback, ctx) { const t = lang !== "ko" && TR?.ev?.[evId]; return t ? fillT(t[0], ctx) : fallback; }
export function tChoiceText(evId, cId, fallback, ctx) { const x = lang !== "ko" && TR?.ev?.[evId]?.[2]?.[cId]; return x ? fillT(x[0], ctx) : fallback; }
/** 선택 결과 서술: src={ev,c,o,n,fail} */
export function tNarr(src, fallback, ctx) {
  if (lang === "ko" || !src?.ev) return fallback;
  ctx = withV(ctx, src.v);
  const x = TR?.ev?.[src.ev]?.[2]?.[src.c];
  if (!x) return fallback;
  let body = src.o >= 0 ? x[3]?.[src.o] : src.n >= 0 ? x[2]?.[src.n] : null;
  if (body == null) body = ui("narr_default");
  return (src.fail ? ui("narr_fail") + " " : "") + fillT(body, ctx);
}
export function tFate(f, ctx) {
  const t = lang !== "ko" && TR?.fate?.[f.id];
  return t ? { title: fillT(t[0], ctx), text: fillT(t[1], ctx) } : { title: f.title, text: f.text };
}
export function tQuiet(q, ctx) {
  if (q?.sys) return tSys(q.sys, q.v);
  const t = lang !== "ko" && q?.k && TR?.q?.[q.k]; return t ? fillT(t, ctx) : q?.text;
}
export function tLine(lk, fallback, ctx) {
  if (lk?.k === "sys") return tSys(lk.key, lk.v);
  if (lang === "ko" || !lk) return fallback;
  if (lk.k === "drift") return fillT(ui("line_drift"), { ...ctx, spouse: lk.name });
  if (lk.k === "pet_gone") return ui("line_pet_gone", { pet: nameOf(lk.name), n: lk.n });
  return UI[lang]?.lines?.[lk.k] || fallback;
}
export function tMilestone(age, fallback) { return (lang !== "ko" && TR?.ms?.[age]) || fallback; }
export function tBirth(group, d) { const t = lang !== "ko" && TR?.birth?.[`${group}.${d.id}`]; return t ? { label: t[0], text: t[1] } : { label: d.label, text: d.text }; }
export function tDeath(c) { const t = lang !== "ko" && c && TR?.death?.[c.id]; return t ? { label: t[0], line: t[1] } : { label: c?.label, line: c?.line }; }
export function tJob(title) { return (lang !== "ko" && title && TR?.job?.[title]) || title; }
export function tStage(id, fallback) { return (lang !== "ko" && TR?.stage?.[id]) || fallback; }
export function tEnding(e) { const t = lang !== "ko" && e && TR?.end?.[e.id]; return t ? { ...e, title: t[0], quote: t[1] } : e; }
export function tAnalysis(keys, lines, ctx) {
  if (lang === "ko" || !keys) return lines || [];
  return keys.map((k, i) => { const t = TR?.an?.[k] || UI[lang]?.an?.[k]; return t ? fillT(t, ctx) : (lines?.[i] ?? k); });
}
export function tHistory(h, ctx) {
  if (lang === "ko" || !h) return h;
  if (h.src?.fate) { const t = TR?.fate?.[h.src.fate]; return t ? { ...h, eventTitle: fillT(t[0], ctx) } : h; }
  if (h.src?.job) return { ...h, eventTitle: ui("hist_job"), choiceText: tJob(h.src.job) };
  if (h.src?.ev) { ctx = withV(ctx, h.src.v); return { ...h, eventTitle: tEventTitle(h.src.ev, h.eventTitle, ctx), choiceText: tChoiceText(h.src.ev, h.src.c, h.choiceText, ctx), narrative: tNarr(h.src, h.narrative, ctx) }; }
  return h;
}

// ===== v3 시스템 문구(관계·기억·목표·시대·업적) =====
/** 시스템 문장: k=키, v={who,n,job,goal,trend} — 한국어는 원문(조사 자동), ja/en은 번역 사전 */
export function tSys(k, v = {}) {
  if (!k) return "";
  if (lang === "ko") return tx(k, { ...v, goal: v.goal ? GOAL_BY_ID[v.goal]?.name || v.goal : v.goal, trend: v.trend ? TREND_NAME[v.trend] || v.trend : v.trend });
  let s = TR?.sys?.[k];
  if (s == null) return tx(k, v);
  return s.replace(/\{who\}/g, nameOf(v.who || "")).replace(/\{n\}/g, String(v.n ?? "")).replace(/\{job\}/g, tJob(v.job || ""))
    .replace(/\{goal\}/g, tGoal(v.goal)).replace(/\{trend\}/g, tTrend(v.trend));
}
export function tGoal(id) { if (!id) return ""; return (lang !== "ko" && TR?.goal?.[id]) || GOAL_BY_ID[id]?.name || id; }
export function tRel(rel) { return (lang !== "ko" && TR?.rel?.[rel]) || REL[rel] || rel; }
export function tTrend(id) { if (!id) return ""; return (lang !== "ko" && TR?.trend?.[id]) || TREND_NAME[id] || id; }
const ECON_KO = { boom: "호황", normal: "보통", recession: "불황", crisis: "경제 위기" };
const TECH_KO = { ai: "AI 비서", auto: "자율주행", robot: "돌봄 로봇", space: "우주여행", longevity: "노화 억제 치료" };
export function tEcon(id) { return (lang !== "ko" && TR?.econ?.[id]) || ECON_KO[id] || id; }
export function tTech(id) { return (lang !== "ko" && TR?.tech?.[id]) || TECH_KO[id] || id; }
export function tAchv(id) {
  const a = ACHV_BY_ID[id]; if (!a) return { id, emoji: "🏅", name: id, desc: "" };
  const t = lang !== "ko" && TR?.achv?.[id];
  return { ...a, name: t ? t[0] : a.name, desc: t ? t[1] : a.desc };
}
/** 기억 한 줄: 사건 기억은 사건 제목→선택, 운명 기억은 운명 제목, 나머지는 시스템 문장 */
export function tMemory(m, ctx = {}) {
  if (!m) return "";
  if (m.k === "ev") {
    if (m.fate) { const t = lang !== "ko" && TR?.fate?.[m.fate]; return t ? fillT(t[0], ctx) : (m.title || m.fate); }
    if (m.ev) { const tt = tEventTitle(m.ev, m.title || m.ev, ctx), ct = m.c ? tChoiceText(m.ev, m.c, m.choice || "", ctx) : ""; return ct ? `${tt} → ${ct}` : tt; }
  }
  return tSys(m.k, m.v || {});
}

// ===== 돈 표기 =====
export function money(man) {
  if (lang === "ko") return formatWon(man);
  const v = Math.round(man), neg = v < 0, a = Math.abs(v);
  if (lang === "ja") {
    let s;
    if (a >= 10000) { const oku = Math.floor(a / 10000), rest = a % 10000; s = `${oku.toLocaleString("ja-JP")}億${rest ? rest.toLocaleString("ja-JP") + "万" : ""}ウォン`; }
    else s = `${a.toLocaleString("ja-JP")}万ウォン`;
    return (neg ? "-" : "") + s;
  }
  // en: 만원 → 원 단위로 환산해 K/M/B 표기
  const won = a * 10000;
  const s = won >= 1e9 ? `${(won / 1e9).toFixed(won >= 1e10 ? 1 : 2).replace(/\.?0+$/, "")}B` : won >= 1e6 ? `${(won / 1e6).toFixed(won >= 1e8 ? 0 : 1).replace(/\.0$/, "")}M` : `${Math.round(won / 1e3)}K`;
  return `${neg ? "-" : ""}₩${s}`;
}

// ===== 화면 문구 =====
const UI = {
  ko: {},
  ja: {
    stat: { money: "お金", happy: "幸福", intel: "知能", social: "社交性", power: "体力", health: "健康", internet: "ネット力", luck: "運" },
    house: { parents: "実家", rent: "月払い家賃", jeonse: "チョンセ", own: "持ち家", care: "介護施設" },
    grade: { crit: "大当たり", good: "いいね", bad: "あちゃー", mid: "まあまあ" },
    lines: { "정년을 맞았다.": "定年を迎えた。", "부모님 집을 나와 독립했다.": "実家を出て独立した。" },
    an: { "어느 한 쪽에 치우치지 않은 균형형. 그냥저냥 살아간다.": "どれにも偏らないバランス型。なんとなく生きていく。" },
    s: {
      age: "{n}歳", age_unit: "歳", born: "{name}、この世に生まれた。", year_net: "今年 {v}", job_none: "🧭 無職", retired: "🌅 引退", student: "🎒 学生", baby: "🍼 赤ちゃん",
      year_salary: "年 {v}", special: "✨ 特別な瞬間", longterm: "⏳ あの時の結果", luck_chip: "🎲 運", luck_tip: "結果は運次第", need_tip: "能力が足りないと効果が半減",
      next_life: "人生を続ける ▶", accept: "受け入れる ▶", fate_good: "🍀 幸運", fate_bad: "⚡ 不運", fate_mid: "🎲 運命", fate_note: "選べないこともある。それが人生だ。",
      no_change: "変化なし", mini_title: "{n}歳 · 人生ミニゲーム ({i}/5)", mini_log: "ミニゲーム · {t}",
      death_log: "{name}、享年{n}歳。{cause}この世を去った。", death_age: "享年{n}歳", death_cause: "{cause}この世を去った", see_result: "人生の総決算を見る ▶",
      idle_run: "時が流れている…", idle_pause: "一時停止中 — ▶ で再開", paused_btn: "▶ 再開", pause_btn: "⏸ 一時停止",
      card_family: "家", card_body: "体質", card_talent: "才能",
      end_rare: "✨ レアエンド", end_hidden: "🔮 隠しエンド", end_rest: "{name} · {n}歳 · {cause} 永眠",
      end_money: "最終純資産", end_peak: "最高資産", end_job: "最後の職業", end_years: "働いた年数", end_family: "家族", end_house: "家",
      years: "{n}年", none: "なし", alone: "ひとり", widowed: "🕊️ 死別", divorced: "📄 離婚", kids: "👶 {n}人",
      routes: "歩んだ道: {r}", analysis: "🧠 人生分析", rep_title: "📋 人生の成績表", rep_choices: "分かれ道で{n}回選んだ", rep_fate_good: "🍀 幸運 {n}回", rep_fate_bad: "⚡ 不運 {n}回", rep_top: "⭐ 強み", rep_low: "🩹 弱み", rep_stages: "🗓️ 時期別の成績", rep_gold: "🌟 黄金期", rep_dark: "🌧️ 試練期", rep_best: "🏆 最高の瞬間", rep_worst: "💥 最悪の瞬間", highlights: "📜 人生ハイライト", quiet_life: "静かな人生だった。", brand: "ゲーム天国 人生ゲーム",
      chart: "💰 生涯の資産推移", album: "📷 人生アルバム", alb_born: "おぎゃあ、生まれた", alb_wed: "{name}と結婚", alb_kid: "{name} 誕生",
      share_text: "🎲 人生ゲーム — {name}の一生\n{e} {t}\n享年{n}歳 · 純資産 {m}{sp}{k}\nhttps://playduo.kr/lifegame.html", share_sp: " · 配偶者 {v}", share_k: " · 子ども {v}人",
      copied: "結果をコピーしました", copy_fail: "コピーに失敗しました", anon: "匿名", me: "わたし",
      line_pet_gone: "🌈 {pet}が虹の橋を渡った。{n}年を一緒に過ごした。", pet_chip_dog: "🐶 {name} · {n}歳", pet_chip_cat: "🐱 {name} · {n}歳", pet_new: "新しい家族!", alb_pet: "{name}がうちの子に", adopt_banner: "🐾 {name}がやってきた",
      narr_default: "そうして時が流れた。", narr_fail: "能力が足りず、うまくいかなかった。", line_drift: "{spouse}とは自然に疎遠になった。連絡が途絶えがちになり、そのまま終わった。", hist_job: "就職",
      // 멀티
      m_me: "{name} (わたし)", m_watch: "👀 {name}の人生", m_back: "← 自分の人生を見る", m_dead: "🕯️ 享年{n}歳", m_card: "{n}歳 · {m}",
      m_waiting: "{names}さんが人生の分かれ道で選択中…", m_spec_wait: "観戦中 · {names}さんが選択中…", m_spec: "観戦中 · 時が流れている…",
      m_born: "おぎゃあ! みんな同じ日に生まれた", m_birth_note: "生まれは選べない。まもなく人生が始まる…", m_my_life: "{n}歳 · 私の人生", m_timeout: " · ⏱ 時間切れで自動選択",
      m_died: "享年{n}歳、{cause}この世を去った。", m_dead_note: "残った友達の人生を見守ろう。上の友達カードを押すと、その人の家族が見える。",
      m_mini_spec: "👀 観戦中 — 生きている人だけ参加できます", m_rank: "{n}位", m_norecord: "記録なし", m_score: "{n}点", m_more: "一生を見る ›",
      m_sub: "享年{n}歳 · {m}", m_need2: "2人以上必要", m_restart_fail: "再スタートに失敗しました", m_score_h: "総合スコア",
    },
  },
  en: {
    stat: { money: "Money", happy: "Happiness", intel: "Smarts", social: "Social", power: "Strength", health: "Health", internet: "Online", luck: "Luck" },
    house: { parents: "Parents' home", rent: "Monthly rent", jeonse: "Lump-sum lease", own: "Own home", care: "Care home" },
    grade: { crit: "Jackpot", good: "Nice", bad: "Ouch", mid: "So-so" },
    lines: { "정년을 맞았다.": "You reached retirement age.", "부모님 집을 나와 독립했다.": "You moved out of your parents' home." },
    an: { "어느 한 쪽에 치우치지 않은 균형형. 그냥저냥 살아간다.": "Balanced in every way. Just getting by." },
    s: {
      age: "age {n}", age_unit: "y/o", born: "{name} was born into the world.", year_net: "This year {v}", job_none: "🧭 No job", retired: "🌅 Retired", student: "🎒 Student", baby: "🍼 Baby",
      year_salary: "{v}/yr", special: "✨ A special moment", longterm: "⏳ How it turned out", luck_chip: "🎲 Luck", luck_tip: "The outcome depends on luck", need_tip: "Without enough skill, the effect is halved",
      next_life: "Keep living ▶", accept: "Accept it ▶", fate_good: "🍀 Good fortune", fate_bad: "⚡ Misfortune", fate_mid: "🎲 Fate", fate_note: "Some things you can't choose. That's life.",
      no_change: "No change", mini_title: "Age {n} · Life mini-game ({i}/5)", mini_log: "Mini-game · {t}",
      death_log: "{name} passed away {cause} at the age of {n}.", death_age: "Age {n}", death_cause: "Passed away {cause}", see_result: "See your life summary ▶",
      idle_run: "Time is passing…", idle_pause: "Paused — press ▶ to continue", paused_btn: "▶ Resume", pause_btn: "⏸ Pause",
      card_family: "Family", card_body: "Body", card_talent: "Talent",
      end_rare: "✨ Rare ending", end_hidden: "🔮 Hidden ending", end_rest: "{name} · age {n} · passed away {cause}",
      end_money: "Final net worth", end_peak: "Peak net worth", end_job: "Last job", end_years: "Years worked", end_family: "Family", end_house: "Home",
      years: "{n} yrs", none: "None", alone: "Single", widowed: "🕊️ Widowed", divorced: "📄 Divorced", kids: "👶 {n}",
      routes: "Paths taken: {r}", analysis: "🧠 Life analysis", rep_title: "📋 Life report card", rep_choices: "Made {n} choices at crossroads", rep_fate_good: "🍀 Lucky breaks: {n}", rep_fate_bad: "⚡ Bad luck: {n}", rep_top: "⭐ Best stat", rep_low: "🩹 Weakest stat", rep_stages: "🗓️ Score by life stage", rep_gold: "🌟 Golden age", rep_dark: "🌧️ Hard times", rep_best: "🏆 Best moment", rep_worst: "💥 Worst moment", highlights: "📜 Life highlights", quiet_life: "It was a quiet life.", brand: "Game Zone Life Game",
      chart: "💰 Net worth over a lifetime", album: "📷 Life album", alb_born: "Hello, world!", alb_wed: "Married {name}", alb_kid: "{name} is born",
      share_text: "🎲 Life Game — the life of {name}\n{e} {t}\nPassed away at {n} · Net worth {m}{sp}{k}\nhttps://playduo.kr/lifegame.html?lang=en", share_sp: " · Spouse {v}", share_k: " · {v} kid(s)",
      copied: "Result copied", copy_fail: "Copy failed", anon: "Anonymous", me: "Me",
      line_pet_gone: "🌈 {pet} crossed the rainbow bridge. You had {n} years together.", pet_chip_dog: "🐶 {name} · {n}y", pet_chip_cat: "🐱 {name} · {n}y", pet_new: "A new family member!", alb_pet: "{name} joined the family", adopt_banner: "🐾 {name} came home",
      narr_default: "And so time went by.", narr_fail: "Not skilled enough — things went sideways.", line_drift: "You and {spouse} drifted apart. The messages slowed, and then it was over.", hist_job: "Got a job",
      m_me: "{name} (me)", m_watch: "👀 {name}'s life", m_back: "← Back to my life", m_dead: "🕯️ Passed at {n}", m_card: "age {n} · {m}",
      m_waiting: "{names} {verb} at a crossroads…", m_spec_wait: "Spectating · {names} {verb}…", m_spec: "Spectating · time is passing…",
      m_born: "Waaah! Everyone was born on the same day", m_birth_note: "You can't choose how you're born. Life begins shortly…", m_my_life: "Age {n} · My life", m_timeout: " · ⏱ auto-picked (time up)",
      m_died: "Passed away {cause} at the age of {n}.", m_dead_note: "Watch your friends' lives play out. Tap a friend's card above to see their family.",
      m_mini_spec: "👀 Spectating — only living players can join", m_rank: "#{n}", m_norecord: "No record", m_score: "{n} pts", m_more: "View life ›",
      m_sub: "Passed at {n} · {m}", m_need2: "Need at least 2 players", m_restart_fail: "Couldn't restart", m_score_h: "Total score",
    },
  },
};
/** 화면 문구: ui("age", {n: 30}). 한국어는 KO 기본값을 호출부가 넘긴다(ko 인자) */
export function ui(key, vars = {}, ko) {
  let s = lang === "ko" ? (ko ?? key) : (UI[lang]?.s?.[key] ?? TR?.ui3?.[key] ?? ko ?? key);
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export function statLabel(key, ko) { return lang === "ko" ? ko : (UI[lang]?.stat?.[key] || ko); }
export function houseLabel(key, ko) { return lang === "ko" ? ko : (UI[lang]?.house?.[key] || ko); }
export function gradeLabel(g, ko) { return lang === "ko" ? ko : (UI[lang]?.grade?.[g] || ko); }
